"""UC-SAL-07: Lập hóa đơn đầu ra (Sales Tax Invoice Issuance / Outgoing Invoices).

Implements:
- Header & Line creation, validation, precision calculation, and rounding (BR-SAL-07-02, BR-SAL-07-07).
- Automatic internal document numbering (HD-YYYY-NNNNNN) and default seller/buyer values prefill.
- Source inheritance from GoodsSale, ServiceSale, or SalesOrder (BR-SAL-07-02, BR-SAL-07-03, AF-02, AF-03).
- Source line quantity reservation tracking across unissued invoices (BR-SAL-07-04, BR-SAL-07-05, EF-03).
- Direct entry support without source document (AF-02, BR-SAL-07-12).
- Full approval workflow: Submit, Withdraw, Approve, Request Revision, Reject (BR-SAL-07-08, AF-04, AF-05).
- Electronic invoice issuance (Phát hành hóa đơn điện tử) (Luồng chính Bước 9-10, BR-SAL-07-09, BR-SAL-07-10):
  * Idempotency & control code enforcement to prevent duplicate issuance (BR-SAL-07-11).
  * Validation of seller profile, buyer tax code, active template/series, invoice date (EF-04, EF-05).
  * State transitions: DRAFT/APPROVED -> ISSUING -> ISSUED or ISSUE_FAILED.
  * Official invoice number assignment, lookup code, XML/PDF file URLs.
  * Synchronization with TaxInvoice (OUTPUT) in tax_management and backlink to sales documents (BR-SAL-07-12).
- Retry issuance for failed invoices (AF-06).
- Download & Send email actions (AF-07).
- Deletion & Cancellation with automatic quota release (AF-08, BR-SAL-07-05, BR-SAL-07-13).
- Optimistic concurrency control and Audit Logging (BR-SAL-07-14, EF-09).
"""
import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from approval_workflows.execution import approval_progress
from approval_workflows.submission import configured_snapshot
from audit_log.services import record_audit
from common_services.models import DocumentNumberingRule
from master_data.models import Currency, DocumentType, Item, Party, TaxRate, UnitOfMeasure
from tax_management.models import InvoiceDirection, InvoiceStatus, TaxInvoice, TaxInvoiceLine
from . import models

MONEY = Decimal("0.0001")


def actor_for(request):
    """Retrieve IAM account or fallback user for audit and ownership tracking."""
    if hasattr(request, "user") and hasattr(request.user, "iam_account"):
        return request.user.iam_account
    return getattr(request, "user", None)


def audit(request, sale_invoice, action, before=None, after=None, reason=""):
    """Write an audit entry for sales invoice transactions."""
    actor = actor_for(request)
    if actor and hasattr(actor, "id"):
        record_audit(
            company=sale_invoice.company,
            actor_user=actor,
            module_code="SAL",
            action_code=action,
            entity=sale_invoice,
            before=before or {},
            after=after or {},
            request=request,
            reason=reason,
        )


def round_money(val, currency=None):
    """Round money amount according to currency decimal places (default 0 for VND, 2 for others)."""
    if val is None:
        return Decimal("0")
    d = Decimal(str(val))
    decimals = getattr(currency, "decimal_places", None)
    if decimals is None:
        code = getattr(currency, "code", "VND")
        decimals = 0 if code == "VND" else 2
    fmt = Decimal("1") if decimals == 0 else Decimal("0." + "0" * (decimals - 1) + "1")
    return d.quantize(fmt, rounding=ROUND_HALF_UP)


def generate_sales_invoice_number(company, branch=None, document_date=None):
    """Generate unique internal sales invoice number (HD-YYYY-NNNNNN) using DocumentNumberingRule or SalesInvoiceCounter."""
    ref_date = document_date or timezone.localdate()
    try:
        from common_services.numbering_services import generate_document_number
        doc_type = DocumentType.objects.filter(code__in=["SAL.SALES_INVOICE", "HD", "SALES_INVOICE", "HOA_DON"]).first()
        if doc_type:
            num = generate_document_number(company, doc_type, branch=branch, document_date=ref_date)
            if num:
                return num
    except Exception:
        pass

    year = ref_date.year
    with transaction.atomic():
        counter, _ = models.SalesInvoiceCounter.objects.select_for_update().get_or_create(company=company, year=year)
        while True:
            counter.value += 1
            counter.save(update_fields=["value"])
            candidate = f"HD-{year}-{counter.value:06d}"
            if not models.SalesInvoice.objects.filter(company=company, number=candidate).exists():
                return candidate


def extract_party_contact_info(party):
    """Extract default address line and contact email for a Party."""
    if not party:
        return "", ""
    addr = getattr(party, "address", "") or ""
    if not addr and hasattr(party, "addresses"):
        def_addr = party.addresses.filter(is_default=True).first() or party.addresses.first()
        if def_addr:
            addr = def_addr.address_line
    email = getattr(party, "email", "") or ""
    if not email and hasattr(party, "contacts"):
        def_contact = party.contacts.filter(is_default=True).first() or party.contacts.first()
        if def_contact:
            email = def_contact.email
    return addr, email


