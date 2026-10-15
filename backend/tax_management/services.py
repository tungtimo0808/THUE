from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from audit_log.services import record_audit
from . import models


def actor(request):
    if hasattr(request.user, "iam_account"):
        return request.user.iam_account
    from iam.models import UserAccount
    return UserAccount.objects.first()


def audit(request, obj, action, before=None, after=None, reason=""):
    record_audit(
        company=obj.company, actor_user=actor(request), module_code="TAX", action_code=action,
        entity=obj, before=before or {}, after=after or {}, request=request, reason=reason,
    )


def _history(invoice, request, old, new, reason=""):
    models.InvoiceStatusHistory.objects.create(invoice=invoice, from_status=old, to_status=new, reason=reason, actor=actor(request))


def _period_closed(company, date):
    return models.TaxPeriod.objects.filter(company=company, start_date__lte=date, end_date__gte=date, status="CLOSED").exists()


@transaction.atomic
def validate_invoice(invoice, request):
    invoice = models.TaxInvoice.objects.select_for_update().prefetch_related("lines").get(pk=invoice.pk)
    if invoice.status not in {"DRAFT", "RECEIVED", "BLOCKED", "VALIDATED"}:
        raise ValidationError("Trạng thái hóa đơn không cho phép kiểm tra.")
    if _period_closed(invoice.company, invoice.invoice_date):
        raise ValidationError("Không được kiểm tra lại hóa đơn trong kỳ thuế đã đóng.")
    invoice.validation_results.all().delete()
    results = []
    if not invoice.seller_tax_code or not invoice.invoice_number or not invoice.invoice_series:
        results.append(("REQUIRED_FIELDS", "ERROR", "Thiếu mã số thuế, ký hiệu hoặc số hóa đơn."))
    if not invoice.lines.exists():
        results.append(("NO_LINES", "ERROR", "Hóa đơn phải có ít nhất một dòng chi tiết."))
    line_subtotal = sum((line.taxable_amount for line in invoice.lines.all()), Decimal("0"))
    line_tax = sum((line.tax_amount for line in invoice.lines.all()), Decimal("0"))
    if abs(invoice.subtotal - line_subtotal) > Decimal("0.01") or abs(invoice.tax_amount - line_tax) > Decimal("0.01") or invoice.total_amount != invoice.subtotal + invoice.tax_amount:
        results.append(("TOTAL_MISMATCH", "ERROR", "Tổng tiền hóa đơn không khớp chi tiết."))
    duplicate = models.TaxInvoice.objects.filter(
        company=invoice.company, direction=invoice.direction, seller_tax_code=invoice.seller_tax_code,
        invoice_series=invoice.invoice_series, invoice_number=invoice.invoice_number,
    ).exclude(pk=invoice.pk).exists()
    if duplicate:
        results.append(("DUPLICATE", "ERROR", "Hóa đơn trùng bộ nhận diện."))
    for code, severity, message in results:
        models.InvoiceValidation.objects.create(invoice=invoice, code=code, severity=severity, message=message)
    if source := request.data.get("verification_source"):
        models.InvoiceValidation.objects.create(
            invoice=invoice, code="EXTERNAL_CHECK", severity="INFO",
            message=str(request.data.get("verification_result", "Đã kiểm tra bên ngoài"))[:1000], source=str(source)[:50],
        )
    old = invoice.status
    has_errors = any(severity == "ERROR" for _, severity, _ in results)
    invoice.status = "BLOCKED" if has_errors else "VALIDATED"
    invoice.tax_eligible = bool(request.data.get("tax_eligible", invoice.direction == "INPUT")) and not has_errors
    invoice.duplicate_suspected = duplicate
    invoice.validation_summary = {"errors": sum(x[1] == "ERROR" for x in results), "warnings": sum(x[1] == "WARNING" for x in results)}
    invoice.save(update_fields=("status", "tax_eligible", "duplicate_suspected", "validation_summary", "updated_at"))
    if not has_errors and invoice.direction == "INPUT" and invoice.original_invoice_id:
        original = models.TaxInvoice.objects.select_for_update().get(pk=invoice.original_invoice_id)
        original_old = original.status
        original.status = "ADJUSTED" if invoice.invoice_type == "ADJUSTMENT" else "REPLACED"
        original.save(update_fields=("status", "updated_at"))
        _history(original, request, original_old, original.status, invoice.invoice_type)
    _history(invoice, request, old, invoice.status)
    audit(request, invoice, "VALIDATE", {"status": old}, {"status": invoice.status, **invoice.validation_summary})
    return invoice


