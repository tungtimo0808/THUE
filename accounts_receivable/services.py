from datetime import timedelta
from decimal import Decimal
import re
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from general_ledger.models import Account, JournalEntry, JournalLine
from master_data.models import PaymentTerm
from master_data.payment_terms import calculate_payment_dates
from . import models


def actor(request):
    if hasattr(request, "user") and hasattr(request.user, "iam_account"):
        return request.user.iam_account
    return getattr(request, "user", None)


def audit(request, obj, action, before=None, after=None, reason=""):
    act = actor(request)
    if act and hasattr(act, "id"):
        record_audit(
            company=obj.company,
            actor_user=act,
            module_code="AR",
            action_code=action,
            entity=obj,
            before=before or {},
            after=after or {},
            request=request,
            reason=reason,
        )


def generate_receivable_code(company, date=None):
    """
    Generate unique receivable code: AR-YYYY-XXXXX
    """
    year = (date or timezone.localdate()).year
    prefix = f"AR-{year}-"
    existing_codes = list(
        models.Receivable.objects.filter(company=company, code__startswith=prefix)
        .values_list("code", flat=True)
    )
    max_num = 0
    pattern = re.compile(rf"^{prefix}(\d+)$")
    for c in existing_codes:
        m = pattern.match(c.strip())
        if m:
            try:
                num = int(m.group(1))
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    return f"{prefix}{max_num + 1:05d}"


def get_unrecognized_sources(company, branch=None, customer=None, search=None):
    """
    Find posted documents and general ledger lines with customer receivables not yet recognized.
    (UC-AR-01 Luồng chính Bước 1-3, BR-AR-01-02, BR-AR-01-03, BR-AR-01-05)
    """
    results = []

    # 1. ReceivableDocument with status POSTED and no active Receivable
    doc_qs = models.ReceivableDocument.objects.filter(
        company=company,
        status=models.DocumentStatus.POSTED,
    ).select_related("customer", "currency", "payment_term", "sales_order", "sales_contract")
    if branch:
        doc_qs = doc_qs.filter(branch=branch)
    if customer:
        doc_qs = doc_qs.filter(customer=customer)

    # Active recognized source IDs
    recognized_doc_ids = set(
        models.Receivable.objects.filter(company=company)
        .exclude(status=models.ReceivableStatus.REVERSED)
        .filter(Q(document__isnull=False) | Q(source_document_type="AR_DOCUMENT"))
        .values_list("source_document_id", flat=True)
    )
    direct_doc_ids = set(
        models.Receivable.objects.filter(company=company)
        .exclude(status=models.ReceivableStatus.REVERSED)
        .filter(document__isnull=False)
        .values_list("document_id", flat=True)
    )
    all_rec_doc_ids = {str(d) for d in recognized_doc_ids if d} | {str(d) for d in direct_doc_ids if d}

    for doc in doc_qs:
        if str(doc.id) in all_rec_doc_ids:
            continue
        results.append({
            "source_document_type": "AR_DOCUMENT",
            "source_document_id": str(doc.id),
            "source_document_number": doc.number,
            "source_line_id": "",
            "customer_id": str(doc.customer_id),
            "customer_code": doc.customer.code,
            "customer_name": doc.customer.name,
            "account_id": None,
            "account_code": "131",
            "account_name": "Phải thu của khách hàng",
            "currency_id": str(doc.currency_id),
            "currency_code": doc.currency.code,
            "exchange_rate": str(doc.exchange_rate),
            "original_amount": str(doc.amount),
            "document_date": str(doc.document_date),
            "posting_date": str(doc.posting_date),
            "due_date": str(doc.due_date),
            "payment_term_id": str(doc.payment_term_id) if doc.payment_term_id else None,
            "payment_term_name": doc.payment_term.name if doc.payment_term else None,
            "sales_order_id": str(doc.sales_order_id) if doc.sales_order_id else None,
            "sales_contract_id": str(doc.sales_contract_id) if doc.sales_contract_id else None,
            "description": doc.description,
        })

    # 2. JournalEntry lines where status="POSTED", account starts with 131, debit > 0, party has customer role
    line_qs = JournalLine.objects.filter(
        entry__company=company,
        entry__status="POSTED",
        account__code__startswith="131",
        debit__gt=0,
        party__isnull=False,
    ).select_related("entry", "account", "currency", "party")
    if branch:
        line_qs = line_qs.filter(entry__branch=branch)
    if customer:
        line_qs = line_qs.filter(party=customer)

    recognized_je_line_keys = set(
        models.Receivable.objects.filter(company=company, source_document_type="JOURNAL_ENTRY")
        .exclude(status=models.ReceivableStatus.REVERSED)
        .values_list("source_document_id", "source_line_id")
    )

    for line in line_qs:
        key = (str(line.entry_id), str(line.id))
        if key in recognized_je_line_keys:
            continue
        amt = line.foreign_amount if line.foreign_amount > 0 and line.currency_id != company.accounting_currency_id else line.debit
        doc_date = line.entry.document_date or line.entry.posting_date
        due_date = doc_date + timedelta(days=30)
        term_id = None
        term_name = None
        if line.party and line.party.payment_term:
            term = line.party.payment_term
            term_id = str(term.id)
            term_name = term.name
            try:
                due_calc = calculate_payment_dates(term, document_date=doc_date)
                due_date = due_calc["due_date"]
            except Exception:
                due_date = doc_date + timedelta(days=term.due_days)

        results.append({
            "source_document_type": "JOURNAL_ENTRY",
            "source_document_id": str(line.entry_id),
            "source_document_number": line.entry.number,
            "source_line_id": str(line.id),
            "customer_id": str(line.party_id),
            "customer_code": line.party.code,
            "customer_name": line.party.name,
            "account_id": str(line.account_id),
            "account_code": line.account.code,
            "account_name": line.account.name,
            "currency_id": str(line.currency_id),
            "currency_code": line.currency.code,
            "exchange_rate": str(line.exchange_rate),
            "original_amount": str(amt),
            "document_date": str(doc_date),
            "posting_date": str(line.entry.posting_date),
            "due_date": str(due_date),
            "payment_term_id": term_id,
            "payment_term_name": term_name,
            "sales_order_id": None,
            "sales_contract_id": None,
            "description": line.description or line.entry.description,
        })

    if search:
        search_lower = search.strip().lower()
        results = [
            r for r in results
            if search_lower in r["source_document_number"].lower()
            or search_lower in r["customer_name"].lower()
            or search_lower in r["customer_code"].lower()
            or search_lower in r["description"].lower()
        ]

    return results


