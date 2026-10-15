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
from . import models
from master_data.models import Item, Party, TaxRate, UnitOfMeasure


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


def audit_discount_invoice(request, obj, action, before=None, after=None, reason=""):
    """Record an audit trail entry for a discount invoice (BR-SAL-13-14)."""
    actor = actor_for(request)
    company = getattr(obj, "company", None)
    req = request if request and hasattr(request, "user") else None
    try:
        record_audit(
            company=company,
            actor_user=actor,
            module_code="SAL",
            action_code=f"DISCOUNT_INVOICE_{action}",
            entity=obj,
            before=before or {},
            after=after or {
                "status": getattr(obj, "status", None),
                "number": getattr(obj, "number", None),
                "code": getattr(obj, "code", None),
                "version": getattr(obj, "version", None),
            },
            request=req,
            reason=reason,
        )
    except Exception:
        pass


def generate_discount_invoice_code(company, date_val=None):
    """Generate unique internal discount invoice code: HDCK-YYYY-XXXX (Table 2.1)."""
    current_year = date_val.year if date_val else timezone.now().year
    counter, _ = models.SalesDiscountInvoiceCounter.objects.select_for_update().get_or_create(
        company=company,
        year=current_year,
        defaults={"value": 0},
    )
    counter.value += 1
    counter.save(update_fields=["value"])
    return f"HDCK-{current_year}-{counter.value:04d}"


def get_line_tax_rate_percentage(invoice_line):
    """Retrieve tax rate percentage from original sales invoice line."""
    tax_rate = invoice_line.tax_rate
    if not tax_rate:
        return Decimal("0")
    rate_val = getattr(tax_rate, "rate_percent", None)
    if rate_val is None:
        rate_val = getattr(tax_rate, "rate", 0)
    return Decimal(str(rate_val or 0))


def get_eligible_invoices_and_lines(company, customer_id, period_start, period_end, currency_id=None, exclude_invoice_id=None):
    """
    Query issued sales invoices for the customer within the period and calculate eligible revenue per line.
    (Pre-condition, Bước 2-3, BR-SAL-13-03, BR-SAL-13-07)
    """
    if isinstance(period_start, str):
        period_start = date.fromisoformat(period_start)
    if isinstance(period_end, str):
        period_end = date.fromisoformat(period_end)

    if period_end < period_start:
        raise ValidationError({"period_end": "Ngày kết thúc kỳ chiết khấu không được trước ngày bắt đầu."})

    qs = models.SalesInvoice.objects.filter(
        company=company,
        customer_id=customer_id,
        status=models.SalesInvoice.Status.ISSUED,
        invoice_date__gte=period_start,
        invoice_date__lte=period_end,
    ).select_related("currency", "customer")

    if currency_id:
        qs = qs.filter(currency_id=currency_id)

    invoices = list(qs)
    if not invoices:
        return {
            "eligible_invoices_count": 0,
            "eligible_lines_count": 0,
            "total_eligible_revenue": Decimal("0"),
            "lines": [],
        }

    # Verify all invoices belong to the same buyer tax code / legal name (BR-SAL-13-03, EF-03)
    first_buyer_tax_code = (invoices[0].buyer_tax_code or "").strip()
    first_buyer_name = (invoices[0].buyer_name or "").strip()
    first_currency_id = invoices[0].currency_id

    for inv in invoices[1:]:
        if (inv.buyer_tax_code or "").strip() != first_buyer_tax_code or (inv.buyer_name or "").strip() != first_buyer_name:
            raise ValidationError("Các hóa đơn gốc được chọn không cùng thông tin người mua (BR-SAL-13-03, EF-03).")
        if inv.currency_id != first_currency_id:
            raise ValidationError("Các hóa đơn gốc được chọn không cùng loại tiền (BR-SAL-13-03, EF-03).")

    # Fetch all lines for these invoices
    inv_ids = [inv.id for inv in invoices]
    all_lines = models.SalesInvoiceLine.objects.filter(
        invoice_id__in=inv_ids
    ).select_related("invoice", "item", "uom", "tax_rate")

    # Fetch used and held discounts on these lines
    # 1. Used = issued discount invoices
    used_map = {}
    used_qs = models.SalesDiscountInvoiceLine.objects.filter(
        original_invoice_line_id__in=[l.id for l in all_lines],
        invoice__status=models.DiscountInvoiceStatus.ISSUED,
    ).values("original_invoice_line_id").annotate(total_used=Sum("allocated_discount_amount"))
    for row in used_qs:
        used_map[row["original_invoice_line_id"]] = Decimal(str(row["total_used"] or 0))

    # 2. Held = active non-issued discount invoices (DRAFT, PENDING_APPROVAL, REVISION_REQUIRED, APPROVED, ISSUING)
    held_map = {}
    held_query = models.SalesDiscountInvoiceLine.objects.filter(
        original_invoice_line_id__in=[l.id for l in all_lines],
        invoice__status__in=[
            models.DiscountInvoiceStatus.DRAFT,
            models.DiscountInvoiceStatus.PENDING_APPROVAL,
            models.DiscountInvoiceStatus.REVISION_REQUIRED,
            models.DiscountInvoiceStatus.APPROVED,
            models.DiscountInvoiceStatus.ISSUING,
        ],
    )
    if exclude_invoice_id:
        held_query = held_query.exclude(invoice_id=exclude_invoice_id)
    held_qs = held_query.values("original_invoice_line_id").annotate(total_held=Sum("allocated_discount_amount"))
    for row in held_qs:
        held_map[row["original_invoice_line_id"]] = Decimal(str(row["total_held"] or 0))

    eligible_lines = []
    total_revenue = Decimal("0")

    for line in all_lines:
        line_rev = Decimal(str(line.amount or 0)) - Decimal(str(line.discount_amount or 0))
        used = used_map.get(line.id, Decimal("0"))
        held = held_map.get(line.id, Decimal("0"))
        rem_rev = max(Decimal("0"), line_rev - used - held)

        if rem_rev > Decimal("0"):
            tax_pct = get_line_tax_rate_percentage(line)
            eligible_lines.append({
                "original_invoice_id": str(line.invoice_id),
                "original_invoice_series": line.invoice.invoice_series,
                "original_invoice_number": line.invoice.invoice_number or line.invoice.number,
                "original_invoice_date": line.invoice.invoice_date.isoformat(),
                "original_invoice_line_id": str(line.id),
                "line_no": line.line_no,
                "item_id": str(line.item_id) if line.item_id else None,
                "item_name": line.item_name or (line.item.name if line.item else ""),
                "description": line.description,
                "uom_id": str(line.uom_id) if line.uom_id else None,
                "uom_name": line.uom.name if line.uom else "",
                "original_amount": str(line_rev),
                "used_discount_amount": str(used),
                "held_discount_amount": str(held),
                "eligible_revenue": str(rem_rev),
                "tax_rate_id": str(line.tax_rate_id) if line.tax_rate_id else None,
                "tax_rate_percentage": str(tax_pct),
            })
            total_revenue += rem_rev

    return {
        "eligible_invoices_count": len(invoices),
        "eligible_lines_count": len(eligible_lines),
        "total_eligible_revenue": total_revenue,
        "buyer_name": first_buyer_name,
        "buyer_tax_code": first_buyer_tax_code,
        "currency_id": str(first_currency_id),
        "lines": eligible_lines,
    }


