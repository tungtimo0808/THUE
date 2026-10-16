"""UC-AR-07: Customer Debt Statement / Reconciliation workflow, data extraction, and response tracking."""
from decimal import Decimal
import re

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from master_data.models import DocumentNumberingRule, Party, PartyRole
from organization.models import Company, Branch
from general_ledger.models import Account, AccountStatus
from . import models, services

ZERO = Decimal("0")
SCALE = Decimal("0.0001")


def _fail(condition, field, message):
    if not condition:
        raise ValidationError({field: message})


def generate_reconciliation_number(company, branch=None):
    rule = DocumentNumberingRule.objects.filter(
        company=company, document_type__code="AR.RECONCILIATION", status="ACTIVE"
    ).first()
    if rule:
        return rule.generate_next_number(company=company, branch=branch)
    today = timezone.localdate()
    year = today.year
    prefix = f"AR-REC-{year}-"
    last = models.CustomerDebtReconciliation.objects.filter(
        company=company, number__startswith=prefix
    ).order_by("-number").values_list("number", flat=True).first()
    if last:
        match = re.search(r"(\d+)$", last)
        next_seq = int(match.group(1)) + 1 if match else 1
    else:
        next_seq = 1
    return f"{prefix}{next_seq:05d}"


def extract_reconciliation_data(company, customer, from_date, to_date, currency, receivable_account, branch=None):
    """
    Extracts customer debt balance snapshot and detailed transactions for the statement period (BR03-BR06).
    """
    today = timezone.localdate()
    _fail(from_date <= to_date, "to_date", "Đến ngày không được trước Từ ngày.")
    _fail(to_date <= today, "to_date", "Đến ngày không được sau ngày hiện tại.")

    # Base query filters
    branch_q = Q(branch=branch) if branch else Q()

    # 1. Opening Balance (Công nợ còn phải thu trước from_date theo các nghiệp vụ đã ghi sổ)
    # A. Receivables posted before from_date
    rec_prior_qs = models.Receivable.objects.filter(
        company=company,
        customer=customer,
        currency=currency,
        account=receivable_account,
        posting_date__lt=from_date,
    ).filter(branch_q).exclude(status=models.ReceivableStatus.REVERSED)

    prior_receivable_total = rec_prior_qs.aggregate(total=Sum("original_amount"))["total"] or ZERO

    # B. Collections allocated before from_date
    prior_alloc_qs = models.ReceiptAllocation.objects.filter(
        receivable__company=company,
        receivable__customer=customer,
        receivable__currency=currency,
        receivable__account=receivable_account,
        receipt__status__in=[models.ReceiptStatus.CONFIRMED, "POSTED"],
        receipt__receipt_date__lt=from_date,
    )
    if branch:
        prior_alloc_qs = prior_alloc_qs.filter(receipt__branch=branch)
    prior_alloc_total = prior_alloc_qs.aggregate(total=Sum("amount"))["total"] or ZERO

    # C. Netting vouchers posted before from_date
    prior_netting_qs = models.DebtNettingVoucherLine.objects.filter(
        voucher__company=company,
        voucher__customer=customer,
        voucher__currency=currency,
        voucher__receivable_account=receivable_account,
        voucher__status=models.DebtNettingVoucher.Status.POSTED,
        voucher__posting_date__lt=from_date,
    )
    if branch:
        prior_netting_qs = prior_netting_qs.filter(voucher__branch=branch)
    prior_netting_total = prior_netting_qs.aggregate(total=Sum("amount"))["total"] or ZERO

    # D. Decrease Adjustments posted before from_date
    prior_adj_dec_qs = models.DebtAdjustmentVoucherLine.objects.filter(
        voucher__company=company,
        voucher__customer=customer,
        voucher__currency=currency,
        voucher__receivable_account=receivable_account,
        voucher__status=models.DebtAdjustmentVoucher.Status.POSTED,
        voucher__adjustment_type=models.DebtAdjustmentVoucher.AdjustmentType.DECREASE,
        voucher__posting_date__lt=from_date,
    )
    if branch:
        prior_adj_dec_qs = prior_adj_dec_qs.filter(voucher__branch=branch)
    prior_adj_dec_total = prior_adj_dec_qs.aggregate(total=Sum("amount"))["total"] or ZERO

    opening_balance = max(prior_receivable_total - prior_alloc_total - prior_netting_total - prior_adj_dec_total, ZERO)

    # 2. In-period transactions (from_date <= posting_date <= to_date)
    transactions = []

    # A. In-period Receivables (Excluding those created from adjustment vouchers to avoid double-counting)
    rec_period_qs = models.Receivable.objects.filter(
        company=company,
        customer=customer,
        currency=currency,
        account=receivable_account,
        posting_date__gte=from_date,
        posting_date__lte=to_date,
    ).filter(branch_q).exclude(
        Q(status=models.ReceivableStatus.REVERSED) | Q(source_document_type="AR_ADJUSTMENT_VOUCHER")
    ).order_by("posting_date", "code")

    for r in rec_period_qs:
        transactions.append({
            "posting_date": r.posting_date,
            "document_date": r.document_date or r.posting_date,
            "document_number": r.source_document_number or r.code,
            "document_type": r.source_document_type or "SALES_INVOICE",
            "description": r.description or f"Phát sinh phải thu {r.code}",
            "increase_amount": r.original_amount,
            "decrease_amount": ZERO,
            "receivable": r,
            "source_entity_type": "Receivable",
            "source_entity_id": str(r.id),
        })

    # B. In-period Debt Adjustments (INCREASE)
    adj_inc_qs = models.DebtAdjustmentVoucherLine.objects.filter(
        voucher__company=company,
        voucher__customer=customer,
        voucher__currency=currency,
        voucher__receivable_account=receivable_account,
        voucher__status=models.DebtAdjustmentVoucher.Status.POSTED,
        voucher__adjustment_type=models.DebtAdjustmentVoucher.AdjustmentType.INCREASE,
        voucher__posting_date__gte=from_date,
        voucher__posting_date__lte=to_date,
    ).select_related("voucher", "receivable").order_by("voucher__posting_date", "voucher__number", "line_no")
    if branch:
        adj_inc_qs = adj_inc_qs.filter(voucher__branch=branch)

    for line in adj_inc_qs:
        transactions.append({
            "posting_date": line.voucher.posting_date,
            "document_date": line.voucher.document_date,
            "document_number": line.voucher.number,
            "document_type": "DEBT_ADJUSTMENT_INCREASE",
            "description": line.description or line.voucher.description or "Điều chỉnh tăng công nợ",
            "increase_amount": line.amount,
            "decrease_amount": ZERO,
            "receivable": line.created_receivable or line.receivable,
            "source_entity_type": "DebtAdjustmentVoucherLine",
            "source_entity_id": str(line.id),
        })

    # C. In-period Collections (ReceiptAllocation)
    alloc_period_qs = models.ReceiptAllocation.objects.filter(
        receivable__company=company,
        receivable__customer=customer,
        receivable__currency=currency,
        receivable__account=receivable_account,
        receipt__status__in=[models.ReceiptStatus.CONFIRMED, "POSTED"],
        receipt__receipt_date__gte=from_date,
        receipt__receipt_date__lte=to_date,
    ).select_related("receipt", "receivable").order_by("receipt__receipt_date")
    if branch:
        alloc_period_qs = alloc_period_qs.filter(receipt__branch=branch)

    for alloc in alloc_period_qs:
        doc_num = getattr(alloc.receipt, "number", None) or getattr(alloc.receipt, "external_reference", "RECEIPT")
        desc = getattr(alloc.receipt, "description", None) or f"Thu tiền thanh toán cho {alloc.receivable.code}"
        post_dt = getattr(alloc.receipt, "posting_date", None) or alloc.receipt.receipt_date
        transactions.append({
            "posting_date": post_dt,
            "document_date": alloc.receipt.receipt_date,
            "document_number": doc_num,
            "document_type": "RECEIPT",
            "description": desc,
            "increase_amount": ZERO,
            "decrease_amount": alloc.amount,
            "receivable": alloc.receivable,
            "source_entity_type": "ReceiptAllocation",
            "source_entity_id": str(alloc.id),
        })

    # D. In-period Netting Vouchers
    netting_period_qs = models.DebtNettingVoucherLine.objects.filter(
        voucher__company=company,
        voucher__customer=customer,
        voucher__currency=currency,
        voucher__receivable_account=receivable_account,
        voucher__status=models.DebtNettingVoucher.Status.POSTED,
        voucher__posting_date__gte=from_date,
        voucher__posting_date__lte=to_date,
    ).select_related("voucher", "receivable").order_by("voucher__posting_date", "voucher__number", "line_no")
    if branch:
        netting_period_qs = netting_period_qs.filter(voucher__branch=branch)

    for line in netting_period_qs:
        transactions.append({
            "posting_date": line.voucher.posting_date,
            "document_date": line.voucher.document_date,
            "document_number": line.voucher.number,
            "document_type": "DEBT_NETTING",
            "description": line.voucher.description or "Bù trừ công nợ",
            "increase_amount": ZERO,
            "decrease_amount": line.amount,
            "receivable": line.receivable,
            "source_entity_type": "DebtNettingVoucherLine",
            "source_entity_id": str(line.id),
        })

    # E. In-period Debt Adjustments (DECREASE)
    adj_dec_qs = models.DebtAdjustmentVoucherLine.objects.filter(
        voucher__company=company,
        voucher__customer=customer,
        voucher__currency=currency,
        voucher__receivable_account=receivable_account,
        voucher__status=models.DebtAdjustmentVoucher.Status.POSTED,
        voucher__adjustment_type=models.DebtAdjustmentVoucher.AdjustmentType.DECREASE,
        voucher__posting_date__gte=from_date,
        voucher__posting_date__lte=to_date,
    ).select_related("voucher", "receivable").order_by("voucher__posting_date", "voucher__number", "line_no")
    if branch:
        adj_dec_qs = adj_dec_qs.filter(voucher__branch=branch)

    for line in adj_dec_qs:
        transactions.append({
            "posting_date": line.voucher.posting_date,
            "document_date": line.voucher.document_date,
            "document_number": line.voucher.number,
            "document_type": "DEBT_ADJUSTMENT_DECREASE",
            "description": line.description or line.voucher.description or "Điều chỉnh giảm công nợ",
            "increase_amount": ZERO,
            "decrease_amount": line.amount,
            "receivable": line.receivable,
            "source_entity_type": "DebtAdjustmentVoucherLine",
            "source_entity_id": str(line.id),
        })

    # Sort transactions chronologically
    transactions.sort(key=lambda t: (t["posting_date"], t["document_number"]))

    # Calculate period totals & running balance
    period_increase = ZERO
    period_decrease = ZERO
    current_bal = opening_balance
    lines_data = []

    for idx, tx in enumerate(transactions, start=1):
        period_increase += tx["increase_amount"]
        period_decrease += tx["decrease_amount"]
        current_bal = current_bal + tx["increase_amount"] - tx["decrease_amount"]
        tx_item = dict(tx)
        tx_item["line_no"] = idx
        tx_item["running_balance"] = current_bal
        lines_data.append(tx_item)

    closing_balance = opening_balance + period_increase - period_decrease

    # 3. Unallocated Customer Receipts as of to_date (BR04, BR10)
    receipt_qs = models.Receipt.objects.filter(
        company=company,
        customer=customer,
        currency=currency,
        status__in=[models.ReceiptStatus.CONFIRMED, "POSTED"],
        receipt_date__lte=to_date,
    )
    if branch:
        receipt_qs = receipt_qs.filter(branch=branch)

    unallocated_receipts = ZERO
    for rc in receipt_qs:
        # Sum active allocations up to to_date
        alloc_sum = rc.allocations.filter(
            reversed_at__isnull=True,
        ).aggregate(tot=Sum("amount"))["tot"] or ZERO
        rem = rc.amount - alloc_sum
        if rem > ZERO:
            unallocated_receipts += rem

    return {
        "opening_balance": opening_balance,
        "period_increase": period_increase,
        "period_decrease": period_decrease,
        "closing_balance": closing_balance,
        "unallocated_receipts": unallocated_receipts,
        "lines": lines_data,
        "data_extracted_at": timezone.now(),
    }


