import re
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts_receivable import models, services
from general_ledger.models import Account, AccountStatus, AccountingPeriod, JournalEntry, JournalLine
from iam.models import UserAccount
from master_data.models import DocumentNumberingRule, Party, PartyRole

ZERO = Decimal("0")


def generate_voucher_number(company, branch=None, adjustment_type=None):
    rule = DocumentNumberingRule.objects.filter(
        company=company, document_type__code="AR.ADJUSTMENT_VOUCHER", status="ACTIVE"
    ).first()
    if rule:
        return rule.generate_next_number(company=company, branch=branch)
    today = timezone.localdate()
    year = today.year
    prefix = f"AR-ADJ-{year}-"
    last = models.DebtAdjustmentVoucher.objects.filter(
        company=company, number__startswith=prefix
    ).order_by("-number").values_list("number", flat=True).first()
    if last:
        match = re.search(r"(\d+)$", last)
        next_seq = int(match.group(1)) + 1 if match else 1
    else:
        next_seq = 1
    return f"{prefix}{next_seq:05d}"


def validate_voucher_data(attrs, instance=None, lines=None):
    def _fail(cond, field, msg):
        if not cond:
            raise ValidationError({field: msg})

    def val(name):
        if name in attrs:
            return attrs[name]
        if instance:
            return getattr(instance, name)
        return None

    company = val("company")
    _fail(company is not None, "company", "Doanh nghiệp là bắt buộc.")

    customer = val("customer")
    _fail(customer and customer.company_id == company.pk, "customer", "Khách hàng không thuộc doanh nghiệp.")
    _fail(customer.status == "ACTIVE", "customer", "Khách hàng không ở trạng thái hoạt động.")
    has_customer_role = PartyRole.objects.filter(
        party=customer, role_type="CUSTOMER"
    ).exists()
    _fail(has_customer_role, "customer", "Đối tượng chưa có vai trò khách hàng.")

    adj_type = val("adjustment_type")
    _fail(adj_type in {models.DebtAdjustmentVoucher.AdjustmentType.INCREASE,
                       models.DebtAdjustmentVoucher.AdjustmentType.DECREASE},
          "adjustment_type", "Loại điều chỉnh phải là Tăng công nợ hoặc Giảm công nợ.")

    adj_reason = val("adjustment_reason")
    _fail(adj_reason and adj_reason.strip(), "adjustment_reason", "Lý do điều chỉnh là bắt buộc.")

    doc_basis = val("document_basis")
    _fail(doc_basis and doc_basis.strip(), "document_basis", "Tài liệu căn cứ là bắt buộc.")

    currency = val("currency")
    _fail(currency and getattr(currency, "is_active", True), "currency", "Loại tiền không hợp lệ hoặc không hoạt động.")

    rec_account = val("receivable_account")
    _fail(rec_account and rec_account.company_id == company.pk and rec_account.status == AccountStatus.ACTIVE,
          "receivable_account", "Tài khoản phải thu không hợp lệ hoặc không hoạt động.")

    _fail(val("document_date"), "document_date", "Ngày chứng từ là bắt buộc.")
    _fail(val("posting_date"), "posting_date", "Ngày hạch toán là bắt buộc.")

    desc = val("description")
    if not desc or not desc.strip():
        label = "Tăng" if adj_type == models.DebtAdjustmentVoucher.AdjustmentType.INCREASE else "Giảm"
        attrs["description"] = f"{label} công nợ {customer.name}"

    effective_lines = lines if lines is not None else (
        list(instance.lines.select_related("receivable", "receivable_schedule", "offset_account")) if instance else []
    )

    if effective_lines:
        by_rec = {}
        by_sched = {}

        for item in effective_lines:
            rec = item.get("receivable") if isinstance(item, dict) else item.receivable
            sched = item.get("receivable_schedule") if isinstance(item, dict) else item.receivable_schedule
            offset_acc = item.get("offset_account") if isinstance(item, dict) else item.offset_account
            amount = Decimal(str(item["amount"] if isinstance(item, dict) else item.amount))
            rate = Decimal(str(item.get("exchange_rate", 1) if isinstance(item, dict) else item.exchange_rate))

            _fail(amount > 0, "lines", "Số tiền điều chỉnh trên mỗi dòng phải lớn hơn 0.")
            _fail(rate > 0, "lines", "Tỷ giá phải lớn hơn 0.")

            # Offset account validations (EF06)
            _fail(offset_acc and offset_acc.company_id == company.pk and offset_acc.status == AccountStatus.ACTIVE,
                  "lines", "Tài khoản đối ứng không hợp lệ hoặc không hoạt động.")
            _fail(offset_acc.pk != rec_account.pk, "lines",
                  "Tài khoản đối ứng không được trùng với tài khoản phải thu.")

            if adj_type == models.DebtAdjustmentVoucher.AdjustmentType.INCREASE:
                if rec:
                    _fail(rec.company_id == company.pk, "lines", "Khoản phải thu không thuộc doanh nghiệp.")
                    _fail(rec.customer_id == customer.pk, "lines", "Khoản phải thu không thuộc khách hàng đã chọn.")
                    _fail(rec.currency_id == currency.pk, "lines", "Khoản phải thu khác loại tiền đã chọn.")
                    _fail(rec.account_id == rec_account.pk, "lines", "Khoản phải thu khác tài khoản phải thu đã chọn.")
            else:  # DECREASE
                # BR04: Khoản phải thu là bắt buộc khi giảm công nợ
                _fail(rec is not None, "lines", "Giảm công nợ bắt buộc phải chọn khoản còn phải thu.")
                _fail(rec.company_id == company.pk, "lines", "Khoản phải thu không thuộc doanh nghiệp.")
                _fail(rec.customer_id == customer.pk, "lines", "Khoản phải thu không thuộc khách hàng đã chọn.")
                _fail(rec.currency_id == currency.pk, "lines", "Khoản phải thu khác loại tiền đã chọn.")
                _fail(rec.account_id == rec_account.pk, "lines", "Khoản phải thu khác tài khoản phải thu đã chọn.")
                _fail(rec.status in {models.ReceivableStatus.OPEN, models.ReceivableStatus.PARTIALLY_PAID},
                      "lines", f"Khoản phải thu {rec.code} không còn hiệu lực để điều chỉnh giảm.")
                _fail(rec.balance > ZERO, "lines", f"Khoản phải thu {rec.code} đã hết số dư.")

                # Schedule validations
                if sched:
                    _fail(sched.receivable_id == rec.pk, "lines", "Đợt thanh toán không thuộc khoản phải thu đã chọn.")
                    _fail(sched.balance > ZERO, "lines", "Đợt thanh toán đã hết số dư.")
                    by_sched[sched.pk] = by_sched.get(sched.pk, ZERO) + amount
                    _fail(by_sched[sched.pk] <= sched.balance, "lines",
                          f"Tổng tiền điều chỉnh giảm vượt quá số dư còn lại của đợt thanh toán (còn {sched.balance}).")
                else:
                    active_schedules = rec.schedules.filter(balance__gt=ZERO)
                    if active_schedules.count() > 1:
                        raise ValidationError({"lines": f"Khoản phải thu {rec.code} có nhiều đợt thanh toán còn dư; bắt buộc phải chọn đợt thanh toán."})

                by_rec[rec.pk] = by_rec.get(rec.pk, ZERO) + amount
                _fail(by_rec[rec.pk] <= rec.balance, "lines",
                      f"Tổng tiền điều chỉnh giảm vượt quá số dư còn lại của khoản phải thu {rec.code} (còn {rec.balance}).")