def calculate_allocation(total_discount_before_tax, lines_data):
    """
    Proportionately allocate total discount to lines based on eligible revenue (BR-SAL-13-04, BR-SAL-13-05).
    Rounding difference is assigned to the line with the largest eligible revenue (BR-SAL-13-05).
    Tax is calculated per line's original tax rate (BR-SAL-13-06).
    """
    total_disc = Decimal(str(total_discount_before_tax or 0))
    if total_disc <= 0:
        raise ValidationError({"total_discount_before_tax": "Tổng tiền chiết khấu phải lớn hơn 0."})

    if not lines_data:
        raise ValidationError({"lines": "Cần có ít nhất một dòng hóa đơn gốc để phân bổ chiết khấu (EF-02)."})

    total_eligible = sum(Decimal(str(r.get("eligible_revenue") or 0)) for r in lines_data)
    if total_eligible <= 0:
        raise ValidationError({"lines": "Tổng doanh số đủ điều kiện phải lớn hơn 0."})

    if total_disc > total_eligible:
        raise ValidationError({
            "total_discount_before_tax": f"Tổng chiết khấu trước thuế ({total_disc}) không được vượt quá tổng doanh số đủ điều kiện ({total_eligible}) (EF-04)."
        })

    allocated_lines = []
    running_disc_sum = Decimal("0")
    max_rev_index = 0
    max_rev_val = Decimal("-1")

    # Step 1: Calculate initial proportional allocation
    for idx, row in enumerate(lines_data):
        rev = Decimal(str(row.get("eligible_revenue") or 0))
        if rev > max_rev_val:
            max_rev_val = rev
            max_rev_index = idx

        # Line allocated discount = round(total_disc * rev / total_eligible, 2)
        prop_disc = (total_disc * rev / total_eligible).quantize(Decimal("0.01"))
        running_disc_sum += prop_disc
        allocated_lines.append({
            "row": row,
            "allocated_discount_amount": prop_disc,
        })

    # Step 2: Assign rounding difference to the line with largest eligible revenue (BR-SAL-13-05)
    rounding_diff = total_disc - running_disc_sum
    if rounding_diff != Decimal("0"):
        allocated_lines[max_rev_index]["allocated_discount_amount"] += rounding_diff

    # Step 3: Compute tax and line totals
    result_lines = []
    total_tax = Decimal("0")

    for idx, item in enumerate(allocated_lines, 1):
        row = item["row"]
        alloc_amt = item["allocated_discount_amount"]
        tax_pct = Decimal(str(row.get("tax_rate_percentage") or 0))
        adj_tax = (alloc_amt * tax_pct / Decimal("100")).quantize(Decimal("0.01"))
        line_tot = alloc_amt + adj_tax

        total_tax += adj_tax
        result_lines.append({
            "line_no": row.get("line_no", idx),
            "original_invoice": row.get("original_invoice") or row.get("original_invoice_id"),
            "original_invoice_series": row.get("original_invoice_series", ""),
            "original_invoice_number": row.get("original_invoice_number", ""),
            "original_invoice_date": row.get("original_invoice_date"),
            "original_invoice_line": row.get("original_invoice_line") or row.get("original_invoice_line_id"),
            "item": row.get("item") or row.get("item_id"),
            "item_name": row.get("item_name", ""),
            "description": row.get("description", ""),
            "uom": row.get("uom") or row.get("uom_id"),
            "eligible_revenue": row.get("eligible_revenue"),
            "used_discount_amount": row.get("used_discount_amount", 0),
            "held_discount_amount": row.get("held_discount_amount", 0),
            "allocated_discount_amount": alloc_amt,
            "tax_rate": row.get("tax_rate") or row.get("tax_rate_id"),
            "tax_rate_percentage": tax_pct,
            "adjusted_tax_amount": adj_tax,
            "line_total": line_tot,
        })

    total_adjusted = total_disc + total_tax
    return {
        "total_discount_before_tax": total_disc,
        "total_tax_amount": total_tax,
        "total_adjusted_amount": total_adjusted,
        "lines": result_lines,
    }


