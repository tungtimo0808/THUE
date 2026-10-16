from decimal import Decimal
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from general_ledger.models import Account, AccountingPeriod, ChartOfAccounts
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserAccount, UserRoleAssignment
from master_data.models import Currency, Item, ItemCategory, Party, UnitOfMeasure, Warehouse
from organization.models import Branch, Company
from sales import models


class SalesDocumentLinkUcSal11Tests(TestCase):
    """
    Tập kiểm thử toàn diện cho Use Case UC-SAL-11: Liên kết chứng từ bán hàng.
    Bao quát Business Rules: BR-SAL-11-01 đến BR-SAL-11-14,
    Luồng hoạt động chính 1-8, Luồng thay thế AF-01..07, Luồng ngoại lệ EF-01..10.
    """

    def setUp(self):
        self.client = APIClient()
        self.unauth_client = APIClient()
        self.today = timezone.localdate()

        self.currency, _ = Currency.objects.get_or_create(
            code="VND", defaults={"name": "Việt Nam Đồng", "is_active": True}
        )
        self.usd_currency, _ = Currency.objects.get_or_create(
            code="USD", defaults={"name": "Đô la Mỹ", "is_active": True}
        )

        # 1. Doanh nghiệp & Chi nhánh
        self.company = Company.objects.create(
            code="CONGTY_LNK",
            name="Công Ty Liên Kết Chứng Từ",
            tax_code="0108889999",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.other_company = Company.objects.create(
            code="CONGTY_KHAC",
            name="Công Ty Khác",
            tax_code="0108880000",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.branch = Branch.objects.create(
            company=self.company,
            code="CN_LNK",
            name="Chi Nhánh Liên Kết",
        )
        self.warehouse = Warehouse.objects.create(
            company=self.company,
            branch=self.branch,
            code="KHO_LNK",
            name="Kho Hàng Hóa",
            status="ACTIVE",
        )

        # 2. Người dùng & Quyền hạn
        auth_user = get_user_model().objects.create_user(username="sales-linker-usr", password="password")
        self.user_account = auth_user.iam_account
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.user_account, created_by=self.user_account
        )

        auth_unauth = get_user_model().objects.create_user(username="sales-no-perm-usr", password="password")
        self.unauth_user = auth_unauth.iam_account
        self.unauth_membership = CompanyMembership.objects.create(
            company=self.company, user=self.unauth_user, created_by=self.unauth_user
        )

        self.role = Role.objects.create(
            company=self.company,
            code="ROLE_SAL_LINKER",
            name="Chuyên viên liên kết chứng từ",
            status="ACTIVE",
        )
        UserRoleAssignment.objects.create(
            company_membership=self.membership, role=self.role, assigned_by=self.user_account
        )

        self.guest_role = Role.objects.create(company=self.company, code="ROLE_GUEST", name="Khách")
        UserRoleAssignment.objects.create(
            company_membership=self.unauth_membership, role=self.guest_role, assigned_by=self.unauth_user
        )

        for perm_code in [
            "SAL.LINK.VIEW", "SAL.LINK.CREATE", "SAL.LINK.UNLINK",
            "SAL.ORDER.VIEW", "SAL.ORDER.CREATE",
            "SAL.GOODS_SALE.VIEW", "SAL.GOODS_SALE.CREATE",
        ]:
            perm = Permission.objects.filter(code=perm_code).first()
            if perm:
                RolePermission.objects.get_or_create(role=self.role, permission=perm, defaults={"effect": "ALLOW"})

        self.client.force_authenticate(user=auth_user)
        self.unauth_client.force_authenticate(user=auth_unauth)

        # 3. Master data (Khách hàng, ĐVT, Hàng hóa)
        self.customer_a = Party.objects.create(
            company=self.company,
            code="KH_A",
            name="Khách Hàng Alpha",
            status="ACTIVE",
        )
        self.customer_b = Party.objects.create(
            company=self.company,
            code="KH_B",
            name="Khách Hàng Beta",
            status="ACTIVE",
        )
        self.uom_cai = UnitOfMeasure.objects.create(
            company=self.company,
            code="CAI",
            name="Cái",
        )
        self.category = ItemCategory.objects.create(
            company=self.company,
            code="CAT_SP",
            name="Sản Phẩm",
        )
        self.item_a = Item.objects.create(
            company=self.company,
            category=self.category,
            base_uom=self.uom_cai,
            code="SP_ALPHA",
            name="Sản Phẩm Alpha",
            status="ACTIVE",
        )
        self.item_b = Item.objects.create(
            company=self.company,
            category=self.category,
            base_uom=self.uom_cai,
            code="SP_BETA",
            name="Sản Phẩm Beta",
            status="ACTIVE",
        )

        # 4. Helper tạo Order và GoodsSale
        self.order = models.SalesOrder.objects.create(
            company=self.company,
            branch=self.branch,
            number="SO-2026-0001",
            document_date=self.today,
            customer=self.customer_a,
            currency=self.currency,
            subtotal=Decimal("10000000"),
            total_amount=Decimal("10000000"),
            status=models.DocumentStatus.APPROVED,
            created_by=self.user_account,
        )
        self.order_line = models.SalesOrderLine.objects.create(
            order=self.order,
            line_no=1,
            item=self.item_a,
            uom=self.uom_cai,
            quantity=Decimal("10"),
            unit_price=Decimal("1000000"),
            line_total=Decimal("10000000"),
        )

        self.goods_sale = models.GoodsSale.objects.create(
            company=self.company,
            branch=self.branch,
            number="BH-2026-0001",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer_a,
            currency=self.currency,
            subtotal=Decimal("10000000"),
            total_amount=Decimal("10000000"),
            status=models.DocumentStatus.DRAFT,
            created_by=self.user_account,
        )
        self.goods_sale_line = models.GoodsSaleLine.objects.create(
            sale=self.goods_sale,
            line_no=1,
            item=self.item_a,
            uom=self.uom_cai,
            quantity=Decimal("10"),
            unit_price=Decimal("1000000"),
            line_total=Decimal("10000000"),
        )

    # -------------------------------------------------------------
    # 1. Luồng chính 1-8: Tạo liên kết đơn hàng -> bán hàng thành công
    # -------------------------------------------------------------
    def test_01_create_link_order_to_goods_sale_success(self):
        """Tạo liên kết FULFILLMENT từ Đơn bán sang Bán hàng thành công (BR-SAL-11-03, BR-SAL-11-04)."""
        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "ORDER",
            "source_document_id": str(self.order.id),
            "target_document_type": "GOODS_SALE",
            "target_document_id": str(self.goods_sale.id),
            "relation_type": "FULFILLMENT",
            "notes": "Liên kết thực hiện đơn hàng",
            "lines": [
                {
                    "source_line_id": str(self.order_line.id),
                    "target_line_id": str(self.goods_sale_line.id),
                    "linked_quantity": "5",
                    "conversion_rate": "1",
                    "notes": "Giao 5 cái",
                }
            ],
        }
        res = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertTrue(res.data["link_number"].startswith("LNK-"))
        self.assertEqual(res.data["status"], "ACTIVE")
        self.assertEqual(res.data["relation_type"], "FULFILLMENT")
        self.assertEqual(len(res.data["lines"]), 1)
        self.assertEqual(Decimal(str(res.data["lines"][0]["linked_quantity"])), Decimal("5"))

        # Kiểm tra AuditLog được ghi nhận
        self.assertTrue(
            AuditLog.objects.filter(
                company=self.company,
                module_code="SAL",
                action_code="CREATE",
                entity_id=res.data["id"],
            ).exists()
        )

    # -------------------------------------------------------------
    # 2. AF-05: Liên kết Tham chiếu (REFERENCE) không cần dòng
    # -------------------------------------------------------------
    def test_02_create_reference_link_without_lines(self):
        """Liên kết REFERENCE chỉ cần hai chứng từ, không bắt buộc dòng (AF-05, BR-SAL-11-04)."""
        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "ORDER",
            "source_document_id": str(self.order.id),
            "target_document_type": "GOODS_SALE",
            "target_document_id": str(self.goods_sale.id),
            "relation_type": "REFERENCE",
            "notes": "Tham chiếu hợp đồng/giao dịch liên quan",
            "lines": [],
        }
        res = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["relation_type"], "REFERENCE")
        self.assertEqual(len(res.data["lines"]), 0)

    # -------------------------------------------------------------
    # 3. Activity Flow bước 5: API tra cứu dòng có thể ghép đối chiếu
    # -------------------------------------------------------------
    def test_03_get_matchable_lines_and_remaining_capacities(self):
        """API matchable-lines hiển thị số lượng ban đầu, đã liên kết và còn lại (Activity Flow 5)."""
        # Tạo trước một liên kết chiếm 3 cái
        models.SalesDocumentLink.objects.create(
            company=self.company,
            link_number="LNK-INIT-001",
            source_document_type="ORDER",
            source_document_id=self.order.id,
            source_document_number=self.order.number,
            target_document_type="GOODS_SALE",
            target_document_id=self.goods_sale.id,
            target_document_number=self.goods_sale.number,
            relation_type="FULFILLMENT",
            customer=self.customer_a,
            status=models.LinkStatus.ACTIVE,
            created_by=self.user_account,
        )
        link = models.SalesDocumentLink.objects.get(link_number="LNK-INIT-001")
        models.SalesDocumentLinkLine.objects.create(
            link=link,
            line_no=1,
            source_line_id=self.order_line.id,
            target_line_id=self.goods_sale_line.id,
            item=self.item_a,
            linked_quantity=Decimal("3"),
        )

        res = self.client.get(
            "/api/v1/sales/links/matchable-lines/",
            {
                "company_id": str(self.company.id),
                "source_type": "ORDER",
                "source_id": str(self.order.id),
                "target_type": "GOODS_SALE",
                "target_id": str(self.goods_sale.id),
                "relation_type": "FULFILLMENT",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        s_line = res.data["source"]["lines"][0]
        self.assertEqual(Decimal(str(s_line["quantity"])), Decimal("10"))
        self.assertEqual(Decimal(str(s_line["allocated_quantity"])), Decimal("3"))
        self.assertEqual(Decimal(str(s_line["remaining_quantity"])), Decimal("7"))

        t_line = res.data["target"]["lines"][0]
        self.assertEqual(Decimal(str(t_line["quantity"])), Decimal("10"))
        self.assertEqual(Decimal(str(t_line["allocated_quantity"])), Decimal("3"))
        self.assertEqual(Decimal(str(t_line["remaining_quantity"])), Decimal("7"))

    # -------------------------------------------------------------
    # 4. EF-05: Chặn khi số lượng liên kết vượt phần còn lại
    # -------------------------------------------------------------
    def test_04_remaining_capacity_limit_exceeded_fails(self):
        """Chặn lưu khi số lượng liên kết vượt quá phần nguồn hoặc đích còn lại (EF-05, BR-SAL-11-06)."""
        # Thử liên kết 15 cái trong khi Order line chỉ có 10
        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "ORDER",
            "source_document_id": str(self.order.id),
            "target_document_type": "GOODS_SALE",
            "target_document_id": str(self.goods_sale.id),
            "relation_type": "FULFILLMENT",
            "lines": [
                {
                    "source_line_id": str(self.order_line.id),
                    "target_line_id": str(self.goods_sale_line.id),
                    "linked_quantity": "15",
                }
            ],
        }
        res = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vượt quá", str(res.data))

    # -------------------------------------------------------------
    # 5. BR-SAL-11-06: Khác loại quan hệ không bị trừ lẫn nhau
    # -------------------------------------------------------------
    def test_05_different_relation_types_do_not_exhaust_each_other(self):
        """Phần đã giao FULFILLMENT không bị trừ khỏi phần lập hóa đơn INVOICING (BR-SAL-11-06)."""
        # Tạo SalesInvoice cùng khách hàng
        invoice = models.SalesInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HD-2026-0001",
            document_date=self.today,
            invoice_date=self.today,
            invoice_series="1C26TAA",
            seller_name="Công Ty",
            seller_tax_code="0108889999",
            buyer_name="Khách Hàng Alpha",
            customer=self.customer_a,
            currency=self.currency,
            subtotal=Decimal("10000000"),
            total_amount=Decimal("10000000"),
            status=models.DocumentStatus.DRAFT,
            created_by=self.user_account,
        )
        invoice_line = models.SalesInvoiceLine.objects.create(
            invoice=invoice,
            line_no=1,
            item=self.item_a,
            item_name="Sản Phẩm Alpha",
            quantity=Decimal("10"),
            unit_price=Decimal("1000000"),
            amount=Decimal("10000000"),
        )

        # 1. Liên kết 10 cái cho FULFILLMENT
        res1 = self.client.post(
            "/api/v1/sales/links/",
            {
                "company_id": str(self.company.id),
                "source_document_type": "ORDER",
                "source_document_id": str(self.order.id),
                "target_document_type": "GOODS_SALE",
                "target_document_id": str(self.goods_sale.id),
                "relation_type": "FULFILLMENT",
                "lines": [
                    {
                        "source_line_id": str(self.order_line.id),
                        "target_line_id": str(self.goods_sale_line.id),
                        "linked_quantity": "10",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED, res1.data)

        # 2. Vẫn được liên kết 10 cái cho INVOICING từ cùng Order line!
        res2 = self.client.post(
            "/api/v1/sales/links/",
            {
                "company_id": str(self.company.id),
                "source_document_type": "ORDER",
                "source_document_id": str(self.order.id),
                "target_document_type": "SALES_INVOICE",
                "target_document_id": str(invoice.id),
                "relation_type": "INVOICING",
                "lines": [
                    {
                        "source_line_id": str(self.order_line.id),
                        "target_line_id": str(invoice_line.id),
                        "linked_quantity": "10",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED, res2.data)

    # -------------------------------------------------------------
    # 6. EF-02 / BR-SAL-11-02: Chặn khi hai chứng từ khác khách hàng
    # -------------------------------------------------------------
    def test_06_customer_mismatch_fails_business_relations(self):
        """Chặn liên kết nghiệp vụ khi hai chứng từ khác khách hàng (EF-02, BR-SAL-11-02)."""
        # Tạo GoodsSale thuộc khách hàng B
        sale_cust_b = models.GoodsSale.objects.create(
            company=self.company,
            branch=self.branch,
            number="BH-CUST-B",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer_b,
            currency=self.currency,
            subtotal=Decimal("10000000"),
            total_amount=Decimal("10000000"),
            status=models.DocumentStatus.DRAFT,
            created_by=self.user_account,
        )
        sale_cust_b_line = models.GoodsSaleLine.objects.create(
            sale=sale_cust_b,
            line_no=1,
            item=self.item_a,
            uom=self.uom_cai,
            quantity=Decimal("10"),
            unit_price=Decimal("1000000"),
            line_total=Decimal("10000000"),
        )

        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "ORDER",
            "source_document_id": str(self.order.id),
            "target_document_type": "GOODS_SALE",
            "target_document_id": str(sale_cust_b.id),
            "relation_type": "FULFILLMENT",
            "lines": [
                {
                    "source_line_id": str(self.order_line.id),
                    "target_line_id": str(sale_cust_b_line.id),
                    "linked_quantity": "5",
                }
            ],
        }
        res = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cùng một khách hàng", str(res.data))

    # -------------------------------------------------------------
    # 7. EF-04 / BR-SAL-11-05: Chặn khi hàng hóa giữa hai dòng không khớp
    # -------------------------------------------------------------
    def test_07_item_mismatch_fails(self):
        """Chặn ghép dòng khi hàng hóa nguồn và đích không khớp nhau (EF-04, BR-SAL-11-05)."""
        # Tạo GoodsSaleLine với item_b (trong khi order_line là item_a)
        sale_item_b_line = models.GoodsSaleLine.objects.create(
            sale=self.goods_sale,
            line_no=2,
            item=self.item_b,
            uom=self.uom_cai,
            quantity=Decimal("10"),
            unit_price=Decimal("1000000"),
            line_total=Decimal("10000000"),
        )
        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "ORDER",
            "source_document_id": str(self.order.id),
            "target_document_type": "GOODS_SALE",
            "target_document_id": str(self.goods_sale.id),
            "relation_type": "FULFILLMENT",
            "lines": [
                {
                    "source_line_id": str(self.order_line.id),
                    "target_line_id": str(sale_item_b_line.id),
                    "linked_quantity": "5",
                }
            ],
        }
        res = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("không khớp", str(res.data))

    # -------------------------------------------------------------
    # 8. EF-06 / BR-SAL-11-08: Chặn liên kết trùng cặp dòng đang hiệu lực
    # -------------------------------------------------------------
    def test_08_duplicate_active_link_pair_fails(self):
        """Chặn tạo liên kết trùng lặp giữa cùng cặp dòng đang hiệu lực (EF-06, BR-SAL-11-08)."""
        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "ORDER",
            "source_document_id": str(self.order.id),
            "target_document_type": "GOODS_SALE",
            "target_document_id": str(self.goods_sale.id),
            "relation_type": "FULFILLMENT",
            "lines": [
                {
                    "source_line_id": str(self.order_line.id),
                    "target_line_id": str(self.goods_sale_line.id),
                    "linked_quantity": "2",
                }
            ],
        }
        res1 = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Tạo lại cùng cặp dòng và quan hệ
        res2 = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("đã tồn tại", str(res2.data))

    # -------------------------------------------------------------
    # 9. BR-SAL-11-08: Chặn liên kết chứng từ với chính nó
    # -------------------------------------------------------------
    def test_09_self_link_fails(self):
        """Chặn liên kết chứng từ với chính nó (BR-SAL-11-08)."""
        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "ORDER",
            "source_document_id": str(self.order.id),
            "target_document_type": "ORDER",
            "target_document_id": str(self.order.id),
            "relation_type": "REFERENCE",
        }
        res = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("chính nó", str(res.data))

    # -------------------------------------------------------------
    # 10. EF-03 / BR-SAL-11-03: Chặn cặp chứng từ không phù hợp quan hệ
    # -------------------------------------------------------------
    def test_10_invalid_pair_for_relation_fails(self):
        """Chặn lưu khi loại quan hệ không phù hợp với cặp chứng từ (EF-03, BR-SAL-11-03)."""
        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "ORDER",
            "source_document_id": str(self.order.id),
            "target_document_type": "GOODS_SALE",
            "target_document_id": str(self.goods_sale.id),
            "relation_type": "RETURN",  # ORDER -> GOODS_SALE không phải quan hệ RETURN
            "lines": [
                {
                    "source_line_id": str(self.order_line.id),
                    "target_line_id": str(self.goods_sale_line.id),
                    "linked_quantity": "1",
                }
            ],
        }
        res = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("không phù hợp", str(res.data))

    # -------------------------------------------------------------
    # 11. AF-06 / BR-SAL-11-10: Gỡ liên kết Tham chiếu thành công
    # -------------------------------------------------------------
    def test_11_unlink_reference_link_success(self):
        """Gỡ liên kết REFERENCE thành công và ghi nhận lịch sử (AF-06, BR-SAL-11-10, BR-SAL-11-13)."""
        link = models.SalesDocumentLink.objects.create(
            company=self.company,
            link_number="LNK-REF-001",
            source_document_type="ORDER",
            source_document_id=self.order.id,
            source_document_number=self.order.number,
            target_document_type="GOODS_SALE",
            target_document_id=self.goods_sale.id,
            target_document_number=self.goods_sale.number,
            relation_type="REFERENCE",
            status=models.LinkStatus.ACTIVE,
            created_by=self.user_account,
        )
        res = self.client.post(
            f"/api/v1/sales/links/{link.id}/unlink/",
            {"reason": "Không còn dùng để đối chiếu nữa"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["status"], "UNLINKED")
        self.assertEqual(res.data["unlinked_reason"], "Không còn dùng để đối chiếu nữa")
        self.assertIsNotNone(res.data["unlinked_at"])

        # Kiểm tra AuditLog ghi nhận UNLINK
        self.assertTrue(
            AuditLog.objects.filter(
                company=self.company,
                module_code="SAL",
                action_code="UNLINK",
                entity_id=link.id,
            ).exists()
        )

    # -------------------------------------------------------------
    # 12. BR-SAL-11-10 / EF-09: Kiểm tra trạng thái chứng từ đích khi gỡ
    # -------------------------------------------------------------
    def test_12_unlink_business_link_checks_target_status(self):
        """Chỉ cho gỡ liên kết phân bổ thủ công khi chứng từ đích còn Bản nháp (BR-SAL-11-10, EF-09)."""
        link = models.SalesDocumentLink.objects.create(
            company=self.company,
            link_number="LNK-FUL-001",
            source_document_type="ORDER",
            source_document_id=self.order.id,
            source_document_number=self.order.number,
            target_document_type="GOODS_SALE",
            target_document_id=self.goods_sale.id,
            target_document_number=self.goods_sale.number,
            relation_type="FULFILLMENT",
            customer=self.customer_a,
            status=models.LinkStatus.ACTIVE,
            link_mode=models.LinkMode.MANUAL,
            created_by=self.user_account,
        )
        models.SalesDocumentLinkLine.objects.create(
            link=link,
            line_no=1,
            source_line_id=self.order_line.id,
            target_line_id=self.goods_sale_line.id,
            item=self.item_a,
            linked_quantity=Decimal("5"),
        )

        # 1. Khi đích đã POSTED -> Chặn gỡ
        self.goods_sale.status = models.DocumentStatus.POSTED
        self.goods_sale.save(update_fields=["status"])

        res_fail = self.client.post(
            f"/api/v1/sales/links/{link.id}/unlink/",
            {"reason": "Gỡ nhầm"},
            format="json",
        )
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Bản nháp", str(res_fail.data))

        # 2. Khi đích quay về DRAFT -> Gỡ thành công và giải phóng hạn mức
        self.goods_sale.status = models.DocumentStatus.DRAFT
        self.goods_sale.save(update_fields=["status"])

        res_ok = self.client.post(
            f"/api/v1/sales/links/{link.id}/unlink/",
            {"reason": "Xác nhận gỡ phân bổ"},
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ok.data["status"], "UNLINKED")

    # -------------------------------------------------------------
    # 13. BR-SAL-11-09: Chặn gỡ thủ công liên kết Tự động (AUTO)
    # -------------------------------------------------------------
    def test_13_unlink_auto_link_rejected(self):
        """Chặn người dùng gỡ trực tiếp liên kết tự động (BR-SAL-11-09)."""
        link = models.SalesDocumentLink.objects.create(
            company=self.company,
            link_number="LNK-AUTO-001",
            source_document_type="ORDER",
            source_document_id=self.order.id,
            source_document_number=self.order.number,
            target_document_type="GOODS_SALE",
            target_document_id=self.goods_sale.id,
            target_document_number=self.goods_sale.number,
            relation_type="FULFILLMENT",
            customer=self.customer_a,
            status=models.LinkStatus.ACTIVE,
            link_mode=models.LinkMode.AUTO,  # Tự động
            created_by=self.user_account,
        )
        res = self.client.post(
            f"/api/v1/sales/links/{link.id}/unlink/",
            {"reason": "Cố tình gỡ"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("liên kết tự động", str(res.data))

    # -------------------------------------------------------------
    # 14. EF-07: Chặn liên kết chứng từ đã bị hủy
    # -------------------------------------------------------------
    def test_14_cancelled_document_cannot_be_linked(self):
        """Chặn tạo liên kết khi chứng từ nguồn hoặc đích bị hủy (EF-07)."""
        self.order.status = models.DocumentStatus.CANCELLED
        self.order.save(update_fields=["status"])

        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "ORDER",
            "source_document_id": str(self.order.id),
            "target_document_type": "GOODS_SALE",
            "target_document_id": str(self.goods_sale.id),
            "relation_type": "FULFILLMENT",
            "lines": [
                {
                    "source_line_id": str(self.order_line.id),
                    "target_line_id": str(self.goods_sale_line.id),
                    "linked_quantity": "5",
                }
            ],
        }
        res = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("không còn hiệu lực", str(res.data))

    # -------------------------------------------------------------
    # 15. AF-01 & AF-07: Truy vết theo chứng từ và xem lịch sử
    # -------------------------------------------------------------
    def test_15_document_links_query_and_history(self):
        """Tra cứu liên kết theo chứng từ và xem lịch sử chi tiết (AF-01, AF-07)."""
        link = models.SalesDocumentLink.objects.create(
            company=self.company,
            link_number="LNK-TRAC-001",
            source_document_type="ORDER",
            source_document_id=self.order.id,
            source_document_number=self.order.number,
            target_document_type="GOODS_SALE",
            target_document_id=self.goods_sale.id,
            target_document_number=self.goods_sale.number,
            relation_type="FULFILLMENT",
            customer=self.customer_a,
            status=models.LinkStatus.ACTIVE,
            created_by=self.user_account,
        )

        # 1. Tra cứu các liên kết liên quan đến Order
        res_doc = self.client.get(
            "/api/v1/sales/links/document-links/",
            {
                "company_id": str(self.company.id),
                "document_type": "ORDER",
                "document_id": str(self.order.id),
            },
        )
        self.assertEqual(res_doc.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_doc.data), 1)
        self.assertEqual(res_doc.data[0]["id"], str(link.id))

        # 2. Xem lịch sử của liên kết
        res_hist = self.client.get(f"/api/v1/sales/links/{link.id}/history/")
        self.assertEqual(res_hist.status_code, status.HTTP_200_OK)
        self.assertEqual(res_hist.data["link_number"], "LNK-TRAC-001")
        self.assertEqual(res_hist.data["status"], "ACTIVE")

    # -------------------------------------------------------------
    # 16. EF-01 / BR-SAL-11-01: Phân quyền truy cập
    # -------------------------------------------------------------
    def test_16_permission_enforcement(self):
        """Kiểm tra chặn người dùng không có quyền (EF-01, BR-SAL-11-01)."""
        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "ORDER",
            "source_document_id": str(self.order.id),
            "target_document_type": "GOODS_SALE",
            "target_document_id": str(self.goods_sale.id),
            "relation_type": "REFERENCE",
        }
        # Người dùng không có quyền SAL.LINK.CREATE
        res = self.unauth_client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------
    # 17. BR-SAL-11-02 & BR-SAL-11-07: Liên kết theo giá trị (ALLOWANCE)
    # -------------------------------------------------------------
    def test_17_allowance_amount_link_and_currency_check(self):
        """Liên kết ALLOWANCE theo giá trị, kiểm tra cùng loại tiền và hạn mức giá trị (BR-SAL-11-02)."""
        allowance = models.SalesAllowance.objects.create(
            company=self.company,
            branch=self.branch,
            number="GG-2026-0001",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer_a,
            currency=self.currency,
            subtotal=Decimal("500000"),
            total_amount=Decimal("500000"),
            status=models.DocumentStatus.DRAFT,
            created_by=self.user_account,
        )
        allowance_line = models.SalesAllowanceLine.objects.create(
            allowance=allowance,
            line_no=1,
            item=self.item_a,
            net_sales_value=Decimal("10000000"),
            remaining_value=Decimal("10000000"),
            allowance_amount=Decimal("500000"),
            line_total=Decimal("500000"),
        )

        # 1. Liên kết theo giá trị thành công
        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "GOODS_SALE",
            "source_document_id": str(self.goods_sale.id),
            "target_document_type": "SALES_ALLOWANCE",
            "target_document_id": str(allowance.id),
            "relation_type": "ALLOWANCE",
            "lines": [
                {
                    "source_line_id": str(self.goods_sale_line.id),
                    "target_line_id": str(allowance_line.id),
                    "linked_amount": "500000",
                }
            ],
        }
        res = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(Decimal(str(res.data["lines"][0]["linked_amount"])), Decimal("500000"))

        # 2. Khác loại tiền bị chặn
        allowance_usd = models.SalesAllowance.objects.create(
            company=self.company,
            branch=self.branch,
            number="GG-USD-0001",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer_a,
            currency=self.usd_currency,  # USD
            subtotal=Decimal("100"),
            total_amount=Decimal("100"),
            status=models.DocumentStatus.DRAFT,
            created_by=self.user_account,
        )
        allowance_usd_line = models.SalesAllowanceLine.objects.create(
            allowance=allowance_usd,
            line_no=1,
            item=self.item_a,
            net_sales_value=Decimal("100"),
            remaining_value=Decimal("100"),
            allowance_amount=Decimal("100"),
            line_total=Decimal("100"),
        )
        payload_usd = {
            "company_id": str(self.company.id),
            "source_document_type": "GOODS_SALE",
            "source_document_id": str(self.goods_sale.id),
            "target_document_type": "SALES_ALLOWANCE",
            "target_document_id": str(allowance_usd.id),
            "relation_type": "ALLOWANCE",
            "lines": [
                {
                    "source_line_id": str(self.goods_sale_line.id),
                    "target_line_id": str(allowance_usd_line.id),
                    "linked_amount": "100",
                }
            ],
        }
        res_usd = self.client.post("/api/v1/sales/links/", payload_usd, format="json")
        self.assertEqual(res_usd.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cùng loại tiền", str(res_usd.data))

    # -------------------------------------------------------------
    # 18. BR-SAL-11-05: Khác đơn vị tính có quy đổi hợp lệ
    # -------------------------------------------------------------
    def test_18_unit_of_measure_conversion(self):
        """Khác đơn vị tính được phép ghép khi có tỷ lệ quy đổi hợp lệ (BR-SAL-11-05)."""
        uom_thung = UnitOfMeasure.objects.create(
            company=self.company,
            code="THUNG",
            name="Thùng",
        )
        sale_diff_uom = models.GoodsSale.objects.create(
            company=self.company,
            branch=self.branch,
            number="BH-THUNG-01",
            document_date=self.today,
            posting_date=self.today,
            customer=self.customer_a,
            currency=self.currency,
            subtotal=Decimal("10000000"),
            total_amount=Decimal("10000000"),
            status=models.DocumentStatus.DRAFT,
            created_by=self.user_account,
        )
        sale_thung_line = models.GoodsSaleLine.objects.create(
            sale=sale_diff_uom,
            line_no=1,
            item=self.item_a,
            uom=uom_thung,  # Thùng
            quantity=Decimal("1"),  # 1 thùng = 10 cái
            unit_price=Decimal("10000000"),
            line_total=Decimal("10000000"),
        )

        payload = {
            "company_id": str(self.company.id),
            "source_document_type": "ORDER",
            "source_document_id": str(self.order.id),
            "target_document_type": "GOODS_SALE",
            "target_document_id": str(sale_diff_uom.id),
            "relation_type": "FULFILLMENT",
            "lines": [
                {
                    "source_line_id": str(self.order_line.id),
                    "target_line_id": str(sale_thung_line.id),
                    "linked_quantity": "1",
                    "conversion_rate": "10",
                }
            ],
        }
        res = self.client.post("/api/v1/sales/links/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(Decimal(str(res.data["lines"][0]["conversion_rate"])), Decimal("10"))