@transaction.atomic
def save_voucher(data, instance=None, user=None):
    lines_data = data.pop("lines", None)
    if isinstance(user, UserAccount):
        user_account = user
    elif hasattr(user, "iam_account"):
        user_account = user.iam_account
    else:
        user_account = UserAccount.objects.first()

    if instance is None:
        if not data.get("number"):
            data["number"] = generate_voucher_number(data["company"], data.get("branch"))
        data["created_by"] = user_account
        voucher = models.DebtAdjustmentVoucher.objects.create(**data)
    else:
        if instance.status not in {
            models.DebtAdjustmentVoucher.Status.DRAFT,
            models.DebtAdjustmentVoucher.Status.REVISION_REQUESTED,
            models.DebtAdjustmentVoucher.Status.REJECTED,
        }:
            raise ValidationError("Chỉ cho phép sửa chứng từ ở trạng thái Nháp, Yêu cầu chỉnh sửa hoặc Từ chối.")
        for k, v in data.items():
            setattr(instance, k, v)
        instance.save()
        voucher = instance

    if lines_data is not None:
        voucher.lines.all().delete()
        total_amount = ZERO
        total_converted = ZERO
        created_lines = []

        for idx, item in enumerate(lines_data, start=1):
            amount = Decimal(str(item["amount"]))
            adj_type = voucher.adjustment_type
            rec = item.get("receivable")

            if adj_type == models.DebtAdjustmentVoucher.AdjustmentType.INCREASE:
                rate = Decimal(str(item.get("exchange_rate", 1)))
                if voucher.currency.code == "VND":
                    rate = Decimal("1")
                conv_amount = round(amount * rate, 4)
            else:  # DECREASE
                # BR10: lấy theo giá trị ghi sổ của receivable
                rate = rec.exchange_rate if rec else Decimal("1")
                conv_amount = round(amount * rate, 4)

            total_amount += amount
            total_converted += conv_amount

            line = models.DebtAdjustmentVoucherLine(
                voucher=voucher,
                line_no=idx,
                receivable=rec,
                receivable_schedule=item.get("receivable_schedule"),
                offset_account=item["offset_account"],
                amount=amount,
                exchange_rate=rate,
                converted_amount=conv_amount,
                new_due_date=item.get("new_due_date"),
                description=item.get("description", ""),
            )
            created_lines.append(line)

        models.DebtAdjustmentVoucherLine.objects.bulk_create(created_lines)
        voucher.total_amount = total_amount
        voucher.total_converted_amount = total_converted
        voucher.save(update_fields=("total_amount", "total_converted_amount"))

    return voucher


