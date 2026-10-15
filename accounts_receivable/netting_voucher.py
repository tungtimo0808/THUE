"""UC-AR-05: Debt Netting Voucher workflow, atomic posting, unposting, and debt synchronization."""
from decimal import Decimal
import re

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from general_ledger.models import Account, AccountStatus, AccountingPeriod, JournalEntry, JournalLine
from master_data.models import DocumentNumberingRule, ExchangeRate, PartyRole
from . import models, services

ZERO = Decimal("0")
SCALE = Decimal("0.0001")


def _fail(condition, field, message):
    if not condition:
        raise ValidationError({field: message})


def get_linked_supplier(customer):
    """
    BR02: Check if customer is also declared as vendor/supplier of the same entity.
    """
    if customer is None:
        return None
    # 1. Same party with VENDOR role or vendor profile
    has_vendor_role = customer.roles.filter(role_type="VENDOR").exists()
    has_vendor_profile = hasattr(customer, "vendor_profile")
    if has_vendor_role or has_vendor_profile:
        return customer
    # 2. If party has merged_into or explicit link
    if getattr(customer, "merged_into_id", None):
        merged = customer.merged_into
        if merged.roles.filter(role_type="VENDOR").exists() or hasattr(merged, "vendor_profile"):
            return merged
    return None


def generate_voucher_number(company, branch=None):
    rule = DocumentNumberingRule.objects.filter(
        company=company, document_type__code="AR.NETTING_VOUCHER", status="ACTIVE"
    ).first()
    if rule:
        return rule.generate_next_number(company=company, branch=branch)
    today = timezone.localdate()
    year = today.year
    prefix = f"AR-NT-{year}-"
    last = models.DebtNettingVoucher.objects.filter(
        company=company, number__startswith=prefix
    ).order_by("-number").values_list("number", flat=True).first()
    if last:
        match = re.search(r"(\d+)$", last)
        next_seq = int(match.group(1)) + 1 if match else 1
    else:
        next_seq = 1
    return f"{prefix}{next_seq:05d}"


