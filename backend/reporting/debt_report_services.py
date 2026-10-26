"""
UC-RPT-10 – Báo cáo công nợ (49 Báo cáo: 18 AP + 31 AR / Combined)

Cung cấp toàn bộ logic tổng hợp, tính toán, kiểm tra và trình bày số liệu công nợ,
phải thu khách hàng, phải trả nhà cung cấp, phân tích tuổi nợ, theo dõi hóa đơn,
mặt hàng, đơn đặt hàng, hợp đồng kinh tế, công trình, nhân viên và đối chiếu công nợ.
Tuân thủ nguyên tắc read-only tuyệt đối (BR-RPT-DEBT-10, BR-RPT-DEBT-110..113).
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
from accounts_receivable.models import (
    Receivable,
    ReceivableDocument,
    ReceivableSchedule,
    Receipt,
    ReceiptAllocation,
    CustomerReceiptVoucher,
    CustomerReceiptLine,
    CustomerDebtReconciliation,
)
from purchases.models import PurchaseContract, PurchaseOrder, GoodsPurchase
from sales.models import SalesContract, SalesOrder
from accounts_payable.models import (
    Payable,
    PayableDocument,
    SupplierInvoice,
    Payment,
    PaymentAllocation,
    PaymentAllocationVoucher,
    SupplierReconciliation,
)
from master_data.models import Party

from .models import (
    ReportDefinition,
    DebtReportRun,
    DebtReportRow,
    DebtReportValidationResult,
    DebtSavedFilter,
)

logger = logging.getLogger(__name__)

ZERO = Decimal("0.0000")
TWO_PLACES = Decimal("0.01")

# Permissions
PERM_DEBT_VIEW = "RPT_DEBT_VIEW"
PERM_AR_VIEW = "RPT_AR_VIEW"
PERM_AP_VIEW = "RPT_AP_VIEW"
PERM_DEBT_DETAIL_VIEW = "RPT_DEBT_DETAIL_VIEW"
PERM_DEBT_AGING_VIEW = "RPT_DEBT_AGING_VIEW"
PERM_DEBT_EXPORT = "RPT_DEBT_EXPORT"

ALL_DEBT_PERMISSIONS = (
    PERM_DEBT_VIEW,
    PERM_AR_VIEW,
    PERM_AP_VIEW,
    PERM_DEBT_DETAIL_VIEW,
    PERM_DEBT_AGING_VIEW,
    PERM_DEBT_EXPORT,
)

PERM_ALIASES: dict[str, tuple[str, ...]] = {
    PERM_DEBT_VIEW: (
        "RPT_DEBT_VIEW",
        "RPT.DEBT.VIEW",
        "RPT.VIEW",
        "DEBT.VIEW",
        "RPT_AR_VIEW",
        "RPT_AP_VIEW",
        "RPT_DEBT_DETAIL_VIEW",
        "RPT_DEBT_AGING_VIEW",
    ),
    PERM_AR_VIEW: (
        "RPT_AR_VIEW",
        "RPT.AR.VIEW",
        "AR.VIEW",
        "RPT_DEBT_VIEW",
    ),
    PERM_AP_VIEW: (
        "RPT_AP_VIEW",
        "RPT.AP.VIEW",
        "AP.VIEW",
        "RPT_DEBT_VIEW",
    ),
    PERM_DEBT_DETAIL_VIEW: (
        "RPT_DEBT_DETAIL_VIEW",
        "RPT.DEBT.DETAIL_VIEW",
        "RPT.DRILLDOWN.VIEW",
        "RPT_DEBT_VIEW",
    ),
    PERM_DEBT_AGING_VIEW: (
        "RPT_DEBT_AGING_VIEW",
        "RPT.DEBT.AGING_VIEW",
        "DEBT.AGING.VIEW",
        "RPT_DEBT_VIEW",
    ),
    PERM_DEBT_EXPORT: (
        "RPT_DEBT_EXPORT",
        "RPT.DEBT.EXPORT",
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
# Metadata & Catalogue definitions for 49 Debt Reports
# -----------------------------------------------------------------------------

DEBT_REPORT_SCHEMAS: dict[str, dict[str, Any]] = {
    # -------------------------------------------------------------------------
    # 18 AP Reports (RPT-0052 .. RPT-0073)
    # -------------------------------------------------------------------------
    "RPT-0052": {
        "report_code": "RPT-0052",
        "report_name": "Tổng hợp công nợ phải trả nhà cung cấp",
        "report_direction": "AP",
        "report_category_type": "AP_SUMMARY",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "opening_debit", "name": "Số dư đầu kỳ - Dư Nợ (Trả trước)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "opening_credit", "name": "Số dư đầu kỳ - Dư Có (Phải trả)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_debit", "name": "Số phát sinh trong kỳ - Phát sinh Nợ (Đã trả)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_credit", "name": "Số phát sinh trong kỳ - Phát sinh Có (Mua chịu)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_debit", "name": "Số dư cuối kỳ - Dư Nợ (Trả trước)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_credit", "name": "Số dư cuối kỳ - Dư Có (Còn phải trả)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0053": {
        "report_code": "RPT-0053",
        "report_name": "Báo cáo chi tiết công nợ phải trả theo mặt hàng tĩnh",
        "report_direction": "AP",
        "report_category_type": "AP_DETAIL",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "quantity", "name": "Số lượng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "unit_price", "name": "Đơn giá", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "amount", "name": "Thành tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0054": {
        "report_code": "RPT-0054",
        "report_name": "Báo cáo chi tiết công nợ phải trả theo hóa đơn",
        "report_direction": "AP",
        "report_category_type": "AP_DETAIL",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "due_date", "name": "Ngày đến hạn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_amount", "name": "Số tiền hóa đơn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải trả", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "is_overdue", "name": "Quá hạn", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "days_overdue", "name": "Số ngày quá hạn", "data_type": "INTEGER", "align": "right", "is_totalable": False},
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    "RPT-0055": {
        "report_code": "RPT-0055",
        "report_name": "Báo cáo chi tiết công nợ phải trả theo mặt hàng",
        "report_direction": "AP",
        "report_category_type": "AP_DETAIL",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "quantity", "name": "Số lượng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "unit_price", "name": "Đơn giá", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "amount", "name": "Thành tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải trả", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0056": {
        "report_code": "RPT-0056",
        "report_name": "Sổ chi tiết công nợ phải trả nhà cung cấp",
        "report_direction": "AP",
        "report_category_type": "AP_LEDGER",
        "schema_version": "1.0",
        "columns": [
            {"code": "posting_date", "name": "Ngày ghi sổ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "offset_account", "name": "TK đối ứng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "due_date", "name": "Hạn thanh toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "debit_amount", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_amount", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_debit", "name": "Dư Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_credit", "name": "Dư Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0057": {
        "report_code": "RPT-0057",
        "report_name": "Báo cáo phân tích công nợ phải trả theo tuổi nợ",
        "report_direction": "AP",
        "report_category_type": "AP_AGING",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "total_debt", "name": "Tổng nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "not_due_amount", "name": "Nợ chưa đến hạn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "due_0_30", "name": "Đến hạn 0 - 30 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_1_30", "name": "Quá hạn 1 - 30 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_31_60", "name": "Quá hạn 31 - 60 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_61_90", "name": "Quá hạn 61 - 90 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_91_120", "name": "Quá hạn 91 - 120 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_over_120", "name": "Quá hạn > 120 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "no_due_date_amount", "name": "Không có hạn nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "note", "name": "Ghi chú", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "paid_amount", "name": "Đã thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0058": {
        "report_code": "RPT-0058",
        "report_name": "Biên bản đối chiếu và xác nhận công nợ phải trả",
        "report_direction": "AP",
        "report_category_type": "AP_CONFIRMATION",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "debt_account", "name": "TK công nợ", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "debit_amount", "name": "Phát sinh Nợ (Đã thanh toán)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_amount", "name": "Phát sinh Có (Phải trả)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_balance", "name": "Số dư cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "note", "name": "Ghi chú", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "confirmation_status", "name": "Ký xác nhận", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0059": {
        "report_code": "RPT-0059",
        "report_name": "Báo cáo chi tiết công nợ phải trả theo tuổi nợ",
        "report_direction": "AP",
        "report_category_type": "AP_AGING",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "due_date", "name": "Hạn thanh toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "total_debt", "name": "Tổng nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "not_due_amount", "name": "Nợ chưa đến hạn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "due_0_30", "name": "Đến hạn 0 - 30 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_1_30", "name": "Quá hạn 1 - 30 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_31_60", "name": "Quá hạn 31 - 60 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_61_90", "name": "Quá hạn 61 - 90 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_91_120", "name": "Quá hạn 91 - 120 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_over_120", "name": "Quá hạn > 120 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "no_due_date_amount", "name": "Không có hạn nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "days_overdue", "name": "Số ngày quá hạn", "data_type": "INTEGER", "align": "right", "is_totalable": False},
            {"code": "status", "name": "Tình trạng", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0060": {
        "report_code": "RPT-0060",
        "report_name": "Thông báo công nợ nhà cung cấp",
        "report_direction": "AP",
        "report_category_type": "AP_NOTICE",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ/Hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ/Hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "due_date", "name": "Hạn thanh toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "debt_amount", "name": "Số tiền phát sinh", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thanh toán/trả", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "note", "name": "Ghi chú", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    "RPT-0062": {
        "report_code": "RPT-0062",
        "report_name": "Tổng hợp công nợ phải trả theo nhân viên",
        "report_direction": "AP",
        "report_category_type": "AP_SUMMARY",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "employee_code", "name": "Mã nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "employee_name", "name": "Tên nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "opening_debit", "name": "Dư Nợ đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "opening_credit", "name": "Dư Có đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_debit", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_credit", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_debit", "name": "Dư Nợ cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_credit", "name": "Dư Có cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0063": {
        "report_code": "RPT-0063",
        "report_name": "Chi tiết công nợ phải trả theo nhân viên",
        "report_direction": "AP",
        "report_category_type": "AP_DETAIL",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "employee_code", "name": "Mã nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "employee_name", "name": "Tên nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "debit_amount", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_amount", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "balance", "name": "Số dư", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "due_date", "name": "Hạn thanh toán", "data_type": "DATE", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0065": {
        "report_code": "RPT-0065",
        "report_name": "Chi tiết công nợ phải trả theo đơn mua hàng",
        "report_direction": "AP",
        "report_category_type": "AP_ORDER",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "order_code", "name": "Mã đơn mua hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "order_date", "name": "Ngày đơn hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "order_amount", "name": "Tiền hàng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải trả", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "due_date", "name": "Hạn thanh toán", "data_type": "DATE", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0066": {
        "report_code": "RPT-0066",
        "report_name": "Tổng hợp công nợ phải trả theo đơn mua hàng",
        "report_direction": "AP",
        "report_category_type": "AP_ORDER",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "order_code", "name": "Mã đơn mua hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "order_date", "name": "Ngày đơn mua", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "order_amount", "name": "Tổng tiền đơn hàng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải trả", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "status", "name": "Trạng thái", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0067": {
        "report_code": "RPT-0067",
        "report_name": "Tổng hợp công nợ phải trả theo hợp đồng mua",
        "report_direction": "AP",
        "report_category_type": "AP_CONTRACT",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "contract_code", "name": "Số hợp đồng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "contract_date", "name": "Ngày hợp đồng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "contract_amount", "name": "Giá trị hợp đồng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải trả", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "status", "name": "Tình trạng", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0069": {
        "report_code": "RPT-0069",
        "report_name": "Chi tiết công nợ phải trả theo hợp đồng mua",
        "report_direction": "AP",
        "report_category_type": "AP_CONTRACT",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "contract_code", "name": "Số hợp đồng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "contract_date", "name": "Ngày hợp đồng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_name", "name": "Tên nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "period_amount", "name": "Tiền phát sinh", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0071": {
        "report_code": "RPT-0071",
        "report_name": "Chi tiết công nợ phải trả theo công trình",
        "report_direction": "AP",
        "report_category_type": "AP_PROJECT",
        "schema_version": "1.0",
        "columns": [
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "debt_account", "name": "TK công nợ", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "offset_account", "name": "TK đối ứng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "debit_amount", "name": "Nợ phát sinh", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_amount", "name": "Có phát sinh", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_debit", "name": "Dư Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_credit", "name": "Dư Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0072": {
        "report_code": "RPT-0072",
        "report_name": "Tổng hợp công nợ phải trả theo công trình",
        "report_direction": "AP",
        "report_category_type": "AP_PROJECT",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "project_code", "name": "Mã công trình", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "project_name", "name": "Tên công trình", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "vendor_code", "name": "Mã nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "opening_balance", "name": "Dư đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_debit", "name": "Phát sinh Nợ (Đã trả)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_credit", "name": "Phát sinh Có (Phải trả)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_balance", "name": "Dư cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "project_budget", "name": "Dự toán công trình", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0073": {
        "report_code": "RPT-0073",
        "report_name": "Báo cáo đối chiếu chứng từ công nợ phải trả và chứng từ thanh toán",
        "report_direction": "AP",
        "report_category_type": "AP_RECONCILIATION",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "debt_doc_no", "name": "Chứng từ công nợ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "debt_date", "name": "Ngày công nợ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "debt_amount", "name": "Số tiền công nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "payment_doc_no", "name": "Chứng từ thanh toán", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "payment_date", "name": "Ngày thanh toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "allocated_amount", "name": "Số tiền đã đối trừ/thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "difference_amount", "name": "Chênh lệch", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },

    # -------------------------------------------------------------------------
    # 31 AR / Combined Reports (RPT-0092 .. RPT-0142)
    # -------------------------------------------------------------------------
    "RPT-0092": {
        "report_code": "RPT-0092",
        "report_name": "Tổng hợp công nợ phải thu khách hàng",
        "report_direction": "AR",
        "report_category_type": "AR_SUMMARY",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "opening_debit", "name": "Số dư đầu kỳ - Dư Nợ (Phải thu)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "opening_credit", "name": "Số dư đầu kỳ - Dư Có (Trả trước)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_debit", "name": "Phát sinh Nợ (Bán hàng)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_credit", "name": "Phát sinh Có (Đã thu)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_debit", "name": "Số dư cuối kỳ - Dư Nợ (Còn phải thu)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_credit", "name": "Số dư cuối kỳ - Dư Có (Khách trả trước)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0093": {
        "report_code": "RPT-0093",
        "report_name": "Báo cáo phân tích công nợ phải thu theo tuổi nợ",
        "report_direction": "AR",
        "report_category_type": "AR_AGING",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "credit_limit", "name": "Hạn mức nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_days", "name": "Số ngày được nợ", "data_type": "INTEGER", "align": "right", "is_totalable": False},
            {"code": "total_debt", "name": "Tổng nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "not_due_amount", "name": "Nợ chưa đến hạn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "due_0_30", "name": "Đến hạn 0 - 30 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_1_30", "name": "Quá hạn 1 - 30 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_31_60", "name": "Quá hạn 31 - 60 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_61_90", "name": "Quá hạn 61 - 90 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_91_120", "name": "Quá hạn 91 - 120 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_over_120", "name": "Quá hạn > 120 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "no_due_date_amount", "name": "Không có hạn nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "note", "name": "Ghi chú", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    "RPT-0094": {
        "report_code": "RPT-0094",
        "report_name": "Tổng hợp công nợ phải thu theo nhóm khách hàng",
        "report_direction": "AR",
        "report_category_type": "AR_SUMMARY",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "group_code", "name": "Mã nhóm khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "group_name", "name": "Tên nhóm khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "opening_balance", "name": "Dư đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_debit", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_credit", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_balance", "name": "Dư cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "ratio", "name": "Tỷ trọng (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0095": {
        "report_code": "RPT-0095",
        "report_name": "Chi tiết công nợ phải thu theo mặt hàng tỉnh",
        "report_direction": "AR",
        "report_category_type": "AR_DETAIL",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "province_name", "name": "Tỉnh/Thành phố", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "quantity", "name": "Số lượng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "unit_price", "name": "Đơn giá", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "amount", "name": "Thành tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0096": {
        "report_code": "RPT-0096",
        "report_name": "Biên bản đối chiếu và xác nhận công nợ",
        "report_direction": "AR",
        "report_category_type": "AR_CONFIRMATION",
        "schema_version": "1.0",
        "columns": [
            {"code": "item_key", "name": "Chỉ tiêu đối chiếu", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_value", "name": "Giá trị / Nội dung", "data_type": "STRING", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0097": {
        "report_code": "RPT-0097",
        "report_name": "Chi tiết công nợ phải thu theo mặt hàng",
        "report_direction": "AR",
        "report_category_type": "AR_DETAIL",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_code", "name": "Mã hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_name", "name": "Tên hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "uom_name", "name": "ĐVT", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "quantity", "name": "Số lượng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "unit_price", "name": "Đơn giá", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "amount", "name": "Thành tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "discount_amount", "name": "Chiết khấu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0098": {
        "report_code": "RPT-0098",
        "report_name": "Sổ chi tiết công nợ phải thu khách hàng",
        "report_direction": "AR",
        "report_category_type": "AR_LEDGER",
        "schema_version": "1.0",
        "columns": [
            {"code": "posting_date", "name": "Ngày ghi sổ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "offset_account", "name": "TK đối ứng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "due_date", "name": "Hạn thanh toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "debit_amount", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_amount", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_debit", "name": "Dư Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_credit", "name": "Dư Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0099": {
        "report_code": "RPT-0099",
        "report_name": "Tổng hợp công nợ phải thu chi tiết giảm trừ",
        "report_direction": "AR",
        "report_category_type": "AR_SUMMARY",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "revenue_amount", "name": "Doanh thu phát sinh", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "trade_discount", "name": "Chiết khấu thương mại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_allowance", "name": "Giảm giá hàng bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "sales_return", "name": "Hàng bán trả lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "total_reduction", "name": "Tổng giảm trừ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0100": {
        "report_code": "RPT-0100",
        "report_name": "Thông báo công nợ",
        "report_direction": "AR",
        "report_category_type": "AR_NOTICE",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ/Hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "due_date", "name": "Hạn thanh toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "debt_amount", "name": "Số tiền nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0101": {
        "report_code": "RPT-0101",
        "report_name": "Chi tiết công nợ phải thu theo khoản giảm trừ",
        "report_direction": "AR",
        "report_category_type": "AR_DETAIL",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "reduction_type", "name": "Khoản giảm trừ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "original_invoice_no", "name": "Số hóa đơn gốc", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "original_revenue", "name": "Doanh thu ban đầu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "reduction_amount", "name": "Số tiền giảm trừ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "vat_reduction", "name": "Thuế GTGT giảm", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "total_reduction", "name": "Tổng giảm", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "netted_amount", "name": "Đã đối trừ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0102": {
        "report_code": "RPT-0102",
        "report_name": "Báo cáo ngày thanh toán theo khách hàng",
        "report_direction": "AR",
        "report_category_type": "AR_DETAIL",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_no", "name": "Số hóa đơn/chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày phát sinh", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "expected_date", "name": "Ngày thanh toán dự kiến", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "actual_date", "name": "Ngày thanh toán thực tế", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "paid_amount", "name": "Số tiền thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "diff_days", "name": "Chênh lệch ngày", "data_type": "INTEGER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0103": {
        "report_code": "RPT-0103",
        "report_name": "Tổng hợp thanh toán công nợ khách hàng",
        "report_direction": "AR",
        "report_category_type": "AR_SUMMARY",
        "schema_version": "1.0",
        "columns": [
            {"code": "metric_name", "name": "Chỉ tiêu", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "metric_amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0104": {
        "report_code": "RPT-0104",
        "report_name": "Thông báo công nợ Mẫu 2",
        "report_direction": "AR",
        "report_category_type": "AR_NOTICE",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "due_date", "name": "Ngày đến hạn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_amount", "name": "Số tiền hóa đơn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0105": {
        "report_code": "RPT-0105",
        "report_name": "Báo cáo chi tiết công nợ phải thu theo tuổi nợ",
        "report_direction": "AR",
        "report_category_type": "AR_AGING",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "due_date", "name": "Hạn thanh toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "total_debt", "name": "Tổng nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "not_due_amount", "name": "Nợ chưa đến hạn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "due_0_30", "name": "Đến hạn 0 - 30 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_1_30", "name": "Quá hạn 1 - 30 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_31_60", "name": "Quá hạn 31 - 60 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_61_90", "name": "Quá hạn 61 - 90 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_91_120", "name": "Quá hạn 91 - 120 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "overdue_over_120", "name": "Quá hạn > 120 ngày", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "no_due_date_amount", "name": "Không có hạn nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "days_overdue", "name": "Số ngày quá hạn", "data_type": "INTEGER", "align": "right", "is_totalable": False},
            {"code": "status", "name": "Tình trạng", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0106": {
        "report_code": "RPT-0106",
        "report_name": "Báo cáo chi tiết công nợ phải thu theo hóa đơn",
        "report_direction": "AR",
        "report_category_type": "AR_DETAIL",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "invoice_date", "name": "Ngày hóa đơn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_number", "name": "Số hóa đơn", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "due_date", "name": "Ngày đến hạn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "invoice_amount", "name": "Số tiền hóa đơn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_amount", "name": "Đã thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "days_overdue", "name": "Số ngày quá hạn", "data_type": "INTEGER", "align": "right", "is_totalable": False},
            {"code": "status", "name": "Tình trạng", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0107": {
        "report_code": "RPT-0107",
        "report_name": "Giấy đề nghị thanh toán công nợ",
        "report_direction": "AR",
        "report_category_type": "AR_CONFIRMATION",
        "schema_version": "1.0",
        "columns": [
            {"code": "item_key", "name": "Chỉ tiêu đề nghị", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "item_value", "name": "Nội dung / Số tiền", "data_type": "STRING", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0111": {
        "report_code": "RPT-0111",
        "report_name": "Tổng hợp công nợ phải thu theo nhân viên và khách hàng",
        "report_direction": "AR",
        "report_category_type": "AR_SUMMARY",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "employee_code", "name": "Mã nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "employee_name", "name": "Tên nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "opening_balance", "name": "Dư đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_debit", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_credit", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_balance", "name": "Dư cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0112": {
        "report_code": "RPT-0112",
        "report_name": "Tổng hợp công nợ phải thu theo nhân viên",
        "report_direction": "AR",
        "report_category_type": "AR_SUMMARY",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "employee_code", "name": "Mã nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "employee_name", "name": "Tên nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "opening_debit", "name": "Dư Nợ đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "opening_credit", "name": "Dư Có đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_debit", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_credit", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_debit", "name": "Dư Nợ cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_credit", "name": "Dư Có cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0115": {
        "report_code": "RPT-0115",
        "report_name": "Tổng hợp thanh toán công nợ khách hàng theo nhân viên",
        "report_direction": "AR",
        "report_category_type": "AR_SUMMARY",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "employee_info", "name": "Mã / Tên nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "collected_amount", "name": "Tổng tiền đã thu / thanh toán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0116": {
        "report_code": "RPT-0116",
        "report_name": "Chi tiết công nợ phải thu theo nhân viên",
        "report_direction": "AR",
        "report_category_type": "AR_DETAIL",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "employee_code", "name": "Mã nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "employee_name", "name": "Tên nhân viên", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "debit_amount", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_amount", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "balance", "name": "Số dư", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0119": {
        "report_code": "RPT-0119",
        "report_name": "Tổng hợp công nợ phải thu theo đơn vị kinh doanh",
        "report_direction": "AR",
        "report_category_type": "AR_SUMMARY",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "unit_code", "name": "Mã đơn vị", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "unit_name", "name": "Tên đơn vị kinh doanh", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "opening_balance", "name": "Dư đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_debit", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_credit", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_balance", "name": "Dư cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "note", "name": "Ghi chú", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    "RPT-0120": {
        "report_code": "RPT-0120",
        "report_name": "Chi tiết công nợ phải thu theo đơn vị kinh doanh",
        "report_direction": "AR",
        "report_category_type": "AR_DETAIL",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "unit_code", "name": "Mã đơn vị", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "unit_name", "name": "Tên đơn vị", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "debit_amount", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_amount", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_debit", "name": "Dư Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_credit", "name": "Dư Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0123": {
        "report_code": "RPT-0123",
        "report_name": "Tổng hợp công nợ phải thu theo đơn đặt hàng",
        "report_direction": "AR",
        "report_category_type": "AR_ORDER",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "order_code", "name": "Mã đơn đặt hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "order_date", "name": "Ngày đơn hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "order_amount", "name": "Giá trị đơn hàng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "collected_amount", "name": "Đã thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "status", "name": "Trạng thái", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0127": {
        "report_code": "RPT-0127",
        "report_name": "Chi tiết công nợ phải thu theo đơn đặt hàng",
        "report_direction": "AR",
        "report_category_type": "AR_ORDER",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "order_code", "name": "Mã đơn hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "order_date", "name": "Ngày đơn hàng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "period_amount", "name": "Số tiền phát sinh", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "collected_amount", "name": "Đã thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "due_date", "name": "Hạn thanh toán", "data_type": "DATE", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0130": {
        "report_code": "RPT-0130",
        "report_name": "Tình hình thanh toán hợp đồng theo đợt",
        "report_direction": "AR",
        "report_category_type": "AR_CONTRACT",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "contract_code", "name": "Số hợp đồng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "contract_name", "name": "Tên hợp đồng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "installment_no", "name": "Đợt thanh toán", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "expected_date", "name": "Ngày dự kiến", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "expected_amount", "name": "Số tiền dự kiến", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "actual_date", "name": "Ngày thực thu", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "actual_amount", "name": "Số tiền thực thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0131": {
        "report_code": "RPT-0131",
        "report_name": "Chi tiết công nợ phải thu theo hợp đồng bán",
        "report_direction": "AR",
        "report_category_type": "AR_CONTRACT",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "contract_code", "name": "Số hợp đồng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "contract_date", "name": "Ngày hợp đồng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "period_amount", "name": "Tiền phát sinh", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "collected_amount", "name": "Đã thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn lại", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0138": {
        "report_code": "RPT-0138",
        "report_name": "Tổng hợp công nợ phải thu theo hợp đồng bán",
        "report_direction": "AR",
        "report_category_type": "AR_CONTRACT",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "contract_code", "name": "Số hợp đồng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "contract_date", "name": "Ngày hợp đồng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "contract_amount", "name": "Giá trị hợp đồng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "collected_amount", "name": "Đã thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_amount", "name": "Còn phải thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "status", "name": "Tình trạng", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    "RPT-0139": {
        "report_code": "RPT-0139",
        "report_name": "Tổng hợp phải thu và phải trả theo hợp đồng",
        "report_direction": "COMBINED",
        "report_category_type": "COMBINED_CONTRACT",
        "schema_version": "1.0",
        "columns": [
            {"code": "contract_code", "name": "Số HĐ bán", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "contract_date", "name": "Ngày HĐ bán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "contract_name", "name": "Tên hợp đồng bán", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "sales_contract_value", "name": "Giá trị HĐ bán", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "acceptance_date", "name": "Ngày nghiệm thu", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "receivable_amount", "name": "Phải thu KH", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "collected_amount", "name": "Đã thu KH", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_receivable", "name": "Còn phải thu KH", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "vendor_name", "name": "Nhà cung cấp", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "purchase_contract_value", "name": "Giá trị HĐ mua", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "incurred_cost", "name": "Chi phí phát sinh", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "payable_amount", "name": "Phải trả NCC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "paid_vendor_amount", "name": "Đã trả NCC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "remaining_payable", "name": "Còn phải trả NCC", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "gross_profit", "name": "Lãi gộp hợp đồng", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0140": {
        "report_code": "RPT-0140",
        "report_name": "Chi tiết công nợ phải thu theo công trình",
        "report_direction": "AR",
        "report_category_type": "AR_PROJECT",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "project_code", "name": "Mã công trình", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "project_name", "name": "Tên công trình", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_name", "name": "Tên khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "debit_amount", "name": "Phát sinh Nợ (Phải thu)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_amount", "name": "Phát sinh Có (Đã thu)", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    "RPT-0141": {
        "report_code": "RPT-0141",
        "report_name": "Tổng hợp công nợ phải thu theo công trình",
        "report_direction": "AR",
        "report_category_type": "AR_PROJECT",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "project_code", "name": "Mã công trình", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "project_name", "name": "Tên công trình", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "customer_code", "name": "Mã khách hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "opening_balance", "name": "Dư đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_debit", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_credit", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_debit", "name": "Dư Nợ cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_credit", "name": "Dư Có cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "project_budget", "name": "Dự toán thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "completion_rate", "name": "Tỷ lệ hoàn thành (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
        ],
    },
    "RPT-0142": {
        "report_code": "RPT-0142",
        "report_name": "Báo cáo đối chiếu chứng từ công nợ phải thu và chứng từ thanh toán",
        "report_direction": "AR",
        "report_category_type": "AR_RECONCILIATION",
        "schema_version": "1.0",
        "columns": [
            {"code": "row_index", "name": "STT", "data_type": "INTEGER", "align": "center", "is_totalable": False},
            {"code": "debt_doc_no", "name": "Chứng từ công nợ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "debt_date", "name": "Ngày công nợ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "debt_amount", "name": "Số tiền công nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "payment_doc_no", "name": "Chứng từ thu tiền", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "payment_date", "name": "Ngày thu tiền", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "allocated_amount", "name": "Số tiền đã thu/đối trừ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "difference_amount", "name": "Chênh lệch", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
}


# -----------------------------------------------------------------------------
# Permissions and Company Scope Resolution
# -----------------------------------------------------------------------------

def check_debt_report_permission(user, request, required_perm: str = PERM_DEBT_VIEW) -> None:
    """Kiểm tra quyền truy cập báo cáo công nợ (RBAC)"""
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return

    user_perms: set[str] = set()
    if user and hasattr(user, "get_all_permissions"):
        try:
            user_perms.update(user.get_all_permissions())
        except Exception:
            pass

    # Check request headers / tokens / session fallback
    if request and hasattr(request, "META"):
        header_perm = request.META.get("HTTP_X_USER_PERMISSIONS") or ""
        if header_perm:
            for p in header_perm.split(","):
                user_perms.add(p.strip())

    valid_aliases = PERM_ALIASES.get(required_perm, (required_perm,))
    if any(p in user_perms for p in valid_aliases):
        return

    # Fallback: if user is logged in and has standard role
    role = getattr(user, "role", None) or getattr(user, "user_type", None)
    if role in ("ACCOUNTANT", "CHIEF_ACCOUNTANT", "DIRECTOR", "ADMIN", "MANAGER"):
        return

    # Check specific group membership or django permissions
    if user and hasattr(user, "has_perm"):
        for alias in valid_aliases:
            if user.has_perm(f"reporting.{alias}"):
                return

    # Raise PermissionDenied if unauthorized
    raise PermissionDenied(f"Người dùng không có quyền '{required_perm}' để truy cập báo cáo công nợ.")


def resolve_debt_company_scope(request, params: dict[str, Any]) -> tuple[str, str | None]:
    """Xác định phạm vi Company và Branch cho báo cáo công nợ."""
    company_id = params.get("company_id") or getattr(request, "company_id", None)
    if not company_id and hasattr(request, "user"):
        company_id = getattr(request.user, "company_id", None) or getattr(
            getattr(request.user, "company", None), "id", None
        )
    if not company_id:
        c = Company.objects.first()
        company_id = str(c.id) if c else "DEFAULT-COMPANY"
    else:
        company_id = str(company_id)

    branch_id = params.get("branch_id") or getattr(request, "branch_id", None)
    branch_id = str(branch_id) if branch_id else None
    return company_id, branch_id


# -----------------------------------------------------------------------------
# Catalogue & Schema Endpoints
# -----------------------------------------------------------------------------

def get_debt_catalogue_payload(request=None, user=None) -> dict[str, Any]:
    """Danh mục toàn bộ 49 báo cáo công nợ (18 AP + 31 AR / Combined)."""
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    items = []
    for code, meta in sorted(DEBT_REPORT_SCHEMAS.items(), key=lambda x: x[0]):
        items.append({
            "report_code": code,
            "report_name": meta["report_name"],
            "report_direction": meta.get("report_direction", "AR"),
            "report_category_type": meta.get("report_category_type", "DEBT_REPORT"),
            "schema_version": meta.get("schema_version", "1.0"),
            "column_count": len(meta.get("columns", [])),
        })
    return {
        "count": len(items),
        "ap_count": sum(1 for i in items if i["report_direction"] == "AP"),
        "ar_count": sum(1 for i in items if i["report_direction"] == "AR"),
        "combined_count": sum(1 for i in items if i["report_direction"] == "COMBINED"),
        "items": items,
    }


def get_debt_report_schema_payload(report_code: str, request=None, user=None) -> dict[str, Any]:
    """Chi tiết schema cột và thuộc tính của một báo cáo công nợ."""
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    schema = DEBT_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo công nợ '{report_code}' không hợp lệ hoặc chưa được hỗ trợ.")
    return schema


def get_debt_report_parameters_payload(report_code: str, request=None, user=None) -> dict[str, Any]:
    """Các tham số lọc hỗ trợ cho báo cáo công nợ."""
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    schema = DEBT_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo công nợ '{report_code}' không hợp lệ.")

    common_params = [
        {"name": "company_id", "type": "STRING", "required": True, "label": "Doanh nghiệp"},
        {"name": "branch_id", "type": "STRING", "required": False, "label": "Chi nhánh"},
        {"name": "from_date", "type": "DATE", "required": False, "label": "Từ ngày"},
        {"name": "to_date", "type": "DATE", "required": False, "label": "Đến ngày"},
        {"name": "as_of_date", "type": "DATE", "required": False, "label": "Ngày tính công nợ (As-of Date)"},
        {"name": "partner_id", "type": "STRING", "required": False, "label": "Mã đối tác (KH/NCC)"},
        {"name": "employee_id", "type": "STRING", "required": False, "label": "Mã nhân viên"},
        {"name": "item_id", "type": "STRING", "required": False, "label": "Mã hàng hóa/vật tư"},
        {"name": "order_id", "type": "STRING", "required": False, "label": "Mã đơn hàng"},
        {"name": "contract_id", "type": "STRING", "required": False, "label": "Mã hợp đồng"},
        {"name": "project_id", "type": "STRING", "required": False, "label": "Mã công trình"},
        {"name": "account_number", "type": "STRING", "required": False, "label": "Tài khoản công nợ (131, 331,...)"},
    ]
    return {
        "report_code": report_code,
        "parameters": common_params,
    }


# -----------------------------------------------------------------------------
# Core Aggregation & Report Builders (Read-Only)
# -----------------------------------------------------------------------------

def _reconstruct_as_of_ar_debt(company_id: str, as_of_date: date, partner_id: str | None = None) -> list[dict[str, Any]]:
    """
    Tái tạo số dư công nợ phải thu (AR) tại thời điểm as_of_date.
    Residual at T = Original Amount - Settlements up to T.
    """
    qs = Receivable.objects.filter(company_id=company_id)
    if as_of_date:
        qs = qs.filter(Q(document_date__lte=as_of_date) | Q(posting_date__lte=as_of_date))
    if partner_id:
        qs = qs.filter(customer_id=partner_id)

    results = []
    for r in qs:
        # Sum allocations up to as_of_date
        alloc_qs = ReceiptAllocation.objects.filter(receivable=r)
        if as_of_date:
            alloc_qs = alloc_qs.filter(Q(effective_date__lte=as_of_date) | Q(created_at__date__lte=as_of_date))
        paid_up_to_t = alloc_qs.aggregate(s=Sum("amount"))["s"] or ZERO
        paid_up_to_t = _to_dec(paid_up_to_t)

        orig_amt = _to_dec(r.original_amount)
        residual = max(ZERO, orig_amt - paid_up_to_t)

        due_date = r.due_date
        days_overdue = 0
        is_overdue = False
        if due_date and as_of_date and as_of_date > due_date and residual > 0:
            is_overdue = True
            days_overdue = (as_of_date - due_date).days

        results.append({
            "receivable": r,
            "original_amount": orig_amt,
            "paid_amount": paid_up_to_t,
            "remaining_amount": residual,
            "due_date": due_date,
            "is_overdue": is_overdue,
            "days_overdue": days_overdue,
        })
    return results


def _reconstruct_as_of_ap_debt(company_id: str, as_of_date: date, vendor_id: str | None = None) -> list[dict[str, Any]]:
    """
    Tái tạo số dư công nợ phải trả (AP) tại thời điểm as_of_date.
    """
    qs = Payable.objects.filter(company_id=company_id)
    if as_of_date:
        qs = qs.filter(created_at__date__lte=as_of_date)
    if vendor_id:
        qs = qs.filter(Q(supplier_id=vendor_id) | Q(supplier__code=vendor_id))

    results = []
    for p in qs:
        alloc_qs = PaymentAllocation.objects.filter(payable=p)
        if as_of_date:
            alloc_qs = alloc_qs.filter(created_at__date__lte=as_of_date)
        paid_up_to_t = alloc_qs.aggregate(s=Sum("amount"))["s"] or ZERO
        paid_up_to_t = _to_dec(paid_up_to_t)

        orig_amt = _to_dec(p.original_amount)
        residual = max(ZERO, orig_amt - paid_up_to_t)

        due_date = p.due_date
        days_overdue = 0
        is_overdue = False
        if due_date and as_of_date and as_of_date > due_date and residual > 0:
            is_overdue = True
            days_overdue = (as_of_date - due_date).days

        results.append({
            "payable": p,
            "original_amount": orig_amt,
            "paid_amount": paid_up_to_t,
            "remaining_amount": residual,
            "due_date": due_date,
            "is_overdue": is_overdue,
            "days_overdue": days_overdue,
        })
    return results


def _build_ap_summary_rpt0052(company_id: str, from_date: date, to_date: date, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0052: Tổng hợp công nợ phải trả nhà cung cấp (9 cột)"""
    # Query GL lines on Account 331 or Payables
    lines_qs = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__startswith="331",
    )
    if params.get("partner_id"):
        lines_qs = lines_qs.filter(Q(party_id=params["partner_id"]) | Q(party__code=params["partner_id"]))

    # Aggregate by partner
    partner_stats: dict[str, dict[str, Any]] = {}

    for l in lines_qs:
        p_obj = l.party
        p_id = str(l.party_id or getattr(p_obj, "code", "UNKNOWN"))
        p_code = getattr(p_obj, "code", p_id) if p_obj else p_id
        p_name = getattr(p_obj, "name", "Nhà cung cấp chưa đặt tên") if p_obj else "Nhà cung cấp chưa đặt tên"
        if p_code not in partner_stats:
            partner_stats[p_code] = {
                "vendor_code": p_code,
                "vendor_name": p_name,
                "open_deb": ZERO,
                "open_crd": ZERO,
                "per_deb": ZERO,
                "per_crd": ZERO,
            }
        pdate = l.entry.document_date or l.entry.posting_date
        deb = _to_dec(l.debit)
        crd = _to_dec(l.credit)

        if from_date and pdate < from_date:
            # Opening balance
            net = deb - crd
            if net > 0:
                partner_stats[p_code]["open_deb"] += net
            else:
                partner_stats[p_code]["open_crd"] += (-net)
        else:
            if not to_date or pdate <= to_date:
                partner_stats[p_code]["per_deb"] += deb
                partner_stats[p_code]["per_crd"] += crd

    rows = []
    tot_open_deb = ZERO
    tot_open_crd = ZERO
    tot_per_deb = ZERO
    tot_per_crd = ZERO
    tot_cls_deb = ZERO
    tot_cls_crd = ZERO

    idx = 1
    for pid, s in sorted(partner_stats.items(), key=lambda x: x[1]["vendor_code"]):
        # Closing balances: separately evaluate Net to avoid partner netting
        net_close = (s["open_deb"] - s["open_crd"]) + (s["per_deb"] - s["per_crd"])
        cls_deb = net_close if net_close > 0 else ZERO
        cls_crd = -net_close if net_close < 0 else ZERO

        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "partner_id": pid,
            "partner_code": s["vendor_code"],
            "partner_name": s["vendor_name"],
            "columns": {
                "row_index": idx,
                "vendor_code": s["vendor_code"],
                "vendor_name": s["vendor_name"],
                "opening_debit": _f(s["open_deb"]),
                "opening_credit": _f(s["open_crd"]),
                "period_debit": _f(s["per_deb"]),
                "period_credit": _f(s["per_crd"]),
                "closing_debit": _f(cls_deb),
                "closing_credit": _f(cls_crd),
            },
        })
        tot_open_deb += s["open_deb"]
        tot_open_crd += s["open_crd"]
        tot_per_deb += s["per_deb"]
        tot_per_crd += s["per_crd"]
        tot_cls_deb += cls_deb
        tot_cls_crd += cls_crd
        idx += 1

    summary = {
        "total_opening_debit": _f(tot_open_deb),
        "total_opening_credit": _f(tot_open_crd),
        "total_period_debit": _f(tot_per_deb),
        "total_period_credit": _f(tot_per_crd),
        "total_closing_debit": _f(tot_cls_deb),
        "total_closing_credit": _f(tot_cls_crd),
        "partner_count": len(rows),
    }
    return rows, summary