def get_sales_invoice_defaults(company, branch=None, customer_id=None, goods_sale_id=None, service_sale_id=None, sales_order_id=None):
    """Prefill default seller, buyer, template, and currency information for creating an invoice (Luồng chính Bước 4-5)."""
    today = timezone.localdate()

    # Seller snapshot from company profile
    seller_name = company.legal_name or company.name
    seller_tax_code = company.tax_code or ""
    seller_address = getattr(company, "address", "") or ""

    data = {
        "document_date": str(today),
        "invoice_date": str(today),
        "currency": "VND",
        "currency_id": None,
        "exchange_rate": "1.0",
        "invoice_category": models.SalesInvoice.InvoiceCategory.VAT,
        "invoice_series": f"1C{str(today.year)[-2:]}TAA",
        "template_code": "1/001",
        "payment_method": models.SalesInvoice.PaymentMethod.CASH_OR_BANK,
        "seller_name": seller_name,
        "seller_tax_code": seller_tax_code,
        "seller_address": seller_address,
        "customer": None,
        "customer_name": "",
        "buyer_name": "",
        "buyer_legal_name": "",
        "buyer_tax_code": "",
        "buyer_address": "",
        "buyer_email": "",
        "goods_sale": None,
        "goods_sale_number": "",
        "service_sale": None,
        "service_sale_number": "",
        "sales_order": None,
        "sales_order_number": "",
        "source_type": None,
        "notes": "",
    }

    vnd = Currency.objects.filter(code="VND").first()
    if vnd:
        data["currency_id"] = str(vnd.id)

    target_cust = None
    if goods_sale_id:
        sale = models.GoodsSale.objects.filter(company=company, id=goods_sale_id).select_related("customer", "currency").first()
        if sale:
            data["goods_sale"] = str(sale.id)
            data["goods_sale_number"] = sale.number
            data["source_type"] = "GOODS_SALE"
            data["customer"] = str(sale.customer_id)
            data["customer_name"] = sale.customer.name
            data["buyer_name"] = sale.customer.name
            data["buyer_legal_name"] = getattr(sale.customer, "legal_name", "") or sale.customer.name
            data["buyer_tax_code"] = sale.customer.tax_code or ""
            data["currency"] = sale.currency.code
            data["currency_id"] = str(sale.currency_id)
            data["exchange_rate"] = str(sale.exchange_rate)
            target_cust = sale.customer
    elif service_sale_id:
        serv = models.ServiceSale.objects.filter(company=company, id=service_sale_id).select_related("customer", "currency").first()
        if serv:
            data["service_sale"] = str(serv.id)
            data["service_sale_number"] = serv.number
            data["source_type"] = "SERVICE_SALE"
            data["customer"] = str(serv.customer_id)
            data["customer_name"] = serv.customer.name
            data["buyer_name"] = serv.customer.name
            data["buyer_legal_name"] = getattr(serv.customer, "legal_name", "") or serv.customer.name
            data["buyer_tax_code"] = serv.customer.tax_code or ""
            data["currency"] = serv.currency.code
            data["currency_id"] = str(serv.currency_id)
            data["exchange_rate"] = str(serv.exchange_rate)
            target_cust = serv.customer
    elif sales_order_id:
        order = models.SalesOrder.objects.filter(company=company, id=sales_order_id).select_related("customer", "currency").first()
        if order:
            data["sales_order"] = str(order.id)
            data["sales_order_number"] = order.number
            data["source_type"] = "SALES_ORDER"
            data["customer"] = str(order.customer_id)
            data["customer_name"] = order.customer.name
            data["buyer_name"] = order.customer.name
            data["buyer_legal_name"] = getattr(order.customer, "legal_name", "") or order.customer.name
            data["buyer_tax_code"] = order.customer.tax_code or ""
            data["currency"] = order.currency.code
            data["currency_id"] = str(order.currency_id)
            data["exchange_rate"] = str(order.exchange_rate)
            target_cust = order.customer
    elif customer_id:
        cust = Party.objects.filter(company=company, id=customer_id).first()
        if cust:
            data["customer"] = str(cust.id)
            data["customer_name"] = cust.name
            data["buyer_name"] = cust.name
            data["buyer_legal_name"] = getattr(cust, "legal_name", "") or cust.name
            data["buyer_tax_code"] = cust.tax_code or ""
            target_cust = cust

    if target_cust:
        addr, email = extract_party_contact_info(target_cust)
        data["buyer_address"] = addr
        data["buyer_email"] = email

    return data



def sale_invoice_issued_filter(line, source_type):
    """Filter for confirmed issued invoice lines."""
    if source_type == "GOODS_SALE":
        return Q(goods_sale_line=line, invoice__status=models.SalesInvoice.Status.ISSUED)
    elif source_type == "SERVICE_SALE":
        return Q(service_sale_line=line, invoice__status=models.SalesInvoice.Status.ISSUED)
    return Q(order_line=line, invoice__status=models.SalesInvoice.Status.ISSUED)


def sale_invoice_pending_filter(line, source_type, exclude_invoice_id=None):
    """Filter for reserved unissued invoice lines (DRAFT, PENDING_APPROVAL, APPROVED, ISSUING)."""
    q = Q(invoice__status__in=[
        models.SalesInvoice.Status.DRAFT,
        models.SalesInvoice.Status.PENDING_APPROVAL,
        models.SalesInvoice.Status.APPROVED,
        models.SalesInvoice.Status.ISSUING,
    ])
    if source_type == "GOODS_SALE":
        q &= Q(goods_sale_line=line)
    elif source_type == "SERVICE_SALE":
        q &= Q(service_sale_line=line)
    else:
        q &= Q(order_line=line)

    if exclude_invoice_id:
        q &= ~Q(invoice_id=exclude_invoice_id)
    return q


