"""UC-AR-04: draft, post and undo customer receipt allocations."""
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from bank_management.models import BankTransaction
from cash_management.models import CashTransaction
from general_ledger.models import Account, AccountStatus, AccountingPeriod, JournalEntry, JournalLine
from master_data.models import DocumentNumberingRule
from . import models, services

ZERO = Decimal("0")
SCALE = Decimal("0.0001")


def _fail(condition, field, message):
    if not condition:
        raise ValidationError({field: message})


def receipt_source_is_posted(receipt):
    if models.CustomerReceiptVoucher.objects.filter(receipt=receipt, status="POSTED").exists():
        return True
    return (
        CashTransaction.objects.filter(company=receipt.company, source_reference=str(receipt.pk), status="POSTED").exists()
        or BankTransaction.objects.filter(company=receipt.company, source_reference=str(receipt.pk), status="POSTED").exists()
    )


def receipt_credit_account(receipt, lines=None):
    if receipt.credit_account_id:
        return receipt.credit_account
    if lines:
        accounts = {
            (item["receivable"] if isinstance(item, dict) else item.receivable).account_id
            for item in lines
        }
        if len(accounts) == 1 and None not in accounts:
            return Account.objects.get(pk=next(iter(accounts)))
    return None


def _active_allocations(receipt):
    return receipt.allocations.filter(reversed_at__isnull=True)


def validate_data(attrs, instance=None, lines=None):
    def value(name):
        return attrs.get(name, getattr(instance, name, None))
    company, branch, customer, receipt = (
        value("company"), value("branch"), value("customer"), value("receipt")
    )
    _fail(company and branch and branch.company_id == company.pk, "branch", "Chi nhánh ngoài doanh nghiệp.")
    _fail(customer and customer.company_id == company.pk, "customer", "Khách hàng ngoài doanh nghiệp.")
    _fail(receipt and receipt.company_id == company.pk and receipt.customer_id == customer.pk,
          "receipt", "Chứng từ thu không thuộc khách hàng.")
    _fail(receipt.status == models.ReceiptStatus.CONFIRMED and receipt_source_is_posted(receipt),
          "receipt", "Chứng từ thu chưa được ghi sổ.")
    _fail(not receipt.branch_id or receipt.branch_id == branch.pk,
          "branch", "Chứng từ thu ngoài chi nhánh.")
    _fail(value("allocation_date"), "allocation_date", "Ngày phân bổ là bắt buộc.")
    _fail(value("allocation_date") >= receipt.receipt_date,
          "allocation_date", "Ngày phân bổ không được trước ngày thu tiền.")
    _fail(bool(value("description") and value("description").strip()),
          "description", "Diễn giải là bắt buộc.")
    effective_lines = lines if lines is not None else list(instance.lines.select_related("receivable", "schedule")) if instance else []
    _fail(bool(effective_lines), "lines", "Cần ít nhất một dòng phân bổ.")
    account = receipt_credit_account(receipt, effective_lines)
    _fail(account and account.company_id == company.pk and account.status == AccountStatus.ACTIVE,
          "receipt", "Không xác định được tài khoản công nợ của chứng từ thu.")
    available = receipt.amount - receipt.allocated_amount
    total = ZERO
    keys = set()
    by_rec = {}
    by_schedule = {}
    for item in effective_lines:
        rec = item["receivable"] if isinstance(item, dict) else item.receivable
        schedule = item.get("schedule") if isinstance(item, dict) else item.schedule
        amount = item["amount"] if isinstance(item, dict) else item.amount
        _fail(amount > 0, "lines", "Số tiền phân bổ phải lớn hơn 0.")
        _fail(
            rec.company_id == company.pk and rec.customer_id == customer.pk
            and rec.branch_id == branch.pk and rec.currency_id == receipt.currency_id
            and rec.account_id == account.pk and rec.status != models.ReceivableStatus.REVERSED
            and rec.posting_date and rec.posting_date <= value("allocation_date"),
            "lines", "Khoản phải thu khác phạm vi, loại tiền, tài khoản hoặc chưa có hiệu lực.",
        )
        _fail(not schedule or schedule.receivable_id == rec.pk, "lines", "Đợt không thuộc khoản phải thu.")
        key = (rec.pk, schedule.installment_no if schedule else None)
        _fail(key not in keys, "lines", "Trùng khoản phải thu và đợt thanh toán.")
        keys.add(key)
        if schedule is None and rec.schedules.exists():
            raise ValidationError({"lines": "Cần chọn đợt thanh toán của khoản phải thu."})
        by_rec[rec.pk] = by_rec.get(rec.pk, ZERO) + amount
        _fail(by_rec[rec.pk] <= rec.balance, "lines", f"Khoản {rec.code} chỉ còn {rec.balance}.")
        if schedule:
            by_schedule[schedule.pk] = by_schedule.get(schedule.pk, ZERO) + amount
            _fail(by_schedule[schedule.pk] <= schedule.balance, "lines", "Phân bổ vượt số dư đợt.")
        total += amount
    _fail(total <= available, "lines", f"Chứng từ thu chỉ còn {available} có thể phân bổ.")
    return account


