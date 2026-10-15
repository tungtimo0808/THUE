import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone


class ActiveStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Đang hoạt động"
    INACTIVE = "INACTIVE", "Ngừng hoạt động"


class MembershipStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Đang tham gia"
    INACTIVE = "INACTIVE", "Tạm khóa"
    SCHEDULED_LOCK = "SCHEDULED_LOCK", "Chờ khóa theo lịch"
    LOCKED = "LOCKED", "Đang bị khóa"
    END_SCHEDULED = "END_SCHEDULED", "Chờ ngừng theo lịch"
    TERMINATED = "TERMINATED", "Đã chấm dứt"
    ENDED = "ENDED", "Đã kết thúc"
    PENDING_JOIN = "PENDING_JOIN", "Chờ tham gia lại"


class AssignmentStatus(models.TextChoices):
    SCHEDULED = "SCHEDULED", "Chờ hiệu lực"
    ACTIVE = "ACTIVE", "Đang hiệu lực"
    EXPIRED = "EXPIRED", "Hết hạn"
    REVOKED = "REVOKED", "Đã thu hồi"
    INACTIVE = "INACTIVE", "Ngừng sử dụng trước đây"


class UserAccount(models.Model):
    """Business identity attached to Django's credential-owning user."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    auth_user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="iam_account"
    )
    display_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30, blank=True)
    can_create_company = models.BooleanField(default=True)
    failed_login_count = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "iam_user_account"
        ordering = ("display_name",)

    @property
    def status(self):
        return ActiveStatus.ACTIVE if self.auth_user.is_active else ActiveStatus.INACTIVE

    def __str__(self):
        return self.display_name or self.auth_user.get_username()


class CompanyMembership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="memberships")
    user = models.ForeignKey(UserAccount, on_delete=models.PROTECT, related_name="memberships")
    employee = models.ForeignKey(
        "organization.Employee", on_delete=models.PROTECT, null=True, blank=True, related_name="memberships"
    )
    organization_unit = models.ForeignKey(
        "organization.OrganizationUnit", on_delete=models.PROTECT, null=True, blank=True,
        related_name="memberships",
    )
    membership_status = models.CharField(max_length=20, choices=MembershipStatus.choices, default=MembershipStatus.ACTIVE)
    join_source = models.CharField(max_length=20, choices=(("BOOTSTRAP", "Khởi tạo"), ("APPROVED", "Chấp thuận"), ("LEGACY", "Khác")), default="LEGACY")
    internal_display_name = models.CharField(max_length=255, blank=True)
    internal_note = models.TextField(blank=True)
    joined_at = models.DateTimeField(default=timezone.now)
    left_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(UserAccount, on_delete=models.PROTECT, related_name="created_memberships")
    updated_by = models.ForeignKey(UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="updated_memberships")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "iam_company_membership"
        constraints = [
            models.UniqueConstraint(fields=("company", "user"), name="uq_membership_company_user"),
            models.UniqueConstraint(fields=("company", "employee"), name="uq_membership_company_employee"),
            models.CheckConstraint(condition=Q(left_at__isnull=True) | Q(left_at__gte=models.F("joined_at")), name="ck_membership_dates"),
        ]

    def clean(self):
        super().clean()
        if self.employee_id and self.employee.company_id != self.company_id:
            raise ValidationError({"employee": "Nhân viên phải thuộc cùng doanh nghiệp."})
        if self.organization_unit_id and self.organization_unit.company_id != self.company_id:
            raise ValidationError({"organization_unit": "Đơn vị phải thuộc cùng doanh nghiệp."})

    @property
    def access_status(self):
        if self.membership_status in (MembershipStatus.TERMINATED, "ENDED", MembershipStatus.ENDED):
            return "ENDED"
        if self.membership_status == MembershipStatus.END_SCHEDULED:
            return "END_SCHEDULED"
        if self.membership_status in (MembershipStatus.LOCKED, MembershipStatus.INACTIVE):
            return "LOCKED"
        if self.membership_status == MembershipStatus.SCHEDULED_LOCK:
            return "SCHEDULED_LOCK"
        if self.membership_status == MembershipStatus.PENDING_JOIN:
            return "PENDING_JOIN"
        if self.user.locked_until and self.user.locked_until > timezone.now():
            return "LOCKED"
        if not self.user.auth_user.is_active:
            return "LOCKED"
        return "ACTIVE"


class OrganizationAssignment(models.Model):
    class Type(models.TextChoices):
        PRIMARY = "PRIMARY", "Đơn vị chính"
        SECONDARY = "SECONDARY", "Kiêm nhiệm"
        TEMPORARY = "TEMPORARY", "Tạm thời"

    class State(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Chờ hiệu lực"
        ACTIVE = "ACTIVE", "Đang hiệu lực"
        EXPIRED = "EXPIRED", "Hết hạn"
        REVOKED = "REVOKED", "Đã kết thúc"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    membership = models.ForeignKey(CompanyMembership, on_delete=models.PROTECT, related_name="organization_assignments")
    unit = models.ForeignKey("organization.OrganizationUnit", on_delete=models.PROTECT, related_name="user_assignments")
    assignment_type = models.CharField(max_length=20, choices=Type.choices)
    position = models.ForeignKey("organization.Position", on_delete=models.PROTECT, null=True, blank=True)
    job_title = models.CharField(max_length=150, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=State.choices)
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(UserAccount, on_delete=models.PROTECT, related_name="created_organization_assignments")
    updated_by = models.ForeignKey(UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="updated_organization_assignments")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "iam_organization_assignment"
        ordering = ("-start_date", "-created_at")
        indexes = [models.Index(fields=("membership", "status", "start_date"), name="ix_org_asg_member_state")]
        constraints = [models.CheckConstraint(
            condition=Q(end_date__isnull=True) | Q(end_date__gte=models.F("start_date")),
            name="ck_org_asg_dates",
        )]


class RoleType(models.TextChoices):
    STANDARD = "STANDARD", "Chuẩn"
    CUSTOM = "CUSTOM", "Tùy chỉnh"


class RoleStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Có sẵn"
    ACTIVE = "ACTIVE", "Đang hoạt động"
    INACTIVE = "INACTIVE", "Ngừng hoạt động"


class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="roles")
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=255)
    role_type = models.CharField(max_length=20, choices=RoleType.choices, default=RoleType.CUSTOM)
    status = models.CharField(max_length=20, choices=RoleStatus.choices, default=RoleStatus.ACTIVE)
    description = models.CharField(max_length=500, blank=True)
    is_system_admin = models.BooleanField(default=False)
    source_role = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="copied_roles")
    created_by = models.ForeignKey(UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="created_roles")
    updated_by = models.ForeignKey(UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="updated_roles")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "iam_role"
        ordering = ("company_id", "code")
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_role_company_code"),
            models.UniqueConstraint(fields=("company", "name"), name="uq_role_company_name"),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def clean(self):
        super().clean()
        if self.source_role_id and self.source_role.company_id != self.company_id:
            raise ValidationError({"source_role": "Role nguồn phải thuộc cùng doanh nghiệp."})


class PermissionResource(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)
    module_code = models.CharField(max_length=30)
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=ActiveStatus.choices, default=ActiveStatus.ACTIVE)

    class Meta:
        db_table = "iam_permission_resource"
        ordering = ("module_code", "code")


class PermissionAction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150)
    risk_level = models.CharField(max_length=20, default="NORMAL")

    class Meta:
        db_table = "iam_permission_action"
        ordering = ("code",)


class Permission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resource = models.ForeignKey(PermissionResource, on_delete=models.PROTECT, related_name="permissions")
    action = models.ForeignKey(PermissionAction, on_delete=models.PROTECT, related_name="permissions")
    code = models.CharField(max_length=160, unique=True)
    description = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=ActiveStatus.choices, default=ActiveStatus.ACTIVE)

    class Meta:
        db_table = "iam_permission"
        ordering = ("code",)
        constraints = [models.UniqueConstraint(fields=("resource", "action"), name="uq_permission_resource_action")]


class PermissionBundle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=255)
    module_code = models.CharField(max_length=30)
    description = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=ActiveStatus.choices, default=ActiveStatus.ACTIVE)
    permissions = models.ManyToManyField(Permission, through="PermissionBundleItem", related_name="bundles")

    class Meta:
        db_table = "iam_permission_bundle"
        ordering = ("module_code", "code")


class PermissionBundleItem(models.Model):
    bundle = models.ForeignKey(PermissionBundle, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.PROTECT)

    class Meta:
        db_table = "iam_permission_bundle_item"
        constraints = [models.UniqueConstraint(fields=("bundle", "permission"), name="pk_permission_bundle_item")]


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.PROTECT, related_name="role_permissions")
    effect = models.CharField(max_length=10, default="ALLOW")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "iam_role_permission"
        constraints = [models.UniqueConstraint(fields=("role", "permission"), name="pk_role_permission")]


class RolePermissionBundle(models.Model):
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="role_bundles")
    bundle = models.ForeignKey(PermissionBundle, on_delete=models.PROTECT, related_name="role_bundles")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "iam_role_permission_bundle"
        constraints = [models.UniqueConstraint(fields=("role", "bundle"), name="pk_role_permission_bundle")]


class DataScopeSet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="data_scope_sets")
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=255)
    allow_all_company_data = models.BooleanField(default=False)
    allow_owned_records = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=ActiveStatus.choices, default=ActiveStatus.ACTIVE)
    created_by = models.ForeignKey(UserAccount, on_delete=models.PROTECT, related_name="created_scope_sets")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "iam_data_scope_set"
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_scope_company_code")]


class DataScopeBranch(models.Model):
    data_scope_set = models.ForeignKey(DataScopeSet, on_delete=models.CASCADE, related_name="branch_scopes")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, related_name="data_scopes")
    include_descendants = models.BooleanField(default=False)

    class Meta:
        db_table = "iam_data_scope_branch"
        constraints = [models.UniqueConstraint(fields=("data_scope_set", "branch"), name="pk_data_scope_branch")]

    def clean(self):
        if self.data_scope_set_id and self.branch_id and self.data_scope_set.company_id != self.branch.company_id:
            raise ValidationError({"branch": "Chi nhánh phải thuộc doanh nghiệp của Data Scope."})


class DataScopeDepartment(models.Model):
    data_scope_set = models.ForeignKey(DataScopeSet, on_delete=models.CASCADE, related_name="department_scopes")
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, related_name="data_scopes")
    include_descendants = models.BooleanField(default=False)

    class Meta:
        db_table = "iam_data_scope_department"
        constraints = [models.UniqueConstraint(fields=("data_scope_set", "department"), name="pk_data_scope_department")]

    def clean(self):
        if self.data_scope_set_id and self.department_id and self.data_scope_set.company_id != self.department.company_id:
            raise ValidationError({"department": "Phòng ban phải thuộc doanh nghiệp của Data Scope."})


class DataScopeWarehouse(models.Model):
    data_scope_set = models.ForeignKey(DataScopeSet, on_delete=models.CASCADE, related_name="warehouse_scopes")
    warehouse = models.ForeignKey("master_data.Warehouse", on_delete=models.PROTECT, related_name="data_scopes")

    class Meta:
        db_table = "iam_data_scope_warehouse"
        constraints = [models.UniqueConstraint(fields=("data_scope_set", "warehouse"), name="pk_data_scope_warehouse")]

    def clean(self):
        if self.data_scope_set_id and self.warehouse_id and self.data_scope_set.company_id != self.warehouse.company_id:
            raise ValidationError({"warehouse": "Kho phải thuộc doanh nghiệp của Data Scope."})


class DataScopeBankAccount(models.Model):
    data_scope_set = models.ForeignKey(DataScopeSet, on_delete=models.CASCADE, related_name="bank_account_scopes")
    company_bank_account = models.ForeignKey("master_data.CompanyBankAccount", on_delete=models.PROTECT, related_name="data_scopes")

    class Meta:
        db_table = "iam_data_scope_bank_account"
        constraints = [models.UniqueConstraint(fields=("data_scope_set", "company_bank_account"), name="pk_data_scope_bank_account")]

    def clean(self):
        if self.data_scope_set_id and self.company_bank_account_id and self.data_scope_set.company_id != self.company_bank_account.company_id:
            raise ValidationError({"company_bank_account": "Tài khoản ngân hàng phải thuộc doanh nghiệp của Data Scope."})


class DataScopeProject(models.Model):
    data_scope_set = models.ForeignKey(DataScopeSet, on_delete=models.CASCADE, related_name="project_scopes")
    project = models.ForeignKey("master_data.Project", on_delete=models.PROTECT, related_name="data_scopes")

    class Meta:
        db_table = "iam_data_scope_project"
        constraints = [models.UniqueConstraint(fields=("data_scope_set", "project"), name="pk_data_scope_project")]

    def clean(self):
        if self.data_scope_set_id and self.project_id and self.data_scope_set.company_id != self.project.company_id:
            raise ValidationError({"project": "Dự án phải thuộc doanh nghiệp của Data Scope."})


class DataScopeCostCenter(models.Model):
    data_scope_set = models.ForeignKey(DataScopeSet, on_delete=models.CASCADE, related_name="cost_center_scopes")
    cost_center = models.ForeignKey("master_data.CostCenter", on_delete=models.PROTECT, related_name="data_scopes")

    class Meta:
        db_table = "iam_data_scope_cost_center"
        constraints = [models.UniqueConstraint(fields=("data_scope_set", "cost_center"), name="pk_data_scope_cost_center")]

    def clean(self):
        if self.data_scope_set_id and self.cost_center_id and self.data_scope_set.company_id != self.cost_center.company_id:
            raise ValidationError({"cost_center": "Trung tâm chi phí phải thuộc doanh nghiệp của Data Scope."})


class UserRoleAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_membership = models.ForeignKey(CompanyMembership, on_delete=models.PROTECT, related_name="role_assignments")
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="user_assignments")
    data_scope_set = models.ForeignKey(DataScopeSet, on_delete=models.PROTECT, null=True, blank=True, related_name="role_assignments")
    valid_from = models.DateTimeField(default=timezone.now)
    valid_to = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=AssignmentStatus.choices, default=AssignmentStatus.ACTIVE)
    assigned_by = models.ForeignKey(UserAccount, on_delete=models.PROTECT, related_name="assigned_roles")
    assigned_at = models.DateTimeField(auto_now_add=True)
    revoked_by = models.ForeignKey(UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="revoked_roles")
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoke_reason = models.CharField(max_length=500, blank=True)
    assign_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "iam_user_role_assignment"
        ordering = ("company_membership_id", "-valid_from")
        constraints = [
            models.UniqueConstraint(fields=("company_membership", "role", "valid_from"), name="uq_role_assignment_version"),
            models.CheckConstraint(condition=Q(valid_to__isnull=True) | Q(valid_to__gte=models.F("valid_from")), name="ck_role_assignment_validity"),
        ]

    def clean(self):
        super().clean()
        errors = {}
        company_id = self.company_membership.company_id if self.company_membership_id else None
        if self.role_id and self.role.company_id != company_id:
            errors["role"] = "Role phải thuộc doanh nghiệp của Membership."
        if self.role_id and self.role.status != RoleStatus.ACTIVE:
            errors["role"] = "Chỉ Role ACTIVE mới được gán."
        if self.data_scope_set_id and self.data_scope_set.company_id != company_id:
            errors["data_scope_set"] = "Data Scope phải thuộc cùng doanh nghiệp."
        if self.company_membership_id and self.company_membership.membership_status != ActiveStatus.ACTIVE:
            errors["company_membership"] = "Membership không hoạt động."
        if errors:
            raise ValidationError(errors)


class UserPermissionOverride(models.Model):
    class Effect(models.TextChoices):
        GRANT = "GRANT", "Cấp"
        DENY = "DENY", "Từ chối"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_membership = models.ForeignKey(CompanyMembership, on_delete=models.PROTECT, related_name="permission_overrides")
    permission = models.ForeignKey(Permission, on_delete=models.PROTECT, related_name="user_overrides")
    data_scope_set = models.ForeignKey(DataScopeSet, on_delete=models.PROTECT, null=True, blank=True, related_name="user_overrides")
    effect = models.CharField(max_length=10, choices=Effect.choices)
    reason = models.CharField(max_length=1000)
    valid_from = models.DateTimeField(default=timezone.now)
    valid_to = models.DateTimeField(null=True, blank=True)
    assigned_by = models.ForeignKey(UserAccount, on_delete=models.PROTECT, related_name="assigned_permission_overrides")
    assigned_at = models.DateTimeField(auto_now_add=True)
    revoked_by = models.ForeignKey(UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="revoked_permission_overrides")
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "iam_user_permission_override"
        indexes = [models.Index(fields=("company_membership", "permission", "effect"), name="ix_iam_user_perm_override")]
        constraints = [models.CheckConstraint(
            condition=Q(valid_to__isnull=True) | Q(valid_to__gte=models.F("valid_from")),
            name="ck_user_permission_override_dates",
        )]

    def clean(self):
        super().clean()
        errors = {}
        if self.data_scope_set_id and self.company_membership_id and self.data_scope_set.company_id != self.company_membership.company_id:
            errors["data_scope_set"] = "Data Scope phải thuộc cùng doanh nghiệp."
        if self.permission_id and self.permission.status != ActiveStatus.ACTIVE:
            errors["permission"] = "Permission không còn hoạt động."
        if errors:
            raise ValidationError(errors)


class LockScope(models.TextChoices):
    COMPANY_ACCESS = "COMPANY_ACCESS", "Khóa truy cập doanh nghiệp"
    GLOBAL_ACCOUNT = "GLOBAL_ACCOUNT", "Khóa tài khoản toàn hệ thống"
    SECURITY_LOCK = "SECURITY_LOCK", "Tự động khóa bảo mật"


class LockType(models.TextChoices):
    MANUAL = "MANUAL", "Thủ công"
    TEMPORARY = "TEMPORARY", "Tạm thời"
    SCHEDULED = "SCHEDULED", "Theo lịch"
    SECURITY = "SECURITY", "Bảo mật"
    SYSTEM = "SYSTEM", "Hệ thống"


class TaskHandlingOption(models.TextChoices):
    KEEP = "KEEP", "Giữ nguyên"
    TRANSFER = "TRANSFER", "Chuyển người thay thế"
    FALLBACK = "FALLBACK", "Theo cấu hình Fallback"
    UNASSIGNED = "UNASSIGNED", "Đưa về chưa phân công"


class LockRecordStatus(models.TextChoices):
    PENDING = "PENDING", "Chờ hiệu lực"
    ACTIVE = "ACTIVE", "Đang hiệu lực"
    RELEASED = "RELEASED", "Đã mở khóa"
    CANCELLED = "CANCELLED", "Đã hủy"
    EXPIRED = "EXPIRED", "Hết hạn"


class UserLockRecord(models.Model):
    """Bản ghi chi tiết các sự kiện khóa và mở khóa User (UC-SYS-17)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company", on_delete=models.PROTECT, null=True, blank=True, related_name="user_lock_records"
    )
    membership = models.ForeignKey(
        CompanyMembership, on_delete=models.PROTECT, null=True, blank=True, related_name="lock_records"
    )
    user = models.ForeignKey(
        UserAccount, on_delete=models.PROTECT, related_name="lock_records"
    )
    lock_scope = models.CharField(
        max_length=30, choices=LockScope.choices, default=LockScope.COMPANY_ACCESS
    )
    lock_type = models.CharField(
        max_length=30, choices=LockType.choices, default=LockType.MANUAL
    )
    lock_reason = models.TextField()
    start_time = models.DateTimeField(default=timezone.now)
    auto_unlock_at = models.DateTimeField(null=True, blank=True)
    task_handling = models.CharField(
        max_length=20, choices=TaskHandlingOption.choices, default=TaskHandlingOption.KEEP
    )
    substitute_user = models.ForeignKey(
        UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="substitute_lock_records"
    )
    notify_user = models.BooleanField(default=True)
    status = models.CharField(
        max_length=20, choices=LockRecordStatus.choices, default=LockRecordStatus.ACTIVE
    )
    locked_by = models.ForeignKey(
        UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="created_user_locks"
    )
    locked_at = models.DateTimeField(auto_now_add=True)
    unlock_reason = models.TextField(blank=True)
    unlocked_by = models.ForeignKey(
        UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="released_user_locks"
    )
    unlocked_at = models.DateTimeField(null=True, blank=True)
    require_password_change = models.BooleanField(default=False)
    require_mfa = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "iam_user_lock_record"
        ordering = ("-locked_at",)
        indexes = [
            models.Index(fields=("company", "status", "start_time"), name="ix_user_lock_comp_status"),
            models.Index(fields=("user", "status"), name="ix_user_lock_user_status"),
        ]

    def __str__(self):
        return f"{self.user} - {self.lock_scope} - {self.status}"


