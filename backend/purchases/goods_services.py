from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from common_services.period_services import determine_period_for_date
from common_services.models import DocumentNumberingRule
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine
from general_ledger.services import post as post_journal
from general_ledger.services import _balance, _recalculate_closing
from inventory.models import InventoryTransaction, InventoryTransactionLine
from inventory.services import post as post_inventory
from inventory.services import reverse as reverse_inventory
from accounts_payable.models import Payable, Payment
from .models import ApprovalDecision, GoodsPurchase, GoodsPurchaseLine, PurchaseOrder, PurchaseOrderLine
from .services import audit

MONEY = Decimal("0.0001")


def number_for(company, document_date, branch=None, purchase_type="WAREHOUSE"):
    from common_services.numbering_services import generate_document_number
    from master_data.models import DocumentType

    codes = ("PUR.SERVICE_PURCHASE",) if purchase_type == "SERVICE" else ("PUR.GOODS_PURCHASE", "PUR.GOODS")
    document_type = DocumentType.objects.filter(code__in=codes, status="ACTIVE").order_by("-code").first()
    if document_type and DocumentNumberingRule.objects.filter(company=company, document_type=document_type, status="ACTIVE").exists():
        configured = generate_document_number(company, document_type, branch=branch, document_date=document_date)
        if configured:
            if GoodsPurchase.objects.filter(company=company, number=configured).exists():
                raise ValidationError("Số chứng từ đã tồn tại.")
            return configured
    prefix = f"{'SP' if purchase_type == 'SERVICE' else 'GP'}{document_date:%Y%m%d}"
    last = GoodsPurchase.objects.filter(company=company, number__startswith=prefix).order_by("-number").values_list("number", flat=True).first()
    sequence = int(last[len(prefix):]) + 1 if last and last[len(prefix):].isdigit() else 1
    return f"{prefix}{sequence:04d}"


def save_lines(purchase, lines):
    subtotal = discount = tax = Decimal("0")
    for line in lines:
        gross = (line["quantity"] * line["unit_price"]).quantize(MONEY, ROUND_HALF_UP)
        line_discount = (gross * line.get("discount_rate", Decimal("0")) / 100).quantize(MONEY, ROUND_HALF_UP)
        net = gross - line_discount
        rate = line.get("tax_rate")
        line_tax = (net * rate.rate_percent / 100).quantize(MONEY, ROUND_HALF_UP) if rate else Decimal("0")
        GoodsPurchaseLine.objects.create(purchase=purchase, **line, discount_amount=line_discount,
                                         pre_tax_amount=net, tax_amount=line_tax, total_amount=net + line_tax)
        subtotal += gross
        discount += line_discount
        tax += line_tax
    purchase.subtotal, purchase.discount_amount, purchase.tax_amount = subtotal, discount, tax
    purchase.total_amount = subtotal - discount + tax
    purchase.invoice_status = ("INVOICED" if purchase.supplier_invoice.total_amount == purchase.total_amount else "PARTIALLY_INVOICED") if purchase.supplier_invoice_id else "NOT_INVOICED"
    purchase.save(update_fields=("subtotal", "discount_amount", "tax_amount", "total_amount", "invoice_status", "updated_at"))


