from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts_payable.models import SupplierInvoice
from common_services.models import FiscalPeriod, FiscalYear
from general_ledger.models import Account, AccountingPeriod, ChartOfAccounts
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserAccount, UserRoleAssignment
from master_data.models import Currency, Item, Party, UnitOfMeasure, Warehouse
from organization.models import Branch, Company
from purchases import test_goods_purchase
from purchases.models import (
    DocumentStatus,
    GoodsPurchase,
    GoodsPurchaseLine,
    PurchaseDiscount,
    PurchaseDiscountLine,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseReturn,
    PurchaseReturnLine,
)


class PurchaseOrderTrackingTests(TestCase):
    def setUp(self):
        test_goods_purchase.GoodsPurchaseTests.setUp(self)
        self.tracking_url = f"/api/v1/purchases/tracking/?company_id={self.company.pk}"

        # Standard approved PO
        self.po = PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            currency=self.company.accounting_currency,
            number="PO-2026-001",
            document_date=self.day,
            delivery_date=self.day + timedelta(days=7),
            status=DocumentStatus.APPROVED,
            subtotal=Decimal("1000.0000"),
            total_amount=Decimal("1000.0000"),
            created_by=self.actor,
            notes="Đơn mua hàng thử nghiệm",
        )
        self.po_line = PurchaseOrderLine.objects.create(
            order=self.po,
            line_no=1,
            item=self.item,
            uom=self.uom,
            warehouse=self.warehouse,
            quantity=Decimal("10.000000"),
            unit_price=Decimal("100.0000"),
            expected_delivery_date=self.day + timedelta(days=7),
        )

    def test_exclude_draft_po_by_default_and_detail(self):
        """BR-PUR-TRK-04, EF-06: Draft POs never appear in tracking."""
        draft_po = PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            currency=self.company.accounting_currency,
            number="PO-DRAFT-01",
            document_date=self.day,
            status=DocumentStatus.DRAFT,
            created_by=self.actor,
        )
        res = self.client.get(self.tracking_url)
        self.assertEqual(res.status_code, 200)
        numbers = [item["number"] for item in res.data["results"]]
        self.assertIn("PO-2026-001", numbers)
        self.assertNotIn("PO-DRAFT-01", numbers)

        # Retrieve draft should return 404 EF-06
        detail_res = self.client.get(f"/api/v1/purchases/tracking/{draft_po.pk}/?company_id={self.company.pk}")
        self.assertEqual(detail_res.status_code, 404)
        self.assertEqual(detail_res.data["detail"], "Đơn mua không tồn tại hoặc bạn không còn quyền truy cập.")

    def test_date_range_validation(self):
        """EF-03: Ngày bắt đầu không được lớn hơn ngày kết thúc."""
        res = self.client.get(
            f"{self.tracking_url}&order_date_from={self.day + timedelta(days=5)}&order_date_to={self.day}"
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data[0], "Ngày bắt đầu không được lớn hơn ngày kết thúc.")

        res_del = self.client.get(
            f"{self.tracking_url}&expected_delivery_date_from={self.day + timedelta(days=5)}&expected_delivery_date_to={self.day}"
        )
        self.assertEqual(res_del.status_code, 400)
        self.assertEqual(res_del.data[0], "Ngày bắt đầu không được lớn hơn ngày kết thúc.")

    def test_filter_by_code_and_supplier(self):
        """1.1 Filtering by order code and supplier."""
        other_supplier = Party.objects.create(company=self.company, code="S2", name="Supplier 2", status="ACTIVE")
        PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=other_supplier,
            currency=self.company.accounting_currency,
            number="PO-OTHER-999",
            document_date=self.day,
            status=DocumentStatus.APPROVED,
            created_by=self.actor,
        )

        # By code
        res = self.client.get(f"{self.tracking_url}&code=2026-001")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["number"], "PO-2026-001")

        # By supplier
        res_s = self.client.get(f"{self.tracking_url}&supplier_id={self.supplier.pk}")
        self.assertEqual(res_s.status_code, 200)
        self.assertEqual(res_s.data["count"], 1)
        self.assertEqual(res_s.data["results"][0]["number"], "PO-2026-001")

    def test_empty_results_af_02(self):
        """AF-02: Message when no orders match."""
        res = self.client.get(f"{self.tracking_url}&code=NONEXISTENT")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 0)
        self.assertEqual(res.data["results"], [])
        self.assertEqual(res.data["message"], "Không tìm thấy đơn mua phù hợp với điều kiện tìm kiếm.")

    def test_goods_receiving_and_returns_and_over_received(self):
        """
        BR-PUR-TRK-07, 08, 09, 10, 11, 21, 22, AF-03:
        Verify net received = received - returned, over-received alert, return demotes status.
        """
        # Initially: NOT_RECEIVED
        res = self.client.get(f"/api/v1/purchases/tracking/{self.po.pk}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 200)
        line_data = res.data["lines"][0]
        self.assertEqual(line_data["receiving_status"], "NOT_RECEIVED")
        self.assertEqual(Decimal(str(line_data["remaining_quantity"])), Decimal("10.000000"))

        # Step 1: Post Goods Purchase for 6 units -> PARTIALLY_RECEIVED
        gp1 = GoodsPurchase.objects.create(
            company=self.company,
            branch=self.branch,
            number="GP-001",
            document_date=self.day,
            posting_date=self.day,
            purchase_type="WAREHOUSE",
            supplier=self.supplier,
            purchase_order=self.po,
            receiving_warehouse=self.warehouse,
            payment_type="UNPAID",
            status="POSTED",
            subtotal=Decimal("600"),
            total_amount=Decimal("600"),
            created_by=self.actor,
        )
        gp1_line = GoodsPurchaseLine.objects.create(
            purchase=gp1,
            line_no=1,
            item=self.item,
            uom=self.uom,
            warehouse=self.warehouse,
            order_line=self.po_line,
            quantity=Decimal("6.000000"),
            unit_price=Decimal("100.0000"),
            debit_account=self.debit,
            credit_account=self.credit,
            pre_tax_amount=Decimal("600.0000"),
            total_amount=Decimal("600.0000"),
        )

        res = self.client.get(f"/api/v1/purchases/tracking/{self.po.pk}/?company_id={self.company.pk}")
        line_data = res.data["lines"][0]
        self.assertEqual(line_data["receiving_status"], "PARTIALLY_RECEIVED")
        self.assertEqual(Decimal(str(line_data["received_quantity"])), Decimal("6.000000"))
        self.assertEqual(Decimal(str(line_data["net_received_quantity"])), Decimal("6.000000"))
        self.assertEqual(Decimal(str(line_data["remaining_quantity"])), Decimal("4.000000"))
        self.assertEqual(Decimal(str(line_data["progress_percent"])), Decimal("60.00"))

        # Step 2: Post Goods Purchase for 4 more units -> FULLY_RECEIVED
        gp2 = GoodsPurchase.objects.create(
            company=self.company,
            branch=self.branch,
            number="GP-002",
            document_date=self.day,
            posting_date=self.day,
            purchase_type="WAREHOUSE",
            supplier=self.supplier,
            purchase_order=self.po,
            receiving_warehouse=self.warehouse,
            payment_type="UNPAID",
            status="POSTED",
            subtotal=Decimal("400"),
            total_amount=Decimal("400"),
            created_by=self.actor,
        )
        gp2_line = GoodsPurchaseLine.objects.create(
            purchase=gp2,
            line_no=1,
            item=self.item,
            uom=self.uom,
            warehouse=self.warehouse,
            order_line=self.po_line,
            quantity=Decimal("4.000000"),
            unit_price=Decimal("100.0000"),
            debit_account=self.debit,
            credit_account=self.credit,
            pre_tax_amount=Decimal("400.0000"),
            total_amount=Decimal("400.0000"),
        )

        res = self.client.get(f"/api/v1/purchases/tracking/{self.po.pk}/?company_id={self.company.pk}")
        line_data = res.data["lines"][0]
        self.assertEqual(line_data["receiving_status"], "FULLY_RECEIVED")
        self.assertEqual(Decimal(str(line_data["remaining_quantity"])), Decimal("0"))
        self.assertEqual(Decimal(str(line_data["progress_percent"])), Decimal("100.00"))

        # Step 3: BR-PUR-TRK-22: Post return of 3 units -> reverts from FULLY_RECEIVED to PARTIALLY_RECEIVED
        ret = PurchaseReturn.objects.create(
            company=self.company,
            branch=self.branch,
            number="RET-001",
            document_date=self.day,
            posting_date=self.day,
            original_purchase=gp1,
            supplier=self.supplier,
            warehouse=self.warehouse,
            reason="Defective goods",
            handling="REDUCE_PAYABLE",
            status="POSTED",
            subtotal=Decimal("300"),
            total_amount=Decimal("300"),
            created_by=self.actor,
        )
        PurchaseReturnLine.objects.create(
            document=ret,
            line_no=1,
            original_line=gp1_line,
            item=self.item,
            uom=self.uom,
            quantity=Decimal("3.000000"),
            unit_price=Decimal("100.0000"),
            discount_rate=Decimal("0"),
            debit_account=self.debit,
            credit_account=self.credit,
            pre_tax_amount=Decimal("300.0000"),
            total_amount=Decimal("300.0000"),
        )

        res = self.client.get(f"/api/v1/purchases/tracking/{self.po.pk}/?company_id={self.company.pk}")
        line_data = res.data["lines"][0]
        self.assertEqual(line_data["receiving_status"], "PARTIALLY_RECEIVED")
        self.assertEqual(Decimal(str(line_data["received_quantity"])), Decimal("10.000000"))
        self.assertEqual(Decimal(str(line_data["returned_quantity"])), Decimal("3.000000"))
        self.assertEqual(Decimal(str(line_data["net_received_quantity"])), Decimal("7.000000"))
        self.assertEqual(Decimal(str(line_data["remaining_quantity"])), Decimal("3.000000"))
        self.assertEqual(Decimal(str(line_data["progress_percent"])), Decimal("70.00"))

        # Step 4: AF-03, BR-PUR-TRK-11: Over-receive: post 5 more units -> net received = 12 > 10
        gp3 = GoodsPurchase.objects.create(
            company=self.company,
            branch=self.branch,
            number="GP-003",
            document_date=self.day,
            posting_date=self.day,
            purchase_type="WAREHOUSE",
            supplier=self.supplier,
            purchase_order=self.po,
            receiving_warehouse=self.warehouse,
            payment_type="UNPAID",
            status="POSTED",
            subtotal=Decimal("500"),
            total_amount=Decimal("500"),
            created_by=self.actor,
        )
        GoodsPurchaseLine.objects.create(
            purchase=gp3,
            line_no=1,
            item=self.item,
            uom=self.uom,
            warehouse=self.warehouse,
            order_line=self.po_line,
            quantity=Decimal("5.000000"),
            unit_price=Decimal("100.0000"),
            debit_account=self.debit,
            credit_account=self.credit,
            pre_tax_amount=Decimal("500.0000"),
            total_amount=Decimal("500.0000"),
        )

        res = self.client.get(f"/api/v1/purchases/tracking/{self.po.pk}/?company_id={self.company.pk}")
        line_data = res.data["lines"][0]
        self.assertEqual(line_data["receiving_status"], "FULLY_RECEIVED")
        self.assertEqual(Decimal(str(line_data["net_received_quantity"])), Decimal("12.000000"))
        self.assertEqual(Decimal(str(line_data["remaining_quantity"])), Decimal("0"))
        self.assertTrue(line_data["is_over_received"])
        self.assertEqual(Decimal(str(line_data["over_received_quantity"])), Decimal("2.000000"))
        # Progress is capped at 100% per BR-PUR-TRK-21
        self.assertEqual(Decimal(str(line_data["progress_percent"])), Decimal("100.00"))

    def test_service_tracking_with_discount_and_af_04(self):
        """
        AF-04, BR-PUR-TRK-14, 15, 16:
        Service tracking by pre-tax amount; discount reduces remaining payable obligation.
        """
        service_item = Item.objects.create(
            company=self.company,
            code="SVC-DEV",
            name="Development Service",
            item_type="SERVICE",
            status="ACTIVE",
            allow_purchase=True,
            track_inventory=False,
        )
        service_po = PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            currency=self.company.accounting_currency,
            number="PO-SVC-01",
            document_date=self.day,
            delivery_date=self.day + timedelta(days=10),
            status=DocumentStatus.APPROVED,
            subtotal=Decimal("2000.0000"),
            total_amount=Decimal("2000.0000"),
            created_by=self.actor,
        )
        service_line = PurchaseOrderLine.objects.create(
            order=service_po,
            line_no=1,
            item=service_item,
            uom=self.uom,
            quantity=Decimal("1.000000"),
            unit_price=Decimal("2000.0000"),
            expected_delivery_date=self.day + timedelta(days=10),
        )

        # Post Service Purchase for 1200 pre-tax
        sp = GoodsPurchase.objects.create(
            company=self.company,
            branch=self.branch,
            number="SP-001",
            document_date=self.day,
            posting_date=self.day,
            purchase_type="SERVICE",
            supplier=self.supplier,
            purchase_order=service_po,
            payment_type="UNPAID",
            status="POSTED",
            subtotal=Decimal("1200"),
            total_amount=Decimal("1200"),
            created_by=self.actor,
        )
        sp_line = GoodsPurchaseLine.objects.create(
            purchase=sp,
            line_no=1,
            item=service_item,
            uom=self.uom,
            order_line=service_line,
            quantity=Decimal("1.000000"),
            unit_price=Decimal("1200.0000"),
            debit_account=self.debit,
            credit_account=self.credit,
            pre_tax_amount=Decimal("1200.0000"),
            total_amount=Decimal("1200.0000"),
        )

        # Post Purchase Discount for 300 pre-tax
        disc = PurchaseDiscount.objects.create(
            company=self.company,
            branch=self.branch,
            number="DISC-001",
            document_date=self.day,
            posting_date=self.day,
            original_purchase=sp,
            supplier=self.supplier,
            method="AMOUNT",
            handling="REDUCE_PAYABLE",
            status="POSTED",
            pre_tax_amount=Decimal("300.0000"),
            total_amount=Decimal("300.0000"),
            created_by=self.actor,
        )
        PurchaseDiscountLine.objects.create(
            document=disc,
            line_no=1,
            original_line=sp_line,
            item=service_item,
            uom=self.uom,
            pre_tax_amount=Decimal("300.0000"),
            total_amount=Decimal("300.0000"),
            debit_account=self.debit,
            credit_account=self.credit,
        )

        res = self.client.get(f"/api/v1/purchases/tracking/{service_po.pk}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 200)
        s_line = res.data["lines"][0]
        self.assertTrue(s_line["is_service"])
        self.assertEqual(Decimal(str(s_line["accepted_value"])), Decimal("1200.0000"))
        self.assertEqual(Decimal(str(s_line["discounted_value"])), Decimal("300.0000"))
        # 2000 - 1200 - 300 = 500 remaining
        self.assertEqual(Decimal(str(s_line["remaining_service_value"])), Decimal("500.0000"))
        # Progress: (1200 + 300) / 2000 = 75.00%
        self.assertEqual(Decimal(str(s_line["progress_percent"])), Decimal("75.00"))

    def test_invoicing_status_transitions_and_over_invoicing(self):
        """
        BR-PUR-TRK-23 to 29, AF-05, AF-09:
        NOT_INVOICED -> PARTIALLY_INVOICED -> FULLY_INVOICED -> OVER_INVOICED.
        """
        # Initially AF-09: NOT_INVOICED
        res = self.client.get(f"/api/v1/purchases/tracking/{self.po.pk}/?company_id={self.company.pk}")
        self.assertEqual(res.data["summary"]["invoicing_status"], "NOT_INVOICED")
        self.assertEqual(Decimal(str(res.data["summary"]["invoiced_pre_tax_amount"])), Decimal("0"))

        # Link partial valid invoice: 600
        inv1 = SupplierInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            purchase_order=self.po,
            supplier_tax_code="1234567890",
            invoice_series="AA/26E",
            invoice_number="000101",
            invoice_date=self.day,
            currency=self.company.accounting_currency,
            subtotal=Decimal("600"),
            total_amount=Decimal("600"),
            validation_status="VALID",
            status="POSTED",
            created_by=self.actor,
        )
        res = self.client.get(f"/api/v1/purchases/tracking/{self.po.pk}/?company_id={self.company.pk}")
        self.assertEqual(res.data["summary"]["invoicing_status"], "PARTIALLY_INVOICED")
        self.assertEqual(Decimal(str(res.data["summary"]["invoiced_pre_tax_amount"])), Decimal("600.0000"))

        # Link second invoice to reach 1000: FULLY_INVOICED
        inv2 = SupplierInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            purchase_order=self.po,
            supplier_tax_code="1234567890",
            invoice_series="AA/26E",
            invoice_number="000102",
            invoice_date=self.day,
            currency=self.company.accounting_currency,
            subtotal=Decimal("400"),
            total_amount=Decimal("400"),
            validation_status="VALID",
            status="POSTED",
            created_by=self.actor,
        )
        res = self.client.get(f"/api/v1/purchases/tracking/{self.po.pk}/?company_id={self.company.pk}")
        self.assertEqual(res.data["summary"]["invoicing_status"], "FULLY_INVOICED")
        self.assertEqual(Decimal(str(res.data["summary"]["invoiced_pre_tax_amount"])), Decimal("1000.0000"))

        # Link third invoice exceeding order value: AF-05, BR-PUR-TRK-28: OVER_INVOICED
        inv3 = SupplierInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            purchase_order=self.po,
            supplier_tax_code="1234567890",
            invoice_series="AA/26E",
            invoice_number="000103",
            invoice_date=self.day,
            currency=self.company.accounting_currency,
            subtotal=Decimal("200"),
            total_amount=Decimal("200"),
            validation_status="VALID",
            status="POSTED",
            created_by=self.actor,
        )
        res = self.client.get(f"/api/v1/purchases/tracking/{self.po.pk}/?company_id={self.company.pk}")
        self.assertEqual(res.data["summary"]["invoicing_status"], "OVER_INVOICED")
        self.assertEqual(res.data["summary"]["invoicing_status_display"], "Nhận vượt")
        self.assertEqual(Decimal(str(res.data["summary"]["difference_invoice_amount"])), Decimal("200.0000"))

        # Cancelled or invalid invoice must be ignored (BR-PUR-TRK-29)
        inv3.status = "CANCELLED"
        inv3.save()
        res = self.client.get(f"/api/v1/purchases/tracking/{self.po.pk}/?company_id={self.company.pk}")
        self.assertEqual(res.data["summary"]["invoicing_status"], "FULLY_INVOICED")

    def test_overdue_calculation_and_completed_orders(self):
        """
        BR-PUR-TRK-30, 31, 32, 33, AF-06, AF-07:
        Overdue flags and days calculation; completed orders never overdue.
        """
        # Create an order with past delivery date
        past_delivery = self.day - timedelta(days=5)
        overdue_po = PurchaseOrder.objects.create(
            company=self.company,
            branch=self.branch,
            supplier=self.supplier,
            currency=self.company.accounting_currency,
            number="PO-OVERDUE-01",
            document_date=self.day - timedelta(days=10),
            delivery_date=past_delivery,
            status=DocumentStatus.APPROVED,
            subtotal=Decimal("500"),
            total_amount=Decimal("500"),
            created_by=self.actor,
        )
        PurchaseOrderLine.objects.create(
            order=overdue_po,
            line_no=1,
            item=self.item,
            uom=self.uom,
            warehouse=self.warehouse,
            quantity=Decimal("5.000000"),
            unit_price=Decimal("100.0000"),
            expected_delivery_date=past_delivery,
        )

        res = self.client.get(f"/api/v1/purchases/tracking/{overdue_po.pk}/?company_id={self.company.pk}")
        self.assertTrue(res.data["summary"]["is_overdue"])
        self.assertEqual(res.data["summary"]["overdue_days"], (date.today() - past_delivery).days)

        # When order is completed (BR-PUR-TRK-33), is_overdue becomes False
        from django.utils import timezone
        overdue_po.status = DocumentStatus.COMPLETED
        overdue_po.closed_at = timezone.now()
        overdue_po.save()

        res_comp = self.client.get(f"/api/v1/purchases/tracking/{overdue_po.pk}/?company_id={self.company.pk}")
        self.assertFalse(res_comp.data["summary"]["is_overdue"])
        self.assertEqual(res_comp.data["summary"]["overdue_days"], 0)

    def test_detail_timeline_and_empty_execution_message(self):
        """AF-08, Step 31: Verification of timeline and execution messages."""
        # Unexecuted PO
        res = self.client.get(f"/api/v1/purchases/tracking/{self.po.pk}/?company_id={self.company.pk}")
        self.assertFalse(res.data["has_execution_documents"])
        self.assertEqual(res.data["execution_message"], "Đơn mua chưa phát sinh chứng từ thực hiện.")
        self.assertEqual(len(res.data["timeline"]), 1)
        self.assertEqual(res.data["timeline"][0]["document_type"], "PURCHASE_ORDER")

    def test_document_preview_and_permissions(self):
        """
        Steps 32-34, BR-PUR-TRK-03, EF-07, EF-11:
        Previewing related documents and permission checking.
        """
        gp = GoodsPurchase.objects.create(
            company=self.company,
            branch=self.branch,
            number="GP-PREVIEW",
            document_date=self.day,
            posting_date=self.day,
            purchase_type="WAREHOUSE",
            supplier=self.supplier,
            purchase_order=self.po,
            receiving_warehouse=self.warehouse,
            payment_type="UNPAID",
            status="POSTED",
            subtotal=Decimal("200"),
            total_amount=Decimal("200"),
            created_by=self.actor,
        )

        # Preview valid doc
        url = f"/api/v1/purchases/tracking/{self.po.pk}/document-preview/?company_id={self.company.pk}&document_type=GOODS_PURCHASE&document_id={gp.pk}"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["number"], "GP-PREVIEW")

        # Preview non-existent doc EF-07
        import uuid
        url_fake = f"/api/v1/purchases/tracking/{self.po.pk}/document-preview/?company_id={self.company.pk}&document_type=GOODS_PURCHASE&document_id={uuid.uuid4()}"
        res_fake = self.client.get(url_fake)
        self.assertEqual(res_fake.status_code, 404)
        self.assertEqual(res_fake.data["detail"], "Chứng từ không còn tồn tại hoặc đã được cập nhật.")

    def test_csv_export(self):
        """AF-12, BR-PUR-TRK-36: Export data in CSV format."""
        export_url = f"/api/v1/purchases/tracking/export/?company_id={self.company.pk}"
        res = self.client.get(export_url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "text/csv; charset=utf-8-sig")
        content = res.content.decode("utf-8-sig")
        self.assertIn("Mã đơn mua", content)
        self.assertIn("PO-2026-001", content)
        self.assertIn("Tiến độ thực hiện (%)", content)

    def test_iam_permissions_ef_01_and_ef_02(self):
        """EF-01, EF-02: Missing permission and missing company scope."""
        # Unauthenticated
        unauth_client = APIClient()
        res = unauth_client.get(self.tracking_url)
        self.assertEqual(res.status_code, 401)

        # Non-superuser without permissions
        normal_user = get_user_model().objects.create_user(username="viewer", email="viewer@example.test", password="password")
        normal_client = APIClient()
        normal_client.force_authenticate(normal_user)

        res_noperm = normal_client.get(self.tracking_url)
        self.assertEqual(res_noperm.status_code, 403)
        self.assertEqual(res_noperm.data["detail"], "Bạn không có quyền theo dõi thực hiện đơn mua.")

        # Missing company scope EF-02
        res_nocomp = self.client.get("/api/v1/purchases/tracking/")
        self.assertEqual(res_nocomp.status_code, 400)
        self.assertIn("Không xác định được phạm vi dữ liệu của tài khoản", str(res_nocomp.data))
