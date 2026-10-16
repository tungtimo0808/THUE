import json
import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserAccount, UserRoleAssignment
from master_data.models import (
    Bank, CompanyBankAccount, Currency, Item, ItemCategory, Party, TaxRate, UnitOfMeasure
)
from organization.models import Branch, Company
from sales import models
from sales.commercial_invoice_services import (
    calculate_source_order_line_usage,
    create_commercial_invoice,
    generate_commercial_invoice_code,
    generate_commercial_invoice_publish_number,
)
from sales.link_services import create_document_link, get_document_links


class SalesCommercialInvoiceUcSal14Tests(TestCase):
    """
    Automated Unit Tests for UC-SAL-14: Commercial Invoices (Hóa đơn thương mại).
    Covers BR-SAL-14-01 to BR-SAL-14-14, AF-01 to AF-09, and EF-01 to EF-10.
    """

    def setUp(self):
        self.client = APIClient()
        self.today = timezone.localdate()

        # 1. Currencies
        self.vnd, _ = Currency.objects.get_or_create(
            code="VND", defaults={"name": "Việt Nam Đồng", "is_active": True}
        )
        self.usd, _ = Currency.objects.get_or_create(
            code="USD", defaults={"name": "US Dollar", "is_active": True}
        )

        # 2. Company & Branch setup
        self.company = Company.objects.create(
            code="GLOBAL_EXP",
            name="Công ty Xuất Khẩu Toàn Cầu",
            legal_name="Global Export JSC",
            tax_code="0109988776",
            address="123 Đường Cảng, Hải Phòng",
            email="export@global.vn",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
            status="ACTIVE",
        )
        self.branch = Branch.objects.create(
            company=self.company,
            name="Chi nhánh Cảng Hải Phòng",
            code="CN-HP",
        )

        # 3. User & IAM permissions
        auth_user = get_user_model().objects.create_user(username="exporter_user", password="password")
        self.user = auth_user.iam_account
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.user, created_by=self.user
        )
        self.role = Role.objects.create(
            company=self.company,
            code="EXPORT_OFFICER",
            name="Nhân viên xuất nhập khẩu",
            status="ACTIVE",
        )
        UserRoleAssignment.objects.create(
            company_membership=self.membership, role=self.role, assigned_by=self.user
        )

        perms = [
            "SAL.COMMERCIAL_INVOICE.VIEW", "SAL.COMMERCIAL_INVOICE.CREATE", "SAL.COMMERCIAL_INVOICE.EDIT",
            "SAL.COMMERCIAL_INVOICE.DELETE", "SAL.COMMERCIAL_INVOICE.APPROVE", "SAL.COMMERCIAL_INVOICE.PUBLISH",
            "SAL.COMMERCIAL_INVOICE.ISSUE", "SAL.COMMERCIAL_INVOICE.CANCEL", "SAL.COMMERCIAL_INVOICE.RETRY",
            "SAL.ORDER.VIEW", "SAL.ORDER.CREATE",
        ]
        for p_code in perms:
            p, _ = Permission.objects.get_or_create(code=p_code, defaults={"name": p_code})
            RolePermission.objects.get_or_create(role=self.role, permission=p, defaults={"effect": "ALLOW"})

        self.client.force_authenticate(user=auth_user)
        self.client.defaults["HTTP_X_COMPANY_ID"] = str(self.company.id)

        # 4. Master Data: Item, Category, UOM, TaxRate, Bank
        self.category = ItemCategory.objects.create(
            company=self.company,
            code="EXPORT_GOODS",
            name="Hàng Xuất Khẩu",
        )
        self.uom_pcs = UnitOfMeasure.objects.create(
            company=self.company,
            code="PCS",
            name="Cái",
        )
        self.tax_rate_0 = TaxRate.objects.create(
            company=self.company,
            code="VAT0",
            name="Thuế suất 0% xuất khẩu",
            rate_percent=Decimal("0.0"),
            effective_from=self.today - timedelta(days=365),
        )
        self.tax_rate_10 = TaxRate.objects.create(
            company=self.company,
            code="VAT10",
            name="Thuế suất 10%",
            rate_percent=Decimal("10.0"),
            effective_from=self.today - timedelta(days=365),
        )

        self.item_a = Item.objects.create(
            company=self.company,
            code="EXP-ITEM-01",
            name="Robusta Coffee Beans Grade 1",
            category=self.category,
            base_uom=self.uom_pcs,
        )
        self.item_b = Item.objects.create(
            company=self.company,
            code="EXP-ITEM-02",
            name="Black Pepper 500g/l",
            category=self.category,
            base_uom=self.uom_pcs,
        )

        # Beneficiary Bank
        self.bank, _ = Bank.objects.get_or_create(
            code="VCB",
            defaults={"name": "Vietcombank", "swift_code": "BFTVVNVX"},
        )
        self.bank_account = CompanyBankAccount.objects.create(
            company=self.company,
            bank=self.bank,
            account_number="0011001234567",
            account_name="GLOBAL EXPORT JSC",
            currency=self.usd,
            swift_bic="BFTVVNVX",
        )

        # 5. Customer (Buyer)
        self.customer = Party.objects.create(
            company=self.company,
            code="BUYER-US-01",
            name="American Global Traders Inc",
            tax_code="US-99887766",
        )
        self.other_customer = Party.objects.create(
            company=self.company,
            code="BUYER-EU-02",
            name="European Imports GmbH",
            tax_code="DE-11223344",
        )

        # 6. Sales Order (Source)
        self.order = models.SalesOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="SO-2026-0001",
            document_date=self.today - timedelta(days=10),
            customer=self.customer,
            currency=self.usd,
            exchange_rate=Decimal("25000.0"),
            subtotal=Decimal("50000.0"),
            total_amount=Decimal("50000.0"),
            status=models.DocumentStatus.APPROVED,
            created_by=self.user,
        )
        self.order_line_1 = models.SalesOrderLine.objects.create(
            order=self.order,
            line_no=1,
            item=self.item_a,
            description="Robusta Coffee Beans Export Quality",
            uom=self.uom_pcs,
            quantity=Decimal("1000.0"),
            unit_price=Decimal("30.0"),
            tax_rate=self.tax_rate_0,
            line_total=Decimal("30000.0"),
        )
        self.order_line_2 = models.SalesOrderLine.objects.create(
            order=self.order,
            line_no=2,
            item=self.item_b,
            description="Black Pepper Special Grade",
            uom=self.uom_pcs,
            quantity=Decimal("500.0"),
            unit_price=Decimal("40.0"),
            tax_rate=self.tax_rate_0,
            line_total=Decimal("20000.0"),
        )

    # -------------------------------------------------------------------------
    # Test Cases
    # -------------------------------------------------------------------------

    def test_01_view_permissions_and_list_filter(self):
        """Test permission checking and list filter functionality (BR-SAL-14-01, AF-01)."""
        # Create sample commercial invoices
        inv1 = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HDTM-2026-0001",
            code="HDTM-2026-0001",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.DOCUMENT,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="100 Broadway, NY, USA",
            buyer_country="USA",
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.DRAFT,
            created_by=self.user,
        )
        inv2 = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HDTM-2026-0002",
            code="HDTM-2026-0002",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.ELECTRONIC,
            customer=self.other_customer,
            buyer_name=self.other_customer.name,
            buyer_address="Berlin, Germany",
            buyer_country="Germany",
            currency=self.usd,
            payment_terms="L/C at sight",
            status=models.CommercialInvoiceStatus.ISSUED,
            created_by=self.user,
        )

        # 1. Filter by customer
        res = self.client.get(f"/api/v1/sales/commercial-invoices/?customer={self.customer.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["code"], "HDTM-2026-0001")

        # 2. Filter by invoice form
        res_form = self.client.get("/api/v1/sales/commercial-invoices/?invoice_form=ELECTRONIC")
        self.assertEqual(res_form.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_form.data), 1)
        self.assertEqual(res_form.data[0]["code"], "HDTM-2026-0002")

        # 3. Filter by search
        res_search = self.client.get("/api/v1/sales/commercial-invoices/?search=Berlin")
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_search.data), 1)

    def test_02_eligible_source_orders_api(self):
        """Test eligible source orders endpoint and remaining quantity calculation (Step 3, AF-03)."""
        res = self.client.get(f"/api/v1/sales/commercial-invoices/eligible-source-orders/?customer_id={self.customer.id}&currency_id={self.usd.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        orders = res.data["orders"]
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["number"], "SO-2026-0001")
        lines = orders[0]["lines"]
        self.assertEqual(len(lines), 2)
        self.assertEqual(Decimal(lines[0]["remaining_quantity"]), Decimal("1000.0"))

    def test_03_create_commercial_invoice_document_form(self):
        """Test creating a document-form Commercial Invoice in DRAFT status (Step 2-7, BR-SAL-14-02, BR-SAL-14-07)."""
        payload = {
            "invoice_form": "DOCUMENT",
            "template_code": "COMM_INV_EN",
            "invoice_date": str(self.today),
            "customer": str(self.customer.id),
            "buyer_name": "American Global Traders Inc",
            "buyer_address": "Suite 500, 100 Broadway, NY, USA",
            "buyer_country": "USA",
            "buyer_tax_code": "US-99887766",
            "buyer_email": "importer@us-traders.com",
            "consignee_name": "American Global Logistics LLC",
            "consignee_address": "Port Newark, NJ, USA",
            "consignee_country": "USA",
            "currency": str(self.usd.id),
            "exchange_rate": "25000.0",
            "incoterms_term": "FOB",
            "incoterms_version": "2020",
            "incoterms_location": "Hai Phong Port",
            "incoterms": "FOB - Incoterms 2020 - Hai Phong Port",
            "payment_terms": "T/T 30 days after Bill of Lading date",
            "beneficiary_bank_account": str(self.bank_account.id),
            "transport_method": "SEA",
            "port_of_loading": "Hai Phong Port, Vietnam",
            "port_of_discharge": "New York Port, USA",
            "vessel_flight_no": "MAERSK PEARL V.2601",
            "bill_of_lading_number": "MSK-HP-NY-00123",
            "bill_of_lading_date": str(self.today),
            "freight_charge": "1500.00",
            "insurance_charge": "300.00",
            "other_charges": "200.00",
            "sales_order": str(self.order.id),
            "lines": [
                {
                    "line_no": 1,
                    "item": str(self.item_a.id),
                    "item_name": "Robusta Coffee Beans",
                    "description": "Vietnamese Robusta Coffee Beans Grade 1 Screen 18",
                    "hs_code": "0901.11",
                    "origin_country": "Vietnam",
                    "uom": str(self.uom_pcs.id),
                    "quantity": "500.00",
                    "unit_price": "30.00",
                    "discount_amount": "0.00",
                    "package_quantity": 500,
                    "net_weight": "30000.00",
                    "gross_weight": "30200.00",
                    "tax_rate": str(self.tax_rate_0.id),
                    "tax_rate_percentage": "0.00",
                    "source_order_line": str(self.order_line_1.id),
                }
            ],
        }
        res = self.client.post("/api/v1/sales/commercial-invoices/", data=payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data

        self.assertTrue(data["code"].startswith("HDTM-"))
        self.assertEqual(data["status"], "DRAFT")
        self.assertEqual(data["invoice_form"], "DOCUMENT")
        self.assertEqual(Decimal(data["total_lines_amount"]), Decimal("15000.00"))  # 500 * 30
        self.assertEqual(Decimal(data["total_charges"]), Decimal("2000.00"))        # 1500 + 300 + 200
        self.assertEqual(Decimal(data["total_amount"]), Decimal("17000.00"))         # 15000 + 2000

        # Check that 500 quantity is now held for order_line_1
        usage = calculate_source_order_line_usage(self.order_line_1)
        self.assertEqual(usage["held_quantity"], Decimal("500.00"))
        self.assertEqual(usage["remaining_quantity"], Decimal("500.00"))

    def test_04_validation_missing_required_buyer_or_description_or_payment(self):
        """Test rejection when missing buyer info, line description, or payment terms (EF-02)."""
        payload = {
            "invoice_form": "DOCUMENT",
            "customer": str(self.customer.id),
            "currency": str(self.usd.id),
            # Missing buyer_name, buyer_address, buyer_country, payment_terms
            "lines": [
                {
                    "description": "",  # Missing description
                    "quantity": "100.00",
                    "unit_price": "20.00",
                }
            ],
        }
        res = self.client.post("/api/v1/sales/commercial-invoices/", data=payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_05_validation_incoterms_required_for_goods(self):
        """Test rejection when invoice contains goods but lacks Incoterms (EF-02, BR-SAL-14-03)."""
        payload = {
            "invoice_form": "DOCUMENT",
            "customer": str(self.customer.id),
            "buyer_name": "American Global Traders Inc",
            "buyer_address": "NY, USA",
            "buyer_country": "USA",
            "currency": str(self.usd.id),
            "payment_terms": "T/T 30 days",
            "incoterms": "",  # Missing Incoterms
            "incoterms_term": "",
            "lines": [
                {
                    "item": str(self.item_a.id),
                    "description": "Robusta Coffee Beans",
                    "quantity": "100.00",
                    "unit_price": "20.00",
                }
            ],
        }
        res = self.client.post("/api/v1/sales/commercial-invoices/", data=payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("incoterms", str(res.data).lower())

    def test_06_validation_source_order_quantity_exceeded(self):
        """Test rejection when requested quantity exceeds available remaining quantity (BR-SAL-14-04, EF-03)."""
        payload = {
            "invoice_form": "DOCUMENT",
            "customer": str(self.customer.id),
            "buyer_name": "American Global Traders Inc",
            "buyer_address": "NY, USA",
            "buyer_country": "USA",
            "currency": str(self.usd.id),
            "payment_terms": "T/T 30 days",
            "incoterms": "FOB - Hai Phong Port",
            "lines": [
                {
                    "item": str(self.item_a.id),
                    "description": "Robusta Coffee Beans",
                    "quantity": "1500.00",  # Order only has 1000!
                    "unit_price": "30.00",
                    "source_order_line": str(self.order_line_1.id),
                }
            ],
        }
        res = self.client.post("/api/v1/sales/commercial-invoices/", data=payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vượt quá số lượng còn lại", str(res.data))

    def test_07_validation_mismatched_customer_or_currency_source(self):
        """Test rejection when source order belongs to a different customer or currency (BR-SAL-14-03, EF-03)."""
        payload = {
            "invoice_form": "DOCUMENT",
            "customer": str(self.other_customer.id),  # Different customer!
            "buyer_name": "European Imports GmbH",
            "buyer_address": "Berlin, Germany",
            "buyer_country": "Germany",
            "currency": str(self.usd.id),
            "payment_terms": "T/T 30 days",
            "incoterms": "CIF - Hamburg",
            "lines": [
                {
                    "item": str(self.item_a.id),
                    "description": "Robusta Coffee Beans",
                    "quantity": "100.00",
                    "unit_price": "30.00",
                    "source_order_line": str(self.order_line_1.id),
                }
            ],
        }
        res = self.client.post("/api/v1/sales/commercial-invoices/", data=payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("không cùng khách hàng", str(res.data))

    def test_08_validation_negative_charges_or_discount_exceeds_subtotal(self):
        """Test rejection when charges are negative or discount exceeds subtotal (EF-04, BR-SAL-14-06)."""
        payload = {
            "invoice_form": "DOCUMENT",
            "customer": str(self.customer.id),
            "buyer_name": "American Global Traders Inc",
            "buyer_address": "NY, USA",
            "buyer_country": "USA",
            "currency": str(self.usd.id),
            "payment_terms": "T/T 30 days",
            "incoterms": "FOB - Hai Phong Port",
            "freight_charge": "-500.00",  # Negative charge!
            "lines": [
                {
                    "item": str(self.item_a.id),
                    "description": "Robusta Coffee Beans",
                    "quantity": "100.00",
                    "unit_price": "30.00",
                    "discount_amount": "5000.00",  # Exceeds 100 * 30 = 3000!
                }
            ],
        }
        res = self.client.post("/api/v1/sales/commercial-invoices/", data=payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_09_update_draft_commercial_invoice(self):
        """Test updating a draft commercial invoice and recalculating totals (AF-05)."""
        # Create draft invoice
        inv = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HDTM-2026-0005",
            code="HDTM-2026-0005",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.DOCUMENT,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.DRAFT,
            created_by=self.user,
        )
        models.SalesCommercialInvoiceLine.objects.create(
            invoice=inv,
            line_no=1,
            item=self.item_a,
            description="Initial Description",
            quantity=Decimal("100.0"),
            unit_price=Decimal("30.0"),
            line_amount=Decimal("3000.0"),
            line_total=Decimal("3000.0"),
        )
        inv.total_amount = Decimal("3000.0")
        inv.save()

        # Update via API
        update_payload = {
            "buyer_name": "American Global Traders Inc - Updated",
            "buyer_address": "Suite 600, NY, USA",
            "buyer_country": "USA",
            "customer": str(self.customer.id),
            "currency": str(self.usd.id),
            "payment_terms": "T/T 60 days",
            "incoterms": "FOB - Hai Phong Port",
            "freight_charge": "400.00",
            "lines": [
                {
                    "line_no": 1,
                    "item": str(self.item_a.id),
                    "description": "Updated Robusta Beans",
                    "quantity": "200.00",
                    "unit_price": "30.00",
                    "discount_amount": "0.00",
                }
            ],
        }
        res = self.client.put(f"/api/v1/sales/commercial-invoices/{inv.id}/", data=update_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.buyer_name, "American Global Traders Inc - Updated")
        self.assertEqual(inv.total_lines_amount, Decimal("6000.00"))
        self.assertEqual(inv.total_amount, Decimal("6400.00"))  # 6000 + 400
        self.assertEqual(inv.version, 2)

    def test_10_delete_draft_commercial_invoice_releases_source_quantity(self):
        """Test deleting draft commercial invoice releases held source quantities (AF-09, BR-SAL-14-04)."""
        # Create draft with source line
        inv = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HDTM-2026-0006",
            code="HDTM-2026-0006",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.DOCUMENT,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.DRAFT,
            created_by=self.user,
        )
        models.SalesCommercialInvoiceLine.objects.create(
            invoice=inv,
            line_no=1,
            item=self.item_a,
            description="Robusta Coffee Beans",
            quantity=Decimal("300.0"),
            unit_price=Decimal("30.0"),
            source_order_line=self.order_line_1,
        )
        # Check held quantity
        usage_before = calculate_source_order_line_usage(self.order_line_1)
        self.assertEqual(usage_before["held_quantity"], Decimal("300.0"))

        # Delete
        res = self.client.delete(f"/api/v1/sales/commercial-invoices/{inv.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

        # Check held quantity is released
        usage_after = calculate_source_order_line_usage(self.order_line_1)
        self.assertEqual(usage_after["held_quantity"], Decimal("0.0"))
        self.assertEqual(usage_after["remaining_quantity"], Decimal("1000.0"))

    def test_11_cannot_edit_or_delete_locked_status(self):
        """Test blocking direct edit/delete on PUBLISHED or ISSUED invoices (EF-10)."""
        inv_published = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="CI-2026-0001",
            code="HDTM-2026-0007",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.DOCUMENT,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.PUBLISHED,
            created_by=self.user,
        )
        res_del = self.client.delete(f"/api/v1/sales/commercial-invoices/{inv_published.id}/")
        self.assertEqual(res_del.status_code, status.HTTP_400_BAD_REQUEST)

        res_put = self.client.put(f"/api/v1/sales/commercial-invoices/{inv_published.id}/", data={"buyer_name": "New Name"}, format="json")
        self.assertEqual(res_put.status_code, status.HTTP_400_BAD_REQUEST)

    def test_12_workflow_submit_approve_revision_rejection(self):
        """Test approval workflow lifecycle: submit, revision request, reject, approve (Step 8, AF-05, BR-SAL-14-09)."""
        inv = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HDTM-2026-0008",
            code="HDTM-2026-0008",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.DOCUMENT,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.DRAFT,
            created_by=self.user,
        )
        # 1. Submit approval
        res_sub = self.client.post(f"/api/v1/sales/commercial-invoices/{inv.id}/submit-approval/")
        self.assertEqual(res_sub.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertIn(inv.status, [models.CommercialInvoiceStatus.PENDING_APPROVAL, models.CommercialInvoiceStatus.APPROVED])

        # 2. If PENDING_APPROVAL, test request revision & reject
        if inv.status == models.CommercialInvoiceStatus.PENDING_APPROVAL:
            # Request revision
            res_rev = self.client.post(f"/api/v1/sales/commercial-invoices/{inv.id}/request-revision/", data={"comment": "Cần sửa đơn giá"})
            self.assertEqual(res_rev.status_code, status.HTTP_200_OK)
            inv.refresh_from_db()
            self.assertEqual(inv.status, models.CommercialInvoiceStatus.REVISION_REQUIRED)

            # Re-submit
            self.client.post(f"/api/v1/sales/commercial-invoices/{inv.id}/submit-approval/")
            # Approve
            res_app = self.client.post(f"/api/v1/sales/commercial-invoices/{inv.id}/approve/", data={"comment": "Đồng ý duyệt"})
            self.assertEqual(res_app.status_code, status.HTTP_200_OK)
            inv.refresh_from_db()
            self.assertEqual(inv.status, models.CommercialInvoiceStatus.APPROVED)

    def test_13_publish_commercial_invoice_document_form(self):
        """Test publishing a document-form Commercial Invoice (Step 9, BR-SAL-14-02)."""
        inv = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HDTM-2026-0009",
            code="HDTM-2026-0009",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.DOCUMENT,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.APPROVED,
            created_by=self.user,
        )
        models.SalesCommercialInvoiceLine.objects.create(
            invoice=inv,
            line_no=1,
            description="Robusta Coffee Beans",
            quantity=Decimal("100.0"),
            unit_price=Decimal("30.0"),
            source_order_line=self.order_line_1,
        )

        res = self.client.post(f"/api/v1/sales/commercial-invoices/{inv.id}/publish/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, models.CommercialInvoiceStatus.PUBLISHED)
        self.assertTrue(inv.invoice_number.startswith("CI-"))
        self.assertIn(".pdf", inv.pdf_file_url)

        # Quantity is now permanently used
        usage = calculate_source_order_line_usage(self.order_line_1)
        self.assertEqual(usage["used_quantity"], Decimal("100.0"))
        self.assertEqual(usage["held_quantity"], Decimal("0.0"))

    def test_14_create_new_version_from_published_invoice(self):
        """Test creating a new draft version from a published invoice (AF-06, BR-SAL-14-12, EF-10)."""
        # Original published invoice (version 1)
        inv = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="CI-2026-0002",
            code="HDTM-2026-0010",
            invoice_number="CI-2026-0002",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.DOCUMENT,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.PUBLISHED,
            document_version=1,
            is_current_version=True,
            created_by=self.user,
        )
        models.SalesCommercialInvoiceLine.objects.create(
            invoice=inv,
            line_no=1,
            description="Robusta Coffee Beans Grade 1",
            quantity=Decimal("200.0"),
            unit_price=Decimal("30.0"),
        )

        # Create new version
        res = self.client.post(f"/api/v1/sales/commercial-invoices/{inv.id}/create-new-version/")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_data = res.data

        # Original is no longer current version
        inv.refresh_from_db()
        self.assertFalse(inv.is_current_version)

        # New version is DRAFT, document_version = 2
        self.assertEqual(new_data["document_version"], 2)
        self.assertEqual(new_data["status"], "DRAFT")
        self.assertEqual(str(new_data["parent_invoice"]), str(inv.id))
        self.assertTrue(new_data["code"].endswith("-V2"))

    def test_15_issue_electronic_commercial_invoice_success(self):
        """Test issuing an electronic commercial invoice successfully (AF-04, BR-SAL-14-11, BR-SAL-14-13)."""
        inv_elec = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HDTM-2026-0011",
            code="HDTM-2026-0011",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.ELECTRONIC,
            template_code="COMM_EINV_01",
            invoice_series="1C26TEB",
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            buyer_tax_code="US-99887766",
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.APPROVED,
            customs_clearance_date=self.today,  # Same day
            created_by=self.user,
        )
        models.SalesCommercialInvoiceLine.objects.create(
            invoice=inv_elec,
            line_no=1,
            description="Robusta Coffee Beans",
            quantity=Decimal("100.0"),
            unit_price=Decimal("30.0"),
            tax_rate=self.tax_rate_0,
            tax_rate_percentage=Decimal("0.0"),
            line_amount=Decimal("3000.0"),
            line_total=Decimal("3000.0"),
        )
        inv_elec.total_amount = Decimal("3000.0")
        inv_elec.save()

        res = self.client.post(f"/api/v1/sales/commercial-invoices/{inv_elec.id}/issue/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        inv_elec.refresh_from_db()
        self.assertEqual(inv_elec.status, models.CommercialInvoiceStatus.ISSUED)
        self.assertTrue(len(inv_elec.invoice_number) > 0)
        self.assertIsNotNone(inv_elec.tax_invoice)
        self.assertTrue(inv_elec.xml_file_url.endswith(".xml"))
        self.assertTrue(inv_elec.pdf_file_url.endswith(".pdf"))

    def test_16_issue_electronic_customs_clearance_date_timing(self):
        """Test rejection when e-invoice date precedes customs clearance date (BR-SAL-14-10, EF-06)."""
        inv = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HDTM-2026-0012",
            code="HDTM-2026-0012",
            document_date=self.today - timedelta(days=5),
            invoice_date=self.today - timedelta(days=5),  # 5 days ago
            invoice_form=models.CommercialInvoiceForm.ELECTRONIC,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.APPROVED,
            customs_clearance_date=self.today,  # Cleared today -> invoice is before clearance!
            created_by=self.user,
        )
        res = self.client.post(f"/api/v1/sales/commercial-invoices/{inv.id}/issue/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ngày thông quan", str(res.data))

    def test_17_issue_failure_and_retry(self):
        """Test handling issue failure and subsequent retry (EF-07, AF-07)."""
        inv = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HDTM-2026-0013",
            code="HDTM-2026-0013",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.ELECTRONIC,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            buyer_tax_code="TRIGGER_FAIL",  # Triggers simulation failure
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.APPROVED,
            created_by=self.user,
        )
        models.SalesCommercialInvoiceLine.objects.create(
            invoice=inv,
            line_no=1,
            description="Coffee Beans",
            quantity=Decimal("10.0"),
            unit_price=Decimal("30.0"),
        )
        res_fail = self.client.post(f"/api/v1/sales/commercial-invoices/{inv.id}/issue/")
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        inv.refresh_from_db()
        self.assertEqual(inv.status, models.CommercialInvoiceStatus.ISSUE_FAILED)
        self.assertTrue(len(inv.issue_error_message) > 0)

        # Fix error and retry
        inv.buyer_tax_code = "US-VALID-TAX-ID"
        inv.save()
        res_retry = self.client.post(f"/api/v1/sales/commercial-invoices/{inv.id}/retry-issue/")
        self.assertEqual(res_retry.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, models.CommercialInvoiceStatus.ISSUED)

    def test_18_check_issue_status_polling(self):
        """Test polling status for an invoice in ISSUING state (EF-08, BR-SAL-14-14)."""
        inv = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HDTM-2026-0014",
            code="HDTM-2026-0014",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.ELECTRONIC,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.ISSUING,  # In issuing state
            created_by=self.user,
        )
        models.SalesCommercialInvoiceLine.objects.create(
            invoice=inv,
            line_no=1,
            description="Coffee Beans",
            quantity=Decimal("10.0"),
            unit_price=Decimal("30.0"),
        )
        res = self.client.post(f"/api/v1/sales/commercial-invoices/{inv.id}/check-issue-status/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, models.CommercialInvoiceStatus.ISSUED)
        self.assertTrue(len(inv.invoice_number) > 0)

    def test_19_preview_and_download_and_send_email(self):
        """Test preview, download-files, and send-email endpoints (Step 6, AF-08)."""
        inv = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="CI-2026-0015",
            code="HDTM-2026-0015",
            invoice_number="CI-2026-0015",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.DOCUMENT,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            buyer_email="buyer@global-traders.com",
            currency=self.usd,
            payment_terms="T/T 30 days",
            incoterms="FOB - Hai Phong Port",
            status=models.CommercialInvoiceStatus.PUBLISHED,
            pdf_file_url="/media/commercial_invoices/CI-2026-0015.pdf",
            created_by=self.user,
        )
        models.SalesCommercialInvoiceLine.objects.create(
            invoice=inv,
            line_no=1,
            description="Robusta Coffee Beans",
            quantity=Decimal("100.0"),
            unit_price=Decimal("30.0"),
            line_amount=Decimal("3000.0"),
            line_total=Decimal("3000.0"),
        )
        # 1. Preview
        res_prev = self.client.get(f"/api/v1/sales/commercial-invoices/{inv.id}/preview/")
        self.assertEqual(res_prev.status_code, status.HTTP_200_OK)
        self.assertEqual(res_prev.data["code"], "HDTM-2026-0015")
        self.assertIn("seller", res_prev.data)
        self.assertIn("buyer", res_prev.data)
        self.assertIn("shipment", res_prev.data)

        # 2. Download files
        res_dl = self.client.get(f"/api/v1/sales/commercial-invoices/{inv.id}/download-files/")
        self.assertEqual(res_dl.status_code, status.HTTP_200_OK)
        self.assertEqual(res_dl.data["pdf_file_url"], "/media/commercial_invoices/CI-2026-0015.pdf")

        # 3. Send email
        res_email = self.client.post(f"/api/v1/sales/commercial-invoices/{inv.id}/send-email/", data={"email": "buyer@global-traders.com"})
        self.assertEqual(res_email.status_code, status.HTTP_200_OK)

    def test_20_audit_log_and_link_service_integration(self):
        """Test Audit Log records and integration with UC-SAL-11 link services (BR-SAL-14-14, UC-SAL-11)."""
        inv = models.SalesCommercialInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HDTM-2026-0016",
            code="HDTM-2026-0016",
            document_date=self.today,
            invoice_date=self.today,
            invoice_form=models.CommercialInvoiceForm.DOCUMENT,
            customer=self.customer,
            buyer_name=self.customer.name,
            buyer_address="NY, USA",
            buyer_country="USA",
            currency=self.usd,
            payment_terms="T/T 30 days",
            status=models.CommercialInvoiceStatus.DRAFT,
            created_by=self.user,
        )
        line = models.SalesCommercialInvoiceLine.objects.create(
            invoice=inv,
            line_no=1,
            description="Robusta Coffee Beans",
            quantity=Decimal("100.0"),
            unit_price=Decimal("30.0"),
            line_amount=Decimal("3000.0"),
            line_total=Decimal("3000.0"),
        )
        # Link to SalesOrder via link_services (UC-SAL-11)
        link = create_document_link(
            request=None,
            data={
                "company": self.company.id,
                "source_document_type": "ORDER",
                "source_document_id": str(self.order.id),
                "target_document_type": "COMMERCIAL_INVOICE",
                "target_document_id": str(inv.id),
                "relation_type": models.LinkRelationType.INVOICING,
                "lines": [
                    {
                        "source_line_id": str(self.order_line_1.id),
                        "target_line_id": str(line.id),
                        "linked_quantity": "100.0",
                        "linked_amount": "3000.0",
                    }
                ],
            },
        )
        self.assertIsNotNone(link)

        links_found = get_document_links(self.company, "COMMERCIAL_INVOICE", inv.id)
        self.assertTrue(len(links_found) >= 1)
