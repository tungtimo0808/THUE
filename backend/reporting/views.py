from decimal import Decimal
from django.core.exceptions import PermissionDenied, ValidationError
from django.db.models import Sum
from django.http import HttpResponse
from rest_framework import serializers as drf_serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet, ViewSet

from audit_log.services import record_audit
from general_ledger.models import JournalEntry
from iam.permissions import assignment_permission_codes, effective_assignments, has_effective_permission
from organization.models import Company

from . import (
    asset_report_services,
    business_result_services,
    cash_flow_services,
    dashboard_services,
    debt_report_services,
    exporters,
    financial_bundle_services,
    financial_notes_services,
    financial_position_services,
    inventory_report_services,
    money_report_services,
    purchase_report_services,
    sales_report_services,
    services,
    tax_report_services,
    unified_export_services,
    drilldown_services,
)
from .models import (
    DashboardConfiguration,
    FinancialStatementBundle,
    ReportCalculationContribution,
    ReportCellContext,
    ReportDefinition,
    ReportDrilldownDefinition,
    ReportExport,
    ReportExportArtifact,
    ReportExportJob,
    ReportExportTemplate,
    ReportLineMapping,
    ReportRun,
    ReportSourceReference,
)
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


class FinancialStatementTT99ViewSet(ViewSet):
    """
    API tổng hợp trực tiếp Bộ Báo cáo tài chính theo Thông tư 99/2025/TT-BTC từ Sổ Cái (JournalEntry / JournalLine):
    - B01-DN: Báo cáo tình hình tài chính
    - B02-DN: Báo cáo kết quả hoạt động kinh doanh
    - B03-DN: Báo cáo lưu chuyển tiền tệ (Trực tiếp & Gián tiếp)
    - B09-DN: Bản thuyết minh báo cáo tài chính
    """
    permission_classes = ()

    def _resolve_company(self, request):
        company_id = (
            request.query_params.get("company_id")
            or request.data.get("company_id")
            or request.data.get("company")
        )
        if company_id:
            comp = Company.objects.filter(pk=company_id).first()
            if comp:
                return comp
        return Company.objects.first()

    def list(self, request):
        from django.db.models import Sum
        from general_ledger.models import JournalLine

        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Dữ liệu đầu kỳ (OPENING) và cuối kỳ (POSTED)
        open_qs = JournalLine.objects.filter(
            entry__company=company,
            entry__status="POSTED",
            entry__entry_type="OPENING",
        ).values("account__code").annotate(debit=Sum("debit"), credit=Sum("credit"))

        all_qs = JournalLine.objects.filter(
            entry__company=company,
            entry__status="POSTED",
        ).values("account__code").annotate(debit=Sum("debit"), credit=Sum("credit"))

        open_map = {r["account__code"]: (int(r["debit"] or 0), int(r["credit"] or 0)) for r in open_qs}
        close_map = {r["account__code"]: (int(r["debit"] or 0), int(r["credit"] or 0)) for r in all_qs}

        def sum_prefix(m, *prefixes, mode="net_debit"):
            total = 0
            for code, (d, c) in m.items():
                if any(code.startswith(p) for p in prefixes):
                    if mode == "net_debit":
                        total += (d - c)
                    elif mode == "net_credit":
                        total += (c - d)
                    elif mode == "debit":
                        total += d
                    elif mode == "credit":
                        total += c
            return total

        def build_b01_side(m, is_opening=False):
            # I. Tiền (110)
            c_111_only = sum_prefix(m, "111", mode="net_debit")
            c_112_only = sum_prefix(m, "112", mode="net_debit")
            c_113_only = sum_prefix(m, "113", mode="net_debit")
            v_111 = c_111_only + c_112_only + c_113_only
            v_112 = sum_prefix(m, "1281", mode="net_debit")
            v_110 = v_111 + v_112

            # II. Đầu tư tài chính ngắn hạn (120)
            v_121 = sum_prefix(m, "121", mode="net_debit")
            v_123 = sum_prefix(m, "1282", "1283", "1288", mode="net_debit")
            v_120 = v_121 + v_123

            # III. Các khoản phải thu ngắn hạn (130)
            # Tách công nợ 131 (Dư Nợ KH -> 131, Dư Có KH trả trước -> 312) và 331 (Dư Nợ trả trước NCC -> 132, Dư Có phải trả NCC -> 311)
            open_131_credit = sum_prefix(open_map, "131", mode="credit")
            open_331_debit = sum_prefix(open_map, "331", mode="debit")
            net_131 = sum_prefix(m, "131", mode="net_debit")
            net_331 = sum_prefix(m, "331", mode="net_credit")

            if is_opening:
                v_131 = sum_prefix(m, "131", mode="debit")
                v_312 = sum_prefix(m, "131", mode="credit")
                v_132 = sum_prefix(m, "331", mode="debit")
                v_311 = sum_prefix(m, "331", mode="credit")
            else:
                v_312 = open_131_credit
                v_131 = net_131 + v_312
                v_132 = open_331_debit
                v_311 = net_331 + v_132

            v_133_int = sum_prefix(m, "136", mode="net_debit")
            v_135 = sum_prefix(m, "138", "141", "244", mode="net_debit")
            v_130 = v_131 + v_132 + v_133_int + v_135

            # IV. Hàng tồn kho (140)
            v_141 = sum_prefix(m, "151", "152", "153", "154", "155", "156", "157", mode="net_debit")
            v_142 = -sum_prefix(m, "2294", mode="net_credit")
            v_140 = v_141 + v_142

            # VI. Tài sản ngắn hạn khác (160 / 150)
            net_133_vat = sum_prefix(m, "133", mode="net_debit")
            v_162 = max(net_133_vat, 0)
            v_160 = v_162

            v_100 = v_110 + v_120 + v_130 + v_140 + v_160

            # B. TÀI SẢN DÀI HẠN (200)
            v_222 = sum_prefix(m, "211", mode="net_debit")
            v_223 = -(sum_prefix(m, "214", mode="net_credit") - sum_prefix(m, "2142", "2143", mode="net_credit"))
            v_221 = v_222 + v_223

            v_225 = sum_prefix(m, "212", mode="net_debit")
            v_226 = -sum_prefix(m, "2142", mode="net_credit")
            v_224 = v_225 + v_226

            v_228 = sum_prefix(m, "213", mode="net_debit")
            v_229 = -sum_prefix(m, "2143", mode="net_credit")
            v_227 = v_228 + v_229

            v_220 = v_221 + v_224 + v_227

            v_241 = sum_prefix(m, "217", mode="net_debit")
            v_240 = v_241

            v_252 = sum_prefix(m, "241", mode="net_debit")
            v_250 = v_252

            v_261 = sum_prefix(m, "221", mode="net_debit")
            v_262 = sum_prefix(m, "222", mode="net_debit")
            v_263 = sum_prefix(m, "228", mode="net_debit")
            v_260 = v_261 + v_262 + v_263

            v_271 = sum_prefix(m, "242", mode="net_debit")
            v_272 = sum_prefix(m, "243", mode="net_debit")
            v_270_sub = v_271 + v_272

            v_200 = v_220 + v_240 + v_250 + v_260 + v_270_sub
            v_280 = v_100 + v_200

            # C. NỢ PHẢI TRẢ (300)
            v_314 = sum_prefix(m, "333", mode="net_credit") - min(net_133_vat, 0)
            v_315 = sum_prefix(m, "334", mode="net_credit")
            v_316 = sum_prefix(m, "335", mode="net_credit")
            v_320 = sum_prefix(m, "338", mode="net_credit")
            v_321 = sum_prefix(m, "341", mode="net_credit")
            v_322 = sum_prefix(m, "352", mode="net_credit")
            v_323 = sum_prefix(m, "353", mode="net_credit")
            v_310 = v_311 + v_312 + v_314 + v_315 + v_316 + v_320 + v_321 + v_322 + v_323
            v_330 = 0
            v_300 = v_310 + v_330

            # D. VỐN CHỦ SỞ HỮU (400)
            v_411 = sum_prefix(m, "411", mode="net_credit")
            v_411a = sum_prefix(m, "4111", mode="net_credit")
            v_412 = sum_prefix(m, "4112", mode="net_credit")
            v_417 = sum_prefix(m, "413", mode="net_credit")
            v_418 = sum_prefix(m, "414", "441", mode="net_credit")
            v_419 = sum_prefix(m, "418", mode="net_credit")

            unclosed_pnl = (
                sum_prefix(m, "5", "7", mode="net_credit")
                - sum_prefix(m, "6", "8", mode="net_debit")
                + sum_prefix(m, "911", mode="net_credit")
            )
            v_420a = sum_prefix(open_map, "421", mode="net_credit")
            base_equity_without_420 = v_411 + v_417 + v_418 + v_419
            v_420_total = v_280 - v_300 - base_equity_without_420
            v_420b = 0 if is_opening else (v_420_total - v_420a)

            v_400 = base_equity_without_420 + v_420_total
            v_440 = v_300 + v_400

            return {
                "100": v_100,
                "110": v_110,
                "111": v_111,
                "112": v_112,
                "120": v_120,
                "121": v_121,
                "123": v_123,
                "130": v_130,
                "131": v_131,
                "132": v_132,
                "133": v_133_int,
                "135": v_135,
                "136": v_135,  # Tương thích mã 136 trên báo cáo nhiều chi nhánh
                "140": v_140,
                "141": v_141,
                "142": v_142,
                "149": v_142,
                "150": v_160,  # Tương thích mã 150 trên báo cáo nhiều chi nhánh
                "152": v_162,
                "160": v_160,
                "162": v_162,
                "200": v_200,
                "220": v_220,
                "221": v_221,
                "222": v_222,
                "223": v_223,
                "224": v_224,
                "225": v_225,
                "226": v_226,
                "227": v_227,
                "228": v_228,
                "229": v_229,
                "240": v_240,
                "241": v_241,
                "250": v_250,
                "252": v_252,
                "260": v_260,
                "261": v_261,
                "262": v_262,
                "263": v_263,
                "270_sub": v_270_sub,
                "270": v_280,  # Tương thích mã 270 Tổng tài sản trên báo cáo nhiều chi nhánh
                "271": v_271,
                "272": v_272,
                "280": v_280,
                "300": v_300,
                "310": v_310,
                "311": v_311,
                "312": v_312,
                "313": v_314,  # Tương thích mã 313 trên báo cáo nhiều chi nhánh
                "314": v_314,
                "315": v_315,
                "316": v_316,
                "320": v_320,
                "321": v_321,
                "322": v_322,
                "323": v_323,
                "330": v_330,
                "400": v_400,
                "410": v_400,
                "411": v_411,
                "411a": v_411a,
                "412": v_412,
                "417": v_417,
                "418": v_418,
                "419": v_419,
                "420": v_420_total,
                "420a": v_420a,
                "420b": v_420b,
                "421": v_420_total,
                "440": v_440,
                "_cash_111": c_111_only,
                "_bank_112": c_112_only,
            }

        open_b01 = build_b01_side(open_map, is_opening=True)
        close_b01 = build_b01_side(close_map, is_opening=False)

        b01_dn = {}
        for k in close_b01:
            if not k.startswith("_"):
                b01_dn[k] = {
                    "opening": open_b01.get(k, 0),
                    "closing": close_b01.get(k, 0),
                }

        # 2. B02-DN: Báo cáo kết quả hoạt động kinh doanh TT99
        period_qs = JournalLine.objects.filter(
            entry__company=company,
            entry__status="POSTED",
        ).exclude(entry__entry_type="OPENING")

        closing_entry_ids = list(
            period_qs.filter(account__code__startswith="911")
            .values_list("entry_id", flat=True)
            .distinct()
        )
        operational_qs = period_qs.exclude(entry_id__in=closing_entry_ids)

        def op_sum(qs, *prefixes, field="debit"):
            total = 0
            for p in prefixes:
                val = qs.filter(account__code__startswith=p).aggregate(v=Sum(field))["v"] or 0
                total += int(val)
            return total

        rev_01 = op_sum(period_qs, "511", field="credit")
        ded_02 = op_sum(period_qs, "521", field="debit")
        net_rev_10 = rev_01 - ded_02
        cogs_11 = op_sum(operational_qs, "632", field="debit") - op_sum(operational_qs, "632", field="credit")
        gross_20 = net_rev_10 - cogs_11
        inv_prop_21 = 0
        fin_inc_22 = op_sum(period_qs, "515", field="credit")
        fin_exp_23 = op_sum(period_qs, "635", field="debit")
        int_exp_24 = fin_exp_23
        sell_exp_25 = op_sum(period_qs, "641", field="debit")
        adm_exp_26 = op_sum(period_qs, "642", field="debit")
        op_profit_30 = gross_20 + inv_prop_21 + fin_inc_22 - (fin_exp_23 + sell_exp_25 + adm_exp_26)
        oth_inc_31 = op_sum(period_qs, "711", field="credit")
        oth_exp_32 = op_sum(period_qs, "811", field="debit")
        oth_profit_40 = oth_inc_31 - oth_exp_32
        pbt_50 = op_profit_30 + oth_profit_40
        cit_cur_51 = op_sum(period_qs, "8211", field="debit") or op_sum(period_qs, "821", field="debit")
        cit_def_52 = op_sum(period_qs, "8212", field="debit")
        pat_60 = pbt_50 - cit_cur_51 - cit_def_52

        b02_dn = {
            "01": {"currentPeriod": rev_01, "previousPeriod": 0},
            "02": {"currentPeriod": ded_02, "previousPeriod": 0},
            "10": {"currentPeriod": net_rev_10, "previousPeriod": 0},
            "11": {"currentPeriod": cogs_11, "previousPeriod": 0},
            "20": {"currentPeriod": gross_20, "previousPeriod": 0},
            "21": {"currentPeriod": inv_prop_21, "previousPeriod": 0},
            "22": {"currentPeriod": fin_inc_22, "previousPeriod": 0},
            "23": {"currentPeriod": fin_exp_23, "previousPeriod": 0},
            "24": {"currentPeriod": int_exp_24, "previousPeriod": 0},
            "25": {"currentPeriod": sell_exp_25, "previousPeriod": 0},
            "26": {"currentPeriod": adm_exp_26, "previousPeriod": 0},
            "30": {"currentPeriod": op_profit_30, "previousPeriod": 0},
            "31": {"currentPeriod": oth_inc_31, "previousPeriod": 0},
            "32": {"currentPeriod": oth_exp_32, "previousPeriod": 0},
            "40": {"currentPeriod": oth_profit_40, "previousPeriod": 0},
            "50": {"currentPeriod": pbt_50, "previousPeriod": 0},
            "51": {"currentPeriod": cit_cur_51, "previousPeriod": 0},
            "52": {"currentPeriod": cit_def_52, "previousPeriod": 0},
            "60": {"currentPeriod": pat_60, "previousPeriod": 0},
            "70": {"currentPeriod": 0, "previousPeriod": 0},
            "71": {"currentPeriod": 0, "previousPeriod": 0},
        }

        # 3. B03-DN: Báo cáo lưu chuyển tiền tệ (Trực tiếp & Gián tiếp)
        cf_01 = 0
        cf_02 = 0
        cf_03 = 0
        cf_04 = 0
        cf_05 = 0
        cf_06 = 0
        cf_07 = 0
        cf_21 = 0
        cf_27 = 0
        cf_33 = 0
        cf_34 = 0

        period_entries = (
            JournalEntry.objects.filter(company=company, status="POSTED")
            .exclude(entry_type="OPENING")
            .prefetch_related("lines__account")
        )
        for entry in period_entries:
            lines = list(entry.lines.all())
            cash_lines = [l for l in lines if l.account.code.startswith(("111", "112", "113"))]
            non_cash_lines = [l for l in lines if not l.account.code.startswith(("111", "112", "113"))]
            if not cash_lines or not non_cash_lines:
                continue
            cash_in = sum(int(l.debit or 0) for l in cash_lines)
            cash_out = sum(int(l.credit or 0) for l in cash_lines)
            other_codes = [l.account.code for l in non_cash_lines]

            if cash_in > 0:
                if any(c.startswith(("515", "128", "221", "222")) for c in other_codes):
                    cf_27 += cash_in
                elif any(c.startswith("341") for c in other_codes):
                    cf_33 += cash_in
                elif any(c.startswith(("131", "511", "3331")) for c in other_codes):
                    cf_01 += cash_in
                else:
                    cf_06 += cash_in

            if cash_out > 0:
                if any(c.startswith(("211", "213", "241")) for c in other_codes):
                    cf_21 -= cash_out
                elif any(c.startswith("334") for c in other_codes):
                    cf_03 -= cash_out
                elif any(c.startswith("635") for c in other_codes):
                    cf_04 -= cash_out
                elif any(c.startswith("3334") for c in other_codes):
                    cf_05 -= cash_out
                elif any(c.startswith("341") for c in other_codes):
                    cf_34 -= cash_out
                elif any(c.startswith(("331", "152", "153", "156", "242", "641", "642")) for c in other_codes):
                    cf_02 -= cash_out
                else:
                    cf_07 -= cash_out

        cf_20 = cf_01 + cf_02 + cf_03 + cf_04 + cf_05 + cf_06 + cf_07
        cf_30 = cf_21 + cf_27
        cf_40 = cf_33 + cf_34
        cf_50 = cf_20 + cf_30 + cf_40
        cf_60 = open_b01["110"]
        cf_70 = close_b01["110"]
        cf_61 = cf_70 - cf_60 - cf_50

        b03_direct = {
            "01": {"currentPeriod": cf_01, "previousPeriod": 0},
            "02": {"currentPeriod": cf_02, "previousPeriod": 0},
            "03": {"currentPeriod": cf_03, "previousPeriod": 0},
            "04": {"currentPeriod": cf_04, "previousPeriod": 0},
            "05": {"currentPeriod": cf_05, "previousPeriod": 0},
            "06": {"currentPeriod": cf_06, "previousPeriod": 0},
            "07": {"currentPeriod": cf_07, "previousPeriod": 0},
            "20": {"currentPeriod": cf_20, "previousPeriod": 0},
            "21": {"currentPeriod": cf_21, "previousPeriod": 0},
            "22": {"currentPeriod": 0, "previousPeriod": 0},
            "23": {"currentPeriod": 0, "previousPeriod": 0},
            "24": {"currentPeriod": 0, "previousPeriod": 0},
            "25": {"currentPeriod": 0, "previousPeriod": 0},
            "26": {"currentPeriod": 0, "previousPeriod": 0},
            "27": {"currentPeriod": cf_27, "previousPeriod": 0},
            "30": {"currentPeriod": cf_30, "previousPeriod": 0},
            "31": {"currentPeriod": 0, "previousPeriod": 0},
            "32": {"currentPeriod": 0, "previousPeriod": 0},
            "33": {"currentPeriod": cf_33, "previousPeriod": 0},
            "34": {"currentPeriod": cf_34, "previousPeriod": 0},
            "35": {"currentPeriod": 0, "previousPeriod": 0},
            "36": {"currentPeriod": 0, "previousPeriod": 0},
            "40": {"currentPeriod": cf_40, "previousPeriod": 0},
            "50": {"currentPeriod": cf_50, "previousPeriod": 0},
            "60": {"currentPeriod": cf_60, "previousPeriod": 0},
            "61": {"currentPeriod": cf_61, "previousPeriod": 0},
            "70": {"currentPeriod": cf_70, "previousPeriod": 0},
        }

        # Gián tiếp
        ind_01 = pbt_50
        ind_02 = op_sum(period_qs, "214", field="credit")
        ind_05 = -fin_inc_22
        ind_06 = int_exp_24
        ind_08 = ind_01 + ind_02 + ind_05 + ind_06
        ind_09 = -((close_b01["130"] + close_b01["160"]) - (open_b01["130"] + open_b01["160"]))
        ind_10 = -(close_b01["140"] - open_b01["140"])
        ind_12 = -(close_b01["271"] - open_b01["271"])
        ind_14 = cf_04
        ind_15 = cf_05
        ind_11 = cf_20 - (ind_08 + ind_09 + ind_10 + ind_12 + ind_14 + ind_15)

        b03_indirect = {
            "01": {"currentPeriod": ind_01, "previousPeriod": 0},
            "02": {"currentPeriod": ind_02, "previousPeriod": 0},
            "03": {"currentPeriod": 0, "previousPeriod": 0},
            "04": {"currentPeriod": 0, "previousPeriod": 0},
            "05": {"currentPeriod": ind_05, "previousPeriod": 0},
            "06": {"currentPeriod": ind_06, "previousPeriod": 0},
            "07": {"currentPeriod": 0, "previousPeriod": 0},
            "08": {"currentPeriod": ind_08, "previousPeriod": 0},
            "09": {"currentPeriod": ind_09, "previousPeriod": 0},
            "10": {"currentPeriod": ind_10, "previousPeriod": 0},
            "11": {"currentPeriod": ind_11, "previousPeriod": 0},
            "12": {"currentPeriod": ind_12, "previousPeriod": 0},
            "13": {"currentPeriod": 0, "previousPeriod": 0},
            "14": {"currentPeriod": ind_14, "previousPeriod": 0},
            "15": {"currentPeriod": ind_15, "previousPeriod": 0},
            "16": {"currentPeriod": 0, "previousPeriod": 0},
            "17": {"currentPeriod": 0, "previousPeriod": 0},
            "20": {"currentPeriod": cf_20, "previousPeriod": 0},
            "21": {"currentPeriod": cf_21, "previousPeriod": 0},
            "22": {"currentPeriod": 0, "previousPeriod": 0},
            "23": {"currentPeriod": 0, "previousPeriod": 0},
            "24": {"currentPeriod": 0, "previousPeriod": 0},
            "25": {"currentPeriod": 0, "previousPeriod": 0},
            "26": {"currentPeriod": 0, "previousPeriod": 0},
            "27": {"currentPeriod": cf_27, "previousPeriod": 0},
            "30": {"currentPeriod": cf_30, "previousPeriod": 0},
            "31": {"currentPeriod": 0, "previousPeriod": 0},
            "32": {"currentPeriod": 0, "previousPeriod": 0},
            "33": {"currentPeriod": cf_33, "previousPeriod": 0},
            "34": {"currentPeriod": cf_34, "previousPeriod": 0},
            "35": {"currentPeriod": 0, "previousPeriod": 0},
            "36": {"currentPeriod": 0, "previousPeriod": 0},
            "40": {"currentPeriod": cf_40, "previousPeriod": 0},
            "50": {"currentPeriod": cf_50, "previousPeriod": 0},
            "60": {"currentPeriod": cf_60, "previousPeriod": 0},
            "61": {"currentPeriod": cf_61, "previousPeriod": 0},
            "70": {"currentPeriod": cf_70, "previousPeriod": 0},
        }

        # 4. B09-DN: Thuyết minh báo cáo tài chính TT99
        b09_dn = {
            "cash_on_hand_open": open_b01["_cash_111"],
            "cash_on_hand_close": close_b01["_cash_111"],
            "cash_in_bank_open": open_b01["_bank_112"],
            "cash_in_bank_close": close_b01["_bank_112"],
            "total_cash_open": open_b01["110"],
            "total_cash_close": close_b01["110"],
            "ar_open": open_b01["131"],
            "ar_close": close_b01["131"],
            "inventory_open": open_b01["140"],
            "inventory_close": close_b01["140"],
            "ap_open": open_b01["311"],
            "ap_close": close_b01["311"],
            "fa_cost_open": open_b01["222"] + open_b01["228"],
            "fa_cost_close": close_b01["222"] + close_b01["228"],
            "fa_depr_open": open_b01["223"] + open_b01["229"],
            "fa_depr_close": close_b01["223"] + close_b01["229"],
            "revenue": rev_01,
            "deductions": ded_02,
            "net_revenue": net_rev_10,
            "cogs": cogs_11,
            "gross_profit": gross_20,
            "selling_expense": sell_exp_25,
            "admin_expense": adm_exp_26,
            "cit_expense": cit_cur_51,
            "net_profit": pat_60,
        }

        return Response({
            "company_id": str(company.id),
            "company_name": company.name,
            "accounting_regime": "TT99",
            "circular_label": "Ban hành theo Thông tư số 99/2025/TT-BTC của Bộ Tài chính",
            "b01_dn": b01_dn,
            "b02_dn": b02_dn,
            "b03_direct": b03_direct,
            "b03_indirect": b03_indirect,
            "b09_dn": b09_dn,
        })


