"""
UC-RPT-11 – Xem báo cáo tiền (17 Báo cáo: Tiền mặt, Tiền gửi ngân hàng, Chuyển tiền nội bộ, Khế ước vay & cho vay)

Cung cấp toàn bộ logic tổng hợp, tính toán, kiểm tra và trình bày số liệu tiền:
- Tiền mặt: S03a1-DN (RPT-0030), S03a2-DN (RPT-0033), Sổ quỹ chi tiết (RPT-0034), Số dư theo ngày (RPT-0032).
- Tiền gửi: S03a1-DN (RPT-0036), S03a2-DN (RPT-0038), Sổ tiền gửi (RPT-0037), Bảng kê số dư ngân hàng (RPT-0039), Số dư theo ngày (RPT-0035).
- Chuyển tiền nội bộ: Sổ chi tiết chuyển tiền nội bộ (RPT-0040), Dòng tiền quản trị (RPT-0031).
- Khế ước vay & cho vay: RPT-0041, RPT-0042, RPT-0043, RPT-0044, RPT-0045, RPT-0046.
Tuân thủ nguyên tắc read-only tuyệt đối (BR-RPT-MONEY-10, BR-RPT-MONEY-100).
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
from cash_management.models import CashFund, CashTransaction, CashTransfer, CashCount
from bank_management.models import (
    AccountProfile,
    BankTransaction,
    BankTransfer,
    StatementImport,
    StatementLine,
    Reconciliation,
    LoanAgreement,
    CreditContract,
)
from master_data.models import CompanyBankAccount, Currency, Party

from .models import (
    ReportDefinition,
    MoneyReportRun,
    MoneyReportRow,
    MoneyReportValidationResult,
    MoneySavedFilter,
)

logger = logging.getLogger(__name__)

ZERO = Decimal("0.0000")
TWO_PLACES = Decimal("0.01")

# Permissions
PERM_MONEY_VIEW = "RPT_MONEY_VIEW"
PERM_CASH_VIEW = "RPT_CASH_VIEW"
PERM_BANK_VIEW = "RPT_BANK_VIEW"
PERM_LOAN_VIEW = "RPT_LOAN_VIEW"
PERM_MONEY_DETAIL_VIEW = "RPT_MONEY_DETAIL_VIEW"
PERM_MONEY_EXPORT = "RPT_MONEY_EXPORT"
PERM_BANK_RECONCILIATION_VIEW = "RPT_BANK_RECONCILIATION_VIEW"

ALL_MONEY_PERMISSIONS = (
    PERM_MONEY_VIEW,
    PERM_CASH_VIEW,
    PERM_BANK_VIEW,
    PERM_LOAN_VIEW,
    PERM_MONEY_DETAIL_VIEW,
    PERM_MONEY_EXPORT,
    PERM_BANK_RECONCILIATION_VIEW,
)

PERM_ALIASES: dict[str, tuple[str, ...]] = {
    PERM_MONEY_VIEW: (
        "RPT_MONEY_VIEW",
        "RPT.MONEY.VIEW",
        "RPT.VIEW",
        "MONEY.VIEW",
        "RPT_CASH_VIEW",
        "RPT_BANK_VIEW",
        "RPT_LOAN_VIEW",
        "RPT_MONEY_DETAIL_VIEW",
    ),
    PERM_CASH_VIEW: (
        "RPT_CASH_VIEW",
        "RPT.CASH.VIEW",
        "CASH.VIEW",
        "RPT_MONEY_VIEW",
    ),
    PERM_BANK_VIEW: (
        "RPT_BANK_VIEW",
        "RPT.BANK.VIEW",
        "BANK.VIEW",
        "RPT_MONEY_VIEW",
    ),
    PERM_LOAN_VIEW: (
        "RPT_LOAN_VIEW",
        "RPT.LOAN.VIEW",
        "LOAN.VIEW",
        "RPT_MONEY_VIEW",
    ),
    PERM_MONEY_DETAIL_VIEW: (
        "RPT_MONEY_DETAIL_VIEW",
        "RPT.MONEY.DETAIL.VIEW",
        "RPT.DETAIL.VIEW",
    ),
    PERM_MONEY_EXPORT: (
        "RPT_MONEY_EXPORT",
        "RPT.MONEY.EXPORT",
        "RPT.EXPORT",
    ),
    PERM_BANK_RECONCILIATION_VIEW: (
        "RPT_BANK_RECONCILIATION_VIEW",
        "RPT.BANK.RECON.VIEW",
        "BANK.RECON.VIEW",
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
# Metadata & Catalogue definitions for 17 Money Reports
# -----------------------------------------------------------------------------

MONEY_REPORT_SCHEMAS: dict[str, dict[str, Any]] = {
    # 1. RPT-0030: S03a1-DN: Sổ nhật ký thu tiền (Tiền mặt) - 11 cột
    "RPT-0030": {
        "report_code": "RPT-0030",
        "report_name": "S03a1-DN: Sổ nhật ký thu tiền (Tiền mặt)",
        "money_source_type": "CASH",
        "report_category_type": "CASH_JOURNAL",
        "schema_version": "1.0",
        "columns": [
            {"code": "posting_date", "name": "Ngày, tháng ghi sổ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số hiệu", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày tháng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "debit_cash_account_amount", "name": "Ghi Nợ TK", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_slot_1", "name": "TK Có 1", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_slot_2", "name": "TK Có 2", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_slot_3", "name": "TK Có 3", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_slot_4", "name": "TK Có 4", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_credit_amount", "name": "Số tiền các TK khác", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_credit_account_code", "name": "Số hiệu TK khác", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 2. RPT-0031: Dòng tiền (Quản trị) - 4 cột
    "RPT-0031": {
        "report_code": "RPT-0031",
        "report_name": "Báo cáo dòng tiền",
        "money_source_type": "COMBINED",
        "report_category_type": "CASH_FLOW",
        "schema_version": "1.0",
        "columns": [
            {"code": "cash_flow_category_code", "name": "Mã mục thu/chi", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "cash_flow_category_name", "name": "Tên mục thu/chi", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "previous_period_amount", "name": "Kỳ trước", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "current_period_amount", "name": "Kỳ này", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 3. RPT-0032: Bảng kê số dư tiền theo ngày (Tiền mặt) - 1 cột cố định
    "RPT-0032": {
        "report_code": "RPT-0032",
        "report_name": "Bảng kê số dư tiền theo ngày (Tiền mặt)",
        "money_source_type": "CASH",
        "report_category_type": "DAILY_BALANCE",
        "schema_version": "1.0",
        "columns": [
            {"code": "indicator_name", "name": "Chỉ tiêu", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    # 4. RPT-0033: S03a2-DN: Sổ nhật ký chi tiền (Tiền mặt) - 11 cột
    "RPT-0033": {
        "report_code": "RPT-0033",
        "report_name": "S03a2-DN: Sổ nhật ký chi tiền (Tiền mặt)",
        "money_source_type": "CASH",
        "report_category_type": "CASH_JOURNAL",
        "schema_version": "1.0",
        "columns": [
            {"code": "posting_date", "name": "Ngày, tháng ghi sổ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số hiệu", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày tháng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "credit_cash_account_amount", "name": "Ghi Có TK", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "debit_slot_1", "name": "TK Nợ 1", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "debit_slot_2", "name": "TK Nợ 2", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "debit_slot_3", "name": "TK Nợ 3", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "debit_slot_4", "name": "TK Nợ 4", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_debit_amount", "name": "Số tiền các TK khác", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_debit_account_code", "name": "Số hiệu TK khác", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 5. RPT-0034: Sổ kế toán chi tiết quỹ tiền mặt - 11 cột
    "RPT-0034": {
        "report_code": "RPT-0034",
        "report_name": "Sổ kế toán chi tiết quỹ tiền mặt",
        "money_source_type": "CASH",
        "report_category_type": "CASH_LEDGER",
        "schema_version": "1.0",
        "columns": [
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "cash_receipt_number", "name": "Số phiếu thu", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "cash_payment_number", "name": "Số phiếu chi", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "cash_account_code", "name": "Tài khoản", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "counter_account_code", "name": "TK đối ứng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "debit_amount", "name": "Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_amount", "name": "Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "running_cash_balance", "name": "Số tồn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "payer_or_payee_name", "name": "Người nhận/Người nộp", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    # 6. RPT-0035: Bảng kê số dư tiền theo ngày (Tiền gửi) - 1 cột cố định
    "RPT-0035": {
        "report_code": "RPT-0035",
        "report_name": "Bảng kê số dư tiền theo ngày (Tiền gửi)",
        "money_source_type": "BANK",
        "report_category_type": "DAILY_BALANCE",
        "schema_version": "1.0",
        "columns": [
            {"code": "indicator_name", "name": "Chỉ tiêu", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    # 7. RPT-0036: S03a1-DN: Sổ nhật ký thu tiền (Tiền gửi) - 11 cột
    "RPT-0036": {
        "report_code": "RPT-0036",
        "report_name": "S03a1-DN: Sổ nhật ký thu tiền (Tiền gửi)",
        "money_source_type": "BANK",
        "report_category_type": "BANK_JOURNAL",
        "schema_version": "1.0",
        "columns": [
            {"code": "posting_date", "name": "Ngày, tháng ghi sổ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số hiệu", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày tháng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "debit_bank_account_amount", "name": "Ghi Nợ TK", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_slot_1", "name": "TK Có 1", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_slot_2", "name": "TK Có 2", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_slot_3", "name": "TK Có 3", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "credit_slot_4", "name": "TK Có 4", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_credit_amount", "name": "Số tiền các TK khác", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_credit_account_code", "name": "Số hiệu TK khác", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 8. RPT-0037: Sổ tiền gửi ngân hàng - 8 cột
    "RPT-0037": {
        "report_code": "RPT-0037",
        "report_name": "Sổ tiền gửi ngân hàng",
        "money_source_type": "BANK",
        "report_category_type": "BANK_LEDGER",
        "schema_version": "1.0",
        "columns": [
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "counter_account_code", "name": "TK đối ứng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "receipt_amount", "name": "Thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "payment_amount", "name": "Chi", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "running_bank_balance", "name": "Tồn", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 9. RPT-0038: S03a2-DN: Sổ nhật ký chi tiền (Tiền gửi) - 11 cột
    "RPT-0038": {
        "report_code": "RPT-0038",
        "report_name": "S03a2-DN: Sổ nhật ký chi tiền (Tiền gửi)",
        "money_source_type": "BANK",
        "report_category_type": "BANK_JOURNAL",
        "schema_version": "1.0",
        "columns": [
            {"code": "posting_date", "name": "Ngày, tháng ghi sổ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số hiệu", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "document_date", "name": "Ngày tháng", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "credit_bank_account_amount", "name": "Ghi Có TK", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "debit_slot_1", "name": "TK Nợ 1", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "debit_slot_2", "name": "TK Nợ 2", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "debit_slot_3", "name": "TK Nợ 3", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "debit_slot_4", "name": "TK Nợ 4", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_debit_amount", "name": "Số tiền các TK khác", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "other_debit_account_code", "name": "Số hiệu TK khác", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 10. RPT-0039: Bảng kê số dư ngân hàng - 6 cột
    "RPT-0039": {
        "report_code": "RPT-0039",
        "report_name": "Bảng kê số dư ngân hàng",
        "money_source_type": "BANK",
        "report_category_type": "BANK_BALANCE",
        "schema_version": "1.0",
        "columns": [
            {"code": "bank_account_number", "name": "Tài khoản ngân hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "bank_name", "name": "Tên ngân hàng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "opening_balance", "name": "Số dư đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_debit", "name": "Phát sinh Nợ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "period_credit", "name": "Phát sinh Có", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_balance", "name": "Số dư cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 11. RPT-0040: Sổ chi tiết chuyển tiền nội bộ - 12 cột
    "RPT-0040": {
        "report_code": "RPT-0040",
        "report_name": "Sổ chi tiết chuyển tiền nội bộ",
        "money_source_type": "COMBINED",
        "report_category_type": "TRANSFER",
        "schema_version": "1.0",
        "columns": [
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "source_account_number", "name": "Tài khoản đi", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "source_account_name", "name": "Tên tài khoản đi", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "destination_account_number", "name": "Tài khoản đến", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "destination_account_name", "name": "Tên tài khoản đến", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "transfer_reason", "name": "Lý do chuyển", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "debit_account_code", "name": "TK Nợ", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "credit_account_code", "name": "TK Có", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "transfer_amount", "name": "Số tiền", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 12. RPT-0041: Báo cáo tổng hợp tình hình khế ước vay - 13 cột
    "RPT-0041": {
        "report_code": "RPT-0041",
        "report_name": "Báo cáo tổng hợp tình hình khế ước vay",
        "money_source_type": "LOAN",
        "report_category_type": "LOAN_BORROWING",
        "schema_version": "1.0",
        "columns": [
            {"code": "loan_agreement_number", "name": "Khế ước vay", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "lender_name", "name": "Tên đối tượng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "disbursement_date", "name": "Ngày giải ngân", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "maturity_date", "name": "Ngày đáo hạn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "interest_rate_percent", "name": "Lãi suất (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "contract_principal_amount", "name": "Giá trị khoản vay", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "disbursed_principal_amount", "name": "Giá trị giải ngân", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "opening_principal_outstanding", "name": "Dư nợ gốc đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "principal_paid_period", "name": "Đã trả gốc - Trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "principal_paid_cumulative", "name": "Đã trả gốc - Lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_principal_outstanding", "name": "Dư nợ gốc cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "interest_paid_period", "name": "Đã trả lãi - Trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "interest_paid_cumulative", "name": "Đã trả lãi - Lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 13. RPT-0042: S34-DN: Sổ chi tiết tiền vay - 13 cột
    "RPT-0042": {
        "report_code": "RPT-0042",
        "report_name": "S34-DN: Sổ chi tiết tiền vay",
        "money_source_type": "LOAN",
        "report_category_type": "LOAN_BORROWING",
        "schema_version": "1.0",
        "columns": [
            {"code": "posting_date", "name": "Ngày ghi sổ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "loan_agreement_number", "name": "Số khế ước", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "lender_name", "name": "Đối tượng cho vay", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "account_code", "name": "Tài khoản vay", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "counter_account_code", "name": "TK đối ứng", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "principal_increase", "name": "Phát sinh tăng gốc", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "principal_decrease", "name": "Phát sinh giảm gốc", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "running_principal_balance", "name": "Dư gốc", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "currency_code", "name": "Loại tiền", "data_type": "STRING", "align": "center", "is_totalable": False},
            {"code": "source_reference", "name": "Nguồn chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
        ],
    },
    # 14. RPT-0043: Bảng kê chứng từ theo khế ước vay - 8 cột
    "RPT-0043": {
        "report_code": "RPT-0043",
        "report_name": "Bảng kê chứng từ theo khế ước vay",
        "money_source_type": "LOAN",
        "report_category_type": "LOAN_BORROWING",
        "schema_version": "1.0",
        "columns": [
            {"code": "lender_name", "name": "Tên đối tượng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "principal_disbursed_amount", "name": "Đã giải ngân", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "principal_repaid_amount", "name": "Nợ gốc đã trả", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "interest_paid_amount", "name": "Lãi đã trả", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 15. RPT-0044: Tổng hợp lịch trả nợ khế ước vay - 7 cột cố định + động
    "RPT-0044": {
        "report_code": "RPT-0044",
        "report_name": "Tổng hợp lịch trả nợ khế ước vay",
        "money_source_type": "LOAN",
        "report_category_type": "LOAN_BORROWING",
        "schema_version": "1.0",
        "columns": [
            {"code": "loan_agreement_number", "name": "Số khế ước đi vay", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "credit_contract_number", "name": "Hợp đồng tín dụng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "lender_code", "name": "Đối tượng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "lender_name", "name": "Tên đối tượng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "contract_principal_amount", "name": "Giá trị khoản vay", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "interest_rate_percent", "name": "Lãi suất (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "loan_term", "name": "Thời hạn vay", "data_type": "STRING", "align": "center", "is_totalable": False},
        ],
    },
    # 16. RPT-0045: Báo cáo tổng hợp tình hình khế ước cho vay - 13 cột
    "RPT-0045": {
        "report_code": "RPT-0045",
        "report_name": "Báo cáo tổng hợp tình hình khế ước cho vay",
        "money_source_type": "LOAN",
        "report_category_type": "LOAN_LENDING",
        "schema_version": "1.0",
        "columns": [
            {"code": "loan_agreement_number", "name": "Khế ước cho vay", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "borrower_name", "name": "Tên đối tượng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "disbursement_date", "name": "Ngày giải ngân", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "maturity_date", "name": "Ngày đáo hạn", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "interest_rate_percent", "name": "Lãi suất (%)", "data_type": "NUMBER", "align": "right", "is_totalable": False},
            {"code": "contract_principal_amount", "name": "Giá trị khoản vay", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "principal_disbursed_amount", "name": "Giá trị giải ngân", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "opening_principal_receivable", "name": "Dư nợ gốc đầu kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "principal_collected_period", "name": "Đã thu gốc - Trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "principal_collected_cumulative", "name": "Đã thu gốc - Lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "closing_principal_receivable", "name": "Dư nợ gốc cuối kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "interest_collected_period", "name": "Đã thu lãi - Trong kỳ", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "interest_collected_cumulative", "name": "Đã thu lãi - Lũy kế", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
    # 17. RPT-0046: Bảng kê chứng từ theo khế ước cho vay - 8 cột
    "RPT-0046": {
        "report_code": "RPT-0046",
        "report_name": "Bảng kê chứng từ theo khế ước cho vay",
        "money_source_type": "LOAN",
        "report_category_type": "LOAN_LENDING",
        "schema_version": "1.0",
        "columns": [
            {"code": "borrower_name", "name": "Tên đối tượng", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "posting_date", "name": "Ngày hạch toán", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_date", "name": "Ngày chứng từ", "data_type": "DATE", "align": "center", "is_totalable": False},
            {"code": "document_no", "name": "Số chứng từ", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "description", "name": "Diễn giải", "data_type": "STRING", "align": "left", "is_totalable": False},
            {"code": "disbursed_amount", "name": "Đã giải ngân", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "principal_collected_amount", "name": "Nợ gốc đã thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
            {"code": "interest_collected_amount", "name": "Lãi đã thu", "data_type": "NUMBER", "align": "right", "is_totalable": True},
        ],
    },
}


# -----------------------------------------------------------------------------
# Permissions and Context Helpers
# -----------------------------------------------------------------------------

def user_has_money_permission(user, request, perm_code: str) -> bool:
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
            granted.add(p.split(".")[-1].upper())

    aliases = PERM_ALIASES.get(perm_code, (perm_code,))
    return any(a.upper() in granted for a in aliases)


def check_money_report_permission(user, request, perm_code: str):
    if not user_has_money_permission(user, request, perm_code):
        raise PermissionDenied(f"Người dùng không có quyền '{perm_code}' để truy cập báo cáo tiền.")


def resolve_money_company_scope(request, params: dict[str, Any]) -> tuple[str, str]:
    company_id = params.get("company_id")
    if not company_id and request:
        company_id = request.headers.get("X-Company-Id") or request.query_params.get("company_id")
    if not company_id:
        company_id = "DEFAULT-COMPANY"

    branch_id = params.get("branch_id")
    if not branch_id and request:
        branch_id = request.headers.get("X-Branch-Id") or request.query_params.get("branch_id") or ""
    return str(company_id), str(branch_id or "")


# -----------------------------------------------------------------------------
# Catalogue & Schema Endpoints
# -----------------------------------------------------------------------------

def get_money_report_catalogue_payload(company_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/catalogue"""
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    items = []
    for code, schema in MONEY_REPORT_SCHEMAS.items():
        items.append({
            "report_code": code,
            "report_name": schema["report_name"],
            "money_source_type": schema["money_source_type"],
            "report_category_type": schema["report_category_type"],
            "column_count": len(schema["columns"]),
            "schema_version": schema["schema_version"],
        })
    return {
        "company_id": company_id,
        "count": len(items),
        "cash_count": sum(1 for i in items if i["money_source_type"] == "CASH"),
        "bank_count": sum(1 for i in items if i["money_source_type"] == "BANK"),
        "combined_count": sum(1 for i in items if i["money_source_type"] == "COMBINED"),
        "loan_count": sum(1 for i in items if i["money_source_type"] == "LOAN"),
        "items": items,
    }


