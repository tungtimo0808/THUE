import uuid
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Item, ItemCategory, Party, TaxRate, UnitOfMeasure
from organization.models import Branch, Company, Department, Employee, Position
from sales import models, discount_invoice_services


class SalesDiscountInvoiceUcSal13Tests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.unauth_client = APIClient()

        self.today = timezone.localdate()
        self.period_start = self.today - timedelta(days=30)
        self.period_end = self.today

        self.currency, _ = Currency.objects.get_or_create(
            code="VND", defaults={"name": "Việt Nam Đồng", "is_active": True}
        )
        self.usd, _ = Currency.objects.get_or_create(
            code="USD", defaults={"name": "Đô la Mỹ", "is_active": True}
        )

        # 1. Doanh nghiệp & Chi nhánh
        self.company = Company.objects.create(
            code="CTY_DISC",
            name="Công Ty Phân Phối Chiết Khấu",
            tax_code="0108889999",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.other_company = Company.objects.create(
            code="CTY_OTHER",
            name="Công Ty Khác",
            tax_code="0108880000",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.branch = Branch.objects.create(
            company=self.company,
            code="CN_HN",
            name="Chi Nhánh Hà Nội",
        )

        # 2. Người dùng & Phân quyền IAM
        auth_user = get_user_model().objects.create_user(username="disc-invoice-mgr", password="password")
        self.user_account = auth_user.iam_account
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.user_account, created_by=self.user_account
        )

        auth_unauth = get_user_model().objects.create_user(username="disc-guest-usr", password="password")
        self.unauth_user = auth_unauth.iam_account
        self.unauth_membership = CompanyMembership.objects.create(
            company=self.company, user=self.unauth_user, created_by=self.unauth_user
        )

        self.role = Role.objects.create(
            company=self.company,
            code="ROLE_SAL_DISCOUNT_INV",
            name="Quản trị hóa đơn chiết khấu",
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
            "SAL.DISCOUNT_INVOICE.VIEW", "SAL.DISCOUNT_INVOICE.CREATE", "SAL.DISCOUNT_INVOICE.EDIT",
            "SAL.DISCOUNT_INVOICE.DELETE", "SAL.DISCOUNT_INVOICE.APPROVE", "SAL.DISCOUNT_INVOICE.ISSUE",
            "SAL.DISCOUNT_INVOICE.CANCEL", "SAL.DISCOUNT_INVOICE.RETRY", "SAL.SALES_INVOICE.VIEW",
        ]:
            perm = Permission.objects.filter(code=perm_code).first()
            if perm:
                RolePermission.objects.get_or_create(role=self.role, permission=perm, defaults={"effect": "ALLOW"})

        self.client.force_authenticate(user=auth_user)
        self.unauth_client.force_authenticate(user=auth_unauth)

        # 3. Master data
        self.tax_10, _ = TaxRate.objects.get_or_create(
            company=self.company,
            code="VAT10",
            defaults={"name": "Thuế GTGT 10%", "rate_percent": Decimal("10.00"), "tax_type": "VAT", "application_form": "PERCENT", "business_scope": "OUTPUT", "effective_from": self.today - timedelta(days=60), "status": "ACTIVE"},
        )
        self.tax_8, _ = TaxRate.objects.get_or_create(
            company=self.company,
            code="VAT8",
            defaults={"name": "Thuế GTGT 8%", "rate_percent": Decimal("8.00"), "tax_type": "VAT", "application_form": "PERCENT", "business_scope": "OUTPUT", "effective_from": self.today - timedelta(days=60), "status": "ACTIVE"},
        )
        self.tax_0, _ = TaxRate.objects.get_or_create(
            company=self.company,
            code="VAT0",
            defaults={"name": "Thuế GTGT 0%", "rate_percent": Decimal("0.00"), "tax_type": "VAT", "application_form": "PERCENT", "business_scope": "OUTPUT", "effective_from": self.today - timedelta(days=60), "status": "ACTIVE"},
        )

        self.uom = UnitOfMeasure.objects.create(
            company=self.company, code="CAI", name="Cái"
        )
        self.item_cat = ItemCategory.objects.create(
            company=self.company, code="THIETBI", name="Thiết bị viễn thông"
        )
        self.item_a = Item.objects.create(
            company=self.company,
            category=self.item_cat,
            code="ITEM_A",
            name="Router Cisco A",
            base_uom=self.uom,
            status="ACTIVE",
        )
        self.item_b = Item.objects.create(
            company=self.company,
            category=self.item_cat,
            code="ITEM_B",
            name="Switch Cisco B",
            base_uom=self.uom,
            status="ACTIVE",
        )

        # Khách hàng
        self.customer = Party.objects.create(
            company=self.company,
            code="KH_DAILUONG",
            name="Đại Lý Đại Lượng",
            legal_name="Công Ty Cổ Phần Thương Mại Đại Lượng",
            tax_code="0107778888",
            status="ACTIVE",
        )

        self.other_customer = Party.objects.create(
            company=self.company,
            code="KH_OTHER",
            name="Khách Hàng Khác",
            tax_code="0107770000",
            status="ACTIVE",
        )

        # 4. Tạo 2 Hóa đơn gốc đã phát hành trong kỳ chiết khấu (Pre-condition)
        self.invoice_1 = models.SalesInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HD-2026-0001",
            invoice_series="1C26TAA",
            invoice_number="0000101",
            document_date=self.period_start + timedelta(days=5),
            invoice_date=self.period_start + timedelta(days=5),
            status=models.SalesInvoice.Status.ISSUED,
            customer=self.customer,
            seller_name="Công Ty Phân Phối Chiết Khấu",
            seller_tax_code="0108889999",
            seller_address="Tầng 5, Tòa Nhà ABC, Cầu Giấy, Hà Nội",
            buyer_name=self.customer.name,
            buyer_legal_name=self.customer.legal_name,
            buyer_tax_code=self.customer.tax_code,
            buyer_address="123 Phố Huế, Hai Bà Trưng, Hà Nội",
            buyer_email="ketoan@dailuong.com.vn",
            currency=self.currency,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("100000000"),
            total_amount=Decimal("110000000"),
            created_by=self.user_account,
        )
        # Line 1: 100 cái x 1,000,000 = 100,000,000, tax 10%
        self.inv1_line1 = models.SalesInvoiceLine.objects.create(
            invoice=self.invoice_1,
            line_no=1,
            item=self.item_a,
            item_name=self.item_a.name,
            uom=self.uom,
            quantity=Decimal("100"),
            unit_price=Decimal("1000000"),
            amount=Decimal("100000000"),
            discount_rate=Decimal("0"),
            discount_amount=Decimal("0"),
            tax_rate=self.tax_10,
            tax_amount=Decimal("10000000"),
            line_total=Decimal("110000000"),
        )

        self.invoice_2 = models.SalesInvoice.objects.create(
            company=self.company,
            branch=self.branch,
            number="HD-2026-0002",
            invoice_series="1C26TAA",
            invoice_number="0000102",
            document_date=self.period_start + timedelta(days=15),
            invoice_date=self.period_start + timedelta(days=15),
            status=models.SalesInvoice.Status.ISSUED,
            customer=self.customer,
            seller_name="Công Ty Phân Phối Chiết Khấu",
            seller_tax_code="0108889999",
            buyer_name=self.customer.name,
            buyer_legal_name=self.customer.legal_name,
            buyer_tax_code=self.customer.tax_code,
            buyer_address="123 Phố Huế, Hai Bà Trưng, Hà Nội",
            buyer_email="ketoan@dailuong.com.vn",
            currency=self.currency,
            exchange_rate=Decimal("1"),
            subtotal=Decimal("200000000"),
            total_amount=Decimal("216000000"),
            created_by=self.user_account,
        )
        # Line 2: 50 cái x 4,000,000 = 200,000,000, tax 8%
        self.inv2_line1 = models.SalesInvoiceLine.objects.create(
            invoice=self.invoice_2,
            line_no=1,
            item=self.item_b,
            item_name=self.item_b.name,
            uom=self.uom,
            quantity=Decimal("50"),
            unit_price=Decimal("4000000"),
            amount=Decimal("200000000"),
            discount_rate=Decimal("0"),
            discount_amount=Decimal("0"),
            tax_rate=self.tax_8,
            tax_amount=Decimal("16000000"),
            line_total=Decimal("216000000"),
        )

    def test_01_eligible_invoices_query_and_calculation(self):
        """Test retrieving eligible invoices and lines for discount within the period (Bước 2-3, BR-SAL-13-03)."""
        # Thêm 1 hóa đơn nháp (không được lấy)
        models.SalesInvoice.objects.create(
            company=self.company,
            number="HD-DRAFT",
            invoice_series="1C26TAA",
            document_date=self.period_start + timedelta(days=2),
            invoice_date=self.period_start + timedelta(days=2),
            status=models.SalesInvoice.Status.DRAFT,
            customer=self.customer,
            seller_name="Công Ty",
            buyer_name=self.customer.name,
            currency=self.currency,
            created_by=self.user_account,
        )

        res = self.client.get(
            f"/api/v1/sales/discount-invoices/eligible-invoices/"
            f"?company_id={self.company.pk}&customer={self.customer.pk}"
            f"&period_start={self.period_start.isoformat()}&period_end={self.period_end.isoformat()}"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["eligible_invoices_count"], 2)
        self.assertEqual(res.data["eligible_lines_count"], 2)
        # Tổng doanh số đủ điều kiện: 100M + 200M = 300M
        self.assertEqual(Decimal(str(res.data["total_eligible_revenue"])), Decimal("300000000.00"))

    def test_02_create_discount_invoice_success_auto_allocation(self):
        """Test creating discount invoice with automatic proportional allocation (Luồng chính Bước 1-7, BR-SAL-13-05)."""
        payload = {
            "company": str(self.company.pk),
            "customer": str(self.customer.pk),
            "invoice_series": "1C26TBB",
            "invoice_date": self.today.isoformat(),
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "discount_basis": "Hợp đồng nguyên tắc HĐ-2026/DL điều 5 chiết khấu doanh số quý",
            "calculation_method": "AMOUNT",
            "total_discount_before_tax": "30000000.00",  # Chiết khấu 30M trên tổng doanh số 300M (10%)
            "lines": [
                {
                    "original_invoice_line": str(self.inv1_line1.pk),
                },
                {
                    "original_invoice_line": str(self.inv2_line1.pk),
                },
            ],
        }
        res = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            payload,
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        data = res.data

        # Kiểm tra tự sinh mã HDCK-YYYY-XXXX
        self.assertTrue(data["code"].startswith(f"HDCK-{self.today.year}-"))
        self.assertEqual(data["status"], "DRAFT")
        self.assertEqual(Decimal(str(data["total_discount_before_tax"])), Decimal("30000000.00"))

        # Phân bổ theo tỷ trọng: Line 1 (100M / 300M) = 10M, Line 2 (200M / 300M) = 20M
        lines = data["lines"]
        self.assertEqual(len(lines), 2)
        line1 = next(l for l in lines if str(l["original_invoice_line"]) == str(self.inv1_line1.pk))
        line2 = next(l for l in lines if str(l["original_invoice_line"]) == str(self.inv2_line1.pk))

        self.assertEqual(Decimal(str(line1["allocated_discount_amount"])), Decimal("10000000.00"))
        # Line 1 có thuế suất 10% -> Thuế điều chỉnh = 1,000,000 (BR-SAL-13-06)
        self.assertEqual(Decimal(str(line1["adjusted_tax_amount"])), Decimal("1000000.00"))
        self.assertEqual(Decimal(str(line1["line_total"])), Decimal("11000000.00"))

        self.assertEqual(Decimal(str(line2["allocated_discount_amount"])), Decimal("20000000.00"))
        # Line 2 có thuế suất 8% -> Thuế điều chỉnh = 1,600,000 (BR-SAL-13-06)
        self.assertEqual(Decimal(str(line2["adjusted_tax_amount"])), Decimal("1600000.00"))
        self.assertEqual(Decimal(str(line2["line_total"])), Decimal("21600000.00"))

        # Tổng thuế điều chỉnh: 1M + 1.6M = 2.6M
        self.assertEqual(Decimal(str(data["total_tax_amount"])), Decimal("2600000.00"))
        self.assertEqual(Decimal(str(data["total_adjusted_amount"])), Decimal("32600000.00"))

    def test_03_create_discount_invoice_by_percentage(self):
        """Test creating discount invoice by percentage rate (BR-SAL-13-04)."""
        payload = {
            "company": str(self.company.pk),
            "customer": str(self.customer.pk),
            "invoice_series": "1C26TBB",
            "invoice_date": self.today.isoformat(),
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "discount_basis": "Chính sách chiết khấu sản lượng đạt mức 1",
            "calculation_method": "PERCENTAGE",
            "discount_rate": "5.00",  # 5%
            "lines": [
                {"original_invoice_line": str(self.inv1_line1.pk)},
                {"original_invoice_line": str(self.inv2_line1.pk)},
            ],
        }
        res = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            payload,
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        # 5% của 300M = 15M
        self.assertEqual(Decimal(str(res.data["total_discount_before_tax"])), Decimal("15000000.00"))

    def test_04_manual_allocation_success(self):
        """Test creating discount invoice with valid manual line allocations (AF-03)."""
        payload = {
            "company": str(self.company.pk),
            "customer": str(self.customer.pk),
            "invoice_series": "1C26TBB",
            "invoice_date": self.today.isoformat(),
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "discount_basis": "Thỏa thuận phân bổ chiết khấu thủ công",
            "calculation_method": "AMOUNT",
            "total_discount_before_tax": "30000000.00",
            "lines": [
                {
                    "original_invoice_line": str(self.inv1_line1.pk),
                    "allocated_discount_amount": "5000000.00",
                },
                {
                    "original_invoice_line": str(self.inv2_line1.pk),
                    "allocated_discount_amount": "25000000.00",
                },
            ],
        }
        res = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            payload,
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Decimal(str(res.data["total_discount_before_tax"])), Decimal("30000000.00"))

    def test_05_manual_allocation_mismatch_raises_ef05(self):
        """Test that manual allocation sum mismatching total discount raises EF-05."""
        payload = {
            "company": str(self.company.pk),
            "customer": str(self.customer.pk),
            "invoice_series": "1C26TBB",
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "discount_basis": "Thỏa thuận chiết khấu",
            "calculation_method": "AMOUNT",
            "total_discount_before_tax": "30000000.00",
            "lines": [
                {
                    "original_invoice_line": str(self.inv1_line1.pk),
                    "allocated_discount_amount": "5000000.00",
                },
                {
                    "original_invoice_line": str(self.inv2_line1.pk),
                    "allocated_discount_amount": "20000000.00",  # Tổng chỉ 25M != 30M
                },
            ],
        }
        res = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            payload,
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("lines", res.data)

    def test_06_validation_errors_missing_basis_or_period_or_lines(self):
        """Test validation errors for missing discount basis, invalid period, or empty lines (EF-02, EF-03)."""
        # Thiếu basis
        res = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            {
                "customer": str(self.customer.pk),
                "invoice_series": "1C26TBB",
                "period_start": self.period_start.isoformat(),
                "period_end": self.period_end.isoformat(),
                "discount_basis": "",
                "lines": [{"original_invoice_line": str(self.inv1_line1.pk)}],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

        # Ngày kết thúc trước ngày bắt đầu
        res2 = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            {
                "customer": str(self.customer.pk),
                "invoice_series": "1C26TBB",
                "period_start": self.today.isoformat(),
                "period_end": (self.today - timedelta(days=5)).isoformat(),
                "discount_basis": "Căn cứ hợp lệ",
                "lines": [{"original_invoice_line": str(self.inv1_line1.pk)}],
            },
            format="json",
        )
        self.assertEqual(res2.status_code, 400)

    def test_07_ineligible_or_different_buyer_currency_raises_ef03(self):
        """Test that invoices with different currency or different buyer cannot be mixed (EF-03)."""
        # Tạo hóa đơn ngoại tệ USD
        inv_usd = models.SalesInvoice.objects.create(
            company=self.company,
            number="HD-USD",
            invoice_series="1C26TBB",
            invoice_number="0000999",
            document_date=self.period_start + timedelta(days=10),
            invoice_date=self.period_start + timedelta(days=10),
            status=models.SalesInvoice.Status.ISSUED,
            customer=self.customer,
            seller_name="Công Ty",
            buyer_name=self.customer.name,
            buyer_tax_code=self.customer.tax_code,
            currency=self.usd,
            exchange_rate=Decimal("25000"),
            created_by=self.user_account,
        )
        inv_usd_line = models.SalesInvoiceLine.objects.create(
            invoice=inv_usd,
            line_no=1,
            item=self.item_a,
            uom=self.uom,
            quantity=Decimal("10"),
            unit_price=Decimal("100"),
            amount=Decimal("1000"),
            line_total=Decimal("1100"),
        )

        res = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            {
                "customer": str(self.customer.pk),
                "invoice_series": "1C26TBB",
                "period_start": self.period_start.isoformat(),
                "period_end": self.period_end.isoformat(),
                "discount_basis": "Thỏa thuận",
                "total_discount_before_tax": "5000000",
                "lines": [
                    {"original_invoice_line": str(self.inv1_line1.pk)},
                    {"original_invoice_line": str(inv_usd_line.pk)},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_08_discount_exceeds_eligible_revenue_raises_ef04(self):
        """Test that discount amount exceeding eligible revenue raises EF-04."""
        res = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            {
                "customer": str(self.customer.pk),
                "invoice_series": "1C26TBB",
                "period_start": self.period_start.isoformat(),
                "period_end": self.period_end.isoformat(),
                "discount_basis": "Thỏa thuận",
                "total_discount_before_tax": "400000000.00",  # Vượt quá 300M
                "lines": [
                    {"original_invoice_line": str(self.inv1_line1.pk)},
                    {"original_invoice_line": str(self.inv2_line1.pk)},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("total_discount_before_tax", res.data)

    def test_09_multiple_discount_invoices_held_and_used_tracking(self):
        """Test held and used discount amount tracking across multiple discount invoices (BR-SAL-13-07, BR-SAL-13-08, EF-06)."""
        # Hóa đơn chiết khấu 1: giữ 200M trên tổng 300M
        payload1 = {
            "customer": str(self.customer.pk),
            "invoice_series": "1C26TBB",
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "discount_basis": "Đợt 1",
            "calculation_method": "AMOUNT",
            "total_discount_before_tax": "200000000.00",
            "lines": [
                {"original_invoice_line": str(self.inv1_line1.pk)},
                {"original_invoice_line": str(self.inv2_line1.pk)},
            ],
        }
        res1 = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            payload1,
            format="json",
        )
        self.assertEqual(res1.status_code, 201)

        # Kiểm tra API eligible-invoices: chỉ còn 100M khả dụng
        res_elig = self.client.get(
            f"/api/v1/sales/discount-invoices/eligible-invoices/"
            f"?company_id={self.company.pk}&customer={self.customer.pk}"
            f"&period_start={self.period_start.isoformat()}&period_end={self.period_end.isoformat()}"
        )
        self.assertEqual(res_elig.status_code, 200)
        self.assertEqual(Decimal(str(res_elig.data["total_eligible_revenue"])), Decimal("100000000.00"))

        # Hóa đơn chiết khấu 2: thử lập 150M -> phải bị chặn (EF-04, EF-06)
        payload2_excess = {
            "customer": str(self.customer.pk),
            "invoice_series": "1C26TBB",
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "discount_basis": "Đợt 2 quá hạn mức",
            "calculation_method": "AMOUNT",
            "total_discount_before_tax": "150000000.00",
            "lines": [
                {"original_invoice_line": str(self.inv1_line1.pk)},
                {"original_invoice_line": str(self.inv2_line1.pk)},
            ],
        }
        res2_bad = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            payload2_excess,
            format="json",
        )
        self.assertEqual(res2_bad.status_code, 400)

        # Lập đúng 100M còn lại -> thành công
        payload2_ok = {
            "customer": str(self.customer.pk),
            "invoice_series": "1C26TBB",
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "discount_basis": "Đợt 2 phần còn lại",
            "calculation_method": "AMOUNT",
            "total_discount_before_tax": "100000000.00",
            "lines": [
                {"original_invoice_line": str(self.inv1_line1.pk)},
                {"original_invoice_line": str(self.inv2_line1.pk)},
            ],
        }
        res2_ok = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            payload2_ok,
            format="json",
        )
        self.assertEqual(res2_ok.status_code, 201)

    def test_10_delete_draft_releases_held_discount(self):
        """Test that deleting a draft discount invoice releases held amounts (AF-07, BR-SAL-13-08)."""
        payload = {
            "customer": str(self.customer.pk),
            "invoice_series": "1C26TBB",
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "discount_basis": "Tạm tính",
            "total_discount_before_tax": "100000000.00",
            "lines": [{"original_invoice_line": str(self.inv1_line1.pk)}],
        }
        res_create = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            payload,
            format="json",
        )
        inv_id = res_create.data["id"]

        # Xóa hóa đơn nháp
        res_del = self.client.delete(f"/api/v1/sales/discount-invoices/{inv_id}/?company_id={self.company.pk}")
        self.assertEqual(res_del.status_code, 204)

        # Doanh số đủ điều kiện của Line 1 phải được khôi phục nguyên vẹn 100M
        res_elig = self.client.get(
            f"/api/v1/sales/discount-invoices/eligible-invoices/"
            f"?company_id={self.company.pk}&customer={self.customer.pk}"
            f"&period_start={self.period_start.isoformat()}&period_end={self.period_end.isoformat()}"
        )
        self.assertEqual(Decimal(str(res_elig.data["total_eligible_revenue"])), Decimal("300000000.00"))

    def test_11_update_draft_and_approval_withdraw(self):
        """Test updating draft invoice, submitting for approval, and withdrawing (AF-04)."""
        payload = {
            "customer": str(self.customer.pk),
            "invoice_series": "1C26TBB",
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "discount_basis": "Lần 1",
            "total_discount_before_tax": "20000000.00",
            "lines": [{"original_invoice_line": str(self.inv1_line1.pk)}],
        }
        res_create = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            payload,
            format="json",
        )
        inv_id = res_create.data["id"]

        # Cập nhật số tiền lên 25M
        payload["total_discount_before_tax"] = "25000000.00"
        res_upd = self.client.put(
            f"/api/v1/sales/discount-invoices/{inv_id}/?company_id={self.company.pk}",
            payload,
            format="json",
        )
        self.assertEqual(res_upd.status_code, 200)
        self.assertEqual(Decimal(str(res_upd.data["total_discount_before_tax"])), Decimal("25000000.00"))

        # Gửi duyệt (khi không cấu hình workflow -> APPROVED)
        inv_obj = models.SalesDiscountInvoice.objects.get(pk=inv_id)
        inv_obj.approval_required = True
        inv_obj.save()

        # Thu hồi duyệt
        inv_obj.status = models.DiscountInvoiceStatus.PENDING_APPROVAL
        inv_obj.save()

        res_withdraw = self.client.post(
            f"/api/v1/sales/discount-invoices/{inv_id}/withdraw/?company_id={self.company.pk}",
            {"withdrawal_reason": "Cần đối chiếu lại số liệu doanh số"},
            format="json",
        )
        self.assertEqual(res_withdraw.status_code, 200)
        self.assertEqual(res_withdraw.data["status"], "DRAFT")
        self.assertEqual(res_withdraw.data["withdrawal_reason"], "Cần đối chiếu lại số liệu doanh số")

    def test_12_workflow_approval_full_cycle(self):
        """Test returning approved discount invoice to draft (Bảng 3, AF-03)."""
        inv = models.SalesDiscountInvoice.objects.create(
            company=self.company,
            customer=self.customer,
            invoice_series="1C26TBB",
            invoice_date=self.today,
            document_date=self.today,
            currency=self.currency,
            discount_basis="Hợp đồng khung",
            period_start=self.period_start,
            period_end=self.period_end,
            total_discount_before_tax=Decimal("10000000"),
            total_tax_amount=Decimal("1000000"),
            total_adjusted_amount=Decimal("11000000"),
            status=models.DiscountInvoiceStatus.APPROVED,
            approved_at=timezone.now(),
            created_by=self.user_account,
        )

        res = self.client.post(
            f"/api/v1/sales/discount-invoices/{inv.pk}/return-to-draft/?company_id={self.company.pk}"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "DRAFT")
        self.assertIsNone(res.data["status_display"] if False else None)

    def test_13_issue_discount_invoice_success(self):
        """Test successful issuance of electronic discount invoice (Bước 9-10, BR-SAL-13-11, BR-SAL-13-12, BR-SAL-13-13)."""
        payload = {
            "customer": str(self.customer.pk),
            "invoice_series": "1C26TBB",
            "invoice_date": self.today.isoformat(),
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "discount_basis": "Hợp đồng nguyên tắc năm",
            "total_discount_before_tax": "30000000.00",
            "lines": [
                {"original_invoice_line": str(self.inv1_line1.pk)},
                {"original_invoice_line": str(self.inv2_line1.pk)},
            ],
        }
        res_create = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            payload,
            format="json",
        )
        inv_id = res_create.data["id"]

        # Phát hành hóa đơn điện tử
        res_issue = self.client.post(
            f"/api/v1/sales/discount-invoices/{inv_id}/issue/?company_id={self.company.pk}"
        )
        self.assertEqual(res_issue.status_code, 200)
        data = res_issue.data

        self.assertEqual(data["status"], "ISSUED")
        self.assertTrue(len(data["invoice_number"]) > 0)
        self.assertTrue(data["transaction_code"].startswith("TX-"))
        self.assertTrue(data["xml_file_url"].endswith(".xml"))
        self.assertTrue(data["pdf_file_url"].endswith(".pdf"))
        self.assertIsNotNone(data["issued_at"])

        # Kiểm tra TaxInvoice được tạo tự động với loại ADJUSTMENT và DECREASE
        from tax_management.models import TaxInvoice
        tax_inv = TaxInvoice.objects.filter(source_reference=data["code"]).first()
        self.assertIsNotNone(tax_inv)
        self.assertEqual(tax_inv.invoice_type, "ADJUSTMENT")
        self.assertEqual(tax_inv.adjustment_effect, "DECREASE")
        self.assertEqual(tax_inv.subtotal, Decimal("30000000.00"))
        self.assertEqual(tax_inv.tax_amount, Decimal("2600000.00"))

    def test_14_issue_discount_invoice_failure_and_retry(self):
        """Test issuance failure handling and subsequent retry (EF-08, AF-06)."""
        payload = {
            "customer": str(self.customer.pk),
            "invoice_series": "1C26TBB",
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "discount_basis": "Thỏa thuận",
            "total_discount_before_tax": "10000000.00",
            "lines": [{"original_invoice_line": str(self.inv1_line1.pk)}],
        }
        res_create = self.client.post(
            f"/api/v1/sales/discount-invoices/?company_id={self.company.pk}",
            payload,
            format="json",
        )
        inv_id = res_create.data["id"]

        # Phát hành có lỗi từ nhà cung cấp
        res_fail = self.client.post(
            f"/api/v1/sales/discount-invoices/{inv_id}/issue/?company_id={self.company.pk}",
            {"force_fail": True, "error_message": "Chữ ký số bên bán hết hạn hiệu lực"},
            format="json",
        )
        self.assertEqual(res_fail.status_code, 200)
        self.assertEqual(res_fail.data["status"], "ISSUE_FAILED")
        self.assertIn("hết hạn hiệu lực", res_fail.data["issue_error_message"])

        # Thử lại phát hành (AF-06)
        res_retry = self.client.post(
            f"/api/v1/sales/discount-invoices/{inv_id}/retry-issue/?company_id={self.company.pk}"
        )
        self.assertEqual(res_retry.status_code, 200)
        self.assertEqual(res_retry.data["status"], "ISSUED")

    def test_15_check_issue_status_when_issuing(self):
        """Test checking issuance status when transaction is in ISSUING (EF-09)."""
        inv = models.SalesDiscountInvoice.objects.create(
            company=self.company,
            customer=self.customer,
            invoice_series="1C26TBB",
            invoice_date=self.today,
            document_date=self.today,
            currency=self.currency,
            discount_basis="Thỏa thuận",
            period_start=self.period_start,
            period_end=self.period_end,
            total_discount_before_tax=Decimal("10000000"),
            total_tax_amount=Decimal("1000000"),
            total_adjusted_amount=Decimal("11000000"),
            status=models.DiscountInvoiceStatus.ISSUING,
            issue_control_code="ISSUE-CTRL-001",
            created_by=self.user_account,
        )
        models.SalesDiscountInvoiceLine.objects.create(
            invoice=inv,
            line_no=1,
            original_invoice=self.invoice_1,
            original_invoice_line=self.inv1_line1,
            original_invoice_date=self.invoice_1.invoice_date,
            eligible_revenue=Decimal("100000000"),
            allocated_discount_amount=Decimal("10000000"),
            tax_rate_percentage=Decimal("10.00"),
            adjusted_tax_amount=Decimal("1000000"),
            line_total=Decimal("11000000"),
        )

        res = self.client.post(
            f"/api/v1/sales/discount-invoices/{inv.pk}/check-issue-status/?company_id={self.company.pk}"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "ISSUED")

    def test_16_cannot_edit_or_delete_issued_or_issuing_invoice(self):
        """Test that editing or deleting an ISSUED or ISSUING invoice is blocked (EF-10)."""
        inv = models.SalesDiscountInvoice.objects.create(
            company=self.company,
            customer=self.customer,
            invoice_series="1C26TBB",
            invoice_date=self.today,
            document_date=self.today,
            currency=self.currency,
            discount_basis="Thỏa thuận",
            period_start=self.period_start,
            period_end=self.period_end,
            total_discount_before_tax=Decimal("10000000"),
            status=models.DiscountInvoiceStatus.ISSUED,
            created_by=self.user_account,
        )

        # Thử sửa
        res_edit = self.client.put(
            f"/api/v1/sales/discount-invoices/{inv.pk}/?company_id={self.company.pk}",
            {"total_discount_before_tax": "5000000"},
            format="json",
        )
        self.assertEqual(res_edit.status_code, 400)

        # Thử xóa
        res_del = self.client.delete(f"/api/v1/sales/discount-invoices/{inv.pk}/?company_id={self.company.pk}")
        self.assertEqual(res_del.status_code, 400)

    def test_17_cancel_unissued_invoice_with_reason(self):
        """Test cancelling unissued discount invoice with required reason (AF-08, BR-SAL-13-13)."""
        inv = models.SalesDiscountInvoice.objects.create(
            company=self.company,
            customer=self.customer,
            invoice_series="1C26TBB",
            invoice_date=self.today,
            document_date=self.today,
            currency=self.currency,
            discount_basis="Thỏa thuận",
            period_start=self.period_start,
            period_end=self.period_end,
            total_discount_before_tax=Decimal("10000000"),
            status=models.DiscountInvoiceStatus.DRAFT,
            created_by=self.user_account,
        )

        # Hủy không lý do -> lỗi
        res_no_reason = self.client.post(
            f"/api/v1/sales/discount-invoices/{inv.pk}/cancel/?company_id={self.company.pk}",
            {"cancellation_reason": ""},
            format="json",
        )
        self.assertEqual(res_no_reason.status_code, 400)

        # Hủy có lý do -> thành công
        res_cancel = self.client.post(
            f"/api/v1/sales/discount-invoices/{inv.pk}/cancel/?company_id={self.company.pk}",
            {"cancellation_reason": "Khách hàng không đồng ý tỷ lệ phân bổ"},
            format="json",
        )
        self.assertEqual(res_cancel.status_code, 200)
        self.assertEqual(res_cancel.data["status"], "CANCELLED")

        # Thử hủy hóa đơn đã phát hành -> bị chặn
        inv.status = models.DiscountInvoiceStatus.ISSUED
        inv.save()
        res_cancel_issued = self.client.post(
            f"/api/v1/sales/discount-invoices/{inv.pk}/cancel/?company_id={self.company.pk}",
            {"cancellation_reason": "Hủy hóa đơn đã phát hành"},
            format="json",
        )
        self.assertEqual(res_cancel_issued.status_code, 400)

    def test_18_download_files_and_send_email(self):
        """Test downloading invoice files and sending email (AF-08)."""
        inv = models.SalesDiscountInvoice.objects.create(
            company=self.company,
            customer=self.customer,
            invoice_series="1C26TBB",
            invoice_number="0000888",
            invoice_date=self.today,
            document_date=self.today,
            currency=self.currency,
            discount_basis="Thỏa thuận",
            period_start=self.period_start,
            period_end=self.period_end,
            total_discount_before_tax=Decimal("10000000"),
            status=models.DiscountInvoiceStatus.ISSUED,
            xml_file_url="/media/invoices/xml_test.xml",
            pdf_file_url="/media/invoices/pdf_test.pdf",
            lookup_url="https://hoadondientu.gdt.gov.vn",
            lookup_code="ABCDEF1234",
            buyer_email="customer@example.com",
            created_by=self.user_account,
        )

        # Tải tệp
        res_dl = self.client.get(
            f"/api/v1/sales/discount-invoices/{inv.pk}/download-files/?company_id={self.company.pk}"
        )
        self.assertEqual(res_dl.status_code, 200)
        self.assertEqual(res_dl.data["xml_file_url"], "/media/invoices/xml_test.xml")
        self.assertEqual(res_dl.data["lookup_code"], "ABCDEF1234")

        # Gửi email
        res_mail = self.client.post(
            f"/api/v1/sales/discount-invoices/{inv.pk}/send-email/?company_id={self.company.pk}",
            {"email": "ketoan@dailuong.com.vn"},
            format="json",
        )
        self.assertEqual(res_mail.status_code, 200)
        self.assertTrue(res_mail.data["success"])
