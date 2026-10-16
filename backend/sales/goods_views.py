from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from organization.models import Company
from . import goods_sale_services, goods_serializers, models
from .permissions import SalesPermission


def perms(resource):
    return {
        "GET": f"{resource}.VIEW",
        "POST": f"{resource}.CREATE",
        "PUT": f"{resource}.EDIT",
        "PATCH": f"{resource}.EDIT",
        "DELETE": f"{resource}.EDIT",
    }


class GoodsSaleViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    permission_classes = (SalesPermission,)
    serializer_class = goods_serializers.GoodsSaleSerializer
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("number", "customer__name", "customer_tax_code", "description")
    ordering_fields = ("document_date", "posting_date", "total_amount", "created_at")
    ordering = ("-document_date", "-created_at")

    iam_permissions = perms("SAL.GOODS_SALE")
    action_permissions = {
        "defaults": "SAL.GOODS_SALE.VIEW",
        "prepare_from_order": "SAL.GOODS_SALE.CREATE",
        "prepare_from_issue": "SAL.GOODS_SALE.CREATE",
        "submit": "SAL.GOODS_SALE.SUBMIT",
        "withdraw": "SAL.GOODS_SALE.SUBMIT",
        "approve": "SAL.GOODS_SALE.APPROVE",
        "request_revision": "SAL.GOODS_SALE.REJECT",
        "reject": "SAL.GOODS_SALE.REJECT",
        "post": "SAL.GOODS_SALE.POST",
        "unpost": "SAL.GOODS_SALE.UNPOST",
        "cancel": "SAL.GOODS_SALE.CANCEL",
        "link_invoice": "SAL.GOODS_SALE.EDIT",
    }

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        if not company:
            return models.GoodsSale.objects.none()

        qs = models.GoodsSale.objects.filter(company_id=company).select_related(
            "company", "branch", "customer", "currency", "payment_term",
            "company_bank_account", "inventory_transaction", "sales_order",
            "delivery", "tax_invoice", "journal_entry", "receivable",
            "created_by", "posted_by",
        ).prefetch_related(
            "lines__item", "lines__uom", "lines__warehouse", "lines__tax_rate",
            "lines__receivable_or_payment_account", "lines__revenue_account",
            "lines__tax_account", "lines__cogs_account", "lines__inventory_account",
        )

        if st := self.request.query_params.get("status"):
            qs = qs.filter(status=st)
        if cust := self.request.query_params.get("customer_id"):
            qs = qs.filter(customer_id=cust)
        if from_date := self.request.query_params.get("from_date"):
            qs = qs.filter(document_date__gte=from_date)
        if to_date := self.request.query_params.get("to_date"):
            qs = qs.filter(document_date__lte=to_date)
        return qs

    def perform_destroy(self, instance):
        if instance.status != models.DocumentStatus.DRAFT:
            raise ValidationError("Chỉ có thể xóa chứng từ ở trạng thái Nháp.")
        goods_sale_services.audit(self.request, instance, "DELETE", before={"number": instance.number})
        instance.delete()

    @action(detail=False, methods=("get",))
    def defaults(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Vui lòng cung cấp mã doanh nghiệp."})
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise ValidationError({"company_id": "Doanh nghiệp không tồn tại."})
        customer_id = request.query_params.get("customer_id")
        branch_id = request.query_params.get("branch_id")
        data = goods_sale_services.get_goods_sale_defaults(company, request.user, customer_id, branch_id)
        return Response(data)

    @action(detail=False, methods=("get",), url_path="prepare-from-order")
    def prepare_from_order(self, request):
        company_id = request.query_params.get("company_id")
        order_id = request.query_params.get("order_id")
        if not company_id or not order_id:
            raise ValidationError("Vui lòng cung cấp company_id và order_id.")
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise ValidationError("Doanh nghiệp không tồn tại.")
        data = goods_sale_services.prepare_from_sales_order(company, order_id)
        return Response(data)

    @action(detail=False, methods=("get",), url_path="prepare-from-issue")
    def prepare_from_issue(self, request):
        company_id = request.query_params.get("company_id")
        issue_id = request.query_params.get("issue_id")
        if not company_id or not issue_id:
            raise ValidationError("Vui lòng cung cấp company_id và issue_id.")
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise ValidationError("Doanh nghiệp không tồn tại.")
        data = goods_sale_services.prepare_from_inventory_issue(company, issue_id)
        return Response(data)

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        sale = goods_sale_services.submit_goods_sale(request, self.get_object(), request.data.get("comment", ""))
        return Response(self.get_serializer(sale).data)

    @action(detail=True, methods=("post",))
    def withdraw(self, request, pk=None):
        sale = goods_sale_services.withdraw_goods_sale(request, self.get_object(), request.data.get("reason", ""))
        return Response(self.get_serializer(sale).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        sale = goods_sale_services.decide_goods_sale(request, self.get_object(), "APPROVED", request.data.get("comment", ""))
        return Response(self.get_serializer(sale).data)

    @action(detail=True, methods=("post",), url_path="request-revision")
    def request_revision(self, request, pk=None):
        sale = goods_sale_services.decide_goods_sale(request, self.get_object(), "REVISION_REQUIRED", request.data.get("reason", ""))
        return Response(self.get_serializer(sale).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        sale = goods_sale_services.decide_goods_sale(request, self.get_object(), "REJECTED", request.data.get("reason", ""))
        return Response(self.get_serializer(sale).data)

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        sale = goods_sale_services.post_goods_sale(request, self.get_object())
        return Response(self.get_serializer(sale).data)

    @action(detail=True, methods=("post",))
    def unpost(self, request, pk=None):
        sale = goods_sale_services.unpost_goods_sale(request, self.get_object(), request.data.get("reason", ""))
        return Response(self.get_serializer(sale).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        sale = goods_sale_services.cancel_goods_sale(request, self.get_object(), request.data.get("reason", ""))
        return Response(self.get_serializer(sale).data)

    @action(detail=True, methods=("post",), url_path="link-invoice")
    def link_invoice(self, request, pk=None):
        invoice_id = request.data.get("tax_invoice")
        if not invoice_id:
            raise ValidationError({"tax_invoice": "Vui lòng chọn hóa đơn liên kết."})
        sale = goods_sale_services.link_tax_invoice(request, self.get_object(), invoice_id, request.data.get("notes", ""))
        return Response(self.get_serializer(sale).data)
