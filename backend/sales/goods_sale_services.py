"""UC-SAL-03: Ghi nhận bán hàng hóa (Sales Goods Invoice / Sales Goods Document).

Implements:
- Header & Line creation, validation, precision calculation, and rounding (BR-SAL-03-02, BR-SAL-03-04).
- Automatic document numbering (BH-YYYY-NNNNNN) and default values prefill.
- Source inheritance from Sales Order and Inventory Issue (BR-SAL-03-03, AF-02, AF-04).
- Workflow management: Submit, Withdraw, Approve, Request Revision, Reject, Cancel.
- Posting (Ghi sổ):
  * Accounting period & postable account validation (BR-SAL-03-06, EF-03, EF-04).
  * GL JournalEntry creation (Nợ 131/111/112, Có 511, Có 33311, Nợ 632, Có 156) (BR-SAL-03-07, BR-SAL-03-08).
  * Accounts Receivable creation when UNPAID (AF-03, BR-SAL-03-10).
  * Inventory Transaction creation and posting when ATTACH_ISSUE (EF-05).
  * Skip inventory re-posting when LINK_EXISTING (BR-SAL-03-09, AF-04).
  * Handle non-inventory items when NO_INVENTORY (AF-05).
- Unposting (Bỏ ghi sổ) and invoice linking (AF-09, BR-SAL-03-11, EF-07).
- Optimistic concurrency control and Audit Logging (BR-SAL-03-13, EF-08).
"""
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from approval_workflows.execution import approval_progress
from approval_workflows.submission import configured_snapshot
from audit_log.services import record_audit
from common_services.models import CoreCompanySetting, DocumentNumberingRule
from general_ledger.models import Account, AccountBalance, AccountingPeriod, JournalEntry, JournalLine
from general_ledger.services import _balance as get_or_create_balance, _recalculate_closing
from general_ledger.services import post as post_journal
from inventory.models import InventoryPolicy, InventoryTransaction, InventoryTransactionLine, StockBalance
from inventory.services import post as post_inventory, reverse as reverse_inventory
from accounts_receivable.models import Receivable, ReceivableStatus
from master_data.models import Currency, DocumentType, Item, Party, PartyAddress, TaxRate, UnitOfMeasure, Warehouse
from . import models

MONEY = Decimal("0.0001")


def actor_for(request):
    """Retrieve IAM account or fallback user for audit and ownership tracking."""
    if not request:
        from iam.models import UserAccount
        return UserAccount.objects.first()
    if hasattr(request, "iam_account"):
        return request.iam_account
    user = getattr(request, "user", None)
    if user and hasattr(user, "iam_account"):
        return user.iam_account
    from iam.models import UserAccount
    if isinstance(user, UserAccount):
        return user
    return UserAccount.objects.first()


def audit(request, sale, action, before=None, after=None, reason=""):
    """Write an audit entry for sales goods transactions."""
    actor = actor_for(request)
    if actor and hasattr(actor, "id"):
        record_audit(
            company=sale.company,
            actor_user=actor,
            module_code="SAL",
            action_code=action,
            entity=sale,
            before=before or {},
            after=after or {},
            request=request,
            reason=reason,
        )


def generate_goods_sale_number(company, branch=None, document_date=None):
    """Generate unique sales goods number using DocumentNumberingRule or GoodsSaleCounter."""
    ref_date = document_date or timezone.localdate()
    try:
        from common_services.numbering_services import generate_document_number
        doc_type = DocumentType.objects.filter(code__in=["SAL.GOODS_SALE", "BH", "SALES_GOODS"]).first()
        if doc_type:
            num = generate_document_number(company, doc_type, branch=branch, document_date=ref_date)
            if num:
                return num
    except Exception:
        pass

    year = ref_date.year
    with transaction.atomic():
        counter, _ = models.GoodsSaleCounter.objects.select_for_update().get_or_create(company=company, year=year)
        while True:
            counter.value += 1
            counter.save(update_fields=["value"])
            candidate = f"BH-{year}-{counter.value:06d}"
            if not models.GoodsSale.objects.filter(company=company, number=candidate).exists():
                return candidate


def resolve_default_accounts(company, payment_type=models.GoodsSale.PaymentType.UNPAID):
    """Resolve default postable accounts for sales operations."""
    # Receivable / Payment
    if payment_type == models.GoodsSale.PaymentType.CASH:
        payment_acc = Account.objects.filter(company=company, code__startswith="111", is_postable=True, status="ACTIVE").order_by("code").first()
    elif payment_type == models.GoodsSale.PaymentType.BANK:
        payment_acc = Account.objects.filter(company=company, code__startswith="112", is_postable=True, status="ACTIVE").order_by("code").first()
    else:
        payment_acc = Account.objects.filter(company=company, code__startswith="131", is_postable=True, status="ACTIVE").order_by("code").first()

    revenue_acc = Account.objects.filter(company=company, code__startswith="511", is_postable=True, status="ACTIVE").order_by("code").first()
    tax_acc = Account.objects.filter(company=company, code__startswith="3331", is_postable=True, status="ACTIVE").order_by("code").first()
    cogs_acc = Account.objects.filter(company=company, code__startswith="632", is_postable=True, status="ACTIVE").order_by("code").first()
    inv_acc = Account.objects.filter(company=company, code__startswith="156", is_postable=True, status="ACTIVE").order_by("code").first()

    return {
        "payment_account": payment_acc,
        "revenue_account": revenue_acc,
        "tax_account": tax_acc,
        "cogs_account": cogs_acc,
        "inventory_account": inv_acc,
    }


