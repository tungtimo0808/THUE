import csv
import io

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
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

from .models import CatalogStatus, Currency, ExpenseItem, ExpenseItemType


class ExpenseItemManagementTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam", "is_active": True})
        self.company = Company.objects.create(
            code="CORP_TEST",
            name="Công ty TNHH Thử Nghiệm",
            legal_name="Công ty TNHH Thử Nghiệm",
            tax_code="0109999999",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.other_company = Company.objects.create(
            code="CORP_OTHER",
            name="Công ty Khác",
            legal_name="Công ty Cổ Phần Khác",
            tax_code="0109999998",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )

        # GL accounts
        cl = AccountClass.objects.create(company=self.company, code="EXPENSE", name="Chi phí", normal_balance="DEBIT")
        chart = ChartOfAccounts.objects.create(company=self.company, code="TT200", name="Hệ thống TT200", effective_from=self.today, is_default=True)
        self.gl_642 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=cl,
            code="642", name="Chi phí QLDN", account_type="EXPENSE", normal_balance="DEBIT",
            is_postable=False, status="ACTIVE",
        )
        self.gl_6421 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=cl, parent=self.gl_642,
            code="6421", name="Chi phí nhân viên quản lý", account_type="EXPENSE", normal_balance="DEBIT",
            is_postable=True, status="ACTIVE",
        )
        self.gl_6428 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=cl, parent=self.gl_642,
            code="6428", name="Chi phí bằng tiền khác", account_type="EXPENSE", normal_balance="DEBIT",
            is_postable=True, status="ACTIVE",
        )
        self.gl_inactive = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=cl, parent=self.gl_642,
            code="6429", name="Chi phí cũ", account_type="EXPENSE", normal_balance="DEBIT",
            is_postable=True, status="INACTIVE",
        )

        # GL accounts for other company
        cl_other = AccountClass.objects.create(company=self.other_company, code="EXPENSE", name="Chi phí", normal_balance="DEBIT")
        chart_other = ChartOfAccounts.objects.create(company=self.other_company, code="TT200", name="Hệ thống TT200", effective_from=self.today, is_default=True)
        self.gl_other = Account.objects.create(
            company=self.other_company, chart_of_accounts=chart_other, account_class=cl_other,
            code="6421", name="Chi phí NV khác", account_type="EXPENSE", normal_balance="DEBIT",
            is_postable=True, status="ACTIVE",
        )

        # IAM user & client
        auth_user = get_user_model().objects.create_user(username="cost-accountant", password="password")
        self.account = auth_user.iam_account
        self.membership = CompanyMembership.objects.create(company=self.company, user=self.account, created_by=self.account)
        self.role = Role.objects.create(company=self.company, code="COST_ACCOUNTANT", name="Kế toán chi phí")
        self.assignment = UserRoleAssignment.objects.create(company_membership=self.membership, role=self.role, assigned_by=self.account)

        self.client = APIClient()
        self.client.force_authenticate(auth_user)
        self.url = f"/api/v1/master-data/expense-items/?company_id={self.company.pk}"

    def grant(self, *actions):
        for action in actions:
            perm = Permission.objects.get(code=f"MD.EXPENSE_ITEM.{action}")
            RolePermission.objects.get_or_create(role=self.role, permission=perm, defaults={"effect": "ALLOW"})

    def payload(self, **overrides):
        data = {
            "company": str(self.company.pk),
            "code": "CP-VPP",
            "name": "Chi phí văn phòng phẩm",
            "expense_type": ExpenseItemType.ADMIN,
            "default_account": str(self.gl_6428.pk),
            "applicable_scope": "PAYMENT,PURCHASE",
            "description": "Khoản mục văn phòng phẩm",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
        }
        data.update(overrides)
        return data

    def test_01_rbac_permissions(self):
        """Kiểm tra phân quyền RBAC cho từng thao tác (BR-MD-EXP-20)."""
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
        res = self.client.patch(f"/api/v1/master-data/expense-items/{item_id}/?company_id={self.company.pk}", {"name": "Tên mới"}, format="json")
        self.assertEqual(res.status_code, 403)

        self.grant("EDIT")
        res = self.client.patch(f"/api/v1/master-data/expense-items/{item_id}/?company_id={self.company.pk}", {"name": "Tên mới", "version": 1}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["name"], "Tên mới")

        # 5. Chưa có quyền DEACTIVATE -> change-status bị 403
        res = self.client.post(f"/api/v1/master-data/expense-items/{item_id}/change-status/?company_id={self.company.pk}", {"status": "INACTIVE"}, format="json")
        self.assertEqual(res.status_code, 403)

        self.grant("DEACTIVATE")
        res = self.client.post(f"/api/v1/master-data/expense-items/{item_id}/change-status/?company_id={self.company.pk}", {"status": "INACTIVE"}, format="json")
        self.assertEqual(res.status_code, 200)

        # 6. Chưa có quyền DELETE -> DELETE bị 403
        res = self.client.delete(f"/api/v1/master-data/expense-items/{item_id}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 403)

        self.grant("DELETE")
        res = self.client.delete(f"/api/v1/master-data/expense-items/{item_id}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 204)

    def test_02_mandatory_fields_and_case_insensitive_unique_code(self):
        """Kiểm tra trường bắt buộc và mã duy nhất không phân biệt hoa thường (BR-MD-EXP-01, 02, EF-02, 03)."""
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

        # Tạo mã CP-VP
        res = self.client.post(self.url, self.payload(code="  cp-vp  ", name="Chi phí văn phòng"), format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["code"], "CP-VP")

        # Tạo mã trùng chữ hoa/thường: 'CP-VP' hoặc 'Cp-Vp' trong cùng doanh nghiệp -> 400
        res = self.client.post(self.url, self.payload(code="CP-VP", name="Chi phí khác"), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("đã tồn tại", str(res.data))

        res = self.client.post(self.url, self.payload(code="cp-vp", name="Chi phí khác nữa"), format="json")
        self.assertEqual(res.status_code, 400)

        # Doanh nghiệp khác tạo cùng mã CP-VP -> thành công (BR-MD-EXP-03)
        item_other = ExpenseItem.objects.create(
            company=self.other_company,
            code="CP-VP",
            name="Chi phí bên khác",
            status="ACTIVE",
        )
        self.assertEqual(item_other.code, "CP-VP")

    def test_03_hierarchy_and_cycle_and_inactive_parent(self):
        """Kiểm tra quan hệ phân cấp cha-con, chu trình vòng lặp và cha ngừng sử dụng (BR-MD-EXP-04..06, 16, EF-04..05)."""
        self.grant("VIEW", "CREATE", "EDIT")

        # 1. Tạo khoản mục cha
        res_parent = self.client.post(self.url, self.payload(code="CP-SX", name="Chi phí sản xuất"), format="json")
        self.assertEqual(res_parent.status_code, 201)
        parent_id = res_parent.data["id"]

        # 2. Tạo khoản mục con thuộc cha
        res_child = self.client.post(self.url, self.payload(code="CP-NC", name="Chi phí nhân công trực tiếp", parent=parent_id), format="json")
        self.assertEqual(res_child.status_code, 201)
        child_id = res_child.data["id"]
        self.assertEqual(res_child.data["parent_code"], "CP-SX")

        # 3. Khoản mục cha là chính nó -> 400 (BR-MD-EXP-05)
        res = self.client.patch(f"/api/v1/master-data/expense-items/{parent_id}/?company_id={self.company.pk}", {"parent": parent_id}, format="json")
        self.assertEqual(res.status_code, 400)

        # 4. Tạo quan hệ vòng lặp: cha đặt con làm cha -> 400 (EF-05)
        res = self.client.patch(f"/api/v1/master-data/expense-items/{parent_id}/?company_id={self.company.pk}", {"parent": child_id}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("chu trình", str(res.data).lower())

        # 5. Khoản mục cha đang ngừng sử dụng -> không cho tạo con (BR-MD-EXP-16, EF-04)
        inactive_parent = ExpenseItem.objects.create(
            company=self.company,
            code="CP-CU",
            name="Chi phí cũ đã ngưng",
            status=CatalogStatus.INACTIVE,
        )
        res = self.client.post(self.url, self.payload(code="CP-CON", name="Con của cũ", parent=str(inactive_parent.id)), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("ngừng sử dụng", str(res.data))

        # 6. Khoản mục cha thuộc công ty khác -> 400
        other_parent = ExpenseItem.objects.create(
            company=self.other_company,
            code="CP-OTHER",
            name="Khoản mục công ty khác",
            status=CatalogStatus.ACTIVE,
        )
        res = self.client.post(self.url, self.payload(code="CP-CON2", name="Con ngoại lai", parent=str(other_parent.id)), format="json")
        self.assertEqual(res.status_code, 400)

    def test_04_default_account_validation(self):
        """Kiểm tra tài khoản kế toán mặc định phải active, postable và cùng công ty (BR-MD-EXP-08, 09, EF-06)."""
        self.grant("VIEW", "CREATE")

        # 1. Tài khoản cha / không postable -> 400 (EF-06)
        res = self.client.post(self.url, self.payload(default_account=str(self.gl_642.pk)), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("hạch toán trực tiếp", str(res.data))

        # 2. Tài khoản đã ngừng sử dụng -> 400 (EF-06)
        res = self.client.post(self.url, self.payload(default_account=str(self.gl_inactive.pk)), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("ngừng sử dụng", str(res.data))

        # 3. Tài khoản thuộc công ty khác -> 400
        res = self.client.post(self.url, self.payload(default_account=str(self.gl_other.pk)), format="json")
        self.assertEqual(res.status_code, 400)

        # 4. Tài khoản hợp lệ -> 201
        res = self.client.post(self.url, self.payload(default_account=str(self.gl_6421.pk)), format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["default_account_code"], "6421")

    def test_05_validity_dates_validation(self):
        """Kiểm tra ngày kết thúc >= ngày bắt đầu (EF-07)."""
        self.grant("VIEW", "CREATE")

        # Ngày kết thúc nhỏ hơn ngày bắt đầu -> 400 (EF-07)
        res = self.client.post(self.url, self.payload(start_date="2026-06-01", end_date="2026-01-01"), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("ngày bắt đầu", str(res.data).lower())

        # Ngày hợp lệ -> 201
        res = self.client.post(self.url, self.payload(start_date="2026-01-01", end_date="2026-12-31"), format="json")
        self.assertEqual(res.status_code, 201)

    def test_06_optimistic_locking_conflict(self):
        """Kiểm tra khóa lạc quan với trường version (EF-13)."""
        self.grant("VIEW", "CREATE", "EDIT")
        res = self.client.post(self.url, self.payload(code="CP-OPT", name="Chi phí kiểm tra lock"), format="json")
        item_id = res.data["id"]
        self.assertEqual(res.data["version"], 1)

        # Gửi version sai (ví dụ version=999) -> 409 Conflict
        res = self.client.patch(
            f"/api/v1/master-data/expense-items/{item_id}/?company_id={self.company.pk}",
            {"name": "Tên cập nhật sai", "version": 999},
            format="json",
        )
        self.assertEqual(res.status_code, 409)

        # Gửi đúng version 1 -> thành công, version tăng lên 2
        res = self.client.patch(
            f"/api/v1/master-data/expense-items/{item_id}/?company_id={self.company.pk}",
            {"name": "Tên cập nhật đúng", "version": 1},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["version"], 2)
        self.assertEqual(res.data["name"], "Tên cập nhật đúng")

    def test_07_core_field_locked_when_transactions_exist(self):
        """Khoản mục đã phát sinh dữ liệu chứng từ không được sửa mã (BR-MD-EXP-14, 15, EF-08)."""
        self.grant("VIEW", "CREATE", "EDIT")
        res = self.client.post(self.url, self.payload(code="CP-TRX", name="Khoản mục có chứng từ"), format="json")
        item = ExpenseItem.objects.get(pk=res.data["id"])

        # Tạo chứng từ và dòng sổ cái liên kết tới khoản mục này
        period = AccountingPeriod.objects.create(
            company=self.company, code="P-2026-01", fiscal_year=2026, period_number=1,
            start_date=self.today, end_date=self.today, status="OPEN",
        )
        entry = JournalEntry.objects.create(
            company=self.company, period=period, number="PKT-001", posting_date=self.today,
            description="Bút toán chi phí", status=JournalStatus.POSTED, created_by=self.account,
        )
        currency_vnd = self.company.accounting_currency
        JournalLine.objects.create(
            entry=entry, line_no=1, account=self.gl_6421, debit=500000, credit=0,
            currency=currency_vnd, dimensions={"expense_item_id": str(item.id)},
        )

        # Đổi mã -> 400 bị chặn (BR-MD-EXP-14, EF-08)
        res = self.client.patch(
            f"/api/v1/master-data/expense-items/{item.id}/?company_id={self.company.pk}",
            {"code": "CP-TRX-NEW", "version": 1},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("không được thay đổi", str(res.data))

        # Đổi tên hoặc mô tả -> được phép (BR-MD-EXP-15)
        res = self.client.patch(
            f"/api/v1/master-data/expense-items/{item.id}/?company_id={self.company.pk}",
            {"name": "Tên chi phí mới được cập nhật", "version": 1},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["name"], "Tên chi phí mới được cập nhật")

    def test_08_deletion_restrictions(self):
        """Không cho xóa khoản mục có con hoặc đã có chứng từ (BR-MD-EXP-12, 13, EF-09)."""
        self.grant("VIEW", "CREATE", "DELETE")

        # 1. Có khoản mục con -> không cho xóa
        parent = ExpenseItem.objects.create(company=self.company, code="CP-P", name="Cha", status="ACTIVE")
        child = ExpenseItem.objects.create(company=self.company, code="CP-C", name="Con", parent=parent, status="ACTIVE")

        res = self.client.delete(f"/api/v1/master-data/expense-items/{parent.id}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 400)
        self.assertIn("khoản mục con", str(res.data))

        # 2. Xóa con chưa phát sinh giao dịch -> 204 thành công (BR-MD-EXP-13)
        res = self.client.delete(f"/api/v1/master-data/expense-items/{child.id}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 204)

        # 3. Tạo giao dịch cho parent -> không cho xóa parent
        period = AccountingPeriod.objects.create(
            company=self.company, code="P-2026-02", fiscal_year=2026, period_number=2,
            start_date=self.today, end_date=self.today, status="OPEN",
        )
        entry = JournalEntry.objects.create(
            company=self.company, period=period, number="PKT-002", posting_date=self.today,
            description="Bút toán", status=JournalStatus.POSTED, created_by=self.account,
        )
        currency_vnd = self.company.accounting_currency
        JournalLine.objects.create(
            entry=entry, line_no=1, account=self.gl_6421, debit=200000, credit=0,
            currency=currency_vnd, dimensions={"expense_item_id": str(parent.id)},
        )

        res = self.client.delete(f"/api/v1/master-data/expense-items/{parent.id}/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 400)
        self.assertIn("dữ liệu giao dịch", str(res.data))

    def test_09_deactivation_rules_and_cascade_children(self):
        """Kiểm tra ngừng sử dụng cha có con và kích hoạt lại (BR-MD-EXP-16, 17, AF-10..12, EF-10)."""
        self.grant("VIEW", "CREATE", "DEACTIVATE")
        parent = ExpenseItem.objects.create(company=self.company, code="CP-P2", name="Cha 2", status="ACTIVE")
        child = ExpenseItem.objects.create(company=self.company, code="CP-C2", name="Con 2", parent=parent, status="ACTIVE")

        # 1. Ngừng cha khi con đang ACTIVE mà không confirm cascade -> 400 cảnh báo (BR-MD-EXP-17, EF-10)
        res = self.client.post(
            f"/api/v1/master-data/expense-items/{parent.id}/change-status/?company_id={self.company.pk}",
            {"status": "INACTIVE", "version": 1},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("khoản mục con", str(res.data))

        # 2. Ngừng cha kèm deactivate_children=True -> thành công cả cha và con (AF-12)
        res = self.client.post(
            f"/api/v1/master-data/expense-items/{parent.id}/change-status/?company_id={self.company.pk}",
            {"status": "INACTIVE", "version": 1, "deactivate_children": True, "reason": "Ngừng toàn bộ nhóm"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        parent.refresh_from_db()
        child.refresh_from_db()
        self.assertEqual(parent.status, CatalogStatus.INACTIVE)
        self.assertEqual(child.status, CatalogStatus.INACTIVE)

        # 3. Kích hoạt lại con khi cha đang INACTIVE -> 400 bị chặn (BR-MD-EXP-16)
        res = self.client.post(
            f"/api/v1/master-data/expense-items/{child.id}/change-status/?company_id={self.company.pk}",
            {"status": "ACTIVE", "version": child.version},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("cha đang ngừng", str(res.data))

        # 4. Kích hoạt lại cha trước -> sau đó kích hoạt con -> thành công (AF-11)
        res = self.client.post(
            f"/api/v1/master-data/expense-items/{parent.id}/change-status/?company_id={self.company.pk}",
            {"status": "ACTIVE", "version": parent.version},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

        res = self.client.post(
            f"/api/v1/master-data/expense-items/{child.id}/change-status/?company_id={self.company.pk}",
            {"status": "ACTIVE", "version": child.version},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        child.refresh_from_db()
        self.assertEqual(child.status, CatalogStatus.ACTIVE)

    def test_10_ai_suggestion(self):
        """Kiểm tra AI Assistant gợi ý phân loại và tài khoản kế toán (BR-MD-EXP-24..26, AF-04)."""
        self.grant("VIEW")
        ai_url = f"/api/v1/master-data/expense-items/ai-suggest/?company_id={self.company.pk}"

        # Gợi ý cho lương nhân viên
        res = self.client.post(
            ai_url,
            {"company": str(self.company.pk), "name": "Tiền lương và phụ cấp nhân viên quản lý"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["suggested_expense_type"], ExpenseItemType.LABOR)
        self.assertEqual(res.data["suggested_account_code"], "6421")
        self.assertGreater(res.data["confidence"], 0.5)
        self.assertTrue(len(res.data["reasoning"]) > 0)

        # Gợi ý cho quảng cáo bán hàng
        res = self.client.post(
            ai_url,
            {"company": str(self.company.pk), "name": "Chi phí quảng cáo truyền thông trên mạng xã hội"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["suggested_expense_type"], ExpenseItemType.SELLING)

        # Thiếu name -> 400
        res = self.client.post(ai_url, {"company": str(self.company.pk), "name": ""}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_11_csv_export_and_import(self):
        """Kiểm tra xuất và nhập danh sách khoản mục từ file CSV (BR-MD-EXP-21, 22, AF-08, AF-09, EF-11, EF-12)."""
        self.grant("VIEW", "CREATE", "EXPORT", "IMPORT")

        # 1. Tạo 1 khoản mục và export CSV
        ExpenseItem.objects.create(
            company=self.company,
            code="CP-VPP-01",
            name="Giấy in A4",
            expense_type=ExpenseItemType.ADMIN,
            default_account=self.gl_6428,
            status=CatalogStatus.ACTIVE,
        )
        res_export = self.client.get(f"/api/v1/master-data/expense-items/export-csv/?company_id={self.company.pk}")
        self.assertEqual(res_export.status_code, 200)
        self.assertIn("text/csv", res_export["Content-Type"])
        content = res_export.content.decode("utf-8-sig")
        self.assertIn("CP-VPP-01", content)
        self.assertIn("Giấy in A4", content)

        # 2. Import CSV hợp lệ
        csv_valid = (
            "code,name,parent_code,expense_type,default_account_code,applicable_scope,start_date,end_date,status,description\n"
            "CP-IMP-01,Chi phí tiếp khách,,ADMIN,6428,PAYMENT,2026-01-01,2026-12-31,ACTIVE,Chi phí hội nghị khách hàng\n"
            "CP-IMP-02,Chi phí bưu chính,,ADMIN,6428,PAYMENT,,2026-12-31,ACTIVE,Gửi thư chuyển phát\n"
        )
        file_valid = SimpleUploadedFile("expense_items.csv", csv_valid.encode("utf-8"), content_type="text/csv")
        res_import = self.client.post(
            f"/api/v1/master-data/expense-items/import-csv/?company_id={self.company.pk}",
            {"company": str(self.company.pk), "file": file_valid},
            format="multipart",
        )
        self.assertEqual(res_import.status_code, 200)
        self.assertEqual(res_import.data["imported_count"], 2)
        self.assertEqual(res_import.data["failed_count"], 0)
        self.assertTrue(ExpenseItem.objects.filter(company=self.company, code="CP-IMP-01").exists())

        # 3. Import CSV có dòng lỗi (trùng mã và sai tài khoản) (EF-12)
        csv_with_errors = (
            "code,name,parent_code,expense_type,default_account_code,applicable_scope,start_date,end_date,status,description\n"
            "CP-IMP-01,Trùng mã đã có,,ADMIN,6428,,,,ACTIVE,\n"
            "CP-ERR-02,Tài khoản không tồn tại,,ADMIN,9999,,,,ACTIVE,\n"
        )
        file_errors = SimpleUploadedFile("error_items.csv", csv_with_errors.encode("utf-8"), content_type="text/csv")
        res_import_err = self.client.post(
            f"/api/v1/master-data/expense-items/import-csv/?company_id={self.company.pk}",
            {"company": str(self.company.pk), "file": file_errors},
            format="multipart",
        )
        self.assertEqual(res_import_err.status_code, 200)
        self.assertEqual(res_import_err.data["imported_count"], 0)
        self.assertEqual(res_import_err.data["failed_count"], 2)
        self.assertEqual(len(res_import_err.data["errors"]), 2)

    def test_12_audit_logging(self):
        """Kiểm tra ghi Audit Log cho tất cả các thao tác (BR-MD-EXP-23)."""
        self.grant("VIEW", "CREATE", "EDIT", "DEACTIVATE", "DELETE")

        # 1. Create -> audit
        res = self.client.post(self.url, self.payload(code="CP-AUDIT", name="Khoản mục kiểm toán"), format="json")
        item_id = res.data["id"]
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="EXPENSE_ITEM_CREATE", entity_id=item_id).exists())

        # 2. Update -> audit
        self.client.patch(f"/api/v1/master-data/expense-items/{item_id}/?company_id={self.company.pk}", {"name": "Tên audit mới", "version": 1}, format="json")
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="EXPENSE_ITEM_UPDATE", entity_id=item_id).exists())

        # 3. Status change -> audit
        self.client.post(f"/api/v1/master-data/expense-items/{item_id}/change-status/?company_id={self.company.pk}", {"status": "INACTIVE", "version": 2}, format="json")
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="EXPENSE_ITEM_DEACTIVATE", entity_id=item_id).exists())

        # 4. View history endpoint
        res = self.client.get(f"/api/v1/master-data/expense-items/{item_id}/history/?company_id={self.company.pk}")
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data), 3)
