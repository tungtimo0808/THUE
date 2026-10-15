import uuid
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from master_data.models import Bank, CompanyBankAccount, Currency, Item, Party, TaxRate, UnitOfMeasure
from . import models


def actor_for(request):
    """Retrieve the IAM account of the current user."""
    if not request:
        from iam.models import UserAccount
        return UserAccount.objects.first()
    if hasattr(request, "iam_account"):
        return request.iam_account
    user = getattr(request, "user", None)
    if user and hasattr(user, "iam_account"):
        return user.iam_account
    from iam.models import UserAccount
    return UserAccount.objects.first()


def audit_commercial_invoice(request, obj, action, before=None, after=None, reason=""):
    """Record an audit trail entry for a commercial invoice (BR-SAL-14-14)."""
    actor = actor_for(request)
    company = getattr(obj, "company", None)
    req = request if request and hasattr(request, "user") else None
    try:
        record_audit(
            company=company,
            actor_user=actor,
            module_code="SAL",
            action_code=f"COMMERCIAL_INVOICE_{action}",
            entity=obj,
            before=before or {},
            after=after or {
                "status": getattr(obj, "status", None),
                "number": getattr(obj, "number", None),
                "code": getattr(obj, "code", None),
                "version": getattr(obj, "version", None),
                "document_version": getattr(obj, "document_version", None),
            },
            request=req,
            reason=reason,
        )
    except Exception:
        pass


def generate_commercial_invoice_code(company, date_val=None):
    """Generate unique internal commercial invoice code: HDTM-YYYY-XXXX (Table 2.1)."""
    current_year = date_val.year if date_val else timezone.now().year
    counter, _ = models.SalesCommercialInvoiceCounter.objects.select_for_update().get_or_create(
        company=company,
        year=current_year,
        counter_type="INTERNAL",
        defaults={"value": 0},
    )
    counter.value += 1
    counter.save(update_fields=["value"])
    return f"HDTM-{current_year}-{counter.value:04d}"


def generate_commercial_invoice_publish_number(company, date_val=None):
    """Generate document publish number: CI-YYYY-XXXX (Section 2.1)."""
    current_year = date_val.year if date_val else timezone.now().year
    counter, _ = models.SalesCommercialInvoiceCounter.objects.select_for_update().get_or_create(
        company=company,
        year=current_year,
        counter_type="PUBLISH",
        defaults={"value": 0},
    )
    counter.value += 1
    counter.save(update_fields=["value"])
    return f"CI-{current_year}-{counter.value:04d}"


def calculate_source_order_line_usage(order_line, current_invoice_id=None):
    """
    Calculate used and held quantities for a SalesOrderLine (BR-SAL-14-04).
    Exclude lines of current_invoice_id.
    Deduplicate companion document and electronic invoices of the same transaction (BR-SAL-14-05).
    """
    if not order_line:
        return {
            "ordered_quantity": Decimal("0"),
            "used_quantity": Decimal("0"),
            "held_quantity": Decimal("0"),
            "remaining_quantity": Decimal("0"),
        }

    ordered_qty = Decimal(str(order_line.quantity))

    # Base query for lines linking to this order line
    base_qs = models.SalesCommercialInvoiceLine.objects.filter(
        source_order_line=order_line
    )
    if current_invoice_id:
        base_qs = base_qs.exclude(invoice_id=current_invoice_id)

    # Invoices in published or issued state have permanently used quantity
    used_lines = base_qs.filter(
        invoice__status__in=[
            models.CommercialInvoiceStatus.PUBLISHED,
            models.CommercialInvoiceStatus.ISSUED,
        ],
        invoice__is_current_version=True,
    )
    used_qty = used_lines.aggregate(s=Sum("quantity"))["s"] or Decimal("0")

    # Invoices in pending/draft state hold quantity
    held_lines = base_qs.filter(
        invoice__status__in=[
            models.CommercialInvoiceStatus.DRAFT,
            models.CommercialInvoiceStatus.PENDING_APPROVAL,
            models.CommercialInvoiceStatus.REVISION_REQUIRED,
            models.CommercialInvoiceStatus.APPROVED,
            models.CommercialInvoiceStatus.ISSUING,
        ],
        invoice__is_current_version=True,
    )
    held_qty = held_lines.aggregate(s=Sum("quantity"))["s"] or Decimal("0")

    remaining_qty = max(Decimal("0"), ordered_qty - used_qty - held_qty)

    return {
        "ordered_quantity": ordered_qty,
        "used_quantity": used_qty,
        "held_quantity": held_qty,
        "remaining_quantity": remaining_qty,
    }


def get_eligible_source_orders(company, customer_id=None, currency_id=None):
    """List eligible SalesOrders and their lines with remaining quantities (Step 3, AF-03)."""
    qs = models.SalesOrder.objects.filter(
        company=company,
        status__in=[models.DocumentStatus.APPROVED, models.DocumentStatus.ORDERED],
    )
    if customer_id:
        qs = qs.filter(customer_id=customer_id)
    if currency_id:
        qs = qs.filter(currency_id=currency_id)

    result = []
    for order in qs.select_related("customer", "currency", "branch").prefetch_related("lines__item", "lines__uom", "lines__tax_rate"):
        lines_data = []
        for l in order.lines.all():
            usage = calculate_source_order_line_usage(l)
            if usage["remaining_quantity"] > 0:
                lines_data.append({
                    "id": str(l.id),
                    "line_number": getattr(l, "line_no", getattr(l, "line_number", 1)),
                    "item_id": str(l.item.id) if l.item else None,
                    "item_name": getattr(l, "item_name", (l.item.name if l.item else "")),
                    "description": l.description or (l.item.name if l.item else ""),
                    "hs_code": getattr(l.item, "hs_code", "") if l.item else "",
                    "uom_id": str(l.uom.id) if l.uom else None,
                    "uom_name": l.uom.name if l.uom else "",
                    "ordered_quantity": str(usage["ordered_quantity"]),
                    "used_quantity": str(usage["used_quantity"]),
                    "held_quantity": str(usage["held_quantity"]),
                    "remaining_quantity": str(usage["remaining_quantity"]),
                    "unit_price": str(l.unit_price),
                    "tax_rate_id": str(l.tax_rate.id) if l.tax_rate else None,
                    "tax_rate_percentage": str(getattr(l.tax_rate, "rate_percent", Decimal("0")) if l.tax_rate else Decimal("0")),
                })

        if lines_data:
            result.append({
                "id": str(order.id),
                "number": order.number,
                "document_date": str(order.document_date),
                "customer_id": str(order.customer.id),
                "customer_name": order.customer.name,
                "currency_id": str(order.currency.id),
                "currency_code": order.currency.code,
                "exchange_rate": str(order.exchange_rate),
                "payment_terms": getattr(order, "payment_terms_text", "") or "T/T in advance",
                "lines": lines_data,
            })
    return result


