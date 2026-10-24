import hashlib
import hmac
import json

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from urllib.parse import quote
from rest_framework import mixins, serializers as drf_serializers, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet, ModelViewSet, ReadOnlyModelViewSet

from . import declarations, exports, input_validation, intake, linking, models, obligations, query, reconciliation, serializers, services, submissions, vat
from .permissions import TaxPermission


def permissions(resource):
    return {"GET": f"{resource}.VIEW", "POST": f"{resource}.CREATE", "PUT": f"{resource}.EDIT", "PATCH": f"{resource}.EDIT", "DELETE": f"{resource}.DELETE"}


class CompanyViewSet(ModelViewSet):
    permission_classes = (TaxPermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    ordering = ("-created_at",)

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return super().get_queryset().filter(company_id=company) if company else super().get_queryset().none()

    def perform_create(self, serializer):
        fields = {field.name for field in serializer.Meta.model._meta.fields}
        key = "exported_by" if "exported_by" in fields else "created_by" if "created_by" in fields else None
        obj = serializer.save(**({key: services.actor(self.request)} if key else {}))
        services.audit(self.request, obj, "CREATE", after=serializer.data)

    def perform_update(self, serializer):
        before = self.get_serializer(serializer.instance).data
        obj = serializer.save()
        services.audit(self.request, obj, "EDIT", before=before, after=serializer.data)


class InvoiceViewSet(CompanyViewSet):
    queryset = models.TaxInvoice.objects.select_related("company", "branch", "party", "currency", "original_invoice", "created_by", "source_file").prefetch_related("lines", "validation_results", "document_links", "status_history")
    serializer_class = serializers.InvoiceSerializer
    iam_permissions = permissions("TAX.INVOICE")
    action_permissions = {
        "validate_invoice": "TAX.INVOICE.VALIDATE", "issue": "TAX.INVOICE.ISSUE",
        "cancel": "TAX.INVOICE.CANCEL", "history": "TAX.INVOICE.VIEW",
        "receive_input_xml": "TAX.INVOICE.CREATE", "source_xml": "TAX.INVOICE.VIEW",
        "link_candidates": "TAX.LINK.VIEW", "purchase_links": "TAX.LINK.VIEW",
        "link_purchase": "TAX.LINK.CREATE", "unlink_purchase": "TAX.LINK.DELETE",
        "output_context": "TAX.INVOICE.VIEW",
        "query_invoices": "TAX.INVOICE.VIEW",
    }
    search_fields = ("invoice_series", "invoice_number", "seller_tax_code", "buyer_tax_code", "seller_name", "buyer_name", "source_reference")
    ordering_fields = ("invoice_date", "subtotal", "tax_amount", "total_amount", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in ("direction", "status", "invoice_type", "party_id", "branch_id"):
            if value := self.request.query_params.get(field):
                queryset = queryset.filter(**{field: value})
        if date_from := self.request.query_params.get("date_from"):
            queryset = queryset.filter(invoice_date__gte=date_from)
        if date_to := self.request.query_params.get("date_to"):
            queryset = queryset.filter(invoice_date__lte=date_to)
        return queryset

    @action(detail=False, methods=("get",), url_path="query")
    def query_invoices(self, request):
        return Response(query.query_invoices(CompanyViewSet.get_queryset(self), request.query_params))

    @action(detail=False, methods=("get",), url_path="output-context")
    def output_context(self, request):
        from organization.models import Company
        company = Company.objects.filter(pk=request.query_params.get("company_id")).first()
        if not company:
            raise drf_serializers.ValidationError({"company_id": "Không tìm thấy doanh nghiệp."})
        return Response({"seller_name": company.legal_name or company.name,
                         "seller_tax_code": company.tax_code})

    def perform_destroy(self, instance):
        if instance.status not in {"DRAFT", "RECEIVED", "BLOCKED"}:
            raise drf_serializers.ValidationError("Hóa đơn đã xử lý không được xóa.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=False, methods=("post",), url_path="receive-input-xml")
    def receive_input_xml(self, request):
        with transaction.atomic():
            invoice, duplicate = intake.receive_input_xml(request)
            if not duplicate:
                input_validation.check_input_invoice(invoice, request, trigger_type="AFTER_INTAKE")
                invoice.refresh_from_db()
        return Response({"invoice": self.get_serializer(invoice).data, "duplicate": duplicate},
                        status=status.HTTP_200_OK if duplicate else status.HTTP_201_CREATED)

    @action(detail=True, methods=("get",), url_path="source-xml")
    def source_xml(self, request, pk=None):
        invoice = self.get_object()
        source = models.TaxInvoiceSourceFile.objects.filter(invoice=invoice).first()
        if not source:
            return Response({"detail": "Hóa đơn không có file XML nguồn."}, status=status.HTTP_404_NOT_FOUND)
        response = HttpResponse(bytes(source.content), content_type="application/xml")
        response["Content-Disposition"] = "attachment; filename*=UTF-8''" + quote(source.filename)
        return response

    @action(detail=True, methods=("post",), url_path="validate")
    def validate_invoice(self, request, pk=None):
        invoice = self.get_object()
        if invoice.direction == "INPUT":
            input_validation.check_input_invoice(invoice, request)
            invoice.refresh_from_db()
            return Response(self.get_serializer(invoice).data)
        return Response(self.get_serializer(services.validate_invoice(invoice, request)).data)

    @action(detail=True, methods=("post",))
    def issue(self, request, pk=None):
        invoice = self.get_object()
        try:
            connector = models.ConnectorConfig.objects.get(pk=request.data.get("connector"), company=invoice.company, is_active=True)
        except (models.ConnectorConfig.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"connector": "Connector không hợp lệ."})
        obj = services.request_integration(
            invoice=invoice, connector=connector, task_type="ISSUE",
            key=request.data.get("idempotency_key", ""), payload=request.data.get("payload", {}), request=request,
        )
        return Response(serializers.IntegrationSerializer(obj).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        return Response(serializers.IntegrationSerializer(services.cancel_invoice(self.get_object(), request)).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        invoice = self.get_object()
        return Response({
            "invoice": self.get_serializer(invoice).data,
            "statuses": serializers.HistorySerializer(invoice.status_history.all(), many=True).data,
            "validations": serializers.ValidationSerializer(invoice.validation_results.all(), many=True).data,
            "runs": serializers.ValidationRunSerializer(invoice.validation_runs.prefetch_related("results").all(), many=True).data,
            "links": serializers.DocumentLinkSerializer(invoice.document_links.all(), many=True).data,
            "corrections": [{"id": str(link.target_id), "type": link.link_type, "reason": link.reason,
                "status": link.target.status, "invoice_number": link.target.invoice_number,
                "effect": link.target.adjustment_effect, "total_amount": str(link.target.total_amount)}
                for link in invoice.correction_links.select_related("target").all()],
            "integration_requests": serializers.IntegrationSerializer(
                invoice.integration_requests.order_by("-created_at"), many=True).data,
        })

    @action(detail=True, methods=("get",), url_path="link-candidates")
    def link_candidates(self, request, pk=None):
        invoice = self.get_object()
        return Response({"candidates": linking.candidates(invoice, request),
                         "summary": linking.link_summary(invoice)})

    @action(detail=True, methods=("get",), url_path="purchase-links")
    def purchase_links(self, request, pk=None):
        return Response(linking.link_summary(self.get_object()))

    @action(detail=True, methods=("post",), url_path="link-purchase")
    def link_purchase(self, request, pk=None):
        return Response(linking.link_purchase(self.get_object(), request), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="unlink-purchase")
    def unlink_purchase(self, request, pk=None):
        return Response(linking.unlink_purchase(self.get_object(), request))


class DocumentLinkViewSet(CompanyViewSet):
    queryset = models.InvoiceDocumentLink.objects.select_related("company", "invoice", "created_by")
    serializer_class = serializers.DocumentLinkSerializer
    iam_permissions = permissions("TAX.LINK")
    search_fields = ("document_number", "module_code", "entity_type")
    ordering_fields = ("created_at", "linked_amount")

    def perform_create(self, serializer):
        serializer.instance = services.add_link(serializer.validated_data, self.request)

    def perform_update(self, serializer):
        if serializer.instance.invoice.direction == "INPUT":
            raise drf_serializers.ValidationError("Dùng thao tác liên kết chứng từ mua hàng của hóa đơn.")
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.invoice.direction == "INPUT":
            raise drf_serializers.ValidationError("Dùng thao tác gỡ liên kết có lý do của hóa đơn.")
        services.audit(self.request, instance, "UNLINK", before=self.get_serializer(instance).data)
        instance.delete()


class PeriodViewSet(ModelViewSet):
    permission_classes = (TaxPermission,)
    serializer_class = serializers.PeriodSerializer
    queryset = models.TaxPeriod.objects.select_related("company")
    iam_permissions = permissions("TAX.PERIOD")

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class SummaryViewSet(ReadOnlyModelViewSet):
    permission_classes = (TaxPermission,)
    serializer_class = serializers.SummarySerializer
    queryset = models.TaxSummary.objects.select_related("company", "period", "created_by")
    iam_permissions = {"GET": "TAX.SUMMARY.VIEW"}
    action_permissions = {"build": "TAX.SUMMARY.CREATE"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()

    @action(detail=False, methods=("post",))
    def build(self, request):
        try:
            period = models.TaxPeriod.objects.get(pk=request.data.get("period"), company_id=request.data.get("company"))
        except (models.TaxPeriod.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"period": "Kỳ thuế không hợp lệ."})
        return Response(self.get_serializer(services.build_summary(period, request)).data, status=status.HTTP_201_CREATED)


class VatCalculationViewSet(ReadOnlyModelViewSet):
    permission_classes = (TaxPermission,)
    queryset = models.VatCalculation.objects.select_related("company", "period")
    serializer_class = serializers.VatCalculationSerializer
    iam_permissions = {"GET": "TAX.SUMMARY.VIEW"}
    action_permissions = {"calculate": "TAX.SUMMARY.CREATE", "deduction_document": "TAX.SUMMARY.CREATE",
                          "accounts": "TAX.SUMMARY.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        if period := self.request.query_params.get("period_id"):
            queryset = queryset.filter(period_id=period)
        return queryset

    @action(detail=False, methods=("post",))
    def calculate(self, request):
        company_id = request.query_params.get("company_id") or request.data.get("company")
        if str(request.data.get("company")) != str(company_id):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp trong yêu cầu không khớp phạm vi truy cập."})
        period = models.TaxPeriod.objects.filter(pk=request.data.get("period"),
            company_id=company_id, tax_type="VAT").first()
        if not period:
            raise drf_serializers.ValidationError({"period": "Kỳ thuế GTGT không thuộc doanh nghiệp đang chọn."})
        calculation = vat.calculate(period, request)
        return Response(self.get_serializer(calculation).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("get",))
    def accounts(self, request):
        from general_ledger.models import Account
        accounts = Account.objects.filter(company_id=request.query_params.get("company_id"),
            status="ACTIVE", is_postable=True).filter(
                Q(code__startswith="133") | Q(code__startswith="3331"))
        return Response([{"id": str(row.id), "code": row.code, "name": row.name} for row in accounts.order_by("code")])

    @action(detail=True, methods=("post",), url_path="deduction-document")
    def deduction_document(self, request, pk=None):
        document = vat.create_document(self.get_object(), request)
        return Response(serializers.VatDeductionDocumentSerializer(document).data, status=status.HTTP_201_CREATED)


class TaxFormRegistrationView(APIView):
    permission_classes = (TaxPermission,)
    iam_permissions = {"GET": "TAX.FILING.VIEW", "PUT": "TAX.FILING.CREATE"}

    def _company(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.data.get("company")
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        return company

    def get(self, request):
        return Response({"forms": declarations.registrations(self._company(request))})

    def put(self, request):
        company = self._company(request)
        if str(request.data.get("company")) != str(request.query_params.get("company_id")):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không khớp phạm vi truy cập."})
        return Response({"forms": declarations.save_registrations(company, request.data.get("forms"), request)})


class TaxDeclarationViewSet(ReadOnlyModelViewSet):
    permission_classes = (TaxPermission,)
    queryset = models.TaxDeclaration.objects.select_related("period", "source_calculation", "created_by")
    serializer_class = serializers.TaxDeclarationSerializer
    iam_permissions = {"GET": "TAX.FILING.VIEW", "POST": "TAX.FILING.CREATE"}
    action_permissions = {"save_draft": "TAX.FILING.EDIT", "refresh_source": "TAX.FILING.EDIT",
                          "confirm_declaration": "TAX.FILING.EDIT",
                          "sources": "TAX.FILING.VIEW", "manual_submissions": "TAX.FILING.SUBMIT"}

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company_id) if company_id else self.queryset.none()
        if period_id := self.request.query_params.get("period_id"):
            queryset = queryset.filter(period_id=period_id)
        return queryset.order_by("-created_at")

    def create(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id")
        if str(request.data.get("company")) != str(company_id):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không khớp phạm vi truy cập."})
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        if request.data.get("form_code") != "01/GTGT":
            raise drf_serializers.ValidationError({"form_code": "MVP hiện hỗ trợ lập mẫu 01/GTGT."})
        obj, created = declarations.create_declaration(company, request.data.get("period"), request)
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="save-draft")
    def save_draft(self, request, pk=None):
        return Response(self.get_serializer(declarations.save_draft(self.get_object(), request.data, request)).data)

    @action(detail=True, methods=("post",), url_path="refresh-source")
    def refresh_source(self, request, pk=None):
        return Response(self.get_serializer(declarations.refresh(self.get_object(), request)).data)

    @action(detail=True, methods=("post",), url_path="confirm")
    def confirm_declaration(self, request, pk=None):
        return Response(self.get_serializer(declarations.confirm(self.get_object(), request)).data)

    @action(detail=True, methods=("get",))
    def sources(self, request, pk=None):
        obj = self.get_object()
        return Response({"calculation_id": obj.source_calculation_id,
                         "calculation_version": obj.source_calculation.version,
                         "source_is_current": declarations.source_current(obj),
                         "sources": obj.source_calculation.sources,
                         "warnings": obj.warnings})

    @action(detail=True, methods=("post",), url_path="manual-submissions")
    def manual_submissions(self, request, pk=None):
        obj, created = submissions.record_manual(self.get_object(), request.data, request)
        return Response(serializers.TaxSubmissionSerializer(obj).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class TaxSubmissionViewSet(ReadOnlyModelViewSet):
    permission_classes = (TaxPermission,)
    queryset = models.TaxSubmission.objects.select_related("company", "declaration__period", "created_by").prefetch_related("events")
    serializer_class = serializers.TaxSubmissionSerializer
    iam_permissions = {"GET": "TAX.FILING.VIEW"}
    action_permissions = {"manual_status": "TAX.FILING.SUBMIT"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        if declaration := self.request.query_params.get("declaration"):
            queryset = queryset.filter(declaration_id=declaration)
        return queryset.order_by("-created_at")

    @action(detail=True, methods=("post",), url_path="manual-status")
    def manual_status(self, request, pk=None):
        return Response(self.get_serializer(submissions.update_manual_status(self.get_object(), request.data, request)).data)


class FilingViewSet(CompanyViewSet):
    queryset = models.TaxFiling.objects.select_related("company", "period", "summary", "created_by")
    serializer_class = serializers.FilingSerializer
    iam_permissions = permissions("TAX.FILING")
    action_permissions = {"submit": "TAX.FILING.SUBMIT", "submission_result": "TAX.FILING.SUBMIT"}
    search_fields = ("filing_type", "submission_reference", "period__code")
    ordering_fields = ("period__start_date", "version", "created_at")

    def perform_create(self, serializer):
        serializer.instance = services.create_filing(serializer.validated_data, self.request)

    def perform_update(self, serializer):
        if serializer.instance.status != "DRAFT":
            raise drf_serializers.ValidationError("Chỉ hồ sơ nháp mới được sửa.")
        super().perform_update(serializer)

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        filing = self.get_object()
        if filing.status != "DRAFT":
            raise drf_serializers.ValidationError("Chỉ hồ sơ nháp mới được nộp.")
        try:
            connector = models.ConnectorConfig.objects.get(pk=request.data.get("connector"), company=filing.company, is_active=True)
        except (models.ConnectorConfig.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"connector": "Connector không hợp lệ."})
        obj = services.request_integration(
            filing=filing, connector=connector, task_type="SUBMIT_FILING",
            key=request.data.get("idempotency_key", ""), payload=request.data.get("payload", {}), request=request,
        )
        return Response(serializers.IntegrationSerializer(obj).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="submission-result")
    def submission_result(self, request, pk=None):
        filing = self.get_object()
        if filing.status not in {"SUBMITTED", "REJECTED"} or request.data.get("status") not in {"ACCEPTED", "REJECTED"}:
            raise drf_serializers.ValidationError("Kết quả nộp hồ sơ không hợp lệ.")
        filing.status = request.data["status"]
        filing.submission_reference = request.data.get("reference", filing.submission_reference)
        filing.save(update_fields=("status", "submission_reference", "updated_at"))
        services.audit(request, filing, "SUBMISSION_RESULT", after={"status": filing.status, "reference": filing.submission_reference})
        return Response(self.get_serializer(filing).data)


class ObligationViewSet(CompanyViewSet):
    queryset = models.TaxObligation.objects.select_related("company", "period", "filing", "source_declaration", "created_by")
    serializer_class = serializers.ObligationSerializer
    iam_permissions = permissions("TAX.OBLIGATION")
    action_permissions = {"link_payment": "TAX.OBLIGATION.PAYMENT", "e_payment": "TAX.OBLIGATION.PAYMENT",
                          "recognize": "TAX.OBLIGATION.CREATE", "sources": "TAX.OBLIGATION.VIEW"}
    search_fields = ("tax_type", "period__code", "reason")
    ordering_fields = ("due_date", "assessed_amount", "paid_amount", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        if tax_type := self.request.query_params.get("tax_type"):
            queryset = queryset.filter(tax_type=tax_type)
        if period_id := self.request.query_params.get("period_id"):
            queryset = queryset.filter(period_id=period_id)
        return queryset

    def create(self, request):
        raise drf_serializers.ValidationError("Ghi nhận nghĩa vụ qua hồ sơ nguồn bằng thao tác recognize.")

    def update(self, request, pk=None):
        raise drf_serializers.ValidationError("Không được sửa đè số nghĩa vụ; sử dụng nghiệp vụ điều chỉnh có lịch sử.")

    def partial_update(self, request, pk=None):
        return self.update(request, pk)

    def destroy(self, request, pk=None):
        raise drf_serializers.ValidationError("Không xóa nghĩa vụ đã ghi nhận.")

    @action(detail=False, methods=("post",))
    def recognize(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id")
        if str(request.data.get("company")) != str(company_id):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không khớp phạm vi truy cập."})
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        obj, created = obligations.recognize(company, request.data.get("declaration"),
            request.data.get("due_date"), request)
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=("get",))
    def sources(self, request, pk=None):
        obj = self.get_object()
        declaration = obj.source_declaration
        return Response({"source_type": "DECLARATION" if declaration else "LEGACY_OR_OTHER",
                         "declaration_id": declaration.id if declaration else None,
                         "declaration_version": declaration.version if declaration else None,
                         "basis": obj.reason,
                         "payment_orders": list(obj.payment_order_lines.select_related("order").values(
                             "order__id", "order__number", "order__status", "amount")),
                         "payment_links": list(obj.payment_links.values("id", "source_module", "transaction_id", "amount"))})

    @action(detail=True, methods=("post",), url_path="link-payment")
    def link_payment(self, request, pk=None):
        return Response(serializers.PaymentLinkSerializer(services.link_payment(self.get_object(), request)).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="e-payment")
    def e_payment(self, request, pk=None):
        """Electronic payment order (giấy nộp tiền điện tử) queued for the tax portal."""
        return Response(serializers.IntegrationSerializer(services.request_e_payment(self.get_object(), request)).data, status=status.HTTP_201_CREATED)


class TaxPaymentOrderViewSet(ReadOnlyModelViewSet):
    permission_classes = (TaxPermission,)
    queryset = models.TaxPaymentOrder.objects.select_related("company", "created_by").prefetch_related("lines")
    serializer_class = serializers.TaxPaymentOrderSerializer
    iam_permissions = {"GET": "TAX.OBLIGATION.VIEW", "POST": "TAX.OBLIGATION.PAYMENT"}
    action_permissions = {"cancel": "TAX.OBLIGATION.PAYMENT"}

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company_id).order_by("-created_at") if company_id else self.queryset.none()

    def create(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id")
        if str(request.data.get("company")) != str(company_id):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không khớp phạm vi truy cập."})
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        obj, created = obligations.create_order(company, request.data, request)
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        return Response(self.get_serializer(obligations.cancel_order(self.get_object(), request)).data)


class TaxAuthoritySettingView(APIView):
    """Managing tax office, tax agent and registered declaration forms."""
    permission_classes = (TaxPermission,)
    iam_permissions = {"GET": "TAX.CONNECTOR.VIEW", "PUT": "TAX.CONNECTOR.EDIT"}

    def _company(self, request):
        from organization.models import Company
        company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
        if not company:
            raise drf_serializers.ValidationError({"company": "Không tìm thấy doanh nghiệp."})
        return company

    def get(self, request):
        return Response(services.authority_settings(self._company(request)))

    def put(self, request):
        return Response(services.save_authority_settings(self._company(request), request.data, request))


class ReconciliationViewSet(ReadOnlyModelViewSet):
    permission_classes = (TaxPermission,)
    serializer_class = serializers.ReconciliationSerializer
    queryset = models.ReconciliationRun.objects.select_related("company", "period", "created_by")
    iam_permissions = {"GET": "TAX.RECONCILIATION.VIEW"}
    action_permissions = {"run": "TAX.RECONCILIATION.RUN"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        if period := self.request.query_params.get("period"):
            queryset = queryset.filter(period_id=period)
        if reconciliation_type := self.request.query_params.get("reconciliation_type"):
            queryset = queryset.filter(reconciliation_type=reconciliation_type)
        return queryset.order_by("-created_at")

    @action(detail=False, methods=("post",))
    def run(self, request):
        if str(request.query_params.get("company_id")) != str(request.data.get("company")):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không khớp phạm vi truy cập."})
        try:
            period = models.TaxPeriod.objects.get(pk=request.data.get("period"), company_id=request.data.get("company"))
        except (models.TaxPeriod.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"period": "Kỳ thuế không hợp lệ."})
        reconciliation_type = request.data.get("reconciliation_type")
        result = (reconciliation.run(period, reconciliation_type, request) if reconciliation_type
                  else services.reconcile(period, request))
        return Response(self.get_serializer(result).data, status=status.HTTP_201_CREATED)


class ConnectorViewSet(CompanyViewSet):
    queryset = models.ConnectorConfig.objects.select_related("company")
    serializer_class = serializers.ConnectorSerializer
    iam_permissions = permissions("TAX.CONNECTOR")
    search_fields = ("code", "provider", "channel")

    def perform_create(self, serializer):
        if str(serializer.validated_data["company"].id) != str(self.request.query_params.get("company_id")):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không khớp phạm vi truy cập."})
        config = serializer.validated_data.get("config") or {}
        obj = serializer.save(is_active=False) if "callback_secret" not in config else serializer.save()
        services.audit(self.request, obj, "CREATE", after=self.get_serializer(obj).data)

    def perform_update(self, serializer):
        if "company" in serializer.validated_data and serializer.validated_data["company"] != serializer.instance.company:
            raise drf_serializers.ValidationError({"company": "Không thể đổi doanh nghiệp của kết nối."})
        changed_identity = any(field in serializer.validated_data and serializer.validated_data[field] != getattr(serializer.instance, field)
                               for field in ("code", "provider", "channel", "config"))
        if serializer.instance.is_active and changed_identity and serializer.validated_data.get("is_active") is not False:
            raise drf_serializers.ValidationError("Ngừng kết nối trước khi sửa thông tin Provider hoặc cấu hình.")
        if "config" in serializer.validated_data:
            serializer.validated_data["config"] = {**serializer.instance.config, **serializer.validated_data["config"]}
        if serializer.instance.is_active is False and serializer.validated_data.get("is_active") is True:
            raise drf_serializers.ValidationError({"is_active": "Chưa có bước xác thực Provider để kích hoạt kết nối."})
        super().perform_update(serializer)


class IntegrationViewSet(ReadOnlyModelViewSet):
    permission_classes = (TaxPermission,)
    serializer_class = serializers.IntegrationSerializer
    queryset = models.IntegrationRequest.objects.select_related("company", "connector", "invoice", "filing", "created_by")
    iam_permissions = {"GET": "TAX.CONNECTOR.VIEW"}
    action_permissions = {"result": "TAX.CONNECTOR.SYNC"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()

    @action(detail=True, methods=("post",))
    def result(self, request, pk=None):
        integration = self.get_object()
        if integration.task_type in {"ISSUE", "CANCEL"}:
            secret = integration.connector.config.get("callback_secret", "")
            signed = json.dumps({"request_id": str(integration.pk), "status": request.data.get("status"),
                "response": request.data.get("response") or {}}, sort_keys=True,
                separators=(",", ":"), ensure_ascii=False).encode("utf-8")
            expected = hmac.new(str(secret).encode("utf-8"), signed, hashlib.sha256).hexdigest() if secret else ""
            if not expected or not hmac.compare_digest(expected, request.headers.get("X-Tax-Provider-Signature", "")):
                raise drf_serializers.ValidationError("Kết quả phát hành chưa được xác thực từ kết nối hóa đơn điện tử.")
        return Response(self.get_serializer(services.integration_result(integration, request)).data)


class ExportViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    permission_classes = (TaxPermission,)
    serializer_class = serializers.ExportSerializer
    queryset = models.TaxExport.objects.select_related("company", "period", "filing", "exported_by")
    iam_permissions = {"GET": "TAX.EXPORT.VIEW", "POST": "TAX.EXPORT.EXPORT"}
    action_permissions = {"submission_result": "TAX.EXPORT.SUBMIT", "generate": "TAX.EXPORT.EXPORT",
                          "download": "TAX.EXPORT.EXPORT"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        if not company or self.request.user.is_superuser:
            return queryset
        from iam.permissions import has_effective_permission
        from organization.models import Company
        scoped_company = Company.objects.filter(pk=company).first()
        allowed = [export_type for export_type, (_, permission, _) in exports.TYPES.items()
                   if scoped_company and has_effective_permission(self.request.user.iam_account, scoped_company, permission)]
        return queryset.filter(Q(data_snapshot__export_type__isnull=True) | Q(data_snapshot__export_type__in=allowed))

    def perform_create(self, serializer):
        if str(serializer.validated_data["company"].id) != str(self.request.query_params.get("company_id")):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không khớp phạm vi truy cập."})
        serializer.instance = services.export_data(serializer.validated_data, self.request)

    @action(detail=False, methods=("post",))
    def generate(self, request):
        if str(request.query_params.get("company_id")) != str(request.data.get("company")):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không khớp phạm vi truy cập."})
        try:
            period = models.TaxPeriod.objects.select_related("company").get(
                pk=request.data.get("period"), company_id=request.data.get("company"))
        except (models.TaxPeriod.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"period": "Kỳ thuế không hợp lệ."})
        export = exports.generate(request=request, company=period.company, period=period,
            export_type=request.data.get("export_type"), purpose=request.data.get("purpose"))
        return Response(self.get_serializer(export).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("get",))
    def download(self, request, pk=None):
        export = self.get_object()
        content = exports.xlsx_bytes(export)
        response = HttpResponse(content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = f'attachment; filename="{exports.filename(export)}"'
        return response

    @action(detail=True, methods=("post",), url_path="submission-result")
    def submission_result(self, request, pk=None):
        obj = self.get_object()
        if obj.data_snapshot.get("export_type"):
            raise drf_serializers.ValidationError("Bản xuất báo cáo nội bộ không phải hồ sơ nộp thuế.")
        result = request.data.get("status")
        if result not in {"SUBMITTED", "ACCEPTED", "REJECTED"}:
            raise drf_serializers.ValidationError({"status": "Kết quả không hợp lệ."})
        obj.submission_status = result
        obj.submission_reference = request.data.get("reference", obj.submission_reference)
        obj.save(update_fields=("submission_status", "submission_reference"))
        services.audit(request, obj, "EXPORT_RESULT", after={"status": result, "reference": obj.submission_reference})
        return Response(self.get_serializer(obj).data)

