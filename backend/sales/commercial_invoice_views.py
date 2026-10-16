from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from organization.models import Company
from . import commercial_invoice_serializers as serializers
from . import commercial_invoice_services as services
from . import models
from .permissions import SalesPermission


class SalesCommercialInvoiceViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for UC-SAL-14: Commercial Invoices (Hóa đơn thương mại).
    """
    permission_classes = [SalesPermission]
    queryset = models.SalesCommercialInvoice.objects.all().select_related(
        "company", "branch", "customer", "currency", "sales_contract", "sales_order", "tax_invoice"
    ).prefetch_related("lines__item", "lines__uom", "lines__tax_rate", "lines__source_order_line")

    action_permissions = {
        "list": "SAL.COMMERCIAL_INVOICE.VIEW",
        "retrieve": "SAL.COMMERCIAL_INVOICE.VIEW",
        "eligible_source_orders": "SAL.COMMERCIAL_INVOICE.VIEW",
        "preview": "SAL.COMMERCIAL_INVOICE.VIEW",
        "download_files": "SAL.COMMERCIAL_INVOICE.VIEW",
        "send_email": "SAL.COMMERCIAL_INVOICE.VIEW",
        "check_issue_status": "SAL.COMMERCIAL_INVOICE.VIEW",
        "create": "SAL.COMMERCIAL_INVOICE.CREATE",
        "create_new_version": "SAL.COMMERCIAL_INVOICE.CREATE",
        "update": "SAL.COMMERCIAL_INVOICE.EDIT",
        "partial_update": "SAL.COMMERCIAL_INVOICE.EDIT",
        "submit_approval": "SAL.COMMERCIAL_INVOICE.EDIT",
        "recall_approval": "SAL.COMMERCIAL_INVOICE.EDIT",
        "return_to_draft": "SAL.COMMERCIAL_INVOICE.EDIT",
        "destroy": "SAL.COMMERCIAL_INVOICE.DELETE",
        "approve": "SAL.COMMERCIAL_INVOICE.APPROVE",
        "request_revision": "SAL.COMMERCIAL_INVOICE.APPROVE",
        "reject": "SAL.COMMERCIAL_INVOICE.APPROVE",
        "publish": "SAL.COMMERCIAL_INVOICE.PUBLISH",
        "issue": "SAL.COMMERCIAL_INVOICE.ISSUE",
        "retry_issue": "SAL.COMMERCIAL_INVOICE.RETRY",
        "cancel": "SAL.COMMERCIAL_INVOICE.CANCEL",
    }

    def get_company(self):
        company_id = (
            self.request.headers.get("X-Company-ID")
            or self.request.META.get("HTTP_X_COMPANY_ID")
            or self.request.query_params.get("company_id")
            or (self.request.data.get("company") if isinstance(self.request.data, dict) else None)
            or (self.request.data.get("company_id") if isinstance(self.request.data, dict) else None)
        )
        if company_id:
            try:
                return Company.objects.get(pk=company_id)
            except Company.DoesNotExist:
                pass
        if hasattr(self.request.user, "company") and self.request.user.company:
            return self.request.user.company
        if hasattr(self.request.user, "iam_account"):
            emp = getattr(self.request.user.iam_account, "employee", None)
            if emp and emp.company:
                return emp.company
        return Company.objects.first()

    def get_queryset(self):
        company = self.get_company()
        if not company:
            return models.SalesCommercialInvoice.objects.none()

        qs = super().get_queryset().filter(company=company)

        # Filters
        customer_id = self.request.query_params.get("customer")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        form_val = self.request.query_params.get("invoice_form")
        if form_val:
            qs = qs.filter(invoice_form=form_val)

        status_val = self.request.query_params.get("status")
        if status_val:
            qs = qs.filter(status=status_val)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(invoice_date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(invoice_date__lte=date_to)

        is_current = self.request.query_params.get("is_current_version")
        if is_current is not None:
            qs = qs.filter(is_current_version=(is_current.lower() in ("true", "1")))

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(code__icontains=search)
                | Q(number__icontains=search)
                | Q(invoice_number__icontains=search)
                | Q(buyer_name__icontains=search)
                | Q(buyer_address__icontains=search)
                | Q(buyer_country__icontains=search)
                | Q(customer__name__icontains=search)
            )

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return serializers.SalesCommercialInvoiceListSerializer
        if self.action in ("create", "update", "partial_update"):
            return serializers.SalesCommercialInvoiceCreateUpdateSerializer
        return serializers.SalesCommercialInvoiceDetailSerializer

    def create(self, request, *args, **kwargs):
        company = self.get_company()
        if not company:
            raise ValidationError("Vui lòng chọn doanh nghiệp làm việc.")

        serializer = serializers.SalesCommercialInvoiceCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        validated_data["company"] = company

        inv = services.create_commercial_invoice(request, validated_data)
        res_serializer = serializers.SalesCommercialInvoiceDetailSerializer(inv)
        return Response(res_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        invoice = self.get_object()
        serializer = serializers.SalesCommercialInvoiceCreateUpdateSerializer(data=request.data, partial=(self.action == "partial_update"))
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        inv = services.update_commercial_invoice(request, invoice, validated_data)
        res_serializer = serializers.SalesCommercialInvoiceDetailSerializer(inv)
        return Response(res_serializer.data)

    def destroy(self, request, *args, **kwargs):
        invoice = self.get_object()
        services.delete_commercial_invoice(request, invoice)
        return Response({"detail": "Đã xóa hóa đơn thương mại thành công."}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="eligible-source-orders")
    def eligible_source_orders(self, request):
        company = self.get_company()
        if not company:
            raise ValidationError("Vui lòng chọn doanh nghiệp làm việc.")

        customer_id = request.query_params.get("customer_id")
        currency_id = request.query_params.get("currency_id")
        orders = services.get_eligible_source_orders(company, customer_id, currency_id)
        return Response({"orders": orders})

    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        invoice = self.get_object()
        preview_data = services.preview_commercial_invoice(invoice)
        return Response(preview_data)

    @action(detail=True, methods=["post"], url_path="submit-approval")
    def submit_approval(self, request, pk=None):
        invoice = self.get_object()
        services.submit_commercial_invoice_approval(request, invoice)
        return Response({
            "detail": "Gửi duyệt hóa đơn thương mại thành công.",
            "status": invoice.status,
            "status_display": invoice.get_status_display(),
        })

    @action(detail=True, methods=["post"], url_path="recall-approval")
    def recall_approval(self, request, pk=None):
        invoice = self.get_object()
        ser = serializers.CommercialInvoiceReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        reason = ser.validated_data.get("reason", "")
        services.withdraw_commercial_invoice_approval(request, invoice, reason=reason)
        return Response({
            "detail": "Thu hồi yêu cầu phê duyệt thành công.",
            "status": invoice.status,
            "status_display": invoice.get_status_display(),
        })

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        invoice = self.get_object()
        ser = serializers.CommercialInvoiceReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        comment = ser.validated_data.get("comment", "")
        invoice = services.approve_commercial_invoice(request, invoice, comment=comment)
        return Response({
            "detail": "Phê duyệt hóa đơn thương mại thành công.",
            "status": invoice.status,
            "status_display": invoice.get_status_display(),
        })

    @action(detail=True, methods=["post"], url_path="request-revision")
    def request_revision(self, request, pk=None):
        invoice = self.get_object()
        ser = serializers.CommercialInvoiceReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        comment = ser.validated_data.get("comment", "")
        invoice = services.request_revision_commercial_invoice(request, invoice, comment=comment)
        return Response({
            "detail": "Yêu cầu chỉnh sửa hóa đơn thương mại thành công.",
            "status": invoice.status,
            "status_display": invoice.get_status_display(),
        })

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        invoice = self.get_object()
        ser = serializers.CommercialInvoiceReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        comment = ser.validated_data.get("comment", "")
        invoice = services.reject_commercial_invoice(request, invoice, comment=comment)
        return Response({
            "detail": "Từ chối phê duyệt hóa đơn thương mại thành công.",
            "status": invoice.status,
            "status_display": invoice.get_status_display(),
        })

    @action(detail=True, methods=["post"], url_path="return-to-draft")
    def return_to_draft(self, request, pk=None):
        invoice = self.get_object()
        ser = serializers.CommercialInvoiceReasonSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        reason = ser.validated_data.get("reason", "")
        invoice = services.return_commercial_invoice_to_draft(request, invoice, reason=reason)
        return Response({
            "detail": "Đưa hóa đơn về trạng thái Nháp thành công.",
            "status": invoice.status,
            "status_display": invoice.get_status_display(),
        })

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        invoice = self.get_object()
        invoice = services.publish_commercial_invoice(request, invoice)
        return Response({
            "detail": "Xuất bản Commercial Invoice thành công.",
            "invoice_number": invoice.invoice_number,
            "pdf_file_url": invoice.pdf_file_url,
            "status": invoice.status,
            "status_display": invoice.get_status_display(),
        })

    @action(detail=True, methods=["post"], url_path="issue")
    def issue(self, request, pk=None):
        invoice = self.get_object()
        invoice = services.issue_commercial_invoice(request, invoice)
        if invoice.status == models.CommercialInvoiceStatus.ISSUE_FAILED:
            return Response({
                "detail": "Phát hành hóa đơn thất bại.",
                "error": invoice.issue_error_message,
                "status": invoice.status,
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "detail": "Phát hành hóa đơn thương mại điện tử thành công.",
            "invoice_number": invoice.invoice_number,
            "transaction_code": invoice.transaction_code,
            "xml_file_url": invoice.xml_file_url,
            "pdf_file_url": invoice.pdf_file_url,
            "status": invoice.status,
            "status_display": invoice.get_status_display(),
        })

    @action(detail=True, methods=["post"], url_path="check-issue-status")
    def check_issue_status(self, request, pk=None):
        invoice = self.get_object()
        invoice = services.check_commercial_invoice_issue_status(request, invoice)
        return Response({
            "status": invoice.status,
            "status_display": invoice.get_status_display(),
            "invoice_number": invoice.invoice_number,
            "transaction_code": invoice.transaction_code,
        })

    @action(detail=True, methods=["post"], url_path="retry-issue")
    def retry_issue(self, request, pk=None):
        invoice = self.get_object()
        invoice = services.retry_commercial_invoice_issue(request, invoice)
        if invoice.status == models.CommercialInvoiceStatus.ISSUE_FAILED:
            return Response({
                "detail": "Thử lại phát hành thất bại.",
                "error": invoice.issue_error_message,
                "status": invoice.status,
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "detail": "Thử lại phát hành thành công.",
            "invoice_number": invoice.invoice_number,
            "status": invoice.status,
        })

    @action(detail=True, methods=["post"], url_path="create-new-version")
    def create_new_version(self, request, pk=None):
        invoice = self.get_object()
        new_inv = services.create_new_commercial_invoice_version(request, invoice)
        res_serializer = serializers.SalesCommercialInvoiceDetailSerializer(new_inv)
        return Response(res_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="download-files")
    def download_files(self, request, pk=None):
        invoice = self.get_object()
        return Response({
            "invoice_id": str(invoice.id),
            "code": invoice.code,
            "invoice_number": invoice.invoice_number,
            "pdf_file_url": invoice.pdf_file_url,
            "xml_file_url": invoice.xml_file_url,
        })

    @action(detail=True, methods=["post"], url_path="send-email")
    def send_email(self, request, pk=None):
        invoice = self.get_object()
        ser = serializers.SendEmailSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        target_email = ser.validated_data.get("email") or invoice.buyer_email
        if not target_email:
            raise ValidationError("Email người nhận không được để trống (AF-08).")

        services.audit_commercial_invoice(request, invoice, "SEND_EMAIL", after={"recipient": target_email})
        return Response({"detail": f"Đã gửi hóa đơn thương mại tới {target_email} thành công."})
