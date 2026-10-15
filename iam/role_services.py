import re

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from common_services.models import WorkItem
from organization.models import Company

from .models import (
    ActiveStatus, CompanyMembership, Permission, Role, RolePermission, RoleStatus,
    RoleType, UserRoleAssignment,
)
from .permissions import (
    assignment_permission_codes, effective_assignments, has_effective_permission,
)


class RoleVersionConflict(ValidationError):
    status_code = 409
    default_detail = "Role đã được cập nhật. Vui lòng tải lại dữ liệu."


def require_role_actor(*, company, actor, permission_code, is_platform_admin=False):
    current_company = Company.objects.select_for_update().get(pk=company.pk)
    if current_company.status != "ACTIVE":
        raise ValidationError("Doanh nghiệp không hoạt động.")
    if not CompanyMembership.objects.filter(
        company=company, user=actor, membership_status=ActiveStatus.ACTIVE,
    ).exists():
        raise PermissionDenied("Người xử lý không còn Membership ACTIVE.")
    if not is_platform_admin and not has_effective_permission(actor, company, permission_code):
        raise PermissionDenied("Không có quyền quản lý Role.")


def _role_code(value, company, *, current=None):
    code = value.strip().upper()
    if not re.fullmatch(r"[A-Z][A-Z0-9_]{1,79}", code):
        raise ValidationError({"code": "Mã Role phải gồm chữ in hoa, số hoặc dấu gạch dưới."})
    if code in {"ADMIN", "COMPANY_ADMIN", "SYSTEM_ADMIN"} or code.startswith(("SYS_", "SYSTEM_", "PLATFORM_")):
        raise ValidationError({"code": "Mã Role dành riêng cho hệ thống."})
    existing = Role.objects.filter(company=company, code__iexact=code)
    if current:
        existing = existing.exclude(pk=current.pk)
    if existing.exists():
        raise ValidationError({"code": "Mã Role đã được sử dụng."})
    return code


def _role_name(value, company, *, current=None):
    name = value.strip()
    if not name:
        raise ValidationError({"name": "Cần nhập tên Role."})
    existing = Role.objects.filter(company=company, name__iexact=name)
    if current:
        existing = existing.exclude(pk=current.pk)
    if existing.exists():
        raise ValidationError({"name": "Tên Role đã được sử dụng."})
    return name


def _permission_codes(role):
    codes = set(role.role_permissions.filter(
        effect="ALLOW", permission__status=ActiveStatus.ACTIVE,
        permission__resource__status=ActiveStatus.ACTIVE,
    ).values_list("permission__code", flat=True))
    for item in role.role_bundles.filter(bundle__status=ActiveStatus.ACTIVE):
        codes.update(item.bundle.permissionbundleitem_set.filter(
            permission__status=ActiveStatus.ACTIVE,
            permission__resource__status=ActiveStatus.ACTIVE,
        ).values_list("permission__code", flat=True))
    return codes


def _audit(role, actor, action, before, after, request):
    record_audit(
        company=role.company, actor_user=actor, module_code="SYS", action_code=action,
        entity=role, before=before, after=after, request=request,
    )


@transaction.atomic
def create_role(*, company, actor, data, request=None, is_platform_admin=False):
    require_role_actor(company=company, actor=actor, permission_code="SYS.ROLE.CREATE", is_platform_admin=is_platform_admin)
    role = Role(
        company=company, code=_role_code(data["code"], company),
        name=_role_name(data["name"], company), description=data.get("description", "").strip(),
        role_type=RoleType.CUSTOM, status=RoleStatus.ACTIVE,
        created_by=actor, updated_by=actor,
    )
    role.full_clean()
    role.save()
    _audit(role, actor, "ROLE_CREATE", {}, {
        "code": role.code, "name": role.name, "description": role.description,
        "status": role.status, "role_type": role.role_type,
    }, request)
    return role


@transaction.atomic
def clone_role(*, source_id, company, actor, data, request=None, is_platform_admin=False):
    require_role_actor(company=company, actor=actor, permission_code="SYS.ROLE.CLONE", is_platform_admin=is_platform_admin)
    source = Role.objects.select_for_update().get(pk=source_id, company=company)
    if source.status != RoleStatus.ACTIVE:
        raise ValidationError("Role nguồn không còn hoạt động.")
    if source.updated_at != data["version"]:
        raise RoleVersionConflict()
    permission_codes = _permission_codes(source)
    if not is_platform_admin:
        actor_assignments = list(effective_assignments(actor, company))
        granted = set().union(*(
            assignment_permission_codes(a) for a in actor_assignments
            if a.data_scope_set_id is None or a.data_scope_set.allow_all_company_data
        ))
        if not permission_codes <= granted:
            raise PermissionDenied("Role nguồn có Permission vượt quá phạm vi của người sao chép.")
        if source.is_system_admin and not any(a.role.is_system_admin for a in actor_assignments):
            raise PermissionDenied("Không được sao chép Role quản trị hệ thống.")
    role = Role(
        company=company, code=_role_code(data["code"], company),
        name=_role_name(data["name"], company),
        description=data.get("description", source.description).strip(),
        role_type=RoleType.CUSTOM, status=RoleStatus.ACTIVE,
        source_role=source, created_by=actor, updated_by=actor,
    )
    role.full_clean()
    role.save()
    permissions = list(Permission.objects.filter(code__in=permission_codes))
    RolePermission.objects.bulk_create([
        RolePermission(role=role, permission=permission, effect="ALLOW") for permission in permissions
    ])
    _audit(role, actor, "ROLE_CLONE", {}, {
        "source_role_id": str(source.pk), "code": role.code, "name": role.name,
        "description": role.description, "permission_codes": sorted(permission_codes),
    }, request)
    return role


