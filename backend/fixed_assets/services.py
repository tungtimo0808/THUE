from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from . import models


def actor(request):
    if hasattr(request.user, "iam_account"):
        return request.user.iam_account
    from iam.models import UserAccount
    return UserAccount.objects.first()


def audit(request, obj, action, before=None, after=None, reason=""):
    record_audit(
        company=obj.company, actor_user=actor(request), module_code="FA", action_code=action,
        entity=obj, before=before or {}, after=after or {}, request=request, reason=reason,
    )


def _closed(company, date):
    return models.AssetPeriod.objects.filter(company=company, start_date__lte=date, end_date__gte=date, status="CLOSED").exists()


def _snapshot(asset):
    return {
        "category": str(asset.category_id), "original_cost": str(asset.original_cost),
        "accumulated_depreciation": str(asset.accumulated_depreciation), "allocated_value": str(asset.allocated_value),
        "periods_processed": asset.periods_processed, "branch": str(asset.branch_id),
        "department": str(asset.department_id) if asset.department_id else None,
        "custodian": str(asset.custodian_id) if asset.custodian_id else None,
        "status": asset.status, "disposed_at": str(asset.disposed_at) if asset.disposed_at else None,
    }


@transaction.atomic
def submit(obj, request):
    obj = models.AssetTransaction.objects.select_for_update().get(pk=obj.pk)
    if obj.status not in {"DRAFT", "REJECTED"}:
        raise ValidationError("Trạng thái không cho phép gửi duyệt.")
    if _closed(obj.company, obj.transaction_date):
        raise ValidationError("Không được gửi giao dịch vào kỳ đã đóng.")
    raw = request.data.get("workflow_snapshot") or {}
    try:
        levels = max(1, min(int(raw.get("levels", 1)), 20))
    except (TypeError, ValueError):
        raise ValidationError("Số cấp phê duyệt không hợp lệ.")
    obj.workflow_snapshot = {"version": str(raw.get("version", "DEFAULT"))[:80], "levels": levels, "allow_self_approval": bool(raw.get("allow_self_approval", True))}
    configured = configured_snapshot(obj, f"FA.{obj.transaction_type}")
    if configured is not None:
        obj.workflow_snapshot = configured
    old = obj.status
    obj.status = "PENDING_APPROVAL" if configured is None or configured["approval_required"] else "APPROVED"
    obj.submitted_at = timezone.now()
    obj.approved_at = timezone.now() if obj.status == "APPROVED" else None
    obj.save(update_fields=("workflow_snapshot", "status", "submitted_at", "approved_at", "updated_at"))
    models.ApprovalDecision.objects.create(company=obj.company, transaction=obj, decision="SUBMITTED", actor=actor(request))
    audit(request, obj, "SUBMIT", {"status": old}, {"status": obj.status})
    return obj


@transaction.atomic
def decide(obj, request, approved):
    obj = models.AssetTransaction.objects.select_for_update().get(pk=obj.pk)
    comment = request.data.get("comment", "").strip()
    if obj.status != "PENDING_APPROVAL":
        raise ValidationError("Giao dịch không chờ duyệt.")
    if _closed(obj.company, obj.transaction_date):
        raise ValidationError("Không được duyệt giao dịch trong kỳ đã đóng.")
    if not approved and not comment:
        raise ValidationError({"comment": "Ý kiến từ chối là bắt buộc."})
    if obj.created_by_id == actor(request).id and not obj.workflow_snapshot.get("allow_self_approval", False) and not getattr(request.user, "is_superuser", False):
        raise ValidationError("Người tạo không được tự phê duyệt.")
    level = obj.approval_decisions.filter(decision="APPROVED").count() + 1
    final = approved and level >= int(obj.workflow_snapshot.get("levels", 1))
    progress = approval_progress(obj, actor(request), approved, obj.approval_decisions.all())
    if progress is not None:
        level, final = progress["level"], progress["final"]
    old = obj.status
    obj.status = "APPROVED" if final else "PENDING_APPROVAL" if approved or progress and progress["return_to_previous"] else "REJECTED"
    obj.approved_at = timezone.now() if final else None
    obj.save(update_fields=("status", "approved_at", "updated_at"))
    models.ApprovalDecision.objects.create(company=obj.company, transaction=obj, level=level, decision="APPROVED" if approved else "REJECTED", actor=actor(request), comment=comment)
    audit(request, obj, "APPROVE" if approved else "REJECT", {"status": old}, {"status": obj.status}, comment)
    return obj