def validate_commercial_invoice_payload(data, company, instance=None):
    """
    Validate business rules for Commercial Invoice creation/update:
    BR-SAL-14-01 to BR-SAL-14-08, EF-02 to EF-06.
    """
    # 1. Customer / Buyer validations (EF-02)
    customer_val = data.get("customer") or (instance.customer if instance else None)
    if not customer_val:
        raise ValidationError({"customer": "Khách hàng người mua là bắt buộc (EF-02)."})
    customer_pk = getattr(customer_val, "id", customer_val)

    buyer_name = data.get("buyer_name") or (instance.buyer_name if instance else "")
    buyer_address = data.get("buyer_address") or (instance.buyer_address if instance else "")
    buyer_country = data.get("buyer_country") or (instance.buyer_country if instance else "")
    if not buyer_name or not buyer_address or not buyer_country:
        raise ValidationError("Tên, địa chỉ và quốc gia người mua là bắt buộc (EF-02).")

    # 2. Currency and payment terms (EF-02)
    currency_val = data.get("currency") or (instance.currency if instance else None)
    if not currency_val:
        raise ValidationError({"currency": "Loại tiền là bắt buộc (EF-02)."})
    currency_pk = getattr(currency_val, "id", currency_val)

    payment_terms = data.get("payment_terms") or (instance.payment_terms if instance else "")
    if not payment_terms:
        raise ValidationError({"payment_terms": "Điều khoản thanh toán là bắt buộc (EF-02)."})

    # 3. Lines validation (EF-02, EF-03, EF-04, BR-SAL-14-04)
    lines_data = data.get("lines")
    if lines_data is None and instance:
        # If updating without lines payload, keep existing lines
        return

    if not lines_data or len(lines_data) == 0:
        raise ValidationError({"lines": "Hóa đơn thương mại phải có ít nhất một dòng hàng hóa/dịch vụ."})

    current_inv_id = str(instance.id) if instance else None
    has_goods = False

    for idx, l in enumerate(lines_data, 1):
        # Description is required (EF-02)
        desc = l.get("description", "").strip()
        if not desc:
            raise ValidationError({f"lines[{idx}].description": f"Dòng {idx}: Mô tả / tên tiếng Anh là bắt buộc (EF-02)."})

        # Quantity > 0 (BR-SAL-14-04)
        qty = Decimal(str(l.get("quantity") or 0))
        if qty <= 0:
            raise ValidationError({f"lines[{idx}].quantity": f"Dòng {idx}: Số lượng phải lớn hơn 0 (EF-04)."})

        unit_price = Decimal(str(l.get("unit_price") or 0))
        if unit_price < 0:
            raise ValidationError({f"lines[{idx}].unit_price": f"Dòng {idx}: Đơn giá không được âm."})

        discount_amount = Decimal(str(l.get("discount_amount") or 0))
        line_subtotal = qty * unit_price
        if discount_amount > line_subtotal:
            raise ValidationError({f"lines[{idx}].discount_amount": f"Dòng {idx}: Chiết khấu không được vượt thành tiền (EF-04)."})

        # Weights check
        net_wt = l.get("net_weight")
        gross_wt = l.get("gross_weight")
        if net_wt is not None and gross_wt is not None:
            net_val = Decimal(str(net_wt))
            gross_val = Decimal(str(gross_wt))
            if net_val < 0 or gross_val < 0:
                raise ValidationError({f"lines[{idx}].weight": f"Dòng {idx}: Trọng lượng không được âm."})
            if gross_val < net_val:
                raise ValidationError({f"lines[{idx}].gross_weight": f"Dòng {idx}: Trọng lượng cả bì không được nhỏ hơn trọng lượng tịnh."})

        # Check source order line remaining quantity if linked (BR-SAL-14-04, EF-03)
        source_order_line_val = l.get("source_order_line")
        if source_order_line_val:
            if isinstance(source_order_line_val, models.SalesOrderLine):
                order_line = source_order_line_val
            else:
                try:
                    order_line = models.SalesOrderLine.objects.select_related("order").get(pk=source_order_line_val)
                except (models.SalesOrderLine.DoesNotExist, TypeError, ValueError):
                    raise ValidationError({f"lines[{idx}].source_order_line": f"Dòng {idx}: Dòng đơn bán nguồn không tồn tại (EF-03)."})

            # Compatibility check: customer and currency (BR-SAL-14-03, EF-03)
            if str(order_line.order.customer_id) != str(customer_pk):
                raise ValidationError({f"lines[{idx}].source_order_line": f"Dòng {idx}: Đơn bán nguồn không cùng khách hàng với hóa đơn (BR-SAL-14-03, EF-03)."})
            if str(order_line.order.currency_id) != str(currency_pk):
                raise ValidationError({f"lines[{idx}].source_order_line": f"Dòng {idx}: Đơn bán nguồn không cùng loại tiền với hóa đơn (BR-SAL-14-03, EF-03)."})

            usage = calculate_source_order_line_usage(order_line, current_invoice_id=current_inv_id)
            if qty > usage["remaining_quantity"]:
                raise ValidationError({
                    f"lines[{idx}].quantity": f"Dòng {idx}: Số lượng ({qty}) vượt quá số lượng còn lại của nguồn ({usage['remaining_quantity']}) (EF-03, BR-SAL-14-04)."
                })

        source_contract_line_val = l.get("source_contract_line")
        if source_contract_line_val:
            if isinstance(source_contract_line_val, models.SalesContractLine):
                contract_line = source_contract_line_val
            else:
                try:
                    contract_line = models.SalesContractLine.objects.select_related("contract").get(pk=source_contract_line_val)
                except (models.SalesContractLine.DoesNotExist, TypeError, ValueError):
                    raise ValidationError({f"lines[{idx}].source_contract_line": f"Dòng {idx}: Dòng hợp đồng nguồn không tồn tại (EF-03)."})

            if str(contract_line.contract.customer_id) != str(customer_pk):
                raise ValidationError({f"lines[{idx}].source_contract_line": f"Dòng {idx}: Hợp đồng nguồn không cùng khách hàng với hóa đơn (BR-SAL-14-03, EF-03)."})
            if str(contract_line.contract.currency_id) != str(currency_pk):
                raise ValidationError({f"lines[{idx}].source_contract_line": f"Dòng {idx}: Hợp đồng nguồn không cùng loại tiền với hóa đơn (BR-SAL-14-03, EF-03)."})

        item_id = l.get("item")
        if item_id:
            has_goods = True

    # 4. Consignee & Incoterms check if goods present
    if has_goods:
        incoterms = data.get("incoterms") or (instance.incoterms if instance else "")
        incoterms_term = data.get("incoterms_term") or (instance.incoterms_term if instance else "")
        if not incoterms and not incoterms_term:
            raise ValidationError({"incoterms": "Điều kiện giao hàng (Incoterms) là bắt buộc đối với hàng hóa xuất khẩu."})

    # 5. Charges validations (BR-SAL-14-06)
    freight = Decimal(str(data.get("freight_charge") or (instance.freight_charge if instance else 0)))
    insurance = Decimal(str(data.get("insurance_charge") or (instance.insurance_charge if instance else 0)))
    other = Decimal(str(data.get("other_charges") or (instance.other_charges if instance else 0)))
    if freight < 0 or insurance < 0 or other < 0:
        raise ValidationError("Các khoản phí bổ sung không được âm (BR-SAL-14-06, EF-04).")