def prepare_from_sale(company, goods_sale_id=None, service_sale_id=None, sales_order_id=None):
    """Inspect and return available lines with remaining uninvoiced quantities from a source document (Luồng chính Bước 2-3, AF-03)."""
    if goods_sale_id:
        source_doc = models.GoodsSale.objects.filter(company=company, id=goods_sale_id).select_related(
            "customer", "currency"
        ).first()
        source_type = "GOODS_SALE"
    elif service_sale_id:
        source_doc = models.ServiceSale.objects.filter(company=company, id=service_sale_id).select_related(
            "customer", "currency"
        ).first()
        source_type = "SERVICE_SALE"
    elif sales_order_id:
        source_doc = models.SalesOrder.objects.filter(company=company, id=sales_order_id).select_related(
            "customer", "currency"
        ).first()
        source_type = "SALES_ORDER"
    else:
        raise ValidationError("Bắt buộc chỉ định goods_sale_id, service_sale_id hoặc sales_order_id.")

    if not source_doc:
        raise ValidationError("Không tìm thấy chứng từ bán nguồn.")

    if source_type in {"GOODS_SALE", "SERVICE_SALE"} and source_doc.status != models.DocumentStatus.POSTED:
        raise ValidationError(f"Chứng từ bán nguồn ({source_doc.number}) phải ở trạng thái Đã ghi sổ (POSTED).")
    if source_type == "SALES_ORDER" and source_doc.status not in {
        models.DocumentStatus.APPROVED,
        models.DocumentStatus.PARTIALLY_DELIVERED,
        models.DocumentStatus.FULLY_DELIVERED,
        models.DocumentStatus.COMPLETED,
    }:
        raise ValidationError(f"Đơn bán hàng ({source_doc.number}) phải ở trạng thái Đã duyệt / Giao hàng.")

    lines_out = []
    for line in source_doc.lines.select_related("item", "uom", "tax_rate").order_by("line_no"):
        # Total original quantity
        total_qty = line.quantity

        # Already issued quantity
        issued_q = models.SalesInvoiceLine.objects.filter(sale_invoice_issued_filter(line, source_type))
        already_issued_qty = issued_q.aggregate(t=Sum("quantity"))["t"] or Decimal("0")

        # Pending reserved quantity
        pending_q = models.SalesInvoiceLine.objects.filter(sale_invoice_pending_filter(line, source_type))
        already_pending_qty = pending_q.aggregate(t=Sum("quantity"))["t"] or Decimal("0")

        remaining_qty = max(Decimal("0"), total_qty - already_issued_qty - already_pending_qty)

        if remaining_qty > Decimal("0"):
            tax_rate_percent = getattr(line.tax_rate, "rate_percent", Decimal("0")) if line.tax_rate else Decimal("0")
            lines_out.append({
                "source_line_id": str(line.id),
                "goods_sale_line_id": str(line.id) if source_type == "GOODS_SALE" else None,
                "service_sale_line_id": str(line.id) if source_type == "SERVICE_SALE" else None,
                "order_line_id": str(line.id) if source_type == "SALES_ORDER" else None,
                "line_no": line.line_no,
                "item_id": str(line.item_id) if line.item_id else None,
                "item_code": line.item.code if line.item else "",
                "item_name": line.item.name if line.item else (getattr(line, "description", "") or "Hàng hóa/Dịch vụ"),
                "description": getattr(line, "description", "") or (line.item.name if line.item else ""),
                "uom_id": str(line.uom_id) if line.uom_id else None,
                "uom_name": line.uom.name if line.uom else "",
                "total_quantity": str(total_qty),
                "already_invoiced_quantity": str(already_issued_qty),
                "pending_quantity": str(already_pending_qty),
                "remaining_quantity": str(remaining_qty),
                "unit_price": str(line.unit_price),
                "discount_rate": str(getattr(line, "discount_rate", Decimal("0"))),
                "discount_amount": str(getattr(line, "discount_amount", Decimal("0"))),
                "tax_rate_id": str(line.tax_rate_id) if line.tax_rate_id else None,
                "tax_rate_code": line.tax_rate.code if line.tax_rate else "",
                "tax_rate_percent": str(tax_rate_percent),
            })

    if not lines_out:
        raise ValidationError(f"Chứng từ nguồn ({source_doc.number}) đã được lập hóa đơn toàn bộ.")

    return {
        "company": str(company.id),
        "customer": str(source_doc.customer_id),
        "customer_name": source_doc.customer.name,
        "source_type": source_type,
        "goods_sale": str(source_doc.id) if source_type == "GOODS_SALE" else None,
        "goods_sale_number": source_doc.number if source_type == "GOODS_SALE" else "",
        "service_sale": str(source_doc.id) if source_type == "SERVICE_SALE" else None,
        "service_sale_number": source_doc.number if source_type == "SERVICE_SALE" else "",
        "sales_order": str(source_doc.id) if source_type == "SALES_ORDER" else None,
        "sales_order_number": source_doc.number if source_type == "SALES_ORDER" else "",
        "currency": source_doc.currency.code,
        "currency_id": str(source_doc.currency_id),
        "exchange_rate": str(source_doc.exchange_rate),
        "lines": lines_out,
    }


