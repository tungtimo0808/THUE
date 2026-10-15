from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from . import models


def actor_for(request):
    return request.user.iam_account


def audit(request, obj, action, before=None, after=None, reason=""):
    record_audit(company=obj.company, actor_user=actor_for(request), module_code="SAL", action_code=action, entity=obj, before=before or {}, after=after or {}, request=request, reason=reason)


def document_type(obj):
    if isinstance(obj, models.SalesQuotation): return "QUOTATION"
    if isinstance(obj, models.SalesOrder): return "ORDER"
    return "CONTRACT"


@transaction.atomic
def submit(obj, request):
    obj = type(obj).objects.select_for_update().get(pk=obj.pk)
    if obj.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}:
        raise ValidationError("Trạng thái không cho phép gửi duyệt.")
    if isinstance(obj, models.SalesQuotation) and obj.valid_until < timezone.localdate():
        obj.status = models.DocumentStatus.EXPIRED; obj.save(update_fields=("status", "updated_at"))
        raise ValidationError("Báo giá đã hết hiệu lực.")
    raw = request.data.get("workflow_snapshot") or {}
    try: levels = max(1, min(int(raw.get("levels", 1)), 20))
    except (TypeError, ValueError): raise ValidationError({"workflow_snapshot": "Số cấp phê duyệt phải từ 1 đến 20."})
    obj.workflow_snapshot = {"version": str(raw.get("version", "DEFAULT"))[:80], "levels": levels, "allow_self_approval": bool(raw.get("allow_self_approval", False))}
    if isinstance(obj, models.SalesOrder):
        obj.inventory_check = request.data.get("inventory_check", obj.inventory_check)
        from accounts_receivable.services import evaluate_credit
        obj.credit_check = evaluate_credit(obj.company,obj.customer,obj.total_amount,obj.branch,obj.currency,exclude_order=obj)
        if obj.inventory_check.get("blocked") or not obj.credit_check.get("allowed",True):
            raise ValidationError("Kiểm tra tồn kho hoặc hạn mức công nợ đang chặn đơn bán.")
        if obj.credit_check.get("approval_required"):
            obj.approval_required = True
    configured = configured_snapshot(obj, f"SAL.{document_type(obj)}")
    if configured is not None:
        obj.workflow_snapshot = configured
        obj.approval_required = configured["approval_required"]
    before = obj.status
    obj.status = models.DocumentStatus.PENDING_APPROVAL if obj.approval_required else models.DocumentStatus.APPROVED
    obj.submitted_at = timezone.now()
    if obj.status == models.DocumentStatus.APPROVED: obj.approved_at = timezone.now()
    obj.save()
    models.ApprovalDecision.objects.create(company=obj.company, document_type=document_type(obj), document_id=obj.pk, decision="SUBMITTED", actor=actor_for(request), comment=request.data.get("comment", ""))
    audit(request, obj, "SUBMIT", {"status": before}, {"status": obj.status})
    return obj


@transaction.atomic
def decide(obj, request, approved):
    obj = type(obj).objects.select_for_update().get(pk=obj.pk)
    if obj.status != models.DocumentStatus.PENDING_APPROVAL: raise ValidationError("Chứng từ không chờ phê duyệt.")
    comment = request.data.get("comment", "").strip()
    if not approved and not comment: raise ValidationError({"comment": "Ý kiến từ chối là bắt buộc."})
    if obj.created_by_id == actor_for(request).id and not obj.workflow_snapshot.get("allow_self_approval", False): raise ValidationError("Không được tự phê duyệt chứng từ.")
    dtype = document_type(obj)
    level = models.ApprovalDecision.objects.filter(document_type=dtype, document_id=obj.pk, decision="APPROVED").count() + 1
    final = approved and level >= int(obj.workflow_snapshot.get("levels", 1))
    progress = approval_progress(obj, actor_for(request), approved,
        models.ApprovalDecision.objects.filter(document_type=dtype, document_id=obj.pk))
    if progress is not None:
        level, final = progress["level"], progress["final"]
    before = obj.status
    obj.status = models.DocumentStatus.APPROVED if final else models.DocumentStatus.PENDING_APPROVAL if approved or progress and progress["return_to_previous"] else models.DocumentStatus.REJECTED
    obj.approved_at = timezone.now() if final else None
    obj.save(update_fields=("status", "approved_at", "updated_at"))
    models.ApprovalDecision.objects.create(company=obj.company, document_type=dtype, document_id=obj.pk, level=level, decision="APPROVED" if approved else "REJECTED", actor=actor_for(request), comment=comment)
    audit(request, obj, "APPROVE" if approved else "REJECT", {"status": before}, {"status": obj.status}, comment)
    return obj