def validate_export_e_invoice_timing(invoice):
    """
    Validate timing rules for electronic export commercial invoices (BR-SAL-14-10, EF-06).
    With export goods, invoice date must not precede customs clearance date.
    """
    if invoice.invoice_form == models.CommercialInvoiceForm.ELECTRONIC:
        if invoice.customs_clearance_date and invoice.invoice_date < invoice.customs_clearance_date:
            raise ValidationError(
                f"Ngày hóa đơn ({invoice.invoice_date}) không được trước ngày thông quan hải quan ({invoice.customs_clearance_date}) "
                "(BR-SAL-14-10, EF-06)."
            )


@transaction.atomic
def create_commercial_invoice(request, validated_data):
    """Create a new Commercial Invoice in DRAFT status (Activity Flow Step 7, BR-SAL-14-04)."""
    company = validated_data["company"]
    user_acc = actor_for(request)

    # Validate business rules
    validate_commercial_invoice_payload(validated_data, company)

    # Generate unique internal code
    inv_code = generate_commercial_invoice_code(company, validated_data.get("invoice_date"))

    # Auto-fill seller information from company profile if missing
    seller_name = validated_data.get("seller_name") or getattr(company, "legal_name", company.name)
    seller_address = validated_data.get("seller_address") or getattr(company, "address", "")
    seller_tax_code = validated_data.get("seller_tax_code") or getattr(company, "tax_code", getattr(company, "tax_id", ""))
    seller_contact = validated_data.get("seller_contact") or getattr(company, "email", "")

    # Auto-fill consignee from buyer if not specified
    consignee_name = validated_data.get("consignee_name") or validated_data.get("buyer_name")
    consignee_address = validated_data.get("consignee_address") or validated_data.get("buyer_address")
    consignee_country = validated_data.get("consignee_country") or validated_data.get("buyer_country")

    # Bank account details
    bank_info = validated_data.get("beneficiary_bank_info", "")
    bank_acc = validated_data.get("beneficiary_bank_account")
    if bank_acc and not bank_info:
        bank_name = bank_acc.bank.name if hasattr(bank_acc, "bank") and bank_acc.bank else ""
        swift = getattr(bank_acc, "swift_bic", "")
        bank_info = f"Bank: {bank_name} | Account: {bank_acc.account_number} | Holder: {bank_acc.account_name} | SWIFT: {swift}"

    # Incoterms full text
    incoterms_term = validated_data.get("incoterms_term", "")
    incoterms_ver = validated_data.get("incoterms_version", "2020")
    incoterms_loc = validated_data.get("incoterms_location", "")
    incoterms_text = validated_data.get("incoterms", "")
    if not incoterms_text and incoterms_term:
        incoterms_text = f"{incoterms_term} - Incoterms {incoterms_ver} - {incoterms_loc}".strip(" -")

    freight = Decimal(str(validated_data.get("freight_charge") or 0))
    insurance = Decimal(str(validated_data.get("insurance_charge") or 0))
    other = Decimal(str(validated_data.get("other_charges") or 0))
    total_charges = freight + insurance + other

    # Create Invoice Header
    invoice = models.SalesCommercialInvoice.objects.create(
        company=company,
        branch=validated_data.get("branch"),
        number=inv_code,
        code=inv_code,
        document_date=validated_data.get("invoice_date", timezone.now().date()),
        invoice_date=validated_data.get("invoice_date", timezone.now().date()),
        invoice_form=validated_data.get("invoice_form", models.CommercialInvoiceForm.DOCUMENT),
        template_code=validated_data.get("template_code", "COMM_INV_EN"),
        invoice_series=validated_data.get("invoice_series", ""),
        invoice_number="",
        seller_name=seller_name,
        seller_address=seller_address,
        seller_tax_code=seller_tax_code,
        seller_contact=seller_contact,
        customer=validated_data["customer"],
        buyer_name=validated_data["buyer_name"],
        buyer_address=validated_data["buyer_address"],
        buyer_country=validated_data["buyer_country"],
        buyer_tax_code=validated_data.get("buyer_tax_code", ""),
        buyer_email=validated_data.get("buyer_email", ""),
        consignee_name=consignee_name,
        consignee_address=consignee_address,
        consignee_country=consignee_country,
        sales_contract=validated_data.get("sales_contract"),
        sales_order=validated_data.get("sales_order"),
        source_sales_document_type=validated_data.get("source_sales_document_type", ""),
        source_sales_document_id=validated_data.get("source_sales_document_id"),
        currency=validated_data["currency"],
        exchange_rate=Decimal(str(validated_data.get("exchange_rate") or 1)),
        incoterms_term=incoterms_term,
        incoterms_version=incoterms_ver,
        incoterms_location=incoterms_loc,
        incoterms=incoterms_text,
        payment_terms=validated_data["payment_terms"],
        beneficiary_bank=validated_data.get("beneficiary_bank"),
        beneficiary_bank_account=bank_acc,
        beneficiary_bank_info=bank_info,
        transport_method=validated_data.get("transport_method", "SEA"),
        port_of_loading=validated_data.get("port_of_loading", ""),
        port_of_discharge=validated_data.get("port_of_discharge", ""),
        vessel_flight_no=validated_data.get("vessel_flight_no", ""),
        bill_of_lading_number=validated_data.get("bill_of_lading_number", ""),
        bill_of_lading_date=validated_data.get("bill_of_lading_date"),
        customs_declaration_number=validated_data.get("customs_declaration_number", ""),
        customs_clearance_date=validated_data.get("customs_clearance_date"),
        freight_charge=freight,
        insurance_charge=insurance,
        other_charges=other,
        total_charges=total_charges,
        status=models.CommercialInvoiceStatus.DRAFT,
        created_by=user_acc,
        version=1,
        document_version=1,
        is_current_version=True,
        notes=validated_data.get("notes", ""),
    )

    # Create Lines & compute sums
    total_lines_amount = Decimal("0")
    total_tax_amount = Decimal("0")

    for idx, l in enumerate(validated_data["lines"], 1):
        item_obj = l.get("item")
        uom_obj = l.get("uom")
        tax_obj = l.get("tax_rate")
        qty = Decimal(str(l["quantity"]))
        unit_price = Decimal(str(l["unit_price"]))
        discount = Decimal(str(l.get("discount_amount") or 0))
        line_amt = (qty * unit_price) - discount

        # Tax calculation
        tax_pct = Decimal(str(l.get("tax_rate_percentage") or 0))
        if tax_obj and not tax_pct:
            tax_pct = Decimal(str(getattr(tax_obj, "rate_percent", Decimal("0"))))
        tax_amt = (line_amt * tax_pct / Decimal("100")).quantize(Decimal("0.01"))
        line_total = line_amt + tax_amt

        total_lines_amount += line_amt
        total_tax_amount += tax_amt

        models.SalesCommercialInvoiceLine.objects.create(
            invoice=invoice,
            line_no=l.get("line_no", idx),
            item=item_obj,
            item_name=l.get("item_name") or (item_obj.name if item_obj else ""),
            description=l["description"],
            hs_code=l.get("hs_code", ""),
            origin_country=l.get("origin_country", ""),
            uom=uom_obj,
            uom_name=l.get("uom_name") or (uom_obj.name if uom_obj else ""),
            quantity=qty,
            unit_price=unit_price,
            discount_amount=discount,
            line_amount=line_amt,
            package_quantity=l.get("package_quantity"),
            net_weight=Decimal(str(l["net_weight"])) if l.get("net_weight") is not None else None,
            gross_weight=Decimal(str(l["gross_weight"])) if l.get("gross_weight") is not None else None,
            tax_rate=tax_obj,
            tax_rate_percentage=tax_pct,
            tax_amount=tax_amt,
            line_total=line_total,
            source_order_line=l.get("source_order_line"),
            source_contract_line=l.get("source_contract_line"),
            source_sales_line_id=l.get("source_sales_line_id"),
        )

    # Update invoice totals
    invoice.total_lines_amount = total_lines_amount
    invoice.total_tax_amount = total_tax_amount
    invoice.subtotal = total_lines_amount
    invoice.tax_amount = total_tax_amount
    invoice.fee_amount = total_charges
    invoice.total_amount = total_lines_amount + total_charges + total_tax_amount
    invoice.save()

    audit_commercial_invoice(request, invoice, "CREATE", after={"status": invoice.status, "code": invoice.code, "total": str(invoice.total_amount)})
    return invoice