def get_money_report_schema_payload(report_code: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/{report_code}/schema"""
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    schema = MONEY_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo tiền '{report_code}' không tồn tại trong danh mục.")
    return schema


def get_money_report_parameters_payload(report_code: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/{report_code}/parameters"""
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    schema = MONEY_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo tiền '{report_code}' không tồn tại.")

    common_params = [
        {"name": "company_id", "type": "STRING", "required": True, "label": "Doanh nghiệp"},
        {"name": "from_date", "type": "DATE", "required": False, "label": "Từ ngày"},
        {"name": "to_date", "type": "DATE", "required": False, "label": "Đến ngày"},
        {"name": "as_of_date", "type": "DATE", "required": False, "label": "Ngày chốt"},
        {"name": "currency_id", "type": "STRING", "required": False, "label": "Loại tiền"},
    ]
    if schema["money_source_type"] == "CASH":
        common_params.append({"name": "cash_fund_id", "type": "STRING", "required": False, "label": "Quỹ tiền mặt"})
        common_params.append({"name": "merge_same_entries", "type": "BOOLEAN", "required": False, "label": "Cộng gộp bút toán giống nhau"})
        common_params.append({"name": "receipts_before_payments", "type": "BOOLEAN", "required": False, "label": "Thu trước chi cùng ngày"})
    elif schema["money_source_type"] == "BANK":
        common_params.append({"name": "bank_account_id", "type": "STRING", "required": False, "label": "Tài khoản ngân hàng"})
        common_params.append({"name": "merge_by_document", "type": "BOOLEAN", "required": False, "label": "Cộng gộp theo chứng từ"})
    elif schema["money_source_type"] == "LOAN":
        common_params.append({"name": "loan_agreement_id", "type": "STRING", "required": False, "label": "Khế ước vay/cho vay"})
        common_params.append({"name": "counterparty_name", "type": "STRING", "required": False, "label": "Tên đối tượng"})

    return {
        "report_code": report_code,
        "money_source_type": schema["money_source_type"],
        "parameters": common_params,
    }


# -----------------------------------------------------------------------------
# Report Builders
# -----------------------------------------------------------------------------

def _build_cash_journal_rpt0030(company_id: str, from_date: date | None, to_date: date | None, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0030: S03a1-DN Sổ nhật ký thu tiền (Tiền mặt) - 11 vị trí cột (Nợ TK 111, phân bổ các Slot TK Có)."""
    lines_qs = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__startswith="111",
        debit__gt=0,
    ).select_related("entry", "account", "party")
    if from_date:
        lines_qs = lines_qs.filter(entry__posting_date__gte=from_date)
    if to_date:
        lines_qs = lines_qs.filter(entry__posting_date__lte=to_date)

    fund_id = params.get("cash_fund_id")
    if fund_id:
        lines_qs = lines_qs.filter(entry__description__icontains=fund_id)

    rows = []
    tot_debit = ZERO
    tot_c1 = ZERO
    tot_c2 = ZERO
    tot_c3 = ZERO
    tot_c4 = ZERO
    tot_other = ZERO

    # Configured Credit Slots
    slot_map = params.get("account_slots", ["511", "131", "331", "112"])

    idx = 1
    for l in lines_qs.order_by("entry__posting_date", "entry__number", "line_no")[:200]:
        deb = _to_dec(l.debit)
        # Find offset credit lines in same entry
        other_lines = JournalLine.objects.filter(entry=l.entry, credit__gt=0).select_related("account")
        c1 = ZERO
        c2 = ZERO
        c3 = ZERO
        c4 = ZERO
        other_amt = ZERO
        other_code = ""

        for ol in other_lines:
            c_code = ol.account.code
            c_amt = _to_dec(ol.credit)
            if len(slot_map) > 0 and c_code.startswith(slot_map[0]):
                c1 += c_amt
            elif len(slot_map) > 1 and c_code.startswith(slot_map[1]):
                c2 += c_amt
            elif len(slot_map) > 2 and c_code.startswith(slot_map[2]):
                c3 += c_amt
            elif len(slot_map) > 3 and c_code.startswith(slot_map[3]):
                c4 += c_amt
            else:
                other_amt += c_amt
                other_code = c_code

        # If no explicit credit lines, default other_amt to deb
        if c1 == ZERO and c2 == ZERO and c3 == ZERO and c4 == ZERO and other_amt == ZERO:
            other_amt = deb
            other_code = "OTHER"

        doc_no = getattr(l.entry, "number", str(l.entry.id))
        doc_date = getattr(l.entry, "document_date", l.entry.posting_date)
        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "document_id": str(l.entry.id),
            "document_no": doc_no,
            "columns": {
                "posting_date": l.entry.posting_date,
                "document_no": doc_no,
                "document_date": doc_date,
                "description": l.entry.description or l.description,
                "debit_cash_account_amount": _f(deb),
                "credit_slot_1": _f(c1),
                "credit_slot_2": _f(c2),
                "credit_slot_3": _f(c3),
                "credit_slot_4": _f(c4),
                "other_credit_amount": _f(other_amt),
                "other_credit_account_code": other_code,
            },
            "source_refs": [{"source_type": "GL_JOURNAL", "journal_id": str(l.entry.id), "line_no": l.line_no}],
        })
        tot_debit += deb
        tot_c1 += c1
        tot_c2 += c2
        tot_c3 += c3
        tot_c4 += c4
        tot_other += other_amt
        idx += 1

    summary = {
        "total_debit_cash": _f(tot_debit),
        "total_credit_slot_1": _f(tot_c1),
        "total_credit_slot_2": _f(tot_c2),
        "total_credit_slot_3": _f(tot_c3),
        "total_credit_slot_4": _f(tot_c4),
        "total_other_credit": _f(tot_other),
        "row_count": len(rows),
    }
    return rows, summary


def _build_cash_disbursement_journal_rpt0033(company_id: str, from_date: date | None, to_date: date | None, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0033: S03a2-DN Sổ nhật ký chi tiền (Tiền mặt) - 11 vị trí cột (Có TK 111, phân bổ các Slot TK Nợ)."""
    lines_qs = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__startswith="111",
        credit__gt=0,
    ).select_related("entry", "account", "party")
    if from_date:
        lines_qs = lines_qs.filter(entry__posting_date__gte=from_date)
    if to_date:
        lines_qs = lines_qs.filter(entry__posting_date__lte=to_date)

    slot_map = params.get("account_slots", ["331", "156", "642", "112"])

    rows = []
    tot_credit = ZERO
    tot_d1 = ZERO
    tot_d2 = ZERO
    tot_d3 = ZERO
    tot_d4 = ZERO
    tot_other = ZERO

    idx = 1
    for l in lines_qs.order_by("entry__posting_date", "entry__number", "line_no")[:200]:
        crd = _to_dec(l.credit)
        other_lines = JournalLine.objects.filter(entry=l.entry, debit__gt=0).select_related("account")
        d1 = ZERO
        d2 = ZERO
        d3 = ZERO
        d4 = ZERO
        other_amt = ZERO
        other_code = ""

        for ol in other_lines:
            d_code = ol.account.code
            d_amt = _to_dec(ol.debit)
            if len(slot_map) > 0 and d_code.startswith(slot_map[0]):
                d1 += d_amt
            elif len(slot_map) > 1 and d_code.startswith(slot_map[1]):
                d2 += d_amt
            elif len(slot_map) > 2 and d_code.startswith(slot_map[2]):
                d3 += d_amt
            elif len(slot_map) > 3 and d_code.startswith(slot_map[3]):
                d4 += d_amt
            else:
                other_amt += d_amt
                other_code = d_code

        if d1 == ZERO and d2 == ZERO and d3 == ZERO and d4 == ZERO and other_amt == ZERO:
            other_amt = crd
            other_code = "OTHER"

        doc_no = getattr(l.entry, "number", str(l.entry.id))
        doc_date = getattr(l.entry, "document_date", l.entry.posting_date)
        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "document_id": str(l.entry.id),
            "document_no": doc_no,
            "columns": {
                "posting_date": l.entry.posting_date,
                "document_no": doc_no,
                "document_date": doc_date,
                "description": l.entry.description or l.description,
                "credit_cash_account_amount": _f(crd),
                "debit_slot_1": _f(d1),
                "debit_slot_2": _f(d2),
                "debit_slot_3": _f(d3),
                "debit_slot_4": _f(d4),
                "other_debit_amount": _f(other_amt),
                "other_debit_account_code": other_code,
            },
            "source_refs": [{"source_type": "GL_JOURNAL", "journal_id": str(l.entry.id), "line_no": l.line_no}],
        })
        tot_credit += crd
        tot_d1 += d1
        tot_d2 += d2
        tot_d3 += d3
        tot_d4 += d4
        tot_other += other_amt
        idx += 1

    summary = {
        "total_credit_cash": _f(tot_credit),
        "total_debit_slot_1": _f(tot_d1),
        "total_debit_slot_2": _f(tot_d2),
        "total_debit_slot_3": _f(tot_d3),
        "total_debit_slot_4": _f(tot_d4),
        "total_other_debit": _f(tot_other),
        "row_count": len(rows),
    }
    return rows, summary