def validate_reconciliation_data(attrs, instance=None):
    def val(name):
        if name in attrs:
            return attrs[name]
        if instance:
            return getattr(instance, name)
        return None

    company = val("company")
    _fail(company is not None, "company", "Doanh nghiệp là bắt buộc.")

    customer = val("customer")
    _fail(customer and customer.company_id == company.pk, "customer", "Khách hàng không thuộc doanh nghiệp.")
    _fail(customer.status == "ACTIVE", "customer", "Khách hàng không ở trạng thái hoạt động.")
    _fail(PartyRole.objects.filter(party=customer, role_type="CUSTOMER").exists(),
          "customer", "Đối tượng chưa có vai trò khách hàng.")

    currency = val("currency")
    _fail(currency and getattr(currency, "is_active", True), "currency", "Loại tiền không hợp lệ hoặc không hoạt động.")

    rec_account = val("receivable_account")
    _fail(rec_account and rec_account.company_id == company.pk and rec_account.status == AccountStatus.ACTIVE,
          "receivable_account", "Tài khoản phải thu không hợp lệ hoặc không hoạt động.")

    from_date = val("from_date")
    to_date = val("to_date")
    today = timezone.localdate()
    _fail(from_date is not None, "from_date", "Từ ngày là bắt buộc.")
    _fail(to_date is not None, "to_date", "Đến ngày là bắt buộc.")
    _fail(from_date <= to_date, "to_date", "Đến ngày không được trước Từ ngày.")
    _fail(to_date <= today, "to_date", "Đến ngày không được sau ngày hiện tại.")

    if instance and instance.status != models.CustomerDebtReconciliation.Status.DRAFT:
        raise ValidationError("Không thể sửa biên bản khi đã chuyển trạng thái hoặc gửi đi.")


