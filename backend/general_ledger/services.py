from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from common_services.document_lock_services import assert_not_locked, journal_lock_code
from . import models


def actor(request):
    if hasattr(request, "user") and hasattr(request.user, "iam_account") and request.user.iam_account:
        return request.user.iam_account
    from iam.models import UserAccount
    return UserAccount.objects.first()


def audit(request, obj, action, before=None, after=None, reason=""):
    record_audit(
        company=obj.company, actor_user=actor(request), module_code="GL", action_code=action,
        entity=obj, before=before or {}, after=after or {}, request=request, reason=reason,
    )


def _validate_entry(entry):
    lines = list(entry.lines.select_related("account").all())
    if len(lines) < 2 or not any(line.debit > 0 for line in lines) or not any(line.credit > 0 for line in lines):
        raise ValidationError("Bút toán phải có ít nhất một dòng Nợ và một dòng Có.")
    if entry.total_debit <= 0 or entry.total_debit != entry.total_credit:
        raise ValidationError("Tổng Nợ phải bằng Tổng Có và lớn hơn 0.")
    if entry.period.status == "CLOSED" or not entry.period.start_date <= entry.posting_date <= entry.period.end_date:
        raise ValidationError("Kỳ kế toán không hợp lệ hoặc đã đóng.")
    for line in lines:
        account = line.account
        if account.status != "ACTIVE" or not account.is_postable:
            raise ValidationError(f"Tài khoản {account.code} không cho phép hạch toán.")
        # BR-COA-22, 25, 45: Kiểm tra các Accounting Dimension có mức độ REQUIRED
        dim_reqs = account.dimension_requirements or {}
        for dim_name, req_level in dim_reqs.items():
            if req_level in ("REQUIRED", models.DimensionRequirementLevel.REQUIRED):
                if dim_name in ("CUSTOMER", "SUPPLIER", "EMPLOYEE") and not line.party_id:
                    raise ValidationError(f"Tài khoản {account.code} bắt buộc nhập đối tượng {dim_name} (Party).")
                elif dim_name == "PROJECT" and not line.project_id:
                    raise ValidationError(f"Tài khoản {account.code} bắt buộc nhập dự án (Project).")
                elif dim_name == "COST_CENTER" and not line.cost_center_id:
                    raise ValidationError(f"Tài khoản {account.code} bắt buộc nhập trung tâm chi phí (Cost Center).")
                elif dim_name == "WAREHOUSE" and not line.warehouse_id:
                    raise ValidationError(f"Tài khoản {account.code} bắt buộc nhập kho (Warehouse).")
                elif dim_name == "BANK_ACCOUNT":
                    dims = line.dimensions or {}
                    if not (dims.get("bank_account") or dims.get("bank_account_id")):
                        raise ValidationError(f"Tài khoản {account.code} bắt buộc nhập tài khoản ngân hàng (Bank Account).")
                elif dim_name == "STATISTICAL_CODE":
                    dims = line.dimensions or {}
                    stat_val = dims.get("statistical_code_id") or dims.get("statistical_code")
                    if not stat_val:
                        raise ValidationError(f"Tài khoản {account.code} bắt buộc nhập mã thống kê (Statistical Code).")

        # BR-MD-STAT-10, 19, EF-10, EF-11: Xác thực mã thống kê nếu được gắn trên dòng hạch toán
        dims = line.dimensions or {}
        stat_val = dims.get("statistical_code_id") or dims.get("statistical_code")
        if stat_val:
            from django.core.exceptions import ValidationError as DjangoValidationError
            from master_data.statistical_code_services import validate_statistical_code_selection
            try:
                validate_statistical_code_selection(
                    company=entry.company,
                    code_or_id=stat_val,
                    transaction_date=entry.posting_date,
                )
            except DjangoValidationError as exc:
                msg = exc.messages[0] if hasattr(exc, "messages") else str(exc)
                raise ValidationError(msg) from exc

        required = {
            "party": account.requires_party, "project": account.requires_project,
            "cost_center": account.requires_cost_center, "warehouse": account.requires_warehouse,
        }
        missing = [name for name, needed in required.items() if needed and not getattr(line, f"{name}_id")]
        if missing:
            raise ValidationError(f"Tài khoản {account.code} thiếu chiều bắt buộc: {', '.join(missing)}.")