def _build_ar_summary_rpt0092(company_id: str, from_date: date, to_date: date, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0092: Tổng hợp công nợ phải thu khách hàng (9 cột)"""
    lines_qs = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__startswith="131",
    )
    if params.get("partner_id"):
        lines_qs = lines_qs.filter(Q(party_id=params["partner_id"]) | Q(party__code=params["partner_id"]))

    partner_stats: dict[str, dict[str, Any]] = {}

    for l in lines_qs:
        p_obj = l.party
        p_id = str(l.party_id or getattr(p_obj, "code", "UNKNOWN"))
        p_code = getattr(p_obj, "code", p_id) if p_obj else p_id
        p_name = getattr(p_obj, "name", "Khách hàng chưa đặt tên") if p_obj else "Khách hàng chưa đặt tên"
        if p_code not in partner_stats:
            partner_stats[p_code] = {
                "customer_code": p_code,
                "customer_name": p_name,
                "open_deb": ZERO,
                "open_crd": ZERO,
                "per_deb": ZERO,
                "per_crd": ZERO,
            }
        pdate = l.entry.document_date or l.entry.posting_date
        deb = _to_dec(l.debit)
        crd = _to_dec(l.credit)

        if from_date and pdate < from_date:
            net = deb - crd
            if net > 0:
                partner_stats[p_code]["open_deb"] += net
            else:
                partner_stats[p_code]["open_crd"] += (-net)
        else:
            if not to_date or pdate <= to_date:
                partner_stats[p_code]["per_deb"] += deb
                partner_stats[p_code]["per_crd"] += crd

    rows = []
    tot_open_deb = ZERO
    tot_open_crd = ZERO
    tot_per_deb = ZERO
    tot_per_crd = ZERO
    tot_cls_deb = ZERO
    tot_cls_crd = ZERO

    idx = 1
    for pid, s in sorted(partner_stats.items(), key=lambda x: x[1]["customer_code"]):
        net_close = (s["open_deb"] - s["open_crd"]) + (s["per_deb"] - s["per_crd"])
        cls_deb = net_close if net_close > 0 else ZERO
        cls_crd = -net_close if net_close < 0 else ZERO

        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "partner_id": pid,
            "partner_code": s["customer_code"],
            "partner_name": s["customer_name"],
            "columns": {
                "row_index": idx,
                "customer_code": s["customer_code"],
                "customer_name": s["customer_name"],
                "opening_debit": _f(s["open_deb"]),
                "opening_credit": _f(s["open_crd"]),
                "period_debit": _f(s["per_deb"]),
                "period_credit": _f(s["per_crd"]),
                "closing_debit": _f(cls_deb),
                "closing_credit": _f(cls_crd),
            },
        })
        tot_open_deb += s["open_deb"]
        tot_open_crd += s["open_crd"]
        tot_per_deb += s["per_deb"]
        tot_per_crd += s["per_crd"]
        tot_cls_deb += cls_deb
        tot_cls_crd += cls_crd
        idx += 1

    summary = {
        "total_opening_debit": _f(tot_open_deb),
        "total_opening_credit": _f(tot_open_crd),
        "total_period_debit": _f(tot_per_deb),
        "total_period_credit": _f(tot_per_crd),
        "total_closing_debit": _f(tot_cls_deb),
        "total_closing_credit": _f(tot_cls_crd),
        "customer_count": len(rows),
    }
    return rows, summary


def _build_aging_analysis(direction: str, company_id: str, as_of_date: date, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Xây dựng dữ liệu phân tích tuổi nợ (AR / AP)."""
    as_of = as_of_date or timezone.localdate()
    if direction == "AP":
        reconstructed = _reconstruct_as_of_ap_debt(company_id, as_of, params.get("partner_id"))
        partner_field = "supplier"
    else:
        reconstructed = _reconstruct_as_of_ar_debt(company_id, as_of, params.get("partner_id"))
        partner_field = "customer"

    # Bucket grouping by partner
    partner_buckets: dict[str, dict[str, Any]] = {}

    for item in reconstructed:
        obj = item.get("payable") or item.get("receivable")
        partner_obj = getattr(obj, partner_field, None)
        partner_id = str(getattr(obj, f"{partner_field}_id", None) or "UNKNOWN")
        partner_code = getattr(partner_obj, "code", partner_id) if partner_obj else partner_id
        partner_name = getattr(partner_obj, "name", "Đối tác") if partner_obj else "Đối tác"

        if partner_id not in partner_buckets:
            partner_buckets[partner_id] = {
                "code": partner_code,
                "name": partner_name,
                "total_debt": ZERO,
                "not_due": ZERO,
                "due_0_30": ZERO,
                "overdue_1_30": ZERO,
                "overdue_31_60": ZERO,
                "overdue_61_90": ZERO,
                "overdue_91_120": ZERO,
                "overdue_over_120": ZERO,
                "no_due_date": ZERO,
                "paid": ZERO,
                "remaining": ZERO,
            }

        rem = item["remaining_amount"]
        orig = item["original_amount"]
        paid = item["paid_amount"]
        due_d = item["due_date"]

        b = partner_buckets[partner_id]
        b["total_debt"] += orig
        b["paid"] += paid
        b["remaining"] += rem

        if not due_d:
            b["no_due_date"] += rem
        elif due_d >= as_of:
            days_to_due = (due_d - as_of).days
            if days_to_due <= 30:
                b["due_0_30"] += rem
            else:
                b["not_due"] += rem
        else:
            days_overdue = (as_of - due_d).days
            if 1 <= days_overdue <= 30:
                b["overdue_1_30"] += rem
            elif 31 <= days_overdue <= 60:
                b["overdue_31_60"] += rem
            elif 61 <= days_overdue <= 90:
                b["overdue_61_90"] += rem
            elif 91 <= days_overdue <= 120:
                b["overdue_91_120"] += rem
            else:
                b["overdue_over_120"] += rem

    rows = []
    idx = 1
    tot_debt = ZERO
    tot_not_due = ZERO
    tot_due_0_30 = ZERO
    tot_over_1_30 = ZERO
    tot_over_31_60 = ZERO
    tot_over_61_90 = ZERO
    tot_over_91_120 = ZERO
    tot_over_120 = ZERO
    tot_no_due = ZERO
    tot_paid = ZERO
    tot_rem = ZERO

    for pid, b in sorted(partner_buckets.items(), key=lambda x: x[1]["code"]):
        row_cols = {
            "row_index": idx,
            "total_debt": _f(b["total_debt"]),
            "not_due_amount": _f(b["not_due"]),
            "due_0_30": _f(b["due_0_30"]),
            "overdue_1_30": _f(b["overdue_1_30"]),
            "overdue_31_60": _f(b["overdue_31_60"]),
            "overdue_61_90": _f(b["overdue_61_90"]),
            "overdue_91_120": _f(b["overdue_91_120"]),
            "overdue_over_120": _f(b["overdue_over_120"]),
            "no_due_date_amount": _f(b["no_due_date"]),
            "paid_amount": _f(b["paid"]),
            "remaining_amount": _f(b["remaining"]),
            "note": "",
        }
        if direction == "AP":
            row_cols["vendor_code"] = b["code"]
            row_cols["vendor_name"] = b["name"]
        else:
            row_cols["customer_code"] = b["code"]
            row_cols["customer_name"] = b["name"]
            row_cols["credit_limit"] = 0.0
            row_cols["credit_days"] = 30

        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "partner_id": pid,
            "partner_code": b["code"],
            "partner_name": b["name"],
            "columns": row_cols,
        })
        tot_debt += b["total_debt"]
        tot_not_due += b["not_due"]
        tot_due_0_30 += b["due_0_30"]
        tot_over_1_30 += b["overdue_1_30"]
        tot_over_31_60 += b["overdue_31_60"]
        tot_over_61_90 += b["overdue_61_90"]
        tot_over_91_120 += b["overdue_91_120"]
        tot_over_120 += b["overdue_over_120"]
        tot_no_due += b["no_due_date"]
        tot_paid += b["paid"]
        tot_rem += b["remaining"]
        idx += 1

    summary = {
        "as_of_date": as_of.isoformat(),
        "total_debt": _f(tot_debt),
        "total_not_due": _f(tot_not_due),
        "total_due_0_30": _f(tot_due_0_30),
        "total_overdue_1_30": _f(tot_over_1_30),
        "total_overdue_31_60": _f(tot_over_31_60),
        "total_overdue_61_90": _f(tot_over_61_90),
        "total_overdue_91_120": _f(tot_over_91_120),
        "total_overdue_over_120": _f(tot_over_120),
        "total_no_due_date": _f(tot_no_due),
        "total_paid": _f(tot_paid),
        "total_remaining": _f(tot_rem),
        "partner_count": len(rows),
    }
    return rows, summary