def get_goods_sale_defaults(company, user, customer_id=None, branch_id=None):
    """Provide default values when creating a new goods sale document (Luồng chính Bước 2, 3, 4)."""
    today = timezone.localdate()
    currency = getattr(company, "accounting_currency", None) or Currency.objects.filter(code="VND").first()

    defaults = {
        "document_date": today.isoformat(),
        "posting_date": today.isoformat(),
        "currency": str(currency.id) if currency else None,
        "currency_code": currency.code if currency else "VND",
        "exchange_rate": "1",
        "payment_type": models.GoodsSale.PaymentType.UNPAID,
        "inventory_handling": models.GoodsSale.InventoryHandling.ATTACH_ISSUE,
        "customer": None,
        "customer_address": "",
        "customer_tax_code": "",
        "payment_term": None,
        "due_date": today.isoformat(),
        "description": "Bán hàng hóa",
    }

    accs = resolve_default_accounts(company, models.GoodsSale.PaymentType.UNPAID)
    defaults["default_accounts"] = {
        "receivable_or_payment_account": str(accs["payment_account"].id) if accs["payment_account"] else None,
        "revenue_account": str(accs["revenue_account"].id) if accs["revenue_account"] else None,
        "tax_account": str(accs["tax_account"].id) if accs["tax_account"] else None,
        "cogs_account": str(accs["cogs_account"].id) if accs["cogs_account"] else None,
        "inventory_account": str(accs["inventory_account"].id) if accs["inventory_account"] else None,
    }

    if customer_id:
        customer = Party.objects.filter(pk=customer_id, company=company).first()
        if customer:
            defaults["customer"] = str(customer.id)
            defaults["customer_tax_code"] = customer.tax_code or ""
            addr = PartyAddress.objects.filter(party=customer, is_default=True).first() or PartyAddress.objects.filter(party=customer).first()
            if addr:
                defaults["customer_address"] = addr.address_line or getattr(addr, "street_address", "")
            else:
                defaults["customer_address"] = getattr(customer, "legal_name", "") or customer.name

            if customer.payment_term:
                defaults["payment_term"] = str(customer.payment_term_id)
                due_days = customer.payment_term.due_days or 0
                defaults["due_date"] = (today + timedelta(days=due_days)).isoformat()

    return defaults


