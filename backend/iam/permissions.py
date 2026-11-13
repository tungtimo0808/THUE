import threading
import time

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.db.models import Q
from django.db.models.signals import post_delete, post_save
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated

from .models import (
    ActiveStatus,
    CompanyMembership,
    DataScopeBankAccount,
    DataScopeBranch,
    DataScopeCostCenter,
    DataScopeDepartment,
    DataScopeProject,
    DataScopeSet,
    DataScopeWarehouse,
    Permission,
    PermissionAction,
    PermissionBundle,
    PermissionBundleItem,
    PermissionResource,
    Role,
    RolePermission,
    RolePermissionBundle,
    RoleStatus,
    UserAccount,
    UserPermissionOverride,
    UserRoleAssignment,
)

_CACHE_LOCK = threading.RLock()
_PERM_META_STATE = {"ts": 0.0, "meta": {}, "active_codes": frozenset(), "catalog_modules": frozenset()}
_COMPANY_SETTING_CACHE = {}       # company_id_str -> (ts, configuration_dict)
_ROLE_PERM_CODES_CACHE = {}       # role_id_str -> (ts, frozenset_of_codes)
_SCOPE_DIM_CACHE = {}             # scope_id_str -> (ts, dims_dict)
_USER_COMPANY_GRANT_CACHE = {}    # (user_id_str, company_id_str) -> (ts, snapshot_dict)
_ASSIGNMENT_SYNC_TS = {}          # (user_id_str, company_id_str) -> ts
_LAZY_SIGNALS_CONNECTED = False


def invalidate_iam_permission_caches(*_args, **_kwargs):
    with _CACHE_LOCK:
        _PERM_META_STATE["ts"] = 0.0
        _COMPANY_SETTING_CACHE.clear()
        _ROLE_PERM_CODES_CACHE.clear()
        _SCOPE_DIM_CACHE.clear()
        _USER_COMPANY_GRANT_CACHE.clear()
        _ASSIGNMENT_SYNC_TS.clear()


def _connect_cache_invalidation_signals():
    models_to_watch = (
        Permission,
        PermissionResource,
        PermissionAction,
        PermissionBundle,
        PermissionBundleItem,
        Role,
        RolePermission,
        RolePermissionBundle,
        CompanyMembership,
        UserRoleAssignment,
        UserPermissionOverride,
        UserAccount,
        DataScopeSet,
        DataScopeBranch,
        DataScopeDepartment,
        DataScopeWarehouse,
        DataScopeBankAccount,
        DataScopeProject,
        DataScopeCostCenter,
        get_user_model(),
    )
    for model_cls in models_to_watch:
        uid_base = f"iam_perm_cache_inv_{model_cls._meta.label_lower}"
        post_save.connect(invalidate_iam_permission_caches, sender=model_cls, dispatch_uid=f"{uid_base}_save")
        post_delete.connect(invalidate_iam_permission_caches, sender=model_cls, dispatch_uid=f"{uid_base}_del")


_connect_cache_invalidation_signals()


def _ensure_lazy_signals():
    global _LAZY_SIGNALS_CONNECTED
    if _LAZY_SIGNALS_CONNECTED:
        return
    with _CACHE_LOCK:
        if _LAZY_SIGNALS_CONNECTED:
            return
        from common_services.models import CoreCompanySetting, ModuleCatalog

        for model_cls in (CoreCompanySetting, ModuleCatalog):
            uid_base = f"iam_perm_cache_inv_{model_cls._meta.label_lower}"
            post_save.connect(invalidate_iam_permission_caches, sender=model_cls, dispatch_uid=f"{uid_base}_save")
            post_delete.connect(invalidate_iam_permission_caches, sender=model_cls, dispatch_uid=f"{uid_base}_del")
        _LAZY_SIGNALS_CONNECTED = True


def _get_perm_meta_bundle():
    _ensure_lazy_signals()
    now_mono = time.monotonic()
    with _CACHE_LOCK:
        if now_mono - _PERM_META_STATE["ts"] < 30.0 and _PERM_META_STATE["meta"]:
            return _PERM_META_STATE["meta"], _PERM_META_STATE["active_codes"], _PERM_META_STATE["catalog_modules"]

    from common_services.models import ModuleCatalog

    rows = list(
        Permission.objects.select_related("resource", "action").values_list(
            "code", "id", "status", "resource__status", "resource__module_code", "action__code"
        )
    )
    meta = {
        code: (perm_id, p_status, r_status, mod_code, act_code)
        for code, perm_id, p_status, r_status, mod_code, act_code in rows
    }
    active_codes = frozenset(
        code for code, (_, p_status, r_status, _, _) in meta.items()
        if p_status == ActiveStatus.ACTIVE and r_status == ActiveStatus.ACTIVE
    )
    catalog_modules = frozenset(ModuleCatalog.objects.values_list("code", flat=True))
    with _CACHE_LOCK:
        _PERM_META_STATE["ts"] = time.monotonic()
        _PERM_META_STATE["meta"] = meta
        _PERM_META_STATE["active_codes"] = active_codes
        _PERM_META_STATE["catalog_modules"] = catalog_modules
    return meta, active_codes, catalog_modules


