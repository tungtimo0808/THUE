from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from . import models


ISSUE_MODULES = {"INV_OTHER_ISSUE", "INV_SALE_ISSUE"}
# Vouchers recorded with "Cất" (submit + post in one step) and their own UC messages.
WAREHOUSE_VOUCHER_MODULES = ISSUE_MODULES | {"INV_TRANSFER"}
JOURNAL_MODULES = {"INV_OTHER", "INV_COUNT_RESOLUTION"} | WAREHOUSE_VOUCHER_MODULES
TRANSFER_KINDS = {"INTERNAL": "Xuất chuyển kho nội bộ", "TRANSPORT": "Xuất kho kiêm vận chuyển nội bộ", "CONSIGNMENT": "Xuất kho gửi bán đại lý"}
VOUCHER_MESSAGES = {
    "INV_SALE_ISSUE": {
        "posted": "Phiếu xuất kho đã được ghi sổ.", "cancelled": "Phiếu xuất kho đã bị hủy",
        "locked": "Ngày hạch toán thuộc kỳ kế toán đã khóa.", "denied": "Bạn không có quyền ghi sổ chứng từ.",
        "failed": "Không thể lưu và ghi sổ phiếu xuất kho. Vui lòng thử lại.",
    },
    "INV_OTHER_ISSUE": {
        "posted": "Phiếu xuất kho đã được ghi sổ.", "cancelled": "Phiếu xuất kho đã bị hủy",
        "locked": "Không thể ghi sổ chứng từ trong kỳ kế toán đã khóa.", "denied": "Bạn không có quyền ghi sổ phiếu xuất kho.",
        "changed": "Tồn kho đã thay đổi, không đủ số lượng để xuất. Vui lòng kiểm tra lại.",
        "failed": "Không thể lưu và ghi sổ phiếu xuất kho. Vui lòng thử lại.",
    },
    "INV_TRANSFER": {
        "posted": "Chứng từ chuyển kho đã được ghi sổ.", "cancelled": "Chứng từ chuyển kho đã bị hủy",
        "locked": "Không thể ghi sổ chứng từ trong kỳ kế toán đã khóa.", "denied": "Bạn không có quyền ghi sổ chứng từ chuyển kho.",
        "changed": "Tồn kho đã thay đổi, không đủ số lượng để chuyển. Vui lòng kiểm tra lại.",
        "failed": "Không thể lưu và ghi sổ chứng từ chuyển kho. Vui lòng thử lại.",
    },
}


def voucher_message(obj, key, default=""):
    return VOUCHER_MESSAGES.get(obj.source_module, {}).get(key, default)


def transit_warehouse(company):
    """The company's in-transit warehouse used while transferred goods are on the road (AF16)."""
    from master_data.models import Warehouse
    return Warehouse.objects.filter(company=company, warehouse_type="TRANSIT", status="ACTIVE").order_by("code").first()


class StockShortageError(ValidationError):
    """Raised when an issue would take more than the available stock and negative stock is not allowed."""


def actor(request):
    if hasattr(request, "user") and hasattr(request.user, "iam_account"):
        return request.user.iam_account
    from iam.models import UserAccount
    if hasattr(request, "user") and isinstance(request.user, UserAccount):
        return request.user
    return UserAccount.objects.first()


def audit(request, obj, action, before=None, after=None, reason=""):
    record_audit(
        company=obj.company, actor_user=actor(request), module_code="INV", action_code=action,
        entity=obj, before=before or {}, after=after or {}, request=request, reason=reason,
    )


def _period_is_closed(obj):
    return models.InventoryPeriod.objects.filter(
        company=obj.company, start_date__lte=obj.transaction_date,
        end_date__gte=obj.transaction_date, status="CLOSED",
    ).exists()


@transaction.atomic
def submit(obj, request):
    obj = models.InventoryTransaction.objects.select_for_update().get(pk=obj.pk)
    if obj.status not in {"DRAFT", "REJECTED"} or not obj.lines.exists():
        raise ValidationError("Giao dịch không ở trạng thái có thể gửi hoặc chưa có chi tiết.")
    raw = request.data.get("workflow_snapshot") or {}
    try:
        levels = max(1, min(int(raw.get("levels", 1)), 20))
    except (TypeError, ValueError):
        raise ValidationError("Số cấp phê duyệt không hợp lệ.")
    obj.workflow_snapshot = {
        "version": str(raw.get("version", "DEFAULT"))[:80], "levels": levels,
        "allow_self_approval": bool(raw.get("allow_self_approval", True)),
    }
    configured = configured_snapshot(obj, f"INV.{obj.transaction_type}")
    if configured is not None:
        obj.workflow_snapshot = configured
    old = obj.status
    obj.status = "PENDING_APPROVAL" if configured is None or configured["approval_required"] else "APPROVED"
    obj.submitted_at = timezone.now()
    obj.approved_at = timezone.now() if obj.status == "APPROVED" else None
    obj.save(update_fields=("status", "workflow_snapshot", "submitted_at", "approved_at", "updated_at"))
    models.ApprovalDecision.objects.create(company=obj.company, transaction=obj, decision="SUBMITTED", actor=actor(request))
    audit(request, obj, "SUBMIT", {"status": old}, {"status": obj.status})
    return obj