def calculate_and_validate_sale_lines(company, lines_data, payment_type, inventory_handling, currency=None):
    """Validate item types, calculate line amounts, resolve GL accounts, and compute COGS (BR-SAL-03-02, BR-SAL-03-04, BR-SAL-03-08)."""
    if not lines_data:
        raise ValidationError("Chứng từ bán hàng phải có ít nhất một dòng hàng.")

    defaults = resolve_default_accounts(company, payment_type)
    subtotal = Decimal("0")
    discount_amount = Decimal("0")
    tax_amount = Decimal("0")
    processed_lines = []

    for idx, raw in enumerate(lines_data, start=1):
        item_id = raw.get("item") or raw.get("item_id")
        if not item_id:
            raise ValidationError(f"Dòng {idx}: Chưa chọn mặt hàng.")

        item = Item.objects.filter(pk=item_id, company=company).first()
        if not item:
            raise ValidationError(f"Dòng {idx}: Mặt hàng không tồn tại.")
        if item.status != "ACTIVE":
            raise ValidationError(f"Dòng {idx}: Mặt hàng {item.code} đã ngừng sử dụng.")

        # BR-SAL-03-02: Chỉ ghi nhận mặt hàng loại Hàng hóa; không chọn dịch vụ
        if item.item_type != "GOODS":
            raise ValidationError(f"Dòng {idx}: Chỉ ghi nhận mặt hàng loại Hàng hóa (mặt hàng {item.code} là {item.get_item_type_display()}).")

        # AF-05: Không quản lý kho chỉ áp dụng cho hàng không theo dõi kho
        if inventory_handling == models.GoodsSale.InventoryHandling.NO_INVENTORY and item.track_inventory:
            raise ValidationError(f"Dòng {idx}: Mặt hàng {item.code} có theo dõi tồn kho, không thể chọn hình thức 'Không quản lý kho'.")

        try:
            quantity = Decimal(str(raw.get("quantity", "0")))
            unit_price = Decimal(str(raw.get("unit_price", "0")))
            discount_rate = Decimal(str(raw.get("discount_rate", "0")))
        except Exception:
            raise ValidationError(f"Dòng {idx}: Số lượng, đơn giá hoặc tỷ lệ chiết khấu không hợp lệ.")

        if quantity <= 0:
            raise ValidationError(f"Dòng {idx}: Số lượng bán phải lớn hơn 0.")
        if unit_price < 0:
            raise ValidationError(f"Dòng {idx}: Đơn giá không được âm.")
        if discount_rate < 0 or discount_rate > 100:
            raise ValidationError(f"Dòng {idx}: Tỷ lệ chiết khấu phải từ 0% đến 100%.")

        gross = (quantity * unit_price).quantize(MONEY, ROUND_HALF_UP)
        line_discount = (gross * discount_rate / 100).quantize(MONEY, ROUND_HALF_UP)
        if raw.get("discount_amount") is not None and not raw.get("discount_rate"):
            line_discount = Decimal(str(raw.get("discount_amount"))).quantize(MONEY, ROUND_HALF_UP)

        if line_discount > gross:
            raise ValidationError(f"Dòng {idx}: Tiền chiết khấu không được vượt quá thành tiền.")

        net = gross - line_discount

        tax_rate_id = raw.get("tax_rate") or raw.get("tax_rate_id")
        tax_rate = None
        line_tax = Decimal("0")
        if tax_rate_id:
            tax_rate = TaxRate.objects.filter(pk=tax_rate_id).first()
            if tax_rate and tax_rate.rate_percent:
                line_tax = (net * tax_rate.rate_percent / 100).quantize(MONEY, ROUND_HALF_UP)

        line_total = net + line_tax

        # Warehouse validation for ATTACH_ISSUE
        warehouse_id = raw.get("warehouse") or raw.get("warehouse_id")
        warehouse = None
        if inventory_handling == models.GoodsSale.InventoryHandling.ATTACH_ISSUE:
            if not warehouse_id:
                raise ValidationError(f"Dòng {idx}: Bắt buộc chọn kho xuất khi lập phiếu xuất kho kèm theo.")
            warehouse = Warehouse.objects.filter(pk=warehouse_id, company=company).first()
            if not warehouse or warehouse.status != "ACTIVE":
                raise ValidationError(f"Dòng {idx}: Kho xuất không hợp lệ hoặc đã ngừng sử dụng.")
        elif warehouse_id:
            warehouse = Warehouse.objects.filter(pk=warehouse_id, company=company).first()

        # UoM
        uom_id = raw.get("uom") or raw.get("uom_id") or getattr(item, "sales_uom_id", None) or getattr(item, "base_uom_id", None)
        uom = UnitOfMeasure.objects.filter(pk=uom_id).first()
        if not uom:
            raise ValidationError(f"Dòng {idx}: Chưa xác định đơn vị tính.")

        # Unit cost and COGS calculation (BR-SAL-03-08)
        unit_cost = Decimal("0")
        cogs_amount = Decimal("0")
        if inventory_handling == models.GoodsSale.InventoryHandling.ATTACH_ISSUE and warehouse:
            bal = StockBalance.objects.filter(company=company, warehouse=warehouse, item=item).first()
            if bal and bal.average_cost > 0:
                unit_cost = bal.average_cost
            cogs_amount = (quantity * unit_cost).quantize(MONEY, ROUND_HALF_UP)

        # GL Accounts Resolution
        rec_acc_id = raw.get("receivable_or_payment_account") or raw.get("receivable_or_payment_account_id")
        rec_acc = Account.objects.filter(pk=rec_acc_id, company=company).first() if rec_acc_id else defaults["payment_account"]
        if not rec_acc or not rec_acc.is_postable or rec_acc.status != "ACTIVE":
            raise ValidationError(f"Dòng {idx}: Tài khoản thanh toán/phải thu không hợp lệ hoặc không cho phép hạch toán.")

        rev_acc_id = raw.get("revenue_account") or raw.get("revenue_account_id") or getattr(item, "revenue_account_id", None)
        rev_acc = Account.objects.filter(pk=rev_acc_id, company=company).first() if rev_acc_id else defaults["revenue_account"]
        if not rev_acc or not rev_acc.is_postable or rev_acc.status != "ACTIVE":
            raise ValidationError(f"Dòng {idx}: Tài khoản doanh thu không hợp lệ hoặc không cho phép hạch toán.")

        tax_acc = None
        if line_tax > 0:
            tax_acc_id = raw.get("tax_account") or raw.get("tax_account_id") or (tax_rate.output_tax_account_id if tax_rate and hasattr(tax_rate, "output_tax_account_id") else None)
            tax_acc = Account.objects.filter(pk=tax_acc_id, company=company).first() if tax_acc_id else defaults["tax_account"]
            if not tax_acc or not tax_acc.is_postable or tax_acc.status != "ACTIVE":
                raise ValidationError(f"Dòng {idx}: Tài khoản thuế đầu ra không hợp lệ hoặc không cho phép hạch toán.")

        cogs_acc = None
        inv_acc = None
        if inventory_handling in {models.GoodsSale.InventoryHandling.ATTACH_ISSUE, models.GoodsSale.InventoryHandling.SEPARATE_ISSUE}:
            cogs_acc_id = raw.get("cogs_account") or raw.get("cogs_account_id") or getattr(item, "cogs_account_id", None)
            cogs_acc = Account.objects.filter(pk=cogs_acc_id, company=company).first() if cogs_acc_id else defaults["cogs_account"]
            inv_acc_id = raw.get("inventory_account") or raw.get("inventory_account_id") or getattr(item, "inventory_account_id", None)
            inv_acc = Account.objects.filter(pk=inv_acc_id, company=company).first() if inv_acc_id else defaults["inventory_account"]

        # Check source links if provided
        order_line_id = raw.get("order_line") or raw.get("order_line_id")
        order_line = models.SalesOrderLine.objects.filter(pk=order_line_id).first() if order_line_id else None

        inv_line_id = raw.get("inventory_transaction_line") or raw.get("inventory_transaction_line_id")
        inv_line = InventoryTransactionLine.objects.filter(pk=inv_line_id).first() if inv_line_id else None

        processed_lines.append({
            "line_no": idx,
            "item": item,
            "description": raw.get("description") or item.name,
            "uom": uom,
            "warehouse": warehouse,
            "quantity": quantity,
            "unit_price": unit_price,
            "discount_rate": discount_rate,
            "discount_amount": line_discount,
            "tax_rate": tax_rate,
            "tax_amount": line_tax,
            "line_total": line_total,
            "receivable_or_payment_account": rec_acc,
            "revenue_account": rev_acc,
            "tax_account": tax_acc,
            "cogs_account": cogs_acc,
            "inventory_account": inv_acc,
            "unit_cost": unit_cost,
            "cogs_amount": cogs_amount,
            "order_line": order_line,
            "inventory_transaction_line": inv_line,
        })

        subtotal += gross
        discount_amount += line_discount
        tax_amount += line_tax

    total_amount = subtotal - discount_amount + tax_amount

    return {
        "lines": processed_lines,
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
    }


def prepare_from_sales_order(company, order_id):
    """Inherit header & line details from an existing confirmed Sales Order (AF-02, BR-SAL-03-03)."""
    order = models.SalesOrder.objects.filter(pk=order_id, company=company).first()
    if not order:
        raise ValidationError("Đơn bán hàng nguồn không tồn tại.")
    if order.status in {models.DocumentStatus.CANCELLED, models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}:
        raise ValidationError(f"Đơn bán hàng phải ở trạng thái Đã xác nhận (trạng thái hiện tại: {order.get_status_display()}).")

    lines_out = []
    for line in order.lines.select_related("item", "uom", "warehouse", "tax_rate").all():
        if line.item.item_type != "GOODS":
            continue
        used = models.GoodsSaleLine.objects.filter(order_line=line).exclude(sale__status=models.DocumentStatus.CANCELLED).aggregate(t=Sum("quantity"))["t"] or Decimal("0")
        rem = line.quantity - used
        if rem > 0:
            lines_out.append({
                "order_line": str(line.id),
                "item": str(line.item_id),
                "item_code": line.item.code,
                "item_name": line.item.name,
                "description": line.description or line.item.name,
                "uom": str(line.uom_id),
                "uom_name": line.uom.name,
                "warehouse": str(line.warehouse_id) if line.warehouse_id else None,
                "quantity": str(rem),
                "unit_price": str(line.unit_price),
                "discount_rate": str(line.discount_rate),
                "tax_rate": str(line.tax_rate_id) if line.tax_rate_id else None,
            })

    if not lines_out:
        raise ValidationError("Đơn bán hàng không còn số lượng hàng hóa chưa ghi nhận.")

    addr = order.customer_address
    if not addr:
        first_addr = PartyAddress.objects.filter(party=order.customer).first()
        addr = first_addr.address_line if first_addr else order.customer.name

    return {
        "company": str(company.id),
        "customer": str(order.customer_id),
        "customer_name": order.customer.name,
        "customer_address": addr,
        "customer_tax_code": order.customer.tax_code or "",
        "sales_order": str(order.id),
        "sales_order_number": order.number,
        "currency": str(order.currency_id),
        "currency_code": order.currency.code,
        "exchange_rate": str(order.exchange_rate),
        "payment_term": str(order.payment_term_id) if order.payment_term_id else None,
        "lines": lines_out,
    }