@transaction.atomic
def recognize_receivable(company, data, user, request=None):
    """
    Recognize receivable from posted source document or GL journal entry.
    (UC-AR-01, BR-AR-01-02 ~ BR-AR-01-15, EF-02 ~ EF-06, EF-09)
    """
    source_type = data.get("source_document_type", "AR_DOCUMENT")
    source_id = str(data.get("source_document_id", "")).strip()
    source_line_id = str(data.get("source_line_id", "")).strip()

    if not source_id:
        raise ValidationError({"source_document_id": "Mã chứng từ nguồn là bắt buộc."})

    # Check duplicate (BR-AR-01-05, EF-04)
    dup_qs = models.Receivable.objects.filter(
        company=company,
        source_document_type=source_type,
        source_document_id=source_id,
        source_line_id=source_line_id,
    ).exclude(status=models.ReceivableStatus.REVERSED)
    if dup_qs.exists():
        existing = dup_qs.first()
        raise ValidationError({
            "source_document_id": "Khoản phát sinh từ chứng từ nguồn đã được ghi nhận công nợ.",
            "existing_receivable_id": str(existing.id),
            "code": existing.code,
        })

    if source_type == "AR_DOCUMENT":
        doc_dup = models.Receivable.objects.filter(
            company=company,
            document_id=source_id,
        ).exclude(status=models.ReceivableStatus.REVERSED)
        if doc_dup.exists():
            existing = doc_dup.first()
            raise ValidationError({
                "source_document_id": "Khoản phát sinh từ chứng từ nguồn đã được ghi nhận công nợ.",
                "existing_receivable_id": str(existing.id),
                "code": existing.code,
            })

    branch = None
    account = None
    doc_obj = None
    je_obj = None
    sales_order = None
    sales_contract = None

    if source_type == "AR_DOCUMENT":
        try:
            doc_obj = models.ReceivableDocument.objects.select_for_update().get(pk=source_id, company=company)
        except models.ReceivableDocument.DoesNotExist:
            raise ValidationError({"source_document_id": "Chứng từ nguồn không tồn tại."})

        # EF-02: nguồn chưa ghi sổ hoặc không còn hiệu lực
        if doc_obj.status != models.DocumentStatus.POSTED:
            raise ValidationError({"source_document_id": "Chứng từ nguồn chưa được ghi sổ hoặc không còn hiệu lực."})

        # EF-03: nguồn không có khách hàng hoặc không phát sinh phải thu
        if not doc_obj.customer_id or doc_obj.amount <= 0:
            raise ValidationError({"source_document_id": "Chứng từ nguồn không có thông tin khách hàng hoặc không phát sinh phải thu."})

        customer = doc_obj.customer
        currency = doc_obj.currency
        exchange_rate = doc_obj.exchange_rate
        original_amount = doc_obj.amount
        document_date = doc_obj.document_date
        posting_date = doc_obj.posting_date
        due_date = data.get("due_date") or doc_obj.due_date
        payment_term = doc_obj.payment_term
        branch = doc_obj.branch
        sales_order = doc_obj.sales_order
        sales_contract = doc_obj.sales_contract
        description = data.get("description") or doc_obj.description
        source_number = doc_obj.number

        if account_id := data.get("account"):
            account = Account.objects.filter(pk=account_id, company=company).first()
        if not account:
            account = Account.objects.filter(company=company, code="131").first() or Account.objects.filter(company=company, code__startswith="131").first()

    elif source_type == "JOURNAL_ENTRY":
        try:
            je_obj = JournalEntry.objects.select_for_update().get(pk=source_id, company=company)
        except JournalEntry.DoesNotExist:
            raise ValidationError({"source_document_id": "Chứng từ nguồn không tồn tại."})

        # EF-02: nguồn chưa ghi sổ
        if je_obj.status != "POSTED":
            raise ValidationError({"source_document_id": "Chứng từ nguồn chưa được ghi sổ hoặc không còn hiệu lực."})

        line_qs = je_obj.lines.filter(debit__gt=0, party__isnull=False)
        if source_line_id:
            line_qs = line_qs.filter(pk=source_line_id)
        line = line_qs.first()

        # EF-03: Nguồn không có khách hàng hoặc không phát sinh phải thu
        if not line or not line.party_id or line.debit <= 0:
            raise ValidationError({"source_document_id": "Chứng từ nguồn không có thông tin khách hàng hoặc không phát sinh phải thu."})

        source_line_id = str(line.id)
        customer = line.party
        currency = line.currency
        exchange_rate = line.exchange_rate
        original_amount = line.foreign_amount if line.foreign_amount > 0 and line.currency_id != company.accounting_currency_id else line.debit
        document_date = je_obj.document_date or je_obj.posting_date
        posting_date = je_obj.posting_date
        branch = je_obj.branch
        account = line.account
        source_number = je_obj.number
        description = data.get("description") or line.description or je_obj.description

        term_id = data.get("payment_term")
        payment_term = PaymentTerm.objects.filter(pk=term_id, company=company).first() if term_id else customer.payment_term
        due_date = data.get("due_date")
        if not due_date:
            if payment_term:
                try:
                    due_date = calculate_payment_dates(payment_term, document_date=document_date)["due_date"]
                except Exception:
                    due_date = document_date + timedelta(days=payment_term.due_days)
            else:
                due_date = document_date + timedelta(days=30)
    else:
        raise ValidationError({"source_document_type": f"Loại chứng từ nguồn '{source_type}' không được hỗ trợ."})

    if "payment_term" in data and data["payment_term"]:
        term_obj = PaymentTerm.objects.filter(pk=data["payment_term"], company=company).first()
        if term_obj:
            payment_term = term_obj

    if isinstance(due_date, str):
        from django.utils.dateparse import parse_date
        due_date = parse_date(due_date)

    if not due_date:
        raise ValidationError({"due_date": "Hạn thanh toán là bắt buộc."})

    if document_date and due_date < document_date:
        raise ValidationError({"due_date": "Hạn thanh toán không được trước ngày chứng từ."})

    # Validate schedules (BR-AR-01-06, EF-05)
    schedules_data = data.get("schedules") or []
    if schedules_data:
        total_sched = Decimal("0")
        for s in schedules_data:
            try:
                amt = Decimal(str(s.get("amount", 0)))
            except Exception:
                raise ValidationError({"schedules": "Số tiền từng đợt không hợp lệ."})
            if amt <= 0:
                raise ValidationError({"schedules": "Số tiền mỗi đợt phải lớn hơn 0."})
            if not s.get("due_date"):
                raise ValidationError({"schedules": "Mỗi đợt thanh toán phải có hạn thanh toán."})
            total_sched += amt
        if total_sched != original_amount:
            raise ValidationError({
                "schedules": f"Tổng số tiền các đợt thanh toán ({total_sched}) phải bằng số tiền phải thu ban đầu ({original_amount})."
            })
    else:
        schedules_data = [{
            "installment_no": 1,
            "amount": original_amount,
            "due_date": due_date,
            "notes": "Đợt 1 (toàn bộ khoản nợ)",
        }]

    code = data.get("code")
    if not code:
        code = generate_receivable_code(company, date=posting_date)

    receivable = models.Receivable.objects.create(
        company=company,
        branch=branch,
        code=code,
        customer=customer,
        source_document_type=source_type,
        source_document_id=source_id,
        source_document_number=source_number,
        source_line_id=source_line_id,
        document=doc_obj,
        journal_entry=je_obj,
        account=account,
        document_date=document_date,
        posting_date=posting_date,
        currency=currency,
        exchange_rate=exchange_rate,
        original_amount=original_amount,
        balance=original_amount,
        collected_amount=Decimal("0"),
        netted_amount=Decimal("0"),
        adjustment_amount=Decimal("0"),
        payment_term=payment_term,
        due_date=due_date,
        sales_order=sales_order,
        sales_contract=sales_contract,
        description=description,
        status=models.ReceivableStatus.OPEN,
        created_by=user,
    )

    for idx, s in enumerate(schedules_data, start=1):
        s_due = s.get("due_date")
        if isinstance(s_due, str):
            from django.utils.dateparse import parse_date
            s_due = parse_date(s_due)
        s_amt = Decimal(str(s.get("amount")))
        models.ReceivableSchedule.objects.create(
            company=company,
            receivable=receivable,
            installment_no=s.get("installment_no", idx),
            amount=s_amt,
            due_date=s_due,
            collected_amount=Decimal("0"),
            balance=s_amt,
            status=models.ReceivableStatus.OPEN,
            notes=s.get("notes", ""),
        )

    if request:
        audit(request, receivable, "RECOGNIZE", after={"code": code, "original_amount": str(original_amount), "source_id": source_id})
    elif user:
        record_audit(
            company=company,
            actor_user=user,
            module_code="AR",
            action_code="RECOGNIZE",
            entity=receivable,
            before={},
            after={"code": code, "original_amount": str(original_amount), "source_id": source_id},
        )

    return receivable