def validate_discount_invoice_data(company, data, instance=None):
    """
    Validate all fields, basis, period, original invoices, and allocation consistency.
    (BR-SAL-13-01 to BR-SAL-13-09, EF-02 to EF-07)
    """
    # 1. Customer
    customer_id = data.get("customer") or (instance.customer_id if instance else None)
    if not customer_id:
        raise ValidationError({"customer": "Khách hàng là bắt buộc."})
    from master_data.models import Party
    customer = Party.objects.filter(pk=customer_id, company=company).first()
    if not customer:
        raise ValidationError({"customer": "Khách hàng không tồn tại trong doanh nghiệp."})

    # 2. Branch
    branch_id = data.get("branch") or (instance.branch_id if instance else None)
    branch = None
    if branch_id:
        from organization.models import Branch
        branch = Branch.objects.filter(pk=branch_id, company=company).first()
        if not branch:
            raise ValidationError({"branch": "Chi nhánh phải thuộc cùng doanh nghiệp."})

    # 3. Discount basis & period (BR-SAL-13-02, EF-02)
    discount_basis = str(data.get("discount_basis") or (instance.discount_basis if instance else "")).strip()
    if not discount_basis:
        raise ValidationError({"discount_basis": "Căn cứ chiết khấu là bắt buộc (BR-SAL-13-02, EF-02)."})

    period_start = data.get("period_start") or (instance.period_start if instance else None)
    period_end = data.get("period_end") or (instance.period_end if instance else None)
    if not period_start or not period_end:
        raise ValidationError({"period": "Kỳ chiết khấu (ngày bắt đầu và kết thúc) là bắt buộc."})
    if isinstance(period_start, str):
        period_start = date.fromisoformat(period_start)
    if isinstance(period_end, str):
        period_end = date.fromisoformat(period_end)
    if period_end < period_start:
        raise ValidationError({"period_end": "Ngày kết thúc kỳ chiết khấu không được trước ngày bắt đầu."})

    # 4. Invoice series & template
    invoice_series = str(data.get("invoice_series") or (instance.invoice_series if instance else "")).strip()
    if not invoice_series:
        raise ValidationError({"invoice_series": "Mẫu/Ký hiệu hóa đơn là bắt buộc."})
    template_code = str(data.get("template_code") or (instance.template_code if instance else "")).strip()

    invoice_date = data.get("invoice_date") or (instance.invoice_date if instance else timezone.now().date())
    if isinstance(invoice_date, str):
        invoice_date = date.fromisoformat(invoice_date)

    # 5. Currency
    currency_id = data.get("currency") or (instance.currency_id if instance else None)
    from master_data.models import Currency
    if currency_id:
        currency = Currency.objects.filter(pk=currency_id).first()
    else:
        currency = Currency.objects.filter(code="VND").first()
    if not currency:
        raise ValidationError({"currency": "Loại tiền không hợp lệ."})

    exchange_rate = Decimal(str(data.get("exchange_rate") or (instance.exchange_rate if instance else "1")))
    if exchange_rate <= 0:
        raise ValidationError({"exchange_rate": "Tỷ giá phải lớn hơn 0."})

    # 6. Contract link (optional)
    contract_id = data.get("contract") or (instance.contract_id if instance else None)
    contract = None
    if contract_id:
        contract = models.SalesContract.objects.filter(pk=contract_id, company=company).first()

    # 7. Lines / Allocation Schedule
    raw_lines = data.get("lines")
    if raw_lines is None and instance:
        raw_lines = [
            {
                "line_no": l.line_no,
                "original_invoice": l.original_invoice_id,
                "original_invoice_series": l.original_invoice_series,
                "original_invoice_number": l.original_invoice_number,
                "original_invoice_date": l.original_invoice_date,
                "original_invoice_line": l.original_invoice_line_id,
                "item": l.item_id,
                "item_name": l.item_name,
                "description": l.description,
                "uom": l.uom_id,
                "eligible_revenue": l.eligible_revenue,
                "used_discount_amount": l.used_discount_amount,
                "held_discount_amount": l.held_discount_amount,
                "allocated_discount_amount": l.allocated_discount_amount,
                "tax_rate": l.tax_rate_id,
                "tax_rate_percentage": l.tax_rate_percentage,
                "adjusted_tax_amount": l.adjusted_tax_amount,
                "line_total": l.line_total,
            }
            for l in instance.lines.all()
        ]

    if not raw_lines:
        raise ValidationError({"lines": "Bảng kê phân bổ chiết khấu cần có ít nhất một dòng hóa đơn gốc (EF-02)."})

    # 8. Calculation Method & Total Discount
    calc_method = data.get("calculation_method") or (instance.calculation_method if instance else models.DiscountInvoiceCalculationMethod.AMOUNT)
    discount_rate = Decimal(str(data.get("discount_rate") or (instance.discount_rate if instance else 0)))

    # Fetch original lines and verify preconditions
    original_line_ids = [r.get("original_invoice_line") or r.get("original_invoice_line_id") for r in raw_lines]
    orig_lines = {
        str(l.id): l
        for l in models.SalesInvoiceLine.objects.filter(id__in=original_line_ids).select_related(
            "invoice", "item", "uom", "tax_rate"
        )
    }

    first_inv = None
    parsed_lines = []
    total_eligible_rev = Decimal("0")

    # Verify each original invoice
    for idx, r in enumerate(raw_lines, 1):
        orig_line_id = str(r.get("original_invoice_line") or r.get("original_invoice_line_id") or "")
        orig_line = orig_lines.get(orig_line_id)
        if not orig_line:
            raise ValidationError({"lines": f"Dòng {idx}: Dòng hóa đơn gốc không tồn tại."})

        inv = orig_line.invoice
        if inv.company_id != company.id or inv.customer_id != customer.id:
            raise ValidationError({"lines": f"Dòng {idx}: Hóa đơn gốc không thuộc cùng khách hàng hoặc doanh nghiệp."})

        if inv.status != models.SalesInvoice.Status.ISSUED:
            raise ValidationError({"lines": f"Dòng {idx}: Hóa đơn gốc ({inv.number}) chưa phát hành thành công."})

        if inv.invoice_date < period_start or inv.invoice_date > period_end:
            raise ValidationError({
                "lines": f"Dòng {idx}: Hóa đơn gốc ({inv.number}) không nằm trong kỳ chiết khấu [{period_start} - {period_end}]."
            })

        if first_inv is None:
            first_inv = inv
        else:
            if (inv.buyer_tax_code or "").strip() != (first_inv.buyer_tax_code or "").strip() or (inv.buyer_name or "").strip() != (first_inv.buyer_name or "").strip():
                raise ValidationError({"lines": f"Dòng {idx}: Hóa đơn gốc có người mua không khớp với các hóa đơn khác (EF-03)."})
            if inv.currency_id != first_inv.currency_id:
                raise ValidationError({"lines": f"Dòng {idx}: Hóa đơn gốc có loại tiền không khớp với các hóa đơn khác (EF-03)."})

        # Calculate remaining revenue
        line_rev = Decimal(str(orig_line.amount or 0)) - Decimal(str(orig_line.discount_amount or 0))
        # Used
        used_qs = models.SalesDiscountInvoiceLine.objects.filter(
            original_invoice_line=orig_line,
            invoice__status=models.DiscountInvoiceStatus.ISSUED,
        )
        if instance:
            used_qs = used_qs.exclude(invoice=instance)
        used_amt = used_qs.aggregate(t=Sum("allocated_discount_amount"))["t"] or Decimal("0")

        # Held
        held_qs = models.SalesDiscountInvoiceLine.objects.filter(
            original_invoice_line=orig_line,
            invoice__status__in=[
                models.DiscountInvoiceStatus.DRAFT,
                models.DiscountInvoiceStatus.PENDING_APPROVAL,
                models.DiscountInvoiceStatus.REVISION_REQUIRED,
                models.DiscountInvoiceStatus.APPROVED,
                models.DiscountInvoiceStatus.ISSUING,
            ],
        )
        if instance:
            held_qs = held_qs.exclude(invoice=instance)
        held_amt = held_qs.aggregate(t=Sum("allocated_discount_amount"))["t"] or Decimal("0")

        rem_rev = max(Decimal("0"), line_rev - used_amt - held_amt)
        total_eligible_rev += rem_rev

        tax_pct = get_line_tax_rate_percentage(orig_line)

        parsed_lines.append({
            "line_no": r.get("line_no", idx),
            "original_invoice": inv,
            "original_invoice_series": inv.invoice_series,
            "original_invoice_number": inv.invoice_number or inv.number,
            "original_invoice_date": inv.invoice_date,
            "original_invoice_line": orig_line,
            "item": orig_line.item,
            "item_name": orig_line.item_name or (orig_line.item.name if orig_line.item else ""),
            "description": orig_line.description,
            "uom": orig_line.uom,
            "eligible_revenue": rem_rev,
            "used_discount_amount": used_amt,
            "held_discount_amount": held_amt,
            "allocated_discount_amount": r.get("allocated_discount_amount"),
            "tax_rate": orig_line.tax_rate,
            "tax_rate_percentage": tax_pct,
        })

    if total_eligible_rev <= 0:
        raise ValidationError({"lines": "Tổng doanh số đủ điều kiện của các dòng đã chọn không còn khả dụng (EF-06)."})

    # Determine total discount amount
    if calc_method == models.DiscountInvoiceCalculationMethod.PERCENTAGE:
        if discount_rate <= 0 or discount_rate > 100:
            raise ValidationError({"discount_rate": "Tỷ lệ chiết khấu phải lớn hơn 0 và không vượt quá 100% (BR-SAL-13-04)."})
        total_discount_before_tax = (total_eligible_rev * discount_rate / Decimal("100")).quantize(Decimal("0.01"))
    else:
        raw_total = data.get("total_discount_before_tax") or (instance.total_discount_before_tax if instance else None)
        if raw_total is None:
            # Check if sum of manual allocated lines is provided
            sum_lines = sum(Decimal(str(p.get("allocated_discount_amount") or 0)) for p in parsed_lines)
            if sum_lines > 0:
                raw_total = sum_lines
            else:
                raise ValidationError({"total_discount_before_tax": "Tổng chiết khấu trước thuế là bắt buộc."})
        total_discount_before_tax = Decimal(str(raw_total))

    if total_discount_before_tax <= 0:
        raise ValidationError({"total_discount_before_tax": "Tổng chiết khấu trước thuế phải lớn hơn 0."})

    if total_discount_before_tax > total_eligible_rev:
        raise ValidationError({
            "total_discount_before_tax": f"Tổng chiết khấu trước thuế ({total_discount_before_tax}) không được vượt quá doanh số đủ điều kiện ({total_eligible_rev}) (EF-04)."
        })

    # Check if manual allocation was provided or automatic proportional allocation needed
    has_manual_allocation = any(p["allocated_discount_amount"] is not None for p in parsed_lines)
    final_lines = []

    if has_manual_allocation:
        sum_manual = Decimal("0")
        total_tax_amount = Decimal("0")
        for idx, p in enumerate(parsed_lines, 1):
            alloc_amt = Decimal(str(p["allocated_discount_amount"] or 0))
            if alloc_amt < 0:
                raise ValidationError({"lines": f"Dòng {idx}: Tiền chiết khấu phân bổ không được âm."})
            if alloc_amt > p["eligible_revenue"]:
                raise ValidationError({
                    "lines": f"Dòng {idx}: Tiền chiết khấu phân bổ ({alloc_amt}) vượt quá doanh số đủ điều kiện còn lại ({p['eligible_revenue']}) (EF-04, EF-06)."
                })
            sum_manual += alloc_amt
            tax_pct = p["tax_rate_percentage"]
            adj_tax = (alloc_amt * tax_pct / Decimal("100")).quantize(Decimal("0.01"))
            line_tot = alloc_amt + adj_tax
            total_tax_amount += adj_tax

            p["allocated_discount_amount"] = alloc_amt
            p["adjusted_tax_amount"] = adj_tax
            p["line_total"] = line_tot
            final_lines.append(p)

        if sum_manual != total_discount_before_tax:
            raise ValidationError({
                "lines": f"Tổng tiền chiết khấu phân bổ các dòng ({sum_manual}) không khớp với tổng chiết khấu trước thuế ({total_discount_before_tax}) (EF-05)."
            })
    else:
        # Automatic allocation (BR-SAL-13-05)
        alloc_res = calculate_allocation(total_discount_before_tax, parsed_lines)
        total_tax_amount = alloc_res["total_tax_amount"]
        final_lines = alloc_res["lines"]

    total_adjusted_amount = total_discount_before_tax + total_tax_amount

    # Description (Table 2.1)
    description = str(data.get("description") or (instance.description if instance else "")).strip()
    if not description:
        description = f"Chiết khấu thương mại kỳ {period_start.strftime('%d/%m/%Y')} - {period_end.strftime('%d/%m/%Y')} theo {discount_basis}"

    buyer_email = str(data.get("buyer_email") or (instance.buyer_email if instance else (first_inv.buyer_email if first_inv else getattr(customer, "email", "")))).strip()
    accounting_ref = str(data.get("accounting_document_ref") or (instance.accounting_document_ref if instance else "")).strip()

    # Seller snapshot from company
    seller_name = getattr(company, "legal_name", company.name)
    seller_tax_code = getattr(company, "tax_code", "")
    seller_address = getattr(company, "address", "")

    # Buyer snapshot from first original invoice
    buyer_name = first_inv.buyer_name if first_inv else customer.name
    buyer_legal_name = first_inv.buyer_legal_name if first_inv else customer.legal_name
    buyer_tax_code = first_inv.buyer_tax_code if first_inv else getattr(customer, "tax_code", "")
    buyer_address = first_inv.buyer_address if first_inv else getattr(customer, "address", "")

    return {
        "company": company,
        "branch": branch,
        "customer": customer,
        "discount_basis": discount_basis,
        "contract": contract,
        "period_start": period_start,
        "period_end": period_end,
        "invoice_series": invoice_series,
        "template_code": template_code,
        "invoice_date": invoice_date,
        "currency": currency,
        "exchange_rate": exchange_rate,
        "calculation_method": calc_method,
        "discount_rate": discount_rate,
        "eligible_revenue": total_eligible_rev,
        "total_discount_before_tax": total_discount_before_tax,
        "total_tax_amount": total_tax_amount,
        "total_adjusted_amount": total_adjusted_amount,
        "description": description,
        "accounting_document_ref": accounting_ref,
        "seller_name": seller_name,
        "seller_tax_code": seller_tax_code,
        "seller_address": seller_address,
        "buyer_name": buyer_name,
        "buyer_legal_name": buyer_legal_name,
        "buyer_tax_code": buyer_tax_code,
        "buyer_address": buyer_address,
        "buyer_email": buyer_email,
        "lines": final_lines,
    }


