import hashlib
import uuid
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from django.db import transaction
from django.db.models import Max, Q, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from general_ledger.models import AccountingPeriod, Account, JournalEntry, JournalLine
from iam.models import ActiveStatus, CompanyMembership, UserPermissionOverride
from iam.permissions import assignment_permission_codes, effective_assignments
from master_data.models import Currency
from organization.models import Branch, Company

from .models import (
    FinancialStatementAccountMapping,
    FinancialStatementAdjustment,
    FinancialStatementBundle,
    FinancialStatementBundleComponent,
    FinancialStatementBundleValidation,
    FinancialStatementLine,
    FinancialStatementRun,
    FinancialStatementTemplate,
    FinancialStatementTemplateVersion,
    FinancialStatementValue,
    FinancialStatementValueSlot,
)

ZERO = Decimal("0.0000")


def _to_dec(val: Any) -> Decimal:
    if val is None:
        return ZERO
    if isinstance(val, Decimal):
        return val.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    return Decimal(str(val)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _fmt_dec(val: Decimal | None) -> str | None:
    if val is None:
        return None
    return str(_to_dec(val))


BUNDLE_TYPE_DEFINITIONS: dict[str, dict[str, Any]] = {
    "ANNUAL_GOING_CONCERN": {
        "bundle_type": "ANNUAL_GOING_CONCERN",
        "name": "BCTC năm – Hoạt động liên tục",
        "period_granularity": "ANNUAL",
        "legal_basis": "Thông tư 99/2025/TT-BTC",
        "required_components": [
            {"component_type": "FINANCIAL_POSITION", "legal_form_code": "B01-DN", "internal_code": "FSR-01", "target_uc_code": "UC-RPT-03", "order": 1},
            {"component_type": "BUSINESS_RESULT", "legal_form_code": "B02-DN", "internal_code": "FSR-02", "target_uc_code": "UC-RPT-04", "order": 2},
            {"component_type": "CASH_FLOW", "legal_form_code": "B03-DN", "internal_code": "FSR-03", "target_uc_code": "UC-RPT-05", "order": 3},
            {"component_type": "FINANCIAL_NOTES", "legal_form_code": "B09-DN", "internal_code": "FSR-04", "target_uc_code": "UC-RPT-06", "order": 4},
        ],
    },
    "ANNUAL_NON_GOING_CONCERN": {
        "bundle_type": "ANNUAL_NON_GOING_CONCERN",
        "name": "BCTC năm – Không đáp ứng giả định hoạt động liên tục",
        "period_granularity": "ANNUAL",
        "legal_basis": "Thông tư 99/2025/TT-BTC",
        "required_components": [
            {"component_type": "FINANCIAL_POSITION", "legal_form_code": "B01-DNKLT", "internal_code": "FSR-05", "target_uc_code": "UC-RPT-03", "order": 1},
            {"component_type": "BUSINESS_RESULT", "legal_form_code": "B02-DNKLT", "internal_code": "FSR-06", "target_uc_code": "UC-RPT-04", "order": 2},
            {"component_type": "CASH_FLOW", "legal_form_code": "B03-DNKLT", "internal_code": "FSR-07", "target_uc_code": "UC-RPT-05", "order": 3},
            {"component_type": "FINANCIAL_NOTES", "legal_form_code": "B09-DNKLT", "internal_code": "FSR-08", "target_uc_code": "UC-RPT-06", "order": 4},
        ],
    },
    "INTERIM_FULL": {
        "bundle_type": "INTERIM_FULL",
        "name": "BCTC giữa niên độ – Đầy đủ",
        "period_granularity": "INTERIM",
        "legal_basis": "Thông tư 99/2025/TT-BTC",
        "required_components": [
            {"component_type": "FINANCIAL_POSITION", "legal_form_code": "B01a-DN", "internal_code": "FSR-09", "target_uc_code": "UC-RPT-03", "order": 1},
            {"component_type": "BUSINESS_RESULT", "legal_form_code": "B02a-DN", "internal_code": "FSR-10", "target_uc_code": "UC-RPT-04", "order": 2},
            {"component_type": "CASH_FLOW", "legal_form_code": "B03a-DN", "internal_code": "FSR-11", "target_uc_code": "UC-RPT-05", "order": 3},
            {"component_type": "FINANCIAL_NOTES", "legal_form_code": "B09a-DN", "internal_code": "FSR-12", "target_uc_code": "UC-RPT-06", "order": 4},
        ],
    },
    "INTERIM_CONDENSED": {
        "bundle_type": "INTERIM_CONDENSED",
        "name": "BCTC giữa niên độ – Tóm lược",
        "period_granularity": "INTERIM",
        "legal_basis": "Thông tư 99/2025/TT-BTC",
        "required_components": [
            {"component_type": "FINANCIAL_POSITION", "legal_form_code": "B01b-DN", "internal_code": "FSR-13", "target_uc_code": "UC-RPT-03", "order": 1},
            {"component_type": "BUSINESS_RESULT", "legal_form_code": "B02b-DN", "internal_code": "FSR-14", "target_uc_code": "UC-RPT-04", "order": 2},
            {"component_type": "CASH_FLOW", "legal_form_code": "B03b-DN", "internal_code": "FSR-15", "target_uc_code": "UC-RPT-05", "order": 3},
            {"component_type": "FINANCIAL_NOTES", "legal_form_code": "B09a-DN", "internal_code": "FSR-12", "target_uc_code": "UC-RPT-06", "order": 4},
        ],
    },
}

SUPPORTING_REPORT_DEFINITIONS = [
    {
        "code": "TRIAL_BALANCE_MGMT",
        "name": "Bảng cân đối tài khoản (Mẫu quản trị)",
        "is_legal_bundle_component": False,
        "description": "Báo cáo hỗ trợ kiểm tra số dư và phát sinh Nợ/Có tài khoản, nằm ngoài 4 thành phần bắt buộc của bộ BCTC.",
    },
    {
        "code": "STATE_OBLIGATIONS",
        "name": "Tình hình thực hiện nghĩa vụ với Nhà nước",
        "is_legal_bundle_component": False,
        "description": "Báo cáo hỗ trợ đối chiếu các khoản thuế, phí, lệ phí phải nộp và đã nộp Nhà nước, nằm ngoài 4 thành phần bắt buộc của bộ BCTC.",
    },
]

FS_TEMPLATES_SEED = (
    ("FSR-01", "B01-DN", "Báo cáo tình hình tài chính năm", "FINANCIAL_POSITION", ["ANNUAL_GOING_CONCERN"], "ANNUAL", False, "UC-RPT-03"),
    ("FSR-02", "B02-DN", "Báo cáo kết quả hoạt động kinh doanh năm", "BUSINESS_RESULT", ["ANNUAL_GOING_CONCERN"], "ANNUAL", False, "UC-RPT-04"),
    ("FSR-03", "B03-DN", "Báo cáo lưu chuyển tiền tệ năm", "CASH_FLOW", ["ANNUAL_GOING_CONCERN"], "ANNUAL", True, "UC-RPT-05"),
    ("FSR-04", "B09-DN", "Bản thuyết minh báo cáo tài chính năm", "FINANCIAL_NOTES", ["ANNUAL_GOING_CONCERN"], "ANNUAL", False, "UC-RPT-06"),
    ("FSR-05", "B01-DNKLT", "Báo cáo tình hình tài chính năm – Không hoạt động liên tục", "FINANCIAL_POSITION", ["ANNUAL_NON_GOING_CONCERN"], "ANNUAL", False, "UC-RPT-03"),
    ("FSR-06", "B02-DNKLT", "Báo cáo kết quả hoạt động kinh doanh năm – Không hoạt động liên tục", "BUSINESS_RESULT", ["ANNUAL_NON_GOING_CONCERN"], "ANNUAL", False, "UC-RPT-04"),
    ("FSR-07", "B03-DNKLT", "Báo cáo lưu chuyển tiền tệ năm – Không hoạt động liên tục", "CASH_FLOW", ["ANNUAL_NON_GOING_CONCERN"], "ANNUAL", True, "UC-RPT-05"),
    ("FSR-08", "B09-DNKLT", "Thuyết minh BCTC năm – Không hoạt động liên tục", "FINANCIAL_NOTES", ["ANNUAL_NON_GOING_CONCERN"], "ANNUAL", False, "UC-RPT-06"),
    ("FSR-09", "B01a-DN", "Báo cáo tình hình tài chính giữa niên độ – Đầy đủ", "FINANCIAL_POSITION", ["INTERIM_FULL"], "INTERIM", False, "UC-RPT-03"),
    ("FSR-10", "B02a-DN", "Báo cáo KQKD giữa niên độ – Đầy đủ", "BUSINESS_RESULT", ["INTERIM_FULL"], "INTERIM", False, "UC-RPT-04"),
    ("FSR-11", "B03a-DN", "Báo cáo lưu chuyển tiền tệ giữa niên độ – Đầy đủ", "CASH_FLOW", ["INTERIM_FULL"], "INTERIM", True, "UC-RPT-05"),
    ("FSR-12", "B09a-DN", "Thuyết minh BCTC chọn lọc giữa niên độ", "FINANCIAL_NOTES", ["INTERIM_FULL", "INTERIM_CONDENSED"], "INTERIM", False, "UC-RPT-06"),
    ("FSR-13", "B01b-DN", "Báo cáo tình hình tài chính giữa niên độ – Tóm lược", "FINANCIAL_POSITION", ["INTERIM_CONDENSED"], "INTERIM", False, "UC-RPT-03"),
    ("FSR-14", "B02b-DN", "Báo cáo KQKD giữa niên độ – Tóm lược", "BUSINESS_RESULT", ["INTERIM_CONDENSED"], "INTERIM", False, "UC-RPT-04"),
    ("FSR-15", "B03b-DN", "Báo cáo lưu chuyển tiền tệ giữa niên độ – Tóm lược", "CASH_FLOW", ["INTERIM_CONDENSED"], "INTERIM", True, "UC-RPT-05"),
)

B01_FULL_LINES = (
    ("100", "A. TÀI SẢN NGẮN HẠN", "ASSETS_SHORT", "Tài sản ngắn hạn", "", 10, "SUBTOTAL", "110 + 130 + 140 + 150", []),
    ("110", "I. Tiền và các khoản tương đương tiền", "ASSETS_SHORT", "Tài sản ngắn hạn", "V.01", 20, "DETAIL", "", [("111", "NET_DEBIT", 1), ("112", "NET_DEBIT", 1), ("113", "NET_DEBIT", 1), ("1281", "NET_DEBIT", 1)]),
    ("130", "III. Các khoản phải thu ngắn hạn", "ASSETS_SHORT", "Tài sản ngắn hạn", "V.02", 30, "DETAIL", "", [("131", "DEBIT_BALANCE", 1), ("331", "DEBIT_BALANCE", 1), ("136", "NET_DEBIT", 1), ("138", "NET_DEBIT", 1), ("141", "NET_DEBIT", 1)]),
    ("140", "IV. Hàng tồn kho", "ASSETS_SHORT", "Tài sản ngắn hạn", "V.03", 40, "DETAIL", "", [("151", "NET_DEBIT", 1), ("152", "NET_DEBIT", 1), ("153", "NET_DEBIT", 1), ("154", "NET_DEBIT", 1), ("155", "NET_DEBIT", 1), ("156", "NET_DEBIT", 1), ("157", "NET_DEBIT", 1), ("2294", "NET_CREDIT", -1)]),
    ("150", "V. Tài sản ngắn hạn khác", "ASSETS_SHORT", "Tài sản ngắn hạn", "", 50, "DETAIL", "", [("133", "DEBIT_BALANCE", 1), ("242", "NET_DEBIT", 1)]),
    ("200", "B. TÀI SẢN DÀI HẠN", "ASSETS_LONG", "Tài sản dài hạn", "", 60, "SUBTOTAL", "220 + 240 + 250 + 260", []),
    ("220", "II. Tài sản cố định", "ASSETS_LONG", "Tài sản dài hạn", "V.04", 70, "DETAIL", "", [("211", "NET_DEBIT", 1), ("212", "NET_DEBIT", 1), ("213", "NET_DEBIT", 1), ("214", "NET_CREDIT", -1)]),
    ("240", "III. Bất động sản đầu tư", "ASSETS_LONG", "Tài sản dài hạn", "", 80, "DETAIL", "", [("217", "NET_DEBIT", 1)]),
    ("250", "IV. Tài sản dở dang dài hạn", "ASSETS_LONG", "Tài sản dài hạn", "", 90, "DETAIL", "", [("241", "NET_DEBIT", 1)]),
    ("260", "V. Đầu tư tài chính dài hạn", "ASSETS_LONG", "Tài sản dài hạn", "", 100, "DETAIL", "", [("221", "NET_DEBIT", 1), ("222", "NET_DEBIT", 1), ("228", "NET_DEBIT", 1)]),
    ("270", "TỔNG CỘNG TÀI SẢN (270 = 100 + 200)", "TOTAL_ASSETS", "Tổng cộng tài sản", "", 110, "TOTAL", "100 + 200", []),
    ("300", "C. NỢ PHẢI TRẢ", "LIABILITIES", "Nợ phải trả", "V.05", 120, "SUBTOTAL", "310 + 330", []),
    ("310", "I. Nợ ngắn hạn", "LIABILITIES", "Nợ phải trả", "V.05", 130, "DETAIL", "", [("331", "CREDIT_BALANCE", 1), ("131", "CREDIT_BALANCE", 1), ("333", "NET_CREDIT", 1), ("334", "NET_CREDIT", 1), ("335", "NET_CREDIT", 1), ("338", "NET_CREDIT", 1), ("341", "NET_CREDIT", 1), ("352", "NET_CREDIT", 1), ("353", "NET_CREDIT", 1)]),
    ("330", "II. Nợ dài hạn", "LIABILITIES", "Nợ phải trả", "", 140, "DETAIL", "", []),
    ("400", "D. VỐN CHỦ SỞ HỮU", "EQUITY", "Vốn chủ sở hữu", "V.06", 150, "SUBTOTAL", "411 + 421", []),
    ("411", "1. Vốn góp của chủ sở hữu", "EQUITY", "Vốn chủ sở hữu", "V.06", 160, "DETAIL", "", [("411", "NET_CREDIT", 1), ("413", "NET_CREDIT", 1), ("414", "NET_CREDIT", 1), ("418", "NET_CREDIT", 1)]),
    ("421", "2. Lợi nhuận sau thuế chưa phân phối", "EQUITY", "Vốn chủ sở hữu", "V.06", 170, "DETAIL", "", [("421", "NET_CREDIT", 1)]),
    ("440", "TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)", "TOTAL_EQUITY", "Tổng cộng nguồn vốn", "", 180, "TOTAL", "300 + 400", []),
)

B01_CONDENSED_LINES = (
    ("100", "A. TÀI SẢN NGẮN HẠN (Tóm lược)", "ASSETS_SHORT", "Tài sản ngắn hạn", "", 10, "SUBTOTAL", "110 + 130 + 140 + 150", []),
    ("110", "I. Tiền và các khoản tương đương tiền", "ASSETS_SHORT", "Tài sản ngắn hạn", "V.01", 20, "DETAIL", "", [("111", "NET_DEBIT", 1), ("112", "NET_DEBIT", 1), ("113", "NET_DEBIT", 1), ("1281", "NET_DEBIT", 1)]),
    ("130", "II. Các khoản phải thu ngắn hạn (Tóm lược)", "ASSETS_SHORT", "Tài sản ngắn hạn", "V.02", 30, "DETAIL", "", [("131", "DEBIT_BALANCE", 1), ("331", "DEBIT_BALANCE", 1), ("136", "NET_DEBIT", 1), ("138", "NET_DEBIT", 1), ("141", "NET_DEBIT", 1)]),
    ("140", "III. Hàng tồn kho (Tóm lược)", "ASSETS_SHORT", "Tài sản ngắn hạn", "V.03", 40, "DETAIL", "", [("151", "NET_DEBIT", 1), ("152", "NET_DEBIT", 1), ("153", "NET_DEBIT", 1), ("154", "NET_DEBIT", 1), ("155", "NET_DEBIT", 1), ("156", "NET_DEBIT", 1), ("157", "NET_DEBIT", 1), ("2294", "NET_CREDIT", -1)]),
    ("150", "IV. Tài sản ngắn hạn khác (Tóm lược)", "ASSETS_SHORT", "Tài sản ngắn hạn", "", 50, "DETAIL", "", [("133", "DEBIT_BALANCE", 1), ("242", "NET_DEBIT", 1)]),
    ("200", "B. TÀI SẢN DÀI HẠN (Tóm lược)", "ASSETS_LONG", "Tài sản dài hạn", "V.04", 60, "DETAIL", "", [("211", "NET_DEBIT", 1), ("212", "NET_DEBIT", 1), ("213", "NET_DEBIT", 1), ("214", "NET_CREDIT", -1), ("217", "NET_DEBIT", 1), ("241", "NET_DEBIT", 1), ("221", "NET_DEBIT", 1), ("222", "NET_DEBIT", 1), ("228", "NET_DEBIT", 1)]),
    ("270", "TỔNG CỘNG TÀI SẢN (270 = 100 + 200)", "TOTAL_ASSETS", "Tổng cộng tài sản", "", 70, "TOTAL", "100 + 200", []),
    ("300", "C. NỢ PHẢI TRẢ (Tóm lược)", "LIABILITIES", "Nợ phải trả", "V.05", 80, "DETAIL", "", [("331", "CREDIT_BALANCE", 1), ("131", "CREDIT_BALANCE", 1), ("333", "NET_CREDIT", 1), ("334", "NET_CREDIT", 1), ("335", "NET_CREDIT", 1), ("338", "NET_CREDIT", 1), ("341", "NET_CREDIT", 1), ("352", "NET_CREDIT", 1), ("353", "NET_CREDIT", 1)]),
    ("400", "D. VỐN CHỦ SỞ HỮU (Tóm lược)", "EQUITY", "Vốn chủ sở hữu", "V.06", 90, "SUBTOTAL", "411 + 421", []),
    ("411", "1. Vốn góp của chủ sở hữu", "EQUITY", "Vốn chủ sở hữu", "V.06", 100, "DETAIL", "", [("411", "NET_CREDIT", 1), ("413", "NET_CREDIT", 1), ("414", "NET_CREDIT", 1), ("418", "NET_CREDIT", 1)]),
    ("421", "2. Lợi nhuận sau thuế chưa phân phối", "EQUITY", "Vốn chủ sở hữu", "V.06", 110, "DETAIL", "", [("421", "NET_CREDIT", 1)]),
    ("440", "TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)", "TOTAL_EQUITY", "Tổng cộng nguồn vốn", "", 120, "TOTAL", "300 + 400", []),
)

B02_LINES = (
    ("01", "1. Doanh thu bán hàng và cung cấp dịch vụ", "REVENUE", "Doanh thu", "VI.01", 10, "DETAIL", "", [("511", "CREDIT_TURNOVER", 1)]),
    ("02", "2. Các khoản giảm trừ doanh thu", "REVENUE", "Các khoản giảm trừ", "VI.02", 20, "DETAIL", "", [("521", "DEBIT_TURNOVER", 1)]),
    ("10", "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)", "NET_REVENUE", "Doanh thu thuần", "", 30, "SUBTOTAL", "01 - 02", []),
    ("11", "4. Giá vốn hàng bán", "COGS", "Giá vốn", "VI.03", 40, "DETAIL", "", [("632", "DEBIT_TURNOVER", 1)]),
    ("20", "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)", "GROSS_PROFIT", "Lợi nhuận gộp", "", 50, "SUBTOTAL", "10 - 11", []),
    ("21", "6. Doanh thu hoạt động tài chính", "OPERATING", "Kết quả HĐKD", "VI.04", 60, "DETAIL", "", [("515", "CREDIT_TURNOVER", 1)]),
    ("22", "7. Chi phí tài chính", "OPERATING", "Kết quả HĐKD", "VI.05", 70, "DETAIL", "", [("635", "DEBIT_TURNOVER", 1)]),
    ("25", "8. Chi phí bán hàng", "OPERATING", "Kết quả HĐKD", "VI.06", 80, "DETAIL", "", [("641", "DEBIT_TURNOVER", 1)]),
    ("26", "9. Chi phí quản lý doanh nghiệp", "OPERATING", "Kết quả HĐKD", "VI.07", 90, "DETAIL", "", [("642", "DEBIT_TURNOVER", 1)]),
    ("30", "10. Lợi nhuận thuần từ hoạt động kinh doanh (30 = 20 + 21 - 22 - 25 - 26)", "OPERATING", "Kết quả HĐKD", "", 100, "SUBTOTAL", "20 + 21 - 22 - 25 - 26", []),
    ("31", "11. Thu nhập khác", "OTHER", "Thu nhập/Chi phí khác", "", 110, "DETAIL", "", [("711", "CREDIT_TURNOVER", 1)]),
    ("32", "12. Chi phí khác", "OTHER", "Thu nhập/Chi phí khác", "", 120, "DETAIL", "", [("811", "DEBIT_TURNOVER", 1)]),
    ("40", "13. Lợi nhuận khác (40 = 31 - 32)", "OTHER", "Thu nhập/Chi phí khác", "", 130, "SUBTOTAL", "31 - 32", []),
    ("50", "14. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)", "PRE_TAX", "Kết quả trước thuế", "", 140, "SUBTOTAL", "30 + 40", []),
    ("51", "15. Chi phí thuế TNDN hiện hành", "TAX", "Chi phí thuế TNDN", "VI.08", 150, "DETAIL", "", [("8211", "DEBIT_TURNOVER", 1), ("821", "DEBIT_TURNOVER", 1)]),
    ("52", "16. Chi phí thuế TNDN hoãn lại", "TAX", "Chi phí thuế TNDN", "", 160, "DETAIL", "", [("8212", "DEBIT_TURNOVER", 1)]),
    ("60", "17. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)", "NET_PROFIT", "Lợi nhuận sau thuế", "", 170, "TOTAL", "50 - 51 - 52", []),
)

B03_DIRECT_LINES = (
    ("01", "1. Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác", "OPERATING", "Lưu chuyển tiền từ HĐKD", "", 10, "DETAIL", "", [("111", "CASH_INFLOW", 1), ("112", "CASH_INFLOW", 1)]),
    ("02", "2. Tiền chi trả cho người cung cấp hàng hóa và dịch vụ", "OPERATING", "Lưu chuyển tiền từ HĐKD", "", 20, "DETAIL", "", [("111", "CASH_OUTFLOW", -1), ("112", "CASH_OUTFLOW", -1)]),
    ("20", "Lưu chuyển tiền thuần từ hoạt động kinh doanh", "OPERATING", "Lưu chuyển tiền từ HĐKD", "", 30, "SUBTOTAL", "01 + 02", []),
    ("21", "1. Tiền chi để mua sắm, xây dựng TSCĐ và các tài sản dài hạn khác", "INVESTING", "Lưu chuyển tiền từ HĐĐT", "", 40, "DETAIL", "", []),
    ("27", "7. Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia", "INVESTING", "Lưu chuyển tiền từ HĐĐT", "", 50, "DETAIL", "", []),
    ("30", "Lưu chuyển tiền thuần từ hoạt động đầu tư", "INVESTING", "Lưu chuyển tiền từ HĐĐT", "", 60, "SUBTOTAL", "21 + 27", []),
    ("33", "3. Tiền thu từ đi vay", "FINANCING", "Lưu chuyển tiền từ HĐTC", "", 70, "DETAIL", "", []),
    ("34", "4. Tiền trả nợ gốc vay", "FINANCING", "Lưu chuyển tiền từ HĐTC", "", 80, "DETAIL", "", []),
    ("40", "Lưu chuyển tiền thuần từ hoạt động tài chính", "FINANCING", "Lưu chuyển tiền từ HĐTC", "", 90, "SUBTOTAL", "33 + 34", []),
    ("50", "Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)", "NET_CASH_FLOW", "Lưu chuyển tiền thuần trong kỳ", "", 100, "SUBTOTAL", "20 + 30 + 40", []),
    ("60", "Tiền và tương đương tiền đầu kỳ", "CASH_BEGINNING", "Tiền và tương đương tiền đầu kỳ", "V.01", 110, "DETAIL", "", []),
    ("61", "Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ", "FX_EFFECT", "Ảnh hưởng thay đổi tỷ giá", "", 120, "DETAIL", "", []),
    ("70", "Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61)", "CASH_ENDING", "Tiền và tương đương tiền cuối kỳ", "V.01", 130, "TOTAL", "50 + 60 + 61", []),
)

B03_INDIRECT_LINES = (
    ("01", "1. Lợi nhuận trước thuế", "OPERATING", "Lưu chuyển tiền từ HĐKD (Gián tiếp)", "", 10, "DETAIL", "", []),
    ("02", "2. Điều chỉnh cho các khoản khấu hao TSCĐ và BĐSĐT", "OPERATING", "Lưu chuyển tiền từ HĐKD (Gián tiếp)", "", 20, "DETAIL", "", [("214", "CREDIT_TURNOVER", 1)]),
    ("08", "3. Lợi nhuận từ hoạt động kinh doanh trước thay đổi vốn lưu động", "OPERATING", "Lưu chuyển tiền từ HĐKD (Gián tiếp)", "", 30, "SUBTOTAL", "01 + 02", []),
    ("20", "Lưu chuyển tiền thuần từ hoạt động kinh doanh", "OPERATING", "Lưu chuyển tiền từ HĐKD (Gián tiếp)", "", 40, "SUBTOTAL", "", []),
    ("30", "Lưu chuyển tiền thuần từ hoạt động đầu tư", "INVESTING", "Lưu chuyển tiền từ HĐĐT", "", 50, "SUBTOTAL", "", []),
    ("40", "Lưu chuyển tiền thuần từ hoạt động tài chính", "FINANCING", "Lưu chuyển tiền từ HĐTC", "", 60, "SUBTOTAL", "", []),
    ("50", "Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)", "NET_CASH_FLOW", "Lưu chuyển tiền thuần trong kỳ", "", 70, "SUBTOTAL", "20 + 30 + 40", []),
    ("60", "Tiền và tương đương tiền đầu kỳ", "CASH_BEGINNING", "Tiền và tương đương tiền đầu kỳ", "V.01", 80, "DETAIL", "", []),
    ("61", "Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ", "FX_EFFECT", "Ảnh hưởng thay đổi tỷ giá", "", 90, "DETAIL", "", []),
    ("70", "Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61)", "CASH_ENDING", "Tiền và tương đương tiền cuối kỳ", "V.01", 100, "TOTAL", "50 + 60 + 61", []),
)

B09_NOTES_LINES = (
    ("I.01", "I. Đặc điểm hoạt động của doanh nghiệp", "SEC_I", "I. Đặc điểm hoạt động của doanh nghiệp", "I.01", 10, "NOTE_TEXT", "", True, {}, ""),
    ("II.01", "II. Kỳ kế toán, đơn vị tiền tệ sử dụng trong kế toán", "SEC_II", "II. Kỳ kế toán, đơn vị tiền tệ", "II.01", 20, "NOTE_TEXT", "", True, {}, ""),
    ("III.01", "III. Chuẩn mực và chế độ kế toán áp dụng", "SEC_III", "III. Chế độ và chính sách kế toán", "III.01", 30, "NOTE_TEXT", "", True, {}, ""),
    ("V.01", "V.01. Tiền và các khoản tương đương tiền", "SEC_V", "V. Thông tin bổ sung cho các khoản mục trên B01", "V.01", 40, "NOTE_TABLE", "", True, {"columns": ["Khoản mục", "Số cuối kỳ", "Số đầu kỳ"]}, "110"),
    ("V.02", "V.02. Các khoản phải thu ngắn hạn", "SEC_V", "V. Thông tin bổ sung cho các khoản mục trên B01", "V.02", 50, "NOTE_TABLE", "", False, {"columns": ["Khoản mục", "Số cuối kỳ", "Số đầu kỳ"]}, "130"),
    ("V.03", "V.03. Hàng tồn kho", "SEC_V", "V. Thông tin bổ sung cho các khoản mục trên B01", "V.03", 60, "NOTE_TABLE", "", False, {"columns": ["Khoản mục", "Số cuối kỳ", "Số đầu kỳ"]}, "140"),
    ("V.04", "V.04. Tăng, giảm tài sản cố định", "SEC_V", "V. Thông tin bổ sung cho các khoản mục trên B01", "V.04", 70, "NOTE_TABLE", "", False, {"columns": ["Khoản mục", "Nguyên giá", "Hao mòn lũy kế", "Giá trị còn lại"]}, "220"),
    ("V.05", "V.05. Nợ phải trả và thuế phải nộp Nhà nước", "SEC_V", "V. Thông tin bổ sung cho các khoản mục trên B01", "V.05", 80, "NOTE_TABLE", "", False, {"columns": ["Khoản mục", "Số cuối kỳ", "Số đầu kỳ"]}, "300"),
    ("V.06", "V.06. Vốn chủ sở hữu", "SEC_V", "V. Thông tin bổ sung cho các khoản mục trên B01", "V.06", 90, "NOTE_TABLE", "", True, {"columns": ["Khoản mục", "Vốn góp", "LNST chưa phân phối", "Cộng"]}, "400"),
    ("VI.01", "VI.01. Tổng doanh thu bán hàng và cung cấp dịch vụ", "SEC_VI", "VI. Thông tin bổ sung cho các khoản mục trên B02", "VI.01", 100, "NOTE_TABLE", "", True, {"columns": ["Khoản mục", "Kỳ này", "Kỳ trước"]}, "01"),
    ("VI.02", "VI.02. Các khoản giảm trừ doanh thu", "SEC_VI", "VI. Thông tin bổ sung cho các khoản mục trên B02", "VI.02", 110, "NOTE_NUMBER", "", False, {}, "02"),
    ("VI.03", "VI.03. Giá vốn hàng bán", "SEC_VI", "VI. Thông tin bổ sung cho các khoản mục trên B02", "VI.03", 120, "NOTE_NUMBER", "", False, {}, "11"),
    ("VI.04", "VI.04. Doanh thu hoạt động tài chính", "SEC_VI", "VI. Thông tin bổ sung cho các khoản mục trên B02", "VI.04", 130, "NOTE_NUMBER", "", False, {}, "21"),
    ("VI.05", "VI.05. Chi phí tài chính", "SEC_VI", "VI. Thông tin bổ sung cho các khoản mục trên B02", "VI.05", 140, "NOTE_NUMBER", "", False, {}, "22"),
    ("VI.06", "VI.06. Chi phí bán hàng", "SEC_VI", "VI. Thông tin bổ sung cho các khoản mục trên B02", "VI.06", 150, "NOTE_NUMBER", "", False, {}, "25"),
    ("VI.07", "VI.07. Chi phí quản lý doanh nghiệp", "SEC_VI", "VI. Thông tin bổ sung cho các khoản mục trên B02", "VI.07", 160, "NOTE_NUMBER", "", False, {}, "26"),
    ("VI.08", "VI.08. Chi phí thuế thu nhập doanh nghiệp", "SEC_VI", "VI. Thông tin bổ sung cho các khoản mục trên B02", "VI.08", 170, "NOTE_NUMBER", "", False, {}, "51"),
)


def seed_financial_bundles_uc_rpt_02(apps=None, schema_editor=None):
    if apps is not None:
        Action = apps.get_model("iam", "PermissionAction")
        Resource = apps.get_model("iam", "PermissionResource")
        Permission = apps.get_model("iam", "Permission")
        Template = apps.get_model("reporting", "FinancialStatementTemplate")
        TemplateVersion = apps.get_model("reporting", "FinancialStatementTemplateVersion")
        Line = apps.get_model("reporting", "FinancialStatementLine")
        AccountMapping = apps.get_model("reporting", "FinancialStatementAccountMapping")
    else:
        from iam.models import Permission, PermissionAction as Action, PermissionResource as Resource
        Template = FinancialStatementTemplate
        TemplateVersion = FinancialStatementTemplateVersion
        Line = FinancialStatementLine
        AccountMapping = FinancialStatementAccountMapping

    res_dot, _ = Resource.objects.get_or_create(
        code="RPT.FINANCIAL",
        defaults={"id": uuid.uuid4(), "module_code": "RPT", "name": "Bộ báo cáo tài chính", "status": "ACTIVE"},
    )
    res_under, _ = Resource.objects.get_or_create(
        code="RPT_FINANCIAL",
        defaults={"id": uuid.uuid4(), "module_code": "RPT", "name": "Bộ báo cáo tài chính (chuẩn UC)", "status": "ACTIVE"},
    )
    perm_defs = (
        ("VIEW", "Xem bộ BCTC", "RPT_FINANCIAL_VIEW", "RPT.FINANCIAL.VIEW"),
        ("DETAIL_VIEW", "Xem chi tiết & drill-down BCTC", "RPT_FINANCIAL_DETAIL_VIEW", "RPT.FINANCIAL.DETAIL.VIEW"),
        ("GENERATE", "Lập bộ BCTC", "RPT_FINANCIAL_GENERATE", "RPT.FINANCIAL.GENERATE"),
        ("APPROVE", "Phê duyệt bộ BCTC", "RPT_FINANCIAL_APPROVE", "RPT.FINANCIAL.APPROVE"),
        ("EXPORT", "In và xuất bộ BCTC", "RPT_FINANCIAL_EXPORT", "RPT.FINANCIAL.EXPORT"),
    )
    for act_code, act_name, underscore_code, dot_code in perm_defs:
        action, _ = Action.objects.get_or_create(
            code=act_code,
            defaults={"id": uuid.uuid4(), "name": act_name, "risk_level": "HIGH" if act_code in ("APPROVE", "DETAIL_VIEW") else "NORMAL"},
        )
        for res_obj, p_code in ((res_under, underscore_code), (res_dot, dot_code)):
            Permission.objects.get_or_create(
                code=p_code,
                defaults={
                    "id": uuid.uuid4(),
                    "resource_id": res_obj.id,
                    "action_id": action.id,
                    "description": f"Quyền {act_name.lower()} (UC-RPT-02)",
                    "status": "ACTIVE",
                },
            )

    def _populate_lines(tv, lines_def, is_notes=False):
        for item in lines_def:
            if is_notes:
                ind_code, ind_name, sec_code, sec_name, note_ref, order, ltype, formula, is_req, t_schema, rel_ind = item
                mappings = []
            else:
                ind_code, ind_name, sec_code, sec_name, note_ref, order, ltype, formula, mappings = item
                is_req = ltype in ("TOTAL", "SUBTOTAL")
                t_schema = {}
                rel_ind = ""
            line_obj, _ = Line.objects.update_or_create(
                template_version=tv,
                indicator_code=ind_code,
                defaults={
                    "indicator_name": ind_name,
                    "section_code": sec_code,
                    "section_name": sec_name,
                    "note_reference": note_ref,
                    "display_order": order,
                    "line_type": ltype,
                    "formula_expression": formula,
                    "is_required": is_req,
                    "table_schema": t_schema,
                    "related_indicator_code": rel_ind,
                },
            )
            for acc_prefix, b_side, sign_val in mappings:
                AccountMapping.objects.get_or_create(
                    company=None,
                    statement_line=line_obj,
                    account_prefix=acc_prefix,
                    balance_side=b_side,
                    defaults={
                        "sign": sign_val,
                        "effective_from": date(2020, 1, 1),
                        "is_active": True,
                    },
                )

    for int_code, legal_code, name, comp_type, bundle_types, gran, sup_cf, target_uc in FS_TEMPLATES_SEED:
        tmpl, _ = Template.objects.update_or_create(
            internal_code=int_code,
            defaults={
                "legal_form_code": legal_code,
                "name": name,
                "component_type": comp_type,
                "applicable_bundle_types": bundle_types,
                "period_granularity": gran,
                "supports_cash_flow_method": sup_cf,
                "target_uc_code": target_uc,
                "is_active": True,
            },
        )
        if comp_type == "CASH_FLOW":
            col_schema = (
                [
                    {"slot_code": "YTD_CURRENT", "label": "Lũy kế từ đầu năm đến cuối quý này – Năm nay"},
                    {"slot_code": "YTD_PREVIOUS", "label": "Lũy kế từ đầu năm đến cuối quý này – Năm trước"},
                ]
                if gran == "INTERIM"
                else [
                    {"slot_code": "CURRENT_YEAR", "label": "Năm nay"},
                    {"slot_code": "PREVIOUS_YEAR", "label": "Năm trước"},
                ]
            )
            for cf_method, cf_lines in (("DIRECT", B03_DIRECT_LINES), ("INDIRECT", B03_INDIRECT_LINES)):
                tv, _ = TemplateVersion.objects.update_or_create(
                    template=tmpl,
                    version_number=1,
                    cash_flow_method=cf_method,
                    defaults={
                        "accounting_regime": "TT99",
                        "legal_circular": "Thông tư 99/2025/TT-BTC",
                        "effective_from": date(2020, 1, 1),
                        "column_schema": col_schema,
                        "is_active": True,
                    },
                )
                _populate_lines(tv, cf_lines, is_notes=False)
        elif comp_type == "FINANCIAL_POSITION":
            col_schema = (
                [
                    {"slot_code": "CLOSING_QUARTER", "label": "Số cuối quý"},
                    {"slot_code": "OPENING_YEAR", "label": "Số đầu năm"},
                ]
                if gran == "INTERIM"
                else [
                    {"slot_code": "CLOSING", "label": "Số cuối năm"},
                    {"slot_code": "OPENING", "label": "Số đầu năm"},
                ]
            )
            tv, _ = TemplateVersion.objects.update_or_create(
                template=tmpl,
                version_number=1,
                cash_flow_method="",
                defaults={
                    "accounting_regime": "TT99",
                    "legal_circular": "Thông tư 99/2025/TT-BTC",
                    "effective_from": date(2020, 1, 1),
                    "column_schema": col_schema,
                    "is_active": True,
                },
            )
            lines_to_use = B01_CONDENSED_LINES if legal_code == "B01b-DN" else B01_FULL_LINES
            _populate_lines(tv, lines_to_use, is_notes=False)
        elif comp_type == "BUSINESS_RESULT":
            if gran == "INTERIM":
                col_schema = [
                    {"slot_code": "QUARTER_CURRENT", "label": "Quý này – Năm nay"},
                    {"slot_code": "QUARTER_PREVIOUS", "label": "Quý tương ứng – Năm trước"},
                    {"slot_code": "YTD_CURRENT", "label": "Lũy kế từ đầu năm đến cuối quý này – Năm nay"},
                    {"slot_code": "YTD_PREVIOUS", "label": "Lũy kế từ đầu năm đến cuối quý tương ứng – Năm trước"},
                ]
            else:
                col_schema = [
                    {"slot_code": "CURRENT_YEAR", "label": "Năm nay"},
                    {"slot_code": "PREVIOUS_YEAR", "label": "Năm trước"},
                ]
            tv, _ = TemplateVersion.objects.update_or_create(
                template=tmpl,
                version_number=1,
                cash_flow_method="",
                defaults={
                    "accounting_regime": "TT99",
                    "legal_circular": "Thông tư 99/2025/TT-BTC",
                    "effective_from": date(2020, 1, 1),
                    "column_schema": col_schema,
                    "is_active": True,
                },
            )
            _populate_lines(tv, B02_LINES, is_notes=False)
        elif comp_type == "FINANCIAL_NOTES":
            col_schema = [
                {"slot_code": "CURRENT", "label": "Kỳ này"},
                {"slot_code": "COMPARATIVE", "label": "Kỳ so sánh"},
            ]
            tv, _ = TemplateVersion.objects.update_or_create(
                template=tmpl,
                version_number=1,
                cash_flow_method="",
                defaults={
                    "accounting_regime": "TT99",
                    "legal_circular": "Thông tư 99/2025/TT-BTC",
                    "effective_from": date(2020, 1, 1),
                    "column_schema": col_schema,
                    "is_active": True,
                },
            )
            _populate_lines(tv, B09_NOTES_LINES, is_notes=True)


def ensure_financial_catalog_seeded():
    if FinancialStatementTemplate.objects.count() < 15:
        seed_financial_bundles_uc_rpt_02()
    b01_tpl = FinancialStatementTemplate.objects.filter(legal_form_code="B01-DN").first()
    if b01_tpl:
        b01_ver = b01_tpl.versions.filter(is_active=True).first()
        if not b01_ver or b01_ver.lines.count() < 126:
            from .financial_position_services import seed_balance_sheet_uc_rpt_03
            seed_balance_sheet_uc_rpt_03()
    from .business_result_services import ensure_b02_templates_seeded
    ensure_b02_templates_seeded()
    from .cash_flow_services import ensure_b03_templates_seeded
    ensure_b03_templates_seeded()
    from .financial_notes_services import ensure_b09_templates_seeded
    ensure_b09_templates_seeded()


# ============================================================================
# Permission & Scope Helpers
# ============================================================================

PERMISSION_ALIASES: dict[str, set[str]] = {
    "VIEW": {"RPT_FINANCIAL_VIEW", "RPT.FINANCIAL.VIEW", "RPT.CENTER.VIEW"},
    "DETAIL_VIEW": {"RPT_FINANCIAL_DETAIL_VIEW", "RPT.FINANCIAL.DETAIL.VIEW", "GL.JOURNAL.VIEW"},
    "GENERATE": {"RPT_FINANCIAL_GENERATE", "RPT.FINANCIAL.GENERATE"},
    "APPROVE": {"RPT_FINANCIAL_APPROVE", "RPT.FINANCIAL.APPROVE"},
    "EXPORT": {"RPT_FINANCIAL_EXPORT", "RPT.FINANCIAL.EXPORT"},
}


def get_effective_user_permission_codes(user, company: Company) -> set[str]:
    if user.is_superuser:
        return set().union(*PERMISSION_ALIASES.values())
    iam_account = getattr(user, "iam_account", None)
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


def has_financial_permission(user, company: Company, action: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    iam_account = getattr(user, "iam_account", None)
    if not iam_account:
        return False
    target_codes = PERMISSION_ALIASES.get(action, {action})
    now = timezone.now()
    # Explicit DENY override check
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
    codes = get_effective_user_permission_codes(user, company)
    return bool(codes & target_codes)


def resolve_allowed_branch_ids(user, company: Company) -> list[str] | None:
    if user.is_superuser:
        return None
    iam_account = getattr(user, "iam_account", None)
    if not iam_account:
        return []
    assignments = list(effective_assignments(iam_account, company))
    if not assignments:
        now = timezone.now()
        overrides = list(
            UserPermissionOverride.objects.filter(
                company_membership__user=iam_account,
                company_membership__company=company,
                effect="GRANT",
                revoked_at__isnull=True,
                valid_from__lte=now,
            )
            .filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now))
            .select_related("data_scope_set")
        )
        if not overrides:
            return []
        if any(o.data_scope_set is None or o.data_scope_set.allow_all_company_data for o in overrides):
            return None
        b_ids: set[str] = set()
        for o in overrides:
            if o.data_scope_set:
                b_ids.update(str(x) for x in o.data_scope_set.branch_scopes.values_list("branch_id", flat=True))
        return sorted(b_ids) if b_ids else None

    if any(a.data_scope_set is None or a.data_scope_set.allow_all_company_data for a in assignments):
        return None
    b_ids = set()
    has_restriction = False
    for a in assignments:
        if a.data_scope_set:
            blist = [str(x) for x in a.data_scope_set.branch_scopes.values_list("branch_id", flat=True)]
            if blist:
                has_restriction = True
                b_ids.update(blist)
    return sorted(b_ids) if has_restriction else None


