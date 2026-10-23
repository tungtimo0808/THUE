import hashlib
import json
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
    if invoice.status not in {"DRAFT", "RECEIVED", "BLOCKED", "VALIDATED", "ISSUE_FAILED"}:
        raise ValidationError("Trạng thái hóa đơn không cho phép kiểm tra.")
    if _period_closed(invoice.company, invoice.invoice_date):
        raise ValidationError("Không được kiểm tra lại hóa đơn trong kỳ thuế đã đóng.")
    invoice.validation_results.all().delete()
    results = []
    if not invoice.seller_tax_code or not invoice.invoice_series or (invoice.direction == "INPUT" and not invoice.invoice_number):
        results.append(("REQUIRED_FIELDS", "ERROR", "Thiếu mã số thuế, ký hiệu hoặc số hóa đơn."))
    if invoice.direction == "OUTPUT" and (invoice.seller_tax_code != invoice.company.tax_code or not invoice.buyer_name.strip()):
        results.append(("OUTPUT_PARTIES", "ERROR", "Thông tin người bán hoặc người mua không hợp lệ."))
    if not invoice.lines.exists():
        results.append(("NO_LINES", "ERROR", "Hóa đơn phải có ít nhất một dòng chi tiết."))
    line_subtotal = sum((line.taxable_amount for line in invoice.lines.all()), Decimal("0"))
    line_tax = sum((line.tax_amount for line in invoice.lines.all()), Decimal("0"))
    if abs(invoice.subtotal - line_subtotal) > Decimal("0.01") or abs(invoice.tax_amount - line_tax) > Decimal("0.01") or invoice.total_amount != invoice.subtotal + invoice.tax_amount:
        results.append(("TOTAL_MISMATCH", "ERROR", "Tổng tiền hóa đơn không khớp chi tiết."))
    duplicate = bool(invoice.invoice_number) and models.TaxInvoice.objects.filter(
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
    if invoice.direction == "INPUT":
        raise ValidationError("Dùng thao tác liên kết chứng từ mua hàng của hóa đơn.")
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
    if invoice and task_type == "ISSUE":
        invoice = models.TaxInvoice.objects.select_for_update().prefetch_related("lines").get(pk=invoice.pk)
        if connector.channel != "EINVOICE" or invoice.direction != "OUTPUT" or invoice.status != "VALIDATED":
            raise ValidationError("Hóa đơn đầu ra cần được kiểm tra và chọn kết nối hóa đơn điện tử hợp lệ.")
        if invoice.original_invoice_id:
            original = models.TaxInvoice.objects.select_for_update().get(pk=invoice.original_invoice_id)
            if original.status not in {"ISSUED", "ADJUSTED"} or models.IntegrationRequest.objects.filter(
                invoice=original, task_type="CANCEL", status="PENDING").exists():
                raise ValidationError("Hóa đơn gốc không còn đủ điều kiện xử lý.")
            if invoice.invoice_type == "REPLACEMENT" and models.TaxInvoice.objects.filter(
                original_invoice=original, invoice_type="REPLACEMENT", status__in=("ISSUING", "ISSUED")
            ).exclude(pk=invoice.pk).exists():
                raise ValidationError("Hóa đơn gốc đã có bản thay thế đang phát hành hoặc đã phát hành.")
            if invoice.invoice_type == "ADJUSTMENT" and invoice.adjustment_effect == "DECREASE":
                prior = models.TaxInvoice.objects.filter(original_invoice=original, invoice_type="ADJUSTMENT",
                    adjustment_effect="DECREASE", status="ISSUED").aggregate(total=Sum("total_amount"))["total"] or Decimal("0")
                increases = models.TaxInvoice.objects.filter(original_invoice=original, invoice_type="ADJUSTMENT",
                    adjustment_effect="INCREASE", status="ISSUED").aggregate(total=Sum("total_amount"))["total"] or Decimal("0")
                if invoice.total_amount > original.total_amount + increases - prior:
                    raise ValidationError("Tổng điều chỉnh giảm vượt giá trị còn lại của hóa đơn gốc.")
        snapshot = {
            "invoice_id": str(invoice.pk), "company_id": str(invoice.company_id),
            "series": invoice.invoice_series, "number": invoice.invoice_number,
            "date": str(invoice.invoice_date), "seller_name": invoice.seller_name,
            "seller_tax_code": invoice.seller_tax_code, "buyer_name": invoice.buyer_name,
            "buyer_tax_code": invoice.buyer_tax_code, "currency_id": str(invoice.currency_id),
            "subtotal": str(invoice.subtotal), "tax_amount": str(invoice.tax_amount),
            "total_amount": str(invoice.total_amount),
            "lines": [{"description": line.description, "quantity": str(line.quantity),
                       "unit_price": str(line.unit_price), "discount_amount": str(line.discount_amount),
                       "tax_rate": str(line.tax_rate), "tax_amount": str(line.tax_amount)}
                      for line in invoice.lines.all()],
        }
        canonical = json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode("utf-8")
        payload = {"snapshot": snapshot, "snapshot_sha256": hashlib.sha256(canonical).hexdigest(),
            "correction": {"original_invoice_id": str(invoice.original_invoice_id),
                "type": invoice.invoice_type, "effect": invoice.adjustment_effect,
                "reason": invoice.raw_data.get("correction_reason", "")} if invoice.original_invoice_id else None}
    if invoice and task_type == "CANCEL":
        invoice = models.TaxInvoice.objects.select_for_update().get(pk=invoice.pk)
        if connector.channel != "EINVOICE" or invoice.direction != "OUTPUT" or invoice.status != "ISSUED":
            raise ValidationError("Chỉ hóa đơn đầu ra đã phát hành còn hiệu lực mới được gửi yêu cầu hủy.")
        if models.TaxInvoice.objects.filter(original_invoice=invoice, invoice_type="REPLACEMENT",
            status__in=("ISSUING", "ISSUED")).exists():
            raise ValidationError("Hóa đơn đã có bản thay thế đang xử lý hoặc có hiệu lực.")
        if models.IntegrationRequest.objects.filter(invoice=invoice, task_type="CANCEL", status="PENDING").exists():
            raise ValidationError("Hóa đơn đang có yêu cầu hủy chờ kết quả.")
        payload = {"reason": str(payload.get("reason", "")).strip(),
            "case_type": payload.get("case_type"), "invoice_id": str(invoice.pk),
            "provider_invoice_id": invoice.external_reference, "invoice_number": invoice.invoice_number}
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
    if obj.status != "PENDING" or result not in {"SUCCESS", "FAILED", "PROCESSING"}:
        raise ValidationError("Kết quả tích hợp không hợp lệ.")
    response = request.data.get("response") or {}
    if result == "PROCESSING":
        obj.response_payload = response
        obj.save(update_fields=("response_payload", "updated_at"))
        return obj
    if obj.task_type == "CANCEL" and result == "SUCCESS":
        if not isinstance(response, dict) or response.get("confirmed") is not True or not response.get("provider_reference"):
            raise ValidationError("Thiếu bằng chứng Provider xác nhận hủy hóa đơn.")
    if obj.task_type == "ISSUE" and result == "SUCCESS":
        if not isinstance(response, dict) or response.get("confirmed") is not True or not all(response.get(key) for key in
            ("provider_invoice_id", "invoice_number", "lookup_code")):
            raise ValidationError("Thiếu bằng chứng phát hành thành công từ hệ thống tích hợp.")
        if models.TaxInvoice.objects.filter(company=obj.company, direction="OUTPUT",
            invoice_series=obj.invoice.invoice_series, invoice_number=response["invoice_number"],
            seller_tax_code=obj.invoice.seller_tax_code).exclude(pk=obj.invoice_id).exists():
            raise ValidationError("Số hóa đơn do Provider trả về đã tồn tại.")
        if models.TaxInvoice.objects.filter(company=obj.company,
            external_reference=response["provider_invoice_id"]).exclude(pk=obj.invoice_id).exists():
            raise ValidationError("Mã hóa đơn Provider đã được ghi nhận trước đó.")
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
            invoice.external_reference = str(response["provider_invoice_id"])[:150]
            invoice.invoice_number = str(response["invoice_number"])[:80]
            invoice.raw_data = {**invoice.raw_data, "lookup_code": str(response["lookup_code"])[:150]}
            if invoice.original_invoice_id:
                original = models.TaxInvoice.objects.select_for_update().get(pk=invoice.original_invoice_id)
                original_old = original.status
                original.status = "ADJUSTED" if invoice.invoice_type == "ADJUSTMENT" else "REPLACED"
                original.save(update_fields=("status", "updated_at"))
                _history(original, request, original_old, original.status, invoice.invoice_type)
        elif obj.task_type == "CANCEL":
            invoice.status = "CANCELLED"
            invoice.external_status = "CANCELLED"
        invoice.save(update_fields=("status", "issued_at", "external_status", "external_reference",
                                    "invoice_number", "raw_data", "updated_at"))
        _history(invoice, request, old, invoice.status, obj.task_type)
        audit(request, invoice, obj.task_type, {"status": old}, {"status": invoice.status})
    elif obj.invoice_id and result == "FAILED":
        invoice = models.TaxInvoice.objects.select_for_update().get(pk=obj.invoice_id)
        old = invoice.status
        if obj.task_type == "ISSUE":
            if invoice.status == "ISSUING":
                invoice.status = "ISSUE_FAILED"
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
    case_type = request.data.get("case_type")
    if invoice.status != "ISSUED" or not reason:
        raise ValidationError("Chỉ hóa đơn đã phát hành và có lý do mới được hủy.")
    if case_type != "NOT_SENT_TO_BUYER":
        raise ValidationError({"case_type": "MVP chỉ hỗ trợ gửi yêu cầu hủy hóa đơn chưa gửi người mua."})
    try:
        connector = models.ConnectorConfig.objects.get(pk=request.data.get("connector"), company=invoice.company, is_active=True)
    except (models.ConnectorConfig.DoesNotExist, ValueError):
        raise ValidationError({"connector": "Connector không hợp lệ."})
    return request_integration(invoice=invoice, connector=connector, task_type="CANCEL", key=request.data.get("idempotency_key", ""), payload={"reason": reason, "case_type": case_type}, request=request)


@transaction.atomic
def build_summary(period, request):
    if period.status == "CLOSED":
        raise ValidationError("Kỳ thuế đã đóng.")
    invoices = models.TaxInvoice.objects.filter(company=period.company, invoice_date__range=(period.start_date, period.end_date))
    included = invoices.filter(
        Q(direction="INPUT", status__in=("VALIDATED", "ADJUSTED"), tax_eligible=True)
        | Q(direction="OUTPUT", status__in=("ISSUED", "ADJUSTED"))
    ).exclude(direction="OUTPUT", invoice_type="ADJUSTMENT", original_invoice__status__in=("REPLACED", "CANCELLED"))
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
    raise ValidationError("Chứng từ BANK/CASH đã ghi sổ chưa phải bằng chứng NSNN nhận tiền; không thể tự tăng số đã nộp. Hãy lập giấy nộp tiền và chờ xác nhận thanh toán.")


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


AUTHORITY_CONNECTOR = "TAX_AUTHORITY"


def authority_settings(company):
    """Managing tax office, tax agent and the declaration forms the company files (stored on its tax-authority connector)."""
    connector = models.ConnectorConfig.objects.filter(company=company, code=AUTHORITY_CONNECTOR).first()
    config = connector.config if connector else {}
    return {
        "department": config.get("department", ""), "branch_office": config.get("branch_office", ""),
        "tax_agent": config.get("tax_agent", ""), "registered_forms": config.get("registered_forms", []),
        "configured": bool(connector and config.get("branch_office")),
    }


@transaction.atomic
def save_authority_settings(company, data, request):
    connector, _ = models.ConnectorConfig.objects.get_or_create(
        company=company, code=AUTHORITY_CONNECTOR,
        defaults={"provider": "Cơ quan thuế", "channel": "TAX_AUTHORITY", "config": {}},
    )
    config = dict(connector.config or {})
    for field in ("department", "branch_office", "tax_agent"):
        if field in data:
            config[field] = str(data.get(field) or "")[:255]
    if "registered_forms" in data:
        forms = data.get("registered_forms") or []
        if not isinstance(forms, list) or any(not isinstance(item, dict) or not item.get("code") for item in forms):
            raise ValidationError({"registered_forms": "Danh sách tờ khai không hợp lệ."})
        config["registered_forms"] = [
            {"code": str(item["code"])[:30], "name": str(item.get("name", ""))[:255], "frequency": str(item.get("frequency", ""))[:30]}
            for item in forms
        ]
    connector.config = config
    connector.is_active = True
    connector.save(update_fields=("config", "is_active", "updated_at"))
    audit(request, connector, "CONFIGURE", after=config)
    return authority_settings(company)


@transaction.atomic
def request_e_payment(obligation, request):
    """Prepare an electronic state-budget payment order for the tax portal; it stays PENDING until the portal answers."""
    obligation = models.TaxObligation.objects.select_for_update().get(pk=obligation.pk)
    connector = models.ConnectorConfig.objects.filter(company=obligation.company, code=AUTHORITY_CONNECTOR, is_active=True).first()
    if not connector or not connector.config.get("branch_office"):
        raise ValidationError("Chưa thiết lập cơ quan thuế quản lý; hãy thiết lập trước khi lập giấy nộp tiền điện tử.")
    outstanding = obligation.assessed_amount + obligation.adjustment_amount - obligation.paid_amount
    amount = Decimal(str(request.data.get("amount") or outstanding))
    if amount <= 0 or amount > outstanding:
        raise ValidationError({"amount": "Số tiền nộp phải lớn hơn 0 và không vượt số còn phải nộp."})
    if obligation.integration_requests.filter(task_type="E_PAYMENT", status="PENDING").exists():
        raise ValidationError("Nghĩa vụ thuế này đã có giấy nộp tiền điện tử đang chờ cổng thuế xử lý.")
    payload = {
        "tax_type": obligation.tax_type, "period": obligation.period.code, "amount": str(amount),
        "treasury": str(request.data.get("treasury") or "")[:255],
        "bank_account": str(request.data.get("bank_account") or "")[:100],
        "payment_method": str(request.data.get("payment_method") or "BANK_TRANSFER")[:50],
        "tax_office": connector.config.get("branch_office", ""),
    }
    obj = models.IntegrationRequest.objects.create(
        company=obligation.company, connector=connector, obligation=obligation, task_type="E_PAYMENT",
        idempotency_key=f"E_PAYMENT:{obligation.pk}:{timezone.now().timestamp()}", request_payload=payload,
        created_by=actor(request),
    )
    audit(request, obligation, "REQUEST_E_PAYMENT", after={"integration_request": str(obj.id), "amount": str(amount)})
    return obj
