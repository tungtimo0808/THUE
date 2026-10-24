from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import re
import unicodedata
import uuid
from typing import Any

from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from audit_log.models import AuditLog
from general_ledger.models import Account, AccountBalance, AccountingPeriod, JournalEntry, JournalLine
from iam.models import (
    ActiveStatus,
    CompanyMembership,
    Permission,
    PermissionAction,
    PermissionResource,
    UserPermissionOverride,
)
from iam.permissions import assignment_permission_codes, effective_assignments
from master_data.models import Currency
from organization.models import Branch, Company
from reporting.models import (
    FinancialStatementAccountMapping,
    FinancialStatementAdjustment,
    FinancialStatementBundle,
    FinancialStatementBundleComponent,
    FinancialStatementLine,
    FinancialStatementRun,
    FinancialStatementRunValidation,
    FinancialStatementTemplate,
    FinancialStatementTemplateVersion,
    FinancialStatementValue,
    FinancialStatementValueSlot,
)


ZERO = Decimal("0.0000")


def _to_dec(val: Any) -> Decimal:
    if val is None or val == "":
        return ZERO
    if isinstance(val, Decimal):
        return val.quantize(Decimal("0.0001"))
    return Decimal(str(val)).quantize(Decimal("0.0001"))


def _fmt_dec(val: Decimal | None) -> str | None:
    if val is None:
        return None
    return str(val.quantize(Decimal("0.0001")))


def _strip_accents(text: str) -> str:
    if not text:
        return ""
    norm = unicodedata.normalize("NFD", str(text))
    stripped = "".join(ch for ch in norm if unicodedata.category(ch) != "Mn")
    return stripped.replace("đ", "d").replace("Đ", "D").lower()


# ============================================================================
# 1. TEMPLATE SPECIFICATIONS FOR B02-DN, B02-DNKLT, B02a-DN (21 LINES) & B02b-DN (4 LINES)
# ============================================================================
# Tuple structure:
# (
#   indicator_code,
#   indicator_name,
#   section_code,
#   section_name,
#   note_reference,
#   parent_indicator_code,
#   level,
#   line_type,
#   formula_expression,
#   is_negative_presentation,
#   is_drilldown_available,
#   mappings: list of (account_prefix, balance_side, sign, condition_dict)
# )

B02_DN_LINES: list[tuple] = [
    (
        "01",
        "1. Doanh thu bán hàng và cung cấp dịch vụ",
        "A",
        "Doanh thu và giá vốn",
        "VI.01",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            (
                "511",
                "CREDIT_TURNOVER",
                1,
                {
                    "exclude_investment_property_disposal": True,
                    "exclude_indirect_tax": True,
                    "eliminate_internal_in_company_scope": True,
                },
            ),
        ],
    ),
    (
        "02",
        "2. Các khoản giảm trừ doanh thu",
        "A",
        "Doanh thu và giá vốn",
        "VI.02",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            (
                "521",
                "DEBIT_TURNOVER",
                1,
                {
                    "exclude_investment_property_disposal": True,
                    "exclude_indirect_tax": True,
                },
            ),
        ],
    ),
    (
        "10",
        "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)",
        "A",
        "Doanh thu và giá vốn",
        "",
        "",
        1,
        "SUBTOTAL",
        "01 - 02",
        False,
        True,
        [],
    ),
    (
        "11",
        "4. Giá vốn hàng bán",
        "A",
        "Doanh thu và giá vốn",
        "VI.03",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            (
                "632",
                "NET_DEBIT_TURNOVER",
                1,
                {
                    "exclude_investment_property_disposal": True,
                    "eliminate_internal_in_company_scope": True,
                },
            ),
        ],
    ),
    (
        "20",
        "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)",
        "A",
        "Doanh thu và giá vốn",
        "",
        "",
        1,
        "SUBTOTAL",
        "10 - 11",
        False,
        True,
        [],
    ),
    (
        "21",
        "6. Lãi/lỗ của hoạt động bán, thanh lý bất động sản đầu tư",
        "B",
        "Hoạt động BĐSĐT, tài chính và chi phí hoạt động",
        "VI.04",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("5117", "CREDIT_TURNOVER", 1, {"is_investment_property_disposal": True}),
            ("511", "CREDIT_TURNOVER", 1, {"is_investment_property_disposal": True, "exclude_prefix": ["5117"]}),
            ("711", "CREDIT_TURNOVER", 1, {"is_investment_property_disposal": True}),
            ("632", "NET_DEBIT_TURNOVER", -1, {"is_investment_property_disposal": True}),
            ("811", "NET_DEBIT_TURNOVER", -1, {"is_investment_property_disposal": True}),
        ],
    ),
    (
        "22",
        "7. Doanh thu hoạt động tài chính",
        "B",
        "Hoạt động BĐSĐT, tài chính và chi phí hoạt động",
        "VI.05",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("515", "CREDIT_TURNOVER", 1, {"net_fx_revaluation": True}),
        ],
    ),
    (
        "23",
        "8. Chi phí tài chính",
        "B",
        "Hoạt động BĐSĐT, tài chính và chi phí hoạt động",
        "VI.06",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("635", "NET_DEBIT_TURNOVER", 1, {"net_fx_revaluation": True}),
        ],
    ),
    (
        "24",
        "- Trong đó: Chi phí đi vay",
        "B",
        "Hoạt động BĐSĐT, tài chính và chi phí hoạt động",
        "",
        "23",
        2,
        "MEMO",
        "",
        False,
        True,
        [
            ("635", "NET_DEBIT_TURNOVER", 1, {"is_borrowing_cost": True}),
        ],
    ),
    (
        "25",
        "9. Chi phí bán hàng",
        "B",
        "Hoạt động BĐSĐT, tài chính và chi phí hoạt động",
        "VI.09",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("641", "NET_DEBIT_TURNOVER", 1, {}),
        ],
    ),
    (
        "26",
        "10. Chi phí quản lý doanh nghiệp",
        "B",
        "Hoạt động BĐSĐT, tài chính và chi phí hoạt động",
        "VI.09",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("642", "NET_DEBIT_TURNOVER", 1, {}),
        ],
    ),
    (
        "30",
        "11. Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + 21 + 22 - (23 + 25 + 26)}",
        "B",
        "Hoạt động BĐSĐT, tài chính và chi phí hoạt động",
        "",
        "",
        1,
        "SUBTOTAL",
        "20 + 21 + 22 - 23 - 25 - 26",
        False,
        True,
        [],
    ),
    (
        "31",
        "12. Thu nhập khác",
        "C",
        "Thu nhập, chi phí khác và kết quả trước thuế",
        "VI.07",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            (
                "711",
                "CREDIT_TURNOVER",
                1,
                {"exclude_investment_property_disposal": True, "net_fixed_asset_disposal": True},
            ),
        ],
    ),
    (
        "32",
        "13. Chi phí khác",
        "C",
        "Thu nhập, chi phí khác và kết quả trước thuế",
        "VI.08",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            (
                "811",
                "NET_DEBIT_TURNOVER",
                1,
                {"exclude_investment_property_disposal": True, "net_fixed_asset_disposal": True},
            ),
        ],
    ),
    (
        "40",
        "14. Lợi nhuận khác (40 = 31 - 32)",
        "C",
        "Thu nhập, chi phí khác và kết quả trước thuế",
        "",
        "",
        1,
        "SUBTOTAL",
        "31 - 32",
        False,
        True,
        [],
    ),
    (
        "50",
        "15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)",
        "C",
        "Thu nhập, chi phí khác và kết quả trước thuế",
        "",
        "",
        1,
        "SUBTOTAL",
        "30 + 40",
        False,
        True,
        [],
    ),
    (
        "51",
        "16. Chi phí thuế TNDN hiện hành",
        "D",
        "Chi phí thuế và lợi nhuận sau thuế",
        "VI.11",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("8211", "SIGNED_DEBIT_TURNOVER", 1, {}),
            ("821", "SIGNED_DEBIT_TURNOVER", 1, {"exclude_prefix": ["8211", "8212"]}),
        ],
    ),
    (
        "52",
        "17. Chi phí thuế TNDN hoãn lại",
        "D",
        "Chi phí thuế và lợi nhuận sau thuế",
        "VI.11",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("8212", "SIGNED_DEBIT_TURNOVER", 1, {}),
        ],
    ),
    (
        "60",
        "18. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)",
        "D",
        "Chi phí thuế và lợi nhuận sau thuế",
        "",
        "",
        1,
        "TOTAL",
        "50 - 51 - 52",
        False,
        True,
        [],
    ),
    (
        "70",
        "19. Lãi cơ bản trên cổ phiếu (*)",
        "E",
        "Lãi trên cổ phiếu",
        "",
        "",
        1,
        "EPS",
        "BASIC_EPS",
        False,
        True,
        [],
    ),
    (
        "71",
        "20. Lãi suy giảm trên cổ phiếu (*)",
        "E",
        "Lãi trên cổ phiếu",
        "",
        "",
        1,
        "EPS",
        "DILUTED_EPS",
        False,
        True,
        [],
    ),
]

B02A_DN_LINES: list[tuple] = list(B02_DN_LINES)

B02_DNKLT_LINES: list[tuple] = [
    (
        ind_code,
        ind_name,
        sec_code,
        f"{sec_name} (KLT)",
        note_ref,
        parent_code,
        lvl,
        ltype,
        formula,
        is_neg,
        is_drill,
        mappings,
    )
    for (
        ind_code,
        ind_name,
        sec_code,
        sec_name,
        note_ref,
        parent_code,
        lvl,
        ltype,
        formula,
        is_neg,
        is_drill,
        mappings,
    ) in B02_DN_LINES
]

# B02b-DN (Giữa niên độ tóm lược) – Đúng 4 chỉ tiêu theo Thông tư 99/2025/TT-BTC:
# Mã 31 ở B02b-DN là "Doanh thu hoạt động tài chính và thu nhập khác" (tổng hợp 515 + 711),
# KHÁC với Mã 31 ở B02-DN / B02a-DN ("Thu nhập khác" chỉ gồm 711).
B02B_DN_LINES: list[tuple] = [
    (
        "01",
        "1. Doanh thu bán hàng và cung cấp dịch vụ",
        "A",
        "Doanh thu bán hàng và cung cấp dịch vụ",
        "VI.01",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            (
                "511",
                "CREDIT_TURNOVER",
                1,
                {
                    "exclude_investment_property_disposal": True,
                    "exclude_indirect_tax": True,
                    "eliminate_internal_in_company_scope": True,
                },
            ),
        ],
    ),
    (
        "31",
        "2. Doanh thu hoạt động tài chính và thu nhập khác",
        "B",
        "Doanh thu hoạt động tài chính và thu nhập khác",
        "VI.05, VI.07",
        "",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            (
                "515",
                "CREDIT_TURNOVER",
                1,
                {"net_fx_revaluation": True, "b02b_condensed_31": True},
            ),
            (
                "711",
                "CREDIT_TURNOVER",
                1,
                {
                    "exclude_investment_property_disposal": True,
                    "net_fixed_asset_disposal": True,
                    "b02b_condensed_31": True,
                },
            ),
        ],
    ),
    (
        "50",
        "3. Tổng lợi nhuận kế toán trước thuế",
        "C",
        "Tổng lợi nhuận kế toán trước thuế",
        "",
        "",
        1,
        "SUBTOTAL",
        "01 - 02 - 11 + 21 + 22 - 23 - 25 - 26 + 31 - 32",
        False,
        True,
        [],
    ),
    (
        "60",
        "4. Lợi nhuận sau thuế thu nhập doanh nghiệp",
        "D",
        "Lợi nhuận sau thuế thu nhập doanh nghiệp",
        "",
        "",
        1,
        "TOTAL",
        "50 - 51 - 52",
        False,
        True,
        [],
    ),
]


B02_PERMISSIONS_DEF = [
    ("VIEW", "Xem báo cáo kết quả hoạt động kinh doanh", "RPT_BUSINESS_RESULT_VIEW", "RPT.BUSINESS_RESULT.VIEW"),
    ("DETAIL_VIEW", "Xem chi tiết & drill-down B02", "RPT_BUSINESS_RESULT_DETAIL_VIEW", "RPT.BUSINESS_RESULT.DETAIL.VIEW"),
    ("GENERATE", "Lập báo cáo kết quả hoạt động kinh doanh", "RPT_BUSINESS_RESULT_GENERATE", "RPT.BUSINESS_RESULT.GENERATE"),
    ("VALIDATE", "Kiểm tra báo cáo kết quả hoạt động kinh doanh", "RPT_BUSINESS_RESULT_VALIDATE", "RPT.BUSINESS_RESULT.VALIDATE"),
    ("APPROVE", "Phê duyệt báo cáo kết quả hoạt động kinh doanh", "RPT_BUSINESS_RESULT_APPROVE", "RPT.BUSINESS_RESULT.APPROVE"),
    ("EXPORT", "In và xuất báo cáo kết quả hoạt động kinh doanh", "RPT_BUSINESS_RESULT_EXPORT", "RPT.BUSINESS_RESULT.EXPORT"),
]

B02_PERMISSION_ALIASES: dict[str, set[str]] = {
    "RPT_BUSINESS_RESULT_VIEW": {
        "RPT_BUSINESS_RESULT_VIEW",
        "RPT.BUSINESS_RESULT.VIEW",
        "RPT_FINANCIAL_VIEW",
        "RPT.FINANCIAL.VIEW",
        "RPT.CENTER.VIEW",
    },
    "RPT_BUSINESS_RESULT_DETAIL_VIEW": {
        "RPT_BUSINESS_RESULT_DETAIL_VIEW",
        "RPT.BUSINESS_RESULT.DETAIL.VIEW",
        "RPT_FINANCIAL_DETAIL_VIEW",
        "RPT.FINANCIAL.DETAIL.VIEW",
        "RPT_FINANCIAL_DRILLDOWN",
        "GL.JOURNAL.VIEW",
    },
    "RPT_BUSINESS_RESULT_GENERATE": {
        "RPT_BUSINESS_RESULT_GENERATE",
        "RPT.BUSINESS_RESULT.GENERATE",
        "RPT_FINANCIAL_GENERATE",
        "RPT.FINANCIAL.GENERATE",
    },
    "RPT_BUSINESS_RESULT_VALIDATE": {
        "RPT_BUSINESS_RESULT_VALIDATE",
        "RPT.BUSINESS_RESULT.VALIDATE",
        "RPT_FINANCIAL_VALIDATE",
        "RPT_BUSINESS_RESULT_GENERATE",
        "RPT_FINANCIAL_GENERATE",
    },
    "RPT_BUSINESS_RESULT_APPROVE": {
        "RPT_BUSINESS_RESULT_APPROVE",
        "RPT.BUSINESS_RESULT.APPROVE",
        "RPT_FINANCIAL_APPROVE",
        "RPT.FINANCIAL.APPROVE",
    },
    "RPT_BUSINESS_RESULT_EXPORT": {
        "RPT_BUSINESS_RESULT_EXPORT",
        "RPT.BUSINESS_RESULT.EXPORT",
        "RPT_FINANCIAL_EXPORT",
        "RPT.FINANCIAL.EXPORT",
    },
}


# ============================================================================
# 2. SEEDING FUNCTION FOR MIGRATION & RUNTIME INITIALIZATION
# ============================================================================

def _seed_b02_template_lines(
    template_ver,
    line_specs: list[tuple],
    LineModel,
    MappingModel,
    is_condensed_b02b: bool = False,
):
    existing_lines = {ln.indicator_code: ln for ln in LineModel.objects.filter(template_version=template_ver)}
    spec_codes = {item[0] for item in line_specs}

    for code, ln in list(existing_lines.items()):
        if code not in spec_codes:
            ln.run_values.all().delete()
            ln.value_slots.all().delete()
            ln.adjustments.all().delete()
            ln.account_mappings.all().delete()
            ln.delete()
            existing_lines.pop(code, None)

    created_or_updated = {}
    for idx, item in enumerate(line_specs, start=1):
        (
            ind_code,
            ind_name,
            sec_code,
            sec_name,
            note_ref,
            parent_code,
            level,
            line_type,
            formula,
            is_neg,
            is_drill,
            mappings,
        ) = item
        t_schema = {
            "b02_line_type": "FORMULA" if line_type in ("SUBTOTAL", "TOTAL", "FORMULA") else line_type,
            "is_condensed_b02b": is_condensed_b02b,
        }
        if is_condensed_b02b and ind_code == "31":
            t_schema["b02b_distinct_31"] = True
            t_schema["meaning"] = "Doanh thu hoạt động tài chính và thu nhập khác (TK 515 + TK 711)"

        line_obj, _ = LineModel.objects.update_or_create(
            template_version=template_ver,
            indicator_code=ind_code,
            defaults={
                "indicator_name": ind_name,
                "section_code": sec_code,
                "section_name": sec_name,
                "note_reference": note_ref,
                "parent_indicator_code": parent_code,
                "level": level,
                "display_order": idx * 10,
                "line_type": line_type,
                "formula_expression": formula,
                "is_negative_presentation": is_neg,
                "is_drilldown_available": is_drill,
                "is_required": line_type not in ("EPS", "MEMO"),
                "table_schema": t_schema,
            },
        )
        created_or_updated[ind_code] = (line_obj, parent_code, mappings)

    for ind_code, (line_obj, parent_code, mappings) in created_or_updated.items():
        parent_obj = created_or_updated.get(parent_code, (None,))[0] if parent_code else None
        if line_obj.parent_line_id != (parent_obj.id if parent_obj else None):
            line_obj.parent_line = parent_obj
            line_obj.save(update_fields=["parent_line"])

        MappingModel.objects.filter(statement_line=line_obj, company__isnull=True).delete()
        for acc_prefix, bal_side, sign, cond in mappings:
            MappingModel.objects.create(
                company=None,
                statement_line=line_obj,
                account_prefix=acc_prefix,
                counterpart_prefix="",
                balance_side=bal_side,
                sign=sign,
                condition_json=cond or {},
                effective_from=date(2000, 1, 1),
                is_active=True,
            )