def bulk_recognize_receivables(company, items, user, request=None):
    """
    Process multiple unrecognized sources independently (AF-04).
    """
    results = []
    for item in items:
        source_id = item.get("source_document_id")
        try:
            with transaction.atomic():
                rec = recognize_receivable(company, item, user, request=request)
                results.append({
                    "source_document_id": str(source_id),
                    "success": True,
                    "receivable_id": str(rec.id),
                    "code": rec.code,
                    "error": None,
                })
        except Exception as exc:
            err_msg = str(exc)
            if hasattr(exc, "detail"):
                err_msg = exc.detail
            results.append({
                "source_document_id": str(source_id),
                "success": False,
                "receivable_id": None,
                "code": None,
                "error": err_msg,
            })
    return results


@transaction.atomic
def update_payment_schedule(receivable, new_schedules_data, reason, user, request=None):
    """
    Update installment payment schedule (AF-05, BR-AR-01-06, BR-AR-01-07).
    Requires reason, validates sum = original_amount, checks collected constraints, saves history.
    """
    receivable = models.Receivable.objects.select_for_update().get(pk=receivable.pk)
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Lý do thay đổi lịch thanh toán là bắt buộc."})

    if receivable.status == models.ReceivableStatus.REVERSED:
        raise ValidationError("Không thể sửa lịch thanh toán của khoản nợ đã hủy/không còn hiệu lực.")

    if not new_schedules_data:
        raise ValidationError({"schedules": "Danh sách lịch thanh toán mới không được rỗng."})

    total_amount = Decimal("0")
    for s in new_schedules_data:
        try:
            amt = Decimal(str(s.get("amount", 0)))
        except Exception:
            raise ValidationError({"schedules": "Số tiền từng đợt không hợp lệ."})
        if amt <= 0:
            raise ValidationError({"schedules": "Số tiền mỗi đợt phải lớn hơn 0."})
        if not s.get("due_date"):
            raise ValidationError({"schedules": "Mỗi đợt thanh toán phải có hạn thanh toán."})
        total_amount += amt

    if total_amount != receivable.original_amount:
        raise ValidationError({
            "schedules": f"Tổng số tiền các đợt ({total_amount}) phải bằng số phải thu ban đầu ({receivable.original_amount})."
        })

    old_schedules = list(receivable.schedules.all().order_by("installment_no"))
    old_snapshot = [
        {
            "installment_no": s.installment_no,
            "amount": str(s.amount),
            "due_date": str(s.due_date),
            "collected_amount": str(s.collected_amount),
            "balance": str(s.balance),
            "status": s.status,
            "notes": s.notes,
        }
        for s in old_schedules
    ]

    old_collected_map = {s.installment_no: s.collected_amount for s in old_schedules}
    for s in new_schedules_data:
        inst_no = int(s.get("installment_no", 0))
        amt = Decimal(str(s.get("amount")))
        prev_collected = old_collected_map.get(inst_no, Decimal("0"))
        if amt < prev_collected:
            raise ValidationError({
                "schedules": f"Đợt {inst_no}: Số tiền mới ({amt}) không được nhỏ hơn số đã thu ({prev_collected})."
            })

    new_snapshot = [
        {
            "installment_no": s.get("installment_no", idx),
            "amount": str(s.get("amount")),
            "due_date": str(s.get("due_date")),
            "notes": s.get("notes", ""),
        }
        for idx, s in enumerate(new_schedules_data, start=1)
    ]
    models.ReceivableScheduleHistory.objects.create(
        company=receivable.company,
        receivable=receivable,
        changed_by=user,
        reason=reason,
        old_schedule=old_snapshot,
        new_schedule=new_snapshot,
    )

    receivable.schedules.all().delete()
    from django.utils.dateparse import parse_date
    total_remaining_collected = receivable.collected_amount + receivable.netted_amount
    for idx, s in enumerate(new_schedules_data, start=1):
        inst_no = int(s.get("installment_no", idx))
        amt = Decimal(str(s.get("amount")))
        d_val = s.get("due_date")
        if isinstance(d_val, str):
            d_val = parse_date(d_val)

        alloc = min(total_remaining_collected, amt)
        total_remaining_collected -= alloc
        bal = amt - alloc
        stat = models.ReceivableStatus.PAID if bal == 0 else models.ReceivableStatus.PARTIALLY_PAID if alloc > 0 else models.ReceivableStatus.OPEN

        models.ReceivableSchedule.objects.create(
            company=receivable.company,
            receivable=receivable,
            installment_no=inst_no,
            amount=amt,
            due_date=d_val,
            collected_amount=alloc,
            balance=bal,
            status=stat,
            notes=s.get("notes", ""),
        )

    unpaid_sched = receivable.schedules.filter(balance__gt=0).order_by("due_date").first()
    if unpaid_sched:
        receivable.due_date = unpaid_sched.due_date
        receivable.save(update_fields=("due_date", "updated_at"))

    if request:
        audit(request, receivable, "UPDATE_SCHEDULE", {"schedules": old_snapshot}, {"schedules": new_snapshot}, reason=reason)
    elif user:
        record_audit(
            company=receivable.company,
            actor_user=user,
            module_code="AR",
            action_code="UPDATE_SCHEDULE",
            entity=receivable,
            before={"schedules": old_snapshot},
            after={"schedules": new_snapshot},
            reason=reason,
        )

    return receivable


