from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts_payable.models import Payable, PayableAdjustment
from accounts_payable.services import update_payable_status
from approval_workflows.execution import approval_progress
from approval_workflows.submission import configured_snapshot
from common_services.models import DocumentNumberingRule
from common_services.period_services import determine_period_for_date
from general_ledger.models import AccountingPeriod, JournalEntry, JournalLine
from general_ledger.services import _balance, _recalculate_closing, post as post_journal
from inventory.models import InventoryTransaction, InventoryTransactionLine, StockBalance
from inventory.services import post as post_inventory, reverse as reverse_inventory
from master_data.models import DocumentType

from .models import (ApprovalDecision, GoodsPurchase, GoodsPurchaseLine, PurchaseOrder, PurchaseOrderLine,
                     PurchaseReturn, PurchaseReturnCredit, PurchaseReturnLine)
from .services import audit
from .goods_services import input_vat_split

MONEY = Decimal("0.0001")


def number_for(company, document_date, branch=None):
    from common_services.numbering_services import generate_document_number

    document_type = DocumentType.objects.filter(code="PUR.RETURN", status="ACTIVE").first()
    if document_type and DocumentNumberingRule.objects.filter(company=company, document_type=document_type, status="ACTIVE").exists():
        number = generate_document_number(company, document_type, branch=branch, document_date=document_date)
        if PurchaseReturn.objects.filter(company=company, number=number).exists():
            raise ValidationError("Số chứng từ trả lại đã tồn tại.")
        return number
    prefix = f"RT{document_date:%Y%m%d}"
    last = PurchaseReturn.objects.filter(company=company, number__startswith=prefix).order_by("-number").values_list("number", flat=True).first()
    sequence = int(last[len(prefix):]) + 1 if last and last[len(prefix):].isdigit() else 1
    return f"{prefix}{sequence:04d}"


def save_lines(document, lines):
    subtotal = discount = tax = Decimal("0")
    for row in lines:
        source = row["original_line"]
        quantity = row["quantity"]
        gross = (quantity * source.unit_price).quantize(MONEY, ROUND_HALF_UP)
        line_discount = (gross * source.discount_rate / 100).quantize(MONEY, ROUND_HALF_UP)
        net = gross - line_discount
        line_tax = (net * source.tax_rate.rate_percent / 100).quantize(MONEY, ROUND_HALF_UP) if source.tax_rate_id else Decimal("0")
        PurchaseReturnLine.objects.create(document=document, line_no=row["line_no"], original_line=source,
            warehouse=row.get("warehouse") or document.warehouse, quantity=quantity, item=source.item, uom=source.uom,
            unit_price=source.unit_price, discount_rate=source.discount_rate, tax_rate=source.tax_rate,
            debit_account=row.get("debit_account") or source.credit_account,
            credit_account=row.get("credit_account") or source.debit_account,
            notes=row.get("notes", ""), discount_amount=line_discount, pre_tax_amount=net,
            tax_amount=line_tax, total_amount=net + line_tax)
        subtotal += gross
        discount += line_discount
        tax += line_tax
    document.subtotal = subtotal
    document.discount_amount = discount
    document.tax_amount = tax
    document.total_amount = subtotal - discount + tax
    document.save(update_fields=("subtotal", "discount_amount", "tax_amount", "total_amount", "updated_at"))


