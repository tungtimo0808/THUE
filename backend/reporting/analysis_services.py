"""Multi-branch and multi-period analysis computed from posted journal lines."""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import TruncMonth
from rest_framework.exceptions import ValidationError

from general_ledger.models import JournalLine
from organization.models import Branch

KINDS = ("TRIAL_BALANCE", "REVENUE", "EXPENSE", "REVENUE_EXPENSE", "BALANCE_SHEET", "CASH")
DIMENSIONS = ("BRANCH", "MONTH")
MODES = ("VALUE", "RATIO", "GROWTH")
ZERO = Decimal("0")
UNASSIGNED = "__none__"
NOTES = {
    "BALANCE_SHEET": "Số dư theo tài khoản cấp 1, chưa tách số dư lưỡng tính của 131 và 331.",
    "CASH": "Thu và chi trên tài khoản 111, 112, chưa loại chuyển tiền nội bộ và chưa phân theo hoạt động.",
}


@dataclass(frozen=True)
class Movement:
    code: str
    name: str
    bucket: str
    posting_month: date
    entry_type: str
    debit: Decimal
    credit: Decimal


def _months(from_date, to_date):
    year, month = from_date.year, from_date.month
    while (year, month) <= (to_date.year, to_date.month):
        yield date(year, month, 1)
        month += 1
        if month > 12:
            year, month = year + 1, 1


def _columns(company, dimension, from_date, to_date):
    if dimension == "MONTH":
        return [{"key": month.isoformat(), "label": f"Tháng {month.month}/{month.year}"} for month in _months(from_date, to_date)]
    columns = [{"key": str(branch.id), "label": branch.name} for branch in Branch.objects.filter(company=company).order_by("code")]
    return columns + [{"key": UNASSIGNED, "label": "Không gán chi nhánh"}]


def _movements(company, to_date):
    rows = (
        JournalLine.objects.filter(entry__company=company, entry__status="POSTED", entry__posting_date__lte=to_date)
        .annotate(month=TruncMonth("entry__posting_date"))
        .values("account__code", "account__name", "entry__branch_id", "entry__entry_type", "month")
        .annotate(total_debit=Sum("debit"), total_credit=Sum("credit"))
    )
    return [
        Movement(row["account__code"], row["account__name"], str(row["entry__branch_id"] or UNASSIGNED), row["month"],
                 row["entry__entry_type"], row["total_debit"] or ZERO, row["total_credit"] or ZERO)
        for row in rows
    ]


def _income_amount(item):
    return item.credit - item.debit if item.code[0] in "57" else item.debit - item.credit


def _sum_rows(movements, dimension, keys, from_date, cumulative, amount, name_of=None):
    """Totals per account across the columns; cumulative columns carry the balance forward."""
    totals = defaultdict(lambda: defaultdict(lambda: ZERO))
    names = {}
    month_keys = sorted(keys) if dimension == "MONTH" else []
    for item in movements:
        code = name_of(item) if name_of else item.code
        names[code] = item.name if not name_of else names.get(code, item.name)
        if dimension == "MONTH":
            month = item.posting_month.isoformat()
            if cumulative:
                for key in month_keys:
                    if month <= key:
                        totals[code][key] += amount(item)
            elif month in keys:
                totals[code][month] += amount(item)
        elif cumulative or item.posting_month >= from_date.replace(day=1):
            totals[code][item.bucket] += amount(item)
    return totals, names


def _row(code, name, values, keys, bold=False):
    return {"code": code, "name": name, "bold": bold, "values": {key: values.get(key, ZERO) for key in keys}}


def _total(name, rows, keys, sign=None):
    values = {key: sum((row["values"][key] for row in rows), ZERO) for key in keys}
    return _row("", name, values, keys, bold=True)


def _section(title, movements, dimension, keys, from_date, cumulative, amount, prefix=None):
    totals, names = _sum_rows(movements, dimension, keys, from_date, cumulative, amount, name_of=prefix)
    rows = [_row(code, names[code], totals[code], keys) for code in sorted(totals)]
    return rows, _total(title, rows, keys)


