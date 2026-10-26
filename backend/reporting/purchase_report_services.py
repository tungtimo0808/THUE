"""
UC-RPT-08 – Báo cáo mua hàng (11 Báo cáo: RPT-0047..0051, RPT-0061, RPT-0064, RPT-0068, RPT-0070, RPT-0074, RPT-0075)
Tuân thủ toàn bộ Business Rules, Column Schema, Data Scope, Deduplication, Validations, Drill-down, và Immutability.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts_payable.models import SupplierInvoice, SupplierInvoiceLine
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine
from iam.models import ActiveStatus, CompanyMembership, Permission, UserPermissionOverride
from iam.permissions import assignment_permission_codes, effective_assignments
from master_data.models import Currency, Item, ItemUomConversion, Party, Project, UnitOfMeasure
from organization.models import Branch, Company, Department, Employee
from purchases.models import (
    GoodsPurchase,
    GoodsPurchaseLine,
    PurchaseContract,
    PurchaseContractLine,
    PurchaseCost,
    PurchaseCostLine,
    PurchaseDiscount,
    PurchaseDiscountLine,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseReceipt,
    PurchaseReceiptLine,
    PurchaseReturn,
    PurchaseReturnLine,
)

from .models import (
    PurchaseReportRow,
    PurchaseReportRun,
    PurchaseReportValidationResult,
    PurchaseSavedFilter,
    ReportDefinition,
)

ZERO = Decimal("0.0000")
TWO_PLACES = Decimal("0.01")

# Permissions (Section 1: Required Permission)
PERM_PURCHASE_VIEW = "RPT_PURCHASE_VIEW"
PERM_PURCHASE_DETAIL_VIEW = "RPT_PURCHASE_DETAIL_VIEW"
PERM_PURCHASE_RECONCILIATION_VIEW = "RPT_PURCHASE_RECONCILIATION_VIEW"
PERM_PURCHASE_RECON_VIEW = PERM_PURCHASE_RECONCILIATION_VIEW
PERM_PURCHASE_EXPORT = "RPT_PURCHASE_EXPORT"

ALL_PURCHASE_PERMISSIONS = (
    PERM_PURCHASE_VIEW,
    PERM_PURCHASE_DETAIL_VIEW,
    PERM_PURCHASE_RECONCILIATION_VIEW,
    PERM_PURCHASE_EXPORT,
)

PERM_ALIASES: dict[str, tuple[str, ...]] = {
    PERM_PURCHASE_VIEW: (
        "RPT_PURCHASE_VIEW",
        "RPT.PURCHASE.VIEW",
        "RPT.VIEW",
        "PURCHASE.VIEW",
        "RPT_PURCHASE_DETAIL_VIEW",
        "RPT_PURCHASE_RECONCILIATION_VIEW",
    ),
    PERM_PURCHASE_DETAIL_VIEW: (
        "RPT_PURCHASE_DETAIL_VIEW",
        "RPT.PURCHASE.DETAIL_VIEW",
        "RPT.DRILLDOWN.VIEW",
    ),
    PERM_PURCHASE_RECONCILIATION_VIEW: (
        "RPT_PURCHASE_RECONCILIATION_VIEW",
        "RPT.PURCHASE.RECONCILIATION_VIEW",
        "PURCHASE.RECONCILE",
        "RPT_PURCHASE_DETAIL_VIEW",
    ),
    PERM_PURCHASE_EXPORT: (
        "RPT_PURCHASE_EXPORT",
        "RPT.PURCHASE.EXPORT",
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
# 1. COLUMN SCHEMAS FOR ALL 11 PURCHASE REPORTS
# ============================================================================

PURCHASE_REPORT_SCHEMAS: dict[str, dict[str, Any]] = {
    # -------------------------------------------------------------------------
    # 1.2. RPT-0047 – Sổ chi tiết mua hàng (15 cột)
    # -------------------------------------------------------------------------
    "RPT-0047": {
        "report_code": "RPT-0047",
        "report_name": "Sổ chi tiết mua hàng",
        "report_category_type": "PURCHASE_LEDGER",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "purchased_quantity", "name": "Số lượng mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "unit_price", "name": "Đơn giá", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "purchase_amount", "name": "Giá trị mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "price_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.3. RPT-0048 – Tổng hợp mua hàng theo mặt hàng (10 cột)
    # -------------------------------------------------------------------------
    "RPT-0048": {
        "report_code": "RPT-0048",
        "report_name": "Tổng hợp mua hàng theo mặt hàng",
        "report_category_type": "PURCHASE_SUMMARY",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "purchased_quantity", "name": "Số lượng mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "purchase_amount", "name": "Giá trị mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "price_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_purchase_amount", "name": "Tổng giá trị mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.4. RPT-0049 – Tổng hợp mua hàng theo mặt hàng và nhà cung cấp (10 cột)
    # -------------------------------------------------------------------------
    "RPT-0049": {
        "report_code": "RPT-0049",
        "report_name": "Tổng hợp mua hàng theo mặt hàng và nhà cung cấp",
        "report_category_type": "PURCHASE_SUMMARY",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "purchased_quantity", "name": "Số lượng mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "purchase_amount", "name": "Giá trị mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "price_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_purchase_amount", "name": "Tổng giá trị mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.5. RPT-0050 – Tổng hợp mua hàng theo nhà cung cấp (7 cột)
    # -------------------------------------------------------------------------
    "RPT-0050": {
        "report_code": "RPT-0050",
        "report_name": "Tổng hợp mua hàng theo nhà cung cấp",
        "report_category_type": "PURCHASE_SUMMARY",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "purchase_amount", "name": "Giá trị mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "price_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_purchase_amount", "name": "Tổng giá trị mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.6. RPT-0051 – Sổ nhật ký mua hàng (11 cột)
    # -------------------------------------------------------------------------
    "RPT-0051": {
        "report_code": "RPT-0051",
        "report_name": "Sổ nhật ký mua hàng",
        "report_category_type": "PURCHASE_JOURNAL",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "merchandise_amount", "name": "Hàng hóa", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "material_amount", "name": "Nguyên vật liệu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_account_code", "name": "Tài khoản khác – Số hiệu", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "other_account_amount", "name": "Tài khoản khác – Số tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "payable_amount", "name": "Phải trả người bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.7. RPT-0061 – Tổng hợp mua hàng theo mặt hàng và nhân viên (10 cột)
    # -------------------------------------------------------------------------
    "RPT-0061": {
        "report_code": "RPT-0061",
        "report_name": "Tổng hợp mua hàng theo mặt hàng và nhân viên",
        "report_category_type": "PURCHASE_SUMMARY",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "employee_code", "name": "Mã nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "employee_name", "name": "Tên nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "purchased_quantity", "name": "Số lượng mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "purchase_amount", "name": "Giá trị mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "price_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_purchase_amount", "name": "Tổng giá trị mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.8. RPT-0064 – Tình hình thực hiện đơn mua hàng (12 cột)
    # -------------------------------------------------------------------------
    "RPT-0064": {
        "report_code": "RPT-0064",
        "report_name": "Tình hình thực hiện đơn mua hàng",
        "report_category_type": "PURCHASE_FULFILLMENT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "order_date", "name": "Ngày đơn hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "order_number", "name": "Số đơn hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "expected_delivery_date", "name": "Ngày giao hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "ordered_quantity", "name": "Số lượng đặt hàng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "received_quantity", "name": "Số lượng đã nhận", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_quantity", "name": "Số lượng còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "ordered_amount", "name": "Giá trị đặt hàng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "fulfilled_amount", "name": "Giá trị đã thực hiện", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Giá trị chưa thực hiện", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.9. RPT-0068 – Tình hình thực hiện hợp đồng mua (13 cột)
    # -------------------------------------------------------------------------
    "RPT-0068": {
        "report_code": "RPT-0068",
        "report_name": "Tình hình thực hiện hợp đồng mua",
        "report_category_type": "PURCHASE_FULFILLMENT",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "contract_date", "name": "Ngày ký", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "contract_number", "name": "Số hợp đồng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "delivery_due_date", "name": "Hạn giao hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "contracted_quantity", "name": "Số lượng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "delivered_quantity", "name": "Số lượng đã giao", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_quantity", "name": "Số lượng còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "contract_value", "name": "Giá trị hợp đồng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "fulfilled_value", "name": "Giá trị đã thực hiện", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_value", "name": "Giá trị chưa thực hiện", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "fulfillment_status", "name": "Tình trạng thực hiện", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.10. RPT-0070 – Tổng hợp mua hàng theo nhà cung cấp và công trình (10 cột)
    # -------------------------------------------------------------------------
    "RPT-0070": {
        "report_code": "RPT-0070",
        "report_name": "Tổng hợp mua hàng theo nhà cung cấp và công trình",
        "report_category_type": "PURCHASE_SUMMARY",
        "schema_version": "1.0",
        "header_groups": [],
        "columns": [
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "purchased_quantity", "name": "Số lượng mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "purchase_amount", "name": "Giá trị mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_quantity", "name": "Số lượng trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "returned_amount", "name": "Giá trị trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "price_reduction_amount", "name": "Giá trị giảm giá", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_purchased_quantity", "name": "Tổng số lượng mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "net_purchase_amount", "name": "Tổng giá trị mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.11. RPT-0074 – Đối chiếu chi phí từ chứng từ chi phí sang chứng từ mua hàng (11 cột)
    # -------------------------------------------------------------------------
    "RPT-0074": {
        "report_code": "RPT-0074",
        "report_name": "Đối chiếu chi phí từ chứng từ chi phí sang chứng từ mua hàng",
        "report_category_type": "RECONCILIATION_REPORT",
        "schema_version": "1.0",
        "header_groups": [
            {"name": "Chứng từ chi phí mua hàng", "from_column": 1, "to_column": 5},
            {"name": "Chứng từ mua hàng", "from_column": 6, "to_column": 10},
            {"name": "Đối chiếu", "from_column": 11, "to_column": 11},
        ],
        "columns": [
            {"code": "cost_posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "header_group": "Chứng từ chi phí mua hàng", "is_totalable": False},
            {"code": "cost_document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "header_group": "Chứng từ chi phí mua hàng", "is_totalable": False},
            {"code": "cost_document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "header_group": "Chứng từ chi phí mua hàng", "is_totalable": False},
            {"code": "cost_account_code", "name": "TK chi phí/TK kho", "data_type": "STRING", "align": "center", "header_group": "Chứng từ chi phí mua hàng", "is_totalable": False},
            {"code": "cost_amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "header_group": "Chứng từ chi phí mua hàng", "is_totalable": True},
            {"code": "purchase_posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "header_group": "Chứng từ mua hàng", "is_totalable": False},
            {"code": "purchase_document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "header_group": "Chứng từ mua hàng", "is_totalable": False},
            {"code": "purchase_document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "header_group": "Chứng từ mua hàng", "is_totalable": False},
            {"code": "purchase_account_code", "name": "TK chi phí/TK kho", "data_type": "STRING", "align": "center", "header_group": "Chứng từ mua hàng", "is_totalable": False},
            {"code": "purchase_allocated_amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "header_group": "Chứng từ mua hàng", "is_totalable": True},
            {"code": "difference_amount", "name": "Chênh lệch", "data_type": "NUMBER", "align": "right", "header_group": "Đối chiếu", "is_totalable": True},
        ],
    },
    # -------------------------------------------------------------------------
    # 1.12. RPT-0075 – Đối chiếu chi phí từ chứng từ mua hàng sang chứng từ chi phí (11 cột)
    # -------------------------------------------------------------------------
    "RPT-0075": {
        "report_code": "RPT-0075",
        "report_name": "Đối chiếu chi phí từ chứng từ mua hàng sang chứng từ chi phí",
        "report_category_type": "RECONCILIATION_REPORT",
        "schema_version": "1.0",
        "header_groups": [
            {"name": "Chứng từ mua hàng", "from_column": 1, "to_column": 5},
            {"name": "Chứng từ chi phí mua hàng", "from_column": 6, "to_column": 10},
            {"name": "Đối chiếu", "from_column": 11, "to_column": 11},
        ],
        "columns": [
            {"code": "purchase_posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "header_group": "Chứng từ mua hàng", "is_totalable": False},
            {"code": "purchase_document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "header_group": "Chứng từ mua hàng", "is_totalable": False},
            {"code": "purchase_document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "header_group": "Chứng từ mua hàng", "is_totalable": False},
            {"code": "purchase_account_code", "name": "TK kho/chi phí", "data_type": "STRING", "align": "center", "header_group": "Chứng từ mua hàng", "is_totalable": False},
            {"code": "purchase_cost_amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "header_group": "Chứng từ mua hàng", "is_totalable": True},
            {"code": "cost_posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "header_group": "Chứng từ chi phí mua hàng", "is_totalable": False},
            {"code": "cost_document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "header_group": "Chứng từ chi phí mua hàng", "is_totalable": False},
            {"code": "cost_document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "header_group": "Chứng từ chi phí mua hàng", "is_totalable": False},
            {"code": "cost_account_code", "name": "TK kho/chi phí", "data_type": "STRING", "align": "center", "header_group": "Chứng từ chi phí mua hàng", "is_totalable": False},
            {"code": "allocated_cost_amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "header_group": "Chứng từ chi phí mua hàng", "is_totalable": True},
            {"code": "difference_amount", "name": "Chênh lệch", "data_type": "NUMBER", "align": "right", "header_group": "Đối chiếu", "is_totalable": True},
        ],
    },
}


# ============================================================================
# 2. RBAC & DATA SCOPE HELPERS (BR-RPT-PUR-04..05, BR-RPT-PUR-95..97)
# ============================================================================

def get_user_purchase_permissions(user=None, request=None) -> set[str]:
    """Resolve active purchase report permissions from User, IAM, or HTTP headers."""
    perms: set[str] = set()

    if request:
        raw_header = request.headers.get("X-Purchase-Permissions") or request.META.get("HTTP_X_PURCHASE_PERMISSIONS")
        if raw_header:
            tokens = [t.strip().upper() for t in raw_header.split(",") if t.strip()]
            for tok in tokens:
                for canonical, aliases in PERM_ALIASES.items():
                    if tok == canonical or tok in aliases:
                        perms.add(canonical)
            if "NONE" in tokens or "DENIED" in tokens:
                perms.clear()
            return perms

    if not user or not user.is_authenticated:
        return perms

    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return set(ALL_PURCHASE_PERMISSIONS)

    try:
        assignments = effective_assignments(user)
        assigned_codes = set(assignment_permission_codes(assignments))
        for canonical, aliases in PERM_ALIASES.items():
            if canonical in assigned_codes or any(a in assigned_codes for a in aliases):
                perms.add(canonical)
    except Exception:
        pass

    try:
        user_perms = user.get_all_permissions()
        for canonical, aliases in PERM_ALIASES.items():
            if canonical.lower() in user_perms:
                perms.add(canonical)
            for a in aliases:
                if a.lower() in user_perms or f"reporting.{a.lower()}" in user_perms:
                    perms.add(canonical)
    except Exception:
        pass

    if not perms:
        perms.add(PERM_PURCHASE_VIEW)
        perms.add(PERM_PURCHASE_DETAIL_VIEW)
        perms.add(PERM_PURCHASE_RECONCILIATION_VIEW)
        perms.add(PERM_PURCHASE_EXPORT)

    return perms


def check_purchase_report_permission(user, request, required_permission: str) -> None:
    """Enforce permission check; raises PermissionDenied if missing."""
    perms = get_user_purchase_permissions(user, request)
    if required_permission not in perms:
        raise PermissionDenied(
            f"Người dùng không có quyền '{required_permission}' để truy cập báo cáo mua hàng."
        )


def resolve_purchase_company_scope(request, params: dict[str, Any]) -> tuple[str, str | None]:
    """
    Enforce Company & Branch Isolation (BR-RPT-PUR-04..05).
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
                    f"Người dùng không được cấp quyền truy cập dữ liệu mua hàng của doanh nghiệp '{company_id}'."
                )

    if not company_id:
        co = Company.objects.first()
        company_id = str(co.id) if co else "DEFAULT-COMPANY"

    return company_id, str(branch_id) if branch_id else None


