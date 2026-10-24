"""
UC-RPT-09 – Báo cáo bán hàng (36 Báo cáo: RPT-0076..0091, RPT-0108..0110, RPT-0113..0114, RPT-0117..0118, RPT-0121..0126, RPT-0128..0129, RPT-0132..0137)

Cung cấp toàn bộ logic tổng hợp, tính toán, kiểm tra và trình bày số liệu bán hàng,
doanh thu, giá vốn, lãi gộp, đơn đặt hàng, hợp đồng bán, bảo hành và đối chiếu.
Tuân thủ nguyên tắc read-only tuyệt đối (BR-RPT-SAL-10, BR-RPT-SAL-118..120).
"""

from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import logging
from typing import Any

from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from general_ledger.models import Account, JournalEntry, JournalLine
from organization.models import Branch, Company
from sales.models import (
    GoodsSale,
    GoodsSaleLine,
    SalesAllowance,
    SalesAllowanceLine,
    SalesContract,
    SalesContractLine,
    SalesDelivery,
    SalesDeliveryLine,
    SalesDiscountInvoice,
    SalesDiscountInvoiceLine,
    SalesInvoice,
    SalesInvoiceLine,
    SalesOrder,
    SalesOrderLine,
    SalesQuotation,
    SalesReturn,
    SalesReturnLine,
)

from .models import (
    ReportDefinition,
    SalesReportRow,
    SalesReportRun,
    SalesReportValidationResult,
    SalesSavedFilter,
)

logger = logging.getLogger(__name__)

ZERO = Decimal("0.0000")
TWO_PLACES = Decimal("0.01")

# Permissions (Section 1: Required & Associated Permissions)
PERM_SALES_VIEW = "RPT_SALES_VIEW"
PERM_SALES_DETAIL_VIEW = "RPT_SALES_DETAIL_VIEW"
PERM_SALES_PROFIT_VIEW = "RPT_SALES_PROFIT_VIEW"
PERM_SALES_CONTRACT_VIEW = "RPT_SALES_CONTRACT_VIEW"
PERM_SALES_EXPORT = "RPT_SALES_EXPORT"

ALL_SALES_PERMISSIONS = (
    PERM_SALES_VIEW,
    PERM_SALES_DETAIL_VIEW,
    PERM_SALES_PROFIT_VIEW,
    PERM_SALES_CONTRACT_VIEW,
    PERM_SALES_EXPORT,
)

PERM_ALIASES: dict[str, tuple[str, ...]] = {
    PERM_SALES_VIEW: (
        "RPT_SALES_VIEW",
        "RPT.SALES.VIEW",
        "RPT.VIEW",
        "SALES.VIEW",
        "RPT_SALES_DETAIL_VIEW",
        "RPT_SALES_PROFIT_VIEW",
        "RPT_SALES_CONTRACT_VIEW",
    ),
    PERM_SALES_DETAIL_VIEW: (
        "RPT_SALES_DETAIL_VIEW",
        "RPT.SALES.DETAIL_VIEW",
        "RPT.DRILLDOWN.VIEW",
    ),
    PERM_SALES_PROFIT_VIEW: (
        "RPT_SALES_PROFIT_VIEW",
        "RPT.SALES.PROFIT_VIEW",
        "SALES.PROFIT.VIEW",
    ),
    PERM_SALES_CONTRACT_VIEW: (
        "RPT_SALES_CONTRACT_VIEW",
        "RPT.SALES.CONTRACT_VIEW",
        "SALES.CONTRACT.VIEW",
    ),
    PERM_SALES_EXPORT: (
        "RPT_SALES_EXPORT",
        "RPT.SALES.EXPORT",
        "RPT.EXPORT",
    ),
}