def validate_ready(document, *, check_stock=True):
    source = GoodsPurchase.objects.select_for_update().get(pk=document.original_purchase_id)
    if source.status != "POSTED" or source.purchase_type == "SERVICE":
        raise ValidationError("Chứng từ mua hàng chưa được ghi sổ hoặc không còn hiệu lực.")
    if document.company_id != source.company_id or document.branch_id != source.branch_id or document.supplier_id != source.supplier_id:
        raise ValidationError("Chứng từ trả lại không khớp chứng từ mua gốc.")
    if not document.reason.strip() or len(document.reason) > 500:
        raise ValidationError("Lý do trả lại là bắt buộc, tối đa 500 ký tự.")
    if not document.lines.exists():
        raise ValidationError("Chứng từ phải có ít nhất một dòng hàng trả lại.")
    fiscal = determine_period_for_date(document.company, document.posting_date)["period"]
    if fiscal.status != "OPEN":
        raise ValidationError("Kỳ kế toán đã bị khóa hoặc chưa mở.")
    if source.purchase_type == "WAREHOUSE" and not document.warehouse_id:
        raise ValidationError("Kho xuất trả là bắt buộc.")
    if source.purchase_type == "DIRECT" and (document.warehouse_id or document.issue_transaction_id):
        raise ValidationError("Hàng mua không qua kho không được tạo chứng từ xuất kho.")
    if document.warehouse and (document.warehouse.status != "ACTIVE" or not document.warehouse.allow_issue):
        raise ValidationError("Kho xuất trả không hoạt động hoặc không cho phép xuất.")
    if document.supplier.status != "ACTIVE" or document.branch.status != "ACTIVE":
        raise ValidationError("Dữ liệu được chọn đã ngừng sử dụng.")
    originals = {line.pk: line for line in GoodsPurchaseLine.objects.select_for_update().filter(purchase=source)}
    quantities = {}
    stock_quantities = {}
    for line in document.lines.select_related("item", "uom", "warehouse", "debit_account", "credit_account"):
        if line.original_line_id not in originals:
            raise ValidationError("Dòng hàng không thuộc chứng từ mua gốc.")
        if line.quantity <= 0 or line.item_id != originals[line.original_line_id].item_id:
            raise ValidationError("Số lượng trả lại hoặc hàng hóa không hợp lệ.")
        if any(obj.status != "ACTIVE" for obj in (line.item, line.uom, line.debit_account, line.credit_account)):
            raise ValidationError("Hàng hóa, đơn vị tính hoặc tài khoản đã ngừng sử dụng.")
        if not line.debit_account.is_postable or not line.credit_account.is_postable:
            raise ValidationError("Tài khoản hạch toán không cho phép ghi sổ.")
        if source.purchase_type == "WAREHOUSE":
            if not line.warehouse_id or line.warehouse_id != document.warehouse_id:
                raise ValidationError("Kho xuất của dòng không khớp kho trả lại.")
            stock_quantities[line.item_id] = stock_quantities.get(line.item_id, Decimal("0")) + line.quantity
        elif line.warehouse_id:
            raise ValidationError("Hàng mua không qua kho không được chọn kho.")
        quantities[line.original_line_id] = quantities.get(line.original_line_id, Decimal("0")) + line.quantity
    for original_line_id, quantity in quantities.items():
        previous = PurchaseReturnLine.objects.filter(original_line_id=original_line_id, document__status="POSTED").exclude(document=document).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
        if quantity > originals[original_line_id].quantity - previous:
            raise ValidationError("Số lượng trả lại vượt quá số lượng còn được trả.")
        from .models import PurchaseDiscountLine
        discounted = PurchaseDiscountLine.objects.filter(original_line_id=original_line_id, document__status="POSTED").aggregate(total=Sum("pre_tax_amount"))["total"] or Decimal("0")
        returned_value = PurchaseReturnLine.objects.filter(original_line_id=original_line_id, document__status="POSTED").exclude(document=document).aggregate(total=Sum("pre_tax_amount"))["total"] or Decimal("0")
        current_value = sum((line.pre_tax_amount for line in document.lines.filter(original_line_id=original_line_id)), Decimal("0"))
        if current_value > originals[original_line_id].pre_tax_amount - returned_value - discounted:
            raise ValidationError("Giá trị hàng trả lại vượt quá giá trị còn lại sau giảm giá.")
    if check_stock and source.purchase_type == "WAREHOUSE" and not document.issue_transaction_id:
        for item_id, quantity in stock_quantities.items():
            balances = StockBalance.objects.select_for_update().filter(company=document.company, warehouse=document.warehouse,
                item_id=item_id, location__isnull=True, lot_serial__isnull=True)
            available = sum((balance.available_quantity for balance in balances), Decimal("0"))
            if quantity > available:
                raise ValidationError("Số lượng tồn kho không đủ để trả lại nhà cung cấp.")
    if document.issue_transaction_id:
        issue = document.issue_transaction
        if (issue.status != "POSTED" or issue.transaction_type != "ISSUE" or issue.company_id != document.company_id or
                issue.branch_id != document.branch_id or issue.supplier_id != document.supplier_id or
                issue.source_warehouse_id != document.warehouse_id):
            raise ValidationError("Phiếu xuất kho không khớp chứng từ trả lại.")
        actual = {}
        for line in issue.lines.all():
            actual[line.item_id] = actual.get(line.item_id, Decimal("0")) + line.base_quantity
        if actual != stock_quantities:
            raise ValidationError("Phiếu xuất kho không khớp hàng hóa hoặc số lượng trả.")
    return originals


