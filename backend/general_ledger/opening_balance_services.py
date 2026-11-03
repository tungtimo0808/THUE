"""
UC-GL-15 – Nhập số dư ban đầu.

Ten groups of opening data (A–J) are kept per company and accounting regime in
CoreCompanySetting.configuration["opening_balances_<regime>"]. For books kept on the GL the
opening journal entry (entry_type OPENING) is rebuilt from one source per amount (BR-GL-OB-07):
direct account balances for accounts without a detail source, and the detail groups
(bank, debts, stock, tools, fixed assets) for the accounts they manage.
"""
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from . import models

UC_GL_15_CATEGORIES = (
    "accounts", "bank", "customers", "suppliers", "employees",
    "inventory", "tools", "assets", "prepaid", "wip",
)

UC_GL_15_CATEGORY_TITLES = {
    "accounts": "Số dư tài khoản",
    "bank": "Số dư TK ngân hàng",
    "customers": "Công nợ khách hàng",
    "suppliers": "Công nợ nhà cung cấp",
    "employees": "Công nợ nhân viên",
    "inventory": "Tồn kho vật tư, hàng hóa và CCDC",
    "tools": "CCDC đang sử dụng đầu kỳ",
    "assets": "Tài sản cố định đầu kỳ",
    "prepaid": "Chi phí trả trước đầu kỳ",
    "wip": "Chi phí dở dang",
}

# A8, B6, C8, D8, E6, F8, G8, H10, I7, J8
UC_GL_15_SAVE_MESSAGES = {
    "accounts": "Lưu số dư tài khoản thành công.",
    "bank": "Lưu số dư TK ngân hàng thành công.",
    "customers": "Lưu công nợ khách hàng thành công.",
    "suppliers": "Lưu công nợ nhà cung cấp thành công.",
    "employees": "Lưu công nợ nhân viên thành công.",
    "inventory": "Lưu tồn kho đầu kỳ thành công.",
    "tools": "Lưu CCDC đầu kỳ thành công.",
    "assets": "Lưu TSCĐ đầu kỳ thành công.",
    "prepaid": "Lưu chi phí trả trước đầu kỳ thành công.",
    "wip": "Lưu chi phí dở dang đầu kỳ thành công.",
}
MSG_UPDATED = "Cập nhật số dư ban đầu thành công."
MSG_DELETED = "Xóa số dư ban đầu thành công."
MSG_TT58_SAVED = "Lưu dữ liệu đầu kỳ thành công."

UC_GL_15_WIP_TRACKING_MODES = ("Đối tượng tập hợp chi phí", "Công trình", "Đơn hàng", "Hợp đồng")
UC_GL_15_WIP_COST_FIELDS = ("rawMaterial", "labor", "machinery", "general", "accepted")

# Accounts whose nature allows a debit and a credit balance on the same line.
UC_GL_15_BILATERAL_ACCOUNT_PREFIXES = ("131", "331", "136", "336", "138", "338", "333", "334", "141", "421")

# AF-15 & BR-GL-OB-49: a TT58 single-entry book has no Debit/Credit trial balance group.
UC_GL_15_TT58_SIMPLE_CATEGORIES = tuple(c for c in UC_GL_15_CATEGORIES if c != "accounts")

# Dependency markers are decided by the server, never accepted from the client (EF-22).
UC_GL_15_SERVER_ONLY_FIELDS = ("has_dependent_voucher", "settled_amount", "allocated_in_period", "dependency_reason")

UC_GL_15_CIRCULARS = {
    "TT99": "Thông tư 99/2025/TT-BTC",
    "TT200": "Thông tư 200/2014/TT-BTC",
    "TT133": "Thông tư 133/2016/TT-BTC",
    "TT58": "Thông tư 58/2026/TT-BTC",
}

MAX_AMOUNT = Decimal("1000000000000000000")

EF03 = "Bạn không có quyền thực hiện thao tác này."
EF13 = "Số dư phải là số hợp lệ và không được âm."
EF16 = "Dữ liệu số dư ban đầu này đã tồn tại."
EF18 = "Số dư tài khoản này đã được quản lý theo dữ liệu chi tiết. Vui lòng nhập hoặc chỉnh sửa tại nhóm tương ứng."
EF22 = "Không thể thay đổi số dư ban đầu vì dữ liệu đã được sử dụng trong nghiệp vụ kế toán."
EF23 = "Bộ dữ liệu hoặc chế độ kế toán đã thay đổi. Vui lòng tải lại."
EF24 = "Dữ liệu đã được thay đổi bởi người dùng khác. Vui lòng tải lại."
EF25 = "Không thể lưu số dư ban đầu. Vui lòng thử lại."
EF26 = "Đã lưu thành công nhưng không thể tạo bản in. Vui lòng thử in lại."
EF28 = "Chưa có cấu hình sổ kế toán phù hợp với chế độ và phương pháp thuế đã chọn."


def _fail(code: str, message: str, **extra):
    raise ValidationError({"error_code": code, "detail": message, **extra})


# ---------------------------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------------------------

def _to_dec_uc15(val, default="0") -> Decimal:
    """Lenient parser kept for reading stored rows; raises nothing."""
    try:
        return _parse_amount(val, default)
    except (InvalidOperation, ValueError):
        return Decimal(default)


def _parse_amount(val, default="0") -> Decimal:
    if val is None or val == "":
        return Decimal(default)
    if isinstance(val, bool):
        raise ValueError("boolean is not an amount")
    if isinstance(val, Decimal):
        return val
    if isinstance(val, (int, float)):
        return Decimal(str(val))
    s = str(val).strip().replace(" ", "")
    if not s:
        return Decimal(default)
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        parts = s.split(",")
        s = s.replace(",", ".") if len(parts) == 2 and len(parts[1]) <= 2 else s.replace(",", "")
    value = Decimal(s)
    if not value.is_finite():
        raise ValueError("not finite")
    return value


def _first_key(row: dict, keys):
    for key in keys:
        if key in row:
            return key, row.get(key)
    return None, None


def _amount(row: dict, keys, *, code="EF-13", message=EF13, default="0", field_label=None) -> Decimal:
    """EF-13/EF-14/EF-15: a value must be numeric, not negative and within the limit."""
    key, raw = _first_key(row, keys)
    try:
        value = _parse_amount(raw, default)
    except (InvalidOperation, ValueError):
        _fail(code, message, field=key or keys[0], field_label=field_label)
    if value < 0 or value > MAX_AMOUNT:
        _fail(code, message, field=key or keys[0], field_label=field_label)
    return value


def _text(row: dict, *keys) -> str:
    _key, raw = _first_key(row, keys)
    return str(raw or "").strip()


def _parse_date(raw):
    if isinstance(raw, date):
        return raw
    s = str(raw or "").strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(s[:19] if "T" in s else s, fmt).date()
        except ValueError:
            continue
    return None


def _row_list(items) -> list:
    if isinstance(items, dict):
        return items["rows"] if isinstance(items.get("rows"), list) else [items]
    return list(items) if isinstance(items, list) else []


def _clean_row(row: dict, setup: dict) -> dict:
    """BR-GL-OB-52: stamp the regime and opening date; drop markers only the server may set."""
    cleaned = {k: v for k, v in row.items() if k not in UC_GL_15_SERVER_ONLY_FIELDS}
    cleaned["accounting_regime"] = setup["accounting_regime"]
    cleaned["opening_date"] = setup["start_date"]
    return cleaned


def _row_id(row: dict) -> str:
    return str(row.get("id") or row.get("code") or row.get("accountNumber") or row.get("itemCode") or row.get("account") or "")


def _row_identifiers(row: dict) -> set:
    return {
        str(row.get(k) or "")
        for k in ("id", "code", "accountNumber", "itemCode", "account")
        if row.get(k)
    }


# ---------------------------------------------------------------------------------------------
# Setup, permissions and storage
# ---------------------------------------------------------------------------------------------

