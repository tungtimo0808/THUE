"""Conservative, atomic issue costing for a single open accounting period."""

from collections import defaultdict, deque
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from general_ledger.models import AccountingPeriod, JournalEntry, JournalLine
from general_ledger.services import post as post_journal
from iam.permissions import has_effective_permission
from master_data.models import Warehouse
from organization.models import Company

from . import models, services


ZERO = Decimal("0")
VALUE_UNIT = Decimal("0.0001")
PRICE_UNIT = Decimal("0.0000000001")
METHODS = {"PERIODIC_AVERAGE", "MOVING_AVERAGE", "FIFO"}


def _allowed(request, company, warehouse, code):
    return request.user.is_superuser or has_effective_permission(
        services.actor(request), company, code, warehouse_id=warehouse.pk, branch_id=warehouse.branch_id)


def options(company, request):
    warehouses = [row for row in Warehouse.objects.filter(company=company).order_by("code")
                  if _allowed(request, company, row, "INV.VALUATION.RUN")]
    periods = AccountingPeriod.objects.filter(company=company).order_by("-end_date", "-start_date")
    configured = list(models.InventoryPolicy.objects.filter(company=company, warehouse__in=warehouses,
        is_active=True).values_list("valuation_method", flat=True).distinct())
    default_method = configured[0] if len(configured) == 1 and configured[0] in METHODS else "MOVING_AVERAGE"
    return {"warehouses": [{"id": str(row.pk), "code": row.code, "name": row.name} for row in warehouses],
            "periods": [{"id": str(row.pk), "code": row.code, "from": row.start_date, "to": row.end_date,
                         "status": row.status} for row in periods],
            "methods": [{"code": code, "name": label} for code, label in models.ValuationMethod.choices if code in METHODS],
            "default_method": default_method}


def _request_scope(data, request):
    try:
        company_id = UUID(str(data.get("company") or data.get("company_id") or ""))
        period_id = UUID(str(data.get("period") or ""))
    except (ValueError, AttributeError):
        raise ValidationError("Không xác định được doanh nghiệp hoặc kỳ tính giá hợp lệ.")
    company = Company.objects.filter(pk=company_id).first()
    period = AccountingPeriod.objects.filter(pk=period_id, company=company).first() if company else None
    if not period:
        raise ValidationError("Vui lòng chọn kỳ tính giá hợp lệ.")
    if period.status != "OPEN" or models.InventoryPeriod.objects.filter(company=company,
            status="CLOSED", start_date__lte=period.end_date, end_date__gte=period.start_date).exists():
        raise ValidationError("Kỳ kế toán đã khóa, không thể thực hiện tính giá xuất kho.")
    method = data.get("method")
    if method not in METHODS:
        raise ValidationError("Phương pháp tính giá không hợp lệ.")
    raw_warehouse = data.get("warehouse")
    if raw_warehouse:
        try:
            warehouse = Warehouse.objects.get(pk=UUID(str(raw_warehouse)), company=company)
        except (ValueError, Warehouse.DoesNotExist):
            raise ValidationError("Bạn không có quyền tính giá đối với kho đã chọn hoặc kho không hợp lệ.")
        warehouses = [warehouse]
    else:
        warehouses = list(Warehouse.objects.filter(company=company).order_by("code"))
    if not warehouses:
        raise ValidationError("Bạn chưa được cấp quyền tính giá ở kho nào.")
    if any(not _allowed(request, company, row, "INV.VALUATION.RUN") for row in warehouses):
        raise PermissionDenied("Bạn không có quyền thực hiện tính giá xuất kho tại tất cả kho đã chọn.")
    return company, period, method, warehouses


def _price_error(movement, reason):
    return ValidationError(f"Không đủ dữ liệu để xác định giá xuất kho: {movement.item.code}, "
                           f"kho {movement.warehouse.code}, chứng từ {movement.transaction.number}: {reason}.")


