"""
Test Suite for UC-MD-01: Quản lý khách hàng (Customer Management).
Covers all functional flows, alternative flows, exception flows, and business rules (BR-CUS-01..60).
"""

from decimal import Decimal
import uuid

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from general_ledger.models import Account, AccountClass, ChartOfAccounts
from iam.models import (
    ActiveStatus,
    CompanyMembership,
    DataScopeBranch,
    DataScopeSet,
    Permission,
    PermissionAction,
    PermissionResource,
    Role,
    RolePermission,
    UserRoleAssignment,
)
from master_data.customer_services import (
    check_customer_can_be_deleted,
    delete_customer,
    detect_duplicate_customers,
    generate_customer_code,
    get_customer_debt_and_transactions_summary,
    lookup_business_tax_info,
    merge_customers,
    quick_create_customer,
)
from master_data.models import (
    Bank,
    Currency,
    CustomerProfile,
    Party,
    PartyAddress,
    PartyBankAccount,
    PartyContact,
    PartyRole,
)
from organization.models import Branch, Company


class CustomerManagementTests(TestCase):
    def setUp(self):
        # 1. Base Currency & Companies
        self.currency, _ = Currency.objects.get_or_create(
            code="VND", defaults={"name": "Đồng Việt Nam", "numeric_code": "704"}
        )
        self.company_a = Company.objects.create(
            code="COMP_A",
            name="Công ty A",
            legal_name="Công ty Cổ phần A",
            tax_code="0101234567",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )
        self.branch_a1 = Branch.objects.create(company=self.company_a, code="HCM", name="Chi nhánh HCM")
        self.branch_a2 = Branch.objects.create(company=self.company_a, code="HN", name="Chi nhánh HN")

        # Company B for multi-tenant isolation tests
        self.company_b = Company.objects.create(
            code="COMP_B",
            name="Công ty B",
            legal_name="Công ty TNHH B",
            tax_code="0201234567",
            accounting_currency=self.currency,
            legal_reporting_currency=self.currency,
            status="ACTIVE",
        )

        # 2. Users & Memberships
        self.superuser_auth = get_user_model().objects.create_superuser(
            username="superadmin", email="super@example.com", password="password-123"
        )
        self.superuser = self.superuser_auth.iam_account
        self.superuser.display_name = "Super Admin"
        self.superuser.save()

        self.admin_auth = get_user_model().objects.create_user(
            username="admin-a", email="admin@compa.com", password="password-123"
        )
        self.admin = self.admin_auth.iam_account
        self.admin.display_name = "Admin A"
        self.admin.save()
        self.membership_admin = CompanyMembership.objects.create(
            company=self.company_a, user=self.admin, membership_status="ACTIVE", created_by=self.superuser
        )

        # Regular Clerk User
        self.clerk_auth = get_user_model().objects.create_user(
            username="clerk-a", email="clerk@compa.com", password="password-123"
        )
        self.clerk = self.clerk_auth.iam_account
        self.clerk.display_name = "Clerk A"
        self.clerk.save()
        self.membership_clerk = CompanyMembership.objects.create(
            company=self.company_a, user=self.clerk, membership_status="ACTIVE", created_by=self.admin
        )

        # 3. Roles & Permissions
        self.admin_role = Role.objects.create(company=self.company_a, code="SYS_ADMIN", name="System Admin", is_system_admin=True)
        resource, _ = PermissionResource.objects.get_or_create(
            code="MD.PARTY", defaults={"module_code": "MD", "name": "Party", "status": "ACTIVE"}
        )
        for act in ("VIEW", "CREATE", "EDIT", "STATUS", "DELETE", "IMPORT", "EXPORT", "MERGE"):
            action, _ = PermissionAction.objects.get_or_create(code=act, defaults={"name": act})
            perm, _ = Permission.objects.get_or_create(
                code=f"MD.PARTY.{act}",
                defaults={"resource": resource, "action": action, "description": act, "status": "ACTIVE"},
            )
            RolePermission.objects.get_or_create(role=self.admin_role, permission=perm, defaults={"effect": "ALLOW"})
        UserRoleAssignment.objects.create(
            company_membership=self.membership_admin,
            role=self.admin_role,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now(),
            assigned_by=self.superuser,
        )

        # 4. GL Accounts for testing
        self.asset_class = AccountClass.objects.create(company=self.company_a, code="ASSET", name="Tài sản", normal_balance="DEBIT")
        self.revenue_class = AccountClass.objects.create(company=self.company_a, code="REVENUE", name="Doanh thu", normal_balance="CREDIT")
        self.chart = ChartOfAccounts.objects.create(company=self.company_a, code="TT99", name="Hệ thống", effective_from=timezone.localdate(), is_default=True)
        self.receivable_acc = Account.objects.create(
            company=self.company_a,
            chart_of_accounts=self.chart,
            account_class=self.asset_class,
            code="131",
            name="Phải thu của khách hàng",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
            status="ACTIVE",
        )
        self.revenue_acc = Account.objects.create(
            company=self.company_a,
            chart_of_accounts=self.chart,
            account_class=self.revenue_class,
            code="511",
            name="Doanh thu bán hàng và cung cấp dịch vụ",
            account_type="REVENUE",
            normal_balance="CREDIT",
            is_postable=True,
            status="ACTIVE",
        )

        # 5. Bank for bank account testing
        self.bank = Bank.objects.create(code="VCB", name="Ngân hàng Ngoại thương Việt Nam")

        # 6. API Client
        self.client = APIClient()
        self.client.force_authenticate(self.admin_auth)

    def url(self, suffix="", company=None):
        comp = company or self.company_a
        sep = "&" if "?" in suffix else "?"
        return f"/api/v1/master-data/customers/{suffix}{sep}company_id={comp.id}"

    # -----------------------------------------------------------------
    # 1. CREATE CUSTOMER: MANUAL AND AUTO-GENERATED CODE (AF-02, BR-CUS-03, 04)
    # -----------------------------------------------------------------
    def test_01_create_customer_with_manual_and_auto_code(self):
        """Tạo khách hàng với mã tự nhập hoặc tự động sinh theo cấu hình (AF-02, BR-CUS-04)."""
        # Manual code
        payload_manual = {
            "company": str(self.company_a.id),
            "code": "KH_MANUAL_01",
            "name": "Khách hàng Nhập Tay",
            "party_type": "ORGANIZATION",
            "legal_name": "Công ty TNHH Nhập Tay",
            "tax_code": "0109999001",
        }
        res1 = self.client.post(self.url(), payload_manual, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED, res1.data)
        self.assertEqual(res1.data["code"], "KH_MANUAL_01")
        self.assertTrue(Party.objects.filter(company=self.company_a, code="KH_MANUAL_01").exists())

        # Auto code (omitted code)
        payload_auto = {
            "company": str(self.company_a.id),
            "code": "",  # Empty -> trigger auto-generation
            "name": "Khách hàng Tự Sinh Mã",
            "party_type": "INDIVIDUAL",
        }
        res2 = self.client.post(self.url(), payload_auto, format="json")
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED, res2.data)
        auto_code = res2.data["code"]
        self.assertTrue(auto_code.startswith("KH"))
        self.assertTrue(Party.objects.filter(company=self.company_a, code=auto_code).exists())

    # -----------------------------------------------------------------
    # 2. ORGANIZATION REQUIRES LEGAL NAME ON ACTIVE (BR-CUS-05, 06, EF-03)
    # -----------------------------------------------------------------
    def test_02_create_organization_requires_legal_name_on_active(self):
        """Khách hàng tổ chức ở trạng thái ACTIVE bắt buộc phải có tên pháp lý (BR-CUS-06)."""
        payload_invalid = {
            "company": str(self.company_a.id),
            "code": "KH_ORG_01",
            "name": "Công ty Không Có Tên Pháp Lý",
            "party_type": "ORGANIZATION",
            "legal_name": "",  # Trống tên pháp lý
            "status": "ACTIVE",
        }
        res = self.client.post(self.url(), payload_invalid, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("legal_name", res.data)

        # DRAFT status allows incomplete legal_name (AF-09)
        payload_draft = {
            "company": str(self.company_a.id),
            "code": "KH_ORG_DRAFT",
            "name": "Công ty Nháp",
            "party_type": "ORGANIZATION",
            "legal_name": "",
            "status": "DRAFT",
        }
        res_draft = self.client.post(self.url(), payload_draft, format="json")
        self.assertEqual(res_draft.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_draft.data["status"], "DRAFT")

    # -----------------------------------------------------------------
    # 3. TAX CODE NORMALIZATION AND DUPLICATE DETECTION (BR-CUS-07, 10, EF-05, EF-06)
    # -----------------------------------------------------------------
    def test_03_tax_code_normalization_and_duplicate_check(self):
        """Chuẩn hóa MST và chặn trùng MST giữa các khách hàng ACTIVE (BR-CUS-07, 10, EF-06)."""
        payload_1 = {
            "company": str(self.company_a.id),
            "code": "KH_TAX_01",
            "name": "Công ty Một",
            "party_type": "ORGANIZATION",
            "legal_name": "Công ty TNHH Một",
            "tax_code": " 0108888999 ",  # Có khoảng trắng
        }
        res1 = self.client.post(self.url(), payload_1, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res1.data["tax_code"], "0108888999")  # Đã chuẩn hóa

        # Duplicate tax_code in same company
        payload_2 = {
            "company": str(self.company_a.id),
            "code": "KH_TAX_02",
            "name": "Công ty Hai",
            "party_type": "ORGANIZATION",
            "legal_name": "Công ty TNHH Hai",
            "tax_code": "0108888999",  # Trùng
        }
        res2 = self.client.post(self.url(), payload_2, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tax_code", res2.data)

        # Invalid tax_code format (EF-05)
        payload_invalid_tax = {
            "company": str(self.company_a.id),
            "code": "KH_TAX_INV",
            "name": "Công ty Sai MST",
            "party_type": "ORGANIZATION",
            "legal_name": "Công ty TNHH Sai MST",
            "tax_code": "12345",  # Không đủ 10 hoặc 13 số
        }
        res_inv = self.client.post(self.url(), payload_invalid_tax, format="json")
        self.assertEqual(res_inv.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tax_code", res_inv.data)

    # -----------------------------------------------------------------
    # 4. MULTIPLE ADDRESSES AND SINGLE DEFAULT PER TYPE (BR-CUS-12)
    # -----------------------------------------------------------------
    def test_04_multiple_addresses_and_single_default_per_type(self):
        """Mỗi loại địa chỉ chỉ được có tối đa 1 địa chỉ mặc định (BR-CUS-12)."""
        payload_valid = {
            "company": str(self.company_a.id),
            "code": "KH_ADDR_01",
            "name": "Khách hàng Địa chỉ",
            "party_type": "INDIVIDUAL",
            "addresses": [
                {"address_type": "REGISTERED", "address_line": "123 Lê Duẩn, HN", "is_default": True},
                {"address_type": "SHIPPING", "address_line": "456 Nguyễn Huệ, HCM", "is_default": True},
                {"address_type": "SHIPPING", "address_line": "789 Đồng Khởi, HCM", "is_default": False},
            ],
        }
        res = self.client.post(self.url(), payload_valid, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res.data["addresses"]), 3)

        # Duplicate default for same address_type
        payload_invalid = {
            "company": str(self.company_a.id),
            "code": "KH_ADDR_02",
            "name": "Khách hàng Địa chỉ Trùng Mặc Định",
            "party_type": "INDIVIDUAL",
            "addresses": [
                {"address_type": "SHIPPING", "address_line": "Kho 1", "is_default": True},
                {"address_type": "SHIPPING", "address_line": "Kho 2", "is_default": True},
            ],
        }
        res_inv = self.client.post(self.url(), payload_invalid, format="json")
        self.assertEqual(res_inv.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("addresses", res_inv.data)

    # -----------------------------------------------------------------
    # 5. MULTIPLE CONTACTS AND SINGLE DEFAULT PER TYPE (BR-CUS-13)
    # -----------------------------------------------------------------
    def test_05_multiple_contacts_and_single_default_per_type(self):
        """Mỗi loại người liên hệ chỉ được có tối đa 1 liên hệ chính (BR-CUS-13)."""
        payload_valid = {
            "company": str(self.company_a.id),
            "code": "KH_CONTACT_01",
            "name": "Khách hàng Liên Hệ",
            "party_type": "ORGANIZATION",
            "legal_name": "Công ty Liên Hệ",
            "contacts": [
                {"contact_type": "BUSINESS", "contact_name": "Nguyễn Văn A", "phone": "0901234567", "is_default": True},
                {"contact_type": "ACCOUNTING", "contact_name": "Trần Thị B", "email": "ketoan@example.com", "is_default": True},
            ],
        }
        res = self.client.post(self.url(), payload_valid, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res.data["contacts"]), 2)

        # Duplicate default for same contact_type
        payload_invalid = {
            "company": str(self.company_a.id),
            "code": "KH_CONTACT_02",
            "name": "Khách hàng Liên Hệ Trùng",
            "party_type": "ORGANIZATION",
            "legal_name": "Công ty Liên Hệ Trùng",
            "contacts": [
                {"contact_type": "BUSINESS", "contact_name": "Nguyễn Văn A", "is_default": True},
                {"contact_type": "BUSINESS", "contact_name": "Lê Văn C", "is_default": True},
            ],
        }
        res_inv = self.client.post(self.url(), payload_invalid, format="json")
        self.assertEqual(res_inv.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("contacts", res_inv.data)

    # -----------------------------------------------------------------
    # 6. CREDIT LIMIT AND CREDIT DAYS VALIDATIONS (BR-CUS-27, 28, 29, EF-09)
    # -----------------------------------------------------------------
    def test_06_credit_limit_and_credit_days_validation(self):
        """Hạn mức công nợ và số ngày thanh toán không được âm (BR-CUS-27, EF-09)."""
        # Negative credit days
        res1 = self.client.post(
            self.url(),
            {
                "company": str(self.company_a.id),
                "code": "KH_CREDIT_01",
                "name": "Khách hàng Âm Ngày",
                "party_type": "INDIVIDUAL",
                "profile": {"credit_days": -5},
            },
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Negative credit limit
        res2 = self.client.post(
            self.url(),
            {
                "company": str(self.company_a.id),
                "code": "KH_CREDIT_02",
                "name": "Khách hàng Âm Hạn Mức",
                "party_type": "INDIVIDUAL",
                "profile": {"credit_limit": "-1000000"},
            },
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # Zero credit limit (No credit / Cash only - BR-CUS-29)
        res3 = self.client.post(
            self.url(),
            {
                "company": str(self.company_a.id),
                "code": "KH_CREDIT_03",
                "name": "Khách hàng Không Bán Chịu",
                "party_type": "INDIVIDUAL",
                "profile": {"credit_limit": "0.0000", "credit_days": 0},
            },
            format="json",
        )
        self.assertEqual(res3.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res3.data["profile"]["credit_limit"], "0.0000")

    # -----------------------------------------------------------------
    # 7. ACCOUNTING GL ACCOUNTS VALIDATION (BR-CUS-24, EF-10)
    # -----------------------------------------------------------------
    def test_07_receivable_and_revenue_accounts_validation(self):
        """Tài khoản công nợ & doanh thu mặc định phải hoạt động và thuộc cùng doanh nghiệp (BR-CUS-24, EF-10)."""
        # Account from Company B should be rejected
        asset_class_b = AccountClass.objects.create(company=self.company_b, code="ASSET_B", name="Tài sản B", normal_balance="DEBIT")
        chart_b = ChartOfAccounts.objects.create(company=self.company_b, code="TT99_B", name="Hệ thống B", effective_from=timezone.localdate(), is_default=True)
        acc_b = Account.objects.create(
            company=self.company_b,
            chart_of_accounts=chart_b,
            account_class=asset_class_b,
            code="131_B",
            name="Phải thu Công ty B",
            account_type="ASSET",
            normal_balance="DEBIT",
            is_postable=True,
            status="ACTIVE",
        )
        res = self.client.post(
            self.url(),
            {
                "company": str(self.company_a.id),
                "code": "KH_ACC_01",
                "name": "Khách hàng Sai Tài Khoản",
                "party_type": "INDIVIDUAL",
                "profile": {"receivable_account": str(acc_b.id)},
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid Accounts from Company A
        res_valid = self.client.post(
            self.url(),
            {
                "company": str(self.company_a.id),
                "code": "KH_ACC_02",
                "name": "Khách hàng Đúng Tài Khoản",
                "party_type": "INDIVIDUAL",
                "profile": {
                    "receivable_account": str(self.receivable_acc.id),
                    "revenue_account": str(self.revenue_acc.id),
                },
            },
            format="json",
        )
        self.assertEqual(res_valid.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_valid.data["profile"]["receivable_account"], str(self.receivable_acc.id))

    # -----------------------------------------------------------------
    # 8. QUICK CREATE CUSTOMER (AF-01, BR-CUS-54, 55)
    # -----------------------------------------------------------------
    def test_08_quick_create_customer(self):
        """Tạo nhanh khách hàng trực tiếp từ màn hình lập chứng từ (AF-01, BR-CUS-54, 55)."""
        endpoint = self.url("quick-create/")
        payload = {
            "name": "Khách Mua Lẻ Nhanh",
            "party_type": "INDIVIDUAL",
            "phone": "0912345678",
            "address_line": "123 Phố Huế, Hà Nội",
        }
        res = self.client.post(endpoint, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["name"], "Khách Mua Lẻ Nhanh")
        self.assertTrue(res.data["code"].startswith("KH"))
        self.assertEqual(len(res.data["contacts"]), 1)
        self.assertEqual(len(res.data["addresses"]), 1)
        self.assertTrue(AuditLog.objects.filter(entity_id=res.data["id"], action_code="CUSTOMER_QUICK_CREATE").exists())

    # -----------------------------------------------------------------
    # 9. LOOKUP BUSINESS TAX INFO (AF-03, AF-04, BR-CUS-49, 50)
    # -----------------------------------------------------------------
    def test_09_lookup_business_tax_info(self):
        """Tra cứu thông tin thuế/pháp lý doanh nghiệp trực tuyến (AF-03, BR-CUS-49, 50)."""
        endpoint = self.url("lookup-tax-info/?tax_code=0101234567")
        res = self.client.get(endpoint)
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["tax_code"], "0101234567")
        self.assertIn("CÔNG TY CỔ PHẦN THƯƠNG MẠI", res.data["legal_name"])
        self.assertEqual(res.data["lookup_source"], "VIETNAM_TAX_REGISTRY")
        self.assertIsNotNone(res.data["lookup_at"])

        # Invalid tax code
        res_inv = self.client.get(self.url("lookup-tax-info/?tax_code=999"))
        self.assertEqual(res_inv.status_code, status.HTTP_400_BAD_REQUEST)

    # -----------------------------------------------------------------
    # 10. DUPLICATE DETECTION ADVANCED (AF-05, BR-CUS-08, 09)
    # -----------------------------------------------------------------
    def test_10_duplicate_detection_advanced(self):
        """Phát hiện trùng theo mã, MST, tên, điện thoại, email, CMND (AF-05, BR-CUS-08)."""
        # Create reference customer
        party = Party.objects.create(
            company=self.company_a,
            code="KH_DUP_SRC",
            name="Công ty Hoàng Long",
            legal_name="Công ty TNHH Thương mại Hoàng Long",
            tax_code="0107777888",
            identity_no="001090001234",
            status="ACTIVE",
        )
        PartyRole.objects.create(party=party, role_type="CUSTOMER", active_from=timezone.localdate())
        PartyContact.objects.create(party=party, contact_type="GENERAL", contact_name="Mr Long", phone="0988776655", email="long@hoanglong.vn")

        # 1. Search by tax_code
        res_tax = self.client.get(self.url("duplicates/?tax_code=0107777888"))
        self.assertEqual(len(res_tax.data), 1)
        self.assertEqual(res_tax.data[0]["id"], str(party.id))
        self.assertIn("EXACT_TAX_CODE", res_tax.data[0]["match_reasons"])

        # 2. Search by phone
        res_phone = self.client.get(self.url("duplicates/?phone=0988776655"))
        self.assertEqual(len(res_phone.data), 1)
        self.assertIn("MATCH_PHONE", res_phone.data[0]["match_reasons"])

        # 3. Search by identity_no
        res_id = self.client.get(self.url("duplicates/?identity_no=001090001234"))
        self.assertEqual(len(res_id.data), 1)
        self.assertIn("EXACT_IDENTITY", res_id.data[0]["match_reasons"])

    # -----------------------------------------------------------------
    # 11. MERGE CUSTOMERS SUCCESS (BR-CUS-38..42, AF-16)
    # -----------------------------------------------------------------
    def test_11_merge_customers_success_and_preserves_history(self):
        """Hợp nhất khách hàng nguồn vào đích, chuyển đổi địa chỉ/liên hệ và lưu vết (BR-CUS-38..42)."""
        # Create Target Customer
        target = Party.objects.create(
            company=self.company_a,
            code="KH_TARGET",
            name="Công ty Á Châu Đích",
            legal_name="Công ty TNHH Á Châu",
            tax_code="0103333444",
            status="ACTIVE",
        )
        PartyRole.objects.create(party=target, role_type="CUSTOMER", active_from=timezone.localdate())
        PartyAddress.objects.create(party=target, address_type="REGISTERED", address_line="Trụ sở Đích", is_default=True, status="ACTIVE")

        # Create Source Customer
        source = Party.objects.create(
            company=self.company_a,
            code="KH_SOURCE",
            name="Công ty Á Châu Nguồn",
            legal_name="Công ty CP Á Châu",
            tax_code="0103333444",  # Trùng MST cần hợp nhất
            status="ACTIVE",
        )
        PartyRole.objects.create(party=source, role_type="CUSTOMER", active_from=timezone.localdate())
        PartyAddress.objects.create(party=source, address_type="SHIPPING", address_line="Kho Nguồn", is_default=True, status="ACTIVE")
        PartyContact.objects.create(party=source, contact_type="GENERAL", contact_name="Liên Hệ Nguồn", phone="0911222333")

        # Execute Merge via API
        endpoint = self.url(f"{target.id}/merge/")
        payload = {
            "source_id": str(source.id),
            "reason": "Hai bản ghi bị tạo trùng do nhân viên chi nhánh nhập lặp",
            "conflict_resolutions": {"legal_name": "use_source"},
        }
        res = self.client.post(endpoint, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

        # Verify Target updated
        target.refresh_from_db()
        self.assertEqual(target.version, 2)
        self.assertEqual(target.legal_name, "Công ty CP Á Châu")  # Resolved from source
        self.assertEqual(target.addresses.count(), 2)  # Target addr + Source addr
        self.assertEqual(target.contacts.count(), 1)   # Source contact transferred

        # Verify Source marked as MERGED / INACTIVE
        source.refresh_from_db()
        self.assertEqual(source.status, "MERGED")
        self.assertEqual(source.merged_into_id, target.id)
        self.assertIsNotNone(source.merged_at)
        self.assertEqual(source.merged_by_id, self.admin.id)

        # Verify Audit Logs
        self.assertTrue(AuditLog.objects.filter(entity_id=source.id, action_code="CUSTOMER_MERGED_SOURCE").exists())
        self.assertTrue(AuditLog.objects.filter(entity_id=target.id, action_code="CUSTOMER_MERGED_TARGET").exists())

    # -----------------------------------------------------------------
    # 12. CANNOT MERGE ACROSS DIFFERENT COMPANIES (BR-CUS-41, EF-15)
    # -----------------------------------------------------------------
    def test_12_cannot_merge_across_different_companies(self):
        """Không được hợp nhất khách hàng thuộc hai doanh nghiệp khác nhau (BR-CUS-41, EF-15)."""
        target = Party.objects.create(
            company=self.company_a, code="KH_COMP_A", name="Khách A", status="ACTIVE"
        )
        PartyRole.objects.create(party=target, role_type="CUSTOMER", active_from=timezone.localdate())

        source_other_co = Party.objects.create(
            company=self.company_b, code="KH_COMP_B", name="Khách B", status="ACTIVE"
        )
        PartyRole.objects.create(party=source_other_co, role_type="CUSTOMER", active_from=timezone.localdate())

        endpoint = self.url(f"{target.id}/merge/")
        payload = {"source_id": str(source_other_co.id), "reason": "Thử hợp nhất liên công ty"}
        res = self.client.post(endpoint, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Hai khách hàng phải thuộc cùng một doanh nghiệp", str(res.data))

    # -----------------------------------------------------------------
    # 13. STATUS LIFECYCLE: INACTIVE, BLOCKED, ACTIVE (BR-CUS-15..18, 21, AF-11..13)
    # -----------------------------------------------------------------
    def test_13_status_lifecycle_inactive_and_blocked(self):
        """Quản lý vòng đời trạng thái: Ngừng sử dụng, Khóa giao dịch, Kích hoạt lại (BR-CUS-15..18)."""
        party = Party.objects.create(
            company=self.company_a,
            code="KH_STATUS_01",
            name="Khách hàng Vòng Đời",
            legal_name="Công ty Vòng Đời",
            status="ACTIVE",
        )
        PartyRole.objects.create(party=party, role_type="CUSTOMER", active_from=timezone.localdate())
        endpoint = self.url(f"{party.id}/set-status/")

        # 1. Chuyển sang INACTIVE mà thiếu lý do -> Bị từ chối
        res_no_reason = self.client.post(endpoint, {"status": "INACTIVE", "version": 1}, format="json")
        self.assertEqual(res_no_reason.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Chuyển sang INACTIVE có lý do -> Thành công (BR-CUS-16, 21)
        res_inactive = self.client.post(endpoint, {"status": "INACTIVE", "version": 1, "reason": "Hết hạn hợp đồng"}, format="json")
        self.assertEqual(res_inactive.status_code, status.HTTP_200_OK)
        party.refresh_from_db()
        self.assertEqual(party.status, "INACTIVE")
        self.assertTrue(AuditLog.objects.filter(entity_id=party.id, action_code="INACTIVE").exists())

        # 3. Chuyển sang BLOCKED (Khóa giao dịch - AF-12, BR-CUS-17)
        res_blocked = self.client.post(endpoint, {"status": "BLOCKED", "version": 2, "reason": "Nợ xấu quá hạn 90 ngày"}, format="json")
        self.assertEqual(res_blocked.status_code, status.HTTP_200_OK)
        party.refresh_from_db()
        self.assertEqual(party.status, "BLOCKED")
        self.assertTrue(AuditLog.objects.filter(entity_id=party.id, action_code="BLOCKED").exists())

        # 4. Kích hoạt lại (ACTIVE - AF-13)
        res_active = self.client.post(endpoint, {"status": "ACTIVE", "version": 3, "reason": "Đã thanh toán hết nợ quá hạn"}, format="json")
        self.assertEqual(res_active.status_code, status.HTTP_200_OK)
        party.refresh_from_db()
        self.assertEqual(party.status, "ACTIVE")

    # -----------------------------------------------------------------
    # 14. CANNOT HARD DELETE CUSTOMER WITH TRANSACTIONS (BR-CUS-19)
    # -----------------------------------------------------------------
    def test_14_cannot_hard_delete_customer_with_transactions(self):
        """Khách hàng đã phát sinh chứng từ tuyệt đối không được xóa cứng (BR-CUS-19)."""
        party = Party.objects.create(
            company=self.company_a,
            code="KH_TRANS_01",
            name="Khách Đã Mua Hàng",
            status="ACTIVE",
        )
        PartyRole.objects.create(party=party, role_type="CUSTOMER", active_from=timezone.localdate())

        # Tạo giả lập chứng từ bán hàng liên kết
        from sales.models import SalesOrder
        SalesOrder.objects.create(
            company=self.company_a,
            branch=self.branch_a1,
            order_number="SO_TEST_001",
            order_date=timezone.localdate(),
            currency=self.currency,
            customer=party,
            created_by=self.admin,
        )

        can_del, reason = check_customer_can_be_deleted(party)
        self.assertFalse(can_del)
        self.assertIn("BR-CUS-19", reason)

        # Call DELETE API
        res = self.client.delete(self.url(f"{party.id}/"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Party.objects.filter(pk=party.id).exists())

    # -----------------------------------------------------------------
    # 15. HARD DELETE CUSTOMER WITHOUT TRANSACTIONS (BR-CUS-20)
    # -----------------------------------------------------------------
    def test_15_hard_delete_customer_without_transactions(self):
        """Khách hàng chưa phát sinh chứng từ được phép xóa cứng kèm Audit Log (BR-CUS-20, 58)."""
        party = Party.objects.create(
            company=self.company_a,
            code="KH_NO_TRANS",
            name="Khách Tạo Nhầm Chưa Giao Dịch",
            status="ACTIVE",
        )
        PartyRole.objects.create(party=party, role_type="CUSTOMER", active_from=timezone.localdate())
        PartyAddress.objects.create(party=party, address_type="REGISTERED", address_line="Địa chỉ tạm")

        can_del, reason = check_customer_can_be_deleted(party)
        self.assertTrue(can_del)

        res = self.client.delete(self.url(f"{party.id}/"))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Party.objects.filter(pk=party.id).exists())
        self.assertTrue(AuditLog.objects.filter(action_code="CUSTOMER_DELETE", resource_code="KH_NO_TRANS").exists())

    # -----------------------------------------------------------------
    # 16. DUAL ROLE: CUSTOMER AND VENDOR ON SAME PARTY (AF-17, BR-CUS-36, 37)
    # -----------------------------------------------------------------
    def test_16_dual_role_customer_and_vendor(self):
        """Một đối tượng có thể vừa là Khách hàng vừa là Nhà cung cấp mà không bị nhân bản (AF-17, BR-CUS-36)."""
        party = Party.objects.create(
            company=self.company_a,
            code="PARTNER_DUAL",
            name="Đối tác Song Hành",
            legal_name="Công ty Song Hành",
            tax_code="0106666777",
            status="ACTIVE",
        )
        PartyRole.objects.create(party=party, role_type="CUSTOMER", active_from=timezone.localdate())
        PartyRole.objects.create(party=party, role_type="VENDOR", active_from=timezone.localdate())

        self.assertEqual(party.roles.count(), 2)
        roles = list(party.roles.values_list("role_type", flat=True))
        self.assertIn("CUSTOMER", roles)
        self.assertIn("VENDOR", roles)

        # Appeared in customer list endpoint
        res = self.client.get(self.url())
        customer_ids = [item["id"] for item in res.data]
        self.assertIn(str(party.id), customer_ids)

    # -----------------------------------------------------------------
    # 17. CONCURRENCY CONTROL VIA VERSION (BR-CUS-56, EF-12)
    # -----------------------------------------------------------------
    def test_17_concurrency_control_version(self):
        """Kiểm soát cập nhật đồng thời qua trường version (BR-CUS-56, EF-12)."""
        party = Party.objects.create(
            company=self.company_a,
            code="KH_CONCURRENCY",
            name="Tên Ban Đầu",
            status="ACTIVE",
            version=1,
        )
        PartyRole.objects.create(party=party, role_type="CUSTOMER", active_from=timezone.localdate())

        # First update succeeds and increments version to 2
        res1 = self.client.patch(self.url(f"{party.id}/"), {"name": "Sửa Lần 1", "version": 1}, format="json")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data["version"], 2)

        # Second update using stale version 1 fails (EF-12)
        res2 = self.client.patch(self.url(f"{party.id}/"), {"name": "Sửa Lần 2 Xung Đột", "version": 1}, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("version", res2.data)

    # -----------------------------------------------------------------
    # 18. DATA SCOPE ISOLATION (BR-CUS-33..35, EF-01, EF-02)
    # -----------------------------------------------------------------
    def test_18_data_scope_and_permission_isolation(self):
        """Data Scope giới hạn quyền xem và sửa khách hàng theo chi nhánh / người phụ trách (BR-CUS-33..35)."""
        # Customer in Branch HCM
        cust_hcm = Party.objects.create(
            company=self.company_a, branch=self.branch_a1, code="KH_HCM", name="Khách HCM", status="ACTIVE"
        )
        PartyRole.objects.create(party=cust_hcm, role_type="CUSTOMER", active_from=timezone.localdate())

        # Customer in Branch HN
        cust_hn = Party.objects.create(
            company=self.company_a, branch=self.branch_a2, code="KH_HN", name="Khách HN", status="ACTIVE"
        )
        PartyRole.objects.create(party=cust_hn, role_type="CUSTOMER", active_from=timezone.localdate())

        # Assign Clerk to only Branch HCM
        clerk_role = Role.objects.create(company=self.company_a, code="CLERK_ROLE", name="Clerk Role")
        for perm_code in ("MD.PARTY.VIEW", "MD.PARTY.CREATE", "MD.PARTY.EDIT"):
            p = Permission.objects.get(code=perm_code)
            RolePermission.objects.create(role=clerk_role, permission=p)

        scope_hcm = DataScopeSet.objects.create(
            company=self.company_a, code="SCOPE_HCM", name="Chỉ xem HCM", allow_all_company_data=False, created_by=self.admin
        )
        DataScopeBranch.objects.create(data_scope_set=scope_hcm, branch=self.branch_a1)

        UserRoleAssignment.objects.create(
            company_membership=self.membership_clerk,
            role=clerk_role,
            data_scope_set=scope_hcm,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now(),
            assigned_by=self.admin,
        )

        # Authenticate as Clerk
        self.client.force_authenticate(self.clerk_auth)

        # Clerk lists customers: only sees cust_hcm
        res = self.client.get(self.url())
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_ids = [item["id"] for item in res.data]
        self.assertIn(str(cust_hcm.id), returned_ids)
        self.assertNotIn(str(cust_hn.id), returned_ids)

        # Clerk accesses cust_hn directly -> 404 / 403 (BR-CUS-35)
        res_hn = self.client.get(self.url(f"{cust_hn.id}/"))
        self.assertEqual(res_hn.status_code, status.HTTP_404_NOT_FOUND)