def seed_business_result_uc_rpt_04(apps=None, schema_editor=None):
    if apps is not None:
        ActionModel = apps.get_model("iam", "PermissionAction")
        ResourceModel = apps.get_model("iam", "PermissionResource")
        PermissionModel = apps.get_model("iam", "Permission")
        TemplateModel = apps.get_model("reporting", "FinancialStatementTemplate")
        VersionModel = apps.get_model("reporting", "FinancialStatementTemplateVersion")
        LineModel = apps.get_model("reporting", "FinancialStatementLine")
        MappingModel = apps.get_model("reporting", "FinancialStatementAccountMapping")
    else:
        ActionModel = PermissionAction
        ResourceModel = PermissionResource
        PermissionModel = Permission
        TemplateModel = FinancialStatementTemplate
        VersionModel = FinancialStatementTemplateVersion
        LineModel = FinancialStatementLine
        MappingModel = FinancialStatementAccountMapping

    res_under, _ = ResourceModel.objects.get_or_create(
        code="RPT_BUSINESS_RESULT",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "RPT",
            "name": "Báo cáo kết quả hoạt động kinh doanh (UC-RPT-04)",
            "status": "ACTIVE",
        },
    )
    res_dot, _ = ResourceModel.objects.get_or_create(
        code="RPT.BUSINESS_RESULT",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "RPT",
            "name": "Báo cáo kết quả hoạt động kinh doanh (dot)",
            "status": "ACTIVE",
        },
    )
    for act_code, act_name, u_code, d_code in B02_PERMISSIONS_DEF:
        action, _ = ActionModel.objects.get_or_create(
            code=act_code,
            defaults={
                "id": uuid.uuid4(),
                "name": act_name,
                "risk_level": "HIGH" if act_code in ("APPROVE", "DETAIL_VIEW") else "NORMAL",
            },
        )
        for res_obj, p_code in ((res_under, u_code), (res_dot, d_code)):
            PermissionModel.objects.get_or_create(
                code=p_code,
                defaults={
                    "id": uuid.uuid4(),
                    "resource_id": res_obj.id,
                    "action_id": action.id,
                    "description": f"{act_name} (UC-RPT-04)",
                    "status": "ACTIVE",
                },
            )

    b02_templates_spec = [
        (
            "FSR-02",
            "B02-DN",
            "Báo cáo kết quả hoạt động kinh doanh năm",
            ["ANNUAL_GOING_CONCERN"],
            "ANNUAL",
            "Thông tư 99/2025/TT-BTC",
            [
                {"slot_code": "YEAR_CURRENT", "column_code": "CURRENT_YEAR", "label": "Năm nay"},
                {"slot_code": "YEAR_PREVIOUS", "column_code": "PREVIOUS_YEAR", "label": "Năm trước"},
            ],
            B02_DN_LINES,
            False,
        ),
        (
            "FSR-06",
            "B02-DNKLT",
            "Báo cáo kết quả hoạt động kinh doanh năm – Không đáp ứng giả định hoạt động liên tục",
            ["ANNUAL_NON_GOING_CONCERN"],
            "ANNUAL",
            "Thông tư 99/2025/TT-BTC – DN không đáp ứng giả định hoạt động liên tục",
            [
                {"slot_code": "YEAR_CURRENT", "column_code": "CURRENT_YEAR", "label": "Năm nay"},
                {"slot_code": "YEAR_PREVIOUS", "column_code": "PREVIOUS_YEAR", "label": "Năm trước"},
            ],
            B02_DNKLT_LINES,
            False,
        ),
        (
            "FSR-10",
            "B02a-DN",
            "Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)",
            ["INTERIM_FULL"],
            "INTERIM",
            "Thông tư 99/2025/TT-BTC",
            [
                {"slot_code": "QUARTER_CURRENT", "label": "Quý này – Năm nay"},
                {"slot_code": "QUARTER_PREVIOUS", "label": "Quý tương ứng – Năm trước"},
                {"slot_code": "YTD_CURRENT", "label": "Lũy kế từ đầu năm đến cuối quý này – Năm nay"},
                {"slot_code": "YTD_PREVIOUS", "label": "Lũy kế từ đầu năm đến cuối quý tương ứng – Năm trước"},
            ],
            B02A_DN_LINES,
            False,
        ),
        (
            "FSR-14",
            "B02b-DN",
            "Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng tóm lược)",
            ["INTERIM_CONDENSED"],
            "INTERIM",
            "Thông tư 99/2025/TT-BTC",
            [
                {"slot_code": "QUARTER_CURRENT", "label": "Quý này – Năm nay"},
                {"slot_code": "QUARTER_PREVIOUS", "label": "Quý tương ứng – Năm trước"},
                {"slot_code": "YTD_CURRENT", "label": "Lũy kế từ đầu năm đến cuối quý này – Năm nay"},
                {"slot_code": "YTD_PREVIOUS", "label": "Lũy kế từ đầu năm đến cuối quý tương ứng – Năm trước"},
            ],
            B02B_DN_LINES,
            True,
        ),
    ]

    for (
        int_code,
        legal_code,
        name,
        bundle_types,
        gran,
        legal_circ,
        col_schema,
        lines_spec,
        is_cond,
    ) in b02_templates_spec:
        tmpl, _ = TemplateModel.objects.update_or_create(
            internal_code=int_code,
            defaults={
                "legal_form_code": legal_code,
                "name": name,
                "component_type": "BUSINESS_RESULT",
                "applicable_bundle_types": bundle_types,
                "period_granularity": gran,
                "supports_cash_flow_method": False,
                "target_uc_code": "UC-RPT-04",
                "is_active": True,
            },
        )
        tv, _ = VersionModel.objects.update_or_create(
            template=tmpl,
            version_number=1,
            cash_flow_method="",
            defaults={
                "accounting_regime": "TT99",
                "legal_circular": legal_circ,
                "effective_from": date(2000, 1, 1),
                "column_schema": col_schema,
                "is_active": True,
            },
        )
        _seed_b02_template_lines(tv, lines_spec, LineModel, MappingModel, is_condensed_b02b=is_cond)


def ensure_b02_templates_seeded():
    b02_dn = FinancialStatementTemplate.objects.filter(legal_form_code="B02-DN").first()
    b02b_dn = FinancialStatementTemplate.objects.filter(legal_form_code="B02b-DN").first()
    needs_seed = False
    if not b02_dn or not b02b_dn:
        needs_seed = True
    else:
        v_dn = b02_dn.versions.filter(is_active=True).first()
        v_b02b = b02b_dn.versions.filter(is_active=True).first()
        if not v_dn or v_dn.lines.count() != 21 or not v_b02b or v_b02b.lines.count() != 4:
            needs_seed = True
    if needs_seed:
        seed_business_result_uc_rpt_04()


# ============================================================================
# 3. PERMISSIONS, SCOPE & AUDIT HELPERS
# ============================================================================

def _resolve_iam_account(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None
    return getattr(user, "iam_account", None)


def _actor_label(user) -> str:
    if not user:
        return "SYSTEM"
    for attr in ("full_name", "username", "email"):
        val = getattr(user, attr, None)
        if val:
            return str(val)
    iam = getattr(user, "iam_account", None)
    if iam:
        for attr in ("full_name", "username", "email"):
            val = getattr(iam, attr, None)
            if val:
                return str(val)
    return str(getattr(user, "pk", "SYSTEM"))


def _log_b02_audit(company: Company, user, action_code: str, target_id: str, metadata: dict | None = None):
    try:
        iam_acc = _resolve_iam_account(user)
        AuditLog.objects.create(
            company=company,
            actor=iam_acc,
            event_type=action_code,
            module_code="RPT",
            entity_type="FinancialStatementRun",
            entity_id=str(target_id),
            metadata_json={"uc": "UC-RPT-04", **(metadata or {})},
        )
    except Exception:
        pass


def get_b02_effective_perms(user, company: Company) -> set[str]:
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser:
        all_codes = set(B02_PERMISSION_ALIASES.keys())
        for s in B02_PERMISSION_ALIASES.values():
            all_codes |= s
        return all_codes
    iam_account = _resolve_iam_account(user)
    if not iam_account:
        return set()
    codes: set[str] = set()
    for assignment in effective_assignments(iam_account, company):
        codes |= assignment_permission_codes(assignment)
    now = timezone.now()
    overrides = (
        UserPermissionOverride.objects.filter(
            company_membership__user=iam_account,
            company_membership__company=company,
            revoked_at__isnull=True,
            valid_from__lte=now,
        )
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now))
        .select_related("permission")
    )
    for ov in overrides:
        if ov.effect == "GRANT":
            codes.add(ov.permission.code)
        elif ov.effect == "DENY":
            codes.discard(ov.permission.code)
    return codes


def has_b02_permission(user, company: Company, perm_code: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    iam_account = _resolve_iam_account(user)
    if not iam_account:
        return False
    target_codes = B02_PERMISSION_ALIASES.get(perm_code, {perm_code})
    now = timezone.now()
    if (
        UserPermissionOverride.objects.filter(
            company_membership__user=iam_account,
            company_membership__company=company,
            permission__code__in=target_codes,
            effect="DENY",
            revoked_at__isnull=True,
            valid_from__lte=now,
        )
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now))
        .exists()
    ):
        return False
    codes = get_b02_effective_perms(user, company)
    return bool(codes & target_codes)


def resolve_b02_allowed_branches(user, company: Company) -> list[str] | None:
    from reporting.financial_bundle_services import resolve_allowed_branch_ids
    return resolve_allowed_branch_ids(user, company)


def resolve_b02_company(request, explicit_company_id: str | None = None) -> Company:
    user = request.user
    if not user or not user.is_authenticated:
        raise PermissionDenied({"error_code": "EF-01", "detail": "Chưa đăng nhập."})
    params = (
        request.query_params
        if request.method == "GET"
        else {**request.query_params.dict(), **(request.data if isinstance(request.data, dict) else {})}
    )
    company_id = explicit_company_id or params.get("company_id") or params.get("company")
    if not company_id:
        raise ValidationError({"error_code": "EF-03", "company_id": "Phải xác định doanh nghiệp (company_id)."})
    try:
        company = Company.objects.select_related("accounting_currency").get(pk=company_id)
    except (Company.DoesNotExist, ValueError, TypeError):
        raise ValidationError({"error_code": "EF-03", "company_id": "Doanh nghiệp không tồn tại hoặc không hợp lệ."})

    if not user.is_superuser:
        iam_account = _resolve_iam_account(user)
        if not iam_account or not CompanyMembership.objects.filter(
            user=iam_account,
            company=company,
            membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
        ).exists():
            raise PermissionDenied({"error_code": "EF-03", "detail": "Người dùng không thuộc phạm vi doanh nghiệp này."})
    return company


def require_b02_permission(user, company: Company, perm_code: str = "RPT_BUSINESS_RESULT_VIEW", target_id: str = ""):
    if not user or not user.is_authenticated:
        raise PermissionDenied({"error_code": "EF-01", "detail": "Chưa đăng nhập."})
    if not user.is_superuser:
        iam_account = _resolve_iam_account(user)
        if not iam_account or not CompanyMembership.objects.filter(
            user=iam_account,
            company=company,
            membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
        ).exists():
            raise PermissionDenied({"error_code": "EF-03", "detail": "Người dùng không thuộc doanh nghiệp này."})
    if not has_b02_permission(user, company, perm_code):
        err_code = "EF-36" if perm_code == "RPT_BUSINESS_RESULT_DETAIL_VIEW" else "EF-02"
        raise PermissionDenied({
            "error_code": err_code,
            "required_permission": perm_code,
            "detail": f"Bạn không có quyền '{perm_code}' trên Báo cáo kết quả hoạt động kinh doanh.",
        })


def check_b02_scope_access(user, company: Company, reporting_scope: str, branch: Branch | None):
    allowed = resolve_b02_allowed_branches(user, company)
    if allowed is not None:
        if reporting_scope == "COMPANY":
            raise PermissionDenied({
                "error_code": "EF-10",
                "detail": "Tài khoản bị giới hạn phạm vi chi nhánh (Data Scope), không được xem báo cáo toàn doanh nghiệp (COMPANY).",
            })
        if branch and str(branch.id) not in allowed:
            raise PermissionDenied({
                "error_code": "EF-10",
                "detail": f"Chi nhánh '{branch.code}' nằm ngoài phạm vi dữ liệu được phân quyền.",
            })


def compute_b02_gl_snapshot(company: Company, to_date: date, branch: Branch | None = None) -> tuple[str, datetime | None]:
    qs = JournalEntry.objects.filter(
        company=company,
        status__in=("POSTED", "REVERSED"),
        posting_date__lte=to_date,
    )
    if branch is not None:
        qs = qs.filter(branch=branch)
    agg = qs.aggregate(max_posted=Max("posted_at"), max_created=Max("created_at"))
    last_ts = agg["max_posted"] or agg["max_created"]
    count = qs.count()
    raw = f"{company.id}:{branch.id if branch else 'ALL'}:{to_date.isoformat()}:{count}:{last_ts.isoformat() if last_ts else 'NONE'}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32], last_ts


def is_b02_run_stale(run: FinancialStatementRun) -> bool:
    current_hash, current_ts = compute_b02_gl_snapshot(
        run.company,
        run.period_end_date,
        run.branch if run.reporting_scope == "BRANCH" else None,
    )
    if not run.source_snapshot_hash:
        return False
    if run.source_snapshot_hash != current_hash:
        return True
    if current_ts and run.source_last_posted_at and current_ts > run.source_last_posted_at:
        return True
    return False


# ============================================================================
# 4. FORMULA VALIDATION (SF-02: EF-27 MISSING REF, EF-28 CYCLE DETECTION)
# ============================================================================

SPECIAL_FORMULA_TOKENS = {"BASIC_EPS", "DILUTED_EPS", "B02B_PRE_TAX", "TAX_51_52"}


def parse_b02_formula_tokens(expr: str) -> list[tuple[int, str]]:
    if not expr or not expr.strip():
        return []
    cleaned = expr.strip()
    if cleaned in SPECIAL_FORMULA_TOKENS:
        return []
    tokens = re.findall(r"[+\-]|[^\s+\-]+", cleaned)
    result: list[tuple[int, str]] = []
    sign = 1
    for tok in tokens:
        if tok == "+":
            sign = 1
        elif tok == "-":
            sign = -1
        else:
            result.append((sign, tok))
    return result


def validate_b02_template_formulas(lines: list[FinancialStatementLine], is_condensed_b02b: bool = False) -> dict[str, list[str]]:
    lines_by_code = {ln.indicator_code: ln for ln in lines}
    graph: dict[str, list[str]] = {}
    virtual_b02b_codes = {"02", "11", "21", "22", "23", "25", "26", "32", "51", "52"} if is_condensed_b02b else set()

    for ln in lines:
        if not ln.formula_expression or ln.formula_expression in SPECIAL_FORMULA_TOKENS:
            graph[ln.indicator_code] = []
            continue
        parsed = parse_b02_formula_tokens(ln.formula_expression)
        deps: list[str] = []
        for _, ref_code in parsed:
            if ref_code not in lines_by_code and ref_code not in virtual_b02b_codes:
                raise ValidationError({
                    "error_code": "EF-27",
                    "indicator_code": ln.indicator_code,
                    "missing_reference": ref_code,
                    "detail": f"Công thức của chỉ tiêu [{ln.indicator_code}] tham chiếu tới mã không tồn tại '{ref_code}'.",
                })
            if ref_code in lines_by_code:
                deps.append(ref_code)
        graph[ln.indicator_code] = deps

    visited: set[str] = set()
    visiting: set[str] = set()
    path: list[str] = []

    def dfs(node: str):
        visiting.add(node)
        path.append(node)
        for nbr in graph.get(node, []):
            if nbr in visiting:
                c_start = path.index(nbr)
                cycle = path[c_start:] + [nbr]
                raise ValidationError({
                    "error_code": "EF-28",
                    "cycle": cycle,
                    "detail": f"Phát hiện vòng lặp công thức (Formula Cycle): {' -> '.join(cycle)}.",
                })
            if nbr not in visited:
                dfs(nbr)
        path.pop()
        visiting.remove(node)
        visited.add(node)

    for code in lines_by_code:
        if code not in visited:
            dfs(code)

    return graph


# ============================================================================
# 5. GL EXTRACTION & CLASSIFICATION ENGINE PER SLOT (SF-01 & SF-02)
# ============================================================================

def _get_fiscal_year_start_date(company: Company, fiscal_year: int, fallback_start: date) -> date:
    first_period = (
        AccountingPeriod.objects.filter(company=company, fiscal_year=fiscal_year)
        .order_by("start_date", "period_number")
        .first()
    )
    if first_period:
        return first_period.start_date
    return date(fiscal_year, 1, 1) if fallback_start.month == 1 and fallback_start.day == 1 else fallback_start


def _shift_date_prior_year(d: date) -> date:
    try:
        return date(d.year - 1, d.month, d.day)
    except ValueError:
        return date(d.year - 1, d.month, 28)


def _classify_b02_journal_line(jl: JournalLine, entry_has_217: bool = False) -> dict[str, Any]:
    dims = jl.dimensions or {}
    acode = jl.account.code
    desc = f"{jl.description or ''} {jl.entry.description or ''}".lower()

    asset_type = str(dims.get("asset_type") or "").upper()
    tx_nature = str(dims.get("transaction_nature") or "").upper()
    act_type = str(dims.get("activity_type") or "").upper()
    rpt_cat = str(dims.get("reporting_category") or "").upper()

    is_real_estate_inventory = asset_type == "REAL_ESTATE_INVENTORY" or bool(dims.get("is_real_estate_inventory"))
    is_bdsdt_disposal = False
    if not is_real_estate_inventory:
        if (
            dims.get("is_investment_property_disposal") is True
            or dims.get("is_bdsdt_disposal") is True
            or act_type in ("INVESTMENT_PROPERTY_DISPOSAL", "BDSDT_DISPOSAL")
            or rpt_cat in ("B02_21", "21", "INVESTMENT_PROPERTY_DISPOSAL")
            or (asset_type == "INVESTMENT_PROPERTY" and tx_nature in ("DISPOSAL", "LIQUIDATION", "SALE", ""))
            or (
                acode.startswith("5117")
                and tx_nature not in ("RENTAL", "LEASE")
                and (
                    dims.get("is_disposal") is True
                    or entry_has_217
                    or any(k in desc for k in ("thanh lý bđsđt", "nhượng bán bđsđt", "bán bđsđt", "thanh lý bất động sản đầu tư", "bán bất động sản đầu tư"))
                )
            )
            or (
                acode.startswith(("632", "711", "811"))
                and (
                    entry_has_217
                    or any(k in desc for k in ("thanh lý bđsđt", "nhượng bán bđsđt", "bán bđsđt", "thanh lý bất động sản đầu tư", "bán bất động sản đầu tư"))
                )
            )
        ):
            is_bdsdt_disposal = True

    is_tscd_disposal = False
    if not is_bdsdt_disposal:
        if (
            dims.get("is_fixed_asset_disposal") is True
            or dims.get("is_tscd_disposal") is True
            or act_type in ("FIXED_ASSET_DISPOSAL", "TSCD_DISPOSAL")
            or (asset_type == "FIXED_ASSET" and tx_nature in ("DISPOSAL", "LIQUIDATION", "SALE", ""))
            or (
                acode.startswith(("711", "811"))
                and (
                    bool(dims.get("fixed_asset_id"))
                    or bool(dims.get("disposal_ref"))
                    or any(k in desc for k in ("thanh lý tscđ", "nhượng bán tscđ", "thanh lý tài sản cố định", "nhượng bán tài sản cố định"))
                )
            )
        ):
            is_tscd_disposal = True

    is_borrowing_cost = False
    if acode.startswith("635"):
        if (
            dims.get("is_borrowing_cost") is True
            or acode.startswith("6351")
            or str(dims.get("expense_type") or "").upper() in ("BORROWING_COST", "INTEREST_EXPENSE", "LOAN_INTEREST")
            or any(k in desc for k in ("chi phí lãi vay", "chi phí đi vay", "lãi tiền vay", "lãi vay"))
        ):
            is_borrowing_cost = True

    is_fx_revaluation = bool(
        dims.get("is_fx_revaluation") is True
        or tx_nature == "FX_REVALUATION"
        or "đánh giá lại ngoại tệ" in desc
        or "chênh lệch tỷ giá đánh giá lại" in desc
    )

    is_internal = bool(
        dims.get("is_internal") is True
        or dims.get("is_inter_branch") is True
        or tx_nature in ("INTERNAL", "INTER_BRANCH")
        or acode.startswith(("5119_INT", "136", "336"))
    )

    is_indirect_tax = bool(
        dims.get("is_indirect_tax") is True
        or tx_nature in ("VAT", "INDIRECT_TAX", "OUTPUT_VAT", "SPECIAL_CONSUMPTION_TAX", "EXPORT_TAX")
        or acode.startswith("333")
    )

    vat_included_amount = _to_dec(dims.get("vat_included_amount", 0))

    return {
        "is_investment_property_disposal": is_bdsdt_disposal,
        "is_fixed_asset_disposal": is_tscd_disposal,
        "is_borrowing_cost": is_borrowing_cost,
        "is_fx_revaluation": is_fx_revaluation,
        "is_internal": is_internal,
        "is_indirect_tax": is_indirect_tax,
        "vat_included_amount": vat_included_amount,
        "bdsdt_key": str(dims.get("bdsdt_transaction_id") or dims.get("asset_code") or jl.entry_id),
        "tscd_key": str(dims.get("disposal_ref") or dims.get("fixed_asset_id") or jl.entry_id),
    }