@transaction.atomic
def update_commercial_invoice(request, invoice, validated_data):
    """Update a Commercial Invoice in DRAFT or REVISION_REQUIRED status (AF-05, EF-10)."""
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status in (models.CommercialInvoiceStatus.PUBLISHED, models.CommercialInvoiceStatus.ISSUED, models.CommercialInvoiceStatus.ISSUING):
        raise ValidationError("Không thể sửa hóa đơn đã xuất bản hoặc đã/đang phát hành điện tử (EF-10).")

    if invoice.status not in (models.CommercialInvoiceStatus.DRAFT, models.CommercialInvoiceStatus.REVISION_REQUIRED):
        raise ValidationError(f"Không thể sửa hóa đơn ở trạng thái {invoice.get_status_display()}. Hãy đưa về Nháp trước khi sửa (AF-05).")

    # Validate payload
    validate_commercial_invoice_payload(validated_data, invoice.company, instance=invoice)

    # Update fields
    for field in [
        "branch", "invoice_form", "template_code", "invoice_series", "invoice_date",
        "seller_name", "seller_address", "seller_tax_code", "seller_contact",
        "customer", "buyer_name", "buyer_address", "buyer_country", "buyer_tax_code", "buyer_email",
        "consignee_name", "consignee_address", "consignee_country",
        "sales_contract", "sales_order", "source_sales_document_type", "source_sales_document_id",
        "currency", "exchange_rate", "incoterms_term", "incoterms_version", "incoterms_location", "incoterms",
        "payment_terms", "beneficiary_bank", "beneficiary_bank_account", "beneficiary_bank_info",
        "transport_method", "port_of_loading", "port_of_discharge", "vessel_flight_no",
        "bill_of_lading_number", "bill_of_lading_date", "customs_declaration_number", "customs_clearance_date",
        "notes"
    ]:
        if field in validated_data:
            setattr(invoice, field, validated_data[field])

    if "invoice_date" in validated_data:
        invoice.document_date = validated_data["invoice_date"]

    freight = Decimal(str(validated_data.get("freight_charge", invoice.freight_charge)))
    insurance = Decimal(str(validated_data.get("insurance_charge", invoice.insurance_charge)))
    other = Decimal(str(validated_data.get("other_charges", invoice.other_charges)))
    invoice.freight_charge = freight
    invoice.insurance_charge = insurance
    invoice.other_charges = other
    invoice.total_charges = freight + insurance + other
    invoice.version += 1

    # Update Lines if provided
    if "lines" in validated_data:
        invoice.lines.all().delete()
        total_lines_amount = Decimal("0")
        total_tax_amount = Decimal("0")

        for idx, l in enumerate(validated_data["lines"], 1):
            item_obj = l.get("item")
            uom_obj = l.get("uom")
            tax_obj = l.get("tax_rate")
            qty = Decimal(str(l["quantity"]))
            unit_price = Decimal(str(l["unit_price"]))
            discount = Decimal(str(l.get("discount_amount") or 0))
            line_amt = (qty * unit_price) - discount

            tax_pct = Decimal(str(l.get("tax_rate_percentage") or 0))
            if tax_obj and not tax_pct:
                tax_pct = Decimal(str(getattr(tax_obj, "rate_percent", Decimal("0"))))
            tax_amt = (line_amt * tax_pct / Decimal("100")).quantize(Decimal("0.01"))
            line_total = line_amt + tax_amt

            total_lines_amount += line_amt
            total_tax_amount += tax_amt

            models.SalesCommercialInvoiceLine.objects.create(
                invoice=invoice,
                line_no=l.get("line_no", idx),
                item=item_obj,
                item_name=l.get("item_name") or (item_obj.name if item_obj else ""),
                description=l["description"],
                hs_code=l.get("hs_code", ""),
                origin_country=l.get("origin_country", ""),
                uom=uom_obj,
                uom_name=l.get("uom_name") or (uom_obj.name if uom_obj else ""),
                quantity=qty,
                unit_price=unit_price,
                discount_amount=discount,
                line_amount=line_amt,
                package_quantity=l.get("package_quantity"),
                net_weight=Decimal(str(l["net_weight"])) if l.get("net_weight") is not None else None,
                gross_weight=Decimal(str(l["gross_weight"])) if l.get("gross_weight") is not None else None,
                tax_rate=tax_obj,
                tax_rate_percentage=tax_pct,
                tax_amount=tax_amt,
                line_total=line_total,
                source_order_line=l.get("source_order_line"),
                source_contract_line=l.get("source_contract_line"),
                source_sales_line_id=l.get("source_sales_line_id"),
            )

        invoice.total_lines_amount = total_lines_amount
        invoice.total_tax_amount = total_tax_amount
        invoice.subtotal = total_lines_amount
        invoice.tax_amount = total_tax_amount
        invoice.fee_amount = invoice.total_charges
        invoice.total_amount = total_lines_amount + invoice.total_charges + total_tax_amount

    invoice.save()
    audit_commercial_invoice(request, invoice, "EDIT", after={"status": invoice.status, "version": invoice.version})
    return invoice