def validate_voucher_data(attrs, instance=None, lines=None):
    def val(name):
        return attrs.get(name, getattr(instance, name, None))

    company, branch, customer = val("company"), val("branch"), val("customer")
    _fail(company and branch and branch.company_id == company.pk, "branch", "Chi nhánh không thuộc doanh nghiệp.")
    _fail(customer and customer.company_id == company.pk, "customer", "Khách hàng không thuộc doanh nghiệp.")
    _fail(customer.status == "ACTIVE", "customer", "Khách hàng không ở trạng thái hoạt động.")

    supplier = get_linked_supplier(customer)
    _fail(supplier is not None, "customer", "Khách hàng chưa liên kết với hồ sơ nhà cung cấp của cùng đối tượng.")
    _fail(supplier.status == "ACTIVE", "customer", "Hồ sơ nhà cung cấp liên kết không ở trạng thái hoạt động.")

    currency = val("currency")
    _fail(currency and getattr(currency, "is_active", True), "currency", "Loại tiền không hợp lệ hoặc không hoạt động.")

    rec_account = val("receivable_account")
    _fail(rec_account and rec_account.company_id == company.pk and rec_account.status == AccountStatus.ACTIVE,
          "receivable_account", "Tài khoản phải thu không hợp lệ hoặc không hoạt động.")

    pay_account = val("payable_account")
    _fail(pay_account and pay_account.company_id == company.pk and pay_account.status == AccountStatus.ACTIVE,
          "payable_account", "Tài khoản phải trả không hợp lệ hoặc không hoạt động.")

    _fail(val("document_date"), "document_date", "Ngày chứng từ là bắt buộc.")
    _fail(val("posting_date"), "posting_date", "Ngày hạch toán là bắt buộc.")

    desc = val("description")
    if not desc or not desc.strip():
        attrs["description"] = f"Bù trừ công nợ {customer.name}"

    effective_lines = lines if lines is not None else (
        list(instance.lines.select_related("receivable", "receivable_schedule", "payable")) if instance else []
    )

    if effective_lines:
        pairs = set()
        by_rec = {}
        by_sched = {}
        by_payable = {}

        for item in effective_lines:
            rec = item["receivable"] if isinstance(item, dict) else item.receivable
            sched = item.get("receivable_schedule") if isinstance(item, dict) else item.receivable_schedule
            payable = item["payable"] if isinstance(item, dict) else item.payable
            amount = Decimal(str(item["amount"] if isinstance(item, dict) else item.amount))

            _fail(amount > 0, "lines", "Số tiền bù trừ trên mỗi dòng phải lớn hơn 0.")

            # Receivable validations
            _fail(rec.company_id == company.pk, "lines", "Khoản phải thu không thuộc doanh nghiệp.")
            _fail(rec.customer_id == customer.pk, "lines", "Khoản phải thu không thuộc khách hàng đã chọn.")
            _fail(rec.currency_id == currency.pk, "lines", "Khoản phải thu khác loại tiền đã chọn.")
            _fail(rec.account_id == rec_account.pk, "lines", "Khoản phải thu khác tài khoản phải thu đã chọn.")
            _fail(rec.status in {models.ReceivableStatus.OPEN, models.ReceivableStatus.PARTIALLY_PAID},
                  "lines", f"Khoản phải thu {rec.code} không còn hiệu lực.")

            # Payable validations
            from accounts_payable.models import Payable, PayableStatus
            _fail(payable.company_id == company.pk, "lines", "Khoản phải trả không thuộc doanh nghiệp.")
            _fail(payable.supplier_id == supplier.pk, "lines", "Khoản phải trả không thuộc nhà cung cấp liên kết.")
            _fail(payable.currency_id == currency.pk, "lines", "Khoản phải trả khác loại tiền đã chọn.")
            _fail(payable.status in {PayableStatus.OPEN, PayableStatus.PARTIALLY_PAID},
                  "lines", "Khoản phải trả không còn hiệu lực.")

            # Schedule validation
            if sched:
                _fail(sched.receivable_id == rec.pk, "lines", "Đợt thanh toán không thuộc khoản phải thu.")
                _fail(sched.status in {models.ReceivableStatus.OPEN, models.ReceivableStatus.PARTIALLY_PAID},
                      "lines", "Đợt thanh toán không còn hiệu lực.")

            # Pair uniqueness
            pair_key = (rec.pk, sched.pk if sched else None, payable.pk)
            _fail(pair_key not in pairs, "lines", "Không lặp cùng cặp khoản phải thu, đợt thanh toán và khoản phải trả.")
            pairs.add(pair_key)

            # Cumulative balance check
            by_rec[rec.pk] = by_rec.get(rec.pk, ZERO) + amount
            _fail(by_rec[rec.pk] <= rec.balance, "lines",
                  f"Khoản phải thu {rec.code} chỉ còn số dư {rec.balance}.")

            if sched:
                by_sched[sched.pk] = by_sched.get(sched.pk, ZERO) + amount
                _fail(by_sched[sched.pk] <= sched.balance, "lines",
                      f"Đợt {sched.installment_no} chỉ còn số dư {sched.balance}.")

            by_payable[payable.pk] = by_payable.get(payable.pk, ZERO) + amount
            _fail(by_payable[payable.pk] <= payable.balance, "lines",
                  f"Khoản phải trả chỉ còn số dư {payable.balance}.")

    return supplier


def save_voucher(data, instance=None, user=None):
    lines_data = data.pop("lines", None)
    if instance is None:
        supplier = validate_voucher_data(data, lines=lines_data)
        data.setdefault("supplier", supplier)
        if not data.get("number"):
            data["number"] = generate_voucher_number(data["company"], data.get("branch"))
        from iam.models import UserAccount
        if isinstance(user, UserAccount):
            created_by_user = user
        elif hasattr(user, "iam_account"):
            created_by_user = user.iam_account
        else:
            created_by_user = UserAccount.objects.first()
        data["created_by"] = created_by_user
        voucher = models.DebtNettingVoucher.objects.create(**data)
    else:
        validate_voucher_data(data, instance=instance, lines=lines_data)
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save()
        voucher = instance

    if lines_data is not None:
        voucher.lines.all().delete()
        total_amount = ZERO
        for idx, line_dict in enumerate(lines_data, start=1):
            rec = line_dict["receivable"]
            payable = line_dict["payable"]
            sched = line_dict.get("receivable_schedule")
            amt = Decimal(str(line_dict["amount"]))
            rec_rate = rec.exchange_rate
            pay_rate = payable.exchange_rate
            rec_conv = (amt * rec_rate).quantize(SCALE)
            pay_conv = (amt * pay_rate).quantize(SCALE)
            fx_diff = pay_conv - rec_conv

            models.DebtNettingVoucherLine.objects.create(
                voucher=voucher,
                line_no=idx,
                receivable=rec,
                receivable_schedule=sched,
                payable=payable,
                amount=amt,
                receivable_exchange_rate=rec_rate,
                payable_exchange_rate=pay_rate,
                receivable_converted_amount=rec_conv,
                payable_converted_amount=pay_conv,
                exchange_gain_loss=fx_diff,
            )
            total_amount += amt
        voucher.total_amount = total_amount
        voucher.save(update_fields=("total_amount", "updated_at"))

    return voucher


