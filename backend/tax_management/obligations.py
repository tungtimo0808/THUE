"""UC-TAX-09: sourced obligations and draft treasury payment orders."""
from datetime import date
from decimal import Decimal, InvalidOperation
from uuid import UUID, uuid4

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from . import declarations, models, services


def due_status(obligation):
    remaining = obligation.outstanding_amount
    if remaining <= 0:
        return "PAID", 0
    days = (obligation.due_date - timezone.localdate()).days
    return ("OVERDUE" if days < 0 else "DUE"), abs(days)


@transaction.atomic
def recognize(company, declaration_id, due_date, request):
    declaration = models.TaxDeclaration.objects.select_for_update().filter(
        pk=declaration_id, company=company).select_related("period").first()
    if not declaration or declaration.preparation_status != "READY_TO_SUBMIT":
        raise ValidationError({"declaration": "Chỉ hồ sơ đã xác nhận của doanh nghiệp mới được ghi nhận nghĩa vụ."})
    if not declarations.source_current(declaration):
        raise ValidationError({"declaration": "Nguồn hồ sơ đã thay đổi; cần rà soát trước khi ghi nhận nghĩa vụ."})
    existing = models.TaxObligation.objects.filter(source_declaration=declaration).first()
    if existing:
        return existing, False
    try:
        payable = Decimal(str(declaration.indicators["payable"]))
        payment_due = date.fromisoformat(due_date)
    except (KeyError, ValueError, TypeError, InvalidOperation):
        raise ValidationError({"due_date": "Chọn ngày hạn nộp hợp lệ và hồ sơ có số phải nộp."})
    if payable <= 0:
        raise ValidationError({"declaration": "Hồ sơ không có số thuế phải nộp."})
    obj = models.TaxObligation.objects.create(company=company, period=declaration.period,
        source_declaration=declaration, basis_status="INTERNAL_CONFIRMED", tax_type="VAT", due_date=payment_due,
        assessed_amount=payable, reason="Theo hồ sơ 01/GTGT đã xác nhận nội bộ; chưa phải kết quả chấp nhận của cơ quan thuế.",
        created_by=services.actor(request))
    services.audit(request, obj, "RECOGNIZE_OBLIGATION", after={"declaration": str(declaration.id),
        "amount": str(payable), "due_date": due_date})
    return obj, True


@transaction.atomic
def create_order(company, data, request):
    key = str(data.get("idempotency_key") or "").strip()
    if not key or len(key) > 100:
        raise ValidationError({"idempotency_key": "Cần mã chống gửi trùng cho giấy nộp tiền."})
    existing = models.TaxPaymentOrder.objects.filter(company=company, idempotency_key=key).first()
    if existing:
        if existing.status != "DRAFT":
            raise ValidationError({"idempotency_key": "Mã yêu cầu đã dùng cho giấy không còn là bản nháp."})
        stored = {(str(line.obligation_id), str(line.amount.normalize()), line.content, line.subitem_code)
                  for line in existing.lines.all()}
        try:
            submitted_lines = {(str(UUID(str(row["obligation"]))), str(Decimal(str(row["amount"])).normalize()),
                                str(row.get("content") or "").strip(), str(row.get("subitem_code") or "").strip())
                               for row in data.get("lines", [])}
        except (KeyError, TypeError, ValueError, InvalidOperation):
            raise ValidationError({"idempotency_key": "Dữ liệu gửi lại không khớp giấy đã tạo."})
        if (existing.payment_method != data.get("payment_method") or existing.treasury != str(data.get("treasury") or "").strip()
                or existing.treasury_account != str(data.get("treasury_account") or "").strip()
                or str(existing.payment_date) != data.get("payment_date") or stored != submitted_lines
                or len(stored) != len(data.get("lines") or [])):
            raise ValidationError({"idempotency_key": "Dữ liệu gửi lại không khớp giấy đã tạo."})
        return existing, False
    method = data.get("payment_method")
    treasury = str(data.get("treasury") or "").strip()
    account = str(data.get("treasury_account") or "").strip()
    if method not in {"ELECTRONIC", "BANK", "CASH"}:
        raise ValidationError({"payment_method": "Chọn phương thức nộp hợp lệ."})
    if not treasury or not account or len(treasury) > 255 or len(account) > 100:
        raise ValidationError({"treasury": "Nhập Kho bạc và tài khoản thu NSNN theo thông tin đã xác minh."})
    try:
        payment_date = date.fromisoformat(data.get("payment_date", ""))
    except (TypeError, ValueError):
        raise ValidationError({"payment_date": "Ngày lập giấy không hợp lệ."})
    submitted = data.get("lines")
    if not isinstance(submitted, list) or not submitted:
        raise ValidationError({"lines": "Chọn ít nhất một nghĩa vụ cần nộp."})
    try:
        ids = [UUID(str(row["obligation"])) for row in submitted]
    except (KeyError, ValueError, TypeError, AttributeError):
        raise ValidationError({"lines": "Dòng nghĩa vụ không hợp lệ."})
    if len(ids) != len(set(ids)):
        raise ValidationError({"lines": "Một nghĩa vụ chỉ được chọn một lần trên giấy."})
    obligations = {obj.id: obj for obj in models.TaxObligation.objects.select_for_update().filter(
        company=company, id__in=ids)}
    if len(obligations) != len(ids):
        raise ValidationError({"lines": "Có nghĩa vụ không thuộc doanh nghiệp."})
    lines = []
    total = Decimal("0")
    for row, obligation_id in zip(submitted, ids):
        obligation = obligations[obligation_id]
        try:
            amount = Decimal(str(row["amount"]))
        except (KeyError, InvalidOperation, TypeError):
            raise ValidationError({"lines": "Số tiền dòng nộp không hợp lệ."})
        content = str(row.get("content") or "").strip()
        subitem = str(row.get("subitem_code") or "").strip()
        pending = sum((line.amount for line in obligation.payment_order_lines.filter(order__status="DRAFT")), Decimal("0"))
        if amount <= 0 or amount > obligation.outstanding_amount - pending:
            raise ValidationError({"lines": "Số tiền vượt phần còn phải nộp sau các giấy nháp hiện có."})
        if not content or not subitem or len(content) > 255 or len(subitem) > 30:
            raise ValidationError({"lines": "Nhập nội dung và tiểu mục đã xác minh cho từng nghĩa vụ."})
        lines.append((obligation, content, subitem, amount))
        total += amount
    order_id = uuid4()
    order = models.TaxPaymentOrder.objects.create(id=order_id, company=company,
        number=f"GNT-{order_id.hex[:12].upper()}", payment_method=method,
        treasury=treasury, treasury_account=account, payment_date=payment_date,
        total_amount=total, idempotency_key=key, created_by=services.actor(request))
    models.TaxPaymentOrderLine.objects.bulk_create([models.TaxPaymentOrderLine(order=order,
        obligation=obligation, content=content, subitem_code=subitem, amount=amount)
        for obligation, content, subitem, amount in lines])
    services.audit(request, order, "CREATE_PAYMENT_ORDER", after={"number": order.number,
        "total": str(total), "status": "DRAFT"})
    return order, True


@transaction.atomic
def cancel_order(order, request):
    order = models.TaxPaymentOrder.objects.select_for_update().get(pk=order.pk)
    if order.status != "DRAFT":
        raise ValidationError("Chỉ giấy nộp tiền nháp mới được hủy.")
    order.status = "CANCELLED"
    order.save(update_fields=("status",))
    services.audit(request, order, "CANCEL_PAYMENT_ORDER", after={"status": order.status})
    return order