def _get_role_perm_codes(role_id, is_system_admin=False, role_code=""):
    if is_system_admin or role_code in ("COMPANY_ADMIN", "ROLE_ADMIN"):
        _, active_codes, _ = _get_perm_meta_bundle()
        return active_codes
    key = str(role_id)
    now_mono = time.monotonic()
    with _CACHE_LOCK:
        entry = _ROLE_PERM_CODES_CACHE.get(key)
        if entry and now_mono - entry[0] < 30.0:
            return entry[1]

    direct = set(
        RolePermission.objects.filter(
            role_id=role_id,
            effect="ALLOW",
            permission__status=ActiveStatus.ACTIVE,
            permission__resource__status=ActiveStatus.ACTIVE,
        ).values_list("permission__code", flat=True)
    )
    bundled = set(
        PermissionBundleItem.objects.filter(
            bundle__role_bundles__role_id=role_id,
            bundle__status=ActiveStatus.ACTIVE,
            permission__status=ActiveStatus.ACTIVE,
            permission__resource__status=ActiveStatus.ACTIVE,
        ).values_list("permission__code", flat=True)
    )
    codes = frozenset(direct | bundled)
    with _CACHE_LOCK:
        _ROLE_PERM_CODES_CACHE[key] = (time.monotonic(), codes)
    return codes


def _get_scope_dims_by_id(scope_id):
    if not scope_id:
        return None
    key = str(scope_id)
    now_mono = time.monotonic()
    with _CACHE_LOCK:
        entry = _SCOPE_DIM_CACHE.get(key)
        if entry and now_mono - entry[0] < 20.0:
            return entry[1]

    scope_obj = DataScopeSet.objects.filter(pk=scope_id).only(
        "id", "status", "allow_all_company_data", "allow_owned_records"
    ).first()
    if not scope_obj:
        return None
    if scope_obj.allow_all_company_data:
        dims = {
            "status": scope_obj.status,
            "allow_all": True,
            "allow_owned": scope_obj.allow_owned_records,
            "branches": frozenset(),
            "departments": frozenset(),
            "warehouses": frozenset(),
            "banks": frozenset(),
            "projects": frozenset(),
            "cost_centers": frozenset(),
        }
    else:
        dims = {
            "status": scope_obj.status,
            "allow_all": False,
            "allow_owned": scope_obj.allow_owned_records,
            "branches": frozenset(str(x) for x in DataScopeBranch.objects.filter(data_scope_set_id=scope_id).values_list("branch_id", flat=True)),
            "departments": frozenset(str(x) for x in DataScopeDepartment.objects.filter(data_scope_set_id=scope_id).values_list("department_id", flat=True)),
            "warehouses": frozenset(str(x) for x in DataScopeWarehouse.objects.filter(data_scope_set_id=scope_id).values_list("warehouse_id", flat=True)),
            "banks": frozenset(str(x) for x in DataScopeBankAccount.objects.filter(data_scope_set_id=scope_id).values_list("company_bank_account_id", flat=True)),
            "projects": frozenset(str(x) for x in DataScopeProject.objects.filter(data_scope_set_id=scope_id).values_list("project_id", flat=True)),
            "cost_centers": frozenset(str(x) for x in DataScopeCostCenter.objects.filter(data_scope_set_id=scope_id).values_list("cost_center_id", flat=True)),
        }
    with _CACHE_LOCK:
        _SCOPE_DIM_CACHE[key] = (time.monotonic(), dims)
    return dims


def _scope_dims_allows(
    dims, *, branch_id=None, department_id=None, warehouse_id=None,
    bank_account_id=None, project_id=None, cost_center_id=None,
):
    if dims is None or dims["allow_all"]:
        return True
    return bool(
        (branch_id and str(branch_id) in dims["branches"])
        or (department_id and str(department_id) in dims["departments"])
        or (warehouse_id and str(warehouse_id) in dims["warehouses"])
        or (bank_account_id and str(bank_account_id) in dims["banks"])
        or (project_id and str(project_id) in dims["projects"])
        or (cost_center_id and str(cost_center_id) in dims["cost_centers"])
    )


