"""UC-AR-03 customer receipt voucher workflow and atomic posting."""
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from cash_management.models import CashFund, CashTransaction
from bank_management.models import AccountProfile, BankTransaction
from general_ledger.models import Account, AccountingPeriod, AccountStatus, JournalEntry, JournalLine
from master_data.models import DocumentNumberingRule, ExchangeRate
from . import models, services


from django.db import connection

ZERO = Decimal("0")


def _lock(qs):
    if connection.vendor == "sqlite":
        return qs
    return qs.select_for_update()


def _required(condition, field, message):
    if not condition:
        raise ValidationError({field: message})


def validate_voucher_data(attrs, instance=None, lines=None):
    def value(name):
        return attrs.get(name, getattr(instance, name, None))
    company, branch, customer = value("company"), value("branch"), value("customer")
    _required(company and branch and branch.company_id == company.id, "branch", "Chi nhánh không thuộc doanh nghiệp.")
    _required(customer and customer.company_id == company.id and customer.status == "ACTIVE", "customer", "Khách hàng không hoạt động trong doanh nghiệp.")
    method, fund, account = value("method"), value("cash_fund"), value("bank_account")
    _required(method in {"CASH", "BANK"}, "method", "Phương thức thu không hợp lệ.")
    if method == "CASH":
        _required(fund and fund.company_id == company.id and fund.branch_id == branch.id and fund.status == "ACTIVE", "cash_fund", "Quỹ không hoạt động hoặc ngoài chi nhánh.")
        _required(account is None, "bank_account", "Thu tiền mặt không chọn tài khoản ngân hàng.")
        debit = fund.gl_account
    else:
        _required(account and account.company_id == company.id and account.status == "ACTIVE" and account.allow_receipt, "bank_account", "Tài khoản ngân hàng không thể nhận tiền.")
        _required(account.branch_id is None or account.branch_id == branch.id, "bank_account", "Tài khoản ngân hàng ngoài chi nhánh.")
        _required(fund is None, "cash_fund", "Chuyển khoản không chọn quỹ tiền mặt.")
        debit = account.gl_account
        _required(AccountProfile.objects.filter(account=account).exists(), "bank_account", "Tài khoản ngân hàng chưa có sổ tiền gửi.")
    _required(debit and debit.company_id == company.id and debit.status == AccountStatus.ACTIVE, "debit_account", "Tài khoản Nợ chưa được cấu hình hoặc không hoạt động.")
    credit = value("credit_account")
    _required(credit and credit.company_id == company.id and credit.status == AccountStatus.ACTIVE, "credit_account", "Tài khoản Có không hợp lệ.")
    _required(value("amount") and value("amount") > 0, "amount", "Số tiền thu phải lớn hơn 0.")
    _required(value("document_date") and value("posting_date"), "posting_date", "Ngày chứng từ và ngày hạch toán là bắt buộc.")
    _required(bool(value("description") and value("description").strip()), "description", "Diễn giải là bắt buộc.")
    if value("exchange_rate") is not None:
        _required(value("exchange_rate") > 0, "exchange_rate", "Tỷ giá phải lớn hơn 0.")
    purpose = value("purpose")
    effective_lines = lines if lines is not None else list(instance.lines.all()) if instance else []
    _required(purpose != "ADVANCE" or not effective_lines, "lines", "Ứng trước không có dòng phân bổ.")
    total = sum((item["amount"] if isinstance(item, dict) else item.amount for item in effective_lines), ZERO)
    _required(total <= value("amount"), "lines", "Tổng phân bổ vượt số tiền thu.")
    currency = fund.currency if method == "CASH" else account.currency
    if currency.pk == company.accounting_currency_id and value("exchange_rate") is not None:
        _required(value("exchange_rate") == 1, "exchange_rate", "Đồng tiền hạch toán phải có tỷ giá bằng 1.")
    per_rec = {}
    per_schedule = {}
    for item in effective_lines:
        rec = item["receivable"] if isinstance(item, dict) else item.receivable
        schedule = item.get("schedule") if isinstance(item, dict) else item.schedule
        amount = item["amount"] if isinstance(item, dict) else item.amount
        _required(amount > 0, "lines", "Số tiền phân bổ phải lớn hơn 0.")
        _required(
            rec.company_id == company.id and rec.customer_id == customer.id
            and rec.currency_id == currency.id and rec.account_id == credit.id
            and rec.status != models.ReceivableStatus.REVERSED,
            "lines", "Khoản phải thu khác khách hàng, loại tiền hoặc tài khoản Có.",
        )
        _required(not schedule or schedule.receivable_id == rec.id, "lines", "Đợt thanh toán không thuộc khoản phải thu.")
        per_rec[rec.id] = per_rec.get(rec.id, ZERO) + amount
        _required(per_rec[rec.id] <= rec.balance, "lines", f"Khoản {rec.code} chỉ còn {rec.balance}.")
        if schedule:
            per_schedule[schedule.id] = per_schedule.get(schedule.id, ZERO) + amount
            _required(per_schedule[schedule.id] <= schedule.balance, "lines", "Phân bổ vượt số dư đợt thanh toán.")
    if value("sales_order") is not None:
        _required(value("sales_order").customer_id == customer.id, "sales_order", "Đơn bán không thuộc khách hàng.")
    if value("sales_contract") is not None:
        _required(value("sales_contract").customer_id == customer.id, "sales_contract", "Hợp đồng không thuộc khách hàng.")