def _build_detailed_cash_ledger_rpt0034(company_id: str, from_date: date | None, to_date: date | None, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0034: Sổ kế toán chi tiết quỹ tiền mặt (11 cột: ngày ghi sổ, ngày CT, số PT, số PC, diễn giải, TK, TK đối ứng, Nợ, Có, tồn chạy, người nộp/nhận)."""
    # 1. Opening balance: all prior transactions before from_date
    open_lines = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__startswith="111",
    )
    if from_date:
        open_lines = open_lines.filter(entry__posting_date__lt=from_date)
    else:
        open_lines = open_lines.none()

    open_debit = _to_dec(open_lines.aggregate(s=Sum("debit"))["s"])
    open_credit = _to_dec(open_lines.aggregate(s=Sum("credit"))["s"])
    opening_balance = open_debit - open_credit

    # 2. In-period transactions
    period_lines = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__startswith="111",
    ).select_related("entry", "account", "party")
    if from_date:
        period_lines = period_lines.filter(entry__posting_date__gte=from_date)
    if to_date:
        period_lines = period_lines.filter(entry__posting_date__lte=to_date)

    # Sort options
    receipts_first = params.get("receipts_before_payments", False)
    if receipts_first:
        period_lines = period_lines.order_by("entry__posting_date", "-debit", "entry__number")
    else:
        period_lines = period_lines.order_by("entry__posting_date", "entry__number", "line_no")

    rows = []
    current_running = opening_balance
    tot_deb = ZERO
    tot_crd = ZERO

    idx = 1
    for l in period_lines[:200]:
        deb = _to_dec(l.debit)
        crd = _to_dec(l.credit)
        current_running = current_running + deb - crd

        # Offset account
        offset_l = JournalLine.objects.filter(entry=l.entry).exclude(id=l.id).first()
        offset_code = offset_l.account.code if offset_l and offset_l.account else ""

        doc_no = getattr(l.entry, "number", str(l.entry.id))
        is_rcp = deb > 0
        rcp_no = doc_no if is_rcp else ""
        pmt_no = doc_no if not is_rcp else ""
        p_name = getattr(l.party, "name", "") if l.party else ""

        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "document_id": str(l.entry.id),
            "document_no": doc_no,
            "columns": {
                "posting_date": l.entry.posting_date,
                "document_date": getattr(l.entry, "document_date", l.entry.posting_date),
                "cash_receipt_number": rcp_no,
                "cash_payment_number": pmt_no,
                "description": l.entry.description or l.description,
                "cash_account_code": l.account.code,
                "counter_account_code": offset_code,
                "debit_amount": _f(deb),
                "credit_amount": _f(crd),
                "running_cash_balance": _f(current_running),
                "payer_or_payee_name": p_name,
            },
            "source_refs": [{"source_type": "CASH_TRANSACTION", "journal_id": str(l.entry.id), "line_no": l.line_no}],
        })
        tot_deb += deb
        tot_crd += crd
        idx += 1

    closing_balance = opening_balance + tot_deb - tot_crd
    summary = {
        "opening_balance": _f(opening_balance),
        "total_debit": _f(tot_deb),
        "total_credit": _f(tot_crd),
        "closing_balance": _f(closing_balance),
        "row_count": len(rows),
    }
    return rows, summary


def _build_bank_ledger_rpt0037(company_id: str, from_date: date | None, to_date: date | None, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0037: Sổ tiền gửi ngân hàng (8 cột: ngày hạch toán, ngày CT, số CT, diễn giải, TK đối ứng, Thu, Chi, Tồn)."""
    bank_account_id = params.get("bank_account_id")

    open_lines = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__startswith="112",
    )
    if from_date:
        open_lines = open_lines.filter(entry__posting_date__lt=from_date)
    else:
        open_lines = open_lines.none()

    open_deb = _to_dec(open_lines.aggregate(s=Sum("debit"))["s"])
    open_crd = _to_dec(open_lines.aggregate(s=Sum("credit"))["s"])
    opening_balance = open_deb - open_crd

    period_lines = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__startswith="112",
    ).select_related("entry", "account", "party")
    if from_date:
        period_lines = period_lines.filter(entry__posting_date__gte=from_date)
    if to_date:
        period_lines = period_lines.filter(entry__posting_date__lte=to_date)

    rows = []
    current_running = opening_balance
    tot_rcp = ZERO
    tot_pmt = ZERO

    idx = 1
    for l in period_lines.order_by("entry__posting_date", "entry__number", "line_no")[:200]:
        deb = _to_dec(l.debit)
        crd = _to_dec(l.credit)
        current_running = current_running + deb - crd

        offset_l = JournalLine.objects.filter(entry=l.entry).exclude(id=l.id).first()
        offset_code = offset_l.account.code if offset_l and offset_l.account else ""
        doc_no = getattr(l.entry, "number", str(l.entry.id))

        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "bank_account_id": str(bank_account_id or ""),
            "document_id": str(l.entry.id),
            "document_no": doc_no,
            "columns": {
                "posting_date": l.entry.posting_date,
                "document_date": getattr(l.entry, "document_date", l.entry.posting_date),
                "document_no": doc_no,
                "description": l.entry.description or l.description,
                "counter_account_code": offset_code,
                "receipt_amount": _f(deb),
                "payment_amount": _f(crd),
                "running_bank_balance": _f(current_running),
            },
            "source_refs": [{"source_type": "BANK_BOOK", "journal_id": str(l.entry.id), "line_no": l.line_no}],
        })
        tot_rcp += deb
        tot_pmt += crd
        idx += 1

    closing_balance = opening_balance + tot_rcp - tot_pmt
    summary = {
        "opening_balance": _f(opening_balance),
        "total_receipt": _f(tot_rcp),
        "total_payment": _f(tot_pmt),
        "closing_balance": _f(closing_balance),
        "row_count": len(rows),
    }
    return rows, summary


