"""UC-TAX-03 purchase-document matching and allocation."""

import uuid
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from iam.permissions import has_effective_permission
from purchases.models import GoodsPurchase

from . import models, services
from .input_validation import run_is_current


def _money(value, field):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise ValidationError({field: "Giá trị phân bổ không hợp lệ."})
    if not amount.is_finite() or amount < 0:
        raise ValidationError({field: "Giá trị phân bổ không hợp lệ."})
    return amount


def _purchase_permission(request, purchase):
    if request.user.is_superuser:
        return
    code = "PUR.SERVICE.VIEW" if purchase.purchase_type == "SERVICE" else "PUR.GOODS.VIEW"
    if not has_effective_permission(request.user.iam_account, purchase.company, code, branch_id=purchase.branch_id):
        raise PermissionDenied("Bạn không có quyền xem chứng từ mua hàng thuộc chi nhánh này.")


def _active_links(invoice=None, purchase_id=None):
    links = models.InvoiceDocumentLink.objects.filter(status="ACTIVE", module_code="PUR", entity_type="GoodsPurchase")
    if invoice:
        links = links.filter(invoice=invoice)
    if purchase_id:
        links = links.filter(entity_id=purchase_id)
    return links


def _totals(invoice):
    return _active_links(invoice=invoice).aggregate(total=Sum("linked_amount"),
        before_tax=Sum("allocated_amount_before_tax"), tax=Sum("allocated_tax_amount"))


def _status(invoice, totals):
    linked = totals["total"] or Decimal("0")
    tolerance = Decimal("1") if invoice.currency.code == "VND" else Decimal("0.01")
    if linked == 0:
        return "UNLINKED"
    if linked > invoice.total_amount + tolerance:
        return "REVIEW_REQUIRED"
    if invoice.total_amount - linked <= tolerance:
        return "LINKED"
    return "PARTIALLY_LINKED"


def link_summary(invoice):
    totals = _totals(invoice)
    linked = totals["total"] or Decimal("0")
    rows = []
    for link in _active_links(invoice=invoice).order_by("created_at"):
        purchase = GoodsPurchase.objects.select_related("supplier").filter(pk=link.entity_id, company=invoice.company).first()
        rows.append({"id": str(link.pk), "purchase_id": str(link.entity_id),
                     "number": purchase.number if purchase else link.document_number,
                     "supplier": purchase.supplier.name if purchase else "",
                     "purchase_status": purchase.status if purchase else "MISSING",
                     "amount": str(link.linked_amount), "before_tax": str(link.allocated_amount_before_tax),
                     "tax": str(link.allocated_tax_amount), "notes": link.notes,
                     "conflict": not purchase or purchase.status != "POSTED" or
                       (link.document_version is not None and purchase.version != link.document_version)})
    status = "CONFLICT" if any(row["conflict"] for row in rows) else _status(invoice, totals)
    return {"status": status, "linked_amount": str(linked),
            "remaining_amount": str(max(Decimal("0"), invoice.total_amount - linked)),
            "linked_before_tax": str(totals["before_tax"] or 0), "linked_tax": str(totals["tax"] or 0),
            "links": rows}


def candidates(invoice, request):
    if invoice.direction != "INPUT":
        raise ValidationError("Chỉ tìm chứng từ cho hóa đơn đầu vào.")
    if invoice.currency_id != invoice.company.accounting_currency_id:
        return []  # Foreign-currency matching needs an exchange-rate policy.
    available = GoodsPurchase.objects.filter(company=invoice.company, status="POSTED",
                                             supplier__tax_code=invoice.seller_tax_code).select_related("supplier", "company")
    results = []
    for purchase in available.order_by("-document_date")[:200]:
        try:
            _purchase_permission(request, purchase)
        except PermissionDenied:
            continue
        used = _active_links(purchase_id=purchase.pk).aggregate(total=Sum("linked_amount"))["total"] or Decimal("0")
        remaining = max(Decimal("0"), purchase.total_amount - used)
        if remaining <= 0:
            continue
        days = abs((purchase.document_date - invoice.invoice_date).days)
        amount_match = abs(remaining - invoice.total_amount) <= Decimal("1")
        score = 60 + (25 if amount_match else 0) + (15 if days <= 30 else 0)
        results.append({"id": str(purchase.pk), "number": purchase.number,
                        "document_date": str(purchase.document_date), "posting_date": str(purchase.posting_date),
                        "supplier": purchase.supplier.name, "supplier_tax_code": purchase.supplier.tax_code or "",
                        "description": purchase.notes, "purchase_type": purchase.purchase_type,
                        "status": purchase.status, "version": purchase.version,
                        "subtotal": str(purchase.subtotal), "tax_amount": str(purchase.tax_amount),
                        "total_amount": str(purchase.total_amount), "remaining_amount": str(remaining),
                        "score": score, "match_reasons": ["Khớp MST nhà cung cấp", "Khớp loại tiền kế toán"] +
                          (["Khớp số tiền còn lại"] if amount_match else []) +
                          (["Ngày chứng từ trong 30 ngày"] if days <= 30 else [])})
    return sorted(results, key=lambda row: (-row["score"], row["document_date"], row["number"]))