@transaction.atomic
def save_reconciliation(data, instance=None, user=None):
    """
    Saves a draft customer debt reconciliation with extracted snapshot data (BR06, BR07).
    """
    lines_data = data.pop("lines", None)
    from iam.models import UserAccount
    if isinstance(user, UserAccount):
        user_account = user
    elif hasattr(user, "iam_account"):
        user_account = user.iam_account
    else:
        user_account = UserAccount.objects.first()

    company = data["company"]
    branch = data.get("branch")
    customer = data["customer"]
    currency = data["currency"]
    rec_account = data["receivable_account"]
    from_date = data["from_date"]
    to_date = data["to_date"]

    # Extract fresh data if not provided
    if lines_data is None:
        extracted = extract_reconciliation_data(
            company=company,
            customer=customer,
            from_date=from_date,
            to_date=to_date,
            currency=currency,
            receivable_account=rec_account,
            branch=branch,
        )
        data["opening_balance"] = extracted["opening_balance"]
        data["period_increase"] = extracted["period_increase"]
        data["period_decrease"] = extracted["period_decrease"]
        data["closing_balance"] = extracted["closing_balance"]
        data["unallocated_receipts"] = extracted["unallocated_receipts"]
        data["data_extracted_at"] = extracted["data_extracted_at"]
        lines_data = extracted["lines"]

    if instance is None:
        if not data.get("number"):
            data["number"] = generate_reconciliation_number(company, branch)
        if not data.get("statement_date"):
            data["statement_date"] = timezone.localdate()
        data["created_by"] = user_account
        recon = models.CustomerDebtReconciliation.objects.create(**data)
    else:
        if instance.status != models.CustomerDebtReconciliation.Status.DRAFT:
            raise ValidationError("Chỉ cho phép sửa biên bản ở trạng thái Nháp.")
        for k, v in data.items():
            setattr(instance, k, v)
        instance.save()
        recon = instance

    if lines_data is not None:
        recon.lines.all().delete()
        created_lines = []
        for idx, item in enumerate(lines_data, start=1):
            line = models.CustomerDebtReconciliationLine(
                reconciliation=recon,
                line_no=idx,
                posting_date=item["posting_date"],
                document_date=item.get("document_date"),
                document_number=item["document_number"],
                document_type=item.get("document_type", ""),
                description=item.get("description", ""),
                increase_amount=Decimal(str(item.get("increase_amount", 0))),
                decrease_amount=Decimal(str(item.get("decrease_amount", 0))),
                receivable=item.get("receivable"),
                running_balance=Decimal(str(item.get("running_balance", 0))),
                source_entity_type=item.get("source_entity_type", ""),
                source_entity_id=item.get("source_entity_id", ""),
            )
            created_lines.append(line)
        models.CustomerDebtReconciliationLine.objects.bulk_create(created_lines)

    return recon


