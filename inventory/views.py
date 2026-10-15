from decimal import Decimal

from django.db.models import Q, Sum
from django.utils.dateparse import parse_date
from rest_framework import mixins, serializers as drf_serializers, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet, ReadOnlyModelViewSet

from . import models, serializers, services
from .permissions import InventoryPermission


def permissions(resource):
    return {"GET": f"{resource}.VIEW", "POST": f"{resource}.CREATE", "PUT": f"{resource}.EDIT", "PATCH": f"{resource}.EDIT", "DELETE": f"{resource}.CANCEL"}


class CompanyViewSet(ModelViewSet):
    permission_classes = (InventoryPermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    ordering = ("-created_at",)

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        queryset = super().get_queryset()
        return queryset.filter(company_id=company_id) if company_id else queryset.none()

    def perform_create(self, serializer):
        obj = serializer.save(created_by=services.actor(self.request)) if "created_by" in [f.name for f in serializer.Meta.model._meta.fields] else serializer.save()
        services.audit(self.request, obj, "CREATE", after=serializer.data)

    def perform_update(self, serializer):
        before = self.get_serializer(serializer.instance).data
        obj = serializer.save()
        services.audit(self.request, obj, "EDIT", before=before, after=serializer.data)

    def perform_destroy(self, instance):
        if hasattr(instance, "status") and instance.status != "DRAFT":
            raise drf_serializers.ValidationError("Chỉ chứng từ nháp mới được xóa.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()


class PolicyViewSet(CompanyViewSet):
    queryset = models.InventoryPolicy.objects.select_related("company", "warehouse", "item", "base_uom")
    serializer_class = serializers.PolicySerializer
    iam_permissions = permissions("INV.POLICY")
    search_fields = ("warehouse__code", "warehouse__name", "item__code", "item__name")
    ordering_fields = ("minimum_quantity", "maximum_quantity", "created_at")

    def perform_create(self, serializer):
        obj = serializer.save()
        services.audit(self.request, obj, "CREATE", after=serializer.data)


class LotSerialViewSet(CompanyViewSet):
    queryset = models.LotSerial.objects.select_related("company", "item")
    serializer_class = serializers.LotSerialSerializer
    iam_permissions = permissions("INV.LOT_SERIAL")
    action_permissions = {"trace": "INV.LOT_SERIAL.VIEW"}
    search_fields = ("code", "item__code", "item__name")
    ordering_fields = ("expiry_date", "created_at")

    def perform_create(self, serializer):
        obj = serializer.save()
        services.audit(self.request, obj, "CREATE", after=serializer.data)

    @action(detail=True, methods=("get",))
    def trace(self, request, pk=None):
        obj = self.get_object()
        movements = models.StockMovement.objects.filter(lot_serial=obj).select_related("warehouse", "transaction", "line")
        return Response({"lot_serial": self.get_serializer(obj).data, "movements": serializers.MovementSerializer(movements, many=True).data})


class TransactionViewSet(CompanyViewSet):
    queryset = models.InventoryTransaction.objects.select_related("company", "source_warehouse", "destination_warehouse", "created_by").prefetch_related("lines")
    serializer_class = serializers.TransactionSerializer
    iam_permissions = permissions("INV.TRANSACTION")
    action_permissions = {
        "submit": "INV.TRANSACTION.SUBMIT", "approve": "INV.TRANSACTION.APPROVE",
        "reject": "INV.TRANSACTION.APPROVE", "post": "INV.TRANSACTION.POST",
        "reverse": "INV.TRANSACTION.CANCEL", "cancel": "INV.TRANSACTION.CANCEL",
        "post_gl": "INV.GL.POST", "gl_error": "INV.GL.POST",
    }
    search_fields = ("number", "source_reference", "reason")
    ordering_fields = ("transaction_date", "total_value", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        if kind := self.request.query_params.get("transaction_type"):
            queryset = queryset.filter(transaction_type=kind)
        if state := self.request.query_params.get("status"):
            queryset = queryset.filter(status=state)
        if warehouse := self.request.query_params.get("warehouse_id"):
            queryset = queryset.filter(Q(source_warehouse_id=warehouse) | Q(destination_warehouse_id=warehouse))
        return queryset

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
        return Response(self.get_serializer(services.post(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def reverse(self, request, pk=None):
        return Response(self.get_serializer(services.reverse(self.get_object(), request)).data)

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
        if obj.status != "POSTED" or obj.gl_status == "POSTED":
            raise drf_serializers.ValidationError("Trạng thái giao dịch không hợp lệ.")
        obj.gl_status = "ERROR"
        obj.save(update_fields=("gl_status", "updated_at"))
        services.audit(request, obj, "GL_ERROR", after={"error": request.data.get("error", "")})
        return Response(self.get_serializer(obj).data)


class BalanceViewSet(ReadOnlyModelViewSet):
    permission_classes = (InventoryPermission,)
    serializer_class = serializers.BalanceSerializer
    queryset = models.StockBalance.objects.select_related("company", "warehouse", "item", "location", "lot_serial")
    iam_permissions = {"GET": "INV.BALANCE.VIEW"}
    action_permissions = {"history": "INV.BALANCE.VIEW", "as_of": "INV.BALANCE.VIEW"}
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("warehouse__code", "item__code", "item__name", "lot_serial__code")
    ordering_fields = ("quantity", "inventory_value", "updated_at")

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        for field, param in (("warehouse_id", "warehouse_id"), ("item_id", "item_id"), ("lot_serial_id", "lot_serial_id")):
            if value := self.request.query_params.get(param):
                queryset = queryset.filter(**{field: value})
        return queryset

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        balance = self.get_object()
        movements = models.StockMovement.objects.filter(
            warehouse=balance.warehouse, item=balance.item, location=balance.location, lot_serial=balance.lot_serial,
        ).select_related("transaction", "line")
        return Response(serializers.MovementSerializer(movements, many=True).data)

    @action(detail=False, methods=("get",), url_path="as-of")
    def as_of(self, request):
        at_date = parse_date(request.query_params.get("date", ""))
        if not at_date:
            raise drf_serializers.ValidationError({"date": "Ngày tra cứu không hợp lệ."})
        movements = models.StockMovement.objects.filter(company_id=request.query_params.get("company_id"), movement_date__lte=at_date)
        if warehouse := request.query_params.get("warehouse_id"):
            movements = movements.filter(warehouse_id=warehouse)
        if item := request.query_params.get("item_id"):
            movements = movements.filter(item_id=item)
        rows = movements.values("warehouse_id", "item_id", "location_id", "lot_serial_id").annotate(
            quantity=Sum("quantity_delta"), inventory_value=Sum("value_delta")
        ).order_by("warehouse_id", "item_id")
        return Response(list(rows))


class MovementViewSet(ReadOnlyModelViewSet):
    permission_classes = (InventoryPermission,)
    serializer_class = serializers.MovementSerializer
    queryset = models.StockMovement.objects.select_related("company", "transaction", "line", "warehouse", "item", "lot_serial")
    iam_permissions = {"GET": "INV.BALANCE.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class StockCountViewSet(CompanyViewSet):
    queryset = models.StockCount.objects.select_related("company", "warehouse", "created_by", "adjustment_transaction").prefetch_related("lines")
    serializer_class = serializers.StockCountSerializer
    iam_permissions = permissions("INV.COUNT")
    action_permissions = {"create_adjustment": "INV.COUNT.COUNT"}
    search_fields = ("number", "warehouse__code", "notes")
    ordering_fields = ("count_date", "created_at")

    @action(detail=True, methods=("post",), url_path="create-adjustment")
    def create_adjustment(self, request, pk=None):
        obj = services.create_count_adjustment(self.get_object(), request)
        return Response(serializers.TransactionSerializer(obj).data, status=status.HTTP_201_CREATED)


class AssemblyViewSet(CompanyViewSet):
    queryset = models.AssemblyOrder.objects.select_related("company", "warehouse", "created_by").prefetch_related("lines")
    serializer_class = serializers.AssemblySerializer
    iam_permissions = permissions("INV.ASSEMBLY")
    action_permissions = {"post": "INV.ASSEMBLY.POST"}
    search_fields = ("number", "warehouse__code")
    ordering_fields = ("assembly_date", "created_at")

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        return Response(self.get_serializer(services.post_assembly(self.get_object(), request)).data)


class ValuationViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    permission_classes = (InventoryPermission,)
    serializer_class = serializers.ValuationSerializer
    queryset = models.ValuationRun.objects.select_related("company", "warehouse", "created_by")
    iam_permissions = {"GET": "INV.VALUATION.VIEW", "POST": "INV.VALUATION.RUN"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()

    def perform_create(self, serializer):
        serializer.instance = services.run_valuation(serializer.validated_data, self.request)


class PeriodViewSet(ModelViewSet):
    permission_classes = (InventoryPermission,)
    serializer_class = serializers.PeriodSerializer
    queryset = models.InventoryPeriod.objects.select_related("company")
    iam_permissions = permissions("INV.PERIOD")

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class ApprovalViewSet(ReadOnlyModelViewSet):
    permission_classes = (InventoryPermission,)
    serializer_class = serializers.ApprovalSerializer
    queryset = models.ApprovalDecision.objects.select_related("company", "transaction", "actor")
    iam_permissions = {"GET": "INV.APPROVAL.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()