def transition(voucher, action, request):
    user_account = request.user.iam_account if hasattr(request.user, "iam_account") else None
    comment = request.data.get("comment", "") or request.data.get("reason", "")
    voucher = models.DebtNettingVoucher.objects.select_for_update().get(pk=voucher.pk)

    if action == "submit":
        if voucher.status not in {models.DebtNettingVoucher.Status.DRAFT, models.DebtNettingVoucher.Status.REVISION_REQUESTED}:
            raise ValidationError("Chỉ chứng từ Nháp hoặc Yêu cầu chỉnh sửa mới được gửi duyệt.")
        if not voucher.lines.exists():
            raise ValidationError({"lines": "Cần ít nhất một dòng bù trừ trước khi gửi duyệt."})

        configured = configured_snapshot(voucher, "AR.NETTING_VOUCHER")
        if configured and configured.get("stages"):
            voucher.status = models.DebtNettingVoucher.Status.PENDING_APPROVAL
            voucher.approval_required = True
            voucher.workflow_snapshot = configured
        else:
            # BR08: No workflow configured, auto-approves
            voucher.status = models.DebtNettingVoucher.Status.APPROVED
            voucher.approval_required = False
            voucher.approved_by = user_account
            voucher.approved_at = timezone.now()

        voucher.submitted_at = timezone.now()
        voucher.save(update_fields=("status", "approval_required", "workflow_snapshot",
                                    "approved_by", "approved_at", "submitted_at", "updated_at"))
        services.audit(request, voucher, "SUBMIT", after={"status": voucher.status})
        return voucher

    if action == "recall":
        if voucher.status != models.DebtNettingVoucher.Status.PENDING_APPROVAL:
            raise ValidationError("Chỉ chứng từ đang Chờ duyệt mới được thu hồi.")
        voucher.status = models.DebtNettingVoucher.Status.DRAFT
        voucher.save(update_fields=("status", "updated_at"))
        services.audit(request, voucher, "RECALL", after={"status": voucher.status})
        return voucher

    if action == "approve":
        if voucher.status != models.DebtNettingVoucher.Status.PENDING_APPROVAL:
            raise ValidationError("Chỉ chứng từ đang Chờ duyệt mới được phê duyệt.")
        progress = approval_progress(voucher, user_account, "APPROVE", comment)
        if progress.get("completed", True):
            voucher.status = models.DebtNettingVoucher.Status.APPROVED
            voucher.approved_by = user_account
            voucher.approved_at = timezone.now()
        models.DebtNettingApproval.objects.create(
            voucher=voucher, level=progress.get("level", 1),
            decision="APPROVED", actor=user_account, comment=comment
        )
        voucher.save(update_fields=("status", "approved_by", "approved_at", "updated_at"))
        services.audit(request, voucher, "APPROVE", after={"status": voucher.status}, comment=comment)
        return voucher

    if action == "reject":
        if voucher.status != models.DebtNettingVoucher.Status.PENDING_APPROVAL:
            raise ValidationError("Chỉ chứng từ đang Chờ duyệt mới được từ chối.")
        if not comment or not comment.strip():
            raise ValidationError({"reason": "Cần nhập lý do từ chối."})
        voucher.status = models.DebtNettingVoucher.Status.REJECTED
        voucher.rejection_reason = comment.strip()
        models.DebtNettingApproval.objects.create(
            voucher=voucher, decision="REJECTED", actor=user_account, comment=comment
        )
        voucher.save(update_fields=("status", "rejection_reason", "updated_at"))
        services.audit(request, voucher, "REJECT", after={"status": voucher.status}, reason=comment)
        return voucher

    if action == "request_revision":
        if voucher.status != models.DebtNettingVoucher.Status.PENDING_APPROVAL:
            raise ValidationError("Chỉ chứng từ đang Chờ duyệt mới được yêu cầu chỉnh sửa.")
        if not comment or not comment.strip():
            raise ValidationError({"reason": "Cần nhập lý do yêu cầu chỉnh sửa."})
        voucher.status = models.DebtNettingVoucher.Status.REVISION_REQUESTED
        voucher.revision_reason = comment.strip()
        models.DebtNettingApproval.objects.create(
            voucher=voucher, decision="REVISION_REQUIRED", actor=user_account, comment=comment
        )
        voucher.save(update_fields=("status", "revision_reason", "updated_at"))
        services.audit(request, voucher, "REQUEST_REVISION", after={"status": voucher.status}, reason=comment)
        return voucher

    if action == "cancel":
        if voucher.status not in {
            models.DebtNettingVoucher.Status.DRAFT,
            models.DebtNettingVoucher.Status.REVISION_REQUESTED,
            models.DebtNettingVoucher.Status.REJECTED,
        }:
            raise ValidationError("Chỉ chứng từ chưa ghi sổ (Nháp/Yêu cầu sửa/Từ chối) mới được hủy.")
        reason = request.data.get("reason", "").strip()
        if not reason:
            raise ValidationError({"reason": "Lý do hủy chứng từ là bắt buộc."})
        voucher.status = models.DebtNettingVoucher.Status.CANCELLED
        voucher.cancel_reason = reason
        voucher.cancelled_by = user_account
        voucher.cancelled_at = timezone.now()
        voucher.save(update_fields=("status", "cancel_reason", "cancelled_by", "cancelled_at", "updated_at"))
        services.audit(request, voucher, "CANCEL", after={"status": voucher.status}, reason=reason)
        return voucher

    raise ValidationError(f"Thao tác '{action}' không được hỗ trợ.")