@transaction.atomic
def submit(entry, request):
    entry = models.JournalEntry.objects.select_for_update().get(pk=entry.pk)
    if entry.status not in {"DRAFT", "REJECTED"}:
        raise ValidationError("Trạng thái không cho phép gửi duyệt.")
    _validate_entry(entry)
    raw = request.data.get("workflow_snapshot") or {}
    try:
        levels = max(1, min(int(raw.get("levels", 1)), 20))
    except (TypeError, ValueError):
        raise ValidationError("Số cấp phê duyệt không hợp lệ.")
    entry.workflow_snapshot = {
        "version": str(raw.get("version", "DEFAULT"))[:80], "levels": levels,
        "allow_self_approval": bool(raw.get("allow_self_approval", False)),
        "allow_creator_posting": bool(raw.get("allow_creator_posting", False)),
    }
    configured = configured_snapshot(entry, "GL.JOURNAL_ENTRY")
    if configured is not None:
        entry.workflow_snapshot = {**configured, "allow_creator_posting": False}
    old = entry.status
    entry.status = "PENDING_APPROVAL" if configured is None or configured["approval_required"] else "APPROVED"
    entry.submitted_at = timezone.now()
    entry.approved_by = actor(request) if entry.status == "APPROVED" else None
    entry.approved_at = timezone.now() if entry.status == "APPROVED" else None
    entry.save(update_fields=("status", "workflow_snapshot", "submitted_at", "approved_by", "approved_at", "updated_at"))
    models.JournalApproval.objects.create(company=entry.company, entry=entry, decision="SUBMITTED", actor=actor(request))
    audit(request, entry, "SUBMIT", {"status": old}, {"status": entry.status})
    return entry


@transaction.atomic
def decide(entry, request, approved):
    entry = models.JournalEntry.objects.select_for_update().get(pk=entry.pk)
    comment = request.data.get("comment", "").strip()
    if entry.status != "PENDING_APPROVAL" or entry.period.status == "CLOSED":
        raise ValidationError("Bút toán không chờ duyệt hoặc kỳ đã đóng.")
    if not approved and not comment:
        raise ValidationError({"comment": "Ý kiến từ chối là bắt buộc."})
    if entry.created_by_id == actor(request).id and not entry.workflow_snapshot.get("allow_self_approval", False):
        raise ValidationError("Người tạo không được tự duyệt.")
    level = entry.approval_decisions.filter(decision="APPROVED").count() + 1
    final = approved and level >= int(entry.workflow_snapshot.get("levels", 1))
    progress = approval_progress(entry, actor(request), approved, entry.approval_decisions.all())
    if progress is not None:
        level, final = progress["level"], progress["final"]
    old = entry.status
    entry.status = "APPROVED" if final else "PENDING_APPROVAL" if approved or progress and progress["return_to_previous"] else "REJECTED"
    entry.approved_by = actor(request) if final else None
    entry.approved_at = timezone.now() if final else None
    entry.save(update_fields=("status", "approved_by", "approved_at", "updated_at"))
    models.JournalApproval.objects.create(company=entry.company, entry=entry, level=level, decision="APPROVED" if approved else "REJECTED", actor=actor(request), comment=comment)
    audit(request, entry, "APPROVE" if approved else "REJECT", {"status": old}, {"status": entry.status}, comment)
    return entry


def _balance(period, account, branch):
    obj = models.AccountBalance.objects.select_for_update().filter(period=period, account=account, branch=branch).first()
    if obj:
        return obj
    previous = models.AccountBalance.objects.filter(
        company=period.company, account=account, branch=branch, period__end_date__lt=period.start_date,
    ).order_by("-period__end_date").first()
    return models.AccountBalance.objects.create(
        company=period.company, period=period, account=account, branch=branch,
        opening_debit=previous.closing_debit if previous else 0,
        opening_credit=previous.closing_credit if previous else 0,
    )


def _recalculate_closing(balance):
    net = balance.opening_debit - balance.opening_credit + balance.period_debit - balance.period_credit
    balance.closing_debit = max(net, Decimal("0"))
    balance.closing_credit = max(-net, Decimal("0"))