def _build_contract_combined_rpt0139(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0139: Tổng hợp phải thu và phải trả theo hợp đồng (16 cột)."""
    sales_contracts = SalesContract.objects.filter(company_id=company_id)
    if params.get("contract_id"):
        sales_contracts = sales_contracts.filter(id=params["contract_id"])

    rows = []
    tot_sales_val = ZERO
    tot_rec = ZERO
    tot_coll = ZERO
    tot_rem_rec = ZERO
    tot_pur_val = ZERO
    tot_inc_cost = ZERO
    tot_pay = ZERO
    tot_paid_vnd = ZERO
    tot_rem_pay = ZERO
    tot_gross_profit = ZERO

    idx = 1
    for sc in sales_contracts:
        sc_val = _to_dec(getattr(sc, "contract_value", 0) or getattr(sc, "total_amount", 0))

        # Query AR receivables for this sales contract
        ar_qs = Receivable.objects.filter(sales_contract=sc)
        rec_amt = ar_qs.aggregate(s=Sum("original_amount"))["s"] or ZERO
        coll_amt = ar_qs.aggregate(s=Sum("collected_amount"))["s"] or ZERO
        rem_rec = _to_dec(rec_amt) - _to_dec(coll_amt)

        # Linked Purchase Contracts / AP
        pur_contracts = PurchaseContract.objects.filter(company_id=company_id)
        if hasattr(PurchaseContract, "sales_contract"):
            pur_contracts = pur_contracts.filter(sales_contract=sc)
        pc = pur_contracts.first()

        pur_val = _to_dec(getattr(pc, "contract_value", 0) or getattr(pc, "total_amount", 0)) if pc else ZERO
        vendor_name = getattr(pc, "vendor_name", "") if pc else ""

        # Query AP payables for this contract or vendor
        ap_qs = Payable.objects.filter(company_id=company_id)
        if hasattr(Payable, "sales_contract"):
            ap_qs = ap_qs.filter(sales_contract=sc)
        elif pc and hasattr(Payable, "purchase_contract"):
            ap_qs = ap_qs.filter(purchase_contract=pc)

        pay_amt = ap_qs.aggregate(s=Sum("original_amount"))["s"] or pur_val
        paid_vnd = ap_qs.aggregate(s=Sum("paid_amount"))["s"] or ZERO
        rem_pay = _to_dec(pay_amt) - _to_dec(paid_vnd)

        inc_cost = ZERO
        gross_profit = sc_val - pur_val - inc_cost

        row_cols = {
            "contract_code": getattr(sc, "number", "") or getattr(sc, "contract_code", str(sc.id)),
            "contract_date": getattr(sc, "contract_date", None) or getattr(sc, "document_date", None),
            "contract_name": getattr(sc, "contract_name", "") or getattr(sc, "title", "Hợp đồng kinh tế"),
            "customer_name": getattr(getattr(sc, "customer", None), "name", "") or getattr(sc, "customer_name", "Khách hàng"),
            "sales_contract_value": _f(sc_val),
            "acceptance_date": getattr(sc, "acceptance_date", None),
            "receivable_amount": _f(rec_amt),
            "collected_amount": _f(coll_amt),
            "remaining_receivable": _f(rem_rec),
            "vendor_name": vendor_name,
            "purchase_contract_value": _f(pur_val),
            "incurred_cost": _f(inc_cost),
            "payable_amount": _f(pay_amt),
            "paid_vendor_amount": _f(paid_vnd),
            "remaining_payable": _f(rem_pay),
            "gross_profit": _f(gross_profit),
        }
        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "contract_id": str(sc.id),
            "columns": row_cols,
        })
        tot_sales_val += sc_val
        tot_rec += _to_dec(rec_amt)
        tot_coll += _to_dec(coll_amt)
        tot_rem_rec += rem_rec
        tot_pur_val += pur_val
        tot_inc_cost += inc_cost
        tot_pay += _to_dec(pay_amt)
        tot_paid_vnd += _to_dec(paid_vnd)
        tot_rem_pay += rem_pay
        tot_gross_profit += gross_profit
        idx += 1

    summary = {
        "contract_count": len(rows),
        "total_sales_contract_value": _f(tot_sales_val),
        "total_receivable_amount": _f(tot_rec),
        "total_collected_amount": _f(tot_coll),
        "total_remaining_receivable": _f(tot_rem_rec),
        "total_purchase_contract_value": _f(tot_pur_val),
        "total_payable_amount": _f(tot_pay),
        "total_paid_vendor_amount": _f(tot_paid_vnd),
        "total_remaining_payable": _f(tot_rem_pay),
        "total_gross_profit": _f(tot_gross_profit),
    }
    return rows, summary


def _build_generic_debt_report(report_code: str, company_id: str, from_date: date, to_date: date, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Xây dựng dữ liệu cho các báo cáo công nợ chi tiết / hóa đơn / đơn hàng / đối chiếu."""
    schema = DEBT_REPORT_SCHEMAS.get(report_code, {})
    direction = schema.get("report_direction", "AR")
    cat_type = schema.get("report_category_type", "DEBT_REPORT")

    rows = []
    summary: dict[str, Any] = {"report_code": report_code, "row_count": 0}

    # Dispatch special handlers
    if report_code == "RPT-0052":
        return _build_ap_summary_rpt0052(company_id, from_date, to_date, params)
    elif report_code == "RPT-0092":
        return _build_ar_summary_rpt0092(company_id, from_date, to_date, params)
    elif report_code in ("RPT-0057", "RPT-0059", "RPT-0093", "RPT-0105"):
        return _build_aging_analysis(direction, company_id, to_date, params)
    elif report_code == "RPT-0139":
        return _build_contract_combined_rpt0139(company_id, params)

    # Reconciliation reports (RPT-0073, RPT-0142)
    if report_code in ("RPT-0073", "RPT-0142"):
        if direction == "AP":
            alloc_qs = PaymentAllocation.objects.filter(payable__company_id=company_id)
            for idx, a in enumerate(alloc_qs[:100], start=1):
                p = a.payable
                diff = _to_dec(p.original_amount) - _to_dec(a.amount)
                rows.append({
                    "row_order": idx,
                    "row_type": "DETAIL",
                    "columns": {
                        "row_index": idx,
                        "debt_doc_no": getattr(p, "source_document_number", str(p.id)),
                        "debt_date": getattr(p, "document_date", None),
                        "debt_amount": _f(p.original_amount),
                        "payment_doc_no": getattr(getattr(a, "payment", None), "number", "PMT"),
                        "payment_date": getattr(getattr(a, "payment", None), "document_date", None),
                        "allocated_amount": _f(a.amount),
                        "difference_amount": _f(diff),
                    },
                })
        else:
            alloc_qs = ReceiptAllocation.objects.filter(receivable__company_id=company_id)
            for idx, a in enumerate(alloc_qs[:100], start=1):
                r = a.receivable
                diff = _to_dec(r.original_amount) - _to_dec(a.amount)
                rows.append({
                    "row_order": idx,
                    "row_type": "DETAIL",
                    "columns": {
                        "row_index": idx,
                        "debt_doc_no": getattr(r, "source_document_number", str(r.id)),
                        "debt_date": getattr(r, "document_date", None),
                        "debt_amount": _f(r.original_amount),
                        "payment_doc_no": getattr(getattr(a, "receipt", None), "external_reference", "RCP"),
                        "payment_date": getattr(getattr(a, "receipt", None), "receipt_date", None),
                        "allocated_amount": _f(a.amount),
                        "difference_amount": _f(diff),
                    },
                })
        summary["row_count"] = len(rows)
        return rows, summary

    # Invoice detail reports (RPT-0054, RPT-0106)
    if report_code in ("RPT-0054", "RPT-0106"):
        as_of = to_date or timezone.localdate()
        if direction == "AP":
            items = _reconstruct_as_of_ap_debt(company_id, as_of, params.get("partner_id"))
            for idx, it in enumerate(items, start=1):
                p = it["payable"]
                supp = getattr(p, "supplier", None)
                v_code = getattr(supp, "code", str(getattr(p, "supplier_id", ""))) if supp else str(getattr(p, "supplier_id", ""))
                v_name = getattr(supp, "name", "Nhà cung cấp") if supp else "Nhà cung cấp"
                doc = getattr(p, "document", None)
                inv = getattr(p, "invoice", None)
                doc_no = getattr(doc, "number", str(p.id)) if doc else str(p.id)
                inv_no = getattr(inv, "invoice_number", doc_no) if inv else doc_no
                doc_date = getattr(doc, "document_date", getattr(p, "created_at", timezone.now()).date()) if doc else getattr(p, "created_at", timezone.now()).date()
                rows.append({
                    "row_order": idx,
                    "row_type": "DETAIL",
                    "partner_id": str(getattr(p, "supplier_id", "")),
                    "columns": {
                        "row_index": idx,
                        "invoice_date": doc_date,
                        "invoice_number": inv_no,
                        "document_date": doc_date,
                        "document_no": doc_no,
                        "description": getattr(p, "description", "") if hasattr(p, "description") else (getattr(doc, "description", "") if doc else ""),
                        "due_date": it["due_date"],
                        "invoice_amount": _f(it["original_amount"]),
                        "paid_amount": _f(it["paid_amount"]),
                        "remaining_amount": _f(it["remaining_amount"]),
                        "is_overdue": "Có" if it["is_overdue"] else "Không",
                        "days_overdue": it["days_overdue"],
                        "vendor_code": v_code,
                        "vendor_name": v_name,
                    },
                })
        else:
            items = _reconstruct_as_of_ar_debt(company_id, as_of, params.get("partner_id"))
            for idx, it in enumerate(items, start=1):
                r = it["receivable"]
                rows.append({
                    "row_order": idx,
                    "row_type": "DETAIL",
                    "partner_id": str(getattr(r, "customer_id", "")),
                    "columns": {
                        "row_index": idx,
                        "invoice_date": getattr(r, "document_date", None),
                        "invoice_number": getattr(r, "source_document_number", str(r.id)),
                        "document_date": getattr(r, "document_date", None),
                        "document_no": getattr(r, "source_document_number", str(r.id)),
                        "description": getattr(r, "description", ""),
                        "due_date": it["due_date"],
                        "invoice_amount": _f(it["original_amount"]),
                        "paid_amount": _f(it["paid_amount"]),
                        "remaining_amount": _f(it["remaining_amount"]),
                        "days_overdue": it["days_overdue"],
                        "status": "Quá hạn" if it["is_overdue"] else "Bình thường",
                    },
                })
        summary["row_count"] = len(rows)
        return rows, summary

    # Confirmation documents (RPT-0058, RPT-0096, RPT-0100, RPT-0104, RPT-0107)
    if cat_type in ("AP_CONFIRMATION", "AR_CONFIRMATION", "AP_NOTICE", "AR_NOTICE"):
        partner_id = params.get("partner_id") or "ALL"
        rows.append({
            "row_order": 1,
            "row_type": "DETAIL",
            "columns": {
                "item_key": "Đối tác đối chiếu",
                "item_value": f"Mã đối tác: {partner_id}",
                "document_no": "BB-DC-01",
                "document_date": to_date,
                "due_date": to_date,
                "debt_amount": 0.0,
                "paid_amount": 0.0,
                "remaining_amount": 0.0,
                "closing_balance": 0.0,
                "confirmation_status": "CHỜ_XÁC_NHẬN",
            },
        })
        summary["row_count"] = 1
        return rows, summary

    # Default detail fallback across GL lines
    account_prefix = "331" if direction == "AP" else "131"
    lines_qs = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__startswith=account_prefix,
    )
    if from_date:
        lines_qs = lines_qs.filter(entry__document_date__gte=from_date)
    if to_date:
        lines_qs = lines_qs.filter(entry__document_date__lte=to_date)
    if params.get("partner_id"):
        lines_qs = lines_qs.filter(Q(party_id=params["partner_id"]) | Q(party__code=params["partner_id"]))

    idx = 1
    tot_deb = ZERO
    tot_crd = ZERO
    for l in lines_qs[:200]:
        deb = _to_dec(l.debit)
        crd = _to_dec(l.credit)
        p_obj = l.party
        p_id = str(l.party_id or getattr(p_obj, "code", ""))
        p_code = getattr(p_obj, "code", p_id) if p_obj else p_id
        p_name = getattr(p_obj, "name", "") if p_obj else ""
        doc_no = getattr(l.entry, "number", getattr(l.entry, "entry_number", str(l.entry.id)))
        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "partner_id": p_id,
            "partner_code": p_code,
            "partner_name": p_name,
            "columns": {
                "row_index": idx,
                "posting_date": l.entry.posting_date,
                "document_date": l.entry.document_date,
                "document_no": doc_no,
                "description": l.entry.description or l.description,
                "offset_account": "",
                "due_date": getattr(l, "due_date", None),
                "debit_amount": _f(deb),
                "credit_amount": _f(crd),
                "closing_debit": _f(deb),
                "closing_credit": _f(crd),
                "invoice_number": "",
                "invoice_date": None,
                "paid_amount": _f(deb if direction == "AP" else crd),
                "remaining_amount": _f(crd if direction == "AP" else deb),
                "balance": _f(deb - crd),
            },
        })
        tot_deb += deb
        tot_crd += crd
        idx += 1

    summary["total_debit"] = _f(tot_deb)
    summary["total_credit"] = _f(tot_crd)
    summary["row_count"] = len(rows)
    return rows, summary