@transaction.atomic
def create_discount_invoice(request, validated_data):
    """Create a new SalesDiscountInvoice in DRAFT status (Luồng chính Bước 7)."""
    company = validated_data["company"]
    invoice_date = validated_data["invoice_date"]
    code = generate_discount_invoice_code(company, invoice_date)

    user_acc = actor_for(request)

    inv = models.SalesDiscountInvoice.objects.create(
        company=company,
        branch=validated_data["branch"],
        customer=validated_data["customer"],
        code=code,
        number=code,
        invoice_series=validated_data["invoice_series"],
        template_code=validated_data["template_code"],
        invoice_date=invoice_date,
        document_date=invoice_date,
        currency=validated_data["currency"],
        exchange_rate=validated_data["exchange_rate"],
        seller_name=validated_data["seller_name"],
        seller_tax_code=validated_data["seller_tax_code"],
        seller_address=validated_data["seller_address"],
        buyer_name=validated_data["buyer_name"],
        buyer_legal_name=validated_data["buyer_legal_name"],
        buyer_tax_code=validated_data["buyer_tax_code"],
        buyer_address=validated_data["buyer_address"],
        buyer_email=validated_data["buyer_email"],
        discount_basis=validated_data["discount_basis"],
        contract=validated_data["contract"],
        period_start=validated_data["period_start"],
        period_end=validated_data["period_end"],
        calculation_method=validated_data["calculation_method"],
        discount_rate=validated_data["discount_rate"],
        eligible_revenue=validated_data["eligible_revenue"],
        total_discount_before_tax=validated_data["total_discount_before_tax"],
        total_tax_amount=validated_data["total_tax_amount"],
        total_adjusted_amount=validated_data["total_adjusted_amount"],
        subtotal=validated_data["total_discount_before_tax"],
        tax_amount=validated_data["total_tax_amount"],
        total_amount=validated_data["total_adjusted_amount"],
        description=validated_data["description"],
        notes=validated_data["description"],
        accounting_document_ref=validated_data["accounting_document_ref"],
        status=models.DiscountInvoiceStatus.DRAFT,
        created_by=user_acc,
        version=1,
    )

    # Create lines
    for idx, l in enumerate(validated_data["lines"], 1):
        orig_inv = l["original_invoice"] if isinstance(l["original_invoice"], models.SalesInvoice) else models.SalesInvoice.objects.get(pk=l["original_invoice"])
        orig_line = l["original_invoice_line"] if isinstance(l["original_invoice_line"], models.SalesInvoiceLine) else models.SalesInvoiceLine.objects.get(pk=l["original_invoice_line"])
        item_obj = l["item"] if isinstance(l.get("item"), Item) or l.get("item") is None else Item.objects.filter(pk=l["item"]).first()
        uom_obj = l["uom"] if isinstance(l.get("uom"), UnitOfMeasure) or l.get("uom") is None else UnitOfMeasure.objects.filter(pk=l["uom"]).first()
        tax_obj = l["tax_rate"] if isinstance(l.get("tax_rate"), TaxRate) or l.get("tax_rate") is None else TaxRate.objects.filter(pk=l["tax_rate"]).first()

        models.SalesDiscountInvoiceLine.objects.create(
            invoice=inv,
            line_no=l.get("line_no", idx),
            original_invoice=orig_inv,
            original_invoice_series=l.get("original_invoice_series") or orig_inv.invoice_series,
            original_invoice_number=l.get("original_invoice_number") or orig_inv.invoice_number or orig_inv.number,
            original_invoice_date=l.get("original_invoice_date") or orig_inv.invoice_date,
            original_invoice_line=orig_line,
            item=item_obj,
            item_name=l.get("item_name") or orig_line.item_name,
            description=l.get("description") or orig_line.description,
            uom=uom_obj,
            eligible_revenue=Decimal(str(l.get("eligible_revenue") or 0)),
            used_discount_amount=Decimal(str(l.get("used_discount_amount") or 0)),
            held_discount_amount=Decimal(str(l.get("held_discount_amount") or 0)),
            allocated_discount_amount=Decimal(str(l["allocated_discount_amount"])),
            tax_rate=tax_obj,
            tax_rate_percentage=Decimal(str(l.get("tax_rate_percentage") or 0)),
            adjusted_tax_amount=Decimal(str(l["adjusted_tax_amount"])),
            line_total=Decimal(str(l["line_total"])),
        )

    audit_discount_invoice(request, inv, "CREATE", after={"status": inv.status, "code": inv.code, "total": str(inv.total_adjusted_amount)})
    return inv


