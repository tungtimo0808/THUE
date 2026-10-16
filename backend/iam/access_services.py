"""Transactional access management for UC-SYS-07."""
import logging

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from common_services.models import CoreCompanySetting

from .models import (ActiveStatus, CompanyMembership, DataScopeSet, Permission,
                     PermissionBundle, Role, RolePermission, RolePermissionBundle,
                     RoleStatus, UserPermissionOverride, UserRoleAssignment)
from .permissions import assignment_permission_codes, effective_assignments
from .role_services import RoleVersionConflict, _permission_codes, require_role_actor

logger = logging.getLogger(__name__)


def notify_after_commit(membership, title, message, event_key):
    def send():
        try:
            from common_services.services import create_notification
            create_notification(membership.user, title, message, company=membership.company,
                                event_key=event_key)
        except Exception:
            logger.exception("Could not create access change notification")
    transaction.on_commit(send)


def settings_for(company):
    setting = CoreCompanySetting.objects.filter(company=company).first()
    return setting.configuration if setting else {}


def actor_grants(actor, company, is_platform_admin=False):
    if is_platform_admin:
        return set(Permission.objects.filter(status="ACTIVE", resource__status="ACTIVE").values_list("code", flat=True))
    return set().union(*(assignment_permission_codes(a) for a in effective_assignments(actor, company)
                         if a.data_scope_set_id is None or a.data_scope_set.allow_all_company_data))


def validate_codes(company, codes, actor, is_platform_admin=False):
    permissions = list(Permission.objects.select_related("resource").filter(code__in=codes))
    enabled = set(settings_for(company).get("enabled_modules") or [])
    valid = {p.code for p in permissions if p.status == "ACTIVE" and p.resource.status == "ACTIVE"
             and (not enabled or p.resource.module_code in enabled or p.resource.module_code in {"SYS", "COM"})}
    if valid != set(codes):
        raise ValidationError({"permission_codes": "Permission khong ton tai hoac module khong hoat dong."})
    if not set(codes) <= actor_grants(actor, company, is_platform_admin):
        raise PermissionDenied("Khong duoc cap Permission vuot qua quyen hien co.")
    return permissions


def validate_sod(company, codes):
    config = settings_for(company)
    for pair in config.get("sod_conflicts", []):
        if len(pair) == 2 and set(pair) <= set(codes):
            raise ValidationError({"permission_codes": "Vi pham quy tac phan tach nhiem vu."})
    for code, dependencies in config.get("permission_dependencies", {}).items():
        if code in codes and not set(dependencies) <= set(codes):
            raise ValidationError({"permission_codes": "Thieu Permission phu thuoc."})


def audit(company, actor, action, entity, before, after, request=None, reason=""):
    record_audit(company=company, actor_user=actor, module_code="SYS", action_code=action,
                 entity=entity, before=before, after=after, request=request, reason=reason)


@transaction.atomic
def update_matrix(*, company, role_id, actor, codes, bundle_ids, version, request=None, is_platform_admin=False):
    require_role_actor(company=company, actor=actor, permission_code="SYS.PERMISSION.CONFIGURE",
                       is_platform_admin=is_platform_admin)
    role = Role.objects.select_for_update().get(pk=role_id, company=company)
    if role.status != RoleStatus.ACTIVE or role.role_type != "CUSTOM":
        raise ValidationError("Chi co the sua Role tuy chinh dang hoat dong.")
    if role.updated_at != version:
        raise RoleVersionConflict()
    bundles = list(PermissionBundle.objects.filter(pk__in=bundle_ids, status="ACTIVE"))
    if len(bundles) != len(set(bundle_ids)):
        raise ValidationError({"bundle_ids": "Bundle khong hop le."})
    final = set(codes)
    for bundle in bundles:
        final.update(bundle.permissions.values_list("code", flat=True))
    permissions = validate_codes(company, final, actor, is_platform_admin)
    validate_sod(company, final)
    before = sorted(_permission_codes(role))
    if UserRoleAssignment.objects.filter(role=role, company_membership__user=actor,
                                          status="ACTIVE").exists() and not final <= set(before):
        raise PermissionDenied("Khong duoc tu cap them quyen qua Role cua chinh minh.")
    if role.is_system_admin and set(before) - final and UserRoleAssignment.objects.filter(
            role=role, status="ACTIVE", company_membership__membership_status="ACTIVE").exists():
        from .permissions import has_other_effective_system_admin
        if not has_other_effective_system_admin(company, excluded_role=role):
            raise ValidationError("Khong duoc giam quyen cua Admin cuoi cung.")
    existing = {item.permission.code: item for item in RolePermission.objects.select_for_update().filter(
        role=role).select_related("permission")}
    for code, item in existing.items():
        effect = "ALLOW" if code in final else "REVOKED"
        if item.effect != effect:
            item.effect = effect
            item.save(update_fields=("effect",))
    for permission in permissions:
        if permission.code not in existing:
            RolePermission.objects.create(role=role, permission=permission)
    # A bundle is a template: never leave a live link that can change this Role later.
    RolePermissionBundle.objects.filter(role=role).delete()
    role.updated_by = actor
    role.save(update_fields=("updated_by", "updated_at"))
    affected = UserRoleAssignment.objects.filter(role=role, status="ACTIVE").values(
        "company_membership_id").distinct().count()
    audit(company, actor, "PERMISSION_MATRIX_UPDATE", role,
          {"permission_codes": before}, {"permission_codes": sorted(final), "affected_users": affected}, request)
    return role, sorted(final), affected


