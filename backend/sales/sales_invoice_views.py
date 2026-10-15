from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from organization.models import Company
from . import models, sales_invoice_serializers, sales_invoice_services
from .permissions import SalesPermission


def perms(resource):
    return {
        "GET": f"{resource}.VIEW",
        "POST": f"{resource}.CREATE",
        "PUT": f"{resource}.EDIT",
        "PATCH": f"{resource}.EDIT",
        "DELETE": f"{resource}.EDIT",
    }


class SalesInvoiceViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    permission_classes = (SalesPermission,)
    serializer_class = sales_invoice_serializers.SalesInvoiceSerializer
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = (
        "number",
        "invoice_number",
        "customer__name",
        "buyer_name",
        "buyer_tax_code",
        "goods_sale__number",
        "service_sale__number",
        "sales_order__number",
    )
    ordering_fields = ("document_date", "invoice_date", "total_amount", "created_at", "number", "invoice_number")
    ordering = ("-invoice_date", "-created_at")

    iam_permissions = perms("SAL.SALES_INVOICE")
    action_permissions = {
        "defaults": "SAL.SALES_INVOICE.VIEW",
        "prepare_from_sale": "SAL.SALES_INVOICE.CREATE",
        "submit": "SAL.SALES_INVOICE.SUBMIT",
        "withdraw": "SAL.SALES_INVOICE.SUBMIT",
        "approve": "SAL.SALES_INVOICE.APPROVE",
        "request_revision": "SAL.SALES_INVOICE.REJECT",
        "reject": "SAL.SALES_INVOICE.REJECT",
        "issue": "SAL.SALES_INVOICE.ISSUE",
        "retry_issue": "SAL.SALES_INVOICE.RETRY_ISSUE",
        "cancel": "SAL.SALES_INVOICE.CANCEL",
        "send_email": "SAL.SALES_INVOICE.SEND_EMAIL",
    }

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        if not company and self.action == "list":
            return models.SalesInvoice.objects.none()

        qs = models.SalesInvoice.objects.all().select_related(
            "company", "branch", "customer", "currency",
            "goods_sale", "service_sale", "sales_order",
            "tax_invoice", "created_by", "issued_by"
        ).prefetch_related(
            "lines__item", "lines__uom", "lines__tax_rate",
            "lines__goods_sale_line", "lines__service_sale_line", "lines__order_line",
        )

        if company:
            qs = qs.filter(company_id=company)

        customer = self.request.query_params.get("customer_id")
        if customer:
            qs = qs.filter(customer_id=customer)

        status_val = self.request.query_params.get("status")
        if status_val:
            qs = qs.filter(status=status_val)

        category = self.request.query_params.get("invoice_category")
        if category:
            qs = qs.filter(invoice_category=category)

        goods_sale_id = self.request.query_params.get("goods_sale_id")
        if goods_sale_id:
            qs = qs.filter(goods_sale_id=goods_sale_id)

        service_sale_id = self.request.query_params.get("service_sale_id")
        if service_sale_id:
            qs = qs.filter(service_sale_id=service_sale_id)

        sales_order_id = self.request.query_params.get("sales_order_id")
        if sales_order_id:
            qs = qs.filter(sales_order_id=sales_order_id)

        from_date = self.request.query_params.get("from_date")
        if from_date:
            qs = qs.filter(invoice_date__gte=from_date)

        to_date = self.request.query_params.get("to_date")
        if to_date:
            qs = qs.filter(invoice_date__lte=to_date)

        return qs

    def perform_destroy(self, instance):
        sales_invoice_services.delete_sales_invoice(self.request, instance)

    @action(detail=False, methods=["GET"])
    def defaults(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError("Thiếu tham số company_id.")
        company = Company.objects.filter(id=company_id).first()
        if not company:
            raise ValidationError("Doanh nghiệp không tồn tại.")

        data = sales_invoice_services.get_sales_invoice_defaults(
            company=company,
            branch=request.query_params.get("branch_id"),
            customer_id=request.query_params.get("customer_id"),
            goods_sale_id=request.query_params.get("goods_sale_id"),
            service_sale_id=request.query_params.get("service_sale_id"),
            sales_order_id=request.query_params.get("sales_order_id"),
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
        sales_order_id = request.query_params.get("sales_order_id")

        data = sales_invoice_services.prepare_from_sale(
            company=company,
            goods_sale_id=goods_sale_id,
            service_sale_id=service_sale_id,
            sales_order_id=sales_order_id,
        )
        return Response(data)

    @action(detail=True, methods=["POST"])
    def submit(self, request, pk=None):
        invoice = self.get_object()
        notes = request.data.get("notes", "")
        updated = sales_invoice_services.submit_sales_invoice(request, invoice, notes=notes)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["POST"])
    def withdraw(self, request, pk=None):
        invoice = self.get_object()
        reason = request.data.get("reason", "")
        updated = sales_invoice_services.withdraw_sales_invoice(request, invoice, reason=reason)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["POST"])
    def approve(self, request, pk=None):
        invoice = self.get_object()
        comment = request.data.get("comment", "")
        updated = sales_invoice_services.decide_sales_invoice(request, invoice, decision="APPROVE", comment=comment)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["POST"])
    def request_revision(self, request, pk=None):
        invoice = self.get_object()
        comment = request.data.get("comment", "")
        updated = sales_invoice_services.decide_sales_invoice(request, invoice, decision="REVISE", comment=comment)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["POST"])
    def reject(self, request, pk=None):
        invoice = self.get_object()
        comment = request.data.get("comment", "")
        updated = sales_invoice_services.decide_sales_invoice(request, invoice, decision="REJECT", comment=comment)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["POST"])
    def issue(self, request, pk=None):
        invoice = self.get_object()
        force_fail = bool(request.data.get("force_fail", False))
        error_message = request.data.get("error_message", "")
        updated = sales_invoice_services.issue_sales_invoice(request, invoice, force_fail=force_fail, error_message=error_message)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["POST"])
    def retry_issue(self, request, pk=None):
        invoice = self.get_object()
        force_fail = bool(request.data.get("force_fail", False))
        error_message = request.data.get("error_message", "")
        updated = sales_invoice_services.retry_issue_sales_invoice(request, invoice, force_fail=force_fail, error_message=error_message)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["POST"])
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        reason = request.data.get("reason", "")
        updated = sales_invoice_services.cancel_sales_invoice(request, invoice, reason=reason)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["POST"])
    def send_email(self, request, pk=None):
        invoice = self.get_object()
        recipient_email = request.data.get("recipient_email") or invoice.buyer_email
        res = sales_invoice_services.send_invoice_email(request, invoice, recipient_email=recipient_email)
        return Response(res)