def _get_user_company_grant_snapshot(user_account, company):
    key = (str(user_account.id), str(company.id))
    now_mono = time.monotonic()
    with _CACHE_LOCK:
        entry = _USER_COMPANY_GRANT_CACHE.get(key)
        if entry and now_mono - entry[0] < 10.0:
            return entry[1]

    sync_assignment_statuses(user_account, company)
    has_membership = CompanyMembership.objects.filter(
        user_id=user_account.id,
        company_id=company.id,
        membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
    ).exists()
    is_super = bool(getattr(getattr(user_account, "auth_user", None), "is_superuser", False))
    if not has_membership and is_super:
        CompanyMembership.objects.get_or_create(
            user=user_account,
            company=company,
            defaults={"membership_status": ActiveStatus.ACTIVE, "created_by": user_account},
        )
        has_membership = True

    if not has_membership:
        snap = {"has_membership": False, "is_admin": False, "assignments": ()}
        with _CACHE_LOCK:
            _USER_COMPANY_GRANT_CACHE[key] = (time.monotonic(), snap)
        return snap

    now = timezone.now()
    asg_rows = list(
        UserRoleAssignment.objects.filter(
            company_membership__user_id=user_account.id,
            company_membership__company_id=company.id,
            company_membership__membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
            role__status=RoleStatus.ACTIVE,
            status=ActiveStatus.ACTIVE,
            valid_from__lte=now,
        )
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now))
        .filter(Q(data_scope_set__isnull=True) | Q(data_scope_set__status=ActiveStatus.ACTIVE))
        .values_list("role_id", "role__is_system_admin", "role__code", "data_scope_set_id")
    )
    is_creator = str(getattr(company, "created_by_user_id", "") or "") == str(user_account.id)
    has_admin_role = any(is_sys or r_code in ("COMPANY_ADMIN", "ROLE_ADMIN") for _, is_sys, r_code, _ in asg_rows)
    is_admin = bool(is_creator or has_admin_role or (is_super and not asg_rows))
    snap = {
        "has_membership": True,
        "is_admin": is_admin,
        "assignments": tuple(asg_rows),
    }
    with _CACHE_LOCK:
        _USER_COMPANY_GRANT_CACHE[key] = (time.monotonic(), snap)
    return snap


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
    if not company:
        return {}
    _ensure_lazy_signals()
    cid = str(company.id)
    now_mono = time.monotonic()
    with _CACHE_LOCK:
        entry = _COMPANY_SETTING_CACHE.get(cid)
        if entry and now_mono - entry[0] < 15.0:
            return entry[1]
    from common_services.models import CoreCompanySetting

    cfg = CoreCompanySetting.objects.filter(company_id=company.id).values_list("configuration", flat=True).first()
    res = cfg if isinstance(cfg, dict) else {}
    with _CACHE_LOCK:
        _COMPANY_SETTING_CACHE[cid] = (time.monotonic(), res)
    return res


def _module_disabled(company, module_code):
    configuration = _setting(company)
    if module_code in (configuration.get("disabled_modules") or []):
        return True
    enabled_modules = configuration.get("enabled_modules")
    if enabled_modules is None or module_code in enabled_modules:
        return False
    _, _, catalog_modules = _get_perm_meta_bundle()
    return module_code in catalog_modules


def _permission_enabled(company, permission):
    if permission.status != ActiveStatus.ACTIVE or permission.resource.status != ActiveStatus.ACTIVE:
        return False
    if _module_disabled(company, permission.resource.module_code):
        action_code = getattr(getattr(permission, "action", None), "code", None)
        return action_code in {"VIEW", "EXPORT", "PRINT"}
    return True


def _permission_meta_enabled(company, perm_meta):
    _, p_status, r_status, module_code, action_code = perm_meta
    if p_status != ActiveStatus.ACTIVE or r_status != ActiveStatus.ACTIVE:
        return False
    if _module_disabled(company, module_code):
        return action_code in {"VIEW", "EXPORT", "PRINT"}
    return True


def is_company_admin_member(user_account, company):
    if not user_account or not company:
        return False
    if not getattr(getattr(user_account, "auth_user", None), "is_active", False):
        return False
    snap = _get_user_company_grant_snapshot(user_account, company)
    return snap["is_admin"]