@transaction.atomic
def update_discount_invoice(request, invoice, validated_data):
    """Update a discount invoice in DRAFT or REVISION_REQUIRED status (AF-04, EF-10)."""
    invoice = models.SalesDiscountInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status in (models.DiscountInvoiceStatus.ISSUING, models.DiscountInvoiceStatus.ISSUED):
        raise ValidationError("Không thể sửa hóa đơn đang phát hành hoặc đã phát hành (EF-10).")

    if invoice.status not in (models.DiscountInvoiceStatus.DRAFT, models.DiscountInvoiceStatus.REVISION_REQUIRED):
        raise ValidationError(f"Không thể sửa hóa đơn ở trạng thái {invoice.get_status_display()}. Hóa đơn Đã duyệt phải đưa về Nháp trước khi sửa (AF-03).")

    # Update header
    invoice.branch = validated_data["branch"]
    invoice.customer = validated_data["customer"]
    invoice.invoice_series = validated_data["invoice_series"]
    invoice.template_code = validated_data["template_code"]
    invoice.invoice_date = validated_data["invoice_date"]
    invoice.document_date = validated_data["invoice_date"]
    invoice.currency = validated_data["currency"]
    invoice.exchange_rate = validated_data["exchange_rate"]
    invoice.discount_basis = validated_data["discount_basis"]
    invoice.contract = validated_data["contract"]
    invoice.period_start = validated_data["period_start"]
    invoice.period_end = validated_data["period_end"]
    invoice.calculation_method = validated_data["calculation_method"]
    invoice.discount_rate = validated_data["discount_rate"]
    invoice.eligible_revenue = validated_data["eligible_revenue"]
    invoice.total_discount_before_tax = validated_data["total_discount_before_tax"]
    invoice.total_tax_amount = validated_data["total_tax_amount"]
    invoice.total_adjusted_amount = validated_data["total_adjusted_amount"]
    invoice.subtotal = validated_data["total_discount_before_tax"]
    invoice.tax_amount = validated_data["total_tax_amount"]
    invoice.total_amount = validated_data["total_adjusted_amount"]
    invoice.description = validated_data["description"]
    invoice.notes = validated_data["description"]
    invoice.accounting_document_ref = validated_data["accounting_document_ref"]
    invoice.buyer_email = validated_data["buyer_email"]
    invoice.version += 1
    invoice.save()

    # Recreate lines
    invoice.lines.all().delete()
    for idx, l in enumerate(validated_data["lines"], 1):
        orig_inv = l["original_invoice"] if isinstance(l["original_invoice"], models.SalesInvoice) else models.SalesInvoice.objects.get(pk=l["original_invoice"])
        orig_line = l["original_invoice_line"] if isinstance(l["original_invoice_line"], models.SalesInvoiceLine) else models.SalesInvoiceLine.objects.get(pk=l["original_invoice_line"])
        item_obj = l["item"] if isinstance(l.get("item"), Item) or l.get("item") is None else Item.objects.filter(pk=l["item"]).first()
        uom_obj = l["uom"] if isinstance(l.get("uom"), UnitOfMeasure) or l.get("uom") is None else UnitOfMeasure.objects.filter(pk=l["uom"]).first()
        tax_obj = l["tax_rate"] if isinstance(l.get("tax_rate"), TaxRate) or l.get("tax_rate") is None else TaxRate.objects.filter(pk=l["tax_rate"]).first()

        models.SalesDiscountInvoiceLine.objects.create(
            invoice=invoice,
            line_no=l.get("line_no", idx),
            original_invoice=orig_inv,
            original_invoice_series=l.get("original_invoice_series") or orig_inv.invoice_series,
            original_invoice_number=l.get("original_invoice_number") or orig_inv.invoice_number or orig_inv.number,
            original_invoice_date=l.get("original_invoice_date") or orig_inv.invoice_date,
            original_invoice_line=orig_line,
            item=item_obj,
            item_name=l.get("item_name") or orig_line.item_name,
            description=l.get("description") or orig_line.description,
            uom=uom_obj,
            eligible_revenue=Decimal(str(l.get("eligible_revenue") or 0)),
            used_discount_amount=Decimal(str(l.get("used_discount_amount") or 0)),
            held_discount_amount=Decimal(str(l.get("held_discount_amount") or 0)),
            allocated_discount_amount=Decimal(str(l["allocated_discount_amount"])),
            tax_rate=tax_obj,
            tax_rate_percentage=Decimal(str(l.get("tax_rate_percentage") or 0)),
            adjusted_tax_amount=Decimal(str(l["adjusted_tax_amount"])),
            line_total=Decimal(str(l["line_total"])),
        )

    audit_discount_invoice(request, invoice, "UPDATE", after={"status": invoice.status, "code": invoice.code, "version": invoice.version})
    return invoice