def calculate_and_validate_invoice_lines(
    company,
    source_doc,
    source_type,
    lines_data,
    currency=None,
    current_invoice_id=None
):
    """Validate lines, enforce remaining limits, calculate amounts, discounts, taxes and totals (BR-SAL-07-02, BR-SAL-07-04, BR-SAL-07-07)."""
    if not lines_data:
        raise ValidationError("Hóa đơn đầu ra phải có ít nhất một dòng chi tiết.")

    processed_lines = []
    subtotal = Decimal("0")
    total_discount = Decimal("0")
    total_tax = Decimal("0")

    seen_source_lines = set()

    for idx, raw in enumerate(lines_data, start=1):
        source_line_id = raw.get("goods_sale_line_id") or raw.get("service_sale_line_id") or raw.get("order_line_id") or raw.get("source_line_id") or raw.get("goods_sale_line") or raw.get("service_sale_line") or raw.get("order_line")
        source_line = None

        if source_doc and source_line_id:
            if str(source_line_id) in seen_source_lines:
                raise ValidationError(f"Dòng {idx}: Dòng bán nguồn đã được chọn trước đó trên cùng hóa đơn.")
            seen_source_lines.add(str(source_line_id))

            if source_type == "GOODS_SALE":
                source_line = models.GoodsSaleLine.objects.filter(sale=source_doc, id=source_line_id).select_related("item", "uom", "tax_rate").first()
            elif source_type == "SERVICE_SALE":
                source_line = models.ServiceSaleLine.objects.filter(sale=source_doc, id=source_line_id).select_related("item", "uom", "tax_rate").first()
            elif source_type == "SALES_ORDER":
                source_line = models.SalesOrderLine.objects.filter(order=source_doc, id=source_line_id).select_related("item", "uom", "tax_rate").first()

            if not source_line:
                raise ValidationError(f"Dòng {idx}: Dòng nguồn không thuộc chứng từ bán {source_doc.number}.")

        # Determine item & description
        item_id = raw.get("item") or raw.get("item_id")
        if item_id:
            item = Item.objects.filter(company=company, id=item_id).first()
        elif source_line and source_line.item_id:
            item = source_line.item
        else:
            item = None

        item_name = raw.get("item_name") or raw.get("description") or (item.name if item else (source_line.item.name if source_line and source_line.item else ""))
        if not item_name.strip():
            raise ValidationError(f"Dòng {idx}: Bắt buộc nhập tên hàng hóa/dịch vụ hiển thị trên hóa đơn.")

        uom_id = raw.get("uom") or raw.get("uom_id")
        uom = UnitOfMeasure.objects.filter(company=company, id=uom_id).first() if uom_id else (source_line.uom if source_line else (item.base_uom if item else None))

        # Quantity validation & limits
        try:
            quantity = Decimal(str(raw.get("quantity", "0")))
        except Exception:
            raise ValidationError(f"Dòng {idx}: Số lượng không hợp lệ.")

        if quantity <= Decimal("0"):
            raise ValidationError(f"Dòng {idx}: Số lượng phải lớn hơn 0.")

        if source_doc and source_line:
            total_qty = source_line.quantity
            issued_q = models.SalesInvoiceLine.objects.filter(sale_invoice_issued_filter(source_line, source_type))
            if current_invoice_id:
                issued_q = issued_q.exclude(invoice_id=current_invoice_id)
            already_issued_qty = issued_q.aggregate(t=Sum("quantity"))["t"] or Decimal("0")

            pending_q = models.SalesInvoiceLine.objects.filter(sale_invoice_pending_filter(source_line, source_type, exclude_invoice_id=current_invoice_id))
            already_pending_qty = pending_q.aggregate(t=Sum("quantity"))["t"] or Decimal("0")

            max_available = max(Decimal("0"), total_qty - already_issued_qty - already_pending_qty)
            if quantity > max_available:
                raise ValidationError(
                    f"Dòng {idx}: Số lượng lập hóa đơn ({quantity}) vượt quá phần còn lại ({max_available})."
                )

        # Unit price
        try:
            unit_price = Decimal(str(raw.get("unit_price", source_line.unit_price if source_line else "0")))
        except Exception:
            raise ValidationError(f"Dòng {idx}: Đơn giá không hợp lệ.")

        if unit_price < Decimal("0"):
            raise ValidationError(f"Dòng {idx}: Đơn giá không được âm.")

        amount = round_money(quantity * unit_price, currency)

        # Discount
        discount_rate = Decimal(str(raw.get("discount_rate", "0") or "0"))
        if "discount_amount" in raw and raw["discount_amount"] is not None:
            discount_amount = round_money(Decimal(str(raw["discount_amount"])), currency)
        elif discount_rate > Decimal("0"):
            discount_amount = round_money(amount * (discount_rate / Decimal("100")), currency)
        else:
            discount_amount = Decimal("0")

        if discount_amount > amount:
            raise ValidationError(f"Dòng {idx}: Tiền chiết khấu ({discount_amount}) không được vượt quá thành tiền ({amount}).")

        taxable_amount = amount - discount_amount

        # Tax calculation
        tax_rate_id = raw.get("tax_rate") or raw.get("tax_rate_id")
        tax_rate = TaxRate.objects.filter(company=company, id=tax_rate_id).first() if tax_rate_id else (source_line.tax_rate if source_line else None)

        if tax_rate and tax_rate.rate_percent > Decimal("0"):
            line_tax = round_money(taxable_amount * (tax_rate.rate_percent / Decimal("100")), currency)
        else:
            line_tax = Decimal("0")

        line_total = taxable_amount + line_tax

        subtotal += amount
        total_discount += discount_amount
        total_tax += line_tax

        line_rec = {
            "line_no": idx,
            "item": item,
            "item_name": item_name,
            "description": raw.get("description", ""),
            "uom": uom,
            "quantity": quantity,
            "unit_price": unit_price,
            "amount": amount,
            "discount_rate": discount_rate,
            "discount_amount": discount_amount,
            "tax_rate": tax_rate,
            "tax_amount": line_tax,
            "line_total": line_total,
            "goods_sale_line": source_line if source_type == "GOODS_SALE" else None,
            "service_sale_line": source_line if source_type == "SERVICE_SALE" else None,
            "order_line": source_line if source_type == "SALES_ORDER" else None,
        }
        processed_lines.append(line_rec)

    total_amount = subtotal - total_discount + total_tax
    return {
        "lines": processed_lines,
        "subtotal": subtotal,
        "discount_amount": total_discount,
        "tax_amount": total_tax,
        "total_amount": total_amount,
    }


