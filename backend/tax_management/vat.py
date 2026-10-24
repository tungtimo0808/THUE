"""Small, traceable VAT calculator backed by invoice-line VAT ledger entries.

This covers the basic deduction method only. Missing policy, unverified input,
and unproven carry forward produce a review result, never a posting document.
"""
import hashlib
import json
from datetime import date
from decimal import Decimal
from uuid import UUID

from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ValidationError

from common_services.models import AccountingPolicy
from general_ledger.models import Account

from . import models, services


ZERO = Decimal("0")


def _policy(period):
    return AccountingPolicy.objects.filter(company=period.company, status="ACTIVE",
        effective_from_period__start_date__lte=period.start_date).filter(
        Q(effective_to_period__isnull=True) | Q(effective_to_period__end_date__gte=period.end_date)
    ).order_by("-version").first()


def _invoice_rows(period):
    return list(models.TaxInvoice.objects.filter(company=period.company,
        invoice_date__range=(period.start_date, period.end_date)).select_related("original_invoice")
        .prefetch_related("lines").order_by("id"))


def source_hash(period):
    policy = _policy(period)
    snapshot = [{"id": str(invoice.id), "status": invoice.status, "type": invoice.invoice_type,
        "effect": invoice.adjustment_effect, "eligible": invoice.tax_eligible,
        "duplicate": invoice.duplicate_suspected, "validation": invoice.validation_summary,
        "original_status": invoice.original_invoice.status if invoice.original_invoice else "",
        "lines": [(str(line.id), str(line.taxable_amount), str(line.tax_amount), str(line.tax_rate))
                  for line in invoice.lines.all()]}
        for invoice in _invoice_rows(period)]
    raw = {"period": (str(period.id), str(period.start_date), str(period.end_date), period.status),
           "policy": (str(policy.id), policy.version, policy.tax_method) if policy else None,
           "invoices": snapshot}
    return hashlib.sha256(json.dumps(raw, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def is_current(calculation):
    latest = models.VatCalculation.objects.filter(period=calculation.period).order_by("-version").first()
    return latest is not None and latest.pk == calculation.pk and calculation.source_snapshot_hash == source_hash(calculation.period)


def _decision(invoice):
    if invoice.status in {"REPLACED", "CANCELLED"}:
        return "EXCLUDED", "Hóa đơn gốc đã bị thay thế hoặc hủy."
    if invoice.invoice_type == "ADJUSTMENT" and invoice.original_invoice and invoice.original_invoice.status in {"REPLACED", "CANCELLED"}:
        return "EXCLUDED", "Chuỗi hóa đơn gốc đã bị thay thế hoặc hủy."
    if invoice.direction == "OUTPUT":
        if invoice.duplicate_suspected:
            return "PENDING_REVIEW", "Hóa đơn đầu ra nghi trùng."
        if invoice.status in {"ISSUED", "ADJUSTED"}:
            return "INCLUDED", "Hóa đơn đầu ra đã phát hành."
        if invoice.status in {"ISSUING", "ISSUE_FAILED", "BLOCKED"}:
            return "PENDING_REVIEW", "Hóa đơn đầu ra chưa phát hành thành công."
        return "EXCLUDED", "Hóa đơn đầu ra chưa phát hành."
    if invoice.duplicate_suspected:
        return "PENDING_REVIEW", "Hóa đơn đầu vào nghi trùng."
    validation = (invoice.validation_summary or {}).get("processing_status")
    if invoice.status not in {"VALIDATED", "ADJUSTED"} or not invoice.tax_eligible or validation not in {"PASSED", "WARNING"}:
        return "PENDING_REVIEW", "Chưa có kết luận được khấu trừ cho hóa đơn đầu vào."
    return "INCLUDED", "Hóa đơn đầu vào đã được xác định đủ điều kiện khấu trừ."


def _sync_ledger(period, fingerprint):
    seen = set()
    for invoice in _invoice_rows(period):
        decision, reason = _decision(invoice)
        sign = -1 if invoice.invoice_type == "ADJUSTMENT" and invoice.adjustment_effect == "DECREASE" else 1
        for line in invoice.lines.all():
            key = f"INVOICE_LINE:{line.id}"
            seen.add(key)
            tax = line.tax_amount * sign
            models.VatLedgerEntry.objects.update_or_create(period=period, source_key=key, defaults={
                "company": period.company, "invoice": invoice, "invoice_line": line,
                "direction": invoice.direction, "taxable_amount": line.taxable_amount * sign,
                "tax_amount": tax, "deductible_tax_amount": tax if invoice.direction == "INPUT" and decision == "INCLUDED" else ZERO,
                "tax_rate": line.tax_rate, "decision": decision, "reason": reason, "source_fingerprint": fingerprint,
            })
    models.VatLedgerEntry.objects.filter(period=period).exclude(source_key__in=seen).update(
        decision="EXCLUDED", reason="Dòng nguồn không còn tồn tại.", taxable_amount=ZERO,
        tax_amount=ZERO, deductible_tax_amount=ZERO)


@transaction.atomic
def calculate(period, request):
    period = models.TaxPeriod.objects.select_for_update().get(pk=period.pk)
    if period.tax_type != "VAT" or period.status != "OPEN":
        raise ValidationError("Chỉ được tính mới cho kỳ thuế GTGT đang mở.")
    fingerprint = source_hash(period)
    _sync_ledger(period, fingerprint)
    entries = list(models.VatLedgerEntry.objects.filter(period=period).select_related("invoice").order_by("source_key"))
    policy = _policy(period)
    warnings = []
    if not policy:
        warnings.append("Chưa cấu hình phương pháp tính thuế GTGT cho doanh nghiệp.")
    elif policy.tax_method != "DEDUCTION":
        warnings.append("Phương pháp thuế của doanh nghiệp không áp dụng luồng khấu trừ này.")
    if not entries or not any(entry.decision == "INCLUDED" for entry in entries):
        warnings.append("Chưa có khoản VAT nguồn đủ điều kiện để tổng hợp.")
    pending = [entry for entry in entries if entry.decision == "PENDING_REVIEW"]
    if pending:
        warnings.append(f"Có {len(pending)} dòng VAT nguồn cần rà soát.")
    if any(entry.invoice and entry.invoice.status == "CANCELLED" for entry in entries):
        warnings.append("Có hóa đơn đã hủy; cần xác nhận kỳ và ảnh hưởng VAT trước khi dùng kết quả.")
    previous = models.VatCalculation.objects.filter(company=period.company, period__end_date__lt=period.start_date,
        status="CALCULATED").order_by("-period__end_date", "-version").first()
    if previous and previous.carry_forward_out > ZERO:
        warnings.append("Có số chuyển kỳ trước nhưng chưa có nguồn kê khai được xác nhận; chưa đưa vào phép tính.")
    included = [entry for entry in entries if entry.decision == "INCLUDED"]
    input_entries = [entry for entry in included if entry.direction == "INPUT"]
    output_entries = [entry for entry in included if entry.direction == "OUTPUT"]
    input_tax = sum((entry.tax_amount for entry in input_entries), ZERO)
    input_deductible = sum((entry.deductible_tax_amount for entry in input_entries), ZERO)
    output_tax = sum((entry.tax_amount for entry in output_entries), ZERO)
    pending_tax = sum((abs(entry.tax_amount) for entry in pending if entry.direction == "INPUT"), ZERO)
    if input_deductible < ZERO or output_tax < ZERO:
        warnings.append("Tổng VAT âm sau điều chỉnh; cần kiểm tra chuỗi hóa đơn.")
    available = max(input_deductible, ZERO)
    deducted = min(available, max(output_tax, ZERO))
    version = (models.VatCalculation.objects.filter(period=period).order_by("-version")
        .values_list("version", flat=True).first() or 0) + 1
    calculation = models.VatCalculation.objects.create(company=period.company, period=period,
        version=version, source_snapshot_hash=fingerprint,
        status="REVIEW_REQUIRED" if warnings else "CALCULATED", input_tax_amount=input_tax,
        input_deductible_amount=input_deductible, input_pending_amount=pending_tax,
        output_tax_amount=output_tax, deducted_amount=deducted,
        payable_amount=max(output_tax - deducted, ZERO), carry_forward_out=max(available - deducted, ZERO),
        warnings=warnings, sources=[{"ledger_id": str(entry.id),
            "invoice_id": str(entry.invoice_id) if entry.invoice_id else None,
            "invoice_number": entry.invoice.invoice_number if entry.invoice else "",
            "direction": entry.direction, "tax_rate": str(entry.tax_rate),
            "tax_amount": str(entry.tax_amount), "deductible_tax_amount": str(entry.deductible_tax_amount),
            "decision": entry.decision, "reason": entry.reason} for entry in entries],
        calculated_by=services.actor(request))
    services.audit(request, calculation, "CALCULATE_VAT", after={"version": version, "status": calculation.status})
    return calculation


@transaction.atomic
def create_document(calculation, request):
    calculation = models.VatCalculation.objects.select_for_update().select_related("period", "company").get(pk=calculation.pk)
    if calculation.status != "CALCULATED" or not is_current(calculation) or calculation.period.status != "OPEN":
        raise ValidationError("Kết quả tính chưa hợp lệ, đã cũ hoặc kỳ thuế đã khóa.")
    if calculation.deducted_amount <= ZERO:
        raise ValidationError("Không có số thuế cần khấu trừ để tạo chứng từ.")
    if models.VatDeductionDocument.objects.filter(period=calculation.period).exists():
        raise ValidationError("Kỳ thuế đã có chứng từ khấu trừ; hãy mở chứng từ hiện có.")
    policy = _policy(calculation.period)
    if not policy or policy.tax_method != "DEDUCTION":
        raise ValidationError("Doanh nghiệp chưa có chính sách thuế GTGT khấu trừ đang áp dụng.")
    try:
        input_id = UUID(str(request.data.get("input_account")))
        output_id = UUID(str(request.data.get("output_account")))
    except (TypeError, ValueError, AttributeError):
        raise ValidationError("Chọn tài khoản VAT đầu vào và đầu ra hợp lệ.")
    accounts = Account.objects.filter(company=calculation.company, status="ACTIVE", is_postable=True)
    input_account = accounts.filter(pk=input_id, code__startswith="133").first()
    output_account = accounts.filter(pk=output_id, code__startswith="3331").first()
    if not input_account or not output_account:
        raise ValidationError("Chọn tài khoản đầu vào nhóm 133 và đầu ra nhóm 3331 có thể hạch toán.")
    try:
        document_date = date.fromisoformat(request.data.get("document_date", ""))
        posting_date = date.fromisoformat(request.data.get("posting_date", ""))
    except (TypeError, ValueError):
        raise ValidationError("Ngày chứng từ và ngày hạch toán phải theo định dạng YYYY-MM-DD.")
    if not (calculation.period.start_date <= document_date <= calculation.period.end_date and
            calculation.period.start_date <= posting_date <= calculation.period.end_date):
        raise ValidationError("Ngày chứng từ và ngày hạch toán phải thuộc kỳ thuế đã chọn.")
    document = models.VatDeductionDocument.objects.create(company=calculation.company,
        period=calculation.period, calculation=calculation, amount=calculation.deducted_amount,
        document_date=document_date, posting_date=posting_date,
        description=str(request.data.get("description", "Khấu trừ thuế GTGT"))[:500],
        input_account=input_account, output_account=output_account, created_by=services.actor(request))
    services.audit(request, document, "CREATE_VAT_DEDUCTION_DOCUMENT", after={"amount": str(document.amount)})
    return document
