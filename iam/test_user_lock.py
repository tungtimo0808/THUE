from datetime import timedelta
from unittest.mock import patch
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from master_data.models import Currency
from organization.models import Branch, Company, Department, Employee

from .models import (
    ActiveStatus,
    AssignmentStatus,
    CompanyMembership,
    DataScopeBranch,
    DataScopeSet,
    LockRecordStatus,
    LockScope,
    LockType,
    MembershipStatus,
    Permission,
    PermissionAction,
    PermissionResource,
    Role,
    RolePermission,
    TaskHandlingOption,
    UserAccount,
    UserLockRecord,
    UserRoleAssignment,
)
from .permissions import has_effective_permission
from .services import (
    bulk_lock_users,
    bulk_unlock_users,
    get_pending_tasks_for_user,
    get_user_lock_history,
    lock_user,
    process_scheduled_and_expired_locks,
    trigger_security_lock,
    unlock_user,
)


class UserLockTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company_a = Company.objects.create(
            code="COMP_A", name="Doanh nghiệp A", legal_name="Công ty A",
            tax_code="0101111111", status="ACTIVE",
            accounting_currency=currency, legal_reporting_currency=currency,
        )
        self.company_b = Company.objects.create(
            code="COMP_B", name="Doanh nghiệp B", legal_name="Công ty B",
            tax_code="0102222222", status="ACTIVE",
            accounting_currency=currency, legal_reporting_currency=currency,
        )

        self.branch_a1 = Branch.objects.create(company=self.company_a, code="BRA1", name="Chi nhánh A1")
        self.branch_a2 = Branch.objects.create(company=self.company_a, code="BRA2", name="Chi nhánh A2")

        # 1. Superuser / Platform admin
        self.superuser_auth = get_user_model().objects.create_user(
            username="super-admin", email="super@example.com", password="pass", is_superuser=True,
        )
        self.superuser_account = self.superuser_auth.iam_account
        self.superuser_account.display_name = "Super Admin"
        self.superuser_account.save()

        # 2. Company Admin A1
        self.admin_a1_auth = get_user_model().objects.create_user(
            username="admin-a1", email="admina1@example.com", password="pass",
        )
        self.admin_a1 = self.admin_a1_auth.iam_account
        self.admin_a1.display_name = "Admin A1"
        self.admin_a1.save()
        self.membership_admin_a1 = CompanyMembership.objects.create(
            company=self.company_a, user=self.admin_a1, membership_status=MembershipStatus.ACTIVE,
            created_by=self.superuser_account,
        )

        # 3. Company Admin A2 (second admin)
        self.admin_a2_auth = get_user_model().objects.create_user(
            username="admin-a2", email="admina2@example.com", password="pass",
        )
        self.admin_a2 = self.admin_a2_auth.iam_account
        self.admin_a2.display_name = "Admin A2"
        self.admin_a2.save()
        self.membership_admin_a2 = CompanyMembership.objects.create(
            company=self.company_a, user=self.admin_a2, membership_status=MembershipStatus.ACTIVE,
            created_by=self.superuser_account,
        )

        # 4. Target User
        self.target_auth = get_user_model().objects.create_user(
            username="target-user", email="target@example.com", password="pass",
        )
        self.target_user = self.target_auth.iam_account
        self.target_user.display_name = "Target User"
        self.target_user.save()
        self.emp_target = Employee.objects.create(
            company=self.company_a, branch=self.branch_a1, employee_code="EMP_T",
            full_name="Target Employee", status="ACTIVE",
        )
        self.membership_target = CompanyMembership.objects.create(
            company=self.company_a, user=self.target_user, employee=self.emp_target,
            membership_status=MembershipStatus.ACTIVE, created_by=self.admin_a1,
        )

        # 5. Substitute User
        self.sub_auth = get_user_model().objects.create_user(
            username="sub-user", email="sub@example.com", password="pass",
        )
        self.sub_user = self.sub_auth.iam_account
        self.sub_user.display_name = "Substitute User"
        self.sub_user.save()
        self.emp_sub = Employee.objects.create(
            company=self.company_a, branch=self.branch_a1, employee_code="EMP_SUB",
            full_name="Sub Employee", status="ACTIVE",
        )
        self.membership_sub = CompanyMembership.objects.create(
            company=self.company_a, user=self.sub_user, employee=self.emp_sub,
            membership_status=MembershipStatus.ACTIVE, created_by=self.admin_a1,
        )

        # 6. Admin Roles and Assignments
        self.sys_admin_role = Role.objects.create(
            company=self.company_a, code="SYS_ADMIN", name="System Admin",
            is_system_admin=True, status="ACTIVE",
        )
        # Seed permissions if not already attached
        for code in ("SYS.USER.VIEW", "SYS.USER.EDIT", "SYS.USER.LOCK", "SYS.USER.UNLOCK", "SYS.USER.VIEW_SECURITY"):
            p = Permission.objects.filter(code=code).first()
            if p:
                RolePermission.objects.get_or_create(role=self.sys_admin_role, permission=p, defaults={"effect": "ALLOW"})

        UserRoleAssignment.objects.create(
            company_membership=self.membership_admin_a1, role=self.sys_admin_role,
            status=ActiveStatus.ACTIVE, assigned_by=self.superuser_account,
        )
        UserRoleAssignment.objects.create(
            company_membership=self.membership_admin_a2, role=self.sys_admin_role,
            status=ActiveStatus.ACTIVE, assigned_by=self.superuser_account,
        )

        # Target user role
        self.staff_role = Role.objects.create(
            company=self.company_a, code="STAFF", name="Staff", status="ACTIVE",
        )
        p_view = Permission.objects.get(code="SYS.USER.VIEW")
        RolePermission.objects.get_or_create(role=self.staff_role, permission=p_view, defaults={"effect": "ALLOW"})
        self.target_assignment = UserRoleAssignment.objects.create(
            company_membership=self.membership_target, role=self.staff_role,
            status=ActiveStatus.ACTIVE, assigned_by=self.admin_a1,
        )

        self.client = APIClient()

    # 1. Main Flow: Lock User Manual & Immediate
    def test_01_main_flow_lock_manual_immediate(self):
        """Admin locks user manually; access is immediately revoked and audited (Main Flow 2.1, BR-LOCK-09..16)."""
        self.assertTrue(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

        lock_record = lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            lock_type=LockType.MANUAL,
            lock_scope=LockScope.COMPANY_ACCESS,
            lock_reason="Tạm ngừng truy cập do kiểm tra an toàn dữ liệu",
        )

        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.LOCKED)
        self.assertEqual(self.membership_target.access_status, "LOCKED")
        self.assertEqual(lock_record.status, LockRecordStatus.ACTIVE)

        # Backend denies access immediately (BR-LOCK-10, 16)
        self.assertFalse(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

        # Role and permissions remain in DB (BR-LOCK-15)
        self.assertTrue(UserRoleAssignment.objects.filter(company_membership=self.membership_target, status=ActiveStatus.ACTIVE).exists())

        # Audit log is created (BR-LOCK-46, 47)
        log = AuditLog.objects.filter(
            company=self.company_a, action_code="USER_LOCK",
        ).order_by("-occurred_at").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor_user_id, self.admin_a1.id)
        self.assertIn("Tạm ngừng truy cập", log.reason)

    # 2. Main Flow: Unlock User
    def test_02_main_flow_unlock(self):
        """Admin unlocks user; membership restored to ACTIVE and audited (Main Flow 2.2, BR-LOCK-01, 30..34)."""
        # First lock
        lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            lock_reason="Khóa tạm thời",
        )
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.LOCKED)

        # Now unlock
        unlocked_membership = unlock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            unlock_reason="Đã hoàn thành kiểm tra, khôi phục quyền truy cập",
        )

        self.assertEqual(unlocked_membership.membership_status, MembershipStatus.ACTIVE)
        self.assertEqual(unlocked_membership.access_status, "ACTIVE")
        self.assertTrue(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

        # Lock record marked RELEASED
        lock_record = UserLockRecord.objects.filter(membership=self.membership_target).first()
        self.assertEqual(lock_record.status, LockRecordStatus.RELEASED)
        self.assertEqual(lock_record.unlocked_by_id, self.admin_a1.id)
        self.assertIn("Đã hoàn thành kiểm tra", lock_record.unlock_reason)

        # Audit Log created
        log = AuditLog.objects.filter(
            company=self.company_a, action_code="USER_UNLOCK",
        ).order_by("-occurred_at").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor_user_id, self.admin_a1.id)

    # 3. Alternative Flow: Temporary Lock & Auto Unlock
    def test_03_temporary_lock_and_auto_unlock(self):
        """Temporary lock requires valid auto_unlock_at and auto-unlocks when expired (AF-01, AF-10, BR-LOCK-26..28)."""
        now = timezone.now()

        # Validation error if auto_unlock_at <= start_time (EF-10)
        with self.assertRaises(ValidationError):
            lock_user(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_target.id,
                lock_type=LockType.TEMPORARY,
                lock_reason="Khóa tạm",
                start_time=now,
                auto_unlock_at=now - timedelta(hours=1),
            )

        # Successful temporary lock
        lock_rec = lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            lock_type=LockType.TEMPORARY,
            lock_reason="Khóa tạm thời 2 giờ",
            start_time=now,
            auto_unlock_at=now + timedelta(hours=2),
        )
        self.assertEqual(lock_rec.status, LockRecordStatus.ACTIVE)

        # Routine before expiration does nothing
        res_before = process_scheduled_and_expired_locks(at=now + timedelta(hours=1))
        self.assertEqual(res_before["unlocked_count"], 0)
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.LOCKED)

        # Routine after expiration auto-unlocks (AF-10, BR-LOCK-28)
        res_after = process_scheduled_and_expired_locks(at=now + timedelta(hours=3))
        self.assertEqual(res_after["unlocked_count"], 1)
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.ACTIVE)

        # System audit log recorded (BR-LOCK-48)
        log = AuditLog.objects.filter(company=self.company_a, action_code="USER_UNLOCK").order_by("-occurred_at").first()
        self.assertEqual(log.actor_type, "SYSTEM")

    # 4. Alternative Flow: Scheduled Lock
    def test_04_scheduled_lock(self):
        """Scheduled lock sets status SCHEDULED_LOCK and activates when start_time arrives (AF-02, BR-LOCK-27)."""
        now = timezone.now()
        future_start = now + timedelta(days=2)

        lock_rec = lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            lock_type=LockType.SCHEDULED,
            lock_reason="Lên lịch khóa tài khoản từ tuần sau",
            start_time=future_start,
        )
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.SCHEDULED_LOCK)
        self.assertEqual(lock_rec.status, LockRecordStatus.PENDING)

        # User still has active permission before start_time
        self.assertTrue(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

        # Routine executes at future_start + 1 hour -> activates lock (BR-LOCK-27)
        res = process_scheduled_and_expired_locks(at=future_start + timedelta(hours=1))
        self.assertEqual(res["activated_count"], 1)
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.LOCKED)
        self.assertFalse(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

    # 5. Task Handling: Transfer
    def test_05_task_handling_transfer(self):
        """When locking with TRANSFER, pending tasks are reassigned to substitute user (BR-LOCK-20, 21, EF-11)."""
        from approval_workflows.models import ApprovalRequest, ApprovalTask, Workflow, WorkflowVersion
        from master_data.models import DocumentType
        doc_type, _ = DocumentType.objects.get_or_create(
            code="PO",
            defaults={"name": "Đơn mua", "module_code": "PURCHASE", "document_class": "ORDER"}
        )
        wf, _ = Workflow.objects.get_or_create(
            company=self.company_a,
            code="WF_PO",
            defaults={"name": "Quy trình đơn mua", "document_type": doc_type, "created_by": self.admin_a1}
        )
        wf_ver, _ = WorkflowVersion.objects.get_or_create(
            workflow=wf,
            number=1,
            defaults={"effective_from": timezone.now().date(), "status": WorkflowVersion.State.ACTIVE, "created_by": self.admin_a1}
        )
        req = ApprovalRequest.objects.create(
            company=self.company_a, document_type=doc_type, source_model="purchases.PurchaseOrder",
            source_id=uuid.uuid4(), round_number=1, workflow_version=wf_ver, submitted_by=self.admin_a1,
        )
        task = ApprovalTask.objects.create(request=req, step_order=1, cycle=1, assignee=self.target_user)

        # Grant substitute user approval permission
        res_po, _ = PermissionResource.objects.get_or_create(code="PO", defaults={"name": "Đơn mua", "module_code": "PURCHASE"})
        act_app, _ = PermissionAction.objects.get_or_create(code="APPROVE", defaults={"name": "Phê duyệt"})
        perm_approve, _ = Permission.objects.get_or_create(
            code="PO.APPROVE",
            defaults={
                "id": uuid.uuid4(),
                "resource": res_po,
                "action": act_app,
                "description": "Approve PO",
                "status": "ACTIVE",
            },
        )
        sub_role = Role.objects.create(company=self.company_a, code="APPROVER", name="Approver Role", status="ACTIVE")
        RolePermission.objects.create(role=sub_role, permission=perm_approve, effect="ALLOW")
        UserRoleAssignment.objects.create(company_membership=self.membership_sub, role=sub_role, status=ActiveStatus.ACTIVE, assigned_by=self.admin_a1)

        # Transfer tasks to sub_user
        lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            lock_reason="Chuyển công việc phê duyệt",
            task_handling=TaskHandlingOption.TRANSFER,
            substitute_user_id=self.sub_user.id,
        )

        task.refresh_from_db()
        self.assertEqual(task.status, "FORWARDED")
        self.assertEqual(task.forwarded_to_id, self.sub_user.id)

        new_task = ApprovalTask.objects.filter(request=req, assignee=self.sub_user, status="PENDING").first()
        self.assertIsNotNone(new_task)

    # 6. Cannot lock or unlock terminated membership
    def test_06_cannot_lock_or_unlock_ended_membership(self):
        """Membership with status TERMINATED cannot be locked or unlocked (BR-LOCK-35, EF-04, EF-18)."""
        self.membership_target.membership_status = MembershipStatus.TERMINATED
        self.membership_target.save()

        # Lock fails
        with self.assertRaises(ValidationError) as ctx:
            lock_user(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_target.id,
                lock_reason="Thử khóa",
            )
        self.assertIn("ENDED", str(ctx.exception))

        # Unlock fails
        with self.assertRaises(ValidationError) as ctx2:
            unlock_user(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_target.id,
                unlock_reason="Thử mở",
            )
        self.assertIn("ENDED", str(ctx2.exception))

    # 7. Cannot lock already locked user
    def test_07_cannot_lock_already_locked_user(self):
        """Attempting to lock a user who is already locked returns validation error (EF-05)."""
        lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            lock_reason="Khóa lần 1",
        )
        with self.assertRaises(ValidationError):
            lock_user(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_target.id,
                lock_reason="Khóa lần 2",
            )

    # 8. Actor permission enforcement
    def test_08_actor_permission_checks(self):
        """Actor without SYS.USER.LOCK cannot lock and without SYS.USER.UNLOCK cannot unlock (BR-LOCK-03, EF-03, EF-16)."""
        # Target user tries to lock sub_user
        with self.assertRaises(PermissionDenied):
            lock_user(
                company=self.company_a,
                actor=self.target_user,
                target_membership_id=self.membership_sub.id,
                lock_reason="Không có quyền",
            )

        # Lock sub_user properly
        lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_sub.id,
            lock_reason="Khóa hợp lệ",
        )

        # Target user tries to unlock sub_user
        with self.assertRaises(PermissionDenied):
            unlock_user(
                company=self.company_a,
                actor=self.target_user,
                target_membership_id=self.membership_sub.id,
                unlock_reason="Không có quyền mở",
            )

    # 9. Data Scope restriction
    def test_09_data_scope_restriction(self):
        """Actor with restricted branch scope cannot lock user in another branch (BR-LOCK-04, EF-06)."""
        # Create scoped admin in Branch A2
        scoped_admin_auth = get_user_model().objects.create_user(username="branch-admin", password="pass")
        scoped_admin = scoped_admin_auth.iam_account
        scoped_emp = Employee.objects.create(company=self.company_a, branch=self.branch_a2, full_name="Branch Admin", status="ACTIVE")
        scoped_membership = CompanyMembership.objects.create(
            company=self.company_a, user=scoped_admin, employee=scoped_emp,
            membership_status=MembershipStatus.ACTIVE, created_by=self.admin_a1,
        )

        # Scoped role for Branch A2 only
        scoped_set = DataScopeSet.objects.create(company=self.company_a, code="SCOPE_BRA2", name="Branch A2 Only", created_by=self.admin_a1)
        DataScopeBranch.objects.create(data_scope_set=scoped_set, branch=self.branch_a2)
        scoped_role = Role.objects.create(company=self.company_a, code="BRANCH_ADMIN_ROLE", name="Branch Admin Role", status="ACTIVE")
        RolePermission.objects.create(role=scoped_role, permission=Permission.objects.get(code="SYS.USER.LOCK"))
        RolePermission.objects.create(role=scoped_role, permission=Permission.objects.get(code="SYS.USER.VIEW"))
        UserRoleAssignment.objects.create(company_membership=scoped_membership, role=scoped_role, data_scope_set=scoped_set, assigned_by=self.admin_a1)

        # Target user is in Branch A1 -> scoped admin cannot lock target (EF-06)
        with self.assertRaises(PermissionDenied):
            lock_user(
                company=self.company_a,
                actor=scoped_admin,
                target_membership_id=self.membership_target.id,
                lock_reason="Cố gắng khóa ngoài scope",
            )

    # 10. Last Active System Admin Protection
    def test_10_last_system_admin_protection(self):
        """Cannot lock the last active system admin of the company (BR-LOCK-23, EF-08)."""
        # Deactivate admin_a2's system admin role assignment so admin_a1 is the ONLY active admin
        UserRoleAssignment.objects.filter(company_membership=self.membership_admin_a2).update(status=ActiveStatus.INACTIVE)

        with self.assertRaises(ValidationError) as ctx:
            lock_user(
                company=self.company_a,
                actor=self.superuser_account,
                target_membership_id=self.membership_admin_a1.id,
                lock_reason="Cố khóa admin duy nhất",
            )
        self.assertIn("User quản trị hoạt động cuối cùng", str(ctx.exception))

    # 11. Self Lock Protection in Single Member Enterprise
    def test_11_single_member_enterprise_self_lock_protection(self):
        """User cannot lock their own sole admin account in the enterprise (BR-LOCK-24, EF-07)."""
        # Deactivate admin_a2
        UserRoleAssignment.objects.filter(company_membership=self.membership_admin_a2).update(status=ActiveStatus.INACTIVE)

        with self.assertRaises(ValidationError) as ctx:
            lock_user(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_admin_a1.id,
                lock_reason="Tự khóa chính mình",
            )
        self.assertIn("Không thể tự khóa chính mình", str(ctx.exception))

    # 12. Cross Company Isolation
    def test_12_company_isolation(self):
        """Locking user in Company A does NOT revoke access to Company B (BR-LOCK-05, BR-LOCK-13, AF-08)."""
        # Give target user membership in Company B
        membership_b = CompanyMembership.objects.create(
            company=self.company_b, user=self.target_user, membership_status=MembershipStatus.ACTIVE,
            created_by=self.superuser_account,
        )
        role_b = Role.objects.create(company=self.company_b, code="ROLE_B", name="Role B", status="ACTIVE")
        RolePermission.objects.create(role=role_b, permission=Permission.objects.get(code="SYS.USER.VIEW"))
        UserRoleAssignment.objects.create(company_membership=membership_b, role=role_b, status=ActiveStatus.ACTIVE, assigned_by=self.superuser_account)

        # Lock user in Company A
        lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            lock_reason="Khóa tại Công ty A",
        )

        # Target is LOCKED in Company A
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.LOCKED)
        self.assertFalse(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

        # Target is still ACTIVE in Company B! (BR-LOCK-13)
        membership_b.refresh_from_db()
        self.assertEqual(membership_b.membership_status, MembershipStatus.ACTIVE)
        self.assertTrue(has_effective_permission(self.target_user, self.company_b, "SYS.USER.VIEW"))

    # 13. Global Account Lock Requires Platform Admin
    def test_13_global_account_lock_requires_platform_admin(self):
        """Company admin cannot perform GLOBAL_ACCOUNT lock; platform admin can (BR-LOCK-05..07, 14, EF-19)."""
        # Company admin tries global lock -> rejected (BR-LOCK-06)
        with self.assertRaises(PermissionDenied):
            lock_user(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_target.id,
                lock_scope=LockScope.GLOBAL_ACCOUNT,
                lock_reason="Admin thường thử khóa toàn cầu",
            )

        # Superuser performs global lock
        lock_rec = lock_user(
            company=self.company_a,
            actor=self.superuser_account,
            target_membership_id=self.membership_target.id,
            lock_scope=LockScope.GLOBAL_ACCOUNT,
            lock_reason="Khóa toàn hệ thống",
        )
        self.assertEqual(lock_rec.lock_scope, LockScope.GLOBAL_ACCOUNT)

    # 14. Security Lock and Failed Login Attempts
    def test_14_security_lock_and_failed_logins(self):
        """Failed login attempts exceeding limit trigger SECURITY_LOCK with system audit (BR-LOCK-37, 38)."""
        self.target_user.failed_login_count = 4
        self.target_user.save()

        # 5th attempt triggers security lock
        rec = trigger_security_lock(
            user_account=self.target_user,
            company=self.company_a,
            reason="Nhập sai mật khẩu 5 lần liên tiếp",
            max_attempts=5,
        )
        self.assertIsNotNone(rec)
        self.assertEqual(rec.lock_type, LockType.SECURITY)
        self.assertEqual(rec.lock_scope, LockScope.SECURITY_LOCK)

        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.LOCKED)

        # Security lock does NOT auto-unlock (BR-LOCK-29)
        process_scheduled_and_expired_locks(at=timezone.now() + timedelta(hours=5))
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.LOCKED)

    # 15. Role Expiration During Lock
    def test_15_role_expiration_during_lock(self):
        """Roles that expire during lock period are NOT restored upon unlock (BR-LOCK-32, 33)."""
        now = timezone.now()
        # Set target assignment valid_to in 1 hour
        self.target_assignment.valid_to = now + timedelta(hours=1)
        self.target_assignment.save()

        lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            lock_reason="Khóa bảo trì",
        )

        # Fast-forward 2 hours and unlock
        future = now + timedelta(hours=2)
        with patch("django.utils.timezone.now", return_value=future):
            unlock_user(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_target.id,
                unlock_reason="Mở lại sau bảo trì",
            )
            self.target_assignment.refresh_from_db()
            self.assertEqual(self.target_assignment.status, AssignmentStatus.EXPIRED)
            self.assertFalse(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

    # 16. Bulk Lock and Bulk Unlock
    def test_16_bulk_lock_and_bulk_unlock(self):
        """Bulk lock processes users independently; errors on one user do not fail others (AF-15, BR-LOCK-44, 45)."""
        # Terminate substitute user to force an error on 1 item
        self.membership_sub.membership_status = MembershipStatus.TERMINATED
        self.membership_sub.save()

        items = [
            {"membership_id": str(self.membership_target.id), "lock_reason": "Bulk lock user 1"},
            {"membership_id": str(self.membership_sub.id), "lock_reason": "Bulk lock user 2 (fail)"},
        ]
        res = bulk_lock_users(company=self.company_a, actor=self.admin_a1, items=items)

        self.assertEqual(len(res["succeeded"]), 1)
        self.assertEqual(len(res["failed"]), 1)
        self.assertEqual(res["succeeded"][0]["id"], str(self.membership_target.id))
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.LOCKED)

        # Bulk unlock
        unlock_items = [{"membership_id": str(self.membership_target.id), "unlock_reason": "Bulk unlock"}]
        unlock_res = bulk_unlock_users(company=self.company_a, actor=self.admin_a1, items=unlock_items)
        self.assertEqual(len(unlock_res["succeeded"]), 1)
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.ACTIVE)

    # 17. REST API Endpoints: Lock, Unlock, History, and Pending Tasks
    def test_17_api_lock_unlock_and_history(self):
        """REST API endpoints perform lock, unlock, history, and task querying via DRF."""
        self.client.force_authenticate(user=self.admin_a1_auth)

        # 1. Pending tasks check
        res_tasks = self.client.get(f"/api/v1/iam/memberships/{self.membership_target.id}/pending-tasks/?company_id={self.company_a.id}")
        self.assertEqual(res_tasks.status_code, status.HTTP_200_OK)
        self.assertIn("pending_tasks_count", res_tasks.data)

        # 2. Lock via API
        lock_payload = {
            "lock_type": "MANUAL",
            "lock_scope": "COMPANY_ACCESS",
            "lock_reason": "Khóa qua API",
            "task_handling": "KEEP",
        }
        res_lock = self.client.post(
            f"/api/v1/iam/memberships/{self.membership_target.id}/lock/?company_id={self.company_a.id}",
            lock_payload, format="json",
        )
        self.assertEqual(res_lock.status_code, status.HTTP_200_OK)
        self.assertEqual(res_lock.data["membership"]["membership_status"], "LOCKED")
        self.assertEqual(res_lock.data["membership"]["access_status"], "LOCKED")
        self.assertIsNotNone(res_lock.data["membership"]["active_lock"])

        # 3. Lock history via API
        res_hist = self.client.get(f"/api/v1/iam/memberships/{self.membership_target.id}/lock-history/?company_id={self.company_a.id}")
        self.assertEqual(res_hist.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res_hist.data), 1)

        # 4. User locks list endpoint
        res_locks_list = self.client.get(f"/api/v1/iam/user-locks/?company_id={self.company_a.id}")
        self.assertEqual(res_locks_list.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res_locks_list.data["results"] if "results" in res_locks_list.data else res_locks_list.data), 1)

        # 5. Unlock via API
        unlock_payload = {"unlock_reason": "Mở khóa qua API"}
        res_unlock = self.client.post(
            f"/api/v1/iam/memberships/{self.membership_target.id}/unlock/?company_id={self.company_a.id}",
            unlock_payload, format="json",
        )
        self.assertEqual(res_unlock.status_code, status.HTTP_200_OK)
        self.assertEqual(res_unlock.data["membership"]["membership_status"], "ACTIVE")

    # 18. Require Password Change on Unlock
    def test_18_require_password_change_on_unlock(self):
        """Unlocking with require_password_change=True resets password_changed_at (AF-11, BR-LOCK-29)."""
        self.target_user.password_changed_at = timezone.now()
        self.target_user.save()

        lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            lock_reason="Khóa kiểm tra mật khẩu",
        )

        unlock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            unlock_reason="Mở khóa và yêu cầu đổi mật khẩu",
            require_password_change=True,
        )

        self.target_user.refresh_from_db()
        self.assertIsNone(self.target_user.password_changed_at)
        lock_rec = UserLockRecord.objects.filter(membership=self.membership_target).first()
        self.assertTrue(lock_rec.require_password_change)
