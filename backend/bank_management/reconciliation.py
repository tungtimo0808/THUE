"""Allocations between imported bank lines and posted bank vouchers."""

from decimal import Decimal, InvalidOperation
from uuid import UUID

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

from . import models, services


ZERO = Decimal("0")


def period_confirmed(line):
    return bool(line.statement.reconciliation_confirmed_at) or models.BankReconciliationPeriod.objects.filter(
        account_id=line.statement.account_id, period_from__lte=line.transaction_date,
        period_to__gte=line.transaction_date).exists()


def amount(value):
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError("Số tiền ghép phải lớn hơn 0.")
    if not parsed.is_finite() or parsed <= ZERO or parsed.as_tuple().exponent < -4:
        raise ValidationError("Số tiền ghép phải lớn hơn 0 và có tối đa 4 chữ số thập phân.")
    return parsed


def expected_amount(value):
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError("Số tiền còn được ghép không hợp lệ.")
    if not parsed.is_finite() or parsed < ZERO:
        raise ValidationError("Số tiền còn được ghép không hợp lệ.")
    return parsed


def matched_for_line(line_id):
    return models.Reconciliation.objects.filter(statement_line_id=line_id, cancelled_at__isnull=True).aggregate(total=Sum("matched_amount"))["total"] or ZERO


def matched_for_transaction(transaction_id):
    return models.Reconciliation.objects.filter(transaction_id=transaction_id, cancelled_at__isnull=True).aggregate(total=Sum("matched_amount"))["total"] or ZERO


def line_status(line):
    total = matched_for_line(line.pk)
    line.match_status = "UNMATCHED" if total == ZERO else "MATCHED" if total == line.amount else "PARTIALLY_MATCHED"
    line.save(update_fields=("match_status",))
    models.Reconciliation.objects.filter(statement_line=line,cancelled_at__isnull=True).update(
        status=line.match_status,variance=line.amount-total)
    return total


def candidates(line, keyword=""):
    """Eligible vouchers ranked by reference, party, amount, then date proximity."""
    if line.deleted_at or period_confirmed(line):
        return []
    allowed = ("RECEIPT", "INTEREST", "OTHER_IN") if line.direction == "CREDIT" else ("PAYMENT", "FEE", "OTHER_OUT")
    queryset = models.BankTransaction.objects.filter(
        company_id=line.statement.company_id, account_id=line.statement.account_id,
        currency_id=line.currency_id, transaction_type__in=allowed,
        status="POSTED", gl_status="POSTED",
    )
    word = keyword.casefold().strip()
    result = []
    for voucher in queryset:
        remaining = voucher.amount - matched_for_transaction(voucher.pk)
        if remaining <= ZERO:
            continue
        if word and not any(word in str(value or "").casefold() for value in
                            (voucher.number, voucher.counterparty_name, voucher.description, voucher.bank_reference)):
            continue
        score = 0
        if line.reference and line.reference.casefold() in (voucher.bank_reference or "").casefold():
            score += 100
        if voucher.amount == line.amount:
            score += 50
        if line.counterparty and line.counterparty.casefold() in voucher.counterparty_name.casefold():
            score += 25
        posting_date = parse_date(str(voucher.payment_details.get("posting_date") or "")) or voucher.transaction_date
        date_gap = abs((posting_date - line.transaction_date).days)
        score += max(0, 20 - date_gap)
        result.append({"id": str(voucher.pk), "number": voucher.number,
                       "transaction_date": posting_date.isoformat(),
                       "transaction_type": voucher.transaction_type,
                       "counterparty_name": voucher.counterparty_name,
                       "description": voucher.description,
                       "bank_reference": voucher.bank_reference,
                       "amount": str(voucher.amount), "remaining_amount": str(remaining),
                       "currency": str(voucher.currency_id), "gl_status": voucher.gl_status,
                       "score": score})
    return sorted(result, key=lambda row: (-row["score"], row["transaction_date"], row["number"]))