def resolve_company_and_check_perm(request, required_action: str = "VIEW", explicit_company_id: str | None = None) -> tuple[Company, list[str] | None]:
    user = request.user
    if not user or not user.is_authenticated:
        raise PermissionDenied({"detail": "Chưa đăng nhập.", "code": "UNAUTHENTICATED"})
    params = request.query_params if request.method == "GET" else {**request.query_params.dict(), **(request.data if isinstance(request.data, dict) else {})}
    company_id = explicit_company_id or params.get("company_id") or params.get("company")
    if not company_id:
        raise ValidationError({"company_id": "Phải xác định doanh nghiệp làm việc (company_id).", "code": "COMPANY_REQUIRED"})
    try:
        company = Company.objects.select_related("accounting_currency").get(pk=company_id)
    except (Company.DoesNotExist, ValueError, TypeError):
        raise ValidationError({"company_id": "Doanh nghiệp không tồn tại hoặc không hợp lệ.", "code": "INVALID_COMPANY"})

    iam_account = getattr(user, "iam_account", None)
    if not user.is_superuser:
        if not iam_account or not CompanyMembership.objects.filter(
            user=iam_account,
            company=company,
            membership_status__in=(ActiveStatus.ACTIVE, "SCHEDULED_LOCK", "END_SCHEDULED"),
        ).exists():
            raise PermissionDenied({"detail": "Người dùng không thuộc doanh nghiệp này.", "code": "COMPANY_ACCESS_DENIED"})
        if not has_financial_permission(user, company, "VIEW"):
            raise PermissionDenied({"detail": "Bạn không có quyền xem Bộ báo cáo tài chính.", "code": "FINANCIAL_VIEW_DENIED"})
        if required_action != "VIEW" and not has_financial_permission(user, company, required_action):
            raise PermissionDenied({"detail": f"Bạn không có quyền thực hiện thao tác '{required_action}' trên Bộ báo cáo tài chính.", "code": f"FINANCIAL_{required_action}_DENIED"})

    allowed_branches = resolve_allowed_branch_ids(user, company)
    return company, allowed_branches


