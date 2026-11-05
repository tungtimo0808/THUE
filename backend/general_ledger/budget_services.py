"""Kế hoạch ngân sách so với thực hiện (màn hình Ngân sách › Biểu đồ).

Thực hiện lấy từ sổ cái: bút toán đã ghi sổ trong năm, bỏ bút toán số dư đầu kỳ, bút toán kết chuyển
(entry_type CLOSING hoặc có dòng TK 911) để doanh thu/chi phí không bị triệt tiêu về 0 sau khóa sổ.
Bút toán gốc đã bị đảo (REVERSED) vẫn được tính cùng bút toán đảo để hai bên bù trừ đúng.
Phân loại theo đầu tài khoản dùng chung cho TT200/TT133/TT99.
"""
from collections import defaultdict
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from . import models

REVENUE_PREFIXES = ("511", "515", "711")
REVENUE_DEDUCTION_PREFIXES = ("521",)
EXPENSE_PREFIXES = ("632", "635", "641", "642", "811", "821")
ZERO = Decimal("0")


def _classify(code: str) -> str | None:
    if code.startswith(REVENUE_PREFIXES):
        return "revenue"
    if code.startswith(REVENUE_DEDUCTION_PREFIXES):
        return "deduction"
    if code.startswith(EXPENSE_PREFIXES):
        return "expense"
    return None


def _prefix_q(field: str) -> Q:
    q = Q()
    for prefix in REVENUE_PREFIXES + REVENUE_DEDUCTION_PREFIXES + EXPENSE_PREFIXES:
        q |= Q(**{f"{field}__startswith": prefix})
    return q


def budget_performance(company, year: int, branch_id=None) -> dict:
    months = {m: {"revenue_plan": ZERO, "revenue_actual": ZERO, "expense_plan": ZERO, "expense_actual": ZERO} for m in range(1, 13)}
    branches: dict = defaultdict(lambda: {"branch_name": "", "revenue_plan": ZERO, "revenue_actual": ZERO})

    plans = models.BudgetLine.objects.filter(company=company, period__start_date__year=year).filter(_prefix_q("account__code"))
    if branch_id:
        plans = plans.filter(branch_id=branch_id)
    for row in plans.values("period__start_date__month", "account__code", "branch_id", "branch__name").annotate(total=Sum("amount")):
        kind = _classify(row["account__code"])
        month = months[row["period__start_date__month"]]
        amount = row["total"] or ZERO
        if kind == "expense":
            month["expense_plan"] += amount
        else:
            signed = -amount if kind == "deduction" else amount
            month["revenue_plan"] += signed
            branch = branches[row["branch_id"]]
            branch["branch_name"] = row["branch__name"] or "Không gắn đơn vị"
            branch["revenue_plan"] += signed

    lines = models.JournalLine.objects.filter(
        entry__company=company,
        entry__status__in=(models.JournalStatus.POSTED, models.JournalStatus.REVERSED),
        entry__posting_date__year=year,
    ).exclude(entry__entry_type__in=("OPENING", "CLOSING")).exclude(
        entry_id__in=models.JournalLine.objects.filter(
            entry__company=company, entry__posting_date__year=year, account__code__startswith="911"
        ).values("entry_id")
    ).filter(_prefix_q("account__code"))
    if branch_id:
        lines = lines.filter(entry__branch_id=branch_id)
    for row in lines.values("entry__posting_date__month", "account__code", "entry__branch_id", "entry__branch__name").annotate(
        debit=Sum("debit"), credit=Sum("credit")
    ):
        kind = _classify(row["account__code"])
        month = months[row["entry__posting_date__month"]]
        debit, credit = row["debit"] or ZERO, row["credit"] or ZERO
        if kind == "expense":
            month["expense_actual"] += debit - credit
        else:
            amount = credit - debit  # 521 có số dư Nợ nên tự giảm doanh thu
            month["revenue_actual"] += amount
            branch = branches[row["entry__branch_id"]]
            branch["branch_name"] = row["entry__branch__name"] or "Không gắn đơn vị"
            branch["revenue_actual"] += amount

    month_rows = []
    totals = {key: ZERO for key in ("revenue_plan", "revenue_actual", "expense_plan", "expense_actual")}
    for number, data in months.items():
        for key in totals:
            totals[key] += data[key]
        month_rows.append({"month": number, **{k: str(v) for k, v in data.items()},
                           "profit_plan": str(data["revenue_plan"] - data["expense_plan"]),
                           "profit_actual": str(data["revenue_actual"] - data["expense_actual"])})
    return {
        "year": year,
        "months": month_rows,
        "totals": {**{k: str(v) for k, v in totals.items()},
                   "profit_plan": str(totals["revenue_plan"] - totals["expense_plan"]),
                   "profit_actual": str(totals["revenue_actual"] - totals["expense_actual"])},
        "by_branch": [
            {"branch_id": str(key) if key else None, "branch_name": value["branch_name"],
             "revenue_plan": str(value["revenue_plan"]), "revenue_actual": str(value["revenue_actual"])}
            for key, value in branches.items()
        ],
        "calculated_at": timezone.now().isoformat(),
    }