@transaction.atomic
def match_many(line_id, allocations, request, expected_line_remaining=None):
    if not isinstance(allocations, list) or not allocations:
        raise ValidationError({"allocations": "Vui lòng chọn ít nhất một chứng từ."})
    if len(allocations) > 100:
        raise ValidationError({"allocations": "Một lần chỉ ghép tối đa 100 chứng từ."})
    try:UUID(str(line_id))
    except (ValueError,TypeError):raise ValidationError("Giao dịch sao kê không tồn tại.")
    try:
        line = models.StatementLine.objects.select_related("statement").select_for_update().get(pk=line_id)
    except (models.StatementLine.DoesNotExist, ValueError, TypeError):
        raise ValidationError("Giao dịch sao kê không tồn tại.")
    if str(line.statement.company_id) != str(request.query_params.get("company_id")):
        raise ValidationError("Giao dịch không thuộc doanh nghiệp đang làm việc.")
    if line.deleted_at:
        raise ValidationError("Giao dịch sao kê đã bị xóa.")
    if period_confirmed(line):
        raise ValidationError("Không thể thay đổi liên kết thuộc kỳ đối chiếu đã xác nhận.")
    if request.query_params.get("branch_id") and str(line.statement.account.account.branch_id) != request.query_params["branch_id"]:
        raise ValidationError("Bạn không có quyền truy cập tài khoản ngân hàng này.")
    ids = [str(item.get("transaction", "")) for item in allocations if isinstance(item, dict)]
    if len(ids) != len(allocations) or not all(ids) or len(set(ids)) != len(ids):
        raise ValidationError({"allocations": "Danh sách chứng từ không hợp lệ hoặc bị lặp."})
    try:
        for value in ids:UUID(value)
    except (ValueError,TypeError):raise ValidationError("Chứng từ không tồn tại.")
    vouchers = {str(voucher.pk): voucher for voucher in models.BankTransaction.objects.select_for_update().filter(pk__in=ids).order_by("pk")}
    if len(vouchers) != len(ids):
        raise ValidationError("Chứng từ không tồn tại.")
    line_remaining = line.amount - matched_for_line(line.pk)
    if expected_line_remaining is not None and expected_amount(expected_line_remaining) != line_remaining:
        raise ValidationError("Dữ liệu đã thay đổi. Vui lòng tải lại trước khi tiếp tục.")
    if line_remaining <= ZERO:
        raise ValidationError("Giao dịch đã được đối chiếu hết số tiền.")
    requested = ZERO
    normalized = []
    for item in allocations:
        voucher = vouchers[str(item["transaction"])]
        if voucher.company_id != line.statement.company_id or voucher.account_id != line.statement.account_id:
            raise ValidationError("Tài khoản ngân hàng của giao dịch và chứng từ không khớp.")
        if voucher.currency_id != line.currency_id:
            raise ValidationError("Loại tiền của giao dịch và chứng từ không phù hợp.")
        if voucher.status != "POSTED" or voucher.gl_status != "POSTED":
            raise ValidationError("Chỉ được ghép với chứng từ đã ghi sổ và còn hiệu lực.")
        if line.direction != ("CREDIT" if services.incoming(voucher) else "DEBIT"):
            raise ValidationError("Loại giao dịch và loại chứng từ không phù hợp.")
        if models.Reconciliation.objects.filter(statement_line=line, transaction=voucher, cancelled_at__isnull=True).exists():
            raise ValidationError("Giao dịch và chứng từ đã có liên kết ghép tương ứng.")
        remaining = voucher.amount - matched_for_transaction(voucher.pk)
        if "expected_transaction_remaining" in item and expected_amount(item["expected_transaction_remaining"]) != remaining:
            raise ValidationError("Dữ liệu đã thay đổi. Vui lòng tải lại trước khi tiếp tục.")
        value = amount(item.get("matched_amount"))
        if value > remaining:
            raise ValidationError("Số tiền ghép vượt quá số tiền còn được phép đối chiếu.")
        requested += value
        normalized.append((voucher, value))
    if requested > line_remaining:
        raise ValidationError("Số tiền ghép vượt quá số tiền còn được phép đối chiếu.")
    links = []
    running_total = line.amount - line_remaining
    for voucher, value in normalized:
        running_total += value
        link = models.Reconciliation.objects.create(
            company=line.statement.company, statement_line=line, transaction=voucher,
            matched_amount=value, variance=line.amount - running_total,
            status="MATCHED" if running_total == line.amount else "PARTIALLY_MATCHED",
            note=str(request.data.get("note") or "")[:500], created_by=services.actor(request),
        )
        services.audit(request, link, "RECONCILE", after={"statement_line": str(line.pk),
            "transaction": str(voucher.pk), "matched_amount": str(value)})
        links.append(link)
    total = line_status(line)
    for voucher, _ in normalized:
        if matched_for_transaction(voucher.pk) == voucher.amount:
            models.BankVoucherReview.objects.filter(transaction=voucher).delete()
    if line.match_status == "MATCHED" and line.tracking_status == "WAITING":
        line.tracking_status = "NORMAL"
        line.review_reason = ""
        line.updated_by = services.actor(request)
        line.updated_at = timezone.now()
        line.save(update_fields=("tracking_status", "review_reason", "updated_by", "updated_at"))
    for link in links:
        link.status = line.match_status
        link.variance = line.amount - total
    return {"links": links, "status": line.match_status,
            "matched_amount": str(total), "remaining_amount": str(line.amount - total)}


@transaction.atomic
def unmatch(link_id, request):
    try:UUID(str(link_id))
    except (ValueError,TypeError):raise ValidationError("Liên kết ghép không tồn tại.")
    try:
        link = models.Reconciliation.objects.select_related("statement_line__statement").get(pk=link_id)
    except (models.Reconciliation.DoesNotExist, ValueError, TypeError):
        raise ValidationError("Liên kết ghép không tồn tại.")
    line = models.StatementLine.objects.select_for_update().get(pk=link.statement_line_id)
    voucher = models.BankTransaction.objects.select_for_update().get(pk=link.transaction_id)
    link = models.Reconciliation.objects.select_for_update().get(pk=link_id)
    if str(link.company_id) != str(request.query_params.get("company_id")):
        raise ValidationError("Liên kết không thuộc doanh nghiệp đang làm việc.")
    if link.cancelled_at:
        raise ValidationError("Liên kết đã được hủy ghép.")
    if period_confirmed(line):
        raise ValidationError("Không thể thay đổi liên kết thuộc kỳ đối chiếu đã xác nhận.")
    if request.query_params.get("branch_id") and str(line.statement.account.account.branch_id) != request.query_params["branch_id"]:
        raise ValidationError("Bạn không có quyền truy cập tài khoản ngân hàng này.")
    before = {"statement_line": str(line.pk), "transaction": str(voucher.pk),
              "matched_amount": str(link.matched_amount)}
    link.cancelled_at = timezone.now()
    link.cancelled_by = services.actor(request)
    link.status = "CANCELLED"
    link.save(update_fields=("cancelled_at", "cancelled_by", "status"))
    total = line_status(line)
    services.audit(request, link, "UNMATCH", before=before,
                   after={"cancelled_at": link.cancelled_at.isoformat(), "remaining_amount": str(line.amount - total)})
    return {"id": str(link.pk), "status": line.match_status,
            "matched_amount": str(total), "remaining_amount": str(line.amount - total)}
