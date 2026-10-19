"""Prepaid expenses (TK 242): register items, allocate them period by period, write off the remainder."""
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from . import models
from .services import actor, audit, post

CENT = Decimal("1")


def _account(company, account_id, label):
    account = models.Account.objects.filter(pk=account_id, company=company, status="ACTIVE", is_postable=True).first()
    if not account:
        raise ValidationError({label: "Tài khoản không tồn tại, ngừng sử dụng hoặc không phải tài khoản chi tiết."})
    return account


@transaction.atomic
def create_prepaid(company, data, request):
    amount = Decimal(str(data.get("amount") or 0))
    periods = int(data.get("allocation_periods") or 0)
    opening_amount = Decimal(str(data.get("opening_allocated_amount") or 0))
    opening_periods = int(data.get("opening_allocated_periods") or 0)
    if amount <= 0 or periods <= 0:
        raise ValidationError("Số tiền và số kỳ phân bổ phải lớn hơn 0.")
    if opening_amount < 0 or opening_amount > amount or opening_periods > periods:
        raise ValidationError("Số đã phân bổ đầu kỳ không hợp lệ.")
    code = str(data.get("code") or "").strip()
    if not code or models.PrepaidExpense.objects.filter(company=company, code=code).exists():
        raise ValidationError({"code": "Mã chi phí trả trước trống hoặc đã tồn tại."})
    targets = data.get("targets") or []
    if not targets:
        raise ValidationError({"targets": "Cần ít nhất một tài khoản chi phí nhận phân bổ."})
    if sum((Decimal(str(row.get("rate") or 0)) for row in targets), Decimal("0")) != Decimal("100"):
        raise ValidationError({"targets": "Tổng tỷ lệ phân bổ phải bằng 100%."})
    prepaid = models.PrepaidExpense.objects.create(
        company=company, code=code, name=str(data.get("name") or "").strip() or code,
        record_date=data["record_date"], start_date=data.get("start_date") or data["record_date"],
        amount=amount, allocation_periods=periods,
        prepaid_account=_account(company, data.get("prepaid_account"), "prepaid_account"),
        is_opening=bool(data.get("is_opening")), opening_allocated_amount=opening_amount,
        opening_allocated_periods=opening_periods,
        status=models.PrepaidExpense.Status.STOPPED if data.get("stop_allocation") else models.PrepaidExpense.Status.ACTIVE,
        created_by=actor(request),
    )
    for index, row in enumerate(targets, start=1):
        models.PrepaidExpenseTarget.objects.create(
            prepaid=prepaid, line_no=index, rate=Decimal(str(row["rate"])),
            expense_account=_account(company, row.get("expense_account"), "targets"),
            description=str(row.get("description") or "")[:255],
        )
    audit(request, prepaid, "CREATE", after={"code": prepaid.code, "amount": str(amount), "periods": periods})
    return prepaid


def period_amount(prepaid):
    """Equal instalments over the remaining periods; the last one takes the rounding difference."""
    remaining = prepaid.remaining_amount
    if remaining <= 0 or prepaid.remaining_periods == 0:
        return Decimal("0")
    if prepaid.remaining_periods == 1:
        return remaining
    return min(remaining, (remaining / prepaid.remaining_periods).quantize(CENT, rounding=ROUND_HALF_UP))


def _split(prepaid, amount):
    targets = list(prepaid.targets.select_related("expense_account"))
    rows, used = [], Decimal("0")
    for index, target in enumerate(targets):
        value = amount - used if index == len(targets) - 1 else (amount * target.rate / 100).quantize(CENT, rounding=ROUND_HALF_UP)
        used += value
        if value:
            rows.append((target.expense_account, value))
    return rows


def allocation_preview(company, period):
    rows = []
    for prepaid in models.PrepaidExpense.objects.filter(
        company=company, status=models.PrepaidExpense.Status.ACTIVE, start_date__lte=period.end_date,
    ).prefetch_related("targets__expense_account").order_by("code"):
        if prepaid.allocation_lines.filter(allocation__period=period, allocation__kind="ALLOCATION").exists():
            continue
        amount = period_amount(prepaid)
        if amount > 0:
            rows.append({"prepaid": prepaid, "amount": amount, "split": _split(prepaid, amount)})
    return rows


def _journal(company, period, number, posting_date, description, lines, request):
    total = sum((line[2] for line in lines), Decimal("0"))
    entry = models.JournalEntry.objects.create(
        company=company, period=period, number=f"{number}-GL", entry_type="ALLOCATION",
        posting_date=posting_date, document_date=posting_date, description=description, source_module="GL",
        source_event_id=f"GL.PREPAID:{number}:{timezone.now().timestamp()}", status="APPROVED",
        total_debit=total, total_credit=total, created_by=actor(request), approved_by=actor(request),
        approved_at=timezone.now(), workflow_snapshot={"allow_creator_posting": True},
    )
    for line_no, (debit_account, credit_account, amount, text) in enumerate(lines, start=1):
        models.JournalLine.objects.create(entry=entry, line_no=line_no * 2 - 1, account=debit_account, debit=amount,
            currency=company.accounting_currency, description=text)
        models.JournalLine.objects.create(entry=entry, line_no=line_no * 2, account=credit_account, credit=amount,
            currency=company.accounting_currency, description=text)
    post(entry, request)
    return entry


