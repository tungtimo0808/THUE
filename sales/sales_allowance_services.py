"""UC-SAL-06: Ghi nhận giảm giá hàng bán (Sales Allowance / Price Reduction).

Implements:
- Header & Line creation, validation, precision calculation, and rounding (BR-SAL-06-02, BR-SAL-06-06).
- Automatic document numbering (GG-YYYY-NNNNNN) and default values prefill.
- Source inheritance from GoodsSale or ServiceSale (BR-SAL-06-02, AF-02).
- Source line allowance value reservation tracking across unposted allowance documents (BR-SAL-06-04, BR-SAL-06-07, EF-03).
- Support entry by fixed amount (BY_AMOUNT) or percentage (BY_PERCENT) (AF-03).
- Proportional tax adjustment with exact remainder rounding on final reduction (BR-SAL-06-05, BR-SAL-06-06).
- Workflow management: Submit, Withdraw, Approve, Request Revision, Reject, Cancel (BR-SAL-06-08, BR-SAL-06-14).
- Posting (Ghi sổ):
  * Accounting period & postable account validation (BR-SAL-06-09, EF-04, EF-05).
  * GL JournalEntry creation:
      Nợ TK 5213/521 (Giảm giá hàng bán),
      Nợ TK 33311 (Thuế GTGT đầu ra điều chỉnh giảm),
      Có TK 131 (Công nợ khách hàng) (BR-SAL-06-10).
  * STRICTLY NO INVENTORY TRANSACTIONS AND NO COGS IMPACT (BR-SAL-06-11).
  * Accounts Receivable balance offset or refundable amount tracking (BR-SAL-06-12).
- Unposting (Bỏ ghi sổ) and invoice linking (AF-08, BR-SAL-06-13).
- Customer refund action (AF-04, BR-SAL-06-12, EF-07).
- Optimistic concurrency control and Audit Logging (BR-SAL-06-15, EF-08).
"""
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from approval_workflows.execution import approval_progress
from approval_workflows.submission import configured_snapshot
from audit_log.services import record_audit
from common_services.models import DocumentNumberingRule
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine
from general_ledger.services import post as post_journal
from accounts_receivable.models import Receivable, ReceivableStatus
from master_data.models import Currency, DocumentType, Item, Party, TaxRate, UnitOfMeasure
from . import models

MONEY = Decimal("0.0001")


def actor_for(request):
    """Retrieve IAM account or fallback user for audit and ownership tracking."""
    if hasattr(request, "user") and hasattr(request.user, "iam_account"):
        return request.user.iam_account
    return getattr(request, "user", None)


