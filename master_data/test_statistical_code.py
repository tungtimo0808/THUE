import csv
from datetime import date
from decimal import Decimal
import io

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from general_ledger.models import (
    Account,
    AccountClass,
    AccountingPeriod,
    ChartOfAccounts,
    JournalEntry,
    JournalLine,
    JournalStatus,
)
from iam.models import (
    CompanyMembership,
    Permission,
    Role,
    RolePermission,
    UserRoleAssignment,
)
from organization.models import Company

from .models import CatalogStatus, Currency, StatisticalCode


class StatisticalCodeManagementTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam", "is_active": True})
        self.company = Company.objects.create(
            code="CORP_TEST_STAT",
            name="Công ty TNHH Thống Kê",
            legal_name="Công ty TNHH Thống Kê",
            tax_code="0108888888",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.other_company = Company.objects.create(
            code="CORP_OTHER_STAT",
            name="Công ty Khác",
            legal_name="Công ty Cổ Phần Khác",
            tax_code="0108888887",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )

        # GL account
        cl = AccountClass.objects.create(company=self.company, code="EXPENSE", name="Chi phí", normal_balance="DEBIT")
        chart = ChartOfAccounts.objects.create(company=self.company, code="TT200", name="Hệ thống TT200", effective_from=self.today, is_default=True)
        self.gl_642 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=cl,
            code="642", name="Chi phí QLDN", account_type="EXPENSE", normal_balance="DEBIT",
            is_postable=True, status="ACTIVE",
        )

        # IAM user & client
        auth_user = get_user_model().objects.create_user(username="stat-accountant", password="password")
        self.account = auth_user.iam_account
        self.membership = CompanyMembership.objects.create(company=self.company, user=self.account, created_by=self.account)
        self.role = Role.objects.create(company=self.company, code="STAT_ACCOUNTANT", name="Kế toán thống kê")
        self.assignment = UserRoleAssignment.objects.create(company_membership=self.membership, role=self.role, assigned_by=self.account)

        self.client = APIClient()
        self.client.force_authenticate(auth_user)
        self.url = f"/api/v1/master-data/statistical-codes/?company_id={self.company.pk}"

    def grant(self, *actions):
        for action in actions:
            perm = Permission.objects.get(code=f"MD.STATISTICAL_CODE.{action}")
            RolePermission.objects.get_or_create(role=self.role, permission=perm, defaults={"effect": "ALLOW"})

    def payload(self, **overrides):
        data = {
            "company": str(self.company.pk),
            "code": "CD-TET2026",
            "name": "Chiến dịch Tết 2026",
            "category": "CAMPAIGN",
            "allow_voucher_selection": True,
            "applicable_scope": "PAYMENT,PURCHASE",
            "description": "Theo dõi chi phí chiến dịch Tết",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
        }
        data.update(overrides)
        return data

    def test_01_rbac_permissions(self):
        """Kiểm tra phân quyền RBAC cho từng thao tác (BR-MD-STAT-23)."""
        # 1. Chưa có quyền gì -> 403 Forbidden
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 403)

        res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(res.status_code, 403)

        # 2. Cấp quyền VIEW
        self.grant("VIEW")
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)

        # 3. Cấp quyền CREATE
        self.grant("CREATE")
        res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(res.status_code, 201)
        item_id = res.data["id"]

        # 4. Chưa có quyền EDIT -> PATCH bị 403
        res = self.client.patch(f"/api/v1/master-data/statistical-codes/{item_id}/?company_id={self.company.pk}", {"name": "Tên mới"}, format="json")
        self.assertEqual(res.status_code, 403)

        self.grant("EDIT")
        res = self.client.patch(f"/api/v1/master-data/statistical-codes/{item_id}/?company_id={self.company.pk}", {"name": "Tên mới", "version": 1}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["name"], "Tên mới")

        # 5. Chưa có quyền DEACTIVATE -> change-status bị 403
        res = self.client.post(f"/api/v1/master-data/statistical-codes/{item_id}/change-status/?company_id={self.company.pk}", {"status": "INACTIVE"}, format="json")
        self.assertEqual(res.status_code, 403)

        self.grant("DEACTIVATE")
        res = self.client.post(f"/api/v1/master-data/statistical-codes/{item_id}/change-status/?company_id={self.company.pk}", {"status": "INACTIVE"}, format="json")
        self.assertEqual(res.status_code, 200)

        # 6. Chưa có quyền DELETE -> DELETE bị 403
        res = self.client.delete(f"/api/v1/master-data/statistical-codes/{item_id}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 403)

        self.grant("DELETE")
        res = self.client.delete(f"/api/v1/master-data/statistical-codes/{item_id}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 204)

    def test_02_mandatory_fields_and_case_insensitive_unique_code(self):
        """Kiểm tra bắt buộc mã và tên, mã duy nhất không phân biệt hoa thường (BR-MD-STAT-01, 02, EF-02, 03)."""
        self.grant("VIEW", "CREATE")

        # Thiếu code -> 400
        p = self.payload()
        p.pop("code")
        res = self.client.post(self.url, p, format="json")
        self.assertEqual(res.status_code, 400)

        # Thiếu name -> 400
        p = self.payload(name="")
        res = self.client.post(self.url, p, format="json")
        self.assertEqual(res.status_code, 400)

        # Tạo mã CT-KM
        res = self.client.post(self.url, self.payload(code="  ct-km  ", name="Chương trình khuyến mại"), format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["code"], "CT-KM")

        # Tạo mã trùng chữ hoa/thường: 'CT-KM' hoặc 'Ct-Km' trong cùng doanh nghiệp -> 400
        res = self.client.post(self.url, self.payload(code="CT-KM", name="Khuyến mại trùng"), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("đã tồn tại", str(res.data))

        res = self.client.post(self.url, self.payload(code="ct-km", name="Khuyến mại trùng nữa"), format="json")
        self.assertEqual(res.status_code, 400)

        # Doanh nghiệp khác tạo cùng mã CT-KM -> thành công (BR-MD-STAT-03)
        item_other = StatisticalCode.objects.create(
            company=self.other_company,
            code="CT-KM",
            name="Khuyến mại bên khác",
            status="ACTIVE",
        )
        self.assertEqual(item_other.code, "CT-KM")

    def test_03_hierarchy_and_cycle_and_inactive_parent(self):
        """Kiểm tra quan hệ phân cấp cha-con, chu trình vòng lặp và cha ngừng sử dụng (BR-MD-STAT-04..06, 16, EF-04..05)."""
        self.grant("VIEW", "CREATE", "EDIT")

        # 1. Tạo mã cha
        res_parent = self.client.post(self.url, self.payload(code="CX-ROOT", name="Tổng hợp chuyến xe"), format="json")
        self.assertEqual(res_parent.status_code, 201)
        parent_id = res_parent.data["id"]

        # 2. Tạo mã con thuộc cha
        res_child = self.client.post(self.url, self.payload(code="CX-001", name="Chuyến xe Hà Nội Hải Phòng", parent=parent_id), format="json")
        self.assertEqual(res_child.status_code, 201)
        child_id = res_child.data["id"]
        self.assertEqual(res_child.data["parent_code"], "CX-ROOT")

        # 3. Mã cha là chính nó -> 400 (BR-MD-STAT-05)
        res = self.client.patch(f"/api/v1/master-data/statistical-codes/{parent_id}/?company_id={self.company.pk}", {"parent": parent_id}, format="json")
        self.assertEqual(res.status_code, 400)

        # 4. Tạo quan hệ vòng lặp: cha đặt con làm cha -> 400 (EF-05)
        res = self.client.patch(f"/api/v1/master-data/statistical-codes/{parent_id}/?company_id={self.company.pk}", {"parent": child_id}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("chu trình", str(res.data).lower())

        # 5. Mã cha đang ngừng sử dụng -> không cho tạo con (BR-MD-STAT-16, EF-04)
        inactive_parent = StatisticalCode.objects.create(
            company=self.company,
            code="OLD-ROOT",
            name="Mã cũ đã ngưng",
            status=CatalogStatus.INACTIVE,
        )
        res = self.client.post(self.url, self.payload(code="OLD-CHILD", name="Con của cũ", parent=str(inactive_parent.id)), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("ngừng sử dụng", str(res.data))

        # 6. Mã cha thuộc công ty khác -> 400
        other_parent = StatisticalCode.objects.create(
            company=self.other_company,
            code="STAT-OTHER",
            name="Mã công ty khác",
            status=CatalogStatus.ACTIVE,
        )
        res = self.client.post(self.url, self.payload(code="STAT-CHILD2", name="Con ngoại lai", parent=str(other_parent.id)), format="json")
        self.assertEqual(res.status_code, 400)

    def test_04_allow_voucher_selection_configuration(self):
        """Kiểm tra cấu hình cho phép chọn trên chứng từ hoặc chỉ dùng tổng hợp (BR-MD-STAT-07)."""
        self.grant("VIEW", "CREATE")

        # Tạo mã chỉ dùng để tổng hợp nhóm
        res = self.client.post(self.url, self.payload(code="GRP-SALE", name="Nhóm kênh bán", allow_voucher_selection=False), format="json")
        self.assertEqual(res.status_code, 201)
        self.assertFalse(res.data["allow_voucher_selection"])

        # Lọc danh sách theo allow_voucher_selection
        res_list_false = self.client.get(f"{self.url}&allow_voucher_selection=false")
        results = res_list_false.data["results"] if isinstance(res_list_false.data, dict) and "results" in res_list_false.data else res_list_false.data
        self.assertTrue(any(item["code"] == "GRP-SALE" for item in results))

    def test_05_validity_dates_validation(self):
        """Kiểm tra ngày kết thúc >= ngày bắt đầu (EF-06)."""
        self.grant("VIEW", "CREATE")

        # Ngày kết thúc nhỏ hơn ngày bắt đầu -> 400 (EF-06)
        res = self.client.post(self.url, self.payload(start_date="2026-06-01", end_date="2026-01-01"), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("ngày bắt đầu", str(res.data).lower())

        # Ngày hợp lệ -> 201
        res = self.client.post(self.url, self.payload(start_date="2026-01-01", end_date="2026-12-31"), format="json")
        self.assertEqual(res.status_code, 201)

    def test_06_optimistic_locking_conflict(self):
        """Kiểm tra khóa lạc quan với trường version (EF-14)."""
        self.grant("VIEW", "CREATE", "EDIT")
        res = self.client.post(self.url, self.payload(code="STAT-OPT", name="Mã kiểm tra lock"), format="json")
        item_id = res.data["id"]
        self.assertEqual(res.data["version"], 1)

        # Gửi version sai -> 409 Conflict
        res = self.client.patch(
            f"/api/v1/master-data/statistical-codes/{item_id}/?company_id={self.company.pk}",
            {"name": "Tên cập nhật sai", "version": 999},
            format="json",
        )
        self.assertEqual(res.status_code, 409)

        # Gửi đúng version 1 -> thành công, version tăng lên 2
        res = self.client.patch(
            f"/api/v1/master-data/statistical-codes/{item_id}/?company_id={self.company.pk}",
            {"name": "Tên cập nhật đúng", "version": 1},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["version"], 2)
        self.assertEqual(res.data["name"], "Tên cập nhật đúng")

    def test_07_core_field_locked_when_transactions_exist(self):
        """Mã đã phát sinh dữ liệu chứng từ không được sửa mã định danh (BR-MD-STAT-14, 15, EF-07)."""
        self.grant("VIEW", "CREATE", "EDIT")
        res = self.client.post(self.url, self.payload(code="STAT-TRX", name="Mã có chứng từ"), format="json")
        item = StatisticalCode.objects.get(pk=res.data["id"])

        # Tạo chứng từ và dòng sổ cái liên kết tới mã thống kê này
        period = AccountingPeriod.objects.create(
            company=self.company, code="P-2026-01", fiscal_year=2026, period_number=1,
            start_date=self.today, end_date=self.today, status="OPEN",
        )
        entry = JournalEntry.objects.create(
            company=self.company, period=period, number="PKT-STAT-001", posting_date=self.today,
            description="Bút toán có mã thống kê", status=JournalStatus.POSTED, created_by=self.account,
        )
        JournalLine.objects.create(
            entry=entry, line_no=1, account=self.gl_642, debit=300000, credit=0,
            currency=self.currency, dimensions={"statistical_code_id": str(item.id)},
        )

        # Đổi mã -> 400 bị chặn (BR-MD-STAT-14, EF-07)
        res = self.client.patch(
            f"/api/v1/master-data/statistical-codes/{item.id}/?company_id={self.company.pk}",
            {"code": "STAT-TRX-NEW", "version": 1},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("không được thay đổi", str(res.data))

        # Đổi tên hoặc mô tả -> được phép (BR-MD-STAT-15)
        res = self.client.patch(
            f"/api/v1/master-data/statistical-codes/{item.id}/?company_id={self.company.pk}",
            {"name": "Tên mã mới được cập nhật", "version": 1},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["name"], "Tên mã mới được cập nhật")

    def test_08_deletion_restrictions(self):
        """Không cho xóa mã có con hoặc đã có chứng từ (BR-MD-STAT-12, 13, EF-08)."""
        self.grant("VIEW", "CREATE", "DELETE")

        # 1. Có con -> không cho xóa
        parent = StatisticalCode.objects.create(company=self.company, code="STAT-P", name="Cha", status="ACTIVE")
        child = StatisticalCode.objects.create(company=self.company, code="STAT-C", name="Con", parent=parent, status="ACTIVE")

        res = self.client.delete(f"/api/v1/master-data/statistical-codes/{parent.id}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 400)
        self.assertIn("mã con", str(res.data))

        # 2. Xóa con chưa phát sinh giao dịch -> 204 thành công (BR-MD-STAT-13)
        res = self.client.delete(f"/api/v1/master-data/statistical-codes/{child.id}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 204)

        # 3. Tạo giao dịch cho parent -> không cho xóa parent
        period = AccountingPeriod.objects.create(
            company=self.company, code="P-2026-02", fiscal_year=2026, period_number=2,
            start_date=self.today, end_date=self.today, status="OPEN",
        )
        entry = JournalEntry.objects.create(
            company=self.company, period=period, number="PKT-STAT-002", posting_date=self.today,
            description="Bút toán", status=JournalStatus.POSTED, created_by=self.account,
        )
        JournalLine.objects.create(
            entry=entry, line_no=1, account=self.gl_642, debit=100000, credit=0,
            currency=self.currency, dimensions={"statistical_code_id": str(parent.id)},
        )

        res = self.client.delete(f"/api/v1/master-data/statistical-codes/{parent.id}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 400)
        self.assertIn("dữ liệu giao dịch", str(res.data))

    def test_09_deactivation_rules_and_cascade_children(self):
        """Kiểm tra ngừng sử dụng cha có con và kích hoạt lại (BR-MD-STAT-16, 17, AF-10..13, EF-09)."""
        self.grant("VIEW", "CREATE", "DEACTIVATE")
        parent = StatisticalCode.objects.create(company=self.company, code="STAT-P2", name="Cha 2", status="ACTIVE")
        child = StatisticalCode.objects.create(company=self.company, code="STAT-C2", name="Con 2", parent=parent, status="ACTIVE")

        # 1. Ngừng cha khi con đang ACTIVE mà không confirm cascade -> 400 cảnh báo (BR-MD-STAT-17, EF-09)
        res = self.client.post(
            f"/api/v1/master-data/statistical-codes/{parent.id}/change-status/?company_id={self.company.pk}",
            {"status": "INACTIVE", "version": 1},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("mã con", str(res.data))

        # 2. Ngừng cha kèm deactivate_children=True -> thành công cả cha và con (AF-13)
        res = self.client.post(
            f"/api/v1/master-data/statistical-codes/{parent.id}/change-status/?company_id={self.company.pk}",
            {"status": "INACTIVE", "version": 1, "deactivate_children": True, "reason": "Ngừng toàn bộ nhóm"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        parent.refresh_from_db()
        child.refresh_from_db()
        self.assertEqual(parent.status, CatalogStatus.INACTIVE)
        self.assertEqual(child.status, CatalogStatus.INACTIVE)

        # 3. Kích hoạt lại con khi cha đang INACTIVE -> 400 bị chặn (BR-MD-STAT-16)
        res = self.client.post(
            f"/api/v1/master-data/statistical-codes/{child.id}/change-status/?company_id={self.company.pk}",
            {"status": "ACTIVE", "version": child.version},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("cha đang ngừng", str(res.data))

        # 4. Kích hoạt lại cha trước -> sau đó kích hoạt con -> thành công (AF-11)
        res = self.client.post(
            f"/api/v1/master-data/statistical-codes/{parent.id}/change-status/?company_id={self.company.pk}",
            {"status": "ACTIVE", "version": parent.version},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

        res = self.client.post(
            f"/api/v1/master-data/statistical-codes/{child.id}/change-status/?company_id={self.company.pk}",
            {"status": "ACTIVE", "version": child.version},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        child.refresh_from_db()
        self.assertEqual(child.status, CatalogStatus.ACTIVE)

    def test_10_quick_create(self):
        """Kiểm tra chức năng thêm nhanh mã thống kê từ màn hình chứng từ (AF-07, BR-MD-STAT-22)."""
        self.grant("VIEW", "CREATE")
        quick_url = f"/api/v1/master-data/statistical-codes/quick-create/?company_id={self.company.pk}"

        # Thêm nhanh hợp lệ
        res = self.client.post(
            quick_url,
            {"company": str(self.company.pk), "code": "CX-HP-01", "name": "Chuyến xe Hải Phòng 01", "category": "LOGISTICS"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["code"], "CX-HP-01")
        self.assertTrue(res.data["allow_voucher_selection"])
        self.assertEqual(res.data["status"], "ACTIVE")

        # Thiếu code -> 400
        res = self.client.post(quick_url, {"company": str(self.company.pk), "code": "", "name": "Thiếu mã"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_11_ai_suggestion(self):
        """Kiểm tra AI Assistant gợi ý mã thống kê dựa trên nội dung chứng từ (BR-MD-STAT-27..29, AF-12)."""
        self.grant("VIEW")
        StatisticalCode.objects.create(
            company=self.company,
            code="CX-HANOI",
            name="Chuyến xe vận chuyển tuyến Hà Nội",
            category="LOGISTICS",
            allow_voucher_selection=True,
            status=CatalogStatus.ACTIVE,
        )

        ai_url = f"/api/v1/master-data/statistical-codes/ai-suggest/?company_id={self.company.pk}"
        res = self.client.post(
            ai_url,
            {"company": str(self.company.pk), "description": "Chi phí thuê xe vận chuyển hàng đi Hà Nội", "context": "Tuyến giao hàng"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["suggested_code"], "CX-HANOI")
        self.assertGreater(res.data["confidence"], 0.5)
        self.assertTrue(len(res.data["reasoning"]) > 0)

    def test_12_csv_export_and_import(self):
        """Kiểm tra xuất và nhập danh sách mã thống kê từ file CSV (BR-MD-STAT-24, 25, AF-08, AF-09, EF-12, EF-13)."""
        self.grant("VIEW", "CREATE", "EXPORT", "IMPORT")

        # 1. Tạo 1 mã và export CSV
        StatisticalCode.objects.create(
            company=self.company,
            code="CD-MKT-01",
            name="Chiến dịch Marketing số 1",
            category="CAMPAIGN",
            status=CatalogStatus.ACTIVE,
        )
        res_export = self.client.get(f"/api/v1/master-data/statistical-codes/export-csv/?company_id={self.company.pk}")
        self.assertEqual(res_export.status_code, 200)
        self.assertIn("text/csv", res_export["Content-Type"])
        content = res_export.content.decode("utf-8-sig")
        self.assertIn("CD-MKT-01", content)
        self.assertIn("Chiến dịch Marketing số 1", content)

        # 2. Import CSV hợp lệ
        csv_valid = (
            "code,name,parent_code,category,allow_voucher_selection,applicable_scope,start_date,end_date,status,description\n"
            "CD-IMP-01,Chiến dịch hè,,CAMPAIGN,TRUE,PAYMENT,2026-01-01,2026-12-31,ACTIVE,Mùa hè sôi động\n"
            "CD-IMP-02,Chiến dịch thu,,CAMPAIGN,TRUE,PAYMENT,,2026-12-31,ACTIVE,Mùa thu vàng\n"
        )
        file_valid = SimpleUploadedFile("statistical_codes.csv", csv_valid.encode("utf-8"), content_type="text/csv")
        res_import = self.client.post(
            f"/api/v1/master-data/statistical-codes/import-csv/?company_id={self.company.pk}",
            {"company": str(self.company.pk), "file": file_valid},
            format="multipart",
        )
        self.assertEqual(res_import.status_code, 200)
        self.assertEqual(res_import.data["imported_count"], 2)
        self.assertEqual(res_import.data["failed_count"], 0)
        self.assertTrue(StatisticalCode.objects.filter(company=self.company, code="CD-IMP-01").exists())

        # 3. Import CSV có dòng lỗi (trùng mã và sai mã cha) (EF-13)
        csv_with_errors = (
            "code,name,parent_code,category,allow_voucher_selection,applicable_scope,start_date,end_date,status,description\n"
            "CD-IMP-01,Trùng mã đã có,,CAMPAIGN,TRUE,,,,ACTIVE,\n"
            "CD-ERR-02,Mã cha không tồn tại,CHA-AO,CAMPAIGN,TRUE,,,,ACTIVE,\n"
        )
        file_errors = SimpleUploadedFile("error_items.csv", csv_with_errors.encode("utf-8"), content_type="text/csv")
        res_import_err = self.client.post(
            f"/api/v1/master-data/statistical-codes/import-csv/?company_id={self.company.pk}",
            {"company": str(self.company.pk), "file": file_errors},
            format="multipart",
        )
        self.assertEqual(res_import_err.status_code, 200)
        self.assertEqual(res_import.data["imported_count"], 2)  # previous
        self.assertEqual(res_import_err.data["imported_count"], 0)
        self.assertEqual(res_import_err.data["failed_count"], 2)
        self.assertEqual(len(res_import_err.data["errors"]), 2)

    def test_13_audit_logging(self):
        """Kiểm tra ghi Audit Log cho tất cả các thao tác (BR-MD-STAT-26)."""
        self.grant("VIEW", "CREATE", "EDIT", "DEACTIVATE", "DELETE")

        # 1. Create -> audit
        res = self.client.post(self.url, self.payload(code="STAT-AUDIT", name="Mã kiểm toán"), format="json")
        item_id = res.data["id"]
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="STATISTICAL_CODE_CREATE", entity_id=item_id).exists())

        # 2. Update -> audit
        self.client.patch(f"/api/v1/master-data/statistical-codes/{item_id}/?company_id={self.company.pk}", {"name": "Tên audit mới", "version": 1}, format="json")
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="STATISTICAL_CODE_UPDATE", entity_id=item_id).exists())

        # 3. Status change -> audit
        self.client.post(f"/api/v1/master-data/statistical-codes/{item_id}/change-status/?company_id={self.company.pk}", {"status": "INACTIVE", "version": 2}, format="json")
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="STATISTICAL_CODE_DEACTIVATE", entity_id=item_id).exists())

        # 4. View history endpoint
        res = self.client.get(f"/api/v1/master-data/statistical-codes/{item_id}/history/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data), 3)

    def test_14_tree_endpoint(self):
        """Kiểm tra cấu trúc cây phân cấp mã thống kê (BR-MD-STAT-04, 30)."""
        self.grant("VIEW")
        root = StatisticalCode.objects.create(
            company=self.company, code="KM-ROOT", name="Tổng hợp khuyến mại", allow_voucher_selection=False, status=CatalogStatus.ACTIVE
        )
        child1 = StatisticalCode.objects.create(
            company=self.company, code="KM-ONLINE", name="Khuyến mại online", parent=root, status=CatalogStatus.ACTIVE
        )
        child2 = StatisticalCode.objects.create(
            company=self.company, code="KM-OFFLINE", name="Khuyến mại cửa hàng", parent=root, status=CatalogStatus.ACTIVE
        )
        grandchild = StatisticalCode.objects.create(
            company=self.company, code="KM-ON-TIKTOK", name="Khuyến mại TikTok Shop", parent=child1, status=CatalogStatus.ACTIVE
        )

        res = self.client.get(f"/api/v1/master-data/statistical-codes/tree/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 200)
        root_data = next((node for node in res.data if node["code"] == "KM-ROOT"), None)
        self.assertIsNotNone(root_data)
        self.assertTrue(root_data["has_children"])
        self.assertEqual(len(root_data["children"]), 2)

        online_data = next((c for c in root_data["children"] if c["code"] == "KM-ONLINE"), None)
        self.assertIsNotNone(online_data)
        self.assertEqual(len(online_data["children"]), 1)
        self.assertEqual(online_data["children"][0]["code"], "KM-ON-TIKTOK")

    def test_15_statistical_code_selection_validation(self):
        """Kiểm tra quy tắc nghiệp vụ khi chọn mã thống kê trên chứng từ (BR-MD-STAT-03, 07, 10, EF-10)."""
        from master_data.statistical_code_services import validate_statistical_code_selection

        # 1. Mã hợp lệ
        valid_item = StatisticalCode.objects.create(
            company=self.company,
            code="CX-VALID",
            name="Chuyến xe hợp lệ",
            status=CatalogStatus.ACTIVE,
            allow_voucher_selection=True,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            applicable_scope="PAYMENT,PURCHASE",
        )
        checked = validate_statistical_code_selection(
            company=self.company,
            code_or_id="CX-VALID",
            voucher_type="PAYMENT",
            transaction_date=date(2026, 5, 1),
        )
        self.assertEqual(checked.id, valid_item.id)

        # 2. Mã đã ngừng sử dụng -> lỗi (BR-MD-STAT-10, EF-10)
        inactive_item = StatisticalCode.objects.create(
            company=self.company, code="CX-INACT", name="Chuyến xe đã ngưng", status=CatalogStatus.INACTIVE
        )
        with self.assertRaises(ValidationError) as ctx:
            validate_statistical_code_selection(self.company, "CX-INACT")
        self.assertIn("ngừng sử dụng", str(ctx.exception))

        # 3. Mã chỉ dùng để tổng hợp -> lỗi (BR-MD-STAT-07, EF-10)
        summary_only = StatisticalCode.objects.create(
            company=self.company, code="CX-SUMM", name="Tổng hợp xe", allow_voucher_selection=False, status=CatalogStatus.ACTIVE
        )
        with self.assertRaises(ValidationError) as ctx:
            validate_statistical_code_selection(self.company, "CX-SUMM")
        self.assertIn("chỉ dùng để tổng hợp", str(ctx.exception))

        # 4. Ngày ngoài hiệu lực -> lỗi (BR-MD-STAT-10, EF-10)
        with self.assertRaises(ValidationError) as ctx:
            validate_statistical_code_selection(self.company, "CX-VALID", transaction_date=date(2027, 1, 1))
        self.assertIn("hết hiệu lực", str(ctx.exception))

        with self.assertRaises(ValidationError) as ctx:
            validate_statistical_code_selection(self.company, "CX-VALID", transaction_date=date(2025, 12, 31))
        self.assertIn("chưa có hiệu lực", str(ctx.exception))

        # 5. Ngoài phạm vi nghiệp vụ (applicable_scope) -> lỗi (EF-10)
        with self.assertRaises(ValidationError) as ctx:
            validate_statistical_code_selection(self.company, "CX-VALID", voucher_type="SALES")
        self.assertIn("không thuộc phạm vi nghiệp vụ", str(ctx.exception))

        # 6. Mã thuộc công ty khác -> lỗi (BR-MD-STAT-03)
        other_item = StatisticalCode.objects.create(
            company=self.other_company, code="CX-OTHER-CORP", name="Xe bên khác", status=CatalogStatus.ACTIVE
        )
        with self.assertRaises(ValidationError) as ctx:
            validate_statistical_code_selection(self.company, "CX-OTHER-CORP")
        self.assertIn("không tồn tại trong doanh nghiệp", str(ctx.exception))

    def test_16_journal_entry_posting_statistical_code_dimension(self):
        """Kiểm tra tài khoản bắt buộc mã thống kê và ghi sổ GL (BR-MD-STAT-19, EF-10, EF-11)."""
        from general_ledger.services import _validate_entry

        # Tài khoản bắt buộc mã thống kê
        chart = ChartOfAccounts.objects.filter(company=self.company, is_default=True).first()
        cl = AccountClass.objects.filter(company=self.company, code="EXPENSE").first()
        acc_req_stat = Account.objects.create(
            company=self.company,
            chart_of_accounts=chart,
            account_class=cl,
            code="6428_STAT",
            name="Chi phí khác cần mã thống kê",
            account_type="EXPENSE",
            normal_balance="DEBIT",
            is_postable=True,
            dimension_requirements={"STATISTICAL_CODE": "REQUIRED"},
            status="ACTIVE",
        )
        acc_cash = Account.objects.create(
            company=self.company,
            chart_of_accounts=chart,
            account_class=cl,
            code="1111_STAT",
            name="Tiền mặt",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
            status="ACTIVE",
        )

        period = AccountingPeriod.objects.create(
            company=self.company, code="P-2026-03", fiscal_year=2026, period_number=3,
            start_date=date(2026, 3, 1), end_date=date(2026, 3, 31), status="OPEN",
        )

        stat_valid = StatisticalCode.objects.create(
            company=self.company, code="MKT-MARCH", name="Marketing T3", allow_voucher_selection=True, status=CatalogStatus.ACTIVE
        )
        stat_inactive = StatisticalCode.objects.create(
            company=self.company, code="MKT-OLD", name="Marketing Cũ", allow_voucher_selection=True, status=CatalogStatus.INACTIVE
        )

        # 1. Bút toán thiếu mã thống kê khi tài khoản bắt buộc -> ValidationError (BR-MD-STAT-19, EF-11)
        entry_missing = JournalEntry.objects.create(
            company=self.company, period=period, number="PKT-STAT-ERR1", posting_date=date(2026, 3, 15),
            total_debit=1000000, total_credit=1000000, status=JournalStatus.DRAFT, created_by=self.account,
        )
        JournalLine.objects.create(entry=entry_missing, line_no=1, account=acc_req_stat, debit=1000000, credit=0, currency=self.currency)
        JournalLine.objects.create(entry=entry_missing, line_no=2, account=acc_cash, debit=0, credit=1000000, currency=self.currency)

        with self.assertRaises((ValidationError, DRFValidationError)) as ctx:
            _validate_entry(entry_missing)
        self.assertIn("bắt buộc nhập mã thống kê", str(ctx.exception))

        # 2. Bút toán có mã nhưng mã đã ngừng sử dụng -> ValidationError (BR-MD-STAT-10, EF-10)
        entry_inactive = JournalEntry.objects.create(
            company=self.company, period=period, number="PKT-STAT-ERR2", posting_date=date(2026, 3, 15),
            total_debit=1000000, total_credit=1000000, status=JournalStatus.DRAFT, created_by=self.account,
        )
        JournalLine.objects.create(
            entry=entry_inactive, line_no=1, account=acc_req_stat, debit=1000000, credit=0,
            currency=self.currency, dimensions={"statistical_code": "MKT-OLD"},
        )
        JournalLine.objects.create(entry=entry_inactive, line_no=2, account=acc_cash, debit=0, credit=1000000, currency=self.currency)

        with self.assertRaises((ValidationError, DRFValidationError)) as ctx:
            _validate_entry(entry_inactive)
        self.assertIn("đã ngừng sử dụng", str(ctx.exception))

        # 3. Bút toán gắn mã hợp lệ -> validate thành công
        entry_ok = JournalEntry.objects.create(
            company=self.company, period=period, number="PKT-STAT-OK", posting_date=date(2026, 3, 15),
            total_debit=1000000, total_credit=1000000, status=JournalStatus.DRAFT, created_by=self.account,
        )
        JournalLine.objects.create(
            entry=entry_ok, line_no=1, account=acc_req_stat, debit=1000000, credit=0,
            currency=self.currency, dimensions={"statistical_code": "MKT-MARCH"},
        )
        JournalLine.objects.create(entry=entry_ok, line_no=2, account=acc_cash, debit=0, credit=1000000, currency=self.currency)

        _validate_entry(entry_ok)

    def test_17_financial_summary_and_tree_rollup(self):
        """Kiểm tra tổng hợp phát sinh tài chính theo mã và cộng dồn cây mã không trùng lặp (BR-MD-STAT-20, 21)."""
        self.grant("VIEW")
        chart = ChartOfAccounts.objects.filter(company=self.company, is_default=True).first()
        cl = AccountClass.objects.filter(company=self.company, code="EXPENSE").first()
        acc_exp = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=cl,
            code="641_TEST", name="Chi phí bán hàng", account_type="EXPENSE", normal_balance="DEBIT",
            is_postable=True, status="ACTIVE",
        )
        acc_cash = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=cl,
            code="1112_TEST", name="Tiền gửi", account_type="ASSET", normal_balance="DEBIT",
            is_postable=True, status="ACTIVE",
        )

        period = AccountingPeriod.objects.create(
            company=self.company, code="P-2026-04", fiscal_year=2026, period_number=4,
            start_date=date(2026, 4, 1), end_date=date(2026, 4, 30), status="OPEN",
        )

        # Cấu trúc: Parent (CAMP-SUM) -> Child1 (CAMP-ONLINE), Child2 (CAMP-STORE)
        parent_code = StatisticalCode.objects.create(
            company=self.company, code="CAMP-SUM", name="Tổng hợp chiến dịch", allow_voucher_selection=False, status=CatalogStatus.ACTIVE
        )
        child1 = StatisticalCode.objects.create(
            company=self.company, code="CAMP-ONLINE", name="Chiến dịch Online", parent=parent_code, allow_voucher_selection=True, status=CatalogStatus.ACTIVE
        )
        child2 = StatisticalCode.objects.create(
            company=self.company, code="CAMP-STORE", name="Chiến dịch Cửa hàng", parent=parent_code, allow_voucher_selection=True, status=CatalogStatus.ACTIVE
        )

        # Bút toán 1: 500,000 gắn mã child1
        e1 = JournalEntry.objects.create(
            company=self.company, period=period, number="PKT-STAT-SUM1", posting_date=date(2026, 4, 10),
            total_debit=500000, total_credit=500000, status=JournalStatus.POSTED, created_by=self.account,
        )
        JournalLine.objects.create(
            entry=e1, line_no=1, account=acc_exp, debit=500000, credit=0, currency=self.currency,
            dimensions={"statistical_code": "CAMP-ONLINE"},
        )
        JournalLine.objects.create(entry=e1, line_no=2, account=acc_cash, debit=0, credit=500000, currency=self.currency)

        # Bút toán 2: 300,000 gắn mã child2
        e2 = JournalEntry.objects.create(
            company=self.company, period=period, number="PKT-STAT-SUM2", posting_date=date(2026, 4, 15),
            total_debit=300000, total_credit=300000, status=JournalStatus.POSTED, created_by=self.account,
        )
        JournalLine.objects.create(
            entry=e2, line_no=1, account=acc_exp, debit=300000, credit=0, currency=self.currency,
            dimensions={"statistical_code": "CAMP-STORE"},
        )
        JournalLine.objects.create(entry=e2, line_no=2, account=acc_cash, debit=0, credit=300000, currency=self.currency)

        # Gọi endpoint summary
        res = self.client.get(f"/api/v1/master-data/statistical-codes/summary/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 200)

        data_parent = next(item for item in res.data if item["code"] == "CAMP-SUM")
        data_c1 = next(item for item in res.data if item["code"] == "CAMP-ONLINE")
        data_c2 = next(item for item in res.data if item["code"] == "CAMP-STORE")

        # Child 1: direct debit = 500,000; total debit = 500,000
        self.assertEqual(Decimal(data_c1["direct"]["debit"]), Decimal("500000"))
        self.assertEqual(Decimal(data_c1["total"]["debit"]), Decimal("500000"))

        # Child 2: direct debit = 300,000; total debit = 300,000
        self.assertEqual(Decimal(data_c2["direct"]["debit"]), Decimal("300000"))
        self.assertEqual(Decimal(data_c2["total"]["debit"]), Decimal("300000"))

        # Parent: direct debit = 0; total debit = 800,000 (cộng dồn không trùng lặp) (BR-MD-STAT-21)
        self.assertEqual(Decimal(data_parent["direct"]["debit"]), Decimal("0"))
        self.assertEqual(Decimal(data_parent["total"]["debit"]), Decimal("800000"))
        self.assertEqual(Decimal(data_parent["total"]["expense"]), Decimal("800000"))