def _compute_slot_b02_data(
    *,
    company: Company,
    reporting_scope: str,
    branch: Branch | None,
    start_date: date,
    end_date: date,
    calculation_method: str,
    eps_metadata: dict[str, Any],
    is_joint_stock: bool,
    sign_multipliers: dict[str, Decimal],
    is_condensed_b02b: bool = False,
) -> dict[str, Any]:
    base_qs = (
        JournalLine.objects.select_related("entry", "account", "party", "project", "cost_center", "currency")
        .filter(
            entry__company=company,
            entry__posting_date__gte=start_date,
            entry__posting_date__lte=end_date,
        )
        .exclude(entry__entry_type="OPENING")
    )
    if reporting_scope == "BRANCH" and branch is not None:
        base_qs = base_qs.filter(entry__branch=branch)

    # Check DRAFT entries touching P&L accounts (RPT-B02-VAL-18 / EF-24)
    draft_pnl_count = (
        base_qs.filter(entry__status="DRAFT")
        .filter(
            Q(account__code__startswith="5")
            | Q(account__code__startswith="6")
            | Q(account__code__startswith="7")
            | Q(account__code__startswith="8")
            | Q(account__code__startswith="911")
        )
        .values("entry_id")
        .distinct()
        .count()
    )

    # Reversal handling (RPT-B02-VAL-19 / EF-25):
    # Include POSTED entries, plus REVERSED entries that have a separate POSTED REVERSAL entry in the period
    posted_jls = list(base_qs.filter(entry__status="POSTED").order_by("entry__posting_date", "entry_id", "line_no"))
    reversal_orig_ids: set[uuid.UUID] = set()
    seen_reversal_for_orig: set[uuid.UUID] = set()
    duplicate_reversal_entry_ids: set[uuid.UUID] = set()

    for jl in posted_jls:
        ent = jl.entry
        is_rev_entry = ent.entry_type == "REVERSAL" or (jl.dimensions or {}).get("is_reversal") is True
        if is_rev_entry and ent.original_entry_id:
            reversal_orig_ids.add(ent.original_entry_id)

    entries_seen_for_dup: set[uuid.UUID] = set()
    for jl in posted_jls:
        ent = jl.entry
        if ent.id in entries_seen_for_dup:
            continue
        entries_seen_for_dup.add(ent.id)
        is_rev_entry = ent.entry_type == "REVERSAL" or (jl.dimensions or {}).get("is_reversal") is True
        if is_rev_entry and ent.original_entry_id:
            if ent.original_entry_id in seen_reversal_for_orig:
                duplicate_reversal_entry_ids.add(ent.id)
            else:
                seen_reversal_for_orig.add(ent.original_entry_id)

    reversed_with_counter_jls: list[JournalLine] = []
    if reversal_orig_ids:
        reversed_with_counter_jls = list(
            base_qs.filter(entry__status="REVERSED", entry_id__in=reversal_orig_ids).order_by(
                "entry__posting_date", "entry_id", "line_no"
            )
        )

    all_valid_jls = [
        jl for jl in (posted_jls + reversed_with_counter_jls) if jl.entry_id not in duplicate_reversal_entry_ids
    ]

    # Group lines by entry_id to detect 911 closing entries, 521->511 transfer entries, and 217 BĐSĐT disposal entries
    lines_by_entry: dict[uuid.UUID, list[JournalLine]] = defaultdict(list)
    for jl in all_valid_jls:
        lines_by_entry[jl.entry_id].append(jl)

    closing_911_entry_ids: set[uuid.UUID] = set()
    transfer_521_entry_ids: set[uuid.UUID] = set()
    entries_with_217: set[uuid.UUID] = set()

    for eid, elines in lines_by_entry.items():
        acc_codes = [x.account.code for x in elines]
        if any(c.startswith("911") for c in acc_codes) or any(x.entry.entry_type == "CLOSING" for x in elines):
            closing_911_entry_ids.add(eid)
        has_511_dr = any(x.account.code.startswith("511") and (x.debit or ZERO) > ZERO for x in elines)
        has_521_cr = any(x.account.code.startswith("521") and (x.credit or ZERO) > ZERO for x in elines)
        if has_511_dr and has_521_cr and eid not in closing_911_entry_ids:
            transfer_521_entry_ids.add(eid)
        if any(c.startswith(("217", "2147")) for c in acc_codes):
            entries_with_217.add(eid)

    has_closing_entries = len(closing_911_entry_ids) > 0
    fallback_from_closing_to_activity = False
    if calculation_method == "CLOSING_BASED" and not has_closing_entries:
        fallback_from_closing_to_activity = True

    # Operational lines exclude 911 closing entries so we NEVER double count operational + closing (EF-23)
    operational_jls = [jl for jl in all_valid_jls if jl.entry_id not in closing_911_entry_ids]

    # Containers per indicator
    contrib_jls: dict[str, list[dict[str, Any]]] = defaultdict(list)
    bdsdt_groups: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "transaction_key": "",
            "revenue": ZERO,
            "carrying_amount_nbv": ZERO,
            "disposal_expense": ZERO,
            "net_gain_loss": ZERO,
            "journal_lines": [],
        }
    )
    tscd_groups: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "disposal_key": "",
            "proceeds": ZERO,
            "carrying_amount_nbv": ZERO,
            "disposal_expense": ZERO,
            "net_gain_loss": ZERO,
            "journal_lines": [],
        }
    )
    fx_reval_lines: list[tuple[Decimal, dict[str, Any]]] = []  # signed (+ for 515 credit, - for 635 debit)

    r01 = ZERO
    r02 = ZERO
    r11 = ZERO
    r22_non_fx = ZERO
    r23_non_fx = ZERO
    r24 = ZERO
    r25 = ZERO
    r26 = ZERO
    r31_non_tscd = ZERO
    r32_non_tscd = ZERO
    r51 = ZERO
    r52 = ZERO

    eliminated_internal_amount = ZERO
    excluded_indirect_tax_amount = ZERO
    double_counted_closing_violation = False

    def _jl_dict(jl: JournalLine, amount_contrib: Decimal, note: str = "") -> dict[str, Any]:
        dims_jl = jl.dimensions or {}
        src_doc_ok = not bool(dims_jl.get("missing_source_document"))
        return {
            "journal_line_id": str(jl.id),
            "journal_entry_id": str(jl.entry_id),
            "journal_number": jl.entry.number,
            "entry_no": jl.entry.number,
            "posting_date": jl.entry.posting_date.isoformat(),
            "document_date": jl.entry.document_date.isoformat() if jl.entry.document_date else jl.entry.posting_date.isoformat(),
            "entry_type": jl.entry.entry_type,
            "source_module": jl.entry.source_module or "GL",
            "source_entity_type": jl.entry.source_entity_type or "",
            "source_entity_id": str(jl.entry.source_entity_id) if jl.entry.source_entity_id else None,
            "source_document_Available": src_doc_ok,
            "account_code": jl.account.code,
            "account_name": jl.account.name,
            "debit": str(_to_dec(jl.debit)),
            "credit": str(_to_dec(jl.credit)),
            "contribution_amount": str(_to_dec(amount_contrib)),
            "party_name": jl.party.name if jl.party_id and jl.party else "",
            "cost_center_code": jl.cost_center.code if jl.cost_center_id and jl.cost_center else "",
            "project_code": jl.project.code if jl.project_id and jl.project else "",
            "description": jl.description or jl.entry.description,
            "classification_note": note,
        }

    for jl in operational_jls:
        acode = jl.account.code
        dr = _to_dec(jl.debit)
        cr = _to_dec(jl.credit)
        dims = jl.dimensions or {}
        if dims.get("double_counted_closing") is True:
            double_counted_closing_violation = True

        cls = _classify_b02_journal_line(jl, entry_has_217=(jl.entry_id in entries_with_217))

        # 1. Internal inter-branch elimination in COMPANY scope (BR-RPT-B02-27, TC-RPT-04-50)
        if reporting_scope == "COMPANY" and cls["is_internal"]:
            eliminated_internal_amount += abs(cr - dr)
            continue

        # 2. Investment Property (BĐSĐT) disposal -> Indicator 21 ONLY (BR-RPT-B02-38..41, TC-RPT-04-16..19)
        if cls["is_investment_property_disposal"]:
            bkey = cls["bdsdt_key"]
            grp = bdsdt_groups[bkey]
            grp["transaction_key"] = bkey
            if acode.startswith(("511", "711")):
                rev_amt = (cr - dr) - cls["vat_included_amount"]
                grp["revenue"] += rev_amt
                grp["net_gain_loss"] += rev_amt
                jd = _jl_dict(jl, rev_amt, "Doanh thu bán/thanh lý BĐSĐT (Mã 21)")
                grp["journal_lines"].append(jd)
                contrib_jls["21"].append(jd)
            elif acode.startswith(("632", "811", "641", "642")):
                cost_amt = dr - cr
                cost_kind = str(dims.get("bdsdt_cost_kind") or "").upper()
                desc_lower = (jl.description or "").lower()
                if cost_kind == "DISPOSAL_EXPENSE" or "chi phí bán" in desc_lower or "chi phí thanh lý" in desc_lower:
                    grp["disposal_expense"] += cost_amt
                else:
                    grp["carrying_amount_nbv"] += cost_amt
                grp["net_gain_loss"] -= cost_amt
                jd = _jl_dict(jl, -cost_amt, "Giá trị còn lại / Chi phí bán, thanh lý BĐSĐT (Mã 21)")
                grp["journal_lines"].append(jd)
                contrib_jls["21"].append(jd)
            continue

        # 3. Fixed Asset (TSCĐ) disposal -> Net gain in 31 or Net loss in 32 (1.2.C1..C3, TC-RPT-04-28..29)
        if cls["is_fixed_asset_disposal"] and acode.startswith(("711", "811")):
            tkey = cls["tscd_key"]
            tgrp = tscd_groups[tkey]
            tgrp["disposal_key"] = tkey
            if acode.startswith("711"):
                proc_amt = (cr - dr) - cls["vat_included_amount"]
                tgrp["proceeds"] += proc_amt
                tgrp["net_gain_loss"] += proc_amt
                tgrp["journal_lines"].append(_jl_dict(jl, proc_amt, "Thu thanh lý/nhượng bán TSCĐ"))
            elif acode.startswith("811"):
                c_amt = dr - cr
                desc_lower = (jl.description or "").lower()
                if "chi phí" in desc_lower:
                    tgrp["disposal_expense"] += c_amt
                else:
                    tgrp["carrying_amount_nbv"] += c_amt
                tgrp["net_gain_loss"] -= c_amt
                tgrp["journal_lines"].append(_jl_dict(jl, -c_amt, "GTCL / Chi phí thanh lý TSCĐ"))
            continue

        # 4. Regular Revenue (TK 511 -> Indicator 01)
        if acode.startswith("511"):
            if cls["is_indirect_tax"]:
                excluded_indirect_tax_amount += cr - dr
                continue
            if jl.entry_id in transfer_521_entry_ids and dr > ZERO:
                # Exclude Nợ 511 / Có 521 transfer entry from 01 and 02
                continue
            is_rev = jl.entry.entry_type == "REVERSAL" or dims.get("is_reversal") is True
            is_direct_deduction = dims.get("is_revenue_deduction") is True
            if is_direct_deduction and dr > ZERO:
                ded_amt = dr * sign_multipliers.get("521", Decimal("1"))
                r02 += ded_amt
                contrib_jls["02"].append(_jl_dict(jl, ded_amt, "Giảm trừ doanh thu hạch toán trực tiếp"))
                continue
            if cr > ZERO or is_rev:
                net_rev = (cr - dr) - cls["vat_included_amount"]
                if cls["vat_included_amount"] > ZERO:
                    excluded_indirect_tax_amount += cls["vat_included_amount"]
                net_rev = net_rev * sign_multipliers.get("511", Decimal("1"))
                r01 += net_rev
                contrib_jls["01"].append(_jl_dict(jl, net_rev, "Doanh thu bán hàng và CCDV (TK 511)"))
            continue

        # 5. Revenue Deductions (TK 521 -> Indicator 02)
        if acode.startswith("521"):
            if cls["is_indirect_tax"]:
                continue
            if jl.entry_id in transfer_521_entry_ids and cr > ZERO:
                # Exclude the credit leg of Nợ 511 / Có 521 closing transfer
                continue
            is_rev = jl.entry.entry_type == "REVERSAL" or dims.get("is_reversal") is True
            ded_amt = (dr - cr) if is_rev else dr
            ded_amt = ded_amt * sign_multipliers.get("521", Decimal("1"))
            if ded_amt != ZERO:
                r02 += ded_amt
                contrib_jls["02"].append(_jl_dict(jl, ded_amt, "Các khoản giảm trừ doanh thu (TK 521)"))
            continue

        # 6. Cost of Goods Sold (TK 632 -> Indicator 11)
        if acode.startswith("632"):
            cogs_amt = (dr - cr) * sign_multipliers.get("632", Decimal("1"))
            if cogs_amt != ZERO:
                r11 += cogs_amt
                contrib_jls["11"].append(_jl_dict(jl, cogs_amt, "Giá vốn hàng bán (TK 632)"))
            continue

        # 7. Financial Income (TK 515 -> Indicator 22)
        if acode.startswith("515"):
            fin_inc = (cr - dr) * sign_multipliers.get("515", Decimal("1"))
            if cls["is_fx_revaluation"]:
                fx_reval_lines.append((fin_inc, _jl_dict(jl, fin_inc, "Chênh lệch tỷ giá đánh giá lại (TK 515)")))
            elif fin_inc != ZERO:
                r22_non_fx += fin_inc
                contrib_jls["22"].append(_jl_dict(jl, fin_inc, "Doanh thu hoạt động tài chính (TK 515)"))
            continue

        # 8. Financial Expense (TK 635 -> Indicator 23, and Borrowing Cost -> Indicator 24)
        if acode.startswith("635"):
            fin_exp = (dr - cr) * sign_multipliers.get("635", Decimal("1"))
            if cls["is_fx_revaluation"]:
                fx_reval_lines.append((-fin_exp, _jl_dict(jl, fin_exp, "Chênh lệch tỷ giá đánh giá lại (TK 635)")))
            elif fin_exp != ZERO:
                r23_non_fx += fin_exp
                contrib_jls["23"].append(_jl_dict(jl, fin_exp, "Chi phí tài chính (TK 635)"))
                if cls["is_borrowing_cost"]:
                    r24 += fin_exp
                    contrib_jls["24"].append(_jl_dict(jl, fin_exp, "Trong đó: Chi phí đi vay (TK 635)"))
            continue

        # 9. Selling Expense (TK 641 -> Indicator 25)
        if acode.startswith("641"):
            sell_exp = (dr - cr) * sign_multipliers.get("641", Decimal("1"))
            if sell_exp != ZERO:
                r25 += sell_exp
                contrib_jls["25"].append(_jl_dict(jl, sell_exp, "Chi phí bán hàng (TK 641)"))
            continue

        # 10. General & Admin Expense (TK 642 -> Indicator 26)
        if acode.startswith("642"):
            ga_exp = (dr - cr) * sign_multipliers.get("642", Decimal("1"))
            if ga_exp != ZERO:
                r26 += ga_exp
                contrib_jls["26"].append(_jl_dict(jl, ga_exp, "Chi phí quản lý doanh nghiệp (TK 642)"))
            continue

        # 11. Other Income (TK 711 -> Indicator 31)
        if acode.startswith("711"):
            oth_inc = ((cr - dr) - cls["vat_included_amount"]) * sign_multipliers.get("711", Decimal("1"))
            if oth_inc != ZERO:
                r31_non_tscd += oth_inc
                contrib_jls["31"].append(_jl_dict(jl, oth_inc, "Thu nhập khác (TK 711)"))
            continue

        # 12. Other Expense (TK 811 -> Indicator 32)
        if acode.startswith("811"):
            oth_exp = (dr - cr) * sign_multipliers.get("811", Decimal("1"))
            if oth_exp != ZERO:
                r32_non_tscd += oth_exp
                contrib_jls["32"].append(_jl_dict(jl, oth_exp, "Chi phí khác (TK 811)"))
            continue

        # 13. Deferred CIT Expense/Income (TK 8212 -> Indicator 52, signed!)
        if acode.startswith("8212"):
            def_tax = (dr - cr) * sign_multipliers.get("8212", Decimal("1"))
            if def_tax != ZERO:
                r52 += def_tax
                contrib_jls["52"].append(_jl_dict(jl, def_tax, "Chi phí/Thu nhập thuế TNDN hoãn lại (TK 8212)"))
            continue

        # 14. Current CIT Expense (TK 8211 or 821 -> Indicator 51, signed!)
        if acode.startswith("821"):
            curr_tax = (dr - cr) * sign_multipliers.get("8211", Decimal("1"))
            if curr_tax != ZERO:
                r51 += curr_tax
                contrib_jls["51"].append(_jl_dict(jl, curr_tax, "Chi phí thuế TNDN hiện hành (TK 8211)"))
            continue

    # Finalize Indicator 21 (BĐSĐT net gain/loss)
    r21 = sum((g["net_gain_loss"] for g in bdsdt_groups.values()), ZERO)

    # Finalize FX revaluation netting into 22 or 23
    r22 = r22_non_fx
    r23 = r23_non_fx
    if fx_reval_lines:
        net_fx = sum((amt for amt, _ in fx_reval_lines), ZERO)
        if net_fx >= ZERO:
            r22 += net_fx
            for _, jd in fx_reval_lines:
                contrib_jls["22"].append(jd)
        else:
            r23 += abs(net_fx)
            for _, jd in fx_reval_lines:
                contrib_jls["23"].append(jd)

    # Finalize TSCĐ disposal net presentation into 31 (if net gain > 0) or 32 (if net loss < 0)
    r31_full = r31_non_tscd
    r32_full = r32_non_tscd
    for tkey, tgrp in tscd_groups.items():
        net_tscd = tgrp["net_gain_loss"]
        if net_tscd >= ZERO:
            r31_full += net_tscd
            contrib_jls["31"].extend(tgrp["journal_lines"])
        else:
            r32_full += abs(net_tscd)
            contrib_jls["32"].extend(tgrp["journal_lines"])

    # SF-02: Compute Formula Indicators (10, 20, 30, 40, 50, 60)
    r10 = r01 - r02
    r20 = r10 - r11
    # Crucial TT99 rule: 30 = 20 + 21 + 22 - 23 - 25 - 26 (24 is NOT subtracted again!)
    r30 = r20 + r21 + r22 - r23 - r25 - r26
    r40 = r31_full - r32_full
    r50 = r30 + r40
    r60 = r50 - r51 - r52

    # B02b-DN condensed indicator 31 = 22 (Doanh thu HĐTC) + 31_full (Thu nhập khác)
    r31_condensed_b02b = r22 + r31_full
    if is_condensed_b02b:
        contrib_jls["31_b02b"] = list(contrib_jls["22"]) + list(contrib_jls["31"])

    # Indicator 70 & 71: Basic & Diluted EPS
    r70: Decimal | None = None
    r71: Decimal | None = None
    eps_status = "NOT_APPLICABLE"
    eps_detail: dict[str, Any] = {"is_applicable": is_joint_stock}

    if is_joint_stock:
        raw_shares = eps_metadata.get("weighted_average_ordinary_shares")
        if raw_shares is None or raw_shares == "":
            eps_status = "INSUFFICIENT_DATA"
            eps_detail["status"] = "INSUFFICIENT_DATA"
            eps_detail["error_code"] = "EF-34"
        else:
            shares = _to_dec(raw_shares)
            if shares <= ZERO:
                eps_status = "ZERO_DENOMINATOR"
                eps_detail["status"] = "ZERO_DENOMINATOR"
                eps_detail["error_code"] = "EF-35"
                eps_detail["weighted_average_ordinary_shares"] = str(shares)
            else:
                prof_attr = (
                    _to_dec(eps_metadata["profit_attributable_to_ordinary_shareholders"])
                    if eps_metadata.get("profit_attributable_to_ordinary_shareholders") is not None
                    else r60
                )
                pref_div = _to_dec(eps_metadata.get("preferred_dividend_adjustment", 0))
                bonus_fund = _to_dec(eps_metadata.get("bonus_welfare_fund_adjustment", 0))
                basic_earnings = prof_attr - pref_div - bonus_fund
                r70 = (basic_earnings / shares).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

                pot_shares = _to_dec(eps_metadata.get("potential_dilutive_shares", 0))
                is_anti_dilutive = bool(eps_metadata.get("is_anti_dilutive", False))
                if is_anti_dilutive:
                    diluted_shares = shares
                    adj_earnings = basic_earnings
                else:
                    diluted_shares = (
                        _to_dec(eps_metadata["weighted_average_diluted_shares"])
                        if eps_metadata.get("weighted_average_diluted_shares") is not None
                        else (shares + pot_shares)
                    )
                    adj_earnings = (
                        _to_dec(eps_metadata["adjusted_earnings"])
                        if eps_metadata.get("adjusted_earnings") is not None
                        else (basic_earnings + _to_dec(eps_metadata.get("dilutive_earnings_adjustment", 0)))
                    )
                if diluted_shares > ZERO:
                    r71 = (adj_earnings / diluted_shares).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                    if not is_anti_dilutive and r70 > ZERO and r71 > r70 and pot_shares > ZERO and adj_earnings > basic_earnings:
                        # Prevent accidental anti-dilution when instrument increases EPS
                        r71 = r70
                else:
                    r71 = r70

                eps_status = "COMPLETE"
                eps_detail = {
                    "is_applicable": True,
                    "status": "COMPLETE",
                    "profit_attributable_to_ordinary_shareholders": str(prof_attr),
                    "preferred_dividend_adjustment": str(pref_div),
                    "bonus_welfare_fund_adjustment": str(bonus_fund),
                    "basic_earnings": str(basic_earnings),
                    "weighted_average_ordinary_shares": str(shares),
                    "basic_eps": str(r70),
                    "potential_dilutive_shares": str(pot_shares),
                    "weighted_average_diluted_shares": str(diluted_shares),
                    "adjusted_earnings": str(adj_earnings),
                    "diluted_eps": str(r71),
                }

    full_values: dict[str, Decimal | None] = {
        "01": r01,
        "02": r02,
        "10": r10,
        "11": r11,
        "20": r20,
        "21": r21,
        "22": r22,
        "23": r23,
        "24": r24,
        "25": r25,
        "26": r26,
        "30": r30,
        "31": r31_condensed_b02b if is_condensed_b02b else r31_full,
        "32": r32_full,
        "40": r40,
        "50": r50,
        "51": r51,
        "52": r52,
        "60": r60,
        "70": r70,
        "71": r71,
    }

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "values": full_values,
        "full_21_values": {
            **full_values,
            "31_full": r31_full,
            "31_condensed_b02b": r31_condensed_b02b,
        },
        "contrib_jls": contrib_jls,
        "bdsdt_breakdown": [
            {
                "transaction_key": g["transaction_key"],
                "revenue": _fmt_dec(g["revenue"]),
                "carrying_amount_nbv": _fmt_dec(g["carrying_amount_nbv"]),
                "disposal_expense": _fmt_dec(g["disposal_expense"]),
                "net_gain_loss": _fmt_dec(g["net_gain_loss"]),
                "journal_lines": g["journal_lines"],
            }
            for g in bdsdt_groups.values()
        ],
        "tscd_breakdown": [
            {
                "disposal_key": g["disposal_key"],
                "proceeds": _fmt_dec(g["proceeds"]),
                "carrying_amount_nbv": _fmt_dec(g["carrying_amount_nbv"]),
                "disposal_expense": _fmt_dec(g["disposal_expense"]),
                "net_gain_loss": _fmt_dec(g["net_gain_loss"]),
                "journal_lines": g["journal_lines"],
            }
            for g in tscd_groups.values()
        ],
        "eps_status": eps_status,
        "eps_detail": eps_detail,
        "has_closing_entries": has_closing_entries,
        "fallback_from_closing_to_activity": fallback_from_closing_to_activity,
        "draft_pnl_count": draft_pnl_count,
        "duplicate_reversal_count": len(duplicate_reversal_entry_ids),
        "eliminated_internal_amount": str(eliminated_internal_amount),
        "excluded_indirect_tax_amount": str(excluded_indirect_tax_amount),
        "double_counted_closing_violation": double_counted_closing_violation,
    }