@transaction.atomic
def reverse_receivable(receivable, reason, user, request=None):
    """
    Invalidate receivable (AF-07, EF-08).
    Rejects if collected or netted amounts exist.
    """
    receivable = models.Receivable.objects.select_for_update().get(pk=receivable.pk)
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Lý do hủy/bỏ ghi nhận là bắt buộc."})

    if receivable.collected_amount > 0 or receivable.netted_amount > 0:
        raise ValidationError(
            "Không thể hủy hoặc bỏ ghi nhận khoản phải thu khi đã có khoản thanh toán hoặc đối trừ. Vui lòng hủy các phân bổ phụ thuộc trước."
        )

    before = {"status": receivable.status, "balance": str(receivable.balance)}
    receivable.balance = Decimal("0")
    receivable.status = models.ReceivableStatus.REVERSED
    receivable.reversed_at = timezone.now()
    receivable.save(update_fields=("balance", "status", "reversed_at", "updated_at"))
    receivable.schedules.update(balance=Decimal("0"), status=models.ReceivableStatus.REVERSED)

    if receivable.document:
        doc = receivable.document
        if doc.status == models.DocumentStatus.POSTED:
            doc.status = models.DocumentStatus.REVERSED
            doc.save(update_fields=("status", "updated_at"))

    after = {"status": receivable.status, "balance": "0"}
    if request:
        audit(request, receivable, "REVERSE", before, after, reason=reason)
    elif user:
        record_audit(
            company=receivable.company,
            actor_user=user,
            module_code="AR",
            action_code="REVERSE",
            entity=receivable,
            before=before,
            after=after,
            reason=reason,
        )

    return receivable


