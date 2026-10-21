"""Unmatched bank statement lines and posted vouchers for offline review."""

from decimal import Decimal
from uuid import UUID

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from . import models, period_reconciliation, reconciliation, services

ZERO = Decimal("0")


def rows(request):
    profile, start, end = period_reconciliation.context(request)
    lines = list(models.StatementLine.objects.select_related("statement", "currency").filter(
        statement__company=profile.company, statement__account=profile,
        transaction_date__gte=start, transaction_date__lte=end, deleted_at__isnull=True).order_by("transaction_date", "external_id"))
    vouchers = list(models.BankTransaction.objects.filter(
        company=profile.company, account=profile, status="POSTED", gl_status="POSTED",
        currency_id=profile.account.currency_id).select_related("currency").order_by("transaction_date", "number"))
    links = list(models.Reconciliation.objects.filter(company=profile.company,
        statement_line__statement__account=profile, cancelled_at__isnull=True).select_related("transaction", "statement_line"))
    line_links = {}
    voucher_links = {}
    for link in links:
        line_links.setdefault(link.statement_line_id, []).append(link)
        voucher_links.setdefault(link.transaction_id, []).append(link)
    line_matched = {line.pk: sum((link.matched_amount for link in line_links.get(line.pk, [])), ZERO) for line in lines}
    voucher_matched = {voucher.pk: sum((link.matched_amount for link in voucher_links.get(voucher.pk, [])), ZERO) for voucher in vouchers}
    reviews = {review.transaction_id: review for review in models.BankVoucherReview.objects.filter(transaction__account=profile)}
    result = []
    for line in lines:
        matched = line_matched[line.pk]
        remaining = line.amount - matched
        if remaining <= ZERO:
            continue
        active = line_links.get(line.pk, [])
        candidates = [voucher for voucher in vouchers if voucher.currency_id == line.currency_id and
            services.incoming(voucher) == (line.direction == "CREDIT") and voucher.amount > voucher_matched[voucher.pk]]
        cause = "Khớp một phần, còn chênh lệch số tiền" if matched else "Có chứng từ chưa ghép" if candidates else "Chưa có chứng từ kế toán"
        if line.tracking_status == "WAITING":
            cause = line.review_reason or cause
        duplicates = [other.external_id for other in lines if other.pk != line.pk and (
            line.reference and other.reference == line.reference or
            other.transaction_date == line.transaction_date and other.direction == line.direction and
            other.amount == line.amount and other.description == line.description)]
        result.append({"kind": "STATEMENT", "id": str(line.pk), "date": str(line.transaction_date),
            "code": line.external_id, "reference": line.reference, "description": line.description,
            "counterparty": line.counterparty, "account": str(profile.pk),
            "account_number": profile.account.account_number, "direction": line.direction,
            "amount": str(line.amount), "matched_amount": str(matched), "remaining_amount": str(remaining),
            "currency": line.currency.code, "linked_vouchers": [link.transaction.number for link in active],
            "cause": cause, "processing_status": "WAITING" if line.tracking_status == "WAITING" else line.match_status,
            "reason": line.review_reason, "note": line.processing_note,
            "updated_at": line.updated_at.isoformat() if line.updated_at else None,
            "updated_by": str(line.updated_by_id) if line.updated_by_id else None,
            "duplicate_count": len(duplicates), "duplicates": duplicates, "candidate_count": len(candidates),
            "period_confirmed": reconciliation.period_confirmed(line)})
    for voucher in vouchers:
        date = period_reconciliation.posting_date(voucher)
        if not start <= date <= end:
            continue
        matched = voucher_matched[voucher.pk]
        remaining = voucher.amount - matched
        if remaining <= ZERO:
            continue
        active = voucher_links.get(voucher.pk, [])
        review = reviews.get(voucher.pk)
        direction = "CREDIT" if services.incoming(voucher) else "DEBIT"
        nearby = [line for line in lines if line.amount > line_matched[line.pk] and line.direction == direction and line.currency_id == voucher.currency_id and
                  (line.amount == voucher.amount or voucher.bank_reference and line.reference == voucher.bank_reference)]
        duplicates = [other.number for other in vouchers if other.pk != voucher.pk and (
            voucher.bank_reference and other.bank_reference == voucher.bank_reference or
            other.transaction_date == voucher.transaction_date and other.transaction_type == voucher.transaction_type and
            other.amount == voucher.amount and other.description == voucher.description)]
        cause = "Khớp một phần, còn chênh lệch số tiền" if matched else "Có giao dịch sao kê chưa ghép" if nearby else "Chưa có giao dịch trên sao kê"
        result.append({"kind": "VOUCHER", "id": str(voucher.pk), "date": str(date),
            "code": voucher.number, "reference": voucher.bank_reference, "description": voucher.description,
            "counterparty": voucher.counterparty_name, "account": str(profile.pk),
            "account_number": profile.account.account_number, "direction": direction,
            "amount": str(voucher.amount), "matched_amount": str(matched), "remaining_amount": str(remaining),
            "currency": voucher.currency.code, "linked_vouchers": [link.statement_line.external_id for link in active],
            "cause": review.reason if review else cause,
            "processing_status": "WAITING" if review else "PARTIALLY_MATCHED" if matched else "UNMATCHED",
            "reason": review.reason if review else "", "note": review.note if review else "",
            "updated_at": review.updated_at.isoformat() if review else None,
            "updated_by": str(review.updated_by_id) if review else None,
            "duplicate_count": len(duplicates), "duplicates": duplicates,
            "candidate_count": len(nearby), "period_confirmed": False})
    return {"account": str(profile.pk), "date_from": str(start), "date_to": str(end),
            "has_statement": bool(lines), "items": sorted(result, key=lambda row: (row["date"], row["kind"], row["code"]))}


