from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts_receivable.models import Receivable, ReceivableStatus
from general_ledger.models import Account, AccountingPeriod, ChartOfAccounts, JournalEntry
from iam.models import CompanyMembership
from inventory.models import InventoryPolicy, InventoryTransaction, InventoryTransactionLine, StockBalance
from inventory.services import post as post_inventory
from master_data.models import (
    Currency, Item, Party, PartyAddress, PartyContact, PartyRole,
    PaymentTerm, TaxRate, UnitOfMeasure, Warehouse
)
from organization.models import Branch, Company, Employee
from sales.models import (
    DocumentStatus, GoodsSale, GoodsSaleLine,
    SalesReturn, SalesReturnLine
)
from tax_management.models import InvoiceDirection, InvoiceStatus, TaxInvoice


class SalesReturnUcSal05Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.client = APIClient()

        # Currency
        self.currency = Currency.objects.get(code="VND")

        # Company & Branch
        self.company = Company.objects.create(
            code="SAL05_CO",
            name="Sales Return Co",
            legal_name="Sales Return Company Ltd",
            tax_code="0109988775",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(
            company=self.company,
            code="CN_RETURN",
            name="Chi nhánh Bán hàng",
            status="ACTIVE",
        )

        # Users
        self.user = get_user_model().objects.create_superuser(
            username="return_user", email="return_user@example.com", password="password123"
        )
        self.client.force_authenticate(user=self.user)

        # Employee & Membership
        self.employee = Employee.objects.create(
            company=self.company,
            employee_code="NV_RET",
            full_name="Nguyễn Văn Trả Hàng",
            email="nv_ret@example.com",
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
            code="CUST_SAL05_01",
            name="Công Ty Cổ Phần Mua Hàng Alpha",
            tax_code="0399882233",
            default_currency=self.currency,
            status="ACTIVE",
        )
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)
        self.customer_address = PartyAddress.objects.create(
            party=self.customer,
            address_type="OFFICE",
            address_line="123 Đường Hai Bà Trưng, Quận 1, TP. HCM",
            is_default=True,
        )

        # Payment Term (NET30)
        self.payment_term = PaymentTerm.objects.create(
            company=self.company,
            code="NET30_SAL05",
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
            code="KHO_TONG_SAL05",
            name="Kho Tổng Hàng Hóa",
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
            code="VAT10_SAL05",
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
            code="LAPTOP_DELL",
            name="Laptop Dell XPS 15",
            item_type="GOODS",
            track_inventory=True,
            base_uom=self.uom_cai,
            status="ACTIVE",
        )
        self.item_non_inv = Item.objects.create(
            company=self.company,
            code="NON_INV_BOOK",
            name="Sách Hướng Dẫn Sử Dụng",
            item_type="GOODS",
            track_inventory=False,
            base_uom=self.uom_cai,
            status="ACTIVE",
        )
        self.item_service = Item.objects.create(
            company=self.company,
            code="SVC_WARRANTY",
            name="Dịch Vụ Bảo Hành Mở Rộng",
            item_type="SERVICE",
            track_inventory=False,
            base_uom=self.uom_goi,
            status="ACTIVE",
        )

        # Inventory Policy & Initial Stock for Laptop
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
            company=self.company, code="COA_SAL05", name="Hệ thống tài khoản bán trả lại", effective_from=self.today
        )
        self.acc_131 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="131", name="Phải thu của khách hàng",
            account_type="ASSET", is_postable=True, status="ACTIVE", requires_party=True
        )
        self.acc_111 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="1111", name="Tiền mặt Việt Nam",
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
        self.acc_5212 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="5212", name="Hàng bán bị trả lại",
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

        # Open Accounting Period
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code=f"{self.today.year}-{self.today.month:02d}",
            fiscal_year=self.today.year,
            period_number=self.today.month,
            start_date=date(self.today.year, self.today.month, 1),
            end_date=date(self.today.year, 12, 31),
            status="OPEN",
        )

        # Helper method: create a standard posted GoodsSale
        self.goods_sale = self._create_posted_goods_sale()

    def _create_posted_goods_sale(self, payment_type="UNPAID", qty=Decimal("10")):
        """Create a posted GoodsSale with Laptop lines, attached issue, and receivable."""
        subtotal = qty * Decimal("20000000")  # 200,000,000
        discount = Decimal("10000000")        # 10,000,000 discount
        tax = (subtotal - discount) * Decimal("0.10")  # 19,000,000 VAT
        total = subtotal - discount + tax     # 209,000,000
        unit_cost = Decimal("15000000")
        cogs = qty * unit_cost                # 150,000,000

        # Stock balance to allow issue
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
            number=f"XK-TEST-{timezone.now().timestamp()}",
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
        from rest_framework.test import APIRequestFactory
        req_factory = APIRequestFactory()
        mock_req = req_factory.post("/")
        mock_req.user = self.user
        post_inventory(issue_trx, mock_req)

        sale = GoodsSale.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"BH-TEST-{timezone.now().timestamp()}",
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
            unit_cost=unit_cost,
            cogs_amount=cogs,
            receivable_or_payment_account=self.acc_131,
            revenue_account=self.acc_511,
            tax_account=self.acc_33311,
            inventory_account=self.acc_156,
            cogs_account=self.acc_632,
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

    def test_01_create_draft_and_defaults(self):
        """Test defaults endpoint and draft sales return creation with auto-numbering and allocations."""
        url_defaults = f"/api/v1/sales/sales-returns/defaults/?company_id={self.company.id}&goods_sale_id={self.goods_sale.id}"
        resp_def = self.client.get(url_defaults)
        self.assertEqual(resp_def.status_code, 200)
        self.assertEqual(resp_def.data["goods_sale"], str(self.goods_sale.id))
        self.assertEqual(resp_def.data["customer"], str(self.customer.id))

        sale_line = self.goods_sale.lines.first()
        payload = {
            "company": str(self.company.id),
            "branch": str(self.branch.id),
            "goods_sale": str(self.goods_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Khách hàng báo hàng bị lỗi trầy xước",
            "inventory_handling": "ATTACH_INWARD",
            "lines": [
                {
                    "goods_sale_line_id": str(sale_line.id),
                    "return_quantity": "2",
                    "warehouse_id": str(self.warehouse.id),
                }
            ],
        }

        url_create = f"/api/v1/sales/sales-returns/?company_id={self.company.id}"
        resp = self.client.post(url_create, payload, format="json")
        self.assertEqual(resp.status_code, 201)
        data = resp.data

        self.assertTrue(data["number"].startswith(f"TL-{self.today.year}-"))
        self.assertEqual(data["status"], DocumentStatus.DRAFT)
        # Quantity 2 out of 10 -> subtotal = 40,000,000, discount = 2,000,000, tax = 3,800,000, total = 41,800,000
        self.assertEqual(Decimal(data["subtotal"]), Decimal("40000000"))
        self.assertEqual(Decimal(data["discount_amount"]), Decimal("2000000"))
        self.assertEqual(Decimal(data["tax_amount"]), Decimal("3800000"))
        self.assertEqual(Decimal(data["total_amount"]), Decimal("41800000"))

    def test_02_block_service_item_or_unposted_source(self):
        """EF-02, EF-03, BR-SAL-05-02: Block returns referencing unposted sales or service items."""
        # Unposted GoodsSale
        unposted_sale = GoodsSale.objects.create(
            company=self.company,
            branch=self.branch,
            number="BH-UNPOSTED",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer,
            currency=self.currency,
            status=DocumentStatus.DRAFT,
            created_by=self.user.iam_account,
        )
        sale_line = GoodsSaleLine.objects.create(
            sale=unposted_sale,
            line_no=1,
            item=self.item_laptop,
            uom=self.uom_cai,
            quantity=Decimal("5"),
            unit_price=Decimal("20000000"),
            line_total=Decimal("100000000"),
        )

        payload = {
            "company": str(self.company.id),
            "goods_sale": str(unposted_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Lỗi",
            "lines": [{"goods_sale_line_id": str(sale_line.id), "return_quantity": "1"}],
        }
        url = f"/api/v1/sales/sales-returns/?company_id={self.company.id}"
        resp = self.client.post(url, payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("POSTED", str(resp.data))

        # Service item on posted sale
        svc_sale = GoodsSale.objects.create(
            company=self.company,
            number="BH-SVC",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer,
            currency=self.currency,
            status=DocumentStatus.POSTED,
            created_by=self.user.iam_account,
        )
        svc_line = GoodsSaleLine.objects.create(
            sale=svc_sale,
            line_no=1,
            item=self.item_service,
            uom=self.uom_goi,
            quantity=Decimal("1"),
            unit_price=Decimal("5000000"),
            line_total=Decimal("5000000"),
        )
        payload_svc = {
            "company": str(self.company.id),
            "goods_sale": str(svc_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Lỗi",
            "lines": [{"goods_sale_line_id": str(svc_line.id), "return_quantity": "1"}],
        }
        resp_svc = self.client.post(url, payload_svc, format="json")
        self.assertEqual(resp_svc.status_code, 400)
        self.assertIn("dịch vụ", str(resp_svc.data).lower())

    def test_03_prepare_from_goods_sale_and_over_return_block(self):
        """AF-02, BR-SAL-05-03, EF-03: Prepare lines and block returning more than remaining available."""
        url_prep = f"/api/v1/sales/sales-returns/prepare_from_sale/?company_id={self.company.id}&goods_sale_id={self.goods_sale.id}"
        resp_prep = self.client.get(url_prep)
        self.assertEqual(resp_prep.status_code, 200)
        self.assertEqual(len(resp_prep.data["lines"]), 1)
        self.assertEqual(resp_prep.data["lines"][0]["remaining_quantity"], "10.000000")

        # Try to return 11 (exceeds sold quantity 10)
        sale_line = self.goods_sale.lines.first()
        payload = {
            "company": str(self.company.id),
            "goods_sale": str(self.goods_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Trả nhiều hơn đã mua",
            "lines": [
                {
                    "goods_sale_line_id": str(sale_line.id),
                    "return_quantity": "11",
                    "warehouse_id": str(self.warehouse.id),
                }
            ],
        }
        url_create = f"/api/v1/sales/sales-returns/?company_id={self.company.id}"
        resp = self.client.post(url_create, payload, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("vượt quá", str(resp.data).lower())

    def test_04_unposted_returns_hold_quantity_and_release_on_cancel(self):
        """BR-SAL-05-05, AF-08: Unposted returns hold quantities; cancelling releases reserved quantity."""
        sale_line = self.goods_sale.lines.first()
        url_create = f"/api/v1/sales/sales-returns/?company_id={self.company.id}"

        # Create Return 1 with 6 units (DRAFT)
        payload1 = {
            "company": str(self.company.id),
            "goods_sale": str(self.goods_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Lô 1",
            "lines": [{"goods_sale_line_id": str(sale_line.id), "return_quantity": "6", "warehouse_id": str(self.warehouse.id)}],
        }
        resp1 = self.client.post(url_create, payload1, format="json")
        self.assertEqual(resp1.status_code, 201)
        ret1_id = resp1.data["id"]

        # Try Return 2 with 5 units -> 6 + 5 = 11 > 10 -> must fail
        payload2 = {
            "company": str(self.company.id),
            "goods_sale": str(self.goods_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Lô 2",
            "lines": [{"goods_sale_line_id": str(sale_line.id), "return_quantity": "5", "warehouse_id": str(self.warehouse.id)}],
        }
        resp2 = self.client.post(url_create, payload2, format="json")
        self.assertEqual(resp2.status_code, 400)

        # Cancel Return 1 -> releases 6 units
        url_cancel = f"/api/v1/sales/sales-returns/{ret1_id}/cancel/?company_id={self.company.id}"
        resp_cancel = self.client.post(url_cancel, {"reason": "Hủy thỏa thuận trả"}, format="json")
        self.assertEqual(resp_cancel.status_code, 200)

        # Now Return 2 with 5 units succeeds
        resp2_retry = self.client.post(url_create, payload2, format="json")
        self.assertEqual(resp2_retry.status_code, 201)

    def test_05_post_attach_inward_creates_gl_and_inventory_and_receivable_offset(self):
        """BR-SAL-05-08, BR-SAL-05-09, BR-SAL-05-11: Post return creates balanced GL, inward inventory, and offsets receivable."""
        sale_line = self.goods_sale.lines.first()
        payload = {
            "company": str(self.company.id),
            "goods_sale": str(self.goods_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Lỗi phần cứng",
            "inventory_handling": "ATTACH_INWARD",
            "lines": [{"goods_sale_line_id": str(sale_line.id), "return_quantity": "4", "warehouse_id": str(self.warehouse.id)}],
        }
        url_create = f"/api/v1/sales/sales-returns/?company_id={self.company.id}"
        resp_create = self.client.post(url_create, payload, format="json")
        self.assertEqual(resp_create.status_code, 201)
        ret_id = resp_create.data["id"]

        # Post document
        url_post = f"/api/v1/sales/sales-returns/{ret_id}/post/?company_id={self.company.id}"
        resp_post = self.client.post(url_post, format="json")
        self.assertEqual(resp_post.status_code, 200)
        self.assertEqual(resp_post.data["status"], DocumentStatus.POSTED)

        ret = SalesReturn.objects.get(id=ret_id)
        # 1. Inward inventory transaction created
        self.assertTrue(ret.inventory_created)
        self.assertIsNotNone(ret.inventory_transaction)
        self.assertEqual(ret.inventory_transaction.transaction_type, "RETURN")
        self.assertEqual(ret.inventory_transaction.status, "POSTED")

        # 2. GL Entry created and balanced
        self.assertIsNotNone(ret.journal_entry)
        gl = ret.journal_entry
        self.assertEqual(gl.status, "POSTED")
        self.assertEqual(gl.total_debit, gl.total_credit)

        # Check GL lines: Debit 5212, Debit 33311, Credit 131; Debit 156, Credit 632
        lines = gl.lines.all()
        debit_5212 = sum(l.debit for l in lines if l.account_id == self.acc_5212.id)
        debit_33311 = sum(l.debit for l in lines if l.account_id == self.acc_33311.id)
        credit_131 = sum(l.credit for l in lines if l.account_id == self.acc_131.id)
        debit_156 = sum(l.debit for l in lines if l.account_id == self.acc_156.id)
        credit_632 = sum(l.credit for l in lines if l.account_id == self.acc_632.id)

        # Qty 4: subtotal = 80,000,000, discount = 4,000,000 -> net rev = 76,000,000
        self.assertEqual(debit_5212, Decimal("76000000"))
        # VAT = 7,600,000
        self.assertEqual(debit_33311, Decimal("76000000") * Decimal("0.10"))
        # Total = 83,600,000
        self.assertEqual(credit_131, Decimal("83600000"))
        # COGS = 4 * 15,000,000 = 60,000,000
        self.assertEqual(debit_156, Decimal("60000000"))
        self.assertEqual(credit_632, Decimal("60000000"))

        # 3. Receivable adjusted
        rec = Receivable.objects.get(id=self.goods_sale.receivable_id)
        # Original: 209,000,000 -> Adjusted: 83,600,000 -> Balance: 125,400,000
        self.assertEqual(rec.adjustment_amount, Decimal("83600000"))
        self.assertEqual(rec.balance, Decimal("125400000"))
        self.assertEqual(ret.refundable_amount, Decimal("0"))

    def test_06_final_return_rounding_exact_adjustment(self):
        """BR-SAL-05-04: Final return receives exact remaining discount and tax without rounding mismatch."""
        sale_line = self.goods_sale.lines.first()
        url_create = f"/api/v1/sales/sales-returns/?company_id={self.company.id}"

        # First return: 3 units
        payload1 = {
            "company": str(self.company.id),
            "goods_sale": str(self.goods_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Đợt 1",
            "lines": [{"goods_sale_line_id": str(sale_line.id), "return_quantity": "3", "warehouse_id": str(self.warehouse.id)}],
        }
        resp1 = self.client.post(url_create, payload1, format="json")
        ret1_id = resp1.data["id"]
        self.client.post(f"/api/v1/sales/sales-returns/{ret1_id}/post/?company_id={self.company.id}")

        # Second return: remaining 7 units (completes all 10 units)
        payload2 = {
            "company": str(self.company.id),
            "goods_sale": str(self.goods_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Đợt 2 - Trả hết",
            "lines": [{"goods_sale_line_id": str(sale_line.id), "return_quantity": "7", "warehouse_id": str(self.warehouse.id)}],
        }
        resp2 = self.client.post(url_create, payload2, format="json")
        self.assertEqual(resp2.status_code, 201)
        ret2_id = resp2.data["id"]
        resp_post2 = self.client.post(f"/api/v1/sales/sales-returns/{ret2_id}/post/?company_id={self.company.id}")
        self.assertEqual(resp_post2.status_code, 200)

        ret1 = SalesReturn.objects.get(id=ret1_id)
        ret2 = SalesReturn.objects.get(id=ret2_id)

        # Sum of discounts equals original discount exactly
        self.assertEqual(ret1.discount_amount + ret2.discount_amount, self.goods_sale.discount_amount)
        # Sum of taxes equals original tax exactly
        self.assertEqual(ret1.tax_amount + ret2.tax_amount, self.goods_sale.tax_amount)
        # Sum of totals equals original total exactly
        self.assertEqual(ret1.total_amount + ret2.total_amount, self.goods_sale.total_amount)

        # Receivable should now be fully paid/cleared
        rec = Receivable.objects.get(id=self.goods_sale.receivable_id)
        self.assertEqual(rec.balance, Decimal("0"))
        self.assertEqual(rec.status, ReceivableStatus.PAID)

    def test_07_post_link_existing_inward_and_no_inventory(self):
        """AF-03, AF-04, BR-SAL-05-10: Test LINK_EXISTING and NO_INVENTORY handling."""
        # 1. LINK_EXISTING
        existing_inward = InventoryTransaction.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.customer,
            number="NK-EXISTING-01",
            transaction_type="RETURN",
            transaction_date=self.today,
            destination_warehouse=self.warehouse,
            original_transaction=self.goods_sale.inventory_transaction,
            status="POSTED",
            created_by=self.user.iam_account,
        )
        sale_line = self.goods_sale.lines.first()
        payload_link = {
            "company": str(self.company.id),
            "goods_sale": str(self.goods_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Hàng đã nhập kho trước đó",
            "inventory_handling": "LINK_EXISTING",
            "inventory_transaction": str(existing_inward.id),
            "lines": [{"goods_sale_line_id": str(sale_line.id), "return_quantity": "2"}],
        }
        url_create = f"/api/v1/sales/sales-returns/?company_id={self.company.id}"
        resp_link = self.client.post(url_create, payload_link, format="json")
        self.assertEqual(resp_link.status_code, 201)
        ret_link_id = resp_link.data["id"]

        resp_post = self.client.post(f"/api/v1/sales/sales-returns/{ret_link_id}/post/?company_id={self.company.id}")
        self.assertEqual(resp_post.status_code, 200)

        ret_link = SalesReturn.objects.get(id=ret_link_id)
        self.assertFalse(ret_link.inventory_created)
        # GL should not include 156/632 lines since inventory was already processed
        lines = ret_link.journal_entry.lines.all()
        self.assertFalse(lines.filter(account_id=self.acc_156.id).exists())

        # 2. NO_INVENTORY on track_inventory item must be rejected
        payload_no_inv_fail = {
            "company": str(self.company.id),
            "goods_sale": str(self.goods_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Thử không quản lý kho trên hàng tồn kho",
            "inventory_handling": "NO_INVENTORY",
            "lines": [{"goods_sale_line_id": str(sale_line.id), "return_quantity": "1"}],
        }
        resp_no_inv_fail = self.client.post(url_create, payload_no_inv_fail, format="json")
        self.assertEqual(resp_no_inv_fail.status_code, 400)
        self.assertIn("theo dõi tồn kho", str(resp_no_inv_fail.data).lower())

    def test_08_customer_refund_for_excess_or_paid_sale(self):
        """AF-05, EF-07, BR-SAL-05-11: Refund action on posted return when paid upfront."""
        # Create a paid cash sale
        cash_sale = self._create_posted_goods_sale(payment_type="CASH", qty=Decimal("2"))
        cash_line = cash_sale.lines.first()

        payload = {
            "company": str(self.company.id),
            "goods_sale": str(cash_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Khách mua tiền mặt trả lại hàng",
            "inventory_handling": "ATTACH_INWARD",
            "lines": [{"goods_sale_line_id": str(cash_line.id), "return_quantity": "2", "warehouse_id": str(self.warehouse.id)}],
        }
        url_create = f"/api/v1/sales/sales-returns/?company_id={self.company.id}"
        resp_create = self.client.post(url_create, payload, format="json")
        self.assertEqual(resp_create.status_code, 201)
        ret_id = resp_create.data["id"]

        self.client.post(f"/api/v1/sales/sales-returns/{ret_id}/post/?company_id={self.company.id}")
        ret = SalesReturn.objects.get(id=ret_id)
        # Since cash sale had no receivable, full total is refundable
        self.assertEqual(ret.refundable_amount, ret.total_amount)
        self.assertEqual(ret.refunded_amount, Decimal("0"))

        # Refund part 1: 20,000,000
        url_refund = f"/api/v1/sales/sales-returns/{ret_id}/refund/?company_id={self.company.id}"
        resp_ref1 = self.client.post(url_refund, {"amount": "20000000", "payment_method": "CASH"}, format="json")
        self.assertEqual(resp_ref1.status_code, 200)

        ret.refresh_from_db()
        self.assertEqual(ret.refunded_amount, Decimal("20000000"))

        # Try to refund more than remaining -> EF-07 block
        excess_amount = (ret.refundable_amount - ret.refunded_amount) + Decimal("1000000")
        resp_excess = self.client.post(url_refund, {"amount": str(excess_amount), "payment_method": "CASH"}, format="json")
        self.assertEqual(resp_excess.status_code, 400)
        self.assertIn("vượt quá", str(resp_excess.data).lower())

    def test_09_approval_workflow_lifecycle(self):
        """AF-06, AF-07, BR-SAL-05-06: Approval lifecycle: submit, withdraw, request revision, approve, post."""
        sale_line = self.goods_sale.lines.first()
        payload = {
            "company": str(self.company.id),
            "goods_sale": str(self.goods_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Chờ duyệt",
            "lines": [{"goods_sale_line_id": str(sale_line.id), "return_quantity": "1", "warehouse_id": str(self.warehouse.id)}],
        }
        url_create = f"/api/v1/sales/sales-returns/?company_id={self.company.id}"
        resp_create = self.client.post(url_create, payload, format="json")
        ret_id = resp_create.data["id"]

        # Submit
        resp_sub = self.client.post(f"/api/v1/sales/sales-returns/{ret_id}/submit/?company_id={self.company.id}", {"notes": "Gửi duyệt"})
        self.assertEqual(resp_sub.status_code, 200)

        # Set to PENDING_APPROVAL to simulate active workflow
        ret = SalesReturn.objects.get(id=ret_id)
        ret.status = DocumentStatus.PENDING_APPROVAL
        ret.save(update_fields=["status"])

        # Withdraw
        resp_wd = self.client.post(f"/api/v1/sales/sales-returns/{ret_id}/withdraw/?company_id={self.company.id}", {"reason": "Cần sửa lại"})
        self.assertEqual(resp_wd.status_code, 200)
        self.assertEqual(resp_wd.data["status"], DocumentStatus.DRAFT)

        # Submit again & set PENDING_APPROVAL
        self.client.post(f"/api/v1/sales/sales-returns/{ret_id}/submit/?company_id={self.company.id}")
        ret.refresh_from_db()
        ret.status = DocumentStatus.PENDING_APPROVAL
        ret.save(update_fields=["status"])

        # Request revision
        resp_rev = self.client.post(
            f"/api/v1/sales/sales-returns/{ret_id}/request_revision/?company_id={self.company.id}",
            {"comment": "Bổ sung ảnh biên bản trả hàng"}
        )
        self.assertEqual(resp_rev.status_code, 200)
        self.assertEqual(resp_rev.data["status"], DocumentStatus.REVISION_REQUIRED)

        # Re-submit and approve
        self.client.post(f"/api/v1/sales/sales-returns/{ret_id}/submit/?company_id={self.company.id}")
        ret.refresh_from_db()
        ret.status = DocumentStatus.PENDING_APPROVAL
        ret.save(update_fields=["status"])

        resp_app = self.client.post(
            f"/api/v1/sales/sales-returns/{ret_id}/approve/?company_id={self.company.id}",
            {"comment": "Đồng ý nhận lại hàng"}
        )
        self.assertEqual(resp_app.status_code, 200)
        self.assertEqual(resp_app.data["status"], DocumentStatus.APPROVED)

    def test_10_optimistic_locking_and_unpost(self):
        """EF-08, BR-SAL-05-13: Optimistic locking on update, and unpost rollback."""
        sale_line = self.goods_sale.lines.first()
        payload = {
            "company": str(self.company.id),
            "goods_sale": str(self.goods_sale.id),
            "customer": str(self.customer.id),
            "return_reason": "Thử khóa lạc quan",
            "lines": [{"goods_sale_line_id": str(sale_line.id), "return_quantity": "1", "warehouse_id": str(self.warehouse.id)}],
        }
        url_create = f"/api/v1/sales/sales-returns/?company_id={self.company.id}"
        resp_create = self.client.post(url_create, payload, format="json")
        ret_id = resp_create.data["id"]

        # Modify with stale version -> EF-08 error
        url_update = f"/api/v1/sales/sales-returns/{ret_id}/?company_id={self.company.id}"
        stale_payload = {
            "version": 999,
            "return_reason": "Sửa phiên bản cũ",
            "lines": [{"goods_sale_line_id": str(sale_line.id), "return_quantity": "1", "warehouse_id": str(self.warehouse.id)}],
        }
        resp_update = self.client.patch(url_update, stale_payload, format="json")
        self.assertEqual(resp_update.status_code, 400)
        self.assertIn("vừa được người khác cập nhật", str(resp_update.data))

        # Post document
        self.client.post(f"/api/v1/sales/sales-returns/{ret_id}/post/?company_id={self.company.id}")
        ret = SalesReturn.objects.get(id=ret_id)
        self.assertEqual(ret.status, DocumentStatus.POSTED)
        rec_before = Receivable.objects.get(id=self.goods_sale.receivable_id)
        bal_before = rec_before.balance

        # Unpost
        url_unpost = f"/api/v1/sales/sales-returns/{ret_id}/unpost/?company_id={self.company.id}"
        resp_unpost = self.client.post(url_unpost, {"reason": "Bỏ ghi sổ để kiểm tra lại"}, format="json")
        self.assertEqual(resp_unpost.status_code, 200)
        self.assertEqual(resp_unpost.data["status"], DocumentStatus.DRAFT)

        ret.refresh_from_db()
        self.assertIsNone(ret.journal_entry)
        self.assertFalse(ret.inventory_created)
        rec_after = Receivable.objects.get(id=self.goods_sale.receivable_id)
        self.assertEqual(rec_after.balance, bal_before + ret.total_amount)