def transition(voucher, action, user_account, reason=""):
    Status = models.DebtAdjustmentVoucher.Status

    if action == "submit":
        if voucher.status not in {Status.DRAFT, Status.REVISION_REQUESTED}:
            raise ValidationError("Chỉ chứng từ Nháp hoặc Yêu cầu chỉnh sửa mới được gửi duyệt.")
        if not voucher.lines.exists():
            raise ValidationError("Chứng từ chưa có dòng chi tiết.")
        now = timezone.now()
        voucher.submitted_at = now
        if voucher.approval_required:
            voucher.status = Status.PENDING_APPROVAL
        else:
            voucher.status = Status.APPROVED
            voucher.approved_by = user_account
            voucher.approved_at = now
        voucher.save(update_fields=("status", "submitted_at", "approved_by", "approved_at", "updated_at"))
        models.DebtAdjustmentApproval.objects.create(
            voucher=voucher,
            level=1,
            decision="SUBMITTED",
            actor=user_account,
            comment="Gửi phê duyệt",
        )

    elif action == "recall":
        if voucher.status != Status.PENDING_APPROVAL:
            raise ValidationError("Chỉ chứng từ Chờ duyệt mới được thu hồi.")
        voucher.status = Status.DRAFT
        voucher.save(update_fields=("status", "updated_at"))
        models.DebtAdjustmentApproval.objects.create(
            voucher=voucher,
            level=1,
            decision="RECALLED",
            actor=user_account,
            comment=reason or "Thu hồi chứng từ",
        )

    elif action == "approve":
        if voucher.status != Status.PENDING_APPROVAL:
            raise ValidationError("Chỉ chứng từ Chờ duyệt mới được phê duyệt.")
        now = timezone.now()
        voucher.status = Status.APPROVED
        voucher.approved_by = user_account
        voucher.approved_at = now
        voucher.save(update_fields=("status", "approved_by", "approved_at", "updated_at"))
        models.DebtAdjustmentApproval.objects.create(
            voucher=voucher,
            level=1,
            decision="APPROVED",
            actor=user_account,
            comment=reason or "Phê duyệt",
        )

    elif action == "reject":
        if voucher.status != Status.PENDING_APPROVAL:
            raise ValidationError("Chỉ chứng từ Chờ duyệt mới được từ chối.")
        if not reason or not reason.strip():
            raise ValidationError({"reason": "Vui lòng nhập lý do từ chối."})
        voucher.status = Status.REJECTED
        voucher.rejection_reason = reason
        voucher.save(update_fields=("status", "rejection_reason", "updated_at"))
        models.DebtAdjustmentApproval.objects.create(
            voucher=voucher,
            level=1,
            decision="REJECTED",
            actor=user_account,
            comment=reason,
        )

    elif action == "request_revision":
        if voucher.status != Status.PENDING_APPROVAL:
            raise ValidationError("Chỉ chứng từ Chờ duyệt mới được yêu cầu chỉnh sửa.")
        if not reason or not reason.strip():
            raise ValidationError({"reason": "Vui lòng nhập nội dung yêu cầu chỉnh sửa."})
        voucher.status = Status.REVISION_REQUESTED
        voucher.revision_reason = reason
        voucher.save(update_fields=("status", "revision_reason", "updated_at"))
        models.DebtAdjustmentApproval.objects.create(
            voucher=voucher,
            level=1,
            decision="REVISION_REQUESTED",
            actor=user_account,
            comment=reason,
        )

    elif action == "cancel":
        if voucher.status in {Status.POSTED, Status.CANCELLED}:
            raise ValidationError("Không thể hủy chứng từ đã ghi sổ hoặc đã hủy.")
        if voucher.status == Status.PENDING_APPROVAL:
            raise ValidationError("Chứng từ Chờ duyệt phải thu hồi trước khi hủy.")
        if not reason or not reason.strip():
            raise ValidationError({"reason": "Hủy chứng từ phải nhập lý do."})
        now = timezone.now()
        voucher.status = Status.CANCELLED
        voucher.cancelled_by = user_account
        voucher.cancelled_at = now
        voucher.cancel_reason = reason
        voucher.save(update_fields=("status", "cancelled_by", "cancelled_at", "cancel_reason", "updated_at"))
        models.DebtAdjustmentApproval.objects.create(
            voucher=voucher,
            level=1,
            decision="CANCELLED",
            actor=user_account,
            comment=reason,
        )

    return voucher