@transaction.atomic
def decide(obj, request, approved):
    obj = models.InventoryTransaction.objects.select_for_update().get(pk=obj.pk)
    comment = request.data.get("comment", "").strip()
    if obj.status != "PENDING_APPROVAL":
        raise ValidationError("Giao dịch không chờ duyệt.")
    if not approved and not comment:
        raise ValidationError({"comment": "Ý kiến từ chối là bắt buộc."})
    allow_self = obj.workflow_snapshot.get("allow_self_approval", True) or getattr(request.user, "is_superuser", False)
    if obj.created_by_id == actor(request).id and not allow_self:
        raise ValidationError("Người tạo không được tự phê duyệt.")
    level = obj.approval_decisions.filter(decision="APPROVED").count() + 1
    final = approved and level >= int(obj.workflow_snapshot.get("levels", 1))
    progress = approval_progress(obj, actor(request), approved, obj.approval_decisions.all())
    if progress is not None:
        level, final = progress["level"], progress["final"]
    old = obj.status
    obj.status = "APPROVED" if final else "PENDING_APPROVAL" if approved or progress and progress["return_to_previous"] else "REJECTED"
    obj.approved_at = timezone.now() if final else None
    obj.save(update_fields=("status", "approved_at", "updated_at"))
    models.ApprovalDecision.objects.create(
        company=obj.company, transaction=obj, level=level,
        decision="APPROVED" if approved else "REJECTED", actor=actor(request), comment=comment,
    )
    audit(request, obj, "APPROVE" if approved else "REJECT", {"status": old}, {"status": obj.status}, comment)
    return obj


def _policy(company, warehouse, item):
    return models.InventoryPolicy.objects.filter(company=company, warehouse=warehouse, item=item, is_active=True).first()


def _balance(company, warehouse, line, *, destination=False):
    location = line.destination_location if destination else line.location
    if location and (location.warehouse_id != warehouse.pk or location.status != "ACTIVE" or not location.can_store):
        raise ValidationError("Vị trí kho không hợp lệ hoặc không cho phép chứa hàng.")
    query = models.StockBalance.objects.select_for_update().filter(
        company=company, warehouse=warehouse, item=line.item, location=location, lot_serial=line.lot_serial,
    )
    balance = query.first()
    if balance:
        return balance
    return models.StockBalance.objects.create(
        company=company, warehouse=warehouse, item=line.item, location=location, lot_serial=line.lot_serial,
    )


def allows_negative(company, warehouse, item, policy=None):
    """Negative stock needs the item policy or the warehouse to allow it; the company setting can forbid it everywhere."""
    policy = policy if policy is not None else _policy(company, warehouse, item)
    allowed = bool((policy and policy.allow_negative) or warehouse.allow_negative)
    from common_services.models import CoreCompanySetting
    setting = CoreCompanySetting.objects.filter(company=company).first()
    if setting and "allow_negative_inventory" in setting.configuration and not setting.configuration["allow_negative_inventory"]:
        allowed = False
    return allowed


def check_issue_stock(obj, message="Số lượng xuất vượt quá tồn kho khả dụng.", verb="xuất"):
    """UC-INV-04 EF10/BR16, UC-INV-05 EF12/BR08: lines of the same item and source warehouse together must fit the available stock."""
    requested = {}
    for line in obj.lines.select_related("item", "source_warehouse"):
        warehouse = line.source_warehouse or obj.source_warehouse
        key = (warehouse, line.item)
        requested[key] = requested.get(key, Decimal("0")) + line.base_quantity
    problems = []
    for (warehouse, item), quantity in requested.items():
        if allows_negative(obj.company, warehouse, item):
            continue
        balances = models.StockBalance.objects.filter(company=obj.company, warehouse=warehouse, item=item)
        available = sum((balance.available_quantity for balance in balances), Decimal("0"))
        if quantity > available:
            problems.append(f"Mã hàng {item.code}, kho {warehouse.code}: tồn khả dụng {available.normalize():f}, yêu cầu {verb} {quantity.normalize():f}")
    if problems:
        raise ValidationError({"lines": f"{message} " + "; ".join(problems) + "."})


def _check_tracking(policy, line):
    track_lot = policy.track_lot if policy else line.item.track_lot
    track_serial = policy.track_serial if policy else line.item.track_serial
    if (track_lot or track_serial) and not line.lot_serial_id:
        raise ValidationError(f"Hàng {line.item.code} bắt buộc có Lot/Serial.")
    if line.lot_serial_id and line.lot_serial.status != "ACTIVE":
        raise ValidationError(f"Lot/Serial {line.lot_serial.code} không khả dụng.")
    if track_serial and line.base_quantity != 1:
        raise ValidationError(f"Serial của hàng {line.item.code} phải có số lượng bằng 1.")


