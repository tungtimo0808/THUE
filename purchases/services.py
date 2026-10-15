from decimal import Decimal

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from iam.permissions import has_effective_permission

from . import models


DOCUMENT_TYPE = {
    models.PurchaseRequest: "REQUEST",
    models.PurchaseOrder: "ORDER",
    models.PurchaseContract: "CONTRACT",
    models.GoodsPurchase: "GOODS",
    models.PurchaseReturn: "RETURN",
    models.PurchaseDiscount: "DISCOUNT",
    models.PurchaseCost: "COST",
}


def actor_for(request):
    return getattr(request.user, "iam_account", None)


def audit(request, instance, action, before=None, after=None, reason=""):
    actor = actor_for(request)
    if actor:
        record_audit(
            company=instance.company,
            actor_user=actor,
            module_code="PUR",
            action_code=action,
            entity=instance,
            before=before or {},
            after=after or {},
            request=request,
            reason=reason,
        )


def generate_purchase_request_number(company, branch=None, document_date=None):
    """Generate unique purchase request number via DocumentNumberingRule or sequence (BR-PUR-REQ-06)."""
    try:
        from common_services.numbering_services import generate_document_number
        from master_data.models import DocumentType
        doc_type = DocumentType.objects.filter(code__in=["PUR.REQUEST", "PR", "PURCHASE_REQUEST"]).first()
        if doc_type:
            number = generate_document_number(company, doc_type, branch=branch, document_date=document_date)
            if number and not models.PurchaseRequest.objects.filter(company=company, number=number).exists():
                return number
    except Exception:
        pass

    ref_date = document_date or timezone.localdate()
    prefix = f"PR{ref_date.strftime('%Y%m%d')}"
    last_doc = models.PurchaseRequest.objects.filter(
        company=company, number__startswith=prefix
    ).order_by("-number").first()
    if last_doc and len(last_doc.number) >= len(prefix) + 4:
        try:
            seq = int(last_doc.number[len(prefix):]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


def generate_purchase_order_number(company, branch=None, document_date=None):
    """Generate unique purchase order number via DocumentNumberingRule or sequence (BR-PUR-PO-05)."""
    try:
        from common_services.numbering_services import generate_document_number
        from master_data.models import DocumentType
        doc_type = DocumentType.objects.filter(code__in=["PUR.ORDER", "PO", "PURCHASE_ORDER"]).first()
        if doc_type:
            number = generate_document_number(company, doc_type, branch=branch, document_date=document_date)
            if number and not models.PurchaseOrder.objects.filter(company=company, number=number).exists():
                return number
    except Exception:
        pass

    ref_date = document_date or timezone.localdate()
    prefix = f"PO{ref_date.strftime('%Y%m%d')}"
    last_doc = models.PurchaseOrder.objects.filter(
        company=company, number__startswith=prefix
    ).order_by("-number").first()
    if last_doc and len(last_doc.number) >= len(prefix) + 4:
        try:
            seq = int(last_doc.number[len(prefix):]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


def sync_purchase_request_status(purchase_request):
    """Update status of PurchaseRequest based on ordered quantities of its lines (BR-PUR-REQ-31, 32, 33)."""
    if purchase_request.status in (
        models.DocumentStatus.DRAFT,
        models.DocumentStatus.PENDING_APPROVAL,
        models.DocumentStatus.REVISION_REQUIRED,
        models.DocumentStatus.REJECTED,
        models.DocumentStatus.CANCELLED,
    ):
        return
    lines = list(purchase_request.lines.all())
    if not lines:
        return
    total_qty = sum(line.quantity for line in lines)
    ordered_qty = sum(line.ordered_quantity for line in lines)
    if ordered_qty <= 0:
        new_status = models.DocumentStatus.APPROVED
    elif ordered_qty < total_qty:
        new_status = models.DocumentStatus.PARTIALLY_ORDERED
    else:
        new_status = models.DocumentStatus.ORDERED
    if purchase_request.status != new_status:
        purchase_request.status = new_status
        purchase_request.save(update_fields=("status", "updated_at"))


@transaction.atomic
def submit_document(instance, request):
    instance = type(instance).objects.select_for_update().get(pk=instance.pk)
    # BR-PUR-REQ-17, BR-PUR-REQ-28: Allowed statuses
    if instance.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REVISION_REQUIRED, models.DocumentStatus.REJECTED}:
        raise ValidationError("Chỉ chứng từ DRAFT, REVISION_REQUIRED hoặc REJECTED được gửi duyệt.")
    # EF-03 / EF-04: At least one line
    if not instance.lines.exists():
        if isinstance(instance, models.PurchaseOrder):
            raise ValidationError("Đơn mua hàng phải có ít nhất một dòng hàng.")
        raise ValidationError("Yêu cầu mua hàng phải có ít nhất một dòng hàng.")

    # EF-07 / EF-09: Check Data Scope and Permission
    actor = actor_for(request)
    if actor and not request.user.is_superuser:
        perm_code = f"PUR.{DOCUMENT_TYPE[type(instance)]}.SUBMIT"
        if not has_effective_permission(actor, instance.company, perm_code, branch_id=instance.branch_id, department_id=getattr(instance, "department_id", None)):
            raise PermissionDenied("Quyền truy cập của bạn đã thay đổi. Vui lòng tải lại trang.")

    # EF-06 / EF-08: Active catalog status check
    if getattr(instance, "branch", None) and instance.branch.status != "ACTIVE":
        raise ValidationError({"branch": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})
    if getattr(instance, "department", None) and instance.department.status != "ACTIVE":
        raise ValidationError({"department": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})
    if getattr(instance, "supplier", None) and instance.supplier.status != "ACTIVE":
        raise ValidationError({"supplier": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})
    if getattr(instance, "receiving_warehouse", None) and instance.receiving_warehouse.status != "ACTIVE":
        raise ValidationError({"receiving_warehouse": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})

    for line in instance.lines.select_related("item", "uom"):
        if line.item.status != "ACTIVE":
            raise ValidationError({"item": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})
        if line.uom.status != "ACTIVE":
            raise ValidationError({"uom": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})
        if getattr(line, "warehouse", None) and line.warehouse.status != "ACTIVE":
            raise ValidationError({"warehouse": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})

    if isinstance(instance, models.PurchaseOrder):
        if instance.delivery_date and instance.document_date and instance.delivery_date < instance.document_date:
            raise ValidationError({"delivery_date": "Ngày giao dự kiến không được trước Ngày đặt hàng."})
        for line in instance.lines.prefetch_related("request_links__request_line__request"):
            for link in line.request_links.all():
                source = link.request_line
                if source.request.status not in (models.DocumentStatus.APPROVED, models.DocumentStatus.PARTIALLY_ORDERED, models.DocumentStatus.ORDERED):
                    raise ValidationError({"lines": "Yêu cầu mua hàng không còn số lượng có thể đặt mua."})
                if source.ordered_quantity > source.quantity:
                    raise ValidationError({"lines": "Số lượng đặt vượt quá số lượng còn lại của yêu cầu mua hàng."})

    before = instance.status

    requested_workflow = request.data.get("workflow_snapshot") or {}
    try:
        approval_levels = max(1, min(int(requested_workflow.get("levels", 1)), 20))
    except (TypeError, ValueError):
        raise ValidationError({"workflow_snapshot": "Số cấp phê duyệt không hợp lệ."})

    req_approval_required = requested_workflow.get("approval_required")
    if req_approval_required is not None:
        instance.approval_required = bool(req_approval_required)

    instance.workflow_snapshot = {
        "version": str(requested_workflow.get("version", "DEFAULT"))[:80],
        "approval_required": instance.approval_required,
        "levels": approval_levels,
        "allow_self_approval": bool(requested_workflow.get("allow_self_approval", False)),
    }

    # EF-08, BR-PUR-REQ-24, BR-PUR-REQ-25: Determine workflow
    configured = None
    try:
        configured = configured_snapshot(instance, f"PUR.{DOCUMENT_TYPE[type(instance)]}")
    except ValidationError:
        raise ValidationError("Không xác định được người phê duyệt. Vui lòng liên hệ Admin doanh nghiệp.")

    if configured is not None:
        instance.workflow_snapshot = configured
        instance.approval_required = configured.get("approval_required", False)

    instance.submitted_at = timezone.now()
    instance.status = models.DocumentStatus.PENDING_APPROVAL if instance.approval_required else models.DocumentStatus.APPROVED
    if instance.status == models.DocumentStatus.APPROVED:
        instance.approved_at = timezone.now()
    instance.save(update_fields=("status", "approval_required", "workflow_snapshot", "submitted_at", "approved_at", "updated_at"))

    models.ApprovalDecision.objects.create(
        company=instance.company,
        document_type=DOCUMENT_TYPE[type(instance)],
        document_id=instance.pk,
        workflow_version=str(instance.workflow_snapshot.get("version", "")),
        decision=models.ApprovalDecision.Decision.SUBMITTED,
        actor=actor_for(request),
        comment=request.data.get("comment", ""),
    )
    if instance.status == models.DocumentStatus.APPROVED:
        models.ApprovalDecision.objects.create(
            company=instance.company,
            document_type=DOCUMENT_TYPE[type(instance)],
            document_id=instance.pk,
            workflow_version=str(instance.workflow_snapshot.get("version", "")),
            level=1,
            decision=models.ApprovalDecision.Decision.APPROVED,
            actor=actor_for(request),
            comment="Tự động phê duyệt (không áp dụng Workflow)",
        )
    audit(request, instance, "SUBMIT", {"status": before}, {"status": instance.status})
    return instance


@transaction.atomic
def request_revision(instance, request):
    """Approver requests revisions on a pending request (AF-03, BR-PUR-REQ-28)."""
    instance = type(instance).objects.select_for_update().get(pk=instance.pk)
    if instance.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ yêu cầu đang chờ phê duyệt mới có thể yêu cầu chỉnh sửa.")
    comment = request.data.get("comment", "").strip() or request.data.get("reason", "").strip()
    if not comment:
        raise ValidationError({"comment": "Lý do yêu cầu chỉnh sửa là bắt buộc."})
    if len(comment) > 1000:
        raise ValidationError({"comment": "Lý do yêu cầu chỉnh sửa tối đa 1000 ký tự."})

    before = instance.status
    instance.status = models.DocumentStatus.REVISION_REQUIRED
    instance.save(update_fields=("status", "updated_at"))

    completed_levels = models.ApprovalDecision.objects.filter(
        document_type=DOCUMENT_TYPE[type(instance)],
        document_id=instance.pk,
        decision=models.ApprovalDecision.Decision.APPROVED,
    ).count()
    current_level = completed_levels + 1

    models.ApprovalDecision.objects.create(
        company=instance.company,
        document_type=DOCUMENT_TYPE[type(instance)],
        document_id=instance.pk,
        workflow_version=str(instance.workflow_snapshot.get("version", "")),
        level=current_level,
        decision=models.ApprovalDecision.Decision.REVISION_REQUIRED,
        actor=actor_for(request),
        comment=comment,
    )
    audit(request, instance, "REQUEST_REVISION", {"status": before}, {"status": instance.status}, comment)
    return instance


@transaction.atomic
def decide_document(instance, request, approved):
    instance = type(instance).objects.select_for_update().get(pk=instance.pk)
    if instance.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ không ở trạng thái chờ phê duyệt.")
    comment = request.data.get("comment", "").strip()
    if not approved and not comment:
        raise ValidationError({"comment": "Lý do từ chối là bắt buộc."})
    if not approved and len(comment) > 1000:
        raise ValidationError({"comment": "Lý do từ chối tối đa 1000 ký tự."})
    if instance.created_by_id == actor_for(request).id and not instance.workflow_snapshot.get("allow_self_approval", False):
        raise ValidationError("Không được tự phê duyệt chứng từ do chính mình lập.")
    before = instance.status
    completed_levels = models.ApprovalDecision.objects.filter(
        document_type=DOCUMENT_TYPE[type(instance)],
        document_id=instance.pk,
        decision=models.ApprovalDecision.Decision.APPROVED,
    ).count()
    current_level = completed_levels + 1
    total_levels = int(instance.workflow_snapshot.get("levels", 1))
    final_approval = approved and current_level >= total_levels
    progress = approval_progress(instance, actor_for(request), approved, models.ApprovalDecision.objects.filter(
        document_type=DOCUMENT_TYPE[type(instance)], document_id=instance.pk))
    if progress is not None:
        current_level = progress["level"]
        final_approval = progress["final"]
    instance.status = (
        models.DocumentStatus.APPROVED if final_approval
        else models.DocumentStatus.PENDING_APPROVAL if approved or progress and progress["return_to_previous"]
        else models.DocumentStatus.REJECTED
    )
    instance.approved_at = timezone.now() if final_approval else None
    instance.save(update_fields=("status", "approved_at", "updated_at"))
    models.ApprovalDecision.objects.create(
        company=instance.company,
        document_type=DOCUMENT_TYPE[type(instance)],
        document_id=instance.pk,
        workflow_version=str(instance.workflow_snapshot.get("version", "")),
        level=current_level,
        decision=models.ApprovalDecision.Decision.APPROVED if approved else models.ApprovalDecision.Decision.REJECTED,
        actor=actor_for(request),
        comment=comment,
    )
    audit(request, instance, "APPROVE" if approved else "REJECT", {"status": before}, {"status": instance.status}, comment)
    return instance


@transaction.atomic
def cancel_request(instance, request):
    instance = models.PurchaseRequest.objects.select_for_update().get(pk=instance.pk)
    reason = request.data.get("reason", "").strip()
    if not reason:
        raise ValidationError({"reason": "Lý do hủy là bắt buộc."})
    if len(reason) > 500:
        raise ValidationError({"reason": "Lý do hủy tối đa 500 ký tự."})
    if instance.lines.filter(ordered_quantity__gt=0).exists():
        raise ValidationError("Yêu cầu đã dùng để lập đơn mua, không thể hủy.")
    if instance.status in {models.DocumentStatus.CANCELLED, models.DocumentStatus.COMPLETED, models.DocumentStatus.PARTIALLY_ORDERED, models.DocumentStatus.ORDERED}:
        raise ValidationError("Trạng thái yêu cầu không cho phép hủy.")
    before = instance.status
    instance.status = models.DocumentStatus.CANCELLED
    instance.cancelled_by = actor_for(request)
    instance.cancelled_at = timezone.now()
    instance.cancellation_reason = reason
    instance.save(update_fields=("status", "cancelled_by", "cancelled_at", "cancellation_reason", "updated_at"))
    audit(request, instance, "CANCEL", {"status": before}, {"status": instance.status}, reason)
    return instance


@transaction.atomic
def confirm_receipt(receipt, request):
    receipt = models.PurchaseReceipt.objects.select_for_update().select_related("order").get(pk=receipt.pk)
    if receipt.status != models.ReceiptStatus.DRAFT:
        raise ValidationError("Chỉ lần nhận DRAFT được xác nhận.")
    order = models.PurchaseOrder.objects.select_for_update().get(pk=receipt.order_id)
    if order.status not in {models.DocumentStatus.APPROVED, models.DocumentStatus.PARTIALLY_RECEIVED, models.DocumentStatus.SENT, models.DocumentStatus.IN_PROGRESS}:
        raise ValidationError("Trạng thái đơn mua không cho phép nhận hàng/dịch vụ.")
    locked_lines = {line.pk: line for line in models.PurchaseOrderLine.objects.select_for_update().filter(order=order)}
    updates = []
    for received in receipt.lines.select_related("order_line__item"):
        line = locked_lines[received.order_line_id]
        if line.item.item_type != "SERVICE" and not (receipt.warehouse_id or line.warehouse_id or order.receiving_warehouse_id):
            raise ValidationError("Hàng quản lý kho phải xác định kho nhận.")
        equivalent = received.quantity
        if equivalent is None and received.completion_percent is not None:
            equivalent = line.quantity * received.completion_percent / Decimal("100")
        if equivalent is None and received.accepted_value is not None:
            equivalent = received.accepted_value / line.unit_price if line.unit_price else Decimal("0")
        if not equivalent or equivalent <= 0:
            raise ValidationError("Giá trị tiếp nhận phải lớn hơn 0.")
        if equivalent > line.remaining_quantity:
            raise ValidationError({"lines": f"Số lượng nhận của dòng {line.line_no} vượt nghĩa vụ còn lại."})
        line.received_quantity += equivalent
        updates.append(line)
    models.PurchaseOrderLine.objects.bulk_update(updates, ("received_quantity",))
    remaining = models.PurchaseOrderLine.objects.filter(order=order).filter(quantity__gt=F("received_quantity") + F("cancelled_quantity")).exists()
    order.receiving_status = models.ReceivingProgressStatus.PARTIALLY_RECEIVED if remaining else models.ReceivingProgressStatus.FULLY_RECEIVED
    order.status = models.DocumentStatus.PARTIALLY_RECEIVED if remaining else models.DocumentStatus.FULLY_RECEIVED
    order.save(update_fields=("status", "receiving_status", "updated_at"))
    receipt.status = models.ReceiptStatus.CONFIRMED
    receipt.confirmed_by = actor_for(request)
    receipt.confirmed_at = timezone.now()
    receipt.save(update_fields=("status", "confirmed_by", "confirmed_at", "updated_at"))
    audit(request, receipt, "CONFIRM", {"status": models.ReceiptStatus.DRAFT}, {"status": receipt.status})
    return receipt


@transaction.atomic
def mark_order_sent(order, request):
    order = models.PurchaseOrder.objects.select_for_update().get(pk=order.pk)
    if order.status != models.DocumentStatus.APPROVED:
        raise ValidationError("Chỉ đơn ở trạng thái APPROVED mới được gửi cho nhà cung cấp.")
    before = order.status
    order.status = models.DocumentStatus.SENT
    order.sent_at = timezone.now()
    order.save(update_fields=("status", "sent_at", "updated_at"))
    audit(request, order, "SEND", {"status": before}, {"status": order.status})
    return order


@transaction.atomic
def finish_order(order, request, *, cancel=False):
    order = models.PurchaseOrder.objects.select_for_update().get(pk=order.pk)
    reason = request.data.get("reason", "").strip()
    if not reason:
        raise ValidationError({"reason": "Lý do là bắt buộc."})
    if cancel and len(reason) > 500:
        raise ValidationError({"reason": "Lý do hủy tối đa 500 ký tự."})
    if order.status in {models.DocumentStatus.COMPLETED, models.DocumentStatus.CANCELLED}:
        raise ValidationError("Đơn mua đã kết thúc.")
    if cancel:
        has_execution = (
            order.status == models.DocumentStatus.IN_PROGRESS
            or order.receipts.filter(status=models.ReceiptStatus.CONFIRMED).exists()
            or order.lines.filter(Q(received_quantity__gt=0) | Q(invoiced_quantity__gt=0)).exists()
        )
        if has_execution:
            raise ValidationError("Đơn mua hàng đã phát sinh dữ liệu liên quan và không thể hủy.")

    before = order.status
    order.status = models.DocumentStatus.CANCELLED if cancel else models.DocumentStatus.COMPLETED
    order.closed_at = timezone.now()
    order.closed_by = actor_for(request)
    order.close_reason = reason
    if cancel:
        order.cancelled_at = timezone.now()
        order.cancelled_by = actor_for(request)
        order.cancellation_reason = reason
        order.save(update_fields=("status", "closed_at", "closed_by", "close_reason", "cancelled_at", "cancelled_by", "cancellation_reason", "updated_at"))
        affected_requests = set()
        for link in models.PurchaseOrderRequestLine.objects.filter(order_line__order=order).select_related("request_line__request"):
            models.PurchaseRequestLine.objects.filter(pk=link.request_line_id).update(
                ordered_quantity=F("ordered_quantity") - link.quantity
            )
            affected_requests.add(link.request_line.request_id)
        for req_id in affected_requests:
            req = models.PurchaseRequest.objects.get(pk=req_id)
            sync_purchase_request_status(req)
    else:
        order.save(update_fields=("status", "closed_at", "closed_by", "close_reason", "updated_at"))
        for line in order.lines.all():
            remaining = line.remaining_quantity
            if remaining > 0:
                line.cancelled_quantity = F("cancelled_quantity") + remaining
                line.save(update_fields=("cancelled_quantity",))
    audit(request, order, "CANCEL" if cancel else "CLOSE", {"status": before}, {"status": order.status}, reason)
    return order


def order_tracking(order):
    lines = []
    for line in order.lines.select_related("item", "uom"):
        lines.append({
            "id": line.id,
            "line_no": line.line_no,
            "item": {"id": line.item_id, "code": line.item.code, "name": line.item.name},
            "uom": {"id": line.uom_id, "code": line.uom.code},
            "ordered_quantity": line.quantity,
            "received_quantity": line.received_quantity,
            "invoiced_quantity": line.invoiced_quantity,
            "cancelled_quantity": line.cancelled_quantity,
            "remaining_quantity": line.remaining_quantity,
            "unit_price": line.unit_price,
            "pre_discount_amount": line.pre_discount_amount,
            "discount_amount": line.discount_amount,
            "pre_tax_amount": line.pre_tax_amount,
            "tax_amount": line.tax_amount,
            "total_amount": line.line_total,
        })
    received_value = sum((line.received_quantity * line.unit_price for line in order.lines.all()), Decimal("0"))
    return {
        "order_id": order.id,
        "number": order.number,
        "status": order.status,
        "receiving_status": getattr(order, "receiving_status", "NOT_RECEIVED"),
        "invoicing_status": getattr(order, "invoicing_status", "NOT_INVOICED"),
        "ordered_value": order.total_amount,
        "received_value": received_value,
        "invoiced_value": order.invoiced_amount,
        "paid_value": order.paid_amount,
        "remaining_value": max(order.total_amount - received_value, Decimal("0")),
        "lines": lines,
        "links": {
            "requests": list(models.PurchaseRequest.objects.filter(lines__order_links__order_line__order=order).values_list("id", flat=True).distinct()),
            "purchase_request": str(order.purchase_request_id) if order.purchase_request_id else None,
            "contract": order.contract_id,
            "receipts": list(order.receipts.filter(status=models.ReceiptStatus.CONFIRMED).values_list("id", flat=True)),
        },
    }