@transaction.atomic
def set_waiting(request):
    kind, item_id = request.data.get("kind"), request.data.get("id")
    try:
        UUID(str(item_id))
    except (TypeError, ValueError):
        raise ValidationError("Giao dịch không hợp lệ.")
    reason = str(request.data.get("reason") or "").strip()
    note = str(request.data.get("note") or "").strip()
    if not reason or len(reason) > 500:
        raise ValidationError({"reason": "Vui lòng nhập lý do chờ xử lý (tối đa 500 ký tự)."})
    company = request.query_params.get("company_id")
    branch = request.query_params.get("branch_id")
    if kind == "STATEMENT":
        line = models.StatementLine.objects.select_for_update().select_related("statement__account__account").filter(
            pk=item_id, statement__company_id=company, deleted_at__isnull=True).first()
        if not line:
            raise ValidationError("Giao dịch sao kê không tồn tại.")
        if branch and str(line.statement.account.account.branch_id) != branch:
            raise ValidationError("Bạn không có quyền truy cập tài khoản ngân hàng này.")
        if reconciliation.period_confirmed(line) or reconciliation.matched_for_line(line.pk) == line.amount:
            raise ValidationError("Giao dịch đã đối chiếu hoàn tất.")
        line.tracking_status = "WAITING"
        line.review_reason = reason
        line.processing_note = note
        line.updated_by = services.actor(request)
        line.updated_at = timezone.now()
        line.save(update_fields=("tracking_status", "review_reason", "processing_note", "updated_by", "updated_at"))
        target = line.statement
    elif kind == "VOUCHER":
        voucher = models.BankTransaction.objects.select_for_update().select_related("account__account").filter(
            pk=item_id, company_id=company, status="POSTED", gl_status="POSTED").first()
        if not voucher:
            raise ValidationError("Chứng từ không tồn tại hoặc chưa ghi sổ.")
        if branch and str(voucher.account.account.branch_id) != branch:
            raise ValidationError("Bạn không có quyền truy cập tài khoản ngân hàng này.")
        if reconciliation.matched_for_transaction(voucher.pk) == voucher.amount:
            raise ValidationError("Chứng từ đã đối chiếu hoàn tất.")
        models.BankVoucherReview.objects.update_or_create(transaction=voucher, defaults={
            "status": "WAITING", "reason": reason, "note": note, "updated_by": services.actor(request)})
        target = voucher
    else:
        raise ValidationError("Loại giao dịch không hợp lệ.")
    services.audit(request, target, "UNMATCHED_WAIT", after={"kind": kind, "id": str(item_id), "reason": reason, "note": note})
    return {"kind": kind, "id": str(item_id), "processing_status": "WAITING"}