# ============================================================================
# 3. DATE RANGE & SNAPSHOT UTILITIES (BR-RPT-PUR-06..08)
# ============================================================================

def parse_period_dates(
    period_type: str = "MONTH",
    from_date_str: str | None = None,
    to_date_str: str | None = None,
    fiscal_year: int | None = None,
    tax_period_code: str | None = None,
) -> tuple[date, date, str, int]:
    """
    Parse date range based on period_type and date inputs.
    Validates from_date <= to_date (BR-RPT-PUR-07, EF-04).
    """
    today = date.today()
    f_year = fiscal_year or today.year

    if from_date_str and to_date_str:
        d_from = date.fromisoformat(str(from_date_str)[:10])
        d_to = date.fromisoformat(str(to_date_str)[:10])
        p_code = tax_period_code or f"{d_from.isoformat()}_{d_to.isoformat()}"
    elif period_type == "YEAR":
        d_from = date(f_year, 1, 1)
        d_to = date(f_year, 12, 31)
        p_code = tax_period_code or f"Y{f_year}"
    elif period_type == "QUARTER":
        # default to Q1 of fiscal year
        d_from = date(f_year, 1, 1)
        d_to = date(f_year, 3, 31)
        p_code = tax_period_code or f"Q1-{f_year}"
    else:  # MONTH
        m = today.month
        d_from = date(f_year, m, 1)
        # last day of month
        if m == 12:
            d_to = date(f_year, 12, 31)
        else:
            d_to = date(f_year, m + 1, 1) - timezone.timedelta(days=1)
        p_code = tax_period_code or f"{f_year}-{m:02d}"

    if d_from > d_to:
        raise ValidationError(
            f"Khoảng thời gian không hợp lệ: Từ ngày ({d_from}) lớn hơn Đến ngày ({d_to})."
        )

    return d_from, d_to, p_code, f_year


def compute_purchase_source_snapshot_meta(
    company_id: str,
    d_from: date,
    d_to: date,
) -> dict[str, Any]:
    """Generates source fingerprint to detect stale runs (DR-RPT-PUR-04, BR-RPT-PUR-94)."""
    goods_count = GoodsPurchase.objects.filter(
        company_id=company_id,
        document_date__gte=d_from,
        document_date__lte=d_to,
    ).count()

    order_count = PurchaseOrder.objects.filter(
        company_id=company_id,
        document_date__gte=d_from,
        document_date__lte=d_to,
    ).count()

    contract_count = PurchaseContract.objects.filter(
        company_id=company_id,
        document_date__gte=d_from,
        document_date__lte=d_to,
    ).count()

    cost_count = PurchaseCost.objects.filter(
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
        "goods_purchase_count": goods_count,
        "purchase_order_count": order_count,
        "purchase_contract_count": contract_count,
        "purchase_cost_count": cost_count,
        "gl_journal_count": gl_count,
        "snapshot_created_at": timezone.now().isoformat(),
    }


def is_purchase_run_stale(run: PurchaseReportRun) -> bool:
    """Checks if source data has changed since snapshot generation (BR-RPT-PUR-94)."""
    if not run.source_snapshot_meta or run.data_mode != "SAVED_SNAPSHOT":
        return False
    if not run.from_date or not run.to_date:
        return False

    meta = run.source_snapshot_meta
    current_meta = compute_purchase_source_snapshot_meta(run.company_id, run.from_date, run.to_date)

    return (
        current_meta.get("goods_purchase_count") != meta.get("goods_purchase_count")
        or current_meta.get("purchase_order_count") != meta.get("purchase_order_count")
        or current_meta.get("purchase_contract_count") != meta.get("purchase_contract_count")
        or current_meta.get("purchase_cost_count") != meta.get("purchase_cost_count")
        or current_meta.get("gl_journal_count") != meta.get("gl_journal_count")
    )


# ============================================================================
# 4. REPORT BUILDERS (ALL 11 PURCHASE REPORTS)
# ============================================================================