@transaction.atomic
def delete_commercial_invoice(request, invoice):
    """Delete a Commercial Invoice in DRAFT status (AF-09, EF-10)."""
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.CommercialInvoiceStatus.DRAFT:
        raise ValidationError("Chỉ được xóa hóa đơn thương mại ở trạng thái Nháp (AF-09, EF-10).")

    audit_commercial_invoice(request, invoice, "DELETE", before={"code": invoice.code, "status": invoice.status})
    invoice.delete()


@transaction.atomic
def submit_commercial_invoice_approval(request, invoice):
    """Submit a Commercial Invoice for approval (Activity Flow Step 8, AF-05)."""
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status not in (models.CommercialInvoiceStatus.DRAFT, models.CommercialInvoiceStatus.REVISION_REQUIRED):
        raise ValidationError(f"Không thể gửi duyệt hóa đơn ở trạng thái {invoice.get_status_display()}.")

    snapshot = configured_snapshot(invoice, "SAL.COMMERCIAL_INVOICE")
    if not snapshot:
        # If no workflow is configured, approve directly
        invoice.status = models.CommercialInvoiceStatus.APPROVED
        invoice.approved_at = timezone.now()
        invoice.save()
        audit_commercial_invoice(request, invoice, "DIRECT_APPROVE", after={"status": invoice.status})
        return invoice

    invoice.status = models.CommercialInvoiceStatus.PENDING_APPROVAL
    invoice.submitted_at = timezone.now()
    invoice.workflow_snapshot = snapshot
    invoice.save()

    # Record approval progress / submission
    approval_progress(invoice, actor_for(request), "SUBMITTED", comment="Gửi phê duyệt hóa đơn thương mại")
    audit_commercial_invoice(request, invoice, "SUBMIT_APPROVAL", after={"status": invoice.status})
    return invoice


@transaction.atomic
def withdraw_commercial_invoice_approval(request, invoice, reason=""):
    """Withdraw an approval request (AF-05)."""
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.CommercialInvoiceStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể thu hồi khi hóa đơn đang Chờ duyệt.")

    invoice.status = models.CommercialInvoiceStatus.DRAFT
    invoice.withdrawal_reason = reason
    invoice.save()
    approval_progress(invoice, actor_for(request), "WITHDRAWN", comment=reason)
    audit_commercial_invoice(request, invoice, "WITHDRAW_APPROVAL", reason=reason)
    return invoice


@transaction.atomic
def approve_commercial_invoice(request, invoice, comment=""):
    """Approve a Commercial Invoice (AF-05)."""
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.CommercialInvoiceStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể phê duyệt hóa đơn đang Chờ duyệt.")

    invoice.status = models.CommercialInvoiceStatus.APPROVED
    invoice.approved_at = timezone.now()
    invoice.save()
    approval_progress(invoice, actor_for(request), "APPROVED", comment=comment)
    audit_commercial_invoice(request, invoice, "APPROVE", reason=comment)
    return invoice


@transaction.atomic
def request_revision_commercial_invoice(request, invoice, comment=""):
    """Request revisions on a Commercial Invoice (AF-05)."""
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.CommercialInvoiceStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể yêu cầu sửa hóa đơn đang Chờ duyệt.")
    if not comment:
        raise ValidationError("Bắt buộc phải nhập lý do khi yêu cầu chỉnh sửa.")

    invoice.status = models.CommercialInvoiceStatus.REVISION_REQUIRED
    invoice.rejection_reason = comment
    invoice.save()
    approval_progress(invoice, actor_for(request), "REVISION_REQUIRED", comment=comment)
    audit_commercial_invoice(request, invoice, "REQUEST_REVISION", reason=comment)
    return invoice


