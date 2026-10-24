"""
UC-RPT-13 – Xem báo cáo tài sản và công cụ dụng cụ (14 Báo cáo TSCĐ, CCDC & Chi phí trả trước)

Cung cấp toàn bộ logic tổng hợp, tính toán, đối chiếu và kiểm tra số liệu:
- RPT-0158: Bảng tính phân bổ công cụ dụng cụ (13 cột)
- RPT-0159: Sổ theo dõi công cụ dụng cụ (18 cột)
- RPT-0160: Bảng tính phân bổ công cụ dụng cụ theo năm (29 cột: 12 tháng + tổng năm)
- RPT-0161: Báo cáo chi tiết giảm công cụ dụng cụ (11 cột)
- RPT-0162: Sổ theo dõi công cụ dụng cụ theo đơn vị sử dụng (9 cột)
- RPT-0163: Tình hình phân bổ chi phí trả trước (12 cột)
- RPT-0164: Bảng tính phân bổ chi phí trả trước (13 cột)
- RPT-0165: Tình hình phân bổ chi phí trả trước theo năm (28 cột: 12 tháng + tổng năm)
- RPT-0166: Báo cáo đối chiếu sổ theo dõi CCDC, chi phí trả trước và sổ cái (11 cột)
- RPT-0167: S21-DN: Sổ tài sản cố định (14 cột)
- RPT-0168: Sổ tài sản cố định (18 cột)
- RPT-0169: Thẻ tài sản cố định (10 cột + rich section detail payload)
- RPT-0170: Bảng tính khấu hao tài sản cố định theo năm (27 cột: 12 tháng + tổng năm)
- RPT-0171: Báo cáo đối chiếu sổ tài sản và sổ cái (11 cột)

Tuân thủ nguyên tắc read-only tuyệt đối (BR-RPT-FA-09, BR-RPT-FA-111..114).
Không lấy số dư hiện tại để thay số dư lịch sử As-of Date.
"""

from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import logging
from typing import Any
import uuid

from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from general_ledger.models import (
    Account,
    JournalEntry,
    JournalLine,
    PrepaidExpense,
    PrepaidExpenseTarget,
    PrepaidAllocation,
    PrepaidAllocationLine,
)
from organization.models import Branch, Company, Department, Employee
from fixed_assets.models import (
    AssetRecord,
    AssetCategory,
    AssetTransaction,
    AssetType,
    AssetStatus,
    TransactionType,
    TransactionStatus,
    CalculationRun,
    CalculationLine,
)

from .models import (
    ReportDefinition,
    AssetReportRun,
    AssetReportRow,
    AssetReportValidationResult,
    AssetSavedFilter,
)

logger = logging.getLogger(__name__)

ZERO = Decimal("0.0000")
TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")

# Permissions TO-BE
PERM_ASSET_VIEW = "RPT_ASSET_VIEW"
PERM_FA_VIEW = "RPT_FA_VIEW"
PERM_CCDC_VIEW = "RPT_CCDC_VIEW"
PERM_PREPAID_VIEW = "RPT_PREPAID_VIEW"
PERM_DEPRECIATION_VIEW = "RPT_DEPRECIATION_VIEW"
PERM_ALLOCATION_VIEW = "RPT_ALLOCATION_VIEW"
PERM_ASSET_RECON_VIEW = "RPT_ASSET_RECON_VIEW"
PERM_ASSET_EXPORT = "RPT_ASSET_EXPORT"

ALL_ASSET_PERMISSIONS = (
    PERM_ASSET_VIEW,
    PERM_FA_VIEW,
    PERM_CCDC_VIEW,
    PERM_PREPAID_VIEW,
    PERM_DEPRECIATION_VIEW,
    PERM_ALLOCATION_VIEW,
    PERM_ASSET_RECON_VIEW,
    PERM_ASSET_EXPORT,
)

PERM_ALIASES: dict[str, tuple[str, ...]] = {
    PERM_ASSET_VIEW: (
        "RPT_ASSET_VIEW",
        "RPT.ASSET.VIEW",
        "RPT.VIEW",
        "ASSET.VIEW",
        "FA.VIEW",
        "RPT_FA_VIEW",
        "RPT_CCDC_VIEW",
    ),
    PERM_FA_VIEW: (
        "RPT_FA_VIEW",
        "RPT.FA.VIEW",
        "FA.VIEW",
    ),
    PERM_CCDC_VIEW: (
        "RPT_CCDC_VIEW",
        "RPT.CCDC.VIEW",
        "CCDC.VIEW",
        "TOOL.VIEW",
    ),
    PERM_PREPAID_VIEW: (
        "RPT_PREPAID_VIEW",
        "RPT.PREPAID.VIEW",
        "PREPAID.VIEW",
    ),
    PERM_DEPRECIATION_VIEW: (
        "RPT_DEPRECIATION_VIEW",
        "RPT.DEPRECIATION.VIEW",
        "DEPRECIATION.VIEW",
    ),
    PERM_ALLOCATION_VIEW: (
        "RPT_ALLOCATION_VIEW",
        "RPT.ALLOCATION.VIEW",
        "ALLOCATION.VIEW",
    ),
    PERM_ASSET_RECON_VIEW: (
        "RPT_ASSET_RECON_VIEW",
        "RPT.ASSET.RECON.VIEW",
        "ASSET.RECON.VIEW",
    ),
    PERM_ASSET_EXPORT: (
        "RPT_ASSET_EXPORT",
        "RPT.ASSET.EXPORT",
        "RPT.EXPORT",
    ),
}