@transaction.atomic
def post_transaction(obj, request):
    obj = models.AssetTransaction.objects.select_for_update().get(pk=obj.pk)
    asset = models.AssetRecord.objects.select_for_update().get(pk=obj.asset_id)
    if obj.status != "APPROVED" or obj.asset_applied:
        raise ValidationError("Giao dịch chưa duyệt hoặc đã cập nhật tài sản.")
    if _closed(obj.company, obj.transaction_date):
        raise ValidationError("Không được ghi nhận giao dịch vào kỳ đã đóng.")
    before = _snapshot(asset)
    kind = obj.transaction_type
    if kind == "ACQUISITION":
        if asset.status != "DRAFT" or asset.transactions.filter(transaction_type="ACQUISITION", status="POSTED").exists():
            raise ValidationError("Tài sản đã được ghi tăng.")
        if obj.amount != asset.original_cost:
            raise ValidationError("Giá trị ghi tăng phải bằng nguyên giá trên hồ sơ.")
        asset.status = "ACTIVE"
    elif kind == "DEPRECIATION":
        if asset.asset_type != "FIXED_ASSET" or asset.status != "ACTIVE":
            raise ValidationError("Tài sản không đủ điều kiện khấu hao.")
        limit = asset.original_cost - asset.salvage_value - asset.accumulated_depreciation
        if obj.amount > limit:
            raise ValidationError("Khấu hao vượt giá trị còn được phép khấu hao.")
        asset.accumulated_depreciation += obj.amount
        asset.periods_processed += 1
    elif kind == "ALLOCATION":
        if asset.asset_type != "TOOL" or asset.status != "ACTIVE":
            raise ValidationError("CCDC không đủ điều kiện phân bổ.")
        if obj.amount > asset.original_cost - asset.allocated_value:
            raise ValidationError("Phân bổ vượt giá trị CCDC còn lại.")
        asset.allocated_value += obj.amount
        asset.periods_processed += 1
    elif kind == "TRANSFER":
        targets = (obj.target_branch, obj.target_department, obj.target_custodian)
        if not any(targets):
            raise ValidationError("Thiếu đơn vị/người nhận điều chuyển.")
        for value in targets:
            if value and value.company_id != asset.company_id:
                raise ValidationError("Đơn vị/người nhận phải thuộc cùng doanh nghiệp.")
        if obj.target_branch_id:
            asset.branch = obj.target_branch
        if obj.target_department_id:
            asset.department = obj.target_department
        if obj.target_custodian_id:
            asset.custodian = obj.target_custodian
        obj.gl_status = "NOT_REQUIRED"
    elif kind == "RECLASSIFICATION":
        if not obj.target_category_id or obj.target_category_id == asset.category_id or obj.target_category.asset_type != asset.asset_type:
            raise ValidationError("Nhóm đích không hợp lệ.")
        asset.category = obj.target_category
        obj.gl_status = "NOT_REQUIRED"
    elif kind == "VALUE_INCREASE":
        asset.original_cost += obj.amount
    elif kind == "VALUE_DECREASE":
        if asset.original_cost - obj.amount < asset.processed_value + asset.salvage_value:
            raise ValidationError("Giảm nguyên giá làm giá trị còn lại không hợp lệ.")
        asset.original_cost -= obj.amount
    elif kind == "DISPOSAL":
        if asset.status == "DISPOSED":
            raise ValidationError("Tài sản đã được ghi giảm.")
        if obj.amount != asset.remaining_value:
            raise ValidationError("Giá trị ghi giảm phải bằng giá trị còn lại tại thời điểm xử lý.")
        asset.status = "DISPOSED"
        asset.disposed_at = obj.transaction_date
    else:
        raise ValidationError("Loại giao dịch không được ghi nhận trực tiếp.")
    asset.save()
    obj.before_snapshot = before
    obj.after_snapshot = _snapshot(asset)
    obj.asset_applied = True
    obj.status = "POSTED"
    obj.posted_at = timezone.now()
    obj.save(update_fields=("before_snapshot", "after_snapshot", "asset_applied", "status", "posted_at", "gl_status", "updated_at"))
    audit(request, obj, "POST", before, obj.after_snapshot)
    return obj


@transaction.atomic
def reverse(obj, request):
    obj = models.AssetTransaction.objects.select_for_update().get(pk=obj.pk)
    reason = request.data.get("reason", "").strip()
    if obj.status != "POSTED" or obj.gl_status == "POSTED" or not reason:
        raise ValidationError("Giao dịch không thể đảo; cần lý do và xử lý GL trước.")
    if obj.reversals.filter(status__in=("APPROVED", "POSTED")).exists():
        raise ValidationError("Giao dịch đã có giao dịch đảo.")
    asset = models.AssetRecord.objects.select_for_update().get(pk=obj.asset_id)
    snapshot = obj.before_snapshot
    asset.category_id = snapshot["category"]
    asset.original_cost = Decimal(snapshot["original_cost"])
    asset.accumulated_depreciation = Decimal(snapshot["accumulated_depreciation"])
    asset.allocated_value = Decimal(snapshot["allocated_value"])
    asset.periods_processed = snapshot["periods_processed"]
    asset.branch_id = snapshot["branch"]
    asset.department_id = snapshot["department"]
    asset.custodian_id = snapshot["custodian"]
    asset.status = snapshot["status"]
    asset.disposed_at = snapshot["disposed_at"] or None
    asset.save()
    reversal = models.AssetTransaction.objects.create(
        company=obj.company, asset=asset, number=f"REV-{obj.number}", transaction_type="REVERSAL",
        transaction_date=timezone.localdate(), amount=obj.amount, reason=reason, original_transaction=obj,
        before_snapshot=obj.after_snapshot, after_snapshot=obj.before_snapshot, status="POSTED", asset_applied=True,
        gl_status="NOT_REQUIRED", created_by=actor(request), approved_at=timezone.now(), posted_at=timezone.now(),
    )
    obj.status = "REVERSED"
    obj.save(update_fields=("status", "updated_at"))
    audit(request, reversal, "REVERSE", reversal.before_snapshot, reversal.after_snapshot, reason)
    return reversal