@transaction.atomic
def post(entry, request):
    entry = models.JournalEntry.objects.select_for_update().prefetch_related("lines__account").get(pk=entry.pk)
    if entry.status != "APPROVED":
        raise ValidationError("Chỉ bút toán đã duyệt mới được ghi sổ.")
    if entry.created_by_id == actor(request).id and not entry.workflow_snapshot.get("allow_creator_posting", False):
        raise ValidationError("Người tạo không được tự ghi sổ.")
    assert_not_locked(entry.company, journal_lock_code(entry), entry.posting_date)
    _validate_entry(entry)
    for line in entry.lines.all():
        balance = _balance(entry.period, line.account, entry.branch)
        balance.period_debit += line.debit
        balance.period_credit += line.credit
        _recalculate_closing(balance)
        balance.save(update_fields=("period_debit", "period_credit", "closing_debit", "closing_credit", "updated_at"))
    entry.status = "POSTED"
    entry.posted_by = actor(request)
    entry.posted_at = timezone.now()
    entry.save(update_fields=("status", "posted_by", "posted_at", "updated_at"))
    audit(request, entry, "POST", after={"total_debit": str(entry.total_debit), "total_credit": str(entry.total_credit)})
    return entry


@transaction.atomic
def reverse(entry, request):
    entry = models.JournalEntry.objects.select_for_update().prefetch_related("lines").get(pk=entry.pk)
    reason = request.data.get("reason", "").strip()
    if entry.status != "POSTED" or not reason:
        raise ValidationError("Chỉ bút toán đã ghi sổ và có lý do mới được đảo.")
    if entry.related_entries.filter(entry_type="REVERSAL", status__in=("APPROVED", "POSTED")).exists():
        raise ValidationError("Bút toán đã có giao dịch đảo.")
    try:
        period = models.AccountingPeriod.objects.get(pk=request.data.get("period"), company=entry.company, status="OPEN")
    except (models.AccountingPeriod.DoesNotExist, ValueError):
        raise ValidationError({"period": "Phải chọn kỳ đang mở để ghi bút toán đảo."})
    posting_date = request.data.get("posting_date") or timezone.localdate()
    parsed_date = posting_date if isinstance(posting_date, date) else date.fromisoformat(str(posting_date))
    if not period.start_date <= parsed_date <= period.end_date:
        raise ValidationError({"posting_date": "Ngày đảo không thuộc kỳ được chọn."})
    reversal = models.JournalEntry.objects.create(
        company=entry.company, branch=entry.branch, period=period, number=request.data.get("number") or f"REV-{entry.number}",
        entry_type="REVERSAL", posting_date=posting_date, document_date=posting_date,
        description=f"Đảo {entry.number}: {reason}", source_module="GL", original_entry=entry,
        status="APPROVED", total_debit=entry.total_credit, total_credit=entry.total_debit,
        created_by=actor(request), approved_by=actor(request), approved_at=timezone.now(),
        workflow_snapshot={"allow_creator_posting": True, "reversal": True},
    )
    for line in entry.lines.all():
        models.JournalLine.objects.create(
            entry=reversal, line_no=line.line_no, account=line.account, description=line.description,
            debit=line.credit, credit=line.debit, currency=line.currency, foreign_amount=line.foreign_amount,
            exchange_rate=line.exchange_rate, party=line.party, department=line.department,
            project=line.project, cost_center=line.cost_center, warehouse=line.warehouse, dimensions=line.dimensions,
        )
    post(reversal, request)
    entry.status = "REVERSED"
    entry.save(update_fields=("status", "updated_at"))
    audit(request, reversal, "REVERSE", after={"original_entry": str(entry.id)}, reason=reason)
    return reversal