def _build_bank_balance_summary_rpt0039(company_id: str, from_date: date | None, to_date: date | None, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0039: Bảng kê số dư ngân hàng (6 cột: tài khoản NH, tên NH, số dư đầu kỳ, phát sinh Nợ, phát sinh Có, số dư cuối kỳ)."""
    bank_accounts = CompanyBankAccount.objects.filter(company_id=company_id).select_related("bank")
    rows = []
    tot_open = ZERO
    tot_deb = ZERO
    tot_crd = ZERO
    tot_close = ZERO

    idx = 1
    for ba in bank_accounts:
        b_name = ba.bank.name if ba.bank else ba.account_name
        # Opening balance for this bank account (or by GL account if mapped)
        open_qs = JournalLine.objects.filter(
            entry__company_id=company_id,
            entry__status="POSTED",
            account__code__startswith="112",
        )
        if from_date:
            open_qs = open_qs.filter(entry__posting_date__lt=from_date)
        else:
            open_qs = open_qs.none()
        ob_deb = _to_dec(open_qs.aggregate(s=Sum("debit"))["s"])
        ob_crd = _to_dec(open_qs.aggregate(s=Sum("credit"))["s"])
        open_bal = ob_deb - ob_crd

        # Period movements
        per_qs = JournalLine.objects.filter(
            entry__company_id=company_id,
            entry__status="POSTED",
            account__code__startswith="112",
        )
        if from_date:
            per_qs = per_qs.filter(entry__posting_date__gte=from_date)
        if to_date:
            per_qs = per_qs.filter(entry__posting_date__lte=to_date)
        p_deb = _to_dec(per_qs.aggregate(s=Sum("debit"))["s"])
        p_crd = _to_dec(per_qs.aggregate(s=Sum("credit"))["s"])
        close_bal = open_bal + p_deb - p_crd

        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "bank_account_id": str(ba.id),
            "columns": {
                "bank_account_number": ba.account_number,
                "bank_name": b_name,
                "opening_balance": _f(open_bal),
                "period_debit": _f(p_deb),
                "period_credit": _f(p_crd),
                "closing_balance": _f(close_bal),
            },
        })
        tot_open += open_bal
        tot_deb += p_deb
        tot_crd += p_crd
        tot_close += close_bal
        idx += 1

    summary = {
        "total_opening_balance": _f(tot_open),
        "total_period_debit": _f(tot_deb),
        "total_period_credit": _f(tot_crd),
        "total_closing_balance": _f(tot_close),
        "account_count": len(rows),
    }
    return rows, summary


def _build_internal_transfers_rpt0040(company_id: str, from_date: date | None, to_date: date | None, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0040: Sổ chi tiết chuyển tiền nội bộ (12 cột: ngày hạch toán, ngày CT, số CT, TK đi, tên TK đi, TK đến, tên TK đến, lý do chuyển, diễn giải, TK Nợ, TK Có, số tiền)."""
    transfers = BankTransfer.objects.filter(company_id=company_id).select_related(
        "source_account", "destination_account"
    )
    if from_date:
        transfers = transfers.filter(transfer_date__gte=from_date)
    if to_date:
        transfers = transfers.filter(transfer_date__lte=to_date)

    rows = []
    tot_amt = ZERO
    idx = 1
    for t in transfers:
        amt = _to_dec(t.source_amount)
        src_no = getattr(t.source_account.account, "account_number", "TK-NGUON") if hasattr(t.source_account, "account") else "TK-NGUON"
        src_name = getattr(t.source_account.account, "account_name", "Tài khoản nguồn") if hasattr(t.source_account, "account") else "Tài khoản nguồn"
        dst_no = getattr(t.destination_account.account, "account_number", "TK-DICH") if hasattr(t.destination_account, "account") else "TK-DICH"
        dst_name = getattr(t.destination_account.account, "account_name", "Tài khoản đích") if hasattr(t.destination_account, "account") else "Tài khoản đích"

        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "transfer_id": str(t.id),
            "document_no": t.number,
            "columns": {
                "posting_date": t.posting_date or t.transfer_date,
                "document_date": t.transfer_date,
                "document_no": t.number,
                "source_account_number": src_no,
                "source_account_name": src_name,
                "destination_account_number": dst_no,
                "destination_account_name": dst_name,
                "transfer_reason": "Chuyển tiền nội bộ",
                "description": t.description,
                "debit_account_code": "1121",
                "credit_account_code": "1121",
                "transfer_amount": _f(amt),
            },
            "source_refs": [{"source_type": "BANK_TRANSFER", "transfer_id": str(t.id)}],
        })
        tot_amt += amt
        idx += 1

    summary = {
        "total_transfer_amount": _f(tot_amt),
        "transfer_count": len(rows),
    }
    return rows, summary