def _resolve_setup(company, config: dict) -> dict:
    """MF-02, BR-GL-OB-01/02/44/48: start date, regime and bookkeeping method of the data set."""
    first_period = models.AccountingPeriod.objects.filter(company=company).order_by("start_date").first()
    start = _parse_date(config.get("accounting_start_date")) or (first_period.start_date if first_period else None)
    if not start:
        start_month = int(getattr(company, "fiscal_year_start_month", 1) or 1)
        if start_month < 1 or start_month > 12:
            start_month = 1
        start = date(timezone.localdate().year, start_month, 1)
        if not first_period:
            import calendar
            last_day = calendar.monthrange(start.year, start.month)[1]
            first_period, _ = models.AccountingPeriod.objects.get_or_create(
                company=company,
                code=f"{start.year}-{start.month:02d}",
                defaults={
                    "name": f"Tháng {start.month:02d}/{start.year}",
                    "fiscal_year": start.year,
                    "period_number": 1,
                    "start_date": start,
                    "end_date": date(start.year, start.month, last_day),
                    "status": "OPEN",
                },
            )
    raw_regime = str(company.accounting_regime or "TT99").upper()
    regime = {
        "CIRCULAR_99": "TT99",
        "CIRCULAR_200": "TT200",
        "CIRCULAR_133": "TT133",
        "CIRCULAR_58": "TT58",
    }.get(raw_regime, raw_regime)
    if regime not in UC_GL_15_CIRCULARS:
        regime = "TT99"
    if not start or regime not in UC_GL_15_CIRCULARS:
        _fail("SETUP_MISSING", "Doanh nghiệp chưa thiết lập ngày bắt đầu hạch toán hoặc chế độ kế toán hợp lệ.")
    method = str(getattr(company, "bookkeeping_method", "") or "DOUBLE_ENTRY").upper()
    if regime == "TT58" and method not in ("SIMPLE", "DOUBLE_ENTRY"):
        _fail("EF-28", EF28)
    uses_gl = not (regime == "TT58" and method == "SIMPLE")
    return {
        "start_date": start.isoformat(),
        "start": start,
        "first_period": first_period,
        "accounting_regime": regime,
        "bookkeeping_method": method,
        "uses_general_ledger": uses_gl,
        "supported_categories": UC_GL_15_CATEGORIES if uses_gl else UC_GL_15_TT58_SIMPLE_CATEGORIES,
        "opening_period_locked": bool(
            config.get("opening_balance_locked") or (first_period and first_period.status == "CLOSED")
        ),
        "period_code": first_period.code if first_period else f"{start.year}-01",
    }


def _storage_key(setup: dict) -> str:
    return f"opening_balances_{setup['accounting_regime'].lower()}"


def _has_permission(request, company, code: str) -> bool:
    from iam.permissions import has_effective_permission

    account = getattr(getattr(request, "user", None), "iam_account", None) if request else None
    return bool(account and has_effective_permission(account, company, code))


def _assert_category(setup: dict, category: str):
    if category not in UC_GL_15_CATEGORIES:
        _fail("INVALID_CATEGORY", f"Nhóm số dư ban đầu '{category}' không hợp lệ.")
    if category not in setup["supported_categories"]:
        # AF-15 & BR-GL-OB-49/50: no Debit/Credit trial balance for a TT58 single-entry book
        _fail("AF-15", "Nhóm số dư này không áp dụng cho bộ sổ kế toán đang sử dụng.")


def _assert_writable(setup: dict, payload: dict, config: dict) -> int:
    """EF-22 (locked), EF-23 (setup changed meanwhile), EF-24 (concurrent change). Returns the version."""
    if setup["opening_period_locked"]:
        _fail("EF-22", EF22)
    expected_regime = str(payload.get("expected_regime") or "").strip().upper()
    expected_start = str(payload.get("expected_start_date") or "").strip()
    if (expected_regime and expected_regime != setup["accounting_regime"]) or (
        expected_start and expected_start != setup["start_date"]
    ):
        _fail("EF-23", EF23)
    current_version = int(config.get("opening_balances_version") or 1)
    expected_version = payload.get("expected_version")
    if expected_version not in (None, "") and int(expected_version) != current_version:
        _fail("EF-24", EF24, current_version=current_version)
    return current_version


def _load(company, *, lock=False):
    from common_services.models import CoreCompanySetting

    qs = CoreCompanySetting.objects.select_for_update() if lock else CoreCompanySetting.objects
    setting, _ = qs.get_or_create(company=company)
    config = dict(setting.configuration or {})
    setup = _resolve_setup(company, config)
    saved = dict(config.get(_storage_key(setup)) or {})
    return setting, config, setup, saved


# ---------------------------------------------------------------------------------------------
# Master data validation
# ---------------------------------------------------------------------------------------------

class _Catalog:
    """Lookups of the company's chart and master data used by one validation call."""

    def __init__(self, company):
        self.company = company
        self.accounts = {a.code: a for a in models.Account.objects.filter(company=company)}
        self.parent_codes = set(
            models.Account.objects.filter(company=company, parent__isnull=False).values_list("parent__code", flat=True)
        )

    def account(self, code: str, *, missing_code="EF-04", direct_entry=False):
        """EF-04 (missing), EF-19 (unknown/inactive), BR-GL-OB-10 (summary account on a direct line)."""
        if not code:
            _fail(missing_code, "Vui lòng chọn số tài khoản.", field="account")
        acc = self.accounts.get(code)
        if acc is None or str(getattr(acc, "status", "ACTIVE")) != "ACTIVE":
            _fail("EF-19", f"Tài khoản {code} không hợp lệ, đã ngừng sử dụng hoặc không thuộc bộ dữ liệu.", account=code)
        if direct_entry and (code in self.parent_codes or not getattr(acc, "is_postable", True)):
            _fail(
                "BR-GL-OB-10",
                f"Tài khoản tổng hợp {code} được tổng hợp từ tài khoản chi tiết; vui lòng nhập số dư ở tài khoản chi tiết.",
                account=code,
            )
        return acc

    def party(self, code: str, label: str):
        from master_data.models import Party

        party = Party.objects.filter(company=self.company, code=code).first()
        if party is None or str(getattr(party, "status", "ACTIVE")) != "ACTIVE":
            _fail("EF-19", f"{label} {code} không hợp lệ, đã ngừng theo dõi hoặc không thuộc bộ dữ liệu.", field="code")
        return party

    def employee(self, code: str):
        from organization.models import Employee

        employee = Employee.objects.filter(company=self.company, employee_code=code).first()
        if employee is None:
            _fail("EF-19", f"Nhân viên {code} không hợp lệ hoặc không thuộc bộ dữ liệu.", field="code")
        return employee

    def bank_account(self, number: str):
        from master_data.models import CompanyBankAccount

        bank = CompanyBankAccount.objects.filter(company=self.company).filter(Q(account_number=number) | Q(code=number)).first()
        if bank is None or str(bank.status) != "ACTIVE":
            _fail("EF-19", f"Tài khoản ngân hàng {number} không hợp lệ hoặc đã ngừng sử dụng.", field="accountNumber")
        return bank

    def item(self, code: str):
        from master_data.models import Item

        item = Item.objects.filter(company=self.company, code=code).select_related("inventory_account").first()
        if item is None or str(item.status) != "ACTIVE":
            _fail("EF-19", f"Hàng hóa {code} không hợp lệ hoặc đã ngừng sử dụng.", field="itemCode")
        return item

    def warehouse(self, code: str):
        from master_data.models import Warehouse

        warehouse = Warehouse.objects.filter(company=self.company).filter(Q(code=code) | Q(name=code)).first()
        if warehouse is None:
            _fail("EF-19", f"Kho {code} không hợp lệ hoặc không thuộc bộ dữ liệu.", field="warehouse")
        return warehouse


def _vnd_amounts(row: dict, debit: Decimal, credit: Decimal, currency: str):
    """AF-12, EF-30 & BR-GL-OB-18: foreign currency rows keep original amounts and their VND value."""
    if currency == "VND":
        return debit, credit
    rate_key, rate_raw = _first_key(row, ("exchangeRate", "exchange_rate"))
    has_vnd = any(k in row for k in ("debitVnd", "creditVnd", "amountVnd"))
    if rate_key is None and not has_vnd:
        _fail("EF-30", "Vui lòng nhập tỷ giá hoặc số tiền quy đổi cho số dư ngoại tệ.", field="exchangeRate")
    if rate_key is not None:
        rate = _amount(row, (rate_key,), code="EF-30", message="Tỷ giá ngoại tệ không hợp lệ.")
        if rate <= 0:
            _fail("EF-30", "Tỷ giá ngoại tệ phải lớn hơn 0.", field=rate_key)
    else:
        rate = None
    debit_vnd = _amount(row, ("debitVnd", "amountVnd")) if ("debitVnd" in row or "amountVnd" in row) else (debit * rate if rate else Decimal(0))
    credit_vnd = _amount(row, ("creditVnd",)) if "creditVnd" in row else (credit * rate if rate else Decimal(0))
    return debit_vnd.quantize(Decimal("1")), credit_vnd.quantize(Decimal("1"))


