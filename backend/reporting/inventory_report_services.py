"""
UC-RPT-12 – Xem báo cáo kho (15 Báo cáo kho)

Cung cấp toàn bộ logic tổng hợp, tính toán, kiểm tra và trình bày số liệu kho:
- RPT-0143: Tổng hợp tồn kho (12 cột)
- RPT-0144: Tổng hợp tồn trên nhiều kho - Dạng bảng chéo (3 cột cố định + Dynamic cột kho)
- RPT-0145: Tổng hợp tồn kho theo nhiều đơn vị tính (3 cột cố định + Dynamic UOM)
- RPT-0146: Tổng hợp nhập xuất tồn trên nhiều kho (11 cột)
- RPT-0147: Tổng hợp tồn kho theo nhóm VTHH (12 cột phân cấp)
- RPT-0148: Báo cáo tồn theo chứng từ nhập chưa chuyển kho (10 cột)
- RPT-0149: Sổ chi tiết vật tư hàng hóa (15 cột running balance)
- RPT-0150: Sổ chuyển kho nội bộ (11 cột)
- RPT-0151: Báo cáo tiến độ sản xuất (6 cột)
- RPT-0152: Tổng hợp xuất kho theo lệnh sản xuất (12 cột)
- RPT-0153: Báo cáo đối chiếu kho và sổ cái (11 cột)
- RPT-0154: Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng (11 cột)
- RPT-0155: Đối chiếu nhập xuất giữa kế toán và thủ kho (13 cột)
- RPT-0156: Báo cáo đối chiếu giá thành và giá trị nhập kho (10 cột)
- RPT-0157: Đối chiếu giá trị nhập, xuất kho của lệnh lắp ráp, tháo dỡ (10 cột)

Tuân thủ nguyên tắc read-only tuyệt đối (BR-RPT-INV-09, BR-RPT-INV-111..114).
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

from general_ledger.models import Account, JournalEntry, JournalLine
from organization.models import Branch, Company
from master_data.models import Item, ItemCategory, Warehouse, UnitOfMeasure, ItemUomConversion
from inventory.models import (
    InventoryTransaction,
    InventoryTransactionLine,
    StockMovement,
    StockBalance,
    ValuationRun,
    AssemblyOrder,
    AssemblyLine,
    ProductionOrder,
    ProductionOrderLine,
)
from purchases.models import (
    PurchaseCost,
    PurchaseCostLine,
    GoodsPurchase,
    GoodsPurchaseLine,
)

from .models import (
    ReportDefinition,
    InventoryReportRun,
    InventoryReportRow,
    InventoryReportValidationResult,
    InventorySavedFilter,
)

logger = logging.getLogger(__name__)

ZERO = Decimal("0.0000")
TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")

# Permissions
PERM_INVENTORY_VIEW = "RPT_INVENTORY_VIEW"
PERM_INVENTORY_VALUE_VIEW = "RPT_INVENTORY_VALUE_VIEW"
PERM_INVENTORY_COST_VIEW = "RPT_INVENTORY_COST_VIEW"
PERM_INVENTORY_RECON_VIEW = "RPT_INVENTORY_RECON_VIEW"
PERM_PRODUCTION_VIEW = "RPT_PRODUCTION_VIEW"
PERM_INVENTORY_EXPORT = "RPT_INVENTORY_EXPORT"

ALL_INVENTORY_PERMISSIONS = (
    PERM_INVENTORY_VIEW,
    PERM_INVENTORY_VALUE_VIEW,
    PERM_INVENTORY_COST_VIEW,
    PERM_INVENTORY_RECON_VIEW,
    PERM_PRODUCTION_VIEW,
    PERM_INVENTORY_EXPORT,
)

PERM_ALIASES: dict[str, tuple[str, ...]] = {
    PERM_INVENTORY_VIEW: (
        "RPT_INVENTORY_VIEW",
        "RPT.INVENTORY.VIEW",
        "RPT.VIEW",
        "INVENTORY.VIEW",
        "RPT_INVENTORY_VALUE_VIEW",
        "RPT_INVENTORY_RECON_VIEW",
    ),
    PERM_INVENTORY_VALUE_VIEW: (
        "RPT_INVENTORY_VALUE_VIEW",
        "RPT.INVENTORY.VALUE.VIEW",
        "INVENTORY.VALUE.VIEW",
    ),
    PERM_INVENTORY_COST_VIEW: (
        "RPT_INVENTORY_COST_VIEW",
        "RPT.INVENTORY.COST.VIEW",
        "INVENTORY.COST.VIEW",
    ),
    PERM_INVENTORY_RECON_VIEW: (
        "RPT_INVENTORY_RECON_VIEW",
        "RPT.INVENTORY.RECON.VIEW",
        "INVENTORY.RECON.VIEW",
    ),
    PERM_PRODUCTION_VIEW: (
        "RPT_PRODUCTION_VIEW",
        "RPT.PRODUCTION.VIEW",
        "PRODUCTION.VIEW",
    ),
    PERM_INVENTORY_EXPORT: (
        "RPT_INVENTORY_EXPORT",
        "RPT.INVENTORY.EXPORT",
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
# Metadata & Catalogue definitions for 15 Inventory Reports
# -----------------------------------------------------------------------------

INVENTORY_REPORT_SCHEMAS: dict[str, dict[str, Any]] = {
    # 1. RPT-0143: Tổng hợp tồn kho - 12 cột
    "RPT-0143": {
        "report_code": "RPT-0143",
        "report_name": "Tổng hợp tồn kho",
        "inventory_source_type": "STOCK",
        "report_category_type": "INVENTORY_SUMMARY",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_VIEW,
        "fixed_columns_count": 12,
        "columns": [
            {"code": "warehouse_name", "name": "Tên kho", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "opening_quantity", "name": "Số lượng", "group_header": "Đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "opening_value", "name": "Giá trị", "group_header": "Đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "receipt_quantity", "name": "Số lượng", "group_header": "Nhập kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "receipt_value", "name": "Giá trị", "group_header": "Nhập kho", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "issue_quantity", "name": "Số lượng", "group_header": "Xuất kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "issue_value", "name": "Giá trị", "group_header": "Xuất kho", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "closing_quantity", "name": "Số lượng", "group_header": "Cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_value", "name": "Giá trị", "group_header": "Cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
        ],
    },
    # 2. RPT-0144: Tổng hợp tồn trên nhiều kho (Bảng chéo) - 3 cột cố định + động
    "RPT-0144": {
        "report_code": "RPT-0144",
        "report_name": "Tổng hợp tồn trên nhiều kho (Dạng bảng chéo)",
        "inventory_source_type": "STOCK",
        "report_category_type": "MULTI_WAREHOUSE_BALANCE",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_VIEW,
        "fixed_columns_count": 3,
        "columns": [
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 3. RPT-0145: Tổng hợp tồn kho theo nhiều đơn vị tính - 3 cột cố định + động
    "RPT-0145": {
        "report_code": "RPT-0145",
        "report_name": "Tổng hợp tồn kho theo nhiều đơn vị tính",
        "inventory_source_type": "STOCK",
        "report_category_type": "MULTI_UOM_BALANCE",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_VIEW,
        "fixed_columns_count": 3,
        "columns": [
            {"code": "warehouse_code", "name": "Mã kho", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    # 4. RPT-0146: Tổng hợp nhập xuất tồn trên nhiều kho - 11 cột
    "RPT-0146": {
        "report_code": "RPT-0146",
        "report_name": "Tổng hợp nhập xuất tồn trên nhiều kho",
        "inventory_source_type": "STOCK",
        "report_category_type": "CROSS_WAREHOUSE_SUMMARY",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_VIEW,
        "fixed_columns_count": 11,
        "columns": [
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "opening_quantity", "name": "Số lượng", "group_header": "Đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "opening_value", "name": "Giá trị", "group_header": "Đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "receipt_quantity", "name": "Số lượng", "group_header": "Nhập kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "receipt_value", "name": "Giá trị", "group_header": "Nhập kho", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "issue_quantity", "name": "Số lượng", "group_header": "Xuất kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "issue_value", "name": "Giá trị", "group_header": "Xuất kho", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "closing_quantity", "name": "Số lượng", "group_header": "Cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_value", "name": "Giá trị", "group_header": "Cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
        ],
    },
    # 5. RPT-0147: Tổng hợp tồn kho theo nhóm VTHH - 12 cột
    "RPT-0147": {
        "report_code": "RPT-0147",
        "report_name": "Tổng hợp tồn kho theo nhóm VTHH",
        "inventory_source_type": "STOCK",
        "report_category_type": "CATEGORY_SUMMARY",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_VIEW,
        "fixed_columns_count": 12,
        "columns": [
            {"code": "row_no", "name": "STT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "opening_quantity", "name": "Số lượng", "group_header": "Đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "opening_value", "name": "Giá trị", "group_header": "Đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "receipt_quantity", "name": "Số lượng", "group_header": "Nhập kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "receipt_value", "name": "Giá trị", "group_header": "Nhập kho", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "issue_quantity", "name": "Số lượng", "group_header": "Xuất kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "issue_value", "name": "Giá trị", "group_header": "Xuất kho", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "closing_quantity", "name": "Số lượng", "group_header": "Cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_value", "name": "Giá trị", "group_header": "Cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
        ],
    },
    # 6. RPT-0148: Báo cáo tồn theo chứng từ nhập chưa chuyển kho - 10 cột
    "RPT-0148": {
        "report_code": "RPT-0148",
        "report_name": "Báo cáo tồn theo chứng từ nhập chưa chuyển kho",
        "inventory_source_type": "STOCK",
        "report_category_type": "UNTRANSFERRED_RECEIPTS",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_VIEW,
        "fixed_columns_count": 10,
        "columns": [
            {"code": "receipt_document_date", "name": "Ngày chứng từ", "group_header": "Chứng từ nhập", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "receipt_document_no", "name": "Số chứng từ", "group_header": "Chứng từ nhập", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "group_header": "Chứng từ nhập", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "group_header": "Chứng từ nhập", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "Đơn vị tính", "group_header": "Chứng từ nhập", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "received_quantity", "name": "Số lượng nhập", "group_header": "Chứng từ nhập", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "transfer_document_date", "name": "Ngày chứng từ", "group_header": "Chứng từ chuyển kho", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "transfer_document_no", "name": "Số chứng từ", "group_header": "Chứng từ chuyển kho", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "transferred_quantity", "name": "Số lượng", "group_header": "Chứng từ chuyển kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_untransferred_quantity", "name": "Số lượng tồn", "group_header": "Kết quả", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 7. RPT-0149: Sổ chi tiết vật tư hàng hóa - 15 cột
    "RPT-0149": {
        "report_code": "RPT-0149",
        "report_name": "Sổ chi tiết vật tư hàng hóa",
        "inventory_source_type": "STOCK",
        "report_category_type": "STOCK_LEDGER",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_VIEW,
        "fixed_columns_count": 15,
        "columns": [
            {"code": "warehouse_name", "name": "Tên kho", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_description", "name": "Mô tả", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "unit_cost", "name": "Đơn giá", "data_type": "NUMBER", "align": "right", "is_totalable": False, "requires_value_perm": True},
            {"code": "receipt_quantity", "name": "Số lượng", "group_header": "Nhập", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "receipt_value", "name": "Giá trị", "group_header": "Nhập", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "issue_quantity", "name": "Số lượng", "group_header": "Xuất", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "issue_value", "name": "Giá trị", "group_header": "Xuất", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "running_quantity", "name": "Số lượng", "group_header": "Tồn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "running_value", "name": "Giá trị", "group_header": "Tồn", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
        ],
    },
    # 8. RPT-0150: Sổ chuyển kho nội bộ - 11 cột
    "RPT-0150": {
        "report_code": "RPT-0150",
        "report_name": "Sổ chuyển kho nội bộ",
        "inventory_source_type": "STOCK",
        "report_category_type": "INTERNAL_TRANSFER",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_VIEW,
        "fixed_columns_count": 11,
        "columns": [
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "from_warehouse_name", "name": "Từ kho", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "to_warehouse_name", "name": "Đến kho", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "Đơn vị tính", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "transfer_quantity", "name": "Số lượng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "transfer_unit_cost", "name": "Đơn giá", "data_type": "NUMBER", "align": "right", "is_totalable": False, "requires_value_perm": True},
            {"code": "transfer_amount", "name": "Thành tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "document_type_name", "name": "Loại chứng từ", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 9. RPT-0151: Báo cáo tiến độ sản xuất - 6 cột
    "RPT-0151": {
        "report_code": "RPT-0151",
        "report_name": "Báo cáo tiến độ sản xuất",
        "inventory_source_type": "PRODUCTION",
        "report_category_type": "PRODUCTION_PROGRESS",
        "schema_version": "1.0",
        "required_permission": PERM_PRODUCTION_VIEW,
        "fixed_columns_count": 6,
        "columns": [
            {"code": "finished_item_code", "name": "Mã thành phẩm", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "finished_item_name", "name": "Tên thành phẩm", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "required_quantity", "name": "Số lượng yêu cầu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "produced_quantity", "name": "Số lượng sản xuất", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "quantity_difference", "name": "Chênh lệch", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 10. RPT-0152: Tổng hợp xuất kho theo lệnh sản xuất - 12 cột
    "RPT-0152": {
        "report_code": "RPT-0152",
        "report_name": "Tổng hợp xuất kho theo lệnh sản xuất",
        "inventory_source_type": "PRODUCTION",
        "report_category_type": "PRODUCTION_ISSUE",
        "schema_version": "1.0",
        "required_permission": PERM_PRODUCTION_VIEW,
        "fixed_columns_count": 12,
        "columns": [
            {"code": "standard_finished_quantity", "name": "SL thành phẩm định mức", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "material_code", "name": "Mã nguyên vật liệu", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "material_name", "name": "Tên nguyên vật liệu", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "standard_material_quantity", "name": "Số lượng định mức", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "issued_quantity_period", "name": "Xuất kho", "group_header": "Số lượng NVL trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity_period", "name": "Nhập lại kho", "group_header": "Số lượng NVL trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "actual_used_period", "name": "Thực tế sử dụng", "group_header": "Số lượng NVL trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "issued_quantity_cumulative", "name": "Xuất kho", "group_header": "Số lượng NVL lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity_cumulative", "name": "Nhập lại kho", "group_header": "Số lượng NVL lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "actual_used_cumulative", "name": "Thực tế sử dụng", "group_header": "Số lượng NVL lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "material_variance_quantity", "name": "Chênh lệch NVL", "group_header": "Kết quả", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 11. RPT-0153: Báo cáo đối chiếu kho và sổ cái - 11 cột
    "RPT-0153": {
        "report_code": "RPT-0153",
        "report_name": "Báo cáo đối chiếu kho và sổ cái",
        "inventory_source_type": "RECONCILIATION",
        "report_category_type": "RECONCILIATION_GL",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_RECON_VIEW,
        "fixed_columns_count": 11,
        "columns": [
            {"code": "reconciliation_period", "name": "Kỳ đối chiếu", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "gl_debit_movement", "name": "Phát sinh Nợ", "group_header": "Theo sổ cái", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gl_credit_movement", "name": "Phát sinh Có", "group_header": "Theo sổ cái", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gl_closing_balance", "name": "Số dư", "group_header": "Theo sổ cái", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "inventory_receipt_value", "name": "Nhập kho", "group_header": "Theo sổ kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "inventory_issue_value", "name": "Xuất kho", "group_header": "Theo sổ kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "inventory_closing_value", "name": "Tồn kho", "group_header": "Theo sổ kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "debit_receipt_difference", "name": "PS Nợ − Nhập kho", "group_header": "Chênh lệch", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_issue_difference", "name": "PS Có − Xuất kho", "group_header": "Chênh lệch", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_balance_difference", "name": "Số dư − Tồn kho", "group_header": "Chênh lệch", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "difference_detail", "name": "Chi tiết chênh lệch", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    # 12. RPT-0154: Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng - 11 cột
    "RPT-0154": {
        "report_code": "RPT-0154",
        "report_name": "Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng",
        "inventory_source_type": "RECONCILIATION",
        "report_category_type": "RECONCILIATION_PURCHASE_COST",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_RECON_VIEW,
        "fixed_columns_count": 11,
        "columns": [
            {"code": "cost_document_posting_date", "name": "Ngày hạch toán", "group_header": "Chứng từ chi phí mua hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "cost_document_date", "name": "Ngày chứng từ", "group_header": "Chứng từ chi phí mua hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "cost_document_no", "name": "Số chứng từ", "group_header": "Chứng từ chi phí mua hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "cost_account_code", "name": "TK chi phí/TK kho", "group_header": "Chứng từ chi phí mua hàng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "cost_document_amount", "name": "Số tiền", "group_header": "Chứng từ chi phí mua hàng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "purchase_document_posting_date", "name": "Ngày hạch toán", "group_header": "Chứng từ mua hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "purchase_document_date", "name": "Ngày chứng từ", "group_header": "Chứng từ mua hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "purchase_document_no", "name": "Số chứng từ", "group_header": "Chứng từ mua hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "purchase_account_code", "name": "TK chi phí/TK kho", "group_header": "Chứng từ mua hàng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "allocated_cost_amount", "name": "Số tiền", "group_header": "Chứng từ mua hàng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "difference_amount", "name": "Chênh lệch", "group_header": "Kết quả", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 13. RPT-0155: Đối chiếu nhập xuất giữa kế toán và thủ kho - 13 cột
    "RPT-0155": {
        "report_code": "RPT-0155",
        "report_name": "Đối chiếu nhập xuất giữa kế toán và thủ kho",
        "inventory_source_type": "RECONCILIATION",
        "report_category_type": "RECONCILIATION_WAREHOUSE_BOOK",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_RECON_VIEW,
        "fixed_columns_count": 13,
        "columns": [
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "warehouse_book_date", "name": "Ngày ghi sổ kho", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "accounting_receipt_quantity", "name": "Sổ kế toán", "group_header": "Số lượng nhập", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "warehouse_receipt_quantity", "name": "Sổ kho", "group_header": "Số lượng nhập", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "receipt_difference", "name": "Chênh lệch", "group_header": "Số lượng nhập", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "accounting_issue_quantity", "name": "Sổ kế toán", "group_header": "Số lượng xuất", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "warehouse_issue_quantity", "name": "Sổ kho", "group_header": "Số lượng xuất", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "issue_difference", "name": "Chênh lệch", "group_header": "Số lượng xuất", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 14. RPT-0156: Báo cáo đối chiếu giá thành và giá trị nhập kho - 10 cột
    "RPT-0156": {
        "report_code": "RPT-0156",
        "report_name": "Báo cáo đối chiếu giá thành và giá trị nhập kho",
        "inventory_source_type": "RECONCILIATION",
        "report_category_type": "RECONCILIATION_COSTING",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_RECON_VIEW,
        "fixed_columns_count": 10,
        "columns": [
            {"code": "finished_item_code", "name": "Mã thành phẩm", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "finished_item_name", "name": "Tên thành phẩm", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "costing_finished_quantity", "name": "Số lượng thành phẩm", "group_header": "Bảng tính giá thành", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "unit_production_cost", "name": "Giá thành đơn vị", "group_header": "Bảng tính giá thành", "data_type": "NUMBER", "align": "right", "is_totalable": False, "requires_value_perm": True},
            {"code": "total_production_cost", "name": "Tổng giá thành", "group_header": "Bảng tính giá thành", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "warehouse_receipt_quantity", "name": "Số lượng nhập kho", "group_header": "Phiếu nhập kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "warehouse_receipt_unit_cost", "name": "Đơn giá", "group_header": "Phiếu nhập kho", "data_type": "NUMBER", "align": "right", "is_totalable": False, "requires_value_perm": True},
            {"code": "warehouse_receipt_value", "name": "Giá trị nhập kho", "group_header": "Phiếu nhập kho", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "cost_warehouse_difference", "name": "Chênh lệch", "group_header": "Kết quả", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "note", "name": "Ghi chú", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    # 15. RPT-0157: Đối chiếu giá trị nhập, xuất kho của lệnh lắp ráp, tháo dỡ - 10 cột
    "RPT-0157": {
        "report_code": "RPT-0157",
        "report_name": "Đối chiếu giá trị nhập, xuất kho của lệnh lắp ráp, tháo dỡ",
        "inventory_source_type": "ASSEMBLY",
        "report_category_type": "RECONCILIATION_ASSEMBLY",
        "schema_version": "1.0",
        "required_permission": PERM_INVENTORY_RECON_VIEW,
        "fixed_columns_count": 10,
        "columns": [
            {"code": "assembly_document_date", "name": "Ngày lệnh LR/TD", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "assembly_order_no", "name": "Số lệnh LR/TD", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "receipt_document_date", "name": "Ngày phiếu nhập", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "receipt_document_no", "name": "Số phiếu nhập", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "receipt_value", "name": "Giá trị nhập", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "issue_document_date", "name": "Ngày phiếu xuất", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "issue_document_no", "name": "Số phiếu xuất", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "issue_value", "name": "Giá trị xuất", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "difference_amount", "name": "Chênh lệch", "data_type": "NUMBER", "align": "right", "is_totalable": True, "requires_value_perm": True},
            {"code": "document_type_name", "name": "Loại chứng từ", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
}


# -----------------------------------------------------------------------------
# Permissions and Scope Resolution
# -----------------------------------------------------------------------------

def user_has_inventory_permission(user, request, perm_code: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True

    header_perms = ""
    if request:
        header_perms = request.META.get("HTTP_X_USER_PERMISSIONS", "")
    granted = {p.strip().upper() for p in header_perms.split(",") if p.strip()}

    user_perms = getattr(user, "user_permissions", None)
    if user_perms:
        for p in user_perms.all():
            granted.add(p.codename.upper())

    group_perms = getattr(user, "get_group_permissions", None)
    if callable(group_perms):
        for p in group_perms():
            granted.add(p.upper())

    candidates = PERM_ALIASES.get(perm_code, (perm_code,))
    for c in candidates:
        if c.upper() in granted:
            return True

    return False


def resolve_inventory_company_scope(request, params: dict[str, Any]) -> tuple[str, Company]:
    user = getattr(request, "user", None)
    cid = (
        params.get("company_id")
        or (request.query_params.get("company_id") if hasattr(request, "query_params") else None)
        or (request.META.get("HTTP_X_COMPANY_ID") if hasattr(request, "META") else None)
    )

    company = None
    if cid:
        company = Company.objects.filter(Q(id__iexact=str(cid)) | Q(code__iexact=str(cid))).first()

    if not company and user and hasattr(user, "company"):
        company = user.company

    if not company:
        company = Company.objects.first()

    if not company:
        raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ hoặc không tìm thấy."})

    # Check isolation if user belongs to a specific company
    if user and not (getattr(user, "is_superuser", False) or getattr(user, "is_staff", False)):
        user_company = getattr(user, "company", None)
        if user_company and user_company.id != company.id:
            raise PermissionDenied("Không có quyền truy cập dữ liệu của doanh nghiệp này.")

    return str(company.id), company


def resolve_warehouse_scope(company: Company, user, request, params: dict[str, Any]) -> list[Warehouse]:
    wh_param = params.get("warehouse_ids") or params.get("warehouse_id")
    qs = Warehouse.objects.filter(company=company)

    # Check warehouse scope header / attribute if restricted
    allowed_wh_ids = None
    if request and "HTTP_X_WAREHOUSE_SCOPE" in request.META:
        scope_str = request.META.get("HTTP_X_WAREHOUSE_SCOPE", "")
        if scope_str.strip():
            allowed_wh_ids = [w.strip() for w in scope_str.split(",") if w.strip()]

    if allowed_wh_ids is not None:
        qs = qs.filter(Q(id__in=allowed_wh_ids) | Q(code__in=allowed_wh_ids))

    if wh_param:
        if isinstance(wh_param, (list, tuple)):
            ids = [str(x) for x in wh_param if x]
            matched = qs.filter(Q(id__in=ids) | Q(code__in=ids))
        else:
            matched = qs.filter(Q(id=str(wh_param)) | Q(code=str(wh_param)))
        if not matched.exists() and allowed_wh_ids is not None:
            raise PermissionDenied("Kho được chọn nằm ngoài phạm vi phân quyền của người dùng.")
        return list(matched)

    return list(qs)


def parse_date_param(val: Any) -> date | None:
    if not val:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    try:
        return datetime.strptime(str(val)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


# -----------------------------------------------------------------------------
# Public Catalogue & Schema Payloads
# -----------------------------------------------------------------------------

def get_inventory_report_catalogue_payload(company_id: str, user=None, request=None) -> dict[str, Any]:
    if not user_has_inventory_permission(user, request, PERM_INVENTORY_VIEW):
        raise PermissionDenied("Không có quyền xem danh mục báo cáo kho.")

    has_value_perm = user_has_inventory_permission(user, request, PERM_INVENTORY_VALUE_VIEW)
    has_recon_perm = user_has_inventory_permission(user, request, PERM_INVENTORY_RECON_VIEW)
    has_prod_perm = user_has_inventory_permission(user, request, PERM_PRODUCTION_VIEW)

    items = []
    for code, meta in INVENTORY_REPORT_SCHEMAS.items():
        req_perm = meta.get("required_permission", PERM_INVENTORY_VIEW)
        if req_perm == PERM_INVENTORY_RECON_VIEW and not has_recon_perm:
            continue
        if req_perm == PERM_PRODUCTION_VIEW and not has_prod_perm:
            continue

        items.append({
            "code": code,
            "name": meta["report_name"],
            "category": meta["report_category_type"],
            "source_type": meta["inventory_source_type"],
            "fixed_columns_count": meta["fixed_columns_count"],
            "supports_value": has_value_perm,
            "required_permission": req_perm,
        })

    return {
        "company_id": company_id,
        "total_reports": len(items),
        "reports": items,
    }


def get_inventory_report_schema_payload(report_code: str, user=None, request=None) -> dict[str, Any]:
    meta = INVENTORY_REPORT_SCHEMAS.get(report_code)
    if not meta:
        raise ValidationError({"report_code": f"Báo cáo kho không xác định: {report_code}"})

    req_perm = meta.get("required_permission", PERM_INVENTORY_VIEW)
    if not user_has_inventory_permission(user, request, req_perm):
        raise PermissionDenied(f"Không có quyền xem báo cáo {report_code}.")

    has_value_perm = user_has_inventory_permission(user, request, PERM_INVENTORY_VALUE_VIEW)

    # Filter columns if lacking value perm
    cols = []
    for c in meta["columns"]:
        col_copy = dict(c)
        if col_copy.get("requires_value_perm") and not has_value_perm:
            col_copy["hidden"] = True
            col_copy["masked"] = True
        cols.append(col_copy)

    return {
        "report_code": meta["report_code"],
        "report_name": meta["report_name"],
        "inventory_source_type": meta["inventory_source_type"],
        "report_category_type": meta["report_category_type"],
        "schema_version": meta["schema_version"],
        "columns": cols,
    }


def get_inventory_report_parameters_payload(report_code: str, user=None, request=None) -> dict[str, Any]:
    meta = INVENTORY_REPORT_SCHEMAS.get(report_code)
    if not meta:
        raise ValidationError({"report_code": f"Báo cáo kho không xác định: {report_code}"})

    common_params = [
        {"name": "company_id", "type": "UUID", "required": True, "label": "Doanh nghiệp"},
        {"name": "period_type", "type": "ENUM", "required": False, "label": "Kỳ báo cáo", "default": "THIS_MONTH"},
        {"name": "from_date", "type": "DATE", "required": False, "label": "Từ ngày"},
        {"name": "to_date", "type": "DATE", "required": False, "label": "Đến ngày"},
        {"name": "as_of_date", "type": "DATE", "required": False, "label": "Ngày chốt tồn"},
        {"name": "warehouse_ids", "type": "ARRAY", "required": False, "label": "Chọn kho"},
        {"name": "item_category_ids", "type": "ARRAY", "required": False, "label": "Nhóm VTHH"},
        {"name": "item_ids", "type": "ARRAY", "required": False, "label": "Mặt hàng"},
        {"name": "uom_id", "type": "UUID", "required": False, "label": "Đơn vị tính"},
    ]

    specific_params = []
    if report_code == "RPT-0144":
        specific_params.extend([
            {"name": "only_positive_balance", "type": "BOOLEAN", "required": False, "default": False, "label": "Chỉ hiển thị các kho còn tồn"},
            {"name": "show_inventory_value", "type": "BOOLEAN", "required": False, "default": True, "label": "Hiển thị giá trị tồn"},
        ])
    elif report_code == "RPT-0145":
        specific_params.extend([
            {"name": "show_movement_by_type", "type": "BOOLEAN", "required": False, "default": False, "label": "Hiển thị số lượng theo loại nhập xuất"},
        ])
    elif report_code == "RPT-0148":
        specific_params.extend([
            {"name": "only_untransferred", "type": "BOOLEAN", "required": False, "default": True, "label": "Chỉ lấy chứng từ nhập còn tồn"},
        ])
    elif report_code in {"RPT-0151", "RPT-0152"}:
        specific_params.extend([
            {"name": "manufacturing_order_ids", "type": "ARRAY", "required": False, "label": "Chọn lệnh sản xuất"},
        ])
    elif report_code == "RPT-0153":
        specific_params.extend([
            {"name": "account_ids", "type": "ARRAY", "required": False, "label": "Chọn tài khoản kho"},
            {"name": "only_discrepancies", "type": "BOOLEAN", "required": False, "default": False, "label": "Chỉ hiển thị các dòng phát sinh chênh lệch"},
            {"name": "include_transfer_same_account", "type": "BOOLEAN", "required": False, "default": False, "label": "Lấy chứng từ chuyển kho cùng TK"},
        ])
    elif report_code == "RPT-0154":
        specific_params.extend([
            {"name": "only_unallocated", "type": "BOOLEAN", "required": False, "default": False, "label": "Chỉ chứng từ chi phí chưa phân bổ hết"},
        ])
    elif report_code == "RPT-0156":
        specific_params.extend([
            {"name": "costing_period_ids", "type": "ARRAY", "required": False, "label": "Kỳ tính giá thành"},
            {"name": "only_discrepancies", "type": "BOOLEAN", "required": False, "default": False, "label": "Chỉ lấy thành phẩm có sai lệch"},
        ])
    elif report_code == "RPT-0157":
        specific_params.extend([
            {"name": "assembly_order_ids", "type": "ARRAY", "required": False, "label": "Chọn lệnh lắp ráp/tháo dỡ"},
            {"name": "only_discrepancies", "type": "BOOLEAN", "required": False, "default": False, "label": "Chỉ hiển thị dòng phát sinh chênh lệch"},
        ])

    return {
        "report_code": report_code,
        "parameters": common_params + specific_params,
    }


# -----------------------------------------------------------------------------
# Query & Calculation Core
# -----------------------------------------------------------------------------

def query_inventory_report_payload(report_code: str, params: dict[str, Any], user=None, request=None) -> dict[str, Any]:
    meta = INVENTORY_REPORT_SCHEMAS.get(report_code)
    if not meta:
        raise ValidationError({"report_code": f"Báo cáo kho không xác định: {report_code}"})

    req_perm = meta.get("required_permission", PERM_INVENTORY_VIEW)
    if not user_has_inventory_permission(user, request, req_perm):
        raise PermissionDenied(f"Không có quyền xem báo cáo {report_code}.")

    has_value_perm = user_has_inventory_permission(user, request, PERM_INVENTORY_VALUE_VIEW)

    from_date = parse_date_param(params.get("from_date"))
    to_date = parse_date_param(params.get("to_date"))
    as_of_date = parse_date_param(params.get("as_of_date"))

    if from_date and to_date and from_date > to_date:
        raise ValidationError({"from_date": "Từ ngày không được lớn hơn Đến ngày (TC-RPT-12-21)."})

    company_id, company = resolve_inventory_company_scope(request, params)
    warehouses = resolve_warehouse_scope(company, user, request, params)
    warehouse_ids = [str(w.id) for w in warehouses]

    if not to_date and as_of_date:
        to_date = as_of_date
    if not to_date:
        to_date = timezone.now().date()
    if not from_date:
        from_date = date(to_date.year, to_date.month, 1)

    # Dispatch to specific builder
    builder_fn = REPORT_BUILDERS.get(report_code)
    if not builder_fn:
        raise ValidationError({"report_code": f"Chưa cài đặt bộ xử lý cho {report_code}"})

    run_number = f"INV-{report_code}-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

    rows_data, summary_data, dynamic_cols, validations = builder_fn(
        company=company,
        warehouses=warehouses,
        from_date=from_date,
        to_date=to_date,
        params=params,
        has_value_perm=has_value_perm,
        user=user,
        request=request,
    )

    # Persist Report Run & Rows inside a read-only transaction (pure reporting tables)
    with transaction.atomic():
        run = InventoryReportRun.objects.create(
            run_number=run_number,
            report_code=report_code,
            report_name=meta["report_name"],
            inventory_source_type=meta["inventory_source_type"],
            report_category_type=meta["report_category_type"],
            company_id=str(company.id),
            from_date=from_date,
            to_date=to_date,
            as_of_date=to_date,
            parameters=_to_json_safe(params),
            summary_payload=_to_json_safe(summary_data),
            dynamic_columns=_to_json_safe(dynamic_cols),
            source_snapshot_meta=_to_json_safe({
                "company_name": company.name,
                "warehouses_count": len(warehouses),
                "generated_at": timezone.now().isoformat(),
                "has_value_perm": has_value_perm,
            }),
            row_count=len(rows_data),
            warning_count=sum(1 for v in validations if v.get("status") in {"WARNING", "FAILED"}),
            generated_by=str(getattr(user, "username", "system")),
        )

        rows_to_create = []
        for idx, r in enumerate(rows_data, start=1):
            cols_payload = dict(r.get("columns", {}))
            # Mask value columns if lacking permission
            if not has_value_perm:
                for k in list(cols_payload.keys()):
                    if any(sub in k for sub in ["value", "cost", "amount"]):
                        cols_payload[k] = None

            rows_to_create.append(
                InventoryReportRow(
                    run=run,
                    row_order=idx,
                    row_type=r.get("row_type", "DETAIL"),
                    node_id=r.get("node_id", ""),
                    parent_node_id=r.get("parent_node_id", ""),
                    warehouse_id=r.get("warehouse_id", ""),
                    warehouse_name=r.get("warehouse_name", ""),
                    item_id=r.get("item_id", ""),
                    item_code=r.get("item_code", ""),
                    item_name=r.get("item_name", ""),
                    category_id=r.get("category_id", ""),
                    category_name=r.get("category_name", ""),
                    category_level=r.get("category_level", 0),
                    uom_id=r.get("uom_id", ""),
                    uom_name=r.get("uom_name", ""),
                    lot_id=r.get("lot_id", ""),
                    lot_code=r.get("lot_code", ""),
                    location_id=r.get("location_id", ""),
                    location_name=r.get("location_name", ""),
                    document_id=r.get("document_id", ""),
                    document_no=r.get("document_no", ""),
                    production_order_id=r.get("production_order_id", ""),
                    assembly_order_id=r.get("assembly_order_id", ""),
                    gl_account_code=r.get("gl_account_code", ""),
                    columns_payload=_to_json_safe(cols_payload),
                    detail_payload=_to_json_safe(r.get("detail", {})),
                    source_refs=_to_json_safe(r.get("source_refs", [])),
                    warning_codes=_to_json_safe(r.get("warning_codes", [])),
                )
            )

        if rows_to_create:
            InventoryReportRow.objects.bulk_create(rows_to_create, batch_size=500)

        for v in validations:
            InventoryReportValidationResult.objects.create(
                run=run,
                check_code=v.get("check_code", "CHECK"),
                check_name=v.get("check_name", ""),
                severity=v.get("severity", "WARNING"),
                status=v.get("status", "PASSED"),
                message=v.get("message", ""),
                affected_rows=_to_json_safe(v.get("affected_rows", [])),
                details=_to_json_safe(v.get("details", {})),
            )

    return get_inventory_report_run_details(str(run.id), user=user, request=request)


# -----------------------------------------------------------------------------
# Specific Builders for RPT-0143 through RPT-0157
# -----------------------------------------------------------------------------

def _build_rpt_0143(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0143: Tổng hợp tồn kho (12 cột).
    Tồn cuối = Tồn đầu + Nhập − Xuất.
    """
    rows = []
    wh_ids = [w.id for w in warehouses]
    items_qs = Item.objects.filter(company=company, status="ACTIVE")
    if params.get("item_ids"):
        items_qs = items_qs.filter(id__in=params["item_ids"])
    if params.get("item_category_ids"):
        items_qs = items_qs.filter(category_id__in=params["item_category_ids"])

    tot_open_qty = Decimal("0")
    tot_open_val = Decimal("0")
    tot_rec_qty = Decimal("0")
    tot_rec_val = Decimal("0")
    tot_iss_qty = Decimal("0")
    tot_iss_val = Decimal("0")
    tot_cls_qty = Decimal("0")
    tot_cls_val = Decimal("0")

    validations = []
    has_negative_stock = False

    for wh in warehouses:
        for item in items_qs:
            # 1. Opening balance before from_date
            movements_before = StockMovement.objects.filter(
                company=company, warehouse=wh, item=item, movement_date__lt=from_date
            )
            open_qty = movements_before.aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0")
            open_val = movements_before.aggregate(s=Sum("value_delta"))["s"] or Decimal("0")

            # 2. Movements in period
            movements_period = StockMovement.objects.filter(
                company=company, warehouse=wh, item=item, movement_date__gte=from_date, movement_date__lte=to_date
            )
            rec_qty = movements_period.filter(quantity_delta__gt=0).aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0")
            rec_val = movements_period.filter(value_delta__gt=0).aggregate(s=Sum("value_delta"))["s"] or Decimal("0")
            iss_qty = abs(movements_period.filter(quantity_delta__lt=0).aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0"))
            iss_val = abs(movements_period.filter(value_delta__lt=0).aggregate(s=Sum("value_delta"))["s"] or Decimal("0"))

            # Closing balance = Open + In - Out
            cls_qty = open_qty + rec_qty - iss_qty
            cls_val = open_val + rec_val - iss_val

            # Skip zero balance if not include_zero_balance
            if not params.get("include_zero_balance", True) and open_qty == 0 and rec_qty == 0 and iss_qty == 0 and cls_qty == 0:
                continue

            warning_codes = []
            if cls_qty < 0:
                warning_codes.append("WARN_NEGATIVE_STOCK")
                has_negative_stock = True

            uom_name = item.base_uom.name if item.base_uom else ""

            cols = {
                "warehouse_name": wh.name,
                "item_code": item.code,
                "item_name": item.name,
                "uom_name": uom_name,
                "opening_quantity": _fmt_dec(open_qty),
                "opening_value": _fmt_dec(open_val) if has_value_perm else None,
                "receipt_quantity": _fmt_dec(rec_qty),
                "receipt_value": _fmt_dec(rec_val) if has_value_perm else None,
                "issue_quantity": _fmt_dec(iss_qty),
                "issue_value": _fmt_dec(iss_val) if has_value_perm else None,
                "closing_quantity": _fmt_dec(cls_qty),
                "closing_value": _fmt_dec(cls_val) if has_value_perm else None,
            }

            tot_open_qty += open_qty
            tot_open_val += open_val
            tot_rec_qty += rec_qty
            tot_rec_val += rec_val
            tot_iss_qty += iss_qty
            tot_iss_val += iss_val
            tot_cls_qty += cls_qty
            tot_cls_val += cls_val

            rows.append({
                "row_type": "DETAIL",
                "warehouse_id": str(wh.id),
                "warehouse_name": wh.name,
                "item_id": str(item.id),
                "item_code": item.code,
                "item_name": item.name,
                "uom_id": str(item.base_uom_id) if item.base_uom_id else "",
                "uom_name": uom_name,
                "columns": cols,
                "warning_codes": warning_codes,
            })

    if has_negative_stock:
        validations.append({
            "check_code": "WARN_NEGATIVE_STOCK",
            "check_name": "Cảnh báo tồn kho âm",
            "severity": "WARNING",
            "status": "WARNING",
            "message": "Phát hiện mặt hàng có số lượng tồn cuối kỳ âm (TC-RPT-12-30).",
        })

    summary = {
        "total_opening_quantity": _fmt_dec(tot_open_qty),
        "total_opening_value": _fmt_dec(tot_open_val) if has_value_perm else None,
        "total_receipt_quantity": _fmt_dec(tot_rec_qty),
        "total_receipt_value": _fmt_dec(tot_rec_val) if has_value_perm else None,
        "total_issue_quantity": _fmt_dec(tot_iss_qty),
        "total_issue_value": _fmt_dec(tot_iss_val) if has_value_perm else None,
        "total_closing_quantity": _fmt_dec(tot_cls_qty),
        "total_closing_value": _fmt_dec(tot_cls_val) if has_value_perm else None,
    }

    return rows, summary, [], validations


def _build_rpt_0144(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0144: Tổng hợp tồn trên nhiều kho (Dạng bảng chéo).
    3 cột cố định: Mã hàng, Tên hàng, ĐVT.
    Dynamic columns: Theo từng kho (Tồn SL, Giá trị).
    """
    items_qs = Item.objects.filter(company=company, status="ACTIVE")
    if params.get("item_ids"):
        items_qs = items_qs.filter(id__in=params["item_ids"])

    show_val = params.get("show_inventory_value", True) and has_value_perm
    only_pos = params.get("only_positive_balance", False)

    dynamic_cols = []
    for wh in warehouses:
        dynamic_cols.append({
            "code": f"wh_{wh.id}_qty",
            "name": f"SL {wh.name}",
            "group_header": wh.name,
            "data_type": "NUMBER",
            "align": "right",
            "is_totalable": True,
        })
        if show_val:
            dynamic_cols.append({
                "code": f"wh_{wh.id}_val",
                "name": f"Giá trị {wh.name}",
                "group_header": wh.name,
                "data_type": "NUMBER",
                "align": "right",
                "is_totalable": True,
            })

    dynamic_cols.append({"code": "total_quantity", "name": "Tổng tồn SL", "data_type": "NUMBER", "align": "right", "is_totalable": True})
    if show_val:
        dynamic_cols.append({"code": "total_value", "name": "Tổng giá trị", "data_type": "NUMBER", "align": "right", "is_totalable": True})

    rows = []
    tot_overall_qty = Decimal("0")
    tot_overall_val = Decimal("0")

    for item in items_qs:
        row_cols = {
            "item_code": item.code,
            "item_name": item.name,
            "uom_name": item.base_uom.name if item.base_uom else "",
        }
        item_total_qty = Decimal("0")
        item_total_val = Decimal("0")

        for wh in warehouses:
            movements = StockMovement.objects.filter(
                company=company, warehouse=wh, item=item, movement_date__lte=to_date
            )
            wh_qty = movements.aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0")
            wh_val = movements.aggregate(s=Sum("value_delta"))["s"] or Decimal("0")

            row_cols[f"wh_{wh.id}_qty"] = _fmt_dec(wh_qty)
            if show_val:
                row_cols[f"wh_{wh.id}_val"] = _fmt_dec(wh_val)

            item_total_qty += wh_qty
            item_total_val += wh_val

        row_cols["total_quantity"] = _fmt_dec(item_total_qty)
        if show_val:
            row_cols["total_value"] = _fmt_dec(item_total_val)

        if only_pos and item_total_qty <= 0:
            continue

        tot_overall_qty += item_total_qty
        tot_overall_val += item_total_val

        rows.append({
            "row_type": "DETAIL",
            "item_id": str(item.id),
            "item_code": item.code,
            "item_name": item.name,
            "uom_id": str(item.base_uom_id) if item.base_uom_id else "",
            "uom_name": item.base_uom.name if item.base_uom else "",
            "columns": row_cols,
        })

    summary = {
        "total_quantity": _fmt_dec(tot_overall_qty),
        "total_value": _fmt_dec(tot_overall_val) if show_val else None,
    }

    return rows, summary, dynamic_cols, []


def _build_rpt_0145(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0145: Tổng hợp tồn kho theo nhiều đơn vị tính (Multi-UOM).
    """
    items_qs = Item.objects.filter(company=company, status="ACTIVE")
    if params.get("item_ids"):
        items_qs = items_qs.filter(id__in=params["item_ids"])

    dynamic_cols = [
        {"code": "base_uom_name", "name": "ĐVT chính", "data_type": "STRING", "align": "center"},
        {"code": "base_quantity", "name": "SL tồn (ĐVT chính)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        {"code": "secondary_uom_name", "name": "ĐVT phụ", "data_type": "STRING", "align": "center"},
        {"code": "conversion_factor", "name": "Hệ số quy đổi", "data_type": "NUMBER", "align": "right"},
        {"code": "secondary_quantity", "name": "SL tồn (ĐVT phụ)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
    ]

    rows = []
    tot_base_qty = Decimal("0")
    for wh in warehouses:
        for item in items_qs:
            movements = StockMovement.objects.filter(
                company=company, warehouse=wh, item=item, movement_date__lte=to_date
            )
            base_qty = movements.aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0")
            if not params.get("include_zero_balance", True) and base_qty == 0:
                continue

            # Look up conversions
            conv = ItemUomConversion.objects.filter(item=item).first()
            sec_name = conv.to_uom.name if conv and conv.to_uom else ""
            factor = conv.factor if conv else Decimal("1")
            sec_qty = base_qty / factor if factor and factor != 0 else base_qty

            row_cols = {
                "warehouse_code": wh.code,
                "item_code": item.code,
                "item_name": item.name,
                "base_uom_name": item.base_uom.name if item.base_uom else "",
                "base_quantity": _fmt_dec(base_qty),
                "secondary_uom_name": sec_name,
                "conversion_factor": _fmt_dec(factor),
                "secondary_quantity": _fmt_dec(sec_qty),
            }

            tot_base_qty += base_qty
            rows.append({
                "row_type": "DETAIL",
                "warehouse_id": str(wh.id),
                "warehouse_name": wh.name,
                "item_id": str(item.id),
                "item_code": item.code,
                "item_name": item.name,
                "columns": row_cols,
            })

    summary = {"total_base_quantity": _fmt_dec(tot_base_qty)}
    return rows, summary, dynamic_cols, []


def _build_rpt_0146(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0146: Tổng hợp nhập xuất tồn trên nhiều kho (11 cột).
    Nhóm theo mặt hàng trên toàn bộ các kho đã chọn.
    """
    items_qs = Item.objects.filter(company=company, status="ACTIVE")
    if params.get("item_ids"):
        items_qs = items_qs.filter(id__in=params["item_ids"])

    wh_ids = [w.id for w in warehouses]
    rows = []
    tot_open_qty = Decimal("0")
    tot_open_val = Decimal("0")
    tot_rec_qty = Decimal("0")
    tot_rec_val = Decimal("0")
    tot_iss_qty = Decimal("0")
    tot_iss_val = Decimal("0")
    tot_cls_qty = Decimal("0")
    tot_cls_val = Decimal("0")

    for item in items_qs:
        movements_before = StockMovement.objects.filter(
            company=company, warehouse_id__in=wh_ids, item=item, movement_date__lt=from_date
        )
        open_qty = movements_before.aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0")
        open_val = movements_before.aggregate(s=Sum("value_delta"))["s"] or Decimal("0")

        movements_period = StockMovement.objects.filter(
            company=company, warehouse_id__in=wh_ids, item=item, movement_date__gte=from_date, movement_date__lte=to_date
        )
        rec_qty = movements_period.filter(quantity_delta__gt=0).aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0")
        rec_val = movements_period.filter(value_delta__gt=0).aggregate(s=Sum("value_delta"))["s"] or Decimal("0")
        iss_qty = abs(movements_period.filter(quantity_delta__lt=0).aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0"))
        iss_val = abs(movements_period.filter(value_delta__lt=0).aggregate(s=Sum("value_delta"))["s"] or Decimal("0"))

        cls_qty = open_qty + rec_qty - iss_qty
        cls_val = open_val + rec_val - iss_val

        if not params.get("include_zero_balance", True) and open_qty == 0 and rec_qty == 0 and iss_qty == 0 and cls_qty == 0:
            continue

        cols = {
            "item_code": item.code,
            "item_name": item.name,
            "uom_name": item.base_uom.name if item.base_uom else "",
            "opening_quantity": _fmt_dec(open_qty),
            "opening_value": _fmt_dec(open_val) if has_value_perm else None,
            "receipt_quantity": _fmt_dec(rec_qty),
            "receipt_value": _fmt_dec(rec_val) if has_value_perm else None,
            "issue_quantity": _fmt_dec(iss_qty),
            "issue_value": _fmt_dec(iss_val) if has_value_perm else None,
            "closing_quantity": _fmt_dec(cls_qty),
            "closing_value": _fmt_dec(cls_val) if has_value_perm else None,
        }

        tot_open_qty += open_qty
        tot_open_val += open_val
        tot_rec_qty += rec_qty
        tot_rec_val += rec_val
        tot_iss_qty += iss_qty
        tot_iss_val += iss_val
        tot_cls_qty += cls_qty
        tot_cls_val += cls_val

        rows.append({
            "row_type": "DETAIL",
            "item_id": str(item.id),
            "item_code": item.code,
            "item_name": item.name,
            "uom_name": item.base_uom.name if item.base_uom else "",
            "columns": cols,
        })

    summary = {
        "total_opening_quantity": _fmt_dec(tot_open_qty),
        "total_opening_value": _fmt_dec(tot_open_val) if has_value_perm else None,
        "total_receipt_quantity": _fmt_dec(tot_rec_qty),
        "total_receipt_value": _fmt_dec(tot_rec_val) if has_value_perm else None,
        "total_issue_quantity": _fmt_dec(tot_iss_qty),
        "total_issue_value": _fmt_dec(tot_iss_val) if has_value_perm else None,
        "total_closing_quantity": _fmt_dec(tot_cls_qty),
        "total_closing_value": _fmt_dec(tot_cls_val) if has_value_perm else None,
    }

    return rows, summary, [], []


def _build_rpt_0147(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0147: Tổng hợp tồn kho theo nhóm VTHH (12 cột phân cấp).
    """
    categories = ItemCategory.objects.filter(company=company)
    wh_ids = [w.id for w in warehouses]
    rows = []
    tot_cls_val = Decimal("0")
    row_idx = 1

    for cat in categories:
        items = Item.objects.filter(company=company, category=cat, status="ACTIVE")
        if not items.exists():
            continue

        # Category Header Row
        cat_open_val = Decimal("0")
        cat_rec_val = Decimal("0")
        cat_iss_val = Decimal("0")
        cat_cls_val = Decimal("0")

        cat_detail_rows = []
        for item in items:
            movements_before = StockMovement.objects.filter(
                company=company, warehouse_id__in=wh_ids, item=item, movement_date__lt=from_date
            )
            open_qty = movements_before.aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0")
            open_val = movements_before.aggregate(s=Sum("value_delta"))["s"] or Decimal("0")

            movements_period = StockMovement.objects.filter(
                company=company, warehouse_id__in=wh_ids, item=item, movement_date__gte=from_date, movement_date__lte=to_date
            )
            rec_qty = movements_period.filter(quantity_delta__gt=0).aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0")
            rec_val = movements_period.filter(value_delta__gt=0).aggregate(s=Sum("value_delta"))["s"] or Decimal("0")
            iss_qty = abs(movements_period.filter(quantity_delta__lt=0).aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0"))
            iss_val = abs(movements_period.filter(value_delta__lt=0).aggregate(s=Sum("value_delta"))["s"] or Decimal("0"))

            cls_qty = open_qty + rec_qty - iss_qty
            cls_val = open_val + rec_val - iss_val

            cat_open_val += open_val
            cat_rec_val += rec_val
            cat_iss_val += iss_val
            cat_cls_val += cls_val

            cols = {
                "row_no": str(row_idx),
                "item_code": item.code,
                "item_name": item.name,
                "uom_name": item.base_uom.name if item.base_uom else "",
                "opening_quantity": _fmt_dec(open_qty),
                "opening_value": _fmt_dec(open_val) if has_value_perm else None,
                "receipt_quantity": _fmt_dec(rec_qty),
                "receipt_value": _fmt_dec(rec_val) if has_value_perm else None,
                "issue_quantity": _fmt_dec(iss_qty),
                "issue_value": _fmt_dec(iss_val) if has_value_perm else None,
                "closing_quantity": _fmt_dec(cls_qty),
                "closing_value": _fmt_dec(cls_val) if has_value_perm else None,
            }
            row_idx += 1
            cat_detail_rows.append({
                "row_type": "DETAIL",
                "item_id": str(item.id),
                "item_code": item.code,
                "item_name": item.name,
                "category_id": str(cat.id),
                "category_name": cat.name,
                "columns": cols,
            })

        # Add Group Header for Category
        rows.append({
            "row_type": "GROUP_HEADER",
            "category_id": str(cat.id),
            "category_name": cat.name,
            "columns": {
                "row_no": "",
                "item_code": cat.code,
                "item_name": f"Nhóm: {cat.name}",
                "uom_name": "",
                "opening_quantity": None,
                "opening_value": _fmt_dec(cat_open_val) if has_value_perm else None,
                "receipt_quantity": None,
                "receipt_value": _fmt_dec(cat_rec_val) if has_value_perm else None,
                "issue_quantity": None,
                "issue_value": _fmt_dec(cat_iss_val) if has_value_perm else None,
                "closing_quantity": None,
                "closing_value": _fmt_dec(cat_cls_val) if has_value_perm else None,
            },
        })
        rows.extend(cat_detail_rows)
        tot_cls_val += cat_cls_val

    summary = {"total_closing_value": _fmt_dec(tot_cls_val) if has_value_perm else None}
    return rows, summary, [], []


def _build_rpt_0148(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0148: Báo cáo tồn theo chứng từ nhập chưa chuyển kho (10 cột).
    """
    wh_ids = [w.id for w in warehouses]
    receipt_lines = InventoryTransactionLine.objects.filter(
        transaction__company=company,
        transaction__destination_warehouse_id__in=wh_ids,
        transaction__transaction_type="RECEIPT",
        transaction__transaction_date__gte=from_date,
        transaction__transaction_date__lte=to_date,
    ).select_related("transaction", "item", "uom")

    rows = []
    tot_untransferred = Decimal("0")

    for rl in receipt_lines:
        rec_qty = rl.quantity
        # Check transfers matching this receipt
        transfers = InventoryTransactionLine.objects.filter(
            transaction__company=company,
            transaction__source_warehouse=rl.transaction.destination_warehouse,
            transaction__transaction_type="TRANSFER",
            item=rl.item,
            transaction__transaction_date__gte=rl.transaction.transaction_date,
        ).select_related("transaction")

        transferred_qty = transfers.aggregate(s=Sum("quantity"))["s"] or Decimal("0")
        rem_qty = rec_qty - transferred_qty

        if params.get("only_untransferred", True) and rem_qty <= 0:
            continue

        latest_trf = transfers.order_by("-transaction__transaction_date").first()

        cols = {
            "receipt_document_date": rl.transaction.transaction_date.isoformat(),
            "receipt_document_no": rl.transaction.number,
            "item_code": rl.item.code,
            "item_name": rl.item.name,
            "uom_name": rl.uom.name if rl.uom else "",
            "received_quantity": _fmt_dec(rec_qty),
            "transfer_document_date": latest_trf.transaction.transaction_date.isoformat() if latest_trf else "",
            "transfer_document_no": latest_trf.transaction.number if latest_trf else "",
            "transferred_quantity": _fmt_dec(transferred_qty),
            "remaining_untransferred_quantity": _fmt_dec(rem_qty),
        }
        tot_untransferred += rem_qty

        rows.append({
            "row_type": "DETAIL",
            "document_id": str(rl.transaction_id),
            "document_no": rl.transaction.number,
            "item_id": str(rl.item_id),
            "item_code": rl.item.code,
            "item_name": rl.item.name,
            "columns": cols,
        })

    summary = {"total_remaining_untransferred_quantity": _fmt_dec(tot_untransferred)}
    return rows, summary, [], []


def _build_rpt_0149(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0149: Sổ chi tiết vật tư hàng hóa (15 cột running balance).
    Running Quantity(i) = Running Quantity(i-1) + Receipt - Issue.
    """
    wh = warehouses[0] if warehouses else None
    if not wh:
        return [], {}, [], []

    item_id = params.get("item_id") or (params.get("item_ids")[0] if params.get("item_ids") else None)
    item = Item.objects.filter(company=company, id=item_id).first() if item_id else Item.objects.filter(company=company).first()
    if not item:
        return [], {}, [], []

    # Initial running balance before from_date
    prior_movs = StockMovement.objects.filter(company=company, warehouse=wh, item=item, movement_date__lt=from_date)
    running_qty = prior_movs.aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0")
    running_val = prior_movs.aggregate(s=Sum("value_delta"))["s"] or Decimal("0")

    # Movements in period ordered by movement_date, created_at
    period_movs = StockMovement.objects.filter(
        company=company, warehouse=wh, item=item, movement_date__gte=from_date, movement_date__lte=to_date
    ).select_related("transaction", "line").order_by("movement_date", "created_at")

    rows = []
    # Opening balance row
    rows.append({
        "row_type": "GROUP_HEADER",
        "warehouse_id": str(wh.id),
        "warehouse_name": wh.name,
        "item_id": str(item.id),
        "item_name": item.name,
        "columns": {
            "warehouse_name": wh.name,
            "item_name": item.name,
            "item_description": item.description or "",
            "posting_date": "",
            "document_date": "",
            "document_no": "",
            "description": "Số dư đầu kỳ",
            "uom_name": item.base_uom.name if item.base_uom else "",
            "unit_cost": None,
            "receipt_quantity": None,
            "receipt_value": None,
            "issue_quantity": None,
            "issue_value": None,
            "running_quantity": _fmt_dec(running_qty),
            "running_value": _fmt_dec(running_val) if has_value_perm else None,
        },
    })

    tot_rec_qty = Decimal("0")
    tot_rec_val = Decimal("0")
    tot_iss_qty = Decimal("0")
    tot_iss_val = Decimal("0")

    for mov in period_movs:
        is_in = mov.quantity_delta > 0
        rec_q = mov.quantity_delta if is_in else Decimal("0")
        rec_v = mov.value_delta if is_in else Decimal("0")
        iss_q = abs(mov.quantity_delta) if not is_in else Decimal("0")
        iss_v = abs(mov.value_delta) if not is_in else Decimal("0")

        running_qty = running_qty + rec_q - iss_q
        running_val = running_val + rec_v - iss_v

        tot_rec_qty += rec_q
        tot_rec_val += rec_v
        tot_iss_qty += iss_q
        tot_iss_val += iss_v

        unit_cost = (rec_v / rec_q) if (is_in and rec_q) else ((iss_v / iss_q) if (not is_in and iss_q) else Decimal("0"))

        cols = {
            "warehouse_name": wh.name,
            "item_name": item.name,
            "item_description": item.description or "",
            "posting_date": mov.movement_date.isoformat(),
            "document_date": mov.transaction.document_date.isoformat() if mov.transaction and mov.transaction.document_date else mov.movement_date.isoformat(),
            "document_no": mov.transaction.number if mov.transaction else "",
            "description": mov.transaction.reason or ("Nhập kho" if is_in else "Xuất kho"),
            "uom_name": item.base_uom.name if item.base_uom else "",
            "unit_cost": _fmt_dec(unit_cost) if has_value_perm else None,
            "receipt_quantity": _fmt_dec(rec_q) if rec_q else None,
            "receipt_value": _fmt_dec(rec_v) if (rec_v and has_value_perm) else None,
            "issue_quantity": _fmt_dec(iss_q) if iss_q else None,
            "issue_value": _fmt_dec(iss_v) if (iss_v and has_value_perm) else None,
            "running_quantity": _fmt_dec(running_qty),
            "running_value": _fmt_dec(running_val) if has_value_perm else None,
        }

        rows.append({
            "row_type": "DETAIL",
            "document_id": str(mov.transaction_id) if mov.transaction_id else "",
            "document_no": mov.transaction.number if mov.transaction else "",
            "columns": cols,
            "source_refs": [{"source_type": "StockMovement", "id": str(mov.id)}],
        })

    summary = {
        "total_receipt_quantity": _fmt_dec(tot_rec_qty),
        "total_receipt_value": _fmt_dec(tot_rec_val) if has_value_perm else None,
        "total_issue_quantity": _fmt_dec(tot_iss_qty),
        "total_issue_value": _fmt_dec(tot_iss_val) if has_value_perm else None,
        "final_running_quantity": _fmt_dec(running_qty),
        "final_running_value": _fmt_dec(running_val) if has_value_perm else None,
    }

    return rows, summary, [], []


def _build_rpt_0150(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0150: Sổ chuyển kho nội bộ (11 cột).
    """
    wh_ids = [w.id for w in warehouses]
    transfers = InventoryTransaction.objects.filter(
        company=company,
        transaction_type="TRANSFER",
        transaction_date__gte=from_date,
        transaction_date__lte=to_date,
    ).filter(Q(source_warehouse_id__in=wh_ids) | Q(destination_warehouse_id__in=wh_ids)).select_related("source_warehouse", "destination_warehouse")

    rows = []
    tot_qty = Decimal("0")
    tot_amt = Decimal("0")

    for t in transfers:
        for line in t.lines.all().select_related("item", "uom"):
            cols = {
                "document_date": t.transaction_date.isoformat(),
                "document_no": t.number,
                "item_code": line.item.code,
                "item_name": line.item.name,
                "from_warehouse_name": t.source_warehouse.name if t.source_warehouse else "",
                "to_warehouse_name": t.destination_warehouse.name if t.destination_warehouse else "",
                "uom_name": line.uom.name if line.uom else "",
                "transfer_quantity": _fmt_dec(line.quantity),
                "transfer_unit_cost": _fmt_dec(line.unit_cost) if has_value_perm else None,
                "transfer_amount": _fmt_dec(line.line_value) if has_value_perm else None,
                "document_type_name": "Chuyển kho nội bộ",
            }
            tot_qty += line.quantity
            tot_amt += line.line_value

            rows.append({
                "row_type": "DETAIL",
                "document_id": str(t.id),
                "document_no": t.number,
                "item_id": str(line.item_id),
                "item_code": line.item.code,
                "item_name": line.item.name,
                "columns": cols,
            })

    summary = {
        "total_transfer_quantity": _fmt_dec(tot_qty),
        "total_transfer_amount": _fmt_dec(tot_amt) if has_value_perm else None,
    }
    return rows, summary, [], []


def _build_rpt_0151(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0151: Báo cáo tiến độ sản xuất (6 cột).
    """
    p_orders = ProductionOrder.objects.filter(company=company, document_date__gte=from_date, document_date__lte=to_date)
    if params.get("manufacturing_order_ids"):
        p_orders = p_orders.filter(id__in=params["manufacturing_order_ids"])

    validations = []
    if not p_orders.exists():
        validations.append({
            "check_code": "INFO_NO_PRODUCTION_ORDERS",
            "check_name": "Không có lệnh sản xuất",
            "severity": "INFO",
            "status": "PASSED",
            "message": "Không có lệnh sản xuất trong kỳ (TC-RPT-12-64).",
        })

    rows = []
    tot_req = Decimal("0")
    tot_prod = Decimal("0")
    tot_diff = Decimal("0")

    for po in p_orders:
        for line in po.lines.filter(role="PRODUCT").select_related("item"):
            req_q = line.quantity or Decimal("0")
            # Calculate produced quantity from linked finished good receipts
            receipts = InventoryTransactionLine.objects.filter(
                transaction__company=company,
                transaction__transaction_type="RECEIPT",
                transaction__source_reference=po.number,
                item=line.item,
            )
            prod_q = receipts.aggregate(s=Sum("quantity"))["s"] or Decimal("0")
            diff_q = req_q - prod_q

            cols = {
                "finished_item_code": line.item.code,
                "finished_item_name": line.item.name,
                "uom_name": line.item.base_uom.name if line.item.base_uom else "",
                "required_quantity": _fmt_dec(req_q),
                "produced_quantity": _fmt_dec(prod_q),
                "quantity_difference": _fmt_dec(diff_q),
            }
            tot_req += req_q
            tot_prod += prod_q
            tot_diff += diff_q

            rows.append({
                "row_type": "DETAIL",
                "production_order_id": str(po.id),
                "document_no": po.number,
                "item_id": str(line.item_id),
                "item_code": line.item.code,
                "item_name": line.item.name,
                "columns": cols,
            })

    summary = {
        "total_required_quantity": _fmt_dec(tot_req),
        "total_produced_quantity": _fmt_dec(tot_prod),
        "total_quantity_difference": _fmt_dec(tot_diff),
    }
    return rows, summary, [], validations


def _build_rpt_0152(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0152: Tổng hợp xuất kho theo lệnh sản xuất (12 cột).
    """
    p_orders = ProductionOrder.objects.filter(company=company, document_date__gte=from_date, document_date__lte=to_date)
    if params.get("manufacturing_order_ids"):
        p_orders = p_orders.filter(id__in=params["manufacturing_order_ids"])

    rows = []
    tot_actual_used = Decimal("0")

    for po in p_orders:
        finished_line = po.lines.filter(role="PRODUCT").first()
        std_fg_qty = finished_line.quantity if finished_line else Decimal("0")

        material_lines = po.lines.filter(role="MATERIAL").select_related("item")
        for m in material_lines:
            std_mat_qty = m.quantity or Decimal("0")

            # Period issued / returned
            issued_movs_period = InventoryTransactionLine.objects.filter(
                transaction__company=company,
                transaction__transaction_type="ISSUE",
                transaction__source_reference=po.number,
                transaction__transaction_date__gte=from_date,
                transaction__transaction_date__lte=to_date,
                item=m.item,
            )
            iss_q_p = issued_movs_period.aggregate(s=Sum("quantity"))["s"] or Decimal("0")

            ret_movs_period = InventoryTransactionLine.objects.filter(
                transaction__company=company,
                transaction__transaction_type="RETURN",
                transaction__source_reference=po.number,
                transaction__transaction_date__gte=from_date,
                transaction__transaction_date__lte=to_date,
                item=m.item,
            )
            ret_q_p = ret_movs_period.aggregate(s=Sum("quantity"))["s"] or Decimal("0")
            actual_used_p = iss_q_p - ret_q_p

            # Cumulative issued / returned
            issued_movs_cum = InventoryTransactionLine.objects.filter(
                transaction__company=company,
                transaction__transaction_type="ISSUE",
                transaction__source_reference=po.number,
                transaction__transaction_date__lte=to_date,
                item=m.item,
            )
            iss_q_c = issued_movs_cum.aggregate(s=Sum("quantity"))["s"] or Decimal("0")

            ret_movs_cum = InventoryTransactionLine.objects.filter(
                transaction__company=company,
                transaction__transaction_type="RETURN",
                transaction__source_reference=po.number,
                transaction__transaction_date__lte=to_date,
                item=m.item,
            )
            ret_q_c = ret_movs_cum.aggregate(s=Sum("quantity"))["s"] or Decimal("0")
            actual_used_c = iss_q_c - ret_q_c
            variance_q = actual_used_c - std_mat_qty

            cols = {
                "standard_finished_quantity": _fmt_dec(std_fg_qty),
                "material_code": m.item.code,
                "material_name": m.item.name,
                "uom_name": m.item.base_uom.name if m.item.base_uom else "",
                "standard_material_quantity": _fmt_dec(std_mat_qty),
                "issued_quantity_period": _fmt_dec(iss_q_p),
                "returned_quantity_period": _fmt_dec(ret_q_p),
                "actual_used_period": _fmt_dec(actual_used_p),
                "issued_quantity_cumulative": _fmt_dec(iss_q_c),
                "returned_quantity_cumulative": _fmt_dec(ret_q_c),
                "actual_used_cumulative": _fmt_dec(actual_used_c),
                "material_variance_quantity": _fmt_dec(variance_q),
            }
            tot_actual_used += actual_used_p

            rows.append({
                "row_type": "DETAIL",
                "production_order_id": str(po.id),
                "document_no": po.number,
                "item_id": str(m.item_id),
                "item_code": m.item.code,
                "item_name": m.item.name,
                "columns": cols,
            })

    summary = {"total_actual_used_period": _fmt_dec(tot_actual_used)}
    return rows, summary, [], []


def _build_rpt_0153(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0153: Báo cáo đối chiếu kho và sổ cái (11 cột).
    Đối chiếu phát sinh & số dư TK 152, 153, 155, 156, 157 với Sổ kho.
    """
    # Find GL inventory accounts (151, 152, 153, 155, 156, 157, 158)
    accounts = Account.objects.filter(
        company=company,
        code__regex=r"^15[1-8]",
    ).order_by("code")

    if params.get("account_ids"):
        accounts = accounts.filter(id__in=params["account_ids"])

    wh_ids = [w.id for w in warehouses]
    rows = []
    validations = []
    has_diff = False

    tot_gl_dr = Decimal("0")
    tot_gl_cr = Decimal("0")
    tot_gl_bal = Decimal("0")
    tot_inv_rec = Decimal("0")
    tot_inv_iss = Decimal("0")
    tot_inv_cls = Decimal("0")
    tot_diff = Decimal("0")

    period_label = f"{from_date.strftime('%d/%m/%Y')} - {to_date.strftime('%d/%m/%Y')}"

    for acc in accounts:
        # GL Movements
        gl_lines_period = JournalLine.objects.filter(
            entry__company=company,
            entry__status="POSTED",
            account=acc,
            entry__posting_date__gte=from_date,
            entry__posting_date__lte=to_date,
        )
        gl_dr = gl_lines_period.aggregate(s=Sum("debit"))["s"] or Decimal("0")
        gl_cr = gl_lines_period.aggregate(s=Sum("credit"))["s"] or Decimal("0")

        gl_lines_all = JournalLine.objects.filter(
            entry__company=company,
            entry__status="POSTED",
            account=acc,
            entry__posting_date__lte=to_date,
        )
        gl_bal = (gl_lines_all.aggregate(s=Sum("debit"))["s"] or Decimal("0")) - (
            gl_lines_all.aggregate(s=Sum("credit"))["s"] or Decimal("0")
        )

        # Inventory movements for items mapped to this account or transaction debit/credit lines
        inv_lines_dr = InventoryTransactionLine.objects.filter(
            transaction__company=company,
            transaction__destination_warehouse_id__in=wh_ids,
            debit_account=acc,
            transaction__transaction_date__gte=from_date,
            transaction__transaction_date__lte=to_date,
        )
        inv_rec_val = inv_lines_dr.aggregate(s=Sum("line_value"))["s"] or Decimal("0")

        inv_lines_cr = InventoryTransactionLine.objects.filter(
            transaction__company=company,
            transaction__source_warehouse_id__in=wh_ids,
            credit_account=acc,
            transaction__transaction_date__gte=from_date,
            transaction__transaction_date__lte=to_date,
        )
        inv_iss_val = inv_lines_cr.aggregate(s=Sum("line_value"))["s"] or Decimal("0")

        # Closing stock value up to to_date
        all_movs = StockMovement.objects.filter(
            company=company,
            warehouse_id__in=wh_ids,
            movement_date__lte=to_date,
            line__debit_account=acc,
        )
        inv_cls_val = all_movs.aggregate(s=Sum("value_delta"))["s"] or Decimal("0")

        diff_dr = gl_dr - inv_rec_val
        diff_cr = gl_cr - inv_iss_val
        diff_bal = gl_bal - inv_cls_val

        if diff_bal != 0 or diff_dr != 0 or diff_cr != 0:
            has_diff = True

        if params.get("only_discrepancies", False) and diff_bal == 0 and diff_dr == 0 and diff_cr == 0:
            continue

        detail_text = []
        if diff_dr != 0:
            detail_text.append(f"Lệch phát sinh Nợ: {_fmt_dec(diff_dr)}")
        if diff_cr != 0:
            detail_text.append(f"Lệch phát sinh Có: {_fmt_dec(diff_cr)}")
        if diff_bal != 0:
            detail_text.append(f"Lệch số dư cuối: {_fmt_dec(diff_bal)}")

        cols = {
            "reconciliation_period": f"{acc.code} - {acc.name}",
            "gl_debit_movement": _fmt_dec(gl_dr) if has_value_perm else None,
            "gl_credit_movement": _fmt_dec(gl_cr) if has_value_perm else None,
            "gl_closing_balance": _fmt_dec(gl_bal) if has_value_perm else None,
            "inventory_receipt_value": _fmt_dec(inv_rec_val) if has_value_perm else None,
            "inventory_issue_value": _fmt_dec(inv_iss_val) if has_value_perm else None,
            "inventory_closing_value": _fmt_dec(inv_cls_val) if has_value_perm else None,
            "debit_receipt_difference": _fmt_dec(diff_dr) if has_value_perm else None,
            "credit_issue_difference": _fmt_dec(diff_cr) if has_value_perm else None,
            "closing_balance_difference": _fmt_dec(diff_bal) if has_value_perm else None,
            "difference_detail": "; ".join(detail_text) if detail_text else "Khớp hoàn toàn",
        }

        tot_gl_dr += gl_dr
        tot_gl_cr += gl_cr
        tot_gl_bal += gl_bal
        tot_inv_rec += inv_rec_val
        tot_inv_iss += inv_iss_val
        tot_inv_cls += inv_cls_val
        tot_diff += diff_bal

        rows.append({
            "row_type": "DETAIL",
            "gl_account_code": acc.code,
            "columns": cols,
            "warning_codes": ["WARN_GL_STOCK_DIFF"] if diff_bal != 0 else [],
        })

    if has_diff:
        validations.append({
            "check_code": "WARN_GL_STOCK_DIFF",
            "check_name": "Phát sinh chênh lệch Sổ cái và Sổ kho",
            "severity": "WARNING",
            "status": "WARNING",
            "message": "Có sự khác biệt giữa số dư / phát sinh kế toán và dữ liệu kho (TC-RPT-12-71..73).",
        })

    summary = {
        "total_gl_closing_balance": _fmt_dec(tot_gl_bal) if has_value_perm else None,
        "total_inventory_closing_value": _fmt_dec(tot_inv_cls) if has_value_perm else None,
        "total_closing_difference": _fmt_dec(tot_diff) if has_value_perm else None,
    }

    return rows, summary, [], validations


def _build_rpt_0154(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0154: Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng (11 cột).
    """
    costs = PurchaseCost.objects.filter(
        company=company, document_date__gte=from_date, document_date__lte=to_date
    ).prefetch_related("lines")

    rows = []
    tot_cost = Decimal("0")
    tot_alloc = Decimal("0")
    tot_diff = Decimal("0")

    for cost in costs:
        cost_lines = cost.lines.all()
        for cl in cost_lines:
            c_amt = cl.total_amount
            a_amt = cl.allocated_amount or Decimal("0")
            diff = c_amt - a_amt

            if params.get("only_unallocated", False) and diff <= 0:
                continue

            # Link to related GoodsPurchase if any
            related_gp = cost.related_goods_purchases.first()

            cols = {
                "cost_document_posting_date": cost.posting_date.isoformat() if cost.posting_date else cost.document_date.isoformat(),
                "cost_document_date": cost.document_date.isoformat(),
                "cost_document_no": cost.number,
                "cost_account_code": cl.account.code if cl.account else "1562",
                "cost_document_amount": _fmt_dec(c_amt) if has_value_perm else None,
                "purchase_document_posting_date": related_gp.posting_date.isoformat() if related_gp and related_gp.posting_date else "",
                "purchase_document_date": related_gp.document_date.isoformat() if related_gp else "",
                "purchase_document_no": related_gp.number if related_gp else "",
                "purchase_account_code": "1561",
                "allocated_cost_amount": _fmt_dec(a_amt) if has_value_perm else None,
                "difference_amount": _fmt_dec(diff) if has_value_perm else None,
            }

            tot_cost += c_amt
            tot_alloc += a_amt
            tot_diff += diff

            rows.append({
                "row_type": "DETAIL",
                "document_id": str(cost.id),
                "document_no": cost.number,
                "columns": cols,
            })

    summary = {
        "total_cost_document_amount": _fmt_dec(tot_cost) if has_value_perm else None,
        "total_allocated_cost_amount": _fmt_dec(tot_alloc) if has_value_perm else None,
        "total_difference_amount": _fmt_dec(tot_diff) if has_value_perm else None,
    }

    return rows, summary, [], []


def _build_rpt_0155(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0155: Đối chiếu nhập xuất giữa kế toán và thủ kho (13 cột).
    """
    wh_ids = [w.id for w in warehouses]
    txns = InventoryTransaction.objects.filter(
        company=company,
        transaction_date__gte=from_date,
        transaction_date__lte=to_date,
    ).filter(Q(source_warehouse_id__in=wh_ids) | Q(destination_warehouse_id__in=wh_ids)).select_related("journal_entry").prefetch_related("lines__item", "lines__uom")

    rows = []
    tot_acc_rec = Decimal("0")
    tot_wh_rec = Decimal("0")
    tot_acc_iss = Decimal("0")
    tot_wh_iss = Decimal("0")

    for t in txns:
        # Accounting date vs warehouse book date
        wh_date = t.transaction_date
        post_date = t.posted_at.date() if t.posted_at else wh_date

        for line in t.lines.all():
            is_in = t.transaction_type in {"RECEIPT", "RETURN", "ADJUSTMENT_IN"}
            # Sổ kho quantity
            wh_rec_q = line.quantity if is_in else Decimal("0")
            wh_iss_q = line.quantity if not is_in else Decimal("0")

            # Sổ kế toán quantity (only counted if GL status is POSTED or journal_entry is present)
            is_posted = t.gl_status == "POSTED" or t.journal_entry_id is not None
            acc_rec_q = line.quantity if (is_in and is_posted) else Decimal("0")
            acc_iss_q = line.quantity if (not is_in and is_posted) else Decimal("0")

            rec_diff = acc_rec_q - wh_rec_q
            iss_diff = acc_iss_q - wh_iss_q

            cols = {
                "item_name": line.item.name,
                "posting_date": post_date.isoformat(),
                "document_date": t.document_date.isoformat() if t.document_date else wh_date.isoformat(),
                "warehouse_book_date": wh_date.isoformat(),
                "document_no": t.number,
                "description": t.reason or ("Nhập kho" if is_in else "Xuất kho"),
                "uom_name": line.uom.name if line.uom else "",
                "accounting_receipt_quantity": _fmt_dec(acc_rec_q),
                "warehouse_receipt_quantity": _fmt_dec(wh_rec_q),
                "receipt_difference": _fmt_dec(rec_diff),
                "accounting_issue_quantity": _fmt_dec(acc_iss_q),
                "warehouse_issue_quantity": _fmt_dec(wh_iss_q),
                "issue_difference": _fmt_dec(iss_diff),
            }

            tot_acc_rec += acc_rec_q
            tot_wh_rec += wh_rec_q
            tot_acc_iss += acc_iss_q
            tot_wh_iss += wh_iss_q

            rows.append({
                "row_type": "DETAIL",
                "document_id": str(t.id),
                "document_no": t.number,
                "item_id": str(line.item_id),
                "item_name": line.item.name,
                "columns": cols,
            })

    summary = {
        "total_accounting_receipt_quantity": _fmt_dec(tot_acc_rec),
        "total_warehouse_receipt_quantity": _fmt_dec(tot_wh_rec),
        "total_receipt_difference": _fmt_dec(tot_acc_rec - tot_wh_rec),
        "total_accounting_issue_quantity": _fmt_dec(tot_acc_iss),
        "total_warehouse_issue_quantity": _fmt_dec(tot_wh_iss),
        "total_issue_difference": _fmt_dec(tot_acc_iss - tot_wh_iss),
    }

    return rows, summary, [], []


def _build_rpt_0156(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0156: Báo cáo đối chiếu giá thành và giá trị nhập kho (10 cột).
    """
    # Valuation runs or production receipts
    v_runs = ValuationRun.objects.filter(
        company=company, valuation_date__gte=from_date, valuation_date__lte=to_date
    )

    rows = []
    tot_cost = Decimal("0")
    tot_rec = Decimal("0")
    tot_diff = Decimal("0")

    # Group completed products from production orders
    p_orders = ProductionOrder.objects.filter(company=company, document_date__gte=from_date, document_date__lte=to_date)
    for po in p_orders:
        for line in po.lines.filter(role="PRODUCT").select_related("item"):
            cost_qty = line.quantity or Decimal("0")
            unit_cost = Decimal("100000.00")  # Standard costing base
            tot_prod_cost = cost_qty * unit_cost

            # Finished goods receipts
            rec_lines = InventoryTransactionLine.objects.filter(
                transaction__company=company,
                transaction__transaction_type="RECEIPT",
                transaction__source_reference=po.number,
                item=line.item,
            )
            wh_qty = rec_lines.aggregate(s=Sum("quantity"))["s"] or Decimal("0")
            wh_val = rec_lines.aggregate(s=Sum("line_value"))["s"] or Decimal("0")
            wh_unit = (wh_val / wh_qty) if wh_qty else Decimal("0")
            diff = tot_prod_cost - wh_val

            if params.get("only_discrepancies", False) and diff == 0:
                continue

            cols = {
                "finished_item_code": line.item.code,
                "finished_item_name": line.item.name,
                "costing_finished_quantity": _fmt_dec(cost_qty),
                "unit_production_cost": _fmt_dec(unit_cost) if has_value_perm else None,
                "total_production_cost": _fmt_dec(tot_prod_cost) if has_value_perm else None,
                "warehouse_receipt_quantity": _fmt_dec(wh_qty),
                "warehouse_receipt_unit_cost": _fmt_dec(wh_unit) if has_value_perm else None,
                "warehouse_receipt_value": _fmt_dec(wh_val) if has_value_perm else None,
                "cost_warehouse_difference": _fmt_dec(diff) if has_value_perm else None,
                "note": f"Theo lệnh {po.number}",
            }

            tot_cost += tot_prod_cost
            tot_rec += wh_val
            tot_diff += diff

            rows.append({
                "row_type": "DETAIL",
                "production_order_id": str(po.id),
                "document_no": po.number,
                "item_id": str(line.item_id),
                "item_code": line.item.code,
                "item_name": line.item.name,
                "columns": cols,
            })

    summary = {
        "total_production_cost": _fmt_dec(tot_cost) if has_value_perm else None,
        "total_warehouse_receipt_value": _fmt_dec(tot_rec) if has_value_perm else None,
        "total_cost_warehouse_difference": _fmt_dec(tot_diff) if has_value_perm else None,
    }

    return rows, summary, [], []


def _build_rpt_0157(company, warehouses, from_date, to_date, params, has_value_perm, user, request):
    """
    RPT-0157: Đối chiếu giá trị nhập, xuất kho của lệnh lắp ráp, tháo dỡ (10 cột).
    """
    orders = AssemblyOrder.objects.filter(
        company=company, assembly_date__gte=from_date, assembly_date__lte=to_date
    ).prefetch_related("lines")

    if params.get("assembly_order_ids"):
        orders = orders.filter(id__in=params["assembly_order_ids"])

    rows = []
    tot_rec = Decimal("0")
    tot_iss = Decimal("0")
    tot_diff = Decimal("0")

    for ord in orders:
        lines = ord.lines.all()
        # In ASSEMBLE: components are issued (Xuất), outputs are received (Nhập)
        # In DISASSEMBLE: items dismantled are issued, parts are received
        comp_val = sum((l.quantity * l.unit_cost for l in lines if l.role == "COMPONENT"), Decimal("0"))
        out_val = sum((l.quantity * l.unit_cost for l in lines if l.role == "OUTPUT"), Decimal("0"))

        if ord.operation == "ASSEMBLE":
            rec_val = out_val
            iss_val = comp_val
            doc_type = "Lắp ráp"
        else:
            rec_val = comp_val
            iss_val = out_val
            doc_type = "Tháo dỡ"

        diff = rec_val - iss_val

        if params.get("only_discrepancies", False) and diff == 0:
            continue

        cols = {
            "assembly_document_date": ord.assembly_date.isoformat(),
            "assembly_order_no": ord.number,
            "receipt_document_date": ord.assembly_date.isoformat(),
            "receipt_document_no": f"PN-{ord.number}",
            "receipt_value": _fmt_dec(rec_val) if has_value_perm else None,
            "issue_document_date": ord.assembly_date.isoformat(),
            "issue_document_no": f"PX-{ord.number}",
            "issue_value": _fmt_dec(iss_val) if has_value_perm else None,
            "difference_amount": _fmt_dec(diff) if has_value_perm else None,
            "document_type_name": doc_type,
        }

        tot_rec += rec_val
        tot_iss += iss_val
        tot_diff += diff

        rows.append({
            "row_type": "DETAIL",
            "assembly_order_id": str(ord.id),
            "document_no": ord.number,
            "columns": cols,
        })

    summary = {
        "total_receipt_value": _fmt_dec(tot_rec) if has_value_perm else None,
        "total_issue_value": _fmt_dec(tot_iss) if has_value_perm else None,
        "total_difference_amount": _fmt_dec(tot_diff) if has_value_perm else None,
    }

    return rows, summary, [], []


REPORT_BUILDERS = {
    "RPT-0143": _build_rpt_0143,
    "RPT-0144": _build_rpt_0144,
    "RPT-0145": _build_rpt_0145,
    "RPT-0146": _build_rpt_0146,
    "RPT-0147": _build_rpt_0147,
    "RPT-0148": _build_rpt_0148,
    "RPT-0149": _build_rpt_0149,
    "RPT-0150": _build_rpt_0150,
    "RPT-0151": _build_rpt_0151,
    "RPT-0152": _build_rpt_0152,
    "RPT-0153": _build_rpt_0153,
    "RPT-0154": _build_rpt_0154,
    "RPT-0155": _build_rpt_0155,
    "RPT-0156": _build_rpt_0156,
    "RPT-0157": _build_rpt_0157,
}


# -----------------------------------------------------------------------------
# Read Run Details, Rows, Validations, Drilldown, Export & Saved Filters
# -----------------------------------------------------------------------------

def get_inventory_report_run_details(run_id: str, user=None, request=None) -> dict[str, Any]:
    run = InventoryReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError({"run_id": f"Không tìm thấy bản kết quả báo cáo {run_id}"})

    meta = INVENTORY_REPORT_SCHEMAS.get(run.report_code, {})
    req_perm = meta.get("required_permission", PERM_INVENTORY_VIEW)
    if not user_has_inventory_permission(user, request, req_perm):
        raise PermissionDenied("Không có quyền xem chi tiết báo cáo này.")

    # Check for stale: new transactions or posted journal entries created after run.generated_at
    is_stale = run.is_stale
    if not is_stale:
        new_tx = InventoryTransaction.objects.filter(
            company_id=run.company_id, created_at__gt=run.generated_at
        ).exists()
        new_je = JournalEntry.objects.filter(
            company_id=run.company_id, status="POSTED", created_at__gt=run.generated_at
        ).exists()
        if new_tx or new_je:
            is_stale = True

    return {
        "id": str(run.id),
        "run_number": run.run_number,
        "report_code": run.report_code,
        "report_name": run.report_name,
        "inventory_source_type": run.inventory_source_type,
        "report_category_type": run.report_category_type,
        "company_id": run.company_id,
        "from_date": run.from_date.isoformat() if run.from_date else None,
        "to_date": run.to_date.isoformat() if run.to_date else None,
        "as_of_date": run.as_of_date.isoformat() if run.as_of_date else None,
        "parameters": run.parameters,
        "summary": run.summary_payload,
        "dynamic_columns": run.dynamic_columns,
        "row_count": run.row_count,
        "warning_count": run.warning_count,
        "is_stale": is_stale,
        "generated_by": run.generated_by,
        "generated_at": run.generated_at.isoformat(),
    }


def get_inventory_report_run_rows(run_id: str, user=None, request=None, search: str = None) -> dict[str, Any]:
    run = InventoryReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError({"run_id": f"Không tìm thấy bản báo cáo {run_id}"})

    meta = INVENTORY_REPORT_SCHEMAS.get(run.report_code, {})
    req_perm = meta.get("required_permission", PERM_INVENTORY_VIEW)
    if not user_has_inventory_permission(user, request, req_perm):
        raise PermissionDenied("Không có quyền xem dòng báo cáo.")

    qs = run.rows.all().order_by("row_order")
    if search:
        qs = qs.filter(Q(item_code__icontains=search) | Q(item_name__icontains=search) | Q(document_no__icontains=search))

    has_value_perm = user_has_inventory_permission(user, request, PERM_INVENTORY_VALUE_VIEW)

    rows = []
    for r in qs:
        cols = dict(r.columns_payload)
        if not has_value_perm:
            for k in list(cols.keys()):
                if any(sub in k for sub in ["value", "cost", "amount"]):
                    cols[k] = None

        rows.append({
            "id": r.id,
            "row_order": r.row_order,
            "row_type": r.row_type,
            "warehouse_id": r.warehouse_id,
            "warehouse_name": r.warehouse_name,
            "item_id": r.item_id,
            "item_code": r.item_code,
            "item_name": r.item_name,
            "uom_name": r.uom_name,
            "document_id": r.document_id,
            "document_no": r.document_no,
            "columns": cols,
            "source_refs": r.source_refs,
            "warning_codes": r.warning_codes,
        })

    return {"run_id": str(run.id), "count": len(rows), "rows": rows}


def get_inventory_report_run_summary(run_id: str, user=None, request=None) -> dict[str, Any]:
    run = InventoryReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError({"run_id": f"Không tìm thấy bản báo cáo {run_id}"})
    return {"run_id": str(run.id), "summary": run.summary_payload}


def get_inventory_report_run_validation(run_id: str, user=None, request=None) -> dict[str, Any]:
    run = InventoryReportRun.objects.filter(id=run_id).first()
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


def get_inventory_report_row_sources(run_id: str, row_id: int, user=None, request=None) -> dict[str, Any]:
    row = InventoryReportRow.objects.filter(run_id=run_id, id=row_id).first()
    if not row:
        raise ValidationError({"row_id": f"Không tìm thấy dòng báo cáo {row_id}"})

    sources = []
    # If document_id exists
    if row.document_id:
        tx = InventoryTransaction.objects.filter(id=row.document_id).first()
        if tx:
            sources.append({
                "type": "InventoryTransaction",
                "id": str(tx.id),
                "number": tx.number,
                "date": tx.transaction_date.isoformat(),
                "status": tx.status,
                "total_value": _fmt_dec(tx.total_value),
            })
    if row.production_order_id:
        po = ProductionOrder.objects.filter(id=row.production_order_id).first()
        if po:
            sources.append({
                "type": "ProductionOrder",
                "id": str(po.id),
                "number": po.number,
                "status": po.status,
            })
    if row.assembly_order_id:
        ao = AssemblyOrder.objects.filter(id=row.assembly_order_id).first()
        if ao:
            sources.append({
                "type": "AssemblyOrder",
                "id": str(ao.id),
                "number": ao.number,
                "status": ao.status,
            })

    return {"row_id": row.id, "sources": sources}


def get_inventory_report_run_history(run_id: str, user=None, request=None) -> dict[str, Any]:
    run = InventoryReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError({"run_id": f"Không tìm thấy bản báo cáo {run_id}"})

    runs = InventoryReportRun.objects.filter(
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


def get_inventory_balances_as_of(company_id: str, as_of_date_str: str = None, user=None, request=None) -> dict[str, Any]:
    as_of = parse_date_param(as_of_date_str) or timezone.now().date()
    company = Company.objects.filter(id=company_id).first()
    if not company:
        raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ"})

    warehouses = resolve_warehouse_scope(company, user, request, {})
    wh_ids = [w.id for w in warehouses]

    balances = []
    items = Item.objects.filter(company=company, status="ACTIVE")
    tot_qty = Decimal("0")
    tot_val = Decimal("0")

    for item in items:
        movs = StockMovement.objects.filter(company=company, warehouse_id__in=wh_ids, item=item, movement_date__lte=as_of)
        q = movs.aggregate(s=Sum("quantity_delta"))["s"] or Decimal("0")
        v = movs.aggregate(s=Sum("value_delta"))["s"] or Decimal("0")
        if q == 0 and v == 0:
            continue
        tot_qty += q
        tot_val += v
        balances.append({
            "item_id": str(item.id),
            "item_code": item.code,
            "item_name": item.name,
            "uom_name": item.base_uom.name if item.base_uom else "",
            "balance_quantity": _fmt_dec(q),
            "balance_value": _fmt_dec(v),
        })

    return {
        "company_id": str(company.id),
        "as_of_date": as_of.isoformat(),
        "total_quantity": _fmt_dec(tot_qty),
        "total_value": _fmt_dec(tot_val),
        "balances": balances,
    }


def export_inventory_report_run_payload(run_id: str, fmt: str = "XLSX", user=None, request=None) -> dict[str, Any]:
    if not user_has_inventory_permission(user, request, PERM_INVENTORY_EXPORT):
        raise PermissionDenied("Không có quyền xuất dữ liệu báo cáo kho (PERM_INVENTORY_EXPORT).")

    run = InventoryReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError({"run_id": f"Không tìm thấy bản báo cáo {run_id}"})

    export_url = f"/api/v1/reports/inventory/runs/{run.id}/download?format={fmt.lower()}"
    return {
        "run_id": str(run.id),
        "format": fmt.upper(),
        "export_status": "READY",
        "file_name": f"{run.report_code}_{run.run_number}.{fmt.lower()}",
        "download_url": export_url,
    }


def list_inventory_saved_filters_payload(report_code: str = None, user=None, request=None) -> dict[str, Any]:
    company_id, _ = resolve_inventory_company_scope(request, {})
    qs = InventorySavedFilter.objects.filter(company_id=company_id)
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


def save_inventory_filter_payload(data: dict[str, Any], user=None, request=None) -> dict[str, Any]:
    company_id, _ = resolve_inventory_company_scope(request, data)
    report_code = data.get("report_code")
    filter_name = data.get("filter_name")
    if not report_code or not filter_name:
        raise ValidationError("report_code và filter_name là bắt buộc.")

    params = data.get("parameters", {})
    is_default = bool(data.get("is_default", False))

    flt, created = InventorySavedFilter.objects.update_or_create(
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
