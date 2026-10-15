from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from organization.models import CompanyStatus, OrganizationUnit, OrganizationUnitDependency, Position

from .models import CompanyMembership, OrganizationAssignment
from .permissions import assignment_permission_codes, effective_assignments, has_effective_permission, memberships_in_scope


PERMISSION = "SYS.ORG_ASSIGNMENT.MANAGE"


def snapshot(item):
    return {
        "membership": str(item.membership_id), "user": str(item.membership.user_id),
        "unit": str(item.unit_id),
        "assignment_type": item.assignment_type, "position": str(item.position_id) if item.position_id else None,
        "job_title": item.job_title, "start_date": item.start_date.isoformat(),
        "end_date": item.end_date.isoformat() if item.end_date else None,
        "status": item.status, "note": item.note,
    }


def _sync_dependency(item):
    OrganizationUnitDependency.objects.update_or_create(
        unit=item.unit, dependency_type="USER_ASSIGNMENT", reference=str(item.pk),
        defaults={"is_active": item.status in ("ACTIVE", "SCHEDULED")},
    )


def effective_status(item, today=None):
    today = today or timezone.localdate()
    if item.status == "REVOKED":
        return "REVOKED"
    if item.end_date and item.end_date < today:
        return "EXPIRED"
    if item.start_date > today:
        return "SCHEDULED"
    if item.membership.membership_status != "ACTIVE" or not item.membership.user.auth_user.is_active:
        return "REVOKED"
    return "ACTIVE"


@transaction.atomic
def refresh_membership(membership):
    today = timezone.localdate()
    items = list(OrganizationAssignment.objects.filter(membership=membership).select_related("membership__user__auth_user"))
    for item in items:
        state = effective_status(item, today)
        if item.status != state:
            before = snapshot(item)
            item.status = state
            item.save(update_fields=("status", "updated_at"))
            _sync_dependency(item)
            record_audit(company=membership.company, actor_user=item.updated_by or item.created_by,
                         module_code="SYS", action_code="ORG_ASSIGNMENT_STATUS", entity=item,
                         before=before, after=snapshot(item), reason="Automatic status synchronization")
    primary = next((item for item in items if item.assignment_type == "PRIMARY" and item.status == "ACTIVE"), None)
    unit_id = primary.unit_id if primary else None
    if any(item.assignment_type == "PRIMARY" for item in items) and membership.organization_unit_id != unit_id:
        membership.organization_unit_id = unit_id
        membership.save(update_fields=("organization_unit", "updated_at"))


def _authorize(actor, membership, unit=None):
    company = membership.company
    if company.status not in (CompanyStatus.ACTIVE, CompanyStatus.PENDING_SETUP):
        raise PermissionDenied("Doanh nghiệp không hoạt động.")
    if not CompanyMembership.objects.filter(company=company, user=actor, membership_status="ACTIVE").exists():
        raise PermissionDenied("Actor không còn Membership hợp lệ.")
    if not _has_management_grant(actor, company):
        raise PermissionDenied("Không có quyền quản lý phân công đơn vị.")
    if not memberships_in_scope(actor, company, PERMISSION).filter(pk=membership.pk).exists():
        raise PermissionDenied("User nằm ngoài phạm vi quản trị.")
    if unit:
        if unit.company_id != company.pk:
            raise ValidationError({"unit": "Đơn vị không thuộc doanh nghiệp."})
        if unit.status != "ACTIVE" or unit.end_date is not None and unit.end_date < timezone.localdate():
            raise ValidationError({"unit": "Đơn vị đã ngừng hoạt động."})
        # Scoped grants must also cover the selected unit; no grant is inferred from employment.
        if not _unit_in_scope(actor, company, unit):
            raise PermissionDenied("Đơn vị nằm ngoài phạm vi quản trị.")


def _unit_in_scope(actor, company, unit):
    from organization.models import Branch, Department
    if has_effective_permission(actor, company, PERMISSION):
        return True
    if unit.unit_type == "COMPANY":
        return has_effective_permission(actor, company, PERMISSION)
    if unit.unit_type == "BRANCH":
        branch = Branch.objects.filter(company=company, code=unit.code).first()
        return bool(branch and has_effective_permission(actor, company, PERMISSION, branch_id=branch.pk))
    if unit.unit_type == "DEPARTMENT":
        department = Department.objects.filter(company=company, code=unit.code).first()
        return bool(department and has_effective_permission(actor, company, PERMISSION,
                    branch_id=department.branch_id, department_id=department.pk))
    return has_effective_permission(actor, company, PERMISSION)


def _has_management_grant(actor, company):
    return any(PERMISSION in assignment_permission_codes(item) for item in effective_assignments(actor, company)) or has_effective_permission(actor, company, PERMISSION)


