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
from master_data.models import DocumentType

from .models import (ApprovalDecision, GoodsPurchase, GoodsPurchaseLine, PurchaseDiscount,
                     PurchaseDiscountCredit, PurchaseDiscountLine, PurchaseOrder,
                     PurchaseOrderLine, PurchaseReturnLine)
from .services import audit
from .goods_services import input_vat_split

MONEY = Decimal("0.0001")


def invoice_status(document):
    if document.adjustment_invoice_id:
        return "LINKED"
    if document.supplier_invoice_id and document.tax_amount:
        return "PENDING_ADJUSTMENT_INVOICE"
    return "NOT_REQUIRED"


def number_for(company, document_date, branch=None):
    from common_services.numbering_services import generate_document_number

    kind = DocumentType.objects.filter(code="PUR.DISCOUNT", status="ACTIVE").first()
    if kind and DocumentNumberingRule.objects.filter(company=company, document_type=kind, status="ACTIVE").exists():
        number = generate_document_number(company, kind, branch=branch, document_date=document_date)
        if PurchaseDiscount.objects.filter(company=company, number=number).exists():
            raise ValidationError("Số chứng từ giảm giá đã tồn tại.")
        return number
    prefix = f"PD{document_date:%Y%m%d}"
    last = PurchaseDiscount.objects.filter(company=company, number__startswith=prefix).order_by("-number").values_list("number", flat=True).first()
    sequence = int(last[len(prefix):]) + 1 if last and last[len(prefix):].isdigit() else 1
    return f"{prefix}{sequence:04d}"


def remaining_value(original_line, exclude_document=None):
    returned = PurchaseReturnLine.objects.filter(original_line=original_line, document__status="POSTED").aggregate(total=Sum("pre_tax_amount"))["total"] or Decimal("0")
    discounts = PurchaseDiscountLine.objects.filter(original_line=original_line, document__status="POSTED")
    if exclude_document:
        discounts = discounts.exclude(document=exclude_document)
    discounted = discounts.aggregate(total=Sum("pre_tax_amount"))["total"] or Decimal("0")
    return original_line.pre_tax_amount - returned - discounted, returned, discounted


def save_lines(document, lines):
    pre_tax = tax = Decimal("0")
    for row in lines:
        source = row["original_line"]
        remaining, _, _ = remaining_value(source, document)
        if document.method == "PERCENT":
            rate = row.get("rate_percent")
            if rate is None or rate <= 0 or rate > 100:
                raise ValidationError("Tỷ lệ giảm phải lớn hơn 0 và không vượt 100%.")
            amount = (remaining * rate / 100).quantize(MONEY, ROUND_HALF_UP)
        else:
            rate = Decimal("0")
            amount = row.get("pre_tax_amount")
        if amount is None or amount <= 0 or amount > remaining:
            raise ValidationError("Giá trị giảm vượt quá giá trị còn được giảm của hàng mua.")
        line_tax = (amount * source.tax_rate.rate_percent / 100).quantize(MONEY, ROUND_HALF_UP) if source.tax_rate_id else Decimal("0")
        PurchaseDiscountLine.objects.create(document=document, line_no=row["line_no"], original_line=source,
            item=source.item, uom=source.uom, rate_percent=rate, pre_tax_amount=amount,
            tax_rate=source.tax_rate, tax_amount=line_tax, total_amount=amount + line_tax,
            debit_account=row.get("debit_account") or source.credit_account,
            credit_account=row.get("credit_account") or source.debit_account,
            notes=row.get("notes", ""))
        pre_tax += amount
        tax += line_tax
    document.pre_tax_amount = pre_tax
    document.tax_amount = tax
    document.total_amount = pre_tax + tax
    document.adjustment_invoice_status = invoice_status(document)
    document.save(update_fields=("pre_tax_amount", "tax_amount", "total_amount", "adjustment_invoice_status", "updated_at"))


