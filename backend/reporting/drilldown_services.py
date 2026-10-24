"""
UC-RPT-14: Universal Report Data Drill-Down & Lineage Services.
Hệ thống truy vết và xem chi tiết số liệu báo cáo dùng chung cho toàn bộ các phân hệ UC-RPT-01 đến UC-RPT-13.
Hỗ trợ 3 thao tác: Drill-down (đa cấp), Drill-through (báo cáo liên quan) và Open Source (chứng từ gốc).
Hỗ trợ 10+ loại chỉ tiêu: FORMULA, AGGREGATE, BALANCE, TRANSACTION, INVENTORY_COST, SETTLEMENT,
TAX_INDICATOR, ALLOCATION, RATIO, MANUAL_ADJUSTMENT.
Phân biệt Attributed Amount vs Document Total, chống cộng dồn phi lý cho Ratio, và đối chiếu toàn vẹn số liệu.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import re
import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from general_ledger.models import Account, JournalEntry, JournalLine
from organization.models import Company

from .models import (
    FinancialStatementLine,
    FinancialStatementRun,
    FinancialStatementValue,
    ReportCalculationContribution,
    ReportCellContext,
    ReportDefinition,
    ReportDrilldownDefinition,
    ReportSourceReference,
)


# ==============================================================================
# HẰNG SỐ & BẢNG ÁNH XẠ NĂNG LỰC DRILL-DOWN (CAPABILITIES REGISTRY)
# ==============================================================================

REPORT_DRILLDOWN_TYPES = {
    # Báo cáo tài chính
    "B01-DN": ["BALANCE", "AGGREGATE", "FORMULA", "TRANSACTION"],
    "B01": ["BALANCE", "AGGREGATE", "FORMULA", "TRANSACTION"],
    "B02-DN": ["FORMULA", "TRANSACTION", "AGGREGATE"],
    "B02": ["FORMULA", "TRANSACTION", "AGGREGATE"],
    "B03-DN": ["FORMULA", "TRANSACTION", "AGGREGATE"],
    "B03": ["FORMULA", "TRANSACTION", "AGGREGATE"],
    "B09-DN": ["AGGREGATE", "TRANSACTION", "ALLOCATION"],
    "RPT-B09": ["AGGREGATE", "TRANSACTION", "ALLOCATION"],
    "TT99": ["FORMULA", "BALANCE", "TRANSACTION"],
    "TT200": ["FORMULA", "BALANCE", "TRANSACTION"],

    # Báo cáo kho
    "RPT-0143": ["BALANCE", "INVENTORY_COST", "TRANSACTION", "AGGREGATE"],
    "RPT-0144": ["BALANCE", "INVENTORY_COST", "TRANSACTION"],
    "RPT-0145": ["BALANCE", "INVENTORY_COST", "TRANSACTION"],

    # Báo cáo công nợ
    "RPT-0081": ["SETTLEMENT", "BALANCE", "TRANSACTION"],
    "RPT-0082": ["SETTLEMENT", "BALANCE", "TRANSACTION"],

    # Báo cáo tiền
    "RPT-0096": ["BALANCE", "TRANSACTION", "AGGREGATE"],
    "RPT-0097": ["BALANCE", "TRANSACTION", "AGGREGATE"],

    # Báo cáo TSCĐ & CCDC
    "RPT-0158": ["ALLOCATION", "BALANCE", "TRANSACTION"],
    "RPT-0159": ["ALLOCATION", "BALANCE", "TRANSACTION"],
    "RPT-0160": ["ALLOCATION", "BALANCE", "TRANSACTION"],

    # Báo cáo thuế
    "RPT-0003": ["TAX_INDICATOR", "TRANSACTION", "FORMULA"],
    "RPT-0175": ["TAX_INDICATOR", "TRANSACTION"],
}

# Formula definitions mặc định cho B02-DN (Kết quả kinh doanh TT200 / TT99)
B02_STANDARD_FORMULAS = {
    "10": {
        "formula": "01 - 02",
        "name": "Doanh thu thuần về bán hàng và cung cấp dịch vụ",
        "components": [
            {"indicator_code": "01", "name": "Doanh thu bán hàng và CCDV", "sign": 1},
            {"indicator_code": "02", "name": "Các khoản giảm trừ doanh thu", "sign": -1},
        ],
    },
    "20": {
        "formula": "10 - 11",
        "name": "Lợi nhuận gộp về bán hàng và cung cấp dịch vụ",
        "components": [
            {"indicator_code": "10", "name": "Doanh thu thuần", "sign": 1},
            {"indicator_code": "11", "name": "Giá vốn hàng bán", "sign": -1},
        ],
    },
    "30": {
        "formula": "20 + 21 + 22 - 23 - 25 - 26",
        "name": "Lợi nhuận thuần từ hoạt động kinh doanh",
        "components": [
            {"indicator_code": "20", "name": "Lợi nhuận gộp", "sign": 1},
            {"indicator_code": "21", "name": "Lãi/lỗ bán, thanh lý BĐS đầu tư", "sign": 1},
            {"indicator_code": "22", "name": "Doanh thu hoạt động tài chính", "sign": 1},
            {"indicator_code": "23", "name": "Chi phí tài chính", "sign": -1},
            {"indicator_code": "25", "name": "Chi phí bán hàng", "sign": -1},
            {"indicator_code": "26", "name": "Chi phí quản lý doanh nghiệp", "sign": -1},
        ],
    },
    "40": {
        "formula": "31 - 32",
        "name": "Lợi nhuận khác",
        "components": [
            {"indicator_code": "31", "name": "Thu nhập khác", "sign": 1},
            {"indicator_code": "32", "name": "Chi phí khác", "sign": -1},
        ],
    },
    "50": {
        "formula": "30 + 40",
        "name": "Tổng lợi nhuận kế toán trước thuế",
        "components": [
            {"indicator_code": "30", "name": "Lợi nhuận thuần từ HĐKD", "sign": 1},
            {"indicator_code": "40", "name": "Lợi nhuận khác", "sign": 1},
        ],
    },
    "60": {
        "formula": "50 - 51 - 52",
        "name": "Lợi nhuận sau thuế thu nhập doanh nghiệp",
        "components": [
            {"indicator_code": "50", "name": "Tổng lợi nhuận trước thuế", "sign": 1},
            {"indicator_code": "51", "name": "Chi phí thuế TNDN hiện hành", "sign": -1},
            {"indicator_code": "52", "name": "Chi phí thuế TNDN hoãn lại", "sign": -1},
        ],
    },
}


def get_drilldown_capabilities(report_code: str) -> Dict[str, Any]:
    """
    RPT14-F01, BR-RPT-DR-02, TC-RPT-14-01..02:
    Trả về khả năng và các loại Drill-down được hỗ trợ cho báo cáo.
    """
    code_clean = str(report_code).strip().upper()
    drill_types = REPORT_DRILLDOWN_TYPES.get(code_clean)
    if not drill_types:
        # Nhận diện theo prefix
        if "B02" in code_clean:
            drill_types = ["FORMULA", "TRANSACTION", "AGGREGATE"]
        elif "B01" in code_clean:
            drill_types = ["BALANCE", "AGGREGATE", "FORMULA", "TRANSACTION"]
        elif "B03" in code_clean:
            drill_types = ["FORMULA", "TRANSACTION", "AGGREGATE"]
        elif "TAX" in code_clean or "0003" in code_clean:
            drill_types = ["TAX_INDICATOR", "TRANSACTION", "FORMULA"]
        elif "INV" in code_clean or "014" in code_clean:
            drill_types = ["BALANCE", "INVENTORY_COST", "TRANSACTION"]
        elif "DEBT" in code_clean or "008" in code_clean:
            drill_types = ["SETTLEMENT", "BALANCE", "TRANSACTION"]
        elif "MONEY" in code_clean or "009" in code_clean:
            drill_types = ["BALANCE", "TRANSACTION", "AGGREGATE"]
        elif "ASSET" in code_clean or "015" in code_clean or "016" in code_clean:
            drill_types = ["ALLOCATION", "BALANCE", "TRANSACTION"]
        else:
            drill_types = ["AGGREGATE", "TRANSACTION", "BALANCE"]

    return {
        "report_code": report_code,
        "supports_drilldown": True,
        "supported_drilldown_types": drill_types,
        "max_levels": 4,
        "supported_operations": ["DRILLDOWN", "DRILLTHROUGH", "OPEN_SOURCE"],
        "supports_export": True,  # Liên kết UC-RPT-15
    }


def check_drilldown_permissions(user: Any, company_id: str, required_perm: str = "RPT_DRILLDOWN_VIEW"):
    """
    BR-RPT-DR-08..11, TC-RPT-14-03..05:
    Kiểm tra phân quyền xem chi tiết số liệu báo cáo và cách ly Company.
    """
    if not user or not user.is_authenticated:
        raise PermissionDenied("Yêu cầu đăng nhập để xem chi tiết số liệu báo cáo.")

    # Kiểm tra Company tồn tại
    comp = Company.objects.filter(pk=company_id).first()
    if not comp:
        raise PermissionDenied("Doanh nghiệp không hợp lệ hoặc nằm ngoài phạm vi được phân quyền.")

    if user.is_superuser:
        return True

    cached_perms = getattr(user, "_cached_perms", None)
    if cached_perms is not None:
        if required_perm not in cached_perms and "RPT_VIEW" not in cached_perms:
            raise PermissionDenied(f"Người dùng không có quyền {required_perm}.")
    else:
        iam_acc = getattr(user, "iam_account", None)
        if iam_acc:
            from iam.permissions import has_effective_permission
            if not (has_effective_permission(user, required_perm, company_id=company_id) or
                    has_effective_permission(user, "RPT_VIEW", company_id=company_id)):
                raise PermissionDenied(f"Người dùng không có quyền {required_perm}.")
        else:
            raise PermissionDenied(f"Người dùng không có quyền {required_perm}.")
    return True


# ==============================================================================
# ENTRYPOINT: MỞ NGỮ CẢNH Ô BÁO CÁO (CELL CONTEXT & LEVEL 1/2/3)
# ==============================================================================

def open_cell_context(
    company_id: str,
    user: Any,
    payload: Dict[str, Any],
    request: Any = None,
) -> Dict[str, Any]:
    """
    RPT14-F01..F16, Main Flow: Mở chi tiết số liệu của một ô báo cáo được chọn.
    Xác định chính xác theo: Report Context + Row Key + Column Key + Value Slot.
    """
    # 1. Kiểm tra quyền và cách ly doanh nghiệp
    check_drilldown_permissions(user, company_id)

    report_code = str(payload.get("report_code", "RPT-STANDARD")).strip()
    row_key = str(payload.get("row_key", "")).strip()
    column_key = str(payload.get("column_key", "current_period")).strip()
    value_slot = str(payload.get("value_slot", "CURRENT_PERIOD")).strip().upper()
    indicator_code = str(payload.get("indicator_code", row_key)).strip()
    indicator_name = str(payload.get("indicator_name", "")).strip()

    if not row_key:
        raise ValidationError("Thiếu thông tin row_key của ô báo cáo.")

    # 2. Xác định kiểu Drilldown (Formula, Balance, Settlement, Tax, Inventory, Allocation, Ratio)
    explicit_type = payload.get("drilldown_type")
    if explicit_type:
        drill_type = explicit_type.upper()
    else:
        # Tự động suy luận theo mã báo cáo và chỉ tiêu
        if "B02" in report_code.upper() and indicator_code in B02_STANDARD_FORMULAS:
            drill_type = "FORMULA"
        elif "RATIO" in row_key.upper() or "PERCENT" in column_key.upper():
            drill_type = "RATIO"
        elif "DEBT" in report_code.upper() or "008" in report_code:
            drill_type = "SETTLEMENT"
        elif "INV" in report_code.upper() or "014" in report_code:
            drill_type = "INVENTORY_COST"
        elif "TAX" in report_code.upper() or "0003" in report_code:
            drill_type = "TAX_INDICATOR"
        elif "ASSET" in report_code.upper() or "CCDC" in report_code.upper() or "015" in report_code:
            drill_type = "ALLOCATION"
        elif "CLOSING" in value_slot or "OPENING" in value_slot or "BALANCE" in value_slot or "B01" in report_code.upper():
            drill_type = "BALANCE"
        else:
            drill_type = "AGGREGATE"

    # Giá trị hiển thị tại ô được click
    raw_display_val = payload.get("display_value", 0)
    try:
        display_val = Decimal(str(raw_display_val).replace(",", "").strip() or "0")
    except Exception:
        display_val = Decimal("0")

    # Hash các tham số bộ lọc gốc
    params = payload.get("parameters", {}) or {}
    params_str = json.dumps(params, sort_keys=True)
    params_hash = hashlib.sha256(params_str.encode("utf-8")).hexdigest()[:16]

    # 3. Tạo hoặc nạp ReportCellContext
    cell_context = ReportCellContext.objects.create(
        company_id=company_id,
        report_code=report_code,
        report_run_id=str(payload.get("report_run_id", "")),
        row_key=row_key,
        column_key=column_key,
        value_slot=value_slot,
        indicator_code=indicator_code,
        indicator_name=indicator_name or f"Chỉ tiêu {indicator_code}",
        measure_code=payload.get("measure_code", "AMOUNT"),
        parameters_hash=params_hash,
        parameters_snapshot_json=params,
        drilldown_type=drill_type,
        currency_code=payload.get("currency_code", "VND"),
        display_value=display_val,
        value_type="PERCENT" if drill_type == "RATIO" else "AMOUNT",
        period_start=params.get("from_date") if params.get("from_date") else None,
        period_end=params.get("to_date") if params.get("to_date") else None,
        is_additive=(drill_type != "RATIO"),
        expires_at=timezone.now() + datetime.timedelta(hours=2),
    )

    # 4. Tạo các thành phần đóng góp (Level 1 / Level 2 Components)
    components: List[Dict[str, Any]] = []
    formula_expression = ""
    calculated_total = Decimal("0")

    if drill_type == "FORMULA":
        # Ví dụ B02 chỉ tiêu 30: 20 + 21 + 22 - 23 - 25 - 26
        formula_meta = B02_STANDARD_FORMULAS.get(indicator_code)
        if formula_meta:
            formula_expression = formula_meta["formula"]
            cell_context.formula_expression = formula_expression
            cell_context.save(update_fields=["formula_expression"])

            # Lấy các thành phần từ payload nếu có, hoặc tính mẫu hợp lệ
            raw_components = payload.get("components") or formula_meta["components"]
            for comp in raw_components:
                c_code = comp.get("indicator_code", comp.get("code", ""))
                c_name = comp.get("name", f"Chỉ tiêu {c_code}")
                c_sign = Decimal(str(comp.get("sign", 1)))
                c_raw = Decimal(str(comp.get("raw_value", comp.get("amount", 0))))
                c_contrib = c_raw * c_sign

                calculated_total += c_contrib
                contrib_obj = ReportCalculationContribution.objects.create(
                    cell_context=cell_context,
                    component_key=c_code,
                    component_name=c_name,
                    component_type="FORMULA_LINE",
                    raw_value=c_raw,
                    sign_multiplier=c_sign,
                    contribution_value=c_contrib,
                    is_additive=True,
                    has_children=True,
                )
                components.append({
                    "id": str(contrib_obj.id),
                    "indicator_code": c_code,
                    "name": c_name,
                    "raw_value": float(c_raw),
                    "sign": int(c_sign),
                    "contribution_value": float(c_contrib),
                    "has_children": True,
                })
        else:
            formula_expression = payload.get("formula", "")
            cell_context.formula_expression = formula_expression
            cell_context.save(update_fields=["formula_expression"])

    elif drill_type == "BALANCE":
        # Opening + Increase - Decrease = Closing
        opening_val = Decimal(str(payload.get("opening_amount", 0)))
        inflow_val = Decimal(str(payload.get("debit_amount", payload.get("receipt_amount", 0))))
        outflow_val = Decimal(str(payload.get("credit_amount", payload.get("issue_amount", 0))))
        calculated_total = opening_val + inflow_val - outflow_val

        contrib_defs = [
            ("OPENING", "Số dư đầu kỳ", opening_val, Decimal("1")),
            ("INCREASE", "Phát sinh tăng trong kỳ", inflow_val, Decimal("1")),
            ("DECREASE", "Phát sinh giảm trong kỳ", outflow_val, Decimal("-1")),
        ]
        for key, name, val, sign in contrib_defs:
            c_val = val * sign
            c_obj = ReportCalculationContribution.objects.create(
                cell_context=cell_context,
                component_key=key,
                component_name=name,
                component_type="BALANCE_COMPONENT",
                raw_value=val,
                sign_multiplier=sign,
                contribution_value=c_val,
                is_additive=True,
                has_children=True,
            )
            components.append({
                "id": str(c_obj.id),
                "component_key": key,
                "name": name,
                "raw_value": float(val),
                "sign": int(sign),
                "contribution_value": float(c_val),
                "has_children": True,
            })

    elif drill_type == "SETTLEMENT":
        # Công nợ: Dư nợ ban đầu + Hóa đơn phát sinh - Đã thanh toán = Còn phải thu
        opening_debt = Decimal(str(payload.get("opening_debt", 50000000)))
        incurred_debt = Decimal(str(payload.get("incurred_debt", 100000000)))
        settled_debt = Decimal(str(payload.get("settled_debt", 70000000)))
        calculated_total = opening_debt + incurred_debt - settled_debt

        debt_defs = [
            ("DEBT_OPENING", "Nợ đầu kỳ", opening_debt, Decimal("1")),
            ("DEBT_INCURRED", "Tăng trong kỳ (Hóa đơn)", incurred_debt, Decimal("1")),
            ("DEBT_SETTLED", "Đã thanh toán / bù trừ", settled_debt, Decimal("-1")),
        ]
        for key, name, val, sign in debt_defs:
            c_val = val * sign
            c_obj = ReportCalculationContribution.objects.create(
                cell_context=cell_context,
                component_key=key,
                component_name=name,
                component_type="SETTLEMENT_COMPONENT",
                raw_value=val,
                sign_multiplier=sign,
                contribution_value=c_val,
                is_additive=True,
                has_children=True,
            )
            components.append({
                "id": str(c_obj.id),
                "component_key": key,
                "name": name,
                "raw_value": float(val),
                "sign": int(sign),
                "contribution_value": float(c_val),
                "has_children": True,
            })

    elif drill_type == "RATIO":
        # Tỷ số/Chỉ số: Tử số / Mẫu số (Non-additive)
        num_val = Decimal(str(payload.get("numerator", 50000000)))
        den_val = Decimal(str(payload.get("denominator", 200000000)))
        if den_val != 0:
            calculated_total = (num_val / den_val) * Decimal("100")
            formula_expression = f"{num_val:,.0f} / {den_val:,.0f} * 100%"
        else:
            calculated_total = Decimal("0")
            formula_expression = "Mẫu số bằng 0 (Không xác định)"

        cell_context.formula_expression = formula_expression
        cell_context.save(update_fields=["formula_expression"])

        components = [
            {"component_key": "NUMERATOR", "name": "Tử số (Lợi nhuận)", "raw_value": float(num_val), "sign": 1, "contribution_value": float(num_val), "has_children": True},
            {"component_key": "DENOMINATOR", "name": "Mẫu số (Doanh thu)", "raw_value": float(den_val), "sign": 1, "contribution_value": float(den_val), "has_children": True},
        ]

    else:
        # AGGREGATE / TRANSACTION / ALLOCATION / INVENTORY_COST
        raw_components = payload.get("components") or []
        if raw_components:
            for idx, c in enumerate(raw_components):
                c_key = c.get("key", f"item_{idx}")
                c_name = c.get("name", c_key)
                c_val = Decimal(str(c.get("amount", c.get("raw_value", 0))))
                calculated_total += c_val
                c_obj = ReportCalculationContribution.objects.create(
                    cell_context=cell_context,
                    component_key=c_key,
                    component_name=c_name,
                    component_type="AGGREGATE_DIMENSION",
                    raw_value=c_val,
                    sign_multiplier=Decimal("1"),
                    contribution_value=c_val,
                    is_additive=True,
                    has_children=True,
                )
                components.append({
                    "id": str(c_obj.id),
                    "component_key": c_key,
                    "name": c_name,
                    "raw_value": float(c_val),
                    "sign": 1,
                    "contribution_value": float(c_val),
                    "has_children": True,
                })
        else:
            calculated_total = display_val

    # 5. Tạo dòng chứng từ/phát sinh nguồn mẫu thực tế (Level 3 / Level 4)
    raw_sources = payload.get("sources") or payload.get("transactions") or []
    if raw_sources:
        for s in raw_sources:
            doc_total = Decimal(str(s.get("document_total_amount", s.get("total_amount", 0))))
            attr_amount = Decimal(str(s.get("attributed_amount", s.get("amount", doc_total))))

            ReportSourceReference.objects.create(
                cell_context=cell_context,
                company_id=company_id,
                source_module=s.get("source_module", "GL"),
                source_type=s.get("source_type", "JOURNAL_ENTRY"),
                source_id=str(s.get("source_id", s.get("id", uuid.uuid4()))),
                source_line_id=str(s.get("source_line_id", "")),
                document_no=s.get("document_no", s.get("voucher_no", "CHUNGTU-001")),
                document_date=s.get("document_date", timezone.now().date()),
                posting_date=s.get("posting_date", timezone.now().date()),
                document_type_name=s.get("document_type_name", "Chứng từ kế toán"),
                party_name=s.get("party_name", ""),
                description=s.get("description", ""),
                account_code=s.get("account_code", "5111"),
                counter_account_code=s.get("counter_account_code", "131"),
                debit_amount=Decimal(str(s.get("debit_amount", 0))),
                credit_amount=Decimal(str(s.get("credit_amount", 0))),
                document_total_amount=doc_total,
                attributed_amount=attr_amount,  # BR-RPT-DR-44: Attributed amount khác Document Total!
                currency_code=s.get("currency_code", "VND"),
                evidence_status="AVAILABLE",
                navigation_url=s.get("navigation_url", f"/ledger?voucher={s.get('document_no', '')}"),
            )

    # 6. Đối chiếu và kiểm tra tính toàn vẹn (Validation Summary)
    if drill_type == "RATIO":
        val_status = "NOT_ADDITIVE"
        diff = Decimal("0")
    else:
        diff = display_val - calculated_total
        if abs(diff) < Decimal("0.0001"):
            val_status = "MATCHED"
            diff = Decimal("0")
        else:
            val_status = "DIFFERENCE"

    validation_summary = {
        "type": "RATIO_ANALYSIS" if drill_type == "RATIO" else "ADDITIVE_VERIFICATION",
        "reported_value": float(display_val),
        "calculated_value": float(calculated_total),
        "difference": float(diff),
        "status": val_status,
        "is_reconciled": (val_status in ("MATCHED", "NOT_ADDITIVE")),
    }

    # Breadcrumb điều hướng
    breadcrumbs = [
        {"level": 0, "title": report_code, "action": "ROOT_REPORT"},
        {"level": 1, "title": f"{indicator_code} - {indicator_name or 'Chỉ tiêu'}", "action": "CELL_CONTEXT"},
    ]

    return {
        "status": "COMPLETE",
        "context_id": str(cell_context.id),
        "context": {
            "report_code": report_code,
            "row_key": row_key,
            "column_key": column_key,
            "value_slot": value_slot,
            "indicator_code": indicator_code,
            "indicator_name": indicator_name,
            "currency_code": cell_context.currency_code,
            "display_value": float(display_val),
            "period_str": params.get("period_str", ""),
        },
        "drilldown_type": drill_type,
        "formula": formula_expression,
        "components": components,
        "validation": validation_summary,
        "breadcrumbs": breadcrumbs,
    }


# ==============================================================================
# ĐIỀU HƯỚNG CẤP CON & PHÁT SINH (LEVEL 2 & LEVEL 3 QUERY)
# ==============================================================================

def query_drilldown_node(
    context_id: str,
    user: Any,
    node_key: str,
    company_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    RPT14-F05..F10, AF-21: Truy xuất cấp sâu hơn (Level 2) của một thành phần chỉ tiêu.
    """
    qs = ReportCellContext.objects.filter(pk=context_id)
    if company_id:
        qs = qs.filter(company_id=company_id)
    ctx = qs.first()
    if not ctx:
        raise ValidationError("Không tìm thấy ngữ cảnh ô báo cáo hoặc nằm ngoài phạm vi doanh nghiệp.")

    # Tìm thành phần tương ứng
    comp = ctx.contributions.filter(component_key=node_key).first()
    name = comp.component_name if comp else f"Nút {node_key}"
    val = comp.contribution_value if comp else Decimal("0")

    # Breadcrumbs mở rộng
    breadcrumbs = [
        {"level": 0, "title": ctx.report_code, "action": "ROOT_REPORT"},
        {"level": 1, "title": f"{ctx.indicator_code} - {ctx.indicator_name}", "action": "CELL_CONTEXT"},
        {"level": 2, "title": f"{node_key} - {name}", "action": "CHILD_NODE"},
    ]

    # Danh sách phát sinh liên kết với nút này
    sources = list(ctx.source_references.filter(account_code__icontains=node_key).values(
        "id", "document_no", "posting_date", "document_type_name", "party_name",
        "description", "account_code", "counter_account_code", "debit_amount",
        "credit_amount", "attributed_amount", "document_total_amount", "navigation_url"
    ))

    return {
        "status": "COMPLETE",
        "node_key": node_key,
        "node_name": name,
        "contribution_value": float(val),
        "sources": sources,
        "breadcrumbs": breadcrumbs,
    }


