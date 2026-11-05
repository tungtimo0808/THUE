from datetime import date
from decimal import Decimal

from django.test import TestCase

from iam.models import UserAccount

from . import tests as gl_tests


class BudgetPerformanceTests(TestCase):
    """Ngân sách › Biểu đồ: kế hoạch lấy từ BudgetLine, thực hiện lấy từ sổ cái đã ghi sổ."""

    _create_postable_account = gl_tests.FinancialStatementUcGl13Tests._create_postable_account

    def setUp(self):
        gl_tests.FinancialStatementUcGl13Tests.setUp(self)
        self.actor, _ = UserAccount.objects.get_or_create(auth_user=self.chief, defaults={"display_name": "Kế toán"})
        self.url = f"/api/v1/general-ledger/budgets/performance/?company_id={self.company.id}&year=2026"

    def _entry(self, number, lines, status="POSTED", entry_type="MANUAL", posting_date=date(2026, 10, 15)):
        total = sum((Decimal(debit) for _, debit, _ in lines), Decimal("0"))
        entry = self.models.JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number=number, entry_type=entry_type,
            posting_date=posting_date, document_date=posting_date, description=number, status=status,
            created_by=self.actor, total_debit=total, total_credit=total,
        )
        for index, (account, debit, credit) in enumerate(lines, start=1):
            self.models.JournalLine.objects.create(
                entry=entry, line_no=index, account=account, debit=Decimal(debit), credit=Decimal(credit),
                currency=self.currency, exchange_rate=Decimal("1"),
            )
        return entry

    def test_plan_vs_actual_excludes_closing_and_nets_reversals(self):
        self.models.BudgetLine.objects.create(company=self.company, period=self.period, account=self.rev_account, branch=self.branch, amount=Decimal("1000"))
        self.models.BudgetLine.objects.create(company=self.company, period=self.period, account=self.acc_632, branch=self.branch, amount=Decimal("600"))
        # Doanh thu 800, giá vốn 500 đã ghi sổ.
        self._entry("BH-1", [(self.ar_account, "800", "0"), (self.rev_account, "0", "800")])
        self._entry("XK-1", [(self.acc_632, "500", "0"), (self.acc_156, "0", "500")])
        # Bút toán bị đảo toàn bộ: gốc REVERSED + bút toán đảo POSTED -> bù trừ về 0.
        self._entry("BH-2", [(self.ar_account, "300", "0"), (self.rev_account, "0", "300")], status="REVERSED")
        self._entry("BH-2-DAO", [(self.rev_account, "300", "0"), (self.ar_account, "0", "300")], entry_type="REVERSAL")
        # Kết chuyển cuối kỳ không được làm doanh thu/chi phí về 0.
        self._entry("KC-1", [(self.rev_account, "800", "0"), (self.acc_911, "0", "800")], entry_type="CLOSING", posting_date=date(2026, 10, 31))
        self._entry("KC-2", [(self.acc_911, "500", "0"), (self.acc_632, "0", "500")], posting_date=date(2026, 10, 31))
        # Nháp không tính.
        self._entry("BH-NHAP", [(self.ar_account, "999", "0"), (self.rev_account, "0", "999")], status="DRAFT")

        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200, res.data)
        october = res.data["months"][9]
        self.assertEqual(Decimal(october["revenue_plan"]), Decimal("1000"))
        self.assertEqual(Decimal(october["revenue_actual"]), Decimal("800"))
        self.assertEqual(Decimal(october["expense_plan"]), Decimal("600"))
        self.assertEqual(Decimal(october["expense_actual"]), Decimal("500"))
        self.assertEqual(Decimal(october["profit_actual"]), Decimal("300"))
        self.assertEqual(Decimal(res.data["totals"]["profit_plan"]), Decimal("400"))
        self.assertEqual(Decimal(res.data["months"][0]["revenue_actual"]), Decimal("0"))
        branch = next(row for row in res.data["by_branch"] if row["branch_id"] == str(self.branch.id))
        self.assertEqual(Decimal(branch["revenue_plan"]), Decimal("1000"))
        self.assertEqual(Decimal(branch["revenue_actual"]), Decimal("800"))

    def test_invalid_year_is_rejected(self):
        res = self.client.get(f"/api/v1/general-ledger/budgets/performance/?company_id={self.company.id}&year=abc")
        self.assertEqual(res.status_code, 400)