@transaction.atomic
def refresh_reconciliation_data(reconciliation, user=None):
    """
    AF02 / BR07: Refreshes snapshot data when in DRAFT status.
    """
    if reconciliation.status != models.CustomerDebtReconciliation.Status.DRAFT:
        raise ValidationError("Chỉ được lấy lại số liệu khi biên bản ở trạng thái Nháp.")

    extracted = extract_reconciliation_data(
        company=reconciliation.company,
        customer=reconciliation.customer,
        from_date=reconciliation.from_date,
        to_date=reconciliation.to_date,
        currency=reconciliation.currency,
        receivable_account=reconciliation.receivable_account,
        branch=reconciliation.branch,
    )

    reconciliation.opening_balance = extracted["opening_balance"]
    reconciliation.period_increase = extracted["period_increase"]
    reconciliation.period_decrease = extracted["period_decrease"]
    reconciliation.closing_balance = extracted["closing_balance"]
    reconciliation.unallocated_receipts = extracted["unallocated_receipts"]
    reconciliation.data_extracted_at = extracted["data_extracted_at"]
    reconciliation.save(update_fields=(
        "opening_balance", "period_increase", "period_decrease",
        "closing_balance", "unallocated_receipts", "data_extracted_at", "updated_at"
    ))

    reconciliation.lines.all().delete()
    created_lines = []
    for idx, item in enumerate(extracted["lines"], start=1):
        line = models.CustomerDebtReconciliationLine(
            reconciliation=reconciliation,
            line_no=idx,
            posting_date=item["posting_date"],
            document_date=item.get("document_date"),
            document_number=item["document_number"],
            document_type=item.get("document_type", ""),
            description=item.get("description", ""),
            increase_amount=Decimal(str(item.get("increase_amount", 0))),
            decrease_amount=Decimal(str(item.get("decrease_amount", 0))),
            receivable=item.get("receivable"),
            running_balance=Decimal(str(item.get("running_balance", 0))),
            source_entity_type=item.get("source_entity_type", ""),
            source_entity_id=item.get("source_entity_id", ""),
        )
        created_lines.append(line)
    models.CustomerDebtReconciliationLine.objects.bulk_create(created_lines)

    return reconciliation


