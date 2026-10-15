from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from organization.models import Company
from . import models, sales_allowance_serializers, sales_allowance_services
from .permissions import SalesPermission


def perms(resource):
    return {
        "GET": f"{resource}.VIEW",
        "POST": f"{resource}.CREATE",
        "PUT": f"{resource}.EDIT",
        "PATCH": f"{resource}.EDIT",
        "DELETE": f"{resource}.EDIT",
    }


class SalesAllowanceViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    permission_classes = (SalesPermission,)
    serializer_class = sales_allowance_serializers.SalesAllowanceSerializer
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = (
        "number",
        "customer__name",
        "goods_sale__number",
        "service_sale__number",
        "allowance_reason",
    )
    ordering_fields = ("document_date", "posting_date", "total_amount", "created_at")
    ordering = ("-document_date", "-created_at")

    iam_permissions = perms("SAL.SALES_ALLOWANCE")
    action_permissions = {
        "defaults": "SAL.SALES_ALLOWANCE.VIEW",
        "prepare_from_sale": "SAL.SALES_ALLOWANCE.CREATE",
        "submit": "SAL.SALES_ALLOWANCE.SUBMIT",
        "withdraw": "SAL.SALES_ALLOWANCE.SUBMIT",
        "approve": "SAL.SALES_ALLOWANCE.APPROVE",
        "request_revision": "SAL.SALES_ALLOWANCE.REJECT",
        "reject": "SAL.SALES_ALLOWANCE.REJECT",
        "post": "SAL.SALES_ALLOWANCE.POST",
        "unpost": "SAL.SALES_ALLOWANCE.UNPOST",
        "cancel": "SAL.SALES_ALLOWANCE.CANCEL",
        "refund": "SAL.SALES_ALLOWANCE.REFUND",
        "link_invoice": "SAL.SALES_ALLOWANCE.EDIT",
    }

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        if not company and self.action == "list":
            return models.SalesAllowance.objects.none()

        qs = models.SalesAllowance.objects.all().select_related(
            "company", "branch", "customer", "goods_sale", "service_sale", "currency",
            "original_tax_invoice", "tax_invoice",
            "journal_entry", "created_by", "posted_by"
        ).prefetch_related(
            "lines__item", "lines__uom",
            "lines__revenue_deduction_account", "lines__tax_account",
            "lines__receivable_account",
        )

        customer = self.request.query_params.get("customer_id")
        if customer:
            qs = qs.filter(customer_id=customer)

        status_val = self.request.query_params.get("status")
        if status_val:
            qs = qs.filter(status=status_val)

        from_date = self.request.query_params.get("from_date")
        if from_date:
            qs = qs.filter(document_date__gte=from_date)

        to_date = self.request.query_params.get("to_date")
        if to_date:
            qs = qs.filter(document_date__lte=to_date)

        return qs

    def perform_destroy(self, instance):
        sales_allowance_services.delete_sales_allowance(self.request, instance)

    @action(detail=False, methods=["GET"])
    def defaults(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError("Thiếu tham số company_id.")
        company = Company.objects.filter(id=company_id).first()
        if not company:
            raise ValidationError("Doanh nghiệp không tồn tại.")

        data = sales_allowance_services.get_sales_allowance_defaults(
            company=company,
            branch=request.query_params.get("branch_id"),
            customer_id=request.query_params.get("customer_id"),
            goods_sale_id=request.query_params.get("goods_sale_id"),
            service_sale_id=request.query_params.get("service_sale_id"),
        )
        return Response(data)

    @action(detail=False, methods=["GET"])
    def prepare_from_sale(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError("Thiếu tham số company_id.")
        company = Company.objects.filter(id=company_id).first()
        if not company:
            raise ValidationError("Doanh nghiệp không tồn tại.")

        goods_sale_id = request.query_params.get("goods_sale_id")
        service_sale_id = request.query_params.get("service_sale_id")
        sale_id = request.query_params.get("sale_id")
        sale_type = request.query_params.get("sale_type", "GOODS").upper()

        if sale_id and not goods_sale_id and not service_sale_id:
            if sale_type == "SERVICE":
                service_sale_id = sale_id
            else:
                goods_sale_id = sale_id

        if not goods_sale_id and not service_sale_id:
            raise ValidationError("Thiếu tham số goods_sale_id hoặc service_sale_id.")

        data = sales_allowance_services.prepare_from_sale(
            company=company,
            goods_sale_id=goods_sale_id,
            service_sale_id=service_sale_id,
        )
        return Response(data)

    @action(detail=True, methods=["POST"])
    def submit(self, request, pk=None):
        allowance = self.get_object()
        notes = request.data.get("notes", "")
        updated = sales_allowance_services.submit_sales_allowance(request, allowance, notes=notes)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def withdraw(self, request, pk=None):
        allowance = self.get_object()
        reason = request.data.get("reason", "")
        updated = sales_allowance_services.withdraw_sales_allowance(request, allowance, reason=reason)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def approve(self, request, pk=None):
        allowance = self.get_object()
        comment = request.data.get("comment", "")
        updated = sales_allowance_services.decide_sales_allowance(request, allowance, decision="APPROVED", comment=comment)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def request_revision(self, request, pk=None):
        allowance = self.get_object()
        comment = request.data.get("comment", "")
        updated = sales_allowance_services.decide_sales_allowance(request, allowance, decision="REVISION_REQUIRED", comment=comment)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def reject(self, request, pk=None):
        allowance = self.get_object()
        comment = request.data.get("comment", "")
        updated = sales_allowance_services.decide_sales_allowance(request, allowance, decision="REJECTED", comment=comment)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def post(self, request, pk=None):
        allowance = self.get_object()
        updated = sales_allowance_services.post_sales_allowance(request, allowance)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def unpost(self, request, pk=None):
        allowance = self.get_object()
        reason = request.data.get("reason", "")
        updated = sales_allowance_services.unpost_sales_allowance(request, allowance, reason=reason)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def cancel(self, request, pk=None):
        allowance = self.get_object()
        reason = request.data.get("reason", "")
        updated = sales_allowance_services.cancel_sales_allowance(request, allowance, reason=reason)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def refund(self, request, pk=None):
        allowance = self.get_object()
        result = sales_allowance_services.refund_sales_allowance(request, allowance, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=["POST"])
    def link_invoice(self, request, pk=None):
        allowance = self.get_object()
        updated = sales_allowance_services.link_tax_invoice(request, allowance, request.data)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)
