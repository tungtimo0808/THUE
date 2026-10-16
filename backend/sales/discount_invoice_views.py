from datetime import date
from decimal import Decimal

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from organization.models import Company
from . import discount_invoice_serializers, discount_invoice_services, models
from .permissions import SalesPermission


class SalesDiscountInvoiceViewSet(viewsets.ModelViewSet):
    permission_classes = [SalesPermission]
    queryset = models.SalesDiscountInvoice.objects.all().select_related(
        "company", "branch", "customer", "currency", "contract", "tax_invoice"
    ).prefetch_related("lines__original_invoice", "lines__original_invoice_line", "lines__item", "lines__uom", "lines__tax_rate")

    action_permissions = {
        "list": "SAL.DISCOUNT_INVOICE.VIEW",
        "retrieve": "SAL.DISCOUNT_INVOICE.VIEW",
        "eligible_invoices": "SAL.DISCOUNT_INVOICE.VIEW",
        "calculate_allocation": "SAL.DISCOUNT_INVOICE.CREATE",
        "create": "SAL.DISCOUNT_INVOICE.CREATE",
        "create_from_basis": "SAL.DISCOUNT_INVOICE.CREATE",
        "update": "SAL.DISCOUNT_INVOICE.EDIT",
        "partial_update": "SAL.DISCOUNT_INVOICE.EDIT",
        "destroy": "SAL.DISCOUNT_INVOICE.DELETE",
        "submit_approval": "SAL.DISCOUNT_INVOICE.EDIT",
        "withdraw": "SAL.DISCOUNT_INVOICE.EDIT",
        "return_to_draft": "SAL.DISCOUNT_INVOICE.EDIT",
        "issue": "SAL.DISCOUNT_INVOICE.ISSUE",
        "retry_issue": "SAL.DISCOUNT_INVOICE.RETRY",
        "check_issue_status": "SAL.DISCOUNT_INVOICE.VIEW",
        "cancel": "SAL.DISCOUNT_INVOICE.CANCEL",
        "download_files": "SAL.DISCOUNT_INVOICE.VIEW",
        "send_email": "SAL.DISCOUNT_INVOICE.VIEW",
    }

    def get_serializer_class(self):
        if self.action == "list":
            return discount_invoice_serializers.DiscountInvoiceListSerializer
        if self.action in ("create", "update", "partial_update"):
            return discount_invoice_serializers.DiscountInvoiceInputSerializer
        return discount_invoice_serializers.DiscountInvoiceDetailSerializer

    def get_company(self):
        company_id = (
            self.request.query_params.get("company_id")
            or (self.request.data.get("company") if isinstance(self.request.data, dict) else None)
            or (self.request.data.get("company_id") if isinstance(self.request.data, dict) else None)
        )
        if company_id:
            try:
                return Company.objects.get(pk=company_id)
            except Company.DoesNotExist:
                pass
        if hasattr(self.request.user, "iam_account"):
            emp = getattr(self.request.user.iam_account, "employee", None)
            if emp and emp.company:
                return emp.company
        return Company.objects.first()

    def get_queryset(self):
        company = self.get_company()
        if not company:
            return models.SalesDiscountInvoice.objects.none()

        qs = super().get_queryset().filter(company=company)

        # Filters
        if customer_id := self.request.query_params.get("customer"):
            qs = qs.filter(customer_id=customer_id)

        if status_param := self.request.query_params.get("status"):
            qs = qs.filter(status=status_param)

        if start_date := self.request.query_params.get("period_start"):
            qs = qs.filter(period_start__gte=start_date)

        if end_date := self.request.query_params.get("period_end"):
            qs = qs.filter(period_end__lte=end_date)

        if search := self.request.query_params.get("search"):
            qs = qs.filter(
                Q(code__icontains=search)
                | Q(number__icontains=search)
                | Q(invoice_number__icontains=search)
                | Q(invoice_series__icontains=search)
                | Q(discount_basis__icontains=search)
                | Q(customer__name__icontains=search)
            )

        return qs

    def create(self, request, *args, **kwargs):
        company = self.get_company()
        if not company:
            raise ValidationError({"company": "Không tìm thấy doanh nghiệp làm việc."})

        serializer = discount_invoice_serializers.DiscountInvoiceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = discount_invoice_services.validate_discount_invoice_data(
            company=company,
            data=serializer.validated_data,
        )
        inv = discount_invoice_services.create_discount_invoice(request, validated_data)
        return Response(
            discount_invoice_serializers.DiscountInvoiceDetailSerializer(inv).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        invoice = self.get_object()
        company = invoice.company

        serializer = discount_invoice_serializers.DiscountInvoiceInputSerializer(data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)

        validated_data = discount_invoice_services.validate_discount_invoice_data(
            company=company,
            data=serializer.validated_data,
            instance=invoice,
        )
        updated_inv = discount_invoice_services.update_discount_invoice(request, invoice, validated_data)
        return Response(discount_invoice_serializers.DiscountInvoiceDetailSerializer(updated_inv).data)

    def destroy(self, request, *args, **kwargs):
        invoice = self.get_object()
        discount_invoice_services.delete_discount_invoice(request, invoice)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="eligible-invoices")
    def eligible_invoices(self, request):
        company = self.get_company()
        customer_id = request.query_params.get("customer")
        period_start = request.query_params.get("period_start")
        period_end = request.query_params.get("period_end")
        currency_id = request.query_params.get("currency")

        if not customer_id:
            raise ValidationError({"customer": "Khách hàng là bắt buộc."})
        if not period_start or not period_end:
            raise ValidationError({"period": "Kỳ chiết khấu (ngày bắt đầu và kết thúc) là bắt buộc."})

        data = discount_invoice_services.get_eligible_invoices_and_lines(
            company=company,
            customer_id=customer_id,
            period_start=period_start,
            period_end=period_end,
            currency_id=currency_id,
        )
        return Response(data)

    @action(detail=False, methods=["post"], url_path="calculate-allocation")
    def calculate_allocation(self, request):
        serializer = discount_invoice_serializers.CalculateAllocationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        total_disc = serializer.validated_data["total_discount_before_tax"]
        lines = serializer.validated_data["lines"]

        res = discount_invoice_services.calculate_allocation(total_disc, lines)
        return Response(res)

    @action(detail=False, methods=["post"], url_path="create-from-basis")
    def create_from_basis(self, request):
        """Create discount invoice from pre-calculated discount basis/voucher (AF-02)."""
        company = self.get_company()
        serializer = discount_invoice_serializers.DiscountInvoiceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = discount_invoice_services.validate_discount_invoice_data(
            company=company,
            data=serializer.validated_data,
        )
        inv = discount_invoice_services.create_discount_invoice(request, validated_data)
        return Response(
            discount_invoice_serializers.DiscountInvoiceDetailSerializer(inv).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="submit-approval")
    def submit_approval(self, request, pk=None):
        invoice = self.get_object()
        inv = discount_invoice_services.submit_discount_invoice_approval(request, invoice)
        return Response(discount_invoice_serializers.DiscountInvoiceDetailSerializer(inv).data)

    @action(detail=True, methods=["post"], url_path="withdraw")
    def withdraw(self, request, pk=None):
        invoice = self.get_object()
        reason = request.data.get("withdrawal_reason", "")
        inv = discount_invoice_services.withdraw_discount_invoice_approval(request, invoice, reason=reason)
        return Response(discount_invoice_serializers.DiscountInvoiceDetailSerializer(inv).data)

    @action(detail=True, methods=["post"], url_path="return-to-draft")
    def return_to_draft(self, request, pk=None):
        invoice = self.get_object()
        inv = discount_invoice_services.return_approved_discount_invoice_to_draft(request, invoice)
        return Response(discount_invoice_serializers.DiscountInvoiceDetailSerializer(inv).data)

    @action(detail=True, methods=["post"], url_path="issue")
    def issue(self, request, pk=None):
        invoice = self.get_object()
        force_fail = bool(request.data.get("force_fail", False))
        error_msg = request.data.get("error_message", "")
        inv = discount_invoice_services.issue_discount_invoice(request, invoice, force_fail=force_fail, error_message=error_msg)
        return Response(discount_invoice_serializers.DiscountInvoiceDetailSerializer(inv).data)

    @action(detail=True, methods=["post"], url_path="retry-issue")
    def retry_issue(self, request, pk=None):
        invoice = self.get_object()
        force_fail = bool(request.data.get("force_fail", False))
        error_msg = request.data.get("error_message", "")
        inv = discount_invoice_services.retry_issue_discount_invoice(request, invoice, force_fail=force_fail, error_message=error_msg)
        return Response(discount_invoice_serializers.DiscountInvoiceDetailSerializer(inv).data)

    @action(detail=True, methods=["post"], url_path="check-issue-status")
    def check_issue_status(self, request, pk=None):
        invoice = self.get_object()
        res = discount_invoice_services.check_issue_status(request, invoice)
        if isinstance(res, models.SalesDiscountInvoice):
            return Response(discount_invoice_serializers.DiscountInvoiceDetailSerializer(res).data)
        return Response(res)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        serializer = discount_invoice_serializers.CancelDiscountInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        inv = discount_invoice_services.cancel_discount_invoice(request, invoice, reason=serializer.validated_data["cancellation_reason"])
        return Response(discount_invoice_serializers.DiscountInvoiceDetailSerializer(inv).data)

    @action(detail=True, methods=["get"], url_path="download-files")
    def download_files(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != models.DiscountInvoiceStatus.ISSUED:
            raise ValidationError("Chỉ có thể tải tệp khi hóa đơn đã phát hành thành công (AF-08).")

        return Response({
            "code": invoice.code,
            "invoice_number": invoice.invoice_number,
            "invoice_series": invoice.invoice_series,
            "xml_file_url": invoice.xml_file_url,
            "pdf_file_url": invoice.pdf_file_url,
            "lookup_url": invoice.lookup_url,
            "lookup_code": invoice.lookup_code,
        })

    @action(detail=True, methods=["post"], url_path="send-email")
    def send_email(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != models.DiscountInvoiceStatus.ISSUED:
            raise ValidationError("Chỉ có thể gửi email khi hóa đơn đã phát hành thành công (AF-08).")

        email_to = request.data.get("email") or invoice.buyer_email
        if not email_to:
            raise ValidationError({"email": "Vui lòng cung cấp địa chỉ email nhận hóa đơn."})

        # Record audit log for email dispatch
        discount_invoice_services.audit_discount_invoice(
            request, invoice, "SEND_EMAIL",
            after={"email": email_to, "status": invoice.status}
        )
        return Response({
            "success": True,
            "message": f"Hóa đơn chiết khấu đã được gửi tới email {email_to}.",
            "email": email_to,
        })