@transaction.atomic
def post_voucher(voucher, request):
    voucher = models.DebtNettingVoucher.objects.select_for_update().get(pk=voucher.pk)
    # BR13: Idempotent if already posted
    if voucher.status == models.DebtNettingVoucher.Status.POSTED:
        return voucher

    # BR08: Check status
    if voucher.approval_required:
        if voucher.status != models.DebtNettingVoucher.Status.APPROVED:
            raise ValidationError("Chứng từ chưa được phê duyệt.")
    else:
        if voucher.status not in {models.DebtNettingVoucher.Status.APPROVED, models.DebtNettingVoucher.Status.DRAFT}:
            raise ValidationError("Trạng thái chứng từ không hợp lệ để ghi sổ.")

    lines = list(voucher.lines.select_related("receivable", "receivable_schedule", "payable").order_by("line_no"))
    if not lines:
        raise ValidationError({"lines": "Chứng từ không có dòng bù trừ nào."})

    # EF07: Check accounting period
    period = AccountingPeriod.objects.filter(
        company=voucher.company,
        start_date__lte=voucher.posting_date,
        end_date__gte=voucher.posting_date,
        status="OPEN",
    ).first()
    if not period:
        raise ValidationError({"posting_date": "Kỳ kế toán đóng hoặc không tồn tại."})

    # BR06 & EF06: Re-verify balances with lock
    recs = {}
    scheds = {}
    payables = {}
    rec_used = {}
    sched_used = {}
    payable_used = {}

    for line in lines:
        r_id = line.receivable_id
        if r_id not in recs:
            recs[r_id] = models.Receivable.objects.select_for_update().get(pk=r_id)
        rec = recs[r_id]
        rec_used[r_id] = rec_used.get(r_id, ZERO) + line.amount
        if rec_used[r_id] > rec.balance:
            raise ValidationError({"lines": f"Số dư khoản phải thu {rec.code} đã thay đổi hoặc không đủ bù trừ."})

        if line.receivable_schedule_id:
            s_id = line.receivable_schedule_id
            if s_id not in scheds:
                scheds[s_id] = models.ReceivableSchedule.objects.select_for_update().get(pk=s_id)
            sched = scheds[s_id]
            sched_used[s_id] = sched_used.get(s_id, ZERO) + line.amount
            if sched_used[s_id] > sched.balance:
                raise ValidationError({"lines": f"Số dư đợt {sched.installment_no} không đủ bù trừ."})

        from accounts_payable.models import Payable
        p_id = line.payable_id
        if p_id not in payables:
            payables[p_id] = Payable.objects.select_for_update().get(pk=p_id)
        p = payables[p_id]
        payable_used[p_id] = payable_used.get(p_id, ZERO) + line.amount
        if payable_used[p_id] > p.balance:
            raise ValidationError({"lines": "Số dư khoản phải trả đã thay đổi hoặc không đủ bù trừ."})

    now = timezone.now()
    user_account = request.user.iam_account if hasattr(request.user, "iam_account") else None

    # Calculate converted amounts and FX difference
    total_payable_conv = sum((line.amount * payables[line.payable_id].exchange_rate for line in lines), ZERO).quantize(SCALE)
    total_rec_conv = sum((line.amount * recs[line.receivable_id].exchange_rate for line in lines), ZERO).quantize(SCALE)
    fx_diff = total_payable_conv - total_rec_conv

    fx_account = None
    if fx_diff != ZERO:
        fx_code = "515" if fx_diff > 0 else "635"
        fx_account = Account.objects.filter(
            company=voucher.company, code=fx_code, status=AccountStatus.ACTIVE,
        ).first()
        if not fx_account:
            raise ValidationError({"exchange_rate": f"Thiếu tài khoản chênh lệch tỷ giá {fx_code}."})

    # GL Journal Entry (BR09, BR10)
    journal = JournalEntry.objects.create(
        company=voucher.company,
        branch=voucher.branch,
        period=period,
        number=f"GL-{voucher.number}",
        entry_type="SUBLEDGER",
        posting_date=voucher.posting_date,
        document_date=voucher.document_date,
        description=voucher.description,
        source_module="AR",
        source_event_id=f"AR_NETTING:{voucher.id}",
        source_entity_type="DebtNettingVoucher",
        source_entity_id=voucher.id,
        status="APPROVED",
        workflow_snapshot={"allow_creator_posting": True},
        total_debit=total_payable_conv + max(-fx_diff, ZERO),
        total_credit=total_rec_conv + max(fx_diff, ZERO),
        created_by=user_account,
        approved_by=user_account,
        approved_at=now,
    )

    line_idx = 1
    # Debit payable (TK 331)
    JournalLine.objects.create(
        entry=journal,
        line_no=line_idx,
        account=voucher.payable_account,
        debit=total_payable_conv,
        credit=ZERO,
        currency=voucher.currency,
        foreign_amount=voucher.total_amount,
        exchange_rate=Decimal("1"),
        party=voucher.supplier,
        description=voucher.description,
    )
    line_idx += 1

    # Credit receivable (TK 131)
    JournalLine.objects.create(
        entry=journal,
        line_no=line_idx,
        account=voucher.receivable_account,
        debit=ZERO,
        credit=total_rec_conv,
        currency=voucher.currency,
        foreign_amount=voucher.total_amount,
        exchange_rate=Decimal("1"),
        party=voucher.customer,
        description=voucher.description,
    )
    line_idx += 1

    # FX difference line if any
    if fx_account and fx_diff != ZERO:
        JournalLine.objects.create(
            entry=journal,
            line_no=line_idx,
            account=fx_account,
            debit=max(-fx_diff, ZERO),
            credit=max(fx_diff, ZERO),
            currency=voucher.company.accounting_currency,
            foreign_amount=abs(fx_diff),
            exchange_rate=Decimal("1"),
            party=voucher.customer,
            description="Chênh lệch tỷ giá bù trừ công nợ",
        )

    from general_ledger.services import post as post_journal
    post_journal(journal, request)

    # Update debts and create linked Netting records
    from accounts_payable.services import update_payable_status
    for line in lines:
        rec = recs[line.receivable_id]
        rec.netted_amount += line.amount
        rec.balance -= line.amount
        services.update_debt(rec)

        if line.receivable_schedule_id:
            sched = scheds[line.receivable_schedule_id]
            sched.collected_amount += line.amount
            sched.balance -= line.amount
            sched.status = (
                models.ReceivableStatus.PAID if sched.balance == ZERO
                else models.ReceivableStatus.PARTIALLY_PAID
            )
            sched.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
        elif rec.schedules.filter(balance__gt=0).exists():
            rem = line.amount
            for s in rec.schedules.select_for_update().filter(balance__gt=0).order_by("installment_no"):
                alloc = min(rem, s.balance)
                s.collected_amount += alloc
                s.balance -= alloc
                s.status = (
                    models.ReceivableStatus.PAID if s.balance == ZERO
                    else models.ReceivableStatus.PARTIALLY_PAID
                )
                s.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
                rem -= alloc
                if rem <= ZERO:
                    break

        p = payables[line.payable_id]
        p.netted_amount += line.amount
        p.balance -= line.amount
        update_payable_status(p)

        # Legacy / Cross-system Netting record for customer debt history
        net_rec = models.Netting.objects.create(
            company=voucher.company,
            number=f"{voucher.number}-{line.line_no}",
            receivable=rec,
            payable=p,
            netting_date=voucher.posting_date,
            amount=line.amount,
            reason=voucher.description,
            posting_reference=voucher.number,
            status=models.PostingStatus.POSTED,
            created_by=user_account,
            posted_at=now,
        )
        line.netting_record = net_rec
        line.receivable_exchange_rate = rec.exchange_rate
        line.payable_exchange_rate = p.exchange_rate
        line.receivable_converted_amount = (line.amount * rec.exchange_rate).quantize(SCALE)
        line.payable_converted_amount = (line.amount * p.exchange_rate).quantize(SCALE)
        line.exchange_gain_loss = line.payable_converted_amount - line.receivable_converted_amount
        line.save(update_fields=(
            "netting_record", "receivable_exchange_rate", "payable_exchange_rate",
            "receivable_converted_amount", "payable_converted_amount", "exchange_gain_loss"
        ))

        # Synchronize Netting record to Accounts Payable module
        from accounts_payable import models as ap_models
        ap_models.Netting.objects.update_or_create(
            company=voucher.company,
            number=f"{voucher.number}-{line.line_no}",
            defaults={
                "payable": p,
                "counterparty_reference": voucher.number,
                "netting_date": voucher.posting_date,
                "amount": line.amount,
                "reason": voucher.description,
                "status": ap_models.PostingStatus.POSTED,
                "created_by": user_account,
            }
        )

    voucher.status = models.DebtNettingVoucher.Status.POSTED
    voucher.journal_entry = journal
    voucher.posted_by = user_account
    voucher.posted_at = now
    voucher.posting_count += 1
    voucher.save(update_fields=("status", "journal_entry", "posted_by", "posted_at", "posting_count", "updated_at"))

    services.audit(request, voucher, "POST", after={"status": voucher.status, "amount": str(voucher.total_amount)})
    return voucher