def _compute_gl_snapshot_meta(company: Company, to_date: date, branch: Branch | None = None) -> tuple[str, datetime | None]:
    qs = JournalEntry.objects.filter(
        company=company,
        status__in=("POSTED", "REVERSED"),
        posting_date__lte=to_date,
    )
    if branch is not None:
        qs = qs.filter(branch=branch)
    agg = qs.aggregate(
        max_posted=Max("posted_at"),
        max_created=Max("created_at"),
    )
    last_ts = agg["max_posted"] or agg["max_created"]
    count = qs.count()
    raw = f"{company.id}:{branch.id if branch else 'ALL'}:{to_date.isoformat()}:{count}:{last_ts.isoformat() if last_ts else 'NONE'}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32], last_ts


def is_run_stale(run: FinancialStatementRun) -> bool:
    current_hash, current_ts = _compute_gl_snapshot_meta(
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


def _period_display_name(p: AccountingPeriod) -> str:
    return str(getattr(p, "name", None) or getattr(p, "period_name", None) or f"Kỳ {p.period_number:02d}/{p.fiscal_year} ({p.code})")


# ============================================================================
# Catalog & Metadata Payload (GET /api/v1/reports/financial-bundles/types)
# ============================================================================

def get_financial_bundle_types_payload(request) -> dict[str, Any]:
    ensure_financial_catalog_seeded()
    company, allowed_branches = resolve_company_and_check_perm(request, "VIEW")

    templates = list(FinancialStatementTemplate.objects.filter(is_active=True).prefetch_related("versions"))
    templates_payload = []
    for t in templates:
        versions = [
            {
                "id": str(v.id),
                "version_number": v.version_number,
                "accounting_regime": v.accounting_regime,
                "legal_circular": v.legal_circular,
                "effective_from": v.effective_from.isoformat(),
                "effective_to": v.effective_to.isoformat() if v.effective_to else None,
                "cash_flow_method": v.cash_flow_method or None,
                "column_schema": v.column_schema,
                "is_locked": v.is_locked,
            }
            for v in t.versions.filter(is_active=True)
        ]
        templates_payload.append({
            "id": str(t.id),
            "internal_code": t.internal_code,
            "legal_form_code": t.legal_form_code,
            "name": t.name,
            "component_type": t.component_type,
            "applicable_bundle_types": t.applicable_bundle_types,
            "period_granularity": t.period_granularity,
            "supports_cash_flow_method": t.supports_cash_flow_method,
            "target_uc_code": t.target_uc_code,
            "versions": versions,
        })

    periods = list(AccountingPeriod.objects.filter(company=company).order_by("-fiscal_year", "-start_date"))
    fiscal_years = sorted({p.fiscal_year for p in periods}, reverse=True)
    branches_qs = Branch.objects.filter(company=company)
    if allowed_branches is not None:
        branches_qs = branches_qs.filter(id__in=allowed_branches)

    user_permissions = {
        "can_view": has_financial_permission(request.user, company, "VIEW"),
        "can_detail_view": has_financial_permission(request.user, company, "DETAIL_VIEW"),
        "can_generate": has_financial_permission(request.user, company, "GENERATE"),
        "can_approve": has_financial_permission(request.user, company, "APPROVE"),
        "can_export": has_financial_permission(request.user, company, "EXPORT"),
    }

    return {
        "company_id": str(company.id),
        "company_name": company.name,
        "bundle_types": list(BUNDLE_TYPE_DEFINITIONS.values()),
        "component_types": [
            {"code": "FINANCIAL_POSITION", "name": "Báo cáo tình hình tài chính", "target_uc_code": "UC-RPT-03"},
            {"code": "BUSINESS_RESULT", "name": "Báo cáo kết quả hoạt động kinh doanh", "target_uc_code": "UC-RPT-04"},
            {"code": "CASH_FLOW", "name": "Báo cáo lưu chuyển tiền tệ", "target_uc_code": "UC-RPT-05"},
            {"code": "FINANCIAL_NOTES", "name": "Bản thuyết minh báo cáo tài chính", "target_uc_code": "UC-RPT-06"},
        ],
        "cash_flow_methods": [
            {"code": "DIRECT", "name": "Phương pháp trực tiếp"},
            {"code": "INDIRECT", "name": "Phương pháp gián tiếp"},
        ],
        "templates": templates_payload,
        "supporting_reports": SUPPORTING_REPORT_DEFINITIONS,
        "fiscal_years": fiscal_years,
        "fiscal_periods": [
            {
                "id": str(p.id),
                "code": p.code,
                "name": _period_display_name(p),
                "fiscal_year": p.fiscal_year,
                "start_date": p.start_date.isoformat(),
                "end_date": p.end_date.isoformat(),
                "status": p.status,
            }
            for p in periods
        ],
        "branches": [{"id": str(b.id), "code": b.code, "name": b.name} for b in branches_qs],
        "permissions": user_permissions,
    }


# ============================================================================
# Component Statement Run Calculation Engine (GL -> Run / Value / ValueSlot)
# ============================================================================

def _resolve_template_version_for_period(
    legal_form_code: str,
    period_end_date: date,
    cash_flow_method: str = "",
    explicit_version_id: str | None = None,
) -> tuple[FinancialStatementTemplate, FinancialStatementTemplateVersion]:
    ensure_financial_catalog_seeded()
    tmpl = FinancialStatementTemplate.objects.filter(legal_form_code=legal_form_code, is_active=True).first()
    if not tmpl:
        raise ValidationError({"legal_form_code": f"Mẫu biểu '{legal_form_code}' chưa được cấu hình.", "code": "TEMPLATE_NOT_FOUND"})

    if explicit_version_id:
        tv = FinancialStatementTemplateVersion.objects.filter(id=explicit_version_id, template=tmpl).first()
        if not tv:
            raise ValidationError({"template_version_id": "Phiên bản mẫu biểu không tồn tại hoặc không thuộc mẫu biểu đã chọn.", "code": "TEMPLATE_VERSION_NOT_FOUND"})
        if tv.effective_from > period_end_date or (tv.effective_to and tv.effective_to < period_end_date):
            raise ValidationError({"template_version_id": f"Phiên bản mẫu biểu v{tv.version_number} không có hiệu lực cho kỳ kết thúc ngày {period_end_date}.", "code": "TEMPLATE_VERSION_EXPIRED"})
        return tmpl, tv

    cf_filter = cash_flow_method.upper() if tmpl.supports_cash_flow_method else ""
    qs = FinancialStatementTemplateVersion.objects.filter(
        template=tmpl,
        is_active=True,
        effective_from__lte=period_end_date,
    ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=period_end_date))
    if tmpl.supports_cash_flow_method and cf_filter:
        qs = qs.filter(cash_flow_method=cf_filter)
    tv = qs.order_by("-version_number").first()
    if not tv:
        raise ValidationError({
            "template_version": f"Không tìm thấy phiên bản mẫu '{legal_form_code}' còn hiệu lực tại ngày {period_end_date}.",
            "code": "NO_EFFECTIVE_TEMPLATE_VERSION",
        })
    return tmpl, tv