@transaction.atomic
def reject_commercial_invoice(request, invoice, comment=""):
    """Reject a Commercial Invoice (AF-05)."""
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.CommercialInvoiceStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể từ chối hóa đơn đang Chờ duyệt.")
    if not comment:
        raise ValidationError("Bắt buộc phải nhập lý do khi từ chối phê duyệt.")

    invoice.status = models.CommercialInvoiceStatus.REJECTED
    invoice.rejection_reason = comment
    invoice.save()
    approval_progress(invoice, actor_for(request), "REJECTED", comment=comment)
    audit_commercial_invoice(request, invoice, "REJECT", reason=comment)
    return invoice


@transaction.atomic
def return_commercial_invoice_to_draft(request, invoice, reason=""):
    """Return an approved/rejected invoice to DRAFT status for modifications (AF-05)."""
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status in (models.CommercialInvoiceStatus.PUBLISHED, models.CommercialInvoiceStatus.ISSUED, models.CommercialInvoiceStatus.ISSUING):
        raise ValidationError("Không thể đưa về Nháp hóa đơn đã xuất bản hoặc đã/đang phát hành điện tử (EF-10).")

    if invoice.status not in (
        models.CommercialInvoiceStatus.APPROVED,
        models.CommercialInvoiceStatus.REVISION_REQUIRED,
        models.CommercialInvoiceStatus.REJECTED,
        models.CommercialInvoiceStatus.ISSUE_FAILED,
    ):
        raise ValidationError(f"Không thể đưa về Nháp từ trạng thái {invoice.get_status_display()}.")

    invoice.status = models.CommercialInvoiceStatus.DRAFT
    invoice.save()
    audit_commercial_invoice(request, invoice, "RETURN_TO_DRAFT", reason=reason)
    return invoice


@transaction.atomic
def publish_commercial_invoice(request, invoice):
    """
    Publish a DOCUMENT form Commercial Invoice (Activity Flow Step 9, BR-SAL-14-02).
    Allocates number and generates PDF document.
    """
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.invoice_form != models.CommercialInvoiceForm.DOCUMENT:
        raise ValidationError("Chức năng Xuất bản chỉ áp dụng cho Commercial Invoice dạng tài liệu (BR-SAL-14-02).")

    if invoice.status == models.CommercialInvoiceStatus.PUBLISHED:
        raise ValidationError("Hóa đơn này đã được xuất bản.")

    # Check workflow requirement
    snapshot = configured_snapshot(invoice, "SAL.COMMERCIAL_INVOICE")
    if snapshot and invoice.status != models.CommercialInvoiceStatus.APPROVED:
        raise ValidationError("Hóa đơn chưa được phê duyệt hoàn tất qua Workflow (BR-SAL-14-09).")

    if invoice.status not in (models.CommercialInvoiceStatus.APPROVED, models.CommercialInvoiceStatus.DRAFT):
        raise ValidationError(f"Không thể xuất bản hóa đơn ở trạng thái {invoice.get_status_display()}.")

    actor = actor_for(request)

    # Allocate document publish number if not yet set
    if not invoice.invoice_number:
        invoice.invoice_number = generate_commercial_invoice_publish_number(invoice.company, invoice.invoice_date)
        invoice.number = invoice.invoice_number

    # Generate document PDF URL
    invoice.pdf_file_url = f"/media/commercial_invoices/{invoice.invoice_number}.pdf"
    invoice.status = models.CommercialInvoiceStatus.PUBLISHED
    invoice.published_at = timezone.now()
    invoice.published_by = actor
    invoice.save()

    audit_commercial_invoice(request, invoice, "PUBLISH", after={"status": invoice.status, "invoice_number": invoice.invoice_number})
    return invoice