def validate_ready(purchase, *, check_payment=True):
    if not purchase.lines.exists():
        raise ValidationError("Chứng từ mua hàng phải có ít nhất một dòng hàng.")
    if purchase.branch.status != "ACTIVE" or purchase.supplier.status != "ACTIVE":
        raise ValidationError("Dữ liệu được chọn đã ngừng sử dụng.")
    if purchase.purchase_type == "WAREHOUSE" and not purchase.receiving_warehouse_id:
        raise ValidationError("Kho nhận là bắt buộc.")
    if purchase.purchase_type == "SERVICE" and (purchase.receiving_warehouse_id or purchase.inventory_transaction_id):
        raise ValidationError("Mua dịch vụ không được liên kết kho hoặc phiếu nhập kho.")
    if purchase.payment_type == "IMMEDIATE" and check_payment:
        payment = purchase.payment
        if not payment or payment.status != "CONFIRMED" or payment.company_id != purchase.company_id or payment.supplier_id != purchase.supplier_id or payment.amount - payment.allocated_amount < purchase.total_amount:
            raise ValidationError("Chứng từ thanh toán không đủ số tiền chưa phân bổ.")
    if purchase.supplier_invoice_id and (purchase.supplier_invoice.company_id != purchase.company_id or
            purchase.supplier_invoice.supplier_id != purchase.supplier_id or
            purchase.supplier_invoice.total_amount > purchase.total_amount):
        raise ValidationError("Hóa đơn đầu vào không khớp hoặc vượt giá trị chứng từ mua hàng.")
    try:
        period = determine_period_for_date(purchase.company, purchase.posting_date)["period"]
    except ValidationError:
        raise
    if period.status != "OPEN":
        raise ValidationError("Kỳ kế toán đã bị khóa hoặc chưa mở.")
    for line in purchase.lines.select_related("item", "uom", "warehouse", "debit_account", "credit_account", "tax_rate", "department", "expense_item"):
        if any(getattr(obj, "status", "ACTIVE") != "ACTIVE" for obj in (line.item, line.uom, line.warehouse, line.debit_account, line.credit_account, line.tax_rate, line.department, line.expense_item) if obj):
            raise ValidationError("Dữ liệu được chọn đã ngừng sử dụng.")
        if not line.debit_account.is_postable or not line.credit_account.is_postable:
            raise ValidationError("Tài khoản hạch toán không hợp lệ.")
        if purchase.purchase_type in {"DIRECT", "SERVICE"} and line.debit_account.account_type not in {"EXPENSE", "ASSET", "OTHER_EXPENSE"}:
            raise ValidationError("Tài khoản Nợ không hợp lệ cho mua không qua kho.")
        if purchase.purchase_type == "SERVICE":
            if line.item.item_type != "SERVICE" or line.warehouse_id:
                raise ValidationError("Chứng từ mua dịch vụ chứa dòng không hợp lệ.")
            if line.service_from and line.service_to and line.service_to < line.service_from:
                raise ValidationError("Ngày kết thúc dịch vụ không được trước ngày bắt đầu.")
            if line.item.requires_service_acceptance and not line.acceptance_date:
                raise ValidationError("Dịch vụ yêu cầu ngày nghiệm thu.")
            if line.debit_account.dimension_requirements.get("DEPARTMENT") == "REQUIRED" and not line.department_id:
                raise ValidationError("Tài khoản Nợ yêu cầu phòng ban.")
            if line.debit_account.dimension_requirements.get("EXPENSE_ITEM") == "REQUIRED" and not line.expense_item_id:
                raise ValidationError("Tài khoản Nợ yêu cầu khoản mục chi phí.")
        if purchase.purchase_type == "WAREHOUSE" and (not line.item.track_inventory or not (line.warehouse_id or purchase.receiving_warehouse_id)):
            raise ValidationError("Hàng mua qua kho phải theo dõi tồn kho và có kho nhận.")
    if purchase.inventory_transaction_id:
        receipt = purchase.inventory_transaction
        if (receipt.status != "POSTED" or receipt.transaction_type != "RECEIPT" or receipt.company_id != purchase.company_id or
                receipt.branch_id != purchase.branch_id or receipt.supplier_id != purchase.supplier_id or
                receipt.destination_warehouse_id != purchase.receiving_warehouse_id):
            raise ValidationError("Phiếu nhập kho không khớp chứng từ mua hàng.")
        expected = {}
        for line in purchase.lines.all():
            expected[line.item_id] = expected.get(line.item_id, Decimal("0")) + line.quantity
        actual = {}
        for line in receipt.lines.all():
            actual[line.item_id] = actual.get(line.item_id, Decimal("0")) + line.base_quantity
        if actual != expected:
            raise ValidationError("Phiếu nhập kho không khớp hàng hóa hoặc số lượng.")
    return period