def evaluate_credit(company, customer, amount, branch=None, currency=None, exclude_order=None):
    try:
        amount = Decimal(str(amount))
    except Exception:
        raise ValidationError({"amount": "Giá trị kiểm tra hạn mức không hợp lệ."})
    if amount < 0:
        raise ValidationError({"amount": "Giá trị kiểm tra hạn mức không được âm."})
    today = timezone.localdate()
    policies = list(
        models.CreditPolicy.objects.filter(
            company=company, customer=customer, status="ACTIVE", effective_from__lte=today
        )
        .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today))
        .filter(Q(branch=branch) | Q(branch__isnull=True))
        .filter(Q(currency=currency) | Q(currency__isnull=True))
    )
    policies.sort(
        key=lambda item: (
            item.branch_id == getattr(branch, "id", branch),
            item.currency_id == getattr(currency, "id", currency),
            item.effective_from,
        ),
        reverse=True,
    )
    if not policies:
        return {
            "configured": False,
            "allowed": True,
            "approval_required": False,
            "warning": False,
            "used_limit": "0",
            "available_limit": None,
            "overdue_balance": "0",
        }
    policy = policies[0]
    debts = models.Receivable.objects.filter(company=company, customer=customer, balance__gt=0)
    if policy.branch_id:
        debts = debts.filter(branch=policy.branch)
    if policy.currency_id:
        debts = debts.filter(currency=policy.currency)
    used_debt = debts.aggregate(total=Sum("balance"))["total"] or Decimal("0")
    overdue = debts.filter(due_date__lt=today).aggregate(total=Sum("balance"))["total"] or Decimal("0")
    orders = customer.salesorder_set.exclude(status__in=["COMPLETED", "CANCELLED"])
    if exclude_order:
        orders = orders.exclude(pk=exclude_order.pk)
    if policy.branch_id:
        orders = orders.filter(branch=policy.branch)
    if policy.currency_id:
        orders = orders.filter(currency=policy.currency)
    commitments = orders.aggregate(total=Sum("total_amount"))["total"] or Decimal("0")
    used = used_debt + commitments + amount
    exceeded = used > policy.credit_limit
    has_overdue = overdue > 0
    blocked = (exceeded and policy.control_mode == "BLOCK") or (has_overdue and policy.overdue_mode == "BLOCK")
    approval = (exceeded and policy.control_mode == "APPROVAL") or (has_overdue and policy.overdue_mode == "APPROVAL")
    warning = (exceeded and policy.control_mode == "WARN") or (has_overdue and policy.overdue_mode == "WARN")
    return {
        "configured": True,
        "policy_id": str(policy.id),
        "allowed": not blocked,
        "approval_required": approval,
        "warning": warning,
        "credit_limit": str(policy.credit_limit),
        "used_limit": str(used),
        "available_limit": str(max(policy.credit_limit - used, Decimal("0"))),
        "overdue_balance": str(overdue),
        "exceeded": exceeded,
        "has_overdue": has_overdue,
    }


@transaction.atomic
def submit(obj, request):
    obj = models.ReceivableDocument.objects.select_for_update().get(pk=obj.pk)
    if obj.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}:
        raise ValidationError("Trạng thái không cho phép gửi duyệt.")
    raw = request.data.get("workflow_snapshot") or {}
    try:
        levels = max(1, min(int(raw.get("levels", 1)), 20))
    except (TypeError, ValueError):
        raise ValidationError({"workflow_snapshot": "Số cấp phê duyệt phải từ 1 đến 20."})
    obj.workflow_snapshot = {
        "version": str(raw.get("version", "DEFAULT"))[:80],
        "levels": levels,
        "allow_self_approval": bool(raw.get("allow_self_approval", False)),
    }
    configured = configured_snapshot(obj, f"AR.{obj.document_type}")
    if configured is not None:
        obj.workflow_snapshot = configured
        obj.approval_required = configured["approval_required"]
    before = obj.status
    obj.status = models.DocumentStatus.PENDING_APPROVAL if obj.approval_required else models.DocumentStatus.APPROVED
    obj.submitted_at = timezone.now()
    obj.approved_at = timezone.now() if obj.status == models.DocumentStatus.APPROVED else None
    obj.save()
    models.ApprovalDecision.objects.create(
        company=obj.company,
        document=obj,
        decision="SUBMITTED",
        actor=actor(request),
        comment=request.data.get("comment", ""),
    )
    audit(request, obj, "SUBMIT", {"status": before}, {"status": obj.status})
    return obj


