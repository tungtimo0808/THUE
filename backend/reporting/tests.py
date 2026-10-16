from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from decimal import Decimal

from general_ledger.models import Account, AccountClass, AccountingPeriod, ChartOfAccounts, JournalEntry, JournalLine
from master_data.models import Currency
from organization.models import Branch, Company

from .models import ReportExport, ReportRun


class ReportingApiTests(TestCase):
    def setUp(self):
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="RPT", name="Công ty báo cáo", legal_name="Công ty báo cáo", tax_code="0100999999",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        asset_class = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        liability_class = AccountClass.objects.create(company=self.company, code="LIABILITY", name="Nợ phải trả", normal_balance="CREDIT")
        chart = ChartOfAccounts.objects.create(company=self.company, code="TT99", name="Hệ thống", effective_from="2026-01-01", is_default=True)
        self.cash = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=asset_class, code="1111", name="Tiền mặt", account_type="ASSET", normal_balance="DEBIT")
        self.payable = Account.objects.create(company=self.company, chart_of_accounts=chart, account_class=liability_class, code="3311", name="Phải trả", account_type="LIABILITY", normal_balance="CREDIT")
        self.period = AccountingPeriod.objects.create(company=self.company, code="2026-09", fiscal_year=2026, period_number=9, start_date="2026-09-01", end_date="2026-09-30")
        self.user = get_user_model().objects.create_superuser(username="report-admin", email="report@example.com", password="x")
        entry = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JV-RPT-001", entry_type="MANUAL",
            posting_date="2026-09-15", description="Mua hàng chưa thanh toán", status="POSTED",
            total_debit=100, total_credit=100, created_by=self.user.iam_account, posted_by=self.user.iam_account,
        )
        JournalLine.objects.create(entry=entry, line_no=1, account=self.cash, debit=100, credit=0, currency=self.currency)
        JournalLine.objects.create(entry=entry, line_no=2, account=self.payable, debit=0, credit=100, currency=self.currency)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.id}"

    def test_catalog_financial_report_and_drilldown(self):
        catalog = self.client.get(f"/api/v1/reports/definitions/{self.query}")
        self.assertEqual(catalog.status_code, 200, catalog.data)
        self.assertGreaterEqual(len(catalog.data), 12)
        response = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "B01-DN", "period": str(self.period.id), "branch": str(self.branch.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "COMPLETED")
        self.assertEqual(response.data["row_count"], 3)
        self.assertTrue(response.data["result"]["totals"]["balanced"])
        amounts = {row["code"]: row["amount"] for row in response.data["result"]["rows"]}
        self.assertEqual(Decimal(amounts["ASSETS"]), Decimal("100"))
        self.assertEqual(Decimal(amounts["LIABILITIES"]), Decimal("100"))
        run_id = response.data["id"]
        drill = self.client.get(f"/api/v1/reports/runs/{run_id}/drill-down/{self.query}")
        self.assertEqual(drill.status_code, 200, drill.data)
        self.assertEqual(len(drill.data["journals"]), 1)
        self.assertEqual(drill.data["journals"][0]["number"], "JV-RPT-001")

    def test_exports_use_saved_report_snapshot(self):
        run = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "ACCOUNTING_BOOKS", "date_from": "2026-09-01", "date_to": "2026-09-30"},
            format="json",
        )
        self.assertEqual(run.status_code, 201, run.data)
        run_id = run.data["id"]
        for file_format, content_type, signature in (
            ("XLSX", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b"PK"),
            ("PDF", "application/pdf", b"%PDF"),
            ("PRINT", "text/html; charset=utf-8", b"<!doctype html>"),
        ):
            response = self.client.post(f"/api/v1/reports/runs/{run_id}/export/{self.query}", {"format": file_format}, format="json")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response["Content-Type"].startswith(content_type.split(";")[0]))
            self.assertTrue(response.content.startswith(signature))
        self.assertEqual(ReportExport.objects.filter(run_id=run_id).count(), 3)

    def test_invalid_date_range_and_no_data_status(self):
        invalid = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "ACCOUNTING_BOOKS", "date_from": "2026-10-01", "date_to": "2026-09-01"}, format="json",
        )
        self.assertEqual(invalid.status_code, 400)
        empty = self.client.post(
            "/api/v1/reports/engine/execute/",
            {"company": str(self.company.id), "report_code": "ACCOUNTING_BOOKS", "date_from": "2025-01-01", "date_to": "2025-01-31"}, format="json",
        )
        self.assertEqual(empty.status_code, 201, empty.data)
        self.assertEqual(empty.data["status"], "NO_DATA")
        self.assertFalse(empty.data["result"]["has_data"])
        self.assertEqual(ReportRun.objects.filter(company=self.company).count(), 1)

    def test_all_report_groups_support_empty_results(self):
        for code in ("B01-DN", "PURCHASE_SALES", "DEBT_AGING", "CASH_BANK", "INVENTORY", "FIXED_ASSETS", "TAX_INVOICES", "MANAGEMENT"):
            response = self.client.post(
                "/api/v1/reports/engine/execute/",
                {"company": str(self.company.id), "report_code": code, "date_from": "2025-01-01", "date_to": "2025-01-31"}, format="json",
            )
            self.assertEqual(response.status_code, 201, (code, response.data))
            self.assertIn("totals", response.data["result"])
