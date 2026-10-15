from django.db import transaction
from rest_framework import mixins, serializers as drf_serializers, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet, ReadOnlyModelViewSet

from . import models, serializers, services
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
    queryset = models.TaxInvoice.objects.select_related("company", "branch", "party", "currency", "original_invoice", "created_by").prefetch_related("lines", "validation_results", "document_links", "status_history")
    serializer_class = serializers.InvoiceSerializer
    iam_permissions = permissions("TAX.INVOICE")
    action_permissions = {
        "validate_invoice": "TAX.INVOICE.VALIDATE", "issue": "TAX.INVOICE.ISSUE",
        "cancel": "TAX.INVOICE.CANCEL", "history": "TAX.INVOICE.VIEW",
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

    def perform_destroy(self, instance):
        if instance.status not in {"DRAFT", "RECEIVED", "BLOCKED"}:
            raise drf_serializers.ValidationError("Hóa đơn đã xử lý không được xóa.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=True, methods=("post",), url_path="validate")
    def validate_invoice(self, request, pk=None):
        return Response(self.get_serializer(services.validate_invoice(self.get_object(), request)).data)

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
            "links": serializers.DocumentLinkSerializer(invoice.document_links.all(), many=True).data,
        })


class DocumentLinkViewSet(CompanyViewSet):
    queryset = models.InvoiceDocumentLink.objects.select_related("company", "invoice", "created_by")
    serializer_class = serializers.DocumentLinkSerializer
    iam_permissions = permissions("TAX.LINK")
    search_fields = ("document_number", "module_code", "entity_type")
    ordering_fields = ("created_at", "linked_amount")

    def perform_create(self, serializer):
        serializer.instance = services.add_link(serializer.validated_data, self.request)

    def perform_destroy(self, instance):
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
    queryset = models.TaxObligation.objects.select_related("company", "period", "filing", "created_by")
    serializer_class = serializers.ObligationSerializer
    iam_permissions = permissions("TAX.OBLIGATION")
    action_permissions = {"link_payment": "TAX.OBLIGATION.PAYMENT"}
    search_fields = ("tax_type", "period__code", "reason")
    ordering_fields = ("due_date", "assessed_amount", "paid_amount", "created_at")

    @action(detail=True, methods=("post",), url_path="link-payment")
    def link_payment(self, request, pk=None):
        return Response(serializers.PaymentLinkSerializer(services.link_payment(self.get_object(), request)).data, status=status.HTTP_201_CREATED)


class ReconciliationViewSet(ReadOnlyModelViewSet):
    permission_classes = (TaxPermission,)
    serializer_class = serializers.ReconciliationSerializer
    queryset = models.ReconciliationRun.objects.select_related("company", "period", "created_by")
    iam_permissions = {"GET": "TAX.RECONCILIATION.VIEW"}
    action_permissions = {"run": "TAX.RECONCILIATION.RUN"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()

    @action(detail=False, methods=("post",))
    def run(self, request):
        try:
            period = models.TaxPeriod.objects.get(pk=request.data.get("period"), company_id=request.data.get("company"))
        except (models.TaxPeriod.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"period": "Kỳ thuế không hợp lệ."})
        return Response(self.get_serializer(services.reconcile(period, request)).data, status=status.HTTP_201_CREATED)


class ConnectorViewSet(CompanyViewSet):
    queryset = models.ConnectorConfig.objects.select_related("company")
    serializer_class = serializers.ConnectorSerializer
    iam_permissions = permissions("TAX.CONNECTOR")
    search_fields = ("code", "provider", "channel")

    def perform_create(self, serializer):
        obj = serializer.save()
        services.audit(self.request, obj, "CREATE", after=serializer.data)


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
        return Response(self.get_serializer(services.integration_result(self.get_object(), request)).data)


class ExportViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    permission_classes = (TaxPermission,)
    serializer_class = serializers.ExportSerializer
    queryset = models.TaxExport.objects.select_related("company", "period", "filing", "exported_by")
    iam_permissions = {"GET": "TAX.EXPORT.VIEW", "POST": "TAX.EXPORT.EXPORT"}
    action_permissions = {"submission_result": "TAX.EXPORT.SUBMIT"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()

    def perform_create(self, serializer):
        serializer.instance = services.export_data(serializer.validated_data, self.request)

    @action(detail=True, methods=("post",), url_path="submission-result")
    def submission_result(self, request, pk=None):
        obj = self.get_object()
        result = request.data.get("status")
        if result not in {"SUBMITTED", "ACCEPTED", "REJECTED"}:
            raise drf_serializers.ValidationError({"status": "Kết quả không hợp lệ."})
        obj.submission_status = result
        obj.submission_reference = request.data.get("reference", obj.submission_reference)
        obj.save(update_fields=("submission_status", "submission_reference"))
        services.audit(request, obj, "EXPORT_RESULT", after={"status": result, "reference": obj.submission_reference})
        return Response(self.get_serializer(obj).data)

