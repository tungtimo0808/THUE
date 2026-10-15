from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from accounts_receivable.models import Receivable, ReceivableStatus
from general_ledger.models import Account, AccountingPeriod, ChartOfAccounts, JournalEntry
from iam.models import CompanyMembership
from inventory.models import InventoryPolicy, InventoryTransaction, InventoryTransactionLine, StockBalance
from inventory.services import post as post_inventory
from master_data.models import (
    Currency, Item, Party, PartyAddress, PartyRole,
    PaymentTerm, TaxRate, UnitOfMeasure, Warehouse
)
from organization.models import Branch, Company, Employee
from sales.models import (
    DocumentStatus, GoodsSale, GoodsSaleLine,
    ServiceSale, ServiceSaleLine,
    SalesAllowance, SalesAllowanceLine
)


class SalesAllowanceUcSal06Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.client = APIClient()

        # Currency
        self.currency = Currency.objects.get(code="VND")

        # Company & Branch
        self.company = Company.objects.create(
            code="SAL06_CO",
            name="Sales Allowance Co",
            legal_name="Sales Allowance Company Ltd",
            tax_code="0109988776",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(
            company=self.company,
            code="CN_ALLOW",
            name="Chi nhánh Giảm giá",
            status="ACTIVE",
        )

        # Users
        self.user = get_user_model().objects.create_superuser(
            username="allowance_user", email="allowance_user@example.com", password="password123"
        )
        self.client.force_authenticate(user=self.user)

        # Employee & Membership
        self.employee = Employee.objects.create(
            company=self.company,
            employee_code="NV_ALLOW",
            full_name="Trần Văn Giảm Giá",
            email="nv_allow@example.com",
            status="ACTIVE",
        )
        CompanyMembership.objects.create(
            company=self.company,
            user=self.user.iam_account,
            employee=self.employee,
            created_by=self.user.iam_account,
        )

        # Customer
        self.customer = Party.objects.create(
            company=self.company,
            code="CUST_SAL06_01",
            name="Công Ty TNHH Thương Mại Toàn Cầu",
            tax_code="0399887766",
            default_currency=self.currency,
            status="ACTIVE",
        )
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)
        self.customer_address = PartyAddress.objects.create(
            party=self.customer,
            address_type="OFFICE",
            address_line="456 Đường Lê Lợi, Quận 1, TP. HCM",
            is_default=True,
        )

        # Payment Term
        self.payment_term = PaymentTerm.objects.create(
            company=self.company,
            code="NET30_SAL06",
            name="Thanh toán 30 ngày",
            scope="SALE",
            due_days=30,
            status="ACTIVE",
        )
        self.customer.payment_term = self.payment_term
        self.customer.save(update_fields=["payment_term"])

        # Warehouse
        self.warehouse = Warehouse.objects.create(
            company=self.company,
            code="KHO_SAL06",
            name="Kho Tổng Giảm Giá",
            warehouse_type="REGULAR",
            allow_receipt=True,
            allow_issue=True,
            status="ACTIVE",
        )

        # UOM
        self.uom_cai = UnitOfMeasure.objects.create(
            company=self.company, code="CAI", name="Cái", decimal_places=0, status="ACTIVE"
        )
        self.uom_goi = UnitOfMeasure.objects.create(
            company=self.company, code="GOI", name="Gói", decimal_places=0, status="ACTIVE"
        )

        # Tax Rate
        self.vat10 = TaxRate.objects.create(
            company=self.company,
            code="VAT10_SAL06",
            name="Thuế GTGT 10%",
            tax_type="VAT",
            rate_percent=Decimal("10"),
            application_form="PERCENT",
            effective_from=self.today - timedelta(days=30),
            business_scope="OUTPUT",
            status="ACTIVE",
        )

        # Items
        self.item_laptop = Item.objects.create(
            company=self.company,
            code="LAPTOP_HP",
            name="Laptop HP ProBook",
            item_type="GOODS",
            track_inventory=True,
            base_uom=self.uom_cai,
            status="ACTIVE",
        )
        self.item_service = Item.objects.create(
            company=self.company,
            code="SVC_MAINTAIN",
            name="Dịch Vụ Bảo Trì Phần Mềm",
            item_type="SERVICE",
            track_inventory=False,
            base_uom=self.uom_goi,
            status="ACTIVE",
        )

        # Inventory Policy & Initial Stock
        InventoryPolicy.objects.create(
            company=self.company,
            warehouse=self.warehouse,
            item=self.item_laptop,
            base_uom=self.uom_cai,
            allow_negative=True,
            is_active=True,
        )

        # Chart of Accounts & GL Accounts
        chart = ChartOfAccounts.objects.create(
            company=self.company, code="COA_SAL06", name="Hệ thống tài khoản giảm giá hàng bán", effective_from=self.today
        )
        self.acc_131 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="131", name="Phải thu của khách hàng",
            account_type="ASSET", is_postable=True, status="ACTIVE", requires_party=True
        )
        self.acc_111 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="1111", name="Tiền mặt",
            account_type="ASSET", is_postable=True, status="ACTIVE"
        )
        self.acc_112 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="1121", name="Tiền gửi ngân hàng",
            account_type="ASSET", is_postable=True, status="ACTIVE"
        )
        self.acc_511 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="5111", name="Doanh thu bán hàng hóa",
            account_type="REVENUE", is_postable=True, status="ACTIVE"
        )
        self.acc_5113 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="5113", name="Doanh thu cung cấp dịch vụ",
            account_type="REVENUE", is_postable=True, status="ACTIVE"
        )
        self.acc_5213 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="5213", name="Giảm giá hàng bán",
            account_type="REVENUE", is_postable=True, status="ACTIVE"
        )
        self.acc_33311 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="33311", name="Thuế GTGT đầu ra",
            account_type="LIABILITY", is_postable=True, status="ACTIVE"
        )
        self.acc_156 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="1561", name="Hàng hóa tồn kho",
            account_type="ASSET", is_postable=True, status="ACTIVE"
        )
        self.acc_632 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="632", name="Giá vốn hàng bán",
            account_type="EXPENSE", is_postable=True, status="ACTIVE"
        )

        # Accounting Period
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code=f"{self.today.year}-{self.today.month:02d}",
            fiscal_year=self.today.year,
            period_number=self.today.month,
            start_date=date(self.today.year, self.today.month, 1),
            end_date=date(self.today.year, 12, 31),
            status="OPEN",
        )

        # Standard Goods Sale
        self.goods_sale = self._create_posted_goods_sale()

    def _create_posted_goods_sale(self, payment_type="UNPAID", qty=Decimal("10")):
        """Create a posted GoodsSale with Laptop lines, attached issue, and receivable."""
        subtotal = qty * Decimal("20000000")  # 200,000,000
        discount = Decimal("10000000")        # 10,000,000 discount
        net_revenue = subtotal - discount     # 190,000,000
        tax = net_revenue * Decimal("0.10")   # 19,000,000 VAT
        total = net_revenue + tax             # 209,000,000
        unit_cost = Decimal("15000000")
        cogs = qty * unit_cost                # 150,000,000

        StockBalance.objects.create(
            company=self.company,
            warehouse=self.warehouse,
            item=self.item_laptop,
            quantity=qty * 2,
            inventory_value=qty * 2 * unit_cost,
            average_cost=unit_cost,
        )

        issue_trx = InventoryTransaction.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.customer,
            number=f"XK-ALLOW-{timezone.now().timestamp()}",
            transaction_type="ISSUE",
            transaction_date=self.today,
            source_warehouse=self.warehouse,
            status="APPROVED",
            created_by=self.user.iam_account,
        )
        InventoryTransactionLine.objects.create(
            transaction=issue_trx,
            line_no=1,
            item=self.item_laptop,
            uom=self.uom_cai,
            quantity=qty,
            base_quantity=qty,
            unit_cost=unit_cost,
            line_value=cogs,
            movement_direction="OUT",
        )
        req_factory = APIRequestFactory()
        mock_req = req_factory.post("/")
        mock_req.user = self.user
        post_inventory(issue_trx, mock_req)

        sale = GoodsSale.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"BH-ALLOW-{timezone.now().timestamp()}",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer,
            currency=self.currency,
            exchange_rate=Decimal("1"),
            payment_type=payment_type,
            subtotal=subtotal,
            discount_amount=discount,
            tax_amount=tax,
            total_amount=total,
            inventory_handling=GoodsSale.InventoryHandling.ATTACH_ISSUE,
            inventory_transaction=issue_trx,
            status=DocumentStatus.POSTED,
            created_by=self.user.iam_account,
            version=1,
        )

        GoodsSaleLine.objects.create(
            sale=sale,
            line_no=1,
            item=self.item_laptop,
            uom=self.uom_cai,
            warehouse=self.warehouse,
            quantity=qty,
            unit_price=Decimal("20000000"),
            discount_amount=discount,
            tax_rate=self.vat10,
            tax_amount=tax,
            line_total=total,
            inventory_account=self.acc_156,
            cogs_account=self.acc_632,
            revenue_account=self.acc_511,
            tax_account=self.acc_33311,
            receivable_or_payment_account=self.acc_131,
        )

        if payment_type == "UNPAID":
            rec = Receivable.objects.create(
                company=self.company,
                branch=self.branch,
                customer=self.customer,
                currency=self.currency,
                exchange_rate=Decimal("1"),
                account=self.acc_131,
                original_amount=total,
                balance=total,
                document_date=self.today,
                posting_date=self.today,
                source_document_type="GOODS_SALE",
                source_document_id=str(sale.id),
                source_document_number=sale.number,
                status=ReceivableStatus.OPEN,
                created_by=self.user.iam_account,
            )
            sale.receivable = rec
            sale.save(update_fields=["receivable"])

        return sale

    def _create_posted_service_sale(self, payment_type="UNPAID"):
        """Create a posted ServiceSale."""
        qty = Decimal("1")
        unit_price = Decimal("50000000")
        discount = Decimal("0")
        net = unit_price
        tax = net * Decimal("0.10")
        total = net + tax

        service_sale = ServiceSale.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"DV-ALLOW-{timezone.now().timestamp()}",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer,
            currency=self.currency,
            exchange_rate=Decimal("1"),
            payment_type=payment_type,
            subtotal=unit_price,
            discount_amount=discount,
            tax_amount=tax,
            total_amount=total,
            status=DocumentStatus.POSTED,
            created_by=self.user.iam_account,
            version=1,
        )

        ServiceSaleLine.objects.create(
            sale=service_sale,
            line_no=1,
            item=self.item_service,
            uom=self.uom_goi,
            quantity=qty,
            unit_price=unit_price,
            discount_amount=discount,
            tax_rate=self.vat10,
            tax_amount=tax,
            line_total=total,
            revenue_account=self.acc_5113,
            tax_account=self.acc_33311,
            receivable_or_payment_account=self.acc_131,
        )

        if payment_type == "UNPAID":
            rec = Receivable.objects.create(
                company=self.company,
                branch=self.branch,
                customer=self.customer,
                currency=self.currency,
                exchange_rate=Decimal("1"),
                account=self.acc_131,
                original_amount=total,
                balance=total,
                document_date=self.today,
                posting_date=self.today,
                source_document_type="SERVICE_SALE",
                source_document_id=str(service_sale.id),
                source_document_number=service_sale.number,
                status=ReceivableStatus.OPEN,
                created_by=self.user.iam_account,
            )
            service_sale.receivable = rec
            service_sale.save(update_fields=["receivable"])

        return service_sale

    def test_01_create_draft_allowance_fixed_amount(self):
        """UC-SAL-06: Create draft SalesAllowance with BY_AMOUNT entry method and auto numbering."""
        line = self.goods_sale.lines.first()
        payload = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "document_date": str(self.today),
            "posting_date": str(self.today),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "allowance_reason": "Hàng sai quy cách nhẹ, thỏa thuận giảm giá",
            "lines": [
                {
                    "goods_sale_line": str(line.id),
                    "entry_method": "BY_AMOUNT",
                    "allowance_amount": "20000000",  # 20,000,000 VND
                    "revenue_deduction_account": str(self.acc_5213.id),
                    "tax_account": str(self.acc_33311.id),
                    "receivable_account": str(self.acc_131.id),
                }
            ],
        }

        resp = self.client.post("/api/v1/sales/sales-allowances/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        data = resp.data

        # Auto numbering GG-YYYY-NNNNNN
        self.assertTrue(data["number"].startswith(f"GG-{self.today.year}-"))
        self.assertEqual(data["status"], "DRAFT")

        # Financials verification: 20M allowance + 2M (10% tax) = 22M total
        self.assertEqual(Decimal(str(data["total_allowance_amount"])), Decimal("20000000"))
        self.assertEqual(Decimal(str(data["total_tax_amount"])), Decimal("2000000"))
        self.assertEqual(Decimal(str(data["total_amount"])), Decimal("22000000"))

        # Verify line detail
        self.assertEqual(len(data["lines"]), 1)
        res_line = data["lines"][0]
        self.assertEqual(Decimal(str(res_line["net_sales_value"])), Decimal("190000000"))
        self.assertEqual(Decimal(str(res_line["remaining_value"])), Decimal("190000000"))
        self.assertEqual(Decimal(str(res_line["allowance_amount"])), Decimal("20000000"))
        self.assertEqual(Decimal(str(res_line["tax_amount"])), Decimal("2000000"))
        self.assertEqual(Decimal(str(res_line["line_total"])), Decimal("22000000"))

    def test_02_create_allowance_by_percent(self):
        """UC-SAL-06: Create draft SalesAllowance with BY_PERCENT entry method (BR-SAL-06-03, AF-03)."""
        line = self.goods_sale.lines.first()
        # Remaining value is 190,000,000. 10% rate should calculate to 19,000,000 allowance, 1,900,000 tax.
        payload = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "allowance_reason": "Giảm 10% do giao trễ hẹn",
            "lines": [
                {
                    "goods_sale_line": str(line.id),
                    "entry_method": "BY_PERCENT",
                    "allowance_rate": "10",
                }
            ],
        }

        resp = self.client.post("/api/v1/sales/sales-allowances/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        data = resp.data

        self.assertEqual(Decimal(str(data["total_allowance_amount"])), Decimal("19000000"))
        self.assertEqual(Decimal(str(data["total_tax_amount"])), Decimal("1900000"))
        self.assertEqual(Decimal(str(data["total_amount"])), Decimal("20900000"))

    def test_03_prepare_from_sale_goods_and_service(self):
        """UC-SAL-06: AF-02 prepare_from_sale action for GoodsSale and ServiceSale."""
        # 1. Prepare from goods sale
        resp = self.client.get(
            f"/api/v1/sales/sales-allowances/prepare_from_sale/?company_id={self.company.id}&goods_sale_id={self.goods_sale.id}"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        data = resp.data
        self.assertEqual(data["customer"], str(self.customer.id))
        self.assertEqual(data["goods_sale"], str(self.goods_sale.id))
        self.assertEqual(len(data["lines"]), 1)
        self.assertEqual(Decimal(str(data["lines"][0]["net_sales_value"])), Decimal("190000000"))
        self.assertEqual(Decimal(str(data["lines"][0]["remaining_value"])), Decimal("190000000"))

        # 2. Prepare from service sale
        svc_sale = self._create_posted_service_sale()
        resp_svc = self.client.get(
            f"/api/v1/sales/sales-allowances/prepare_from_sale/?company_id={self.company.id}&service_sale_id={svc_sale.id}"
        )
        self.assertEqual(resp_svc.status_code, status.HTTP_200_OK, resp_svc.data)
        data_svc = resp_svc.data
        self.assertEqual(data_svc["customer"], str(self.customer.id))
        self.assertEqual(data_svc["service_sale"], str(svc_sale.id))
        self.assertEqual(len(data_svc["lines"]), 1)
        self.assertEqual(Decimal(str(data_svc["lines"][0]["net_sales_value"])), Decimal("50000000"))
        self.assertEqual(Decimal(str(data_svc["lines"][0]["remaining_value"])), Decimal("50000000"))

    def test_04_validation_exceeding_remaining_value_and_invalid_rates(self):
        """UC-SAL-06: EF-03 / BR-SAL-06-03 validation rejects exceeding allowance and invalid rates."""
        line = self.goods_sale.lines.first()

        # 1. Exceeding remaining value
        payload_exceed = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "allowance_reason": "Giảm vượt mức",
            "lines": [
                {
                    "goods_sale_line": str(line.id),
                    "entry_method": "BY_AMOUNT",
                    "allowance_amount": "250000000",  # remaining is 190,000,000
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-allowances/", payload_exceed, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vượt quá giá trị còn được giảm", str(resp.data))

        # 2. Invalid rate > 100%
        payload_invalid_rate = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "allowance_reason": "Tỷ lệ sai",
            "lines": [
                {
                    "goods_sale_line": str(line.id),
                    "entry_method": "BY_PERCENT",
                    "allowance_rate": "120",
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-allowances/", payload_invalid_rate, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("không vượt quá 100%", str(resp.data))

        # 3. Target sale is not POSTED
        draft_sale = GoodsSale.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"BH-DRAFT-{timezone.now().timestamp()}",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer,
            currency=self.currency,
            exchange_rate=Decimal("1"),
            payment_type="UNPAID",
            subtotal=Decimal("10000000"),
            discount_amount=Decimal("0"),
            tax_amount=Decimal("1000000"),
            total_amount=Decimal("11000000"),
            status=DocumentStatus.DRAFT,
            created_by=self.user.iam_account,
        )
        draft_line = GoodsSaleLine.objects.create(
            sale=draft_sale,
            line_no=1,
            item=self.item_laptop,
            uom=self.uom_cai,
            quantity=Decimal("1"),
            unit_price=Decimal("10000000"),
            tax_rate=self.vat10,
            tax_amount=Decimal("1000000"),
            line_total=Decimal("11000000"),
        )
        payload_draft = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(draft_sale.id),
            "allowance_reason": "Giảm đơn nháp",
            "lines": [
                {
                    "goods_sale_line": str(draft_line.id),
                    "entry_method": "BY_AMOUNT",
                    "allowance_amount": "1000000",
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-allowances/", payload_draft, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phải ở trạng thái Đã ghi sổ", str(resp.data))

    def test_05_post_allowance_gl_and_br_sal_06_11_no_inventory_impact(self):
        """UC-SAL-06: Post allowance, check balanced GL entries, AR reduction, and NO inventory/COGS impact (BR-SAL-06-10, BR-SAL-06-11)."""
        line = self.goods_sale.lines.first()

        # Record initial stock balance count & qty
        stock_before = StockBalance.objects.get(
            company=self.company, warehouse=self.warehouse, item=self.item_laptop
        )
        initial_qty = stock_before.quantity
        initial_val = stock_before.inventory_value
        initial_inv_tx_count = InventoryTransaction.objects.count()

        # Create allowance of 30,000,000 (tax: 3,000,000; total: 33,000,000)
        allowance = SalesAllowance.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"GG-{self.today.year}-000099",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer,
            goods_sale=self.goods_sale,
            currency=self.currency,
            exchange_rate=Decimal("1"),
            allowance_reason="Giảm giá lô hàng xuất xưởng lỗi sơn",
            subtotal=Decimal("30000000"),
            tax_amount=Decimal("3000000"),
            total_amount=Decimal("33000000"),
            status=DocumentStatus.DRAFT,
            created_by=self.user.iam_account,
        )
        SalesAllowanceLine.objects.create(
            allowance=allowance,
            line_no=1,
            goods_sale_line=line,
            item=self.item_laptop,
            uom=self.uom_cai,
            net_sales_value=Decimal("190000000"),
            returned_value=Decimal("0"),
            already_reduced_value=Decimal("0"),
            remaining_value=Decimal("190000000"),
            entry_method="BY_AMOUNT",
            allowance_amount=Decimal("30000000"),
            tax_rate=self.vat10,
            tax_amount=Decimal("3000000"),
            line_total=Decimal("33000000"),
            revenue_deduction_account=self.acc_5213,
            tax_account=self.acc_33311,
            receivable_account=self.acc_131,
        )

        # Post via API
        resp = self.client.post(f"/api/v1/sales/sales-allowances/{allowance.id}/post/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(resp.data["status"], "POSTED")

        allowance.refresh_from_db()
        self.assertIsNotNone(allowance.journal_entry)

        # Verify balanced Journal Entry:
        # Debit 5213: 30,000,000
        # Debit 33311: 3,000,000
        # Credit 131: 33,000,000
        je = allowance.journal_entry
        je_lines = list(je.lines.all())
        self.assertEqual(len(je_lines), 3)

        line_5213 = next(l for l in je_lines if l.account_id == self.acc_5213.id)
        line_3331 = next(l for l in je_lines if l.account_id == self.acc_33311.id)
        line_131 = next(l for l in je_lines if l.account_id == self.acc_131.id)

        self.assertEqual(line_5213.debit, Decimal("30000000"))
        self.assertEqual(line_5213.credit, Decimal("0"))

        self.assertEqual(line_3331.debit, Decimal("3000000"))
        self.assertEqual(line_3331.credit, Decimal("0"))

        self.assertEqual(line_131.credit, Decimal("33000000"))
        self.assertEqual(line_131.debit, Decimal("0"))

        # BR-SAL-06-11 CRITICAL CHECK: No inventory transactions, no StockBalance changes, no 156/632 lines
        self.assertEqual(InventoryTransaction.objects.count(), initial_inv_tx_count)
        stock_after = StockBalance.objects.get(
            company=self.company, warehouse=self.warehouse, item=self.item_laptop
        )
        self.assertEqual(stock_after.quantity, initial_qty)
        self.assertEqual(stock_after.inventory_value, initial_val)
        for jl in je_lines:
            self.assertNotEqual(jl.account_id, self.acc_156.id)
            self.assertNotEqual(jl.account_id, self.acc_632.id)

        # Check Receivable balance was reduced by 33,000,000 (from 209,000,000 to 176,000,000)
        rec = self.goods_sale.receivable
        rec.refresh_from_db()
        self.assertEqual(rec.balance, Decimal("176000000"))
        self.assertEqual(rec.status, ReceivableStatus.PARTIALLY_PAID)

    def test_06_multiple_allowances_and_remainder_rounding(self):
        """UC-SAL-06: Successive allowances, remaining balance tracking, and remainder tax rounding (BR-SAL-06-04, BR-SAL-06-06)."""
        line = self.goods_sale.lines.first()

        # 1st allowance: 90,000,000 VND
        payload1 = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "allowance_reason": "Giảm lần 1",
            "lines": [
                {
                    "goods_sale_line": str(line.id),
                    "entry_method": "BY_AMOUNT",
                    "allowance_amount": "90000000",
                }
            ],
        }
        resp1 = self.client.post("/api/v1/sales/sales-allowances/", payload1, format="json")
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        allowance1_id = resp1.data["id"]

        # Post 1st allowance
        resp_post1 = self.client.post(f"/api/v1/sales/sales-allowances/{allowance1_id}/post/")
        self.assertEqual(resp_post1.status_code, status.HTTP_200_OK)

        # 2nd allowance: attempt to reduce the remaining 100,000,000 VND
        payload2 = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "allowance_reason": "Giảm hết phần còn lại",
            "lines": [
                {
                    "goods_sale_line": str(line.id),
                    "entry_method": "BY_AMOUNT",
                    "allowance_amount": "100000000",
                }
            ],
        }
        resp2 = self.client.post("/api/v1/sales/sales-allowances/", payload2, format="json")
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)
        allowance2_id = resp2.data["id"]

        # 3rd allowance: attempt any more allowance should fail because remaining is now 0 (reserved by allowance2)
        payload3 = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "allowance_reason": "Giảm lần 3 vượt quá",
            "lines": [
                {
                    "goods_sale_line": str(line.id),
                    "entry_method": "BY_AMOUNT",
                    "allowance_amount": "1000",
                }
            ],
        }
        resp3 = self.client.post("/api/v1/sales/sales-allowances/", payload3, format="json")
        self.assertEqual(resp3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vượt quá giá trị còn được giảm", str(resp3.data))

    def test_07_sales_allowance_on_service_sale(self):
        """UC-SAL-06: Create and post SalesAllowance on a ServiceSale."""
        svc_sale = self._create_posted_service_sale()
        svc_line = svc_sale.lines.first()

        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "service_sale": str(svc_sale.id),
            "allowance_reason": "Dịch vụ gián đoạn 2 ngày, thỏa thuận bồi hoàn giảm giá 10M",
            "lines": [
                {
                    "service_sale_line": str(svc_line.id),
                    "entry_method": "BY_AMOUNT",
                    "allowance_amount": "10000000",
                    "revenue_deduction_account": str(self.acc_5213.id),
                    "tax_account": str(self.acc_33311.id),
                    "receivable_account": str(self.acc_131.id),
                }
            ],
        }

        resp = self.client.post("/api/v1/sales/sales-allowances/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        allowance_id = resp.data["id"]

        # Post the allowance on service sale
        resp_post = self.client.post(f"/api/v1/sales/sales-allowances/{allowance_id}/post/")
        self.assertEqual(resp_post.status_code, status.HTTP_200_OK, resp_post.data)
        self.assertEqual(resp_post.data["status"], "POSTED")

        # Check Receivable for ServiceSale was reduced from 55,000,000 to 44,000,000 (10M + 1M VAT = 11M)
        rec = svc_sale.receivable
        rec.refresh_from_db()
        self.assertEqual(rec.balance, Decimal("44000000"))

    def test_08_approval_workflow_lifecycle(self):
        """UC-SAL-06: Test full approval workflow: SUBMIT -> WITHDRAW -> REQUEST_REVISION -> APPROVE -> POST -> UNPOST."""
        line = self.goods_sale.lines.first()
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "allowance_reason": "Quy trình duyệt giảm giá",
            "lines": [
                {
                    "goods_sale_line": str(line.id),
                    "entry_method": "BY_AMOUNT",
                    "allowance_amount": "5000000",
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-allowances/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        allowance_id = resp.data["id"]

        # 1. Submit
        r = self.client.post(f"/api/v1/sales/sales-allowances/{allowance_id}/submit/", {"notes": "Trình duyệt sếp"})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        # Set to PENDING_APPROVAL to simulate active workflow and test withdraw
        allowance_obj = SalesAllowance.objects.get(id=allowance_id)
        allowance_obj.status = DocumentStatus.PENDING_APPROVAL
        allowance_obj.save(update_fields=["status"])

        # 2. Withdraw
        r = self.client.post(f"/api/v1/sales/sales-allowances/{allowance_id}/withdraw/", {"reason": "Cần kiểm tra lại số liệu"})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "DRAFT")

        # 3. Submit again & set PENDING_APPROVAL to test request revision
        self.client.post(f"/api/v1/sales/sales-allowances/{allowance_id}/submit/")
        allowance_obj.refresh_from_db()
        allowance_obj.status = DocumentStatus.PENDING_APPROVAL
        allowance_obj.save(update_fields=["status"])

        # 4. Request revision
        r = self.client.post(f"/api/v1/sales/sales-allowances/{allowance_id}/request_revision/", {"comment": "Bổ sung biên bản"})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "REVISION_REQUIRED")

        # 5. Resubmit & set PENDING_APPROVAL to test approve
        self.client.post(f"/api/v1/sales/sales-allowances/{allowance_id}/submit/")
        allowance_obj.refresh_from_db()
        allowance_obj.status = DocumentStatus.PENDING_APPROVAL
        allowance_obj.save(update_fields=["status"])

        r = self.client.post(f"/api/v1/sales/sales-allowances/{allowance_id}/approve/", {"comment": "Đồng ý giảm giá"})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "APPROVED")

        # 6. Post
        r = self.client.post(f"/api/v1/sales/sales-allowances/{allowance_id}/post/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "POSTED")

        # 7. Unpost
        r = self.client.post(f"/api/v1/sales/sales-allowances/{allowance_id}/unpost/", {"reason": "Huỷ ghi sổ để sửa"})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["status"], "DRAFT")

    def test_09_customer_refund_for_excess_allowance(self):
        """UC-SAL-06: AF-04 Customer refund when sale was fully paid or allowance exceeds receivable."""
        paid_sale = self._create_posted_goods_sale(payment_type="CASH")
        line = paid_sale.lines.first()

        # Create allowance on fully paid sale: 10M + 1M VAT = 11M
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(paid_sale.id),
            "allowance_reason": "Hoàn tiền giảm giá cho khách đã thanh toán",
            "lines": [
                {
                    "goods_sale_line": str(line.id),
                    "entry_method": "BY_AMOUNT",
                    "allowance_amount": "10000000",
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-allowances/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        allowance_id = resp.data["id"]

        # Post allowance: since sale has no open receivable, all 11M becomes refundable_amount
        resp_post = self.client.post(f"/api/v1/sales/sales-allowances/{allowance_id}/post/")
        self.assertEqual(resp_post.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(resp_post.data["refundable_amount"])), Decimal("11000000"))
        self.assertEqual(Decimal(str(resp_post.data["refunded_amount"])), Decimal("0"))

        # Execute refund via bank payment (AF-04)
        refund_payload = {
            "refund_amount": "11000000",
            "payment_method": "BANK",
            "payment_account": str(self.acc_112.id),
            "notes": "Chuyển khoản hoàn tiền giảm giá cho khách",
        }
        resp_refund = self.client.post(
            f"/api/v1/sales/sales-allowances/{allowance_id}/refund/", refund_payload, format="json"
        )
        self.assertEqual(resp_refund.status_code, status.HTTP_200_OK, resp_refund.data)
        self.assertEqual(resp_refund.data["status"], "SUCCESS")
        self.assertEqual(Decimal(str(resp_refund.data["refunded_amount"])), Decimal("11000000"))

        # Verify refund Journal Entry: Debit 131, Credit 1121
        refund_je = JournalEntry.objects.get(id=resp_refund.data["journal_entry_id"])
        self.assertEqual(refund_je.total_debit, Decimal("11000000"))
        self.assertEqual(refund_je.total_credit, Decimal("11000000"))

    def test_10_optimistic_locking_and_cancel_releases_reservation(self):
        """UC-SAL-06: BR-SAL-06-15 optimistic lock version check, and cancel releases reserved value."""
        line = self.goods_sale.lines.first()

        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "allowance_reason": "Khóa lạc quan & hủy",
            "lines": [
                {
                    "goods_sale_line": str(line.id),
                    "entry_method": "BY_AMOUNT",
                    "allowance_amount": "50000000",
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-allowances/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        allowance_id = resp.data["id"]

        # Version conflict test
        update_conflict = {
            "version": 999,  # Mismatched version
            "allowance_reason": "Cố tình ghi đè version cũ",
        }
        r_conflict = self.client.patch(
            f"/api/v1/sales/sales-allowances/{allowance_id}/", update_conflict, format="json"
        )
        self.assertEqual(r_conflict.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vừa được người khác cập nhật", str(r_conflict.data))

        # Cancel the draft allowance
        r_cancel = self.client.post(
            f"/api/v1/sales/sales-allowances/{allowance_id}/cancel/", {"reason": "Khách không đồng ý mức giảm"}
        )
        self.assertEqual(r_cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(r_cancel.data["status"], "CANCELLED")

        # Now all 190,000,000 is available again for reduction
        payload_new = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "allowance_reason": "Lập lại chứng từ mới với toàn bộ giá trị",
            "lines": [
                {
                    "goods_sale_line": str(line.id),
                    "entry_method": "BY_AMOUNT",
                    "allowance_amount": "190000000",
                }
            ],
        }
        resp_new = self.client.post("/api/v1/sales/sales-allowances/", payload_new, format="json")
        self.assertEqual(resp_new.status_code, status.HTTP_201_CREATED, resp_new.data)