def _apply(obj, line, warehouse, quantity_delta, unit_cost, *, destination=False, reversal=False):
    policy = _policy(obj.company, warehouse, line.item)
    _check_tracking(policy, line)
    balance = _balance(obj.company, warehouse, line, destination=destination)
    old_quantity, old_value = balance.quantity, balance.inventory_value
    new_quantity = old_quantity + quantity_delta
    allow_negative = allows_negative(obj.company, warehouse, line.item, policy)
    if quantity_delta < 0 and balance.available_quantity + quantity_delta < 0 and not allow_negative:
        raise StockShortageError(f"Tồn khả dụng của hàng {line.item.code} tại kho {warehouse.code} không đủ.")
    if quantity_delta > 0 and line.lot_serial_id and line.lot_serial.tracking_type == "SERIAL":
        serial_quantity = models.StockBalance.objects.filter(lot_serial=line.lot_serial).aggregate(v=Sum("quantity"))["v"] or Decimal("0")
        if serial_quantity + quantity_delta > 1:
            raise ValidationError(f"Serial {line.lot_serial.code} đã tồn tại trong kho.")
    if quantity_delta > 0:
        value_delta = quantity_delta * unit_cost
        new_value = old_value + value_delta
    else:
        cost = unit_cost if unit_cost > 0 else balance.average_cost
        value_delta = quantity_delta * cost
        new_value = old_value + value_delta
    balance.quantity = new_quantity
    balance.inventory_value = new_value
    balance.average_cost = new_value / new_quantity if new_quantity > 0 else Decimal("0")
    balance.save(update_fields=("quantity", "inventory_value", "average_cost", "updated_at"))
    models.StockMovement.objects.create(
        company=obj.company, transaction=obj, line=line, warehouse=warehouse, item=line.item,
        location=line.destination_location if destination else line.location, lot_serial=line.lot_serial,
        movement_date=obj.transaction_date, quantity_delta=quantity_delta, value_delta=value_delta,
        balance_quantity=new_quantity, balance_value=new_value,
    )
    warning = None
    if policy and policy.maximum_quantity is not None and new_quantity > policy.maximum_quantity:
        warning = f"{warehouse.code}/{line.item.code}: tồn vượt mức tối đa."
    elif policy and new_quantity < policy.minimum_quantity:
        warning = f"{warehouse.code}/{line.item.code}: tồn thấp hơn mức tối thiểu."
    if warning and policy.threshold_action == "BLOCK" and not reversal:
        raise ValidationError(warning)
    return value_delta, warning


def _validate_return(obj):
    if obj.transaction_type != "RETURN":
        return
    for line in obj.lines.all():
        issued = obj.original_transaction.lines.filter(item=line.item, lot_serial=line.lot_serial).aggregate(v=Sum("base_quantity"))["v"] or Decimal("0")
        returned = models.InventoryTransactionLine.objects.filter(
            transaction__original_transaction=obj.original_transaction, transaction__transaction_type="RETURN",
            transaction__status="POSTED", item=line.item, lot_serial=line.lot_serial,
        ).aggregate(v=Sum("base_quantity"))["v"] or Decimal("0")
        if returned + line.base_quantity > issued:
            raise ValidationError(f"Số lượng nhập lại của hàng {line.item.code} vượt số đã xuất.")