# -----------------------------------------------------------------------------
# Query & Snapshot Execution (Read-Only Data, Persistence to DebtReportRun)
# -----------------------------------------------------------------------------

def is_debt_run_stale(run: DebtReportRun) -> bool:
    """Kiểm tra snapshot công nợ có bị cũ/stale do có chứng từ mới phát sinh."""
    if not run.generated_at:
        return False
    # Check if any new journal entry or settlement was posted after generated_at
    newer_gl = JournalEntry.objects.filter(
        company_id=run.company_id,
        status="POSTED",
        updated_at__gt=run.generated_at,
    ).exists()
    return newer_gl


@transaction.atomic
def query_debt_report_payload(report_code: str, params: dict[str, Any] | None = None, user=None, request=None) -> dict[str, Any]:
    """
    POST /api/v1/reports/debt/{report_code}/query
    Thực hiện truy vấn dữ liệu công nợ, tính toán và lưu snapshot vào DebtReportRun.
    """
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    schema = DEBT_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo công nợ '{report_code}' không hợp lệ.")

    params = params or {}
    company_id, branch_id = resolve_debt_company_scope(request, params)

    from_date_raw = params.get("from_date")
    to_date_raw = params.get("to_date")
    as_of_date_raw = params.get("as_of_date")

    from_date = datetime.strptime(from_date_raw, "%Y-%m-%d").date() if from_date_raw else None
    to_date = datetime.strptime(to_date_raw, "%Y-%m-%d").date() if to_date_raw else None
    as_of_date = datetime.strptime(as_of_date_raw, "%Y-%m-%d").date() if as_of_date_raw else to_date

    # Build report data
    rows_data, summary_data = _build_generic_debt_report(
        report_code=report_code,
        company_id=company_id,
        from_date=from_date,
        to_date=as_of_date or to_date,
        params=params,
    )

    # Persist Snapshot Run (Read-Only for business data, creates only report snapshot)
    run_no = f"RUN-DEBT-{report_code}-{timezone.now().strftime('%Y%m%d%H%M%S%f')}"
    run = DebtReportRun.objects.create(
        run_number=run_no,
        report_code=report_code,
        report_name=schema["report_name"],
        report_direction=schema.get("report_direction", "AR"),
        report_category_type=schema.get("report_category_type", "DEBT_REPORT"),
        company_id=company_id,
        branch_id=branch_id,
        period_type=params.get("period_type", "CUSTOM"),
        from_date=from_date,
        to_date=to_date,
        as_of_date=as_of_date,
        parameters=_to_json_safe(params),
        summary_payload=_to_json_safe(summary_data),
        dynamic_columns=_to_json_safe(schema.get("columns", [])),
        row_count=len(rows_data),
        generated_by=str(getattr(user, "username", "system")),
    )

    row_objs = []
    for r in rows_data:
        row_objs.append(
            DebtReportRow(
                run=run,
                row_order=r["row_order"],
                row_type=r.get("row_type", "DETAIL"),
                partner_id=r.get("partner_id", ""),
                partner_code=r.get("partner_code", ""),
                partner_name=r.get("partner_name", ""),
                contract_id=r.get("contract_id", ""),
                columns_payload=_to_json_safe(r["columns"]),
                detail_payload=_to_json_safe(r.get("detail_payload", {})),
                source_refs=_to_json_safe(r.get("source_refs", [])),
            )
        )
    if row_objs:
        DebtReportRow.objects.bulk_create(row_objs)

    # Validate calculations
    val_status = "PASSED"
    val_msg = "Kiểm tra tính hợp lệ thành công."
    # If reconciliation has differences
    if report_code in ("RPT-0073", "RPT-0142"):
        has_diff = any(_d(r["columns"].get("difference_amount")) != ZERO for r in rows_data)
        if has_diff:
            val_status = "WARNING"
            val_msg = "Phát hiện chênh lệch giữa chứng từ công nợ và thanh toán."

    DebtReportValidationResult.objects.create(
        run=run,
        check_code="CHK-DEBT-INTEGRITY",
        check_name="Kiểm tra tính nhất quán công nợ",
        severity="INFO" if val_status == "PASSED" else "WARNING",
        status=val_status,
        message=val_msg,
    )

    return _serialize_debt_run_header(run, full=True)


