"""UC-TAX-01: receive an XML invoice without validating or posting it."""

import hashlib
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from organization.models import Branch, Company
from purchases.input_invoice_services import parse_xml, read_upload

from . import models, services


def _decimal(value, field):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise ValidationError({field: "Giá trị tiền trong XML không hợp lệ."})
    if not result.is_finite() or result < 0:
        raise ValidationError({field: "Giá trị tiền trong XML không hợp lệ."})
    return result


def receive_input_xml(request):
    company = Company.objects.filter(pk=request.data.get("company")).select_related("accounting_currency").first()
    branch = Branch.objects.filter(pk=request.data.get("branch"), company=company, status="ACTIVE").first()
    if not company or not branch:
        raise ValidationError("Doanh nghiệp hoặc chi nhánh không hợp lệ.")
    upload = request.FILES.get("file")
    content = read_upload(upload, xml=True)
    parsed = parse_xml(content)
    root = ElementTree.fromstring(content)
    tags = {node.tag.rsplit("}", 1)[-1] for node in root.iter() if (node.text or "").strip()}
    required_amounts = (
        ({"TgTCThue", "TgTTTruocThue"}, "Tổng tiền trước thuế"),
        ({"TgTThue"}, "Tổng tiền thuế"),
        ({"TgTTTBSo", "TgTThanhToan"}, "Tổng thanh toán"),
    )
    absent_amounts = [label for choices, label in required_amounts if not tags.intersection(choices)]
    if absent_amounts:
        raise ValidationError("XML thiếu giá trị tiền bắt buộc: " + ", ".join(absent_amounts) + ".")
    for line_no, node in enumerate((node for node in root.iter() if node.tag.rsplit("}", 1)[-1] == "HHDVu"), 1):
        line_tags = {child.tag.rsplit("}", 1)[-1] for child in node.iter() if (child.text or "").strip()}
        if not line_tags.intersection({"ThTien", "TTruocThue"}) or "TThue" not in line_tags:
            raise ValidationError(f"Dòng {line_no} thiếu tiền trước thuế hoặc tiền thuế trong XML.")
    required = {
        "invoice_series": "Ký hiệu hóa đơn",
        "invoice_number": "Số hóa đơn",
        "seller_name": "Tên người bán",
        "supplier_tax_code": "Mã số thuế người bán",
        "buyer_name": "Tên người mua",
    }
    missing = [label for key, label in required.items() if not str(parsed.get(key) or "").strip()]
    if missing:
        raise ValidationError("XML thiếu thông tin bắt buộc: " + ", ".join(missing) + ".")
    if not parsed["lines"]:
        raise ValidationError("XML chưa có dòng hàng hóa, dịch vụ.")
    # Parsed amounts are intake data only. UC-TAX-02 checks consistency and legal validity.
    subtotal = _decimal(parsed["subtotal"], "subtotal")
    tax = _decimal(parsed["tax_amount"], "tax_amount")
    total = _decimal(parsed["total_amount"], "total_amount")
    identity = dict(company=company, direction="INPUT",
                    seller_tax_code=parsed["supplier_tax_code"].strip(),
                    invoice_series=parsed["invoice_series"].strip(),
                    invoice_number=parsed["invoice_number"].strip())
    existing = models.TaxInvoice.objects.filter(**identity).first()
    if existing:
        return existing, True
    review = []
    if parsed["buyer_tax_code"] and company.tax_code and parsed["buyer_tax_code"] != company.tax_code:
        review.append("Mã số thuế người mua khác doanh nghiệp đang làm việc.")
    lines = []
    for row in parsed["lines"]:
        if not row["tracks_quantity"]:
            review.append(f"Dòng {row['line_no']} thiếu số lượng hoặc đơn giá; cần kiểm tra thủ công.")
            continue
        try:
            quantity = Decimal(str(row["quantity"]))
            price = Decimal(str(row["unit_price"]))
            rate = Decimal(str(row["tax_rate_percent"])) if row["tax_rate_percent"] is not None else None
            if quantity <= 0 or price < 0 or rate is None or rate < 0:
                raise ValueError()
            lines.append(dict(line_no=row["line_no"], description=row["description"],
                              quantity=quantity, unit_price=price,
                              discount_amount=_decimal(row["discount_amount"], "discount_amount"),
                              taxable_amount=_decimal(row["taxable_amount"], "taxable_amount"),
                              tax_rate=rate, tax_amount=_decimal(row["tax_amount"], "tax_amount"),
                              total_amount=_decimal(row["total_amount"], "total_amount")))
        except (InvalidOperation, TypeError, ValueError):
            review.append(f"Dòng {row['line_no']} cần kiểm tra thủ công; dữ liệu gốc vẫn được lưu.")
    file_hash = hashlib.sha256(content).hexdigest()
    try:
        with transaction.atomic():
            invoice = models.TaxInvoice.objects.create(
                **identity, branch=branch, invoice_date=parsed["invoice_date"],
                seller_name=parsed["seller_name"], buyer_name=parsed["buyer_name"],
                buyer_tax_code=parsed["buyer_tax_code"], currency=company.accounting_currency,
                subtotal=subtotal, tax_amount=tax, total_amount=total,
                source="FILE", source_reference=upload.name[:150],
                raw_data={"invoice_template": parsed["invoice_template"], "sha256": file_hash,
                          "source_kind": "UPLOAD", "parsed_line_count": len(parsed["lines"]),
                          "parsed_lines": [{"line_no": row["line_no"], "description": row["description"],
                                            "taxable_amount": row["taxable_amount"], "tax_amount": row["tax_amount"]}
                                           for row in parsed["lines"]]},
                status="RECEIVED", tax_eligible=False,
                validation_summary={"processing_status": "NEEDS_REVIEW" if review else "PENDING_CHECK",
                                    "intake_warnings": review},
                created_by=services.actor(request),
            )
            models.TaxInvoiceLine.objects.bulk_create(
                [models.TaxInvoiceLine(invoice=invoice, **line) for line in lines]
            )
            models.TaxInvoiceSourceFile.objects.create(
                invoice=invoice, filename=upload.name[:255], content=content,
                sha256=file_hash, size=len(content),
            )
            models.InvoiceStatusHistory.objects.create(
                invoice=invoice, from_status="", to_status="RECEIVED",
                reason="Tiếp nhận XML; chờ kiểm tra nghiệp vụ", actor=services.actor(request),
            )
            services.audit(request, invoice, "RECEIVE", after={
                "invoice_number": invoice.invoice_number, "sha256": file_hash,
                "source": "UPLOAD", "processing_status": invoice.validation_summary["processing_status"],
            })
    except IntegrityError:
        existing = models.TaxInvoice.objects.filter(**identity).first()
        if existing:
            return existing, True
        raise
    return invoice, False
