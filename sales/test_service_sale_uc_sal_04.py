from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts_receivable.models import Receivable, ReceivableStatus
from general_ledger.models import Account, AccountBalance, AccountingPeriod, ChartOfAccounts, JournalEntry
from iam.models import CompanyMembership
from master_data.models import (
    Bank, CompanyBankAccount, Currency, Item, Party, PartyAddress, PartyContact, PartyRole,
    PaymentTerm, TaxRate, UnitOfMeasure
)
from organization.models import Branch, Company, Employee
from sales.models import (
    DocumentStatus, SalesOrder, SalesOrderLine,
    ServiceSale, ServiceSaleLine
)
from tax_management.models import InvoiceDirection, InvoiceStatus, TaxInvoice


class ServiceSaleUcSal04Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.client = APIClient()

        # Currency
        self.currency = Currency.objects.get(code="VND")

        # Company & Branch
        self.company = Company.objects.create(
            code="SAL04_CO",
            name="Sales Service Co",
            legal_name="Sales Service Company Ltd",
            tax_code="0109988774",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(
            company=self.company,
            code="CN_SERVICE",
            name="Chi nhánh Dịch Vụ",
            status="ACTIVE",
        )

        # Users
        self.user = get_user_model().objects.create_superuser(
            username="service_user", email="service_user@example.com", password="password123"
        )
        self.client.force_authenticate(user=self.user)

        # Employee & Membership
        self.employee = Employee.objects.create(
            company=self.company,
            employee_code="NV_SERV",
            full_name="Nguyễn Chuyên Viên Dịch Vụ",
            email="nv_serv@example.com",
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
            code="CUST_SERVICE_01",
            name="Công Ty Cổ Phần Công Nghệ Beta",
            tax_code="0399881122",
            default_currency=self.currency,
            status="ACTIVE",
        )
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)
        self.customer_address = PartyAddress.objects.create(
            party=self.customer,
            address_type="OFFICE",
            address_line="456 Đường Nguyễn Thị Minh Khai, Quận 3, TP. HCM",
            is_default=True,
        )
        self.customer_contact = PartyContact.objects.create(
            party=self.customer,
            contact_name="Hoàng Thu Hà",
            phone="0988776655",
            email="ha.hoang@beta.vn",
            status="ACTIVE",
            is_default=True,
        )

        # Payment Term (NET30)
        self.payment_term = PaymentTerm.objects.create(
            company=self.company,
            code="NET30_SERV",
            name="Thanh toán 30 ngày sau nghiệm thu",
            scope="SALE",
            due_days=30,
            status="ACTIVE",
        )
        self.customer.payment_term = self.payment_term
        self.customer.save(update_fields=["payment_term"])

        # Bank & Bank Account
        self.bank = Bank.objects.create(code="VCB", name="Vietcombank")
        self.bank_account = CompanyBankAccount.objects.create(
            company=self.company,
            account_number="0071001234567",
            account_name="TK Dịch vụ Vietcombank",
            bank=self.bank,
            currency=self.currency,
            status="ACTIVE",
        )

        # UOM
        self.uom_gio = UnitOfMeasure.objects.create(
            company=self.company, code="GIO", name="Giờ", decimal_places=0, status="ACTIVE"
        )
        self.uom_goi = UnitOfMeasure.objects.create(
            company=self.company, code="GOI", name="Gói", decimal_places=0, status="ACTIVE"
        )

        # Tax Rates
        self.vat10 = TaxRate.objects.create(
            company=self.company,
            code="VAT10_SERV",
            name="Thuế GTGT dịch vụ 10%",
            tax_type="VAT",
            rate_percent=Decimal("10"),
            application_form="PERCENT",
            effective_from=self.today - timedelta(days=30),
            business_scope="OUTPUT",
            status="ACTIVE",
        )
        self.vat0 = TaxRate.objects.create(
            company=self.company,
            code="VAT0_SERV",
            name="Thuế GTGT 0%",
            tax_type="VAT",
            rate_percent=Decimal("0"),
            application_form="PERCENT",
            effective_from=self.today - timedelta(days=30),
            business_scope="OUTPUT",
            status="ACTIVE",
        )

        # Chart of Accounts & GL Accounts
        chart = ChartOfAccounts.objects.create(
            company=self.company, code="COA_SAL04", name="Hệ thống tài khoản dịch vụ", effective_from=self.today
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
        self.acc_5113 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="5113", name="Doanh thu cung cấp dịch vụ",
            account_type="REVENUE", is_postable=True, status="ACTIVE"
        )
        self.acc_3331 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="33311", name="Thuế GTGT đầu ra phải nộp",
            account_type="LIABILITY", is_postable=True, status="ACTIVE"
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

        # Services
        # 1. Standard Service Item (Requires acceptance)
        self.service_consulting = Item.objects.create(
            company=self.company,
            code="DV_TV",
            name="Dịch vụ tư vấn giải pháp CNTT",
            item_type="SERVICE",
            base_uom=self.uom_gio,
            sales_uom=self.uom_gio,
            sales_price=Decimal("1500000"),
            sales_tax_rate=self.vat10,
            track_inventory=False,
            requires_service_acceptance=True,
            revenue_account=self.acc_5113,
            allow_sale=True,
            status="ACTIVE",
        )

        # 2. Package Service Item (No acceptance required)
        self.service_package = Item.objects.create(
            company=self.company,
            code="DV_GOI",
            name="Gói dịch vụ bảo trì phần mềm 1 năm",
            item_type="SERVICE",
            base_uom=self.uom_goi,
            sales_uom=self.uom_goi,
            sales_price=Decimal("12000000"),
            sales_tax_rate=self.vat10,
            track_inventory=False,
            requires_service_acceptance=False,
            revenue_account=self.acc_5113,
            allow_sale=True,
            status="ACTIVE",
        )

        # 3. Goods Item (Should be rejected in ServiceSale)
        self.item_goods = Item.objects.create(
            company=self.company,
            code="HH_MAY_TINH",
            name="Máy tính xách tay Dell",
            item_type="GOODS",
            base_uom=self.uom_goi,
            sales_uom=self.uom_goi,
            sales_price=Decimal("20000000"),
            track_inventory=True,
            allow_sale=True,
            status="ACTIVE",
        )

        self.base_url = f"/api/v1/sales/service-sales/?company_id={self.company.pk}"

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
            "payment_type": ServiceSale.PaymentType.UNPAID,
            "service_acceptance_required": True,
            "acceptance_document_number": "BB-NT-2026-001",
            "acceptance_date": str(self.today),
            "description": "Cung cấp dịch vụ tư vấn giải pháp cho Beta",
            "lines": [
                {
                    "item": str(self.service_consulting.pk),
                    "uom": str(self.uom_gio.pk),
                    "quantity": "10.000000",
                    "unit_price": "1500000.0000",
                    "discount_rate": "5.0000",
                    "tax_rate": str(self.vat10.pk),
                    "service_from": str(self.today - timedelta(days=5)),
                    "service_to": str(self.today),
                }
            ],
        }
        payload.update(kwargs)
        return payload

    def test_01_defaults_endpoint_and_prefill(self):
        """Test defaults endpoint returns prefilled dates, accounts, and customer payment terms."""
        url = f"/api/v1/sales/service-sales/defaults/?company_id={self.company.pk}&customer_id={self.customer.pk}"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["payment_type"], ServiceSale.PaymentType.UNPAID)
        self.assertEqual(res.data["customer_tax_code"], self.customer.tax_code)
        self.assertEqual(res.data["payment_term"], str(self.payment_term.pk))
        # Due date should be today + 30 days
        expected_due = (self.today + timedelta(days=30)).isoformat()
        self.assertEqual(res.data["due_date"], expected_due)
        self.assertIn("default_accounts", res.data)
        self.assertEqual(res.data["default_accounts"]["revenue_account"], str(self.acc_5113.pk))

    def test_02_create_draft_service_sale_and_amount_calculations(self):
        """Test draft creation: number generation, precision calculation, discounts and taxes (BR-SAL-04-04)."""
        payload = self.build_payload()
        res = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)

        sale_id = res.data["id"]
        sale = ServiceSale.objects.get(pk=sale_id)
        self.assertTrue(sale.number.startswith(f"DV-{self.today.year}-"))
        self.assertEqual(sale.status, DocumentStatus.DRAFT)

        # 10 * 1,500,000 = 15,000,000
        # Discount 5% = 750,000
        # Net = 14,250,000
        # Tax 10% = 1,425,000
        # Total = 15,675,000
        self.assertEqual(sale.subtotal, Decimal("15000000.0000"))
        self.assertEqual(sale.discount_amount, Decimal("7500000.0000") / 10)  # 750,000
        self.assertEqual(sale.tax_amount, Decimal("1425000.0000"))
        self.assertEqual(sale.total_amount, Decimal("15675000.0000"))

        line = sale.lines.first()
        self.assertEqual(line.line_total, Decimal("15675000.0000"))

    def test_03_reject_goods_item_and_invalid_data(self):
        """BR-SAL-04-02 & EF-03: Only SERVICE items allowed; goods and invalid data rejected."""
        # 1. Attempt to add a GOODS item to ServiceSale -> Fails (EF-03)
        payload_goods = self.build_payload(lines=[{
            "item": str(self.item_goods.pk),
            "uom": str(self.uom_goi.pk),
            "quantity": "1.000000",
            "unit_price": "20000000.0000",
        }])
        res_goods = self.client.post(self.base_url, payload_goods, format="json")
        self.assertEqual(res_goods.status_code, 400, res_goods.data)
        self.assertIn("Dịch vụ", str(res_goods.data))

        # 2. Attempt with quantity <= 0
        payload_qty = self.build_payload(lines=[{
            "item": str(self.service_package.pk),
            "uom": str(self.uom_goi.pk),
            "quantity": "0.000000",
            "unit_price": "12000000.0000",
        }])
        res_qty = self.client.post(self.base_url, payload_qty, format="json")
        self.assertEqual(res_qty.status_code, 400)

        # 3. Invalid service dates: service_to < service_from
        payload_dates = self.build_payload(lines=[{
            "item": str(self.service_package.pk),
            "uom": str(self.uom_goi.pk),
            "quantity": "1.000000",
            "unit_price": "12000000.0000",
            "service_from": str(self.today),
            "service_to": str(self.today - timedelta(days=2)),
        }])
        res_dates = self.client.post(self.base_url, payload_dates, format="json")
        self.assertEqual(res_dates.status_code, 400)
        self.assertIn("trước ngày bắt đầu", str(res_dates.data))

    def test_04_service_acceptance_required_validation(self):
        """BR-SAL-04-05, EF-06: Acceptance details required before posting when configured."""
        # Create without acceptance details for consulting service (which requires acceptance)
        payload = self.build_payload(
            service_acceptance_required=True,
            acceptance_document_number="",
            acceptance_date=None,
        )
        res = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res.status_code, 201)
        sale_id = res.data["id"]
        detail_url = f"/api/v1/sales/service-sales/{sale_id}/?company_id={self.company.pk}"

        # Submit & Approve
        self.client.post(f"{detail_url}&action=sub".replace("?", "submit/?"), format="json")
        self.client.post(f"{detail_url}&action=app".replace("?", "approve/?"), format="json")

        # Post should fail due to missing acceptance details (EF-06)
        res_post = self.client.post(f"{detail_url}&action=post".replace("?", "post/?"), format="json")
        self.assertEqual(res_post.status_code, 400)
        self.assertIn("nghiệm thu", str(res_post.data).lower())

        # Update with acceptance details
        sale = ServiceSale.objects.get(pk=sale_id)
        sale.acceptance_document_number = "BB-NT-002"
        sale.acceptance_date = self.today
        sale.save(update_fields=["acceptance_document_number", "acceptance_date"])

        # Now post should succeed
        res_post_ok = self.client.post(f"{detail_url}&action=post".replace("?", "post/?"), format="json")
        self.assertEqual(res_post_ok.status_code, 200, res_post_ok.data)
        self.assertEqual(res_post_ok.data["status"], DocumentStatus.POSTED)

    def test_05_optimistic_locking_and_deletion(self):
        """BR-SAL-04-13, EF-09: Test optimistic locking version mismatch and draft deletion."""
        payload = self.build_payload()
        res = self.client.post(self.base_url, payload, format="json")
        sale_id = res.data["id"]
        detail_url = f"/api/v1/sales/service-sales/{sale_id}/?company_id={self.company.pk}"

        # 1. Update with wrong version
        payload["version"] = 99
        res_update = self.client.put(detail_url, payload, format="json")
        self.assertEqual(res_update.status_code, 400)
        self.assertIn("người khác cập nhật", str(res_update.data))

        # 2. Update with correct version
        payload["version"] = 1
        payload["description"] = "Cập nhật diễn giải dịch vụ"
        res_update_ok = self.client.put(detail_url, payload, format="json")
        self.assertEqual(res_update_ok.status_code, 200)
        self.assertEqual(res_update_ok.data["version"], 2)

        # 3. Delete draft document
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, 204)
        self.assertFalse(ServiceSale.objects.filter(pk=sale_id).exists())

    def test_06_workflow_submission_withdraw_approve_reject(self):
        """Test workflow lifecycle: submit -> withdraw -> resubmit -> approve/reject."""
        payload = self.build_payload()
        res = self.client.post(self.base_url, payload, format="json")
        sale_id = res.data["id"]
        detail_url = f"/api/v1/sales/service-sales/{sale_id}/?company_id={self.company.pk}"

        # Submit
        res_submit = self.client.post(f"{detail_url}&action=submit".replace("?", "submit/?"), {"comment": "Trình duyệt dịch vụ"}, format="json")
        self.assertEqual(res_submit.status_code, 200)
        self.assertEqual(res_submit.data["status"], DocumentStatus.PENDING_APPROVAL)

        # Withdraw
        res_withdraw = self.client.post(f"{detail_url}&action=withdraw".replace("?", "withdraw/?"), {"reason": "Cần bổ sung phạm vi công việc"}, format="json")
        self.assertEqual(res_withdraw.status_code, 200)
        self.assertEqual(res_withdraw.data["status"], DocumentStatus.DRAFT)

        # Resubmit
        self.client.post(f"{detail_url}&action=submit".replace("?", "submit/?"), {"comment": "Trình duyệt lại"}, format="json")

        # Request Revision
        res_rev = self.client.post(f"{detail_url}&action=rev".replace("?", "request-revision/?"), {"reason": "Điều chỉnh ngày nghiệm thu"}, format="json")
        self.assertEqual(res_rev.status_code, 200)
        self.assertEqual(res_rev.data["status"], DocumentStatus.REVISION_REQUIRED)

        # Submit again
        self.client.post(f"{detail_url}&action=submit".replace("?", "submit/?"), {"comment": "Đã sửa ngày nghiệm thu"}, format="json")

        # Approve
        res_app = self.client.post(f"{detail_url}&action=app".replace("?", "approve/?"), {"comment": "Đồng ý phê duyệt dịch vụ"}, format="json")
        self.assertEqual(res_app.status_code, 200)
        self.assertEqual(res_app.data["status"], DocumentStatus.APPROVED)

    def test_07_post_unpaid_service_sale_creates_gl_and_ar_without_inventory(self):
        """Posting UNPAID: creates balanced GL, registers Receivable, NO inventory entries (BR-SAL-04-09)."""
        payload = self.build_payload()
        res = self.client.post(self.base_url, payload, format="json")
        sale_id = res.data["id"]
        detail_url = f"/api/v1/sales/service-sales/{sale_id}/?company_id={self.company.pk}"

        # Approve
        self.client.post(f"{detail_url}&action=sub".replace("?", "submit/?"), format="json")
        self.client.post(f"{detail_url}&action=app".replace("?", "approve/?"), format="json")

        # Post
        res_post = self.client.post(f"{detail_url}&action=post".replace("?", "post/?"), format="json")
        self.assertEqual(res_post.status_code, 200, res_post.data)
        self.assertEqual(res_post.data["status"], DocumentStatus.POSTED)

        sale = ServiceSale.objects.get(pk=sale_id)
        self.assertEqual(sale.status, DocumentStatus.POSTED)
        self.assertIsNotNone(sale.posted_at)

        # 1. Check GL JournalEntry
        journal = sale.journal_entry
        self.assertIsNotNone(journal)
        self.assertEqual(journal.status, "POSTED")
        # Total debit = 15,675,000 = Total credit
        self.assertEqual(journal.total_debit, Decimal("15675000.0000"))
        self.assertEqual(journal.total_credit, Decimal("15675000.0000"))

        # Debit 131: 15,675,000
        debit_line = journal.lines.filter(debit__gt=0).first()
        self.assertEqual(debit_line.account, self.acc_131)
        self.assertEqual(debit_line.debit, Decimal("15675000.0000"))

        # Credit lines: 5113 (14,250,000) and 33311 (1,425,000)
        credit_lines = journal.lines.filter(credit__gt=0)
        self.assertEqual(credit_lines.filter(account=self.acc_5113).first().credit, Decimal("14250000.0000"))
        self.assertEqual(credit_lines.filter(account=self.acc_3331).first().credit, Decimal("1425000.0000"))

        # BR-SAL-04-09: No inventory account 156 and no cogs account 632
        self.assertFalse(journal.lines.filter(account__code__startswith="156").exists())
        self.assertFalse(journal.lines.filter(account__code__startswith="632").exists())

        # 2. Check Accounts Receivable
        rec = sale.receivable
        self.assertIsNotNone(rec)
        self.assertEqual(rec.customer, self.customer)
        self.assertEqual(rec.original_amount, Decimal("15675000.0000"))
        self.assertEqual(rec.balance, Decimal("15675000.0000"))
        self.assertEqual(rec.status, ReceivableStatus.OPEN)

        # 3. Direct edit or cancel of POSTED document must be blocked (EF-10)
        res_block_edit = self.client.put(detail_url, payload, format="json")
        self.assertEqual(res_block_edit.status_code, 400)
        self.assertIn("Đã ghi sổ", str(res_block_edit.data))

        res_block_cancel = self.client.post(f"{detail_url}&action=cancel".replace("?", "cancel/?"), {"reason": "Hủy"}, format="json")
        self.assertEqual(res_block_cancel.status_code, 400)

        # 4. Unpost restores everything cleanly
        res_unpost = self.client.post(f"{detail_url}&action=unpost".replace("?", "unpost/?"), {"reason": "Bỏ ghi sổ kiểm tra"}, format="json")
        self.assertEqual(res_unpost.status_code, 200, res_unpost.data)
        self.assertEqual(res_unpost.data["status"], DocumentStatus.APPROVED)

        sale.refresh_from_db()
        self.assertIsNone(sale.journal_entry)
        self.assertIsNone(sale.receivable)

    def test_08_post_cash_and_bank_payment(self):
        """AF-03, BR-SAL-04-10: Cash and Bank direct payment debits 111 / 112 directly, does not create Receivable."""
        # 1. CASH
        payload_cash = self.build_payload(
            payment_type=ServiceSale.PaymentType.CASH,
            service_acceptance_required=False,
            lines=[{
                "item": str(self.service_package.pk),
                "uom": str(self.uom_goi.pk),
                "quantity": "1.000000",
                "unit_price": "12000000.0000",
                "discount_rate": "0",
                "tax_rate": str(self.vat10.pk),
            }]
        )
        res_cash = self.client.post(self.base_url, payload_cash, format="json")
        sale_cash_id = res_cash.data["id"]
        detail_cash = f"/api/v1/sales/service-sales/{sale_cash_id}/?company_id={self.company.pk}"
        self.client.post(f"{detail_cash}&action=sub".replace("?", "submit/?"), format="json")
        self.client.post(f"{detail_cash}&action=app".replace("?", "approve/?"), format="json")
        res_post_cash = self.client.post(f"{detail_cash}&action=post".replace("?", "post/?"), format="json")
        self.assertEqual(res_post_cash.status_code, 200)

        sale_cash = ServiceSale.objects.get(pk=sale_cash_id)
        self.assertIsNone(sale_cash.receivable)  # No uncollected receivable!
        debit_line = sale_cash.journal_entry.lines.filter(debit__gt=0).first()
        self.assertEqual(debit_line.account, self.acc_111)

        # 2. BANK
        payload_bank = self.build_payload(
            payment_type=ServiceSale.PaymentType.BANK,
            company_bank_account=str(self.bank_account.pk),
            service_acceptance_required=False,
            lines=[{
                "item": str(self.service_package.pk),
                "uom": str(self.uom_goi.pk),
                "quantity": "1.000000",
                "unit_price": "12000000.0000",
                "discount_rate": "0",
                "tax_rate": str(self.vat10.pk),
            }]
        )
        res_bank = self.client.post(self.base_url, payload_bank, format="json")
        sale_bank_id = res_bank.data["id"]
        detail_bank = f"/api/v1/sales/service-sales/{sale_bank_id}/?company_id={self.company.pk}"
        self.client.post(f"{detail_bank}&action=sub".replace("?", "submit/?"), format="json")
        self.client.post(f"{detail_bank}&action=app".replace("?", "approve/?"), format="json")
        res_post_bank = self.client.post(f"{detail_bank}&action=post".replace("?", "post/?"), format="json")
        self.assertEqual(res_post_bank.status_code, 200)

        sale_bank = ServiceSale.objects.get(pk=sale_bank_id)
        self.assertIsNone(sale_bank.receivable)
        debit_bank = sale_bank.journal_entry.lines.filter(debit__gt=0).first()
        self.assertEqual(debit_bank.account, self.acc_112)
        self.assertEqual(debit_bank.dimensions.get("bank_account"), str(self.bank_account.pk))

    def test_09_prepare_and_link_from_sales_order(self):
        """AF-02, BR-SAL-04-03: Inherit from SalesOrder and track service quantity."""
        order = SalesOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="SO-SERV-2026-0001",
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
            item=self.service_consulting,
            uom=self.uom_gio,
            quantity=Decimal("20"),
            unit_price=Decimal("1500000"),
            tax_rate=self.vat10,
        )

        # 1. Call prepare-from-order endpoint
        prep_url = f"/api/v1/sales/service-sales/prepare-from-order/?company_id={self.company.pk}&order_id={order.pk}"
        res_prep = self.client.get(prep_url)
        self.assertEqual(res_prep.status_code, 200, res_prep.data)
        self.assertEqual(res_prep.data["sales_order"], str(order.pk))
        self.assertEqual(len(res_prep.data["lines"]), 1)
        self.assertEqual(res_prep.data["lines"][0]["order_line"], str(order_line.pk))
        self.assertEqual(Decimal(res_prep.data["lines"][0]["quantity"]), Decimal("20"))

        # 2. Create service sale linked to this order line (quantity = 15)
        payload = self.build_payload(
            sales_order=str(order.pk),
            lines=[{
                "order_line": str(order_line.pk),
                "item": str(self.service_consulting.pk),
                "uom": str(self.uom_gio.pk),
                "quantity": "15.000000",
                "unit_price": "1500000.0000",
                "tax_rate": str(self.vat10.pk),
            }]
        )
        res_sale = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(res_sale.status_code, 201)

        # 3. Next prepare call should only show remaining 5 units!
        res_prep2 = self.client.get(prep_url)
        self.assertEqual(res_prep2.status_code, 200)
        self.assertEqual(Decimal(res_prep2.data["lines"][0]["quantity"]), Decimal("5"))

        # 4. Attempt to create another sale exceeding remaining quantity -> Fails (EF-07)
        payload_exceed = self.build_payload(
            sales_order=str(order.pk),
            lines=[{
                "order_line": str(order_line.pk),
                "item": str(self.service_consulting.pk),
                "uom": str(self.uom_gio.pk),
                "quantity": "10.000000",  # Only 5 left!
                "unit_price": "1500000.0000",
            }]
        )
        sale_exceed = self.client.post(self.base_url, payload_exceed, format="json")
        detail_exceed = f"/api/v1/sales/service-sales/{sale_exceed.data['id']}/?company_id={self.company.pk}"
        self.client.post(f"{detail_exceed}&action=sub".replace("?", "submit/?"), format="json")
        self.client.post(f"{detail_exceed}&action=app".replace("?", "approve/?"), format="json")
        res_post_exceed = self.client.post(f"{detail_exceed}&action=post".replace("?", "post/?"), format="json")
        self.assertEqual(res_post_exceed.status_code, 400)
        self.assertIn("vượt phần còn lại của đơn hàng", str(res_post_exceed.data))

    def test_10_link_tax_invoice(self):
        """AF-08, BR-SAL-04-11, EF-08: Linking tax invoice validates customer & amount without re-posting revenue."""
        payload = self.build_payload()
        res = self.client.post(self.base_url, payload, format="json")
        sale_id = res.data["id"]
        detail_url = f"/api/v1/sales/service-sales/{sale_id}/?company_id={self.company.pk}"

        # Create output tax invoice with matching amount (15,675,000)
        inv = TaxInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            direction=InvoiceDirection.OUTPUT,
            invoice_series="1C26TBB",
            invoice_number="0005555",
            invoice_date=self.today,
            seller_name=self.company.name,
            seller_tax_code=self.company.tax_code,
            buyer_name=self.customer.name,
            party=self.customer,
            currency=self.currency,
            subtotal=Decimal("14250000"),
            tax_amount=Decimal("1425000"),
            total_amount=Decimal("15675000"),
            status=InvoiceStatus.ISSUED,
            created_by=self.user.iam_account,
        )

        link_url = f"{detail_url}&action=link".replace("?", "link-invoice/?")
        res_link = self.client.post(link_url, {"tax_invoice": str(inv.pk), "notes": "Hóa đơn điện tử dịch vụ"}, format="json")
        self.assertEqual(res_link.status_code, 200, res_link.data)
        self.assertEqual(str(res_link.data["tax_invoice"]), str(inv.pk))

        # Test amount mismatch exception (EF-08)
        inv_mismatch = TaxInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            direction=InvoiceDirection.OUTPUT,
            invoice_series="1C26TBB",
            invoice_number="0005556",
            invoice_date=self.today,
            seller_name=self.company.name,
            seller_tax_code=self.company.tax_code,
            buyer_name=self.customer.name,
            party=self.customer,
            currency=self.currency,
            subtotal=Decimal("5000000"),
            tax_amount=Decimal("500000"),
            total_amount=Decimal("5500000"),  # Mismatched!
            status=InvoiceStatus.ISSUED,
            created_by=self.user.iam_account,
        )
        res_link_bad = self.client.post(link_url, {"tax_invoice": str(inv_mismatch.pk)}, format="json")
        self.assertEqual(res_link_bad.status_code, 400)
        self.assertIn("không khớp", str(res_link_bad.data))