def _scope_allows(scope, *, branch_id=None, department_id=None, warehouse_id=None,
                  bank_account_id=None, project_id=None, cost_center_id=None):
    if scope is None or scope.allow_all_company_data:
        return True
    dims = _get_scope_dims_by_id(scope.id)
    return _scope_dims_allows(
        dims,
        branch_id=branch_id,
        department_id=department_id,
        warehouse_id=warehouse_id,
        bank_account_id=bank_account_id,
        project_id=project_id,
        cost_center_id=cost_center_id,
    )


def sync_assignment_statuses_for_company(company, at=None):
    at = at or timezone.now()
    queryset = UserRoleAssignment.objects.filter(company_membership__company=company)
    c1 = queryset.filter(status="SCHEDULED", valid_from__lte=at).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=at)
    ).update(status="ACTIVE")
    c2 = queryset.filter(status__in=("ACTIVE", "SCHEDULED"), valid_to__lt=at).update(status="EXPIRED")
    if c1 or c2:
        invalidate_iam_permission_caches()


def sync_assignment_statuses(user_account, company, at=None):
    is_default_now = at is None
    if is_default_now:
        key = (str(user_account.id), str(company.id))
        now_mono = time.monotonic()
        with _CACHE_LOCK:
            last_ts = _ASSIGNMENT_SYNC_TS.get(key, 0.0)
            if now_mono - last_ts < 15.0:
                return
            _ASSIGNMENT_SYNC_TS[key] = now_mono
    at = at or timezone.now()
    queryset = UserRoleAssignment.objects.filter(
        company_membership__user=user_account, company_membership__company=company,
    )
    needs_sync = queryset.filter(
        Q(status="SCHEDULED", valid_from__lte=at) | Q(status__in=("ACTIVE", "SCHEDULED"), valid_to__lt=at)
    ).exists()
    if not needs_sync:
        return
    c1 = queryset.filter(status="SCHEDULED", valid_from__lte=at).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=at)
    ).update(status="ACTIVE")
    c2 = queryset.filter(status__in=("ACTIVE", "SCHEDULED"), valid_to__lt=at).update(status="EXPIRED")
    if c1 or c2:
        invalidate_iam_permission_caches()


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
    )


def assignment_permission_codes(assignment):
    cached = getattr(assignment, "_cached_perm_codes", None)
    if cached is not None:
        return cached
    role = assignment.role
    codes = _get_role_perm_codes(
        role.id,
        is_system_admin=getattr(role, "is_system_admin", False),
        role_code=getattr(role, "code", ""),
    )
    assignment._cached_perm_codes = codes
    return codes


def memberships_in_scope(user_account, company, permission_code):
    """Limit company members to the branches/departments of this permission's grants."""
    queryset = CompanyMembership.objects.filter(company=company)
    if is_company_admin_member(user_account, company):
        return queryset
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
    if not user_account or not company or not getattr(getattr(user_account, "auth_user", None), "is_active", False):
        return False
    perm_meta_map, _, _ = _get_perm_meta_bundle()
    perm_meta = perm_meta_map.get(permission_code)
    snap = _get_user_company_grant_snapshot(user_account, company)
    if snap["is_admin"] and (not perm_meta or _permission_meta_enabled(company, perm_meta)):
        return True
    if not snap["has_membership"]:
        return False
    if not perm_meta or not _permission_meta_enabled(company, perm_meta):
        if permission_code in ("SYS.USER.LOCK", "SYS.USER.UNLOCK", "SYS.USER.TERMINATE", "SYS.MEMBERSHIP.TERMINATE"):
            return has_effective_permission(
                user_account, company, "SYS.USER.EDIT",
                branch_id=branch_id, department_id=department_id,
                warehouse_id=warehouse_id, bank_account_id=bank_account_id,
                project_id=project_id, cost_center_id=cost_center_id,
            )
        return False
    configuration = _setting(company)
    if configuration.get("direct_user_permissions_enabled", False):
        now = timezone.now()
        perm_id = perm_meta[0]
        overrides = list(
            UserPermissionOverride.objects.filter(
                company_membership__user=user_account, company_membership__company=company,
                permission_id=perm_id, revoked_at__isnull=True, valid_from__lte=now,
            ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now)).filter(
                Q(data_scope_set__isnull=True) | Q(data_scope_set__status=ActiveStatus.ACTIVE)
            ).values_list("effect", "data_scope_set_id")
        )
        for effect, scope_id in overrides:
            if effect == "DENY" and _scope_dims_allows(
                _get_scope_dims_by_id(scope_id),
                branch_id=branch_id, department_id=department_id, warehouse_id=warehouse_id,
                bank_account_id=bank_account_id, project_id=project_id, cost_center_id=cost_center_id,
            ):
                return False
        for effect, scope_id in overrides:
            if effect == "GRANT" and _scope_dims_allows(
                _get_scope_dims_by_id(scope_id),
                branch_id=branch_id, department_id=department_id, warehouse_id=warehouse_id,
                bank_account_id=bank_account_id, project_id=project_id, cost_center_id=cost_center_id,
            ):
                return True
    for role_id, is_sys, r_code, scope_id in snap["assignments"]:
        if permission_code not in _get_role_perm_codes(role_id, is_system_admin=is_sys, role_code=r_code):
            continue
        if _scope_dims_allows(
            _get_scope_dims_by_id(scope_id),
            branch_id=branch_id, department_id=department_id, warehouse_id=warehouse_id,
            bank_account_id=bank_account_id, project_id=project_id, cost_center_id=cost_center_id,
        ):
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


