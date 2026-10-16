from datetime import datetime

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers
from django.utils import timezone
from organization.models import Employee
from .permissions import assignment_permission_codes, effective_assignments, has_effective_permission

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
    PermissionBundleItem,
    PermissionResource,
    Role,
    RolePermission,
    RolePermissionBundle,
    RoleStatus,
    UserAccount,
    UserRoleAssignment,
)


class ModelValidationMixin:
    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance or self.Meta.model()
        for name, value in attrs.items():
            setattr(instance, name, value)
        try:
            read_only = set(getattr(self.Meta, "read_only_fields", ()))
            instance.full_clean(exclude=[
                field.name for field in instance._meta.fields
                if field.name in read_only or (field.null and field.name not in attrs)
            ])
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs


class UserAccountSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="auth_user.username")
    email = serializers.EmailField(source="auth_user.email")
    is_active = serializers.BooleanField(source="auth_user.is_active", default=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    company = serializers.UUIDField(write_only=True, required=True)

    class Meta:
        model = UserAccount
        fields = (
            "id", "username", "email", "display_name", "phone", "is_active", "can_create_company", "password",
            "company", "failed_login_count", "locked_until", "password_changed_at", "created_at", "updated_at",
        )
        read_only_fields = ("id", "failed_login_count", "locked_until", "password_changed_at", "created_at", "updated_at")

    def validate(self, attrs):
        auth_data = attrs.get("auth_user", {})
        user_queryset = get_user_model().objects.all()
        if self.instance:
            user_queryset = user_queryset.exclude(pk=self.instance.auth_user_id)
        if "username" in auth_data and user_queryset.filter(username__iexact=auth_data["username"]).exists():
            raise serializers.ValidationError({"username": "Tên đăng nhập đã tồn tại."})
        if auth_data.get("email") and user_queryset.filter(email__iexact=auth_data["email"]).exists():
            raise serializers.ValidationError({"email": "Email đã tồn tại."})
        request = self.context.get("request")
        if self.instance and auth_data.get("is_active") is False and request and request.user.pk == self.instance.auth_user_id:
            raise serializers.ValidationError({"is_active": "Không thể tự ngừng tài khoản đang sử dụng."})
        if self.instance and auth_data.get("is_active") is False:
            from .permissions import has_other_effective_system_admin

            for membership in self.instance.memberships.select_related("company"):
                owns_admin_role = membership.role_assignments.filter(
                    role__is_system_admin=True, role__status="ACTIVE", status="ACTIVE"
                ).exists()
                if owns_admin_role and not has_other_effective_system_admin(
                    membership.company, excluded_user=self.instance
                ):
                    raise serializers.ValidationError({"is_active": "Không thể ngừng User quản trị cuối cùng của doanh nghiệp."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        from organization.models import Company

        auth_data = validated_data.pop("auth_user")
        password = validated_data.pop("password", None)
        company_id = validated_data.pop("company", None)
        user = get_user_model().objects.create_user(password=password, **auth_data)
        account = user.iam_account
        for name, value in validated_data.items():
            setattr(account, name, value)
        account.save()
        if company_id:
            actor = self.context["request"].user.iam_account
            CompanyMembership.objects.create(
                company=Company.objects.get(pk=company_id), user=account, created_by=actor
            )
        return account

    @transaction.atomic
    def update(self, instance, validated_data):
        auth_data = validated_data.pop("auth_user", {})
        password = validated_data.pop("password", None)
        validated_data.pop("company", None)
        user = instance.auth_user
        was_active = user.is_active
        for name, value in auth_data.items():
            setattr(user, name, value)
        if password:
            user.set_password(password)
            from django.utils import timezone

            instance.password_changed_at = timezone.now()
        user.save()
        for name, value in validated_data.items():
            setattr(instance, name, value)
        instance.save()
        if was_active and not user.is_active:
            from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)
        return instance


class CompanyUserAccountReadSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="auth_user.email", read_only=True)

    class Meta:
        model = UserAccount
        fields = ("id", "display_name", "email", "phone")
        read_only_fields = fields


class CompanyMembershipSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = CompanyMembership
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at", "updated_at")


class CompanyUserSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    full_name = serializers.CharField(source="user.display_name", read_only=True)
    email = serializers.EmailField(source="user.auth_user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True, allow_null=True)
    employee_branch_name = serializers.CharField(source="employee.branch.name", read_only=True, allow_null=True)
    employee_department_name = serializers.CharField(source="employee.department.name", read_only=True, allow_null=True)
    organization_unit_name = serializers.CharField(source="organization_unit.name", read_only=True, allow_null=True)
    internal_note = serializers.SerializerMethodField()
    role_assignments = serializers.SerializerMethodField()
    effective_permissions = serializers.SerializerMethodField()
    account_status = serializers.SerializerMethodField()
    last_login = serializers.SerializerMethodField()
    can_update = serializers.SerializerMethodField()
    access_status = serializers.SerializerMethodField()
    active_lock = serializers.SerializerMethodField()

    class Meta:
        model = CompanyMembership
        fields = (
            "id", "company", "user_id", "full_name", "email", "phone",
            "account_status", "access_status", "active_lock", "last_login", "membership_status", "joined_at", "left_at",
            "join_source", "internal_display_name", "internal_note", "employee", "employee_code",
            "employee_branch_name", "employee_department_name", "organization_unit", "organization_unit_name",
            "role_assignments", "effective_permissions", "can_update",
            "created_by", "created_at", "updated_by", "updated_at",
        )
        read_only_fields = fields

    def _assignments(self, obj):
        cache = self.context.setdefault("_membership_assignments", {})
        if obj.pk not in cache:
            cache[obj.pk] = list(effective_assignments(obj.user, obj.company))
        return cache[obj.pk]

    def get_role_assignments(self, obj) -> list[dict]:
        return [
            {"id": str(a.pk), "role_id": str(a.role_id), "role_code": a.role.code,
             "role_name": a.role.name, "data_scope_set_id": str(a.data_scope_set_id) if a.data_scope_set_id else None,
             "data_scope_set_name": a.data_scope_set.name if a.data_scope_set_id else None}
            for a in self._assignments(obj)
        ]

    def get_effective_permissions(self, obj) -> list[str]:
        return sorted(set().union(*(assignment_permission_codes(a) for a in self._assignments(obj))))

    def _can_view_security(self, obj):
        request = self.context.get("request")
        return bool(request and (request.user.is_superuser or has_effective_permission(
            request.user.iam_account, obj.company, "SYS.USER.VIEW_SECURITY",
            branch_id=obj.employee.branch_id if obj.employee_id else None,
            department_id=obj.employee.department_id if obj.employee_id else None,
        )))

    def get_account_status(self, obj) -> str | None:
        if not self._can_view_security(obj):
            return None
        if not obj.user.auth_user.is_active:
            return "INACTIVE"
        if obj.user.locked_until and obj.user.locked_until > timezone.now():
            return "LOCKED"
        preference = getattr(obj.user, "preference", None)
        return "ACTIVE" if preference and preference.email_verified_at else "PENDING_VERIFICATION"

    def get_access_status(self, obj) -> str:
        return obj.access_status

    def get_active_lock(self, obj) -> dict | None:
        from .models import LockRecordStatus
        lock = obj.lock_records.filter(status__in=(LockRecordStatus.ACTIVE, LockRecordStatus.PENDING)).first()
        if not lock:
            return None
        return {
            "id": str(lock.id),
            "lock_scope": lock.lock_scope,
            "lock_type": lock.lock_type,
            "lock_reason": lock.lock_reason,
            "start_time": lock.start_time,
            "auto_unlock_at": lock.auto_unlock_at,
            "task_handling": lock.task_handling,
            "status": lock.status,
            "locked_at": lock.locked_at,
            "locked_by_name": lock.locked_by.display_name if lock.locked_by else "Hệ thống",
        }

    def get_last_login(self, obj) -> datetime | None:
        return obj.user.auth_user.last_login if self._can_view_security(obj) else None

    def get_internal_note(self, obj) -> str | None:
        request = self.context.get("request")
        if request and (request.user.is_superuser or has_effective_permission(
            request.user.iam_account, obj.company, "SYS.USER.EDIT",
            branch_id=obj.employee.branch_id if obj.employee_id else None,
            department_id=obj.employee.department_id if obj.employee_id else None,
        )):
            return obj.internal_note
        return None

    def get_can_update(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and obj.membership_status != "TERMINATED" and obj.company.status == "ACTIVE"
                    and (request.user.is_superuser or has_effective_permission(
                        request.user.iam_account, obj.company, "SYS.USER.EDIT",
                        branch_id=obj.employee.branch_id if obj.employee_id else None,
                        department_id=obj.employee.department_id if obj.employee_id else None,
                    )))


class CompanyUserUpdateSerializer(serializers.Serializer):
    version = serializers.DateTimeField()
    internal_display_name = serializers.CharField(max_length=255, allow_blank=True, required=False)
    internal_note = serializers.CharField(max_length=2000, allow_blank=True, required=False)
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all(), allow_null=True, required=False)
    confirm_unlink = serializers.BooleanField(default=False)

    def validate(self, attrs):
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({field: "Trường này không được sửa tại UC-SYS-05." for field in sorted(unknown)})
        if not any(key in attrs for key in ("internal_display_name", "internal_note", "employee")):
            raise serializers.ValidationError("Cần có ít nhất một thông tin thay đổi.")
        return attrs


class RoleSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_code(self, value):
        value = value.upper().strip()
        if self.instance and self.instance.code != value and self.instance.user_assignments.exists():
            raise serializers.ValidationError("Không thể đổi mã Role đã được sử dụng.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and self.instance.is_system_admin and attrs.get("status") == RoleStatus.INACTIVE:
            from .permissions import has_other_effective_system_admin

            if self.instance.user_assignments.filter(status="ACTIVE").exists() and not has_other_effective_system_admin(
                self.instance.company, excluded_role=self.instance
            ):
                raise serializers.ValidationError({"status": "Không thể ngừng Role quản trị cuối cùng của doanh nghiệp."})
        return attrs


class RoleReadSerializer(serializers.ModelSerializer):
    permission_codes = serializers.SerializerMethodField()
    permission_count = serializers.SerializerMethodField()
    active_user_count = serializers.SerializerMethodField()
    role_class = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = (
            "id", "company", "code", "name", "description", "role_type", "role_class",
            "is_system_admin", "source_role", "status", "permission_codes", "permission_count",
            "active_user_count", "created_by", "created_at", "updated_by", "updated_at",
        )
        read_only_fields = fields

    def get_permission_codes(self, obj) -> list[str]:
        codes = set(obj.role_permissions.filter(
            effect="ALLOW", permission__status="ACTIVE", permission__resource__status="ACTIVE",
        ).values_list("permission__code", flat=True))
        for item in obj.role_bundles.filter(bundle__status="ACTIVE"):
            codes.update(item.bundle.permissionbundleitem_set.filter(
                permission__status="ACTIVE", permission__resource__status="ACTIVE",
            ).values_list("permission__code", flat=True))
        return sorted(codes)

    def get_permission_count(self, obj) -> int:
        return len(self.get_permission_codes(obj))

    def get_active_user_count(self, obj) -> int:
        now = timezone.now()
        return obj.user_assignments.filter(
            company_membership__membership_status="ACTIVE",
            company_membership__user__auth_user__is_active=True,
            status="ACTIVE", valid_from__lte=now,
        ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now)).values(
            "company_membership__user_id"
        ).distinct().count()

    def get_role_class(self, obj) -> str:
        return "SYSTEM" if obj.role_type == "STANDARD" or obj.is_system_admin else "COMPANY"


class StrictRoleInputSerializer(serializers.Serializer):
    def validate(self, attrs):
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({field: "Trường này không được sửa tại UC-SYS-06." for field in sorted(unknown)})
        return attrs


class RoleCreateSerializer(StrictRoleInputSerializer):
    code = serializers.CharField(max_length=80)
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(max_length=500, allow_blank=True, required=False)


class RoleUpdateSerializer(StrictRoleInputSerializer):
    version = serializers.DateTimeField()
    code = serializers.CharField(max_length=80, required=False)
    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(max_length=500, allow_blank=True, required=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if not any(field in attrs for field in ("code", "name", "description")):
            raise serializers.ValidationError("Cần có ít nhất một thông tin thay đổi.")
        return attrs


class RoleCloneSerializer(RoleCreateSerializer):
    version = serializers.DateTimeField()


class RoleStateSerializer(StrictRoleInputSerializer):
    version = serializers.DateTimeField()
    confirm = serializers.BooleanField()

    def validate_confirm(self, value):
        if not value:
            raise serializers.ValidationError("Cần xác nhận thay đổi trạng thái Role.")
        return value


class PermissionResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PermissionResource
        fields = "__all__"


class PermissionActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PermissionAction
        fields = "__all__"


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = "__all__"


class PermissionBundleSerializer(serializers.ModelSerializer):
    permission_ids = serializers.PrimaryKeyRelatedField(
        source="permissions", many=True, queryset=Permission.objects.all(), required=False
    )

    class Meta:
        model = PermissionBundle
        fields = ("id", "code", "name", "module_code", "description", "status", "permission_ids")

    def create(self, validated_data):
        permissions = validated_data.pop("permissions", [])
        bundle = super().create(validated_data)
        PermissionBundleItem.objects.bulk_create(
            [PermissionBundleItem(bundle=bundle, permission=item) for item in permissions]
        )
        return bundle

    def update(self, instance, validated_data):
        permissions = validated_data.pop("permissions", None)
        instance = super().update(instance, validated_data)
        if permissions is not None:
            PermissionBundleItem.objects.filter(bundle=instance).delete()
            PermissionBundleItem.objects.bulk_create(
                [PermissionBundleItem(bundle=instance, permission=item) for item in permissions]
            )
        return instance


class RolePermissionSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = "__all__"
        read_only_fields = ("created_at",)


class RolePermissionBundleSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = RolePermissionBundle
        fields = "__all__"
        read_only_fields = ("created_at",)


class DataScopeSetSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = DataScopeSet
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at", "updated_at")


class DataScopeBranchSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = DataScopeBranch
        fields = "__all__"


class DataScopeDepartmentSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = DataScopeDepartment
        fields = "__all__"


class DataScopeWarehouseSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = DataScopeWarehouse
        fields = "__all__"


class DataScopeBankAccountSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = DataScopeBankAccount
        fields = "__all__"


class DataScopeProjectSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = DataScopeProject
        fields = "__all__"


class DataScopeCostCenterSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = DataScopeCostCenter
        fields = "__all__"


class UserRoleAssignmentSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = UserRoleAssignment
        fields = "__all__"
        read_only_fields = ("id", "assigned_by", "assigned_at", "revoked_by", "revoked_at", "revoke_reason")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        role = attrs.get("role")
        if role and role.status != RoleStatus.ACTIVE:
            raise serializers.ValidationError({"role": "Chỉ Role ACTIVE mới được gán."})
        return attrs


class UserLockRequestSerializer(serializers.Serializer):
    """Payload xác nhận khóa User (UC-SYS-17 Section 1.5)."""
    from .models import LockScope, LockType, TaskHandlingOption

    lock_type = serializers.ChoiceField(choices=LockType.choices, default=LockType.MANUAL)
    lock_scope = serializers.ChoiceField(choices=LockScope.choices, default=LockScope.COMPANY_ACCESS)
    lock_reason = serializers.CharField(required=True, allow_blank=False, max_length=1000)
    start_time = serializers.DateTimeField(required=False, allow_null=True)
    auto_unlock_at = serializers.DateTimeField(required=False, allow_null=True)
    task_handling = serializers.ChoiceField(choices=TaskHandlingOption.choices, default=TaskHandlingOption.KEEP)
    substitute_user_id = serializers.UUIDField(required=False, allow_null=True)
    notify_user = serializers.BooleanField(default=True)


class UserUnlockRequestSerializer(serializers.Serializer):
    """Payload xác nhận mở khóa User (UC-SYS-17 Section 1.6)."""
    unlock_reason = serializers.CharField(required=True, allow_blank=False, max_length=1000)
    require_password_change = serializers.BooleanField(default=False)
    require_mfa = serializers.BooleanField(default=False)


class BulkUserLockItemSerializer(serializers.Serializer):
    from .models import LockScope, LockType, TaskHandlingOption

    membership_id = serializers.UUIDField(required=False, allow_null=True)
    user_id = serializers.UUIDField(required=False, allow_null=True)
    lock_type = serializers.ChoiceField(choices=LockType.choices, default=LockType.MANUAL)
    lock_scope = serializers.ChoiceField(choices=LockScope.choices, default=LockScope.COMPANY_ACCESS)
    lock_reason = serializers.CharField(required=False, allow_blank=True, default="")
    start_time = serializers.DateTimeField(required=False, allow_null=True)
    auto_unlock_at = serializers.DateTimeField(required=False, allow_null=True)
    task_handling = serializers.ChoiceField(choices=TaskHandlingOption.choices, default=TaskHandlingOption.KEEP)
    substitute_user_id = serializers.UUIDField(required=False, allow_null=True)
    notify_user = serializers.BooleanField(default=True)


class BulkUserLockRequestSerializer(serializers.Serializer):
    items = BulkUserLockItemSerializer(many=True)
    default_reason = serializers.CharField(required=False, default="Khóa hàng loạt", allow_blank=True)


class BulkUserUnlockItemSerializer(serializers.Serializer):
    membership_id = serializers.UUIDField(required=False, allow_null=True)
    user_id = serializers.UUIDField(required=False, allow_null=True)
    unlock_reason = serializers.CharField(required=False, allow_blank=True, default="")
    require_password_change = serializers.BooleanField(default=False)
    require_mfa = serializers.BooleanField(default=False)


class BulkUserUnlockRequestSerializer(serializers.Serializer):
    items = BulkUserUnlockItemSerializer(many=True)
    default_reason = serializers.CharField(required=False, default="Mở khóa hàng loạt", allow_blank=True)


class UserLockRecordSerializer(serializers.ModelSerializer):
    """Hiển thị lịch sử khóa và mở khóa User (AF-14)."""
    from .models import UserLockRecord

    user_name = serializers.CharField(source="user.display_name", read_only=True)
    locked_by_name = serializers.CharField(source="locked_by.display_name", read_only=True, allow_null=True)
    unlocked_by_name = serializers.CharField(source="unlocked_by.display_name", read_only=True, allow_null=True)
    substitute_user_name = serializers.CharField(source="substitute_user.display_name", read_only=True, allow_null=True)
    lock_scope_display = serializers.CharField(source="get_lock_scope_display", read_only=True)
    lock_type_display = serializers.CharField(source="get_lock_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        from .models import UserLockRecord
        model = UserLockRecord
        fields = (
            "id", "company", "membership", "user", "user_name",
            "lock_scope", "lock_scope_display", "lock_type", "lock_type_display",
            "lock_reason", "start_time", "auto_unlock_at", "task_handling",
            "substitute_user", "substitute_user_name", "notify_user",
            "status", "status_display", "locked_by", "locked_by_name", "locked_at",
            "unlock_reason", "unlocked_by", "unlocked_by_name", "unlocked_at",
            "require_password_change", "require_mfa", "metadata",
        )


# =====================================================================
# UC-SYS-18: SERIALIZERS CHẤM DỨT QUYỀN THAM GIA DOANH NGHIỆP
# =====================================================================

class MembershipImpactAnalysisSerializer(serializers.Serializer):
    """Báo cáo phân tích ảnh hưởng trước khi ngừng Membership (Main Flow Bước 6, 7)."""
    membership_id = serializers.UUIDField()
    user_id = serializers.UUIDField()
    display_name = serializers.CharField()
    email = serializers.CharField()
    current_status = serializers.CharField()
    joined_at = serializers.DateTimeField(allow_null=True)
    is_owner = serializers.BooleanField()
    is_last_admin = serializers.BooleanField()
    is_sole_member = serializers.BooleanField()
    active_roles = serializers.ListField()
    direct_permissions = serializers.ListField()
    data_scopes = serializers.ListField()
    org_assignments = serializers.ListField()
    pending_approval_tasks = serializers.ListField()
    referenced_workflows = serializers.ListField()
    draft_documents_count = serializers.IntegerField()
    running_jobs_count = serializers.IntegerField()
    active_sessions_count = serializers.IntegerField()


class TerminateMembershipRequestSerializer(serializers.Serializer):
    """Payload yêu cầu ngừng quyền tham gia của User (UC-SYS-18)."""
    from .models import DraftHandlingOption, JobHandlingOption, TaskHandlingOption, TerminationType

    termination_type = serializers.ChoiceField(
        choices=TerminationType.choices, default=TerminationType.ADMINISTRATIVE
    )
    reason = serializers.CharField(required=True, allow_blank=False)
    effective_at = serializers.DateTimeField(required=False, allow_null=True)
    substitute_user_id = serializers.UUIDField(required=False, allow_null=True)
    task_handling = serializers.ChoiceField(
        choices=TaskHandlingOption.choices, default=TaskHandlingOption.KEEP
    )
    draft_handling = serializers.ChoiceField(
        choices=DraftHandlingOption.choices, default=DraftHandlingOption.KEEP
    )
    job_handling = serializers.ChoiceField(
        choices=JobHandlingOption.choices, default=JobHandlingOption.SYSTEM_CONTINUE
    )
    notify_user = serializers.BooleanField(default=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class CancelScheduledTerminationRequestSerializer(serializers.Serializer):
    """Payload hủy lịch ngừng quyền tham gia (AF-12)."""
    reason = serializers.CharField(required=True, allow_blank=False)


class MembershipTerminationRecordSerializer(serializers.ModelSerializer):
    """Bản ghi chi tiết chấm dứt quyền tham gia doanh nghiệp (UC-SYS-18)."""
    from .models import MembershipTerminationRecord

    user_name = serializers.CharField(source="user.display_name", read_only=True)
    substitute_user_name = serializers.CharField(source="substitute_user.display_name", read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source="created_by.display_name", read_only=True, allow_null=True)
    cancelled_by_name = serializers.CharField(source="cancelled_by.display_name", read_only=True, allow_null=True)
    termination_type_display = serializers.CharField(source="get_termination_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        from .models import MembershipTerminationRecord
        model = MembershipTerminationRecord
        fields = (
            "id", "company", "membership", "user", "user_name",
            "termination_type", "termination_type_display", "status", "status_display",
            "reason", "note", "effective_at", "substitute_user", "substitute_user_name",
            "task_handling", "draft_handling", "job_handling", "notify_user",
            "created_by", "created_by_name", "created_at", "completed_at",
            "cancelled_at", "cancelled_by", "cancelled_by_name", "cancellation_reason",
            "metadata",
        )


class MembershipExitRequestCreateSerializer(serializers.Serializer):
    """Payload gửi yêu cầu rời doanh nghiệp do User tạo (Main Flow 2.2)."""
    reason = serializers.CharField(required=True, allow_blank=False)
    desired_effective_date = serializers.DateTimeField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class MembershipExitRequestActionSerializer(serializers.Serializer):
    """Payload phê duyệt hoặc từ chối yêu cầu rời doanh nghiệp của Admin (Main Flow 2.2)."""
    from .models import DraftHandlingOption, JobHandlingOption, TaskHandlingOption, TerminationType

    action = serializers.ChoiceField(choices=["APPROVE", "REJECT"], default="APPROVE")
    rejection_reason = serializers.CharField(required=False, allow_blank=True, default="")
    termination_type = serializers.ChoiceField(choices=TerminationType.choices, default=TerminationType.VOLUNTARY)
    effective_at = serializers.DateTimeField(required=False, allow_null=True)
    substitute_user_id = serializers.UUIDField(required=False, allow_null=True)
    task_handling = serializers.ChoiceField(choices=TaskHandlingOption.choices, default=TaskHandlingOption.KEEP)
    draft_handling = serializers.ChoiceField(choices=DraftHandlingOption.choices, default=DraftHandlingOption.KEEP)
    job_handling = serializers.ChoiceField(choices=JobHandlingOption.choices, default=JobHandlingOption.SYSTEM_CONTINUE)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class MembershipExitRequestSerializer(serializers.ModelSerializer):
    """Hiển thị thông tin yêu cầu rời doanh nghiệp."""
    from .models import MembershipExitRequest

    user_name = serializers.CharField(source="user.display_name", read_only=True)
    processed_by_name = serializers.CharField(source="processed_by.display_name", read_only=True, allow_null=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        from .models import MembershipExitRequest
        model = MembershipExitRequest
        fields = (
            "id", "company", "membership", "user", "user_name",
            "reason", "desired_effective_date", "note", "status", "status_display",
            "created_at", "updated_at", "processed_by", "processed_by_name",
            "processed_at", "rejection_reason", "termination_record",
        )