@transaction.atomic
def submit(document, request):
    document = PurchaseReturn.objects.select_for_update().get(pk=document.pk)
    if document.status not in {"DRAFT", "REVISION_REQUIRED"}:
        raise ValidationError("Trạng thái không cho phép gửi phê duyệt.")
    validate_ready(document)
    snapshot = configured_snapshot(document, "PUR.RETURN")
    document.workflow_snapshot = snapshot or {"approval_required": False}
    document.approval_required = bool(document.workflow_snapshot.get("approval_required"))
    previous = document.status
    document.status = "PENDING_APPROVAL" if document.approval_required else "APPROVED"
    document.version += 1
    document.submitted_at = timezone.now()
    document.approved_at = timezone.now() if document.status == "APPROVED" else None
    document.save(update_fields=("status", "version", "workflow_snapshot", "approval_required", "submitted_at", "approved_at", "updated_at"))
    ApprovalDecision.objects.create(company=document.company, document_type="RETURN", document_id=document.pk,
        workflow_version=str(document.workflow_snapshot.get("version", "")), decision="SUBMITTED", actor=request.user.iam_account)
    audit(request, document, "SUBMIT", {"status": previous}, {"status": document.status, "number": document.number,
          "original_purchase": document.original_purchase.number})
    return document


@transaction.atomic
def decide(document, request, decision):
    document = PurchaseReturn.objects.select_for_update().get(pk=document.pk)
    if document.status != "PENDING_APPROVAL":
        raise ValidationError("Chứng từ không chờ phê duyệt.")
    reason = request.data.get("reason", "").strip()
    if decision in {"REJECTED", "REVISION_REQUIRED"} and not reason:
        raise ValidationError({"reason": "Lý do là bắt buộc."})
    if decision == "APPROVED":
        validate_ready(document)
    decisions = ApprovalDecision.objects.filter(document_type="RETURN", document_id=document.pk)
    level = decisions.filter(decision="APPROVED").count() + 1
    if document.workflow_snapshot.get("version_id"):
        progress = approval_progress(document, request.user.iam_account, decision == "APPROVED", decisions)
        level = progress["level"]
        if decision == "APPROVED" and not progress["final"]:
            decision = "PENDING_APPROVAL"
    document.status = decision
    document.version += 1
    document.approved_at = timezone.now() if decision == "APPROVED" else None
    document.save(update_fields=("status", "version", "approved_at", "updated_at"))
    ApprovalDecision.objects.create(company=document.company, document_type="RETURN", document_id=document.pk,
        workflow_version=str(document.workflow_snapshot.get("version", "")), level=level,
        decision="APPROVED" if decision in {"APPROVED", "PENDING_APPROVAL"} else "REVISION_REQUIRED" if decision == "REVISION_REQUIRED" else "REJECTED",
        actor=request.user.iam_account, comment=reason)
    audit(request, document, decision, {"status": "PENDING_APPROVAL"}, {"status": decision,
          "original_purchase": document.original_purchase.number}, reason)
    return document


def _apply_order_progress(document, direction):
    source = document.original_purchase
    if not source.purchase_order_id:
        return
    order = PurchaseOrder.objects.select_for_update().get(pk=source.purchase_order_id)
    for line in document.lines.select_related("original_line"):
        if line.original_line.order_line_id:
            order_line = PurchaseOrderLine.objects.select_for_update().get(pk=line.original_line.order_line_id)
            if direction < 0 and order_line.received_quantity < line.quantity:
                raise ValidationError("Số lượng đã nhận của đơn mua hàng không đủ để ghi nhận trả lại.")
            PurchaseOrderLine.objects.filter(pk=line.original_line.order_line_id).update(
                received_quantity=F("received_quantity") + direction * line.quantity,
                realized_purchase_value=F("realized_purchase_value") + direction * line.pre_tax_amount)
    PurchaseOrder.objects.filter(pk=order.pk).update(
        realized_purchase_value=F("realized_purchase_value") + direction * sum(
            (line.pre_tax_amount for line in document.lines.all()), Decimal("0")))
    lines = list(PurchaseOrderLine.objects.filter(order=order))
    any_received = any(line.received_quantity > 0 for line in lines)
    all_received = all(line.remaining_quantity <= 0 for line in lines)
    order.receiving_status = "FULLY_RECEIVED" if all_received else "PARTIALLY_RECEIVED" if any_received else "NOT_RECEIVED"
    order.status = "FULLY_RECEIVED" if all_received else "PARTIALLY_RECEIVED" if any_received else "IN_PROGRESS"
    order.save(update_fields=("receiving_status", "status", "updated_at"))