@transaction.atomic
def delete_discount_invoice(request, invoice):
    """Delete a DRAFT discount invoice, releasing held discounts (AF-07, BR-SAL-13-08, EF-10)."""
    invoice = models.SalesDiscountInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.DiscountInvoiceStatus.DRAFT:
        raise ValidationError("Chỉ được xóa hóa đơn ở trạng thái Nháp (AF-07, EF-10).")

    audit_discount_invoice(request, invoice, "DELETE", before={"code": invoice.code, "status": invoice.status})
    invoice.lines.all().delete()
    invoice.delete()
    return True


@transaction.atomic
def submit_discount_invoice_approval(request, invoice):
    """Submit discount invoice for approval (Luồng chính Bước 8, BR-SAL-13-10)."""
    invoice = models.SalesDiscountInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status not in (models.DiscountInvoiceStatus.DRAFT, models.DiscountInvoiceStatus.REVISION_REQUIRED):
        raise ValidationError(f"Không thể gửi duyệt hóa đơn ở trạng thái {invoice.get_status_display()}.")

    # Workflow lookup
    snapshot = configured_snapshot(invoice, "SAL.DISCOUNT_INVOICE")
    has_workflow = bool(snapshot and snapshot.get("version_id"))

    if not has_workflow or not invoice.approval_required:
        invoice.status = models.DiscountInvoiceStatus.APPROVED
        invoice.approved_at = timezone.now()
    else:
        invoice.status = models.DiscountInvoiceStatus.PENDING_APPROVAL
        invoice.submitted_at = timezone.now()
        invoice.workflow_snapshot = snapshot

    invoice.version += 1
    invoice.save(update_fields=["status", "submitted_at", "approved_at", "workflow_snapshot", "version", "updated_at"])
    audit_discount_invoice(request, invoice, "SUBMIT_APPROVAL", after={"status": invoice.status, "version": invoice.version})
    return invoice


