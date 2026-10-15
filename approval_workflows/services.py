from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from iam.models import CompanyMembership
from iam.permissions import has_effective_permission
from master_data.models import DocumentType
from organization.models import OrganizationUnit, OrganizationUnitDependency

from .models import ApprovalPolicy, DocumentApprovalPolicy, Workflow, WorkflowVersion
from .validation import allowed_fields, condition_signature, condition_specificity, eligible_approvers, matches_conditions, resolve_approver, validate_conditions, validate_steps


PERMISSION = "SYS.WORKFLOW.CONFIGURE"


class WorkflowConflict(ValidationError):
    status_code = 409
    default_detail = "Workflow đã được cập nhật. Hãy tải lại phiên bản mới."


def authorize(actor, company):
    if company.status not in ("ACTIVE", "PENDING_SETUP"):
        raise PermissionDenied("Doanh nghiệp không hoạt động.")
    if not CompanyMembership.objects.filter(company=company, user=actor, membership_status="ACTIVE").exists():
        raise PermissionDenied("Actor không có Membership ACTIVE.")
    if not has_effective_permission(actor, company, PERMISSION):
        raise PermissionDenied("Không có Permission cấu hình Workflow.")


def require_document_type(document_type_id):
    item = DocumentType.objects.filter(pk=document_type_id, status="ACTIVE", supports_workflow=True).first()
    if not item:
        raise ValidationError({"document_type": "Loại chứng từ không hỗ trợ Workflow hoặc đã ngừng."})
    return item


def snapshot(version):
    return {"workflow": str(version.workflow_id), "code": version.workflow.code,
            "name": version.name, "description": version.description, "priority": version.priority,
            "document_type": str(version.workflow.document_type_id), "number": version.number,
            "status": version.status, "effective_from": version.effective_from.isoformat(),
            "effective_to": version.effective_to.isoformat() if version.effective_to else None,
            "conditions": version.conditions, "steps": version.steps,
            "allow_self_approval": version.allow_self_approval}


def audit(version, actor, action, before, request=None):
    record_audit(company=version.workflow.company, actor_user=actor, module_code="SYS",
                 action_code=f"WORKFLOW_{action}", entity=version,
                 before=before, after=snapshot(version), request=request)


def sync_unit_dependencies(version):
    active = version.status in ("ACTIVE", "SCHEDULED")
    OrganizationUnitDependency.objects.filter(dependency_type="WORKFLOW", reference=str(version.pk)).update(is_active=False)
    if not active:
        return
    unit_ids = {
        rule["id"] for step in version.steps if isinstance(step, dict)
        for rule in step.get("approvers", []) + ([step["fallback"]] if isinstance(step.get("fallback"), dict) else [])
        if isinstance(rule, dict) and rule.get("type") == "UNIT_MANAGER" and rule.get("id")
    }
    for unit in OrganizationUnit.objects.filter(pk__in=unit_ids, company=version.workflow.company):
        OrganizationUnitDependency.objects.update_or_create(
            unit=unit, dependency_type="WORKFLOW", reference=str(version.pk),
            defaults={"is_active": True},
        )


@transaction.atomic
def set_policy(*, company, document_type_id, policy, actor, request=None):
    authorize(actor, company)
    document_type = require_document_type(document_type_id)
    item = DocumentApprovalPolicy.objects.select_for_update().filter(company=company, document_type=document_type).first()
    before = {"policy": item.policy} if item else {}
    if item:
        item.policy = policy
        item.updated_by = actor
        item.save(update_fields=("policy", "updated_by", "updated_at"))
    else:
        item = DocumentApprovalPolicy.objects.create(company=company, document_type=document_type,
                                                     policy=policy, updated_by=actor)
    record_audit(company=company, actor_user=actor, module_code="SYS", action_code="WORKFLOW_POLICY",
                 entity=item, before=before, after={"document_type": document_type.code, "policy": policy}, request=request)
    return item


