from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from organization.models import Company
from . import models, sales_return_serializers, sales_return_services
from .permissions import SalesPermission


def perms(resource):
    return {
        "GET": f"{resource}.VIEW",
        "POST": f"{resource}.CREATE",
        "PUT": f"{resource}.EDIT",
        "PATCH": f"{resource}.EDIT",
        "DELETE": f"{resource}.EDIT",
    }


class SalesReturnViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    permission_classes = (SalesPermission,)
    serializer_class = sales_return_serializers.SalesReturnSerializer
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("number", "customer__name", "goods_sale__number", "return_reason")
    ordering_fields = ("document_date", "posting_date", "total_amount", "created_at")
    ordering = ("-document_date", "-created_at")

    iam_permissions = perms("SAL.SALES_RETURN")
    action_permissions = {
        "defaults": "SAL.SALES_RETURN.VIEW",
        "prepare_from_sale": "SAL.SALES_RETURN.CREATE",
        "submit": "SAL.SALES_RETURN.SUBMIT",
        "withdraw": "SAL.SALES_RETURN.SUBMIT",
        "approve": "SAL.SALES_RETURN.APPROVE",
        "request_revision": "SAL.SALES_RETURN.REJECT",
        "reject": "SAL.SALES_RETURN.REJECT",
        "post": "SAL.SALES_RETURN.POST",
        "unpost": "SAL.SALES_RETURN.UNPOST",
        "cancel": "SAL.SALES_RETURN.CANCEL",
        "refund": "SAL.SALES_RETURN.REFUND",
        "link_invoice": "SAL.SALES_RETURN.EDIT",
    }

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        if not company:
            return models.SalesReturn.objects.none()

        qs = models.SalesReturn.objects.filter(company_id=company).select_related(
            "company", "branch", "customer", "goods_sale", "currency",
            "inventory_transaction", "original_tax_invoice", "tax_invoice",
            "journal_entry", "created_by", "posted_by"
        ).prefetch_related(
            "lines__item", "lines__uom", "lines__warehouse",
            "lines__revenue_deduction_account", "lines__tax_account",
            "lines__receivable_account", "lines__inventory_account", "lines__cogs_account",
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
        sales_return_services.delete_sales_return(self.request, instance)

    @action(detail=False, methods=["GET"])
    def defaults(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError("Thiếu tham số company_id.")
        company = Company.objects.filter(id=company_id).first()
        if not company:
            raise ValidationError("Doanh nghiệp không tồn tại.")

        data = sales_return_services.get_sales_return_defaults(
            company=company,
            branch=request.query_params.get("branch_id"),
            customer_id=request.query_params.get("customer_id"),
            goods_sale_id=request.query_params.get("goods_sale_id"),
        )
        return Response(data)

    @action(detail=False, methods=["GET"])
    def prepare_from_sale(self, request):
        company_id = request.query_params.get("company_id")
        sale_id = request.query_params.get("goods_sale_id") or request.query_params.get("sale_id")
        if not company_id or not sale_id:
            raise ValidationError("Thiếu tham số company_id hoặc goods_sale_id.")
        company = Company.objects.filter(id=company_id).first()
        if not company:
            raise ValidationError("Doanh nghiệp không tồn tại.")

        data = sales_return_services.prepare_from_goods_sale(company=company, goods_sale_id=sale_id)
        return Response(data)

    @action(detail=True, methods=["POST"])
    def submit(self, request, pk=None):
        sale_return = self.get_object()
        notes = request.data.get("notes", "")
        updated = sales_return_services.submit_sales_return(request, sale_return, notes=notes)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def withdraw(self, request, pk=None):
        sale_return = self.get_object()
        reason = request.data.get("reason", "")
        updated = sales_return_services.withdraw_sales_return(request, sale_return, reason=reason)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def approve(self, request, pk=None):
        sale_return = self.get_object()
        comment = request.data.get("comment", "")
        updated = sales_return_services.decide_sales_return(request, sale_return, decision="APPROVED", comment=comment)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def request_revision(self, request, pk=None):
        sale_return = self.get_object()
        comment = request.data.get("comment", "")
        updated = sales_return_services.decide_sales_return(request, sale_return, decision="REVISION_REQUIRED", comment=comment)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def reject(self, request, pk=None):
        sale_return = self.get_object()
        comment = request.data.get("comment", "")
        updated = sales_return_services.decide_sales_return(request, sale_return, decision="REJECTED", comment=comment)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def post(self, request, pk=None):
        sale_return = self.get_object()
        updated = sales_return_services.post_sales_return(request, sale_return)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def unpost(self, request, pk=None):
        sale_return = self.get_object()
        reason = request.data.get("reason", "")
        updated = sales_return_services.unpost_sales_return(request, sale_return, reason=reason)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def cancel(self, request, pk=None):
        sale_return = self.get_object()
        reason = request.data.get("reason", "")
        updated = sales_return_services.cancel_sales_return(request, sale_return, reason=reason)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    @action(detail=True, methods=["POST"])
    def refund(self, request, pk=None):
        sale_return = self.get_object()
        result = sales_return_services.refund_sales_return(request, sale_return, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=["POST"])
    def link_invoice(self, request, pk=None):
        sale_return = self.get_object()
        updated = sales_return_services.link_tax_invoice(request, sale_return, request.data)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)
