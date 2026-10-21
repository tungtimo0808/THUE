"""Confirmed offline reconciliation against posted bank vouchers."""

from decimal import Decimal, InvalidOperation
from uuid import UUID

from django.db import transaction
from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

from . import models, services

ZERO = Decimal("0")


def posting_date(voucher):
    return parse_date(str((voucher.payment_details or {}).get("posting_date") or "")) or voucher.transaction_date


def context(request):
    company_id = request.query_params.get("company_id")
    account_id = request.query_params.get("account") or request.data.get("account")
    try:
        UUID(str(company_id))
        UUID(str(account_id))
    except (TypeError, ValueError):
        raise ValidationError("Vui lòng chọn tài khoản ngân hàng.")
    profile = models.AccountProfile.objects.select_related("account").filter(
        pk=account_id, company_id=company_id).first()
    if not profile:
        raise ValidationError("Tài khoản ngân hàng không thuộc doanh nghiệp đang làm việc.")
    branch = request.query_params.get("branch_id")
    if branch and str(profile.account.branch_id) != branch:
        raise ValidationError("Bạn không có quyền truy cập tài khoản ngân hàng này.")
    start = parse_date(str(request.query_params.get("date_from") or request.data.get("date_from") or ""))
    end = parse_date(str(request.query_params.get("date_to") or request.data.get("date_to") or ""))
    if not start or not end or start > end:
        raise ValidationError("Vui lòng chọn khoảng ngày hợp lệ.")
    return profile, start, end


def snapshot(profile, start, end):
    """Derive opening balance by reversing booked account movements from today."""
    vouchers = list(models.BankTransaction.objects.filter(
        account=profile, company=profile.company, status="POSTED", balance_applied=True))
    opening = profile.balance
    for voucher in vouchers:
        if posting_date(voucher) >= start:
            opening -= voucher.amount if services.incoming(voucher) else -voucher.amount
    incoming = models.BankTransfer.objects.filter(destination_account=profile, status="CONFIRMED")
    outgoing = models.BankTransfer.objects.filter(source_account=profile, status="CONFIRMED")
    for transfer in incoming:
        if (transfer.posting_date or transfer.transfer_date) >= start:
            opening -= transfer.destination_amount
    for transfer in outgoing:
        if (transfer.posting_date or transfer.transfer_date) >= start:
            opening += transfer.source_amount
    confirmed = set(models.BankReconciliationItem.objects.filter(
        transaction__account=profile).values_list("transaction_id", flat=True))
    active_links = models.Reconciliation.objects.filter(
        statement_line__statement__account=profile, cancelled_at__isnull=True).values(
            "statement_line_id", "transaction_id", "matched_amount")
    line_matched = {}
    voucher_matched = {}
    for link in active_links:
        line_id, voucher_id, value = link["statement_line_id"], link["transaction_id"], link["matched_amount"]
        line_matched[line_id] = line_matched.get(line_id, ZERO) + value
        voucher_matched[voucher_id] = voucher_matched.get(voucher_id, ZERO) + value
    rows = []
    for voucher in vouchers:
        date = posting_date(voucher)
        if not start <= date <= end or voucher.gl_status != "POSTED" or voucher.currency_id != profile.account.currency_id:
            continue
        rows.append({"id": str(voucher.pk), "date": date.isoformat(), "number": voucher.number,
                     "amount": str(voucher.amount), "direction": "RECEIPT" if services.incoming(voucher) else "PAYMENT",
                     "counterparty": voucher.counterparty_name, "confirmed": voucher.pk in confirmed})
    rows.sort(key=lambda row: (row["date"], row["number"], row["id"]))
    latest = models.BankReconciliationPeriod.objects.filter(account=profile).order_by("-period_to").first()
    lines = list(models.StatementLine.objects.filter(statement__account=profile,
        transaction_date__gte=start, transaction_date__lte=end, deleted_at__isnull=True))
    unmatched_count = sum(line_matched.get(line.pk, ZERO) != line.amount or line.tracking_status == "WAITING" for line in lines)
    unmatched_count += sum(voucher_matched.get(UUID(row["id"]), ZERO) != Decimal(row["amount"])
        for row in rows if not row["confirmed"])
    return {"account": str(profile.pk), "date_from": start.isoformat(), "date_to": end.isoformat(),
            "opening_balance": str(opening), "currency": profile.account.currency.code,
            "last_confirmed_date": latest.period_to.isoformat() if latest else None,
            "has_statement": bool(lines), "unmatched_count": unmatched_count, "transactions": rows}