@transaction.atomic
def decide(obj, request, approved):
    obj = models.ReceivableDocument.objects.select_for_update().get(pk=obj.pk)
    if obj.status != models.DocumentStatus.PENDING_APPROVAL:
        raise ValidationError("Chứng từ không chờ phê duyệt.")
    comment = request.data.get("comment", "").strip()
    if not approved and not comment:
        raise ValidationError({"comment": "Ý kiến từ chối là bắt buộc."})
    if obj.created_by_id == actor(request).id and not obj.workflow_snapshot.get("allow_self_approval", False):
        raise ValidationError("Không được tự phê duyệt chứng từ.")
    level = obj.approval_decisions.filter(decision="APPROVED").count() + 1
    final = approved and level >= int(obj.workflow_snapshot.get("levels", 1))
    before = obj.status
    progress = approval_progress(obj, actor(request), approved, obj.approval_decisions.all())
    if progress is not None:
        level, final = progress["level"], progress["final"]
    obj.status = (
        models.DocumentStatus.APPROVED
        if final
        else models.DocumentStatus.PENDING_APPROVAL
        if approved or progress and progress["return_to_previous"]
        else models.DocumentStatus.REJECTED
    )
    obj.approved_at = timezone.now() if final else None
    obj.save(update_fields=("status", "approved_at", "updated_at"))
    models.ApprovalDecision.objects.create(
        company=obj.company,
        document=obj,
        level=level,
        decision="APPROVED" if approved else "REJECTED",
        actor=actor(request),
        comment=comment,
    )
    audit(request, obj, "APPROVE" if approved else "REJECT", {"status": before}, {"status": obj.status}, comment)
    return obj


@transaction.atomic
def post_document(obj, request):
    """
    Post receivable document and automatically recognize receivable and schedule (AF-01).
    """
    obj = models.ReceivableDocument.objects.select_for_update().get(pk=obj.pk)
    if obj.status != models.DocumentStatus.APPROVED:
        raise ValidationError("Chỉ chứng từ APPROVED được ghi sổ.")
    if hasattr(obj, "receivable") and obj.receivable.status != models.ReceivableStatus.REVERSED:
        raise ValidationError("Chứng từ đã được ghi sổ.")

    user = actor(request)
    code = generate_receivable_code(obj.company, date=obj.posting_date)
    debt = models.Receivable.objects.create(
        company=obj.company,
        branch=obj.branch,
        code=code,
        customer=obj.customer,
        document=obj,
        source_document_type="AR_DOCUMENT",
        source_document_id=str(obj.id),
        source_document_number=obj.number,
        document_date=obj.document_date,
        posting_date=obj.posting_date,
        currency=obj.currency,
        exchange_rate=obj.exchange_rate,
        original_amount=obj.amount,
        balance=obj.amount,
        due_date=obj.due_date,
        payment_term=obj.payment_term,
        sales_order=obj.sales_order,
        sales_contract=obj.sales_contract,
        description=obj.description,
        created_by=user,
    )
    models.ReceivableSchedule.objects.create(
        company=obj.company,
        receivable=debt,
        installment_no=1,
        amount=obj.amount,
        due_date=obj.due_date,
        collected_amount=Decimal("0"),
        balance=obj.amount,
        status=models.ReceivableStatus.OPEN,
        notes="Tự động ghi nhận từ chứng từ",
    )

    before = obj.status
    obj.status = models.DocumentStatus.POSTED
    obj.posted_at = timezone.now()
    obj.posting_reference = request.data.get("posting_reference", "")
    obj.save(update_fields=("status", "posted_at", "posting_reference", "updated_at"))
    audit(request, obj, "POST", {"status": before}, {"status": obj.status, "receivable": str(debt.id)})
    return obj


@transaction.atomic
def reverse_document(obj, request):
    obj = models.ReceivableDocument.objects.select_for_update().get(pk=obj.pk)
    reason = request.data.get("reason", "").strip()
    if obj.status != models.DocumentStatus.POSTED or not reason:
        raise ValidationError("Chỉ chứng từ đã ghi sổ và có lý do mới được đảo.")
    debt = models.Receivable.objects.select_for_update().get(document=obj)
    if debt.collected_amount or debt.netted_amount or debt.adjustment_amount:
        raise ValidationError(
            "Không thể hủy hoặc bỏ ghi nhận khoản phải thu khi đã có khoản thanh toán hoặc đối trừ. Vui lòng hủy các phân bổ phụ thuộc trước."
        )
    before = {"document_status": obj.status, "receivable_status": debt.status, "balance": str(debt.balance)}
    debt.balance = Decimal("0")
    debt.status = models.ReceivableStatus.REVERSED
    debt.reversed_at = timezone.now()
    debt.save(update_fields=("balance", "status", "reversed_at", "updated_at"))
    debt.schedules.update(balance=Decimal("0"), status=models.ReceivableStatus.REVERSED)
    obj.status = models.DocumentStatus.REVERSED
    obj.posting_reference = request.data.get("posting_reference", obj.posting_reference)
    obj.save(update_fields=("status", "posting_reference", "updated_at"))
    audit(request, obj, "REVERSE", before, {"document_status": obj.status, "receivable_status": debt.status, "balance": "0"}, reason)
    return obj


def update_debt(debt):
    debt.status = (
        models.ReceivableStatus.PAID
        if debt.balance == 0
        else models.ReceivableStatus.PARTIALLY_PAID
        if debt.balance < debt.original_amount + debt.adjustment_amount
        else models.ReceivableStatus.OPEN
    )
    debt.save()


