"""
UC-RPT-06 – Xem thuyết minh báo cáo tài chính (B09-DN, B09-DNKLT, B09a-DN)
Architecture:
Template B09 -> Section/Note Definitions -> Content Schemas -> GL/ERP + Confirmed Manual Content
-> Note Content Snapshot -> Validation/Cross-Reference (B01/B02/B03) -> Statement Run -> UI -> Drill-down/Export.
"""

from __future__ import annotations

import hashlib
import html
import re
import unicodedata
import uuid
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.db import transaction
from django.db.models import Max, Q, Sum
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
from master_data.models import Currency, Party
from organization.models import Branch, Company
from reporting.models import (
    CashEquivalentInstrument,
    CashFlowClassification,
    CashFlowEvent,
    FinancialNoteContent,
    FinancialNoteItem,
    FinancialNoteReference,
    FinancialNoteSection,
    FinancialNoteTable,
    FinancialNoteTableRow,
    FinancialNoteValidationResult,
    FinancialStatementAccountMapping,
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
SCRIPT_TAG_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>|javascript\s*:|on\w+\s*=", re.IGNORECASE | re.DOTALL)


def _to_dec(val: Any) -> Decimal:
    if val is None or val == "":
        return ZERO
    if isinstance(val, Decimal):
        return val.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    try:
        return Decimal(str(val)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    except Exception:
        return ZERO


def _fmt_dec(val: Decimal | None) -> str | None:
    if val is None:
        return None
    return str(val.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))


def _strip_accents(text: str) -> str:
    if not text:
        return ""
    norm = unicodedata.normalize("NFD", str(text))
    stripped = "".join(ch for ch in norm if unicodedata.category(ch) != "Mn")
    cleaned = stripped.replace("đ", "d").replace("Đ", "D").lower()
    for p in (",", ";", ":", "(", ")", "-"):
        cleaned = cleaned.replace(p, " ")
    return " ".join(cleaned.split())


def sanitize_note_text(raw_text: str | None) -> tuple[str, bool]:
    """
    Sanitizes note text/narrative against unsafe HTML/script injection (BR-RPT-B09-94, EF-34, TC-RPT-06-77).
    Returns (sanitized_text, had_unsafe_markup).
    """
    if raw_text is None:
        return "", False
    s = str(raw_text)
    had_unsafe = bool(SCRIPT_TAG_RE.search(s) or "<script" in s.lower() or "onerror=" in s.lower() or "onload=" in s.lower())
    if had_unsafe:
        cleaned = SCRIPT_TAG_RE.sub("[REMOVED_UNSAFE_SCRIPT]", s)
        cleaned = html.escape(cleaned)
        return cleaned, True
    return s, False


# ============================================================================
# 1. PERMISSIONS & RBAC DEFINITIONS (UC-RPT-06)
# ============================================================================

B09_PERMISSIONS_DEF = (
    ("VIEW", "Xem thuyết minh BCTC (B09)", "RPT_FINANCIAL_NOTES_VIEW", "RPT.FINANCIAL_NOTES.VIEW"),
    ("DETAIL_VIEW", "Xem nguồn chi tiết & drill-down B09", "RPT_FINANCIAL_NOTES_DETAIL_VIEW", "RPT.FINANCIAL_NOTES.DETAIL_VIEW"),
    ("PREPARE", "Chuẩn bị và cập nhật thuyết minh B09", "RPT_FINANCIAL_NOTES_PREPARE", "RPT.FINANCIAL_NOTES.PREPARE"),
    ("REVIEW", "Rà soát và kiểm tra thuyết minh B09", "RPT_FINANCIAL_NOTES_REVIEW", "RPT.FINANCIAL_NOTES.REVIEW"),
    ("APPROVE", "Phê duyệt thuyết minh B09", "RPT_FINANCIAL_NOTES_APPROVE", "RPT.FINANCIAL_NOTES.APPROVE"),
    ("EXPORT", "In và xuất thuyết minh B09", "RPT_FINANCIAL_NOTES_EXPORT", "RPT.FINANCIAL_NOTES.EXPORT"),
)

B09_PERMISSION_ALIASES: dict[str, set[str]] = {
    "RPT_FINANCIAL_NOTES_VIEW": {
        "RPT_FINANCIAL_NOTES_VIEW",
        "RPT.FINANCIAL_NOTES.VIEW",
        "RPT_FINANCIAL_VIEW",
        "RPT.FINANCIAL.VIEW",
        "RPT.CENTER.VIEW",
    },
    "RPT_FINANCIAL_NOTES_DETAIL_VIEW": {
        "RPT_FINANCIAL_NOTES_DETAIL_VIEW",
        "RPT.FINANCIAL_NOTES.DETAIL_VIEW",
        "RPT_FINANCIAL_DETAIL_VIEW",
        "RPT.FINANCIAL.DETAIL.VIEW",
        "GL.JOURNAL.VIEW",
    },
    "RPT_FINANCIAL_NOTES_PREPARE": {
        "RPT_FINANCIAL_NOTES_PREPARE",
        "RPT.FINANCIAL_NOTES.PREPARE",
        "RPT_FINANCIAL_GENERATE",
        "RPT.FINANCIAL.GENERATE",
    },
    "RPT_FINANCIAL_NOTES_REVIEW": {
        "RPT_FINANCIAL_NOTES_REVIEW",
        "RPT.FINANCIAL_NOTES.REVIEW",
        "RPT_FINANCIAL_NOTES_PREPARE",
        "RPT.FINANCIAL_NOTES.PREPARE",
        "RPT_FINANCIAL_GENERATE",
        "RPT.FINANCIAL.GENERATE",
    },
    "RPT_FINANCIAL_NOTES_APPROVE": {
        "RPT_FINANCIAL_NOTES_APPROVE",
        "RPT.FINANCIAL_NOTES.APPROVE",
        "RPT_FINANCIAL_APPROVE",
        "RPT.FINANCIAL.APPROVE",
    },
    "RPT_FINANCIAL_NOTES_EXPORT": {
        "RPT_FINANCIAL_NOTES_EXPORT",
        "RPT.FINANCIAL_NOTES.EXPORT",
        "RPT_FINANCIAL_EXPORT",
        "RPT.FINANCIAL.EXPORT",
    },
}


# ============================================================================
# 2. LEGAL SECTIONS & NOTE ITEMS SPECIFICATIONS (TT99 PHỤ LỤC IV)
# ============================================================================
# B09-DN & B09-DNKLT: 9 Sections preserved with exact Roman numerals I, II, III, IV, V, VII, VIII, IX, X (no VI!)
# B09a-DN: 5 Sections preserved with exact Roman numerals I, II, III, IV, VI (no V!)

B09_DN_SECTIONS_SPEC = [
    ("I", "I. Đặc điểm hoạt động của doanh nghiệp", 10, True),
    ("II", "II. Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán", 20, True),
    ("III", "III. Chuẩn mực và chế độ kế toán áp dụng", 30, True),
    ("IV", "IV. Chính sách kế toán, ước tính kế toán và quy định liên quan", 40, True),
    ("V", "V. Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo tình hình tài chính", 50, True),
    ("VII", "VII. Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo kết quả hoạt động kinh doanh", 70, True),
    ("VIII", "VIII. Thông tin bổ sung cho các khoản mục trình bày trong Báo cáo lưu chuyển tiền tệ", 80, True),
    ("IX", "IX. Những thông tin khác", 90, True),
    ("X", "X. Nội dung sửa đổi, bổ sung biểu mẫu/chỉ tiêu Báo cáo tài chính (nếu có)", 100, False),
]

B09A_DN_SECTIONS_SPEC = [
    ("I", "I. Đặc điểm hoạt động của doanh nghiệp", 10, True),
    ("II", "II. Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán", 20, True),
    ("III", "III. Chuẩn mực và chế độ kế toán áp dụng", 30, True),
    ("IV", "IV. Các chính sách kế toán áp dụng", 40, True),
    ("VI", "VI. Các sự kiện hoặc giao dịch trọng yếu giữa niên độ", 60, True),
]

# Section I – 9 items (I.1 .. I.9)
SECTION_I_ITEMS_SPEC = [
    ("I.1", "1. Hình thức sở hữu vốn", "MIXED", "MIXED", "ORG", "", [], True, {"fields": ["ownership_form", "ownership_description"]}),
    ("I.2", "2. Lĩnh vực kinh doanh", "TEXT", "MIXED", "ORG", "", [], True, {"fields": ["business_sector", "sector_description"]}),
    ("I.3", "3. Ngành nghề kinh doanh", "TABLE", "MIXED", "ORG", "", [], True, {"fields": ["business_activity_code", "business_activity_name", "is_primary"]}),
    ("I.4", "4. Chu kỳ sản xuất, kinh doanh thông thường", "MIXED", "MIXED", "ORG", "", [], True, {"fields": ["operating_cycle_months", "cycle_description", "industry_average_if_required"]}),
    ("I.5", "5. Đặc điểm hoạt động của doanh nghiệp trong năm tài chính có ảnh hưởng đến Báo cáo tài chính", "MIXED", "MANUAL", "MANUAL", "", [], False, {"fields": ["event_type", "event_date", "description", "financial_impact", "source_reference"]}),
    ("I.6", "6. Cấu trúc doanh nghiệp", "REPEATABLE_GROUP", "MANUAL", "ORG", "", [], False, {"fields": ["entity_id", "entity_name", "entity_type", "ownership_percentage", "voting_percentage", "country", "business_activity", "effective_date", "status", "source_reference"]}),
    ("I.7", "7. Số lượng lao động", "MIXED", "MANUAL", "HR", "", [], False, {"fields": ["employee_count_end_period", "average_employee_count", "measurement_basis"]}),
    ("I.8", "8. Tuyên bố về khả năng so sánh thông tin trên Báo cáo tài chính", "MIXED", "MANUAL", "RPT", "", [], True, {"fields": ["is_comparable", "reason", "restatement_reference", "impact_description"]}),
    ("I.9", "9. Thông tin khác theo quy định pháp luật liên quan", "TEXT", "MANUAL", "MANUAL", "", [], False, {"fields": ["requirement_code", "content", "legal_reference", "source_reference"]}),
]

# Section II – 2 items (II.1 .. II.2)
SECTION_II_ITEMS_SPEC = [
    ("II.1", "1. Kỳ kế toán năm", "MIXED", "AUTO", "GL", "", [], True, {"fields": ["fiscal_year_start_date", "fiscal_year_end_date", "period_description"]}),
    ("II.2", "2. Đơn vị tiền tệ sử dụng trong kế toán", "MIXED", "AUTO", "GL", "", [], True, {"fields": ["accounting_currency_code", "previous_currency_code", "has_currency_changed", "change_reason", "financial_impact"]}),
]

# Section III – 2 items (III.1 .. III.2)
SECTION_III_ITEMS_SPEC = [
    ("III.1", "1. Chế độ kế toán áp dụng", "MIXED", "AUTO", "RPT", "", [], True, {"fields": ["accounting_regime_code", "legal_basis", "effective_from", "description"]}),
    ("III.2", "2. Tuyên bố về việc tuân thủ Chuẩn mực kế toán và Chế độ kế toán", "MIXED", "MANUAL", "RPT", "", [], True, {"fields": ["compliance_statement", "compliance_status", "exception_details", "confirmed_by", "confirmed_at"]}),
]

# Section IV – 29 Accounting Policies (IV.1 .. IV.29)
SECTION_IV_29_ITEMS_SPEC = [
    ("IV.1", "1. Nguyên tắc chuyển đổi Báo cáo tài chính lập bằng ngoại tệ sang Đồng Việt Nam", "TEXT", "MANUAL", "GL", "", [], False, {"fields": ["translation_basis", "translation_method", "translation_impact"]}),
    ("IV.2", "2. Các loại tỷ giá hối đoái áp dụng trong kế toán", "TEXT", "MIXED", "GL", "", [], True, {"fields": ["transaction_fx_policy", "revaluation_fx_policy", "cross_rate_policy", "monetary_gold_price_basis"]}),
    ("IV.3", "3. Nguyên tắc xác định lãi suất thực tế (lãi suất hiệu lực) dùng để chiết khấu dòng tiền", "TEXT", "MANUAL", "GL", "", [], False, {"fields": ["effective_interest_method", "discount_rate_basis"]}),
    ("IV.4", "4. Nguyên tắc ghi nhận các khoản tiền và các khoản tương đương tiền", "TEXT", "MIXED", "CASH", "B01", ["110"], True, {"fields": ["cash_equivalent_criteria", "restricted_cash_policy"]}),
    ("IV.5", "5. Nguyên tắc kế toán các khoản đầu tư tài chính", "TEXT", "MIXED", "GL", "B01", ["120", "250"], False, {"fields": ["investment_classification", "measurement_basis", "impairment_policy"]}),
    ("IV.6", "6. Nguyên tắc kế toán nợ phải thu", "TEXT", "MIXED", "AR", "B01", ["130", "210"], True, {"fields": ["receivable_recognition", "impairment_estimation"]}),
    ("IV.7", "7. Nguyên tắc ghi nhận hàng tồn kho", "TEXT", "MIXED", "INV", "B01", ["140"], True, {"fields": ["inventory_valuation_method", "inventory_accounting_method", "provision_policy", "allocation_basis"]}),
    ("IV.8", "8. Nguyên tắc ghi nhận và khấu hao TSCĐ hữu hình, TSCĐ vô hình, TSCĐ thuê tài chính và BĐSĐT", "TEXT", "MIXED", "FA", "B01", ["220", "230"], True, {"fields": ["asset_recognition", "depreciation_method", "useful_life_policy"]}),
    ("IV.9", "9. Nguyên tắc kế toán tài sản sinh học", "TEXT", "MANUAL", "FA", "B01", [], False, {"fields": ["biological_asset_policy", "valuation_basis"]}),
    ("IV.10", "10. Nguyên tắc kế toán hợp đồng hợp tác kinh doanh (BCC)", "TEXT", "MANUAL", "GL", "", [], False, {"fields": ["bcc_accounting_policy", "joint_operation_classification"]}),
    ("IV.11", "11. Nguyên tắc kế toán chi phí chờ phân bổ (chi phí trả trước)", "TEXT", "MIXED", "GL", "B01", ["151", "261"], False, {"fields": ["prepayment_recognition", "allocation_method"]}),
    ("IV.12", "12. Nguyên tắc kế toán nợ phải trả người bán", "TEXT", "MIXED", "AP", "B01", ["311", "331"], True, {"fields": ["payable_recognition", "classification_policy"]}),
    ("IV.13", "13. Nguyên tắc ghi nhận phải trả cổ tức, lợi nhuận", "TEXT", "MANUAL", "GL", "B01", ["319"], False, {"fields": ["dividend_payable_policy", "recognition_basis"]}),
    ("IV.14", "14. Nguyên tắc ghi nhận chi phí phải trả", "TEXT", "MIXED", "GL", "B01", ["315", "333"], False, {"fields": ["accrued_expense_policy"]}),
    ("IV.15", "15. Nguyên tắc ghi nhận doanh thu chưa thực hiện (chờ phân bổ)", "TEXT", "MANUAL", "SAL", "B01", ["318", "336"], False, {"fields": ["deferred_revenue_recognition", "allocation_method"]}),
    ("IV.16", "16. Nguyên tắc ghi nhận dự phòng phải trả", "TEXT", "MANUAL", "GL", "B01", ["321", "342"], False, {"fields": ["provision_recognition", "estimation_basis"]}),
    ("IV.17", "17. Nguyên tắc ghi nhận thuế thu nhập doanh nghiệp hoãn lại", "TEXT", "MANUAL", "TAX", "B01", ["262", "341"], False, {"fields": ["deferred_tax_recognition", "tax_rate_basis"]}),
    ("IV.18", "18. Nguyên tắc kế toán vay và nợ phải trả thuê tài chính", "TEXT", "MIXED", "BANK", "B01", ["320", "338"], False, {"fields": ["loan_recognition", "lease_liability_policy"]}),
    ("IV.19", "19. Nguyên tắc ghi nhận và vốn hóa các khoản chi phí đi vay", "TEXT", "MIXED", "GL", "B02", ["23"], False, {"fields": ["borrowing_cost_recognition", "capitalization_criteria"]}),
    ("IV.20", "20. Nguyên tắc kế toán trái phiếu chuyển đổi", "TEXT", "MANUAL", "GL", "B01", ["339"], False, {"fields": ["convertible_bond_policy", "liability_equity_split_method"]}),
    ("IV.21", "21. Nguyên tắc ghi nhận vốn chủ sở hữu", "TEXT", "MIXED", "GL", "B01", ["410"], True, {"fields": ["equity_recognition", "share_capital_policy", "retained_earnings_policy"]}),
    ("IV.22", "22. Nguyên tắc và phương pháp ghi nhận doanh thu và thu nhập khác", "TEXT", "MIXED", "SAL", "B02", ["01", "21", "31"], True, {"fields": ["sales_revenue_policy", "service_revenue_policy", "construction_revenue_policy", "investment_property_revenue_policy"]}),
    ("IV.23", "23. Nguyên tắc kế toán các khoản giảm trừ doanh thu", "TEXT", "MIXED", "SAL", "B02", ["02"], False, {"fields": ["revenue_deduction_policy"]}),
    ("IV.24", "24. Nguyên tắc kế toán giá vốn hàng bán", "TEXT", "MIXED", "INV", "B02", ["11"], True, {"fields": ["cost_of_sales_policy"]}),
    ("IV.25", "25. Nguyên tắc và phương pháp ghi nhận chi phí tài chính", "TEXT", "MIXED", "GL", "B02", ["22"], False, {"fields": ["financial_expense_policy"]}),
    ("IV.26", "26. Nguyên tắc kế toán chi phí bán hàng và chi phí quản lý doanh nghiệp", "TEXT", "MIXED", "GL", "B02", ["25", "26"], True, {"fields": ["selling_expense_policy", "admin_expense_policy"]}),
    ("IV.27", "27. Nguyên tắc kế toán nghiệp vụ bán, thanh lý TSCĐ và BĐSĐT", "TEXT", "MANUAL", "FA", "B02", ["21", "31", "32"], False, {"fields": ["asset_disposal_policy", "investment_property_disposal_policy"]}),
    ("IV.28", "28. Nguyên tắc và phương pháp ghi nhận chi phí thuế TNDN hiện hành và hoãn lại", "TEXT", "MIXED", "TAX", "B02", ["51", "52"], True, {"fields": ["current_tax_policy", "deferred_tax_policy", "top_up_tax_policy_if_applicable"]}),
    ("IV.29", "29. Các nguyên tắc và phương pháp kế toán khác", "TEXT", "MANUAL", "GL", "", [], False, {"fields": ["other_policy_items"]}),
]

# Section V – 32 Balance Sheet Disclosure Groups (V.1 .. V.32)
SECTION_V_32_ITEMS_SPEC = [
    ("V.1", "1. Tiền và các khoản tương đương tiền", "MULTI_LEVEL_TABLE", "AUTO", "CASH", "B01", ["110", "111", "112"], True, {"subtables": ["V.1.SUMMARY", "V.1.BANK_DETAILS", "V.1.CASH_EQUIVALENTS"]}),
    ("V.2", "2. Các khoản đầu tư tài chính", "MULTI_LEVEL_TABLE", "MIXED", "GL", "B01", ["120", "121", "123", "250"], False, {"subtables": ["V.2.TRADING", "V.2.HTM", "V.2.EQUITY"]}),
    ("V.3", "3. Phải thu của khách hàng", "TABLE", "AUTO", "AR", "B01", ["131", "211", "137", "219"], False, {"subtables": ["V.3.CUSTOMERS"]}),
    ("V.4", "4. Phải thu khác", "TABLE", "AUTO", "AR", "B01", ["136", "216"], False, {"subtables": ["V.4.OTHER_RECEIVABLES"]}),
    ("V.5", "5. Tài sản thiếu chờ xử lý", "TABLE", "MIXED", "INV", "B01", ["139"], False, {"subtables": ["V.5.SHORTAGE_ASSETS"]}),
    ("V.6", "6. Nợ xấu", "TABLE", "MIXED", "AR", "B01", ["137", "219"], False, {"subtables": ["V.6.BAD_DEBTS"]}),
    ("V.7", "7. Hàng tồn kho", "TABLE", "AUTO", "INV", "B01", ["140", "141", "149"], False, {"subtables": ["V.7.INVENTORY"]}),
    ("V.8", "8. Tài sản dở dang dài hạn", "TABLE", "AUTO", "FA", "B01", ["240", "241", "242"], False, {"subtables": ["V.8.LONG_TERM_WIP"]}),
    ("V.9", "9. Tăng, giảm tài sản cố định hữu hình", "MOVEMENT_TABLE", "AUTO", "FA", "B01", ["221", "222", "223"], False, {"subtables": ["V.9.TANGIBLE_FA"]}),
    ("V.10", "10. Tăng, giảm tài sản cố định vô hình", "MOVEMENT_TABLE", "AUTO", "FA", "B01", ["227", "228", "229"], False, {"subtables": ["V.10.INTANGIBLE_FA"]}),
    ("V.11", "11. Tăng, giảm tài sản cố định thuê tài chính", "MOVEMENT_TABLE", "AUTO", "FA", "B01", ["224", "225", "226"], False, {"subtables": ["V.11.FINANCE_LEASE_FA"]}),
    ("V.12", "12. Tài sản sinh học", "MOVEMENT_TABLE", "MANUAL", "FA", "B01", [], False, {"subtables": ["V.12.BIOLOGICAL_ASSETS"]}),
    ("V.13", "13. Tăng, giảm bất động sản đầu tư", "MOVEMENT_TABLE", "AUTO", "FA", "B01", ["230", "231", "232"], False, {"subtables": ["V.13.INVESTMENT_PROPERTY"]}),
    ("V.14", "14. Chi phí trả trước (chờ phân bổ)", "TABLE", "AUTO", "GL", "B01", ["151", "261"], False, {"subtables": ["V.14.PREPAID_EXPENSES"]}),
    ("V.15", "15. Tài sản khác", "TABLE", "AUTO", "GL", "B01", ["155", "268"], False, {"subtables": ["V.15.OTHER_ASSETS"]}),
    ("V.16", "16. Vay và nợ thuê tài chính", "MULTI_LEVEL_TABLE", "AUTO", "BANK", "B01", ["320", "338"], False, {"subtables": ["V.16.LOANS", "V.16.LEASES", "V.16.OVERDUE"]}),
    ("V.17", "17. Phải trả người bán", "TABLE", "AUTO", "AP", "B01", ["311", "331"], False, {"subtables": ["V.17.SUPPLIERS"]}),
    ("V.18", "18. Phải trả cổ tức, lợi nhuận", "TABLE", "AUTO", "GL", "B01", ["319"], False, {"subtables": ["V.18.DIVIDENDS_PAYABLE"]}),
    ("V.19", "19. Thuế và các khoản phải nộp Nhà nước", "TABLE", "AUTO", "TAX", "B01", ["313", "153"], False, {"subtables": ["V.19.TAX"]}),
    ("V.20", "20. Chi phí phải trả", "TABLE", "AUTO", "GL", "B01", ["315", "333"], False, {"subtables": ["V.20.ACCRUED_EXPENSES"]}),
    ("V.21", "21. Phải trả khác", "TABLE", "AUTO", "GL", "B01", ["319", "337"], False, {"subtables": ["V.21.OTHER_PAYABLES"]}),
    ("V.22", "22. Doanh thu chưa thực hiện (chờ phân bổ)", "TABLE", "AUTO", "SAL", "B01", ["318", "336"], False, {"subtables": ["V.22.DEFERRED_REVENUE"]}),
    ("V.23", "23. Trái phiếu phát hành", "TABLE", "MANUAL", "GL", "B01", ["338", "339"], False, {"subtables": ["V.23.BONDS"]}),
    ("V.24", "24. Cổ phiếu ưu đãi phân loại là nợ phải trả", "TABLE", "MANUAL", "GL", "B01", ["340"], False, {"subtables": ["V.24.PREFERRED_SHARES_LIABILITY"]}),
    ("V.25", "25. Dự phòng phải trả", "MOVEMENT_TABLE", "AUTO", "GL", "B01", ["321", "342"], False, {"subtables": ["V.25.PROVISIONS"]}),
    ("V.26", "26. Tài sản thuế thu nhập hoãn lại và thuế thu nhập hoãn lại phải trả", "TABLE", "AUTO", "TAX", "B01", ["262", "341"], False, {"subtables": ["V.26.DEFERRED_TAX"]}),
    ("V.27", "27. Vốn chủ sở hữu", "MULTI_LEVEL_TABLE", "AUTO", "GL", "B01", ["410", "411", "421"], True, {"subtables": ["V.27.MOVEMENT", "V.27.SHARES", "V.27.DIVIDENDS"]}),
    ("V.28", "28. Chênh lệch đánh giá lại tài sản", "TABLE", "AUTO", "GL", "B01", ["416"], False, {"subtables": ["V.28.REVALUATION"]}),
    ("V.29", "29. Chênh lệch tỷ giá", "TABLE", "AUTO", "GL", "B01", ["417"], False, {"subtables": ["V.29.FX_DIFFERENCES"]}),
    ("V.30", "30. Các khoản mục ngoài Báo cáo tình hình tài chính", "MIXED", "MANUAL", "MANUAL", "", [], False, {"subtables": ["V.30.OFF_BALANCE_SHEET"]}),
    ("V.31", "31. Tài sản nắm giữ của bên khác bị giới hạn sử dụng và nghĩa vụ liên quan", "MIXED", "MANUAL", "MANUAL", "", [], False, {"subtables": ["V.31.RESTRICTED_CUSTODY"]}),
    ("V.32", "32. Các thông tin khác giải trình cho các khoản mục trên Báo cáo tình hình tài chính", "MIXED", "MANUAL", "MANUAL", "B01", [], False, {}),
]

# Section VII – 11 Income Statement Disclosure Groups (VII.1 .. VII.11)
SECTION_VII_11_ITEMS_SPEC = [
    ("VII.1", "1. Tổng doanh thu bán hàng và cung cấp dịch vụ", "TABLE", "AUTO", "SAL", "B02", ["01"], True, {"subtables": ["VII.1.REVENUE"]}),
    ("VII.2", "2. Các khoản giảm trừ doanh thu", "TABLE", "AUTO", "SAL", "B02", ["02"], False, {"subtables": ["VII.2.DEDUCTIONS"]}),
    ("VII.3", "3. Giá vốn hàng bán", "TABLE", "AUTO", "INV", "B02", ["11"], False, {"subtables": ["VII.3.COGS"]}),
    ("VII.4", "4. Lãi, lỗ từ việc bán, thanh lý bất động sản đầu tư", "TABLE", "AUTO", "FA", "B02", ["21"], False, {"subtables": ["VII.4.IP_DISPOSAL"]}),
    ("VII.5", "5. Doanh thu hoạt động tài chính", "TABLE", "AUTO", "GL", "B02", ["21"], False, {"subtables": ["VII.5.FIN_INCOME"]}),
    ("VII.6", "6. Chi phí tài chính", "TABLE", "AUTO", "GL", "B02", ["22", "23"], False, {"subtables": ["VII.6.FIN_EXPENSE"]}),
    ("VII.7", "7. Thu nhập khác", "TABLE", "AUTO", "GL", "B02", ["31"], False, {"subtables": ["VII.7.OTHER_INCOME"]}),
    ("VII.8", "8. Chi phí khác", "TABLE", "AUTO", "GL", "B02", ["32"], False, {"subtables": ["VII.8.OTHER_EXPENSE"]}),
    ("VII.9", "9. Chi phí bán hàng và chi phí quản lý doanh nghiệp", "TABLE", "AUTO", "GL", "B02", ["25", "26"], False, {"subtables": ["VII.9.SGA"]}),
    ("VII.10", "10. Chi phí sản xuất, kinh doanh theo yếu tố", "TABLE", "AUTO", "GL", "B02", [], False, {"subtables": ["VII.10.COST_BY_ELEMENT"]}),
    ("VII.11", "11. Chi phí thuế thu nhập doanh nghiệp", "TABLE", "AUTO", "TAX", "B02", ["50", "51", "52"], False, {"subtables": ["VII.11.CIT"]}),
]

# Section VIII – 5 Cash Flow Disclosure Groups (VIII.1 .. VIII.5)
SECTION_VIII_5_ITEMS_SPEC = [
    ("VIII.1", "1. Các khoản tiền do doanh nghiệp nắm giữ nhưng không được sử dụng", "TABLE", "AUTO", "BANK", "B03", ["70"], False, {"subtables": ["VIII.1.RESTRICTED_CASH"]}),
    ("VIII.2", "2. Các giao dịch không bằng tiền ảnh hưởng đến Báo cáo lưu chuyển tiền tệ trong tương lai", "TABLE", "AUTO", "GL", "B03", [], False, {"subtables": ["VIII.2.NON_CASH"]}),
    ("VIII.3", "3. Số tiền đi vay thực thu trong kỳ", "TABLE", "AUTO", "BANK", "B03", ["33"], False, {"subtables": ["VIII.3.BORROWINGS_RECEIVED"]}),
    ("VIII.4", "4. Số tiền đã thực trả gốc vay trong kỳ", "TABLE", "AUTO", "BANK", "B03", ["34"], False, {"subtables": ["VIII.4.PRINCIPAL_REPAID"]}),
    ("VIII.5", "5. Mua và thanh lý công ty con hoặc đơn vị kinh doanh khác trong kỳ", "TABLE", "MANUAL", "GL", "B03", ["25", "26"], False, {"subtables": ["VIII.5.SUBSIDIARY_MNA"]}),
]

# Section IX – 8 Other Disclosures (IX.1 .. IX.8)
SECTION_IX_8_ITEMS_SPEC = [
    ("IX.1", "1. Những khoản nợ tiềm tàng, khoản cam kết và những thông tin tài chính khác", "MIXED", "MANUAL", "MANUAL", "", [], False, {"fields": ["contingency_type", "estimated_amount", "probability", "timing", "source_reference"]}),
    ("IX.2", "2. Những sự kiện phát sinh sau ngày kết thúc kỳ kế toán", "MIXED", "MANUAL", "MANUAL", "", [], False, {"subtables": ["IX.2.SUBSEQUENT_EVENTS"]}),
    ("IX.3", "3. Thông tin về các bên liên quan", "MIXED", "MANUAL", "GL", "", [], False, {"subtables": ["IX.3.RELATED_PARTIES"]}),
    ("IX.4", "4. Trình bày tài sản, doanh thu, kết quả kinh doanh theo bộ phận", "TABLE", "MANUAL", "GL", "", [], False, {"subtables": ["IX.4.SEGMENTS"]}),
    ("IX.5", "5. Thông tin so sánh (những thay đổi về thông tin trong BCTC của các niên độ kế toán trước)", "MIXED", "MANUAL", "RPT", "", [], False, {"fields": ["change_type", "affected_period", "amount_before", "amount_after", "reason"]}),
    ("IX.6", "6. Thông tin về hoạt động liên tục", "MIXED", "MIXED", "RPT", "", [], True, {"fields": ["going_concern_assessment", "uncertainties", "mitigation_plans", "conclusion", "source_reference"]}),
    ("IX.7", "7. Các giả định và ước tính kế toán quan trọng", "MIXED", "MANUAL", "RPT", "", [], False, {"fields": ["assumption_nature", "impact_amount", "scenario", "solution"]}),
    ("IX.8", "8. Những thông tin, giải pháp khác", "MIXED", "MANUAL", "MANUAL", "", [], False, {"fields": ["content", "action_plan", "responsible_person", "source_reference"]}),
]

# Section X – Form/Indicator Modifications (X.1)
SECTION_X_ITEMS_SPEC = [
    ("X.1", "1. Nội dung sửa đổi, bổ sung biểu mẫu/chỉ tiêu Báo cáo tài chính", "TABLE", "MANUAL", "RPT", "", [], False, {"subtables": ["X.1.MODIFIED_INDICATORS"]}),
]

# Section VI for B09a-DN – 10 Interim Significant Events/Transactions (VI.1 .. VI.10)
SECTION_VI_B09A_10_ITEMS_SPEC = [
    ("VI.1", "1. Tính thời vụ hoặc tính chu kỳ của hoạt động kinh doanh giữa niên độ", "MIXED", "MANUAL", "RPT", "", [], False, {"fields": ["seasonality_description", "financial_impact"]}),
    ("VI.2", "2. Bản chất và giá trị các khoản mục bất thường về tính chất, quy mô hoặc tác động", "TABLE", "MANUAL", "GL", "", [], False, {"fields": ["item_name", "amount", "nature", "impact"]}),
    ("VI.3", "3. Biến động vốn chủ sở hữu giữa niên độ", "MOVEMENT_TABLE", "AUTO", "GL", "B01", ["410"], False, {"subtables": ["VI.3.EQUITY_MOVEMENT"]}),
    ("VI.4", "4. Bản chất và giá trị của những thay đổi trong ước tính kế toán trọng yếu", "MIXED", "MANUAL", "RPT", "", [], False, {"fields": ["estimate_name", "change_reason", "financial_impact"]}),
    ("VI.5", "5. Phát hành, mua lại và hoàn trả các chứng khoán nợ và chứng khoán vốn", "TABLE", "MIXED", "GL", "", [], False, {"fields": ["instrument_type", "amount", "quantity", "date"]}),
    ("VI.6", "6. Cổ tức đã trả (tổng số hoặc tính trên mỗi cổ phiếu)", "TABLE", "AUTO", "GL", "B03", ["36"], False, {"fields": ["share_class", "total_dividend", "dividend_per_share"]}),
    ("VI.7", "7. Doanh thu và kết quả kinh doanh theo bộ phận giữa niên độ", "TABLE", "MANUAL", "GL", "", [], False, {"fields": ["segment", "revenue", "result", "period"]}),
    ("VI.8", "8. Các sự kiện trọng yếu phát sinh sau ngày kết thúc kỳ kế toán giữa niên độ", "MIXED", "MANUAL", "MANUAL", "", [], False, {"fields": ["event_date", "description", "financial_impact"]}),
    ("VI.9", "9. Những thay đổi về nợ tiềm tàng hoặc tài sản tiềm tàng kể từ ngày kết thúc kỳ kế toán năm gần nhất", "TABLE", "MANUAL", "MANUAL", "", [], False, {"fields": ["contingency_type", "opening_amount", "change_amount", "closing_amount"]}),
    ("VI.10", "10. Những thông tin trọng yếu khác cần thuyết minh giữa niên độ", "MIXED", "MANUAL", "MANUAL", "", [], False, {"fields": ["content", "source_reference"]}),
]


# ============================================================================
# 3. TABLE SCHEMA DEFINITIONS (WITH SCHEMA_VERSION & MULTI-LEVEL COLUMN GROUPS)
# ============================================================================

TABLE_SCHEMAS_DEF: dict[str, dict[str, Any]] = {
    "V.1.SUMMARY": {
        "title": "Bảng tổng hợp tiền và các khoản tương đương tiền",
        "schema_version": 1,
        "columns": [
            {"column_code": "item_name", "column_label": "Khoản mục", "column_group": "", "data_type": "TEXT"},
            {"column_code": "closing_amount", "column_label": "Số cuối năm", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "opening_amount", "column_label": "Số đầu năm", "column_group": "Giá trị", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "CASH_ON_HAND", "row_label": "- Tiền mặt"},
            {"row_code": "DEMAND_DEPOSITS", "row_label": "- Tiền gửi ngân hàng không kỳ hạn"},
            {"row_code": "CASH_IN_TRANSIT", "row_label": "- Tiền đang chuyển"},
            {"row_code": "CASH_EQUIVALENTS", "row_label": "- Các khoản tương đương tiền"},
            {"row_code": "TOTAL", "row_label": "Cộng"},
        ],
        "calculation_policy": {"total_row": "TOTAL", "sum_rows": ["CASH_ON_HAND", "DEMAND_DEPOSITS", "CASH_IN_TRANSIT", "CASH_EQUIVALENTS"]},
    },
    "V.1.BANK_DETAILS": {
        "title": "Chi tiết tiền gửi không kỳ hạn theo ngân hàng (Ngưỡng công bố 10%)",
        "schema_version": 1,
        "columns": [
            {"column_code": "bank_name", "column_label": "Ngân hàng / Tài khoản", "column_group": "", "data_type": "TEXT"},
            {"column_code": "account_currency", "column_label": "Loại tiền", "column_group": "", "data_type": "TEXT"},
            {"column_code": "closing_amount", "column_label": "Số cuối năm", "column_group": "Số dư", "data_type": "NUMBER"},
            {"column_code": "opening_amount", "column_label": "Số đầu năm", "column_group": "Số dư", "data_type": "NUMBER"},
            {"column_code": "percentage_of_total_demand_deposits", "column_label": "Tỷ trọng (%)", "column_group": "Công bố trọng yếu", "data_type": "NUMBER"},
            {"column_code": "is_disclosure_threshold_met", "column_label": "Đạt ngưỡng >= 10%", "column_group": "Công bố trọng yếu", "data_type": "BOOLEAN"},
        ],
        "rows": [],
        "calculation_policy": {"threshold_percent": "10.0000", "denominator": "V.1.SUMMARY.DEMAND_DEPOSITS.closing_amount"},
    },
    "V.1.CASH_EQUIVALENTS": {
        "title": "Chi tiết các khoản tương đương tiền",
        "schema_version": 1,
        "columns": [
            {"column_code": "instrument_name", "column_label": "Khoản đầu tư", "column_group": "", "data_type": "TEXT"},
            {"column_code": "acquisition_date", "column_label": "Ngày mua/gửi", "column_group": "Kỳ hạn", "data_type": "DATE"},
            {"column_code": "original_maturity_date", "column_label": "Ngày đáo hạn gốc", "column_group": "Kỳ hạn", "data_type": "DATE"},
            {"column_code": "original_tenor_days", "column_label": "Số ngày kỳ hạn gốc", "column_group": "Kỳ hạn", "data_type": "NUMBER"},
            {"column_code": "closing_amount", "column_label": "Số cuối năm", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "opening_amount", "column_label": "Số đầu năm", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "is_cash_equivalent", "column_label": "Đủ ĐK tương đương tiền", "column_group": "", "data_type": "BOOLEAN"},
        ],
        "rows": [],
        "calculation_policy": {"max_tenor_days": 92},
    },
    "V.2.TRADING": {
        "title": "a) Chứng khoán kinh doanh",
        "schema_version": 1,
        "columns": [
            {"column_code": "investment_name", "column_label": "Khoản mục chứng khoán", "column_group": "", "data_type": "TEXT"},
            {"column_code": "closing_cost", "column_label": "Giá gốc", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "closing_fair_value", "column_label": "Giá trị hợp lý", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "closing_provision", "column_label": "Dự phòng", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "opening_cost", "column_label": "Giá gốc", "column_group": "Số đầu năm", "data_type": "NUMBER"},
            {"column_code": "opening_fair_value", "column_label": "Giá trị hợp lý", "column_group": "Số đầu năm", "data_type": "NUMBER"},
            {"column_code": "opening_provision", "column_label": "Dự phòng", "column_group": "Số đầu năm", "data_type": "NUMBER"},
            {"column_code": "valuation_basis", "column_label": "Cơ sở xác định / Lý do", "column_group": "", "data_type": "TEXT"},
        ],
        "rows": [],
        "calculation_policy": {"null_fair_value_policy": "NEVER_FAKE_ZERO"},
    },
    "V.2.HTM": {
        "title": "b) Đầu tư nắm giữ đến ngày đáo hạn",
        "schema_version": 1,
        "columns": [
            {"column_code": "investment_name", "column_label": "Khoản mục", "column_group": "", "data_type": "TEXT"},
            {"column_code": "maturity_class", "column_label": "Phân loại kỳ hạn", "column_group": "", "data_type": "ENUM"},
            {"column_code": "closing_cost", "column_label": "Giá gốc", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "closing_carrying_amount", "column_label": "Giá trị ghi sổ", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "opening_cost", "column_label": "Giá gốc", "column_group": "Số đầu năm", "data_type": "NUMBER"},
            {"column_code": "opening_carrying_amount", "column_label": "Giá trị ghi sổ", "column_group": "Số đầu năm", "data_type": "NUMBER"},
        ],
        "rows": [],
        "calculation_policy": {"exclude_cash_equivalents": True},
    },
    "V.2.EQUITY": {
        "title": "c) Đầu tư góp vốn vào đơn vị khác",
        "schema_version": 1,
        "columns": [
            {"column_code": "investee_name", "column_label": "Tên đơn vị nhận đầu tư", "column_group": "", "data_type": "TEXT"},
            {"column_code": "investment_type", "column_label": "Loại hình", "column_group": "", "data_type": "ENUM"},
            {"column_code": "ownership_percentage", "column_label": "Tỷ lệ sở hữu (%)", "column_group": "", "data_type": "NUMBER"},
            {"column_code": "closing_carrying_value", "column_label": "Giá gốc cuối năm", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "closing_provision", "column_label": "Dự phòng cuối năm", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "opening_carrying_value", "column_label": "Giá gốc đầu năm", "column_group": "Số đầu năm", "data_type": "NUMBER"},
        ],
        "rows": [],
        "calculation_policy": {},
    },
    "V.3.CUSTOMERS": {
        "title": "Phải thu của khách hàng (Ngắn hạn và Dài hạn)",
        "schema_version": 1,
        "columns": [
            {"column_code": "receivable_group", "column_label": "Kỳ hạn (SHORT/LONG)", "column_group": "", "data_type": "ENUM"},
            {"column_code": "customer_code", "column_label": "Mã KH", "column_group": "Khách hàng", "data_type": "TEXT"},
            {"column_code": "customer_name", "column_label": "Tên khách hàng", "column_group": "Khách hàng", "data_type": "TEXT"},
            {"column_code": "closing_gross_amount", "column_label": "Giá trị ghi sổ", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "closing_provision_amount", "column_label": "Dự phòng", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "opening_gross_amount", "column_label": "Giá trị ghi sổ", "column_group": "Số đầu năm", "data_type": "NUMBER"},
            {"column_code": "opening_provision_amount", "column_label": "Dự phòng", "column_group": "Số đầu năm", "data_type": "NUMBER"},
            {"column_code": "is_related_party", "column_label": "Bên liên quan", "column_group": "", "data_type": "BOOLEAN"},
        ],
        "rows": [],
        "calculation_policy": {"no_arbitrary_netting_131": True},
    },
    "V.7.INVENTORY": {
        "title": "Hàng tồn kho (Giá gốc và Dự phòng giảm giá)",
        "schema_version": 1,
        "columns": [
            {"column_code": "inventory_category", "column_label": "Nhóm hàng tồn kho", "column_group": "", "data_type": "TEXT"},
            {"column_code": "closing_cost", "column_label": "Giá gốc", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "closing_provision", "column_label": "Dự phòng", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "opening_cost", "column_label": "Giá gốc", "column_group": "Số đầu năm", "data_type": "NUMBER"},
            {"column_code": "opening_provision", "column_label": "Dự phòng", "column_group": "Số đầu năm", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "GOODS_IN_TRANSIT", "row_label": "- Hàng mua đang đi đường (TK 151)"},
            {"row_code": "RAW_MATERIALS", "row_label": "- Nguyên liệu, vật liệu (TK 152)"},
            {"row_code": "TOOLS_SUPPLIES", "row_label": "- Công cụ, dụng cụ (TK 153)"},
            {"row_code": "WORK_IN_PROGRESS", "row_label": "- Chi phí sản xuất kinh doanh dở dang (TK 154)"},
            {"row_code": "FINISHED_GOODS", "row_label": "- Thành phẩm (TK 155)"},
            {"row_code": "MERCHANDISE", "row_label": "- Hàng hóa (TK 156)"},
            {"row_code": "GOODS_ON_CONSIGNMENT", "row_label": "- Hàng gửi đi bán (TK 157)"},
            {"row_code": "TAX_SUSPENSION_WAREHOUSE", "row_label": "- Hàng hóa kho bảo thuế (TK 158)"},
            {"row_code": "TOTAL", "row_label": "Cộng"},
        ],
        "calculation_policy": {"total_row": "TOTAL", "net_formula": "closing_cost - closing_provision == B01.140"},
    },
    "V.9.TANGIBLE_FA": {
        "title": "Tăng, giảm tài sản cố định hữu hình",
        "schema_version": 1,
        "columns": [
            {"column_code": "item_label", "column_label": "Khoản mục biến động", "column_group": "", "data_type": "TEXT"},
            {"column_code": "BUILDINGS", "column_label": "Nhà cửa, vật kiến trúc", "column_group": "Nhóm TSCĐ hữu hình", "data_type": "NUMBER"},
            {"column_code": "MACHINERY", "column_label": "Máy móc, thiết bị", "column_group": "Nhóm TSCĐ hữu hình", "data_type": "NUMBER"},
            {"column_code": "VEHICLES", "column_label": "Phương tiện vận tải, truyền dẫn", "column_group": "Nhóm TSCĐ hữu hình", "data_type": "NUMBER"},
            {"column_code": "OFFICE_EQUIP", "column_label": "Thiết bị, dụng cụ quản lý", "column_group": "Nhóm TSCĐ hữu hình", "data_type": "NUMBER"},
            {"column_code": "OTHER_TANGIBLE", "column_label": "TSCĐ hữu hình khác", "column_group": "Nhóm TSCĐ hữu hình", "data_type": "NUMBER"},
            {"column_code": "TOTAL", "column_label": "Tổng cộng", "column_group": "Tổng hợp", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "COST_OPENING", "row_label": "I. Nguyên giá - Số dư đầu năm"},
            {"row_code": "COST_PURCHASE_INCREASE", "row_label": "- Mua trong năm"},
            {"row_code": "COST_CONSTRUCTION_INCREASE", "row_label": "- Đầu tư XDCB hoàn thành"},
            {"row_code": "COST_OTHER_INCREASE", "row_label": "- Tăng khác"},
            {"row_code": "COST_DISPOSAL_DECREASE", "row_label": "- Thanh lý, nhượng bán"},
            {"row_code": "COST_OTHER_DECREASE", "row_label": "- Giảm khác"},
            {"row_code": "COST_CLOSING", "row_label": "I. Nguyên giá - Số dư cuối năm"},
            {"row_code": "DEPRECIATION_OPENING", "row_label": "II. Giá trị hao mòn lũy kế - Số dư đầu năm"},
            {"row_code": "DEPRECIATION_PERIOD", "row_label": "- Khấu hao trong năm"},
            {"row_code": "DEPRECIATION_OTHER_INCREASE", "row_label": "- Tăng khác"},
            {"row_code": "DEPRECIATION_DISPOSAL", "row_label": "- Thanh lý, nhượng bán"},
            {"row_code": "DEPRECIATION_OTHER_DECREASE", "row_label": "- Giảm khác"},
            {"row_code": "DEPRECIATION_CLOSING", "row_label": "II. Giá trị hao mòn lũy kế - Số dư cuối năm"},
            {"row_code": "NET_BOOK_VALUE_OPENING", "row_label": "III. Giá trị còn lại - Tại ngày đầu năm"},
            {"row_code": "NET_BOOK_VALUE_CLOSING", "row_label": "III. Giá trị còn lại - Tại ngày cuối năm"},
        ],
        "calculation_policy": {
            "cost_formula": "COST_CLOSING = COST_OPENING + COST_PURCHASE_INCREASE + COST_CONSTRUCTION_INCREASE + COST_OTHER_INCREASE - COST_DISPOSAL_DECREASE - COST_OTHER_DECREASE",
            "depr_formula": "DEPRECIATION_CLOSING = DEPRECIATION_OPENING + DEPRECIATION_PERIOD + DEPRECIATION_OTHER_INCREASE - DEPRECIATION_DISPOSAL - DEPRECIATION_OTHER_DECREASE",
            "nbv_formula": "NET_BOOK_VALUE_CLOSING = COST_CLOSING - DEPRECIATION_CLOSING",
        },
    },
    "V.10.INTANGIBLE_FA": {
        "title": "Tăng, giảm tài sản cố định vô hình",
        "schema_version": 1,
        "columns": [
            {"column_code": "item_label", "column_label": "Khoản mục biến động", "column_group": "", "data_type": "TEXT"},
            {"column_code": "LAND_USE_RIGHTS", "column_label": "Quyền sử dụng đất", "column_group": "Nhóm TSCĐ vô hình", "data_type": "NUMBER"},
            {"column_code": "SOFTWARE", "column_label": "Chương trình phần mềm", "column_group": "Nhóm TSCĐ vô hình", "data_type": "NUMBER"},
            {"column_code": "OTHER_INTANGIBLE", "column_label": "TSCĐ vô hình khác", "column_group": "Nhóm TSCĐ vô hình", "data_type": "NUMBER"},
            {"column_code": "TOTAL", "column_label": "Tổng cộng", "column_group": "Tổng hợp", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "COST_OPENING", "row_label": "I. Nguyên giá - Số dư đầu năm"},
            {"row_code": "COST_PURCHASE_INCREASE", "row_label": "- Mua trong năm"},
            {"row_code": "COST_INTERNAL_INCREASE", "row_label": "- Tạo ra từ nội bộ doanh nghiệp"},
            {"row_code": "COST_DISPOSAL_DECREASE", "row_label": "- Thanh lý, nhượng bán"},
            {"row_code": "COST_CLOSING", "row_label": "I. Nguyên giá - Số dư cuối năm"},
            {"row_code": "DEPRECIATION_OPENING", "row_label": "II. Giá trị hao mòn lũy kế - Số dư đầu năm"},
            {"row_code": "DEPRECIATION_PERIOD", "row_label": "- Khấu hao trong năm"},
            {"row_code": "DEPRECIATION_DISPOSAL", "row_label": "- Giảm hao mòn do thanh lý"},
            {"row_code": "DEPRECIATION_CLOSING", "row_label": "II. Giá trị hao mòn lũy kế - Số dư cuối năm"},
            {"row_code": "NET_BOOK_VALUE_OPENING", "row_label": "III. Giá trị còn lại - Tại ngày đầu năm"},
            {"row_code": "NET_BOOK_VALUE_CLOSING", "row_label": "III. Giá trị còn lại - Tại ngày cuối năm"},
        ],
        "calculation_policy": {},
    },
    "V.11.FINANCE_LEASE_FA": {
        "title": "Tăng, giảm tài sản cố định thuê tài chính",
        "schema_version": 1,
        "columns": [
            {"column_code": "item_label", "column_label": "Khoản mục biến động", "column_group": "", "data_type": "TEXT"},
            {"column_code": "MACHINERY_LEASE", "column_label": "Máy móc, thiết bị thuê TC", "column_group": "Nhóm TSCĐ thuê TC", "data_type": "NUMBER"},
            {"column_code": "VEHICLES_LEASE", "column_label": "Phương tiện vận tải thuê TC", "column_group": "Nhóm TSCĐ thuê TC", "data_type": "NUMBER"},
            {"column_code": "TOTAL", "column_label": "Tổng cộng", "column_group": "Tổng hợp", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "COST_OPENING", "row_label": "I. Nguyên giá - Số dư đầu năm"},
            {"row_code": "COST_LEASE_INCREASE", "row_label": "- Thuê tài chính trong năm"},
            {"row_code": "COST_RETURN_DECREASE", "row_label": "- Trả lại tài sản thuê tài chính"},
            {"row_code": "COST_CLOSING", "row_label": "I. Nguyên giá - Số dư cuối năm"},
            {"row_code": "DEPRECIATION_OPENING", "row_label": "II. Giá trị hao mòn lũy kế - Số dư đầu năm"},
            {"row_code": "DEPRECIATION_PERIOD", "row_label": "- Khấu hao trong năm"},
            {"row_code": "DEPRECIATION_RETURN", "row_label": "- Giảm do trả lại tài sản thuê"},
            {"row_code": "DEPRECIATION_CLOSING", "row_label": "II. Giá trị hao mòn lũy kế - Số dư cuối năm"},
            {"row_code": "NET_BOOK_VALUE_OPENING", "row_label": "III. Giá trị còn lại - Tại ngày đầu năm"},
            {"row_code": "NET_BOOK_VALUE_CLOSING", "row_label": "III. Giá trị còn lại - Tại ngày cuối năm"},
        ],
        "calculation_policy": {},
    },
    "V.13.INVESTMENT_PROPERTY": {
        "title": "Tăng, giảm bất động sản đầu tư",
        "schema_version": 1,
        "columns": [
            {"column_code": "item_label", "column_label": "Khoản mục biến động", "column_group": "", "data_type": "TEXT"},
            {"column_code": "OPENING", "column_label": "Số đầu năm", "column_group": "Biến động", "data_type": "NUMBER"},
            {"column_code": "INCREASE", "column_label": "Tăng trong năm", "column_group": "Biến động", "data_type": "NUMBER"},
            {"column_code": "DECREASE", "column_label": "Giảm trong năm", "column_group": "Biến động", "data_type": "NUMBER"},
            {"column_code": "CLOSING", "column_label": "Số cuối năm", "column_group": "Biến động", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "COST", "row_label": "I. Nguyên giá bất động sản đầu tư"},
            {"row_code": "DEPRECIATION", "row_label": "II. Giá trị hao mòn lũy kế"},
            {"row_code": "NET_BOOK_VALUE", "row_label": "III. Giá trị còn lại"},
        ],
        "calculation_policy": {},
    },
    "V.16.LOANS": {
        "title": "a) Biến động các khoản vay và nợ thuê tài chính",
        "schema_version": 1,
        "columns": [
            {"column_code": "lender_name", "column_label": "Khoản mục / Chủ nợ", "column_group": "", "data_type": "TEXT"},
            {"column_code": "maturity_class", "column_label": "Kỳ hạn (SHORT/LONG)", "column_group": "", "data_type": "ENUM"},
            {"column_code": "opening_principal", "column_label": "Số đầu năm", "column_group": "Nợ gốc vay", "data_type": "NUMBER"},
            {"column_code": "borrowed_in_period", "column_label": "Số tăng (đi vay) trong năm", "column_group": "Biến động trong năm", "data_type": "NUMBER"},
            {"column_code": "principal_repaid_in_period", "column_label": "Số giảm (trả gốc) trong năm", "column_group": "Biến động trong năm", "data_type": "NUMBER"},
            {"column_code": "closing_principal", "column_label": "Số cuối năm", "column_group": "Nợ gốc vay", "data_type": "NUMBER"},
        ],
        "rows": [],
        "calculation_policy": {"exclude_accrued_interest_335": True},
    },
    "V.16.LEASES": {
        "title": "b) Các khoản nợ thuê tài chính theo thời hạn thanh toán",
        "schema_version": 1,
        "columns": [
            {"column_code": "maturity_bucket", "column_label": "Thời hạn", "column_group": "", "data_type": "ENUM"},
            {"column_code": "current_total_lease_payment", "column_label": "Tổng khoản thanh toán", "column_group": "Năm nay", "data_type": "NUMBER"},
            {"column_code": "current_interest_portion", "column_label": "Trả tiền lãi thuê", "column_group": "Năm nay", "data_type": "NUMBER"},
            {"column_code": "current_principal_portion", "column_label": "Trả nợ gốc thuê", "column_group": "Năm nay", "data_type": "NUMBER"},
            {"column_code": "previous_total_lease_payment", "column_label": "Tổng khoản thanh toán", "column_group": "Năm trước", "data_type": "NUMBER"},
            {"column_code": "previous_interest_portion", "column_label": "Trả tiền lãi thuê", "column_group": "Năm trước", "data_type": "NUMBER"},
            {"column_code": "previous_principal_portion", "column_label": "Trả nợ gốc thuê", "column_group": "Năm trước", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "UNDER_1Y", "row_label": "- Từ 1 năm trở xuống"},
            {"row_code": "ONE_TO_FIVE_Y", "row_label": "- Trên 1 năm đến 5 năm"},
            {"row_code": "OVER_5Y", "row_label": "- Trên 5 năm"},
            {"row_code": "TOTAL", "row_label": "Cộng"},
        ],
        "calculation_policy": {},
    },
    "V.16.OVERDUE": {
        "title": "c) Các khoản vay và nợ thuê tài chính quá hạn chưa thanh toán",
        "schema_version": 1,
        "columns": [
            {"column_code": "lender_name", "column_label": "Chủ nợ / Hợp đồng", "column_group": "", "data_type": "TEXT"},
            {"column_code": "closing_overdue_principal", "column_label": "Gốc quá hạn", "column_group": "Cuối năm", "data_type": "NUMBER"},
            {"column_code": "closing_overdue_interest", "column_label": "Lãi quá hạn", "column_group": "Cuối năm", "data_type": "NUMBER"},
            {"column_code": "opening_overdue_principal", "column_label": "Gốc quá hạn", "column_group": "Đầu năm", "data_type": "NUMBER"},
            {"column_code": "opening_overdue_interest", "column_label": "Lãi quá hạn", "column_group": "Đầu năm", "data_type": "NUMBER"},
            {"column_code": "overdue_reason", "column_label": "Nguyên nhân quá hạn", "column_group": "", "data_type": "TEXT"},
        ],
        "rows": [],
        "calculation_policy": {},
    },
    "V.17.SUPPLIERS": {
        "title": "Phải trả người bán (Ngắn hạn và Dài hạn)",
        "schema_version": 1,
        "columns": [
            {"column_code": "maturity_class", "column_label": "Kỳ hạn (SHORT/LONG)", "column_group": "", "data_type": "ENUM"},
            {"column_code": "supplier_code", "column_label": "Mã NCC", "column_group": "Nhà cung cấp", "data_type": "TEXT"},
            {"column_code": "supplier_name", "column_label": "Tên nhà cung cấp", "column_group": "Nhà cung cấp", "data_type": "TEXT"},
            {"column_code": "closing_amount", "column_label": "Giá trị", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "closing_repayable_amount", "column_label": "Số có khả năng trả nợ", "column_group": "Số cuối năm", "data_type": "NUMBER"},
            {"column_code": "opening_amount", "column_label": "Giá trị", "column_group": "Số đầu năm", "data_type": "NUMBER"},
            {"column_code": "opening_repayable_amount", "column_label": "Số có khả năng trả nợ", "column_group": "Số đầu năm", "data_type": "NUMBER"},
        ],
        "rows": [],
        "calculation_policy": {"no_arbitrary_netting_331": True},
    },
    "V.19.TAX": {
        "title": "Thuế và các khoản phải nộp / phải thu Nhà nước",
        "schema_version": 1,
        "columns": [
            {"column_code": "tax_type", "column_label": "Sắc thuế / Khoản nộp", "column_group": "", "data_type": "TEXT"},
            {"column_code": "balance_type", "column_label": "Phân loại (PAYABLE/RECEIVABLE)", "column_group": "", "data_type": "ENUM"},
            {"column_code": "opening_amount", "column_label": "Số đầu năm", "column_group": "Biến động nghĩa vụ thuế", "data_type": "NUMBER"},
            {"column_code": "assessed_in_year", "column_label": "Số phải nộp trong năm", "column_group": "Biến động nghĩa vụ thuế", "data_type": "NUMBER"},
            {"column_code": "paid_in_year", "column_label": "Số đã thực nộp trong năm", "column_group": "Biến động nghĩa vụ thuế", "data_type": "NUMBER"},
            {"column_code": "adjustment_amount", "column_label": "Điều chỉnh khác", "column_group": "Biến động nghĩa vụ thuế", "data_type": "NUMBER"},
            {"column_code": "closing_amount", "column_label": "Số cuối năm", "column_group": "Biến động nghĩa vụ thuế", "data_type": "NUMBER"},
        ],
        "rows": [],
        "calculation_policy": {
            "formula": "closing_amount = opening_amount + assessed_in_year - paid_in_year + adjustment_amount",
            "exclude_draft_tax_payments": True,
        },
    },
    "V.25.PROVISIONS": {
        "title": "Dự phòng phải trả (Ngắn hạn và Dài hạn)",
        "schema_version": 1,
        "columns": [
            {"column_code": "provision_type", "column_label": "Loại dự phòng phải trả", "column_group": "", "data_type": "TEXT"},
            {"column_code": "maturity_class", "column_label": "Kỳ hạn (SHORT/LONG)", "column_group": "", "data_type": "ENUM"},
            {"column_code": "opening_amount", "column_label": "Số đầu năm", "column_group": "Biến động", "data_type": "NUMBER"},
            {"column_code": "increase_amount", "column_label": "Trích lập thêm trong năm", "column_group": "Biến động", "data_type": "NUMBER"},
            {"column_code": "decrease_amount", "column_label": "Sử dụng / Hoàn nhập trong năm", "column_group": "Biến động", "data_type": "NUMBER"},
            {"column_code": "closing_amount", "column_label": "Số cuối năm", "column_group": "Biến động", "data_type": "NUMBER"},
        ],
        "rows": [],
        "calculation_policy": {"formula": "closing_amount = opening_amount + increase_amount - decrease_amount"},
    },
    "V.27.MOVEMENT": {
        "title": "a) Bảng đối chiếu biến động của vốn chủ sở hữu",
        "schema_version": 1,
        "columns": [
            {"column_code": "movement_label", "column_label": "Chỉ tiêu biến động", "column_group": "", "data_type": "TEXT"},
            {"column_code": "OWNER_CAPITAL", "column_label": "Vốn góp của CSH (4111)", "column_group": "Thành phần vốn chủ sở hữu", "data_type": "NUMBER"},
            {"column_code": "SHARE_PREMIUM", "column_label": "Thặng dư vốn CP (4112)", "column_group": "Thành phần vốn chủ sở hữu", "data_type": "NUMBER"},
            {"column_code": "OTHER_CAPITAL", "column_label": "Vốn khác của CSH (4118)", "column_group": "Thành phần vốn chủ sở hữu", "data_type": "NUMBER"},
            {"column_code": "REVALUATION_DIFF", "column_label": "Chênh lệch đánh giá lại TS (412)", "column_group": "Thành phần vốn chủ sở hữu", "data_type": "NUMBER"},
            {"column_code": "FX_DIFF", "column_label": "Chênh lệch tỷ giá (413)", "column_group": "Thành phần vốn chủ sở hữu", "data_type": "NUMBER"},
            {"column_code": "RETAINED_EARNINGS", "column_label": "LNST chưa phân phối & các quỹ (421, 414, 418)", "column_group": "Thành phần vốn chủ sở hữu", "data_type": "NUMBER"},
            {"column_code": "TOTAL", "column_label": "Cộng vốn chủ sở hữu", "column_group": "Tổng hợp", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "OPENING_PREV_YEAR", "row_label": "Số dư đầu năm trước"},
            {"row_code": "INCREASE_PREV_YEAR", "row_label": "- Tăng trong năm trước"},
            {"row_code": "DECREASE_PREV_YEAR", "row_label": "- Giảm trong năm trước"},
            {"row_code": "OPENING_CURR_YEAR", "row_label": "Số dư đầu năm nay"},
            {"row_code": "CAPITAL_INCREASE_CURR", "row_label": "- Tăng vốn trong năm nay"},
            {"row_code": "NET_PROFIT_CURR", "row_label": "- Lãi (lỗ) trong năm nay"},
            {"row_code": "DIVIDEND_DISTRIBUTION_CURR", "row_label": "- Chia cổ tức, phân phối lợi nhuận"},
            {"row_code": "OTHER_DECREASE_CURR", "row_label": "- Giảm khác trong năm nay"},
            {"row_code": "CLOSING_CURR_YEAR", "row_label": "Số dư cuối năm nay"},
        ],
        "calculation_policy": {"closing_row": "CLOSING_CURR_YEAR"},
    },
    "V.27.SHARES": {
        "title": "b) Cổ phiếu",
        "schema_version": 1,
        "columns": [
            {"column_code": "share_metric", "column_label": "Chỉ tiêu cổ phiếu", "column_group": "", "data_type": "TEXT"},
            {"column_code": "closing_shares", "column_label": "Số cuối năm", "column_group": "Số lượng", "data_type": "NUMBER"},
            {"column_code": "opening_shares", "column_label": "Số đầu năm", "column_group": "Số lượng", "data_type": "NUMBER"},
        ],
        "rows": [],
        "calculation_policy": {"do_not_guess_from_411_balance": True},
    },
    "V.27.DIVIDENDS": {
        "title": "c) Cổ tức, lợi nhuận đã công bố và chi trả",
        "schema_version": 1,
        "columns": [
            {"column_code": "distribution_type", "column_label": "Nội dung phân phối", "column_group": "", "data_type": "TEXT"},
            {"column_code": "payment_form", "column_label": "Hình thức (CASH/STOCK)", "column_group": "", "data_type": "ENUM"},
            {"column_code": "distribution_amount", "column_label": "Số công bố phân phối", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "paid_amount", "column_label": "Số đã chi trả", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "remaining_payable", "column_label": "Số còn phải trả", "column_group": "Giá trị", "data_type": "NUMBER"},
        ],
        "rows": [],
        "calculation_policy": {"stock_dividend_is_non_cash": True},
    },
    "VII.1.REVENUE": {
        "title": "Tổng doanh thu bán hàng và cung cấp dịch vụ",
        "schema_version": 1,
        "columns": [
            {"column_code": "category_name", "column_label": "Khoản mục doanh thu", "column_group": "", "data_type": "TEXT"},
            {"column_code": "current_year_amount", "column_label": "Năm nay", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "previous_year_amount", "column_label": "Năm trước", "column_group": "Giá trị", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "REV_GOODS", "row_label": "- Doanh thu bán hàng hóa, thành phẩm"},
            {"row_code": "REV_SERVICES", "row_label": "- Doanh thu cung cấp dịch vụ"},
            {"row_code": "REV_OTHER", "row_label": "- Doanh thu khác"},
            {"row_code": "TOTAL", "row_label": "Cộng doanh thu bán hàng và cung cấp dịch vụ"},
        ],
        "calculation_policy": {"reconcile_b02_code": "01"},
    },
    "VII.2.DEDUCTIONS": {
        "title": "Các khoản giảm trừ doanh thu",
        "schema_version": 1,
        "columns": [
            {"column_code": "category_name", "column_label": "Khoản mục giảm trừ", "column_group": "", "data_type": "TEXT"},
            {"column_code": "current_year_amount", "column_label": "Năm nay", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "previous_year_amount", "column_label": "Năm trước", "column_group": "Giá trị", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "TRADE_DISCOUNT", "row_label": "- Chiết khấu thương mại (5211)"},
            {"row_code": "SALES_RETURNS", "row_label": "- Hàng bán bị trả lại (5212)"},
            {"row_code": "SALES_ALLOWANCES", "row_label": "- Giảm giá hàng bán (5213)"},
            {"row_code": "TOTAL", "row_label": "Cộng các khoản giảm trừ doanh thu"},
        ],
        "calculation_policy": {"reconcile_b02_code": "02"},
    },
    "VII.3.COGS": {
        "title": "Giá vốn hàng bán",
        "schema_version": 1,
        "columns": [
            {"column_code": "category_name", "column_label": "Khoản mục giá vốn", "column_group": "", "data_type": "TEXT"},
            {"column_code": "current_year_amount", "column_label": "Năm nay", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "previous_year_amount", "column_label": "Năm trước", "column_group": "Giá trị", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "COGS_OPERATING", "row_label": "- Giá vốn của hàng hóa, thành phẩm, dịch vụ đã bán"},
            {"row_code": "INVENTORY_PROVISION", "row_label": "- Dự phòng giảm giá hàng tồn kho"},
            {"row_code": "TOTAL", "row_label": "Cộng giá vốn hàng bán"},
        ],
        "calculation_policy": {"reconcile_b02_code": "11"},
    },
    "VII.4.IP_DISPOSAL": {
        "title": "Lãi, lỗ từ việc bán, thanh lý bất động sản đầu tư",
        "schema_version": 1,
        "columns": [
            {"column_code": "item_name", "column_label": "Chỉ tiêu", "column_group": "", "data_type": "TEXT"},
            {"column_code": "current_year_amount", "column_label": "Năm nay", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "previous_year_amount", "column_label": "Năm trước", "column_group": "Giá trị", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "SALE_PROCEEDS", "row_label": "- Doanh thu bán, thanh lý BĐSĐT"},
            {"row_code": "CARRYING_AMOUNT", "row_label": "- Giá trị còn lại của BĐSĐT"},
            {"row_code": "DISPOSAL_EXPENSES", "row_label": "- Chi phí nhượng bán, thanh lý BĐSĐT"},
            {"row_code": "NET_GAIN_LOSS", "row_label": "Lãi (lỗ) thuần từ bán, thanh lý BĐSĐT"},
        ],
        "calculation_policy": {
            "formula": "NET_GAIN_LOSS = SALE_PROCEEDS - CARRYING_AMOUNT - DISPOSAL_EXPENSES",
            "reconcile_b02_code": "21",
        },
    },
    "VII.11.CIT": {
        "title": "Chi phí thuế thu nhập doanh nghiệp",
        "schema_version": 1,
        "columns": [
            {"column_code": "item_name", "column_label": "Chỉ tiêu", "column_group": "", "data_type": "TEXT"},
            {"column_code": "current_year_amount", "column_label": "Năm nay", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "previous_year_amount", "column_label": "Năm trước", "column_group": "Giá trị", "data_type": "NUMBER"},
        ],
        "rows": [
            {"row_code": "profit_before_tax", "row_label": "1. Tổng lợi nhuận kế toán trước thuế"},
            {"row_code": "statutory_tax_rate", "row_label": "2. Thuế suất thuế TNDN theo quy định (%)"},
            {"row_code": "tax_at_statutory_rate", "row_label": "3. Thuế TNDN tính theo thuế suất phổ thông"},
            {"row_code": "non_taxable_income_adjustment", "row_label": "4. Điều chỉnh giảm: Thu nhập không chịu thuế"},
            {"row_code": "non_deductible_expense_adjustment", "row_label": "5. Điều chỉnh tăng: Chi phí không được trừ"},
            {"row_code": "prior_year_tax_adjustment", "row_label": "6. Điều chỉnh thuế TNDN của các năm trước"},
            {"row_code": "other_tax_adjustment", "row_label": "7. Các khoản điều chỉnh khác"},
            {"row_code": "current_tax_expense", "row_label": "8. Chi phí thuế TNDN hiện hành (B02 Mã 51)"},
            {"row_code": "deferred_tax_expense", "row_label": "9. Chi phí (thu nhập) thuế TNDN hoãn lại (B02 Mã 52)"},
            {"row_code": "total_tax_expense", "row_label": "10. Tổng chi phí thuế TNDN"},
        ],
        "calculation_policy": {
            "reconcile_b02_51": "current_tax_expense",
            "reconcile_b02_52": "deferred_tax_expense",
            "do_not_force_20_percent": True,
        },
    },
    "VIII.1.RESTRICTED_CASH": {
        "title": "Các khoản tiền do doanh nghiệp nắm giữ nhưng không được sử dụng",
        "schema_version": 1,
        "columns": [
            {"column_code": "restriction_type", "column_label": "Loại tiền bị hạn chế", "column_group": "", "data_type": "TEXT"},
            {"column_code": "amount", "column_label": "Giá trị", "column_group": "", "data_type": "NUMBER"},
            {"column_code": "restriction_reason", "column_label": "Lý do không được sử dụng", "column_group": "", "data_type": "TEXT"},
            {"column_code": "source_reference", "column_label": "Căn cứ / Hồ sơ", "column_group": "", "data_type": "TEXT"},
        ],
        "rows": [],
        "calculation_policy": {},
    },
    "VIII.2.NON_CASH": {
        "title": "Các giao dịch không bằng tiền ảnh hưởng đến Báo cáo lưu chuyển tiền tệ trong tương lai",
        "schema_version": 1,
        "columns": [
            {"column_code": "transaction_type", "column_label": "Loại giao dịch phi tiền tệ", "column_group": "", "data_type": "TEXT"},
            {"column_code": "current_amount", "column_label": "Năm nay", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "previous_amount", "column_label": "Năm trước", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "description", "column_label": "Nội dung giải trình", "column_group": "", "data_type": "TEXT"},
        ],
        "rows": [],
        "calculation_policy": {"do_not_inflate_b03_cash_flows": True},
    },
    "VIII.3.BORROWINGS_RECEIVED": {
        "title": "Số tiền đi vay thực thu trong kỳ",
        "schema_version": 1,
        "columns": [
            {"column_code": "borrowing_type", "column_label": "Hình thức đi vay", "column_group": "", "data_type": "TEXT"},
            {"column_code": "amount", "column_label": "Số tiền thực thu trong kỳ", "column_group": "", "data_type": "NUMBER"},
            {"column_code": "source_reference", "column_label": "Tham chiếu nguồn", "column_group": "", "data_type": "TEXT"},
        ],
        "rows": [],
        "calculation_policy": {"reconcile_b03_code": "33"},
    },
    "VIII.4.PRINCIPAL_REPAID": {
        "title": "Số tiền đã thực trả gốc vay trong kỳ",
        "schema_version": 1,
        "columns": [
            {"column_code": "repayment_type", "column_label": "Hình thức trả nợ gốc", "column_group": "", "data_type": "TEXT"},
            {"column_code": "amount", "column_label": "Số tiền thực trả gốc trong kỳ", "column_group": "", "data_type": "NUMBER"},
            {"column_code": "source_reference", "column_label": "Tham chiếu nguồn", "column_group": "", "data_type": "TEXT"},
        ],
        "rows": [],
        "calculation_policy": {"reconcile_b03_code": "34", "exclude_interest_paid": True},
    },
    "VIII.5.SUBSIDIARY_MNA": {
        "title": "Mua và thanh lý công ty con hoặc đơn vị kinh doanh khác trong kỳ",
        "schema_version": 1,
        "columns": [
            {"column_code": "subsidiary_name", "column_label": "Đơn vị được mua / thanh lý", "column_group": "", "data_type": "TEXT"},
            {"column_code": "transaction_type", "column_label": "Loại giao dịch (ACQUISITION/DISPOSAL)", "column_group": "", "data_type": "ENUM"},
            {"column_code": "total_transaction_value", "column_label": "Tổng giá trị giao dịch", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "cash_paid_or_received", "column_label": "Tiền đã chi / đã thu", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "cash_equivalents_of_subsidiary", "column_label": "Tiền và TĐT của công ty con", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "non_cash_assets_value", "column_label": "Giá trị tài sản phi tiền tệ", "column_group": "Giá trị", "data_type": "NUMBER"},
            {"column_code": "liabilities_value", "column_label": "Giá trị nợ phải trả", "column_group": "Giá trị", "data_type": "NUMBER"},
        ],
        "rows": [],
        "calculation_policy": {},
    },
    "IX.2.SUBSEQUENT_EVENTS": {
        "title": "Những sự kiện phát sinh sau ngày kết thúc kỳ kế toán",
        "schema_version": 1,
        "columns": [
            {"column_code": "event_date", "column_label": "Ngày sự kiện", "column_group": "", "data_type": "DATE"},
            {"column_code": "event_title", "column_label": "Sự kiện", "column_group": "", "data_type": "TEXT"},
            {"column_code": "event_classification", "column_label": "Phân loại (ADJUSTING/NON_ADJUSTING)", "column_group": "", "data_type": "ENUM"},
            {"column_code": "financial_impact_amount", "column_label": "Ảnh hưởng tài chính ước tính", "column_group": "", "data_type": "NUMBER"},
            {"column_code": "evidence_reference", "column_label": "Căn cứ", "column_group": "", "data_type": "TEXT"},
        ],
        "rows": [],
        "calculation_policy": {},
    },
    "IX.3.RELATED_PARTIES": {
        "title": "Giao dịch và số dư với các bên liên quan",
        "schema_version": 1,
        "columns": [
            {"column_code": "related_party_name", "column_label": "Bên liên quan", "column_group": "", "data_type": "TEXT"},
            {"column_code": "relationship_type", "column_label": "Mối quan hệ", "column_group": "", "data_type": "TEXT"},
            {"column_code": "transaction_type", "column_label": "Nội dung giao dịch", "column_group": "", "data_type": "TEXT"},
            {"column_code": "transaction_amount", "column_label": "Giá trị giao dịch trong kỳ", "column_group": "Số liệu", "data_type": "NUMBER"},
            {"column_code": "closing_balance", "column_label": "Số dư cuối kỳ", "column_group": "Số liệu", "data_type": "NUMBER"},
            {"column_code": "opening_balance", "column_label": "Số dư đầu kỳ", "column_group": "Số liệu", "data_type": "NUMBER"},
        ],
        "rows": [],
        "calculation_policy": {},
    },
}


# ============================================================================
# 4. SEEDING B09-DN, B09-DNKLT, B09a-DN TEMPLATES, SECTIONS, ITEMS & TABLES
# ============================================================================

def _seed_sections_and_items_for_version(
    tv: FinancialStatementTemplateVersion,
    sections_spec: list[tuple],
    items_by_section: dict[str, list[tuple]],
    SectionModel,
    ItemModel,
    TableModel,
):
    for sec_code, sec_title, sec_order, sec_req in sections_spec:
        sec_obj, _ = SectionModel.objects.update_or_create(
            template_version=tv,
            section_code=sec_code,
            defaults={
                "section_title": sec_title,
                "display_order": sec_order,
                "is_required": sec_req,
                "applicability_rule_json": {"legal_form_code": tv.template.legal_form_code},
                "status": "ACTIVE",
            },
        )
        sec_items = items_by_section.get(sec_code, [])
        for idx, item_spec in enumerate(sec_items, start=1):
            (
                note_code,
                note_title,
                content_type,
                data_origin,
                source_mod,
                rel_rep,
                rel_inds,
                is_req,
                c_schema,
            ) = item_spec
            item_obj, _ = ItemModel.objects.update_or_create(
                section=sec_obj,
                note_code=note_code,
                defaults={
                    "note_title": note_title,
                    "content_type": content_type,
                    "display_order": sec_order * 100 + idx,
                    "content_schema_json": c_schema or {},
                    "schema_version": 1,
                    "data_origin": data_origin,
                    "source_module": source_mod,
                    "related_report_code": rel_rep,
                    "related_indicator_codes": rel_inds,
                    "is_required": is_req,
                    "applicability_rule_json": {"conditional_required": not is_req},
                    "validation_rule_json": [f"B09-VAL-{note_code}"],
                    "status": "ACTIVE",
                },
            )

            subtables = (c_schema or {}).get("subtables", [])
            if not subtables and content_type in ("TABLE", "MOVEMENT_TABLE", "MULTI_LEVEL_TABLE"):
                subtables = [f"{note_code}.MAIN"]

            for t_idx, t_code in enumerate(subtables, start=1):
                t_def = TABLE_SCHEMAS_DEF.get(
                    t_code,
                    {
                        "title": note_title,
                        "schema_version": 1,
                        "columns": [
                            {"column_code": "item_name", "column_label": "Khoản mục", "column_group": "", "data_type": "TEXT"},
                            {"column_code": "closing_amount", "column_label": "Số cuối kỳ / Năm nay", "column_group": "Giá trị", "data_type": "NUMBER"},
                            {"column_code": "opening_amount", "column_label": "Số đầu kỳ / Năm trước", "column_group": "Giá trị", "data_type": "NUMBER"},
                        ],
                        "rows": [],
                        "calculation_policy": {},
                    },
                )
                TableModel.objects.update_or_create(
                    note_item=item_obj,
                    table_code=t_code,
                    defaults={
                        "table_title": t_def["title"],
                        "schema_version": t_def.get("schema_version", 1),
                        "column_schema_json": t_def["columns"],
                        "row_schema_json": t_def.get("rows", []),
                        "calculation_policy_json": t_def.get("calculation_policy", {}),
                        "display_order": t_idx * 10,
                    },
                )


def seed_financial_notes_uc_rpt_06(apps=None, schema_editor=None):
    if apps is not None:
        ActionModel = apps.get_model("iam", "PermissionAction")
        ResourceModel = apps.get_model("iam", "PermissionResource")
        PermissionModel = apps.get_model("iam", "Permission")
        TemplateModel = apps.get_model("reporting", "FinancialStatementTemplate")
        VersionModel = apps.get_model("reporting", "FinancialStatementTemplateVersion")
        SectionModel = apps.get_model("reporting", "FinancialNoteSection")
        ItemModel = apps.get_model("reporting", "FinancialNoteItem")
        TableModel = apps.get_model("reporting", "FinancialNoteTable")
    else:
        ActionModel = PermissionAction
        ResourceModel = PermissionResource
        PermissionModel = Permission
        TemplateModel = FinancialStatementTemplate
        VersionModel = FinancialStatementTemplateVersion
        SectionModel = FinancialNoteSection
        ItemModel = FinancialNoteItem
        TableModel = FinancialNoteTable

    res_under, _ = ResourceModel.objects.get_or_create(
        code="RPT_FINANCIAL_NOTES",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "RPT",
            "name": "Bản thuyết minh báo cáo tài chính (UC-RPT-06)",
            "status": "ACTIVE",
        },
    )
    res_dot, _ = ResourceModel.objects.get_or_create(
        code="RPT.FINANCIAL_NOTES",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "RPT",
            "name": "Bản thuyết minh báo cáo tài chính (dot)",
            "status": "ACTIVE",
        },
    )
    for act_code, act_name, u_code, d_code in B09_PERMISSIONS_DEF:
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
                    "description": f"{act_name} (UC-RPT-06)",
                    "status": "ACTIVE",
                },
            )

    b09_dn_items_map = {
        "I": SECTION_I_ITEMS_SPEC,
        "II": SECTION_II_ITEMS_SPEC,
        "III": SECTION_III_ITEMS_SPEC,
        "IV": SECTION_IV_29_ITEMS_SPEC,
        "V": SECTION_V_32_ITEMS_SPEC,
        "VII": SECTION_VII_11_ITEMS_SPEC,
        "VIII": SECTION_VIII_5_ITEMS_SPEC,
        "IX": SECTION_IX_8_ITEMS_SPEC,
        "X": SECTION_X_ITEMS_SPEC,
    }

    # For B09-DNKLT, Section IX.6 and Section I have specific non-going-concern mandatory fields
    b09_dnklt_ix_items = list(SECTION_IX_8_ITEMS_SPEC)
    b09_dnklt_ix_items[5] = (
        "IX.6",
        "6. Giải trình về việc doanh nghiệp không đáp ứng giả định hoạt động liên tục và cơ sở đánh giá lại tài sản/nợ phải trả",
        "MIXED",
        "MANUAL",
        "RPT",
        "",
        [],
        True,
        {
            "is_non_going_concern_disclosure": True,
            "required_fields": [
                "non_going_concern_reason",
                "termination_or_dissolution_plan",
                "decision_authority",
                "decision_number",
                "decision_date",
                "management_intention_reference",
                "asset_remeasurement_basis",
                "liability_remeasurement_basis",
                "reclassification_explanation",
                "financial_impact",
                "source_reference",
                "confirmed_by",
            ],
        },
    )
    b09_dnklt_items_map = {**b09_dn_items_map, "IX": b09_dnklt_ix_items}

    b09a_items_map = {
        "I": SECTION_I_ITEMS_SPEC,
        "II": SECTION_II_ITEMS_SPEC,
        "III": SECTION_III_ITEMS_SPEC,
        "IV": SECTION_IV_29_ITEMS_SPEC,
        "VI": SECTION_VI_B09A_10_ITEMS_SPEC,
    }

    templates_cfg = [
        (
            "FSR-04",
            "B09-DN",
            "Bản thuyết minh báo cáo tài chính năm",
            ["ANNUAL_GOING_CONCERN"],
            "ANNUAL",
            "Thông tư 99/2025/TT-BTC (Phụ lục IV)",
            B09_DN_SECTIONS_SPEC,
            b09_dn_items_map,
        ),
        (
            "FSR-08",
            "B09-DNKLT",
            "Bản thuyết minh báo cáo tài chính năm – Không đáp ứng giả định hoạt động liên tục",
            ["ANNUAL_NON_GOING_CONCERN"],
            "ANNUAL",
            "Thông tư 99/2025/TT-BTC (Phụ lục IV – DN không hoạt động liên tục)",
            B09_DN_SECTIONS_SPEC,
            b09_dnklt_items_map,
        ),
        (
            "FSR-12",
            "B09a-DN",
            "Bản thuyết minh báo cáo tài chính chọn lọc (Giữa niên độ)",
            ["INTERIM_FULL", "INTERIM_CONDENSED"],
            "INTERIM",
            "Thông tư 99/2025/TT-BTC (Phụ lục IV – Giữa niên độ)",
            B09A_DN_SECTIONS_SPEC,
            b09a_items_map,
        ),
    ]

    col_schema = [
        {"slot_code": "CURRENT", "label": "Kỳ này / Năm nay"},
        {"slot_code": "COMPARATIVE", "label": "Kỳ so sánh / Năm trước"},
    ]

    for int_code, legal_code, name, bundle_types, gran, legal_circ, sec_spec, items_map in templates_cfg:
        tmpl, _ = TemplateModel.objects.update_or_create(
            internal_code=int_code,
            defaults={
                "legal_form_code": legal_code,
                "name": name,
                "component_type": "FINANCIAL_NOTES",
                "applicable_bundle_types": bundle_types,
                "period_granularity": gran,
                "supports_cash_flow_method": False,
                "target_uc_code": "UC-RPT-06",
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
                "effective_from": date(2020, 1, 1),
                "column_schema": col_schema,
                "is_active": True,
            },
        )
        _seed_sections_and_items_for_version(tv, sec_spec, items_map, SectionModel, ItemModel, TableModel)

    # Also ensure FSR-16 (if present for INTERIM_CONDENSED) has B09a-DN sections seeded
    fsr16 = TemplateModel.objects.filter(internal_code="FSR-16").first()
    if fsr16:
        tv16 = fsr16.versions.filter(is_active=True).first()
        if tv16:
            _seed_sections_and_items_for_version(tv16, B09A_DN_SECTIONS_SPEC, b09a_items_map, SectionModel, ItemModel, TableModel)