def _next_number(company, branch, allocation_date):
    rules = DocumentNumberingRule.objects.filter(
        company=company, document_type__code="AR.ALLOCATION_VOUCHER",
        status="ACTIVE", effective_from__lte=allocation_date,
    ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=allocation_date))
    rule = (rules.filter(branch=branch).order_by("-effective_from").first()
            or rules.filter(branch__isnull=True).order_by("-effective_from").first())
    if rule:
        sep = rule.separator or "-"
        parts = [rule.prefix or "AR-AL"]
        if rule.include_branch_code:
            parts.append(branch.code)
        if rule.include_fiscal_year:
            parts.append(str(allocation_date.year))
        prefix, suffix, width = sep.join(parts) + sep, sep + rule.suffix if rule.suffix else "", rule.padding_length
    else:
        prefix, suffix, width = f"AR-AL-{allocation_date.year}-", "", 5
    used = []
    for number in models.ReceiptAllocationVoucher.objects.filter(
        company=company, number__startswith=prefix,
    ).values_list("number", flat=True):
        middle = number[len(prefix):]
        if suffix:
            if not middle.endswith(suffix):
                continue
            middle = middle[:-len(suffix)]
        if middle.isdigit():
            used.append(int(middle))
    return f"{prefix}{max(used, default=0) + 1:0{width}d}{suffix}"


@transaction.atomic
def save(data, instance, request):
    data = dict(data)
    lines = data.pop("lines", None)
    creating = instance is None
    if instance:
        instance = models.ReceiptAllocationVoucher.objects.select_for_update().get(pk=instance.pk)
        if instance.status != "DRAFT":
            raise ValidationError("Chỉ phiếu nháp được sửa.")
    company = data.get("company", instance.company if instance else None)
    branch = data.get("branch", instance.branch if instance else None)
    receipt = data.get("receipt", instance.receipt if instance else None)
    effective_lines = lines if lines is not None else list(instance.lines.all()) if instance else []
    account = validate_data(data, instance, effective_lines)
    data["currency"] = receipt.currency
    data["credit_account"] = account
    if creating:
        from organization.models import Company
        Company.objects.select_for_update().get(pk=company.pk)
        data["number"] = _next_number(company, branch, data["allocation_date"])
        data["created_by"] = request.user.iam_account
        instance = models.ReceiptAllocationVoucher.objects.create(**data)
    else:
        for key, val in data.items():
            setattr(instance, key, val)
        instance.save()
    if lines is not None:
        instance.lines.all().delete()
        models.ReceiptAllocationVoucherLine.objects.bulk_create([
            models.ReceiptAllocationVoucherLine(
                voucher=instance, installment_no=item["schedule"].installment_no if item.get("schedule") else None,
                **item,
            ) for item in lines
        ])
    services.audit(request, instance, "CREATE" if creating else "EDIT",
                   after={"number": instance.number, "status": instance.status})
    return instance


