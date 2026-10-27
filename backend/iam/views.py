import uuid

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.viewsets import GenericViewSet, ReadOnlyModelViewSet
from rest_framework import serializers
from django.utils import timezone

from audit_log.models import AuditLog
from audit_log.services import record_audit
from organization.models import Company

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
    PermissionResource,
    Role,
    RolePermission,
    RolePermissionBundle,
    UserAccount,
    UserLockRecord,
    MembershipTerminationRecord,
    MembershipExitRequest,
    UserRoleAssignment,
    UserPermissionOverride,
)
from .permissions import HasIamPermission
from .serializers import (
    BulkUserLockRequestSerializer,
    BulkUserUnlockRequestSerializer,
    CancelScheduledTerminationRequestSerializer,
    CompanyMembershipSerializer,
    CompanyUserAccountReadSerializer,
    CompanyUserSerializer,
    CompanyUserUpdateSerializer,
    DataScopeBranchSerializer,
    DataScopeDepartmentSerializer,
    DataScopeWarehouseSerializer,
    DataScopeBankAccountSerializer,
    DataScopeProjectSerializer,
    DataScopeCostCenterSerializer,
    DataScopeSetSerializer,
    MembershipExitRequestActionSerializer,
    MembershipExitRequestCreateSerializer,
    MembershipExitRequestSerializer,
    MembershipImpactAnalysisSerializer,
    MembershipTerminationRecordSerializer,
    PermissionActionSerializer,
    PermissionBundleSerializer,
    PermissionResourceSerializer,
    PermissionSerializer,
    RolePermissionBundleSerializer,
    RolePermissionSerializer,
    RoleSerializer,
    RoleReadSerializer,
    RoleCreateSerializer,
    RoleUpdateSerializer,
    RoleCloneSerializer,
    RoleStateSerializer,
    TerminateMembershipRequestSerializer,
    UserAccountSerializer,
    UserLockRecordSerializer,
    UserLockRequestSerializer,
    UserRoleAssignmentSerializer,
    UserUnlockRequestSerializer,
)
from .services import (
    MembershipVersionConflict,
    approve_membership_exit,
    bulk_lock_users,
    bulk_unlock_users,
    cancel_membership_exit,
    cancel_scheduled_termination,
    get_membership_history,
    get_membership_impact_analysis,
    get_pending_tasks_for_user,
    get_user_lock_history,
    lock_user,
    reject_membership_exit,
    request_membership_exit,
    revoke_role_assignment,
    terminate_membership,
    unlock_user,
    update_company_user,
)
from .permissions import memberships_in_scope
from .role_services import clone_role, create_role, role_impact, set_role_active, update_role
from .access_services import update_matrix, assign_role, revoke_role, add_override, revoke_override
from .role_services import _permission_codes
from .permissions import has_effective_permission


class MatrixWriteSerializer(serializers.Serializer):
    version = serializers.DateTimeField()
    permission_codes = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    bundle_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)