@transaction.atomic
def add_link(data, request):
    invoice = models.TaxInvoice.objects.select_for_update().get(pk=data["invoice"].pk)
    if invoice.status in {"CANCELLED", "REPLACED"}:
        raise ValidationError("Không thể liên kết hóa đơn đã hủy/thay thế.")
    data["invoice"] = invoice
    obj = models.InvoiceDocumentLink.objects.create(**data, created_by=actor(request))
    linked = invoice.document_links.aggregate(v=Sum("linked_amount"))["v"] or Decimal("0")
    tolerance = Decimal(str(request.data.get("tolerance", "0.01")))
    if abs(linked - invoice.total_amount) > tolerance:
        models.InvoiceValidation.objects.create(invoice=invoice, code="LINK_VARIANCE", severity="WARNING", message=f"Chênh lệch liên kết: {linked - invoice.total_amount}")
    audit(request, obj, "LINK", after={"invoice": str(invoice.id), "module": obj.module_code, "entity_id": str(obj.entity_id)})
    return obj


@transaction.atomic
def request_integration(*, invoice=None, filing=None, connector, task_type, key, payload, request):
    if not connector.is_active or connector.company_id != (invoice.company_id if invoice else filing.company_id):
        raise ValidationError("Connector không hoạt động hoặc không cùng doanh nghiệp.")
    if not key:
        raise ValidationError({"idempotency_key": "Mã chống gửi trùng là bắt buộc."})
    if invoice and _period_closed(invoice.company, invoice.invoice_date):
        raise ValidationError("Không được phát hành/xử lý hóa đơn trong kỳ thuế đã đóng.")
    if models.IntegrationRequest.objects.filter(idempotency_key=key).exists():
        raise ValidationError({"idempotency_key": "Yêu cầu đã được gửi trước đó."})
    obj = models.IntegrationRequest.objects.create(
        company=connector.company, connector=connector, invoice=invoice, filing=filing,
        task_type=task_type, idempotency_key=key, request_payload=payload, created_by=actor(request),
    )
    if invoice:
        old = invoice.status
        if task_type == "ISSUE":
            if invoice.direction != "OUTPUT" or invoice.status != "VALIDATED":
                raise ValidationError("Chỉ hóa đơn đầu ra đã kiểm tra mới được phát hành.")
            invoice.status = "ISSUING"
        invoice.save(update_fields=("status", "updated_at"))
        _history(invoice, request, old, invoice.status, task_type)
        audit(request, invoice, f"REQUEST_{task_type}", after={"integration_request": str(obj.id)})
    else:
        audit(request, filing, f"REQUEST_{task_type}", after={"integration_request": str(obj.id)})
    return obj