class DashboardViewSet(ViewSet):
    """
    UC-RPT-01 – Xem Dashboard tổng quan:
    - GET  /api/v1/reports/dashboard/config/
    - POST /api/v1/reports/dashboard/config/
    - GET  /api/v1/reports/dashboard/overview/
    - POST /api/v1/reports/dashboard/refresh/
    - GET  /api/v1/reports/dashboard/cash-flow/
    - GET  /api/v1/reports/dashboard/profitability/
    - GET  /api/v1/reports/dashboard/receivables/
    - GET  /api/v1/reports/dashboard/payables/
    - GET  /api/v1/reports/dashboard/inventory/
    - GET  /api/v1/reports/dashboard/tax-obligations/
    - GET  /api/v1/reports/dashboard/tasks/
    - GET  /api/v1/reports/dashboard/recent-documents/
    - GET  /api/v1/reports/dashboard/metrics/<metric_code>/details/
    """

    @action(detail=False, methods=("get", "post"), url_path="config")
    def config(self, request):
        ctx = dashboard_services.resolve_dashboard_context(request)
        if request.method == "POST":
            data = request.data if isinstance(request.data, dict) else {}
            cfg, _ = DashboardConfiguration.objects.update_or_create(
                company=ctx.company,
                user=ctx.iam_account,
                defaults={
                    "enabled_widgets": data.get("enabled_widgets", []),
                    "default_period_type": data.get("default_period_type", "MONTH"),
                    "default_comparison_mode": data.get("default_comparison_mode", "PREVIOUS_PERIOD"),
                    "cash_flow_scope": data.get("cash_flow_scope", "EXTERNAL_ONLY"),
                    "slow_moving_days": int(data.get("slow_moving_days", 90)),
                    "tasks_limit": int(data.get("tasks_limit", 3)),
                    "recent_documents_limit": int(data.get("recent_documents_limit", 5)),
                    "recent_documents_sort_by": data.get("recent_documents_sort_by", "created_at"),
                },
            )
            ctx.config = cfg
            dashboard_services.invalidate_dashboard_cache(ctx.company)
        return Response(dashboard_services.get_dashboard_config_payload(ctx))

    @action(detail=False, methods=("get",), url_path="overview")
    def overview(self, request):
        is_force = str(request.query_params.get("refresh_mode", "")).upper() == "FORCE_REFRESH"
        ctx = dashboard_services.resolve_dashboard_context(request, require_refresh_perm=is_force)
        return Response(dashboard_services.get_dashboard_overview_payload(ctx))

    @action(detail=False, methods=("post",), url_path="refresh")
    def refresh(self, request):
        ctx = dashboard_services.resolve_dashboard_context(request, require_refresh_perm=True)
        ctx.refresh_mode = "FORCE_REFRESH"
        dashboard_services.invalidate_dashboard_cache(ctx.company)
        return Response(dashboard_services.get_dashboard_overview_payload(ctx))

    @action(detail=False, methods=("get",), url_path="cash-flow")
    def cash_flow(self, request):
        ctx = dashboard_services.resolve_dashboard_context(request)
        bucket = request.query_params.get("bucket")
        res = dashboard_services.execute_widget_safely(
            ctx, "DASH-05", lambda: dashboard_services.compute_dash_05_cash_flow(ctx, bucket_override=bucket)
        )
        return Response(res)

    @action(detail=False, methods=("get",), url_path="profitability")
    def profitability(self, request):
        ctx = dashboard_services.resolve_dashboard_context(request)
        res = dashboard_services.execute_widget_safely(
            ctx, "DASH-06", lambda: dashboard_services.compute_dash_06_profitability(ctx)
        )
        return Response(res)

    @action(detail=False, methods=("get",), url_path="receivables")
    def receivables(self, request):
        ctx = dashboard_services.resolve_dashboard_context(request)
        top_n = int(request.query_params.get("top_n", 5))
        res = dashboard_services.execute_widget_safely(
            ctx, "DASH-07", lambda: dashboard_services.compute_dash_07_receivables(ctx, top_n=top_n)
        )
        return Response(res)

    @action(detail=False, methods=("get",), url_path="payables")
    def payables(self, request):
        ctx = dashboard_services.resolve_dashboard_context(request)
        top_n = int(request.query_params.get("top_n", 5))
        res = dashboard_services.execute_widget_safely(
            ctx, "DASH-08", lambda: dashboard_services.compute_dash_08_payables(ctx, top_n=top_n)
        )
        return Response(res)

    @action(detail=False, methods=("get",), url_path="inventory")
    def inventory(self, request):
        ctx = dashboard_services.resolve_dashboard_context(request)
        top_n = int(request.query_params.get("top_n", 5))
        res = dashboard_services.execute_widget_safely(
            ctx, "DASH-09", lambda: dashboard_services.compute_dash_09_inventory(ctx, top_n=top_n)
        )
        return Response(res)

    @action(detail=False, methods=("get",), url_path="tax-obligations")
    def tax_obligations(self, request):
        ctx = dashboard_services.resolve_dashboard_context(request)
        res = dashboard_services.execute_widget_safely(
            ctx, "DASH-10", lambda: dashboard_services.compute_dash_10_tax(ctx)
        )
        return Response(res)

    @action(detail=False, methods=("get",), url_path="tasks")
    def tasks(self, request):
        ctx = dashboard_services.resolve_dashboard_context(request)
        limit = int(request.query_params.get("limit", 0)) or None
        res = dashboard_services.execute_widget_safely(
            ctx, "DASH-11", lambda: dashboard_services.compute_dash_11_tasks(ctx, limit=limit)
        )
        return Response(res)

    @action(detail=False, methods=("get",), url_path="recent-documents")
    def recent_documents(self, request):
        ctx = dashboard_services.resolve_dashboard_context(request)
        limit = int(request.query_params.get("limit", 0)) or None
        sort_by = request.query_params.get("sort_by")
        res = dashboard_services.execute_widget_safely(
            ctx, "DASH-12", lambda: dashboard_services.compute_dash_12_recent_documents(ctx, limit=limit, sort_by=sort_by)
        )
        return Response(res)

    def metric_details(self, request, metric_code=None):
        ctx = dashboard_services.resolve_dashboard_context(request)
        return Response(dashboard_services.get_metric_drilldown_details(ctx, metric_code))