def _validate(membership, data, exclude=None):
    today = timezone.localdate()
    unit = OrganizationUnit.objects.filter(pk=data["unit"]).first()
    if not unit:
        raise ValidationError({"unit": "Đơn vị không tồn tại."})
    if unit.start_date > data["start_date"] or unit.end_date and unit.end_date < data["start_date"]:
        raise ValidationError({"start_date": "Đơn vị không có hiệu lực vào ngày bắt đầu."})
    end = data.get("end_date")
    if end and end < data["start_date"]:
        raise ValidationError({"end_date": "Ngày kết thúc phải từ ngày bắt đầu."})
    if unit.end_date and (end is None or end > unit.end_date):
        raise ValidationError({"end_date": "Phân công không thể kéo dài sau ngày ngừng đơn vị."})
    if data["assignment_type"] == "TEMPORARY" and not end:
        raise ValidationError({"end_date": "Phân công tạm thời cần ngày kết thúc."})
    if data.get("position"):
        position = Position.objects.filter(pk=data["position"], company=membership.company, status="ACTIVE").first()
        if not position:
            raise ValidationError({"position": "Chức vụ không hợp lệ."})
    else:
        position = None
    existing = OrganizationAssignment.objects.filter(membership=membership).exclude(status="REVOKED")
    if exclude:
        existing = existing.exclude(pk=exclude.pk)
    existing = existing.filter(start_date__lte=end) if end else existing
    existing = existing.filter(Q(end_date__isnull=True) | Q(end_date__gte=data["start_date"]))
    if existing.filter(unit=unit, assignment_type=data["assignment_type"]).exists():
        raise ValidationError({"unit": "Phân công trùng đơn vị, loại và thời gian."})
    return unit, position, existing


def _audit(item, actor, action, before, request):
    record_audit(company=item.membership.company, actor_user=actor, module_code="SYS",
                 action_code=action, entity=item, before=before, after=snapshot(item), request=request)


@transaction.atomic
def create_assignment(*, membership_id, actor, data, request):
    membership = CompanyMembership.objects.select_for_update().select_related("company", "user__auth_user").get(pk=membership_id)
    if membership.membership_status != "ACTIVE" or not membership.user.auth_user.is_active:
        raise ValidationError({"membership": "User chưa có Membership ACTIVE."})
    unit, position, overlapping = _validate(membership, data)
    _authorize(actor, membership, unit)
    primary = list(overlapping.filter(assignment_type="PRIMARY")) if data["assignment_type"] == "PRIMARY" else []
    if primary and not data.get("transfer"):
        raise ValidationError({"transfer": "Cần xác nhận chuyển đơn vị chính."})
    if primary and (len(primary) != 1 or primary[0].start_date >= data["start_date"]):
        raise ValidationError({"start_date": "Ngày chuyển phải sau ngày bắt đầu phân công chính cũ."})
    for old in primary:
        _authorize(actor, membership, old.unit)
        before = snapshot(old)
        old.end_date = data["start_date"] - timedelta(days=1)
        old.status = effective_status(old)
        old.updated_by = actor
        old.save(update_fields=("end_date", "status", "updated_by", "updated_at"))
        _sync_dependency(old)
        _audit(old, actor, "ORG_ASSIGNMENT_TRANSFER_OUT", before, request)
    item = OrganizationAssignment.objects.create(
        membership=membership, unit=unit, position=position, assignment_type=data["assignment_type"],
        job_title=data.get("job_title", ""), start_date=data["start_date"], end_date=data.get("end_date"),
        note=data.get("note", ""), status="SCHEDULED", created_by=actor,
    )
    item.status = effective_status(item)
    item.save(update_fields=("status", "updated_at"))
    _sync_dependency(item)
    refresh_membership(membership)
    _audit(item, actor, "ORG_ASSIGNMENT_CREATE", {}, request)
    return item


@transaction.atomic
def update_assignment(*, item_id, actor, data, request):
    item = OrganizationAssignment.objects.select_for_update().select_related("membership__company", "membership__user__auth_user", "unit").get(pk=item_id)
    membership = CompanyMembership.objects.select_for_update().get(pk=item.membership_id)
    _authorize(actor, item.membership, item.unit)
    if item.updated_at != data["version"]:
        raise ValidationError({"version": "Dữ liệu đã thay đổi; hãy tải lại."})
    if item.status == "REVOKED":
        raise ValidationError("Không thể sửa phân công đã kết thúc.")
    merged = {"unit": item.unit_id, "assignment_type": item.assignment_type,
              "position": item.position_id, "start_date": item.start_date, "end_date": item.end_date}
    merged.update({key: value for key, value in data.items() if key in merged})
    unit, position, overlaps = _validate(item.membership, merged, item)
    if item.assignment_type == "PRIMARY" and overlaps.filter(assignment_type="PRIMARY").exists():
        raise ValidationError({"start_date": "Khoảng phân công chính bị chồng lấn."})
    before = snapshot(item)
    for field in ("start_date", "end_date", "job_title", "note"):
        if field in data:
            setattr(item, field, data[field])
    if "position" in data:
        item.position = position
    item.status = effective_status(item)
    item.updated_by = actor
    item.save()
    _sync_dependency(item)
    refresh_membership(membership)
    _audit(item, actor, "ORG_ASSIGNMENT_UPDATE", before, request)
    return item


@transaction.atomic
def revoke_assignment(*, item_id, actor, version, reason, request):
    item = OrganizationAssignment.objects.select_for_update().select_related("membership__company", "membership__user__auth_user", "unit").get(pk=item_id)
    membership = CompanyMembership.objects.select_for_update().get(pk=item.membership_id)
    _authorize(actor, item.membership, item.unit)
    if item.updated_at != version:
        raise ValidationError({"version": "Dữ liệu đã thay đổi; hãy tải lại."})
    if item.status == "REVOKED":
        raise ValidationError("Phân công đã kết thúc.")
    before = snapshot(item)
    item.status = "REVOKED"
    item.note = f"{item.note}\nKết thúc: {reason}".strip()
    item.updated_by = actor
    item.save(update_fields=("status", "note", "updated_by", "updated_at"))
    _sync_dependency(item)
    refresh_membership(membership)
    _audit(item, actor, "ORG_ASSIGNMENT_REVOKE", before, request)
    return item