def audit(request, sale_allowance, action, before=None, after=None, reason=""):
    """Write an audit entry for sales allowance transactions."""
    actor = actor_for(request)
    if actor and hasattr(actor, "id"):
        record_audit(
            company=sale_allowance.company,
            actor_user=actor,
            module_code="SAL",
            action_code=action,
            entity=sale_allowance,
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


def generate_sales_allowance_number(company, branch=None, document_date=None):
    """Generate unique sales allowance number (GG-YYYY-NNNNNN) using DocumentNumberingRule or SalesAllowanceCounter."""
    ref_date = document_date or timezone.localdate()
    try:
        from common_services.numbering_services import generate_document_number
        doc_type = DocumentType.objects.filter(code__in=["SAL.SALES_ALLOWANCE", "GG", "SALES_ALLOWANCE", "GIAM_GIA"]).first()
        if doc_type:
            num = generate_document_number(company, doc_type, branch=branch, document_date=ref_date)
            if num:
                return num
    except Exception:
        pass

    year = ref_date.year
    with transaction.atomic():
        counter, _ = models.SalesAllowanceCounter.objects.select_for_update().get_or_create(company=company, year=year)
        while True:
            counter.value += 1
            counter.save(update_fields=["value"])
            candidate = f"GG-{year}-{counter.value:06d}"
            if not models.SalesAllowance.objects.filter(company=company, number=candidate).exists():
                return candidate


def resolve_default_accounts(company):
    """Resolve default postable accounts for sales allowance operations."""
    # Revenue deduction account (5213, fallback to 521, fallback to 511)
    revenue_deduction_acc = Account.objects.filter(
        company=company, code__startswith="5213", is_postable=True, status="ACTIVE"
    ).order_by("-code").first()
    if not revenue_deduction_acc:
        revenue_deduction_acc = Account.objects.filter(
            company=company, code__startswith="521", is_postable=True, status="ACTIVE"
        ).order_by("-code").first()
    if not revenue_deduction_acc:
        revenue_deduction_acc = Account.objects.filter(
            company=company, code__startswith="511", is_postable=True, status="ACTIVE"
        ).order_by("code").first()

    # Tax output account (33311)
    tax_acc = Account.objects.filter(
        company=company, code__startswith="33311", is_postable=True, status="ACTIVE"
    ).order_by("code").first()

    # Receivable account (131)
    receivable_acc = Account.objects.filter(
        company=company, code__startswith="131", is_postable=True, status="ACTIVE"
    ).order_by("code").first()

    return {
        "revenue_deduction_account": revenue_deduction_acc,
        "tax_account": tax_acc,
        "receivable_account": receivable_acc,
    }


def get_sales_allowance_defaults(company, branch=None, customer_id=None, goods_sale_id=None, service_sale_id=None):
    """Prefill default values for creating a new SalesAllowance document (Luồng chính Bước 2)."""
    today = timezone.localdate()
    defaults_accounts = resolve_default_accounts(company)

    data = {
        "document_date": str(today),
        "posting_date": str(today),
        "currency": "VND",
        "currency_id": None,
        "exchange_rate": "1.0",
        "customer": None,
        "customer_name": "",
        "goods_sale": None,
        "goods_sale_number": "",
        "service_sale": None,
        "service_sale_number": "",
        "source_type": None,
        "allowance_reason": "",
        "revenue_deduction_account": str(defaults_accounts["revenue_deduction_account"].id) if defaults_accounts["revenue_deduction_account"] else None,
        "tax_account": str(defaults_accounts["tax_account"].id) if defaults_accounts["tax_account"] else None,
        "receivable_account": str(defaults_accounts["receivable_account"].id) if defaults_accounts["receivable_account"] else None,
    }

    vnd = Currency.objects.filter(code="VND").first()
    if vnd:
        data["currency_id"] = str(vnd.id)

    if goods_sale_id:
        sale = models.GoodsSale.objects.filter(company=company, id=goods_sale_id).first()
        if sale:
            data["goods_sale"] = str(sale.id)
            data["goods_sale_number"] = sale.number
            data["source_type"] = "GOODS_SALE"
            data["customer"] = str(sale.customer_id)
            data["customer_name"] = sale.customer.name
            data["currency"] = sale.currency.code
            data["currency_id"] = str(sale.currency_id)
            data["exchange_rate"] = str(sale.exchange_rate)
            data["original_tax_invoice"] = str(sale.tax_invoice_id) if sale.tax_invoice_id else None
    elif service_sale_id:
        serv = models.ServiceSale.objects.filter(company=company, id=service_sale_id).first()
        if serv:
            data["service_sale"] = str(serv.id)
            data["service_sale_number"] = serv.number
            data["source_type"] = "SERVICE_SALE"
            data["customer"] = str(serv.customer_id)
            data["customer_name"] = serv.customer.name
            data["currency"] = serv.currency.code
            data["currency_id"] = str(serv.currency_id)
            data["exchange_rate"] = str(serv.exchange_rate)
            data["original_tax_invoice"] = str(serv.tax_invoice_id) if serv.tax_invoice_id else None
    elif customer_id:
        cust = Party.objects.filter(company=company, id=customer_id).first()
        if cust:
            data["customer"] = str(cust.id)
            data["customer_name"] = cust.name

    return data


def prepare_from_sale(company, goods_sale_id=None, service_sale_id=None):
    """Inspect and return available lines from a posted GoodsSale or ServiceSale (Luồng chính Bước 3, AF-02)."""
    if goods_sale_id:
        source_doc = models.GoodsSale.objects.filter(company=company, id=goods_sale_id).select_related(
            "customer", "currency", "tax_invoice"
        ).first()
        source_type = "GOODS_SALE"
    elif service_sale_id:
        source_doc = models.ServiceSale.objects.filter(company=company, id=service_sale_id).select_related(
            "customer", "currency", "tax_invoice"
        ).first()
        source_type = "SERVICE_SALE"
    else:
        raise ValidationError("Bắt buộc chỉ định goods_sale_id hoặc service_sale_id.")

    if not source_doc:
        raise ValidationError("Không tìm thấy chứng từ bán nguồn.")
    if source_doc.status != models.DocumentStatus.POSTED:
        raise ValidationError("Chứng từ bán nguồn phải ở trạng thái Đã ghi sổ (POSTED).")

    default_accs = resolve_default_accounts(company)
    lines_out = []

    for line in source_doc.lines.select_related("item", "uom", "tax_rate").order_by("line_no"):
        # Original net sales value before tax
        net_sales = (line.quantity * line.unit_price) - line.discount_amount

        # Returned value (only applicable for goods sale)
        returned_val = Decimal("0")
        if source_type == "GOODS_SALE":
            returned_lines = models.SalesReturnLine.objects.filter(
                goods_sale_line=line,
                sale_return__status=models.DocumentStatus.POSTED
            )
            for ret in returned_lines:
                returned_val += (ret.return_quantity * ret.unit_price) - ret.discount_amount

        # Already reduced value (posted allowances)
        already_reduced_val = Decimal("0")
        posted_query = models.SalesAllowanceLine.objects.filter(
            sale_allowance_posted_filter(line, source_type)
        )
        already_reduced_val = posted_query.aggregate(t=Sum("allowance_amount"))["t"] or Decimal("0")

        # Pending reduced value (unposted allowances: DRAFT, PENDING_APPROVAL, APPROVED)
        pending_reduced_val = Decimal("0")
        pending_query = models.SalesAllowanceLine.objects.filter(
            sale_allowance_pending_filter(line, source_type)
        )
        pending_reduced_val = pending_query.aggregate(t=Sum("allowance_amount"))["t"] or Decimal("0")

        remaining_val = max(Decimal("0"), net_sales - returned_val - already_reduced_val - pending_reduced_val)

        if remaining_val > Decimal("0"):
            lines_out.append({
                "line_id": str(line.id),
                "line_no": line.line_no,
                "item_id": str(line.item_id),
                "item_code": line.item.code,
                "item_name": line.item.name,
                "description": line.description or line.item.name,
                "uom_id": str(line.uom_id) if line.uom_id else None,
                "uom_name": line.uom.name if line.uom else "",
                "net_sales_value": str(net_sales),
                "returned_value": str(returned_val),
                "already_reduced_value": str(already_reduced_val),
                "pending_reduced_value": str(pending_reduced_val),
                "remaining_value": str(remaining_val),
                "entry_method": "BY_AMOUNT",
                "allowance_rate": "0",
                "allowance_amount": "0",
                "tax_rate_id": str(line.tax_rate_id) if line.tax_rate_id else None,
                "revenue_deduction_account": str(default_accs["revenue_deduction_account"].id) if default_accs["revenue_deduction_account"] else None,
                "tax_account": str(line.tax_account_id or (default_accs["tax_account"].id if default_accs["tax_account"] else None)),
                "receivable_account": str(line.receivable_or_payment_account_id or (default_accs["receivable_account"].id if default_accs["receivable_account"] else None)),
            })

    if not lines_out:
        raise ValidationError("Chứng từ bán nguồn không còn giá trị được giảm giá.")

    return {
        "company": str(company.id),
        "customer": str(source_doc.customer_id),
        "customer_name": source_doc.customer.name,
        "source_type": source_type,
        "goods_sale": str(source_doc.id) if source_type == "GOODS_SALE" else None,
        "goods_sale_number": source_doc.number if source_type == "GOODS_SALE" else "",
        "service_sale": str(source_doc.id) if source_type == "SERVICE_SALE" else None,
        "service_sale_number": source_doc.number if source_type == "SERVICE_SALE" else "",
        "currency": source_doc.currency.code,
        "currency_id": str(source_doc.currency_id),
        "exchange_rate": str(source_doc.exchange_rate),
        "original_tax_invoice": str(source_doc.tax_invoice_id) if source_doc.tax_invoice_id else None,
        "lines": lines_out,
    }


def sale_allowance_posted_filter(line, source_type):
    if source_type == "GOODS_SALE":
        return Q(goods_sale_line=line, allowance__status=models.DocumentStatus.POSTED)
    return Q(service_sale_line=line, allowance__status=models.DocumentStatus.POSTED)


def sale_allowance_pending_filter(line, source_type, exclude_allowance_id=None):
    q = Q(allowance__status__in=[
        models.DocumentStatus.DRAFT,
        models.DocumentStatus.PENDING_APPROVAL,
        models.DocumentStatus.APPROVED,
    ])
    if source_type == "GOODS_SALE":
        q &= Q(goods_sale_line=line)
    else:
        q &= Q(service_sale_line=line)
    if exclude_allowance_id:
        q &= ~Q(allowance_id=exclude_allowance_id)
    return q


def calculate_and_validate_allowance_lines(
    company,
    source_doc,
    source_type,
    lines_data,
    currency=None,
    current_allowance_id=None
):
    """Validate allowance lines, calculate amounts, enforce limits and tax adjustments (BR-SAL-06-03, BR-SAL-06-04, BR-SAL-06-05, BR-SAL-06-06)."""
    if not lines_data:
        raise ValidationError("Chứng từ giảm giá hàng bán phải có ít nhất một dòng chi tiết.")

    default_accs = resolve_default_accounts(company)
    processed_lines = []
    subtotal = Decimal("0")
    total_tax = Decimal("0")

    seen_source_lines = set()

    for idx, raw in enumerate(lines_data, start=1):
        source_line_id = raw.get("goods_sale_line_id") or raw.get("service_sale_line_id") or raw.get("line_id") or raw.get("goods_sale_line") or raw.get("service_sale_line")
        if not source_line_id:
            raise ValidationError(f"Dòng {idx}: Bắt buộc liên kết dòng bán hàng nguồn.")

        if str(source_line_id) in seen_source_lines:
            raise ValidationError(f"Dòng {idx}: Dòng bán nguồn đã được chọn trước đó trên cùng chứng từ.")
        seen_source_lines.add(str(source_line_id))

        if source_type == "GOODS_SALE":
            source_line = models.GoodsSaleLine.objects.filter(sale=source_doc, id=source_line_id).select_related("item", "uom", "tax_rate").first()
        else:
            source_line = models.ServiceSaleLine.objects.filter(sale=source_doc, id=source_line_id).select_related("item", "uom", "tax_rate").first()

        if not source_line:
            raise ValidationError(f"Dòng {idx}: Dòng bán nguồn không thuộc chứng từ bán {source_doc.number}.")

        item = source_line.item
        net_sales = (source_line.quantity * source_line.unit_price) - source_line.discount_amount

        # Returned value
        returned_val = Decimal("0")
        if source_type == "GOODS_SALE":
            for ret in models.SalesReturnLine.objects.filter(goods_sale_line=source_line, sale_return__status=models.DocumentStatus.POSTED):
                returned_val += (ret.return_quantity * ret.unit_price) - ret.discount_amount

        # Posted and pending reductions
        posted_q = models.SalesAllowanceLine.objects.filter(sale_allowance_posted_filter(source_line, source_type))
        if current_allowance_id:
            posted_q = posted_q.exclude(allowance_id=current_allowance_id)
        already_reduced_val = posted_q.aggregate(t=Sum("allowance_amount"))["t"] or Decimal("0")

        pending_q = models.SalesAllowanceLine.objects.filter(sale_allowance_pending_filter(source_line, source_type, exclude_allowance_id=current_allowance_id))
        already_pending_val = pending_q.aggregate(t=Sum("allowance_amount"))["t"] or Decimal("0")

        max_available = max(Decimal("0"), net_sales - returned_val - already_reduced_val - already_pending_val)

        entry_method = raw.get("entry_method", models.SalesAllowanceLine.EntryMethod.BY_AMOUNT)
        allowance_rate = Decimal("0")

        if entry_method == models.SalesAllowanceLine.EntryMethod.BY_PERCENT:
            try:
                allowance_rate = Decimal(str(raw.get("allowance_rate", "0")))
            except Exception:
                raise ValidationError(f"Dòng {idx}: Tỷ lệ giảm giá không hợp lệ.")
            if allowance_rate <= Decimal("0") or allowance_rate > Decimal("100"):
                raise ValidationError(f"Dòng {idx}: Tỷ lệ giảm giá phải lớn hơn 0 và không vượt quá 100%.")
            allowance_amount = round_money(max_available * (allowance_rate / Decimal("100")), currency)
        else:
            try:
                allowance_amount = Decimal(str(raw.get("allowance_amount", "0")))
            except Exception:
                raise ValidationError(f"Dòng {idx}: Số tiền giảm giá không hợp lệ.")

        if allowance_amount <= Decimal("0"):
            raise ValidationError(f"Dòng {idx}: Tiền giảm giá phải lớn hơn 0.")

        if allowance_amount > max_available:
            raise ValidationError(
                f"Dòng {idx}: Tiền giảm giá ({allowance_amount}) vượt quá giá trị còn được giảm ({max_available})."
            )

        # Tax adjustment calculation (BR-SAL-06-05, BR-SAL-06-06)
        tax_rate = source_line.tax_rate
        is_final_reduction = (already_reduced_val + allowance_amount >= (net_sales - returned_val))

        if is_final_reduction and tax_rate and tax_rate.rate_percent > Decimal("0"):
            # Lần giảm hết giá trị nhận phần chênh lệch làm tròn thuế còn lại
            total_orig_tax = source_line.tax_amount
            returned_tax = Decimal("0")
            if source_type == "GOODS_SALE":
                returned_tax = models.SalesReturnLine.objects.filter(
                    goods_sale_line=source_line, sale_return__status=models.DocumentStatus.POSTED
                ).aggregate(t=Sum("tax_amount"))["t"] or Decimal("0")

            prev_tax_allowances = models.SalesAllowanceLine.objects.filter(
                sale_allowance_posted_filter(source_line, source_type)
            )
            if current_allowance_id:
                prev_tax_allowances = prev_tax_allowances.exclude(allowance_id=current_allowance_id)
            prev_tax_reduced = prev_tax_allowances.aggregate(t=Sum("tax_amount"))["t"] or Decimal("0")

            line_tax = max(Decimal("0"), total_orig_tax - returned_tax - prev_tax_reduced)
        elif tax_rate and tax_rate.rate_percent > Decimal("0"):
            line_tax = round_money(allowance_amount * (tax_rate.rate_percent / Decimal("100")), currency)
        else:
            line_tax = Decimal("0")

        line_total = allowance_amount + line_tax

        # Resolve accounts
        rev_acc_id = raw.get("revenue_deduction_account") or raw.get("revenue_deduction_account_id")
        rev_acc = Account.objects.filter(company=company, id=rev_acc_id, status="ACTIVE", is_postable=True).first() if rev_acc_id else default_accs["revenue_deduction_account"]
        if not rev_acc:
            raise ValidationError(f"Dòng {idx}: Chưa xác định tài khoản giảm trừ doanh thu.")

        tax_acc_id = raw.get("tax_account") or raw.get("tax_account_id") or source_line.tax_account_id
        tax_acc = Account.objects.filter(company=company, id=tax_acc_id, status="ACTIVE", is_postable=True).first() if tax_acc_id else default_accs["tax_account"]

        rec_acc_id = raw.get("receivable_account") or raw.get("receivable_account_id") or source_line.receivable_or_payment_account_id
        rec_acc = Account.objects.filter(company=company, id=rec_acc_id, status="ACTIVE", is_postable=True).first() if rec_acc_id else default_accs["receivable_account"]
        if not rec_acc:
            raise ValidationError(f"Dòng {idx}: Chưa xác định tài khoản công nợ khách hàng.")

        line_record = {
            "line_no": idx,
            "item": item,
            "description": raw.get("description") or source_line.description or item.name,
            "uom": source_line.uom,
            "goods_sale_line": source_line if source_type == "GOODS_SALE" else None,
            "service_sale_line": source_line if source_type == "SERVICE_SALE" else None,
            "net_sales_value": net_sales,
            "returned_value": returned_val,
            "already_reduced_value": already_reduced_val,
            "remaining_value": max_available,
            "entry_method": entry_method,
            "allowance_rate": allowance_rate,
            "allowance_amount": allowance_amount,
            "tax_rate": tax_rate,
            "tax_amount": line_tax,
            "line_total": line_total,
            "revenue_deduction_account": rev_acc,
            "tax_account": tax_acc,
            "receivable_account": rec_acc,
        }

        processed_lines.append(line_record)
        subtotal += allowance_amount
        total_tax += line_tax

    total_amount = subtotal + total_tax

    return {
        "lines": processed_lines,
        "subtotal": subtotal,
        "tax_amount": total_tax,
        "total_amount": total_amount,
    }


@transaction.atomic
def create_sales_allowance(request, validated_data, lines_data):
    """Create a new SalesAllowance record and lines in DRAFT status (Luồng chính Bước 7)."""
    company = validated_data["company"]
    customer = validated_data["customer"]
    goods_sale = validated_data.get("goods_sale")
    service_sale = validated_data.get("service_sale")

    if not goods_sale and not service_sale:
        raise ValidationError("Bắt buộc chọn chứng từ bán nguồn (Hàng hóa hoặc Dịch vụ).")
    if goods_sale and service_sale:
        raise ValidationError("Chỉ được chọn một chứng từ bán nguồn (Hàng hóa hoặc Dịch vụ).")

    source_doc = goods_sale or service_sale
    source_type = "GOODS_SALE" if goods_sale else "SERVICE_SALE"

    if source_doc.company_id != company.id:
        raise ValidationError("Chứng từ bán nguồn không thuộc cùng doanh nghiệp.")
    if source_doc.status != models.DocumentStatus.POSTED:
        raise ValidationError("Chứng từ bán nguồn phải ở trạng thái Đã ghi sổ (POSTED).")
    if customer.company_id != company.id or customer.id != source_doc.customer_id:
        raise ValidationError("Khách hàng không khớp với khách hàng trên chứng từ bán nguồn.")

    allowance_reason = validated_data.get("allowance_reason", "").strip()
    if not allowance_reason:
        raise ValidationError({"allowance_reason": "Bắt buộc nhập lý do giảm giá hàng bán."})

    currency = validated_data.get("currency") or source_doc.currency
    exchange_rate = validated_data.get("exchange_rate") or (Decimal("1") if currency.code == "VND" else source_doc.exchange_rate)
    if Decimal(str(exchange_rate)) <= Decimal("0"):
        raise ValidationError({"exchange_rate": "Tỷ giá hạch toán phải lớn hơn 0."})

    calc = calculate_and_validate_allowance_lines(
        company=company,
        source_doc=source_doc,
        source_type=source_type,
        lines_data=lines_data,
        currency=currency,
        current_allowance_id=None,
    )

    doc_date = validated_data.get("document_date") or timezone.localdate()
    posting_date = validated_data.get("posting_date") or doc_date

    number = validated_data.get("number")
    if not number:
        number = generate_sales_allowance_number(company, branch=validated_data.get("branch"), document_date=doc_date)

    sale_allowance = models.SalesAllowance.objects.create(
        company=company,
        branch=validated_data.get("branch"),
        number=number,
        document_date=doc_date,
        posting_date=posting_date,
        customer=customer,
        goods_sale=goods_sale,
        service_sale=service_sale,
        currency=currency,
        exchange_rate=exchange_rate,
        allowance_reason=allowance_reason,
        original_tax_invoice=validated_data.get("original_tax_invoice") or source_doc.tax_invoice,
        tax_invoice=validated_data.get("tax_invoice"),
        subtotal=calc["subtotal"],
        discount_amount=Decimal("0"),
        tax_amount=calc["tax_amount"],
        total_amount=calc["total_amount"],
        status=models.DocumentStatus.DRAFT,
        notes=validated_data.get("notes", ""),
        attachments=validated_data.get("attachments", []),
        created_by=actor_for(request),
        version=1,
    )

    snapshot = configured_snapshot(sale_allowance, "SAL.SALES_ALLOWANCE")
    if snapshot and snapshot.get("version_id"):
        sale_allowance.workflow_snapshot = snapshot
        sale_allowance.approval_required = True
        sale_allowance.save(update_fields=["workflow_snapshot", "approval_required"])
    else:
        sale_allowance.approval_required = False
        sale_allowance.save(update_fields=["approval_required"])

    for item_calc in calc["lines"]:
        models.SalesAllowanceLine.objects.create(allowance=sale_allowance, **item_calc)

    audit(request, sale_allowance, "CREATE", after={"number": sale_allowance.number, "total_amount": str(sale_allowance.total_amount)})
    return sale_allowance


@transaction.atomic
def update_sales_allowance(request, sale_allowance, validated_data, lines_data):
    """Update a sales allowance document with optimistic locking (AF-05, BR-SAL-06-14, EF-08)."""
    sale_allowance = models.SalesAllowance.objects.select_for_update().get(pk=sale_allowance.pk)

    if sale_allowance.status not in {
        models.DocumentStatus.DRAFT,
        models.DocumentStatus.REVISION_REQUIRED,
        models.DocumentStatus.REJECTED,
    }:
        raise ValidationError(f"Không thể chỉnh sửa chứng từ ở trạng thái {sale_allowance.get_status_display()}.")

    client_version = validated_data.get("version")
    if client_version is not None and int(client_version) != sale_allowance.version:
        raise ValidationError("Chứng từ vừa được người khác cập nhật. Vui lòng tải lại trang.")

    company = sale_allowance.company
    source_doc = sale_allowance.goods_sale or sale_allowance.service_sale
    source_type = "GOODS_SALE" if sale_allowance.goods_sale else "SERVICE_SALE"

    currency = validated_data.get("currency") or sale_allowance.currency
    exchange_rate = validated_data.get("exchange_rate") or sale_allowance.exchange_rate

    calc = calculate_and_validate_allowance_lines(
        company=company,
        source_doc=source_doc,
        source_type=source_type,
        lines_data=lines_data,
        currency=currency,
        current_allowance_id=sale_allowance.pk,
    )

    before = {"subtotal": str(sale_allowance.subtotal), "total_amount": str(sale_allowance.total_amount)}

    sale_allowance.document_date = validated_data.get("document_date", sale_allowance.document_date)
    sale_allowance.posting_date = validated_data.get("posting_date", sale_allowance.posting_date)
    sale_allowance.allowance_reason = validated_data.get("allowance_reason", sale_allowance.allowance_reason)
    if "tax_invoice" in validated_data:
        sale_allowance.tax_invoice = validated_data["tax_invoice"]
    sale_allowance.currency = currency
    sale_allowance.exchange_rate = exchange_rate
    sale_allowance.subtotal = calc["subtotal"]
    sale_allowance.tax_amount = calc["tax_amount"]
    sale_allowance.total_amount = calc["total_amount"]
    sale_allowance.notes = validated_data.get("notes", sale_allowance.notes)
    sale_allowance.attachments = validated_data.get("attachments", sale_allowance.attachments)
    sale_allowance.version += 1
    sale_allowance.save()

    sale_allowance.lines.all().delete()
    for item_calc in calc["lines"]:
        models.SalesAllowanceLine.objects.create(allowance=sale_allowance, **item_calc)

    after = {"subtotal": str(sale_allowance.subtotal), "total_amount": str(sale_allowance.total_amount)}
    audit(request, sale_allowance, "UPDATE", before=before, after=after)
    return sale_allowance


@transaction.atomic
def submit_sales_allowance(request, sale_allowance, notes=""):
    """Submit a sales allowance for approval (Luồng chính Bước 8)."""
    sale_allowance = models.SalesAllowance.objects.select_for_update().get(pk=sale_allowance.pk)
    if sale_allowance.status not in {
        models.DocumentStatus.DRAFT,
        models.DocumentStatus.REVISION_REQUIRED,
        models.DocumentStatus.REJECTED,
    }:
        raise ValidationError("Chỉ chứng từ ở trạng thái Nháp, Yêu cầu sửa hoặc Từ chối mới được gửi duyệt.")

    snapshot = sale_allowance.workflow_snapshot if (sale_allowance.workflow_snapshot and sale_allowance.workflow_snapshot.get("version_id")) else configured_snapshot(sale_allowance, "SAL.SALES_ALLOWANCE")
    before = sale_allowance.status

    if snapshot and snapshot.get("version_id"):
        sale_allowance.workflow_snapshot = snapshot
        sale_allowance.approval_required = True
        sale_allowance.status = models.DocumentStatus.PENDING_APPROVAL
    else:
        sale_allowance.approval_required = False
        sale_allowance.status = models.DocumentStatus.APPROVED

    sale_allowance.submitted_at = timezone.now()
    sale_allowance.version += 1
    sale_allowance.save(update_fields=["workflow_snapshot", "approval_required", "status", "submitted_at", "version", "updated_at"])

    models.ApprovalDecision.objects.create(
        company=sale_allowance.company,
        document_type="SALES_ALLOWANCE",
        document_id=sale_allowance.pk,
        level=1,
        decision="SUBMITTED",
        actor=actor_for(request),
        comment=notes,
    )
    audit(request, sale_allowance, "SUBMIT", {"status": before}, {"status": sale_allowance.status}, reason=notes)
    return sale_allowance


@transaction.atomic
def withdraw_sales_allowance(request, sale_allowance, reason=""):
    """Withdraw a sales allowance waiting for approval back to DRAFT (AF-05)."""
    sale_allowance = models.SalesAllowance.objects.select_for_update().get(pk=sale_allowance.pk)
    if sale_allowance.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể thu hồi chứng từ đang Chờ duyệt.")

    before = sale_allowance.status
    sale_allowance.status = models.DocumentStatus.DRAFT
    sale_allowance.withdrawal_reason = reason
    sale_allowance.version += 1
    sale_allowance.save(update_fields=["status", "withdrawal_reason", "version", "updated_at"])

    models.ApprovalDecision.objects.create(
        company=sale_allowance.company,
        document_type="SALES_ALLOWANCE",
        document_id=sale_allowance.pk,
        level=1,
        decision="WITHDRAWN",
        actor=actor_for(request),
        comment=reason,
    )
    audit(request, sale_allowance, "WITHDRAW", {"status": before}, {"status": sale_allowance.status}, reason=reason)
    return sale_allowance


@transaction.atomic
def decide_sales_allowance(request, sale_allowance, decision, comment=""):
    """Handle approval decisions: APPROVED, REVISION_REQUIRED, REJECTED (AF-06)."""
    sale_allowance = models.SalesAllowance.objects.select_for_update().get(pk=sale_allowance.pk)
    if sale_allowance.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ không ở trạng thái Chờ duyệt.")

    if decision in {models.DocumentStatus.REJECTED, models.DocumentStatus.REVISION_REQUIRED} and not comment.strip():
        raise ValidationError({"comment": "Bắt buộc nhập ý kiến khi từ chối hoặc yêu cầu sửa."})

    decisions = list(models.ApprovalDecision.objects.filter(
        company=sale_allowance.company,
        document_type="SALES_ALLOWANCE",
        document_id=sale_allowance.pk
    ).order_by("decided_at"))

    current_level = 1
    for d in decisions:
        if d.decision == "APPROVED":
            current_level = d.level + 1

    next_status = decision
    if sale_allowance.workflow_snapshot.get("version_id"):
        progress = approval_progress(sale_allowance, actor_for(request), decision == "APPROVED", decisions)
        if progress:
            current_level = progress["level"]
            if decision == "APPROVED" and not progress["final"]:
                next_status = models.DocumentStatus.PENDING_APPROVAL

    before = sale_allowance.status
    sale_allowance.status = next_status
    if next_status == models.DocumentStatus.APPROVED:
        sale_allowance.approved_at = timezone.now()
    elif next_status == models.DocumentStatus.REJECTED:
        sale_allowance.rejection_reason = comment

    sale_allowance.version += 1
    sale_allowance.save()

    models.ApprovalDecision.objects.create(
        company=sale_allowance.company,
        document_type="SALES_ALLOWANCE",
        document_id=sale_allowance.pk,
        level=current_level,
        decision="APPROVED" if next_status in {models.DocumentStatus.APPROVED, models.DocumentStatus.PENDING_APPROVAL} else decision,
        actor=actor_for(request),
        comment=comment,
    )
    audit(request, sale_allowance, decision, {"status": before}, {"status": sale_allowance.status}, reason=comment)
    return sale_allowance


@transaction.atomic
def cancel_sales_allowance(request, sale_allowance, reason=""):
    """Cancel an unposted sales allowance and release reserved values (AF-07, BR-SAL-06-07)."""
    sale_allowance = models.SalesAllowance.objects.select_for_update().get(pk=sale_allowance.pk)
    if sale_allowance.status == models.DocumentStatus.POSTED:
        raise ValidationError("Không thể hủy trực tiếp chứng từ Đã ghi sổ. Vui lòng bỏ ghi sổ trước.")
    if sale_allowance.status == models.DocumentStatus.CANCELLED:
        raise ValidationError("Chứng từ đã bị hủy trước đó.")

    before = sale_allowance.status
    sale_allowance.status = models.DocumentStatus.CANCELLED
    sale_allowance.cancellation_reason = reason
    sale_allowance.version += 1
    sale_allowance.save(update_fields=["status", "cancellation_reason", "version", "updated_at"])
    audit(request, sale_allowance, "CANCEL", {"status": before}, {"status": sale_allowance.status}, reason=reason)
    return sale_allowance


@transaction.atomic
def delete_sales_allowance(request, sale_allowance):
    """Delete draft sales allowance (AF-07, BR-SAL-06-14)."""
    sale_allowance = models.SalesAllowance.objects.select_for_update().get(pk=sale_allowance.pk)
    if sale_allowance.status != models.DocumentStatus.DRAFT:
        raise ValidationError("Chỉ có thể xóa chứng từ ở trạng thái Nháp.")
    audit(request, sale_allowance, "DELETE", before={"number": sale_allowance.number})
    sale_allowance.lines.all().delete()
    sale_allowance.delete()


def _validate_allowance_posting_preconditions(sale_allowance):
    """Validate accounting period, postable accounts, and remaining allowance balances (BR-SAL-06-04, BR-SAL-06-09, EF-04, EF-05)."""
    # 1. Accounting Period Check (EF-05, BR-SAL-06-09)
    period = AccountingPeriod.objects.filter(
        company=sale_allowance.company,
        start_date__lte=sale_allowance.posting_date,
        end_date__gte=sale_allowance.posting_date,
        status="OPEN"
    ).first()
    if not period:
        raise ValidationError("Kỳ kế toán đã bị khóa hoặc chưa mở cho ngày hạch toán.")

    # 2. Account Validity Check (EF-04, EF-05, BR-SAL-06-09)
    lines = list(sale_allowance.lines.select_related(
        "item", "revenue_deduction_account", "tax_account", "receivable_account", "goods_sale_line", "service_sale_line"
    ).all())

    for line in lines:
        for acc in (line.revenue_deduction_account, line.tax_account, line.receivable_account):
            if acc:
                if acc.company_id != sale_allowance.company_id or not acc.is_postable or acc.status != "ACTIVE":
                    raise ValidationError(f"Tài khoản {acc.code} trên dòng {line.line_no} không hợp lệ hoặc đã ngừng sử dụng.")

    # 3. Source Remaining Balance Check in atomic lock (BR-SAL-06-04, EF-06)
    source_type = "GOODS_SALE" if sale_allowance.goods_sale else "SERVICE_SALE"
    for line in lines:
        source_line = line.goods_sale_line if source_type == "GOODS_SALE" else line.service_sale_line
        net_sales = (source_line.quantity * source_line.unit_price) - source_line.discount_amount
        returned_val = Decimal("0")
        if source_type == "GOODS_SALE":
            for ret in models.SalesReturnLine.objects.filter(goods_sale_line=source_line, sale_return__status=models.DocumentStatus.POSTED):
                returned_val += (ret.return_quantity * ret.unit_price) - ret.discount_amount

        other_reduced = models.SalesAllowanceLine.objects.filter(
            sale_allowance_posted_filter(source_line, source_type)
        ).exclude(allowance=sale_allowance).aggregate(t=Sum("allowance_amount"))["t"] or Decimal("0")

        if other_reduced + line.allowance_amount > (net_sales - returned_val):
            raise ValidationError(
                f"Dòng {line.line_no}: Tiền giảm giá ({line.allowance_amount}) cộng các lần giảm trước ({other_reduced}) vượt giá trị còn lại ({net_sales - returned_val})."
            )

    return period, lines


@transaction.atomic
def post_sales_allowance(request, sale_allowance):
    """Post sales allowance: updates GL, adjusts receivable, records audit log (Luồng chính Bước 9-10)."""
    sale_allowance = models.SalesAllowance.objects.select_for_update().get(pk=sale_allowance.pk)
    if sale_allowance.status == models.DocumentStatus.POSTED:
        raise ValidationError("Chứng từ đã được ghi sổ trước đó.")

    # Check approval state: must be APPROVED, or allow direct posting from DRAFT if workflow not configured
    if sale_allowance.status != models.DocumentStatus.APPROVED:
        snapshot = configured_snapshot(sale_allowance, "SAL.SALES_ALLOWANCE")
        has_workflow = bool(snapshot and snapshot.get("version_id"))
        if sale_allowance.status == models.DocumentStatus.DRAFT and (not sale_allowance.approval_required or not has_workflow):
            pass  # Direct posting allowed
        else:
            raise ValidationError(f"Chỉ chứng từ Đã duyệt mới có thể ghi sổ (trạng thái hiện tại: {sale_allowance.get_status_display()}).")

    period, lines = _validate_allowance_posting_preconditions(sale_allowance)

    # 1. Create and Post JournalEntry (BR-SAL-06-10, BR-SAL-06-11: STRICTLY NO INVENTORY/COGS)
    total_debit = sale_allowance.total_amount
    total_credit = sale_allowance.total_amount

    journal = JournalEntry.objects.create(
        company=sale_allowance.company,
        branch=sale_allowance.branch,
        period=period,
        number=f"{sale_allowance.number}-GL",
        entry_type="SUBLEDGER",
        posting_date=sale_allowance.posting_date,
        document_date=sale_allowance.document_date,
        description=f"Giảm giá hàng bán - {sale_allowance.number}",
        source_module="SAL",
        source_event_id=f"SAL.ALLOWANCE:{sale_allowance.pk}:{sale_allowance.version}",
        source_entity_type="SalesAllowance",
        source_entity_id=sale_allowance.pk,
        status="APPROVED",
        total_debit=total_debit,
        total_credit=total_credit,
        workflow_snapshot={"allow_creator_posting": True},
        created_by=actor_for(request),
        approved_by=actor_for(request),
        approved_at=timezone.now(),
    )

    gl_line_no = 0

    # Debits: Revenue Deductions (5213/521)
    for line in lines:
        if line.allowance_amount > 0:
            gl_line_no += 1
            JournalLine.objects.create(
                entry=journal,
                line_no=gl_line_no,
                account=line.revenue_deduction_account,
                description=f"Giảm giá hàng bán {line.item.code} - {sale_allowance.number}",
                debit=line.allowance_amount,
                credit=Decimal("0"),
                currency=sale_allowance.currency,
                party=sale_allowance.customer,
            )

    # Debits: VAT Output Reduction (33311)
    for line in lines:
        if line.tax_amount > 0 and line.tax_account:
            gl_line_no += 1
            JournalLine.objects.create(
                entry=journal,
                line_no=gl_line_no,
                account=line.tax_account,
                description=f"Điều chỉnh giảm thuế GTGT {line.item.code} - {sale_allowance.number}",
                debit=line.tax_amount,
                credit=Decimal("0"),
                currency=sale_allowance.currency,
                party=sale_allowance.customer,
            )

    # Credit: Accounts Receivable (131)
    gl_line_no += 1
    JournalLine.objects.create(
        entry=journal,
        line_no=gl_line_no,
        account=lines[0].receivable_account,
        description=f"Giảm trừ công nợ phải thu khách hàng - {sale_allowance.number}",
        debit=Decimal("0"),
        credit=sale_allowance.total_amount,
        currency=sale_allowance.currency,
        party=sale_allowance.customer,
    )

    post_journal(journal, request)
    sale_allowance.journal_entry = journal

    # 2. Receivable Offset & Refundable Calculation (BR-SAL-06-12)
    source_doc = sale_allowance.goods_sale or sale_allowance.service_sale
    if source_doc and getattr(source_doc, "receivable", None):
        rec = source_doc.receivable
        if rec.balance >= sale_allowance.total_amount:
            rec.adjustment_amount += sale_allowance.total_amount
            rec.balance -= sale_allowance.total_amount
            if rec.balance == Decimal("0"):
                rec.status = ReceivableStatus.PAID
            else:
                rec.status = ReceivableStatus.PARTIALLY_PAID
            rec.save(update_fields=["adjustment_amount", "balance", "status", "updated_at"])
            sale_allowance.refundable_amount = Decimal("0")
        else:
            offset_part = rec.balance
            excess_part = sale_allowance.total_amount - offset_part
            rec.adjustment_amount += offset_part
            rec.balance = Decimal("0")
            rec.status = ReceivableStatus.PAID
            rec.save(update_fields=["adjustment_amount", "balance", "status", "updated_at"])
            sale_allowance.refundable_amount = excess_part
    else:
        # Paid upfront in CASH/BANK: full allowance is refundable
        sale_allowance.refundable_amount = sale_allowance.total_amount

    sale_allowance.status = models.DocumentStatus.POSTED
    sale_allowance.posted_at = timezone.now()
    sale_allowance.posted_by = actor_for(request)
    sale_allowance.version += 1
    sale_allowance.save()

    audit(request, sale_allowance, "POST", after={"status": sale_allowance.status, "journal_id": str(journal.id)})
    return sale_allowance


@transaction.atomic
def unpost_sales_allowance(request, sale_allowance, reason=""):
    """Unpost a posted sales allowance, rollback GL and receivable balance (AF-05, BR-SAL-06-14)."""
    sale_allowance = models.SalesAllowance.objects.select_for_update().get(pk=sale_allowance.pk)
    if sale_allowance.status != models.DocumentStatus.POSTED:
        raise ValidationError("Chỉ có thể bỏ ghi sổ chứng từ Đã ghi sổ.")

    if sale_allowance.refunded_amount > Decimal("0"):
        raise ValidationError(
            f"Không thể bỏ ghi sổ khi đã phát sinh hoàn tiền cho khách ({sale_allowance.refunded_amount}). Vui lòng xử lý chứng từ hoàn tiền trước."
        )

    # 1. Reverse and delete JournalEntry
    if sale_allowance.journal_entry:
        journal = sale_allowance.journal_entry
        sale_allowance.journal_entry = None
        sale_allowance.save(update_fields=["journal_entry"])
        journal.lines.all().delete()
        journal.delete()

    # 2. Revert Receivable adjustment
    source_doc = sale_allowance.goods_sale or sale_allowance.service_sale
    if source_doc and getattr(source_doc, "receivable", None):
        rec = source_doc.receivable
        adjusted_amount = sale_allowance.total_amount - sale_allowance.refundable_amount
        if adjusted_amount > Decimal("0"):
            rec.adjustment_amount = max(Decimal("0"), rec.adjustment_amount - adjusted_amount)
            rec.balance += adjusted_amount
            rec.status = ReceivableStatus.OPEN if rec.balance == rec.original_amount else ReceivableStatus.PARTIALLY_PAID
            rec.save(update_fields=["adjustment_amount", "balance", "status", "updated_at"])

    sale_allowance.refundable_amount = Decimal("0")
    sale_allowance.status = models.DocumentStatus.DRAFT
    sale_allowance.posted_at = None
    sale_allowance.posted_by = None
    sale_allowance.version += 1
    sale_allowance.save()

    audit(request, sale_allowance, "UNPOST", after={"status": sale_allowance.status}, reason=reason)
    return sale_allowance


@transaction.atomic
def refund_sales_allowance(request, sale_allowance, data):
    """Refund money to customer for excess refundable amount (AF-04, BR-SAL-06-12, EF-07)."""
    sale_allowance = models.SalesAllowance.objects.select_for_update().get(pk=sale_allowance.pk)
    if sale_allowance.status != models.DocumentStatus.POSTED:
        raise ValidationError("Chỉ có thể lập chứng từ hoàn tiền trên chứng từ giảm giá Đã ghi sổ.")

    raw_amount = data.get("amount") or data.get("refund_amount") or "0"
    try:
        amount = Decimal(str(raw_amount))
    except Exception:
        raise ValidationError({"amount": "Số tiền hoàn không hợp lệ."})

    if amount <= Decimal("0"):
        raise ValidationError({"amount": "Số tiền hoàn phải lớn hơn 0."})

    remaining_refundable = sale_allowance.refundable_amount - sale_allowance.refunded_amount
    if amount > remaining_refundable:
        raise ValidationError(
            f"Số tiền hoàn ({amount}) vượt quá phần còn phải hoàn ({remaining_refundable})."
        )

    payment_method = data.get("payment_method", "CASH")
    company = sale_allowance.company
    ref_date = timezone.localdate()

    period = AccountingPeriod.objects.filter(
        company=company,
        start_date__lte=ref_date,
        end_date__gte=ref_date,
        status="OPEN"
    ).first()
    if not period:
        raise ValidationError("Kỳ kế toán đã bị khóa hoặc chưa mở cho ngày hoàn tiền.")

    rec_acc = Account.objects.filter(company=company, code__startswith="131", is_postable=True, status="ACTIVE").first()
    if not rec_acc:
        raise ValidationError("Không tìm thấy tài khoản công nợ phải thu (131).")

    if payment_method == "BANK":
        bank_acc_id = data.get("company_bank_account")
        cash_acc = Account.objects.filter(company=company, code__startswith="112", is_postable=True, status="ACTIVE").first()
    else:
        cash_acc = Account.objects.filter(company=company, code__startswith="111", is_postable=True, status="ACTIVE").first()

    if not cash_acc:
        raise ValidationError("Không tìm thấy tài khoản tiền mặt / ngân hàng phù hợp.")

    refund_journal = JournalEntry.objects.create(
        company=company,
        branch=sale_allowance.branch,
        period=period,
        number=f"{sale_allowance.number}-RF-{sale_allowance.version}",
        entry_type="SUBLEDGER",
        posting_date=ref_date,
        document_date=ref_date,
        description=f"Hoàn tiền giảm giá khách hàng - {sale_allowance.number}",
        source_module="SAL",
        source_event_id=f"SAL.ALLOWANCE_REFUND:{sale_allowance.pk}:{sale_allowance.refunded_amount + amount}",
        source_entity_type="SalesAllowance",
        source_entity_id=sale_allowance.pk,
        status="APPROVED",
        total_debit=amount,
        total_credit=amount,
        workflow_snapshot={"allow_creator_posting": True},
        created_by=actor_for(request),
        approved_by=actor_for(request),
        approved_at=timezone.now(),
    )

    JournalLine.objects.create(
        entry=refund_journal,
        line_no=1,
        account=rec_acc,
        description=f"Hoàn tiền giảm giá hàng bán - {sale_allowance.number}",
        debit=amount,
        credit=Decimal("0"),
        currency=sale_allowance.currency,
        party=sale_allowance.customer,
    )
    JournalLine.objects.create(
        entry=refund_journal,
        line_no=2,
        account=cash_acc,
        description=f"Chi tiền hoàn trả giảm giá - {sale_allowance.number}",
        debit=Decimal("0"),
        credit=amount,
        currency=sale_allowance.currency,
        party=sale_allowance.customer,
    )

    post_journal(refund_journal, request)

    sale_allowance.refunded_amount += amount
    sale_allowance.version += 1
    sale_allowance.save(update_fields=["refunded_amount", "version", "updated_at"])

    audit(request, sale_allowance, "REFUND", after={"refunded_amount": str(sale_allowance.refunded_amount), "journal_id": str(refund_journal.id)})
    return {
        "status": "SUCCESS",
        "sales_allowance_id": str(sale_allowance.id),
        "refunded_amount": str(sale_allowance.refunded_amount),
        "remaining_refundable": str(sale_allowance.refundable_amount - sale_allowance.refunded_amount),
        "journal_entry_id": str(refund_journal.id),
    }


@transaction.atomic
def link_tax_invoice(request, sale_allowance, data):
    """Link an adjustment tax invoice to the sales allowance (AF-08, BR-SAL-06-13, EF-08)."""
    sale_allowance = models.SalesAllowance.objects.select_for_update().get(pk=sale_allowance.pk)
    invoice_id = data.get("invoice_id")
    if not invoice_id:
        raise ValidationError({"invoice_id": "Bắt buộc chọn hóa đơn để liên kết."})

    from tax_management.models import TaxInvoice
    invoice = TaxInvoice.objects.filter(company=sale_allowance.company, id=invoice_id).first()
    if not invoice:
        raise ValidationError("Hóa đơn không tồn tại hoặc không thuộc doanh nghiệp.")

    if invoice.buyer_name and sale_allowance.customer.name not in invoice.buyer_name and invoice.tax_code != sale_allowance.customer.tax_code:
        raise ValidationError("Thông tin người mua trên hóa đơn không khớp với khách hàng của chứng từ.")

    before = str(sale_allowance.tax_invoice_id) if sale_allowance.tax_invoice_id else None
    sale_allowance.tax_invoice = invoice
    sale_allowance.invoice_link_notes = data.get("invoice_link_notes", "").strip()
    sale_allowance.version += 1
    sale_allowance.save(update_fields=["tax_invoice", "invoice_link_notes", "version", "updated_at"])

    audit(request, sale_allowance, "LINK_INVOICE", before={"tax_invoice": before}, after={"tax_invoice": str(invoice.id)})
    return sale_allowance
