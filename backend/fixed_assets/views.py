from django.http import Http404
from rest_framework import serializers as drf_serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from audit_log.models import AuditLog
from . import models, serializers, services
from .permissions import FixedAssetPermission


def permissions(resource):
    return {"GET": f"{resource}.VIEW", "POST": f"{resource}.CREATE", "PUT": f"{resource}.EDIT", "PATCH": f"{resource}.EDIT", "DELETE": f"{resource}.DELETE"}


class CompanyViewSet(ModelViewSet):
    permission_classes = (FixedAssetPermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    ordering = ("-created_at",)

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return super().get_queryset().filter(company_id=company) if company else super().get_queryset().none()

    def perform_create(self, serializer):
        fields = {field.name for field in serializer.Meta.model._meta.fields}
        obj = serializer.save(created_by=services.actor(self.request)) if "created_by" in fields else serializer.save()
        services.audit(self.request, obj, "CREATE", after=serializer.data)

    def perform_update(self, serializer):
        before = self.get_serializer(serializer.instance).data
        obj = serializer.save()
        services.audit(self.request, obj, "EDIT", before=before, after=serializer.data)


class CategoryViewSet(CompanyViewSet):
    queryset = models.AssetCategory.objects.select_related("company", "parent", "asset_account", "accumulated_account", "expense_account")
    serializer_class = serializers.CategorySerializer
    iam_permissions = permissions("FA.CATEGORY")
    search_fields = ("code", "name")
    ordering_fields = ("code", "name", "created_at")

    def perform_destroy(self, instance):
        if instance.assets.exists():
            raise drf_serializers.ValidationError("Nhóm đã được sử dụng không được xóa vật lý.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()


class AssetViewSet(CompanyViewSet):
    queryset = models.AssetRecord.objects.select_related(
        "company", "category", "branch", "department", "custodian",
        "asset_account", "accumulated_account", "created_by", "updated_by",
    )
    serializer_class = serializers.AssetSerializer
    iam_permissions = permissions("FA.ASSET")
    action_permissions = {
        "history": "FA.ASSET.VIEW",
        "register": "FA.ASSET.VIEW",
        "reports": "FA.ASSET.VIEW",
        "report_catalog": "FA.ASSET.VIEW",
        "tool_source_vouchers": "FA.ASSET.VIEW",
        "tool_register": "FA.ASSET.VIEW",
        "acquire": "FA.ASSET.CREATE",
        "acquire_tool": "FA.ASSET.CREATE",
        "acquire_tools_batch": "FA.ASSET.CREATE",
        "prepaid_expenses": "FA.ASSET.CREATE",
        "import_prepaid_excel": "FA.ASSET.CREATE",
        "default_allocation_period": "FA.CALCULATION.CALCULATE",
        "setup_allocation_period": "FA.CALCULATION.CALCULATE",
        "validate_allocation_voucher": "FA.CALCULATION.CALCULATE",
        "calculate_allocation_uc12": "FA.CALCULATION.CALCULATE",
        "save_allocation_voucher_uc12": "FA.CALCULATION.POST",
        "unpost_allocation_voucher_uc12": "FA.CALCULATION.POST",
        "export_allocation_excel_uc12": "FA.CALCULATION.CALCULATE",
        "allocation_reference_vouchers_uc12": "FA.CALCULATION.CALCULATE",
        "next_tool_transfer_number": "FA.TRANSACTION.TRANSFER",
        "transferable_tools": "FA.TRANSACTION.TRANSFER",
        "transfer_tools": "FA.TRANSACTION.TRANSFER",
        "cancel_tool_transfer": "FA.TRANSACTION.TRANSFER",
        "next_tool_decrease_number": "FA.TRANSACTION.DISPOSE",
        "disposable_tools": "FA.TRANSACTION.DISPOSE",
        "decrease_tools": "FA.TRANSACTION.DISPOSE",
        "cancel_tool_decrease": "FA.TRANSACTION.DISPOSE",
        "next_prepaid_decrease_number": "FA.TRANSACTION.DISPOSE",
        "disposable_prepaid_expenses": "FA.TRANSACTION.DISPOSE",
        "decrease_prepaid_expenses": "FA.TRANSACTION.DISPOSE",
        "cancel_prepaid_decrease": "FA.TRANSACTION.DISPOSE",
        "decrease_reference_vouchers": "FA.TRANSACTION.DISPOSE",
        "validate_tool_stocktake_date": "FA.COUNT.CREATE",
        "next_tool_stocktake_number": "FA.COUNT.CREATE",
        "tool_stocktake_items": "FA.COUNT.CREATE",
        "save_tool_stocktake": "FA.COUNT.CREATE",
        "resolve_tool_stocktake": "FA.COUNT.EDIT",
        "cancel_tool_stocktake": "FA.COUNT.EDIT",
        "export_tool_stocktake_excel": "FA.COUNT.VIEW",
        "tool_register_uc16": "FA.ASSET.VIEW",
        "export_tool_register": "FA.ASSET.VIEW",
        "tool_detail_trace": "FA.ASSET.VIEW",
        "tool_report_catalog": "FA.ASSET.VIEW",
        "tool_reports": "FA.ASSET.VIEW",
        "tool_report_preferences": "FA.ASSET.VIEW",
        "reconcile": "FA.ASSET.EDIT",
        "update_info": "FA.ASSET.EDIT",
        "transfer": "FA.TRANSACTION.TRANSFER",
        "revaluate": "FA.TRANSACTION.REVALUATE",
        "dispose": "FA.TRANSACTION.DISPOSE",
    }
    search_fields = ("code", "name", "serial_number", "source_reference", "acquisition_voucher_no")
    ordering_fields = ("code", "acquisition_date", "original_cost", "created_at")

    def get_object(self):
        try:
            return super().get_object()
        except Http404 as exc:
            raise NotFound("Không tìm thấy thông tin tài sản cố định.") from exc

    def get_queryset(self):
        queryset = super().get_queryset()
        for field, parameter in (
            ("asset_type", "asset_type"),
            ("status", "status"),
            ("accounting_reconciliation_status", "accounting_reconciliation_status"),
            ("category_id", "category_id"),
            ("branch_id", "branch_id"),
            ("department_id", "department_id"),
        ):
            if value := self.request.query_params.get(parameter):
                queryset = queryset.filter(**{field: value})
        if dept_name := self.request.query_params.get("department_name"):
            if dept_name != "all":
                queryset = queryset.filter(department__name__iexact=dept_name)
        return queryset

    def perform_destroy(self, instance):
        if instance.transactions.exists():
            raise drf_serializers.ValidationError("Tài sản đã phát sinh giao dịch không được xóa vật lý.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=False, methods=("post",), url_path="acquire")
    def acquire(self, request):
        asset, acq_tx = services.acquire_fixed_asset(request, request.data)
        return Response(
            {
                "asset": self.get_serializer(asset).data,
                "transaction": serializers.TransactionSerializer(acq_tx).data,
                "message": "Ghi tăng tài sản cố định thành công.",
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=("post", "patch", "put"), url_path="update-info")
    def update_info(self, request, pk=None):
        asset, changes, message = services.update_fixed_asset_info(request, pk, request.data)
        return Response(
            {
                "asset": self.get_serializer(asset).data,
                "changes": changes,
                "no_changes": not bool(changes),
                "message": message,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=("post",), url_path="reconcile")
    def reconcile(self, request, pk=None):
        asset = services.reconcile_asset_accounting(self.get_object(), request)
        return Response(self.get_serializer(asset).data)

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        asset = self.get_object()
        transactions = asset.transactions.select_related("created_by", "target_category", "target_branch", "target_department", "target_custodian")
        logs = AuditLog.objects.filter(
            company=asset.company, entity_id=asset.id
        ).select_related("actor_user").prefetch_related("changes").order_by("-occurred_at")[:50]
        audit_logs = [
            {
                "id": str(log.id),
                "action_code": log.action_code,
                "resource_code": log.resource_code or asset.code,
                "actor": log.actor_name_snapshot or (log.actor_user.username if log.actor_user else ""),
                "reason": log.reason,
                "occurred_at": log.occurred_at.isoformat() if log.occurred_at else "",
                "changes": [
                    {
                        "field_name": ch.field_name,
                        "old_value": ch.old_value_json,
                        "new_value": ch.new_value_json,
                    }
                    for ch in log.changes.all()
                ],
            }
            for log in logs
        ]
        return Response({
            "asset": self.get_serializer(asset).data,
            "transactions": serializers.TransactionSerializer(transactions, many=True).data,
            "audit_logs": audit_logs,
        })

    @action(detail=False, methods=("post",), url_path="transfer")
    def transfer(self, request):
        result = services.transfer_fixed_assets_uc05(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="revaluate")
    def revaluate(self, request):
        result = services.revaluate_fixed_assets_uc06(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="dispose")
    def dispose(self, request):
        result = services.dispose_fixed_assets_uc07(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("get", "post"), url_path="register")
    def register(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.get_fixed_asset_register_uc09(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="reports")
    def reports(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.generate_fixed_asset_report_uc09(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="report-catalog")
    def report_catalog(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.get_fixed_asset_report_catalog_uc09(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="tool-source-vouchers")
    def tool_source_vouchers(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.get_tool_source_vouchers_uc10(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="acquire-tool")
    def acquire_tool(self, request):
        result = services.acquire_tool_uc10(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="acquire-tools-batch")
    def acquire_tools_batch(self, request):
        result = services.acquire_tools_batch_uc10(request, request.data)
        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("get", "post"), url_path="prepaid-expenses")
    def prepaid_expenses(self, request):
        if request.method == "GET":
            result = services.get_tool_and_prepaid_register_uc10(request, {})
            return Response(result, status=status.HTTP_200_OK)
        result = services.create_prepaid_expense_uc10(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="prepaid-expenses/import-excel")
    def import_prepaid_excel(self, request):
        result = services.import_prepaid_expenses_excel_uc10(request, request.data)
        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("get", "post"), url_path="tool-register")
    def tool_register(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.get_tool_and_prepaid_register_uc10(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="default-allocation-period")
    def default_allocation_period(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.get_default_allocation_period_uc11(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="setup-allocation-period")
    def setup_allocation_period(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.setup_allocation_period_uc11(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="validate-allocation-voucher")
    def validate_allocation_voucher(self, request):
        result = services.validate_allocation_voucher_before_save_uc11(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="calculate-allocation")
    def calculate_allocation_uc12(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.calculate_allocation_voucher_uc12(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="save-allocation-voucher")
    def save_allocation_voucher_uc12(self, request):
        result = services.save_and_post_allocation_voucher_uc12(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="unpost-allocation-voucher")
    def unpost_allocation_voucher_uc12(self, request):
        result = services.unpost_or_adjust_allocation_voucher_uc12(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="export-allocation-excel")
    def export_allocation_excel_uc12(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.export_prepaid_allocation_excel_uc12(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="allocation-reference-vouchers")
    def allocation_reference_vouchers_uc12(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_allocation_reference_vouchers_uc12(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="next-tool-transfer-number")
    def next_tool_transfer_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        prefix = request.query_params.get("prefix") or "ĐCCC"
        voucher_no = services.get_next_tool_transfer_voucher_no_uc13(company, prefix=prefix)
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("get", "post"), url_path="transferable-tools")
    def transferable_tools(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_transferable_tools_uc13(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="transfer-tools")
    def transfer_tools(self, request):
        result = services.transfer_tools_uc13(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="cancel-tool-transfer")
    def cancel_tool_transfer(self, request):
        result = services.cancel_or_adjust_tool_transfer_uc13(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="next-tool-decrease-number")
    def next_tool_decrease_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        prefix = request.query_params.get("prefix") or "GGCC"
        voucher_no = services.get_next_tool_decrease_voucher_no_uc14(company, prefix=prefix)
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("get", "post"), url_path="disposable-tools")
    def disposable_tools(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_disposable_tools_uc14(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="decrease-tools")
    def decrease_tools(self, request):
        result = services.decrease_tools_uc14(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="cancel-tool-decrease")
    def cancel_tool_decrease(self, request):
        result = services.cancel_or_adjust_decrease_voucher_uc14(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="next-prepaid-decrease-number")
    def next_prepaid_decrease_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        prefix = request.query_params.get("prefix") or "GGCP"
        voucher_no = services.get_next_prepaid_decrease_voucher_no_uc14(company, prefix=prefix)
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("get", "post"), url_path="disposable-prepaid-expenses")
    def disposable_prepaid_expenses(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_disposable_prepaid_expenses_uc14(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="decrease-prepaid-expenses")
    def decrease_prepaid_expenses(self, request):
        result = services.decrease_prepaid_expenses_uc14(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="cancel-prepaid-decrease")
    def cancel_prepaid_decrease(self, request):
        result = services.cancel_or_adjust_decrease_voucher_uc14(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="decrease-reference-vouchers")
    def decrease_reference_vouchers(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_decrease_reference_vouchers_uc14(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="validate-tool-stocktake-date")
    def validate_tool_stocktake_date(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.validate_tool_stocktake_date_uc15(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="next-tool-stocktake-number")
    def next_tool_stocktake_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        prefix = request.query_params.get("prefix") or "BBKK"
        voucher_no = services.get_next_tool_stocktake_voucher_no_uc15(company, prefix=prefix)
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("get", "post"), url_path="tool-stocktake-items")
    def tool_stocktake_items(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_in_use_tools_for_stocktake_uc15(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="save-tool-stocktake")
    def save_tool_stocktake(self, request):
        result = services.save_tool_stocktake_uc15(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="resolve-tool-stocktake")
    def resolve_tool_stocktake(self, request):
        result = services.resolve_tool_stocktake_discrepancy_uc15(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="cancel-tool-stocktake")
    def cancel_tool_stocktake(self, request):
        result = services.cancel_or_update_tool_stocktake_uc15(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="export-tool-stocktake-excel")
    def export_tool_stocktake_excel(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.export_tool_stocktake_excel_uc15(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="tool-register-uc16")
    def tool_register_uc16(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_tool_register_uc16(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="export-tool-register")
    def export_tool_register(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        merged = dict(payload)
        if not merged.get("export_format"):
            merged["export_format"] = "EXCEL"
        result = services.get_tool_register_uc16(request, merged)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="tool-detail-trace")
    def tool_detail_trace(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_tool_detail_and_trace_uc16(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="tool-report-catalog")
    def tool_report_catalog(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_tool_report_catalog_uc16(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="tool-report-preferences")
    def tool_report_preferences(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_tool_report_catalog_uc16(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="tool-reports")
    def tool_reports(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.generate_tool_report_uc16(request, payload)
        return Response(result, status=status.HTTP_200_OK)



class TransactionViewSet(CompanyViewSet):
    queryset = models.AssetTransaction.objects.select_related(
        "company", "asset", "asset__department", "created_by",
        "target_category", "target_branch", "target_department", "target_custodian",
    )
    serializer_class = serializers.TransactionSerializer
    iam_permissions = permissions("FA.TRANSACTION")
    action_permissions = {
        "submit": "FA.TRANSACTION.SUBMIT", "approve": "FA.TRANSACTION.APPROVE",
        "reject": "FA.TRANSACTION.APPROVE", "post": "FA.TRANSACTION.POST",
        "reverse": "FA.TRANSACTION.REVERSE", "cancel": "FA.TRANSACTION.CANCEL",
        "post_gl": "FA.GL.POST", "gl_error": "FA.GL.POST",
        "transfer": "FA.TRANSACTION.TRANSFER",
        "next_transfer_number": "FA.TRANSACTION.TRANSFER",
        "revaluate": "FA.TRANSACTION.REVALUATE",
        "next_revaluation_number": "FA.TRANSACTION.REVALUATE",
        "dispose": "FA.TRANSACTION.DISPOSE",
        "next_disposal_number": "FA.TRANSACTION.DISPOSE",
        "default_allocation_period": "FA.CALCULATION.CALCULATE",
        "setup_allocation_period": "FA.CALCULATION.CALCULATE",
        "validate_allocation_voucher": "FA.CALCULATION.CALCULATE",
        "calculate_allocation_uc12": "FA.CALCULATION.CALCULATE",
        "save_allocation_voucher_uc12": "FA.CALCULATION.POST",
        "unpost_allocation_voucher_uc12": "FA.CALCULATION.POST",
        "export_allocation_excel_uc12": "FA.CALCULATION.CALCULATE",
        "allocation_reference_vouchers_uc12": "FA.CALCULATION.CALCULATE",
        "next_tool_transfer_number": "FA.TRANSACTION.TRANSFER",
        "transferable_tools": "FA.TRANSACTION.TRANSFER",
        "transfer_tools": "FA.TRANSACTION.TRANSFER",
        "cancel_tool_transfer": "FA.TRANSACTION.TRANSFER",
        "next_tool_decrease_number": "FA.TRANSACTION.DISPOSE",
        "disposable_tools": "FA.TRANSACTION.DISPOSE",
        "decrease_tools": "FA.TRANSACTION.DISPOSE",
        "cancel_tool_decrease": "FA.TRANSACTION.DISPOSE",
        "next_prepaid_decrease_number": "FA.TRANSACTION.DISPOSE",
        "disposable_prepaid_expenses": "FA.TRANSACTION.DISPOSE",
        "decrease_prepaid_expenses": "FA.TRANSACTION.DISPOSE",
        "cancel_prepaid_decrease": "FA.TRANSACTION.DISPOSE",
        "decrease_reference_vouchers": "FA.TRANSACTION.DISPOSE",
    }
    search_fields = ("number", "asset__code", "asset__name", "source_reference", "reason")
    ordering_fields = ("transaction_date", "amount", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in ("transaction_type", "status", "asset_id", "period_code"):
            if value := self.request.query_params.get(field):
                queryset = queryset.filter(**{field: value})
        return queryset

    @action(detail=False, methods=("get",), url_path="next-transfer-number")
    def next_transfer_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        if str(request.query_params.get("numbering_rule_configured", "true")).lower() in ("false", "0"):
            raise drf_serializers.ValidationError({
                "voucher_no": "Chưa thiết lập quy tắc đánh số biên bản điều chuyển. Vui lòng kiểm tra cấu hình chứng từ.",
                "detail": "Chưa thiết lập quy tắc đánh số biên bản điều chuyển. Vui lòng kiểm tra cấu hình chứng từ.",
            })
        company = Company.objects.get(pk=company_id)
        year_based = str(request.query_params.get("year_based", "false")).lower() in ("true", "1")
        prefix = request.query_params.get("prefix") or "ĐCTS"
        tx_date = request.query_params.get("transaction_date")
        voucher_no = services.get_next_transfer_voucher_no(
            company, transfer_date=tx_date, year_based=year_based, prefix=prefix
        )
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("post",), url_path="transfer")
    def transfer(self, request):
        result = services.transfer_fixed_assets_uc05(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("get",), url_path="next-revaluation-number")
    def next_revaluation_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        year_based = str(request.query_params.get("year_based", "false")).lower() in ("true", "1")
        prefix = request.query_params.get("prefix") or "ĐGL"
        tx_date = request.query_params.get("posting_date") or request.query_params.get("transaction_date")
        voucher_no = services.get_next_revaluation_voucher_no(
            company, reval_date=tx_date, year_based=year_based, prefix=prefix
        )
        report_no = services.get_next_revaluation_report_no(company)
        return Response({"voucher_no": voucher_no, "number": voucher_no, "report_no": report_no})

    @action(detail=False, methods=("post",), url_path="revaluate")
    def revaluate(self, request):
        result = services.revaluate_fixed_assets_uc06(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("get",), url_path="next-disposal-number")
    def next_disposal_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        year_based = str(request.query_params.get("year_based", "false")).lower() in ("true", "1")
        prefix = request.query_params.get("prefix") or "GGTS"
        tx_date = request.query_params.get("posting_date") or request.query_params.get("transaction_date")
        voucher_no = services.get_next_disposal_voucher_no(
            company, disposal_date=tx_date, year_based=year_based, prefix=prefix
        )
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("post",), url_path="dispose")
    def dispose(self, request):
        result = services.dispose_fixed_assets_uc07(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("get", "post"), url_path="register")
    def register(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.get_fixed_asset_register_uc09(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="reports")
    def reports(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.generate_fixed_asset_report_uc09(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="report-catalog")
    def report_catalog(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.get_fixed_asset_report_catalog_uc09(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="tool-source-vouchers")
    def tool_source_vouchers(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.get_tool_source_vouchers_uc10(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="acquire-tool")
    def acquire_tool(self, request):
        result = services.acquire_tool_uc10(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="acquire-tools-batch")
    def acquire_tools_batch(self, request):
        result = services.acquire_tools_batch_uc10(request, request.data)
        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("get", "post"), url_path="prepaid-expenses")
    def prepaid_expenses(self, request):
        if request.method == "GET":
            result = services.get_tool_and_prepaid_register_uc10(request, {})
            return Response(result, status=status.HTTP_200_OK)
        result = services.create_prepaid_expense_uc10(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="prepaid-expenses/import-excel")
    def import_prepaid_excel(self, request):
        result = services.import_prepaid_expenses_excel_uc10(request, request.data)
        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("get", "post"), url_path="tool-register")
    def tool_register(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.get_tool_and_prepaid_register_uc10(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="default-allocation-period")
    def default_allocation_period(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.get_default_allocation_period_uc11(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="setup-allocation-period")
    def setup_allocation_period(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.setup_allocation_period_uc11(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="validate-allocation-voucher")
    def validate_allocation_voucher(self, request):
        result = services.validate_allocation_voucher_before_save_uc11(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="calculate-allocation")
    def calculate_allocation_uc12(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.calculate_allocation_voucher_uc12(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="save-allocation-voucher")
    def save_allocation_voucher_uc12(self, request):
        result = services.save_and_post_allocation_voucher_uc12(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="unpost-allocation-voucher")
    def unpost_allocation_voucher_uc12(self, request):
        result = services.unpost_or_adjust_allocation_voucher_uc12(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="export-allocation-excel")
    def export_allocation_excel_uc12(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.export_prepaid_allocation_excel_uc12(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="allocation-reference-vouchers")
    def allocation_reference_vouchers_uc12(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_allocation_reference_vouchers_uc12(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="next-tool-transfer-number")
    def next_tool_transfer_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        prefix = request.query_params.get("prefix") or "ĐCCC"
        voucher_no = services.get_next_tool_transfer_voucher_no_uc13(company, prefix=prefix)
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("get", "post"), url_path="transferable-tools")
    def transferable_tools(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_transferable_tools_uc13(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="transfer-tools")
    def transfer_tools(self, request):
        result = services.transfer_tools_uc13(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="cancel-tool-transfer")
    def cancel_tool_transfer(self, request):
        result = services.cancel_or_adjust_tool_transfer_uc13(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="next-tool-decrease-number")
    def next_tool_decrease_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        prefix = request.query_params.get("prefix") or "GGCC"
        voucher_no = services.get_next_tool_decrease_voucher_no_uc14(company, prefix=prefix)
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("get", "post"), url_path="disposable-tools")
    def disposable_tools(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_disposable_tools_uc14(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="decrease-tools")
    def decrease_tools(self, request):
        result = services.decrease_tools_uc14(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="cancel-tool-decrease")
    def cancel_tool_decrease(self, request):
        result = services.cancel_or_adjust_decrease_voucher_uc14(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="next-prepaid-decrease-number")
    def next_prepaid_decrease_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        prefix = request.query_params.get("prefix") or "GGCP"
        voucher_no = services.get_next_prepaid_decrease_voucher_no_uc14(company, prefix=prefix)
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("get", "post"), url_path="disposable-prepaid-expenses")
    def disposable_prepaid_expenses(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_disposable_prepaid_expenses_uc14(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="decrease-prepaid-expenses")
    def decrease_prepaid_expenses(self, request):
        result = services.decrease_prepaid_expenses_uc14(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="cancel-prepaid-decrease")
    def cancel_prepaid_decrease(self, request):
        result = services.cancel_or_adjust_decrease_voucher_uc14(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="decrease-reference-vouchers")
    def decrease_reference_vouchers(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_decrease_reference_vouchers_uc14(request, payload)
        return Response(result, status=status.HTTP_200_OK)


    def perform_destroy(self, instance):
        if instance.status not in {"DRAFT", "REJECTED"}:
            raise drf_serializers.ValidationError("Chỉ giao dịch nháp hoặc bị từ chối mới được xóa.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        return Response(self.get_serializer(services.submit(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return Response(self.get_serializer(services.decide(self.get_object(), request, True)).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return Response(self.get_serializer(services.decide(self.get_object(), request, False)).data)

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        return Response(self.get_serializer(services.post_transaction(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def reverse(self, request, pk=None):
        reversal = services.reverse(self.get_object(), request)
        return Response(self.get_serializer(reversal).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        obj = self.get_object()
        if obj.status not in {"DRAFT", "REJECTED"}:
            raise drf_serializers.ValidationError("Chỉ giao dịch nháp hoặc bị từ chối mới được hủy.")
        old = obj.status
        obj.status = "CANCELLED"
        obj.save(update_fields=("status", "updated_at"))
        services.audit(request, obj, "CANCEL", {"status": old}, {"status": obj.status}, request.data.get("reason", ""))
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=("post",), url_path="post-gl")
    def post_gl(self, request, pk=None):
        return Response(self.get_serializer(services.post_gl(self.get_object(), request)).data)

    @action(detail=True, methods=("post",), url_path="gl-error")
    def gl_error(self, request, pk=None):
        obj = self.get_object()
        if obj.status != "POSTED" or obj.gl_status in {"POSTED", "NOT_REQUIRED"}:
            raise drf_serializers.ValidationError("Trạng thái giao dịch không hợp lệ.")
        obj.gl_status = "ERROR"
        obj.save(update_fields=("gl_status", "updated_at"))
        services.audit(request, obj, "GL_ERROR", after={"error": request.data.get("error", "")})
        return Response(self.get_serializer(obj).data)


class CalculationRunViewSet(CompanyViewSet):
    queryset = models.CalculationRun.objects.select_related("company", "created_by", "posted_by").prefetch_related("lines__asset", "lines__transaction")
    serializer_class = serializers.CalculationRunSerializer
    iam_permissions = permissions("FA.CALCULATION")
    action_permissions = {
        "calculate": "FA.CALCULATION.CALCULATE",
        "post": "FA.CALCULATION.POST",
        "unpost": "FA.CALCULATION.POST",
        "cancel": "FA.CALCULATION.EDIT",
        "preview": "FA.CALCULATION.VIEW",
        "save_voucher": "FA.CALCULATION.CREATE",
        "export_allocation": "FA.CALCULATION.VIEW",
        "default_allocation_period": "FA.CALCULATION.CALCULATE",
        "setup_allocation_period": "FA.CALCULATION.CALCULATE",
        "validate_allocation_voucher": "FA.CALCULATION.CALCULATE",
        "calculate_allocation_uc12": "FA.CALCULATION.CALCULATE",
        "save_allocation_voucher_uc12": "FA.CALCULATION.POST",
        "unpost_allocation_voucher_uc12": "FA.CALCULATION.POST",
        "export_allocation_excel_uc12": "FA.CALCULATION.CALCULATE",
        "allocation_reference_vouchers_uc12": "FA.CALCULATION.CALCULATE",
        "next_tool_transfer_number": "FA.TRANSACTION.TRANSFER",
        "transferable_tools": "FA.TRANSACTION.TRANSFER",
        "transfer_tools": "FA.TRANSACTION.TRANSFER",
        "cancel_tool_transfer": "FA.TRANSACTION.TRANSFER",
        "next_tool_decrease_number": "FA.TRANSACTION.DISPOSE",
        "disposable_tools": "FA.TRANSACTION.DISPOSE",
        "decrease_tools": "FA.TRANSACTION.DISPOSE",
        "cancel_tool_decrease": "FA.TRANSACTION.DISPOSE",
        "next_prepaid_decrease_number": "FA.TRANSACTION.DISPOSE",
        "disposable_prepaid_expenses": "FA.TRANSACTION.DISPOSE",
        "decrease_prepaid_expenses": "FA.TRANSACTION.DISPOSE",
        "cancel_prepaid_decrease": "FA.TRANSACTION.DISPOSE",
        "decrease_reference_vouchers": "FA.TRANSACTION.DISPOSE",
    }
    search_fields = ("number", "period_code", "description", "reference")
    ordering_fields = ("period_start", "period_end", "total_amount", "created_at")

    def get_object(self):
        try:
            return super().get_object()
        except Http404 as exc:
            raise NotFound("Không tìm thấy chứng từ khấu hao.") from exc

    def perform_update(self, serializer):
        if serializer.instance.status == "POSTED":
            raise drf_serializers.ValidationError("Chứng từ khấu hao đã được ghi sổ, không thể chỉnh sửa trực tiếp.")
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.status == "POSTED":
            raise drf_serializers.ValidationError("Vui lòng bỏ ghi sổ chứng từ trước khi xóa.")
        if instance.status not in ("DRAFT", "CALCULATED", "CANCELLED"):
            raise drf_serializers.ValidationError("Chỉ bảng tính nháp hoặc chưa ghi sổ mới được xóa.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=False, methods=("get", "post"), url_path="preview")
    def preview(self, request):
        return Response(services.preview_depreciation_period(request))

    @action(detail=False, methods=("post",), url_path="save-voucher")
    def save_voucher(self, request):
        run, message = services.save_and_post_depreciation_voucher(request, request.data)
        serialized = self.get_serializer(run).data
        return Response(
            {
                **serialized,
                "message": message,
                "posted": run.status == "POSTED",
                "warnings": [],
                "run": serialized,
            },
            status=201,
        )

    @action(detail=True, methods=("post",))
    def calculate(self, request, pk=None):
        return Response(self.get_serializer(services.calculate(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        obj = self.get_object()
        if obj.period_month or obj.period_year or obj.allocations_snapshot or obj.accounting_entries or request.data:
            run = services.post_depreciation_run_uc03(obj, request, from_save=False)
            return Response(
                {
                    **self.get_serializer(run).data,
                    "message": "Ghi sổ chứng từ khấu hao thành công.",
                    "posted": run.status == "POSTED",
                }
            )
        return Response(self.get_serializer(services.post_run(obj, request)).data)

    @action(detail=True, methods=("post",), url_path="unpost")
    def unpost(self, request, pk=None):
        run = services.unpost_depreciation_run(self.get_object(), request)
        return Response(
            {
                **self.get_serializer(run).data,
                "message": f"Đã bỏ ghi sổ chứng từ tính khấu hao {run.number}.",
            }
        )

    @action(detail=True, methods=("post",), url_path="cancel")
    def cancel(self, request, pk=None):
        run = services.cancel_depreciation_run(self.get_object(), request)
        return Response(
            {
                **self.get_serializer(run).data,
                "message": f"Đã hủy chứng từ tính khấu hao {run.number}.",
            }
        )

    @action(detail=True, methods=("get",), url_path="export-allocation")
    def export_allocation(self, request, pk=None):
        run = self.get_object()
        return Response(
            {
                "voucher_no": run.number,
                "period_code": run.period_code,
                "month": run.period_month,
                "year": run.period_year,
                "description": run.description,
                "total_amount": str(run.total_amount),
                "total_deductible_amount": str(run.total_deductible_amount),
                "total_non_deductible_amount": str(run.total_non_deductible_amount),
                "allocations": run.allocations_snapshot or [],
                "accounting_entries": run.accounting_entries or [],
            }
        )

    @action(detail=False, methods=("get", "post"), url_path="default-allocation-period")
    def default_allocation_period(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
        result = services.get_default_allocation_period_uc11(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="setup-allocation-period")
    def setup_allocation_period(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.setup_allocation_period_uc11(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="validate-allocation-voucher")
    def validate_allocation_voucher(self, request):
        result = services.validate_allocation_voucher_before_save_uc11(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="calculate-allocation")
    def calculate_allocation_uc12(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.calculate_allocation_voucher_uc12(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="save-allocation-voucher")
    def save_allocation_voucher_uc12(self, request):
        result = services.save_and_post_allocation_voucher_uc12(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="unpost-allocation-voucher")
    def unpost_allocation_voucher_uc12(self, request):
        result = services.unpost_or_adjust_allocation_voucher_uc12(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="export-allocation-excel")
    def export_allocation_excel_uc12(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.export_prepaid_allocation_excel_uc12(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="allocation-reference-vouchers")
    def allocation_reference_vouchers_uc12(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_allocation_reference_vouchers_uc12(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="next-tool-transfer-number")
    def next_tool_transfer_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        prefix = request.query_params.get("prefix") or "ĐCCC"
        voucher_no = services.get_next_tool_transfer_voucher_no_uc13(company, prefix=prefix)
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("get", "post"), url_path="transferable-tools")
    def transferable_tools(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_transferable_tools_uc13(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="transfer-tools")
    def transfer_tools(self, request):
        result = services.transfer_tools_uc13(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="cancel-tool-transfer")
    def cancel_tool_transfer(self, request):
        result = services.cancel_or_adjust_tool_transfer_uc13(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="next-tool-decrease-number")
    def next_tool_decrease_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        prefix = request.query_params.get("prefix") or "GGCC"
        voucher_no = services.get_next_tool_decrease_voucher_no_uc14(company, prefix=prefix)
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("get", "post"), url_path="disposable-tools")
    def disposable_tools(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_disposable_tools_uc14(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="decrease-tools")
    def decrease_tools(self, request):
        result = services.decrease_tools_uc14(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="cancel-tool-decrease")
    def cancel_tool_decrease(self, request):
        result = services.cancel_or_adjust_decrease_voucher_uc14(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="next-prepaid-decrease-number")
    def next_prepaid_decrease_number(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Thiếu company_id."})
        company = Company.objects.get(pk=company_id)
        prefix = request.query_params.get("prefix") or "GGCP"
        voucher_no = services.get_next_prepaid_decrease_voucher_no_uc14(company, prefix=prefix)
        return Response({"voucher_no": voucher_no, "number": voucher_no})

    @action(detail=False, methods=("get", "post"), url_path="disposable-prepaid-expenses")
    def disposable_prepaid_expenses(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_disposable_prepaid_expenses_uc14(request, payload)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="decrease-prepaid-expenses")
    def decrease_prepaid_expenses(self, request):
        result = services.decrease_prepaid_expenses_uc14(request, request.data)
        http_status = status.HTTP_200_OK if result.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(result, status=http_status)

    @action(detail=False, methods=("post",), url_path="cancel-prepaid-decrease")
    def cancel_prepaid_decrease(self, request):
        result = services.cancel_or_adjust_decrease_voucher_uc14(request, request.data)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="decrease-reference-vouchers")
    def decrease_reference_vouchers(self, request):
        payload = request.data if request.method == "POST" and isinstance(request.data, dict) else dict(request.query_params.items())
        result = services.get_decrease_reference_vouchers_uc14(request, payload)
        return Response(result, status=status.HTTP_200_OK)


class PeriodViewSet(ModelViewSet):
    permission_classes = (FixedAssetPermission,)
    serializer_class = serializers.PeriodSerializer
    queryset = models.AssetPeriod.objects.select_related("company")
    iam_permissions = permissions("FA.PERIOD")

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class ApprovalViewSet(ReadOnlyModelViewSet):
    permission_classes = (FixedAssetPermission,)
    serializer_class = serializers.ApprovalSerializer
    queryset = models.ApprovalDecision.objects.select_related("company", "transaction", "actor")
    iam_permissions = {"GET": "FA.APPROVAL.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()