class FinancialBundleViewSet(ViewSet):
    """
    UC-RPT-02 – Xem bộ báo cáo tài chính (Financial Statement Bundles).
    """

    @action(detail=False, methods=("get",), url_path="types")
    def types(self, request):
        return Response(financial_bundle_services.get_financial_bundle_types_payload(request))

    def list(self, request):
        financial_bundle_services.ensure_financial_catalog_seeded()
        company, allowed_branches = financial_bundle_services.resolve_company_and_check_perm(request, "VIEW")
        qs = (
            FinancialStatementBundle.objects.filter(company=company)
            .select_related("company", "fiscal_period", "branch", "approved_by", "created_by")
            .prefetch_related("components__statement_run", "validations")
        )
        if allowed_branches is not None:
            qs = qs.filter(models_Q_branch(allowed_branches))

        if fy := request.query_params.get("fiscal_year") or request.query_params.get("fiscal_year_id"):
            qs = qs.filter(fiscal_year=int(fy))
        if fp := request.query_params.get("fiscal_period_id") or request.query_params.get("period_id"):
            qs = qs.filter(fiscal_period_id=fp)
        if bt := request.query_params.get("bundle_type"):
            qs = qs.filter(bundle_type=bt.upper())
        if scope := request.query_params.get("reporting_scope"):
            qs = qs.filter(reporting_scope=scope.upper())
        if bid := request.query_params.get("branch_id"):
            qs = qs.filter(branch_id=bid)
        if bstatus := request.query_params.get("bundle_status"):
            qs = qs.filter(bundle_status=bstatus.upper())
        if request.query_params.get("current_only", "").lower() in ("true", "1"):
            qs = qs.filter(is_current_version=True)

        items = [financial_bundle_services.serialize_bundle_summary(b) for b in qs.order_by("-fiscal_year", "-bundle_version", "-created_at")]
        return Response({
            "company_id": str(company.id),
            "company_name": company.name,
            "count": len(items),
            "items": items,
        })

    def create(self, request):
        bundle = financial_bundle_services.create_or_version_financial_bundle(request)
        return Response(
            financial_bundle_services.serialize_bundle_detail(bundle, request.user),
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, pk=None):
        bundle = financial_bundle_services.get_bundle_for_request(request, pk, required_action="VIEW")
        return Response(financial_bundle_services.serialize_bundle_detail(bundle, request.user))

    @action(detail=True, methods=("get",), url_path="components")
    def components(self, request, pk=None):
        bundle = financial_bundle_services.get_bundle_for_request(request, pk, required_action="VIEW")
        comps = financial_bundle_services.serialize_bundle_components(bundle)
        return Response({
            "bundle_id": str(bundle.id),
            "bundle_code": bundle.bundle_code,
            "bundle_version": bundle.bundle_version,
            "required_component_count": 4,
            "available_component_count": sum(1 for c in comps if c["statement_run_id"] and c["run_status"] != "ERROR"),
            "approved_component_count": sum(1 for c in comps if c["approved_status"]),
            "items": comps,
        })

    @action(detail=True, methods=("get",), url_path="validation")
    def validation(self, request, pk=None):
        bundle = financial_bundle_services.get_bundle_for_request(request, pk, required_action="VIEW")
        vals = list(bundle.validations.all())
        return Response({
            "bundle_id": str(bundle.id),
            "bundle_status": bundle.bundle_status,
            "validation_status": bundle.validation_status,
            "warning_count": sum(1 for v in vals if v.severity == "WARNING"),
            "blocker_count": sum(1 for v in vals if v.severity == "BLOCKER"),
            "last_checked_at": bundle.last_checked_at.isoformat() if bundle.last_checked_at else None,
            "items": [
                {
                    "id": str(v.id),
                    "rule_code": v.rule_code,
                    "severity": v.severity,
                    "component_type": v.component_type,
                    "indicator_code": v.indicator_code,
                    "source_reference": v.source_reference,
                    "message": v.message,
                    "validation_status": v.validation_status,
                    "checked_at": v.checked_at.isoformat(),
                }
                for v in vals
            ],
        })

    @action(detail=True, methods=("post",), url_path="validate")
    def validate_bundle(self, request, pk=None):
        bundle = financial_bundle_services.get_bundle_for_request(request, pk, required_action="VIEW")
        return Response(financial_bundle_services.validate_financial_bundle(bundle))

    @action(detail=True, methods=("get",), url_path="history")
    def history(self, request, pk=None):
        return Response(financial_bundle_services.get_bundle_history_payload(request, pk))

    @action(detail=True, methods=("get",), url_path="supporting-reports")
    def supporting_reports(self, request, pk=None):
        return Response(financial_bundle_services.get_supporting_reports_payload(request, bundle_id=pk))

    @action(detail=True, methods=("post",), url_path="submit-review")
    def submit_review(self, request, pk=None):
        return Response(financial_bundle_services.submit_bundle_for_review(request, pk))

    @action(detail=True, methods=("post",), url_path="approve")
    def approve(self, request, pk=None):
        return Response(financial_bundle_services.approve_financial_bundle(request, pk))

    @action(detail=True, methods=("post",), url_path="export")
    def export(self, request, pk=None):
        return Response(financial_bundle_services.export_financial_bundle_payload(request, pk))


