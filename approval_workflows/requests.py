"""Approval inbox state derived from source-document decisions.

Source services remain the authority for accounting status and business checks.
This module records one request per submission and one task per eligible approver.
"""

from datetime import timedelta
import hashlib
import json

from django.apps import apps
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from master_data.models import DocumentType

from .models import ApprovalDelegation, ApprovalEvent, ApprovalNotification, ApprovalRequest, ApprovalTask
from .submission import document_context
from .validation import eligible_approvers, resolve_approver


DOCUMENT_MODELS = {
    "purchases": {"REQUEST": "PurchaseRequest", "ORDER": "PurchaseOrder", "CONTRACT": "PurchaseContract", "GOODS": "GoodsPurchase", "SERVICE": "GoodsPurchase", "RETURN": "PurchaseReturn", "DISCOUNT": "PurchaseDiscount"},
    "accounts_payable": {"INVOICE": "SupplierInvoice", "PAYMENT_REQUEST": "PaymentRequest"},
    "sales": {"QUOTATION": "SalesQuotation", "ORDER": "SalesOrder", "CONTRACT": "SalesContract"},
}


def source_for_decision(decision):
    label = decision._meta.app_label
    if label == "accounts_receivable" and decision._meta.model_name == "customerreceiptapproval":
        return decision.voucher
    if label in DOCUMENT_MODELS:
        name = DOCUMENT_MODELS[label].get(decision.document_type)
        return apps.get_model(label, name).objects.filter(pk=decision.document_id).first() if name else None
    relation = "entry" if label == "general_ledger" else "document" if label == "accounts_receivable" else "transaction"
    return getattr(decision, relation, None)


def source_for_request(item):
    try:
        return apps.get_model(item.source_model).objects.filter(pk=item.source_id, company=item.company).first()
    except LookupError:
        return None