def _compute_account_balances(company: Company, start_date: date | None, end_date: date, branch: Branch | None = None, opening_only: bool = False) -> dict[str, tuple[Decimal, Decimal]]:
    qs = JournalLine.objects.filter(
        entry__company=company,
        entry__status="POSTED",
    )
    if branch is not None:
        qs = qs.filter(entry__branch=branch)
    if opening_only:
        if start_date:
            qs = qs.filter(Q(entry__entry_type="OPENING", entry__posting_date__lte=end_date) | Q(entry__posting_date__lt=start_date))
        else:
            qs = qs.filter(entry__entry_type="OPENING", entry__posting_date__lte=end_date)
    else:
        qs = qs.filter(entry__posting_date__lte=end_date)

    rows = qs.values("account__code").annotate(debit=Sum("debit"), credit=Sum("credit"))
    return {
        r["account__code"]: (_to_dec(r["debit"]), _to_dec(r["credit"]))
        for r in rows
    }


def _compute_period_turnovers(company: Company, start_date: date, end_date: date, branch: Branch | None = None) -> dict[str, tuple[Decimal, Decimal]]:
    qs = JournalLine.objects.filter(
        entry__company=company,
        entry__status="POSTED",
        entry__posting_date__range=(start_date, end_date),
    ).exclude(entry__entry_type="OPENING")
    if branch is not None:
        qs = qs.filter(entry__branch=branch)
    closing_entry_ids = list(
        qs.filter(account__code__startswith="911").values_list("entry_id", flat=True).distinct()
    )
    if closing_entry_ids:
        qs = qs.exclude(entry_id__in=closing_entry_ids)
    rows = qs.values("account__code").annotate(debit=Sum("debit"), credit=Sum("credit"))
    return {
        r["account__code"]: (_to_dec(r["debit"]), _to_dec(r["credit"]))
        for r in rows
    }


def _sum_from_balance_map(bal_map: dict[str, tuple[Decimal, Decimal]], prefix: str, balance_side: str) -> Decimal:
    total = ZERO
    for acc_code, (d, c) in bal_map.items():
        if acc_code.startswith(prefix):
            if balance_side == "NET_DEBIT":
                total += (d - c)
            elif balance_side == "NET_CREDIT":
                total += (c - d)
            elif balance_side == "DEBIT_BALANCE":
                total += max(d - c, ZERO)
            elif balance_side == "CREDIT_BALANCE":
                total += max(c - d, ZERO)
            elif balance_side == "DEBIT_TURNOVER":
                total += d
            elif balance_side == "CREDIT_TURNOVER":
                total += c
    return total


def _eval_simple_formula(formula: str, code_values: dict[str, Decimal]) -> Decimal:
    if not formula.strip():
        return ZERO
    tokens = formula.replace("+", " + ").replace("-", " - ").split()
    result = ZERO
    op = 1
    for tok in tokens:
        if tok == "+":
            op = 1
        elif tok == "-":
            op = -1
        else:
            result += op * code_values.get(tok, ZERO)
    return result


@transaction.atomic
def generate_financial_statement_run(
    *,
    company: Company,
    fiscal_period: AccountingPeriod,
    legal_form_code: str,
    user=None,
    reporting_scope: str = "COMPANY",
    branch: Branch | None = None,
    reporting_currency: Currency | None = None,
    display_unit: str = "VND",
    cash_flow_method: str = "",
    comparison_period: AccountingPeriod | None = None,
    template_version_id: str | None = None,
    run_status: str = "GENERATED",
) -> FinancialStatementRun:
    reporting_scope = (reporting_scope or "COMPANY").upper()
    if reporting_scope == "BRANCH" and not branch:
        raise ValidationError({"branch_id": "Phải chọn chi nhánh khi phạm vi báo cáo là BRANCH.", "code": "BRANCH_REQUIRED"})

    tmpl, tv = _resolve_template_version_for_period(
        legal_form_code=legal_form_code,
        period_end_date=fiscal_period.end_date,
        cash_flow_method=cash_flow_method,
        explicit_version_id=template_version_id,
    )
    if tmpl.supports_cash_flow_method and not cash_flow_method:
        cash_flow_method = tv.cash_flow_method or "DIRECT"

    currency = reporting_currency or company.accounting_currency
    prev_max_ver = (
        FinancialStatementRun.objects.filter(
            company=company,
            template=tmpl,
            fiscal_period=fiscal_period,
            reporting_scope=reporting_scope,
            branch=branch if reporting_scope == "BRANCH" else None,
            cash_flow_method=cash_flow_method if tmpl.supports_cash_flow_method else "",
        ).aggregate(m=Max("run_version"))["m"]
        or 0
    )

    snap_hash, last_posted_at = _compute_gl_snapshot_meta(
        company,
        fiscal_period.end_date,
        branch if reporting_scope == "BRANCH" else None,
    )
    iam_account = getattr(user, "iam_account", None) if user else None

    run = FinancialStatementRun.objects.create(
        company=company,
        template=tmpl,
        template_version=tv,
        fiscal_year=fiscal_period.fiscal_year,
        fiscal_period=fiscal_period,
        comparison_period=comparison_period,
        reporting_scope=reporting_scope,
        branch=branch if reporting_scope == "BRANCH" else None,
        reporting_currency=currency,
        display_unit=display_unit,
        cash_flow_method=cash_flow_method.upper() if tmpl.supports_cash_flow_method else "",
        as_of_date=fiscal_period.end_date,
        period_start_date=fiscal_period.start_date,
        period_end_date=fiscal_period.end_date,
        run_version=prev_max_ver + 1,
        run_status=run_status,
        validation_status=FinancialStatementRun.ValidationStatus.PASSED,
        source_snapshot_hash=snap_hash,
        source_last_posted_at=last_posted_at,
        created_by=iam_account,
        approved_by=iam_account if run_status == "APPROVED" else None,
        approved_at=timezone.now() if run_status == "APPROVED" else None,
    )
    if run_status == "APPROVED":
        tv.is_locked = True
        tv.save(update_fields=["is_locked"])

    eff_branch = branch if reporting_scope == "BRANCH" else None
    year_start = date(fiscal_period.fiscal_year, 1, 1)
    open_map = _compute_account_balances(company, year_start, fiscal_period.end_date, eff_branch, opening_only=True)
    close_map = _compute_account_balances(company, None, fiscal_period.end_date, eff_branch, opening_only=False)
    period_map = _compute_period_turnovers(company, fiscal_period.start_date, fiscal_period.end_date, eff_branch)
    ytd_map = _compute_period_turnovers(company, year_start, fiscal_period.end_date, eff_branch)

    prev_year_start = date(fiscal_period.fiscal_year - 1, 1, 1)
    prev_period_start = comparison_period.start_date if comparison_period else date(fiscal_period.start_date.year - 1, fiscal_period.start_date.month, 1)
    prev_period_end = comparison_period.end_date if comparison_period else date(fiscal_period.end_date.year - 1, fiscal_period.end_date.month, min(fiscal_period.end_date.day, 28))
    prev_period_map = _compute_period_turnovers(company, prev_period_start, prev_period_end, eff_branch)
    prev_ytd_map = _compute_period_turnovers(company, prev_year_start, prev_period_end, eff_branch)

    lines = list(tv.lines.all().prefetch_related("account_mappings").order_by("display_order", "indicator_code"))

    # Compute P&L values first (used by B02, B01 unclosed earnings, B03 indirect, and B09 notes)
    def _calc_b02_map(turnover_map: dict[str, tuple[Decimal, Decimal]]) -> dict[str, Decimal]:
        r01 = _sum_from_balance_map(turnover_map, "511", "CREDIT_TURNOVER")
        r02 = _sum_from_balance_map(turnover_map, "521", "DEBIT_TURNOVER")
        r10 = r01 - r02
        r11 = _sum_from_balance_map(turnover_map, "632", "DEBIT_TURNOVER") - _sum_from_balance_map(turnover_map, "632", "CREDIT_TURNOVER")
        r20 = r10 - r11
        r21 = _sum_from_balance_map(turnover_map, "515", "CREDIT_TURNOVER")
        r22 = _sum_from_balance_map(turnover_map, "635", "DEBIT_TURNOVER")
        r25 = _sum_from_balance_map(turnover_map, "641", "DEBIT_TURNOVER")
        r26 = _sum_from_balance_map(turnover_map, "642", "DEBIT_TURNOVER")
        r30 = r20 + r21 - r22 - r25 - r26
        r31 = _sum_from_balance_map(turnover_map, "711", "CREDIT_TURNOVER")
        r32 = _sum_from_balance_map(turnover_map, "811", "DEBIT_TURNOVER")
        r40 = r31 - r32
        r50 = r30 + r40
        r51 = _sum_from_balance_map(turnover_map, "8211", "DEBIT_TURNOVER") or _sum_from_balance_map(turnover_map, "821", "DEBIT_TURNOVER")
        r52 = _sum_from_balance_map(turnover_map, "8212", "DEBIT_TURNOVER")
        r60 = r50 - r51 - r52
        return {
            "01": r01, "02": r02, "10": r10, "11": r11, "20": r20,
            "21": r21, "22": r22, "25": r25, "26": r26, "30": r30,
            "31": r31, "32": r32, "40": r40, "50": r50, "51": r51,
            "52": r52, "60": r60,
        }

    b02_curr = _calc_b02_map(period_map)
    b02_prev = _calc_b02_map(prev_period_map)
    b02_ytd_curr = _calc_b02_map(ytd_map)
    b02_ytd_prev = _calc_b02_map(prev_ytd_map)

    if tmpl.component_type == "FINANCIAL_POSITION":
        from reporting.financial_position_services import calculate_financial_position_run
        calculate_financial_position_run(run)

    elif tmpl.component_type == "BUSINESS_RESULT":
        from reporting.business_result_services import calculate_business_result_run
        calculate_business_result_run(run)

    elif tmpl.component_type == "CASH_FLOW":
        from reporting.cash_flow_services import calculate_cash_flow_run
        calculate_cash_flow_run(run)

    elif tmpl.component_type == "FINANCIAL_NOTES":
        open_111 = _sum_from_balance_map(open_map, "111", "NET_DEBIT")
        close_111 = _sum_from_balance_map(close_map, "111", "NET_DEBIT")
        open_112 = _sum_from_balance_map(open_map, "112", "NET_DEBIT")
        close_112 = _sum_from_balance_map(close_map, "112", "NET_DEBIT")
        for ln in lines:
            txt = ""
            rows_json: list[dict[str, Any]] = []
            c_amt = ZERO
            o_amt = ZERO
            if ln.indicator_code == "I.01":
                txt = f"Doanh nghiệp: {company.name}. Hoạt động sản xuất, thương mại và dịch vụ theo Giấy chứng nhận đăng ký doanh nghiệp."
            elif ln.indicator_code == "II.01":
                txt = f"Kỳ kế toán năm bắt đầu từ 01/01 đến 31/12. Đơn vị tiền tệ sử dụng trong kế toán: {currency.code if currency else 'VND'}."
            elif ln.indicator_code == "III.01":
                txt = "Áp dụng Chế độ kế toán doanh nghiệp Việt Nam theo Thông tư 99/2025/TT-BTC của Bộ Tài chính."
            elif ln.indicator_code == "V.01":
                c_amt = close_111 + close_112
                o_amt = open_111 + open_112
                rows_json = [
                    {"item": "Tiền mặt (TK 111)", "closing": str(close_111), "opening": str(open_111)},
                    {"item": "Tiền gửi ngân hàng không kỳ hạn (TK 112)", "closing": str(close_112), "opening": str(open_112)},
                    {"item": "Cộng", "closing": str(c_amt), "opening": str(o_amt)},
                ]
            elif ln.indicator_code == "V.06":
                cap_close = _sum_from_balance_map(close_map, "411", "NET_CREDIT")
                cap_open = _sum_from_balance_map(open_map, "411", "NET_CREDIT")
                c_amt = cap_close
                o_amt = cap_open
                rows_json = [
                    {"item": "Vốn đầu tư của chủ sở hữu", "closing": str(cap_close), "opening": str(cap_open)},
                ]
            elif ln.indicator_code == "VI.01":
                c_amt = b02_curr.get("01", ZERO)
                o_amt = b02_prev.get("01", ZERO)
                rows_json = [
                    {"item": "Doanh thu bán hàng và cung cấp dịch vụ", "current": str(c_amt), "previous": str(o_amt)},
                ]
            elif ln.related_indicator_code in b02_curr:
                c_amt = b02_curr.get(ln.related_indicator_code, ZERO)
                o_amt = b02_prev.get(ln.related_indicator_code, ZERO)

            FinancialStatementValue.objects.create(
                statement_run=run,
                statement_line=ln,
                current_period_amount=c_amt,
                comparative_period_amount=o_amt,
                text_value=txt,
                table_rows_json=rows_json,
                content_status="COMPLETE",
                calculation_detail_json={"section_code": ln.section_code, "related_indicator_code": ln.related_indicator_code},
            )

    return run