def record_sent(reconciliation, data, user_account=None):
    """
    Bước 6 / BR08: Records sending statement to customer, locks data and transitions to PENDING_RESPONSE.
    """
    if reconciliation.status != models.CustomerDebtReconciliation.Status.DRAFT:
        raise ValidationError("Chỉ biên bản ở trạng thái Nháp mới có thể ghi nhận đã gửi.")

    sent_channel = data.get("sent_channel", "").strip()
    _fail(sent_channel, "sent_channel", "Vui lòng nhập kênh gửi biên bản (EMAIL, BƯU ĐIỆN, TRỰC TIẾP...).")

    now = timezone.now()
    reconciliation.sent_at = data.get("sent_at") or now
    reconciliation.sent_channel = sent_channel
    reconciliation.sent_note = data.get("sent_note", "")
    reconciliation.sent_by = user_account
    reconciliation.status = models.CustomerDebtReconciliation.Status.PENDING_RESPONSE
    reconciliation.save(update_fields=("sent_at", "sent_channel", "sent_note", "sent_by", "status", "updated_at"))
    return reconciliation


def record_response(reconciliation, data, user_account=None):
    """
    Bước 7-8 / BR09-BR10 / EF05-EF06: Records customer confirmation, calculates differences,
    and transitions to MATCHED or DISCREPANCY.
    """
    if reconciliation.status not in {
        models.CustomerDebtReconciliation.Status.PENDING_RESPONSE,
        models.CustomerDebtReconciliation.Status.DRAFT,
    }:
        raise ValidationError("Chỉ biên bản Chờ phản hồi hoặc Nháp mới có thể ghi nhận phản hồi.")

    response_date = data.get("response_date")
    _fail(response_date, "response_date", "Ngày nhận phản hồi là bắt buộc.")

    confirmer_name = data.get("customer_confirmer_name", "").strip()
    _fail(confirmer_name, "customer_confirmer_name", "Họ tên người xác nhận phía khách hàng là bắt buộc.")

    _fail("customer_confirmed_balance" in data and data["customer_confirmed_balance"] is not None,
          "customer_confirmed_balance", "Số tiền phải thu khách hàng xác nhận là bắt buộc.")

    docs = data.get("confirmation_documents", [])
    _fail(bool(docs), "confirmation_documents", "Tài liệu xác nhận của khách hàng là bắt buộc.")

    confirmed_balance = Decimal(str(data["customer_confirmed_balance"]))
    confirmed_unallocated = Decimal(str(data.get("customer_confirmed_unallocated", 0)))

    # BR10: Calculate differences
    bal_diff = confirmed_balance - reconciliation.closing_balance
    unalloc_diff = confirmed_unallocated - reconciliation.unallocated_receipts

    diff_reason = data.get("difference_reason", "").strip()
    if bal_diff != ZERO or unalloc_diff != ZERO:
        _fail(diff_reason, "difference_reason", "Có chênh lệch số liệu: bắt buộc phải nhập nội dung và nguyên nhân chênh lệch.")
        target_status = models.CustomerDebtReconciliation.Status.DISCREPANCY
    else:
        target_status = models.CustomerDebtReconciliation.Status.MATCHED

    now = timezone.now()
    reconciliation.response_date = response_date
    reconciliation.customer_confirmer_name = confirmer_name
    reconciliation.customer_confirmed_balance = confirmed_balance
    reconciliation.customer_confirmed_unallocated = confirmed_unallocated
    reconciliation.balance_difference = bal_diff
    reconciliation.unallocated_difference = unalloc_diff
    reconciliation.response_comment = data.get("response_comment", "")
    reconciliation.difference_reason = diff_reason
    reconciliation.confirmation_documents = docs
    reconciliation.responded_by = user_account
    reconciliation.responded_at = now
    reconciliation.status = target_status
    reconciliation.save(update_fields=(
        "response_date", "customer_confirmer_name", "customer_confirmed_balance",
        "customer_confirmed_unallocated", "balance_difference", "unallocated_difference",
        "response_comment", "difference_reason", "confirmation_documents",
        "responded_by", "responded_at", "status", "updated_at"
    ))
    return reconciliation


