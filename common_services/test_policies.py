from datetime import date, timedelta
from decimal import Decimal
import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from general_ledger.models import AccountingPeriod as GLPeriod, JournalEntry, JournalStatus
from iam.models import (
    ActiveStatus,
    CompanyMembership,
    Permission,
    Role,
    RolePermission,
    UserAccount,
    UserRoleAssignment,
)
from master_data.models import Currency
from organization.models import Branch, Company, CompanyStatus

from .models import (
    AccountingBasis,
    AccountingPolicy,
    AccountingRegime,
    CompanyModuleConfig,
    DebtTrackingMethod,
    DepreciationMethod,
    ExchangeRateSource,
    FiscalPeriod,
    FiscalPeriodStatus,
    FiscalPeriodType,
    FiscalYear,
    FiscalYearStatus,
    FiscalYearType,
    InventoryMethod,
    InventoryValuationMethod,
    ModuleCatalog,
    ModuleStatus,
    PeriodStructure,
    PolicyScope,
    PolicyStatus,
    PostingMode,
    RoundingMethod,
    TaxCalculationMethod,
)
from .policy_services import (
    activate_accounting_policy,
    analyze_policy_impact,
    approve_accounting_policy,
    copy_policy_template,
    create_accounting_policy,
    create_default_accounting_policy_for_company,
    create_new_policy_version,
    resolve_effective_policy,
    update_draft_policy,
)


class AccountingPolicyTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.usd, _ = Currency.objects.get_or_create(code="USD", defaults={"name": "Đô la Mỹ"})

        # 1. Company
        self.company = Company.objects.create(
            code="COMP_POL_TEST",
            name="Công ty Kiểm thử Chính sách Kế toán",
            legal_name="Công ty Kiểm thử Chính sách Kế toán",
            tax_code="0108889999",
            business_type="LLC_ONE_MEMBER",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
            status=CompanyStatus.ACTIVE,
        )

        # 2. Branch
        self.branch = Branch.objects.create(
            company=self.company,
            code="BR_HN",
            name="Chi nhánh Hà Nội",
        )

        # 3. Admin Auth User & IAM Account
        User = get_user_model()
        self.auth_admin = User.objects.create_user(
            username="pol_admin_user",
            email="pol_admin@test.com",
            password="StrongPass!2026",
            is_active=True,
        )
        self.admin_account, _ = UserAccount.objects.get_or_create(
            auth_user=self.auth_admin,
            defaults={"display_name": "Admin Chính sách"},
        )
        self.admin_membership = CompanyMembership.objects.create(
            company=self.company,
            user=self.admin_account,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.admin_account,
        )

        # Admin Role with SYS.POLICY permissions
        self.admin_role = Role.objects.create(
            company=self.company,
            code="POL_ADMIN",
            name="Quản trị Chính sách Kế toán",
            status="ACTIVE",
            is_system_admin=True,
            created_by=self.admin_account,
        )
        for p_code in ["SYS.POLICY.VIEW", "SYS.POLICY.CONFIGURE", "SYS.POLICY.APPROVE"]:
            perm = Permission.objects.filter(code=p_code).first()
            if perm:
                RolePermission.objects.get_or_create(role=self.admin_role, permission=perm, defaults={"effect": "ALLOW"})

        UserRoleAssignment.objects.create(
            company_membership=self.admin_membership,
            role=self.admin_role,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.admin_account,
        )

        # 4. Fiscal Year & Periods (Period 1 current, Period 2 future)
        self.fiscal_year = FiscalYear.objects.create(
            company=self.company,
            code="FY2026",
            name="Năm tài chính 2026",
            year_type=FiscalYearType.CALENDAR_YEAR,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            period_structure=PeriodStructure.MONTHLY,
            status=FiscalYearStatus.ACTIVE,
            created_by=self.admin_account,
        )

        # Current period (assumed containing today or past)
        self.period1 = FiscalPeriod.objects.create(
            fiscal_year=self.fiscal_year,
            company=self.company,
            code="2026-M01",
            name="Tháng 01/2026",
            period_number=1,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            period_type=FiscalPeriodType.MONTH,
            status=FiscalPeriodStatus.OPEN,
        )

        # Future period
        future_start = timezone.localdate() + timedelta(days=30)
        future_end = future_start + timedelta(days=30)
        self.period_future = FiscalPeriod.objects.create(
            fiscal_year=self.fiscal_year,
            company=self.company,
            code="2026-FUT",
            name="Kỳ tương lai",
            period_number=2,
            start_date=future_start,
            end_date=future_end,
            period_type=FiscalPeriodType.MONTH,
            status=FiscalPeriodStatus.FUTURE,
        )

        # 5. Viewer User with VIEW only permission
        self.auth_viewer = User.objects.create_user(
            username="pol_viewer_user",
            email="pol_viewer@test.com",
            password="StrongPass!2026",
            is_active=True,
        )
        self.viewer_account, _ = UserAccount.objects.get_or_create(
            auth_user=self.auth_viewer,
            defaults={"display_name": "Viewer Chính sách"},
        )
        self.viewer_membership = CompanyMembership.objects.create(
            company=self.company,
            user=self.viewer_account,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.admin_account,
        )
        self.viewer_role = Role.objects.create(
            company=self.company,
            code="POL_VIEWER",
            name="Người xem chính sách",
            status="ACTIVE",
            created_by=self.admin_account,
        )
        view_perm = Permission.objects.filter(code="SYS.POLICY.VIEW").first()
        if view_perm:
            RolePermission.objects.get_or_create(role=self.viewer_role, permission=view_perm, defaults={"effect": "ALLOW"})

        UserRoleAssignment.objects.create(
            company_membership=self.viewer_membership,
            role=self.viewer_role,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.admin_account,
        )

    # 1. Create Policy Draft
    def test_01_create_policy_draft_success(self):
        """Create draft policy, check initial status, snapshot and audit log (Steps 1-15, BR-POL-01..04)."""
        data = {
            "code": "POL_2026_STD",
            "name": "Chính sách kế toán chuẩn 2026",
            "scope": PolicyScope.COMPANY,
            "effective_from_period": self.period1,
            "accounting_regime": AccountingRegime.CIRCULAR_200,
            "accounting_basis": AccountingBasis.ACCRUAL,
            "accounting_currency": self.vnd,
            "inventory_valuation": InventoryValuationMethod.WEIGHTED_AVERAGE,
            "amount_decimals": 0,
            "unit_price_decimals": 2,
            "quantity_decimals": 2,
            "rounding_method": RoundingMethod.HALF_UP,
        }
        policy = create_accounting_policy(self.company, data, self.auth_admin)

        self.assertEqual(policy.code, "POL_2026_STD")
        self.assertEqual(policy.version, 1)
        self.assertEqual(policy.status, PolicyStatus.DRAFT)
        self.assertIsNotNone(policy.config_snapshot)
        self.assertEqual(policy.config_snapshot["code"], "POL_2026_STD")
        self.assertEqual(policy.config_snapshot["accounting_regime"], AccountingRegime.CIRCULAR_200)

        # Audit log verified (BR-POL-57)
        self.assertTrue(
            AuditLog.objects.filter(company=self.company, action_code="POLICY_CREATE", entity_id=policy.id).exists()
        )

    # 2. Duplicate Code
    def test_02_create_policy_duplicate_code_fails(self):
        """Cannot create duplicate policy code in the same company (BR-POL-03, EF-02)."""
        data = {
            "code": "POL_DUP",
            "name": "Chính sách 1",
            "effective_from_period": self.period1,
        }
        create_accounting_policy(self.company, data, self.auth_admin)

        with self.assertRaises(ValidationError) as ctx:
            create_accounting_policy(self.company, data, self.auth_admin)
        self.assertIn("code", ctx.exception.detail)

    # 3. Update Draft Policy
    def test_03_update_draft_policy(self):
        """Update draft policy updates values and refreshes config snapshot (AF-13, BR-POL-07)."""
        policy = create_accounting_policy(
            self.company,
            {"code": "POL_DRAFT_EDIT", "name": "Bản nháp 1", "effective_from_period": self.period1},
            self.auth_admin,
        )
        updated = update_draft_policy(
            policy,
            {
                "name": "Bản nháp đã sửa",
                "inventory_valuation": InventoryValuationMethod.FIFO,
                "amount_decimals": 2,
            },
            self.auth_admin,
        )
        self.assertEqual(updated.name, "Bản nháp đã sửa")
        self.assertEqual(updated.inventory_valuation, InventoryValuationMethod.FIFO)
        self.assertEqual(updated.amount_decimals, 2)
        self.assertEqual(updated.config_snapshot["inventory_valuation"], InventoryValuationMethod.FIFO)

    # 4. Cannot Update Active Policy Directly
    def test_04_cannot_update_active_policy_directly(self):
        """Active policy is immutable and cannot be updated directly (BR-POL-07, AF-13)."""
        policy = create_accounting_policy(
            self.company,
            {"code": "POL_ACTIVE_LOCK", "name": "Chính sách Khóa", "effective_from_period": self.period1},
            self.auth_admin,
        )
        activate_accounting_policy(policy, self.auth_admin, skip_approval=True)
        self.assertEqual(policy.status, PolicyStatus.ACTIVE)

        with self.assertRaises(ValidationError):
            update_draft_policy(policy, {"name": "Sửa trái phép"}, self.auth_admin)

    # 5. Create New Version
    def test_05_create_new_policy_version(self):
        """Create version v2 from active policy preserves history (BR-POL-06, 07, AF-13)."""
        v1 = create_accounting_policy(
            self.company,
            {"code": "POL_VER", "name": "Phiên bản v1", "effective_from_period": self.period1},
            self.auth_admin,
        )
        activate_accounting_policy(v1, self.auth_admin, skip_approval=True)

        v2 = create_new_policy_version(v1, self.auth_admin, change_reason="Cập nhật năm mới")
        self.assertEqual(v2.code, v1.code)
        self.assertEqual(v2.version, 2)
        self.assertEqual(v2.previous_version, v1)
        self.assertEqual(v2.status, PolicyStatus.DRAFT)
        self.assertEqual(v1.status, PolicyStatus.ACTIVE)  # Old version untouched until v2 activates

    # 6. Activate Policy - Current Period becomes ACTIVE
    def test_06_activate_policy_current_period_becomes_active(self):
        """Activating policy for current or past period transitions directly to ACTIVE (Step 25)."""
        policy = create_accounting_policy(
            self.company,
            {"code": "POL_ACT_NOW", "name": "Kích hoạt ngay", "effective_from_period": self.period1},
            self.auth_admin,
        )
        activated = activate_accounting_policy(policy, self.auth_admin, skip_approval=True)
        self.assertEqual(activated.status, PolicyStatus.ACTIVE)
        self.assertIsNotNone(activated.approved_at)

    # 7. Activate Policy - Future Period becomes SCHEDULED
    def test_07_activate_policy_future_period_becomes_scheduled(self):
        """Activating policy with future effective period transitions to SCHEDULED (AF-04, BR-POL-08)."""
        policy = create_accounting_policy(
            self.company,
            {"code": "POL_FUT_SCHED", "name": "Lên lịch tương lai", "effective_from_period": self.period_future},
            self.auth_admin,
        )
        activated = activate_accounting_policy(policy, self.auth_admin, skip_approval=True)
        self.assertEqual(activated.status, PolicyStatus.SCHEDULED)

    # 8. Activating v2 Deactivates v1
    def test_08_activate_new_version_deactivates_old_version(self):
        """Activating v2 automatically sets superseded v1 to INACTIVE (Step 26, BR-POL-09)."""
        v1 = create_accounting_policy(
            self.company,
            {"code": "POL_CYCLE", "name": "V1", "effective_from_period": self.period1},
            self.auth_admin,
        )
        activate_accounting_policy(v1, self.auth_admin, skip_approval=True)
        self.assertEqual(v1.status, PolicyStatus.ACTIVE)

        v2 = create_new_policy_version(v1, self.auth_admin)
        activate_accounting_policy(v2, self.auth_admin, skip_approval=True)

        v1.refresh_from_db()
        v2.refresh_from_db()
        self.assertEqual(v1.status, PolicyStatus.INACTIVE)
        self.assertEqual(v2.status, PolicyStatus.ACTIVE)

    # 9. Overlapping Policy Conflict Prevention
    def test_09_policy_conflicts_prevention(self):
        """Cannot activate two active policies for overlapping periods in the same scope (EF-04, BR-POL-05)."""
        p1 = create_accounting_policy(
            self.company,
            {"code": "POL_ONE", "name": "P1", "effective_from_period": self.period1},
            self.auth_admin,
        )
        activate_accounting_policy(p1, self.auth_admin, skip_approval=True)

        p2 = create_accounting_policy(
            self.company,
            {"code": "POL_TWO", "name": "P2", "effective_from_period": self.period1},
            self.auth_admin,
        )
        with self.assertRaises(ValidationError) as ctx:
            activate_accounting_policy(p2, self.auth_admin, skip_approval=True)
        self.assertIn("xung đột", str(ctx.exception).lower())

    # 10. Branch Override Rules
    def test_10_branch_override_rules(self):
        """Branch override permits operational fields but blocks foundation fields (BR-POL-40..42)."""
        # 1. Attempting foundation change in BRANCH_OVERRIDE (e.g., regime or currency) must fail
        with self.assertRaises(ValidationError) as ctx:
            create_accounting_policy(
                self.company,
                {
                    "code": "POL_BR_ILLEGAL",
                    "name": "Chi nhánh đổi chế độ",
                    "scope": PolicyScope.BRANCH_OVERRIDE,
                    "branch": self.branch,
                    "effective_from_period": self.period1,
                    "accounting_regime": AccountingRegime.IFRS,
                },
                self.auth_admin,
            )
        self.assertIn("accounting_regime", str(ctx.exception))

        # 2. Allowed branch override fields (inventory valuation, posting mode, decimals)
        br_policy = create_accounting_policy(
            self.company,
            {
                "code": "POL_BR_LEGAL",
                "name": "Chi nhánh định giá FIFO",
                "scope": PolicyScope.BRANCH_OVERRIDE,
                "branch": self.branch,
                "effective_from_period": self.period1,
                "inventory_valuation": InventoryValuationMethod.FIFO,
                "unit_price_decimals": 4,
            },
            self.auth_admin,
        )
        self.assertEqual(br_policy.scope, PolicyScope.BRANCH_OVERRIDE)
        self.assertEqual(br_policy.branch, self.branch)

    # 11. Impact Analysis Blocks Currency Change With GL Data
    def test_11_impact_analysis_blocks_currency_change_with_gl_data(self):
        """Cannot change accounting currency if posted General Ledger entries exist (BR-POL-19, EF-07)."""
        gl_period = GLPeriod.objects.create(
            company=self.company,
            code="GL-2026-M01",
            fiscal_year=2026,
            period_number=1,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
        )
        JournalEntry.objects.create(
            company=self.company,
            number="JE-0001",
            posting_date=date(2026, 1, 15),
            period=gl_period,
            status=JournalStatus.POSTED,
            created_by=self.admin_account,
        )

        p = create_accounting_policy(
            self.company,
            {
                "code": "POL_CUR_CHANGE",
                "name": "Đổi tiền",
                "effective_from_period": self.period1,
                "accounting_currency": self.vnd,
            },
            self.auth_admin,
        )

        # Impact analysis when proposing currency change to USD
        impact = analyze_policy_impact(p, proposed_data={"accounting_currency": str(self.usd.id)})
        self.assertFalse(impact["can_activate"])
        self.assertTrue(any("đồng tiền kế toán" in reason for reason in impact["blocked_reasons"]))

    # 12. Workflow Approval Flow
    def test_12_workflow_approval_flow(self):
        """Activation requiring workflow transitions to PENDING_APPROVAL, then APPROVE activates it (AF-12, BR-POL-54)."""
        policy = create_accounting_policy(
            self.company,
            {"code": "POL_WF", "name": "Chính sách duyệt", "effective_from_period": self.period1},
            self.auth_admin,
        )
        # 1. Activate requiring approval
        activate_accounting_policy(policy, self.auth_admin, require_approval=True)
        self.assertEqual(policy.status, PolicyStatus.PENDING_APPROVAL)

        # 2. Reject transitions back to DRAFT
        approve_accounting_policy(policy, self.auth_admin, approved=False, notes="Thiếu căn cứ")
        self.assertEqual(policy.status, PolicyStatus.DRAFT)

        # 3. Resubmit and approve
        activate_accounting_policy(policy, self.auth_admin, require_approval=True)
        approve_accounting_policy(policy, self.auth_admin, approved=True, notes="Đồng ý")
        self.assertEqual(policy.status, PolicyStatus.ACTIVE)

    # 13. Copy Policy Template
    def test_13_copy_policy_template(self):
        """Copy existing policy template into new draft with custom code and period (AF-03)."""
        src = create_accounting_policy(
            self.company,
            {
                "code": "POL_SRC",
                "name": "Mẫu nguồn",
                "effective_from_period": self.period1,
                "inventory_valuation": InventoryValuationMethod.SPECIFIC_IDENTIFICATION,
            },
            self.auth_admin,
        )
        copied = copy_policy_template(
            source_policy=src,
            new_code="POL_COPIED",
            new_name="Bản sao 2026",
            effective_from_period=self.period1,
            actor=self.auth_admin,
        )
        self.assertEqual(copied.code, "POL_COPIED")
        self.assertEqual(copied.inventory_valuation, InventoryValuationMethod.SPECIFIC_IDENTIFICATION)
        self.assertEqual(copied.status, PolicyStatus.DRAFT)

    # 14. Default Policy for Company
    def test_14_default_policy_for_company(self):
        """Starter default policy for enterprise (AF-02, BR-POL-46..48)."""
        default_policy = create_default_accounting_policy_for_company(
            self.company, self.auth_admin, period=self.period1
        )
        self.assertEqual(default_policy.code, "POL_DEFAULT")
        self.assertEqual(default_policy.status, PolicyStatus.ACTIVE)
        self.assertEqual(default_policy.accounting_regime, AccountingRegime.CIRCULAR_88)  # for LLC_ONE_MEMBER

    # 15. Resolve Effective Policy & Rounding Precedence
    def test_15_resolve_effective_policy_and_rounding(self):
        """Resolve policy dynamically for transaction date, with branch overrides and rounding helper (BR-POL-12, 14, 40)."""
        # Company policy: 0 amount decimals, ROUND_HALF_UP, WEIGHTED_AVERAGE
        company_pol = create_accounting_policy(
            self.company,
            {
                "code": "POL_MAIN",
                "name": "Chính sách Công ty",
                "scope": PolicyScope.COMPANY,
                "effective_from_period": self.period1,
                "amount_decimals": 0,
                "unit_price_decimals": 2,
                "quantity_decimals": 2,
                "rounding_method": RoundingMethod.HALF_UP,
                "inventory_valuation": InventoryValuationMethod.WEIGHTED_AVERAGE,
            },
            self.auth_admin,
        )
        activate_accounting_policy(company_pol, self.auth_admin, skip_approval=True)

        # Branch policy: overrides unit_price_decimals=4, inventory_valuation=FIFO
        branch_pol = create_accounting_policy(
            self.company,
            {
                "code": "POL_BRANCH",
                "name": "Chính sách Chi nhánh",
                "scope": PolicyScope.BRANCH_OVERRIDE,
                "branch": self.branch,
                "effective_from_period": self.period1,
                "unit_price_decimals": 4,
                "inventory_valuation": InventoryValuationMethod.FIFO,
            },
            self.auth_admin,
        )
        activate_accounting_policy(branch_pol, self.auth_admin, skip_approval=True)

        # 1. Resolve for company without branch
        resolved_co = resolve_effective_policy(self.company, period=self.period1)
        self.assertEqual(resolved_co.inventory_valuation, InventoryValuationMethod.WEIGHTED_AVERAGE)
        self.assertEqual(resolved_co.unit_price_decimals, 2)
        self.assertEqual(resolved_co.round_amount(Decimal("12345.678")), Decimal("12346"))
        self.assertEqual(resolved_co.round_unit_price(Decimal("10.556")), Decimal("10.56"))

        # 2. Resolve for branch
        resolved_br = resolve_effective_policy(self.company, period=self.period1, branch=self.branch)
        self.assertEqual(resolved_br.inventory_valuation, InventoryValuationMethod.FIFO)
        self.assertEqual(resolved_br.unit_price_decimals, 4)
        self.assertEqual(resolved_br.round_unit_price(Decimal("10.55556")), Decimal("10.5556"))
        # Foundation properties still inherited from company policy
        self.assertEqual(resolved_br.accounting_currency, self.vnd)

    # 16. REST API: List and Create Policy
    def test_16_api_list_and_create(self):
        """API endpoints for listing and creating accounting policies."""
        self.client.force_authenticate(user=self.auth_admin)

        # POST /api/v1/common/accounting-policies/
        post_data = {
            "company_id": str(self.company.id),
            "code": "POL_API_01",
            "name": "Chính sách tạo qua API",
            "scope": PolicyScope.COMPANY,
            "effective_from_period": str(self.period1.id),
            "accounting_regime": AccountingRegime.CIRCULAR_200,
            "amount_decimals": 0,
            "unit_price_decimals": 2,
            "quantity_decimals": 2,
        }
        res = self.client.post("/api/v1/common/accounting-policies/", post_data, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        pol_id = res.data["id"]

        # GET /api/v1/common/accounting-policies/
        get_res = self.client.get(f"/api/v1/common/accounting-policies/?company_id={self.company.id}")
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertTrue(any(p["code"] == "POL_API_01" for p in get_res.data))

        # GET /api/v1/common/accounting-policies/<id>/
        detail_res = self.client.get(f"/api/v1/common/accounting-policies/{pol_id}/?company_id={self.company.id}")
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.data["code"], "POL_API_01")

    # 17. REST API: Impact Analysis and Activate
    def test_17_api_impact_and_activate(self):
        """API endpoints for policy impact analysis and activation."""
        self.client.force_authenticate(user=self.auth_admin)
        policy = create_accounting_policy(
            self.company,
            {"code": "POL_API_ACT", "name": "Chính sách kiểm tra và kích hoạt", "effective_from_period": self.period1},
            self.auth_admin,
        )

        # GET /impact/
        impact_res = self.client.get(f"/api/v1/common/accounting-policies/{policy.id}/impact/?company_id={self.company.id}")
        self.assertEqual(impact_res.status_code, status.HTTP_200_OK)
        self.assertTrue(impact_res.data["can_activate"])

        # POST /activate/
        act_res = self.client.post(
            f"/api/v1/common/accounting-policies/{policy.id}/activate/?company_id={self.company.id}",
            {"skip_approval": True},
            format="json",
        )
        self.assertEqual(act_res.status_code, status.HTTP_200_OK)
        self.assertEqual(act_res.data["status"], PolicyStatus.ACTIVE)

    # 18. REST API: Resolve Effective Policy
    def test_18_api_resolve_and_branch_override(self):
        """API endpoint /resolve/ returns active policy configuration and branch overrides."""
        self.client.force_authenticate(user=self.auth_admin)
        policy = create_accounting_policy(
            self.company,
            {
                "code": "POL_RES_API",
                "name": "Chính sách giải quyết",
                "effective_from_period": self.period1,
                "amount_decimals": 0,
            },
            self.auth_admin,
        )
        activate_accounting_policy(policy, self.auth_admin, skip_approval=True)

        res = self.client.get(
            f"/api/v1/common/accounting-policies/resolve/?company_id={self.company.id}&period={self.period1.id}"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["policy_code"], "POL_RES_API")
        self.assertEqual(res.data["amount_decimals"], 0)

    # 19. Permission Enforcement
    def test_19_permission_enforcement(self):
        """User without CONFIGURE permission cannot create or activate; viewer cannot alter policies (EF-01, BR-POL-02)."""
        self.client.force_authenticate(user=self.auth_viewer)

        # Viewer trying to create policy
        post_data = {
            "company_id": str(self.company.id),
            "code": "POL_DENIED",
            "name": "Từ chối",
            "effective_from_period": str(self.period1.id),
        }
        res = self.client.post("/api/v1/common/accounting-policies/", post_data, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