@transaction.atomic
def post(obj, request):
    obj = models.InventoryTransaction.objects.select_for_update().prefetch_related("lines__item", "lines__lot_serial").get(pk=obj.pk)
    resolution = None
    if obj.source_module == "INV_COUNT_RESOLUTION":
        from .count_resolution import validate_post
        resolution = validate_post(obj)
    if obj.source_module in WAREHOUSE_VOUCHER_MODULES and (obj.status == "POSTED" or obj.inventory_applied):
        raise ValidationError(voucher_message(obj, "posted"))
    if obj.source_module in WAREHOUSE_VOUCHER_MODULES and obj.status in {"CANCELLED", "REVERSED"}:
        raise ValidationError(f"{voucher_message(obj, 'cancelled')} ({obj.get_status_display()}), không thể ghi sổ.")
    if obj.status != "APPROVED" or obj.inventory_applied:
        raise ValidationError("Giao dịch chưa duyệt hoặc đã cập nhật tồn kho.")
    if _period_is_closed(obj):
        raise ValidationError("Không được ghi nhận giao dịch vào kỳ tồn kho đã đóng.")
    other_period = None
    if obj.source_module in JOURNAL_MODULES:
        from general_ledger.models import AccountingPeriod
        other_period = AccountingPeriod.objects.filter(
            company=obj.company, start_date__lte=obj.transaction_date,
            end_date__gte=obj.transaction_date, status="OPEN",
        ).first()
        if not other_period:
            raise ValidationError(voucher_message(obj, "locked", "Ngày hạch toán thuộc kỳ kế toán đã khóa hoặc chưa mở."))
        if not obj.lines.exists():
            raise ValidationError("Vui lòng thêm ít nhất một vật tư/hàng hóa.")
        if obj.source_module in WAREHOUSE_VOUCHER_MODULES and not request.user.is_superuser:
            from iam.permissions import has_effective_permission
            warehouse_ids = set(obj.lines.values_list("source_warehouse_id", flat=True)) | set(obj.lines.values_list("destination_warehouse_id", flat=True))
            for warehouse_id in warehouse_ids:
                if warehouse_id and not has_effective_permission(actor(request), obj.company, "INV.TRANSACTION.POST", warehouse_id=warehouse_id):
                    raise ValidationError(post_denied_message(obj))
        for line in obj.lines.select_related("item", "debit_account", "credit_account"):
            if line.item.status != "ACTIVE" or not line.item.track_inventory:
                raise ValidationError(f"Vật tư/hàng hóa {line.item.code} không hợp lệ để xuất/nhập kho.")
            if obj.source_module == "INV_TRANSFER":
                # BR16/BR17: transfer accounts are optional; the same account on both sides needs no entry.
                if bool(line.debit_account_id) != bool(line.credit_account_id):
                    raise ValidationError(f"Dòng {line.line_no}: vui lòng chọn tài khoản hạch toán hợp lệ.")
            else:
                if not line.debit_account_id or not line.credit_account_id:
                    raise ValidationError(f"Dòng {line.line_no}: vui lòng chọn đầy đủ Tài khoản Nợ và Tài khoản Có.")
                if line.debit_account_id == line.credit_account_id:
                    raise ValidationError(f"Dòng {line.line_no}: Tài khoản Nợ và Có phải khác nhau.")
            for account in (account for account in (line.debit_account, line.credit_account) if account):
                if account.company_id != obj.company_id or account.status != "ACTIVE" or not account.is_postable:
                    raise ValidationError(f"Dòng {line.line_no}: tài khoản hạch toán không hợp lệ. Vui lòng kiểm tra lại.")
        if obj.source_module == "INV_SALE_ISSUE":
            from sales.models import GoodsSale
            sale = GoodsSale.objects.select_for_update().filter(pk=obj.source_reference, company=obj.company,
                status="POSTED", inventory_handling="SEPARATE_ISSUE").first()
            if not sale:
                raise ValidationError("Chứng từ bán hàng không còn hợp lệ. Vui lòng chọn chứng từ khác.")
            for line in obj.lines.select_related("sale_line", "item", "uom"):
                sale_line = line.sale_line
                if not sale_line or sale_line.sale_id != sale.pk or sale_line.item_id != line.item_id or sale_line.uom_id != line.uom_id:
                    raise ValidationError("Hàng hóa không thuộc chứng từ bán hàng.")
                used = models.InventoryTransactionLine.objects.filter(sale_line=sale_line, transaction__status="POSTED").aggregate(total=Sum("quantity"))["total"] or Decimal("0")
                pending = obj.lines.filter(sale_line=sale_line).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
                if used >= sale_line.quantity:
                    raise ValidationError(f"Dòng {line.line_no}: hàng hóa đã được xuất kho đầy đủ.")
                if pending > sale_line.quantity - used:
                    raise ValidationError(f"Dòng {line.line_no}: số lượng xuất vượt số lượng còn lại của chứng từ bán hàng.")
    kind = obj.transaction_type
    source, destination = obj.source_warehouse, obj.destination_warehouse
    if source and (source.status != "ACTIVE" and not (source.status == "INACTIVE" and kind == "ADJUSTMENT_OUT") or (kind == "TRANSFER" and not source.allow_transfer) or (kind != "TRANSFER" and not source.allow_issue)):
        raise ValidationError("Kho nguồn không hoạt động hoặc không cho phép nghiệp vụ này.")
    if destination and (destination.status != "ACTIVE" or (kind == "TRANSFER" and not destination.allow_transfer) or (kind != "TRANSFER" and not destination.allow_receipt)):
        raise ValidationError("Kho đích không hoạt động hoặc không cho phép nghiệp vụ này.")
    if kind != "TRANSFER" and any(warehouse and warehouse.warehouse_type == "TRANSIT" for warehouse in (source, destination)):
        raise ValidationError("Kho trung chuyển chỉ dùng cho giao dịch chuyển kho.")
    for warehouse in (source, destination):
        if warehouse and ((warehouse.start_date and obj.transaction_date < warehouse.start_date) or (warehouse.end_date and obj.transaction_date > warehouse.end_date)):
            raise ValidationError("Ngày giao dịch nằm ngoài thời gian sử dụng kho.")
    _validate_return(obj)
    warnings, total = [], Decimal("0")
    in_transit = obj.source_module == "INV_TRANSFER" and bool((obj.document_metadata or {}).get("in_transit"))
    transit = transit_warehouse(obj.company) if in_transit else None
    if in_transit and not transit:
        raise ValidationError("Chưa khai báo kho trung chuyển (hàng đang đi đường) để theo dõi hàng đang vận chuyển.")
    for line in obj.lines.all():
        kind = obj.transaction_type
        if obj.source_module == "INV_TRANSFER":
            value, warning = _post_transfer_line(obj, line, transit)
            total += value
        elif kind in {"RECEIPT", "RETURN", "ADJUSTMENT_IN"}:
            value, warning = _apply(obj, line, obj.destination_warehouse, line.base_quantity, line.unit_cost, destination=True)
            total += abs(value)
        elif kind in {"ISSUE", "ADJUSTMENT_OUT"}:
            issue_warehouse = line.source_warehouse if obj.source_module in {"INV_OTHER_ISSUE", "INV_SALE_ISSUE"} and line.source_warehouse_id else obj.source_warehouse
            policy = _policy(obj.company, issue_warehouse, line.item)
            # BR08/BR14: the issue cost comes from the valuation method; only specific identification keeps the entered price.
            method = policy.valuation_method if policy else line.item.valuation_method
            cost = line.unit_cost if obj.source_module not in {"INV_OTHER_ISSUE", "INV_SALE_ISSUE"} or method == "SPECIFIC" else Decimal("0")
            try:
                value, warning = _apply(obj, line, issue_warehouse, -line.base_quantity, cost)
            except StockShortageError:
                if obj.source_module not in ISSUE_MODULES:
                    raise
                if obj.source_module == "INV_OTHER_ISSUE":
                    # EF17: stock was enough when the voucher was saved but changed before posting.
                    raise ValidationError(f"{voucher_message(obj, 'changed')} (Dòng {line.line_no}: {line.item.code} tại {issue_warehouse.code})")
                raise ValidationError(f"Dòng {line.line_no} ({line.item.code} tại {issue_warehouse.code}): số lượng tồn kho không đủ để xuất. Vui lòng kiểm tra lại.")
            line.unit_cost = abs(value / line.base_quantity)
            line.line_value = abs(value)
            line.costing_status = "PENDING" if method in {"PERIODIC_AVERAGE", "FIFO"} or obj.source_module == "INV_SALE_ISSUE" and line.line_value <= 0 else "COMPLETED"
            line.save(update_fields=("unit_cost", "line_value", "costing_status"))
            total += abs(value)
        elif kind == "TRANSFER":
            out_value, warning = _apply(obj, line, obj.source_warehouse, -line.base_quantity, line.unit_cost)
            cost = abs(out_value / line.base_quantity)
            _apply(obj, line, obj.destination_warehouse, line.base_quantity, cost, destination=True)
            line.unit_cost, line.line_value = cost, abs(out_value)
            line.save(update_fields=("unit_cost", "line_value"))
            total += abs(out_value)
        elif kind in {"ADJUSTMENT", "ASSEMBLY"}:
            direction = line.movement_direction
            if direction not in {"IN", "OUT"}:
                raise ValidationError("Dòng điều chỉnh/lắp ráp phải xác định chiều IN hoặc OUT.")
            warehouse = obj.destination_warehouse if direction == "IN" else obj.source_warehouse
            value, warning = _apply(obj, line, warehouse, line.base_quantity if direction == "IN" else -line.base_quantity, line.unit_cost, destination=direction == "IN")
            if direction == "OUT":
                line.unit_cost, line.line_value = abs(value / line.base_quantity), abs(value)
                line.save(update_fields=("unit_cost", "line_value"))
            total += abs(value)
        else:
            raise ValidationError("Loại giao dịch chưa được hỗ trợ.")
        if warning:
            warnings.append(warning)
    uncosted = [line.line_no for line in obj.lines.all() if line.line_value <= 0]
    if obj.source_module in {"INV_OTHER_ISSUE", "INV_TRANSFER"} and uncosted:
        raise ValidationError("Chưa xác định được giá xuất kho. Vui lòng thực hiện tính giá xuất kho.")
    if obj.source_module == "INV_SALE_ISSUE" and uncosted:
        # BR-15/BR-17: quantities are issued now; cost is completed later by the issue-costing run.
        warnings.append(f"Chưa hoàn tất tính giá xuất kho cho dòng {', '.join(map(str, uncosted))}.")
    obj.inventory_applied = True
    journal_lines = [line for line in obj.lines.select_related("debit_account", "credit_account", "source_warehouse", "destination_warehouse")
        if line.line_value and line.debit_account_id and line.credit_account_id and line.debit_account_id != line.credit_account_id]
    journal_total = sum((line.line_value for line in journal_lines), Decimal("0"))
    if obj.source_module in JOURNAL_MODULES and journal_total:
        from general_ledger.models import JournalEntry, JournalLine
        from general_ledger.services import post as post_journal
        journal = JournalEntry.objects.create(
            company=obj.company, branch=obj.branch, period=other_period,
            number=f"{obj.number}-GL", entry_type="SUBLEDGER",
            posting_date=obj.transaction_date, document_date=obj.document_date,
            description=obj.reason or f"Phiếu kho {obj.number}", source_module="INV",
            source_event_id=f"INV.OTHER:{obj.pk}", source_entity_type="InventoryTransaction",
            source_entity_id=obj.pk, status="APPROVED", total_debit=journal_total, total_credit=journal_total,
            workflow_snapshot={"allow_creator_posting": True},
            created_by=actor(request), approved_by=actor(request), approved_at=timezone.now(),
        )
        line_no = 0
        for line in journal_lines:
            if obj.source_module == "INV_TRANSFER":
                debit_warehouse, credit_warehouse = line.destination_warehouse or obj.destination_warehouse, line.source_warehouse or obj.source_warehouse
            elif obj.source_module in ISSUE_MODULES:
                debit_warehouse = credit_warehouse = line.source_warehouse
            else:
                debit_warehouse = credit_warehouse = obj.destination_warehouse
            line_no += 1
            JournalLine.objects.create(entry=journal, line_no=line_no, account=line.debit_account,
                debit=line.line_value, currency=obj.company.accounting_currency,
                party=obj.supplier, warehouse=debit_warehouse)
            line_no += 1
            JournalLine.objects.create(entry=journal, line_no=line_no, account=line.credit_account,
                credit=line.line_value, currency=obj.company.accounting_currency,
                party=obj.supplier, warehouse=credit_warehouse)
        post_journal(journal, request)
        obj.journal_entry = journal
        obj.gl_reference = journal.number
        obj.gl_status = "POSTED"
    elif obj.source_module in JOURNAL_MODULES:
        obj.gl_status = "NOT_REQUIRED"
    if obj.source_module == "INV_TRANSFER":
        # Section 6: posting status and delivery status are kept apart.
        metadata = dict(obj.document_metadata or {})
        metadata["receipt_status"] = "IN_TRANSIT" if in_transit else "RECEIVED"
        if in_transit:
            metadata["transit_warehouse"] = str(transit.pk)
        else:
            metadata.update(received_at=timezone.now().isoformat(), received_by=str(actor(request).pk))
        obj.document_metadata = metadata
    obj.total_value = total
    obj.warnings = warnings
    obj.status = "POSTED"
    obj.posted_at = timezone.now()
    obj.save(update_fields=("inventory_applied", "total_value", "warnings", "status", "posted_at", "journal_entry", "gl_reference", "gl_status", "document_metadata", "updated_at"))
    audit(request, obj, "POST", after={"total_value": str(total), "warnings": warnings})
    if resolution:
        from .count_resolution import finish_post
        finish_post(resolution, request)
    return obj


