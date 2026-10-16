from rest_framework import serializers as drf_serializers, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from . import models, serializers, services
from .permissions import FixedAssetPermission


def permissions(resource):
    return {"GET": f"{resource}.VIEW", "POST": f"{resource}.CREATE", "PUT": f"{resource}.EDIT", "PATCH": f"{resource}.EDIT", "DELETE": f"{resource}.DELETE"}


class CompanyViewSet(ModelViewSet):
    permission_classes = (FixedAssetPermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    ordering = ("-created_at",)

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return super().get_queryset().filter(company_id=company) if company else super().get_queryset().none()

    def perform_create(self, serializer):
        fields = {field.name for field in serializer.Meta.model._meta.fields}
        obj = serializer.save(created_by=services.actor(self.request)) if "created_by" in fields else serializer.save()
        services.audit(self.request, obj, "CREATE", after=serializer.data)

    def perform_update(self, serializer):
        before = self.get_serializer(serializer.instance).data
        obj = serializer.save()
        services.audit(self.request, obj, "EDIT", before=before, after=serializer.data)


class CategoryViewSet(CompanyViewSet):
    queryset = models.AssetCategory.objects.select_related("company", "parent", "asset_account", "accumulated_account", "expense_account")
    serializer_class = serializers.CategorySerializer
    iam_permissions = permissions("FA.CATEGORY")
    search_fields = ("code", "name")
    ordering_fields = ("code", "name", "created_at")

    def perform_destroy(self, instance):
        if instance.assets.exists():
            raise drf_serializers.ValidationError("Nhóm đã được sử dụng không được xóa vật lý.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()


class AssetViewSet(CompanyViewSet):
    queryset = models.AssetRecord.objects.select_related("company", "category", "branch", "department", "custodian", "created_by")
    serializer_class = serializers.AssetSerializer
    iam_permissions = permissions("FA.ASSET")
    action_permissions = {"history": "FA.ASSET.VIEW"}
    search_fields = ("code", "name", "serial_number", "source_reference")
    ordering_fields = ("code", "acquisition_date", "original_cost", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        for field, parameter in (("asset_type", "asset_type"), ("status", "status"), ("category_id", "category_id"), ("branch_id", "branch_id"), ("department_id", "department_id")):
            if value := self.request.query_params.get(parameter):
                queryset = queryset.filter(**{field: value})
        return queryset

    def perform_destroy(self, instance):
        if instance.transactions.exists():
            raise drf_serializers.ValidationError("Tài sản đã phát sinh giao dịch không được xóa vật lý.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        asset = self.get_object()
        transactions = asset.transactions.select_related("created_by", "target_category", "target_branch", "target_department", "target_custodian")
        return Response({"asset": self.get_serializer(asset).data, "transactions": serializers.TransactionSerializer(transactions, many=True).data})


class TransactionViewSet(CompanyViewSet):
    queryset = models.AssetTransaction.objects.select_related("company", "asset", "created_by", "target_category", "target_branch", "target_department", "target_custodian")
    serializer_class = serializers.TransactionSerializer
    iam_permissions = permissions("FA.TRANSACTION")
    action_permissions = {
        "submit": "FA.TRANSACTION.SUBMIT", "approve": "FA.TRANSACTION.APPROVE",
        "reject": "FA.TRANSACTION.APPROVE", "post": "FA.TRANSACTION.POST",
        "reverse": "FA.TRANSACTION.REVERSE", "cancel": "FA.TRANSACTION.CANCEL",
        "post_gl": "FA.GL.POST", "gl_error": "FA.GL.POST",
    }
    search_fields = ("number", "asset__code", "asset__name", "source_reference", "reason")
    ordering_fields = ("transaction_date", "amount", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in ("transaction_type", "status", "asset_id", "period_code"):
            if value := self.request.query_params.get(field):
                queryset = queryset.filter(**{field: value})
        return queryset

    def perform_destroy(self, instance):
        if instance.status not in {"DRAFT", "REJECTED"}:
            raise drf_serializers.ValidationError("Chỉ giao dịch nháp hoặc bị từ chối mới được xóa.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        return Response(self.get_serializer(services.submit(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return Response(self.get_serializer(services.decide(self.get_object(), request, True)).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return Response(self.get_serializer(services.decide(self.get_object(), request, False)).data)

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        return Response(self.get_serializer(services.post_transaction(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def reverse(self, request, pk=None):
        reversal = services.reverse(self.get_object(), request)
        return Response(self.get_serializer(reversal).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        obj = self.get_object()
        if obj.status not in {"DRAFT", "REJECTED"}:
            raise drf_serializers.ValidationError("Chỉ giao dịch nháp hoặc bị từ chối mới được hủy.")
        old = obj.status
        obj.status = "CANCELLED"
        obj.save(update_fields=("status", "updated_at"))
        services.audit(request, obj, "CANCEL", {"status": old}, {"status": obj.status}, request.data.get("reason", ""))
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=("post",), url_path="post-gl")
    def post_gl(self, request, pk=None):
        return Response(self.get_serializer(services.post_gl(self.get_object(), request)).data)

    @action(detail=True, methods=("post",), url_path="gl-error")
    def gl_error(self, request, pk=None):
        obj = self.get_object()
        if obj.status != "POSTED" or obj.gl_status in {"POSTED", "NOT_REQUIRED"}:
            raise drf_serializers.ValidationError("Trạng thái giao dịch không hợp lệ.")
        obj.gl_status = "ERROR"
        obj.save(update_fields=("gl_status", "updated_at"))
        services.audit(request, obj, "GL_ERROR", after={"error": request.data.get("error", "")})
        return Response(self.get_serializer(obj).data)


class CalculationRunViewSet(CompanyViewSet):
    queryset = models.CalculationRun.objects.select_related("company", "created_by").prefetch_related("lines__asset", "lines__transaction")
    serializer_class = serializers.CalculationRunSerializer
    iam_permissions = permissions("FA.CALCULATION")
    action_permissions = {"calculate": "FA.CALCULATION.CALCULATE", "post": "FA.CALCULATION.POST"}
    search_fields = ("number", "period_code")
    ordering_fields = ("period_start", "period_end", "total_amount", "created_at")

    def perform_destroy(self, instance):
        if instance.status != "DRAFT":
            raise drf_serializers.ValidationError("Chỉ bảng tính nháp mới được xóa.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=True, methods=("post",))
    def calculate(self, request, pk=None):
        return Response(self.get_serializer(services.calculate(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        return Response(self.get_serializer(services.post_run(self.get_object(), request)).data)


class PeriodViewSet(ModelViewSet):
    permission_classes = (FixedAssetPermission,)
    serializer_class = serializers.PeriodSerializer
    queryset = models.AssetPeriod.objects.select_related("company")
    iam_permissions = permissions("FA.PERIOD")

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class ApprovalViewSet(ReadOnlyModelViewSet):
    permission_classes = (FixedAssetPermission,)
    serializer_class = serializers.ApprovalSerializer
    queryset = models.ApprovalDecision.objects.select_related("company", "transaction", "actor")
    iam_permissions = {"GET": "FA.APPROVAL.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()