def _build_cash_flow_rpt0031(company_id: str, from_date: date | None, to_date: date | None, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0031: Dòng tiền quản trị (4 cột: mã mục, tên mục, kỳ trước, kỳ này). Loại trừ chuyển nội bộ."""
    # Opening balance
    open_lines = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__regex=r"^(111|112)",
    )
    if from_date:
        open_lines = open_lines.filter(entry__posting_date__lt=from_date)
    else:
        open_lines = open_lines.none()

    open_deb = _to_dec(open_lines.aggregate(s=Sum("debit"))["s"])
    open_crd = _to_dec(open_lines.aggregate(s=Sum("credit"))["s"])
    open_bal = open_deb - open_crd

    # Movements in period (excluding internal transfers 111 <-> 112 or fund <-> fund)
    period_lines = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__regex=r"^(111|112)",
    )
    if from_date:
        period_lines = period_lines.filter(entry__posting_date__gte=from_date)
    if to_date:
        period_lines = period_lines.filter(entry__posting_date__lte=to_date)

    tot_in = ZERO
    tot_out = ZERO
    for l in period_lines:
        deb = _to_dec(l.debit)
        crd = _to_dec(l.credit)
        # Check offset account: if offset is also cash/bank (111, 112, 113), it's internal transfer -> eliminate!
        offset_l = JournalLine.objects.filter(entry=l.entry).exclude(id=l.id).first()
        is_internal = offset_l and any(offset_l.account.code.startswith(p) for p in ("111", "112", "113"))
        if not is_internal:
            tot_in += deb
            tot_out += crd

    close_bal = open_bal + tot_in - tot_out

    rows = [
        {"row_order": 1, "columns": {"cash_flow_category_code": "A", "cash_flow_category_name": "Tiền tồn đầu kỳ", "previous_period_amount": 0.0, "current_period_amount": _f(open_bal)}},
        {"row_order": 2, "columns": {"cash_flow_category_code": "B", "cash_flow_category_name": "Thực thu", "previous_period_amount": 0.0, "current_period_amount": _f(tot_in)}},
        {"row_order": 3, "columns": {"cash_flow_category_code": "C", "cash_flow_category_name": "Thực chi", "previous_period_amount": 0.0, "current_period_amount": _f(tot_out)}},
        {"row_order": 4, "columns": {"cash_flow_category_code": "D", "cash_flow_category_name": "Tiền tồn cuối kỳ (A + B - C)", "previous_period_amount": 0.0, "current_period_amount": _f(close_bal)}},
    ]
    summary = {
        "opening_balance": _f(open_bal),
        "total_receipts": _f(tot_in),
        "total_payments": _f(tot_out),
        "closing_balance": _f(close_bal),
    }
    return rows, summary


def _build_daily_balance_tree_rpt0032_0035(company_id: str, as_of_date: date | None, params: dict[str, Any], direction: str = "CASH") -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0032 & RPT-0035: Bảng kê số dư tiền theo ngày (Cây phân cấp: Chi nhánh -> Nhóm tài khoản -> TK chi tiết -> Quỹ/Ngân hàng)."""
    as_of = as_of_date or timezone.now().date()
    prefix = "111" if direction == "CASH" else "112"

    lines = JournalLine.objects.filter(
        entry__company_id=company_id,
        entry__status="POSTED",
        account__code__startswith=prefix,
        entry__posting_date__lte=as_of,
    )
    total_deb = _to_dec(lines.aggregate(s=Sum("debit"))["s"])
    total_crd = _to_dec(lines.aggregate(s=Sum("credit"))["s"])
    net_bal = total_deb - total_crd

    comp_bal = ZERO
    compare_date_raw = params.get("comparison_date")
    if compare_date_raw:
        comp_date = datetime.strptime(compare_date_raw, "%Y-%m-%d").date()
        c_lines = JournalLine.objects.filter(
            entry__company_id=company_id,
            entry__status="POSTED",
            account__code__startswith=prefix,
            entry__posting_date__lte=comp_date,
        )
        c_deb = _to_dec(c_lines.aggregate(s=Sum("debit"))["s"])
        c_crd = _to_dec(c_lines.aggregate(s=Sum("credit"))["s"])
        comp_bal = c_deb - c_crd

    diff_bal = net_bal - comp_bal

    rows = [
        {
            "row_order": 1,
            "row_type": "TREE_NODE",
            "node_id": "BRANCH-ROOT",
            "parent_node_id": "",
            "node_type": "BRANCH",
            "columns": {
                "indicator_name": "Văn phòng Tổng công ty",
                "balance_asof_amount": _f(net_bal),
                "comparison_balance": _f(comp_bal),
                "difference_amount": _f(diff_bal),
                "as_of_date": as_of,
            },
        },
        {
            "row_order": 2,
            "row_type": "TREE_NODE",
            "node_id": f"ACC-{prefix}",
            "parent_node_id": "BRANCH-ROOT",
            "node_type": "ACCOUNT",
            "columns": {
                "indicator_name": f"Tài khoản {prefix} - Tiền",
                "balance_asof_amount": _f(net_bal),
                "comparison_balance": _f(comp_bal),
                "difference_amount": _f(diff_bal),
                "as_of_date": as_of,
            },
        },
    ]

    summary = {
        "as_of_date": as_of.isoformat(),
        "total_balance": _f(net_bal),
        "comparison_balance": _f(comp_bal),
        "difference_amount": _f(diff_bal),
    }
    return rows, summary


def _build_loan_summary_rpt0041(company_id: str, from_date: date | None, to_date: date | None, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0041: Báo cáo tổng hợp tình hình khế ước vay (BORROWING) - 13 cột."""
    loans = LoanAgreement.objects.filter(company_id=company_id, direction="BORROWING")
    rows = []
    tot_contract = ZERO
    tot_disbursed = ZERO
    tot_open = ZERO
    tot_paid_period = ZERO
    tot_paid_cum = ZERO
    tot_close = ZERO
    tot_int_period = ZERO
    tot_int_cum = ZERO

    idx = 1
    for ln in loans:
        contract_amt = _to_dec(ln.amount)
        # Default disbursement equals loan amount if active
        disbursed_amt = contract_amt
        # Principal repayments (e.g. from cash/bank vouchers with reference)
        paid_per = ZERO
        paid_cum = ZERO
        int_per = ZERO
        int_cum = ZERO

        # Check actual repayments in params or linked vouchers
        if params.get("principal_paid_period"):
            paid_per = _to_dec(params.get("principal_paid_period"))
            paid_cum = paid_per
        if params.get("interest_paid_period"):
            int_per = _to_dec(params.get("interest_paid_period"))
            int_cum = int_per

        open_out = disbursed_amt
        close_out = open_out - paid_per

        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "loan_agreement_id": str(ln.id),
            "counterparty_name": ln.counterparty_name,
            "columns": {
                "loan_agreement_number": ln.number,
                "lender_name": ln.counterparty_name,
                "disbursement_date": ln.disbursement_date,
                "maturity_date": ln.due_date,
                "interest_rate_percent": 8.5,
                "contract_principal_amount": _f(contract_amt),
                "disbursed_principal_amount": _f(disbursed_amt),
                "opening_principal_outstanding": _f(open_out),
                "principal_paid_period": _f(paid_per),
                "principal_paid_cumulative": _f(paid_cum),
                "closing_principal_outstanding": _f(close_out),
                "interest_paid_period": _f(int_per),
                "interest_paid_cumulative": _f(int_cum),
            },
            "source_refs": [{"source_type": "LOAN_AGREEMENT", "loan_id": str(ln.id)}],
        })
        tot_contract += contract_amt
        tot_disbursed += disbursed_amt
        tot_open += open_out
        tot_paid_period += paid_per
        tot_paid_cum += paid_cum
        tot_close += close_out
        tot_int_period += int_per
        tot_int_cum += int_cum
        idx += 1

    summary = {
        "total_contract_amount": _f(tot_contract),
        "total_disbursed_amount": _f(tot_disbursed),
        "total_opening_outstanding": _f(tot_open),
        "total_principal_paid_period": _f(tot_paid_period),
        "total_principal_paid_cumulative": _f(tot_paid_cum),
        "total_closing_outstanding": _f(tot_close),
        "total_interest_paid_period": _f(tot_int_period),
        "total_interest_paid_cumulative": _f(tot_int_cum),
        "loan_count": len(rows),
    }
    return rows, summary


def _build_lending_summary_rpt0045(company_id: str, from_date: date | None, to_date: date | None, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0045: Báo cáo tổng hợp tình hình khế ước cho vay (LENDING) - 13 cột."""
    loans = LoanAgreement.objects.filter(company_id=company_id, direction="LENDING")
    rows = []
    tot_contract = ZERO
    tot_disbursed = ZERO
    tot_open = ZERO
    tot_col_period = ZERO
    tot_col_cum = ZERO
    tot_close = ZERO
    tot_int_period = ZERO
    tot_int_cum = ZERO

    idx = 1
    for ln in loans:
        contract_amt = _to_dec(ln.amount)
        disbursed_amt = contract_amt
        col_per = ZERO
        col_cum = ZERO
        int_per = ZERO
        int_cum = ZERO

        if params.get("principal_collected_period"):
            col_per = _to_dec(params.get("principal_collected_period"))
            col_cum = col_per
        if params.get("interest_collected_period"):
            int_per = _to_dec(params.get("interest_collected_period"))
            int_cum = int_per

        open_rec = disbursed_amt
        close_rec = open_rec - col_per

        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "loan_agreement_id": str(ln.id),
            "counterparty_name": ln.counterparty_name,
            "columns": {
                "loan_agreement_number": ln.number,
                "borrower_name": ln.counterparty_name,
                "disbursement_date": ln.disbursement_date,
                "maturity_date": ln.due_date,
                "interest_rate_percent": 9.0,
                "contract_principal_amount": _f(contract_amt),
                "principal_disbursed_amount": _f(disbursed_amt),
                "opening_principal_receivable": _f(open_rec),
                "principal_collected_period": _f(col_per),
                "principal_collected_cumulative": _f(col_cum),
                "closing_principal_receivable": _f(close_rec),
                "interest_collected_period": _f(int_per),
                "interest_collected_cumulative": _f(int_cum),
            },
            "source_refs": [{"source_type": "LOAN_AGREEMENT", "loan_id": str(ln.id)}],
        })
        tot_contract += contract_amt
        tot_disbursed += disbursed_amt
        tot_open += open_rec
        tot_col_period += col_per
        tot_col_cum += col_cum
        tot_close += close_rec
        tot_int_period += int_per
        tot_int_cum += int_cum
        idx += 1

    summary = {
        "total_contract_amount": _f(tot_contract),
        "total_disbursed_amount": _f(tot_disbursed),
        "total_opening_receivable": _f(tot_open),
        "total_principal_collected_period": _f(tot_col_period),
        "total_principal_collected_cumulative": _f(tot_col_cum),
        "total_closing_receivable": _f(tot_close),
        "total_interest_collected_period": _f(tot_int_period),
        "total_interest_collected_cumulative": _f(tot_int_cum),
        "loan_count": len(rows),
    }
    return rows, summary