@transaction.atomic
def unpost_voucher(voucher, request):
    voucher = models.DebtNettingVoucher.objects.select_for_update().get(pk=voucher.pk)
    if voucher.status != models.DebtNettingVoucher.Status.POSTED:
        raise ValidationError("Chỉ chứng từ Đã ghi sổ mới được bỏ ghi sổ.")

    reason = str(request.data.get("reason", "")).strip()
    if not reason:
        raise ValidationError({"reason": "Lý do bỏ ghi sổ là bắt buộc."})

    # EF09: Check accounting period of voucher.posting_date
    period = AccountingPeriod.objects.filter(
        company=voucher.company,
        start_date__lte=voucher.posting_date,
        end_date__gte=voucher.posting_date,
        status="OPEN",
    ).first()
    if not period:
        raise ValidationError({"posting_date": "Kỳ kế toán đã đóng, không thể bỏ ghi sổ."})

    lines = list(voucher.lines.select_related("receivable", "receivable_schedule", "payable", "netting_record").order_by("line_no"))

    # EF09: Check dependent transactions after voucher.posted_at
    for line in lines:
        rec = line.receivable
        if rec.allocations.filter(reversed_at__isnull=True, created_at__gt=voucher.posted_at).exists():
            raise ValidationError("Công nợ phải thu có thu tiền phát sinh sau chứng từ bù trừ này.")
        if rec.adjustments.filter(created_at__gt=voucher.posted_at).exists():
            raise ValidationError("Công nợ phải thu có điều chỉnh phát sinh sau chứng từ bù trừ này.")

        p = line.payable
        if p.allocations.filter(created_at__gt=voucher.posted_at).exists():
            raise ValidationError("Công nợ phải trả có thanh toán phát sinh sau chứng từ bù trừ này.")
        if p.adjustments.filter(created_at__gt=voucher.posted_at).exists():
            raise ValidationError("Công nợ phải trả có điều chỉnh phát sinh sau chứng từ bù trừ này.")

    now = timezone.now()
    user_account = request.user.iam_account if hasattr(request.user, "iam_account") else None

    # Reverse GL journal entry
    if voucher.journal_entry_id:
        from general_ledger.services import reverse as reverse_journal
        proxy = type("RequestProxy", (), {
            "user": request.user,
            "data": {
                "reason": reason,
                "period": str(period.pk),
                "posting_date": voucher.posting_date,
                "number": f"REV-GL-{voucher.number}-{voucher.posting_count}",
            },
            "META": request.META,
            "headers": request.headers,
            "method": request.method,
            "path": request.path,
        })()
        reverse_journal(voucher.journal_entry, proxy)
        voucher.journal_entry = None

    from accounts_payable.services import update_payable_status
    for line in lines:
        rec = models.Receivable.objects.select_for_update().get(pk=line.receivable_id)
        rec.netted_amount -= line.amount
        rec.balance += line.amount
        services.update_debt(rec)

        if line.receivable_schedule_id:
            sched = models.ReceivableSchedule.objects.select_for_update().get(pk=line.receivable_schedule_id)
            sched.collected_amount -= line.amount
            sched.balance += line.amount
            sched.status = (
                models.ReceivableStatus.PARTIALLY_PAID if sched.collected_amount > ZERO
                else models.ReceivableStatus.OPEN
            )
            sched.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
        elif rec.schedules.filter(collected_amount__gt=0).exists():
            rem = line.amount
            for s in rec.schedules.select_for_update().order_by("-installment_no"):
                if s.collected_amount > ZERO:
                    rest = min(rem, s.collected_amount)
                    s.collected_amount -= rest
                    s.balance += rest
                    s.status = (
                        models.ReceivableStatus.PARTIALLY_PAID if s.collected_amount > ZERO
                        else models.ReceivableStatus.OPEN
                    )
                    s.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
                    rem -= rest
                    if rem <= ZERO:
                        break

        from accounts_payable.models import Payable
        from accounts_payable import models as ap_models
        p = Payable.objects.select_for_update().get(pk=line.payable_id)
        p.netted_amount -= line.amount
        p.balance += line.amount
        update_payable_status(p)

        if line.netting_record:
            line.netting_record.status = models.PostingStatus.REVERSED
            line.netting_record.reversed_at = now
            line.netting_record.save(update_fields=("status", "reversed_at"))

        ap_models.Netting.objects.filter(
            company=voucher.company,
            payable=p,
            counterparty_reference=voucher.number,
            status=ap_models.PostingStatus.POSTED,
        ).update(status=ap_models.PostingStatus.REVERSED)

    voucher.status = models.DebtNettingVoucher.Status.DRAFT
    voucher.unposted_by = user_account
    voucher.unposted_at = now
    voucher.unpost_reason = reason
    voucher.save(update_fields=("status", "journal_entry", "unposted_by", "unposted_at", "unpost_reason", "updated_at"))

    services.audit(request, voucher, "UNPOST", after={"status": voucher.status}, reason=reason)
    return voucher


