"""UC-AP-07: posted payable adjustments with matching GL entries."""
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation

from django.db import connection, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from general_ledger import models as gl_models, services as gl_services
from master_data.models import Party
from . import models, services
from .allocation_services import _payable_number, _posting_date


def _lock(qs):
    return qs.select_for_update() if connection.features.has_select_for_update else qs


def _amount(value):
    if value is None or value == "":
        raise ValidationError({"amount": "Số tiền điều chỉnh phải lớn hơn 0."})
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({"amount": "Số tiền điều chỉnh phải lớn hơn 0."})
    if not result.is_finite() or result <= 0:
        raise ValidationError({"amount": "Số tiền điều chỉnh phải lớn hơn 0."})
    if result.as_tuple().exponent < -4:
        raise ValidationError({"amount": "Số tiền điều chỉnh phải lớn hơn 0."})
    return result


def _expected_balance(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({"payable": "Số tiền công nợ đã thay đổi. Vui lòng tải lại dữ liệu."})
    if not result.is_finite() or result < 0:
        raise ValidationError({"payable": "Số tiền công nợ đã thay đổi. Vui lòng tải lại dữ liệu."})
    return result


def _attachments(raw):
    if raw is None:
        return []
    if not isinstance(raw, list) or len(raw) > 20:
        raise ValidationError({"attachments": "Chỉ được đính kèm tối đa 20 tệp."})
    for item in raw:
        name = item.get("name", "") if isinstance(item, dict) else ""
        size = item.get("size") if isinstance(item, dict) else None
        if not isinstance(name, str) or not name.lower().endswith((".pdf", ".png", ".jpg", ".jpeg")) or not isinstance(size, int) or size < 0 or size > 10 * 1024 * 1024:
            raise ValidationError({"attachments": f"Tệp {name} không đúng định dạng hoặc vượt quá dung lượng 10 MB."})
    return raw


def _source_posted(payable):
    source = payable.document or payable.invoice or payable.goods_purchase or payable.purchase_cost
    return bool(source and source.status == "POSTED")


def eligible_payables(company, supplier_id, kind):
    if not supplier_id:
        raise ValidationError({"supplier": "Vui lòng chọn Nhà cung cấp."})
    if not kind or kind not in models.PayableAdjustmentVoucher.Kind.values:
        raise ValidationError({"kind": "Vui lòng chọn Loại điều chỉnh."})
    qs = models.Payable.objects.filter(
        company=company, supplier_id=supplier_id,
        status__in=(models.PayableStatus.OPEN, models.PayableStatus.PARTIALLY_PAID,
                    models.PayableStatus.PAID, models.PayableStatus.OVERDUE),
    ).select_related("document", "invoice", "goods_purchase", "purchase_cost", "supplier")
    if kind == models.PayableAdjustmentVoucher.Kind.DECREASE:
        qs = qs.filter(balance__gt=0)
    result = []
    for payable in qs:
        if not _source_posted(payable):
            continue
        totals = payable.adjustment_vouchers.filter(status="POSTED").values("kind").annotate(total=Sum("amount"))
        amounts = {row["kind"]: row["total"] for row in totals}
        result.append({
            "id": str(payable.pk),
            "number": _payable_number(payable),
            "invoice_number": payable.invoice.invoice_number if payable.invoice_id else "",
            "document_date": str(payable.document.document_date if payable.document_id else (payable.invoice.invoice_date if payable.invoice_id else payable.created_at.date())),
            "posting_date": str(_posting_date(payable)),
            "due_date": str(payable.due_date) if payable.due_date else "",
            "supplier_id": str(payable.supplier_id),
            "supplier_name": payable.supplier.name if payable.supplier else "",
            "currency": str(payable.currency_id),
            "original_amount": payable.original_amount,
            "increase_amount": amounts.get("INCREASE", Decimal(0)),
            "decrease_amount": amounts.get("DECREASE", Decimal(0)),
            "paid_amount": payable.paid_amount,
            "balance": payable.balance,
        })
    return result


def eligible_accounts(company):
    return [{"id": str(a.pk), "code": a.code, "name": a.name} for a in gl_models.Account.objects.filter(
        company=company, status="ACTIVE", is_postable=True
    ).exclude(code__startswith="331")]


def _period(company, day):
    period = gl_models.AccountingPeriod.objects.filter(
        company=company, start_date__lte=day, end_date__gte=day, status="OPEN"
    ).first()
    if not period:
        raise ValidationError({"adjustment_date": "Kỳ kế toán của ngày điều chỉnh đã bị khóa."})
    return period


def _ap_account(company, payable):
    account = payable.document.payable_account if payable.document_id else None
    if account is None:
        account = gl_models.Account.objects.filter(
            company=company, code__in=("331", "3311"), status="ACTIVE", is_postable=True
        ).order_by("code").first()
    if not account or account.company_id != company.id or account.status != "ACTIVE" or not account.is_postable or not account.code.startswith("331"):
        raise ValidationError({"account": "Tài khoản công nợ 331 chưa được cấu hình để hạch toán."})
    return account


def _journal(request, company, period, number, day, description, payable, amount, debit, credit, source_id, original=None):
    user = services.actor(request)
    journal = gl_models.JournalEntry.objects.create(
        company=company, branch=payable.branch, period=period, number=number,
        entry_type="REVERSAL" if original else "SUBLEDGER", posting_date=day, document_date=day,
        description=description, source_module="AP",
        source_event_id=f"AP.ADJUSTMENT.{'CANCEL' if original else 'POST'}:{source_id}",
        source_entity_type="PayableAdjustmentVoucher", source_entity_id=source_id,
        original_entry=original, status="APPROVED", total_debit=amount, total_credit=amount,
        created_by=user, approved_by=user, approved_at=timezone.now(),
        workflow_snapshot={"allow_creator_posting": True},
    )
    gl_models.JournalLine.objects.create(entry=journal, line_no=1, account=debit, debit=amount,
                                         currency=payable.currency, party=payable.supplier, description=description)
    gl_models.JournalLine.objects.create(entry=journal, line_no=2, account=credit, credit=amount,
                                         currency=payable.currency, party=payable.supplier, description=description)
    return gl_services.post(journal, request)


def _status(payable):
    if payable.balance == 0:
        return models.PayableStatus.PAID
    if payable.paid_amount > 0 or payable.netted_amount > 0:
        return models.PayableStatus.PARTIALLY_PAID
    return models.PayableStatus.OPEN


@transaction.atomic
def post_adjustment(request, company, data):
    supplier_id = data.get("supplier")
    if not supplier_id:
        raise ValidationError({"supplier": "Vui lòng chọn Nhà cung cấp."})
    try:
        supplier = Party.objects.get(pk=supplier_id, company=company)
    except (Party.DoesNotExist, ValueError):
        raise ValidationError({"supplier": "Nhà cung cấp không hợp lệ."})
    kind = data.get("kind")
    if not kind or kind not in models.PayableAdjustmentVoucher.Kind.values:
        raise ValidationError({"kind": "Vui lòng chọn Loại điều chỉnh."})
    payable_id = data.get("payable")
    if not payable_id:
        raise ValidationError({"payable": "Vui lòng chọn Chứng từ công nợ cần điều chỉnh."})
    try:
        payable = _lock(models.Payable.objects.select_related(
            "document", "invoice", "goods_purchase", "purchase_cost"
        )).get(pk=payable_id, company=company)
    except (models.Payable.DoesNotExist, ValueError):
        raise ValidationError({"payable": "Chứng từ công nợ không hợp lệ."})
    if payable.supplier_id != supplier.pk:
        raise ValidationError({"payable": "Chứng từ công nợ không thuộc Nhà cung cấp đã chọn."})
    if not _source_posted(payable) or payable.status in (models.PayableStatus.REVERSED, models.PayableStatus.CANCELLED):
        raise ValidationError({"payable": "Chứng từ công nợ phải đã ghi sổ và chưa bị hủy."})
    raw_date = data.get("adjustment_date")
    if not raw_date:
        raise ValidationError({"adjustment_date": "Vui lòng nhập Ngày điều chỉnh."})
    try:
        day = date.fromisoformat(str(raw_date))
    except ValueError:
        raise ValidationError({"adjustment_date": "Ngày điều chỉnh không hợp lệ."})
    if day < _posting_date(payable):
        raise ValidationError({"adjustment_date": "Ngày điều chỉnh không được nhỏ hơn ngày hạch toán của chứng từ công nợ."})
    if day > timezone.localdate():
        raise ValidationError({"adjustment_date": "Ngày điều chỉnh không được lớn hơn ngày hiện tại."})
    period = _period(company, day)
    reason = data.get("reason")
    if not reason or reason not in models.PayableAdjustmentVoucher.Reason.values:
        raise ValidationError({"reason": "Vui lòng chọn Lý do điều chỉnh."})
    reason_detail = str(data.get("reason_detail") or "").strip()
    if reason == models.PayableAdjustmentVoucher.Reason.OTHER and not reason_detail:
        raise ValidationError({"reason_detail": "Vui lòng nhập Chi tiết lý do điều chỉnh."})
    if len(reason_detail) > 500:
        raise ValidationError({"reason_detail": "Chi tiết lý do không được vượt quá 500 ký tự."})
    basis = str(data.get("basis") or "").strip()
    if not basis:
        raise ValidationError({"basis": "Vui lòng nhập Căn cứ điều chỉnh."})
    if len(basis) > 255:
        raise ValidationError({"basis": "Căn cứ điều chỉnh không được vượt quá 255 ký tự."})
    raw_desc = data.get("description")
    if raw_desc is not None and not str(raw_desc).strip():
        raise ValidationError({"description": "Vui lòng nhập Diễn giải."})
    default_desc = f"{models.PayableAdjustmentVoucher.Kind(kind).label} công nợ chứng từ {_payable_number(payable)}"
    description = str(raw_desc or default_desc).strip()
    if not description:
        raise ValidationError({"description": "Vui lòng nhập Diễn giải."})
    if len(description) > 500:
        raise ValidationError({"description": "Diễn giải không được vượt quá 500 ký tự."})
    amount = _amount(data.get("amount"))
    if "expected_balance" in data and _expected_balance(data["expected_balance"]) != payable.balance:
        raise ValidationError({"payable": "Số tiền công nợ đã thay đổi. Vui lòng tải lại dữ liệu."})
    if kind == models.PayableAdjustmentVoucher.Kind.DECREASE and amount > payable.balance:
        raise ValidationError({"amount": f"Số tiền điều chỉnh giảm không được vượt số tiền còn phải trả là {payable.balance}."})
    counter_id = data.get("counter_account")
    if not counter_id:
        raise ValidationError({"counter_account": "Vui lòng chọn Tài khoản đối ứng."})
    try:
        counter_account = gl_models.Account.objects.get(pk=counter_id, company=company)
    except (gl_models.Account.DoesNotExist, ValueError):
        raise ValidationError({"counter_account": "Tài khoản đối ứng không hợp lệ."})
    if counter_account.code.startswith("331") or counter_account.code == "331":
        raise ValidationError({"counter_account": "Tài khoản đối ứng phải khác tài khoản công nợ 331."})
    if counter_account.status != "ACTIVE" or not counter_account.is_postable:
        raise ValidationError({"counter_account": "Tài khoản đối ứng đã ngừng hoạt động hoặc không cho phép hạch toán."})
    attachments = _attachments(data.get("attachments"))
    ap_account = _ap_account(company, payable)
    counter, _ = _lock(models.PayableAdjustmentCounter.objects).get_or_create(
        company=company, year=day.year, defaults={"value": 0})
    counter.value += 1
    counter.save(update_fields=("value",))
    number = f"DCPT-{day.year}-{counter.value:06d}"
    voucher_id = uuid.uuid4()
    debit, credit = ((counter_account, ap_account) if kind == "INCREASE" else (ap_account, counter_account))
    journal = _journal(request, company, period, f"GL-{number}", day, description,
                       payable, amount, debit, credit, voucher_id)
    before = payable.balance
    delta = amount if kind == "INCREASE" else -amount
    payable.adjustment_amount += delta
    payable.balance += delta
    payable.status = _status(payable)
    payable.save(update_fields=("adjustment_amount", "balance", "status", "updated_at"))
    voucher = models.PayableAdjustmentVoucher.objects.create(
        id=voucher_id, company=company, number=number, supplier=supplier, payable=payable,
        adjustment_date=day, kind=kind, reason=reason, reason_detail=reason_detail,
        basis=basis, description=description, amount=amount, counter_account=counter_account,
        attachments=attachments, balance_before=before, balance_after=payable.balance,
        journal_entry=journal, created_by=services.actor(request),
    )
    services.audit(request, voucher, "ADJUSTMENT_POST", before={"balance": str(before)},
                   after={"number": number, "payable": str(payable.pk), "kind": kind,
                          "amount": str(amount), "balance": str(payable.balance)})
    return voucher


@transaction.atomic
def cancel_adjustment(request, voucher, reason):
    reason = str(reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập Lý do hủy."})
    if len(reason) > 500:
        raise ValidationError({"reason": "Lý do hủy không được vượt quá 500 ký tự."})
    voucher = _lock(models.PayableAdjustmentVoucher.objects).select_related("journal_entry", "payable").get(pk=voucher.pk)
    if voucher.status != "POSTED":
        raise ValidationError({"status": "Chứng từ điều chỉnh đã được hủy trước đó."})
    payable = _lock(models.Payable.objects).get(pk=voucher.payable_id)
    day = timezone.localdate()
    period = _period(voucher.company, day)
    original = voucher.journal_entry
    lines = list(original.lines.select_related("account").order_by("line_no"))
    reversal = _journal(request, voucher.company, period, f"GL-REV-{voucher.number}", day,
                        f"Đảo {voucher.number}: {reason}"[:500], payable, voucher.amount,
                        lines[1].account, lines[0].account, voucher.pk, original=original)
    delta = voucher.amount if voucher.kind == "INCREASE" else -voucher.amount
    if payable.balance - delta < 0:
        raise ValidationError({"payable": "Không thể hủy vì số dư công nợ hiện tại không đủ để hoàn tác điều chỉnh."})
    payable.adjustment_amount -= delta
    payable.balance -= delta
    payable.status = _status(payable)
    payable.save(update_fields=("adjustment_amount", "balance", "status", "updated_at"))
    original.status = "REVERSED"
    original.save(update_fields=("status", "updated_at"))
    voucher.status = "CANCELLED"
    voucher.reversal_journal_entry = reversal
    voucher.cancel_reason = reason
    voucher.cancelled_by = services.actor(request)
    voucher.cancelled_at = timezone.now()
    voucher.save(update_fields=("status", "reversal_journal_entry", "cancel_reason", "cancelled_by", "cancelled_at"))
    services.audit(request, voucher, "ADJUSTMENT_CANCEL", before={"status": "POSTED"},
                   after={"status": "CANCELLED", "balance": str(payable.balance)}, reason=reason)
    return voucher