@transaction.atomic
def withdraw_discount_invoice_approval(request, invoice, reason=""):
    """Withdraw an approval request, returning the invoice to DRAFT (AF-04)."""
    invoice = models.SalesDiscountInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.DiscountInvoiceStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể thu hồi hóa đơn đang Chờ duyệt.")

    invoice.status = models.DiscountInvoiceStatus.DRAFT
    invoice.withdrawal_reason = reason
    invoice.version += 1
    invoice.save(update_fields=["status", "withdrawal_reason", "version", "updated_at"])
    audit_discount_invoice(request, invoice, "WITHDRAW_APPROVAL", reason=reason, after={"status": invoice.status, "version": invoice.version})
    return invoice


@transaction.atomic
def return_approved_discount_invoice_to_draft(request, invoice):
    """Return an APPROVED invoice back to DRAFT before issuance (Bảng 3, AF-03)."""
    invoice = models.SalesDiscountInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.DiscountInvoiceStatus.APPROVED:
        raise ValidationError("Chỉ có thể đưa về Nháp khi hóa đơn đang ở trạng thái Đã duyệt.")

    invoice.status = models.DiscountInvoiceStatus.DRAFT
    invoice.approved_at = None
    invoice.version += 1
    invoice.save(update_fields=["status", "approved_at", "version", "updated_at"])
    audit_discount_invoice(request, invoice, "RETURN_TO_DRAFT", after={"status": invoice.status, "version": invoice.version})
    return invoice


def issue_discount_invoice(request, invoice, force_fail=False, error_message=""):
    """
    Issue the electronic discount invoice (Luồng chính Bước 9-10, BR-SAL-13-11, EF-08, EF-09).
    Allocates official sequential number, creates TaxInvoice in tax_management, and sets status to ISSUED.
    Does NOT create duplicate accounting journal entries or inventory deductions (BR-SAL-13-12, BR-SAL-13-13).
    """
    with transaction.atomic():
        invoice = models.SalesDiscountInvoice.objects.select_for_update().get(pk=invoice.pk)
        if invoice.status == models.DiscountInvoiceStatus.ISSUED:
            raise ValidationError("Hóa đơn đã được phát hành thành công trước đó.")
        if invoice.status == models.DiscountInvoiceStatus.ISSUING:
            raise ValidationError("Hóa đơn đang trong quá trình phát hành. Vui lòng kiểm tra lại kết quả giao dịch (EF-09).")

        # Approval check (BR-SAL-13-10)
        snapshot = configured_snapshot(invoice, "SAL.DISCOUNT_INVOICE")
        has_workflow = bool(snapshot and snapshot.get("version_id"))
        if has_workflow and invoice.approval_required:
            if invoice.status != models.DiscountInvoiceStatus.APPROVED:
                raise ValidationError(f"Chỉ hóa đơn Đã duyệt mới có thể phát hành (trạng thái hiện tại: {invoice.get_status_display()}) (BR-SAL-13-10).")
        else:
            if invoice.status not in (models.DiscountInvoiceStatus.DRAFT, models.DiscountInvoiceStatus.APPROVED, models.DiscountInvoiceStatus.ISSUE_FAILED):
                raise ValidationError(f"Không thể phát hành hóa đơn ở trạng thái {invoice.get_status_display()}.")

        if not invoice.issue_control_code:
            invoice.issue_control_code = f"ISSUE-DI-{invoice.company.code}-{invoice.code}-{uuid.uuid4().hex[:8].upper()}"

        invoice.status = models.DiscountInvoiceStatus.ISSUING
        invoice.save(update_fields=["status", "issue_control_code", "updated_at"])

    # Simulate / call provider integration
    is_failed = force_fail or (hasattr(request, "data") and request.data.get("force_fail"))
    fail_msg = error_message or (request.data.get("error_message") if hasattr(request, "data") else "") or "Nhà cung cấp hóa đơn điện tử từ chối phát hành (EF-08)."

    if is_failed:
        invoice.status = models.DiscountInvoiceStatus.ISSUE_FAILED
        invoice.issue_error_message = fail_msg
        invoice.version += 1
        invoice.save(update_fields=["status", "issue_error_message", "version", "updated_at"])
        audit_discount_invoice(request, invoice, "ISSUE_FAILED", after={"status": invoice.status, "error": fail_msg})
        return invoice

    with transaction.atomic():
        counter_year = invoice.invoice_date.year
        c, _ = models.SalesInvoiceCounter.objects.select_for_update().get_or_create(company=invoice.company, year=counter_year)
        c.value += 1
        c.save(update_fields=["value"])
        official_number = f"{c.value:07d}"

        transaction_code = f"TX-{invoice.issue_control_code}"
        lookup_code = uuid.uuid4().hex[:10].upper()
        xml_url = f"/media/invoices/{invoice.company.code}/{counter_year}/{invoice.invoice_series}_{official_number}.xml"
        pdf_url = f"/media/invoices/{invoice.company.code}/{counter_year}/{invoice.invoice_series}_{official_number}.pdf"
        lookup_url = f"https://hoadondientu.gdt.gov.vn/tra-cuu?code={lookup_code}"

        # Create TaxInvoice in tax_management (BR-SAL-13-11)
        tax_branch = invoice.branch or invoice.company.branches.first()
        from tax_management.models import TaxInvoice, TaxInvoiceLine, InvoiceDirection, InvoiceStatus
        tax_inv = TaxInvoice.objects.create(
            company=invoice.company,
            branch=tax_branch,
            direction=InvoiceDirection.OUTPUT,
            invoice_type="ADJUSTMENT",
            adjustment_effect="DECREASE",
            invoice_series=invoice.invoice_series,
            invoice_number=official_number,
            invoice_date=invoice.invoice_date,
            seller_name=invoice.seller_name,
            seller_tax_code=invoice.seller_tax_code,
            buyer_name=invoice.buyer_name,
            buyer_tax_code=invoice.buyer_tax_code,
            party=invoice.customer,
            currency=invoice.currency,
            exchange_rate=invoice.exchange_rate,
            subtotal=invoice.total_discount_before_tax,
            tax_amount=invoice.total_tax_amount,
            total_amount=invoice.total_adjusted_amount,
            source="SALES",
            source_reference=invoice.code,
            external_reference=transaction_code,
            status=InvoiceStatus.ISSUED,
            issued_at=timezone.now(),
            created_by=actor_for(request),
        )

        for line in invoice.lines.all():
            TaxInvoiceLine.objects.create(
                invoice=tax_inv,
                line_no=line.line_no,
                item=line.item,
                description=line.description or line.item_name or "Chiết khấu thương mại",
                quantity=Decimal("1"),
                unit_price=line.allocated_discount_amount,
                discount_amount=Decimal("0"),
                taxable_amount=line.allocated_discount_amount,
                tax_rate=line.tax_rate_percentage,
                tax_amount=line.adjusted_tax_amount,
                total_amount=line.line_total,
            )

        invoice.invoice_number = official_number
        invoice.transaction_code = transaction_code
        invoice.lookup_code = lookup_code
        invoice.lookup_url = lookup_url
        invoice.xml_file_url = xml_url
        pdf_url = pdf_url
        invoice.pdf_file_url = pdf_url
        invoice.tax_invoice = tax_inv
        invoice.status = models.DiscountInvoiceStatus.ISSUED
        invoice.issued_at = timezone.now()
        invoice.issued_by = actor_for(request)
        invoice.issue_error_message = ""
        invoice.version += 1
        invoice.save()

        audit_discount_invoice(
            request, invoice, "ISSUE",
            after={"status": invoice.status, "invoice_number": official_number, "transaction_code": transaction_code}
        )
        return invoice