def validate_ready(document, *, for_post=False):
    purchase = GoodsPurchase.objects.select_for_update().get(pk=document.original_purchase_id)
    if purchase.status != "POSTED" or purchase.purchase_type == "SERVICE":
        raise ValidationError("Chứng từ mua hàng chưa được ghi sổ hoặc không còn hiệu lực.")
    if (document.company_id != purchase.company_id or document.branch_id != purchase.branch_id or
            document.supplier_id != purchase.supplier_id or document.supplier_invoice_id != purchase.supplier_invoice_id):
        raise ValidationError("Chứng từ giảm giá không khớp chứng từ mua gốc.")
    if not document.reason.strip() or len(document.reason) > 500:
        raise ValidationError("Lý do giảm giá là bắt buộc, tối đa 500 ký tự.")
    if not document.lines.exists():
        raise ValidationError("Chứng từ phải có ít nhất một dòng giảm giá.")
    period = determine_period_for_date(document.company, document.posting_date)["period"]
    if period.status != "OPEN":
        raise ValidationError("Kỳ kế toán đã bị khóa.")
    if document.supplier.status != "ACTIVE" or document.branch.status != "ACTIVE":
        raise ValidationError("Dữ liệu được chọn đã ngừng sử dụng.")
    invoice = document.adjustment_invoice
    if invoice:
        if (invoice.company_id != document.company_id or invoice.supplier_id != document.supplier_id or
                invoice.pk == document.supplier_invoice_id):
            raise ValidationError("Hóa đơn điều chỉnh không thuộc Nhà cung cấp của chứng từ mua hàng.")
        if for_post and not (invoice.validation_status == "VALID" if invoice.received_via_purchase else invoice.status == "POSTED"):
            raise ValidationError("Hóa đơn điều chỉnh chưa được ghi sổ.")
    originals = {line.pk: line for line in GoodsPurchaseLine.objects.select_for_update().filter(purchase=purchase)}
    used = set()
    pre_tax = tax = Decimal("0")
    for line in document.lines.select_related("item", "uom", "debit_account", "credit_account", "tax_rate"):
        original = originals.get(line.original_line_id)
        if not original or line.original_line_id in used or line.item_id != original.item_id or line.uom_id != original.uom_id:
            raise ValidationError("Dòng giảm giá không thuộc chứng từ mua gốc hoặc bị lặp.")
        used.add(line.original_line_id)
        if line.pre_tax_amount <= 0 or line.tax_rate_id != original.tax_rate_id:
            raise ValidationError("Giá trị hoặc thuế suất giảm giá không hợp lệ.")
        remaining, _, _ = remaining_value(original, document)
        if remaining <= 0 or line.pre_tax_amount > remaining:
            raise ValidationError("Giá trị giảm vượt quá giá trị còn được giảm hiện tại.")
        if document.method == "PERCENT" and (line.rate_percent <= 0 or line.rate_percent > 100 or
                line.pre_tax_amount != (remaining * line.rate_percent / 100).quantize(MONEY, ROUND_HALF_UP)):
            raise ValidationError("Giá trị còn được giảm đã thay đổi. Vui lòng kiểm tra lại chứng từ.")
        if any(obj.status != "ACTIVE" for obj in (line.item, line.uom, line.debit_account, line.credit_account)) or not line.debit_account.is_postable or not line.credit_account.is_postable:
            raise ValidationError("Tài khoản hạch toán hoặc dữ liệu dòng không hợp lệ hoặc đã ngừng sử dụng.")
        expected_tax = (line.pre_tax_amount * original.tax_rate.rate_percent / 100).quantize(MONEY, ROUND_HALF_UP) if original.tax_rate_id else Decimal("0")
        if line.tax_amount != expected_tax or line.total_amount != line.pre_tax_amount + expected_tax:
            raise ValidationError("Số tiền thuế điều chỉnh không hợp lệ.")
        pre_tax += line.pre_tax_amount
        tax += line.tax_amount
    if document.pre_tax_amount != pre_tax or document.tax_amount != tax or document.total_amount != pre_tax + tax:
        raise ValidationError("Tổng giá trị giảm không khớp chi tiết.")
    if for_post and purchase.supplier_invoice_id and document.tax_amount and not invoice:
        raise ValidationError("Vui lòng bổ sung Hóa đơn điều chỉnh trước khi ghi sổ.")