class AssignmentWriteSerializer(serializers.Serializer):
    company_membership = serializers.UUIDField()
    role = serializers.UUIDField()
    data_scope_set = serializers.UUIDField(required=False, allow_null=True)
    valid_from = serializers.DateTimeField(required=False)
    valid_to = serializers.DateTimeField(required=False, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class OverrideWriteSerializer(serializers.Serializer):
    company_membership = serializers.UUIDField()
    permission_code = serializers.CharField()
    data_scope_set = serializers.UUIDField(required=False, allow_null=True)
    effect = serializers.ChoiceField(choices=("GRANT", "DENY"))
    reason = serializers.CharField(allow_blank=False)
    valid_from = serializers.DateTimeField(required=False)
    valid_to = serializers.DateTimeField(required=False, allow_null=True)


class OverrideReadSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    membership_id = serializers.UUIDField()
    permission_code = serializers.CharField()
    effect = serializers.CharField()
    reason = serializers.CharField()
    valid_from = serializers.DateTimeField()
    valid_to = serializers.DateTimeField(allow_null=True)
    revoked_at = serializers.DateTimeField(allow_null=True)


class EffectiveReadSerializer(serializers.Serializer):
    membership_id = serializers.UUIDField()
    permission_codes = serializers.ListField(child=serializers.CharField())
    checked_at = serializers.DateTimeField()


class ProtectedModelViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    permission_classes = (HasIamPermission,)
    filter_backends = (SearchFilter, OrderingFilter)

    def get_audit_company(self, instance):
        if hasattr(instance, "company"):
            return instance.company
        if hasattr(instance, "role"):
            return instance.role.company
        if hasattr(instance, "data_scope_set"):
            return instance.data_scope_set.company
        company_id = self.request.data.get("company") or self.request.query_params.get("company_id")
        return Company.objects.get(pk=company_id) if company_id else None

    def audit(self, instance, action_code, before=None, after=None):
        company = self.get_audit_company(instance)
        if company:
            record_audit(
                company=company,
                actor_user=self.request.user.iam_account,
                module_code="IAM",
                action_code=action_code,
                entity=instance,
                before=before,
                after=after,
                request=self.request,
                reason=self.request.headers.get("X-Audit-Reason", ""),
            )

    def perform_create(self, serializer):
        kwargs = {}
        if serializer.Meta.model is CompanyMembership:
            kwargs["created_by"] = self.request.user.iam_account
        elif serializer.Meta.model is DataScopeSet:
            kwargs["created_by"] = self.request.user.iam_account
        elif serializer.Meta.model is UserRoleAssignment:
            kwargs["assigned_by"] = self.request.user.iam_account
        instance = serializer.save(**kwargs)
        self.audit(instance, "CREATE", after=serializer.data)

    def perform_update(self, serializer):
        before = type(serializer)(serializer.instance, context=self.get_serializer_context()).data
        instance = serializer.save()
        self.audit(instance, "EDIT", before=before, after=serializer.data)


class UserAccountViewSet(ProtectedModelViewSet):
    allow_scoped_list_permission = True
    iam_permissions = {"GET": "SYS.USER.VIEW", "POST": "SYS.USER.CREATE", "PUT": "SYS.USER.EDIT", "PATCH": "SYS.USER.EDIT"}
    serializer_class = UserAccountSerializer
    search_fields = ("auth_user__username", "auth_user__email", "display_name", "phone")
    ordering_fields = ("display_name", "created_at")

    def get_serializer_class(self):
        if self.request.method == "GET" and not self.request.user.is_superuser:
            return CompanyUserAccountReadSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            raise PermissionDenied("Tài khoản toàn cục do User tự đăng ký và quản lý.")
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            raise PermissionDenied("Admin doanh nghiệp không được sửa tài khoản toàn cục.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            raise PermissionDenied("Admin doanh nghiệp không được sửa tài khoản toàn cục.")
        return super().partial_update(request, *args, **kwargs)

    def get_queryset(self):
        queryset = UserAccount.objects.select_related("auth_user")
        company_id = self.request.query_params.get("company_id")
        if not company_id:
            return queryset.none()
        company = Company.objects.filter(pk=company_id, status="ACTIVE").first()
        if not company:
            return queryset.none()
        if self.request.user.is_superuser:
            return queryset.filter(memberships__company=company).distinct()
        account = self.request.user.iam_account
        if not CompanyMembership.objects.filter(company=company, user=account, membership_status="ACTIVE").exists():
            return queryset.none()
        membership_ids = memberships_in_scope(account, company, "SYS.USER.VIEW").values("user_id")
        return queryset.filter(pk__in=membership_ids)

    def get_audit_company(self, instance):
        company_id = self.request.data.get("company") or self.request.query_params.get("company_id")
        if company_id:
            return Company.objects.get(pk=company_id)
        membership = instance.memberships.select_related("company").first()
        return membership.company if membership else None


class CompanyMembershipViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    permission_classes = (HasIamPermission,)
    allow_scoped_list_permission = True
    iam_permissions = {"GET": "SYS.USER.VIEW", "PATCH": "SYS.USER.EDIT"}
    action_permissions = {
        "history": "SYS.USER.VIEW_HISTORY",
        "lock": "SYS.USER.LOCK",
        "unlock": "SYS.USER.UNLOCK",
        "lock_history": "SYS.USER.VIEW_SECURITY",
        "pending_tasks": "SYS.USER.VIEW",
        "bulk_lock": "SYS.USER.LOCK",
        "bulk_unlock": "SYS.USER.UNLOCK",
        "impact_analysis": "SYS.USER.VIEW",
        "terminate": "SYS.USER.TERMINATE",
        "cancel_termination": "SYS.USER.TERMINATE",
        "membership_history": "SYS.USER.VIEW_HISTORY",
        "request_exit": "SYS.USER.VIEW",
    }
    serializer_class = CompanyUserSerializer
    http_method_names = ("get", "post", "patch", "head", "options")
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = (
        "user__display_name", "user__auth_user__email", "user__phone",
        "employee__employee_code", "internal_display_name",
    )
    ordering_fields = ("joined_at", "updated_at", "user__display_name")
    queryset = CompanyMembership.objects.select_related(
        "company", "user__auth_user", "user__preference", "employee__branch", "employee__department",
        "organization_unit", "created_by", "updated_by",
    ).prefetch_related(
        "role_assignments__role",
        "lock_records",
    )

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        try:
            company_uuid = uuid.UUID(str(company_id))
        except (TypeError, ValueError):
            company_uuid = None
        company = Company.objects.filter(pk=company_uuid, status="ACTIVE").first() if company_uuid else None
        if company is None or not hasattr(self.request.user, "iam_account"):
            return self.queryset.none()
        actor = self.request.user.iam_account
        if not CompanyMembership.objects.filter(company=company, user=actor, membership_status="ACTIVE").exists():
            return self.queryset.none()
        permission = (
            "SYS.USER.VIEW_HISTORY" if self.action in ("history", "membership_history") else
            "SYS.USER.TERMINATE" if self.action in ("terminate", "cancel_termination") else
            "SYS.USER.LOCK" if self.action in ("lock", "bulk_lock") else
            "SYS.USER.UNLOCK" if self.action in ("unlock", "bulk_unlock") else
            "SYS.USER.VIEW_SECURITY" if self.action == "lock_history" else
            "SYS.USER.EDIT" if self.action == "partial_update" else "SYS.USER.VIEW"
        )
        queryset = self.queryset.filter(company=company)
        if not self.request.user.is_superuser:
            queryset = queryset.filter(pk__in=memberships_in_scope(actor, company, permission).values("pk"))
        params = self.request.query_params
        if state := params.get("status"):
            queryset = queryset.filter(membership_status=state)
        if role := params.get("role"):
            queryset = queryset.filter(role_assignments__role__code=role, role_assignments__status="ACTIVE")
        if unit := params.get("organization_unit"):
            queryset = queryset.filter(organization_unit_id=unit)
        if query := params.get("q"):
            queryset = queryset.filter(
                Q(user__display_name__icontains=query) | Q(user__auth_user__email__icontains=query)
                | Q(employee__employee_code__icontains=query) | Q(internal_display_name__icontains=query)
            )
        return queryset.distinct()

    def partial_update(self, request, pk=None):
        membership = self.get_object()
        serializer = CompanyUserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            membership = update_company_user(
                membership_id=membership.pk, company=membership.company,
                actor=request.user.iam_account, data=serializer.validated_data,
                request=request, is_platform_admin=request.user.is_superuser,
            )
        except IntegrityError as exc:
            raise MembershipVersionConflict("Hồ sơ nhân viên vừa được liên kết với User khác.") from exc
        return Response(self.get_serializer(membership).data)

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        membership = self.get_object()
        assignment_ids = UserRoleAssignment.objects.filter(company_membership=membership).values("pk")
        logs = AuditLog.objects.filter(company=membership.company).filter(
            Q(entity_type="iam.CompanyMembership", entity_id=membership.pk) |
            Q(entity_type="iam.UserRoleAssignment", entity_id__in=assignment_ids)
        ).select_related("actor_user").prefetch_related("changes")[:100]
        return Response([
            {"id": str(log.pk), "action": log.action_code, "actor_id": str(log.actor_user_id),
             "actor_name": log.actor_user.display_name, "occurred_at": log.occurred_at,
             "entity_type": log.entity_type, "entity_id": str(log.entity_id),
             "changes": [{"field": change.field_name, "before": change.old_value_json,
                          "after": change.new_value_json} for change in log.changes.all()]}
            for log in logs
        ])

    @action(detail=True, methods=("post",))
    def lock(self, request, pk=None):
        membership = self.get_object()
        serializer = UserLockRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lock_record = lock_user(
            company=membership.company,
            actor=getattr(request.user, "iam_account", None),
            target_membership_id=membership.pk,
            lock_type=serializer.validated_data.get("lock_type", "MANUAL"),
            lock_scope=serializer.validated_data.get("lock_scope", "COMPANY_ACCESS"),
            lock_reason=serializer.validated_data["lock_reason"],
            start_time=serializer.validated_data.get("start_time"),
            auto_unlock_at=serializer.validated_data.get("auto_unlock_at"),
            task_handling=serializer.validated_data.get("task_handling", "KEEP"),
            substitute_user_id=serializer.validated_data.get("substitute_user_id"),
            notify_user=serializer.validated_data.get("notify_user", True),
            request=request,
        )
        membership.refresh_from_db()
        return Response({
            "message": "Khóa User thành công." if membership.membership_status == "LOCKED" else "Đã lên lịch khóa User thành công.",
            "membership": self.get_serializer(membership).data,
            "lock_record": UserLockRecordSerializer(lock_record).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",))
    def unlock(self, request, pk=None):
        membership = self.get_object()
        serializer = UserUnlockRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = unlock_user(
            company=membership.company,
            actor=getattr(request.user, "iam_account", None),
            target_membership_id=membership.pk,
            unlock_reason=serializer.validated_data["unlock_reason"],
            require_password_change=serializer.validated_data.get("require_password_change", False),
            require_mfa=serializer.validated_data.get("require_mfa", False),
            request=request,
        )
        membership.refresh_from_db()
        return Response({
            "message": "Mở khóa User thành công.",
            "membership": self.get_serializer(membership).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=("get",), url_path="lock-history")
    def lock_history(self, request, pk=None):
        membership = self.get_object()
        records = get_user_lock_history(membership)
        return Response(UserLockRecordSerializer(records, many=True).data)

    @action(detail=True, methods=("get",), url_path="pending-tasks")
    def pending_tasks(self, request, pk=None):
        membership = self.get_object()
        data = get_pending_tasks_for_user(membership, membership.company)
        return Response(data)

    @action(detail=False, methods=("post",), url_path="bulk-lock")
    def bulk_lock(self, request):
        company_id = request.data.get("company_id") or request.query_params.get("company_id")
        company = get_object_or_404(Company, pk=company_id)
        serializer = BulkUserLockRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = bulk_lock_users(
            company=company,
            actor=getattr(request.user, "iam_account", None),
            items=serializer.validated_data["items"],
            default_reason=serializer.validated_data.get("default_reason", "Khóa hàng loạt"),
            request=request,
        )
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="bulk-unlock")
    def bulk_unlock(self, request):
        company_id = request.data.get("company_id") or request.query_params.get("company_id")
        company = get_object_or_404(Company, pk=company_id)
        serializer = BulkUserUnlockRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = bulk_unlock_users(
            company=company,
            actor=getattr(request.user, "iam_account", None),
            items=serializer.validated_data["items"],
            default_reason=serializer.validated_data.get("default_reason", "Mở khóa hàng loạt"),
            request=request,
        )
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=("get",), url_path="impact-analysis")
    def impact_analysis(self, request, pk=None):
        membership = self.get_object()
        data = get_membership_impact_analysis(membership.company, membership.pk, getattr(request.user, "iam_account", None))
        return Response(MembershipImpactAnalysisSerializer(data).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="terminate")
    def terminate(self, request, pk=None):
        membership = self.get_object()
        serializer = TerminateMembershipRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = terminate_membership(
            company=membership.company,
            actor=getattr(request.user, "iam_account", None),
            target_membership_id=membership.pk,
            termination_type=serializer.validated_data.get("termination_type", "ADMINISTRATIVE"),
            reason=serializer.validated_data["reason"],
            effective_at=serializer.validated_data.get("effective_at"),
            substitute_user_id=serializer.validated_data.get("substitute_user_id"),
            task_handling=serializer.validated_data.get("task_handling", "KEEP"),
            draft_handling=serializer.validated_data.get("draft_handling", "KEEP"),
            job_handling=serializer.validated_data.get("job_handling", "SYSTEM_CONTINUE"),
            notify_user=serializer.validated_data.get("notify_user", True),
            note=serializer.validated_data.get("note", ""),
            request=request,
        )
        membership.refresh_from_db()
        return Response({
            "message": "Ngừng quyền tham gia doanh nghiệp thành công." if membership.membership_status == "ENDED" else "Đã lên lịch ngừng quyền tham gia thành công.",
            "membership": self.get_serializer(membership).data,
            "termination_record": MembershipTerminationRecordSerializer(record).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="cancel-termination")
    def cancel_termination(self, request, pk=None):
        membership = self.get_object()
        serializer = CancelScheduledTerminationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = cancel_scheduled_termination(
            company=membership.company,
            actor=getattr(request.user, "iam_account", None),
            membership_id=membership.pk,
            reason=serializer.validated_data["reason"],
            request=request,
        )
        membership.refresh_from_db()
        return Response({
            "message": "Hủy lịch ngừng quyền tham gia thành công.",
            "membership": self.get_serializer(membership).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=("get",), url_path="membership-history")
    def membership_history(self, request, pk=None):
        membership = self.get_object()
        data = get_membership_history(membership.company, membership_id=membership.pk)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="request-exit")
    def request_exit(self, request):
        company_id = request.data.get("company_id") or request.query_params.get("company_id")
        company = get_object_or_404(Company, pk=company_id)
        serializer = MembershipExitRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_account = getattr(request.user, "iam_account", None)
        if not user_account:
            return Response({"detail": "Yêu cầu tài khoản User hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)
        req = request_membership_exit(
            company=company,
            user=user_account,
            reason=serializer.validated_data["reason"],
            desired_effective_date=serializer.validated_data.get("desired_effective_date"),
            note=serializer.validated_data.get("note", ""),
        )
        return Response(MembershipExitRequestSerializer(req).data, status=status.HTTP_201_CREATED)


class RoleViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "SYS.ROLE.VIEW", "POST": "SYS.ROLE.CREATE", "PATCH": "SYS.ROLE.EDIT"}
    action_permissions = {
        "clone": "SYS.ROLE.CLONE", "impact": "SYS.ROLE.DEACTIVATE",
        "deactivate": "SYS.ROLE.DEACTIVATE", "reactivate": "SYS.ROLE.REACTIVATE",
        "users": "SYS.ROLE.VIEW_USERS", "history": "SYS.ROLE.VIEW_HISTORY",
        "matrix": "SYS.PERMISSION.VIEW", "set_matrix": "SYS.PERMISSION.CONFIGURE",
    }
    serializer_class = RoleReadSerializer
    http_method_names = ("get", "post", "patch", "head", "options")
    filter_backends = (SearchFilter, OrderingFilter)
    queryset = Role.objects.select_related("company", "source_role", "created_by", "updated_by")
    search_fields = ("code", "name", "description")
    ordering_fields = ("code", "name", "created_at", "updated_at")

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        try:
            company_uuid = uuid.UUID(str(company_id))
        except (TypeError, ValueError):
            company_uuid = None
        company = Company.objects.filter(pk=company_uuid, status="ACTIVE").first() if company_uuid else None
        if company is None or not hasattr(self.request.user, "iam_account"):
            return self.queryset.none()
        if not CompanyMembership.objects.filter(
            company=company, user=self.request.user.iam_account, membership_status="ACTIVE",
        ).exists():
            return self.queryset.none()
        queryset = self.queryset.filter(company=company)
        if state := self.request.query_params.get("status"):
            queryset = queryset.filter(status=state)
        if role_class := self.request.query_params.get("role_class"):
            if role_class.upper() == "SYSTEM":
                queryset = queryset.filter(Q(role_type="STANDARD") | Q(is_system_admin=True))
            elif role_class.upper() == "COMPANY":
                queryset = queryset.filter(role_type="CUSTOM", is_system_admin=False)
            else:
                queryset = queryset.none()
        if query := self.request.query_params.get("q"):
            queryset = queryset.filter(Q(code__icontains=query) | Q(name__icontains=query))
        return queryset

    def _company(self):
        try:
            company_uuid = uuid.UUID(str(self.request.query_params["company_id"]))
        except (KeyError, TypeError, ValueError) as exc:
            raise ValidationError({"company_id": "Cần chọn doanh nghiệp hợp lệ."}) from exc
        company = Company.objects.filter(pk=company_uuid).first()
        if company is None:
            raise ValidationError({"company_id": "Doanh nghiệp không tồn tại."})
        return company

    def create(self, request):
        serializer = RoleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            role = create_role(
                company=self._company(), actor=request.user.iam_account,
                data=serializer.validated_data, request=request,
                is_platform_admin=request.user.is_superuser,
            )
        except IntegrityError as exc:
            raise ValidationError("Mã hoặc tên Role vừa được sử dụng.") from exc
        return Response(self.get_serializer(role).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        role = self.get_object()
        serializer = RoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            role = update_role(
                role_id=role.pk, company=role.company, actor=request.user.iam_account,
                data=serializer.validated_data, request=request,
                is_platform_admin=request.user.is_superuser,
            )
        except IntegrityError as exc:
            raise ValidationError("Mã hoặc tên Role vừa được sử dụng.") from exc
        return Response(self.get_serializer(role).data)

    @action(detail=True, methods=("post",))
    def clone(self, request, pk=None):
        source = self.get_object()
        serializer = RoleCloneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            role = clone_role(
                source_id=source.pk, company=source.company, actor=request.user.iam_account,
                data=serializer.validated_data, request=request,
                is_platform_admin=request.user.is_superuser,
            )
        except IntegrityError as exc:
            raise ValidationError("Mã hoặc tên Role vừa được sử dụng.") from exc
        return Response(self.get_serializer(role).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("get",))
    def impact(self, request, pk=None):
        return Response(role_impact(self.get_object()))

    @action(detail=True, methods=("get",))
    def users(self, request, pk=None):
        return Response(role_impact(self.get_object())["users"])

    @action(detail=True, methods=("post",))
    def deactivate(self, request, pk=None):
        role = self.get_object()
        serializer = RoleStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = set_role_active(
            role_id=role.pk, company=role.company, actor=request.user.iam_account,
            active=False, data=serializer.validated_data, request=request,
            is_platform_admin=request.user.is_superuser,
        )
        return Response(self.get_serializer(role).data)

    @action(detail=True, methods=("post",))
    def reactivate(self, request, pk=None):
        role = self.get_object()
        serializer = RoleStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = set_role_active(
            role_id=role.pk, company=role.company, actor=request.user.iam_account,
            active=True, data=serializer.validated_data, request=request,
            is_platform_admin=request.user.is_superuser,
        )
        return Response(self.get_serializer(role).data)

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        role = self.get_object()
        logs = AuditLog.objects.filter(
            company=role.company,
            entity_type="iam.Role",
            entity_id=role.pk,
        ).select_related("actor_user").prefetch_related("changes")[:100]
        return Response([
            {"id": str(log.pk), "action": log.action_code, "actor_id": str(log.actor_user_id),
             "actor_name": log.actor_user.display_name, "occurred_at": log.occurred_at,
             "entity_type": log.entity_type, "entity_id": str(log.entity_id),
             "changes": [{"field": change.field_name, "before": change.old_value_json,
                          "after": change.new_value_json} for change in log.changes.all()]}
            for log in logs
        ])

    @action(detail=True, methods=("get",))
    def matrix(self, request, pk=None):
        role = self.get_object()
        return Response({"role_id": str(role.id), "version": role.updated_at,
                         "permission_codes": sorted(_permission_codes(role)),
                         "affected_users": UserRoleAssignment.objects.filter(
                             role=role, status="ACTIVE").values("company_membership_id").distinct().count()})

    @action(detail=True, methods=("post",), url_path="set-matrix")
    def set_matrix(self, request, pk=None):
        role = self.get_object()
        serializer = MatrixWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated, codes, affected = update_matrix(
            company=role.company, role_id=role.id, actor=request.user.iam_account,
            codes=serializer.validated_data["permission_codes"],
            bundle_ids=serializer.validated_data["bundle_ids"],
            version=serializer.validated_data["version"], request=request,
            is_platform_admin=request.user.is_superuser)
        return Response({"role_id": str(updated.id), "version": updated.updated_at,
                         "permission_codes": codes, "affected_users": affected})


class CatalogViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "SYS.PERMISSION.VIEW"}
    filter_backends = (SearchFilter, OrderingFilter)


class PermissionResourceViewSet(CatalogViewSet):
    queryset = PermissionResource.objects.all()
    serializer_class = PermissionResourceSerializer
    search_fields = ("code", "module_code", "name")


class PermissionActionViewSet(CatalogViewSet):
    queryset = PermissionAction.objects.all()
    serializer_class = PermissionActionSerializer
    search_fields = ("code", "name")


class PermissionViewSet(CatalogViewSet):
    queryset = Permission.objects.select_related("resource", "action")
    serializer_class = PermissionSerializer
    search_fields = ("code", "description", "resource__name")


class PermissionBundleViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "SYS.PERMISSION.VIEW"}
    queryset = PermissionBundle.objects.prefetch_related("permissions")
    serializer_class = PermissionBundleSerializer
    search_fields = ("code", "name", "module_code")


class RolePermissionViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "SYS.PERMISSION.VIEW"}
    queryset = RolePermission.objects.select_related("role", "permission")
    serializer_class = RolePermissionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        role_id = self.request.query_params.get("role_id")
        company_id = self.request.query_params.get("company_id")
        return queryset.filter(role_id=role_id, role__company_id=company_id) if role_id and company_id else queryset.none()


class RolePermissionBundleViewSet(ReadOnlyModelViewSet):
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "SYS.PERMISSION.VIEW"}
    queryset = RolePermissionBundle.objects.select_related("role", "bundle")
    serializer_class = RolePermissionBundleSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        role_id = self.request.query_params.get("role_id")
        company_id = self.request.query_params.get("company_id")
        return queryset.filter(role_id=role_id, role__company_id=company_id) if role_id and company_id else queryset.none()


class DataScopeSetViewSet(ProtectedModelViewSet):
    iam_permissions = {"GET": "SYS.ROLE_ASSIGNMENT.VIEW", "POST": "SYS.ROLE_ASSIGNMENT.CONFIGURE", "PUT": "SYS.ROLE_ASSIGNMENT.CONFIGURE", "PATCH": "SYS.ROLE_ASSIGNMENT.CONFIGURE"}
    queryset = DataScopeSet.objects.select_related("company", "created_by")
    serializer_class = DataScopeSetSerializer
    search_fields = ("code", "name")

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        return super().get_queryset().filter(company_id=company_id) if company_id else DataScopeSet.objects.none()


class DataScopeBranchViewSet(ProtectedModelViewSet):
    iam_permissions = {"GET": "SYS.ROLE_ASSIGNMENT.VIEW", "POST": "SYS.ROLE_ASSIGNMENT.CONFIGURE", "PUT": "SYS.ROLE_ASSIGNMENT.CONFIGURE", "PATCH": "SYS.ROLE_ASSIGNMENT.CONFIGURE"}
    queryset = DataScopeBranch.objects.select_related("data_scope_set", "branch")
    serializer_class = DataScopeBranchSerializer

    def get_queryset(self):
        scope_id = self.request.query_params.get("data_scope_set_id")
        return super().get_queryset().filter(data_scope_set_id=scope_id) if scope_id else DataScopeBranch.objects.none()


class DataScopeDepartmentViewSet(ProtectedModelViewSet):
    iam_permissions = {"GET": "SYS.ROLE_ASSIGNMENT.VIEW", "POST": "SYS.ROLE_ASSIGNMENT.CONFIGURE", "PUT": "SYS.ROLE_ASSIGNMENT.CONFIGURE", "PATCH": "SYS.ROLE_ASSIGNMENT.CONFIGURE"}
    queryset = DataScopeDepartment.objects.select_related("data_scope_set", "department")
    serializer_class = DataScopeDepartmentSerializer

    def get_queryset(self):
        scope_id = self.request.query_params.get("data_scope_set_id")
        return super().get_queryset().filter(data_scope_set_id=scope_id) if scope_id else DataScopeDepartment.objects.none()


def _scope_viewset(name, model, serializer):
    class ScopeViewSet(ProtectedModelViewSet):
        queryset = model.objects.select_related("data_scope_set")
        serializer_class = serializer
        iam_permissions = {
            "GET": "SYS.ROLE_ASSIGNMENT.VIEW",
            "POST": "SYS.ROLE_ASSIGNMENT.CONFIGURE",
            "PUT": "SYS.ROLE_ASSIGNMENT.CONFIGURE",
            "PATCH": "SYS.ROLE_ASSIGNMENT.CONFIGURE",
        }

        def get_queryset(self):
            scope_id = self.request.query_params.get("data_scope_set_id")
            return super().get_queryset().filter(data_scope_set_id=scope_id) if scope_id else model.objects.none()

    ScopeViewSet.__name__ = name
    ScopeViewSet.__qualname__ = name
    return ScopeViewSet


DataScopeWarehouseViewSet = _scope_viewset("DataScopeWarehouseViewSet", DataScopeWarehouse, DataScopeWarehouseSerializer)
DataScopeBankAccountViewSet = _scope_viewset("DataScopeBankAccountViewSet", DataScopeBankAccount, DataScopeBankAccountSerializer)
DataScopeProjectViewSet = _scope_viewset("DataScopeProjectViewSet", DataScopeProject, DataScopeProjectSerializer)
DataScopeCostCenterViewSet = _scope_viewset("DataScopeCostCenterViewSet", DataScopeCostCenter, DataScopeCostCenterSerializer)


class UserRoleAssignmentViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet
):
    queryset = UserRoleAssignment.objects.select_related("company_membership", "role", "data_scope_set", "assigned_by")
    serializer_class = UserRoleAssignmentSerializer
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "SYS.ROLE_ASSIGNMENT.VIEW", "POST": "SYS.PERMISSION.ASSIGN_ROLE"}
    action_permissions = {"revoke": "SYS.PERMISSION.REVOKE_ROLE"}

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        return super().get_queryset().filter(company_membership__company_id=company_id) if company_id else UserRoleAssignment.objects.none()

    def create(self, request, *args, **kwargs):
        serializer = AssignmentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = Company.objects.filter(pk=request.query_params.get("company_id")).first()
        if not company:
            raise ValidationError({"company_id": "Doanh nghiep khong hop le."})
        data = serializer.validated_data
        assignment = assign_role(
            company=company, actor=request.user.iam_account,
            membership_id=data["company_membership"], role_id=data["role"],
            valid_from=data.get("valid_from"), valid_to=data.get("valid_to"),
            scope_id=data.get("data_scope_set"), reason=data.get("reason", ""),
            request=request, is_platform_admin=request.user.is_superuser)
        return Response(self.get_serializer(assignment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def revoke(self, request, pk=None):
        try:
            original = self.get_object()
            assignment = revoke_role(
                company=original.company_membership.company, assignment_id=original.id,
                actor=request.user.iam_account, reason=request.data.get("reason", ""),
                request=request, is_platform_admin=request.user.is_superuser)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(assignment).data)


class UserPermissionOverrideViewSet(mixins.CreateModelMixin, mixins.ListModelMixin,
                                    mixins.RetrieveModelMixin, GenericViewSet):
    permission_classes = (HasIamPermission,)
    serializer_class = OverrideReadSerializer
    iam_permissions = {"GET": "SYS.PERMISSION.VIEW", "POST": "SYS.PERMISSION.DIRECT_PERMISSION"}
    action_permissions = {"revoke": "SYS.PERMISSION.DIRECT_PERMISSION"}
    queryset = UserPermissionOverride.objects.select_related("permission", "company_membership")

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        return self.queryset.filter(company_membership__company_id=company_id) if company_id else self.queryset.none()

    def list(self, request, *args, **kwargs):
        items = self.get_queryset()
        membership_id = request.query_params.get("membership_id")
        if membership_id:
            items = items.filter(company_membership_id=membership_id)
        return Response([self._data(item) for item in items[:200]])

    def retrieve(self, request, *args, **kwargs):
        return Response(self._data(self.get_object()))

    @staticmethod
    def _data(item):
        return {"id": str(item.id), "membership_id": str(item.company_membership_id),
                "permission_code": item.permission.code, "effect": item.effect,
                "reason": item.reason, "valid_from": item.valid_from,
                "valid_to": item.valid_to, "revoked_at": item.revoked_at}

    def create(self, request, *args, **kwargs):
        serializer = OverrideWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = Company.objects.filter(pk=request.query_params.get("company_id")).first()
        if not company:
            raise ValidationError({"company_id": "Doanh nghiep khong hop le."})
        data = serializer.validated_data
        item = add_override(
            company=company, actor=request.user.iam_account,
            membership_id=data["company_membership"], permission_code=data["permission_code"],
            effect=data["effect"], reason=data["reason"], scope_id=data.get("data_scope_set"),
            valid_from=data.get("valid_from"), valid_to=data.get("valid_to"),
            request=request, is_platform_admin=request.user.is_superuser)
        return Response(self._data(item), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def revoke(self, request, pk=None):
        item = self.get_object()
        item = revoke_override(company=item.company_membership.company,
                               actor=request.user.iam_account, override_id=item.id,
                               reason=request.data.get("reason", ""), request=request,
                               is_platform_admin=request.user.is_superuser)
        return Response(self._data(item))


class EffectivePermissionViewSet(GenericViewSet):
    permission_classes = (HasIamPermission,)
    serializer_class = EffectiveReadSerializer
    action_permissions = {"list": "SYS.PERMISSION.CHECK_EFFECTIVE"}

    def list(self, request):
        company = Company.objects.filter(pk=request.query_params.get("company_id"), status="ACTIVE").first()
        membership = CompanyMembership.objects.filter(
            pk=request.query_params.get("membership_id"), company=company).select_related("user").first()
        if not company or not membership:
            raise ValidationError("Membership khong hop le.")
        codes = Permission.objects.filter(status="ACTIVE", resource__status="ACTIVE").values_list("code", flat=True)
        granted = [code for code in codes if has_effective_permission(membership.user, company, code)]
        return Response({"membership_id": str(membership.id), "permission_codes": granted,
                         "checked_at": timezone.now()})


class UserLockRecordViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    """API tra cứu các bản ghi khóa và mở khóa User (UC-SYS-17)."""
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "SYS.USER.VIEW_SECURITY"}
    serializer_class = UserLockRecordSerializer
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("user__display_name", "lock_reason", "unlock_reason")
    ordering_fields = ("locked_at", "start_time", "auto_unlock_at")
    queryset = UserLockRecord.objects.select_related(
        "company", "membership", "user", "locked_by", "unlocked_by", "substitute_user"
    )

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        try:
            company_uuid = uuid.UUID(str(company_id))
        except (TypeError, ValueError):
            company_uuid = None
        if not company_uuid:
            return self.queryset.none()
        queryset = self.queryset.filter(company_id=company_uuid)
        params = self.request.query_params
        if status_param := params.get("status"):
            queryset = queryset.filter(status=status_param)
        if user_id := params.get("user_id"):
            queryset = queryset.filter(user_id=user_id)
        if lock_type := params.get("lock_type"):
            queryset = queryset.filter(lock_type=lock_type)
        if lock_scope := params.get("lock_scope"):
            queryset = queryset.filter(lock_scope=lock_scope)
        return queryset


class MembershipTerminationRecordViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    """API tra cứu các bản ghi ngừng quyền tham gia doanh nghiệp (UC-SYS-18)."""
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "SYS.USER.VIEW_HISTORY"}
    serializer_class = MembershipTerminationRecordSerializer
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("user__display_name", "reason", "substitute_user__display_name")
    ordering_fields = ("created_at", "effective_at")
    queryset = MembershipTerminationRecord.objects.select_related(
        "company", "membership", "user", "substitute_user", "created_by", "cancelled_by"
    )

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        try:
            company_uuid = uuid.UUID(str(company_id))
        except (TypeError, ValueError):
            company_uuid = None
        if not company_uuid:
            return self.queryset.none()
        queryset = self.queryset.filter(company_id=company_uuid)
        params = self.request.query_params
        if status_param := params.get("status"):
            queryset = queryset.filter(status=status_param)
        if user_id := params.get("user_id"):
            queryset = queryset.filter(user_id=user_id)
        if term_type := params.get("termination_type"):
            queryset = queryset.filter(termination_type=term_type)
        return queryset


class MembershipExitRequestViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    """API quản lý các yêu cầu rời doanh nghiệp do User gửi (Main Flow 2.2)."""
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "SYS.USER.VIEW"}
    action_permissions = {
        "approve": "SYS.USER.TERMINATE",
        "reject": "SYS.USER.TERMINATE",
        "cancel": "SYS.USER.VIEW",
    }
    serializer_class = MembershipExitRequestSerializer
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("user__display_name", "reason", "rejection_reason")
    ordering_fields = ("created_at", "desired_effective_date")
    queryset = MembershipExitRequest.objects.select_related(
        "company", "membership", "user", "processed_by", "termination_record"
    )

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        try:
            company_uuid = uuid.UUID(str(company_id))
        except (TypeError, ValueError):
            company_uuid = None
        if not company_uuid:
            return self.queryset.none()
        queryset = self.queryset.filter(company_id=company_uuid)
        params = self.request.query_params
        if status_param := params.get("status"):
            queryset = queryset.filter(status=status_param)
        if user_id := params.get("user_id"):
            queryset = queryset.filter(user_id=user_id)
        return queryset

    @action(detail=True, methods=("post",), url_path="approve")
    def approve(self, request, pk=None):
        exit_req = self.get_object()
        serializer = MembershipExitRequestActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        approved = approve_membership_exit(
            company=exit_req.company,
            actor=getattr(request.user, "iam_account", None),
            request_id=exit_req.pk,
            termination_type=serializer.validated_data.get("termination_type"),
            effective_at=serializer.validated_data.get("effective_at"),
            substitute_user_id=serializer.validated_data.get("substitute_user_id"),
            task_handling=serializer.validated_data.get("task_handling", "KEEP"),
            draft_handling=serializer.validated_data.get("draft_handling", "KEEP"),
            job_handling=serializer.validated_data.get("job_handling", "SYSTEM_CONTINUE"),
            note=serializer.validated_data.get("note", ""),
            request=request,
        )
        return Response(MembershipExitRequestSerializer(approved).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="reject")
    def reject(self, request, pk=None):
        exit_req = self.get_object()
        serializer = MembershipExitRequestActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rejected = reject_membership_exit(
            company=exit_req.company,
            actor=getattr(request.user, "iam_account", None),
            request_id=exit_req.pk,
            rejection_reason=serializer.validated_data.get("rejection_reason", ""),
            request=request,
        )
        return Response(MembershipExitRequestSerializer(rejected).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="cancel")
    def cancel(self, request, pk=None):
        exit_req = self.get_object()
        cancelled = cancel_membership_exit(
            company=exit_req.company,
            user=getattr(request.user, "iam_account", None),
            request_id=exit_req.pk,
        )
        return Response(MembershipExitRequestSerializer(cancelled).data, status=status.HTTP_200_OK)