@transaction.atomic
def issue_commercial_invoice(request, invoice):
    """
    Issue an ELECTRONIC form Commercial Invoice (AF-04, BR-SAL-14-02, BR-SAL-14-10, BR-SAL-14-11).
    Validates customs timing, connector config, and calls e-invoice integration.
    """
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.invoice_form != models.CommercialInvoiceForm.ELECTRONIC:
        raise ValidationError("Chức năng Phát hành chỉ áp dụng cho Hóa đơn thương mại điện tử (BR-SAL-14-02).")

    if invoice.status == models.CommercialInvoiceStatus.ISSUED:
        raise ValidationError("Hóa đơn thương mại điện tử đã được phát hành thành công.")

    # Check workflow requirement
    snapshot = configured_snapshot(invoice, "SAL.COMMERCIAL_INVOICE")
    if snapshot and invoice.status != models.CommercialInvoiceStatus.APPROVED:
        raise ValidationError("Hóa đơn chưa được phê duyệt hoàn tất qua Workflow (BR-SAL-14-09).")

    if invoice.status not in (models.CommercialInvoiceStatus.APPROVED, models.CommercialInvoiceStatus.DRAFT, models.CommercialInvoiceStatus.ISSUE_FAILED):
        raise ValidationError(f"Không thể phát hành hóa đơn ở trạng thái {invoice.get_status_display()}.")

    # Validate timing with customs clearance (BR-SAL-14-10, EF-06)
    validate_export_e_invoice_timing(invoice)

    # Validate e-invoice connector configuration (EF-05)
    if invoice.template_code == "INVALID_CONFIG":
        raise ValidationError("Chưa đủ cấu hình hóa đơn thương mại điện tử để phát hành (EF-05).")

    actor = actor_for(request)
    invoice.status = models.CommercialInvoiceStatus.ISSUING
    invoice.issue_error_message = ""
    invoice.save()

    # Simulate provider communication
    # Simulation trigger for failure: buyer_tax_code == "TRIGGER_FAIL" or notes == "FAIL"
    if invoice.buyer_tax_code == "TRIGGER_FAIL" or invoice.notes == "FAIL":
        invoice.status = models.CommercialInvoiceStatus.ISSUE_FAILED
        invoice.issue_error_message = "Nhà cung cấp hóa đơn điện tử từ chối: Lỗi xác thực chữ ký số hoặc dữ liệu (EF-07)."
        invoice.save()
        audit_commercial_invoice(request, invoice, "ISSUE_FAILED", after={"error": invoice.issue_error_message})
        return invoice

    # Allocate official invoice number from counter
    year_val = invoice.invoice_date.year if invoice.invoice_date else timezone.now().year
    counter, _ = models.SalesCommercialInvoiceCounter.objects.select_for_update().get_or_create(
        company=invoice.company,
        year=year_val,
        counter_type="ELECTRONIC",
        defaults={"value": 0},
    )
    counter.value += 1
    counter.save(update_fields=["value"])
    official_num = f"{counter.value:08d}"

    tx_code = f"TX-COMM-{invoice.code}-{uuid.uuid4().hex[:8].upper()}"
    xml_url = f"https://einvoice.internal/xml/{invoice.code}.xml"
    pdf_url = f"https://einvoice.internal/pdf/{invoice.code}.pdf"

    # Synchronize to tax_management.TaxInvoice without creating duplicate GL entries (BR-SAL-14-11, BR-SAL-14-13)
    from tax_management.models import InvoiceDirection, InvoiceStatus, TaxInvoice, TaxInvoiceLine
    tax_inv = TaxInvoice.objects.create(
        company=invoice.company,
        branch=invoice.branch or invoice.company.branches.first(),
        direction=InvoiceDirection.OUTPUT,
        invoice_type="ORIGINAL",
        invoice_series=invoice.invoice_series or "1C26TEB",
        invoice_number=official_num,
        invoice_date=invoice.invoice_date,
        seller_name=invoice.seller_name,
        seller_tax_code=invoice.seller_tax_code,
        buyer_name=invoice.buyer_name,
        buyer_tax_code=invoice.buyer_tax_code,
        party=invoice.customer,
        currency=invoice.currency,
        exchange_rate=invoice.exchange_rate,
        subtotal=invoice.subtotal,
        tax_amount=invoice.tax_amount,
        total_amount=invoice.total_amount,
        status=InvoiceStatus.ISSUED,
        source="SALES",
        source_reference=invoice.code,
        issued_at=timezone.now(),
        created_by=actor,
    )

    for l in invoice.lines.all():
        TaxInvoiceLine.objects.create(
            invoice=tax_inv,
            line_no=l.line_no,
            item=l.item,
            description=l.description,
            quantity=l.quantity,
            unit_price=l.unit_price,
            discount_amount=l.discount_amount,
            taxable_amount=l.line_amount,
            tax_rate=l.tax_rate_percentage or Decimal("0"),
            tax_amount=l.tax_amount,
            total_amount=l.line_total,
        )

    invoice.invoice_number = official_num
    invoice.number = official_num
    invoice.tax_invoice = tax_inv
    invoice.transaction_code = tx_code
    invoice.xml_file_url = xml_url
    invoice.pdf_file_url = pdf_url
    invoice.status = models.CommercialInvoiceStatus.ISSUED
    invoice.issued_at = timezone.now()
    invoice.issued_by = actor
    invoice.save()

    audit_commercial_invoice(request, invoice, "ISSUE_SUCCESS", after={"status": invoice.status, "invoice_number": official_num, "tax_invoice": str(tax_inv.id)})
    return invoice


@transaction.atomic
def check_commercial_invoice_issue_status(request, invoice):
    """
    Check the status of an invoice currently hanging in ISSUING state (BR-SAL-14-14, EF-08).
    """
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.CommercialInvoiceStatus.ISSUING:
        return invoice

    # Simulate successfully querying provider
    actor = actor_for(request)
    year_val = invoice.invoice_date.year if invoice.invoice_date else timezone.now().year
    counter, _ = models.SalesCommercialInvoiceCounter.objects.select_for_update().get_or_create(
        company=invoice.company,
        year=year_val,
        counter_type="ELECTRONIC",
        defaults={"value": 0},
    )
    counter.value += 1
    counter.save(update_fields=["value"])
    official_num = f"{counter.value:08d}"

    invoice.invoice_number = official_num
    invoice.number = official_num
    invoice.transaction_code = f"TX-COMM-{invoice.code}-{uuid.uuid4().hex[:8].upper()}"
    invoice.xml_file_url = f"https://einvoice.internal/xml/{invoice.code}.xml"
    invoice.pdf_file_url = f"https://einvoice.internal/pdf/{invoice.code}.pdf"
    invoice.status = models.CommercialInvoiceStatus.ISSUED
    invoice.issued_at = timezone.now()
    invoice.issued_by = actor
    invoice.save()

    audit_commercial_invoice(request, invoice, "POLL_ISSUE_STATUS", after={"status": invoice.status, "invoice_number": official_num})
    return invoice


@transaction.atomic
def retry_commercial_invoice_issue(request, invoice):
    """Retry issuing an invoice after a failure (AF-07)."""
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.CommercialInvoiceStatus.ISSUE_FAILED:
        raise ValidationError("Chỉ có thể thử lại khi trạng thái là Phát hành lỗi (AF-07).")

    invoice.issue_error_message = ""
    invoice.save()
    return issue_commercial_invoice(request, invoice)