def _resolve_request_company_obj(request, company_id):
    cached_company = getattr(request, "_resolved_company_obj", None)
    if cached_company is not None and (
        str(cached_company.id) == str(company_id)
        or cached_company.code.lower() == str(company_id).strip().lower()
    ):
        return cached_company
    from organization.models import Company

    try:
        company = Company.objects.get(pk=company_id)
    except (Company.DoesNotExist, ValueError, TypeError, DjangoValidationError):
        company = Company.objects.filter(code__iexact=str(company_id).strip()).first()
    if company is not None:
        request._resolved_company_obj = company
    return company


class CompanyMemberMixin:
    """Signed-in access to one company the user belongs to, named by the request."""
    permission_classes = (IsAuthenticated,)

    def _resolve_company(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        company_id = (
            request.query_params.get("company_id")
            or data.get("company_id")
            or data.get("company")
            or request.headers.get("X-Company-ID")
            or request.META.get("HTTP_X_COMPANY_ID")
        )
        if not company_id:
            raise ValidationError({"company_id": "Phải xác định doanh nghiệp làm việc (company_id)."})
        company = _resolve_request_company_obj(request, company_id)
        if not company:
            raise ValidationError({"company_id": "Doanh nghiệp không tồn tại hoặc không hợp lệ."})
        if not request.user.is_superuser:
            account = getattr(request.user, "iam_account", None)
            if not account or not _get_user_company_grant_snapshot(account, company)["has_membership"]:
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
        company = _resolve_request_company_obj(request, company_id)
        if not company:
            return False
        request._validated_company_id = str(company.id)
        account = request.user.iam_account
        snap = _get_user_company_grant_snapshot(account, company)
        if snap["is_admin"]:
            return True
        explicit_scope = any(request.query_params.get(field) for field in (
            "branch_id", "department_id", "warehouse_id", "bank_account_id",
            "project_id", "cost_center_id",
        )) or (
            isinstance(request.data, dict)
            and any(request.data.get(field) for field in ("warehouse", "branch", "department", "company_bank_account", "project", "cost_center"))
        )
        if getattr(view, "allow_scoped_list_permission", False) and not explicit_scope:
            if not snap["has_membership"]:
                return False
            if _setting(company).get("direct_user_permissions_enabled", False):
                now = timezone.now()
                if UserPermissionOverride.objects.filter(
                    company_membership__user=account,
                    company_membership__company=company, permission__code=permission_code,
                    effect="DENY", revoked_at__isnull=True, valid_from__lte=now,
                ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now)).filter(
                    Q(data_scope_set__isnull=True) | Q(data_scope_set__allow_all_company_data=True)
                ).exists():
                    return False
            return any(
                permission_code in _get_role_perm_codes(role_id, is_system_admin=is_sys, role_code=r_code)
                for role_id, is_sys, r_code, _ in snap["assignments"]
            )
        has_perm = has_effective_permission(
            account,
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
                return has_effective_permission(account, company, "SYS.USER.EDIT")
            if permission_code == "SYS.USER.VIEW_SECURITY":
                return has_effective_permission(account, company, "SYS.USER.VIEW")
        return has_perm


def get_user_allowed_branch_ids(request, company_id):
    """
    Returns None if the user has full-company access (superuser, company admin,
    or has an assignment with allow_all_company_data=True / data_scope_set=None).
    Otherwise returns a set of allowed branch UUID strings for this user in company_id.
    """
    if not request.user or not request.user.is_authenticated or getattr(request.user, "is_superuser", False):
        return None
    account = getattr(request.user, "iam_account", None)
    if not account or not company_id:
        return set()
    company = _resolve_request_company_obj(request, company_id)
    if not company:
        return set()
    snap = _get_user_company_grant_snapshot(account, company)
    if snap["is_admin"]:
        return None
    assignments = snap["assignments"]
    if not assignments:
        membership = CompanyMembership.objects.filter(
            user=account, company=company, membership_status=ActiveStatus.ACTIVE
        ).select_related("employee").first()
        if membership:
            if membership.employee_id and membership.employee.branch_id:
                return {str(membership.employee.branch_id)}
            return None
        if getattr(request.user, "is_staff", False):
            return None
        return set()
    branch_ids = set()
    for _, _, _, scope_id in assignments:
        if scope_id is None:
            return None
        dims = _get_scope_dims_by_id(scope_id)
        if dims is None or dims["allow_all"]:
            return None
        branch_ids.update(dims["branches"])
    if not branch_ids:
        membership = CompanyMembership.objects.filter(
            user=account, company=company, membership_status=ActiveStatus.ACTIVE
        ).select_related("employee").first()
        if membership and membership.employee_id and membership.employee.branch_id:
            branch_ids.add(str(membership.employee.branch_id))
    return branch_ids


def filter_queryset_by_branch(queryset, request, company_id=None, *, filter_branch_model=False):
    """
    Filters a model queryset by:
    1) explicit `branch_id` query parameter (when selected on the top taskbar), AND
    2) the user's allowed branch scope (if the user is branch-restricted, preventing cross-branch leakage).
    """
    if not hasattr(request, "query_params"):
        return queryset
    cid = company_id or request.query_params.get("company_id") or getattr(request, "_validated_company_id", None)
    raw_branch = (request.query_params.get("branch_id") or "").strip()
    explicit_branch_id = None
    if raw_branch and raw_branch.lower() not in ("all", "head-office"):
        explicit_branch_id = raw_branch
    elif raw_branch.lower() == "head-office" and cid:
        from organization.models import Branch
        hq = Branch.objects.filter(company_id=cid, is_head_office=True).values_list("id", flat=True).first()
        if hq:
            explicit_branch_id = str(hq)

    allowed_branch_ids = get_user_allowed_branch_ids(request, cid) if cid else None
    model = queryset.model
    field_names = {f.name for f in model._meta.fields}

    if explicit_branch_id:
        if allowed_branch_ids is not None and explicit_branch_id not in allowed_branch_ids:
            return queryset.none()
        try:
            if filter_branch_model and model.__name__ == "Branch":
                return queryset.filter(pk=explicit_branch_id)
            if "branch" in field_names:
                return queryset.filter(branch_id=explicit_branch_id)
            if "fund" in field_names:
                return queryset.filter(fund__branch_id=explicit_branch_id)
            if "warehouse" in field_names:
                return queryset.filter(warehouse__branch_id=explicit_branch_id)
            if model.__name__ == "AccountProfile":
                return queryset.filter(account__branch_id=explicit_branch_id)
            if model.__name__ == "BankTransaction":
                return queryset.filter(Q(account__account__branch_id=explicit_branch_id) | Q(payment_details__branch=explicit_branch_id))
            if model.__name__ == "SalesDelivery":
                return queryset.filter(order__branch_id=explicit_branch_id)
        except (ValueError, TypeError, DjangoValidationError):
            return queryset.none()

    if allowed_branch_ids is not None:
        if not allowed_branch_ids:
            return queryset.none()
        if model.__name__ == "Branch":
            return queryset.filter(pk__in=allowed_branch_ids)
        if "branch" in field_names:
            return queryset.filter(branch_id__in=allowed_branch_ids)
        if "fund" in field_names:
            return queryset.filter(fund__branch_id__in=allowed_branch_ids)
        if "warehouse" in field_names:
            return queryset.filter(warehouse__branch_id__in=allowed_branch_ids)
        if model.__name__ == "AccountProfile":
            return queryset.filter(account__branch_id__in=allowed_branch_ids)
        if model.__name__ == "BankTransaction":
            return queryset.filter(Q(account__account__branch_id__in=allowed_branch_ids) | Q(payment_details__branch__in=list(allowed_branch_ids)))
        if model.__name__ == "SalesDelivery":
            return queryset.filter(order__branch_id__in=allowed_branch_ids)

    return queryset