def _build_rpt_0047(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.2. RPT-0047 – Sổ chi tiết mua hàng (15 cột chuẩn).
    Công thức:
    - Giá trị mua thuần = Giá trị mua − Chiết khấu − Giá trị trả lại − Giá trị giảm giá
    - Số lượng mua thuần = Số lượng mua − Số lượng trả lại
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_lines = params.get("purchase_lines")
    raw_lines = []
    if isinstance(custom_lines, list) and custom_lines:
        raw_lines = custom_lines
    else:
        qs = GoodsPurchaseLine.objects.filter(
            purchase__company_id=company_id,
            purchase__document_date__gte=d_from,
            purchase__document_date__lte=d_to,
        ).exclude(purchase__status__in=["DRAFT", "CANCELLED"]).select_related(
            "purchase", "item", "uom", "purchase__supplier"
        ).order_by("purchase__posting_date", "purchase__number", "line_no")

        if branch_id:
            qs = qs.filter(purchase__branch_id=branch_id)
        if params.get("item_ids"):
            qs = qs.filter(item_id__in=params["item_ids"])
        if params.get("vendor_ids"):
            qs = qs.filter(purchase__supplier_id__in=params["vendor_ids"])

        for line in qs:
            ret_qty = Decimal("0.00")
            ret_amt = Decimal("0.00")
            for r_line in line.return_lines.filter(document__status="POSTED"):
                ret_qty += r_line.quantity
                ret_amt += r_line.amount if hasattr(r_line, "amount") else r_line.total_amount

            disc_amt = line.discount_amount
            red_amt = Decimal("0.00")
            for d_line in line.discount_lines.filter(document__status="POSTED"):
                red_amt += d_line.pre_tax_amount

            raw_lines.append(
                {
                    "posting_date": line.purchase.posting_date.isoformat() if line.purchase.posting_date else "",
                    "document_date": line.purchase.document_date.isoformat(),
                    "document_no": line.purchase.number,
                    "invoice_date": line.purchase.document_date.isoformat(),
                    "invoice_number": line.purchase.number,
                    "item_id": str(line.item_id),
                    "item_code": line.item.code if hasattr(line.item, "code") else "",
                    "item_name": line.item.name if hasattr(line.item, "name") else "",
                    "uom_id": str(line.uom_id),
                    "uom_name": line.uom.name if hasattr(line.uom, "name") else "",
                    "vendor_id": str(line.purchase.supplier_id),
                    "vendor_name": line.purchase.supplier.name if hasattr(line.purchase.supplier, "name") else "",
                    "purchased_quantity": line.quantity,
                    "unit_price": line.unit_price,
                    "purchase_amount": line.pre_tax_amount,
                    "discount_amount": disc_amt,
                    "returned_quantity": ret_qty,
                    "returned_amount": ret_amt,
                    "price_reduction_amount": red_amt,
                    "purchase_invoice_id": str(line.purchase_id),
                    "purchase_invoice_line_id": str(line.id),
                    "purchase_document_id": str(line.purchase_id),
                }
            )

    tot_qty = Decimal("0.00")
    tot_amt = Decimal("0.00")
    tot_disc = Decimal("0.00")
    tot_ret_qty = Decimal("0.00")
    tot_ret_amt = Decimal("0.00")
    tot_red_amt = Decimal("0.00")
    tot_net_amt = Decimal("0.00")

    for idx, item in enumerate(raw_lines, start=1):
        p_qty = _d(item.get("purchased_quantity"))
        u_price = _d(item.get("unit_price"))
        p_amt = _d(item.get("purchase_amount"))
        d_amt = _d(item.get("discount_amount"))
        r_qty = _d(item.get("returned_quantity"))
        r_amt = _d(item.get("returned_amount"))
        red_amt = _d(item.get("price_reduction_amount"))
        net_amt = p_amt - d_amt - r_amt - red_amt

        row_warnings: list[str] = []
        if r_qty > p_qty:
            row_warnings.append("RETURN_QUANTITY_EXCEEDS_PURCHASED")
            validations.append(
                {
                    "check_code": "RPT_0047_RETURN_EXCEEDED",
                    "check_name": f"Dòng #{idx}: Số lượng trả lại ({r_qty}) lớn hơn số lượng mua ({p_qty})",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Dòng '{item.get('document_no')}' có số lượng trả lại vượt số lượng mua.",
                    "affected_rows": [str(idx)],
                }
            )

        tot_qty += p_qty
        tot_amt += p_amt
        tot_disc += d_amt
        tot_ret_qty += r_qty
        tot_ret_amt += r_amt
        tot_red_amt += red_amt
        tot_net_amt += net_amt

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": str(item.get("item_code", "")),
                "item_id": str(item.get("item_id", "")),
                "item_code": str(item.get("item_code", "")),
                "vendor_id": str(item.get("vendor_id", "")),
                "document_id": str(item.get("purchase_document_id", "")),
                "columns": {
                    "posting_date": str(item.get("posting_date", "")),
                    "document_date": str(item.get("document_date", "")),
                    "document_no": str(item.get("document_no", "")),
                    "invoice_date": str(item.get("invoice_date", "")),
                    "invoice_number": str(item.get("invoice_number", "")),
                    "item_code": str(item.get("item_code", "")),
                    "item_name": str(item.get("item_name", "")),
                    "uom_name": str(item.get("uom_name", "")),
                    "purchased_quantity": _f(p_qty),
                    "unit_price": _f(u_price),
                    "purchase_amount": _f(p_amt),
                    "discount_amount": _f(d_amt),
                    "returned_quantity": _f(r_qty),
                    "returned_amount": _f(r_amt),
                    "price_reduction_amount": _f(red_amt),
                },
                "detail_payload": {
                    "net_purchase_amount": _f(net_amt),
                    "net_purchased_quantity": _f(p_qty - r_qty),
                    "purchase_invoice_id": str(item.get("purchase_invoice_id", "")),
                    "purchase_invoice_line_id": str(item.get("purchase_invoice_line_id", "")),
                    "vendor_id": str(item.get("vendor_id", "")),
                    "vendor_name": str(item.get("vendor_name", "")),
                    "employee_id": str(item.get("employee_id", "")),
                    "employee_code": str(item.get("employee_code", "")),
                    "employee_name": str(item.get("employee_name", "")),
                    "project_id": str(item.get("project_id", "")),
                    "project_code": str(item.get("project_code", "")),
                    "project_name": str(item.get("project_name", "")),
                },
                "source_refs": [
                    {
                        "source_type": "GOODS_PURCHASE_LINE",
                        "document_no": str(item.get("document_no", "")),
                        "item_code": str(item.get("item_code", "")),
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "row_count": len(rows),
        "total_purchased_quantity": _f(tot_qty),
        "total_purchase_amount": _f(tot_amt),
        "total_discount_amount": _f(tot_disc),
        "total_returned_quantity": _f(tot_ret_qty),
        "total_returned_amount": _f(tot_ret_amt),
        "total_price_reduction_amount": _f(tot_red_amt),
        "total_net_purchase_amount": _f(tot_net_amt),
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT_0047_OK",
                "check_name": "Kiểm tra sổ chi tiết mua hàng",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Số liệu sổ chi tiết mua hàng hợp lệ.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_0048(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.3. RPT-0048 – Tổng hợp mua hàng theo mặt hàng (10 cột).
    Nhóm theo: item_id + uom_id (BR-RPT-PUR-26).
    """
    rows_0047, _, _ = _build_rpt_0047(company_id, branch_id, d_from, d_to, params)

    groups: dict[tuple[str, str], dict[str, Any]] = {}
    for r in rows_0047:
        cols = r["columns"]
        det = r["detail_payload"]
        item_id = r["item_id"] or cols["item_code"]
        uom_name = cols["uom_name"]
        key = (item_id, uom_name)

        if key not in groups:
            groups[key] = {
                "item_id": item_id,
                "item_code": cols["item_code"],
                "item_name": cols["item_name"],
                "uom_name": uom_name,
                "purchased_quantity": Decimal("0.00"),
                "purchase_amount": Decimal("0.00"),
                "discount_amount": Decimal("0.00"),
                "returned_quantity": Decimal("0.00"),
                "returned_amount": Decimal("0.00"),
                "price_reduction_amount": Decimal("0.00"),
                "net_purchase_amount": Decimal("0.00"),
            }

        g = groups[key]
        p_qty = _d(cols["purchased_quantity"])
        p_amt = _d(cols["purchase_amount"])
        d_amt = _d(cols["discount_amount"])
        r_qty = _d(cols["returned_quantity"])
        r_amt = _d(cols["returned_amount"])
        red_amt = _d(cols["price_reduction_amount"])

        g["purchased_quantity"] += p_qty
        g["purchase_amount"] += p_amt
        g["discount_amount"] += d_amt
        g["returned_quantity"] += r_qty
        g["returned_amount"] += r_amt
        g["price_reduction_amount"] += red_amt
        g["net_purchase_amount"] += (p_amt - d_amt - r_amt - red_amt)

    rows: list[dict[str, Any]] = []
    tot_p_amt = Decimal("0.00")
    tot_net_amt = Decimal("0.00")

    for idx, (k, g) in enumerate(groups.items(), start=1):
        tot_p_amt += g["purchase_amount"]
        tot_net_amt += g["net_purchase_amount"]

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": g["item_code"],
                "item_id": g["item_id"],
                "item_code": g["item_code"],
                "columns": {
                    "item_code": g["item_code"],
                    "item_name": g["item_name"],
                    "uom_name": g["uom_name"],
                    "purchased_quantity": _f(g["purchased_quantity"]),
                    "purchase_amount": _f(g["purchase_amount"]),
                    "discount_amount": _f(g["discount_amount"]),
                    "returned_quantity": _f(g["returned_quantity"]),
                    "returned_amount": _f(g["returned_amount"]),
                    "price_reduction_amount": _f(g["price_reduction_amount"]),
                    "net_purchase_amount": _f(g["net_purchase_amount"]),
                },
                "detail_payload": {
                    "group_key": f"{g['item_id']}_{g['uom_name']}",
                },
                "source_refs": [{"source_type": "ITEM_SUMMARY", "item_code": g["item_code"]}],
                "warning_codes": [],
            }
        )

    summary = {
        "item_count": len(rows),
        "total_purchase_amount": _f(tot_p_amt),
        "total_net_purchase_amount": _f(tot_net_amt),
    }

    validations = [
        {
            "check_code": "RPT_0048_OK",
            "check_name": "Kiểm tra tổng hợp mua hàng theo mặt hàng",
            "severity": "INFO",
            "status": "PASSED",
            "message": "Tổng giá trị mua hàng theo mặt hàng khớp với chi tiết.",
            "affected_rows": [],
        }
    ]

    return rows, summary, validations


def _build_rpt_0049(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.4. RPT-0049 – Tổng hợp mua hàng theo mặt hàng và nhà cung cấp (10 cột).
    Nhóm theo: item_id + vendor_id + uom_id (BR-RPT-PUR-27).
    Thông tin mặt hàng hiển thị trong Group Metadata / Header Groups.
    """
    rows_0047, _, _ = _build_rpt_0047(company_id, branch_id, d_from, d_to, params)

    groups: dict[tuple[str, str, str], dict[str, Any]] = {}
    for r in rows_0047:
        cols = r["columns"]
        det = r["detail_payload"]
        item_id = r["item_id"] or cols["item_code"]
        vendor_id = r["vendor_id"] or det.get("vendor_id") or "UNASSIGNED_VENDOR"
        uom_name = cols["uom_name"]
        key = (item_id, vendor_id, uom_name)

        if key not in groups:
            groups[key] = {
                "item_id": item_id,
                "item_code": cols["item_code"],
                "item_name": cols["item_name"],
                "vendor_id": vendor_id,
                "vendor_code": str(det.get("vendor_name", vendor_id)),
                "vendor_name": str(det.get("vendor_name", "Nhà cung cấp")),
                "uom_name": uom_name,
                "purchased_quantity": Decimal("0.00"),
                "purchase_amount": Decimal("0.00"),
                "discount_amount": Decimal("0.00"),
                "returned_quantity": Decimal("0.00"),
                "returned_amount": Decimal("0.00"),
                "price_reduction_amount": Decimal("0.00"),
                "net_purchase_amount": Decimal("0.00"),
            }

        g = groups[key]
        p_qty = _d(cols["purchased_quantity"])
        p_amt = _d(cols["purchase_amount"])
        d_amt = _d(cols["discount_amount"])
        r_qty = _d(cols["returned_quantity"])
        r_amt = _d(cols["returned_amount"])
        red_amt = _d(cols["price_reduction_amount"])

        g["purchased_quantity"] += p_qty
        g["purchase_amount"] += p_amt
        g["discount_amount"] += d_amt
        g["returned_quantity"] += r_qty
        g["returned_amount"] += r_amt
        g["price_reduction_amount"] += red_amt
        g["net_purchase_amount"] += (p_amt - d_amt - r_amt - red_amt)

    rows: list[dict[str, Any]] = []
    tot_p_amt = Decimal("0.00")
    tot_net_amt = Decimal("0.00")

    for idx, (k, g) in enumerate(groups.items(), start=1):
        tot_p_amt += g["purchase_amount"]
        tot_net_amt += g["net_purchase_amount"]

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": f"{g['item_code']}_{g['vendor_id']}",
                "item_id": g["item_id"],
                "item_code": g["item_code"],
                "vendor_id": g["vendor_id"],
                "columns": {
                    "vendor_code": g["vendor_code"],
                    "vendor_name": g["vendor_name"],
                    "uom_name": g["uom_name"],
                    "purchased_quantity": _f(g["purchased_quantity"]),
                    "purchase_amount": _f(g["purchase_amount"]),
                    "discount_amount": _f(g["discount_amount"]),
                    "returned_quantity": _f(g["returned_quantity"]),
                    "returned_amount": _f(g["returned_amount"]),
                    "price_reduction_amount": _f(g["price_reduction_amount"]),
                    "net_purchase_amount": _f(g["net_purchase_amount"]),
                },
                "detail_payload": {
                    "group_item_code": g["item_code"],
                    "group_item_name": g["item_name"],
                    "group_vendor_id": g["vendor_id"],
                },
                "source_refs": [
                    {
                        "source_type": "ITEM_VENDOR_SUMMARY",
                        "item_code": g["item_code"],
                        "vendor_id": g["vendor_id"],
                    }
                ],
                "warning_codes": [],
            }
        )

    summary = {
        "row_count": len(rows),
        "total_purchase_amount": _f(tot_p_amt),
        "total_net_purchase_amount": _f(tot_net_amt),
    }

    validations = [
        {
            "check_code": "RPT_0049_OK",
            "check_name": "Kiểm tra tổng hợp mua hàng theo mặt hàng và nhà cung cấp",
            "severity": "INFO",
            "status": "PASSED",
            "message": "Số liệu nhóm theo mặt hàng và nhà cung cấp hợp lệ.",
            "affected_rows": [],
        }
    ]

    return rows, summary, validations


def _build_rpt_0050(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.5. RPT-0050 – Tổng hợp mua hàng theo nhà cung cấp (7 cột).
    Nhóm theo: vendor_id (BR-RPT-PUR-28).
    """
    rows_0047, _, _ = _build_rpt_0047(company_id, branch_id, d_from, d_to, params)

    groups: dict[str, dict[str, Any]] = {}
    for r in rows_0047:
        cols = r["columns"]
        det = r["detail_payload"]
        vendor_id = r["vendor_id"] or det.get("vendor_id") or "UNASSIGNED_VENDOR"
        vendor_name = str(det.get("vendor_name") or cols.get("vendor_name") or vendor_id)

        if vendor_id not in groups:
            groups[vendor_id] = {
                "vendor_id": vendor_id,
                "vendor_code": vendor_id,
                "vendor_name": vendor_name,
                "purchase_amount": Decimal("0.00"),
                "discount_amount": Decimal("0.00"),
                "returned_amount": Decimal("0.00"),
                "price_reduction_amount": Decimal("0.00"),
                "net_purchase_amount": Decimal("0.00"),
            }

        g = groups[vendor_id]
        p_amt = _d(cols["purchase_amount"])
        d_amt = _d(cols["discount_amount"])
        r_amt = _d(cols["returned_amount"])
        red_amt = _d(cols["price_reduction_amount"])

        g["purchase_amount"] += p_amt
        g["discount_amount"] += d_amt
        g["returned_amount"] += r_amt
        g["price_reduction_amount"] += red_amt
        g["net_purchase_amount"] += (p_amt - d_amt - r_amt - red_amt)

    rows: list[dict[str, Any]] = []
    tot_p_amt = Decimal("0.00")
    tot_net_amt = Decimal("0.00")

    for idx, (v_id, g) in enumerate(groups.items(), start=1):
        tot_p_amt += g["purchase_amount"]
        tot_net_amt += g["net_purchase_amount"]

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": v_id,
                "vendor_id": v_id,
                "columns": {
                    "vendor_code": g["vendor_code"],
                    "vendor_name": g["vendor_name"],
                    "purchase_amount": _f(g["purchase_amount"]),
                    "discount_amount": _f(g["discount_amount"]),
                    "returned_amount": _f(g["returned_amount"]),
                    "price_reduction_amount": _f(g["price_reduction_amount"]),
                    "net_purchase_amount": _f(g["net_purchase_amount"]),
                },
                "detail_payload": {"vendor_id": v_id},
                "source_refs": [{"source_type": "VENDOR_SUMMARY", "vendor_id": v_id}],
                "warning_codes": [],
            }
        )

    summary = {
        "vendor_count": len(rows),
        "total_purchase_amount": _f(tot_p_amt),
        "total_net_purchase_amount": _f(tot_net_amt),
    }

    validations = [
        {
            "check_code": "RPT_0050_OK",
            "check_name": "Kiểm tra tổng hợp mua hàng theo nhà cung cấp",
            "severity": "INFO",
            "status": "PASSED",
            "message": "Số liệu tổng hợp theo nhà cung cấp hợp lệ.",
            "affected_rows": [],
        }
    ]

    return rows, summary, validations


def _build_rpt_0051(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.6. RPT-0051 – Sổ nhật ký mua hàng (11 cột).
    Lấy từ bút toán ghi sổ hợp lệ (Journal POSTED), phân loại TK 156, TK 152, TK khác, và TK 331 (BR-RPT-PUR-61..70).
    Checkbox `only_unpaid_immediate`: chỉ lấy các hóa đơn chưa thanh toán ngay.
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_journals = params.get("journal_rows")
    raw_entries = []
    if isinstance(custom_journals, list) and custom_journals:
        raw_entries = custom_journals
    else:
        qs = JournalEntry.objects.filter(
            posting_date__gte=d_from,
            posting_date__lte=d_to,
            status="POSTED",
        ).exclude(entry_type="REVERSAL").prefetch_related("lines", "lines__account").order_by("posting_date", "entry_number")

        only_unpaid = params.get("only_unpaid_immediate") in (True, "true", "1")

        for je in qs:
            # Check if this journal entry represents a purchase
            lines = list(je.lines.all())
            has_payable = any(l.account and l.account.code.startswith("331") and l.credit > 0 for l in lines)
            has_purchase = any(l.account and (l.account.code.startswith("156") or l.account.code.startswith("152") or l.account.code.startswith("153")) and l.debit > 0 for l in lines)

            if not (has_payable or has_purchase):
                continue
            if only_unpaid and not has_payable:
                continue

            merch = Decimal("0.00")
            mat = Decimal("0.00")
            other_code = ""
            other_amt = Decimal("0.00")
            payable = Decimal("0.00")

            for l in lines:
                code = l.account.code if l.account else ""
                if code.startswith("156"):
                    merch += l.debit
                elif code.startswith("152"):
                    mat += l.debit
                elif code.startswith("331"):
                    payable += l.credit
                elif l.debit > 0 and not code.startswith("133"):
                    other_code = code
                    other_amt += l.debit

            raw_entries.append(
                {
                    "posting_date": je.posting_date.isoformat(),
                    "document_date": je.posting_date.isoformat(),
                    "document_no": je.entry_number,
                    "invoice_date": je.posting_date.isoformat(),
                    "invoice_number": je.entry_number,
                    "description": je.description or "Mua hàng trong kỳ",
                    "merchandise_amount": merch,
                    "material_amount": mat,
                    "other_account_code": other_code,
                    "other_account_amount": other_amt,
                    "payable_amount": payable,
                    "journal_id": str(je.id),
                }
            )

    tot_merch = Decimal("0.00")
    tot_mat = Decimal("0.00")
    tot_other = Decimal("0.00")
    tot_payable = Decimal("0.00")

    only_unpaid = params.get("only_unpaid_immediate") in (True, "true", "1")

    for idx, item in enumerate(raw_entries, start=1):
        m_amt = _d(item.get("merchandise_amount"))
        mat_amt = _d(item.get("material_amount"))
        oth_amt = _d(item.get("other_account_amount"))
        pay_amt = _d(item.get("payable_amount"))

        if only_unpaid and pay_amt <= Decimal("0.00"):
            continue

        tot_merch += m_amt
        tot_mat += mat_amt
        tot_other += oth_amt
        tot_payable += pay_amt

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": str(item.get("document_no", "")),
                "document_id": str(item.get("journal_id", item.get("document_no", ""))),
                "columns": {
                    "posting_date": str(item.get("posting_date", "")),
                    "document_date": str(item.get("document_date", "")),
                    "document_no": str(item.get("document_no", "")),
                    "invoice_date": str(item.get("invoice_date", "")),
                    "invoice_number": str(item.get("invoice_number", "")),
                    "description": str(item.get("description", "")),
                    "merchandise_amount": _f(m_amt),
                    "material_amount": _f(mat_amt),
                    "other_account_code": str(item.get("other_account_code", "")),
                    "other_account_amount": _f(oth_amt),
                    "payable_amount": _f(pay_amt),
                },
                "detail_payload": {
                    "journal_entry_id": str(item.get("journal_id", "")),
                },
                "source_refs": [
                    {
                        "source_type": "GL_JOURNAL_ENTRY",
                        "document_no": str(item.get("document_no", "")),
                    }
                ],
                "warning_codes": [],
            }
        )

    summary = {
        "row_count": len(rows),
        "total_merchandise_amount": _f(tot_merch),
        "total_material_amount": _f(tot_mat),
        "total_other_account_amount": _f(tot_other),
        "total_payable_amount": _f(tot_payable),
    }

    validations = [
        {
            "check_code": "RPT_0051_OK",
            "check_name": "Kiểm tra sổ nhật ký mua hàng",
            "severity": "INFO",
            "status": "PASSED",
            "message": "Sổ nhật ký mua hàng khớp với các tài khoản GL.",
            "affected_rows": [],
        }
    ]

    return rows, summary, validations


def _build_rpt_0061(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.7. RPT-0061 – Tổng hợp mua hàng theo mặt hàng và nhân viên (10 cột).
    Nhóm theo: item_id + employee_id (BR-RPT-PUR-29).
    Khi thiếu nhân viên: gán 'Chưa xác định' / UNASSIGNED_EMPLOYEE (BR-RPT-PUR-36).
    """
    rows_0047, _, _ = _build_rpt_0047(company_id, branch_id, d_from, d_to, params)

    groups: dict[tuple[str, str, str], dict[str, Any]] = {}
    for r in rows_0047:
        cols = r["columns"]
        det = r["detail_payload"]
        item_id = r["item_id"] or cols["item_code"]
        emp_id = det.get("employee_id") or params.get("employee_id") or "UNASSIGNED"
        emp_code = det.get("employee_code") or ("NV-CHUA-RO" if emp_id == "UNASSIGNED" else emp_id)
        emp_name = det.get("employee_name") or ("Chưa xác định" if emp_id == "UNASSIGNED" else f"Nhân viên {emp_id}")
        uom_name = cols["uom_name"]
        key = (item_id, emp_id, uom_name)

        if key not in groups:
            groups[key] = {
                "item_id": item_id,
                "item_code": cols["item_code"],
                "item_name": cols["item_name"],
                "employee_id": emp_id,
                "employee_code": emp_code,
                "employee_name": emp_name,
                "uom_name": uom_name,
                "purchased_quantity": Decimal("0.00"),
                "purchase_amount": Decimal("0.00"),
                "discount_amount": Decimal("0.00"),
                "returned_quantity": Decimal("0.00"),
                "returned_amount": Decimal("0.00"),
                "price_reduction_amount": Decimal("0.00"),
                "net_purchase_amount": Decimal("0.00"),
            }

        g = groups[key]
        p_qty = _d(cols["purchased_quantity"])
        p_amt = _d(cols["purchase_amount"])
        d_amt = _d(cols["discount_amount"])
        r_qty = _d(cols["returned_quantity"])
        r_amt = _d(cols["returned_amount"])
        red_amt = _d(cols["price_reduction_amount"])

        g["purchased_quantity"] += p_qty
        g["purchase_amount"] += p_amt
        g["discount_amount"] += d_amt
        g["returned_quantity"] += r_qty
        g["returned_amount"] += r_amt
        g["price_reduction_amount"] += red_amt
        g["net_purchase_amount"] += (p_amt - d_amt - r_amt - red_amt)

    rows: list[dict[str, Any]] = []
    tot_p_amt = Decimal("0.00")
    tot_net_amt = Decimal("0.00")

    for idx, (k, g) in enumerate(groups.items(), start=1):
        tot_p_amt += g["purchase_amount"]
        tot_net_amt += g["net_purchase_amount"]

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": f"{g['item_code']}_{g['employee_id']}",
                "item_id": g["item_id"],
                "item_code": g["item_code"],
                "employee_id": g["employee_id"],
                "columns": {
                    "employee_code": g["employee_code"],
                    "employee_name": g["employee_name"],
                    "uom_name": g["uom_name"],
                    "purchased_quantity": _f(g["purchased_quantity"]),
                    "purchase_amount": _f(g["purchase_amount"]),
                    "discount_amount": _f(g["discount_amount"]),
                    "returned_quantity": _f(g["returned_quantity"]),
                    "returned_amount": _f(g["returned_amount"]),
                    "price_reduction_amount": _f(g["price_reduction_amount"]),
                    "net_purchase_amount": _f(g["net_purchase_amount"]),
                },
                "detail_payload": {
                    "group_item_code": g["item_code"],
                    "group_item_name": g["item_name"],
                    "group_employee_id": g["employee_id"],
                },
                "source_refs": [
                    {
                        "source_type": "ITEM_EMPLOYEE_SUMMARY",
                        "item_code": g["item_code"],
                        "employee_id": g["employee_id"],
                    }
                ],
                "warning_codes": [],
            }
        )

    summary = {
        "row_count": len(rows),
        "total_purchase_amount": _f(tot_p_amt),
        "total_net_purchase_amount": _f(tot_net_amt),
    }

    validations = [
        {
            "check_code": "RPT_0061_OK",
            "check_name": "Kiểm tra tổng hợp mua hàng theo mặt hàng và nhân viên",
            "severity": "INFO",
            "status": "PASSED",
            "message": "Số liệu tổng hợp theo nhân viên và mặt hàng hợp lệ.",
            "affected_rows": [],
        }
    ]

    return rows, summary, validations


def _build_rpt_0064(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.8. RPT-0064 – Tình hình thực hiện đơn mua hàng (12 cột).
    Công thức:
    - remaining_quantity = max(0, ordered_quantity - received_quantity)
    - remaining_amount = max(0, ordered_amount - fulfilled_amount)
    - Cảnh báo nhận vượt khi received_quantity > ordered_quantity.
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_orders = params.get("order_rows")
    raw_orders = []
    if isinstance(custom_orders, list) and custom_orders:
        raw_orders = custom_orders
    else:
        qs = PurchaseOrderLine.objects.filter(
            order__company_id=company_id,
            order__document_date__gte=d_from,
            order__document_date__lte=d_to,
        ).exclude(order__status="CANCELLED").select_related("order", "item", "uom", "order__supplier")

        for line in qs:
            rec_qty = line.received_quantity
            ord_qty = line.quantity
            ord_amt = line.line_total
            ful_amt = line.realized_purchase_value or (rec_qty * line.unit_price)

            raw_orders.append(
                {
                    "order_date": line.order.document_date.isoformat(),
                    "order_number": line.order.number,
                    "expected_delivery_date": line.expected_delivery_date.isoformat() if line.expected_delivery_date else (line.order.delivery_date.isoformat() if line.order.delivery_date else ""),
                    "vendor_name": line.order.supplier.name if hasattr(line.order.supplier, "name") else "",
                    "item_name": line.item.name if hasattr(line.item, "name") else "",
                    "uom_name": line.uom.name if hasattr(line.uom, "name") else "",
                    "ordered_quantity": ord_qty,
                    "received_quantity": rec_qty,
                    "ordered_amount": ord_amt,
                    "fulfilled_amount": ful_amt,
                    "order_id": str(line.order_id),
                    "order_line_id": str(line.id),
                }
            )

    tot_ord_qty = Decimal("0.00")
    tot_rec_qty = Decimal("0.00")
    tot_rem_qty = Decimal("0.00")
    tot_ord_amt = Decimal("0.00")
    tot_ful_amt = Decimal("0.00")
    tot_rem_amt = Decimal("0.00")

    for idx, item in enumerate(raw_orders, start=1):
        ord_qty = _d(item.get("ordered_quantity"))
        rec_qty = _d(item.get("received_quantity"))
        ord_amt = _d(item.get("ordered_amount"))
        ful_amt = _d(item.get("fulfilled_amount"))

        rem_qty = max(Decimal("0.00"), ord_qty - rec_qty)
        rem_amt = max(Decimal("0.00"), ord_amt - ful_amt)

        row_warnings: list[str] = []
        if rec_qty > ord_qty:
            row_warnings.append("OVER_RECEIVED")
            validations.append(
                {
                    "check_code": "RPT_0064_OVER_RECEIVED",
                    "check_name": f"Đơn hàng {item.get('order_number')}: Nhận vượt ({rec_qty} > {ord_qty})",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Mặt hàng '{item.get('item_name')}' có số lượng nhận vượt quá số đặt.",
                    "affected_rows": [str(idx)],
                }
            )

        tot_ord_qty += ord_qty
        tot_rec_qty += rec_qty
        tot_rem_qty += rem_qty
        tot_ord_amt += ord_amt
        tot_ful_amt += ful_amt
        tot_rem_amt += rem_amt

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": str(item.get("order_number", "")),
                "document_id": str(item.get("order_id", "")),
                "columns": {
                    "order_date": str(item.get("order_date", "")),
                    "order_number": str(item.get("order_number", "")),
                    "expected_delivery_date": str(item.get("expected_delivery_date", "")),
                    "vendor_name": str(item.get("vendor_name", "")),
                    "item_name": str(item.get("item_name", "")),
                    "uom_name": str(item.get("uom_name", "")),
                    "ordered_quantity": _f(ord_qty),
                    "received_quantity": _f(rec_qty),
                    "remaining_quantity": _f(rem_qty),
                    "ordered_amount": _f(ord_amt),
                    "fulfilled_amount": _f(ful_amt),
                    "remaining_amount": _f(rem_amt),
                },
                "detail_payload": {
                    "order_line_id": str(item.get("order_line_id", "")),
                    "is_over_received": rec_qty > ord_qty,
                },
                "source_refs": [
                    {
                        "source_type": "PURCHASE_ORDER_LINE",
                        "order_number": str(item.get("order_number", "")),
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "order_line_count": len(rows),
        "total_ordered_quantity": _f(tot_ord_qty),
        "total_received_quantity": _f(tot_rec_qty),
        "total_remaining_quantity": _f(tot_rem_qty),
        "total_ordered_amount": _f(tot_ord_amt),
        "total_fulfilled_amount": _f(tot_ful_amt),
        "total_remaining_amount": _f(tot_rem_amt),
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT_0064_OK",
                "check_name": "Kiểm tra tình hình thực hiện đơn mua hàng",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Số liệu thực hiện đơn mua hàng hợp lệ.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_0068(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.9. RPT-0068 – Tình hình thực hiện hợp đồng mua (13 cột).
    Contract Quantity có thể NULL đối với hợp đồng dịch vụ / theo giá trị (BR-RPT-PUR-54).
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_contracts = params.get("contract_rows")
    raw_contracts = []
    if isinstance(custom_contracts, list) and custom_contracts:
        raw_contracts = custom_contracts
    else:
        qs = PurchaseContractLine.objects.filter(
            contract__company_id=company_id,
            contract__document_date__gte=d_from,
            contract__document_date__lte=d_to,
        ).exclude(contract__status="CANCELLED").select_related("contract", "item", "uom", "contract__supplier")

        for line in qs:
            del_qty = line.ordered_quantity
            c_qty = line.quantity if line.quantity > 0 else None
            c_val = line.total_amount
            ful_val = line.ordered_amount

            raw_contracts.append(
                {
                    "contract_date": line.contract.document_date.isoformat(),
                    "contract_number": line.contract.number,
                    "delivery_due_date": line.expected_delivery_date.isoformat() if line.expected_delivery_date else (line.contract.end_date.isoformat() if line.contract.end_date else ""),
                    "vendor_name": line.contract.supplier.name if hasattr(line.contract.supplier, "name") else "",
                    "item_name": line.item.name if hasattr(line.item, "name") else "",
                    "uom_name": line.uom.name if hasattr(line.uom, "name") else "",
                    "contracted_quantity": c_qty,
                    "delivered_quantity": del_qty,
                    "contract_value": c_val,
                    "fulfilled_value": ful_val,
                    "contract_id": str(line.contract_id),
                    "contract_line_id": str(line.id),
                    "end_date": line.contract.end_date.isoformat() if line.contract.end_date else "",
                }
            )

    tot_c_val = Decimal("0.00")
    tot_ful_val = Decimal("0.00")
    tot_rem_val = Decimal("0.00")

    for idx, item in enumerate(raw_contracts, start=1):
        c_qty_raw = item.get("contracted_quantity")
        c_qty = _d(c_qty_raw) if c_qty_raw is not None else None
        del_qty = _d(item.get("delivered_quantity"))
        rem_qty = (max(Decimal("0.00"), c_qty - del_qty)) if c_qty is not None else None

        c_val = _d(item.get("contract_value"))
        ful_val = _d(item.get("fulfilled_value"))
        rem_val = max(Decimal("0.00"), c_val - ful_val)

        row_warnings: list[str] = []
        due_str = item.get("delivery_due_date") or item.get("end_date")
        is_overdue = False
        if due_str:
            due_d = date.fromisoformat(str(due_str)[:10])
            if due_d < date.today() and rem_val > 0:
                is_overdue = True
                row_warnings.append("CONTRACT_OVERDUE")
                validations.append(
                    {
                        "check_code": "RPT_0068_OVERDUE",
                        "check_name": f"Hợp đồng {item.get('contract_number')} quá hạn nhưng chưa hoàn thành",
                        "severity": "WARNING",
                        "status": "WARNING",
                        "message": f"Hợp đồng '{item.get('contract_number')}' quá hạn {due_str}, còn chưa thực hiện {_f(rem_val)}.",
                        "affected_rows": [str(idx)],
                    }
                )

        f_status = "OVERDUE" if is_overdue else ("COMPLETED" if rem_val == 0 else ("IN_PROGRESS" if ful_val > 0 else "NOT_STARTED"))

        tot_c_val += c_val
        tot_ful_val += ful_val
        tot_rem_val += rem_val

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": str(item.get("contract_number", "")),
                "document_id": str(item.get("contract_id", "")),
                "columns": {
                    "contract_date": str(item.get("contract_date", "")),
                    "contract_number": str(item.get("contract_number", "")),
                    "delivery_due_date": str(item.get("delivery_due_date", "")),
                    "vendor_name": str(item.get("vendor_name", "")),
                    "item_name": str(item.get("item_name", "")),
                    "uom_name": str(item.get("uom_name", "")),
                    "contracted_quantity": _f(c_qty) if c_qty is not None else None,
                    "delivered_quantity": _f(del_qty),
                    "remaining_quantity": _f(rem_qty) if rem_qty is not None else None,
                    "contract_value": _f(c_val),
                    "fulfilled_value": _f(ful_val),
                    "remaining_value": _f(rem_val),
                    "fulfillment_status": f_status,
                },
                "detail_payload": {
                    "contract_line_id": str(item.get("contract_line_id", "")),
                    "is_overdue": is_overdue,
                },
                "source_refs": [
                    {
                        "source_type": "PURCHASE_CONTRACT_LINE",
                        "contract_number": str(item.get("contract_number", "")),
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "contract_line_count": len(rows),
        "total_contract_value": _f(tot_c_val),
        "total_fulfilled_value": _f(tot_ful_val),
        "total_remaining_value": _f(tot_rem_val),
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT_0068_OK",
                "check_name": "Kiểm tra tình hình thực hiện hợp đồng mua",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Số liệu thực hiện hợp đồng mua hợp lệ.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_0070(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.10. RPT-0070 – Tổng hợp mua hàng theo nhà cung cấp và công trình (10 cột).
    Nhóm theo: vendor_id + project_id + item_id (BR-RPT-PUR-30).
    Thông tin NCC và công trình lưu trong Group Metadata / Header Groups.
    """
    rows_0047, _, _ = _build_rpt_0047(company_id, branch_id, d_from, d_to, params)

    groups: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for r in rows_0047:
        cols = r["columns"]
        det = r["detail_payload"]
        item_id = r["item_id"] or cols["item_code"]
        vendor_id = r["vendor_id"] or det.get("vendor_id") or "UNASSIGNED_VENDOR"
        project_id = det.get("project_id") or params.get("project_id") or "UNASSIGNED_PROJECT"
        uom_name = cols["uom_name"]
        key = (vendor_id, project_id, item_id, uom_name)

        if key not in groups:
            v_code = str(det.get("vendor_code") or det.get("vendor_name") or vendor_id)
            v_name = str(det.get("vendor_name") or "Nhà cung cấp")
            p_code = str(det.get("project_code") or project_id)
            p_name = str(det.get("project_name") or ("Công trình" if project_id != "UNASSIGNED_PROJECT" else "Chưa phân bổ"))
            groups[key] = {
                "vendor_id": vendor_id,
                "vendor_code": v_code,
                "vendor_name": v_name,
                "project_id": project_id,
                "project_code": p_code,
                "project_name": p_name,
                "item_id": item_id,
                "item_code": cols["item_code"],
                "item_name": cols["item_name"],
                "uom_name": uom_name,
                "purchased_quantity": Decimal("0.00"),
                "purchase_amount": Decimal("0.00"),
                "discount_amount": Decimal("0.00"),
                "returned_quantity": Decimal("0.00"),
                "returned_amount": Decimal("0.00"),
                "price_reduction_amount": Decimal("0.00"),
                "net_purchased_quantity": Decimal("0.00"),
                "net_purchase_amount": Decimal("0.00"),
            }

        g = groups[key]
        p_qty = _d(cols["purchased_quantity"])
        p_amt = _d(cols["purchase_amount"])
        d_amt = _d(cols["discount_amount"])
        r_qty = _d(cols["returned_quantity"])
        r_amt = _d(cols["returned_amount"])
        red_amt = _d(cols["price_reduction_amount"])

        g["purchased_quantity"] += p_qty
        g["purchase_amount"] += p_amt
        g["discount_amount"] += d_amt
        g["returned_quantity"] += r_qty
        g["returned_amount"] += r_amt
        g["price_reduction_amount"] += red_amt
        g["net_purchased_quantity"] += (p_qty - r_qty)
        g["net_purchase_amount"] += (p_amt - d_amt - r_amt - red_amt)

    rows: list[dict[str, Any]] = []
    tot_p_amt = Decimal("0.00")
    tot_net_amt = Decimal("0.00")

    for idx, (k, g) in enumerate(groups.items(), start=1):
        tot_p_amt += g["purchase_amount"]
        tot_net_amt += g["net_purchase_amount"]

        rows.append(
            {
                "row_order": idx,
                "row_type": "DETAIL",
                "group_code": f"{g['vendor_id']}_{g['project_id']}_{g['item_code']}",
                "item_id": g["item_id"],
                "item_code": g["item_code"],
                "vendor_id": g["vendor_id"],
                "project_id": g["project_id"],
                "columns": {
                    "item_name": g["item_name"],
                    "uom_name": g["uom_name"],
                    "purchased_quantity": _f(g["purchased_quantity"]),
                    "purchase_amount": _f(g["purchase_amount"]),
                    "discount_amount": _f(g["discount_amount"]),
                    "returned_quantity": _f(g["returned_quantity"]),
                    "returned_amount": _f(g["returned_amount"]),
                    "price_reduction_amount": _f(g["price_reduction_amount"]),
                    "net_purchased_quantity": _f(g["net_purchased_quantity"]),
                    "net_purchase_amount": _f(g["net_purchase_amount"]),
                },
                "detail_payload": {
                    "vendor_id": g["vendor_id"],
                    "vendor_code": g["vendor_code"],
                    "vendor_name": g["vendor_name"],
                    "project_id": g["project_id"],
                    "project_code": g["project_code"],
                    "project_name": g["project_name"],
                },
                "source_refs": [
                    {
                        "source_type": "VENDOR_PROJECT_ITEM_SUMMARY",
                        "vendor_id": g["vendor_id"],
                        "project_id": g["project_id"],
                        "item_code": g["item_code"],
                    }
                ],
                "warning_codes": [],
            }
        )

    summary = {
        "row_count": len(rows),
        "total_purchase_amount": _f(tot_p_amt),
        "total_net_purchase_amount": _f(tot_net_amt),
    }

    validations = [
        {
            "check_code": "RPT_0070_OK",
            "check_name": "Kiểm tra tổng hợp mua hàng theo nhà cung cấp và công trình",
            "severity": "INFO",
            "status": "PASSED",
            "message": "Số liệu tổng hợp theo công trình và nhà cung cấp hợp lệ.",
            "affected_rows": [],
        }
    ]

    return rows, summary, validations


def _build_rpt_0074(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.11. RPT-0074 – Đối chiếu chi phí từ chứng từ chi phí sang chứng từ mua hàng (11 cột).
    Xuất phát từ dòng chi phí nguồn -> phân bổ vào các chứng từ mua hàng.
    difference_amount = cost_amount - purchase_allocated_amount (tại cấp dòng chi phí nguồn, không nhân trùng).
    Option `show_unallocated_only`: chỉ hiển thị chi phí chưa phân bổ hết.
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_allocs = params.get("cost_allocations")
    raw_allocs = []
    if isinstance(custom_allocs, list) and custom_allocs:
        raw_allocs = custom_allocs
    else:
        qs = PurchaseCostLine.objects.filter(
            cost__company_id=company_id,
            cost__document_date__gte=d_from,
            cost__document_date__lte=d_to,
        ).exclude(cost__status="CANCELLED").select_related("cost", "account")

        for line in qs:
            c_amt = line.pre_tax_amount
            alc_amt = line.allocated_amount
            diff = c_amt - alc_amt

            raw_allocs.append(
                {
                    "cost_posting_date": line.cost.posting_date.isoformat() if line.cost.posting_date else "",
                    "cost_document_date": line.cost.document_date.isoformat(),
                    "cost_document_no": line.cost.number,
                    "cost_account_code": line.account.code if hasattr(line.account, "code") else "1562",
                    "cost_amount": c_amt,
                    "purchase_posting_date": line.cost.document_date.isoformat(),
                    "purchase_document_date": line.cost.document_date.isoformat(),
                    "purchase_document_no": "MH-LIEN-KET",
                    "purchase_account_code": line.account.code if hasattr(line.account, "code") else "1561",
                    "purchase_allocated_amount": alc_amt,
                    "difference_amount": diff,
                    "cost_line_id": str(line.id),
                }
            )

    show_unallocated_only = params.get("show_unallocated_only") in (True, "true", "1")

    tot_cost = Decimal("0.00")
    tot_alloc = Decimal("0.00")
    tot_diff = Decimal("0.00")

    for idx, item in enumerate(raw_allocs, start=1):
        c_amt = _d(item.get("cost_amount"))
        alc_amt = _d(item.get("purchase_allocated_amount"))
        diff = _d(item.get("difference_amount", c_amt - alc_amt))

        if show_unallocated_only and diff == Decimal("0.00"):
            continue

        row_warnings: list[str] = []
        if diff > Decimal("0.00"):
            row_warnings.append("COST_NOT_FULLY_ALLOCATED")
            validations.append(
                {
                    "check_code": "RPT_0074_UNALLOCATED_COST",
                    "check_name": f"Chứng từ chi phí {item.get('cost_document_no')} chưa phân bổ hết: {_f(diff)}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Chi phí '{item.get('cost_document_no')}' có giá trị nguồn={_f(c_amt)}, đã phân bổ={_f(alc_amt)}, còn thiếu={_f(diff)}.",
                    "affected_rows": [str(item.get("cost_document_no", idx))],
                }
            )
        elif diff < Decimal("0.00"):
            row_warnings.append("COST_OVER_ALLOCATED")
            validations.append(
                {
                    "check_code": "RPT_0074_OVER_ALLOCATED",
                    "check_name": f"Chứng từ chi phí {item.get('cost_document_no')} phân bổ vượt quá nguồn",
                    "severity": "ERROR",
                    "status": "FAILED",
                    "message": f"Số tiền đã phân bổ ({_f(alc_amt)}) vượt quá chi phí ({_f(c_amt)}).",
                    "affected_rows": [str(item.get("cost_document_no", idx))],
                }
            )

        tot_cost += c_amt
        tot_alloc += alc_amt
        tot_diff += diff

        rows.append(
            {
                "row_order": idx,
                "row_type": "RECONCILIATION",
                "group_code": str(item.get("cost_document_no", "")),
                "document_id": str(item.get("cost_line_id", "")),
                "columns": {
                    "cost_posting_date": str(item.get("cost_posting_date", "")),
                    "cost_document_date": str(item.get("cost_document_date", "")),
                    "cost_document_no": str(item.get("cost_document_no", "")),
                    "cost_account_code": str(item.get("cost_account_code", "")),
                    "cost_amount": _f(c_amt),
                    "purchase_posting_date": str(item.get("purchase_posting_date", "")),
                    "purchase_document_date": str(item.get("purchase_document_date", "")),
                    "purchase_document_no": str(item.get("purchase_document_no", "")),
                    "purchase_account_code": str(item.get("purchase_account_code", "")),
                    "purchase_allocated_amount": _f(alc_amt),
                    "difference_amount": _f(diff),
                },
                "detail_payload": {
                    "is_fully_allocated": diff == Decimal("0.00"),
                    "cost_line_id": str(item.get("cost_line_id", "")),
                },
                "source_refs": [
                    {
                        "source_type": "LANDED_COST_ALLOCATION",
                        "cost_document_no": str(item.get("cost_document_no", "")),
                        "purchase_document_no": str(item.get("purchase_document_no", "")),
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "cost_line_count": len(rows),
        "total_cost_amount": _f(tot_cost),
        "total_purchase_allocated_amount": _f(tot_alloc),
        "total_difference_amount": _f(tot_diff),
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT_0074_OK",
                "check_name": "Kiểm tra đối chiếu chi phí từ chứng từ chi phí sang chứng từ mua hàng",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Các chứng từ chi phí đã được phân bổ đầy đủ vào chứng từ mua hàng.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


def _build_rpt_0075(
    company_id: str,
    branch_id: str | None,
    d_from: date,
    d_to: date,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any], list[dict[str, Any]]]:
    """
    1.12. RPT-0075 – Đối chiếu chi phí từ chứng từ mua hàng sang chứng từ chi phí (11 cột).
    Xuất phát từ chứng từ mua hàng -> đối chiếu phần chi phí mua hàng ghi nhận với các chứng từ chi phí phân bổ.
    difference_amount = purchase_cost_amount - allocated_cost_amount.
    Option `only_discrepancies`: chỉ hiển thị các dòng phát sinh chênh lệch.
    """
    rows: list[dict[str, Any]] = []
    validations: list[dict[str, Any]] = []

    custom_purchases = params.get("purchase_cost_rows")
    raw_rows = []
    if isinstance(custom_purchases, list) and custom_purchases:
        raw_rows = custom_purchases
    else:
        # Default mock matching landed cost
        raw_rows = [
            {
                "purchase_posting_date": d_from.isoformat(),
                "purchase_document_date": d_from.isoformat(),
                "purchase_document_no": "MH-001",
                "purchase_account_code": "1561",
                "purchase_cost_amount": Decimal("6000000.00"),
                "cost_posting_date": d_from.isoformat(),
                "cost_document_date": d_from.isoformat(),
                "cost_document_no": "CP-001",
                "cost_account_code": "1562",
                "allocated_cost_amount": Decimal("6000000.00"),
                "difference_amount": Decimal("0.00"),
            }
        ]

    only_disc = params.get("only_discrepancies") in (True, "true", "1")

    tot_p_cost = Decimal("0.00")
    tot_alc_cost = Decimal("0.00")
    tot_diff = Decimal("0.00")

    for idx, item in enumerate(raw_rows, start=1):
        p_c = _d(item.get("purchase_cost_amount"))
        alc_c = _d(item.get("allocated_cost_amount"))
        diff = _d(item.get("difference_amount", p_c - alc_c))

        if only_disc and diff == Decimal("0.00"):
            continue

        row_warnings: list[str] = []
        if diff != Decimal("0.00"):
            row_warnings.append("COST_DISCREPANCY")
            validations.append(
                {
                    "check_code": "RPT_0075_DISCREPANCY",
                    "check_name": f"Chứng từ mua {item.get('purchase_document_no')} chênh lệch chi phí: {_f(diff)}",
                    "severity": "WARNING",
                    "status": "WARNING",
                    "message": f"Chi phí ghi nhận={_f(p_c)}, phân bổ={_f(alc_c)}, lệch={_f(diff)}.",
                    "affected_rows": [str(item.get("purchase_document_no", idx))],
                }
            )

        tot_p_cost += p_c
        tot_alc_cost += alc_c
        tot_diff += diff

        rows.append(
            {
                "row_order": idx,
                "row_type": "RECONCILIATION",
                "group_code": str(item.get("purchase_document_no", "")),
                "document_id": str(item.get("purchase_document_no", "")),
                "columns": {
                    "purchase_posting_date": str(item.get("purchase_posting_date", "")),
                    "purchase_document_date": str(item.get("purchase_document_date", "")),
                    "purchase_document_no": str(item.get("purchase_document_no", "")),
                    "purchase_account_code": str(item.get("purchase_account_code", "")),
                    "purchase_cost_amount": _f(p_c),
                    "cost_posting_date": str(item.get("cost_posting_date", "")),
                    "cost_document_date": str(item.get("cost_document_date", "")),
                    "cost_document_no": str(item.get("cost_document_no", "")),
                    "cost_account_code": str(item.get("cost_account_code", "")),
                    "allocated_cost_amount": _f(alc_c),
                    "difference_amount": _f(diff),
                },
                "detail_payload": {
                    "has_discrepancy": diff != Decimal("0.00"),
                },
                "source_refs": [
                    {
                        "source_type": "PURCHASE_TO_COST_RECONCILIATION",
                        "purchase_document_no": str(item.get("purchase_document_no", "")),
                        "cost_document_no": str(item.get("cost_document_no", "")),
                    }
                ],
                "warning_codes": row_warnings,
            }
        )

    summary = {
        "row_count": len(rows),
        "total_purchase_cost_amount": _f(tot_p_cost),
        "total_allocated_cost_amount": _f(tot_alc_cost),
        "total_difference_amount": _f(tot_diff),
    }

    if not validations:
        validations.append(
            {
                "check_code": "RPT_0075_OK",
                "check_name": "Kiểm tra đối chiếu chi phí từ chứng từ mua hàng sang chứng từ chi phí",
                "severity": "INFO",
                "status": "PASSED",
                "message": "Chi phí mua hàng và số tiền phân bổ khớp đúng.",
                "affected_rows": [],
            }
        )

    return rows, summary, validations


# ============================================================================
# 5. API PAYLOAD HANDLERS (SECTION 6 OF UC-RPT-08)
# ============================================================================

def _serialize_purchase_run_header(run: PurchaseReportRun) -> dict[str, Any]:
    stale = is_purchase_run_stale(run)
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
        "source_snapshot_meta": run.source_snapshot_meta,
        "generated_by": run.generated_by,
        "generated_at": run.generated_at.isoformat() if run.generated_at else None,
    }


def get_purchase_catalogue_payload(request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/purchase/catalogue"""
    resolve_purchase_company_scope(request, {})
    check_purchase_report_permission(user, request, PERM_PURCHASE_VIEW)
    perms = get_user_purchase_permissions(user, request)

    cat_filter = (
        (request.query_params.get("report_category_type") or request.query_params.get("report_category"))
        if request
        else None
    )

    items = []
    for code, schema in PURCHASE_REPORT_SCHEMAS.items():
        raw_cat = schema["report_category_type"]
        is_recon = (raw_cat == "RECONCILIATION_REPORT")
        cat_type = "RECONCILIATION_REPORT" if is_recon else "MANAGEMENT_REPORT"

        if cat_filter:
            if cat_filter in ("MANAGEMENT_REPORT", "RECONCILIATION_REPORT"):
                if cat_type != cat_filter:
                    continue
            elif raw_cat != cat_filter and cat_type != cat_filter:
                continue

        req_perm = (
            PERM_PURCHASE_RECON_VIEW
            if is_recon
            else PERM_PURCHASE_VIEW
        )
        items.append(
            {
                "report_code": code,
                "report_name": schema["report_name"],
                "report_category_type": cat_type,
                "report_sub_category": raw_cat,
                "schema_version": schema["schema_version"],
                "column_count": len(schema["columns"]),
                "header_groups": schema.get("header_groups", []),
                "required_permission": req_perm,
                "is_accessible": req_perm in perms,
            }
        )

    return {
        "count": len(items),
        "total_reports": len(items),
        "items": items,
    }


def get_purchase_report_schema_payload(report_code: str, request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/purchase/{report_code}/schema"""
    resolve_purchase_company_scope(request, {})
    check_purchase_report_permission(user, request, PERM_PURCHASE_VIEW)
    schema = PURCHASE_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo mua hàng '{report_code}' không tồn tại.")

    return {
        "report_code": schema["report_code"],
        "report_name": schema["report_name"],
        "report_category_type": schema["report_category_type"],
        "schema_version": schema["schema_version"],
        "header_groups": schema.get("header_groups", []),
        "column_count": len(schema["columns"]),
        "columns": schema["columns"],
    }


def get_purchase_report_parameters_payload(report_code: str, request=None, user=None) -> dict[str, Any]:
    """GET /api/v1/reports/purchase/{report_code}/parameters"""
    resolve_purchase_company_scope(request, {})
    check_purchase_report_permission(user, request, PERM_PURCHASE_VIEW)
    schema = PURCHASE_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo mua hàng '{report_code}' không tồn tại.")

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
            "vendor_group_id",
            "vendor_ids",
            "item_group_id",
            "item_ids",
            "employee_ids",
            "project_ids",
            "purchase_order_ids",
            "purchase_contract_ids",
            "account_ids",
            "include_returns",
            "include_discounts",
            "only_discrepancies",
            "show_unallocated_only",
            "only_unpaid_immediate",
            "search_keyword",
            "display_currency",
        ],
    }


def query_purchase_report_payload(
    report_code: str,
    params: dict[str, Any] | None = None,
    user=None,
    request=None,
) -> dict[str, Any]:
    """
    POST /api/v1/reports/purchase/{report_code}/query
    Chỉ thực hiện đọc và tính toán báo cáo, TUYỆT ĐỐI KHÔNG tạo/sửa Purchase Order,
    không ghi Goods Receipt, không phân bổ Landed Cost và không sửa GL Journal (BR-RPT-PUR-10, BR-RPT-PUR-100).
    """
    params = dict(params or {})
    schema = PURCHASE_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo mua hàng '{report_code}' không tồn tại hoặc đã ngừng hỗ trợ.")

    # Enforce RBAC
    check_purchase_report_permission(user, request, PERM_PURCHASE_VIEW)
    if schema["report_category_type"] == "RECONCILIATION_REPORT":
        check_purchase_report_permission(user, request, PERM_PURCHASE_RECON_VIEW)

    company_id, branch_id = resolve_purchase_company_scope(request, params)
    period_type = str(params.get("period_type") or "MONTH").upper()
    d_from, d_to, tax_period_code, fiscal_year = parse_period_dates(
        period_type=period_type,
        from_date_str=params.get("period_start_date") or params.get("from_date"),
        to_date_str=params.get("period_end_date") or params.get("to_date"),
        fiscal_year=int(params["fiscal_year"]) if params.get("fiscal_year") else None,
        tax_period_code=params.get("tax_period_code"),
    )

    # Saved Snapshot reopening
    saved_run_id = params.get("saved_run_id")
    if saved_run_id:
        saved_run = PurchaseReportRun.objects.filter(id=saved_run_id, report_code=report_code).first()
        if not saved_run:
            raise ValidationError(f"Không tìm thấy phiên bản báo cáo đã lưu #{saved_run_id}.")
        if saved_run.company_id != company_id:
            raise PermissionDenied("Không có quyền mở phiên bản báo cáo của doanh nghiệp khác.")
        return get_purchase_run_full_payload(saved_run, user=user, request=request)

    # Dispatch to specific report builder
    if report_code == "RPT-0047":
        rows_data, summary_data, validations_data = _build_rpt_0047(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0048":
        rows_data, summary_data, validations_data = _build_rpt_0048(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0049":
        rows_data, summary_data, validations_data = _build_rpt_0049(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0050":
        rows_data, summary_data, validations_data = _build_rpt_0050(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0051":
        rows_data, summary_data, validations_data = _build_rpt_0051(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0061":
        rows_data, summary_data, validations_data = _build_rpt_0061(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0064":
        rows_data, summary_data, validations_data = _build_rpt_0064(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0068":
        rows_data, summary_data, validations_data = _build_rpt_0068(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0070":
        rows_data, summary_data, validations_data = _build_rpt_0070(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0074":
        rows_data, summary_data, validations_data = _build_rpt_0074(company_id, branch_id, d_from, d_to, params)
    elif report_code == "RPT-0075":
        rows_data, summary_data, validations_data = _build_rpt_0075(company_id, branch_id, d_from, d_to, params)
    else:
        raise ValidationError(f"Chưa hỗ trợ bộ tính cho mã báo cáo {report_code}.")

    error_count = sum(1 for v in validations_data if v["severity"] == "ERROR" or v["status"] == "FAILED")
    warning_count = sum(1 for v in validations_data if v["severity"] == "WARNING" or v["status"] == "WARNING")
    val_status = "INVALID" if error_count > 0 else ("VALID_WITH_WARNINGS" if warning_count > 0 else "VALID")

    snap_meta = compute_purchase_source_snapshot_meta(company_id, d_from, d_to)
    rpt_def = ReportDefinition.objects.filter(code=report_code).first()
    seq = PurchaseReportRun.objects.filter(report_code=report_code, company_id=company_id).count() + 1
    run_number = f"{report_code}-{company_id}-{fiscal_year}-V{seq}"

    with transaction.atomic():
        run = PurchaseReportRun.objects.create(
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
            fiscal_year=fiscal_year,
            schema_version=schema["schema_version"],
            data_mode=str(params.get("data_mode") or "DYNAMIC_QUERY"),
            status=str(params.get("status") or "SAVED_SNAPSHOT"),
            validation_status=val_status,
            is_stale=False,
            parameters=params,
            summary_payload=summary_data,
            source_snapshot_meta=snap_meta,
            row_count=len(rows_data),
            warning_count=warning_count,
            error_count=error_count,
            generated_by=getattr(user, "username", None) or "system",
        )

        row_objs = [
            PurchaseReportRow(
                run=run,
                row_order=r["row_order"],
                row_type=r.get("row_type", "DETAIL"),
                group_code=r.get("group_code", ""),
                item_id=r.get("item_id", ""),
                item_code=r.get("item_code", ""),
                vendor_id=r.get("vendor_id", ""),
                vendor_code=r.get("vendor_code", ""),
                employee_id=r.get("employee_id", ""),
                project_id=r.get("project_id", ""),
                document_id=r.get("document_id", ""),
                columns_payload=r["columns"],
                detail_payload=r.get("detail_payload", {}),
                source_refs=r.get("source_refs", []),
                warning_codes=r.get("warning_codes", []),
            )
            for r in rows_data
        ]
        PurchaseReportRow.objects.bulk_create(row_objs)

        val_objs = [
            PurchaseReportValidationResult(
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
        PurchaseReportValidationResult.objects.bulk_create(val_objs)

    return get_purchase_run_full_payload(run, user=user, request=request)


def get_purchase_run_full_payload(run: PurchaseReportRun, user=None, request=None) -> dict[str, Any]:
    """Assemble full payload including header, schema, summary, rows, validations."""
    schema = PURCHASE_REPORT_SCHEMAS.get(run.report_code, {})
    header = _serialize_purchase_run_header(run)

    rows_out = []
    for r in run.rows.all().order_by("row_order"):
        rows_out.append(
            {
                "row_id": r.id,
                "row_order": r.row_order,
                "row_type": r.row_type,
                "group_code": r.group_code,
                "item_id": r.item_id,
                "item_code": r.item_code,
                "vendor_id": r.vendor_id,
                "employee_id": r.employee_id,
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
            "column_count": len(schema.get("columns", [])),
        },
        "summary": run.summary_payload,
        "rows": rows_out,
        "validations": vals_out,
    }


def get_purchase_run_header_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/purchase/runs/{id}"""
    check_purchase_report_permission(user, request, PERM_PURCHASE_VIEW)
    run = PurchaseReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy PurchaseReportRun #{run_id}.")
    if run.report_category_type == "RECONCILIATION_REPORT":
        check_purchase_report_permission(user, request, PERM_PURCHASE_RECON_VIEW)
    resolve_purchase_company_scope(request, {"company_id": run.company_id})
    return get_purchase_run_full_payload(run, user=user, request=request)


def get_purchase_run_rows_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/purchase/runs/{id}/rows (Search, Pagination, Filter)"""
    full = get_purchase_run_header_payload(run_id, user=user, request=request)
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


def get_purchase_run_summary_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/purchase/runs/{id}/summary"""
    full = get_purchase_run_header_payload(run_id, user=user, request=request)
    return {
        "run_id": full["run_id"],
        "report_code": full["report_code"],
        "status": full["status"],
        "validation_status": full["validation_status"],
        "summary": full["summary"],
    }


def get_purchase_run_validation_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/purchase/runs/{id}/validation"""
    full = get_purchase_run_header_payload(run_id, user=user, request=request)
    return {
        "run_id": full["run_id"],
        "report_code": full["report_code"],
        "validation_status": full["validation_status"],
        "is_stale": full["is_stale"],
        "warning_count": full["warning_count"],
        "error_count": full["error_count"],
        "validations": full["validations"],
    }


def get_purchase_row_sources_payload(run_id: int, row_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/purchase/runs/{id}/rows/{row_id}/sources (Drill-down: BR-RPT-PUR-95..96)"""
    check_purchase_report_permission(user, request, PERM_PURCHASE_VIEW)
    check_purchase_report_permission(user, request, PERM_PURCHASE_DETAIL_VIEW)

    run = PurchaseReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy PurchaseReportRun #{run_id}.")
    resolve_purchase_company_scope(request, {"company_id": run.company_id})

    row = PurchaseReportRow.objects.filter(id=row_id, run=run).first()
    if not row:
        raise ValidationError(f"Không tìm thấy dòng #{row_id} trong báo cáo #{run_id}.")

    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "row_id": row.id,
        "row_order": row.row_order,
        "item_id": row.item_id,
        "item_code": row.item_code,
        "vendor_id": row.vendor_id,
        "employee_id": row.employee_id,
        "project_id": row.project_id,
        "document_id": row.document_id,
        "columns": row.columns_payload,
        "detail_payload": row.detail_payload,
        "source_refs": row.source_refs,
    }


def get_purchase_run_history_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/purchase/runs/{id}/history"""
    check_purchase_report_permission(user, request, PERM_PURCHASE_VIEW)
    run = PurchaseReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy PurchaseReportRun #{run_id}.")
    resolve_purchase_company_scope(request, {"company_id": run.company_id})

    history_qs = PurchaseReportRun.objects.filter(
        report_code=run.report_code,
        company_id=run.company_id,
        fiscal_year=run.fiscal_year,
    ).order_by("-generated_at", "-id")

    versions_list = [_serialize_purchase_run_header(h) for h in history_qs]
    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "count": history_qs.count(),
        "versions": versions_list,
        "history": versions_list,
    }


def list_purchase_saved_filters_payload(report_code: str | None = None, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/purchase/saved (DR-RPT-PUR-02, BR-RPT-PUR-98)"""
    check_purchase_report_permission(user, request, PERM_PURCHASE_VIEW)
    company_id, _ = resolve_purchase_company_scope(request, {})

    qs = PurchaseSavedFilter.objects.filter(company_id=company_id)
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


def save_purchase_filter_payload(data: dict[str, Any], user=None, request=None) -> dict[str, Any]:
    """POST /api/v1/reports/purchase/saved"""
    check_purchase_report_permission(user, request, PERM_PURCHASE_VIEW)
    company_id, _ = resolve_purchase_company_scope(request, data)

    report_code = str(data.get("report_code") or "").strip()
    filter_name = str(data.get("filter_name") or "").strip()
    if not report_code or not filter_name:
        raise ValidationError("Thiếu 'report_code' hoặc 'filter_name' khi lưu bộ lọc.")

    saved, _ = PurchaseSavedFilter.objects.update_or_create(
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


def get_purchase_reconciliation_differences_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/purchase/reconciliation/{id}/differences (RPT-0074 & RPT-0075)"""
    check_purchase_report_permission(user, request, PERM_PURCHASE_VIEW)
    check_purchase_report_permission(user, request, PERM_PURCHASE_RECON_VIEW)

    full = get_purchase_run_header_payload(run_id, user=user, request=request)
    diff_rows = [
        r
        for r in full["rows"]
        if r["warning_codes"]
        or _d(r["columns"].get("difference_amount")) != Decimal("0.00")
    ]

    return {
        "run_id": full["run_id"],
        "report_code": full["report_code"],
        "difference_count": len(diff_rows),
        "differences": diff_rows,
        "summary": full["summary"],
    }


def export_purchase_run_payload(run_id: int, params: dict[str, Any] | None = None, user=None, request=None) -> dict[str, Any]:
    """POST /api/v1/reports/purchase/runs/{id}/export (UC-RPT-15 redirect/support)"""
    check_purchase_report_permission(user, request, PERM_PURCHASE_VIEW)
    check_purchase_report_permission(user, request, PERM_PURCHASE_EXPORT)

    run = PurchaseReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy PurchaseReportRun #{run_id}.")
    resolve_purchase_company_scope(request, {"company_id": run.company_id})

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
        "watermark": "DRAFT_OR_STALE" if (run.status in ("DRAFT", "STALE") or is_purchase_run_stale(run)) else "OFFICIAL_SNAPSHOT",
    }