def suggest(receipt, branch, account):
    debts = models.Receivable.objects.filter(
        company=receipt.company, branch=branch, customer=receipt.customer,
        currency=receipt.currency, account=account, balance__gt=0,
    ).exclude(status=models.ReceivableStatus.REVERSED).prefetch_related("schedules")
    candidates = []
    for rec in debts:
        schedules = list(rec.schedules.filter(balance__gt=0))
        if schedules:
            for schedule in schedules:
                candidates.append((schedule.due_date, rec.posting_date, rec.code, schedule, rec, schedule.balance))
        else:
            candidates.append((rec.due_date, rec.posting_date, rec.code, None, rec, rec.balance))
    remaining = receipt.amount - receipt.allocated_amount
    result = []
    for _, _, _, schedule, rec, balance in sorted(
        candidates, key=lambda item: (item[0] is None, item[0] or timezone.localdate(), item[1], item[2])
    ):
        amount = min(remaining, balance)
        if amount <= 0:
            break
        result.append({
            "receivable": str(rec.pk),
            "schedule": str(schedule.pk) if schedule else None,
            "amount": amount,
        })
        remaining -= amount
    return result


@transaction.atomic
def post(voucher, request):
    voucher = models.ReceiptAllocationVoucher.objects.select_for_update().select_related(
        "company", "branch", "receipt", "credit_account", "currency",
    ).get(pk=voucher.pk)
    if voucher.status == "POSTED":
        return voucher
    if voucher.status != "DRAFT":
        raise ValidationError("Chỉ phiếu nháp được ghi sổ.")
    receipt = models.Receipt.objects.select_for_update().get(pk=voucher.receipt_id)
    lines = list(voucher.lines.select_related("receivable", "schedule").order_by("pk"))
    validate_data({}, voucher, lines)
    period = AccountingPeriod.objects.filter(
        company=voucher.company, start_date__lte=voucher.allocation_date,
        end_date__gte=voucher.allocation_date, status="OPEN",
    ).first()
    if not period:
        raise ValidationError({"allocation_date": "Không có kỳ kế toán đang mở."})
    recs = {
        rec.pk: rec for rec in models.Receivable.objects.select_for_update().filter(
            pk__in=[line.receivable_id for line in lines],
        ).order_by("pk")
    }
    active = _active_allocations(receipt)
    receipt_base = receipt.base_amount or (receipt.amount * receipt.exchange_rate).quantize(SCALE)
    used_book = sum((
        allocation.receipt_book_amount
        if allocation.receipt_book_amount is not None
        else (allocation.amount * receipt.exchange_rate).quantize(SCALE)
        for allocation in active
    ), ZERO)
    available_book = receipt_base - used_book
    available_amount = receipt.amount - receipt.allocated_amount
    total = sum((line.amount for line in lines), ZERO)
    if total > available_amount:
        raise ValidationError({"lines": f"Khoản thu chỉ còn {available_amount}."})
    now = timezone.now()
    total_fx = ZERO
    remaining_book = available_book
    remaining_amount = available_amount
    for line in lines:
        rec = recs[line.receivable_id]
        if line.amount > rec.balance:
            raise ValidationError({"lines": f"Khoản {rec.code} chỉ còn {rec.balance}."})
        schedule = None
        if line.installment_no:
            schedule = models.ReceivableSchedule.objects.select_for_update().filter(
                receivable=rec, installment_no=line.installment_no,
            ).first()
            if schedule is None or line.amount > schedule.balance:
                raise ValidationError({"lines": "Đợt thanh toán đã thay đổi hoặc không đủ số dư."})
        receipt_book = (
            remaining_book if line.amount == remaining_amount
            else (available_book * line.amount / available_amount).quantize(SCALE)
        )
        debt_book = (line.amount * rec.exchange_rate).quantize(SCALE)
        fx = receipt_book - debt_book
        allocation = models.ReceiptAllocation.objects.create(
            receipt=receipt, receivable=rec, schedule=schedule,
            installment_no=line.installment_no, amount=line.amount,
            effective_date=voucher.allocation_date,
            exchange_rate=receipt.exchange_rate,
            receipt_book_amount=receipt_book, debt_book_amount=debt_book,
            created_by=request.user.iam_account,
        )
        line.allocation = allocation
        line.receipt_book_amount = receipt_book
        line.debt_book_amount = debt_book
        line.fx_difference = fx
        line.save(update_fields=("allocation", "receipt_book_amount", "debt_book_amount", "fx_difference"))
        rec.collected_amount += line.amount
        rec.balance -= line.amount
        services.update_debt(rec)
        if schedule:
            schedule.collected_amount += line.amount
            schedule.balance -= line.amount
            schedule.status = "PAID" if schedule.balance == 0 else "PARTIALLY_PAID"
            schedule.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
        receipt.allocated_amount += line.amount
        remaining_amount -= line.amount
        remaining_book -= receipt_book
        total_fx += fx
    if not receipt.credit_account_id:
        receipt.credit_account = voucher.credit_account
        receipt.save(update_fields=("allocated_amount", "credit_account"))
    else:
        receipt.save(update_fields=("allocated_amount",))
    voucher.posting_count += 1
    if total_fx:
        fx_code = "515" if total_fx > 0 else "635"
        fx_account = Account.objects.filter(
            company=voucher.company, code=fx_code, status=AccountStatus.ACTIVE,
        ).first()
        if not fx_account:
            raise ValidationError({"exchange_rate": f"Thiếu tài khoản chênh lệch tỷ giá {fx_code}."})
        amount = abs(total_fx)
        suffix = "" if voucher.posting_count == 1 else f"-{voucher.posting_count}"
        journal = JournalEntry.objects.create(
            company=voucher.company, branch=voucher.branch, period=period,
            number=f"GL-{voucher.number}{suffix}", entry_type="SUBLEDGER",
            posting_date=voucher.allocation_date, document_date=voucher.allocation_date,
            description=f"Chênh lệch tỷ giá phân bổ {voucher.number}",
            source_module="AR", source_event_id=f"AR_ALLOC:{voucher.id}:{voucher.posting_count}",
            source_entity_type="ReceiptAllocationVoucher", source_entity_id=voucher.id,
            status="APPROVED", workflow_snapshot={"allow_creator_posting": True},
            total_debit=amount, total_credit=amount,
            created_by=request.user.iam_account, approved_by=request.user.iam_account,
            approved_at=now,
        )
        JournalLine.objects.create(
            entry=journal, line_no=1,
            account=voucher.credit_account if total_fx > 0 else fx_account,
            debit=amount, currency=voucher.company.accounting_currency,
            foreign_amount=amount, party=voucher.customer, description=journal.description,
        )
        JournalLine.objects.create(
            entry=journal, line_no=2,
            account=fx_account if total_fx > 0 else voucher.credit_account,
            credit=amount, currency=voucher.company.accounting_currency,
            foreign_amount=amount, party=voucher.customer, description=journal.description,
        )
        from general_ledger.services import post as post_journal
        post_journal(journal, request)
        voucher.journal_entry = journal
    voucher.status = "POSTED"
    voucher.posted_by = request.user.iam_account
    voucher.posted_at = now
    voucher.unposted_at = None
    voucher.unposted_by = None
    voucher.unpost_reason = ""
    voucher.save()
    services.audit(request, voucher, "POST", after={"amount": str(total), "fx": str(total_fx)})
    return voucher