def prepare_from_inventory_issue(company, issue_id):
    """Inherit line details from an existing posted issue transaction (AF-04, BR-SAL-03-09)."""
    issue = InventoryTransaction.objects.filter(pk=issue_id, company=company).first()
    if not issue:
        raise ValidationError("Phiếu xuất kho nguồn không tồn tại.")
    if issue.transaction_type != "ISSUE":
        raise ValidationError("Giao dịch nguồn phải là phiếu xuất kho (ISSUE).")
    if issue.status not in ("POSTED", "APPROVED"):
        raise ValidationError("Phiếu xuất kho nguồn chưa được ghi nhận hợp lệ.")

    lines_out = []
    for line in issue.lines.select_related("item", "uom").all():
        if line.item.item_type != "GOODS":
            continue
        used = models.GoodsSaleLine.objects.filter(inventory_transaction_line=line).exclude(sale__status=models.DocumentStatus.CANCELLED).aggregate(t=Sum("quantity"))["t"] or Decimal("0")
        rem = line.quantity - used
        if rem > 0:
            lines_out.append({
                "inventory_transaction_line": str(line.id),
                "item": str(line.item_id),
                "item_code": line.item.code,
                "item_name": line.item.name,
                "description": line.item.name,
                "uom": str(line.uom_id),
                "uom_name": line.uom.name,
                "warehouse": str(issue.source_warehouse_id) if issue.source_warehouse_id else None,
                "quantity": str(rem),
                "unit_price": str(line.item.sales_price or Decimal("0")),
                "discount_rate": "0",
                "tax_rate": str(line.item.sales_tax_rate_id) if line.item.sales_tax_rate_id else None,
            })

    if not lines_out:
        raise ValidationError("Phiếu xuất kho không còn số lượng chưa ghi nhận bán hàng.")

    customer = issue.supplier
    return {
        "company": str(company.id),
        "customer": str(customer.id) if customer else None,
        "customer_name": customer.name if customer else "",
        "customer_address": getattr(customer, "legal_name", "") or customer.name if customer else "",
        "customer_tax_code": customer.tax_code if customer else "",
        "inventory_transaction": str(issue.id),
        "inventory_transaction_number": issue.number,
        "inventory_handling": models.GoodsSale.InventoryHandling.LINK_EXISTING,
        "lines": lines_out,
    }


@transaction.atomic
def create_goods_sale(request, validated_data, lines_data):
    """Create a new GoodsSale record and lines in DRAFT status."""
    company = validated_data["company"]
    customer = validated_data["customer"]
    payment_type = validated_data.get("payment_type", models.GoodsSale.PaymentType.UNPAID)
    inventory_handling = validated_data.get("inventory_handling", models.GoodsSale.InventoryHandling.ATTACH_ISSUE)

    if customer.company_id != company.id or customer.status != "ACTIVE":
        raise ValidationError("Khách hàng không hợp lệ hoặc đã ngừng hoạt động.")

    # Validation of conditional header fields
    if payment_type == models.GoodsSale.PaymentType.BANK and not validated_data.get("company_bank_account"):
        raise ValidationError({"company_bank_account": "Bắt buộc chọn tài khoản ngân hàng khi thanh toán qua ngân hàng."})

    if inventory_handling == models.GoodsSale.InventoryHandling.LINK_EXISTING and not validated_data.get("inventory_transaction"):
        raise ValidationError({"inventory_transaction": "Bắt buộc chọn phiếu xuất kho liên kết."})

    calc = calculate_and_validate_sale_lines(
        company=company,
        lines_data=lines_data,
        payment_type=payment_type,
        inventory_handling=inventory_handling,
        currency=validated_data.get("currency"),
    )

    doc_date = validated_data.get("document_date") or timezone.localdate()
    posting_date = validated_data.get("posting_date") or doc_date

    # Auto-generate document number if not provided
    number = validated_data.get("number")
    if not number:
        number = generate_goods_sale_number(company, branch=validated_data.get("branch"), document_date=doc_date)

    sale = models.GoodsSale.objects.create(
        company=company,
        branch=validated_data.get("branch"),
        number=number,
        document_date=doc_date,
        posting_date=posting_date,
        customer=customer,
        customer_address=validated_data.get("customer_address") or "",
        customer_tax_code=validated_data.get("customer_tax_code") or customer.tax_code or "",
        sales_order=validated_data.get("sales_order"),
        currency=validated_data.get("currency"),
        exchange_rate=validated_data.get("exchange_rate", Decimal("1")),
        payment_type=payment_type,
        payment_term=validated_data.get("payment_term"),
        due_date=validated_data.get("due_date"),
        company_bank_account=validated_data.get("company_bank_account"),
        inventory_handling=inventory_handling,
        inventory_transaction=validated_data.get("inventory_transaction"),
        delivery=validated_data.get("delivery"),
        tax_invoice=validated_data.get("tax_invoice"),
        subtotal=calc["subtotal"],
        discount_amount=calc["discount_amount"],
        tax_amount=calc["tax_amount"],
        total_amount=calc["total_amount"],
        status=models.DocumentStatus.DRAFT,
        description=validated_data.get("description", "Bán hàng hóa"),
        notes=validated_data.get("notes", ""),
        attachments=validated_data.get("attachments", []),
        created_by=actor_for(request),
        version=1,
    )

    for item_calc in calc["lines"]:
        models.GoodsSaleLine.objects.create(sale=sale, **item_calc)

    audit(request, sale, "CREATE", after={"number": sale.number, "total_amount": str(sale.total_amount)})
    return sale