def post_denied_message(obj):
    return voucher_message(obj, "denied", "Bạn không có quyền ghi sổ chứng từ.")


def _post_transfer_line(obj, line, transit):
    """BR12/BR13: out of the source at book value and into the destination (or the transit warehouse) at the same value."""
    source = line.source_warehouse or obj.source_warehouse
    destination = line.destination_warehouse or obj.destination_warehouse
    policy = _policy(obj.company, source, line.item)
    method = policy.valuation_method if policy else line.item.valuation_method
    cost = line.unit_cost if method == "SPECIFIC" else Decimal("0")
    try:
        out_value, warning = _apply(obj, line, source, -line.base_quantity, cost)
    except StockShortageError:
        raise ValidationError(f"{voucher_message(obj, 'changed')} (Dòng {line.line_no}: {line.item.code} tại {source.code})")
    unit_cost = abs(out_value / line.base_quantity)
    _apply(obj, line, transit or destination, line.base_quantity, unit_cost, destination=True)
    line.unit_cost, line.line_value = unit_cost, abs(out_value)
    line.save(update_fields=("unit_cost", "line_value"))
    return abs(out_value), warning


@transaction.atomic
def receive_transfer(obj, request, rows, accept_discrepancy=False, reason=""):
    """AF16/EF20/BR19-20: the receiving warehouse confirms what actually arrived from the transit warehouse."""
    obj = models.InventoryTransaction.objects.select_for_update().get(pk=obj.pk)
    metadata = dict(obj.document_metadata or {})
    if obj.source_module != "INV_TRANSFER" or obj.status != "POSTED" or metadata.get("receipt_status") != "IN_TRANSIT":
        raise ValidationError("Chứng từ không ở trạng thái Đang vận chuyển.")
    lines = list(obj.lines.select_related("item", "destination_warehouse"))
    if not _may(request, obj, "INV.TRANSACTION.RECEIVE") or not all(
            _may_at(request, obj, "INV.TRANSACTION.RECEIVE", line.destination_warehouse_id) for line in lines):
        raise ValidationError("Bạn không có quyền xác nhận nhận hàng chuyển kho.")
    from master_data.models import Warehouse
    transit = Warehouse.objects.filter(pk=metadata.get("transit_warehouse"), company=obj.company).first()
    if not transit:
        raise ValidationError("Không tìm thấy kho trung chuyển của chứng từ.")
    received = {}
    for row in rows or []:
        try:
            received[str(row.get("line"))] = Decimal(str(row.get("received_quantity")))
        except Exception:
            raise ValidationError({"lines": "Số lượng thực nhận không hợp lệ."})
    discrepancies = []
    for line in lines:
        quantity = received.get(str(line.pk))
        if quantity is None:
            raise ValidationError({"lines": f"Dòng {line.line_no}: vui lòng nhập số lượng thực nhận."})
        if quantity < 0 or quantity > line.quantity:
            raise ValidationError({"lines": f"Dòng {line.line_no}: số lượng thực nhận phải từ 0 đến số lượng đã xuất ({line.quantity.normalize():f})."})
        if quantity != line.quantity:
            discrepancies.append({"line": str(line.pk), "item_code": line.item.code, "shipped": f"{line.quantity.normalize():f}",
                "received": f"{quantity.normalize():f}", "difference": f"{(line.quantity - quantity).normalize():f}"})
    if discrepancies and not accept_discrepancy:
        detail = "; ".join(f"{row['item_code']}: đã xuất {row['shipped']}, thực nhận {row['received']}, chênh lệch {row['difference']}" for row in discrepancies)
        raise ValidationError({"discrepancies": discrepancies,
            "detail": f"Số lượng thực nhận khác số lượng đã xuất chuyển ({detail}). Vui lòng kiểm tra và xử lý chênh lệch."})
    if discrepancies and not str(reason or "").strip():
        raise ValidationError({"reason": "Vui lòng nhập lý do xử lý chênh lệch điều chuyển."})
    for line in lines:
        quantity = received[str(line.pk)] * line.conversion_factor
        if quantity:
            _apply(obj, line, transit, -quantity, line.unit_cost)
            _apply(obj, line, line.destination_warehouse or obj.destination_warehouse, quantity, line.unit_cost, destination=True)
    # The difference stays in the transit warehouse until it is handled (other issue or count adjustment).
    metadata.update(receipt_status="RECEIVED", received_at=timezone.now().isoformat(), received_by=str(actor(request).pk),
        received_lines={key: f"{value.normalize():f}" for key, value in received.items()}, discrepancies=discrepancies,
        discrepancy_reason=str(reason or "").strip())
    obj.document_metadata = metadata
    obj.save(update_fields=("document_metadata", "updated_at"))
    audit(request, obj, "RECEIVE", before={"receipt_status": "IN_TRANSIT"}, after={"receipt_status": "RECEIVED", "discrepancies": discrepancies}, reason=reason)
    return obj