@transaction.atomic
def post(document, request):
    document = PurchaseReturn.objects.select_for_update().get(pk=document.pk)
    if document.status != "APPROVED":
        raise ValidationError("Chỉ chứng từ APPROVED mới được ghi sổ.")
    validate_ready(document)
    gl_period = AccountingPeriod.objects.filter(company=document.company, start_date__lte=document.posting_date,
        end_date__gte=document.posting_date, status="OPEN").first()
    if not gl_period:
        raise ValidationError("Không có kỳ sổ cái đang mở cho ngày hạch toán.")
    lines = list(document.lines.select_related("item", "uom", "debit_account", "credit_account"))
    if document.original_purchase.purchase_type == "WAREHOUSE" and not document.issue_transaction_id:
        issue = InventoryTransaction.objects.create(company=document.company, branch=document.branch,
            supplier=document.supplier, number=f"{document.number}-INV-{document.version}",
            transaction_type="ISSUE", transaction_date=document.posting_date, source_warehouse=document.warehouse,
            source_module="PUR", source_reference=document.number, status="APPROVED", created_by=request.user.iam_account)
        for line in lines:
            InventoryTransactionLine.objects.create(transaction=issue, line_no=line.line_no, item=line.item,
                uom=line.uom, quantity=line.quantity, base_quantity=line.quantity, unit_cost=0)
        post_inventory(issue, request)
        document.issue_transaction = issue
        document.issue_created = True
    journal = JournalEntry.objects.create(company=document.company, branch=document.branch, period=gl_period,
        number=f"{document.number}-GL-{document.version}", entry_type="SUBLEDGER",
        posting_date=document.posting_date, document_date=document.document_date,
        description=document.notes or f"Trả hàng mua: {document.reason}", source_module="PUR",
        source_event_id=f"PUR.RETURN:{document.pk}:{document.version}", source_entity_type="PurchaseReturn",
        source_entity_id=document.pk, status="APPROVED", total_debit=document.total_amount,
        total_credit=document.total_amount, workflow_snapshot={"allow_creator_posting": True},
        created_by=request.user.iam_account, approved_by=request.user.iam_account, approved_at=timezone.now())
    n = 0
    for line in lines:
        if not line.total_amount:
            continue
        n += 1
        JournalLine.objects.create(entry=journal, line_no=n, account=line.debit_account,
            debit=line.total_amount, currency=document.company.accounting_currency, party=document.supplier,
            warehouse=document.warehouse)
        goods_value, vat, vat_account = input_vat_split(document.company, line)
        n += 1
        JournalLine.objects.create(entry=journal, line_no=n, account=line.credit_account,
            credit=goods_value, currency=document.company.accounting_currency, party=document.supplier,
            warehouse=document.warehouse)
        if vat:
            n += 1
            JournalLine.objects.create(entry=journal, line_no=n, account=vat_account, credit=vat,
                currency=document.company.accounting_currency, party=document.supplier,
                description="Giảm thuế GTGT đầu vào do trả lại hàng")
    if not n:
        raise ValidationError("Giá trị trả lại phải lớn hơn 0.")
    post_journal(journal, request)
    document.journal_entry = journal
    payable = Payable.objects.select_for_update().filter(goods_purchase=document.original_purchase).first()
    reduction = min(document.total_amount, payable.balance) if payable else Decimal("0")
    if reduction:
        document.payable_paid_before = payable.paid_amount
        document.payable_netted_before = payable.netted_amount
        adjustment = PayableAdjustment.objects.create(company=document.company, payable=payable,
            adjustment_date=document.posting_date, amount=-reduction, reason=f"Trả hàng {document.number}",
            posting_reference=document.number, status="POSTED", created_by=request.user.iam_account)
        payable.adjustment_amount -= reduction
        payable.balance -= reduction
        update_payable_status(payable)
        document.payable_adjustment = adjustment
    credit_amount = document.total_amount - reduction
    if credit_amount:
        PurchaseReturnCredit.objects.create(document=document, company=document.company,
            supplier=document.supplier, amount=credit_amount, handling=document.handling)
    _apply_order_progress(document, -1)
    document.status = "POSTED"
    document.version += 1
    document.posted_at = timezone.now()
    document.adjustment_invoice_status = "PENDING_ADJUSTMENT_INVOICE"
    document.save(update_fields=("status", "version", "posted_at", "adjustment_invoice_status",
                                 "issue_transaction", "issue_created", "journal_entry", "payable_adjustment",
                                 "payable_paid_before", "payable_netted_before", "updated_at"))
    audit(request, document, "POST", {"status": "APPROVED"}, {"status": "POSTED",
          "number": document.number, "original_purchase": document.original_purchase.number,
          "tax_adjustment": str(document.tax_amount), "credit_amount": str(credit_amount)})
    return document


