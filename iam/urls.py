from rest_framework.routers import DefaultRouter
from .organization_assignment_views import OrganizationAssignmentViewSet

from .views import (
    CompanyMembershipViewSet,
    DataScopeBranchViewSet,
    DataScopeDepartmentViewSet,
    DataScopeWarehouseViewSet,
    DataScopeBankAccountViewSet,
    DataScopeProjectViewSet,
    DataScopeCostCenterViewSet,
    DataScopeSetViewSet,
    PermissionActionViewSet,
    PermissionBundleViewSet,
    PermissionResourceViewSet,
    PermissionViewSet,
    RolePermissionBundleViewSet,
    RolePermissionViewSet,
    RoleViewSet,
    UserAccountViewSet,
    UserLockRecordViewSet,
    MembershipTerminationRecordViewSet,
    MembershipExitRequestViewSet,
    UserRoleAssignmentViewSet,
    UserPermissionOverrideViewSet,
    EffectivePermissionViewSet,
)

router = DefaultRouter()
router.register("users", UserAccountViewSet, basename="iam-user")
router.register("user-locks", UserLockRecordViewSet, basename="user-lock")
router.register("membership-terminations", MembershipTerminationRecordViewSet, basename="membership-termination")
router.register("membership-exit-requests", MembershipExitRequestViewSet, basename="membership-exit-request")
router.register("organization-assignments", OrganizationAssignmentViewSet, basename="organization-assignment")
router.register("memberships", CompanyMembershipViewSet, basename="company-membership")
router.register("roles", RoleViewSet, basename="role")
router.register("permission-resources", PermissionResourceViewSet, basename="permission-resource")
router.register("permission-actions", PermissionActionViewSet, basename="permission-action")
router.register("permissions", PermissionViewSet, basename="permission")
router.register("permission-bundles", PermissionBundleViewSet, basename="permission-bundle")
router.register("role-permissions", RolePermissionViewSet, basename="role-permission")
router.register("role-permission-bundles", RolePermissionBundleViewSet, basename="role-permission-bundle")
router.register("data-scopes", DataScopeSetViewSet, basename="data-scope")
router.register("data-scope-branches", DataScopeBranchViewSet, basename="data-scope-branch")
router.register("data-scope-departments", DataScopeDepartmentViewSet, basename="data-scope-department")
router.register("data-scope-warehouses", DataScopeWarehouseViewSet, basename="data-scope-warehouse")
router.register("data-scope-bank-accounts", DataScopeBankAccountViewSet, basename="data-scope-bank-account")
router.register("data-scope-projects", DataScopeProjectViewSet, basename="data-scope-project")
router.register("data-scope-cost-centers", DataScopeCostCenterViewSet, basename="data-scope-cost-center")
router.register("role-assignments", UserRoleAssignmentViewSet, basename="role-assignment")
router.register("permission-overrides", UserPermissionOverrideViewSet, basename="permission-override")
router.register("effective-permissions", EffectivePermissionViewSet, basename="effective-permission")

urlpatterns = router.urls