@transaction.atomic
def submit_and_post(obj, request):
    """Cất / Ghi sổ of a warehouse issue: submit and post together, so a failed posting leaves an editable draft."""
    if obj.source_module not in WAREHOUSE_VOUCHER_MODULES:
        raise ValidationError("Chỉ áp dụng cho phiếu xuất kho và chứng từ chuyển kho.")
    if obj.status == "POSTED":
        raise ValidationError(voucher_message(obj, "posted"))
    if obj.status in {"CANCELLED", "REVERSED"}:
        raise ValidationError(f"{voucher_message(obj, 'cancelled')} ({obj.get_status_display()}), không thể ghi sổ.")
    if not _may(request, obj, "INV.TRANSACTION.SUBMIT"):
        raise ValidationError(post_denied_message(obj))
    if obj.status != "APPROVED":
        obj = submit(obj, request)
        if obj.status == "PENDING_APPROVAL" and obj.workflow_snapshot.get("version") == "DEFAULT" and _may(request, obj, "INV.TRANSACTION.APPROVE"):
            # No approval workflow is configured: a user who may approve and post records the voucher in one step.
            obj = decide(obj, request, True)
        if obj.status != "APPROVED":
            return obj
    return post(obj, request)


def _may(request, obj, code):
    if getattr(request.user, "is_superuser", False):
        return True
    from iam.permissions import has_effective_permission
    return has_effective_permission(actor(request), obj.company, code)