@transaction.atomic
def update_role(*, role_id, company, actor, data, request=None, is_platform_admin=False):
    require_role_actor(company=company, actor=actor, permission_code="SYS.ROLE.EDIT", is_platform_admin=is_platform_admin)
    role = Role.objects.select_for_update().get(pk=role_id, company=company)
    if role.role_type != RoleType.CUSTOM or role.is_system_admin:
        raise ValidationError("System Role được bảo vệ; hãy sao chép để tùy chỉnh.")
    if role.updated_at != data["version"]:
        raise RoleVersionConflict()
    before = {"code": role.code, "name": role.name, "description": role.description}
    changed = []
    if "code" in data:
        code = _role_code(data["code"], company, current=role)
        if code != role.code:
            if role.user_assignments.exists():
                raise ValidationError({"code": "Role đã được gán cho User, không thể đổi mã."})
            role.code = code
            changed.append("code")
    if "name" in data:
        name = _role_name(data["name"], company, current=role)
        if name != role.name:
            role.name = name
            changed.append("name")
    if "description" in data:
        description = data["description"].strip()
        if description != role.description:
            role.description = description
            changed.append("description")
    if changed:
        role.updated_by = actor
        role.full_clean()
        role.save(update_fields=(*changed, "updated_by", "updated_at"))
        _audit(role, actor, "ROLE_EDIT", before, {
            "code": role.code, "name": role.name, "description": role.description,
        }, request)
    return role


def role_impact(role):
    now = timezone.now()
    assignments = UserRoleAssignment.objects.filter(
        role=role, status=ActiveStatus.ACTIVE, valid_from__lte=now,
        company_membership__membership_status=ActiveStatus.ACTIVE,
        company_membership__user__auth_user__is_active=True,
    ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now)).select_related(
        "company_membership__user__auth_user", "data_scope_set"
    )
    users = [
        {"user_id": str(a.company_membership.user_id),
         "name": a.company_membership.user.display_name,
         "email": a.company_membership.user.auth_user.email,
         "assignment_id": str(a.pk), "valid_to": a.valid_to,
         "data_scope_set_id": str(a.data_scope_set_id) if a.data_scope_set_id else None}
        for a in assignments
    ]
    tasks = list(WorkItem.objects.filter(
        company=role.company, assignee_role=role,
        status__in=(WorkItem.Status.PENDING, WorkItem.Status.IN_PROGRESS, WorkItem.Status.OVERDUE),
    ).values("id", "title", "status"))
    return {"active_user_count": len({user["user_id"] for user in users}),
            "users": users, "active_work_item_count": len(tasks), "active_work_items": tasks}


def _has_other_company_admin(role):
    required = {"SYS.USER.EDIT", "SYS.ROLE.EDIT"}
    now = timezone.now()
    assignments = UserRoleAssignment.objects.filter(
        company_membership__company=role.company,
        company_membership__membership_status=ActiveStatus.ACTIVE,
        company_membership__user__auth_user__is_active=True,
        role__status=RoleStatus.ACTIVE, status=ActiveStatus.ACTIVE,
        valid_from__lte=now,
    ).exclude(role=role).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=now)
    ).filter(
        Q(data_scope_set__isnull=True) | Q(data_scope_set__allow_all_company_data=True)
    ).prefetch_related(
        "role__role_permissions__permission__resource",
        "role__role_bundles__bundle__permissionbundleitem_set__permission__resource",
    )
    by_user = {}
    for assignment in assignments:
        by_user.setdefault(assignment.company_membership.user_id, set()).update(
            assignment_permission_codes(assignment)
        )
    return any(required <= codes for codes in by_user.values())


@transaction.atomic
def set_role_active(*, role_id, company, actor, active, data, request=None, is_platform_admin=False):
    permission = "SYS.ROLE.REACTIVATE" if active else "SYS.ROLE.DEACTIVATE"
    require_role_actor(company=company, actor=actor, permission_code=permission, is_platform_admin=is_platform_admin)
    role = Role.objects.select_for_update().get(pk=role_id, company=company)
    if role.role_type != RoleType.CUSTOM or role.is_system_admin:
        raise ValidationError("System Role được bảo vệ và không đổi trạng thái trực tiếp.")
    if role.updated_at != data["version"]:
        raise RoleVersionConflict()
    desired = RoleStatus.ACTIVE if active else RoleStatus.INACTIVE
    if role.status == desired:
        raise ValidationError("Role đã ở trạng thái được yêu cầu.")
    impact = role_impact(role)
    if not active:
        if impact["active_work_item_count"]:
            raise ValidationError({"active_work_items": "Cần phân công lại công việc đang sử dụng Role."})
        if (impact["active_user_count"] and
                {"SYS.USER.EDIT", "SYS.ROLE.EDIT"} <= _permission_codes(role) and
                not _has_other_company_admin(role)):
            raise ValidationError("Không thể ngừng Role quản trị cuối cùng của doanh nghiệp.")
    before = {"status": role.status}
    role.status = desired
    role.updated_by = actor
    role.save(update_fields=("status", "updated_by", "updated_at"))
    _audit(role, actor, "ROLE_REACTIVATE" if active else "ROLE_DEACTIVATE", before, {
        "status": desired, "affected_user_count": impact["active_user_count"],
    }, request)
    return role
