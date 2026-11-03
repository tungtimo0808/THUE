from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated

from .models import ActiveStatus, CompanyMembership, RoleStatus, UserPermissionOverride, UserRoleAssignment


def company_identifiers_agree(request):
    """Reject conflicting company or branch context before permission checks."""
    data = request.data if hasattr(request.data, "get") else {}
    for values in (
        (request.headers.get("X-Company-ID"), request.query_params.get("company_id"),
         data.get("company"), data.get("company_id")),
        (request.query_params.get("branch_id"), data.get("branch"), data.get("branch_id")),
    ):
        if len({str(value).strip().lower() for value in values if value}) > 1:
            return False
    return True


def is_platform_admin_user(user_account):
    if not user_account:
        return False
    return getattr(getattr(user_account, "auth_user", None), "is_superuser", False)


def _setting(company):
    from common_services.models import CoreCompanySetting
    setting = CoreCompanySetting.objects.filter(company=company).first()
    return setting.configuration if setting else {}


def _module_disabled(company, module_code):
    configuration = _setting(company)
    if module_code in (configuration.get("disabled_modules") or []):
        return True
    enabled_modules = configuration.get("enabled_modules")
    if enabled_modules is None or module_code in enabled_modules:
        return False
    from common_services.models import ModuleCatalog
    return ModuleCatalog.objects.filter(code=module_code).exists()


def _permission_enabled(company, permission):
    if permission.status != ActiveStatus.ACTIVE or permission.resource.status != ActiveStatus.ACTIVE:
        return False
    if _module_disabled(company, permission.resource.module_code):
        action_code = getattr(getattr(permission, "action", None), "code", None)
        return action_code in {"VIEW", "EXPORT", "PRINT"}
    return True


def is_company_admin_member(user_account, company):
    if not user_account or not company:
        return False
    if not getattr(getattr(user_account, "auth_user", None), "is_active", False):
        return False
    if not CompanyMembership.objects.filter(
        user=user_account,
        company=company,
        membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
    ).exists():
        return False
    if str(getattr(company, "created_by_user_id", "") or "") == str(user_account.id):
        return True
    now = timezone.now()
    return UserRoleAssignment.objects.filter(
        company_membership__user=user_account,
        company_membership__company=company,
        role__status=RoleStatus.ACTIVE,
        status=ActiveStatus.ACTIVE,
        valid_from__lte=now,
    ).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=now)
    ).filter(
        Q(role__is_system_admin=True) | Q(role__code="COMPANY_ADMIN")
    ).exists()



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
    if getattr(assignment.role, "is_system_admin", False) or getattr(assignment.role, "code", "") == "COMPANY_ADMIN":
        from .models import Permission
        return set(
            Permission.objects.filter(
                status=ActiveStatus.ACTIVE,
                resource__status=ActiveStatus.ACTIVE,
            ).values_list("code", flat=True)
        )
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
    if is_company_admin_member(user_account, company) and (not permission or _permission_enabled(company, permission)):
        return True
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


class CompanyMemberMixin:
    """Signed-in access to one company the user belongs to, named by the request."""
    permission_classes = (IsAuthenticated,)

    def _resolve_company(self, request):
        from organization.models import Company

        data = request.data if isinstance(request.data, dict) else {}
        company_id = request.query_params.get("company_id") or data.get("company_id") or data.get("company")
        if not company_id:
            raise ValidationError({"company_id": "Phải xác định doanh nghiệp làm việc (company_id)."})
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError, TypeError, DjangoValidationError):
            raise ValidationError({"company_id": "Doanh nghiệp không tồn tại hoặc không hợp lệ."})
        if not request.user.is_superuser and not CompanyMembership.objects.filter(
            user=getattr(request.user, "iam_account", None), company=company,
            membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
        ).exists():
            raise PermissionDenied("Người dùng không thuộc doanh nghiệp này.")
        return company

    def _get_company_id(self, request):
        return str(self._resolve_company(request).id)


class HasIamPermission(BasePermission):
    """Superusers bootstrap IAM; all other users need an effective scoped grant."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        if not company_identifiers_agree(request):
            return False
        permission_map = getattr(view, "iam_permissions", {})
        permission_code = getattr(view, "action_permissions", {}).get(getattr(view, "action", None)) or permission_map.get(request.method)
        if not permission_code:
            return False
        query_company = request.query_params.get("company_id")
        body_company = (request.data.get("company") or request.data.get("company_id")) if isinstance(request.data, dict) else None
        header_company = request.headers.get("X-Company-ID") or request.META.get("HTTP_X_COMPANY_ID")
        all_ids = {str(c) for c in (header_company, query_company, body_company) if c}
        if len(all_ids) > 1:
            return False
        company_id = header_company or query_company or body_company
        if not company_id or not hasattr(request.user, "iam_account"):
            return False
        request._validated_company_id = str(company_id)
        from organization.models import Company

        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return False
        if is_company_admin_member(request.user.iam_account, company):
            return True
        explicit_scope = any(request.query_params.get(field) for field in (
            "branch_id", "department_id", "warehouse_id", "bank_account_id",
            "project_id", "cost_center_id",
        )) or (
            isinstance(request.data, dict)
            and any(request.data.get(field) for field in ("warehouse", "branch", "department", "company_bank_account", "project", "cost_center"))
        )
        if getattr(view, "allow_scoped_list_permission", False) and not explicit_scope:
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