def models_Q_branch(allowed_branches: list[str]):
    from django.db.models import Q
    return Q(reporting_scope="COMPANY") | Q(branch_id__in=allowed_branches)


class FinancialStatementRunViewSet(ViewSet):
    """
    UC-RPT-02 / UC-RPT-03..06 / UC-RPT-14 – Quản lý và tra cứu Statement Run, Lines, Value Slots & Drill-down.
    """

    @action(detail=False, methods=("post",), url_path="generate")
    def generate(self, request):
        from general_ledger.models import AccountingPeriod
        from organization.models import Branch
        company, allowed_branches = financial_bundle_services.resolve_company_and_check_perm(request, "GENERATE")
        data = request.data if isinstance(request.data, dict) else {}
        period_id = data.get("fiscal_period_id")
        period = AccountingPeriod.objects.filter(id=period_id, company=company).first()
        if not period:
            raise drf_serializers.ValidationError({"fiscal_period_id": "Kỳ kế toán không hợp lệ."})
        legal_form_code = str(data.get("legal_form_code") or "B01-DN")
        reporting_scope = str(data.get("reporting_scope") or "COMPANY").upper()
        branch = None
        if reporting_scope == "BRANCH":
            bid = data.get("branch_id")
            branch = Branch.objects.filter(id=bid, company=company).first()
            if not branch:
                raise drf_serializers.ValidationError({"branch_id": "Chi nhánh không hợp lệ."})
            if allowed_branches is not None and str(branch.id) not in allowed_branches:
                raise drf_serializers.ValidationError({"branch_id": "Chi nhánh ngoài phạm vi phân quyền."})

        run = financial_bundle_services.generate_financial_statement_run(
            company=company,
            fiscal_period=period,
            legal_form_code=legal_form_code,
            user=request.user,
            reporting_scope=reporting_scope,
            branch=branch,
            cash_flow_method=str(data.get("cash_flow_method") or ""),
            template_version_id=data.get("template_version_id"),
            run_status=str(data.get("run_status") or "GENERATED"),
        )
        return Response(
            financial_bundle_services.get_statement_run_detail_payload(request, str(run.id)),
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, pk=None):
        return Response(financial_bundle_services.get_statement_run_detail_payload(request, pk))

    @action(detail=True, methods=("get",), url_path="lines")
    def lines(self, request, pk=None):
        return Response(financial_bundle_services.get_statement_run_lines_payload(request, pk))

    @action(detail=True, methods=("post",), url_path="approve")
    def approve_run(self, request, pk=None):
        from django.utils import timezone
        run = financial_bundle_services.get_statement_run_for_request(request, pk, required_action="APPROVE")
        iam_account = getattr(request.user, "iam_account", None)
        run.run_status = "APPROVED"
        run.approved_by = iam_account
        run.approved_at = timezone.now()
        run.save(update_fields=["run_status", "approved_by", "approved_at"])
        tv = run.template_version
        if not tv.is_locked:
            tv.is_locked = True
            tv.save(update_fields=["is_locked"])
        return Response(financial_bundle_services.get_statement_run_detail_payload(request, str(run.id)))

    def line_sources(self, request, run_id=None, line_id=None):
        return Response(financial_bundle_services.get_statement_line_sources_payload(request, run_id, line_id))


class FinancialPositionViewSet(ViewSet):
    """
    UC-RPT-03 – Xem bảng cân đối kế toán / Báo cáo tình hình tài chính (B01-DN, B01a-DN, B01b-DN, B01-DNKLT).
    """

    def templates(self, request):
        company = financial_position_services.resolve_b01_company(request)
        financial_position_services.require_b01_permission(request.user, company, "RPT_FINANCIAL_VIEW")
        return Response(financial_position_services.get_financial_position_templates(company))

    def template_versions(self, request, template_id=None):
        company = financial_position_services.resolve_b01_company(request)
        financial_position_services.require_b01_permission(request.user, company, "RPT_FINANCIAL_VIEW")
        return Response(financial_position_services.get_financial_position_template_versions(template_id))

    def parameters(self, request):
        company = financial_position_services.resolve_b01_company(request)
        financial_position_services.require_b01_permission(request.user, company, "RPT_FINANCIAL_VIEW")
        return Response(financial_position_services.get_financial_position_parameters(company, request.user))

    def runs(self, request):
        if request.method == "POST":
            company = financial_position_services.resolve_b01_company(request)
            data = request.data if isinstance(request.data, dict) else {}
            res = financial_position_services.create_financial_position_run(company, request.user, data)
            return Response(res, status=status.HTTP_201_CREATED)
        company = financial_position_services.resolve_b01_company(request)
        return Response(financial_position_services.list_financial_position_runs(company, request.user, request.query_params))

    def run_detail(self, request, run_id=None):
        company = financial_position_services.resolve_b01_company(request)
        return Response(financial_position_services.get_financial_position_run_detail(company, request.user, run_id, request.query_params))

    def run_lines(self, request, run_id=None):
        company = financial_position_services.resolve_b01_company(request)
        return Response(financial_position_services.get_financial_position_run_lines(company, request.user, run_id, request.query_params))

    def run_validation(self, request, run_id=None):
        company = financial_position_services.resolve_b01_company(request)
        return Response(financial_position_services.get_financial_position_run_validation(company, request.user, run_id))

    def run_validate(self, request, run_id=None):
        company = financial_position_services.resolve_b01_company(request)
        return Response(financial_position_services.trigger_financial_position_run_validate(company, request.user, run_id))

    def line_calculation(self, request, run_id=None, line_id=None):
        company = financial_position_services.resolve_b01_company(request)
        return Response(financial_position_services.get_financial_position_line_calculation(company, request.user, run_id, line_id, request.query_params))

    def line_drilldown(self, request, run_id=None, line_id=None):
        company = financial_position_services.resolve_b01_company(request)
        return Response(financial_position_services.get_financial_position_line_drilldown(company, request.user, run_id, line_id, request.query_params))

    def run_history(self, request, run_id=None):
        company = financial_position_services.resolve_b01_company(request)
        return Response(financial_position_services.get_financial_position_run_history(company, request.user, run_id))

    def run_submit_review(self, request, run_id=None):
        company = financial_position_services.resolve_b01_company(request)
        data = request.data if isinstance(request.data, dict) else {}
        return Response(financial_position_services.submit_financial_position_run_review(company, request.user, run_id, data))

    def run_approve(self, request, run_id=None):
        company = financial_position_services.resolve_b01_company(request)
        data = request.data if isinstance(request.data, dict) else {}
        return Response(financial_position_services.approve_financial_position_run(company, request.user, run_id, data))

    def run_export(self, request, run_id=None):
        company = financial_position_services.resolve_b01_company(request)
        data = request.data if isinstance(request.data, dict) else {}
        return Response(financial_position_services.export_financial_position_run(company, request.user, run_id, data))


