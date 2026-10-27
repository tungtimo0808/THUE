from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from general_ledger.models import Account, AccountClass, AccountingPeriod, ChartOfAccounts, JournalEntry, JournalLine
from master_data.models import Currency, Party
from accounts_receivable.models import Receivable
from organization.models import Company

from .tt133_reports import REPORTS


class TT133FinancialReportsTests(TestCase):
    def setUp(self):
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="TT133_TEST", name="Công ty kiểm thử TT133", legal_name="Công ty kiểm thử TT133",
            tax_code="0109991330", accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.chart = ChartOfAccounts.objects.create(
            company=self.company, code="COA-TT133", name="TT133", accounting_regime="TT133",
            effective_from=date(2026, 1, 1), is_default=True,
        )
        self.asset_class = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        self.equity_class = AccountClass.objects.create(company=self.company, code="EQUITY", name="Nguồn vốn", normal_balance="CREDIT")
        self.period = AccountingPeriod.objects.create(
            company=self.company, code="2026-12", fiscal_year=2026, period_number=12,
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )
        self.user = get_user_model().objects.create_superuser(username="tt133-admin", email="tt133@example.com", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.accounts = {}
        for code, name in (
            ("111", "Tiền mặt"), ("131", "Phải thu khách hàng"), ("331", "Phải trả người bán"),
            ("411", "Vốn góp"), ("421", "Lợi nhuận chưa phân phối"), ("511", "Doanh thu"),
            ("632", "Giá vốn"), ("911", "Xác định kết quả"),
        ):
            self.accounts[code] = Account.objects.create(
                company=self.company, chart_of_accounts=self.chart,
                account_class=self.asset_class if code[0] == "1" else self.equity_class,
                code=code, name=name, account_type="ASSET" if code[0] == "1" else "EQUITY",
                normal_balance="DEBIT" if code[0] in "16" else "CREDIT",
            )
        self._entry("OPEN", "OPENING", [("111", 1000, 0), ("411", 0, 1000)])
        self._entry("SALE", "MANUAL", [("131", 300, 0), ("511", 0, 300)])
        self._entry("COST", "MANUAL", [("632", 100, 0), ("331", 0, 100)])
        self._entry("RECEIPT", "MANUAL", [("111", 300, 0), ("131", 0, 300)])
        self._entry("PAYMENT", "MANUAL", [("331", 100, 0), ("111", 0, 100)])
        self._entry("CLOSE-1", "CLOSING", [("511", 300, 0), ("911", 0, 300)])
        self._entry("CLOSE-2", "CLOSING", [("911", 100, 0), ("632", 0, 100)])
        self._entry("CLOSE-3", "CLOSING", [("911", 200, 0), ("421", 0, 200)])

    def _entry(self, number, entry_type, lines, party=None):
        amount = sum(Decimal(debit) for _, debit, _ in lines)
        entry = JournalEntry.objects.create(
            company=self.company, period=self.period, number=number, entry_type=entry_type,
            posting_date=date(2026, 1, 1) if entry_type == "OPENING" else date(2026, 10, 1),
            description=number, status="POSTED", total_debit=amount, total_credit=amount,
            created_by=self.user.iam_account, posted_by=self.user.iam_account,
        )
        for index, (code, debit, credit) in enumerate(lines, 1):
            JournalLine.objects.create(
                entry=entry, line_no=index, account=self.accounts[code],
                debit=debit, credit=credit, currency=self.currency,
                party=party if code in {"131", "331"} else None,
            )

    def test_all_seven_templates_use_posted_ledger_data(self):
        for code in REPORTS:
            with self.subTest(code=code):
                response = self.client.get(
                    "/api/v1/reports/tt133-financial-statements/",
                    {"company_id": str(self.company.id), "year": 2026, "template_code": code},
                )
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.data["code"], code)
                self.assertTrue(response.data["has_data"])
                self.assertTrue(response.data["rows"])
                if code == "B02-DNN":
                    values = {row["code"]: Decimal(row["current"]) for row in response.data["rows"]}
                    self.assertEqual(values["01"], 300)
                    self.assertEqual(values["60"], 200)
                if code == "B01a-DNN":
                    values = {row["code"]: Decimal(row["current"]) for row in response.data["rows"]}
                    self.assertEqual(values["110"], 1200)
                    self.assertEqual(values["200"], values["500"])
                if code == "B03-DNN":
                    values = {row["code"]: Decimal(row["current"]) for row in response.data["rows"]}
                    self.assertEqual(values["50"], 200)
                    self.assertEqual(values["70"], 1200)
                if code == "B03-DNN-GT":
                    values = {row["code"]: Decimal(row["current"]) for row in response.data["rows"]}
                    self.assertEqual(values["50"], 200)
                    self.assertEqual(values["70"], 1200)
                if code == "B09-DNN":
                    values = {row["code"]: row for row in response.data["rows"]}
                    self.assertEqual(Decimal(values["VI.1"]["current"]), 300)
                    self.assertEqual(values["I"]["status"], "REQUIRES_INPUT")
                if code == "F01-DNN":
                    cash = next(row for row in response.data["rows"] if row["code"] == "111")
                    self.assertEqual(Decimal(cash["opening_debit"]), 1000)
                    self.assertEqual(Decimal(cash["closing_debit"]), 1200)

    def test_rejects_invalid_template_and_year(self):
        base = {"company_id": str(self.company.id), "year": 2026}
        self.assertEqual(self.client.get("/api/v1/reports/tt133-financial-statements/", {**base, "template_code": "B01-DN"}).status_code, 400)
        self.assertEqual(self.client.get("/api/v1/reports/tt133-financial-statements/", {**base, "year": "bad"}).status_code, 400)

    def test_b09_narrative_can_be_saved_and_loaded(self):
        url = f"/api/v1/reports/tt133-financial-statements/notes/?company_id={self.company.id}&year=2026"
        saved = self.client.patch(url, {"section_code": "I", "content": "Hoạt động thương mại."}, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        report = self.client.get("/api/v1/reports/tt133-financial-statements/", {
            "company_id": str(self.company.id), "year": 2026, "template_code": "B09-DNN",
        })
        section = next(row for row in report.data["rows"] if row["code"] == "I")
        self.assertEqual(section["narrative"], "Hoạt động thương mại.")
        self.assertEqual(section["status"], "COMPLETE")
        invalid = self.client.patch(url, {"section_code": "V.1", "content": "x"}, format="json")
        self.assertEqual(invalid.status_code, 400)

    def test_b01b_uses_due_date_only_when_subledger_matches_gl(self):
        party = Party.objects.create(company=self.company, code="LONG_AR", name="Khách hàng dài hạn")
        self._entry("LONG-AR", "MANUAL", [("131", 500, 0), ("411", 0, 500)], party=party)
        debt = Receivable.objects.create(
            company=self.company, customer=party, account=self.accounts["131"],
            currency=self.currency, posting_date=date(2026, 10, 1), due_date=date(2028, 2, 1),
            original_amount=500, balance=500,
        )
        query = {"company_id": str(self.company.id), "year": 2026, "template_code": "B01b-DNN"}
        report = self.client.get("/api/v1/reports/tt133-financial-statements/", query)
        rows = {row["code"]: row for row in report.data["rows"]}
        self.assertEqual(Decimal(rows["210"]["current"]), 500)
        self.assertEqual(Decimal(rows["130"]["current"]), 0)
        debt.balance = 400
        debt.save(update_fields=["balance"])
        unmatched = self.client.get("/api/v1/reports/tt133-financial-statements/", query)
        rows = {row["code"]: row for row in unmatched.data["rows"]}
        self.assertEqual(Decimal(rows["210"]["current"]), 0)
        self.assertTrue(any("TK 131" in warning for warning in unmatched.data["warnings"]))

    def test_requires_authentication_and_isolates_company_data(self):
        anonymous = APIClient()
        url = "/api/v1/reports/tt133-financial-statements/"
        query = {"company_id": str(self.company.id), "year": 2026, "template_code": "F01-DNN"}
        self.assertIn(anonymous.get(url, query).status_code, (401, 403))
        other = Company.objects.create(
            code="TT133_OTHER", name="Công ty khác", legal_name="Công ty khác", tax_code="0109991331",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        response = self.client.get(url, {**query, "company_id": str(other.id)})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["has_data"])
        self.assertEqual(response.data["rows"], [])
