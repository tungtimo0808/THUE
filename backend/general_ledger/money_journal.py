"""Journal of a posted cash / bank voucher: the money account against the counter accounts entered on the voucher."""
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Account, AccountingPeriod, JournalEntry, JournalLine


def _amount(value):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({"lines": "Số tiền dòng hạch toán không hợp lệ."})
    if amount <= 0:
        raise ValidationError({"lines": "Số tiền dòng hạch toán phải lớn hơn 0."})
    return amount


def _counter_dimensions(account, raw):
    """A counter account kept per bank account (1121…) takes the chosen one, else the one booked on it."""
    if (account.dimension_requirements or {}).get("BANK_ACCOUNT") != "REQUIRED":
        return {}
    from master_data.models import CompanyBankAccount
    bank = raw.get("bank_account") or CompanyBankAccount.objects.filter(
        company=account.company, gl_account=account, status="ACTIVE",
    ).values_list("id", flat=True).first()
    if not bank:
        raise ValidationError({"lines": f"Tài khoản {account.code} cần chọn tài khoản ngân hàng."})
    return {"bank_account_id": str(bank)}


def journalize(tx, request, *, module, money_account, incoming, branch, counterpart_name, lines, money_dimensions=None, posting_date=None):
    """Create and post the journal of ``tx``.

    ``lines`` are ``{"account": <counter account id>, "amount": ..., "description": ...}``; the money
    account takes the other side. The lines must add up to the voucher amount.
    """
    if not lines:
        raise ValidationError({"lines": "Chứng từ chưa có dòng hạch toán."})
    rows = []
    for raw in lines:
        account = Account.objects.filter(company=tx.company, pk=raw.get("account"), status="ACTIVE", is_postable=True).first()
        if account is None:
            raise ValidationError({"lines": "Tài khoản đối ứng không hợp lệ hoặc không phải tài khoản chi tiết."})
        dimensions = {**(raw.get("dimensions") or {}), **_counter_dimensions(account, raw)}
        rows.append((account, _amount(raw.get("amount")), str(raw.get("description") or tx.description)[:500], dimensions))
    total = sum((row[1] for row in rows), Decimal("0"))
    if total != tx.amount:
        raise ValidationError({"lines": f"Tổng các dòng hạch toán ({total:,.0f}) phải bằng số tiền chứng từ ({tx.amount:,.0f})."})
    posting_date = posting_date or tx.transaction_date
    period = AccountingPeriod.objects.filter(
        company=tx.company, start_date__lte=posting_date, end_date__gte=posting_date, status="OPEN",
    ).first()
    if not period:
        raise ValidationError({"transaction_date": "Không có kỳ kế toán đang mở cho ngày chứng từ."})
    now, user = timezone.now(), request.user.iam_account
    rate = tx.exchange_rate or Decimal("1")
    entry = JournalEntry.objects.create(
        company=tx.company, branch=branch, period=period, number=f"GL-{tx.number}", entry_type="SUBLEDGER",
        posting_date=posting_date, document_date=tx.transaction_date,
        description=f"{tx.description} - {counterpart_name}".strip(" -")[:500], source_module=module,
        source_event_id=f"{module}_TX:{tx.id}", source_entity_type=type(tx).__name__, source_entity_id=tx.id,
        status="APPROVED", workflow_snapshot={"allow_creator_posting": True},
        total_debit=total * rate, total_credit=total * rate,
        created_by=user, approved_by=user, approved_at=now,
    )
    line_no = 1
    for account, amount, description, dimensions in rows:
        money_side = {"debit": amount * rate} if incoming else {"credit": amount * rate}
        counter_side = {"credit": amount * rate} if incoming else {"debit": amount * rate}
        common = {"currency": tx.currency, "foreign_amount": amount, "exchange_rate": rate, "description": description}
        JournalLine.objects.create(entry=entry, line_no=line_no, account=money_account, **money_side, **common,
                                   party=tx.party if money_account.requires_party else None, dimensions=money_dimensions or {})
        JournalLine.objects.create(entry=entry, line_no=line_no + 1, account=account, **counter_side, **common, party=tx.party, dimensions=dimensions)
        line_no += 2
    from .services import post
    post(entry, request)
    return entry
