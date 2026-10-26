from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ReadOnlyModelViewSet
from rest_framework.exceptions import ValidationError
from django.http import HttpResponse
from django.utils import timezone

from . import models, serializers, services, quotation_services, order_services, contract_views
from .permissions import SalesPermission


def perms(resource): return {"GET":f"{resource}.VIEW","POST":f"{resource}.CREATE","PUT":f"{resource}.EDIT","PATCH":f"{resource}.EDIT","DELETE":f"{resource}.EDIT"}


class BaseViewSet(mixins.CreateModelMixin,mixins.ListModelMixin,mixins.RetrieveModelMixin,mixins.UpdateModelMixin,GenericViewSet):
    permission_classes=(SalesPermission,); filter_backends=(SearchFilter,OrderingFilter); ordering=("-created_at",)
    def get_queryset(self):
        company = getattr(self.request, "_validated_company_id", None) or self.request.query_params.get("company_id") or self.request.headers.get("X-Company-ID")
        if not company: return super().get_queryset().none()
        qs=super().get_queryset().filter(company_id=company)
        if status:=self.request.query_params.get("status"): qs=qs.filter(status=status)
        if customer:=self.request.query_params.get("customer_id"):
            if any(field.name=="customer" for field in qs.model._meta.fields): qs=qs.filter(customer_id=customer)
            elif qs.model is models.SalesDelivery: qs=qs.filter(order__customer_id=customer)
        return qs
    def perform_create(self,serializer):
        obj=serializer.save(created_by=services.actor_for(self.request)); services.audit(self.request,obj,"CREATE",after=serializer.data)
    def perform_update(self,serializer):
        before=self.get_serializer(serializer.instance).data; obj=serializer.save(); services.audit(self.request,obj,"EDIT",before,serializer.data)


class ApprovalMixin:
    @action(detail=True,methods=("post",))
    def submit(self,request,pk=None): return Response(self.get_serializer(services.submit(self.get_object(),request)).data)
    @action(detail=True,methods=("post",))
    def approve(self,request,pk=None): return Response(self.get_serializer(services.decide(self.get_object(),request,True)).data)
    @action(detail=True,methods=("post",))
    def reject(self,request,pk=None): return Response(self.get_serializer(services.decide(self.get_object(),request,False)).data)