class BusinessResultViewSet(ViewSet):
    """
    UC-RPT-04 – Xem báo cáo kết quả hoạt động kinh doanh (B02-DN, B02-DNKLT, B02a-DN, B02b-DN).
    """

    def templates(self, request):
        return Response(business_result_services.get_business_result_templates(request))

    def template_versions(self, request, template_id=None):
        return Response(business_result_services.get_business_result_template_versions(request, template_id=template_id))

    def parameters(self, request):
        return Response(business_result_services.get_business_result_parameters(request))

    def runs(self, request):
        if request.method == "POST":
            res = business_result_services.create_business_result_run(request)
            return Response(res, status=status.HTTP_201_CREATED)
        return Response(business_result_services.list_business_result_runs(request))

    def run_detail(self, request, run_id=None):
        return Response(business_result_services.get_business_result_run_detail(request, run_id))

    def run_lines(self, request, run_id=None):
        return Response(business_result_services.get_business_result_run_lines(request, run_id))

    def run_values(self, request, run_id=None):
        return Response(business_result_services.get_business_result_run_values(request, run_id))

    def run_validation(self, request, run_id=None):
        return Response(business_result_services.get_business_result_run_validation(request, run_id))

    def run_validate(self, request, run_id=None):
        return Response(business_result_services.trigger_business_result_run_validate(request, run_id))

    def line_calculation(self, request, run_id=None, indicator_code=None):
        return Response(business_result_services.get_business_result_line_calculation(request, run_id, indicator_code))

    def line_drilldown(self, request, run_id=None, indicator_code=None):
        return Response(business_result_services.get_business_result_line_drilldown(request, run_id, indicator_code))

    def run_history(self, request, run_id=None):
        return Response(business_result_services.get_business_result_run_history(request, run_id))

    def run_submit_review(self, request, run_id=None):
        return Response(business_result_services.submit_business_result_run_review(request, run_id))

    def run_approve(self, request, run_id=None):
        return Response(business_result_services.approve_business_result_run(request, run_id))

    def run_export(self, request, run_id=None):
        return Response(business_result_services.export_business_result_run(request, run_id))


class CashFlowViewSet(ViewSet):
    """
    UC-RPT-05 – Xem báo cáo lưu chuyển tiền tệ (B03-DN, B03-DNKLT, B03a-DN, B03b-DN).
    """

    def templates(self, request):
        return Response(cash_flow_services.get_cash_flow_templates(request))

    def template_versions(self, request, template_id=None):
        return Response(cash_flow_services.get_cash_flow_template_versions(request, template_id=template_id))

    def parameters(self, request):
        return Response(cash_flow_services.get_cash_flow_parameters(request))

    def runs(self, request):
        if request.method == "POST":
            res = cash_flow_services.create_cash_flow_run(request)
            return Response(res, status=status.HTTP_201_CREATED)
        return Response(cash_flow_services.list_cash_flow_runs(request))

    def run_detail(self, request, run_id=None):
        return Response(cash_flow_services.get_cash_flow_run_detail(request, run_id))

    def run_lines(self, request, run_id=None):
        return Response(cash_flow_services.get_cash_flow_run_lines(request, run_id))

    def run_values(self, request, run_id=None):
        return Response(cash_flow_services.get_cash_flow_run_values(request, run_id))

    def run_validation(self, request, run_id=None):
        return Response(cash_flow_services.get_cash_flow_run_validation(request, run_id))

    def run_validate(self, request, run_id=None):
        return Response(cash_flow_services.trigger_cash_flow_run_validate(request, run_id))

    def line_calculation(self, request, run_id=None, indicator_code=None):
        return Response(cash_flow_services.get_cash_flow_line_calculation(request, run_id, indicator_code))

    def line_drilldown(self, request, run_id=None, indicator_code=None):
        return Response(cash_flow_services.get_cash_flow_line_drilldown(request, run_id, indicator_code))

    def unclassified_transactions(self, request, run_id=None):
        return Response(cash_flow_services.get_cash_flow_unclassified_transactions(request, run_id))

    def reconciliation(self, request, run_id=None):
        return Response(cash_flow_services.get_cash_flow_reconciliation(request, run_id))

    def run_history(self, request, run_id=None):
        return Response(cash_flow_services.get_cash_flow_run_history(request, run_id))

    def run_submit_review(self, request, run_id=None):
        return Response(cash_flow_services.submit_cash_flow_run_review(request, run_id))

    def run_approve(self, request, run_id=None):
        return Response(cash_flow_services.approve_cash_flow_run(request, run_id))

    def run_export(self, request, run_id=None):
        return Response(cash_flow_services.export_cash_flow_run(request, run_id))


