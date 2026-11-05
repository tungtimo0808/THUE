from datetime import date
from decimal import Decimal

from django.test import SimpleTestCase

from .analysis_services import Movement, apply_mode, build_rows

JAN, FEB = "2026-01-01", "2026-02-01"
START = date(2026, 1, 1)


def line(code, month, debit=0, credit=0, entry_type="MANUAL", bucket="A"):
    posted = date.fromisoformat(month)
    return Movement(code, code, bucket, posted, posted, entry_type, Decimal(debit), Decimal(credit))


class AnalysisRowsTests(SimpleTestCase):
    def test_revenue_expense_ignores_closing_entries_and_computes_profit(self):
        movements = [line("511", JAN, credit=100), line("632", JAN, debit=60), line("511", FEB, debit=100, entry_type="CLOSING")]
        rows, base = build_rows("REVENUE_EXPENSE", "MONTH", [JAN, FEB], movements, START)
        self.assertEqual(rows[-1]["name"], "Lợi nhuận")
        self.assertEqual(rows[-1]["values"], {JAN: Decimal(40), FEB: Decimal(0)})
        self.assertEqual(base["values"][JAN], Decimal(100))

    def test_balance_sheet_carries_balances_forward_and_stays_balanced(self):
        movements = [
            line("111", "2025-12-01", debit=500), line("411", "2025-12-01", credit=500),
            line("111", JAN, debit=100), line("511", JAN, credit=100),
        ]
        rows, assets = build_rows("BALANCE_SHEET", "MONTH", [JAN, FEB], movements, START)
        self.assertEqual(assets["values"], {JAN: Decimal(600), FEB: Decimal(600)})
        self.assertEqual(rows[-1]["values"], assets["values"])

    def test_branches_are_split_and_period_limited(self):
        movements = [line("511", JAN, credit=70, bucket="A"), line("511", JAN, credit=30, bucket="B"), line("511", "2025-12-01", credit=9, bucket="A")]
        rows, _ = build_rows("REVENUE", "BRANCH", ["A", "B"], movements, START)
        self.assertEqual(rows[0]["values"], {"A": Decimal(70), "B": Decimal(30)})

    def test_growth_and_ratio_columns(self):
        columns = [{"key": JAN, "label": "1"}, {"key": FEB, "label": "2"}]
        rows, base = build_rows("REVENUE", "MONTH", [JAN, FEB], [line("511", JAN, credit=100), line("511", FEB, credit=150)], START)
        _, grown = apply_mode("GROWTH", columns, rows, base)
        self.assertEqual(grown[0]["values"][f"{FEB}__pct"], Decimal("50.00"))
        rows, base = build_rows("REVENUE", "MONTH", [JAN, FEB], [line("511", JAN, credit=25), line("515", JAN, credit=75)], START)
        _, ratio = apply_mode("RATIO", columns, rows, base)
        self.assertEqual(ratio[0]["values"][f"{JAN}__pct"], Decimal("25.00"))
        self.assertIsNone(ratio[0]["values"][f"{FEB}__pct"])