def lock_order_lines(purchase):
    if not purchase.purchase_order_id:
        return []
    order = PurchaseOrder.objects.select_for_update().get(pk=purchase.purchase_order_id)
    if order.status not in {"APPROVED", "SENT", "IN_PROGRESS", "PARTIALLY_RECEIVED"}:
        raise ValidationError("Trạng thái đơn mua không cho phép ghi nhận.")
    locked = {line.pk: line for line in PurchaseOrderLine.objects.select_for_update().filter(order=order)}
    quantities = {}
    values = {}
    for line in purchase.lines.all():
        if line.order_line_id not in locked:
            raise ValidationError("Dòng đơn mua không khớp.")
        quantities[line.order_line_id] = quantities.get(line.order_line_id, Decimal("0")) + line.quantity
        values[line.order_line_id] = values.get(line.order_line_id, Decimal("0")) + line.pre_tax_amount
    for pk, quantity in quantities.items():
        if quantity > locked[pk].remaining_quantity:
            raise ValidationError("Số lượng mua vượt quá số lượng còn lại của đơn mua hàng.")
        if purchase.purchase_type == "SERVICE":
            remaining_value = (locked[pk].remaining_quantity * locked[pk].unit_price *
                               (Decimal("1") - locked[pk].discount_rate / 100)).quantize(MONEY, ROUND_HALF_UP)
            if values[pk] > remaining_value:
                raise ValidationError("Giá trị dịch vụ vượt quá phần còn lại của đơn mua hàng.")
    return [(locked[pk], quantity) for pk, quantity in quantities.items()]



def input_vat_split(company, line):
    """(goods value, deductible VAT, VAT account) of a purchase line: deductible VAT goes to 133x, not into cost."""
    tax = line.tax_amount or Decimal("0")
    if tax <= 0 or (line.tax_rate_id and not line.tax_rate.deductible):
        return line.total_amount, Decimal("0"), None
    account = (Account.objects.filter(company=company, code="1331", status="ACTIVE", is_postable=True).first()
               or Account.objects.filter(company=company, code__startswith="133", status="ACTIVE", is_postable=True).order_by("code").first())
    if account is None:
        raise ValidationError("Chưa có tài khoản thuế GTGT được khấu trừ (1331) để hạch toán thuế đầu vào.")
    return line.total_amount - tax, tax, account

@transaction.atomic
def submit(purchase, request):
    purchase = GoodsPurchase.objects.select_for_update().get(pk=purchase.pk)
    if purchase.status not in {"DRAFT", "REVISION_REQUIRED"}:
        raise ValidationError("Trạng thái không cho phép gửi phê duyệt.")
    validate_ready(purchase)
    lock_order_lines(purchase)
    service = purchase.purchase_type == "SERVICE"
    snapshot = configured_snapshot(purchase, "PUR.SERVICE_PURCHASE" if service else "PUR.GOODS_PURCHASE")
    purchase.workflow_snapshot = snapshot or {"approval_required": False}
    purchase.approval_required = bool(purchase.workflow_snapshot.get("approval_required"))
    old = purchase.status
    purchase.status = "PENDING_APPROVAL" if purchase.approval_required else "APPROVED"
    purchase.version += 1
    purchase.submitted_at = timezone.now()
    purchase.approved_at = timezone.now() if purchase.status == "APPROVED" else None
    purchase.save(update_fields=("status", "version", "workflow_snapshot", "approval_required", "submitted_at", "approved_at", "updated_at"))
    ApprovalDecision.objects.create(company=purchase.company, document_type="SERVICE" if service else "GOODS", document_id=purchase.pk,
        workflow_version=str(purchase.workflow_snapshot.get("version", "")), decision="SUBMITTED",
        actor=request.user.iam_account)
    audit(request, purchase, "SUBMIT", {"status": old}, {"status": purchase.status, "number": purchase.number})
    return purchase


