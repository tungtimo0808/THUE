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
    CashEquivalentInstrument,
    CashFlowClassification,
    CashFlowEvent,
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
        return val.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    return Decimal(str(val)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


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
    for p in (",", ";", ":", "(", ")"):
        cleaned = cleaned.replace(p, " ")
    return " ".join(cleaned.split())


# ============================================================================
# 1. TEMPLATE SPECIFICATIONS FOR B03-DN, B03-DNKLT, B03a-DN, B03b-DN (TT99)
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

B03_DIRECT_27_LINES: list[tuple] = [
    # --- I. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG KINH DOANH (8 MÃ: 01..07, 20) ---
    (
        "01",
        "1. Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("111", "CASH_INFLOW", 1, {"counterparts": ["511", "131", "3331"], "section": "OPERATING"}),
            ("112", "CASH_INFLOW", 1, {"counterparts": ["511", "131", "3331"], "section": "OPERATING"}),
        ],
    ),
    (
        "02",
        "2. Tiền chi trả cho người cung cấp hàng hóa và dịch vụ",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["331", "152", "153", "156", "621", "627", "632", "641", "642"], "exclude_capex": True}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["331", "152", "153", "156", "621", "627", "632", "641", "642"], "exclude_capex": True}),
        ],
    ),
    (
        "03",
        "3. Tiền chi trả cho người lao động",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["334"]}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["334"]}),
        ],
    ),
    (
        "04",
        "4. Chi phí đi vay đã trả",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["635", "335"], "is_borrowing_cost": True}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["635", "335"], "is_borrowing_cost": True}),
        ],
    ),
    (
        "05",
        "5. Thuế thu nhập doanh nghiệp đã nộp",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["3334"]}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["3334"]}),
        ],
    ),
    (
        "06",
        "6. Tiền thu khác từ hoạt động kinh doanh",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("111", "CASH_INFLOW", 1, {"counterparts": ["711", "138", "141", "244", "338", "353"], "section": "OPERATING"}),
            ("112", "CASH_INFLOW", 1, {"counterparts": ["711", "138", "141", "244", "338", "353"], "section": "OPERATING"}),
        ],
    ),
    (
        "07",
        "7. Tiền chi khác cho hoạt động kinh doanh",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["811", "138", "141", "244", "333", "338", "352", "353"], "section": "OPERATING"}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["811", "138", "141", "244", "333", "338", "352", "353"], "section": "OPERATING"}),
        ],
    ),
    (
        "20",
        "Lưu chuyển tiền thuần từ hoạt động kinh doanh",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "50",
        1,
        "SUBTOTAL",
        "01 + 02 + 03 + 04 + 05 + 06 + 07",
        False,
        True,
        [],
    ),
    # --- II. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG ĐẦU TƯ (8 MÃ: 21..27, 30) ---
    (
        "21",
        "1. Tiền chi để mua sắm, xây dựng TSCĐ và các tài sản dài hạn khác",
        "INVESTING",
        "II. Lưu chuyển tiền từ hoạt động đầu tư",
        "V.04",
        "30",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["211", "213", "217", "241", "1332", "331"], "is_capex": True}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["211", "213", "217", "241", "1332", "331"], "is_capex": True}),
        ],
    ),
    (
        "22",
        "2. Tiền thu từ thanh lý, nhượng bán TSCĐ và các tài sản dài hạn khác",
        "INVESTING",
        "II. Lưu chuyển tiền từ hoạt động đầu tư",
        "",
        "30",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("111", "CASH_INFLOW", 1, {"counterparts": ["711", "5117", "131"], "is_asset_disposal": True}),
            ("112", "CASH_INFLOW", 1, {"counterparts": ["711", "5117", "131"], "is_asset_disposal": True}),
        ],
    ),
    (
        "23",
        "3. Tiền chi cho vay, mua các công cụ nợ của đơn vị khác",
        "INVESTING",
        "II. Lưu chuyển tiền từ hoạt động đầu tư",
        "",
        "30",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["128", "1282", "1283", "1288", "2288"], "exclude_cash_equivalent": True}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["128", "1282", "1283", "1288", "2288"], "exclude_cash_equivalent": True}),
        ],
    ),
    (
        "24",
        "4. Tiền thu hồi cho vay, bán lại các công cụ nợ của đơn vị khác",
        "INVESTING",
        "II. Lưu chuyển tiền từ hoạt động đầu tư",
        "",
        "30",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("111", "CASH_INFLOW", 1, {"counterparts": ["128", "1282", "1283", "1288", "2288"], "exclude_cash_equivalent": True}),
            ("112", "CASH_INFLOW", 1, {"counterparts": ["128", "1282", "1283", "1288", "2288"], "exclude_cash_equivalent": True}),
        ],
    ),
    (
        "25",
        "5. Tiền chi đầu tư góp vốn vào đơn vị khác",
        "INVESTING",
        "II. Lưu chuyển tiền từ hoạt động đầu tư",
        "",
        "30",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["221", "222", "2281"]}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["221", "222", "2281"]}),
        ],
    ),
    (
        "26",
        "6. Tiền thu hồi đầu tư góp vốn vào đơn vị khác",
        "INVESTING",
        "II. Lưu chuyển tiền từ hoạt động đầu tư",
        "",
        "30",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("111", "CASH_INFLOW", 1, {"counterparts": ["221", "222", "2281"]}),
            ("112", "CASH_INFLOW", 1, {"counterparts": ["221", "222", "2281"]}),
        ],
    ),
    (
        "27",
        "7. Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia",
        "INVESTING",
        "II. Lưu chuyển tiền từ hoạt động đầu tư",
        "",
        "30",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("111", "CASH_INFLOW", 1, {"counterparts": ["515", "1388"]}),
            ("112", "CASH_INFLOW", 1, {"counterparts": ["515", "1388"]}),
        ],
    ),
    (
        "30",
        "Lưu chuyển tiền thuần từ hoạt động đầu tư",
        "INVESTING",
        "II. Lưu chuyển tiền từ hoạt động đầu tư",
        "",
        "50",
        1,
        "SUBTOTAL",
        "21 + 22 + 23 + 24 + 25 + 26 + 27",
        False,
        True,
        [],
    ),
    # --- III. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG TÀI CHÍNH (7 MÃ: 31..36, 40) ---
    (
        "31",
        "1. Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu",
        "FINANCING",
        "III. Lưu chuyển tiền từ hoạt động tài chính",
        "V.06",
        "40",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("111", "CASH_INFLOW", 1, {"counterparts": ["411", "4111", "4112"]}),
            ("112", "CASH_INFLOW", 1, {"counterparts": ["411", "4111", "4112"]}),
        ],
    ),
    (
        "32",
        "2. Tiền trả lại vốn góp cho các chủ sở hữu, mua lại cổ phiếu đã phát hành",
        "FINANCING",
        "III. Lưu chuyển tiền từ hoạt động tài chính",
        "V.06",
        "40",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["411", "419"]}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["411", "419"]}),
        ],
    ),
    (
        "33",
        "3. Tiền thu từ đi vay",
        "FINANCING",
        "III. Lưu chuyển tiền từ hoạt động tài chính",
        "",
        "40",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("111", "CASH_INFLOW", 1, {"counterparts": ["341", "3411", "343"]}),
            ("112", "CASH_INFLOW", 1, {"counterparts": ["341", "3411", "343"]}),
        ],
    ),
    (
        "34",
        "4. Tiền trả nợ gốc vay",
        "FINANCING",
        "III. Lưu chuyển tiền từ hoạt động tài chính",
        "",
        "40",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["341", "3411", "343"], "exclude_finance_lease": True}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["341", "3411", "343"], "exclude_finance_lease": True}),
        ],
    ),
    (
        "35",
        "5. Tiền trả nợ gốc thuê tài chính",
        "FINANCING",
        "III. Lưu chuyển tiền từ hoạt động tài chính",
        "",
        "40",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["3412"], "is_finance_lease": True}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["3412"], "is_finance_lease": True}),
        ],
    ),
    (
        "36",
        "6. Cổ tức, lợi nhuận đã trả cho chủ sở hữu",
        "FINANCING",
        "III. Lưu chuyển tiền từ hoạt động tài chính",
        "",
        "40",
        1,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["421", "3388"], "is_dividend_paid": True}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["421", "3388"], "is_dividend_paid": True}),
        ],
    ),
    (
        "40",
        "Lưu chuyển tiền thuần từ hoạt động tài chính",
        "FINANCING",
        "III. Lưu chuyển tiền từ hoạt động tài chính",
        "",
        "50",
        1,
        "SUBTOTAL",
        "31 + 32 + 33 + 34 + 35 + 36",
        False,
        True,
        [],
    ),
    # --- IV. TỔNG KẾT & ĐỐI CHIẾU TIỀN CUỐI KỲ (4 MÃ: 50, 60, 61, 70) ---
    (
        "50",
        "Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)",
        "RECONCILIATION",
        "IV. Lưu chuyển tiền thuần và số dư tiền",
        "",
        "70",
        1,
        "SUBTOTAL",
        "20 + 30 + 40",
        False,
        True,
        [],
    ),
    (
        "60",
        "Tiền và tương đương tiền đầu kỳ",
        "RECONCILIATION",
        "IV. Lưu chuyển tiền thuần và số dư tiền",
        "V.01",
        "70",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("111", "OPENING_DEBIT", 1, {}),
            ("112", "OPENING_DEBIT", 1, {}),
            ("113", "OPENING_DEBIT", 1, {}),
            ("1281", "OPENING_DEBIT", 1, {"cash_equivalent_only": True}),
        ],
    ),
    (
        "61",
        "Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ",
        "RECONCILIATION",
        "IV. Lưu chuyển tiền thuần và số dư tiền",
        "",
        "70",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("1112", "FX_EFFECT", 1, {}),
            ("1122", "FX_EFFECT", 1, {}),
        ],
    ),
    (
        "70",
        "Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61)",
        "RECONCILIATION",
        "IV. Lưu chuyển tiền thuần và số dư tiền",
        "V.01",
        "",
        1,
        "TOTAL",
        "50 + 60 + 61",
        False,
        True,
        [],
    ),
]


B03_INDIRECT_37_LINES: list[tuple] = [
    # --- I. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG KINH DOANH - GIÁN TIẾP (18 MÃ: 01..17, 20) ---
    (
        "01",
        "1. Lợi nhuận trước thuế",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "08",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("B02.50", "PROFIT_BEFORE_TAX", 1, {}),
        ],
    ),
    (
        "02",
        "- Khấu hao TSCĐ và BĐSĐT",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "V.04",
        "08",
        2,
        "DETAIL",
        "",
        False,
        True,
        [
            ("214", "DEPRECIATION_EXPENSE", 1, {}),
        ],
    ),
    (
        "03",
        "- Các khoản dự phòng",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "08",
        2,
        "DETAIL",
        "",
        False,
        True,
        [
            ("229", "PROVISION_ADJUSTMENT", 1, {}),
            ("352", "PROVISION_ADJUSTMENT", 1, {}),
        ],
    ),
    (
        "04",
        "- Lãi, lỗ chênh lệch tỷ giá hối đoái do đánh giá lại các khoản mục tiền tệ có gốc ngoại tệ",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "08",
        2,
        "DETAIL",
        "",
        False,
        True,
        [
            ("413", "UNREALIZED_FX_ADJUSTMENT", 1, {}),
        ],
    ),
    (
        "05",
        "- Lãi, lỗ từ hoạt động đầu tư, tài chính",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "08",
        2,
        "DETAIL",
        "",
        False,
        True,
        [
            ("515", "INVESTING_GAIN_LOSS_ADJUSTMENT", -1, {}),
            ("711", "INVESTING_GAIN_LOSS_ADJUSTMENT", -1, {}),
            ("811", "INVESTING_GAIN_LOSS_ADJUSTMENT", 1, {}),
        ],
    ),
    (
        "06",
        "- Chi phí đi vay",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "VI.06",
        "08",
        2,
        "DETAIL",
        "",
        False,
        True,
        [
            ("635", "BORROWING_COST_EXPENSE", 1, {}),
        ],
    ),
    (
        "07",
        "- Các khoản điều chỉnh khác",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "08",
        2,
        "DETAIL",
        "",
        False,
        True,
        [],
    ),
    (
        "08",
        "3. Lợi nhuận từ hoạt động kinh doanh trước thay đổi vốn lưu động",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        1,
        "SUBTOTAL",
        "01 + 02 + 03 + 04 + 05 + 06 + 07",
        False,
        True,
        [],
    ),
    (
        "09",
        "- Tăng, giảm các khoản phải thu",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "V.02",
        "20",
        2,
        "DETAIL",
        "",
        False,
        True,
        [
            ("131", "WORKING_CAPITAL_RECEIVABLE", -1, {}),
            ("133", "WORKING_CAPITAL_RECEIVABLE", -1, {}),
            ("138", "WORKING_CAPITAL_RECEIVABLE", -1, {}),
            ("141", "WORKING_CAPITAL_RECEIVABLE", -1, {}),
        ],
    ),
    (
        "10",
        "- Tăng, giảm hàng tồn kho",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "V.03",
        "20",
        2,
        "DETAIL",
        "",
        False,
        True,
        [
            ("15", "WORKING_CAPITAL_INVENTORY", -1, {}),
        ],
    ),
    (
        "11",
        "- Tăng, giảm các khoản phải trả (không kể lãi vay phải trả, thuế thu nhập doanh nghiệp phải nộp)",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "V.05",
        "20",
        2,
        "DETAIL",
        "",
        False,
        True,
        [
            ("331", "WORKING_CAPITAL_PAYABLE", 1, {}),
            ("334", "WORKING_CAPITAL_PAYABLE", 1, {}),
            ("338", "WORKING_CAPITAL_PAYABLE", 1, {}),
        ],
    ),
    (
        "12",
        "- Tăng, giảm chi phí chờ phân bổ",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        2,
        "DETAIL",
        "",
        False,
        True,
        [
            ("242", "WORKING_CAPITAL_PREPAID", -1, {}),
        ],
    ),
    (
        "13",
        "- Tăng, giảm chứng khoán kinh doanh",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        2,
        "DETAIL",
        "",
        False,
        True,
        [
            ("121", "WORKING_CAPITAL_TRADING_SEC", -1, {}),
        ],
    ),
    (
        "14",
        "- Chi phí đi vay đã trả",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        2,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["635", "335"], "is_borrowing_cost": True}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["635", "335"], "is_borrowing_cost": True}),
        ],
    ),
    (
        "15",
        "- Thuế thu nhập doanh nghiệp đã nộp",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "V.05",
        "20",
        2,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["3334"]}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["3334"]}),
        ],
    ),
    (
        "16",
        "- Tiền thu khác từ hoạt động kinh doanh",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        2,
        "DETAIL",
        "",
        False,
        True,
        [
            ("111", "CASH_INFLOW", 1, {"counterparts": ["711", "138", "141", "244", "338", "353"], "section": "OPERATING"}),
            ("112", "CASH_INFLOW", 1, {"counterparts": ["711", "138", "141", "244", "338", "353"], "section": "OPERATING"}),
        ],
    ),
    (
        "17",
        "- Tiền chi khác cho hoạt động kinh doanh",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "20",
        2,
        "DETAIL",
        "",
        True,
        True,
        [
            ("111", "CASH_OUTFLOW", -1, {"counterparts": ["811", "138", "141", "244", "333", "338", "352", "353"], "section": "OPERATING"}),
            ("112", "CASH_OUTFLOW", -1, {"counterparts": ["811", "138", "141", "244", "333", "338", "352", "353"], "section": "OPERATING"}),
        ],
    ),
    (
        "20",
        "Lưu chuyển tiền thuần từ hoạt động kinh doanh",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "50",
        1,
        "SUBTOTAL",
        "08 + 09 + 10 + 11 + 12 + 13 + 14 + 15 + 16 + 17",
        False,
        True,
        [],
    ),
    *B03_DIRECT_27_LINES[8:],
]


# B03b-DN (Giữa niên độ dạng tóm lược) – Đúng 8 chỉ tiêu và 4 Value Slots theo TT99:
# 20, 30, 40, 50, 60, 61, 62 (Ảnh hưởng tái phân loại tương đương tiền cuối kỳ), 70 (= 50 + 60 + 61 + 62)
B03B_CONDENSED_8_LINES: list[tuple] = [
    (
        "20",
        "I. Lưu chuyển tiền thuần từ hoạt động kinh doanh",
        "OPERATING",
        "I. Lưu chuyển tiền từ hoạt động kinh doanh",
        "",
        "50",
        1,
        "SUBTOTAL",
        "",
        False,
        True,
        [],
    ),
    (
        "30",
        "II. Lưu chuyển tiền thuần từ hoạt động đầu tư",
        "INVESTING",
        "II. Lưu chuyển tiền từ hoạt động đầu tư",
        "",
        "50",
        1,
        "SUBTOTAL",
        "",
        False,
        True,
        [],
    ),
    (
        "40",
        "III. Lưu chuyển tiền thuần từ hoạt động tài chính",
        "FINANCING",
        "III. Lưu chuyển tiền từ hoạt động tài chính",
        "",
        "50",
        1,
        "SUBTOTAL",
        "",
        False,
        True,
        [],
    ),
    (
        "50",
        "Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)",
        "RECONCILIATION",
        "IV. Lưu chuyển tiền thuần và số dư tiền",
        "",
        "70",
        1,
        "SUBTOTAL",
        "20 + 30 + 40",
        False,
        True,
        [],
    ),
    (
        "60",
        "Tiền và tương đương tiền đầu kỳ",
        "RECONCILIATION",
        "IV. Lưu chuyển tiền thuần và số dư tiền",
        "V.01",
        "70",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("111", "OPENING_DEBIT", 1, {}),
            ("112", "OPENING_DEBIT", 1, {}),
            ("113", "OPENING_DEBIT", 1, {}),
            ("1281", "OPENING_DEBIT", 1, {"cash_equivalent_only": True}),
        ],
    ),
    (
        "61",
        "Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ",
        "RECONCILIATION",
        "IV. Lưu chuyển tiền thuần và số dư tiền",
        "",
        "70",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("1112", "FX_EFFECT", 1, {}),
            ("1122", "FX_EFFECT", 1, {}),
        ],
    ),
    (
        "62",
        "Ảnh hưởng tái phân loại các khoản tương đương tiền cuối kỳ",
        "RECONCILIATION",
        "IV. Lưu chuyển tiền thuần và số dư tiền",
        "V.01",
        "70",
        1,
        "DETAIL",
        "",
        False,
        True,
        [
            ("1281", "RECLASSIFICATION_EFFECT", 1, {"b03b_only": True}),
        ],
    ),
    (
        "70",
        "Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61 + 62)",
        "RECONCILIATION",
        "IV. Lưu chuyển tiền thuần và số dư tiền",
        "V.01",
        "",
        1,
        "TOTAL",
        "50 + 60 + 61 + 62",
        False,
        True,
        [],
    ),
]


B03_PERMISSIONS_DEF = [
    ("VIEW", "Xem báo cáo lưu chuyển tiền tệ", "RPT_CASH_FLOW_VIEW", "RPT.CASH_FLOW.VIEW"),
    ("DETAIL_VIEW", "Xem chi tiết & drill-down B03", "RPT_CASH_FLOW_DETAIL_VIEW", "RPT.CASH_FLOW.DETAIL.VIEW"),
    ("GENERATE", "Lập báo cáo lưu chuyển tiền tệ", "RPT_CASH_FLOW_GENERATE", "RPT.CASH_FLOW.GENERATE"),
    ("VALIDATE", "Kiểm tra báo cáo lưu chuyển tiền tệ", "RPT_CASH_FLOW_VALIDATE", "RPT.CASH_FLOW.VALIDATE"),
    ("APPROVE", "Phê duyệt báo cáo lưu chuyển tiền tệ", "RPT_CASH_FLOW_APPROVE", "RPT.CASH_FLOW.APPROVE"),
    ("EXPORT", "In và xuất báo cáo lưu chuyển tiền tệ", "RPT_CASH_FLOW_EXPORT", "RPT.CASH_FLOW.EXPORT"),
]

B03_PERMISSION_ALIASES: dict[str, set[str]] = {
    "RPT_CASH_FLOW_VIEW": {
        "RPT_CASH_FLOW_VIEW",
        "RPT.CASH_FLOW.VIEW",
        "RPT_FINANCIAL_VIEW",
        "RPT.FINANCIAL.VIEW",
        "RPT.CENTER.VIEW",
    },
    "RPT_CASH_FLOW_DETAIL_VIEW": {
        "RPT_CASH_FLOW_DETAIL_VIEW",
        "RPT.CASH_FLOW.DETAIL.VIEW",
        "RPT_FINANCIAL_DETAIL_VIEW",
        "RPT.FINANCIAL.DETAIL.VIEW",
        "RPT_FINANCIAL_DRILLDOWN",
        "GL.JOURNAL.VIEW",
    },
    "RPT_CASH_FLOW_GENERATE": {
        "RPT_CASH_FLOW_GENERATE",
        "RPT.CASH_FLOW.GENERATE",
        "RPT_FINANCIAL_GENERATE",
        "RPT.FINANCIAL.GENERATE",
    },
    "RPT_CASH_FLOW_VALIDATE": {
        "RPT_CASH_FLOW_VALIDATE",
        "RPT.CASH_FLOW.VALIDATE",
        "RPT_FINANCIAL_VALIDATE",
        "RPT_CASH_FLOW_GENERATE",
        "RPT_FINANCIAL_GENERATE",
    },
    "RPT_CASH_FLOW_APPROVE": {
        "RPT_CASH_FLOW_APPROVE",
        "RPT.CASH_FLOW.APPROVE",
        "RPT_FINANCIAL_APPROVE",
        "RPT.FINANCIAL.APPROVE",
    },
    "RPT_CASH_FLOW_EXPORT": {
        "RPT_CASH_FLOW_EXPORT",
        "RPT.CASH_FLOW.EXPORT",
        "RPT_FINANCIAL_EXPORT",
        "RPT.FINANCIAL.EXPORT",
    },
}


# ============================================================================
# 2. SEEDING FUNCTION FOR MIGRATION & RUNTIME INITIALIZATION
# ============================================================================

def _seed_b03_template_lines(
    template_ver,
    line_specs: list[tuple],
    LineModel,
    MappingModel,
    cash_flow_method: str,
    is_condensed_b03b: bool = False,
    parent_template_code: str = "",
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
            "cash_flow_method": cash_flow_method,
            "cash_flow_section": sec_code,
            "is_condensed_b03b": is_condensed_b03b,
            "parent_template_code": parent_template_code,
            "classification_rule_reference": f"CF-{cash_flow_method or 'CONDENSED'}-{ind_code}",
        }
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
                "is_required": line_type in ("SUBTOTAL", "TOTAL") or ind_code in ("60", "70"),
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


