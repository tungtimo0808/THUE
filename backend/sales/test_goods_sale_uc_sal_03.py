from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts_receivable.models import Receivable, ReceivableStatus
from audit_log.models import AuditLog
from general_ledger.models import Account, AccountBalance, AccountingPeriod, ChartOfAccounts, JournalEntry
from iam.models import CompanyMembership
from inventory.models import InventoryTransaction, InventoryTransactionLine, StockBalance
from master_data.models import (
    Bank, CompanyBankAccount, Currency, Item, Party, PartyAddress, PartyContact, PartyRole,
    PaymentTerm, TaxRate, UnitOfMeasure, Warehouse
)
from organization.models import Branch, Company, Employee
from sales.models import (
    ApprovalDecision, DocumentStatus, GoodsSale, GoodsSaleLine,
    SalesOrder, SalesOrderLine
)
from tax_management.models import InvoiceDirection, InvoiceStatus, TaxInvoice


class GoodsSaleUcSal03Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.client = APIClient()

        # Currency
        self.currency = Currency.objects.get(code="VND")

        # Company & Branch
        self.company = Company.objects.create(
            code="SAL03_CO",
            name="Sales Goods Co",
            legal_name="Sales Goods Company Ltd",
            tax_code="0109988775",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(
            company=self.company,
            code="CN1",
            name="Chi nhánh Sài Gòn",
            status="ACTIVE",
        )

        # Users
        self.user = get_user_model().objects.create_superuser(
            username="sal_user", email="sal_user@example.com", password="password123"
        )
        self.client.force_authenticate(user=self.user)

        # Employee & Membership
        self.employee = Employee.objects.create(
            company=self.company,
            employee_code="NV002",
            full_name="Nguyễn Kế Toán Bán Hàng",
            email="nv002@example.com",
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
            code="CUST_SAL03",
            name="Công Ty TNHH Mua Hàng Alpha",
            tax_code="0399887766",
            default_currency=self.currency,
            status="ACTIVE",
        )
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)
        self.customer_address = PartyAddress.objects.create(
            party=self.customer,
            address_type="DELIVERY",
            address_line="789 Đường Lê Duẩn, Quận 1, TP. HCM",
            is_default=True,
        )
        self.customer_contact = PartyContact.objects.create(
            party=self.customer,
            contact_name="Lê Văn Khách",
            phone="0912345678",
            email="khach@alpha.vn",
            status="ACTIVE",
            is_default=True,
        )

        # Payment Term
        self.payment_term = PaymentTerm.objects.create(
            company=self.company,
            code="NET15",
            name="Thanh toán trong 15 ngày",
            scope="SALE",
            due_days=15,
            status="ACTIVE",
        )
        self.customer.payment_term = self.payment_term
        self.customer.save(update_fields=["payment_term"])

        # Bank & Bank Account
        self.bank = Bank.objects.create(code="TCB", name="Techcombank")
        self.bank_account = CompanyBankAccount.objects.create(
            company=self.company,
            account_number="1903888999001",
            account_name="Tài khoản thanh toán VND",
            bank=self.bank,
            bank_branch="Chi nhánh Sài Gòn",
            currency=self.currency,
            status="ACTIVE",
        )

        # UOM
        self.uom_cai = UnitOfMeasure.objects.create(
            company=self.company, code="CAI", name="Cái", decimal_places=0, status="ACTIVE"
        )

        # Tax Rates
        self.vat10 = TaxRate.objects.create(
            company=self.company,
            code="VAT10",
            name="Thuế GTGT 10%",
            tax_type="VAT",
            rate_percent=Decimal("10"),
            application_form="PERCENT",
            effective_from=self.today - timedelta(days=30),
            business_scope="OUTPUT",
            status="ACTIVE",
        )
        self.vat0 = TaxRate.objects.create(
            company=self.company,
            code="VAT0",
            name="Thuế GTGT 0%",
            tax_type="VAT",
            rate_percent=Decimal("0"),
            application_form="PERCENT",
            effective_from=self.today - timedelta(days=30),
            business_scope="OUTPUT",
            status="ACTIVE",
        )

        # Warehouse
        self.warehouse = Warehouse.objects.create(
            company=self.company,
            branch=self.branch,
            code="KHO_TONG",
            name="Kho Tổng Hàng Hóa",
            status="ACTIVE",
        )

        # Chart of Accounts & GL Accounts
        chart = ChartOfAccounts.objects.create(
            company=self.company, code="COA_SAL03", name="Hệ thống tài khoản", effective_from=self.today
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
            company=self.company, chart_of_accounts=chart, code="1121", name="Tiền gửi ngân hàng VND",
            account_type="ASSET", is_postable=True, status="ACTIVE"
        )
        self.acc_511 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="5111", name="Doanh thu bán hàng hóa",
            account_type="REVENUE", is_postable=True, status="ACTIVE"
        )
        self.acc_3331 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="33311", name="Thuế GTGT đầu ra phải nộp",
            account_type="LIABILITY", is_postable=True, status="ACTIVE"
        )
        self.acc_632 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="632", name="Giá vốn hàng bán",
            account_type="EXPENSE", is_postable=True, status="ACTIVE"
        )
        self.acc_156 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="1561", name="Giá mua hàng hóa",
            account_type="ASSET", is_postable=True, status="ACTIVE", requires_warehouse=True
        )


        # Accounting Period (Open)
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date=self.today - timedelta(days=15),
            end_date=self.today + timedelta(days=15),
            status="OPEN",
        )

        # Items
        # 1. Standard Goods Item (Tracks inventory)
        self.item_goods = Item.objects.create(
            company=self.company,
            code="HH01",
            name="Điện thoại thông minh X",
            item_type="GOODS",
            base_uom=self.uom_cai,
            sales_uom=self.uom_cai,
            sales_price=Decimal("10000000"),
            sales_tax_rate=self.vat10,
            track_inventory=True,
            revenue_account=self.acc_511,
            cogs_account=self.acc_632,
            inventory_account=self.acc_156,
            allow_sale=True,
            status="ACTIVE",
        )

        # 2. Goods Item without inventory tracking
        self.item_no_inv = Item.objects.create(
            company=self.company,
            code="HH_EBOOK",
            name="Sách điện tử Ebook",
            item_type="GOODS",
            base_uom=self.uom_cai,
            sales_uom=self.uom_cai,
            sales_price=Decimal("200000"),
            sales_tax_rate=self.vat0,
            track_inventory=False,
            revenue_account=self.acc_511,
            allow_sale=True,
            status="ACTIVE",
        )

        # 3. Service Item (Must be rejected)
        self.item_service = Item.objects.create(
            company=self.company,
            code="DV01",
            name="Dịch vụ bảo hành mở rộng",
            item_type="SERVICE",
            base_uom=self.uom_cai,
            sales_uom=self.uom_cai,
            sales_price=Decimal("500000"),
            sales_tax_rate=self.vat10,
            track_inventory=False,
            allow_sale=True,
            status="ACTIVE",
        )

        # Stock balance: 50 units with average cost 6,000,000 VND
        StockBalance.objects.create(
            company=self.company,
            warehouse=self.warehouse,
            item=self.item_goods,
            quantity=Decimal("50"),
            inventory_value=Decimal("300000000"),
            average_cost=Decimal("6000000"),
        )

        self.base_url = f"/api/v1/sales/goods-sales/?company_id={self.company.pk}"

    def build_payload(self, **kwargs):
        payload = {
            "company": str(self.company.pk),
            "branch": str(self.branch.pk) if self.branch else None,
            "customer": str(self.customer.pk),
            "customer_address": self.customer_address.address_line,
            "customer_tax_code": self.customer.tax_code,
            "document_date": str(self.today),
            "posting_date": str(self.today),
            "currency": str(self.currency.pk),
            "exchange_rate": "1",
            "payment_type": GoodsSale.PaymentType.UNPAID,
            "inventory_handling": GoodsSale.InventoryHandling.ATTACH_ISSUE,
            "description": "Bán hàng hóa thoại X cho Alpha",
            "lines": [
                {
                    "item": str(self.item_goods.pk),
                    "uom": str(self.uom_cai.pk),
                    "warehouse": str(self.warehouse.pk),
                    "quantity": "5.000000",
                    "unit_price": "10000000.0000",
                    "discount_rate": "10.0000",
                    "tax_rate": str(self.vat10.pk),
                }
            ],
        }
        payload.update(kwargs)
        return payload

    def test_01_defaults_endpoint_and_prefill(self):
        """Test defaults endpoint returns prefilled dates, accounts, and customer payment terms."""
        url = f"/api/v1/sales/goods-sales/defaults/?company_id={self.company.pk}&customer_id={self.customer.pk}"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["payment_type"], GoodsSale.PaymentType.UNPAID)
        self.assertEqual(res.data["inventory_handling"], GoodsSale.InventoryHandling.ATTACH_ISSUE)
        self.assertEqual(res.data["customer_tax_code"], self.customer.tax_code)
        self.assertEqual(res.data["payment_term"], str(self.payment_term.pk))
        # Due date should be today + 15 days
        expected_due = (self.today + timedelta(days=15)).isoformat()
        self.assertEqual(res.data["due_date"], expected_due)
        self.assertIn("default_accounts", res.data)
        self.assertEqual(res.data["default_accounts"]["revenue_account"], str(self.acc_511.pk))

    def test_02_create_draft_goods_sale_and_amount_calculations(self):
        """Test draft creation: number generation, precision calculation, discounts and taxes (BR-SAL-03-04)."""
        payload = self.build_payload()
        res = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)

        sale_id = res.data["id"]
        sale = GoodsSale.objects.get(pk=sale_id)
        self.assertTrue(sale.number.startswith(f"BH-{self.today.year}-"))
        self.assertEqual(sale.status, DocumentStatus.DRAFT)

        # 5 * 10,000,000 = 50,000,000
        # Discount 10% = 5,000,000
        # Net = 45,000,000
        # Tax 10% = 4,500,000
        # Total = 49,500,000
        self.assertEqual(sale.subtotal, Decimal("50000000.0000"))
        self.assertEqual(sale.discount_amount, Decimal("5000000.0000"))
        self.assertEqual(sale.tax_amount, Decimal("4500000.0000"))
        self.assertEqual(sale.total_amount, Decimal("49500000.0000"))

        line = sale.lines.first()
        self.assertEqual(line.line_total, Decimal("49500000.0000"))
        # COGS calculation: 5 * 6,000,000 = 30,000,000
        self.assertEqual(line.unit_cost, Decimal("6000000.0000"))
        self.assertEqual(line.cogs_amount, Decimal("30000000.0000"))

    def test_separate_issue_sale_posts_without_reducing_stock_or_duplicate_cogs(self):
        payload = self.build_payload(inventory_handling=GoodsSale.InventoryHandling.SEPARATE_ISSUE)
        payload["lines"][0].pop("warehouse", None)
        created = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        pk = created.data["id"]
        detail = f"/api/v1/sales/goods-sales/{pk}/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(detail.replace("/?", "/submit/?"), {}, format="json").status_code, 200)
        self.assertEqual(self.client.post(detail.replace("/?", "/approve/?"), {"comment": "OK"}, format="json").status_code, 200)
        posted = self.client.post(detail.replace("/?", "/post/?"), {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        self.assertEqual(posted.data["inventory_handling"], "SEPARATE_ISSUE")
        self.assertIsNone(posted.data["inventory_transaction"])
        self.assertFalse(posted.data["inventory_created"])
        self.assertEqual(StockBalance.objects.get(company=self.company, warehouse=self.warehouse, item=self.item_goods).quantity, Decimal("50"))

    def test_03_reject_service_item_and_invalid_data(self):
        """BR-SAL-03-02: Only GOODS items allowed; services and invalid quantities rejected."""
        # 1. Attempt to sell a SERVICE item
        payload = self.build_payload(lines=[{
            "item": str(self.item_service.pk),
            "uom": str(self.uom_cai.pk),
            "quantity": "1.000000",
            "unit_price": "500000.0000",
        }])
        res = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("Hàng hóa", str(res.data))

        # 2. Attempt with quantity <= 0
        payload_qty = self.build_payload(lines=[{
            "item": str(self.item_goods.pk),
            "uom": str(self.uom_cai.pk),
            "warehouse": str(self.warehouse.pk),
            "quantity": "0.000000",
            "unit_price": "10000000.0000",
        }])
        res_qty = self.client.post(self.base_url, payload_qty, format="json")
        self.assertEqual(res_qty.status_code, 400)

        # 3. ATTACH_ISSUE without warehouse
        payload_no_wh = self.build_payload(lines=[{
            "item": str(self.item_goods.pk),
            "uom": str(self.uom_cai.pk),
            "quantity": "2.000000",
            "unit_price": "10000000.0000",
        }])
        res_no_wh = self.client.post(self.base_url, payload_no_wh, format="json")
        self.assertEqual(res_no_wh.status_code, 400)
        self.assertIn("kho", str(res_no_wh.data).lower())

    def test_04_no_inventory_handling_validation(self):
        """AF-05: NO_INVENTORY only allowed for non-inventory tracked goods."""
        # Attempt NO_INVENTORY with item_goods (track_inventory = True) -> Fails
        payload_fail = self.build_payload(
            inventory_handling=GoodsSale.InventoryHandling.NO_INVENTORY,
            lines=[{
                "item": str(self.item_goods.pk),
                "uom": str(self.uom_cai.pk),
                "quantity": "1.000000",
                "unit_price": "10000000.0000",
            }]
        )
        res_fail = self.client.post(self.base_url, payload_fail, format="json")
        self.assertEqual(res_fail.status_code, 400)
        self.assertIn("Không quản lý kho", str(res_fail.data))

        # Succeeded with item_no_inv (track_inventory = False)
        payload_ok = self.build_payload(
            inventory_handling=GoodsSale.InventoryHandling.NO_INVENTORY,
            lines=[{
                "item": str(self.item_no_inv.pk),
                "uom": str(self.uom_cai.pk),
                "quantity": "1.000000",
                "unit_price": "200000.0000",
            }]
        )
        res_ok = self.client.post(self.base_url, payload_ok, format="json")
        self.assertEqual(res_ok.status_code, 201)
        sale = GoodsSale.objects.get(pk=res_ok.data["id"])
        self.assertEqual(sale.inventory_handling, GoodsSale.InventoryHandling.NO_INVENTORY)

    def test_05_optimistic_locking_and_deletion(self):
        """BR-SAL-03-13, EF-08: Test optimistic locking version mismatch and draft deletion."""
        payload = self.build_payload()
        res = self.client.post(self.base_url, payload, format="json")
        sale_id = res.data["id"]
        detail_url = f"/api/v1/sales/goods-sales/{sale_id}/?company_id={self.company.pk}"

        # 1. Update with wrong version
        payload["version"] = 99
        res_update = self.client.put(detail_url, payload, format="json")
        self.assertEqual(res_update.status_code, 400)
        self.assertIn("người khác cập nhật", str(res_update.data))

        # 2. Update with correct version
        payload["version"] = 1
        payload["description"] = "Cập nhật diễn giải"
        res_update_ok = self.client.put(detail_url, payload, format="json")
        self.assertEqual(res_update_ok.status_code, 200)
        self.assertEqual(res_update_ok.data["version"], 2)

        # 3. Delete draft document
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, 204)
        self.assertFalse(GoodsSale.objects.filter(pk=sale_id).exists())

    def test_06_workflow_submission_withdraw_approve_reject(self):
        """Test workflow lifecycle: submit -> withdraw -> resubmit -> approve/reject."""
        payload = self.build_payload()
        res = self.client.post(self.base_url, payload, format="json")
        sale_id = res.data["id"]
        detail_url = f"/api/v1/sales/goods-sales/{sale_id}/?company_id={self.company.pk}"

        # Submit
        res_submit = self.client.post(f"{detail_url}&action=submit".replace("?", "submit/?"), {"comment": "Trình duyệt"}, format="json")
        self.assertEqual(res_submit.status_code, 200)
        self.assertEqual(res_submit.data["status"], DocumentStatus.PENDING_APPROVAL)

        # Withdraw
        res_withdraw = self.client.post(f"{detail_url}&action=withdraw".replace("?", "withdraw/?"), {"reason": "Cần sửa lại giá"}, format="json")
        self.assertEqual(res_withdraw.status_code, 200)
        self.assertEqual(res_withdraw.data["status"], DocumentStatus.DRAFT)

        # Resubmit
        self.client.post(f"{detail_url}&action=submit".replace("?", "submit/?"), {"comment": "Trình duyệt lại"}, format="json")

        # Request Revision
        res_rev = self.client.post(f"{detail_url}&action=rev".replace("?", "request-revision/?"), {"reason": "Giảm bớt chiết khấu"}, format="json")
        self.assertEqual(res_rev.status_code, 200)
        self.assertEqual(res_rev.data["status"], DocumentStatus.REVISION_REQUIRED)

        # Submit again
        self.client.post(f"{detail_url}&action=submit".replace("?", "submit/?"), {"comment": "Đã sửa chiết khấu"}, format="json")

        # Approve
        res_app = self.client.post(f"{detail_url}&action=app".replace("?", "approve/?"), {"comment": "Đồng ý phê duyệt"}, format="json")
        self.assertEqual(res_app.status_code, 200)
        self.assertEqual(res_app.data["status"], DocumentStatus.APPROVED)

    def test_07_post_unpaid_sales_with_attach_issue_creates_gl_and_ar(self):
        """Posting UNPAID + ATTACH_ISSUE: creates balanced GL, updates stock, registers Receivable."""
        payload = self.build_payload()
        res = self.client.post(self.base_url, payload, format="json")
        sale_id = res.data["id"]
        detail_url = f"/api/v1/sales/goods-sales/{sale_id}/?company_id={self.company.pk}"

        # Approve
        self.client.post(f"{detail_url}&action=submit".replace("?", "submit/?"), format="json")
        self.client.post(f"{detail_url}&action=app".replace("?", "approve/?"), format="json")

        # Initial stock quantity is 50
        bal_before = StockBalance.objects.get(company=self.company, warehouse=self.warehouse, item=self.item_goods)
        self.assertEqual(bal_before.quantity, Decimal("50"))

        # Post
        res_post = self.client.post(f"{detail_url}&action=post".replace("?", "post/?"), format="json")
        self.assertEqual(res_post.status_code, 200, res_post.data)
        self.assertEqual(res_post.data["status"], DocumentStatus.POSTED)

        sale = GoodsSale.objects.get(pk=sale_id)
        self.assertEqual(sale.status, DocumentStatus.POSTED)
        self.assertIsNotNone(sale.posted_at)

        # 1. Check GL JournalEntry
        journal = sale.journal_entry
        self.assertIsNotNone(journal)
        self.assertEqual(journal.status, "POSTED")
        # Total debit = 49,500,000 (sale) + 30,000,000 (cogs) = 79,500,000
        self.assertEqual(journal.total_debit, Decimal("79500000.0000"))
        self.assertEqual(journal.total_credit, Decimal("79500000.0000"))

        # Verify debits and credits
        debit_lines = journal.lines.filter(debit__gt=0)
        credit_lines = journal.lines.filter(credit__gt=0)
        self.assertEqual(debit_lines.filter(account=self.acc_131).first().debit, Decimal("49500000.0000"))
        self.assertEqual(debit_lines.filter(account=self.acc_632).first().debit, Decimal("30000000.0000"))
        self.assertEqual(credit_lines.filter(account=self.acc_511).first().credit, Decimal("45000000.0000"))
        self.assertEqual(credit_lines.filter(account=self.acc_3331).first().credit, Decimal("4500000.0000"))
        self.assertEqual(credit_lines.filter(account=self.acc_156).first().credit, Decimal("30000000.0000"))

        # 2. Check Accounts Receivable
        rec = sale.receivable
        self.assertIsNotNone(rec)
        self.assertEqual(rec.customer, self.customer)
        self.assertEqual(rec.original_amount, Decimal("49500000.0000"))
        self.assertEqual(rec.balance, Decimal("49500000.0000"))
        self.assertEqual(rec.status, ReceivableStatus.OPEN)

        # 3. Check Inventory issue transaction and stock balance
        issue = sale.inventory_transaction
        self.assertIsNotNone(issue)
        self.assertEqual(issue.transaction_type, "ISSUE")
        self.assertEqual(issue.status, "POSTED")

        bal_after = StockBalance.objects.get(company=self.company, warehouse=self.warehouse, item=self.item_goods)
        # 50 - 5 = 45 units remaining
        self.assertEqual(bal_after.quantity, Decimal("45"))

        # 4. Direct update or cancellation of POSTED document must be blocked (EF-10)
        res_block_edit = self.client.put(detail_url, payload, format="json")
        self.assertEqual(res_block_edit.status_code, 400)
        self.assertIn("Đã ghi sổ", str(res_block_edit.data))

        res_block_cancel = self.client.post(f"{detail_url}&action=cancel".replace("?", "cancel/?"), {"reason": "Hủy"}, format="json")
        self.assertEqual(res_block_cancel.status_code, 400)

        # 5. Unpost restores everything cleanly
        res_unpost = self.client.post(f"{detail_url}&action=unpost".replace("?", "unpost/?"), {"reason": "Bỏ ghi sổ kiểm tra"}, format="json")
        self.assertEqual(res_unpost.status_code, 200, res_unpost.data)
        self.assertEqual(res_unpost.data["status"], DocumentStatus.APPROVED)

        sale.refresh_from_db()
        self.assertIsNone(sale.journal_entry)
        self.assertIsNone(sale.receivable)

        bal_restored = StockBalance.objects.get(company=self.company, warehouse=self.warehouse, item=self.item_goods)
        self.assertEqual(bal_restored.quantity, Decimal("50"))

    def test_08_post_cash_and_bank_payment(self):
        """AF-03: Cash and Bank direct payment debits 111 / 112 directly, does not create Receivable."""
        # 1. CASH
        payload_cash = self.build_payload(
            payment_type=GoodsSale.PaymentType.CASH,
            inventory_handling=GoodsSale.InventoryHandling.NO_INVENTORY,
            lines=[{
                "item": str(self.item_no_inv.pk),
                "uom": str(self.uom_cai.pk),
                "quantity": "2.000000",
                "unit_price": "200000.0000",
            }]
        )
        res_cash = self.client.post(self.base_url, payload_cash, format="json")
        sale_cash_id = res_cash.data["id"]
        detail_cash = f"/api/v1/sales/goods-sales/{sale_cash_id}/?company_id={self.company.pk}"
        self.client.post(f"{detail_cash}&action=sub".replace("?", "submit/?"), format="json")
        self.client.post(f"{detail_cash}&action=app".replace("?", "approve/?"), format="json")
        res_post_cash = self.client.post(f"{detail_cash}&action=post".replace("?", "post/?"), format="json")
        self.assertEqual(res_post_cash.status_code, 200)

        sale_cash = GoodsSale.objects.get(pk=sale_cash_id)
        self.assertIsNone(sale_cash.receivable)  # No uncollected receivable!
        debit_line = sale_cash.journal_entry.lines.filter(debit__gt=0).first()
        self.assertEqual(debit_line.account, self.acc_111)

        # 2. BANK
        payload_bank = self.build_payload(
            payment_type=GoodsSale.PaymentType.BANK,
            company_bank_account=str(self.bank_account.pk),
            inventory_handling=GoodsSale.InventoryHandling.NO_INVENTORY,
            lines=[{
                "item": str(self.item_no_inv.pk),
                "uom": str(self.uom_cai.pk),
                "quantity": "1.000000",
                "unit_price": "200000.0000",
            }]
        )
        res_bank = self.client.post(self.base_url, payload_bank, format="json")
        sale_bank_id = res_bank.data["id"]
        detail_bank = f"/api/v1/sales/goods-sales/{sale_bank_id}/?company_id={self.company.pk}"
        self.client.post(f"{detail_bank}&action=sub".replace("?", "submit/?"), format="json")
        self.client.post(f"{detail_bank}&action=app".replace("?", "approve/?"), format="json")
        res_post_bank = self.client.post(f"{detail_bank}&action=post".replace("?", "post/?"), format="json")
        self.assertEqual(res_post_bank.status_code, 200)

        sale_bank = GoodsSale.objects.get(pk=sale_bank_id)
        self.assertIsNone(sale_bank.receivable)
        debit_bank = sale_bank.journal_entry.lines.filter(debit__gt=0).first()
        self.assertEqual(debit_bank.account, self.acc_112)
        self.assertEqual(debit_bank.dimensions.get("bank_account"), str(self.bank_account.pk))

    def test_09_prepare_and_link_from_sales_order(self):
        """AF-02, BR-SAL-03-03: Inherit from SalesOrder and track quantity."""
        order = SalesOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="SO-2026-000099",
            document_date=self.today,
            customer=self.customer,
            currency=self.currency,
            status=DocumentStatus.APPROVED,
            subtotal=Decimal("30000000"),
            total_amount=Decimal("33000000"),
            created_by=self.user.iam_account,
        )
        order_line = SalesOrderLine.objects.create(
            order=order,
            line_no=1,
            item=self.item_goods,
            uom=self.uom_cai,
            warehouse=self.warehouse,
            quantity=Decimal("3"),
            unit_price=Decimal("10000000"),
            tax_rate=self.vat10,
        )

        # 1. Call prepare-from-order endpoint
        prep_url = f"/api/v1/sales/goods-sales/prepare-from-order/?company_id={self.company.pk}&order_id={order.pk}"
        res_prep = self.client.get(prep_url)
        self.assertEqual(res_prep.status_code, 200, res_prep.data)
        self.assertEqual(res_prep.data["sales_order"], str(order.pk))
        self.assertEqual(len(res_prep.data["lines"]), 1)
        self.assertEqual(res_prep.data["lines"][0]["order_line"], str(order_line.pk))
        self.assertEqual(Decimal(res_prep.data["lines"][0]["quantity"]), Decimal("3"))

        # 2. Create goods sale linked to this order line
        payload = self.build_payload(
            sales_order=str(order.pk),
            lines=[{
                "order_line": str(order_line.pk),
                "item": str(self.item_goods.pk),
                "uom": str(self.uom_cai.pk),
                "warehouse": str(self.warehouse.pk),
                "quantity": "2.000000",
                "unit_price": "10000000.0000",
                "tax_rate": str(self.vat10.pk),
            }]
        )
        res_sale = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res_sale.status_code, 201)

        # 3. Next prepare call should only show remaining 1 unit!
        res_prep2 = self.client.get(prep_url)
        self.assertEqual(res_prep2.status_code, 200)
        self.assertEqual(Decimal(res_prep2.data["lines"][0]["quantity"]), Decimal("1"))

        # 4. Attempt to create another sale exceeding remaining quantity -> Fails (EF-06)
        payload_exceed = self.build_payload(
            sales_order=str(order.pk),
            lines=[{
                "order_line": str(order_line.pk),
                "item": str(self.item_goods.pk),
                "uom": str(self.uom_cai.pk),
                "warehouse": str(self.warehouse.pk),
                "quantity": "2.000000",  # Only 1 left!
                "unit_price": "10000000.0000",
            }]
        )
        sale_exceed = self.client.post(self.base_url, payload_exceed, format="json")
        detail_exceed = f"/api/v1/sales/goods-sales/{sale_exceed.data['id']}/?company_id={self.company.pk}"
        self.client.post(f"{detail_exceed}&action=sub".replace("?", "submit/?"), format="json")
        self.client.post(f"{detail_exceed}&action=app".replace("?", "approve/?"), format="json")
        res_post_exceed = self.client.post(f"{detail_exceed}&action=post".replace("?", "post/?"), format="json")
        self.assertEqual(res_post_exceed.status_code, 400)
        self.assertIn("vượt phần còn lại của đơn hàng", str(res_post_exceed.data))

    def test_10_link_tax_invoice(self):
        """AF-09, BR-SAL-03-11, EF-07: Linking tax invoice validates customer & amount without re-posting revenue."""
        payload = self.build_payload()
        res = self.client.post(self.base_url, payload, format="json")
        sale_id = res.data["id"]
        detail_url = f"/api/v1/sales/goods-sales/{sale_id}/?company_id={self.company.pk}"

        # Create output tax invoice with matching amount (49,500,000)
        inv = TaxInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            direction=InvoiceDirection.OUTPUT,
            invoice_series="1C26TAA",
            invoice_number="0001234",
            invoice_date=self.today,
            seller_name=self.company.name,
            seller_tax_code=self.company.tax_code,
            buyer_name=self.customer.name,
            party=self.customer,
            currency=self.currency,
            subtotal=Decimal("45000000"),
            tax_amount=Decimal("4500000"),
            total_amount=Decimal("49500000"),
            status=InvoiceStatus.ISSUED,
            created_by=self.user.iam_account,
        )

        link_url = f"{detail_url}&action=link".replace("?", "link-invoice/?")
        res_link = self.client.post(link_url, {"tax_invoice": str(inv.pk), "notes": "Hóa đơn điện tử M-Invoice"}, format="json")
        self.assertEqual(res_link.status_code, 200, res_link.data)
        self.assertEqual(str(res_link.data["tax_invoice"]), str(inv.pk))

        # Test amount mismatch exception (EF-07)
        inv_mismatch = TaxInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            direction=InvoiceDirection.OUTPUT,
            invoice_series="1C26TAA",
            invoice_number="0001235",
            invoice_date=self.today,
            seller_name=self.company.name,
            seller_tax_code=self.company.tax_code,
            buyer_name=self.customer.name,
            party=self.customer,
            currency=self.currency,
            subtotal=Decimal("10000000"),
            tax_amount=Decimal("1000000"),
            total_amount=Decimal("11000000"),  # Mismatched!
            status=InvoiceStatus.ISSUED,
            created_by=self.user.iam_account,
        )
        res_link_bad = self.client.post(link_url, {"tax_invoice": str(inv_mismatch.pk)}, format="json")
        self.assertEqual(res_link_bad.status_code, 400)
        self.assertIn("không khớp", str(res_link_bad.data))
