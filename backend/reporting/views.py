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