@transaction.atomic
def submit(document, request):
    document = PurchaseDiscount.objects.select_for_update().get(pk=document.pk)
    if document.status not in {"DRAFT", "REVISION_REQUIRED"}:
        raise ValidationError("Trạng thái không cho phép gửi phê duyệt.")
    validate_ready(document)
    snapshot = configured_snapshot(document, "PUR.DISCOUNT")
    document.workflow_snapshot = snapshot or {"approval_required": False}
    document.approval_required = bool(document.workflow_snapshot.get("approval_required"))
    previous = document.status
    document.status = "PENDING_APPROVAL" if document.approval_required else "APPROVED"
    document.version += 1
    document.submitted_at = timezone.now()
    document.approved_at = timezone.now() if document.status == "APPROVED" else None
    document.save(update_fields=("status", "version", "workflow_snapshot", "approval_required", "submitted_at", "approved_at", "updated_at"))
    ApprovalDecision.objects.create(company=document.company, document_type="DISCOUNT", document_id=document.pk,
        workflow_version=str(document.workflow_snapshot.get("version", "")), decision="SUBMITTED", actor=request.user.iam_account)
    audit(request, document, "SUBMIT", {"status": previous}, {"status": document.status, "number": document.number, "original_purchase": document.original_purchase.number})
    return document


@transaction.atomic
def decide(document, request, decision):
    document = PurchaseDiscount.objects.select_for_update().get(pk=document.pk)
    if document.status != "PENDING_APPROVAL":
        raise ValidationError("Chứng từ không chờ phê duyệt.")
    reason = request.data.get("reason", "").strip()
    if decision in {"REJECTED", "REVISION_REQUIRED"} and not reason:
        raise ValidationError({"reason": "Lý do là bắt buộc."})
    if decision == "APPROVED":
        validate_ready(document)
    decisions = ApprovalDecision.objects.filter(document_type="DISCOUNT", document_id=document.pk)
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
    ApprovalDecision.objects.create(company=document.company, document_type="DISCOUNT", document_id=document.pk,
        workflow_version=str(document.workflow_snapshot.get("version", "")), level=level,
        decision="APPROVED" if decision in {"APPROVED", "PENDING_APPROVAL"} else decision,
        actor=request.user.iam_account, comment=reason)
    audit(request, document, decision, {"status": "PENDING_APPROVAL"}, {"status": decision, "original_purchase": document.original_purchase.number}, reason)
    return document


def _update_order_value(document, direction):
    if not document.original_purchase.purchase_order_id:
        return
    order = PurchaseOrder.objects.select_for_update().get(pk=document.original_purchase.purchase_order_id)
    for line in document.lines.select_related("original_line"):
        if line.original_line.order_line_id:
            PurchaseOrderLine.objects.filter(pk=line.original_line.order_line_id).update(
                realized_purchase_value=F("realized_purchase_value") + direction * line.pre_tax_amount)
    PurchaseOrder.objects.filter(pk=order.pk).update(
        realized_purchase_value=F("realized_purchase_value") + direction * document.pre_tax_amount)