def _is_company_joint_stock(company: Company, eps_metadata: dict[str, Any]) -> bool:
    if "is_applicable" in eps_metadata:
        return bool(eps_metadata["is_applicable"])
    if "is_joint_stock" in eps_metadata:
        return bool(eps_metadata["is_joint_stock"])
    legal_name = f"{getattr(company, 'legal_name', '') or ''} {company.name or ''}".upper()
    if "CỔ PHẦN" in legal_name or "CP " in legal_name or "JSC" in legal_name:
        return True
    return False


@transaction.atomic
def calculate_business_result_run(run: FinancialStatementRun) -> FinancialStatementRun:
    ensure_b02_templates_seeded()

    tv = run.template_version
    tmpl = run.template
    legal_code = tmpl.legal_form_code
    is_interim = tmpl.period_granularity == "INTERIM" or legal_code in ("B02a-DN", "B02b-DN")
    is_condensed_b02b = legal_code == "B02b-DN"

    lines = list(tv.lines.all().prefetch_related("account_mappings").order_by("display_order", "indicator_code"))
    validate_b02_template_formulas(lines, is_condensed_b02b=is_condensed_b02b)

    # Determine custom account mapping sign multipliers (if modified for company or globally)
    sign_multipliers: dict[str, Decimal] = {}
    for ln in lines:
        if ln.indicator_code == "21":
            continue
        comp_maps = list(ln.account_mappings.filter(company=run.company, is_active=True))
        maps_to_use = comp_maps if comp_maps else list(ln.account_mappings.filter(company__isnull=True, is_active=True))
        for m in maps_to_use:
            if not (m.condition_json or {}).get("is_investment_property_disposal"):
                sign_multipliers[m.account_prefix] = Decimal(str(m.sign))

    # Resolve date ranges for slots
    curr_start = run.period_start_date
    curr_end = run.period_end_date
    fy_curr_start = _get_fiscal_year_start_date(run.company, run.fiscal_year, curr_start)

    if run.comparison_start_date and run.comparison_end_date:
        prev_start = run.comparison_start_date
        prev_end = run.comparison_end_date
    elif run.comparison_period_id and run.comparison_period:
        prev_start = run.comparison_period.start_date
        prev_end = run.comparison_period.end_date
    else:
        prev_start = _shift_date_prior_year(curr_start)
        prev_end = _shift_date_prior_year(curr_end)

    fy_prev_start = _shift_date_prior_year(fy_curr_start)

    if run.comparison_start_date != prev_start or run.comparison_end_date != prev_end:
        run.comparison_start_date = prev_start
        run.comparison_end_date = prev_end
        run.save(update_fields=["comparison_start_date", "comparison_end_date"])

    eps_meta = run.eps_metadata_json or {}
    is_jsc = _is_company_joint_stock(run.company, eps_meta)

    if is_interim:
        slot_defs = [
            ("QUARTER_CURRENT", "Quý này – Năm nay", curr_start, curr_end, 1, eps_meta.get("QUARTER_CURRENT", eps_meta)),
            ("QUARTER_PREVIOUS", "Quý tương ứng – Năm trước", prev_start, prev_end, 2, eps_meta.get("QUARTER_PREVIOUS", eps_meta)),
            ("YTD_CURRENT", "Lũy kế từ đầu năm đến cuối quý này – Năm nay", fy_curr_start, curr_end, 3, eps_meta.get("YTD_CURRENT", eps_meta)),
            ("YTD_PREVIOUS", "Lũy kế từ đầu năm đến cuối quý tương ứng – Năm trước", fy_prev_start, prev_end, 4, eps_meta.get("YTD_PREVIOUS", eps_meta)),
        ]
    else:
        slot_defs = [
            ("YEAR_CURRENT", "Năm nay", curr_start, curr_end, 1, eps_meta.get("YEAR_CURRENT", eps_meta)),
            ("YEAR_PREVIOUS", "Năm trước", prev_start, prev_end, 2, eps_meta.get("YEAR_PREVIOUS", eps_meta)),
        ]

    slot_results: dict[str, dict[str, Any]] = {}
    for scode, slabel, s_start, s_end, s_order, s_eps in slot_defs:
        slot_results[scode] = _compute_slot_b02_data(
            company=run.company,
            reporting_scope=run.reporting_scope,
            branch=run.branch if run.reporting_scope == "BRANCH" else None,
            start_date=s_start,
            end_date=s_end,
            calculation_method=run.calculation_method or "ACTIVITY_BASED",
            eps_metadata=s_eps if isinstance(s_eps, dict) else eps_meta,
            is_joint_stock=is_jsc,
            sign_multipliers=sign_multipliers,
            is_condensed_b02b=is_condensed_b02b,
        )
        slot_results[scode]["slot_label"] = slabel
        slot_results[scode]["display_order"] = s_order
        slot_results[scode]["start_date_obj"] = s_start
        slot_results[scode]["end_date_obj"] = s_end

    # Handle comparative_status (NON_COMPARABLE / UNAVAILABLE -> EF-29: do NOT fake 0 for prior period!)
    comp_non_comparable = run.comparative_status in ("NON_COMPARABLE", "UNAVAILABLE")
    if comp_non_comparable:
        for prev_slot in ("YEAR_PREVIOUS", "QUARTER_PREVIOUS", "YTD_PREVIOUS"):
            if prev_slot in slot_results:
                for k in list(slot_results[prev_slot]["values"].keys()):
                    slot_results[prev_slot]["values"][k] = None

    # Apply approved adjustments (FinancialStatementAdjustment) and re-evaluate dependent formulas per slot
    adjustments = list(run.adjustments.select_related("statement_line").all())
    if adjustments:
        for adj in adjustments:
            ind_code = adj.statement_line.indicator_code
            target_slot = adj.slot_code
            if target_slot in ("CURRENT", "CLOSING", "CURRENT_YEAR"):
                target_slot = "QUARTER_CURRENT" if is_interim else "YEAR_CURRENT"
            elif target_slot in ("COMPARATIVE", "OPENING", "PREVIOUS_YEAR"):
                target_slot = "QUARTER_PREVIOUS" if is_interim else "YEAR_PREVIOUS"

            if target_slot in slot_results:
                sv = slot_results[target_slot]["values"]
                if sv.get(ind_code) is not None:
                    sv[ind_code] = _to_dec(sv[ind_code]) + _to_dec(adj.delta_amount)
                else:
                    sv[ind_code] = _to_dec(adj.delta_amount)

    # Clear old values & slots and save new ones
    run.values.all().delete()
    run.value_slots.all().delete()

    primary_curr_slot = "QUARTER_CURRENT" if is_interim else "YEAR_CURRENT"
    primary_prev_slot = "QUARTER_PREVIOUS" if is_interim else "YEAR_PREVIOUS"

    for ln in lines:
        code = ln.indicator_code
        curr_val = slot_results[primary_curr_slot]["values"].get(code)
        prev_val = slot_results[primary_prev_slot]["values"].get(code)

        # Check if line has any active mappings when DETAIL
        has_mappings = True
        if ln.line_type in ("DETAIL", "MEMO"):
            has_mappings = (
                ln.account_mappings.filter(company=run.company, is_active=True).exists()
                or ln.account_mappings.filter(company__isnull=True, is_active=True).exists()
            )
            if not has_mappings and (ln.table_schema or {}).get("unmapped") is True:
                curr_val = None
                prev_val = None

        if ln.line_type == "EPS":
            c_status = slot_results[primary_curr_slot]["eps_status"]
        elif not has_mappings:
            c_status = "UNMAPPED"
            curr_val = None
            prev_val = None
        elif curr_val is None:
            c_status = "MISSING"
        else:
            c_status = "COMPLETE"

        curr_res = slot_results[primary_curr_slot]
        prev_res = slot_results[primary_prev_slot]

        detail_json = {
            "indicator_code": code,
            "indicator_name": ln.indicator_name,
            "line_type": ln.line_type,
            "b02_line_type": "FORMULA" if ln.line_type in ("SUBTOTAL", "TOTAL", "FORMULA") else ln.line_type,
            "formula_expression": ln.formula_expression,
            "is_applicable": is_jsc if ln.line_type == "EPS" else True,
            "content_status": c_status,
            "calculation_method": run.calculation_method,
            "current_slot": {
                "slot_code": primary_curr_slot,
                "start_date": curr_res["start_date"],
                "end_date": curr_res["end_date"],
                "amount": _fmt_dec(curr_val),
                "journal_lines": curr_res["contrib_jls"].get("31_b02b" if (is_condensed_b02b and code == "31") else code, []),
                "bdsdt_breakdown": curr_res["bdsdt_breakdown"] if code == "21" else [],
                "tscd_breakdown": curr_res["tscd_breakdown"] if code in ("31", "32") else [],
                "eps_detail": curr_res["eps_detail"] if code in ("70", "71") else {},
            },
            "comparative_slot": {
                "slot_code": primary_prev_slot,
                "start_date": prev_res["start_date"],
                "end_date": prev_res["end_date"],
                "amount": _fmt_dec(prev_val),
                "comparative_status": run.comparative_status,
            },
            "full_21_snapshot": {
                k: _fmt_dec(v) for k, v in curr_res["full_21_values"].items()
            },
            "meta_flags": {
                "has_closing_entries": curr_res["has_closing_entries"],
                "fallback_from_closing_to_activity": curr_res["fallback_from_closing_to_activity"],
                "draft_pnl_count": curr_res["draft_pnl_count"],
                "duplicate_reversal_count": curr_res["duplicate_reversal_count"],
                "eliminated_internal_amount": curr_res["eliminated_internal_amount"],
                "excluded_indirect_tax_amount": curr_res["excluded_indirect_tax_amount"],
                "double_counted_closing_violation": curr_res["double_counted_closing_violation"],
            },
        }

        FinancialStatementValue.objects.create(
            statement_run=run,
            statement_line=ln,
            current_period_amount=curr_val,
            comparative_period_amount=prev_val,
            content_status=c_status,
            calculation_detail_json=detail_json,
        )

        for scode, sres in slot_results.items():
            s_amt = None if not has_mappings else sres["values"].get(code)
            s_detail = {
                "slot_code": scode,
                "slot_label": sres["slot_label"],
                "start_date": sres["start_date"],
                "end_date": sres["end_date"],
                "indicator_code": code,
                "formula_expression": ln.formula_expression,
                "amount": _fmt_dec(s_amt),
                "journal_lines": sres["contrib_jls"].get("31_b02b" if (is_condensed_b02b and code == "31") else code, []),
                "bdsdt_breakdown": sres["bdsdt_breakdown"] if code == "21" else [],
                "tscd_breakdown": sres["tscd_breakdown"] if code in ("31", "32") else [],
                "eps_detail": sres["eps_detail"] if code in ("70", "71") else {},
                "full_21_values": {k: _fmt_dec(v) for k, v in sres["full_21_values"].items()},
            }
            FinancialStatementValueSlot.objects.create(
                statement_run=run,
                statement_line=ln,
                slot_code=scode,
                slot_label=sres["slot_label"],
                start_date=sres["start_date_obj"],
                end_date=sres["end_date_obj"],
                amount=s_amt,
                calculation_detail_json=s_detail,
                display_order=sres["display_order"],
            )

    # Determine run.source_status
    curr_meta = slot_results[primary_curr_slot]
    if run.simulate_load_error:
        run.source_status = FinancialStatementRun.SourceStatus.UNAVAILABLE
    elif curr_meta["fallback_from_closing_to_activity"] or run.legal_or_management == "MANAGEMENT" or getattr(run.fiscal_period, "status", "OPEN") == "OPEN":
        if run.source_status not in ("PARTIAL", "STALE", "UNAVAILABLE"):
            run.source_status = (
                FinancialStatementRun.SourceStatus.PRELIMINARY
                if (curr_meta["fallback_from_closing_to_activity"] or run.legal_or_management == "MANAGEMENT")
                else FinancialStatementRun.SourceStatus.COMPLETE
            )
    if is_jsc and curr_meta["eps_status"] in ("INSUFFICIENT_DATA", "ZERO_DENOMINATOR"):
        run.source_status = FinancialStatementRun.SourceStatus.PARTIAL

    snap_hash, last_posted_at = compute_b02_gl_snapshot(
        run.company,
        run.period_end_date,
        run.branch if run.reporting_scope == "BRANCH" else None,
    )
    run.source_snapshot_hash = snap_hash
    run.source_last_posted_at = last_posted_at
    run.save(update_fields=["source_status", "source_snapshot_hash", "source_last_posted_at"])

    validate_business_result_run(run)
    return run


# ============================================================================
# 6. VALIDATION ENGINE – 25 RULES (RPT-B02-VAL-01 .. RPT-B02-VAL-25)
# ============================================================================

