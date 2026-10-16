"""UC-SAL-05: Ghi nhận hàng bán trả lại (Sales Return / Return Merchandise).

Implements:
- Header & Line creation, validation, precision calculation, and rounding (BR-SAL-05-02, BR-SAL-05-04).
- Automatic document numbering (TL-YYYY-NNNNNN) and default values prefill.
- Source inheritance from Goods Sale (BR-SAL-05-02, AF-02).
- Source line quantity reservation tracking across unposted returns (BR-SAL-05-03, BR-SAL-05-05, EF-03).
- Proportional discount and tax allocation with exact remainder rounding on final return (BR-SAL-05-04).
- Workflow management: Submit, Withdraw, Approve, Request Revision, Reject, Cancel (BR-SAL-05-06, BR-SAL-05-13).
- Posting (Ghi sổ):
  * Accounting period & postable account validation (BR-SAL-05-07, EF-04, EF-05).
  * GL JournalEntry creation:
      Nợ TK 5212/521 (Giảm trừ doanh thu),
      Nợ TK 33311 (Thuế GTGT đầu ra điều chỉnh),
      Có TK 131 (Công nợ khách hàng) (BR-SAL-05-08).
  * Inward Inventory creation and posting when ATTACH_INWARD:
      Nợ TK 156 (Hàng tồn kho) / Có TK 632 (Giá vốn) theo giá vốn xuất gốc (BR-SAL-05-09).
  * Skip inventory re-posting when LINK_EXISTING (BR-SAL-05-10, AF-03).
  * Handle non-inventory items when NO_INVENTORY (AF-04).
  * Accounts Receivable balance offset or refundable amount tracking (BR-SAL-05-11).
- Unposting (Bỏ ghi sổ) and invoice linking (AF-09, BR-SAL-05-12).
- Customer refund action (AF-05, BR-SAL-05-11, EF-07).
- Optimistic concurrency control and Audit Logging (BR-SAL-05-14, EF-08).
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
from inventory.models import InventoryTransaction, InventoryTransactionLine
from inventory.services import post as post_inventory, reverse as reverse_inventory
from accounts_receivable.models import Receivable, ReceivableStatus
from master_data.models import Currency, DocumentType, Item, Party, TaxRate, UnitOfMeasure, Warehouse
from . import models

MONEY = Decimal("0.0001")


def actor_for(request):
    """Retrieve IAM account or fallback user for audit and ownership tracking."""
    if hasattr(request, "user") and hasattr(request.user, "iam_account"):
        return request.user.iam_account
    return getattr(request, "user", None)


def audit(request, sale_return, action, before=None, after=None, reason=""):
    """Write an audit entry for sales return transactions."""
    actor = actor_for(request)
    if actor and hasattr(actor, "id"):
        record_audit(
            company=sale_return.company,
            actor_user=actor,
            module_code="SAL",
            action_code=action,
            entity=sale_return,
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


def generate_sales_return_number(company, branch=None, document_date=None):
    """Generate unique sales return number (TL-YYYY-NNNNNN) using DocumentNumberingRule or SalesReturnCounter."""
    ref_date = document_date or timezone.localdate()
    try:
        from common_services.numbering_services import generate_document_number
        doc_type = DocumentType.objects.filter(code__in=["SAL.SALES_RETURN", "TL", "SALES_RETURN", "TRA_LAI"]).first()
        if doc_type:
            num = generate_document_number(company, doc_type, branch=branch, document_date=ref_date)
            if num:
                return num
    except Exception:
        pass

    year = ref_date.year
    with transaction.atomic():
        counter, _ = models.SalesReturnCounter.objects.select_for_update().get_or_create(company=company, year=year)
        while True:
            counter.value += 1
            counter.save(update_fields=["value"])
            candidate = f"TL-{year}-{counter.value:06d}"
            if not models.SalesReturn.objects.filter(company=company, number=candidate).exists():
                return candidate


def resolve_default_accounts(company):
    """Resolve default postable accounts for sales return operations."""
    # Revenue deduction account (5212 or 521, fallback to 511)
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

    # Inventory account (156)
    inv_acc = Account.objects.filter(
        company=company, code__startswith="156", is_postable=True, status="ACTIVE"
    ).order_by("code").first()

    # COGS account (632)
    cogs_acc = Account.objects.filter(
        company=company, code__startswith="632", is_postable=True, status="ACTIVE"
    ).order_by("code").first()

    return {
        "revenue_deduction_account": revenue_deduction_acc,
        "tax_account": tax_acc,
        "receivable_account": receivable_acc,
        "inventory_account": inv_acc,
        "cogs_account": cogs_acc,
    }


def get_sales_return_defaults(company, branch=None, customer_id=None, goods_sale_id=None):
    """Prefill default values for creating a new SalesReturn document (Luồng chính Bước 2)."""
    today = timezone.localdate()
    defaults_accounts = resolve_default_accounts(company)

    data = {
        "document_date": str(today),
        "posting_date": str(today),
        "inventory_handling": models.SalesReturn.InventoryHandling.ATTACH_INWARD,
        "currency": "VND",
        "currency_id": None,
        "exchange_rate": "1.0",
        "customer": None,
        "customer_name": "",
        "goods_sale": None,
        "goods_sale_number": "",
        "return_reason": "",
        "revenue_deduction_account": str(defaults_accounts["revenue_deduction_account"].id) if defaults_accounts["revenue_deduction_account"] else None,
        "tax_account": str(defaults_accounts["tax_account"].id) if defaults_accounts["tax_account"] else None,
        "receivable_account": str(defaults_accounts["receivable_account"].id) if defaults_accounts["receivable_account"] else None,
        "inventory_account": str(defaults_accounts["inventory_account"].id) if defaults_accounts["inventory_account"] else None,
        "cogs_account": str(defaults_accounts["cogs_account"].id) if defaults_accounts["cogs_account"] else None,
    }

    vnd = Currency.objects.filter(code="VND").first()
    if vnd:
        data["currency_id"] = str(vnd.id)

    if goods_sale_id:
        sale = models.GoodsSale.objects.filter(company=company, id=goods_sale_id).first()
        if sale:
            data["goods_sale"] = str(sale.id)
            data["goods_sale_number"] = sale.number
            data["customer"] = str(sale.customer_id)
            data["customer_name"] = sale.customer.name
            data["currency"] = sale.currency.code
            data["currency_id"] = str(sale.currency_id)
            data["exchange_rate"] = str(sale.exchange_rate)
            data["original_tax_invoice"] = str(sale.tax_invoice_id) if sale.tax_invoice_id else None
    elif customer_id:
        cust = Party.objects.filter(company=company, id=customer_id).first()
        if cust:
            data["customer"] = str(cust.id)
            data["customer_name"] = cust.name

    return data


def prepare_from_goods_sale(company, goods_sale_id):
    """Inspect and return available returnable lines from a posted GoodsSale (Luồng chính Bước 3, AF-02)."""
    sale = models.GoodsSale.objects.filter(company=company, id=goods_sale_id).select_related(
        "customer", "currency", "tax_invoice"
    ).first()
    if not sale:
        raise ValidationError("Không tìm thấy chứng từ bán hàng nguồn.")
    if sale.status != models.DocumentStatus.POSTED:
        raise ValidationError("Chứng từ bán hàng nguồn phải ở trạng thái Đã ghi sổ (POSTED).")

    default_accs = resolve_default_accounts(company)
    lines_out = []

    for line in sale.lines.select_related("item", "uom", "warehouse", "tax_rate").order_by("line_no"):
        # BR-SAL-05-02: exclude non-goods / service items
        if line.item.item_type != "GOODS":
            continue

        sold_qty = line.quantity

        # Posted returns
        posted_qty = models.SalesReturnLine.objects.filter(
            goods_sale_line=line,
            sale_return__status=models.DocumentStatus.POSTED
        ).aggregate(t=Sum("return_quantity"))["t"] or Decimal("0")

        # Pending returns (DRAFT, PENDING_APPROVAL, APPROVED)
        pending_qty = models.SalesReturnLine.objects.filter(
            goods_sale_line=line,
            sale_return__status__in=[
                models.DocumentStatus.DRAFT,
                models.DocumentStatus.PENDING_APPROVAL,
                models.DocumentStatus.APPROVED,
            ]
        ).aggregate(t=Sum("return_quantity"))["t"] or Decimal("0")

        remaining_qty = sold_qty - posted_qty - pending_qty
        if remaining_qty > 0:
            lines_out.append({
                "goods_sale_line_id": str(line.id),
                "line_no": line.line_no,
                "item_id": str(line.item_id),
                "item_code": line.item.code,
                "item_name": line.item.name,
                "description": line.description or line.item.name,
                "uom_id": str(line.uom_id),
                "uom_name": line.uom.name,
                "warehouse_id": str(line.warehouse_id) if line.warehouse_id else None,
                "warehouse_name": line.warehouse.name if line.warehouse else "",
                "sold_quantity": str(sold_qty),
                "already_returned_quantity": str(posted_qty),
                "pending_returned_quantity": str(pending_qty),
                "remaining_quantity": str(remaining_qty),
                "return_quantity": str(remaining_qty),
                "unit_price": str(line.unit_price),
                "discount_rate": str(line.discount_rate),
                "tax_rate_id": str(line.tax_rate_id) if line.tax_rate_id else None,
                "unit_cost": str(line.unit_cost),
                "revenue_deduction_account": str(default_accs["revenue_deduction_account"].id) if default_accs["revenue_deduction_account"] else None,
                "tax_account": str(line.tax_account_id or (default_accs["tax_account"].id if default_accs["tax_account"] else None)),
                "receivable_account": str(line.receivable_or_payment_account_id or (default_accs["receivable_account"].id if default_accs["receivable_account"] else None)),
                "inventory_account": str(line.inventory_account_id or (default_accs["inventory_account"].id if default_accs["inventory_account"] else None)),
                "cogs_account": str(line.cogs_account_id or (default_accs["cogs_account"].id if default_accs["cogs_account"] else None)),
            })

    if not lines_out:
        raise ValidationError("Chứng từ bán hàng nguồn đã được trả lại toàn bộ hoặc không còn dòng hàng hóa nào chưa trả.")

    return {
        "company": str(company.id),
        "customer": str(sale.customer_id),
        "customer_name": sale.customer.name,
        "goods_sale": str(sale.id),
        "goods_sale_number": sale.number,
        "currency": sale.currency.code,
        "currency_id": str(sale.currency_id),
        "exchange_rate": str(sale.exchange_rate),
        "original_tax_invoice": str(sale.tax_invoice_id) if sale.tax_invoice_id else None,
        "inventory_handling": models.SalesReturn.InventoryHandling.ATTACH_INWARD,
        "lines": lines_out,
    }


def calculate_and_validate_return_lines(
    company,
    goods_sale,
    lines_data,
    currency=None,
    current_return_id=None,
    inventory_handling=models.SalesReturn.InventoryHandling.ATTACH_INWARD
):
    """Validate return lines against source sale lines, check available quantities, calculate allocations (BR-SAL-05-02, BR-SAL-05-03, BR-SAL-05-04)."""
    if not lines_data:
        raise ValidationError("Chứng từ hàng bán trả lại phải có ít nhất một dòng hàng hóa.")

    default_accs = resolve_default_accounts(company)
    processed_lines = []
    subtotal = Decimal("0")
    discount_amount = Decimal("0")
    tax_amount = Decimal("0")
    total_cogs = Decimal("0")

    seen_source_lines = set()

    for idx, raw in enumerate(lines_data, start=1):
        source_line_id = raw.get("goods_sale_line") or raw.get("goods_sale_line_id")
        if not source_line_id:
            raise ValidationError(f"Dòng {idx}: Bắt buộc liên kết dòng bán hàng nguồn.")

        if source_line_id in seen_source_lines:
            raise ValidationError(f"Dòng {idx}: Dòng bán hàng nguồn đã được chọn trước đó trên cùng chứng từ.")
        seen_source_lines.add(source_line_id)

        source_line = models.GoodsSaleLine.objects.filter(
            sale=goods_sale, id=source_line_id
        ).select_related("item", "uom", "warehouse", "tax_rate").first()

        if not source_line:
            raise ValidationError(f"Dòng {idx}: Dòng bán hàng nguồn không thuộc chứng từ bán {goods_sale.number}.")

        item = source_line.item
        # BR-SAL-05-02 / EF-03: No service item return
        if item.item_type != "GOODS":
            raise ValidationError(f"Dòng {idx}: Hàng hóa {item.code} là dịch vụ, không được lập chứng từ hàng bán trả lại.")

        try:
            return_qty = Decimal(str(raw.get("return_quantity", raw.get("quantity", "0"))))
        except Exception:
            raise ValidationError(f"Dòng {idx}: Số lượng trả lại không hợp lệ.")

        if return_qty <= Decimal("0"):
            raise ValidationError(f"Dòng {idx}: Số lượng trả lại phải lớn hơn 0.")

        # Check remaining quantity (BR-SAL-05-03, BR-SAL-05-05, EF-03)
        sold_qty = source_line.quantity

        posted_query = models.SalesReturnLine.objects.filter(
            goods_sale_line=source_line,
            sale_return__status=models.DocumentStatus.POSTED
        )
        if current_return_id:
            posted_query = posted_query.exclude(sale_return_id=current_return_id)
        already_posted_qty = posted_query.aggregate(t=Sum("return_quantity"))["t"] or Decimal("0")

        pending_query = models.SalesReturnLine.objects.filter(
            goods_sale_line=source_line,
            sale_return__status__in=[
                models.DocumentStatus.DRAFT,
                models.DocumentStatus.PENDING_APPROVAL,
                models.DocumentStatus.APPROVED,
            ]
        )
        if current_return_id:
            pending_query = pending_query.exclude(sale_return_id=current_return_id)
        already_pending_qty = pending_query.aggregate(t=Sum("return_quantity"))["t"] or Decimal("0")

        max_available = sold_qty - already_posted_qty - already_pending_qty
        if return_qty > max_available:
            raise ValidationError(
                f"Dòng {idx}: Số lượng trả lại ({return_qty}) vượt quá số lượng còn được trả ({max_available})."
            )

        # Unit price is locked from source line (BR-SAL-05-04)
        unit_price = source_line.unit_price
        line_subtotal = round_money(return_qty * unit_price, currency)

        # Proportional discount and tax allocation (BR-SAL-05-04)
        # Check if this return exhausts the remaining sold quantity: allocate exact rounding remainder
        is_final_return = (already_posted_qty + return_qty >= sold_qty)

        if is_final_return:
            prev_discounts = models.SalesReturnLine.objects.filter(
                goods_sale_line=source_line,
                sale_return__status=models.DocumentStatus.POSTED
            ).exclude(sale_return_id=current_return_id).aggregate(t=Sum("discount_amount"))["t"] or Decimal("0")
            line_discount = max(Decimal("0"), source_line.discount_amount - prev_discounts)

            prev_taxes = models.SalesReturnLine.objects.filter(
                goods_sale_line=source_line,
                sale_return__status=models.DocumentStatus.POSTED
            ).exclude(sale_return_id=current_return_id).aggregate(t=Sum("tax_amount"))["t"] or Decimal("0")
            line_tax = max(Decimal("0"), source_line.tax_amount - prev_taxes)
        else:
            if sold_qty > Decimal("0"):
                line_discount = round_money((source_line.discount_amount * return_qty) / sold_qty, currency)
                line_tax = round_money((source_line.tax_amount * return_qty) / sold_qty, currency)
            else:
                line_discount = Decimal("0")
                line_tax = Decimal("0")

        line_total = line_subtotal - line_discount + line_tax

        # Cost and COGS (BR-SAL-05-09)
        unit_cost = source_line.unit_cost
        line_cogs = round_money(return_qty * unit_cost, currency)

        # Warehouse validation for ATTACH_INWARD
        warehouse = None
        if inventory_handling == models.SalesReturn.InventoryHandling.ATTACH_INWARD:
            wh_id = raw.get("warehouse") or raw.get("warehouse_id") or (source_line.warehouse_id if source_line.warehouse else None)
            if not wh_id:
                raise ValidationError(f"Dòng {idx}: Bắt buộc chọn kho nhận lại khi lập phiếu nhập kèm theo.")
            warehouse = Warehouse.objects.filter(company=company, id=wh_id, status="ACTIVE").first()
            if not warehouse:
                raise ValidationError(f"Dòng {idx}: Kho nhận lại không hợp lệ hoặc đã ngừng hoạt động.")

        if inventory_handling == models.SalesReturn.InventoryHandling.NO_INVENTORY:
            if item.track_inventory:
                raise ValidationError(f"Dòng {idx}: Hàng hóa {item.code} theo dõi tồn kho, không được chọn 'Không quản lý kho'.")

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

        inv_acc_id = raw.get("inventory_account") or raw.get("inventory_account_id") or source_line.inventory_account_id
        inv_acc = Account.objects.filter(company=company, id=inv_acc_id, status="ACTIVE", is_postable=True).first() if inv_acc_id else default_accs["inventory_account"]

        cogs_acc_id = raw.get("cogs_account") or raw.get("cogs_account_id") or source_line.cogs_account_id
        cogs_acc = Account.objects.filter(company=company, id=cogs_acc_id, status="ACTIVE", is_postable=True).first() if cogs_acc_id else default_accs["cogs_account"]

        line_record = {
            "line_no": idx,
            "goods_sale_line": source_line,
            "item": item,
            "description": raw.get("description") or source_line.description or item.name,
            "uom": source_line.uom,
            "warehouse": warehouse,
            "sold_quantity": sold_qty,
            "return_quantity": return_qty,
            "unit_price": unit_price,
            "discount_amount": line_discount,
            "tax_rate": source_line.tax_rate,
            "tax_amount": line_tax,
            "line_total": line_total,
            "unit_cost": unit_cost,
            "cogs_amount": line_cogs,
            "revenue_deduction_account": rev_acc,
            "tax_account": tax_acc,
            "receivable_account": rec_acc,
            "inventory_account": inv_acc,
            "cogs_account": cogs_acc,
        }

        processed_lines.append(line_record)
        subtotal += line_subtotal
        discount_amount += line_discount
        tax_amount += line_tax
        total_cogs += line_cogs

    total_amount = subtotal - discount_amount + tax_amount

    return {
        "lines": processed_lines,
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "total_cogs": total_cogs,
    }


@transaction.atomic
def create_sales_return(request, validated_data, lines_data):
    """Create a new SalesReturn record and lines in DRAFT status (Luồng chính Bước 7)."""
    company = validated_data["company"]
    goods_sale = validated_data["goods_sale"]
    customer = validated_data["customer"]

    if goods_sale.company_id != company.id:
        raise ValidationError("Chứng từ bán hàng nguồn không thuộc cùng doanh nghiệp.")
    if goods_sale.status != models.DocumentStatus.POSTED:
        raise ValidationError("Chứng từ bán hàng nguồn phải ở trạng thái Đã ghi sổ (POSTED).")
    if customer.company_id != company.id or customer.id != goods_sale.customer_id:
        raise ValidationError("Khách hàng không khớp với khách hàng trên chứng từ bán hàng nguồn.")

    return_reason = validated_data.get("return_reason", "").strip()
    if not return_reason:
        raise ValidationError({"return_reason": "Bắt buộc nhập lý do trả lại hàng."})

    inventory_handling = validated_data.get("inventory_handling", models.SalesReturn.InventoryHandling.ATTACH_INWARD)
    if inventory_handling == models.SalesReturn.InventoryHandling.LINK_EXISTING:
        if not validated_data.get("inventory_transaction"):
            raise ValidationError({"inventory_transaction": "Bắt buộc chọn phiếu nhập kho liên kết khi chọn liên kết phiếu đã có."})

    currency = validated_data.get("currency") or goods_sale.currency
    exchange_rate = validated_data.get("exchange_rate") or (Decimal("1") if currency.code == "VND" else goods_sale.exchange_rate)
    if Decimal(str(exchange_rate)) <= Decimal("0"):
        raise ValidationError({"exchange_rate": "Tỷ giá hạch toán phải lớn hơn 0."})

    calc = calculate_and_validate_return_lines(
        company=company,
        goods_sale=goods_sale,
        lines_data=lines_data,
        currency=currency,
        current_return_id=None,
        inventory_handling=inventory_handling,
    )

    doc_date = validated_data.get("document_date") or timezone.localdate()
    posting_date = validated_data.get("posting_date") or doc_date

    number = validated_data.get("number")
    if not number:
        number = generate_sales_return_number(company, branch=validated_data.get("branch"), document_date=doc_date)

    sale_return = models.SalesReturn.objects.create(
        company=company,
        branch=validated_data.get("branch"),
        number=number,
        document_date=doc_date,
        posting_date=posting_date,
        customer=customer,
        goods_sale=goods_sale,
        currency=currency,
        exchange_rate=exchange_rate,
        return_reason=return_reason,
        inventory_handling=inventory_handling,
        inventory_transaction=validated_data.get("inventory_transaction"),
        original_tax_invoice=validated_data.get("original_tax_invoice") or goods_sale.tax_invoice,
        tax_invoice=validated_data.get("tax_invoice"),
        subtotal=calc["subtotal"],
        discount_amount=calc["discount_amount"],
        tax_amount=calc["tax_amount"],
        total_amount=calc["total_amount"],
        status=models.DocumentStatus.DRAFT,
        notes=validated_data.get("notes", ""),
        attachments=validated_data.get("attachments", []),
        created_by=actor_for(request),
        version=1,
    )

    snapshot = configured_snapshot(sale_return, "SAL.SALES_RETURN")
    if snapshot and snapshot.get("version_id"):
        sale_return.workflow_snapshot = snapshot
        sale_return.approval_required = True
        sale_return.save(update_fields=["workflow_snapshot", "approval_required"])
    else:
        sale_return.approval_required = False
        sale_return.save(update_fields=["approval_required"])

    for item_calc in calc["lines"]:
        models.SalesReturnLine.objects.create(sale_return=sale_return, **item_calc)

    audit(request, sale_return, "CREATE", after={"number": sale_return.number, "total_amount": str(sale_return.total_amount)})
    return sale_return


@transaction.atomic
def update_sales_return(request, sale_return, validated_data, lines_data):
    """Update a sales return document with optimistic locking (AF-06, BR-SAL-05-13, EF-08)."""
    sale_return = models.SalesReturn.objects.select_for_update().get(pk=sale_return.pk)

    if sale_return.status not in {
        models.DocumentStatus.DRAFT,
        models.DocumentStatus.REVISION_REQUIRED,
        models.DocumentStatus.REJECTED,
    }:
        raise ValidationError(f"Không thể chỉnh sửa chứng từ ở trạng thái {sale_return.get_status_display()}.")

    client_version = validated_data.get("version")
    if client_version is not None and int(client_version) != sale_return.version:
        raise ValidationError("Chứng từ vừa được người khác cập nhật. Vui lòng tải lại trang.")

    company = sale_return.company
    goods_sale = validated_data.get("goods_sale") or sale_return.goods_sale
    inventory_handling = validated_data.get("inventory_handling", sale_return.inventory_handling)

    currency = validated_data.get("currency") or sale_return.currency
    exchange_rate = validated_data.get("exchange_rate") or sale_return.exchange_rate

    calc = calculate_and_validate_return_lines(
        company=company,
        goods_sale=goods_sale,
        lines_data=lines_data,
        currency=currency,
        current_return_id=sale_return.pk,
        inventory_handling=inventory_handling,
    )

    before = {"subtotal": str(sale_return.subtotal), "total_amount": str(sale_return.total_amount)}

    sale_return.document_date = validated_data.get("document_date", sale_return.document_date)
    sale_return.posting_date = validated_data.get("posting_date", sale_return.posting_date)
    sale_return.return_reason = validated_data.get("return_reason", sale_return.return_reason)
    sale_return.inventory_handling = inventory_handling
    if "inventory_transaction" in validated_data:
        sale_return.inventory_transaction = validated_data["inventory_transaction"]
    if "tax_invoice" in validated_data:
        sale_return.tax_invoice = validated_data["tax_invoice"]
    sale_return.currency = currency
    sale_return.exchange_rate = exchange_rate
    sale_return.subtotal = calc["subtotal"]
    sale_return.discount_amount = calc["discount_amount"]
    sale_return.tax_amount = calc["tax_amount"]
    sale_return.total_amount = calc["total_amount"]
    sale_return.notes = validated_data.get("notes", sale_return.notes)
    sale_return.attachments = validated_data.get("attachments", sale_return.attachments)
    sale_return.version += 1
    sale_return.save()

    sale_return.lines.all().delete()
    for item_calc in calc["lines"]:
        models.SalesReturnLine.objects.create(sale_return=sale_return, **item_calc)

    after = {"subtotal": str(sale_return.subtotal), "total_amount": str(sale_return.total_amount)}
    audit(request, sale_return, "UPDATE", before=before, after=after)
    return sale_return


@transaction.atomic
def submit_sales_return(request, sale_return, notes=""):
    """Submit a sales return for approval (Luồng chính Bước 8)."""
    sale_return = models.SalesReturn.objects.select_for_update().get(pk=sale_return.pk)
    if sale_return.status not in {
        models.DocumentStatus.DRAFT,
        models.DocumentStatus.REVISION_REQUIRED,
        models.DocumentStatus.REJECTED,
    }:
        raise ValidationError("Chỉ chứng từ ở trạng thái Nháp, Yêu cầu sửa hoặc Từ chối mới được gửi duyệt.")

    snapshot = configured_snapshot(sale_return, "SAL.SALES_RETURN")
    before = sale_return.status

    if snapshot and snapshot.get("version_id"):
        sale_return.workflow_snapshot = snapshot
        sale_return.approval_required = True
        sale_return.status = models.DocumentStatus.PENDING_APPROVAL
    else:
        sale_return.approval_required = False
        sale_return.status = models.DocumentStatus.APPROVED

    sale_return.submitted_at = timezone.now()
    sale_return.version += 1
    sale_return.save(update_fields=["workflow_snapshot", "approval_required", "status", "submitted_at", "version", "updated_at"])

    models.ApprovalDecision.objects.create(
        company=sale_return.company,
        document_type="SALES_RETURN",
        document_id=sale_return.pk,
        level=1,
        decision="SUBMITTED",
        actor=actor_for(request),
        comment=notes,
    )
    audit(request, sale_return, "SUBMIT", {"status": before}, {"status": sale_return.status}, reason=notes)
    return sale_return


@transaction.atomic
def withdraw_sales_return(request, sale_return, reason=""):
    """Withdraw a sales return waiting for approval back to DRAFT (AF-06)."""
    sale_return = models.SalesReturn.objects.select_for_update().get(pk=sale_return.pk)
    if sale_return.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ có thể thu hồi chứng từ đang Chờ duyệt.")

    before = sale_return.status
    sale_return.status = models.DocumentStatus.DRAFT
    sale_return.withdrawal_reason = reason
    sale_return.version += 1
    sale_return.save(update_fields=["status", "withdrawal_reason", "version", "updated_at"])

    models.ApprovalDecision.objects.create(
        company=sale_return.company,
        document_type="SALES_RETURN",
        document_id=sale_return.pk,
        level=1,
        decision="WITHDRAWN",
        actor=actor_for(request),
        comment=reason,
    )
    audit(request, sale_return, "WITHDRAW", {"status": before}, {"status": sale_return.status}, reason=reason)
    return sale_return


@transaction.atomic
def decide_sales_return(request, sale_return, decision, comment=""):
    """Handle approval decisions: APPROVED, REVISION_REQUIRED, REJECTED (AF-07)."""
    sale_return = models.SalesReturn.objects.select_for_update().get(pk=sale_return.pk)
    if sale_return.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ không ở trạng thái Chờ duyệt.")

    if decision in {models.DocumentStatus.REJECTED, models.DocumentStatus.REVISION_REQUIRED} and not comment.strip():
        raise ValidationError({"comment": "Bắt buộc nhập ý kiến khi từ chối hoặc yêu cầu sửa."})

    decisions = list(models.ApprovalDecision.objects.filter(
        company=sale_return.company,
        document_type="SALES_RETURN",
        document_id=sale_return.pk
    ).order_by("decided_at"))

    current_level = 1
    for d in decisions:
        if d.decision == "APPROVED":
            current_level = d.level + 1

    next_status = decision
    if sale_return.workflow_snapshot.get("version_id"):
        progress = approval_progress(sale_return, actor_for(request), decision == "APPROVED", decisions)
        if progress:
            current_level = progress["level"]
            if decision == "APPROVED" and not progress["final"]:
                next_status = models.DocumentStatus.PENDING_APPROVAL

    before = sale_return.status
    sale_return.status = next_status
    if next_status == models.DocumentStatus.APPROVED:
        sale_return.approved_at = timezone.now()
    elif next_status == models.DocumentStatus.REJECTED:
        sale_return.rejection_reason = comment

    sale_return.version += 1
    sale_return.save()

    models.ApprovalDecision.objects.create(
        company=sale_return.company,
        document_type="SALES_RETURN",
        document_id=sale_return.pk,
        level=current_level,
        decision="APPROVED" if next_status in {models.DocumentStatus.APPROVED, models.DocumentStatus.PENDING_APPROVAL} else decision,
        actor=actor_for(request),
        comment=comment,
    )
    audit(request, sale_return, decision, {"status": before}, {"status": sale_return.status}, reason=comment)
    return sale_return


@transaction.atomic
def cancel_sales_return(request, sale_return, reason=""):
    """Cancel an unposted sales return and release reserved quantities (AF-08, BR-SAL-05-05)."""
    sale_return = models.SalesReturn.objects.select_for_update().get(pk=sale_return.pk)
    if sale_return.status == models.DocumentStatus.POSTED:
        raise ValidationError("Không thể hủy trực tiếp chứng từ Đã ghi sổ. Vui lòng bỏ ghi sổ trước.")
    if sale_return.status == models.DocumentStatus.CANCELLED:
        raise ValidationError("Chứng từ đã bị hủy trước đó.")

    before = sale_return.status
    sale_return.status = models.DocumentStatus.CANCELLED
    sale_return.cancellation_reason = reason
    sale_return.version += 1
    sale_return.save(update_fields=["status", "cancellation_reason", "version", "updated_at"])
    audit(request, sale_return, "CANCEL", {"status": before}, {"status": sale_return.status}, reason=reason)
    return sale_return


@transaction.atomic
def delete_sales_return(request, sale_return):
    """Delete draft sales return (AF-08, BR-SAL-05-13)."""
    sale_return = models.SalesReturn.objects.select_for_update().get(pk=sale_return.pk)
    if sale_return.status != models.DocumentStatus.DRAFT:
        raise ValidationError("Chỉ có thể xóa chứng từ ở trạng thái Nháp.")
    audit(request, sale_return, "DELETE", before={"number": sale_return.number})
    sale_return.lines.all().delete()
    sale_return.delete()


def _validate_return_posting_preconditions(sale_return):
    """Validate accounting period, postable accounts, and remaining returnable quantities (BR-SAL-05-03, BR-SAL-05-07, EF-04, EF-05)."""
    # 1. Accounting Period Check (EF-05, BR-SAL-05-07)
    period = AccountingPeriod.objects.filter(
        company=sale_return.company,
        start_date__lte=sale_return.posting_date,
        end_date__gte=sale_return.posting_date,
        status="OPEN"
    ).first()
    if not period:
        raise ValidationError("Kỳ kế toán đã bị khóa hoặc chưa mở cho ngày hạch toán.")

    # 2. Account Validity Check (EF-04, EF-05, BR-SAL-05-07)
    lines = list(sale_return.lines.select_related(
        "item", "warehouse", "revenue_deduction_account",
        "tax_account", "receivable_account", "cogs_account", "inventory_account", "goods_sale_line"
    ).all())

    for line in lines:
        for acc_field, acc in (
            ("revenue_deduction_account", line.revenue_deduction_account),
            ("tax_account", line.tax_account),
            ("receivable_account", line.receivable_account),
            ("cogs_account", line.cogs_account),
            ("inventory_account", line.inventory_account),
        ):
            if acc:
                if acc.company_id != sale_return.company_id or not acc.is_postable or acc.status != "ACTIVE":
                    raise ValidationError(f"Tài khoản {acc.code} trên dòng {line.line_no} không hợp lệ hoặc đã ngừng sử dụng.")

    # 3. Re-verify source remaining balances in atomic lock (BR-SAL-05-03, EF-03)
    for line in lines:
        source_line = line.goods_sale_line
        sold_qty = source_line.quantity
        other_posted = models.SalesReturnLine.objects.filter(
            goods_sale_line=source_line,
            sale_return__status=models.DocumentStatus.POSTED
        ).exclude(sale_return=sale_return).aggregate(t=Sum("return_quantity"))["t"] or Decimal("0")

        if other_posted + line.return_quantity > sold_qty:
            raise ValidationError(
                f"Dòng {line.line_no}: Số lượng trả ({line.return_quantity}) cộng số lượng đã trả trước đó ({other_posted}) vượt quá số lượng đã bán ({sold_qty})."
            )

    return period, lines


@transaction.atomic
def post_sales_return(request, sale_return):
    """Post sales return: updates GL, handles inward stock receipt, adjusts receivable (Luồng chính Bước 9-10)."""
    sale_return = models.SalesReturn.objects.select_for_update().get(pk=sale_return.pk)
    if sale_return.status == models.DocumentStatus.POSTED:
        raise ValidationError("Chứng từ đã được ghi sổ trước đó.")

    # Check approval state: must be APPROVED, or allow direct posting from DRAFT if workflow not configured
    if sale_return.status != models.DocumentStatus.APPROVED:
        snapshot = configured_snapshot(sale_return, "SAL.SALES_RETURN")
        has_workflow = bool(snapshot and snapshot.get("version_id"))
        if sale_return.status == models.DocumentStatus.DRAFT and (not sale_return.approval_required or not has_workflow):
            pass  # Direct posting allowed from DRAFT
        else:
            raise ValidationError(f"Chỉ chứng từ Đã duyệt mới có thể ghi sổ (trạng thái hiện tại: {sale_return.get_status_display()}).")

    period, lines = _validate_return_posting_preconditions(sale_return)

    # 1. Handle Inward Stock Transaction if ATTACH_INWARD (BR-SAL-05-09)
    if sale_return.inventory_handling == models.SalesReturn.InventoryHandling.ATTACH_INWARD and not sale_return.inventory_transaction_id:
        primary_wh = lines[0].warehouse
        orig_issue = sale_return.goods_sale.inventory_transaction

        if orig_issue:
            inward_trx = InventoryTransaction.objects.create(
                company=sale_return.company,
                branch=sale_return.branch,
                supplier=sale_return.customer,
                number=f"{sale_return.number}-NK",
                transaction_type="RETURN",
                transaction_date=sale_return.posting_date,
                original_transaction=orig_issue,
                destination_warehouse=primary_wh,
                source_module="SAL",
                source_reference=sale_return.number,
                status="APPROVED",
                created_by=actor_for(request),
            )
        else:
            inward_trx = InventoryTransaction.objects.create(
                company=sale_return.company,
                branch=sale_return.branch,
                supplier=sale_return.customer,
                number=f"{sale_return.number}-NK",
                transaction_type="RECEIPT",
                transaction_date=sale_return.posting_date,
                destination_warehouse=primary_wh,
                source_module="SAL",
                source_reference=sale_return.number,
                status="APPROVED",
                created_by=actor_for(request),
            )

        for line in lines:
            InventoryTransactionLine.objects.create(
                transaction=inward_trx,
                line_no=line.line_no,
                item=line.item,
                uom=line.uom,
                quantity=line.return_quantity,
                base_quantity=line.return_quantity,
                unit_cost=line.unit_cost,
                line_value=line.cogs_amount,
                movement_direction="IN",
            )

        post_inventory(inward_trx, request)
        sale_return.inventory_transaction = inward_trx
        sale_return.inventory_created = True

    # 2. Create and Post JournalEntry (BR-SAL-05-08, BR-SAL-05-09)
    total_cogs = sum(line.cogs_amount for line in lines) if sale_return.inventory_handling == models.SalesReturn.InventoryHandling.ATTACH_INWARD else Decimal("0")
    total_debit = sale_return.total_amount + total_cogs
    total_credit = sale_return.total_amount + total_cogs

    journal = JournalEntry.objects.create(
        company=sale_return.company,
        branch=sale_return.branch,
        period=period,
        number=f"{sale_return.number}-GL",
        entry_type="SUBLEDGER",
        posting_date=sale_return.posting_date,
        document_date=sale_return.document_date,
        description=f"Hàng bán bị trả lại - {sale_return.number}",
        source_module="SAL",
        source_event_id=f"SAL.RETURN:{sale_return.pk}:{sale_return.version}",
        source_entity_type="SalesReturn",
        source_entity_id=sale_return.pk,
        status="APPROVED",
        total_debit=total_debit,
        total_credit=total_credit,
        workflow_snapshot={"allow_creator_posting": True},
        created_by=actor_for(request),
        approved_by=actor_for(request),
        approved_at=timezone.now(),
    )

    gl_line_no = 0

    # Debits: Revenue Deductions (5212/521)
    for line in lines:
        line_net = (line.return_quantity * line.unit_price) - line.discount_amount
        if line_net > 0:
            gl_line_no += 1
            JournalLine.objects.create(
                entry=journal,
                line_no=gl_line_no,
                account=line.revenue_deduction_account,
                description=f"Giảm trừ doanh thu {line.item.code} - {sale_return.number}",
                debit=line_net,
                credit=Decimal("0"),
                currency=sale_return.currency,
                party=sale_return.customer,
                warehouse=line.warehouse,
            )

    # Debits: VAT Output Reduction (33311)
    for line in lines:
        if line.tax_amount > 0 and line.tax_account:
            gl_line_no += 1
            JournalLine.objects.create(
                entry=journal,
                line_no=gl_line_no,
                account=line.tax_account,
                description=f"Điều chỉnh giảm thuế GTGT đầu ra {line.item.code} - {sale_return.number}",
                debit=line.tax_amount,
                credit=Decimal("0"),
                currency=sale_return.currency,
                party=sale_return.customer,
            )

    # Credit: Accounts Receivable (131)
    gl_line_no += 1
    JournalLine.objects.create(
        entry=journal,
        line_no=gl_line_no,
        account=lines[0].receivable_account,
        description=f"Giảm trừ công nợ phải thu khách hàng - {sale_return.number}",
        debit=Decimal("0"),
        credit=sale_return.total_amount,
        currency=sale_return.currency,
        party=sale_return.customer,
    )

    # Inventory Return & COGS Reversal (Nợ 156 / Có 632) when ATTACH_INWARD
    if sale_return.inventory_handling == models.SalesReturn.InventoryHandling.ATTACH_INWARD:
        for line in lines:
            if line.cogs_amount > 0 and line.inventory_account and line.cogs_account:
                gl_line_no += 1
                JournalLine.objects.create(
                    entry=journal,
                    line_no=gl_line_no,
                    account=line.inventory_account,
                    description=f"Nhập lại kho hàng trả {line.item.code} - {sale_return.number}",
                    debit=line.cogs_amount,
                    credit=Decimal("0"),
                    currency=sale_return.currency,
                    warehouse=line.warehouse,
                )
                gl_line_no += 1
                JournalLine.objects.create(
                    entry=journal,
                    line_no=gl_line_no,
                    account=line.cogs_account,
                    description=f"Hoàn giảm giá vốn hàng bán {line.item.code} - {sale_return.number}",
                    debit=Decimal("0"),
                    credit=line.cogs_amount,
                    currency=sale_return.currency,
                    party=sale_return.customer,
                    warehouse=line.warehouse,
                )

    post_journal(journal, request)
    sale_return.journal_entry = journal

    # 3. Receivable Offset & Refundable Calculation (BR-SAL-05-11)
    goods_sale = sale_return.goods_sale
    if goods_sale and getattr(goods_sale, "receivable", None):
        rec = goods_sale.receivable
        if rec.balance >= sale_return.total_amount:
            rec.adjustment_amount += sale_return.total_amount
            rec.balance -= sale_return.total_amount
            if rec.balance == Decimal("0"):
                rec.status = ReceivableStatus.PAID
            rec.save(update_fields=["adjustment_amount", "balance", "status", "updated_at"])
            sale_return.refundable_amount = Decimal("0")
        else:
            offset_part = rec.balance
            excess_part = sale_return.total_amount - offset_part
            rec.adjustment_amount += offset_part
            rec.balance = Decimal("0")
            rec.status = ReceivableStatus.PAID
            rec.save(update_fields=["adjustment_amount", "balance", "status", "updated_at"])
            sale_return.refundable_amount = excess_part
    else:
        # If no receivable (e.g. paid in CASH / BANK upfront), full amount is refundable
        sale_return.refundable_amount = sale_return.total_amount

    sale_return.status = models.DocumentStatus.POSTED
    sale_return.posted_at = timezone.now()
    sale_return.posted_by = actor_for(request)
    sale_return.version += 1
    sale_return.save()

    audit(request, sale_return, "POST", after={"status": sale_return.status, "journal_id": str(journal.id)})
    return sale_return


@transaction.atomic
def unpost_sales_return(request, sale_return, reason=""):
    """Unpost a posted sales return, rollback GL, inventory, and receivable balance (AF-06, BR-SAL-05-13)."""
    sale_return = models.SalesReturn.objects.select_for_update().get(pk=sale_return.pk)
    if sale_return.status != models.DocumentStatus.POSTED:
        raise ValidationError("Chỉ có thể bỏ ghi sổ chứng từ Đã ghi sổ.")

    if sale_return.refunded_amount > Decimal("0"):
        raise ValidationError(
            f"Không thể bỏ ghi sổ khi đã phát sinh hoàn tiền cho khách ({sale_return.refunded_amount}). Vui lòng xử lý chứng từ hoàn tiền trước."
        )

    # 1. Reverse and delete JournalEntry
    if sale_return.journal_entry:
        journal = sale_return.journal_entry
        sale_return.journal_entry = None
        sale_return.save(update_fields=["journal_entry"])
        journal.lines.all().delete()
        journal.delete()

    # 2. Reverse Inventory Transaction if attached
    if sale_return.inventory_created and sale_return.inventory_transaction:
        inward_trx = sale_return.inventory_transaction
        sale_return.inventory_transaction = None
        sale_return.inventory_created = False
        sale_return.save(update_fields=["inventory_transaction", "inventory_created"])
        inward_trx.gl_status = "NOT_REQUIRED"
        inward_trx.save(update_fields=["gl_status"])
        if hasattr(request, "data") and isinstance(request.data, dict) and not request.data.get("reason"):
            request.data["reason"] = reason or "Bỏ ghi sổ chứng từ trả hàng"
        reverse_inventory(inward_trx, request)

    # 3. Revert Receivable adjustment
    goods_sale = sale_return.goods_sale
    if goods_sale and getattr(goods_sale, "receivable", None):
        rec = goods_sale.receivable
        adjusted_amount = sale_return.total_amount - sale_return.refundable_amount
        if adjusted_amount > Decimal("0"):
            rec.adjustment_amount = max(Decimal("0"), rec.adjustment_amount - adjusted_amount)
            rec.balance += adjusted_amount
            rec.status = ReceivableStatus.OPEN if rec.balance == rec.original_amount else ReceivableStatus.PARTIALLY_PAID
            rec.save(update_fields=["adjustment_amount", "balance", "status", "updated_at"])

    sale_return.refundable_amount = Decimal("0")
    sale_return.status = models.DocumentStatus.DRAFT
    sale_return.posted_at = None
    sale_return.posted_by = None
    sale_return.version += 1
    sale_return.save()

    audit(request, sale_return, "UNPOST", after={"status": sale_return.status}, reason=reason)
    return sale_return


@transaction.atomic
def refund_sales_return(request, sale_return, data):
    """Refund money to customer for excess refundable amount (AF-05, BR-SAL-05-11, EF-07)."""
    sale_return = models.SalesReturn.objects.select_for_update().get(pk=sale_return.pk)
    if sale_return.status != models.DocumentStatus.POSTED:
        raise ValidationError("Chỉ có thể lập chứng từ hoàn tiền trên chứng từ hàng bán trả lại Đã ghi sổ.")

    try:
        amount = Decimal(str(data.get("amount", "0")))
    except Exception:
        raise ValidationError({"amount": "Số tiền hoàn không hợp lệ."})

    if amount <= Decimal("0"):
        raise ValidationError({"amount": "Số tiền hoàn phải lớn hơn 0."})

    remaining_refundable = sale_return.refundable_amount - sale_return.refunded_amount
    if amount > remaining_refundable:
        raise ValidationError(
            f"Số tiền hoàn ({amount}) vượt quá phần còn phải hoàn ({remaining_refundable})."
        )

    payment_method = data.get("payment_method", "CASH")
    company = sale_return.company
    ref_date = timezone.localdate()

    period = AccountingPeriod.objects.filter(
        company=company,
        start_date__lte=ref_date,
        end_date__gte=ref_date,
        status="OPEN"
    ).first()
    if not period:
        raise ValidationError("Kỳ kế toán đã bị khóa hoặc chưa mở cho ngày hoàn tiền.")

    # Debit 131 / Credit 111 or 112
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
        branch=sale_return.branch,
        period=period,
        number=f"{sale_return.number}-RF-{sale_return.version}",
        entry_type="SUBLEDGER",
        posting_date=ref_date,
        document_date=ref_date,
        description=f"Hoàn tiền khách hàng trả hàng - {sale_return.number}",
        source_module="SAL",
        source_event_id=f"SAL.RETURN_REFUND:{sale_return.pk}:{sale_return.refunded_amount + amount}",
        source_entity_type="SalesReturn",
        source_entity_id=sale_return.pk,
        status="APPROVED",
        total_debit=amount,
        total_credit=amount,
        workflow_snapshot={"allow_creator_posting": True},
        created_by=actor_for(request),
        approved_by=actor_for(request),
        approved_at=timezone.now(),
    )

    # Line 1: Nợ 131
    JournalLine.objects.create(
        entry=refund_journal,
        line_no=1,
        account=rec_acc,
        description=f"Hoàn tiền khách hàng trả hàng - {sale_return.number}",
        debit=amount,
        credit=Decimal("0"),
        currency=sale_return.currency,
        party=sale_return.customer,
    )
    # Line 2: Có 111 / 112
    JournalLine.objects.create(
        entry=refund_journal,
        line_no=2,
        account=cash_acc,
        description=f"Chi tiền hoàn trả khách hàng - {sale_return.number}",
        debit=Decimal("0"),
        credit=amount,
        currency=sale_return.currency,
        party=sale_return.customer,
    )

    post_journal(refund_journal, request)

    sale_return.refunded_amount += amount
    sale_return.version += 1
    sale_return.save(update_fields=["refunded_amount", "version", "updated_at"])

    audit(request, sale_return, "REFUND", after={"refunded_amount": str(sale_return.refunded_amount), "journal_id": str(refund_journal.id)})
    return {
        "sales_return_id": str(sale_return.id),
        "refunded_amount": str(sale_return.refunded_amount),
        "remaining_refundable": str(sale_return.refundable_amount - sale_return.refunded_amount),
        "journal_entry_id": str(refund_journal.id),
    }


@transaction.atomic
def link_tax_invoice(request, sale_return, data):
    """Link an adjustment/return tax invoice to the sales return (AF-09, BR-SAL-05-12, EF-08)."""
    sale_return = models.SalesReturn.objects.select_for_update().get(pk=sale_return.pk)
    invoice_id = data.get("invoice_id")
    if not invoice_id:
        raise ValidationError({"invoice_id": "Bắt buộc chọn hóa đơn để liên kết."})

    from tax_management.models import TaxInvoice
    invoice = TaxInvoice.objects.filter(company=sale_return.company, id=invoice_id).first()
    if not invoice:
        raise ValidationError("Hóa đơn không tồn tại hoặc không thuộc doanh nghiệp.")

    if invoice.buyer_name and sale_return.customer.name not in invoice.buyer_name and invoice.tax_code != sale_return.customer.tax_code:
        raise ValidationError("Thông tin người mua trên hóa đơn không khớp với khách hàng của chứng từ.")

    before = str(sale_return.tax_invoice_id) if sale_return.tax_invoice_id else None
    sale_return.tax_invoice = invoice
    sale_return.invoice_link_notes = data.get("invoice_link_notes", "").strip()
    sale_return.version += 1
    sale_return.save(update_fields=["tax_invoice", "invoice_link_notes", "version", "updated_at"])

    audit(request, sale_return, "LINK_INVOICE", before={"tax_invoice": before}, after={"tax_invoice": str(invoice.id)})
    return sale_return