@transaction.atomic
def calculate(run, request):
    run = models.CalculationRun.objects.select_for_update().get(pk=run.pk)
    if run.status != "DRAFT" or _closed(run.company, run.period_end):
        raise ValidationError("Kỳ tính đã xử lý hoặc đã đóng.")
    asset_type = "FIXED_ASSET" if run.calculation_type == "DEPRECIATION" else "TOOL"
    operation = run.calculation_type
    assets = models.AssetRecord.objects.select_for_update().filter(
        company=run.company, asset_type=asset_type, status="ACTIVE",
        method="STRAIGHT_LINE", in_service_date__lte=run.period_end,
    )
    total = Decimal("0")
    for asset in assets:
        if models.AssetTransaction.objects.filter(asset=asset, transaction_type=operation, period_code=run.period_code, status__in=("DRAFT", "PENDING_APPROVAL", "APPROVED", "POSTED")).exists():
            continue
        opening = asset.remaining_value
        depreciable = asset.original_cost - asset.salvage_value if asset_type == "FIXED_ASSET" else asset.original_cost
        processed = asset.accumulated_depreciation if asset_type == "FIXED_ASSET" else asset.allocated_value
        remaining = depreciable - processed
        if remaining <= 0:
            continue
        amount = min(remaining, depreciable / asset.useful_life_periods)
        models.CalculationLine.objects.create(run=run, asset=asset, opening_value=opening, amount=amount, closing_value=opening - amount)
        total += amount
    if not run.lines.exists():
        raise ValidationError("Không có tài sản đủ điều kiện tính trong kỳ.")
    run.status = "CALCULATED"
    run.total_amount = total
    run.save(update_fields=("status", "total_amount"))
    audit(request, run, "CALCULATE", after={"total_amount": str(total), "lines": run.lines.count()})
    return run


@transaction.atomic
def post_run(run, request):
    run = models.CalculationRun.objects.select_for_update().prefetch_related("lines__asset").get(pk=run.pk)
    if run.status != "CALCULATED" or _closed(run.company, run.period_end):
        raise ValidationError("Bảng tính chưa sẵn sàng hoặc kỳ đã đóng.")
    for index, line in enumerate(run.lines.all(), 1):
        obj = models.AssetTransaction.objects.create(
            company=run.company, asset=line.asset, number=f"{run.number}-{index:04d}",
            transaction_type=run.calculation_type, transaction_date=run.period_end, amount=line.amount,
            period_code=run.period_code, source_module="FA_RUN", source_reference=str(run.id),
            idempotency_key=f"FA-RUN:{run.id}:{line.asset_id}", status="APPROVED", created_by=actor(request), approved_at=timezone.now(),
        )
        post_transaction(obj, request)
        line.transaction = obj
        line.save(update_fields=("transaction",))
    run.status = "POSTED"
    run.save(update_fields=("status",))
    audit(request, run, "POST_RUN", after={"status": run.status})
    return run


@transaction.atomic
def post_gl(obj, request):
    obj = models.AssetTransaction.objects.select_for_update().get(pk=obj.pk)
    reference = request.data.get("gl_reference", "").strip()
    debit = Decimal(str(request.data.get("total_debit", "0")))
    credit = Decimal(str(request.data.get("total_credit", "0")))
    if obj.status != "POSTED" or obj.gl_status in {"POSTED", "NOT_REQUIRED"} or not reference:
        raise ValidationError("Giao dịch không ở trạng thái có thể chuyển GL.")
    category = obj.asset.category
    if not category.asset_account_id or not category.accumulated_account_id or not category.expense_account_id:
        raise ValidationError("Nhóm tài sản chưa cấu hình đủ tài khoản hạch toán.")
    if debit != credit or debit != obj.amount:
        raise ValidationError("Bút toán phải cân bằng và bằng giá trị giao dịch tài sản.")
    obj.gl_status = "POSTED"
    obj.gl_reference = reference
    obj.save(update_fields=("gl_status", "gl_reference", "updated_at"))
    audit(request, obj, "POST_GL", after={"gl_reference": reference})
    return obj