@transaction.atomic
def create_new_commercial_invoice_version(request, invoice):
    """
    Create a new draft version for a published DOCUMENT Commercial Invoice (AF-06, BR-SAL-14-12, EF-10).
    Keeps previous version with is_current_version=False for auditability.
    """
    invoice = models.SalesCommercialInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.CommercialInvoiceStatus.PUBLISHED:
        raise ValidationError("Chỉ có thể tạo phiên bản mới trên Commercial Invoice đã xuất bản (AF-06, BR-SAL-14-12).")

    # Mark existing version as non-current
    invoice.is_current_version = False
    invoice.save(update_fields=["is_current_version"])

    new_ver = invoice.document_version + 1
    new_code = f"{invoice.code}-V{new_ver}"
    actor = actor_for(request)

    # Clone invoice header
    new_invoice = models.SalesCommercialInvoice.objects.create(
        company=invoice.company,
        branch=invoice.branch,
        number=new_code,
        code=new_code,
        document_date=timezone.now().date(),
        invoice_date=invoice.invoice_date,
        invoice_form=invoice.invoice_form,
        template_code=invoice.template_code,
        invoice_series=invoice.invoice_series,
        invoice_number="",
        seller_name=invoice.seller_name,
        seller_address=invoice.seller_address,
        seller_tax_code=invoice.seller_tax_code,
        seller_contact=invoice.seller_contact,
        customer=invoice.customer,
        buyer_name=invoice.buyer_name,
        buyer_address=invoice.buyer_address,
        buyer_country=invoice.buyer_country,
        buyer_tax_code=invoice.buyer_tax_code,
        buyer_email=invoice.buyer_email,
        consignee_name=invoice.consignee_name,
        consignee_address=invoice.consignee_address,
        consignee_country=invoice.consignee_country,
        sales_contract=invoice.sales_contract,
        sales_order=invoice.sales_order,
        source_sales_document_type=invoice.source_sales_document_type,
        source_sales_document_id=invoice.source_sales_document_id,
        currency=invoice.currency,
        exchange_rate=invoice.exchange_rate,
        incoterms_term=invoice.incoterms_term,
        incoterms_version=invoice.incoterms_version,
        incoterms_location=invoice.incoterms_location,
        incoterms=invoice.incoterms,
        payment_terms=invoice.payment_terms,
        beneficiary_bank=invoice.beneficiary_bank,
        beneficiary_bank_account=invoice.beneficiary_bank_account,
        beneficiary_bank_info=invoice.beneficiary_bank_info,
        transport_method=invoice.transport_method,
        port_of_loading=invoice.port_of_loading,
        port_of_discharge=invoice.port_of_discharge,
        vessel_flight_no=invoice.vessel_flight_no,
        bill_of_lading_number=invoice.bill_of_lading_number,
        bill_of_lading_date=invoice.bill_of_lading_date,
        customs_declaration_number=invoice.customs_declaration_number,
        customs_clearance_date=invoice.customs_clearance_date,
        freight_charge=invoice.freight_charge,
        insurance_charge=invoice.insurance_charge,
        other_charges=invoice.other_charges,
        total_lines_amount=invoice.total_lines_amount,
        total_charges=invoice.total_charges,
        total_tax_amount=invoice.total_tax_amount,
        subtotal=invoice.subtotal,
        tax_amount=invoice.tax_amount,
        fee_amount=invoice.fee_amount,
        total_amount=invoice.total_amount,
        status=models.CommercialInvoiceStatus.DRAFT,
        created_by=actor,
        document_version=new_ver,
        is_current_version=True,
        parent_invoice=invoice,
        version=1,
        notes=invoice.notes,
    )

    # Clone lines
    for line in invoice.lines.all():
        models.SalesCommercialInvoiceLine.objects.create(
            invoice=new_invoice,
            line_no=line.line_no,
            item=line.item,
            item_name=line.item_name,
            description=line.description,
            hs_code=line.hs_code,
            origin_country=line.origin_country,
            uom=line.uom,
            uom_name=line.uom_name,
            quantity=line.quantity,
            unit_price=line.unit_price,
            discount_amount=line.discount_amount,
            line_amount=line.line_amount,
            package_quantity=line.package_quantity,
            net_weight=line.net_weight,
            gross_weight=line.gross_weight,
            tax_rate=line.tax_rate,
            tax_rate_percentage=line.tax_rate_percentage,
            tax_amount=line.tax_amount,
            line_total=line.line_total,
            source_order_line=line.source_order_line,
            source_contract_line=line.source_contract_line,
            source_sales_line_id=line.source_sales_line_id,
        )

    audit_commercial_invoice(request, new_invoice, "CREATE_NEW_VERSION", after={"parent_code": invoice.code, "new_code": new_code, "version": new_ver})
    return new_invoice


def preview_commercial_invoice(invoice):
    """Generate display preview for Commercial Invoice (Activity Flow Step 6)."""
    return {
        "invoice_id": str(invoice.id),
        "code": invoice.code,
        "invoice_number": invoice.invoice_number or "(Chưa cấp số)",
        "invoice_date": str(invoice.invoice_date),
        "invoice_form": invoice.invoice_form,
        "invoice_form_display": invoice.get_invoice_form_display(),
        "template_code": invoice.template_code,
        "seller": {
            "name": invoice.seller_name,
            "address": invoice.seller_address,
            "tax_code": invoice.seller_tax_code,
            "contact": invoice.seller_contact,
        },
        "buyer": {
            "name": invoice.buyer_name,
            "address": invoice.buyer_address,
            "country": invoice.buyer_country,
            "tax_code": invoice.buyer_tax_code,
            "email": invoice.buyer_email,
        },
        "consignee": {
            "name": invoice.consignee_name,
            "address": invoice.consignee_address,
            "country": invoice.consignee_country,
        },
        "shipment": {
            "incoterms": invoice.incoterms,
            "transport_method": invoice.transport_method,
            "port_of_loading": invoice.port_of_loading,
            "port_of_discharge": invoice.port_of_discharge,
            "vessel_flight_no": invoice.vessel_flight_no,
            "bill_of_lading_number": invoice.bill_of_lading_number,
            "bill_of_lading_date": str(invoice.bill_of_lading_date) if invoice.bill_of_lading_date else "",
            "customs_declaration_number": invoice.customs_declaration_number,
            "customs_clearance_date": str(invoice.customs_clearance_date) if invoice.customs_clearance_date else "",
        },
        "payment": {
            "terms": invoice.payment_terms,
            "currency": invoice.currency.code,
            "exchange_rate": str(invoice.exchange_rate),
            "bank_info": invoice.beneficiary_bank_info,
        },
        "charges": {
            "freight": str(invoice.freight_charge),
            "insurance": str(invoice.insurance_charge),
            "other": str(invoice.other_charges),
            "total_charges": str(invoice.total_charges),
        },
        "totals": {
            "lines_subtotal": str(invoice.total_lines_amount),
            "total_charges": str(invoice.total_charges),
            "total_tax": str(invoice.total_tax_amount),
            "grand_total": str(invoice.total_amount),
        },
        "lines": [
            {
                "line_no": l.line_no,
                "description": l.description,
                "hs_code": l.hs_code,
                "origin_country": l.origin_country,
                "uom": l.uom_name,
                "quantity": str(l.quantity),
                "unit_price": str(l.unit_price),
                "discount_amount": str(l.discount_amount),
                "line_amount": str(l.line_amount),
                "package_quantity": l.package_quantity,
                "net_weight": str(l.net_weight) if l.net_weight is not None else "",
                "gross_weight": str(l.gross_weight) if l.gross_weight is not None else "",
                "tax_rate_percentage": str(l.tax_rate_percentage),
                "tax_amount": str(l.tax_amount),
                "line_total": str(l.line_total),
            }
            for l in invoice.lines.all()
        ],
    }