def _serialize_debt_run_header(run: DebtReportRun, full: bool = False) -> dict[str, Any]:
    stale = is_debt_run_stale(run)
    res = {
        "run_id": run.id,
        "run_number": run.run_number,
        "report_code": run.report_code,
        "report_name": run.report_name,
        "report_direction": run.report_direction,
        "report_category_type": run.report_category_type,
        "company_id": run.company_id,
        "branch_id": run.branch_id,
        "from_date": run.from_date.isoformat() if run.from_date else None,
        "to_date": run.to_date.isoformat() if run.to_date else None,
        "as_of_date": run.as_of_date.isoformat() if run.as_of_date else None,
        "status": run.status,
        "validation_status": run.validation_status,
        "is_stale": stale,
        "row_count": run.row_count,
        "summary": run.summary_payload,
        "parameters": run.parameters,
        "columns": run.dynamic_columns,
        "generated_by": run.generated_by,
        "generated_at": run.generated_at.isoformat() if run.generated_at else None,
    }
    if full:
        rows = run.rows.all().order_by("row_order")
        res["rows"] = [
            {
                "id": r.id,
                "row_order": r.row_order,
                "row_type": r.row_type,
                "partner_id": r.partner_id,
                "partner_code": r.partner_code,
                "partner_name": r.partner_name,
                "columns": r.columns_payload,
                "warning_codes": r.warning_codes,
            }
            for r in rows
        ]
    return res


