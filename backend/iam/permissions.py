from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import BasePermission

from .models import ActiveStatus, CompanyMembership, RoleStatus, UserPermissionOverride, UserRoleAssignment


def is_platform_admin_user(user_account):
    if not user_account:
        return False
    return getattr(getattr(user_account, "auth_user", None), "is_superuser", False)


def _setting(company):
    from common_services.models import CoreCompanySetting
    setting = CoreCompanySetting.objects.filter(company=company).first()
    return setting.configuration if setting else {}


def _permission_enabled(company, permission):
    if permission.status != ActiveStatus.ACTIVE or permission.resource.status != ActiveStatus.ACTIVE:
        return False
    modules = _setting(company).get("enabled_modules") or []
    if permission.resource.module_code in {"SYS", "COM"} or not modules or permission.resource.module_code in modules:
        return True
    action_code = getattr(getattr(permission, "action", None), "code", None)
    if action_code in {"VIEW", "EXPORT", "PRINT"}:
        return True
    return False



def _scope_allows(scope, *, branch_id=None, department_id=None, warehouse_id=None,
                  bank_account_id=None, project_id=None, cost_center_id=None):
    if scope is None or scope.allow_all_company_data:
        return True
    return bool(
        (branch_id and scope.branch_scopes.filter(branch_id=branch_id).exists()) or
        (department_id and scope.department_scopes.filter(department_id=department_id).exists()) or
        (warehouse_id and scope.warehouse_scopes.filter(warehouse_id=warehouse_id).exists()) or
        (bank_account_id and scope.bank_account_scopes.filter(company_bank_account_id=bank_account_id).exists()) or
        (project_id and scope.project_scopes.filter(project_id=project_id).exists()) or
        (cost_center_id and scope.cost_center_scopes.filter(cost_center_id=cost_center_id).exists())
    )


def sync_assignment_statuses_for_company(company, at=None):
    at = at or timezone.now()
    queryset = UserRoleAssignment.objects.filter(company_membership__company=company)
    queryset.filter(status="SCHEDULED", valid_from__lte=at).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=at)
    ).update(status="ACTIVE")
    queryset.filter(status__in=("ACTIVE", "SCHEDULED"), valid_to__lt=at).update(status="EXPIRED")


def sync_assignment_statuses(user_account, company, at=None):
    at = at or timezone.now()
    queryset = UserRoleAssignment.objects.filter(
        company_membership__user=user_account, company_membership__company=company,
    )
    queryset.filter(status="SCHEDULED", valid_from__lte=at).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=at)
    ).update(status="ACTIVE")
    queryset.filter(status__in=("ACTIVE", "SCHEDULED"), valid_to__lt=at).update(status="EXPIRED")


def effective_assignments(user_account, company, at=None, skip_sync=False):
    """Return grants per assignment; scopes are deliberately never merged."""
    at = at or timezone.now()
    if not skip_sync:
        sync_assignment_statuses(user_account, company, at)
    queryset = UserRoleAssignment.objects.filter(
            company_membership__user=user_account,
            company_membership__company=company,
            company_membership__membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
            role__status=RoleStatus.ACTIVE,
            status=ActiveStatus.ACTIVE,
            valid_from__lte=at,
        )
    if not user_account.auth_user.is_active:
        return queryset.none()
    return (
        queryset
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gte=at))
        .filter(Q(data_scope_set__isnull=True) | Q(data_scope_set__status=ActiveStatus.ACTIVE))
        .select_related("role", "data_scope_set")
        .prefetch_related(
            "role__role_permissions__permission__resource",
            "role__role_bundles__bundle__permissionbundleitem_set__permission__resource",
        )
    )


def assignment_permission_codes(assignment):
    direct = {
        item.permission.code
        for item in assignment.role.role_permissions.all()
        if item.effect == "ALLOW" and item.permission.status == ActiveStatus.ACTIVE
        and item.permission.resource.status == ActiveStatus.ACTIVE
    }
    bundled = {
        item.permission.code
        for role_bundle in assignment.role.role_bundles.all()
        if role_bundle.bundle.status == ActiveStatus.ACTIVE
        for item in role_bundle.bundle.permissionbundleitem_set.all()
        if item.permission.status == ActiveStatus.ACTIVE
        and item.permission.resource.status == ActiveStatus.ACTIVE
    }
    return direct | bundled


def memberships_in_scope(user_account, company, permission_code):
    """Limit company members to the branches/departments of this permission's grants."""
    from .models import CompanyMembership

    queryset = CompanyMembership.objects.filter(company=company)
    permitted = [
        assignment for assignment in effective_assignments(user_account, company)
        if permission_code in assignment_permission_codes(assignment)
    ]
    if any(a.data_scope_set_id is None or a.data_scope_set.allow_all_company_data for a in permitted):
        return queryset
    scope_filter = Q(pk__in=[])
    for assignment in permitted:
        scope = assignment.data_scope_set
        branches = scope.branch_scopes.values_list("branch_id", flat=True)
        departments = scope.department_scopes.values_list("department_id", flat=True)
        scope_filter |= Q(employee__branch_id__in=branches) | Q(employee__department_id__in=departments)
        if scope.allow_owned_records:
            scope_filter |= Q(user=user_account)
    return queryset.filter(scope_filter).distinct()