# ============================================================================
# Bundle Creation, Validation, Approval & Versioning
# ============================================================================

def _validate_component_run_compatibility(
    bundle: FinancialStatementBundle,
    comp_def: dict[str, Any],
    run: FinancialStatementRun,
) -> None:
    if run.company_id != bundle.company_id:
        raise ValidationError({
            "selected_run_ids": f"Run '{run.id}' thuộc doanh nghiệp khác, không thể ghép vào bộ BCTC của '{bundle.company.name}'.",
            "code": "RUN_COMPANY_MISMATCH",
        })
    if run.fiscal_period_id != bundle.fiscal_period_id:
        raise ValidationError({
            "selected_run_ids": f"Run '{run.id}' thuộc kỳ '{run.fiscal_period.code}', khác với kỳ của bộ BCTC ('{bundle.fiscal_period.code}').",
            "code": "RUN_PERIOD_MISMATCH",
        })
    if run.reporting_scope != bundle.reporting_scope or (bundle.reporting_scope == "BRANCH" and run.branch_id != bundle.branch_id):
        raise ValidationError({
            "selected_run_ids": f"Run '{run.id}' có phạm vi báo cáo ({run.reporting_scope}) không khớp với phạm vi của bộ BCTC ({bundle.reporting_scope}).",
            "code": "RUN_SCOPE_MISMATCH",
        })
    if bundle.reporting_currency_id and run.reporting_currency_id and run.reporting_currency_id != bundle.reporting_currency_id:
        raise ValidationError({
            "selected_run_ids": f"Run '{run.id}' có đồng tiền báo cáo không khớp với bộ BCTC.",
            "code": "RUN_CURRENCY_MISMATCH",
        })
    req_legal_code = comp_def["legal_form_code"]
    if run.template.legal_form_code != req_legal_code:
        raise ValidationError({
            "selected_run_ids": f"Thành phần {comp_def['component_type']} của bộ {bundle.bundle_type} bắt buộc dùng mẫu '{req_legal_code}', không được thay bằng '{run.template.legal_form_code}'.",
            "code": "INCOMPATIBLE_LEGAL_FORM",
        })
    tv = run.template_version
    if tv.effective_from > bundle.fiscal_period.end_date or (tv.effective_to and tv.effective_to < bundle.fiscal_period.end_date):
        raise ValidationError({
            "selected_run_ids": f"Template Version v{tv.version_number} của Run '{run.id}' không có hiệu lực cho kỳ báo cáo.",
            "code": "INCOMPATIBLE_TEMPLATE_VERSION",
        })
    if comp_def["component_type"] == "CASH_FLOW" and run.cash_flow_method and run.cash_flow_method != bundle.cash_flow_method:
        raise ValidationError({
            "selected_run_ids": f"Run B03 '{run.id}' được lập theo phương pháp {run.cash_flow_method}, không khớp với phương pháp {bundle.cash_flow_method} của bộ BCTC.",
            "code": "CASH_FLOW_METHOD_MISMATCH",
        })


@transaction.atomic
def validate_financial_bundle(bundle: FinancialStatementBundle) -> dict[str, Any]:
    val_run_id = uuid.uuid4()
    FinancialStatementBundleValidation.objects.filter(bundle=bundle).delete()

    components = list(
        bundle.components.select_related("statement_run__template", "statement_run__template_version", "template_version").order_by("display_order")
    )
    issues: list[FinancialStatementBundleValidation] = []

    def _add_issue(rule_code: str, severity: str, comp_type: str, msg: str, ind_code: str = "", src_ref: str = "", line_obj=None):
        issues.append(
            FinancialStatementBundleValidation.objects.create(
                bundle=bundle,
                validation_run_id=val_run_id,
                rule_code=rule_code,
                severity=severity,
                component_type=comp_type,
                statement_line=line_obj,
                indicator_code=ind_code,
                source_reference=src_ref,
                message=msg,
                validation_status="FAILED" if severity == "BLOCKER" else "PASSED_WITH_WARNING",
            )
        )

    available_count = 0
    approved_count = 0
    any_stale = False
    b01_values: dict[str, Decimal | None] = {}
    b02_values: dict[str, Decimal | None] = {}
    b03_values: dict[str, Decimal | None] = {}
    b09_codes: set[str] = set()
    referenced_notes: list[tuple[str, str, str]] = []  # (comp_type, indicator_code, note_reference)

    for comp in components:
        run = comp.statement_run
        if not run:
            comp.component_status = "MISSING"
            comp.validation_status = "FAILED"
            comp.save(update_fields=["component_status", "validation_status"])
            _add_issue(
                "FS-COMPONENT-01",
                "BLOCKER",
                comp.component_type,
                f"Thiếu báo cáo thành phần bắt buộc: {comp.required_legal_form_code} ({comp.get_component_type_display()}).",
            )
            continue

        available_count += 1
        if run.simulate_load_error:
            comp.component_status = "ERROR"
            comp.validation_status = "FAILED"
            comp.save(update_fields=["component_status", "validation_status"])
            _add_issue(
                "FS-LOAD-01",
                "WARNING",
                comp.component_type,
                f"Thành phần {comp.required_legal_form_code} gặp lỗi khi tải dữ liệu chi tiết; các thành phần khác vẫn hiển thị bình thường.",
            )
            continue

        comp.component_status = run.run_status
        if run.run_status == "APPROVED":
            approved_count += 1

        # Check stale
        if is_run_stale(run):
            any_stale = True
            _add_issue(
                "FS-STALE-01",
                "WARNING",
                comp.component_type,
                f"Dữ liệu Sổ cái (GL) đã có thay đổi sau thời điểm lập báo cáo {comp.required_legal_form_code} (Run v{run.run_version}).",
                src_ref=str(run.id),
            )

        # Check method match for B03
        if comp.component_type == "CASH_FLOW" and run.cash_flow_method != bundle.cash_flow_method:
            _add_issue(
                "FS-METHOD-01",
                "BLOCKER",
                "CASH_FLOW",
                f"Phương pháp LCTT của Run ({run.cash_flow_method}) không khớp với cấu hình bộ BCTC ({bundle.cash_flow_method}).",
            )

        # Load values for cross-check
        vals = list(run.values.select_related("statement_line"))
        if not vals:
            _add_issue(
                "FS-VALUE-01",
                "BLOCKER",
                comp.component_type,
                f"Báo cáo {comp.required_legal_form_code} không có dữ liệu chỉ tiêu (Report Value rỗng).",
            )
            comp.validation_status = "FAILED"
            comp.save(update_fields=["component_status", "validation_status"])
            continue

        comp_failed = False
        for v in vals:
            ln = v.statement_line
            if comp.component_type in ("FINANCIAL_POSITION", "BUSINESS_RESULT", "CASH_FLOW"):
                if ln.note_reference:
                    referenced_notes.append((comp.component_type, ln.indicator_code, ln.note_reference))
                if v.current_period_amount is None and ln.line_type in ("DETAIL", "SUBTOTAL", "TOTAL"):
                    _add_issue(
                        "FS-VALUE-NULL-01",
                        "BLOCKER",
                        comp.component_type,
                        f"Chỉ tiêu [{ln.indicator_code}] {ln.indicator_name} trên {comp.required_legal_form_code} bị mất dữ liệu (NULL).",
                        ind_code=ln.indicator_code,
                        line_obj=ln,
                    )
                    comp_failed = True

            if comp.component_type == "FINANCIAL_POSITION":
                b01_values[ln.indicator_code] = v.current_period_amount
            elif comp.component_type == "BUSINESS_RESULT":
                b02_values[ln.indicator_code] = v.current_period_amount
            elif comp.component_type == "CASH_FLOW":
                b03_values[ln.indicator_code] = v.current_period_amount
            elif comp.component_type == "FINANCIAL_NOTES":
                b09_codes.add(ln.indicator_code)
                if ln.note_reference:
                    b09_codes.add(ln.note_reference)
                if ln.is_required:
                    is_missing_content = (
                        v.content_status == "MISSING"
                        or (ln.line_type == "NOTE_TEXT" and not (v.text_value or "").strip())
                        or (ln.line_type == "NOTE_TABLE" and not v.table_rows_json and v.current_period_amount is None)
                    )
                    if is_missing_content:
                        _add_issue(
                            "FS-NOTES-01",
                            "BLOCKER",
                            "FINANCIAL_NOTES",
                            f"Thuyết minh bắt buộc [{ln.indicator_code}] '{ln.indicator_name}' chưa có nội dung.",
                            ind_code=ln.indicator_code,
                            line_obj=ln,
                        )
                        comp_failed = True

        comp.validation_status = "FAILED" if comp_failed else ("STALE" if is_run_stale(run) else "PASSED")
        comp.save(update_fields=["component_status", "validation_status"])

    # Rule FS-BALANCE-01: B01 Balance check (Total Assets 280/270 == Total Resources 440)
    if b01_values:
        total_assets_code = "280" if "280" in b01_values else "270"
        total_assets = b01_values.get(total_assets_code)
        total_equity_liab = b01_values.get("440")
        a_short = b01_values.get("100")
        a_long = b01_values.get("200")
        b01_long_children_sum = (
            (b01_values.get("210") or ZERO)
            + (b01_values.get("220") or ZERO)
            + (b01_values.get("230") or ZERO)
            + (b01_values.get("240") or ZERO)
            + (b01_values.get("250") or ZERO)
            + (b01_values.get("260") or ZERO)
            + (b01_values.get("270") or ZERO)
        ) if "280" in b01_values else a_long

        if total_assets is not None and total_equity_liab is not None and total_assets != total_equity_liab:
            _add_issue(
                "FS-BALANCE-01",
                "BLOCKER",
                "FINANCIAL_POSITION",
                f"Báo cáo tình hình tài chính không cân đối: Tổng tài sản [{total_assets_code}] ({total_assets}) ≠ Tổng nguồn vốn [440] ({total_equity_liab}).",
                ind_code=total_assets_code,
            )
            bundle.components.filter(component_type="FINANCIAL_POSITION").update(validation_status="FAILED")
        elif a_short is not None and a_long is not None and total_assets is not None and (a_short + a_long) != total_assets:
            _add_issue(
                "FS-BALANCE-01",
                "BLOCKER",
                "FINANCIAL_POSITION",
                f"Tổng tài sản [{total_assets_code}] ({total_assets}) ≠ Tài sản ngắn hạn [100] ({a_short}) + Tài sản dài hạn [200] ({a_long}).",
                ind_code=total_assets_code,
            )
            bundle.components.filter(component_type="FINANCIAL_POSITION").update(validation_status="FAILED")
        elif a_long is not None and b01_long_children_sum is not None and a_long != b01_long_children_sum:
            _add_issue(
                "FS-BALANCE-01",
                "BLOCKER",
                "FINANCIAL_POSITION",
                f"Tài sản dài hạn [200] ({a_long}) ≠ Tổng các mục con [210..270] ({b01_long_children_sum}).",
                ind_code="270",
            )
            bundle.components.filter(component_type="FINANCIAL_POSITION").update(validation_status="FAILED")

    # Rule FS-PROFIT-01: B02 Formula checks
    if b02_values:
        v01 = b02_values.get("01")
        v02 = b02_values.get("02")
        v10 = b02_values.get("10")
        v11 = b02_values.get("11")
        v20 = b02_values.get("20")
        v50 = b02_values.get("50")
        v51 = b02_values.get("51")
        v52 = b02_values.get("52")
        v60 = b02_values.get("60")
        b02_err = False
        if v01 is not None and v02 is not None and v10 is not None and v10 != (v01 - v02):
            _add_issue(
                "FS-PROFIT-01",
                "BLOCKER",
                "BUSINESS_RESULT",
                f"Chỉ tiêu Doanh thu thuần [10] ({v10}) ≠ [01] ({v01}) - [02] ({v02}).",
                ind_code="10",
            )
            b02_err = True
        if v10 is not None and v11 is not None and v20 is not None and v20 != (v10 - v11):
            _add_issue(
                "FS-PROFIT-01",
                "BLOCKER",
                "BUSINESS_RESULT",
                f"Chỉ tiêu Lợi nhuận gộp [20] ({v20}) ≠ [10] ({v10}) - [11] ({v11}).",
                ind_code="20",
            )
            b02_err = True
        if v50 is not None and v51 is not None and v52 is not None and v60 is not None and v60 != (v50 - v51 - v52):
            _add_issue(
                "FS-PROFIT-01",
                "BLOCKER",
                "BUSINESS_RESULT",
                f"Chỉ tiêu Lợi nhuận sau thuế [60] ({v60}) ≠ [50] ({v50}) - [51] ({v51}) - [52] ({v52}).",
                ind_code="60",
            )
            b02_err = True
        if b02_err:
            bundle.components.filter(component_type="BUSINESS_RESULT").update(validation_status="FAILED")

    # Rule FS-CASH-01: B03 Cash reconciliation with B01[110]
    if b03_values:
        cf50 = b03_values.get("50")
        cf60 = b03_values.get("60")
        cf61 = b03_values.get("61") or ZERO
        cf62 = b03_values.get("62") or ZERO
        cf70 = b03_values.get("70")
        b01_cash = b01_values.get("110")
        b03_err = False
        if cf50 is not None and cf60 is not None and cf70 is not None and cf70 != (cf50 + cf60 + cf61 + cf62):
            _add_issue(
                "FS-CASH-01",
                "BLOCKER",
                "CASH_FLOW",
                f"Tiền cuối kỳ trên B03 [70] ({cf70}) ≠ Lưu chuyển tiền thuần [50] ({cf50}) + Tiền đầu kỳ [60] ({cf60}) + Chênh lệch tỷ giá [61] ({cf61}) + Tái phân loại [62] ({cf62}).",
                ind_code="70",
            )
            b03_err = True
        if cf70 is not None and b01_cash is not None and cf70 != b01_cash:
            _add_issue(
                "FS-CASH-01",
                "BLOCKER",
                "CASH_FLOW",
                f"Tiền và tương đương tiền cuối kỳ trên B03 [70] ({cf70}) không khớp với chỉ tiêu [110] trên B01 ({b01_cash}).",
                ind_code="70",
            )
            b03_err = True
        if b03_err:
            bundle.components.filter(component_type="CASH_FLOW").update(validation_status="FAILED")

    # Rule FS-NOTES-REF-01: Note references on B01/B02/B03 must exist in B09
    if b09_codes:
        from reporting.financial_position_services import VALID_TT99_B09_NOTE_PREFIXES
        for comp_type, ind_code, note_ref in referenced_notes:
            base_ref = note_ref.split("(")[0].strip()
            if (
                note_ref not in b09_codes
                and base_ref not in b09_codes
                and base_ref not in VALID_TT99_B09_NOTE_PREFIXES
            ):
                _add_issue(
                    "FS-NOTES-REF-01",
                    "WARNING",
                    comp_type,
                    f"Chỉ tiêu [{ind_code}] tham chiếu mã thuyết minh '{note_ref}' nhưng mã này không tồn tại trong Bản thuyết minh B09.",
                    ind_code=ind_code,
                    src_ref=note_ref,
                )

    # Rule FS-APPROVAL-01: Bundle marked APPROVED while components are not all APPROVED (EF-28)
    if bundle.bundle_status == FinancialStatementBundle.BundleStatus.APPROVED and approved_count < len(components):
        _add_issue(
            "FS-APPROVAL-01",
            "BLOCKER",
            "BUNDLE",
            "Bộ BCTC đang ở trạng thái APPROVED nhưng có báo cáo thành phần chưa được phê duyệt.",
        )

    blocker_count = sum(1 for i in issues if i.severity == "BLOCKER")
    warning_count = sum(1 for i in issues if i.severity == "WARNING")

    if blocker_count > 0:
        val_status = FinancialStatementBundle.ValidationStatus.FAILED
    elif any_stale:
        val_status = FinancialStatementBundle.ValidationStatus.STALE
    elif warning_count > 0:
        val_status = FinancialStatementBundle.ValidationStatus.PASSED_WITH_WARNING
    else:
        val_status = FinancialStatementBundle.ValidationStatus.PASSED

    # Determine bundle_status according to BR-RPT-FS-31..45
    if bundle.bundle_status not in (
        FinancialStatementBundle.BundleStatus.SUPERSEDED,
        FinancialStatementBundle.BundleStatus.ARCHIVED,
    ):
        if available_count < 4:
            new_bundle_status = FinancialStatementBundle.BundleStatus.INCOMPLETE
        elif blocker_count > 0:
            new_bundle_status = FinancialStatementBundle.BundleStatus.REVIEW_REQUIRED
        elif bundle.bundle_status == FinancialStatementBundle.BundleStatus.APPROVED and approved_count == 4:
            new_bundle_status = FinancialStatementBundle.BundleStatus.APPROVED
        elif bundle.bundle_status == FinancialStatementBundle.BundleStatus.READY_FOR_APPROVAL and approved_count == 4:
            new_bundle_status = FinancialStatementBundle.BundleStatus.READY_FOR_APPROVAL
        else:
            new_bundle_status = FinancialStatementBundle.BundleStatus.GENERATED
    else:
        new_bundle_status = bundle.bundle_status

    bundle.validation_status = val_status
    bundle.bundle_status = new_bundle_status
    bundle.last_checked_at = timezone.now()
    bundle.save(update_fields=["validation_status", "bundle_status", "last_checked_at", "updated_at"])

    return {
        "bundle_id": str(bundle.id),
        "bundle_status": bundle.bundle_status,
        "validation_status": bundle.validation_status,
        "required_component_count": 4,
        "available_component_count": available_count,
        "approved_component_count": approved_count,
        "warning_count": warning_count,
        "blocker_count": blocker_count,
        "is_stale": any_stale,
        "last_checked_at": bundle.last_checked_at.isoformat() if bundle.last_checked_at else None,
        "items": [
            {
                "id": str(i.id),
                "rule_code": i.rule_code,
                "severity": i.severity,
                "component_type": i.component_type,
                "indicator_code": i.indicator_code,
                "source_reference": i.source_reference,
                "message": i.message,
                "validation_status": i.validation_status,
                "checked_at": i.checked_at.isoformat(),
            }
            for i in issues
        ],
    }