def _check_detail_sum(label: str, expected_d, expected_c, actual_d, actual_c):
    """EF-17 & BR-GL-OB-13: the detail total equals its summary line on each side."""
    if actual_d != expected_d or actual_c != expected_c:
        _fail(
            "EF-17",
            f"Tổng chi tiết của {label} không khớp số dư tổng (chênh lệch Nợ {expected_d - actual_d}, Có {expected_c - actual_c}).",
            difference_debit=str(expected_d - actual_d),
            difference_credit=str(expected_c - actual_c),
        )


def _check_not_after_start(raw, setup, field, label):
    """EF-31: source documents and in-service dates precede the accounting start date."""
    if raw in (None, ""):
        return None
    parsed = _parse_date(raw)
    if parsed is None:
        _fail("EF-31", f"{label} không hợp lệ.", field=field)
    if parsed > setup["start"]:
        _fail("EF-31", f"{label} phải trước hoặc bằng ngày bắt đầu hạch toán ({setup['start'].strftime('%d/%m/%Y')}).", field=field)
    return parsed


def _required(row: dict, fields: dict, code: str, message: str):
    """EF-10/11/12: list every missing mandatory field."""
    missing = [label for label, keys in fields.items() if not _text(row, *keys)]
    if missing:
        _fail(code, f"{message} Thiếu: {', '.join(missing)}.", fields=missing)


# ---------------------------------------------------------------------------------------------
# Validation per group (flows A–J)
# ---------------------------------------------------------------------------------------------

def validate_opening_balance_group_uc_gl_15(company, category, items, setup, catalog=None, others=None) -> list:
    """
    Validate and normalise the rows of one group. `others` holds the other saved rows of the
    same group, used for the business-key duplicate check (EF-16, BR-GL-OB-25/79).
    """
    catalog = catalog or _Catalog(company)
    others = others or []
    rows = [r for r in _row_list(items) if isinstance(r, dict)]
    validator = _VALIDATORS[category]
    seen = {validator.key(o) for o in others if validator.key(o)}
    result = []
    for raw in rows:
        row = _clean_row(raw, setup)
        validator.check(row, setup, catalog)
        key = validator.key(row)
        if key and key in seen:
            _fail("EF-16", EF16, key=list(key) if isinstance(key, tuple) else key)
        if key:
            seen.add(key)
        result.append(row)
    if category == "accounts":
        _check_account_parent_child(result)
    return result


class _Accounts:
    @staticmethod
    def key(row):
        return _text(row, "account", "code") or None

    @staticmethod
    def check(row, setup, catalog):
        code = _text(row, "account", "code")
        debit = _amount(row, ("debit",))
        credit = _amount(row, ("credit",))
        if not debit and not credit and not row.get("details"):
            return
        acc = catalog.account(code, direct_entry=True)
        if debit > 0 and credit > 0 and not any(code.startswith(p) for p in UC_GL_15_BILATERAL_ACCOUNT_PREFIXES):
            if acc.normal_balance in ("DEBIT", "CREDIT"):
                _fail("BR-GL-OB-11", f"Tài khoản {code} chỉ có số dư một bên; không nhập đồng thời Dư Nợ và Dư Có.", account=code)
        details = row.get("details")
        if row.get("require_detail") and not details:
            _fail("EF-17", f"Tài khoản {code} bắt buộc nhập chi tiết số dư theo đối tượng/chiều theo dõi.", account=code)
        if isinstance(details, list) and details:
            det_d = sum((_amount(d, ("debit",)) for d in details), Decimal(0))
            det_c = sum((_amount(d, ("credit",)) for d in details), Decimal(0))
            _check_detail_sum(f"tài khoản {code}", debit, credit, det_d, det_c)
        row["account"] = code


def _check_account_parent_child(rows):
    """BR-GL-OB-10/71: a summary account is never a second source next to its detail accounts."""
    codes = {_text(r, "account", "code") for r in rows if _amount(r, ("debit",)) or _amount(r, ("credit",))}
    for code in codes:
        child = next((c for c in codes if c != code and c.startswith(code)), None)
        if child:
            _fail(
                "BR-GL-OB-10",
                f"Không nhập trực tiếp số dư tài khoản tổng hợp {code} khi đã có số dư ở tài khoản chi tiết {child}.",
                account=code,
            )


class _Bank:
    @staticmethod
    def key(row):
        number = _text(row, "accountNumber", "account_number")
        return (_text(row, "accountCode", "account_code"), number, _text(row, "currency").upper() or "VND") if number else None

    @staticmethod
    def check(row, setup, catalog):
        code = _text(row, "accountCode", "account_code")
        catalog.account(code)
        number = _text(row, "accountNumber", "account_number")
        if not number:
            _fail("EF-05", "Vui lòng chọn tài khoản ngân hàng.", field="accountNumber")
        catalog.bank_account(number)
        currency = _text(row, "currency").upper() or "VND"
        debit = _amount(row, ("originalAmount", "debit"))
        credit = _amount(row, ("credit",))
        row["debitVnd"], row["creditVnd"] = (str(v) for v in _vnd_amounts(row, debit, credit, currency))
        row["currency"] = currency


class _Partner:
    def __init__(self, category, label, missing_code):
        self.category, self.label, self.missing_code = category, label, missing_code

    @staticmethod
    def key(row):
        code = _text(row, "code", "partner_code", "employee_code")
        if not code:
            return None
        return (_text(row, "accCode", "account_code"), code, _text(row, "currency").upper() or "VND", _text(row, "invoiceNo", "invoice_no"))

    def check(self, row, setup, catalog):
        catalog.account(_text(row, "accCode", "account_code"))
        code = _text(row, "code", "partner_code", "employee_code")
        if not code:
            _fail(self.missing_code, f"Vui lòng chọn {self.label.lower()}.", field="code")
        if self.category == "employees":
            catalog.employee(code)
        else:
            catalog.party(code, self.label)
        currency = _text(row, "currency").upper() or "VND"
        debit = _amount(row, ("debit",))
        credit = _amount(row, ("credit",))
        row["debitVnd"], row["creditVnd"] = (str(v) for v in _vnd_amounts(row, debit, credit, currency))
        row["currency"] = currency
        invoices = row.get("invoiceDetails") or row.get("invoice_details")
        if self.category != "employees" and isinstance(invoices, list) and invoices:
            inv_d = inv_c = Decimal(0)
            is_customer = self.category == "customers"
            for idx, inv in enumerate(invoices, start=1):
                number = _text(inv, "invoiceNo", "invoice_no")
                if not number or not _text(inv, "invoiceDate", "invoice_date"):
                    _fail("BR-GL-OB-23", f"Dòng hóa đơn/chứng từ #{idx} thiếu số hoặc ngày chứng từ.", line=idx)
                _check_not_after_start(_text(inv, "invoiceDate", "invoice_date"), setup, "invoiceDate", "Ngày hóa đơn/chứng từ")
                invoice_value = _amount(inv, ("invoiceAmount", "invoice_amount"))
                remaining = _amount(inv, ("remainingAmount", "remaining_amount", "receivableAmount", "payableAmount"))
                advance = _amount(inv, ("advanceAmount", "advance_amount"))
                if invoice_value > 0 and remaining > invoice_value:
                    _fail("BR-GL-OB-23", f"Số còn lại trên chứng từ {number} vượt quá giá trị chứng từ.", line=idx)
                if is_customer:
                    inv_d += remaining
                    inv_c += advance
                else:
                    inv_c += remaining
                    inv_d += advance
            # C5/D5 & BR-GL-OB-24: Debit and Credit are compared separately, never netted
            _check_detail_sum(f"{self.label.lower()} {code}", debit, credit, inv_d, inv_c)
        dims = row.get("dimensionDetails") or row.get("dimension_details")
        if isinstance(dims, list) and dims:
            dim_d = sum((_amount(d, ("debit",)) for d in dims), Decimal(0))
            dim_c = sum((_amount(d, ("credit",)) for d in dims), Decimal(0))
            _check_detail_sum(f"{self.label.lower()} {code} theo đối tượng/hợp đồng", debit, credit, dim_d, dim_c)


