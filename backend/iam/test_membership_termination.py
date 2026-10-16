from datetime import timedelta
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from master_data.models import Currency, DocumentType
from organization.models import Branch, Company, Department, Employee

from .models import (
    ActiveStatus,
    AssignmentStatus,
    CompanyMembership,
    DataScopeBranch,
    DataScopeSet,
    DraftHandlingOption,
    ExitRequestStatus,
    JobHandlingOption,
    MembershipExitRequest,
    MembershipStatus,
    MembershipTerminationRecord,
    OrganizationAssignment,
    Permission,
    PermissionAction,
    PermissionResource,
    Role,
    RolePermission,
    TaskHandlingOption,
    TerminationRecordStatus,
    TerminationType,
    UserAccount,
    UserRoleAssignment,
)
from .permissions import has_effective_permission
from .services import (
    approve_membership_exit,
    cancel_membership_exit,
    cancel_scheduled_termination,
    get_membership_history,
    get_membership_impact_analysis,
    lock_user,
    process_scheduled_terminations,
    reject_membership_exit,
    request_membership_exit,
    terminate_membership,
    unlock_user,
)


class MembershipTerminationTests(TestCase):
    def setUp(self):
        # 1. Currency & Company A
        self.currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company_a = Company.objects.create(
            code="COMP_A", name="Công ty A", legal_name="Công ty A", tax_code="0101010101", status="ACTIVE",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.branch_a1 = Branch.objects.create(
            company=self.company_a, code="BR_A1", name="Chi nhánh A1"
        )
        self.dept_a1 = Department.objects.create(
            company=self.company_a, branch=self.branch_a1, code="DEPT_A1", name="Phòng Kế toán"
        )

        # Company B for isolation test
        self.company_b = Company.objects.create(
            code="COMP_B", name="Công ty B", legal_name="Công ty B", tax_code="0202020202", status="ACTIVE",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )

        # Superuser
        self.superuser_auth = get_user_model().objects.create_superuser(
            username="superadmin", email="super@example.com", password="pass",
        )
        self.superuser_account = self.superuser_auth.iam_account
        self.superuser_account.display_name = "Super Admin"
        self.superuser_account.save()

        # Admin A1
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

        # Admin A2 (second admin)
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

        # Target User
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

        # Substitute User
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

        # System Admin Role
        self.sys_admin_role = Role.objects.create(
            company=self.company_a, code="SYS_ADMIN", name="System Admin",
            is_system_admin=True, status="ACTIVE",
        )
        UserRoleAssignment.objects.create(
            company_membership=self.membership_admin_a1, role=self.sys_admin_role,
            status=ActiveStatus.ACTIVE, assigned_by=self.superuser_account,
        )
        UserRoleAssignment.objects.create(
            company_membership=self.membership_admin_a2, role=self.sys_admin_role,
            status=ActiveStatus.ACTIVE, assigned_by=self.superuser_account,
        )

        # Permissions
        res_user, _ = PermissionResource.objects.get_or_create(code="SYS.USER", defaults={"name": "User", "module_code": "IAM"})
        for act_code, act_name in (
            ("VIEW", "Xem"), ("EDIT", "Sửa"), ("LOCK", "Khóa"),
            ("UNLOCK", "Mở khóa"), ("TERMINATE", "Ngừng tham gia"), ("VIEW_HISTORY", "Xem lịch sử")
        ):
            act, _ = PermissionAction.objects.get_or_create(code=act_code, defaults={"name": act_name})
            p, _ = Permission.objects.get_or_create(
                code=f"SYS.USER.{act_code}",
                defaults={"resource": res_user, "action": act, "description": act_name, "status": "ACTIVE"},
            )
            RolePermission.objects.get_or_create(role=self.sys_admin_role, permission=p, defaults={"effect": "ALLOW"})

        # Regular Role for Target User
        self.accountant_role = Role.objects.create(
            company=self.company_a, code="ACCOUNTANT", name="Kế toán viên", status="ACTIVE",
        )
        p_view = Permission.objects.get(code="SYS.USER.VIEW")
        RolePermission.objects.create(role=self.accountant_role, permission=p_view, effect="ALLOW")

        self.target_scope = DataScopeSet.objects.create(
            company=self.company_a, code="SCOPE_BR_A1", name="Phạm vi Branch A1",
            allow_all_company_data=True, status=ActiveStatus.ACTIVE, created_by=self.admin_a1,
        )
        DataScopeBranch.objects.create(data_scope_set=self.target_scope, branch=self.branch_a1)

        self.asg_target = UserRoleAssignment.objects.create(
            company_membership=self.membership_target, role=self.accountant_role,
            data_scope_set=self.target_scope, status=ActiveStatus.ACTIVE, assigned_by=self.admin_a1,
        )

        # Organization Assignment for Target User
        from organization.models import OrganizationUnit
        self.org_unit = OrganizationUnit.objects.create(
            company=self.company_a, code="OU_KT", name="Đơn vị Kế toán",
            unit_type=OrganizationUnit.UnitType.DEPARTMENT,
            start_date=timezone.now().date() - timedelta(days=100),
            created_by_user_id=self.admin_a1.id, updated_by_user_id=self.admin_a1.id,
        )
        self.org_asg = OrganizationAssignment.objects.create(
            membership=self.membership_target,
            unit=self.org_unit,
            assignment_type=OrganizationAssignment.Type.PRIMARY,
            job_title="Chuyên viên kế toán",
            start_date=timezone.now().date() - timedelta(days=30),
            status=OrganizationAssignment.State.ACTIVE,
            created_by=self.admin_a1,
        )

        self.client = APIClient()

    # 1. Main Flow: Immediate Termination
    def test_01_terminate_membership_immediate_success(self):
        """Admin terminates user immediately (Main Flow, BR-MEM-END-09, 13..18)."""
        self.assertTrue(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

        now = timezone.now()
        rec = terminate_membership(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            termination_type=TerminationType.IMMEDIATE,
            reason="Nhân viên nghỉ việc theo nguyện vọng cá nhân",
        )

        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.ENDED)
        self.assertIsNotNone(self.membership_target.left_at)
        self.assertEqual(rec.status, TerminationRecordStatus.COMPLETED)

        # Role assignment expired (BR-MEM-END-13, 17, 18)
        self.asg_target.refresh_from_db()
        self.assertEqual(self.asg_target.status, AssignmentStatus.EXPIRED)
        self.assertIsNotNone(self.asg_target.valid_to)

        # Organization assignment revoked (BR-MEM-END-16)
        self.org_asg.refresh_from_db()
        self.assertEqual(self.org_asg.status, OrganizationAssignment.State.REVOKED)

        # Backend immediately denies access (BR-MEM-END-09, 10)
        self.assertFalse(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

        # Audit log verified (BR-MEM-END-51, 52)
        log = AuditLog.objects.filter(entity_id=rec.id, action_code="MEMBERSHIP_TERMINATE").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor_user_id, self.admin_a1.id)

    # 2. Scheduled Termination & Cancellation (AF-02, AF-12, BR-MEM-END-07, 08)
    def test_02_scheduled_termination_and_cancellation(self):
        """Scheduled termination sets END_SCHEDULED, allows access until due date, can be cancelled."""
        future_date = timezone.now() + timedelta(days=7)
        rec = terminate_membership(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            termination_type=TerminationType.SCHEDULED,
            reason="Hết hạn hợp đồng vào tuần tới",
            effective_at=future_date,
        )

        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.END_SCHEDULED)
        self.assertEqual(rec.status, TerminationRecordStatus.PENDING)

        # User retains access before effective date (BR-MEM-END-07)
        self.assertTrue(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

        # Cancel scheduled termination (AF-12, BR-MEM-END-08)
        cancel_scheduled_termination(
            company=self.company_a,
            actor=self.admin_a1,
            membership_id=self.membership_target.id,
            reason="Gia hạn hợp đồng lao động thêm 1 năm",
        )
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.ACTIVE)
        rec.refresh_from_db()
        self.assertEqual(rec.status, TerminationRecordStatus.CANCELLED)

    # 3. Scheduled Termination Background Routine Execution (BR-MEM-END-07)
    def test_03_process_scheduled_terminations_routine(self):
        """Routine processes due END_SCHEDULED memberships and marks them ENDED."""
        future_date = timezone.now() + timedelta(days=3)
        rec = terminate_membership(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            termination_type=TerminationType.SCHEDULED,
            reason="Hết thời hạn thử việc",
            effective_at=future_date,
        )
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.END_SCHEDULED)

        # Execute routine at future_date + 1 hour
        res = process_scheduled_terminations(at=future_date + timedelta(hours=1))
        self.assertEqual(res["completed_count"], 1)

        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.ENDED)
        rec.refresh_from_db()
        self.assertEqual(rec.status, TerminationRecordStatus.COMPLETED)
        self.assertFalse(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

    # 4. Impact Analysis (Main Flow Step 6, 7)
    def test_04_membership_impact_analysis(self):
        """Impact analysis reports active roles, scopes, org assignments, and admin status."""
        data = get_membership_impact_analysis(self.company_a, self.membership_target.id, self.admin_a1)
        self.assertEqual(data["membership_id"], str(self.membership_target.id))
        self.assertEqual(data["current_status"], "ACTIVE")
        self.assertFalse(data["is_last_admin"])
        self.assertFalse(data["is_owner"])
        self.assertEqual(len(data["active_roles"]), 1)
        self.assertEqual(data["active_roles"][0]["code"], "ACCOUNTANT")
        self.assertEqual(len(data["org_assignments"]), 1)

    # 5. User Exit Request: Request, Approve, Reject (Main Flow 2.2)
    def test_05_user_exit_request_flow(self):
        """User requests exit, Admin approves and completes termination."""
        req = request_membership_exit(
            company=self.company_a,
            user=self.target_user,
            reason="Chuyển công tác về quê",
            desired_effective_date=timezone.now() + timedelta(days=14),
            note="Đã bàn giao tài sản",
        )
        self.assertEqual(req.status, ExitRequestStatus.PENDING)

        # Admin approves request
        approved = approve_membership_exit(
            company=self.company_a,
            actor=self.admin_a1,
            request_id=req.id,
            termination_type=TerminationType.VOLUNTARY,
            effective_at=timezone.now(),  # immediate approval
        )
        self.assertEqual(approved.status, ExitRequestStatus.APPROVED)
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.ENDED)

    # 6. User Exit Request Rejection & User Cancel
    def test_06_user_exit_request_reject_and_cancel(self):
        """Admin can reject exit request and User can cancel pending request."""
        # 1. Rejection
        req1 = request_membership_exit(
            company=self.company_a,
            user=self.target_user,
            reason="Xin nghỉ",
        )
        rejected = reject_membership_exit(
            company=self.company_a,
            actor=self.admin_a1,
            request_id=req1.id,
            rejection_reason="Chưa hết thời hạn cam kết đào tạo",
        )
        self.assertEqual(rejected.status, ExitRequestStatus.REJECTED)

        # 2. Cancel by User
        req2 = request_membership_exit(
            company=self.company_a,
            user=self.target_user,
            reason="Xin nghỉ việc",
        )
        cancelled = cancel_membership_exit(
            company=self.company_a,
            user=self.target_user,
            request_id=req2.id,
        )
        self.assertEqual(cancelled.status, ExitRequestStatus.CANCELLED)

    # 7. Task Handling: Transfer
    def test_07_task_handling_transfer(self):
        """Pending approval tasks are transferred to substitute user (BR-MEM-END-23, 24, 25, EF-08, EF-09)."""
        from approval_workflows.models import ApprovalRequest, ApprovalTask, Workflow, WorkflowVersion
        doc_type, _ = DocumentType.objects.get_or_create(
            code="PO", defaults={"name": "Đơn mua", "module_code": "PURCHASE", "document_class": "ORDER"}
        )
        wf, _ = Workflow.objects.get_or_create(
            company=self.company_a, code="WF_PO_TERM", defaults={"name": "Quy trình mua hàng", "document_type": doc_type, "created_by": self.admin_a1}
        )
        wf_ver, _ = WorkflowVersion.objects.get_or_create(
            workflow=wf, number=1, defaults={"effective_from": timezone.now().date(), "status": WorkflowVersion.State.ACTIVE, "created_by": self.admin_a1}
        )
        app_req = ApprovalRequest.objects.create(
            company=self.company_a, document_type=doc_type, source_model="purchases.PurchaseOrder",
            source_id=uuid.uuid4(), round_number=1, workflow_version=wf_ver, submitted_by=self.admin_a1,
        )
        task = ApprovalTask.objects.create(request=app_req, step_order=1, cycle=1, assignee=self.target_user)

        # Grant substitute user approval permission
        res_po, _ = PermissionResource.objects.get_or_create(code="PO", defaults={"name": "Đơn mua", "module_code": "PURCHASE"})
        act_app, _ = PermissionAction.objects.get_or_create(code="APPROVE", defaults={"name": "Phê duyệt"})
        perm_app, _ = Permission.objects.get_or_create(
            code="PO.APPROVE", defaults={"id": uuid.uuid4(), "resource": res_po, "action": act_app, "description": "Approve", "status": "ACTIVE"}
        )
        sub_role = Role.objects.create(company=self.company_a, code="SUB_APPROVER", name="Sub Approver", status="ACTIVE")
        RolePermission.objects.create(role=sub_role, permission=perm_app, effect="ALLOW")
        UserRoleAssignment.objects.create(company_membership=self.membership_sub, role=sub_role, status=ActiveStatus.ACTIVE, assigned_by=self.admin_a1)

        # Terminate with TRANSFER
        terminate_membership(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            termination_type=TerminationType.IMMEDIATE,
            reason="Nghỉ việc và bàn giao công việc",
            task_handling=TaskHandlingOption.TRANSFER,
            substitute_user_id=self.sub_user.id,
        )

        task.refresh_from_db()
        self.assertEqual(task.status, "FORWARDED")
        self.assertEqual(task.forwarded_to_id, self.sub_user.id)

        new_task = ApprovalTask.objects.filter(request=app_req, assignee=self.sub_user, status="PENDING").first()
        self.assertIsNotNone(new_task)

    # 8. Task Handling: Unassigned (EF-17)
    def test_08_task_handling_unassigned(self):
        """Tasks set to unassigned when task_handling is UNASSIGNED (EF-17, BR-MEM-END-24)."""
        from approval_workflows.models import ApprovalRequest, ApprovalTask, Workflow, WorkflowVersion
        doc_type, _ = DocumentType.objects.get_or_create(
            code="PO", defaults={"name": "Đơn mua", "module_code": "PURCHASE", "document_class": "ORDER"}
        )
        wf, _ = Workflow.objects.get_or_create(
            company=self.company_a, code="WF_PO_UNASG", defaults={"name": "Quy trình mua hàng", "document_type": doc_type, "created_by": self.admin_a1}
        )
        wf_ver, _ = WorkflowVersion.objects.get_or_create(
            workflow=wf, number=1, defaults={"effective_from": timezone.now().date(), "status": WorkflowVersion.State.ACTIVE, "created_by": self.admin_a1}
        )
        app_req = ApprovalRequest.objects.create(
            company=self.company_a, document_type=doc_type, source_model="purchases.PurchaseOrder",
            source_id=uuid.uuid4(), round_number=1, workflow_version=wf_ver, submitted_by=self.admin_a1,
        )
        task = ApprovalTask.objects.create(request=app_req, step_order=1, cycle=1, assignee=self.target_user)

        terminate_membership(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            termination_type=TerminationType.IMMEDIATE,
            reason="Nghỉ việc không người thay thế",
            task_handling=TaskHandlingOption.UNASSIGNED,
        )

        task.refresh_from_db()
        self.assertIsNone(task.assignee)
        self.assertEqual(task.status, "PENDING")

    # 9. Cannot terminate last active admin (BR-MEM-END-31, EF-11)
    def test_09_cannot_terminate_last_active_admin(self):
        """Cannot terminate last admin of company (BR-MEM-END-31, EF-11)."""
        # Demote admin_a2 so admin_a1 is the ONLY active admin
        UserRoleAssignment.objects.filter(company_membership=self.membership_admin_a2).delete()

        with self.assertRaises(ValidationError) as ctx:
            terminate_membership(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_admin_a1.id,
                termination_type=TerminationType.IMMEDIATE,
                reason="Admin duy nhất nghỉ việc",
            )
        self.assertIn("user", ctx.exception.detail)

    # 10. Cannot self-terminate when sole admin (BR-MEM-END-33, EF-12)
    def test_10_cannot_self_terminate_sole_admin(self):
        """Sole admin cannot self-terminate (BR-MEM-END-33, EF-12)."""
        UserRoleAssignment.objects.filter(company_membership=self.membership_admin_a2).delete()
        with self.assertRaises(ValidationError) as ctx:
            terminate_membership(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_admin_a1.id,
                termination_type=TerminationType.IMMEDIATE,
                reason="Tự nghỉ việc",
            )
        self.assertIn("user", ctx.exception.detail)

    # 11. Cannot terminate already ENDED membership (EF-03)
    def test_11_cannot_terminate_already_ended_membership(self):
        """Cannot terminate a membership that is already ENDED (EF-03)."""
        self.membership_target.membership_status = MembershipStatus.ENDED
        self.membership_target.save()

        with self.assertRaises(ValidationError) as ctx:
            terminate_membership(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_target.id,
                termination_type=TerminationType.IMMEDIATE,
                reason="Thử ngừng lại",
            )
        self.assertIn("membership", ctx.exception.detail)

    # 12. Terminate LOCKED user works (BR-MEM-END-35, AF-11)
    def test_12_terminate_locked_user(self):
        """User in LOCKED status can be terminated (BR-MEM-END-35, AF-11)."""
        lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            lock_reason="Tạm khóa để kiểm tra vi phạm",
        )
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.LOCKED)

        # Now terminate
        rec = terminate_membership(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            termination_type=TerminationType.SECURITY,
            reason="Chấm dứt do vi phạm kỷ luật sau thời gian tạm khóa",
        )
        self.membership_target.refresh_from_db()
        self.assertEqual(self.membership_target.membership_status, MembershipStatus.ENDED)
        self.assertEqual(rec.termination_type, TerminationType.SECURITY)

    # 13. Cannot unlock ENDED membership via UC-SYS-17 (BR-MEM-END-36)
    def test_13_cannot_unlock_ended_membership(self):
        """Ended membership cannot be unlocked via unlock_user service (BR-MEM-END-36)."""
        terminate_membership(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            termination_type=TerminationType.IMMEDIATE,
            reason="Chấm dứt hợp đồng",
        )
        with self.assertRaises(ValidationError):
            unlock_user(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_target.id,
                unlock_reason="Thử mở khóa lại",
            )

    # 14. Employee profile preserved when membership ended (BR-MEM-END-41, 42)
    def test_14_employee_profile_preserved(self):
        """Terminating membership does not terminate or alter employee profile (BR-MEM-END-41, 42)."""
        terminate_membership(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            termination_type=TerminationType.IMMEDIATE,
            reason="Ngừng tài khoản User nhưng hồ sơ Nhân sự giữ nguyên",
        )
        self.emp_target.refresh_from_db()
        self.assertEqual(self.emp_target.status, "ACTIVE")
        self.assertEqual(self.emp_target.full_name, "Target Employee")

    # 15. Multi-Company Isolation (BR-MEM-END-01..03, AF-13)
    def test_15_multi_company_isolation(self):
        """Terminating membership in Company A does not affect membership/permissions in Company B (BR-MEM-END-01..03, AF-13)."""
        # Create membership and role for Target User in Company B
        mem_b = CompanyMembership.objects.create(
            company=self.company_b, user=self.target_user,
            membership_status=MembershipStatus.ACTIVE, created_by=self.superuser_account,
        )
        role_b = Role.objects.create(company=self.company_b, code="ACC_B", name="Accountant B", status="ACTIVE")
        RolePermission.objects.create(role=role_b, permission=Permission.objects.get(code="SYS.USER.VIEW"))
        UserRoleAssignment.objects.create(company_membership=mem_b, role=role_b, status=ActiveStatus.ACTIVE, assigned_by=self.superuser_account)

        # Terminate in Company A
        terminate_membership(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            termination_type=TerminationType.IMMEDIATE,
            reason="Nghỉ việc tại Công ty A",
        )

        # Target user lost access in Company A
        self.assertFalse(has_effective_permission(self.target_user, self.company_a, "SYS.USER.VIEW"))

        # Target user retains access in Company B (BR-MEM-END-03, AF-13)
        self.assertTrue(has_effective_permission(self.target_user, self.company_b, "SYS.USER.VIEW"))

    # 16. Membership History Timeline (AF-17)
    def test_16_membership_history_timeline(self):
        """Membership history aggregates joined, locks, exits, and termination events (AF-17)."""
        lock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            lock_reason="Tạm khóa lần 1",
        )
        unlock_user(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            unlock_reason="Mở khóa sau xử lý",
        )
        terminate_membership(
            company=self.company_a,
            actor=self.admin_a1,
            target_membership_id=self.membership_target.id,
            termination_type=TerminationType.IMMEDIATE,
            reason="Kết thúc hợp đồng",
        )

        history = get_membership_history(self.company_a, membership_id=self.membership_target.id)
        event_types = [h["type"] for h in history]
        self.assertIn("JOINED", event_types)
        self.assertIn("LOCKED", event_types)
        self.assertIn("UNLOCKED", event_types)
        self.assertIn("TERMINATION", event_types)

    # 17. Validation: Empty reason & invalid dates (EF-05, EF-06)
    def test_17_validation_empty_reason_and_invalid_dates(self):
        """Empty reason and past scheduled dates raise ValidationError (EF-05, EF-06)."""
        # Empty reason
        with self.assertRaises(ValidationError) as ctx:
            terminate_membership(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_target.id,
                termination_type=TerminationType.IMMEDIATE,
                reason="   ",
            )
        self.assertIn("reason", ctx.exception.detail)

        # Past scheduled date
        with self.assertRaises(ValidationError) as ctx:
            terminate_membership(
                company=self.company_a,
                actor=self.admin_a1,
                target_membership_id=self.membership_target.id,
                termination_type=TerminationType.SCHEDULED,
                reason="Lịch trong quá khứ",
                effective_at=timezone.now() - timedelta(days=2),
            )
        self.assertIn("effective_at", ctx.exception.detail)

    # 18. API Endpoints: Impact Analysis, Terminate, History, Exit Request
    def test_18_api_endpoints_flow(self):
        """Test REST API endpoints for impact analysis, termination, exit request, and history."""
        self.client.force_authenticate(user=self.admin_a1_auth)

        # 1. Impact analysis endpoint
        url_impact = f"/api/v1/iam/memberships/{self.membership_target.id}/impact-analysis/?company_id={self.company_a.id}"
        resp_impact = self.client.get(url_impact)
        self.assertEqual(resp_impact.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_impact.data["membership_id"], str(self.membership_target.id))

        # 2. Terminate endpoint
        url_term = f"/api/v1/iam/memberships/{self.membership_target.id}/terminate/?company_id={self.company_a.id}"
        resp_term = self.client.post(url_term, {
            "termination_type": "IMMEDIATE",
            "reason": "Nghỉ việc qua API",
        }, format="json")
        self.assertEqual(resp_term.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_term.data["membership"]["membership_status"], "ENDED")

        # 3. History endpoint
        url_hist = f"/api/v1/iam/memberships/{self.membership_target.id}/membership-history/?company_id={self.company_a.id}"
        resp_hist = self.client.get(url_hist)
        self.assertEqual(resp_hist.status_code, status.HTTP_200_OK)
        self.assertTrue(len(resp_hist.data) >= 2)