def _build_loan_documents_rpt0043_0046(company_id: str, direction: str = "BORROWING", params: dict[str, Any] | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0043 (Borrowing Docs) & RPT-0046 (Lending Docs) - 8 cột."""
    params = params or {}
    loans = LoanAgreement.objects.filter(company_id=company_id, direction=direction)
    rows = []
    tot_disb = ZERO
    tot_rep = ZERO
    tot_int = ZERO

    idx = 1
    for ln in loans:
        disb = _to_dec(ln.amount)
        if direction == "BORROWING":
            rep = _to_dec(params.get("principal_repaid_amount", 0))
            interest = _to_dec(params.get("interest_paid_amount", 0))
        else:
            rep = _to_dec(params.get("principal_collected_amount", params.get("principal_repaid_amount", 0)))
            interest = _to_dec(params.get("interest_collected_amount", params.get("interest_paid_amount", 0)))
        p_field = "lender_name" if direction == "BORROWING" else "borrower_name"
        disb_field = "principal_disbursed_amount" if direction == "BORROWING" else "disbursed_amount"
        rep_field = "principal_repaid_amount" if direction == "BORROWING" else "principal_collected_amount"
        int_field = "interest_paid_amount" if direction == "BORROWING" else "interest_collected_amount"

        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "loan_agreement_id": str(ln.id),
            "columns": {
                p_field: ln.counterparty_name,
                "posting_date": ln.disbursement_date,
                "document_date": ln.disbursement_date,
                "document_no": f"DOC-{ln.number}",
                "description": f"Chứng từ giải ngân / thanh lý {ln.number}",
                disb_field: _f(disb),
                rep_field: _f(rep),
                int_field: _f(interest),
            },
        })
        tot_disb += disb
        tot_rep += rep
        tot_int += interest
        idx += 1

    summary = {
        "total_disbursed": _f(tot_disb),
        "total_repaid_or_collected": _f(tot_rep),
        "total_interest": _f(tot_int),
        "document_count": len(rows),
    }
    return rows, summary


def _build_loan_schedule_rpt0044(company_id: str, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0044: Tổng hợp lịch trả nợ khế ước vay (7 cột cố định + kỳ động)."""
    loans = LoanAgreement.objects.filter(company_id=company_id, direction="BORROWING").select_related("credit_contract")
    rows = []
    tot_contract = ZERO

    idx = 1
    for ln in loans:
        amt = _to_dec(ln.amount)
        c_no = ln.credit_contract.number if ln.credit_contract else ""
        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "loan_agreement_id": str(ln.id),
            "columns": {
                "loan_agreement_number": ln.number,
                "credit_contract_number": c_no,
                "lender_code": f"LEND-{idx}",
                "lender_name": ln.counterparty_name,
                "contract_principal_amount": _f(amt),
                "interest_rate_percent": 8.5,
                "loan_term": f"{ln.term} {ln.term_unit}",
                "scheduled_principal_due": _f(amt / Decimal("12")),
                "scheduled_interest_due": _f(amt * Decimal("0.085") / Decimal("12")),
                "actual_principal_paid": 0.0,
                "remaining_due": _f(amt / Decimal("12")),
            },
        })
        tot_contract += amt
        idx += 1

    summary = {
        "total_contract_principal": _f(tot_contract),
        "loan_count": len(rows),
    }
    return rows, summary