def record_failure(data, request, error):
    """Keep a failed attempt after the calculation transaction has rolled back."""
    try:
        company = Company.objects.get(pk=UUID(str(data.get("company") or data.get("company_id"))))
        period = AccountingPeriod.objects.get(pk=UUID(str(data.get("period"))), company=company)
        method = data.get("method")
        if method not in METHODS:
            return
        warehouse_id = UUID(str(data.get("warehouse"))) if data.get("warehouse") else None
        warehouse = Warehouse.objects.filter(pk=warehouse_id, company=company).first() if warehouse_id else None
        run = models.ValuationRun.objects.create(company=company, valuation_date=period.end_date,
            warehouse=warehouse, method=method, status="FAILED", created_by=services.actor(request),
            details={"period_start": str(period.start_date), "period_end": str(period.end_date),
                     "error": str(error.detail)[:500]})
        services.audit(request, run, "VALUE_FAILED", after=run.details)
    except (ValueError, AccountingPeriod.DoesNotExist, Company.DoesNotExist):
        return


@transaction.atomic
def run(data, request):
    company, period, method, warehouses = _request_scope(data, request)
    # All costing runs for the same company serialize on this row. Stock postings
    # lock the balances below, preventing values from changing after the read.
    Company.objects.select_for_update().get(pk=company.pk)
    warehouse_ids = [row.pk for row in warehouses]
    requested_warehouse = warehouses[0] if data.get("warehouse") else None
    previous = models.ValuationRun.objects.filter(company=company, valuation_date=period.end_date,
        status="COMPLETED")
    if requested_warehouse:
        from django.db.models import Q
        previous = previous.filter(Q(warehouse=requested_warehouse) | Q(warehouse__isnull=True))
    previous = [row for row in previous if (row.details or {}).get("period_start") == str(period.start_date)]
    if previous and not data.get("recalculate"):
        raise ValidationError("Kỳ và phạm vi này đã tính giá. Hãy xác nhận tính lại để thay thế kết quả.")
    if previous and AccountingPeriod.objects.filter(company=company, status="CLOSED",
            start_date__gt=period.end_date).exists():
        raise ValidationError("Không thể tính lại vì kết quả ảnh hưởng đến kỳ kế toán đã khóa.")

    list(models.StockBalance.objects.select_for_update().filter(company=company,
        warehouse_id__in=warehouse_ids).order_by("pk"))
    movements = list(models.StockMovement.objects.filter(company=company, warehouse_id__in=warehouse_ids,
        movement_date__gte=period.start_date, transaction__status__in=("POSTED", "REVERSED"))
        .select_related("item", "warehouse", "transaction", "line")
        .order_by("movement_date", "created_at", "pk"))
    groups = defaultdict(list)
    for row in movements:
        groups[(row.warehouse_id, row.item_id, row.location_id, row.lot_serial_id)].append(row)
    groups = {key: rows for key, rows in groups.items() if any(row.quantity_delta < 0 and
              row.movement_date <= period.end_date for row in rows)}
    if not groups:
        raise ValidationError("Không có phát sinh xuất kho cần tính giá trong kỳ đã chọn.")

    plans = []
    corrections = []
    updated_lines = set()
    affected_transactions = set()
    for (warehouse_id, item_id, location_id, lot_serial_id), rows in groups.items():
        if any(row.movement_date > period.end_date for row in rows):
            raise ValidationError("Có phát sinh sau kỳ tính giá của mặt hàng đã chọn. Vui lòng tính giá kỳ phụ thuộc trước.")
        if any(row.transaction.source_module == "INV_TRANSFER" or row.transaction.transaction_type == "TRANSFER" for row in rows):
            raise ValidationError("Có chuyển kho phụ thuộc giá vốn. Vui lòng tính giá theo quy trình điều chuyển đầy đủ.")
        if any(row.transaction.status == "REVERSED" for row in rows):
            raise ValidationError("Có chứng từ đảo trong kỳ. Vui lòng đối chiếu trước khi tính giá.")
        selected = list(models.StockBalance.objects.select_for_update().filter(company=company, warehouse_id=warehouse_id,
            item_id=item_id, location_id=location_id, lot_serial_id=lot_serial_id))
        if len(selected) != 1:
            raise ValidationError(f"Chưa đủ dữ liệu tồn đầu kỳ để tính giá xuất kho: {rows[0].item.code}.")
        balance = selected[0]
        policy = models.InventoryPolicy.objects.filter(company=company, warehouse_id=warehouse_id,
            item_id=item_id, is_active=True).first()
        configured = policy.valuation_method if policy else rows[0].item.valuation_method or "MOVING_AVERAGE"
        if configured != method:
            raise ValidationError(f"Phương pháp tính giá không phù hợp với thiết lập kế toán hiện tại: {rows[0].item.code} tại {rows[0].warehouse.code} ({configured}).")
        opening_qty = balance.quantity - sum((row.quantity_delta for row in rows), ZERO)
        opening_value = balance.inventory_value - sum((row.value_delta for row in rows), ZERO)
        if opening_qty < 0 or opening_value < 0 or opening_qty == 0 and opening_value != 0:
            raise ValidationError(f"Chưa đủ dữ liệu tồn đầu kỳ để tính giá xuất kho: {rows[0].item.code}.")
        if method == "FIFO" and opening_qty:
            raise ValidationError(f"Thiếu lớp tồn đầu kỳ FIFO của mặt hàng {rows[0].item.code}. Vui lòng bổ sung dữ liệu lớp hàng.")
        active = [row for row in rows if row.movement_date <= period.end_date]
        denominator = opening_qty + sum((row.quantity_delta for row in active if row.quantity_delta > 0), ZERO)
        numerator = opening_value + sum((row.value_delta for row in active if row.quantity_delta >= 0), ZERO)
        if method == "PERIODIC_AVERAGE" and (denominator <= 0 or numerator < 0):
            raise ValidationError(f"Không thể xác định đơn giá bình quân cho mặt hàng {rows[0].item.code}.")
        periodic_cost = numerator / denominator if method == "PERIODIC_AVERAGE" else ZERO
        qty, value = opening_qty, opening_value
        layers = deque()
        for row in active:
            delta = row.quantity_delta
            if delta > 0:
                qty += delta
                value += row.value_delta
                if method == "FIFO":
                    layers.append([delta, row.value_delta / delta])
                new_movement_value = row.value_delta
            elif delta == 0:
                if method == "FIFO" and row.value_delta:
                    raise ValidationError(f"Có điều chỉnh giá trị chưa phân bổ vào lớp FIFO: {row.item.code}.")
                value += row.value_delta
                new_movement_value = row.value_delta
            else:
                needed = -delta
                if qty < needed:
                    raise _price_error(row, "không đủ số lượng tồn trước lần xuất")
                if method == "PERIODIC_AVERAGE":
                    issue_value = (needed * periodic_cost).quantize(VALUE_UNIT, rounding=ROUND_HALF_UP)
                elif method == "MOVING_AVERAGE":
                    issue_value = (needed * value / qty).quantize(VALUE_UNIT, rounding=ROUND_HALF_UP)
                else:
                    remaining, cost = needed, ZERO
                    while remaining:
                        if not layers:
                            raise _price_error(row, "thiếu lớp hàng FIFO")
                        layer = layers[0]
                        used = min(remaining, layer[0])
                        cost += used * layer[1]
                        layer[0] -= used
                        remaining -= used
                        if layer[0] == 0:
                            layers.popleft()
                    issue_value = cost.quantize(VALUE_UNIT, rounding=ROUND_HALF_UP)
                qty -= needed
                value -= issue_value
                new_movement_value = -issue_value
                line = row.line
                if line.pk in updated_lines:
                    raise _price_error(row, "dòng xuất có nhiều phát sinh phụ thuộc")
                updated_lines.add(line.pk)
                affected_transactions.add(row.transaction_id)
                difference = issue_value - line.line_value
                if difference:
                    if not line.debit_account_id or not line.credit_account_id or line.debit_account_id == line.credit_account_id:
                        raise _price_error(row, "thiếu tài khoản giá vốn hoặc hàng tồn kho để điều chỉnh sổ cái")
                    corrections.append((line, row.warehouse, difference))
                plans.append(("line", line, issue_value, (issue_value / needed).quantize(PRICE_UNIT, rounding=ROUND_HALF_UP)))
            plans.append(("movement", row, new_movement_value, value.quantize(VALUE_UNIT, rounding=ROUND_HALF_UP)))
        if qty != balance.quantity:
            raise ValidationError("Kết quả tính giá xuất kho không cân đối. Vui lòng kiểm tra dữ liệu.")
        plans.append(("balance", balance, value.quantize(VALUE_UNIT, rounding=ROUND_HALF_UP),
                      (value / qty).quantize(PRICE_UNIT, rounding=ROUND_HALF_UP) if qty > 0 else ZERO))

    run = models.ValuationRun.objects.create(company=company, valuation_date=period.end_date,
        warehouse=requested_warehouse, method=method, created_by=services.actor(request),
        details={"period_start": str(period.start_date), "period_end": str(period.end_date),
                 "updated_lines": len(updated_lines), "adjustments": len(corrections),
                 "recalculated": bool(previous)})
    for kind, obj, first, second in plans:
        if kind == "line":
            obj.line_value, obj.unit_cost, obj.costing_status = first, second, "COMPLETED"
            obj.save(update_fields=("line_value", "unit_cost", "costing_status"))
        elif kind == "movement":
            obj.value_delta, obj.balance_value = first, second
            obj.save(update_fields=("value_delta", "balance_value"))
        else:
            obj.inventory_value, obj.average_cost = first, second
            obj.save(update_fields=("inventory_value", "average_cost", "updated_at"))
    for transaction_id in affected_transactions:
        transaction_obj = models.InventoryTransaction.objects.select_for_update().get(pk=transaction_id)
        transaction_obj.total_value = transaction_obj.lines.aggregate(value=Sum("line_value"))["value"] or ZERO
        transaction_obj.warnings = [warning for warning in transaction_obj.warnings if "Chưa hoàn tất tính giá" not in warning]
        transaction_obj.save(update_fields=("total_value", "warnings", "updated_at"))

    journal = None
    if corrections:
        journal_total = sum((abs(value) for _line, _warehouse, value in corrections), ZERO)
        journal = JournalEntry.objects.create(company=company, period=period, number=f"TGXK-{str(run.pk)[:12]}",
            entry_type="ADJUSTMENT", posting_date=period.end_date, document_date=period.end_date,
            description=f"Điều chỉnh giá xuất kho {period.code}", source_module="INV",
            source_event_id=f"INV.COST:{run.pk}", source_entity_type="ValuationRun", source_entity_id=run.pk,
            status="APPROVED", total_debit=journal_total, total_credit=journal_total,
            workflow_snapshot={"allow_creator_posting": True}, created_by=services.actor(request),
            approved_by=services.actor(request), approved_at=timezone.now())
        for index, (line, warehouse, difference) in enumerate(corrections):
            debit_account = line.debit_account if difference > 0 else line.credit_account
            credit_account = line.credit_account if difference > 0 else line.debit_account
            amount = abs(difference)
            JournalLine.objects.create(entry=journal, line_no=index * 2 + 1, account=debit_account,
                debit=amount, currency=company.accounting_currency, warehouse=warehouse)
            JournalLine.objects.create(entry=journal, line_no=index * 2 + 2, account=credit_account,
                credit=amount, currency=company.accounting_currency, warehouse=warehouse)
        post_journal(journal, request)
        for transaction_id in affected_transactions:
            transaction_obj = models.InventoryTransaction.objects.get(pk=transaction_id)
            if transaction_obj.gl_status == "NOT_REQUIRED" and transaction_obj.source_module in services.JOURNAL_MODULES:
                transaction_obj.gl_status, transaction_obj.gl_reference = "POSTED", journal.number
                transaction_obj.save(update_fields=("gl_status", "gl_reference", "updated_at"))
    totals = models.StockBalance.objects.filter(company=company, warehouse_id__in=warehouse_ids).aggregate(
        quantity=Sum("quantity"), value=Sum("inventory_value"))
    run.total_quantity = totals["quantity"] or ZERO
    run.total_value = totals["value"] or ZERO
    run.details = {**run.details, "journal_id": str(journal.pk) if journal else None}
    run.save(update_fields=("total_quantity", "total_value", "details"))
    services.audit(request, run, "VALUE", after={"period": period.code, "method": method,
        "warehouse": str(requested_warehouse.pk) if requested_warehouse else "ALL",
        "updated_lines": len(updated_lines), "adjustments": len(corrections)})
    return run