def _to_dec(val: Any, places: Decimal = TWO_PLACES) -> Decimal:
    if val is None or val == "":
        return Decimal("0.00")
    if isinstance(val, Decimal):
        return val.quantize(places, rounding=ROUND_HALF_UP)
    try:
        return Decimal(str(val)).quantize(places, rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal("0.00")


def _to_qty(val: Any) -> Decimal:
    return _to_dec(val, places=FOUR_PLACES)


def _fmt_dec(val: Any) -> float:
    return float(_to_dec(val))


def _to_json_safe(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (date, datetime)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, dict):
        return {str(k): _to_json_safe(v) for k, v in val.items()}
    if isinstance(val, (list, tuple, set)):
        return [_to_json_safe(v) for v in val]
    return val


# -----------------------------------------------------------------------------
# Metadata & Catalogue definitions for 14 Asset / CCDC / Prepaid Reports
# -----------------------------------------------------------------------------

ASSET_REPORT_SCHEMAS: dict[str, dict[str, Any]] = {
    # 1. RPT-0158: Bảng tính phân bổ công cụ dụng cụ - 13 cột
    "RPT-0158": {
        "report_code": "RPT-0158",
        "report_name": "Bảng tính phân bổ công cụ dụng cụ",
        "asset_report_type": "CCDC",
        "report_category_type": "CCDC_ALLOCATION_TABLE",
        "schema_version": "1.0",
        "required_permission": PERM_CCDC_VIEW,
        "fixed_columns_count": 13,
        "columns": [
            {"code": "tool_name", "name": "Tên CCDC", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "tool_code", "name": "Mã CCDC", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "remaining_quantity", "name": "Số lượng còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "allocation_periods", "name": "Số kỳ phân bổ", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "remaining_periods", "name": "Số kỳ phân bổ còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "original_value", "name": "Giá trị CCDC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "allocation_target", "name": "Đối tượng phân bổ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "expense_account_code", "name": "TK chi phí", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "current_allocation_amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "accumulated_allocation", "name": "Lũy kế đã PB", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_value", "name": "Giá trị còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "prepaid_account_code", "name": "TK chờ phân bổ", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 2. RPT-0159: Sổ theo dõi công cụ dụng cụ - 18 cột
    "RPT-0159": {
        "report_code": "RPT-0159",
        "report_name": "Sổ theo dõi công cụ dụng cụ",
        "asset_report_type": "CCDC",
        "report_category_type": "CCDC_TRACKING_LEDGER",
        "schema_version": "1.0",
        "required_permission": PERM_CCDC_VIEW,
        "fixed_columns_count": 18,
        "columns": [
            {"code": "tool_code", "name": "Mã CCDC", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "tool_name", "name": "Tên CCDC", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "tool_category_name", "name": "Loại CCDC", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "increase_reason", "name": "Lý do ghi tăng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "increase_date", "name": "Ngày ghi tăng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "increase_document_no", "name": "Số CT ghi tăng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "allocation_periods", "name": "Số kỳ phân bổ", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "remaining_allocation_periods", "name": "Số kỳ PB còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "increase_quantity", "name": "SL ghi tăng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "cumulative_reduced_quantity", "name": "Lũy kế SL đã giảm", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_quantity", "name": "SL còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "original_value", "name": "Giá trị CCDC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "periodic_allocation_amount", "name": "Giá trị PB hàng kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "allocation_amount_period", "name": "Phân bổ trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "accumulated_allocation", "name": "Lũy kế đã PB", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_value", "name": "Giá trị còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "prepaid_account_code", "name": "TK chờ phân bổ", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 3. RPT-0160: Bảng tính phân bổ công cụ dụng cụ theo năm - 29 cột
    "RPT-0160": {
        "report_code": "RPT-0160",
        "report_name": "Bảng tính phân bổ công cụ dụng cụ theo năm",
        "asset_report_type": "CCDC",
        "report_category_type": "CCDC_ANNUAL_ALLOCATION",
        "schema_version": "1.0",
        "required_permission": PERM_CCDC_VIEW,
        "fixed_columns_count": 29,
        "columns": [
            {"code": "tool_code", "name": "Mã CCDC", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "tool_name", "name": "Tên CCDC", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "increase_date", "name": "Ngày ghi tăng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "increase_quantity", "name": "Số lượng ghi tăng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "original_value", "name": "Giá trị CCDC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "allocation_periods", "name": "Số kỳ phân bổ", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "monthly_allocation_amount", "name": "Giá trị phân bổ tháng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "periods_allocated_before_year", "name": "Số kỳ đã phân bổ trước đó", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "allocated_value_before_year", "name": "Giá trị đã phân bổ trước đó", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_01", "name": "Tháng 1", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_02", "name": "Tháng 2", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_03", "name": "Tháng 3", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_04", "name": "Tháng 4", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_05", "name": "Tháng 5", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_06", "name": "Tháng 6", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_07", "name": "Tháng 7", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_08", "name": "Tháng 8", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_09", "name": "Tháng 9", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_10", "name": "Tháng 10", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_11", "name": "Tháng 11", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_12", "name": "Tháng 12", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "allocation_total_year", "name": "Tổng cộng năm", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "total_allocated_periods", "name": "Tổng số kỳ đã phân bổ", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "total_allocated_value", "name": "Tổng giá trị đã phân bổ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_periods", "name": "Số kỳ còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "remaining_value", "name": "Giá trị còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "prepaid_account_code", "name": "Tài khoản chờ phân bổ", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "expense_account_code", "name": "Tài khoản chi phí", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 4. RPT-0161: Báo cáo chi tiết giảm công cụ dụng cụ - 11 cột
    "RPT-0161": {
        "report_code": "RPT-0161",
        "report_name": "Báo cáo chi tiết giảm công cụ dụng cụ",
        "asset_report_type": "CCDC",
        "report_category_type": "CCDC_REDUCTION_DETAIL",
        "schema_version": "1.0",
        "required_permission": PERM_CCDC_VIEW,
        "fixed_columns_count": 11,
        "columns": [
            {"code": "tool_code", "name": "Mã CCDC", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "tool_name", "name": "Tên CCDC", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "tool_category_name", "name": "Loại CCDC", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "reduced_quantity", "name": "Số lượng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "reduced_original_value", "name": "Giá trị CCDC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "allocated_value_of_reduction", "name": "Giá trị đã phân bổ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_value_of_reduction", "name": "Giá trị còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "reduction_reason", "name": "Lý do giảm", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    # 5. RPT-0162: Sổ theo dõi công cụ dụng cụ theo đơn vị sử dụng - 9 cột
    "RPT-0162": {
        "report_code": "RPT-0162",
        "report_name": "Sổ theo dõi công cụ dụng cụ theo đơn vị sử dụng",
        "asset_report_type": "CCDC",
        "report_category_type": "CCDC_DEPARTMENT_TRACKING",
        "schema_version": "1.0",
        "required_permission": PERM_CCDC_VIEW,
        "fixed_columns_count": 9,
        "columns": [
            {"code": "tool_code", "name": "Mã CCDC", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "tool_name", "name": "Tên CCDC", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "quantity_increase", "name": "Số lượng tăng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "quantity_decrease", "name": "Số lượng giảm", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_quantity", "name": "Số lượng còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_tools_original_value", "name": "Tổng giá trị", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_tools_allocated_value", "name": "Số đã phân bổ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_tools_net_value", "name": "Số còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 6. RPT-0163: Tình hình phân bổ chi phí trả trước - 12 cột
    "RPT-0163": {
        "report_code": "RPT-0163",
        "report_name": "Tình hình phân bổ chi phí trả trước",
        "asset_report_type": "PREPAID",
        "report_category_type": "PREPAID_ALLOCATION_STATUS",
        "schema_version": "1.0",
        "required_permission": PERM_PREPAID_VIEW,
        "fixed_columns_count": 12,
        "columns": [
            {"code": "prepaid_code", "name": "Mã chi phí trả trước", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "prepaid_name", "name": "Tên chi phí trả trước", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "recognition_date", "name": "Ngày ghi nhận", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "allocation_periods", "name": "Số kỳ phân bổ", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "remaining_periods", "name": "Số kỳ PB còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "original_amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "periodic_allocation_amount", "name": "Số tiền PB hàng kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "current_allocation", "name": "Phân bổ trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "accumulated_allocation", "name": "Lũy kế đã PB", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "reduction_amount", "name": "Số ghi giảm", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Số tiền còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "prepaid_account_code", "name": "Tài khoản chờ phân bổ", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 7. RPT-0164: Bảng tính phân bổ chi phí trả trước - 13 cột
    "RPT-0164": {
        "report_code": "RPT-0164",
        "report_name": "Bảng tính phân bổ chi phí trả trước",
        "asset_report_type": "PREPAID",
        "report_category_type": "PREPAID_ALLOCATION_TABLE",
        "schema_version": "1.0",
        "required_permission": PERM_PREPAID_VIEW,
        "fixed_columns_count": 13,
        "columns": [
            {"code": "prepaid_code", "name": "Mã chi phí trả trước", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "prepaid_name", "name": "Tên chi phí trả trước", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "recognition_date", "name": "Ngày ghi nhận", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "allocation_periods", "name": "Số kỳ phân bổ", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "remaining_periods", "name": "Số kỳ PB còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "original_amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "allocation_target", "name": "Đối tượng phân bổ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "expense_account_code", "name": "TK chi phí", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "allocated_amount_period", "name": "Số tiền PB trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "accumulated_allocation", "name": "Lũy kế đã PB", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "reduction_amount", "name": "Số ghi giảm", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Số tiền còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "prepaid_account_code", "name": "TK chờ phân bổ", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 8. RPT-0165: Tình hình phân bổ chi phí trả trước theo năm - 28 cột
    "RPT-0165": {
        "report_code": "RPT-0165",
        "report_name": "Tình hình phân bổ chi phí trả trước theo năm",
        "asset_report_type": "PREPAID",
        "report_category_type": "PREPAID_ANNUAL_ALLOCATION",
        "schema_version": "1.0",
        "required_permission": PERM_PREPAID_VIEW,
        "fixed_columns_count": 28,
        "columns": [
            {"code": "prepaid_code", "name": "Mã chi phí trả trước", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "prepaid_name", "name": "Tên chi phí trả trước", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "recognition_date", "name": "Ngày ghi nhận", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "allocation_periods", "name": "Số kỳ phân bổ", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "periods_allocated_before_year", "name": "Số kỳ đã PB trước đó", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "original_amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "periodic_allocation_amount", "name": "Số tiền PB hàng kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "allocated_amount_before_year", "name": "Số tiền lũy kế đã PB trước đó", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_01", "name": "Tháng 1", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_02", "name": "Tháng 2", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_03", "name": "Tháng 3", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_04", "name": "Tháng 4", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_05", "name": "Tháng 5", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_06", "name": "Tháng 6", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_07", "name": "Tháng 7", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_08", "name": "Tháng 8", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_09", "name": "Tháng 9", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_10", "name": "Tháng 10", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_11", "name": "Tháng 11", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_12", "name": "Tháng 12", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "allocation_total_year", "name": "Tổng cộng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "total_allocated_periods", "name": "Tổng số kỳ đã phân bổ", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "total_accumulated_allocation", "name": "Tổng số tiền lũy kế đã PB", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_periods", "name": "Số kỳ PB còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "reduction_amount", "name": "Số ghi giảm", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Số tiền còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "prepaid_account_code", "name": "Tài khoản chờ phân bổ", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "expense_account_code", "name": "Tài khoản chi phí", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 9. RPT-0166: Đối chiếu sổ theo dõi CCDC, chi phí trả trước và sổ cái - 11 cột
    "RPT-0166": {
        "report_code": "RPT-0166",
        "report_name": "Báo cáo đối chiếu sổ theo dõi CCDC, chi phí trả trước và sổ cái",
        "asset_report_type": "RECONCILIATION",
        "report_category_type": "RECONCILIATION_CCDC_PREPAID_GL",
        "schema_version": "1.0",
        "required_permission": PERM_ASSET_RECON_VIEW,
        "fixed_columns_count": 11,
        "columns": [
            {"code": "source_book_date", "name": "Ngày ghi sổ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "source_document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "source_document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "source_document_type", "name": "Loại chứng từ", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "source_book_amount", "name": "Số tiền sổ theo dõi", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gl_posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "gl_document_date", "name": "Ngày chứng từ GL", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "gl_document_no", "name": "Số chứng từ GL", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gl_description", "name": "Diễn giải GL", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gl_amount", "name": "Số tiền sổ cái", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "difference_amount", "name": "Chênh lệch", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 10. RPT-0167: S21-DN: Sổ tài sản cố định - 14 cột
    "RPT-0167": {
        "report_code": "RPT-0167",
        "report_name": "S21-DN: Sổ tài sản cố định",
        "asset_report_type": "FIXED_ASSET",
        "report_category_type": "FA_S21_DN_LEDGER",
        "schema_version": "1.0",
        "required_permission": PERM_FA_VIEW,
        "fixed_columns_count": 14,
        "official_standard": "Thông tư 200/2014/TT-BTC & TT 99/2025/TT-BTC",
        "columns": [
            {"code": "voucher_increase_no", "name": "Số hiệu ghi tăng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "voucher_increase_date", "name": "Ngày tháng ghi tăng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "asset_code", "name": "Mã TSCĐ", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "asset_name", "name": "Tên, đặc điểm TSCĐ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "country_of_origin", "name": "Nước sản xuất", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "in_service_year", "name": "Năm đưa vào sử dụng", "data_type": "NUMBER", "align": "center", "is_totalable": False},
            {"code": "original_cost", "name": "Nguyên giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "depreciation_rate", "name": "Tỷ lệ khấu hao (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "depreciation_period", "name": "Hao mòn trong năm/kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "accumulated_depreciation", "name": "Hao mòn lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_book_value", "name": "Giá trị còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "voucher_decrease_no", "name": "Số hiệu ghi giảm", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "voucher_decrease_date", "name": "Ngày tháng ghi giảm", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "decrease_reason", "name": "Lý do ghi giảm", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    # 11. RPT-0168: Sổ tài sản cố định - 18 cột
    "RPT-0168": {
        "report_code": "RPT-0168",
        "report_name": "Sổ tài sản cố định",
        "asset_report_type": "FIXED_ASSET",
        "report_category_type": "FA_DETAILED_LEDGER",
        "schema_version": "1.0",
        "required_permission": PERM_FA_VIEW,
        "fixed_columns_count": 18,
        "columns": [
            {"code": "asset_code", "name": "Mã TSCĐ", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "asset_name", "name": "Tên TSCĐ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "asset_category_name", "name": "Loại TSCĐ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "using_department_name", "name": "Đơn vị sử dụng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "increase_date", "name": "Ngày ghi tăng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "increase_document_no", "name": "Số CT ghi tăng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "depreciation_start_date", "name": "Ngày bắt đầu tính KH", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "useful_life_months", "name": "Thời gian SD (tháng)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "remaining_life_months", "name": "Thời gian SD còn lại (tháng)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "original_cost", "name": "Nguyên giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "depreciable_amount", "name": "Giá trị tính KH", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "depreciation_period", "name": "Hao mòn trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "accumulated_depreciation", "name": "Hao mòn lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "asset_reduction_value", "name": "Giá trị giảm TSCĐ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_book_value", "name": "Giá trị còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "monthly_depreciation_amount", "name": "Giá trị KH tháng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "asset_account_code", "name": "TK nguyên giá", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "accum_depr_account_code", "name": "TK khấu hao", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 12. RPT-0169: Thẻ tài sản cố định - 10 cột + payload
    "RPT-0169": {
        "report_code": "RPT-0169",
        "report_name": "Thẻ tài sản cố định",
        "asset_report_type": "FIXED_ASSET",
        "report_category_type": "FA_CARD",
        "schema_version": "1.0",
        "required_permission": PERM_FA_VIEW,
        "fixed_columns_count": 10,
        "columns": [
            {"code": "asset_code", "name": "Mã TSCĐ", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "asset_name", "name": "Tên TSCĐ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "serial_number", "name": "Số hiệu / Serial", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "in_service_date", "name": "Ngày đưa vào SD", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "original_cost", "name": "Nguyên giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "useful_life_months", "name": "Thời gian SD (tháng)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "accumulated_depreciation", "name": "Hao mòn lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_book_value", "name": "Giá trị còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "department_name", "name": "Đơn vị sử dụng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "status", "name": "Trạng thái", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 13. RPT-0170: Bảng tính khấu hao tài sản cố định theo năm - 27 cột
    "RPT-0170": {
        "report_code": "RPT-0170",
        "report_name": "Bảng tính khấu hao tài sản cố định theo năm",
        "asset_report_type": "FIXED_ASSET",
        "report_category_type": "FA_ANNUAL_DEPRECIATION",
        "schema_version": "1.0",
        "required_permission": PERM_FA_VIEW,
        "fixed_columns_count": 27,
        "columns": [
            {"code": "asset_code", "name": "Mã TSCĐ", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "asset_name", "name": "Tên TSCĐ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "increase_date", "name": "Ngày ghi tăng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "depreciation_start_date", "name": "Ngày bắt đầu tính khấu hao", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "original_cost", "name": "Nguyên giá TSCĐ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "depreciable_amount", "name": "Giá trị tính KH", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "useful_life_months", "name": "Thời gian sử dụng (tháng)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "monthly_depreciation_amount", "name": "Giá trị khấu hao tháng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "used_months_before_year", "name": "Thời gian SD lũy kế đầu kỳ (tháng)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "accumulated_depreciation_beginning", "name": "Hao mòn lũy kế đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_01", "name": "Tháng 1", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_02", "name": "Tháng 2", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_03", "name": "Tháng 3", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_04", "name": "Tháng 4", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_05", "name": "Tháng 5", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_06", "name": "Tháng 6", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_07", "name": "Tháng 7", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_08", "name": "Tháng 8", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_09", "name": "Tháng 9", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_10", "name": "Tháng 10", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_11", "name": "Tháng 11", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "month_12", "name": "Tháng 12", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "depreciation_total_year", "name": "Tổng cộng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "used_months_cumulative_end", "name": "Thời gian SD lũy kế cuối kỳ (tháng)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "accumulated_depreciation_end", "name": "Hao mòn lũy kế cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_life_months", "name": "Thời gian SD còn lại (tháng)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "net_book_value", "name": "Giá trị còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 14. RPT-0171: Báo cáo đối chiếu sổ tài sản và sổ cái - 11 cột
    "RPT-0171": {
        "report_code": "RPT-0171",
        "report_name": "Báo cáo đối chiếu sổ tài sản và sổ cái",
        "asset_report_type": "RECONCILIATION",
        "report_category_type": "RECONCILIATION_FA_GL",
        "schema_version": "1.0",
        "required_permission": PERM_ASSET_RECON_VIEW,
        "fixed_columns_count": 11,
        "columns": [
            {"code": "asset_book_date", "name": "Ngày ghi sổ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "asset_document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "asset_document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "asset_document_type", "name": "Loại chứng từ", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "asset_book_amount", "name": "Số tiền sổ TSCĐ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gl_posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "gl_document_date", "name": "Ngày chứng từ GL", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "gl_document_no", "name": "Số chứng từ GL", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gl_description", "name": "Diễn giải GL", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gl_amount", "name": "Số tiền sổ cái", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "difference_amount", "name": "Chênh lệch", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
}


# -----------------------------------------------------------------------------
# Permission & RBAC Verification
# -----------------------------------------------------------------------------

def check_asset_report_permission(user: Any, required_perm: str = PERM_ASSET_VIEW) -> bool:
    """Kiểm tra quyền truy cập báo cáo tài sản / CCDC / CPTT."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True

    user_perms: set[str] = set()
    if hasattr(user, "get_all_permissions"):
        user_perms.update(user.get_all_permissions())
    if hasattr(user, "permissions_cache"):
        user_perms.update(user.permissions_cache)
    if hasattr(user, "roles"):
        for role in user.roles.all():
            if hasattr(role, "permissions"):
                user_perms.update(role.permissions.values_list("code", flat=True))

    aliases = PERM_ALIASES.get(required_perm, (required_perm,))
    base_aliases = PERM_ALIASES.get(PERM_ASSET_VIEW, (PERM_ASSET_VIEW,))
    all_needed = set(aliases) | set(base_aliases)

    return any(p in user_perms for p in all_needed)


def require_asset_permission(user: Any, required_perm: str = PERM_ASSET_VIEW) -> None:
    if not check_asset_report_permission(user, required_perm):
        raise PermissionDenied(f"Người dùng không có quyền truy cập báo cáo tài sản ({required_perm}).")


# -----------------------------------------------------------------------------
# Catalogue & Metadata Providers
# -----------------------------------------------------------------------------

def get_asset_reports_catalogue(user: Any = None) -> list[dict[str, Any]]:
    """Trả về danh mục 14 báo cáo tài sản / CCDC / CPTT đã cấu hình."""
    catalogue = []
    for code, schema in ASSET_REPORT_SCHEMAS.items():
        has_perm = True
        if user:
            has_perm = check_asset_report_permission(user, schema.get("required_permission", PERM_ASSET_VIEW))
        catalogue.append({
            "report_code": schema["report_code"],
            "report_name": schema["report_name"],
            "asset_report_type": schema["asset_report_type"],
            "report_category_type": schema["report_category_type"],
            "schema_version": schema["schema_version"],
            "columns_count": len(schema["columns"]),
            "has_permission": has_perm,
            "required_permission": schema.get("required_permission", PERM_ASSET_VIEW),
        })
    return catalogue


def get_asset_report_schema(report_code: str, user: Any = None) -> dict[str, Any]:
    schema = ASSET_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo không tồn tại: {report_code}")
    if user:
        require_asset_permission(user, schema.get("required_permission", PERM_ASSET_VIEW))
    return schema


# -----------------------------------------------------------------------------
# As-of Date Reconstruction & Builders
# -----------------------------------------------------------------------------

def _parse_report_dates(params: dict[str, Any]) -> tuple[date, date, date, int]:
    """Trích xuất from_date, to_date, as_of_date và fiscal_year từ parameters."""
    today = timezone.localdate()
    as_of = params.get("as_of_date")
    from_d = params.get("from_date")
    to_d = params.get("to_date")
    year = params.get("fiscal_year") or params.get("year")

    if year:
        try:
            year = int(year)
        except Exception:
            year = today.year
    else:
        year = today.year

    if as_of:
        if isinstance(as_of, str):
            as_of_date = date.fromisoformat(as_of)
        else:
            as_of_date = as_of
    elif to_d:
        if isinstance(to_d, str):
            as_of_date = date.fromisoformat(to_d)
        else:
            as_of_date = to_d
    else:
        as_of_date = today

    if from_d:
        from_date = date.fromisoformat(from_d) if isinstance(from_d, str) else from_d
    else:
        from_date = date(as_of_date.year, 1, 1)

    if to_d:
        to_date = date.fromisoformat(to_d) if isinstance(to_d, str) else to_d
    else:
        to_date = as_of_date

    return from_date, to_date, as_of_date, year


def build_rpt_0158(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0158: Bảng tính phân bổ công cụ dụng cụ (13 cột)."""
    from_d, to_d, as_of, year = _parse_report_dates(params)
    exclude_zero = params.get("exclude_zero_remaining", False)
    category_id = params.get("category_id") or params.get("tool_category_id")

    qs = AssetRecord.objects.filter(
        company_id=company_id,
        asset_type=AssetType.TOOL,
        acquisition_date__lte=to_d,
    ).select_related("category")

    if category_id:
        qs = qs.filter(category_id=category_id)

    rows = []
    tot_orig = ZERO
    tot_curr = ZERO
    tot_accum = ZERO
    tot_rem = ZERO

    # Tải calculation lines trong kỳ
    run_lines = CalculationLine.objects.filter(
        run__company_id=company_id,
        run__calculation_type="ALLOCATION",
        run__status="POSTED",
        run__period_start__lte=to_d,
        run__period_end__gte=from_d,
    ).select_related("asset")

    alloc_by_asset: dict[str, Decimal] = {}
    for cl in run_lines:
        alloc_by_asset[str(cl.asset_id)] = alloc_by_asset.get(str(cl.asset_id), ZERO) + _to_dec(cl.amount)

    for tool in qs:
        # Tính lũy kế phân bổ đến to_d
        calc_lines_all = CalculationLine.objects.filter(
            run__company_id=company_id,
            run__calculation_type="ALLOCATION",
            run__status="POSTED",
            run__period_end__lte=to_d,
            asset_id=tool.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        accum_alloc = _to_dec(calc_lines_all)
        if accum_alloc == ZERO and tool.allocated_value > ZERO and tool.acquisition_date <= to_d:
            accum_alloc = _to_dec(tool.allocated_value)

        orig_val = _to_dec(tool.original_cost)
        curr_alloc = alloc_by_asset.get(str(tool.id), _to_dec(tool.monthly_depreciation_amount))
        rem_val = max(ZERO, orig_val - accum_alloc)

        if exclude_zero and rem_val <= ZERO:
            continue

        periods = tool.useful_life_periods or 1
        rem_periods = max(0, periods - tool.periods_processed)

        prepaid_acc = tool.category.asset_account.code if tool.category and tool.category.asset_account else "242"
        exp_acc = tool.category.expense_account.code if tool.category and tool.category.expense_account else "642"

        row = {
            "tool_name": tool.name,
            "tool_code": tool.code,
            "uom_name": "Cái",
            "remaining_quantity": _fmt_dec(tool.quantity),
            "allocation_periods": periods,
            "remaining_periods": rem_periods,
            "original_value": _fmt_dec(orig_val),
            "allocation_target": tool.department.name if tool.department else "Toàn công ty",
            "expense_account_code": exp_acc,
            "current_allocation_amount": _fmt_dec(curr_alloc),
            "accumulated_allocation": _fmt_dec(accum_alloc),
            "remaining_value": _fmt_dec(rem_val),
            "prepaid_account_code": prepaid_acc,
            "_raw": {
                "asset_id": str(tool.id),
                "asset_type": "TOOL",
                "department_id": str(tool.department_id) if tool.department_id else "",
            }
        }
        rows.append(row)
        tot_orig += orig_val
        tot_curr += curr_alloc
        tot_accum += accum_alloc
        tot_rem += rem_val

    summary = {
        "total_original_value": _fmt_dec(tot_orig),
        "total_current_allocation": _fmt_dec(tot_curr),
        "total_accumulated_allocation": _fmt_dec(tot_accum),
        "total_remaining_value": _fmt_dec(tot_rem),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0159(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0159: Sổ theo dõi công cụ dụng cụ (18 cột)."""
    from_d, to_d, as_of, year = _parse_report_dates(params)
    category_id = params.get("category_id") or params.get("tool_category_id")

    qs = AssetRecord.objects.filter(
        company_id=company_id,
        asset_type=AssetType.TOOL,
        acquisition_date__lte=to_d,
    ).select_related("category")

    if category_id:
        qs = qs.filter(category_id=category_id)

    rows = []
    tot_inc_qty = ZERO
    tot_red_qty = ZERO
    tot_rem_qty = ZERO
    tot_orig = ZERO
    tot_period_alloc = ZERO
    tot_accum = ZERO
    tot_rem_val = ZERO

    for tool in qs:
        # Số lượng và giá trị giảm lịch sử <= to_d
        red_tx = AssetTransaction.objects.filter(
            company_id=company_id,
            asset_id=tool.id,
            transaction_type=TransactionType.DISPOSAL,
            status=TransactionStatus.POSTED,
            transaction_date__lte=to_d,
        ).aggregate(sum_qty=Sum("quantity"), sum_amt=Sum("amount"))

        red_qty = _to_qty(red_tx["sum_qty"] or ZERO)
        inc_qty = _to_qty(tool.quantity + red_qty)
        rem_qty = max(ZERO, inc_qty - red_qty)

        # Khấu hao / phân bổ
        period_alloc = CalculationLine.objects.filter(
            run__company_id=company_id,
            run__calculation_type="ALLOCATION",
            run__status="POSTED",
            run__period_start__lte=to_d,
            run__period_end__gte=from_d,
            asset_id=tool.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        accum_alloc = CalculationLine.objects.filter(
            run__company_id=company_id,
            run__calculation_type="ALLOCATION",
            run__status="POSTED",
            run__period_end__lte=to_d,
            asset_id=tool.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        accum_alloc_dec = _to_dec(accum_alloc)
        if accum_alloc_dec == ZERO and tool.allocated_value > ZERO and tool.acquisition_date <= to_d:
            accum_alloc_dec = _to_dec(tool.allocated_value)

        orig_val = _to_dec(tool.original_cost)
        rem_val = max(ZERO, orig_val - accum_alloc_dec)

        periods = tool.useful_life_periods or 1
        rem_periods = max(0, periods - tool.periods_processed)
        periodic_alloc = _to_dec(tool.monthly_depreciation_amount) if tool.monthly_depreciation_amount > ZERO else (orig_val / periods if periods else ZERO)

        prepaid_acc = tool.category.asset_account.code if tool.category and tool.category.asset_account else "242"

        row = {
            "tool_code": tool.code,
            "tool_name": tool.name,
            "tool_category_name": tool.category.name if tool.category else "Chung",
            "increase_reason": tool.description or "Mua sắm mới",
            "increase_date": _to_json_safe(tool.acquisition_date),
            "increase_document_no": tool.acquisition_voucher_no or f"CT-{tool.code}",
            "allocation_periods": periods,
            "remaining_allocation_periods": rem_periods,
            "uom_name": "Cái",
            "increase_quantity": _fmt_dec(inc_qty),
            "cumulative_reduced_quantity": _fmt_dec(red_qty),
            "remaining_quantity": _fmt_dec(rem_qty),
            "original_value": _fmt_dec(orig_val),
            "periodic_allocation_amount": _fmt_dec(periodic_alloc),
            "allocation_amount_period": _fmt_dec(period_alloc),
            "accumulated_allocation": _fmt_dec(accum_alloc_dec),
            "remaining_value": _fmt_dec(rem_val),
            "prepaid_account_code": prepaid_acc,
            "_raw": {
                "asset_id": str(tool.id),
                "asset_type": "TOOL",
            }
        }
        rows.append(row)
        tot_inc_qty += inc_qty
        tot_red_qty += red_qty
        tot_rem_qty += rem_qty
        tot_orig += orig_val
        tot_period_alloc += _to_dec(period_alloc)
        tot_accum += accum_alloc_dec
        tot_rem_val += rem_val

    summary = {
        "total_increase_quantity": _fmt_dec(tot_inc_qty),
        "total_reduced_quantity": _fmt_dec(tot_red_qty),
        "total_remaining_quantity": _fmt_dec(tot_rem_qty),
        "total_original_value": _fmt_dec(tot_orig),
        "total_allocation_amount_period": _fmt_dec(tot_period_alloc),
        "total_accumulated_allocation": _fmt_dec(tot_accum),
        "total_remaining_value": _fmt_dec(tot_rem_val),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0160(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0160: Bảng tính phân bổ công cụ dụng cụ theo năm (29 cột: 12 tháng matrix)."""
    _, _, as_of, year = _parse_report_dates(params)
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    tools = AssetRecord.objects.filter(
        company_id=company_id,
        asset_type=AssetType.TOOL,
        acquisition_date__lte=year_end,
    ).select_related("category")

    rows = []
    tot_year_alloc = ZERO

    # Tải calculation lines cả năm
    run_lines = CalculationLine.objects.filter(
        run__company_id=company_id,
        run__calculation_type="ALLOCATION",
        run__status="POSTED",
        run__period_start__lte=year_end,
        run__period_end__gte=year_start,
    ).select_related("run")

    alloc_map: dict[str, dict[int, Decimal]] = {}
    for line in run_lines:
        m = line.run.period_month or line.run.period_start.month
        aid = str(line.asset_id)
        if aid not in alloc_map:
            alloc_map[aid] = {}
        alloc_map[aid][m] = alloc_map[aid].get(m, ZERO) + _to_dec(line.amount)

    for tool in tools:
        orig_val = _to_dec(tool.original_cost)
        monthly_alloc = _to_dec(tool.monthly_depreciation_amount)
        if monthly_alloc == ZERO and tool.useful_life_periods:
            monthly_alloc = _to_dec(orig_val / tool.useful_life_periods)

        # Số kỳ và giá trị phân bổ trước năm báo cáo
        before_year_calc = CalculationLine.objects.filter(
            run__company_id=company_id,
            run__calculation_type="ALLOCATION",
            run__status="POSTED",
            run__period_end__lt=year_start,
            asset_id=tool.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        alloc_before = _to_dec(before_year_calc)
        periods_before = int(alloc_before / monthly_alloc) if monthly_alloc > ZERO else 0

        # Phân bổ từng tháng 1..12
        months_dict: dict[str, float] = {}
        year_total = ZERO
        for m in range(1, 13):
            # Nếu có calculation line thực tế
            actual_m = alloc_map.get(str(tool.id), {}).get(m)
            if actual_m is not None:
                val_m = actual_m
            else:
                # Ước tính nếu tool đang active trong tháng m
                m_date = date(year, m, 1)
                if tool.acquisition_date <= m_date and (not tool.disposed_at or tool.disposed_at >= m_date):
                    # Còn giá trị chưa phân bổ hết
                    if (alloc_before + year_total + monthly_alloc) <= orig_val:
                        val_m = monthly_alloc
                    else:
                        val_m = max(ZERO, orig_val - (alloc_before + year_total))
                else:
                    val_m = ZERO

            year_total += val_m
            months_dict[f"month_{m:02d}"] = _fmt_dec(val_m)

        tot_alloc_val = alloc_before + year_total
        tot_alloc_periods = periods_before + (int(year_total / monthly_alloc) if monthly_alloc > ZERO else 0)
        rem_periods = max(0, (tool.useful_life_periods or 0) - tot_alloc_periods)
        rem_val = max(ZERO, orig_val - tot_alloc_val)

        prepaid_acc = tool.category.asset_account.code if tool.category and tool.category.asset_account else "242"
        exp_acc = tool.category.expense_account.code if tool.category and tool.category.expense_account else "642"

        row = {
            "tool_code": tool.code,
            "tool_name": tool.name,
            "uom_name": "Cái",
            "increase_date": _to_json_safe(tool.acquisition_date),
            "increase_quantity": _fmt_dec(tool.quantity),
            "original_value": _fmt_dec(orig_val),
            "allocation_periods": tool.useful_life_periods or 1,
            "monthly_allocation_amount": _fmt_dec(monthly_alloc),
            "periods_allocated_before_year": periods_before,
            "allocated_value_before_year": _fmt_dec(alloc_before),
            **months_dict,
            "allocation_total_year": _fmt_dec(year_total),
            "total_allocated_periods": tot_alloc_periods,
            "total_allocated_value": _fmt_dec(tot_alloc_val),
            "remaining_periods": rem_periods,
            "remaining_value": _fmt_dec(rem_val),
            "prepaid_account_code": prepaid_acc,
            "expense_account_code": exp_acc,
            "_raw": {"asset_id": str(tool.id)},
        }
        rows.append(row)
        tot_year_alloc += year_total

    summary = {
        "fiscal_year": year,
        "total_year_allocation": _fmt_dec(tot_year_alloc),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0161(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0161: Báo cáo chi tiết giảm công cụ dụng cụ (11 cột)."""
    from_d, to_d, _, _ = _parse_report_dates(params)

    txs = AssetTransaction.objects.filter(
        company_id=company_id,
        asset__asset_type=AssetType.TOOL,
        transaction_type=TransactionType.DISPOSAL,
        status=TransactionStatus.POSTED,
        transaction_date__gte=from_d,
        transaction_date__lte=to_d,
    ).select_related("asset", "asset__category")

    rows = []
    tot_qty = ZERO
    tot_orig = ZERO
    tot_alloc = ZERO
    tot_rem = ZERO

    for tx in txs:
        tool = tx.asset
        red_qty = _to_qty(tx.quantity or tool.quantity)
        red_orig = _to_dec(tx.amount or tool.original_cost)

        # Tính giá trị đã phân bổ của phần giảm
        snap = tx.before_snapshot or {}
        alloc_val = _to_dec(snap.get("allocated_value", tool.allocated_value))
        rem_val = max(ZERO, red_orig - alloc_val)

        row = {
            "tool_code": tool.code,
            "tool_name": tool.name,
            "tool_category_name": tool.category.name if tool.category else "Chung",
            "document_date": _to_json_safe(tx.transaction_date),
            "document_no": tx.number,
            "uom_name": "Cái",
            "reduced_quantity": _fmt_dec(red_qty),
            "reduced_original_value": _fmt_dec(red_orig),
            "allocated_value_of_reduction": _fmt_dec(alloc_val),
            "remaining_value_of_reduction": _fmt_dec(rem_val),
            "reduction_reason": tx.reason or "Thanh lý / Hủy bỏ",
            "_raw": {
                "transaction_id": str(tx.id),
                "asset_id": str(tool.id),
            }
        }
        rows.append(row)
        tot_qty += red_qty
        tot_orig += red_orig
        tot_alloc += alloc_val
        tot_rem += rem_val

    summary = {
        "total_reduced_quantity": _fmt_dec(tot_qty),
        "total_reduced_original_value": _fmt_dec(tot_orig),
        "total_allocated_reduction": _fmt_dec(tot_alloc),
        "total_remaining_reduction": _fmt_dec(tot_rem),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0162(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0162: Sổ theo dõi công cụ dụng cụ theo đơn vị sử dụng (9 cột)."""
    from_d, to_d, as_of, _ = _parse_report_dates(params)
    dept_id = params.get("department_id")

    qs = AssetRecord.objects.filter(
        company_id=company_id,
        asset_type=AssetType.TOOL,
        acquisition_date__lte=to_d,
    ).select_related("department")

    if dept_id:
        qs = qs.filter(department_id=dept_id)

    rows = []
    tot_rem_val = ZERO

    for tool in qs:
        # Tăng trong kỳ
        inc_qty = tool.quantity if (from_d <= tool.acquisition_date <= to_d) else ZERO
        # Giảm trong kỳ
        dec_qty = AssetTransaction.objects.filter(
            company_id=company_id,
            asset_id=tool.id,
            transaction_type=TransactionType.DISPOSAL,
            status=TransactionStatus.POSTED,
            transaction_date__gte=from_d,
            transaction_date__lte=to_d,
        ).aggregate(sum_qty=Sum("quantity"))["sum_qty"] or ZERO

        rem_qty = _to_qty(tool.quantity)
        orig_val = _to_dec(tool.original_cost)
        alloc_val = _to_dec(tool.allocated_value)
        rem_val = max(ZERO, orig_val - alloc_val)

        row = {
            "tool_code": tool.code,
            "tool_name": tool.name,
            "uom_name": "Cái",
            "quantity_increase": _fmt_dec(inc_qty),
            "quantity_decrease": _fmt_dec(dec_qty),
            "remaining_quantity": _fmt_dec(rem_qty),
            "remaining_tools_original_value": _fmt_dec(orig_val),
            "remaining_tools_allocated_value": _fmt_dec(alloc_val),
            "remaining_tools_net_value": _fmt_dec(rem_val),
            "_raw": {
                "asset_id": str(tool.id),
                "department_id": str(tool.department_id) if tool.department_id else "",
                "department_name": tool.department.name if tool.department else "",
            }
        }
        rows.append(row)
        tot_rem_val += rem_val

    summary = {
        "total_remaining_net_value": _fmt_dec(tot_rem_val),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0163(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0163: Tình hình phân bổ chi phí trả trước (12 cột)."""
    from_d, to_d, as_of, _ = _parse_report_dates(params)

    prepaids = PrepaidExpense.objects.filter(
        company_id=company_id,
        record_date__lte=to_d,
    ).select_related("prepaid_account")

    rows = []
    tot_orig = ZERO
    tot_curr = ZERO
    tot_accum = ZERO
    tot_rem = ZERO

    for pp in prepaids:
        orig = _to_dec(pp.amount)
        periods = pp.allocation_periods or 1
        periodic = orig / periods if periods else ZERO

        # Phân bổ trong kỳ
        curr_alloc = PrepaidAllocationLine.objects.filter(
            allocation__company_id=company_id,
            allocation__posting_date__gte=from_d,
            allocation__posting_date__lte=to_d,
            prepaid_id=pp.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        # Lũy kế đến to_d
        accum_alloc = PrepaidAllocationLine.objects.filter(
            allocation__company_id=company_id,
            allocation__posting_date__lte=to_d,
            prepaid_id=pp.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        accum_dec = _to_dec(accum_alloc)
        if accum_dec == ZERO and pp.allocated_amount > ZERO and pp.record_date <= to_d:
            accum_dec = _to_dec(pp.allocated_amount)

        reduction = ZERO
        rem_amount = max(ZERO, orig - accum_dec - reduction)
        rem_periods = max(0, periods - pp.allocated_periods)

        acc_code = pp.prepaid_account.code if pp.prepaid_account else "242"

        row = {
            "prepaid_code": pp.code,
            "prepaid_name": pp.name,
            "recognition_date": _to_json_safe(pp.record_date),
            "allocation_periods": periods,
            "remaining_periods": rem_periods,
            "original_amount": _fmt_dec(orig),
            "periodic_allocation_amount": _fmt_dec(periodic),
            "current_allocation": _fmt_dec(curr_alloc),
            "accumulated_allocation": _fmt_dec(accum_dec),
            "reduction_amount": _fmt_dec(reduction),
            "remaining_amount": _fmt_dec(rem_amount),
            "prepaid_account_code": acc_code,
            "_raw": {"prepaid_id": str(pp.id)},
        }
        rows.append(row)
        tot_orig += orig
        tot_curr += _to_dec(curr_alloc)
        tot_accum += accum_dec
        tot_rem += rem_amount

    summary = {
        "total_original_amount": _fmt_dec(tot_orig),
        "total_current_allocation": _fmt_dec(tot_curr),
        "total_accumulated_allocation": _fmt_dec(tot_accum),
        "total_remaining_amount": _fmt_dec(tot_rem),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0164(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0164: Bảng tính phân bổ chi phí trả trước (13 cột: chi tiết theo target chi phí)."""
    from_d, to_d, _, _ = _parse_report_dates(params)

    prepaids = PrepaidExpense.objects.filter(
        company_id=company_id,
        record_date__lte=to_d,
    ).prefetch_related("targets", "targets__expense_account")

    rows = []
    tot_orig = ZERO
    tot_alloc_period = ZERO
    tot_accum = ZERO
    tot_rem = ZERO

    for pp in prepaids:
        orig = _to_dec(pp.amount)
        periods = pp.allocation_periods or 1
        rem_periods = max(0, periods - pp.allocated_periods)
        accum_alloc = _to_dec(pp.allocated_amount)

        # Nếu có targets chi tiết
        targets = list(pp.targets.all())
        if targets:
            for t in targets:
                rate = _to_dec(t.rate)
                line_orig = _to_dec(orig * (rate / Decimal("100"))) if rate > ZERO else orig
                line_alloc = _to_dec(line_orig / periods) if periods else ZERO
                line_accum = _to_dec(accum_alloc * (rate / Decimal("100"))) if rate > ZERO else accum_alloc
                line_rem = max(ZERO, line_orig - line_accum)

                row = {
                    "prepaid_code": pp.code,
                    "prepaid_name": pp.name,
                    "recognition_date": _to_json_safe(pp.record_date),
                    "allocation_periods": periods,
                    "remaining_periods": rem_periods,
                    "original_amount": _fmt_dec(line_orig),
                    "allocation_target": t.description or "Bộ phận thụ hưởng",
                    "expense_account_code": t.expense_account.code if t.expense_account else "642",
                    "allocated_amount_period": _fmt_dec(line_alloc),
                    "accumulated_allocation": _fmt_dec(line_accum),
                    "reduction_amount": 0.0,
                    "remaining_amount": _fmt_dec(line_rem),
                    "prepaid_account_code": pp.prepaid_account.code if pp.prepaid_account else "242",
                    "_raw": {"prepaid_id": str(pp.id)},
                }
                rows.append(row)
                tot_orig += line_orig
                tot_alloc_period += line_alloc
                tot_accum += line_accum
                tot_rem += line_rem
        else:
            line_alloc = _to_dec(orig / periods) if periods else ZERO
            line_rem = max(ZERO, orig - accum_alloc)
            row = {
                "prepaid_code": pp.code,
                "prepaid_name": pp.name,
                "recognition_date": _to_json_safe(pp.record_date),
                "allocation_periods": periods,
                "remaining_periods": rem_periods,
                "original_amount": _fmt_dec(orig),
                "allocation_target": "Toàn công ty",
                "expense_account_code": "642",
                "allocated_amount_period": _fmt_dec(line_alloc),
                "accumulated_allocation": _fmt_dec(accum_alloc),
                "reduction_amount": 0.0,
                "remaining_amount": _fmt_dec(line_rem),
                "prepaid_account_code": pp.prepaid_account.code if pp.prepaid_account else "242",
                "_raw": {"prepaid_id": str(pp.id)},
            }
            rows.append(row)
            tot_orig += orig
            tot_alloc_period += line_alloc
            tot_accum += accum_alloc
            tot_rem += line_rem

    summary = {
        "total_original_amount": _fmt_dec(tot_orig),
        "total_allocated_period": _fmt_dec(tot_alloc_period),
        "total_accumulated_allocation": _fmt_dec(tot_accum),
        "total_remaining_amount": _fmt_dec(tot_rem),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0165(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0165: Tình hình phân bổ chi phí trả trước theo năm (28 cột: 12 tháng matrix)."""
    _, _, _, year = _parse_report_dates(params)
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    prepaids = PrepaidExpense.objects.filter(
        company_id=company_id,
        record_date__lte=year_end,
    ).prefetch_related("targets", "targets__expense_account")

    rows = []
    tot_year = ZERO

    for pp in prepaids:
        orig = _to_dec(pp.amount)
        periods = pp.allocation_periods or 1
        monthly = _to_dec(orig / periods) if periods else ZERO

        # Phân bổ lũy kế trước năm
        alloc_before = ZERO
        periods_before = 0
        if pp.record_date < year_start:
            # số tháng từ record_date đến year_start
            m_diff = (year_start.year - pp.record_date.year) * 12 + (year_start.month - pp.record_date.month)
            periods_before = min(periods, max(0, m_diff))
            alloc_before = min(orig, monthly * periods_before)

        months_dict: dict[str, float] = {}
        year_total = ZERO
        for m in range(1, 13):
            m_date = date(year, m, 1)
            if pp.record_date <= m_date and (alloc_before + year_total) < orig:
                val_m = min(monthly, orig - (alloc_before + year_total))
            else:
                val_m = ZERO
            year_total += val_m
            months_dict[f"month_{m:02d}"] = _fmt_dec(val_m)

        tot_accum = alloc_before + year_total
        tot_periods = periods_before + (int(year_total / monthly) if monthly > ZERO else 0)
        rem_periods = max(0, periods - tot_periods)
        rem_amount = max(ZERO, orig - tot_accum)

        exp_acc = "642"
        first_target = pp.targets.first()
        if first_target and first_target.expense_account:
            exp_acc = first_target.expense_account.code

        row = {
            "prepaid_code": pp.code,
            "prepaid_name": pp.name,
            "recognition_date": _to_json_safe(pp.record_date),
            "allocation_periods": periods,
            "periods_allocated_before_year": periods_before,
            "original_amount": _fmt_dec(orig),
            "periodic_allocation_amount": _fmt_dec(monthly),
            "allocated_amount_before_year": _fmt_dec(alloc_before),
            **months_dict,
            "allocation_total_year": _fmt_dec(year_total),
            "total_allocated_periods": tot_periods,
            "total_accumulated_allocation": _fmt_dec(tot_accum),
            "remaining_periods": rem_periods,
            "reduction_amount": 0.0,
            "remaining_amount": _fmt_dec(rem_amount),
            "prepaid_account_code": pp.prepaid_account.code if pp.prepaid_account else "242",
            "expense_account_code": exp_acc,
            "_raw": {"prepaid_id": str(pp.id)},
        }
        rows.append(row)
        tot_year += year_total

    summary = {
        "fiscal_year": year,
        "total_year_allocation": _fmt_dec(tot_year),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0166(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0166: Báo cáo đối chiếu sổ theo dõi CCDC, chi phí trả trước và sổ cái (11 cột)."""
    from_d, to_d, _, _ = _parse_report_dates(params)
    only_diff = params.get("only_differences", False)

    # 1. Phát sinh phân bổ CCDC và CPTT trong kỳ
    subledger_items: list[dict[str, Any]] = []

    # CCDC calculation runs
    ccdc_lines = CalculationLine.objects.filter(
        run__company_id=company_id,
        run__calculation_type="ALLOCATION",
        run__status="POSTED",
        run__period_start__lte=to_d,
        run__period_end__gte=from_d,
    ).select_related("run", "asset")

    for cl in ccdc_lines:
        subledger_items.append({
            "book_date": cl.run.posting_date or cl.run.period_end,
            "doc_date": cl.run.voucher_date or cl.run.period_end,
            "doc_no": cl.run.number,
            "doc_type": "PHAN_BO_CCDC",
            "amount": _to_dec(cl.amount),
            "ref_id": str(cl.run.id),
        })

    # CPTT allocations
    cptt_lines = PrepaidAllocationLine.objects.filter(
        allocation__company_id=company_id,
        allocation__posting_date__gte=from_d,
        allocation__posting_date__lte=to_d,
    ).select_related("allocation")

    for pl in cptt_lines:
        subledger_items.append({
            "book_date": pl.allocation.posting_date,
            "doc_date": pl.allocation.document_date or pl.allocation.posting_date,
            "doc_no": pl.allocation.number,
            "doc_type": "PHAN_BO_CPTT",
            "amount": _to_dec(pl.amount),
            "ref_id": str(pl.allocation.id),
        })

    # 2. GL Journal Lines trên tài khoản 242 (Có 242 đối ứng Nợ chi phí)
    gl_lines = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        entry__posting_date__gte=from_d,
        entry__posting_date__lte=to_d,
        account__code__startswith="242",
    ).select_related("entry", "account")

    gl_map: dict[str, list[JournalLine]] = {}
    for g in gl_lines:
        key = g.entry.number or ""
        gl_map.setdefault(key, []).append(g)

    rows = []
    tot_sub = ZERO
    tot_gl = ZERO
    tot_diff = ZERO

    matched_gl_ids = set()

    for item in subledger_items:
        doc_no = item["doc_no"]
        gl_matches = gl_map.get(doc_no, [])
        gl_amt = ZERO
        gl_doc_no = ""
        gl_desc = ""
        gl_post_date = None
        gl_doc_date = None

        if gl_matches:
            for g in gl_matches:
                gl_amt += _to_dec(g.credit or g.debit)
                matched_gl_ids.add(g.id)
            g0 = gl_matches[0]
            gl_doc_no = g0.entry.number
            gl_desc = g0.entry.description
            gl_post_date = g0.entry.posting_date
            gl_doc_date = g0.entry.document_date

        sub_amt = item["amount"]
        diff = sub_amt - gl_amt

        if only_diff and diff == ZERO:
            continue

        row = {
            "source_book_date": _to_json_safe(item["book_date"]),
            "source_document_date": _to_json_safe(item["doc_date"]),
            "source_document_no": doc_no,
            "source_document_type": item["doc_type"],
            "source_book_amount": _fmt_dec(sub_amt),
            "gl_posting_date": _to_json_safe(gl_post_date),
            "gl_document_date": _to_json_safe(gl_doc_date),
            "gl_document_no": gl_doc_no,
            "gl_description": gl_desc,
            "gl_amount": _fmt_dec(gl_amt),
            "difference_amount": _fmt_dec(diff),
            "_raw": {"diff": float(diff)},
        }
        rows.append(row)
        tot_sub += sub_amt
        tot_gl += gl_amt
        tot_diff += diff

    # Các bút toán GL không khớp sổ theo dõi
    for g in gl_lines:
        if g.id not in matched_gl_ids:
            gl_amt = _to_dec(g.credit or g.debit)
            diff = ZERO - gl_amt
            if only_diff and diff == ZERO:
                continue
            row = {
                "source_book_date": None,
                "source_document_date": None,
                "source_document_no": "",
                "source_document_type": "GL_ONLY",
                "source_book_amount": 0.0,
                "gl_posting_date": _to_json_safe(g.entry.posting_date),
                "gl_document_date": _to_json_safe(g.entry.document_date),
                "gl_document_no": g.entry.number,
                "gl_description": g.entry.description,
                "gl_amount": _fmt_dec(gl_amt),
                "difference_amount": _fmt_dec(diff),
                "_raw": {"diff": float(diff)},
            }
            rows.append(row)
            tot_gl += gl_amt
            tot_diff += diff

    summary = {
        "total_source_book_amount": _fmt_dec(tot_sub),
        "total_gl_amount": _fmt_dec(tot_gl),
        "total_difference_amount": _fmt_dec(tot_diff),
        "discrepancy_count": sum(1 for r in rows if r["_raw"]["diff"] != 0),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0167(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0167: S21-DN: Sổ tài sản cố định (14 cột theo Thông tư 200/99)."""
    from_d, to_d, as_of, _ = _parse_report_dates(params)

    assets = AssetRecord.objects.filter(
        company_id=company_id,
        asset_type=AssetType.FIXED_ASSET,
        acquisition_date__lte=to_d,
    ).select_related("category")

    rows = []
    tot_orig = ZERO
    tot_period_depr = ZERO
    tot_accum = ZERO
    tot_nbv = ZERO

    for fa in assets:
        orig = _to_dec(fa.original_cost)

        # Hao mòn trong kỳ
        period_depr = CalculationLine.objects.filter(
            run__company_id=company_id,
            run__calculation_type="DEPRECIATION",
            run__status="POSTED",
            run__period_start__lte=to_d,
            run__period_end__gte=from_d,
            asset_id=fa.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        # Hao mòn lũy kế <= to_d
        accum = CalculationLine.objects.filter(
            run__company_id=company_id,
            run__calculation_type="DEPRECIATION",
            run__status="POSTED",
            run__period_end__lte=to_d,
            asset_id=fa.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        accum_dec = _to_dec(accum)
        if accum_dec == ZERO and fa.accumulated_depreciation > ZERO and fa.acquisition_date <= to_d:
            accum_dec = _to_dec(fa.accumulated_depreciation)

        nbv = max(ZERO, orig - accum_dec)

        # Thông tin ghi giảm nếu có
        dec_tx = AssetTransaction.objects.filter(
            company_id=company_id,
            asset_id=fa.id,
            transaction_type=TransactionType.DISPOSAL,
            status=TransactionStatus.POSTED,
            transaction_date__lte=to_d,
        ).first()

        row = {
            "voucher_increase_no": fa.acquisition_voucher_no or f"TANG-{fa.code}",
            "voucher_increase_date": _to_json_safe(fa.acquisition_date),
            "asset_code": fa.code,
            "asset_name": fa.name,
            "country_of_origin": fa.country_of_origin or "Việt Nam",
            "in_service_year": fa.in_service_date.year if fa.in_service_date else fa.acquisition_date.year,
            "original_cost": _fmt_dec(orig),
            "depreciation_rate": _fmt_dec(fa.annual_depreciation_rate),
            "depreciation_period": _fmt_dec(period_depr),
            "accumulated_depreciation": _fmt_dec(accum_dec),
            "net_book_value": _fmt_dec(nbv),
            "voucher_decrease_no": dec_tx.number if dec_tx else "",
            "voucher_decrease_date": _to_json_safe(dec_tx.transaction_date) if dec_tx else None,
            "decrease_reason": dec_tx.reason if dec_tx else "",
            "_raw": {"asset_id": str(fa.id)},
        }
        rows.append(row)
        tot_orig += orig
        tot_period_depr += _to_dec(period_depr)
        tot_accum += accum_dec
        tot_nbv += nbv

    summary = {
        "official_standard": "S21-DN (Thông tư 200/2014/TT-BTC & TT 99/2025/TT-BTC)",
        "total_original_cost": _fmt_dec(tot_orig),
        "total_depreciation_period": _fmt_dec(tot_period_depr),
        "total_accumulated_depreciation": _fmt_dec(tot_accum),
        "total_net_book_value": _fmt_dec(tot_nbv),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0168(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0168: Sổ tài sản cố định (18 cột)."""
    from_d, to_d, as_of, _ = _parse_report_dates(params)

    assets = AssetRecord.objects.filter(
        company_id=company_id,
        asset_type=AssetType.FIXED_ASSET,
        acquisition_date__lte=to_d,
    ).select_related("category", "department")

    rows = []
    tot_orig = ZERO
    tot_depreciable = ZERO
    tot_period_depr = ZERO
    tot_accum = ZERO
    tot_reduction = ZERO
    tot_nbv = ZERO

    for fa in assets:
        orig = _to_dec(fa.original_cost)
        depreciable = _to_dec(fa.depreciable_amount) or orig

        period_depr = CalculationLine.objects.filter(
            run__company_id=company_id,
            run__calculation_type="DEPRECIATION",
            run__status="POSTED",
            run__period_start__lte=to_d,
            run__period_end__gte=from_d,
            asset_id=fa.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        accum = CalculationLine.objects.filter(
            run__company_id=company_id,
            run__calculation_type="DEPRECIATION",
            run__status="POSTED",
            run__period_end__lte=to_d,
            asset_id=fa.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        accum_dec = _to_dec(accum)
        if accum_dec == ZERO and fa.accumulated_depreciation > ZERO and fa.acquisition_date <= to_d:
            accum_dec = _to_dec(fa.accumulated_depreciation)

        dec_tx = AssetTransaction.objects.filter(
            company_id=company_id,
            asset_id=fa.id,
            transaction_type=TransactionType.DISPOSAL,
            status=TransactionStatus.POSTED,
            transaction_date__lte=to_d,
        ).first()

        reduction_val = _to_dec(dec_tx.amount) if dec_tx else ZERO
        nbv = max(ZERO, orig - accum_dec - reduction_val)

        life_months = int(fa.useful_life_value * 12) if fa.useful_life_unit == "YEAR" else int(fa.useful_life_value)
        rem_life = max(0, life_months - fa.periods_processed)

        asset_acc = fa.asset_account.code if fa.asset_account else "211"
        accum_acc = fa.accumulated_account.code if fa.accumulated_account else "214"

        row = {
            "asset_code": fa.code,
            "asset_name": fa.name,
            "asset_category_name": fa.category.name if fa.category else "Chung",
            "using_department_name": fa.department.name if fa.department else "Toàn công ty",
            "increase_date": _to_json_safe(fa.acquisition_date),
            "increase_document_no": fa.acquisition_voucher_no or f"CT-{fa.code}",
            "depreciation_start_date": _to_json_safe(fa.in_service_date),
            "useful_life_months": life_months,
            "remaining_life_months": rem_life,
            "original_cost": _fmt_dec(orig),
            "depreciable_amount": _fmt_dec(depreciable),
            "depreciation_period": _fmt_dec(period_depr),
            "accumulated_depreciation": _fmt_dec(accum_dec),
            "asset_reduction_value": _fmt_dec(reduction_val),
            "net_book_value": _fmt_dec(nbv),
            "monthly_depreciation_amount": _fmt_dec(fa.monthly_depreciation_amount),
            "asset_account_code": asset_acc,
            "accum_depr_account_code": accum_acc,
            "_raw": {"asset_id": str(fa.id)},
        }
        rows.append(row)
        tot_orig += orig
        tot_depreciable += depreciable
        tot_period_depr += _to_dec(period_depr)
        tot_accum += accum_dec
        tot_reduction += reduction_val
        tot_nbv += nbv

    summary = {
        "total_original_cost": _fmt_dec(tot_orig),
        "total_depreciable_amount": _fmt_dec(tot_depreciable),
        "total_depreciation_period": _fmt_dec(tot_period_depr),
        "total_accumulated_depreciation": _fmt_dec(tot_accum),
        "total_reduction_value": _fmt_dec(tot_reduction),
        "total_net_book_value": _fmt_dec(tot_nbv),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0169(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0169: Thẻ tài sản cố định (10 cột + detailed section payload)."""
    _, _, as_of, _ = _parse_report_dates(params)
    asset_id = params.get("asset_id")

    qs = AssetRecord.objects.filter(
        company_id=company_id,
        asset_type=AssetType.FIXED_ASSET,
        acquisition_date__lte=as_of,
    ).select_related("category", "department", "custodian")

    if asset_id:
        qs = qs.filter(id=asset_id)

    rows = []
    for fa in qs:
        orig = _to_dec(fa.original_cost)
        accum = CalculationLine.objects.filter(
            run__company_id=company_id,
            run__calculation_type="DEPRECIATION",
            run__status="POSTED",
            run__period_end__lte=as_of,
            asset_id=fa.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        accum_dec = _to_dec(accum)
        if accum_dec == ZERO and fa.accumulated_depreciation > ZERO and fa.acquisition_date <= as_of:
            accum_dec = _to_dec(fa.accumulated_depreciation)

        nbv = max(ZERO, orig - accum_dec)
        life_months = int(fa.useful_life_value * 12) if fa.useful_life_unit == "YEAR" else int(fa.useful_life_value)

        # Lịch sử biến động
        tx_list = AssetTransaction.objects.filter(
            company_id=company_id,
            asset_id=fa.id,
            status=TransactionStatus.POSTED,
            transaction_date__lte=as_of,
        ).values("number", "transaction_type", "transaction_date", "amount", "reason")

        card_sections = {
            "asset_info": {
                "code": fa.code,
                "name": fa.name,
                "category": fa.category.name if fa.category else "",
                "serial_number": fa.serial_number,
                "country_of_origin": fa.country_of_origin,
                "manufacture_year": fa.manufacture_year,
            },
            "acquisition": {
                "date": _to_json_safe(fa.acquisition_date),
                "voucher_no": fa.acquisition_voucher_no,
                "original_cost": _fmt_dec(orig),
            },
            "usage": {
                "in_service_date": _to_json_safe(fa.in_service_date),
                "department": fa.department.name if fa.department else "",
                "custodian": fa.custodian.full_name if fa.custodian and hasattr(fa.custodian, "full_name") else "",
            },
            "depreciation": {
                "method": fa.method,
                "useful_life_months": life_months,
                "monthly_depreciation_amount": _fmt_dec(fa.monthly_depreciation_amount),
                "accumulated_depreciation": _fmt_dec(accum_dec),
                "net_book_value": _fmt_dec(nbv),
            },
            "accessories": fa.accessories or [],
            "components": fa.components or [],
            "transactions_history": list(tx_list),
        }

        row = {
            "asset_code": fa.code,
            "asset_name": fa.name,
            "serial_number": fa.serial_number or "---",
            "in_service_date": _to_json_safe(fa.in_service_date),
            "original_cost": _fmt_dec(orig),
            "useful_life_months": life_months,
            "accumulated_depreciation": _fmt_dec(accum_dec),
            "net_book_value": _fmt_dec(nbv),
            "department_name": fa.department.name if fa.department else "Toàn công ty",
            "status": fa.status,
            "_card_payload": card_sections,
            "_raw": {"asset_id": str(fa.id)},
        }
        rows.append(row)

    summary = {
        "cards_count": len(rows),
        "as_of_date": _to_json_safe(as_of),
    }
    return rows, summary, []


def build_rpt_0170(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0170: Bảng tính khấu hao tài sản cố định theo năm (27 cột: 12 tháng matrix)."""
    _, _, _, year = _parse_report_dates(params)
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    assets = AssetRecord.objects.filter(
        company_id=company_id,
        asset_type=AssetType.FIXED_ASSET,
        acquisition_date__lte=year_end,
    )

    rows = []
    tot_year_depr = ZERO

    # Tải calculation lines trong năm
    run_lines = CalculationLine.objects.filter(
        run__company_id=company_id,
        run__calculation_type="DEPRECIATION",
        run__status="POSTED",
        run__period_start__lte=year_end,
        run__period_end__gte=year_start,
    ).select_related("run")

    depr_map: dict[str, dict[int, Decimal]] = {}
    for line in run_lines:
        m = line.run.period_month or line.run.period_start.month
        aid = str(line.asset_id)
        if aid not in depr_map:
            depr_map[aid] = {}
        depr_map[aid][m] = depr_map[aid].get(m, ZERO) + _to_dec(line.amount)

    for fa in assets:
        orig = _to_dec(fa.original_cost)
        depreciable = _to_dec(fa.depreciable_amount) or orig
        monthly_depr = _to_dec(fa.monthly_depreciation_amount)
        life_months = int(fa.useful_life_value * 12) if fa.useful_life_unit == "YEAR" else int(fa.useful_life_value)
        if monthly_depr == ZERO and life_months > 0:
            monthly_depr = _to_dec(depreciable / life_months)

        # Hao mòn đầu năm
        accum_before = CalculationLine.objects.filter(
            run__company_id=company_id,
            run__calculation_type="DEPRECIATION",
            run__status="POSTED",
            run__period_end__lt=year_start,
            asset_id=fa.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        accum_before_dec = _to_dec(accum_before)
        used_months_before = int(accum_before_dec / monthly_depr) if monthly_depr > ZERO else 0

        months_dict: dict[str, float] = {}
        year_total = ZERO
        for m in range(1, 13):
            actual_m = depr_map.get(str(fa.id), {}).get(m)
            if actual_m is not None:
                val_m = actual_m
            else:
                m_date = date(year, m, 1)
                if fa.in_service_date <= m_date and (not fa.disposed_at or fa.disposed_at >= m_date):
                    if (accum_before_dec + year_total + monthly_depr) <= depreciable:
                        val_m = monthly_depr
                    else:
                        val_m = max(ZERO, depreciable - (accum_before_dec + year_total))
                else:
                    val_m = ZERO

            year_total += val_m
            months_dict[f"month_{m:02d}"] = _fmt_dec(val_m)

        accum_end = accum_before_dec + year_total
        used_months_end = used_months_before + (int(year_total / monthly_depr) if monthly_depr > ZERO else 0)
        rem_life = max(0, life_months - used_months_end)
        nbv = max(ZERO, orig - accum_end)

        row = {
            "asset_code": fa.code,
            "asset_name": fa.name,
            "increase_date": _to_json_safe(fa.acquisition_date),
            "depreciation_start_date": _to_json_safe(fa.in_service_date),
            "original_cost": _fmt_dec(orig),
            "depreciable_amount": _fmt_dec(depreciable),
            "useful_life_months": life_months,
            "monthly_depreciation_amount": _fmt_dec(monthly_depr),
            "used_months_before_year": used_months_before,
            "accumulated_depreciation_beginning": _fmt_dec(accum_before_dec),
            **months_dict,
            "depreciation_total_year": _fmt_dec(year_total),
            "used_months_cumulative_end": used_months_end,
            "accumulated_depreciation_end": _fmt_dec(accum_end),
            "remaining_life_months": rem_life,
            "net_book_value": _fmt_dec(nbv),
            "_raw": {"asset_id": str(fa.id)},
        }
        rows.append(row)
        tot_year_depr += year_total

    summary = {
        "fiscal_year": year,
        "total_depreciation_year": _fmt_dec(tot_year_depr),
        "row_count": len(rows),
    }
    return rows, summary, []


def build_rpt_0171(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """RPT-0171: Báo cáo đối chiếu sổ tài sản và sổ cái (11 cột)."""
    from_d, to_d, _, _ = _parse_report_dates(params)
    only_diff = params.get("only_differences", False)

    # 1. Phát sinh sổ TSCĐ: ghi tăng, đánh giá lại, ghi giảm, khấu hao
    asset_items: list[dict[str, Any]] = []

    # Giao dịch TSCĐ
    txs = AssetTransaction.objects.filter(
        company_id=company_id,
        asset__asset_type=AssetType.FIXED_ASSET,
        status=TransactionStatus.POSTED,
        transaction_date__gte=from_d,
        transaction_date__lte=to_d,
    ).select_related("asset")

    for tx in txs:
        asset_items.append({
            "book_date": tx.posted_at.date() if tx.posted_at else tx.transaction_date,
            "doc_date": tx.transaction_date,
            "doc_no": tx.number,
            "doc_type": tx.transaction_type,
            "amount": _to_dec(tx.amount),
            "ref_id": str(tx.id),
        })

    # Khấu hao TSCĐ runs
    runs = CalculationRun.objects.filter(
        company_id=company_id,
        calculation_type="DEPRECIATION",
        status="POSTED",
        posting_date__gte=from_d,
        posting_date__lte=to_d,
    )
    for r in runs:
        asset_items.append({
            "book_date": r.posting_date or r.period_end,
            "doc_date": r.voucher_date or r.period_end,
            "doc_no": r.number,
            "doc_type": "KHAU_HAO_TSCD",
            "amount": _to_dec(r.total_amount),
            "ref_id": str(r.id),
        })

    # 2. Bút toán sổ cái trên các tài khoản 211, 212, 213, 214
    gl_lines = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        entry__posting_date__gte=from_d,
        entry__posting_date__lte=to_d,
        account__code__regex=r"^(211|212|213|214)",
    ).select_related("entry", "account")

    gl_map: dict[str, list[JournalLine]] = {}
    for g in gl_lines:
        key = g.entry.number or ""
        gl_map.setdefault(key, []).append(g)

    rows = []
    tot_asset = ZERO
    tot_gl = ZERO
    tot_diff = ZERO

    matched_gl_ids = set()

    for item in asset_items:
        doc_no = item["doc_no"]
        gl_matches = gl_map.get(doc_no, [])
        gl_amt = ZERO
        gl_doc_no = ""
        gl_desc = ""
        gl_post_date = None
        gl_doc_date = None

        if gl_matches:
            for g in gl_matches:
                gl_amt += _to_dec(g.debit or g.credit)
                matched_gl_ids.add(g.id)
            g0 = gl_matches[0]
            gl_doc_no = g0.entry.number
            gl_desc = g0.entry.description
            gl_post_date = g0.entry.posting_date
            gl_doc_date = g0.entry.document_date

        asset_amt = item["amount"]
        diff = asset_amt - gl_amt

        if only_diff and diff == ZERO:
            continue

        row = {
            "asset_book_date": _to_json_safe(item["book_date"]),
            "asset_document_date": _to_json_safe(item["doc_date"]),
            "asset_document_no": doc_no,
            "asset_document_type": item["doc_type"],
            "asset_book_amount": _fmt_dec(asset_amt),
            "gl_posting_date": _to_json_safe(gl_post_date),
            "gl_document_date": _to_json_safe(gl_doc_date),
            "gl_document_no": gl_doc_no,
            "gl_description": gl_desc,
            "gl_amount": _fmt_dec(gl_amt),
            "difference_amount": _fmt_dec(diff),
            "_raw": {"diff": float(diff)},
        }
        rows.append(row)
        tot_asset += asset_amt
        tot_gl += gl_amt
        tot_diff += diff

    # Các bút toán GL không có trên sổ tài sản
    for g in gl_lines:
        if g.id not in matched_gl_ids:
            gl_amt = _to_dec(g.debit or g.credit)
            diff = ZERO - gl_amt
            if only_diff and diff == ZERO:
                continue
            row = {
                "asset_book_date": None,
                "asset_document_date": None,
                "asset_document_no": "",
                "asset_document_type": "GL_ONLY",
                "asset_book_amount": 0.0,
                "gl_posting_date": _to_json_safe(g.entry.posting_date),
                "gl_document_date": _to_json_safe(g.entry.document_date),
                "gl_document_no": g.entry.number,
                "gl_description": g.entry.description,
                "gl_amount": _fmt_dec(gl_amt),
                "difference_amount": _fmt_dec(diff),
                "_raw": {"diff": float(diff)},
            }
            rows.append(row)
            tot_gl += gl_amt
            tot_diff += diff

    summary = {
        "total_asset_book_amount": _fmt_dec(tot_asset),
        "total_gl_amount": _fmt_dec(tot_gl),
        "total_difference_amount": _fmt_dec(tot_diff),
        "discrepancy_count": sum(1 for r in rows if r["_raw"]["diff"] != 0),
        "row_count": len(rows),
    }
    return rows, summary, []


# Builder Dispatcher
REPORT_BUILDERS = {
    "RPT-0158": build_rpt_0158,
    "RPT-0159": build_rpt_0159,
    "RPT-0160": build_rpt_0160,
    "RPT-0161": build_rpt_0161,
    "RPT-0162": build_rpt_0162,
    "RPT-0163": build_rpt_0163,
    "RPT-0164": build_rpt_0164,
    "RPT-0165": build_rpt_0165,
    "RPT-0166": build_rpt_0166,
    "RPT-0167": build_rpt_0167,
    "RPT-0168": build_rpt_0168,
    "RPT-0169": build_rpt_0169,
    "RPT-0170": build_rpt_0170,
    "RPT-0171": build_rpt_0171,
}


# -----------------------------------------------------------------------------
# Report Generation & Validation
# -----------------------------------------------------------------------------

def run_asset_report(
    report_code: str,
    company_id: str,
    params: dict[str, Any],
    user: Any = None,
) -> AssetReportRun:
    """
    Thực thi và lưu snapshot báo cáo tài sản / CCDC / CPTT.
    Tuân thủ quy tắc read-only tuyệt đối (BR-RPT-FA-09, BR-RPT-FA-111..114).
    """
    schema = get_asset_report_schema(report_code, user=user)
    builder = REPORT_BUILDERS.get(report_code)
    if not builder:
        raise ValidationError(f"Chưa hỗ trợ xử lý báo cáo: {report_code}")

    from_d, to_d, as_of, year = _parse_report_dates(params)

    # Chạy tính toán số liệu (Read-only)
    rows_data, summary, dynamic_cols = builder(company_id, params)

    run_number = f"ARR-{report_code}-{timezone.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

    snapshot_meta = {
        "generated_at": timezone.now().isoformat(),
        "company_id": str(company_id),
        "parameters": _to_json_safe(params),
        "schema_version": schema.get("schema_version", "1.0"),
        "latest_asset_update": _to_json_safe(
            AssetRecord.objects.filter(company_id=company_id).order_by("-updated_at").values_list("updated_at", flat=True).first()
        ),
        "latest_run_update": _to_json_safe(
            CalculationRun.objects.filter(company_id=company_id).order_by("-updated_at").values_list("updated_at", flat=True).first()
        ),
    }

    with transaction.atomic():
        report_run = AssetReportRun.objects.create(
            run_number=run_number,
            report_code=report_code,
            report_name=schema["report_name"],
            asset_report_type=schema["asset_report_type"],
            report_category_type=schema["report_category_type"],
            company_id=company_id,
            branch_id=params.get("branch_id", ""),
            department_id=params.get("department_id", ""),
            asset_category_id=params.get("category_id", ""),
            fiscal_year=year,
            period_type=params.get("period_type", "CUSTOM"),
            from_date=from_d,
            to_date=to_d,
            as_of_date=as_of,
            parameters=_to_json_safe(params),
            summary_payload=_to_json_safe(summary),
            dynamic_columns=_to_json_safe(dynamic_cols),
            source_snapshot_meta=_to_json_safe(snapshot_meta),
            row_count=len(rows_data),
            generated_by=getattr(user, "username", "system") if user else "system",
        )

        row_objects = []
        for idx, r in enumerate(rows_data, start=1):
            raw = r.get("_raw", {})
            card_payload = r.get("_card_payload", {})
            row_type = "CARD_SECTION" if card_payload else "DETAIL"

            row_objects.append(
                AssetReportRow(
                    run=report_run,
                    row_order=idx,
                    row_type=row_type,
                    asset_id=raw.get("asset_id", r.get("tool_code", r.get("asset_code", ""))),
                    asset_code=r.get("tool_code", r.get("asset_code", r.get("prepaid_code", ""))),
                    asset_name=r.get("tool_name", r.get("asset_name", r.get("prepaid_name", ""))),
                    asset_type=schema["asset_report_type"],
                    department_id=raw.get("department_id", ""),
                    department_name=raw.get("department_name", r.get("using_department_name", r.get("department_name", ""))),
                    document_no=r.get("document_no", r.get("source_document_no", r.get("asset_document_no", ""))),
                    columns_payload=_to_json_safe(r),
                    detail_payload=_to_json_safe(card_payload) if card_payload else _to_json_safe(raw),
                    source_refs=_to_json_safe(raw.get("source_refs", [])),
                )
            )
        AssetReportRow.objects.bulk_create(row_objects)

        # Chạy kiểm tra tính toàn vẹn (Validation)
        validations = validate_asset_report(report_run, rows_data)
        warn_cnt = sum(1 for v in validations if v.severity == "WARNING" and v.status != "PASSED")
        err_cnt = sum(1 for v in validations if v.severity == "ERROR" and v.status != "PASSED")
        report_run.warning_count = warn_cnt
        report_run.error_count = err_cnt
        report_run.save(update_fields=["warning_count", "error_count"])

    return report_run


def validate_asset_report(run: AssetReportRun, rows_data: list[dict[str, Any]]) -> list[AssetReportValidationResult]:
    """Kiểm tra các quy tắc tính toán, phân bổ, khấu hao và đối chiếu."""
    results = []

    # 1. Over-depreciation / Over-allocation: Hao mòn > Nguyên giá
    over_depr_rows = []
    for r in rows_data:
        orig = _to_dec(r.get("original_cost") or r.get("original_value") or r.get("original_amount"))
        accum = _to_dec(r.get("accumulated_depreciation") or r.get("accumulated_allocation") or r.get("total_accumulated_allocation"))
        if accum > orig and orig > ZERO:
            over_depr_rows.append(r.get("asset_code", r.get("tool_code", r.get("prepaid_code", ""))))

    if over_depr_rows:
        v = AssetReportValidationResult.objects.create(
            run=run,
            check_code="VAL-ASSET-01",
            check_name="Cảnh báo phân bổ / khấu hao vượt nguyên giá",
            severity="WARNING",
            status="WARNING",
            message=f"Có {len(over_depr_rows)} tài sản/CCDC có lũy kế khấu hao vượt nguyên giá: {', '.join(over_depr_rows[:5])}",
            affected_rows=over_depr_rows,
        )
        results.append(v)

    # 2. Reconciliation Discrepancy: Chênh lệch với sổ cái khác 0
    diff_rows = []
    for r in rows_data:
        diff = _to_dec(r.get("difference_amount"))
        if diff != ZERO:
            diff_rows.append(r.get("source_document_no", r.get("asset_document_no", r.get("gl_document_no", "CHÊNH_LỆCH"))))

    if diff_rows:
        v = AssetReportValidationResult.objects.create(
            run=run,
            check_code="VAL-ASSET-02",
            check_name="Cảnh báo chênh lệch giữa sổ tài sản/CCDC và sổ cái",
            severity="WARNING",
            status="WARNING",
            message=f"Phát hiện {len(diff_rows)} phát sinh có chênh lệch giữa sổ tài sản và sổ cái.",
            affected_rows=diff_rows,
        )
        results.append(v)

    # 3. Unposted calculation runs trong kỳ
    unposted_runs = CalculationRun.objects.filter(
        company_id=run.company_id,
        status="DRAFT",
        period_start__lte=run.to_date or timezone.localdate(),
        period_end__gte=run.from_date or timezone.localdate(),
    ).count()

    if unposted_runs > 0:
        v = AssetReportValidationResult.objects.create(
            run=run,
            check_code="VAL-ASSET-03",
            check_name="Kỳ khấu hao / phân bổ chưa ghi sổ",
            severity="WARNING",
            status="WARNING",
            message=f"Có {unposted_runs} chứng từ tính khấu hao/phân bổ ở trạng thái Nháp (chưa ghi sổ) trong kỳ báo cáo.",
        )
        results.append(v)

    if not results:
        v = AssetReportValidationResult.objects.create(
            run=run,
            check_code="VAL-ASSET-OK",
            check_name="Kiểm tra tính toàn vẹn báo cáo tài sản",
            severity="INFO",
            status="PASSED",
            message="Số liệu báo cáo hợp lệ và khớp đúng giữa các chỉ tiêu.",
        )
        results.append(v)

    return results


def check_asset_report_stale(run: AssetReportRun) -> bool:
    """Kiểm tra snapshot có bị cũ do dữ liệu nguồn thay đổi hay không."""
    meta = run.source_snapshot_meta or {}
    latest_asset = AssetRecord.objects.filter(company_id=run.company_id).order_by("-updated_at").values_list("updated_at", flat=True).first()
    latest_calc = CalculationRun.objects.filter(company_id=run.company_id).order_by("-updated_at").values_list("updated_at", flat=True).first()

    old_asset = meta.get("latest_asset_update")
    old_calc = meta.get("latest_run_update")

    is_stale = False
    if latest_asset and old_asset and latest_asset.isoformat() != old_asset:
        is_stale = True
    if latest_calc and old_calc and latest_calc.isoformat() != old_calc:
        is_stale = True

    if is_stale and not run.is_stale:
        run.is_stale = True
        run.save(update_fields=["is_stale"])
    return is_stale


# -----------------------------------------------------------------------------
# Export Handler (CSV / JSON / UC-RPT-15 integration)
# -----------------------------------------------------------------------------

def export_asset_report(run_id: str, fmt: str = "JSON", user: Any = None) -> dict[str, Any]:
    """Xuất báo cáo sang định dạng JSON hoặc CSV."""
    run = AssetReportRun.objects.prefetch_related("rows").get(id=run_id)
    if user:
        require_asset_permission(user, PERM_ASSET_EXPORT)

    schema = get_asset_report_schema(run.report_code)
    columns = schema["columns"]

    header_names = [c["name"] for c in columns]
    header_codes = [c["code"] for c in columns]

    rows_data = []
    for r in run.rows.all():
        cols = r.columns_payload or {}
        row_vals = [cols.get(code, "") for code in header_codes]
        rows_data.append(row_vals)

    return {
        "run_id": str(run.id),
        "run_number": run.run_number,
        "report_code": run.report_code,
        "report_name": run.report_name,
        "export_format": fmt.upper(),
        "headers": header_names,
        "header_codes": header_codes,
        "rows": rows_data,
        "summary": run.summary_payload,
        "row_count": len(rows_data),
        "exported_at": timezone.now().isoformat(),
    }


# -----------------------------------------------------------------------------
# ViewSet API Payload Adapters
# -----------------------------------------------------------------------------

def resolve_asset_company_scope(request, params: dict[str, Any]) -> tuple[str, Company]:
    comp_id = params.get("company_id") or (request.query_params.get("company_id") if hasattr(request, "query_params") else None)
    if not comp_id and hasattr(request, "headers"):
        comp_id = request.headers.get("X-Company-ID")
    if not comp_id and hasattr(request, "user") and hasattr(request.user, "company_id"):
        comp_id = request.user.company_id
    if not comp_id:
        c = Company.objects.first()
        comp_id = str(c.id) if c else "DEFAULT-COMPANY"
    else:
        comp_id = str(comp_id)

    company = Company.objects.filter(id=comp_id).first()
    if not company:
        company = Company.objects.first()
        if company:
            comp_id = str(company.id)
    return comp_id, company


def get_asset_report_catalogue_payload(company_id: str = None, user=None, request=None) -> dict[str, Any]:
    cat = get_asset_reports_catalogue(user=user)
    return {
        "company_id": str(company_id or ""),
        "count": len(cat),
        "reports": cat,
    }


def get_asset_report_schema_payload(report_code: str, user=None, request=None) -> dict[str, Any]:
    schema = get_asset_report_schema(report_code, user=user)
    return {
        "report_code": schema["report_code"],
        "report_name": schema["report_name"],
        "asset_report_type": schema["asset_report_type"],
        "report_category_type": schema["report_category_type"],
        "schema_version": schema.get("schema_version", "1.0"),
        "fixed_columns_count": schema.get("fixed_columns_count", len(schema["columns"])),
        "columns": schema["columns"],
        "official_standard": schema.get("official_standard", ""),
    }


def get_asset_report_parameters_payload(report_code: str, user=None, request=None) -> dict[str, Any]:
    schema = get_asset_report_schema(report_code, user=user)
    return {
        "report_code": schema["report_code"],
        "parameters": [
            {"name": "period_type", "type": "STRING", "required": False, "default": "CUSTOM"},
            {"name": "from_date", "type": "DATE", "required": False},
            {"name": "to_date", "type": "DATE", "required": False},
            {"name": "as_of_date", "type": "DATE", "required": False},
            {"name": "fiscal_year", "type": "INTEGER", "required": False},
            {"name": "department_id", "type": "STRING", "required": False},
            {"name": "category_id", "type": "STRING", "required": False},
            {"name": "asset_id", "type": "STRING", "required": False},
            {"name": "exclude_zero_remaining", "type": "BOOLEAN", "required": False, "default": False},
            {"name": "only_differences", "type": "BOOLEAN", "required": False, "default": False},
        ]
    }


def query_asset_report_payload(report_code: str, params: dict[str, Any], user=None, request=None) -> dict[str, Any]:
    company_id, _ = resolve_asset_company_scope(request, params)
    run = run_asset_report(report_code, company_id=company_id, params=params, user=user)
    return {
        "run_id": str(run.id),
        "run_number": run.run_number,
        "report_code": run.report_code,
        "report_name": run.report_name,
        "summary": run.summary_payload,
        "row_count": run.row_count,
        "warning_count": run.warning_count,
        "error_count": run.error_count,
        "is_stale": run.is_stale,
        "generated_at": run.generated_at.isoformat(),
    }


def get_asset_report_run_details(run_id: str, user=None, request=None) -> dict[str, Any]:
    run = AssetReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError({"run_id": f"Không tìm thấy bản kết quả báo cáo {run_id}"})

    schema = ASSET_REPORT_SCHEMAS.get(run.report_code, {})
    req_perm = schema.get("required_permission", PERM_ASSET_VIEW)
    require_asset_permission(user, req_perm)

    is_stale = check_asset_report_stale(run)

    return {
        "id": str(run.id),
        "run_number": run.run_number,
        "report_code": run.report_code,
        "report_name": run.report_name,
        "asset_report_type": run.asset_report_type,
        "report_category_type": run.report_category_type,
        "company_id": run.company_id,
        "from_date": run.from_date.isoformat() if run.from_date else None,
        "to_date": run.to_date.isoformat() if run.to_date else None,
        "as_of_date": run.as_of_date.isoformat() if run.as_of_date else None,
        "fiscal_year": run.fiscal_year,
        "parameters": run.parameters,
        "summary": run.summary_payload,
        "dynamic_columns": run.dynamic_columns,
        "row_count": run.row_count,
        "warning_count": run.warning_count,
        "error_count": run.error_count,
        "is_stale": is_stale,
        "generated_by": run.generated_by,
        "generated_at": run.generated_at.isoformat(),
    }


def get_asset_report_run_rows(run_id: str, user=None, request=None, search: str = None) -> dict[str, Any]:
    run = AssetReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError({"run_id": f"Không tìm thấy bản báo cáo {run_id}"})

    schema = ASSET_REPORT_SCHEMAS.get(run.report_code, {})
    req_perm = schema.get("required_permission", PERM_ASSET_VIEW)
    require_asset_permission(user, req_perm)

    qs = run.rows.all().order_by("row_order")
    if search:
        qs = qs.filter(Q(asset_code__icontains=search) | Q(asset_name__icontains=search) | Q(document_no__icontains=search))

    rows = []
    for r in qs:
        rows.append({
            "id": r.id,
            "row_order": r.row_order,
            "row_type": r.row_type,
            "asset_id": r.asset_id,
            "asset_code": r.asset_code,
            "asset_name": r.asset_name,
            "asset_type": r.asset_type,
            "department_id": r.department_id,
            "department_name": r.department_name,
            "document_no": r.document_no,
            "columns": r.columns_payload,
            "detail_payload": r.detail_payload,
            "source_refs": r.source_refs,
            "warning_codes": r.warning_codes,
        })

    return {"run_id": str(run.id), "count": len(rows), "rows": rows}


def get_asset_report_run_summary(run_id: str, user=None, request=None) -> dict[str, Any]:
    run = AssetReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError({"run_id": f"Không tìm thấy bản báo cáo {run_id}"})
    return {"run_id": str(run.id), "summary": run.summary_payload}


def get_asset_report_run_validation(run_id: str, user=None, request=None) -> dict[str, Any]:
    run = AssetReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError({"run_id": f"Không tìm thấy bản báo cáo {run_id}"})

    validations = [
        {
            "id": v.id,
            "check_code": v.check_code,
            "check_name": v.check_name,
            "severity": v.severity,
            "status": v.status,
            "message": v.message,
            "affected_rows": v.affected_rows,
            "details": v.details,
        }
        for v in run.validations.all()
    ]
    return {"run_id": str(run.id), "count": len(validations), "validations": validations}


def get_asset_report_row_sources(run_id: str, row_order: int, user=None, request=None) -> dict[str, Any]:
    row = AssetReportRow.objects.filter(run_id=run_id, row_order=row_order).first()
    if not row:
        raise ValidationError({"row_order": f"Không tìm thấy dòng báo cáo thứ tự {row_order}"})

    sources = []
    if row.asset_id:
        record = AssetRecord.objects.filter(id=row.asset_id).first()
        if record:
            sources.append({
                "type": "AssetRecord",
                "id": str(record.id),
                "code": record.code,
                "name": record.name,
                "asset_type": record.asset_type,
                "status": record.status,
                "original_cost": _fmt_dec(record.original_cost),
            })
    return {"row_order": row.row_order, "sources": sources, "detail_payload": row.detail_payload}


def get_asset_report_run_history(run_id: str, user=None, request=None) -> dict[str, Any]:
    run = AssetReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError({"run_id": f"Không tìm thấy bản báo cáo {run_id}"})

    runs = AssetReportRun.objects.filter(
        company_id=run.company_id, report_code=run.report_code
    ).order_by("-generated_at")[:20]

    items = [
        {
            "id": str(r.id),
            "run_number": r.run_number,
            "generated_at": r.generated_at.isoformat(),
            "generated_by": r.generated_by,
            "row_count": r.row_count,
            "warning_count": r.warning_count,
        }
        for r in runs
    ]
    return {"report_code": run.report_code, "history": items}


def get_asset_balances_as_of(company_id: str, as_of_date_str: str = None, user=None, request=None) -> dict[str, Any]:
    today = timezone.localdate()
    as_of = date.fromisoformat(as_of_date_str) if as_of_date_str else today

    assets = AssetRecord.objects.filter(company_id=company_id, acquisition_date__lte=as_of)
    tot_cost = ZERO
    tot_accum = ZERO
    tot_rem = ZERO

    items = []
    for a in assets:
        cost = _to_dec(a.original_cost)
        accum = CalculationLine.objects.filter(
            run__company_id=company_id,
            run__status="POSTED",
            run__period_end__lte=as_of,
            asset_id=a.id,
        ).aggregate(total=Sum("amount"))["total"] or ZERO
        accum_dec = _to_dec(accum)
        if accum_dec == ZERO and a.accumulated_depreciation > ZERO and a.acquisition_date <= as_of:
            accum_dec = _to_dec(a.accumulated_depreciation)

        rem = max(ZERO, cost - accum_dec)
        tot_cost += cost
        tot_accum += accum_dec
        tot_rem += rem

        items.append({
            "asset_id": str(a.id),
            "code": a.code,
            "name": a.name,
            "asset_type": a.asset_type,
            "original_cost": _fmt_dec(cost),
            "accumulated_value": _fmt_dec(accum_dec),
            "remaining_value": _fmt_dec(rem),
        })

    return {
        "company_id": str(company_id),
        "as_of_date": as_of.isoformat(),
        "total_cost": _fmt_dec(tot_cost),
        "total_accumulated": _fmt_dec(tot_accum),
        "total_remaining": _fmt_dec(tot_rem),
        "count": len(items),
        "balances": items,
    }


def list_asset_saved_filters_payload(report_code: str = None, user=None, request=None) -> dict[str, Any]:
    company_id, _ = resolve_asset_company_scope(request, {})
    qs = AssetSavedFilter.objects.filter(company_id=company_id)
    if report_code:
        qs = qs.filter(report_code=report_code)
    filters = [
        {
            "id": f.id,
            "report_code": f.report_code,
            "filter_name": f.filter_name,
            "parameters": f.parameters,
            "is_default": f.is_default,
            "updated_at": f.updated_at.isoformat(),
        }
        for f in qs
    ]
    return {"count": len(filters), "filters": filters}


def save_asset_filter_payload(data: dict[str, Any], user=None, request=None) -> dict[str, Any]:
    company_id, _ = resolve_asset_company_scope(request, data)
    report_code = data.get("report_code")
    filter_name = data.get("filter_name")
    if not report_code or not filter_name:
        raise ValidationError("report_code và filter_name là bắt buộc.")

    params = data.get("parameters", {})
    is_default = bool(data.get("is_default", False))

    flt, created = AssetSavedFilter.objects.update_or_create(
        company_id=company_id,
        user_id=str(getattr(user, "username", "")),
        report_code=report_code,
        filter_name=filter_name,
        defaults={"parameters": _to_json_safe(params), "is_default": is_default},
    )

    return {
        "id": flt.id,
        "created": created,
        "filter_name": flt.filter_name,
        "report_code": flt.report_code,
    }


def export_asset_report_run_payload(run_id: str, fmt: str = "XLSX", user=None, request=None) -> dict[str, Any]:
    require_asset_permission(user, PERM_ASSET_EXPORT)

    run = AssetReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError({"run_id": f"Không tìm thấy bản báo cáo {run_id}"})

    export_url = f"/api/v1/reports/assets/runs/{run.id}/download?format={fmt.lower()}"
    return {
        "run_id": str(run.id),
        "format": fmt.upper(),
        "export_status": "READY",
        "file_name": f"{run.report_code}_{run.run_number}.{fmt.lower()}",
        "download_url": export_url,
    }