def eligible_debts(company, branch_id=None, customer_id=None, currency_id=None,
                   receivable_account_id=None, payable_account_id=None):
    """
    Returns eligible receivables and payables for offsetting (AF04, Step 1-3).
    """
    from master_data.models import Party
    from accounts_payable.models import Payable, PayableStatus

    if not customer_id:
        return {"supplier": None, "receivables": [], "payables": [], "can_net": False}

    customer = Party.objects.filter(pk=customer_id, company=company).first()
    if not customer:
        return {"supplier": None, "receivables": [], "payables": [], "can_net": False}

    supplier = get_linked_supplier(customer)
    if not supplier:
        return {
            "supplier": None,
            "receivables": [],
            "payables": [],
            "can_net": False,
            "error": "Khách hàng chưa liên kết với hồ sơ nhà cung cấp của cùng đối tượng."
        }

    rec_qs = models.Receivable.objects.filter(
        company=company,
        customer=customer,
        status__in=[models.ReceivableStatus.OPEN, models.ReceivableStatus.PARTIALLY_PAID],
        balance__gt=ZERO,
    ).select_related("account", "currency")

    pay_qs = Payable.objects.filter(
        company=company,
        supplier=supplier,
        status__in=[PayableStatus.OPEN, PayableStatus.PARTIALLY_PAID],
        balance__gt=ZERO,
    ).select_related("currency")

    if currency_id:
        rec_qs = rec_qs.filter(currency_id=currency_id)
        pay_qs = pay_qs.filter(currency_id=currency_id)

    if receivable_account_id:
        rec_qs = rec_qs.filter(account_id=receivable_account_id)

    if branch_id:
        pay_qs = pay_qs.filter(Q(branch_id=branch_id) | Q(branch__isnull=True))

    rec_list = []
    for r in rec_qs.order_by("due_date", "created_at"):
        scheds = [
            {
                "id": str(s.id),
                "installment_no": s.installment_no,
                "amount": str(s.amount),
                "balance": str(s.balance),
                "due_date": str(s.due_date),
            }
            for s in r.schedules.filter(balance__gt=ZERO).order_by("installment_no")
        ]
        rec_list.append({
            "id": str(r.id),
            "code": r.code,
            "source_document_type": r.source_document_type,
            "source_document_number": r.source_document_number,
            "document_date": str(r.document_date) if r.document_date else None,
            "due_date": str(r.due_date) if r.due_date else None,
            "original_amount": str(r.original_amount),
            "balance": str(r.balance),
            "currency_id": str(r.currency_id),
            "currency_code": r.currency.code,
            "account_id": str(r.account_id),
            "account_code": r.account.code if r.account else "131",
            "exchange_rate": str(r.exchange_rate),
            "schedules": scheds,
        })

    pay_list = []
    for p in pay_qs.order_by("due_date", "created_at"):
        doc_num = (
            p.invoice.invoice_number if p.invoice
            else p.goods_purchase.number if p.goods_purchase
            else str(p.id)[:8]
        )
        pay_list.append({
            "id": str(p.id),
            "source_document_number": doc_num,
            "due_date": str(p.due_date) if p.due_date else None,
            "original_amount": str(p.original_amount),
            "balance": str(p.balance),
            "currency_id": str(p.currency_id),
            "currency_code": p.currency.code,
            "exchange_rate": str(p.exchange_rate),
        })

    cust_profile = getattr(customer, "customer_profile", None)
    supp_profile = getattr(supplier, "vendor_profile", None)
    default_rec_acc = getattr(cust_profile, "receivable_account", None)
    default_pay_acc = getattr(supp_profile, "payable_account", None)

    # Determine common currencies and default currency (Section 2.1)
    rec_currency_ids = set(models.Receivable.objects.filter(
        company=company, customer=customer,
        status__in=[models.ReceivableStatus.OPEN, models.ReceivableStatus.PARTIALLY_PAID],
        balance__gt=ZERO,
    ).values_list("currency_id", flat=True))

    pay_currency_ids = set(Payable.objects.filter(
        company=company, supplier=supplier,
        status__in=[PayableStatus.OPEN, PayableStatus.PARTIALLY_PAID],
        balance__gt=ZERO,
    ).values_list("currency_id", flat=True))

    common_currency_ids = rec_currency_ids.intersection(pay_currency_ids)
    from master_data.models import Currency
    common_currencies = Currency.objects.filter(id__in=common_currency_ids, is_active=True)

    default_currency = None
    if company.accounting_currency_id in common_currency_ids:
        default_currency = company.accounting_currency
    elif common_currencies.exists():
        default_currency = common_currencies.first()

    return {
        "customer": {"id": str(customer.id), "code": customer.code, "name": customer.name},
        "supplier": {"id": str(supplier.id), "code": supplier.code, "name": supplier.name},
        "default_currency": {
            "id": str(default_currency.id),
            "code": default_currency.code,
            "name": getattr(default_currency, "name", default_currency.code),
        } if default_currency else None,
        "default_receivable_account": {
            "id": str(default_rec_acc.id),
            "code": default_rec_acc.code,
            "name": default_rec_acc.name,
        } if default_rec_acc else None,
        "default_payable_account": {
            "id": str(default_pay_acc.id),
            "code": default_pay_acc.code,
            "name": default_pay_acc.name,
        } if default_pay_acc else None,
        "common_currencies": [
            {"id": str(c.id), "code": c.code, "name": getattr(c, "name", c.code)}
            for c in common_currencies
        ],
        "receivables": rec_list,
        "payables": pay_list,
        "can_net": len(rec_list) > 0 and len(pay_list) > 0,
    }