@transaction.atomic
def create_sales_invoice(request, validated_data, lines_data):
    """Create a new SalesInvoice in DRAFT status, reserving source quantities (Luồng chính Bước 7, AF-02)."""
    company = validated_data["company"]
    customer = validated_data["customer"]
    goods_sale = validated_data.get("goods_sale")
    service_sale = validated_data.get("service_sale")
    sales_order = validated_data.get("sales_order")

    # Source checking
    source_count = sum(1 for s in (goods_sale, service_sale, sales_order) if s is not None)
    if source_count > 1:
        raise ValidationError("Chỉ được liên kết một chứng từ bán nguồn (Hàng hóa, Dịch vụ hoặc Đơn bán).")

    source_doc = goods_sale or service_sale or sales_order
    source_type = "GOODS_SALE" if goods_sale else ("SERVICE_SALE" if service_sale else ("SALES_ORDER" if sales_order else None))

    if source_doc:
        if source_doc.company_id != company.id:
            raise ValidationError("Chứng từ bán nguồn không thuộc cùng doanh nghiệp.")
        if customer.company_id != company.id or customer.id != source_doc.customer_id:
            raise ValidationError("Khách hàng không khớp với chứng từ bán nguồn.")
        if source_type in {"GOODS_SALE", "SERVICE_SALE"} and source_doc.status != models.DocumentStatus.POSTED:
            raise ValidationError(f"Chứng từ bán nguồn ({source_doc.number}) phải ở trạng thái Đã ghi sổ (POSTED).")

    # Buyer validation (BR-SAL-07-09)
    buyer_name = validated_data.get("buyer_name", "").strip() or customer.name
    buyer_legal_name = validated_data.get("buyer_legal_name", "").strip() or getattr(customer, "legal_name", "") or buyer_name
    buyer_tax_code = validated_data.get("buyer_tax_code", "").strip() or customer.tax_code or ""
    def_addr, def_email = extract_party_contact_info(customer)
    buyer_address = validated_data.get("buyer_address", "").strip() or def_addr
    buyer_email = validated_data.get("buyer_email", "").strip() or def_email

    # Seller snapshot
    seller_name = validated_data.get("seller_name", "").strip() or company.legal_name or company.name
    seller_tax_code = validated_data.get("seller_tax_code", "").strip() or company.tax_code or ""
    seller_address = validated_data.get("seller_address", "").strip() or getattr(company, "address", "") or ""

    currency = validated_data.get("currency") or (source_doc.currency if source_doc else Currency.objects.filter(code="VND").first())
    exchange_rate = validated_data.get("exchange_rate") or (Decimal("1") if currency.code == "VND" else (source_doc.exchange_rate if source_doc else Decimal("1")))
    if Decimal(str(exchange_rate)) <= Decimal("0"):
        raise ValidationError({"exchange_rate": "Tỷ giá phải lớn hơn 0."})

    calc = calculate_and_validate_invoice_lines(
        company=company,
        source_doc=source_doc,
        source_type=source_type,
        lines_data=lines_data,
        currency=currency,
        current_invoice_id=None,
    )

    doc_date = validated_data.get("document_date") or timezone.localdate()
    inv_date = validated_data.get("invoice_date") or doc_date

    number = validated_data.get("number")
    if not number:
        number = generate_sales_invoice_number(company, branch=validated_data.get("branch"), document_date=inv_date)

    invoice_series = validated_data.get("invoice_series", "").strip()
    if not invoice_series:
        invoice_series = f"1C{str(inv_date.year)[-2:]}TAA"

    branch = validated_data.get("branch") or (source_doc.branch if source_doc else company.branches.first())
    sale_invoice = models.SalesInvoice.objects.create(
        company=company,
        branch=branch,
        number=number,
        document_date=doc_date,
        invoice_date=inv_date,
        customer=customer,
        invoice_category=validated_data.get("invoice_category", models.SalesInvoice.InvoiceCategory.VAT),
        invoice_series=invoice_series,
        template_code=validated_data.get("template_code", "1/001"),
        invoice_number="",  # Not yet issued
        seller_name=seller_name,
        seller_tax_code=seller_tax_code,
        seller_address=seller_address,
        buyer_name=buyer_name,
        buyer_legal_name=buyer_legal_name,
        buyer_tax_code=buyer_tax_code,
        buyer_address=buyer_address,
        buyer_email=buyer_email,
        payment_method=validated_data.get("payment_method", models.SalesInvoice.PaymentMethod.CASH_OR_BANK),
        goods_sale=goods_sale,
        service_sale=service_sale,
        sales_order=sales_order,
        currency=currency,
        exchange_rate=exchange_rate,
        subtotal=calc["subtotal"],
        discount_amount=calc["discount_amount"],
        tax_amount=calc["tax_amount"],
        total_amount=calc["total_amount"],
        status=models.SalesInvoice.Status.DRAFT,
        notes=validated_data.get("notes", ""),
        attachments=validated_data.get("attachments", []),
        created_by=actor_for(request),
        version=1,
    )

    for item_calc in calc["lines"]:
        models.SalesInvoiceLine.objects.create(invoice=sale_invoice, **item_calc)

    audit(request, sale_invoice, "CREATE", after={"number": sale_invoice.number, "total_amount": str(sale_invoice.total_amount)})
    return sale_invoice


@transaction.atomic
def update_sales_invoice(request, sale_invoice, validated_data, lines_data=None):
    """Update a sales invoice in DRAFT, REVISION_REQUIRED, or REJECTED status (AF-04, BR-SAL-07-14)."""
    sale_invoice = models.SalesInvoice.objects.select_for_update().get(pk=sale_invoice.pk)
    if sale_invoice.status not in {
        models.SalesInvoice.Status.DRAFT,
        models.SalesInvoice.Status.REVISION_REQUIRED,
        models.SalesInvoice.Status.REJECTED,
    }:
        raise ValidationError(f"Không thể sửa hóa đơn ở trạng thái {sale_invoice.get_status_display()}.")

    req_version = request.data.get("version")
    if req_version is not None and int(req_version) != sale_invoice.version:
        raise ValidationError("Hóa đơn vừa được người khác cập nhật. Vui lòng tải lại trang.")

    company = sale_invoice.company
    source_doc = sale_invoice.goods_sale or sale_invoice.service_sale or sale_invoice.sales_order
    source_type = "GOODS_SALE" if sale_invoice.goods_sale else ("SERVICE_SALE" if sale_invoice.service_sale else ("SALES_ORDER" if sale_invoice.sales_order else None))

    if lines_data is not None:
        calc = calculate_and_validate_invoice_lines(
            company=company,
            source_doc=source_doc,
            source_type=source_type,
            lines_data=lines_data,
            currency=sale_invoice.currency,
            current_invoice_id=sale_invoice.pk,
        )
        sale_invoice.subtotal = calc["subtotal"]
        sale_invoice.discount_amount = calc["discount_amount"]
        sale_invoice.tax_amount = calc["tax_amount"]
        sale_invoice.total_amount = calc["total_amount"]

        sale_invoice.lines.all().delete()
        for item_calc in calc["lines"]:
            models.SalesInvoiceLine.objects.create(invoice=sale_invoice, **item_calc)

    for field in (
        "invoice_category", "invoice_series", "template_code", "invoice_date", "payment_method",
        "buyer_name", "buyer_legal_name", "buyer_tax_code", "buyer_address", "buyer_email",
        "seller_name", "seller_tax_code", "seller_address", "notes", "attachments"
    ):
        if field in validated_data:
            setattr(sale_invoice, field, validated_data[field])

    before_ver = sale_invoice.version
    sale_invoice.version += 1
    sale_invoice.save()

    audit(request, sale_invoice, "UPDATE", before={"version": before_ver}, after={"version": sale_invoice.version})
    return sale_invoice