def document_fingerprint(source):
    excluded = {"status", "workflow_snapshot", "submitted_at", "approved_at", "approved_by",
                "posted_at", "posted_by", "updated_at", "created_at", "gl_status", "gl_reference"}
    values = {field.attname: getattr(source, field.attname) for field in source._meta.concrete_fields
              if field.name not in excluded}
    if hasattr(source, "lines"):
        values["lines"] = [{field.attname: getattr(line, field.attname)
                            for field in line._meta.concrete_fields if field.name not in excluded}
                           for line in source.lines.all().order_by("pk")]
    raw = json.dumps(values, sort_keys=True, default=str, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _notify(item, recipient_id, event):
    ApprovalNotification.objects.create(request=item, recipient_id=recipient_id, event=event)


def _event(item, task, actor, action, comment="", metadata=None, delegated_from=None):
    ApprovalEvent.objects.create(request=item, task=task, actor=actor, delegated_from=delegated_from,
                                 action=action, comment=comment, metadata=metadata or {})
    audit_after = {"step": item.current_step, "task": str(task.pk) if task else None,
                   "status": item.status, "comment": comment, **(metadata or {})}
    if delegated_from:
        audit_after["delegated_from"] = str(delegated_from.pk if hasattr(delegated_from, "pk") else delegated_from)
    record_audit(company=item.company, actor_user=actor, module_code="SYS", action_code=f"APPROVAL_{action}",
                 entity=item, after=audit_after)


def active_delegation(company, delegator, delegate, document_type=None, at_date=None):
    if at_date is None:
        at_date = timezone.localdate()
    query = ApprovalDelegation.objects.filter(
        company=company,
        delegator=delegator,
        delegate=delegate,
        is_active=True,
        start_date__lte=at_date,
    ).filter(Q(end_date__isnull=True) | Q(end_date__gte=at_date))
    if document_type:
        query = query.filter(Q(document_type__isnull=True) | Q(document_type=document_type))
    return query.first()


def active_delegator_ids_for(user, company=None, document_type=None, at_date=None):
    if at_date is None:
        at_date = timezone.localdate()
    query = ApprovalDelegation.objects.filter(
        delegate=user,
        is_active=True,
        start_date__lte=at_date,
    ).filter(Q(end_date__isnull=True) | Q(end_date__gte=at_date))
    if company:
        query = query.filter(company=company)
    if document_type:
        query = query.filter(Q(document_type__isnull=True) | Q(document_type=document_type))
    return list(query.values_list("delegator_id", flat=True))


def _assign_step(item, source, step_order, *, previous=None):
    steps = item.snapshot["steps"]
    while step_order <= len(steps):
        step = steps[step_order - 1]
        context = document_context(source)
        if step.get("auto_skip"):
            _event(item, None, item.submitted_by, "SKIPPED",
                   comment="Bước được tự động bỏ qua theo cấu hình",
                   metadata={"step": step_order})
            target = step.get("on_approve", "NEXT")
            if target == "COMPLETE":
                item.status = "APPROVED"
                item.completed_at = timezone.now()
                item.save(update_fields=("status", "completed_at", "updated_at"))
                _notify(item, item.submitted_by_id, "APPROVED")
                return
            step_order = step_order + 1 if target == "NEXT" else target
            continue

        ordered = []
        for rule in step.get("approvers", []):
            for user_id in sorted(resolve_approver(rule, item.company, context, previous)):
                if user_id not in ordered:
                    ordered.append(user_id)
        allowed = eligible_approvers(ordered, item.company, item.document_type, context)
        ordered = [user_id for user_id in ordered if user_id in allowed]
        if not ordered and step.get("fallback"):
            ordered = sorted(eligible_approvers(resolve_approver(step["fallback"], item.company, context),
                                                item.company, item.document_type, context))
            if ordered:
                _event(item, None, item.submitted_by, "FALLBACK", metadata={"step": step_order})
        if not ordered:
            item.status = "CONFIGURATION_ERROR"
            item.current_step = step_order
            item.save(update_fields=("status", "current_step", "updated_at"))
            _notify(item, item.submitted_by_id, "CONFIGURATION_ERROR")
            return
        item.current_step = step_order
        item.status = "PENDING_APPROVAL" if step_order == 1 and item.cycle == 1 else "IN_PROGRESS"
        item.save(update_fields=("current_step", "status", "updated_at"))
        deadline = step.get("deadline_hours")
        due_at = timezone.now() + timedelta(hours=deadline) if deadline else None
        for user_id in ordered:
            ApprovalTask.objects.create(request=item, step_order=step_order, cycle=item.cycle,
                                        assignee_id=user_id, due_at=due_at)
            _notify(item, user_id, "TASK_ASSIGNED")
        return


@transaction.atomic
def forward_task(task_id, actor, target_user_id, comment="", *, reason=""):
    from iam.models import CompanyMembership, UserAccount
    from iam.permissions import has_effective_permission

    task = ApprovalTask.objects.select_for_update().select_related("request__company", "request__document_type").get(pk=task_id)
    item = task.request
    source = source_for_request(item)
    if source is None:
        raise ValidationError("Chứng từ nguồn không còn khả dụng.")
    source = type(source).objects.select_for_update().get(pk=source.pk)

    delegated_from = None
    if task.assignee_id != actor.pk:
        delegation = active_delegation(item.company, task.assignee, actor, item.document_type)
        if not delegation:
            raise PermissionDenied("Không có quyền chuyển xử lý Approval Task này.")
        delegated_from = task.assignee

    step = item.snapshot["steps"][task.step_order - 1]
    if step.get("allow_forward") is False:
        raise ValidationError("Bước này không cho phép chuyển xử lý.")

    if task.status != "PENDING" or item.status not in ("PENDING_APPROVAL", "IN_PROGRESS"):
        raise ValidationError("Task không còn chờ xử lý.")

    target_user = UserAccount.objects.filter(pk=target_user_id).first()
    if not target_user:
        raise ValidationError("Người nhận chuyển xử lý không tồn tại.")
    if target_user.pk == task.assignee_id:
        raise ValidationError("Không thể chuyển xử lý cho chính người đang được giao.")
    if not CompanyMembership.objects.filter(company=item.company, user=target_user, membership_status="ACTIVE", user__auth_user__is_active=True).exists():
        raise ValidationError("Người nhận chuyển xử lý không có Membership hợp lệ.")

    context = document_context(source)
    if not has_effective_permission(target_user, item.company, f"{item.document_type.code}.APPROVE",
                                    branch_id=context.get("branch_id"), department_id=context.get("department_id")):
        raise ValidationError("Người nhận không có Permission hoặc Data Scope phê duyệt.")

    if source.created_by_id == target_user.pk and not item.snapshot.get("allow_self_approval", False):
        raise ValidationError("Người tạo chứng từ không được chỉ định phê duyệt.")

    task.status = "FORWARDED"
    task.forwarded_to = target_user
    task.completed_at = timezone.now()
    task.version += 1
    task.save(update_fields=("status", "forwarded_to", "completed_at", "version"))

    new_task = ApprovalTask.objects.create(
        request=item, step_order=task.step_order, cycle=task.cycle,
        assignee=target_user, due_at=task.due_at, version=1
    )

    forward_comment = comment or reason or f"Chuyển xử lý cho {getattr(target_user, 'display_name', str(target_user.pk))}"
    _event(item, task, actor, "FORWARD", forward_comment,
           {"from_user": str(task.assignee_id), "to_user": str(target_user.pk), "step": task.step_order},
           delegated_from=delegated_from)
    _notify(item, target_user.pk, "TASK_ASSIGNED")
    return new_task


@transaction.atomic
def sync_source_decision(decision):
    source = source_for_decision(decision)
    if source is None:
        return
    snapshot = source.workflow_snapshot or {}
    if not snapshot.get("version_id"):
        return
    label = source._meta.label
    if decision.decision == "SUBMITTED":
        previous = ApprovalRequest.objects.select_for_update().filter(source_model=label, source_id=source.pk).order_by("-round_number").first()
        if previous and previous.status in ("PENDING_APPROVAL", "IN_PROGRESS", "CONFIGURATION_ERROR"):
            previous.status = "CANCELLED"
            previous.completed_at = timezone.now()
            previous.save(update_fields=("status", "completed_at", "updated_at"))
            previous.tasks.filter(status="PENDING").update(status="CANCELLED", completed_at=timezone.now())
        item = ApprovalRequest.objects.create(
            company=source.company, document_type=DocumentType.objects.get(code=snapshot["document_type_code"]),
            source_model=label, source_id=source.pk, round_number=previous.round_number + 1 if previous else 1,
            workflow_version_id=snapshot["version_id"], snapshot=snapshot, submitted_by=decision.actor,
            document_fingerprint=document_fingerprint(source),
        )
        _event(item, None, decision.actor, "SUBMITTED")
        _assign_step(item, source, int(snapshot.get("resume_step", 1)))
        return
    item = ApprovalRequest.objects.select_for_update().filter(source_model=label, source_id=source.pk).order_by("-round_number").first()
    if not item or item.status not in ("PENDING_APPROVAL", "IN_PROGRESS"):
        return
    delegator_ids = active_delegator_ids_for(decision.actor, item.company, item.document_type)
    task = item.tasks.select_for_update().filter(
        step_order=decision.level, cycle=item.cycle, status="PENDING"
    ).filter(Q(assignee=decision.actor) | Q(assignee_id__in=delegator_ids)).first()
    if not task:
        raise PermissionDenied("Approval Task không còn khả dụng.")
    delegated_from = task.assignee if task.assignee_id != decision.actor.pk else None
    if decision.decision == "REVISION_REQUIRED":
        task.status = "CHANGES_REQUESTED"
        task.version += 1
        task.completed_at = timezone.now()
        if delegated_from:
            task.delegated_from = delegated_from
        task.save(update_fields=("status", "version", "completed_at", "delegated_from"))
        step = item.snapshot["steps"][decision.level - 1]
        item.status = "CHANGES_REQUESTED"
        item.completed_at = timezone.now()
        item.snapshot = {**item.snapshot, "resume_step": max(1, task.step_order - 1)
                         if step.get("on_changes") == "PREVIOUS" else 1}
        item.save(update_fields=("status", "completed_at", "snapshot", "updated_at"))
        _event(item, task, decision.actor, "REQUEST_CHANGES", decision.comment,
               {"source_decision": str(decision.pk), "step": decision.level,
                "changes": decision.comment,
                "delegated_from": str(delegated_from.pk) if delegated_from else None},
               delegated_from=delegated_from)
        _notify(item, item.submitted_by_id, "CHANGES_REQUESTED")
        return
    task.status = "APPROVED" if decision.decision == "APPROVED" else "REJECTED"
    task.version += 1
    task.completed_at = timezone.now()
    if delegated_from:
        task.delegated_from = delegated_from
    task.save(update_fields=("status", "version", "completed_at", "delegated_from"))
    action = "APPROVE" if decision.decision == "APPROVED" else "REJECT"
    _event(item, task, decision.actor, action, decision.comment,
           {"source_decision": str(decision.pk), "step": decision.level,
            "delegated_from": str(delegated_from.pk) if delegated_from else None},
           delegated_from=delegated_from)
    step = item.snapshot["steps"][decision.level - 1]
    if decision.decision == "REJECTED":
        item.tasks.filter(cycle=item.cycle, status="PENDING").update(status="CANCELLED", completed_at=timezone.now())
        if step.get("on_reject") == "PREVIOUS":
            item.cycle += 1
            item.save(update_fields=("cycle", "updated_at"))
            _assign_step(item, source, max(1, decision.level - 1))
        else:
            item.status = "REJECTED"
            item.completed_at = timezone.now()
            item.save(update_fields=("status", "completed_at", "updated_at"))
            _notify(item, item.submitted_by_id, "REJECTED")
        return
    assigned = item.tasks.filter(step_order=decision.level, cycle=item.cycle)
    approved_count = assigned.filter(status="APPROVED").count()
    mode = step["mode"]
    threshold = 1 if mode == "ANY_ONE" else step.get("minimum", 1) if mode == "MINIMUM" else assigned.count()
    if approved_count < threshold:
        item.status = "IN_PROGRESS"
        item.save(update_fields=("status", "updated_at"))
        return
    assigned.filter(status="PENDING").update(status="SKIPPED", completed_at=timezone.now())
    target = step.get("on_approve", "NEXT")
    if target == "COMPLETE":
        item.status = "APPROVED"
        item.completed_at = timezone.now()
        item.save(update_fields=("status", "completed_at", "updated_at"))
        _notify(item, item.submitted_by_id, "APPROVED")
    else:
        next_step = decision.level + 1 if target == "NEXT" else target
        previous = set(str(pk) for pk in assigned.filter(status="APPROVED").values_list("assignee_id", flat=True))
        item.cycle += 1
        item.save(update_fields=("cycle", "updated_at"))
        _assign_step(item, source, next_step, previous=previous)