def _rate(company, currency, posting_date):
    if currency.pk == company.accounting_currency_id:
        return Decimal("1")
    row = ExchangeRate.objects.filter(
        company=company, from_currency=currency,
        to_currency_id=company.accounting_currency_id, effective_date__lte=posting_date,
    ).order_by("-effective_date", "-created_at").first()
    if not row:
        raise ValidationError({"exchange_rate": "Chưa có tỷ giá cho ngày hạch toán."})
    return row.rate


def _next_number(company, branch, posting_date):
    rules = DocumentNumberingRule.objects.filter(
        company=company, document_type__code="AR.RECEIPT_VOUCHER",
        status="ACTIVE", effective_from__lte=posting_date,
    ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=posting_date))
    rule = (rules.filter(branch=branch).order_by("-effective_from").first()
            or rules.filter(branch__isnull=True).order_by("-effective_from").first())
    if rule:
        sep = rule.separator or "-"
        parts = [rule.prefix or "AR-RC"]
        if rule.include_branch_code:
            parts.append(branch.code)
        if rule.include_fiscal_year:
            parts.append(str(posting_date.year))
        prefix = sep.join(parts) + sep
        suffix = sep + rule.suffix if rule.suffix else ""
        width = rule.padding_length
    else:
        prefix, suffix, width = f"AR-RC-{posting_date.year}-", "", 5
    numbers = models.CustomerReceiptVoucher.objects.filter(
        company=company, number__startswith=prefix,
    ).values_list("number", flat=True)
    used = []
    for number in numbers:
        middle = number[len(prefix):]
        if suffix:
            if not middle.endswith(suffix):
                continue
            middle = middle[:-len(suffix)]
        if middle.isdigit():
            used.append(int(middle))
    return f"{prefix}{max(used, default=0) + 1:0{width}d}{suffix}"


@transaction.atomic
def save_voucher(data, instance, request):
    data = dict(data)
    lines = data.pop("lines", None)
    creating = instance is None
    if instance:
        instance = models.CustomerReceiptVoucher.objects.select_for_update().get(pk=instance.pk)
        if instance.status not in {"DRAFT", "REVISION_REQUESTED", "REJECTED"}:
            raise ValidationError("Trạng thái chứng từ không cho phép sửa.")
    method = data.get("method", instance.method if instance else "CASH")
    fund = data.get("cash_fund", instance.cash_fund if instance else None)
    account = data.get("bank_account", instance.bank_account if instance else None)
    currency = fund.currency if method == "CASH" else account.currency
    debit = fund.gl_account if method == "CASH" else account.gl_account
    company = data.get("company", instance.company if instance else None)
    posting_date = data.get("posting_date", instance.posting_date if instance else None)
    if instance is None and not data.get("payer_name"):
        contact=data["customer"].contacts.filter(is_default=True,status="ACTIVE").first()
        if contact:
            data["payer_name"]=contact.contact_name
    data["currency"] = currency
    data["debit_account"] = debit
    if "exchange_rate" not in data:
        data["exchange_rate"] = instance.exchange_rate if instance else _rate(company, currency, posting_date)
    if instance is None:
        from organization.models import Company
        from iam.models import UserAccount
        _lock(Company.objects).get(pk=company.pk)
        number = _next_number(company,data["branch"],posting_date)
        creator = getattr(request.user, "iam_account", None) if hasattr(request, "user") else None
        if not creator:
            creator = UserAccount.objects.first()
        instance = models.CustomerReceiptVoucher.objects.create(
            **data, number=number, created_by=creator,
        )
    else:
        for key, value in data.items():
            setattr(instance, key, value)
        instance.save()
    if lines is not None:
        instance.lines.all().delete()
        models.CustomerReceiptLine.objects.bulk_create(
            [models.CustomerReceiptLine(voucher=instance, **line) for line in lines]
        )
    services.audit(request, instance, "CREATE" if creating else "EDIT",
                   after={"status": instance.status, "number": instance.number})
    return instance


