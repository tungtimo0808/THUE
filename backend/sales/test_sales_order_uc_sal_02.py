from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts_receivable.models import Receivable
from audit_log.models import AuditLog
from general_ledger.models import JournalEntry
from iam.models import CompanyMembership
from organization.models import Company, Employee
from master_data.models import (
    Currency, Item, ItemUomConversion, Party, PartyAddress, PartyContact, PartyRole,
    PaymentMethod, PaymentTerm, TaxRate, UnitOfMeasure, Warehouse
)
from sales.models import (
    DeliveryStatus, DocumentStatus, InvoiceRequest, InvoiceRequestStatus,
    SalesDelivery, SalesDeliveryLine, SalesOrder, SalesOrderLine,
    SalesQuotation, SalesQuotationLine
)


class SalesOrderUcSal02Tests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(
            code="SAL02_CO",
            name="Sales Order Co",
            legal_name="Sales Order Company Ltd",
            tax_code="0109988776",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
        )
        self.branch = self.company.branches.first()

        self.maker_user = get_user_model().objects.create_superuser(
            username="so_maker", email="so_maker@example.com", password="password123"
        )
        self.approver_user = get_user_model().objects.create_superuser(
            username="so_approver", email="so_approver@example.com", password="password123"
        )

        # Setup employee for maker
        self.employee = Employee.objects.create(
            company=self.company,
            employee_code="NV001",
            full_name="Nguyễn Văn Phụ Trách",
            email="nv001@example.com",
            status="ACTIVE",
        )
        CompanyMembership.objects.create(
            company=self.company,
            user=self.maker_user.iam_account,
            employee=self.employee,
            created_by=self.maker_user.iam_account,
        )

        self.customer = Party.objects.create(
            company=self.company,
            code="CUST01",
            name="Công ty Khách Hàng Thử Nghiệm",
            tax_code="0312345678",
            default_currency=self.currency,
            status="ACTIVE",
        )
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)
        self.customer_contact = PartyContact.objects.create(
            party=self.customer,
            contact_name="Trần Thị Liên Hệ",
            phone="0901234567",
            email="lienhe@khachhang.vn",
            status="ACTIVE",
            is_default=True,
        )
        self.customer_address = PartyAddress.objects.create(
            party=self.customer,
            address_type="DELIVERY",
            address_line="123 Đường Bán Hàng, Phường 1, TP. HCM",
            is_default=True,
        )

        self.payment_term = PaymentTerm.objects.create(
            company=self.company,
            code="NET30",
            name="Thanh toán trong 30 ngày",
            scope="SALE",
            status="ACTIVE",
        )

        self.uom_cai = UnitOfMeasure.objects.create(
            company=self.company, code="CAI", name="Cái", decimal_places=0, status="ACTIVE"
        )
        self.uom_thung = UnitOfMeasure.objects.create(
            company=self.company, code="THUNG", name="Thùng", decimal_places=0, status="ACTIVE"
        )

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

        self.warehouse = Warehouse.objects.create(
            company=self.company,
            code="WH_MAIN",
            name="Kho Tổng",
            status="ACTIVE",
        )

        # Inventory Goods item
        self.item_goods = Item.objects.create(
            company=self.company,
            code="HANG01",
            name="Hàng Hóa Quản Lý Tồn Kho",
            item_type="GOODS",
            base_uom=self.uom_cai,
            sales_uom=self.uom_cai,
            sales_price=Decimal("100000"),
            sales_tax_rate=self.vat10,
            track_inventory=True,
            allow_sale=True,
            status="ACTIVE",
        )
        ItemUomConversion.objects.create(
            item=self.item_goods,
            from_uom=self.uom_thung,
            to_uom=self.uom_cai,
            factor=Decimal("10"),
        )

        # Service item
        self.item_service = Item.objects.create(
            company=self.company,
            code="DV01",
            name="Dịch Vụ Lắp Đặt Kỹ Thuật",
            item_type="SERVICE",
            base_uom=self.uom_cai,
            sales_uom=self.uom_cai,
            sales_price=Decimal("500000"),
            sales_tax_rate=self.vat10,
            track_inventory=False,
            allow_sale=True,
            status="ACTIVE",
        )

        self.client = APIClient()
        self.client.force_authenticate(self.maker_user)
        self.query = f"?company_id={self.company.id}"
        self.base_url = f"/api/v1/sales/orders/{self.query}"

    def test_01_order_defaults(self):
        """Test defaults endpoint returns correct initial values for UI form."""
        url = f"/api/v1/sales/orders/defaults/?company_id={self.company.id}&customer_id={self.customer.id}"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200, resp.data)
        data = resp.data

        self.assertEqual(data["document_date"], self.today.isoformat())
        self.assertEqual(data["currency"]["code"], "VND")
        self.assertEqual(data["exchange_rate"], "1")
        self.assertIsNotNone(data["assigned_employee"])
        self.assertEqual(data["assigned_employee"]["employee_code"], "NV001")

        cust_data = data["customer"]
        self.assertEqual(cust_data["code"], "CUST01")
        self.assertEqual(cust_data["contact_name"], "Trần Thị Liên Hệ")
        self.assertEqual(cust_data["contact_phone"], "0901234567")
        self.assertEqual(cust_data["customer_address"], "123 Đường Bán Hàng, Phường 1, TP. HCM")
        self.assertEqual(cust_data["delivery_address"], "123 Đường Bán Hàng, Phường 1, TP. HCM")

    def test_02_draft_creation_auto_numbering_and_precision_calculation(self):
        """Test creating draft order auto-generates number and calculates amounts with precision."""
        payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "payment_term": str(self.payment_term.id),
            "default_warehouse": str(self.warehouse.id),
            "notes": "Đơn thử nghiệm tính toán",
            "lines": [
                {
                    "item": str(self.item_goods.id),
                    "uom": str(self.uom_cai.id),
                    "warehouse": str(self.warehouse.id),
                    "quantity": "10",
                    "unit_price": "100000",
                    "discount_rate": "10",  # 10% discount on 1,000,000 -> 100,000
                    "tax_rate": str(self.vat10.id),  # 10% VAT on 900,000 -> 90,000
                },
                {
                    "item": str(self.item_service.id),
                    "uom": str(self.uom_cai.id),
                    "quantity": "2",
                    "unit_price": "500000",
                    "discount_amount": "50000",  # Direct discount amount
                    "tax_rate": str(self.vat0.id),  # 0% VAT
                },
            ],
        }

        resp = self.client.post(self.base_url, payload, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        data = resp.data

        # Check sequential auto number
        expected_number = f"SO-{self.today.year}-000001"
        self.assertEqual(data["number"], expected_number)
        self.assertEqual(data["status"], DocumentStatus.DRAFT)
        self.assertEqual(data["version"], 1)

        # Check inherited contact & addresses
        self.assertEqual(data["contact_name"], "Trần Thị Liên Hệ")
        self.assertEqual(data["customer_address"], "123 Đường Bán Hàng, Phường 1, TP. HCM")
        self.assertEqual(data["delivery_address"], "123 Đường Bán Hàng, Phường 1, TP. HCM")

        # Line 1:
        # Gross = 10 * 100,000 = 1,000,000
        # Discount = 100,000
        # Taxable = 900,000; Tax = 90,000; Total = 990,000
        line1 = data["lines"][0]
        self.assertEqual(Decimal(line1["discount_amount"]), Decimal("100000"))
        self.assertEqual(Decimal(line1["tax_amount"]), Decimal("90000"))
        self.assertEqual(Decimal(line1["line_total"]), Decimal("990000"))

        # Line 2:
        # Gross = 2 * 500,000 = 1,000,000
        # Discount = 50,000
        # Taxable = 950,000; Tax = 0; Total = 950,000
        line2 = data["lines"][1]
        self.assertIsNone(line2.get("warehouse"))
        self.assertEqual(Decimal(line2["discount_amount"]), Decimal("50000"))
        self.assertEqual(Decimal(line2["tax_amount"]), Decimal("0"))
        self.assertEqual(Decimal(line2["line_total"]), Decimal("950000"))

        # Order totals:
        # Subtotal: 2,000,000
        # Discount: 150,000
        # Tax: 90,000
        # Total: 1,940,000
        self.assertEqual(Decimal(data["subtotal"]), Decimal("2000000"))
        self.assertEqual(Decimal(data["discount_amount"]), Decimal("150000"))
        self.assertEqual(Decimal(data["tax_amount"]), Decimal("90000"))
        self.assertEqual(Decimal(data["total_amount"]), Decimal("1940000"))

        # Verify Audit Log was recorded
        self.assertTrue(AuditLog.objects.filter(company=self.company, module_code="SAL", action_code="CREATE").exists())

    def test_03_optimistic_concurrency_locking(self):
        """Test version check blocks stale updates (EF-08, BR-SAL-31)."""
        order = SalesOrder.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number="SO-TEST-LOCK",
            status=DocumentStatus.DRAFT,
            version=1,
            created_by=self.maker_user.iam_account,
        )
        SalesOrderLine.objects.create(
            order=order, line_no=1, item=self.item_goods, uom=self.uom_cai,
            warehouse=self.warehouse, quantity=Decimal("5"), unit_price=Decimal("100000"),
        )

        patch_url = f"/api/v1/sales/orders/{order.id}/{self.query}"

        # Conflict when sending incorrect version
        stale_resp = self.client.patch(patch_url, {"version": 99, "notes": "Cố ý ghi đè"}, format="json")
        self.assertEqual(stale_resp.status_code, 400)
        self.assertIn("version", stale_resp.data)

        # Success when sending correct version
        ok_resp = self.client.patch(patch_url, {"version": 1, "notes": "Cập nhật hợp lệ"}, format="json")
        self.assertEqual(ok_resp.status_code, 200, ok_resp.data)
        self.assertEqual(ok_resp.data["notes"], "Cập nhật hợp lệ")
        self.assertEqual(ok_resp.data["version"], 2)

    def test_04_validation_and_business_rules(self):
        """Test validations: line rules, delivery address for goods, inventory warehouse (BR-SAL-17, 18, 19)."""
        # 1. No lines
        resp = self.client.post(self.base_url, {
            "company": str(self.company.id), "customer": str(self.customer.id), "lines": []
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("lines", resp.data)

        # 2. Non-positive quantity
        resp = self.client.post(self.base_url, {
            "company": str(self.company.id), "customer": str(self.customer.id),
            "lines": [{"item": str(self.item_goods.id), "warehouse": str(self.warehouse.id), "quantity": "0", "unit_price": "100"}]
        }, format="json")
        self.assertEqual(resp.status_code, 400)

        # 3. Negative unit price
        resp = self.client.post(self.base_url, {
            "company": str(self.company.id), "customer": str(self.customer.id),
            "lines": [{"item": str(self.item_goods.id), "warehouse": str(self.warehouse.id), "quantity": "1", "unit_price": "-10"}]
        }, format="json")
        self.assertEqual(resp.status_code, 400)

        # 4. Discount amount exceeding line gross
        resp = self.client.post(self.base_url, {
            "company": str(self.company.id), "customer": str(self.customer.id),
            "lines": [{"item": str(self.item_goods.id), "warehouse": str(self.warehouse.id), "quantity": "1", "unit_price": "100", "discount_amount": "200"}]
        }, format="json")
        self.assertEqual(resp.status_code, 400)

        # 5. Goods tracking inventory without warehouse (BR-SAL-19)
        resp = self.client.post(self.base_url, {
            "company": str(self.company.id), "customer": str(self.customer.id),
            "lines": [{"item": str(self.item_goods.id), "quantity": "1", "unit_price": "100"}]
        }, format="json")
        self.assertEqual(resp.status_code, 400)

        # 6. Requested delivery date earlier than document date (BR-SAL-18)
        resp = self.client.post(self.base_url, {
            "company": str(self.company.id), "customer": str(self.customer.id),
            "default_warehouse": str(self.warehouse.id),
            "requested_delivery_date": str(self.today - timedelta(days=2)),
            "lines": [{"item": str(self.item_goods.id), "warehouse": str(self.warehouse.id), "quantity": "1", "unit_price": "100"}]
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("requested_delivery_date", resp.data)

    def test_05_submit_withdraw_flow(self):
        """Test submitting to PENDING_APPROVAL and withdrawing back to DRAFT (AF-04, BR-SAL-29)."""
        order = SalesOrder.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number="SO-SUBMIT-1",
            status=DocumentStatus.DRAFT,
            approval_required=True,
            created_by=self.maker_user.iam_account,
        )
        SalesOrderLine.objects.create(
            order=order, line_no=1, item=self.item_goods, uom=self.uom_cai,
            warehouse=self.warehouse, quantity=Decimal("5"), unit_price=Decimal("100000"),
        )

        # Submit order
        submit_url = f"/api/v1/sales/orders/{order.id}/submit/{self.query}"
        resp = self.client.post(submit_url, {"comment": "Trình duyệt đơn"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], DocumentStatus.PENDING_APPROVAL)
        self.assertIsNotNone(resp.data["submitted_at"])

        # Direct edit while PENDING_APPROVAL is blocked (BR-SAL-29)
        edit_url = f"/api/v1/sales/orders/{order.id}/{self.query}"
        blocked_edit = self.client.patch(edit_url, {"notes": "Sửa lén"}, format="json")
        self.assertEqual(blocked_edit.status_code, 400)

        # Withdraw without reason fails
        withdraw_url = f"/api/v1/sales/orders/{order.id}/withdraw/{self.query}"
        fail_withdraw = self.client.post(withdraw_url, {}, format="json")
        self.assertEqual(fail_withdraw.status_code, 400)

        # Withdraw with reason succeeds -> back to DRAFT
        ok_withdraw = self.client.post(withdraw_url, {"reason": "Cần điều chỉnh số lượng"}, format="json")
        self.assertEqual(ok_withdraw.status_code, 200, ok_withdraw.data)
        self.assertEqual(ok_withdraw.data["status"], DocumentStatus.DRAFT)
        self.assertEqual(ok_withdraw.data["withdrawal_reason"], "Cần điều chỉnh số lượng")

        # Now editing is allowed
        allowed_edit = self.client.patch(edit_url, {"notes": "Đã điều chỉnh lại"}, format="json")
        self.assertEqual(allowed_edit.status_code, 200, allowed_edit.data)

    def test_06_approval_revision_reject_approve_flow(self):
        """Test approver actions: request revision, reject, and approve (AF-05)."""
        order = SalesOrder.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number="SO-APPR-1",
            status=DocumentStatus.DRAFT,
            approval_required=True,
            created_by=self.maker_user.iam_account,
        )
        SalesOrderLine.objects.create(
            order=order, line_no=1, item=self.item_goods, uom=self.uom_cai,
            warehouse=self.warehouse, quantity=Decimal("5"), unit_price=Decimal("100000"),
        )

        # Submit
        self.client.post(f"/api/v1/sales/orders/{order.id}/submit/{self.query}", {}, format="json")

        # Switch to approver
        self.client.force_authenticate(self.approver_user)

        # 1. Request revision requires comment
        rev_url = f"/api/v1/sales/orders/{order.id}/request-revision/{self.query}"
        fail_rev = self.client.post(rev_url, {}, format="json")
        self.assertEqual(fail_rev.status_code, 400)

        ok_rev = self.client.post(rev_url, {"comment": "Vui lòng xem lại điều khoản thanh toán"}, format="json")
        self.assertEqual(ok_rev.status_code, 200, ok_rev.data)
        self.assertEqual(ok_rev.data["status"], DocumentStatus.REVISION_REQUIRED)
        self.assertEqual(ok_rev.data["rejection_reason"], "Vui lòng xem lại điều khoản thanh toán")

        # Maker updates and re-submits
        self.client.force_authenticate(self.maker_user)
        self.client.patch(f"/api/v1/sales/orders/{order.id}/{self.query}", {"payment_term": str(self.payment_term.id)}, format="json")
        self.client.post(f"/api/v1/sales/orders/{order.id}/submit/{self.query}", {"comment": "Đã bổ sung"}, format="json")

        # Approver approves
        self.client.force_authenticate(self.approver_user)
        before_accounting = (JournalEntry.objects.count(), Receivable.objects.count())

        appr_url = f"/api/v1/sales/orders/{order.id}/approve/{self.query}"
        ok_appr = self.client.post(appr_url, {"comment": "Đồng ý phê duyệt"}, format="json")
        self.assertEqual(ok_appr.status_code, 200, ok_appr.data)
        self.assertEqual(ok_appr.data["status"], DocumentStatus.APPROVED)
        self.assertIsNotNone(ok_appr.data["approved_at"])

        # Post-condition check: confirming does NOT create GL journal entries or receivables (BR-SAL-02-06)
        self.assertEqual((JournalEntry.objects.count(), Receivable.objects.count()), before_accounting)

    def test_07_direct_confirm(self):
        """Test authorized direct confirmation without multi-tier approval."""
        order = SalesOrder.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number="SO-DIR-1",
            status=DocumentStatus.DRAFT,
            created_by=self.maker_user.iam_account,
        )
        SalesOrderLine.objects.create(
            order=order, line_no=1, item=self.item_goods, uom=self.uom_cai,
            warehouse=self.warehouse, quantity=Decimal("2"), unit_price=Decimal("100000"),
        )

        confirm_url = f"/api/v1/sales/orders/{order.id}/confirm/{self.query}"
        resp = self.client.post(confirm_url, {"comment": "Xác nhận bán trực tiếp"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], DocumentStatus.APPROVED)
        self.assertIsNotNone(resp.data["approved_at"])

    def test_08_prepare_from_sources_and_quotation_synthesis(self):
        """Test AF-02: preparing order from multiple quotations and verifying quotation links (BR-SAL-15, 16, 30)."""
        q1 = SalesQuotation.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number=f"BG-{self.today.year}-000101",
            valid_until=self.today + timedelta(days=15),
            status=DocumentStatus.ACCEPTED,
            payment_term=self.payment_term,
            created_by=self.maker_user.iam_account,
        )
        q1_line = SalesQuotationLine.objects.create(
            quotation=q1, line_no=1, item=self.item_goods, uom=self.uom_cai,
            quantity=Decimal("10"), unit_price=Decimal("95000"), discount_rate=Decimal("5"), tax_rate=self.vat10,
        )

        q2 = SalesQuotation.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number=f"BG-{self.today.year}-000102",
            valid_until=self.today + timedelta(days=15),
            status=DocumentStatus.ACCEPTED,
            payment_term=self.payment_term,
            created_by=self.maker_user.iam_account,
        )
        q2_line = SalesQuotationLine.objects.create(
            quotation=q2, line_no=1, item=self.item_service, uom=self.uom_cai,
            quantity=Decimal("2"), unit_price=Decimal("450000"), discount_rate=Decimal("0"), tax_rate=self.vat0,
        )

        # Call prepare-from-sources
        prep_url = f"/api/v1/sales/orders/prepare-from-sources/?company_id={self.company.id}&quotation_ids={q1.id},{q2.id}"
        resp = self.client.get(prep_url)
        self.assertEqual(resp.status_code, 200, resp.data)
        data = resp.data
        self.assertEqual(len(data["lines"]), 2)
        self.assertEqual(data["customer"], str(self.customer.id))
        self.assertEqual(data["payment_term"], str(self.payment_term.id))

        # Create order using source quotation lines
        order_payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "payment_term": str(self.payment_term.id),
            "default_warehouse": str(self.warehouse.id),
            "lines": [
                {
                    "item": str(self.item_goods.id),
                    "uom": str(self.uom_cai.id),
                    "warehouse": str(self.warehouse.id),
                    "quantity": "6",  # 6 out of 10 from q1
                    "unit_price": "95000",
                    "quotation_line": str(q1_line.id),
                }
            ],
        }
        order_resp = self.client.post(self.base_url, order_payload, format="json")
        self.assertEqual(order_resp.status_code, 201, order_resp.data)

        # Verify ordering more than remaining from q1 fails (EF-03)
        fail_payload = {
            "company": str(self.company.id),
            "customer": str(self.customer.id),
            "default_warehouse": str(self.warehouse.id),
            "lines": [
                {
                    "item": str(self.item_goods.id),
                    "uom": str(self.uom_cai.id),
                    "warehouse": str(self.warehouse.id),
                    "quantity": "5",  # 6 + 5 = 11 > 10
                    "unit_price": "95000",
                    "quotation_line": str(q1_line.id),
                }
            ],
        }
        fail_resp = self.client.post(self.base_url, fail_payload, format="json")
        self.assertEqual(fail_resp.status_code, 400)
        self.assertIn("lines", fail_resp.data)

    def test_09_cancel_order_rules(self):
        """Test AF-06 & BR-SAL-02-02 cancellation conditions."""
        order = SalesOrder.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number="SO-CANCEL-1",
            status=DocumentStatus.APPROVED,
            created_by=self.maker_user.iam_account,
        )
        line = SalesOrderLine.objects.create(
            order=order, line_no=1, item=self.item_goods, uom=self.uom_cai,
            warehouse=self.warehouse, quantity=Decimal("10"), unit_price=Decimal("100000"),
        )

        cancel_url = f"/api/v1/sales/orders/{order.id}/cancel/{self.query}"

        # 1. Cancel without reason fails
        fail_resp = self.client.post(cancel_url, {}, format="json")
        self.assertEqual(fail_resp.status_code, 400)

        # 2. Cancel blocked if confirmed delivery exists
        deliv = SalesDelivery.objects.create(
            company=self.company,
            order=order,
            number="GH-CANCEL-1",
            delivery_date=self.today,
            delivery_type="GOODS",
            warehouse=self.warehouse,
            status=DeliveryStatus.CONFIRMED,
            created_by=self.maker_user.iam_account,
        )
        SalesDeliveryLine.objects.create(
            delivery=deliv, order_line=line, quantity=Decimal("4")
        )
        line.delivered_quantity = Decimal("4")
        line.save(update_fields=("delivered_quantity",))

        blocked_resp = self.client.post(cancel_url, {"reason": "Khách hủy"}, format="json")
        self.assertEqual(blocked_resp.status_code, 400)
        self.assertIn("Đơn đã thực hiện một phần", str(blocked_resp.data))

        # 3. Clean unexecuted order can be cancelled
        order2 = SalesOrder.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number="SO-CANCEL-2",
            status=DocumentStatus.DRAFT,
            created_by=self.maker_user.iam_account,
        )
        SalesOrderLine.objects.create(
            order=order2, line_no=1, item=self.item_goods, uom=self.uom_cai,
            warehouse=self.warehouse, quantity=Decimal("2"), unit_price=Decimal("100000"),
        )
        cancel2_url = f"/api/v1/sales/orders/{order2.id}/cancel/{self.query}"
        ok_cancel = self.client.post(cancel2_url, {"reason": "Khách đổi kế hoạch"}, format="json")
        self.assertEqual(ok_cancel.status_code, 200, ok_cancel.data)
        self.assertEqual(ok_cancel.data["status"], DocumentStatus.CANCELLED)
        self.assertEqual(ok_cancel.data["cancellation_reason"], "Khách đổi kế hoạch")

    def test_10_close_order_rules(self):
        """Test AF-07 & BR-SAL-02-03: closing order sets closed_quantity and reason."""
        order = SalesOrder.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number="SO-CLOSE-1",
            status=DocumentStatus.APPROVED,
            created_by=self.maker_user.iam_account,
        )
        line = SalesOrderLine.objects.create(
            order=order, line_no=1, item=self.item_goods, uom=self.uom_cai,
            warehouse=self.warehouse, quantity=Decimal("10"), delivered_quantity=Decimal("6"),
            unit_price=Decimal("100000"),
        )

        close_url = f"/api/v1/sales/orders/{order.id}/close/{self.query}"

        # 1. Close without reason when remainder exists fails
        fail_close = self.client.post(close_url, {}, format="json")
        self.assertEqual(fail_close.status_code, 400)

        # 2. Close with reason succeeds
        ok_close = self.client.post(close_url, {"reason": "Khách không lấy 4 sản phẩm còn lại"}, format="json")
        self.assertEqual(ok_close.status_code, 200, ok_close.data)
        self.assertEqual(ok_close.data["status"], DocumentStatus.COMPLETED)
        self.assertEqual(ok_close.data["close_reason"], "Khách không lấy 4 sản phẩm còn lại")

        # Verify line closed_quantity
        line.refresh_from_db()
        self.assertEqual(line.closed_quantity, Decimal("4"))
        self.assertEqual(line.remaining_quantity, Decimal("0"))

    def test_11_delete_draft_order(self):
        """Test AF-08 & BR-SAL-02-02: deleting draft order."""
        # Setup quotation
        quote = SalesQuotation.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number=f"BG-{self.today.year}-000201",
            valid_until=self.today + timedelta(days=15),
            status=DocumentStatus.ORDERED,
            created_by=self.maker_user.iam_account,
        )

        order = SalesOrder.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number="SO-DEL-1",
            status=DocumentStatus.DRAFT,
            quotation=quote,
            created_by=self.maker_user.iam_account,
        )
        SalesOrderLine.objects.create(
            order=order, line_no=1, item=self.item_goods, uom=self.uom_cai,
            warehouse=self.warehouse, quantity=Decimal("1"), unit_price=Decimal("100000"),
        )

        del_url = f"/api/v1/sales/orders/{order.id}/{self.query}"
        resp = self.client.delete(del_url)
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(SalesOrder.objects.filter(pk=order.pk).exists())

        # Quotation status reverted to ACCEPTED
        quote.refresh_from_db()
        self.assertEqual(quote.status, DocumentStatus.ACCEPTED)

    def test_12_feasibility_check(self):
        """Test check-feasibility endpoint for inventory, credit and pricing."""
        order = SalesOrder.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number="SO-FEAS-1",
            status=DocumentStatus.DRAFT,
            created_by=self.maker_user.iam_account,
        )
        SalesOrderLine.objects.create(
            order=order, line_no=1, item=self.item_goods, uom=self.uom_cai,
            warehouse=self.warehouse, quantity=Decimal("5"), unit_price=Decimal("100000"),
        )

        check_url = f"/api/v1/sales/orders/{order.id}/check-feasibility/{self.query}"
        resp = self.client.get(check_url)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIn("stock_check", resp.data)
        self.assertIn("credit_check", resp.data)
        self.assertIn("pricing_check", resp.data)

    def test_13_invoice_request_from_eligible_lines(self):
        """Test AF-09, BR-SAL-02-04, 02-05: invoice request preparation & creation."""
        order = SalesOrder.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            document_date=self.today,
            number="SO-INV-1",
            status=DocumentStatus.APPROVED,
            invoicing_policy="ORDER",  # Based on confirmed order
            created_by=self.maker_user.iam_account,
        )
        line = SalesOrderLine.objects.create(
            order=order, line_no=1, item=self.item_goods, uom=self.uom_cai,
            warehouse=self.warehouse, quantity=Decimal("10"), unit_price=Decimal("100000"),
            tax_rate=self.vat10,
        )

        # 1. Check eligible lines
        el_url = f"/api/v1/sales/orders/{order.id}/invoice-eligible-lines/{self.query}"
        el_resp = self.client.get(el_url)
        self.assertEqual(el_resp.status_code, 200, el_resp.data)
        self.assertEqual(len(el_resp.data), 1)
        self.assertEqual(Decimal(el_resp.data[0]["remaining_eligible_quantity"]), Decimal("10"))

        # 2. Exceeding quantity raises 400 (EF-10)
        req_url = f"/api/v1/sales/orders/{order.id}/create-invoice-request/{self.query}"
        fail_req = self.client.post(req_url, {
            "lines": [{"order_line": str(line.id), "quantity": "15"}]
        }, format="json")
        self.assertEqual(fail_req.status_code, 400)
        self.assertIn("lines", fail_req.data)

        # 3. Create valid invoice request
        ok_req = self.client.post(req_url, {
            "lines": [{"order_line": str(line.id), "quantity": "6"}]
        }, format="json")
        self.assertEqual(ok_req.status_code, 201, ok_req.data)
        inv_id = ok_req.data["id"]
        self.assertEqual(InvoiceRequest.objects.get(pk=inv_id).status, InvoiceRequestStatus.DRAFT)

        # 4. Check eligible lines remainder after creation (10 - 6 = 4)
        el_resp2 = self.client.get(el_url)
        self.assertEqual(Decimal(el_resp2.data[0]["remaining_eligible_quantity"]), Decimal("4"))