def _may_at(request, obj, code, warehouse_id):
    if getattr(request.user, "is_superuser", False) or not warehouse_id:
        return True
    from iam.permissions import has_effective_permission
    return has_effective_permission(actor(request), obj.company, code, warehouse_id=warehouse_id)


ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024
ATTACHMENT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".zip", ".rar"}
ATTACHMENT_LIMIT = 20


def _attachment_path(obj, attachment_id, name):
    import os
    return f"inventory/attachments/{obj.pk}/{attachment_id}{os.path.splitext(name)[1].lower()}"


@transaction.atomic
def add_attachment(obj, request, upload):
    """AF11/EF19: keep a file with the voucher; its metadata lives in document_metadata["attachments"]."""
    import os
    import uuid
    from django.core.files.storage import default_storage
    obj = models.InventoryTransaction.objects.select_for_update().get(pk=obj.pk)
    if obj.status not in {"DRAFT", "REJECTED"}:
        raise ValidationError("Chỉ đính kèm tệp cho chứng từ chưa ghi sổ.")
    if not upload:
        raise ValidationError({"file": "Vui lòng chọn tệp đính kèm."})
    if upload.size > ATTACHMENT_MAX_SIZE:
        raise ValidationError({"file": "Dung lượng tệp đính kèm vượt quá 5 MB."})
    if os.path.splitext(upload.name)[1].lower() not in ATTACHMENT_EXTENSIONS:
        raise ValidationError({"file": "Định dạng tệp đính kèm không được hỗ trợ."})
    metadata = dict(obj.document_metadata or {})
    attachments = list(metadata.get("attachments", []))
    if len(attachments) >= ATTACHMENT_LIMIT:
        raise ValidationError({"file": f"Chỉ được đính kèm tối đa {ATTACHMENT_LIMIT} tệp."})
    attachment_id = str(uuid.uuid4())
    default_storage.save(_attachment_path(obj, attachment_id, upload.name), upload)
    entry = {"id": attachment_id, "name": os.path.basename(upload.name)[:255], "size": upload.size,
        "content_type": getattr(upload, "content_type", "") or "", "uploaded_at": timezone.now().isoformat(),
        "uploaded_by": str(actor(request).pk)}
    metadata["attachments"] = attachments + [entry]
    obj.document_metadata = metadata
    obj.save(update_fields=("document_metadata", "updated_at"))
    audit(request, obj, "ATTACH", after={"attachment": entry["name"], "size": entry["size"]})
    return obj


def attachment_file(obj, attachment_id):
    from django.core.files.storage import default_storage
    entry = next((row for row in (obj.document_metadata or {}).get("attachments", []) if row.get("id") == attachment_id), None)
    if not entry:
        raise ValidationError("Không tìm thấy tệp đính kèm.")
    return entry, default_storage.open(_attachment_path(obj, attachment_id, entry["name"]), "rb")


@transaction.atomic
def remove_attachment(obj, request, attachment_id):
    from django.core.files.storage import default_storage
    obj = models.InventoryTransaction.objects.select_for_update().get(pk=obj.pk)
    if obj.status not in {"DRAFT", "REJECTED"}:
        raise ValidationError("Không thể xóa tệp của chứng từ đã gửi duyệt hoặc ghi sổ.")
    metadata = dict(obj.document_metadata or {})
    attachments = list(metadata.get("attachments", []))
    entry = next((row for row in attachments if row.get("id") == attachment_id), None)
    if not entry:
        raise ValidationError("Không tìm thấy tệp đính kèm.")
    metadata["attachments"] = [row for row in attachments if row.get("id") != attachment_id]
    obj.document_metadata = metadata
    obj.save(update_fields=("document_metadata", "updated_at"))
    transaction.on_commit(lambda: default_storage.delete(_attachment_path(obj, attachment_id, entry["name"])))
    audit(request, obj, "DETACH", before={"attachment": entry["name"]})
    return obj


@transaction.atomic
def reverse(obj, request):
    obj = models.InventoryTransaction.objects.select_for_update().get(pk=obj.pk)
    reason = request.data.get("reason", "").strip()
    if obj.status != "POSTED" or not reason:
        raise ValidationError("Chỉ giao dịch đã ghi nhận và có lý do mới được đảo.")
    if obj.gl_status == "POSTED":
        raise ValidationError("Phải xử lý bút toán GL trước khi đảo giao dịch kho.")
    original_movements = list(obj.movements.order_by("-created_at"))
    for movement in original_movements:
        line = movement.line
        balance = _balance(obj.company, movement.warehouse, line, destination=line.destination_location_id == movement.location_id and movement.quantity_delta > 0)
        new_quantity = balance.quantity - movement.quantity_delta
        policy = _policy(obj.company, movement.warehouse, movement.item)
        if new_quantity < 0 and not (policy and policy.allow_negative):
            raise ValidationError("Đảo giao dịch sẽ làm tồn kho âm.")
        balance.quantity = new_quantity
        balance.inventory_value -= movement.value_delta
        balance.average_cost = balance.inventory_value / new_quantity if new_quantity > 0 else Decimal("0")
        balance.save(update_fields=("quantity", "inventory_value", "average_cost", "updated_at"))
        models.StockMovement.objects.create(
            company=obj.company, transaction=obj, line=line, warehouse=movement.warehouse, item=movement.item,
            location=movement.location, lot_serial=movement.lot_serial, movement_date=timezone.localdate(),
            quantity_delta=-movement.quantity_delta, value_delta=-movement.value_delta,
            balance_quantity=balance.quantity, balance_value=balance.inventory_value,
        )
    obj.status = "REVERSED"
    obj.inventory_applied = False
    obj.reversed_at = timezone.now()
    obj.save(update_fields=("status", "inventory_applied", "reversed_at", "updated_at"))
    audit(request, obj, "REVERSE", after={"status": obj.status}, reason=reason)
    return obj