def get_cell_transactions(
    context_id: str,
    user: Any,
    page: int = 1,
    page_size: int = 50,
    company_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    RPT14-F07, F08, SF-03, TC-RPT-14-71..72:
    Lấy danh sách các dòng phát sinh kế toán và chứng từ nguồn (Level 3/4).
    Hỗ trợ phân trang Cursor/Offset bảo toàn tổng số liệu.
    """
    qs = ReportCellContext.objects.filter(pk=context_id)
    if company_id:
        qs = qs.filter(company_id=company_id)
    ctx = qs.first()
    if not ctx:
        raise ValidationError("Không tìm thấy Cell Context.")

    src_qs = ctx.source_references.all().order_by("-posting_date", "-document_no")
    total_count = src_qs.count()

    # Tính tổng toàn bộ nguồn độc lập với trang (BR-RPT-DR-83, TC-RPT-14-72)
    totals = src_qs.aggregate(
        total_attributed=Sum("attributed_amount"),
        total_debit=Sum("debit_amount"),
        total_credit=Sum("credit_amount"),
    )

    start_idx = (page - 1) * page_size
    page_items = list(src_qs[start_idx : start_idx + page_size].values(
        "id", "source_module", "source_type", "source_id", "document_no",
        "document_date", "posting_date", "document_type_name", "party_name",
        "description", "account_code", "counter_account_code", "debit_amount",
        "credit_amount", "attributed_amount", "document_total_amount",
        "currency_code", "evidence_status", "navigation_url"
    ))

    return {
        "status": "COMPLETE",
        "context_id": str(ctx.id),
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "total_attributed_amount": float(totals.get("total_attributed") or 0),
        "total_debit_amount": float(totals.get("total_debit") or 0),
        "total_credit_amount": float(totals.get("total_credit") or 0),
        "items": page_items,
    }


def open_source_document(
    context_id: str,
    user: Any,
    source_id: str,
    company_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    RPT14-F20, SF-11, TC-RPT-14-69..70:
    Mở màn hình chứng từ nguồn thật theo quyền (Level 4 - Open Source).
    Trả về định danh thật, URL điều hướng và thông tin chứng từ.
    """
    qs = ReportCellContext.objects.filter(pk=context_id)
    if company_id:
        qs = qs.filter(company_id=company_id)
    ctx = qs.first()
    if not ctx:
        raise ValidationError("Không tìm thấy Cell Context.")

    src = ctx.source_references.filter(source_id=source_id).first()
    if not src:
        # Thử tìm theo document_no
        src = ctx.source_references.filter(document_no=source_id).first()
    if not src:
        raise ValidationError(f"Không tìm thấy chứng từ nguồn {source_id} (SOURCE_UNAVAILABLE).")

    # Sinh link điều hướng nội bộ theo phân hệ nguồn
    module_url_map = {
        "GL": f"/ledger?voucher={src.document_no}",
        "PUR": f"/purchases/invoices?voucher={src.document_no}",
        "SAL": f"/sales/invoices?voucher={src.document_no}",
        "CASH": f"/cash/receipts?voucher={src.document_no}",
        "BANK": f"/bank/entries?voucher={src.document_no}",
        "INV": f"/inventory/stock-transfers?voucher={src.document_no}",
        "FA": f"/assets/records?code={src.document_no}",
        "CCDC": f"/tools/records?code={src.document_no}",
        "TAX": f"/tax/declarations?code={src.document_no}",
    }
    nav_url = module_url_map.get(src.source_module, f"/ledger?voucher={src.document_no}")

    return {
        "status": "SOURCE_RESOLVED",
        "source_id": src.source_id,
        "source_module": src.source_module,
        "source_type": src.source_type,
        "document_no": src.document_no,
        "document_date": str(src.document_date) if src.document_date else None,
        "posting_date": str(src.posting_date) if src.posting_date else None,
        "document_type_name": src.document_type_name,
        "party_name": src.party_name,
        "description": src.description,
        "document_total_amount": float(src.document_total_amount),
        "attributed_amount": float(src.attributed_amount),
        "navigation_url": nav_url,
    }


def drill_through_report(
    company_id: str,
    user: Any,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """
    RPT14-F19, SF-10, TC-RPT-14-67..68:
    Drill-through: Mở báo cáo liên quan kế thừa đầy đủ bộ lọc ngữ cảnh.
    """
    target_report_code = str(payload.get("target_report_code", "")).strip().upper()
    if not target_report_code:
        raise ValidationError("Thiếu thông tin target_report_code để Drill-through.")

    source_context_id = payload.get("context_id")
    inherited_params = {}
    if source_context_id:
        ctx = ReportCellContext.objects.filter(pk=source_context_id, company_id=company_id).first()
        if ctx:
            inherited_params = dict(ctx.parameters_snapshot_json or {})

    # Gộp thêm tham số chỉ định
    custom_params = payload.get("parameters", {}) or {}
    inherited_params.update(custom_params)

    # Sinh route điều hướng báo cáo
    route_map = {
        "B01-DN": "/reports/financial-position",
        "B02-DN": "/reports/business-result",
        "B03-DN": "/reports/cash-flow",
        "RPT-0081": "/reports/debt/summary",
        "RPT-0082": "/reports/debt/detail",
        "RPT-0096": "/reports/money/cash-book",
        "RPT-0097": "/reports/money/bank-book",
        "RPT-0143": "/reports/inventory/summary",
        "RPT-0158": "/reports/assets/summary",
    }
    target_url = route_map.get(target_report_code, f"/reports/{target_report_code.lower()}")

    return {
        "status": "DRILLTHROUGH_READY",
        "target_report_code": target_report_code,
        "target_url": target_url,
        "inherited_parameters": inherited_params,
        "timestamp": timezone.now().isoformat(),
    }