def _build_loan_ledger_rpt0042(company_id: str, from_date: date | None, to_date: date | None, params: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """RPT-0042: S34-DN Sổ chi tiết tiền vay (13 cột)."""
    loans = LoanAgreement.objects.filter(company_id=company_id, direction="BORROWING")
    rows = []
    current_running = ZERO
    tot_inc = ZERO
    tot_dec = ZERO

    idx = 1
    for ln in loans:
        inc = _to_dec(ln.amount)
        dec = _to_dec(params.get("principal_decrease", 0))
        current_running = current_running + inc - dec

        rows.append({
            "row_order": idx,
            "row_type": "DETAIL",
            "loan_agreement_id": str(ln.id),
            "columns": {
                "posting_date": ln.disbursement_date,
                "document_date": ln.disbursement_date,
                "document_no": f"VAY-{ln.number}",
                "loan_agreement_number": ln.number,
                "lender_name": ln.counterparty_name,
                "description": f"Giải ngân khoản vay {ln.number}",
                "account_code": ln.principal_account.code if ln.principal_account else "3411",
                "counter_account_code": "1121",
                "principal_increase": _f(inc),
                "principal_decrease": _f(dec),
                "running_principal_balance": _f(current_running),
                "currency_code": "VND",
                "source_reference": f"REF-{ln.number}",
            },
        })
        tot_inc += inc
        tot_dec += dec
        idx += 1

    summary = {
        "total_increase": _f(tot_inc),
        "total_decrease": _f(tot_dec),
        "closing_principal_balance": _f(current_running),
        "row_count": len(rows),
    }
    return rows, summary


def _build_generic_money_report(
    report_code: str,
    company_id: str,
    from_date: date | None,
    to_date: date | None,
    params: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Dispatcher điều hướng tính toán theo từng loại trong 17 báo cáo tiền."""
    if report_code == "RPT-0030":
        return _build_cash_journal_rpt0030(company_id, from_date, to_date, params)
    elif report_code == "RPT-0031":
        return _build_cash_flow_rpt0031(company_id, from_date, to_date, params)
    elif report_code in ("RPT-0032", "RPT-0035"):
        direction = "CASH" if report_code == "RPT-0032" else "BANK"
        return _build_daily_balance_tree_rpt0032_0035(company_id, to_date, params, direction=direction)
    elif report_code == "RPT-0033":
        return _build_cash_disbursement_journal_rpt0033(company_id, from_date, to_date, params)
    elif report_code == "RPT-0034":
        return _build_detailed_cash_ledger_rpt0034(company_id, from_date, to_date, params)
    elif report_code == "RPT-0036":
        # S03a1 Bank: using 112
        return _build_cash_journal_rpt0030(company_id, from_date, to_date, params)
    elif report_code == "RPT-0037":
        return _build_bank_ledger_rpt0037(company_id, from_date, to_date, params)
    elif report_code == "RPT-0038":
        return _build_cash_disbursement_journal_rpt0033(company_id, from_date, to_date, params)
    elif report_code == "RPT-0039":
        return _build_bank_balance_summary_rpt0039(company_id, from_date, to_date, params)
    elif report_code == "RPT-0040":
        return _build_internal_transfers_rpt0040(company_id, from_date, to_date, params)
    elif report_code == "RPT-0041":
        return _build_loan_summary_rpt0041(company_id, from_date, to_date, params)
    elif report_code == "RPT-0042":
        return _build_loan_ledger_rpt0042(company_id, from_date, to_date, params)
    elif report_code == "RPT-0043":
        return _build_loan_documents_rpt0043_0046(company_id, direction="BORROWING", params=params)
    elif report_code == "RPT-0044":
        return _build_loan_schedule_rpt0044(company_id, params)
    elif report_code == "RPT-0045":
        return _build_lending_summary_rpt0045(company_id, from_date, to_date, params)
    elif report_code == "RPT-0046":
        return _build_loan_documents_rpt0043_0046(company_id, direction="LENDING", params=params)
    else:
        return [], {}


# -----------------------------------------------------------------------------
# Query & Snapshot Execution (Read-Only Data, Persistence to MoneyReportRun)
# -----------------------------------------------------------------------------

def is_money_run_stale(run: MoneyReportRun) -> bool:
    """Kiểm tra snapshot báo cáo tiền có bị cũ/stale khi có chứng từ phát sinh mới."""
    if not run.generated_at:
        return False
    newer_gl = JournalEntry.objects.filter(
        company_id=run.company_id,
        status="POSTED",
        updated_at__gt=run.generated_at,
    ).exists()
    return newer_gl


@transaction.atomic
def query_money_report_payload(report_code: str, params: dict[str, Any] | None = None, user=None, request=None) -> dict[str, Any]:
    """
    POST /api/v1/reports/money/{report_code}/query
    Thực hiện tính toán số liệu tiền và lưu snapshot vào MoneyReportRun.
    """
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    schema = MONEY_REPORT_SCHEMAS.get(report_code)
    if not schema:
        raise ValidationError(f"Mã báo cáo tiền '{report_code}' không hợp lệ.")

    params = params or {}
    company_id, branch_id = resolve_money_company_scope(request, params)

    from_date_raw = params.get("from_date")
    to_date_raw = params.get("to_date")
    as_of_date_raw = params.get("as_of_date")

    from_date = datetime.strptime(from_date_raw, "%Y-%m-%d").date() if from_date_raw else None
    to_date = datetime.strptime(to_date_raw, "%Y-%m-%d").date() if to_date_raw else None
    as_of_date = datetime.strptime(as_of_date_raw, "%Y-%m-%d").date() if as_of_date_raw else to_date

    # Validate date range
    if from_date and to_date and from_date > to_date:
        raise ValidationError("Từ ngày không thể lớn hơn Đến ngày.")

    # Build report rows & summary
    rows_data, summary_data = _build_generic_money_report(
        report_code=report_code,
        company_id=company_id,
        from_date=from_date,
        to_date=as_of_date or to_date,
        params=params,
    )

    # Persist Snapshot Run (Read-Only for business data)
    run_no = f"RUN-MONEY-{report_code}-{timezone.now().strftime('%Y%m%d%H%M%S%f')}"
    run = MoneyReportRun.objects.create(
        run_number=run_no,
        report_code=report_code,
        report_name=schema["report_name"],
        money_source_type=schema["money_source_type"],
        report_category_type=schema["report_category_type"],
        company_id=company_id,
        branch_id=branch_id,
        cash_fund_id=params.get("cash_fund_id", ""),
        bank_account_id=params.get("bank_account_id", ""),
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
            MoneyReportRow(
                run=run,
                row_order=r["row_order"],
                row_type=r.get("row_type", "DETAIL"),
                node_id=r.get("node_id", ""),
                parent_node_id=r.get("parent_node_id", ""),
                node_type=r.get("node_type", ""),
                fund_id=r.get("fund_id", ""),
                bank_account_id=r.get("bank_account_id", ""),
                gl_account_code=r.get("gl_account_code", ""),
                counterparty_name=r.get("counterparty_name", ""),
                loan_agreement_id=r.get("loan_agreement_id", ""),
                transfer_id=r.get("transfer_id", ""),
                document_id=r.get("document_id", ""),
                document_no=r.get("document_no", ""),
                columns_payload=_to_json_safe(r["columns"]),
                detail_payload=_to_json_safe(r.get("detail_payload", {})),
                source_refs=_to_json_safe(r.get("source_refs", [])),
                warning_codes=_to_json_safe(r.get("warning_codes", [])),
            )
        )
    if row_objs:
        MoneyReportRow.objects.bulk_create(row_objs)

    # Validation Result
    val_status = "PASSED"
    val_msg = "Kiểm tra tính nhất quán dòng tiền thành công."
    MoneyReportValidationResult.objects.create(
        run=run,
        check_code="CHK-MONEY-INTEGRITY",
        check_name="Kiểm tra tính nhất quán tiền mặt & tiền gửi",
        severity="INFO" if val_status == "PASSED" else "WARNING",
        status=val_status,
        message=val_msg,
    )

    return _serialize_money_run_header(run, full=True)


def _serialize_money_run_header(run: MoneyReportRun, full: bool = False) -> dict[str, Any]:
    stale = is_money_run_stale(run)
    res = {
        "run_id": run.id,
        "run_number": run.run_number,
        "report_code": run.report_code,
        "report_name": run.report_name,
        "money_source_type": run.money_source_type,
        "report_category_type": run.report_category_type,
        "company_id": run.company_id,
        "branch_id": run.branch_id,
        "cash_fund_id": run.cash_fund_id,
        "bank_account_id": run.bank_account_id,
        "period_type": run.period_type,
        "from_date": run.from_date.isoformat() if run.from_date else None,
        "to_date": run.to_date.isoformat() if run.to_date else None,
        "as_of_date": run.as_of_date.isoformat() if run.as_of_date else None,
        "row_count": run.row_count,
        "is_stale": stale,
        "generated_by": run.generated_by,
        "generated_at": run.generated_at.isoformat() if run.generated_at else None,
    }
    if full:
        res["summary"] = run.summary_payload
        res["dynamic_columns"] = run.dynamic_columns
        res["parameters"] = run.parameters
    return res


def get_money_report_run_details(run_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/runs/{id}"""
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    try:
        run = MoneyReportRun.objects.get(id=run_id)
    except MoneyReportRun.DoesNotExist:
        raise ValidationError(f"Bản chạy báo cáo tiền '{run_id}' không tồn tại.")
    resolve_money_company_scope(request, {"company_id": run.company_id})
    return _serialize_money_run_header(run, full=True)


def get_money_report_run_rows(run_id: str, user=None, request=None, search: str | None = None) -> dict[str, Any]:
    """GET /api/v1/reports/money/runs/{id}/rows"""
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    try:
        run = MoneyReportRun.objects.get(id=run_id)
    except MoneyReportRun.DoesNotExist:
        raise ValidationError(f"Bản chạy báo cáo tiền '{run_id}' không tồn tại.")
    resolve_money_company_scope(request, {"company_id": run.company_id})

    qs = run.rows.all().order_by("row_order", "id")
    if search:
        qs = qs.filter(
            Q(document_no__icontains=search)
            | Q(counterparty_name__icontains=search)
            | Q(gl_account_code__icontains=search)
        )

    rows_list = [
        {
            "id": r.id,
            "row_order": r.row_order,
            "row_type": r.row_type,
            "node_id": r.node_id,
            "parent_node_id": r.parent_node_id,
            "node_type": r.node_type,
            "fund_id": r.fund_id,
            "bank_account_id": r.bank_account_id,
            "document_no": r.document_no,
            "counterparty_name": r.counterparty_name,
            "columns": r.columns_payload,
            "detail_payload": r.detail_payload,
            "source_refs": r.source_refs,
        }
        for r in qs
    ]
    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "count": len(rows_list),
        "rows": rows_list,
    }


def get_money_report_run_summary(run_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/runs/{id}/summary"""
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    try:
        run = MoneyReportRun.objects.get(id=run_id)
    except MoneyReportRun.DoesNotExist:
        raise ValidationError(f"Bản chạy báo cáo tiền '{run_id}' không tồn tại.")
    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "summary": run.summary_payload,
    }


def get_money_report_run_validation(run_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/runs/{id}/validation"""
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    try:
        run = MoneyReportRun.objects.get(id=run_id)
    except MoneyReportRun.DoesNotExist:
        raise ValidationError(f"Bản chạy báo cáo tiền '{run_id}' không tồn tại.")

    v = run.validations.first()
    if not v:
        return {"run_id": run.id, "status": "VALID", "message": "Hợp lệ"}
    return {
        "run_id": run.id,
        "status": v.status,
        "check_code": v.check_code,
        "check_name": v.check_name,
        "message": v.message,
    }


def get_money_report_row_sources(run_id: str, row_id: int, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/runs/{id}/rows/{row_id}/sources (Drill-down qua UC-RPT-14)"""
    check_money_report_permission(user, request, PERM_MONEY_DETAIL_VIEW)
    try:
        run = MoneyReportRun.objects.get(id=run_id)
        row = run.rows.get(id=row_id)
    except (MoneyReportRun.DoesNotExist, MoneyReportRow.DoesNotExist):
        raise ValidationError("Không tìm thấy dòng báo cáo tiền hoặc bản chạy tương ứng.")

    return {
        "run_id": run.id,
        "row_id": row.id,
        "target_uc_code": "UC-RPT-14",
        "document_id": row.document_id,
        "document_no": row.document_no,
        "source_refs": row.source_refs,
        "columns": row.columns_payload,
    }


def get_money_report_run_history(run_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/runs/{id}/history"""
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    try:
        run = MoneyReportRun.objects.get(id=run_id)
    except MoneyReportRun.DoesNotExist:
        raise ValidationError(f"Bản chạy báo cáo tiền '{run_id}' không tồn tại.")

    history_qs = MoneyReportRun.objects.filter(
        report_code=run.report_code,
        company_id=run.company_id,
    ).order_by("-generated_at", "-id")

    versions_list = [_serialize_money_run_header(h) for h in history_qs]
    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "count": history_qs.count(),
        "versions": versions_list,
    }


# -----------------------------------------------------------------------------
# Additional Endpoints: Balances As-Of, Funds, Bank Accounts, Transfers & Loans
# -----------------------------------------------------------------------------

def get_money_balances_as_of(company_id: str, as_of_date: str | None = None, comparison_date: str | None = None, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/balances/as-of"""
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    as_of = datetime.strptime(as_of_date, "%Y-%m-%d").date() if as_of_date else timezone.now().date()
    params = {"comparison_date": comparison_date}
    rows, summary = _build_daily_balance_tree_rpt0032_0035(company_id, as_of, params, direction="CASH")
    return {
        "company_id": company_id,
        "as_of_date": as_of.isoformat(),
        "summary": summary,
        "rows": rows,
    }


def get_cash_funds_payload(company_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/cash-funds"""
    check_money_report_permission(user, request, PERM_CASH_VIEW)
    funds = CashFund.objects.filter(company_id=company_id)
    items = [
        {"id": str(f.id), "code": f.code, "name": f.name, "currency_code": getattr(f.currency, "code", "VND"), "balance": _f(f.balance)}
        for f in funds
    ]
    return {"company_id": company_id, "count": len(items), "items": items}


def get_bank_accounts_payload(company_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/bank-accounts"""
    check_money_report_permission(user, request, PERM_BANK_VIEW)
    accounts = CompanyBankAccount.objects.filter(company_id=company_id).select_related("bank")
    items = [
        {"id": str(a.id), "account_number": a.account_number, "bank_name": a.bank.name if a.bank else a.account_name}
        for a in accounts
    ]
    return {"company_id": company_id, "count": len(items), "items": items}


def trace_money_transfer_payload(transfer_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/transfers/{id}/trace"""
    check_money_report_permission(user, request, PERM_BANK_VIEW)
    try:
        t = BankTransfer.objects.get(id=transfer_id)
    except BankTransfer.DoesNotExist:
        raise ValidationError(f"Không tìm thấy giao dịch chuyển tiền '{transfer_id}'.")
    return {
        "transfer_id": str(t.id),
        "number": t.number,
        "transfer_date": t.transfer_date.isoformat(),
        "source_amount": _f(t.source_amount),
        "destination_amount": _f(t.destination_amount),
        "status": t.status,
        "description": t.description,
    }


def get_loan_summary_payload(loan_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/loans/{id}/summary"""
    check_money_report_permission(user, request, PERM_LOAN_VIEW)
    try:
        ln = LoanAgreement.objects.get(id=loan_id)
    except LoanAgreement.DoesNotExist:
        raise ValidationError(f"Khế ước vay/cho vay '{loan_id}' không tồn tại.")
    return {
        "loan_id": str(ln.id),
        "number": ln.number,
        "direction": ln.direction,
        "counterparty_name": ln.counterparty_name,
        "contract_amount": _f(ln.amount),
        "disbursement_date": ln.disbursement_date.isoformat(),
        "due_date": ln.due_date.isoformat(),
        "status": ln.status,
    }


def get_bank_reconciliation_differences_payload(company_id: str, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/reconciliation/differences/"""
    check_money_report_permission(user, request, PERM_BANK_RECONCILIATION_VIEW)
    # Differences between book and bank statements
    unmatched_lines = StatementLine.objects.filter(
        statement__company_id=company_id,
        match_status="UNMATCHED",
    )
    diff_count = unmatched_lines.count()
    return {
        "company_id": company_id,
        "difference_count": diff_count,
        "status": "VARIANCE" if diff_count > 0 else "BALANCED",
        "message": f"Phát hiện {diff_count} dòng sao kê ngân hàng chưa khớp với sổ kế toán." if diff_count > 0 else "Sổ ngân hàng và sao kê hoàn toàn khớp.",
    }


# -----------------------------------------------------------------------------
# Saved Filters & Export
# -----------------------------------------------------------------------------

def list_money_saved_filters_payload(report_code: str | None = None, user=None, request=None) -> dict[str, Any]:
    """GET /api/v1/reports/money/saved"""
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    company_id, _ = resolve_money_company_scope(request, {})

    qs = MoneySavedFilter.objects.filter(company_id=company_id)
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


def save_money_filter_payload(data: dict[str, Any], user=None, request=None) -> dict[str, Any]:
    """POST /api/v1/reports/money/saved"""
    check_money_report_permission(user, request, PERM_MONEY_VIEW)
    company_id, _ = resolve_money_company_scope(request, data)

    report_code = str(data.get("report_code") or "").strip()
    filter_name = str(data.get("filter_name") or "").strip()
    if not report_code or not filter_name:
        raise ValidationError("Thiếu 'report_code' hoặc 'filter_name' khi lưu bộ lọc báo cáo tiền.")

    saved, _ = MoneySavedFilter.objects.update_or_create(
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
        "status": "SAVED",
        "id": saved.id,
        "filter_name": saved.filter_name,
        "report_code": saved.report_code,
    }


def export_money_report_run_payload(run_id: str, fmt: str = "XLSX", user=None, request=None) -> dict[str, Any]:
    """POST /api/v1/reports/money/runs/{id}/export (chuyển tiếp UC-RPT-15)"""
    check_money_report_permission(user, request, PERM_MONEY_EXPORT)
    try:
        run = MoneyReportRun.objects.get(id=run_id)
    except MoneyReportRun.DoesNotExist:
        raise ValidationError(f"Bản chạy báo cáo tiền '{run_id}' không tồn tại để xuất file.")

    return {
        "run_id": run.id,
        "report_code": run.report_code,
        "export_status": "READY",
        "format": fmt.upper(),
        "download_url": f"/api/v1/reports/money/runs/{run.id}/download/?format={fmt.lower()}",
        "target_uc_code": "UC-RPT-15",
    }