@transaction.atomic
def allocate(receipt, request):
    receipt = models.Receipt.objects.select_for_update().get(pk=receipt.pk)
    if receipt.status != models.ReceiptStatus.CONFIRMED:
        raise ValidationError("Khoản thu không có hiệu lực.")
    rows = request.data.get("allocations", [])
    try:
        total = sum((Decimal(str(x["amount"])) for x in rows), Decimal("0"))
    except (KeyError, TypeError, ValueError):
        raise ValidationError({"allocations": "Danh sách phân bổ không hợp lệ."})
    if total <= 0 or receipt.allocated_amount + total > receipt.amount:
        raise ValidationError("Tổng phân bổ vượt số tiền chưa phân bổ.")
    for row in rows:
        debt = models.Receivable.objects.select_for_update().get(pk=row["receivable"])
        amount = Decimal(str(row["amount"]))
        if debt.customer_id != receipt.customer_id or debt.company_id != receipt.company_id or amount > debt.balance:
            raise ValidationError("Khoản phân bổ không hợp lệ.")
        if debt.currency_id != receipt.currency_id and not row.get("exchange_rate"):
            raise ValidationError("Phân bổ khác loại tiền phải có tỷ giá.")
        target = None
        if row.get("schedule"):
            target = models.ReceivableSchedule.objects.select_for_update().filter(
                pk=row["schedule"],receivable=debt,
            ).first()
            if target is None or amount > target.balance:
                raise ValidationError("Đợt thanh toán không hợp lệ hoặc không đủ số dư.")
        models.ReceiptAllocation.objects.create(
            receipt=receipt,
            receivable=debt,
            amount=amount,
            exchange_rate=row.get("exchange_rate", 1),
            created_by=actor(request),
            effective_date=max(receipt.receipt_date, timezone.localdate()),
            schedule=target,
            installment_no=target.installment_no if target else None,
            receipt_book_amount=(amount*receipt.exchange_rate).quantize(Decimal("0.0001")),
            debt_book_amount=(amount*debt.exchange_rate).quantize(Decimal("0.0001")),
        )
        debt.collected_amount += amount
        debt.balance -= amount
        update_debt(debt)

        # Sequentially allocate to installments
        rem = amount
        schedules=[target] if target else debt.schedules.select_for_update().filter(balance__gt=0).order_by("installment_no")
        for sched in schedules:
            alloc_sched = min(rem, sched.balance)
            sched.collected_amount += alloc_sched
            sched.balance -= alloc_sched
            sched.status = (
                models.ReceivableStatus.PAID
                if sched.balance == 0
                else models.ReceivableStatus.PARTIALLY_PAID
            )
            sched.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
            rem -= alloc_sched
            if rem <= 0:
                break

    receipt.allocated_amount += total
    receipt.save(update_fields=("allocated_amount",))
    audit(request, receipt, "ALLOCATE", after={"allocated": str(total)})
    return receipt


@transaction.atomic
def contact_plan(obj, request):
    obj = models.CollectionPlan.objects.select_for_update().get(pk=obj.pk)
    if obj.status in {"COMPLETED", "CANCELLED"}:
        raise ValidationError("Kế hoạch đã kết thúc.")
    channel = request.data.get("channel", "EMAIL")
    recipient = request.data.get("recipient", "").strip()
    content = request.data.get("content", "").strip()
    if not recipient or not content:
        raise ValidationError("Người nhận và nội dung nhắc nợ là bắt buộc.")
    history = list(obj.contact_history)
    history.append({
        "sent_at": timezone.now().isoformat(),
        "sender": str(actor(request).id),
        "channel": channel,
        "recipient": recipient,
        "content": content,
        "promise_date": request.data.get("promise_date"),
    })
    obj.contact_history = history
    obj.status = "PROMISED" if request.data.get("promise_date") else "CONTACTED"
    obj.save(update_fields=("contact_history", "status", "updated_at"))
    audit(request, obj, "REMIND", after={"status": obj.status, "channel": channel, "recipient": recipient})
    return obj


@transaction.atomic
def post_netting(obj, request):
    obj = models.Netting.objects.select_for_update().get(pk=obj.pk)
    debt = models.Receivable.objects.select_for_update().get(pk=obj.receivable_id)
    if obj.status != models.PostingStatus.DRAFT or obj.amount > debt.balance:
        raise ValidationError("Số tiền đối trừ không hợp lệ.")
    payable = None
    if obj.payable_id:
        from accounts_payable.models import Payable
        payable = Payable.objects.select_for_update().get(pk=obj.payable_id)
        if payable.supplier_id != debt.customer_id or obj.amount > payable.balance:
            raise ValidationError("Khoản phải trả đối ứng không hợp lệ.")
        payable.netted_amount += obj.amount
        payable.balance -= obj.amount
        from accounts_payable.services import update_payable_status
        update_payable_status(payable)
    debt.netted_amount += obj.amount
    debt.balance -= obj.amount
    update_debt(debt)

    # Sequentially allocate netting to installments
    rem = obj.amount
    for sched in debt.schedules.select_for_update().filter(balance__gt=0).order_by("installment_no"):
        alloc_sched = min(rem, sched.balance)
        sched.collected_amount += alloc_sched
        sched.balance -= alloc_sched
        sched.status = (
            models.ReceivableStatus.PAID
            if sched.balance == 0
            else models.ReceivableStatus.PARTIALLY_PAID
        )
        sched.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
        rem -= alloc_sched
        if rem <= 0:
            break

    obj.status = models.PostingStatus.POSTED
    obj.posting_reference = request.data.get("posting_reference", "")
    obj.posted_at = timezone.now()
    obj.save(update_fields=("status", "posting_reference", "posted_at"))
    audit(request, obj, "NET", after={"status": obj.status, "amount": str(obj.amount)})
    return obj


