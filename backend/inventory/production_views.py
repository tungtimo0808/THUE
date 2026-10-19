from django.db import transaction
from rest_framework import mixins, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from master_data.models import Item
from organization.models import Company

from . import models, services
from .permissions import InventoryPermission


class ProductionOrderLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = models.ProductionOrderLine
        fields = ("role", "line_no", "item", "item_code", "item_name", "quantity", "note")


class ProductionOrderSerializer(serializers.ModelSerializer):
    lines = ProductionOrderLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.ProductionOrder
        fields = ("id", "company", "number", "document_date", "due_date", "description", "status", "lines", "created_at")


STATUSES = {"PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"}


class ProductionOrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, GenericViewSet):
    permission_classes = (InventoryPermission,)
    serializer_class = ProductionOrderSerializer
    queryset = models.ProductionOrder.objects.prefetch_related("lines__item")
    iam_permissions = {"GET": "INV.PRODUCTION.VIEW", "POST": "INV.PRODUCTION.CREATE"}
    action_permissions = {"set_status": "INV.PRODUCTION.EDIT"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
        if not company:
            raise serializers.ValidationError({"company": "Không tìm thấy doanh nghiệp."})
        number = str(request.data.get("number") or "").strip()
        if not number or models.ProductionOrder.objects.filter(company=company, number=number).exists():
            raise serializers.ValidationError({"number": "Số lệnh sản xuất trống hoặc đã tồn tại."})
        products = request.data.get("products") or []
        if not products:
            raise serializers.ValidationError({"products": "Lệnh sản xuất cần ít nhất một thành phẩm."})
        state = request.data.get("status") or "IN_PROGRESS"
        if state not in STATUSES:
            raise serializers.ValidationError({"status": "Trạng thái không hợp lệ."})
        order = models.ProductionOrder.objects.create(
            company=company, number=number, document_date=request.data["document_date"],
            due_date=request.data.get("due_date") or None, description=str(request.data.get("description") or "")[:500],
            status=state, created_by=services.actor(request),
        )
        for role, rows in (("PRODUCT", products), ("MATERIAL", request.data.get("materials") or [])):
            for index, row in enumerate(rows, start=1):
                item = Item.objects.filter(company=company, pk=row.get("item")).first()
                if not item:
                    raise serializers.ValidationError({"lines": "Mã hàng không thuộc doanh nghiệp."})
                quantity = row.get("quantity")
                if role == "PRODUCT" and not quantity:
                    raise serializers.ValidationError({"products": f"Nhập số lượng thành phẩm {item.code}."})
                models.ProductionOrderLine.objects.create(order=order, role=role, line_no=index, item=item,
                    quantity=quantity or None, note=str(row.get("note") or "")[:255])
        services.audit(request, order, "CREATE", after={"number": number})
        return Response(self.get_serializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="set-status")
    def set_status(self, request, pk=None):
        order = self.get_object()
        state = request.data.get("status")
        if state not in STATUSES or order.status in ("COMPLETED", "CANCELLED"):
            raise serializers.ValidationError({"status": "Không chuyển được trạng thái lệnh sản xuất."})
        before = order.status
        order.status = state
        order.save(update_fields=("status",))
        services.audit(request, order, "STATUS", before={"status": before}, after={"status": state})
        return Response(self.get_serializer(order).data)
