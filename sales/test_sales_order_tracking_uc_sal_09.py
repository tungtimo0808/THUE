from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts_receivable.models import Receivable, ReceivableStatus
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Item, Party, PartyRole, PaymentTerm, UnitOfMeasure, Warehouse
from organization.models import Branch, Company, Employee
from sales.models import (
    DeliveryStatus,
    DocumentStatus,
    GoodsSale,
    GoodsSaleLine,
    SalesAllowance,
    SalesAllowanceLine,
    SalesDelivery,
    SalesDeliveryLine,
    SalesInvoice,
    SalesInvoiceLine,
    SalesOrder,
    SalesOrderLine,
    SalesReturn,
    SalesReturnLine,
    ServiceSale,
    ServiceSaleLine,
)


class SalesOrderTrackingUcSal09Tests(TestCase):
    def setUp(self):
        self.today = date(2026, 10, 9)
        self.currency, _ = Currency.objects.get_or_create(
            code="VND", defaults={"name": "Việt Nam Đồng", "is_active": True}
        )
        self.company = Company.objects.create(
            code="CTY_SAL_TRK",
            name="Công Ty Theo Dõi Đơn Bán",
            legal_name="Công Ty Cổ Phần Theo Dõi Đơn Bán",
            tax_code="0109996666",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.branch = Branch.objects.create(
            company=self.company, code="CN_TRK_01", name="Chi nhánh Bán hàng 01", status="ACTIVE"
        )
        self.uom = UnitOfMeasure.objects.create(
            company=self.company, code="CAI", name="Cái", status="ACTIVE"
        )
        self.item_goods = Item.objects.create(
            company=self.company,
            base_uom=self.uom,
            code="SP_TRK_01",
            name="Sản Phẩm Máy Tính",
            item_type="GOODS",
            status="ACTIVE",
            allow_sale=True,
            track_inventory=True,
        )
        self.item_service = Item.objects.create(
            company=self.company,
            base_uom=self.uom,
            code="DV_TRK_01",
            name="Dịch Vụ Cài Đặt",
            item_type="SERVICE",
            status="ACTIVE",
            allow_sale=True,
            track_inventory=False,
        )
        self.warehouse = Warehouse.objects.create(
            company=self.company, branch=self.branch, code="KHO_TRK_01", name="Kho Theo Dõi", status="ACTIVE"
        )
        self.payment_term = PaymentTerm.objects.create(
            company=self.company, code="NET30", name="Thanh toán 30 ngày", scope="SALE", due_days=30, status="ACTIVE"
        )
        self.customer = Party.objects.create(
            company=self.company, code="KH_TRK_01", name="Khách Hàng An Tâm", default_currency=self.currency, status="ACTIVE"
        )
        PartyRole.objects.create(party=self.customer, role_type="CUSTOMER", active_from=self.today)
        self.employee = Employee.objects.create(
            company=self.company, employee_code="NV_TRK_01", full_name="Trần Văn Kinh Doanh", status="ACTIVE"
        )

        # Users & Roles
        auth_user = get_user_model().objects.create_user(username="sal-tracking-usr", password="password")
        self.user_account = auth_user.iam_account
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.user_account, created_by=self.user_account
        )
        self.tracking_role = Role.objects.create(
            company=self.company, code="SAL_TRACKING_ROLE", name="Theo dõi đơn bán"
        )
        UserRoleAssignment.objects.create(
            company_membership=self.membership, role=self.tracking_role, assigned_by=self.user_account
        )

        auth_unauth = get_user_model().objects.create_user(username="sal-unauth-usr", password="password")
        self.unauth_account = auth_unauth.iam_account
        self.unauth_membership = CompanyMembership.objects.create(
            company=self.company, user=self.unauth_account, created_by=self.unauth_account
        )
        self.guest_role = Role.objects.create(company=self.company, code="GUEST_ROLE", name="Khách")
        UserRoleAssignment.objects.create(
            company_membership=self.unauth_membership, role=self.guest_role, assigned_by=self.unauth_account
        )

        # Clients
        self.client = APIClient()
        self.client.force_authenticate(auth_user)

        self.unauth_client = APIClient()
        self.unauth_client.force_authenticate(auth_unauth)

        # Grant permissions
        self.grant_permissions(self.tracking_role, [
            "SAL.TRACKING.VIEW",
            "SAL.TRACKING.EXPORT",
            "SAL.ORDER.VIEW",
        ])

        # URLs
        self.tracking_list_url = f"/api/v1/sales/tracking/?company_id={self.company.pk}"
        self.export_url = f"/api/v1/sales/tracking/export/?company_id={self.company.pk}"

    def grant_permissions(self, role, perm_codes):
        for code in perm_codes:
            perm = Permission.objects.filter(code=code).first()
            if perm:
                RolePermission.objects.get_or_create(role=role, permission=perm, defaults={"effect": "ALLOW"})

    def create_sales_order(self, number="SO-TRK-0001", status=DocumentStatus.APPROVED, qty=Decimal("10"), price=Decimal("1000000"), requested_delivery_date=None, invoicing_policy="ORDER"):
        order = SalesOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number=number,
            document_date=self.today,
            requested_delivery_date=requested_delivery_date or (self.today + timedelta(days=5)),
            status=status,
            customer=self.customer,
            currency=self.currency,
            assigned_employee=self.employee,
            payment_term=self.payment_term,
            subtotal=qty * price,
            total_amount=qty * price,
            invoicing_policy=invoicing_policy,
            created_by=self.user_account,
            version=1,
        )
        line = SalesOrderLine.objects.create(
            order=order,
            line_no=1,
            item=self.item_goods,
            uom=self.uom,
            warehouse=self.warehouse,
            quantity=qty,
            unit_price=price,
            line_total=qty * price,
        )
        return order, line

    # 1. Pre-condition: Only confirmed/approved orders are tracked
    def test_01_tracking_list_excludes_draft_and_unconfirmed_orders(self):
        """Danh sách theo dõi loại trừ đơn Nháp, Chờ duyệt, Bị từ chối (Pre-condition)."""
        self.create_sales_order(number="SO-DRAFT", status=DocumentStatus.DRAFT)
        self.create_sales_order(number="SO-PENDING", status=DocumentStatus.PENDING_APPROVAL)
        self.create_sales_order(number="SO-REJECTED", status=DocumentStatus.REJECTED)
        order_ok, _ = self.create_sales_order(number="SO-CONFIRMED", status=DocumentStatus.APPROVED)

        res = self.client.get(self.tracking_list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["number"], "SO-CONFIRMED")

    # 2. Fulfillment progress states
    def test_02_fulfillment_progress_states(self):
        """Kiểm tra các trạng thái tiến độ giao hàng: Chưa thực hiện, Thực hiện một phần, Hoàn tất, Kết thúc phần còn lại (BR-SAL-09-04)."""
        order, line = self.create_sales_order(qty=Decimal("10"))

        # 2.1 Chưa thực hiện
        res1 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data["summary"]["fulfillment_status"], "NOT_STARTED")
        self.assertEqual(res1.data["summary"]["fulfillment_label"], "Chưa thực hiện")
        self.assertEqual(Decimal(res1.data["summary"]["fulfillment_rate"]), Decimal("0.00"))

        # 2.2 Thực hiện một phần (Giao 4/10)
        delivery = SalesDelivery.objects.create(
            company=self.company,
            order=order,
            number="XK-TRK-01",
            delivery_date=self.today,
            delivery_type="GOODS",
            warehouse=self.warehouse,
            status=DeliveryStatus.CONFIRMED,
            created_by=self.user_account,
        )
        SalesDeliveryLine.objects.create(
            delivery=delivery,
            order_line=line,
            quantity=Decimal("4"),
        )
        res2 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res2.data["summary"]["fulfillment_status"], "PARTIALLY_FULFILLED")
        self.assertEqual(res2.data["summary"]["fulfillment_label"], "Thực hiện một phần")
        self.assertEqual(Decimal(res2.data["summary"]["fulfillment_rate"]), Decimal("40.00"))
        self.assertEqual(Decimal(res2.data["summary"]["total_delivered_quantity"]), Decimal("4.0000"))
        self.assertEqual(Decimal(res2.data["summary"]["total_remaining_quantity"]), Decimal("6.0000"))

        # 2.3 Hoàn tất (Giao nốt 6/10)
        delivery2 = SalesDelivery.objects.create(
            company=self.company,
            order=order,
            number="XK-TRK-02",
            delivery_date=self.today,
            delivery_type="GOODS",
            warehouse=self.warehouse,
            status=DeliveryStatus.CONFIRMED,
            created_by=self.user_account,
        )
        SalesDeliveryLine.objects.create(
            delivery=delivery2,
            order_line=line,
            quantity=Decimal("6"),
        )
        res3 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res3.data["summary"]["fulfillment_status"], "FULFILLED")
        self.assertEqual(res3.data["summary"]["fulfillment_label"], "Hoàn tất")
        self.assertEqual(Decimal(res3.data["summary"]["fulfillment_rate"]), Decimal("100.00"))
        self.assertEqual(Decimal(res3.data["summary"]["total_remaining_quantity"]), Decimal("0.0000"))

        # 2.4 Kết thúc phần còn lại (Đóng đơn khi còn dư)
        order_closed, line_closed = self.create_sales_order(number="SO-TRK-CLOSED", qty=Decimal("10"))
        # Giao 5, đóng 5
        deliv_closed = SalesDelivery.objects.create(
            company=self.company,
            order=order_closed,
            number="XK-TRK-03",
            delivery_date=self.today,
            delivery_type="GOODS",
            status=DeliveryStatus.CONFIRMED,
            created_by=self.user_account,
        )
        SalesDeliveryLine.objects.create(delivery=deliv_closed, order_line=line_closed, quantity=Decimal("5"))
        line_closed.closed_quantity = Decimal("5")
        line_closed.save()
        order_closed.status = DocumentStatus.CLOSED
        order_closed.save()

        res4 = self.client.get(f"/api/v1/sales/tracking/{order_closed.pk}/?company_id={self.company.pk}")
        self.assertEqual(res4.data["summary"]["fulfillment_status"], "CLOSED_REMAINDER")
        self.assertEqual(res4.data["summary"]["fulfillment_label"], "Kết thúc phần còn lại")

    # 3. Sales recording progress (BR-SAL-09-05)
    def test_03_sales_recording_progress_br_sal_09_05(self):
        """Ghi nhận bán hàng chỉ tính chứng từ Đã ghi sổ POSTED; chứng từ DRAFT/Chờ duyệt không tính (BR-SAL-09-05)."""
        order, line = self.create_sales_order(qty=Decimal("10"))

        # 3.1 Chưa ghi nhận
        res1 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res1.data["summary"]["sales_status"], "NOT_RECORDED")
        self.assertEqual(Decimal(res1.data["summary"]["sales_rate"]), Decimal("0.00"))

        # 3.2 Lập chứng từ bán hàng nhưng ở DRAFT -> Vẫn NOT_RECORDED
        gs_draft = GoodsSale.objects.create(
            company=self.company,
            number="BH-DRAFT-01",
            document_date=self.today,
            posting_date=self.today,
            status=DocumentStatus.DRAFT,
            customer=self.customer,
            currency=self.currency,
            sales_order=order,
            created_by=self.user_account,
        )
        GoodsSaleLine.objects.create(
            sale=gs_draft,
            line_no=1,
            item=self.item_goods,
            uom=self.uom,
            warehouse=self.warehouse,
            quantity=Decimal("5"),
            unit_price=Decimal("1000000"),
            line_total=Decimal("5000000"),
            order_line=line,
            receivable_or_payment_account_id=self.create_dummy_account().id,
            revenue_account_id=self.create_dummy_account().id,
            tax_account_id=self.create_dummy_account().id,
            cogs_account_id=self.create_dummy_account().id,
            inventory_account_id=self.create_dummy_account().id,
        )
        res2 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res2.data["summary"]["sales_status"], "NOT_RECORDED")

        # 3.3 Chuyển sang POSTED -> Trở thành PARTIALLY_RECORDED (5/10 = 50%)
        gs_draft.status = DocumentStatus.POSTED
        gs_draft.save()
        res3 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res3.data["summary"]["sales_status"], "PARTIALLY_RECORDED")
        self.assertEqual(Decimal(res3.data["summary"]["sales_rate"]), Decimal("50.00"))
        self.assertEqual(Decimal(res3.data["summary"]["total_recorded_sales_quantity"]), Decimal("5.0000"))

    # 4. Invoicing progress and policies (BR-SAL-09-06)
    def test_04_invoicing_policy_order_vs_delivery_br_sal_09_06(self):
        """Chính sách lập hóa đơn theo Đơn hàng (ORDER) vs theo Giao hàng (DELIVERY) (BR-SAL-09-06)."""
        # 4.1 Theo giao hàng: chưa giao hàng thì NOT_READY
        order_deliv, line_deliv = self.create_sales_order(number="SO-POL-DELIV", qty=Decimal("10"), invoicing_policy="DELIVERY")
        res_deliv = self.client.get(f"/api/v1/sales/tracking/{order_deliv.pk}/?company_id={self.company.pk}")
        self.assertEqual(res_deliv.data["summary"]["invoicing_status"], "NOT_READY")
        self.assertEqual(res_deliv.data["summary"]["invoicing_label"], "Chưa đến bước lập hóa đơn")

        # Giao hàng 5 -> chuyển sang NOT_INVOICED
        deliv = SalesDelivery.objects.create(
            company=self.company,
            order=order_deliv,
            number="XK-POL-01",
            delivery_date=self.today,
            delivery_type="GOODS",
            status=DeliveryStatus.CONFIRMED,
            created_by=self.user_account,
        )
        SalesDeliveryLine.objects.create(delivery=deliv, order_line=line_deliv, quantity=Decimal("5"))
        res_deliv2 = self.client.get(f"/api/v1/sales/tracking/{order_deliv.pk}/?company_id={self.company.pk}")
        self.assertEqual(res_deliv2.data["summary"]["invoicing_status"], "NOT_INVOICED")

        # 4.2 Theo đơn hàng: hóa đơn chưa phát hành tính vào pending_invoice_quantity, phát hành tính vào invoiced_quantity
        order_ord, line_ord = self.create_sales_order(number="SO-POL-ORD", qty=Decimal("10"), invoicing_policy="ORDER")
        inv = SalesInvoice.objects.create(
            company=self.company,
            number="HD-TRK-01",
            document_date=self.today,
            invoice_date=self.today,
            status=DocumentStatus.DRAFT,
            customer=self.customer,
            seller_name="Công Ty",
            seller_tax_code="0109996666",
            buyer_name="Khách Hàng",
            invoice_series="1C26TAA",
            currency=self.currency,
            sales_order=order_ord,
            created_by=self.user_account,
        )
        inv_line = SalesInvoiceLine.objects.create(
            invoice=inv,
            line_no=1,
            item=self.item_goods,
            item_name="Sản Phẩm Máy Tính",
            uom=self.uom,
            quantity=Decimal("6"),
            unit_price=Decimal("1000000"),
            amount=Decimal("6000000"),
            line_total=Decimal("6000000"),
            order_line=line_ord,
        )
        # Hóa đơn nháp: pending = 6, invoiced = 0
        res_ord = self.client.get(f"/api/v1/sales/tracking/{order_ord.pk}/?company_id={self.company.pk}")
        self.assertEqual(Decimal(res_ord.data["summary"]["total_pending_invoice_quantity"]), Decimal("6.0000"))
        self.assertEqual(Decimal(res_ord.data["summary"]["total_invoiced_quantity"]), Decimal("0.0000"))
        self.assertEqual(res_ord.data["summary"]["invoicing_status"], "NOT_INVOICED")

        # Phát hành hóa đơn: invoiced = 6, pending = 0 -> PARTIALLY_INVOICED
        inv.status = SalesInvoice.Status.ISSUED
        inv.invoice_number = "0000001"
        inv.issued_at = timezone.now()
        inv.save()
        res_ord2 = self.client.get(f"/api/v1/sales/tracking/{order_ord.pk}/?company_id={self.company.pk}")
        self.assertEqual(Decimal(res_ord2.data["summary"]["total_invoiced_quantity"]), Decimal("6.0000"))
        self.assertEqual(Decimal(res_ord2.data["summary"]["total_pending_invoice_quantity"]), Decimal("0.0000"))
        self.assertEqual(res_ord2.data["summary"]["invoicing_status"], "PARTIALLY_INVOICED")
        self.assertEqual(Decimal(res_ord2.data["summary"]["invoicing_rate"]), Decimal("60.00"))

    # 5. Payment and receivable tracking
    def test_05_payment_and_receivable_tracking_br_sal_09_07_08_09(self):
        """Công nợ và thanh toán: chưa bán thì NO_RECEIVABLE (không coi toàn bộ đơn là công nợ), bán xong ghi nhận công nợ và trừ giảm trừ (BR-SAL-09-07..09)."""
        order, line = self.create_sales_order(qty=Decimal("10"), price=Decimal("1000000"))  # Đơn 10tr

        # 5.1 Chưa phát sinh bán -> NO_RECEIVABLE
        res1 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res1.data["summary"]["payment_status"], "NO_RECEIVABLE")
        self.assertEqual(res1.data["summary"]["payment_label"], "Chưa phát sinh phải thu")
        self.assertEqual(Decimal(res1.data["summary"]["total_receivable_incurred"]), Decimal("0.0000"))

        # 5.2 Ghi nhận bán 10tr chưa thu tiền -> UNPAID, phát sinh phải thu 10tr
        rec = Receivable.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            original_amount=Decimal("10000000"),
            collected_amount=Decimal("0"),
            balance=Decimal("10000000"),
            status=ReceivableStatus.OPEN,
            due_date=self.today + timedelta(days=30),
        )
        gs = GoodsSale.objects.create(
            company=self.company,
            number="BH-PAY-01",
            document_date=self.today,
            posting_date=self.today,
            status=DocumentStatus.POSTED,
            customer=self.customer,
            currency=self.currency,
            sales_order=order,
            total_amount=Decimal("10000000"),
            payment_type="UNPAID",
            receivable=rec,
            created_by=self.user_account,
        )
        GoodsSaleLine.objects.create(
            sale=gs,
            line_no=1,
            item=self.item_goods,
            uom=self.uom,
            warehouse=self.warehouse,
            quantity=Decimal("10"),
            unit_price=Decimal("1000000"),
            line_total=Decimal("10000000"),
            order_line=line,
            receivable_or_payment_account_id=self.create_dummy_account().id,
            revenue_account_id=self.create_dummy_account().id,
            tax_account_id=self.create_dummy_account().id,
            cogs_account_id=self.create_dummy_account().id,
            inventory_account_id=self.create_dummy_account().id,
        )
        res2 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res2.data["summary"]["payment_status"], "UNPAID")
        self.assertEqual(Decimal(res2.data["summary"]["total_receivable_incurred"]), Decimal("10000000.0000"))
        self.assertEqual(Decimal(res2.data["summary"]["remaining_receivable_amount"]), Decimal("10000000.0000"))

        # 5.3 Thu 4tr -> PARTIALLY_PAID (40%)
        rec.collected_amount = Decimal("4000000")
        rec.balance = Decimal("6000000")
        rec.status = ReceivableStatus.PARTIALLY_PAID
        rec.save()

        res3 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res3.data["summary"]["payment_status"], "PARTIALLY_PAID")
        self.assertEqual(Decimal(res3.data["summary"]["total_collected_amount"]), Decimal("4000000.0000"))
        self.assertEqual(Decimal(res3.data["summary"]["remaining_receivable_amount"]), Decimal("6000000.0000"))
        self.assertEqual(Decimal(res3.data["summary"]["payment_rate"]), Decimal("40.00"))

        # 5.4 Giảm trừ 6tr do hàng trả lại -> Hết phải thu do giảm trừ (SETTLED_BY_CREDIT)
        ret = SalesReturn.objects.create(
            company=self.company,
            number="TL-TRK-01",
            document_date=self.today,
            posting_date=self.today,
            status=DocumentStatus.POSTED,
            customer=self.customer,
            currency=self.currency,
            goods_sale=gs,
            total_amount=Decimal("6000000"),
            return_reason="Khách trả lại 6 cái",
            created_by=self.user_account,
        )
        res4 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res4.data["summary"]["payment_status"], "SETTLED_BY_CREDIT")
        self.assertEqual(res4.data["summary"]["payment_label"], "Không còn phải thu")
        self.assertEqual(Decimal(res4.data["summary"]["remaining_receivable_amount"]), Decimal("0.0000"))

    # 6. Delivery Overdue alert (BR-SAL-09-10)
    def test_06_delivery_overdue_alert_br_sal_09_10(self):
        """Quá hạn giao khi ngày hiện tại sau ngày dự kiến và còn số lượng phải thực hiện (BR-SAL-09-10)."""
        # Hạn giao hôm qua, chưa giao cái nào -> Quá hạn
        order, _ = self.create_sales_order(requested_delivery_date=self.today - timedelta(days=2))
        res = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertTrue(res.data["summary"]["delivery_overdue"])
        self.assertTrue(res.data["summary"]["has_warning"])
        self.assertIn("Quá hạn giao hàng", res.data["summary"]["warning_messages"][0])

        # Lọc danh sách theo overdue_type=DELIVERY_OVERDUE
        res_filter = self.client.get(f"{self.tracking_list_url}&overdue_type=DELIVERY_OVERDUE")
        self.assertEqual(res_filter.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_filter.data["results"]), 1)

    # 7. Payment Overdue alert (BR-SAL-09-10)
    def test_07_payment_overdue_alert_br_sal_09_10(self):
        """Quá hạn thanh toán khi sau hạn thanh toán và công nợ còn phải thu lớn hơn 0 (BR-SAL-09-10)."""
        order, line = self.create_sales_order()
        rec = Receivable.objects.create(
            company=self.company,
            customer=self.customer,
            currency=self.currency,
            original_amount=Decimal("10000000"),
            collected_amount=Decimal("0"),
            balance=Decimal("10000000"),
            status=ReceivableStatus.OPEN,
            due_date=self.today - timedelta(days=5),  # Quá hạn 5 ngày
        )
        GoodsSale.objects.create(
            company=self.company,
            number="BH-OVERDUE-01",
            document_date=self.today,
            posting_date=self.today,
            status=DocumentStatus.POSTED,
            customer=self.customer,
            currency=self.currency,
            sales_order=order,
            total_amount=Decimal("10000000"),
            payment_type="UNPAID",
            receivable=rec,
            due_date=self.today - timedelta(days=5),
            created_by=self.user_account,
        )
        res = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertTrue(res.data["summary"]["payment_overdue"])
        self.assertTrue(res.data["summary"]["has_warning"])

        # Lọc danh sách theo overdue_type=PAYMENT_OVERDUE
        res_filter = self.client.get(f"{self.tracking_list_url}&overdue_type=PAYMENT_OVERDUE")
        self.assertEqual(res_filter.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_filter.data["results"]), 1)

    # 8. Three Tab Detail Endpoint (Steps 3-6)
    def test_08_three_tab_detail_endpoint_steps_3_6(self):
        """Xem chi tiết đơn bán với 3 tab: Giao hàng/Dịch vụ, Bán hàng & Hóa đơn, Thanh toán."""
        order, _ = self.create_sales_order()
        res = self.client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertIn("summary", data)
        self.assertIn("delivery_tab", data)
        self.assertIn("sales_invoice_tab", data)
        self.assertIn("payment_tab", data)
        self.assertIn("lines", data)
        self.assertIn("related_document_counts", data)

        # Tab 1: delivery-tab sub-endpoint
        res_tab1 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/delivery-tab/?company_id={self.company.pk}")
        self.assertEqual(res_tab1.status_code, status.HTTP_200_OK)
        self.assertIn("deliveries", res_tab1.data)
        self.assertIn("summary", res_tab1.data)

        # Tab 2: sales-invoice-tab sub-endpoint
        res_tab2 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/sales-invoice-tab/?company_id={self.company.pk}")
        self.assertEqual(res_tab2.status_code, status.HTTP_200_OK)
        self.assertIn("goods_sales", res_tab2.data)
        self.assertIn("sales_invoices", res_tab2.data)

        # Tab 3: payment-tab sub-endpoint
        res_tab3 = self.client.get(f"/api/v1/sales/tracking/{order.pk}/payment-tab/?company_id={self.company.pk}")
        self.assertEqual(res_tab3.status_code, status.HTTP_200_OK)
        self.assertIn("incurred_receivable", res_tab3.data)
        self.assertIn("receivables", res_tab3.data)

    # 9. CSV Export (AF-06)
    def test_09_csv_export_af_06(self):
        """Xuất danh sách theo dõi thực hiện đơn bán ra CSV UTF-8 (AF-06)."""
        self.create_sales_order(number="SO-EXP-01")
        res = self.client.get(self.export_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("attachment; filename=", res["Content-Disposition"])

        content = res.content.decode("utf-8-sig")
        self.assertIn("Mã đơn bán", content)
        self.assertIn("SO-EXP-01", content)
        self.assertIn("Khách hàng", content)

    # 10. Date Filter Validation (EF-03)
    def test_10_date_filter_validation_ef_03(self):
        """Ngày bắt đầu lớn hơn ngày kết thúc trả về lỗi validation 400 (EF-03)."""
        res_err = self.client.get(
            f"{self.tracking_list_url}&order_date_from=2026-10-20&order_date_to=2026-10-10"
        )
        self.assertEqual(res_err.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Ngày bắt đầu không được lớn hơn ngày kết thúc", str(res_err.data))

    # 11. Permission & Data scope Security (EF-01, BR-SAL-09-01)
    def test_11_permission_and_data_scope_security_ef_01_br_sal_09_01(self):
        """Kiểm tra quyền truy cập: không có quyền thì bị từ chối 403 (EF-01)."""
        order, _ = self.create_sales_order()

        # User không có quyền gọi list -> 403
        res_list = self.unauth_client.get(self.tracking_list_url)
        self.assertEqual(res_list.status_code, status.HTTP_403_FORBIDDEN)

        # User không có quyền gọi detail -> 403
        res_detail = self.unauth_client.get(f"/api/v1/sales/tracking/{order.pk}/?company_id={self.company.pk}")
        self.assertEqual(res_detail.status_code, status.HTTP_403_FORBIDDEN)

        # Thiếu company_id -> Bị SalesPermission từ chối 403
        res_no_co = self.client.get("/api/v1/sales/tracking/")
        self.assertEqual(res_no_co.status_code, status.HTTP_403_FORBIDDEN)

    def create_dummy_account(self):
        from general_ledger.models import Account, ChartOfAccounts
        chart, _ = ChartOfAccounts.objects.get_or_create(
            company=self.company,
            code="COA_TRACK",
            defaults={"name": "Hệ thống tài khoản", "effective_from": self.today},
        )
        acc, _ = Account.objects.get_or_create(
            company=self.company,
            code="131_DUMMY",
            defaults={
                "chart_of_accounts": chart,
                "name": "Phải thu khách hàng",
                "account_type": "ASSET",
                "is_postable": True,
                "status": "ACTIVE",
                "requires_party": True,
            },
        )
        return acc