@transaction.atomic
def integration_result(obj, request):
    obj = models.IntegrationRequest.objects.select_for_update().get(pk=obj.pk)
    result = request.data.get("status")
    if obj.status != "PENDING" or result not in {"SUCCESS", "FAILED"}:
        raise ValidationError("Kết quả tích hợp không hợp lệ.")
    obj.status = result
    obj.response_payload = request.data.get("response", {})
    obj.error_message = request.data.get("error_message", "")
    obj.save(update_fields=("status", "response_payload", "error_message", "updated_at"))
    if obj.invoice_id and result == "SUCCESS":
        invoice = models.TaxInvoice.objects.select_for_update().get(pk=obj.invoice_id)
        old = invoice.status
        if obj.task_type == "ISSUE":
            invoice.status = "ISSUED"
            invoice.issued_at = timezone.now()
            invoice.external_status = "SUCCESS"
            invoice.external_reference = str(request.data.get("external_reference", ""))[:150]
            if invoice.original_invoice_id:
                original = models.TaxInvoice.objects.select_for_update().get(pk=invoice.original_invoice_id)
                original_old = original.status
                original.status = "ADJUSTED" if invoice.invoice_type == "ADJUSTMENT" else "REPLACED"
                original.save(update_fields=("status", "updated_at"))
                _history(original, request, original_old, original.status, invoice.invoice_type)
        elif obj.task_type == "CANCEL":
            invoice.status = "CANCELLED"
            invoice.external_status = "CANCELLED"
        invoice.save(update_fields=("status", "issued_at", "external_status", "external_reference", "updated_at"))
        _history(invoice, request, old, invoice.status, obj.task_type)
        audit(request, invoice, obj.task_type, {"status": old}, {"status": invoice.status})
    elif obj.invoice_id and result == "FAILED":
        invoice = models.TaxInvoice.objects.select_for_update().get(pk=obj.invoice_id)
        old = invoice.status
        if obj.task_type == "ISSUE" and invoice.status == "ISSUING":
            invoice.status = "VALIDATED"
        invoice.external_status = "FAILED"
        invoice.save(update_fields=("status", "external_status", "updated_at"))
        _history(invoice, request, old, invoice.status, obj.error_message)
    if obj.filing_id and result == "SUCCESS":
        filing = models.TaxFiling.objects.select_for_update().get(pk=obj.filing_id)
        filing.status = "SUBMITTED"
        filing.submission_reference = str(request.data.get("external_reference", ""))[:150]
        filing.submitted_at = timezone.now()
        filing.save(update_fields=("status", "submission_reference", "submitted_at", "updated_at"))
        audit(request, filing, "SUBMIT", after={"status": filing.status})
    return obj


@transaction.atomic
def cancel_invoice(invoice, request):
    reason = request.data.get("reason", "").strip()
    if invoice.status != "ISSUED" or not reason:
        raise ValidationError("Chỉ hóa đơn đã phát hành và có lý do mới được hủy.")
    try:
        connector = models.ConnectorConfig.objects.get(pk=request.data.get("connector"), company=invoice.company, is_active=True)
    except (models.ConnectorConfig.DoesNotExist, ValueError):
        raise ValidationError({"connector": "Connector không hợp lệ."})
    return request_integration(invoice=invoice, connector=connector, task_type="CANCEL", key=request.data.get("idempotency_key", ""), payload={"reason": reason}, request=request)


@transaction.atomic
def build_summary(period, request):
    if period.status == "CLOSED":
        raise ValidationError("Kỳ thuế đã đóng.")
    invoices = models.TaxInvoice.objects.filter(company=period.company, invoice_date__range=(period.start_date, period.end_date))
    included = invoices.filter(
        Q(direction="INPUT", status__in=("VALIDATED", "ADJUSTED"), tax_eligible=True)
        | Q(direction="OUTPUT", status__in=("ISSUED", "ADJUSTED"))
    )
    input_rows = included.filter(direction="INPUT")
    output_rows = included.filter(direction="OUTPUT")
    def signed(rows, field):
        total = Decimal("0")
        for invoice in rows:
            sign = Decimal("-1") if invoice.invoice_type == "ADJUSTMENT" and invoice.adjustment_effect == "DECREASE" else Decimal("1")
            total += getattr(invoice, field) * sign
        return total
    version = (models.TaxSummary.objects.filter(period=period).order_by("-version").values_list("version", flat=True).first() or 0) + 1
    input_base, input_tax = signed(input_rows, "subtotal"), signed(input_rows, "tax_amount")
    output_base, output_tax = signed(output_rows, "subtotal"), signed(output_rows, "tax_amount")
    excluded = invoices.exclude(pk__in=included.values("pk"))
    obj = models.TaxSummary.objects.create(
        company=period.company, period=period, version=version,
        input_taxable_amount=input_base, input_tax_amount=input_tax,
        output_taxable_amount=output_base, output_tax_amount=output_tax,
        tax_difference=output_tax - input_tax, exception_count=excluded.count(),
        details={"included_invoices": included.count(), "excluded_invoices": excluded.count()}, created_by=actor(request),
    )
    audit(request, obj, "SUMMARIZE", after={"version": version, "tax_difference": str(obj.tax_difference)})
    return obj


