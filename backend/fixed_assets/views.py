import logging

from django.utils import timezone
from rest_framework import serializers as drf_serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from . import models, serializers, services
from .permissions import FixedAssetPermission

logger = logging.getLogger(__name__)


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



class RevaluationViewSet(CompanyViewSet):
    """UC-FA-06 – Đánh giá lại tài sản cố định."""
    queryset = models.AssetRevaluation.objects.select_related("company", "journal_entry", "created_by").prefetch_related(
        "members", "lines__asset__department", "lines__expense_account", "lines__revaluation_account",
        "entries__debit_account", "entries__credit_account", "entries__party", "entries__expense_item", "entries__department")
    serializer_class = serializers.RevaluationSerializer
    iam_permissions = permissions("FA.REVALUATION")
    action_permissions = {
        "post": "FA.REVALUATION.POST", "reverse": "FA.REVALUATION.REVERSE", "candidates": "FA.REVALUATION.VIEW",
        "next_number": "FA.REVALUATION.VIEW", "attachments": "FA.REVALUATION.EDIT", "attachment_file": "FA.REVALUATION.VIEW",
        "remove_attachment": "FA.REVALUATION.EDIT",
    }
    search_fields = ("number", "record_number", "lines__asset__code", "lines__asset__name")
    ordering_fields = ("posting_date", "number", "created_at")

    def permission_denied(self, request, message=None, code=None):
        if self.action in {"create", "post", "update", "partial_update"}:
            from .revaluation import MESSAGES
            message = MESSAGES["EF01"]
        super().permission_denied(request, message=message, code=code)

    def create(self, request, *args, **kwargs):
        # EF28: a repeated "Cất" with the same key returns the document already created.
        key = request.data.get("idempotency_key")
        existing = models.AssetRevaluation.objects.filter(company_id=request.data.get("company"), idempotency_key=key).first() if key else None
        if existing:
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

    def perform_destroy(self, instance):
        if instance.status != "DRAFT":
            raise drf_serializers.ValidationError("Chỉ xóa được chứng từ chưa ghi sổ.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=False, methods=("get",))
    def candidates(self, request):
        from django.utils.dateparse import parse_date
        from organization.models import Company
        from .revaluation import candidates
        on = parse_date(request.query_params.get("date", "")) or timezone.localdate()
        return Response(candidates(Company.objects.get(pk=request.query_params.get("company_id")), on))

    @action(detail=False, methods=("get",), url_path="next-number")
    def next_number(self, request):
        from organization.models import Company
        from .revaluation import next_number
        return Response({"number": next_number(Company.objects.get(pk=request.query_params.get("company_id")))})

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        from .revaluation import MESSAGES, post
        obj = self.get_object()
        try:
            obj = post(obj, request)
        except drf_serializers.ValidationError:
            raise
        except Exception:
            # EF27: the transaction rolled back; nothing was recorded.
            logger.exception("Posting revaluation %s failed", obj.pk)
            raise drf_serializers.ValidationError(MESSAGES["EF27"])
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=("post",))
    def reverse(self, request, pk=None):
        from .revaluation import reverse
        return Response(self.get_serializer(reverse(self.get_object(), request, request.data.get("reason", ""))).data)

    @action(detail=True, methods=("post",), parser_classes=(MultiPartParser, FormParser))
    def attachments(self, request, pk=None):
        from .revaluation import add_attachment
        return Response(self.get_serializer(add_attachment(self.get_object(), request, request.FILES.get("file"))).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("get",), url_path=r"attachments/(?P<attachment_id>[0-9a-f-]{36})")
    def attachment_file(self, request, pk=None, attachment_id=None):
        from django.http import FileResponse
        from .revaluation import attachment_file
        entry, handle = attachment_file(self.get_object(), attachment_id)
        return FileResponse(handle, as_attachment=True, filename=entry["name"], content_type=entry.get("content_type") or None)

    @action(detail=True, methods=("post",), url_path=r"attachments/(?P<attachment_id>[0-9a-f-]{36})/remove")
    def remove_attachment(self, request, pk=None, attachment_id=None):
        from .revaluation import remove_attachment
        return Response(self.get_serializer(remove_attachment(self.get_object(), request, attachment_id)).data)
