import uuid

from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from django.utils import timezone

from organization.models import Company

from .models import CompanyMembership, OrganizationAssignment
from .organization_assignment_services import (
    PERMISSION, _authorize, _has_management_grant, _unit_in_scope, _validate,
    create_assignment, refresh_membership,
    revoke_assignment, update_assignment,
)
from .permissions import memberships_in_scope


class AssignmentSerializer(serializers.ModelSerializer):
    version = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = OrganizationAssignment
        fields = ("id", "membership", "unit", "assignment_type", "position", "job_title",
                  "start_date", "end_date", "status", "note", "version", "created_at")
        read_only_fields = fields


class CreateSerializer(serializers.Serializer):
    company = serializers.UUIDField()
    membership = serializers.UUIDField()
    unit = serializers.UUIDField()
    assignment_type = serializers.ChoiceField(choices=OrganizationAssignment.Type.choices)
    position = serializers.UUIDField(required=False, allow_null=True)
    job_title = serializers.CharField(required=False, allow_blank=True, max_length=150)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True)
    transfer = serializers.BooleanField(required=False, default=False)


class UpdateSerializer(serializers.Serializer):
    version = serializers.DateTimeField()
    position = serializers.UUIDField(required=False, allow_null=True)
    job_title = serializers.CharField(required=False, allow_blank=True, max_length=150)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True)


class RevokeSerializer(serializers.Serializer):
    version = serializers.DateTimeField()
    reason = serializers.CharField()


class OrganizationAssignmentViewSet(GenericViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = AssignmentSerializer
    queryset = OrganizationAssignment.objects.select_related("membership__company", "membership__user__auth_user", "unit")
    http_method_names = ("get", "post", "patch", "head", "options")

    def _company(self, company_id):
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError, TypeError):
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        actor = getattr(self.request.user, "iam_account", None)
        if actor is None or not CompanyMembership.objects.filter(company=company, user=actor, membership_status="ACTIVE").exists():
            raise PermissionDenied("Không có Membership hợp lệ tại doanh nghiệp.")
        if not _has_management_grant(actor, company):
            raise PermissionDenied("Không có quyền quản lý phân công đơn vị.")
        return company, actor

    def get_queryset(self):
        company, actor = self._company(self.request.query_params.get("company_id"))
        allowed = memberships_in_scope(actor, company, PERMISSION)
        queryset = self.queryset.filter(membership__in=allowed)
        if membership_id := self.request.query_params.get("membership_id"):
            try:
                queryset = queryset.filter(membership_id=uuid.UUID(membership_id))
            except ValueError:
                raise ValidationError({"membership_id": "Membership ID không hợp lệ."})
        visible_ids = [item.pk for item in queryset if _unit_in_scope(actor, company, item.unit)]
        return queryset.filter(pk__in=visible_ids)

    def list(self, request):
        queryset = self.get_queryset()
        for membership_id in queryset.values_list("membership_id", flat=True).distinct():
            refresh_membership(CompanyMembership.objects.get(pk=membership_id))
        return Response(self.get_serializer(queryset, many=True).data)

    def retrieve(self, request, pk=None):
        item = self.get_object()
        refresh_membership(item.membership)
        item.refresh_from_db()
        return Response(self.get_serializer(item).data)

    def create(self, request):
        serializer = CreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        company, actor = self._company(data["company"])
        if not CompanyMembership.objects.filter(pk=data["membership"], company=company).exists():
            raise ValidationError({"membership": "Membership không thuộc doanh nghiệp."})
        item = create_assignment(membership_id=data["membership"], actor=actor, data=data, request=request)
        return Response(self.get_serializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("post",))
    def preview(self, request):
        serializer = CreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        company, actor = self._company(data["company"])
        membership = CompanyMembership.objects.filter(pk=data["membership"], company=company,
                                                       membership_status="ACTIVE", user__auth_user__is_active=True).first()
        if not membership:
            raise ValidationError({"membership": "Membership không hợp lệ."})
        unit, position, overlapping = _validate(membership, data)
        _authorize(actor, membership, unit)
        old_primary = list(overlapping.filter(assignment_type="PRIMARY")) if data["assignment_type"] == "PRIMARY" else []
        if old_primary and (len(old_primary) != 1 or old_primary[0].start_date >= data["start_date"]):
            raise ValidationError({"start_date": "Ngày chuyển phải sau ngày bắt đầu phân công chính cũ."})
        for item in old_primary:
            _authorize(actor, membership, item.unit)
        return Response({
            "membership": str(membership.pk), "unit": str(unit.pk),
            "assignment_type": data["assignment_type"], "position": str(position.pk) if position else None,
            "start_date": data["start_date"], "end_date": data.get("end_date"),
            "status": "SCHEDULED" if data["start_date"] > timezone.localdate() else "ACTIVE",
            "requires_transfer": bool(old_primary),
            "current_primary": [{"id": str(item.pk), "unit": str(item.unit_id),
                                 "start_date": item.start_date, "end_date": item.end_date} for item in old_primary],
        })

    def partial_update(self, request, pk=None):
        item = self.get_object()
        serializer = UpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = update_assignment(item_id=item.pk, actor=request.user.iam_account,
                                 data=serializer.validated_data, request=request)
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=("post",))
    def revoke(self, request, pk=None):
        item = self.get_object()
        serializer = RevokeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = revoke_assignment(item_id=item.pk, actor=request.user.iam_account,
                                 request=request, **serializer.validated_data)
        return Response(self.get_serializer(item).data)