@transaction.atomic
def send_quotation(obj, request):
    obj = models.SalesQuotation.objects.select_for_update().prefetch_related("lines").get(pk=obj.pk)
    if obj.valid_until < timezone.localdate():
        obj.status = models.DocumentStatus.EXPIRED; obj.save(update_fields=("status", "updated_at")); raise ValidationError("Báo giá đã hết hiệu lực.")
    if obj.status not in {models.DocumentStatus.APPROVED, models.DocumentStatus.SENT}: raise ValidationError("Báo giá phải được phê duyệt trước khi gửi.")
    versions = list(obj.sent_versions)
    versions.append({"version": len(versions) + 1, "sent_at": timezone.now().isoformat(), "actor": str(actor_for(request).id), "method": request.data.get("method", "EMAIL"), "recipient": request.data.get("recipient", ""), "total_amount": str(obj.total_amount)})
    before = obj.status; obj.sent_versions = versions; obj.status = models.DocumentStatus.SENT; obj.save(update_fields=("sent_versions", "status", "updated_at"))
    audit(request, obj, "SEND", {"status": before}, {"status": obj.status, "version": len(versions)}); return obj


@transaction.atomic
def accept_quotation(obj, request, accepted):
    obj = models.SalesQuotation.objects.select_for_update().get(pk=obj.pk)
    if obj.status not in {models.DocumentStatus.SENT, models.DocumentStatus.APPROVED}: raise ValidationError("Báo giá chưa ở trạng thái có thể phản hồi.")
    reason = request.data.get("reason", "").strip()
    if not accepted and not reason: raise ValidationError({"reason": "Lý do từ chối là bắt buộc."})
    before=obj.status; obj.status=models.DocumentStatus.ACCEPTED if accepted else models.DocumentStatus.CANCELLED; obj.cancellation_reason=reason; obj.save(update_fields=("status","cancellation_reason","updated_at"))
    audit(request,obj,"ACCEPT" if accepted else "CANCEL",{"status":before},{"status":obj.status},reason); return obj


@transaction.atomic
def extend_contract(obj, request):
    obj=models.SalesContract.objects.select_for_update().get(pk=obj.pk)
    new_end=request.data.get("end_date")
    if obj.status in {models.DocumentStatus.CANCELLED,models.DocumentStatus.TERMINATED} or not new_end: raise ValidationError("Hợp đồng không thể gia hạn hoặc thiếu ngày kết thúc mới.")
    from datetime import date
    try: parsed=date.fromisoformat(new_end)
    except (TypeError,ValueError): raise ValidationError({"end_date":"Ngày kết thúc không hợp lệ."})
    if parsed <= obj.end_date: raise ValidationError({"end_date":"Ngày gia hạn phải sau ngày kết thúc hiện tại."})
    before=str(obj.end_date); obj.end_date=parsed; obj.save(update_fields=("end_date","updated_at")); audit(request,obj,"EXTEND",{"end_date":before},{"end_date":str(parsed)},request.data.get("reason","")); return obj


@transaction.atomic
def terminate_contract(obj, request):
    obj=models.SalesContract.objects.select_for_update().get(pk=obj.pk); reason=request.data.get("reason","").strip()
    if not reason or obj.status in {models.DocumentStatus.TERMINATED,models.DocumentStatus.CANCELLED}: raise ValidationError("Lý do là bắt buộc và hợp đồng phải còn hiệu lực.")
    before=obj.status; obj.status=models.DocumentStatus.TERMINATED; obj.termination_reason=reason; obj.terminated_at=timezone.now(); obj.save(update_fields=("status","termination_reason","terminated_at","updated_at")); audit(request,obj,"TERMINATE",{"status":before},{"status":obj.status},reason); return obj


@transaction.atomic
def confirm_delivery(delivery, request):
    delivery=models.SalesDelivery.objects.select_for_update().prefetch_related("lines__order_line__item").get(pk=delivery.pk)
    if delivery.status != models.DeliveryStatus.DRAFT: raise ValidationError("Chỉ lần giao DRAFT được xác nhận.")
    order=models.SalesOrder.objects.select_for_update().get(pk=delivery.order_id)
    if order.status not in {models.DocumentStatus.APPROVED,models.DocumentStatus.PARTIALLY_DELIVERED}: raise ValidationError("Đơn bán không ở trạng thái có thể giao.")
    if delivery.delivery_type == "GOODS" and not delivery.warehouse_id: raise ValidationError("Giao hàng hóa phải có kho xuất.")
    for row in delivery.lines.all():
        line=models.SalesOrderLine.objects.select_for_update().get(pk=row.order_line_id)
        if row.quantity > line.remaining_quantity: raise ValidationError({"lines":f"Số lượng giao dòng {line.line_no} vượt nghĩa vụ còn lại."})
        if delivery.delivery_type == "SERVICE" and line.item.track_inventory: raise ValidationError({"lines":f"Dòng {line.line_no} là hàng hóa, không thể xác nhận như dịch vụ."})
        line.delivered_quantity += row.quantity; line.save(update_fields=("delivered_quantity",))
    remaining=models.SalesOrderLine.objects.filter(order=order).filter(quantity__gt=F("delivered_quantity")+F("cancelled_quantity")).exists()
    order.status=models.DocumentStatus.PARTIALLY_DELIVERED if remaining else models.DocumentStatus.FULLY_DELIVERED; order.save(update_fields=("status","updated_at"))
    delivery.status=models.DeliveryStatus.CONFIRMED; delivery.confirmed_by=actor_for(request); delivery.confirmed_at=timezone.now(); delivery.save(update_fields=("status","confirmed_by","confirmed_at","updated_at"))
    audit(request,delivery,"CONFIRM",{"status":models.DeliveryStatus.DRAFT},{"status":delivery.status}); return delivery


