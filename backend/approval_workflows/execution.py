from rest_framework.exceptions import PermissionDenied, ValidationError

from .submission import document_context
from .validation import eligible_approvers, resolve_approver


def approval_progress(obj, actor, approved, decisions):
    """Compute the current configured step from the document's immutable snapshot.

    Legacy documents return None and keep their existing approval behavior.
    """
    snapshot = obj.workflow_snapshot or {}
    if not snapshot.get("version_id"):
        return None
    from master_data.models import DocumentType

    document_type = DocumentType.objects.filter(code=snapshot.get("document_type_code")).first()
    if not document_type:
        raise ValidationError("Loại chứng từ của Workflow không còn hợp lệ.")
    steps = snapshot.get("steps") or []
    if not steps:
        raise ValidationError("Workflow không có bước phê duyệt.")
    latest_submission = decisions.filter(decision="SUBMITTED").order_by("-decided_at", "-pk").first()
    round_decisions = decisions.filter(decided_at__gt=latest_submission.decided_at) if latest_submission else decisions
    latest_rejection = round_decisions.filter(decision="REJECTED").order_by("-decided_at", "-pk").first()
    start_order = int(snapshot.get("resume_step", 1))
    history_query = round_decisions.filter(decision="APPROVED")
    if latest_rejection and 1 <= latest_rejection.level <= len(steps) and \
            steps[latest_rejection.level - 1].get("on_reject") == "PREVIOUS":
        start_order = max(1, latest_rejection.level - 1)
        history_query = history_query.filter(decided_at__gt=latest_rejection.decided_at)
    history = list(history_query.order_by("decided_at", "pk"))
    previous = set()
    current_order = start_order
    visited = set()
    while True:
        if current_order in visited or current_order > len(steps):
            raise ValidationError("Workflow có đường xử lý không hợp lệ.")
        visited.add(current_order)
        step = steps[current_order - 1]
        context = document_context(obj)
        ordered = []
        for rule in step.get("approvers", []):
            for user_id in sorted(resolve_approver(rule, obj.company, context, previous)):
                if user_id not in ordered:
                    ordered.append(user_id)
        eligible = eligible_approvers(ordered, obj.company, document_type, context)
        ordered = [user_id for user_id in ordered if user_id in eligible]
        if not ordered and step.get("fallback"):
            ordered = sorted(eligible_approvers(
                resolve_approver(step["fallback"], obj.company, context, previous),
                obj.company, document_type, context))
        if not ordered:
            raise ValidationError("Không tìm được Approver hợp lệ; cần kiểm tra cấu hình Workflow.")
        accepted = {str(item.actor_id) for item in history if item.level == current_order}
        mode = step["mode"]
        threshold = 1 if mode == "ANY_ONE" else step.get("minimum", 1) if mode == "MINIMUM" else len(ordered)
        if threshold > len(ordered):
            raise ValidationError("Số Approver hợp lệ không đủ mức tối thiểu.")
        if len(accepted) >= threshold:
            previous = accepted
            target = step.get("on_approve", "NEXT")
            if target == "COMPLETE":
                raise ValidationError("Workflow đã hoàn thành.")
            current_order = current_order + 1 if target == "NEXT" else target
            continue
        actor_id = str(actor.pk)
        from .requests import active_delegator_ids_for
        delegator_ids = [str(x) for x in active_delegator_ids_for(actor, obj.company, document_type)]
        effective_ids = [actor_id] + delegator_ids
        allowed_assigned = [uid for uid in ordered if uid in effective_ids]

        from .models import ApprovalRequest
        inbox = ApprovalRequest.objects.filter(source_model=obj._meta.label, source_id=obj.pk).order_by("-round_number").first() \
            if hasattr(obj, "_meta") else None

        inbox_task = inbox.tasks.filter(
            step_order=current_order, cycle=inbox.cycle, status="PENDING"
        ).filter(assignee_id__in=effective_ids).first() if inbox else None

        if not allowed_assigned and not inbox_task:
            raise PermissionDenied("User không phải Approver của bước hiện tại.")
        effective_approver_id = allowed_assigned[0] if allowed_assigned else (str(inbox_task.assignee_id) if inbox_task else actor_id)
        if effective_approver_id in accepted or actor_id in accepted:
            raise ValidationError("User đã phê duyệt bước này.")
        if mode == "SEQUENTIAL" and allowed_assigned and effective_approver_id != next((item for item in ordered if item not in accepted), None):
            raise PermissionDenied("Chưa đến lượt Approver này.")
        if inbox:
            if inbox.status not in ("PENDING_APPROVAL", "IN_PROGRESS") or not inbox_task:
                raise PermissionDenied("Approval Task không còn khả dụng.")
            from .requests import document_fingerprint
            if inbox.document_fingerprint != document_fingerprint(obj):
                raise ValidationError("Chứng từ đã thay đổi; cần gửi lại phê duyệt.")
        complete = approved and len(accepted) + 1 >= threshold
        final = complete and step.get("on_approve", "NEXT") == "COMPLETE"
        return {"level": current_order, "step_complete": complete, "final": final,
                "return_to_previous": not approved and step.get("on_reject") == "PREVIOUS"}