@transaction.atomic
def create_filing(data, request):
    data = dict(data)
    summary = data["summary"]
    warnings = []
    if summary.exception_count:
        warnings.append(f"Có {summary.exception_count} hóa đơn chưa đủ điều kiện tổng hợp.")
    indicators = data.pop("indicators", None) or {
        "input_taxable_amount": str(summary.input_taxable_amount), "input_tax_amount": str(summary.input_tax_amount),
        "output_taxable_amount": str(summary.output_taxable_amount), "output_tax_amount": str(summary.output_tax_amount),
        "tax_payable": str(max(summary.tax_difference, Decimal("0"))),
    }
    obj = models.TaxFiling.objects.create(**data, indicators=indicators, warnings=warnings, created_by=actor(request))
    audit(request, obj, "CREATE_FILING", after={"version": obj.version, "warnings": warnings})
    return obj


@transaction.atomic
def link_payment(obligation, request):
    obligation = models.TaxObligation.objects.select_for_update().get(pk=obligation.pk)
    source, transaction_id = request.data.get("source_module"), request.data.get("transaction_id")
    amount = Decimal(str(request.data.get("amount", "0")))
    if source == "CASH":
        from cash_management.models import CashTransaction
        exists = CashTransaction.objects.filter(pk=transaction_id, company=obligation.company, status="POSTED").exists()
    elif source == "BANK":
        from bank_management.models import BankTransaction
        exists = BankTransaction.objects.filter(pk=transaction_id, company=obligation.company, status="POSTED").exists()
    else:
        raise ValidationError({"source_module": "Nguồn thanh toán phải là CASH hoặc BANK."})
    if not exists or amount <= 0 or amount > obligation.outstanding_amount:
        raise ValidationError("Giao dịch thanh toán hoặc số tiền không hợp lệ.")
    obj = models.TaxPaymentLink.objects.create(
        obligation=obligation, source_module=source, transaction_id=transaction_id,
        reference=request.data.get("reference", ""), amount=amount,
        payment_date=request.data.get("payment_date") or timezone.localdate(), created_by=actor(request),
    )
    obligation.paid_amount += amount
    obligation.status = "PAID" if obligation.outstanding_amount == 0 else "PARTIAL"
    obligation.save(update_fields=("paid_amount", "status", "updated_at"))
    audit(request, obligation, "PAYMENT_LINK", after={"paid_amount": str(obligation.paid_amount), "status": obligation.status})
    return obj


@transaction.atomic
def reconcile(period, request):
    invoices = models.TaxInvoice.objects.filter(company=period.company, invoice_date__range=(period.start_date, period.end_date)).exclude(status="CANCELLED")
    discrepancies = []
    for invoice in invoices:
        linked = invoice.document_links.aggregate(v=Sum("linked_amount"))["v"] or Decimal("0")
        if not invoice.document_links.exists():
            discrepancies.append({"invoice": str(invoice.id), "type": "MISSING_DOCUMENT", "amount": str(invoice.total_amount)})
        elif abs(linked - invoice.total_amount) > Decimal("0.01"):
            discrepancies.append({"invoice": str(invoice.id), "type": "AMOUNT_MISMATCH", "difference": str(linked - invoice.total_amount)})
    obj = models.ReconciliationRun.objects.create(
        company=period.company, period=period, discrepancy_count=len(discrepancies),
        details={"discrepancies": discrepancies}, created_by=actor(request),
    )
    audit(request, obj, "RECONCILE", after={"discrepancy_count": len(discrepancies)})
    return obj


@transaction.atomic
def export_data(data, request):
    period = data["period"]
    if period.company_id != data["company"].id:
        raise ValidationError("Kỳ thuế phải thuộc cùng doanh nghiệp.")
    filing = data.get("filing")
    if filing and filing.period_id != period.id:
        raise ValidationError("Hồ sơ không thuộc kỳ xuất dữ liệu.")
    warnings = list(filing.warnings) if filing else []
    snapshot = {
        "period": period.code, "tax_type": period.tax_type,
        "filing_id": str(filing.id) if filing else None,
        "indicators": filing.indicators if filing else {},
    }
    obj = models.TaxExport.objects.create(**data, data_snapshot=snapshot, warnings=warnings, exported_by=actor(request))
    audit(request, obj, "EXPORT", after={"format": obj.format_code, "version": obj.format_version, "warnings": warnings})
    return obj