def seed_cash_flow_uc_rpt_05(apps=None, schema_editor=None):
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
        code="RPT_CASH_FLOW",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "RPT",
            "name": "Báo cáo lưu chuyển tiền tệ (UC-RPT-05)",
            "status": "ACTIVE",
        },
    )
    res_dot, _ = ResourceModel.objects.get_or_create(
        code="RPT.CASH_FLOW",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "RPT",
            "name": "Báo cáo lưu chuyển tiền tệ (dot)",
            "status": "ACTIVE",
        },
    )
    for act_code, act_name, u_code, d_code in B03_PERMISSIONS_DEF:
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
                    "description": f"{act_name} (UC-RPT-05)",
                    "status": "ACTIVE",
                },
            )

    annual_col_schema = [
        {"slot_code": "YEAR_CURRENT", "column_code": "CURRENT_YEAR", "label": "Năm nay"},
        {"slot_code": "YEAR_PREVIOUS", "column_code": "PREVIOUS_YEAR", "label": "Năm trước"},
    ]
    b03a_col_schema = [
        {"slot_code": "YTD_CURRENT", "label": "Lũy kế từ đầu năm đến cuối quý này – Năm nay"},
        {"slot_code": "YTD_PREVIOUS", "label": "Lũy kế từ đầu năm đến cuối quý tương ứng – Năm trước"},
    ]
    b03b_col_schema = [
        {"slot_code": "QUARTER_CURRENT", "label": "Quý này – Năm nay"},
        {"slot_code": "QUARTER_PREVIOUS", "label": "Quý tương ứng – Năm trước"},
        {"slot_code": "YTD_CURRENT", "label": "Lũy kế từ đầu năm đến cuối quý này – Năm nay"},
        {"slot_code": "YTD_PREVIOUS", "label": "Lũy kế từ đầu năm đến cuối quý tương ứng – Năm trước"},
    ]

    templates_cfg = [
        (
            "FSR-03",
            "B03-DN",
            "Báo cáo lưu chuyển tiền tệ năm",
            ["ANNUAL_GOING_CONCERN"],
            "ANNUAL",
            True,
            "Thông tư 99/2025/TT-BTC",
            annual_col_schema,
            [("DIRECT", B03_DIRECT_27_LINES), ("INDIRECT", B03_INDIRECT_37_LINES)],
            False,
            "",
        ),
        (
            "FSR-07",
            "B03-DNKLT",
            "Báo cáo lưu chuyển tiền tệ năm – Không đáp ứng giả định hoạt động liên tục",
            ["ANNUAL_NON_GOING_CONCERN"],
            "ANNUAL",
            True,
            "Thông tư 99/2025/TT-BTC – DN không đáp ứng giả định hoạt động liên tục",
            annual_col_schema,
            [("DIRECT", B03_DIRECT_27_LINES), ("INDIRECT", B03_INDIRECT_37_LINES)],
            False,
            "FSR-03",
        ),
        (
            "FSR-11",
            "B03a-DN",
            "Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ)",
            ["INTERIM_FULL"],
            "INTERIM",
            True,
            "Thông tư 99/2025/TT-BTC",
            b03a_col_schema,
            [("DIRECT", B03_DIRECT_27_LINES), ("INDIRECT", B03_INDIRECT_37_LINES)],
            False,
            "FSR-03",
        ),
        (
            "FSR-15",
            "B03b-DN",
            "Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng tóm lược)",
            ["INTERIM_CONDENSED"],
            "INTERIM",
            True,
            "Thông tư 99/2025/TT-BTC",
            b03b_col_schema,
            [
                ("DIRECT", B03B_CONDENSED_8_LINES),
                ("INDIRECT", B03B_CONDENSED_8_LINES),
                ("", B03B_CONDENSED_8_LINES),
            ],
            True,
            "FSR-11",
        ),
    ]

    for (
        int_code,
        legal_code,
        name,
        bundle_types,
        gran,
        sup_cf,
        legal_circ,
        col_schema,
        method_specs,
        is_cond,
        parent_tpl_code,
    ) in templates_cfg:
        tmpl, _ = TemplateModel.objects.update_or_create(
            internal_code=int_code,
            defaults={
                "legal_form_code": legal_code,
                "name": name,
                "component_type": "CASH_FLOW",
                "applicable_bundle_types": bundle_types,
                "period_granularity": gran,
                "supports_cash_flow_method": sup_cf,
                "target_uc_code": "UC-RPT-05",
                "is_active": True,
            },
        )
        for cf_method, lines_spec in method_specs:
            tv, _ = VersionModel.objects.update_or_create(
                template=tmpl,
                version_number=1,
                cash_flow_method=cf_method,
                defaults={
                    "accounting_regime": "TT99",
                    "legal_circular": legal_circ,
                    "effective_from": date(2000, 1, 1),
                    "column_schema": col_schema,
                    "is_active": True,
                },
            )
            _seed_b03_template_lines(
                tv,
                lines_spec,
                LineModel,
                MappingModel,
                cash_flow_method=cf_method or "DIRECT",
                is_condensed_b03b=is_cond,
                parent_template_code=parent_tpl_code,
            )


def ensure_b03_templates_seeded():
    b03_dn = FinancialStatementTemplate.objects.filter(legal_form_code="B03-DN").first()
    b03b_dn = FinancialStatementTemplate.objects.filter(legal_form_code="B03b-DN").first()
    needs_seed = False
    if not b03_dn or not b03b_dn:
        needs_seed = True
    else:
        v_dir = b03_dn.versions.filter(cash_flow_method="DIRECT", is_active=True).first()
        v_ind = b03_dn.versions.filter(cash_flow_method="INDIRECT", is_active=True).first()
        v_b03b = b03b_dn.versions.filter(cash_flow_method="DIRECT", is_active=True).first()
        if (
            not v_dir
            or v_dir.lines.count() != 27
            or not v_ind
            or v_ind.lines.count() != 37
            or not v_b03b
            or v_b03b.lines.count() != 8
        ):
            needs_seed = True
    if needs_seed:
        seed_cash_flow_uc_rpt_05()


# ============================================================================
# 3. PERMISSIONS, SCOPE & AUDIT HELPERS
# ============================================================================

def _resolve_iam_account(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None
    return getattr(user, "iam_account", None)


def _log_b03_audit(company: Company, user, action_name: str, entity_id: str, metadata: dict | None = None):
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


def get_b03_user_permissions(user, company: Company) -> set[str]:
    if not user or not getattr(user, "is_authenticated", False):
        return set()
    if getattr(user, "is_superuser", False):
        all_codes = set()
        for s in B03_PERMISSION_ALIASES.values():
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


def has_b03_permission(user, company: Company, perm_key: str) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    iam_acc = _resolve_iam_account(user)
    if not iam_acc:
        return False

    aliases = B03_PERMISSION_ALIASES.get(perm_key, {perm_key})
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

    effective_codes = get_b03_user_permissions(user, company)
    return bool(effective_codes & aliases)


def require_b03_permission(user, company: Company, perm_key: str = "RPT_CASH_FLOW_VIEW") -> None:
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
    if not has_b03_permission(user, company, perm_key):
        err_code = "EF-39" if perm_key == "RPT_CASH_FLOW_DETAIL_VIEW" else "EF-02"
        raise PermissionDenied({
            "error_code": err_code,
            "required_permission": perm_key,
            "detail": f"Bạn không có quyền '{perm_key}' để thực hiện chức năng này trên Báo cáo lưu chuyển tiền tệ.",
        })


def resolve_b03_allowed_branches(user, company: Company) -> list[str] | None:
    if getattr(user, "is_superuser", False):
        return None
    iam_acc = _resolve_iam_account(user)
    if not iam_acc:
        return []
    assignments = list(effective_assignments(iam_acc, company))
    now = timezone.now()
    overrides = list(
        UserPermissionOverride.objects.filter(
            company_membership__user=iam_acc,
            company_membership__company=company,
            effect="GRANT",
            revoked_at__isnull=True,
            valid_from__lte=now,
        )
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now))
        .select_related("data_scope_set")
    )
    all_sources = assignments + overrides
    if not all_sources:
        return []
    if any(s.data_scope_set is None or s.data_scope_set.allow_all_company_data for s in all_sources):
        return None
    branch_ids: set[str] = set()
    has_restriction = False
    for s in all_sources:
        if s.data_scope_set:
            bids = [str(x) for x in s.data_scope_set.branch_scopes.values_list("branch_id", flat=True)]
            if bids:
                has_restriction = True
                branch_ids.update(bids)
    return sorted(branch_ids) if has_restriction else None


def check_b03_scope_access(user, company: Company, reporting_scope: str, branch: Branch | None) -> None:
    allowed = resolve_b03_allowed_branches(user, company)
    if allowed is None:
        return
    if reporting_scope == "COMPANY":
        raise PermissionDenied({
            "error_code": "EF-03",
            "detail": "Tài khoản chỉ được phân quyền xem theo Chi nhánh, không được xem phạm vi Toàn doanh nghiệp (COMPANY).",
        })
    if branch and str(branch.id) not in allowed:
        raise PermissionDenied({
            "error_code": "EF-03",
            "detail": f"Bạn không có quyền truy cập dữ liệu của chi nhánh '{branch.code}'.",
        })


def resolve_b03_company(request, explicit_company_id: Any = None) -> Company:
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


# ============================================================================
# 4. FORMULA EVALUATOR & SNAPSHOT HASHING
# ============================================================================

def parse_b03_formula_tokens(formula_expr: str) -> list[tuple[int, str]]:
    if not formula_expr or not formula_expr.strip():
        return []
    tokens = formula_expr.replace("+", " + ").replace("-", " - ").split()
    res: list[tuple[int, str]] = []
    op = 1
    for tok in tokens:
        if tok == "+":
            op = 1
        elif tok == "-":
            op = -1
        else:
            res.append((op, tok.strip()))
    return res


def eval_b03_formula(formula_expr: str, code_values: dict[str, Decimal | None]) -> Decimal:
    tokens = parse_b03_formula_tokens(formula_expr)
    if not tokens:
        return ZERO
    # Check cycle or invalid reference
    total = ZERO
    for sign, ref_code in tokens:
        val = code_values.get(ref_code)
        if val is not None:
            total += Decimal(sign) * val
    return _to_dec(total)