@transaction.atomic
def unpost(document, request):
    document = PurchaseReturn.objects.select_for_update().get(pk=document.pk)
    if document.status != "POSTED":
        raise ValidationError("Chỉ chứng từ đã ghi sổ mới được bỏ ghi sổ.")
    validate_ready(document, check_stock=False)
    credit = PurchaseReturnCredit.objects.filter(document=document).first()
    if credit and credit.settled_amount:
        raise ValidationError("Chứng từ đã được bù trừ hoặc hoàn tiền, không thể bỏ ghi sổ.")
    adjustment = document.payable_adjustment
    if adjustment:
        payable = Payable.objects.select_for_update().get(pk=adjustment.payable_id)
        if payable.paid_amount != document.payable_paid_before or payable.netted_amount != document.payable_netted_before:
            raise ValidationError("Công nợ đã phát sinh dữ liệu phụ thuộc, không thể bỏ ghi sổ.")
        if PayableAdjustment.objects.filter(payable=payable, status="POSTED", created_at__gt=adjustment.created_at).exists():
            raise ValidationError("Công nợ đã phát sinh dữ liệu phụ thuộc, không thể bỏ ghi sổ.")
        payable.adjustment_amount -= adjustment.amount
        payable.balance -= adjustment.amount
        update_payable_status(payable)
        PayableAdjustment.objects.create(company=document.company, payable=payable,
            adjustment_date=document.posting_date, amount=-adjustment.amount,
            reason=request.data.get("reason", ""), posting_reference=document.number,
            status="POSTED", reverses=adjustment, created_by=request.user.iam_account)
        adjustment.status = "REVERSED"
        adjustment.save(update_fields=("status",))
    if credit:
        credit.delete()
    owned_issue = document.issue_created
    if document.issue_transaction_id and owned_issue:
        reverse_inventory(document.issue_transaction, request)
    _apply_order_progress(document, 1)
    journal = document.journal_entry
    reversal = JournalEntry.objects.create(company=journal.company, branch=journal.branch, period=journal.period,
        number=f"REV-{journal.number}", entry_type="REVERSAL", posting_date=journal.posting_date,
        document_date=journal.document_date, description=f"Bỏ ghi sổ {document.number}", source_module="PUR",
        original_entry=journal, status="POSTED", total_debit=journal.total_credit,
        total_credit=journal.total_debit, created_by=request.user.iam_account,
        approved_by=request.user.iam_account, posted_by=request.user.iam_account,
        approved_at=timezone.now(), posted_at=timezone.now())
    for line in journal.lines.select_related("account"):
        JournalLine.objects.create(entry=reversal, line_no=line.line_no, account=line.account,
            debit=line.credit, credit=line.debit, currency=line.currency, party=line.party,
            department=line.department, project=line.project, cost_center=line.cost_center,
            warehouse=line.warehouse, dimensions=line.dimensions, exchange_rate=line.exchange_rate,
            foreign_amount=line.foreign_amount)
        balance = _balance(journal.period, line.account, journal.branch)
        balance.period_debit += line.credit
        balance.period_credit += line.debit
        _recalculate_closing(balance)
        balance.save(update_fields=("period_debit", "period_credit", "closing_debit", "closing_credit", "updated_at"))
    journal.status = "REVERSED"
    journal.save(update_fields=("status", "updated_at"))
    document.status = "APPROVED"
    document.version += 1
    document.posted_at = None
    document.issue_transaction = None if owned_issue else document.issue_transaction
    document.issue_created = False
    document.journal_entry = None
    document.payable_adjustment = None
    document.save(update_fields=("status", "version", "posted_at", "issue_transaction",
                                 "issue_created", "journal_entry", "payable_adjustment", "updated_at"))
    audit(request, document, "UNPOST", {"status": "POSTED"}, {"status": "APPROVED",
          "original_purchase": document.original_purchase.number}, request.data.get("reason", ""))
    return document