@transaction.atomic
def reverse_netting(obj, request):
    obj = models.Netting.objects.select_for_update().get(pk=obj.pk)
    reason = request.data.get("reason", "").strip()
    if obj.status != models.PostingStatus.POSTED or not reason:
        raise ValidationError("Chỉ đối trừ đã ghi sổ và có lý do mới được đảo.")
    debt = models.Receivable.objects.select_for_update().get(pk=obj.receivable_id)
    debt.netted_amount -= obj.amount
    debt.balance += obj.amount
    update_debt(debt)

    rem = obj.amount
    for sched in debt.schedules.select_for_update().order_by("-installment_no"):
        if sched.collected_amount > 0:
            restore_sched = min(rem, sched.collected_amount)
            sched.collected_amount -= restore_sched
            sched.balance += restore_sched
            sched.status = (
                models.ReceivableStatus.PARTIALLY_PAID
                if sched.collected_amount > 0
                else models.ReceivableStatus.OPEN
            )
            sched.save(update_fields=("collected_amount", "balance", "status", "updated_at"))
            rem -= restore_sched
            if rem <= 0:
                break

    if obj.payable_id:
        from accounts_payable.models import Payable
        from accounts_payable.services import update_payable_status
        payable = Payable.objects.select_for_update().get(pk=obj.payable_id)
        payable.netted_amount -= obj.amount
        payable.balance += obj.amount
        update_payable_status(payable)
    obj.status = models.PostingStatus.REVERSED
    obj.reversed_at = timezone.now()
    obj.save(update_fields=("status", "reversed_at"))
    audit(request, obj, "REVERSE", after={"status": obj.status}, reason=reason)
    return obj


@transaction.atomic
def send_confirmation(obj, request):
    obj = models.BalanceConfirmation.objects.select_for_update().get(pk=obj.pk)
    recipient = request.data.get("recipient", obj.recipient).strip()
    if obj.status not in {"DRAFT", "PENDING_RESPONSE"} or not recipient:
        raise ValidationError("Biên bản không thể gửi hoặc thiếu người nhận.")
    history = list(obj.sent_history)
    history.append({
        "sent_at": timezone.now().isoformat(),
        "sender": str(actor(request).id),
        "channel": request.data.get("channel", "EMAIL"),
        "recipient": recipient,
    })
    obj.recipient = recipient
    obj.sent_history = history
    obj.status = "PENDING_RESPONSE"
    obj.save(update_fields=("recipient", "sent_history", "status", "updated_at"))
    audit(request, obj, "SEND", after={"status": obj.status, "recipient": recipient})
    return obj


@transaction.atomic
def respond_confirmation(obj, request):
    obj = models.BalanceConfirmation.objects.select_for_update().get(pk=obj.pk)
    status = request.data.get("status")
    note = request.data.get("note", "").strip()
    if obj.status != "PENDING_RESPONSE" or status not in {"AGREED", "VARIANCE", "REJECTED"}:
        raise ValidationError("Phản hồi xác nhận không hợp lệ.")
    if status != "AGREED" and not note:
        raise ValidationError({"note": "Nội dung chênh lệch hoặc từ chối là bắt buộc."})
    obj.status = status
    obj.response_note = note
    obj.save(update_fields=("status", "response_note", "updated_at"))
    audit(request, obj, "RESPOND", after={"status": status}, reason=note)
    return obj


@transaction.atomic
def post_adjustment(obj, request):
    obj = models.ReceivableAdjustment.objects.select_for_update().get(pk=obj.pk)
    debt = models.Receivable.objects.select_for_update().get(pk=obj.receivable_id)
    if obj.status != models.PostingStatus.DRAFT or debt.balance + obj.amount < 0:
        raise ValidationError("Giá trị điều chỉnh không hợp lệ.")
    obj.status = models.PostingStatus.POSTED
    obj.posting_reference = request.data.get("posting_reference", "")
    obj.posted_at = timezone.now()
    obj.save()
    debt.adjustment_amount += obj.amount
    debt.balance += obj.amount
    update_debt(debt)
    audit(request, obj, "ADJUST", after={"amount": str(obj.amount)})
    return obj


@transaction.atomic
def reverse_adjustment(obj, request):
    obj = models.ReceivableAdjustment.objects.select_for_update().get(pk=obj.pk)
    reason = request.data.get("reason", "").strip()
    if obj.status != models.PostingStatus.POSTED or not reason:
        raise ValidationError("Chỉ điều chỉnh đã ghi sổ và có lý do mới được đảo.")
    debt = models.Receivable.objects.select_for_update().get(pk=obj.receivable_id)
    if debt.balance - obj.amount < 0:
        raise ValidationError("Số dư hiện tại không đủ để đảo điều chỉnh.")
    reversal = models.ReceivableAdjustment.objects.create(
        company=obj.company,
        receivable=obj.receivable,
        adjustment_date=timezone.localdate(),
        amount=-obj.amount,
        reason=reason,
        status=models.PostingStatus.POSTED,
        reverses=obj,
        created_by=actor(request),
        posted_at=timezone.now(),
    )
    debt.adjustment_amount -= obj.amount
    debt.balance -= obj.amount
    update_debt(debt)
    obj.status = models.PostingStatus.REVERSED
    obj.save(update_fields=("status",))
    audit(request, obj, "REVERSE", after={"reversal": str(reversal.id)}, reason=reason)
    return reversal