def has_effective_permission(
    user_account, company, permission_code, *, branch_id=None, department_id=None,
    warehouse_id=None, bank_account_id=None, project_id=None, cost_center_id=None,
):
    from .models import Permission
    if not CompanyMembership.objects.filter(
        user=user_account, company=company, membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
    ).exists() or not user_account.auth_user.is_active:
        return False
    permission = Permission.objects.select_related("resource", "action").filter(code=permission_code).first()
    if not permission or not _permission_enabled(company, permission):
        if permission_code in ("SYS.USER.LOCK", "SYS.USER.UNLOCK", "SYS.USER.TERMINATE", "SYS.MEMBERSHIP.TERMINATE"):
            return has_effective_permission(
                user_account, company, "SYS.USER.EDIT",
                branch_id=branch_id, department_id=department_id,
                warehouse_id=warehouse_id, bank_account_id=bank_account_id,
                project_id=project_id, cost_center_id=cost_center_id,
            )
        return False
    now = timezone.now()
    configuration = _setting(company)
    overrides = UserPermissionOverride.objects.none()
    if configuration.get("direct_user_permissions_enabled", False):
        overrides = UserPermissionOverride.objects.filter(
            company_membership__user=user_account, company_membership__company=company,
            permission=permission, revoked_at__isnull=True, valid_from__lte=now,
        ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now)).filter(
            Q(data_scope_set__isnull=True) | Q(data_scope_set__status=ActiveStatus.ACTIVE)
        ).select_related("data_scope_set")
        for override in overrides.filter(effect="DENY"):
            if _scope_allows(override.data_scope_set, branch_id=branch_id,
                             department_id=department_id, warehouse_id=warehouse_id,
                             bank_account_id=bank_account_id, project_id=project_id,
                             cost_center_id=cost_center_id):
                return False
        for override in overrides.filter(effect="GRANT"):
            if _scope_allows(override.data_scope_set, branch_id=branch_id,
                             department_id=department_id, warehouse_id=warehouse_id,
                             bank_account_id=bank_account_id, project_id=project_id,
                             cost_center_id=cost_center_id):
                return True
    for assignment in effective_assignments(user_account, company):
        if permission_code not in assignment_permission_codes(assignment):
            continue
        if _scope_allows(assignment.data_scope_set, branch_id=branch_id,
                         department_id=department_id, warehouse_id=warehouse_id,
                         bank_account_id=bank_account_id, project_id=project_id,
                         cost_center_id=cost_center_id):
            return True
    if permission_code in ("SYS.USER.LOCK", "SYS.USER.UNLOCK", "SYS.USER.TERMINATE", "SYS.MEMBERSHIP.TERMINATE"):
        return has_effective_permission(
            user_account, company, "SYS.USER.EDIT",
            branch_id=branch_id, department_id=department_id,
            warehouse_id=warehouse_id, bank_account_id=bank_account_id,
            project_id=project_id, cost_center_id=cost_center_id,
        )
    return False


def has_other_effective_system_admin(company, *, excluded_user=None, excluded_role=None, excluded_assignment=None):
    now = timezone.now()
    queryset = UserRoleAssignment.objects.filter(
        company_membership__company=company,
        company_membership__membership_status=ActiveStatus.ACTIVE,
        company_membership__user__auth_user__is_active=True,
        role__is_system_admin=True,
        role__status=RoleStatus.ACTIVE,
        status=ActiveStatus.ACTIVE,
        valid_from__lte=now,
    ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now))
    if excluded_user:
        queryset = queryset.exclude(company_membership__user=excluded_user)
    if excluded_role:
        queryset = queryset.exclude(role=excluded_role)
    if excluded_assignment:
        queryset = queryset.exclude(pk=excluded_assignment.pk)
    return queryset.exists()


class HasIamPermission(BasePermission):
    """Superusers bootstrap IAM; all other users need an effective scoped grant."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        permission_map = getattr(view, "iam_permissions", {})
        permission_code = getattr(view, "action_permissions", {}).get(getattr(view, "action", None)) or permission_map.get(request.method)
        if not permission_code:
            return False
        company_id = request.query_params.get("company_id") or request.data.get("company")
        if not company_id or not hasattr(request.user, "iam_account"):
            return False
        from organization.models import Company

        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return False
        has_specific_scope = bool(
            request.query_params.get("warehouse_id")
            or (isinstance(request.data, dict) and request.data.get("warehouse"))
            or request.query_params.get("branch_id")
            or (isinstance(request.data, dict) and request.data.get("branch"))
        )
        if getattr(view, "allow_scoped_list_permission", False) and not has_specific_scope:
            if _setting(company).get("direct_user_permissions_enabled", False):
                now = timezone.now()
                if UserPermissionOverride.objects.filter(
                    company_membership__user=request.user.iam_account,
                    company_membership__company=company, permission__code=permission_code,
                    effect="DENY", revoked_at__isnull=True, valid_from__lte=now,
                ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now)).filter(
                    Q(data_scope_set__isnull=True) | Q(data_scope_set__allow_all_company_data=True)
                ).exists():
                    return False
            return any(
                permission_code in assignment_permission_codes(assignment)
                for assignment in effective_assignments(request.user.iam_account, company)
            )
        has_perm = has_effective_permission(
            request.user.iam_account,
            company,
            permission_code,
            branch_id=request.query_params.get("branch_id") or request.data.get("branch"),
            department_id=request.query_params.get("department_id") or request.data.get("department"),
            warehouse_id=request.query_params.get("warehouse_id") or request.data.get("warehouse"),
            bank_account_id=request.query_params.get("bank_account_id") or request.data.get("company_bank_account"),
            project_id=request.query_params.get("project_id") or request.data.get("project"),
            cost_center_id=request.query_params.get("cost_center_id") or request.data.get("cost_center"),
        )
        if not has_perm:
            if permission_code in ("SYS.USER.LOCK", "SYS.USER.UNLOCK"):
                return has_effective_permission(request.user.iam_account, company, "SYS.USER.EDIT")
            if permission_code == "SYS.USER.VIEW_SECURITY":
                return has_effective_permission(request.user.iam_account, company, "SYS.USER.VIEW")
        return has_perm
