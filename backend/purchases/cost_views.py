from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from organization.models import Company
from . import cost_serializers, cost_services, models
from .permissions import PurchasePermission


class PurchaseCostViewSet(ModelViewSet):
    """
    UC-PUR-11: Ghi nhận chi phí mua hàng.
    Provides CRUD, submit, approve, reject, post, and cancel workflows for purchase cost documents.
    """
    permission_classes = (PurchasePermission,)
    serializer_class = cost_serializers.PurchaseCostSerializer
    action_permissions = {
        "list": "PUR.COST.VIEW",
        "retrieve": "PUR.COST.VIEW",
        "create": "PUR.COST.CREATE",
        "update": "PUR.COST.EDIT",
        "partial_update": "PUR.COST.EDIT",
        "destroy": "PUR.COST.DELETE",
        "submit": "PUR.COST.SUBMIT",
        "approve": "PUR.COST.APPROVE",
        "reject": "PUR.COST.APPROVE",
        "post": "PUR.COST.POST",
        "cancel": "PUR.COST.CANCEL",
        "eligible_purchases": "PUR.COST.VIEW",
    }

    def get_company(self):
        company_id = (
            self.request.query_params.get("company_id")
            or self.request.data.get("company")
            or (self.request.data.get("company_id") if isinstance(self.request.data, dict) else None)
        )
        if not company_id and self.kwargs.get("pk"):
            cost = models.PurchaseCost.objects.filter(pk=self.kwargs["pk"]).first()
            if cost:
                return cost.company
        if not company_id:
            raise ValidationError("Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên.")
        try:
            return Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError("Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên.")

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id:
            return models.PurchaseCost.objects.none()

        qs = models.PurchaseCost.objects.filter(company_id=company_id).select_related(
            "company", "branch", "supplier", "payment_account", "supplier_invoice", "created_by"
        ).prefetch_related(
            "lines__tax_rate",
            "lines__account",
            "lines__cost_center",
            "lines__expense_item",
            "related_orders",
            "related_goods_purchases",
        )

        number = self.request.query_params.get("number") or self.request.query_params.get("code")
        if number:
            qs = qs.filter(number__icontains=number.strip())

        supplier = self.request.query_params.get("supplier") or self.request.query_params.get("supplier_id")
        if supplier:
            qs = qs.filter(supplier_id=supplier)

        doc_status = self.request.query_params.get("status")
        if doc_status:
            qs = qs.filter(status=doc_status)

        allocation_status = self.request.query_params.get("allocation_status")
        if allocation_status:
            qs = qs.filter(allocation_status=allocation_status)

        date_from = self.request.query_params.get("date_from") or self.request.query_params.get("document_date_from")
        if date_from:
            qs = qs.filter(document_date__gte=date_from)

        date_to = self.request.query_params.get("date_to") or self.request.query_params.get("document_date_to")
        if date_to:
            qs = qs.filter(document_date__lte=date_to)

        return qs.order_by("-document_date", "-created_at")

    def create(self, request, *args, **kwargs):
        company = self.get_company()
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        data["company"] = company
        cost = cost_services.create_purchase_cost(request, data)
        serializer = self.get_serializer(cost)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        cost = self.get_object()
        updated_cost = cost_services.update_purchase_cost(cost, request, request.data)
        serializer = self.get_serializer(updated_cost)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        cost = self.get_object()
        if cost.status == "POSTED":
            raise ValidationError("Chứng từ Đã ghi sổ không được xóa trực tiếp.")
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        cost = self.get_object()
        submitted = cost_services.submit_purchase_cost(cost, request)
        serializer = self.get_serializer(submitted)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        cost = self.get_object()
        approved = cost_services.approve_purchase_cost(cost, request)
        serializer = self.get_serializer(approved)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        cost = self.get_object()
        rejected = cost_services.reject_purchase_cost(cost, request)
        serializer = self.get_serializer(rejected)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def post(self, request, pk=None):
        cost = self.get_object()
        posted = cost_services.post_purchase_cost(cost, request)
        serializer = self.get_serializer(posted)
        return Response({
            "detail": "Ghi sổ chứng từ chi phí mua hàng thành công.",
            "data": serializer.data,
        })

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        cost = self.get_object()
        cancelled = cost_services.cancel_purchase_cost(cost, request)
        serializer = self.get_serializer(cancelled)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="eligible-purchases")
    def eligible_purchases(self, request):
        """
        Return eligible purchase orders and goods purchases for linking (Steps 12-16).
        Must be APPROVED or POSTED, not DRAFT and not CANCELLED (BR-PUR-CST-08, 11).
        """
        company = self.get_company()
        orders = models.PurchaseOrder.objects.filter(
            company=company,
            status__in=[
                models.DocumentStatus.APPROVED,
                models.DocumentStatus.IN_PROGRESS,
                models.DocumentStatus.PARTIALLY_RECEIVED,
                models.DocumentStatus.FULLY_RECEIVED,
                models.DocumentStatus.COMPLETED,
            ],
        ).order_by("-document_date", "-created_at")

        goods = models.GoodsPurchase.objects.filter(
            company=company,
            status__in=[models.DocumentStatus.APPROVED, "POSTED"],
        ).order_by("-document_date", "-created_at")

        return Response({
            "orders": cost_serializers.EligiblePurchaseOrderSerializer(orders, many=True).data,
            "goods_purchases": cost_serializers.EligibleGoodsPurchaseSerializer(goods, many=True).data,
        })