def ensure_b09_templates_seeded():
    b09_dn = FinancialStatementTemplate.objects.filter(internal_code="FSR-04").first()
    b09_dnklt = FinancialStatementTemplate.objects.filter(internal_code="FSR-08").first()
    b09a_dn = FinancialStatementTemplate.objects.filter(internal_code="FSR-12").first()
    needs_seed = False
    if not b09_dn or not b09_dnklt or not b09a_dn:
        needs_seed = True
    else:
        v_dn = b09_dn.versions.filter(is_active=True).first()
        v_a = b09a_dn.versions.filter(is_active=True).first()
        if not v_dn or v_dn.note_sections.count() != 9 or not v_a or v_a.note_sections.count() != 5:
            needs_seed = True
    if needs_seed:
        seed_financial_notes_uc_rpt_06()


# ============================================================================
# 5. PERMISSION, COMPANY & SCOPE HELPERS
# ============================================================================

def _resolve_iam_account(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None
    return getattr(user, "iam_account", None)


def _log_b09_audit(company: Company, user, action_name: str, entity_id: str, metadata: dict | None = None):
    iam_acc = _resolve_iam_account(user)
    try:
        AuditLog.objects.create(
            company_id=company.id,
            actor_id=iam_acc.id if iam_acc else None,
            action=action_name[:50],
            entity_type="FinancialStatementRun",
            entity_id=str(entity_id)[:64],
            metadata=metadata or {},
        )
    except Exception:
        pass


def get_b09_user_permissions(user, company: Company) -> set[str]:
    if not user or not getattr(user, "is_authenticated", False):
        return set()
    if getattr(user, "is_superuser", False):
        all_codes = set()
        for s in B09_PERMISSION_ALIASES.values():
            all_codes |= s
        return all_codes

    iam_acc = _resolve_iam_account(user)
    if not iam_acc:
        return set()

    codes: set[str] = set()
    for assignment in effective_assignments(iam_acc, company):
        codes |= assignment_permission_codes(assignment)

    now = timezone.now()
    overrides = (
        UserPermissionOverride.objects.filter(
            company_membership__user=iam_acc,
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


def has_b09_permission(user, company: Company, perm_key: str) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    iam_acc = _resolve_iam_account(user)
    if not iam_acc:
        return False

    aliases = B09_PERMISSION_ALIASES.get(perm_key, {perm_key})
    now = timezone.now()
    if (
        UserPermissionOverride.objects.filter(
            company_membership__user=iam_acc,
            company_membership__company=company,
            permission__code__in=aliases,
            effect="DENY",
            revoked_at__isnull=True,
            valid_from__lte=now,
        )
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now))
        .exists()
    ):
        return False

    effective_codes = get_b09_user_permissions(user, company)
    return bool(effective_codes & aliases)


def require_b09_permission(user, company: Company, perm_key: str = "RPT_FINANCIAL_NOTES_VIEW") -> None:
    if not user or not getattr(user, "is_authenticated", False):
        raise PermissionDenied({
            "error_code": "EF-01",
            "detail": "Chưa đăng nhập hoặc phiên làm việc đã hết hạn.",
        })
    iam_acc = _resolve_iam_account(user)
    if not getattr(user, "is_superuser", False):
        if not iam_acc or not CompanyMembership.objects.filter(
            user=iam_acc,
            company=company,
            membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
        ).exists():
            raise PermissionDenied({
                "error_code": "EF-03",
                "detail": "Người dùng không thuộc phạm vi doanh nghiệp được chọn.",
            })
    if not has_b09_permission(user, company, perm_key):
        err_code = "EF-31" if perm_key == "RPT_FINANCIAL_NOTES_DETAIL_VIEW" else "EF-02"
        raise PermissionDenied({
            "error_code": err_code,
            "required_permission": perm_key,
            "detail": f"Bạn không có quyền '{perm_key}' trên Bản thuyết minh báo cáo tài chính.",
        })


def resolve_b09_allowed_branches(user, company: Company) -> list[str] | None:
    from reporting.financial_bundle_services import resolve_allowed_branch_ids
    return resolve_allowed_branch_ids(user, company)


def check_b09_scope_access(user, company: Company, reporting_scope: str, branch: Branch | None) -> None:
    allowed = resolve_b09_allowed_branches(user, company)
    if allowed is None:
        return
    if reporting_scope == "COMPANY":
        raise PermissionDenied({
            "error_code": "EF-03",
            "detail": "Tài khoản bị giới hạn phạm vi chi nhánh (Data Scope), không được xem thuyết minh toàn doanh nghiệp (COMPANY).",
        })
    if branch and str(branch.id) not in allowed:
        raise PermissionDenied({
            "error_code": "EF-03",
            "detail": f"Chi nhánh '{branch.code}' nằm ngoài phạm vi dữ liệu được phân quyền.",
        })


def resolve_b09_company(request, explicit_company_id: Any = None) -> Company:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        raise PermissionDenied({"error_code": "EF-01", "detail": "Chưa đăng nhập."})

    params = {}
    if hasattr(request, "query_params"):
        params.update(request.query_params.dict())
    if hasattr(request, "data") and isinstance(request.data, dict):
        params.update(request.data)

    cid = explicit_company_id or params.get("company_id") or params.get("company")
    if not cid:
        iam_acc = _resolve_iam_account(user)
        if iam_acc:
            mem = (
                CompanyMembership.objects.filter(
                    user=iam_acc,
                    membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
                )
                .select_related("company__accounting_currency")
                .first()
            )
            if mem:
                return mem.company
        first_co = Company.objects.select_related("accounting_currency").first()
        if first_co and getattr(user, "is_superuser", False):
            return first_co
        raise ValidationError({
            "error_code": "EF-03",
            "company_id": "Phải xác định doanh nghiệp làm việc (company_id).",
        })

    try:
        company = Company.objects.select_related("accounting_currency").get(pk=cid)
    except (Company.DoesNotExist, ValueError, TypeError):
        raise ValidationError({
            "error_code": "EF-03",
            "company_id": "Doanh nghiệp không tồn tại hoặc không hợp lệ.",
        })

    if not getattr(user, "is_superuser", False):
        iam_acc = _resolve_iam_account(user)
        if not iam_acc or not CompanyMembership.objects.filter(
            user=iam_acc,
            company=company,
            membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
        ).exists():
            raise PermissionDenied({
                "error_code": "EF-03",
                "detail": "Người dùng không thuộc doanh nghiệp được yêu cầu.",
            })
    return company


def compute_b09_gl_snapshot_meta(
    company: Company,
    end_date: date,
    branch: Branch | None = None,
) -> tuple[str, datetime | None]:
    qs = JournalEntry.objects.filter(
        company=company,
        status__in=("POSTED", "REVERSED"),
        posting_date__lte=end_date,
    )
    if branch is not None:
        qs = qs.filter(branch=branch)
    agg = qs.aggregate(
        max_posted=Max("posted_at"),
        max_created=Max("created_at"),
    )
    last_ts = agg["max_posted"] or agg["max_created"]
    count = qs.count()
    raw = f"{company.id}:{branch.id if branch else 'ALL'}:{end_date.isoformat()}:{count}:{last_ts.isoformat() if last_ts else 'NONE'}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32], last_ts


def is_b09_run_stale(run: FinancialStatementRun) -> bool:
    if not run.source_snapshot_hash:
        return False
    eff_branch = run.branch if run.reporting_scope == "BRANCH" else None
    curr_hash, curr_ts = compute_b09_gl_snapshot_meta(
        run.company,
        run.period_end_date,
        eff_branch,
    )
    if curr_hash != run.source_snapshot_hash:
        return True
    if curr_ts and run.source_last_posted_at and curr_ts > run.source_last_posted_at:
        return True
    return False


# ============================================================================
# 6. CANONICAL B09 ENGINE: POPULATE SECTIONS, ITEMS, TABLES & REFERENCES
# ============================================================================

def _resolve_linked_component_runs(
    run: FinancialStatementRun,
    bundle: FinancialStatementBundle | None = None,
) -> dict[str, FinancialStatementRun | None]:
    """
    Resolves the exact B01, B02, and B03 Statement Runs linked to this B09 Run.
    If opened from a Bundle (or linked to a Bundle), strictly uses that Bundle Version's component runs
    (never substituting a newer B01/B02/B03 run for an older Bundle Version! - Section 1.2.C, TC-RPT-06-08, 09).
    """
    linked: dict[str, FinancialStatementRun | None] = {
        "FINANCIAL_POSITION": None,
        "BUSINESS_RESULT": None,
        "CASH_FLOW": None,
    }
    target_bundle = bundle
    if target_bundle is None:
        comp_link = (
            FinancialStatementBundleComponent.objects.filter(
                statement_run=run,
                component_type="FINANCIAL_NOTES",
            )
            .select_related("bundle")
            .order_by("-bundle__bundle_version")
            .first()
        )
        if comp_link:
            target_bundle = comp_link.bundle

    if target_bundle is not None:
        for bcomp in target_bundle.components.select_related("statement_run__template"):
            if bcomp.component_type in linked and bcomp.statement_run is not None:
                linked[bcomp.component_type] = bcomp.statement_run
        return linked

    # Otherwise, find matching runs in the exact same company, fiscal_period, and reporting_scope
    base_qs = FinancialStatementRun.objects.filter(
        company=run.company,
        fiscal_period=run.fiscal_period,
        reporting_scope=run.reporting_scope,
        branch=run.branch if run.reporting_scope == "BRANCH" else None,
    ).select_related("template")

    for ctype in ("FINANCIAL_POSITION", "BUSINESS_RESULT", "CASH_FLOW"):
        cand = base_qs.filter(template__component_type=ctype).order_by("-run_version", "-created_at").first()
        linked[ctype] = cand

    return linked


def _get_statement_run_indicator_map(
    comp_run: FinancialStatementRun | None,
) -> dict[str, tuple[Decimal, Decimal, FinancialStatementLine | None]]:
    """
    Returns {indicator_code: (current_amount, comparative_amount, line_obj)} from a component run.
    """
    if not comp_run:
        return {}
    res: dict[str, tuple[Decimal, Decimal, FinancialStatementLine | None]] = {}
    for val in comp_run.values.select_related("statement_line"):
        code = val.statement_line.indicator_code
        res[code] = (
            _to_dec(val.current_period_amount),
            _to_dec(val.comparative_period_amount),
            val.statement_line,
        )
    return res


@transaction.atomic
def calculate_financial_notes_run(
    run: FinancialStatementRun,
    *,
    bundle: FinancialStatementBundle | None = None,
    manual_notes_payload: dict[str, Any] | None = None,
    preserve_existing_manual: bool = True,
) -> FinancialStatementRun:
    """
    Populates or refreshes a B09 Financial Statement Run (`B09-DN`, `B09-DNKLT`, `B09a-DN`).
    Strictly preserves `APPROVED` runs without modifying their snapshot (BR-RPT-B09-77, TC-RPT-06-71, 72).
    """
    ensure_b09_templates_seeded()
    if run.run_status == FinancialStatementRun.Status.APPROVED:
        raise ValidationError({
            "error_code": "EF-29",
            "detail": "Bản thuyết minh BCTC đã ở trạng thái APPROVED, không được phép sửa hoặc tính lại trực tiếp.",
        })

    company = run.company
    eff_branch = run.branch if run.reporting_scope == "BRANCH" else None
    start_date = run.period_start_date
    end_date = run.period_end_date
    legal_code = run.template.legal_form_code
    tv = run.template_version

    # Ensure sections & items exist on this template_version
    if tv.note_sections.count() == 0:
        seed_financial_notes_uc_rpt_06()

    # Preserve existing manual/confirmed contents if re-running a draft/generated run
    existing_manual_by_code: dict[str, dict[str, Any]] = {}
    if preserve_existing_manual:
        for old_c in run.note_contents.select_related("note_item"):
            if (
                old_c.data_origin == "MANUAL"
                or old_c.content_status in ("COMPLETED", "VALIDATED", "APPROVED", "NOT_APPLICABLE")
                or (old_c.structured_content_json or {}).get("is_manual_override")
            ):
                existing_manual_by_code[old_c.note_item.note_code] = {
                    "text_content": old_c.text_content,
                    "structured_content_json": old_c.structured_content_json,
                    "content_status": old_c.content_status,
                    "is_applicable": old_c.is_applicable,
                    "not_applicable_reason": old_c.not_applicable_reason,
                    "applicability_evidence": old_c.applicability_evidence,
                    "reviewed_by": old_c.reviewed_by,
                    "reviewed_at": old_c.reviewed_at,
                    "content_version": old_c.content_version,
                }

    manual_input_map: dict[str, dict[str, Any]] = {}
    if isinstance(manual_notes_payload, dict):
        for k, v in manual_notes_payload.items():
            if isinstance(v, dict):
                manual_input_map[str(k)] = v

    # Clear previous auto contents & references for this run
    run.note_contents.all().delete()
    run.note_references.all().delete()

    snap_hash, last_posted_at = compute_b09_gl_snapshot_meta(company, end_date, eff_branch)
    run.source_snapshot_hash = snap_hash
    run.source_last_posted_at = last_posted_at
    run.save(update_fields=["source_snapshot_hash", "source_last_posted_at"])

    linked_runs = _resolve_linked_component_runs(run, bundle=bundle)
    b01_run = linked_runs["FINANCIAL_POSITION"]
    b02_run = linked_runs["BUSINESS_RESULT"]
    b03_run = linked_runs["CASH_FLOW"]

    b01_map = _get_statement_run_indicator_map(b01_run)
    b02_map = _get_statement_run_indicator_map(b02_run)
    b03_map = _get_statement_run_indicator_map(b03_run)

    # Query GL lines for opening (< start_date or OPENING on start_date) and period ([start_date, end_date] excluding OPENING)
    base_jl_qs = JournalLine.objects.filter(
        entry__company=company,
        entry__status="POSTED",
        entry__reversed_amount=0,
    ).select_related("account", "entry", "party")
    if eff_branch is not None:
        base_jl_qs = base_jl_qs.filter(entry__branch=eff_branch)

    open_cond = Q(entry__posting_date__lt=start_date) | Q(entry__entry_type="OPENING", entry__posting_date__lte=start_date)
    open_jls = [
        jl for jl in base_jl_qs.filter(open_cond)
        if not (jl.entry.original_entry_id is not None and jl.entry.reversal_method)
    ]
    period_jls = [
        jl for jl in base_jl_qs.filter(entry__posting_date__gte=start_date, entry__posting_date__lte=end_date).exclude(entry__entry_type="OPENING")
        if not (jl.entry.original_entry_id is not None and jl.entry.reversal_method)
    ]
    close_jls = open_jls + period_jls

    # Also query comparative period (previous year)
    prev_start = run.comparison_period.start_date if run.comparison_period else date(start_date.year - 1, start_date.month, 1)
    prev_end = run.comparison_period.end_date if run.comparison_period else date(end_date.year - 1, end_date.month, min(end_date.day, 28))
    prev_jls = [
        jl for jl in base_jl_qs.filter(entry__posting_date__gte=prev_start, entry__posting_date__lte=prev_end).exclude(entry__entry_type="OPENING")
        if not (jl.entry.original_entry_id is not None and jl.entry.reversal_method)
    ]

    # Helper to sum account balances
    def _net_bal(jls_list: list[JournalLine], prefixes: tuple[str, ...] | str, credit_normal: bool = False, exclude_restricted: bool = False) -> Decimal:
        pfx = (prefixes,) if isinstance(prefixes, str) else prefixes
        total = ZERO
        for jl in jls_list:
            code = jl.account.code
            dim = jl.dimensions or {}
            if exclude_restricted and (dim.get("is_restricted_cash") or dim.get("restricted")):
                continue
            if code.startswith(pfx):
                total += (_to_dec(jl.credit) - _to_dec(jl.debit)) if credit_normal else (_to_dec(jl.debit) - _to_dec(jl.credit))
        return _to_dec(total)

    def _period_turnover(jls_list: list[JournalLine], prefixes: tuple[str, ...] | str, side: str = "DEBIT", exclude_911: bool = True) -> Decimal:
        pfx = (prefixes,) if isinstance(prefixes, str) else prefixes
        closing_entries = set()
        if exclude_911:
            for jl in jls_list:
                if jl.account.code.startswith("911"):
                    closing_entries.add(jl.entry_id)
        total = ZERO
        for jl in jls_list:
            if exclude_911 and jl.entry_id in closing_entries:
                continue
            if jl.account.code.startswith(pfx):
                total += _to_dec(jl.debit) if side == "DEBIT" else _to_dec(jl.credit)
        return _to_dec(total)

    # Identify Fiscal Year start/end from company's accounting periods in run.fiscal_year (not hardcoded 01/01-31/12!)
    fy_periods = list(
        AccountingPeriod.objects.filter(company=company, fiscal_year=run.fiscal_year).order_by("start_date")
    )
    fy_start_date = min((p.start_date for p in fy_periods), default=start_date)
    fy_end_date = max((p.end_date for p in fy_periods), default=end_date)
    currency_code = (run.reporting_currency.code if run.reporting_currency else None) or (
        company.accounting_currency.code if company.accounting_currency else "VND"
    )

    sections = list(
        tv.note_sections.prefetch_related("items__tables").order_by("display_order", "section_code")
    )

    for sec in sections:
        for item in sec.items.all().order_by("display_order", "note_code"):
            ncode = item.note_code
            override = manual_input_map.get(ncode) or existing_manual_by_code.get(ncode) or {}

            # Determine applicability (SF-10)
            is_app = override.get("is_applicable", True)
            na_reason = str(override.get("not_applicable_reason") or "").strip()
            na_evidence = str(override.get("applicability_evidence") or override.get("source_reference") or "").strip()

            text_val = ""
            struct_val: dict[str, Any] = dict(override.get("structured_content_json") or {})
            c_status = FinancialNoteContent.ContentStatus.AUTO_POPULATED

            # ----------------------------------------------------------------
            # SECTION I: ĐẶC ĐIỂM HOẠT ĐỘNG CỦA DOANH NGHIỆP (I.1 .. I.9)
            # ----------------------------------------------------------------
            if ncode == "I.1":
                own_form = struct_val.get("ownership_form") or getattr(company, "company_type", None) or "DOANH_NGHIEP"
                own_desc = struct_val.get("ownership_description") or f"Đơn vị báo cáo: {company.name} (MST: {company.tax_code or 'N/A'})."
                struct_val.update({"ownership_form": own_form, "ownership_description": own_desc})
                text_val = override.get("text_content") or own_desc
                c_status = override.get("content_status") or (
                    "COMPLETED" if override.get("confirmed") else "AUTO_POPULATED"
                )
            elif ncode == "I.2":
                sec_name = struct_val.get("business_sector") or "Sản xuất, thương mại và dịch vụ"
                struct_val.update({"business_sector": sec_name, "sector_description": sec_name})
                text_val = override.get("text_content") or f"Lĩnh vực kinh doanh: {sec_name}."
                c_status = override.get("content_status") or "AUTO_POPULATED"
            elif ncode == "I.3":
                acts = struct_val.get("activities") or [
                    {"business_activity_code": "MAIN", "business_activity_name": company.name, "is_primary": True}
                ]
                struct_val["activities"] = acts
                text_val = override.get("text_content") or "Hoạt động kinh doanh theo Giấy chứng nhận đăng ký doanh nghiệp."
                c_status = override.get("content_status") or "AUTO_POPULATED"
            elif ncode == "I.4":
                cyc = struct_val.get("operating_cycle_months", 12)
                struct_val.update({"operating_cycle_months": cyc, "cycle_description": f"Chu kỳ sản xuất, kinh doanh thông thường: {cyc} tháng."})
                text_val = override.get("text_content") or struct_val["cycle_description"]
                c_status = override.get("content_status") or "AUTO_POPULATED"
            elif ncode == "I.5":
                # Do NOT auto-conclude "no significant events" just because GL has no special doc!
                if override.get("text_content") or struct_val.get("events"):
                    text_val = override.get("text_content") or "Đã ghi nhận sự kiện hoạt động trong năm."
                    c_status = override.get("content_status") or "COMPLETED"
                elif not is_app and na_reason:
                    c_status = "NOT_APPLICABLE"
                else:
                    text_val = ""
                    c_status = "MANUAL_REQUIRED"
            elif ncode == "I.6":
                # Do NOT auto-confirm "no subsidiaries" when no subsidiary data is confirmed!
                entities = struct_val.get("entities")
                if entities is not None or override.get("confirmed"):
                    text_val = override.get("text_content") or f"Số đơn vị trong cấu trúc doanh nghiệp: {len(entities or [])}."
                    c_status = override.get("content_status") or "COMPLETED"
                elif not is_app and na_reason:
                    c_status = "NOT_APPLICABLE"
                else:
                    struct_val["entities"] = []
                    text_val = ""
                    c_status = "MANUAL_REQUIRED"
            elif ncode == "I.7":
                # Never use software user count as employee count, and never fake 0 when missing! (EF-23, TC-RPT-06-23)
                emp_end = struct_val.get("employee_count_end_period")
                emp_avg = struct_val.get("average_employee_count")
                if emp_end is not None:
                    text_val = override.get("text_content") or f"Số lượng lao động cuối kỳ: {emp_end} người."
                    c_status = override.get("content_status") or "COMPLETED"
                else:
                    struct_val["employee_count_end_period"] = None
                    struct_val["average_employee_count"] = emp_avg
                    struct_val["value_status"] = "MANUAL_REQUIRED"
                    text_val = ""
                    c_status = "MANUAL_REQUIRED"
            elif ncode == "I.8":
                if "is_comparable" in struct_val or override.get("text_content"):
                    text_val = override.get("text_content") or "Thông tin trên Báo cáo tài chính có khả năng so sánh được với kỳ trước."
                    c_status = override.get("content_status") or "COMPLETED"
                else:
                    struct_val.update({"is_comparable": True, "confirmation_status": "PENDING_CONFIRMATION"})
                    text_val = "Đề xuất: Thông tin số liệu so sánh trên BCTC nhất quán với kỳ trước (chờ kế toán trưởng xác nhận)."
                    c_status = "AUTO_POPULATED"
            elif ncode == "I.9":
                if override.get("text_content"):
                    text_val = override["text_content"]
                    c_status = override.get("content_status") or "COMPLETED"
                elif not is_app and na_reason:
                    c_status = "NOT_APPLICABLE"
                else:
                    c_status = "MANUAL_REQUIRED"

            # ----------------------------------------------------------------
            # SECTION II: KỲ KẾ TOÁN VÀ ĐƠN VỊ TIỀN TỆ (II.1 .. II.2)
            # ----------------------------------------------------------------
            elif ncode == "II.1":
                desc = (
                    f"Kỳ kế toán năm của doanh nghiệp bắt đầu từ ngày {fy_start_date.strftime('%d/%m/%Y')} "
                    f"và kết thúc vào ngày {fy_end_date.strftime('%d/%m/%Y')}. "
                    f"Kỳ báo cáo hiện tại: từ {start_date.strftime('%d/%m/%Y')} đến {end_date.strftime('%d/%m/%Y')}."
                )
                struct_val.update({
                    "fiscal_year_start_date": fy_start_date.isoformat(),
                    "fiscal_year_end_date": fy_end_date.isoformat(),
                    "period_start_date": start_date.isoformat(),
                    "period_end_date": end_date.isoformat(),
                    "period_description": desc,
                })
                text_val = override.get("text_content") or desc
                c_status = override.get("content_status") or "AUTO_POPULATED"
            elif ncode == "II.2":
                prev_curr = struct_val.get("previous_currency_code") or currency_code
                has_changed = bool(struct_val.get("has_currency_changed", prev_curr != currency_code))
                struct_val.update({
                    "accounting_currency_code": currency_code,
                    "previous_currency_code": prev_curr,
                    "has_currency_changed": has_changed,
                    "change_reason": struct_val.get("change_reason", ""),
                    "financial_impact": struct_val.get("financial_impact", ""),
                })
                text_val = override.get("text_content") or f"Đơn vị tiền tệ sử dụng trong kế toán và trình bày BCTC: {currency_code}."
                c_status = override.get("content_status") or (
                    "REVIEW_REQUIRED" if has_changed and not struct_val.get("change_reason") else "AUTO_POPULATED"
                )

            # ----------------------------------------------------------------
            # SECTION III: CHUẨN MỰC VÀ CHẾ ĐỘ KẾ TOÁN ÁP DỤNG (III.1 .. III.2)
            # ----------------------------------------------------------------
            elif ncode == "III.1":
                reg_code = struct_val.get("accounting_regime_code") or tv.accounting_regime or "TT99"
                leg_basis = struct_val.get("legal_basis") or tv.legal_circular or "Thông tư 99/2025/TT-BTC"
                struct_val.update({
                    "accounting_regime_code": reg_code,
                    "legal_basis": leg_basis,
                    "effective_from": tv.effective_from.isoformat(),
                    "description": f"Doanh nghiệp áp dụng Chế độ kế toán doanh nghiệp ban hành theo {leg_basis}.",
                })
                text_val = override.get("text_content") or struct_val["description"]
                c_status = override.get("content_status") or "AUTO_POPULATED"
            elif ncode == "III.2":
                # Never auto-declare full compliance without confirmation! (BR-RPT-B09-29, TC-RPT-06-68)
                confirmed_by = struct_val.get("confirmed_by") or override.get("confirmed_by")
                if confirmed_by:
                    struct_val.update({
                        "compliance_status": struct_val.get("compliance_status", "COMPLIANT"),
                        "confirmed_by": str(confirmed_by),
                        "confirmed_at": struct_val.get("confirmed_at") or timezone.now().isoformat(),
                    })
                    text_val = override.get("text_content") or "Ban Giám đốc tuyên bố Báo cáo tài chính đã được lập và trình bày tuân thủ Chuẩn mực kế toán Việt Nam và Thông tư 99/2025/TT-BTC."
                    c_status = override.get("content_status") or "COMPLETED"
                else:
                    struct_val.update({
                        "compliance_status": "UNCONFIRMED_PROPOSAL",
                        "confirmed_by": None,
                    })
                    text_val = override.get("text_content") or "[Dự thảo chờ xác nhận] Tuyên bố tuân thủ Chuẩn mực kế toán Việt Nam và Chế độ kế toán doanh nghiệp theo Thông tư 99/2025/TT-BTC."
                    c_status = override.get("content_status") or "REVIEW_REQUIRED"

            # ----------------------------------------------------------------
            # SECTION IV: 29 NHÓM CHÍNH SÁCH KẾ TOÁN (IV.1 .. IV.29)
            # ----------------------------------------------------------------
            elif sec.section_code == "IV":
                pol_confirmed = bool(struct_val.get("confirmed_by") or override.get("confirmed"))
                is_changed = struct_val.get("is_changed_from_previous_year")
                # Never hardcode 20% CIT tax rate on IV.28 (BR-RPT-B09-31, TC-RPT-06-52)
                if ncode == "IV.28":
                    tax_rate_cfg = struct_val.get("statutory_tax_rate")
                    struct_val.setdefault("tax_rate_basis", f"Theo quy định pháp luật thuế hiện hành áp dụng cho doanh nghiệp ({tax_rate_cfg}%)" if tax_rate_cfg is not None else "Theo quy định pháp luật thuế TNDN áp dụng cho doanh nghiệp trong kỳ")
                struct_val.update({
                    "policy_code": ncode,
                    "policy_name": item.note_title,
                    "accounting_standard_reference": struct_val.get("accounting_standard_reference", "VAS & TT99/2025/TT-BTC"),
                    "legal_basis": struct_val.get("legal_basis", "Thông tư 99/2025/TT-BTC"),
                    "effective_from": struct_val.get("effective_from", fy_start_date.isoformat()),
                    "is_changed_from_previous_year": is_changed,  # None unless explicitly verified!
                    "confirmation_status": "CONFIRMED" if pol_confirmed else "PROPOSED_UNCONFIRMED",
                })
                if legal_code == "B09a-DN":
                    struct_val.setdefault("current_policy_version", "v1")
                    struct_val.setdefault("previous_annual_policy_version", "v1")
                    struct_val.setdefault("has_changed", is_changed)

                text_val = override.get("text_content") or struct_val.get("policy_content") or f"[Dự thảo chính sách {ncode}] {item.note_title} theo Thông tư 99/2025/TT-BTC."
                if not is_app and na_reason:
                    c_status = "NOT_APPLICABLE"
                elif pol_confirmed:
                    c_status = override.get("content_status") or "COMPLETED"
                else:
                    c_status = override.get("content_status") or "AUTO_POPULATED"

            # ----------------------------------------------------------------
            # SECTION IX & B09-DNKLT & SECTION X & SECTION VI (B09a-DN)
            # ----------------------------------------------------------------
            elif ncode == "IX.2":
                # Subsequent events: NEVER auto-claim "no subsequent events" without confirmation! (TC-RPT-06-59, 60)
                evts = struct_val.get("events")
                if evts is not None or override.get("confirmed") or override.get("text_content"):
                    text_val = override.get("text_content") or f"Đã rà soát sự kiện phát sinh sau ngày kết thúc kỳ kế toán ({len(evts or [])} sự kiện)."
                    c_status = override.get("content_status") or "COMPLETED"
                elif not is_app and na_reason:
                    c_status = "NOT_APPLICABLE"
                else:
                    text_val = ""
                    c_status = "MANUAL_REQUIRED"
            elif ncode == "IX.6":
                if legal_code == "B09-DNKLT":
                    req_fields = (item.content_schema_json or {}).get("required_fields", [])
                    missing_ngc = [f for f in req_fields if not struct_val.get(f)]
                    if not missing_ngc:
                        text_val = override.get("text_content") or f"Giải trình không hoạt động liên tục: {struct_val.get('non_going_concern_reason')} (Quyết định số {struct_val.get('decision_number')})."
                        c_status = override.get("content_status") or "COMPLETED"
                    else:
                        struct_val["missing_required_fields"] = missing_ngc
                        text_val = override.get("text_content") or ""
                        c_status = "MANUAL_REQUIRED"
                else:
                    if override.get("confirmed") or override.get("text_content") or struct_val.get("going_concern_assessment"):
                        text_val = override.get("text_content") or str(struct_val.get("going_concern_assessment") or "Đánh giá giả định hoạt động liên tục đã được xác nhận.")
                        c_status = override.get("content_status") or "COMPLETED"
                    else:
                        struct_val["going_concern_assessment"] = "PENDING_MANAGEMENT_CONFIRMATION"
                        text_val = "[Chờ xác nhận] Đánh giá khả năng hoạt động liên tục của doanh nghiệp."
                        c_status = "REVIEW_REQUIRED"
            elif ncode in ("V.12", "V.23", "V.24", "V.30", "V.31", "V.32", "VIII.5", "IX.1", "IX.3", "IX.4", "IX.5", "IX.7", "IX.8", "X.1") or sec.section_code == "VI":
                if not is_app and na_reason:
                    c_status = "NOT_APPLICABLE"
                elif override.get("text_content") or struct_val.get("rows") or struct_val.get("confirmed"):
                    text_val = override.get("text_content") or f"Thuyết minh {ncode} đã được cập nhật."
                    c_status = override.get("content_status") or "COMPLETED"
                elif ncode in ("VI.3", "VI.6"):
                    c_status = "AUTO_POPULATED"
                else:
                    text_val = ""
                    c_status = "MANUAL_REQUIRED"

            # Sanitize text_val against XSS/Script injection (BR-RPT-B09-94, EF-34, TC-RPT-06-77)
            clean_text, had_xss = sanitize_note_text(text_val)
            if had_xss:
                struct_val["unsafe_html_sanitized"] = True

            content_obj = FinancialNoteContent.objects.create(
                statement_run=run,
                note_item=item,
                content_version=int(override.get("content_version") or 1),
                text_content=clean_text,
                structured_content_json=struct_val,
                content_status=c_status if is_app else ("NOT_APPLICABLE" if na_reason else "REVIEW_REQUIRED"),
                is_applicable=bool(is_app),
                not_applicable_reason=na_reason or None,
                applicability_evidence=na_evidence,
                data_origin=item.data_origin,
                source_snapshot_reference=snap_hash,
                created_by=run.created_by,
                reviewed_by=override.get("reviewed_by"),
                reviewed_at=override.get("reviewed_at"),
            )

            # Create cross-statement references (FinancialNoteReference)
            if item.related_report_code == "B01" and b01_run:
                for ind_c in (item.related_indicator_codes or []):
                    b_entry = b01_map.get(ind_c)
                    FinancialNoteReference.objects.create(
                        statement_run=run,
                        note_item=item,
                        source_statement_run=b01_run,
                        source_statement_line=b_entry[2] if b_entry else None,
                        reference_type="FINANCIAL_STATEMENT",
                        mapping_rule_code=f"REF-{ncode}-B01.{ind_c}",
                        source_reference_json={
                            "report_code": "B01",
                            "indicator_code": ind_c,
                            "current_amount": _fmt_dec(b_entry[0]) if b_entry else None,
                            "comparative_amount": _fmt_dec(b_entry[1]) if b_entry else None,
                        },
                    )
            elif item.related_report_code == "B02" and b02_run:
                for ind_c in (item.related_indicator_codes or []):
                    b_entry = b02_map.get(ind_c)
                    FinancialNoteReference.objects.create(
                        statement_run=run,
                        note_item=item,
                        source_statement_run=b02_run,
                        source_statement_line=b_entry[2] if b_entry else None,
                        reference_type="FINANCIAL_STATEMENT",
                        mapping_rule_code=f"REF-{ncode}-B02.{ind_c}",
                        source_reference_json={
                            "report_code": "B02",
                            "indicator_code": ind_c,
                            "current_amount": _fmt_dec(b_entry[0]) if b_entry else None,
                            "comparative_amount": _fmt_dec(b_entry[1]) if b_entry else None,
                        },
                    )
            elif item.related_report_code == "B03" and b03_run:
                for ind_c in (item.related_indicator_codes or []):
                    b_entry = b03_map.get(ind_c)
                    FinancialNoteReference.objects.create(
                        statement_run=run,
                        note_item=item,
                        source_statement_run=b03_run,
                        source_statement_line=b_entry[2] if b_entry else None,
                        reference_type="FINANCIAL_STATEMENT",
                        mapping_rule_code=f"REF-{ncode}-B03.{ind_c}",
                        source_reference_json={
                            "report_code": "B03",
                            "indicator_code": ind_c,
                            "current_amount": _fmt_dec(b_entry[0]) if b_entry else None,
                            "comparative_amount": _fmt_dec(b_entry[1]) if b_entry else None,
                        },
                    )

            # Populate Tables & Table Rows for this Note Item
            _populate_note_item_tables(
                run=run,
                item=item,
                content_obj=content_obj,
                override=override,
                open_jls=open_jls,
                period_jls=period_jls,
                close_jls=close_jls,
                prev_jls=prev_jls,
                _net_bal=_net_bal,
                _period_turnover=_period_turnover,
                b01_map=b01_map,
                b02_map=b02_map,
                b03_map=b03_map,
                start_date=start_date,
                end_date=end_date,
            )

    # Also populate backward-compatible FinancialStatementValue lines on `run` so UC-RPT-02 bundle checks pass seamlessly
    _sync_legacy_b09_statement_values(
        run=run,
        open_jls=open_jls,
        period_jls=period_jls,
        close_jls=close_jls,
        prev_jls=prev_jls,
        _net_bal=_net_bal,
        _period_turnover=_period_turnover,
    )

    return run


def _populate_note_item_tables(
    run: FinancialStatementRun,
    item: FinancialNoteItem,
    content_obj: FinancialNoteContent,
    override: dict[str, Any],
    open_jls: list[JournalLine],
    period_jls: list[JournalLine],
    close_jls: list[JournalLine],
    prev_jls: list[JournalLine],
    _net_bal: Any,
    _period_turnover: Any,
    b01_map: dict[str, tuple[Decimal, Decimal, FinancialStatementLine]],
    b02_map: dict[str, tuple[Decimal, Decimal, FinancialStatementLine]],
    b03_map: dict[str, tuple[Decimal, Decimal, FinancialStatementLine]],
    start_date: date,
    end_date: date,
) -> None:
    """
    Populates `FinancialNoteTableRow` instances and `GL_ACCOUNT` / `SUBLEDGER` references
    for all tables belonging to `item`.
    """
    ncode = item.note_code
    tables = list(item.tables.all().order_by("display_order", "table_code"))
    override_tables: dict[str, list[dict[str, Any]]] = (
        (override.get("tables") or {}) if isinstance(override.get("tables"), dict) else {}
    )
    override_rows_flat: list[dict[str, Any]] = (
        override.get("table_rows") if isinstance(override.get("table_rows"), list) else []
    )

    def _add_gl_ref(acc_prefix: str, cur_amt: Decimal, prev_amt: Decimal = ZERO) -> None:
        matched_jls = [jl for jl in close_jls if jl.account.code.startswith(acc_prefix)]
        voucher_ids = sorted({str(jl.entry_id) for jl in matched_jls})
        FinancialNoteReference.objects.create(
            statement_run=run,
            note_item=item,
            reference_type="GL_ACCOUNT",
            mapping_rule_code=f"GL-{ncode}-{acc_prefix}",
            source_reference_json={
                "account_code": acc_prefix,
                "closing_amount": _fmt_dec(cur_amt),
                "opening_amount": _fmt_dec(prev_amt),
                "journal_entry_ids": voucher_ids[:50],
                "voucher_count": len(voucher_ids),
            },
        )

    for tbl in tables:
        tcode = tbl.table_code
        # Remove existing rows for this run+table
        FinancialNoteTableRow.objects.filter(note_content=content_obj, table=tbl).delete()

        custom_rows = override_tables.get(tcode)
        if custom_rows is None and len(tables) == 1 and override_rows_flat:
            custom_rows = override_rows_flat

        if isinstance(custom_rows, list) and len(custom_rows) > 0:
            for idx, rdict in enumerate(custom_rows, start=1):
                rc = str(rdict.get("row_code") or f"ROW_{idx:02d}")
                rl = str(rdict.get("row_label") or rc)
                rvals = dict(rdict.get("column_values_json") or rdict)
                for k_meta in ("row_code", "row_label", "row_level", "display_order", "is_total_row", "column_values_json", "drilldown_reference_json", "validation_flags_json"):
                    rvals.pop(k_meta, None)
                # Sanitize string fields inside row JSON
                for k_col, v_col in list(rvals.items()):
                    if isinstance(v_col, str):
                        clean_s, _ = sanitize_note_text(v_col)
                        rvals[k_col] = clean_s
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=int(rdict.get("row_level") or 1),
                    display_order=int(rdict.get("display_order") or idx),
                    column_values_json=rvals,
                    is_total_row=bool(rdict.get("is_total_row", rc == "TOTAL")),
                    drilldown_reference_json=rdict.get("drilldown_reference_json") or {},
                    validation_flags_json=rdict.get("validation_flags_json") or {},
                )
            continue

        # Auto-calculation per table_code
        if tcode == "V.1.SUMMARY":
            c_111 = _net_bal(close_jls, "111", False, exclude_restricted=True)
            o_111 = _net_bal(open_jls, "111", False, exclude_restricted=True)
            c_112 = _net_bal(close_jls, "112", False, exclude_restricted=True)
            o_112 = _net_bal(open_jls, "112", False, exclude_restricted=True)
            c_113 = _net_bal(close_jls, "113", False, exclude_restricted=True)
            o_113 = _net_bal(open_jls, "113", False, exclude_restricted=True)
            c_1281 = _net_bal(close_jls, "1281", False, exclude_restricted=True)
            o_1281 = _net_bal(open_jls, "1281", False, exclude_restricted=True)
            c_tot = c_111 + c_112 + c_113 + c_1281
            o_tot = o_111 + o_112 + o_113 + o_1281

            rows_data = [
                ("CASH_ON_HAND", "- Tiền mặt (TK 111)", c_111, o_111, False, "111"),
                ("CASH_AT_BANK", "- Tiền gửi ngân hàng không kỳ hạn (TK 112)", c_112, o_112, False, "112"),
                ("CASH_IN_TRANSIT", "- Tiền đang chuyển (TK 113)", c_113, o_113, False, "113"),
                ("CASH_EQUIVALENTS", "- Các khoản tương đương tiền (TK 1281 <= 3 tháng)", c_1281, o_1281, False, "1281"),
                ("TOTAL", "Cộng tiền và các khoản tương đương tiền", c_tot, o_tot, True, "111,112,113,1281"),
            ]
            for idx, (rc, rl, c_v, o_v, is_tot, acc_c) in enumerate(rows_data, start=1):
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=1,
                    display_order=idx,
                    column_values_json={
                        "item_name": rl,
                        "closing_amount": _fmt_dec(c_v),
                        "opening_amount": _fmt_dec(o_v),
                    },
                    is_total_row=is_tot,
                    drilldown_reference_json={"account_codes": acc_c.split(",")},
                )
            _add_gl_ref("111", c_111, o_111)
            _add_gl_ref("112", c_112, o_112)
            if c_tot != ZERO or o_tot != ZERO:
                content_obj.text_content = content_obj.text_content or f"Tiền và các khoản tương đương tiền cuối kỳ: {_fmt_dec(c_tot)}."
                content_obj.save(update_fields=["text_content"])

        elif tcode == "V.1.BANK_DETAILS":
            # Group 112 balances by bank_name / bank_account in dimensions or description
            bank_groups: dict[str, dict[str, Any]] = {}
            for jl in close_jls:
                if jl.account.code.startswith("112"):
                    dim = jl.dimensions or {}
                    if dim.get("is_restricted_cash") or dim.get("restricted"):
                        continue
                    b_name = str(dim.get("bank_name") or "Tiền gửi ngân hàng thương mại")
                    b_acc = str(dim.get("bank_account") or jl.account.code)
                    curr = str(dim.get("currency") or "VND")
                    key = f"{b_name}|{b_acc}|{curr}"
                    grp = bank_groups.setdefault(key, {"bank_name": b_name, "account_type": "Không kỳ hạn", "currency_code": curr, "closing": ZERO, "opening": ZERO})
                    grp["closing"] += _to_dec(jl.debit) - _to_dec(jl.credit)
            for jl in open_jls:
                if jl.account.code.startswith("112"):
                    dim = jl.dimensions or {}
                    if dim.get("is_restricted_cash") or dim.get("restricted"):
                        continue
                    b_name = str(dim.get("bank_name") or "Tiền gửi ngân hàng thương mại")
                    b_acc = str(dim.get("bank_account") or jl.account.code)
                    curr = str(dim.get("currency") or "VND")
                    key = f"{b_name}|{b_acc}|{curr}"
                    grp = bank_groups.setdefault(key, {"bank_name": b_name, "account_type": "Không kỳ hạn", "currency_code": curr, "closing": ZERO, "opening": ZERO})
                    grp["opening"] += _to_dec(jl.debit) - _to_dec(jl.credit)
            for idx, (k, grp) in enumerate(sorted(bank_groups.items()), start=1):
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=f"BANK_{idx:02d}",
                    row_label=grp["bank_name"],
                    row_level=1,
                    display_order=idx,
                    column_values_json={
                        "bank_name": grp["bank_name"],
                        "account_type": grp["account_type"],
                        "currency_code": grp["currency_code"],
                        "closing_amount": _fmt_dec(grp["closing"]),
                        "opening_amount": _fmt_dec(grp["opening"]),
                    },
                    is_total_row=False,
                    drilldown_reference_json={"account_codes": ["112"]},
                )

        elif tcode == "V.1.CASH_EQUIVALENTS":
            # Only deposits with original_term_days <= 90 (or <= 3 months) are Cash Equivalents; > 90 days go to V.2!
            ce_idx = 0
            for jl in close_jls:
                if jl.account.code.startswith("1281"):
                    dim = jl.dimensions or {}
                    term_days = int(dim.get("original_term_days") or 90)
                    if term_days <= 90:
                        ce_idx += 1
                        amt = _to_dec(jl.debit) - _to_dec(jl.credit)
                        FinancialNoteTableRow.objects.create(
                            statement_run=run,
                            note_table=tbl,
                            row_code=f"CE_{ce_idx:02d}",
                            row_label=jl.description or "Tiền gửi có kỳ hạn gốc không quá 3 tháng",
                            row_level=1,
                            display_order=ce_idx,
                            column_values_json={
                                "deposit_term": f"{term_days} ngày",
                                "original_maturity_days": term_days,
                                "closing_amount": _fmt_dec(amt),
                                "opening_amount": "0.00",
                            },
                            is_total_row=False,
                            drilldown_reference_json={"account_codes": ["1281"], "entry_id": str(jl.entry_id)},
                        )

        elif tcode in ("V.2.TRADING", "V.2.HTM", "V.2.EQUITY"):
            acc_map = {
                "V.2.TRADING": ("121", "2291", "Chứng khoán kinh doanh"),
                "V.2.HTM": ("128", None, "Đầu tư nắm giữ đến ngày đáo hạn"),
                "V.2.EQUITY": (("221", "222", "228"), "2292", "Đầu tư góp vốn vào đơn vị khác"),
            }
            cost_pfx, prov_pfx, label_txt = acc_map[tcode]
            c_cost = _net_bal(close_jls, cost_pfx, False)
            o_cost = _net_bal(open_jls, cost_pfx, False)
            if tcode == "V.2.HTM":
                # Subtract 1281 <= 90 days which are already in Cash Equivalents (V.1)
                c_ce = _net_bal(close_jls, "1281", False)
                o_ce = _net_bal(open_jls, "1281", False)
                c_cost = max(ZERO, c_cost - c_ce)
                o_cost = max(ZERO, o_cost - o_ce)
            c_prov = _net_bal(close_jls, prov_pfx, True) if prov_pfx else ZERO
            o_prov = _net_bal(open_jls, prov_pfx, True) if prov_pfx else ZERO
            # Fair value is NEVER auto-fabricated equal to cost when missing! (EF-11, BR-RPT-B09-39, TC-RPT-06-31)
            if tcode in ("V.2.TRADING", "V.2.EQUITY"):
                col_vals = {
                    "item_name": label_txt,
                    "closing_cost": _fmt_dec(c_cost),
                    "closing_fair_value": None,
                    "closing_fair_value_status": "NOT_DETERMINED" if c_cost != ZERO else "NOT_APPLICABLE",
                    "closing_provision": _fmt_dec(c_prov),
                    "opening_cost": _fmt_dec(o_cost),
                    "opening_fair_value": None,
                    "opening_fair_value_status": "NOT_DETERMINED" if o_cost != ZERO else "NOT_APPLICABLE",
                    "opening_provision": _fmt_dec(o_prov),
                }
            else:
                col_vals = {
                    "item_name": label_txt,
                    "closing_cost": _fmt_dec(c_cost),
                    "closing_carrying_amount": _fmt_dec(c_cost),
                    "opening_cost": _fmt_dec(o_cost),
                    "opening_carrying_amount": _fmt_dec(o_cost),
                }
            FinancialNoteTableRow.objects.create(
                statement_run=run,
                note_table=tbl,
                row_code="TOTAL",
                row_label=label_txt,
                row_level=1,
                display_order=1,
                column_values_json=col_vals,
                is_total_row=True,
                drilldown_reference_json={"account_codes": [cost_pfx] if isinstance(cost_pfx, str) else list(cost_pfx)},
            )

        elif tcode == "V.3.CUSTOMERS":
            # Split 131 by customer party: only debit balances of 131 are Trade Receivables (Credit 131 is Advances from customers -> V.18!)
            cust_close: dict[str, Decimal] = {}
            cust_open: dict[str, Decimal] = {}
            cust_names: dict[str, str] = {}
            for jl in close_jls:
                if jl.account.code.startswith("131"):
                    p_key = str(jl.party_id or (jl.dimensions or {}).get("customer_code") or "DEFAULT_CUST")
                    p_name = (jl.party.name if jl.party else None) or str((jl.dimensions or {}).get("customer_name") or "Khách hàng khác")
                    cust_names[p_key] = p_name
                    cust_close[p_key] = cust_close.get(p_key, ZERO) + (_to_dec(jl.debit) - _to_dec(jl.credit))
            for jl in open_jls:
                if jl.account.code.startswith("131"):
                    p_key = str(jl.party_id or (jl.dimensions or {}).get("customer_code") or "DEFAULT_CUST")
                    p_name = (jl.party.name if jl.party else None) or str((jl.dimensions or {}).get("customer_name") or "Khách hàng khác")
                    cust_names[p_key] = p_name
                    cust_open[p_key] = cust_open.get(p_key, ZERO) + (_to_dec(jl.debit) - _to_dec(jl.credit))

            all_keys = sorted(set(cust_close.keys()) | set(cust_open.keys()))
            tot_c = sum((max(ZERO, cust_close.get(k, ZERO)) for k in all_keys), ZERO)
            tot_o = sum((max(ZERO, cust_open.get(k, ZERO)) for k in all_keys), ZERO)

            # Separate customers >= 10% of total trade receivables vs Others (BR-RPT-B09-40, TC-RPT-06-32, 33)
            other_c = ZERO
            other_o = ZERO
            row_idx = 0
            for k in all_keys:
                c_amt = max(ZERO, cust_close.get(k, ZERO))
                o_amt = max(ZERO, cust_open.get(k, ZERO))
                if c_amt == ZERO and o_amt == ZERO:
                    continue
                pct_c = (c_amt / tot_c * Decimal("100")) if tot_c > ZERO else ZERO
                is_major = (tot_c > ZERO and c_amt >= tot_c * Decimal("0.10")) or (tot_o > ZERO and o_amt >= tot_o * Decimal("0.10"))
                if is_major:
                    row_idx += 1
                    FinancialNoteTableRow.objects.create(
                        statement_run=run,
                        note_table=tbl,
                        row_code=f"CUST_{k}",
                        row_label=cust_names[k],
                        row_level=1,
                        display_order=row_idx,
                        column_values_json={
                            "customer_name": cust_names[k],
                            "is_related_party": False,
                            "closing_amount": _fmt_dec(c_amt),
                            "opening_amount": _fmt_dec(o_amt),
                            "percentage_of_total": _fmt_dec(pct_c),
                            "exceeds_10pct_threshold": True,
                        },
                        is_total_row=False,
                        drilldown_reference_json={"account_codes": ["131"], "party_key": k},
                    )
                else:
                    other_c += c_amt
                    other_o += o_amt

            if other_c > ZERO or other_o > ZERO:
                row_idx += 1
                pct_other = (other_c / tot_c * Decimal("100")) if tot_c > ZERO else ZERO
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code="OTHER_CUSTOMERS",
                    row_label="Các khách hàng khác (dưới 10% tổng phải thu khách hàng)",
                    row_level=1,
                    display_order=row_idx,
                    column_values_json={
                        "customer_name": "Các khách hàng khác",
                        "is_related_party": False,
                        "closing_amount": _fmt_dec(other_c),
                        "opening_amount": _fmt_dec(other_o),
                        "percentage_of_total": _fmt_dec(pct_other),
                        "exceeds_10pct_threshold": False,
                    },
                    is_total_row=False,
                    drilldown_reference_json={"account_codes": ["131"]},
                )
            row_idx += 1
            FinancialNoteTableRow.objects.create(
                statement_run=run,
                note_table=tbl,
                row_code="TOTAL",
                row_label="Cộng phải thu của khách hàng",
                row_level=1,
                display_order=row_idx,
                column_values_json={
                    "customer_name": "Cộng phải thu của khách hàng",
                    "is_related_party": False,
                    "closing_amount": _fmt_dec(tot_c),
                    "opening_amount": _fmt_dec(tot_o),
                    "percentage_of_total": "100.00" if tot_c > ZERO else "0.00",
                },
                is_total_row=True,
                drilldown_reference_json={"account_codes": ["131"]},
            )
            _add_gl_ref("131", tot_c, tot_o)

        elif tcode == "V.7.INVENTORY":
            inv_map = [
                ("GOODS_IN_TRANSIT", "- Hàng mua đang đi trên đường (TK 151)", "151"),
                ("RAW_MATERIALS", "- Nguyên liệu, vật liệu (TK 152)", "152"),
                ("TOOLS_SUPPLIES", "- Công cụ, dụng cụ (TK 153)", "153"),
                ("WORK_IN_PROGRESS", "- Chi phí sản xuất, kinh doanh dở dang (TK 154)", "154"),
                ("FINISHED_GOODS", "- Thành phẩm (TK 155)", "155"),
                ("MERCHANDISE", "- Hàng hóa (TK 156)", "156"),
                ("GOODS_ON_CONSIGNMENT", "- Hàng gửi đi bán (TK 157)", "157"),
                ("TAX_BONDED_WAREHOUSE", "- Hàng hóa kho bảo thuế (TK 158)", "158"),
            ]
            tot_c_cost = ZERO
            tot_o_cost = ZERO
            c_prov_all = _net_bal(close_jls, "2294", True)
            o_prov_all = _net_bal(open_jls, "2294", True)

            for idx, (rc, rl, pfx) in enumerate(inv_map, start=1):
                c_val = _net_bal(close_jls, pfx, False)
                o_val = _net_bal(open_jls, pfx, False)
                tot_c_cost += c_val
                tot_o_cost += o_val
                # Assign provision to Merchandise (156) if present
                row_c_prov = c_prov_all if pfx == "156" else ZERO
                row_o_prov = o_prov_all if pfx == "156" else ZERO
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=1,
                    display_order=idx,
                    column_values_json={
                        "inventory_category": rl,
                        "closing_cost": _fmt_dec(c_val),
                        "closing_provision": _fmt_dec(row_c_prov),
                        "opening_cost": _fmt_dec(o_val),
                        "opening_provision": _fmt_dec(row_o_prov),
                    },
                    is_total_row=False,
                    drilldown_reference_json={"account_codes": [pfx]},
                )
            FinancialNoteTableRow.objects.create(
                statement_run=run,
                note_table=tbl,
                row_code="TOTAL",
                row_label="Cộng hàng tồn kho",
                row_level=1,
                display_order=len(inv_map) + 1,
                column_values_json={
                    "inventory_category": "Cộng hàng tồn kho",
                    "closing_cost": _fmt_dec(tot_c_cost),
                    "closing_provision": _fmt_dec(c_prov_all),
                    "opening_cost": _fmt_dec(tot_o_cost),
                    "opening_provision": _fmt_dec(o_prov_all),
                    "closing_net": _fmt_dec(tot_c_cost - c_prov_all),
                    "opening_net": _fmt_dec(tot_o_cost - o_prov_all),
                },
                is_total_row=True,
                drilldown_reference_json={"account_codes": ["151", "152", "153", "154", "155", "156", "157", "158", "2294"]},
            )
            _add_gl_ref("15", tot_c_cost, tot_o_cost)

        elif tcode in ("V.9.TANGIBLE_FA", "V.10.INTANGIBLE_FA", "V.11.FINANCE_LEASE_FA", "V.13.INVESTMENT_PROPERTY"):
            fa_cfg = {
                "V.9.TANGIBLE_FA": ("211", "2141"),
                "V.10.INTANGIBLE_FA": ("213", "2143"),
                "V.11.FINANCE_LEASE_FA": ("212", "2142"),
                "V.13.INVESTMENT_PROPERTY": ("217", "2147"),
            }[tcode]
            cost_acc, dep_acc = fa_cfg
            o_cost = _net_bal(open_jls, cost_acc, False)
            inc_cost = _period_turnover(period_jls, cost_acc, "DEBIT", exclude_911=False)
            dec_cost = _period_turnover(period_jls, cost_acc, "CREDIT", exclude_911=False)
            c_cost = o_cost + inc_cost - dec_cost

            o_dep = _net_bal(open_jls, dep_acc, True)
            inc_dep = _period_turnover(period_jls, dep_acc, "CREDIT", exclude_911=False)
            dec_dep = _period_turnover(period_jls, dep_acc, "DEBIT", exclude_911=False)
            c_dep = o_dep + inc_dep - dec_dep

            o_nbv = o_cost - o_dep
            c_nbv = c_cost - c_dep

            schema_def = TABLE_SCHEMAS_DEF[tcode]
            col_codes = [c["column_code"] for c in schema_def["columns"] if c["column_code"] != "row_label"]

            def _make_fa_cols(label_str: str, total_val: Decimal) -> dict[str, Any]:
                d: dict[str, Any] = {
                    "row_label": label_str,
                    "item_label": label_str,
                    "total": _fmt_dec(total_val),
                    "TOTAL": _fmt_dec(total_val),
                }
                for cc in col_codes:
                    if cc.upper() == "TOTAL":
                        d[cc] = _fmt_dec(total_val)
                    elif cc == col_codes[0]:
                        # Put amount into the first asset category by default
                        d[cc] = _fmt_dec(total_val)
                    elif cc not in d:
                        d[cc] = "0.00"
                return d

            fa_rows = [
                ("COST_OPENING", "I. Nguyên giá - Số dư đầu năm", o_cost, False),
                ("COST_ADDITIONS", "- Tăng trong năm (Mua sắm / đầu tư XDCB hoàn thành)", inc_cost, False),
                ("COST_DISPOSALS", "- Giảm trong năm (Thanh lý, nhượng bán)", dec_cost, False),
                ("COST_CLOSING", "Số dư cuối năm (Nguyên giá)", c_cost, True),
                ("ACC_DEP_OPENING", "II. Giá trị hao mòn lũy kế - Số dư đầu năm", o_dep, False),
                ("ACC_DEP_CHARGE", "- Khấu hao / hao mòn tăng trong năm", inc_dep, False),
                ("ACC_DEP_DISPOSALS", "- Giảm hao mòn trong năm (Thanh lý, nhượng bán)", dec_dep, False),
                ("ACC_DEP_CLOSING", "Số dư cuối năm (Hao mòn lũy kế)", c_dep, True),
                ("NBV_OPENING", "III. Giá trị còn lại - Tại ngày đầu năm", o_nbv, True),
                ("NBV_CLOSING", "- Tại ngày cuối năm", c_nbv, True),
            ]
            for idx, (rc, rl, val_d, is_tot) in enumerate(fa_rows, start=1):
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=1,
                    display_order=idx,
                    column_values_json=_make_fa_cols(rl, val_d),
                    is_total_row=is_tot,
                    drilldown_reference_json={"account_codes": [cost_acc, dep_acc]},
                )
            _add_gl_ref(cost_acc, c_cost, o_cost)
            _add_gl_ref(dep_acc, c_dep, o_dep)

        elif tcode == "V.16.LOANS":
            o_3411 = _net_bal(open_jls, "3411", True)
            inc_3411 = _period_turnover(period_jls, "3411", "CREDIT", exclude_911=False)
            dec_3411 = _period_turnover(period_jls, "3411", "DEBIT", exclude_911=False)
            c_3411 = o_3411 + inc_3411 - dec_3411

            o_3412 = _net_bal(open_jls, "3412", True)
            inc_3412 = _period_turnover(period_jls, "3412", "CREDIT", exclude_911=False)
            dec_3412 = _period_turnover(period_jls, "3412", "DEBIT", exclude_911=False)
            c_3412 = o_3412 + inc_3412 - dec_3412

            o_tot = o_3411 + o_3412
            inc_tot = inc_3411 + inc_3412
            dec_tot = dec_3411 + dec_3412
            c_tot = c_3411 + c_3412

            loan_rows = [
                ("SHORT_TERM_LOANS", "a) Vay ngắn hạn (TK 3411)", c_3411, c_3411, inc_3411, dec_3411, o_3411, o_3411, False),
                ("LONG_TERM_LOANS", "b) Vay dài hạn và nợ thuê tài chính (TK 3412)", c_3412, c_3412, inc_3412, dec_3412, o_3412, o_3412, False),
                ("TOTAL", "Cộng các khoản vay và nợ thuê tài chính", c_tot, c_tot, inc_tot, dec_tot, o_tot, o_tot, True),
            ]
            for idx, (rc, rl, cl_v, cl_pay, inc_v, dec_v, op_v, op_pay, is_tot) in enumerate(loan_rows, start=1):
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=1,
                    display_order=idx,
                    column_values_json={
                        "loan_category": rl,
                        "closing_value": _fmt_dec(cl_v),
                        "closing_payable_ability": _fmt_dec(cl_pay),
                        "increase_in_period": _fmt_dec(inc_v),
                        "decrease_in_period": _fmt_dec(dec_v),
                        "opening_value": _fmt_dec(op_v),
                        "opening_payable_ability": _fmt_dec(op_pay),
                    },
                    is_total_row=is_tot,
                    drilldown_reference_json={"account_codes": ["341"]},
                )
            _add_gl_ref("341", c_tot, o_tot)

        elif tcode == "V.17.SUPPLIERS":
            # Split 331 by supplier party: only credit balances of 331 are Trade Payables (Debit 331 is Advances to suppliers!)
            sup_close: dict[str, Decimal] = {}
            sup_open: dict[str, Decimal] = {}
            sup_names: dict[str, str] = {}
            for jl in close_jls:
                if jl.account.code.startswith("331"):
                    p_key = str(jl.party_id or (jl.dimensions or {}).get("supplier_code") or "DEFAULT_SUP")
                    p_name = (jl.party.name if jl.party else None) or str((jl.dimensions or {}).get("supplier_name") or "Nhà cung cấp khác")
                    sup_names[p_key] = p_name
                    sup_close[p_key] = sup_close.get(p_key, ZERO) + (_to_dec(jl.credit) - _to_dec(jl.debit))
            for jl in open_jls:
                if jl.account.code.startswith("331"):
                    p_key = str(jl.party_id or (jl.dimensions or {}).get("supplier_code") or "DEFAULT_SUP")
                    p_name = (jl.party.name if jl.party else None) or str((jl.dimensions or {}).get("supplier_name") or "Nhà cung cấp khác")
                    sup_names[p_key] = p_name
                    sup_open[p_key] = sup_open.get(p_key, ZERO) + (_to_dec(jl.credit) - _to_dec(jl.debit))

            all_keys = sorted(set(sup_close.keys()) | set(sup_open.keys()))
            tot_c = sum((max(ZERO, sup_close.get(k, ZERO)) for k in all_keys), ZERO)
            tot_o = sum((max(ZERO, sup_open.get(k, ZERO)) for k in all_keys), ZERO)

            other_c = ZERO
            other_o = ZERO
            row_idx = 0
            for k in all_keys:
                c_amt = max(ZERO, sup_close.get(k, ZERO))
                o_amt = max(ZERO, sup_open.get(k, ZERO))
                if c_amt == ZERO and o_amt == ZERO:
                    continue
                pct_c = (c_amt / tot_c * Decimal("100")) if tot_c > ZERO else ZERO
                is_major = (tot_c > ZERO and c_amt >= tot_c * Decimal("0.10")) or (tot_o > ZERO and o_amt >= tot_o * Decimal("0.10"))
                if is_major:
                    row_idx += 1
                    FinancialNoteTableRow.objects.create(
                        statement_run=run,
                        note_table=tbl,
                        row_code=f"SUP_{k}",
                        row_label=sup_names[k],
                        row_level=1,
                        display_order=row_idx,
                        column_values_json={
                            "supplier_name": sup_names[k],
                            "closing_value": _fmt_dec(c_amt),
                            "closing_payable_ability": _fmt_dec(c_amt),
                            "opening_value": _fmt_dec(o_amt),
                            "opening_payable_ability": _fmt_dec(o_amt),
                            "percentage_of_total": _fmt_dec(pct_c),
                            "exceeds_10pct_threshold": True,
                        },
                        is_total_row=False,
                        drilldown_reference_json={"account_codes": ["331"], "party_key": k},
                    )
                else:
                    other_c += c_amt
                    other_o += o_amt

            if other_c > ZERO or other_o > ZERO:
                row_idx += 1
                pct_other = (other_c / tot_c * Decimal("100")) if tot_c > ZERO else ZERO
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code="OTHER_SUPPLIERS",
                    row_label="Các nhà cung cấp khác (dưới 10% tổng phải trả người bán)",
                    row_level=1,
                    display_order=row_idx,
                    column_values_json={
                        "supplier_name": "Các nhà cung cấp khác",
                        "closing_value": _fmt_dec(other_c),
                        "closing_payable_ability": _fmt_dec(other_c),
                        "opening_value": _fmt_dec(other_o),
                        "opening_payable_ability": _fmt_dec(other_o),
                        "percentage_of_total": _fmt_dec(pct_other),
                        "exceeds_10pct_threshold": False,
                    },
                    is_total_row=False,
                    drilldown_reference_json={"account_codes": ["331"]},
                )
            row_idx += 1
            FinancialNoteTableRow.objects.create(
                statement_run=run,
                note_table=tbl,
                row_code="TOTAL",
                row_label="Cộng phải trả người bán",
                row_level=1,
                display_order=row_idx,
                column_values_json={
                    "supplier_name": "Cộng phải trả người bán",
                    "closing_value": _fmt_dec(tot_c),
                    "closing_payable_ability": _fmt_dec(tot_c),
                    "opening_value": _fmt_dec(tot_o),
                    "opening_payable_ability": _fmt_dec(tot_o),
                    "percentage_of_total": "100.00" if tot_c > ZERO else "0.00",
                },
                is_total_row=True,
                drilldown_reference_json={"account_codes": ["331"]},
            )
            _add_gl_ref("331", tot_c, tot_o)

        elif tcode == "V.19.TAX":
            # Only POSTED GL entries on 333 are included; unposted tax drafts are strictly excluded! (BR-RPT-B09-44, TC-RPT-06-40, 41)
            tax_rows = [
                ("VAT_DOMESTIC", "- Thuế GTGT phải nộp (TK 3331)", "3331"),
                ("CIT", "- Thuế thu nhập doanh nghiệp (TK 3334)", "3334"),
                ("PIT", "- Thuế thu nhập cá nhân (TK 3335)", "3335"),
                ("OTHER_TAXES", "- Các loại thuế và khoản phải nộp khác (TK 3332, 3333, 3336..3339)", ("3332", "3333", "3336", "3337", "3338", "3339")),
            ]
            tot_o_pay = ZERO
            tot_o_rec = ZERO
            tot_pay_in = ZERO
            tot_paid = ZERO
            tot_c_pay = ZERO
            tot_c_rec = ZERO

            for idx, (rc, rl, pfx) in enumerate(tax_rows, start=1):
                o_net = _net_bal(open_jls, pfx, True)
                o_pay = max(ZERO, o_net)
                o_rec = max(ZERO, -o_net)
                p_in = _period_turnover(period_jls, pfx, "CREDIT", exclude_911=False)
                p_paid = _period_turnover(period_jls, pfx, "DEBIT", exclude_911=False)
                c_net = o_net + p_in - p_paid
                c_pay = max(ZERO, c_net)
                c_rec = max(ZERO, -c_net)

                tot_o_pay += o_pay
                tot_o_rec += o_rec
                tot_pay_in += p_in
                tot_paid += p_paid
                tot_c_pay += c_pay
                tot_c_rec += c_rec

                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=1,
                    display_order=idx,
                    column_values_json={
                        "tax_type": rl,
                        "opening_receivable": _fmt_dec(o_rec),
                        "opening_payable": _fmt_dec(o_pay),
                        "payable_in_period": _fmt_dec(p_in),
                        "paid_in_period": _fmt_dec(p_paid),
                        "closing_receivable": _fmt_dec(c_rec),
                        "closing_payable": _fmt_dec(c_pay),
                    },
                    is_total_row=False,
                    drilldown_reference_json={"account_codes": [pfx] if isinstance(pfx, str) else list(pfx)},
                )
            FinancialNoteTableRow.objects.create(
                statement_run=run,
                note_table=tbl,
                row_code="TOTAL",
                row_label="Cộng thuế và các khoản phải nộp Nhà nước",
                row_level=1,
                display_order=len(tax_rows) + 1,
                column_values_json={
                    "tax_type": "Cộng thuế và các khoản phải nộp Nhà nước",
                    "opening_receivable": _fmt_dec(tot_o_rec),
                    "opening_payable": _fmt_dec(tot_o_pay),
                    "payable_in_period": _fmt_dec(tot_pay_in),
                    "paid_in_period": _fmt_dec(tot_paid),
                    "closing_receivable": _fmt_dec(tot_c_rec),
                    "closing_payable": _fmt_dec(tot_c_pay),
                },
                is_total_row=True,
                drilldown_reference_json={"account_codes": ["333"]},
            )
            _add_gl_ref("333", tot_c_pay, tot_o_pay)

        elif tcode == "V.27.MOVEMENT":
            # Equity movement matrix across 4111, 4112, 414, 418, 419, 421
            eq_accs = [
                ("paid_in_capital", "4111", True),
                ("share_premium", "4112", True),
                ("other_capital", "4118", True),
                ("treasury_shares", "419", False),
                ("investment_dev_fund", "414", True),
                ("other_equity_funds", "418", True),
                ("retained_earnings", "421", True),
            ]
            o_vals: dict[str, Decimal] = {}
            inc_vals: dict[str, Decimal] = {}
            dec_vals: dict[str, Decimal] = {}
            c_vals: dict[str, Decimal] = {}

            for col_k, pfx, cred_norm in eq_accs:
                o_v = _net_bal(open_jls, pfx, cred_norm)
                inc_v = _period_turnover(period_jls, pfx, "CREDIT" if cred_norm else "DEBIT", exclude_911=False)
                dec_v = _period_turnover(period_jls, pfx, "DEBIT" if cred_norm else "CREDIT", exclude_911=False)
                if col_k == "treasury_shares":
                    o_v = -abs(o_v)
                    c_v = o_v - inc_v + dec_v
                else:
                    c_v = o_v + inc_v - dec_v
                o_vals[col_k] = o_v
                inc_vals[col_k] = inc_v
                dec_vals[col_k] = dec_v
                c_vals[col_k] = c_v

            def _eq_row_json(lbl: str, src: dict[str, Decimal], sign_mult: Decimal = Decimal("1")) -> dict[str, Any]:
                d: dict[str, Any] = {"row_label": lbl}
                tot = ZERO
                for col_k, _, _ in eq_accs:
                    v = src.get(col_k, ZERO) * sign_mult
                    d[col_k] = _fmt_dec(v)
                    tot += v
                d["total"] = _fmt_dec(tot)
                return d

            eq_rows = [
                ("CURR_YEAR_OPENING", "Số dư đầu năm nay", _eq_row_json("Số dư đầu năm nay", o_vals), False),
                ("CURR_YEAR_CAPITAL_INCREASE", "- Tăng vốn / lợi nhuận trong năm nay", _eq_row_json("- Tăng trong năm nay", inc_vals), False),
                ("CURR_YEAR_DIVIDENDS", "- Giảm vốn / chia cổ tức / phân phối quỹ trong năm nay", _eq_row_json("- Giảm trong năm nay", dec_vals), False),
                ("CURR_YEAR_CLOSING", "Số dư cuối năm nay", _eq_row_json("Số dư cuối năm nay", c_vals), True),
            ]
            for idx, (rc, rl, cjson, is_tot) in enumerate(eq_rows, start=1):
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=1,
                    display_order=idx,
                    column_values_json=cjson,
                    is_total_row=is_tot,
                    drilldown_reference_json={"account_codes": ["411", "414", "418", "419", "421"]},
                )
            _add_gl_ref("411", c_vals["paid_in_capital"], o_vals["paid_in_capital"])
            _add_gl_ref("421", c_vals["retained_earnings"], o_vals["retained_earnings"])

        elif tcode == "VII.1.REVENUE":
            cur_511 = _period_turnover(period_jls, "511", "CREDIT", exclude_911=True)
            prv_511 = _period_turnover(prev_jls, "511", "CREDIT", exclude_911=True)
            b02_01 = b02_map.get("01")
            if cur_511 == ZERO and b02_01:
                cur_511 = b02_01[0]
                prv_511 = b02_01[1]
            rev_rows = [
                ("REV_GOODS", "- Doanh thu bán hàng và thành phẩm", cur_511, prv_511, False),
                ("REV_SERVICES", "- Doanh thu cung cấp dịch vụ", ZERO, ZERO, False),
                ("REV_CONTRACTS", "- Doanh thu hợp đồng xây dựng", ZERO, ZERO, False),
                ("TOTAL", "Cộng doanh thu bán hàng và cung cấp dịch vụ", cur_511, prv_511, True),
            ]
            for idx, (rc, rl, cv, pv, is_tot) in enumerate(rev_rows, start=1):
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=1,
                    display_order=idx,
                    column_values_json={
                        "category_name": rl,
                        "current_year_amount": _fmt_dec(cv),
                        "previous_year_amount": _fmt_dec(pv),
                    },
                    is_total_row=is_tot,
                    drilldown_reference_json={"account_codes": ["511"], "b02_indicator": "01"},
                )
            _add_gl_ref("511", cur_511, prv_511)

        elif tcode == "VII.2.DEDUCTIONS":
            cur_521 = _period_turnover(period_jls, "521", "DEBIT", exclude_911=True)
            prv_521 = _period_turnover(prev_jls, "521", "DEBIT", exclude_911=True)
            b02_02 = b02_map.get("02")
            if cur_521 == ZERO and b02_02:
                cur_521 = b02_02[0]
                prv_521 = b02_02[1]
            ded_rows = [
                ("TRADE_DISCOUNTS", "- Chiết khấu thương mại (TK 5211)", cur_521, prv_521, False),
                ("SALES_ALLOWANCES", "- Giảm giá hàng bán (TK 5213)", ZERO, ZERO, False),
                ("SALES_RETURNS", "- Hàng bán bị trả lại (TK 5212)", ZERO, ZERO, False),
                ("TOTAL", "Cộng các khoản giảm trừ doanh thu", cur_521, prv_521, True),
            ]
            for idx, (rc, rl, cv, pv, is_tot) in enumerate(ded_rows, start=1):
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=1,
                    display_order=idx,
                    column_values_json={
                        "category_name": rl,
                        "current_year_amount": _fmt_dec(cv),
                        "previous_year_amount": _fmt_dec(pv),
                    },
                    is_total_row=is_tot,
                    drilldown_reference_json={"account_codes": ["521"], "b02_indicator": "02"},
                )
            _add_gl_ref("521", cur_521, prv_521)

        elif tcode == "VII.3.COGS":
            cur_632 = _period_turnover(period_jls, "632", "DEBIT", exclude_911=True)
            prv_632 = _period_turnover(prev_jls, "632", "DEBIT", exclude_911=True)
            b02_11 = b02_map.get("11")
            if cur_632 == ZERO and b02_11:
                cur_632 = b02_11[0]
                prv_632 = b02_11[1]
            cogs_rows = [
                ("COGS_OPERATING", "- Giá vốn của hàng hóa, thành phẩm, dịch vụ đã bán", cur_632, prv_632, False),
                ("INVENTORY_PROVISION", "- Dự phòng giảm giá hàng tồn kho", ZERO, ZERO, False),
                ("TOTAL", "Cộng giá vốn hàng bán", cur_632, prv_632, True),
            ]
            for idx, (rc, rl, cv, pv, is_tot) in enumerate(cogs_rows, start=1):
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=1,
                    display_order=idx,
                    column_values_json={
                        "category_name": rl,
                        "current_year_amount": _fmt_dec(cv),
                        "previous_year_amount": _fmt_dec(pv),
                    },
                    is_total_row=is_tot,
                    drilldown_reference_json={"account_codes": ["632"], "b02_indicator": "11"},
                )
            _add_gl_ref("632", cur_632, prv_632)

        elif tcode == "VII.4.IP_DISPOSAL":
            # Net Gain/Loss = Sale Proceeds - Carrying Amount - Disposal Expenses (TC-RPT-06-47)
            struct_c = content_obj.structured_content_json or {}
            proceeds = _to_dec(struct_c.get("sale_proceeds", ZERO))
            carrying = _to_dec(struct_c.get("carrying_amount", ZERO))
            disp_exp = _to_dec(struct_c.get("disposal_expenses", ZERO))
            net_gl = proceeds - carrying - disp_exp
            ip_rows = [
                ("SALE_PROCEEDS", "- Doanh thu bán, thanh lý BĐSĐT", proceeds, ZERO, False),
                ("CARRYING_AMOUNT", "- Giá trị còn lại của BĐSĐT", carrying, ZERO, False),
                ("DISPOSAL_EXPENSES", "- Chi phí nhượng bán, thanh lý BĐSĐT", disp_exp, ZERO, False),
                ("NET_GAIN_LOSS", "Lãi (lỗ) thuần từ bán, thanh lý BĐSĐT", net_gl, ZERO, True),
            ]
            for idx, (rc, rl, cv, pv, is_tot) in enumerate(ip_rows, start=1):
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=1,
                    display_order=idx,
                    column_values_json={
                        "item_name": rl,
                        "current_year_amount": _fmt_dec(cv),
                        "previous_year_amount": _fmt_dec(pv),
                    },
                    is_total_row=is_tot,
                )

        elif tcode == "VII.11.CIT":
            # CIT reconciliation: never hardcode 20% if company has preferential/exempt tax rate! (BR-RPT-B09-52, TC-RPT-06-51, 52)
            struct_c = content_obj.structured_content_json or {}
            b02_50 = b02_map.get("50")
            b02_51 = b02_map.get("51")
            b02_52 = b02_map.get("52")
            pbt_cur = _to_dec(struct_c.get("profit_before_tax", b02_50[0] if b02_50 else ZERO))
            pbt_prv = _to_dec(struct_c.get("previous_profit_before_tax", b02_50[1] if b02_50 else ZERO))
            rate_cur = _to_dec(struct_c.get("statutory_tax_rate", Decimal("20.00")))
            rate_prv = _to_dec(struct_c.get("previous_statutory_tax_rate", rate_cur))
            cur_8211 = _period_turnover(period_jls, "8211", "DEBIT", exclude_911=True)
            prv_8211 = _period_turnover(prev_jls, "8211", "DEBIT", exclude_911=True)
            cur_8212 = _period_turnover(period_jls, "8212", "DEBIT", exclude_911=True)
            prv_8212 = _period_turnover(prev_jls, "8212", "DEBIT", exclude_911=True)

            cit_cur = _to_dec(struct_c.get("current_tax_expense", b02_51[0] if b02_51 else cur_8211))
            cit_prv = _to_dec(struct_c.get("previous_current_tax_expense", b02_51[1] if b02_51 else prv_8211))
            def_cur = _to_dec(struct_c.get("deferred_tax_expense", b02_52[0] if b02_52 else cur_8212))
            def_prv = _to_dec(struct_c.get("previous_deferred_tax_expense", b02_52[1] if b02_52 else prv_8212))
            tax_stat_cur = (pbt_cur * rate_cur / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if pbt_cur > ZERO else ZERO
            tax_stat_prv = (pbt_prv * rate_prv / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if pbt_prv > ZERO else ZERO
            non_tax_inc = _to_dec(struct_c.get("non_taxable_income_adjustment", ZERO))
            non_ded_exp = _to_dec(struct_c.get("non_deductible_expense_adjustment", ZERO))
            prior_adj = _to_dec(struct_c.get("prior_year_tax_adjustment", ZERO))
            other_adj = _to_dec(struct_c.get("other_tax_adjustment", cit_cur - (tax_stat_cur - non_tax_inc + non_ded_exp + prior_adj)))
            tot_tax_cur = cit_cur + def_cur
            tot_tax_prv = cit_prv + def_prv

            cit_rows = [
                ("profit_before_tax", "1. Tổng lợi nhuận kế toán trước thuế", pbt_cur, pbt_prv, False),
                ("statutory_tax_rate", "2. Thuế suất thuế TNDN theo quy định (%)", rate_cur, rate_prv, False),
                ("tax_at_statutory_rate", "3. Thuế TNDN tính theo thuế suất áp dụng", tax_stat_cur, tax_stat_prv, False),
                ("non_taxable_income_adjustment", "4. Điều chỉnh giảm: Thu nhập không chịu thuế", non_tax_inc, ZERO, False),
                ("non_deductible_expense_adjustment", "5. Điều chỉnh tăng: Chi phí không được trừ", non_ded_exp, ZERO, False),
                ("prior_year_tax_adjustment", "6. Điều chỉnh thuế TNDN của các năm trước", prior_adj, ZERO, False),
                ("other_tax_adjustment", "7. Các khoản điều chỉnh khác / ưu đãi thuế", other_adj, ZERO, False),
                ("current_tax_expense", "8. Chi phí thuế TNDN hiện hành (B02 Mã 51)", cit_cur, cit_prv, True),
                ("deferred_tax_expense", "9. Chi phí (thu nhập) thuế TNDN hoãn lại (B02 Mã 52)", def_cur, def_prv, True),
                ("total_tax_expense", "10. Tổng chi phí thuế TNDN", tot_tax_cur, tot_tax_prv, True),
            ]
            for idx, (rc, rl, cv, pv, is_tot) in enumerate(cit_rows, start=1):
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code=rc,
                    row_label=rl,
                    row_level=1,
                    display_order=idx,
                    column_values_json={
                        "item_name": rl,
                        "current_year_amount": _fmt_dec(cv),
                        "previous_year_amount": _fmt_dec(pv),
                    },
                    is_total_row=is_tot,
                    drilldown_reference_json={"account_codes": ["8211", "8212"], "b02_indicators": ["50", "51", "52"]},
                )
            _add_gl_ref("821", tot_tax_cur, tot_tax_prv)

        elif tcode == "VIII.1.RESTRICTED_CASH":
            rc_idx = 0
            tot_rc = ZERO
            for jl in close_jls:
                dim = jl.dimensions or {}
                if jl.account.code.startswith(("111", "112", "113", "128")) and (dim.get("is_restricted_cash") or dim.get("restricted")):
                    rc_idx += 1
                    amt = _to_dec(jl.debit) - _to_dec(jl.credit)
                    tot_rc += amt
                    FinancialNoteTableRow.objects.create(
                        statement_run=run,
                        note_table=tbl,
                        row_code=f"RESTRICTED_{rc_idx:02d}",
                        row_label=str(dim.get("restriction_type") or "Tiền gửi phong tỏa / ký quỹ có hạn chế sử dụng"),
                        row_level=1,
                        display_order=rc_idx,
                        column_values_json={
                            "restriction_type": str(dim.get("restriction_type") or "Tiền bị phong tỏa / hạn chế sử dụng"),
                            "amount": _fmt_dec(amt),
                            "restriction_reason": str(dim.get("restriction_reason") or jl.description or "Bảo lãnh ngân hàng / phong tỏa theo hợp đồng"),
                            "source_reference": str(dim.get("source_reference") or getattr(jl.entry, "number", "") or ""),
                        },
                        is_total_row=False,
                        drilldown_reference_json={"entry_id": str(jl.entry_id), "account_code": jl.account.code},
                    )
            if rc_idx > 0:
                FinancialNoteTableRow.objects.create(
                    statement_run=run,
                    note_table=tbl,
                    row_code="TOTAL",
                    row_label="Cộng các khoản tiền bị hạn chế sử dụng",
                    row_level=1,
                    display_order=rc_idx + 1,
                    column_values_json={
                        "restriction_type": "Cộng các khoản tiền bị hạn chế sử dụng",
                        "amount": _fmt_dec(tot_rc),
                        "restriction_reason": "",
                        "source_reference": "",
                    },
                    is_total_row=True,
                )

        elif tcode == "VIII.2.NON_CASH":
            # Non-cash investing/financing transactions (e.g., acquistare FA via finance lease or debt-to-equity swap)
            nc_idx = 0
            checked_entries = set()
            for jl in period_jls:
                if jl.entry_id in checked_entries:
                    continue
                e_lines = [x for x in period_jls if x.entry_id == jl.entry_id]
                checked_entries.add(jl.entry_id)
                has_cash = any(x.account.code.startswith(("111", "112", "113")) for x in e_lines)
                if has_cash:
                    continue
                has_fa_invest = any(x.account.code.startswith(("211", "212", "213", "217", "241", "221", "222")) and _to_dec(x.debit) > ZERO for x in e_lines)
                has_loan_eq = any(x.account.code.startswith(("341", "411")) for x in e_lines)
                if has_fa_invest and has_loan_eq:
                    nc_idx += 1
                    amt = sum((_to_dec(x.debit) for x in e_lines if x.account.code.startswith(("211", "212", "213", "217", "241", "221", "222"))), ZERO)
                    FinancialNoteTableRow.objects.create(
                        statement_run=run,
                        note_table=tbl,
                        row_code=f"NON_CASH_{nc_idx:02d}",
                        row_label=jl.entry.description or "Giao dịch đầu tư / tài chính phi tiền tệ",
                        row_level=1,
                        display_order=nc_idx,
                        column_values_json={
                            "transaction_type": "Mua TSCĐ / đầu tư bằng nhận nợ vay hoặc thuê tài chính",
                            "current_amount": _fmt_dec(amt),
                            "previous_amount": "0.00",
                            "description": jl.entry.description or "",
                        },
                        is_total_row=False,
                        drilldown_reference_json={"entry_id": str(jl.entry_id)},
                    )

        elif tcode == "VIII.3.BORROWINGS_RECEIVED":
            # Actual cash proceeds from borrowings in period (Debit 111/112 <-> Credit 341/343)
            b03_33 = b03_map.get("33")
            cash_proceeds = ZERO
            checked_entries = set()
            for jl in period_jls:
                if jl.entry_id in checked_entries:
                    continue
                e_lines = [x for x in period_jls if x.entry_id == jl.entry_id]
                checked_entries.add(jl.entry_id)
                cash_dr = sum((_to_dec(x.debit) for x in e_lines if x.account.code.startswith(("111", "112"))), ZERO)
                loan_cr = sum((_to_dec(x.credit) for x in e_lines if x.account.code.startswith(("341", "343"))), ZERO)
                if cash_dr > ZERO and loan_cr > ZERO:
                    cash_proceeds += min(cash_dr, loan_cr)
            if cash_proceeds == ZERO and b03_33:
                cash_proceeds = abs(b03_33[0])
            FinancialNoteTableRow.objects.create(
                statement_run=run,
                note_table=tbl,
                row_code="LOAN_PROCEEDS",
                row_label="- Tiền thu từ đi vay theo khế ước thông thường",
                row_level=1,
                display_order=1,
                column_values_json={
                    "borrowing_type": "- Tiền thu từ đi vay theo khế ước thông thường",
                    "amount": _fmt_dec(cash_proceeds),
                    "source_reference": "B03 Mã 33 / Sổ cái TK 111, 112 đối ứng TK 341",
                },
                is_total_row=False,
                drilldown_reference_json={"b03_indicator": "33", "account_codes": ["341"]},
            )
            FinancialNoteTableRow.objects.create(
                statement_run=run,
                note_table=tbl,
                row_code="TOTAL",
                row_label="Cộng số tiền đi vay thực thu trong kỳ",
                row_level=1,
                display_order=2,
                column_values_json={
                    "borrowing_type": "Cộng số tiền đi vay thực thu trong kỳ",
                    "amount": _fmt_dec(cash_proceeds),
                    "source_reference": "B03 Mã 33",
                },
                is_total_row=True,
                drilldown_reference_json={"b03_indicator": "33"},
            )

        elif tcode == "VIII.4.PRINCIPAL_REPAID":
            # Actual cash principal repayments in period (Debit 341/343 <-> Credit 111/112), EXCLUDING interest paid (635/335)!
            b03_34 = b03_map.get("34")
            cash_repaid = ZERO
            checked_entries = set()
            for jl in period_jls:
                if jl.entry_id in checked_entries:
                    continue
                e_lines = [x for x in period_jls if x.entry_id == jl.entry_id]
                checked_entries.add(jl.entry_id)
                cash_cr = sum((_to_dec(x.credit) for x in e_lines if x.account.code.startswith(("111", "112"))), ZERO)
                loan_dr = sum((_to_dec(x.debit) for x in e_lines if x.account.code.startswith(("341", "343"))), ZERO)
                if cash_cr > ZERO and loan_dr > ZERO:
                    cash_repaid += min(cash_cr, loan_dr)
            if cash_repaid == ZERO and b03_34:
                cash_repaid = abs(b03_34[0])
            FinancialNoteTableRow.objects.create(
                statement_run=run,
                note_table=tbl,
                row_code="PRINCIPAL_REPAID",
                row_label="- Tiền trả nợ gốc vay theo khế ước thông thường",
                row_level=1,
                display_order=1,
                column_values_json={
                    "repayment_type": "- Tiền trả nợ gốc vay theo khế ước thông thường",
                    "amount": _fmt_dec(cash_repaid),
                    "source_reference": "B03 Mã 34 / Sổ cái TK 341 đối ứng TK 111, 112 (không bao gồm lãi vay đã trả)",
                },
                is_total_row=False,
                drilldown_reference_json={"b03_indicator": "34", "account_codes": ["341"]},
            )
            FinancialNoteTableRow.objects.create(
                statement_run=run,
                note_table=tbl,
                row_code="TOTAL",
                row_label="Cộng số tiền đã thực trả gốc vay trong kỳ",
                row_level=1,
                display_order=2,
                column_values_json={
                    "repayment_type": "Cộng số tiền đã thực trả gốc vay trong kỳ",
                    "amount": _fmt_dec(cash_repaid),
                    "source_reference": "B03 Mã 34",
                },
                is_total_row=True,
                drilldown_reference_json={"b03_indicator": "34"},
            )


def _sync_legacy_b09_statement_values(
    run: FinancialStatementRun,
    open_jls: list[JournalLine],
    period_jls: list[JournalLine],
    close_jls: list[JournalLine],
    prev_jls: list[JournalLine],
    _net_bal: Any,
    _period_turnover: Any,
) -> None:
    """
    Maintains `FinancialStatementValue` records on `run` for `run.template_version.lines`
    (`I.01`, `II.01`, `III.01`, `V.01..V.06`, `VI.01..VI.08`) so `UC-RPT-02` bundle validation
    and legacy line queries continue to work with 100% backward compatibility.
    """
    lines = list(run.template_version.lines.all().order_by("display_order"))
    if not lines:
        return

    # Map note_code -> FinancialNoteContent for status sync
    nc_map = {c.note_item.note_code: c for c in run.note_contents.select_related("note_item")}

    c_cash = (
        _net_bal(close_jls, "111", False, exclude_restricted=True)
        + _net_bal(close_jls, "112", False, exclude_restricted=True)
        + _net_bal(close_jls, "113", False, exclude_restricted=True)
        + _net_bal(close_jls, "1281", False, exclude_restricted=True)
    )
    o_cash = (
        _net_bal(open_jls, "111", False, exclude_restricted=True)
        + _net_bal(open_jls, "112", False, exclude_restricted=True)
        + _net_bal(open_jls, "113", False, exclude_restricted=True)
        + _net_bal(open_jls, "1281", False, exclude_restricted=True)
    )
    c_131 = max(ZERO, _net_bal(close_jls, "131", False))
    o_131 = max(ZERO, _net_bal(open_jls, "131", False))
    c_inv = _net_bal(close_jls, ("151", "152", "153", "154", "155", "156", "157", "158"), False) - _net_bal(close_jls, "2294", True)
    o_inv = _net_bal(open_jls, ("151", "152", "153", "154", "155", "156", "157", "158"), False) - _net_bal(open_jls, "2294", True)
    c_fa = _net_bal(close_jls, "211", False) - _net_bal(close_jls, "2141", True)
    o_fa = _net_bal(open_jls, "211", False) - _net_bal(open_jls, "2141", True)
    c_331 = max(ZERO, _net_bal(close_jls, "331", True))
    o_331 = max(ZERO, _net_bal(open_jls, "331", True))
    c_eq = _net_bal(close_jls, ("411", "414", "418", "421"), True) - _net_bal(close_jls, "419", False)
    o_eq = _net_bal(open_jls, ("411", "414", "418", "421"), True) - _net_bal(open_jls, "419", False)

    cur_511 = _period_turnover(period_jls, "511", "CREDIT", exclude_911=True)
    prv_511 = _period_turnover(prev_jls, "511", "CREDIT", exclude_911=True)
    cur_632 = _period_turnover(period_jls, "632", "DEBIT", exclude_911=True)
    prv_632 = _period_turnover(prev_jls, "632", "DEBIT", exclude_911=True)
    cur_8211 = _period_turnover(period_jls, "8211", "DEBIT", exclude_911=True)
    prv_8211 = _period_turnover(prev_jls, "8211", "DEBIT", exclude_911=True)

    val_map: dict[str, tuple[Decimal | None, Decimal | None, str]] = {
        "I.01": (None, None, f"Đơn vị báo cáo: {run.company.name}"),
        "II.01": (None, None, f"Kỳ kế toán từ {run.period_start_date.isoformat()} đến {run.period_end_date.isoformat()}"),
        "III.01": (None, None, "Áp dụng Chế độ kế toán doanh nghiệp theo Thông tư 99/2025/TT-BTC"),
        "V.01": (c_cash, o_cash, f"Tiền và tương đương tiền cuối kỳ: {_fmt_dec(c_cash)}"),
        "V.02": (c_131, o_131, f"Phải thu ngắn hạn của khách hàng cuối kỳ: {_fmt_dec(c_131)}"),
        "V.03": (c_inv, o_inv, f"Hàng tồn kho thuần cuối kỳ: {_fmt_dec(c_inv)}"),
        "V.04": (c_fa, o_fa, f"Tài sản cố định hữu hình thuần cuối kỳ: {_fmt_dec(c_fa)}"),
        "V.05": (c_331, o_331, f"Phải trả người bán ngắn hạn cuối kỳ: {_fmt_dec(c_331)}"),
        "V.06": (c_eq, o_eq, f"Vốn chủ sở hữu cuối kỳ: {_fmt_dec(c_eq)}"),
        "VI.01": (cur_511, prv_511, f"Doanh thu bán hàng và cung cấp dịch vụ: {_fmt_dec(cur_511)}"),
        "VI.02": (cur_632, prv_632, f"Giá vốn hàng bán: {_fmt_dec(cur_632)}"),
        "VI.08": (cur_8211, prv_8211, f"Chi phí thuế TNDN hiện hành: {_fmt_dec(cur_8211)}"),
    }

    existing_fsv = {v.statement_line.indicator_code: v for v in run.values.select_related("statement_line")}
    for ln in lines:
        ic = ln.indicator_code
        cur_v, prv_v, txt_v = val_map.get(ic, (ZERO, ZERO, ln.indicator_name))
        old_v = existing_fsv.get(ic)
        if old_v and old_v.content_status in ("MISSING", "MANUAL_REQUIRED"):
            # Preserve explicit test-set status on FinancialStatementValue (e.g., TC-RPT-02-19)
            continue
        FinancialStatementValue.objects.update_or_create(
            statement_run=run,
            statement_line=ln,
            defaults={
                "current_period_amount": cur_v,
                "comparative_period_amount": prv_v,
                "text_value": txt_v,
                "content_status": "COMPLETE",
            },
        )


# ============================================================================
# PART 3: VALIDATION ENGINE (`validate_financial_notes_run`)
# ============================================================================

@transaction.atomic
def validate_financial_notes_run(
    run: FinancialStatementRun,
    bundle: FinancialStatementBundle | None = None,
) -> dict[str, Any]:
    """
    Executes comprehensive validation on a B09 / B09-DNKLT / B09a-DN run (`RPT06-F18..F20`,
    `B09-VAL-01..08`, `EF-08..EF-30`) and persists `FinancialNoteValidationResult` rows.
    """
    ensure_b09_templates_seeded()
    run.note_validation_results.all().delete()

    results: list[FinancialNoteValidationResult] = []
    legal_code = run.template.legal_form_code
    tv = run.template_version
    sections = list(tv.note_sections.prefetch_related("items__tables").order_by("display_order"))
    contents_by_code = {
        c.note_item.note_code: c
        for c in run.note_contents.select_related("note_item")
    }
    rows_by_tcode: dict[str, dict[str, FinancialNoteTableRow]] = {}
    for r in run.note_table_rows.select_related("table"):
        rows_by_tcode.setdefault(r.table.table_code, {})[r.row_code] = r

    def _add_res(
        code: str,
        name: str,
        vtype: str,
        status: str,
        severity: str,
        msg: str,
        sec: FinancialNoteSection | None = None,
        itm: FinancialNoteItem | None = None,
        tbl: FinancialNoteTable | None = None,
        exp: Decimal | None = None,
        act: Decimal | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        diff = (act - exp) if (exp is not None and act is not None) else None
        obj = FinancialNoteValidationResult.objects.create(
            statement_run=run,
            note_section=sec,
            note_item=itm,
            note_table=tbl,
            check_code=code,
            check_name=name,
            validation_type=vtype,
            validation_status=status,
            severity=severity,
            expected_value=exp,
            actual_value=act,
            difference_value=diff,
            message=msg,
            details_json=details or {},
        )
        results.append(obj)

    # 1. B09-VAL-01: Template & Going Concern consistency
    expected_codes_list = ["I", "II", "III", "IV", "V", "VII", "VIII", "IX", "X"] if legal_code in ("B09-DN", "B09-DNKLT") else ["I", "II", "III", "IV", "VI"]
    actual_codes_list = [s.section_code for s in sections]
    if actual_codes_list == expected_codes_list:
        _add_res(
            "B09-VAL-01",
            "Kiểm tra cấu trúc mẫu biểu Thuyết minh BCTC và đánh số La Mã",
            "TEMPLATE_VALID",
            "PASSED",
            "INFO",
            f"Mẫu {legal_code} có cấu trúc {len(actual_codes_list)} phần ({', '.join(actual_codes_list)}) đúng chuẩn Phụ lục IV Thông tư 99/2025/TT-BTC.",
            details={"expected_sections": expected_codes_list, "actual_sections": actual_codes_list},
        )
    else:
        _add_res(
            "B09-VAL-01",
            "Kiểm tra cấu trúc mẫu biểu Thuyết minh BCTC và đánh số La Mã",
            "TEMPLATE_VALID",
            "FAILED",
            "ERROR",
            f"Cấu trúc phần của mẫu {legal_code} ({actual_codes_list}) không khớp chuẩn ({expected_codes_list}).",
            details={"expected_sections": expected_codes_list, "actual_sections": actual_codes_list},
        )

    # 2. B09-VAL-02 & B09-VAL-03: Section & Required Note Completeness + Applicability Reason check
    missing_required_notes: list[str] = []
    missing_na_reason_notes: list[str] = []
    unconfirmed_notes: list[str] = []

    for sec in sections:
        sec_items = list(sec.items.all().order_by("display_order"))
        for itm in sec_items:
            c_obj = contents_by_code.get(itm.note_code)
            if not c_obj:
                if itm.is_required_by_default:
                    missing_required_notes.append(itm.note_code)
                continue
            if not c_obj.is_applicable:
                if not (c_obj.not_applicable_reason or "").strip():
                    missing_na_reason_notes.append(itm.note_code)
                continue
            if c_obj.content_status in ("NOT_STARTED", "MANUAL_REQUIRED"):
                if itm.is_required_by_default:
                    missing_required_notes.append(itm.note_code)
            elif c_obj.content_status == "REVIEW_REQUIRED":
                unconfirmed_notes.append(itm.note_code)

    if missing_na_reason_notes:
        _add_res(
            "B09-VAL-02-NA",
            "Kiểm tra lý do đánh dấu Không áp dụng (NOT_APPLICABLE)",
            "REQUIRED_NOTE_PRESENT",
            "FAILED",
            "ERROR",
            f"Các mục đánh dấu Không áp dụng nhưng thiếu lý do giải trình: {', '.join(missing_na_reason_notes)}.",
            details={"missing_na_reason_notes": missing_na_reason_notes, "error_code": "EF-10"},
        )

    if missing_required_notes:
        _add_res(
            "B09-VAL-03",
            "Kiểm tra tính đầy đủ của các mục thuyết minh bắt buộc",
            "REQUIRED_NOTE_PRESENT",
            "WARNING",
            "WARNING",
            f"Còn {len(missing_required_notes)} mục thuyết minh bắt buộc cần nhập hoặc xác nhận thủ công ({', '.join(missing_required_notes[:10])}). Không được phê duyệt (APPROVE) khi chưa hoàn tất.",
            details={"missing_required_notes": missing_required_notes, "error_code": "EF-09", "blocks_approval": True},
        )
    else:
        _add_res(
            "B09-VAL-03",
            "Kiểm tra tính đầy đủ của các mục thuyết minh bắt buộc",
            "REQUIRED_NOTE_PRESENT",
            "PASSED",
            "INFO",
            "Tất cả các mục thuyết minh bắt buộc đã có dữ liệu hoặc xác nhận Không áp dụng hợp lệ.",
        )

    # Check B09-DNKLT non-going concern mandatory fields (EF-26, TC-RPT-06-63..66)
    if legal_code == "B09-DNKLT":
        ix6_c = contents_by_code.get("IX.6")
        ix6_struct = (ix6_c.structured_content_json or {}) if ix6_c else {}
        req_ngc = [
            "non_going_concern_reason",
            "termination_or_dissolution_plan",
            "decision_authority",
            "decision_number",
            "decision_date",
            "management_intention_reference",
            "asset_remeasurement_basis",
            "liability_remeasurement_basis",
            "reclassification_explanation",
            "financial_impact",
            "source_reference",
            "confirmed_by",
        ]
        missing_ngc = [f for f in req_ngc if not ix6_struct.get(f)]
        if missing_ngc:
            _add_res(
                "B09-VAL-DNKLT-IX6",
                "Kiểm tra thuyết minh bắt buộc khi KHÔNG đáp ứng giả định hoạt động liên tục (B09-DNKLT)",
                "REQUIRED_NOTE_PRESENT",
                "FAILED",
                "ERROR",
                f"Mẫu B09-DNKLT thiếu thông tin bắt buộc tại mục IX.6: {', '.join(missing_ngc)}.",
                itm=ix6_c.note_item if ix6_c else None,
                details={"missing_fields": missing_ngc, "error_code": "EF-26"},
            )
        else:
            _add_res(
                "B09-VAL-DNKLT-IX6",
                "Kiểm tra thuyết minh bắt buộc khi KHÔNG đáp ứng giả định hoạt động liên tục (B09-DNKLT)",
                "REQUIRED_NOTE_PRESENT",
                "PASSED",
                "INFO",
                "Mục IX.6 trên B09-DNKLT đã đầy đủ căn cứ pháp lý và thuyết minh đánh giá lại tài sản/nợ phải trả.",
                itm=ix6_c.note_item if ix6_c else None,
            )

    # Check B09a-DN 10 interim significant events (EF-27, TC-RPT-06-67, 70)
    if legal_code == "B09a-DN":
        vi_sec = next((s for s in sections if s.section_code == "VI"), None)
        vi_items = list(vi_sec.items.all().order_by("display_order")) if vi_sec else []
        if len(vi_items) == 10:
            _add_res(
                "B09-VAL-B09A-VI",
                "Kiểm tra 10 nhóm sự kiện và giao dịch trọng yếu giữa niên độ (Phần VI - B09a-DN)",
                "SECTION_COMPLETE",
                "PASSED",
                "INFO",
                "Phần VI của B09a-DN có đủ 10 nhóm sự kiện và giao dịch trọng yếu (VI.1 .. VI.10).",
                sec=vi_sec,
            )
        else:
            _add_res(
                "B09-VAL-B09A-VI",
                "Kiểm tra 10 nhóm sự kiện và giao dịch trọng yếu giữa niên độ (Phần VI - B09a-DN)",
                "SECTION_COMPLETE",
                "FAILED",
                "ERROR",
                f"Phần VI của B09a-DN thiếu nhóm sự kiện (hiện có {len(vi_items)}/10).",
                sec=vi_sec,
                details={"error_code": "EF-27"},
            )

    # 3. B09-VAL-04: Internal Table Formulas (EF-08, EF-15, EF-17, EF-19)
    # 3a. V.1.SUMMARY
    v1_rows = rows_by_tcode.get("V.1.SUMMARY", {})
    if v1_rows and "TOTAL" in v1_rows:
        tot_r = v1_rows["TOTAL"]
        act_c = _to_dec(tot_r.column_values_json.get("closing_amount"))
        exp_c = sum(
            (
                _to_dec(v1_rows[k].column_values_json.get("closing_amount"))
                for k in ("CASH_ON_HAND", "CASH_AT_BANK", "CASH_IN_TRANSIT", "CASH_EQUIVALENTS")
                if k in v1_rows
            ),
            ZERO,
        )
        if act_c == exp_c:
            _add_res(
                "B09-VAL-04-V1",
                "Kiểm tra công thức cộng bảng V.1 (Tiền và tương đương tiền)",
                "TABLE_FORMULA_BALANCE",
                "PASSED",
                "INFO",
                "Tổng cộng bảng V.1 khớp tổng các dòng thành phần.",
                tbl=tot_r.note_table,
                exp=exp_c,
                act=act_c,
            )
        else:
            _add_res(
                "B09-VAL-04-V1",
                "Kiểm tra công thức cộng bảng V.1 (Tiền và tương đương tiền)",
                "TABLE_FORMULA_BALANCE",
                "FAILED",
                "ERROR",
                f"Bảng V.1 lệch công thức tổng cộng: thực tế {_fmt_dec(act_c)} != tính toán {_fmt_dec(exp_c)}.",
                tbl=tot_r.note_table,
                exp=exp_c,
                act=act_c,
                details={"error_code": "EF-08"},
            )

    # 3b. Fixed Assets roll-forward tables (V.9, V.10, V.11, V.13)
    for fa_tcode in ("V.9.TANGIBLE_FA", "V.10.INTANGIBLE_FA", "V.11.FINANCE_LEASE_FA", "V.13.INVESTMENT_PROPERTY"):
        fa_rows = rows_by_tcode.get(fa_tcode, {})
        if not fa_rows or "COST_CLOSING" not in fa_rows:
            continue
        tbl_obj = fa_rows["COST_CLOSING"].note_table
        o_cost = _to_dec(fa_rows["COST_OPENING"].column_values_json.get("total")) if "COST_OPENING" in fa_rows else ZERO
        add_cost = _to_dec(fa_rows["COST_ADDITIONS"].column_values_json.get("total")) if "COST_ADDITIONS" in fa_rows else ZERO
        disp_cost = _to_dec(fa_rows["COST_DISPOSALS"].column_values_json.get("total")) if "COST_DISPOSALS" in fa_rows else ZERO
        c_cost = _to_dec(fa_rows["COST_CLOSING"].column_values_json.get("total"))

        o_dep = _to_dec(fa_rows["ACC_DEP_OPENING"].column_values_json.get("total")) if "ACC_DEP_OPENING" in fa_rows else ZERO
        chg_dep = _to_dec(fa_rows["ACC_DEP_CHARGE"].column_values_json.get("total")) if "ACC_DEP_CHARGE" in fa_rows else ZERO
        disp_dep = _to_dec(fa_rows["ACC_DEP_DISPOSALS"].column_values_json.get("total")) if "ACC_DEP_DISPOSALS" in fa_rows else ZERO
        c_dep = _to_dec(fa_rows["ACC_DEP_CLOSING"].column_values_json.get("total")) if "ACC_DEP_CLOSING" in fa_rows else ZERO
        c_nbv = _to_dec(fa_rows["NBV_CLOSING"].column_values_json.get("total")) if "NBV_CLOSING" in fa_rows else ZERO

        exp_c_cost = o_cost + add_cost - disp_cost
        exp_c_dep = o_dep + chg_dep - disp_dep
        exp_c_nbv = c_cost - c_dep

        if c_cost == exp_c_cost and c_dep == exp_c_dep and c_nbv == exp_c_nbv:
            _add_res(
                f"B09-VAL-04-{fa_tcode}",
                f"Kiểm tra cân đối bảng biến động {fa_tcode}",
                "TABLE_FORMULA_BALANCE",
                "PASSED",
                "INFO",
                f"Bảng {fa_tcode} cân đối Nguyên giá, Hao mòn lũy kế và Giá trị còn lại.",
                tbl=tbl_obj,
                exp=exp_c_nbv,
                act=c_nbv,
            )
        else:
            _add_res(
                f"B09-VAL-04-{fa_tcode}",
                f"Kiểm tra cân đối bảng biến động {fa_tcode}",
                "TABLE_FORMULA_BALANCE",
                "FAILED",
                "ERROR",
                f"Bảng {fa_tcode} lệch công thức biến động TSCĐ/BĐSĐT (Nguyên giá cuối kỳ {_fmt_dec(c_cost)} vs {_fmt_dec(exp_c_cost)}, GTCL {_fmt_dec(c_nbv)} vs {_fmt_dec(exp_c_nbv)}).",
                tbl=tbl_obj,
                exp=exp_c_nbv,
                act=c_nbv,
                details={"error_code": "EF-15"},
            )

    # 3c. V.16.LOANS roll-forward
    v16_rows = rows_by_tcode.get("V.16.LOANS", {})
    if v16_rows and "TOTAL" in v16_rows:
        tot_r = v16_rows["TOTAL"]
        rv = tot_r.column_values_json
        op_v = _to_dec(rv.get("opening_value"))
        inc_v = _to_dec(rv.get("increase_in_period"))
        dec_v = _to_dec(rv.get("decrease_in_period"))
        cl_v = _to_dec(rv.get("closing_value"))
        exp_cl = op_v + inc_v - dec_v
        if cl_v == exp_cl:
            _add_res(
                "B09-VAL-04-V16",
                "Kiểm tra bảng biến động Vay và nợ thuê tài chính (V.16)",
                "TABLE_FORMULA_BALANCE",
                "PASSED",
                "INFO",
                "Bảng V.16 cân đối Đầu kỳ + Tăng - Giảm = Cuối kỳ.",
                tbl=tot_r.note_table,
                exp=exp_cl,
                act=cl_v,
            )
        else:
            _add_res(
                "B09-VAL-04-V16",
                "Kiểm tra bảng biến động Vay và nợ thuê tài chính (V.16)",
                "TABLE_FORMULA_BALANCE",
                "FAILED",
                "ERROR",
                f"Bảng V.16 lệch công thức: Cuối kỳ {_fmt_dec(cl_v)} != Đầu kỳ + Tăng - Giảm ({_fmt_dec(exp_cl)}).",
                tbl=tot_r.note_table,
                exp=exp_cl,
                act=cl_v,
                details={"error_code": "EF-17"},
            )

    # 3d. V.19.TAX roll-forward
    v19_rows = rows_by_tcode.get("V.19.TAX", {})
    if v19_rows and "TOTAL" in v19_rows:
        tot_r = v19_rows["TOTAL"]
        rv = tot_r.column_values_json
        o_net = _to_dec(rv.get("opening_payable")) - _to_dec(rv.get("opening_receivable"))
        p_in = _to_dec(rv.get("payable_in_period"))
        p_paid = _to_dec(rv.get("paid_in_period"))
        c_net = _to_dec(rv.get("closing_payable")) - _to_dec(rv.get("closing_receivable"))
        exp_c_net = o_net + p_in - p_paid
        if c_net == exp_c_net:
            _add_res(
                "B09-VAL-04-V19",
                "Kiểm tra bảng biến động Thuế và các khoản phải nộp Nhà nước (V.19)",
                "TABLE_FORMULA_BALANCE",
                "PASSED",
                "INFO",
                "Bảng V.19 cân đối số thuế đầu kỳ, số phải nộp, số đã nộp và số cuối kỳ.",
                tbl=tot_r.note_table,
                exp=exp_c_net,
                act=c_net,
            )
        else:
            _add_res(
                "B09-VAL-04-V19",
                "Kiểm tra bảng biến động Thuế và các khoản phải nộp Nhà nước (V.19)",
                "TABLE_FORMULA_BALANCE",
                "FAILED",
                "ERROR",
                f"Bảng V.19 lệch công thức thuế: Cuối kỳ thuần {_fmt_dec(c_net)} != {_fmt_dec(exp_c_net)}.",
                tbl=tot_r.note_table,
                exp=exp_c_net,
                act=c_net,
                details={"error_code": "EF-18"},
            )

    # 3e. V.27.MOVEMENT roll-forward
    v27_rows = rows_by_tcode.get("V.27.MOVEMENT", {})
    if v27_rows and "CURR_YEAR_CLOSING" in v27_rows:
        cl_r = v27_rows["CURR_YEAR_CLOSING"]
        o_tot = _to_dec(v27_rows["CURR_YEAR_OPENING"].column_values_json.get("total")) if "CURR_YEAR_OPENING" in v27_rows else ZERO
        inc_tot = _to_dec(v27_rows["CURR_YEAR_CAPITAL_INCREASE"].column_values_json.get("total")) if "CURR_YEAR_CAPITAL_INCREASE" in v27_rows else ZERO
        dec_tot = _to_dec(v27_rows["CURR_YEAR_DIVIDENDS"].column_values_json.get("total")) if "CURR_YEAR_DIVIDENDS" in v27_rows else ZERO
        c_tot = _to_dec(cl_r.column_values_json.get("total"))
        exp_c_tot = o_tot + inc_tot - dec_tot
        if c_tot == exp_c_tot:
            _add_res(
                "B09-VAL-04-V27",
                "Kiểm tra bảng đối chiếu biến động Vốn chủ sở hữu (V.27)",
                "TABLE_FORMULA_BALANCE",
                "PASSED",
                "INFO",
                "Bảng V.27 cân đối biến động Vốn chủ sở hữu đầu kỳ, tăng, giảm, cuối kỳ.",
                tbl=cl_r.note_table,
                exp=exp_c_tot,
                act=c_tot,
            )
        else:
            _add_res(
                "B09-VAL-04-V27",
                "Kiểm tra bảng đối chiếu biến động Vốn chủ sở hữu (V.27)",
                "TABLE_FORMULA_BALANCE",
                "FAILED",
                "ERROR",
                f"Bảng V.27 lệch công thức biến động VCSH: Cuối kỳ {_fmt_dec(c_tot)} != {_fmt_dec(exp_c_tot)}.",
                tbl=cl_r.note_table,
                exp=exp_c_tot,
                act=c_tot,
                details={"error_code": "EF-19"},
            )

    # 4. Cross-Statement Reconciliations (B09-VAL-05 B01, B09-VAL-06 B02, B09-VAL-07 B03)
    linked_runs = _resolve_linked_component_runs(run, bundle=bundle)
    b01_run = linked_runs["FINANCIAL_POSITION"]
    b02_run = linked_runs["BUSINESS_RESULT"]
    b03_run = linked_runs["CASH_FLOW"]

    b01_map = _get_statement_run_indicator_map(b01_run)
    b02_map = _get_statement_run_indicator_map(b02_run)
    b03_map = _get_statement_run_indicator_map(b03_run)

    # 4a. Reconcile with B01 (when B01 run exists and template has Section V)
    if b01_run and legal_code in ("B09-DN", "B09-DNKLT"):
        b01_checks = [
            ("B09-VAL-05-110", "Đối chiếu V.1 (Tiền & TĐT) với B01 Mã 110", "V.1.SUMMARY", "TOTAL", "closing_amount", "110"),
            ("B09-VAL-05-131", "Đối chiếu V.3 (Phải thu KH) với B01 Mã 131", "V.3.CUSTOMERS", "TOTAL", "closing_amount", "131"),
            ("B09-VAL-05-141", "Đối chiếu V.7 (Nguyên giá HTK) với B01 Mã 141", "V.7.INVENTORY", "TOTAL", "closing_cost", "141"),
            ("B09-VAL-05-221", "Đối chiếu V.9 (GTCL TSCĐ hữu hình) với B01 Mã 221", "V.9.TANGIBLE_FA", "NBV_CLOSING", "total", "221"),
            ("B09-VAL-05-311", "Đối chiếu V.17 (Phải trả người bán) với B01 Mã 311", "V.17.SUPPLIERS", "TOTAL", "closing_value", "311"),
            ("B09-VAL-05-410", "Đối chiếu V.27 (Vốn chủ sở hữu) với B01 Mã 410", "V.27.MOVEMENT", "CURR_YEAR_CLOSING", "total", "410"),
        ]
        for chk_code, chk_name, tcode, rcode, col_name, b01_ind in b01_checks:
            t_rows = rows_by_tcode.get(tcode, {})
            b_entry = b01_map.get(b01_ind)
            if rcode in t_rows and b_entry is not None:
                r_obj = t_rows[rcode]
                note_val = _to_dec(r_obj.column_values_json.get(col_name))
                b01_val = b_entry[0]
                if note_val == b01_val:
                    _add_res(
                        chk_code,
                        chk_name,
                        "RECONCILE_B01",
                        "PASSED",
                        "INFO",
                        f"Khớp số liệu giữa {tcode} và B01 Mã {b01_ind} ({_fmt_dec(note_val)}).",
                        tbl=r_obj.note_table,
                        exp=b01_val,
                        act=note_val,
                    )
                else:
                    _add_res(
                        chk_code,
                        chk_name,
                        "RECONCILE_B01",
                        "FAILED",
                        "ERROR",
                        f"Lệch số liệu giữa {tcode} ({_fmt_dec(note_val)}) và B01 Mã {b01_ind} ({_fmt_dec(b01_val)}).",
                        tbl=r_obj.note_table,
                        exp=b01_val,
                        act=note_val,
                        details={"error_code": "EF-14", "b01_indicator": b01_ind},
                    )

    # 4b. Reconcile with B02 (when B02 run exists and template has Section VII)
    if b02_run and legal_code in ("B09-DN", "B09-DNKLT"):
        b02_checks = [
            ("B09-VAL-06-01", "Đối chiếu VII.1 (Doanh thu bán hàng) với B02 Mã 01", "VII.1.REVENUE", "TOTAL", "current_year_amount", "01"),
            ("B09-VAL-06-02", "Đối chiếu VII.2 (Giảm trừ doanh thu) với B02 Mã 02", "VII.2.DEDUCTIONS", "TOTAL", "current_year_amount", "02"),
            ("B09-VAL-06-11", "Đối chiếu VII.3 (Giá vốn hàng bán) với B02 Mã 11", "VII.3.COGS", "TOTAL", "current_year_amount", "11"),
            ("B09-VAL-06-51", "Đối chiếu VII.11 (Chi phí thuế TNDN hiện hành) với B02 Mã 51", "VII.11.CIT", "current_tax_expense", "current_year_amount", "51"),
            ("B09-VAL-06-52", "Đối chiếu VII.11 (Chi phí thuế TNDN hoãn lại) với B02 Mã 52", "VII.11.CIT", "deferred_tax_expense", "current_year_amount", "52"),
        ]
        for chk_code, chk_name, tcode, rcode, col_name, b02_ind in b02_checks:
            t_rows = rows_by_tcode.get(tcode, {})
            b_entry = b02_map.get(b02_ind)
            if rcode in t_rows and b_entry is not None:
                r_obj = t_rows[rcode]
                note_val = _to_dec(r_obj.column_values_json.get(col_name))
                b02_val = b_entry[0]
                if note_val == b02_val:
                    _add_res(
                        chk_code,
                        chk_name,
                        "RECONCILE_B02",
                        "PASSED",
                        "INFO",
                        f"Khớp số liệu giữa {tcode} và B02 Mã {b02_ind} ({_fmt_dec(note_val)}).",
                        tbl=r_obj.note_table,
                        exp=b02_val,
                        act=note_val,
                    )
                else:
                    _add_res(
                        chk_code,
                        chk_name,
                        "RECONCILE_B02",
                        "FAILED",
                        "ERROR",
                        f"Lệch số liệu giữa {tcode} ({_fmt_dec(note_val)}) và B02 Mã {b02_ind} ({_fmt_dec(b02_val)}).",
                        tbl=r_obj.note_table,
                        exp=b02_val,
                        act=note_val,
                        details={"error_code": "EF-20", "b02_indicator": b02_ind},
                    )

    # 4c. Reconcile with B03 (when B03 run exists and template has Section V / VIII)
    if b03_run and legal_code in ("B09-DN", "B09-DNKLT"):
        b03_checks = [
            ("B09-VAL-07-70", "Đối chiếu V.1 (Tiền & TĐT cuối kỳ) với B03 Mã 70", "V.1.SUMMARY", "TOTAL", "closing_amount", "70", False),
            ("B09-VAL-07-33", "Đối chiếu VIII.3 (Tiền đi vay thực thu) với B03 Mã 33", "VIII.3.BORROWINGS_RECEIVED", "TOTAL", "amount", "33", True),
            ("B09-VAL-07-34", "Đối chiếu VIII.4 (Tiền thực trả gốc vay) với B03 Mã 34", "VIII.4.PRINCIPAL_REPAID", "TOTAL", "amount", "34", True),
        ]
        for chk_code, chk_name, tcode, rcode, col_name, b03_ind, use_abs in b03_checks:
            t_rows = rows_by_tcode.get(tcode, {})
            b_entry = b03_map.get(b03_ind)
            if rcode in t_rows and b_entry is not None:
                r_obj = t_rows[rcode]
                note_val = _to_dec(r_obj.column_values_json.get(col_name))
                b03_val = abs(b_entry[0]) if use_abs else b_entry[0]
                if note_val == b03_val:
                    _add_res(
                        chk_code,
                        chk_name,
                        "RECONCILE_B03",
                        "PASSED",
                        "INFO",
                        f"Khớp số liệu giữa {tcode} và B03 Mã {b03_ind} ({_fmt_dec(note_val)}).",
                        tbl=r_obj.note_table,
                        exp=b03_val,
                        act=note_val,
                    )
                else:
                    _add_res(
                        chk_code,
                        chk_name,
                        "RECONCILE_B03",
                        "FAILED",
                        "ERROR",
                        f"Lệch số liệu giữa {tcode} ({_fmt_dec(note_val)}) và B03 Mã {b03_ind} ({_fmt_dec(b03_val)}).",
                        tbl=r_obj.note_table,
                        exp=b03_val,
                        act=note_val,
                        details={"error_code": "EF-22", "b03_indicator": b03_ind},
                    )

    # 5. Staleness check (`EF-28`)
    stale = is_b09_run_stale(run)
    if stale:
        _add_res(
            "B09-VAL-08-STALE",
            "Kiểm tra tính thời sự của Snapshot dữ liệu nguồn (STALE check)",
            "SUBLEDGER_RECONCILIATION",
            "WARNING",
            "WARNING",
            "Phát sinh bút toán Sổ cái hoặc thay đổi B01/B02/B03 sau thời điểm lập Thuyết minh BCTC (STALE).",
            details={"is_stale": True, "error_code": "EF-28"},
        )
    else:
        _add_res(
            "B09-VAL-08-STALE",
            "Kiểm tra tính thời sự của Snapshot dữ liệu nguồn (STALE check)",
            "SUBLEDGER_RECONCILIATION",
            "PASSED",
            "INFO",
            "Dữ liệu Thuyết minh BCTC đồng bộ với Snapshot Sổ cái hiện hành.",
            details={"is_stale": False},
        )

    errors_cnt = sum(1 for r in results if r.validation_status == "FAILED")
    warnings_cnt = sum(1 for r in results if r.validation_status == "WARNING")
    passed_cnt = sum(1 for r in results if r.validation_status == "PASSED")

    return {
        "run_id": run.id,
        "overall_status": "FAILED" if errors_cnt > 0 else ("WARNING" if warnings_cnt > 0 else "PASSED"),
        "passed_count": passed_cnt,
        "warning_count": warnings_cnt,
        "error_count": errors_cnt,
        "blocking_approval": errors_cnt > 0 or len(missing_required_notes) > 0 or stale,
        "missing_required_notes": missing_required_notes,
        "is_stale": stale,
        "results": [
            {
                "id": r.id,
                "check_code": r.check_code,
                "check_name": r.check_name,
                "validation_type": r.validation_type,
                "validation_status": r.validation_status,
                "severity": r.severity,
                "expected_value": _fmt_dec(r.expected_value),
                "actual_value": _fmt_dec(r.actual_value),
                "difference_value": _fmt_dec(r.difference_value),
                "message": r.message,
                "section_code": r.note_section.section_code if r.note_section else None,
                "note_code": r.note_item.note_code if r.note_item else None,
                "table_code": r.note_table.table_code if r.note_table else None,
                "details": r.details_json,
            }
            for r in results
        ],
    }


# ============================================================================
# PART 4: API PAYLOAD HANDLERS (`6. API đề xuất` - 18+ ENDPOINTS)
# ============================================================================

PERM_B09_VIEW = "RPT_FINANCIAL_NOTES_VIEW"
PERM_B09_DETAIL_VIEW = "RPT_FINANCIAL_NOTES_DETAIL_VIEW"
PERM_B09_PREPARE = "RPT_FINANCIAL_NOTES_PREPARE"
PERM_B09_REVIEW = "RPT_FINANCIAL_NOTES_REVIEW"
PERM_B09_APPROVE = "RPT_FINANCIAL_NOTES_APPROVE"
PERM_B09_EXPORT = "RPT_FINANCIAL_NOTES_EXPORT"


def resolve_b09_company_and_scope(user: Any, params: dict[str, Any]) -> tuple[Company, Branch | None, str]:
    """Resolves Company, optional Branch, and reporting_scope (`COMPANY` or `BRANCH`) with full RBAC & Data Scope checks."""
    class _DummyReq:
        def __init__(self, u, p):
            self.user = u
            self.data = p
    company = resolve_b09_company(_DummyReq(user, params), params.get("company_id") or params.get("company"))
    branch_id = params.get("branch_id") or params.get("branch")
    scope = str(params.get("reporting_scope") or ("BRANCH" if branch_id else "COMPANY")).upper()
    branch = None
    if branch_id:
        branch = Branch.objects.filter(id=branch_id, company=company).first()
        if not branch:
            raise ValidationError({"error_code": "EF-03", "detail": "Chi nhánh không tồn tại hoặc không thuộc công ty đang chọn."})
    if scope == "BRANCH" and not branch:
        raise ValidationError({"error_code": "EF-03", "detail": "Phạm vi báo cáo theo chi nhánh (BRANCH) yêu cầu chọn branch_id hợp lệ."})
    check_b09_scope_access(user, company, scope, branch)
    return company, branch, scope


def _get_run_going_concern(run: FinancialStatementRun) -> str:
    meta = run.eps_metadata_json or {}
    if meta.get("going_concern_status"):
        return str(meta["going_concern_status"])
    return "NON_GOING_CONCERN" if run.template.legal_form_code == "B09-DNKLT" else "GOING_CONCERN"


def _get_run_no(run: FinancialStatementRun) -> str:
    meta = run.eps_metadata_json or {}
    if meta.get("run_no"):
        return str(meta["run_no"])
    return f"{run.template.legal_form_code}-{run.fiscal_year}-V{run.run_version}"


def _get_parent_run_id(run: FinancialStatementRun) -> str | None:
    meta = run.eps_metadata_json or {}
    return meta.get("parent_run_id")


def _ensure_run_populated(run: FinancialStatementRun) -> None:
    """If a B09 run was created earlier without `note_contents`, populate it automatically."""
    ensure_b09_templates_seeded()
    if run.note_contents.count() == 0 and run.run_status != FinancialStatementRun.Status.APPROVED:
        calculate_financial_notes_run(run, preserve_existing_manual=True)
    if run.note_validation_results.count() == 0:
        validate_financial_notes_run(run)


def get_b09_templates_payload(user: Any, query_params: dict[str, Any]) -> dict[str, Any]:
    company, _, _ = resolve_b09_company_and_scope(user, query_params)
    require_b09_permission(user, company, PERM_B09_VIEW)
    ensure_b09_templates_seeded()
    qs = FinancialStatementTemplate.objects.filter(
        component_type="FINANCIAL_NOTES",
        is_active=True,
    ).prefetch_related("versions").order_by("internal_code")

    period_type = (query_params.get("period_type") or "").strip().upper()
    going_concern = (query_params.get("going_concern_status") or "").strip().upper()

    templates_data = []
    for tmpl in qs:
        active_ver = tmpl.versions.filter(is_active=True).order_by("-version_number", "-effective_from").first()
        sections_cnt = active_ver.note_sections.count() if active_ver else 0
        items_cnt = FinancialNoteItem.objects.filter(section__template_version=active_ver).count() if active_ver else 0
        is_recommended = False
        if period_type in ("QUARTER", "INTERIM", "SIX_MONTH"):
            is_recommended = tmpl.legal_form_code == "B09a-DN"
        elif going_concern == "NON_GOING_CONCERN":
            is_recommended = tmpl.legal_form_code == "B09-DNKLT"
        else:
            is_recommended = tmpl.legal_form_code == "B09-DN"

        templates_data.append({
            "id": str(tmpl.id),
            "internal_code": tmpl.internal_code,
            "template_code": tmpl.legal_form_code,
            "template_name": tmpl.name,
            "legal_form_code": tmpl.legal_form_code,
            "component_type": tmpl.component_type,
            "applicable_bundle_types": tmpl.applicable_bundle_types,
            "period_granularity": tmpl.period_granularity,
            "is_recommended": is_recommended,
            "active_version_id": str(active_ver.id) if active_ver else None,
            "active_version_no": f"v{active_ver.version_number}" if active_ver else None,
            "section_count": sections_cnt,
            "item_count": items_cnt,
        })
    return {"templates": templates_data}


def get_b09_template_versions_payload(user: Any, template_id: Any, query_params: dict[str, Any] | None = None) -> dict[str, Any]:
    company, _, _ = resolve_b09_company_and_scope(user, query_params or {})
    require_b09_permission(user, company, PERM_B09_VIEW)
    ensure_b09_templates_seeded()
    tmpl = FinancialStatementTemplate.objects.filter(
        Q(id=template_id) if len(str(template_id)) > 20 else (Q(internal_code=str(template_id)) | Q(legal_form_code=str(template_id))),
        component_type="FINANCIAL_NOTES",
    ).first()
    if not tmpl:
        raise ValidationError({"error_code": "EF-03", "detail": "Không tìm thấy mẫu Thuyết minh BCTC."})

    versions_list = []
    for ver in tmpl.versions.all().order_by("-version_number", "-effective_from"):
        secs = list(ver.note_sections.all().order_by("display_order"))
        versions_list.append({
            "id": str(ver.id),
            "version_number": ver.version_number,
            "version_no": f"v{ver.version_number}",
            "accounting_regime": ver.accounting_regime,
            "legal_circular": ver.legal_circular,
            "effective_from": ver.effective_from.isoformat(),
            "effective_to": ver.effective_to.isoformat() if ver.effective_to else None,
            "version_status": "ACTIVE" if ver.is_active else "RETIRED",
            "section_codes": [s.section_code for s in secs],
            "section_count": len(secs),
        })
    return {
        "template_id": str(tmpl.id),
        "internal_code": tmpl.internal_code,
        "legal_form_code": tmpl.legal_form_code,
        "template_name": tmpl.name,
        "versions": versions_list,
    }


@transaction.atomic
def list_or_create_b09_runs_payload(
    user: Any,
    method: str,
    query_params: dict[str, Any],
    body_data: dict[str, Any],
) -> tuple[dict[str, Any], int]:
    ensure_b09_templates_seeded()
    if method == "GET":
        company, branch, scope = resolve_b09_company_and_scope(user, query_params)
        require_b09_permission(user, company, PERM_B09_VIEW)
        qs = FinancialStatementRun.objects.filter(
            company=company,
            template__component_type="FINANCIAL_NOTES",
        ).select_related("template", "template_version", "fiscal_period", "branch").order_by("-run_version", "-created_at")

        if scope == "BRANCH" and branch is not None:
            qs = qs.filter(branch=branch, reporting_scope="BRANCH")
        elif query_params.get("reporting_scope") == "COMPANY":
            qs = qs.filter(reporting_scope="COMPANY")

        fy = query_params.get("fiscal_year")
        if fy not in (None, ""):
            qs = qs.filter(fiscal_year=int(fy))

        pid = query_params.get("fiscal_period_id") or query_params.get("accounting_period_id") or query_params.get("period_id")
        if pid not in (None, ""):
            qs = qs.filter(fiscal_period_id=pid)

        lcode = (query_params.get("legal_form_code") or query_params.get("template_code") or "").strip()
        if lcode:
            qs = qs.filter(Q(template__legal_form_code=lcode) | Q(template__internal_code=lcode))

        runs_out = []
        for r in qs[:50]:
            runs_out.append({
                "id": str(r.id),
                "run_no": _get_run_no(r),
                "version_no": r.run_version,
                "run_version": r.run_version,
                "run_status": r.run_status,
                "validation_status": r.validation_status,
                "is_stale": is_b09_run_stale(r),
                "legal_form_code": r.template.legal_form_code,
                "template_name": r.template.name,
                "template_version_no": f"v{r.template_version.version_number}",
                "fiscal_year": r.fiscal_year,
                "fiscal_period_id": str(r.fiscal_period_id),
                "period_type": r.period_type,
                "period_start_date": r.period_start_date.isoformat(),
                "period_end_date": r.period_end_date.isoformat(),
                "reporting_scope": r.reporting_scope,
                "branch_id": str(r.branch_id) if r.branch_id else None,
                "going_concern_status": _get_run_going_concern(r),
                "source_snapshot_hash": r.source_snapshot_hash,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })
        return {"runs": runs_out}, 200

    # POST: Create / Generate a new B09 Statement Run
    company, branch, scope = resolve_b09_company_and_scope(user, body_data)
    require_b09_permission(user, company, PERM_B09_PREPARE)

    # Resolve period
    period_id = body_data.get("fiscal_period_id") or body_data.get("accounting_period_id") or body_data.get("period_id")
    period_obj = None
    if period_id not in (None, ""):
        period_obj = AccountingPeriod.objects.filter(id=period_id, company=company).first()
        if not period_obj:
            raise ValidationError({"error_code": "EF-02", "detail": "Kỳ kế toán không thuộc công ty đang chọn."})

    fiscal_year = int(body_data.get("fiscal_year") or (period_obj.fiscal_year if period_obj else date.today().year))
    if not period_obj:
        period_obj = AccountingPeriod.objects.filter(company=company, fiscal_year=fiscal_year).order_by("-end_date").first()
    if not period_obj:
        raise ValidationError({"error_code": "EF-02", "detail": "Không tìm thấy kỳ kế toán hợp lệ cho doanh nghiệp."})

    raw_pt = str(body_data.get("period_type") or "ANNUAL").upper()
    going_concern = str(body_data.get("going_concern_status") or "GOING_CONCERN").upper()

    if body_data.get("period_start_date") and body_data.get("period_end_date"):
        start_d = date.fromisoformat(str(body_data["period_start_date"]))
        end_d = date.fromisoformat(str(body_data["period_end_date"]))
    else:
        if raw_pt in ("ANNUAL", "YEAR"):
            fy_ps = list(AccountingPeriod.objects.filter(company=company, fiscal_year=fiscal_year).order_by("start_date"))
            start_d = min((p.start_date for p in fy_ps), default=period_obj.start_date)
            end_d = max((p.end_date for p in fy_ps), default=period_obj.end_date)
        else:
            start_d = period_obj.start_date
            end_d = period_obj.end_date

    if start_d > end_d:
        raise ValidationError({"error_code": "EF-02", "detail": "Ngày bắt đầu kỳ báo cáo không được lớn hơn ngày kết thúc."})

    # Determine template
    req_tmpl_code = (body_data.get("legal_form_code") or body_data.get("template_code") or "").strip()
    tmpl_id = body_data.get("template_id")
    if tmpl_id:
        tmpl = FinancialStatementTemplate.objects.filter(id=tmpl_id, component_type="FINANCIAL_NOTES").first()
    elif req_tmpl_code:
        tmpl = FinancialStatementTemplate.objects.filter(
            Q(legal_form_code=req_tmpl_code) | Q(internal_code=req_tmpl_code),
            component_type="FINANCIAL_NOTES",
        ).first()
    else:
        if raw_pt in ("QUARTER", "INTERIM", "SIX_MONTH"):
            default_lcode = "B09a-DN"
        elif going_concern == "NON_GOING_CONCERN":
            default_lcode = "B09-DNKLT"
        else:
            default_lcode = "B09-DN"
        tmpl = FinancialStatementTemplate.objects.filter(legal_form_code=default_lcode, component_type="FINANCIAL_NOTES").first()

    if not tmpl:
        raise ValidationError({"error_code": "EF-03", "detail": "Không tìm thấy mẫu Thuyết minh BCTC phù hợp."})

    # Validate template vs period_type & going_concern_status (EF-03, TC-RPT-06-02, 03, 04)
    if going_concern == "NON_GOING_CONCERN" and tmpl.legal_form_code == "B09-DN":
        raise ValidationError({
            "error_code": "EF-03",
            "detail": "Doanh nghiệp không đáp ứng giả định hoạt động liên tục phải áp dụng mẫu B09-DNKLT (không dùng B09-DN).",
        })
    if going_concern == "GOING_CONCERN" and tmpl.legal_form_code == "B09-DNKLT":
        raise ValidationError({
            "error_code": "EF-03",
            "detail": "Doanh nghiệp đang hoạt động liên tục không được chọn mẫu B09-DNKLT.",
        })
    if raw_pt in ("ANNUAL", "YEAR") and tmpl.legal_form_code == "B09a-DN" and body_data.get("period_type"):
        raise ValidationError({
            "error_code": "EF-03",
            "detail": "Kỳ báo cáo năm (ANNUAL) phải áp dụng mẫu B09-DN hoặc B09-DNKLT, không áp dụng B09a-DN chọn lọc giữa niên độ.",
        })
    if raw_pt in ("QUARTER", "INTERIM", "SIX_MONTH") and tmpl.legal_form_code in ("B09-DN", "B09-DNKLT") and req_tmpl_code:
        raise ValidationError({
            "error_code": "EF-03",
            "detail": "Báo cáo tài chính giữa niên độ phải áp dụng mẫu B09a-DN.",
        })

    ver = tmpl.versions.filter(is_active=True).order_by("-version_number", "-effective_from").first()
    if not ver:
        raise ValidationError({"error_code": "EF-03", "detail": "Mẫu Thuyết minh BCTC chưa có phiên bản ACTIVE."})
    if end_d < ver.effective_from and not body_data.get("allow_historical_preview"):
        raise ValidationError({
            "error_code": "EF-03",
            "detail": f"Phiên bản mẫu {tmpl.legal_form_code} chỉ có hiệu lực từ {ver.effective_from.isoformat()}.",
        })

    # Next run_version
    prev_run = (
        FinancialStatementRun.objects.filter(
            company=company,
            template=tmpl,
            fiscal_year=fiscal_year,
            period_start_date=start_d,
            period_end_date=end_d,
            reporting_scope=scope,
            branch=branch if scope == "BRANCH" else None,
        )
        .order_by("-run_version", "-created_at")
        .first()
    )
    next_ver_no = (prev_run.run_version + 1) if prev_run else 1
    run_no = f"{tmpl.legal_form_code}-{fiscal_year}-V{next_ver_no}"

    comp_period = None
    if body_data.get("comparison_period_id"):
        comp_period = AccountingPeriod.objects.filter(id=body_data["comparison_period_id"], company=company).first()
    if not comp_period:
        comp_period = AccountingPeriod.objects.filter(company=company, fiscal_year=fiscal_year - 1).order_by("-end_date").first()

    iam_acc = _resolve_iam_account(user)
    norm_pt = "QUARTER" if raw_pt in ("QUARTER", "INTERIM", "SIX_MONTH") else "YEAR"

    new_run = FinancialStatementRun.objects.create(
        company=company,
        branch=branch if scope == "BRANCH" else None,
        reporting_scope=scope,
        template=tmpl,
        template_version=ver,
        fiscal_period=period_obj,
        fiscal_year=fiscal_year,
        period_type=norm_pt,
        as_of_date=end_d,
        period_start_date=start_d,
        period_end_date=end_d,
        comparison_period=comp_period,
        comparison_as_of_date=comp_period.end_date if comp_period else date(start_d.year - 1, 12, 31),
        comparison_start_date=comp_period.start_date if comp_period else date(start_d.year - 1, 1, 1),
        comparison_end_date=comp_period.end_date if comp_period else date(start_d.year - 1, 12, 31),
        reporting_currency=company.accounting_currency,
        run_version=next_ver_no,
        run_status=FinancialStatementRun.Status.GENERATED,
        eps_metadata_json={
            "run_no": run_no,
            "going_concern_status": going_concern,
            "parent_run_id": str(prev_run.id) if prev_run else None,
        },
        created_by=iam_acc,
    )

    manual_notes = body_data.get("manual_notes") if isinstance(body_data.get("manual_notes"), dict) else None
    calculate_financial_notes_run(new_run, manual_notes_payload=manual_notes, preserve_existing_manual=False)
    val_summary = validate_financial_notes_run(new_run)

    header = get_b09_run_header_payload(user, new_run.id)
    header["validation_summary"] = val_summary
    return header, 201


def _get_b09_run_checked(user: Any, run_id: Any, perm: str = PERM_B09_VIEW) -> FinancialStatementRun:
    try:
        run = (
            FinancialStatementRun.objects.filter(
                id=run_id,
                template__component_type="FINANCIAL_NOTES",
            )
            .select_related("company", "branch", "template", "template_version", "fiscal_period", "comparison_period", "reporting_currency")
            .first()
        )
    except Exception:
        run = None
    if not run:
        raise ValidationError({"error_code": "EF-04", "detail": "Không tìm thấy phiên bản Thuyết minh BCTC (Statement Run)."})

    # Enforce Company & Branch tenant isolation + RBAC (BR-RPT-B09-92, EF-01, TC-RPT-06-05, 76)
    require_b09_permission(user, run.company, perm)
    check_b09_scope_access(user, run.company, run.reporting_scope, run.branch)
    _ensure_run_populated(run)
    return run


def get_b09_run_header_payload(user: Any, run_id: Any) -> dict[str, Any]:
    run = _get_b09_run_checked(user, run_id, PERM_B09_VIEW)
    linked = _resolve_linked_component_runs(run)
    stale = is_b09_run_stale(run)
    completeness = get_b09_completeness_payload(user, run.id, _run_obj=run)
    val_qs = run.note_validation_results.all()
    err_cnt = val_qs.filter(status="FAILED").count()
    warn_cnt = val_qs.filter(status="WARNING").count()
    pass_cnt = val_qs.filter(status="PASSED").count()

    return {
        "id": str(run.id),
        "run_no": _get_run_no(run),
        "version_no": run.run_version,
        "run_version": run.run_version,
        "parent_run_id": _get_parent_run_id(run),
        "run_status": run.run_status,
        "validation_status": run.validation_status,
        "is_stale": stale,
        "company_id": str(run.company_id),
        "company_name": run.company.name,
        "company_tax_code": run.company.tax_code,
        "reporting_scope": run.reporting_scope,
        "branch_id": str(run.branch_id) if run.branch_id else None,
        "branch_name": run.branch.name if run.branch else "Toàn doanh nghiệp",
        "template_id": str(run.template_id),
        "internal_code": run.template.internal_code,
        "template_code": run.template.legal_form_code,
        "legal_form_code": run.template.legal_form_code,
        "template_name": run.template.name,
        "template_version_id": str(run.template_version_id),
        "template_version_no": f"v{run.template_version.version_number}",
        "accounting_regime": run.template_version.accounting_regime,
        "legal_circular": run.template_version.legal_circular,
        "fiscal_year": run.fiscal_year,
        "period_type": run.period_type,
        "fiscal_period_id": str(run.fiscal_period_id),
        "accounting_period_id": str(run.fiscal_period_id),
        "period_start_date": run.period_start_date.isoformat(),
        "period_end_date": run.period_end_date.isoformat(),
        "comparison_period_id": str(run.comparison_period_id) if run.comparison_period_id else None,
        "reporting_currency": run.reporting_currency.code if run.reporting_currency else "VND",
        "going_concern_status": _get_run_going_concern(run),
        "source_snapshot_hash": run.source_snapshot_hash,
        "source_last_posted_at": run.source_last_posted_at.isoformat() if run.source_last_posted_at else None,
        "linked_runs": {
            "B01_run_id": str(linked["FINANCIAL_POSITION"].id) if linked["FINANCIAL_POSITION"] else None,
            "B02_run_id": str(linked["BUSINESS_RESULT"].id) if linked["BUSINESS_RESULT"] else None,
            "B03_run_id": str(linked["CASH_FLOW"].id) if linked["CASH_FLOW"] else None,
        },
        "completeness_summary": {
            "total_items": completeness["total_items"],
            "completed_count": completeness["completed_count"],
            "auto_populated_count": completeness["auto_populated_count"],
            "manual_required_count": completeness["manual_required_count"],
            "review_required_count": completeness["review_required_count"],
            "not_applicable_count": completeness["not_applicable_count"],
            "completion_percentage": completeness["completion_percentage"],
        },
        "validation_counts": {
            "passed": pass_cnt,
            "warnings": warn_cnt,
            "errors": err_cnt,
        },
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "approved_at": run.approved_at.isoformat() if run.approved_at else None,
    }


def get_b09_run_sections_payload(user: Any, run_id: Any) -> dict[str, Any]:
    run = _get_b09_run_checked(user, run_id, PERM_B09_VIEW)
    tv = run.template_version
    sections = list(tv.note_sections.prefetch_related("items").order_by("display_order", "section_code"))
    contents_map = {
        c.note_item_id: c
        for c in run.note_contents.all()
    }

    sections_out = []
    for sec in sections:
        sec_items = list(sec.items.all().order_by("display_order", "note_code"))
        status_counts: dict[str, int] = {}
        items_brief = []
        for itm in sec_items:
            c_obj = contents_map.get(itm.id)
            st = c_obj.content_status if c_obj else "NOT_STARTED"
            status_counts[st] = status_counts.get(st, 0) + 1
            items_brief.append({
                "note_code": itm.note_code,
                "note_title": itm.note_title,
                "note_type": itm.note_type,
                "data_origin": itm.data_origin,
                "is_required_by_default": itm.is_required_by_default,
                "content_status": st,
                "is_applicable": c_obj.is_applicable if c_obj else True,
                "related_report_code": itm.related_report_code,
                "related_indicator_codes": itm.related_indicator_codes,
            })
        sections_out.append({
            "id": str(sec.id),
            "section_code": sec.section_code,
            "section_name": sec.section_name,
            "section_level": sec.section_level,
            "display_order": sec.display_order,
            "is_required": sec.is_required,
            "applicable_to_interim": sec.applicable_to_interim,
            "applicable_to_non_going_concern": sec.applicable_to_non_going_concern,
            "item_count": len(sec_items),
            "status_counts": status_counts,
            "items": items_brief,
        })

    return {
        "run_id": str(run.id),
        "legal_form_code": run.template.legal_form_code,
        "section_codes": [s["section_code"] for s in sections_out],
        "sections": sections_out,
    }


def _serialize_note_item_full(
    run: FinancialStatementRun,
    item: FinancialNoteItem,
    c_obj: FinancialNoteContent | None,
    tables_by_item: dict[Any, list[FinancialNoteTable]],
    rows_by_table: dict[Any, list[FinancialNoteTableRow]],
    refs_by_item: dict[Any, list[FinancialNoteReference]],
    vals_by_item: dict[Any, list[FinancialNoteValidationResult]],
) -> dict[str, Any]:
    item_tables = tables_by_item.get(item.id, [])
    tables_out = []
    for tbl in item_tables:
        t_rows = rows_by_table.get(tbl.id, [])
        tables_out.append({
            "id": str(tbl.id),
            "table_code": tbl.table_code,
            "table_title": tbl.table_title,
            "table_schema_json": tbl.table_schema_json,
            "row_schema_json": tbl.row_schema_json,
            "calculation_policy_json": tbl.calculation_policy_json,
            "display_order": tbl.display_order,
            "rows": [
                {
                    "id": str(r.id),
                    "row_code": r.row_code,
                    "row_label": r.row_label,
                    "row_level": r.row_level,
                    "display_order": r.display_order,
                    "is_total_row": r.is_total_row,
                    "column_values": r.column_values_json,
                    "drilldown_reference": r.drilldown_reference_json,
                    "validation_flags": r.validation_flags_json,
                }
                for r in t_rows
            ],
        })

    item_refs = refs_by_item.get(item.id, [])
    item_vals = vals_by_item.get(item.id, [])

    return {
        "id": str(item.id),
        "section_code": item.note_section.section_code,
        "note_code": item.note_code,
        "note_title": item.note_title,
        "note_type": item.note_type,
        "data_origin": item.data_origin,
        "is_required_by_default": item.is_required_by_default,
        "allow_not_applicable": item.allow_not_applicable,
        "related_report_code": item.related_report_code,
        "related_indicator_codes": item.related_indicator_codes,
        "content_schema": item.content_schema_json,
        "content": {
            "id": str(c_obj.id) if c_obj else None,
            "content_version": c_obj.content_version if c_obj else 1,
            "text_content": c_obj.text_content if c_obj else "",
            "structured_content": c_obj.structured_content_json if c_obj else {},
            "content_status": c_obj.content_status if c_obj else "NOT_STARTED",
            "is_applicable": c_obj.is_applicable if c_obj else True,
            "not_applicable_reason": c_obj.not_applicable_reason if c_obj else None,
            "applicability_evidence": c_obj.applicability_evidence if c_obj else "",
            "source_snapshot_reference": c_obj.source_snapshot_reference if c_obj else run.source_snapshot_hash,
        },
        "tables": tables_out,
        "references": [
            {
                "id": str(ref.id),
                "reference_type": ref.reference_type,
                "mapping_rule_code": ref.mapping_rule_code,
                "source_statement_run_id": str(ref.source_statement_run_id) if ref.source_statement_run_id else None,
                "source_reference": ref.source_reference_json,
            }
            for ref in item_refs
        ],
        "validations": [
            {
                "check_code": v.check_code,
                "validation_status": v.validation_status,
                "severity": v.severity,
                "message": v.message,
            }
            for v in item_vals
        ],
    }


def get_b09_section_detail_payload(user: Any, run_id: Any, section_code: str) -> dict[str, Any]:
    run = _get_b09_run_checked(user, run_id, PERM_B09_VIEW)
    sec = run.template_version.note_sections.filter(section_code=section_code).first()
    if not sec:
        raise ValidationError({
            "error_code": "EF-05",
            "detail": f"Phần thuyết minh '{section_code}' không tồn tại trong mẫu {run.template.legal_form_code}.",
        })

    sec_items = list(sec.items.select_related("section").order_by("display_order", "note_code"))
    item_ids = [i.id for i in sec_items]

    contents_map = {
        c.note_item_id: c
        for c in run.note_contents.filter(note_item_id__in=item_ids)
    }
    tables_by_item: dict[Any, list[FinancialNoteTable]] = {}
    all_tables = list(FinancialNoteTable.objects.filter(note_item_id__in=item_ids).order_by("display_order"))
    table_ids = [t.id for t in all_tables]
    for t in all_tables:
        tables_by_item.setdefault(t.note_item_id, []).append(t)

    rows_by_table: dict[Any, list[FinancialNoteTableRow]] = {}
    for r in run.note_table_rows.filter(table_id__in=table_ids).order_by("display_order", "id"):
        rows_by_table.setdefault(r.table_id, []).append(r)

    refs_by_item: dict[Any, list[FinancialNoteReference]] = {}
    for ref in run.note_references.filter(note_item_id__in=item_ids):
        refs_by_item.setdefault(ref.note_item_id, []).append(ref)

    vals_by_item: dict[Any, list[FinancialNoteValidationResult]] = {}
    for val in run.note_validation_results.filter(note_item_id__in=item_ids):
        if val.note_item_id:
            vals_by_item.setdefault(val.note_item_id, []).append(val)

    return {
        "run_id": str(run.id),
        "section_code": sec.section_code,
        "section_name": sec.section_name,
        "display_order": sec.display_order,
        "is_required": sec.is_required,
        "items": [
            _serialize_note_item_full(
                run=run,
                item=itm,
                c_obj=contents_map.get(itm.id),
                tables_by_item=tables_by_item,
                rows_by_table=rows_by_table,
                refs_by_item=refs_by_item,
                vals_by_item=vals_by_item,
            )
            for itm in sec_items
        ],
    }


@transaction.atomic
def get_or_update_b09_item_payload(
    user: Any,
    run_id: Any,
    note_code: str,
    method: str = "GET",
    body_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    perm = PERM_B09_VIEW if method == "GET" else PERM_B09_PREPARE
    run = _get_b09_run_checked(user, run_id, perm)
    item = (
        FinancialNoteItem.objects.filter(
            section__template_version=run.template_version,
            note_code=note_code,
        )
        .select_related("section")
        .first()
    )
    if not item:
        raise ValidationError({
            "error_code": "EF-05",
            "detail": f"Mục thuyết minh '{note_code}' không tồn tại trong mẫu {run.template.legal_form_code}.",
        })

    if method in ("PUT", "PATCH", "POST"):
        if run.run_status == FinancialStatementRun.Status.APPROVED:
            raise ValidationError({
                "error_code": "EF-29",
                "detail": "Báo cáo Thuyết minh BCTC đã được phê duyệt (APPROVED), không được sửa trực tiếp.",
            })
        payload = body_data or {}
        c_obj = run.note_contents.filter(note_item=item).first()
        if not c_obj:
            c_obj = FinancialNoteContent.objects.create(
                statement_run=run,
                note_item=item,
                data_origin=item.data_origin,
                source_snapshot_reference=run.source_snapshot_hash,
            )

        if "is_applicable" in payload:
            c_obj.is_applicable = bool(payload["is_applicable"])
        if "not_applicable_reason" in payload:
            clean_na, _ = sanitize_note_text(str(payload.get("not_applicable_reason") or ""))
            c_obj.not_applicable_reason = clean_na.strip() or None
        if "applicability_evidence" in payload:
            clean_ev, _ = sanitize_note_text(str(payload.get("applicability_evidence") or ""))
            c_obj.applicability_evidence = clean_ev.strip()

        if not c_obj.is_applicable and not c_obj.not_applicable_reason:
            raise ValidationError({
                "error_code": "EF-10",
                "detail": f"Khi đánh dấu mục '{note_code}' là Không áp dụng (NOT_APPLICABLE), bắt buộc phải nhập lý do giải trình (not_applicable_reason).",
            })

        if "text_content" in payload:
            clean_txt, had_xss = sanitize_note_text(str(payload.get("text_content") or ""))
            c_obj.text_content = clean_txt
            if had_xss:
                st_j = dict(c_obj.structured_content_json or {})
                st_j["unsafe_html_sanitized"] = True
                c_obj.structured_content_json = st_j

        if "structured_content_json" in payload or "structured_content" in payload:
            raw_struct = payload.get("structured_content_json") or payload.get("structured_content") or {}
            if isinstance(raw_struct, dict):
                merged = dict(c_obj.structured_content_json or {})
                for k_s, v_s in raw_struct.items():
                    if isinstance(v_s, str):
                        v_s, _ = sanitize_note_text(v_s)
                    merged[k_s] = v_s
                merged["is_manual_override"] = True
                c_obj.structured_content_json = merged

        if "content_status" in payload:
            c_obj.content_status = str(payload["content_status"])
        else:
            if not c_obj.is_applicable and c_obj.not_applicable_reason:
                c_obj.content_status = "NOT_APPLICABLE"
            else:
                c_obj.content_status = "COMPLETED"

        c_obj.content_version = (c_obj.content_version or 1) + 1
        c_obj.save()

        # Optional custom table rows update
        if isinstance(payload.get("tables"), dict) or isinstance(payload.get("table_rows"), list):
            for tbl in item.tables.all():
                custom_rows = (
                    payload["tables"].get(tbl.table_code)
                    if isinstance(payload.get("tables"), dict)
                    else payload.get("table_rows")
                )
                if isinstance(custom_rows, list):
                    FinancialNoteTableRow.objects.filter(note_content=c_obj, table=tbl).delete()
                    for idx, rdict in enumerate(custom_rows, start=1):
                        rc = str(rdict.get("row_code") or f"ROW_{idx:02d}")
                        rl = str(rdict.get("row_label") or rc)
                        rvals = dict(rdict.get("column_values_json") or rdict.get("column_values") or rdict)
                        for k_meta in ("row_code", "row_label", "row_level", "display_order", "is_total_row", "column_values_json", "column_values"):
                            rvals.pop(k_meta, None)
                        for k_col, v_col in list(rvals.items()):
                            if isinstance(v_col, str):
                                rvals[k_col], _ = sanitize_note_text(v_col)
                        FinancialNoteTableRow.objects.create(
                            note_content=c_obj,
                            table=tbl,
                            row_code=rc,
                            row_label=rl,
                            row_level=int(rdict.get("row_level") or 1),
                            display_order=int(rdict.get("display_order") or idx),
                            column_values_json=rvals,
                            is_total_row=bool(rdict.get("is_total_row", rc == "TOTAL")),
                        )

        validate_financial_notes_run(run)

    c_obj = run.note_contents.filter(note_item=item).first()
    item_tables = list(item.tables.all().order_by("display_order"))
    table_ids = [t.id for t in item_tables]
    rows_by_table: dict[Any, list[FinancialNoteTableRow]] = {}
    for r in run.note_table_rows.filter(table_id__in=table_ids).order_by("display_order", "id"):
        rows_by_table.setdefault(r.table_id, []).append(r)

    refs = list(run.note_references.filter(note_item=item))
    vals = list(run.note_validation_results.filter(note_item=item))

    return _serialize_note_item_full(
        run=run,
        item=item,
        c_obj=c_obj,
        tables_by_item={item.id: item_tables},
        rows_by_table=rows_by_table,
        refs_by_item={item.id: refs},
        vals_by_item={item.id: vals},
    )


def get_b09_item_tables_payload(user: Any, run_id: Any, note_code: str) -> dict[str, Any]:
    item_payload = get_or_update_b09_item_payload(user, run_id, note_code, method="GET")
    return {
        "run_id": str(run_id),
        "note_code": note_code,
        "note_title": item_payload["note_title"],
        "tables": item_payload["tables"],
    }


def get_b09_table_rows_payload(user: Any, run_id: Any, table_id: Any) -> dict[str, Any]:
    run = _get_b09_run_checked(user, run_id, PERM_B09_VIEW)
    tbl = FinancialNoteTable.objects.filter(
        Q(id=table_id) if len(str(table_id)) > 20 else Q(table_code=str(table_id)),
        note_item__section__template_version=run.template_version,
    ).select_related("note_item").first()
    if not tbl:
        raise ValidationError({"error_code": "EF-05", "detail": "Không tìm thấy bảng thuyết minh trong mẫu hiện tại."})

    rows = list(run.note_table_rows.filter(table=tbl).order_by("display_order", "id"))
    return {
        "run_id": str(run.id),
        "table_id": str(tbl.id),
        "table_code": tbl.table_code,
        "table_title": tbl.table_title,
        "note_code": tbl.note_item.note_code,
        "columns": (tbl.table_schema_json or {}).get("columns", []),
        "calculation_policy": tbl.calculation_policy_json,
        "rows": [
            {
                "id": str(r.id),
                "row_code": r.row_code,
                "row_label": r.row_label,
                "row_level": r.row_level,
                "display_order": r.display_order,
                "is_total_row": r.is_total_row,
                "column_values": r.column_values_json,
                "drilldown_reference": r.drilldown_reference_json,
                "validation_flags": r.validation_flags_json,
            }
            for r in rows
        ],
    }


def get_b09_item_sources_payload(user: Any, run_id: Any, note_code: str) -> dict[str, Any]:
    """
    Drill-down & cross-statement trace for a Note Item (`RPT06-F16, F17`).
    Requires `RPT_FINANCIAL_NOTES_DETAIL_VIEW` when drilling down to GL accounts/vouchers (TC-RPT-06-06, 75).
    """
    run = _get_b09_run_checked(user, run_id, PERM_B09_DETAIL_VIEW)
    item = FinancialNoteItem.objects.filter(
        section__template_version=run.template_version,
        note_code=note_code,
    ).first()
    if not item:
        raise ValidationError({"error_code": "EF-05", "detail": f"Không tìm thấy mục thuyết minh '{note_code}'."})

    refs = list(run.note_references.filter(note_item=item).order_by("id"))
    statement_refs = []
    gl_account_refs = []
    voucher_traces = []

    eff_branch = run.branch if run.reporting_scope == "BRANCH" else None
    for ref in refs:
        if ref.reference_type == "FINANCIAL_STATEMENT":
            statement_refs.append({
                "id": str(ref.id),
                "mapping_rule_code": ref.mapping_rule_code,
                "source_statement_run_id": str(ref.source_statement_run_id) if ref.source_statement_run_id else None,
                "source_statement_line_id": str(ref.source_statement_line_id) if ref.source_statement_line_id else None,
                **(ref.source_reference_json or {}),
            })
        elif ref.reference_type == "GL_ACCOUNT":
            sjson = ref.source_reference_json or {}
            acc_prefix = str(sjson.get("account_code") or "")
            gl_account_refs.append({
                "id": str(ref.id),
                "mapping_rule_code": ref.mapping_rule_code,
                **sjson,
            })
            if acc_prefix:
                jl_qs = JournalLine.objects.filter(
                    entry__company=run.company,
                    entry__status="POSTED",
                    entry__reversed_amount=0,
                    entry__posting_date__lte=run.period_end_date,
                    account__code__startswith=acc_prefix,
                ).select_related("entry", "account", "party").order_by("-entry__posting_date", "-id")
                if eff_branch is not None:
                    jl_qs = jl_qs.filter(entry__branch=eff_branch)
                for jl in jl_qs[:25]:
                    if jl.entry.original_entry_id is not None and jl.entry.reversal_method:
                        continue
                    voucher_traces.append({
                        "journal_entry_id": str(jl.entry_id),
                        "entry_number": getattr(jl.entry, "number", ""),
                        "posting_date": jl.entry.posting_date.isoformat(),
                        "account_code": jl.account.code,
                        "account_name": jl.account.name,
                        "debit": _fmt_dec(jl.debit),
                        "credit": _fmt_dec(jl.credit),
                        "description": jl.description or jl.entry.description,
                        "party_name": jl.party.name if jl.party else None,
                    })

    return {
        "run_id": str(run.id),
        "note_code": item.note_code,
        "note_title": item.note_title,
        "related_report_code": item.related_report_code,
        "related_indicator_codes": item.related_indicator_codes,
        "financial_statement_references": statement_refs,
        "gl_account_references": gl_account_refs,
        "vouchers": voucher_traces,
    }


def get_b09_validation_payload(user: Any, run_id: Any) -> dict[str, Any]:
    run = _get_b09_run_checked(user, run_id, PERM_B09_VIEW)
    return validate_financial_notes_run(run)


def get_b09_completeness_payload(
    user: Any,
    run_id: Any,
    _run_obj: FinancialStatementRun | None = None,
) -> dict[str, Any]:
    run = _run_obj or _get_b09_run_checked(user, run_id, PERM_B09_VIEW)
    tv = run.template_version
    all_items = list(
        FinancialNoteItem.objects.filter(section__template_version=tv)
        .select_related("section")
        .order_by("section__display_order", "display_order")
    )
    contents_map = {c.note_item_id: c for c in run.note_contents.all()}

    total = len(all_items)
    cnt_completed = 0
    cnt_auto = 0
    cnt_manual_req = 0
    cnt_review_req = 0
    cnt_na = 0
    items_status_list = []

    for itm in all_items:
        c_obj = contents_map.get(itm.id)
        st = c_obj.content_status if c_obj else "NOT_STARTED"
        is_app = c_obj.is_applicable if c_obj else True
        na_reason = c_obj.not_applicable_reason if c_obj else None

        if st in ("COMPLETED", "VALIDATED", "APPROVED"):
            cnt_completed += 1
        elif st == "AUTO_POPULATED":
            cnt_auto += 1
        elif st == "NOT_APPLICABLE":
            cnt_na += 1
        elif st == "REVIEW_REQUIRED":
            cnt_review_req += 1
        else:
            cnt_manual_req += 1

        items_status_list.append({
            "section_code": itm.note_section.section_code,
            "note_code": itm.note_code,
            "note_title": itm.note_title,
            "is_required_by_default": itm.is_required_by_default,
            "content_status": st,
            "is_applicable": is_app,
            "not_applicable_reason": na_reason,
            "is_ready_for_approval": (
                st in ("COMPLETED", "VALIDATED", "APPROVED", "AUTO_POPULATED")
                or (st == "NOT_APPLICABLE" and bool(na_reason))
                or not itm.is_required_by_default
            ),
        })

    ready_cnt = sum(1 for x in items_status_list if x["is_ready_for_approval"])
    pct = round((ready_cnt / total) * 100, 2) if total > 0 else 100.0

    return {
        "run_id": str(run.id),
        "legal_form_code": run.template.legal_form_code,
        "total_items": total,
        "completed_count": cnt_completed,
        "auto_populated_count": cnt_auto,
        "manual_required_count": cnt_manual_req,
        "review_required_count": cnt_review_req,
        "not_applicable_count": cnt_na,
        "ready_for_approval_count": ready_cnt,
        "completion_percentage": pct,
        "items": items_status_list,
    }


def get_b09_history_payload(user: Any, run_id: Any) -> dict[str, Any]:
    run = _get_b09_run_checked(user, run_id, PERM_B09_VIEW)
    history_qs = FinancialStatementRun.objects.filter(
        company=run.company,
        template=run.template,
        fiscal_year=run.fiscal_year,
        period_start_date=run.period_start_date,
        period_end_date=run.period_end_date,
        reporting_scope=run.reporting_scope,
        branch=run.branch if run.reporting_scope == "BRANCH" else None,
    ).order_by("-run_version", "-created_at")

    versions = []
    for hr in history_qs:
        versions.append({
            "id": str(hr.id),
            "run_no": _get_run_no(hr),
            "version_no": hr.run_version,
            "run_version": hr.run_version,
            "parent_run_id": _get_parent_run_id(hr),
            "run_status": hr.run_status,
            "is_stale": is_b09_run_stale(hr),
            "source_snapshot_hash": hr.source_snapshot_hash,
            "created_at": hr.created_at.isoformat() if hr.created_at else None,
            "approved_at": hr.approved_at.isoformat() if hr.approved_at else None,
        })
    return {
        "current_run_id": str(run.id),
        "legal_form_code": run.template.legal_form_code,
        "versions": versions,
    }


def search_b09_run_payload(user: Any, run_id: Any, query_params: dict[str, Any]) -> dict[str, Any]:
    run = _get_b09_run_checked(user, run_id, PERM_B09_VIEW)
    keyword = (query_params.get("q") or query_params.get("keyword") or "").strip().lower()
    sec_filter = (query_params.get("section_code") or "").strip().upper()
    status_filter = (query_params.get("content_status") or "").strip().upper()

    contents = list(
        run.note_contents.select_related("note_item__section")
        .order_by("note_item__section__display_order", "note_item__display_order")
    )
    matches = []
    for c in contents:
        itm = c.note_item
        sec = itm.note_section
        if sec_filter and sec.section_code != sec_filter:
            continue
        if status_filter and c.content_status != status_filter:
            continue
        if keyword:
            haystack = f"{sec.section_code} {sec.section_name} {itm.note_code} {itm.note_title} {c.text_content or ''}".lower()
            if keyword not in haystack and _strip_accents(keyword) not in _strip_accents(haystack):
                continue
        matches.append({
            "section_code": sec.section_code,
            "section_name": sec.section_name,
            "note_code": itm.note_code,
            "note_title": itm.note_title,
            "note_type": itm.note_type,
            "content_status": c.content_status,
            "is_applicable": c.is_applicable,
            "text_snippet": (c.text_content or "")[:200],
        })

    return {
        "run_id": str(run.id),
        "keyword": keyword,
        "match_count": len(matches),
        "results": matches,
    }


@transaction.atomic
def validate_b09_run_action(user: Any, run_id: Any) -> dict[str, Any]:
    run = _get_b09_run_checked(user, run_id, PERM_B09_REVIEW)
    val_res = validate_financial_notes_run(run)
    if run.run_status in (FinancialStatementRun.Status.DRAFT, FinancialStatementRun.Status.GENERATED, FinancialStatementRun.Status.REVIEW_REQUIRED):
        if val_res["error_count"] == 0:
            run.run_status = FinancialStatementRun.Status.READY_FOR_APPROVAL
            run.validation_status = FinancialStatementRun.ValidationStatus.PASSED if val_res["warning_count"] == 0 else FinancialStatementRun.ValidationStatus.PASSED_WITH_WARNING
        else:
            run.validation_status = FinancialStatementRun.ValidationStatus.FAILED
        run.save(update_fields=["run_status", "validation_status"])
    val_res["run_status"] = run.run_status
    return val_res


@transaction.atomic
def submit_review_b09_run_action(user: Any, run_id: Any) -> dict[str, Any]:
    run = _get_b09_run_checked(user, run_id, PERM_B09_PREPARE)
    if run.run_status == FinancialStatementRun.Status.APPROVED:
        raise ValidationError({"error_code": "EF-29", "detail": "Phiên bản báo cáo đã được phê duyệt (APPROVED)."})
    val_res = validate_financial_notes_run(run)
    if val_res["error_count"] > 0:
        raise ValidationError({
            "error_code": "EF-08",
            "detail": f"Không thể gửi soát xét khi còn {val_res['error_count']} lỗi kiểm tra dữ liệu nghiêm trọng.",
            "validation_summary": val_res,
        })
    run.run_status = FinancialStatementRun.Status.READY_FOR_APPROVAL
    run.validation_status = FinancialStatementRun.ValidationStatus.PASSED if val_res["warning_count"] == 0 else FinancialStatementRun.ValidationStatus.PASSED_WITH_WARNING
    run.save(update_fields=["run_status", "validation_status"])
    return {
        "run_id": str(run.id),
        "run_status": run.run_status,
        "message": "Đã gửi soát xét và xác nhận kiểm tra Thuyết minh BCTC.",
        "validation_summary": val_res,
    }


@transaction.atomic
def approve_b09_run_action(user: Any, run_id: Any) -> dict[str, Any]:
    run = _get_b09_run_checked(user, run_id, PERM_B09_APPROVE)
    if run.run_status == FinancialStatementRun.Status.APPROVED:
        return {
            "run_id": str(run.id),
            "run_status": run.run_status,
            "approved_at": run.approved_at.isoformat() if run.approved_at else None,
        }

    val_res = validate_financial_notes_run(run)
    if val_res["error_count"] > 0:
        raise ValidationError({
            "error_code": "EF-30",
            "detail": f"Chặn phê duyệt: Thuyết minh BCTC còn {val_res['error_count']} lỗi kiểm tra nghiêm trọng.",
            "validation_summary": val_res,
        })
    if val_res["missing_required_notes"]:
        raise ValidationError({
            "error_code": "EF-09",
            "detail": f"Chặn phê duyệt: Còn {len(val_res['missing_required_notes'])} mục thuyết minh bắt buộc chưa hoàn tất ({', '.join(val_res['missing_required_notes'][:8])}).",
            "missing_required_notes": val_res["missing_required_notes"],
        })
    if val_res["is_stale"]:
        raise ValidationError({
            "error_code": "EF-28",
            "detail": "Chặn phê duyệt: Dữ liệu nguồn đã thay đổi sau thời điểm tạo bản thuyết minh (STALE). Vui lòng tạo phiên bản mới.",
        })

    iam_acc = _resolve_iam_account(user)
    run.run_status = FinancialStatementRun.Status.APPROVED
    run.validation_status = FinancialStatementRun.ValidationStatus.PASSED
    run.approved_by = iam_acc
    run.approved_at = timezone.now()
    run.save(update_fields=["run_status", "validation_status", "approved_by", "approved_at"])

    # Mark all contents as APPROVED
    run.note_contents.exclude(content_status="NOT_APPLICABLE").update(content_status="APPROVED")

    return {
        "run_id": str(run.id),
        "run_no": _get_run_no(run),
        "version_no": run.run_version,
        "run_status": run.run_status,
        "approved_at": run.approved_at.isoformat(),
        "validation_summary": val_res,
    }


def export_b09_run_action(user: Any, run_id: Any, body_data: dict[str, Any] | None = None) -> dict[str, Any]:
    run = _get_b09_run_checked(user, run_id, PERM_B09_EXPORT)
    fmt = str((body_data or {}).get("export_format") or "PDF").upper()
    header = get_b09_run_header_payload(user, run.id)
    secs = get_b09_run_sections_payload(user, run.id)
    return {
        "run_id": str(run.id),
        "run_no": _get_run_no(run),
        "version_no": run.run_version,
        "run_status": run.run_status,
        "export_format": fmt,
        "is_draft_watermark": run.run_status != FinancialStatementRun.Status.APPROVED,
        "is_stale_warning": header["is_stale"],
        "exported_at": timezone.now().isoformat(),
        "header": header,
        "sections": secs["sections"],
    }
