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
    Currency, Item, Party, PartyAddress, PartyContact, PartyRole,
    PaymentTerm, TaxRate, UnitOfMeasure, Warehouse
)
from organization.models import Branch, Company, Employee
from sales.models import (
    DocumentStatus, GoodsSale, GoodsSaleLine,
    ServiceSale, ServiceSaleLine,
    SalesOrder, SalesOrderLine,
    SalesInvoice, SalesInvoiceLine
)
from tax_management.models import TaxInvoice


class SalesInvoiceUcSal07Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.client = APIClient()

        # Currency
        self.currency = Currency.objects.get(code="VND")

        # Company & Branch
        self.company = Company.objects.create(
            code="SAL07_CO",
            name="Sales Invoice Co",
            legal_name="Công Ty Cổ Phần Hóa Đơn Bán Hàng",
            tax_code="0108877665",
            address="123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. HCM",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(
            company=self.company,
            code="CN_SAL07",
            name="Chi nhánh Hóa đơn",
            status="ACTIVE",
        )

        # Users
        self.user = get_user_model().objects.create_superuser(
            username="invoice_user", email="invoice_user@example.com", password="password123"
        )
        self.client.force_authenticate(user=self.user)

        # Employee & Membership
        self.employee = Employee.objects.create(
            company=self.company,
            employee_code="NV_SAL07",
            full_name="Nguyễn Văn Hóa Đơn",
            email="nv_sal07@example.com",
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
            code="CUST_SAL07_01",
            name="Công Ty TNHH Đại Phát Khang",
            legal_name="Công Ty TNHH Thương Mại & Dịch Vụ Đại Phát Khang",
            tax_code="0301122334",
            default_currency=self.currency,
            status="ACTIVE",
        )
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)
        self.customer_address = PartyAddress.objects.create(
            party=self.customer,
            address_type="OFFICE",
            address_line="789 Đường Hai Bà Trưng, Quận 3, TP. HCM",
            is_default=True,
        )
        self.customer_contact = PartyContact.objects.create(
            party=self.customer,
            contact_type="PRIMARY",
            contact_name="Đại Diện Đại Phát Khang",
            email="daiphatkhang@example.com",
            is_default=True,
        )

        # Payment Term
        self.payment_term = PaymentTerm.objects.create(
            company=self.company,
            code="NET30_SAL07",
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
            code="KHO_SAL07",
            name="Kho Tổng Hóa Đơn",
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
            code="VAT10_SAL07",
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
            name="Laptop Dell Latitude",
            item_type="GOODS",
            track_inventory=True,
            base_uom=self.uom_cai,
            status="ACTIVE",
        )
        self.item_service = Item.objects.create(
            company=self.company,
            code="SVC_DEPLOY",
            name="Dịch Vụ Triển Khai Hệ Thống",
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
            company=self.company, code="COA_SAL07", name="Hệ thống tài khoản bán hàng", effective_from=self.today
        )
        self.acc_131 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="131", name="Phải thu của khách hàng",
            account_type="ASSET", is_postable=True, status="ACTIVE", requires_party=True
        )
        self.acc_111 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, code="1111", name="Tiền mặt",
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

        # Create posted GoodsSale
        self.goods_sale = self._create_posted_goods_sale(qty=Decimal("10"))

        # Create posted ServiceSale
        self.service_sale = self._create_posted_service_sale(qty=Decimal("5"))

        # Create confirmed SalesOrder
        self.sales_order = self._create_confirmed_sales_order(qty=Decimal("8"))

    def _create_posted_goods_sale(self, qty=Decimal("10")):
        subtotal = qty * Decimal("15000000")  # 150,000,000
        discount = Decimal("5000000")         # 5,000,000
        net = subtotal - discount             # 145,000,000
        tax = net * Decimal("0.10")           # 14,500,000
        total = net + tax                     # 159,500,000

        sale = GoodsSale.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"BH-SAL07-{timezone.now().timestamp()}",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer,
            currency=self.currency,
            exchange_rate=Decimal("1"),
            payment_type="UNPAID",
            subtotal=subtotal,
            discount_amount=discount,
            tax_amount=tax,
            total_amount=total,
            inventory_handling=GoodsSale.InventoryHandling.NO_INVENTORY,
            status=DocumentStatus.POSTED,
            created_by=self.user.iam_account,
            version=1,
        )
        GoodsSaleLine.objects.create(
            sale=sale,
            line_no=1,
            item=self.item_laptop,
            uom=self.uom_cai,
            quantity=qty,
            unit_price=Decimal("15000000"),
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
        return sale

    def _create_posted_service_sale(self, qty=Decimal("5")):
        unit_price = Decimal("10000000")
        subtotal = qty * unit_price
        tax = subtotal * Decimal("0.10")
        total = subtotal + tax

        sale = ServiceSale.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"DV-SAL07-{timezone.now().timestamp()}",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer,
            currency=self.currency,
            exchange_rate=Decimal("1"),
            payment_type="UNPAID",
            subtotal=subtotal,
            discount_amount=Decimal("0"),
            tax_amount=tax,
            total_amount=total,
            status=DocumentStatus.POSTED,
            created_by=self.user.iam_account,
            version=1,
        )
        ServiceSaleLine.objects.create(
            sale=sale,
            line_no=1,
            item=self.item_service,
            uom=self.uom_goi,
            quantity=qty,
            unit_price=unit_price,
            discount_amount=Decimal("0"),
            tax_rate=self.vat10,
            tax_amount=tax,
            line_total=total,
            revenue_account=self.acc_5113,
            tax_account=self.acc_33311,
            receivable_or_payment_account=self.acc_131,
        )
        return sale

    def _create_confirmed_sales_order(self, qty=Decimal("8")):
        unit_price = Decimal("12000000")
        subtotal = qty * unit_price
        tax = subtotal * Decimal("0.10")
        total = subtotal + tax

        order = SalesOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number=f"SO-SAL07-{timezone.now().timestamp()}",
            document_date=self.today,
            customer=self.customer,
            currency=self.currency,
            exchange_rate=Decimal("1"),
            subtotal=subtotal,
            tax_amount=tax,
            total_amount=total,
            invoiced_amount=Decimal("0"),
            status=DocumentStatus.APPROVED,
            created_by=self.user.iam_account,
            version=1,
        )
        SalesOrderLine.objects.create(
            order=order,
            line_no=1,
            item=self.item_laptop,
            uom=self.uom_cai,
            quantity=qty,
            unit_price=unit_price,
            tax_rate=self.vat10,
            tax_amount=tax,
            line_total=total,
            invoiced_quantity=Decimal("0"),
        )
        return order

    def test_01_defaults_endpoint(self):
        """UC-SAL-07 Luồng chính Bước 4-5: Defaults prefill seller, buyer, template, payment method."""
        resp = self.client.get(
            f"/api/v1/sales/sales-invoices/defaults/?company_id={self.company.id}&goods_sale_id={self.goods_sale.id}"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.data
        self.assertEqual(data["seller_name"], self.company.legal_name)
        self.assertEqual(data["seller_tax_code"], self.company.tax_code)
        self.assertEqual(data["seller_address"], self.company.address)
        self.assertEqual(data["buyer_name"], self.customer.name)
        self.assertEqual(data["buyer_tax_code"], self.customer.tax_code)
        self.assertEqual(data["buyer_email"], self.customer_contact.email)
        self.assertEqual(data["currency"], "VND")
        self.assertEqual(data["invoice_category"], "VAT")
        self.assertEqual(data["template_code"], "1/001")
        self.assertEqual(data["payment_method"], "CASH_OR_BANK")
        self.assertEqual(data["goods_sale_number"], self.goods_sale.number)

    def test_02_create_draft_invoice_direct_entry(self):
        """UC-SAL-07 AF-02: Direct invoice entry without source document."""
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "buyer_name": "Công Ty Đại Phát Khang",
            "buyer_legal_name": self.customer.legal_name,
            "buyer_tax_code": self.customer.tax_code,
            "buyer_address": self.customer_address.address_line,
            "lines": [
                {
                    "item": str(self.item_laptop.id),
                    "item_name": "Laptop Dell Latitude Doanh Nhân",
                    "uom": str(self.uom_cai.id),
                    "quantity": "2",
                    "unit_price": "20000000",
                    "discount_rate": "5",  # 5% of 40,000,000 = 2,000,000
                    "tax_rate": str(self.vat10.id),  # 10% of 38,000,000 = 3,800,000
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-invoices/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.data

        # Check internal document number format HD-YYYY-NNNNNN
        self.assertTrue(data["number"].startswith(f"HD-{self.today.year}-"))
        self.assertEqual(data["status"], "DRAFT")
        self.assertEqual(Decimal(data["subtotal"]), Decimal("40000000"))
        self.assertEqual(Decimal(data["discount_amount"]), Decimal("2000000"))
        self.assertEqual(Decimal(data["tax_amount"]), Decimal("3800000"))
        self.assertEqual(Decimal(data["total_amount"]), Decimal("41800000"))
        self.assertEqual(len(data["lines"]), 1)
        self.assertEqual(data["lines"][0]["item_name"], "Laptop Dell Latitude Doanh Nhân")

    def test_03_prepare_from_sale_goods_service_order(self):
        """UC-SAL-07 Luồng chính Bước 2-3, AF-03: Prepare available lines & remaining quantities."""
        # 1. From GoodsSale
        resp1 = self.client.get(
            f"/api/v1/sales/sales-invoices/prepare_from_sale/?company_id={self.company.id}&goods_sale_id={self.goods_sale.id}"
        )
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        lines1 = resp1.data["lines"]
        self.assertEqual(len(lines1), 1)
        self.assertEqual(Decimal(lines1[0]["remaining_quantity"]), Decimal("10"))
        self.assertEqual(lines1[0]["item_name"], self.item_laptop.name)

        # 2. From ServiceSale
        resp2 = self.client.get(
            f"/api/v1/sales/sales-invoices/prepare_from_sale/?company_id={self.company.id}&service_sale_id={self.service_sale.id}"
        )
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        lines2 = resp2.data["lines"]
        self.assertEqual(len(lines2), 1)
        self.assertEqual(Decimal(lines2[0]["remaining_quantity"]), Decimal("5"))

        # 3. From SalesOrder
        resp3 = self.client.get(
            f"/api/v1/sales/sales-invoices/prepare_from_sale/?company_id={self.company.id}&sales_order_id={self.sales_order.id}"
        )
        self.assertEqual(resp3.status_code, status.HTTP_200_OK)
        lines3 = resp3.data["lines"]
        self.assertEqual(len(lines3), 1)
        self.assertEqual(Decimal(lines3[0]["remaining_quantity"]), Decimal("8"))

    def test_04_create_invoice_from_goods_sale_and_partial_reservation(self):
        """UC-SAL-07 BR-SAL-07-02, BR-SAL-07-04, BR-SAL-07-05: Partial invoicing and quantity quota reservation."""
        gs_line = self.goods_sale.lines.first()

        # Create first draft invoice for 4 units out of 10
        payload1 = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "lines": [
                {
                    "goods_sale_line": str(gs_line.id),
                    "quantity": "4",
                    "unit_price": "15000000",
                    "tax_rate": str(self.vat10.id),
                }
            ],
        }
        resp1 = self.client.post("/api/v1/sales/sales-invoices/", payload1, format="json")
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        inv1_id = resp1.data["id"]

        # Check prepare_from_sale: remaining should now be 10 - 4 = 6
        prep_resp = self.client.get(
            f"/api/v1/sales/sales-invoices/prepare_from_sale/?company_id={self.company.id}&goods_sale_id={self.goods_sale.id}"
        )
        self.assertEqual(Decimal(prep_resp.data["lines"][0]["remaining_quantity"]), Decimal("6"))

        # Create second invoice for remaining 6 units
        payload2 = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "lines": [
                {
                    "goods_sale_line": str(gs_line.id),
                    "quantity": "6",
                    "unit_price": "15000000",
                    "tax_rate": str(self.vat10.id),
                }
            ],
        }
        resp2 = self.client.post("/api/v1/sales/sales-invoices/", payload2, format="json")
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)

        # Source document is now fully invoiced: prepare_from_sale correctly rejects with 400
        prep_resp2 = self.client.get(
            f"/api/v1/sales/sales-invoices/prepare_from_sale/?company_id={self.company.id}&goods_sale_id={self.goods_sale.id}"
        )
        self.assertEqual(prep_resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("đã được lập hóa đơn toàn bộ", str(prep_resp2.data))

    def test_05_exceed_remaining_quantity_blocked(self):
        """UC-SAL-07 EF-03, BR-SAL-07-02: Block invoicing quantity greater than remaining available quota."""
        gs_line = self.goods_sale.lines.first()
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "lines": [
                {
                    "goods_sale_line": str(gs_line.id),
                    "quantity": "11",  # Exceeds total 10
                    "unit_price": "15000000",
                    "tax_rate": str(self.vat10.id),
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-invoices/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vượt quá", str(resp.data))

    def test_06_issue_sales_invoice_success(self):
        """UC-SAL-07 Luồng chính Bước 9-10, BR-SAL-07-09, BR-SAL-07-10, BR-SAL-07-12: Issuance, number assignment, e-invoice sync & backlink."""
        gs_line = self.goods_sale.lines.first()
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "lines": [
                {
                    "goods_sale_line": str(gs_line.id),
                    "quantity": "10",
                    "unit_price": "15000000",
                    "discount_amount": "5000000",
                    "tax_rate": str(self.vat10.id),
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-invoices/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        inv_id = resp.data["id"]

        # Issue the invoice
        issue_resp = self.client.post(f"/api/v1/sales/sales-invoices/{inv_id}/issue/")
        self.assertEqual(issue_resp.status_code, status.HTTP_200_OK)
        issued_data = issue_resp.data

        # 1. Status and invoice number
        self.assertEqual(issued_data["status"], "ISSUED")
        self.assertEqual(len(issued_data["invoice_number"]), 7)  # E.g. '0000001'
        self.assertIsNotNone(issued_data["issued_at"])
        self.assertIsNotNone(issued_data["issued_by"])

        # 2. Files and lookup code
        self.assertTrue(issued_data["xml_file_url"].endswith(".xml"))
        self.assertTrue(issued_data["pdf_file_url"].endswith(".pdf"))
        self.assertTrue(bool(issued_data["lookup_code"]))
        self.assertTrue(bool(issued_data["lookup_url"]))

        # 3. TaxInvoice created in tax_management (BR-SAL-07-12)
        tax_inv_id = issued_data["tax_invoice"]
        self.assertIsNotNone(tax_inv_id)
        tax_inv = TaxInvoice.objects.get(id=tax_inv_id)
        self.assertEqual(tax_inv.direction, "OUTPUT")
        self.assertEqual(tax_inv.invoice_number, issued_data["invoice_number"])
        self.assertEqual(tax_inv.total_amount, Decimal(issued_data["total_amount"]))

        # 4. Source GoodsSale backlink updated
        self.goods_sale.refresh_from_db()
        self.assertEqual(self.goods_sale.tax_invoice_id, tax_inv.id)

    def test_07_issue_failure_and_retry(self):
        """UC-SAL-07 EF-07, AF-06, BR-SAL-07-11: Handle provider failure, prevent duplicates, and retry issuance."""
        gs_line = self.goods_sale.lines.first()
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "lines": [
                {
                    "goods_sale_line": str(gs_line.id),
                    "quantity": "5",
                    "unit_price": "15000000",
                    "tax_rate": str(self.vat10.id),
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-invoices/", payload, format="json")
        inv_id = resp.data["id"]

        # 1. Force failure on issue
        fail_resp = self.client.post(
            f"/api/v1/sales/sales-invoices/{inv_id}/issue/",
            {"force_fail": True, "error_message": "Chữ ký số USB Token không phản hồi."},
            format="json",
        )
        self.assertEqual(fail_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(fail_resp.data["status"], "ISSUE_FAILED")
        self.assertIn("Chữ ký số", fail_resp.data["issue_error_message"])

        # 2. Regular edit on ISSUE_FAILED is blocked
        edit_resp = self.client.patch(
            f"/api/v1/sales/sales-invoices/{inv_id}/",
            {"notes": "Cố gắng sửa đổi"},
            format="json",
        )
        self.assertEqual(edit_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Retry issue succeeds (AF-06)
        retry_resp = self.client.post(f"/api/v1/sales/sales-invoices/{inv_id}/retry_issue/")
        self.assertEqual(retry_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(retry_resp.data["status"], "ISSUED")
        self.assertEqual(len(retry_resp.data["invoice_number"]), 7)

    def test_08_approval_workflow_lifecycle(self):
        """UC-SAL-07 AF-04, AF-05, BR-SAL-07-08: Approval lifecycle (Submit -> Withdraw -> Revision -> Approve -> Issue)."""
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "lines": [
                {
                    "item": str(self.item_laptop.id),
                    "item_name": "Laptop Dự Án",
                    "uom": str(self.uom_cai.id),
                    "quantity": "1",
                    "unit_price": "18000000",
                    "tax_rate": str(self.vat10.id),
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-invoices/", payload, format="json")
        inv_id = resp.data["id"]

        # 1. Submit
        r1 = self.client.post(f"/api/v1/sales/sales-invoices/{inv_id}/submit/", {"notes": "Trình duyệt phát hành"})
        self.assertEqual(r1.status_code, status.HTTP_200_OK)

        # Simulate workflow pending
        inv_obj = SalesInvoice.objects.get(id=inv_id)
        inv_obj.status = SalesInvoice.Status.PENDING_APPROVAL
        inv_obj.save(update_fields=["status"])

        # 2. Withdraw
        r2 = self.client.post(f"/api/v1/sales/sales-invoices/{inv_id}/withdraw/", {"reason": "Rà soát lại địa chỉ"})
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.data["status"], "DRAFT")

        # 3. Resubmit & Request Revision
        self.client.post(f"/api/v1/sales/sales-invoices/{inv_id}/submit/")
        inv_obj.refresh_from_db()
        inv_obj.status = SalesInvoice.Status.PENDING_APPROVAL
        inv_obj.save(update_fields=["status"])

        r3 = self.client.post(f"/api/v1/sales/sales-invoices/{inv_id}/request_revision/", {"comment": "Chỉnh sửa mã số thuế"})
        self.assertEqual(r3.status_code, status.HTTP_200_OK)
        self.assertEqual(r3.data["status"], "REVISION_REQUIRED")

        # 4. Resubmit & Approve
        self.client.post(f"/api/v1/sales/sales-invoices/{inv_id}/submit/")
        inv_obj.refresh_from_db()
        inv_obj.status = SalesInvoice.Status.PENDING_APPROVAL
        inv_obj.save(update_fields=["status"])

        r4 = self.client.post(f"/api/v1/sales/sales-invoices/{inv_id}/approve/", {"comment": "Đã duyệt hóa đơn"})
        self.assertEqual(r4.status_code, status.HTTP_200_OK)
        self.assertEqual(r4.data["status"], "APPROVED")

        # 5. Issue from APPROVED
        r5 = self.client.post(f"/api/v1/sales/sales-invoices/{inv_id}/issue/")
        self.assertEqual(r5.status_code, status.HTTP_200_OK)
        self.assertEqual(r5.data["status"], "ISSUED")

    def test_09_download_and_send_email(self):
        """UC-SAL-07 AF-07: Send email notification with e-invoice link to customer."""
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "buyer_email": "ketoan@daiphatkhang.vn",
            "lines": [
                {
                    "item": str(self.item_laptop.id),
                    "item_name": "Laptop Dell",
                    "quantity": "1",
                    "unit_price": "10000000",
                    "tax_rate": str(self.vat10.id),
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-invoices/", payload, format="json")
        inv_id = resp.data["id"]

        # Issue first
        self.client.post(f"/api/v1/sales/sales-invoices/{inv_id}/issue/")

        # Send email
        email_resp = self.client.post(
            f"/api/v1/sales/sales-invoices/{inv_id}/send_email/",
            {"recipient_email": "ketoan@daiphatkhang.vn"},
            format="json",
        )
        self.assertEqual(email_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(email_resp.data["sent"])
        self.assertEqual(email_resp.data["recipient_email"], "ketoan@daiphatkhang.vn")

    def test_10_optimistic_locking_and_immutability(self):
        """UC-SAL-07 EF-09, EF-10, BR-SAL-07-13, BR-SAL-07-14: Optimistic locking and issued immutability."""
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "lines": [
                {
                    "item": str(self.item_laptop.id),
                    "item_name": "Laptop Dell",
                    "quantity": "1",
                    "unit_price": "10000000",
                    "tax_rate": str(self.vat10.id),
                }
            ],
        }
        resp = self.client.post("/api/v1/sales/sales-invoices/", payload, format="json")
        inv_id = resp.data["id"]

        # Stale version update should fail (EF-09)
        stale_resp = self.client.patch(
            f"/api/v1/sales/sales-invoices/{inv_id}/",
            {"version": 999, "notes": "Ghi chú xung đột"},
            format="json",
        )
        self.assertEqual(stale_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Issue the invoice
        self.client.post(f"/api/v1/sales/sales-invoices/{inv_id}/issue/")

        # Attempt to edit issued invoice is blocked (EF-10, BR-SAL-07-13)
        edit_issued = self.client.patch(
            f"/api/v1/sales/sales-invoices/{inv_id}/",
            {"notes": "Không thể sửa hóa đơn đã phát hành"},
            format="json",
        )
        self.assertEqual(edit_issued.status_code, status.HTTP_400_BAD_REQUEST)

        # Attempt to delete issued invoice is blocked
        del_issued = self.client.delete(f"/api/v1/sales/sales-invoices/{inv_id}/")
        self.assertEqual(del_issued.status_code, status.HTTP_400_BAD_REQUEST)

    def test_11_delete_and_cancel_releases_reservation(self):
        """UC-SAL-07 AF-08, BR-SAL-07-05: Deletion and cancellation immediately release reserved source quantities."""
        gs_line = self.goods_sale.lines.first()

        # 1. Create draft invoice for 5 units -> reserves 5 units
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "goods_sale": str(self.goods_sale.id),
            "lines": [
                {
                    "goods_sale_line": str(gs_line.id),
                    "quantity": "5",
                    "unit_price": "15000000",
                    "tax_rate": str(self.vat10.id),
                }
            ],
        }
        resp1 = self.client.post("/api/v1/sales/sales-invoices/", payload, format="json")
        inv1_id = resp1.data["id"]

        prep = self.client.get(
            f"/api/v1/sales/sales-invoices/prepare_from_sale/?company_id={self.company.id}&goods_sale_id={self.goods_sale.id}"
        )
        self.assertEqual(Decimal(prep.data["lines"][0]["remaining_quantity"]), Decimal("5"))

        # Delete draft invoice -> remaining goes back to 10
        del_resp = self.client.delete(f"/api/v1/sales/sales-invoices/{inv1_id}/")
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)

        prep_after_del = self.client.get(
            f"/api/v1/sales/sales-invoices/prepare_from_sale/?company_id={self.company.id}&goods_sale_id={self.goods_sale.id}"
        )
        self.assertEqual(Decimal(prep_after_del.data["lines"][0]["remaining_quantity"]), Decimal("10"))

        # 2. Create another invoice for 5 units, approve and cancel
        resp2 = self.client.post("/api/v1/sales/sales-invoices/", payload, format="json")
        inv2_id = resp2.data["id"]

        cancel_resp = self.client.post(
            f"/api/v1/sales/sales-invoices/{inv2_id}/cancel/",
            {"reason": "Hủy hóa đơn do sai đối tượng"},
            format="json",
        )
        self.assertEqual(cancel_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_resp.data["status"], "CANCELLED")

        prep_after_cancel = self.client.get(
            f"/api/v1/sales/sales-invoices/prepare_from_sale/?company_id={self.company.id}&goods_sale_id={self.goods_sale.id}"
        )
        self.assertEqual(Decimal(prep_after_cancel.data["lines"][0]["remaining_quantity"]), Decimal("10"))

    def test_12_service_sale_and_sales_order_invoicing(self):
        """UC-SAL-07 Luồng thay thế AF-03: Invoicing from ServiceSale and SalesOrder updates source tracking."""
        # 1. Invoice from ServiceSale
        svc_line = self.service_sale.lines.first()
        payload_svc = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "service_sale": str(self.service_sale.id),
            "lines": [
                {
                    "service_sale_line": str(svc_line.id),
                    "quantity": "5",
                    "unit_price": "10000000",
                    "tax_rate": str(self.vat10.id),
                }
            ],
        }
        resp_svc = self.client.post("/api/v1/sales/sales-invoices/", payload_svc, format="json")
        self.assertEqual(resp_svc.status_code, status.HTTP_201_CREATED)
        inv_svc_id = resp_svc.data["id"]

        self.client.post(f"/api/v1/sales/sales-invoices/{inv_svc_id}/issue/")
        self.service_sale.refresh_from_db()
        self.assertIsNotNone(self.service_sale.tax_invoice_id)

        # 2. Invoice from SalesOrder
        so_line = self.sales_order.lines.first()
        payload_so = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "sales_order": str(self.sales_order.id),
            "lines": [
                {
                    "order_line": str(so_line.id),
                    "quantity": "4",
                    "unit_price": "12000000",
                    "tax_rate": str(self.vat10.id),
                }
            ],
        }
        resp_so = self.client.post("/api/v1/sales/sales-invoices/", payload_so, format="json")
        self.assertEqual(resp_so.status_code, status.HTTP_201_CREATED)
        inv_so_id = resp_so.data["id"]

        self.client.post(f"/api/v1/sales/sales-invoices/{inv_so_id}/issue/")
        self.sales_order.refresh_from_db()
        so_line.refresh_from_db()
        self.assertEqual(so_line.invoiced_quantity, Decimal("4"))
        self.assertGreater(self.sales_order.invoiced_amount, Decimal("0"))