@transaction.atomic
def decide(purchase, request, decision):
    purchase = GoodsPurchase.objects.select_for_update().get(pk=purchase.pk)
    if purchase.status != "PENDING_APPROVAL":
        raise ValidationError("Chứng từ không chờ phê duyệt.")
    if decision in {"REJECTED", "REVISION_REQUIRED"} and not request.data.get("reason", "").strip():
        raise ValidationError({"reason": "Lý do là bắt buộc."})
    if decision == "APPROVED":
        validate_ready(purchase)
        lock_order_lines(purchase)
    decision_type = "SERVICE" if purchase.purchase_type == "SERVICE" else "GOODS"
    decisions = ApprovalDecision.objects.filter(document_type=decision_type, document_id=purchase.pk)
    current_level = decisions.filter(decision="APPROVED").count() + 1
    if purchase.workflow_snapshot.get("version_id"):
        progress = approval_progress(purchase, request.user.iam_account, decision == "APPROVED", decisions)
        current_level = progress["level"]
        if decision == "APPROVED" and not progress["final"]:
            decision = "PENDING_APPROVAL"
    purchase.status = decision
    purchase.version += 1
    purchase.approved_at = timezone.now() if decision == "APPROVED" else None
    purchase.save(update_fields=("status", "version", "approved_at", "updated_at"))
    ApprovalDecision.objects.create(company=purchase.company, document_type=decision_type, document_id=purchase.pk,
        workflow_version=str(purchase.workflow_snapshot.get("version", "")), level=current_level,
        decision="APPROVED" if decision in {"APPROVED", "PENDING_APPROVAL"} else "REVISION_REQUIRED" if decision == "REVISION_REQUIRED" else "REJECTED",
        actor=request.user.iam_account, comment=request.data.get("reason", ""))
    audit(request, purchase, decision, {"status": "PENDING_APPROVAL"}, {"status": decision}, request.data.get("reason", ""))
    return purchase


@transaction.atomic
def post(purchase, request):
    purchase = GoodsPurchase.objects.select_for_update().get(pk=purchase.pk)
    if purchase.status != "APPROVED":
        raise ValidationError("Chỉ chứng từ APPROVED mới được ghi sổ.")
    validate_ready(purchase)
    order_lines = lock_order_lines(purchase)
    gl_period = AccountingPeriod.objects.filter(company=purchase.company, start_date__lte=purchase.posting_date,
                                                 end_date__gte=purchase.posting_date, status="OPEN").first()
    if not gl_period:
        raise ValidationError("Không có kỳ sổ cái đang mở cho ngày hạch toán.")
    lines = list(purchase.lines.select_related("item", "uom", "warehouse", "debit_account", "credit_account"))
    if purchase.purchase_type == "WAREHOUSE" and not purchase.inventory_transaction_id:
        warehouses = {line.warehouse_id or purchase.receiving_warehouse_id for line in lines}
        if len(warehouses) != 1:
            raise ValidationError("Một chứng từ nhập kho chỉ hỗ trợ một kho nhận.")
        warehouse_id = next(iter(warehouses))
        stock = InventoryTransaction.objects.create(company=purchase.company, branch=purchase.branch, supplier=purchase.supplier,
            number=f"{purchase.number}-INV-{purchase.version}",
            transaction_type="RECEIPT", transaction_date=purchase.posting_date, destination_warehouse_id=warehouse_id,
            source_module="PUR", source_reference=purchase.number, status="APPROVED", created_by=request.user.iam_account)
        for line in lines:
            stock_quantity = line.quantity
            InventoryTransactionLine.objects.create(transaction=stock, line_no=line.line_no, item=line.item, uom=line.uom,
                quantity=stock_quantity, base_quantity=stock_quantity, unit_cost=(line.pre_tax_amount / line.quantity).quantize(Decimal("0.0000000001")),
                line_value=line.pre_tax_amount)
        post_inventory(stock, request)
        purchase.inventory_transaction = stock
        purchase.inventory_created = True
    journal = JournalEntry.objects.create(company=purchase.company, branch=purchase.branch, period=gl_period,
        number=f"{purchase.number}-GL-{purchase.version}", entry_type="SUBLEDGER", posting_date=purchase.posting_date,
        document_date=purchase.document_date, description=purchase.notes or "Mua hàng hóa", source_module="PUR",
        source_event_id=f"PUR.GOODS:{purchase.pk}:{purchase.version}", source_entity_type="GoodsPurchase", source_entity_id=purchase.pk,
        status="APPROVED", total_debit=purchase.total_amount, total_credit=purchase.total_amount,
        workflow_snapshot={"allow_creator_posting": True}, created_by=request.user.iam_account,
        approved_by=request.user.iam_account, approved_at=timezone.now())
    n = 0
    for line in lines:
        if line.total_amount == 0:
            continue
        currency = purchase.company.accounting_currency
        goods_value, vat, vat_account = input_vat_split(purchase.company, line)
        n += 1
        JournalLine.objects.create(entry=journal, line_no=n, account=line.debit_account, debit=goods_value,
            currency=currency, party=purchase.supplier, warehouse=line.warehouse or purchase.receiving_warehouse,
            department=line.department,
            dimensions={"expense_item_id": str(line.expense_item_id or ""), "statistical_code_id": str(line.statistical_code_id or "")})
        if vat:
            n += 1
            JournalLine.objects.create(entry=journal, line_no=n, account=vat_account, debit=vat,
                currency=currency, party=purchase.supplier, description="Thuế GTGT đầu vào được khấu trừ")
        n += 1
        JournalLine.objects.create(entry=journal, line_no=n, account=line.credit_account, credit=line.total_amount,
            currency=currency, party=purchase.supplier)
    if n == 0:
        raise ValidationError("Tổng thanh toán phải lớn hơn 0 để ghi sổ.")
    post_journal(journal, request)
    purchase.journal_entry = journal
    if purchase.payment_type == "UNPAID":
        Payable.objects.create(company=purchase.company, branch=purchase.branch, supplier=purchase.supplier,
            goods_purchase=purchase, currency=purchase.company.accounting_currency, exchange_rate=1,
            original_amount=purchase.total_amount, balance=purchase.total_amount)
    else:
        payment = Payment.objects.select_for_update().get(pk=purchase.payment_id)
        if payment.status != "CONFIRMED" or payment.amount - payment.allocated_amount < purchase.total_amount:
            raise ValidationError("Chứng từ thanh toán không còn đủ số tiền.")
        Payment.objects.filter(pk=payment.pk).update(allocated_amount=F("allocated_amount") + purchase.total_amount)
    if order_lines:
        for order_line, quantity in order_lines:
            PurchaseOrderLine.objects.filter(pk=order_line.pk).update(received_quantity=F("received_quantity") + quantity)
        for line in lines:
            if line.order_line_id:
                PurchaseOrderLine.objects.filter(pk=line.order_line_id).update(
                    realized_purchase_value=F("realized_purchase_value") + line.pre_tax_amount)
        PurchaseOrder.objects.filter(pk=purchase.purchase_order_id).update(
            realized_purchase_value=F("realized_purchase_value") + sum((line.pre_tax_amount for line in lines), Decimal("0")))
        remaining = PurchaseOrderLine.objects.filter(order=purchase.purchase_order).filter(quantity__gt=F("received_quantity") + F("cancelled_quantity")).exists()
        order = purchase.purchase_order
        purchase.order_status_before = order.status
        purchase.order_receiving_status_before = order.receiving_status
        order.receiving_status = "PARTIALLY_RECEIVED" if remaining else "FULLY_RECEIVED"
        order.status = order.receiving_status
        order.save(update_fields=("receiving_status", "status", "updated_at"))
    purchase.status = "POSTED"
    purchase.version += 1
    purchase.posted_at = timezone.now()
    purchase.save(update_fields=("status", "version", "posted_at", "inventory_transaction", "inventory_created", "journal_entry", "order_status_before", "order_receiving_status_before", "updated_at"))
    audit(request, purchase, "POST", {"status": "APPROVED"}, {"status": "POSTED", "number": purchase.number})
    return purchase