class FinancialNotesViewSet(ViewSet):
    """
    UC-RPT-06 – Xem thuyết minh báo cáo tài chính (B09-DN, B09-DNKLT, B09a-DN).
    """

    def templates(self, request):
        return Response(financial_notes_services.get_b09_templates_payload(request.user, request.query_params.dict()))

    def template_versions(self, request, template_id=None):
        tid = template_id or request.query_params.get("template_id") or request.query_params.get("template_code") or "B09-DN"
        return Response(financial_notes_services.get_b09_template_versions_payload(request.user, tid, request.query_params.dict()))

    def runs(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        payload, http_status = financial_notes_services.list_or_create_b09_runs_payload(
            request.user,
            request.method,
            request.query_params.dict(),
            data,
        )
        return Response(payload, status=http_status)

    def run_detail(self, request, run_id=None):
        return Response(financial_notes_services.get_b09_run_header_payload(request.user, run_id))

    def run_sections(self, request, run_id=None):
        return Response(financial_notes_services.get_b09_run_sections_payload(request.user, run_id))

    def section_detail(self, request, run_id=None, section_code=None):
        return Response(financial_notes_services.get_b09_section_detail_payload(request.user, run_id, section_code))

    def item_detail(self, request, run_id=None, note_code=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(
            financial_notes_services.get_or_update_b09_item_payload(
                request.user,
                run_id,
                note_code,
                method=request.method,
                body_data=data,
            )
        )

    def item_tables(self, request, run_id=None, note_code=None):
        return Response(financial_notes_services.get_b09_item_tables_payload(request.user, run_id, note_code))

    def table_rows(self, request, run_id=None, table_id=None):
        return Response(financial_notes_services.get_b09_table_rows_payload(request.user, run_id, table_id))

    def item_sources(self, request, run_id=None, note_code=None):
        return Response(financial_notes_services.get_b09_item_sources_payload(request.user, run_id, note_code))

    def run_validation(self, request, run_id=None):
        return Response(financial_notes_services.get_b09_validation_payload(request.user, run_id))

    def run_completeness(self, request, run_id=None):
        return Response(financial_notes_services.get_b09_completeness_payload(request.user, run_id))

    def run_history(self, request, run_id=None):
        return Response(financial_notes_services.get_b09_history_payload(request.user, run_id))

    def run_search(self, request, run_id=None):
        return Response(financial_notes_services.search_b09_run_payload(request.user, run_id, request.query_params.dict()))

    def run_validate(self, request, run_id=None):
        return Response(financial_notes_services.validate_b09_run_action(request.user, run_id))

    def run_submit_review(self, request, run_id=None):
        return Response(financial_notes_services.submit_review_b09_run_action(request.user, run_id))

    def run_approve(self, request, run_id=None):
        return Response(financial_notes_services.approve_b09_run_action(request.user, run_id))

    def run_export(self, request, run_id=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(financial_notes_services.export_b09_run_action(request.user, run_id, data))


class TaxReportViewSet(ViewSet):
    """
    UC-RPT-07 – Xem báo cáo thuế (15 báo cáo: RPT-0003, RPT-0175..0180, RPT-TAX-08..15).
    """

    def catalogue(self, request):
        return Response(tax_report_services.get_tax_catalogue_payload(request=request, user=request.user))

    def parameters(self, request, report_code=None):
        return Response(tax_report_services.get_tax_report_parameters_payload(report_code, request=request, user=request.user))

    def report_schema(self, request, report_code=None):
        return Response(tax_report_services.get_tax_report_schema_payload(report_code, request=request, user=request.user))

    def runs(self, request, report_code=None):
        return Response(tax_report_services.list_tax_report_runs_payload(report_code, request=request, user=request.user))

    def query_report(self, request, report_code=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(
            tax_report_services.query_tax_report_payload(report_code, params=data, user=request.user, request=request),
            status=status.HTTP_200_OK,
        )

    def run_detail(self, request, run_id=None):
        return Response(tax_report_services.get_tax_run_header_payload(int(run_id), user=request.user, request=request))

    def run_rows(self, request, run_id=None):
        return Response(tax_report_services.get_tax_run_rows_payload(int(run_id), user=request.user, request=request))

    def run_summary(self, request, run_id=None):
        return Response(tax_report_services.get_tax_run_summary_payload(int(run_id), user=request.user, request=request))

    def run_validation(self, request, run_id=None):
        return Response(tax_report_services.get_tax_run_validation_payload(int(run_id), user=request.user, request=request))

    def row_sources(self, request, run_id=None, row_id=None):
        return Response(tax_report_services.get_tax_row_sources_payload(int(run_id), int(row_id), user=request.user, request=request))

    def run_history(self, request, run_id=None):
        return Response(tax_report_services.get_tax_run_history_payload(int(run_id), user=request.user, request=request))

    def run_export(self, request, run_id=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(tax_report_services.export_tax_run_payload(int(run_id), params=data, user=request.user, request=request))

    def forms(self, request):
        return Response(tax_report_services.get_tax_forms_payload(request=request, user=request.user))

    def form_versions(self, request, form_code=None):
        return Response(tax_report_services.get_tax_form_versions_payload(form_code, request=request, user=request.user))

    def declaration_indicators(self, request, declaration_id=None):
        return Response(tax_report_services.get_tax_declaration_indicators_payload(declaration_id, user=request.user, request=request))

    def reconciliation_differences(self, request, run_id=None, reconciliation_run_id=None):
        target_id = run_id if run_id is not None else reconciliation_run_id
        return Response(tax_report_services.get_tax_reconciliation_differences_payload(int(target_id), user=request.user, request=request))

    def submission_responses(self, request, submission_id=None):
        return Response(tax_report_services.get_tax_submission_responses_payload(submission_id, user=request.user, request=request))


class PurchaseReportViewSet(ViewSet):
    """
    UC-RPT-08 – Xem báo cáo mua hàng (11 báo cáo: RPT-0047..0051, RPT-0061, RPT-0064, RPT-0068, RPT-0070, RPT-0074, RPT-0075).
    """

    def catalogue(self, request):
        return Response(purchase_report_services.get_purchase_catalogue_payload(request=request, user=request.user))

    def report_schema(self, request, report_code=None):
        return Response(purchase_report_services.get_purchase_report_schema_payload(report_code, request=request, user=request.user))

    def parameters(self, request, report_code=None):
        return Response(purchase_report_services.get_purchase_report_parameters_payload(report_code, request=request, user=request.user))

    def query_report(self, request, report_code=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(
            purchase_report_services.query_purchase_report_payload(report_code, params=data, user=request.user, request=request),
            status=status.HTTP_200_OK,
        )

    def run_detail(self, request, run_id=None):
        return Response(purchase_report_services.get_purchase_run_header_payload(int(run_id), user=request.user, request=request))

    def run_rows(self, request, run_id=None):
        return Response(purchase_report_services.get_purchase_run_rows_payload(int(run_id), user=request.user, request=request))

    def run_summary(self, request, run_id=None):
        return Response(purchase_report_services.get_purchase_run_summary_payload(int(run_id), user=request.user, request=request))

    def run_validation(self, request, run_id=None):
        return Response(purchase_report_services.get_purchase_run_validation_payload(int(run_id), user=request.user, request=request))

    def row_sources(self, request, run_id=None, row_id=None):
        return Response(purchase_report_services.get_purchase_row_sources_payload(int(run_id), int(row_id), user=request.user, request=request))

    def run_history(self, request, run_id=None):
        return Response(purchase_report_services.get_purchase_run_history_payload(int(run_id), user=request.user, request=request))

    def saved_filters(self, request):
        report_code = request.query_params.get("report_code")
        return Response(purchase_report_services.list_purchase_saved_filters_payload(report_code, user=request.user, request=request))

    def save_filter(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(
            purchase_report_services.save_purchase_filter_payload(data, user=request.user, request=request),
            status=status.HTTP_201_CREATED,
        )

    def reconciliation_differences(self, request, run_id=None, reconciliation_id=None):
        target_id = run_id if run_id is not None else reconciliation_id
        return Response(purchase_report_services.get_purchase_reconciliation_differences_payload(int(target_id), user=request.user, request=request))

    def run_export(self, request, run_id=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(purchase_report_services.export_purchase_run_payload(int(run_id), params=data, user=request.user, request=request))


class SalesReportViewSet(ViewSet):
    """
    UC-RPT-09 – Xem báo cáo bán hàng (36 báo cáo: RPT-0076..0091, RPT-0108..0110, RPT-0113..0114, RPT-0117..0118, RPT-0121..0126, RPT-0128..0129, RPT-0132..0137).
    """

    def catalogue(self, request):
        return Response(sales_report_services.get_sales_catalogue_payload(request=request, user=request.user))

    def report_schema(self, request, report_code=None):
        return Response(sales_report_services.get_sales_report_schema_payload(report_code, request=request, user=request.user))

    def parameters(self, request, report_code=None):
        return Response(sales_report_services.get_sales_report_parameters_payload(report_code, request=request, user=request.user))

    def query_report(self, request, report_code=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(
            sales_report_services.query_sales_report_payload(report_code, params=data, user=request.user, request=request),
            status=status.HTTP_200_OK,
        )

    def run_detail(self, request, run_id=None):
        return Response(sales_report_services.get_sales_run_header_payload(int(run_id), user=request.user, request=request))

    def run_rows(self, request, run_id=None):
        return Response(sales_report_services.get_sales_run_rows_payload(int(run_id), user=request.user, request=request))

    def run_summary(self, request, run_id=None):
        return Response(sales_report_services.get_sales_run_summary_payload(int(run_id), user=request.user, request=request))

    def run_validation(self, request, run_id=None):
        return Response(sales_report_services.get_sales_run_validation_payload(int(run_id), user=request.user, request=request))

    def row_sources(self, request, run_id=None, row_id=None):
        return Response(sales_report_services.get_sales_row_sources_payload(int(run_id), int(row_id), user=request.user, request=request))

    def run_history(self, request, run_id=None):
        return Response(sales_report_services.get_sales_run_history_payload(int(run_id), user=request.user, request=request))

    def saved_filters(self, request):
        report_code = request.query_params.get("report_code")
        return Response(sales_report_services.list_sales_saved_filters_payload(report_code, user=request.user, request=request))

    def save_filter(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(
            sales_report_services.save_sales_filter_payload(data, user=request.user, request=request),
            status=status.HTTP_201_CREATED,
        )

    def order_fulfillment(self, request, order_id=None):
        return Response(sales_report_services.get_order_fulfillment_payload(order_id, user=request.user, request=request))

    def contract_fulfillment(self, request, contract_id=None):
        return Response(sales_report_services.get_contract_fulfillment_payload(contract_id, user=request.user, request=request))

    def profitability(self, request, target_type=None, target_id=None):
        return Response(sales_report_services.get_profitability_payload(target_type, target_id, user=request.user, request=request))

    def run_export(self, request, run_id=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(sales_report_services.export_sales_run_payload(int(run_id), params=data, user=request.user, request=request))


class DebtReportViewSet(ViewSet):
    """
    UC-RPT-10 – Xem báo cáo công nợ (49 báo cáo: 18 AP + 31 AR / Combined).
    """

    def catalogue(self, request):
        return Response(debt_report_services.get_debt_catalogue_payload(request=request, user=request.user))

    def report_schema(self, request, report_code=None):
        return Response(debt_report_services.get_debt_report_schema_payload(report_code, request=request, user=request.user))

    def parameters(self, request, report_code=None):
        return Response(debt_report_services.get_debt_report_parameters_payload(report_code, request=request, user=request.user))

    def query_report(self, request, report_code=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(
            debt_report_services.query_debt_report_payload(report_code, params=data, user=request.user, request=request),
            status=status.HTTP_200_OK,
        )

    def run_detail(self, request, run_id=None):
        return Response(debt_report_services.get_debt_run_header_payload(int(run_id), user=request.user, request=request))

    def run_rows(self, request, run_id=None):
        return Response(debt_report_services.get_debt_run_rows_payload(int(run_id), user=request.user, request=request))

    def run_summary(self, request, run_id=None):
        return Response(debt_report_services.get_debt_run_summary_payload(int(run_id), user=request.user, request=request))

    def run_validation(self, request, run_id=None):
        return Response(debt_report_services.get_debt_run_validation_payload(int(run_id), user=request.user, request=request))

    def row_sources(self, request, run_id=None, row_id=None):
        return Response(debt_report_services.get_debt_row_sources_payload(int(run_id), int(row_id), user=request.user, request=request))

    def run_history(self, request, run_id=None):
        return Response(debt_report_services.get_debt_run_history_payload(int(run_id), user=request.user, request=request))

    def saved_filters(self, request):
        report_code = request.query_params.get("report_code")
        return Response(debt_report_services.list_debt_saved_filters_payload(report_code, user=request.user, request=request))

    def save_filter(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(
            debt_report_services.save_debt_filter_payload(data, user=request.user, request=request),
            status=status.HTTP_201_CREATED,
        )

    def aging_analysis(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        direction = data.get("direction", "AR")
        as_of_raw = data.get("as_of_date")
        as_of = None
        if as_of_raw:
            from datetime import datetime
            as_of = datetime.strptime(as_of_raw, "%Y-%m-%d").date()
        company_id, _ = debt_report_services.resolve_debt_company_scope(request, data)
        rows, summary = debt_report_services._build_aging_analysis(direction, company_id, as_of, data)
        return Response({"rows": rows, "summary": summary}, status=status.HTTP_200_OK)

    def confirmation_document(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        company_id, _ = debt_report_services.resolve_debt_company_scope(request, data)
        partner_id = data.get("partner_id") or "ALL"
        return Response({
            "company_id": company_id,
            "partner_id": partner_id,
            "document_title": "BIÊN BẢN ĐỐI CHIẾU VÀ XÁC NHẬN CÔNG NỢ",
            "status": "DRAFT",
            "as_of_date": data.get("to_date") or data.get("as_of_date"),
        }, status=status.HTTP_200_OK)

    def contract_combined(self, request, contract_id=None):
        params = {"contract_id": contract_id} if contract_id else {}
        company_id, _ = debt_report_services.resolve_debt_company_scope(request, params)
        rows, summary = debt_report_services._build_contract_combined_rpt0139(company_id, params)
        return Response({"rows": rows, "summary": summary}, status=status.HTTP_200_OK)

    def reconciliation_differences(self, request, run_id=None):
        return Response(debt_report_services.get_debt_reconciliation_differences_payload(int(run_id), user=request.user, request=request))

    def run_export(self, request, run_id=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(debt_report_services.export_debt_run_payload(int(run_id), params=data, user=request.user, request=request))


# ============================================================================
# UC-RPT-11 – Money Reports ViewSet
# ============================================================================


class MoneyReportViewSet(ViewSet):
    """
    ViewSet xử lý các báo cáo tiền (UC-RPT-11):
    Tiền mặt, Tiền gửi, Chuyển nội bộ, Khế ước vay & cho vay.
    """

    def catalogue(self, request):
        company_id, _ = money_report_services.resolve_money_company_scope(request, {})
        return Response(money_report_services.get_money_report_catalogue_payload(company_id, user=request.user, request=request))

    def report_schema(self, request, report_code=None):
        return Response(money_report_services.get_money_report_schema_payload(report_code, user=request.user, request=request))

    def parameters(self, request, report_code=None):
        return Response(money_report_services.get_money_report_parameters_payload(report_code, user=request.user, request=request))

    def query_report(self, request, report_code=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(
            money_report_services.query_money_report_payload(report_code, params=data, user=request.user, request=request),
            status=status.HTTP_200_OK,
        )

    def run_details(self, request, run_id=None):
        return Response(money_report_services.get_money_report_run_details(run_id, user=request.user, request=request))

    def run_rows(self, request, run_id=None):
        search = request.query_params.get("search")
        return Response(money_report_services.get_money_report_run_rows(run_id, user=request.user, request=request, search=search))

    def run_summary(self, request, run_id=None):
        return Response(money_report_services.get_money_report_run_summary(run_id, user=request.user, request=request))

    def run_validation(self, request, run_id=None):
        return Response(money_report_services.get_money_report_run_validation(run_id, user=request.user, request=request))

    def row_sources(self, request, run_id=None, row_id=None):
        return Response(money_report_services.get_money_report_row_sources(run_id, int(row_id), user=request.user, request=request))

    def run_history(self, request, run_id=None):
        return Response(money_report_services.get_money_report_run_history(run_id, user=request.user, request=request))

    def balances_as_of(self, request):
        company_id, _ = money_report_services.resolve_money_company_scope(request, {})
        as_of = request.query_params.get("as_of_date")
        comp = request.query_params.get("comparison_date")
        return Response(money_report_services.get_money_balances_as_of(company_id, as_of, comp, user=request.user, request=request))

    def cash_funds(self, request):
        company_id, _ = money_report_services.resolve_money_company_scope(request, {})
        return Response(money_report_services.get_cash_funds_payload(company_id, user=request.user, request=request))

    def bank_accounts(self, request):
        company_id, _ = money_report_services.resolve_money_company_scope(request, {})
        return Response(money_report_services.get_bank_accounts_payload(company_id, user=request.user, request=request))

    def transfer_trace(self, request, transfer_id=None):
        return Response(money_report_services.trace_money_transfer_payload(transfer_id, user=request.user, request=request))

    def loan_summary(self, request, loan_id=None):
        return Response(money_report_services.get_loan_summary_payload(loan_id, user=request.user, request=request))

    def reconciliation_differences(self, request):
        company_id, _ = money_report_services.resolve_money_company_scope(request, {})
        return Response(money_report_services.get_bank_reconciliation_differences_payload(company_id, user=request.user, request=request))

    def list_saved_filters(self, request):
        code = request.query_params.get("report_code")
        return Response(money_report_services.list_money_saved_filters_payload(code, user=request.user, request=request))

    def save_filter(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(money_report_services.save_money_filter_payload(data, user=request.user, request=request), status=status.HTTP_201_CREATED)

    def run_export(self, request, run_id=None):
        data = request.data if isinstance(request.data, dict) else {}
        fmt = data.get("format", "XLSX")
        return Response(money_report_services.export_money_report_run_payload(run_id, fmt=fmt, user=request.user, request=request))


class InventoryReportViewSet(ViewSet):
    """
    ViewSet xử lý 15 báo cáo kho (UC-RPT-12):
    Tổng hợp tồn kho, tồn nhiều kho (bảng chéo), nhiều ĐVT, nhập xuất tồn,
    theo nhóm VTHH, hàng chưa chuyển, sổ chi tiết, sổ chuyển kho nội bộ,
    tiến độ sản xuất, xuất kho theo lệnh SX, đối chiếu sổ cái,
    đối chiếu chi phí mua hàng, đối chiếu thủ kho, đối chiếu giá thành,
    và đối chiếu lắp ráp / tháo dỡ.
    """

    def catalogue(self, request):
        company_id, _ = inventory_report_services.resolve_inventory_company_scope(request, {})
        return Response(inventory_report_services.get_inventory_report_catalogue_payload(company_id, user=request.user, request=request))

    def report_schema(self, request, report_code=None):
        return Response(inventory_report_services.get_inventory_report_schema_payload(report_code, user=request.user, request=request))

    def parameters(self, request, report_code=None):
        return Response(inventory_report_services.get_inventory_report_parameters_payload(report_code, user=request.user, request=request))

    def query_report(self, request, report_code=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(
            inventory_report_services.query_inventory_report_payload(report_code, params=data, user=request.user, request=request),
            status=status.HTTP_200_OK,
        )

    def run_details(self, request, run_id=None):
        return Response(inventory_report_services.get_inventory_report_run_details(run_id, user=request.user, request=request))

    def run_rows(self, request, run_id=None):
        search = request.query_params.get("search")
        return Response(inventory_report_services.get_inventory_report_run_rows(run_id, user=request.user, request=request, search=search))

    def run_summary(self, request, run_id=None):
        return Response(inventory_report_services.get_inventory_report_run_summary(run_id, user=request.user, request=request))

    def run_validation(self, request, run_id=None):
        return Response(inventory_report_services.get_inventory_report_run_validation(run_id, user=request.user, request=request))

    def row_sources(self, request, run_id=None, row_id=None):
        return Response(inventory_report_services.get_inventory_report_row_sources(run_id, int(row_id), user=request.user, request=request))

    def run_history(self, request, run_id=None):
        return Response(inventory_report_services.get_inventory_report_run_history(run_id, user=request.user, request=request))

    def balances_as_of(self, request):
        company_id, _ = inventory_report_services.resolve_inventory_company_scope(request, {})
        as_of = request.query_params.get("as_of_date")
        return Response(inventory_report_services.get_inventory_balances_as_of(company_id, as_of, user=request.user, request=request))

    def list_saved_filters(self, request):
        code = request.query_params.get("report_code")
        return Response(inventory_report_services.list_inventory_saved_filters_payload(code, user=request.user, request=request))

    def save_filter(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(inventory_report_services.save_inventory_filter_payload(data, user=request.user, request=request), status=status.HTTP_201_CREATED)

    def run_export(self, request, run_id=None):
        data = request.data if isinstance(request.data, dict) else {}
        fmt = data.get("format", "XLSX")
        return Response(inventory_report_services.export_inventory_report_run_payload(run_id, fmt=fmt, user=request.user, request=request))


class AssetReportViewSet(ViewSet):
    """
    ViewSet xử lý 14 báo cáo tài sản cố định, CCDC và chi phí trả trước (UC-RPT-13):
    Bảng tính phân bổ CCDC (RPT-0158), Sổ theo dõi CCDC (RPT-0159), Phân bổ CCDC theo năm (RPT-0160),
    Chi tiết giảm CCDC (RPT-0161), CCDC theo đơn vị sử dụng (RPT-0162), Tình hình phân bổ CPTT (RPT-0163),
    Bảng tính phân bổ CPTT (RPT-0164), Phân bổ CPTT theo năm (RPT-0165), Đối chiếu CCDC/CPTT với GL (RPT-0166),
    S21-DN Sổ TSCĐ (RPT-0167), Sổ TSCĐ (RPT-0168), Thẻ TSCĐ (RPT-0169), Khấu hao TSCĐ theo năm (RPT-0170),
    và Đối chiếu TSCĐ với sổ cái (RPT-0171).
    """

    def catalogue(self, request):
        company_id, _ = asset_report_services.resolve_asset_company_scope(request, {})
        return Response(asset_report_services.get_asset_report_catalogue_payload(company_id, user=request.user, request=request))

    def report_schema(self, request, report_code=None):
        return Response(asset_report_services.get_asset_report_schema_payload(report_code, user=request.user, request=request))

    def parameters(self, request, report_code=None):
        return Response(asset_report_services.get_asset_report_parameters_payload(report_code, user=request.user, request=request))

    def query_report(self, request, report_code=None):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(
            asset_report_services.query_asset_report_payload(report_code, params=data, user=request.user, request=request),
            status=status.HTTP_200_OK,
        )

    def run_details(self, request, run_id=None):
        return Response(asset_report_services.get_asset_report_run_details(run_id, user=request.user, request=request))

    def run_rows(self, request, run_id=None):
        search = request.query_params.get("search")
        return Response(asset_report_services.get_asset_report_run_rows(run_id, user=request.user, request=request, search=search))

    def run_summary(self, request, run_id=None):
        return Response(asset_report_services.get_asset_report_run_summary(run_id, user=request.user, request=request))

    def run_validation(self, request, run_id=None):
        return Response(asset_report_services.get_asset_report_run_validation(run_id, user=request.user, request=request))

    def row_sources(self, request, run_id=None, row_id=None):
        return Response(asset_report_services.get_asset_report_row_sources(run_id, int(row_id), user=request.user, request=request))

    def run_history(self, request, run_id=None):
        return Response(asset_report_services.get_asset_report_run_history(run_id, user=request.user, request=request))

    def balances_as_of(self, request):
        company_id, _ = asset_report_services.resolve_asset_company_scope(request, {})
        as_of = request.query_params.get("as_of_date")
        return Response(asset_report_services.get_asset_balances_as_of(company_id, as_of, user=request.user, request=request))

    def list_saved_filters(self, request):
        code = request.query_params.get("report_code")
        return Response(asset_report_services.list_asset_saved_filters_payload(code, user=request.user, request=request))

    def save_filter(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        return Response(asset_report_services.save_asset_filter_payload(data, user=request.user, request=request), status=status.HTTP_201_CREATED)

    def run_export(self, request, run_id=None):
        data = request.data if isinstance(request.data, dict) else {}
        fmt = data.get("format", "XLSX")
        return Response(asset_report_services.export_asset_report_run_payload(run_id, fmt=fmt, user=request.user, request=request))


class UnifiedExportViewSet(ViewSet):
    """
    UC-RPT-15: In hoặc Export báo cáo (Print & Export Engine).
    Hệ thống kết xuất và in ấn dùng chung cho các phân hệ UC-RPT-01 đến UC-RPT-14.
    """
    permission_classes = ()

    def _resolve_company(self, request):
        company_id = (
            request.query_params.get("company_id")
            or (request.data.get("company_id") if isinstance(request.data, dict) else None)
            or (request.data.get("company") if isinstance(request.data, dict) else None)
        )
        if company_id:
            comp = Company.objects.filter(pk=company_id).first()
            if comp:
                return comp
        return Company.objects.first()

    def _get_company_id(self, request):
        company_id = (
            request.query_params.get("company_id")
            or (request.data.get("company_id") if isinstance(request.data, dict) else None)
            or (request.data.get("company") if isinstance(request.data, dict) else None)
        )
        if company_id:
            return str(company_id)
        comp = Company.objects.first()
        return str(comp.id) if comp else "DEFAULT-COMPANY"

    def capabilities(self, request, report_code=None):
        caps = unified_export_services.get_export_capabilities(report_code)
        return Response(caps)

    def templates(self, request, report_code=None):
        tpls = unified_export_services.get_export_templates(report_code)
        return Response(tpls)

    def _resolve_data(self, request):
        if hasattr(request.data, "dict"):
            return request.data.dict()
        if hasattr(request.data, "copy"):
            return request.data.copy()
        return dict(request.data or {})

    def preview(self, request):
        company_id = self._get_company_id(request)
        data = self._resolve_data(request)
        dataset = unified_export_services.resolve_export_dataset(company_id, data, user=request.user)
        preview_html = unified_export_services.generate_print_html(dataset, data.get("options", {}))
        return Response({
            "report_code": dataset["report_code"],
            "title": dataset["title"],
            "preview_html": preview_html,
            "row_count": len(dataset.get("rows", [])),
            "column_count": len(dataset.get("columns", [])),
        })

    def create_job(self, request):
        company_id = self._get_company_id(request)
        data = self._resolve_data(request)
        result = unified_export_services.create_export_job(company_id, request.user, data, request=request)
        return Response(result, status=status.HTTP_201_CREATED if result.get("status") == "QUEUED" else status.HTTP_200_OK)

    def list_jobs(self, request):
        company_id = self._get_company_id(request)
        history = unified_export_services.get_export_history(company_id, request.user)
        return Response(history)

    def job_detail(self, request, id=None):
        company_id = self._get_company_id(request)
        result = unified_export_services.get_export_job(id, request.user, company_id=company_id)
        return Response(result)

    def job_artifacts(self, request, id=None):
        company_id = self._get_company_id(request)
        result = unified_export_services.get_export_job(id, request.user, company_id=company_id)
        return Response({"artifacts": [result["artifact"]] if result.get("artifact") else []})

    def job_cancel(self, request, id=None):
        company_id = self._get_company_id(request)
        result = unified_export_services.cancel_export_job(id, request.user, company_id=company_id)
        return Response(result)

    def job_retry(self, request, id=None):
        company_id = self._get_company_id(request)
        data = self._resolve_data(request)
        result = unified_export_services.create_export_job(company_id, request.user, data, request=request)
        return Response(result)

    def download_access(self, request, id=None):
        company_id = self._get_company_id(request)
        artifact = ReportExportArtifact.objects.filter(pk=id, company_id=company_id).first()
        if not artifact:
            return Response({"detail": "Không tìm thấy Artifact."}, status=status.HTTP_404_NOT_FOUND)
        if artifact.file_status == "EXPIRED":
            return Response({"detail": "Tệp đã hết hạn."}, status=status.HTTP_410_GONE)
        return Response({
            "artifact_id": str(artifact.id),
            "download_token": artifact.download_token,
            "expires_at": artifact.expires_at.isoformat() if artifact.expires_at else None,
            "download_url": f"/api/v1/reports/export/artifacts/{artifact.id}/download/?token={artifact.download_token}",
        })

    def download_artifact(self, request, id=None):
        token = request.query_params.get("token")
        try:
            file_path, file_name, mime_type, file_size = unified_export_services.verify_and_download_artifact(
                id, request.user, token=token, request=request
            )
            with open(file_path, "rb") as f:
                content = f.read()
            response = HttpResponse(content, content_type=mime_type)
            response["Content-Disposition"] = f'attachment; filename="{file_name}"'
            response["Content-Length"] = len(content)
            return response
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def history(self, request):
        company_id = self._get_company_id(request)
        history = unified_export_services.get_export_history(company_id, request.user)
        return Response(history)

    def export_detail(self, request):
        company_id = self._get_company_id(request)
        data = self._resolve_data(request)
        data["export_scope"] = "DRILLDOWN_NODE"
        result = unified_export_services.create_export_job(company_id, request.user, data, request=request)
        return Response(result)


class DrilldownViewSet(ViewSet):
    """
    UC-RPT-14: Universal Report Data Drill-Down & Lineage ViewSet.
    Cung cấp các API truy vết chi tiết số liệu dùng chung cho toàn bộ các nhóm báo cáo.
    """
    permission_classes = ()

    def _resolve_company(self, request):
        company_id = (
            request.query_params.get("company_id")
            or (request.data.get("company_id") if isinstance(request.data, dict) else None)
            or (request.data.get("company") if isinstance(request.data, dict) else None)
        )
        if company_id:
            comp = Company.objects.filter(pk=company_id).first()
            if comp:
                return comp
        return Company.objects.first()

    def _get_company_id(self, request):
        company_id = (
            request.query_params.get("company_id")
            or (request.data.get("company_id") if isinstance(request.data, dict) else None)
            or (request.data.get("company") if isinstance(request.data, dict) else None)
        )
        if company_id:
            return str(company_id)
        comp = Company.objects.first()
        return str(comp.id) if comp else "DEFAULT-COMPANY"

    def _resolve_data(self, request):
        if hasattr(request.data, "dict"):
            return request.data.dict()
        if hasattr(request.data, "copy"):
            return request.data.copy()
        return dict(request.data or {})

    def capabilities(self, request, report_code=None):
        caps = drilldown_services.get_drilldown_capabilities(report_code)
        return Response(caps)

    def open_context(self, request):
        try:
            company_id = self._get_company_id(request)
            data = self._resolve_data(request)
            result = drilldown_services.open_cell_context(company_id, request.user, data, request=request)
            return Response(result, status=status.HTTP_200_OK)
        except PermissionDenied as pe:
            return Response({"detail": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)

    def query_node(self, request):
        try:
            company_id = self._get_company_id(request)
            data = self._resolve_data(request)
            context_id = data.get("context_id")
            node_key = data.get("node_key")
            result = drilldown_services.query_drilldown_node(context_id, request.user, node_key, company_id=company_id)
            return Response(result)
        except PermissionDenied as pe:
            return Response({"detail": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_404_NOT_FOUND if "Không tìm thấy" in str(ve) else status.HTTP_400_BAD_REQUEST)

    def cell_formula(self, request, context_id=None):
        company_id = self._get_company_id(request)
        ctx = ReportCellContext.objects.filter(pk=context_id, company_id=company_id).first()
        if not ctx:
            return Response({"detail": "Không tìm thấy Cell Context."}, status=status.HTTP_404_NOT_FOUND)
        comps = list(ctx.contributions.all().values("component_key", "component_name", "raw_value", "sign_multiplier", "contribution_value"))
        return Response({
            "context_id": str(ctx.id),
            "formula_expression": ctx.formula_expression,
            "drilldown_type": ctx.drilldown_type,
            "components": comps,
        })

    def cell_summary(self, request, context_id=None):
        company_id = self._get_company_id(request)
        ctx = ReportCellContext.objects.filter(pk=context_id, company_id=company_id).first()
        if not ctx:
            return Response({"detail": "Không tìm thấy Cell Context."}, status=status.HTTP_404_NOT_FOUND)
        comps = list(ctx.contributions.all().values("component_key", "component_name", "contribution_value"))
        return Response({
            "context_id": str(ctx.id),
            "indicator_code": ctx.indicator_code,
            "indicator_name": ctx.indicator_name,
            "display_value": float(ctx.display_value),
            "components": comps,
        })

    def cell_transactions(self, request, context_id=None):
        try:
            company_id = self._get_company_id(request)
            page = int(request.query_params.get("page", 1))
            page_size = int(request.query_params.get("page_size", 50))
            result = drilldown_services.get_cell_transactions(context_id, request.user, page=page, page_size=page_size, company_id=company_id)
            return Response(result)
        except PermissionDenied as pe:
            return Response({"detail": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_404_NOT_FOUND if "Không tìm thấy" in str(ve) else status.HTTP_400_BAD_REQUEST)

    def cell_sources(self, request, context_id=None):
        try:
            company_id = self._get_company_id(request)
            result = drilldown_services.get_cell_transactions(context_id, request.user, page=1, page_size=100, company_id=company_id)
            return Response(result)
        except PermissionDenied as pe:
            return Response({"detail": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_404_NOT_FOUND if "Không tìm thấy" in str(ve) else status.HTTP_400_BAD_REQUEST)

    def open_source(self, request, context_id=None, source_id=None):
        try:
            company_id = self._get_company_id(request)
            result = drilldown_services.open_source_document(context_id, request.user, source_id, company_id=company_id)
            return Response(result)
        except PermissionDenied as pe:
            return Response({"detail": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_404_NOT_FOUND if "Không tìm thấy" in str(ve) else status.HTTP_400_BAD_REQUEST)

    def cell_adjustments(self, request, context_id=None):
        company_id = self._get_company_id(request)
        ctx = ReportCellContext.objects.filter(pk=context_id, company_id=company_id).first()
        if not ctx:
            return Response({"detail": "Không tìm thấy Cell Context."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "context_id": str(ctx.id),
            "adjustments": [],
            "message": "Không có điều chỉnh ngoại lệ phát sinh cho chỉ tiêu này.",
        })

    def cell_validation(self, request, context_id=None):
        company_id = self._get_company_id(request)
        ctx = ReportCellContext.objects.filter(pk=context_id, company_id=company_id).first()
        if not ctx:
            return Response({"detail": "Không tìm thấy Cell Context."}, status=status.HTTP_404_NOT_FOUND)
        contrib_sum = ctx.contributions.aggregate(total=Sum("contribution_value"))["total"] or Decimal("0")
        diff = ctx.display_value - contrib_sum
        status_val = "MATCHED" if abs(diff) < Decimal("0.0001") else "DIFFERENCE"
        return Response({
            "context_id": str(ctx.id),
            "reported_value": float(ctx.display_value),
            "calculated_value": float(contrib_sum),
            "difference": float(diff),
            "status": status_val,
        })

    def cell_breadcrumbs(self, request, context_id=None):
        company_id = self._get_company_id(request)
        ctx = ReportCellContext.objects.filter(pk=context_id, company_id=company_id).first()
        if not ctx:
            return Response({"detail": "Không tìm thấy Cell Context."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "breadcrumbs": [
                {"level": 0, "title": ctx.report_code, "action": "ROOT_REPORT"},
                {"level": 1, "title": f"{ctx.indicator_code} - {ctx.indicator_name}", "action": "CELL_CONTEXT"},
            ]
        })

    def drill_through(self, request):
        try:
            company_id = self._get_company_id(request)
            data = self._resolve_data(request)
            result = drilldown_services.drill_through_report(company_id, request.user, data)
            return Response(result)
        except PermissionDenied as pe:
            return Response({"detail": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)