class _Inventory:
    @staticmethod
    def key(row):
        item, warehouse = _text(row, "itemCode", "item_code"), _text(row, "warehouse")
        return (item, warehouse, _text(row, "lotNo", "lot_no")) if item and warehouse else None

    @staticmethod
    def check(row, setup, catalog):
        item_code = _text(row, "itemCode", "item_code")
        warehouse = _text(row, "warehouse")
        if not item_code:
            _fail("EF-09", "Vui lòng chọn hàng hóa.", field="itemCode")
        if not warehouse:
            _fail("EF-09", "Vui lòng chọn kho.", field="warehouse")
        item = catalog.item(item_code)
        catalog.warehouse(warehouse)
        if not _text(row, "unit"):
            _fail("EF-14", f"Mặt hàng {item_code} chưa có đơn vị tính.", field="unit")
        qty = _amount(row, ("quantity",), code="EF-14", message="Số lượng tồn không hợp lệ hoặc âm.", field_label="Số lượng tồn")
        value = _amount(row, ("amount", "value"), code="EF-14", message="Giá trị tồn không hợp lệ hoặc âm.", field_label="Giá trị tồn")
        if qty == 0 and value > 0 and not row.get("allow_zero_qty_value"):
            _fail("EF-14", f"Mặt hàng {item_code} có số lượng tồn bằng 0 nhưng giá trị tồn lớn hơn 0.", field="quantity")
        # F7 & BR-GL-OB-30: stock is tied to the item's inventory account, never to an invented one
        row["inventoryAccount"] = item.inventory_account.code if item.inventory_account_id else ""
        row["generates_in_period_warehouse_voucher"] = False


class _Tools:
    @staticmethod
    def key(row):
        return _text(row, "code", "toolCode") or None

    @staticmethod
    def check(row, setup, catalog):
        _required(row, {
            "Mã CCDC": ("code", "toolCode"), "Tên CCDC": ("name", "toolName"),
            "Ngày ghi tăng": ("voucherDate", "voucher_date"), "Tài khoản chờ phân bổ": ("waitingAccount",),
            "Số kỳ phân bổ": ("allocPeriod", "totalPeriods"),
        }, "EF-10", "Vui lòng nhập đầy đủ thông tin CCDC đầu kỳ.")
        code = _text(row, "code", "toolCode")
        _check_not_after_start(_text(row, "voucherDate", "voucher_date"), setup, "voucherDate", "Ngày ghi tăng")
        catalog.account(_text(row, "waitingAccount"))
        msg = f"Giá trị của CCDC '{code}' không hợp lệ."
        total = _amount(row, ("totalAmount", "originalValue"), code="EF-15", message=msg)
        allocated = _amount(row, ("allocatedVal", "allocatedValue"), code="EF-15", message=msg)
        remaining = _amount(row, ("remainingVal", "remainingValue"), code="EF-15", message=msg)
        periods = _amount(row, ("allocPeriod", "totalPeriods"), code="EF-15", message=msg)
        remaining_periods = _amount(row, ("remainingPeriod", "remainingPeriods"), code="EF-15", message=msg)
        # G4 & BR-GL-OB-32/33: còn lại = ban đầu − đã phân bổ; the allocated part is never allocated again
        if allocated > total or remaining != total - allocated:
            _fail("EF-15", f"Giá trị còn lại của CCDC '{code}' phải bằng giá trị ban đầu trừ giá trị đã phân bổ.",
                  difference=str(remaining - (total - allocated)))
        if periods <= 0 or periods != periods.to_integral_value() or remaining_periods > periods or (remaining > 0 and remaining_periods <= 0):
            _fail("EF-15", f"Số kỳ phân bổ hoặc số kỳ còn lại của CCDC '{code}' không hợp lệ.", field="remainingPeriod")
        rows = row.get("allocRows") or row.get("alloc_rows")
        if isinstance(rows, list) and rows and sum((_amount(r, ("rate",)) for r in rows), Decimal(0)) != Decimal("100"):
            _fail("EF-15", f"Tổng tỷ lệ phân bổ của CCDC '{code}' phải bằng 100%.", field="allocRows")


class _Assets:
    @staticmethod
    def key(row):
        return _text(row, "code", "assetCode") or None

    @staticmethod
    def check(row, setup, catalog):
        _required(row, {
            "Mã tài sản": ("code", "assetCode"), "Tên tài sản": ("name", "assetName"),
            "Loại tài sản": ("assetType", "asset_type"), "Ngày ghi tăng": ("voucherDate", "voucher_date"),
            "Bộ phận sử dụng": ("department", "assetDepartment"), "TK nguyên giá": ("costAcc", "cost_acc"),
            "TK hao mòn": ("deprAcc", "depr_acc"), "Nguyên giá": ("originalCost", "original_cost"),
        }, "EF-11", "Vui lòng nhập đầy đủ thông tin TSCĐ đầu kỳ.")
        code = _text(row, "code", "assetCode")
        acquired = _check_not_after_start(_text(row, "voucherDate", "voucher_date"), setup, "voucherDate", "Ngày ghi tăng")
        cost_acc = catalog.account(_text(row, "costAcc", "cost_acc"))
        depr_acc = catalog.account(_text(row, "deprAcc", "depr_acc"))
        if not cost_acc.code.startswith("21") or cost_acc.code.startswith("214") or not depr_acc.code.startswith("214"):
            _fail("EF-19", "Tài khoản nguyên giá hoặc tài khoản hao mòn của TSCĐ không phù hợp với chế độ kế toán.", field="costAcc")
        msg = f"Giá trị của TSCĐ '{code}' không hợp lệ."
        cost = _amount(row, ("originalCost", "original_cost"), code="EF-15", message=msg)
        accum = _amount(row, ("accumDepr", "accum_depr"), code="EF-15", message=msg)
        remaining = _amount(row, ("remainingVal", "remaining_val"), code="EF-15", message=msg)
        # H6 & BR-GL-OB-35/36: GTCL = Nguyên giá − Hao mòn lũy kế; depreciation before the start is not recomputed
        if cost <= 0 or accum > cost or remaining != cost - accum:
            _fail("EF-15", f"Giá trị còn lại của TSCĐ '{code}' phải bằng nguyên giá trừ hao mòn lũy kế.",
                  difference=str(remaining - (cost - accum)))
        if not (row.get("noDepreciation") or row.get("no_depreciation")):
            _required(row, {"Ngày bắt đầu khấu hao": ("deprStartDate", "depr_start_date"),
                            "Thời gian sử dụng": ("usageTime", "usage_time"),
                            "Thời gian còn lại": ("remainingTime", "remaining_time")},
                      "EF-11", "Vui lòng nhập đầy đủ dữ liệu khấu hao của TSCĐ.")
            depr_start = _parse_date(_text(row, "deprStartDate", "depr_start_date"))
            if depr_start is None or (acquired and depr_start < acquired):
                _fail("EF-31", "Ngày bắt đầu khấu hao phải hợp lệ và không trước ngày ghi tăng.", field="deprStartDate")
            usage = _amount(row, ("usageTime", "usage_time"), code="EF-15", message=msg)
            remaining_time = _amount(row, ("remainingTime", "remaining_time"), code="EF-15", message=msg)
            if usage <= 0 or remaining_time > usage or (remaining > 0 and remaining_time <= 0):
                _fail("EF-15", f"Thời gian sử dụng hoặc thời gian còn lại của TSCĐ '{code}' không hợp lệ.", field="remainingTime")
            rows = row.get("allocRows") or row.get("alloc_rows")
            if isinstance(rows, list) and rows and sum((_amount(r, ("rate",)) for r in rows), Decimal(0)) != Decimal("100"):
                _fail("EF-15", f"Tổng tỷ lệ phân bổ khấu hao của TSCĐ '{code}' phải bằng 100%.", field="allocRows")
        if row.get("taxLimitChecked") or row.get("tax_limit_checked"):
            if _amount(row, ("taxLawDeprCost", "tax_law_depr_cost"), code="EF-15", message=msg) <= 0:
                _fail("EF-15", f"Giá trị tính khấu hao theo luật thuế TNDN của TSCĐ '{code}' phải lớn hơn 0.", field="taxLawDeprCost")