@transaction.atomic
def aggregate(period, request):
    if period.status == "CLOSED":
        raise ValidationError("Không tổng hợp lại kỳ đã đóng.")
    balances = models.AccountBalance.objects.select_for_update().filter(period=period)
    for balance in balances:
        balance.period_debit = balance.period_credit = Decimal("0")
        _recalculate_closing(balance)
        balance.save(update_fields=("period_debit", "period_credit", "closing_debit", "closing_credit", "updated_at"))
    rows = models.JournalLine.objects.filter(entry__period=period, entry__status__in=("POSTED", "REVERSED")).values("account_id", "entry__branch_id").annotate(debit=Sum("debit"), credit=Sum("credit"))
    total_debit = total_credit = Decimal("0")
    for row in rows:
        balance = _balance(period, models.Account.objects.get(pk=row["account_id"]), row["entry__branch_id"])
        balance.period_debit, balance.period_credit = row["debit"], row["credit"]
        _recalculate_closing(balance)
        balance.save(update_fields=("period_debit", "period_credit", "closing_debit", "closing_credit", "updated_at"))
        total_debit += row["debit"]
        total_credit += row["credit"]
    if total_debit != total_credit:
        raise ValidationError("Tổng phát sinh Nợ/Có toàn kỳ không cân bằng.")
    audit(request, period, "AGGREGATE", after={"total_debit": str(total_debit), "total_credit": str(total_credit)})
    return {"period": str(period.id), "total_debit": total_debit, "total_credit": total_credit, "balance_rows": models.AccountBalance.objects.filter(period=period).count()}


@transaction.atomic
def close_period(period, request):
    period = models.AccountingPeriod.objects.select_for_update().get(pk=period.pk)
    if period.status != "OPEN":
        raise ValidationError("Kỳ không ở trạng thái mở.")
    if period.journal_entries.exclude(status__in=("POSTED", "REVERSED", "CANCELLED")).exists():
        raise ValidationError("Còn bút toán chưa hoàn tất trong kỳ.")
    if period.reconciliations.filter(status="VARIANCE", resolved=False).exists():
        raise ValidationError("Còn chênh lệch đối chiếu chưa xử lý.")
    aggregate(period, request)
    period.status = "CLOSED"
    period.closed_by = actor(request)
    period.closed_at = timezone.now()
    period.save(update_fields=("status", "closed_by", "closed_at"))
    audit(request, period, "CLOSE_PERIOD", after={"status": period.status})
    return period


@transaction.atomic
def reopen_period(period, request):
    period = models.AccountingPeriod.objects.select_for_update().get(pk=period.pk)
    reason = request.data.get("reason", "").strip()
    if period.status != "CLOSED" or not reason:
        raise ValidationError("Chỉ kỳ đã đóng và có lý do mới được mở lại.")
    period.status = "OPEN"
    period.reopened_by = actor(request)
    period.reopened_at = timezone.now()
    period.reopen_reason = reason
    period.save(update_fields=("status", "reopened_by", "reopened_at", "reopen_reason"))
    audit(request, period, "REOPEN_PERIOD", {"status": "CLOSED"}, {"status": "OPEN"}, reason)
    return period


@transaction.atomic
def run_allocation(rule, period, key, request):
    rule = models.AllocationRule.objects.select_for_update().prefetch_related("destinations").get(pk=rule.pk)
    if not rule.is_active or period.status != "OPEN" or rule.company_id != period.company_id:
        raise ValidationError("Quy tắc phân bổ hoặc kỳ không hợp lệ.")
    if not key or models.AllocationRun.objects.filter(idempotency_key=key).exists():
        raise ValidationError({"idempotency_key": "Mã chạy thiếu hoặc đã tồn tại."})
    if sum((row.percentage for row in rule.destinations.all()), Decimal("0")) != Decimal("100"):
        raise ValidationError("Tổng tỷ lệ phân bổ phải bằng 100%.")
    source = models.AccountBalance.objects.filter(period=period, account=rule.source_account).aggregate(d=Sum("closing_debit"), c=Sum("closing_credit"))
    amount = abs((source["d"] or Decimal("0")) - (source["c"] or Decimal("0")))
    if amount <= 0:
        raise ValidationError("Không có số dư nguồn để phân bổ.")
    num = f"ALLOC-{rule.code}-{period.code}"
    if models.JournalEntry.objects.filter(company=period.company, number=num).exists():
        num = f"ALLOC-{rule.code}-{period.code}-{int(timezone.now().timestamp())}"
    entry = models.JournalEntry.objects.create(
        company=period.company, period=period, number=num, entry_type="ALLOCATION",
        posting_date=period.end_date, document_date=period.end_date, description=f"Phân bổ {rule.name}",
        source_module="GL", source_event_id=key, status="APPROVED", total_debit=amount, total_credit=amount,
        created_by=actor(request), approved_by=actor(request), approved_at=timezone.now(), workflow_snapshot={"allow_creator_posting": True},
    )
    line_no, allocated = 1, Decimal("0")
    destinations = list(rule.destinations.all())
    for index, destination in enumerate(destinations):
        value = amount - allocated if index == len(destinations) - 1 else (amount * destination.percentage / Decimal("100")).quantize(Decimal("0.0001"))
        allocated += value
        models.JournalLine.objects.create(entry=entry, line_no=line_no, account=destination.account, debit=value, currency=period.company.accounting_currency, department=destination.department, project=destination.project, cost_center=destination.cost_center)
        line_no += 1
    models.JournalLine.objects.create(entry=entry, line_no=line_no, account=rule.offset_account, credit=amount, currency=period.company.accounting_currency)
    post(entry, request)
    run = models.AllocationRun.objects.create(company=period.company, rule=rule, period=period, idempotency_key=key, amount=amount, entry=entry, created_by=actor(request))
    audit(request, run, "ALLOCATE", after={"entry": str(entry.id), "amount": str(amount)})
    return run