class TerminationType(models.TextChoices):
    IMMEDIATE = "IMMEDIATE", "Ngừng ngay"
    SCHEDULED = "SCHEDULED", "Theo lịch"
    VOLUNTARY = "VOLUNTARY", "Tự nguyện rời"
    ADMINISTRATIVE = "ADMINISTRATIVE", "Quyết định quản trị"
    SECURITY = "SECURITY", "Bảo mật / Vi phạm"
    CONTRACT_END = "CONTRACT_END", "Hết hạn hợp đồng"


class DraftHandlingOption(models.TextChoices):
    KEEP = "KEEP", "Giữ nguyên"
    TRANSFER = "TRANSFER", "Chuyển người phụ trách"
    CANCEL = "CANCEL", "Hủy hợp lệ"


class JobHandlingOption(models.TextChoices):
    SYSTEM_CONTINUE = "SYSTEM_CONTINUE", "Tiếp tục dưới danh nghĩa System"
    CANCEL = "CANCEL", "Tạm dừng hoặc hủy an toàn"


class TerminationRecordStatus(models.TextChoices):
    PENDING = "PENDING", "Chờ hiệu lực"
    COMPLETED = "COMPLETED", "Đã hoàn tất"
    CANCELLED = "CANCELLED", "Đã hủy"