class _Prepaid:
    @staticmethod
    def key(row):
        return _text(row, "code", "prepaidCode") or None

    @staticmethod
    def check(row, setup, catalog):
        _required(row, {"Mã chi phí trả trước": ("code", "prepaidCode"), "Tên chi phí trả trước": ("name", "prepaidName"),
                        "Số tiền": ("amount",)}, "EF-12", "Vui lòng nhập đầy đủ thông tin chi phí trả trước.")
        code = _text(row, "code", "prepaidCode")
        amount = _amount(row, ("amount",), code="EF-15", message=f"Số tiền của chi phí trả trước '{code}' không hợp lệ.")
        if amount <= 0:
            _fail("EF-15", f"Số tiền chưa phân bổ của chi phí trả trước '{code}' phải lớn hơn 0.", field="amount")
        if _first_key(row, ("allocMonths", "months"))[1] not in (None, ""):
            months = _amount(row, ("allocMonths", "months"), code="EF-15", message="Số kỳ phân bổ không hợp lệ.")
            # BR-GL-OB-39: a whole positive number of remaining periods
            if months <= 0 or months != months.to_integral_value():
                _fail("EF-15", f"Số kỳ phân bổ còn lại của chi phí trả trước '{code}' phải là số nguyên dương.", field="allocMonths")


class _Wip:
    @staticmethod
    def key(row):
        code = _text(row, "code")
        return (_text(row, "trackingMode", "tracking_mode", "subtab"), code) if code else None

    @staticmethod
    def check(row, setup, catalog):
        mode = _text(row, "trackingMode", "tracking_mode", "subtab")
        if mode not in UC_GL_15_WIP_TRACKING_MODES:
            _fail("EF-27", "Hình thức theo dõi chi phí dở dang không hợp lệ.", field="trackingMode")
        if not _text(row, "code"):
            _fail("EF-27", f"Dòng chi phí dở dang ({mode}) chưa chọn đối tượng theo dõi.", field="code")
        total = Decimal(0)
        for field in UC_GL_15_WIP_COST_FIELDS:
            total += _amount(row, (field,), code="EF-27", message=f"Số tiền khoản mục '{field}' không hợp lệ.")
        row["trackingMode"] = mode
        row["total"] = str(total)


_VALIDATORS = {
    "accounts": _Accounts,
    "bank": _Bank,
    "customers": _Partner("customers", "Khách hàng", "EF-06"),
    "suppliers": _Partner("suppliers", "Nhà cung cấp", "EF-07"),
    "employees": _Partner("employees", "Nhân viên", "EF-08"),
    "inventory": _Inventory,
    "tools": _Tools,
    "assets": _Assets,
    "prepaid": _Prepaid,
    "wip": _Wip,
}


# ---------------------------------------------------------------------------------------------
# One source per amount, GL synchronisation and dependencies
# ---------------------------------------------------------------------------------------------

def _detail_postings(saved: dict) -> list:
    """BR-GL-OB-08/19/30: (group, account, debit, credit, object) produced by the detail groups."""
    postings = []
    for row in saved.get("bank") or []:
        postings.append(("bank", _text(row, "accountCode", "account_code"), _to_dec_uc15(row.get("debitVnd")),
                         _to_dec_uc15(row.get("creditVnd")), _text(row, "accountNumber")))
    for category in ("customers", "suppliers", "employees"):
        for row in saved.get(category) or []:
            postings.append((category, _text(row, "accCode", "account_code"), _to_dec_uc15(row.get("debitVnd", row.get("debit"))),
                             _to_dec_uc15(row.get("creditVnd", row.get("credit"))), _text(row, "code")))
    for row in saved.get("inventory") or []:
        postings.append(("inventory", _text(row, "inventoryAccount"), _to_dec_uc15(row.get("amount", row.get("value"))),
                         Decimal(0), _text(row, "itemCode")))
    for row in saved.get("tools") or []:
        postings.append(("tools", _text(row, "waitingAccount"), _to_dec_uc15(row.get("remainingVal")), Decimal(0), _text(row, "code")))
    for row in saved.get("assets") or []:
        code = _text(row, "code", "assetCode")
        postings.append(("assets", _text(row, "costAcc"), _to_dec_uc15(row.get("originalCost")), Decimal(0), code))
        postings.append(("assets", _text(row, "deprAcc"), Decimal(0), _to_dec_uc15(row.get("accumDepr")), code))
    return [p for p in postings if p[2] or p[3]]


def _related(code_a: str, code_b: str) -> bool:
    return bool(code_a and code_b) and (code_a.startswith(code_b) or code_b.startswith(code_a))


def _assert_single_source(saved: dict):
    """EF-18 & BR-GL-OB-07/08: an account fed by a detail group takes no direct balance as well."""
    detail_accounts = {p[1]: p[0] for p in _detail_postings(saved) if p[1]}
    for row in saved.get("accounts") or []:
        code = _text(row, "account", "code")
        if not (_to_dec_uc15(row.get("debit")) or _to_dec_uc15(row.get("credit"))):
            continue
        owner = next((group for acc, group in detail_accounts.items() if _related(code, acc)), None)
        if owner:
            _fail("EF-18", EF18, account=code, managed_by=owner, managed_by_title=UC_GL_15_CATEGORY_TITLES[owner])


def _gl_source_lines(saved: dict) -> dict:
    """One line per account: direct balances plus the detail groups, never both for one amount."""
    lines = {}
    for row in saved.get("accounts") or []:
        code = _text(row, "account", "code")
        debit, credit = _to_dec_uc15(row.get("debit")), _to_dec_uc15(row.get("credit"))
        if code and (debit or credit):
            bucket = lines.setdefault(code, [Decimal(0), Decimal(0), "accounts"])
            bucket[0] += debit
            bucket[1] += credit
    for group, code, debit, credit, _obj in _detail_postings(saved):
        if code:
            bucket = lines.setdefault(code, [Decimal(0), Decimal(0), group])
            bucket[0] += debit
            bucket[1] += credit
    return lines


def _sync_opening_journal(company, saved: dict, setup: dict, request) -> str:
    """
    A7, B5, C7… & BR-GL-OB-17/53/74: rebuild the OPENING entry from the single source of every amount.
    An unbalanced set stays out of the GL until it balances (AF-16 shows the difference).
    """
    if not setup["uses_general_ledger"]:
        return "NOT_REQUIRED"
    from master_data.models import Currency

    lines = _gl_source_lines(saved)
    total_d = sum((v[0] for v in lines.values()), Decimal(0))
    total_c = sum((v[1] for v in lines.values()), Decimal(0))
    if total_d != total_c:
        return "PENDING_UNBALANCED"
    entry = models.JournalEntry.objects.select_for_update().filter(company=company, entry_type="OPENING").first()
    if entry is None:
        account = getattr(getattr(request, "user", None), "iam_account", None)
        if not lines or setup["first_period"] is None or account is None:
            return "NOT_CREATED"
        entry = models.JournalEntry.objects.create(
            company=company, period=setup["first_period"], number=f"OPEN-{setup['start'].year}-001",
            entry_type="OPENING", posting_date=setup["start"], document_date=setup["start"],
            description=f"Số dư đầu kỳ ngày {setup['start'].strftime('%d/%m/%Y')}", source_module="GL",
            status="POSTED", total_debit=Decimal(0), total_credit=Decimal(0), created_by=account,
        )
    currency = Currency.objects.filter(code="VND").first() or getattr(company, "accounting_currency", None)
    accounts = {a.code: a for a in models.Account.objects.filter(company=company, code__in=list(lines))}
    entry.lines.all().delete()
    line_no = 1
    for code in sorted(lines):
        debit, credit, group = lines[code]
        acc = accounts.get(code)
        if acc is None:
            continue
        for d_val, c_val in ((debit, Decimal(0)), (Decimal(0), credit)):
            if not (d_val or c_val):
                continue
            models.JournalLine.objects.create(
                entry=entry, line_no=line_no, account=acc,
                description=f"Số dư đầu kỳ {code} ({UC_GL_15_CATEGORY_TITLES[group]})",
                currency=currency, exchange_rate=Decimal("1"), foreign_amount=d_val or c_val,
                debit=d_val, credit=c_val,
            )
            line_no += 1
    entry.total_debit = total_d
    entry.total_credit = total_c
    entry.save(update_fields=["total_debit", "total_credit", "updated_at"])
    return "SYNCED"