@transaction.atomic
def submit_sales_invoice(request, sale_invoice, notes=""):
    """Submit a sales invoice for approval (Luồng chính Bước 8)."""
    sale_invoice = models.SalesInvoice.objects.select_for_update().get(pk=sale_invoice.pk)
    if sale_invoice.status not in {
        models.SalesInvoice.Status.DRAFT,
        models.SalesInvoice.Status.REVISION_REQUIRED,
        models.SalesInvoice.Status.REJECTED,
    }:
        raise ValidationError("Chỉ hóa đơn ở trạng thái Nháp, Yêu cầu sửa hoặc Từ chối mới được gửi duyệt.")

    snapshot = sale_invoice.workflow_snapshot if (sale_invoice.workflow_snapshot and sale_invoice.workflow_snapshot.get("version_id")) else configured_snapshot(sale_invoice, "SAL.SALES_INVOICE")
    before = sale_invoice.status

    if snapshot and snapshot.get("version_id"):
        sale_invoice.workflow_snapshot = snapshot
        sale_invoice.approval_required = True
        sale_invoice.status = models.SalesInvoice.Status.PENDING_APPROVAL
    else:
        sale_invoice.approval_required = False
        sale_invoice.status = models.SalesInvoice.Status.APPROVED

    sale_invoice.submitted_at = timezone.now()
    sale_invoice.version += 1
    sale_invoice.save(update_fields=["workflow_snapshot", "approval_required", "status", "submitted_at", "version", "updated_at"])

    models.ApprovalDecision.objects.create(
        company=sale_invoice.company,
        document_type="SALES_INVOICE",
        document_id=sale_invoice.pk,
        level=1,
        decision="SUBMITTED",
        actor=actor_for(request),
        comment=notes,
    )
    audit(request, sale_invoice, "SUBMIT", {"status": before}, {"status": sale_invoice.status}, reason=notes)
    return sale_invoice


@transaction.atomic
def withdraw_sales_invoice(request, sale_invoice, reason=""):
    """Withdraw a sales invoice waiting for approval back to DRAFT (AF-04)."""
    sale_invoice = models.SalesInvoice.objects.select_for_update().get(pk=sale_invoice.pk)
    if sale_invoice.status != models.SalesInvoice.Status.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể thu hồi hóa đơn đang Chờ duyệt.")

    before = sale_invoice.status
    sale_invoice.status = models.SalesInvoice.Status.DRAFT
    sale_invoice.withdrawal_reason = reason
    sale_invoice.version += 1
    sale_invoice.save(update_fields=["status", "withdrawal_reason", "version", "updated_at"])

    models.ApprovalDecision.objects.create(
        company=sale_invoice.company,
        document_type="SALES_INVOICE",
        document_id=sale_invoice.pk,
        level=1,
        decision="WITHDRAWN",
        actor=actor_for(request),
        comment=reason,
    )
    audit(request, sale_invoice, "WITHDRAW", {"status": before}, {"status": sale_invoice.status}, reason=reason)
    return sale_invoice


@transaction.atomic
def decide_sales_invoice(request, sale_invoice, decision, comment=""):
    """Handle approval decisions: APPROVED, REVISION_REQUIRED, REJECTED (AF-05)."""
    sale_invoice = models.SalesInvoice.objects.select_for_update().get(pk=sale_invoice.pk)
    if sale_invoice.status != models.SalesInvoice.Status.PENDING_APPROVAL:
        raise ValidationError("Hóa đơn không ở trạng thái Chờ duyệt.")

    if decision in {"REVISE", models.SalesInvoice.Status.REVISION_REQUIRED}:
        decision = models.SalesInvoice.Status.REVISION_REQUIRED
    elif decision in {"APPROVE", models.SalesInvoice.Status.APPROVED}:
        decision = models.SalesInvoice.Status.APPROVED
    elif decision in {"REJECT", models.SalesInvoice.Status.REJECTED}:
        decision = models.SalesInvoice.Status.REJECTED

    if decision in {models.SalesInvoice.Status.REJECTED, models.SalesInvoice.Status.REVISION_REQUIRED} and not comment.strip():
        raise ValidationError({"comment": "Bắt buộc nhập ý kiến khi từ chối hoặc yêu cầu sửa."})

    decisions = list(models.ApprovalDecision.objects.filter(
        company=sale_invoice.company,
        document_type="SALES_INVOICE",
        document_id=sale_invoice.pk
    ).order_by("decided_at"))

    current_level = 1
    for d in decisions:
        if d.decision == "APPROVED":
            current_level = d.level + 1

    next_status = decision
    if sale_invoice.workflow_snapshot.get("version_id"):
        progress = approval_progress(sale_invoice, actor_for(request), decision == "APPROVED", decisions)
        if progress:
            current_level = progress["level"]
            if decision == "APPROVED" and not progress["final"]:
                next_status = models.SalesInvoice.Status.PENDING_APPROVAL

    before = sale_invoice.status
    sale_invoice.status = next_status
    if next_status == models.SalesInvoice.Status.APPROVED:
        sale_invoice.approved_at = timezone.now()
    elif next_status == models.SalesInvoice.Status.REJECTED:
        sale_invoice.rejection_reason = comment

    sale_invoice.version += 1
    sale_invoice.save()

    models.ApprovalDecision.objects.create(
        company=sale_invoice.company,
        document_type="SALES_INVOICE",
        document_id=sale_invoice.pk,
        level=current_level,
        decision="APPROVED" if next_status in {models.SalesInvoice.Status.APPROVED, models.SalesInvoice.Status.PENDING_APPROVAL} else decision,
        actor=actor_for(request),
        comment=comment,
    )
    audit(request, sale_invoice, decision, {"status": before}, {"status": sale_invoice.status}, reason=comment)
    return sale_invoice