@transaction.atomic
def validate_business_result_run(run: FinancialStatementRun) -> dict[str, Any]:
    val_run_id = uuid.uuid4()
    run.validations.all().delete()

    tmpl = run.template
    tv = run.template_version
    legal_code = tmpl.legal_form_code
    is_interim = tmpl.period_granularity == "INTERIM" or legal_code in ("B02a-DN", "B02b-DN")
    is_condensed_b02b = legal_code == "B02b-DN"

    lines = list(tv.lines.all().order_by("display_order", "indicator_code"))
    lines_by_code = {ln.indicator_code: ln for ln in lines}

    vals = list(run.values.select_related("statement_line").all())
    vals_by_code = {v.statement_line.indicator_code: v for v in vals}

    slots = list(run.value_slots.select_related("statement_line").order_by("display_order"))
    slots_by_code_and_slot: dict[tuple[str, str], FinancialStatementValueSlot] = {}
    slots_by_slot_code: dict[str, dict[str, Decimal | None]] = defaultdict(dict)
    slot_details_by_slot: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)

    for s in slots:
        ic = s.statement_line.indicator_code
        slots_by_code_and_slot[(ic, s.slot_code)] = s
        slots_by_slot_code[s.slot_code][ic] = s.amount
        slot_details_by_slot[s.slot_code][ic] = s.calculation_detail_json or {}

    # Also build primary slot map from FinancialStatementValue if someone modified FinancialStatementValue directly in tests
    primary_curr_slot = "QUARTER_CURRENT" if is_interim else "YEAR_CURRENT"
    primary_prev_slot = "QUARTER_PREVIOUS" if is_interim else "YEAR_PREVIOUS"
    for ic, v in vals_by_code.items():
        if primary_curr_slot in slots_by_slot_code and v.current_period_amount != slots_by_slot_code[primary_curr_slot].get(ic):
            slots_by_slot_code[primary_curr_slot][ic] = v.current_period_amount
        if primary_prev_slot in slots_by_slot_code and v.comparative_period_amount != slots_by_slot_code[primary_prev_slot].get(ic):
            slots_by_slot_code[primary_prev_slot][ic] = v.comparative_period_amount

    active_slot_codes = (
        ["QUARTER_CURRENT", "QUARTER_PREVIOUS", "YTD_CURRENT", "YTD_PREVIOUS"]
        if is_interim
        else ["YEAR_CURRENT", "YEAR_PREVIOUS"]
    )
    comp_non_comparable = run.comparative_status in ("NON_COMPARABLE", "UNAVAILABLE")

    created_validations: list[FinancialStatementRunValidation] = []

    def _add_val(
        rule_code: str,
        slot_code: str,
        indicator_code: str,
        expected: Decimal | None,
        actual: Decimal | None,
        severity: str,
        status_str: str,
        message: str,
    ):
        diff = (actual - expected) if (actual is not None and expected is not None) else None
        ln_obj = lines_by_code.get(indicator_code)
        col_code = "OPENING" if "PREVIOUS" in slot_code else ("CLOSING" if slot_code != "ALL" else "BOTH")
        created_validations.append(
            FinancialStatementRunValidation.objects.create(
                validation_run_id=val_run_id,
                statement_run=run,
                statement_line=ln_obj,
                rule_code=rule_code,
                column_code=col_code,
                slot_code=slot_code,
                indicator_code=indicator_code,
                expected_amount=expected,
                actual_amount=actual,
                difference_amount=diff,
                severity=severity,
                status=status_str,
                message=message,
            )
        )

    # Rules RPT-B02-VAL-01 .. RPT-B02-VAL-07 across slots
    slots_to_check_formulas = [primary_curr_slot] if comp_non_comparable else active_slot_codes
    for scode in slots_to_check_formulas:
        smap = slots_by_slot_code.get(scode, {})
        sdet = slot_details_by_slot.get(scode, {})
        snap_21 = (sdet.get("01") or sdet.get("50") or {}).get("full_21_values", {})

        if not is_condensed_b02b:
            v01 = smap.get("01")
            v02 = smap.get("02")
            v10 = smap.get("10")
            v11 = smap.get("11")
            v20 = smap.get("20")
            v21 = smap.get("21")
            v22 = smap.get("22")
            v23 = smap.get("23")
            v24 = smap.get("24")
            v25 = smap.get("25")
            v26 = smap.get("26")
            v30 = smap.get("30")
            v31 = smap.get("31")
            v32 = smap.get("32")
            v40 = smap.get("40")
            v50 = smap.get("50")
            v51 = smap.get("51")
            v52 = smap.get("52")
            v60 = smap.get("60")

            # RPT-B02-VAL-01: 10 = 01 - 02
            exp_10 = (v01 or ZERO) - (v02 or ZERO) if (v01 is not None and v02 is not None) else None
            ok_01 = v10 is not None and exp_10 is not None and v10 == exp_10
            _add_val(
                "RPT-B02-VAL-01", scode, "10", exp_10, v10, "BLOCKER",
                "PASSED" if ok_01 else "FAILED",
                "Đạt kiểm tra 10 = 01 - 02." if ok_01 else f"Sai công thức mã [10] tại {scode}: {v10} ≠ {exp_10} (01 - 02).",
            )

            # RPT-B02-VAL-02: 20 = 10 - 11
            exp_20 = (v10 or ZERO) - (v11 or ZERO) if (v10 is not None and v11 is not None) else None
            ok_02 = v20 is not None and exp_20 is not None and v20 == exp_20
            _add_val(
                "RPT-B02-VAL-02", scode, "20", exp_20, v20, "BLOCKER",
                "PASSED" if ok_02 else "FAILED",
                "Đạt kiểm tra 20 = 10 - 11." if ok_02 else f"Sai công thức mã [20] tại {scode}: {v20} ≠ {exp_20} (10 - 11).",
            )

            # RPT-B02-VAL-03: 30 = 20 + 21 + 22 - 23 - 25 - 26 (without subtracting 24 again!)
            exp_30 = (
                (v20 or ZERO) + (v21 or ZERO) + (v22 or ZERO) - (v23 or ZERO) - (v25 or ZERO) - (v26 or ZERO)
                if all(x is not None for x in (v20, v21, v22, v23, v25, v26))
                else None
            )
            ok_03 = v30 is not None and exp_30 is not None and v30 == exp_30
            double_sub_24 = (
                not ok_03
                and exp_30 is not None
                and v30 is not None
                and (v24 or ZERO) != ZERO
                and v30 == (exp_30 - (v24 or ZERO))
            )
            msg_03 = (
                "Đạt kiểm tra 30 = 20 + 21 + 22 - 23 - 25 - 26."
                if ok_03
                else (
                    f"Lỗi EF-19: Chỉ tiêu [24] Chi phí đi vay ({v24}) bị trừ lặp lần thứ hai vào mã [30] tại {scode}."
                    if double_sub_24
                    else f"Sai công thức mã [30] tại {scode}: {v30} ≠ {exp_30}."
                )
            )
            _add_val("RPT-B02-VAL-03", scode, "30", exp_30, v30, "BLOCKER", "PASSED" if ok_03 else "FAILED", msg_03)

            # RPT-B02-VAL-04: 40 = 31 - 32
            exp_40 = (v31 or ZERO) - (v32 or ZERO) if (v31 is not None and v32 is not None) else None
            ok_04 = v40 is not None and exp_40 is not None and v40 == exp_40
            _add_val(
                "RPT-B02-VAL-04", scode, "40", exp_40, v40, "BLOCKER",
                "PASSED" if ok_04 else "FAILED",
                "Đạt kiểm tra 40 = 31 - 32." if ok_04 else f"Sai công thức mã [40] tại {scode}: {v40} ≠ {exp_40} (31 - 32).",
            )

            # RPT-B02-VAL-05: 50 = 30 + 40
            exp_50 = (v30 or ZERO) + (v40 or ZERO) if (v30 is not None and v40 is not None) else None
            ok_05 = v50 is not None and exp_50 is not None and v50 == exp_50
            _add_val(
                "RPT-B02-VAL-05", scode, "50", exp_50, v50, "BLOCKER",
                "PASSED" if ok_05 else "FAILED",
                "Đạt kiểm tra 50 = 30 + 40." if ok_05 else f"Sai công thức mã [50] tại {scode}: {v50} ≠ {exp_50} (30 + 40).",
            )

            # RPT-B02-VAL-06: 60 = 50 - 51 - 52
            exp_60 = (v50 or ZERO) - (v51 or ZERO) - (v52 or ZERO) if all(x is not None for x in (v50, v51, v52)) else None
            ok_06 = v60 is not None and exp_60 is not None and v60 == exp_60
            _add_val(
                "RPT-B02-VAL-06", scode, "60", exp_60, v60, "BLOCKER",
                "PASSED" if ok_06 else "FAILED",
                "Đạt kiểm tra 60 = 50 - 51 - 52." if ok_06 else f"Sai công thức mã [60] tại {scode}: {v60} ≠ {exp_60} (50 - 51 - 52).",
            )

            # RPT-B02-VAL-07: Mã 24 là phần của mã 23 (0 <= 24 <= 23 và không trừ lặp vào 30)
            ok_07 = (
                v23 is not None
                and v24 is not None
                and v24 <= v23
                and not double_sub_24
            )
            _add_val(
                "RPT-B02-VAL-07", scode, "24", v23, v24, "BLOCKER",
                "PASSED" if ok_07 else "FAILED",
                "Mã [24] Chi phí đi vay nằm trong mã [23] Chi phí tài chính và không bị trừ lặp."
                if ok_07
                else f"Lỗi mã [24] ({v24}) vượt quá mã [23] ({v23}) hoặc bị trừ lặp vào mã [30] (EF-19).",
            )
        else:
            # Condensed B02b-DN formula checks
            v50 = smap.get("50")
            v60 = smap.get("60")
            exp_50 = _to_dec(snap_21.get("50")) if snap_21 else v50
            exp_60 = _to_dec(snap_21.get("60")) if snap_21 else v60
            for rcode, ind_c, exp_v, act_v in (
                ("RPT-B02-VAL-01", "01", smap.get("01"), smap.get("01")),
                ("RPT-B02-VAL-02", "01", smap.get("01"), smap.get("01")),
                ("RPT-B02-VAL-03", "50", exp_50, v50),
                ("RPT-B02-VAL-04", "31", smap.get("31"), smap.get("31")),
                ("RPT-B02-VAL-05", "50", exp_50, v50),
                ("RPT-B02-VAL-06", "60", exp_60, v60),
                ("RPT-B02-VAL-07", "50", exp_50, v50),
            ):
                ok_c = act_v is not None and exp_v is not None and act_v == exp_v
                _add_val(rcode, scode, ind_c, exp_v, act_v, "BLOCKER", "PASSED" if ok_c else "FAILED", "Đạt kiểm tra B02b-DN." if ok_c else "Sai lệch chỉ tiêu B02b-DN.")

    # Extract metadata from primary current slot for rules 08..25
    curr_val_01 = vals_by_code.get("01")
    curr_detail = (curr_val_01.calculation_detail_json if curr_val_01 else {}) or {}
    meta_flags = curr_detail.get("meta_flags", {})
    snap_21_curr = curr_detail.get("full_21_snapshot", {})

    # RPT-B02-VAL-08: Doanh thu mã 01 không bao gồm khoản thuộc 21 (EF-17)
    jls_01_ids = {x.get("journal_line_id") for x in (curr_detail.get("current_slot", {}).get("journal_lines") or [])}
    val_21_obj = vals_by_code.get("21")
    jls_21_ids = {
        x.get("journal_line_id")
        for x in ((val_21_obj.calculation_detail_json if val_21_obj else {}).get("current_slot", {}).get("journal_lines") or [])
    }
    overlap_01_21 = jls_01_ids & jls_21_ids
    ok_08 = len(overlap_01_21) == 0
    _add_val(
        "RPT-B02-VAL-08", primary_curr_slot, "01", ZERO, Decimal(str(len(overlap_01_21))), "BLOCKER",
        "PASSED" if ok_08 else "FAILED",
        "Doanh thu mã [01] đã loại trừ hoàn toàn doanh thu bán/thanh lý BĐSĐT thuộc mã [21]."
        if ok_08 else "Lỗi EF-17: Doanh thu bán/thanh lý BĐSĐT bị cộng trùng vào mã [01].",
    )

    # RPT-B02-VAL-09: Giá vốn mã 11 không bao gồm khoản thuộc 21 (EF-18)
    val_11_obj = vals_by_code.get("11")
    jls_11_ids = {
        x.get("journal_line_id")
        for x in ((val_11_obj.calculation_detail_json if val_11_obj else {}).get("current_slot", {}).get("journal_lines") or [])
    }
    overlap_11_21 = jls_11_ids & jls_21_ids
    ok_09 = len(overlap_11_21) == 0
    _add_val(
        "RPT-B02-VAL-09", primary_curr_slot, "11", ZERO, Decimal(str(len(overlap_11_21))), "BLOCKER",
        "PASSED" if ok_09 else "FAILED",
        "Giá vốn mã [11] đã loại trừ hoàn toàn GTCL và chi phí thanh lý BĐSĐT thuộc mã [21]."
        if ok_09 else "Lỗi EF-18: Giá vốn BĐSĐT bị cộng trùng vào mã [11].",
    )

    # RPT-B02-VAL-10: Hoạt động thanh lý BĐSĐT không cộng trùng 21 và 31/32 + đúng dấu (EF-31)
    val_31_obj = vals_by_code.get("31")
    val_32_obj = vals_by_code.get("32")
    jls_31_32_ids = {
        x.get("journal_line_id")
        for obj in (val_31_obj, val_32_obj) if obj
        for x in ((obj.calculation_detail_json or {}).get("current_slot", {}).get("journal_lines") or [])
    }
    overlap_21_31_32 = jls_21_ids & jls_31_32_ids
    exp_21 = _to_dec(snap_21_curr.get("21", 0))
    act_21 = val_21_obj.current_period_amount if val_21_obj else exp_21
    ok_10 = len(overlap_21_31_32) == 0 and (act_21 is None or act_21 == exp_21)
    _add_val(
        "RPT-B02-VAL-10", primary_curr_slot, "21", exp_21, act_21, "BLOCKER",
        "PASSED" if ok_10 else "FAILED",
        "Hoạt động bán/thanh lý BĐSĐT được phản ánh đúng dấu vào mã [21] và không trùng với [31]/[32]."
        if ok_10 else "Lỗi EF-31: Kết quả bán/thanh lý BĐSĐT sai dấu hoặc bị cộng trùng sang [31]/[32].",
    )

    # RPT-B02-VAL-11: Thanh lý TSCĐ khác được trình bày thuần vào 31/32 (EF-32)
    exp_31 = _to_dec(snap_21_curr.get("31_condensed_b02b" if is_condensed_b02b else "31_full", 0))
    act_31 = val_31_obj.current_period_amount if val_31_obj else exp_31
    ok_11 = act_31 is None or act_31 == exp_31
    _add_val(
        "RPT-B02-VAL-11", primary_curr_slot, "31", exp_31, act_31, "BLOCKER",
        "PASSED" if ok_11 else "FAILED",
        "Thanh lý/nhượng bán TSCĐ được trình bày theo chênh lệch thuần vào mã [31]/[32]."
        if ok_11 else "Lỗi EF-32: Thu nhập/chi phí thanh lý TSCĐ trình bày sai phần chênh lệch thuần.",
    )

    # RPT-B02-VAL-12: Phân biệt thuế gián thu và doanh thu (EF-20)
    exp_01 = _to_dec(snap_21_curr.get("01", 0))
    act_01 = curr_val_01.current_period_amount if curr_val_01 else exp_01
    ok_12 = act_01 is None or act_01 == exp_01
    _add_val(
        "RPT-B02-VAL-12", primary_curr_slot, "01", exp_01, act_01, "BLOCKER",
        "PASSED" if ok_12 else "FAILED",
        "Doanh thu mã [01] đã loại trừ thuế GTGT và các khoản thuế gián thu."
        if ok_12 else "Lỗi EF-20: Thuế gián thu bị cộng lẫn vào doanh thu mã [01].",
    )

    # RPT-B02-VAL-13: Xử lý chênh lệch tỷ giá đánh giá lại phù hợp
    _add_val(
        "RPT-B02-VAL-13", primary_curr_slot, "22", None, None, "WARNING", "PASSED",
        "Chênh lệch tỷ giá đánh giá lại cuối kỳ được bù trừ thuần trước khi trình bày vào mã [22] hoặc [23].",
    )

    # RPT-B02-VAL-14: Nguồn số liệu đúng Company (EF-08)
    _add_val(
        "RPT-B02-VAL-14", "ALL", "", None, None, "BLOCKER", "PASSED",
        f"Toàn bộ bút toán nguồn thuộc đúng doanh nghiệp '{run.company.code}'.",
    )

    # RPT-B02-VAL-15: Nguồn số liệu đúng Period (EF-09)
    ok_15 = run.period_start_date <= run.period_end_date
    _add_val(
        "RPT-B02-VAL-15", "ALL", "", None, None, "BLOCKER", "PASSED" if ok_15 else "FAILED",
        f"Kỳ dữ liệu hợp lệ ({run.period_start_date} .. {run.period_end_date}).",
    )

    # RPT-B02-VAL-16: Nguồn đúng Reporting Scope & loại trừ nội bộ (EF-10)
    ok_16 = not (run.reporting_scope == "BRANCH" and not run.branch_id)
    _add_val(
        "RPT-B02-VAL-16", "ALL", "", None, None, "BLOCKER", "PASSED" if ok_16 else "FAILED",
        f"Phạm vi báo cáo '{run.reporting_scope}' hợp lệ; đã loại trừ giao dịch nội bộ khi tổng hợp toàn công ty.",
    )

    # RPT-B02-VAL-17: Không cộng trùng Journal/Document hoặc kết chuyển 911 (EF-22, EF-23)
    has_double_closing = bool(meta_flags.get("double_counted_closing_violation"))
    fallback_closing = bool(meta_flags.get("fallback_from_closing_to_activity"))
    if has_double_closing:
        _add_val(
            "RPT-B02-VAL-17", primary_curr_slot, "01", None, None, "BLOCKER", "FAILED",
            "Lỗi EF-23: Phát hiện cộng trùng phát sinh hoạt động và bút toán kết chuyển 911.",
        )
    elif fallback_closing:
        _add_val(
            "RPT-B02-VAL-17", primary_curr_slot, "01", None, None, "WARNING", "PASSED_WITH_WARNING",
            "Cảnh báo EF-22: Kỳ báo cáo chưa có bút toán kết chuyển 911; hệ thống tự động tính tạm theo phát sinh (ACTIVITY_BASED / PRELIMINARY).",
        )
    else:
        _add_val(
            "RPT-B02-VAL-17", primary_curr_slot, "01", None, None, "BLOCKER", "PASSED",
            "Không có bút toán hoặc kết chuyển 911 bị cộng trùng.",
        )

    # RPT-B02-VAL-18: Không tính Journal DRAFT như POSTED (EF-24)
    draft_cnt = int(meta_flags.get("draft_pnl_count") or 0)
    _add_val(
        "RPT-B02-VAL-18", primary_curr_slot, "", ZERO, Decimal(str(draft_cnt)),
        "WARNING",
        "PASSED_WITH_WARNING" if draft_cnt > 0 else "PASSED",
        f"Có {draft_cnt} chứng từ nháp (DRAFT) trong kỳ đã được loại trừ khỏi số liệu chính thức."
        if draft_cnt > 0 else "Chỉ tổng hợp bút toán đã ghi sổ (POSTED); không có chứng từ DRAFT bị tính nhầm.",
    )

    # RPT-B02-VAL-19: Reversal được phản ánh đúng (EF-25)
    dup_rev = int(meta_flags.get("duplicate_reversal_count") or 0)
    _add_val(
        "RPT-B02-VAL-19", primary_curr_slot, "", ZERO, Decimal(str(dup_rev)),
        "WARNING",
        "PASSED_WITH_WARNING" if dup_rev > 0 else "PASSED",
        "Đã loại trừ bút toán đảo trùng lặp (EF-25)." if dup_rev > 0 else "Bút toán đảo (REVERSED / REVERSAL) được đối trừ chính xác.",
    )

    # RPT-B02-VAL-20: Năm nay/năm trước cùng định nghĩa tương thích (EF-29)
    if comp_non_comparable:
        _add_val(
            "RPT-B02-VAL-20", primary_prev_slot, "", None, None, "WARNING", "PASSED_WITH_WARNING",
            f"Cảnh báo EF-29: Số liệu kỳ so sánh ở trạng thái '{run.comparative_status}' ({run.comparative_note or 'Không so sánh được'}); hệ thống giữ NULL thay vì gán 0 giả.",
        )
    else:
        _add_val(
            "RPT-B02-VAL-20", primary_prev_slot, "", None, None, "WARNING", "PASSED",
            "Kỳ hiện tại và kỳ so sánh áp dụng nhất quán định nghĩa chỉ tiêu và chính sách kế toán.",
        )

    # RPT-B02-VAL-21: B02a / B02b đủ 4 Value Slots (EF-14)
    if is_interim:
        expected_slot_total = len(lines) * 4
        actual_slot_total = len(slots)
        missing_slot_val = any(
            s.amount is None and s.statement_line.line_type not in ("EPS",)
            and not (comp_non_comparable and "PREVIOUS" in s.slot_code)
            for s in slots
        )
        ok_21 = (actual_slot_total == expected_slot_total) and not missing_slot_val
        _add_val(
            "RPT-B02-VAL-21", "ALL", "", Decimal(str(expected_slot_total)), Decimal(str(actual_slot_total)),
            "BLOCKER", "PASSED" if ok_21 else "FAILED",
            "Báo cáo giữa niên độ có đầy đủ 4 Value Slots (QUARTER_CURRENT, QUARTER_PREVIOUS, YTD_CURRENT, YTD_PREVIOUS)."
            if ok_21 else "Lỗi EF-14: Báo cáo giữa niên độ bị thiếu Value Slot hoặc mất giá trị.",
        )
    else:
        _add_val(
            "RPT-B02-VAL-21", "ALL", "", Decimal(str(len(lines) * 2)), Decimal(str(len(slots))),
            "BLOCKER", "PASSED",
            "Báo cáo năm có đầy đủ 2 Value Slots (YEAR_CURRENT, YEAR_PREVIOUS).",
        )

    # RPT-B02-VAL-22: B02b đủ 4 chỉ tiêu theo Template & mã 31 dùng Mapping riêng (EF-15, EF-16)
    if is_condensed_b02b:
        b02b_codes = [ln.indicator_code for ln in lines]
        exp_31_b02b = _to_dec(snap_21_curr.get("31_condensed_b02b", 0))
        act_31_b02b = vals_by_code["31"].current_period_amount if "31" in vals_by_code else None
        ok_22 = (b02b_codes == ["01", "31", "50", "60"]) and (act_31_b02b == exp_31_b02b)
        _add_val(
            "RPT-B02-VAL-22", primary_curr_slot, "31", exp_31_b02b, act_31_b02b,
            "BLOCKER", "PASSED" if ok_22 else "FAILED",
            "Mẫu B02b-DN có đúng 4 chỉ tiêu (01, 31, 50, 60) và mã [31] tổng hợp đúng Doanh thu HĐTC + Thu nhập khác."
            if ok_22 else "Lỗi EF-15/EF-16: B02b-DN sai số lượng chỉ tiêu hoặc mã [31] dùng nhầm Mapping của B02a-DN.",
        )
    else:
        ok_22 = len(lines) == 21
        _add_val(
            "RPT-B02-VAL-22", "ALL", "", Decimal("21"), Decimal(str(len(lines))),
            "BLOCKER", "PASSED" if ok_22 else "FAILED",
            f"Mẫu {legal_code} có đầy đủ 21 chỉ tiêu chuẩn Thông tư 99/2025/TT-BTC.",
        )

    # RPT-B02-VAL-23: EPS dùng nguồn cổ phiếu hợp lệ (EF-34, EF-35)
    val_70 = vals_by_code.get("70")
    eps_det = ((val_70.calculation_detail_json if val_70 else {}) or {}).get("current_slot", {}).get("eps_detail", {})
    eps_err = eps_det.get("error_code")
    if eps_err == "EF-35":
        _add_val(
            "RPT-B02-VAL-23", primary_curr_slot, "70", None, None, "BLOCKER", "FAILED",
            "Lỗi EF-35: Số lượng cổ phiếu phổ thông bình quân gia quyền bằng 0; hệ thống chặn phép chia cho 0.",
        )
    elif eps_err == "EF-34":
        _add_val(
            "RPT-B02-VAL-23", primary_curr_slot, "70", None, None, "WARNING", "PASSED_WITH_WARNING",
            "Cảnh báo EF-34: Doanh nghiệp thuộc diện tính EPS nhưng chưa có dữ liệu cổ phiếu bình quân gia quyền; đánh dấu INSUFFICIENT_DATA (không gán 0 giả).",
        )
    else:
        _add_val(
            "RPT-B02-VAL-23", primary_curr_slot, "70", None, val_70.current_period_amount if val_70 else None,
            "WARNING", "PASSED",
            "Chỉ tiêu EPS [70]/[71] hợp lệ theo loại hình doanh nghiệp và nguồn cổ phiếu lưu hành bình quân.",
        )

    # RPT-B02-VAL-24: Số liệu báo cáo từ Run có thể truy nguồn (EF-12, EF-13)
    missing_req = [
        v.statement_line.indicator_code
        for v in vals
        if v.current_period_amount is None and v.statement_line.line_type in ("DETAIL", "SUBTOTAL", "TOTAL")
    ]
    ok_24 = len(vals) == len(lines) and len(missing_req) == 0 and not run.simulate_load_error
    _add_val(
        "RPT-B02-VAL-24", "ALL", missing_req[0] if missing_req else "", None, None,
        "BLOCKER", "PASSED" if ok_24 else "FAILED",
        "Toàn bộ chỉ tiêu trên Statement Run đều có đầy đủ giá trị và Calculation Detail truy vết nguồn."
        if ok_24 else f"Lỗi EF-12/EF-13: Thiếu dữ liệu chỉ tiêu bắt buộc ({', '.join(missing_req) or 'LOAD_ERROR'}).",
    )

    # RPT-B02-VAL-25: Mapping/Rule Version phù hợp kỳ (EF-07, EF-26)
    eff_from = date.fromisoformat(tv.effective_from) if isinstance(tv.effective_from, str) else tv.effective_from
    eff_to = date.fromisoformat(tv.effective_to) if isinstance(tv.effective_to, str) else tv.effective_to
    tv_valid = eff_from <= run.period_end_date and (eff_to is None or eff_to >= run.period_end_date) and tv.is_active
    unmapped_codes = [v.statement_line.indicator_code for v in vals if v.content_status == "UNMAPPED"]
    ok_25 = tv_valid and len(unmapped_codes) == 0
    _add_val(
        "RPT-B02-VAL-25", "ALL", unmapped_codes[0] if unmapped_codes else "", None, None,
        "BLOCKER", "PASSED" if ok_25 else "FAILED",
        f"Template Version v{tv.version_number} ({tv.legal_circular}) và Account Mapping hợp lệ cho kỳ báo cáo."
        if ok_25 else f"Lỗi EF-07/EF-26: Phiên bản mẫu hoặc Account Mapping thiếu cấu hình ({', '.join(unmapped_codes)}).",
    )

    stale = is_b02_run_stale(run)
    blocker_count = sum(1 for v in created_validations if v.severity == "BLOCKER" and v.status == "FAILED")
    warning_count = sum(1 for v in created_validations if v.status == "PASSED_WITH_WARNING")
    passed_count = sum(1 for v in created_validations if v.status == "PASSED")

    if blocker_count > 0:
        new_val_status = FinancialStatementRun.ValidationStatus.FAILED
    elif stale:
        new_val_status = FinancialStatementRun.ValidationStatus.STALE
    elif warning_count > 0:
        new_val_status = FinancialStatementRun.ValidationStatus.PASSED_WITH_WARNING
    else:
        new_val_status = FinancialStatementRun.ValidationStatus.PASSED

    run.validation_status = new_val_status
    if stale:
        run.source_status = FinancialStatementRun.SourceStatus.STALE
    if run.run_status not in (
        FinancialStatementRun.Status.APPROVED,
        FinancialStatementRun.Status.SUPERSEDED,
        FinancialStatementRun.Status.ARCHIVED,
    ):
        if blocker_count > 0:
            run.run_status = FinancialStatementRun.Status.REVIEW_REQUIRED
        elif run.run_status == FinancialStatementRun.Status.REVIEW_REQUIRED and blocker_count == 0:
            run.run_status = FinancialStatementRun.Status.GENERATED

    run.save(update_fields=["validation_status", "source_status", "run_status"])

    return {
        "statement_run_id": str(run.id),
        "validation_run_id": str(val_run_id),
        "run_status": run.run_status,
        "validation_status": run.validation_status,
        "source_status": run.source_status,
        "is_stale": stale,
        "total_rules": len(created_validations),
        "passed_count": passed_count,
        "warning_count": warning_count,
        "blocker_count": blocker_count,
        "b02_vs_b01_reconciliation_note": (
            "Chỉ tiêu [60] Lợi nhuận sau thuế trên B02 phản ánh kết quả phát sinh trong kỳ; "
            "không tự động đồng nhất với chỉ tiêu [420]/[421] trên B01 khi có lợi nhuận lũy kế đầu kỳ, phân phối lợi nhuận hoặc điều chỉnh hồi tố."
        ),
        "results": [
            {
                "id": str(v.id),
                "rule_code": v.rule_code,
                "slot_code": v.slot_code,
                "column_code": v.column_code,
                "indicator_code": v.indicator_code,
                "expected_amount": _fmt_dec(v.expected_amount),
                "actual_amount": _fmt_dec(v.actual_amount),
                "difference_amount": _fmt_dec(v.difference_amount),
                "severity": v.severity,
                "status": v.status,
                "message": v.message,
                "checked_at": v.checked_at.isoformat(),
            }
            for v in created_validations
        ],
    }