class QuotationViewSet(ApprovalMixin,BaseViewSet):
    permission_denied_message = "Bạn không có quyền xem báo giá."
    def get_permissions(self):
        if self.action in ("create", "issue_new", "new_version"):
            self.permission_denied_message = "Bạn không có quyền tạo báo giá."
        return super().get_permissions()
    queryset=models.SalesQuotation.objects.select_related("company","branch","customer","currency","payment_term","created_by").prefetch_related("lines__item","lines__uom","lines__tax_rate")
    serializer_class=serializers.QuotationSerializer; iam_permissions=perms("SAL.QUOTATION")
    action_permissions={"submit":"SAL.QUOTATION.SUBMIT","approve":"SAL.QUOTATION.APPROVE","reject":"SAL.QUOTATION.REJECT","send":"SAL.QUOTATION.SEND","accept":"SAL.QUOTATION.ACCEPT","decline":"SAL.QUOTATION.CANCEL",
                        "issue_new":"SAL.QUOTATION.CREATE","issue_existing":"SAL.QUOTATION.EDIT","email":"SAL.QUOTATION.SEND",
                        "accept_response":"SAL.QUOTATION.ACCEPT","decline_response":"SAL.QUOTATION.CANCEL",
                        "cancel_quote":"SAL.QUOTATION.CANCEL","duplicate":"SAL.QUOTATION.VIEW",
                        "new_version":"SAL.QUOTATION.CREATE","prepare_order":"SAL.QUOTATION.VIEW",
                        "pdf":"SAL.QUOTATION.VIEW","quotation_settings":"SAL.QUOTATION.EDIT",
                        "defaults":"SAL.QUOTATION.VIEW"}
    search_fields=("number","customer__name","notes"); ordering_fields=("document_date","valid_until","total_amount","created_at")
    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if company_id:
            models.SalesQuotation.objects.filter(company_id=company_id, status=models.DocumentStatus.ISSUED,
                                                 valid_until__lt=timezone.localdate()).update(status=models.DocumentStatus.EXPIRED)
        return super().get_queryset()

    def create(self, request, *args, **kwargs):
        if request.data.get("number"):
            return super().create(request, *args, **kwargs)
        from organization.models import Company
        try:
            company = Company.objects.get(pk=request.query_params.get("company_id") or request.data.get("company"))
        except (Company.DoesNotExist, ValueError):
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        quote = quotation_services.save_new(request, company, request.data)
        return Response(self.get_serializer(quote).data, status=201)

    @action(detail=False, methods=("get",), url_path="defaults")
    def defaults(self, request):
        from organization.models import Company
        company = Company.objects.filter(pk=request.query_params.get("company_id")).first()
        if not company:
            raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})
        return Response(quotation_services.form_defaults(company, request.query_params))

    @action(detail=False, methods=("post",), url_path="issue")
    def issue_new(self, request):
        from organization.models import Company
        try:
            company = Company.objects.get(pk=request.query_params.get("company_id") or request.data.get("company"))
        except (Company.DoesNotExist, ValueError):
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        try:
            quote = quotation_services.save_new(request, company, request.data, issue=True)
        except ValidationError:
            raise
        except Exception:
            return Response({"detail": "Không thể phát hành báo giá. Dữ liệu chưa được lưu."}, status=500)
        result = self.get_serializer(quote).data
        result["message"] = f"Phát hành báo giá thành công. Số báo giá: {quote.number}."
        return Response(result, status=201)

    @action(detail=True, methods=("post",), url_path="issue")
    def issue_existing(self, request, pk=None):
        try:
            quote = quotation_services.issue_draft(request, self.get_object())
        except ValidationError:
            raise
        except Exception:
            return Response({"detail": "Không thể phát hành báo giá. Dữ liệu chưa được lưu."}, status=500)
        result = self.get_serializer(quote).data
        result["message"] = f"Phát hành báo giá thành công. Số báo giá: {quote.number}."
        return Response(result)

    @action(detail=True, methods=("get",))
    def pdf(self, request, pk=None):
        quote = self.get_object()
        if not quote.pdf_content:
            raise ValidationError("Báo giá chưa được phát hành.")
        response = HttpResponse(bytes(quote.pdf_content), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{quote.number}.pdf"'
        return response

    @action(detail=True, methods=("post",))
    def email(self, request, pk=None):
        return Response(self.get_serializer(quotation_services.email_quote(request, self.get_object())).data)

    @action(detail=True, methods=("post",), url_path="accept-response")
    def accept_response(self, request, pk=None):
        return Response(self.get_serializer(quotation_services.record_response(request, self.get_object(), True)).data)

    @action(detail=True, methods=("post",), url_path="decline-response")
    def decline_response(self, request, pk=None):
        return Response(self.get_serializer(quotation_services.record_response(request, self.get_object(), False)).data)

    @action(detail=True, methods=("post",), url_path="cancel")
    def cancel_quote(self, request, pk=None):
        return Response(self.get_serializer(quotation_services.cancel_quote(request, self.get_object())).data)

    @action(detail=True, methods=("get",))
    def duplicate(self, request, pk=None):
        return Response(quotation_services.quote_payload(self.get_object()))

    @action(detail=True, methods=("post",), url_path="new-version")
    def new_version(self, request, pk=None):
        previous = self.get_object()
        if previous.status == models.DocumentStatus.DRAFT:
            raise ValidationError("Báo giá Nháp có thể chỉnh sửa trực tiếp.")
        payload = quotation_services.quote_payload(previous)
        payload.update(request.data)
        quote = quotation_services.save_new(request, previous.company, payload, original=previous)
        return Response(self.get_serializer(quote).data, status=201)

    @action(detail=True, methods=("get",), url_path="prepare-order")
    def prepare_order(self, request, pk=None):
        return Response(quotation_services.order_prefill(self.get_object()))

    @action(detail=False, methods=("get", "patch"), url_path="settings")
    def quotation_settings(self, request):
        from organization.models import Company
        company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
        if not company:
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        config = models.SalesQuotationSettings.objects.filter(company=company).first()
        if request.method == "PATCH":
            try:
                days = int(request.data.get("validity_days"))
            except (ValueError, TypeError):
                raise ValidationError({"validity_days": "Số ngày hiệu lực phải từ 1 đến 365."})
            if not 1 <= days <= 365:
                raise ValidationError({"validity_days": "Số ngày hiệu lực phải từ 1 đến 365."})
            config, _ = models.SalesQuotationSettings.objects.update_or_create(company=company, defaults={"validity_days": days})
        return Response({"validity_days": config.validity_days if config else 15})
    @action(detail=True,methods=("post",))
    def send(self,request,pk=None): return Response(self.get_serializer(services.send_quotation(self.get_object(),request)).data)
    @action(detail=True,methods=("post",))
    def accept(self,request,pk=None): return Response(self.get_serializer(services.accept_quotation(self.get_object(),request,True)).data)
    @action(detail=True,methods=("post",))
    def decline(self,request,pk=None): return Response(self.get_serializer(services.accept_quotation(self.get_object(),request,False)).data)


ContractViewSet = contract_views.SalesContractViewSet


class OrderViewSet(mixins.DestroyModelMixin, ApprovalMixin, BaseViewSet):
    permission_denied_message = "Bạn không có quyền xem đơn bán hàng."
    def get_permissions(self):
        if self.action in ("create", "prepare_from_sources"):
            self.permission_denied_message = "Bạn không có quyền tạo đơn bán hàng."
        elif self.action in ("update", "partial_update"):
            self.permission_denied_message = "Bạn không có quyền sửa đơn bán hàng."
        elif self.action == "destroy":
            self.permission_denied_message = "Bạn không có quyền xóa đơn bán hàng."
        return super().get_permissions()

    queryset = models.SalesOrder.objects.select_related("company", "branch", "customer", "currency", "contract", "payment_term", "default_warehouse", "assigned_employee", "created_by").prefetch_related("lines__item", "lines__uom", "lines__quotation_line", "lines__contract_line", "lines__warehouse", "lines__tax_rate")
    serializer_class = serializers.OrderSerializer
    iam_permissions = perms("SAL.ORDER")
    action_permissions = {
        "submit": "SAL.ORDER.SUBMIT",
        "confirm": "SAL.ORDER.APPROVE",
        "withdraw": "SAL.ORDER.SUBMIT",
        "approve": "SAL.ORDER.APPROVE",
        "request_revision": "SAL.ORDER.REJECT",
        "reject": "SAL.ORDER.REJECT",
        "tracking": "SAL.ORDER.VIEW",
        "close": "SAL.ORDER.CLOSE",
        "cancel": "SAL.ORDER.CANCEL",
        "defaults": "SAL.ORDER.CREATE",
        "prepare_from_sources": "SAL.ORDER.CREATE",
        "check_feasibility": "SAL.ORDER.VIEW",
        "invoice_eligible_lines": "SAL.ORDER.VIEW",
        "create_invoice_request": "SAL.ORDER.EDIT",
    }
    search_fields = ("number", "customer__name", "delivery_address", "notes", "customer_address", "contact_name")
    ordering_fields = ("document_date", "requested_delivery_date", "total_amount", "created_at", "status", "number")

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if branch := params.get("branch_id") or params.get("branch"):
            qs = qs.filter(branch_id=branch)
        if from_date := params.get("from_date"):
            qs = qs.filter(document_date__gte=from_date)
        if to_date := params.get("to_date"):
            qs = qs.filter(document_date__lte=to_date)
        return qs

    @action(detail=False, methods=("get",), url_path="defaults")
    def defaults(self, request):
        from organization.models import Company
        company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
        if not company:
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        return Response(order_services.get_order_defaults(
            company=company,
            customer_id=request.query_params.get("customer_id"),
            currency_id=request.query_params.get("currency_id"),
            document_date=request.query_params.get("document_date"),
            user=request.user,
        ))

    @action(detail=False, methods=("get",), url_path="prepare-from-sources")
    def prepare_from_sources(self, request):
        from organization.models import Company
        company = Company.objects.filter(pk=request.query_params.get("company_id")).first()
        if not company:
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        return Response(order_services.prepare_order_from_sources(
            company=company,
            quotation_ids=request.query_params.get("quotation_ids"),
            contract_id=request.query_params.get("contract_id"),
        ))

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        return Response(self.get_serializer(order_services.submit_order(request, self.get_object(), comment=request.data.get("comment", ""))).data)

    @action(detail=True, methods=("post",))
    def confirm(self, request, pk=None):
        return Response(self.get_serializer(order_services.confirm_order_direct(request, self.get_object(), comment=request.data.get("comment", ""))).data)

    @action(detail=True, methods=("post",))
    def withdraw(self, request, pk=None):
        return Response(self.get_serializer(order_services.withdraw_order(request, self.get_object(), reason=request.data.get("reason", ""))).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return Response(self.get_serializer(order_services.decide_order(request, self.get_object(), "APPROVE", comment=request.data.get("comment", ""))).data)

    @action(detail=True, methods=("post",), url_path="request-revision")
    def request_revision(self, request, pk=None):
        return Response(self.get_serializer(order_services.decide_order(request, self.get_object(), "REQUEST_REVISION", comment=request.data.get("comment", ""))).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return Response(self.get_serializer(order_services.decide_order(request, self.get_object(), "REJECT", comment=request.data.get("comment", ""))).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        return Response(self.get_serializer(order_services.cancel_order(request, self.get_object(), reason=request.data.get("reason", ""))).data)

    @action(detail=True, methods=("post",))
    def close(self, request, pk=None):
        return Response(self.get_serializer(order_services.close_order(request, self.get_object(), reason=request.data.get("reason", ""))).data)

    def destroy(self, request, *args, **kwargs):
        order_services.delete_draft_order(request, self.get_object())
        return Response(status=204)

    @action(detail=True, methods=("get",), url_path="check-feasibility")
    def check_feasibility(self, request, pk=None):
        return Response(order_services.evaluate_order_feasibility(self.get_object()))

    @action(detail=True, methods=("get",))
    def tracking(self, request, pk=None):
        return Response(services.order_tracking(self.get_object()))

    @action(detail=True, methods=("get",), url_path="invoice-eligible-lines")
    def invoice_eligible_lines(self, request, pk=None):
        return Response(order_services.get_invoice_eligible_lines(self.get_object()))

    @action(detail=True, methods=("post",), url_path="create-invoice-request")
    def create_invoice_request(self, request, pk=None):
        inv_req = order_services.create_invoice_request_from_order(request, self.get_object(), request.data.get("lines", []))
        return Response(serializers.InvoiceRequestSerializer(inv_req).data, status=201)


class DeliveryViewSet(BaseViewSet):
    queryset=models.SalesDelivery.objects.select_related("company","order__customer","warehouse","created_by","confirmed_by").prefetch_related("lines__order_line__item")
    serializer_class=serializers.DeliverySerializer; iam_permissions=perms("SAL.DELIVERY"); action_permissions={"confirm":"SAL.DELIVERY.CONFIRM"}
    search_fields=("number","order__number","order__customer__name","inventory_reference","acceptance_reference"); ordering_fields=("delivery_date","created_at")
    @action(detail=True,methods=("post",))
    def confirm(self,request,pk=None): return Response(self.get_serializer(services.confirm_delivery(self.get_object(),request)).data)


class InvoiceRequestViewSet(BaseViewSet):
    queryset=models.InvoiceRequest.objects.select_related("company","order","customer","currency","created_by").prefetch_related("lines__order_line","lines__delivery_line")
    serializer_class=serializers.InvoiceRequestSerializer; iam_permissions=perms("SAL.INVOICE_REQUEST"); action_permissions={"submit":"SAL.INVOICE_REQUEST.SUBMIT","cancel":"SAL.INVOICE_REQUEST.CANCEL"}
    search_fields=("number","order__number","customer__name","buyer_tax_code","external_reference"); ordering_fields=("request_date","total_amount","created_at")
    @action(detail=True,methods=("post",))
    def submit(self,request,pk=None): return Response(self.get_serializer(services.submit_invoice_request(self.get_object(),request)).data)
    @action(detail=True,methods=("post",))
    def cancel(self,request,pk=None): return Response(self.get_serializer(services.cancel_invoice_request(self.get_object(),request)).data)


from .approval_views import ApprovalViewSet