@transaction.atomic
def update_goods_sale(request, sale, validated_data, lines_data=None):
    """Update GoodsSale header & lines with optimistic locking (BR-SAL-03-12, EF-08, EF-10)."""
    sale = models.GoodsSale.objects.select_for_update().get(pk=sale.pk)

    # EF-10: Sửa/hủy trực tiếp chứng từ Đã ghi sổ -> Chặn
    if sale.status == models.DocumentStatus.POSTED:
        raise ValidationError("Không thể sửa chứng từ Đã ghi sổ. Vui lòng bỏ ghi sổ hoặc thực hiện quy trình điều chỉnh.")
    if sale.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REVISION_REQUIRED, models.DocumentStatus.REJECTED}:
        raise ValidationError(f"Không thể sửa chứng từ ở trạng thái {sale.get_status_display()}.")

    # EF-08: Optimistic Locking
    client_version = request.data.get("version")
    if client_version is not None and int(client_version) != sale.version:
        raise ValidationError("Chứng từ vừa được người khác cập nhật. Vui lòng tải lại trang.")

    company = sale.company
    customer = validated_data.get("customer", sale.customer)
    payment_type = validated_data.get("payment_type", sale.payment_type)
    inventory_handling = validated_data.get("inventory_handling", sale.inventory_handling)

    if lines_data is not None:
        calc = calculate_and_validate_sale_lines(
            company=company,
            lines_data=lines_data,
            payment_type=payment_type,
            inventory_handling=inventory_handling,
            currency=validated_data.get("currency", sale.currency),
        )
        sale.lines.all().delete()
        for item_calc in calc["lines"]:
            models.GoodsSaleLine.objects.create(sale=sale, **item_calc)
        sale.subtotal = calc["subtotal"]
        sale.discount_amount = calc["discount_amount"]
        sale.tax_amount = calc["tax_amount"]
        sale.total_amount = calc["total_amount"]

    # Header updates
    sale.customer = customer
    sale.customer_address = validated_data.get("customer_address", sale.customer_address)
    sale.customer_tax_code = validated_data.get("customer_tax_code", sale.customer_tax_code)
    sale.document_date = validated_data.get("document_date", sale.document_date)
    sale.posting_date = validated_data.get("posting_date", sale.posting_date)
    sale.payment_type = payment_type
    sale.inventory_handling = inventory_handling
    sale.sales_order = validated_data.get("sales_order", sale.sales_order)
    sale.payment_term = validated_data.get("payment_term", sale.payment_term)
    sale.due_date = validated_data.get("due_date", sale.due_date)
    sale.company_bank_account = validated_data.get("company_bank_account", sale.company_bank_account)
    sale.inventory_transaction = validated_data.get("inventory_transaction", sale.inventory_transaction)
    sale.delivery = validated_data.get("delivery", sale.delivery)
    sale.tax_invoice = validated_data.get("tax_invoice", sale.tax_invoice)
    sale.description = validated_data.get("description", sale.description)
    sale.notes = validated_data.get("notes", sale.notes)
    sale.attachments = validated_data.get("attachments", sale.attachments)
    sale.version += 1
    sale.save()

    audit(request, sale, "EDIT", after={"version": sale.version, "total_amount": str(sale.total_amount)})
    return sale


@transaction.atomic
def submit_goods_sale(request, sale, comment=""):
    """Submit goods sale document for workflow approval (Luồng chính Bước 8, BR-SAL-03-05)."""
    sale = models.GoodsSale.objects.select_for_update().get(pk=sale.pk)
    if sale.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REVISION_REQUIRED, models.DocumentStatus.REJECTED}:
        raise ValidationError(f"Không thể gửi duyệt chứng từ ở trạng thái {sale.get_status_display()}.")

    if not sale.lines.exists():
        raise ValidationError("Chứng từ bán hàng phải có ít nhất một dòng hàng.")

    configured = configured_snapshot(sale, "SAL.GOODS_SALE")
    requires_approval = True
    if configured is not None:
        sale.workflow_snapshot = configured
        requires_approval = configured.get("approval_required", True)
    else:
        # Default workflow behavior
        sale.approval_required = True

    before = sale.status
    if requires_approval:
        sale.status = models.DocumentStatus.PENDING_APPROVAL
        sale.submitted_at = timezone.now()
        models.ApprovalDecision.objects.create(
            company=sale.company,
            document_type="GOODS_SALE",
            document_id=sale.pk,
            decision="SUBMITTED",
            actor=actor_for(request),
            comment=comment,
        )
    else:
        sale.status = models.DocumentStatus.APPROVED
        sale.approved_at = timezone.now()
        models.ApprovalDecision.objects.create(
            company=sale.company,
            document_type="GOODS_SALE",
            document_id=sale.pk,
            decision="APPROVED",
            actor=actor_for(request),
            comment="Tự động phê duyệt (Doanh nghiệp không yêu cầu quy trình duyệt)",
        )

    sale.version += 1
    sale.save()
    audit(request, sale, "SUBMIT", {"status": before}, {"status": sale.status}, reason=comment)
    return sale


@transaction.atomic
def withdraw_goods_sale(request, sale, reason=""):
    """Withdraw a submitted goods sale document back to DRAFT (AF-06)."""
    sale = models.GoodsSale.objects.select_for_update().get(pk=sale.pk)
    if sale.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chỉ chứng từ Chờ duyệt mới có thể thu hồi.")

    before = sale.status
    sale.status = models.DocumentStatus.DRAFT
    sale.withdrawal_reason = reason
    sale.version += 1
    sale.save(update_fields=["status", "withdrawal_reason", "version", "updated_at"])

    models.ApprovalDecision.objects.create(
        company=sale.company,
        document_type="GOODS_SALE",
        document_id=sale.pk,
        decision="WITHDRAWN",
        actor=actor_for(request),
        comment=reason,
    )
    audit(request, sale, "WITHDRAW", {"status": before}, {"status": sale.status}, reason=reason)
    return sale


