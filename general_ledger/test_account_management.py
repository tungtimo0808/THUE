import csv
import io
import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from general_ledger.models import (
    Account,
    AccountBalance,
    AccountClass,
    AccountingDimension,
    AccountingPeriod,
    AccountNature,
    AccountStatus,
    ChartOfAccounts,
    DimensionRequirementLevel,
    JournalEntry,
    JournalLine,
    JournalStatus,
    NormalBalance,
)
from iam.models import (
    CompanyMembership,
    Permission,
    Role,
    RolePermission,
    UserRoleAssignment,
)
from master_data.models import Currency, Party, PartyRole
from organization.models import Branch, Company


class AccountManagementTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam", "is_active": True})
        self.usd, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "Đô la Mỹ", "is_active": True})

        self.company = Company.objects.create(
            code="CORP_TEST_COA",
            name="Công ty TNHH Kế Toán",
            legal_name="Công ty TNHH Kế Toán",
            tax_code="0109999999",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.other_company = Company.objects.create(
            code="CORP_OTHER_COA",
            name="Công ty Khác",
            legal_name="Công ty Cổ Phần Khác",
            tax_code="0109999998",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )

        self.branch = Branch.objects.create(company=self.company, code="HO", name="Hội sở chính")

        # Period for transaction testing
        self.period = AccountingPeriod.objects.create(
            company=self.company,
            code="2026-10",
            fiscal_year=2026,
            period_number=10,
            start_date=self.today.replace(day=1),
            end_date=self.today.replace(day=28),
            status="OPEN",
        )

        # Standard Chart of Accounts
        self.chart = ChartOfAccounts.objects.create(
            company=self.company,
            code="COA-TEST",
            name="Hệ thống tài khoản kiểm thử",
            accounting_regime="TT200",
            effective_from=self.today,
            is_default=True,
            status="ACTIVE",
        )

        # Base Account Classes
        self.ac_asset = AccountClass.objects.create(company=self.company, code="1", name="Tài sản ngắn hạn", normal_balance="DEBIT")
        self.ac_liab = AccountClass.objects.create(company=self.company, code="3", name="Nợ phải trả", normal_balance="CREDIT")

        # IAM user & client
        auth_user = get_user_model().objects.create_user(username="coa-accountant", password="password")
        self.account_user = auth_user.iam_account
        self.membership = CompanyMembership.objects.create(company=self.company, user=self.account_user, created_by=self.account_user)
        self.role = Role.objects.create(company=self.company, code="COA_ACCOUNTANT", name="Kế toán viên COA")
        self.assignment = UserRoleAssignment.objects.create(company_membership=self.membership, role=self.role, assigned_by=self.account_user)

        self.superuser = get_user_model().objects.create_superuser(username="coa-admin", password="password")

        self.client = APIClient()
        self.client.force_authenticate(user=auth_user)

    def _grant_permissions(self, *codes):
        for code in codes:
            perm = Permission.objects.filter(code=code).first()
            if perm:
                RolePermission.objects.get_or_create(role=self.role, permission=perm, defaults={"effect": "ALLOW"})

    # =====================================================================
    # 1. RBAC & PERMISSION TESTS (BR-COA-47, EF-01, EF-03, EF-13)
    # =====================================================================

    def test_view_without_permission_denied(self):
        """User không có quyền MD.ACCOUNT.VIEW bị từ chối truy cập (EF-01)."""
        res = self.client.get(f"/api/v1/general-ledger/accounts/?company_id={self.company.id}")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_view_with_permission_allowed(self):
        """User có quyền MD.ACCOUNT.VIEW xem được danh sách tài khoản."""
        self._grant_permissions("MD.ACCOUNT.VIEW")
        res = self.client.get(f"/api/v1/general-ledger/accounts/?company_id={self.company.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_create_without_permission_denied(self):
        """User không có quyền MD.ACCOUNT.CREATE bị từ chối tạo mới (EF-03)."""
        self._grant_permissions("MD.ACCOUNT.VIEW")
        payload = {
            "company": str(self.company.id),
            "chart_of_accounts": str(self.chart.id),
            "code": "111",
            "name": "Tiền mặt",
            "account_type": "ASSET",
            "normal_balance": "DEBIT",
        }
        res = self.client.post(f"/api/v1/general-ledger/accounts/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_with_permission_allowed(self):
        """User có quyền MD.ACCOUNT.CREATE tạo thành công tài khoản."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.CREATE")
        payload = {
            "company": str(self.company.id),
            "chart_of_accounts": str(self.chart.id),
            "code": "111",
            "name": "Tiền mặt",
            "name_en": "Cash on hand",
            "account_type": "ASSET",
            "normal_balance": "DEBIT",
            "is_postable": True,
        }
        res = self.client.post(f"/api/v1/general-ledger/accounts/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["code"], "111")
        self.assertEqual(res.data["account_level"], 1)

    # =====================================================================
    # 2. TEMPLATE INITIALIZATION TESTS (Main Flow 2.1, AF-01, AF-02, AF-19, BR-COA-04, 52)
    # =====================================================================

    def test_init_from_template_tt200_full(self):
        """Khởi tạo toàn bộ hệ thống tài khoản theo Thông tư 200 (Main Flow 2.1)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.CREATE")
        payload = {
            "company_id": str(self.company.id),
            "regime": "TT200",
            "scope": "FULL",
        }
        res = self.client.post(f"/api/v1/general-ledger/accounts/init-from-template/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertGreater(res.data["created_count"], 30)

        # Kiểm tra tài khoản hệ thống được tạo đúng và có cờ is_system=True (BR-COA-06)
        acc_111 = Account.objects.filter(company=self.company, code="111").first()
        self.assertIsNotNone(acc_111)
        self.assertTrue(acc_111.is_system)

        acc_1111 = Account.objects.filter(company=self.company, code="1111").first()
        self.assertIsNotNone(acc_1111)
        self.assertEqual(acc_1111.parent_id, acc_111.id)
        self.assertEqual(acc_1111.account_level, 2)

        # Kiểm tra Dimension cấu hình cho 131 và 331
        acc_131 = Account.objects.filter(company=self.company, code="131").first()
        self.assertEqual(acc_131.dimension_requirements.get("CUSTOMER"), "REQUIRED")
        self.assertEqual(acc_131.normal_balance, "BOTH")

        acc_331 = Account.objects.filter(company=self.company, code="331").first()
        self.assertEqual(acc_331.dimension_requirements.get("SUPPLIER"), "REQUIRED")

        # Kiểm tra Audit Log đã ghi (BR-COA-60)
        log = AuditLog.objects.filter(company=self.company, action_code="INIT_TEMPLATE").first()
        self.assertIsNotNone(log)
        self.assertIsNotNone(log.occurred_at)

    def test_init_from_template_skips_existing_accounts(self):
        """Khởi tạo khi đã có một số tài khoản -> bổ sung tài khoản thiếu, không trùng lặp (AF-01)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.CREATE")
        Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="111", name="Tiền mặt riêng",
            account_type="ASSET", normal_balance="DEBIT",
        )
        payload = {
            "company_id": str(self.company.id),
            "regime": "TT200",
            "scope": "FULL",
        }
        res = self.client.post(f"/api/v1/general-ledger/accounts/init-from-template/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertGreater(res.data["skipped_count"], 0)

        # Tài khoản 111 cũ vẫn được giữ nguyên
        acc_111 = Account.objects.get(company=self.company, chart_of_accounts=self.chart, code="111")
        self.assertEqual(acc_111.name, "Tiền mặt riêng")

    def test_init_from_template_essential_scope(self):
        """Khởi tạo mẫu rút gọn ESSENTIAL cho doanh nghiệp một người / nhỏ (AF-02, AF-19, BR-COA-52)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.CREATE")
        payload = {
            "company_id": str(self.company.id),
            "regime": "TT133",
            "scope": "ESSENTIAL",
        }
        res = self.client.post(f"/api/v1/general-ledger/accounts/init-from-template/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Account.objects.filter(company=self.company, code="111").exists())
        self.assertTrue(Account.objects.filter(company=self.company, code="511").exists())

    # =====================================================================
    # 3. HIERARCHY, CYCLE DETECTION & CODE RULES (BR-COA-08..13, EF-07, EF-09, EF-14)
    # =====================================================================

    def test_child_code_must_start_with_parent_code(self):
        """Số hiệu tài khoản con phải bắt đầu bằng số hiệu tài khoản cha (BR-COA-12)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.CREATE")
        parent = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="111", name="Tiền mặt",
            account_type="ASSET", normal_balance="DEBIT",
        )
        payload = {
            "company": str(self.company.id),
            "chart_of_accounts": str(self.chart.id),
            "parent": str(parent.id),
            "code": "1121",  # Không bắt đầu bằng 111
            "name": "Sai mã",
            "account_type": "ASSET",
            "normal_balance": "DEBIT",
        }
        res = self.client.post(f"/api/v1/general-ledger/accounts/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("code", res.data)

    def test_child_nature_must_match_parent_nature(self):
        """Bản chất tài khoản con phải tương thích với tài khoản cha (BR-COA-13, EF-09)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.CREATE")
        parent = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="111", name="Tiền mặt",
            account_type="ASSET", normal_balance="DEBIT",
        )
        payload = {
            "company": str(self.company.id),
            "chart_of_accounts": str(self.chart.id),
            "parent": str(parent.id),
            "code": "1111",
            "name": "Tiền VND",
            "account_type": "EXPENSE",  # Không tương thích với ASSET
            "normal_balance": "DEBIT",
        }
        res = self.client.post(f"/api/v1/general-ledger/accounts/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("account_type", res.data)

    def test_child_under_inactive_parent_denied(self):
        """Không cho phép tạo tài khoản con dưới tài khoản cha đã ngừng sử dụng (EF-07)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.CREATE")
        inactive_parent = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="111", name="Tiền mặt ngừng",
            account_type="ASSET", normal_balance="DEBIT", status="INACTIVE",
        )
        payload = {
            "company": str(self.company.id),
            "chart_of_accounts": str(self.chart.id),
            "parent": str(inactive_parent.id),
            "code": "1111",
            "name": "Tiền VND",
            "account_type": "ASSET",
            "normal_balance": "DEBIT",
        }
        res = self.client.post(f"/api/v1/general-ledger/accounts/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", res.data)

    def test_cycle_detection_denied(self):
        """Cây tài khoản không được tạo chu trình vòng (BR-COA-10, EF-14)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.EDIT")
        p = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="111", name="P", account_type="ASSET", normal_balance="DEBIT")
        c = Account.objects.create(company=self.company, chart_of_accounts=self.chart, parent=p, code="1111", name="C", account_type="ASSET", normal_balance="DEBIT")
        # Thử đổi cha của p thành c
        payload = {
            "parent": str(c.id),
        }
        res = self.client.patch(f"/api/v1/general-ledger/accounts/{p.id}/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", res.data)

    # =====================================================================
    # 4. SUMMARY VS POSTING ACCOUNT RULES (BR-COA-14, 15, EF-10)
    # =====================================================================

    def test_summary_account_with_active_children_cannot_be_postable(self):
        """Tài khoản tổng hợp có tài khoản con ACTIVE không được làm Posting Account (BR-COA-14, EF-10)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.EDIT")
        p = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="111", name="P", account_type="ASSET", normal_balance="DEBIT", is_postable=False)
        c = Account.objects.create(company=self.company, chart_of_accounts=self.chart, parent=p, code="1111", name="C", account_type="ASSET", normal_balance="DEBIT", status="ACTIVE")

        # Thử sửa p thành is_postable=True
        payload = {"is_postable": True}
        res = self.client.patch(f"/api/v1/general-ledger/accounts/{p.id}/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is_postable", res.data)

    # =====================================================================
    # 5. DIMENSION REQUIREMENTS & JOURNAL POSTING VALIDATION (BR-COA-22, 25, 45)
    # =====================================================================

    def test_journal_entry_fails_when_required_dimension_missing(self):
        """Bút toán thiếu Dimension REQUIRED không được ghi sổ (BR-COA-22, 25, 45)."""
        acc_131 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="131", name="Phải thu KH",
            account_type="ASSET", normal_balance="BOTH", is_postable=True,
            dimension_requirements={"CUSTOMER": "REQUIRED"},
        )
        acc_1111 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="1111", name="Tiền mặt",
            account_type="ASSET", normal_balance="DEBIT", is_postable=True,
        )

        entry = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JV-TEST-DIM",
            posting_date=self.today, description="Thu tiền", total_debit=Decimal("100"), total_credit=Decimal("100"),
            created_by=self.account_user,
        )
        JournalLine.objects.create(
            entry=entry, line_no=1, account=acc_1111, debit=Decimal("100"), credit=Decimal("0"),
            currency=self.currency, exchange_rate=Decimal("1"),
        )
        # Line 2 thiếu Party (CUSTOMER)
        JournalLine.objects.create(
            entry=entry, line_no=2, account=acc_131, debit=Decimal("0"), credit=Decimal("100"),
            currency=self.currency, exchange_rate=Decimal("1"), party=None,
        )

        from general_ledger.services import submit
        from rest_framework.request import Request
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        req = Request(factory.post("/"))
        req.user = self.superuser

        with self.assertRaises(Exception) as ctx:
            submit(entry, req)
        self.assertIn("bắt buộc nhập đối tượng CUSTOMER", str(ctx.exception))

    def test_journal_entry_succeeds_when_required_dimension_provided(self):
        """Bút toán có đủ Dimension REQUIRED được ghi sổ hợp lệ."""
        acc_131 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="131", name="Phải thu KH",
            account_type="ASSET", normal_balance="BOTH", is_postable=True,
            dimension_requirements={"CUSTOMER": "REQUIRED"},
        )
        acc_1111 = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="1111", name="Tiền mặt",
            account_type="ASSET", normal_balance="DEBIT", is_postable=True,
        )
        party = Party.objects.create(company=self.company, code="CUST-001", name="Khách hàng A")
        PartyRole.objects.create(party=party, role_type="CUSTOMER", active_from=self.today)

        entry = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JV-TEST-DIM-OK",
            posting_date=self.today, description="Thu tiền KH", total_debit=Decimal("100"), total_credit=Decimal("100"),
            created_by=self.account_user,
        )
        JournalLine.objects.create(
            entry=entry, line_no=1, account=acc_1111, debit=Decimal("100"), credit=Decimal("0"),
            currency=self.currency, exchange_rate=Decimal("1"),
        )
        JournalLine.objects.create(
            entry=entry, line_no=2, account=acc_131, debit=Decimal("0"), credit=Decimal("100"),
            currency=self.currency, exchange_rate=Decimal("1"), party=party,
        )

        from general_ledger.services import submit
        from rest_framework.parsers import JSONParser
        from rest_framework.request import Request
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        wsgi_req = factory.post("/", {"workflow_snapshot": {"levels": 1}}, format="json")
        req = Request(wsgi_req, parsers=[JSONParser()])
        req.user = self.account_user.auth_user
        res = submit(entry, req)
        self.assertEqual(res.status, JournalStatus.PENDING_APPROVAL)

    # =====================================================================
    # 6. SYSTEM ACCOUNT PROTECTION (BR-COA-06, 07, EF-15)
    # =====================================================================

    def test_system_account_core_attributes_protected(self):
        """Tài khoản hệ thống không được sửa code, account_type, normal_balance (BR-COA-07, EF-15)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.EDIT", "MD.ACCOUNT.DELETE")
        acc = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="111", name="Tiền mặt",
            account_type="ASSET", normal_balance="DEBIT", is_system=True,
        )

        # Sửa code bị chặn
        res = self.client.patch(f"/api/v1/general-ledger/accounts/{acc.id}/?company_id={self.company.id}", {"code": "119"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("số hiệu", str(res.data))

        # Sửa account_type bị chặn
        res = self.client.patch(f"/api/v1/general-ledger/accounts/{acc.id}/?company_id={self.company.id}", {"account_type": "EXPENSE"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("bản chất", str(res.data))

        # Sửa tên hiển thị hoặc mô tả thì được phép
        res = self.client.patch(f"/api/v1/general-ledger/accounts/{acc.id}/?company_id={self.company.id}", {"name": "Tiền mặt tại quỹ", "name_en": "Cash fund"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        acc.refresh_from_db()
        self.assertEqual(acc.name, "Tiền mặt tại quỹ")
        self.assertEqual(acc.name_en, "Cash fund")

        # Xóa cứng tài khoản hệ thống bị chặn
        res = self.client.delete(f"/api/v1/general-ledger/accounts/{acc.id}/hard-delete/?company_id={self.company.id}")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tài khoản hệ thống", str(res.data))

    # =====================================================================
    # 7. LOCKDOWN ON EXISTING TRANSACTIONS / BALANCES (BR-COA-36, 38, EF-16, 17, 21)
    # =====================================================================

    def test_account_with_transactions_cannot_change_code_or_delete(self):
        """Tài khoản đã có bút toán không được sửa code trực tiếp hoặc xóa cứng (BR-COA-36, 38, EF-16, 21)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.EDIT", "MD.ACCOUNT.DELETE")
        acc = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="1111", name="Tiền VND",
            account_type="ASSET", normal_balance="DEBIT", is_system=False,
        )
        entry = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JV-LOCK",
            posting_date=self.today, description="Test lock", total_debit=Decimal("10"), total_credit=Decimal("10"),
            created_by=self.account_user,
        )
        JournalLine.objects.create(
            entry=entry, line_no=1, account=acc, debit=Decimal("10"), credit=Decimal("0"),
            currency=self.currency, exchange_rate=Decimal("1"),
        )

        # Sửa code bị từ chối (EF-16)
        res = self.client.patch(f"/api/v1/general-ledger/accounts/{acc.id}/?company_id={self.company.id}", {"code": "1119"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("đã phát sinh bút toán", str(res.data))

        # Xóa cứng bị từ chối (BR-COA-36, EF-21)
        res = self.client.delete(f"/api/v1/general-ledger/accounts/{acc.id}/hard-delete/?company_id={self.company.id}")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Không thể xóa", str(res.data))

    def test_account_with_balances_cannot_change_nature(self):
        """Tài khoản đã có số dư không được thay đổi bản chất (EF-17)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.EDIT")
        acc = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="1111", name="Tiền VND",
            account_type="ASSET", normal_balance="DEBIT", is_system=False,
        )
        AccountBalance.objects.create(
            company=self.company, period=self.period, account=acc, branch=self.branch,
            closing_debit=Decimal("5000000"), closing_credit=Decimal("0"),
        )

        res = self.client.patch(f"/api/v1/general-ledger/accounts/{acc.id}/?company_id={self.company.id}", {"account_type": "EXPENSE"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("đã có số dư", str(res.data))

    # =====================================================================
    # 8. OPTIMISTIC CONCURRENCY LOCKING (EF-24, BR-COA-58)
    # =====================================================================

    def test_optimistic_locking_conflict(self):
        """Cập nhật tài khoản với version cũ trả về 409 Conflict (EF-24, BR-COA-58)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.EDIT")
        acc = Account.objects.create(
            company=self.company, chart_of_accounts=self.chart, code="1111", name="Tiền VND",
            account_type="ASSET", normal_balance="DEBIT", version=2,
        )
        payload = {"name": "Tên mới", "version": 1}  # Sai version
        res = self.client.patch(f"/api/v1/general-ledger/accounts/{acc.id}/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)

        # Đúng version cập nhật thành công và tăng version lên 3
        payload["version"] = 2
        res = self.client.patch(f"/api/v1/general-ledger/accounts/{acc.id}/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        acc.refresh_from_db()
        self.assertEqual(acc.version, 3)

    # =====================================================================
    # 9. DEACTIVATION & REACTIVATION CHECKS (Main Flow 2.4, EF-18..20, AF-16)
    # =====================================================================

    def test_deactivation_fails_if_active_children_exist(self):
        """Ngừng tài khoản khi còn tài khoản con ACTIVE bị từ chối (EF-18)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.EDIT")
        p = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="111", name="P", account_type="ASSET", normal_balance="DEBIT")
        Account.objects.create(company=self.company, chart_of_accounts=self.chart, parent=p, code="1111", name="C", account_type="ASSET", normal_balance="DEBIT", status="ACTIVE")

        payload = {"new_status": "INACTIVE", "reason": "Ngừng dùng"}
        res = self.client.post(f"/api/v1/general-ledger/accounts/{p.id}/change-status/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tài khoản con", str(res.data))

    def test_deactivation_fails_if_draft_journals_exist(self):
        """Ngừng tài khoản khi còn chứng từ Draft bị từ chối (EF-20)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.EDIT")
        acc = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="1111", name="C", account_type="ASSET", normal_balance="DEBIT")
        entry = JournalEntry.objects.create(
            company=self.company, branch=self.branch, period=self.period, number="JV-DRAFT",
            posting_date=self.today, description="Draft", total_debit=Decimal("10"), total_credit=Decimal("10"),
            status="DRAFT", created_by=self.account_user,
        )
        JournalLine.objects.create(entry=entry, line_no=1, account=acc, debit=Decimal("10"), credit=Decimal("0"), currency=self.currency, exchange_rate=Decimal("1"))

        payload = {"new_status": "INACTIVE", "reason": "Ngừng dùng"}
        res = self.client.post(f"/api/v1/general-ledger/accounts/{acc.id}/change-status/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("chứng từ nháp", str(res.data))

    def test_deactivation_and_reactivation_success(self):
        """Ngừng tài khoản thành công và kích hoạt lại thành công (Main Flow 2.4, AF-16)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.EDIT")
        acc = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="1111", name="C", account_type="ASSET", normal_balance="DEBIT")

        payload = {"new_status": "INACTIVE", "reason": "Đổi cơ cấu kế toán", "end_date": str(self.today)}
        res = self.client.post(f"/api/v1/general-ledger/accounts/{acc.id}/change-status/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        acc.refresh_from_db()
        self.assertEqual(acc.status, "INACTIVE")
        self.assertEqual(acc.inactive_reason, "Đổi cơ cấu kế toán")

        # Kích hoạt lại (AF-16)
        payload = {"new_status": "ACTIVE"}
        res = self.client.post(f"/api/v1/general-ledger/accounts/{acc.id}/change-status/?company_id={self.company.id}", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        acc.refresh_from_db()
        self.assertEqual(acc.status, "ACTIVE")

    # =====================================================================
    # 10. TREE AND IMPACT ENDPOINTS (Main Flow 2.2, 2.3)
    # =====================================================================

    def test_tree_hierarchy_endpoint(self):
        """API lấy cây tài khoản trả về cấu trúc phân cấp cha - con (Main Flow 2.2)."""
        self._grant_permissions("MD.ACCOUNT.VIEW")
        p = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="111", name="Tiền mặt", account_type="ASSET", normal_balance="DEBIT")
        c1 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, parent=p, code="1111", name="Tiền VND", account_type="ASSET", normal_balance="DEBIT")
        c2 = Account.objects.create(company=self.company, chart_of_accounts=self.chart, parent=p, code="1112", name="Ngoại tệ", account_type="ASSET", normal_balance="DEBIT")

        res = self.client.get(f"/api/v1/general-ledger/accounts/tree/?company_id={self.company.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        root = res.data[0]
        self.assertEqual(root["code"], "111")
        self.assertEqual(len(root["children"]), 2)
        child_codes = [c["code"] for c in root["children"]]
        self.assertIn("1111", child_codes)
        self.assertIn("1112", child_codes)

    def test_impact_analysis_endpoint(self):
        """API phân tích tác động trả về báo cáo chi tiết về số dư, con, bút toán (Main Flow 2.3)."""
        self._grant_permissions("MD.ACCOUNT.VIEW")
        p = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="111", name="Tiền mặt", account_type="ASSET", normal_balance="DEBIT")
        Account.objects.create(company=self.company, chart_of_accounts=self.chart, parent=p, code="1111", name="Tiền VND", account_type="ASSET", normal_balance="DEBIT")

        res = self.client.get(f"/api/v1/general-ledger/accounts/{p.id}/impact/?company_id={self.company.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["children_count"], 1)
        self.assertEqual(res.data["active_children_count"], 1)
        self.assertFalse(res.data["can_delete"])
        self.assertFalse(res.data["can_deactivate"])

    # =====================================================================
    # 11. CSV EXPORT & IMPORT (AF-17, AF-18, BR-COA-48..51, EF-22, EF-23)
    # =====================================================================

    def test_export_csv(self):
        """Xuất danh sách hệ thống tài khoản ra file CSV (AF-18, BR-COA-51)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.EXPORT")
        Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="111", name="Tiền mặt", account_type="ASSET", normal_balance="DEBIT")

        res = self.client.get(f"/api/v1/general-ledger/accounts/export-csv/?company_id={self.company.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "text/csv; charset=utf-8")
        content = res.content.decode("utf-8-sig")
        self.assertIn("code,name", content)
        self.assertIn("111,Tiền mặt", content)

    def test_import_csv_success(self):
        """Nhập danh sách tài khoản từ CSV thành công (AF-17, BR-COA-48..50)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.IMPORT")
        csv_data = (
            "code,name,name_en,parent_code,account_type,normal_balance,is_postable\n"
            "111,Tiền mặt,Cash,,ASSET,DEBIT,0\n"
            "1111,Tiền Việt Nam,VND,111,ASSET,DEBIT,1\n"
            "1112,Ngoại tệ,Foreign,111,ASSET,DEBIT,1\n"
        )
        file = SimpleUploadedFile("accounts.csv", csv_data.encode("utf-8"), content_type="text/csv")
        res = self.client.post(
            f"/api/v1/general-ledger/accounts/import-csv/?company_id={self.company.id}",
            {"file": file, "chart_of_accounts_id": str(self.chart.id)},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["imported_count"], 3)
        self.assertTrue(Account.objects.filter(company=self.company, code="1111").exists())

    def test_import_csv_cycle_or_invalid_parent_fails_transactionally(self):
        """File CSV có lỗi cấu trúc cha con hoặc chu trình bị từ chối toàn bộ (EF-22, EF-23, BR-COA-50)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.IMPORT")
        csv_data = (
            "code,name,parent_code,account_type,normal_balance\n"
            "111,Tiền mặt,,ASSET,DEBIT\n"
            "1111,Tiền Việt Nam,999,ASSET,DEBIT\n"  # 999 không tồn tại (EF-22)
        )
        file = SimpleUploadedFile("accounts.csv", csv_data.encode("utf-8"), content_type="text/csv")
        res = self.client.post(
            f"/api/v1/general-ledger/accounts/import-csv/?company_id={self.company.id}",
            {"file": file, "chart_of_accounts_id": str(self.chart.id)},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        # Kiểm tra không tạo một phần (BR-COA-50)
        self.assertFalse(Account.objects.filter(company=self.company, code="111").exists())

    # =====================================================================
    # 12. AUDIT LOG & HISTORY (Main Flow 2.3, BR-COA-60, 61)
    # =====================================================================

    def test_history_endpoint_returns_audit_trail(self):
        """API history trả về lịch sử thao tác với thông tin trước và sau (BR-COA-60, 61)."""
        self._grant_permissions("MD.ACCOUNT.VIEW", "MD.ACCOUNT.CREATE", "MD.ACCOUNT.EDIT")
        acc = Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="111", name="Gốc", account_type="ASSET", normal_balance="DEBIT")

        self.client.patch(f"/api/v1/general-ledger/accounts/{acc.id}/?company_id={self.company.id}", {"name": "Sửa đổi 1"}, format="json")
        self.client.patch(f"/api/v1/general-ledger/accounts/{acc.id}/?company_id={self.company.id}", {"name": "Sửa đổi 2"}, format="json")

        res = self.client.get(f"/api/v1/general-ledger/accounts/{acc.id}/history/?company_id={self.company.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 2)
        self.assertIn("occurred_at", res.data[0])
        self.assertIn("before", res.data[0])
        self.assertIn("after", res.data[0])

    # =====================================================================
    # 13. MASTER_DATA ALIAS URLS (UC-MD-09 Module Route)
    # =====================================================================

    def test_master_data_accounts_alias_url(self):
        """Đường dẫn alias /api/v1/master-data/accounts/ hoạt động chuẩn xác theo module UC-MD."""
        self._grant_permissions("MD.ACCOUNT.VIEW")
        Account.objects.create(company=self.company, chart_of_accounts=self.chart, code="111", name="Tiền mặt", account_type="ASSET", normal_balance="DEBIT")
        res = self.client.get(f"/api/v1/master-data/accounts/?company_id={self.company.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["code"], "111")