@transaction.atomic
def link_purchase(invoice, request):
    invoice = models.TaxInvoice.objects.select_for_update().select_related("company", "currency").get(pk=invoice.pk)
    if invoice.direction != "INPUT" or invoice.status in {"CANCELLED", "REPLACED"}:
        raise ValidationError("Hóa đơn không thể liên kết chứng từ mua hàng.")
    run = invoice.validation_runs.first()
    if not run_is_current(run) or run.overall_status not in {"PASSED", "WARNING", "MANUAL_REVIEW"}:
        raise ValidationError("Hóa đơn cần được kiểm tra lại hoặc xử lý lỗi chặn trước khi liên kết.")
    notes = str(request.data.get("notes") or "").strip()[:500]
    if run.overall_status == "MANUAL_REVIEW" and len(notes) < 10:
        raise ValidationError({"notes": "Cần ghi lý do kiểm tra thủ công (ít nhất 10 ký tự)."})
    try:
        purchase_id = uuid.UUID(str(request.data.get("purchase_id")))
    except (ValueError, TypeError):
        raise ValidationError({"purchase_id": "Chứng từ mua hàng không hợp lệ."})
    purchase = GoodsPurchase.objects.select_for_update().select_related("supplier", "company").filter(
        pk=purchase_id, company=invoice.company).first()
    if not purchase or purchase.status != "POSTED":
        raise ValidationError({"purchase_id": "Chứng từ không tồn tại hoặc chưa ghi sổ."})
    _purchase_permission(request, purchase)
    if purchase.supplier.tax_code != invoice.seller_tax_code:
        raise ValidationError("MST nhà cung cấp của chứng từ không khớp hóa đơn.")
    if invoice.currency_id != invoice.company.accounting_currency_id:
        raise ValidationError("Chưa hỗ trợ liên kết hóa đơn ngoại tệ với chứng từ dùng tiền kế toán.")
    if str(request.data.get("version")) != str(purchase.version):
        raise ValidationError("Chứng từ mua đã thay đổi. Vui lòng tải lại danh sách.")
    before_tax = _money(request.data.get("allocated_amount_before_tax"), "allocated_amount_before_tax")
    tax = _money(request.data.get("allocated_tax_amount"), "allocated_tax_amount")
    amount = before_tax + tax
    if amount <= 0:
        raise ValidationError("Giá trị liên kết phải lớn hơn 0.")
    existing = models.InvoiceDocumentLink.objects.select_for_update().filter(
        invoice=invoice, module_code="PUR", entity_type="GoodsPurchase", entity_id=purchase.pk).first()
    if existing and existing.status == "ACTIVE":
        raise ValidationError("Chứng từ đã liên kết với hóa đơn này.")
    invoice_totals = _totals(invoice)
    document_used = _active_links(purchase_id=purchase.pk).aggregate(total=Sum("linked_amount"))["total"] or Decimal("0")
    if (amount > invoice.total_amount - (invoice_totals["total"] or 0) or
        before_tax > invoice.subtotal - (invoice_totals["before_tax"] or 0) or
        tax > invoice.tax_amount - (invoice_totals["tax"] or 0) or
        amount > purchase.total_amount - document_used):
        raise ValidationError("Phân bổ vượt phần còn lại của hóa đơn hoặc chứng từ.")
    if existing:
        existing.status = "ACTIVE"
        existing.linked_amount = amount
        existing.allocated_amount_before_tax = before_tax
        existing.allocated_tax_amount = tax
        existing.document_number = purchase.number
        existing.document_version = purchase.version
        existing.notes = notes
        existing.removed_at = None
        existing.removed_by = None
        existing.removal_reason = ""
        existing.save()
        link = existing
    else:
        link = models.InvoiceDocumentLink.objects.create(
            company=invoice.company, invoice=invoice, module_code="PUR", entity_type="GoodsPurchase",
            entity_id=purchase.pk, document_number=purchase.number, linked_amount=amount,
            allocated_amount_before_tax=before_tax, allocated_tax_amount=tax,
            document_version=purchase.version, notes=notes, created_by=services.actor(request),
        )
    services.audit(request, link, "LINK_PURCHASE", after={"invoice": str(invoice.pk),
        "purchase": str(purchase.pk), "before_tax": str(before_tax), "tax": str(tax), "amount": str(amount),
        "validation_run": str(run.pk)})
    return link_summary(invoice)


@transaction.atomic
def unlink_purchase(invoice, request):
    invoice = models.TaxInvoice.objects.select_for_update().select_related("currency").get(pk=invoice.pk)
    reason = str(request.data.get("reason") or "").strip()
    if len(reason) < 10:
        raise ValidationError({"reason": "Cần ghi lý do gỡ liên kết (ít nhất 10 ký tự)."})
    link = models.InvoiceDocumentLink.objects.select_for_update().filter(
        pk=request.data.get("link_id"), invoice=invoice, module_code="PUR",
        entity_type="GoodsPurchase", status="ACTIVE").first()
    if not link:
        raise ValidationError("Liên kết không tồn tại hoặc đã được gỡ.")
    if models.TaxPeriod.objects.filter(company=invoice.company, start_date__lte=invoice.invoice_date,
                                       end_date__gte=invoice.invoice_date, status="CLOSED").exists():
        raise ValidationError("Kỳ thuế đã đóng; không thể gỡ liên kết trực tiếp.")
    before = {"invoice": str(invoice.pk), "purchase": str(link.entity_id), "amount": str(link.linked_amount)}
    link.status = "REMOVED"
    link.removed_at = timezone.now()
    link.removed_by = services.actor(request)
    link.removal_reason = reason[:500]
    link.save(update_fields=("status", "removed_at", "removed_by", "removal_reason"))
    services.audit(request, link, "UNLINK_PURCHASE", before=before, after={"status": "REMOVED", "reason": reason})
    return link_summary(invoice)
