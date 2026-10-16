import csv
import io
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from general_ledger.models import Account, AccountClass, ChartOfAccounts
from iam.models import (
    CompanyMembership,
    DataScopeBankAccount,
    DataScopeSet,
    Permission,
    Role,
    RolePermission,
    UserRoleAssignment,
)
from organization.models import Branch, Company
from .models import (
    Bank,
    BankAccountScope,
    BankAccountStatus,
    BankAccountType,
    BankConnectionStatus,
    CompanyBankAccount,
    Currency,
)


class CompanyBankAccountManagementTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam", "is_active": True})
        self.usd, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "Đô la Mỹ", "is_active": True})
        self.inactive_curr, _ = Currency.objects.get_or_create(code="EUR", defaults={"name": "Euro", "is_active": False})

        self.company = Company.objects.create(
            code="CORP_A",
            name="Công ty A",
            legal_name="Công ty TNHH A",
            tax_code="0101234567",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.other_company = Company.objects.create(
            code="CORP_B",
            name="Công ty B",
            legal_name="Công ty TNHH B",
            tax_code="0101234568",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )

        self.branch = Branch.objects.create(company=self.company, code="HN", name="Chi nhánh Hà Nội", status="ACTIVE")
        self.branch_sg = Branch.objects.create(company=self.company, code="SG", name="Chi nhánh Sài Gòn", status="ACTIVE")
        self.other_branch = Branch.objects.create(company=self.other_company, code="DN", name="Chi nhánh Đà Nẵng", status="ACTIVE")

        # Bank
        self.bank = Bank.objects.create(code="VCB", name="Vietcombank", status="ACTIVE")
        self.bank_tcb = Bank.objects.create(code="TCB", name="Techcombank", status="ACTIVE")
        self.inactive_bank = Bank.objects.create(code="INACT", name="Ngân hàng cũ", status="INACTIVE")

        # GL accounts
        cl = AccountClass.objects.create(company=self.company, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        chart = ChartOfAccounts.objects.create(company=self.company, code="TT200", name="Hệ thống TT200", effective_from=self.today, is_default=True)
        self.gl_1121 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=cl,
            code="1121", name="Tiền gửi VND", account_type="ASSET", normal_balance="DEBIT",
            is_postable=True, status="ACTIVE",
        )
        self.gl_1122 = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=cl,
            code="1122", name="Tiền gửi USD", account_type="ASSET", normal_balance="DEBIT",
            is_postable=True, status="ACTIVE",
        )
        self.gl_parent = Account.objects.create(
            company=self.company, chart_of_accounts=chart, account_class=cl,
            code="112", name="Tiền gửi ngân hàng", account_type="ASSET", normal_balance="DEBIT",
            is_postable=False, status="ACTIVE",
        )

        # IAM user & client
        auth_user = get_user_model().objects.create_user(username="bank-officer", password="password")
        self.account = auth_user.iam_account
        self.membership = CompanyMembership.objects.create(company=self.company, user=self.account, created_by=self.account)
        self.role = Role.objects.create(company=self.company, code="BANK_OFFICER", name="Quản lý tài khoản ngân hàng")
        self.assignment = UserRoleAssignment.objects.create(company_membership=self.membership, role=self.role, assigned_by=self.account)

        self.client = APIClient()
        self.client.force_authenticate(auth_user)
        self.url = "/api/v1/master-data/company-bank-accounts/"

    def grant(self, *actions):
        for action in actions:
            perm = Permission.objects.get(code=f"MD.BANK_ACCOUNT.{action}")
            RolePermission.objects.get_or_create(role=self.role, permission=perm, defaults={"effect": "ALLOW"})

    def payload(self, **overrides):
        data = {
            "company": str(self.company.pk),
            "code": "TK01",
            "account_number": "1900123456",
            "account_name": "CONG TY TNHH A",
            "bank": str(self.bank.pk),
            "currency": str(self.currency.pk),
            "account_type": BankAccountType.PAYMENT,
            "account_scope": BankAccountScope.COMPANY_SHARED,
            "gl_account": str(self.gl_1121.pk),
            "allow_receipt": True,
            "allow_payment": True,
        }
        data.update(overrides)
        return data

    def test_01_create_permission_and_mandatory_fields(self):
        """Kiểm tra phân quyền CREATE và các trường bắt buộc (EF-01, EF-02, BR-BANK-ACC-03)."""
        # 1. Chưa có quyền CREATE -> 403 Forbidden
        res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(res.status_code, 403)

        self.grant("CREATE", "VIEW")

        # 2. Thiếu số tài khoản -> 400
        p = self.payload()
        p.pop("account_number")
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

        # 3. Thiếu tên tài khoản -> 400
        p = self.payload(account_name="")
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

        # 4. Ngân hàng đã ngừng hoạt động -> 400 (EF-06, BR-BANK-ACC-07)
        p = self.payload(bank=str(self.inactive_bank.pk))
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

        # 5. Đồng tiền đã ngừng -> 400 (EF-07, BR-BANK-ACC-08)
        p = self.payload(currency=str(self.inactive_curr.pk))
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

        # 6. Tạo thành công với COMPANY_SHARED (không cần chi nhánh)
        res = self.client.post(self.url, self.payload(), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["code"], "TK01")
        self.assertEqual(res.data["account_number"], "1900123456")
        self.assertTrue(AuditLog.objects.filter(entity_id=res.data["id"], action_code="BANK_ACCOUNT_CREATE").exists())

    def test_02_account_number_normalization_and_uniqueness(self):
        """Kiểm tra chuẩn hóa số tài khoản và bắt trùng (BR-BANK-ACC-04, 05, EF-04, EF-05)."""
        self.grant("CREATE", "VIEW")

        # Tạo tài khoản đầu tiên với số tài khoản có dấu cách
        res = self.client.post(self.url, self.payload(code="TK01", account_number=" 1900 1234 56 "), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["account_number"], "1900123456")

        # 1. Trùng mã nội bộ code -> 400 (EF-04, BR-BANK-ACC-02)
        res_dup_code = self.client.post(self.url, self.payload(code="TK01", account_number="1900888888"), format="json")
        self.assertEqual(res_dup_code.status_code, 400)
        self.assertIn("code", str(res_dup_code.data))

        # 2. Trùng tổ hợp (bank, account_number, currency) -> 400 (EF-05, BR-BANK-ACC-04)
        res_dup_acc = self.client.post(self.url, self.payload(code="TK02", account_number="1900123456"), format="json")
        self.assertEqual(res_dup_acc.status_code, 400)
        self.assertIn("account_number", str(res_dup_acc.data))

        # 3. Cùng số tài khoản nhưng khác đồng tiền (USD) -> được phép tạo
        res_usd = self.client.post(self.url, self.payload(code="TK03", account_number="1900123456", currency=str(self.usd.pk), gl_account=str(self.gl_1122.pk)), format="json")
        self.assertEqual(res_usd.status_code, 201, res_usd.data)

    def test_03_scope_and_branch_validations(self):
        """Kiểm tra phạm vi BRANCH bắt buộc chi nhánh hợp lệ (BR-BANK-ACC-09, 10, EF-08)."""
        self.grant("CREATE", "VIEW")

        # 1. Scope BRANCH nhưng không gửi branch -> 400
        p = self.payload(code="TK_BR1", account_number="001", account_scope=BankAccountScope.BRANCH)
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

        # 2. Scope BRANCH với chi nhánh của doanh nghiệp khác -> 400 (EF-08)
        p = self.payload(code="TK_BR2", account_number="002", account_scope=BankAccountScope.BRANCH, branch=str(self.other_branch.pk))
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

        # 3. Scope BRANCH với chi nhánh hợp lệ -> 201
        p = self.payload(code="TK_BR3", account_number="003", account_scope=BankAccountScope.BRANCH, branch=str(self.branch.pk))
        res = self.client.post(self.url, p, format="json")
        self.assertEqual(res.status_code, 201, res.data)

    def test_04_active_gl_account_and_purpose_rules(self):
        """Kiểm tra tài khoản ACTIVE cần GL postable và ít nhất 1 mục đích thu/chi (BR-BANK-ACC-13, 16, EF-09, 10)."""
        self.grant("CREATE", "VIEW")

        # 1. Tài khoản ACTIVE liên kết với GL không postable (112 mẹ) -> 400 (EF-09, BR-BANK-ACC-16)
        p = self.payload(code="TK_GL1", account_number="011", gl_account=str(self.gl_parent.pk))
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

        # 2. Tài khoản ACTIVE không cho phép cả thu lẫn chi -> 400 (EF-10, BR-BANK-ACC-13)
        p = self.payload(code="TK_PURP1", account_number="012", allow_receipt=False, allow_payment=False)
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

        # 3. Nhưng nếu lưu DRAFT thì cho phép không chọn mục đích thu/chi (AF-09)
        p = self.payload(code="TK_DRAFT", account_number="013", allow_receipt=False, allow_payment=False, status=BankAccountStatus.DRAFT, gl_account=None)
        res = self.client.post(self.url, p, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["status"], "DRAFT")

    def test_05_swift_bic_format(self):
        """Kiểm tra định dạng SWIFT/BIC (EF-11)."""
        self.grant("CREATE", "VIEW")

        # Sai định dạng (ít hơn 8 ký tự hoặc chứa ký tự đặc biệt) -> 400
        p = self.payload(code="TK_SW1", account_number="021", swift_bic="VCB")
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 400)

        # Hợp lệ: 8 ký tự hoặc 11 ký tự -> 201
        p = self.payload(code="TK_SW2", account_number="022", swift_bic="BFTVVNVX")
        self.assertEqual(self.client.post(self.url, p, format="json").status_code, 201)

    def test_06_default_account_setting_and_replacement_confirmation(self):
        """Kiểm tra quản lý tài khoản mặc định và xác nhận thay thế (BR-BANK-ACC-11, AF-07, AF-08)."""
        self.grant("CREATE", "VIEW", "EDIT")

        # Tạo tài khoản 1 và đặt mặc định
        res1 = self.client.post(self.url, self.payload(code="TK_DEF1", account_number="1111"), format="json")
        self.assertEqual(res1.status_code, 201)
        id1 = res1.data["id"]

        endpoint1 = f"{self.url}{id1}/set-default/?company_id={self.company.pk}"
        set1 = self.client.post(endpoint1, {"version": res1.data["version"]}, format="json")
        self.assertEqual(set1.status_code, 200)
        self.assertTrue(set1.data["is_default"])

        # Tạo tài khoản 2 cùng scope & currency
        res2 = self.client.post(self.url, self.payload(code="TK_DEF2", account_number="2222"), format="json")
        self.assertEqual(res2.status_code, 201)
        id2 = res2.data["id"]

        endpoint2 = f"{self.url}{id2}/set-default/?company_id={self.company.pk}"

        # Đặt mặc định tài khoản 2 mà không confirm_replace -> 400 (AF-08)
        fail = self.client.post(endpoint2, {"version": res2.data["version"]}, format="json")
        self.assertEqual(fail.status_code, 400)
        self.assertIn("confirm_replace", str(fail.data))

        # Đặt mặc định tài khoản 2 có confirm_replace=True -> 200
        ok = self.client.post(endpoint2, {"version": res2.data["version"], "confirm_replace": True}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(ok.data["is_default"])

        # Kiểm tra tài khoản 1 tự động bị gỡ mặc định
        acc1 = CompanyBankAccount.objects.get(pk=id1)
        self.assertFalse(acc1.is_default)

    def test_07_cannot_modify_core_fields_after_transactions(self):
        """Không cho phép sửa số tài khoản, ngân hàng, đồng tiền khi đã phát sinh giao dịch (BR-BANK-ACC-28, EF-15)."""
        self.grant("CREATE", "VIEW", "EDIT")
        res = self.client.post(self.url, self.payload(code="TK_TX", account_number="999901"), format="json")
        self.assertEqual(res.status_code, 201)
        acc_id = res.data["id"]

        acc = CompanyBankAccount.objects.get(pk=acc_id)
        # Giả lập tài khoản đã có profile ngân hàng và số dư trong bank_management
        from bank_management.models import AccountProfile
        AccountProfile.objects.create(company=self.company, account=acc, balance=Decimal("5000000"))

        # Sửa tên hiển thị hoặc ghi chú -> thành công
        patch_ok = self.client.patch(
            f"{self.url}{acc_id}/?company_id={self.company.pk}",
            {"notes": "Ghi chú mới", "version": acc.updated_at.isoformat()},
            format="json",
        )
        self.assertEqual(patch_ok.status_code, 200)

        # Sửa số tài khoản -> 400 (EF-15, BR-BANK-ACC-28)
        patch_fail_acc = self.client.patch(
            f"{self.url}{acc_id}/?company_id={self.company.pk}",
            {"account_number": "999902", "version": acc.updated_at.isoformat()},
            format="json",
        )
        self.assertEqual(patch_fail_acc.status_code, 400)
        self.assertIn("account_number", str(patch_fail_acc.data))

        # Sửa ngân hàng -> 400
        patch_fail_bank = self.client.patch(
            f"{self.url}{acc_id}/?company_id={self.company.pk}",
            {"bank": str(self.bank_tcb.pk), "version": acc.updated_at.isoformat()},
            format="json",
        )
        self.assertEqual(patch_fail_bank.status_code, 400)
        self.assertIn("bank", str(patch_fail_bank.data))

    def test_08_deactivate_and_close_account_rules(self):
        """Kiểm tra ngừng sử dụng, đóng tài khoản và báo cáo ảnh hưởng (Section 2.3, EF-16..18, BR-BANK-ACC-32..34)."""
        self.grant("CREATE", "VIEW", "DEACTIVATE", "DELETE")

        res = self.client.post(self.url, self.payload(code="TK_CLS", account_number="555501", opened_date=self.today), format="json")
        self.assertEqual(res.status_code, 201)
        acc_id = res.data["id"]
        acc = CompanyBankAccount.objects.get(pk=acc_id)

        # 1. Báo cáo ảnh hưởng (Impact endpoint)
        impact_res = self.client.get(f"{self.url}{acc_id}/impact/?company_id={self.company.pk}")
        self.assertEqual(impact_res.status_code, 200)
        self.assertTrue(impact_res.data["can_delete"])

        # 2. Đổi sang INACTIVE cần lý do
        change_ep = f"{self.url}{acc_id}/change-status/?company_id={self.company.pk}"
        no_reason = self.client.post(change_ep, {"status": "INACTIVE", "version": acc.updated_at.isoformat()}, format="json")
        self.assertEqual(no_reason.status_code, 400)
        self.assertIn("reason", str(no_reason.data))

        # 3. Đổi sang CLOSED với ngày đóng trước ngày mở -> 400 (BR-BANK-ACC-32)
        yesterday = self.today - timezone.timedelta(days=1)
        bad_date = self.client.post(
            change_ep,
            {"status": "CLOSED", "reason": "Đóng tài khoản", "effective_date": str(yesterday), "version": acc.updated_at.isoformat()},
            format="json",
        )
        self.assertEqual(bad_date.status_code, 400)

        # 4. Khi tài khoản còn số dư khác 0 -> không được đóng trừ khi xác nhận (EF-16, BR-BANK-ACC-34)
        from bank_management.models import AccountProfile
        AccountProfile.objects.create(company=self.company, account=acc, balance=Decimal("1000000"))
        fail_bal = self.client.post(
            change_ep,
            {"status": "CLOSED", "reason": "Đóng tài khoản", "effective_date": str(self.today), "version": acc.updated_at.isoformat()},
            format="json",
        )
        self.assertEqual(fail_bal.status_code, 400)

        # 5. Không được xóa khi đã có số dư hoặc liên kết (BR-BANK-ACC-26, 27)
        del_res = self.client.delete(f"{self.url}{acc_id}/?company_id={self.company.pk}")
        self.assertEqual(del_res.status_code, 400)

    def test_09_bank_integration_connection_and_security(self):
        """Kiểm tra kết nối ngân hàng và bảo mật (Section 2.4, BR-BANK-ACC-40..45, 56)."""
        self.grant("CREATE", "VIEW", "CONNECT")

        res = self.client.post(self.url, self.payload(code="TK_CONN", account_number="777701"), format="json")
        self.assertEqual(res.status_code, 201)
        acc_id = res.data["id"]

        # Kết nối ngân hàng
        conn_res = self.client.post(
            f"{self.url}{acc_id}/connect-bank/?company_id={self.company.pk}",
            {"provider": "VIETCOMBANK_OPEN_API", "connection_id": "CONN-VCB-001", "sync_scope": "TRANSACTIONS_AND_STATEMENT"},
            format="json",
        )
        self.assertEqual(conn_res.status_code, 200)
        self.assertEqual(conn_res.data["connection_status"], "CONNECTED")

        # Kiểm tra AuditLog được tạo
        audit = AuditLog.objects.filter(entity_id=acc_id, action_code="BANK_ACCOUNT_CONNECT").first()
        self.assertIsNotNone(audit)

        # Ngắt kết nối ngân hàng
        disconn_res = self.client.post(
            f"{self.url}{acc_id}/disconnect-bank/?company_id={self.company.pk}",
            {"reason": "Tạm dừng đồng bộ"},
            format="json",
        )
        self.assertEqual(disconn_res.status_code, 200)
        self.assertEqual(disconn_res.data["connection_status"], "DISCONNECTED")

    def test_10_data_scope_isolation(self):
        """Kiểm tra Data Scope giới hạn tài khoản ngân hàng (BR-BANK-ACC-35..38)."""
        self.grant("CREATE", "VIEW")

        # Tạo 2 tài khoản
        acc1 = CompanyBankAccount.objects.create(
            company=self.company, code="TK_SCP1", account_number="8881", account_name="TK 1",
            bank=self.bank, currency=self.currency, gl_account=self.gl_1121,
        )
        acc2 = CompanyBankAccount.objects.create(
            company=self.company, code="TK_SCP2", account_number="8882", account_name="TK 2",
            bank=self.bank, currency=self.currency, gl_account=self.gl_1121,
        )

        # Gán Data Scope chỉ cho phép acc1
        scope = DataScopeSet.objects.create(company=self.company, code="SCOPE_ACC1", name="Chỉ TK 1", created_by=self.account)
        DataScopeBankAccount.objects.create(data_scope_set=scope, company_bank_account=acc1)
        self.assignment.data_scope_set = scope
        self.assignment.save(update_fields=("data_scope_set",))

        # Query danh sách -> chỉ thấy acc1
        list_res = self.client.get(self.url, {"company_id": str(self.company.pk)})
        self.assertEqual(list_res.status_code, 200)
        account_ids = [row["id"] for row in list_res.data]
        self.assertIn(str(acc1.pk), account_ids)
        self.assertNotIn(str(acc2.pk), account_ids)

        # Truy cập trực tiếp acc2 qua URL -> 404 (BR-BANK-ACC-38)
        detail_res = self.client.get(f"{self.url}{acc2.pk}/?company_id={self.company.pk}")
        self.assertEqual(detail_res.status_code, 404)

    def test_11_csv_import_and_export_with_masking(self):
        """Kiểm tra Import/Export CSV và che số tài khoản khi không có quyền xem unmasked (BR-BANK-ACC-39, 46..48, EF-22, 23)."""
        self.grant("CREATE", "VIEW", "IMPORT", "EXPORT")

        # 1. Import CSV với 1 dòng hợp lệ, 1 dòng sai ngân hàng
        csv_data = (
            "account_number,account_name,bank,currency,code,gl_account\n"
            "19009901,Tai khoan Hop le,VCB,VND,TK_IMP1,1121\n"
            "19009902,Tai khoan Loi,SAI_NGAN_HANG,VND,TK_IMP2,1121\n"
        )
        file = SimpleUploadedFile("accounts.csv", csv_data.encode("utf-8"), content_type="text/csv")
        imp_res = self.client.post(
            f"{self.url}import-csv/?company_id={self.company.pk}",
            {"company": str(self.company.pk), "file": file},
            format="multipart",
        )
        self.assertEqual(imp_res.status_code, 200)
        self.assertEqual(len(imp_res.data["created"]), 1)
        self.assertEqual(len(imp_res.data["errors"]), 1)
        self.assertEqual(imp_res.data["errors"][0]["row"], 3)

        # 2. Export CSV khi KHÔNG có quyền VIEW_UNMASKED -> số tài khoản bị che (EF-23, BR-BANK-ACC-39)
        exp_res = self.client.get(f"{self.url}export-csv/?company_id={self.company.pk}")
        self.assertEqual(exp_res.status_code, 200)
        self.assertIn(b"****9901", exp_res.content)
        self.assertNotIn(b",19009901,", exp_res.content)

        # 3. Khi cấp thêm quyền VIEW_UNMASKED -> số tài khoản hiển thị đầy đủ
        self.grant("VIEW_UNMASKED")
        exp_unmasked = self.client.get(f"{self.url}export-csv/?company_id={self.company.pk}")
        self.assertEqual(exp_unmasked.status_code, 200)
        self.assertIn(b"19009901", exp_unmasked.content)