@transaction.atomic
def decide_goods_sale(request, sale, decision, comment=""):
    """Handle approval decisions: APPROVED, REVISION_REQUIRED, REJECTED (AF-07)."""
    sale = models.GoodsSale.objects.select_for_update().get(pk=sale.pk)
    if sale.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ không ở trạng thái Chờ duyệt.")

    if decision in {"REJECTED", "REVISION_REQUIRED"} and not comment.strip():
        raise ValidationError({"reason": "Vui lòng nhập lý do/ý kiến khi từ chối hoặc yêu cầu sửa đổi."})

    decisions = models.ApprovalDecision.objects.filter(document_type="GOODS_SALE", document_id=sale.pk)
    current_level = decisions.filter(decision="APPROVED").count() + 1

    next_status = decision
    if sale.workflow_snapshot.get("version_id"):
        progress = approval_progress(sale, actor_for(request), decision == "APPROVED", decisions)
        if progress:
            current_level = progress["level"]
            if decision == "APPROVED" and not progress["final"]:
                next_status = models.DocumentStatus.PENDING_APPROVAL

    before = sale.status
    sale.status = next_status
    if next_status == models.DocumentStatus.APPROVED:
        sale.approved_at = timezone.now()
    elif next_status == models.DocumentStatus.REJECTED:
        sale.rejection_reason = comment

    sale.version += 1
    sale.save()

    models.ApprovalDecision.objects.create(
        company=sale.company,
        document_type="GOODS_SALE",
        document_id=sale.pk,
        level=current_level,
        decision="APPROVED" if next_status in {models.DocumentStatus.APPROVED, models.DocumentStatus.PENDING_APPROVAL} else decision,
        actor=actor_for(request),
        comment=comment,
    )
    audit(request, sale, decision, {"status": before}, {"status": sale.status}, reason=comment)
    return sale


@transaction.atomic
def cancel_goods_sale(request, sale, reason=""):
    """Cancel a goods sale document (AF-08)."""
    sale = models.GoodsSale.objects.select_for_update().get(pk=sale.pk)
    if sale.status == models.DocumentStatus.POSTED:
        raise ValidationError("Không thể hủy trực tiếp chứng từ Đã ghi sổ. Vui lòng bỏ ghi sổ trước.")
    if sale.status == models.DocumentStatus.CANCELLED:
        raise ValidationError("Chứng từ đã bị hủy trước đó.")

    before = sale.status
    sale.status = models.DocumentStatus.CANCELLED
    sale.cancellation_reason = reason
    sale.version += 1
    sale.save(update_fields=["status", "cancellation_reason", "version", "updated_at"])
    audit(request, sale, "CANCEL", {"status": before}, {"status": sale.status}, reason=reason)
    return sale


def _validate_posting_preconditions(sale):
    """Validate accounting period, postable accounts, and available stock (EF-03, EF-04, EF-05, BR-SAL-03-06)."""
    # 1. Accounting Period Check (EF-03, BR-SAL-03-06)
    period = AccountingPeriod.objects.filter(
        company=sale.company,
        start_date__lte=sale.posting_date,
        end_date__gte=sale.posting_date,
        status="OPEN"
    ).first()
    if not period:
        raise ValidationError("Kỳ kế toán đã bị khóa hoặc chưa mở cho ngày hạch toán.")

    # 2. Account Validity Check (EF-04, BR-SAL-03-06)
    lines = list(sale.lines.select_related(
        "item", "warehouse", "receivable_or_payment_account",
        "revenue_account", "tax_account", "cogs_account", "inventory_account"
    ).all())

    for line in lines:
        for acc_field, acc in (
            ("receivable_or_payment_account", line.receivable_or_payment_account),
            ("revenue_account", line.revenue_account),
            ("tax_account", line.tax_account),
            ("cogs_account", line.cogs_account),
            ("inventory_account", line.inventory_account),
        ):
            if acc:
                if acc.company_id != sale.company_id or not acc.is_postable or acc.status != "ACTIVE":
                    raise ValidationError(f"Tài khoản {acc.code} trên dòng {line.line_no} không hợp lệ hoặc đã ngừng sử dụng.")

    # 3. Source Remaining Balance Check (BR-SAL-03-03, EF-06)
    for line in lines:
        if line.order_line:
            used = models.GoodsSaleLine.objects.filter(order_line=line.order_line).exclude(sale__status=models.DocumentStatus.CANCELLED).exclude(sale=sale).aggregate(t=Sum("quantity"))["t"] or Decimal("0")
            remaining = line.order_line.quantity - used
            if line.quantity > remaining:
                raise ValidationError(f"Số lượng bán ({line.quantity}) vượt phần còn lại của đơn hàng ({remaining}).")

        if line.inventory_transaction_line:
            used = models.GoodsSaleLine.objects.filter(inventory_transaction_line=line.inventory_transaction_line).exclude(sale__status=models.DocumentStatus.CANCELLED).exclude(sale=sale).aggregate(t=Sum("quantity"))["t"] or Decimal("0")
            remaining = line.inventory_transaction_line.quantity - used
            if line.quantity > remaining:
                raise ValidationError(f"Số lượng bán ({line.quantity}) vượt phần còn lại của phiếu xuất kho ({remaining}).")

    # 4. Stock Availability Check for ATTACH_ISSUE (EF-05)
    if sale.inventory_handling == models.GoodsSale.InventoryHandling.ATTACH_ISSUE:
        setting = CoreCompanySetting.objects.filter(company=sale.company).first()
        allow_neg = True
        if setting and "allow_negative_inventory" in setting.configuration:
            allow_neg = bool(setting.configuration["allow_negative_inventory"])

        for line in lines:
            if not line.warehouse:
                raise ValidationError(f"Dòng {line.line_no}: Chưa chọn kho xuất hàng.")
            wh = line.warehouse
            policy = InventoryPolicy.objects.filter(company=sale.company, warehouse=wh, item=line.item, is_active=True).first()
            wh_allow_neg = bool((policy and policy.allow_negative) or wh.allow_negative) and allow_neg

            bal = StockBalance.objects.filter(company=sale.company, warehouse=wh, item=line.item).first()
            avail = bal.available_quantity if bal else Decimal("0")
            if avail < line.quantity and not wh_allow_neg:
                raise ValidationError(f"Tồn khả dụng của hàng {line.item.code} tại kho {wh.code} không đủ (hiện có: {avail}, cần xuất: {line.quantity}).")

    return period, lines