@transaction.atomic
def post_voucher(voucher, request):
    """
    Posts the adjustment voucher: updates debts and creates General Ledger JournalEntry.
    BR01-BR10, BR13, BR14.
    """
    # BR14: Idempotent posting
    if voucher.status == models.DebtAdjustmentVoucher.Status.POSTED:
        return voucher

    # BR08: Check status allowed
    if voucher.approval_required and voucher.status != models.DebtAdjustmentVoucher.Status.APPROVED:
        raise ValidationError("Chứng từ chưa được phê duyệt, không thể ghi sổ.")
    if not voucher.approval_required and voucher.status not in {
        models.DebtAdjustmentVoucher.Status.DRAFT,
        models.DebtAdjustmentVoucher.Status.APPROVED,
    }:
        raise ValidationError(f"Chứng từ ở trạng thái {voucher.status} không thể ghi sổ.")

    # EF08: Check open accounting period
    period = AccountingPeriod.objects.filter(
        company=voucher.company,
        start_date__lte=voucher.posting_date,
        end_date__gte=voucher.posting_date,
        status="OPEN",
    ).first()
    if not period:
        raise ValidationError({"posting_date": "Kỳ kế toán tương ứng đã đóng hoặc chưa được mở."})

    lines = list(voucher.lines.select_related("receivable", "receivable_schedule", "offset_account").order_by("line_no"))
    if not lines:
        raise ValidationError("Chứng từ không có dòng chi tiết.")

    # EF07 / BR05: Concurrency check & re-validate debt balances for DECREASE
    adj_type = voucher.adjustment_type
    if adj_type == models.DebtAdjustmentVoucher.AdjustmentType.DECREASE:
        rec_ids = [l.receivable_id for l in lines if l.receivable_id]
        locked_recs = {
            r.id: r for r in models.Receivable.objects.select_for_update().filter(id__in=rec_ids)
        }
        sched_ids = [l.receivable_schedule_id for l in lines if l.receivable_schedule_id]
        locked_scheds = {
            s.id: s for s in models.ReceivableSchedule.objects.select_for_update().filter(id__in=sched_ids)
        }

        usage_rec = {}
        usage_sched = {}
        for l in lines:
            r = locked_recs.get(l.receivable_id)
            if not r or r.status not in {models.ReceivableStatus.OPEN, models.ReceivableStatus.PARTIALLY_PAID}:
                raise ValidationError(f"Khoản phải thu {r.code if r else ''} không còn hiệu lực.")
            usage_rec[r.id] = usage_rec.get(r.id, ZERO) + l.amount
            if usage_rec[r.id] > r.balance:
                raise ValidationError(f"Số dư khoản phải thu {r.code} đã thay đổi, không đủ để điều chỉnh giảm (còn {r.balance}).")

            if l.receivable_schedule_id:
                s = locked_scheds.get(l.receivable_schedule_id)
                if not s:
                    raise ValidationError("Đợt thanh toán không hợp lệ.")
                usage_sched[s.id] = usage_sched.get(s.id, ZERO) + l.amount
                if usage_sched[s.id] > s.balance:
                    raise ValidationError(f"Số dư đợt thanh toán của {r.code} không đủ để điều chỉnh giảm (còn {s.balance}).")

    now = timezone.now()
    user_account = request.user.iam_account if hasattr(request.user, "iam_account") else None

    # BR09: Generate GL Journal Entry
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
        source_event_id=f"AR_ADJUSTMENT:{voucher.id}",
        source_entity_type="DebtAdjustmentVoucher",
        source_entity_id=voucher.id,
        status="APPROVED",
        workflow_snapshot={"allow_creator_posting": True},
        total_debit=voucher.total_converted_amount,
        total_credit=voucher.total_converted_amount,
        created_by=user_account,
        approved_by=user_account,
        approved_at=now,
    )

    line_idx = 1

    if adj_type == models.DebtAdjustmentVoucher.AdjustmentType.INCREASE:
        # Nợ TK Phải thu (receivable_account)
        JournalLine.objects.create(
            entry=journal,
            line_no=line_idx,
            account=voucher.receivable_account,
            debit=voucher.total_converted_amount,
            credit=ZERO,
            currency=voucher.currency,
            foreign_amount=voucher.total_amount,
            exchange_rate=Decimal("1"),
            party=voucher.customer,
            description=voucher.description,
        )
        line_idx += 1

        # Có TK Đối ứng từng dòng
        for l in lines:
            JournalLine.objects.create(
                entry=journal,
                line_no=line_idx,
                account=l.offset_account,
                debit=ZERO,
                credit=l.converted_amount,
                currency=voucher.currency,
                foreign_amount=l.amount,
                exchange_rate=l.exchange_rate,
                party=voucher.customer,
                description=l.description or voucher.description,
            )
            line_idx += 1

            # AF01 & BR04: Tạo khoản phải thu mới
            new_due_date = l.new_due_date or voucher.document_date
            new_rec = models.Receivable.objects.create(
                company=voucher.company,
                branch=voucher.branch,
                code=f"{voucher.number}-{l.line_no}",
                customer=voucher.customer,
                source_document_type="AR_ADJUSTMENT_VOUCHER",
                source_document_id=str(voucher.id),
                source_document_number=voucher.number,
                source_line_id=str(l.id),
                journal_entry=journal,
                account=voucher.receivable_account,
                document_date=voucher.document_date,
                posting_date=voucher.posting_date,
                currency=voucher.currency,
                exchange_rate=l.exchange_rate,
                original_amount=l.amount,
                balance=l.amount,
                due_date=new_due_date,
                description=l.description or voucher.description,
                status=models.ReceivableStatus.OPEN,
                created_by=user_account,
            )
            l.created_receivable = new_rec
            l.save(update_fields=("created_receivable",))

    else:  # DECREASE
        # Nợ TK Đối ứng từng dòng
        for l in lines:
            JournalLine.objects.create(
                entry=journal,
                line_no=line_idx,
                account=l.offset_account,
                debit=l.converted_amount,
                credit=ZERO,
                currency=voucher.currency,
                foreign_amount=l.amount,
                exchange_rate=l.exchange_rate,
                party=voucher.customer,
                description=l.description or voucher.description,
            )
            line_idx += 1

        # Có TK Phải thu (receivable_account)
        JournalLine.objects.create(
            entry=journal,
            line_no=line_idx,
            account=voucher.receivable_account,
            debit=ZERO,
            credit=voucher.total_converted_amount,
            currency=voucher.currency,
            foreign_amount=voucher.total_amount,
            exchange_rate=Decimal("1"),
            party=voucher.customer,
            description=voucher.description,
        )
        line_idx += 1

        # Cập nhật giảm số dư Receivable và ReceivableSchedule
        for l in lines:
            r = l.receivable
            r.refresh_from_db()
            r.adjustment_amount += l.amount
            r.balance -= l.amount
            if r.balance <= ZERO:
                r.balance = ZERO
                r.status = models.ReceivableStatus.PAID
            else:
                r.status = models.ReceivableStatus.PARTIALLY_PAID
            r.save(update_fields=("adjustment_amount", "balance", "status", "updated_at"))

            if l.receivable_schedule:
                sched = l.receivable_schedule
                sched.refresh_from_db()
                sched.balance -= l.amount
                if sched.balance <= ZERO:
                    sched.balance = ZERO
                    sched.status = models.ReceivableStatus.PAID
                else:
                    sched.status = models.ReceivableStatus.PARTIALLY_PAID
                sched.save(update_fields=("balance", "status", "updated_at"))
            else:
                # FIFO decrease schedules if exist
                rem = l.amount
                for s in r.schedules.filter(balance__gt=ZERO).order_by("installment_no"):
                    if rem <= ZERO:
                        break
                    deduct = min(rem, s.balance)
                    s.balance -= deduct
                    rem -= deduct
                    if s.balance <= ZERO:
                        s.balance = ZERO
                        s.status = models.ReceivableStatus.PAID
                    else:
                        s.status = models.ReceivableStatus.PARTIALLY_PAID
                    s.save(update_fields=("balance", "status", "updated_at"))

            # Legacy ReceivableAdjustment record for audit & trace
            adj = models.ReceivableAdjustment.objects.create(
                company=voucher.company,
                receivable=r,
                adjustment_date=voucher.posting_date,
                amount=-l.amount,
                reason=voucher.adjustment_reason,
                posting_reference=voucher.number,
                status=models.PostingStatus.POSTED,
                created_by=user_account,
                posted_at=now,
            )
            l.legacy_adjustment = adj
            l.save(update_fields=("legacy_adjustment",))

    from general_ledger.services import post as post_journal
    post_journal(journal, request)

    voucher.journal_entry = journal
    voucher.status = models.DebtAdjustmentVoucher.Status.POSTED
    voucher.posted_by = user_account
    voucher.posted_at = now
    voucher.posting_count += 1
    voucher.save(update_fields=("journal_entry", "status", "posted_by", "posted_at", "posting_count", "updated_at"))

    services.audit(request, voucher, "POST", after={"status": voucher.status, "journal_entry": str(journal.pk)})
    return voucher


