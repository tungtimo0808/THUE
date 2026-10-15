from django.http import HttpResponse
from rest_framework import serializers as drf_serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet, ViewSet

from audit_log.services import record_audit
from general_ledger.models import JournalEntry
from iam.permissions import assignment_permission_codes, effective_assignments, has_effective_permission
from organization.models import Company

from . import exporters, services
from .models import ReportDefinition, ReportExport, ReportLineMapping, ReportRun
from .permissions import ReportingPermission
from .serializers import (
    ExportRequestSerializer, ReportDefinitionSerializer, ReportExportSerializer,
    ReportLineMappingSerializer, ReportRequestSerializer, ReportRunSerializer,
)


def _company(request):
    company_id = request.query_params.get("company_id") or request.data.get("company")
    try:
        return Company.objects.get(pk=company_id)
    except (Company.DoesNotExist, ValueError, TypeError):
        raise drf_serializers.ValidationError({"company": "Doanh nghiệp không hợp lệ."})


def _can_view_definition(request, company, definition):
    if request.user.is_superuser:
        return True
    return any(definition.permission_code in assignment_permission_codes(item) for item in effective_assignments(request.user.iam_account, company))


class ReportDefinitionViewSet(ModelViewSet):
    permission_classes = (ReportingPermission,)
    serializer_class = ReportDefinitionSerializer
    queryset = ReportDefinition.objects.prefetch_related("line_mappings")
    iam_permissions = {"GET": "RPT.CENTER.VIEW", "POST": "RPT.CONFIG.CREATE", "PUT": "RPT.CONFIG.EDIT", "PATCH": "RPT.CONFIG.EDIT", "DELETE": "RPT.CONFIG.DELETE"}

    def get_queryset(self):
        queryset = self.queryset
        if getattr(self, "action", None) == "list":
            queryset = queryset.filter(is_active=True)
            if group := self.request.query_params.get("group"):
                queryset = queryset.filter(group=group)
            if not self.request.user.is_superuser:
                company = _company(self.request)
                allowed = [item.id for item in queryset if _can_view_definition(self.request, company, item)]
                queryset = queryset.filter(id__in=allowed)
        return queryset

    def _audit(self, request, instance, action_code):
        record_audit(company=_company(request), actor_user=services.actor(request), module_code="RPT", action_code=action_code, entity=instance, after=self.get_serializer(instance).data, request=request)

    def perform_create(self, serializer):
        instance = serializer.save()
        self._audit(self.request, instance, "CREATE")

    def perform_update(self, serializer):
        instance = serializer.save()
        self._audit(self.request, instance, "EDIT")

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=("is_active", "updated_at"))
        self._audit(self.request, instance, "DEACTIVATE")


class ReportLineMappingViewSet(ModelViewSet):
    permission_classes = (ReportingPermission,)
    serializer_class = ReportLineMappingSerializer
    queryset = ReportLineMapping.objects.select_related("report")
    iam_permissions = {"GET": "RPT.CENTER.VIEW", "POST": "RPT.CONFIG.CREATE", "PUT": "RPT.CONFIG.EDIT", "PATCH": "RPT.CONFIG.EDIT", "DELETE": "RPT.CONFIG.DELETE"}

    def get_queryset(self):
        queryset = self.queryset
        if report := self.request.query_params.get("report_id"):
            queryset = queryset.filter(report_id=report)
        return queryset


class ReportEngineViewSet(ViewSet):
    permission_classes = (ReportingPermission,)
    serializer_class = ReportRequestSerializer
    action_permissions = {"execute": "RPT.CENTER.VIEW"}

    @action(detail=False, methods=("post",))
    def execute(self, request):
        serializer = ReportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        run = services.execute_report(serializer.validated_data, request)
        return Response(ReportRunSerializer(run).data, status=status.HTTP_201_CREATED)