@transaction.atomic
def submit_invoice_request(obj, request):
    obj=models.InvoiceRequest.objects.select_for_update().prefetch_related("lines").get(pk=obj.pk)
    if obj.status != models.InvoiceRequestStatus.DRAFT: raise ValidationError("Chỉ đề nghị DRAFT được gửi xử lý.")
    for row in obj.lines.all():
        line=models.SalesOrderLine.objects.select_for_update().get(pk=row.order_line_id)
        if row.quantity > line.delivered_quantity-line.invoiced_quantity: raise ValidationError("Số lượng lập hóa đơn vượt số đã giao còn lại.")
        line.invoiced_quantity += row.quantity; line.save(update_fields=("invoiced_quantity",))
    order=models.SalesOrder.objects.select_for_update().get(pk=obj.order_id); order.invoiced_amount += obj.total_amount; order.save(update_fields=("invoiced_amount","updated_at"))
    obj.status=models.InvoiceRequestStatus.SUBMITTED; obj.external_reference=request.data.get("external_reference",""); obj.save(update_fields=("status","external_reference","updated_at")); audit(request,obj,"SUBMIT",{"status":models.InvoiceRequestStatus.DRAFT},{"status":obj.status}); return obj


@transaction.atomic
def cancel_invoice_request(obj, request):
    obj=models.InvoiceRequest.objects.select_for_update().prefetch_related("lines").get(pk=obj.pk); reason=request.data.get("reason","").strip()
    if not reason or obj.status not in {models.InvoiceRequestStatus.DRAFT,models.InvoiceRequestStatus.SUBMITTED}: raise ValidationError("Đề nghị không thể hủy hoặc thiếu lý do.")
    if obj.status == models.InvoiceRequestStatus.SUBMITTED:
        for row in obj.lines.all():
            line=models.SalesOrderLine.objects.select_for_update().get(pk=row.order_line_id); line.invoiced_quantity -= row.quantity; line.save(update_fields=("invoiced_quantity",))
        order=models.SalesOrder.objects.select_for_update().get(pk=obj.order_id); order.invoiced_amount=max(order.invoiced_amount-obj.total_amount,Decimal("0")); order.save(update_fields=("invoiced_amount","updated_at"))
    before=obj.status; obj.status=models.InvoiceRequestStatus.CANCELLED; obj.cancellation_reason=reason; obj.save(update_fields=("status","cancellation_reason","updated_at")); audit(request,obj,"CANCEL",{"status":before},{"status":obj.status},reason); return obj


@transaction.atomic
def finish_order(order, request, cancel=False):
    reason = request.data.get("reason", "").strip()
    from . import order_services
    if cancel:
        return order_services.cancel_order(request, order, reason=reason)
    return order_services.close_order(request, order, reason=reason)


def order_tracking(order):
    lines=[]
    for line in order.lines.select_related("item","uom"):
        lines.append({
            "id": line.id,
            "line_no": line.line_no,
            "item": {"id": line.item_id, "code": line.item.code, "name": line.item.name},
            "ordered_quantity": line.quantity,
            "delivered_quantity": line.delivered_quantity,
            "invoiced_quantity": line.invoiced_quantity,
            "cancelled_quantity": line.cancelled_quantity,
            "closed_quantity": line.closed_quantity,
            "remaining_quantity": line.remaining_quantity,
        })
    delivered_value = sum((line.delivered_quantity * line.unit_price for line in order.lines.all()), Decimal("0"))
    return {
        "order_id": order.id,
        "number": order.number,
        "status": order.status,
        "ordered_value": order.total_amount,
        "delivered_value": delivered_value,
        "invoiced_value": order.invoiced_amount,
        "collected_value": order.collected_amount,
        "remaining_delivery_value": max(order.total_amount - delivered_value, Decimal("0")),
        "lines": lines,
        "links": {
            "quotations": list(models.SalesQuotation.objects.filter(lines__order_lines__order=order).values_list("id", flat=True).distinct()),
            "contract": order.contract_id,
            "deliveries": list(order.deliveries.filter(status=models.DeliveryStatus.CONFIRMED).values_list("id", flat=True)),
            "invoice_requests": list(order.invoice_requests.exclude(status=models.InvoiceRequestStatus.CANCELLED).values_list("id", flat=True)),
        },
    }