@transaction.atomic
def create_workflow(*, company, actor, data, request=None):
    authorize(actor, company)
    document_type = require_document_type(data["document_type"])
    condition_errors = validate_conditions(data.get("conditions", {}), allowed=allowed_fields(document_type))
    if condition_errors:
        raise ValidationError({"conditions": condition_errors})
    if data.get("effective_to") and data["effective_to"] < data["effective_from"]:
        raise ValidationError({"effective_to": "Ngày kết thúc trước ngày bắt đầu."})
    code = data["code"].strip().upper()
    if Workflow.objects.filter(company=company, code=code).exists():
        raise ValidationError({"code": "Mã Workflow đã tồn tại."})
    workflow = Workflow.objects.create(company=company, document_type=document_type, code=code,
                                       name=data["name"].strip(), description=data.get("description", ""),
                                       priority=data.get("priority", 0), created_by=actor)
    version = WorkflowVersion.objects.create(workflow=workflow, number=1, created_by=actor,
        name=data["name"].strip(), description=data.get("description", ""), priority=data.get("priority", 0),
        effective_from=data["effective_from"], effective_to=data.get("effective_to"),
        conditions=data.get("conditions", {}), steps=data.get("steps", []),
        allow_self_approval=data.get("allow_self_approval", False))
    audit(version, actor, "CREATE_DRAFT", {}, request)
    return workflow, version


@transaction.atomic
def update_draft(*, version_id, actor, data, request=None):
    version = WorkflowVersion.objects.select_for_update().select_related("workflow__company").get(pk=version_id)
    authorize(actor, version.workflow.company)
    if version.status != "DRAFT":
        raise ValidationError("Chỉ bản DRAFT được chỉnh sửa.")
    if version.updated_at != data["version"]:
        raise WorkflowConflict()
    before = snapshot(version)
    for field in ("conditions", "steps", "effective_from", "effective_to", "allow_self_approval", "priority", "name", "description"):
        if field in data:
            setattr(version, field, data[field])
    if version.effective_to and version.effective_to < version.effective_from:
        raise ValidationError({"effective_to": "Ngày kết thúc trước ngày bắt đầu."})
    condition_errors = validate_conditions(version.conditions, allowed=allowed_fields(version.workflow.document_type))
    if condition_errors:
        raise ValidationError({"conditions": condition_errors})
    version.save()
    audit(version, actor, "UPDATE_DRAFT", before, request)
    return version


@transaction.atomic
def new_version(*, workflow, actor, request=None):
    workflow = Workflow.objects.select_for_update().select_related("company").get(pk=workflow.pk)
    authorize(actor, workflow.company)
    if workflow.versions.filter(status="DRAFT").exists():
        raise ValidationError("Workflow đã có một bản DRAFT.")
    source = workflow.versions.order_by("-number").first()
    if source is None:
        raise ValidationError("Workflow không có phiên bản nguồn.")
    version = WorkflowVersion.objects.create(
        workflow=workflow, number=source.number + 1, status="DRAFT",
        name=source.name, description=source.description, priority=source.priority,
        effective_from=timezone.localdate(), conditions=source.conditions, steps=source.steps,
        allow_self_approval=source.allow_self_approval, created_by=actor,
    )
    audit(version, actor, "NEW_VERSION", {}, request)
    return version


@transaction.atomic
def clone_workflow(*, source, actor, code, name, request=None):
    source = Workflow.objects.select_related("company", "document_type").get(pk=source.pk)
    authorize(actor, source.company)
    latest = source.versions.order_by("-number").first()
    if not latest:
        raise ValidationError("Workflow nguồn không có phiên bản.")
    workflow, version = create_workflow(company=source.company, actor=actor, request=request, data={
        "document_type": source.document_type_id, "code": code, "name": name,
        "description": latest.description, "priority": latest.priority,
        "effective_from": timezone.localdate(), "conditions": latest.conditions,
        "steps": latest.steps, "allow_self_approval": latest.allow_self_approval,
    })
    record_audit(company=source.company, actor_user=actor, module_code="SYS",
                 action_code="WORKFLOW_CLONE", entity=version,
                 before={"source_workflow": str(source.pk), "source_version": str(latest.pk)},
                 after=snapshot(version), request=request)
    return workflow, version