@transaction.atomic
def create_count_adjustment(count, request):
    count = models.StockCount.objects.select_for_update().prefetch_related("lines__item").get(pk=count.pk)
    if count.status not in {"DRAFT", "COUNTED"} or count.adjustment_transaction_id:
        raise ValidationError("Phiên kiểm kê đã được xử lý.")
    rows = [line for line in count.lines.all() if line.actual_quantity is not None and line.actual_quantity != line.system_quantity]
    if not rows:
        raise ValidationError("Không có chênh lệch cần điều chỉnh.")
    obj = models.InventoryTransaction.objects.create(
        company=count.company, number=f"ADJ-{count.number}", transaction_type="ADJUSTMENT",
        transaction_date=count.count_date, source_warehouse=count.warehouse, destination_warehouse=count.warehouse,
        source_module="INV_COUNT", source_reference=str(count.id), reason=f"Điều chỉnh kiểm kê {count.number}",
        status="DRAFT", created_by=actor(request),
    )
    for index, row in enumerate(rows, 1):
        delta = row.actual_quantity - row.system_quantity
        balance = models.StockBalance.objects.filter(warehouse=count.warehouse, item=row.item, location=row.location, lot_serial=row.lot_serial).first()
        models.InventoryTransactionLine.objects.create(
            transaction=obj, line_no=index, item=row.item, uom=row.item.base_uom,
            location=row.location, destination_location=row.location, lot_serial=row.lot_serial,
            movement_direction="IN" if delta > 0 else "OUT", quantity=abs(delta), base_quantity=abs(delta),
            unit_cost=balance.average_cost if balance else Decimal("0"), line_value=abs(delta) * (balance.average_cost if balance else Decimal("0")),
        )
    count.status = "COUNTED"
    count.adjustment_transaction = obj
    count.save(update_fields=("status", "adjustment_transaction"))
    audit(request, count, "COUNT", after={"adjustment_transaction": str(obj.id)})
    return obj


@transaction.atomic
def post_assembly(assembly, request):
    assembly = models.AssemblyOrder.objects.select_for_update().prefetch_related("lines__item").get(pk=assembly.pk)
    if assembly.status != "DRAFT":
        raise ValidationError("Lệnh lắp ráp/tháo dỡ đã xử lý.")
    obj = models.InventoryTransaction.objects.create(
        company=assembly.company, number=f"ASM-{assembly.number}", transaction_type="ASSEMBLY",
        transaction_date=assembly.assembly_date, source_warehouse=assembly.warehouse,
        destination_warehouse=assembly.warehouse, source_module="INV_ASSEMBLY", source_reference=str(assembly.id),
        reason=assembly.get_operation_display(), status="APPROVED", created_by=actor(request), approved_at=timezone.now(),
    )
    for row in assembly.lines.all():
        normal_direction = "OUT" if row.role == "COMPONENT" else "IN"
        direction = normal_direction if assembly.operation == "ASSEMBLE" else ("IN" if normal_direction == "OUT" else "OUT")
        models.InventoryTransactionLine.objects.create(
            transaction=obj, line_no=row.line_no, item=row.item, uom=row.item.base_uom,
            lot_serial=row.lot_serial, movement_direction=direction, quantity=row.quantity,
            base_quantity=row.quantity, unit_cost=row.unit_cost, line_value=row.quantity * row.unit_cost,
        )
    post(obj, request)
    assembly.status = "POSTED"
    assembly.posted_at = timezone.now()
    assembly.save(update_fields=("status", "posted_at"))
    audit(request, assembly, "ASSEMBLE", after={"transaction": str(obj.id)})
    return assembly


@transaction.atomic
def post_gl(obj, request):
    obj = models.InventoryTransaction.objects.select_for_update().get(pk=obj.pk)
    reference = request.data.get("gl_reference", "").strip()
    debit = Decimal(str(request.data.get("total_debit", "0")))
    credit = Decimal(str(request.data.get("total_credit", "0")))
    if obj.status != "POSTED" or obj.gl_status == "POSTED" or not reference:
        raise ValidationError("Giao dịch chưa hiệu lực, đã hạch toán hoặc thiếu mã GL.")
    if debit != credit or debit != obj.total_value:
        raise ValidationError("Bút toán phải cân bằng và bằng giá trị giao dịch kho.")
    obj.gl_status = "POSTED"
    obj.gl_reference = reference
    obj.save(update_fields=("gl_status", "gl_reference", "updated_at"))
    audit(request, obj, "POST_GL", after={"gl_reference": reference})
    return obj