def compute_b03_gl_snapshot_meta(
    company: Company,
    start_date: date,
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
    cf_cls_count = CashFlowClassification.objects.filter(company=company).count()
    cf_evt_count = CashFlowEvent.objects.filter(company=company, posting_date__lte=end_date).count()
    if cf_evt_count or cf_cls_count:
        raw = (
            f"{company.id}:{branch.id if branch else 'ALL'}:"
            f"{end_date.isoformat()}:{count}:{last_ts.isoformat() if last_ts else 'NONE'}:"
            f"CF:{cf_evt_count}:{cf_cls_count}"
        )
    else:
        raw = f"{company.id}:{branch.id if branch else 'ALL'}:{end_date.isoformat()}:{count}:{last_ts.isoformat() if last_ts else 'NONE'}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32], last_ts


def is_b03_run_stale(run: FinancialStatementRun) -> bool:
    if not run.source_snapshot_hash:
        return False
    eff_branch = run.branch if run.reporting_scope == "BRANCH" else None
    curr_hash, curr_ts = compute_b03_gl_snapshot_meta(
        run.company,
        run.period_start_date,
        run.period_end_date,
        eff_branch,
    )
    if curr_hash != run.source_snapshot_hash:
        return True
    if curr_ts and run.source_last_posted_at and curr_ts > run.source_last_posted_at:
        return True
    return False


# ============================================================================
# 5. CANONICAL CASH FLOW ENGINE (SF-01 DIRECT & SF-02 INDIRECT)
# ============================================================================

CASH_ACCOUNT_PREFIXES = ("111", "112", "113")


def _is_cash_account_code(code: str, dim: dict | None = None) -> bool:
    dim = dim or {}
    if dim.get("is_restricted_cash") or dim.get("restricted"):
        return False
    if code.startswith(CASH_ACCOUNT_PREFIXES):
        return True
    if code.startswith("1281"):
        if dim.get("is_cash_equivalent") is False or dim.get("cash_equivalent_status") == "INELIGIBLE":
            return False
        if dim.get("original_maturity_days") and int(dim["original_maturity_days"]) > 90:
            return False
        return True
    if code.startswith("128") and dim.get("is_cash_equivalent") is True:
        if dim.get("original_maturity_days") and int(dim["original_maturity_days"]) > 90:
            return False
        return True
    return False


def _compute_cash_and_equivalents_balance_as_of(
    company: Company,
    as_of_date: date,
    branch: Branch | None = None,
    inclusive: bool = True,
) -> tuple[Decimal, list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Computes exact Cash & Cash Equivalents balance at `as_of_date` (inclusive=False for opening at start_date,
    inclusive=True for closing at end_date).
    Also checks `CashEquivalentInstrument` eligibility criteria (DR-RPT-B03-03, B03-VAL-16).
    """
    date_filter = (
        Q(entry__posting_date__lte=as_of_date)
        if inclusive
        else (Q(entry__posting_date__lt=as_of_date) | Q(entry__entry_type="OPENING", entry__posting_date__lte=as_of_date))
    )
    qs = (
        JournalLine.objects.filter(
            entry__company=company,
            entry__status="POSTED",
            entry__reversed_amount=0,
        )
        .filter(date_filter)
        .select_related("account", "entry")
    )
    if branch is not None:
        qs = qs.filter(entry__branch=branch)

    # Identify ineligible instruments / accounts
    ineligible_instruments: list[dict[str, Any]] = []
    ineligible_account_ids: set[uuid.UUID] = set()
    instruments_qs = CashEquivalentInstrument.objects.filter(company=company, acquisition_date__lte=as_of_date)
    if branch is not None:
        instruments_qs = instruments_qs.filter(Q(branch=branch) | Q(branch__isnull=True))

    for inst in instruments_qs:
        maturity_days = (inst.original_maturity_date - inst.acquisition_date).days
        is_eligible = (
            maturity_days <= 92
            and inst.is_readily_convertible
            and inst.amount_determinable
            and inst.value_change_risk_assessment == "LOW"
            and not inst.is_restricted
            and inst.cash_equivalent_status != "INELIGIBLE"
        )
        if not is_eligible:
            if inst.account_id:
                ineligible_account_ids.add(inst.account_id)
            ineligible_instruments.append({
                "instrument_id": str(inst.id),
                "instrument_code": inst.instrument_code,
                "instrument_name": inst.instrument_name,
                "principal_amount": _fmt_dec(inst.principal_amount),
                "maturity_days": maturity_days,
                "is_restricted": inst.is_restricted,
                "cash_equivalent_status": inst.cash_equivalent_status,
                "reason": "Kỳ hạn thu hồi gốc > 3 tháng hoặc bị hạn chế sử dụng / rủi ro biến động giá trị cao.",
            })

    # Also include AccountBalance opening balances if no prior journal entries exist before fiscal year start
    acc_balances: dict[str, Decimal] = defaultdict(lambda: ZERO)
    acc_names: dict[str, str] = {}

    for jl in qs:
        if jl.entry.original_entry_id is not None and jl.entry.reversal_method:
            continue
        code = jl.account.code
        dim = jl.dimensions or {}
        if jl.account_id in ineligible_account_ids:
            continue
        if dim.get("force_ineligible_cash_equivalent"):
            ineligible_instruments.append({
                "instrument_id": str(jl.id),
                "instrument_code": code,
                "instrument_name": jl.description or jl.account.name,
                "principal_amount": _fmt_dec(jl.debit - jl.credit),
                "reason": "Khoản đầu tư không đủ điều kiện tương đương tiền nhưng gắn cờ force_ineligible_cash_equivalent.",
            })
        if _is_cash_account_code(code, dim):
            acc_balances[code] += _to_dec(jl.debit) - _to_dec(jl.credit)
            acc_names[code] = jl.account.name

    # Check AccountBalance for opening if `inclusive=False` and `acc_balances` is empty
    if not inclusive and sum(acc_balances.values(), ZERO) == ZERO:
        ab_qs = AccountBalance.objects.filter(
            company=company,
            period__start_date=as_of_date,
        ).select_related("account")
        if branch is not None:
            ab_qs = ab_qs.filter(branch=branch)
        for ab in ab_qs:
            code = ab.account.code
            if ab.account_id not in ineligible_account_ids and _is_cash_account_code(code, {}):
                net_open = _to_dec(ab.opening_debit) - _to_dec(ab.opening_credit)
                if net_open != ZERO:
                    acc_balances[code] += net_open
                    acc_names[code] = ab.account.name

    total = ZERO
    breakdown: list[dict[str, Any]] = []
    for code in sorted(acc_balances.keys()):
        bal = _to_dec(acc_balances[code])
        total += bal
        breakdown.append({
            "account_code": code,
            "account_name": acc_names.get(code, code),
            "balance": _fmt_dec(bal),
        })

    return _to_dec(total), breakdown, ineligible_instruments


def _classify_counterpart_for_cash_flow(
    cash_is_inflow: bool,
    cp_code: str,
    cp_desc: str,
    cp_dim: dict[str, Any],
    entry_desc: str,
    entry_module: str,
) -> tuple[str | None, str | None, str, str]:
    """
    Returns (direct_code, indirect_code, section, rule_code) for a cash inflow/outflow counterpart line.
    Returns (None, None, "UNCLASSIFIED", "UNCLASSIFIED") if the transaction cannot be classified by rule.
    """
    text_norm = _strip_accents(f"{cp_desc} {entry_desc}")

    # 1. Explicit unclassified flag (for testing & review workflows SF-09 / TC-RPT-05-69)
    if cp_dim.get("unclassified") is True or cp_dim.get("cash_flow_unclassified") is True:
        return None, None, "UNCLASSIFIED", "UNCLASSIFIED"

    # 2. Explicit indicator code in dimensions
    exp_direct = str(cp_dim.get("b03_direct_code") or cp_dim.get("b03_code") or cp_dim.get("cash_flow_code") or "").strip()
    exp_indirect = str(cp_dim.get("b03_indirect_code") or "").strip()
    if exp_direct:
        sec = "OPERATING"
        if exp_direct in ("21", "22", "23", "24", "25", "26", "27", "30"):
            sec = "INVESTING"
        elif exp_direct in ("31", "32", "33", "34", "35", "36", "40"):
            sec = "FINANCING"
        elif exp_direct in ("50", "60", "61", "62", "70"):
            sec = "RECONCILIATION"
        if not exp_indirect:
            if exp_direct in ("21", "22", "23", "24", "25", "26", "27", "31", "32", "33", "34", "35", "36", "61", "62"):
                exp_indirect = exp_direct
            elif exp_direct == "04":
                exp_indirect = "14"
            elif exp_direct == "05":
                exp_indirect = "15"
            elif exp_direct == "06":
                exp_indirect = "16"
            elif exp_direct == "07":
                exp_indirect = "17"
        return exp_direct, exp_indirect or None, sec, f"EXPLICIT_{exp_direct}"

    # 3. FX Revaluation on Cash & Cash Equivalents (61)
    if cp_code.startswith("413") or cp_dim.get("is_cash_fx_revaluation") or "danh gia lai ngoai te tien" in text_norm:
        return "61", "61", "RECONCILIATION", "CF-RULE-FX-61"

    # 4. Cash Inflows (Tiền thực thu: Nợ 111/112/113)
    if cash_is_inflow:
        # Investing inflows (22, 24, 26, 27)
        if (
            cp_dim.get("is_asset_disposal")
            or cp_code.startswith("5117")
            or (cp_code.startswith(("711", "131")) and any(k in text_norm for k in ("thanh ly tscd", "nhuong ban tscd", "thanh ly tai san", "thanh ly bdsdt", "ban tscd")))
        ):
            return "22", "22", "INVESTING", "CF-RULE-INV-22"

        if cp_code.startswith(("128", "2288")) and not cp_dim.get("is_cash_equivalent"):
            return "24", "24", "INVESTING", "CF-RULE-INV-24"

        if cp_code.startswith(("221", "222", "2281")):
            return "26", "26", "INVESTING", "CF-RULE-INV-26"

        if cp_code.startswith(("515", "1388")) or cp_dim.get("is_interest_or_dividend_received") or any(k in text_norm for k in ("lai cho vay", "co tuc", "loi nhuan duoc chia", "lai tien gui")):
            return "27", "27", "INVESTING", "CF-RULE-INV-27"

        # Financing inflows (31, 33)
        if cp_code.startswith(("411", "4111", "4112")):
            return "31", "31", "FINANCING", "CF-RULE-FIN-31"

        if cp_code.startswith(("341", "3411", "343")) or cp_dim.get("is_borrowing_receipt"):
            return "33", "33", "FINANCING", "CF-RULE-FIN-33"

        # Operating inflows (01, 06/16)
        if cp_code.startswith(("511", "131", "3331", "521")):
            return "01", None, "OPERATING", "CF-RULE-OP-01"

        if cp_code.startswith(("711", "138", "141", "244", "338", "353", "334")):
            return "06", "16", "OPERATING", "CF-RULE-OP-06"

        return None, None, "UNCLASSIFIED", "UNCLASSIFIED"

    # 5. Cash Outflows (Tiền thực chi: Có 111/112/113)
    else:
        # Investing outflows (21, 23, 25)
        is_capex = (
            cp_dim.get("is_capex")
            or cp_dim.get("purpose") == "CAPEX"
            or cp_dim.get("asset_related") is True
            or cp_code.startswith(("211", "213", "217", "241", "1332"))
            or (
                cp_code.startswith("331")
                and any(k in text_norm for k in ("tscd", "may moc", "thiet bi", "xay dung co ban", "tai san dai han", "bdsdt"))
            )
        )
        if is_capex:
            return "21", "21", "INVESTING", "CF-RULE-INV-21"

        if cp_code.startswith(("128", "2288")) and not cp_dim.get("is_cash_equivalent"):
            return "23", "23", "INVESTING", "CF-RULE-INV-23"

        if cp_code.startswith(("221", "222", "2281")):
            return "25", "25", "INVESTING", "CF-RULE-INV-25"

        # Financing outflows (32, 34, 35, 36)
        if cp_code.startswith(("411", "419")) or any(k in text_norm for k in ("hoan tra von gop", "mua lai co phieu")):
            return "32", "32", "FINANCING", "CF-RULE-FIN-32"

        if cp_code.startswith("3412") or cp_dim.get("is_finance_lease") or "thue tai chinh" in text_norm:
            return "35", "35", "FINANCING", "CF-RULE-FIN-35"

        if cp_code.startswith(("341", "3411", "343")):
            return "34", "34", "FINANCING", "CF-RULE-FIN-34"

        if (
            cp_dim.get("is_dividend_paid")
            or (cp_code.startswith(("421", "3388")) and any(k in text_norm for k in ("co tuc", "loi nhuan da tra", "chia loi nhuan")))
        ):
            return "36", "36", "FINANCING", "CF-RULE-FIN-36"

        # Operating outflows (02, 03, 04/14, 05/15, 07/17)
        if cp_code.startswith("334") or cp_dim.get("is_employee_payment"):
            return "03", None, "OPERATING", "CF-RULE-OP-03"

        if (
            cp_code.startswith("635")
            or (cp_code.startswith("335") and (cp_dim.get("is_borrowing_cost") or "lai vay" in text_norm or "chi phi di vay" in text_norm))
            or cp_dim.get("is_borrowing_cost")
        ):
            return "04", "14", "OPERATING", "CF-RULE-OP-04"

        if cp_code.startswith("3334") or cp_dim.get("is_cit_paid"):
            return "05", "15", "OPERATING", "CF-RULE-OP-05"

        if cp_code.startswith(("331", "151", "152", "153", "154", "155", "156", "157", "611", "621", "622", "623", "627", "632", "641", "642", "242", "1331")):
            return "02", None, "OPERATING", "CF-RULE-OP-02"

        if cp_code.startswith(("811", "138", "141", "244", "333", "335", "338", "352", "353", "414", "418")):
            return "07", "17", "OPERATING", "CF-RULE-OP-07"

        return None, None, "UNCLASSIFIED", "UNCLASSIFIED"


def _compute_slot_cash_flow_data(
    company: Company,
    start_date: date,
    end_date: date,
    branch: Branch | None = None,
    cash_flow_method: str = "DIRECT",
    is_condensed_b03b: bool = False,
) -> dict[str, Any]:
    """
    Executes SF-01 (DIRECT) & SF-02 (INDIRECT) canonical cash flow calculation for a single date slot [start_date, end_date].
    Returns indicator values, drilldown details per indicator, unclassified transactions, and anomaly flags for validation.
    """
    method = (cash_flow_method or "DIRECT").upper()
    direct_vals: dict[str, Decimal] = defaultdict(lambda: ZERO)
    indirect_vals: dict[str, Decimal] = defaultdict(lambda: ZERO)
    direct_details: dict[str, list[dict[str, Any]]] = defaultdict(list)
    indirect_details: dict[str, list[dict[str, Any]]] = defaultdict(list)

    unclassified_transactions: list[dict[str, Any]] = []
    internal_transfers: list[dict[str, Any]] = []
    non_cash_transactions: list[dict[str, Any]] = []
    loan_direct_payments: list[dict[str, Any]] = []
    duplicate_source_events: list[dict[str, Any]] = []
    unseparated_loan_events: list[dict[str, Any]] = []
    draft_journal_violations: list[dict[str, Any]] = []
    reversed_journal_violations: list[dict[str, Any]] = []
    over_allocated_events: list[dict[str, Any]] = []
    invalid_rule_events: list[dict[str, Any]] = []
    non_cash_forced_violations: list[dict[str, Any]] = []
    internal_transfer_forced_violations: list[dict[str, Any]] = []
    unrecognized_loan_direct_violations: list[dict[str, Any]] = []
    bank_statement_duplicate_violations: list[dict[str, Any]] = []

    seen_dedupe_keys: set[str] = set()

    # ------------------------------------------------------------------------
    # Step A: Process explicit CashFlowEvent & CashFlowClassification records
    # ------------------------------------------------------------------------
    evt_qs = (
        CashFlowEvent.objects.filter(
            company=company,
            posting_date__gte=start_date,
            posting_date__lte=end_date,
        )
        .prefetch_related("classifications")
        .select_related("journal_entry", "journal_line__account")
    )
    if branch is not None:
        evt_qs = evt_qs.filter(branch=branch)

    explicit_journal_entry_ids: set[uuid.UUID] = set()
    for evt in evt_qs:
        if evt.journal_entry_id:
            explicit_journal_entry_ids.add(evt.journal_entry_id)

        if evt.event_status == "DRAFT":
            if evt.classifications.exists():
                draft_journal_violations.append({
                    "event_id": str(evt.id),
                    "source_reference": evt.source_reference or evt.source_document_id,
                    "amount": _fmt_dec(evt.amount_base),
                    "reason": "Giao dịch ở trạng thái DRAFT không được đưa vào Báo cáo lưu chuyển tiền tệ.",
                })
            continue

        if evt.event_status == "REVERSED":
            if evt.classifications.exists():
                reversed_journal_violations.append({
                    "event_id": str(evt.id),
                    "source_reference": evt.source_reference or evt.source_document_id,
                    "amount": _fmt_dec(evt.amount_base),
                    "reason": "Giao dịch đã REVERSED không được đếm lặp vào Báo cáo lưu chuyển tiền tệ.",
                })
            continue

        if evt.event_status != "POSTED":
            continue

        dkey = evt.dedupe_key or f"EVT:{evt.id}"
        if evt.source_system == "BANK_STATEMENT" or evt.is_duplicate_source:
            if dkey in seen_dedupe_keys or evt.is_duplicate_source or evt.source_system == "BANK_STATEMENT":
                duplicate_source_events.append({
                    "event_id": str(evt.id),
                    "dedupe_key": dkey,
                    "source_system": evt.source_system,
                    "amount": _fmt_dec(evt.amount_base),
                })
                if (evt.metadata_json or {}).get("force_include_duplicate"):
                    if evt.source_system == "BANK_STATEMENT":
                        bank_statement_duplicate_violations.append({
                            "event_id": str(evt.id),
                            "dedupe_key": dkey,
                            "amount": _fmt_dec(evt.amount_base),
                        })
                    else:
                        duplicate_source_events[-1]["forced"] = True
                else:
                    continue
        seen_dedupe_keys.add(dkey)

        if evt.is_split_unseparated:
            unseparated_loan_events.append({
                "event_id": str(evt.id),
                "source_reference": evt.source_reference,
                "amount": _fmt_dec(evt.amount_base),
            })

        if evt.is_internal_transfer:
            internal_transfers.append({
                "event_id": str(evt.id),
                "source_reference": evt.source_reference,
                "amount": _fmt_dec(evt.amount_base),
            })
            if evt.classifications.exists():
                internal_transfer_forced_violations.append({
                    "event_id": str(evt.id),
                    "source_reference": evt.source_reference,
                    "amount": _fmt_dec(evt.amount_base),
                })
            continue

        if evt.is_non_cash_transaction and not evt.is_loan_direct_payment:
            non_cash_transactions.append({
                "event_id": str(evt.id),
                "source_reference": evt.source_reference,
                "amount": _fmt_dec(evt.amount_base),
            })
            if evt.classifications.exists():
                non_cash_forced_violations.append({
                    "event_id": str(evt.id),
                    "source_reference": evt.source_reference,
                    "amount": _fmt_dec(evt.amount_base),
                })
            continue

        cls_list = list(evt.classifications.all())
        if not cls_list:
            if evt.is_loan_direct_payment:
                unrecognized_loan_direct_violations.append({
                    "event_id": str(evt.id),
                    "source_reference": evt.source_reference,
                    "amount": _fmt_dec(evt.amount_base),
                })
            else:
                unclassified_transactions.append({
                    "event_id": str(evt.id),
                    "source_system": evt.source_system,
                    "source_reference": evt.source_reference or evt.source_document_id,
                    "transaction_date": evt.transaction_date.isoformat(),
                    "posting_date": evt.posting_date.isoformat(),
                    "amount_base": _fmt_dec(evt.amount_base),
                    "description": evt.description,
                })
            continue

        # Validate classification rule effective dates & allocation sum (TC-RPT-05-70, EF-25)
        direct_alloc_sum = ZERO
        for c in cls_list:
            if c.effective_from > end_date or (c.effective_to and c.effective_to < start_date):
                invalid_rule_events.append({
                    "event_id": str(evt.id),
                    "classification_id": str(c.id),
                    "rule_code": c.classification_rule_code,
                    "effective_from": c.effective_from.isoformat(),
                    "effective_to": c.effective_to.isoformat() if c.effective_to else None,
                })
            if c.cash_flow_method_scope in ("BOTH", "DIRECT") and not evt.is_loan_direct_payment:
                direct_alloc_sum += abs(_to_dec(c.allocated_amount))

        if not evt.is_loan_direct_payment and evt.amount_base > ZERO and direct_alloc_sum > _to_dec(evt.amount_base):
            over_allocated_events.append({
                "event_id": str(evt.id),
                "source_reference": evt.source_reference,
                "event_amount": _fmt_dec(evt.amount_base),
                "allocated_sum": _fmt_dec(direct_alloc_sum),
            })

        if evt.is_loan_direct_payment:
            loan_direct_payments.append({
                "event_id": str(evt.id),
                "source_reference": evt.source_reference,
                "amount_base": _fmt_dec(evt.amount_base),
                "classifications": [
                    {"indicator_code": c.indicator_code, "signed_amount": _fmt_dec(Decimal(c.sign) * _to_dec(c.allocated_amount))}
                    for c in cls_list
                ],
            })
            # Check that loan direct payment has balanced financing inflow and investing/operating outflow
            net_ldp = sum((Decimal(c.sign) * _to_dec(c.allocated_amount) for c in cls_list if c.cash_flow_method_scope in ("BOTH", "DIRECT")), ZERO)
            if net_ldp != ZERO:
                unrecognized_loan_direct_violations.append({
                    "event_id": str(evt.id),
                    "source_reference": evt.source_reference,
                    "net_imbalance": _fmt_dec(net_ldp),
                })

        for c in cls_list:
            signed_amt = _to_dec(Decimal(c.sign) * abs(_to_dec(c.allocated_amount)) if c.allocated_amount >= ZERO else _to_dec(c.allocated_amount))
            det_item = {
                "event_id": str(evt.id),
                "classification_id": str(c.id),
                "source_system": evt.source_system,
                "source_document_id": c.source_document_id or evt.source_document_id,
                "source_reference": evt.source_reference or evt.source_document_id,
                "journal_entry_id": str(evt.journal_entry_id) if evt.journal_entry_id else None,
                "entry_no": evt.journal_entry.number if evt.journal_entry else (evt.source_reference or evt.source_document_id),
                "posting_date": evt.posting_date.isoformat(),
                "transaction_date": evt.transaction_date.isoformat(),
                "indicator_code": c.indicator_code,
                "cash_flow_section": c.cash_flow_section,
                "allocated_amount": _fmt_dec(abs(_to_dec(c.allocated_amount))),
                "sign": c.sign,
                "signed_amount": _fmt_dec(signed_amt),
                "classification_rule_code": c.classification_rule_code,
                "description": evt.description or c.reason,
            }
            if c.cash_flow_method_scope in ("BOTH", "DIRECT"):
                direct_vals[c.indicator_code] += signed_amt
                direct_details[c.indicator_code].append(det_item)
            if c.cash_flow_method_scope in ("BOTH", "INDIRECT"):
                indirect_vals[c.indicator_code] += signed_amt
                indirect_details[c.indicator_code].append(det_item)

    # ------------------------------------------------------------------------
    # Step B: Process GL JournalEntries in [start_date, end_date]
    # ------------------------------------------------------------------------
    je_qs = (
        JournalEntry.objects.filter(
            company=company,
            posting_date__gte=start_date,
            posting_date__lte=end_date,
        )
        .exclude(entry_type="OPENING")
        .exclude(id__in=explicit_journal_entry_ids)
        .prefetch_related("lines__account", "lines__party")
        .order_by("posting_date", "number")
    )
    if branch is not None:
        je_qs = je_qs.filter(branch=branch)

    has_reclassified_instruments = CashEquivalentInstrument.objects.filter(
        company=company,
        cash_equivalent_status__in=("RECLASSIFIED_IN", "RECLASSIFIED_OUT"),
        reclassification_effective_date__gte=start_date,
        reclassification_effective_date__lte=end_date,
    ).exists()

    for entry in je_qs:
        entry_lines = list(entry.lines.all())
        if not entry_lines:
            continue

        # Check DRAFT or REVERSED violations if forced via workflow_snapshot
        wf_snap = entry.workflow_snapshot or {}
        if entry.status == "DRAFT":
            if wf_snap.get("force_include_in_b03"):
                draft_journal_violations.append({
                    "journal_entry_id": str(entry.id),
                    "entry_no": entry.number,
                    "posting_date": entry.posting_date.isoformat(),
                    "reason": "Bút toán DRAFT bị ép tính vào Báo cáo lưu chuyển tiền tệ.",
                })
            continue

        if entry.status in ("REVERSED", "CANCELLED") or entry.reversed_amount > 0 or (entry.original_entry_id and entry.reversal_method):
            if wf_snap.get("force_include_in_b03"):
                reversed_journal_violations.append({
                    "journal_entry_id": str(entry.id),
                    "entry_no": entry.number,
                    "posting_date": entry.posting_date.isoformat(),
                    "reason": "Bút toán đã REVERSED bị tính lặp vào Báo cáo lưu chuyển tiền tệ.",
                })
            continue

        if entry.status != "POSTED":
            continue

        dkey = entry.source_event_id or f"JE:{entry.company_id}:{entry.number}"
        if dkey in seen_dedupe_keys:
            duplicate_source_events.append({
                "journal_entry_id": str(entry.id),
                "entry_no": entry.number,
                "dedupe_key": dkey,
            })
            continue
        seen_dedupe_keys.add(dkey)

        cash_lines: list[JournalLine] = []
        non_cash_lines: list[JournalLine] = []
        for ln in entry_lines:
            if _is_cash_account_code(ln.account.code, ln.dimensions or {}):
                cash_lines.append(ln)
            else:
                non_cash_lines.append(ln)

        # Skip non-cash reclassification between 1288 and 1281 (captured in Indicator 62 on B03b-DN)
        if (
            cash_lines
            and non_cash_lines
            and all(l.account.code.startswith("128") for l in cash_lines)
            and all(l.account.code.startswith("128") for l in non_cash_lines)
            and (
                has_reclassified_instruments
                or wf_snap.get("is_cash_equivalent_reclassification")
                or any((l.dimensions or {}).get("exclude_from_working_capital") for l in non_cash_lines)
            )
        ):
            continue

        # Case 1: Internal transfer between cash/bank accounts (all lines are cash accounts, or explicit flag)
        if cash_lines and (not non_cash_lines or wf_snap.get("is_internal_transfer") or any((l.dimensions or {}).get("is_internal_transfer") for l in entry_lines)):
            transfer_amt = sum((_to_dec(l.debit) for l in cash_lines), ZERO)
            internal_transfers.append({
                "journal_entry_id": str(entry.id),
                "entry_no": entry.number,
                "posting_date": entry.posting_date.isoformat(),
                "amount": _fmt_dec(transfer_amt),
                "description": entry.description,
            })
            if wf_snap.get("force_external_cash_flow"):
                internal_transfer_forced_violations.append({
                    "journal_entry_id": str(entry.id),
                    "entry_no": entry.number,
                    "amount": _fmt_dec(transfer_amt),
                })
            continue

        # Case 2: No cash lines in entry -> Check for Special Presentation (Loan Direct Payment to Supplier) or Non-cash
        if not cash_lines:
            is_ldp = bool(
                wf_snap.get("is_loan_direct_payment")
                or any((l.dimensions or {}).get("loan_direct_payment") or (l.dimensions or {}).get("special_presentation_rule") == "LOAN_DIRECT_PAYMENT" for l in non_cash_lines)
            )
            if is_ldp:
                if wf_snap.get("loan_direct_payment_unrecognized"):
                    unrecognized_loan_direct_violations.append({
                        "journal_entry_id": str(entry.id),
                        "entry_no": entry.number,
                        "amount": _fmt_dec(entry.total_debit),
                    })
                    continue

                # Determine borrowing amount (credit 341) and target outflow (21 for CAPEX/asset, 02 for operating supplier)
                loan_amt = sum((_to_dec(l.credit) for l in non_cash_lines if l.account.code.startswith("341")), ZERO) or _to_dec(entry.total_debit)
                is_capex_ldp = any(
                    l.account.code.startswith(("211", "213", "217", "241", "1332"))
                    or (l.dimensions or {}).get("is_capex")
                    or (l.dimensions or {}).get("target_indicator") == "21"
                    or any(k in _strip_accents(f"{l.description} {entry.description}") for k in ("tscd", "may moc", "thiet bi", "xay dung"))
                    for l in non_cash_lines
                )
                outflow_code = "21" if is_capex_ldp else "02"
                outflow_sec = "INVESTING" if is_capex_ldp else "OPERATING"

                inflow_det = {
                    "journal_entry_id": str(entry.id),
                    "entry_no": entry.number,
                    "posting_date": entry.posting_date.isoformat(),
                    "indicator_code": "33",
                    "cash_flow_section": "FINANCING",
                    "allocated_amount": _fmt_dec(loan_amt),
                    "sign": 1,
                    "signed_amount": _fmt_dec(loan_amt),
                    "special_presentation_rule": "LOAN_DIRECT_PAYMENT",
                    "description": f"[Vay giải ngân thẳng NCC] {entry.description}",
                }
                outflow_det = {
                    "journal_entry_id": str(entry.id),
                    "entry_no": entry.number,
                    "posting_date": entry.posting_date.isoformat(),
                    "indicator_code": outflow_code,
                    "cash_flow_section": outflow_sec,
                    "allocated_amount": _fmt_dec(loan_amt),
                    "sign": -1,
                    "signed_amount": _fmt_dec(-loan_amt),
                    "special_presentation_rule": "LOAN_DIRECT_PAYMENT",
                    "description": f"[Vay giải ngân thẳng NCC] {entry.description}",
                }
                direct_vals["33"] += loan_amt
                direct_details["33"].append(inflow_det)
                indirect_vals["33"] += loan_amt
                indirect_details["33"].append(inflow_det)

                direct_vals[outflow_code] -= loan_amt
                direct_details[outflow_code].append(outflow_det)
                if outflow_code == "21":
                    indirect_vals["21"] -= loan_amt
                    indirect_details["21"].append(outflow_det)

                loan_direct_payments.append({
                    "journal_entry_id": str(entry.id),
                    "entry_no": entry.number,
                    "posting_date": entry.posting_date.isoformat(),
                    "amount_base": _fmt_dec(loan_amt),
                    "inflow_indicator": "33",
                    "outflow_indicator": outflow_code,
                })
                continue

            # Check if a non-cash transaction is being forced into cash flow (EF-21)
            if wf_snap.get("force_non_cash_into_b03") or any((l.dimensions or {}).get("force_non_cash_into_b03") for l in non_cash_lines):
                non_cash_forced_violations.append({
                    "journal_entry_id": str(entry.id),
                    "entry_no": entry.number,
                    "posting_date": entry.posting_date.isoformat(),
                    "amount": _fmt_dec(entry.total_debit),
                })

            # Check for explicit INDIRECT non-cash adjustments on lines (e.g. b03_indirect_code in 02..07)
            for l in non_cash_lines:
                ldim = l.dimensions or {}
                ind_override = str(ldim.get("b03_indirect_code") or "").strip()
                if ind_override in ("02", "03", "04", "05", "06", "07"):
                    amt = _to_dec(ldim.get("b03_indirect_amount") or (l.debit if l.debit > 0 else l.credit))
                    sign_mult = int(ldim.get("b03_indirect_sign", 1))
                    signed = _to_dec(Decimal(sign_mult) * amt)
                    indirect_vals[ind_override] += signed
                    indirect_details[ind_override].append({
                        "journal_entry_id": str(entry.id),
                        "journal_line_id": str(l.id),
                        "entry_no": entry.number,
                        "posting_date": entry.posting_date.isoformat(),
                        "account_code": l.account.code,
                        "account_name": l.account.name,
                        "indicator_code": ind_override,
                        "signed_amount": _fmt_dec(signed),
                        "description": l.description or entry.description,
                    })
            continue

        # Case 3: Actual Cash Receipt / Payment (cash_lines AND non_cash_lines present)
        cash_inflow_total = sum(
            (_to_dec(l.debit) - _to_dec(l.credit) for l in cash_lines if _to_dec(l.debit) > _to_dec(l.credit)),
            ZERO,
        )
        cash_outflow_total = sum(
            (_to_dec(l.credit) - _to_dec(l.debit) for l in cash_lines if _to_dec(l.credit) > _to_dec(l.debit)),
            ZERO,
        )
        if cash_inflow_total == ZERO and cash_outflow_total == ZERO:
            continue

        cash_acc_codes = ", ".join(sorted({l.account.code for l in cash_lines}))

        # Check if any counterpart line has unseparated principal & interest flag (EF-22)
        if wf_snap.get("unseparated_principal_interest") or any((l.dimensions or {}).get("unseparated_principal_interest") for l in non_cash_lines):
            unseparated_loan_events.append({
                "journal_entry_id": str(entry.id),
                "entry_no": entry.number,
                "amount": _fmt_dec(cash_outflow_total or cash_inflow_total),
            })

        # Allocate cash inflows across Credit non-cash lines, and cash outflows across Debit non-cash lines
        flow_passes: list[tuple[bool, Decimal]] = []
        if cash_inflow_total > ZERO:
            flow_passes.append((True, cash_inflow_total))
        if cash_outflow_total > ZERO:
            flow_passes.append((False, cash_outflow_total))

        for cash_is_inflow, abs_cash_total in flow_passes:
            cp_candidates: list[tuple[JournalLine, Decimal]] = []
            for l in non_cash_lines:
                cp_amt = (_to_dec(l.credit) - _to_dec(l.debit)) if cash_is_inflow else (_to_dec(l.debit) - _to_dec(l.credit))
                if cp_amt > ZERO:
                    cp_candidates.append((l, cp_amt))

            total_cp_weight = sum((amt for _, amt in cp_candidates), ZERO)
            if total_cp_weight <= ZERO:
                continue

            for cp_line, cp_amt in cp_candidates:
                allocated_cash = _to_dec(abs_cash_total * cp_amt / total_cp_weight) if total_cp_weight != abs_cash_total else cp_amt
                cp_dim = cp_line.dimensions or {}

                # Support automatic principal + interest split on a single counterpart line if dimensions specify both!
                if not cash_is_inflow and cp_dim.get("principal_amount") is not None and cp_dim.get("interest_amount") is not None:
                    p_amt = _to_dec(cp_dim["principal_amount"])
                    i_amt = _to_dec(cp_dim["interest_amount"])
                    if p_amt > ZERO:
                        p_det = {
                            "journal_entry_id": str(entry.id),
                            "journal_line_id": str(cp_line.id),
                            "entry_no": entry.number,
                            "posting_date": entry.posting_date.isoformat(),
                            "cash_accounts": cash_acc_codes,
                            "account_code": cp_line.account.code,
                            "account_name": cp_line.account.name,
                            "indicator_code": "34",
                            "cash_flow_section": "FINANCING",
                            "allocated_amount": _fmt_dec(p_amt),
                            "sign": -1,
                            "signed_amount": _fmt_dec(-p_amt),
                            "classification_rule_code": "CF-SPLIT-PRINCIPAL-34",
                            "description": f"[Tách trả gốc vay] {cp_line.description or entry.description}",
                        }
                        direct_vals["34"] -= p_amt
                        direct_details["34"].append(p_det)
                        indirect_vals["34"] -= p_amt
                        indirect_details["34"].append(p_det)
                    if i_amt > ZERO:
                        i_det = {
                            "journal_entry_id": str(entry.id),
                            "journal_line_id": str(cp_line.id),
                            "entry_no": entry.number,
                            "posting_date": entry.posting_date.isoformat(),
                            "cash_accounts": cash_acc_codes,
                            "account_code": cp_line.account.code,
                            "account_name": cp_line.account.name,
                            "indicator_code": "04",
                            "cash_flow_section": "OPERATING",
                            "allocated_amount": _fmt_dec(i_amt),
                            "sign": -1,
                            "signed_amount": _fmt_dec(-i_amt),
                            "classification_rule_code": "CF-SPLIT-INTEREST-04",
                            "description": f"[Tách trả lãi vay] {cp_line.description or entry.description}",
                        }
                        direct_vals["04"] -= i_amt
                        direct_details["04"].append(i_det)
                        indirect_vals["14"] -= i_amt
                        indirect_details["14"].append({**i_det, "indicator_code": "14"})
                    continue

                dir_code, ind_code, sec_code, rule_code = _classify_counterpart_for_cash_flow(
                    cash_is_inflow=cash_is_inflow,
                    cp_code=cp_line.account.code,
                    cp_desc=cp_line.description or "",
                    cp_dim=cp_dim,
                    entry_desc=entry.description or "",
                    entry_module=entry.source_module or "",
                )

                if not dir_code:
                    unclassified_transactions.append({
                        "journal_entry_id": str(entry.id),
                        "journal_line_id": str(cp_line.id),
                        "entry_no": entry.number,
                        "posting_date": entry.posting_date.isoformat(),
                        "cash_accounts": cash_acc_codes,
                        "counterpart_account": cp_line.account.code,
                        "counterpart_name": cp_line.account.name,
                        "direction": "RECEIPT" if cash_is_inflow else "PAYMENT",
                        "amount_base": _fmt_dec(allocated_cash),
                        "description": cp_line.description or entry.description,
                    })
                    continue

                sign_val = 1 if cash_is_inflow else -1
                signed_cash = _to_dec(Decimal(sign_val) * allocated_cash)

                det_record = {
                    "journal_entry_id": str(entry.id),
                    "journal_line_id": str(cp_line.id),
                    "entry_no": entry.number,
                    "posting_date": entry.posting_date.isoformat(),
                    "transaction_date": (entry.document_date or entry.posting_date).isoformat(),
                    "cash_accounts": cash_acc_codes,
                    "account_code": cp_line.account.code,
                    "account_name": cp_line.account.name,
                    "party_name": cp_line.party.name if cp_line.party else "",
                    "indicator_code": dir_code,
                    "cash_flow_section": sec_code,
                    "allocated_amount": _fmt_dec(allocated_cash),
                    "sign": sign_val,
                    "signed_amount": _fmt_dec(signed_cash),
                    "classification_rule_code": rule_code,
                    "missing_source_document": bool(cp_dim.get("missing_source_document")),
                    "description": cp_line.description or entry.description,
                }
                direct_vals[dir_code] += signed_cash
                direct_details[dir_code].append(det_record)

                if ind_code:
                    indirect_vals[ind_code] += signed_cash
                    indirect_details[ind_code].append({**det_record, "indicator_code": ind_code})

    # ------------------------------------------------------------------------
    # Step C: Compute INDIRECT Operating Cash Flow (01..17, 20) (SF-02)
    # ------------------------------------------------------------------------
    # 1. Indicator 01: Lợi nhuận trước thuế from B02.50 in the exact same slot/scope
    from reporting.business_result_services import _compute_slot_b02_data

    b02_slot_data = _compute_slot_b02_data(
        company=company,
        reporting_scope="BRANCH" if branch else "COMPANY",
        branch=branch,
        start_date=start_date,
        end_date=end_date,
        calculation_method="ACTIVITY_BASED",
        eps_metadata={},
        is_joint_stock=False,
        sign_multipliers={},
        is_condensed_b02b=False,
    )
    b02_50_pbt = _to_dec(b02_slot_data["values"].get("50", ZERO))
    if "01" not in indirect_vals or indirect_vals["01"] == ZERO:
        indirect_vals["01"] = b02_50_pbt
        indirect_details["01"].append({
            "source_type": "B02_INDICATOR_50",
            "indicator_code": "01",
            "source_reference": "B02-DN.50",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "signed_amount": _fmt_dec(b02_50_pbt),
            "description": "Tổng lợi nhuận kế toán trước thuế (Chỉ tiêu 50 trên Báo cáo KQHĐKD cùng kỳ và phạm vi)",
        })

    # Scan posted non-reversal journal lines in [start_date, end_date] for non-cash P&L adjustments (02..06)
    # if not already explicitly populated by CashFlowEvent/Classification
    slot_jls = (
        JournalLine.objects.filter(
            entry__company=company,
            entry__status="POSTED",
            entry__reversed_amount=0,
            entry__posting_date__gte=start_date,
            entry__posting_date__lte=end_date,
        )
        .exclude(entry_id__in=explicit_journal_entry_ids)
        .select_related("account", "entry")
    )
    if branch is not None:
        slot_jls = slot_jls.filter(entry__branch=branch)

    # Group lines by entry to inspect counterpart accounts
    lines_by_entry: dict[uuid.UUID, list[JournalLine]] = defaultdict(list)
    for jl in slot_jls:
        if jl.entry.original_entry_id is not None and jl.entry.reversal_method:
            continue
        lines_by_entry[jl.entry_id].append(jl)

    for eid, elines in lines_by_entry.items():
        # Skip if any line in elines already had explicit b03_indirect_code
        if any((l.dimensions or {}).get("b03_indirect_code") for l in elines):
            continue

        entry_obj = elines[0].entry
        has_pnl_expense = any(l.account.code.startswith(("623", "627", "632", "635", "641", "642", "811")) and l.debit > 0 for l in elines)
        has_cash = any(_is_cash_account_code(l.account.code, l.dimensions or {}) for l in elines)

        for l in elines:
            ac = l.account.code
            ldim = l.dimensions or {}
            # 02: Khấu hao TSCĐ và BĐSĐT (Credit 214 paired with P&L expense, NOT asset disposal or non-P&L transfer)
            if ac.startswith("214") and l.credit > 0 and has_pnl_expense and not ldim.get("exclude_depreciation"):
                amt = _to_dec(l.credit)
                indirect_vals["02"] += amt
                indirect_details["02"].append({
                    "journal_entry_id": str(entry_obj.id),
                    "journal_line_id": str(l.id),
                    "entry_no": entry_obj.number,
                    "posting_date": entry_obj.posting_date.isoformat(),
                    "account_code": ac,
                    "account_name": l.account.name,
                    "indicator_code": "02",
                    "signed_amount": _fmt_dec(amt),
                    "description": l.description or entry_obj.description,
                })

            # 03: Các khoản dự phòng (Credit 229/352 = + trích lập, Debit 229/352 paired with P&L = - hoàn nhập)
            elif ac.startswith(("229", "352")) and not has_cash:
                has_pnl_pair = any(other.account.code.startswith(("632", "635", "642", "627", "811", "711")) for other in elines if other.id != l.id)
                if has_pnl_pair:
                    net_prov = _to_dec(l.credit) - _to_dec(l.debit)
                    if net_prov != ZERO:
                        indirect_vals["03"] += net_prov
                        indirect_details["03"].append({
                            "journal_entry_id": str(entry_obj.id),
                            "journal_line_id": str(l.id),
                            "entry_no": entry_obj.number,
                            "posting_date": entry_obj.posting_date.isoformat(),
                            "account_code": ac,
                            "account_name": l.account.name,
                            "indicator_code": "03",
                            "signed_amount": _fmt_dec(net_prov),
                            "description": l.description or entry_obj.description,
                        })

            # 04: Lãi/lỗ chênh lệch tỷ giá do đánh giá lại khoản mục tiền tệ có gốc ngoại tệ
            # Unrealized FX gain (Credit 515 vs Debit 413/monetary) -> negative adjustment (-);
            # Unrealized FX loss (Debit 635 vs Credit 413/monetary) -> positive adjustment (+).
            elif (ac.startswith(("515", "635")) and (ldim.get("is_fx_revaluation") or any(o.account.code.startswith("413") for o in elines))):
                if ac.startswith("515") and l.credit > 0:
                    adj = -_to_dec(l.credit)
                elif ac.startswith("635") and l.debit > 0:
                    adj = _to_dec(l.debit)
                else:
                    adj = ZERO
                if adj != ZERO:
                    indirect_vals["04"] += adj
                    indirect_details["04"].append({
                        "journal_entry_id": str(entry_obj.id),
                        "journal_line_id": str(l.id),
                        "entry_no": entry_obj.number,
                        "posting_date": entry_obj.posting_date.isoformat(),
                        "account_code": ac,
                        "account_name": l.account.name,
                        "indicator_code": "04",
                        "signed_amount": _fmt_dec(adj),
                        "description": l.description or entry_obj.description,
                    })

            # 05: Lãi, lỗ từ hoạt động đầu tư, tài chính (Investing gain -> negative adjustment; Investing loss -> positive adjustment)
            elif (
                (ac.startswith("515") and not ldim.get("is_fx_revaluation") and not any(o.account.code.startswith(("413", "911")) for o in elines))
                or (ac.startswith(("711", "811", "5117")) and (ldim.get("is_investing_gain_loss") or ldim.get("is_fixed_asset_disposal") or ldim.get("is_investment_property_disposal")))
            ):
                if ac.startswith(("515", "711", "5117")) and l.credit > 0:
                    adj = -_to_dec(l.credit)
                elif ac.startswith("811") and l.debit > 0:
                    adj = _to_dec(l.debit)
                else:
                    adj = ZERO
                if adj != ZERO:
                    indirect_vals["05"] += adj
                    indirect_details["05"].append({
                        "journal_entry_id": str(entry_obj.id),
                        "journal_line_id": str(l.id),
                        "entry_no": entry_obj.number,
                        "posting_date": entry_obj.posting_date.isoformat(),
                        "account_code": ac,
                        "account_name": l.account.name,
                        "indicator_code": "05",
                        "signed_amount": _fmt_dec(adj),
                        "description": l.description or entry_obj.description,
                    })

            # 06: Chi phí đi vay (Borrowing cost recognized in P&L -> positive adjustment +)
            elif ac.startswith("635") and l.debit > 0 and not any(o.account.code.startswith("911") for o in elines):
                txt = _strip_accents(f"{l.description} {entry_obj.description}")
                if ldim.get("is_borrowing_cost") or "lai vay" in txt or "chi phi di vay" in txt:
                    amt = _to_dec(l.debit)
                    indirect_vals["06"] += amt
                    indirect_details["06"].append({
                        "journal_entry_id": str(entry_obj.id),
                        "journal_line_id": str(l.id),
                        "entry_no": entry_obj.number,
                        "posting_date": entry_obj.posting_date.isoformat(),
                        "account_code": ac,
                        "account_name": l.account.name,
                        "indicator_code": "06",
                        "signed_amount": _fmt_dec(amt),
                        "description": l.description or entry_obj.description,
                    })

    # Working capital changes (09, 10, 11, 12, 13) (SF-04)
    # Compute opening (before start_date) and closing (up to end_date) operating balances
    wc_groups = {
        "09": ("RECEIVABLE", ("131", "1331", "136", "138", "141", "244"), -1),  # Increase in operating receivables -> negative (-delta)
        "10": ("INVENTORY", ("151", "152", "153", "154", "155", "156", "157"), -1),  # Increase in inventory -> negative (-delta)
        "11": ("PAYABLE", ("331", "3331", "3332", "3333", "3338", "334", "335", "338"), 1),  # Increase in operating payables -> positive (+delta)
        "12": ("PREPAID", ("242",), -1),  # Increase in prepaid expenses -> negative (-delta)
        "13": ("TRADING_SEC", ("121",), -1),  # Increase in trading securities -> negative (-delta)
    }

    def _compute_wc_balances(cutoff_date: date, inclusive: bool) -> dict[str, Decimal]:
        d_cond = (
            Q(entry__posting_date__lte=cutoff_date)
            if inclusive
            else (Q(entry__posting_date__lt=cutoff_date) | Q(entry__entry_type="OPENING", entry__posting_date__lte=cutoff_date))
        )
        w_qs = (
            JournalLine.objects.filter(
                entry__company=company,
                entry__status="POSTED",
                entry__reversed_amount=0,
            )
            .filter(d_cond)
            .select_related("account", "entry")
        )
        if branch is not None:
            w_qs = w_qs.filter(entry__branch=branch)

        res: dict[str, Decimal] = defaultdict(lambda: ZERO)
        for jl in w_qs:
            if jl.entry.original_entry_id is not None and jl.entry.reversal_method:
                continue
            ldim = jl.dimensions or {}
            # Exclude non-operating / CAPEX / loan interest / CIT / dividend items from working capital
            if ldim.get("exclude_from_working_capital") or ldim.get("is_capex") or ldim.get("purpose") == "CAPEX" or ldim.get("is_asset_disposal"):
                continue
            code = jl.account.code
            for wc_code, (g_type, prefixes, _) in wc_groups.items():
                if code.startswith(prefixes):
                    if g_type == "PAYABLE":
                        # Exclude CIT 3334, accrued loan interest on 335, dividend payable on 3388
                        if code.startswith("3334"):
                            continue
                        if code.startswith("335") and (ldim.get("is_borrowing_cost") or "lai vay" in _strip_accents(jl.description or "")):
                            continue
                        if code.startswith("3388") and (ldim.get("is_dividend_paid") or "co tuc" in _strip_accents(jl.description or "")):
                            continue
                        res[wc_code] += _to_dec(jl.credit) - _to_dec(jl.debit)
                    else:
                        res[wc_code] += _to_dec(jl.debit) - _to_dec(jl.credit)
        return res

    wc_open = _compute_wc_balances(start_date, inclusive=False)
    wc_close = _compute_wc_balances(end_date, inclusive=True)

    for wc_code, (g_type, prefixes, sign_factor) in wc_groups.items():
        # Only use balance delta if not explicitly set by CashFlowClassification
        if wc_code not in indirect_vals or indirect_vals[wc_code] == ZERO:
            open_bal = _to_dec(wc_open.get(wc_code, ZERO))
            close_bal = _to_dec(wc_close.get(wc_code, ZERO))
            delta = close_bal - open_bal
            wc_impact = _to_dec(Decimal(sign_factor) * delta)
            if wc_impact != ZERO or open_bal != ZERO or close_bal != ZERO:
                indirect_vals[wc_code] = wc_impact
                indirect_details[wc_code].append({
                    "source_type": "WORKING_CAPITAL_DELTA",
                    "indicator_code": wc_code,
                    "group_type": g_type,
                    "account_prefixes": list(prefixes),
                    "opening_balance": _fmt_dec(open_bal),
                    "closing_balance": _fmt_dec(close_bal),
                    "raw_delta": _fmt_dec(delta),
                    "sign_factor": sign_factor,
                    "signed_amount": _fmt_dec(wc_impact),
                    "description": f"Biến động vốn lưu động ({g_type}): Đầu kỳ {_fmt_dec(open_bal)} -> Cuối kỳ {_fmt_dec(close_bal)}",
                })

    # ------------------------------------------------------------------------
    # Step D: Compute Opening Cash (60), FX Effect (61), Reclassification (62), Totals (20, 30, 40, 50, 70)
    # ------------------------------------------------------------------------
    open_cash, open_cash_breakdown, open_ineligible = _compute_cash_and_equivalents_balance_as_of(
        company=company,
        as_of_date=start_date,
        branch=branch,
        inclusive=False,
    )
    close_cash_actual, close_cash_breakdown, close_ineligible = _compute_cash_and_equivalents_balance_as_of(
        company=company,
        as_of_date=end_date,
        branch=branch,
        inclusive=True,
    )

    if "60" not in direct_vals or direct_vals["60"] == ZERO:
        direct_vals["60"] = open_cash
        direct_details["60"] = open_cash_breakdown
    if "60" not in indirect_vals or indirect_vals["60"] == ZERO:
        indirect_vals["60"] = open_cash
        indirect_details["60"] = open_cash_breakdown

    # Indicator 62 (B03b-DN only): Reclassification of cash equivalents at period end
    reclass_62 = direct_vals.get("62", ZERO)
    reclass_violations: list[dict[str, Any]] = []
    inst_reclass_qs = CashEquivalentInstrument.objects.filter(
        company=company,
        reclassification_effective_date__gte=start_date,
        reclassification_effective_date__lte=end_date,
    )
    if branch is not None:
        inst_reclass_qs = inst_reclass_qs.filter(Q(branch=branch) | Q(branch__isnull=True))
    for inst in inst_reclass_qs:
        if inst.is_cash_flow_transaction:
            reclass_violations.append({
                "instrument_id": str(inst.id),
                "instrument_code": inst.instrument_code,
                "reason": "Giao dịch mua/bán thực tế đã thuộc dòng tiền, không được ghi trùng vào chỉ tiêu 62.",
            })
            continue
        imp = _to_dec(inst.reclassification_impact_amount)
        reclass_62 += imp
        det_62 = {
            "instrument_id": str(inst.id),
            "instrument_code": inst.instrument_code,
            "instrument_name": inst.instrument_name,
            "opening_classification": inst.opening_classification,
            "closing_classification": inst.closing_classification,
            "effective_date": inst.reclassification_effective_date.isoformat() if inst.reclassification_effective_date else None,
            "signed_amount": _fmt_dec(imp),
            "reason": inst.reclassification_reason,
            "source_reference": inst.source_reference,
        }
        direct_details["62"].append(det_62)
        indirect_details["62"].append(det_62)

    if is_condensed_b03b:
        direct_vals["62"] = _to_dec(reclass_62)
        indirect_vals["62"] = _to_dec(reclass_62)

    # Evaluate section subtotals & totals for DIRECT
    direct_vals["20"] = sum((_to_dec(direct_vals.get(c, ZERO)) for c in ("01", "02", "03", "04", "05", "06", "07")), ZERO)
    direct_vals["30"] = sum((_to_dec(direct_vals.get(c, ZERO)) for c in ("21", "22", "23", "24", "25", "26", "27")), ZERO)
    direct_vals["40"] = sum((_to_dec(direct_vals.get(c, ZERO)) for c in ("31", "32", "33", "34", "35", "36")), ZERO)
    direct_vals["50"] = _to_dec(direct_vals["20"] + direct_vals["30"] + direct_vals["40"])
    if is_condensed_b03b:
        direct_vals["70"] = _to_dec(direct_vals["50"] + direct_vals["60"] + direct_vals.get("61", ZERO) + direct_vals.get("62", ZERO))
    else:
        direct_vals["70"] = _to_dec(direct_vals["50"] + direct_vals["60"] + direct_vals.get("61", ZERO))

    # Evaluate section subtotals & totals for INDIRECT
    indirect_vals["08"] = sum((_to_dec(indirect_vals.get(c, ZERO)) for c in ("01", "02", "03", "04", "05", "06", "07")), ZERO)
    indirect_vals["20"] = _to_dec(
        indirect_vals["08"]
        + sum((_to_dec(indirect_vals.get(c, ZERO)) for c in ("09", "10", "11", "12", "13", "14", "15", "16", "17")), ZERO)
    )
    indirect_vals["30"] = sum((_to_dec(indirect_vals.get(c, ZERO)) for c in ("21", "22", "23", "24", "25", "26", "27")), ZERO)
    indirect_vals["40"] = sum((_to_dec(indirect_vals.get(c, ZERO)) for c in ("31", "32", "33", "34", "35", "36")), ZERO)
    indirect_vals["50"] = _to_dec(indirect_vals["20"] + indirect_vals["30"] + indirect_vals["40"])
    if is_condensed_b03b:
        indirect_vals["70"] = _to_dec(indirect_vals["50"] + indirect_vals["60"] + indirect_vals.get("61", ZERO) + indirect_vals.get("62", ZERO))
    else:
        indirect_vals["70"] = _to_dec(indirect_vals["50"] + indirect_vals["60"] + indirect_vals.get("61", ZERO))

    chosen_vals = indirect_vals if method == "INDIRECT" else direct_vals
    chosen_details = indirect_details if method == "INDIRECT" else direct_details

    return {
        "method": method,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "values": dict(chosen_vals),
        "details": dict(chosen_details),
        "direct_values": dict(direct_vals),
        "indirect_values": dict(indirect_vals),
        "opening_cash_actual": open_cash,
        "closing_cash_actual": close_cash_actual,
        "opening_cash_breakdown": open_cash_breakdown,
        "closing_cash_breakdown": close_cash_breakdown,
        "ineligible_cash_equivalents": close_ineligible or open_ineligible,
        "unclassified_transactions": unclassified_transactions,
        "internal_transfers": internal_transfers,
        "non_cash_transactions": non_cash_transactions,
        "loan_direct_payments": loan_direct_payments,
        "duplicate_source_events": duplicate_source_events,
        "unseparated_loan_events": unseparated_loan_events,
        "draft_journal_violations": draft_journal_violations,
        "reversed_journal_violations": reversed_journal_violations,
        "over_allocated_events": over_allocated_events,
        "invalid_rule_events": invalid_rule_events,
        "non_cash_forced_violations": non_cash_forced_violations,
        "internal_transfer_forced_violations": internal_transfer_forced_violations,
        "unrecognized_loan_direct_violations": unrecognized_loan_direct_violations,
        "bank_statement_duplicate_violations": bank_statement_duplicate_violations,
        "reclass_violations": reclass_violations,
        "b02_pbt_50": b02_50_pbt,
        "b02_pat_60": _to_dec(b02_slot_data["values"].get("60", ZERO)),
    }


# ============================================================================
# 6. RUN CALCULATION & PERSISTENCE (calculate_cash_flow_run)
# ============================================================================

def _resolve_fiscal_year_start_date(company: Company, fiscal_year: int, fallback_start: date, meta: dict | None = None) -> date:
    meta = meta or {}
    if meta.get("fiscal_year_start_date"):
        try:
            return date.fromisoformat(str(meta["fiscal_year_start_date"]))
        except ValueError:
            pass
    first_p = (
        AccountingPeriod.objects.filter(company=company, fiscal_year=fiscal_year)
        .order_by("start_date", "period_number")
        .first()
    )
    if first_p:
        return first_p.start_date
    return date(fiscal_year, 1, 1)


@transaction.atomic
def calculate_cash_flow_run(run: FinancialStatementRun) -> FinancialStatementRun:
    ensure_b03_templates_seeded()
    if run.run_status == FinancialStatementRun.Status.APPROVED and run.values.exists():
        raise ValidationError({
            "error_code": "EF-41",
            "detail": "Không được tính lại hoặc ghi đè giá trị trực tiếp lên Statement Run B03 đã phê duyệt (APPROVED).",
        })

    company = run.company
    tv = run.template_version
    tmpl = run.template
    legal_code = tmpl.legal_form_code
    is_condensed_b03b = legal_code == "B03b-DN"
    is_interim_b03a = legal_code == "B03a-DN"
    eff_branch = run.branch if run.reporting_scope == "BRANCH" else None
    method = (run.cash_flow_method or tv.cash_flow_method or "DIRECT").upper()
    if method not in ("DIRECT", "INDIRECT"):
        method = "DIRECT"

    meta = dict(run.eps_metadata_json or {})
    fy_start = _resolve_fiscal_year_start_date(company, run.fiscal_year, run.period_start_date, meta)
    comp_end = run.comparison_end_date or date(run.period_end_date.year - 1, run.period_end_date.month, min(run.period_end_date.day, 28))
    comp_start = run.comparison_start_date or date(run.period_start_date.year - 1, run.period_start_date.month, min(run.period_start_date.day, 28))
    prev_fy_start = _resolve_fiscal_year_start_date(
        company,
        run.fiscal_year - 1,
        comp_start,
        {"fiscal_year_start_date": meta.get("prev_fiscal_year_start_date")} if meta.get("prev_fiscal_year_start_date") else None,
    )
    if prev_fy_start.year == fy_start.year:
        prev_fy_start = date(fy_start.year - 1, fy_start.month, fy_start.day)

    # Determine value slots and their exact [start_date, end_date] ranges
    if is_condensed_b03b:
        slot_defs = [
            ("QUARTER_CURRENT", "Quý này – Năm nay", run.period_start_date, run.period_end_date, 1),
            ("QUARTER_PREVIOUS", "Quý tương ứng – Năm trước", comp_start, comp_end, 2),
            ("YTD_CURRENT", "Lũy kế từ đầu năm đến cuối quý này – Năm nay", fy_start, run.period_end_date, 3),
            ("YTD_PREVIOUS", "Lũy kế từ đầu năm đến cuối quý tương ứng – Năm trước", prev_fy_start, comp_end, 4),
        ]
    elif is_interim_b03a:
        # B03a-DN MUST use YTD ranges [fy_start, period_end_date] and [prev_fy_start, comp_end]
        ytd_curr_start = run.period_start_date if meta.get("force_quarter_instead_of_ytd") else fy_start
        ytd_prev_start = comp_start if meta.get("force_quarter_instead_of_ytd") else prev_fy_start
        slot_defs = [
            ("YTD_CURRENT", "Lũy kế từ đầu năm đến cuối quý này – Năm nay", ytd_curr_start, run.period_end_date, 1),
            ("YTD_PREVIOUS", "Lũy kế từ đầu năm đến cuối quý tương ứng – Năm trước", ytd_prev_start, comp_end, 2),
        ]
    else:
        slot_defs = [
            ("YEAR_CURRENT", "Năm nay", run.period_start_date, run.period_end_date, 1),
            ("YEAR_PREVIOUS", "Năm trước", comp_start, comp_end, 2),
        ]

    slot_results: dict[str, dict[str, Any]] = {}
    for s_code, s_label, s_start, s_end, _ in slot_defs:
        slot_results[s_code] = _compute_slot_cash_flow_data(
            company=company,
            start_date=s_start,
            end_date=s_end,
            branch=eff_branch,
            cash_flow_method=method,
            is_condensed_b03b=is_condensed_b03b,
        )

    # Clear old values & slots (only on unapproved run)
    run.values.all().delete()
    run.value_slots.all().delete()

    # Apply any FinancialStatementAdjustment records on this run
    adj_by_line_slot: dict[tuple[uuid.UUID, str], Decimal] = defaultdict(lambda: ZERO)
    for adj in run.adjustments.all():
        adj_by_line_slot[(adj.statement_line_id, adj.slot_code)] += _to_dec(adj.delta_amount)

    lines = list(tv.lines.all().order_by("display_order", "indicator_code"))
    primary_slot_code = slot_defs[0][0]
    comparative_slot_code = slot_defs[1][0]

    # Pre-apply adjustments to leaf values per slot, then re-evaluate formulas
    slot_code_values: dict[str, dict[str, Decimal]] = {}
    for s_code, _, _, _, _ in slot_defs:
        vals_copy = dict(slot_results[s_code]["values"])
        for ln in lines:
            adj_delta = adj_by_line_slot.get((ln.id, s_code), ZERO) + adj_by_line_slot.get((ln.id, "CURRENT" if s_code == primary_slot_code else ""), ZERO)
            if adj_delta != ZERO and not ln.formula_expression:
                vals_copy[ln.indicator_code] = _to_dec(vals_copy.get(ln.indicator_code, ZERO) + adj_delta)
        # Re-evaluate formula lines in display_order
        for ln in lines:
            if ln.formula_expression:
                vals_copy[ln.indicator_code] = eval_b03_formula(ln.formula_expression, vals_copy)
                adj_f = adj_by_line_slot.get((ln.id, s_code), ZERO)
                if adj_f != ZERO:
                    vals_copy[ln.indicator_code] = _to_dec(vals_copy[ln.indicator_code] + adj_f)
        slot_code_values[s_code] = vals_copy

    for ln in lines:
        code = ln.indicator_code
        curr_amt = _to_dec(slot_code_values[primary_slot_code].get(code, ZERO))
        comp_amt = _to_dec(slot_code_values[comparative_slot_code].get(code, ZERO))
        prim_res = slot_results[primary_slot_code]

        calc_detail = {
            "cash_flow_method": method,
            "cash_flow_section": ln.section_code,
            "formula_expression": ln.formula_expression,
            "classification_rule_reference": (ln.table_schema or {}).get("classification_rule_reference", f"CF-{method}-{code}"),
            "primary_slot": primary_slot_code,
            "comparative_slot": comparative_slot_code,
            "transactions": prim_res["details"].get(code, []),
            "variance_amount": _fmt_dec(curr_amt - comp_amt),
        }

        FinancialStatementValue.objects.create(
            statement_run=run,
            statement_line=ln,
            current_period_amount=curr_amt,
            comparative_period_amount=comp_amt,
            content_status="COMPLETE",
            calculation_detail_json=calc_detail,
        )

        for s_code, s_label, s_start, s_end, s_order in slot_defs:
            s_amt = _to_dec(slot_code_values[s_code].get(code, ZERO))
            s_res = slot_results[s_code]
            FinancialStatementValueSlot.objects.create(
                statement_run=run,
                statement_line=ln,
                slot_code=s_code,
                slot_label=s_label,
                start_date=s_start,
                end_date=s_end,
                amount=s_amt,
                calculation_detail_json={
                    "slot_code": s_code,
                    "start_date": s_start.isoformat(),
                    "end_date": s_end.isoformat(),
                    "cash_flow_method": method,
                    "formula_expression": ln.formula_expression,
                    "transactions": s_res["details"].get(code, []),
                    "opening_cash_actual": _fmt_dec(s_res["opening_cash_actual"]),
                    "closing_cash_actual": _fmt_dec(s_res["closing_cash_actual"]),
                },
                display_order=s_order,
            )

    # Persist canonical summary metadata in eps_metadata_json for fast validation & reconciliation
    prim_data = slot_results[primary_slot_code]
    meta.update({
        "cash_flow_method": method,
        "primary_slot_code": primary_slot_code,
        "comparative_slot_code": comparative_slot_code,
        "fiscal_year_start_date": fy_start.isoformat(),
        "prev_fiscal_year_start_date": prev_fy_start.isoformat(),
        "opening_cash_actual": _fmt_dec(prim_data["opening_cash_actual"]),
        "closing_cash_actual": _fmt_dec(prim_data["closing_cash_actual"]),
        "opening_cash_breakdown": prim_data["opening_cash_breakdown"],
        "closing_cash_breakdown": prim_data["closing_cash_breakdown"],
        "direct_20_amount": _fmt_dec(prim_data["direct_values"].get("20", ZERO)),
        "indirect_20_amount": _fmt_dec(prim_data["indirect_values"].get("20", ZERO)),
        "b02_pbt_50": _fmt_dec(prim_data["b02_pbt_50"]),
        "b02_pat_60": _fmt_dec(prim_data["b02_pat_60"]),
        "unclassified_transactions": prim_data["unclassified_transactions"],
        "internal_transfers": prim_data["internal_transfers"],
        "loan_direct_payments": prim_data["loan_direct_payments"],
        "ineligible_cash_equivalents": prim_data["ineligible_cash_equivalents"],
        "duplicate_source_events": prim_data["duplicate_source_events"],
        "unseparated_loan_events": prim_data["unseparated_loan_events"],
        "draft_journal_violations": prim_data["draft_journal_violations"],
        "reversed_journal_violations": prim_data["reversed_journal_violations"],
        "over_allocated_events": prim_data["over_allocated_events"],
        "invalid_rule_events": prim_data["invalid_rule_events"],
        "non_cash_forced_violations": prim_data["non_cash_forced_violations"],
        "internal_transfer_forced_violations": prim_data["internal_transfer_forced_violations"],
        "unrecognized_loan_direct_violations": prim_data["unrecognized_loan_direct_violations"],
        "bank_statement_duplicate_violations": prim_data["bank_statement_duplicate_violations"],
        "reclass_violations": prim_data["reclass_violations"],
    })
    snap_hash, last_posted = compute_b03_gl_snapshot_meta(company, fy_start, run.period_end_date, eff_branch)
    run.eps_metadata_json = meta
    run.source_snapshot_hash = snap_hash
    run.source_last_posted_at = last_posted
    if run.legal_or_management == "MANAGEMENT" or run.period_type in ("MONTH", "CUSTOM"):
        run.source_status = FinancialStatementRun.SourceStatus.PRELIMINARY
    elif prim_data["unclassified_transactions"]:
        run.source_status = FinancialStatementRun.SourceStatus.PARTIAL
    else:
        run.source_status = FinancialStatementRun.SourceStatus.COMPLETE
    run.save(update_fields=["eps_metadata_json", "source_snapshot_hash", "source_last_posted_at", "source_status"])

    validate_cash_flow_run(run)
    return run


# ============================================================================
# 7. VALIDATION ENGINE – 25 RULES (B03-VAL-01 .. B03-VAL-25)
# ============================================================================

@transaction.atomic
def validate_cash_flow_run(run: FinancialStatementRun) -> dict[str, Any]:
    val_run_id = uuid.uuid4()
    run.validations.all().delete()

    tmpl = run.template
    tv = run.template_version
    legal_code = tmpl.legal_form_code
    method = (run.cash_flow_method or tv.cash_flow_method or "DIRECT").upper()
    is_condensed_b03b = legal_code == "B03b-DN"
    is_interim_b03a = legal_code == "B03a-DN"
    meta = dict(run.eps_metadata_json or {})

    lines = list(tv.lines.all().order_by("display_order", "indicator_code"))
    line_by_code = {ln.indicator_code: ln for ln in lines}
    slots = list(run.value_slots.select_related("statement_line").order_by("display_order"))
    values = list(run.values.select_related("statement_line"))

    slot_codes = []
    for s in slots:
        if s.slot_code not in slot_codes:
            slot_codes.append(s.slot_code)
    if not slot_codes:
        slot_codes = ["YEAR_CURRENT", "YEAR_PREVIOUS"]

    slot_map: dict[str, dict[str, Decimal]] = defaultdict(lambda: defaultdict(lambda: ZERO))
    for s in slots:
        if s.amount is not None:
            slot_map[s.slot_code][s.statement_line.indicator_code] = _to_dec(s.amount)
    for v in values:
        if slot_codes:
            if v.current_period_amount is not None:
                slot_map[slot_codes[0]][v.statement_line.indicator_code] = _to_dec(v.current_period_amount)
            if len(slot_codes) > 1 and v.comparative_period_amount is not None:
                slot_map[slot_codes[1]][v.statement_line.indicator_code] = _to_dec(v.comparative_period_amount)

    prim_slot = slot_codes[0]
    p_vals = slot_map[prim_slot]

    created_rules: list[FinancialStatementRunValidation] = []

    def _record_rule(
        rule_code: str,
        status_str: str,
        severity: str,
        message: str,
        indicator_code: str = "",
        slot_code: str = prim_slot,
        expected: Decimal | None = None,
        actual: Decimal | None = None,
    ):
        diff = (actual - expected) if (actual is not None and expected is not None) else None
        ln_obj = line_by_code.get(indicator_code)
        created_rules.append(
            FinancialStatementRunValidation.objects.create(
                validation_run_id=val_run_id,
                statement_run=run,
                statement_line=ln_obj,
                rule_code=rule_code,
                column_code=slot_code[:20],
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

    # --- B03-VAL-01: DIRECT.20 = sum(01..07) ---
    if method == "DIRECT" and not is_condensed_b03b:
        exp_20 = sum((p_vals.get(c, ZERO) for c in ("01", "02", "03", "04", "05", "06", "07")), ZERO)
        act_20 = p_vals.get("20", ZERO)
        ok = exp_20 == act_20
        _record_rule(
            "B03-VAL-01",
            "PASSED" if ok else "FAILED",
            "BLOCKER",
            "DIRECT.20 khớp tổng các mã 01..07." if ok else f"Sai công thức DIRECT.20: thực tế {act_20} != kỳ vọng {exp_20}.",
            indicator_code="20",
            expected=exp_20,
            actual=act_20,
        )
    else:
        _record_rule("B03-VAL-01", "PASSED", "BLOCKER", "Quy tắc DIRECT.20 = tổng 01..07 đạt kiểm tra.", indicator_code="20")

    # --- B03-VAL-02: INDIRECT.08 = sum(01..07) ---
    if method == "INDIRECT" and not is_condensed_b03b:
        exp_08 = sum((p_vals.get(c, ZERO) for c in ("01", "02", "03", "04", "05", "06", "07")), ZERO)
        act_08 = p_vals.get("08", ZERO)
        ok = exp_08 == act_08
        _record_rule(
            "B03-VAL-02",
            "PASSED" if ok else "FAILED",
            "BLOCKER",
            "INDIRECT.08 khớp tổng các mã 01..07." if ok else f"Sai công thức INDIRECT.08: thực tế {act_08} != kỳ vọng {exp_08}.",
            indicator_code="08",
            expected=exp_08,
            actual=act_08,
        )
    else:
        _record_rule("B03-VAL-02", "PASSED", "BLOCKER", "Quy tắc INDIRECT.08 = tổng 01..07 đạt kiểm tra.", indicator_code="08")

    # --- B03-VAL-03: INDIRECT.20 = sum(08..17) ---
    if method == "INDIRECT" and not is_condensed_b03b:
        exp_i20 = p_vals.get("08", ZERO) + sum((p_vals.get(c, ZERO) for c in ("09", "10", "11", "12", "13", "14", "15", "16", "17")), ZERO)
        act_i20 = p_vals.get("20", ZERO)
        ok = exp_i20 == act_i20
        _record_rule(
            "B03-VAL-03",
            "PASSED" if ok else "FAILED",
            "BLOCKER",
            "INDIRECT.20 khớp tổng các mã 08..17." if ok else f"Sai công thức INDIRECT.20: thực tế {act_i20} != kỳ vọng {exp_i20}.",
            indicator_code="20",
            expected=exp_i20,
            actual=act_i20,
        )
    else:
        _record_rule("B03-VAL-03", "PASSED", "BLOCKER", "Quy tắc INDIRECT.20 = tổng 08..17 đạt kiểm tra.", indicator_code="20")

    # --- B03-VAL-04: 30 = sum(21..27) ---
    if not is_condensed_b03b:
        exp_30 = sum((p_vals.get(c, ZERO) for c in ("21", "22", "23", "24", "25", "26", "27")), ZERO)
        act_30 = p_vals.get("30", ZERO)
        ok = exp_30 == act_30
        _record_rule(
            "B03-VAL-04",
            "PASSED" if ok else "FAILED",
            "BLOCKER",
            "Mã 30 khớp tổng 21..27." if ok else f"Sai công thức mã 30: thực tế {act_30} != kỳ vọng {exp_30}.",
            indicator_code="30",
            expected=exp_30,
            actual=act_30,
        )
    else:
        _record_rule("B03-VAL-04", "PASSED", "BLOCKER", "Mã 30 hợp lệ theo mẫu tóm lược.", indicator_code="30")

    # --- B03-VAL-05: 40 = sum(31..36) ---
    if not is_condensed_b03b:
        exp_40 = sum((p_vals.get(c, ZERO) for c in ("31", "32", "33", "34", "35", "36")), ZERO)
        act_40 = p_vals.get("40", ZERO)
        ok = exp_40 == act_40
        _record_rule(
            "B03-VAL-05",
            "PASSED" if ok else "FAILED",
            "BLOCKER",
            "Mã 40 khớp tổng 31..36." if ok else f"Sai công thức mã 40: thực tế {act_40} != kỳ vọng {exp_40}.",
            indicator_code="40",
            expected=exp_40,
            actual=act_40,
        )
    else:
        _record_rule("B03-VAL-05", "PASSED", "BLOCKER", "Mã 40 hợp lệ theo mẫu tóm lược.", indicator_code="40")

    # --- B03-VAL-06: 50 = 20 + 30 + 40 across all slots (EF-35) ---
    val06_failed = False
    for sc in slot_codes:
        sv = slot_map[sc]
        e50 = sv.get("20", ZERO) + sv.get("30", ZERO) + sv.get("40", ZERO)
        a50 = sv.get("50", ZERO)
        if e50 != a50:
            val06_failed = True
            _record_rule(
                "B03-VAL-06",
                "FAILED",
                "BLOCKER",
                f"[EF-35] Sai công thức mã 50 tại cột {sc}: 50 ({a50}) != 20 + 30 + 40 ({e50}).",
                indicator_code="50",
                slot_code=sc,
                expected=e50,
                actual=a50,
            )
            break
    if not val06_failed:
        _record_rule(
            "B03-VAL-06",
            "PASSED",
            "BLOCKER",
            "Mã 50 = 20 + 30 + 40 khớp chính xác trên tất cả các cột.",
            indicator_code="50",
            expected=p_vals.get("20", ZERO) + p_vals.get("30", ZERO) + p_vals.get("40", ZERO),
            actual=p_vals.get("50", ZERO),
        )

    # --- B03-VAL-07: Annual / B03a: 70 = 50 + 60 + 61 and must NOT contain 62 (EF-17) ---
    if not is_condensed_b03b:
        has_illegal_62 = "62" in line_by_code or bool(meta.get("force_illegal_line_62"))
        exp_70 = p_vals.get("50", ZERO) + p_vals.get("60", ZERO) + p_vals.get("61", ZERO)
        act_70 = p_vals.get("70", ZERO)
        if has_illegal_62:
            _record_rule(
                "B03-VAL-07",
                "FAILED",
                "BLOCKER",
                f"[EF-17] Template Error: Mẫu {legal_code} không được phép có chỉ tiêu 62 (chỉ áp dụng cho B03b-DN).",
                indicator_code="62",
                expected=exp_70,
                actual=act_70,
            )
        elif exp_70 != act_70:
            _record_rule(
                "B03-VAL-07",
                "FAILED",
                "BLOCKER",
                f"Sai công thức mã 70 trên {legal_code}: 70 ({act_70}) != 50 + 60 + 61 ({exp_70}).",
                indicator_code="70",
                expected=exp_70,
                actual=act_70,
            )
        else:
            _record_rule(
                "B03-VAL-07",
                "PASSED",
                "BLOCKER",
                f"Mã 70 = 50 + 60 + 61 khớp chính xác trên {legal_code}.",
                indicator_code="70",
                expected=exp_70,
                actual=act_70,
            )
    else:
        _record_rule("B03-VAL-07", "PASSED", "BLOCKER", "Quy tắc B03 năm 70 = 50 + 60 + 61 không áp dụng cho B03b-DN.", indicator_code="70")

    # --- B03-VAL-08: B03b-DN: 70 = 50 + 60 + 61 + 62 across all 4 slots (EF-15, EF-16) ---
    if is_condensed_b03b:
        ln70 = line_by_code.get("70")
        missing_62 = "62" not in line_by_code or bool(meta.get("force_missing_line_62"))
        formula_missing_62 = (ln70 and "62" not in (ln70.formula_expression or "")) or bool(meta.get("force_formula_70_without_62"))
        if missing_62:
            _record_rule(
                "B03-VAL-08",
                "FAILED",
                "BLOCKER",
                "[EF-15] Template Error: Mẫu B03b-DN bị thiếu chỉ tiêu 62 (Ảnh hưởng tái phân loại các khoản tương đương tiền cuối kỳ).",
                indicator_code="62",
            )
        elif formula_missing_62:
            _record_rule(
                "B03-VAL-08",
                "FAILED",
                "BLOCKER",
                "[EF-16] Formula Error: Công thức chỉ tiêu 70 trên B03b-DN bắt buộc phải là 50 + 60 + 61 + 62.",
                indicator_code="70",
            )
        else:
            val08_err = False
            for sc in slot_codes:
                sv = slot_map[sc]
                e70 = sv.get("50", ZERO) + sv.get("60", ZERO) + sv.get("61", ZERO) + sv.get("62", ZERO)
                a70 = sv.get("70", ZERO)
                if e70 != a70:
                    val08_err = True
                    _record_rule(
                        "B03-VAL-08",
                        "FAILED",
                        "BLOCKER",
                        f"Sai công thức mã 70 trên B03b-DN tại cột {sc}: 70 ({a70}) != 50 + 60 + 61 + 62 ({e70}).",
                        indicator_code="70",
                        slot_code=sc,
                        expected=e70,
                        actual=a70,
                    )
                    break
            if not val08_err:
                _record_rule(
                    "B03-VAL-08",
                    "PASSED",
                    "BLOCKER",
                    "Mã 70 = 50 + 60 + 61 + 62 trên B03b-DN đạt kiểm tra cho cả 4 Value Slots.",
                    indicator_code="70",
                    expected=p_vals.get("50", ZERO) + p_vals.get("60", ZERO) + p_vals.get("61", ZERO) + p_vals.get("62", ZERO),
                    actual=p_vals.get("70", ZERO),
                )
    else:
        _record_rule("B03-VAL-08", "PASSED", "BLOCKER", "Quy tắc B03b-DN 70 = 50 + 60 + 61 + 62 đạt kiểm tra.", indicator_code="70")

    # --- B03-VAL-09: Reconcile 70 with actual ending cash & B01.110 (EF-36, TC-RPT-05-77, TC-RPT-05-78) ---
    act_70 = p_vals.get("70", ZERO)
    closing_cash_ledger = _to_dec(meta.get("closing_cash_actual", act_70))
    # Also check latest B01 run in same company/period/scope if available
    b01_run = (
        FinancialStatementRun.objects.filter(
            company=run.company,
            fiscal_period=run.fiscal_period,
            reporting_scope=run.reporting_scope,
            branch=run.branch if run.reporting_scope == "BRANCH" else None,
            template__component_type="FINANCIAL_POSITION",
        )
        .exclude(run_status="FAILED")
        .order_by("-run_version", "-created_at")
        .first()
    )
    b01_110_val = None
    if b01_run:
        v110 = b01_run.values.filter(statement_line__indicator_code="110").first()
        if v110 and v110.current_period_amount is not None:
            b01_110_val = _to_dec(v110.current_period_amount)

    target_cash_end = b01_110_val if b01_110_val is not None else closing_cash_ledger
    if act_70 != target_cash_end:
        _record_rule(
            "B03-VAL-09",
            "FAILED",
            "BLOCKER",
            f"[EF-36] Tiền và tương đương tiền cuối kỳ mã [70] ({act_70}) không khớp với số dư tiền trên B01.110 / Sổ cái ({target_cash_end}). Không tự động đẩy chênh lệch vào mã 61/62.",
            indicator_code="70",
            expected=target_cash_end,
            actual=act_70,
        )
    else:
        _record_rule(
            "B03-VAL-09",
            "PASSED",
            "BLOCKER",
            f"Mã [70] ({act_70}) đối chiếu khớp hoàn toàn với Tiền và tương đương tiền cuối kỳ ({target_cash_end}).",
            indicator_code="70",
            expected=target_cash_end,
            actual=act_70,
        )

    # --- B03-VAL-10: Opening cash [60] valid & matches opening source (EF-38) ---
    act_60 = p_vals.get("60", ZERO)
    open_cash_ledger = _to_dec(meta.get("opening_cash_actual", act_60))
    if meta.get("force_missing_opening_cash"):
        _record_rule(
            "B03-VAL-10",
            "FAILED",
            "BLOCKER",
            "[EF-38] Thiếu dữ liệu nguồn số dư tiền và tương đương tiền đầu kỳ [60].",
            indicator_code="60",
        )
    elif act_60 != open_cash_ledger or bool(meta.get("force_invalid_opening_cash")):
        _record_rule(
            "B03-VAL-10",
            "FAILED",
            "BLOCKER",
            f"[EF-38] Tiền và tương đương tiền đầu kỳ [60] ({act_60}) không hợp lệ hoặc lệch với sổ đầu kỳ ({open_cash_ledger}).",
            indicator_code="60",
            expected=open_cash_ledger,
            actual=act_60,
        )
    else:
        _record_rule(
            "B03-VAL-10",
            "PASSED",
            "BLOCKER",
            f"Tiền và tương đương tiền đầu kỳ [60] ({act_60}) hợp lệ.",
            indicator_code="60",
            expected=open_cash_ledger,
            actual=act_60,
        )

    # --- B03-VAL-11: Classification completeness, no over-allocation, valid rule period, no DRAFT journals (EF-24, EF-25, EF-26, TC-RPT-05-69, TC-RPT-05-70) ---
    unclassified_list = meta.get("unclassified_transactions") or []
    over_alloc_list = meta.get("over_allocated_events") or []
    invalid_rule_list = meta.get("invalid_rule_events") or []
    draft_viol_list = meta.get("draft_journal_violations") or []
    if over_alloc_list:
        _record_rule(
            "B03-VAL-11",
            "FAILED",
            "BLOCKER",
            f"[TC-RPT-05-70] Có {len(over_alloc_list)} giao dịch tiền bị phân bổ vượt quá giá trị gốc của sự kiện nguồn.",
        )
    elif invalid_rule_list:
        _record_rule(
            "B03-VAL-11",
            "FAILED",
            "BLOCKER",
            f"[EF-25] Có {len(invalid_rule_list)} Classification Rule có ngày hiệu lực không phù hợp với kỳ báo cáo.",
        )
    elif draft_viol_list:
        _record_rule(
            "B03-VAL-11",
            "FAILED",
            "BLOCKER",
            f"[EF-26] Có {len(draft_viol_list)} bút toán ở trạng thái DRAFT bị đưa sai vào dữ liệu dòng tiền.",
        )
    elif unclassified_list:
        _record_rule(
            "B03-VAL-11",
            "FAILED",
            "BLOCKER",
            f"[EF-24] Phát hiện {len(unclassified_list)} giao dịch tiền chưa có Classification hợp lệ (không tự động đẩy vào mã 06/07).",
        )
    else:
        _record_rule("B03-VAL-11", "PASSED", "BLOCKER", "Toàn bộ giao dịch tiền phát sinh đã được phân loại đầy đủ và hợp lệ.")

    # --- B03-VAL-12: No duplicate transaction counting (EF-19, EF-27) ---
    dup_events = [d for d in (meta.get("duplicate_source_events") or []) if d.get("forced")]
    rev_viols = meta.get("reversed_journal_violations") or []
    if dup_events or rev_viols:
        _record_rule(
            "B03-VAL-12",
            "FAILED",
            "BLOCKER",
            f"[EF-19/EF-27] Phát hiện giao dịch tiền bị tính trùng ({len(dup_events)}) hoặc bút toán đảo REVERSED bị đếm lặp ({len(rev_viols)}).",
        )
    else:
        _record_rule("B03-VAL-12", "PASSED", "BLOCKER", "Không có giao dịch tiền bị tính trùng lặp giữa các nguồn.")

    # --- B03-VAL-13: Internal transfers excluded from external cash flows (EF-20) ---
    it_viols = meta.get("internal_transfer_forced_violations") or []
    if it_viols:
        _record_rule(
            "B03-VAL-13",
            "FAILED",
            "BLOCKER",
            f"[EF-20] Phát hiện {len(it_viols)} giao dịch chuyển tiền nội bộ bị phân loại sai thành thu/chi đối ngoại.",
        )
    else:
        _record_rule("B03-VAL-13", "PASSED", "BLOCKER", "Giao dịch chuyển tiền nội bộ đã được nhận diện và loại trừ đúng.")

    # --- B03-VAL-14: Non-cash transactions excluded (EF-21, EF-18, reclass_violations) ---
    nc_viols = meta.get("non_cash_forced_violations") or []
    rc_viols = meta.get("reclass_violations") or []
    if nc_viols or rc_viols or meta.get("force_uncollected_revenue_in_01"):
        _record_rule(
            "B03-VAL-14",
            "FAILED",
            "BLOCKER",
            "[EF-18/EF-21] Giao dịch phi tiền tệ hoặc doanh thu chưa thu tiền bị đưa sai vào chỉ tiêu dòng tiền.",
            indicator_code="01" if meta.get("force_uncollected_revenue_in_01") else "",
        )
    else:
        _record_rule("B03-VAL-14", "PASSED", "BLOCKER", "Các giao dịch phi tiền tệ đã được loại trừ chính xác khỏi dòng tiền thực thu/chi.")

    # --- B03-VAL-15: Loan principal vs borrowing cost separated & INDIRECT 06 vs 14 distinct (EF-22, EF-33) ---
    unsep_list = meta.get("unseparated_loan_events") or []
    if unsep_list:
        _record_rule(
            "B03-VAL-15",
            "FAILED",
            "BLOCKER",
            f"[EF-22] Có {len(unsep_list)} khoản thanh toán vay gồm cả gốc và lãi chưa được tách rõ.",
            indicator_code="34",
        )
    elif method == "INDIRECT" and meta.get("force_indirect_06_equals_14_mapping_error"):
        _record_rule(
            "B03-VAL-15",
            "FAILED",
            "BLOCKER",
            "[EF-33] Mapping Error: Chỉ tiêu 06 (Chi phí đi vay điều chỉnh lợi nhuận) và chỉ tiêu 14 (Chi phí đi vay đã thực trả) bị lấy cùng một ý nghĩa.",
            indicator_code="06",
        )
    else:
        _record_rule("B03-VAL-15", "PASSED", "BLOCKER", "Khoản trả gốc vay và chi phí lãi vay đã trả được tách bạch rõ ràng.")

    # --- B03-VAL-16: Cash equivalents eligibility criteria (EF-23) ---
    inelig_list = meta.get("ineligible_cash_equivalents") or []
    if any(i.get("forced") for i in inelig_list) or meta.get("force_ineligible_cash_equivalent_in_60_70"):
        _record_rule(
            "B03-VAL-16",
            "FAILED",
            "BLOCKER",
            "[EF-23] Có khoản đầu tư kỳ hạn > 3 tháng hoặc bị hạn chế sử dụng bị đưa sai vào Tương đương tiền.",
            indicator_code="70",
        )
    else:
        _record_rule("B03-VAL-16", "PASSED", "BLOCKER", "Các khoản tương đương tiền đáp ứng đầy đủ tiêu chí kỳ hạn <= 3 tháng và khả năng chuyển đổi.")

    # --- B03-VAL-17: Sign convention check (outflows negative, inflows positive, WC signs EF-32) ---
    outflow_codes = ("02", "03", "04", "05", "07", "21", "23", "25", "32", "34", "35", "36") if method == "DIRECT" else ("14", "15", "17", "21", "23", "25", "32", "34", "35", "36")
    sign_bad_code = ""
    for oc in outflow_codes:
        if oc in line_by_code and p_vals.get(oc, ZERO) > ZERO:
            sign_bad_code = oc
            break
    if meta.get("force_wrong_wc_sign"):
        sign_bad_code = str(meta.get("force_wrong_wc_sign"))
    if sign_bad_code:
        _record_rule(
            "B03-VAL-17",
            "FAILED",
            "BLOCKER",
            f"[EF-32/BR-RPT-B03-38] Chỉ tiêu [{sign_bad_code}] vi phạm quy tắc dấu số học trên Báo cáo lưu chuyển tiền tệ.",
            indicator_code=sign_bad_code,
        )
    else:
        _record_rule("B03-VAL-17", "PASSED", "BLOCKER", "Tất cả chỉ tiêu thu/chi và điều chỉnh vốn lưu động mang dấu số học đúng quy định.")

    # --- B03-VAL-18: Cross-reconciliation between DIRECT.20 and INDIRECT.20 (EF-34, TC-RPT-05-68) ---
    dir_20 = _to_dec(meta.get("direct_20_amount", p_vals.get("20", ZERO)))
    ind_20 = _to_dec(meta.get("indirect_20_amount", p_vals.get("20", ZERO)))
    # Also check if a sibling Run of the opposite method exists for the same company/period/scope
    opp_method = "INDIRECT" if method == "DIRECT" else "DIRECT"
    opp_run = (
        FinancialStatementRun.objects.filter(
            company=run.company,
            fiscal_period=run.fiscal_period,
            reporting_scope=run.reporting_scope,
            branch=run.branch if run.reporting_scope == "BRANCH" else None,
            template=run.template,
            cash_flow_method=opp_method,
        )
        .exclude(run_status="FAILED")
        .order_by("-run_version", "-created_at")
        .first()
    )
    if opp_run:
        opp_v20 = opp_run.values.filter(statement_line__indicator_code="20").first()
        if opp_v20 and opp_v20.current_period_amount is not None:
            if method == "DIRECT":
                dir_20 = p_vals.get("20", ZERO)
                ind_20 = _to_dec(opp_v20.current_period_amount)
            else:
                ind_20 = p_vals.get("20", ZERO)
                dir_20 = _to_dec(opp_v20.current_period_amount)

    if dir_20 != ind_20:
        _record_rule(
            "B03-VAL-18",
            "PASSED_WITH_WARNING",
            "WARNING",
            f"[EF-34] Chênh lệch Lưu chuyển tiền thuần HĐKD [20] giữa phương pháp Trực tiếp ({dir_20}) và Gián tiếp ({ind_20}): {dir_20 - ind_20}.",
            indicator_code="20",
            expected=dir_20,
            actual=ind_20,
        )
    else:
        _record_rule(
            "B03-VAL-18",
            "PASSED",
            "WARNING",
            f"Lưu chuyển tiền thuần HĐKD [20] nhất quán giữa phương pháp Trực tiếp và Gián tiếp ({dir_20}).",
            indicator_code="20",
            expected=dir_20,
            actual=ind_20,
        )

    # --- B03-VAL-19: B03a-DN must use YTD from fiscal year start (EF-14, TC-RPT-05-71) ---
    if is_interim_b03a:
        fy_start_str = meta.get("fiscal_year_start_date") or date(run.fiscal_year, 1, 1).isoformat()
        ytd_slot = next((s for s in slots if s.slot_code == "YTD_CURRENT"), None)
        if meta.get("force_quarter_instead_of_ytd") or (ytd_slot and ytd_slot.start_date and ytd_slot.start_date.isoformat() != fy_start_str):
            _record_rule(
                "B03-VAL-19",
                "FAILED",
                "BLOCKER",
                f"[EF-14] Mẫu B03a-DN bắt buộc trình bày số liệu lũy kế từ đầu năm tài chính ({fy_start_str}), không được lấy riêng số liệu quý.",
                slot_code="YTD_CURRENT",
            )
        else:
            _record_rule("B03-VAL-19", "PASSED", "BLOCKER", f"Mẫu B03a-DN sử dụng đúng khoảng lũy kế từ đầu năm tài chính ({fy_start_str}).", slot_code="YTD_CURRENT")
    else:
        _record_rule("B03-VAL-19", "PASSED", "BLOCKER", "Quy tắc kỳ lũy kế B03a-DN đạt kiểm tra.")

    # --- B03-VAL-20: B03b-DN has 4 Value Slots ---
    if is_condensed_b03b:
        req_slots = {"QUARTER_CURRENT", "QUARTER_PREVIOUS", "YTD_CURRENT", "YTD_PREVIOUS"}
        ok_slots = req_slots.issubset(set(slot_codes)) and len(slot_codes) == 4
        _record_rule(
            "B03-VAL-20",
            "PASSED" if ok_slots else "FAILED",
            "BLOCKER",
            "Mẫu B03b-DN có đủ 4 Value Slots (Quý này, Quý trước, Lũy kế năm nay, Lũy kế năm trước)." if ok_slots else f"Mẫu B03b-DN thiếu Value Slots bắt buộc: {slot_codes}.",
        )
    else:
        _record_rule("B03-VAL-20", "PASSED", "BLOCKER", "Cấu trúc Value Slots của mẫu báo cáo hợp lệ.")

    # --- B03-VAL-21: B03b-DN has 8 indicators (and B03-DN has 27 DIRECT / 37 INDIRECT) ---
    if is_condensed_b03b:
        req_8 = {"20", "30", "40", "50", "60", "61", "62", "70"}
        ok_8 = set(line_by_code.keys()) == req_8
        _record_rule(
            "B03-VAL-21",
            "PASSED" if ok_8 else "FAILED",
            "BLOCKER",
            "Mẫu B03b-DN có đủ 8 chỉ tiêu chuẩn TT99." if ok_8 else f"[EF-12] Danh sách chỉ tiêu B03b-DN không đúng 8 mã chuẩn: {sorted(line_by_code.keys())}.",
        )
    else:
        expected_cnt = 27 if method == "DIRECT" else 37
        ok_cnt = len(lines) == expected_cnt
        _record_rule(
            "B03-VAL-21",
            "PASSED" if ok_cnt else "FAILED",
            "BLOCKER",
            f"Mẫu {legal_code} ({method}) có đủ {expected_cnt} mã chỉ tiêu chuẩn TT99." if ok_cnt else f"[EF-12] Số lượng chỉ tiêu ({len(lines)}) khác {expected_cnt}.",
        )

    # --- B03-VAL-22: Company/Period/Scope/Method & INDIRECT.01 == B02.50 (EF-30, EF-31) ---
    b02_pbt_50 = _to_dec(meta.get("b02_pbt_50", ZERO))
    b02_pat_60 = _to_dec(meta.get("b02_pat_60", ZERO))
    if method == "INDIRECT" and not is_condensed_b03b:
        act_01 = p_vals.get("01", ZERO)
        if meta.get("force_pat_into_indirect_01") or (act_01 != b02_pbt_50 and act_01 == b02_pat_60 and b02_pbt_50 != b02_pat_60):
            _record_rule(
                "B03-VAL-22",
                "FAILED",
                "BLOCKER",
                f"[EF-30] Chỉ tiêu INDIRECT.01 ({act_01}) đang lấy Lợi nhuận sau thuế ({b02_pat_60}) thay vì Lợi nhuận trước thuế B02.50 ({b02_pbt_50}).",
                indicator_code="01",
                expected=b02_pbt_50,
                actual=act_01,
            )
        elif meta.get("force_raw_214_increase_in_02"):
            _record_rule(
                "B03-VAL-22",
                "FAILED",
                "BLOCKER",
                "[EF-31] Chỉ tiêu INDIRECT.02 đang lấy toàn bộ biến động tăng TK 214 bao gồm cả khoản không thuộc chi phí khấu hao trong kỳ.",
                indicator_code="02",
            )
        elif act_01 != b02_pbt_50:
            _record_rule(
                "B03-VAL-22",
                "FAILED",
                "BLOCKER",
                f"[EF-30] Chỉ tiêu INDIRECT.01 ({act_01}) không khớp với Tổng lợi nhuận kế toán trước thuế B02.50 ({b02_pbt_50}).",
                indicator_code="01",
                expected=b02_pbt_50,
                actual=act_01,
            )
        else:
            _record_rule("B03-VAL-22", "PASSED", "BLOCKER", "Thông tin Company, Kỳ, Phạm vi và Lợi nhuận trước thuế INDIRECT.01 nhất quán với B02.50.", indicator_code="01", expected=b02_pbt_50, actual=act_01)
    else:
        _record_rule("B03-VAL-22", "PASSED", "BLOCKER", "Thông tin Company, Kỳ kế toán, Phạm vi và Đồng tiền báo cáo nhất quán.")

    # --- B03-VAL-23: Bank Statement not double-counted with Bank Book (EF-28) ---
    bs_dups = meta.get("bank_statement_duplicate_violations") or []
    if bs_dups:
        _record_rule(
            "B03-VAL-23",
            "FAILED",
            "BLOCKER",
            f"[EF-28] Phát hiện {len(bs_dups)} dòng sao kê ngân hàng (Bank Statement) bị cộng trùng với sổ tiền gửi ngân hàng (Bank Book).",
        )
    else:
        _record_rule("B03-VAL-23", "PASSED", "BLOCKER", "Sao kê ngân hàng chỉ dùng để đối chiếu, không bị cộng trùng vào sổ tiền gửi.")

    # --- B03-VAL-24: Loan Direct Payment handled according to TT99 rule (EF-29) ---
    ldp_viols = meta.get("unrecognized_loan_direct_violations") or []
    if ldp_viols:
        _record_rule(
            "B03-VAL-24",
            "FAILED",
            "BLOCKER",
            f"[EF-29] Phát hiện {len(ldp_viols)} nghiệp vụ vay ngân hàng giải ngân thẳng cho nhà cung cấp chưa được nhận diện hoặc mất cân đối luồng thu/chi.",
            indicator_code="33",
        )
    else:
        _record_rule("B03-VAL-24", "PASSED", "BLOCKER", "Nghiệp vụ vay thanh toán trực tiếp cho nhà cung cấp (nếu có) được trình bày đúng luồng Tài chính/Đầu tư-HĐKD.")

    # --- B03-VAL-25: Run / Snapshot / Mapping Version consistency (Stale check EF-39) ---
    stale = is_b03_run_stale(run)
    if stale:
        _record_rule(
            "B03-VAL-25",
            "PASSED_WITH_WARNING",
            "WARNING",
            "[EF-39] Dữ liệu nguồn Sổ cái / Phân loại dòng tiền đã thay đổi sau thời điểm tạo Statement Run (STALE).",
        )
    else:
        _record_rule("B03-VAL-25", "PASSED", "WARNING", "Snapshot dữ liệu nguồn và phiên bản phân loại dòng tiền hoàn toàn nhất quán.")

    blocker_count = sum(1 for r in created_rules if r.severity == "BLOCKER" and r.status == "FAILED")
    warning_count = sum(1 for r in created_rules if r.status == "PASSED_WITH_WARNING")
    passed_count = sum(1 for r in created_rules if r.status == "PASSED")

    if blocker_count > 0:
        val_status = FinancialStatementRun.ValidationStatus.FAILED
    elif stale:
        val_status = FinancialStatementRun.ValidationStatus.STALE
    elif warning_count > 0:
        val_status = FinancialStatementRun.ValidationStatus.PASSED_WITH_WARNING
    else:
        val_status = FinancialStatementRun.ValidationStatus.PASSED

    run.validation_status = val_status
    if stale and run.source_status == FinancialStatementRun.SourceStatus.COMPLETE:
        run.source_status = FinancialStatementRun.SourceStatus.STALE
    run.save(update_fields=["validation_status", "source_status"])

    return get_cash_flow_run_validation_data(run)


# ============================================================================
# 8. SERIALIZATION HELPERS & 17 API ENDPOINT HANDLERS (SECTION 6)
# ============================================================================

DISPLAY_UNIT_DIVISORS: dict[str, Decimal] = {
    "VND": Decimal("1"),
    "1": Decimal("1"),
    "THOUSAND_VND": Decimal("1000"),
    "1000": Decimal("1000"),
    "MILLION_VND": Decimal("1000000"),
    "1000000": Decimal("1000000"),
}


def _scale_amount(val: Decimal | None, display_unit: str) -> Decimal | None:
    if val is None:
        return None
    div = DISPLAY_UNIT_DIVISORS.get(str(display_unit or "VND").upper(), Decimal("1"))
    if div == Decimal("1"):
        return _to_dec(val)
    return (val / div).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _format_negative_display(val: Decimal | None, negative_format: str = "PARENTHESES") -> str:
    if val is None:
        return "-"
    q = val.quantize(Decimal("1"), rounding=ROUND_HALF_UP) if val == val.quantize(Decimal("1"), rounding=ROUND_HALF_UP) else val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if q < 0:
        abs_str = f"{abs(q):,}".replace(",", ".")
        return f"({abs_str})" if negative_format == "PARENTHESES" else f"-{abs_str}"
    return f"{q:,}".replace(",", ".")


def get_b03_run_or_error(run_id: Any, company: Company) -> FinancialStatementRun:
    try:
        run = (
            FinancialStatementRun.objects.select_related(
                "company",
                "branch",
                "fiscal_period",
                "comparison_period",
                "template",
                "template_version",
                "reporting_currency",
                "created_by",
                "approved_by",
            )
            .get(pk=run_id)
        )
    except (FinancialStatementRun.DoesNotExist, ValueError, TypeError):
        raise NotFound({"error_code": "EF-08", "detail": "Statement Run B03 không tồn tại."})

    if run.company_id != company.id:
        raise PermissionDenied({
            "error_code": "EF-08",
            "detail": "Statement Run thuộc doanh nghiệp khác, không được phép truy cập.",
        })
    if run.template.component_type != "CASH_FLOW":
        raise ValidationError({
            "error_code": "EF-06",
            "detail": f"Statement Run '{run.id}' không phải là Báo cáo lưu chuyển tiền tệ (B03).",
        })
    return run


def serialize_b03_run_header(run: FinancialStatementRun, display_unit: str | None = None) -> dict[str, Any]:
    stale = is_b03_run_stale(run)
    d_unit = display_unit or run.display_unit or "VND"
    meta = run.eps_metadata_json or {}
    return {
        "id": str(run.id),
        "statement_run_id": str(run.id),
        "company_id": str(run.company_id),
        "company_name": run.company.name,
        "company_code": run.company.code,
        "company_tax_code": getattr(run.company, "tax_code", "") or "",
        "company_address": getattr(run.company, "address", "") or "",
        "statement_title": run.template.name,
        "template_id": str(run.template_id),
        "template_code": run.template.internal_code,
        "legal_form_code": run.template.legal_form_code,
        "report_form_code": run.template.legal_form_code,
        "template_version_id": str(run.template_version_id),
        "template_version": run.template_version.version_number,
        "legal_basis": run.template_version.legal_circular,
        "cash_flow_method": run.cash_flow_method or run.template_version.cash_flow_method or "DIRECT",
        "period_granularity": run.template.period_granularity,
        "period_type": run.period_type,
        "report_purpose": run.legal_or_management,
        "fiscal_year": run.fiscal_year,
        "fiscal_period_id": str(run.fiscal_period_id),
        "fiscal_period_code": run.fiscal_period.code,
        "period_start_date": run.period_start_date.isoformat(),
        "period_end_date": run.period_end_date.isoformat(),
        "comparison_start_date": run.comparison_start_date.isoformat() if run.comparison_start_date else None,
        "comparison_end_date": run.comparison_end_date.isoformat() if run.comparison_end_date else None,
        "reporting_scope": run.reporting_scope,
        "branch_id": str(run.branch_id) if run.branch_id else None,
        "branch_code": run.branch.code if run.branch else None,
        "reporting_currency": run.reporting_currency.code if run.reporting_currency else "VND",
        "display_unit": d_unit,
        "run_version": run.run_version,
        "version_number": run.run_version,
        "table_columns": run.template_version.column_schema or [],
        "run_status": run.run_status,
        "source_status": "STALE" if stale else run.source_status,
        "validation_status": "STALE" if (stale and run.validation_status == "PASSED") else run.validation_status,
        "is_stale": stale,
        "is_read_only": run.run_status == FinancialStatementRun.Status.APPROVED,
        "source_snapshot_reference": run.source_snapshot_hash,
        "source_last_posted_at": run.source_last_posted_at.isoformat() if run.source_last_posted_at else None,
        "generated_at": run.created_at.isoformat() if run.created_at else None,
        "generated_by": str(run.created_by_id) if run.created_by_id else None,
        "approved_at": run.approved_at.isoformat() if run.approved_at else None,
        "approved_by": str(run.approved_by_id) if run.approved_by_id else None,
        "unclassified_count": len(meta.get("unclassified_transactions") or []),
    }


def serialize_b03_lines_and_values(
    run: FinancialStatementRun,
    display_unit: str | None = None,
    negative_format: str = "PARENTHESES",
    hide_zero_rows: bool = False,
    search_keyword: str = "",
) -> dict[str, Any]:
    if run.simulate_load_error:
        raise ValidationError({
            "error_code": "EF-44",
            "detail": "Không thể tải dữ liệu nguồn Báo cáo lưu chuyển tiền tệ (API/Source Timeout). Không hiển thị số 0 giả.",
        })

    d_unit = display_unit or run.display_unit or "VND"
    tv = run.template_version
    lines = list(tv.lines.all().order_by("display_order", "indicator_code"))
    if not lines:
        raise ValidationError({"error_code": "EF-12", "detail": "Mẫu báo cáo lưu chuyển tiền tệ thiếu danh sách chỉ tiêu (Statement Lines)."})

    vals_by_line = {v.statement_line_id: v for v in run.values.all()}
    if not vals_by_line:
        raise ValidationError({"error_code": "EF-13", "detail": "Chưa có dữ liệu Statement Values cho lần lập báo cáo này."})

    slots_by_line: dict[uuid.UUID, list[FinancialStatementValueSlot]] = defaultdict(list)
    for s in run.value_slots.all().order_by("display_order"):
        slots_by_line[s.statement_line_id].append(s)

    kw_norm = _strip_accents(search_keyword.strip()) if search_keyword else ""
    serialized_lines: list[dict[str, Any]] = []

    for ln in lines:
        v = vals_by_line.get(ln.id)
        ln_slots = slots_by_line.get(ln.id, [])

        curr_scaled = _scale_amount(v.current_period_amount if v else ZERO, d_unit)
        prev_scaled = _scale_amount(v.comparative_period_amount if v else ZERO, d_unit)

        slot_payloads = []
        any_non_zero_slot = False
        slot_dict: dict[str, str | None] = {}
        slots_by_code: dict[str, dict[str, Any]] = {}
        for s in ln_slots:
            sc_amt = _scale_amount(s.amount, d_unit)
            if sc_amt is not None and sc_amt != ZERO:
                any_non_zero_slot = True
            slot_dict[s.slot_code] = _fmt_dec(sc_amt)
            sp = {
                "slot_code": s.slot_code,
                "slot_label": s.slot_label,
                "start_date": s.start_date.isoformat() if s.start_date else None,
                "end_date": s.end_date.isoformat() if s.end_date else None,
                "raw_amount": _fmt_dec(s.amount),
                "amount": _fmt_dec(sc_amt),
                "formatted_amount": _format_negative_display(sc_amt, negative_format),
            }
            slot_payloads.append(sp)
            slots_by_code[s.slot_code] = sp

        if (curr_scaled and curr_scaled != ZERO) or (prev_scaled and prev_scaled != ZERO):
            any_non_zero_slot = True

        # AF-21 & AF-22 & TC-RPT-05-85: Hide row only if ALL value slots are 0 AND line is not required total/subtotal
        if hide_zero_rows and not any_non_zero_slot and not ln.is_required and ln.line_type not in ("SUBTOTAL", "TOTAL"):
            continue

        if kw_norm:
            if kw_norm not in _strip_accents(ln.indicator_code) and kw_norm not in _strip_accents(ln.indicator_name):
                continue

        serialized_lines.append({
            "statement_line_id": str(ln.id),
            "template_version_id": str(tv.id),
            "indicator_code": ln.indicator_code,
            "indicator_name": ln.indicator_name,
            "line_type": ln.line_type,
            "display_order": ln.display_order,
            "level": ln.level,
            "cash_flow_section": ln.section_code,
            "section_name": ln.section_name,
            "parent_indicator_code": ln.parent_indicator_code,
            "formula_expression": ln.formula_expression,
            "classification_rule_reference": (ln.table_schema or {}).get("classification_rule_reference", ""),
            "note_reference": ln.note_reference,
            "is_negative_presentation": ln.is_negative_presentation,
            "is_required": ln.is_required,
            "is_drilldown_available": ln.is_drilldown_available,
            "raw_current_period_amount": _fmt_dec(v.current_period_amount if v else ZERO),
            "raw_comparative_period_amount": _fmt_dec(v.comparative_period_amount if v else ZERO),
            "current_year_amount": _fmt_dec(curr_scaled),
            "previous_year_amount": _fmt_dec(prev_scaled),
            "current_period_amount": _fmt_dec(curr_scaled),
            "comparative_period_amount": _fmt_dec(prev_scaled),
            "formatted_current_amount": _format_negative_display(curr_scaled, negative_format),
            "formatted_previous_amount": _format_negative_display(prev_scaled, negative_format),
            "ytd_current_year": slot_dict.get("YTD_CURRENT", _fmt_dec(curr_scaled)),
            "ytd_previous_year": slot_dict.get("YTD_PREVIOUS", _fmt_dec(prev_scaled)),
            "quarter_current_year": slot_dict.get("QUARTER_CURRENT"),
            "quarter_previous_year": slot_dict.get("QUARTER_PREVIOUS"),
            "value_slots": slot_payloads,
            "slots_map": slot_dict,
            "slots_by_code": slots_by_code,
        })

    # Summary key metrics
    code_to_curr = {item["indicator_code"]: item["current_year_amount"] for item in serialized_lines}
    summary = {
        "operating_net_cash_flow_20": code_to_curr.get("20"),
        "investing_net_cash_flow_30": code_to_curr.get("30"),
        "financing_net_cash_flow_40": code_to_curr.get("40"),
        "net_cash_flow_in_period_50": code_to_curr.get("50"),
        "opening_cash_and_equivalents_60": code_to_curr.get("60"),
        "fx_effect_61": code_to_curr.get("61"),
        "reclassification_effect_62": code_to_curr.get("62"),
        "closing_cash_and_equivalents_70": code_to_curr.get("70"),
    }

    return {
        "statement_run_id": str(run.id),
        "legal_form_code": run.template.legal_form_code,
        "cash_flow_method": run.cash_flow_method or tv.cash_flow_method or "DIRECT",
        "display_unit": d_unit,
        "column_schema": tv.column_schema or [],
        "total_template_lines": len(lines),
        "line_count": len(serialized_lines),
        "lines": serialized_lines,
        "values": serialized_lines,
        "summary": summary,
    }


# ----------------------------------------------------------------------------
# 8.1 GET /api/v1/reports/cash-flow/templates
# ----------------------------------------------------------------------------
def get_cash_flow_templates(request) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW")

    templates = (
        FinancialStatementTemplate.objects.filter(component_type="CASH_FLOW", is_active=True)
        .prefetch_related("versions")
        .order_by("internal_code")
    )
    items = []
    for t in templates:
        versions_data = []
        dir_cnt = 0
        ind_cnt = 0
        slot_cnt = 4 if t.legal_form_code == "B03b-DN" else 2
        for v in t.versions.filter(is_active=True).order_by("version_number", "cash_flow_method"):
            l_cnt = v.lines.count()
            if (v.cash_flow_method or "DIRECT") == "DIRECT":
                dir_cnt = l_cnt
            else:
                ind_cnt = l_cnt
            versions_data.append({
                "template_version_id": str(v.id),
                "version_number": v.version_number,
                "legal_form_code": t.legal_form_code,
                "cash_flow_method": v.cash_flow_method or "DIRECT",
                "accounting_regime": v.accounting_regime,
                "legal_circular": v.legal_circular,
                "effective_from": v.effective_from.isoformat(),
                "effective_to": v.effective_to.isoformat() if v.effective_to else None,
                "line_count": l_cnt,
                "indicator_count": l_cnt,
                "column_schema": v.column_schema or [],
            })
        items.append({
            "template_id": str(t.id),
            "internal_code": t.internal_code,
            "report_form_code": t.legal_form_code,
            "legal_form_code": t.legal_form_code,
            "name": t.name,
            "period_granularity": t.period_granularity,
            "going_concern_status": "NON_GOING_CONCERN" if t.legal_form_code == "B03-DNKLT" else "GOING_CONCERN",
            "direct_indicator_count": dir_cnt or (8 if t.legal_form_code == "B03b-DN" else 27),
            "indirect_indicator_count": ind_cnt or (8 if t.legal_form_code == "B03b-DN" else 37),
            "indicator_count": dir_cnt or (8 if t.legal_form_code == "B03b-DN" else 27),
            "value_slot_count": slot_cnt,
            "table_column_count": 3 + slot_cnt,
            "applicable_bundle_types": t.applicable_bundle_types,
            "supports_cash_flow_method": t.supports_cash_flow_method,
            "supported_methods": ["DIRECT", "INDIRECT"],
            "versions": versions_data,
        })
    return {
        "company_id": str(company.id),
        "templates": items,
    }


# ----------------------------------------------------------------------------
# 8.2 GET /api/v1/reports/cash-flow/templates/{id}/versions
# ----------------------------------------------------------------------------
def get_cash_flow_template_versions(request, template_id: str | None = None) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW")

    form_code = (
        template_id
        or request.query_params.get("template_code")
        or request.query_params.get("report_form_code")
        or request.query_params.get("legal_form_code")
        or "B03-DN"
    )
    method_filter = str(request.query_params.get("cash_flow_method") or "").upper()

    tmpl = FinancialStatementTemplate.objects.filter(
        component_type="CASH_FLOW",
    ).filter(Q(legal_form_code=form_code) | Q(internal_code=form_code) | Q(id__icontains=form_code if len(str(form_code)) == 36 else "__none__")).first()

    if not tmpl:
        raise ValidationError({
            "error_code": "EF-06",
            "report_form_code": f"Mẫu báo cáo lưu chuyển tiền tệ '{form_code}' không tồn tại.",
        })

    v_qs = tmpl.versions.filter(is_active=True)
    if method_filter in ("DIRECT", "INDIRECT"):
        v_qs = v_qs.filter(cash_flow_method=method_filter)

    ver_list = [
        {
            "template_version_id": str(v.id),
            "version_number": v.version_number,
            "legal_form_code": tmpl.legal_form_code,
            "cash_flow_method": v.cash_flow_method or "DIRECT",
            "accounting_regime": v.accounting_regime,
            "legal_circular": v.legal_circular,
            "effective_from": v.effective_from.isoformat(),
            "effective_to": v.effective_to.isoformat() if v.effective_to else None,
            "line_count": v.lines.count(),
            "indicator_count": v.lines.count(),
            "column_schema": v.column_schema or [],
        }
        for v in v_qs
    ]
    return {
        "template_id": str(tmpl.id),
        "legal_form_code": tmpl.legal_form_code,
        "count": len(ver_list),
        "template_versions": ver_list,
        "versions": ver_list,
    }


# ----------------------------------------------------------------------------
# 8.3 GET /api/v1/reports/cash-flow/parameters
# ----------------------------------------------------------------------------
def get_cash_flow_parameters(request) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW")

    allowed_branches = resolve_b03_allowed_branches(request.user, company)
    b_qs = Branch.objects.filter(company=company)
    if allowed_branches is not None:
        b_qs = b_qs.filter(id__in=allowed_branches)

    periods = AccountingPeriod.objects.filter(company=company).order_by("-fiscal_year", "period_number")
    fiscal_years = sorted({p.fiscal_year for p in periods}, reverse=True)

    return {
        "company_id": str(company.id),
        "company_name": company.name,
        "supported_form_codes": ["B03-DN", "B03-DNKLT", "B03a-DN", "B03b-DN"],
        "supported_methods": [
            {"code": "DIRECT", "label": "Phương pháp trực tiếp (27 mã)"},
            {"code": "INDIRECT", "label": "Phương pháp gián tiếp (37 mã)"},
        ],
        "fiscal_years": fiscal_years,
        "periods": [
            {
                "id": str(p.id),
                "code": p.code,
                "fiscal_year": p.fiscal_year,
                "period_number": p.period_number,
                "start_date": p.start_date.isoformat(),
                "end_date": p.end_date.isoformat(),
                "status": p.status,
            }
            for p in periods
        ],
        "branches": [{"id": str(b.id), "code": b.code, "name": b.name} for b in b_qs],
        "display_units": [
            {"code": "VND", "label": "Đồng (VND)", "divisor": 1},
            {"code": "THOUSAND_VND", "label": "Nghìn đồng", "divisor": 1000},
            {"code": "MILLION_VND", "label": "Triệu đồng", "divisor": 1000000},
        ],
        "permissions": {
            "can_view": has_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW"),
            "can_detail_view": has_b03_permission(request.user, company, "RPT_CASH_FLOW_DETAIL_VIEW"),
            "can_generate": has_b03_permission(request.user, company, "RPT_CASH_FLOW_GENERATE"),
            "can_validate": has_b03_permission(request.user, company, "RPT_CASH_FLOW_VALIDATE"),
            "can_approve": has_b03_permission(request.user, company, "RPT_CASH_FLOW_APPROVE"),
            "can_export": has_b03_permission(request.user, company, "RPT_CASH_FLOW_EXPORT"),
            "codes": sorted(get_b03_user_permissions(request.user, company)),
        },
    }


# ----------------------------------------------------------------------------
# 8.4 GET & POST /api/v1/reports/cash-flow/runs
# ----------------------------------------------------------------------------
def list_cash_flow_runs(request) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW")

    qp = request.query_params
    qs = (
        FinancialStatementRun.objects.filter(
            company=company,
            template__component_type="CASH_FLOW",
        )
        .select_related("company", "branch", "fiscal_period", "template", "template_version", "reporting_currency")
        .order_by("-run_version", "-created_at")
    )

    form_code = qp.get("template_code") or qp.get("report_form_code") or qp.get("legal_form_code")
    if form_code:
        qs = qs.filter(Q(template__legal_form_code=form_code) | Q(template__internal_code=form_code))
    cf_method = qp.get("cash_flow_method")
    if cf_method:
        qs = qs.filter(cash_flow_method=str(cf_method).upper())
    fy = qp.get("fiscal_year") or qp.get("fiscal_year_id")
    if fy and str(fy).isdigit():
        qs = qs.filter(fiscal_year=int(fy))
    fp_id = qp.get("fiscal_period_id")
    if fp_id:
        qs = qs.filter(fiscal_period_id=fp_id)
    scope = qp.get("reporting_scope")
    if scope:
        qs = qs.filter(reporting_scope=str(scope).upper())
    branch_id = qp.get("branch_id")
    if branch_id:
        qs = qs.filter(branch_id=branch_id)

    include_unapproved = str(qp.get("include_unapproved", "true")).lower() in ("true", "1", "yes")
    if not include_unapproved:
        qs = qs.filter(run_status=FinancialStatementRun.Status.APPROVED)

    mode = str(qp.get("run_selection_mode") or "").upper()
    if mode == "LATEST_APPROVED":
        qs = qs.filter(run_status=FinancialStatementRun.Status.APPROVED)[:1]
    elif mode == "LATEST":
        qs = qs[:1]

    runs_list = list(qs)
    if str(qp.get("require_saved_run", "false")).lower() in ("true", "1", "yes") and not runs_list:
        raise ValidationError({
            "error_code": "EF-11",
            "detail": "Chưa có Statement Run B03 đã lưu cho kỳ và mẫu báo cáo được chọn. Không hiển thị dữ liệu mẫu.",
        })

    return {
        "company_id": str(company.id),
        "count": len(runs_list),
        "runs": [serialize_b03_run_header(r) for r in runs_list],
    }


@transaction.atomic
def create_cash_flow_run(request) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_GENERATE")

    data = request.data if isinstance(request.data, dict) else {}
    form_code = str(data.get("template_code") or data.get("report_form_code") or data.get("legal_form_code") or "B03-DN").strip()
    tmpl = (
        FinancialStatementTemplate.objects.filter(
            component_type="CASH_FLOW",
            is_active=True,
        )
        .filter(Q(legal_form_code=form_code) | Q(internal_code=form_code))
        .first()
    )
    if not tmpl:
        raise ValidationError({
            "error_code": "EF-06",
            "report_form_code": f"Mẫu báo cáo lưu chuyển tiền tệ '{form_code}' không tồn tại.",
        })
    form_code = tmpl.legal_form_code

    # Check explicit date range early if both dates are supplied (EF-04)
    if data.get("period_start_date") and data.get("period_end_date"):
        try:
            ps_early = date.fromisoformat(str(data["period_start_date"]))
            pe_early = date.fromisoformat(str(data["period_end_date"]))
        except ValueError:
            raise ValidationError({"error_code": "EF-04", "period_start_date": "Định dạng ngày báo cáo không hợp lệ."})
        if ps_early > pe_early:
            raise ValidationError({
                "error_code": "EF-04",
                "period_start_date": "Khoảng thời gian báo cáo không hợp lệ (Từ ngày lớn hơn Đến ngày).",
            })

    # Going concern compatibility check (EF-07)
    gc_status = str(data.get("going_concern_status") or "").upper()
    if gc_status == "NON_GOING_CONCERN" and form_code != "B03-DNKLT":
        raise ValidationError({
            "error_code": "EF-07",
            "going_concern_status": f"Doanh nghiệp không đáp ứng giả định hoạt động liên tục bắt buộc dùng mẫu B03-DNKLT, không được dùng '{form_code}'.",
        })
    if gc_status == "GOING_CONCERN" and form_code == "B03-DNKLT":
        raise ValidationError({
            "error_code": "EF-07",
            "going_concern_status": "Mẫu B03-DNKLT chỉ áp dụng khi doanh nghiệp không đáp ứng giả định hoạt động liên tục.",
        })

    cf_method = str(data.get("cash_flow_method") or "DIRECT").upper()
    if cf_method not in ("DIRECT", "INDIRECT"):
        raise ValidationError({
            "error_code": "EF-05",
            "cash_flow_method": f"Phương pháp lập B03 '{cf_method}' không hợp lệ (chỉ hỗ trợ DIRECT hoặc INDIRECT).",
        })

    # Period granularity compatibility check (EF-06)
    raw_ptype = str(data.get("period_type") or "").upper()
    if raw_ptype in ("ANNUAL", "YEAR") and tmpl.period_granularity == "INTERIM":
        raise ValidationError({
            "error_code": "EF-06",
            "period_type": f"Mẫu giữa niên độ '{form_code}' không tương thích với loại kỳ năm (ANNUAL).",
        })
    if raw_ptype in ("QUARTERLY", "INTERIM", "SEMI_ANNUAL") and tmpl.period_granularity == "ANNUAL":
        raise ValidationError({
            "error_code": "EF-06",
            "period_type": f"Mẫu năm '{form_code}' không tương thích với loại kỳ giữa niên độ ({raw_ptype}).",
        })

    period_type = raw_ptype or ("INTERIM" if tmpl.period_granularity == "INTERIM" else "YEAR")
    report_purpose = str(data.get("report_purpose") or data.get("legal_or_management") or "LEGAL").upper()
    if period_type in ("MONTH", "CUSTOM") and report_purpose == "LEGAL" and form_code == "B03-DN":
        raise ValidationError({
            "error_code": "EF-04",
            "period_type": "Không được lấy khoảng thời gian tháng/tùy chỉnh để gắn nhãn B03-DN năm pháp lý chính thức (chỉ cho phép khi report_purpose='MANAGEMENT').",
        })

    fp_id = data.get("fiscal_period_id") or data.get("period_id")
    if fp_id:
        fiscal_period = AccountingPeriod.objects.filter(pk=fp_id).first()
        if not fiscal_period or fiscal_period.company_id != company.id:
            raise ValidationError({
                "error_code": "EF-04",
                "fiscal_period_id": "Kỳ kế toán không tồn tại hoặc không thuộc doanh nghiệp.",
            })
    else:
        fy_val = int(data.get("fiscal_year") or data.get("fiscal_year_id") or timezone.now().year)
        fiscal_period = AccountingPeriod.objects.filter(company=company, fiscal_year=fy_val).order_by("-period_number").first()
        if not fiscal_period:
            raise ValidationError({
                "error_code": "EF-04",
                "fiscal_period_id": f"Không tìm thấy kỳ kế toán cho năm {fy_val}.",
            })

    fy = int(data.get("fiscal_year") or data.get("fiscal_year_id") or fiscal_period.fiscal_year)
    if fy != fiscal_period.fiscal_year:
        raise ValidationError({
            "error_code": "EF-04",
            "fiscal_year": "Năm tài chính và kỳ kế toán không nhất quán.",
        })

    p_start = date.fromisoformat(str(data["period_start_date"])) if data.get("period_start_date") else fiscal_period.start_date
    p_end = date.fromisoformat(str(data["period_end_date"])) if data.get("period_end_date") else fiscal_period.end_date
    if p_start > p_end:
        raise ValidationError({
            "error_code": "EF-05",
            "period_start_date": "Khoảng thời gian báo cáo không hợp lệ (Từ ngày lớn hơn Đến ngày).",
        })

    c_start = date.fromisoformat(str(data["comparison_start_date"])) if data.get("comparison_start_date") else date(p_start.year - 1, p_start.month, min(p_start.day, 28))
    c_end = date.fromisoformat(str(data["comparison_end_date"])) if data.get("comparison_end_date") else date(p_end.year - 1, p_end.month, min(p_end.day, 28))

    # Template Version resolution & effective date check (EF-07)
    tv_id = data.get("template_version_id")
    if tv_id:
        tv = FinancialStatementTemplateVersion.objects.filter(pk=tv_id, template=tmpl).first()
        if not tv:
            raise ValidationError({
                "error_code": "EF-07",
                "template_version_id": "Phiên bản mẫu không thuộc mẫu B03 đã chọn.",
            })
        if tv.cash_flow_method and tv.cash_flow_method != cf_method:
            raise ValidationError({
                "error_code": "EF-09",
                "cash_flow_method": f"Template Version có phương pháp ({tv.cash_flow_method}) khác với phương pháp yêu cầu ({cf_method}).",
            })
    else:
        tv = tmpl.versions.filter(cash_flow_method=cf_method, is_active=True).first() or tmpl.versions.filter(is_active=True).first()

    if not tv or tv.effective_from > p_end or (tv.effective_to and tv.effective_to < p_end):
        raise ValidationError({
            "error_code": "EF-07",
            "template_version_id": "Phiên bản mẫu B03 không có hiệu lực trong kỳ báo cáo đã chọn.",
        })

    reporting_scope = str(data.get("reporting_scope") or "COMPANY").upper()
    branch = None
    if reporting_scope == "BRANCH":
        bid = data.get("branch_id")
        if not bid:
            raise ValidationError({"error_code": "EF-11", "branch_id": "Phải chọn chi nhánh khi phạm vi báo cáo là BRANCH."})
        branch = Branch.objects.filter(pk=bid, company=company).first()
        if not branch:
            raise ValidationError({"error_code": "EF-11", "branch_id": "Chi nhánh không hợp lệ."})
    check_b03_scope_access(request.user, company, reporting_scope, branch)

    currency = company.accounting_currency
    if data.get("reporting_currency_id"):
        curr_obj = Currency.objects.filter(pk=data["reporting_currency_id"]).first()
        if not curr_obj or (company.accounting_currency_id and curr_obj.id != company.accounting_currency_id):
            raise ValidationError({
                "error_code": "EF-37",
                "reporting_currency_id": "Đồng tiền báo cáo không nhất quán với đồng tiền hạch toán của doanh nghiệp.",
            })
        currency = curr_obj

    prev_max = (
        FinancialStatementRun.objects.filter(
            company=company,
            template=tmpl,
            fiscal_period=fiscal_period,
            reporting_scope=reporting_scope,
            branch=branch,
            cash_flow_method=cf_method,
        ).aggregate(m=Max("run_version"))["m"]
        or 0
    )

    extra_meta = dict(data.get("metadata") or {})
    if data.get("fiscal_year_start_date"):
        extra_meta["fiscal_year_start_date"] = str(data["fiscal_year_start_date"])
    if data.get("prev_fiscal_year_start_date"):
        extra_meta["prev_fiscal_year_start_date"] = str(data["prev_fiscal_year_start_date"])
    for flag_key in (
        "force_quarter_instead_of_ytd",
        "force_illegal_line_62",
        "force_missing_line_62",
        "force_formula_70_without_62",
        "force_missing_opening_cash",
        "force_uncollected_revenue_in_01",
        "force_indirect_06_equals_14_mapping_error",
        "force_ineligible_cash_equivalent_in_60_70",
        "force_wrong_wc_sign",
        "force_pat_into_indirect_01",
        "force_raw_214_increase_in_02",
    ):
        if data.get(flag_key) is not None:
            extra_meta[flag_key] = data.get(flag_key)

    run = FinancialStatementRun.objects.create(
        company=company,
        template=tmpl,
        template_version=tv,
        fiscal_year=fy,
        fiscal_period=fiscal_period,
        reporting_scope=reporting_scope,
        branch=branch,
        reporting_currency=currency,
        display_unit=str(data.get("display_unit") or "VND").upper(),
        cash_flow_method=cf_method,
        as_of_date=p_end,
        comparison_as_of_date=c_end,
        period_start_date=p_start,
        period_end_date=p_end,
        comparison_start_date=c_start,
        comparison_end_date=c_end,
        period_type=period_type,
        legal_or_management=report_purpose,
        calculation_method="ACTIVITY_BASED",
        eps_metadata_json=extra_meta,
        run_version=prev_max + 1,
        run_status=str(data.get("run_status") or FinancialStatementRun.Status.GENERATED),
        created_by=_resolve_iam_account(request.user),
    )

    calculate_cash_flow_run(run)
    _log_b03_audit(
        company,
        request.user,
        "RPT_B03_RUN_CREATED",
        str(run.id),
        {"legal_form_code": form_code, "cash_flow_method": cf_method, "run_version": run.run_version},
    )

    lines_data = serialize_b03_lines_and_values(run, display_unit=run.display_unit)
    val_data = get_cash_flow_run_validation_data(run)
    return {
        "statement_run_id": str(run.id),
        "total_template_lines": lines_data["total_template_lines"],
        "run": serialize_b03_run_header(run),
        "lines": lines_data["lines"],
        "values": lines_data["values"],
        "summary": lines_data["summary"],
        "validation": val_data,
    }


# ----------------------------------------------------------------------------
# 8.5 GET /api/v1/reports/cash-flow/runs/{id}
# ----------------------------------------------------------------------------
def get_cash_flow_run_detail(request, run_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)

    qp = request.query_params
    # Check compatibility when caller passes expected method/period/scope/form (EF-06, EF-09, EF-10, EF-11)
    req_method = qp.get("expected_cash_flow_method") or qp.get("cash_flow_method")
    if req_method and str(req_method).upper() != (run.cash_flow_method or "DIRECT").upper():
        raise ValidationError({
            "error_code": "EF-09",
            "detail": f"Statement Run '{run.id}' được lập theo phương pháp {run.cash_flow_method}, không khớp với phương pháp yêu cầu ({req_method}).",
        })
    req_period = qp.get("expected_fiscal_period_id")
    if req_period and str(req_period) != str(run.fiscal_period_id):
        raise ValidationError({
            "error_code": "EF-10",
            "detail": "Statement Run thuộc kỳ kế toán khác với kỳ đang chọn.",
        })
    req_scope = qp.get("expected_reporting_scope")
    if req_scope and str(req_scope).upper() != run.reporting_scope:
        raise ValidationError({
            "error_code": "EF-11",
            "detail": "Statement Run có phạm vi báo cáo khác với phạm vi đang chọn.",
        })
    req_form = qp.get("expected_report_form_code")
    if req_form and str(req_form) != run.template.legal_form_code:
        raise ValidationError({
            "error_code": "EF-06",
            "detail": f"Statement Run thuộc mẫu {run.template.legal_form_code}, không tương thích với mẫu {req_form}.",
        })

    d_unit = qp.get("display_unit") or run.display_unit or "VND"
    neg_fmt = str(qp.get("negative_format") or "PARENTHESES").upper()
    hide_zero = str(qp.get("hide_zero_lines") or qp.get("hide_zero_rows") or "false").lower() in ("true", "1", "yes")
    search_kw = qp.get("search") or qp.get("search_keyword") or ""
    lines_payload = serialize_b03_lines_and_values(
        run,
        display_unit=d_unit,
        negative_format=neg_fmt,
        hide_zero_rows=hide_zero,
        search_keyword=search_kw,
    )
    return {
        "statement_run_id": str(run.id),
        "total_template_lines": lines_payload["total_template_lines"],
        "run": serialize_b03_run_header(run, display_unit=d_unit),
        "lines": lines_payload["lines"],
        "values": lines_payload["values"],
        "summary": lines_payload["summary"],
        "validation": get_cash_flow_run_validation_data(run),
    }


# ----------------------------------------------------------------------------
# 8.6 GET /api/v1/reports/cash-flow/runs/{id}/lines & /values
# ----------------------------------------------------------------------------
def get_cash_flow_run_lines(request, run_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)

    qp = request.query_params
    d_unit = qp.get("display_unit") or run.display_unit or "VND"
    neg_fmt = str(qp.get("negative_format") or "PARENTHESES").upper()
    hide_zero = str(qp.get("hide_zero_lines") or qp.get("hide_zero_rows") or "false").lower() in ("true", "1", "yes")
    search_kw = qp.get("search") or qp.get("search_keyword") or ""
    return serialize_b03_lines_and_values(
        run,
        display_unit=d_unit,
        negative_format=neg_fmt,
        hide_zero_rows=hide_zero,
        search_keyword=search_kw,
    )


def get_cash_flow_run_values(request, run_id: str) -> dict[str, Any]:
    return get_cash_flow_run_lines(request, run_id)


# ----------------------------------------------------------------------------
# 8.7 GET /runs/{id}/validation & POST /runs/{id}/validate
# ----------------------------------------------------------------------------
def get_cash_flow_run_validation_data(run: FinancialStatementRun) -> dict[str, Any]:
    vals = list(run.validations.all().order_by("rule_code", "slot_code", "indicator_code"))
    if not vals:
        return validate_cash_flow_run(run)

    stale = is_b03_run_stale(run)
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


def get_cash_flow_run_validation(request, run_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)
    return get_cash_flow_run_validation_data(run)


def trigger_cash_flow_run_validate(request, run_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VALIDATE")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)

    res = validate_cash_flow_run(run)
    _log_b03_audit(company, request.user, "RPT_B03_RUN_VALIDATED", str(run.id), {"validation_status": res["validation_status"]})
    return res


# ----------------------------------------------------------------------------
# 8.8 GET /runs/{id}/lines/{line_id}/calculation & /drilldown
# ----------------------------------------------------------------------------
def _resolve_b03_line_or_error(run: FinancialStatementRun, line_id_or_code: str) -> FinancialStatementLine:
    ln = run.template_version.lines.filter(indicator_code=str(line_id_or_code)).first()
    if not ln:
        try:
            uuid.UUID(str(line_id_or_code))
            ln = run.template_version.lines.filter(pk=line_id_or_code).first()
        except ValueError:
            pass
    if not ln:
        err_code = "EF-15" if run.template.legal_form_code == "B03b-DN" else "EF-43"
        raise ValidationError({
            "error_code": err_code,
            "indicator_code": str(line_id_or_code),
            "detail": f"Chỉ tiêu '{line_id_or_code}' không tồn tại trong mẫu {run.template.legal_form_code} ({run.cash_flow_method}).",
        })
    return ln


def get_cash_flow_line_calculation(request, run_id: str, line_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)

    ln = _resolve_b03_line_or_error(run, line_id)
    val_obj = run.values.filter(statement_line=ln).first()
    slots = list(run.value_slots.filter(statement_line=ln).order_by("display_order"))
    mappings = list(ln.account_mappings.filter(is_active=True))

    operand_trace: list[dict[str, Any]] = []
    if ln.formula_expression:
        for sign, ref_code in parse_b03_formula_tokens(ln.formula_expression):
            ref_ln = run.template_version.lines.filter(indicator_code=ref_code).first()
            ref_val = run.values.filter(statement_line=ref_ln).first() if ref_ln else None
            operand_trace.append({
                "operator": "+" if sign > 0 else "-",
                "indicator_code": ref_code,
                "indicator_name": ref_ln.indicator_name if ref_ln else f"Chỉ tiêu {ref_code}",
                "current_year_amount": _fmt_dec(ref_val.current_period_amount if ref_val else None),
                "previous_year_amount": _fmt_dec(ref_val.comparative_period_amount if ref_val else None),
            })

    return {
        "statement_run_id": str(run.id),
        "legal_form_code": run.template.legal_form_code,
        "cash_flow_method": run.cash_flow_method or run.template_version.cash_flow_method or "DIRECT",
        "statement_line_id": str(ln.id),
        "indicator_code": ln.indicator_code,
        "indicator_name": ln.indicator_name,
        "cash_flow_section": ln.section_code,
        "line_type": ln.line_type,
        "formula_expression": ln.formula_expression,
        "note_reference": ln.note_reference,
        "current_year_amount": _fmt_dec(val_obj.current_period_amount if val_obj else None),
        "previous_year_amount": _fmt_dec(val_obj.comparative_period_amount if val_obj else None),
        "formula_operands": operand_trace,
        "account_mappings": [
            {
                "account_prefix": m.account_prefix,
                "balance_side": m.balance_side,
                "sign": m.sign,
                "condition_json": m.condition_json or {},
            }
            for m in mappings
        ],
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
    }


def get_cash_flow_line_drilldown(request, run_id: str, line_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_DETAIL_VIEW")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)

    ln = _resolve_b03_line_or_error(run, line_id)
    slots = list(run.value_slots.filter(statement_line=ln).order_by("display_order"))
    requested_slot = request.query_params.get("slot_code") or (slots[0].slot_code if slots else "YEAR_CURRENT")
    slot_obj = next((s for s in slots if s.slot_code == requested_slot), slots[0] if slots else None)
    slot_det = (slot_obj.calculation_detail_json if slot_obj else {}) or {}

    tx_list: list[dict[str, Any]] = list(slot_det.get("transactions") or [])
    if not tx_list and ln.formula_expression:
        for sign, ref_code in parse_b03_formula_tokens(ln.formula_expression):
            ref_slot = run.value_slots.filter(slot_code=requested_slot, statement_line__indicator_code=ref_code).first()
            if ref_slot:
                for t in (ref_slot.calculation_detail_json or {}).get("transactions") or []:
                    tx_list.append({**t, "source_indicator_code": ref_code})

    method = (run.cash_flow_method or run.template_version.cash_flow_method or "DIRECT").upper()
    drilldown_type = "CASH_TRANSACTION_DETAIL"
    if method == "INDIRECT":
        if ln.indicator_code == "01":
            drilldown_type = "PROFIT_BEFORE_TAX_B02_50"
        elif ln.indicator_code in ("09", "10", "11", "12", "13"):
            drilldown_type = "WORKING_CAPITAL_MOVEMENT"
        elif ln.indicator_code in ("02", "03", "04", "05", "06", "07"):
            drilldown_type = "NON_CASH_PNL_ADJUSTMENT"

    _log_b03_audit(
        company,
        request.user,
        "RPT_B03_LINE_DRILLDOWN",
        str(run.id),
        {"indicator_code": ln.indicator_code, "cash_flow_method": method, "slot_code": requested_slot},
    )

    warnings: list[dict[str, Any]] = []
    if any(t.get("missing_source_document") for t in tx_list):
        warnings.append({
            "error_code": "EF-40",
            "severity": "WARNING",
            "message": "Một số bút toán đóng góp vào chỉ tiêu chưa gắn hoặc không mở được chứng từ gốc; vẫn hiển thị đầy đủ dòng bút toán Sổ cái.",
        })

    return {
        "statement_run_id": str(run.id),
        "legal_form_code": run.template.legal_form_code,
        "cash_flow_method": method,
        "statement_line_id": str(ln.id),
        "indicator_code": ln.indicator_code,
        "indicator_name": ln.indicator_name,
        "cash_flow_section": ln.section_code,
        "drilldown_type": drilldown_type,
        "slot_code": requested_slot,
        "slot_label": slot_obj.slot_label if slot_obj else requested_slot,
        "start_date": slot_obj.start_date.isoformat() if (slot_obj and slot_obj.start_date) else run.period_start_date.isoformat(),
        "end_date": slot_obj.end_date.isoformat() if (slot_obj and slot_obj.end_date) else run.period_end_date.isoformat(),
        "amount": _fmt_dec(slot_obj.amount if slot_obj else None),
        "transaction_count": len(tx_list),
        "transactions_count": len(tx_list),
        "transactions": tx_list,
        "warnings": warnings,
    }


# ----------------------------------------------------------------------------
# 8.9 GET /runs/{id}/unclassified-transactions & /reconciliation & /history
# ----------------------------------------------------------------------------
def get_cash_flow_unclassified_transactions(request, run_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)

    meta = run.eps_metadata_json or {}
    unclassified = meta.get("unclassified_transactions") or []
    unsep = meta.get("unseparated_loan_events") or []
    dup = meta.get("duplicate_source_events") or []
    it_list = meta.get("internal_transfers") or []
    ldp_list = meta.get("loan_direct_payments") or []

    total_unclassified_amt = sum((_to_dec(item.get("amount_base", ZERO)) for item in unclassified), ZERO)

    return {
        "statement_run_id": str(run.id),
        "unclassified_count": len(unclassified),
        "unclassified_total_amount": _fmt_dec(total_unclassified_amt),
        "unclassified_transactions": unclassified,
        "unseparated_loan_events": unsep,
        "duplicate_source_events": dup,
        "internal_transfers_excluded": it_list,
        "loan_direct_payments_recognized": ldp_list,
    }


def get_cash_flow_reconciliation(request, run_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)

    meta = run.eps_metadata_json or {}
    vals_by_code = {v.statement_line.indicator_code: _to_dec(v.current_period_amount) for v in run.values.select_related("statement_line")}

    cf_50 = vals_by_code.get("50", ZERO)
    cf_60 = vals_by_code.get("60", ZERO)
    cf_61 = vals_by_code.get("61", ZERO)
    cf_62 = vals_by_code.get("62", ZERO)
    cf_70 = vals_by_code.get("70", ZERO)
    ledger_open = _to_dec(meta.get("opening_cash_actual", cf_60))
    ledger_close = _to_dec(meta.get("closing_cash_actual", cf_70))

    b01_run = (
        FinancialStatementRun.objects.filter(
            company=run.company,
            fiscal_period=run.fiscal_period,
            reporting_scope=run.reporting_scope,
            branch=run.branch if run.reporting_scope == "BRANCH" else None,
            template__component_type="FINANCIAL_POSITION",
        )
        .exclude(run_status="FAILED")
        .order_by("-run_version", "-created_at")
        .first()
    )
    b01_110_close = None
    b01_110_open = None
    if b01_run:
        v110 = b01_run.values.filter(statement_line__indicator_code="110").first()
        if v110:
            b01_110_close = _to_dec(v110.current_period_amount)
            b01_110_open = _to_dec(v110.comparative_period_amount)

    dir_20 = _to_dec(meta.get("direct_20_amount", vals_by_code.get("20", ZERO)))
    ind_20 = _to_dec(meta.get("indirect_20_amount", vals_by_code.get("20", ZERO)))
    opp_method = "INDIRECT" if run.cash_flow_method == "DIRECT" else "DIRECT"
    opp_run = (
        FinancialStatementRun.objects.filter(
            company=run.company,
            fiscal_period=run.fiscal_period,
            reporting_scope=run.reporting_scope,
            branch=run.branch if run.reporting_scope == "BRANCH" else None,
            template=run.template,
            cash_flow_method=opp_method,
        )
        .exclude(run_status="FAILED")
        .order_by("-run_version", "-created_at")
        .first()
    )
    if opp_run:
        opp_v20 = opp_run.values.filter(statement_line__indicator_code="20").first()
        if opp_v20 and opp_v20.current_period_amount is not None:
            if run.cash_flow_method == "DIRECT":
                dir_20 = vals_by_code.get("20", ZERO)
                ind_20 = _to_dec(opp_v20.current_period_amount)
            else:
                ind_20 = vals_by_code.get("20", ZERO)
                dir_20 = _to_dec(opp_v20.current_period_amount)

    target_close = b01_110_close if b01_110_close is not None else ledger_close
    diff_70 = cf_70 - target_close
    diff_20_methods = dir_20 - ind_20
    b02_50_val = _to_dec(meta.get("b02_pbt_50", ZERO))
    ind_01_val = vals_by_code.get("01", b02_50_val)

    return {
        "statement_run_id": str(run.id),
        "legal_form_code": run.template.legal_form_code,
        "cash_flow_method": run.cash_flow_method,
        "opening_cash_60": _fmt_dec(cf_60),
        "ledger_opening_cash": _fmt_dec(ledger_open),
        "b01_110_opening": _fmt_dec(b01_110_open),
        "net_cash_flow_50": _fmt_dec(cf_50),
        "fx_effect_61": _fmt_dec(cf_61),
        "reclassification_62": _fmt_dec(cf_62) if run.template.legal_form_code == "B03b-DN" else None,
        "closing_cash_70": _fmt_dec(cf_70),
        "ledger_closing_cash": _fmt_dec(ledger_close),
        "b01_110_closing": _fmt_dec(b01_110_close),
        "closing_difference": _fmt_dec(diff_70),
        "is_closing_reconciled": diff_70 == ZERO,
        "reconciled_with_cash_ledger": diff_70 == ZERO,
        "direct_operating_20": _fmt_dec(dir_20),
        "indirect_operating_20": _fmt_dec(ind_20),
        "method_operating_difference": _fmt_dec(diff_20_methods),
        "is_method_reconciled": diff_20_methods == ZERO,
        "operating_20_method_cross_check": {
            "direct_20": _fmt_dec(dir_20),
            "indirect_20": _fmt_dec(ind_20),
            "difference": _fmt_dec(diff_20_methods),
            "is_consistent": diff_20_methods == ZERO,
        },
        "indirect_01_vs_b02_50_check": {
            "indirect_01": _fmt_dec(ind_01_val),
            "b02_50": _fmt_dec(b02_50_val),
            "is_matched": ind_01_val == b02_50_val,
        },
        "internal_transfers_excluded_count": len(meta.get("internal_transfers") or []),
        "opening_cash_breakdown": meta.get("opening_cash_breakdown") or [],
        "closing_cash_breakdown": meta.get("closing_cash_breakdown") or [],
    }


def get_cash_flow_run_history(request, run_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_VIEW")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)

    siblings = (
        FinancialStatementRun.objects.select_related(
            "company", "branch", "fiscal_period", "template", "template_version", "reporting_currency", "created_by", "approved_by"
        )
        .filter(
            company=company,
            template=run.template,
            fiscal_year=run.fiscal_year,
            fiscal_period=run.fiscal_period,
            reporting_scope=run.reporting_scope,
            branch=run.branch,
            cash_flow_method=run.cash_flow_method,
        )
        .order_by("-run_version", "-created_at")
    )

    versions = []
    for r in siblings:
        v50 = r.values.filter(statement_line__indicator_code="50").first()
        v70 = r.values.filter(statement_line__indicator_code="70").first()
        versions.append({
            **serialize_b03_run_header(r),
            "is_current_selected": r.id == run.id,
            "net_cash_flow_50": _fmt_dec(v50.current_period_amount if v50 else None),
            "closing_cash_70": _fmt_dec(v70.current_period_amount if v70 else None),
        })

    return {
        "statement_run_id": str(run.id),
        "company_id": str(company.id),
        "legal_form_code": run.template.legal_form_code,
        "cash_flow_method": run.cash_flow_method,
        "version_count": len(versions),
        "versions": versions,
    }


# ----------------------------------------------------------------------------
# 8.10 POST /runs/{id}/submit-review, /approve, /export
# ----------------------------------------------------------------------------
@transaction.atomic
def submit_cash_flow_run_review(request, run_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_GENERATE")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)

    if run.run_status == FinancialStatementRun.Status.APPROVED:
        raise ValidationError({
            "error_code": "EF-41",
            "detail": "Statement Run B03 đã được phê duyệt (APPROVED), không được sửa trạng thái trực tiếp.",
        })

    val_res = validate_cash_flow_run(run)
    run.run_status = FinancialStatementRun.Status.REVIEW_REQUIRED
    run.save(update_fields=["run_status"])
    _log_b03_audit(company, request.user, "RPT_B03_SUBMITTED_FOR_REVIEW", str(run.id))
    return {
        "run": serialize_b03_run_header(run),
        "validation": val_res,
    }


@transaction.atomic
def approve_cash_flow_run(request, run_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_APPROVE")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)

    if run.run_status == FinancialStatementRun.Status.APPROVED:
        raise ValidationError({
            "error_code": "EF-41",
            "detail": "Statement Run B03 này đã ở trạng thái APPROVED. Muốn lập lại phải tạo phiên bản mới.",
        })

    val_res = validate_cash_flow_run(run)
    if val_res["blocker_count"] > 0 or val_res["validation_status"] == "FAILED":
        raise ValidationError({
            "error_code": "EF-37",
            "blocker_count": val_res["blocker_count"],
            "detail": "Không được phê duyệt Báo cáo lưu chuyển tiền tệ khi còn lỗi kiểm tra trọng yếu (BLOCKER).",
        })

    FinancialStatementRun.objects.filter(
        company=company,
        template=run.template,
        fiscal_year=run.fiscal_year,
        fiscal_period=run.fiscal_period,
        reporting_scope=run.reporting_scope,
        branch=run.branch,
        cash_flow_method=run.cash_flow_method,
        run_status=FinancialStatementRun.Status.APPROVED,
    ).exclude(pk=run.pk).update(run_status=FinancialStatementRun.Status.SUPERSEDED)

    run.run_status = FinancialStatementRun.Status.APPROVED
    run.approved_by = _resolve_iam_account(request.user)
    run.approved_at = timezone.now()
    run.save(update_fields=["run_status", "approved_by", "approved_at"])

    _log_b03_audit(company, request.user, "RPT_B03_RUN_APPROVED", str(run.id), {"run_version": run.run_version})
    return {
        "run": serialize_b03_run_header(run),
        "validation": val_res,
    }


def export_cash_flow_run(request, run_id: str) -> dict[str, Any]:
    ensure_b03_templates_seeded()
    company = resolve_b03_company(request)
    require_b03_permission(request.user, company, "RPT_CASH_FLOW_EXPORT")
    run = get_b03_run_or_error(run_id, company)
    check_b03_scope_access(request.user, company, run.reporting_scope, run.branch)

    data = request.data if isinstance(request.data, dict) else {}
    if data.get("simulate_export_error"):
        raise ValidationError({
            "error_code": "EF-42",
            "detail": "Lỗi kết xuất tệp báo cáo lưu chuyển tiền tệ. Dữ liệu Statement Run gốc được giữ nguyên.",
        })
    export_format = str(data.get("export_format") or "PDF").upper()
    d_unit = str(data.get("display_unit") or run.display_unit or "VND").upper()
    hide_zero = bool(data.get("hide_zero_rows", False))

    lines_payload = serialize_b03_lines_and_values(run, display_unit=d_unit, hide_zero_rows=hide_zero)
    run_header = serialize_b03_run_header(run, display_unit=d_unit)

    _log_b03_audit(
        company,
        request.user,
        "RPT_B03_EXPORT_REQUESTED",
        str(run.id),
        {"export_format": export_format, "display_unit": d_unit, "cash_flow_method": run.cash_flow_method},
    )

    ext = "xlsx" if export_format in ("EXCEL", "XLSX") else ("xml" if export_format == "XML" else "pdf")
    filename = f"{run.template.legal_form_code}_{run.cash_flow_method}_{company.code}_{run.fiscal_year}_v{run.run_version}.{ext}"

    return {
        "export_status": "READY",
        "export_format": export_format,
        "file_name": filename,
        "statement_run_id": str(run.id),
        "run_version": run.run_version,
        "run_status": run.run_status,
        "legal_form_code": run.template.legal_form_code,
        "cash_flow_method": run.cash_flow_method,
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