def check_version(version, samples=None):
    errors = validate_conditions(version.conditions, allowed=allowed_fields(version.workflow.document_type))
    step_errors, step_warnings = validate_steps(version.steps, version.workflow.company)
    warnings = list(step_warnings)
    policy = DocumentApprovalPolicy.objects.filter(company=version.workflow.company,
                                                   document_type=version.workflow.document_type).first()
    if not policy:
        errors.append("Loại chứng từ chưa có Approval Policy.")
    elif policy.policy == ApprovalPolicy.NOT_REQUIRED and version.steps:
        warnings.append("Policy NOT_REQUIRED sẽ không tạo yêu cầu phê duyệt.")
    elif policy.policy != ApprovalPolicy.NOT_REQUIRED:
        errors += step_errors
        for index, step in enumerate(version.steps):
            if not isinstance(step, dict):
                continue
            candidates = set().union(*(resolve_approver(rule, version.workflow.company)
                                       for rule in step.get("approvers", []) if isinstance(rule, dict)))
            if isinstance(step.get("fallback"), dict):
                candidates |= resolve_approver({key: value for key, value in step["fallback"].items()
                    if key not in ("valid_from", "valid_to", "scope")}, version.workflow.company)
            dynamic = any(isinstance(rule, dict) and rule.get("type") in
                          ("UNIT_MANAGER", "DOCUMENT_FIELD", "PREVIOUS_STEP_RESULT", "DYNAMIC_RULE")
                          for rule in step.get("approvers", []))
            if candidates and not eligible_approvers(candidates, version.workflow.company,
                                                     version.workflow.document_type) and not dynamic:
                errors.append(f"steps[{index}]: Approver không có Permission phê duyệt chứng từ.")
    if version.effective_to and version.effective_to < version.effective_from:
        errors.append("Khoảng hiệu lực không hợp lệ.")
    conflicts = WorkflowVersion.objects.filter(
        workflow__company=version.workflow.company,
        workflow__document_type=version.workflow.document_type,
        priority=version.priority,
        status__in=("ACTIVE", "SCHEDULED"),
    ).exclude(workflow=version.workflow)
    if version.effective_to:
        conflicts = conflicts.filter(effective_from__lte=version.effective_to)
    conflicts = conflicts.filter(Q(effective_to__isnull=True) | Q(effective_to__gte=version.effective_from))
    if not errors and any(condition_signature(item.conditions) == condition_signature(version.conditions) for item in conflicts):
        errors.append("Workflow khác có cùng điều kiện, Priority và thời gian hiệu lực.")
    simulations = []
    for sample in (samples or [])[:20]:
        if not isinstance(sample, dict):
            errors.append("Mẫu mô phỏng phải là object.")
            break
        matched = matches_conditions(version.conditions, sample) if not errors else False
        first = version.steps[0] if matched and version.steps else {}
        approvers = sorted(eligible_approvers(set().union(*(resolve_approver(rule, version.workflow.company, sample)
                    for rule in first.get("approvers", []))), version.workflow.company,
                    version.workflow.document_type, sample)) if first else []
        reference_date = max(timezone.localdate(), version.effective_from)
        alternatives = WorkflowVersion.objects.filter(
            workflow__company=version.workflow.company,
            workflow__document_type=version.workflow.document_type,
            status__in=("ACTIVE", "SCHEDULED"), effective_from__lte=reference_date,
        ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=reference_date)).exclude(pk=version.pk)
        candidates = [item for item in alternatives if not errors and matches_conditions(item.conditions, sample)]
        if matched:
            candidates.append(version)
        candidates.sort(key=lambda item: (-item.priority, -condition_specificity(item.conditions), -item.number, str(item.pk)))
        simulations.append({"matched": matched, "first_step_approvers": approvers,
                            "would_select_version": str(candidates[0].pk) if candidates else None})
    return {"errors": errors, "warnings": warnings, "simulations": simulations}


@transaction.atomic
def activate(*, version_id, actor, version_token, request=None):
    version = WorkflowVersion.objects.select_for_update().select_related("workflow__company", "workflow__document_type").get(pk=version_id)
    authorize(actor, version.workflow.company)
    if version.status != "DRAFT":
        raise ValidationError("Chỉ bản DRAFT được kích hoạt.")
    if version.updated_at != version_token:
        raise WorkflowConflict()
    result = check_version(version)
    if result["errors"]:
        raise ValidationError(result)
    old = version.workflow.versions.select_for_update().filter(status__in=("ACTIVE", "SCHEDULED")).exclude(pk=version.pk)
    for item in old:
        if version.effective_from <= item.effective_from:
            raise ValidationError({"effective_from": "Phiên bản mới phải bắt đầu sau phiên bản đang áp dụng."})
    before = snapshot(version)
    version.status = "SCHEDULED" if version.effective_from > timezone.localdate() else "ACTIVE"
    version.activated_by = actor
    version.activated_at = timezone.now()
    version.save(update_fields=("status", "activated_by", "activated_at", "updated_at"))
    sync_unit_dependencies(version)
    if version.status == "ACTIVE":
        for item in old:
            previous = snapshot(item)
            item.status = "INACTIVE"
            item.effective_to = version.effective_from - timedelta(days=1)
            item.save(update_fields=("status", "effective_to", "updated_at"))
            sync_unit_dependencies(item)
            audit(item, actor, "REPLACE", previous, request)
    audit(version, actor, "ACTIVATE", before, request)
    return version