@transaction.atomic
def re_reconcile(reconciliation, user_account=None):
    """
    AF06 / BR12: Creates a new reconciliation from an existing one, copying scope and linking predecessor.
    """
    new_data = {
        "company": reconciliation.company,
        "branch": reconciliation.branch,
        "statement_date": timezone.localdate(),
        "from_date": reconciliation.from_date,
        "to_date": timezone.localdate(),
        "customer": reconciliation.customer,
        "currency": reconciliation.currency,
        "receivable_account": reconciliation.receivable_account,
        "contact_person": reconciliation.contact_person,
        "contact_email": reconciliation.contact_email,
        "note": f"Đối chiếu lại sau biên bản số {reconciliation.number}",
        "previous_reconciliation": reconciliation,
    }
    user = type("U", (), {"iam_account": user_account})() if user_account else None
    return save_reconciliation(new_data, None, user)


def cancel_reconciliation(reconciliation, reason, user_account=None):
    """
    AF07: Cancels reconciliation statement with reason.
    """
    if reconciliation.status == models.CustomerDebtReconciliation.Status.CANCELLED:
        raise ValidationError("Biên bản đã bị hủy trước đó.")

    _fail(reason and reason.strip(), "reason", "Vui lòng nhập lý do hủy biên bản.")

    now = timezone.now()
    reconciliation.status = models.CustomerDebtReconciliation.Status.CANCELLED
    reconciliation.cancel_reason = reason.strip()
    reconciliation.cancelled_by = user_account
    reconciliation.cancelled_at = now
    reconciliation.save(update_fields=("status", "cancel_reason", "cancelled_by", "cancelled_at", "updated_at"))
    return reconciliation


