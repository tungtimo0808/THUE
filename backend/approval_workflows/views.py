import uuid

from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from master_data.models import DocumentType
from organization.models import Company

from . import services
from .models import ApprovalPolicy, DocumentApprovalPolicy, Workflow, WorkflowVersion


class PolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentApprovalPolicy
        fields = ("id", "company", "document_type", "policy", "updated_at")


class PolicyWriteSerializer(serializers.Serializer):
    company = serializers.UUIDField()
    document_type = serializers.UUIDField()
    policy = serializers.ChoiceField(choices=ApprovalPolicy.choices)


class WorkflowSerializer(serializers.ModelSerializer):
    latest_version = serializers.SerializerMethodField()
    priority = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()

    class Meta:
        model = Workflow
        fields = ("id", "company", "document_type", "code", "name", "description", "priority",
                  "latest_version", "created_at", "updated_at")

    def get_latest_version(self, obj):
        item = obj.versions.order_by("-number").first()
        return VersionSerializer(item).data if item else None

    def get_priority(self, obj):
        item = obj.versions.order_by("-number").first()
        return item.priority if item else 0

    def get_name(self, obj):
        item = obj.versions.order_by("-number").first()
        return item.name if item else obj.name

    def get_description(self, obj):
        item = obj.versions.order_by("-number").first()
        return item.description if item else obj.description


class VersionSerializer(serializers.ModelSerializer):
    version = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = WorkflowVersion
        fields = ("id", "workflow", "number", "name", "description", "priority", "status", "effective_from", "effective_to",
                  "conditions", "steps", "allow_self_approval", "version", "activated_at", "created_at")


class CreateSerializer(serializers.Serializer):
    company = serializers.UUIDField()
    document_type = serializers.UUIDField()
    code = serializers.CharField(max_length=80)
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.IntegerField(required=False, default=0)
    effective_from = serializers.DateField()
    effective_to = serializers.DateField(required=False, allow_null=True)
    conditions = serializers.JSONField(required=False, default=dict)
    steps = serializers.JSONField(required=False, default=list)
    allow_self_approval = serializers.BooleanField(required=False, default=False)


class UpdateSerializer(serializers.Serializer):
    version = serializers.DateTimeField()
    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.IntegerField(required=False)
    effective_from = serializers.DateField(required=False)
    effective_to = serializers.DateField(required=False, allow_null=True)
    conditions = serializers.JSONField(required=False)
    steps = serializers.JSONField(required=False)
    allow_self_approval = serializers.BooleanField(required=False)


class VersionTokenSerializer(serializers.Serializer):
    version = serializers.DateTimeField()


class CloneSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=80)
    name = serializers.CharField(max_length=255)


class ValidateSerializer(serializers.Serializer):
    samples = serializers.ListField(child=serializers.JSONField(), required=False, default=list, max_length=20)


def company_actor(request, company_id):
    try:
        company_uuid = uuid.UUID(str(company_id))
    except (TypeError, ValueError):
        raise serializers.ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})
    company = get_object_or_404(Company, pk=company_uuid)
    actor = getattr(request.user, "iam_account", None)
    if actor is None:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Tài khoản chưa được liên kết IAM.")
    services.authorize(actor, company)
    return company, actor


class PolicyViewSet(GenericViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = PolicySerializer
    queryset = DocumentApprovalPolicy.objects.all()
    http_method_names = ("get", "post", "head", "options")

    def list(self, request):
        company, _ = company_actor(request, request.query_params.get("company_id"))
        return Response(self.get_serializer(self.queryset.filter(company=company), many=True).data)

    def create(self, request):
        serializer = PolicyWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        company, actor = company_actor(request, data["company"])
        item = services.set_policy(company=company, document_type_id=data["document_type"],
                                   policy=data["policy"], actor=actor, request=request)
        return Response(self.get_serializer(item).data)


class WorkflowViewSet(GenericViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = WorkflowSerializer
    queryset = Workflow.objects.select_related("company", "document_type")
    http_method_names = ("get", "post", "head", "options")

    def get_queryset(self):
        company, _ = company_actor(self.request, self.request.query_params.get("company_id"))
        return self.queryset.filter(company=company)

    def list(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        return Response(self.get_serializer(get_object_or_404(self.get_queryset(), pk=pk)).data)

    def create(self, request):
        serializer = CreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        company, actor = company_actor(request, data["company"])
        workflow, _ = services.create_workflow(company=company, actor=actor, data=data, request=request)
        return Response(self.get_serializer(workflow).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="new-version")
    def new_version(self, request, pk=None):
        workflow = get_object_or_404(self.get_queryset(), pk=pk)
        version = services.new_version(workflow=workflow, actor=request.user.iam_account, request=request)
        return Response(VersionSerializer(version).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def clone(self, request, pk=None):
        workflow = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = CloneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new, _ = services.clone_workflow(source=workflow, actor=request.user.iam_account,
                                         request=request, **serializer.validated_data)
        return Response(self.get_serializer(new).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        workflow = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(VersionSerializer(workflow.versions.all(), many=True).data)


class VersionViewSet(GenericViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = VersionSerializer
    queryset = WorkflowVersion.objects.select_related("workflow__company", "workflow__document_type")
    http_method_names = ("get", "patch", "post", "head", "options")

    def get_queryset(self):
        company, _ = company_actor(self.request, self.request.query_params.get("company_id"))
        return self.queryset.filter(workflow__company=company)

    def retrieve(self, request, pk=None):
        return Response(self.get_serializer(get_object_or_404(self.get_queryset(), pk=pk)).data)

    def partial_update(self, request, pk=None):
        version = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = UpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = services.update_draft(version_id=version.pk, actor=request.user.iam_account,
                                        data=serializer.validated_data, request=request)
        return Response(self.get_serializer(version).data)

    @action(detail=True, methods=("post",))
    def validate(self, request, pk=None):
        version = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = ValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(services.check_version(version, serializer.validated_data["samples"]))

    @action(detail=True, methods=("post",))
    def activate(self, request, pk=None):
        version = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = VersionTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = services.activate(version_id=version.pk, actor=request.user.iam_account,
                                    version_token=serializer.validated_data["version"], request=request)
        return Response(self.get_serializer(version).data)

    @action(detail=True, methods=("post",))
    def stop(self, request, pk=None):
        version = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = VersionTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = services.stop(version_id=version.pk, actor=request.user.iam_account,
                                version_token=serializer.validated_data["version"], request=request)
        return Response(self.get_serializer(version).data)

    @action(detail=True, methods=("post",))
    def archive(self, request, pk=None):
        version = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = VersionTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = services.archive(version_id=version.pk, actor=request.user.iam_account,
                                   version_token=serializer.validated_data["version"], request=request)
        return Response(self.get_serializer(version).data)