def amount(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError("Số dư cuối kỳ trên sổ ngân hàng không hợp lệ.")
    if not result.is_finite() or result.as_tuple().exponent < -4:
        raise ValidationError("Số dư cuối kỳ trên sổ ngân hàng không hợp lệ.")
    return result


@transaction.atomic
def confirm(request):
    profile, start, end = context(request)
    profile = models.AccountProfile.objects.select_for_update().get(pk=profile.pk)
    if models.BankReconciliationPeriod.objects.filter(
        account=profile, period_from__lte=end, period_to__gte=start).exists():
        raise ValidationError("Khoảng ngày này đã có kỳ đối chiếu được xác nhận.")
    selected = request.data.get("transactions")
    if not isinstance(selected, list) or not selected or len(selected) > 1000:
        raise ValidationError("Vui lòng chọn ít nhất một chứng từ hợp lệ.")
    try:
        ids = [UUID(str(value)) for value in selected]
    except (TypeError, ValueError):
        raise ValidationError("Danh sách chứng từ không hợp lệ.")
    if len(set(ids)) != len(ids):
        raise ValidationError("Danh sách chứng từ bị lặp.")
    data = snapshot(profile, start, end)
    eligible = {row["id"]: row for row in data["transactions"] if not row["confirmed"]}
    if any(str(pk) not in eligible for pk in ids):
        raise ValidationError("Chứng từ không thuộc tài khoản, kỳ đối chiếu hoặc đã được xác nhận.")
    if not data["has_statement"]:
        raise ValidationError("Chưa có dữ liệu sao kê ngân hàng trong kỳ đối chiếu.")
    if data["unmatched_count"]:
        raise ValidationError("Còn giao dịch hoặc chứng từ chưa khớp; vui lòng xử lý trước khi xác nhận kỳ.")
    receipt = sum((Decimal(eligible[str(pk)]["amount"]) for pk in ids if eligible[str(pk)]["direction"] == "RECEIPT"), ZERO)
    payment = sum((Decimal(eligible[str(pk)]["amount"]) for pk in ids if eligible[str(pk)]["direction"] == "PAYMENT"), ZERO)
    opening = Decimal(data["opening_balance"])
    closing = opening + receipt - payment
    bank_closing = amount(request.data.get("bank_closing_balance"))
    if closing != bank_closing:
        raise ValidationError("Số dư sau đối chiếu và sổ ngân hàng chưa khớp.")
    period = models.BankReconciliationPeriod.objects.create(
        company=profile.company, account=profile, period_from=start, period_to=end,
        opening_balance=opening, receipt_total=receipt, payment_total=payment,
        closing_balance=closing, bank_closing_balance=bank_closing,
        confirmed_by=services.actor(request))
    models.BankReconciliationItem.objects.bulk_create([
        models.BankReconciliationItem(period=period, transaction_id=pk,
            amount=Decimal(eligible[str(pk)]["amount"]), direction=eligible[str(pk)]["direction"])
        for pk in ids])
    services.audit(request, period, "RECONCILIATION_CONFIRM", after={
        "account": str(profile.pk), "date_from": str(start), "date_to": str(end),
        "transactions": [str(pk) for pk in ids], "closing_balance": str(closing)})
    return period
