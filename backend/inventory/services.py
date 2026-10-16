from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from . import models


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
    allow_negative = bool((policy and policy.allow_negative) or warehouse.allow_negative)
    from common_services.models import CoreCompanySetting
    setting = CoreCompanySetting.objects.filter(company=obj.company).first()
    if setting and "allow_negative_inventory" in setting.configuration and not setting.configuration["allow_negative_inventory"]:
        allow_negative = False
    if quantity_delta < 0 and balance.available_quantity + quantity_delta < 0 and not allow_negative:
        raise ValidationError(f"Tồn khả dụng của hàng {line.item.code} tại kho {warehouse.code} không đủ.")
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
    if obj.status != "APPROVED" or obj.inventory_applied:
        raise ValidationError("Giao dịch chưa duyệt hoặc đã cập nhật tồn kho.")
    if _period_is_closed(obj):
        raise ValidationError("Không được ghi nhận giao dịch vào kỳ tồn kho đã đóng.")
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
    for line in obj.lines.all():
        kind = obj.transaction_type
        if kind in {"RECEIPT", "RETURN", "ADJUSTMENT_IN"}:
            value, warning = _apply(obj, line, obj.destination_warehouse, line.base_quantity, line.unit_cost, destination=True)
            total += abs(value)
        elif kind in {"ISSUE", "ADJUSTMENT_OUT"}:
            value, warning = _apply(obj, line, obj.source_warehouse, -line.base_quantity, line.unit_cost)
            line.unit_cost = abs(value / line.base_quantity)
            line.line_value = abs(value)
            line.save(update_fields=("unit_cost", "line_value"))
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
    obj.inventory_applied = True
    obj.total_value = total
    obj.warnings = warnings
    obj.status = "POSTED"
    obj.posted_at = timezone.now()
    obj.save(update_fields=("inventory_applied", "total_value", "warnings", "status", "posted_at", "updated_at"))
    audit(request, obj, "POST", after={"total_value": str(total), "warnings": warnings})
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
def run_valuation(data, request):
    balances = models.StockBalance.objects.filter(company=data["company"])
    if data.get("warehouse"):
        balances = balances.filter(warehouse=data["warehouse"])
    total_quantity = balances.aggregate(v=Sum("quantity"))["v"] or Decimal("0")
    total_value = balances.aggregate(v=Sum("inventory_value"))["v"] or Decimal("0")
    obj = models.ValuationRun.objects.create(
        **data, total_quantity=total_quantity, total_value=total_value,
        details={"balance_rows": balances.count()}, created_by=actor(request),
    )
    audit(request, obj, "VALUE", after={"total_quantity": str(total_quantity), "total_value": str(total_value)})
    return obj


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