@transaction.atomic
def unpost_voucher(voucher, request):
    """
    Unposts an adjustment voucher: restores debt balances and reverses GL entry. (AF06, BR13).
    """
    if voucher.status != models.DebtAdjustmentVoucher.Status.POSTED:
        raise ValidationError("Chỉ chứng từ Đã ghi sổ mới có thể bỏ ghi sổ.")

    reason = request.data.get("reason", "") if hasattr(request, "data") else ""
    if not reason or not reason.strip():
        raise ValidationError({"reason": "Vui lòng nhập lý do bỏ ghi sổ."})

    # EF08: Check accounting period of voucher.posting_date
    period = AccountingPeriod.objects.filter(
        company=voucher.company,
        start_date__lte=voucher.posting_date,
        end_date__gte=voucher.posting_date,
        status="OPEN",
    ).first()
    if not period:
        raise ValidationError({"posting_date": "Kỳ kế toán đã đóng, không thể bỏ ghi sổ."})

    lines = list(voucher.lines.select_related("receivable", "receivable_schedule", "created_receivable", "legacy_adjustment").order_by("line_no"))

    # BR13 / EF09: Check dependent transactions
    adj_type = voucher.adjustment_type
    if adj_type == models.DebtAdjustmentVoucher.AdjustmentType.INCREASE:
        for l in lines:
            new_rec = l.created_receivable
            if new_rec:
                if new_rec.collected_amount > ZERO or new_rec.allocations.filter(reversed_at__isnull=True).exists():
                    raise ValidationError("Khoản phải thu mới sinh ra từ chứng từ này đã có thu tiền/phân bổ.")
                if new_rec.netted_amount > ZERO or new_rec.netting_voucher_lines.filter(voucher__status=models.DebtNettingVoucher.Status.POSTED).exists():
                    raise ValidationError("Khoản phải thu mới sinh ra từ chứng từ này đã được sử dụng để bù trừ công nợ.")
                if new_rec.adjustment_amount > ZERO or new_rec.adjustment_voucher_lines.filter(voucher__status=models.DebtAdjustmentVoucher.Status.POSTED).exists():
                    raise ValidationError("Khoản phải thu mới sinh ra từ chứng từ này đã có điều chỉnh công nợ phát sinh sau đó.")
                if new_rec.balance < new_rec.original_amount:
                    raise ValidationError("Khoản phải thu mới sinh ra từ chứng từ này đã thay đổi số dư.")
    else:  # DECREASE
        for l in lines:
            r = l.receivable
            if r.allocations.filter(reversed_at__isnull=True, created_at__gt=voucher.posted_at).exists():
                raise ValidationError("Khoản phải thu có thu tiền phát sinh sau chứng từ điều chỉnh này.")
            if r.adjustment_voucher_lines.filter(voucher__status=models.DebtAdjustmentVoucher.Status.POSTED, voucher__posted_at__gt=voucher.posted_at).exists():
                raise ValidationError("Khoản phải thu có điều chỉnh công nợ phát sinh sau chứng từ điều chỉnh này.")
            if r.netting_voucher_lines.filter(voucher__status=models.DebtNettingVoucher.Status.POSTED, voucher__posted_at__gt=voucher.posted_at).exists():
                raise ValidationError("Khoản phải thu có bù trừ công nợ phát sinh sau chứng từ điều chỉnh này.")

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
            "META": getattr(request, "META", {}),
            "headers": getattr(request, "headers", {}),
            "method": getattr(request, "method", "POST"),
            "path": getattr(request, "path", ""),
        })()
        reverse_journal(voucher.journal_entry, proxy)
        voucher.journal_entry = None

    # Restore debt balances
    if adj_type == models.DebtAdjustmentVoucher.AdjustmentType.INCREASE:
        for l in lines:
            new_rec = l.created_receivable
            if new_rec:
                l.created_receivable = None
                l.save(update_fields=("created_receivable",))
                new_rec.delete()
    else:  # DECREASE
        for l in lines:
            r = l.receivable
            r.refresh_from_db()
            r.balance += l.amount
            r.adjustment_amount -= l.amount
            if r.adjustment_amount < ZERO:
                r.adjustment_amount = ZERO
            if r.balance >= r.original_amount:
                r.status = models.ReceivableStatus.OPEN
            else:
                r.status = models.ReceivableStatus.PARTIALLY_PAID
            r.save(update_fields=("balance", "adjustment_amount", "status", "updated_at"))

            if l.receivable_schedule:
                sched = l.receivable_schedule
                sched.refresh_from_db()
                sched.balance += l.amount
                if sched.balance >= sched.amount:
                    sched.status = models.ReceivableStatus.OPEN
                else:
                    sched.status = models.ReceivableStatus.PARTIALLY_PAID
                sched.save(update_fields=("balance", "status", "updated_at"))

            if l.legacy_adjustment:
                l.legacy_adjustment.status = models.PostingStatus.REVERSED
                l.legacy_adjustment.save(update_fields=("status",))

    voucher.status = models.DebtAdjustmentVoucher.Status.DRAFT
    voucher.unposted_by = user_account
    voucher.unposted_at = now
    voucher.unpost_reason = reason
    voucher.save(update_fields=("status", "journal_entry", "unposted_by", "unposted_at", "unpost_reason", "updated_at"))

    services.audit(request, voucher, "UNPOST", after={"status": voucher.status}, reason=reason)
    return voucher


