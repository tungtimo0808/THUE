from datetime import date, timedelta
import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import (
    ActiveStatus,
    CompanyMembership,
    Permission,
    PermissionAction,
    PermissionResource,
    Role,
    RolePermission,
    UserAccount,
    UserRoleAssignment,
)
from master_data.models import Currency, DocumentType
from organization.models import Branch, Company, CompanyStatus

from .models import (
    CompanyModuleConfig,
    CoreCompanySetting,
    DateSource,
    DocumentNumberHistory,
    DocumentNumberingRule,
    GenerationEvent,
    ModuleCatalog,
    ModuleStatus,
    NumberingMode,
    NumberingRuleStatus,
    NumberingSequenceTracker,
    OverflowStrategy,
    ResetCycle,
    SequenceScope,
)
from .module_services import sync_company_enabled_modules
from .numbering_services import (
    activate_numbering_rule,
    cancel_document_number,
    copy_rule,
    create_default_numbering_rules_for_company,
    create_new_version,
    create_numbering_rule,
    deactivate_numbering_rule,
    format_document_number,
    generate_document_number,
    preview_number_patterns,
    record_skipped_number,
    update_draft_rule,
    validate_and_record_manual_number,
    validate_rule_syntax,
)


class DocumentNumberingRuleTests(TestCase):
    def setUp(self):
        cache.clear()
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.client = APIClient()

        # Create active company
        self.company = Company.objects.create(
            code="COMP_NUM_TEST",
            name="Công ty Đánh số Thử nghiệm",
            legal_name="Công ty Đánh số Thử nghiệm",
            tax_code="0108889999",
            business_type="LLC_ONE_MEMBER",
            accounting_currency=currency,
            legal_reporting_currency=currency,
            status=CompanyStatus.ACTIVE,
        )

        # Create branch
        self.branch_hn = Branch.objects.create(
            company=self.company,
            code="HN",
            name="Chi nhánh Hà Nội",
        )
        self.branch_hcm = Branch.objects.create(
            company=self.company,
            code="HCM",
            name="Chi nhánh Hồ Chí Minh",
        )

        # Create Admin Auth User and IAM UserAccount
        User = get_user_model()
        self.auth_admin = User.objects.create_user(
            username="num_admin_user",
            email="num_admin@test.com",
            password="StrongPass!2026",
            is_active=True,
        )
        self.admin_account, _ = UserAccount.objects.get_or_create(
            auth_user=self.auth_admin,
            defaults={"display_name": "Admin Numbering"},
        )
        self.admin_membership = CompanyMembership.objects.create(
            company=self.company,
            user=self.admin_account,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.admin_account,
        )

        # Seed enabled modules in company (SYS, COM, MD, GL, PUR, CASH)
        for m_code in ["GL", "PUR", "CASH"]:
            cat = ModuleCatalog.objects.filter(code=m_code).first()
            if cat:
                CompanyModuleConfig.objects.create(
                    company=self.company,
                    module=cat,
                    status=ModuleStatus.ENABLED,
                    version=1,
                    updated_by=self.admin_account,
                )
        sync_company_enabled_modules(self.company)

        # Create Document Types
        self.doc_type_po, _ = DocumentType.objects.get_or_create(
            code="PUR.ORDER",
            defaults={"module_code": "PUR", "name": "Đơn mua hàng", "document_class": "PURCHASE", "status": "ACTIVE"},
        )
        self.doc_type_pc, _ = DocumentType.objects.get_or_create(
            code="CASH.PAYMENT",
            defaults={"module_code": "CASH", "name": "Phiếu chi tiền mặt", "document_class": "CASH", "status": "ACTIVE"},
        )
        self.doc_type_inv, _ = DocumentType.objects.get_or_create(
            code="INV.INWARD",
            defaults={"module_code": "INV", "name": "Phiếu nhập kho", "document_class": "INVENTORY", "status": "ACTIVE"},
        )

        # Create Admin Role with SYS.NUMBERING.VIEW, SYS.NUMBERING.CONFIGURE, SYS.NUMBERING.MANUAL_OVERRIDE
        self.admin_role = Role.objects.create(
            company=self.company,
            code="NUM_ADMIN",
            name="Quản trị Đánh số",
            status="ACTIVE",
            is_system_admin=True,
            created_by=self.admin_account,
        )
        for p_code in ["SYS.NUMBERING.VIEW", "SYS.NUMBERING.CONFIGURE", "SYS.NUMBERING.MANUAL_OVERRIDE"]:
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

        # Create regular user with only VIEW permission
        self.auth_viewer = User.objects.create_user(
            username="num_viewer_user",
            email="num_viewer@test.com",
            password="StrongPass!2026",
            is_active=True,
        )
        self.viewer_account, _ = UserAccount.objects.get_or_create(
            auth_user=self.auth_viewer,
            defaults={"display_name": "Viewer Numbering"},
        )
        self.viewer_membership = CompanyMembership.objects.create(
            company=self.company,
            user=self.viewer_account,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.admin_account,
        )
        self.viewer_role = Role.objects.create(
            company=self.company,
            code="NUM_VIEWER",
            name="Xem Đánh số",
            status="ACTIVE",
            created_by=self.admin_account,
        )
        v_perm = Permission.objects.filter(code="SYS.NUMBERING.VIEW").first()
        if v_perm:
            RolePermission.objects.get_or_create(role=self.viewer_role, permission=v_perm, defaults={"effect": "ALLOW"})

        UserRoleAssignment.objects.create(
            company_membership=self.viewer_membership,
            role=self.viewer_role,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.admin_account,
        )

    def test_01_create_numbering_rule_draft(self):
        """Create rule in DRAFT status with valid parameters (Main Flow 2.1)."""
        self.client.force_authenticate(self.auth_admin)
        payload = {
            "company": str(self.company.id),
            "code": "PO_RULE_MAIN",
            "name": "Quy tắc đơn mua hàng chính",
            "document_type": str(self.doc_type_po.id),
            "numbering_mode": NumberingMode.AUTO,
            "sequence_scope": SequenceScope.COMPANY,
            "pattern": "{Prefix}-{Year}-{Sequence:6}",
            "prefix": "PO",
            "start_number": 1,
            "padding_length": 6,
            "increment_by": 1,
            "reset_cycle": ResetCycle.YEARLY,
            "date_source": DateSource.DOCUMENT_DATE,
            "generation_event": GenerationEvent.ON_CREATE,
            "overflow_strategy": OverflowStrategy.AUTO_EXPAND,
            "effective_from": str(timezone.localdate()),
            "notes": "Thiết lập ban đầu",
        }
        response = self.client.post("/api/v1/common/numbering-rules/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        data = response.data
        self.assertEqual(data["code"], "PO_RULE_MAIN")
        self.assertEqual(data["status"], NumberingRuleStatus.DRAFT)
        self.assertEqual(data["version"], 1)

        # Verify audit log
        audit = AuditLog.objects.filter(company=self.company, module_code="SYS", action_code="NUMBERING_RULE_CREATE").first()
        self.assertIsNotNone(audit)

    def test_02_duplicate_rule_code_rejected(self):
        """Rule code must be unique in enterprise (BR-NUM-03, EF-02)."""
        self.client.force_authenticate(self.auth_admin)
        create_numbering_rule(self.company, {
            "code": "RULE_DUP", "name": "Rule 1", "document_type": self.doc_type_po.id,
            "pattern": "{Prefix}-{Year}-{Sequence:6}", "prefix": "PO",
        }, self.admin_account)

        # Attempt to create duplicate code
        response = self.client.post("/api/v1/common/numbering-rules/", {
            "company": str(self.company.id),
            "code": "RULE_DUP",
            "name": "Rule 2",
            "document_type": str(self.doc_type_po.id),
            "pattern": "{Prefix}-{Year}-{Sequence:6}",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("đã tồn tại", str(response.data))

    def test_03_disabled_module_document_type_rejected(self):
        """Document type whose module is disabled in company cannot be configured (UC-SYS-12, EF-03)."""
        self.client.force_authenticate(self.auth_admin)
        # INV is disabled in setUp
        response = self.client.post("/api/v1/common/numbering-rules/", {
            "company": str(self.company.id),
            "code": "RULE_INV",
            "name": "Quy tắc nhập kho",
            "document_type": str(self.doc_type_inv.id),
            "pattern": "NK-{Sequence:6}",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("bị ngừng hoặc chưa được kích hoạt", str(response.data))

    def test_04_pattern_syntax_validation(self):
        """Validate unsupported tokens, missing Sequence, and reset cycle mismatches (EF-05, EF-06, EF-09)."""
        # 1. Missing Sequence token in AUTO mode (BR-NUM-06, EF-06)
        with self.assertRaises(ValidationError) as ctx:
            validate_rule_syntax("PO-2026-FIXED", NumberingMode.AUTO, ResetCycle.NEVER)
        self.assertIn("Sequence", str(ctx.exception))

        # 2. Unsupported token (EF-05)
        with self.assertRaises(ValidationError) as ctx:
            validate_rule_syntax("{InvalidToken}-{Sequence:6}", NumberingMode.AUTO, ResetCycle.NEVER)
        self.assertIn("không được hỗ trợ", str(ctx.exception))

        # 3. YEARLY reset without {Year} or {YY} (BR-NUM-24, EF-09)
        with self.assertRaises(ValidationError) as ctx:
            validate_rule_syntax("PO-{Sequence:6}", NumberingMode.AUTO, ResetCycle.YEARLY)
        self.assertIn("Year", str(ctx.exception))

        # 4. MONTHLY reset without {Month} or {MM} (BR-NUM-25, EF-09)
        with self.assertRaises(ValidationError) as ctx:
            validate_rule_syntax("PO-{Year}-{Sequence:6}", NumberingMode.AUTO, ResetCycle.MONTHLY)
        self.assertIn("tháng", str(ctx.exception))

    def test_05_preview_numbers_api(self):
        """Preview API generates sample numbers correctly (Step 11, AF-14)."""
        self.client.force_authenticate(self.auth_admin)
        payload = {
            "pattern": "{BranchCode}-{DocumentType}-{Year}-{Sequence:6}",
            "branch_code": "HN",
            "document_type_code": "PO",
            "start_number": 1,
            "increment_by": 1,
            "reset_cycle": ResetCycle.YEARLY,
        }
        response = self.client.post("/api/v1/common/numbering-rules/preview/", payload, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        samples = response.data["samples"]
        self.assertEqual(len(samples), 3)
        current_year = timezone.localdate().year
        self.assertEqual(samples[0]["sample_number"], f"HN-PO-{current_year}-000001")
        self.assertEqual(samples[1]["sample_number"], f"HN-PO-{current_year}-000002")
        self.assertEqual(samples[2]["sample_number"], f"HN-PO-{current_year}-000003")
        self.assertTrue(len(response.data["next_cycle_preview"]) > 0)

    def test_06_activate_rule_and_counter_initialization(self):
        """Activating rule transitions to ACTIVE and initializes sequence counter (Main Flow 2.1)."""
        self.client.force_authenticate(self.auth_admin)
        rule = create_numbering_rule(self.company, {
            "code": "RULE_PO_ACT",
            "name": "Đơn mua hàng chuẩn",
            "document_type": self.doc_type_po.id,
            "pattern": "PO-{Year}-{Sequence:6}",
            "prefix": "PO",
            "start_number": 100,
            "effective_from": timezone.localdate(),
        }, self.admin_account)
        self.assertEqual(rule.status, NumberingRuleStatus.DRAFT)

        # Activate
        resp = self.client.post(f"/api/v1/common/numbering-rules/{rule.id}/activate/", format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        rule.refresh_from_db()
        self.assertEqual(rule.status, NumberingRuleStatus.ACTIVE)

        # Verify tracker initialized
        trackers = NumberingSequenceTracker.objects.filter(rule=rule)
        self.assertTrue(trackers.exists())
        self.assertEqual(trackers.first().current_number, 99)  # max(0, start_number - 1)

    def test_07_activate_scheduled_future_rule(self):
        """Rule with effective_from in future transitions to SCHEDULED (BR-NUM-32, AF-10)."""
        self.client.force_authenticate(self.auth_admin)
        future_date = timezone.localdate() + timedelta(days=5)
        rule = create_numbering_rule(self.company, {
            "code": "RULE_PO_FUTURE",
            "name": "Đơn mua tương lai",
            "document_type": self.doc_type_po.id,
            "pattern": "PO-{Year}-{Sequence:6}",
            "effective_from": future_date,
        }, self.admin_account)

        resp = self.client.post(f"/api/v1/common/numbering-rules/{rule.id}/activate/", format="json")
        self.assertEqual(resp.status_code, 200)
        rule.refresh_from_db()
        self.assertEqual(rule.status, NumberingRuleStatus.SCHEDULED)

    def test_08_overlapping_active_rules_rejected(self):
        """Overlapping ACTIVE rules for same document type and scope must be rejected (BR-NUM-05, EF-10)."""
        self.client.force_authenticate(self.auth_admin)
        rule1 = create_numbering_rule(self.company, {
            "code": "RULE_1", "name": "Rule 1", "document_type": self.doc_type_po.id,
            "pattern": "PO-{Year}-{Sequence:6}", "sequence_scope": SequenceScope.COMPANY,
        }, self.admin_account)
        activate_numbering_rule(rule1, self.admin_account)

        rule2 = create_numbering_rule(self.company, {
            "code": "RULE_2", "name": "Rule 2", "document_type": self.doc_type_po.id,
            "pattern": "PO-{Year}-{Sequence:6}", "sequence_scope": SequenceScope.COMPANY,
        }, self.admin_account)

        with self.assertRaises(ValidationError) as ctx:
            activate_numbering_rule(rule2, self.admin_account)
        self.assertIn("Đã có quy tắc", str(ctx.exception))

    def test_09_generate_document_number_success(self):
        """Atomic document number generation and uniqueness logging (Section 2.2)."""
        rule = create_numbering_rule(self.company, {
            "code": "RULE_PC",
            "name": "Phiếu chi tiền mặt",
            "document_type": self.doc_type_pc.id,
            "pattern": "PC-{Year}-{Sequence:4}",
            "prefix": "PC",
            "start_number": 1,
            "padding_length": 4,
            "reset_cycle": ResetCycle.YEARLY,
        }, self.admin_account)
        activate_numbering_rule(rule, self.admin_account)

        num1 = generate_document_number(
            self.company, self.doc_type_pc, actor=self.admin_account, entity_type="CashTransaction", entity_id=uuid.uuid4()
        )
        current_year = timezone.localdate().year
        self.assertEqual(num1, f"PC-{current_year}-0001")

        num2 = generate_document_number(
            self.company, self.doc_type_pc, actor=self.admin_account, entity_type="CashTransaction", entity_id=uuid.uuid4()
        )
        self.assertEqual(num2, f"PC-{current_year}-0002")

        # Verify history logs
        histories = DocumentNumberHistory.objects.filter(company=self.company, document_type=self.doc_type_pc).order_by("sequence_number")
        self.assertEqual(histories.count(), 2)
        self.assertEqual(histories[0].document_number, num1)
        self.assertEqual(histories[1].document_number, num2)

    def test_10_overflow_strategy_auto_expand_and_block(self):
        """Test overflow strategy: AUTO_EXPAND expands digits; BLOCK stops issuing (BR-NUM-29, AF-16, EF-16)."""
        # Case A: AUTO_EXPAND
        rule_expand = create_numbering_rule(self.company, {
            "code": "RULE_EXPAND",
            "name": "Quy tắc mở rộng",
            "document_type": self.doc_type_pc.id,
            "pattern": "PC-{Sequence:2}",
            "start_number": 99,
            "padding_length": 2,
            "reset_cycle": ResetCycle.NEVER,
            "overflow_strategy": OverflowStrategy.AUTO_EXPAND,
        }, self.admin_account)
        activate_numbering_rule(rule_expand, self.admin_account)

        num1 = generate_document_number(self.company, self.doc_type_pc, actor=self.admin_account)
        self.assertEqual(num1, "PC-99")
        num2 = generate_document_number(self.company, self.doc_type_pc, actor=self.admin_account)
        self.assertEqual(num2, "PC-100")  # Auto-expanded to 3 digits (AF-16)

        # Deactivate expand rule
        deactivate_numbering_rule(rule_expand, self.admin_account, "Xong test expand")

        # Case B: BLOCK
        rule_block = create_numbering_rule(self.company, {
            "code": "RULE_BLOCK",
            "name": "Quy tắc chặn vượt",
            "document_type": self.doc_type_pc.id,
            "prefix": "BK",
            "pattern": "BK-{Sequence:2}",
            "start_number": 99,
            "padding_length": 2,
            "reset_cycle": ResetCycle.NEVER,
            "overflow_strategy": OverflowStrategy.BLOCK,
        }, self.admin_account)
        activate_numbering_rule(rule_block, self.admin_account)

        # 99 succeeds, 100 exceeds 2 digits and raises ValidationError
        num_b1 = generate_document_number(self.company, self.doc_type_pc, actor=self.admin_account)
        self.assertEqual(num_b1, "BK-99")
        with self.assertRaises(ValidationError) as ctx:
            generate_document_number(self.company, self.doc_type_pc, actor=self.admin_account)
        self.assertIn("vượt giới hạn", str(ctx.exception))

    def test_11_cancel_number_never_reused(self):
        """Cancelled numbers are never reused (BR-NUM-17, AF-15)."""
        rule = create_numbering_rule(self.company, {
            "code": "RULE_CANCEL_TEST",
            "name": "Hủy số",
            "document_type": self.doc_type_po.id,
            "pattern": "PO-{Sequence:4}",
            "start_number": 1,
            "reset_cycle": ResetCycle.NEVER,
        }, self.admin_account)
        activate_numbering_rule(rule, self.admin_account)

        num1 = generate_document_number(self.company, self.doc_type_po, actor=self.admin_account)
        self.assertEqual(num1, "PO-0001")

        # Cancel num1
        cancel_document_number(self.company, self.doc_type_po, num1, "Chứng từ lập sai hàng hóa", self.admin_account)

        # Generate next: MUST be PO-0002, NOT PO-0001
        num2 = generate_document_number(self.company, self.doc_type_po, actor=self.admin_account)
        self.assertEqual(num2, "PO-0002")

        hist_cancelled = DocumentNumberHistory.objects.get(company=self.company, document_number="PO-0001")
        self.assertEqual(hist_cancelled.status, DocumentNumberHistory.Status.CANCELLED)

    def test_12_create_new_version_replaces_active_rule(self):
        """Creating new version and activating it closes old version (BR-NUM-30, 31, 33, AF-12)."""
        self.client.force_authenticate(self.auth_admin)
        rule_v1 = create_numbering_rule(self.company, {
            "code": "RULE_VER_TEST",
            "name": "Phiên bản 1",
            "document_type": self.doc_type_po.id,
            "pattern": "PO-{Year}-{Sequence:4}",
            "effective_from": timezone.localdate(),
        }, self.admin_account)
        activate_numbering_rule(rule_v1, self.admin_account)

        # Create new version
        resp_new_ver = self.client.post(f"/api/v1/common/numbering-rules/{rule_v1.id}/new-version/", format="json")
        self.assertEqual(resp_new_ver.status_code, 201, resp_new_ver.data)
        rule_v2_id = resp_new_ver.data["id"]
        rule_v2 = DocumentNumberingRule.objects.get(pk=rule_v2_id)
        self.assertEqual(rule_v2.version, 2)
        self.assertEqual(rule_v2.status, NumberingRuleStatus.DRAFT)
        self.assertEqual(rule_v2.previous_version, rule_v1)

        # Activate v2 with effective_from = today
        activate_numbering_rule(rule_v2, self.admin_account, effective_from=timezone.localdate())

        rule_v1.refresh_from_db()
        rule_v2.refresh_from_db()
        self.assertEqual(rule_v2.status, NumberingRuleStatus.ACTIVE)
        self.assertEqual(rule_v1.status, NumberingRuleStatus.INACTIVE)  # Old version closed (BR-NUM-33)

    def test_13_copy_rule(self):
        """Copying rule duplicates configuration into new draft (AF-11)."""
        self.client.force_authenticate(self.auth_admin)
        source = create_numbering_rule(self.company, {
            "code": "RULE_SRC",
            "name": "Quy tắc nguồn",
            "document_type": self.doc_type_po.id,
            "pattern": "PO-{BranchCode}-{Sequence:6}",
            "reset_cycle": ResetCycle.NEVER,
        }, self.admin_account)

        resp = self.client.post(f"/api/v1/common/numbering-rules/{source.id}/copy/", {
            "code": "RULE_COPIED",
            "name": "Quy tắc sao chép",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        copied = DocumentNumberingRule.objects.get(code="RULE_COPIED", company=self.company)
        self.assertEqual(copied.pattern, source.pattern)
        self.assertEqual(copied.status, NumberingRuleStatus.DRAFT)

    def test_14_deactivate_rule_requires_reason(self):
        """Deactivating rule requires reason (AF-13, BR-NUM-34)."""
        self.client.force_authenticate(self.auth_admin)
        rule = create_numbering_rule(self.company, {
            "code": "RULE_DEACT", "name": "Rule deact", "document_type": self.doc_type_pc.id,
            "pattern": "PC-{Year}-{Sequence:4}",
        }, self.admin_account)
        activate_numbering_rule(rule, self.admin_account)

        # Missing reason fails
        resp_fail = self.client.post(f"/api/v1/common/numbering-rules/{rule.id}/deactivate/", {"reason": ""}, format="json")
        self.assertEqual(resp_fail.status_code, 400)

        # With reason succeeds
        resp_ok = self.client.post(f"/api/v1/common/numbering-rules/{rule.id}/deactivate/", {
            "reason": "Chuyển sang dùng quy tắc mới cho năm tài chính",
        }, format="json")
        self.assertEqual(resp_ok.status_code, 200)
        rule.refresh_from_db()
        self.assertEqual(rule.status, NumberingRuleStatus.INACTIVE)

    def test_15_manual_numbering_validation(self):
        """Manual number validation checks format, uniqueness, and permissions (BR-NUM-13, 14, AF-17, EF-19)."""
        self.client.force_authenticate(self.auth_admin)
        # 1. Admin with SYS.NUMBERING.MANUAL_OVERRIDE can record manual number
        resp = self.client.post("/api/v1/common/numbering/validate-manual/", {
            "company": str(self.company.id),
            "document_type": str(self.doc_type_po.id),
            "document_number": "MANUAL-PO-2026-999",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)

        # 2. Duplicate manual number is rejected (EF-19)
        resp_dup = self.client.post("/api/v1/common/numbering/validate-manual/", {
            "company": str(self.company.id),
            "document_type": str(self.doc_type_po.id),
            "document_number": "MANUAL-PO-2026-999",
        }, format="json")
        self.assertEqual(resp_dup.status_code, 400)
        self.assertIn("đã tồn tại", str(resp_dup.data))

        # 3. Viewer without MANUAL_OVERRIDE is denied (BR-NUM-13)
        self.client.force_authenticate(self.auth_viewer)
        resp_denied = self.client.post("/api/v1/common/numbering/validate-manual/", {
            "company": str(self.company.id),
            "document_type": str(self.doc_type_po.id),
            "document_number": "MANUAL-PO-2026-1000",
        }, format="json")
        self.assertEqual(resp_denied.status_code, 403)

    def test_16_create_default_starter_rules(self):
        """Test default numbering rules generation for single-member / simple enterprises (BR-NUM-40, 41)."""
        rules = create_default_numbering_rules_for_company(self.company, self.admin_account)
        self.assertTrue(len(rules) > 0)
        created_codes = [r.code for r in rules]
        self.assertIn("RULE_PC", created_codes)
        self.assertIn("RULE_PO", created_codes)

        # Every default rule should be in ACTIVE state
        for r in rules:
            self.assertEqual(r.status, NumberingRuleStatus.ACTIVE)

    def test_17_permissions_enforcement(self):
        """Users without SYS.NUMBERING.CONFIGURE cannot mutate rules (EF-01)."""
        self.client.force_authenticate(self.auth_viewer)
        # Viewer can GET list
        resp_list = self.client.get(f"/api/v1/common/numbering-rules/?company_id={self.company.id}")
        self.assertEqual(resp_list.status_code, 200)

        # Viewer CANNOT create
        resp_post = self.client.post("/api/v1/common/numbering-rules/", {
            "company": str(self.company.id), "code": "HACK", "name": "Hack",
            "document_type": str(self.doc_type_po.id), "pattern": "H-{Year}-{Sequence:6}",
        }, format="json")
        self.assertEqual(resp_post.status_code, 403)

    def test_18_delete_draft_vs_active_rule(self):
        """Only DRAFT rules can be deleted; ACTIVE rules cannot be hard deleted (BR-NUM-34)."""
        self.client.force_authenticate(self.auth_admin)
        rule_draft = create_numbering_rule(self.company, {
            "code": "RULE_DEL_DRAFT", "name": "Draft to del",
            "document_type": self.doc_type_po.id, "pattern": "PO-{Year}-{Sequence:6}",
        }, self.admin_account)

        resp_del = self.client.delete(f"/api/v1/common/numbering-rules/{rule_draft.id}/?company_id={self.company.id}")
        self.assertEqual(resp_del.status_code, 204)
        self.assertFalse(DocumentNumberingRule.objects.filter(pk=rule_draft.id).exists())

        # Now test deleting an ACTIVE rule
        rule_active = create_numbering_rule(self.company, {
            "code": "RULE_DEL_ACT", "name": "Active to del",
            "document_type": self.doc_type_po.id, "pattern": "PO-{Year}-{Sequence:6}",
        }, self.admin_account)
        activate_numbering_rule(rule_active, self.admin_account)

        resp_del_act = self.client.delete(f"/api/v1/common/numbering-rules/{rule_active.id}/?company_id={self.company.id}")
        self.assertEqual(resp_del_act.status_code, 400)
        self.assertIn("không được xóa cứng", str(resp_del_act.data))