@transaction.atomic
def transition(voucher, action, request):
    voucher = _lock(models.CustomerReceiptVoucher.objects).get(pk=voucher.pk)
    before = voucher.status
    if action == "submit":
        if before not in {"DRAFT", "REVISION_REQUESTED", "REJECTED"}:
            raise ValidationError("Chứng từ không thể gửi duyệt.")
        configured = configured_snapshot(voucher, "AR.RECEIPT_VOUCHER")
        if configured is not None:
            voucher.workflow_snapshot = configured
            voucher.approval_required = configured["approval_required"]
        voucher.status = "PENDING_APPROVAL" if voucher.approval_required else "APPROVED"
        voucher.submitted_at = timezone.now()
        if voucher.status == "APPROVED":
            voucher.approved_at = timezone.now()
        decision=models.CustomerReceiptApproval.objects.create(
            voucher=voucher, decision="SUBMITTED", actor=request.user.iam_account,
        )
    elif action in {"approve", "reject", "request_revision"}:
        if before != "PENDING_APPROVAL":
            raise ValidationError("Chứng từ không chờ duyệt.")
        if voucher.created_by_id == request.user.iam_account.id and not voucher.workflow_snapshot.get("allow_self_approval", False):
            raise ValidationError("Không được tự phê duyệt.")
        comment = str(request.data.get("comment", "")).strip()
        if action != "approve" and not comment:
            raise ValidationError({"comment": "Lý do là bắt buộc."})
        history=voucher.decisions.all()
        progress=approval_progress(voucher,request.user.iam_account,action=="approve",history)
        level=progress["level"] if progress else history.filter(decision="APPROVED").count()+1
        final=progress["final"] if progress else level>=int(voucher.workflow_snapshot.get("levels",1))
        voucher.status = (
            "APPROVED" if action=="approve" and final else
            "PENDING_APPROVAL" if action=="approve" else
            "REJECTED" if action=="reject" else "REVISION_REQUESTED"
        )
        if action == "approve":
            if final:
                voucher.approved_by = request.user.iam_account
                voucher.approved_at = timezone.now()
        decision=models.CustomerReceiptApproval.objects.create(
            voucher=voucher, level=level,
            decision="APPROVED" if action=="approve" else "REVISION_REQUIRED" if action=="request_revision" else "REJECTED",
            actor=request.user.iam_account, comment=comment,
        )
    elif action == "recall":
        if before != "PENDING_APPROVAL":
            raise ValidationError("Chỉ chứng từ chờ duyệt mới được thu hồi.")
        if voucher.created_by_id != request.user.iam_account.id:
            raise ValidationError("Chỉ người lập được thu hồi chứng từ.")
        voucher.status = "DRAFT"
    elif action == "cancel":
        if before not in {"DRAFT", "REVISION_REQUESTED", "REJECTED", "APPROVED"}:
            raise ValidationError("Không thể hủy chứng từ đã ghi sổ.")
        reason = str(request.data.get("reason", "")).strip()
        if not reason:
            raise ValidationError({"reason": "Lý do hủy là bắt buộc."})
        voucher.status = "CANCELLED"
        voucher.cancel_reason = reason
        voucher.cancelled_at = timezone.now()
    else:
        raise ValidationError("Thao tác không hợp lệ.")
    voucher.save()
    if action in {"submit","approve","reject","request_revision"} and voucher.workflow_snapshot.get("version_id"):
        from approval_workflows.requests import sync_source_decision
        sync_source_decision(decision)
    if action == "recall" and voucher.workflow_snapshot.get("version_id"):
        from approval_workflows.models import ApprovalRequest
        item=_lock(ApprovalRequest.objects).filter(
            source_model=voucher._meta.label,source_id=voucher.pk,
        ).order_by("-round_number").first()
        if item and item.status in {"PENDING_APPROVAL","IN_PROGRESS"}:
            item.status="CANCELLED"
            item.completed_at=timezone.now()
            item.save(update_fields=("status","completed_at","updated_at"))
            item.tasks.filter(status="PENDING").update(status="CANCELLED",completed_at=timezone.now())
    services.audit(request, voucher, action.upper(), before={"status": before}, after={"status": voucher.status})
    return voucher