def eligible_receivables(company, branch_id=None, customer_id=None, currency_id=None, receivable_account_id=None):
    """
    Returns eligible receivables and schedules for debt decrease adjustment (AF04, Step 3).
    """
    if not customer_id:
        return {"receivables": []}

    customer = Party.objects.filter(pk=customer_id, company=company).first()
    if not customer:
        return {"receivables": []}

    rec_qs = models.Receivable.objects.filter(
        company=company,
        customer=customer,
        status__in=[models.ReceivableStatus.OPEN, models.ReceivableStatus.PARTIALLY_PAID],
        balance__gt=ZERO,
    ).select_related("account", "currency")

    if currency_id:
        rec_qs = rec_qs.filter(currency_id=currency_id)
    if receivable_account_id:
        rec_qs = rec_qs.filter(account_id=receivable_account_id)
    if branch_id:
        rec_qs = rec_qs.filter(branch_id=branch_id)

    results = []
    for r in rec_qs.order_by("due_date", "code"):
        schedules_data = []
        for s in r.schedules.filter(balance__gt=ZERO).order_by("installment_no"):
            schedules_data.append({
                "id": str(s.id),
                "installment_no": s.installment_no,
                "amount": str(s.amount),
                "balance": str(s.balance),
                "due_date": s.due_date.isoformat(),
            })
        results.append({
            "id": str(r.id),
            "code": r.code,
            "document_number": r.source_document_number or r.code,
            "document_date": r.document_date.isoformat() if r.document_date else None,
            "posting_date": r.posting_date.isoformat() if r.posting_date else None,
            "due_date": r.due_date.isoformat() if r.due_date else None,
            "currency_id": str(r.currency_id),
            "currency_code": r.currency.code,
            "account_id": str(r.account_id),
            "account_code": r.account.code if r.account else None,
            "exchange_rate": str(r.exchange_rate),
            "original_amount": str(r.original_amount),
            "balance": str(r.balance),
            "schedules": schedules_data,
        })

    default_currency = customer.default_currency or getattr(company, "accounting_currency", None)
    default_rec_account = (
        Account.objects.filter(company=company, code__startswith="131", status=AccountStatus.ACTIVE).first()
    )

    return {
        "receivables": results,
        "default_currency_id": str(default_currency.id) if default_currency else None,
        "default_currency_code": default_currency.code if default_currency else None,
        "default_receivable_account_id": str(default_rec_account.id) if default_rec_account else None,
        "default_receivable_account_code": default_rec_account.code if default_rec_account else None,
    }