class ReportRunViewSet(ReadOnlyModelViewSet):
    permission_classes = (ReportingPermission,)
    serializer_class = ReportRunSerializer
    queryset = ReportRun.objects.select_related("company", "report", "requested_by")
    iam_permissions = {"GET": "RPT.CENTER.VIEW"}
    action_permissions = {"drill_down": "RPT.CENTER.VIEW", "export": "RPT.CENTER.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        if report_code := self.request.query_params.get("report_code"):
            queryset = queryset.filter(report__code=report_code)
        return queryset

    @action(detail=True, methods=("get",), url_path="drill-down")
    def drill_down(self, request, pk=None):
        run = self.get_object()
        if not run.report.supports_drilldown:
            raise drf_serializers.ValidationError("Báo cáo này không hỗ trợ drill-down.")
        trace = run.source_trace
        denied_modules = []
        source_permissions = {
            "GL": "GL.JOURNAL.VIEW", "PUR": "PUR.ORDER.VIEW", "SAL": "SAL.ORDER.VIEW",
            "AP": "AP.PAYABLE.VIEW", "AR": "AR.RECEIVABLE.VIEW", "CASH": "CASH.TRANSACTION.VIEW",
            "BANK": "BANK.TRANSACTION.VIEW", "INV": "INV.BALANCE.VIEW", "FA": "FA.TRANSACTION.VIEW", "TAX": "TAX.INVOICE.VIEW",
        }
        if not request.user.is_superuser:
            allowed = []
            for item in trace:
                permission = source_permissions.get(item["module"])
                if permission and has_effective_permission(
                    request.user.iam_account, run.company, permission,
                    branch_id=run.parameters.get("branch"), department_id=run.parameters.get("department"),
                    warehouse_id=run.parameters.get("warehouse"), bank_account_id=run.parameters.get("bank_account"),
                ):
                    allowed.append(item)
                else:
                    denied_modules.append(item["module"])
            trace = allowed
        journal_ids = [item["entity_id"] for item in trace if item["module"] == "GL" and item["entity_type"] == "JournalEntry"]
        journals = JournalEntry.objects.filter(id__in=journal_ids, company=run.company).prefetch_related("lines__account")
        journal_details = [{
            "id": str(entry.id), "number": entry.number, "posting_date": entry.posting_date,
            "description": entry.description, "total_debit": entry.total_debit, "total_credit": entry.total_credit,
            "source_module": entry.source_module, "source_entity_type": entry.source_entity_type,
            "source_entity_id": entry.source_entity_id,
            "lines": [{"account": line.account.code, "debit": line.debit, "credit": line.credit, "description": line.description} for line in entry.lines.all()],
        } for entry in journals]
        return Response({"run": str(run.id), "trace": trace, "journals": journal_details, "denied_modules": sorted(set(denied_modules))})

    @action(detail=True, methods=("post",))
    def export(self, request, pk=None):
        run = self.get_object()
        serializer = ExportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file_format = serializer.validated_data["format"]
        if file_format == "XLSX" and not run.report.supports_excel:
            raise drf_serializers.ValidationError("Báo cáo không hỗ trợ Excel.")
        if file_format in {"PDF", "PRINT"} and not run.report.supports_pdf:
            raise drf_serializers.ValidationError("Báo cáo không hỗ trợ PDF/in.")
        builders = {
            "XLSX": (exporters.build_xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
            "PDF": (exporters.build_pdf, "application/pdf", "pdf"),
            "PRINT": (exporters.build_print_html, "text/html; charset=utf-8", "html"),
        }
        builder, content_type, extension = builders[file_format]
        file_name = f"{run.report.code}-{run.id}.{extension}"
        export = ReportExport.objects.create(run=run, requested_by=services.actor(request), format=file_format, file_name=file_name, content_type=content_type)
        record_audit(company=run.company, actor_user=services.actor(request), module_code="RPT", action_code=file_format, entity=export, after={"run": str(run.id), "file_name": file_name}, request=request)
        response = HttpResponse(builder(run), content_type=content_type)
        response["Content-Disposition"] = f'inline; filename="{file_name}"' if file_format == "PRINT" else f'attachment; filename="{file_name}"'
        return response


class ReportExportViewSet(ReadOnlyModelViewSet):
    permission_classes = (ReportingPermission,)
    serializer_class = ReportExportSerializer
    queryset = ReportExport.objects.select_related("run__company", "run__report", "requested_by")
    iam_permissions = {"GET": "RPT.CENTER.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(run__company_id=company) if company else self.queryset.none()
