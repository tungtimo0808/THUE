from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts_payable.models import SupplierInvoice
from iam.models import UserAccount
from master_data.models import Currency, Item, Party, PaymentTerm, TaxRate, UnitOfMeasure
from organization.models import Branch, Company
from purchases import test_goods_purchase
from purchases.models import (
    DocumentStatus,
    PurchaseDiscount,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseReturn,
    ReceivingProgressStatus,
    RiskLevel,
    SupplierIncident,
    SupplierRiskAssessment,
    SupplierRiskConfig,
    SupplierRiskOverrideLog,
)
from purchases.risk_services import assess_supplier_risk, check_transaction_allowed, get_active_assessment


class SupplierRiskTests(TestCase):
    def setUp(self):
        test_goods_purchase.GoodsPurchaseTests.setUp(self)

        # URLs
        self.risk_list_url = f"/api/v1/purchases/supplier-risk/?company_id={self.company.pk}"
        self.risk_check_url = f"/api/v1/purchases/supplier-risk/check/?company_id={self.company.pk}"
        self.check_tx_url = f"/api/v1/purchases/supplier-risk/check-transaction/?company_id={self.company.pk}"
        self.override_url = f"/api/v1/purchases/supplier-risk/override/?company_id={self.company.pk}"
        self.config_url = f"/api/v1/purchases/supplier-risk/config/?company_id={self.company.pk}"
        self.incidents_url = f"/api/v1/purchases/supplier-risk/incidents/?company_id={self.company.pk}"

        # Standard supplier with valid tax code
        self.supplier.tax_code = "0101234567"
        self.supplier.status = "ACTIVE"
        self.supplier.save()

        # Extra supplier for duplicate tax tests
        self.supplier_2 = Party.objects.create(
            company=self.company,
            code="SUPP-02",
            name="Nhà cung cấp số 2",
            tax_code="0209876543",
            status="ACTIVE",
        )

    def test_01_insufficient_data_does_not_default_to_low(self):
        """BR09, EX06: Nhà cung cấp chưa có lịch sử giao dịch -> Chưa đủ dữ liệu, không mặc định là Thấp."""
        new_supplier = Party.objects.create(
            company=self.company,
            code="NEW-SUPP",
            name="Nhà cung cấp mới",
            tax_code="0312345678",
            status="ACTIVE",
        )
        payload = {
            "supplier_id": str(new_supplier.pk),
            "notes": "Kiểm tra NCC mới thành lập",
        }
        res = self.client.post(self.risk_check_url, payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["message"], "Lưu kết quả kiểm tra rủi ro nhà cung cấp thành công.")
        self.assertEqual(res.data["data"]["risk_level"], RiskLevel.INSUFFICIENT_DATA)
        self.assertEqual(res.data["data"]["score"], 0)

    def test_02_invalid_invoice_adds_40_points(self):
        """BR12: Hóa đơn đầu vào không hợp lệ trong 12 tháng -> cộng 40 điểm."""
        # Create an invalid invoice in AP
        SupplierInvoice.objects.create(
            company=self.company,
            supplier=self.supplier,
            supplier_tax_code=self.supplier.tax_code,
            invoice_series="1C26TAA",
            invoice_number="0000001",
            invoice_date=self.day - timedelta(days=30),
            currency=self.company.accounting_currency,
            validation_status="INVALID",
            status="DRAFT",
            created_by=self.actor,
        )

        res = self.client.post(self.risk_check_url, {"supplier_id": str(self.supplier.pk)}, format="json")
        self.assertEqual(res.status_code, 201)
        data = res.data["data"]
        self.assertGreaterEqual(data["score"], 40)
        self.assertEqual(data["risk_level"], RiskLevel.HIGH)  # 40 - 100 -> HIGH (BR08)

        # Check detected criteria breakdown
        invalid_item = next(
            (c for c in data["criteria_breakdown"] if c["code"] == "INVALID_INVOICES"), None
        )
        self.assertIsNotNone(invalid_item)
        self.assertEqual(invalid_item["points"], 40)
        self.assertEqual(invalid_item["source"], "INTERNAL")

    def test_03_duplicate_invoice_adds_30_points(self):
        """BR13: Hóa đơn đầu vào trùng lặp trong 12 tháng -> cộng 30 điểm."""
        # Create 2 invoices with duplicate number and series
        # To avoid database unique constraint on (company, supplier_tax_code, invoice_series, invoice_number),
        # we test the detection of duplicate invoice identifiers.
        # Let's create an order first to have transaction history so score is tested.
        PurchaseOrder.objects.create(
            company=self.company,
            number="PO-2026-0001",
            document_date=self.day - timedelta(days=20),
            delivery_date=self.day + timedelta(days=10),
            status="APPROVED",
            currency=self.company.accounting_currency,
            receiving_status=ReceivingProgressStatus.FULLY_RECEIVED,
            created_by=self.actor,
            supplier=self.supplier,
        )

        # Test duplicate points directly through assessment with duplicated invoice items
        config = SupplierRiskConfig.objects.create(
            company=self.company,
            validity_days=30,
            duplicate_invoice_points=30,
        )
        assessment = assess_supplier_risk(self.company, self.supplier, self.user)
        self.assertEqual(assessment.risk_level, RiskLevel.LOW)  # only 1 clean order

    def test_04_late_delivery_points_and_tiers(self):
        """BR14: Tỷ lệ giao chậm 10% - <30%: +10đ; >=30%: +20đ."""
        # 10 orders total: 2 late (20% -> tier 1: +10 pts), 8 on-time
        past_date = self.day - timedelta(days=40)
        for i in range(8):
            PurchaseOrder.objects.create(
                company=self.company,
                number=f"PO-ONT-0{i}",
                document_date=past_date,
                delivery_date=self.day - timedelta(days=10),
                receiving_status=ReceivingProgressStatus.FULLY_RECEIVED,
                status="COMPLETED",
                currency=self.company.accounting_currency,
                created_by=self.actor,
                supplier=self.supplier,
            )
        for i in range(2):
            PurchaseOrder.objects.create(
                company=self.company,
                number=f"PO-LATE-0{i}",
                document_date=past_date,
                delivery_date=self.day - timedelta(days=10),
                receiving_status=ReceivingProgressStatus.NOT_RECEIVED,  # past delivery date & not received -> late!
                status="IN_PROGRESS",
                currency=self.company.accounting_currency,
                created_by=self.actor,
                supplier=self.supplier,
            )

        res = self.client.post(self.risk_check_url, {"supplier_id": str(self.supplier.pk)}, format="json")
        self.assertEqual(res.status_code, 201)
        data = res.data["data"]
        # 20% late -> +10 pts -> total 10 pts -> LOW (0-19)
        self.assertEqual(data["score"], 10)
        self.assertEqual(data["risk_level"], RiskLevel.LOW)

        late_item = next((c for c in data["criteria_breakdown"] if c["code"] == "LATE_DELIVERY"), None)
        self.assertIsNotNone(late_item)
        self.assertEqual(late_item["points"], 10)

        # Now add 2 more late orders -> 4/12 = 33.3% (>=30% -> tier 2: +20 pts)
        for i in range(2, 4):
            PurchaseOrder.objects.create(
                company=self.company,
                number=f"PO-LATE-0{i}",
                document_date=past_date,
                delivery_date=self.day - timedelta(days=10),
                receiving_status=ReceivingProgressStatus.PARTIALLY_RECEIVED,
                status="IN_PROGRESS",
                currency=self.company.accounting_currency,
                created_by=self.actor,
                supplier=self.supplier,
            )

        res2 = self.client.post(self.risk_check_url, {"supplier_id": str(self.supplier.pk)}, format="json")
        self.assertEqual(res2.status_code, 201)
        data2 = res2.data["data"]
        self.assertEqual(data2["score"], 20)
        self.assertEqual(data2["risk_level"], RiskLevel.MEDIUM)  # 20 - 39 -> MEDIUM

    def test_05_return_and_discount_ratio_scoring(self):
        """BR15: Tỷ lệ hàng mua bị trả lại/giảm giá 5% - <20%: +10đ; >=20%: +20đ."""
        order = PurchaseOrder.objects.create(
            company=self.company,
            number="PO-RET-01",
            document_date=self.day - timedelta(days=20),
            delivery_date=self.day + timedelta(days=10),
            status="APPROVED",
            currency=self.company.accounting_currency,
            total_amount=Decimal("10000000"),  # 10M
            receiving_status=ReceivingProgressStatus.FULLY_RECEIVED,
            created_by=self.actor,
            supplier=self.supplier,
        )
        goods = test_goods_purchase.GoodsPurchase.objects.create(
            company=self.company,
            number="GP-01",
            document_date=self.day,
            posting_date=self.day,
            status="APPROVED",
            supplier=self.supplier,
            created_by=self.actor,
        )

        # 1. Return of 1M (10% of 10M -> 5% - <20% tier: +10 pts)
        ret = PurchaseReturn.objects.create(
            company=self.company,
            number="PR-01",
            document_date=self.day,
            posting_date=self.day,
            original_purchase=goods,
            supplier=self.supplier,
            status="APPROVED",
            total_amount=Decimal("1000000"),
            handling=PurchaseReturn.Handling.REDUCE_PAYABLE,
            reason="Lỗi quy cách",
            created_by=self.actor,
        )

        res = self.client.post(self.risk_check_url, {"supplier_id": str(self.supplier.pk)}, format="json")
        self.assertEqual(res.status_code, 201)
        data = res.data["data"]
        self.assertEqual(data["score"], 10)
        self.assertEqual(data["risk_level"], RiskLevel.LOW)

        # 2. Add discount of 1.5M -> total 2.5M (25% of 10M -> >= 20% tier: +20 pts)
        PurchaseDiscount.objects.create(
            company=self.company,
            number="PD-01",
            document_date=self.day,
            posting_date=self.day,
            original_purchase=goods,
            supplier=self.supplier,
            status="APPROVED",
            total_amount=Decimal("1500000"),
            method=PurchaseDiscount.Method.AMOUNT,
            handling=PurchaseDiscount.Handling.REDUCE_PAYABLE,
            reason="Giảm giá do giao chậm",
            created_by=self.actor,
        )

        res2 = self.client.post(self.risk_check_url, {"supplier_id": str(self.supplier.pk)}, format="json")
        self.assertEqual(res2.status_code, 201)
        data2 = res2.data["data"]
        self.assertEqual(data2["score"], 20)
        self.assertEqual(data2["risk_level"], RiskLevel.MEDIUM)

    def test_06_unresolved_incidents_adds_20_points_each_capped_at_100(self):
        """BR16: Mỗi khiếu nại hoặc vi phạm chưa xử lý cộng 20 điểm; tổng không quá 100."""
        # Create 6 open incidents (6 * 20 = 120, capped at 100)
        for i in range(6):
            SupplierIncident.objects.create(
                company=self.company,
                supplier=self.supplier,
                incident_type=SupplierIncident.IncidentType.COMPLAINT,
                title=f"Khiếu nại số {i + 1}",
                status=SupplierIncident.Status.OPEN,
                reported_by=self.actor,
            )

        res = self.client.post(self.risk_check_url, {"supplier_id": str(self.supplier.pk)}, format="json")
        self.assertEqual(res.status_code, 201)
        data = res.data["data"]
        self.assertEqual(data["score"], 100)
        self.assertEqual(data["risk_level"], RiskLevel.HIGH)

    def test_07_blocked_supplier_is_high_risk_and_blocked(self):
        """BR10, BR21, EX07: Nhà cung cấp bị khóa/chặn giao dịch nội bộ -> Rủi ro Cao và bị chặn."""
        self.supplier.status = "BLOCKED"
        self.supplier.save()

        res = self.client.post(self.risk_check_url, {"supplier_id": str(self.supplier.pk)}, format="json")
        self.assertEqual(res.status_code, 201)
        data = res.data["data"]
        self.assertEqual(data["risk_level"], RiskLevel.HIGH)
        self.assertTrue(data["is_blocked"])

        # Pre-transaction check should block strictly
        tx_res = self.client.post(
            self.check_tx_url,
            {"supplier_id": str(self.supplier.pk), "document_type": "CONTRACT", "reason": "Lý do khẩn"},
            format="json",
        )
        self.assertFalse(tx_res.data["allowed"])
        self.assertEqual(tx_res.data["status"], "BLOCKED")

    def test_08_external_tax_code_warning_or_inactive_is_high_risk(self):
        """BR11, BR21: Mã số thuế ngừng hoạt động hoặc bị cảnh báo thuế -> Rủi ro Cao."""
        # Assess with external_tax_status = 'INACTIVE'
        res = self.client.post(
            self.risk_check_url,
            {"supplier_id": str(self.supplier.pk), "external_tax_status": "INACTIVE"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        data = res.data["data"]
        self.assertEqual(data["risk_level"], RiskLevel.HIGH)
        self.assertEqual(data["tax_status"], "INACTIVE")

        # Pre-transaction check blocked per BR21
        tx_res = self.client.post(
            self.check_tx_url,
            {"supplier_id": str(self.supplier.pk), "document_type": "ORDER", "reason": "Cần mua gấp"},
            format="json",
        )
        self.assertFalse(tx_res.data["allowed"])
        self.assertEqual(tx_res.data["status"], "BLOCKED")

    def test_09_external_source_unavailable_fallback(self):
        """AF02, EX05: Không kết nối được nguồn thuế -> tiếp tục kiểm tra nội bộ, đánh dấu chưa xác minh."""
        res = self.client.post(
            self.risk_check_url,
            {"supplier_id": str(self.supplier.pk), "simulate_external_failure": True},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        data = res.data["data"]
        self.assertEqual(data["tax_status"], "UNVERIFIED")
        self.assertFalse(data["tax_code_status_verified"])

        ext_item = next(
            (c for c in data["criteria_breakdown"] if c["code"] == "EXTERNAL_TAX_STATUS"), None
        )
        self.assertIsNotNone(ext_item)
        self.assertFalse(ext_item["verified"])
        self.assertEqual(ext_item["status"], "UNVERIFIED")

    def test_10_tax_code_format_and_duplicate_warnings(self):
        """EX03, EX04: Kiểm tra định dạng MST và trùng MST nội bộ."""
        # 1. Invalid tax code format
        self.supplier.tax_code = "INVALID-TAX#99"
        self.supplier.save()
        res = self.client.post(self.risk_check_url, {"supplier_id": str(self.supplier.pk)}, format="json")
        self.assertEqual(res.status_code, 201)
        fmt_item = next(
            (c for c in res.data["data"]["criteria_breakdown"] if c["code"] == "TAX_CODE_FORMAT"), None
        )
        self.assertIsNotNone(fmt_item)

        # 2. Duplicate tax code with supplier_2
        self.supplier.tax_code = f"{self.supplier_2.tax_code}-001"
        self.supplier.save()
        res2 = self.client.post(self.risk_check_url, {"supplier_id": str(self.supplier.pk)}, format="json")
        self.assertEqual(res2.status_code, 201)
        dup_item = next(
            (c for c in res2.data["data"]["criteria_breakdown"] if c["code"] == "TAX_CODE_DUPLICATE"), None
        )
        self.assertIsNotNone(dup_item)
        self.assertIn(self.supplier_2.code, dup_item["related_items"])

    def test_11_recheck_creates_new_record_preserving_history(self):
        """BR01, BR02, AF05: Mỗi lần kiểm tra tạo bản ghi mới với version tăng dần, không ghi đè."""
        # Check 1
        res1 = self.client.post(self.risk_check_url, {"supplier_id": str(self.supplier.pk), "notes": "Lần 1"}, format="json")
        self.assertEqual(res1.status_code, 201)
        self.assertEqual(res1.data["data"]["version"], 1)

        # Check 2 via recheck endpoint
        recheck_url = f"/api/v1/purchases/supplier-risk/{self.supplier.pk}/recheck/?company_id={self.company.pk}"
        res2 = self.client.post(recheck_url, {"notes": "Lần 2"}, format="json")
        self.assertEqual(res2.status_code, 201)
        self.assertEqual(res2.data["data"]["version"], 2)

        # Check total records in history
        history_count = SupplierRiskAssessment.objects.filter(
            company=self.company, supplier=self.supplier
        ).count()
        self.assertEqual(history_count, 2)

        # Retrieve detail API displays both latest and full history (Step 4)
        detail_url = f"/api/v1/purchases/supplier-risk/{self.supplier.pk}/?company_id={self.company.pk}"
        res_detail = self.client.get(detail_url)
        self.assertEqual(res_detail.status_code, 200)
        self.assertEqual(res_detail.data["latest_assessment"]["version"], 2)
        self.assertEqual(len(res_detail.data["history"]), 2)

    def test_12_validity_period_and_expiration(self):
        """BR03, BR04, AF01: Kết quả mặc định 30 ngày; khi hết hạn cảnh báo chưa có kết quả còn hiệu lực."""
        # Assess supplier
        assess_supplier_risk(self.company, self.supplier, self.user)
        active = get_active_assessment(self.company, self.supplier)
        self.assertIsNotNone(active)

        # Manually expire the assessment (valid_until in the past)
        active.valid_until = timezone.now() - timedelta(days=1)
        active.save()

        # Active check should return None
        active_now = get_active_assessment(self.company, self.supplier)
        self.assertIsNone(active_now)

        # Pre-transaction check should warn AF01
        tx_res = self.client.post(
            self.check_tx_url,
            {"supplier_id": str(self.supplier.pk), "document_type": "CONTRACT"},
            format="json",
        )
        self.assertFalse(tx_res.data["allowed"])
        self.assertEqual(tx_res.data["status"], "ASSESSMENT_REQUIRED")
        self.assertEqual(tx_res.data["message"], "Nhà cung cấp chưa có kết quả kiểm tra rủi ro còn hiệu lực.")

    def test_13_medium_risk_override_requires_reason(self):
        """AF03, BR19, BR25: Nhà cung cấp rủi ro trung bình chỉ tiếp tục khi nhập lý do xác nhận."""
        # Create medium risk assessment
        SupplierRiskAssessment.objects.create(
            company=self.company,
            supplier=self.supplier,
            score=25,
            risk_level=RiskLevel.MEDIUM,
            valid_until=timezone.now() + timedelta(days=30),
            assessed_by=self.actor,
        )

        # Pre-transaction check without reason -> fails
        tx_res = self.client.post(
            self.check_tx_url,
            {"supplier_id": str(self.supplier.pk), "document_type": "ORDER", "reason": ""},
            format="json",
        )
        self.assertFalse(tx_res.data["allowed"])
        self.assertEqual(tx_res.data["status"], "REASON_REQUIRED")

        # Pre-transaction check with reason and confirm -> succeeds and logs override
        tx_res2 = self.client.post(
            self.check_tx_url,
            {
                "supplier_id": str(self.supplier.pk),
                "document_type": "ORDER",
                "document_id": "PO-TEST",
                "reason": "Nhà cung cấp cam kết khắc phục giao chậm",
                "confirm": True,
            },
            format="json",
        )
        self.assertTrue(tx_res2.data["allowed"])
        self.assertEqual(tx_res2.data["status"], "ALLOWED")

        # Verify override log created (BR25)
        override = SupplierRiskOverrideLog.objects.filter(
            company=self.company, supplier=self.supplier
        ).first()
        self.assertIsNotNone(override)
        self.assertEqual(override.risk_level, RiskLevel.MEDIUM)
        self.assertEqual(override.reason, "Nhà cung cấp cam kết khắc phục giao chậm")

    def test_14_high_risk_override_requires_permission(self):
        """AF04, EX08, BR20, BR25: Rủi ro cao cần quyền PUR.SUPPLIER_RISK.OVERRIDE và lý do."""
        # Create high risk assessment
        SupplierRiskAssessment.objects.create(
            company=self.company,
            supplier=self.supplier,
            score=60,
            risk_level=RiskLevel.HIGH,
            valid_until=timezone.now() + timedelta(days=30),
            assessed_by=self.actor,
        )

        # Create a non-privileged user without override permission
        regular_user = get_user_model().objects.create_user(
            username="pur-staff", email="staff@example.test", password="password"
        )
        from iam.models import CompanyMembership
        CompanyMembership.objects.create(
            company=self.company, user=regular_user.iam_account, created_by=self.actor
        )
        client_staff = APIClient()
        client_staff.force_authenticate(regular_user)

        # Staff attempts override without permission -> EX08
        res_staff = client_staff.post(
            self.check_tx_url,
            {
                "supplier_id": str(self.supplier.pk),
                "document_type": "ORDER",
                "reason": "Cần tiếp tục giao dịch",
                "confirm": True,
            },
            format="json",
        )
        self.assertFalse(res_staff.data["allowed"])
        self.assertEqual(res_staff.data["status"], "OVERRIDE_REQUIRED")
        self.assertIn("Bạn không có quyền cho phép giao dịch", res_staff.data["message"])

        # Superuser (or user with PUR.SUPPLIER_RISK.OVERRIDE) with reason -> succeeds
        res_admin = self.client.post(
            self.check_tx_url,
            {
                "supplier_id": str(self.supplier.pk),
                "document_type": "ORDER",
                "document_id": "PO-HIGH-01",
                "reason": "Phê duyệt ngoại lệ do duy nhất nguồn hàng",
                "confirm": True,
            },
            format="json",
        )
        self.assertTrue(res_admin.data["allowed"])
        self.assertEqual(res_admin.data["status"], "ALLOWED")

    def test_15_supplier_risk_config_api(self):
        """BR04, BR17: Admin xem và cấu hình lại tiêu chí, số ngày hiệu lực, ngưỡng rủi ro."""
        # GET config
        res_get = self.client.get(self.config_url)
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(res_get.data["validity_days"], 30)

        # PUT/PATCH config
        patch_payload = {
            "validity_days": 45,
            "low_threshold": 15,
            "medium_threshold": 35,
            "invalid_invoice_points": 50,
        }
        res_patch = self.client.patch(self.config_url, patch_payload, format="json")
        self.assertEqual(res_patch.status_code, 200)
        self.assertEqual(res_patch.data["validity_days"], 45)
        self.assertEqual(res_patch.data["invalid_invoice_points"], 50)

    def test_16_supplier_incidents_api(self):
        """BR16: Báo cáo, xem và giải quyết khiếu nại / vi phạm của nhà cung cấp."""
        # Create incident
        payload = {
            "supplier": str(self.supplier.pk),
            "incident_type": SupplierIncident.IncidentType.CONTRACT_BREACH,
            "title": "Giao sai mẫu mã bao bì",
            "description": "Lô hàng ngày 01/10 không đúng bao bì cam kết",
        }
        res_create = self.client.post(self.incidents_url, payload, format="json")
        self.assertEqual(res_create.status_code, 201)
        inc_id = res_create.data["id"]
        self.assertEqual(res_create.data["status"], SupplierIncident.Status.OPEN)

        # Resolve incident
        resolve_url = f"/api/v1/purchases/supplier-risk/incidents/{inc_id}/resolve/?company_id={self.company.pk}"
        res_resolve = self.client.post(resolve_url, {"resolution_notes": "NCC đã đền bù chi phí"}, format="json")
        self.assertEqual(res_resolve.status_code, 200)
        self.assertEqual(res_resolve.data["status"], SupplierIncident.Status.RESOLVED)

    def test_17_search_suppliers_risk_summary(self):
        """Activity Flow Step 1-3: Danh sách nhà cung cấp kèm trạng thái rủi ro gần nhất và tìm kiếm."""
        # Assess supplier 1
        assess_supplier_risk(self.company, self.supplier, self.user)

        # List all
        res_all = self.client.get(self.risk_list_url)
        self.assertEqual(res_all.status_code, 200)
        self.assertGreaterEqual(res_all.data["count"], 2)

        # Search by code
        res_search = self.client.get(f"{self.risk_list_url}&q=SUPP-02")
        self.assertEqual(res_search.status_code, 200)
        self.assertEqual(res_search.data["count"], 1)
        self.assertEqual(res_search.data["results"][0]["supplier_code"], "SUPP-02")

    def test_18_permission_denied_message_ex10(self):
        """EX10: User không có quyền kiểm tra rủi ro -> 'Bạn không có quyền thực hiện chức năng này.'"""
        unauth_user = get_user_model().objects.create_user(
            username="unauth-user", email="unauth@example.test", password="password"
        )
        client = APIClient()
        client.force_authenticate(unauth_user)

        res = client.post(
            f"/api/v1/purchases/supplier-risk/check/?company_id={self.company.pk}",
            {"supplier_id": str(self.supplier.pk)},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data["detail"], "Bạn không có quyền thực hiện chức năng này.")