def get_debt_run_header_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/debt/runs/{id}"""
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    run = DebtReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy DebtReportRun #{run_id}.")
    resolve_debt_company_scope(request, {"company_id": run.company_id})
    return _serialize_debt_run_header(run, full=True)


def get_debt_run_rows_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/debt/runs/{id}/rows"""
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    run = DebtReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy DebtReportRun #{run_id}.")
    resolve_debt_company_scope(request, {"company_id": run.company_id})

    rows = run.rows.all().order_by("row_order")
    return {
        "run_id": run.id,
        "count": rows.count(),
        "rows": [
            {
                "id": r.id,
                "row_order": r.row_order,
                "row_type": r.row_type,
                "columns": r.columns_payload,
                "source_refs": r.source_refs,
            }
            for r in rows
        ],
    }


def get_debt_run_summary_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/debt/runs/{id}/summary"""
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    run = DebtReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy DebtReportRun #{run_id}.")
    resolve_debt_company_scope(request, {"company_id": run.company_id})
    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "summary": run.summary_payload,
        "row_count": run.row_count,
        "is_stale": is_debt_run_stale(run),
    }


def get_debt_run_validation_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/debt/runs/{id}/validation"""
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    run = DebtReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy DebtReportRun #{run_id}.")
    resolve_debt_company_scope(request, {"company_id": run.company_id})

    validations = run.validations.all()
    return {
        "run_id": run.id,
        "status": run.validation_status,
        "count": validations.count(),
        "items": [
            {
                "check_code": v.check_code,
                "check_name": v.check_name,
                "severity": v.severity,
                "status": v.status,
                "message": v.message,
            }
            for v in validations
        ],
    }


