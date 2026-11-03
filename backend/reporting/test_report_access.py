from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import get_resolver
from rest_framework.test import APIClient

from iam.models import CompanyMembership
from master_data.models import Currency
from organization.models import Company
from reporting.models import SalesReportRun
from reporting.report_access import ReportAccessMixin
from reporting.tests import other_company, permission_client

QUERY_ROUTES = {
    "sales": "/api/v1/reports/sales/RPT-0079/query/",
    "purchase": "/api/v1/reports/purchase/RPT-0047/query/",
    "debt": "/api/v1/reports/debt/RPT-0053/query/",
    "money": "/api/v1/reports/money/RPT-0036/query/",
    "inventory": "/api/v1/reports/inventory/RPT-0143/query/",
    "asset": "/api/v1/reports/assets/RPT-0160/query/",
}
FORGED_HEADERS = {
    "HTTP_X_USER_PERMISSIONS": "RPT_DEBT_VIEW,RPT_MONEY_VIEW,RPT_INVENTORY_VIEW,RPT_ASSET_VIEW,RPT_VIEW",
    "HTTP_X_SALES_PERMISSIONS": "RPT_SALES_VIEW", "HTTP_X_PURCHASE_PERMISSIONS": "RPT_PURCHASE_VIEW",
    "HTTP_X_TAX_PERMISSIONS": "RPT_TAX_VIEW",
}


class ReportCompanyIsolationTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="ISO", name="ISO", legal_name="ISO", tax_code="0100333444",
            accounting_currency=currency, legal_reporting_currency=currency,
        )
        self.foreign = permission_client(other_company(self.company), "RPT_VIEW")

    def body(self):
        return {"company_id": str(self.company.id), "from_date": "2026-01-01", "to_date": "2026-01-31", "year": 2026}

    def test_a_member_of_another_company_is_refused_on_every_report_group(self):
        for area, url in QUERY_ROUTES.items():
            with self.subTest(area=area):
                self.assertEqual(self.foreign.post(url, self.body(), format="json").status_code, 403)

    def test_forged_permission_headers_grant_nothing(self):
        for area, url in QUERY_ROUTES.items():
            with self.subTest(area=area):
                response = self.foreign.post(url, self.body(), format="json", **FORGED_HEADERS)
                self.assertEqual(response.status_code, 403)

    def test_a_member_without_a_report_right_is_refused(self):
        client = permission_client(self.company, "NONE")
        for area, url in QUERY_ROUTES.items():
            with self.subTest(area=area):
                self.assertEqual(client.post(url, self.body(), format="json").status_code, 403)

    def test_balance_routes_are_isolated(self):
        for path in ("inventory/balances/as-of", "assets/balances/as-of", "money/balances/as-of"):
            with self.subTest(path=path):
                url = f"/api/v1/reports/{path}/?company_id={self.company.id}&as_of_date=2026-01-31"
                self.assertEqual(self.foreign.get(url).status_code, 403)

    def test_a_run_of_another_company_cannot_be_read_by_its_id(self):
        run = SalesReportRun.objects.create(
            company_id=str(self.company.id), report_code="RPT-0079", run_number="ISO-RUN",
        )
        response = self.foreign.get(f"/api/v1/reports/sales/runs/{run.id}/")
        self.assertEqual(response.status_code, 403)

    def test_tt99_statements_need_the_financial_report_right(self):
        url = f"/api/v1/reports/tt99-financial-statements/?company_id={self.company.id}&year=2026"
        self.assertEqual(permission_client(self.company, "NONE").get(url).status_code, 403)
        self.assertEqual(permission_client(self.company, "RPT.FINANCIAL.VIEW").get(url).status_code, 200)

    def test_a_request_needs_a_company(self):
        user = get_user_model().objects.create_superuser(username="iso-admin", password="password-123")
        client = APIClient()
        client.force_authenticate(user)
        self.assertEqual(client.get("/api/v1/reports/sales/catalogue/").status_code, 400)

    def test_the_company_administrator_of_a_new_company_opens_every_group(self):
        owner = get_user_model().objects.create_user(username="iso-owner", password="password-123")
        account = owner.iam_account
        self.company.created_by_user_id = account.id
        self.company.save(update_fields=("created_by_user_id",))
        CompanyMembership.objects.create(company=self.company, user=account, created_by=account)
        client = APIClient()
        client.force_authenticate(owner)
        for area, url in QUERY_ROUTES.items():
            with self.subTest(area=area):
                response = client.post(url, self.body(), format="json")
                self.assertNotEqual(response.status_code, 403, response.data)


class ReportRouteCoverageTests(TestCase):
    def test_every_group_route_goes_through_report_access(self):
        def walk(patterns):
            for pattern in patterns:
                if hasattr(pattern, "url_patterns"):
                    yield from walk(pattern.url_patterns)
                else:
                    yield pattern

        groups = ("TaxReportViewSet", "PurchaseReportViewSet", "SalesReportViewSet", "DebtReportViewSet",
                  "MoneyReportViewSet", "InventoryReportViewSet", "AssetReportViewSet")
        checked = 0
        for pattern in walk(get_resolver().url_patterns):
            view_class = getattr(pattern.callback, "cls", None)
            if view_class is not None and view_class.__name__ in groups:
                checked += 1
                self.assertTrue(issubclass(view_class, ReportAccessMixin), view_class)
        self.assertGreater(checked, 50)
