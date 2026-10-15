from django.contrib import admin

from .models import (
    CompanyMembership,
    DataScopeBranch,
    DataScopeDepartment,
    DataScopeWarehouse,
    DataScopeBankAccount,
    DataScopeProject,
    DataScopeCostCenter,
    DataScopeSet,
    Permission,
    PermissionAction,
    PermissionBundle,
    Role,
    RolePermission,
    RolePermissionBundle,
    UserAccount,
    UserLockRecord,
    MembershipTerminationRecord,
    MembershipExitRequest,
    UserRoleAssignment,
)

admin.site.register(UserAccount)
admin.site.register(CompanyMembership)
admin.site.register(UserLockRecord)
admin.site.register(MembershipTerminationRecord)
admin.site.register(MembershipExitRequest)
admin.site.register(Role)
admin.site.register(PermissionAction)
admin.site.register(Permission)
admin.site.register(PermissionBundle)
admin.site.register(RolePermission)
admin.site.register(RolePermissionBundle)
admin.site.register(DataScopeSet)
admin.site.register(DataScopeBranch)
admin.site.register(DataScopeDepartment)
admin.site.register(DataScopeWarehouse)
admin.site.register(DataScopeBankAccount)
admin.site.register(DataScopeProject)
admin.site.register(DataScopeCostCenter)
admin.site.register(UserRoleAssignment)