def _scope(company, scope_id):
    if not scope_id:
        return None
    scope = DataScopeSet.objects.filter(pk=scope_id, company=company, status="ACTIVE").first()
    if scope is None:
        raise ValidationError({"data_scope_set": "Data Scope khong hop le."})
    return scope


@transaction.atomic
def assign_role(*, company, actor, membership_id, role_id, valid_from, valid_to=None,
                scope_id=None, reason="", request=None, is_platform_admin=False):
    require_role_actor(company=company, actor=actor, permission_code="SYS.PERMISSION.ASSIGN_ROLE",
                       is_platform_admin=is_platform_admin)
    membership = CompanyMembership.objects.select_for_update().filter(
        pk=membership_id, company=company, membership_status="ACTIVE", user__auth_user__is_active=True).first()
    role = Role.objects.filter(pk=role_id, company=company, status="ACTIVE").first()
    if not membership or not role:
        raise ValidationError("Membership hoac Role khong hop le.")
    if membership.user_id == actor.id:
        raise PermissionDenied("Khong duoc tu gan Role.")
    scope = _scope(company, scope_id)
    codes = _permission_codes(role)
    validate_codes(company, codes, actor, is_platform_admin)
    now = timezone.now()
    start = valid_from or now
    if valid_to and valid_to <= start:
        raise ValidationError({"valid_to": "Thoi han khong hop le."})
    if valid_to and valid_to <= now:
        raise ValidationError({"valid_to": "Thoi han da het."})
    if UserRoleAssignment.objects.filter(company_membership=membership, role=role,
                                         valid_from=start).exists():
        raise ValidationError({"valid_from": "Thoi diem bat dau da duoc su dung; chon thoi diem khac."})
    overlaps = UserRoleAssignment.objects.select_for_update().filter(
        company_membership=membership, role=role, status__in=("ACTIVE", "SCHEDULED"))
    if valid_to:
        overlaps = overlaps.filter(valid_from__lt=valid_to)
    if overlaps.filter(Q(valid_to__isnull=True) | Q(valid_to__gt=start)).exists():
        raise ValidationError("Role Assignment trung khoang hieu luc.")
    other_codes = set().union(*(assignment_permission_codes(a) for a in effective_assignments(membership.user, company)))
    validate_sod(company, codes | other_codes)
    assignment = UserRoleAssignment.objects.create(
        company_membership=membership, role=role, data_scope_set=scope, valid_from=start,
        valid_to=valid_to, status="SCHEDULED" if start > now else "ACTIVE",
        assigned_by=actor, assign_reason=reason.strip())
    audit(company, actor, "ROLE_ASSIGN", assignment, {}, {"role": str(role.id),
          "membership": str(membership.id), "valid_from": start.isoformat(),
          "valid_to": valid_to.isoformat() if valid_to else None, "scope": str(scope.id) if scope else None}, request, reason)
    notify_after_commit(membership, "Role da duoc gan", f"Ban duoc gan Role {role.name}.",
                        f"role-assigned:{assignment.id}")
    return assignment