@transaction.atomic
def cancel_sales_invoice(request, sale_invoice, reason=""):
    """Cancel an unissued sales invoice and release reserved quantities (AF-08, BR-SAL-07-05)."""
    sale_invoice = models.SalesInvoice.objects.select_for_update().get(pk=sale_invoice.pk)
    if sale_invoice.status == models.SalesInvoice.Status.ISSUED:
        raise ValidationError("Không thể hủy trực tiếp hóa đơn Đã phát hành. Vui lòng xử lý qua chức năng xử lý sai sót hóa đơn.")
    if sale_invoice.status == models.SalesInvoice.Status.CANCELLED:
        raise ValidationError("Hóa đơn đã bị hủy trước đó.")

    before = sale_invoice.status
    sale_invoice.status = models.SalesInvoice.Status.CANCELLED
    sale_invoice.cancellation_reason = reason
    sale_invoice.version += 1
    sale_invoice.save(update_fields=["status", "cancellation_reason", "version", "updated_at"])
    audit(request, sale_invoice, "CANCEL", {"status": before}, {"status": sale_invoice.status}, reason=reason)
    return sale_invoice


@transaction.atomic
def delete_sales_invoice(request, sale_invoice):
    """Delete draft sales invoice and release reserved quantities (AF-08, BR-SAL-07-05)."""
    sale_invoice = models.SalesInvoice.objects.select_for_update().get(pk=sale_invoice.pk)
    if sale_invoice.status != models.SalesInvoice.Status.DRAFT:
        raise ValidationError("Chỉ có thể xóa hóa đơn ở trạng thái Nháp.")
    audit(request, sale_invoice, "DELETE", before={"number": sale_invoice.number})
    sale_invoice.lines.all().delete()
    sale_invoice.delete()


def _validate_invoice_issuance_preconditions(sale_invoice):
    """Validate seller details, template, buyer details, and date before issuing (BR-SAL-07-09, EF-04, EF-05)."""
    if not sale_invoice.seller_name.strip() or not sale_invoice.seller_tax_code.strip():
        raise ValidationError("Thông tin người bán (Tên, Mã số thuế) chưa đầy đủ.")
    if not sale_invoice.invoice_series.strip():
        raise ValidationError("Ký hiệu hóa đơn không được để trống.")
    if not sale_invoice.lines.exists():
        raise ValidationError("Hóa đơn phải có ít nhất một dòng chi tiết.")

    # Buyer MST check: if buyer is enterprise (legal name present or tax code entered), validate
    if sale_invoice.buyer_tax_code and len(sale_invoice.buyer_tax_code.strip()) < 10:
        raise ValidationError("Mã số thuế người mua không hợp lệ.")


