from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from organization.models import Company

from . import models, tracking_serializers, tracking_services
from .permissions import SalesPermission


class SalesOrderTrackingViewSet(ViewSet):
    """
    UC-SAL-09: Theo dõi thực hiện đơn bán (Sales Order Fulfillment Tracking).
    Read-only aggregation and multi-tab monitoring interface.
    """
    permission_classes = (SalesPermission,)
    action_permissions = {
        "list": "SAL.TRACKING.VIEW",
        "retrieve": "SAL.TRACKING.VIEW",
        "export": "SAL.TRACKING.EXPORT",
        "delivery_tab": "SAL.TRACKING.VIEW",
        "sales_invoice_tab": "SAL.TRACKING.VIEW",
        "payment_tab": "SAL.TRACKING.VIEW",
    }

    def get_company(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError("Doanh nghiệp là bắt buộc.")
        try:
            return Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError("Doanh nghiệp không hợp lệ.")

    def list(self, request):
        company = self.get_company(request)
        queryset = tracking_services.get_order_tracking_queryset(company, request.query_params)

        summaries = [tracking_services.compute_order_tracking_summary(order) for order in queryset]
        filtered_summaries = tracking_services.filter_summaries_by_computed_fields(
            summaries, request.query_params
        )

        if not filtered_summaries:
            return Response({
                "count": 0,
                "results": [],
                "message": "Không tìm thấy đơn bán phù hợp với điều kiện tìm kiếm.",
            })

        serializer = tracking_serializers.OrderTrackingListItemSerializer(filtered_summaries, many=True)
        return Response({
            "count": len(filtered_summaries),
            "results": serializer.data,
        })

    def retrieve(self, request, pk=None):
        company = self.get_company(request)
        order = models.SalesOrder.objects.filter(
            pk=pk, company=company
        ).exclude(
            status__in=[
                models.DocumentStatus.DRAFT,
                models.DocumentStatus.PENDING_APPROVAL,
                models.DocumentStatus.REJECTED,
            ]
        ).select_related(
            "company", "branch", "customer", "currency", "assigned_employee", "payment_term"
        ).first()

        if not order:
            raise NotFound("Đơn bán hàng không tồn tại hoặc chưa được xác nhận.")

        detail_data = tracking_services.compute_order_tracking_detail(order)
        serializer = tracking_serializers.OrderTrackingDetailSerializer(detail_data)
        return Response(serializer.data)

    @action(detail=False, methods=("get",), url_path="export")
    def export(self, request):
        company = self.get_company(request)
        queryset = tracking_services.get_order_tracking_queryset(company, request.query_params)
        summaries = [tracking_services.compute_order_tracking_summary(order) for order in queryset]
        filtered_summaries = tracking_services.filter_summaries_by_computed_fields(
            summaries, request.query_params
        )

        csv_content = tracking_services.generate_tracking_export_csv(filtered_summaries)
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="theo_doi_don_ban.csv"'
        return response

    @action(detail=True, methods=("get",), url_path="delivery-tab")
    def delivery_tab(self, request, pk=None):
        company = self.get_company(request)
        order = models.SalesOrder.objects.filter(pk=pk, company=company).first()
        if not order:
            raise NotFound("Đơn bán hàng không tồn tại.")
        detail_data = tracking_services.compute_order_tracking_detail(order)
        return Response(detail_data["delivery_tab"])

    @action(detail=True, methods=("get",), url_path="sales-invoice-tab")
    def sales_invoice_tab(self, request, pk=None):
        company = self.get_company(request)
        order = models.SalesOrder.objects.filter(pk=pk, company=company).first()
        if not order:
            raise NotFound("Đơn bán hàng không tồn tại.")
        detail_data = tracking_services.compute_order_tracking_detail(order)
        return Response(detail_data["sales_invoice_tab"])

    @action(detail=True, methods=("get",), url_path="payment-tab")
    def payment_tab(self, request, pk=None):
        company = self.get_company(request)
        order = models.SalesOrder.objects.filter(pk=pk, company=company).first()
        if not order:
            raise NotFound("Đơn bán hàng không tồn tại.")
        detail_data = tracking_services.compute_order_tracking_detail(order)
        return Response(detail_data["payment_tab"])