@transaction.atomic
def revoke_role(*, company, actor, assignment_id, reason, request=None, is_platform_admin=False):
    require_role_actor(company=company, actor=actor, permission_code="SYS.PERMISSION.REVOKE_ROLE",
                       is_platform_admin=is_platform_admin)
    if not reason.strip():
        raise ValidationError({"reason": "Can nhap ly do thu hoi."})
    assignment = UserRoleAssignment.objects.select_for_update().select_related("role", "company_membership").get(
        pk=assignment_id, company_membership__company=company)
    if assignment.status not in ("ACTIVE", "SCHEDULED"):
        raise ValidationError("Role Assignment da ket thuc.")
    from .permissions import has_other_effective_system_admin
    if assignment.role.is_system_admin and not has_other_effective_system_admin(
            company, excluded_assignment=assignment):
        raise ValidationError("Khong the thu hoi Admin cuoi cung.")
    before = {"status": assignment.status, "valid_to": assignment.valid_to.isoformat() if assignment.valid_to else None}
    assignment.status = "REVOKED"
    assignment.revoked_at = timezone.now()
    assignment.revoked_by = actor
    assignment.revoke_reason = reason.strip()
    assignment.save(update_fields=("status", "revoked_at", "revoked_by", "revoke_reason"))
    audit(company, actor, "ROLE_REVOKE", assignment, before,
          {"status": "REVOKED", "reason": assignment.revoke_reason}, request, reason)
    notify_after_commit(assignment.company_membership, "Role da duoc thu hoi",
                        f"Role {assignment.role.name} da duoc thu hoi.", f"role-revoked:{assignment.id}")
    return assignment


@transaction.atomic
def add_override(*, company, actor, membership_id, permission_code, effect, reason,
                 valid_from=None, valid_to=None, scope_id=None, request=None, is_platform_admin=False):
    require_role_actor(company=company, actor=actor, permission_code="SYS.PERMISSION.DIRECT_PERMISSION",
                       is_platform_admin=is_platform_admin)
    if not settings_for(company).get("direct_user_permissions_enabled", False):
        raise ValidationError("Quyen truc tiep chua duoc bat.")
    if effect not in ("GRANT", "DENY") or not reason.strip():
        raise ValidationError("Can effect va ly do hop le.")
    membership = CompanyMembership.objects.select_for_update().filter(
        pk=membership_id, company=company, membership_status="ACTIVE").first()
    if not membership:
        raise ValidationError("Membership khong hop le.")
    if effect == "GRANT" and membership.user_id == actor.id:
        raise PermissionDenied("Khong duoc tu cap quyen.")
    permission = validate_codes(company, {permission_code}, actor, is_platform_admin)[0]
    scope = _scope(company, scope_id)
    start = valid_from or timezone.now()
    if valid_to and valid_to <= start:
        raise ValidationError({"valid_to": "Thoi han khong hop le."})
    override = UserPermissionOverride.objects.create(
        company_membership=membership, permission=permission, data_scope_set=scope,
        effect=effect, reason=reason.strip(), valid_from=start, valid_to=valid_to, assigned_by=actor)
    audit(company, actor, "DIRECT_PERMISSION_ADD", override, {},
          {"membership": str(membership.id), "permission": permission_code,
           "effect": effect, "reason": reason.strip()}, request, reason)
    notify_after_commit(membership, "Quyen truy cap da thay doi",
                        f"Quyen {permission_code} da thay doi.", f"direct-permission:{override.id}")
    return override


@transaction.atomic
def revoke_override(*, company, actor, override_id, reason, request=None, is_platform_admin=False):
    require_role_actor(company=company, actor=actor, permission_code="SYS.PERMISSION.DIRECT_PERMISSION",
                       is_platform_admin=is_platform_admin)
    if not reason.strip():
        raise ValidationError({"reason": "Can nhap ly do."})
    override = UserPermissionOverride.objects.select_for_update().get(
        pk=override_id, company_membership__company=company, revoked_at__isnull=True)
    override.revoked_at = timezone.now()
    override.revoked_by = actor
    override.save(update_fields=("revoked_at", "revoked_by"))
    audit(company, actor, "DIRECT_PERMISSION_REVOKE", override, {},
          {"revoked_at": override.revoked_at.isoformat()}, request, reason)
    notify_after_commit(override.company_membership, "Quyen truy cap da thay doi",
                        f"Quyen {override.permission.code} da thay doi.", f"direct-permission-revoked:{override.id}")
    return override
