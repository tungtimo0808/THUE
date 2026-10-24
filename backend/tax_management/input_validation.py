"""Versioned, source-backed checks for received input invoices (UC-TAX-02)."""

import hashlib
import json
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from purchases.input_invoice_services import parse_xml

from . import models, services


RULE_SET_VERSION = "UC-TAX-02-MVP-1"


def fingerprint(invoice):
    source = models.TaxInvoiceSourceFile.objects.filter(invoice=invoice).values_list("sha256", flat=True).first()
    fields = {
        "source_sha256": source or "", "direction": invoice.direction,
        "company_tax_code": invoice.company.tax_code, "raw_data": invoice.raw_data,
        "invoice_type": invoice.invoice_type, "series": invoice.invoice_series,
        "number": invoice.invoice_number, "date": str(invoice.invoice_date),
        "seller_name": invoice.seller_name, "seller_tax_code": invoice.seller_tax_code,
        "buyer_name": invoice.buyer_name, "buyer_tax_code": invoice.buyer_tax_code,
        "subtotal": str(invoice.subtotal), "tax_amount": str(invoice.tax_amount),
        "total_amount": str(invoice.total_amount), "currency": str(invoice.currency_id),
        "lines": list(invoice.lines.order_by("line_no").values(
            "line_no", "description", "quantity", "unit_price", "discount_amount",
            "taxable_amount", "tax_rate", "tax_amount", "total_amount",
        )),
    }
    return hashlib.sha256(json.dumps(fields, sort_keys=True, default=str, ensure_ascii=False).encode()).hexdigest()


def run_is_current(run):
    return bool(run and run.rule_set_version == RULE_SET_VERSION and
                run.source_fingerprint == fingerprint(run.invoice))