def _mark_dependents_stale(company, setup: dict):
    """BR-GL-OB-67/75: GL aggregates and close checklists built on the old opening data are stale."""
    models.BalanceAggregationRun.objects.filter(
        company=company, period__start_date__gte=setup["start"], status__in=("VALID", "UP_TO_DATE", "WARNING"),
    ).update(status="STALE")
    models.PeriodCloseChecklist.objects.filter(
        company=company, period__start_date__gte=setup["start"], status__in=("READY", "WARNING"),
    ).update(status="STALE", can_confirm_close=False)


def _dependency_reason(company, category: str, row: dict) -> str:
    """EF-22 & BR-GL-OB-65: real follow-up operations recorded on the opening item."""
    from fixed_assets.models import AssetTransaction

    code = _text(row, "code", "assetCode", "toolCode")
    if category in ("assets", "tools") and code:
        asset_type = "FIXED_ASSET" if category == "assets" else "TOOL"
        if AssetTransaction.objects.filter(
            company=company, asset__code=code, asset__asset_type=asset_type, status="POSTED",
        ).exclude(transaction_type__in=("ACQUISITION", "OPENING")).exists():
            return "Đã phát sinh nghiệp vụ khấu hao/phân bổ, điều chuyển hoặc ghi giảm."
    if category == "prepaid" and code:
        if models.PrepaidExpense.objects.filter(company=company, code=code).filter(
            Q(allocated_amount__gt=0) | ~Q(status="ACTIVE")
        ).exists():
            return "Đã phân bổ chi phí trả trước trong kỳ."
    return ""


def _assert_no_dependency(company, category, row):
    if row and _dependency_reason(company, category, row):
        _fail("EF-22", EF22, item=_row_id(row))


# ---------------------------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------------------------

def _account_rollup(company, account_rows: list) -> list:
    """BR-GL-OB-10: totals per summary account from its detail accounts only, using the chart."""
    parents = {a.code: (a.parent.code if a.parent_id else "") for a in models.Account.objects.filter(company=company).select_related("parent")}
    names = {a.code: a.name for a in models.Account.objects.filter(company=company)}
    rollup = {}
    for row in account_rows:
        code = _text(row, "account", "code")
        debit, credit = _to_dec_uc15(row.get("debit")), _to_dec_uc15(row.get("credit"))
        if not code or not (debit or credit):
            continue
        chain, cursor = [], parents.get(code, "")
        while cursor and cursor not in chain:
            chain.append(cursor)
            cursor = parents.get(cursor, "")
        if not chain and len(code) > 3:
            chain = [code[:3]]
        for target in chain or [code]:
            entry = rollup.setdefault(target, {"account": target, "name": names.get(target, f"Tài khoản {target}"),
                                               "debit": 0, "credit": 0, "is_parent": bool(chain), "children_count": 0})
            entry["debit"] += int(debit)
            entry["credit"] += int(credit)
            if chain:
                entry["children_count"] += 1
    return sorted(rollup.values(), key=lambda r: r["account"])


def _gl_sync_status(company, saved, setup) -> str:
    if not setup["uses_general_ledger"]:
        return "NOT_REQUIRED"
    lines = _gl_source_lines(saved)
    if sum((v[0] for v in lines.values()), Decimal(0)) != sum((v[1] for v in lines.values()), Decimal(0)):
        return "PENDING_UNBALANCED"
    entry = models.JournalEntry.objects.filter(company=company, entry_type="OPENING").first()
    if entry is None:
        return "NOT_CREATED" if lines else "SYNCED"
    actual = {}
    for line in entry.lines.select_related("account"):
        bucket = actual.setdefault(line.account.code, [Decimal(0), Decimal(0)])
        bucket[0] += line.debit or 0
        bucket[1] += line.credit or 0
    expected = {k: [v[0], v[1]] for k, v in lines.items()}
    return "SYNCED" if actual == expected else "OUT_OF_SYNC"


def get_opening_balances_uc_gl_15(company, params=None, request=None) -> dict:
    """MF-01..MF-04: every group of the data set, totals from the single sources and the GL status."""
    _setting, config, setup, saved = _load(company)
    for key in UC_GL_15_CATEGORIES:
        if not isinstance(saved.get(key), list):
            saved[key] = []
    for category in ("assets", "tools", "prepaid"):
        for row in saved[category]:
            row["has_dependent_voucher"] = bool(_dependency_reason(company, category, row))
    lines = _gl_source_lines(saved) if setup["uses_general_ledger"] else {}
    total_debit = int(sum((v[0] for v in lines.values()), Decimal(0)))
    total_credit = int(sum((v[1] for v in lines.values()), Decimal(0)))
    entry = models.JournalEntry.objects.filter(company=company, entry_type="OPENING").first()
    categories = {key: saved[key] for key in UC_GL_15_CATEGORIES}
    return {
        "company_id": str(company.id),
        "company_name": company.name,
        "accounting_regime": setup["accounting_regime"],
        "bookkeeping_method": setup["bookkeeping_method"],
        "uses_general_ledger": setup["uses_general_ledger"],
        "supported_categories": list(setup["supported_categories"]),
        "category_titles": UC_GL_15_CATEGORY_TITLES,
        "start_date": setup["start_date"],
        "period_code": setup["period_code"],
        "opening_period_locked": setup["opening_period_locked"],
        "version": int(config.get("opening_balances_version") or 1),
        "gl_entry_number": entry.number if entry else None,
        "gl_sync_status": _gl_sync_status(company, saved, setup),
        **categories,
        "categories": categories,
        "account_rollup": _account_rollup(company, saved["accounts"]),
        "total_debit": total_debit,
        "total_credit": total_credit,
        "difference": total_debit - total_credit,
        "balanced": total_debit == total_credit,
        "balance_warning": None if total_debit == total_credit else (
            f"Tổng Dư Nợ ({total_debit:,} đ) và Tổng Dư Có ({total_credit:,} đ) đang lệch {abs(total_debit - total_credit):,} đ."
        ),
    }


# ---------------------------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------------------------

def _persist(company, setting, config, setup, saved, request, current_version, action, before, after):
    from .services import audit

    _assert_single_source(saved)
    sync_status = _sync_opening_journal(company, saved, setup, request)
    _mark_dependents_stale(company, setup)
    new_version = current_version + 1
    config[_storage_key(setup)] = saved
    config["opening_balances_version"] = new_version
    setting.configuration = config
    setting.save(update_fields=["configuration", "updated_at"])
    # BR-GL-OB-80: user, company, data set, group, operation and result
    audit(request, setting, action, before=before, after={
        **after, "version": new_version, "accounting_regime": setup["accounting_regime"],
        "start_date": setup["start_date"], "gl_sync_status": sync_status,
    })
    return sync_status


def _guarded(fn):
    """EF-25, EF-32 & BR-GL-OB-54: roll back and never confirm a partial save."""
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except (ValidationError, PermissionDenied):
            raise
        except Exception as exc:
            raise ValidationError({"error_code": "EF-25", "detail": EF25}) from exc
    wrapper.__name__ = fn.__name__
    wrapper.__doc__ = fn.__doc__
    return wrapper