@transaction.atomic
def retry_issue_discount_invoice(request, invoice, force_fail=False, error_message=""):
    """Retry electronic invoice issuance after failure (AF-06)."""
    invoice = models.SalesDiscountInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.DiscountInvoiceStatus.ISSUE_FAILED:
        raise ValidationError("Chỉ có thể thử lại phát hành khi hóa đơn ở trạng thái Phát hành lỗi (AF-06).")

    return issue_discount_invoice(request, invoice, force_fail=force_fail, error_message=error_message)


@transaction.atomic
def check_issue_status(request, invoice):
    """Check electronic invoice status when in ISSUING (EF-09)."""
    invoice = models.SalesDiscountInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status != models.DiscountInvoiceStatus.ISSUING:
        return {"status": invoice.status, "message": "Hóa đơn không ở trạng thái Đang phát hành."}

    counter_year = invoice.invoice_date.year
    c, _ = models.SalesInvoiceCounter.objects.select_for_update().get_or_create(company=invoice.company, year=counter_year)
    c.value += 1
    c.save(update_fields=["value"])
    official_number = f"{c.value:07d}"

    transaction_code = f"TX-{invoice.issue_control_code or uuid.uuid4().hex[:8].upper()}"
    lookup_code = uuid.uuid4().hex[:10].upper()
    xml_url = f"/media/invoices/{invoice.company.code}/{counter_year}/{invoice.invoice_series}_{official_number}.xml"
    pdf_url = f"/media/invoices/{invoice.company.code}/{counter_year}/{invoice.invoice_series}_{official_number}.pdf"
    lookup_url = f"https://hoadondientu.gdt.gov.vn/tra-cuu?code={lookup_code}"

    tax_branch = invoice.branch or invoice.company.branches.first()
    from tax_management.models import TaxInvoice, TaxInvoiceLine, InvoiceDirection, InvoiceStatus
    tax_inv = TaxInvoice.objects.create(
        company=invoice.company,
        branch=tax_branch,
        direction=InvoiceDirection.OUTPUT,
        invoice_type="ADJUSTMENT",
        adjustment_effect="DECREASE",
        invoice_series=invoice.invoice_series,
        invoice_number=official_number,
        invoice_date=invoice.invoice_date,
        seller_name=invoice.seller_name,
        seller_tax_code=invoice.seller_tax_code,
        buyer_name=invoice.buyer_name,
        buyer_tax_code=invoice.buyer_tax_code,
        party=invoice.customer,
        currency=invoice.currency,
        exchange_rate=invoice.exchange_rate,
        subtotal=invoice.total_discount_before_tax,
        tax_amount=invoice.total_tax_amount,
        total_amount=invoice.total_adjusted_amount,
        source="SALES",
        source_reference=invoice.code,
        external_reference=transaction_code,
        status=InvoiceStatus.ISSUED,
        issued_at=timezone.now(),
        created_by=actor_for(request),
    )

    for line in invoice.lines.all():
        TaxInvoiceLine.objects.create(
            invoice=tax_inv,
            line_no=line.line_no,
            item=line.item,
            description=line.description or line.item_name or "Chiết khấu thương mại",
            quantity=Decimal("1"),
            unit_price=line.allocated_discount_amount,
            discount_amount=Decimal("0"),
            taxable_amount=line.allocated_discount_amount,
            tax_rate=line.tax_rate_percentage,
            tax_amount=line.adjusted_tax_amount,
            total_amount=line.line_total,
        )

    invoice.invoice_number = official_number
    invoice.transaction_code = transaction_code
    invoice.lookup_code = lookup_code
    invoice.lookup_url = lookup_url
    invoice.xml_file_url = xml_url
    invoice.pdf_file_url = pdf_url
    invoice.tax_invoice = tax_inv
    invoice.status = models.DiscountInvoiceStatus.ISSUED
    invoice.issued_at = timezone.now()
    invoice.issued_by = actor_for(request)
    invoice.issue_error_message = ""
    invoice.version += 1
    invoice.save()

    audit_discount_invoice(
        request, invoice, "ISSUE",
        after={"status": invoice.status, "invoice_number": official_number, "transaction_code": transaction_code}
    )
    return invoice


@transaction.atomic
def cancel_discount_invoice(request, invoice, reason=""):
    """Cancel an unissued discount invoice with a required reason (AF-08, BR-SAL-13-13, EF-10)."""
    invoice = models.SalesDiscountInvoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status in (models.DiscountInvoiceStatus.ISSUED, models.DiscountInvoiceStatus.ISSUING):
        raise ValidationError("Không thể hủy hóa đơn đang phát hành hoặc đã phát hành thành công (EF-10).")

    reason_str = str(reason or "").strip()
    if not reason_str:
        raise ValidationError({"cancellation_reason": "Lý do hủy hóa đơn là bắt buộc."})

    invoice.status = models.DiscountInvoiceStatus.CANCELLED
    invoice.cancellation_reason = reason_str
    invoice.version += 1
    invoice.save(update_fields=["status", "cancellation_reason", "version", "updated_at"])

    audit_discount_invoice(request, invoice, "CANCEL", reason=reason_str, after={"status": invoice.status, "version": invoice.version})
    return invoice