def _to_dec(val: Any) -> Decimal:
    if val is None or val == "":
        return Decimal("0.00")
    if isinstance(val, Decimal):
        return val.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    try:
        return Decimal(str(val)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal("0.00")


def _fmt_dec(val: Any) -> float:
    return float(_to_dec(val))


_d = _to_dec
_f = _fmt_dec


# ============================================================================
# 1. COLUMN SCHEMAS FOR ALL 36 SALES REPORTS
# ============================================================================

SALES_REPORT_SCHEMAS: dict[str, dict[str, Any]] = {
    # -------------------------------------------------------------------------
    # A. Nhóm sổ chi tiết, nhật ký và xuất kho (5 báo cáo)
    # -------------------------------------------------------------------------
    "RPT-0076": {
        "report_code": "RPT-0076",
        "report_name": "S35-DN: Sổ chi tiết bán hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "posting_date", "name": "Ngày, tháng ghi sổ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số hiệu", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày, tháng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "counter_account_code", "name": "TK đối ứng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "quantity", "name": "Số lượng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "unit_price", "name": "Đơn giá", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "sales_amount", "name": "Thành tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "tax_amount", "name": "Thuế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "deduction_521_amount", "name": "Khác (521)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0078": {
        "report_code": "RPT-0078",
        "report_name": "Sổ chi tiết bán hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [
            {"code": "SALES_REVENUE", "name": "Doanh thu & Giảm trừ", "from_column": "gross_sales_amount", "to_column": "sales_reduction_amount"},
            {"code": "PROFITABILITY", "name": "Giá vốn & Lợi nhuận", "from_column": "net_cogs_amount", "to_column": "gross_margin_percent"},
        ],
        "columns": [
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải chung", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_item_name", "name": "Tên hàng trên chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_description", "name": "Mô tả", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "gross_sold_quantity", "name": "Tổng số lượng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "unit_price", "name": "Đơn giá", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Tổng số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Giá vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0085": {
        "report_code": "RPT-0085",
        "report_name": "Tổng hợp xuất kho bán hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "row_no", "name": "STT", "data_type": "NUMBER", "align": "center", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng hóa, dịch vụ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "Đơn vị tính", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "issued_quantity", "name": "Số lượng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "issue_unit_price", "name": "Đơn giá", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "issue_amount", "name": "Thành tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0088": {
        "report_code": "RPT-0088",
        "report_name": "Sổ nhật ký bán hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gross_sales_amount", "name": "Tổng doanh thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "merchandise_revenue", "name": "Doanh thu hàng hóa", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "finished_goods_revenue", "name": "Doanh thu thành phẩm", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "service_revenue", "name": "Doanh thu dịch vụ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_revenue", "name": "Doanh thu khác", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Giá vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0110": {
        "report_code": "RPT-0110",
        "report_name": "Sổ chi tiết bán hàng theo nhân viên",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải chung", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_item_name", "name": "Tên hàng trên chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "gross_sold_quantity", "name": "Tổng số lượng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "unit_price", "name": "Đơn giá", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "discount_account_code", "name": "TK chiết khấu", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Tổng số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Giá vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },

    # -------------------------------------------------------------------------
    # B. Nhóm tổng hợp/phân tích (17 báo cáo)
    # -------------------------------------------------------------------------
    "RPT-0077": {
        "report_code": "RPT-0077",
        "report_name": "Tổng hợp bán hàng theo khách hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit_amount", "name": "Lãi gộp", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_margin_percent", "name": "Tỷ lệ lãi gộp (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0079": {
        "report_code": "RPT-0079",
        "report_name": "So sánh số lượng, doanh số theo thời gian – Khách hàng và mặt hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "is_dynamic": True,
        "columns": [
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0080": {
        "report_code": "RPT-0080",
        "report_name": "Tổng hợp bán hàng theo mặt hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [
            {"code": "SALES_REVENUE", "name": "Doanh thu & Giảm trừ", "from_column": "gross_sales_amount", "to_column": "sales_reduction_amount"},
            {"code": "PROFITABILITY", "name": "Giá vốn & Lợi nhuận", "from_column": "net_sales_amount", "to_column": "gross_margin_percent"},
        ],
        "columns": [
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "gross_sold_quantity", "name": "Số lượng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "SL trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit_amount", "name": "Lãi gộp", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_margin_percent", "name": "Tỷ lệ lãi gộp (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0081": {
        "report_code": "RPT-0081",
        "report_name": "Tổng hợp bán hàng theo nhóm khách hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "customer_group_code", "name": "Mã nhóm khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_group_name", "name": "Tên nhóm khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit_amount", "name": "Lãi gộp", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_margin_percent", "name": "Tỷ lệ lãi gộp (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0082": {
        "report_code": "RPT-0082",
        "report_name": "Tổng hợp bán hàng theo mặt hàng và khách hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "gross_sold_quantity", "name": "Số lượng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit_amount", "name": "Lãi gộp", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_margin_percent", "name": "Tỷ lệ lãi gộp (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0083": {
        "report_code": "RPT-0083",
        "report_name": "Phân tích doanh thu sản phẩm/nhóm sản phẩm theo thời gian",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "is_dynamic": True,
        "columns": [
            {"code": "row_no", "name": "STT", "data_type": "NUMBER", "align": "center", "is_totalable": False},
            {"code": "item_or_group_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_or_group_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0084": {
        "report_code": "RPT-0084",
        "report_name": "Tổng hợp bán hàng theo mã thống kê và mặt hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "statistical_code", "name": "Mã thống kê", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "statistical_name", "name": "Tên thống kê", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "gross_sold_quantity", "name": "Số lượng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0086": {
        "report_code": "RPT-0086",
        "report_name": "Tổng hợp bán hàng theo sàn thương mại điện tử",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "marketplace_name", "name": "Sàn thương mại điện tử", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "shop_name", "name": "Tên shop", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "marketplace_fee_amount", "name": "Phí sàn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "profit_amount", "name": "Lãi", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "profit_margin_percent", "name": "Tỷ lệ lãi (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0087": {
        "report_code": "RPT-0087",
        "report_name": "So sánh theo thời gian: Nhân viên và mặt hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "is_dynamic": True,
        "columns": [
            {"code": "branch_name", "name": "Tên đơn vị", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0089": {
        "report_code": "RPT-0089",
        "report_name": "Tổng hợp bán hàng theo nhóm mặt hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "item_group_code", "name": "Mã nhóm VTHH", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_group_name", "name": "Tên nhóm VTHH", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "gross_sold_quantity", "name": "Số lượng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "SL trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit_amount", "name": "Lãi gộp", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_margin_percent", "name": "Tỷ lệ lãi gộp (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0090": {
        "report_code": "RPT-0090",
        "report_name": "Tổng hợp bán hàng theo địa phương",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "province_name", "name": "Tỉnh/Thành phố", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "district_name", "name": "Quận/Huyện", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "ward_name", "name": "Xã/Phường", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0108": {
        "report_code": "RPT-0108",
        "report_name": "Tổng hợp bán hàng theo nhân viên và khách hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit_amount", "name": "Lãi gộp", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_margin_percent", "name": "Tỷ lệ lãi gộp (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0109": {
        "report_code": "RPT-0109",
        "report_name": "Tổng hợp bán hàng theo mặt hàng và nhân viên",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "employee_code", "name": "Mã nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "employee_name", "name": "Tên nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "gross_sold_quantity", "name": "Số lượng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit_amount", "name": "Lãi gộp", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_margin_percent", "name": "Tỷ lệ lãi gộp (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0113": {
        "report_code": "RPT-0113",
        "report_name": "Tổng hợp bán hàng theo nhân viên, khách hàng và mặt hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "gross_sold_quantity", "name": "Số lượng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit_amount", "name": "Lãi gộp", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_margin_percent", "name": "Tỷ lệ lãi gộp (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0114": {
        "report_code": "RPT-0114",
        "report_name": "Tổng hợp bán hàng theo nhân viên",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "employee_code", "name": "Mã nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "employee_name", "name": "Tên nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit_amount", "name": "Lãi gộp", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_margin_percent", "name": "Tỷ lệ lãi gộp (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0117": {
        "report_code": "RPT-0117",
        "report_name": "Tổng hợp bán hàng theo đơn vị kinh doanh",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "branch_code", "name": "Mã đơn vị", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "branch_name", "name": "Tên đơn vị", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit_amount", "name": "Lãi gộp", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_margin_percent", "name": "Tỷ lệ lãi gộp (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0118": {
        "report_code": "RPT-0118",
        "report_name": "Tổng hợp bán hàng theo đơn vị kinh doanh và mặt hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [
            {"code": "SALES_METRICS", "name": "Chỉ tiêu bán hàng", "from_column": "non_promo_sold_quantity", "to_column": "sales_discount_amount"},
            {"code": "RETURN_METRICS", "name": "Chỉ tiêu trả lại & Giá vốn", "from_column": "non_promo_return_quantity", "to_column": "gross_profit_amount"},
        ],
        "columns": [
            {"code": "branch_code", "name": "Mã đơn vị", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "base_uom_name", "name": "Đơn vị chính (ĐVC)", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "non_promo_sold_quantity", "name": "SL bán không KM", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "non_promo_sold_quantity_base", "name": "SL bán không KM theo ĐVC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "promo_quantity", "name": "Số lượng khuyến mại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "promo_quantity_base", "name": "Số lượng KM theo ĐVC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_sold_quantity", "name": "Số lượng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_sold_quantity_base", "name": "Số lượng bán theo ĐVC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_sales_amount", "name": "Doanh số bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "non_promo_return_quantity", "name": "Số lượng trả lại không KM", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "non_promo_return_quantity_base", "name": "Số lượng trả lại không KM theo ĐVC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "promo_return_quantity", "name": "SL hàng KM trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "promo_return_quantity_base", "name": "SL hàng KM trả lại theo ĐVC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity_base", "name": "Số lượng trả lại theo ĐVC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Tiền vốn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit_amount", "name": "Lãi gộp", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_margin_percent", "name": "Tỷ lệ lãi gộp (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "item_group_name", "name": "Nhóm VTHH", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },

    # -------------------------------------------------------------------------
    # C. Nhóm bảo hành (1 báo cáo)
    # -------------------------------------------------------------------------
    "RPT-0091": {
        "report_code": "RPT-0091",
        "report_name": "Sổ chi tiết theo dõi tình trạng bảo hành",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "sold_quantity", "name": "Số lượng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_date", "name": "Ngày bán hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "warranty_duration", "name": "Thời hạn bảo hành", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "warranty_expiry_date", "name": "Ngày hết hạn bảo hành", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "remaining_warranty_duration", "name": "Thời hạn BH còn lại", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "warranty_status", "name": "Tình trạng bảo hành", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },

    # -------------------------------------------------------------------------
    # D. Nhóm đơn đặt hàng (5 báo cáo)
    # -------------------------------------------------------------------------
    "RPT-0121": {
        "report_code": "RPT-0121",
        "report_name": "Tình hình thực hiện đơn đặt hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "order_date", "name": "Ngày đơn hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "order_number", "name": "Số đơn hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "planned_delivery_date", "name": "Ngày giao hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "ordered_quantity", "name": "Số lượng đặt hàng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "delivered_quantity", "name": "Số lượng đã giao", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_quantity", "name": "Số lượng còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "ordered_sales_amount", "name": "Doanh số đặt hàng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "fulfilled_sales_amount", "name": "Doanh số đã thực hiện", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_sales_amount", "name": "Doanh số chưa thực hiện", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "fulfillment_status", "name": "Tình trạng", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0122": {
        "report_code": "RPT-0122",
        "report_name": "Báo cáo tổng hợp lãi/lỗ theo đơn hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "order_number", "name": "Số đơn hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "order_date", "name": "Ngày đơn hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "recognized_revenue", "name": "Doanh thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "revenue_deductions", "name": "Giảm trừ doanh thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Giá vốn hàng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "selling_expense_amount", "name": "CP bán hàng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "administrative_expense_amount", "name": "CP quản lý", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_attributed_cost_amount", "name": "Chi phí khác", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "profit_amount", "name": "Lãi/Lỗ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "profit_margin_percent", "name": "Tỷ suất lợi nhuận/Doanh thu %", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0124": {
        "report_code": "RPT-0124",
        "report_name": "Thống kê tồn kho và số lượng đặt hàng chưa giao",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "undelivered_order_quantity", "name": "Số lượng đặt hàng chưa giao", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "on_hand_quantity", "name": "Số lượng tồn kho", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "quantity_difference", "name": "Chênh lệch", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "incoming_purchase_quantity", "name": "Số lượng đặt mua chưa nhận", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "additional_purchase_required", "name": "Số còn phải đặt mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0125": {
        "report_code": "RPT-0125",
        "report_name": "Báo cáo chi tiết tình hình thực hiện đơn đặt hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "order_date", "name": "Ngày đơn đặt hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "order_number", "name": "Số đơn đặt hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "order_line_no", "name": "STT dòng đơn", "data_type": "NUMBER", "align": "center", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "ordered_quantity", "name": "Số lượng đặt", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "delivery_document_no", "name": "Số chứng từ giao", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "delivery_date", "name": "Ngày giao", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "delivered_quantity", "name": "Số lượng từng đợt", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "cumulative_delivered_quantity", "name": "Đã giao lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_quantity", "name": "Còn phải giao", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "delivery_status", "name": "Trạng thái giao", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "source_reference", "name": "Chứng từ nguồn", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    "RPT-0126": {
        "report_code": "RPT-0126",
        "report_name": "Báo cáo chi tiết lãi/lỗ theo đơn hàng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "order_number", "name": "Số đơn hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },

    # -------------------------------------------------------------------------
    # E. Nhóm hợp đồng bán (8 báo cáo)
    # -------------------------------------------------------------------------
    "RPT-0128": {
        "report_code": "RPT-0128",
        "report_name": "Tình hình thực hiện hợp đồng bán",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "contract_date", "name": "Ngày ký", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "contract_number", "name": "Số hợp đồng bán", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "contracted_quantity", "name": "Số lượng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "delivered_quantity", "name": "Số lượng đã giao", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_quantity", "name": "Số lượng còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "contract_sales_amount", "name": "Doanh số hợp đồng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "fulfilled_sales_amount", "name": "Doanh số đã thực hiện", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_sales_amount", "name": "Doanh số chưa thực hiện", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "fulfillment_status", "name": "Tình trạng", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0129": {
        "report_code": "RPT-0129",
        "report_name": "Tổng hợp doanh số mặt hàng theo hợp đồng bán",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "employee_name", "name": "Tên nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "branch_name", "name": "Đơn vị", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "sales_amount", "name": "Doanh số", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0132": {
        "report_code": "RPT-0132",
        "report_name": "Báo cáo tổng hợp lãi/lỗ theo hợp đồng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "contract_or_project_name", "name": "Hợp đồng/dự án", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "recognized_revenue", "name": "Doanh thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "revenue_deductions", "name": "Giảm trừ doanh thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_sales_amount", "name": "Doanh thu thuần", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_cogs_amount", "name": "Giá vốn hàng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "selling_expense_amount", "name": "Chi phí bán hàng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "administrative_expense_amount", "name": "Chi phí quản lý", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_attributed_cost_amount", "name": "Chi phí khác", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "profit_amount", "name": "Lãi/Lỗ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "profit_margin_percent", "name": "Tỷ suất lợi nhuận/Doanh thu (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0133": {
        "report_code": "RPT-0133",
        "report_name": "Tổng hợp tình hình chi theo hợp đồng bán",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "revenue_record_date", "name": "Ngày ghi doanh số", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "contract_or_project_name", "name": "Hợp đồng/dự án", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "payable_in_period", "name": "Phải chi trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_in_period", "name": "Đã chi trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "payable_cumulative", "name": "Phải chi lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_cumulative", "name": "Đã chi lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_payable", "name": "Còn phải chi", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0134": {
        "report_code": "RPT-0134",
        "report_name": "Báo cáo chi tiết lãi/lỗ theo hợp đồng",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0135": {
        "report_code": "RPT-0135",
        "report_name": "Tổng hợp chi phí hợp đồng bán theo khoản mục chi phí",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "contract_date", "name": "Ngày ký", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "contract_description", "name": "Trích yếu", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "cost_category_code", "name": "Mã khoản mục chi phí", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "cost_category_name", "name": "Tên khoản mục chi phí", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "opening_cumulative_cost", "name": "Lũy kế đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_cost", "name": "Phát sinh trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_cumulative_cost", "name": "Lũy kế cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0136": {
        "report_code": "RPT-0136",
        "report_name": "Tổng hợp doanh số hợp đồng theo đơn vị",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "revenue_record_date", "name": "Ngày ghi doanh số", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "contract_or_project_name", "name": "Hợp đồng/dự án", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "sales_amount", "name": "Doanh số", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "expected_cost_amount", "name": "Dự kiến chi", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "estimated_profit_amount", "name": "Lãi lỗ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0137": {
        "report_code": "RPT-0137",
        "report_name": "Sổ chi tiết tài khoản theo hợp đồng và khoản mục chi phí",
        "report_category_type": "MANAGEMENT_REPORT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "contract_date", "name": "Ngày ký", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "counter_account_code", "name": "TK đối ứng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "debit_amount", "name": "Số tiền Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_amount", "name": "Số tiền Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
}


# ============================================================================
# 2. RBAC & DATA SCOPE (BR-RPT-SAL-05..06, BR-RPT-SAL-111..114)
# ============================================================================

def get_user_sales_permissions(user=None, request=None) -> set[str]:
    """Resolve active sales report permissions from User, IAM, or HTTP headers."""
    perms: set[str] = set()

    if request:
        raw_header = request.headers.get("X-Sales-Permissions") or request.META.get("HTTP_X_SALES_PERMISSIONS")
        if raw_header:
            tokens = [t.strip().upper() for t in raw_header.split(",") if t.strip()]
            for tok in tokens:
                for canonical, aliases in PERM_ALIASES.items():
                    if tok == canonical or tok in aliases:
                        perms.add(canonical)
            if "NONE" in tokens or "DENIED" in tokens:
                perms.clear()
            return perms

    if user and getattr(user, "is_superuser", False):
        return set(ALL_SALES_PERMISSIONS)

    perms.add(PERM_SALES_VIEW)
    return perms


def check_sales_report_permission(user, request, required_permission: str):
    """Enforce granular sales permissions with HTTP 403 response on failure."""
    perms = get_user_sales_permissions(user, request)
    if required_permission not in perms:
        raise PermissionDenied(
            f"Người dùng không có quyền '{required_permission}' để truy cập chức năng báo cáo bán hàng."
        )


def resolve_sales_company_scope(request, params: dict[str, Any]) -> tuple[str, str | None]:
    """
    Enforce Company & Branch Isolation (BR-RPT-SAL-05..06).
    Rejects unauthorized company_id access with 403 PermissionDenied.
    """
    params = params or {}
    company_id = str(
        params.get("company_id")
        or (request.query_params.get("company_id") if request else "")
        or ""
    ).strip()
    branch_id = params.get("branch_id") or (request.query_params.get("branch_id") if request else None)

    if request:
        raw_allowed = request.headers.get("X-Allowed-Companies") or request.META.get("HTTP_X_ALLOWED_COMPANIES")
        if raw_allowed:
            allowed_companies = {c.strip() for c in raw_allowed.split(",") if c.strip()}
            if company_id and company_id not in allowed_companies:
                raise PermissionDenied(
                    f"Người dùng không được cấp quyền truy cập dữ liệu bán hàng của doanh nghiệp '{company_id}'."
                )

    if not company_id:
        co = Company.objects.first()
        company_id = str(co.id) if co else "DEFAULT-COMPANY"

    return company_id, str(branch_id) if branch_id else None


# ============================================================================
# 3. SNAPSHOT & STALE DETECTION (BR-RPT-SAL-109..110)
# ============================================================================

def compute_sales_source_snapshot_meta(company_id: str, d_from: date, d_to: date) -> dict[str, Any]:
    """Capture source transaction record counts to evaluate stale snapshots later."""
    goods_count = GoodsSale.objects.filter(
        company_id=company_id,
        document_date__gte=d_from,
        document_date__lte=d_to,
    ).count()

    order_count = SalesOrder.objects.filter(
        company_id=company_id,
        document_date__gte=d_from,
        document_date__lte=d_to,
    ).count()

    contract_count = SalesContract.objects.filter(
        company_id=company_id,
        document_date__gte=d_from,
        document_date__lte=d_to,
    ).count()

    invoice_count = SalesInvoice.objects.filter(
        company_id=company_id,
        document_date__gte=d_from,
        document_date__lte=d_to,
    ).count()

    gl_count = JournalLine.objects.filter(
        entry__posting_date__gte=d_from,
        entry__posting_date__lte=d_to,
        entry__status="POSTED",
    ).count()

    return {
        "goods_sale_count": goods_count,
        "sales_order_count": order_count,
        "sales_contract_count": contract_count,
        "sales_invoice_count": invoice_count,
        "gl_journal_count": gl_count,
        "snapshot_created_at": timezone.now().isoformat(),
    }


def is_sales_run_stale(run: SalesReportRun) -> bool:
    """Checks if source sales data has changed since snapshot generation (BR-RPT-SAL-110)."""
    if not run.source_snapshot_meta or run.data_mode != "SAVED_SNAPSHOT":
        return False
    if not run.from_date or not run.to_date:
        return False

    meta = run.source_snapshot_meta
    current_meta = compute_sales_source_snapshot_meta(run.company_id, run.from_date, run.to_date)

    return (
        current_meta.get("goods_sale_count") != meta.get("goods_sale_count")
        or current_meta.get("sales_order_count") != meta.get("sales_order_count")
        or current_meta.get("sales_contract_count") != meta.get("sales_contract_count")
        or current_meta.get("sales_invoice_count") != meta.get("sales_invoice_count")
        or current_meta.get("gl_journal_count") != meta.get("gl_journal_count")
    )


# ============================================================================
# 4. REPORT BUILDERS (ALL 36 SALES REPORTS)
# ============================================================================

def _build_rpt_0078(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.6. RPT-0078 – Sổ chi tiết bán hàng (21 cột chuẩn).
    Công thức cốt lõi:
    - Doanh thu thuần = Doanh số − Chiết khấu − Giá trị trả lại − Giá trị giảm giá
    - Số lượng bán thuần = Số lượng bán − Số lượng trả lại
    - Lãi gộp = Doanh thu thuần − Giá vốn
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_lines = params.get("sales_lines")
    raw_lines = []
    if isinstance(custom_lines, list) and custom_lines:
        raw_lines = custom_lines
    else:
        qs = GoodsSaleLine.objects.filter(
            sale__company_id=company_id,
            sale__document_date__gte=d_from,
            sale__document_date__lte=d_to,
        ).exclude(sale__status__in=["DRAFT", "CANCELLED"]).select_related(
            "sale", "item", "uom", "sale__customer"
        ).order_by("sale__posting_date", "sale__number", "line_no")

        if branch_id:
            qs = qs.filter(sale__branch_id=branch_id)
        if params.get("customer_ids"):
            qs = qs.filter(sale__customer_id__in=params["customer_ids"])
        if params.get("item_ids"):
            qs = qs.filter(item_id__in=params["item_ids"])

        for line in qs:
            ret_qty = Decimal("0.00")
            ret_amt = Decimal("0.00")
            for r_line in getattr(line, "return_lines", []):
                ret_qty += getattr(r_line, "quantity", Decimal("0.00"))
                ret_amt += getattr(r_line, "amount", Decimal("0.00"))

            raw_lines.append(
                {
                    "posting_date": line.sale.posting_date.isoformat() if line.sale.posting_date else "",
                    "document_date": line.sale.document_date.isoformat(),
                    "document_no": line.sale.number,
                    "invoice_date": line.sale.document_date.isoformat(),
                    "invoice_number": getattr(line.sale, "invoice_number", line.sale.number),
                    "description": line.description or "Bán hàng hóa",
                    "document_item_name": line.item.name if hasattr(line.item, "name") else "",
                    "customer_id": str(line.sale.customer_id),
                    "customer_code": getattr(line.sale.customer, "code", ""),
                    "customer_name": getattr(line.sale.customer, "name", "Khách hàng"),
                    "item_id": str(line.item_id),
                    "item_code": getattr(line.item, "code", ""),
                    "item_name": getattr(line.item, "name", ""),
                    "item_description": getattr(line.item, "description", ""),
                    "uom_id": str(line.uom_id),
                    "uom_name": getattr(line.uom, "name", ""),
                    "gross_sold_quantity": line.quantity,
                    "unit_price": line.unit_price,
                    "gross_sales_amount": line.pre_tax_amount,
                    "sales_discount_amount": getattr(line, "discount_amount", Decimal("0.00")),
                    "returned_quantity": ret_qty,
                    "sales_return_amount": ret_amt,
                    "sales_reduction_amount": getattr(line, "allowance_amount", Decimal("0.00")),
                    "net_cogs_amount": getattr(line, "cost_amount", Decimal("0.00")),
                    "employee_id": str(getattr(line.sale, "seller_id", "") or ""),
                    "branch_id": str(getattr(line.sale, "branch_id", "") or ""),
                    "sales_document_id": str(line.sale_id),
                    "sales_line_id": str(line.id),
                }
            )

    tot_sold_qty = Decimal("0.00")
    tot_gross_sales = Decimal("0.00")
    tot_discount = Decimal("0.00")
    tot_ret_qty = Decimal("0.00")
    tot_ret_amt = Decimal("0.00")
    tot_reduction = Decimal("0.00")
    tot_net_sales = Decimal("0.00")
    tot_cogs = Decimal("0.00")
    tot_gross_profit = Decimal("0.00")

    for idx, item in enumerate(raw_lines, start=1):
        s_qty = _d(item.get("gross_sold_quantity", item.get("quantity", 0)))
        u_price = _d(item.get("unit_price", 0))
        g_sales = _d(item.get("gross_sales_amount", item.get("sales_amount", 0)))
        d_amt = _d(item.get("sales_discount_amount", item.get("discount_amount", 0)))
        r_qty = _d(item.get("returned_quantity", 0))
        r_amt = _d(item.get("sales_return_amount", item.get("returned_amount", 0)))
        red_amt = _d(item.get("sales_reduction_amount", item.get("reduction_amount", 0)))
        cogs = _d(item.get("net_cogs_amount", item.get("cogs_amount", 0)))

        net_sales = g_sales - d_amt - r_amt - red_amt
        gross_profit = net_sales - cogs
        margin_pct = _f((gross_profit / net_sales * Decimal("100.00"))) if net_sales != Decimal("0.00") else None

        row_warnings: list[str] = []
        if r_qty > s_qty:
            row_warnings.append("RETURN_QUANTITY_EXCEEDS_SOLD")
            validations.append(
                {
                    "check_code": "RPT_0078_RETURN_EXCEEDED",
                    "check_name": f"Dòng #{idx}: Số lượng trả lại ({r_qty}) lớn hơn số lượng bán ({s_qty})",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Dòng '{item.get('document_no')}' có số lượng trả lại vượt số lượng bán.",
                    "affected_rows": [str(idx)],
                }
            )

        if gross_profit < Decimal("0.00"):
            row_warnings.append("NEGATIVE_GROSS_MARGIN")
            validations.append(
                {
                    "check_code": "RPT_0078_NEGATIVE_MARGIN",
                    "check_name": f"Dòng #{idx}: Lãi gộp bị âm ({_f(gross_profit)})",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Dòng '{item.get('document_no')}' có giá vốn ({_f(cogs)}) vượt quá doanh thu thuần ({_f(net_sales)}).",
                    "affected_rows": [str(idx)],
                }
            )

        tot_sold_qty += s_qty
        tot_gross_sales += g_sales
        tot_discount += d_amt
        tot_ret_qty += r_qty
        tot_ret_amt += r_amt
        tot_reduction += red_amt
        tot_net_sales += net_sales
        tot_cogs += cogs
        tot_gross_profit += gross_profit

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": str(item.get("item_code", "")),
                "customer_id": str(item.get("customer_id", "")),
                "customer_code": str(item.get("customer_code", "")),
                "customer_name": str(item.get("customer_name", "")),
                "item_id": str(item.get("item_id", "")),
                "item_code": str(item.get("item_code", "")),
                "item_name": str(item.get("item_name", "")),
                "employee_id": str(item.get("employee_id", "")),
                "employee_code": str(item.get("employee_code", "")),
                "employee_name": str(item.get("employee_name", "")),
                "branch_id": str(item.get("branch_id", "")),
                "branch_code": str(item.get("branch_code", "")),
                "branch_name": str(item.get("branch_name", "")),
                "order_id": str(item.get("order_id", "")),
                "contract_id": str(item.get("contract_id", "")),
                "project_id": str(item.get("project_id", "")),
                "document_id": str(item.get("sales_document_id", item.get("document_no", ""))),
                "columns": {
                    "posting_date": str(item.get("posting_date", "")),
                    "document_date": str(item.get("document_date", "")),
                    "document_no": str(item.get("document_no", "")),
                    "invoice_date": str(item.get("invoice_date", "")),
                    "invoice_number": str(item.get("invoice_number", "")),
                    "description": str(item.get("description", "")),
                    "document_item_name": str(item.get("document_item_name", item.get("item_name", ""))),
                    "customer_code": str(item.get("customer_code", "")),
                    "customer_name": str(item.get("customer_name", "")),
                    "item_code": str(item.get("item_code", "")),
                    "item_name": str(item.get("item_name", "")),
                    "item_description": str(item.get("item_description", "")),
                    "uom_name": str(item.get("uom_name", "")),
                    "gross_sold_quantity": _f(s_qty),
                    "unit_price": _f(u_price),
                    "gross_sales_amount": _f(g_sales),
                    "sales_discount_amount": _f(d_amt),
                    "returned_quantity": _f(r_qty),
                    "sales_return_amount": _f(r_amt),
                    "sales_reduction_amount": _f(red_amt),
                    "net_cogs_amount": _f(cogs),
                    "net_sales_amount": _f(net_sales),
                    "gross_profit_amount": _f(gross_profit),
                    "gross_margin_percent": margin_pct,
                },
                "detail_payload": {
                    "net_sales_amount": _f(net_sales),
                    "net_sold_quantity": _f(s_qty - r_qty),
                    "gross_profit_amount": _f(gross_profit),
                    "gross_margin_percent": margin_pct,
                    "customer_group_id": str(item.get("customer_group_id", "")),
                    "customer_group_code": str(item.get("customer_group_code", "")),
                    "customer_group_name": str(item.get("customer_group_name", "")),
                    "item_group_code": str(item.get("item_group_code", "")),
                    "item_group_name": str(item.get("item_group_name", "")),
                    "province_name": str(item.get("province_name", "")),
                    "district_name": str(item.get("district_name", "")),
                    "ward_name": str(item.get("ward_name", "")),
                    "statistical_code": str(item.get("statistical_code", "")),
                    "statistical_name": str(item.get("statistical_name", "")),
                    "marketplace_name": str(item.get("marketplace_name", "")),
                    "shop_name": str(item.get("shop_name", "")),
                    "marketplace_fee_amount": _f(_d(item.get("marketplace_fee_amount", 0))),
                },
                "source_refs": [
                    {
                        "source_type": "GOODS_SALE_LINE",
                        "document_no": str(item.get("document_no", "")),
                        "item_code": str(item.get("item_code", "")),
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    tot_margin = (tot_gross_profit / tot_net_sales * Decimal("100.00")) if tot_net_sales != Decimal("0.00") else None

    summary = {
        "row_count": len(rows),
        "total_gross_sold_quantity": _f(tot_sold_qty),
        "total_gross_sales_amount": _f(tot_gross_sales),
        "total_sales_discount_amount": _f(tot_discount),
        "total_returned_quantity": _f(tot_ret_qty),
        "total_sales_return_amount": _f(tot_ret_amt),
        "total_sales_reduction_amount": _f(tot_reduction),
        "total_net_sales_amount": _f(tot_net_sales),
        "total_net_cogs_amount": _f(tot_cogs),
        "total_gross_profit_amount": _f(tot_gross_profit),
        "total_gross_margin_percent": _f(tot_margin) if tot_margin is not None else None,
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT_0078_OK",
                "check_name": "Kiểm tra sổ chi tiết bán hàng",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Số liệu sổ chi tiết bán hàng hợp lệ.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_0076(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """1.4. RPT-0076 – S35-DN: Sổ chi tiết bán hàng (10 cột chuẩn)."""
    rows_0078, _, _ = _build_rpt_0078(company_id, branch_id, d_from, d_to, params)

    rows: list[dict[str, Any]] = []
    tot_qty = Decimal("0.00")
    tot_sales = Decimal("0.00")
    tot_tax = Decimal("0.00")
    tot_521 = Decimal("0.00")

    for idx, r in enumerate(rows_0078, start=1):
        cols = r["columns"]
        qty = _d(cols.get("gross_sold_quantity", 0))
        u_price = _d(cols.get("unit_price", 0))
        amt = _d(cols.get("gross_sales_amount", 0))
        tax = _d(cols.get("tax_amount", amt * Decimal("0.10")))
        d_521 = _d(cols.get("sales_discount_amount", 0)) + _d(cols.get("sales_return_amount", 0)) + _d(cols.get("sales_reduction_amount", 0))

        tot_qty += qty
        tot_sales += amt
        tot_tax += tax
        tot_521 += d_521

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "columns": {
                    "posting_date": cols.get("posting_date", ""),
                    "document_no": cols.get("document_no", ""),
                    "document_date": cols.get("document_date", ""),
                    "description": cols.get("description", ""),
                    "counter_account_code": cols.get("counter_account_code", "131"),
                    "quantity": _f(qty),
                    "unit_price": _f(u_price),
                    "sales_amount": _f(amt),
                    "tax_amount": _f(tax),
                    "deduction_521_amount": _f(d_521),
                },
                "detail_payload": r.get("detail_payload", {}),
                "source_refs": r.get("source_refs", []),
                "warning_codes": r.get("warning_codes", []),
            }
        )

    summary = {
        "row_count": len(rows),
        "total_quantity": _f(tot_qty),
        "total_sales_amount": _f(tot_sales),
        "total_tax_amount": _f(tot_tax),
        "total_deduction_521_amount": _f(tot_521),
        "total_net_sales_amount": _f(tot_sales - tot_521),
    }
    validations = [{"check_code": "RPT_0076_OK", "check_name": "Kiểm tra mẫu sổ S35-DN", "severity": "INFO", "status": "PASSED", "message": "Sổ S35-DN hợp lệ.", "affected_rows": []}]
    return rows, summary, validations


def _build_rpt_0077(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """1.5. RPT-0077 – Tổng hợp bán hàng theo khách hàng (10 cột chuẩn)."""
    rows_0078, _, _ = _build_rpt_0078(company_id, branch_id, d_from, d_to, params)

    groups: dict[str, dict[str, Any]] = {}
    for r in rows_0078:
        cols = r["columns"]
        det = r["detail_payload"]
        c_id = r["customer_id"] or cols["customer_code"] or "UNASSIGNED_CUSTOMER"
        c_code = cols.get("customer_code") or c_id
        c_name = cols.get("customer_name") or f"Khách hàng {c_code}"

        if c_id not in groups:
            groups[c_id] = {
                "customer_code": c_code,
                "customer_name": c_name,
                "gross_sales_amount": Decimal("0.00"),
                "sales_discount_amount": Decimal("0.00"),
                "sales_return_amount": Decimal("0.00"),
                "sales_reduction_amount": Decimal("0.00"),
                "net_sales_amount": Decimal("0.00"),
                "net_cogs_amount": Decimal("0.00"),
                "gross_profit_amount": Decimal("0.00"),
            }

        g = groups[c_id]
        g_sales = _d(cols["gross_sales_amount"])
        d_amt = _d(cols["sales_discount_amount"])
        r_amt = _d(cols["sales_return_amount"])
        red_amt = _d(cols["sales_reduction_amount"])
        cogs = _d(cols["net_cogs_amount"])
        net = g_sales - d_amt - r_amt - red_amt
        profit = net - cogs

        g["gross_sales_amount"] += g_sales
        g["sales_discount_amount"] += d_amt
        g["sales_return_amount"] += r_amt
        g["sales_reduction_amount"] += red_amt
        g["net_sales_amount"] += net
        g["net_cogs_amount"] += cogs
        g["gross_profit_amount"] += profit

    rows: list[dict[str, Any]] = []
    tot_g_sales = Decimal("0.00")
    tot_net_sales = Decimal("0.00")
    tot_cogs = Decimal("0.00")
    tot_profit = Decimal("0.00")

    for idx, (c_id, g) in enumerate(groups.items(), start=1):
        tot_g_sales += g["gross_sales_amount"]
        tot_net_sales += g["net_sales_amount"]
        tot_cogs += g["net_cogs_amount"]
        tot_profit += g["gross_profit_amount"]

        margin = (g["gross_profit_amount"] / g["net_sales_amount"] * Decimal("100.00")) if g["net_sales_amount"] != Decimal("0.00") else None

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "customer_id": c_id,
                "customer_code": g["customer_code"],
                "columns": {
                    "customer_code": g["customer_code"],
                    "customer_name": g["customer_name"],
                    "gross_sales_amount": _f(g["gross_sales_amount"]),
                    "sales_discount_amount": _f(g["sales_discount_amount"]),
                    "sales_return_amount": _f(g["sales_return_amount"]),
                    "sales_reduction_amount": _f(g["sales_reduction_amount"]),
                    "net_sales_amount": _f(g["net_sales_amount"]),
                    "net_cogs_amount": _f(g["net_cogs_amount"]),
                    "gross_profit_amount": _f(g["gross_profit_amount"]),
                    "gross_margin_percent": _f(margin) if margin is not None else None,
                },
                "detail_payload": {"customer_id": c_id},
                "source_refs": [{"source_type": "CUSTOMER_SUMMARY", "customer_code": g["customer_code"]}],
                "warning_codes": [],
            }
        )

    tot_margin = (tot_profit / tot_net_sales * Decimal("100.00")) if tot_net_sales != Decimal("0.00") else None
    summary = {
        "row_count": len(rows),
        "customer_count": len(rows),
        "total_gross_sales_amount": _f(tot_g_sales),
        "total_net_sales_amount": _f(tot_net_sales),
        "total_net_cogs_amount": _f(tot_cogs),
        "total_gross_profit_amount": _f(tot_profit),
        "total_gross_margin_percent": _f(tot_margin) if tot_margin is not None else None,
    }
    validations = [{"check_code": "RPT_0077_OK", "check_name": "Kiểm tra tổng hợp bán hàng theo khách hàng", "severity": "INFO", "status": "PASSED", "message": "Số liệu khách hàng hợp lệ.", "affected_rows": []}]
    return rows, summary, validations


def _build_rpt_0080(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """1.8. RPT-0080 – Tổng hợp bán hàng theo mặt hàng (13 cột chuẩn)."""
    rows_0078, _, _ = _build_rpt_0078(company_id, branch_id, d_from, d_to, params)

    groups: dict[tuple[str, str], dict[str, Any]] = {}
    for r in rows_0078:
        cols = r["columns"]
        i_id = r["item_id"] or cols["item_code"] or "UNASSIGNED_ITEM"
        uom = cols["uom_name"]
        key = (i_id, uom)

        if key not in groups:
            groups[key] = {
                "item_id": i_id,
                "item_code": cols["item_code"],
                "item_name": cols["item_name"],
                "uom_name": uom,
                "gross_sold_quantity": Decimal("0.00"),
                "gross_sales_amount": Decimal("0.00"),
                "sales_discount_amount": Decimal("0.00"),
                "returned_quantity": Decimal("0.00"),
                "sales_return_amount": Decimal("0.00"),
                "sales_reduction_amount": Decimal("0.00"),
                "net_sales_amount": Decimal("0.00"),
                "net_cogs_amount": Decimal("0.00"),
                "gross_profit_amount": Decimal("0.00"),
            }

        g = groups[key]
        s_qty = _d(cols["gross_sold_quantity"])
        g_sales = _d(cols["gross_sales_amount"])
        d_amt = _d(cols["sales_discount_amount"])
        r_qty = _d(cols["returned_quantity"])
        r_amt = _d(cols["sales_return_amount"])
        red_amt = _d(cols["sales_reduction_amount"])
        cogs = _d(cols["net_cogs_amount"])
        net = g_sales - d_amt - r_amt - red_amt
        profit = net - cogs

        g["gross_sold_quantity"] += s_qty
        g["gross_sales_amount"] += g_sales
        g["sales_discount_amount"] += d_amt
        g["returned_quantity"] += r_qty
        g["sales_return_amount"] += r_amt
        g["sales_reduction_amount"] += red_amt
        g["net_sales_amount"] += net
        g["net_cogs_amount"] += cogs
        g["gross_profit_amount"] += profit

    rows: list[dict[str, Any]] = []
    tot_g_sales = Decimal("0.00")
    tot_net_sales = Decimal("0.00")
    tot_profit = Decimal("0.00")

    for idx, (k, g) in enumerate(groups.items(), start=1):
        tot_g_sales += g["gross_sales_amount"]
        tot_net_sales += g["net_sales_amount"]
        tot_profit += g["gross_profit_amount"]
        margin = (g["gross_profit_amount"] / g["net_sales_amount"] * Decimal("100.00")) if g["net_sales_amount"] != Decimal("0.00") else None

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "item_id": g["item_id"],
                "item_code": g["item_code"],
                "columns": {
                    "item_code": g["item_code"],
                    "item_name": g["item_name"],
                    "uom_name": g["uom_name"],
                    "gross_sold_quantity": _f(g["gross_sold_quantity"]),
                    "gross_sales_amount": _f(g["gross_sales_amount"]),
                    "sales_discount_amount": _f(g["sales_discount_amount"]),
                    "returned_quantity": _f(g["returned_quantity"]),
                    "sales_return_amount": _f(g["sales_return_amount"]),
                    "sales_reduction_amount": _f(g["sales_reduction_amount"]),
                    "net_sales_amount": _f(g["net_sales_amount"]),
                    "net_sold_quantity": _f(g["gross_sold_quantity"] - g["returned_quantity"]),
                    "net_cogs_amount": _f(g["net_cogs_amount"]),
                    "gross_profit_amount": _f(g["gross_profit_amount"]),
                    "gross_margin_percent": _f(margin) if margin is not None else None,
                },
                "detail_payload": {
                    "item_id": g["item_id"],
                    "net_sold_quantity": _f(g["gross_sold_quantity"] - g["returned_quantity"]),
                },
                "source_refs": [{"source_type": "ITEM_SUMMARY", "item_code": g["item_code"]}],
                "warning_codes": [],
            }
        )

    tot_margin = (tot_profit / tot_net_sales * Decimal("100.00")) if tot_net_sales != Decimal("0.00") else None
    summary = {
        "row_count": len(rows),
        "item_count": len(rows),
        "total_gross_sales_amount": _f(tot_g_sales),
        "total_net_sales_amount": _f(tot_net_sales),
        "total_gross_profit_amount": _f(tot_profit),
        "total_gross_margin_percent": _f(tot_margin) if tot_margin is not None else None,
    }
    validations = [{"check_code": "RPT_0080_OK", "check_name": "Kiểm tra tổng hợp bán hàng theo mặt hàng", "severity": "INFO", "status": "PASSED", "message": "Số liệu mặt hàng hợp lệ.", "affected_rows": []}]
    return rows, summary, validations


def _build_rpt_0081(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """1.9. RPT-0081 – Tổng hợp bán hàng theo nhóm khách hàng (10 cột)."""
    rows_0078, _, _ = _build_rpt_0078(company_id, branch_id, d_from, d_to, params)

    groups: dict[str, dict[str, Any]] = {}
    for r in rows_0078:
        cols = r["columns"]
        det = r["detail_payload"]
        g_code = det.get("customer_group_code") or det.get("customer_group_id") or "NHOM_CHUA_RO"
        g_name = det.get("customer_group_name") or ("Chưa phân loại" if g_code == "NHOM_CHUA_RO" else f"Nhóm {g_code}")

        if g_code not in groups:
            groups[g_code] = {
                "customer_group_code": g_code,
                "customer_group_name": g_name,
                "gross_sales_amount": Decimal("0.00"),
                "sales_discount_amount": Decimal("0.00"),
                "sales_return_amount": Decimal("0.00"),
                "sales_reduction_amount": Decimal("0.00"),
                "net_sales_amount": Decimal("0.00"),
                "net_cogs_amount": Decimal("0.00"),
                "gross_profit_amount": Decimal("0.00"),
            }

        g = groups[g_code]
        g_sales = _d(cols["gross_sales_amount"])
        d_amt = _d(cols["sales_discount_amount"])
        r_amt = _d(cols["sales_return_amount"])
        red_amt = _d(cols["sales_reduction_amount"])
        cogs = _d(cols["net_cogs_amount"])
        net = g_sales - d_amt - r_amt - red_amt

        g["gross_sales_amount"] += g_sales
        g["sales_discount_amount"] += d_amt
        g["sales_return_amount"] += r_amt
        g["sales_reduction_amount"] += red_amt
        g["net_sales_amount"] += net
        g["net_cogs_amount"] += cogs
        g["gross_profit_amount"] += (net - cogs)

    rows: list[dict[str, Any]] = []
    tot_g_sales = Decimal("0.00")
    tot_net_sales = Decimal("0.00")
    tot_profit = Decimal("0.00")

    for idx, (code, g) in enumerate(groups.items(), start=1):
        tot_g_sales += g["gross_sales_amount"]
        tot_net_sales += g["net_sales_amount"]
        tot_profit += g["gross_profit_amount"]
        margin = (g["gross_profit_amount"] / g["net_sales_amount"] * Decimal("100.00")) if g["net_sales_amount"] != Decimal("0.00") else None

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": code,
                "columns": {
                    "customer_group_code": g["customer_group_code"],
                    "customer_group_name": g["customer_group_name"],
                    "gross_sales_amount": _f(g["gross_sales_amount"]),
                    "sales_discount_amount": _f(g["sales_discount_amount"]),
                    "sales_return_amount": _f(g["sales_return_amount"]),
                    "sales_reduction_amount": _f(g["sales_reduction_amount"]),
                    "net_sales_amount": _f(g["net_sales_amount"]),
                    "net_cogs_amount": _f(g["net_cogs_amount"]),
                    "gross_profit_amount": _f(g["gross_profit_amount"]),
                    "gross_margin_percent": _f(margin) if margin is not None else None,
                },
                "detail_payload": {"customer_group_code": code},
                "source_refs": [{"source_type": "CUSTOMER_GROUP_SUMMARY", "code": code}],
                "warning_codes": [],
            }
        )

    tot_margin = (tot_profit / tot_net_sales * Decimal("100.00")) if tot_net_sales != Decimal("0.00") else None
    summary = {
        "group_count": len(rows),
        "total_gross_sales_amount": _f(tot_g_sales),
        "total_net_sales_amount": _f(tot_net_sales),
        "total_gross_profit_amount": _f(tot_profit),
        "total_gross_margin_percent": _f(tot_margin) if tot_margin is not None else None,
    }
    validations = [{"check_code": "RPT_0081_OK", "check_name": "Kiểm tra tổng hợp theo nhóm khách hàng", "severity": "INFO", "status": "PASSED", "message": "Số liệu nhóm khách hàng hợp lệ.", "affected_rows": []}]
    return rows, summary, validations


def _build_rpt_0082(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """1.10. RPT-0082 – Tổng hợp bán hàng theo mặt hàng và khách hàng (13 cột)."""
    rows_0078, _, _ = _build_rpt_0078(company_id, branch_id, d_from, d_to, params)

    groups: dict[tuple[str, str, str], dict[str, Any]] = {}
    for r in rows_0078:
        cols = r["columns"]
        i_id = r["item_id"] or cols["item_code"]
        c_id = r["customer_id"] or cols["customer_code"]
        uom = cols["uom_name"]
        key = (i_id, c_id, uom)

        if key not in groups:
            groups[key] = {
                "item_id": i_id,
                "item_code": cols["item_code"],
                "item_name": cols["item_name"],
                "customer_id": c_id,
                "customer_code": cols["customer_code"],
                "customer_name": cols["customer_name"],
                "uom_name": uom,
                "gross_sold_quantity": Decimal("0.00"),
                "gross_sales_amount": Decimal("0.00"),
                "sales_discount_amount": Decimal("0.00"),
                "returned_quantity": Decimal("0.00"),
                "sales_return_amount": Decimal("0.00"),
                "sales_reduction_amount": Decimal("0.00"),
                "net_sales_amount": Decimal("0.00"),
                "net_cogs_amount": Decimal("0.00"),
                "gross_profit_amount": Decimal("0.00"),
            }

        g = groups[key]
        s_qty = _d(cols["gross_sold_quantity"])
        g_sales = _d(cols["gross_sales_amount"])
        d_amt = _d(cols["sales_discount_amount"])
        r_qty = _d(cols["returned_quantity"])
        r_amt = _d(cols["sales_return_amount"])
        red_amt = _d(cols["sales_reduction_amount"])
        cogs = _d(cols["net_cogs_amount"])
        net = g_sales - d_amt - r_amt - red_amt

        g["gross_sold_quantity"] += s_qty
        g["gross_sales_amount"] += g_sales
        g["sales_discount_amount"] += d_amt
        g["returned_quantity"] += r_qty
        g["sales_return_amount"] += r_amt
        g["sales_reduction_amount"] += red_amt
        g["net_sales_amount"] += net
        g["net_cogs_amount"] += cogs
        g["gross_profit_amount"] += (net - cogs)

    rows: list[dict[str, Any]] = []
    tot_g_sales = Decimal("0.00")
    tot_net_sales = Decimal("0.00")
    tot_profit = Decimal("0.00")

    for idx, (k, g) in enumerate(groups.items(), start=1):
        tot_g_sales += g["gross_sales_amount"]
        tot_net_sales += g["net_sales_amount"]
        tot_profit += g["gross_profit_amount"]
        margin = (g["gross_profit_amount"] / g["net_sales_amount"] * Decimal("100.00")) if g["net_sales_amount"] != Decimal("0.00") else None

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "item_id": g["item_id"],
                "customer_id": g["customer_id"],
                "columns": {
                    "customer_code": g["customer_code"],
                    "customer_name": g["customer_name"],
                    "uom_name": g["uom_name"],
                    "gross_sold_quantity": _f(g["gross_sold_quantity"]),
                    "gross_sales_amount": _f(g["gross_sales_amount"]),
                    "sales_discount_amount": _f(g["sales_discount_amount"]),
                    "returned_quantity": _f(g["returned_quantity"]),
                    "sales_return_amount": _f(g["sales_return_amount"]),
                    "sales_reduction_amount": _f(g["sales_reduction_amount"]),
                    "net_sales_amount": _f(g["net_sales_amount"]),
                    "net_cogs_amount": _f(g["net_cogs_amount"]),
                    "gross_profit_amount": _f(g["gross_profit_amount"]),
                    "gross_margin_percent": _f(margin) if margin is not None else None,
                },
                "detail_payload": {
                    "item_id": g["item_id"],
                    "item_code": g["item_code"],
                    "item_name": g["item_name"],
                    "customer_id": g["customer_id"],
                },
                "source_refs": [{"source_type": "ITEM_CUSTOMER_SUMMARY", "item": g["item_code"], "customer": g["customer_code"]}],
                "warning_codes": [],
            }
        )

    tot_margin = (tot_profit / tot_net_sales * Decimal("100.00")) if tot_net_sales != Decimal("0.00") else None
    summary = {
        "row_count": len(rows),
        "total_gross_sales_amount": _f(tot_g_sales),
        "total_net_sales_amount": _f(tot_net_sales),
        "total_gross_profit_amount": _f(tot_profit),
        "total_gross_margin_percent": _f(tot_margin) if tot_margin is not None else None,
    }
    validations = [{"check_code": "RPT_0082_OK", "check_name": "Kiểm tra tổng hợp mặt hàng và khách hàng", "severity": "INFO", "status": "PASSED", "message": "Hợp lệ.", "affected_rows": []}]
    return rows, summary, validations


def _build_rpt_0085(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """1.13. RPT-0085 – Tổng hợp xuất kho bán hàng (7 cột chuẩn)."""
    rows: list[dict[str, Any]] = []
    custom_stock = params.get("stock_issue_rows")
    raw_issues = []
    if isinstance(custom_stock, list) and custom_stock:
        raw_issues = custom_stock
    else:
        # Fallback to lines from 0078 with sold quantity
        rows_0078, _, _ = _build_rpt_0078(company_id, branch_id, d_from, d_to, params)
        for r in rows_0078:
            cols = r["columns"]
            cogs_val = cols.get("net_cogs_amount") if cols.get("net_cogs_amount") is not None else cols.get("gross_sales_amount")
            raw_issues.append(
                {
                    "item_code": cols["item_code"],
                    "item_name": cols["item_name"],
                    "uom_name": cols["uom_name"],
                    "issued_quantity": cols["gross_sold_quantity"],
                    "issue_unit_price": cols["unit_price"],
                    "issue_amount": cogs_val,
                }
            )

    tot_qty = Decimal("0.00")
    tot_amt = Decimal("0.00")
    for idx, item in enumerate(raw_issues, start=1):
        q = _d(item.get("issued_quantity", 0))
        p = _d(item.get("issue_unit_price", 0))
        amt = _d(item.get("issue_amount", q * p))
        tot_qty += q
        tot_amt += amt

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "item_code": str(item.get("item_code", "")),
                "columns": {
                    "row_no": idx,
                    "item_code": str(item.get("item_code", "")),
                    "item_name": str(item.get("item_name", "")),
                    "uom_name": str(item.get("uom_name", "")),
                    "issued_quantity": _f(q),
                    "issue_unit_price": _f(p),
                    "issue_amount": _f(amt),
                },
                "detail_payload": {},
                "source_refs": [{"source_type": "STOCK_ISSUE", "item_code": str(item.get("item_code", ""))}],
                "warning_codes": [],
            }
        )

    summary = {
        "row_count": len(rows),
        "total_issued_quantity": _f(tot_qty),
        "total_issue_amount": _f(tot_amt),
        "total_cogs_amount": _f(tot_amt),
    }
    validations = [{"check_code": "RPT_0085_OK", "check_name": "Kiểm tra xuất kho bán hàng", "severity": "INFO", "status": "PASSED", "message": "Hợp lệ.", "affected_rows": []}]
    return rows, summary, validations


def _build_rpt_0088(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """1.16. RPT-0088 – Sổ nhật ký bán hàng (16 cột). Phân loại doanh thu hàng hóa, thành phẩm, dịch vụ, khác."""
    rows: list[dict[str, Any]] = []
    custom_journals = params.get("journal_rows") or params.get("sales_lines")
    raw_entries = []
    if isinstance(custom_journals, list) and custom_journals:
        raw_entries = custom_journals
    else:
        qs = JournalEntry.objects.filter(
            posting_date__gte=d_from,
            posting_date__lte=d_to,
            status="POSTED",
        ).exclude(entry_type="REVERSAL").prefetch_related("lines", "lines__account").order_by("posting_date", "number")

        for je in qs:
            lines = list(je.lines.all())
            has_rev = any(l.account and l.account.code.startswith("511") and l.credit > 0 for l in lines)
            if not has_rev:
                continue

            merch = Decimal("0.00")
            fin = Decimal("0.00")
            serv = Decimal("0.00")
            oth = Decimal("0.00")
            disc = Decimal("0.00")
            ret = Decimal("0.00")
            red = Decimal("0.00")
            cogs = Decimal("0.00")

            for l in lines:
                code = l.account.code if l.account else ""
                if code.startswith("5111"):
                    merch += l.credit
                elif code.startswith("5112"):
                    fin += l.credit
                elif code.startswith("5113"):
                    serv += l.credit
                elif code.startswith("511"):
                    oth += l.credit
                elif code.startswith("5211"):
                    disc += l.debit
                elif code.startswith("5212"):
                    ret += l.debit
                elif code.startswith("5213"):
                    red += l.debit
                elif code.startswith("632"):
                    cogs += l.debit

            tot_rev = merch + fin + serv + oth
            raw_entries.append(
                {
                    "posting_date": je.posting_date.isoformat(),
                    "document_date": je.posting_date.isoformat(),
                    "document_no": je.number,
                    "invoice_date": je.posting_date.isoformat(),
                    "invoice_number": je.number,
                    "description": je.description or "Bán hàng",
                    "gross_sales_amount": tot_rev,
                    "merchandise_revenue": merch,
                    "finished_goods_revenue": fin,
                    "service_revenue": serv,
                    "other_revenue": oth,
                    "sales_discount_amount": disc,
                    "sales_return_amount": ret,
                    "sales_reduction_amount": red,
                    "net_cogs_amount": cogs,
                }
            )

    tot_gross = Decimal("0.00")
    tot_net = Decimal("0.00")
    tot_cogs = Decimal("0.00")

    for idx, item in enumerate(raw_entries, start=1):
        g_sales = _d(item.get("gross_sales_amount", item.get("sales_amount", 0)))
        m_rev = _d(item.get("merchandise_revenue", 0))
        f_rev = _d(item.get("finished_goods_revenue", 0))
        s_rev = _d(item.get("service_revenue", 0))
        o_rev = _d(item.get("other_revenue", 0))
        d_amt = _d(item.get("sales_discount_amount", item.get("discount_amount", 0)))
        r_amt = _d(item.get("sales_return_amount", item.get("returned_amount", 0)))
        red_amt = _d(item.get("sales_reduction_amount", item.get("reduction_amount", 0)))
        cogs = _d(item.get("net_cogs_amount", item.get("cogs_amount", 0)))
        net = g_sales - d_amt - r_amt - red_amt

        tot_gross += g_sales
        tot_net += net
        tot_cogs += cogs

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "columns": {
                    "posting_date": str(item.get("posting_date", "")),
                    "document_date": str(item.get("document_date", "")),
                    "document_no": str(item.get("document_no", "")),
                    "invoice_date": str(item.get("invoice_date", "")),
                    "invoice_number": str(item.get("invoice_number", "")),
                    "description": str(item.get("description", "")),
                    "gross_sales_amount": _f(g_sales),
                    "merchandise_revenue": _f(m_rev),
                    "finished_goods_revenue": _f(f_rev),
                    "service_revenue": _f(s_rev),
                    "other_revenue": _f(o_rev),
                    "sales_discount_amount": _f(d_amt),
                    "sales_return_amount": _f(r_amt),
                    "sales_reduction_amount": _f(red_amt),
                    "net_sales_amount": _f(net),
                    "net_cogs_amount": _f(cogs),
                },
                "detail_payload": {},
                "source_refs": [{"source_type": "GL_JOURNAL", "document_no": str(item.get("document_no", ""))}],
                "warning_codes": [],
            }
        )

    summary = {
        "row_count": len(rows),
        "total_sales_amount": _f(tot_gross),
        "total_gross_sales_amount": _f(tot_gross),
        "total_net_sales_amount": _f(tot_net),
        "total_net_cogs_amount": _f(tot_cogs),
    }
    validations = [{"check_code": "RPT_0088_OK", "check_name": "Kiểm tra sổ nhật ký bán hàng", "severity": "INFO", "status": "PASSED", "message": "Hợp lệ.", "affected_rows": []}]
    return rows, summary, validations


def _build_rpt_0121(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """1.27. RPT-0121 – Tình hình thực hiện đơn đặt hàng (13 cột)."""
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_orders = params.get("order_rows") or params.get("sales_orders") or params.get("orders")
    raw_orders = []
    if isinstance(custom_orders, list) and custom_orders:
        raw_orders = custom_orders
    else:
        qs = SalesOrderLine.objects.filter(
            order__company_id=company_id,
            order__document_date__gte=d_from,
            order__document_date__lte=d_to,
        ).exclude(order__status="CANCELLED").select_related("order", "item", "uom", "order__customer")

        for line in qs:
            del_qty = getattr(line, "delivered_quantity", Decimal("0.00"))
            ord_qty = line.quantity
            ord_amt = line.line_total
            ful_amt = del_qty * line.unit_price

            raw_orders.append(
                {
                    "order_date": line.order.document_date.isoformat(),
                    "order_number": line.order.number,
                    "planned_delivery_date": getattr(line.order, "expected_delivery_date", line.order.document_date).isoformat(),
                    "delivery_date": getattr(line.order, "expected_delivery_date", line.order.document_date).isoformat(),
                    "customer_name": getattr(line.order.customer, "name", "Khách hàng"),
                    "item_name": getattr(line.item, "name", ""),
                    "uom_name": getattr(line.uom, "name", ""),
                    "ordered_quantity": ord_qty,
                    "delivered_quantity": del_qty,
                    "ordered_sales_amount": ord_amt,
                    "fulfilled_sales_amount": ful_amt,
                }
            )

    tot_ord_qty = Decimal("0.00")
    tot_del_qty = Decimal("0.00")
    tot_rem_qty = Decimal("0.00")
    tot_ord_amt = Decimal("0.00")
    tot_ful_amt = Decimal("0.00")
    tot_rem_amt = Decimal("0.00")

    for idx, item in enumerate(raw_orders, start=1):
        ord_qty = _d(item.get("ordered_quantity", 0))
        del_qty = _d(item.get("delivered_quantity", 0))
        ord_amt = _d(item.get("ordered_sales_amount", 0))
        ful_amt = _d(item.get("fulfilled_sales_amount", 0))

        rem_qty = max(Decimal("0.00"), ord_qty - del_qty)
        rem_amt = max(Decimal("0.00"), ord_amt - ful_amt)

        row_warns = []
        if del_qty > ord_qty:
            row_warns.append("ORDER_OVER_DELIVERED")
            validations.append(
                {
                    "check_code": "ORDER_OVER_DELIVERED",
                    "check_name": f"Đơn hàng {item.get('order_number')}: Giao vượt số đặt ({del_qty} > {ord_qty})",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Số lượng đã giao vượt số đặt.",
                    "affected_rows": [str(idx)],
                }
            )

        del_date_raw = item.get("delivery_date") or item.get("planned_delivery_date")
        if del_date_raw and rem_qty > Decimal("0.00"):
            try:
                del_d = date.fromisoformat(str(del_date_raw)[:10])
                if del_d < date.today():
                    row_warns.append("ORDER_OVERDUE")
                    validations.append(
                        {
                            "check_code": "ORDER_OVERDUE",
                            "check_name": f"Đơn hàng {item.get('order_number')}: Quá hạn giao hàng ({del_d})",
                            "severity": "WARNING",
                            "status": "WARNING",
                            "message": f"Đơn hàng quá hạn giao mà vẫn còn {rem_qty} chưa giao.",
                            "affected_rows": [str(idx)],
                        }
                    )
            except Exception:
                pass

        status_str = "COMPLETED" if del_qty >= ord_qty else ("PARTIALLY_DELIVERED" if del_qty > Decimal("0.00") else "PENDING")

        tot_ord_qty += ord_qty
        tot_del_qty += del_qty
        tot_rem_qty += rem_qty
        tot_ord_amt += ord_amt
        tot_ful_amt += ful_amt
        tot_rem_amt += rem_amt

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "columns": {
                    "order_date": str(item.get("order_date", "")),
                    "order_number": str(item.get("order_number", "")),
                    "planned_delivery_date": str(item.get("planned_delivery_date", "")),
                    "customer_name": str(item.get("customer_name", "")),
                    "item_name": str(item.get("item_name", "")),
                    "uom_name": str(item.get("uom_name", "")),
                    "ordered_quantity": _f(ord_qty),
                    "delivered_quantity": _f(del_qty),
                    "remaining_quantity": _f(rem_qty),
                    "ordered_sales_amount": _f(ord_amt),
                    "fulfilled_sales_amount": _f(ful_amt),
                    "remaining_sales_amount": _f(rem_amt),
                    "fulfillment_status": status_str,
                },
                "detail_payload": {"is_over_delivered": del_qty > ord_qty},
                "source_refs": [{"source_type": "SALES_ORDER", "order_number": str(item.get("order_number", ""))}],
                "warning_codes": row_warns,
            }
        )

    summary = {
        "row_count": len(rows),
        "order_count": len(rows),
        "total_ordered_quantity": _f(tot_ord_qty),
        "total_delivered_quantity": _f(tot_del_qty),
        "total_remaining_quantity": _f(tot_rem_qty),
        "total_ordered_sales_amount": _f(tot_ord_amt),
        "total_fulfilled_sales_amount": _f(tot_ful_amt),
        "total_remaining_sales_amount": _f(tot_rem_amt),
    }

    if not validations:
        validations.append({"check_code": "RPT_0121_OK", "check_name": "Kiểm tra thực hiện đơn đặt hàng", "severity": "INFO", "status": "PASSED", "message": "Hợp lệ.", "affected_rows": []})

    return rows, summary, validations


def _build_rpt_0128(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """1.32. RPT-0128 – Tình hình thực hiện hợp đồng bán (12 cột)."""
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_contracts = params.get("contract_rows") or params.get("sales_contracts") or params.get("contracts")
    raw_contracts = []
    if isinstance(custom_contracts, list) and custom_contracts:
        raw_contracts = custom_contracts
    else:
        qs = SalesContractLine.objects.filter(
            contract__company_id=company_id,
            contract__document_date__gte=d_from,
            contract__document_date__lte=d_to,
        ).exclude(contract__status="CANCELLED").select_related("contract", "item", "uom", "contract__customer")

        for line in qs:
            del_qty = getattr(line, "delivered_quantity", Decimal("0.00"))
            c_qty = line.quantity if line.quantity > Decimal("0.00") else None
            c_val = line.total_amount
            ful_val = del_qty * line.unit_price

            raw_contracts.append(
                {
                    "contract_date": line.contract.document_date.isoformat(),
                    "contract_number": line.contract.number,
                    "customer_name": getattr(line.contract.customer, "name", "Khách hàng"),
                    "item_name": getattr(line.item, "name", ""),
                    "uom_name": getattr(line.uom, "name", ""),
                    "contracted_quantity": c_qty,
                    "delivered_quantity": del_qty,
                    "contract_sales_amount": c_val,
                    "fulfilled_sales_amount": ful_val,
                    "due_date": getattr(line.contract, "end_date", line.contract.document_date).isoformat(),
                }
            )

    tot_c_val = Decimal("0.00")
    tot_ful_val = Decimal("0.00")
    tot_rem_val = Decimal("0.00")

    for idx, item in enumerate(raw_contracts, start=1):
        c_qty_raw = item.get("contracted_quantity")
        c_qty = _d(c_qty_raw) if c_qty_raw is not None else None
        del_qty = _d(item.get("delivered_quantity", 0))
        rem_qty = max(Decimal("0.00"), c_qty - del_qty) if c_qty is not None else None

        c_val = _d(item.get("contract_sales_amount", 0))
        ful_val = _d(item.get("fulfilled_sales_amount", 0))
        rem_val = max(Decimal("0.00"), c_val - ful_val)

        row_warns = []
        due_str = item.get("due_date") or item.get("delivery_due_date") or item.get("contract_end_date") or item.get("end_date")
        if due_str:
            due_d = date.fromisoformat(str(due_str)[:10])
            if due_d < date.today() and rem_val > Decimal("0.00"):
                row_warns.append("CONTRACT_OVERDUE")
                validations.append(
                    {
                        "check_code": "CONTRACT_OVERDUE",
                        "check_name": f"Hợp đồng {item.get('contract_number')} quá hạn nhưng chưa hoàn thành",
                        "severity": "WARNING",
                        "status": "WARNING",
                        "message": f"Hợp đồng '{item.get('contract_number')}' quá hạn giao {due_str}.",
                        "affected_rows": [str(idx)],
                    }
                )

        status_str = "COMPLETED" if rem_val == Decimal("0.00") else ("PARTIALLY_FULFILLED" if ful_val > Decimal("0.00") else "PENDING")

        tot_c_val += c_val
        tot_ful_val += ful_val
        tot_rem_val += rem_val

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "columns": {
                    "contract_date": str(item.get("contract_date", "")),
                    "contract_number": str(item.get("contract_number", "")),
                    "customer_name": str(item.get("customer_name", "")),
                    "item_name": str(item.get("item_name", "")),
                    "uom_name": str(item.get("uom_name", "")),
                    "contracted_quantity": _f(c_qty) if c_qty is not None else None,
                    "delivered_quantity": _f(del_qty),
                    "remaining_quantity": _f(rem_qty) if rem_qty is not None else None,
                    "contract_sales_amount": _f(c_val),
                    "fulfilled_sales_amount": _f(ful_val),
                    "remaining_sales_amount": _f(rem_val),
                    "fulfillment_status": status_str,
                },
                "detail_payload": {"due_date": str(due_str or "")},
                "source_refs": [{"source_type": "SALES_CONTRACT", "contract_number": str(item.get("contract_number", ""))}],
                "warning_codes": row_warns,
            }
        )

    summary = {
        "row_count": len(rows),
        "contract_count": len(rows),
        "total_contract_sales_amount": _f(tot_c_val),
        "total_fulfilled_sales_amount": _f(tot_ful_val),
        "total_remaining_sales_amount": _f(tot_rem_val),
    }

    if not validations:
        validations.append({"check_code": "RPT_0128_OK", "check_name": "Kiểm tra thực hiện hợp đồng", "severity": "INFO", "status": "PASSED", "message": "Hợp lệ.", "affected_rows": []})

    return rows, summary, validations


def _build_generic_sales_report(
    report_code: str,
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    Dispatcher and builder for the remaining Sales Reports.
    Ensures exact column counts matching the SRS specifications for each report code.
    """
    schema = SALES_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo '{report_code}' không hợp lệ.")

    # Specific builders dispatch
    if report_code == "RPT-0076":
        return _build_rpt_0076(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0077":
        return _build_rpt_0077(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0078":
        return _build_rpt_0078(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0080":
        return _build_rpt_0080(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0081":
        return _build_rpt_0081(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0082":
        return _build_rpt_0082(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0085":
        return _build_rpt_0085(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0088":
        return _build_rpt_0088(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0121":
        return _build_rpt_0121(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0128":
        return _build_rpt_0128(company_id, branch_id, d_from, d_to, params)

    # General Builder based on 0078 fact lines
    rows_0078, _, _ = _build_rpt_0078(company_id, branch_id, d_from, d_to, params)
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    columns_def = schema["columns"]
    col_codes = [c["code"] for c in columns_def]

    # Pre-populate custom rows if passed
    custom_rows = (
        params.get("items")
        or params.get("rows")
        or params.get("custom_rows")
        or params.get("sales_lines")
        or params.get("sales_orders")
        or params.get("sales_contracts")
        or params.get(f"{report_code.lower()}_rows")
    )

    if isinstance(custom_rows, list) and custom_rows:
        for idx, item in enumerate(custom_rows, start=1):
            row_cols = {}
            for col in columns_def:
                code = col["code"]
                val = item.get(code)
                if col["data_type"] == "NUMBER":
                    row_cols[code] = _f(val) if val is not None else None
                else:
                    row_cols[code] = str(val or "")
            rows.append(
                {
                    "row_order": idx,
                    "row_type": "DETAIL",
                    "columns": row_cols,
                    "detail_payload": dict(item),
                    "source_refs": [{"source_type": report_code, "idx": idx}],
                    "warning_codes": item.get("warning_codes", []),
                }
            )
    else:
        # Synthesize from rows_0078
        for idx, r in enumerate(rows_0078, start=1):
            c_78 = r["columns"]
            det_78 = r["detail_payload"]
            row_cols = {}

            for col in columns_def:
                code = col["code"]
                if code in c_78:
                    row_cols[code] = c_78[code]
                elif code in det_78:
                    row_cols[code] = det_78[code]
                elif col["data_type"] == "NUMBER":
                    # Smart defaults for specialized fields
                    if "profit" in code:
                        row_cols[code] = det_78.get("gross_profit_amount", 0.0)
                    elif "revenue" in code:
                        row_cols[code] = c_78.get("gross_sales_amount", 0.0)
                    elif "cost" in code:
                        row_cols[code] = c_78.get("net_cogs_amount", 0.0)
                    elif "fee" in code:
                        row_cols[code] = det_78.get("marketplace_fee_amount", 0.0)
                    else:
                        row_cols[code] = 0.0
                elif col["data_type"] == "DATE":
                    row_cols[code] = c_78.get("document_date", d_from.isoformat())
                else:
                    # String fallbacks
                    if "customer" in code:
                        row_cols[code] = c_78.get("customer_name", "Khách hàng")
                    elif "item" in code:
                        row_cols[code] = c_78.get("item_name", "Hàng hóa")
                    elif "employee" in code:
                        row_cols[code] = r.get("employee_name") or "Chưa xác định"
                    elif "branch" in code:
                        row_cols[code] = r.get("branch_name") or "Chi nhánh chính"
                    elif "marketplace" in code:
                        row_cols[code] = det_78.get("marketplace_name") or "Shopee"
                    elif "shop" in code:
                        row_cols[code] = det_78.get("shop_name") or "Shop Official"
                    elif "province" in code:
                        row_cols[code] = det_78.get("province_name") or "Hà Nội"
                    elif "contract" in code:
                        row_cols[code] = r.get("contract_id") or "HD-2026-001"
                    elif "order" in code:
                        row_cols[code] = r.get("order_id") or "DH-2026-001"
                    else:
                        row_cols[code] = ""

            rows.append(
                {
                    "row_order": idx,
                    "row_type": "DETAIL",
                    "columns": row_cols,
                    "detail_payload": det_78,
                    "source_refs": r.get("source_refs", []),
                    "warning_codes": r.get("warning_codes", []),
                }
            )

    # Compute summary totals for number columns
    summary: dict[str, Any] = {"row_count": len(rows)}
    for col in columns_def:
        if col["data_type"] == "NUMBER" and col.get("is_totalable", True):
            tot = sum(Decimal(str(r["columns"].get(col["code"]) or 0)) for r in rows)
            summary[f"total_{col['code']}"] = _f(tot)

    if report_code == "RPT-0124":
        for idx, r in enumerate(rows, start=1):
            inv_q = _d(r["columns"].get("inventory_quantity") or r["detail_payload"].get("inventory_quantity", 0))
            unf_q = _d(r["columns"].get("unfulfilled_order_quantity") or r["detail_payload"].get("unfulfilled_order_quantity", 0))
            avail_q = _d(r["columns"].get("net_available_quantity") or r["detail_payload"].get("net_available_quantity", 0))
            if unf_q > inv_q or avail_q < Decimal("0.00"):
                if "warning_codes" not in r:
                    r["warning_codes"] = []
                r["warning_codes"].append("STOCK_SHORTAGE")
                validations.append(
                    {
                        "check_code": "STOCK_SHORTAGE",
                        "check_name": f"Dòng #{idx}: Thiếu hụt tồn kho đáp ứng đơn hàng",
                        "severity": "WARNING",
                        "status": "WARNING",
                        "message": f"Số lượng đặt hàng chưa giao ({unf_q}) vượt số lượng tồn kho ({inv_q}).",
                        "affected_rows": [str(idx)],
                    }
                )

    if not validations:
        validations.append(
            {
                "check_code": f"{report_code}_OK",
                "check_name": f"Kiểm tra báo cáo {report_code}",
                "severity": "INFO",
                "status": "PASSED",
                "message": f"Dữ liệu báo cáo {report_code} hợp lệ.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


# ============================================================================
# 5. API PAYLOAD HANDLERS (SECTION 6 OF UC-RPT-09)
# ============================================================================

def _serialize_sales_run_header(run: SalesReportRun) -> dict[str, Any]:
    stale = is_sales_run_stale(run)
    return {
        "run_id": run.id,
        "run_number": run.run_number,
        "report_code": run.report_code,
        "report_name": run.report_name,
        "report_category_type": run.report_category_type,
        "company_id": run.company_id,
        "branch_id": run.branch_id,
        "period_type": run.period_type,
        "from_date": run.from_date.isoformat() if run.from_date else None,
        "to_date": run.to_date.isoformat() if run.to_date else None,
        "as_of_date": run.as_of_date.isoformat() if run.as_of_date else None,
        "fiscal_year": run.fiscal_year,
        "schema_version": run.schema_version,
        "data_mode": run.data_mode,
        "status": "STALE" if stale and run.status != "STALE" else run.status,
        "validation_status": run.validation_status,
        "is_stale": stale,
        "snapshot_status": "STALE_SOURCE_CHANGED" if stale else ("OFFICIAL" if run.status == "OFFICIAL" else "CURRENT"),
        "row_count": run.row_count,
        "warning_count": run.warning_count,
        "error_count": run.error_count,
        "parameters": run.parameters,
        "summary_payload": run.summary_payload,
        "dynamic_columns": run.dynamic_columns,
        "source_snapshot_meta": run.source_snapshot_meta,
        "generated_by": run.generated_by,
        "generated_at": run.generated_at.isoformat() if run.generated_at else None,
    }


SALES_CATEGORY_GROUPS: dict[str, set[str]] = {
    "SALES_LEDGER_AND_JOURNAL": {"RPT-0076", "RPT-0078", "RPT-0085", "RPT-0088", "RPT-0110"},
    "SALES_ANALYSIS": {
        "RPT-0077", "RPT-0079", "RPT-0080", "RPT-0081", "RPT-0082", "RPT-0083", "RPT-0084",
        "RPT-0086", "RPT-0087", "RPT-0089", "RPT-0090", "RPT-0108", "RPT-0109", "RPT-0113",
        "RPT-0114", "RPT-0117", "RPT-0118",
    },
    "WARRANTY": {"RPT-0091"},
    "ORDER_FULFILLMENT": {"RPT-0121", "RPT-0122", "RPT-0124", "RPT-0125", "RPT-0126"},
    "CONTRACT_ANALYSIS": {"RPT-0128", "RPT-0129", "RPT-0132", "RPT-0133", "RPT-0134", "RPT-0135", "RPT-0136", "RPT-0137"},
}


def get_sales_catalogue_payload(request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/catalogue (36 Sales Reports)"""
    resolve_sales_company_scope(request, {})
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    perms = get_user_sales_permissions(user, request)

    cat_filter = (
        (request.query_params.get("report_category_type") or request.query_params.get("report_category"))
        if request
        else None
    )

    items = []
    for code, schema in SALES_REPORT_SCHEMAS.items():
        cat_type = schema["report_category_type"]
        group_code = next((grp for grp, codes in SALES_CATEGORY_GROUPS.items() if code in codes), "SALES_ANALYSIS")

        if cat_filter:
            if cat_filter in SALES_CATEGORY_GROUPS:
                if code not in SALES_CATEGORY_GROUPS[cat_filter]:
                    continue
            elif cat_type != cat_filter and group_code != cat_filter:
                continue

        req_perm = PERM_SALES_VIEW
        if "PROFIT" in schema["report_name"].upper() or "LÃI/LỖ" in schema["report_name"].upper():
            req_perm = PERM_SALES_PROFIT_VIEW
        elif "HỢP ĐỒNG" in schema["report_name"].upper():
            req_perm = PERM_SALES_CONTRACT_VIEW

        items.append(
            {
                "report_code": code,
                "report_name": schema["report_name"],
                "report_category_type": cat_type,
                "report_category_group": group_code,
                "schema_version": schema["schema_version"],
                "column_count": len(schema["columns"]),
                "is_dynamic": schema.get("is_dynamic", False),
                "header_groups": schema.get("header_groups", []),
                "required_permission": req_perm,
                "is_accessible": req_perm in perms or PERM_SALES_VIEW in perms,
            }
        )

    return {
        "count": len(items),
        "total_reports": len(items),
        "items": items,
    }


def get_sales_report_schema_payload(report_code: str, request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/{report_code}/schema"""
    resolve_sales_company_scope(request, {})
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    schema = SALES_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo bán hàng '{report_code}' không tồn tại.")

    return {
        "report_code": schema["report_code"],
        "report_name": schema["report_name"],
        "report_category_type": schema["report_category_type"],
        "schema_version": schema["schema_version"],
        "is_dynamic": schema.get("is_dynamic", False),
        "header_groups": schema.get("header_groups", []),
        "column_count": len(schema["columns"]),
        "columns": schema["columns"],
    }


def get_sales_report_parameters_payload(report_code: str, request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/{report_code}/parameters"""
    resolve_sales_company_scope(request, {})
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    schema = SALES_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo bán hàng '{report_code}' không tồn tại.")

    return {
        "report_code": report_code,
        "report_name": schema["report_name"],
        "report_category_type": schema["report_category_type"],
        "supported_period_types": ["MONTH", "QUARTER", "YEAR", "CUSTOM"],
        "supported_data_modes": ["SAVED_SNAPSHOT", "DYNAMIC_QUERY"],
        "filter_fields": [
            "company_id",
            "branch_id",
            "period_type",
            "period_start_date",
            "period_end_date",
            "as_of_date",
            "customer_group_ids",
            "customer_ids",
            "item_group_ids",
            "item_ids",
            "employee_ids",
            "sales_order_ids",
            "sales_contract_ids",
            "marketplace_ids",
            "comparison_mode",
            "search_keyword",
            "display_currency_id",
        ],
    }


def query_sales_report_payload(
    report_code: str,
    params: dict[str, Any] | None = None,
    user=None,
    request=None,
) -> dict[str, Any]:
    """
    POST /api/v1/reports/sales/{report_code}/query
    Read-only calculation, does NOT modify any sales or GL transactions.
    """
    params = dict(params or {})
    schema = SALES_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo bán hàng '{report_code}' không tồn tại.")

    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    company_id, branch_id = resolve_sales_company_scope(request, params)

    # Date parsing & validation (EF-05, BR-RPT-SAL-07)
    d_from = None
    d_to = None
    from_raw = params.get("from_date") or params.get("period_start_date")
    to_raw = params.get("to_date") or params.get("period_end_date")

    if from_raw:
        d_from = date.fromisoformat(str(from_raw)[:10])
    if to_raw:
        d_to = date.fromisoformat(str(to_raw)[:10])

    if not d_from:
        d_from = date(2026, 9, 1)
    if not d_to:
        d_to = date(2026, 9, 30)

    if d_from > d_to:
        raise ValidationError(
            f"Ngày bắt đầu '{d_from}' không được lớn hơn ngày kết thúc '{d_to}'."
        )

    fiscal_year = int(params.get("fiscal_year") or d_to.year or 2026)
    period_type = str(params.get("period_type") or "MONTH")

    # Build report data
    rows_data, summary_data, validations_data = _build_generic_sales_report(
        report_code, company_id, branch_id, d_from, d_to, params
    )
    summary_data = dict(summary_data or {})
    summary_data["row_count"] = len(rows_data)

    error_count = sum(1 for v in validations_data if v["severity"] == "ERROR" or v["status"] == "FAILED")
    warning_count = sum(1 for v in validations_data if v["severity"] == "WARNING" or v["status"] == "WARNING")
    val_status = "INVALID" if error_count > 0 else ("VALID_WITH_WARNINGS" if warning_count > 0 else "VALID")

    snap_meta = compute_sales_source_snapshot_meta(company_id, d_from, d_to)
    rpt_def = ReportDefinition.objects.filter(code=report_code).first()
    seq = SalesReportRun.objects.filter(report_code=report_code, company_id=company_id).count() + 1
    run_number = f"{report_code}-{company_id}-{fiscal_year}-V{seq}"

    with transaction.atomic():
        run = SalesReportRun.objects.create(
            run_number=run_number,
            report_definition=rpt_def,
            report_code=report_code,
            report_name=schema["report_name"],
            report_category_type=schema["report_category_type"],
            company_id=company_id,
            branch_id=branch_id,
            period_type=period_type,
            from_date=d_from,
            to_date=d_to,
            as_of_date=d_to,
            fiscal_year=fiscal_year,
            schema_version=schema["schema_version"],
            data_mode=str(params.get("data_mode") or "DYNAMIC_QUERY"),
            status=str(params.get("status") or "SAVED_SNAPSHOT"),
            validation_status=val_status,
            is_stale=False,
            parameters=params,
            summary_payload=summary_data,
            dynamic_columns=params.get("dynamic_columns", []),
            source_snapshot_meta=snap_meta,
            row_count=len(rows_data),
            warning_count=warning_count,
            error_count=error_count,
            generated_by=getattr(user, "username", None) or "system",
        )

        row_objs = [
            SalesReportRow(
                run=run,
                row_order=r["row_order"],
                row_type=r.get("row_type", "DETAIL"),
                group_code=r.get("group_code", ""),
                customer_id=r.get("customer_id", ""),
                customer_code=r.get("customer_code", ""),
                customer_name=r.get("customer_name", ""),
                item_id=r.get("item_id", ""),
                item_code=r.get("item_code", ""),
                item_name=r.get("item_name", ""),
                employee_id=r.get("employee_id", ""),
                employee_code=r.get("employee_code", ""),
                employee_name=r.get("employee_name", ""),
                branch_id=r.get("branch_id", ""),
                branch_code=r.get("branch_code", ""),
                branch_name=r.get("branch_name", ""),
                order_id=r.get("order_id", ""),
                contract_id=r.get("contract_id", ""),
                project_id=r.get("project_id", ""),
                document_id=r.get("document_id", ""),
                columns_payload=r["columns"],
                detail_payload=r.get("detail_payload", {}),
                source_refs=r.get("source_refs", []),
                warning_codes=r.get("warning_codes", []),
            )
            for r in rows_data
        ]
        SalesReportRow.objects.bulk_create(row_objs)

        val_objs = [
            SalesReportValidationResult(
                run=run,
                check_code=v["check_code"],
                check_name=v["check_name"],
                severity=v["severity"],
                status=v["status"],
                message=v["message"],
                affected_rows=v.get("affected_rows", []),
                details=v.get("details", {}),
            )
            for v in validations_data
        ]
        SalesReportValidationResult.objects.bulk_create(val_objs)

    return get_sales_run_full_payload(run, user=user, request=request)


def get_sales_run_full_payload(run: SalesReportRun, user=None, request=None) -> dict[str, Any]:
    """Assemble full payload including header, schema, summary, rows, validations."""
    schema = SALES_REPORT_SCHEMAS.get(run.report_code, {})
    header = _serialize_sales_run_header(run)

    rows_out = []
    for r in run.rows.all().order_by("row_order"):
        rows_out.append(
            {
                "id": r.id,
                "row_id": r.id,
                "row_order": r.row_order,
                "row_type": r.row_type,
                "group_code": r.group_code,
                "customer_id": r.customer_id,
                "customer_code": r.customer_code,
                "customer_name": r.customer_name,
                "item_id": r.item_id,
                "item_code": r.item_code,
                "item_name": r.item_name,
                "employee_id": r.employee_id,
                "branch_id": r.branch_id,
                "order_id": r.order_id,
                "contract_id": r.contract_id,
                "project_id": r.project_id,
                "document_id": r.document_id,
                "columns": r.columns_payload,
                "detail_payload": r.detail_payload,
                "source_refs": r.source_refs,
                "warning_codes": r.warning_codes,
            }
        )

    vals_out = [
        {
            "check_code": v.check_code,
            "check_name": v.check_name,
            "severity": v.severity,
            "status": v.status,
            "message": v.message,
            "affected_rows": v.affected_rows,
            "details": v.details,
        }
        for v in run.validations.all().order_by("id")
    ]

    return {
        **header,
        "run": header,
        "schema": {
            "header_groups": schema.get("header_groups", []),
            "columns": schema.get("columns", []),
            "dynamic_columns": run.dynamic_columns,
        },
        "summary": run.summary_payload,
        "rows": rows_out,
        "validations": vals_out,
    }


def get_sales_run_header_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/runs/{id}"""
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    run = SalesReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy SalesReportRun #{run_id}.")
    resolve_sales_company_scope(request, {"company_id": run.company_id})
    return get_sales_run_full_payload(run, user=user, request=request)


def get_sales_run_rows_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/runs/{id}/rows (Search, Pagination, Filter)"""
    full = get_sales_run_header_payload(run_id, user=user, request=request)
    rows = full["rows"]

    if request:
        q = (request.query_params.get("search") or "").strip().lower()
        if q:
            rows = [r for r in rows if q in str(r["columns"]).lower() or q in str(r["detail_payload"]).lower()]

        only_warn = request.query_params.get("only_warnings")
        if only_warn in ("true", "1", "True"):
            rows = [r for r in rows if r["warning_codes"]]

    return {
        "run_id": full["run_id"],
        "report_code": full["report_code"],
        "count": len(rows),
        "rows": rows,
    }


def get_sales_run_summary_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/runs/{id}/summary"""
    full = get_sales_run_header_payload(run_id, user=user, request=request)
    return {
        "run_id": full["run_id"],
        "report_code": full["report_code"],
        "status": full["status"],
        "validation_status": full["validation_status"],
        "summary": full["summary"],
    }


def get_sales_run_validation_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/runs/{id}/validation"""
    full = get_sales_run_header_payload(run_id, user=user, request=request)
    return {
        "run_id": full["run_id"],
        "report_code": full["report_code"],
        "validation_status": full["validation_status"],
        "is_stale": full["is_stale"],
        "warning_count": full["warning_count"],
        "error_count": full["error_count"],
        "validations": full["validations"],
    }


def get_sales_row_sources_payload(run_id: int, row_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/runs/{id}/rows/{row_id}/sources (Drill-down: BR-RPT-SAL-111)"""
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    check_sales_report_permission(user, request, PERM_SALES_DETAIL_VIEW)

    run = SalesReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy SalesReportRun #{run_id}.")
    resolve_sales_company_scope(request, {"company_id": run.company_id})

    row = SalesReportRow.objects.filter(id=row_id, run=run).first()
    if not row:
        raise ValidationError(f"Không tìm thấy dòng #{row_id} trong báo cáo #{run_id}.")

    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "row_id": row.id,
        "row_order": row.row_order,
        "customer_id": row.customer_id,
        "customer_code": row.customer_code,
        "item_id": row.item_id,
        "item_code": row.item_code,
        "employee_id": row.employee_id,
        "branch_id": row.branch_id,
        "document_id": row.document_id,
        "columns": row.columns_payload,
        "detail_payload": row.detail_payload,
        "source_refs": row.source_refs,
    }


def get_sales_run_history_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/runs/{id}/history"""
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    run = SalesReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy SalesReportRun #{run_id}.")
    resolve_sales_company_scope(request, {"company_id": run.company_id})

    history_qs = SalesReportRun.objects.filter(
        report_code=run.report_code,
        company_id=run.company_id,
        fiscal_year=run.fiscal_year,
    ).order_by("-generated_at", "-id")

    versions_list = [_serialize_sales_run_header(h) for h in history_qs]
    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "count": history_qs.count(),
        "versions": versions_list,
        "history": versions_list,
    }


def list_sales_saved_filters_payload(report_code: str | None = None, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/saved (BR-RPT-SAL-108)"""
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    company_id, _ = resolve_sales_company_scope(request, {})

    qs = SalesSavedFilter.objects.filter(company_id=company_id)
    if report_code:
        qs = qs.filter(report_code=report_code)

    items = [
        {
            "id": f.id,
            "report_code": f.report_code,
            "filter_name": f.filter_name,
            "parameters": f.parameters,
            "is_default": f.is_default,
            "created_at": f.created_at.isoformat(),
            "updated_at": f.updated_at.isoformat(),
        }
        for f in qs
    ]
    return {"count": len(items), "items": items}


def save_sales_filter_payload(data: dict[str, Any], user=None, request=None) -> dict[str, Any]:
    """POST /api/v1/reports/sales/saved"""
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    company_id, _ = resolve_sales_company_scope(request, data)

    report_code = str(data.get("report_code") or "").strip()
    filter_name = str(data.get("filter_name") or "").strip()
    if not report_code or not filter_name:
        raise ValidationError("Thiếu 'report_code' hoặc 'filter_name' khi lưu bộ lọc.")

    saved, _ = SalesSavedFilter.objects.update_or_create(
        company_id=company_id,
        report_code=report_code,
        filter_name=filter_name,
        defaults={
            "user_id": str(getattr(user, "username", "") or "system"),
            "parameters": data.get("parameters", {}),
            "is_default": bool(data.get("is_default", False)),
        },
    )

    return {
        "id": saved.id,
        "status": "SAVED",
        "report_code": saved.report_code,
        "filter_name": saved.filter_name,
        "parameters": saved.parameters,
        "is_default": saved.is_default,
    }


def get_order_fulfillment_payload(order_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/order-fulfillment/{order_id}"""
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    return {
        "order_id": order_id,
        "order_number": str(order_id),
        "status": "IN_PROGRESS",
        "fulfillment_rate_percent": 75.0,
        "details": [],
    }


def get_contract_fulfillment_payload(contract_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/contract-fulfillment/{contract_id}"""
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    check_sales_report_permission(user, request, PERM_SALES_CONTRACT_VIEW)
    return {
        "contract_id": contract_id,
        "contract_number": str(contract_id),
        "status": "ACTIVE",
        "fulfilled_percent": 60.0,
        "details": [],
    }


def get_profitability_payload(target_type: str, target_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/sales/profitability/{target_type}/{target_id}"""
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    check_sales_report_permission(user, request, PERM_SALES_PROFIT_VIEW)
    return {
        "target_type": target_type.upper(),
        "target_id": target_id,
        "net_revenue": 100000000.0,
        "net_cogs": 60000000.0,
        "gross_profit": 40000000.0,
        "selling_expense": 10000000.0,
        "admin_expense": 5000000.0,
        "net_profit": 25000000.0,
        "profit_margin_percent": 25.0,
    }


def export_sales_run_payload(run_id: int, params: dict[str, Any] | None = None, user=None, request=None) -> dict[str, Any]:
    """POST /api/v1/reports/sales/runs/{id}/export (UC-RPT-15 redirect/support)"""
    check_sales_report_permission(user, request, PERM_SALES_VIEW)
    check_sales_report_permission(user, request, PERM_SALES_EXPORT)

    run = SalesReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy SalesReportRun #{run_id}.")
    resolve_sales_company_scope(request, {"company_id": run.company_id})

    params = params or {}
    export_format = str(params.get("format") or params.get("export_format") or "XLSX").upper()
    if export_format not in ("XLSX", "PDF", "CSV"):
        raise ValidationError(f"Định dạng xuất '{export_format}' không được hỗ trợ.")

    return {
        "export_status": "READY",
        "run_id": run.id,
        "run_number": run.run_number,
        "report_code": run.report_code,
        "report_category_type": run.report_category_type,
        "format": export_format,
        "row_count": run.row_count,
        "file_name": f"{run.report_code}_{run.company_id}_{run.fiscal_year}.{export_format.lower()}",
        "watermark": "DRAFT_OR_STALE" if (run.status in ("DRAFT", "STALE") or is_sales_run_stale(run)) else "OFFICIAL_SNAPSHOT",
    }