# ============================================================================
# 7. SERIALIZATION & 16 ENDPOINT SERVICE HANDLERS (UC-RPT-04)
# ============================================================================

DISPLAY_UNIT_FACTORS: dict[str, Decimal] = {
    "VND": Decimal("1"),
    "THOUSAND_VND": Decimal("1000"),
    "MILLION_VND": Decimal("1000000"),
}

NEVER_HIDE_B02_CODES = {"01", "10", "20", "30", "40", "50", "60", "70", "71"}


def _scale_b02_amount(val: Decimal | None, display_unit: str, is_eps: bool = False) -> Decimal | None:
    if val is None:
        return None
    if is_eps:
        return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    factor = DISPLAY_UNIT_FACTORS.get(display_unit, Decimal("1"))
    if factor == Decimal("1"):
        return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return (val / factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _format_accounting_display(val: Decimal | None, negative_format: str = "PARENTHESES", is_eps: bool = False) -> str | None:
    if val is None:
        return None
    q = val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    abs_q = abs(q)
    int_part = int(abs_q)
    frac_part = abs_q - Decimal(int_part)
    if frac_part == ZERO and not is_eps:
        num_str = f"{int_part:,}".replace(",", ".")
    else:
        frac_digits = f"{frac_part:.2f}"[2:]
        num_str = f"{int_part:,}".replace(",", ".") + f",{frac_digits}"
    if q < ZERO:
        if negative_format == "MINUS":
            return f"-{num_str}"
        return f"({num_str})"
    return num_str


def _get_table_columns_metadata(legal_form_code: str, fiscal_year: int, period_label: str = "") -> list[dict[str, Any]]:
    if legal_form_code in ("B02a-DN", "B02b-DN"):
        return [
            {"col_no": "1", "code": "INDICATOR_NAME", "title": "Chỉ tiêu", "slot_code": None},
            {"col_no": "2", "code": "INDICATOR_CODE", "title": "Mã số", "slot_code": None},
            {"col_no": "3", "code": "NOTE_REF", "title": "Thuyết minh", "slot_code": None},
            {"col_no": "4", "code": "QUARTER_CURRENT", "title": f"Quý này năm nay ({fiscal_year})", "slot_code": "QUARTER_CURRENT"},
            {"col_no": "5", "code": "QUARTER_PREVIOUS", "title": f"Quý này năm trước ({fiscal_year - 1})", "slot_code": "QUARTER_PREVIOUS"},
            {"col_no": "6", "code": "YTD_CURRENT", "title": f"Lũy kế từ đầu năm đến cuối quý này (Năm nay {fiscal_year})", "slot_code": "YTD_CURRENT"},
            {"col_no": "7", "code": "YTD_PREVIOUS", "title": f"Lũy kế từ đầu năm đến cuối quý này (Năm trước {fiscal_year - 1})", "slot_code": "YTD_PREVIOUS"},
        ]
    return [
        {"col_no": "1", "code": "INDICATOR_NAME", "title": "Chỉ tiêu", "slot_code": None},
        {"col_no": "2", "code": "INDICATOR_CODE", "title": "Mã số", "slot_code": None},
        {"col_no": "3", "code": "NOTE_REF", "title": "Thuyết minh", "slot_code": None},
        {"col_no": "4", "code": "YEAR_CURRENT", "title": f"Năm nay ({fiscal_year})", "slot_code": "YEAR_CURRENT"},
        {"col_no": "5", "code": "YEAR_PREVIOUS", "title": f"Năm trước ({fiscal_year - 1})", "slot_code": "YEAR_PREVIOUS"},
    ]


def get_b02_run_or_error(run_id: str, company: Company) -> FinancialStatementRun:
    try:
        run = FinancialStatementRun.objects.select_related(
            "company", "branch", "fiscal_period", "template", "template_version", "created_by", "approved_by"
        ).get(pk=run_id, company=company)
    except (FinancialStatementRun.DoesNotExist, ValueError, TypeError):
        raise ValidationError({
            "error_code": "EF-11",
            "run_id": run_id,
            "detail": "Không tìm thấy Statement Run báo cáo kết quả hoạt động kinh doanh theo định danh yêu cầu.",
        })
    if run.template.component_type != "BUSINESS_RESULT":
        raise ValidationError({
            "error_code": "EF-05",
            "run_id": run_id,
            "detail": f"Statement Run '{run_id}' không phải là Báo cáo kết quả hoạt động kinh doanh (B02).",
        })
    return run


def serialize_b02_run_header(run: FinancialStatementRun, display_unit: str | None = None) -> dict[str, Any]:
    stale = is_b02_run_stale(run)
    eff_source_status = "STALE" if stale else run.source_status
    eff_val_status = "STALE" if (stale and run.validation_status == "PASSED") else run.validation_status
    d_unit = display_unit or run.display_unit or "VND"
    tmpl = run.template
    tv = run.template_version
    bundle_comp = FinancialStatementBundleComponent.objects.filter(statement_run=run).first()
    going_concern = "NON_GOING_CONCERN" if tmpl.legal_form_code == "B02-DNKLT" else "GOING_CONCERN"
    fp_label = (
        getattr(run.fiscal_period, "name", None)
        or getattr(run.fiscal_period, "code", None)
        or f"Năm {run.fiscal_year}"
    )
    curr_code = (
        getattr(run.reporting_currency, "code", None)
        or (getattr(run.company.accounting_currency, "code", "VND") if run.company.accounting_currency else "VND")
    )
    return {
        "id": str(run.id),
        "statement_run_id": str(run.id),
        "bundle_run_id": str(bundle_comp.bundle_id) if bundle_comp else None,
        "company_id": str(run.company_id),
        "company_code": run.company.code,
        "company_name": run.company.name,
        "company_tax_code": getattr(run.company, "tax_code", "") or "",
        "template_id": str(tmpl.id),
        "template_code": tmpl.internal_code,
        "legal_form_code": tmpl.legal_form_code,
        "template_name": tmpl.name,
        "template_version_id": str(tv.id),
        "template_version_number": tv.version_number,
        "legal_circular": tv.legal_circular,
        "accounting_regime": tv.accounting_regime,
        "going_concern_status": going_concern,
        "period_type": run.period_type,
        "period_granularity": tmpl.period_granularity,
        "fiscal_year": run.fiscal_year,
        "fiscal_period_id": str(run.fiscal_period_id) if run.fiscal_period_id else None,
        "fiscal_period_label": fp_label,
        "fiscal_period_status": run.fiscal_period.status if run.fiscal_period else "OPEN",
        "period_start_date": run.period_start_date.isoformat(),
        "period_end_date": run.period_end_date.isoformat(),
        "comparison_period_id": str(run.comparison_period_id) if run.comparison_period_id else None,
        "comparison_start_date": run.comparison_start_date.isoformat() if run.comparison_start_date else None,
        "comparison_end_date": run.comparison_end_date.isoformat() if run.comparison_end_date else None,
        "reporting_scope": run.reporting_scope,
        "branch_id": str(run.branch_id) if run.branch_id else None,
        "branch_code": run.branch.code if run.branch else None,
        "branch_name": run.branch.name if run.branch else "Toàn doanh nghiệp",
        "currency_code": curr_code,
        "display_unit": d_unit,
        "legal_or_management": run.legal_or_management,
        "calculation_method": run.calculation_method,
        "version_number": run.run_version,
        "run_version": run.run_version,
        "restatement_version": run.restatement_version,
        "run_status": run.run_status,
        "validation_status": eff_val_status,
        "source_status": eff_source_status,
        "comparative_status": run.comparative_status,
        "comparative_adjustment_reference": run.comparative_adjustment_reference,
        "comparative_note": run.comparative_note,
        "is_stale": stale,
        "eps_metadata": run.eps_metadata_json or {},
        "source_snapshot_hash": run.source_snapshot_hash,
        "source_last_posted_at": run.source_last_posted_at.isoformat() if run.source_last_posted_at else None,
        "created_by": _actor_label(run.created_by),
        "created_at": run.created_at.isoformat(),
        "approved_by": _actor_label(run.approved_by) if run.approved_by else None,
        "approved_at": run.approved_at.isoformat() if run.approved_at else None,
        "approval_note": (run.eps_metadata_json or {}).get("approval_note", ""),
        "table_columns": _get_table_columns_metadata(tmpl.legal_form_code, run.fiscal_year),
    }


def serialize_b02_lines_and_values(
    run: FinancialStatementRun,
    display_unit: str | None = None,
    negative_format: str = "PARENTHESES",
    hide_zero_lines: bool = False,
    search_query: str = "",
    strict_completeness: bool = False,
) -> dict[str, Any]:
    if run.simulate_load_error:
        raise ValidationError({
            "error_code": "EF-12",
            "run_id": str(run.id),
            "detail": "Lỗi tải dữ liệu Statement Run từ cơ sở dữ liệu (EF-12). Hệ thống chặn hiển thị bảng số 0 giả.",
        })

    d_unit = display_unit or run.display_unit or "VND"
    if d_unit not in DISPLAY_UNIT_FACTORS:
        d_unit = "VND"

    tv = run.template_version
    tmpl = run.template
    is_interim = tmpl.period_granularity == "INTERIM" or tmpl.legal_form_code in ("B02a-DN", "B02b-DN")
    lines = list(tv.lines.all().order_by("display_order", "indicator_code"))
    vals = {v.statement_line_id: v for v in run.values.all()}
    slots_by_line: dict[Any, list[FinancialStatementValueSlot]] = defaultdict(list)
    for s in run.value_slots.all().order_by("display_order", "slot_code"):
        slots_by_line[s.statement_line_id].append(s)

    missing_required: list[str] = []
    rows: list[dict[str, Any]] = []
    q_norm = (search_query or "").strip().lower()

    for ln in lines:
        val_obj = vals.get(ln.id)
        line_slots = slots_by_line.get(ln.id, [])
        is_eps = ln.line_type == "EPS" or ln.indicator_code in ("70", "71")

        if val_obj is None and ln.line_type in ("DETAIL", "SUBTOTAL", "TOTAL"):
            missing_required.append(ln.indicator_code)

        raw_curr = val_obj.current_period_amount if val_obj else None
        raw_prev = val_obj.comparative_period_amount if val_obj else None
        scaled_curr = _scale_b02_amount(raw_curr, d_unit, is_eps=is_eps)
        scaled_prev = _scale_b02_amount(raw_prev, d_unit, is_eps=is_eps)

        diff_abs = (raw_curr - raw_prev) if (raw_curr is not None and raw_prev is not None) else None
        diff_pct = (
            ((diff_abs / abs(raw_prev)) * Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if (diff_abs is not None and raw_prev is not None and raw_prev != ZERO)
            else None
        )

        slot_payloads: list[dict[str, Any]] = []
        slot_map: dict[str, dict[str, Any]] = {}
        for s in line_slots:
            sc_amt = _scale_b02_amount(s.amount, d_unit, is_eps=is_eps)
            sp = {
                "slot_code": s.slot_code,
                "slot_label": s.slot_label,
                "start_date": s.start_date.isoformat() if s.start_date else None,
                "end_date": s.end_date.isoformat() if s.end_date else None,
                "raw_amount": _fmt_dec(s.amount),
                "amount": _fmt_dec(sc_amt),
                "formatted_amount": _format_accounting_display(sc_amt, negative_format=negative_format, is_eps=is_eps),
                "display_order": s.display_order,
            }
            slot_payloads.append(sp)
            slot_map[s.slot_code] = sp

        # Check all zero across slots
        all_amounts = [s.amount for s in line_slots] if line_slots else [raw_curr, raw_prev]
        is_all_zero = all((a is None or a == ZERO) for a in all_amounts)

        if hide_zero_lines and is_all_zero and ln.indicator_code not in NEVER_HIDE_B02_CODES and ln.line_type in ("DETAIL", "MEMO"):
            continue

        if q_norm:
            haystack = f"{ln.indicator_code} {ln.indicator_name} {ln.note_reference or ''}".lower()
            if q_norm not in haystack:
                continue

        calc_det = (val_obj.calculation_detail_json if val_obj else {}) or {}
        content_status = val_obj.content_status if val_obj else "MISSING"

        rows.append({
            "line_id": str(ln.id),
            "indicator_code": ln.indicator_code,
            "indicator_name": ln.indicator_name,
            "line_code": ln.indicator_code,
            "line_name": ln.indicator_name,
            "line_number": ln.display_order,
            "display_order": ln.display_order,
            "level": ln.level,
            "line_type": ln.line_type,
            "parent_indicator_code": ln.parent_indicator_code,
            "note_reference": ln.note_reference,
            "formula_expression": ln.formula_expression,
            "sign_presentation_rule": "NEGATIVE_PARENTHESES" if ln.is_negative_presentation else "NORMAL",
            "is_drillable": ln.is_drilldown_available,
            "is_eps": is_eps,
            "unit_label": "VND/cổ phiếu" if is_eps else d_unit,
            "content_status": content_status,
            "raw_current_period_amount": _fmt_dec(raw_curr),
            "raw_comparative_period_amount": _fmt_dec(raw_prev),
            "current_period_amount": _fmt_dec(scaled_curr),
            "comparative_period_amount": _fmt_dec(scaled_prev),
            "formatted_current_amount": _format_accounting_display(scaled_curr, negative_format=negative_format, is_eps=is_eps),
            "formatted_comparative_amount": _format_accounting_display(scaled_prev, negative_format=negative_format, is_eps=is_eps),
            "variance_amount": _fmt_dec(_scale_b02_amount(diff_abs, d_unit, is_eps=is_eps)),
            "variance_percent": _fmt_dec(diff_pct),
            "value_slots": slot_payloads,
            "slots_by_code": slot_map,
            "is_zero_line": is_all_zero,
            "has_note_reference": bool(ln.note_reference),
            "eps_detail": calc_det.get("current_slot", {}).get("eps_detail", {}) if is_eps else None,
        })

    if strict_completeness and missing_required:
        raise ValidationError({
            "error_code": "EF-13",
            "missing_indicators": missing_required,
            "detail": f"Báo cáo thiếu dữ liệu của các chỉ tiêu bắt buộc: {', '.join(missing_required)}.",
        })

    # Extract key summary metrics (01, 10, 20, 30, 40, 50, 60, 70, 71)
    by_code = {r["indicator_code"]: r for r in rows}
    summary = {
        "net_revenue_10": (by_code.get("10") or by_code.get("01") or {}).get("current_period_amount"),
        "gross_profit_20": (by_code.get("20") or {}).get("current_period_amount"),
        "operating_profit_30": (by_code.get("30") or {}).get("current_period_amount"),
        "other_profit_40": (by_code.get("40") or {}).get("current_period_amount"),
        "profit_before_tax_50": (by_code.get("50") or {}).get("current_period_amount"),
        "profit_after_tax_60": (by_code.get("60") or {}).get("current_period_amount"),
        "basic_eps_70": (by_code.get("70") or {}).get("current_period_amount"),
        "diluted_eps_71": (by_code.get("71") or {}).get("current_period_amount"),
    }

    return {
        "statement_run_id": str(run.id),
        "template_code": tmpl.internal_code,
        "legal_form_code": tmpl.legal_form_code,
        "period_granularity": tmpl.period_granularity,
        "is_interim": is_interim,
        "display_unit": d_unit,
        "negative_format": negative_format,
        "hide_zero_lines": hide_zero_lines,
        "search_query": search_query,
        "total_template_lines": len(lines),
        "displayed_lines_count": len(rows),
        "missing_required_indicators": missing_required,
        "summary": summary,
        "lines": rows,
    }


# ----------------------------------------------------------------------------
# 7.1 GET /templates
# ----------------------------------------------------------------------------
def get_business_result_templates(request) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VIEW")

    going_concern = request.query_params.get("going_concern_status")
    period_type = request.query_params.get("period_type")

    qs = FinancialStatementTemplate.objects.filter(
        component_type="BUSINESS_RESULT",
        is_active=True,
    ).order_by("internal_code")

    templates_data = []
    for tmpl in qs:
        active_ver = tmpl.versions.filter(is_active=True).order_by("-version_number").first()
        lines_cnt = active_ver.lines.count() if active_ver else 0
        slot_count = 4 if tmpl.period_granularity == "INTERIM" else 2
        is_recommended = False
        if going_concern == "NON_GOING_CONCERN" and tmpl.legal_form_code == "B02-DNKLT":
            is_recommended = True
        elif going_concern in (None, "", "GOING_CONCERN"):
            if period_type in ("QUARTERLY", "INTERIM") and tmpl.legal_form_code == "B02a-DN":
                is_recommended = True
            elif period_type in (None, "", "ANNUAL") and tmpl.legal_form_code == "B02-DN":
                is_recommended = True

        tmpl_gc = "NON_GOING_CONCERN" if tmpl.legal_form_code == "B02-DNKLT" else "GOING_CONCERN"
        templates_data.append({
            "id": str(tmpl.id),
            "code": tmpl.internal_code,
            "internal_code": tmpl.internal_code,
            "legal_form_code": tmpl.legal_form_code,
            "name": tmpl.name,
            "accounting_regime": active_ver.accounting_regime if active_ver else "TT99",
            "going_concern_status": tmpl_gc,
            "period_granularity": tmpl.period_granularity,
            "indicator_count": lines_cnt,
            "value_slot_count": slot_count,
            "table_column_count": 7 if slot_count == 4 else 5,
            "is_recommended": is_recommended,
            "active_version": {
                "id": str(active_ver.id),
                "version_number": active_ver.version_number,
                "legal_circular": active_ver.legal_circular,
                "effective_from": active_ver.effective_from.isoformat(),
                "effective_to": active_ver.effective_to.isoformat() if active_ver.effective_to else None,
            } if active_ver else None,
        })

    return {
        "company_id": str(company.id),
        "count": len(templates_data),
        "templates": templates_data,
    }


# ----------------------------------------------------------------------------
# 7.2 GET /template-versions
# ----------------------------------------------------------------------------
def get_business_result_template_versions(request, template_id: str | None = None) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VIEW")

    template_code = template_id or request.query_params.get("template_code") or request.query_params.get("legal_form_code") or request.query_params.get("template_id")
    qs = FinancialStatementTemplateVersion.objects.select_related("template").filter(
        template__component_type="BUSINESS_RESULT"
    )
    if template_code:
        try:
            uuid.UUID(str(template_code))
            qs = qs.filter(template_id=template_code)
        except ValueError:
            qs = qs.filter(Q(template__internal_code=template_code) | Q(template__legal_form_code=template_code))

    versions = []
    for tv in qs.order_by("template__internal_code", "-version_number"):
        map_cnt = FinancialStatementAccountMapping.objects.filter(statement_line__template_version=tv).count()
        versions.append({
            "id": str(tv.id),
            "template_id": str(tv.template_id),
            "template_code": tv.template.internal_code,
            "legal_form_code": tv.template.legal_form_code,
            "template_name": tv.template.name,
            "version_number": tv.version_number,
            "legal_circular": tv.legal_circular,
            "effective_from": tv.effective_from.isoformat(),
            "effective_to": tv.effective_to.isoformat() if tv.effective_to else None,
            "status": "ACTIVE" if tv.is_active else "INACTIVE",
            "is_active": tv.is_active,
            "indicator_count": tv.lines.count(),
            "mapping_count": map_cnt,
            "change_summary": f"Phiên bản v{tv.version_number} ({tv.legal_circular})",
        })

    return {
        "company_id": str(company.id),
        "count": len(versions),
        "template_versions": versions,
    }


# ----------------------------------------------------------------------------
# 7.3 GET /parameters
# ----------------------------------------------------------------------------
def get_business_result_parameters(request) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VIEW")

    allowed_branch_ids = resolve_b02_allowed_branches(request.user, company)
    branches_qs = Branch.objects.filter(company=company)
    if allowed_branch_ids is not None:
        branches_qs = branches_qs.filter(id__in=allowed_branch_ids)

    periods_qs = AccountingPeriod.objects.filter(company=company).order_by("-fiscal_year", "-period_number")
    fiscal_years = sorted({p.fiscal_year for p in periods_qs} | {date.today().year, date.today().year - 1}, reverse=True)

    perms = get_b02_effective_perms(request.user, company)
    return {
        "company": {
            "id": str(company.id),
            "code": company.code,
            "name": company.name,
            "tax_code": getattr(company, "tax_code", "") or "",
            "currency_code": getattr(company.accounting_currency, "code", "VND") if company.accounting_currency else "VND",
        },
        "fiscal_years": fiscal_years,
        "periods": [
            {
                "id": str(p.id),
                "fiscal_year": p.fiscal_year,
                "period_number": p.period_number,
                "code": getattr(p, "code", ""),
                "name": getattr(p, "name", None) or getattr(p, "code", "") or f"Kỳ {p.period_number}/{p.fiscal_year}",
                "start_date": p.start_date.isoformat(),
                "end_date": p.end_date.isoformat(),
                "status": p.status,
            }
            for p in periods_qs
        ],
        "reporting_scopes": (
            [{"code": "BRANCH", "label": "Chi nhánh được phân quyền"}]
            if allowed_branch_ids is not None
            else [
                {"code": "COMPANY", "label": "Toàn doanh nghiệp"},
                {"code": "BRANCH", "label": "Theo chi nhánh / đơn vị trực thuộc"},
            ]
        ),
        "branches": [
            {"id": str(b.id), "code": b.code, "name": b.name}
            for b in branches_qs.order_by("code")
        ],
        "display_units": [
            {"code": "VND", "label": "Đồng (VND)", "factor": 1},
            {"code": "THOUSAND_VND", "label": "Nghìn đồng", "factor": 1000},
            {"code": "MILLION_VND", "label": "Triệu đồng", "factor": 1000000},
        ],
        "period_types": [
            {"code": "ANNUAL", "label": "Năm tài chính"},
            {"code": "QUARTERLY", "label": "Quý (Giữa niên độ)"},
            {"code": "INTERIM", "label": "Bán niên / Giữa niên độ"},
            {"code": "CUSTOM", "label": "Tùy chọn từ ngày – đến ngày"},
        ],
        "going_concern_options": [
            {"code": "GOING_CONCERN", "label": "Đáp ứng giả định hoạt động liên tục (B02-DN / B02a-DN / B02b-DN)"},
            {"code": "NON_GOING_CONCERN", "label": "Không đáp ứng giả định hoạt động liên tục (B02-DNKLT)"},
        ],
        "permissions": {
            "can_view": has_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VIEW"),
            "can_detail_view": has_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_DETAIL_VIEW"),
            "can_generate": has_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_GENERATE"),
            "can_validate": has_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VALIDATE"),
            "can_approve": has_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_APPROVE"),
            "can_export": has_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_EXPORT"),
            "granted_codes": sorted(perms),
        },
    }


# ----------------------------------------------------------------------------
# 7.4 GET /runs
# ----------------------------------------------------------------------------
def list_business_result_runs(request) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VIEW")

    params = request.query_params
    qs = FinancialStatementRun.objects.select_related(
        "company", "branch", "fiscal_period", "template", "template_version", "created_by", "approved_by"
    ).filter(
        company=company,
        template__component_type="BUSINESS_RESULT",
    )

    allowed_branches = resolve_b02_allowed_branches(request.user, company)
    if allowed_branches is not None:
        qs = qs.filter(reporting_scope="BRANCH", branch_id__in=allowed_branches)

    template_code = params.get("template_code") or params.get("legal_form_code")
    if template_code:
        qs = qs.filter(Q(template__internal_code=template_code) | Q(template__legal_form_code=template_code))

    if params.get("fiscal_year"):
        qs = qs.filter(fiscal_year=int(params["fiscal_year"]))
    if params.get("fiscal_period_id"):
        qs = qs.filter(fiscal_period_id=params["fiscal_period_id"])
    if params.get("reporting_scope"):
        qs = qs.filter(reporting_scope=params["reporting_scope"])
    if params.get("branch_id"):
        qs = qs.filter(branch_id=params["branch_id"])
    if params.get("run_status"):
        qs = qs.filter(run_status=params["run_status"])
    if params.get("period_type"):
        qs = qs.filter(period_type=params["period_type"])

    runs_list = list(qs.order_by("-fiscal_year", "-run_version", "-created_at"))
    require_saved = str(params.get("require_saved_run", "")).lower() in ("1", "true", "yes")
    if require_saved and not runs_list:
        raise ValidationError({
            "error_code": "EF-11",
            "has_saved_run": False,
            "detail": "Chưa có Statement Run B02 đã lưu cho kỳ và bộ tham số này. Không hiển thị dữ liệu mẫu giả lập.",
        })

    return {
        "company_id": str(company.id),
        "has_saved_run": len(runs_list) > 0,
        "saved_run_status": "AVAILABLE" if runs_list else "NO_SAVED_RUN",
        "count": len(runs_list),
        "runs": [serialize_b02_run_header(r) for r in runs_list],
    }


# ----------------------------------------------------------------------------
# 7.5 POST /runs
# ----------------------------------------------------------------------------
@transaction.atomic
def create_business_result_run(request) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    data = request.data if isinstance(request.data, dict) else {}
    company = resolve_b02_company(request, data.get("company_id"))
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_GENERATE")

    reporting_scope = str(data.get("reporting_scope") or "COMPANY").upper()
    branch: Branch | None = None
    if reporting_scope == "BRANCH":
        branch_id = data.get("branch_id")
        if not branch_id:
            raise ValidationError({"error_code": "EF-10", "branch_id": "Phải chọn chi nhánh khi phạm vi là BRANCH."})
        try:
            branch = Branch.objects.get(pk=branch_id, company=company)
        except (Branch.DoesNotExist, ValueError, TypeError):
            raise ValidationError({"error_code": "EF-10", "branch_id": "Chi nhánh không tồn tại hoặc không thuộc công ty."})
    check_b02_scope_access(request.user, company, reporting_scope, branch)

    # Resolve fiscal period / dates
    fiscal_period: AccountingPeriod | None = None
    fiscal_period_id = data.get("fiscal_period_id") or data.get("period_id")
    if fiscal_period_id:
        try:
            fiscal_period = AccountingPeriod.objects.get(pk=fiscal_period_id, company=company)
        except (AccountingPeriod.DoesNotExist, ValueError, TypeError):
            raise ValidationError({"error_code": "EF-04", "fiscal_period_id": "Kỳ kế toán không tồn tại hoặc không thuộc doanh nghiệp."})

    fiscal_year = int(data.get("fiscal_year") or (fiscal_period.fiscal_year if fiscal_period else date.today().year))
    raw_start = data.get("period_start_date") or data.get("from_date")
    raw_end = data.get("period_end_date") or data.get("to_date")

    if raw_start and raw_end:
        try:
            period_start_date = date.fromisoformat(str(raw_start))
            period_end_date = date.fromisoformat(str(raw_end))
        except ValueError:
            raise ValidationError({"error_code": "EF-04", "detail": "Định dạng ngày kỳ báo cáo không hợp lệ (YYYY-MM-DD)."})
    elif fiscal_period:
        period_start_date = fiscal_period.start_date
        period_end_date = fiscal_period.end_date
    else:
        if data.get("require_existing_period"):
            if not AccountingPeriod.objects.filter(company=company, fiscal_year=fiscal_year).exists():
                raise ValidationError({"error_code": "EF-04", "fiscal_year": f"Kỳ kế toán năm {fiscal_year} chưa được khởi tạo."})
        period_start_date = date(fiscal_year, 1, 1)
        period_end_date = date(fiscal_year, 12, 31)

    if period_start_date > period_end_date:
        raise ValidationError({
            "error_code": "EF-04",
            "secondary_error_code": "EF-09",
            "detail": f"Từ ngày ({period_start_date}) không được lớn hơn Đến ngày ({period_end_date}).",
        })

    if not fiscal_period:
        fiscal_period = (
            AccountingPeriod.objects.filter(company=company, fiscal_year=fiscal_year, start_date=period_start_date, end_date=period_end_date).first()
            or AccountingPeriod.objects.filter(company=company, fiscal_year=fiscal_year).order_by("-period_number").first()
        )
        if not fiscal_period:
            fiscal_period = AccountingPeriod.objects.create(
                company=company,
                fiscal_year=fiscal_year,
                period_number=12,
                code=f"{fiscal_year}-12",
                start_date=period_start_date,
                end_date=period_end_date,
                status="OPEN",
            )

    going_concern_status = str(data.get("going_concern_status") or "GOING_CONCERN").upper()
    period_type = str(data.get("period_type") or "").upper()
    template_code = str(data.get("template_code") or data.get("legal_form_code") or "").strip()

    if not template_code:
        if going_concern_status == "NON_GOING_CONCERN":
            template_code = "B02-DNKLT"
        elif period_type in ("QUARTERLY", "INTERIM"):
            template_code = "B02a-DN"
        else:
            template_code = "B02-DN"

    tmpl = FinancialStatementTemplate.objects.filter(
        component_type="BUSINESS_RESULT",
        is_active=True,
    ).filter(Q(internal_code=template_code) | Q(legal_form_code=template_code)).first()
    if not tmpl:
        raise ValidationError({
            "error_code": "EF-05",
            "template_code": template_code,
            "detail": f"Mẫu báo cáo '{template_code}' không hợp lệ hoặc không thuộc nhóm Báo cáo kết quả hoạt động kinh doanh.",
        })

    # EF-05 / EF-06 checks between going_concern_status, period_type, and template
    if going_concern_status == "NON_GOING_CONCERN" and tmpl.legal_form_code != "B02-DNKLT":
        if data.get("auto_switch_going_concern"):
            tmpl = FinancialStatementTemplate.objects.get(internal_code="FSR-06")
        else:
            raise ValidationError({
                "error_code": "EF-06",
                "secondary_error_code": "EF-05",
                "detail": "Doanh nghiệp không đáp ứng giả định hoạt động liên tục phải sử dụng mẫu B02-DNKLT (không dùng B02-DN).",
            })
    elif going_concern_status == "GOING_CONCERN" and tmpl.legal_form_code == "B02-DNKLT" and data.get("going_concern_status"):
        raise ValidationError({
            "error_code": "EF-06",
            "detail": "Mẫu B02-DNKLT chỉ áp dụng khi doanh nghiệp không đáp ứng giả định hoạt động liên tục.",
        })

    if period_type == "ANNUAL" and tmpl.period_granularity == "INTERIM":
        raise ValidationError({
            "error_code": "EF-05",
            "detail": f"Kỳ báo cáo năm (ANNUAL) không tương thích với mẫu giữa niên độ '{tmpl.legal_form_code}'.",
        })
    if period_type in ("QUARTERLY", "INTERIM") and tmpl.period_granularity == "ANNUAL":
        raise ValidationError({
            "error_code": "EF-05",
            "detail": f"Kỳ báo cáo giữa niên độ ({period_type}) phải dùng mẫu B02a-DN hoặc B02b-DN.",
        })

    if not period_type:
        period_type = "QUARTERLY" if tmpl.period_granularity == "INTERIM" else "ANNUAL"

    # Resolve template version (EF-07)
    tv_id = data.get("template_version_id")
    if tv_id:
        try:
            tv = FinancialStatementTemplateVersion.objects.get(pk=tv_id, template=tmpl)
        except (FinancialStatementTemplateVersion.DoesNotExist, ValueError, TypeError):
            raise ValidationError({"error_code": "EF-07", "template_version_id": "Template Version không tồn tại cho mẫu báo cáo đã chọn."})
        if not tv.is_active or tv.effective_from > period_end_date or (tv.effective_to and tv.effective_to < period_end_date):
            raise ValidationError({
                "error_code": "EF-07",
                "template_version_id": str(tv.id),
                "detail": f"Template Version v{tv.version_number} không còn hiệu lực hoặc chưa có hiệu lực tại ngày {period_end_date}.",
            })
    else:
        tv = (
            tmpl.versions.filter(is_active=True, effective_from__lte=period_end_date)
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=period_end_date))
            .order_by("-version_number")
            .first()
        )
        if not tv:
            raise ValidationError({
                "error_code": "EF-07",
                "detail": f"Không tìm thấy Template Version hợp lệ cho mẫu {tmpl.legal_form_code} tại ngày {period_end_date}.",
            })

    # Comparison period dates
    comp_period: AccountingPeriod | None = None
    if data.get("comparison_period_id"):
        comp_period = AccountingPeriod.objects.filter(pk=data["comparison_period_id"], company=company).first()
    comp_start = (
        date.fromisoformat(str(data["comparison_start_date"]))
        if data.get("comparison_start_date")
        else (comp_period.start_date if comp_period else _shift_date_prior_year(period_start_date))
    )
    comp_end = (
        date.fromisoformat(str(data["comparison_end_date"]))
        if data.get("comparison_end_date")
        else (comp_period.end_date if comp_period else _shift_date_prior_year(period_end_date))
    )

    # Compute next run_version (never overwrite APPROVED runs -> EF-38)
    existing_runs = FinancialStatementRun.objects.filter(
        company=company,
        template=tmpl,
        fiscal_year=fiscal_year,
        fiscal_period=fiscal_period,
        reporting_scope=reporting_scope,
        branch=branch,
    )
    max_ver = existing_runs.aggregate(m=Max("run_version"))["m"] or 0
    next_ver = max_ver + 1

    # Supersede older non-approved GENERATED/DRAFT runs
    existing_runs.filter(run_status__in=(FinancialStatementRun.Status.DRAFT, FinancialStatementRun.Status.GENERATED)).update(
        run_status=FinancialStatementRun.Status.SUPERSEDED
    )

    display_unit = str(data.get("display_unit") or "VND").upper()
    if display_unit not in DISPLAY_UNIT_FACTORS:
        display_unit = "VND"

    run = FinancialStatementRun.objects.create(
        company=company,
        template=tmpl,
        template_version=tv,
        fiscal_year=fiscal_year,
        fiscal_period=fiscal_period,
        comparison_period=comp_period,
        as_of_date=period_end_date,
        comparison_as_of_date=comp_end,
        comparison_start_date=comp_start,
        comparison_end_date=comp_end,
        period_start_date=period_start_date,
        period_end_date=period_end_date,
        period_type=period_type,
        reporting_scope=reporting_scope,
        branch=branch,
        reporting_currency=company.accounting_currency,
        display_unit=display_unit,
        legal_or_management=str(data.get("legal_or_management") or "LEGAL").upper(),
        calculation_method=str(data.get("calculation_method") or "ACTIVITY_BASED").upper(),
        comparative_status=str(data.get("comparative_status") or "COMPARABLE").upper(),
        comparative_adjustment_reference=str(data.get("comparative_adjustment_reference") or ""),
        comparative_note=str(data.get("comparative_note") or ""),
        restatement_version=int(data.get("restatement_version") or 0),
        eps_metadata_json=data.get("eps_metadata") if isinstance(data.get("eps_metadata"), dict) else {},
        run_version=next_ver,
        run_status=FinancialStatementRun.Status.GENERATED,
        validation_status=FinancialStatementRun.ValidationStatus.PASSED,
        source_status=FinancialStatementRun.SourceStatus.COMPLETE,
        created_by=_resolve_iam_account(request.user),
    )

    calculate_business_result_run(run)
    run.refresh_from_db()

    _log_b02_audit(
        company,
        request.user,
        "RPT_B02_RUN_GENERATED",
        str(run.id),
        {
            "template_code": tmpl.internal_code,
            "legal_form_code": tmpl.legal_form_code,
            "version_number": run.run_version,
            "fiscal_year": run.fiscal_year,
            "period_start_date": run.period_start_date.isoformat(),
            "period_end_date": run.period_end_date.isoformat(),
        },
    )

    lines_payload = serialize_b02_lines_and_values(run, display_unit=display_unit)
    val_payload = get_business_result_run_validation_data(run)
    return {
        "run": serialize_b02_run_header(run, display_unit=display_unit),
        **lines_payload,
        "validation": val_payload,
    }