@transaction.atomic
def create_or_version_financial_bundle(request) -> FinancialStatementBundle:
    ensure_financial_catalog_seeded()
    data = request.data if isinstance(request.data, dict) else {}
    company, allowed_branches = resolve_company_and_check_perm(request, "GENERATE")

    bundle_type = str(data.get("bundle_type") or "ANNUAL_GOING_CONCERN").upper()
    if bundle_type not in BUNDLE_TYPE_DEFINITIONS:
        raise ValidationError({"bundle_type": f"Loại bộ BCTC '{bundle_type}' không hợp lệ.", "code": "INVALID_BUNDLE_TYPE"})
    bundle_def = BUNDLE_TYPE_DEFINITIONS[bundle_type]

    # Non-going concern check (C3)
    if bundle_type == "ANNUAL_NON_GOING_CONCERN":
        if not data.get("confirm_non_going_concern") and not data.get("non_going_concern_reason"):
            raise ValidationError({
                "bundle_type": "Bộ BCTC năm – Không đáp ứng giả định hoạt động liên tục (DNKLT) yêu cầu xác nhận căn cứ pháp lý (confirm_non_going_concern=true).",
                "code": "NON_GOING_CONCERN_CONFIRMATION_REQUIRED",
            })

    fiscal_period_id = data.get("fiscal_period_id") or data.get("period_id")
    if not fiscal_period_id:
        raise ValidationError({"fiscal_period_id": "Phải chọn kỳ kế toán (fiscal_period_id).", "code": "FISCAL_PERIOD_REQUIRED"})
    fiscal_period = AccountingPeriod.objects.filter(id=fiscal_period_id).first()
    if not fiscal_period:
        raise ValidationError({"fiscal_period_id": "Kỳ kế toán không tồn tại.", "code": "FISCAL_PERIOD_NOT_FOUND"})
    if fiscal_period.company_id != company.id:
        raise ValidationError({"fiscal_period_id": "Kỳ kế toán không thuộc doanh nghiệp đã chọn.", "code": "PERIOD_COMPANY_MISMATCH"})

    fiscal_year = int(data.get("fiscal_year") or data.get("fiscal_year_id") or fiscal_period.fiscal_year)
    if fiscal_year != fiscal_period.fiscal_year:
        raise ValidationError({"fiscal_year": "Năm tài chính và kỳ kế toán không nhất quán.", "code": "YEAR_PERIOD_MISMATCH"})

    reporting_scope = str(data.get("reporting_scope") or "COMPANY").upper()
    if reporting_scope not in ("COMPANY", "BRANCH"):
        raise ValidationError({"reporting_scope": "Phạm vi báo cáo không hợp lệ (COMPANY hoặc BRANCH).", "code": "INVALID_REPORTING_SCOPE"})

    branch = None
    if reporting_scope == "BRANCH":
        branch_id = data.get("branch_id")
        if not branch_id:
            raise ValidationError({"branch_id": "Phải chọn chi nhánh khi phạm vi báo cáo là BRANCH.", "code": "BRANCH_REQUIRED"})
        branch = Branch.objects.filter(id=branch_id, company=company).first()
        if not branch:
            raise ValidationError({"branch_id": "Chi nhánh không thuộc doanh nghiệp.", "code": "INVALID_BRANCH"})
        if allowed_branches is not None and str(branch.id) not in allowed_branches:
            raise PermissionDenied({"detail": "Bạn không có quyền truy cập dữ liệu của chi nhánh này.", "code": "BRANCH_OUT_OF_SCOPE"})

    cash_flow_method = str(data.get("cash_flow_method") or "DIRECT").upper()
    if cash_flow_method not in ("DIRECT", "INDIRECT"):
        raise ValidationError({"cash_flow_method": "Phải xác định phương pháp lập Báo cáo lưu chuyển tiền tệ (DIRECT hoặc INDIRECT).", "code": "INVALID_CASH_FLOW_METHOD"})

    currency_id = data.get("reporting_currency_id")
    if currency_id:
        currency = Currency.objects.filter(id=currency_id).first()
        if not currency:
            raise ValidationError({"reporting_currency_id": "Đồng tiền báo cáo không tồn tại.", "code": "INVALID_CURRENCY"})
    else:
        currency = company.accounting_currency

    display_unit = str(data.get("display_unit") or "VND")
    run_selection_mode = str(data.get("run_selection_mode") or "LATEST").upper()
    if run_selection_mode not in ("LATEST_APPROVED", "LATEST", "SELECTED"):
        run_selection_mode = "LATEST"

    scope_suffix = f"-{branch.code}" if branch else ""
    bundle_code = str(data.get("bundle_code") or f"FSB-{fiscal_year}-{fiscal_period.code}-{bundle_type}{scope_suffix}")
    bundle_name = str(data.get("bundle_name") or f"{bundle_def['name']} ({_period_display_name(fiscal_period)})")

    existing_bundles = list(
        FinancialStatementBundle.objects.filter(company=company, bundle_code=bundle_code).order_by("-bundle_version")
    )
    prev_bundle = existing_bundles[0] if existing_bundles else None
    next_version = (prev_bundle.bundle_version + 1) if prev_bundle else 1

    if prev_bundle:
        FinancialStatementBundle.objects.filter(company=company, bundle_code=bundle_code, is_current_version=True).update(
            is_current_version=False,
            bundle_status=FinancialStatementBundle.BundleStatus.SUPERSEDED,
        )

    snap_hash, last_posted_at = _compute_gl_snapshot_meta(company, fiscal_period.end_date, branch)
    iam_account = getattr(request.user, "iam_account", None)

    bundle = FinancialStatementBundle.objects.create(
        company=company,
        bundle_code=bundle_code,
        bundle_name=bundle_name,
        bundle_type=bundle_type,
        legal_basis=bundle_def["legal_basis"],
        fiscal_year=fiscal_year,
        fiscal_period=fiscal_period,
        reporting_scope=reporting_scope,
        branch=branch,
        reporting_currency=currency,
        display_unit=display_unit,
        cash_flow_method=cash_flow_method,
        bundle_version=next_version,
        is_current_version=True,
        bundle_status=FinancialStatementBundle.BundleStatus.DRAFT,
        validation_status=FinancialStatementBundle.ValidationStatus.NOT_CHECKED,
        source_snapshot_reference=snap_hash,
        source_last_posted_at=last_posted_at,
        show_zero_lines=bool(data.get("show_zero_lines", True)),
        show_notes=bool(data.get("show_notes", True)),
        include_supporting_reports=bool(data.get("include_supporting_reports", False)),
        created_by=iam_account,
        supersedes_bundle=prev_bundle,
    )

    selected_run_ids = data.get("selected_run_ids") or []
    auto_generate_runs = bool(data.get("auto_generate_runs", False))
    omit_components = {str(x).upper() for x in (data.get("omit_components") or [])}

    selected_runs_by_comp: dict[str, FinancialStatementRun] = {}
    if selected_run_ids:
        for rid in selected_run_ids:
            run_obj = FinancialStatementRun.objects.select_related("template", "template_version", "fiscal_period", "company").filter(id=rid).first()
            if not run_obj:
                raise ValidationError({"selected_run_ids": f"Statement Run '{rid}' không tồn tại.", "code": "RUN_NOT_FOUND"})
            comp_type = run_obj.template.component_type
            comp_def = next((c for c in bundle_def["required_components"] if c["component_type"] == comp_type), None)
            if not comp_def:
                raise ValidationError({"selected_run_ids": f"Run '{rid}' không thuộc 4 thành phần bắt buộc của bộ BCTC.", "code": "INVALID_COMPONENT_RUN"})
            _validate_component_run_compatibility(bundle, comp_def, run_obj)
            if comp_type in selected_runs_by_comp:
                raise ValidationError({"selected_run_ids": f"Không được gắn nhiều hơn 1 Run cho cùng thành phần '{comp_type}'.", "code": "DUPLICATE_COMPONENT_RUN"})
            selected_runs_by_comp[comp_type] = run_obj

    for comp_def in bundle_def["required_components"]:
        ctype = comp_def["component_type"]
        req_legal = comp_def["legal_form_code"]
        _, tv = _resolve_template_version_for_period(
            legal_form_code=req_legal,
            period_end_date=fiscal_period.end_date,
            cash_flow_method=cash_flow_method if ctype == "CASH_FLOW" else "",
        )
        chosen_run: FinancialStatementRun | None = None
        if ctype not in omit_components:
            if ctype in selected_runs_by_comp:
                chosen_run = selected_runs_by_comp[ctype]
            elif run_selection_mode in ("LATEST", "LATEST_APPROVED") and not auto_generate_runs:
                r_qs = FinancialStatementRun.objects.filter(
                    company=company,
                    fiscal_period=fiscal_period,
                    template__legal_form_code=req_legal,
                    reporting_scope=reporting_scope,
                    branch=branch,
                )
                if ctype == "CASH_FLOW":
                    r_qs = r_qs.filter(cash_flow_method=cash_flow_method)
                if run_selection_mode == "LATEST_APPROVED":
                    r_qs = r_qs.filter(run_status="APPROVED")
                chosen_run = r_qs.order_by("-run_version", "-created_at").first()

            if not chosen_run and auto_generate_runs:
                chosen_run = generate_financial_statement_run(
                    company=company,
                    fiscal_period=fiscal_period,
                    legal_form_code=req_legal,
                    user=request.user,
                    reporting_scope=reporting_scope,
                    branch=branch,
                    reporting_currency=currency,
                    display_unit=display_unit,
                    cash_flow_method=cash_flow_method if ctype == "CASH_FLOW" else "",
                    run_status=str(data.get("initial_run_status") or "GENERATED"),
                )

        FinancialStatementBundleComponent.objects.create(
            bundle=bundle,
            component_type=ctype,
            statement_run=chosen_run,
            required_legal_form_code=req_legal,
            template_version=chosen_run.template_version if chosen_run else tv,
            is_required=True,
            display_order=comp_def["order"],
            component_status=chosen_run.run_status if chosen_run else "MISSING",
            validation_status="NOT_CHECKED",
        )

    validate_financial_bundle(bundle)
    if iam_account:
        record_audit(
            company=company,
            actor_user=iam_account,
            module_code="RPT",
            action_code="CREATE_FINANCIAL_BUNDLE",
            entity=bundle,
            after={"bundle_code": bundle.bundle_code, "bundle_version": bundle.bundle_version, "bundle_status": bundle.bundle_status},
            request=request,
        )
    return bundle


