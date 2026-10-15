"""UC-AP-06: atomic AP/AR debt offset and its accounting reversal."""
from datetime import date
from decimal import Decimal, InvalidOperation

from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts_receivable import models as ar_models
from general_ledger import models as gl_models, services as gl_services
from master_data.models import Party, PartyRole
from . import models, services
from .allocation_services import _payable_number, _posting_date


def _lock(qs):
    return qs.select_for_update() if connection.features.has_select_for_update else qs


def _amount(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({"amount": "Số tiền bù trừ không hợp lệ."})
    if not result.is_finite() or result.as_tuple().exponent < -4:
        raise ValidationError({"amount": "Số tiền bù trừ không hợp lệ."})
    return result


def _partner(company, partner_id):
    if not partner_id:
        raise ValidationError({"partner": "Vui lòng chọn Đối tác bù trừ."})
    try:
        partner = Party.objects.get(pk=partner_id, company=company)
    except (Party.DoesNotExist, ValueError):
        raise ValidationError({"partner": "Đối tác bù trừ không hợp lệ."})
    roles = set(PartyRole.objects.filter(party=partner, active_from__lte=timezone.localdate()).filter(
        Q(active_to__isnull=True) | Q(active_to__gte=timezone.localdate())
    ).values_list("role_type", flat=True))
    if not {"VENDOR", "CUSTOMER"}.issubset(roles):
        raise ValidationError({"partner": "Đối tác chưa được liên kết đồng thời với khách hàng và nhà cung cấp."})
    return partner


def eligible_partners(company):
    today = timezone.localdate()
    active_roles = PartyRole.objects.filter(active_from__lte=today).filter(Q(active_to__isnull=True) | Q(active_to__gte=today))
    both_ids = set(active_roles.filter(role_type="VENDOR").values_list("party_id", flat=True)) & set(
        active_roles.filter(role_type="CUSTOMER").values_list("party_id", flat=True))
    return [{"id": str(p.pk), "code": p.code, "name": p.name} for p in Party.objects.filter(
        company=company, pk__in=both_ids
    ) if
        models.Payable.objects.filter(company=company, supplier=p, balance__gt=0).exists() and
        ar_models.Receivable.objects.filter(company=company, customer=p, balance__gt=0).exists()]


def eligible_debts(company, partner_id):
    partner = _partner(company, partner_id)
    payables = models.Payable.objects.filter(
        company=company, supplier=partner, balance__gt=0,
        status__in=(models.PayableStatus.OPEN, models.PayableStatus.PARTIALLY_PAID, models.PayableStatus.OVERDUE),
    ).select_related("document", "invoice", "goods_purchase", "purchase_cost", "currency")
    if not payables.exists():
        raise ValidationError({"payables": "Đối tác không có khoản công nợ phải trả chưa thanh toán."})
    receivables = ar_models.Receivable.objects.filter(
        company=company, customer=partner, balance__gt=0,
        status__in=(ar_models.ReceivableStatus.OPEN, ar_models.ReceivableStatus.PARTIALLY_PAID),
    ).select_related("currency")
    if not receivables.exists():
        raise ValidationError({"receivables": "Đối tác không có khoản công nợ phải thu chưa thu."})
    return {
        "payables": [{"id": str(p.pk), "number": _payable_number(p), "posting_date": _posting_date(p),
                      "currency": str(p.currency_id), "currency_code": p.currency.code,
                      "original_amount": p.original_amount, "balance": p.balance, "due_date": p.due_date} for p in payables],
        "receivables": [{"id": str(r.pk), "number": _receivable_number(r),
                         "posting_date": _receivable_date(r), "currency": str(r.currency_id),
                         "currency_code": r.currency.code,
                         "original_amount": r.original_amount, "balance": r.balance, "due_date": r.due_date} for r in receivables],
    }


def _receivable_number(debt):
    return debt.source_document_number or (debt.document.number if debt.document_id else debt.code or str(debt.pk))


def _receivable_date(debt):
    return debt.posting_date or (debt.document.posting_date if debt.document_id else debt.document_date or debt.created_at.date())


def _rows(data, key, model, company):
    raw = data.get(key)
    if not isinstance(raw, list) or not raw:
        label = "phải trả" if key == "payable_lines" else "phải thu"
        raise ValidationError({key: f"Vui lòng chọn ít nhất một khoản công nợ {label}."})
    id_key = "payable" if key == "payable_lines" else "receivable"
    ids = [str(row.get(id_key)) for row in raw if isinstance(row, dict)]
    if len(ids) != len(raw) or len(ids) != len(set(ids)):
        raise ValidationError({key: "Dòng công nợ không hợp lệ hoặc bị chọn trùng."})
    debts = {str(obj.pk): obj for obj in _lock(model.objects.filter(company=company, pk__in=ids)).order_by("pk")}
    if len(debts) != len(ids):
        raise ValidationError({key: "Khoản công nợ không tồn tại."})
    result = []
    for row in raw:
        debt = debts[str(row[id_key])]
        amount = _amount(row.get("amount"))
        if amount <= 0:
            raise ValidationError({key: "Số tiền bù trừ của các dòng được chọn phải lớn hơn 0."})
        number = _payable_number(debt) if id_key == "payable" else _receivable_number(debt)
        if "expected_balance" in row and _amount(row["expected_balance"]) != debt.balance:
            raise ValidationError({key: f"Số tiền công nợ của chứng từ {number} đã thay đổi. Vui lòng tải lại dữ liệu."})
        if debt.balance <= 0 or amount > debt.balance:
            doc_type = "phải trả" if id_key == "payable" else "phải thu"
            side = "còn phải trả" if id_key == "payable" else "còn phải thu"
            raise ValidationError({key: f"Số tiền bù trừ của chứng từ {doc_type} {number} vượt số tiền {side} là {debt.balance}."})
        result.append((debt, amount))
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


def _period(company, day):
    period = gl_models.AccountingPeriod.objects.filter(
        company=company, start_date__lte=day, end_date__gte=day, status="OPEN"
    ).first()
    if not period:
        raise ValidationError({"offset_date": "Kỳ kế toán của ngày bù trừ đã bị khóa."})
    return period


def _accounts(company):
    debit = gl_models.Account.objects.filter(company=company, code__in=("331", "3311"), status="ACTIVE", is_postable=True).order_by("code").first()
    credit = gl_models.Account.objects.filter(company=company, code__in=("131", "1311"), status="ACTIVE", is_postable=True).order_by("code").first()
    if not debit or not credit:
        raise ValidationError({"account": "Tài khoản 331 hoặc 131 chưa được cấu hình để hạch toán."})
    return debit, credit


def _journal(request, company, period, number, day, description, partner, currency, amount, debit, credit, source_type, source_id, original=None):
    user = services.actor(request)
    entry = gl_models.JournalEntry.objects.create(
        company=company, period=period, number=number, entry_type="REVERSAL" if original else "SUBLEDGER",
        posting_date=day, document_date=day, description=description, source_module="AP",
        source_event_id=f"AP.OFFSET.{source_type}:{source_id}", source_entity_type="DebtOffsetVoucher",
        source_entity_id=source_id, original_entry=original, status="APPROVED",
        total_debit=amount, total_credit=amount, created_by=user, approved_by=user,
        approved_at=timezone.now(), workflow_snapshot={"allow_creator_posting": True},
    )
    gl_models.JournalLine.objects.create(entry=entry, line_no=1, account=debit, debit=amount,
                                         currency=currency, party=partner, description=description)
    gl_models.JournalLine.objects.create(entry=entry, line_no=2, account=credit, credit=amount,
                                         currency=currency, party=partner, description=description)
    return gl_services.post(entry, request)


@transaction.atomic
def post_offset(request, company, data):
    partner = _partner(company, data.get("partner"))
    raw_date = data.get("offset_date")
    if not raw_date:
        raise ValidationError({"offset_date": "Vui lòng nhập Ngày bù trừ."})
    try:
        day = date.fromisoformat(str(raw_date))
    except ValueError:
        raise ValidationError({"offset_date": "Ngày bù trừ không hợp lệ."})
    if day > timezone.localdate():
        raise ValidationError({"offset_date": "Ngày bù trừ không được lớn hơn ngày hiện tại."})
    period = _period(company, day)
    basis = str(data.get("basis") or "").strip()
    if not basis:
        raise ValidationError({"basis": "Vui lòng nhập Căn cứ bù trừ."})
    if len(basis) > 255:
        raise ValidationError({"basis": "Căn cứ bù trừ không được vượt quá 255 ký tự."})
    description = str(data.get("description", f"Bù trừ công nợ với {partner.name}")).strip()
    if not description:
        raise ValidationError({"description": "Vui lòng nhập Diễn giải."})
    if len(description) > 500:
        raise ValidationError({"description": "Diễn giải không được vượt quá 500 ký tự."})
    attachments = _attachments(data.get("attachments"))
    payable_rows = _rows(data, "payable_lines", models.Payable, company)
    receivable_rows = _rows(data, "receivable_lines", ar_models.Receivable, company)
    currencies = {p.currency_id for p, _ in payable_rows} | {r.currency_id for r, _ in receivable_rows}
    if any(p.supplier_id != partner.id for p, _ in payable_rows) or any(r.customer_id != partner.id for r, _ in receivable_rows):
        raise ValidationError({"partner": "Các khoản công nợ được chọn phải thuộc cùng một đối tác."})
    if len(currencies) != 1:
        raise ValidationError({"currency": "Các khoản công nợ được chọn phải sử dụng cùng một loại tiền."})
    for debt, _ in payable_rows:
        if debt.status not in (models.PayableStatus.OPEN, models.PayableStatus.PARTIALLY_PAID, models.PayableStatus.OVERDUE):
            raise ValidationError({"payable_lines": "Khoản phải trả không còn phù hợp."})
        if day < _posting_date(debt):
            raise ValidationError({"offset_date": f"Ngày bù trừ không được nhỏ hơn ngày hạch toán của chứng từ {_payable_number(debt)}."})
    for debt, _ in receivable_rows:
        if debt.status not in (ar_models.ReceivableStatus.OPEN, ar_models.ReceivableStatus.PARTIALLY_PAID):
            raise ValidationError({"receivable_lines": "Khoản phải thu không còn phù hợp."})
        if day < _receivable_date(debt):
            raise ValidationError({"offset_date": f"Ngày bù trừ không được nhỏ hơn ngày hạch toán của chứng từ {_receivable_number(debt)}."})
    ap_total = sum((amount for _, amount in payable_rows), Decimal(0))
    ar_total = sum((amount for _, amount in receivable_rows), Decimal(0))
    if ap_total != ar_total:
        raise ValidationError({"amount": f"Tổng bù trừ phải trả phải bằng Tổng bù trừ phải thu. Chênh lệch hiện tại: {ap_total - ar_total}."})
    debit, credit = _accounts(company)
    counter, _ = _lock(models.DebtOffsetCounter.objects).get_or_create(
        company=company, year=day.year, defaults={"value": 0})
    counter.value += 1
    counter.save(update_fields=("value",))
    number = f"BTCN-{day.year}-{counter.value:06d}"
    import uuid
    voucher_id = uuid.uuid4()
    journal = _journal(request, company, period, f"GL-{number}", day, description, partner,
                       payable_rows[0][0].currency, ap_total, debit, credit, "POST", voucher_id)
    voucher = models.DebtOffsetVoucher.objects.create(
        id=voucher_id, company=company, number=number, partner=partner, currency=payable_rows[0][0].currency,
        offset_date=day, basis=basis, description=description, amount=ap_total, attachments=attachments,
        journal_entry=journal, created_by=services.actor(request),
    )
    for index, (debt, amount) in enumerate(payable_rows, 1):
        models.DebtOffsetPayableLine.objects.create(voucher=voucher, payable=debt, line_no=index, amount=amount)
        debt.netted_amount += amount
        debt.balance -= amount
        debt.status = models.PayableStatus.PAID if debt.balance == 0 else models.PayableStatus.PARTIALLY_PAID
        debt.save(update_fields=("netted_amount", "balance", "status", "updated_at"))
    for index, (debt, amount) in enumerate(receivable_rows, 1):
        allocations = []
        remaining = amount
        for schedule in _lock(debt.schedules.filter(balance__gt=0)).order_by("installment_no"):
            applied = min(remaining, schedule.balance)
            if applied:
                schedule.collected_amount += applied
                schedule.balance -= applied
                schedule.status = ar_models.ReceivableStatus.PAID if schedule.balance == 0 else ar_models.ReceivableStatus.PARTIALLY_PAID
                schedule.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
                allocations.append({"id": str(schedule.pk), "amount": str(applied)})
                remaining -= applied
            if remaining == 0:
                break
        if debt.schedules.exists() and remaining:
            raise ValidationError({"receivable_lines": f"Lịch thu của chứng từ {_receivable_number(debt)} không đủ số dư để bù trừ."})
        models.DebtOffsetReceivableLine.objects.create(voucher=voucher, receivable=debt, line_no=index,
                                                       amount=amount, schedule_allocations=allocations)
        debt.netted_amount += amount
        debt.balance -= amount
        debt.status = ar_models.ReceivableStatus.PAID if debt.balance == 0 else ar_models.ReceivableStatus.PARTIALLY_PAID
        debt.save(update_fields=("netted_amount", "balance", "status", "updated_at"))
    services.audit(request, voucher, "OFFSET_POST", after={
        "number": number, "partner": str(partner.pk), "amount": str(ap_total),
        "payables": [{"id": str(d.pk), "amount": str(a)} for d, a in payable_rows],
        "receivables": [{"id": str(d.pk), "amount": str(a)} for d, a in receivable_rows],
    })
    return voucher


@transaction.atomic
def cancel_offset(request, voucher, reason):
    reason = str(reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Vui lòng nhập Lý do hủy."})
    if len(reason) > 500:
        raise ValidationError({"reason": "Lý do hủy không được vượt quá 500 ký tự."})
    voucher = _lock(models.DebtOffsetVoucher.objects).select_related("journal_entry").get(pk=voucher.pk)
    if voucher.status != "POSTED":
        raise ValidationError({"status": "Chứng từ bù trừ đã được hủy trước đó."})
    day = timezone.localdate()
    period = _period(voucher.company, day)
    original = voucher.journal_entry
    debit, credit = _accounts(voucher.company)
    reversal = _journal(request, voucher.company, period, f"GL-REV-{voucher.number}", day,
                        f"Đảo {voucher.number}: {reason}"[:500], voucher.partner, voucher.currency,
                        voucher.amount, credit, debit, "CANCEL", voucher.pk, original=original)
    for line in _lock(models.DebtOffsetPayableLine.objects.filter(voucher=voucher)).order_by("payable_id"):
        debt = _lock(models.Payable.objects).get(pk=line.payable_id)
        debt.netted_amount -= line.amount
        debt.balance += line.amount
        debt.status = (models.PayableStatus.PAID if debt.balance == 0 else
                       models.PayableStatus.PARTIALLY_PAID if debt.balance < debt.original_amount + debt.adjustment_amount
                       else models.PayableStatus.OPEN)
        debt.save(update_fields=("netted_amount", "balance", "status", "updated_at"))
    for line in _lock(models.DebtOffsetReceivableLine.objects.filter(voucher=voucher)).order_by("receivable_id"):
        debt = _lock(ar_models.Receivable.objects).get(pk=line.receivable_id)
        debt.netted_amount -= line.amount
        debt.balance += line.amount
        debt.status = (ar_models.ReceivableStatus.PAID if debt.balance == 0 else
                       ar_models.ReceivableStatus.PARTIALLY_PAID if debt.balance < debt.original_amount + debt.adjustment_amount
                       else ar_models.ReceivableStatus.OPEN)
        debt.save(update_fields=("netted_amount", "balance", "status", "updated_at"))
        for allocation in line.schedule_allocations:
            schedule = _lock(ar_models.ReceivableSchedule.objects).get(pk=allocation["id"])
            amount = Decimal(allocation["amount"])
            schedule.collected_amount -= amount
            schedule.balance += amount
            schedule.status = (ar_models.ReceivableStatus.PAID if schedule.balance == 0 else
                               ar_models.ReceivableStatus.PARTIALLY_PAID if schedule.collected_amount > 0
                               else ar_models.ReceivableStatus.OPEN)
            schedule.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
    original.status = "REVERSED"
    original.save(update_fields=("status", "updated_at"))
    voucher.status = "CANCELLED"
    voucher.reversal_journal_entry = reversal
    voucher.cancel_reason = reason
    voucher.cancelled_by = services.actor(request)
    voucher.cancelled_at = timezone.now()
    voucher.save(update_fields=("status", "reversal_journal_entry", "cancel_reason", "cancelled_by", "cancelled_at"))
    services.audit(request, voucher, "OFFSET_CANCEL", before={"status": "POSTED"},
                   after={"status": "CANCELLED", "reversal_journal": str(reversal.pk)}, reason=reason)
    return voucher