@transaction.atomic
def check_input_invoice(invoice, request, *, trigger_type="MANUAL"):
    invoice = models.TaxInvoice.objects.select_for_update().select_related("company", "currency").get(pk=invoice.pk)
    if invoice.direction != "INPUT" or invoice.status not in {"RECEIVED", "VALIDATED", "BLOCKED"}:
        raise ValidationError("Chỉ kiểm tra hóa đơn đầu vào đã tiếp nhận.")
    fp = fingerprint(invoice)
    source = models.TaxInvoiceSourceFile.objects.filter(invoice=invoice).first()
    checks = []

    def add(code, severity, result, message, *, required=False, source_name="INTERNAL"):
        checks.append(dict(code=code, severity=severity, result=result, message=message,
                           required=required, source=source_name))

    parsed = None
    if source:
        try:
            parsed = parse_xml(bytes(source.content))
            add("XML-01", "INFO", "PASS", "Đọc được file XML gốc của hóa đơn.", required=True)
        except ValidationError:
            add("XML-01", "ERROR", "FAIL", "File XML gốc không thể phân tích cú pháp.", required=True)
    else:
        add("XML-01", "WARNING", "NOT_CHECKED", "Chưa có file XML gốc để kiểm tra.", required=True)

    missing = [name for value, name in ((invoice.invoice_series, "ký hiệu"), (invoice.invoice_number, "số hóa đơn"),
              (invoice.seller_tax_code, "MST người bán"), (invoice.seller_name, "tên người bán"),
              (invoice.buyer_name, "tên người mua")) if not value]
    add("INV-IDENTITY-01", "ERROR" if missing else "INFO", "FAIL" if missing else "PASS",
        "Thiếu " + ", ".join(missing) + "." if missing else "Thông tin định danh bắt buộc đã có.", required=True)

    if invoice.buyer_tax_code:
        matches = invoice.buyer_tax_code.strip() == invoice.company.tax_code.strip()
        add("INV-BUYER-01", "ERROR" if not matches else "INFO", "FAIL" if not matches else "PASS",
            "MST người mua khác doanh nghiệp đang làm việc." if not matches else "MST người mua khớp doanh nghiệp.", required=True)
    else:
        add("INV-BUYER-01", "WARNING", "NOT_CHECKED", "Thiếu MST người mua; cần kiểm tra thủ công.", required=True)

    if parsed:
        match = (parsed["invoice_series"].strip() == invoice.invoice_series.strip() and
                 parsed["invoice_number"].strip() == invoice.invoice_number.strip() and
                 parsed["supplier_tax_code"].strip() == invoice.seller_tax_code.strip() and
                 parsed["invoice_date"] == str(invoice.invoice_date))
        add("XML-05", "ERROR" if not match else "INFO", "FAIL" if not match else "PASS",
            "Dữ liệu định danh đã lưu khác XML gốc." if not match else "Dữ liệu định danh khớp XML gốc.", required=True)
    else:
        add("XML-05", "WARNING", "NOT_CHECKED", "Chưa đối chiếu được dữ liệu đã lưu với XML gốc.", required=True)

    lines = list(invoice.lines.order_by("line_no"))
    source_line_count = invoice.raw_data.get("parsed_line_count")
    if not lines or (source_line_count is not None and source_line_count != len(lines)):
        add("INV-LINES-01", "WARNING", "NOT_CHECKED", "Một số dòng thiếu dữ liệu chuẩn hóa; cần kiểm tra thủ công.", required=True)
    else:
        add("INV-LINES-01", "INFO", "PASS", f"Đã đọc {len(lines)} dòng hóa đơn.", required=True)
    tolerance = Decimal("1") if invoice.currency.code == "VND" else Decimal("0.01")
    if lines and (source_line_count is None or source_line_count == len(lines)):
        subtotal = sum((line.taxable_amount for line in lines), Decimal("0"))
        tax_total = sum((line.tax_amount for line in lines), Decimal("0"))
        amount_ok = (abs(invoice.subtotal - subtotal) <= tolerance and
                     abs(invoice.tax_amount - tax_total) <= tolerance and
                     abs(invoice.total_amount - invoice.subtotal - invoice.tax_amount) <= tolerance)
        add("INV-AMOUNT-01", "INFO" if amount_ok else "ERROR", "PASS" if amount_ok else "FAIL",
            "Tổng tiền khớp chi tiết trong ngưỡng làm tròn." if amount_ok else "Tổng tiền hóa đơn không khớp chi tiết.", required=True)
        for line in lines:
            expected = (line.taxable_amount * line.tax_rate / Decimal("100"))
            tax_ok = abs(expected - line.tax_amount) <= tolerance
            add(f"INV-TAX-LINE-{line.line_no}", "INFO" if tax_ok else "ERROR", "PASS" if tax_ok else "FAIL",
                f"Dòng {line.line_no}: tiền thuế {'khớp' if tax_ok else 'không khớp'} thuế suất trong ngưỡng làm tròn.",
                required=True)
    else:
        add("INV-AMOUNT-01", "WARNING", "NOT_CHECKED", "Chưa đủ chi tiết để đối chiếu tổng tiền.", required=True)

    duplicate = models.TaxInvoice.objects.filter(
        company=invoice.company, direction="INPUT", seller_tax_code=invoice.seller_tax_code,
        invoice_series=invoice.invoice_series, invoice_number=invoice.invoice_number,
    ).exclude(pk=invoice.pk).exists()
    add("DUP-01", "ERROR" if duplicate else "INFO", "FAIL" if duplicate else "PASS",
        "Phát hiện bản ghi khác cùng bộ định danh hóa đơn." if duplicate else "Không phát hiện bản ghi trùng bộ định danh.", required=True)

    add("SIGN-01", "WARNING", "NOT_CHECKED", "Chưa có dịch vụ xác minh chữ ký số; không kết luận chữ ký hợp lệ.", required=True)
    add("SUPPLIER-01", "INFO", "NOT_CHECKED", "Chưa có nguồn tra cứu tình trạng MST người bán.")
    add("RISK-01", "INFO", "NOT_CHECKED", "Chưa có nguồn rủi ro nhà cung cấp được cấu hình.")
    failed = any(row["required"] and row["result"] == "FAIL" for row in checks)
    pending = any(row["required"] and row["result"] == "NOT_CHECKED" for row in checks)
    warned = any(row["result"] == "WARNING" for row in checks)
    overall = "FAILED" if failed else "MANUAL_REVIEW" if pending else "WARNING" if warned else "PASSED"

    run = models.InvoiceValidationRun.objects.create(
        invoice=invoice, rule_set_version=RULE_SET_VERSION, source_fingerprint=fp,
        trigger_type=trigger_type, run_status="COMPLETED", overall_status=overall,
        completed_at=timezone.now(), triggered_by=services.actor(request),
    )
    models.InvoiceValidation.objects.bulk_create([
        models.InvoiceValidation(invoice=invoice, run=run, code=row["code"], severity=row["severity"],
                                 result=row["result"], message=row["message"], source=row["source"])
        for row in checks
    ])
    old_status = invoice.status
    invoice.status = "BLOCKED" if overall == "FAILED" else "VALIDATED" if overall in {"PASSED", "WARNING"} else "RECEIVED"
    invoice.tax_eligible = False
    invoice.duplicate_suspected = duplicate
    invoice.validation_summary = {
        "processing_status": overall, "run_id": str(run.id), "rule_set_version": RULE_SET_VERSION,
        "errors": sum(row["result"] == "FAIL" for row in checks),
        "warnings": sum(row["result"] == "WARNING" for row in checks),
        "not_checked": sum(row["result"] == "NOT_CHECKED" for row in checks),
    }
    invoice.save(update_fields=("status", "tax_eligible", "duplicate_suspected", "validation_summary", "updated_at"))
    models.InvoiceStatusHistory.objects.create(invoice=invoice, from_status=old_status, to_status=invoice.status,
                                                reason=f"UC-TAX-02: {overall}", actor=services.actor(request))
    services.audit(request, invoice, "VALIDATE_INPUT", before={"status": old_status},
                   after={"run_id": str(run.id), "processing_status": overall, "source_fingerprint": fp})
    return run