class MembershipTerminationRecord(models.Model):
    """Bản ghi chi tiết chấm dứt quyền tham gia doanh nghiệp (UC-SYS-18)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company", on_delete=models.PROTECT, related_name="membership_terminations"
    )
    membership = models.ForeignKey(
        CompanyMembership, on_delete=models.PROTECT, related_name="termination_records"
    )
    user = models.ForeignKey(
        UserAccount, on_delete=models.PROTECT, related_name="membership_terminations"
    )
    termination_type = models.CharField(
        max_length=30, choices=TerminationType.choices, default=TerminationType.ADMINISTRATIVE
    )
    status = models.CharField(
        max_length=20, choices=TerminationRecordStatus.choices, default=TerminationRecordStatus.COMPLETED
    )
    reason = models.TextField()
    note = models.TextField(blank=True)
    effective_at = models.DateTimeField()
    substitute_user = models.ForeignKey(
        UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="received_terminations"
    )
    task_handling = models.CharField(
        max_length=30, choices=TaskHandlingOption.choices, default=TaskHandlingOption.KEEP
    )
    draft_handling = models.CharField(
        max_length=30, choices=DraftHandlingOption.choices, default=DraftHandlingOption.KEEP
    )
    job_handling = models.CharField(
        max_length=30, choices=JobHandlingOption.choices, default=JobHandlingOption.SYSTEM_CONTINUE
    )
    notify_user = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="created_terminations"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="cancelled_terminations"
    )
    cancellation_reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "iam_membership_termination_record"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("company", "status", "effective_at"), name="ix_mem_term_comp_status"),
            models.Index(fields=("user", "company"), name="ix_mem_term_user_comp"),
        ]

    def __str__(self):
        return f"{self.user} - {self.company} - {self.termination_type} - {self.status}"


class ExitRequestStatus(models.TextChoices):
    PENDING = "PENDING", "Chờ xử lý"
    APPROVED = "APPROVED", "Đã chấp thuận"
    REJECTED = "REJECTED", "Đã từ chối"
    CANCELLED = "CANCELLED", "Đã hủy"


class MembershipExitRequest(models.Model):
    """Yêu cầu rời doanh nghiệp do User chủ động khởi tạo (UC-SYS-18 Main Flow 2.2)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        "organization.Company", on_delete=models.PROTECT, related_name="membership_exit_requests"
    )
    membership = models.ForeignKey(
        CompanyMembership, on_delete=models.PROTECT, related_name="exit_requests"
    )
    user = models.ForeignKey(
        UserAccount, on_delete=models.PROTECT, related_name="membership_exit_requests"
    )
    reason = models.TextField()
    desired_effective_date = models.DateTimeField()
    note = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=ExitRequestStatus.choices, default=ExitRequestStatus.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_by = models.ForeignKey(
        UserAccount, on_delete=models.PROTECT, null=True, blank=True, related_name="processed_exit_requests"
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    termination_record = models.ForeignKey(
        MembershipTerminationRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name="exit_requests"
    )

    class Meta:
        db_table = "iam_membership_exit_request"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("company", "status", "created_at"), name="ix_exit_req_comp_status"),
            models.Index(fields=("user", "status"), name="ix_exit_req_user_status"),
        ]

    def __str__(self):
        return f"{self.user} - {self.company} - {self.status}"