@transaction.atomic
def post_goods_sale(request, sale):
    """Post GoodsSale: creates GL entries, updates stock, registers receivable (Luồng chính Bước 9-10)."""
    sale = models.GoodsSale.objects.select_for_update().get(pk=sale.pk)
    if sale.status == models.DocumentStatus.POSTED:
        raise ValidationError("Chứng từ đã được ghi sổ trước đó.")

    # Check approval state: must be APPROVED, or allow direct posting from DRAFT if workflow not configured
    if sale.status != models.DocumentStatus.APPROVED:
        if sale.status == models.DocumentStatus.DRAFT and not sale.approval_required:
            pass  # Direct posting allowed
        else:
            raise ValidationError(f"Chỉ chứng từ Đã duyệt mới có thể ghi sổ (trạng thái hiện tại: {sale.get_status_display()}).")

    period, lines = _validate_posting_preconditions(sale)

    # 1. Handle Inventory Issue if ATTACH_ISSUE
    if sale.inventory_handling == models.GoodsSale.InventoryHandling.ATTACH_ISSUE and not sale.inventory_transaction_id:
        primary_wh = lines[0].warehouse
        issue_trx = InventoryTransaction.objects.create(
            company=sale.company,
            branch=sale.branch,
            supplier=sale.customer,
            number=f"{sale.number}-XK",
            transaction_type="ISSUE",
            transaction_date=sale.posting_date,
            source_warehouse=primary_wh,
            source_module="SAL",
            source_reference=sale.number,
            status="APPROVED",
            created_by=actor_for(request),
        )
        for line in lines:
            InventoryTransactionLine.objects.create(
                transaction=issue_trx,
                line_no=line.line_no,
                item=line.item,
                uom=line.uom,
                quantity=line.quantity,
                base_quantity=line.quantity,
                unit_cost=line.unit_cost,
                line_value=line.cogs_amount,
                movement_direction="OUT",
            )
        post_inventory(issue_trx, request)
        sale.inventory_transaction = issue_trx
        sale.inventory_created = True

    # 2. Create and Post JournalEntry (BR-SAL-03-07, BR-SAL-03-08)
    total_cogs = sum(line.cogs_amount for line in lines) if sale.inventory_handling == models.GoodsSale.InventoryHandling.ATTACH_ISSUE else Decimal("0")
    total_debit = sale.total_amount + total_cogs
    total_credit = sale.total_amount + total_cogs

    journal = JournalEntry.objects.create(
        company=sale.company,
        branch=sale.branch,
        period=period,
        number=f"{sale.number}-GL",
        entry_type="SUBLEDGER",
        posting_date=sale.posting_date,
        document_date=sale.document_date,
        description=sale.description or f"Doanh thu bán hàng {sale.number}",
        source_module="SAL",
        source_event_id=f"SAL.GOODS:{sale.pk}:{sale.version}",
        source_entity_type="GoodsSale",
        source_entity_id=sale.pk,
        status="APPROVED",
        total_debit=total_debit,
        total_credit=total_credit,
        workflow_snapshot={"allow_creator_posting": True},
        created_by=actor_for(request),
        approved_by=actor_for(request),
        approved_at=timezone.now(),
    )

    gl_line_no = 0
    # Debit 1: Receivable or Cash or Bank
    gl_line_no += 1
    first_payment_acc = lines[0].receivable_or_payment_account
    dims = {}
    if sale.payment_type == models.GoodsSale.PaymentType.BANK and sale.company_bank_account_id:
        dims["bank_account"] = str(sale.company_bank_account_id)
        dims["bank_account_id"] = str(sale.company_bank_account_id)

    JournalLine.objects.create(
        entry=journal,
        line_no=gl_line_no,
        account=first_payment_acc,
        description=f"Thanh toán/Phải thu khách hàng - {sale.number}",
        debit=sale.total_amount,
        credit=Decimal("0"),
        currency=sale.currency,
        party=sale.customer,
        dimensions=dims,
    )

    # Credits: Revenue and Tax
    for line in lines:
        line_net = (line.quantity * line.unit_price) - line.discount_amount
        if line_net > 0:
            gl_line_no += 1
            JournalLine.objects.create(
                entry=journal,
                line_no=gl_line_no,
                account=line.revenue_account,
                description=f"Doanh thu {line.item.code} - {sale.number}",
                debit=Decimal("0"),
                credit=line_net,
                currency=sale.currency,
                party=sale.customer,
                warehouse=line.warehouse,
            )

        if line.tax_amount > 0 and line.tax_account:
            gl_line_no += 1
            JournalLine.objects.create(
                entry=journal,
                line_no=gl_line_no,
                account=line.tax_account,
                description=f"Thuế GTGT đầu ra {line.item.code} - {sale.number}",
                debit=Decimal("0"),
                credit=line.tax_amount,
                currency=sale.currency,
                party=sale.customer,
            )

    # Debit & Credit COGS / Inventory when ATTACH_ISSUE
    if sale.inventory_handling == models.GoodsSale.InventoryHandling.ATTACH_ISSUE:
        for line in lines:
            if line.cogs_amount > 0 and line.cogs_account and line.inventory_account:
                gl_line_no += 1
                JournalLine.objects.create(
                    entry=journal,
                    line_no=gl_line_no,
                    account=line.cogs_account,
                    description=f"Giá vốn hàng bán {line.item.code} - {sale.number}",
                    debit=line.cogs_amount,
                    credit=Decimal("0"),
                    currency=sale.currency,
                    party=sale.customer,
                    warehouse=line.warehouse,
                )
                gl_line_no += 1
                JournalLine.objects.create(
                    entry=journal,
                    line_no=gl_line_no,
                    account=line.inventory_account,
                    description=f"Xuất kho hàng hóa {line.item.code} - {sale.number}",
                    debit=Decimal("0"),
                    credit=line.cogs_amount,
                    currency=sale.currency,
                    warehouse=line.warehouse,
                )

    post_journal(journal, request)
    sale.journal_entry = journal

    # 3. Create Accounts Receivable record if UNPAID
    if sale.payment_type == models.GoodsSale.PaymentType.UNPAID:
        receivable = Receivable.objects.create(
            company=sale.company,
            branch=sale.branch,
            customer=sale.customer,
            currency=sale.currency,
            exchange_rate=sale.exchange_rate,
            account=first_payment_acc,
            original_amount=sale.total_amount,
            balance=sale.total_amount,
            due_date=sale.due_date,
            payment_term=sale.payment_term,
            document_date=sale.document_date,
            posting_date=sale.posting_date,
            journal_entry=journal,
            sales_order=sale.sales_order,
            description=sale.description or f"Phải thu bán hàng {sale.number}",
            source_document_type="GOODS_SALE",
            source_document_id=str(sale.id),
            source_document_number=sale.number,
            status=ReceivableStatus.OPEN,
            created_by=actor_for(request),
        )
        sale.receivable = receivable

    sale.status = models.DocumentStatus.POSTED
    sale.posted_at = timezone.now()
    sale.posted_by = actor_for(request)
    sale.version += 1
    sale.save()

    audit(request, sale, "POST", after={"status": sale.status, "journal_id": str(journal.id)})
    return sale