@_guarded
def save_opening_balances_uc_gl_15(company, payload: dict, request=None) -> dict:
    """A6–A8, J6–J8 & AF-02: replace one or more whole groups (account list, WIP table)."""
    incoming = {}
    if payload.get("category"):
        incoming[str(payload["category"])] = payload.get("items") if "items" in payload else payload.get("rows")
    sources = payload.get("categories") if isinstance(payload.get("categories"), dict) else {}
    for key in UC_GL_15_CATEGORIES:
        value = payload.get(key) if payload.get(key) is not None else sources.get(key)
        if value is not None and key not in incoming:
            incoming[key] = value
    with transaction.atomic():
        setting, config, setup, saved = _load(company, lock=True)
        current_version = _assert_writable(setup, payload, config)
        catalog = _Catalog(company)
        for category, items in incoming.items():
            _assert_category(setup, category)
            previous = {_row_id(r): r for r in saved.get(category) or []}
            validated = validate_opening_balance_group_uc_gl_15(company, category, items or [], setup, catalog)
            new_ids = {_row_id(r) for r in validated}
            for row_id, old in previous.items():
                if row_id not in new_ids or old != next((r for r in validated if _row_id(r) == row_id), old):
                    _assert_no_dependency(company, category, old)
            saved[category] = validated
        sync_status = _persist(company, setting, config, setup, saved, request, current_version,
                               "SAVE_OPENING_BALANCES_UC_GL_15", {"version": current_version},
                               {"categories": list(incoming), "action_mode": payload.get("action_mode") or "SAVE"})
    res = get_opening_balances_uc_gl_15(company, request=request)
    res["action_mode"] = payload.get("action_mode") or "SAVE"
    res["updated_categories"] = list(incoming)
    res["sync_status"] = sync_status
    first = next(iter(incoming), "accounts")
    res["message"] = UC_GL_15_SAVE_MESSAGES.get(first, MSG_UPDATED) if setup["uses_general_ledger"] else MSG_TT58_SAVED
    return res


@_guarded
def upsert_opening_balance_item_uc_gl_15(company, payload: dict, request=None) -> dict:
    """B–I with AF-01 Lưu và Thêm, AF-02 Lưu và Đóng, AF-10 Sửa and AF-13 Lưu và in."""
    category = str(payload.get("category") or "").strip()
    item = payload.get("item")
    if not isinstance(item, dict):
        _fail("INVALID_ITEM", "Dữ liệu bản ghi số dư ban đầu không hợp lệ.")
    editing_id = str(payload.get("editing_id") or item.get("editing_id") or "").strip()
    action_mode = str(payload.get("action_mode") or "SAVE").upper()
    if action_mode == "SAVE_AND_PRINT" and not _has_permission(request, company, "OPENING_BALANCE_PRINT"):
        # AF-13 step 1 & BR-GL-OB-60: the print right is checked before anything is saved
        raise PermissionDenied(EF03)
    with transaction.atomic():
        setting, config, setup, saved = _load(company, lock=True)
        _assert_category(setup, category)
        current_version = _assert_writable(setup, payload, config)
        existing = [r for r in saved.get(category) or [] if isinstance(r, dict)]
        before = next((r for r in existing if editing_id and editing_id in _row_identifiers(r)), None)
        if editing_id and before is None:
            _fail("NOT_FOUND", f"Không tìm thấy bản ghi '{editing_id}' cần sửa.")
        _assert_no_dependency(company, category, before)
        others = [r for r in existing if r is not before]
        valid = validate_opening_balance_group_uc_gl_15(company, category, [item], setup, others=others)[0]
        valid["id"] = valid.get("id") or _row_id(valid) or f"{category}-{int(timezone.now().timestamp() * 1000)}"
        valid["updated_at"] = timezone.now().isoformat()
        saved[category] = [valid if r is before else r for r in existing] if before else [valid, *existing]
        sync_status = _persist(company, setting, config, setup, saved, request, current_version,
                               "EDIT_OPENING_BALANCE_ITEM" if before else "ADD_OPENING_BALANCE_ITEM",
                               {"category": category, "item": before},
                               {"category": category, "item": valid, "action_mode": action_mode})
    res = get_opening_balances_uc_gl_15(company, request=request)
    res.update(saved_item=valid, action_mode=action_mode, sync_status=sync_status)
    res["message"] = MSG_UPDATED if before else (
        UC_GL_15_SAVE_MESSAGES[category] if setup["uses_general_ledger"] else MSG_TT58_SAVED
    )
    if action_mode == "SAVE_AND_PRINT":
        # AF-13 & BR-GL-OB-61/62: print the saved row; a print failure keeps the save
        try:
            res["print_result"] = print_opening_balance_uc_gl_15(company, {"category": category, "item_id": valid["id"]}, request)
        except Exception:
            res["print_result"] = {"print_status": "ERROR", "error_code": "EF-26", "saved_data_intact": True, "message": EF26}
    return res


@_guarded
def delete_opening_balance_item_uc_gl_15(company, payload: dict, request=None) -> dict:
    """AF-11: delete a saved row when no lock or follow-up operation depends on it; history stays in the audit log."""
    category = str(payload.get("category") or "").strip()
    item_id = str(payload.get("item_id") or payload.get("id") or payload.get("code") or "").strip()
    with transaction.atomic():
        setting, config, setup, saved = _load(company, lock=True)
        _assert_category(setup, category)
        current_version = _assert_writable(setup, payload, config)
        existing = [r for r in saved.get(category) or [] if isinstance(r, dict)]
        target = next((r for r in existing if item_id and item_id in _row_identifiers(r)), None)
        if target is None:
            _fail("NOT_FOUND", f"Không tìm thấy bản ghi '{item_id}' trong nhóm {UC_GL_15_CATEGORY_TITLES[category]}.")
        _assert_no_dependency(company, category, target)
        saved[category] = [r for r in existing if r is not target]
        sync_status = _persist(company, setting, config, setup, saved, request, current_version,
                               "DELETE_OPENING_BALANCE_ITEM", {"category": category, "deleted_item": target},
                               {"category": category, "remaining_count": len(saved[category])})
    res = get_opening_balances_uc_gl_15(company, request=request)
    res.update(deleted_item_id=item_id, sync_status=sync_status, message=MSG_DELETED)
    return res


@_guarded
def import_opening_balances_excel_uc_gl_15(company, payload: dict, request=None) -> dict:
    """
    AF-03, EF-20 & BR-GL-OB-58/59: check every row first (dry_run), then save only the valid rows;
    rows with errors never reach the official balances.
    """
    category = str(payload.get("category") or "").strip()
    rows = payload.get("rows")
    dry_run = str(payload.get("dry_run", "")).lower() in ("true", "1")
    atomic = str(payload.get("atomic", "false")).lower() in ("true", "1")
    with transaction.atomic():
        setting, config, setup, saved = _load(company, lock=True)
        _assert_category(setup, category)
        if not isinstance(rows, list) or not rows:
            _fail("EF-20", "Tệp Excel không có dữ liệu hoặc sai cấu trúc mẫu.")
        current_version = _assert_writable(setup, payload, config)
        catalog = _Catalog(company)
        replace = category == "accounts" or str(payload.get("replace_existing", "")).lower() in ("true", "1")
        accepted = [] if replace else [r for r in saved.get(category) or [] if isinstance(r, dict)]
        valid_rows, row_errors = [], []
        for idx, row in enumerate(rows, start=1):
            if not isinstance(row, dict):
                row_errors.append({"row_index": idx, "error_code": "EF-20", "message": f"Dòng {idx}: Định dạng dữ liệu không hợp lệ."})
                continue
            try:
                valid = validate_opening_balance_group_uc_gl_15(company, category, [row], setup, catalog, others=accepted)[0]
            except ValidationError as exc:
                detail = exc.detail if isinstance(exc.detail, dict) else {"detail": exc.detail}
                row_errors.append({
                    "row_index": idx, "error_code": str(detail.get("error_code") or "EF-20"),
                    "column": str(detail.get("field") or ""),
                    "message": f"Dòng {idx}: {detail.get('detail')}",
                })
                continue
            valid["id"] = valid.get("id") or _row_id(valid) or f"{category}-xl-{idx}"
            valid_rows.append(valid)
            accepted.append(valid)
        summary = {"category": category, "total_rows": len(rows), "valid_count": len(valid_rows),
                   "error_count": len(row_errors), "row_errors": row_errors}
        if dry_run:
            return {"import_summary": {**summary, "imported_count": 0}, "dry_run": True}
        if row_errors and (atomic or not valid_rows):
            _fail("EF-20", f"Phát hiện {len(row_errors)} dòng lỗi trong tệp Excel; không nhập các dòng lỗi.", **summary)
        saved[category] = accepted
        sync_status = _persist(company, setting, config, setup, saved, request, current_version,
                               "IMPORT_OPENING_BALANCES_EXCEL_UC_GL_15", {"category": category},
                               {"category": category, "imported_count": len(valid_rows), "error_count": len(row_errors)})
    res = get_opening_balances_uc_gl_15(company, request=request)
    res["import_summary"] = {**summary, "imported_count": len(valid_rows)}
    res["sync_status"] = sync_status
    res["message"] = f"Đã nhập {len(valid_rows)} dòng thành công, {len(row_errors)} dòng lỗi."
    return res