@transaction.atomic
def unpost(voucher, request):
    voucher = models.ReceiptAllocationVoucher.objects.select_for_update().select_related(
        "company", "receipt", "journal_entry",
    ).get(pk=voucher.pk)
    reason = str(request.data.get("reason", "")).strip()
    if voucher.status != "POSTED" or not reason:
        raise ValidationError({"reason": "Phiếu đã ghi sổ và lý do bỏ ghi sổ là bắt buộc."})
    period = AccountingPeriod.objects.filter(
        company=voucher.company, start_date__lte=voucher.allocation_date,
        end_date__gte=voucher.allocation_date, status="OPEN",
    ).first()
    if not period:
        raise ValidationError({"allocation_date": "Kỳ phân bổ đã đóng."})
    receipt = models.Receipt.objects.select_for_update().get(pk=voucher.receipt_id)
    if not receipt_source_is_posted(receipt):
        raise ValidationError("Chứng từ thu không còn hiệu lực.")
    lines = list(voucher.lines.select_related("allocation", "receivable").order_by("pk"))
    own_ids = [line.allocation_id for line in lines]
    if receipt.allocations.filter(reversed_at__isnull=True, created_at__gt=voucher.posted_at).exclude(pk__in=own_ids).exists():
        raise ValidationError("Khoản thu có phân bổ phát sinh sau phiếu này.")
    for line in lines:
        if models.ReceiptAllocation.objects.filter(
            receivable=line.receivable, reversed_at__isnull=True,
            created_at__gt=voucher.posted_at,
        ).exclude(pk__in=own_ids).exists():
            raise ValidationError("Công nợ có phân bổ phát sinh sau phiếu này.")
        rec=line.receivable
        if rec.nettings.filter(posted_at__gt=voucher.posted_at).exists() or rec.adjustments.filter(
            posted_at__gt=voucher.posted_at
        ).exists() or rec.schedule_histories.filter(changed_at__gt=voucher.posted_at).exists():
            raise ValidationError("Công nợ có nghiệp vụ phụ thuộc sau phiếu phân bổ.")
    for line in lines:
        schedule = None
        if line.installment_no:
            schedule = models.ReceivableSchedule.objects.select_for_update().filter(
                receivable_id=line.receivable_id, installment_no=line.installment_no,
            ).first()
            if schedule is None or schedule.collected_amount < line.amount:
                raise ValidationError("Không thể hoàn tác đợt thanh toán đã thay đổi.")
        rec = models.Receivable.objects.select_for_update().get(pk=line.receivable_id)
        if rec.collected_amount < line.amount:
            raise ValidationError("Không thể hoàn tác công nợ đã thay đổi.")
        rec.collected_amount -= line.amount
        rec.balance += line.amount
        services.update_debt(rec)
        if schedule:
            schedule.collected_amount -= line.amount
            schedule.balance += line.amount
            schedule.status = "OPEN" if schedule.collected_amount == 0 else "PARTIALLY_PAID"
            schedule.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
        line.allocation.reversed_at = timezone.now()
        line.allocation.save(update_fields=("reversed_at",))
        line.allocation = None
        line.save(update_fields=("allocation",))
        receipt.allocated_amount -= line.amount
    if receipt.allocated_amount == 0 and not models.CustomerReceiptVoucher.objects.filter(receipt=receipt).exists():
        receipt.credit_account = None
        receipt.save(update_fields=("allocated_amount", "credit_account"))
    else:
        receipt.save(update_fields=("allocated_amount",))
    if voucher.journal_entry_id:
        from general_ledger.services import reverse as reverse_journal
        proxy = type("RequestProxy", (), {
            "user": request.user, "data": {
                "reason": reason, "period": str(period.pk),
                "posting_date": voucher.allocation_date,
                "number": f"REV-GL-{voucher.number}-{voucher.posting_count}",
            },
            "META": request.META, "headers": request.headers,
            "method": request.method, "path": request.path,
        })()
        reverse_journal(voucher.journal_entry, proxy)
        voucher.journal_entry = None
    voucher.status = "DRAFT"
    voucher.unposted_by = request.user.iam_account
    voucher.unposted_at = timezone.now()
    voucher.unpost_reason = reason
    voucher.save()
    services.audit(request, voucher, "UNPOST", after={"status": voucher.status}, reason=reason)
    return voucher


@transaction.atomic
def cancel(voucher, request):
    voucher = models.ReceiptAllocationVoucher.objects.select_for_update().get(pk=voucher.pk)
    reason = str(request.data.get("reason", "")).strip()
    if voucher.status != "DRAFT" or not reason:
        raise ValidationError({"reason": "Chỉ phiếu nháp có lý do mới được hủy."})
    voucher.status = "CANCELLED"
    voucher.cancel_reason = reason
    voucher.cancelled_at = timezone.now()
    voucher.save(update_fields=("status", "cancel_reason", "cancelled_at", "updated_at"))
    services.audit(request, voucher, "CANCEL", after={"status": voucher.status}, reason=reason)
    return voucher