def _period_for(company, posting_date):
    period = models.AccountingPeriod.objects.filter(company=company, start_date__lte=posting_date, end_date__gte=posting_date).first()
    if not period or period.status != "OPEN":
        raise ValidationError({"posting_date": "Ngày hạch toán không thuộc kỳ kế toán đang mở."})
    return period


def _unique_number(company, number, prefix):
    number = str(number or "").strip()
    if number and not models.PrepaidAllocation.objects.filter(company=company, number=number).exists():
        return number
    count = models.PrepaidAllocation.objects.filter(company=company, number__startswith=prefix).count()
    while models.PrepaidAllocation.objects.filter(company=company, number=f"{prefix}{count + 1:05d}").exists():
        count += 1
    return f"{prefix}{count + 1:05d}"


@transaction.atomic
def allocate(company, data, request):
    posting_date = data["posting_date"]
    period = _period_for(company, posting_date)
    rows = allocation_preview(company, period)
    if not rows:
        raise ValidationError("Kỳ này không còn khoản chi phí trả trước nào cần phân bổ.")
    number = _unique_number(company, data.get("number"), "PBCP")
    description = str(data.get("description") or f"Phân bổ chi phí trả trước kỳ {period.code}")[:500]
    journal_lines = [
        (account, row["prepaid"].prepaid_account, value, f"Phân bổ {row['prepaid'].code} - {row['prepaid'].name}"[:500])
        for row in rows for account, value in row["split"]
    ]
    entry = _journal(company, period, number, posting_date, description, journal_lines, request)
    allocation = models.PrepaidAllocation.objects.create(
        company=company, kind="ALLOCATION", number=number, period=period, posting_date=posting_date,
        document_date=data.get("document_date") or posting_date, description=description,
        total_amount=sum((row["amount"] for row in rows), Decimal("0")), entry=entry, created_by=actor(request),
    )
    for row in rows:
        prepaid = models.PrepaidExpense.objects.select_for_update().get(pk=row["prepaid"].pk)
        for account, value in row["split"]:
            models.PrepaidAllocationLine.objects.create(allocation=allocation, prepaid=prepaid, expense_account=account, amount=value)
        prepaid.allocated_amount += row["amount"]
        prepaid.allocated_periods += 1
        if prepaid.remaining_amount <= 0:
            prepaid.status = models.PrepaidExpense.Status.COMPLETED
        prepaid.save(update_fields=("allocated_amount", "allocated_periods", "status", "updated_at"))
    audit(request, allocation, "ALLOCATE", after={"number": number, "total": str(allocation.total_amount)})
    return allocation


@transaction.atomic
def decrease(company, data, request):
    """Write off the remaining amount of the chosen items to their expense accounts and stop allocating them."""
    posting_date = data["document_date"]
    period = _period_for(company, posting_date)
    ids = [row.get("prepaid") for row in data.get("lines") or []]
    items = list(models.PrepaidExpense.objects.select_for_update().filter(company=company, pk__in=ids)
                 .prefetch_related("targets__expense_account"))
    if not items or len(items) != len(set(ids)):
        raise ValidationError({"lines": "Chọn ít nhất một khoản chi phí trả trước hợp lệ."})
    lines, journal_lines = [], []
    for prepaid in items:
        if prepaid.status in (models.PrepaidExpense.Status.DECREASED, models.PrepaidExpense.Status.COMPLETED) or prepaid.remaining_amount <= 0:
            raise ValidationError({"lines": f"Khoản {prepaid.code} không còn số tiền để ghi giảm."})
        for account, value in _split(prepaid, prepaid.remaining_amount):
            lines.append((prepaid, account, value))
            journal_lines.append((account, prepaid.prepaid_account, value, f"Ghi giảm {prepaid.code} - {prepaid.name}"[:500]))
    number = _unique_number(company, data.get("number"), "GGCP")
    reason = str(data.get("reason") or "Ghi giảm chi phí trả trước")[:500]
    entry = _journal(company, period, number, posting_date, reason, journal_lines, request)
    allocation = models.PrepaidAllocation.objects.create(
        company=company, kind="DECREASE", number=number, period=period, posting_date=posting_date,
        document_date=posting_date, description=reason, total_amount=sum((line[2] for line in lines), Decimal("0")),
        entry=entry, created_by=actor(request),
    )
    for prepaid, account, value in lines:
        models.PrepaidAllocationLine.objects.create(allocation=allocation, prepaid=prepaid, expense_account=account, amount=value)
        prepaid.allocated_amount += value
    for prepaid in items:
        prepaid.status = models.PrepaidExpense.Status.DECREASED
        prepaid.save(update_fields=("allocated_amount", "status", "updated_at"))
    audit(request, allocation, "DECREASE", after={"number": number, "total": str(allocation.total_amount)})
    return allocation