@transaction.atomic
def unpost_goods_sale(request, sale, reason=""):
    """Unpost GoodsSale: reverses journal entries, receivable, and inventory movements."""
    sale = models.GoodsSale.objects.select_for_update().get(pk=sale.pk)
    if sale.inventory_handling == models.GoodsSale.InventoryHandling.SEPARATE_ISSUE:
        from inventory.models import InventoryTransactionLine
        if InventoryTransactionLine.objects.filter(sale_line__sale=sale, transaction__status="POSTED").exists():
            raise ValidationError("Chứng từ đã có phiếu xuất kho riêng được ghi sổ; hãy xử lý phiếu xuất trước khi bỏ ghi sổ.")
    if sale.status != models.DocumentStatus.POSTED:
        raise ValidationError("Chỉ chứng từ Đã ghi sổ mới có thể thực hiện bỏ ghi sổ.")

    # Check open period
    period = AccountingPeriod.objects.filter(
        company=sale.company,
        start_date__lte=sale.posting_date,
        end_date__gte=sale.posting_date,
        status="OPEN"
    ).first()
    if not period:
        raise ValidationError("Kỳ kế toán đã bị khóa, không thể bỏ ghi sổ.")

    # Check receivable payments
    if sale.receivable:
        if sale.receivable.collected_amount > 0 or sale.receivable.netted_amount > 0:
            raise ValidationError("Khoản phải thu đã phát sinh thu tiền hoặc cấn trừ, không thể bỏ ghi sổ.")
        rec = sale.receivable
        sale.receivable = None
        sale.save(update_fields=["receivable"])
        rec.delete()

    # Reverse inventory transaction if created with sale
    if sale.inventory_created and sale.inventory_transaction:
        reverse_inventory(sale.inventory_transaction, request)

    # Revert GL balances and delete journal entry
    if sale.journal_entry:
        entry = sale.journal_entry
        for line in entry.lines.all():
            bal = AccountBalance.objects.filter(period=entry.period, account=line.account, branch=entry.branch).first()
            if bal:
                bal.period_debit = max(bal.period_debit - line.debit, Decimal("0"))
                bal.period_credit = max(bal.period_credit - line.credit, Decimal("0"))
                _recalculate_closing(bal)
                bal.save(update_fields=["period_debit", "period_credit", "closing_debit", "closing_credit", "updated_at"])
        sale.journal_entry = None
        sale.save(update_fields=["journal_entry"])
        entry.delete()

    before = sale.status
    sale.status = models.DocumentStatus.APPROVED
    sale.posted_at = None
    sale.posted_by = None
    sale.version += 1
    sale.save()

    audit(request, sale, "UNPOST", {"status": before}, {"status": sale.status}, reason=reason)
    return sale


@transaction.atomic
def link_tax_invoice(request, sale, invoice_id, notes=""):
    """Link an output tax invoice to the goods sale document (AF-09, BR-SAL-03-11, EF-07)."""
    sale = models.GoodsSale.objects.select_for_update().get(pk=sale.pk)
    from tax_management.models import TaxInvoice

    invoice = TaxInvoice.objects.filter(pk=invoice_id, company=sale.company).first()
    if not invoice:
        raise ValidationError("Hóa đơn không tồn tại.")
    if invoice.direction != "OUTPUT":
        raise ValidationError("Chỉ được liên kết hóa đơn đầu ra (OUTPUT).")
    if invoice.party_id != sale.customer_id:
        raise ValidationError("Hóa đơn không cùng khách hàng với chứng từ bán hàng.")
    if invoice.currency_id != sale.currency_id:
        raise ValidationError("Loại tiền trên hóa đơn không khớp với chứng từ.")

    # EF-07: Hóa đơn không khớp chứng từ
    diff = abs(invoice.total_amount - sale.total_amount)
    if diff > Decimal("1.0"):
        raise ValidationError(f"Tổng tiền hóa đơn ({invoice.total_amount}) không khớp với tổng thanh toán chứng từ ({sale.total_amount}). Chênh lệch: {diff}.")

    sale.tax_invoice = invoice
    sale.invoice_link_notes = notes
    sale.version += 1
    sale.save(update_fields=["tax_invoice", "invoice_link_notes", "version", "updated_at"])

    audit(request, sale, "LINK_INVOICE", after={"tax_invoice_id": str(invoice.id), "notes": notes})
    return sale