def serialize_bundle_summary(bundle: FinancialStatementBundle) -> dict[str, Any]:
    comps = list(bundle.components.select_related("statement_run"))
    avail_count = sum(1 for c in comps if c.statement_run_id is not None and not c.statement_run.simulate_load_error)
    val_count = sum(1 for c in comps if c.validation_status in ("PASSED", "PASSED_WITH_WARNING"))
    appr_count = sum(1 for c in comps if c.statement_run and c.statement_run.run_status == "APPROVED")
    gen_times = [c.statement_run.created_at for c in comps if c.statement_run]
    last_gen = max(gen_times).isoformat() if gen_times else None
    stale_any = any(is_run_stale(c.statement_run) for c in comps if c.statement_run)
    warn_count = bundle.validations.filter(severity="WARNING").count()
    blk_count = bundle.validations.filter(severity="BLOCKER").count()

    return {
        "bundle_id": str(bundle.id),
        "bundle_code": bundle.bundle_code,
        "bundle_name": bundle.bundle_name,
        "company_id": str(bundle.company_id),
        "company_name": bundle.company.name,
        "fiscal_year": bundle.fiscal_year,
        "fiscal_period_id": str(bundle.fiscal_period_id),
        "period_name": _period_display_name(bundle.fiscal_period),
        "bundle_type": bundle.bundle_type,
        "reporting_scope": bundle.reporting_scope,
        "branch_id": str(bundle.branch_id) if bundle.branch_id else None,
        "cash_flow_method": bundle.cash_flow_method,
        "bundle_version": bundle.bundle_version,
        "is_current_version": bundle.is_current_version,
        "required_component_count": 4,
        "available_component_count": avail_count,
        "validated_component_count": val_count,
        "approved_component_count": appr_count,
        "bundle_status": bundle.bundle_status,
        "validation_status": bundle.validation_status,
        "last_generated_at": last_gen,
        "approved_at": bundle.approved_at.isoformat() if bundle.approved_at else None,
        "approved_by_name": (getattr(bundle.approved_by, "display_name", None) or getattr(bundle.approved_by, "username", None) or str(bundle.approved_by)) if bundle.approved_by else None,
        "has_warning": (warn_count + blk_count) > 0 or stale_any,
        "warning_count": warn_count,
        "blocker_count": blk_count,
        "is_stale": stale_any,
        "lock_version": bundle.lock_version,
    }


def serialize_bundle_detail(bundle: FinancialStatementBundle, user=None) -> dict[str, Any]:
    summary = serialize_bundle_summary(bundle)
    components_payload = serialize_bundle_components(bundle)
    validations = list(bundle.validations.all())
    is_period_closed = bundle.fiscal_period.status == "CLOSED"
    can_generate = has_financial_permission(user, bundle.company, "GENERATE") if user else False
    can_approve = has_financial_permission(user, bundle.company, "APPROVE") if user else False
    can_export = has_financial_permission(user, bundle.company, "EXPORT") if user else False
    can_detail = has_financial_permission(user, bundle.company, "DETAIL_VIEW") if user else False

    return {
        **summary,
        "legal_basis": bundle.legal_basis,
        "tax_code": getattr(bundle.company, "tax_code", "") or "",
        "company_address": getattr(bundle.company, "address", "") or "",
        "reporting_currency_id": str(bundle.reporting_currency_id) if bundle.reporting_currency_id else None,
        "reporting_currency_code": bundle.reporting_currency.code if bundle.reporting_currency else "VND",
        "display_unit": bundle.display_unit,
        "created_by": str(bundle.created_by_id) if bundle.created_by_id else None,
        "created_at": bundle.created_at.isoformat(),
        "approved_by": str(bundle.approved_by_id) if bundle.approved_by_id else None,
        "source_snapshot_reference": bundle.source_snapshot_reference,
        "last_checked_at": bundle.last_checked_at.isoformat() if bundle.last_checked_at else None,
        "supersedes_bundle_id": str(bundle.supersedes_bundle_id) if bundle.supersedes_bundle_id else None,
        "is_period_closed": is_period_closed,
        "read_only": is_period_closed or bundle.bundle_status in ("APPROVED", "SUPERSEDED", "ARCHIVED") or not (can_generate or can_approve),
        "permissions": {
            "can_view": True,
            "can_detail_view": can_detail,
            "can_generate": can_generate and not is_period_closed,
            "can_approve": can_approve,
            "can_export": can_export,
        },
        "components": components_payload,
        "validations": [
            {
                "id": str(v.id),
                "rule_code": v.rule_code,
                "severity": v.severity,
                "component_type": v.component_type,
                "indicator_code": v.indicator_code,
                "source_reference": v.source_reference,
                "message": v.message,
                "validation_status": v.validation_status,
                "checked_at": v.checked_at.isoformat(),
            }
            for v in validations
        ],
    }


def serialize_bundle_components(bundle: FinancialStatementBundle) -> list[dict[str, Any]]:
    bdef = BUNDLE_TYPE_DEFINITIONS.get(bundle.bundle_type, BUNDLE_TYPE_DEFINITIONS["ANNUAL_GOING_CONCERN"])
    uc_map = {c["component_type"]: c["target_uc_code"] for c in bdef["required_components"]}
    comps = list(
        bundle.components.select_related(
            "statement_run__template",
            "statement_run__template_version",
            "template_version__template",
        ).order_by("display_order")
    )
    all_validations = list(bundle.validations.all())
    result = []
    for c in comps:
        run = c.statement_run
        c_vals = [v for v in all_validations if v.component_type == c.component_type]
        w_cnt = sum(1 for v in c_vals if v.severity == "WARNING")
        b_cnt = sum(1 for v in c_vals if v.severity == "BLOCKER")
        if run and run.simulate_load_error:
            result.append({
                "id": str(c.id),
                "component_type": c.component_type,
                "legal_form_code": c.required_legal_form_code,
                "report_name": run.template.name,
                "template_version": run.template_version.version_number,
                "statement_run_id": str(run.id),
                "run_version": run.run_version,
                "run_status": "ERROR",
                "validation_status": "FAILED",
                "approved_status": False,
                "generated_at": run.created_at.isoformat(),
                "approved_at": None,
                "line_count": 0,
                "warning_count": w_cnt + 1,
                "blocker_count": b_cnt,
                "is_stale": False,
                "target_uc_code": uc_map.get(c.component_type, "UC-RPT-03"),
                "error_message": f"Không thể tải dữ liệu báo cáo thành phần {c.required_legal_form_code}.",
                "bundle_context": {
                    "bundle_id": str(bundle.id),
                    "company_id": str(bundle.company_id),
                    "fiscal_period_id": str(bundle.fiscal_period_id),
                    "bundle_version": bundle.bundle_version,
                    "statement_run_id": str(run.id),
                },
            })
            continue

        tmpl_name = (
            run.template.name
            if run
            else (c.template_version.template.name if c.template_version else c.get_component_type_display())
        )
        result.append({
            "id": str(c.id),
            "component_type": c.component_type,
            "legal_form_code": c.required_legal_form_code,
            "report_name": tmpl_name,
            "template_version": run.template_version.version_number if run else (c.template_version.version_number if c.template_version else 1),
            "statement_run_id": str(run.id) if run else None,
            "run_version": run.run_version if run else None,
            "run_status": run.run_status if run else "MISSING",
            "validation_status": c.validation_status,
            "approved_status": bool(run and run.run_status == "APPROVED"),
            "generated_at": run.created_at.isoformat() if run else None,
            "approved_at": run.approved_at.isoformat() if (run and run.approved_at) else None,
            "line_count": run.values.count() if run else 0,
            "warning_count": w_cnt,
            "blocker_count": b_cnt,
            "is_stale": is_run_stale(run) if run else False,
            "target_uc_code": uc_map.get(c.component_type, "UC-RPT-03"),
            "bundle_context": {
                "bundle_id": str(bundle.id),
                "company_id": str(bundle.company_id),
                "fiscal_period_id": str(bundle.fiscal_period_id),
                "bundle_version": bundle.bundle_version,
                "statement_run_id": str(run.id) if run else None,
            },
        })
    return result


def get_bundle_for_request(request, bundle_id: str, required_action: str = "VIEW") -> FinancialStatementBundle:
    try:
        bundle = FinancialStatementBundle.objects.select_related(
            "company", "fiscal_period", "branch", "reporting_currency", "created_by", "approved_by"
        ).get(pk=bundle_id)
    except (FinancialStatementBundle.DoesNotExist, ValueError, TypeError):
        raise ValidationError({"bundle_id": "Bộ báo cáo tài chính không tồn tại.", "code": "BUNDLE_NOT_FOUND"})

    params = request.query_params if request.method == "GET" else {**request.query_params.dict(), **(request.data if isinstance(request.data, dict) else {})}
    req_company_id = params.get("company_id") or params.get("company")
    if req_company_id and str(req_company_id) != str(bundle.company_id):
        raise PermissionDenied({"detail": "Bộ BCTC không thuộc doanh nghiệp đang làm việc.", "code": "BUNDLE_COMPANY_MISMATCH"})

    _, allowed_branches = resolve_company_and_check_perm(request, required_action, explicit_company_id=str(bundle.company_id))
    if bundle.reporting_scope == "BRANCH" and bundle.branch_id and allowed_branches is not None:
        if str(bundle.branch_id) not in allowed_branches:
            raise PermissionDenied({"detail": "Bạn không có quyền xem Bộ BCTC của chi nhánh này.", "code": "BRANCH_OUT_OF_SCOPE"})

    # Check if caller requested a specific historical bundle_version (AF-12 / TC-RPT-02-26)
    req_version = params.get("bundle_version")
    if req_version is not None and int(req_version) != bundle.bundle_version:
        ver_bundle = FinancialStatementBundle.objects.select_related(
            "company", "fiscal_period", "branch", "reporting_currency", "created_by", "approved_by"
        ).filter(company=bundle.company, bundle_code=bundle.bundle_code, bundle_version=int(req_version)).first()
        if not ver_bundle:
            raise ValidationError({"bundle_version": f"Phiên bản bộ BCTC v{req_version} không tồn tại.", "code": "BUNDLE_VERSION_NOT_FOUND"})
        return ver_bundle
    return bundle


@transaction.atomic
def submit_bundle_for_review(request, bundle_id: str) -> dict[str, Any]:
    bundle = get_bundle_for_request(request, bundle_id, required_action="GENERATE")
    data = request.data if isinstance(request.data, dict) else {}
    if "lock_version" in data and int(data["lock_version"]) != bundle.lock_version:
        raise ValidationError({"lock_version": "Bộ BCTC đã bị người dùng khác cập nhật (Concurrency Conflict). Vui lòng tải lại.", "code": "CONCURRENCY_CONFLICT"})

    val_res = validate_financial_bundle(bundle)
    if val_res["available_component_count"] < 4:
        raise ValidationError({"bundle_status": "Chưa đủ 4 báo cáo thành phần bắt buộc, không thể trình duyệt.", "code": "BUNDLE_INCOMPLETE"})
    if val_res["blocker_count"] > 0:
        raise ValidationError({"validation_status": "Bộ BCTC còn lỗi chặn (Blocker), không thể trình duyệt.", "code": "VALIDATION_BLOCKERS_EXIST"})

    bundle.bundle_status = FinancialStatementBundle.BundleStatus.READY_FOR_APPROVAL
    bundle.lock_version += 1
    bundle.save(update_fields=["bundle_status", "lock_version", "updated_at"])
    return serialize_bundle_detail(bundle, request.user)


@transaction.atomic
def approve_financial_bundle(request, bundle_id: str) -> dict[str, Any]:
    bundle = get_bundle_for_request(request, bundle_id, required_action="APPROVE")
    data = request.data if isinstance(request.data, dict) else {}
    if "lock_version" in data and int(data["lock_version"]) != bundle.lock_version:
        raise ValidationError({"lock_version": "Bộ BCTC đã bị người dùng khác cập nhật (Concurrency Conflict). Vui lòng tải lại.", "code": "CONCURRENCY_CONFLICT"})

    val_res = validate_financial_bundle(bundle)
    if val_res["available_component_count"] < 4:
        raise ValidationError({"bundle_status": "Không được phê duyệt bộ BCTC khi còn thiếu thành phần bắt buộc.", "code": "CANNOT_APPROVE_INCOMPLETE_BUNDLE"})
    if val_res["blocker_count"] > 0:
        raise ValidationError({"validation_status": "Không được phê duyệt bộ BCTC khi kiểm tra chéo không đạt (Validation FAILED).", "code": "CANNOT_APPROVE_FAILED_BUNDLE"})
    if val_res["approved_component_count"] < 4:
        raise ValidationError({"components": "Tất cả 4 báo cáo thành phần bắt buộc phải ở trạng thái APPROVED trước khi phê duyệt toàn bộ bộ BCTC.", "code": "UNAPPROVED_COMPONENTS_EXIST"})

    iam_account = getattr(request.user, "iam_account", None)
    bundle.bundle_status = FinancialStatementBundle.BundleStatus.APPROVED
    bundle.approved_by = iam_account
    bundle.approved_at = timezone.now()
    bundle.lock_version += 1
    bundle.save(update_fields=["bundle_status", "approved_by", "approved_at", "lock_version", "updated_at"])

    # Lock all template versions used in approved bundle (Rule B1.7)
    for comp in bundle.components.select_related("statement_run__template_version"):
        if comp.statement_run and comp.statement_run.template_version:
            tv = comp.statement_run.template_version
            if not tv.is_locked:
                tv.is_locked = True
                tv.save(update_fields=["is_locked"])

    if iam_account:
        record_audit(
            company=bundle.company,
            actor_user=iam_account,
            module_code="RPT",
            action_code="APPROVE_FINANCIAL_BUNDLE",
            entity=bundle,
            after={
                "bundle_id": str(bundle.id),
                "bundle_code": bundle.bundle_code,
                "bundle_version": bundle.bundle_version,
                "bundle_status": bundle.bundle_status,
                "approved_by": str(iam_account.id),
                "approved_at": bundle.approved_at.isoformat(),
            },
            request=request,
        )
    return serialize_bundle_detail(bundle, request.user)


