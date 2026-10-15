from datetime import date, datetime, timedelta
import json
import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from iam.models import (
    ActiveStatus,
    CompanyMembership,
    DataScopeSet,
    Permission,
    Role,
    RolePermission,
    UserAccount,
    UserRoleAssignment,
)
from master_data.models import Currency
from organization.models import Branch, Company, CompanyStatus

from .models import (
    ActorType,
    AuditChange,
    AuditLog,
    AuditResult,
    AuditSeverity,
    AuditSource,
    EventCategory,
)
from .services import (
    export_audit_logs_data,
    generate_audit_ai_summary,
    is_sensitive_field,
    mask_sensitive_value,
    record_audit,
    validate_and_filter_audit_logs,
)


class DummyEntity:
    def __init__(self, id, code="ENT-001", branch=None):
        self.id = id
        self.pk = id
        self.code = code
        self.branch = branch

    class _meta:
        label = "dummy.DummyEntity"


class AuditLogTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.vnd, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})

        # 1. Company A & Branches
        self.company_a = Company.objects.create(
            code="COMP_AUD_A",
            name="Công ty Audit A",
            legal_name="Công ty Audit A",
            tax_code="0109991111",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
            status=CompanyStatus.ACTIVE,
        )
        self.branch_a1 = Branch.objects.create(
            company=self.company_a,
            code="BR_HN",
            name="Chi nhánh Hà Nội",
        )
        self.branch_a2 = Branch.objects.create(
            company=self.company_a,
            code="BR_HCM",
            name="Chi nhánh TP.HCM",
        )

        # 2. Company B for isolation tests
        self.company_b = Company.objects.create(
            code="COMP_AUD_B",
            name="Công ty Audit B",
            legal_name="Công ty Audit B",
            tax_code="0109992222",
            accounting_currency=self.vnd,
            legal_reporting_currency=self.vnd,
            status=CompanyStatus.ACTIVE,
        )

        # 3. Admin User for Company A (Full SYS.AUDIT.VIEW and SYS.AUDIT.EXPORT)
        User = get_user_model()
        self.auth_admin = User.objects.create_user(
            username="aud_admin_user",
            email="aud_admin@test.com",
            password="StrongPass!2026",
            is_active=True,
        )
        self.admin_account, _ = UserAccount.objects.get_or_create(auth_user=self.auth_admin)
        self.admin_account.display_name = "Admin Kiểm Toán"
        self.admin_account.save(update_fields=("display_name",))
        self.admin_membership = CompanyMembership.objects.create(
            company=self.company_a,
            user=self.admin_account,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.admin_account,
        )
        self.admin_role = Role.objects.create(
            company=self.company_a,
            code="AUDIT_ADMIN",
            name="Quản trị Audit Log",
            status="ACTIVE",
            is_system_admin=True,
            created_by=self.admin_account,
        )
        for p_code in ["SYS.AUDIT.VIEW", "SYS.AUDIT.EXPORT"]:
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

        # 4. Viewer User with VIEW only (No Export)
        self.auth_viewer = User.objects.create_user(
            username="aud_viewer_user",
            email="aud_viewer@test.com",
            password="StrongPass!2026",
            is_active=True,
        )
        self.viewer_account, _ = UserAccount.objects.get_or_create(
            auth_user=self.auth_viewer,
            defaults={"display_name": "Viewer Kiểm Toán"},
        )
        self.viewer_membership = CompanyMembership.objects.create(
            company=self.company_a,
            user=self.viewer_account,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.admin_account,
        )
        self.viewer_role = Role.objects.create(
            company=self.company_a,
            code="AUDIT_VIEWER",
            name="Người xem Audit Log",
            status="ACTIVE",
            created_by=self.admin_account,
        )
        view_perm = Permission.objects.filter(code="SYS.AUDIT.VIEW").first()
        if view_perm:
            RolePermission.objects.get_or_create(role=self.viewer_role, permission=view_perm, defaults={"effect": "ALLOW"})

        UserRoleAssignment.objects.create(
            company_membership=self.viewer_membership,
            role=self.viewer_role,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.admin_account,
        )

        # 5. Scoped Branch User (Scoped only to Branch A1)
        self.auth_scoped = User.objects.create_user(
            username="aud_scoped_user",
            email="aud_scoped@test.com",
            password="StrongPass!2026",
            is_active=True,
        )
        self.scoped_account, _ = UserAccount.objects.get_or_create(
            auth_user=self.auth_scoped,
            defaults={"display_name": "Chi Nhánh HN Auditor"},
        )
        self.scoped_membership = CompanyMembership.objects.create(
            company=self.company_a,
            user=self.scoped_account,
            membership_status=ActiveStatus.ACTIVE,
            created_by=self.admin_account,
        )
        self.scoped_scope_set = DataScopeSet.objects.create(
            company=self.company_a,
            code="SCOPE_HN_ONLY",
            name="Chỉ chi nhánh Hà Nội",
            allow_all_company_data=False,
            created_by=self.admin_account,
        )
        self.scoped_scope_set.branch_scopes.create(branch=self.branch_a1)

        UserRoleAssignment.objects.create(
            company_membership=self.scoped_membership,
            role=self.viewer_role,
            data_scope_set=self.scoped_scope_set,
            status=ActiveStatus.ACTIVE,
            valid_from=timezone.now() - timedelta(days=1),
            assigned_by=self.admin_account,
        )

    # 1. Record Audit and Automatic Snapshots
    def test_01_record_audit_and_auto_snapshots(self):
        """Record audit log captures telemetry, name snapshot, and computes integrity hash (BR-AUD-10..19, 44)."""
        entity_id = uuid.uuid4()
        dummy = DummyEntity(entity_id, code="DOC-2026-001", branch=self.branch_a1)

        log = record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="SYS",
            action_code="CONFIG_UPDATE",
            entity=dummy,
            before={"status": "DRAFT", "rate": 10},
            after={"status": "ACTIVE", "rate": 12},
            reason="Kích hoạt cấu hình hệ thống",
            event_category=EventCategory.CONFIGURATION,
            severity=AuditSeverity.HIGH,
            source=AuditSource.WEB,
            correlation_id="TX-CORR-1001",
        )

        self.assertEqual(log.company, self.company_a)
        self.assertEqual(log.actor_user, self.admin_account)
        self.assertEqual(log.actor_name_snapshot, "Admin Kiểm Toán")
        self.assertEqual(log.branch, self.branch_a1)
        self.assertEqual(log.resource_code, "DOC-2026-001")
        self.assertEqual(log.event_category, EventCategory.CONFIGURATION)
        self.assertEqual(log.severity, AuditSeverity.HIGH)
        self.assertEqual(log.correlation_id, "TX-CORR-1001")
        self.assertEqual(log.result, AuditResult.SUCCESS)
        self.assertTrue(bool(log.integrity_hash))

        # Check field changes
        changes = {ch.field_name: (ch.old_value_json, ch.new_value_json) for ch in log.changes.all()}
        self.assertIn("status", changes)
        self.assertEqual(changes["status"], ("DRAFT", "ACTIVE"))
        self.assertEqual(changes["rate"], (10, 12))

    # 2. Sensitive Data Masking
    def test_02_sensitive_data_masking(self):
        """Sensitive fields like passwords, tokens, OTPs are masked in AuditChange (BR-AUD-22, 23, EF-09)."""
        log = record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="IAM",
            action_code="PASSWORD_CHANGE",
            before={"password_hash": "argon2$v=19$secret_hash_1", "username": "admin", "otp_code": "123456"},
            after={"password_hash": "argon2$v=19$secret_hash_2", "username": "admin", "otp_code": "654321"},
            reason="Đổi mật khẩu người dùng",
        )

        changes = {ch.field_name: (ch.old_value_json, ch.new_value_json) for ch in log.changes.all()}
        # Sensitive fields must be masked with '******'
        self.assertEqual(changes["password_hash"], ("******", "******"))
        self.assertEqual(changes["otp_code"], ("******", "******"))
        # Non-sensitive field helper
        self.assertTrue(is_sensitive_field("access_token"))
        self.assertTrue(is_sensitive_field("client_secret"))
        self.assertFalse(is_sensitive_field("account_name"))

    # 3. Append-Only Immutability
    def test_03_append_only_immutability(self):
        """AuditLog and AuditChange are append-only; calling delete() raises ValidationError (BR-AUD-07, 08)."""
        log = record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="SYS",
            action_code="POLICY_ACTIVATE",
            reason="Kiểm thử bất biến",
        )
        change = AuditChange.objects.create(
            audit_log=log,
            field_name="mode",
            old_value_json="MANUAL",
            new_value_json="AUTO",
        )

        # Deleting AuditLog must fail
        with self.assertRaises((DjangoValidationError, ValidationError)):
            log.delete()

        # Deleting AuditChange must fail
        with self.assertRaises((DjangoValidationError, ValidationError)):
            change.delete()

    # 4. Query Filters and Free Text Search
    def test_04_query_filters_and_free_text_search(self):
        """Querying audit logs by category, action, and free text search (AF-01, AF-02, BR-AUD-33)."""
        record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="INV",
            action_code="STOCK_TRANSFER",
            resource_code="TRF-001",
            description="Điều chuyển kho nguyên vật liệu",
            event_category=EventCategory.DOCUMENT,
        )
        record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="GL",
            action_code="PERIOD_LOCK",
            resource_code="FY2026-M01",
            description="Khóa kỳ tháng 1",
            event_category=EventCategory.PERIOD_CONTROL,
        )

        # Search by category
        res_inv = validate_and_filter_audit_logs(
            self.company_a, self.admin_account, {"event_category": EventCategory.DOCUMENT}
        )
        self.assertTrue(res_inv.filter(resource_code="TRF-001").exists())
        self.assertFalse(res_inv.filter(resource_code="FY2026-M01").exists())

        # Search by free-text q
        res_q = validate_and_filter_audit_logs(
            self.company_a, self.admin_account, {"q": "Điều chuyển"}
        )
        self.assertTrue(res_q.filter(resource_code="TRF-001").exists())
        self.assertEqual(res_q.count(), 1)

    # 5. Date Range Validation Limits
    def test_05_date_range_validation_limits(self):
        """Query range exceeding 366 days is blocked to protect database performance (BR-AUD-34, EF-03)."""
        from_str = "2024-01-01"
        to_str = "2026-01-01"  # > 700 days

        with self.assertRaises(ValidationError) as ctx:
            validate_and_filter_audit_logs(
                self.company_a, self.admin_account, {"from_date": from_str, "to_date": to_str}
            )
        self.assertIn("time_range", ctx.exception.detail)

        # Inverted date range
        with self.assertRaises(ValidationError) as ctx:
            validate_and_filter_audit_logs(
                self.company_a, self.admin_account, {"from_date": "2026-05-01", "to_date": "2026-01-01"}
            )
        self.assertIn("time_range", ctx.exception.detail)

    # 6. Business Record History Endpoint
    def test_06_record_history_endpoint(self):
        """View audit history for a specific business entity (Section 2.2)."""
        self.client.force_authenticate(user=self.auth_admin)
        entity_id = uuid.uuid4()
        dummy = DummyEntity(entity_id, code="PO-999")

        record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="PUR",
            action_code="PO_CREATE",
            entity=dummy,
            description="Tạo đơn mua hàng",
        )
        record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="PUR",
            action_code="PO_APPROVE",
            entity=dummy,
            description="Duyệt đơn mua hàng",
        )

        res = self.client.get(
            f"/api/v1/audit/logs/record-history/?company_id={self.company_a.id}&entity_type=dummy.DummyEntity&entity_id={entity_id}"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data if isinstance(res.data, list) else res.data.get("results", [])
        self.assertEqual(len(results), 2)
        actions = [r["action_code"] for r in results]
        self.assertIn("PO_CREATE", actions)
        self.assertIn("PO_APPROVE", actions)

    # 7. Correlation Chain Tracking
    def test_07_correlation_chain_tracking(self):
        """Retrieve linked events across multi-stage business operations by correlation_id (AF-07, BR-AUD-30)."""
        self.client.force_authenticate(user=self.auth_admin)
        corr_id = "FLOW-ORDER-TO-PAY-888"

        record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="SAL",
            action_code="ORDER_CREATE",
            correlation_id=corr_id,
            description="Tạo đơn bán hàng",
        )
        record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="INV",
            action_code="DELIVERY_ISSUE",
            correlation_id=corr_id,
            description="Xuất kho giao hàng",
        )
        record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="GL",
            action_code="POST_REVENUE",
            correlation_id=corr_id,
            description="Ghi nhận doanh thu",
        )

        res = self.client.get(
            f"/api/v1/audit/logs/correlation/?company_id={self.company_a.id}&correlation_id={corr_id}"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["correlation_id"], corr_id)
        self.assertEqual(res.data["total_events"], 3)
        self.assertEqual(len(res.data["events"]), 3)

    # 8. Export Audit Logs in JSON and CSV
    def test_08_export_audit_logs_json_and_csv(self):
        """Exporting logs as CSV/JSON generates downloadable content and records export audit log (BR-AUD-28, 37..40)."""
        self.client.force_authenticate(user=self.auth_admin)
        record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="SYS",
            action_code="ROLE_ASSIGN",
            resource_code="ROLE-ADMIN",
            description="Gán quyền cho người dùng",
        )

        # 1. Export CSV
        res_csv = self.client.get(f"/api/v1/audit/logs/export/?company_id={self.company_a.id}&format=csv")
        self.assertEqual(res_csv.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", res_csv["Content-Type"])
        self.assertIn("attachment; filename=", res_csv["Content-Disposition"])
        content_csv = res_csv.content.decode("utf-8")
        self.assertIn("Audit ID,Thời điểm", content_csv)
        self.assertIn("ROLE_ASSIGN", content_csv)

        # 2. Export JSON
        res_json = self.client.get(f"/api/v1/audit/logs/export/?company_id={self.company_a.id}&format=json")
        self.assertEqual(res_json.status_code, status.HTTP_200_OK)
        self.assertIn("application/json", res_json["Content-Type"])
        parsed_json = json.loads(res_json.content.decode("utf-8"))
        self.assertTrue(isinstance(parsed_json, list))
        self.assertTrue(any(item["action_code"] == "ROLE_ASSIGN" for item in parsed_json))

        # 3. Verify that the export action itself is recorded in AuditLog (BR-AUD-28, 40)
        self.assertTrue(
            AuditLog.objects.filter(
                company=self.company_a,
                action_code="EXPORT",
                event_category=EventCategory.REPORT_EXPORT,
            ).exists()
        )

    # 9. Export Permission Enforcement
    def test_09_export_permission_enforcement(self):
        """User without SYS.AUDIT.EXPORT is rejected when requesting export (EF-01, BR-AUD-02, 37)."""
        self.client.force_authenticate(user=self.auth_viewer)  # Viewer has VIEW but not EXPORT

        res = self.client.get(f"/api/v1/audit/logs/export/?company_id={self.company_a.id}&format=csv")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # 10. View Permission Enforcement
    def test_10_view_permission_enforcement(self):
        """User without SYS.AUDIT.VIEW cannot access audit logs (EF-01, BR-AUD-02)."""
        User = get_user_model()
        no_perm_user = User.objects.create_user(username="no_perm_user", password="Pass!2026")
        self.client.force_authenticate(user=no_perm_user)

        res = self.client.get(f"/api/v1/audit/logs/?company_id={self.company_a.id}")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # 11. Data Scope Branch Isolation
    def test_11_data_scope_branch_isolation(self):
        """User scoped to Branch HN only sees logs from Branch HN, not Branch HCM (BR-AUD-04, EF-02)."""
        # Create log in Branch HN
        record_audit(
            company=self.company_a,
            branch=self.branch_a1,
            actor_user=self.admin_account,
            module_code="INV",
            action_code="HN_INVENTORY_CHECK",
            resource_code="INV-HN-01",
        )
        # Create log in Branch HCM
        record_audit(
            company=self.company_a,
            branch=self.branch_a2,
            actor_user=self.admin_account,
            module_code="INV",
            action_code="HCM_INVENTORY_CHECK",
            resource_code="INV-HCM-01",
        )

        self.client.force_authenticate(user=self.auth_scoped)
        res = self.client.get(f"/api/v1/audit/logs/?company_id={self.company_a.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        results = res.data if isinstance(res.data, list) else res.data.get("results", [])
        action_codes = [item["action_code"] for item in results]
        self.assertIn("HN_INVENTORY_CHECK", action_codes)
        self.assertNotIn("HCM_INVENTORY_CHECK", action_codes)

    # 12. Integrity Verification Success and Tamper Detection
    def test_12_integrity_verification_success_and_tamper_detection(self):
        """Integrity hash verifies untampered log and catches database tampering (BR-AUD-44, 45, EF-14)."""
        self.client.force_authenticate(user=self.auth_admin)
        log = record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="GL",
            action_code="POST_VOUCHER",
            reason="Ghi sổ hợp lệ",
        )

        # 1. Untampered verification
        res_ok = self.client.get(f"/api/v1/audit/logs/{log.id}/verify-integrity/?company_id={self.company_a.id}")
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertTrue(res_ok.data["is_valid"])

        # 2. Tampering via direct DB bypass (e.g. malicious update to action_code)
        AuditLog.objects.filter(pk=log.pk).update(action_code="UNAUTHORIZED_TAMPER")
        log.refresh_from_db()

        res_tampered = self.client.get(f"/api/v1/audit/logs/{log.id}/verify-integrity/?company_id={self.company_a.id}")
        self.assertEqual(res_tampered.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(res_tampered.data["is_valid"])
        self.assertIn("sai lệch", res_tampered.data["message"])

    # 13. Batch Integrity Verification
    def test_13_batch_integrity_verification(self):
        """Batch verify endpoint checks multiple logs and flags count of tampered records (BR-AUD-44)."""
        self.client.force_authenticate(user=self.auth_admin)
        l1 = record_audit(
            company=self.company_a, actor_user=self.admin_account, module_code="GL", action_code="A1"
        )
        l2 = record_audit(
            company=self.company_a, actor_user=self.admin_account, module_code="GL", action_code="A2"
        )
        # Tamper l2
        AuditLog.objects.filter(pk=l2.pk).update(action_code="MODIFIED")

        res = self.client.post(
            f"/api/v1/audit/logs/verify-batch/?company_id={self.company_a.id}",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(res.data["all_valid"])
        self.assertGreaterEqual(res.data["tampered_count"], 1)

    # 14. AI Summary and Anomaly Detection
    def test_14_ai_summary_and_anomaly_detection(self):
        """AI summary synthesizes audit activity, flags access denial anomalies, and includes disclaimer (AF-13, BR-AUD-50..52)."""
        self.client.force_authenticate(user=self.auth_admin)

        # Generate some denied events and high severity events
        record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="IAM",
            action_code="UNAUTHORIZED_ACCESS",
            result=AuditResult.DENIED,
            severity=AuditSeverity.HIGH,
            description="Cố gắng truy cập trái phép",
        )
        record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="IAM",
            action_code="PERMISSION_GRANT",
            event_category=EventCategory.PERMISSION,
            result=AuditResult.SUCCESS,
            severity=AuditSeverity.HIGH,
        )

        res = self.client.get(f"/api/v1/audit/logs/ai-summary/?company_id={self.company_a.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("disclaimer", res.data)
        self.assertIn("BR-AUD-52", res.data["disclaimer"])
        self.assertGreaterEqual(res.data["total_events"], 2)
        # Check anomaly detected
        anomalies = res.data["anomalies"]
        self.assertTrue(any(a["type"] == "ACCESS_DENIED_SPIKE" for a in anomalies))

    # 15. Single Member Enterprise Audit Log Immutability
    def test_15_single_member_enterprise_audit_log(self):
        """Even in single-member enterprise, user cannot delete their own audit logs (BR-AUD-48, 49)."""
        log = record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="SYS",
            action_code="SINGLE_MEMBER_ACTION",
            reason="Hành động của chủ doanh nghiệp duy nhất",
        )
        # Cannot be deleted
        with self.assertRaises((DjangoValidationError, ValidationError)):
            log.delete()

    # 16. Backward Compatibility for record_audit
    def test_16_backward_compatibility_record_audit(self):
        """Existing legacy callers without new arguments continue to work without errors."""
        legacy_log = record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="MDM",
            action_code="CREATE",
            entity=None,
            before={"name": "Old"},
            after={"name": "New"},
            reason="Legacy call test",
        )
        self.assertIsNotNone(legacy_log.id)
        self.assertEqual(legacy_log.action_code, "CREATE")
        self.assertEqual(legacy_log.event_category, EventCategory.MASTER_DATA)

    # 17. Cross Company Isolation
    def test_17_cross_company_isolation(self):
        """Audit logs belonging to Company A cannot be retrieved by Company B (BR-AUD-01, 17)."""
        record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="SYS",
            action_code="COMP_A_PRIVATE",
        )
        record_audit(
            company=self.company_b,
            actor_user=self.admin_account,
            module_code="SYS",
            action_code="COMP_B_PRIVATE",
        )

        logs_a = validate_and_filter_audit_logs(self.company_a, self.admin_account, {})
        logs_b = validate_and_filter_audit_logs(self.company_b, self.admin_account, {})

        self.assertTrue(logs_a.filter(action_code="COMP_A_PRIVATE").exists())
        self.assertFalse(logs_a.filter(action_code="COMP_B_PRIVATE").exists())

        self.assertTrue(logs_b.filter(action_code="COMP_B_PRIVATE").exists())
        self.assertFalse(logs_b.filter(action_code="COMP_A_PRIVATE").exists())

    # 18. System and Integration Actor Types
    def test_18_system_and_integration_actor_types(self):
        """Events triggered by backend scheduler or external integration record SYSTEM/INTEGRATION actor types (BR-AUD-13, 14)."""
        sys_log = record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="SYS",
            action_code="AUTO_NIGHTLY_BACKUP",
            actor_type=ActorType.SYSTEM,
            source=AuditSource.JOB,
        )
        self.assertEqual(sys_log.actor_type, ActorType.SYSTEM)
        self.assertEqual(sys_log.source, AuditSource.JOB)

        integ_log = record_audit(
            company=self.company_a,
            actor_user=self.admin_account,
            module_code="TAX",
            action_code="E_INVOICE_SYNC",
            actor_type=ActorType.INTEGRATION,
            source=AuditSource.INTEGRATION,
        )
        self.assertEqual(integ_log.actor_type, ActorType.INTEGRATION)
        self.assertEqual(integ_log.source, AuditSource.INTEGRATION)