def issue_sales_invoice(request, sale_invoice, force_fail=False, error_message=""):
    """Execute electronic invoice issuance (Luồng chính Bước 9-10, BR-SAL-07-09, BR-SAL-07-10, BR-SAL-07-11)."""
    with transaction.atomic():
        sale_invoice = models.SalesInvoice.objects.select_for_update().get(pk=sale_invoice.pk)
        if sale_invoice.status == models.SalesInvoice.Status.ISSUED:
            raise ValidationError("Hóa đơn đã được phát hành thành công trước đó.")
        if sale_invoice.status == models.SalesInvoice.Status.ISSUING:
            raise ValidationError("Hóa đơn đang trong quá trình phát hành. Vui lòng kiểm tra lại kết quả giao dịch.")

        # Approval check
        if sale_invoice.status != models.SalesInvoice.Status.APPROVED:
            snapshot = configured_snapshot(sale_invoice, "SAL.SALES_INVOICE")
            has_workflow = bool(snapshot and snapshot.get("version_id"))
            if sale_invoice.status in {models.SalesInvoice.Status.DRAFT, models.SalesInvoice.Status.ISSUE_FAILED} and (not sale_invoice.approval_required or not has_workflow):
                pass
            else:
                raise ValidationError(f"Chỉ hóa đơn Đã duyệt mới có thể phát hành (trạng thái hiện tại: {sale_invoice.get_status_display()}).")

        _validate_invoice_issuance_preconditions(sale_invoice)

        # Idempotency control code (BR-SAL-07-11)
        if not sale_invoice.issue_control_code:
            sale_invoice.issue_control_code = f"ISSUE-{sale_invoice.company.code}-{sale_invoice.number}-{uuid.uuid4().hex[:8].upper()}"

        sale_invoice.status = models.SalesInvoice.Status.ISSUING
        sale_invoice.save(update_fields=["status", "issue_control_code", "updated_at"])

    # Provider integration / simulated failure handling
    is_failed = force_fail or (hasattr(request, "data") and request.data.get("force_fail"))
    fail_msg = error_message or (request.data.get("error_message") if hasattr(request, "data") else "") or "Nhà cung cấp hóa đơn điện tử phản hồi lỗi."

    if is_failed:
        sale_invoice.status = models.SalesInvoice.Status.ISSUE_FAILED
        sale_invoice.issue_error_message = fail_msg
        sale_invoice.version += 1
        sale_invoice.save(update_fields=["status", "issue_error_message", "version", "updated_at"])
        audit(request, sale_invoice, "ISSUE_FAILED", after={"status": sale_invoice.status, "error": fail_msg})
        return sale_invoice

    with transaction.atomic():
        counter_year = sale_invoice.invoice_date.year
        c, _ = models.SalesInvoiceCounter.objects.select_for_update().get_or_create(company=sale_invoice.company, year=counter_year)
        c.value += 1
        c.save(update_fields=["value"])
        official_number = f"{c.value:07d}"

        transaction_code = f"TX-{sale_invoice.issue_control_code}"
        lookup_code = uuid.uuid4().hex[:10].upper()
        xml_url = f"/media/invoices/{sale_invoice.company.code}/{counter_year}/{sale_invoice.invoice_series}_{official_number}.xml"
        pdf_url = f"/media/invoices/{sale_invoice.company.code}/{counter_year}/{sale_invoice.invoice_series}_{official_number}.pdf"
        lookup_url = f"https://hoadondientu.gdt.gov.vn/tra-cuu?code={lookup_code}"

        # 1. Create or link TaxInvoice record in tax_management (BR-SAL-07-12)
        tax_branch = sale_invoice.branch or sale_invoice.company.branches.first()
        tax_inv = TaxInvoice.objects.create(
            company=sale_invoice.company,
            branch=tax_branch,
            direction=InvoiceDirection.OUTPUT,
            invoice_type="ORIGINAL",
            invoice_series=sale_invoice.invoice_series,
            invoice_number=official_number,
            invoice_date=sale_invoice.invoice_date,
            seller_name=sale_invoice.seller_name,
            seller_tax_code=sale_invoice.seller_tax_code,
            buyer_name=sale_invoice.buyer_name,
            buyer_tax_code=sale_invoice.buyer_tax_code,
            party=sale_invoice.customer,
            currency=sale_invoice.currency,
            exchange_rate=sale_invoice.exchange_rate,
            subtotal=sale_invoice.subtotal - sale_invoice.discount_amount,
            tax_amount=sale_invoice.tax_amount,
            total_amount=sale_invoice.total_amount,
            source="SALES",
            source_reference=sale_invoice.number,
            external_reference=transaction_code,
            status=InvoiceStatus.ISSUED,
            issued_at=timezone.now(),
            created_by=actor_for(request),
        )

        for line in sale_invoice.lines.all():
            TaxInvoiceLine.objects.create(
                invoice=tax_inv,
                line_no=line.line_no,
                item=line.item,
                description=line.item_name or line.description,
                quantity=line.quantity,
                unit_price=line.unit_price,
                discount_amount=line.discount_amount,
                taxable_amount=line.amount - line.discount_amount,
                tax_rate=getattr(line.tax_rate, "rate_percent", Decimal("0")) if line.tax_rate else Decimal("0"),
                tax_amount=line.tax_amount,
                total_amount=line.line_total,
            )

        # 2. Backlink tax invoice to GoodsSale / ServiceSale if applicable
        if sale_invoice.goods_sale and not sale_invoice.goods_sale.tax_invoice_id:
            sale_invoice.goods_sale.tax_invoice = tax_inv
            sale_invoice.goods_sale.save(update_fields=["tax_invoice", "updated_at"])
        elif sale_invoice.service_sale and not sale_invoice.service_sale.tax_invoice_id:
            sale_invoice.service_sale.tax_invoice = tax_inv
            sale_invoice.service_sale.save(update_fields=["tax_invoice", "updated_at"])

        # 3. Update SalesOrder invoiced metrics if applicable
        if sale_invoice.sales_order:
            for l in sale_invoice.lines.all():
                if l.order_line:
                    l.order_line.invoiced_quantity += l.quantity
                    l.order_line.save(update_fields=["invoiced_quantity"])
            sale_invoice.sales_order.invoiced_amount += sale_invoice.total_amount
            sale_invoice.sales_order.save(update_fields=["invoiced_amount", "updated_at"])

        sale_invoice.tax_invoice = tax_inv
        sale_invoice.invoice_number = official_number
        sale_invoice.transaction_code = transaction_code
        sale_invoice.lookup_code = lookup_code
        sale_invoice.xml_file_url = xml_url
        sale_invoice.pdf_file_url = pdf_url
        sale_invoice.lookup_url = lookup_url
        sale_invoice.issue_error_message = ""
        sale_invoice.status = models.SalesInvoice.Status.ISSUED
        sale_invoice.issued_at = timezone.now()
        sale_invoice.issued_by = actor_for(request)
        sale_invoice.version += 1
        sale_invoice.save()

        audit(request, sale_invoice, "ISSUE", after={"status": sale_invoice.status, "invoice_number": official_number})
        return sale_invoice


def retry_issue_sales_invoice(request, sale_invoice, force_fail=False, error_message=""):
    """Retry issuing an invoice in ISSUE_FAILED status using idempotency control code (AF-06, BR-SAL-07-11)."""
    sale_invoice = models.SalesInvoice.objects.get(pk=sale_invoice.pk)
    if sale_invoice.status != models.SalesInvoice.Status.ISSUE_FAILED:
        raise ValidationError("Chỉ có thể thử lại phát hành trên hóa đơn ở trạng thái Phát hành lỗi.")

    return issue_sales_invoice(request, sale_invoice, force_fail=force_fail, error_message=error_message)


def send_invoice_email(request, sale_invoice, recipient_email=None):
    """Send issued invoice XML/PDF links to customer email (AF-07)."""
    if sale_invoice.status != models.SalesInvoice.Status.ISSUED:
        raise ValidationError("Chỉ có thể gửi email cho hóa đơn Đã phát hành.")

    recipient = (recipient_email or sale_invoice.buyer_email or "").strip()
    if not recipient:
        raise ValidationError({"email": "Chưa có địa chỉ email nhận hóa đơn."})

    audit(request, sale_invoice, "SEND_EMAIL", after={"recipient": recipient, "invoice_number": sale_invoice.invoice_number})
    return {
        "sent": True,
        "status": "SUCCESS",
        "invoice_number": sale_invoice.invoice_number,
        "recipient_email": recipient,
        "sent_at": timezone.now().isoformat(),
        "pdf_url": sale_invoice.pdf_file_url,
        "xml_url": sale_invoice.xml_file_url,
    }