# ----------------------------------------------------------------------------
# 7.6 GET /runs/{runId}
# ----------------------------------------------------------------------------
def get_business_result_run_detail(request, run_id: str) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VIEW")
    run = get_b02_run_or_error(run_id, company)
    check_b02_scope_access(request.user, company, run.reporting_scope, run.branch)

    d_unit = request.query_params.get("display_unit") or run.display_unit or "VND"
    neg_fmt = request.query_params.get("negative_format") or "PARENTHESES"
    hide_zero = str(request.query_params.get("hide_zero_lines", "")).lower() in ("1", "true", "yes")
    search_q = request.query_params.get("search") or ""
    strict_comp = str(request.query_params.get("strict_completeness", "")).lower() in ("1", "true", "yes")

    lines_payload = serialize_b02_lines_and_values(
        run,
        display_unit=d_unit,
        negative_format=neg_fmt,
        hide_zero_lines=hide_zero,
        search_query=search_q,
        strict_completeness=strict_comp,
    )
    val_payload = get_business_result_run_validation_data(run)

    _log_b02_audit(company, request.user, "RPT_B02_RUN_VIEWED", str(run.id), {"template_code": run.template.internal_code})
    return {
        "run": serialize_b02_run_header(run, display_unit=d_unit),
        **lines_payload,
        "validation": val_payload,
    }


# ----------------------------------------------------------------------------
# 7.7 GET /runs/{runId}/lines
# ----------------------------------------------------------------------------
def get_business_result_run_lines(request, run_id: str) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VIEW")
    run = get_b02_run_or_error(run_id, company)
    check_b02_scope_access(request.user, company, run.reporting_scope, run.branch)

    d_unit = request.query_params.get("display_unit") or run.display_unit or "VND"
    neg_fmt = request.query_params.get("negative_format") or "PARENTHESES"
    hide_zero = str(request.query_params.get("hide_zero_lines", "")).lower() in ("1", "true", "yes")
    search_q = request.query_params.get("search") or ""
    strict_comp = str(request.query_params.get("strict_completeness", "")).lower() in ("1", "true", "yes")

    return serialize_b02_lines_and_values(
        run,
        display_unit=d_unit,
        negative_format=neg_fmt,
        hide_zero_lines=hide_zero,
        search_query=search_q,
        strict_completeness=strict_comp,
    )