def get_bundle_history_payload(request, bundle_id: str) -> dict[str, Any]:
    bundle = get_bundle_for_request(request, bundle_id, required_action="VIEW")
    versions = list(
        FinancialStatementBundle.objects.filter(
            company=bundle.company,
            bundle_code=bundle.bundle_code,
        )
        .select_related("company", "fiscal_period", "approved_by", "created_by")
        .prefetch_related("components__statement_run", "validations")
        .order_by("-bundle_version")
    )
    return {
        "company_id": str(bundle.company_id),
        "bundle_code": bundle.bundle_code,
        "versions": [
            {
                **serialize_bundle_summary(v),
                "supersedes_bundle_id": str(v.supersedes_bundle_id) if v.supersedes_bundle_id else None,
                "component_run_ids": {
                    c.component_type: str(c.statement_run_id) if c.statement_run_id else None
                    for c in v.components.all()
                },
            }
            for v in versions
        ],
    }


def export_financial_bundle_payload(request, bundle_id: str) -> dict[str, Any]:
    bundle = get_bundle_for_request(request, bundle_id, required_action="EXPORT")
    data = request.data if isinstance(request.data, dict) else {}
    export_format = str(data.get("format") or "PDF").upper()
    export_mode = str(data.get("export_mode") or ("OFFICIAL" if bundle.bundle_status == "APPROVED" else "DRAFT")).upper()

    if export_mode == "OFFICIAL" and bundle.bundle_status != FinancialStatementBundle.BundleStatus.APPROVED:
        raise ValidationError({
            "export_mode": f"Bộ BCTC đang ở trạng thái '{bundle.bundle_status}', không thể xuất bản chính thức (OFFICIAL). Vui lòng chọn chế độ xuất nháp (DRAFT) hoặc hoàn tất phê duyệt bộ BCTC.",
            "code": "OFFICIAL_EXPORT_REQUIRES_APPROVED_BUNDLE",
        })

    iam_account = getattr(request.user, "iam_account", None)
    if iam_account:
        record_audit(
            company=bundle.company,
            actor_user=iam_account,
            module_code="RPT",
            action_code="EXPORT_FINANCIAL_BUNDLE",
            entity=bundle,
            after={"bundle_id": str(bundle.id), "format": export_format, "export_mode": export_mode},
            request=request,
        )
    return {
        "target_uc_code": "UC-RPT-15",
        "bundle_id": str(bundle.id),
        "bundle_code": bundle.bundle_code,
        "bundle_version": bundle.bundle_version,
        "bundle_status": bundle.bundle_status,
        "format": export_format,
        "export_mode": export_mode,
        "watermark": None if export_mode == "OFFICIAL" else "BẢN NHÁP – CHƯA PHÊ DUYỆT",
        "component_runs": [
            {
                "component_type": c.component_type,
                "legal_form_code": c.required_legal_form_code,
                "statement_run_id": str(c.statement_run_id) if c.statement_run_id else None,
            }
            for c in bundle.components.order_by("display_order")
        ],
    }


# ============================================================================
# Supporting Reports (Section 1.4: Trial Balance & State Obligations)
# ============================================================================

def get_supporting_reports_payload(request, bundle_id: str | None = None) -> dict[str, Any]:
    if bundle_id:
        bundle = get_bundle_for_request(request, bundle_id, required_action="VIEW")
        company = bundle.company
        period = bundle.fiscal_period
        branch = bundle.branch if bundle.reporting_scope == "BRANCH" else None
    else:
        company, _ = resolve_company_and_check_perm(request, "VIEW")
        period_id = request.query_params.get("fiscal_period_id")
        period = AccountingPeriod.objects.filter(id=period_id, company=company).first() if period_id else AccountingPeriod.objects.filter(company=company).order_by("-start_date").first()
        if not period:
            raise ValidationError({"fiscal_period_id": "Không tìm thấy kỳ kế toán.", "code": "FISCAL_PERIOD_NOT_FOUND"})
        branch = None

    open_map = _compute_account_balances(company, period.start_date, period.end_date, branch, opening_only=True)
    period_map = _compute_period_turnovers(company, period.start_date, period.end_date, branch)
    ytd_map = _compute_period_turnovers(company, date(period.fiscal_year, 1, 1), period.end_date, branch)
    close_map = _compute_account_balances(company, None, period.end_date, branch, opening_only=False)

    all_codes = sorted(set(open_map.keys()) | set(period_map.keys()) | set(close_map.keys()))
    accounts_by_code = {a.code: a.name for a in Account.objects.filter(code__in=all_codes)}

    tb_rows = []
    for code in all_codes:
        od, oc = open_map.get(code, (ZERO, ZERO))
        pd, pc = period_map.get(code, (ZERO, ZERO))
        ad, ac = ytd_map.get(code, (ZERO, ZERO))
        cd, cc = close_map.get(code, (ZERO, ZERO))
        tb_rows.append({
            "account_code": code,
            "account_name": accounts_by_code.get(code, code),
            "opening_debit": str(max(od - oc, ZERO)),
            "opening_credit": str(max(oc - od, ZERO)),
            "period_debit": str(pd),
            "period_credit": str(pc),
            "accumulated_debit": str(ad),
            "accumulated_credit": str(ac),
            "closing_debit": str(max(cd - cc, ZERO)),
            "closing_credit": str(max(cc - cd, ZERO)),
        })

    # State obligations (333x accounts, excluding unposted tax payments)
    tax_Specs = [
        ("01", "Thuế giá trị gia tăng (3331)", "3331"),
        ("02", "Thuế tiêu thụ đặc biệt (3332)", "3332"),
        ("03", "Thuế xuất, nhập khẩu (3333)", "3333"),
        ("04", "Thuế thu nhập doanh nghiệp (3334)", "3334"),
        ("05", "Thuế thu nhập cá nhân (3335)", "3335"),
        ("06", "Các loại thuế, phí, lệ phí khác (3338, 3339)", "3338"),
    ]
    so_rows = []
    for ind_code, ind_name, prefix in tax_Specs:
        open_pay = _sum_from_balance_map(open_map, prefix, "NET_CREDIT")
        per_assessed = _sum_from_balance_map(period_map, prefix, "CREDIT_TURNOVER")
        per_paid = _sum_from_balance_map(period_map, prefix, "DEBIT_TURNOVER")
        acc_assessed = _sum_from_balance_map(ytd_map, prefix, "CREDIT_TURNOVER")
        acc_paid = _sum_from_balance_map(ytd_map, prefix, "DEBIT_TURNOVER")
        close_pay = open_pay + per_assessed - per_paid
        so_rows.append({
            "indicator_code": ind_code,
            "indicator_name": ind_name,
            "opening_payable": str(open_pay),
            "period_assessed": str(per_assessed),
            "period_paid": str(per_paid),
            "accumulated_assessed": str(acc_assessed),
            "accumulated_paid": str(acc_paid),
            "closing_payable": str(close_pay),
        })

    return {
        "is_legal_bundle_component": False,
        "required_component_count_unchanged": 4,
        "trial_balance_management": {
            "code": "TRIAL_BALANCE_MGMT",
            "name": "Bảng cân đối tài khoản (Mẫu quản trị)",
            "is_legal_bundle_component": False,
            "rows": tb_rows,
        },
        "state_obligations": {
            "code": "STATE_OBLIGATIONS",
            "name": "Tình hình thực hiện nghĩa vụ với Nhà nước",
            "is_legal_bundle_component": False,
            "rows": so_rows,
        },
    }


# ============================================================================
# Statement Run Detail, Lines & Drill-down Sources
# ============================================================================

def get_statement_run_for_request(request, run_id: str, required_action: str = "VIEW") -> FinancialStatementRun:
    try:
        run = FinancialStatementRun.objects.select_related(
            "company", "template", "template_version", "fiscal_period", "branch", "reporting_currency", "created_by", "approved_by"
        ).get(pk=run_id)
    except (FinancialStatementRun.DoesNotExist, ValueError, TypeError):
        raise ValidationError({"run_id": "Statement Run không tồn tại.", "code": "RUN_NOT_FOUND"})

    _, allowed_branches = resolve_company_and_check_perm(request, required_action, explicit_company_id=str(run.company_id))
    if run.reporting_scope == "BRANCH" and run.branch_id and allowed_branches is not None:
        if str(run.branch_id) not in allowed_branches:
            raise PermissionDenied({"detail": "Bạn không có quyền xem báo cáo của chi nhánh này.", "code": "BRANCH_OUT_OF_SCOPE"})
    return run


def get_statement_run_detail_payload(request, run_id: str) -> dict[str, Any]:
    run = get_statement_run_for_request(request, run_id, required_action="VIEW")
    return {
        "run_id": str(run.id),
        "company_id": str(run.company_id),
        "company_name": run.company.name,
        "company_address": getattr(run.company, "address", "") or "",
        "template_id": str(run.template_id),
        "internal_code": run.template.internal_code,
        "legal_form_code": run.template.legal_form_code,
        "statement_title": run.template.name,
        "component_type": run.template.component_type,
        "target_uc_code": run.template.target_uc_code,
        "template_version_id": str(run.template_version_id),
        "template_version": run.template_version.version_number,
        "column_schema": run.template_version.column_schema,
        "fiscal_year": run.fiscal_year,
        "fiscal_period_id": str(run.fiscal_period_id),
        "period_name": _period_display_name(run.fiscal_period),
        "as_of_date": run.as_of_date.isoformat(),
        "period_start_date": run.period_start_date.isoformat(),
        "period_end_date": run.period_end_date.isoformat(),
        "reporting_scope": run.reporting_scope,
        "branch_id": str(run.branch_id) if run.branch_id else None,
        "reporting_currency": run.reporting_currency.code if run.reporting_currency else "VND",
        "display_unit": run.display_unit,
        "cash_flow_method": run.cash_flow_method or None,
        "run_version": run.run_version,
        "run_status": run.run_status,
        "validation_status": run.validation_status,
        "is_stale": is_run_stale(run),
        "created_at": run.created_at.isoformat(),
        "approved_at": run.approved_at.isoformat() if run.approved_at else None,
    }


def get_statement_run_lines_payload(request, run_id: str) -> dict[str, Any]:
    run = get_statement_run_for_request(request, run_id, required_action="VIEW")
    show_zero = request.query_params.get("show_zero_lines", "true").lower() not in ("false", "0", "no")

    vals = list(
        run.values.select_related("statement_line")
        .order_by("statement_line__display_order", "statement_line__indicator_code")
    )
    slots_by_line: dict[uuid.UUID, list[dict[str, Any]]] = {}
    for s in run.value_slots.all().order_by("display_order"):
        slots_by_line.setdefault(s.statement_line_id, []).append({
            "slot_code": s.slot_code,
            "slot_label": s.slot_label,
            "amount": _fmt_dec(s.amount),
            "text_value": s.text_value,
            "display_order": s.display_order,
        })

    lines_out = []
    for v in vals:
        ln = v.statement_line
        if (
            not show_zero
            and ln.line_type == "DETAIL"
            and v.current_period_amount == ZERO
            and (v.comparative_period_amount is None or v.comparative_period_amount == ZERO)
        ):
            continue
        lines_out.append({
            "line_id": str(ln.id),
            "indicator_code": ln.indicator_code,
            "indicator_name": ln.indicator_name,
            "section_code": ln.section_code,
            "section_name": ln.section_name,
            "note_reference": ln.note_reference,
            "display_order": ln.display_order,
            "line_type": ln.line_type,
            "formula_expression": ln.formula_expression,
            "is_required": ln.is_required,
            "related_indicator_code": ln.related_indicator_code,
            "table_schema": ln.table_schema,
            "current_period_amount": _fmt_dec(v.current_period_amount),
            "comparative_period_amount": _fmt_dec(v.comparative_period_amount),
            "closing_amount": _fmt_dec(v.current_period_amount),
            "opening_amount": _fmt_dec(v.comparative_period_amount),
            "text_value": v.text_value,
            "table_rows": v.table_rows_json,
            "content_status": v.content_status,
            "value_slots": slots_by_line.get(ln.id, []),
        })

    return {
        **get_statement_run_detail_payload(request, run_id),
        "show_zero_lines": show_zero,
        "lines": lines_out,
    }


def get_statement_line_sources_payload(request, run_id: str, line_id: str) -> dict[str, Any]:
    run = get_statement_run_for_request(request, run_id, required_action="DETAIL_VIEW")
    ln = FinancialStatementLine.objects.filter(indicator_code=line_id, template_version=run.template_version).first()
    if not ln:
        try:
            parsed_uuid = uuid.UUID(str(line_id))
            ln = FinancialStatementLine.objects.filter(id=parsed_uuid, template_version=run.template_version).first()
        except (ValueError, TypeError):
            ln = None
    if not ln:
        raise ValidationError({"line_id": "Chỉ tiêu báo cáo không tồn tại trong phiên bản mẫu này.", "code": "LINE_NOT_FOUND"})

    val = FinancialStatementValue.objects.filter(statement_run=run, statement_line=ln).first()
    mappings = list(
        ln.account_mappings.filter(is_active=True, effective_from__lte=run.period_end_date)
        .filter(Q(company__isnull=True) | Q(company=run.company))
        .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=run.period_end_date))
    )
    prefixes = [m.account_prefix for m in mappings]

    entries_out = []
    if prefixes:
        q_acc = Q()
        for p in prefixes:
            q_acc |= Q(account__code__startswith=p)
        jl_qs = (
            JournalLine.objects.filter(
                entry__company=run.company,
                entry__status="POSTED",
                entry__posting_date__lte=run.period_end_date,
            )
            .filter(q_acc)
            .select_related("entry", "account")
            .order_by("-entry__posting_date", "entry__number")[:100]
        )
        if run.reporting_scope == "BRANCH" and run.branch_id:
            jl_qs = jl_qs.filter(entry__branch_id=run.branch_id)
        for jl in jl_qs:
            entries_out.append({
                "journal_entry_id": str(jl.entry_id),
                "journal_number": jl.entry.number,
                "posting_date": jl.entry.posting_date.isoformat(),
                "account_code": jl.account.code,
                "account_name": jl.account.name,
                "debit": str(_to_dec(jl.debit)),
                "credit": str(_to_dec(jl.credit)),
                "description": jl.description or jl.entry.description,
            })

    return {
        "target_uc_code": "UC-RPT-14",
        "run_id": str(run.id),
        "line_id": str(ln.id),
        "indicator_code": ln.indicator_code,
        "indicator_name": ln.indicator_name,
        "formula_expression": ln.formula_expression,
        "current_period_amount": _fmt_dec(val.current_period_amount) if val else None,
        "comparative_period_amount": _fmt_dec(val.comparative_period_amount) if val else None,
        "account_mappings": [
            {
                "account_prefix": m.account_prefix,
                "balance_side": m.balance_side,
                "sign": m.sign,
            }
            for m in mappings
        ],
        "source_journal_lines": entries_out,
    }