def suggest_allocations(company, branch, customer, currency, account, amount):
    debts = models.Receivable.objects.filter(
        company=company, branch=branch, customer=customer, currency=currency,
        account=account, balance__gt=0,
    ).exclude(status=models.ReceivableStatus.REVERSED).prefetch_related("schedules")
    candidates = []
    for rec in debts:
        schedules = list(rec.schedules.filter(balance__gt=0))
        if schedules:
            for sched in schedules:
                candidates.append((sched.due_date, rec.posting_date, rec.code, str(sched.id), rec, sched, sched.balance))
        else:
            candidates.append((rec.due_date, rec.posting_date, rec.code, "", rec, None, rec.balance))
    remaining = amount
    result = []
    for _, _, _, _, rec, sched, balance in sorted(candidates):
        value = min(remaining, balance)
        if value <= 0:
            break
        result.append({"receivable": str(rec.id), "schedule": str(sched.id) if sched else None, "amount": value})
        remaining -= value
    return result


@transaction.atomic
def post(voucher, request):
    voucher = _lock(models.CustomerReceiptVoucher.objects.select_related(
        "company", "branch", "customer", "currency", "cash_fund", "bank_account",
        "debit_account", "credit_account",
    )).get(pk=voucher.pk)
    if voucher.status == "POSTED":
        return voucher
    configured = configured_snapshot(voucher, "AR.RECEIPT_VOUCHER")
    approval_required = configured["approval_required"] if configured is not None else voucher.approval_required
    if configured is not None and configured["approval_required"] and not voucher.workflow_snapshot.get("version_id"):
        raise ValidationError("Chứng từ phải được gửi qua Workflow phê duyệt.")
    if voucher.status not in ({"APPROVED"} if approval_required else {"DRAFT", "APPROVED"}):
        raise ValidationError("Chứng từ chưa đủ điều kiện ghi sổ.")
    validate_voucher_data({}, voucher)
    period = AccountingPeriod.objects.filter(
        company=voucher.company, start_date__lte=voucher.posting_date,
        end_date__gte=voucher.posting_date, status="OPEN",
    ).first()
    if not period:
        raise ValidationError({"posting_date": "Không có kỳ kế toán đang mở."})
    if voucher.bank_reference and models.CustomerReceiptVoucher.objects.filter(
        company=voucher.company, bank_reference=voucher.bank_reference, status="POSTED",
    ).exclude(pk=voucher.pk).exists():
        raise ValidationError({"bank_reference": "Mã giao dịch ngân hàng đã được ghi nhận."})
    if voucher.method == "BANK" and voucher.bank_reference and BankTransaction.objects.filter(
        company=voucher.company, bank_reference=voucher.bank_reference, status="POSTED",
    ).exists():
        raise ValidationError({"bank_reference": "Mã giao dịch ngân hàng đã được ghi nhận."})
    lines = list(voucher.lines.select_related("receivable", "schedule").order_by("id"))
    if voucher.purpose == "ADVANCE" and lines:
        raise ValidationError("Ứng trước không có dòng phân bổ.")
    if sum((line.amount for line in lines), ZERO) > voucher.amount:
        raise ValidationError("Tổng phân bổ vượt số tiền thu.")
    # Lock receivables in stable order and verify again at the posting instant.
    recs = {
        str(rec.id): rec for rec in _lock(models.Receivable.objects).filter(
            pk__in=[line.receivable_id for line in lines],
        ).order_by("pk")
    }
    used = {}
    schedule_used = {}
    for line in lines:
        rec = recs[str(line.receivable_id)]
        used[rec.id] = used.get(rec.id, ZERO) + line.amount
        if used[rec.id] > rec.balance:
            raise ValidationError({"lines": f"Khoản {rec.code} chỉ còn {rec.balance}."})
        if line.schedule_id:
            schedule_used[line.schedule_id] = schedule_used.get(line.schedule_id, ZERO) + line.amount
            sched = models.ReceivableSchedule.objects.select_for_update().get(pk=line.schedule_id)
            if sched.receivable_id != rec.id or schedule_used[line.schedule_id] > sched.balance:
                raise ValidationError({"lines": "Số tiền phân bổ vượt số dư đợt thanh toán."})
    now = timezone.now()
    base_amount = (voucher.amount * voucher.exchange_rate).quantize(Decimal("0.0001"))
    allocated_amount = sum((line.amount for line in lines), ZERO)
    ar_credit = (
        sum((line.amount * recs[str(line.receivable_id)].exchange_rate for line in lines), ZERO)
        + (voucher.amount - allocated_amount) * voucher.exchange_rate
    ).quantize(Decimal("0.0001"))
    fx_difference = base_amount - ar_credit
    fx_account = None
    if fx_difference:
        fx_code = "515" if fx_difference > 0 else "635"
        fx_account = Account.objects.filter(
            company=voucher.company, code=fx_code, status=AccountStatus.ACTIVE,
        ).first()
        if not fx_account:
            raise ValidationError({"exchange_rate": f"Thiếu tài khoản chênh lệch tỷ giá {fx_code}."})
    receipt = models.Receipt.objects.create(
        company=voucher.company, customer=voucher.customer, currency=voucher.currency,
        branch=voucher.branch, credit_account=voucher.credit_account,
        receipt_date=voucher.posting_date, amount=voucher.amount,
        exchange_rate=voucher.exchange_rate, base_amount=base_amount,
        external_type=voucher.method, external_reference=str(voucher.id),
        company_bank_account=voucher.bank_account, cash_fund=voucher.cash_fund,
        created_by=request.user.iam_account,
    )
    if voucher.method == "CASH":
        fund = CashFund.objects.select_for_update().get(pk=voucher.cash_fund_id)
        fund.balance += voucher.amount
        fund.save(update_fields=("balance", "updated_at"))
        money_tx = CashTransaction.objects.create(
            company=voucher.company, fund=fund, number=voucher.number,
            transaction_type="RECEIPT", business_type="AR_CUSTOMER_RECEIPT",
            transaction_date=voucher.posting_date, party=voucher.customer,
            payer_payee=voucher.payer_name or voucher.customer.name,
            currency=voucher.currency, amount=voucher.amount,
            exchange_rate=voucher.exchange_rate, base_amount=base_amount,
            description=voucher.description, attachments=voucher.attachments,
            status="POSTED", approval_required=False, balance_applied=True,
            gl_status="POSTED", source_module="AR", source_reference=str(receipt.id),
            created_by=request.user.iam_account, cashier=request.user.iam_account, posted_at=now,
        )
        voucher.cash_transaction = money_tx
    else:
        profile = AccountProfile.objects.select_for_update().get(account_id=voucher.bank_account_id)
        profile.balance += voucher.amount
        profile.save(update_fields=("balance", "updated_at"))
        money_tx = BankTransaction.objects.create(
            company=voucher.company, account=profile, number=voucher.number,
            transaction_type="RECEIPT", business_type="AR_CUSTOMER_RECEIPT",
            transaction_date=voucher.posting_date, value_date=voucher.posting_date,
            party=voucher.customer, counterparty_name=voucher.payer_name or voucher.customer.name,
            currency=voucher.currency, amount=voucher.amount,
            exchange_rate=voucher.exchange_rate, base_amount=base_amount,
            description=voucher.description, bank_reference=voucher.bank_reference,
            status="POSTED", approval_required=False, balance_applied=True,
            gl_status="POSTED", source_module="AR", source_reference=str(receipt.id),
            created_by=request.user.iam_account, posted_at=now,
        )
        voucher.bank_transaction = money_tx
    journal = JournalEntry.objects.create(
        company=voucher.company, branch=voucher.branch, period=period,
        number=f"GL-{voucher.number}", entry_type="SUBLEDGER",
        posting_date=voucher.posting_date, document_date=voucher.document_date,
        description=voucher.description, source_module="AR",
        source_event_id=f"AR_RECEIPT:{voucher.id}",
        source_entity_type="CustomerReceiptVoucher", source_entity_id=voucher.id,
        status="APPROVED", workflow_snapshot={"allow_creator_posting": True},
        total_debit=base_amount + max(-fx_difference, ZERO),
        total_credit=ar_credit + max(fx_difference, ZERO),
        created_by=request.user.iam_account, approved_by=request.user.iam_account,
        approved_at=now,
    )
    JournalLine.objects.create(
        entry=journal, line_no=1, account=voucher.debit_account,
        debit=base_amount, currency=voucher.currency, foreign_amount=voucher.amount,
        exchange_rate=voucher.exchange_rate, party=voucher.customer,
        description=voucher.description,
        dimensions={"bank_account_id": str(voucher.bank_account_id)} if voucher.bank_account_id else {},
    )
    JournalLine.objects.create(
        entry=journal, line_no=2, account=voucher.credit_account,
        credit=ar_credit, currency=voucher.currency, foreign_amount=voucher.amount,
        exchange_rate=voucher.exchange_rate, party=voucher.customer,
        description=voucher.description,
    )
    if fx_account:
        JournalLine.objects.create(
            entry=journal, line_no=3, account=fx_account,
            debit=max(-fx_difference, ZERO), credit=max(fx_difference, ZERO),
            currency=voucher.company.accounting_currency,
            foreign_amount=abs(fx_difference), exchange_rate=1,
            party=voucher.customer, description="Chênh lệch tỷ giá thu tiền",
        )
    from general_ledger.services import post as post_journal
    post_journal(journal, request)
    money_tx.gl_reference = journal.number
    money_tx.save(update_fields=("gl_reference", "updated_at"))
    for line in lines:
        rec = recs[str(line.receivable_id)]
        allocation = models.ReceiptAllocation.objects.create(
            receipt=receipt, receivable=rec, schedule=line.schedule,
            installment_no=line.schedule.installment_no if line.schedule_id else None,
            amount=line.amount, effective_date=voucher.posting_date,
            receipt_book_amount=(line.amount*voucher.exchange_rate).quantize(Decimal("0.0001")),
            debt_book_amount=(line.amount*rec.exchange_rate).quantize(Decimal("0.0001")),
            created_by=request.user.iam_account,
        )
        line.receipt_allocation = allocation
        line.save(update_fields=("receipt_allocation",))
        rec.collected_amount += line.amount
        rec.balance -= line.amount
        services.update_debt(rec)
        if line.schedule_id:
            schedules = [models.ReceivableSchedule.objects.select_for_update().get(pk=line.schedule_id)]
        else:
            schedules = list(rec.schedules.select_for_update().filter(balance__gt=0).order_by("installment_no"))
        remaining = line.amount
        for schedule in schedules:
            value = min(remaining, schedule.balance)
            schedule.collected_amount += value
            schedule.balance -= value
            schedule.status = "PAID" if schedule.balance == 0 else "PARTIALLY_PAID"
            schedule.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
            remaining -= value
            if remaining <= 0:
                break
    receipt.allocated_amount = allocated_amount
    receipt.save(update_fields=("allocated_amount",))
    voucher.status = "POSTED"
    voucher.receipt = receipt
    voucher.journal_entry = journal
    voucher.posted_by = request.user.iam_account
    voucher.posted_at = now
    voucher.save()
    services.audit(request, voucher, "POST", after={"receipt": str(receipt.id), "journal": str(journal.id)})
    return voucher
