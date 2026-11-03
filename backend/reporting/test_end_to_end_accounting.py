"""A month of real documents through the APIs, checked against hand-computed books."""
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.test import TestCase
from rest_framework.test import APIClient

from accounts_payable.models import Payable
from accounts_receivable.models import Receivable
from cash_management.models import CashFund
from common_services.models import FiscalPeriod, FiscalYear
from common_services.setup_services import complete_company_setup
from general_ledger.models import Account, AccountingPeriod, ChartOfAccounts, JournalLine
from inventory.models import StockBalance
from iam.models import CompanyMembership
from master_data.models import Currency, Item, Party, PartyAddress, PartyRole, TaxRate, UnitOfMeasure, Warehouse
from organization.models import Branch, Company, Department, Employee
from sales.models import GoodsSale

from .analysis_services import analysis_report
from .sales_report_services import _build_rpt_0078

DAY = date(2026, 10, 10)


class EndToEndAccountingTests(TestCase):
    def setUp(self):
        self.vnd = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="E2E", name="E2E", legal_name="E2E Ltd", tax_code="0312345678",
            accounting_currency=self.vnd, legal_reporting_currency=self.vnd, status="ACTIVE",
        )
        self.branch = Branch.objects.create(company=self.company, code="B1", name="Trụ sở", status="ACTIVE")
        self.user = get_user_model().objects.create_superuser(username="e2e", email="e2e@example.test", password="password-123")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        employee = Employee.objects.create(company=self.company, employee_code="NV1", full_name="Kế toán", status="ACTIVE")
        CompanyMembership.objects.create(company=self.company, user=self.user.iam_account, employee=employee, created_by=self.user.iam_account)
        self.query = f"?company_id={self.company.pk}"
        chart = ChartOfAccounts.objects.create(company=self.company, code="COA", name="COA", effective_from=date(2026, 1, 1), is_default=True)

        def account(code, kind, **extra):
            return Account.objects.create(company=self.company, chart_of_accounts=chart, code=code, name=code,
                                          account_type=kind, is_postable=True, status="ACTIVE", **extra)

        self.cash_gl = account("1111", "ASSET")
        self.ar_gl = account("131", "ASSET", requires_party=True)
        self.vat_in = account("1331", "ASSET")
        self.stock_gl = account("1561", "ASSET", requires_warehouse=True)
        self.ap_gl = account("331", "LIABILITY", requires_party=True)
        account("33311", "LIABILITY")
        revenue = account("5111", "REVENUE")
        cogs = account("632", "EXPENSE")
        AccountingPeriod.objects.create(company=self.company, code="2026-10", fiscal_year=2026, period_number=10,
                                        start_date=date(2026, 10, 1), end_date=date(2026, 10, 31), status="OPEN")
        year = FiscalYear.objects.create(company=self.company, code="FY2026", name="2026", start_date=date(2026, 1, 1),
                                         end_date=date(2026, 12, 31), status="ACTIVE", created_by=self.user.iam_account)
        FiscalPeriod.objects.create(company=self.company, fiscal_year=year, code="P10", name="T10", period_number=10,
                                    start_date=date(2026, 10, 1), end_date=date(2026, 10, 31), status="OPEN")
        self.uom = UnitOfMeasure.objects.create(company=self.company, code="CAI", name="Cái", decimal_places=0, status="ACTIVE")
        self.vat10 = TaxRate.objects.create(company=self.company, code="VAT10", name="VAT 10", tax_type="VAT", rate_percent=Decimal("10"),
                                            application_form="PERCENT", effective_from=date(2026, 1, 1), business_scope="OUTPUT", status="ACTIVE")
        self.warehouse = Warehouse.objects.create(company=self.company, branch=self.branch, code="K1", name="Kho", status="ACTIVE")
        self.item = Item.objects.create(
            company=self.company, code="TV", name="Tivi", item_type="GOODS", base_uom=self.uom, sales_uom=self.uom,
            sales_price=Decimal("10000000"), sales_tax_rate=self.vat10, track_inventory=True, allow_sale=True, allow_purchase=True,
            revenue_account=revenue, cogs_account=cogs, inventory_account=self.stock_gl, status="ACTIVE",
        )
        self.supplier = Party.objects.create(company=self.company, code="NCC", name="NCC", tax_code="0311111111",
                                             default_currency=self.vnd, status="ACTIVE")
        PartyRole.objects.create(party=self.supplier, role_type="VENDOR", active_from=date(2026, 1, 1))
        self.customer = Party.objects.create(company=self.company, code="KH", name="KH", tax_code="0322222222",
                                             default_currency=self.vnd, status="ACTIVE")
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=date(2026, 1, 1))
        PartyAddress.objects.create(party=self.customer, address_type="DELIVERY", address_line="HCM", is_default=True)
        self.fund = CashFund.objects.create(company=self.company, branch=self.branch, code="QUY", name="Quỹ",
                                            currency=self.vnd, gl_account=self.cash_gl)

    def run_action(self, url, action, body):
        response = self.client.post(url.replace("/?", f"/{action}/?"), body, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def purchase(self, quantity, price):
        line = {"line_no": 1, "item": str(self.item.pk), "uom": str(self.uom.pk), "quantity": str(quantity), "unit_price": str(price),
                "debit_account": str(self.stock_gl.pk), "credit_account": str(self.ap_gl.pk)}
        created = self.client.post(f"/api/v1/purchases/goods-purchases/{self.query}", {
            "company": str(self.company.pk), "branch": str(self.branch.pk), "document_date": str(DAY), "posting_date": str(DAY),
            "purchase_type": "WAREHOUSE", "supplier": str(self.supplier.pk), "receiving_warehouse": str(self.warehouse.pk),
            "payment_type": "UNPAID", "lines": [line],
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        detail = f"/api/v1/purchases/goods-purchases/{created.data['id']}/{self.query}"
        self.run_action(detail, "submit", {"version": 1})
        self.run_action(detail, "post", {"version": 2})

    def sell(self, quantity, price):
        created = self.client.post(f"/api/v1/sales/goods-sales/{self.query}", {
            "company": str(self.company.pk), "branch": str(self.branch.pk), "customer": str(self.customer.pk), "customer_address": "HCM",
            "customer_tax_code": self.customer.tax_code, "document_date": str(DAY), "posting_date": str(DAY), "currency": str(self.vnd.pk),
            "exchange_rate": "1", "payment_type": "UNPAID", "inventory_handling": "ATTACH_ISSUE", "description": "Bán tivi",
            "lines": [{"item": str(self.item.pk), "uom": str(self.uom.pk), "warehouse": str(self.warehouse.pk), "quantity": str(quantity),
                       "unit_price": str(price), "tax_rate": str(self.vat10.pk)}],
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        detail = f"/api/v1/sales/goods-sales/{created.data['id']}/{self.query}"
        self.run_action(detail, "submit", {})
        self.run_action(detail, "approve", {"comment": "OK"})
        self.run_action(detail, "post", {})

    def collect(self, amount):
        debt = Receivable.objects.get(company=self.company, customer=self.customer)
        created = self.client.post(f"/api/v1/accounts-receivable/customer-receipt-vouchers/{self.query}", {
            "company": str(self.company.pk), "branch": str(self.branch.pk), "customer": str(self.customer.pk), "cash_fund": str(self.fund.pk),
            "credit_account": str(self.ar_gl.pk), "document_date": str(DAY), "posting_date": str(DAY), "amount": str(amount),
            "description": "Thu tiền", "lines": [{"receivable": str(debt.pk), "amount": str(amount)}],
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.run_action(f"/api/v1/accounts-receivable/customer-receipt-vouchers/{created.data['id']}/{self.query}", "post", {})

    def pay(self, amount):
        debt = Payable.objects.filter(company=self.company, supplier=self.supplier).order_by("created_at").first()
        response = self.client.post(f"/api/v1/accounts-payable/payments/{self.query}", {
            "company": str(self.company.pk), "action": "POST", "payment_source": "DIRECT", "supplier": str(self.supplier.pk),
            "payment_date": str(DAY), "payment_method": "CASH", "cash_fund": str(self.fund.pk), "recipient_name": "NCC",
            "payment_content": "Trả nợ", "lines": [{"payable": str(debt.pk), "amount": str(amount)}],
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)

    def post_sale_expecting_refusal(self):
        created = self.client.post(f"/api/v1/sales/goods-sales/{self.query}", {
            "company": str(self.company.pk), "branch": str(self.branch.pk), "customer": str(self.customer.pk), "customer_address": "HCM",
            "customer_tax_code": self.customer.tax_code, "document_date": str(DAY), "posting_date": str(DAY), "currency": str(self.vnd.pk),
            "exchange_rate": "1", "payment_type": "UNPAID", "inventory_handling": "ATTACH_ISSUE", "description": "Bán",
            "lines": [{"item": str(self.item.pk), "uom": str(self.uom.pk), "warehouse": str(self.warehouse.pk), "quantity": "1",
                       "unit_price": "1000", "tax_rate": str(self.vat10.pk)}],
        }, format="json")
        if created.status_code != 201:
            return created
        detail = f"/api/v1/sales/goods-sales/{created.data['id']}/{self.query}"
        self.client.post(detail.replace("/?", "/submit/?"), {}, format="json")
        self.client.post(detail.replace("/?", "/approve/?"), {"comment": "OK"}, format="json")
        return self.client.post(detail.replace("/?", "/post/?"), {}, format="json")

    def balance(self, prefix):
        totals = JournalLine.objects.filter(entry__company=self.company, entry__status="POSTED", account__code__startswith=prefix).aggregate(
            debit=Sum("debit"), credit=Sum("credit"))
        return (totals["debit"] or Decimal(0)) - (totals["credit"] or Decimal(0))

    def test_a_month_of_documents_reaches_the_books_and_reports(self):
        self.purchase(10, 6000000)   # 60.000.000
        self.purchase(10, 8000000)   # 80.000.000, bình quân 7.000.000
        self.sell(5, 10000000)       # doanh thu 50.000.000, GTGT 5.000.000, giá vốn 35.000.000
        self.collect(30000000)
        self.pay(20000000)

        self.assertEqual(self.balance("1561"), Decimal("105000000"))
        self.assertEqual(self.balance("131"), Decimal("25000000"))
        self.assertEqual(self.balance("331"), Decimal("-120000000"))
        self.assertEqual(self.balance("3331"), Decimal("-5000000"))
        self.assertEqual(self.balance("511"), Decimal("-50000000"))
        self.assertEqual(self.balance("632"), Decimal("35000000"))
        self.assertEqual(self.balance("1111"), Decimal("10000000"))
        self.assertEqual(self.balance(""), Decimal("0"))

        stock = StockBalance.objects.get(company=self.company, item=self.item, warehouse=self.warehouse)
        self.assertEqual(stock.quantity, Decimal("15"))
        self.assertEqual(stock.inventory_value, Decimal("105000000"))
        self.assertEqual(Receivable.objects.get(company=self.company).balance, Decimal("25000000"))
        payable = Payable.objects.filter(company=self.company).aggregate(total=Sum("balance"))["total"]
        self.assertEqual(payable, Decimal("120000000"))
        self.fund.refresh_from_db()
        self.assertEqual(self.fund.balance, Decimal("10000000"))

        start, end = date(2026, 10, 1), date(2026, 10, 31)
        result = analysis_report(self.company, "REVENUE_EXPENSE", "MONTH", start, end)
        self.assertEqual(result["rows"][-1]["values"]["2026-10-01"], Decimal("15000000"))
        sheet = analysis_report(self.company, "BALANCE_SHEET", "MONTH", start, end)
        total_assets = next(row for row in sheet["rows"] if row["name"] == "Tổng tài sản")
        self.assertEqual(total_assets["values"]["2026-10-01"], Decimal("140000000"))
        self.assertEqual(sheet["rows"][-1]["values"], total_assets["values"])

        rows, _, _ = _build_rpt_0078(str(self.company.pk), None, start, end, {})
        self.assertEqual(Decimal(str(rows[0]["columns"]["gross_sales_amount"])), Decimal("50000000"))
        self.assertEqual(Decimal(str(rows[0]["columns"]["net_cogs_amount"])), Decimal("35000000"))

    def test_a_closed_period_refuses_new_documents(self):
        self.purchase(10, 6000000)
        entries = JournalLine.objects.filter(entry__company=self.company).count()
        AccountingPeriod.objects.filter(company=self.company, code="2026-10").update(status="CLOSED")
        FiscalPeriod.objects.filter(company=self.company, period_number=10).update(status="CLOSED")
        response = self.post_sale_expecting_refusal()
        self.assertIn(response.status_code, (400, 409), response.data)
        self.assertEqual(JournalLine.objects.filter(entry__company=self.company).count(), entries)

    def test_a_sales_return_restores_stock_debt_and_revenue(self):
        self.purchase(10, 6000000)
        self.sell(5, 10000000)
        sale = GoodsSale.objects.get(company=self.company)
        line = sale.lines.get()
        with patch("django.utils.timezone.localdate", return_value=DAY):
            created = self.client.post(f"/api/v1/sales/sales-returns/{self.query}", {
                "company": str(self.company.pk), "goods_sale": str(sale.pk), "customer": str(self.customer.pk), "return_reason": "Lỗi",
                "inventory_handling": "ATTACH_INWARD",
                "lines": [{"goods_sale_line_id": str(line.pk), "return_quantity": "1", "warehouse_id": str(self.warehouse.pk)}],
            }, format="json")
            self.assertEqual(created.status_code, 201, created.data)
            self.run_action(f"/api/v1/sales/sales-returns/{created.data['id']}/{self.query}", "post", {})
        self.assertEqual(self.balance("1561"), Decimal("36000000"))
        self.assertEqual(self.balance("131"), Decimal("44000000"))
        self.assertEqual(self.balance("632"), Decimal("24000000"))
        self.assertEqual(self.balance("3331"), Decimal("-4000000"))
        self.assertEqual(self.balance(""), Decimal("0"))
        self.assertEqual(Receivable.objects.get(company=self.company).balance, Decimal("44000000"))
        self.assertEqual(StockBalance.objects.get(item=self.item, warehouse=self.warehouse).quantity, Decimal("6"))


class NewCompanyEndToEndTests(EndToEndAccountingTests):
    """The same month for a company set up the way a customer does it, signed in as its owner."""

    def setUp(self):
        self.vnd = Currency.objects.get(code="VND")
        self.user = get_user_model().objects.create_user(username="owner", email="owner@example.test", password="password-123")
        account = self.user.iam_account
        self.company = Company.objects.create(
            code="NEWCO", name="NEWCO", legal_name="NEWCO Ltd", tax_code="0313334445", accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd, status="PENDING_SETUP", created_by_user_id=account.id,
        )
        self.branch = Branch.objects.create(company=self.company, code="HO", name="Trụ sở", status="ACTIVE")
        employee = Employee.objects.create(company=self.company, employee_code="NV1", full_name="Chủ", status="ACTIVE")
        CompanyMembership.objects.create(company=self.company, user=account, employee=employee, created_by=account)
        with patch("django.utils.timezone.localdate", return_value=DAY):
            complete_company_setup(self.company, account)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.query = f"?company_id={self.company.pk}"
        accounts = {item.code: item for item in Account.objects.filter(company=self.company)}
        self.cash_gl, self.ar_gl = accounts["1111"], accounts["131"]
        self.stock_gl, self.ap_gl = accounts["1561"], accounts["331"]
        self.uom = UnitOfMeasure.objects.filter(company=self.company).first()
        self.vat10 = TaxRate.objects.get(company=self.company, code="VAT10")
        self.warehouse = Warehouse.objects.filter(company=self.company).first() or Warehouse.objects.create(
            company=self.company, branch=self.branch, code="K1", name="Kho", status="ACTIVE")
        self.item = Item.objects.create(
            company=self.company, code="TV", name="Tivi", item_type="GOODS", base_uom=self.uom, sales_uom=self.uom,
            sales_price=Decimal("10000000"), sales_tax_rate=self.vat10, track_inventory=True, allow_sale=True, allow_purchase=True,
            revenue_account=accounts["5111"], cogs_account=accounts["632"], inventory_account=self.stock_gl, status="ACTIVE",
        )
        self.supplier = Party.objects.create(company=self.company, code="NCC", name="NCC", tax_code="0311111111",
                                             default_currency=self.vnd, status="ACTIVE")
        PartyRole.objects.create(party=self.supplier, role_type="VENDOR", active_from=date(2026, 1, 1))
        self.customer = Party.objects.create(company=self.company, code="KH", name="KH", tax_code="0322222222",
                                             default_currency=self.vnd, status="ACTIVE")
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=date(2026, 1, 1))
        PartyAddress.objects.create(party=self.customer, address_type="DELIVERY", address_line="HCM", is_default=True)
        self.fund = CashFund.objects.filter(company=self.company).first()

    def test_month_end_closing_moves_profit_to_retained_earnings(self):
        self.purchase(10, 6000000)
        self.sell(5, 10000000)
        period = AccountingPeriod.objects.get(company=self.company, code="2026-10")
        base = "/api/v1/general-ledger/closing-runs"
        body = {"company": str(self.company.pk), "period": str(period.pk), "closing_to_date": "2026-10-31"}
        fetched = self.client.post(f"{base}/fetch-data/{self.query}", body, format="json")
        self.assertEqual(fetched.status_code, 200, fetched.data)
        self.assertEqual(Decimal(fetched.data["summary"]["net_profit_loss"]), Decimal("20000000"))
        confirmed = self.client.post(f"{base}/confirm/{self.query}", {
            **body, "posting_date": "2026-10-31", "document_date": "2026-10-31",
            "source_fingerprint": fetched.data["source_fingerprint"], "idempotency_key": "E2E-CLOSE-10",
        }, format="json")
        self.assertEqual(confirmed.status_code, 201, confirmed.data)
        posted = self.client.post(f"{base}/{confirmed.data['id']}/post/{self.query}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        for prefix in ("511", "632", "911"):
            self.assertEqual(self.balance(prefix), Decimal("0"), prefix)
        self.assertEqual(self.balance("421"), Decimal("-20000000"))
        self.assertEqual(self.balance(""), Decimal("0"))
        sheet = analysis_report(self.company, "BALANCE_SHEET", "MONTH", date(2026, 10, 1), date(2026, 10, 31))
        assets = next(row for row in sheet["rows"] if row["name"] == "Tổng tài sản")
        self.assertEqual(sheet["rows"][-1]["values"], assets["values"])

    def test_opening_balances_enter_the_books_and_carry_into_the_year(self):
        base = "/api/v1/general-ledger/opening-balances/"
        response = self.client.post(f"{base}{self.query}", {"category": "accounts", "action_mode": "SAVE_AND_CLOSE", "items": [
            {"account": "1111", "name": "Tiền mặt", "debit": 100000000, "credit": 0},
            {"account": "4111", "name": "Vốn góp", "debit": 0, "credit": 100000000},
        ]}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["sync_status"], "SYNCED", response.data)
        self.assertEqual(self.client.get(f"{base}check/{self.query}").data["status"], "PASS")
        self.assertEqual(self.balance("1111"), Decimal("100000000"))
        self.assertEqual(self.balance("4111"), Decimal("-100000000"))
        self.purchase(10, 6000000)
        self.sell(5, 10000000)
        self.collect(30000000)
        self.assertEqual(self.balance("1111"), Decimal("130000000"))
        self.assertEqual(self.balance(""), Decimal("0"))

    def test_fifo_valuation_costs_the_oldest_layers_first(self):
        Item.objects.filter(pk=self.item.pk).update(valuation_method="FIFO")
        self.purchase(10, 6000000)
        self.purchase(10, 8000000)
        self.sell(12, 10000000)
        self.assertEqual(self.balance("632"), Decimal("84000000"))  # bình quân lúc xuất kho
        period = AccountingPeriod.objects.get(company=self.company, code="2026-10")
        response = self.client.post(f"/api/v1/inventory/valuations/{self.query}", {
            "company": str(self.company.pk), "period": str(period.pk), "method": "FIFO",
        }, format="json")
        self.assertIn(response.status_code, (200, 201), response.data)
        self.assertEqual(self.balance("632"), Decimal("76000000"))  # 10 x 6tr + 2 x 8tr
        self.assertEqual(self.balance("1561"), Decimal("64000000"))
        self.assertEqual(self.balance(""), Decimal("0"))

    def test_output_vat_from_an_invoice_issued_outside_the_system(self):
        self.purchase(10, 6000000)
        self.sell(5, 10000000)
        invoices = f"/api/v1/tax/invoices/{self.query}"
        created = self.client.post(invoices, {
            "company": str(self.company.pk), "branch": str(self.branch.pk), "direction": "OUTPUT", "invoice_type": "ORIGINAL",
            "invoice_series": "C26TAA", "invoice_number": "", "invoice_date": str(DAY), "seller_name": self.company.name,
            "seller_tax_code": self.company.tax_code, "buyer_name": self.customer.name, "buyer_tax_code": self.customer.tax_code,
            "party": str(self.customer.pk), "currency": str(self.vnd.pk), "exchange_rate": "1", "source": "MANUAL",
            "lines": [{"line_no": 1, "item": str(self.item.pk), "description": "Tivi", "quantity": "5", "unit_price": "10000000",
                       "discount_amount": "0", "tax_rate": "10"}],
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        url = f"/api/v1/tax/invoices/{created.data['id']}/record-external-issue/{self.query}"
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 400)
        issued = self.client.post(url, {"invoice_number": "0000123"}, format="json")
        self.assertEqual(issued.status_code, 200, issued.data)
        self.assertEqual(issued.data["status"], "ISSUED")
        period = self.client.post(f"/api/v1/tax/periods/{self.query}", {
            "company": str(self.company.pk), "code": "2026-10", "tax_type": "VAT", "start_date": "2026-10-01", "end_date": "2026-10-31",
        }, format="json")
        self.assertEqual(period.status_code, 201, period.data)
        calculated = self.client.post(f"/api/v1/tax/vat-calculations/calculate/{self.query}", {
            "company": str(self.company.pk), "period": period.data["id"],
        }, format="json")
        self.assertEqual(calculated.status_code, 201, calculated.data)
        self.assertEqual(Decimal(calculated.data["output_tax_amount"]), Decimal("5000000"))
        self.assertEqual(self.balance("3331"), Decimal("-5000000"))

    def test_issuing_without_a_provider_is_refused_outside_tests(self):
        from django.test import override_settings
        from rest_framework.exceptions import ValidationError

        from sales.sales_invoice_services import require_einvoice_simulation

        with override_settings(EINVOICE_SIMULATION=False):
            with self.assertRaises(ValidationError):
                require_einvoice_simulation()

    def test_straight_line_depreciation_reaches_the_ledger(self):
        accounts = {item.code: item for item in Account.objects.filter(company=self.company)}
        base = "/api/v1/fixed-assets"
        category = self.client.post(f"{base}/categories/{self.query}", {
            "company": str(self.company.pk), "code": "MAY", "name": "Máy móc", "asset_type": "FIXED_ASSET", "default_method": "STRAIGHT_LINE",
            "default_periods": 12, "asset_account": str(accounts["2112"].pk), "accumulated_account": str(accounts["2141"].pk),
            "expense_account": str(accounts["6424"].pk),
        }, format="json")
        self.assertEqual(category.status_code, 201, category.data)
        with patch("django.utils.timezone.localdate", return_value=DAY):
            asset = self.client.post(f"{base}/assets/{self.query}", {
                "company": str(self.company.pk), "code": "TS1", "name": "Máy phát", "asset_type": "FIXED_ASSET", "category": category.data["id"],
                "quantity": "1", "acquisition_date": "2026-10-01", "in_service_date": "2026-10-01", "original_cost": "120000000",
                "salvage_value": "0", "method": "STRAIGHT_LINE", "useful_life_periods": 12, "branch": str(self.branch.pk),
                "department": str(Department.objects.create(company=self.company, branch=self.branch, code="QL", name="Quản lý").pk),
            }, format="json")
        self.assertEqual(asset.status_code, 201, asset.data)
        approver = APIClient()
        approver.force_authenticate(get_user_model().objects.create_superuser(username="fa-approver", email="a@example.test", password="password-123"))
        with patch("django.utils.timezone.localdate", return_value=DAY):
            acquired = self.client.post(f"{base}/transactions/{self.query}", {
                "company": str(self.company.pk), "asset": asset.data["id"], "number": "GT-1", "transaction_type": "ACQUISITION",
                "transaction_date": str(DAY), "amount": "120000000", "idempotency_key": "E2E-GT-1",
            }, format="json")
            self.assertEqual(acquired.status_code, 201, acquired.data)
            detail = f"{base}/transactions/{acquired.data['id']}"
            self.client.post(f"{detail}/submit/{self.query}", {}, format="json")
            approved = approver.post(f"{detail}/approve/{self.query}", {"comment": "OK"}, format="json")
            self.assertEqual(approved.data.get("status"), "APPROVED", approved.data)
            posted = self.client.post(f"{detail}/post/{self.query}", {}, format="json")
            self.assertEqual(posted.status_code, 200, posted.data)
            preview = self.client.post(f"{base}/calculations/preview/{self.query}", {"month": 10, "year": 2026}, format="json")
            self.assertEqual(preview.status_code, 200, preview.data)
            saved = self.client.post(f"{base}/calculations/save-voucher/{self.query}", {
                "month": 10, "year": 2026, "voucher_no": "KH102026", "voucher_date": "2026-10-31", "posting_date": "2026-10-31",
                "description": "Khấu hao tháng 10", "post_now": True, "idempotency_key": "E2E-KH10",
            }, format="json")
            self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(self.balance("642"), Decimal("10000000"))
        self.assertEqual(self.balance("214"), Decimal("-10000000"))
        self.assertEqual(self.balance(""), Decimal("0"))