@transaction.atomic
def stop(*, version_id, actor, version_token, request=None):
    version = WorkflowVersion.objects.select_for_update().select_related("workflow__company").get(pk=version_id)
    authorize(actor, version.workflow.company)
    if version.updated_at != version_token:
        raise WorkflowConflict()
    if version.status not in ("ACTIVE", "SCHEDULED"):
        raise ValidationError("Workflow không đang áp dụng.")
    before = snapshot(version)
    version.status = "INACTIVE"
    version.save(update_fields=("status", "updated_at"))
    sync_unit_dependencies(version)
    audit(version, actor, "STOP", before, request)
    return version


@transaction.atomic
def archive(*, version_id, actor, version_token, request=None):
    version = WorkflowVersion.objects.select_for_update().select_related("workflow__company").get(pk=version_id)
    authorize(actor, version.workflow.company)
    if version.updated_at != version_token:
        raise WorkflowConflict()
    if version.status != "INACTIVE":
        raise ValidationError("Chỉ phiên bản INACTIVE được lưu trữ.")
    before = snapshot(version)
    version.status = "ARCHIVED"
    version.save(update_fields=("status", "updated_at"))
    sync_unit_dependencies(version)
    audit(version, actor, "ARCHIVE", before, request)
    return version


@transaction.atomic
def synchronize(company=None):
    today = timezone.localdate()
    due = WorkflowVersion.objects.select_for_update().select_related("workflow__company").filter(
        status="SCHEDULED", effective_from__lte=today)
    if company:
        due = due.filter(workflow__company=company)
    for version in due:
        old = version.workflow.versions.select_for_update().filter(status="ACTIVE").exclude(pk=version.pk)
        for item in old:
            before = snapshot(item)
            item.status = "INACTIVE"
            item.effective_to = version.effective_from - timedelta(days=1)
            item.save(update_fields=("status", "effective_to", "updated_at"))
            sync_unit_dependencies(item)
            audit(item, version.activated_by, "REPLACE", before)
        before = snapshot(version)
        version.status = "ACTIVE"
        version.save(update_fields=("status", "updated_at"))
        sync_unit_dependencies(version)
        audit(version, version.activated_by, "DUE", before)
    expired = WorkflowVersion.objects.filter(status="ACTIVE", effective_to__lt=today)
    if company:
        expired = expired.filter(workflow__company=company)
    for version in expired.select_related("workflow__company", "activated_by"):
        before = snapshot(version)
        version.status = "INACTIVE"
        version.save(update_fields=("status", "updated_at"))
        sync_unit_dependencies(version)
        audit(version, version.activated_by, "EXPIRE", before)


def choose_workflow(*, company, document_type, context):
    synchronize(company)
    today = timezone.localdate()
    candidates = WorkflowVersion.objects.filter(
        workflow__company=company, workflow__document_type=document_type,
        status="ACTIVE", effective_from__lte=today,
    ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today)).select_related("workflow")
    matched = [item for item in candidates if matches_conditions(item.conditions, context)]
    matched.sort(key=lambda item: (-item.priority, -condition_specificity(item.conditions), -item.number, str(item.pk)))
    return matched[0] if matched else None


def preview_selection(*, company, document_type, context):
    policy = DocumentApprovalPolicy.objects.filter(company=company, document_type=document_type).first()
    if not policy:
        return {"policy": None, "workflow": None}
    if policy.policy == "NOT_REQUIRED":
        return {"policy": policy.policy, "workflow": None}
    selected = choose_workflow(company=company, document_type=document_type, context=context)
    if policy.policy == "REQUIRED" and selected is None:
        raise ValidationError("Chứng từ bắt buộc phê duyệt nhưng không có Workflow phù hợp.")
    return {"policy": policy.policy, "workflow": selected}