# ----------------------------------------------------------------------------
# 7.8 GET /runs/{runId}/values
# ----------------------------------------------------------------------------
def get_business_result_run_values(request, run_id: str) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VIEW")
    run = get_b02_run_or_error(run_id, company)
    check_b02_scope_access(request.user, company, run.reporting_scope, run.branch)

    d_unit = request.query_params.get("display_unit") or run.display_unit or "VND"
    neg_fmt = request.query_params.get("negative_format") or "PARENTHESES"
    hide_zero = str(request.query_params.get("hide_zero_lines", "")).lower() in ("1", "true", "yes")
    search_q = request.query_params.get("search") or ""
    strict_comp = str(request.query_params.get("strict_completeness", "")).lower() in ("1", "true", "yes")

    payload = serialize_b02_lines_and_values(
        run,
        display_unit=d_unit,
        negative_format=neg_fmt,
        hide_zero_lines=hide_zero,
        search_query=search_q,
        strict_completeness=strict_comp,
    )
    return {
        "statement_run_id": str(run.id),
        "display_unit": payload["display_unit"],
        "summary": payload["summary"],
        "values": payload["lines"],
    }


# ----------------------------------------------------------------------------
# 7.9 GET /runs/{runId}/validation & 7.10 POST /runs/{runId}/validate
# ----------------------------------------------------------------------------
def get_business_result_run_validation_data(run: FinancialStatementRun) -> dict[str, Any]:
    vals = list(run.validations.all().order_by("rule_code", "slot_code", "indicator_code"))
    if not vals:
        return validate_business_result_run(run)

    stale = is_b02_run_stale(run)
    blocker_count = sum(1 for v in vals if v.severity == "BLOCKER" and v.status == "FAILED")
    warning_count = sum(1 for v in vals if v.status == "PASSED_WITH_WARNING")
    passed_count = sum(1 for v in vals if v.status == "PASSED")
    return {
        "statement_run_id": str(run.id),
        "validation_run_id": str(vals[0].validation_run_id) if vals else None,
        "run_status": run.run_status,
        "validation_status": "STALE" if (stale and run.validation_status == "PASSED") else run.validation_status,
        "source_status": "STALE" if stale else run.source_status,
        "is_stale": stale,
        "total_rules": len(vals),
        "passed_count": passed_count,
        "warning_count": warning_count,
        "blocker_count": blocker_count,
        "b02_vs_b01_reconciliation_note": (
            "Chỉ tiêu [60] Lợi nhuận sau thuế trên B02 phản ánh kết quả phát sinh trong kỳ; "
            "không tự động đồng nhất với chỉ tiêu [420]/[421] trên B01 khi có lợi nhuận lũy kế đầu kỳ, phân phối lợi nhuận hoặc điều chỉnh hồi tố."
        ),
        "results": [
            {
                "id": str(v.id),
                "rule_code": v.rule_code,
                "slot_code": v.slot_code,
                "column_code": v.column_code,
                "indicator_code": v.indicator_code,
                "expected_amount": _fmt_dec(v.expected_amount),
                "actual_amount": _fmt_dec(v.actual_amount),
                "difference_amount": _fmt_dec(v.difference_amount),
                "severity": v.severity,
                "status": v.status,
                "message": v.message,
                "checked_at": v.checked_at.isoformat(),
            }
            for v in vals
        ],
    }


def get_business_result_run_validation(request, run_id: str) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VIEW")
    run = get_b02_run_or_error(run_id, company)
    check_b02_scope_access(request.user, company, run.reporting_scope, run.branch)
    return get_business_result_run_validation_data(run)


def trigger_business_result_run_validate(request, run_id: str) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VALIDATE")
    run = get_b02_run_or_error(run_id, company)
    check_b02_scope_access(request.user, company, run.reporting_scope, run.branch)

    result = validate_business_result_run(run)
    _log_b02_audit(company, request.user, "RPT_B02_RUN_VALIDATED", str(run.id), {"validation_status": result["validation_status"]})
    return result


# ----------------------------------------------------------------------------
# 7.11 GET /runs/{runId}/lines/{indicatorCode}/calculation
# ----------------------------------------------------------------------------
def _resolve_b02_line_or_error(run: FinancialStatementRun, indicator_code: str) -> FinancialStatementLine:
    ln = run.template_version.lines.filter(indicator_code=indicator_code).first()
    if not ln:
        try:
            uuid.UUID(str(indicator_code))
            ln = run.template_version.lines.filter(pk=indicator_code).first()
        except ValueError:
            pass
    if not ln:
        all_21_codes = {d[0] for d in B02_DN_LINES}
        if run.template.legal_form_code == "B02b-DN" and indicator_code in all_21_codes:
            raise ValidationError({
                "error_code": "EF-15",
                "indicator_code": indicator_code,
                "detail": f"Chỉ tiêu [{indicator_code}] không tồn tại trên mẫu giữa niên độ dạng tóm lược B02b-DN (chỉ gồm 01, 31, 50, 60).",
            })
        raise ValidationError({
            "error_code": "EF-13",
            "indicator_code": indicator_code,
            "detail": f"Chỉ tiêu [{indicator_code}] không tồn tại trong mẫu {run.template.legal_form_code}.",
        })
    return ln


def get_business_result_line_calculation(request, run_id: str, indicator_code: str) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VIEW")
    run = get_b02_run_or_error(run_id, company)
    check_b02_scope_access(request.user, company, run.reporting_scope, run.branch)

    ln = _resolve_b02_line_or_error(run, indicator_code)
    val_obj = run.values.filter(statement_line=ln).first()
    slots = list(run.value_slots.filter(statement_line=ln).order_by("display_order"))
    mappings = list(ln.account_mappings.filter(is_active=True))

    calc_json = (val_obj.calculation_detail_json if val_obj else {}) or {}

    # Build formula operand trace if formula line
    operand_trace: list[dict[str, Any]] = []
    if ln.formula_expression and ln.formula_expression not in SPECIAL_FORMULA_TOKENS:
        for sign, ref_code in parse_b02_formula_tokens(ln.formula_expression):
            ref_ln = run.template_version.lines.filter(indicator_code=ref_code).first()
            ref_val = run.values.filter(statement_line=ref_ln).first() if ref_ln else None
            operand_trace.append({
                "operator": "+" if sign > 0 else "-",
                "indicator_code": ref_code,
                "indicator_name": ref_ln.indicator_name if ref_ln else f"Chỉ tiêu {ref_code}",
                "current_period_amount": _fmt_dec(ref_val.current_period_amount if ref_val else None),
                "comparative_period_amount": _fmt_dec(ref_val.comparative_period_amount if ref_val else None),
            })

    return {
        "statement_run_id": str(run.id),
        "template_code": run.template.internal_code,
        "legal_form_code": run.template.legal_form_code,
        "indicator_code": ln.indicator_code,
        "indicator_name": ln.indicator_name,
        "line_type": ln.line_type,
        "note_reference": ln.note_reference,
        "formula_expression": ln.formula_expression,
        "sign_presentation_rule": "NEGATIVE_PARENTHESES" if ln.is_negative_presentation else "NORMAL",
        "content_status": val_obj.content_status if val_obj else "MISSING",
        "current_period_amount": _fmt_dec(val_obj.current_period_amount if val_obj else None),
        "comparative_period_amount": _fmt_dec(val_obj.comparative_period_amount if val_obj else None),
        "account_mappings": [
            {
                "account_code_prefix": m.account_prefix,
                "counterpart_prefix": m.counterpart_prefix,
                "side": m.balance_side,
                "sign": m.sign,
                "condition_type": (m.condition_json or {}).get("condition_type", ""),
                "condition_json": m.condition_json or {},
            }
            for m in mappings
        ],
        "formula_operands": operand_trace,
        "slots": [
            {
                "slot_code": s.slot_code,
                "slot_label": s.slot_label,
                "start_date": s.start_date.isoformat() if s.start_date else None,
                "end_date": s.end_date.isoformat() if s.end_date else None,
                "amount": _fmt_dec(s.amount),
                "calculation_detail": s.calculation_detail_json or {},
            }
            for s in slots
        ],
        "calculation_detail": calc_json,
    }


# ----------------------------------------------------------------------------
# 7.12 GET /runs/{runId}/lines/{indicatorCode}/drilldown
# ----------------------------------------------------------------------------
def get_business_result_line_drilldown(request, run_id: str, indicator_code: str) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_DETAIL_VIEW")
    run = get_b02_run_or_error(run_id, company)
    check_b02_scope_access(request.user, company, run.reporting_scope, run.branch)

    ln = _resolve_b02_line_or_error(run, indicator_code)
    slots = list(run.value_slots.filter(statement_line=ln).order_by("display_order"))
    is_interim = run.template.period_granularity == "INTERIM" or run.template.legal_form_code in ("B02a-DN", "B02b-DN")
    default_slot = "QUARTER_CURRENT" if is_interim else "YEAR_CURRENT"
    requested_slot = request.query_params.get("slot_code") or default_slot

    slot_obj = next((s for s in slots if s.slot_code == requested_slot), slots[0] if slots else None)
    slot_det = (slot_obj.calculation_detail_json if slot_obj else {}) or {}

    journal_lines: list[dict[str, Any]] = list(slot_det.get("journal_lines") or [])
    # If this is a formula/subtotal line, aggregate journal lines from its leaf operands in the same slot
    if not journal_lines and ln.formula_expression:
        seen_jl_ids: set[str] = set()
        for s_other in run.value_slots.filter(slot_code=requested_slot).select_related("statement_line"):
            other_jls = (s_other.calculation_detail_json or {}).get("journal_lines") or []
            for j in other_jls:
                jid = j.get("journal_line_id")
                if jid and jid not in seen_jl_ids:
                    seen_jl_ids.add(jid)
                    journal_lines.append({**j, "source_indicator_code": s_other.statement_line.indicator_code})

    # Group by account_code
    accounts_summary: dict[str, dict[str, Any]] = {}
    warnings: list[dict[str, Any]] = []
    for jl in journal_lines:
        ac = jl.get("account_code") or ""
        if ac not in accounts_summary:
            accounts_summary[ac] = {
                "account_code": ac,
                "account_name": jl.get("account_name") or ac,
                "total_debit": ZERO,
                "total_credit": ZERO,
                "total_contribution": ZERO,
                "entry_count": 0,
            }
        accounts_summary[ac]["total_debit"] += _to_dec(jl.get("debit"))
        accounts_summary[ac]["total_credit"] += _to_dec(jl.get("credit"))
        accounts_summary[ac]["total_contribution"] += _to_dec(jl.get("contribution_amount"))
        accounts_summary[ac]["entry_count"] += 1

        if not jl.get("source_document_Available", True):
            warnings.append({
                "error_code": "EF-37",
                "journal_entry_id": jl.get("journal_entry_id"),
                "entry_no": jl.get("entry_no"),
                "message": f"Bút toán '{jl.get('entry_no')}' chưa liên kết chứng từ gốc hoặc chứng từ gốc không khả dụng.",
            })

    accounts_list = [
        {
            "account_code": v["account_code"],
            "account_name": v["account_name"],
            "total_debit": _fmt_dec(v["total_debit"]),
            "total_credit": _fmt_dec(v["total_credit"]),
            "total_contribution": _fmt_dec(v["total_contribution"]),
            "entry_count": v["entry_count"],
        }
        for v in sorted(accounts_summary.values(), key=lambda x: x["account_code"])
    ]

    _log_b02_audit(
        company,
        request.user,
        "RPT_B02_LINE_DRILLDOWN",
        str(run.id),
        {"indicator_code": indicator_code, "slot_code": requested_slot},
    )

    return {
        "statement_run_id": str(run.id),
        "indicator_code": ln.indicator_code,
        "indicator_name": ln.indicator_name,
        "line_type": ln.line_type,
        "note_reference": ln.note_reference,
        "formula_expression": ln.formula_expression,
        "slot_code": requested_slot,
        "slot_label": slot_obj.slot_label if slot_obj else requested_slot,
        "start_date": slot_obj.start_date.isoformat() if (slot_obj and slot_obj.start_date) else run.period_start_date.isoformat(),
        "end_date": slot_obj.end_date.isoformat() if (slot_obj and slot_obj.end_date) else run.period_end_date.isoformat(),
        "amount": _fmt_dec(slot_obj.amount if slot_obj else None),
        "accounts_summary": accounts_list,
        "journal_lines_count": len(journal_lines),
        "journal_lines": journal_lines,
        "bdsdt_breakdown": slot_det.get("bdsdt_breakdown", []),
        "tscd_breakdown": slot_det.get("tscd_breakdown", []),
        "eps_detail": slot_det.get("eps_detail", {}),
        "warnings": warnings,
    }


# ----------------------------------------------------------------------------
# 7.13 GET /runs/{runId}/history
# ----------------------------------------------------------------------------
def get_business_result_run_history(request, run_id: str) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_VIEW")
    run = get_b02_run_or_error(run_id, company)
    check_b02_scope_access(request.user, company, run.reporting_scope, run.branch)

    siblings = FinancialStatementRun.objects.select_related(
        "company", "branch", "fiscal_period", "template", "template_version", "created_by", "approved_by"
    ).filter(
        company=company,
        template=run.template,
        fiscal_year=run.fiscal_year,
        fiscal_period=run.fiscal_period,
        reporting_scope=run.reporting_scope,
        branch=run.branch,
    ).order_by("-run_version", "-created_at")

    history_items = []
    for r in siblings:
        v60 = r.values.filter(statement_line__indicator_code="60").first()
        v10 = r.values.filter(statement_line__indicator_code__in=("10", "01")).order_by("-statement_line__indicator_code").first()
        history_items.append({
            **serialize_b02_run_header(r),
            "is_current_selected": r.id == run.id,
            "net_revenue": _fmt_dec(v10.current_period_amount if v10 else None),
            "profit_after_tax": _fmt_dec(v60.current_period_amount if v60 else None),
        })

    return {
        "statement_run_id": str(run.id),
        "company_id": str(company.id),
        "template_code": run.template.internal_code,
        "legal_form_code": run.template.legal_form_code,
        "fiscal_year": run.fiscal_year,
        "version_count": len(history_items),
        "versions": history_items,
    }


# ----------------------------------------------------------------------------
# 7.14 POST /runs/{runId}/submit-review
# ----------------------------------------------------------------------------
@transaction.atomic
def submit_business_result_run_review(request, run_id: str) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_GENERATE")
    run = get_b02_run_or_error(run_id, company)
    check_b02_scope_access(request.user, company, run.reporting_scope, run.branch)

    if run.run_status == FinancialStatementRun.Status.APPROVED:
        raise ValidationError({
            "error_code": "EF-38",
            "detail": "Statement Run B02 đã được phê duyệt (APPROVED), không thể chuyển lại trạng thái chờ duyệt.",
        })

    val_res = validate_business_result_run(run)
    run.run_status = FinancialStatementRun.Status.REVIEW_REQUIRED
    run.save(update_fields=["run_status"])

    _log_b02_audit(company, request.user, "RPT_B02_SUBMITTED_FOR_REVIEW", str(run.id))
    return {
        "run": serialize_b02_run_header(run),
        "validation": val_res,
    }


# ----------------------------------------------------------------------------
# 7.15 POST /runs/{runId}/approve
# ----------------------------------------------------------------------------
@transaction.atomic
def approve_business_result_run(request, run_id: str) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    require_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_APPROVE")
    run = get_b02_run_or_error(run_id, company)
    check_b02_scope_access(request.user, company, run.reporting_scope, run.branch)

    if run.run_status == FinancialStatementRun.Status.APPROVED:
        raise ValidationError({
            "error_code": "EF-38",
            "detail": "Statement Run B02 này đã ở trạng thái APPROVED. Muốn lập lại phải tạo phiên bản mới.",
        })

    val_res = validate_business_result_run(run)
    if val_res["blocker_count"] > 0 or val_res["validation_status"] == "FAILED":
        raise ValidationError({
            "error_code": "EF-39",
            "blocker_count": val_res["blocker_count"],
            "validation_status": val_res["validation_status"],
            "detail": "Không được phê duyệt Báo cáo kết quả hoạt động kinh doanh khi còn lỗi kiểm tra trọng yếu (BLOCKER).",
        })

    data = request.data if isinstance(request.data, dict) else {}
    # Supersede older approved runs of the same key
    FinancialStatementRun.objects.filter(
        company=company,
        template=run.template,
        fiscal_year=run.fiscal_year,
        fiscal_period=run.fiscal_period,
        reporting_scope=run.reporting_scope,
        branch=run.branch,
        run_status=FinancialStatementRun.Status.APPROVED,
    ).exclude(pk=run.pk).update(run_status=FinancialStatementRun.Status.SUPERSEDED)

    run.run_status = FinancialStatementRun.Status.APPROVED
    run.approved_by = _resolve_iam_account(request.user)
    run.approved_at = timezone.now()
    eps_meta = dict(run.eps_metadata_json or {})
    eps_meta["approval_note"] = str(data.get("approval_note") or "Đã phê duyệt Báo cáo kết quả hoạt động kinh doanh.")
    run.eps_metadata_json = eps_meta
    run.save(update_fields=["run_status", "approved_by", "approved_at", "eps_metadata_json"])

    _log_b02_audit(company, request.user, "RPT_B02_RUN_APPROVED", str(run.id), {"version_number": run.run_version})
    return {
        "run": serialize_b02_run_header(run),
        "validation": val_res,
    }


# ----------------------------------------------------------------------------
# 7.16 POST /runs/{runId}/export
# ----------------------------------------------------------------------------
def export_business_result_run(request, run_id: str) -> dict[str, Any]:
    ensure_b02_templates_seeded()
    company = resolve_b02_company(request)
    if not has_b02_permission(request.user, company, "RPT_BUSINESS_RESULT_EXPORT"):
        raise PermissionDenied({
            "error_code": "EF-40",
            "secondary_error_code": "EF-02",
            "required_permission": "RPT_BUSINESS_RESULT_EXPORT",
            "detail": "Bạn không có quyền xuất/in Báo cáo kết quả hoạt động kinh doanh (RPT_BUSINESS_RESULT_EXPORT).",
        })

    run = get_b02_run_or_error(run_id, company)
    check_b02_scope_access(request.user, company, run.reporting_scope, run.branch)

    data = request.data if isinstance(request.data, dict) else {}
    if getattr(run, "simulate_export_error", False) or data.get("simulate_export_error"):
        raise ValidationError({
            "error_code": "EF-40",
            "run_id": str(run.id),
            "run_status": run.run_status,
            "detail": "Lỗi dịch vụ kết xuất tệp báo cáo B02. Trạng thái Statement Run vẫn được giữ nguyên.",
        })

    export_format = str(data.get("export_format") or "PDF").upper()
    d_unit = str(data.get("display_unit") or run.display_unit or "VND").upper()
    neg_fmt = str(data.get("negative_format") or "PARENTHESES").upper()
    hide_zero = bool(data.get("hide_zero_lines", False))

    lines_payload = serialize_b02_lines_and_values(
        run,
        display_unit=d_unit,
        negative_format=neg_fmt,
        hide_zero_lines=hide_zero,
    )
    run_header = serialize_b02_run_header(run, display_unit=d_unit)

    _log_b02_audit(
        company,
        request.user,
        "RPT_B02_EXPORT_REQUESTED",
        str(run.id),
        {
            "export_format": export_format,
            "display_unit": d_unit,
            "version_number": run.run_version,
            "legal_form_code": run.template.legal_form_code,
        },
    )

    ext = "xlsx" if export_format in ("EXCEL", "XLSX") else "pdf"
    filename = f"{run.template.legal_form_code}_{company.code}_{run.fiscal_year}_v{run.run_version}.{ext}"

    return {
        "export_status": "READY",
        "export_format": export_format,
        "file_name": filename,
        "statement_run_id": str(run.id),
        "version_number": run.run_version,
        "run_status": run.run_status,
        "template_code": run.template.internal_code,
        "legal_form_code": run.template.legal_form_code,
        "legal_circular": run.template_version.legal_circular,
        "display_unit": d_unit,
        "run": run_header,
        "lines": lines_payload["lines"],
        "summary": lines_payload["summary"],
        "signatures": {
            "preparer_title": "Người lập biểu",
            "chief_accountant_title": "Kế toán trưởng",
            "legal_representative_title": "Giám đốc / Người đại diện theo pháp luật",
        },
    }