def build_rows(kind, dimension, keys, movements, from_date):
    in_period = [item for item in movements if item.posting_month >= from_date.replace(day=1)]
    operating = [item for item in in_period if item.entry_type != "CLOSING"]
    income = [item for item in operating if item.code[0] in "57"]
    expense = [item for item in operating if item.code[0] in "68"]
    if kind == "TRIAL_BALANCE":
        rows, total = _section("Cộng", in_period, dimension, keys, from_date, False, lambda item: item.debit - item.credit)
        return rows + [total], None
    if kind == "REVENUE":
        rows, total = _section("Tổng doanh thu và thu nhập", income, dimension, keys, from_date, False, _income_amount)
        return rows + [total], total
    if kind == "EXPENSE":
        rows, total = _section("Tổng chi phí", expense, dimension, keys, from_date, False, _income_amount)
        return rows + [total], total
    if kind == "REVENUE_EXPENSE":
        revenue_rows, revenue = _section("Tổng doanh thu và thu nhập", income, dimension, keys, from_date, False, _income_amount)
        expense_rows, cost = _section("Tổng chi phí", expense, dimension, keys, from_date, False, _income_amount)
        profit = _row("", "Lợi nhuận", {key: revenue["values"][key] - cost["values"][key] for key in keys}, keys, bold=True)
        return revenue_rows + [revenue] + expense_rows + [cost, profit], revenue
    if kind == "CASH":
        cash = [item for item in in_period if item.code.startswith(("111", "112"))]
        receipts, _ = _sum_rows(cash, dimension, keys, from_date, False, lambda item: item.debit, name_of=lambda item: "Thu")
        payments, _ = _sum_rows(cash, dimension, keys, from_date, False, lambda item: item.credit, name_of=lambda item: "Chi")
        rows = [_row("", "Tiền thu", receipts["Thu"], keys), _row("", "Tiền chi", payments["Chi"], keys)]
        net = _row("", "Lưu chuyển thuần", {key: rows[0]["values"][key] - rows[1]["values"][key] for key in keys}, keys, bold=True)
        return rows + [net], None
    level_one = lambda item: item.code[:3]  # noqa: E731
    asset_rows, assets = _section(
        "Tổng tài sản", [item for item in movements if item.code[0] in "12"], dimension, keys, from_date, True,
        lambda item: item.debit - item.credit, level_one)
    capital_rows, capital = _section(
        "Nợ phải trả và vốn chủ sở hữu (chưa gồm lợi nhuận chưa kết chuyển)",
        [item for item in movements if item.code[0] in "34"], dimension, keys, from_date, True,
        lambda item: item.credit - item.debit, level_one)
    open_result, _ = _sum_rows(
        [item for item in movements if item.code[0] in "5678"], dimension, keys, from_date, True,
        lambda item: item.credit - item.debit, name_of=lambda item: "PL")
    result = _row("", "Lợi nhuận chưa kết chuyển", open_result["PL"], keys)
    grand = _row("", "Tổng nguồn vốn", {key: capital["values"][key] + result["values"][key] for key in keys}, keys, bold=True)
    return asset_rows + [assets] + capital_rows + [capital, result, grand], assets


def _percent(value, base):
    return None if not base else (value / base * 100).quantize(Decimal("0.01"))


def apply_mode(mode, columns, rows, base):
    if mode == "VALUE":
        return columns, rows
    keys = [column["key"] for column in columns]
    expanded = []
    for position, column in enumerate(columns):
        expanded.append(column)
        if mode == "RATIO":
            expanded.append({"key": f"{column['key']}__pct", "label": "Tỷ lệ %", "percent": True})
        elif position:
            expanded.append({"key": f"{column['key']}__pct", "label": "Tăng trưởng %", "percent": True})
    for row in rows:
        for position, key in enumerate(keys):
            if mode == "RATIO":
                row["values"][f"{key}__pct"] = _percent(row["values"][key], base["values"][key] if base else ZERO)
            elif position:
                previous = row["values"][keys[position - 1]]
                row["values"][f"{key}__pct"] = _percent(row["values"][key] - previous, abs(previous))
    return expanded, rows


def analysis_report(company, kind, dimension, from_date, to_date, mode="VALUE"):
    if kind not in KINDS or dimension not in DIMENSIONS or mode not in MODES:
        raise ValidationError({"kind": "Loại phân tích không hợp lệ."})
    if from_date > to_date:
        raise ValidationError({"from_date": "Từ ngày phải nhỏ hơn hoặc bằng đến ngày."})
    if dimension == "MONTH" and (to_date.year - from_date.year) * 12 + to_date.month - from_date.month >= 36:
        raise ValidationError({"to_date": "Phân tích theo tháng tối đa 36 tháng."})
    columns = _columns(company, dimension, from_date, to_date)
    keys = [column["key"] for column in columns]
    rows, base = build_rows(kind, dimension, keys, _movements(company, to_date), from_date)
    columns, rows = apply_mode(mode, columns, rows, base)
    return {"kind": kind, "dimension": dimension, "from_date": from_date, "to_date": to_date, "columns": columns,
            "rows": rows, "note": NOTES.get(kind, "")}
