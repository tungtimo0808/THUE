from datetime import timedelta
import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import (
    ActiveStatus,
    CompanyMembership,
    DataScopeSet,
    Permission,
    PermissionAction,
    PermissionResource,
    Role,
    RolePermission,
    UserAccount,
    UserRoleAssignment,
)
from master_data.models import Currency
from organization.models import Company, CompanyStatus

from .models import (
    CompanyModuleConfig,
    CoreCompanySetting,
    ModuleCatalog,
    ModuleCategory,
    ModuleStatus,
)
from .module_services import (
    check_module_active,
    disable_module,
    enable_module,
    get_module_detail,
    list_modules,
    module_impact_summary,
    sync_company_enabled_modules,
    synchronize_scheduled_modules,
    update_module_config,
)


class ModuleConfigurationTests(TestCase):
    def setUp(self):
        cache.clear()
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.client = APIClient()

        # Create active company
        self.company = Company.objects.create(
            code="COMP_TEST",
            name="Công ty Cổ phần Thử nghiệm",
            legal_name="Công ty Cổ phần Thử nghiệm",
            tax_code="0109998888",
            business_type="LLC_ONE_MEMBER",
            accounting_currency=currency,
            legal_reporting_currency=currency,
            status=CompanyStatus.ACTIVE,
        )

        # Create Admin Auth User and IAM UserAccount
        User = get_user_model()
        self.auth_admin = User.objects.create_user(
            username="admin_user",
            email="admin@test.com",
            password="StrongPass!2026",
            is_active=True,
        )
        self.admin_account, _ = UserAccount.objects.get_or_create(
            auth_user=self.auth_admin,
            defaults={"display_name": "Admin Test"},
        )
        self.admin_membership = CompanyMembership.objects.create(
            company=self.company,
            user=self.admin_account,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.admin_account,
        )

        # Initialize company setting and GL module configuration
        gl_catalog = ModuleCatalog.objects.get(code="GL")
        CompanyModuleConfig.objects.create(
            company=self.company,
            module=gl_catalog,
            status=ModuleStatus.ENABLED,
            version=1,
            updated_by=self.admin_account,
        )
        sync_company_enabled_modules(self.company)
        self.setting, _ = CoreCompanySetting.objects.get_or_create(company=self.company)

        # Create Admin Role with SYS.MODULE.VIEW and SYS.MODULE.CONFIGURE permissions
        self.admin_role = Role.objects.create(
            company=self.company,
            code="MODULE_ADMIN",
            name="Quản trị phân hệ",
            status="ACTIVE",
            is_system_admin=True,
            created_by=self.admin_account,
        )
        view_perm = Permission.objects.filter(code="SYS.MODULE.VIEW").first()
        cfg_perm = Permission.objects.filter(code="SYS.MODULE.CONFIGURE").first()
        if view_perm:
            RolePermission.objects.get_or_create(role=self.admin_role, permission=view_perm, defaults={"effect": "ALLOW"})
        if cfg_perm:
            RolePermission.objects.get_or_create(role=self.admin_role, permission=cfg_perm, defaults={"effect": "ALLOW"})

        UserRoleAssignment.objects.create(
            company_membership=self.admin_membership,
            role=self.admin_role,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.admin_account,
        )

        # Create regular user without configure permission
        self.auth_regular = User.objects.create_user(
            username="regular_user",
            email="regular@test.com",
            password="StrongPass!2026",
            is_active=True,
        )
        self.regular_account, _ = UserAccount.objects.get_or_create(
            auth_user=self.auth_regular,
            defaults={"display_name": "Regular Test"},
        )
        self.regular_membership = CompanyMembership.objects.create(
            company=self.company,
            user=self.regular_account,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.admin_account,
        )
        self.viewer_role = Role.objects.create(
            company=self.company,
            code="MODULE_VIEWER",
            name="Xem phân hệ",
            status="ACTIVE",
            created_by=self.admin_account,
        )
        if view_perm:
            RolePermission.objects.get_or_create(role=self.viewer_role, permission=view_perm, defaults={"effect": "ALLOW"})
        UserRoleAssignment.objects.create(
            company_membership=self.regular_membership,
            role=self.viewer_role,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.admin_account,
        )

    def test_01_module_catalog_listing(self):
        """Test API listing returns all catalog items with company configuration status (BR-MOD-06, 07)."""
        self.client.force_authenticate(self.auth_admin)
        response = self.client.get(f"/api/v1/common/modules/?company_id={self.company.id}")
        self.assertEqual(response.status_code, 200, response.data)
        codes = [item["code"] for item in response.data]
        self.assertIn("SYS", codes)
        self.assertIn("COM", codes)
        self.assertIn("MD", codes)
        self.assertIn("GL", codes)
        self.assertIn("PUR", codes)
        self.assertIn("AP", codes)
        self.assertIn("INV", codes)
        self.assertIn("WF", codes)
        self.assertIn("AI", codes)

        # SYSTEM_REQUIRED modules should have status ENABLED by default
        sys_mod = next(item for item in response.data if item["code"] == "SYS")
        self.assertEqual(sys_mod["status"], ModuleStatus.ENABLED)
        self.assertEqual(sys_mod["category"], ModuleCategory.SYSTEM_REQUIRED)

        # Unconfigured optional modules should be NOT_CONFIGURED
        inv_mod = next(item for item in response.data if item["code"] == "INV")
        self.assertEqual(inv_mod["status"], ModuleStatus.NOT_CONFIGURED)

    def test_02_module_detail_and_dependencies(self):
        """Test module detail returns dependency satisfaction and impact info."""
        self.client.force_authenticate(self.auth_admin)
        # PUR depends on GL and AP
        # Initially, GL is in setting, but AP is not configured yet
        response = self.client.get(f"/api/v1/common/modules/PUR/?company_id={self.company.id}")
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual(data["code"], "PUR")
        self.assertEqual(data["category"], ModuleCategory.OPTIONAL)
        self.assertIn("dependencies", data)

        dep_codes = {d["code"]: d["is_satisfied"] for d in data["dependencies"]}
        self.assertIn("GL", dep_codes)
        self.assertIn("AP", dep_codes)
        self.assertFalse(dep_codes["AP"])  # AP not active yet

    def test_03_enable_module_dependency_check(self):
        """Enabling module without satisfied dependencies must fail (BR-MOD-08, EF-03, AF-02)."""
        self.client.force_authenticate(self.auth_admin)
        # Attempt to enable PUR while AP is disabled
        response = self.client.post(
            "/api/v1/common/modules/PUR/enable/",
            {"company": str(self.company.id), "notes": "Thử bật PUR"},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("dependencies", str(response.data))

    def test_04_enable_module_success(self):
        """Enabling module with satisfied dependencies transitions to ENABLED and updates settings (Main Flow 2.1)."""
        self.client.force_authenticate(self.auth_admin)
        # 1. Enable AP first (depends on GL, which is active)
        resp_ap = self.client.post(
            "/api/v1/common/modules/AP/enable/",
            {"company": str(self.company.id), "notes": "Kích hoạt AP"},
            format="json",
        )
        self.assertEqual(resp_ap.status_code, 200, resp_ap.data)
        self.assertEqual(resp_ap.data["data"]["status"], ModuleStatus.ENABLED)
        self.assertTrue(check_module_active(self.company, "AP"))

        # 2. Now enable PUR (depends on GL and AP)
        resp_pur = self.client.post(
            "/api/v1/common/modules/PUR/enable/",
            {"company": str(self.company.id), "configuration": {"auto_po": True}, "notes": "Kích hoạt PUR"},
            format="json",
        )
        self.assertEqual(resp_pur.status_code, 200, resp_pur.data)
        self.assertEqual(resp_pur.data["data"]["status"], ModuleStatus.ENABLED)
        self.assertTrue(check_module_active(self.company, "PUR"))

        # Check CoreCompanySetting synchronization (BR-MOD-15, 16)
        self.setting.refresh_from_db()
        enabled_modules = self.setting.configuration.get("enabled_modules", [])
        self.assertIn("AP", enabled_modules)
        self.assertIn("PUR", enabled_modules)

        # Check Audit Log (BR-MOD-41, BR-MOD-42)
        audit_log = AuditLog.objects.filter(
            company=self.company,
            module_code="SYS",
            action_code="MODULE_ENABLE",
        ).order_by("-occurred_at").first()
        self.assertIsNotNone(audit_log)
        mod_change = audit_log.changes.filter(field_name="module").first()
        self.assertEqual(mod_change.new_value_json, "PUR")

    def test_05_enable_future_effective_date(self):
        """Module with future effective_from enters ENABLING state (AF-03, BR-MOD-35)."""
        self.client.force_authenticate(self.auth_admin)
        tomorrow = timezone.localdate() + timedelta(days=2)
        resp = self.client.post(
            "/api/v1/common/modules/CASH/enable/",
            {"company": str(self.company.id), "effective_from": str(tomorrow)},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["data"]["status"], ModuleStatus.ENABLING)
        # Should not be active today
        self.assertFalse(check_module_active(self.company, "CASH"))

        # Advance effective date and run synchronization
        config = CompanyModuleConfig.objects.get(company=self.company, module_id="CASH")
        config.effective_from = timezone.localdate() - timedelta(days=1)
        config.save()
        synchronize_scheduled_modules(self.company)

        self.assertTrue(check_module_active(self.company, "CASH"))
        config.refresh_from_db()
        self.assertEqual(config.status, ModuleStatus.ENABLED)

    def test_06_disable_system_required_blocked(self):
        """Disabling SYSTEM_REQUIRED module must be rejected (BR-MOD-03, EF-08)."""
        self.client.force_authenticate(self.auth_admin)
        response = self.client.post(
            "/api/v1/common/modules/SYS/disable/",
            {"company": str(self.company.id), "reason": "Thử ngừng SYS"},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("nền tảng bắt buộc", str(response.data))

    def test_07_disable_without_reason_blocked(self):
        """Disabling without a reason must be rejected (EF-04, BR-MOD-42)."""
        self.client.force_authenticate(self.auth_admin)
        # Enable CASH first
        enable_module(self.company, "CASH", self.admin_account)
        response = self.client.post(
            "/api/v1/common/modules/CASH/disable/",
            {"company": str(self.company.id), "reason": ""},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("reason", response.data)

    def test_08_disable_with_active_dependents_blocked(self):
        """Cannot disable a module if other active modules depend on it (BR-MOD-10, EF-09)."""
        self.client.force_authenticate(self.auth_admin)
        enable_module(self.company, "AP", self.admin_account)
        enable_module(self.company, "PUR", self.admin_account)

        # Attempt to disable AP while PUR is enabled
        response = self.client.post(
            "/api/v1/common/modules/AP/disable/",
            {"company": str(self.company.id), "reason": "Tạm ngừng AP"},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("dependencies", str(response.data))
        self.assertIn("PUR", str(response.data))

    def test_09_disable_module_success(self):
        """Disabling module successfully preserves historical data and records audit log (Main Flow 2.2)."""
        self.client.force_authenticate(self.auth_admin)
        enable_module(self.company, "CASH", self.admin_account)
        self.assertTrue(check_module_active(self.company, "CASH"))

        response = self.client.post(
            "/api/v1/common/modules/CASH/disable/",
            {
                "company": str(self.company.id),
                "reason": "Doanh nghiệp không dùng tiền mặt, chuyển 100% tài khoản ngân hàng.",
                "notes": "Chính sách Q4",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"]["status"], ModuleStatus.DISABLED)
        self.assertFalse(check_module_active(self.company, "CASH"))

        # Verify setting sync
        self.setting.refresh_from_db()
        self.assertNotIn("CASH", self.setting.configuration.get("enabled_modules", []))

        # Check Audit Log (BR-MOD-41, BR-MOD-42)
        audit_log = AuditLog.objects.filter(
            company=self.company,
            module_code="SYS",
            action_code="MODULE_DISABLE",
        ).order_by("-occurred_at").first()
        self.assertIsNotNone(audit_log)
        mod_change = audit_log.changes.filter(field_name="module").first()
        self.assertEqual(mod_change.new_value_json, "CASH")
        reason_change = audit_log.changes.filter(field_name="reason").first()
        self.assertIn("Doanh nghiệp không dùng tiền mặt", reason_change.new_value_json)

    def test_10_disable_future_effective_date(self):
        """Module with future effective_to remains ENABLED until that date (AF-09, BR-MOD-36)."""
        self.client.force_authenticate(self.auth_admin)
        enable_module(self.company, "BANK", self.admin_account)
        future_date = timezone.localdate() + timedelta(days=7)

        resp = self.client.post(
            "/api/v1/common/modules/BANK/disable/",
            {
                "company": str(self.company.id),
                "reason": "Dự kiến đóng tài khoản cuối tuần sau",
                "effective_to": str(future_date),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        # Should still be active until effective_to
        self.assertTrue(check_module_active(self.company, "BANK"))
        config = CompanyModuleConfig.objects.get(company=self.company, module_id="BANK")
        self.assertEqual(config.status, ModuleStatus.ENABLED)

        # Advance date and trigger sync
        config.effective_to = timezone.localdate() - timedelta(days=1)
        config.save()
        synchronize_scheduled_modules(self.company)

        self.assertFalse(check_module_active(self.company, "BANK"))
        config.refresh_from_db()
        self.assertEqual(config.status, ModuleStatus.DISABLED)

    def test_11_update_module_configuration(self):
        """Updating module config updates settings without changing enabled status (AF-05, AF-13)."""
        self.client.force_authenticate(self.auth_admin)
        enable_module(self.company, "AI", self.admin_account)

        response = self.client.patch(
            "/api/v1/common/modules/AI/config/",
            {
                "company": str(self.company.id),
                "configuration": {"max_tokens": 4096, "model": "gemini-pro"},
                "notes": "Cập nhật quota AI",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["data"]["configuration"]["max_tokens"], 4096)
        self.assertEqual(response.data["data"]["status"], ModuleStatus.ENABLED)

    def test_12_optimistic_locking_concurrency(self):
        """Version mismatch must be rejected with error (BR-MOD-40, EF-12)."""
        self.client.force_authenticate(self.auth_admin)
        cfg = enable_module(self.company, "CASH", self.admin_account)
        current_version = cfg.version

        # Another user updates config first
        update_module_config(self.company, "CASH", self.admin_account, notes="Edit 1")

        # Now attempt to disable with old version
        response = self.client.post(
            "/api/v1/common/modules/CASH/disable/",
            {
                "company": str(self.company.id),
                "reason": "Ngừng sử dụng",
                "version": current_version,  # Stale version
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("version", response.data)

    def test_13_permissions_enforcement(self):
        """User without configure permission cannot enable/disable modules (EF-01, BR-MOD-02)."""
        self.client.force_authenticate(self.auth_regular)
        # Viewer can GET list
        resp_list = self.client.get(f"/api/v1/common/modules/?company_id={self.company.id}")
        self.assertEqual(resp_list.status_code, 200)

        # Viewer cannot POST enable
        resp_enable = self.client.post(
            "/api/v1/common/modules/INV/enable/",
            {"company": str(self.company.id)},
            format="json",
        )
        self.assertEqual(resp_enable.status_code, 403)

        # Viewer cannot POST disable
        resp_disable = self.client.post(
            "/api/v1/common/modules/GL/disable/",
            {"company": str(self.company.id), "reason": "test"},
            format="json",
        )
        self.assertEqual(resp_disable.status_code, 403)

    def test_14_historical_data_lookup_preserved(self):
        """Permissions for disabled modules allow VIEW but block mutating actions (BR-MOD-20, 21, 22)."""
        from iam.permissions import has_effective_permission

        # Create action VIEW and action CREATE for INV module
        act_view, _ = PermissionAction.objects.get_or_create(code="VIEW", defaults={"name": "Xem", "risk_level": "NORMAL"})
        act_create, _ = PermissionAction.objects.get_or_create(code="CREATE", defaults={"name": "Tạo", "risk_level": "NORMAL"})
        res_inv, _ = PermissionResource.objects.get_or_create(code="INV.TRANSACTION", defaults={
            "module_code": "INV", "name": "Chứng từ kho", "status": "ACTIVE"
        })
        p_view, _ = Permission.objects.get_or_create(code="INV.TRANSACTION.VIEW", defaults={
            "resource": res_inv, "action": act_view, "status": "ACTIVE"
        })
        p_create, _ = Permission.objects.get_or_create(code="INV.TRANSACTION.CREATE", defaults={
            "resource": res_inv, "action": act_create, "status": "ACTIVE"
        })

        # Assign both permissions to admin_role
        RolePermission.objects.get_or_create(role=self.admin_role, permission=p_view, defaults={"effect": "ALLOW"})
        RolePermission.objects.get_or_create(role=self.admin_role, permission=p_create, defaults={"effect": "ALLOW"})

        # Case A: INV is disabled
        sync_company_enabled_modules(self.company)
        self.assertNotIn("INV", self.setting.configuration.get("enabled_modules", []))

        # User CAN view historical data
        self.assertTrue(has_effective_permission(self.admin_account, self.company, "INV.TRANSACTION.VIEW"))
        # User CANNOT create new transactions
        self.assertFalse(has_effective_permission(self.admin_account, self.company, "INV.TRANSACTION.CREATE"))

        # Case B: INV is enabled
        enable_module(self.company, "INV", self.admin_account)
        self.assertTrue(has_effective_permission(self.admin_account, self.company, "INV.TRANSACTION.VIEW"))
        self.assertTrue(has_effective_permission(self.admin_account, self.company, "INV.TRANSACTION.CREATE"))

    def test_15_impact_summary_api(self):
        """Impact summary API returns active dependent modules and historical metrics (Main Flow 2.2)."""
        self.client.force_authenticate(self.auth_admin)
        enable_module(self.company, "AP", self.admin_account)
        enable_module(self.company, "PUR", self.admin_account)

        response = self.client.get(f"/api/v1/common/modules/AP/impact/?company_id={self.company.id}")
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual(data["module_code"], "AP")
        self.assertFalse(data["can_disable"])  # Because PUR is active and depends on AP
        dep_codes = [m["code"] for m in data["active_dependent_modules"]]
        self.assertIn("PUR", dep_codes)

    def test_16_inactive_company_rejected(self):
        """Operations on inactive company must be rejected."""
        self.company.status = CompanyStatus.INACTIVE
        self.company.save()

        self.client.force_authenticate(self.auth_admin)
        response = self.client.get(f"/api/v1/common/modules/?company_id={self.company.id}")
        self.assertEqual(response.status_code, 400)
        self.assertIn("ngừng hoạt động", str(response.data))

    def test_17_module_not_found_ef02(self):
        """Non-existent module in catalog returns error (EF-02)."""
        self.client.force_authenticate(self.auth_admin)
        resp_detail = self.client.get(f"/api/v1/common/modules/UNKNOWN_MOD/?company_id={self.company.id}")
        self.assertEqual(resp_detail.status_code, 400)

        resp_enable = self.client.post(
            "/api/v1/common/modules/UNKNOWN_MOD/enable/",
            {"company": str(self.company.id)},
            format="json",
        )
        self.assertEqual(resp_enable.status_code, 400)

    def test_18_ai_assisted_module_enabling_and_toggling(self):
        """AI module can be enabled and disabled independently without breaking core (AF-15, AF-16, BR-MOD-30, 31)."""
        self.client.force_authenticate(self.auth_admin)
        # Enable AI
        resp_ai = self.client.post(
            "/api/v1/common/modules/AI/enable/",
            {"company": str(self.company.id), "configuration": {"auto_extract": True}},
            format="json",
        )
        self.assertEqual(resp_ai.status_code, 200)
        self.assertTrue(check_module_active(self.company, "AI"))
        self.setting.refresh_from_db()
        self.assertTrue(self.setting.ai_enabled)

        # Disable AI
        resp_disable = self.client.post(
            "/api/v1/common/modules/AI/disable/",
            {"company": str(self.company.id), "reason": "Tạm dừng dùng AI trong tháng này"},
            format="json",
        )
        self.assertEqual(resp_disable.status_code, 200)
        self.assertFalse(check_module_active(self.company, "AI"))
        self.setting.refresh_from_db()
        self.assertFalse(self.setting.ai_enabled)
        # Core GL is still active
        self.assertTrue(check_module_active(self.company, "GL"))