@transaction.atomic
def unpost(purchase, request):
    purchase = GoodsPurchase.objects.select_for_update().get(pk=purchase.pk)
    if purchase.status != "POSTED":
        raise ValidationError("Chỉ chứng từ đã ghi sổ mới được bỏ ghi sổ.")
    from .models import PurchaseDiscount, PurchaseInvoiceMatch, PurchaseReturn
    if PurchaseReturn.objects.filter(original_purchase=purchase, status="POSTED").exists():
        raise ValidationError("Chứng từ mua đã có hàng trả lại, không thể bỏ ghi sổ.")
    if PurchaseDiscount.objects.filter(original_purchase=purchase, status="POSTED").exists():
        raise ValidationError("Chứng từ mua đã có giảm giá, không thể bỏ ghi sổ.")
    if PurchaseInvoiceMatch.objects.filter(purchase_line__purchase=purchase).exists():
        raise ValidationError("Chứng từ mua đã liên kết hóa đơn, không thể bỏ ghi sổ.")
    validate_ready(purchase, check_payment=False)
    if purchase.supplier_invoice_id and purchase.supplier_invoice.status == "POSTED":
        raise ValidationError("Hóa đơn liên kết đã ghi sổ, không thể bỏ ghi sổ chứng từ mua hàng.")
    payable = Payable.objects.filter(goods_purchase=purchase).first()
    if payable and (payable.paid_amount or payable.netted_amount or payable.adjustment_amount):
        raise ValidationError("Chứng từ đã phát sinh thanh toán hoặc đối trừ, không thể bỏ ghi sổ.")
    if payable:
        payable.delete()
    if purchase.payment_type == "IMMEDIATE":
        payment = Payment.objects.select_for_update().get(pk=purchase.payment_id)
        Payment.objects.filter(pk=payment.pk).update(allocated_amount=F("allocated_amount") - purchase.total_amount)
    owned_inventory = purchase.inventory_created
    if purchase.inventory_transaction_id and owned_inventory:
        reverse_inventory(purchase.inventory_transaction, request)
    if purchase.purchase_order_id:
        order = PurchaseOrder.objects.select_for_update().get(pk=purchase.purchase_order_id)
        for line in purchase.lines.exclude(order_line=None):
            PurchaseOrderLine.objects.filter(pk=line.order_line_id).update(received_quantity=F("received_quantity") - line.quantity)
            PurchaseOrderLine.objects.filter(pk=line.order_line_id).update(
                realized_purchase_value=F("realized_purchase_value") - line.pre_tax_amount)
        PurchaseOrder.objects.filter(pk=order.pk).update(
            realized_purchase_value=F("realized_purchase_value") - sum(
                (line.pre_tax_amount for line in purchase.lines.all()), Decimal("0")))
        remaining = PurchaseOrderLine.objects.filter(order=order).filter(quantity__gt=F("received_quantity") + F("cancelled_quantity")).exists()
        has_received = order.lines.filter(received_quantity__gt=0).exists()
        order.receiving_status = "PARTIALLY_RECEIVED" if has_received else purchase.order_receiving_status_before or "NOT_RECEIVED"
        if not remaining:
            order.receiving_status = "FULLY_RECEIVED"
        order.status = ("PARTIALLY_RECEIVED" if has_received else purchase.order_status_before or "APPROVED") if remaining else "FULLY_RECEIVED"
        order.save(update_fields=("status", "receiving_status", "updated_at"))
    journal = purchase.journal_entry
    purchase.journal_entry = None
    purchase.inventory_transaction = None if owned_inventory else purchase.inventory_transaction
    purchase.inventory_created = False
    purchase.status = "APPROVED"
    purchase.version += 1
    purchase.posted_at = None
    purchase.save(update_fields=("status", "version", "posted_at", "inventory_transaction", "inventory_created", "journal_entry", "updated_at"))
    reversal = JournalEntry.objects.create(company=journal.company, branch=journal.branch, period=journal.period,
        number=f"REV-{journal.number}", entry_type="REVERSAL", posting_date=journal.posting_date,
        document_date=journal.document_date, description=f"Bỏ ghi sổ {purchase.number}", source_module="PUR",
        original_entry=journal, status="POSTED", total_debit=journal.total_credit,
        total_credit=journal.total_debit, created_by=request.user.iam_account,
        approved_by=request.user.iam_account, posted_by=request.user.iam_account,
        approved_at=timezone.now(), posted_at=timezone.now())
    for line in journal.lines.select_related("account"):
        JournalLine.objects.create(entry=reversal, line_no=line.line_no, account=line.account,
            description=line.description, debit=line.credit, credit=line.debit, currency=line.currency,
            party=line.party, department=line.department, project=line.project, cost_center=line.cost_center,
            warehouse=line.warehouse, dimensions=line.dimensions, exchange_rate=line.exchange_rate,
            foreign_amount=line.foreign_amount)
        balance = _balance(journal.period, line.account, journal.branch)
        balance.period_debit += line.credit
        balance.period_credit += line.debit
        _recalculate_closing(balance)
        balance.save(update_fields=("period_debit", "period_credit", "closing_debit", "closing_credit", "updated_at"))
    journal.status = "REVERSED"
    journal.save(update_fields=("status", "updated_at"))
    audit(request, purchase, "UNPOST", {"status": "POSTED"}, {"status": "APPROVED"})
    return purchase