@transaction.atomic
def run_closing(rule, period, request):
    rule = models.ClosingRule.objects.select_for_update().get(pk=rule.pk)
    if not rule.is_active or period.status != "OPEN" or rule.company_id != period.company_id:
        raise ValidationError("Quy tắc kết chuyển hoặc kỳ không hợp lệ.")
    if models.ClosingRun.objects.filter(rule=rule, period=period).exists():
        raise ValidationError("Quy tắc đã được kết chuyển trong kỳ.")
    balance = models.AccountBalance.objects.filter(period=period, account=rule.source_account).aggregate(d=Sum("closing_debit"), c=Sum("closing_credit"))
    net = (balance["d"] or Decimal("0")) - (balance["c"] or Decimal("0"))
    amount = abs(net)
    if amount == 0:
        raise ValidationError("Tài khoản nguồn không có số dư cần kết chuyển.")
    close_num = f"CLOSE-{rule.code}-{period.code}"
    if models.JournalEntry.objects.filter(company=period.company, number=close_num).exists():
        close_num = f"CLOSE-{rule.code}-{period.code}-{int(timezone.now().timestamp())}"
    entry = models.JournalEntry.objects.create(
        company=period.company, period=period, number=close_num, entry_type="CLOSING",
        posting_date=period.end_date, document_date=period.end_date, description=f"Kết chuyển {rule.name}",
        source_module="GL", source_event_id=f"CLOSE:{rule.id}:{period.id}", status="APPROVED",
        total_debit=amount, total_credit=amount, created_by=actor(request), approved_by=actor(request),
        approved_at=timezone.now(), workflow_snapshot={"allow_creator_posting": True},
    )
    if net > 0:
        lines = ((rule.source_account, Decimal("0"), amount), (rule.destination_account, amount, Decimal("0")))
    else:
        lines = ((rule.source_account, amount, Decimal("0")), (rule.destination_account, Decimal("0"), amount))
    for index, (account, debit, credit) in enumerate(lines, 1):
        models.JournalLine.objects.create(entry=entry, line_no=index, account=account, debit=debit, credit=credit, currency=period.company.accounting_currency)
    post(entry, request)
    run = models.ClosingRun.objects.create(company=period.company, rule=rule, period=period, entry=entry, created_by=actor(request))
    audit(request, run, "CLOSE_ACCOUNT", after={"entry": str(entry.id), "amount": str(amount)})
    return run


@transaction.atomic
def reconcile(period, account, module, subledger_amount, details, request):
    gl = models.JournalLine.objects.filter(entry__period=period, entry__status__in=("POSTED", "REVERSED"), account=account).aggregate(d=Sum("debit"), c=Sum("credit"))
    gl_amount = (gl["d"] or Decimal("0")) - (gl["c"] or Decimal("0"))
    difference = gl_amount - subledger_amount
    obj = models.GlReconciliation.objects.create(
        company=period.company, period=period, source_module=module, account=account,
        subledger_amount=subledger_amount, gl_amount=gl_amount, difference=difference,
        status="MATCHED" if difference == 0 else "VARIANCE", details=details, created_by=actor(request),
    )
    audit(request, obj, "RECONCILE", after={"status": obj.status, "difference": str(difference)})
    return obj