def export_pdf_payload(reconciliation):
    """
    Bước 5: Formats structured data for PDF/printing preview.
    """
    lines = list(reconciliation.lines.all().order_by("line_no"))
    return {
        "statement_id": str(reconciliation.id),
        "number": reconciliation.number,
        "statement_date": reconciliation.statement_date.isoformat(),
        "from_date": reconciliation.from_date.isoformat(),
        "to_date": reconciliation.to_date.isoformat(),
        "company": {
            "name": reconciliation.company.name,
            "tax_code": getattr(reconciliation.company, "tax_code", ""),
            "address": getattr(reconciliation.company, "address", ""),
        },
        "customer": {
            "name": reconciliation.customer.name,
            "code": reconciliation.customer.code,
            "tax_code": getattr(reconciliation.customer, "tax_code", ""),
            "contact_person": reconciliation.contact_person,
            "contact_email": reconciliation.contact_email,
        },
        "currency_code": reconciliation.currency.code,
        "receivable_account_code": reconciliation.receivable_account.code,
        "opening_balance": str(reconciliation.opening_balance),
        "period_increase": str(reconciliation.period_increase),
        "period_decrease": str(reconciliation.period_decrease),
        "closing_balance": str(reconciliation.closing_balance),
        "unallocated_receipts": str(reconciliation.unallocated_receipts),
        "lines": [
            {
                "line_no": l.line_no,
                "posting_date": l.posting_date.isoformat(),
                "document_date": l.document_date.isoformat() if l.document_date else None,
                "document_number": l.document_number,
                "document_type": l.document_type,
                "description": l.description,
                "increase_amount": str(l.increase_amount),
                "decrease_amount": str(l.decrease_amount),
                "running_balance": str(l.running_balance),
            }
            for l in lines
        ],
        "confirmation": {
            "status": reconciliation.status,
            "response_date": reconciliation.response_date.isoformat() if reconciliation.response_date else None,
            "customer_confirmer_name": reconciliation.customer_confirmer_name,
            "customer_confirmed_balance": str(reconciliation.customer_confirmed_balance) if reconciliation.customer_confirmed_balance is not None else None,
            "customer_confirmed_unallocated": str(reconciliation.customer_confirmed_unallocated),
            "balance_difference": str(reconciliation.balance_difference),
            "unallocated_difference": str(reconciliation.unallocated_difference),
            "response_comment": reconciliation.response_comment,
            "difference_reason": reconciliation.difference_reason,
        },
    }