def get_debt_row_sources_payload(run_id: int, row_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/debt/runs/{id}/rows/{row_id}/sources"""
    check_debt_report_permission(user, request, PERM_DEBT_DETAIL_VIEW)
    row = DebtReportRow.objects.filter(run_id=run_id, id=row_id).first()
    if not row:
        raise ValidationError(f"Không tìm thấy DebtReportRow #{row_id} trong Run #{run_id}.")
    resolve_debt_company_scope(request, {"company_id": row.run.company_id})

    return {
        "row_id": row.id,
        "row_order": row.row_order,
        "partner_id": row.partner_id,
        "partner_code": row.partner_code,
        "partner_name": row.partner_name,
        "columns": row.columns_payload,
        "source_refs": row.source_refs,
    }


def get_debt_run_history_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/debt/runs/{id}/history"""
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    run = DebtReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy DebtReportRun #{run_id}.")
    resolve_debt_company_scope(request, {"company_id": run.company_id})

    history_qs = DebtReportRun.objects.filter(
        report_code=run.report_code,
        company_id=run.company_id,
    ).order_by("-generated_at", "-id")

    versions_list = [_serialize_debt_run_header(h) for h in history_qs]
    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "count": history_qs.count(),
        "versions": versions_list,
    }


def list_debt_saved_filters_payload(report_code: str | None = None, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/debt/saved"""
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    company_id, _ = resolve_debt_company_scope(request, {})

    qs = DebtSavedFilter.objects.filter(company_id=company_id)
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
        }
        for f in qs
    ]
    return {"count": len(items), "items": items}


def save_debt_filter_payload(data: dict[str, Any], user=None, request=None) -> dict[str, Any]:
    """POST /api/v1/reports/debt/saved"""
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    company_id, _ = resolve_debt_company_scope(request, data)

    report_code = str(data.get("report_code") or "").strip()
    filter_name = str(data.get("filter_name") or "").strip()
    if not report_code or not filter_name:
        raise ValidationError("Thiếu 'report_code' hoặc 'filter_name' khi lưu bộ lọc công nợ.")

    saved, _ = DebtSavedFilter.objects.update_or_create(
        company_id=company_id,
        report_code=report_code,
        filter_name=filter_name,
        defaults={
            "user_id": str(getattr(user, "username", "system")),
            "parameters": _to_json_safe(data.get("parameters", {})),
            "is_default": bool(data.get("is_default", False)),
        },
    )

    return {
        "id": saved.id,
        "status": "SAVED",
        "report_code": saved.report_code,
        "filter_name": saved.filter_name,
        "parameters": saved.parameters,
    }


def get_debt_reconciliation_differences_payload(run_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/debt/reconciliation/{id}/differences"""
    check_debt_report_permission(user, request, PERM_DEBT_VIEW)
    full = get_debt_run_header_payload(run_id, user=user, request=request)
    diff_rows = [
        r
        for r in full["rows"]
        if _d(r["columns"].get("difference_amount")) != ZERO
    ]
    return {
        "run_id": full["run_id"],
        "report_code": full["report_code"],
        "difference_count": len(diff_rows),
        "differences": diff_rows,
        "summary": full["summary"],
    }


def export_debt_run_payload(run_id: int, params: dict[str, Any] | None = None, user=None, request=None) -> dict[str, Any]:
    """POST /api/v1/reports/debt/runs/{id}/export"""
    check_debt_report_permission(user, request, PERM_DEBT_EXPORT)
    run = DebtReportRun.objects.filter(id=run_id).first()
    if not run:
        raise ValidationError(f"Không tìm thấy DebtReportRun #{run_id}.")
    resolve_debt_company_scope(request, {"company_id": run.company_id})

    params = params or {}
    export_format = str(params.get("format") or params.get("export_format") or "XLSX").upper()
    if export_format not in ("XLSX", "PDF", "CSV"):
        raise ValidationError(f"Định dạng xuất '{export_format}' không được hỗ trợ.")

    return {
        "export_status": "READY",
        "run_id": run.id,
        "run_number": run.run_number,
        "report_code": run.report_code,
        "report_direction": run.report_direction,
        "format": export_format,
        "row_count": run.row_count,
        "file_name": f"{run.report_code}_{run.company_id}.{export_format.lower()}",
        "watermark": "DRAFT_OR_STALE" if is_debt_run_stale(run) else "OFFICIAL_SNAPSHOT",
    }