@transaction.atomic
def post(document, request):
    document = PurchaseDiscount.objects.select_for_update().get(pk=document.pk)
    if document.status != "APPROVED":
        raise ValidationError("Chỉ chứng từ APPROVED mới được ghi sổ.")
    validate_ready(document, for_post=True)
    period = AccountingPeriod.objects.filter(company=document.company, start_date__lte=document.posting_date,
        end_date__gte=document.posting_date, status="OPEN").first()
    if not period:
        raise ValidationError("Không có kỳ sổ cái đang mở cho ngày hạch toán.")
    journal = JournalEntry.objects.create(company=document.company, branch=document.branch, period=period,
        number=f"{document.number}-GL-{document.version}", entry_type="SUBLEDGER",
        posting_date=document.posting_date, document_date=document.document_date,
        description=document.notes or f"Giảm giá hàng mua: {document.reason}", source_module="PUR",
        source_event_id=f"PUR.DISCOUNT:{document.pk}:{document.version}", source_entity_type="PurchaseDiscount",
        source_entity_id=document.pk, status="APPROVED", total_debit=document.total_amount,
        total_credit=document.total_amount, workflow_snapshot={"allow_creator_posting": True},
        created_by=request.user.iam_account, approved_by=request.user.iam_account, approved_at=timezone.now())
    n = 0
    for line in document.lines.select_related("debit_account", "credit_account"):
        n += 1
        JournalLine.objects.create(entry=journal, line_no=n, account=line.debit_account,
            debit=line.total_amount, currency=document.company.accounting_currency, party=document.supplier)
        goods_value, vat, vat_account = input_vat_split(document.company, line)
        n += 1
        JournalLine.objects.create(entry=journal, line_no=n, account=line.credit_account,
            credit=goods_value, currency=document.company.accounting_currency, party=document.supplier,
            warehouse=document.original_purchase.receiving_warehouse)
        if vat:
            n += 1
            JournalLine.objects.create(entry=journal, line_no=n, account=vat_account, credit=vat,
                currency=document.company.accounting_currency, party=document.supplier,
                description="Giảm thuế GTGT đầu vào do giảm giá hàng mua")
    post_journal(journal, request)
    document.journal_entry = journal
    payable = Payable.objects.select_for_update().filter(goods_purchase=document.original_purchase).first()
    reduction = min(document.total_amount, payable.balance) if payable else Decimal("0")
    if reduction:
        document.payable_paid_before = payable.paid_amount
        document.payable_netted_before = payable.netted_amount
        adjustment = PayableAdjustment.objects.create(company=document.company, payable=payable,
            adjustment_date=document.posting_date, amount=-reduction, reason=f"Giảm giá hàng mua {document.number}",
            posting_reference=document.number, status="POSTED", created_by=request.user.iam_account)
        payable.adjustment_amount -= reduction
        payable.balance -= reduction
        update_payable_status(payable)
        document.payable_adjustment = adjustment
    credit = document.total_amount - reduction
    if credit:
        PurchaseDiscountCredit.objects.create(document=document, company=document.company,
            supplier=document.supplier, amount=credit, handling=document.handling)
    _update_order_value(document, -1)
    document.status = "POSTED"
    document.version += 1
    document.posted_at = timezone.now()
    document.adjustment_invoice_status = invoice_status(document)
    document.save(update_fields=("status", "version", "posted_at", "journal_entry", "payable_adjustment",
        "payable_paid_before", "payable_netted_before", "adjustment_invoice_status", "updated_at"))
    audit(request, document, "POST", {"status": "APPROVED"}, {"status": "POSTED", "number": document.number,
        "original_purchase": document.original_purchase.number, "pre_tax_amount": str(document.pre_tax_amount),
        "tax_adjustment": str(document.tax_amount), "supplier_credit": str(credit)})
    return document


@transaction.atomic
def unpost(document, request):
    document = PurchaseDiscount.objects.select_for_update().get(pk=document.pk)
    if document.status != "POSTED":
        raise ValidationError("Chỉ chứng từ POSTED mới được bỏ ghi sổ.")
    validate_ready(document)
    if document.journal_entry.period.status != "OPEN":
        raise ValidationError("Kỳ sổ cái đã bị khóa, không thể bỏ ghi sổ.")
    credit = PurchaseDiscountCredit.objects.filter(document=document).first()
    if credit and credit.settled_amount:
        raise ValidationError("Chứng từ đã phát sinh dữ liệu liên quan và không thể bỏ ghi sổ.")
    adjustment = document.payable_adjustment
    if adjustment:
        payable = Payable.objects.select_for_update().get(pk=adjustment.payable_id)
        if (payable.paid_amount != document.payable_paid_before or payable.netted_amount != document.payable_netted_before or
                PayableAdjustment.objects.filter(payable=payable, status="POSTED", created_at__gt=adjustment.created_at).exists()):
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
    _update_order_value(document, 1)
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
    document.journal_entry = None
    document.payable_adjustment = None
    document.save(update_fields=("status", "version", "posted_at", "journal_entry", "payable_adjustment", "updated_at"))
    audit(request, document, "UNPOST", {"status": "POSTED"}, {"status": "APPROVED", "original_purchase": document.original_purchase.number}, request.data.get("reason", ""))
    return document