# ---------------------------------------------------------------------------------------------
# AF-16: balance and reconciliation check
# ---------------------------------------------------------------------------------------------

def check_opening_balances_uc_gl_15(company, params=None, request=None) -> dict:
    """
    AF-16, EF-29, BR-GL-OB-15/70–73: Debit = Credit for double-entry books, one source per account,
    details against their summaries and the GL entry; nothing is created or corrected.
    """
    _setting, _config, setup, saved = _load(company)
    checks = []

    def add(status, group, message, account="", obj="", difference=0):
        checks.append({"status": status, "group": group, "group_title": UC_GL_15_CATEGORY_TITLES.get(group, group),
                       "account": account, "object": obj, "difference": int(difference), "message": message})

    if setup["uses_general_ledger"]:
        lines = _gl_source_lines(saved)
        total_d = sum((v[0] for v in lines.values()), Decimal(0))
        total_c = sum((v[1] for v in lines.values()), Decimal(0))
        if total_d != total_c:
            add("ERROR", "accounts", f"Tổng Dư Nợ ({int(total_d):,}) và Tổng Dư Có ({int(total_c):,}) không cân đối.",
                difference=total_d - total_c)
        try:
            _assert_single_source(saved)
        except ValidationError as exc:
            add("ERROR", "accounts", str(exc.detail.get("detail")), account=str(exc.detail.get("account", "")))
        try:
            _check_account_parent_child(saved.get("accounts") or [])
        except ValidationError as exc:
            add("ERROR", "accounts", str(exc.detail.get("detail")), account=str(exc.detail.get("account", "")))
        known = set(models.Account.objects.filter(company=company).values_list("code", flat=True))
        for code in lines:
            if code not in known:
                add("ERROR", lines[code][2], f"Tài khoản {code} không thuộc hệ thống tài khoản của bộ dữ liệu.", account=code)
        sync = _gl_sync_status(company, saved, setup)
        if sync in ("OUT_OF_SYNC", "NOT_CREATED"):
            add("WARNING", "accounts", "Bút toán số dư đầu kỳ trên Sổ cái chưa khớp dữ liệu đã lưu; lưu lại để cập nhật.")
        for row in saved.get("inventory") or []:
            if not _text(row, "inventoryAccount"):
                add("WARNING", "inventory", "Mặt hàng chưa có tài khoản kho nên chưa đối chiếu được với Sổ cái.",
                    obj=_text(row, "itemCode"))
    for group in ("prepaid", "wip"):
        if saved.get(group):
            add("WARNING", group, "Nhóm chưa khai báo tài khoản kế toán; cần đối chiếu thủ công với số dư tài khoản liên quan.")
    for category in ("customers", "suppliers"):
        for row in saved.get(category) or []:
            try:
                _VALIDATORS[category].check(dict(row), setup, _Catalog(company))
            except ValidationError as exc:
                add("ERROR", category, str(exc.detail.get("detail")), account=_text(row, "accCode"), obj=_text(row, "code"))
    status = "ERROR" if any(c["status"] == "ERROR" for c in checks) else ("WARNING" if checks else "PASS")
    return {
        "company_id": str(company.id),
        "start_date": setup["start_date"],
        "accounting_regime": setup["accounting_regime"],
        "uses_general_ledger": setup["uses_general_ledger"],
        "status": status,
        "status_display": {"PASS": "Đạt", "WARNING": "Cảnh báo", "ERROR": "Lỗi"}[status],
        "checks": checks,
    }


# ---------------------------------------------------------------------------------------------
# AF-09 & AF-13: list and print
# ---------------------------------------------------------------------------------------------

def list_opening_balance_vouchers_uc_gl_15(company, params=None, request=None) -> dict:
    params = params or {}
    state = get_opening_balances_uc_gl_15(company, params=params, request=request)
    category_filter = str(params.get("category") or "").strip()
    vouchers = []
    if (not category_filter or category_filter == "accounts") and state["gl_entry_number"]:
        vouchers.append({
            "voucher_id": "OPENING-GL", "voucher_no": state["gl_entry_number"], "voucher_date": state["start_date"],
            "category": "accounts", "category_title": UC_GL_15_CATEGORY_TITLES["accounts"],
            "description": "Bút toán số dư đầu kỳ trên Sổ cái",
            "debit": state["total_debit"], "credit": state["total_credit"],
            "amount": max(state["total_debit"], state["total_credit"]),
            "status": state["gl_sync_status"], "has_dependent_voucher": False,
        })
    for category in UC_GL_15_CATEGORIES[1:]:
        if category_filter and category_filter != category:
            continue
        for idx, row in enumerate(state.get(category) or [], start=1):
            amount = max(
                _to_dec_uc15(row.get("debitVnd", row.get("debit"))) + _to_dec_uc15(row.get("creditVnd", row.get("credit"))),
                _to_dec_uc15(row.get("amount") or row.get("remainingVal") or row.get("originalCost") or row.get("total")),
            )
            vouchers.append({
                "voucher_id": _row_id(row) or f"{category}-{idx}",
                "voucher_no": str(row.get("voucherNo") or row.get("invoiceNo") or _row_id(row)),
                "voucher_date": str(row.get("voucherDate") or row.get("opening_date") or state["start_date"]),
                "category": category, "category_title": UC_GL_15_CATEGORY_TITLES[category],
                "description": f"{UC_GL_15_CATEGORY_TITLES[category]} {_row_id(row)} {row.get('name') or row.get('itemName') or ''}".strip(),
                "debit": int(_to_dec_uc15(row.get("debitVnd", row.get("debit")))),
                "credit": int(_to_dec_uc15(row.get("creditVnd", row.get("credit")))),
                "amount": int(amount), "status": "SAVED",
                "has_dependent_voucher": bool(row.get("has_dependent_voucher")),
            })
    return {
        "company_id": str(company.id), "start_date": state["start_date"],
        "category_filter": category_filter or "ALL", "total_vouchers": len(vouchers), "vouchers": vouchers,
    }


def print_opening_balance_uc_gl_15(company, payload: dict, request=None) -> dict:
    """AF-13 & BR-GL-OB-60/61: a print of saved data only; printing never saves again."""
    from .services import audit

    state = get_opening_balances_uc_gl_15(company, request=request)
    category = str(payload.get("category") or "accounts").strip()
    if category not in state["supported_categories"]:
        _fail("AF-15", "Nhóm số dư này không áp dụng cho bộ sổ kế toán đang sử dụng.")
    rows = state.get(category) or []
    item_id = str(payload.get("item_id") or "")
    if item_id:
        rows = [r for r in rows if item_id in _row_identifiers(r)]
    from common_services.models import CoreCompanySetting

    setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
    audit(request, setting, "PRINT_OPENING_BALANCE_UC_GL_15", after={"category": category, "row_count": len(rows)})
    return {
        "print_status": "READY",
        "title": f"BẢNG KÊ SỐ DƯ BAN ĐẦU – {UC_GL_15_CATEGORY_TITLES[category].upper()}",
        "circular_ref": UC_GL_15_CIRCULARS[state["accounting_regime"]],
        "company_name": company.name,
        "start_date": state["start_date"],
        "category": category,
        "category_title": UC_GL_15_CATEGORY_TITLES[category],
        "printed_at": timezone.now().isoformat(),
        "row_count": len(rows),
        "rows": rows,
        "total_debit": state["total_debit"],
        "total_credit": state["total_credit"],
        "balanced": state["balanced"],
    }
