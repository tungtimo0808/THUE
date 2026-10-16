from datetime import timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from iam.models import CompanyMembership, Permission, Role, RolePermission, UserAccount, UserRoleAssignment
from master_data.models import DocumentType
from purchases.tests import PurchaseApiFixture

from .models import (
    ApprovalDelegation,
    ApprovalEvent,
    ApprovalNotification,
    ApprovalRequest,
    ApprovalTask,
    DocumentApprovalPolicy,
    Workflow,
    WorkflowVersion,
)


class ApprovalTaskApiTests(PurchaseApiFixture):
    def setUp(self):
        super().setUp()
        self.document_type = DocumentType.objects.create(
            module_code="PUR", code="PUR.REQUEST",
            name="Purchase request", document_class="PURCHASE", supports_workflow=True
        )
        self.approver = self.approver_auth.iam_account
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.approver, created_by=self.approver
        )
        self.role = Role.objects.create(company=self.company, code="PUR_APPROVER_TASK", name="Approver")
        UserRoleAssignment.objects.create(company_membership=self.membership, role=self.role, assigned_by=self.approver)
        RolePermission.objects.create(role=self.role, permission=Permission.objects.get(code="PUR.REQUEST.APPROVE"))
        DocumentApprovalPolicy.objects.create(
            company=self.company, document_type=self.document_type,
            policy="REQUIRED", updated_by=self.approver
        )
        self.workflow = Workflow.objects.create(
            company=self.company, document_type=self.document_type,
            code="TASK_WF", name="Task workflow", created_by=self.approver
        )
        self.version = WorkflowVersion.objects.create(
            workflow=self.workflow, number=1, status="ACTIVE", effective_from=self.today,
            created_by=self.approver, activated_by=self.approver,
            steps=[{"order": 1, "name": "Review", "mode": "ANY_ONE",
                    "approvers": [{"type": "USER", "id": str(self.approver.pk)}],
                    "on_approve": "COMPLETE", "on_reject": "REJECT", "on_changes": "RETURN_CREATOR"}]
        )

    def create_pr(self, number="PR-001"):
        response = self.client.post(
            f"/api/v1/purchases/purchase-requests/?company_id={self.company.id}",
            {
                "company": str(self.company.id), "branch": str(self.branch.id),
                "number": number, "document_date": str(self.today),
                "department": str(self.department.id), "requester": str(self.employee.id),
                "required_date": str(self.today + timedelta(days=7)), "purpose": "Bổ sung vật tư",
                "lines": [{
                    "line_no": 1, "item": str(self.item.id), "uom": str(self.uom.id),
                    "quantity": "10.0000", "required_date": str(self.today + timedelta(days=7)),
                    "estimated_unit_price": "100000.0000",
                }],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response

    def submit(self, number="PR-001"):
        document_id = self.create_pr(number).data["id"]
        response = self.client.post(
            f"/api/v1/purchases/purchase-requests/{document_id}/submit/?company_id={self.company.pk}",
            {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return document_id

    def test_inbox_comment_approve_and_duplicate_protection(self):
        self.submit()
        self.assertEqual(ApprovalRequest.objects.count(), 1)
        task = ApprovalTask.objects.get()
        self.assertEqual(task.assignee_id, self.approver.pk)

        # Creator cannot view or access task
        self.client.force_authenticate(self.creator_auth)
        self.assertEqual(self.client.get("/api/v1/approval-workflows/tasks/").data, [])
        self.assertEqual(self.client.get(f"/api/v1/approval-workflows/tasks/{task.pk}/").status_code, 403)

        # Approver access
        self.client.force_authenticate(self.approver_auth)
        inbox = self.client.get("/api/v1/approval-workflows/tasks/")
        self.assertEqual(inbox.status_code, 200, inbox.data)
        self.assertEqual(len(inbox.data), 1)

        url = f"/api/v1/approval-workflows/tasks/{task.pk}/"
        detail = self.client.get(url)
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertIn("ai_assistance", detail.data)
        self.assertIn("lines", detail.data["source"])

        # Comment
        comment = self.client.post(url, {"action": "COMMENT", "version": 1, "comment": "Kiểm tra hạn mức"}, format="json")
        self.assertEqual(comment.status_code, 200, comment.data)
        self.assertEqual(ApprovalEvent.objects.filter(action="COMMENT").count(), 1)

        # Approve
        approved = self.client.post(url, {"action": "APPROVE", "version": 1, "comment": "Đồng ý"}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["request_status"], "APPROVED")

        # Duplicate submit is blocked
        duplicate = self.client.post(url, {"action": "APPROVE", "version": 1}, format="json")
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        self.assertEqual(ApprovalEvent.objects.filter(action="APPROVE").count(), 1)
        self.assertTrue(ApprovalNotification.objects.filter(event="APPROVED").exists())

    def test_request_changes_and_new_round(self):
        document_id = self.submit()
        task = ApprovalTask.objects.get()
        self.client.force_authenticate(self.approver_auth)

        # Validation: changes content cannot be empty (EF-11, BR-APR-15)
        empty_err = self.client.post(f"/api/v1/approval-workflows/tasks/{task.pk}/",
            {"action": "REQUEST_CHANGES", "version": 1, "comment": "", "changes": ""}, format="json")
        self.assertEqual(empty_err.status_code, 400)

        changed = self.client.post(f"/api/v1/approval-workflows/tasks/{task.pk}/",
            {"action": "REQUEST_CHANGES", "version": 1, "comment": "Thiếu tài liệu",
             "changes": "Bổ sung báo giá"}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(changed.data["request_status"], "CHANGES_REQUESTED")

        self.client.force_authenticate(self.creator_auth)
        resubmitted = self.client.post(
            f"/api/v1/purchases/purchase-requests/{document_id}/submit/?company_id={self.company.pk}",
            {}, format="json")
        self.assertEqual(resubmitted.status_code, 200, resubmitted.data)
        self.assertEqual(list(ApprovalRequest.objects.order_by("round_number").values_list("round_number", flat=True)), [1, 2])
        self.assertEqual(ApprovalTask.objects.filter(status="PENDING").count(), 1)

    def test_reject_flow_and_rejection_rules(self):
        self.submit()
        task = ApprovalTask.objects.get()
        self.client.force_authenticate(self.approver_auth)
        url = f"/api/v1/approval-workflows/tasks/{task.pk}/"

        # Missing comment on reject is rejected (EF-10, BR-APR-14)
        bad_reject = self.client.post(url, {"action": "REJECT", "version": 1, "comment": ""}, format="json")
        self.assertEqual(bad_reject.status_code, 400)

        # Successful reject
        rejected = self.client.post(url, {"action": "REJECT", "version": 1, "comment": "Không đồng ý ngân sách"}, format="json")
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(rejected.data["request_status"], "REJECTED")
        task.refresh_from_db()
        self.assertEqual(task.status, "REJECTED")
        self.assertTrue(ApprovalEvent.objects.filter(action="REJECT").exists())
        self.assertTrue(ApprovalNotification.objects.filter(event="REJECTED").exists())

    def test_forward_task_flow(self):
        self.submit()
        task = ApprovalTask.objects.get()

        # Create target user for forward
        target_auth = get_user_model().objects.create_user(username="target-approver", password="password-123")
        target_account = target_auth.iam_account
        target_mem = CompanyMembership.objects.create(company=self.company, user=target_account, created_by=self.approver)
        UserRoleAssignment.objects.create(company_membership=target_mem, role=self.role, assigned_by=self.approver)

        self.client.force_authenticate(self.approver_auth)
        url = f"/api/v1/approval-workflows/tasks/{task.pk}/"

        # Forward task
        forwarded = self.client.post(url, {
            "action": "FORWARD", "version": 1, "target_user_id": str(target_account.pk),
            "comment": "Nhờ anh duyệt thay",
        }, format="json")
        self.assertEqual(forwarded.status_code, 200, forwarded.data)

        task.refresh_from_db()
        self.assertEqual(task.status, "FORWARDED")
        self.assertEqual(task.forwarded_to_id, target_account.pk)

        # Check new task created for target user
        new_task = ApprovalTask.objects.get(assignee=target_account)
        self.assertEqual(new_task.status, "PENDING")

        # Target approver can now view and approve
        self.client.force_authenticate(target_auth)
        inbox = self.client.get("/api/v1/approval-workflows/tasks/")
        self.assertEqual(len(inbox.data), 1)
        self.assertEqual(inbox.data[0]["id"], str(new_task.pk))

        approved = self.client.post(f"/api/v1/approval-workflows/tasks/{new_task.pk}/", {
            "action": "APPROVE", "version": 1, "comment": "Đồng ý chuyển tiếp",
        }, format="json")
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.data["request_status"], "APPROVED")

    def test_delegation_flow(self):
        self.submit()
        task = ApprovalTask.objects.get()

        # Create delegate user
        delegate_auth = get_user_model().objects.create_user(username="delegate-approver", password="password-123")
        delegate_account = delegate_auth.iam_account
        delegate_mem = CompanyMembership.objects.create(company=self.company, user=delegate_account, created_by=self.approver)
        UserRoleAssignment.objects.create(company_membership=delegate_mem, role=self.role, assigned_by=self.approver)

        # Approver creates delegation
        self.client.force_authenticate(self.approver_auth)
        del_resp = self.client.post("/api/v1/approval-workflows/delegations/", {
            "company": str(self.company.pk),
            "delegate": str(delegate_account.pk),
            "start_date": (self.today - timedelta(days=1)).isoformat(),
            "end_date": (self.today + timedelta(days=5)).isoformat(),
            "reason": "Đi công tác",
        }, format="json")
        self.assertEqual(del_resp.status_code, 201, del_resp.data)
        delegation_id = del_resp.data["id"]

        # Delegate logs in -> see delegated task in inbox (AF-17, BR-APR-55)
        self.client.force_authenticate(delegate_auth)
        inbox = self.client.get("/api/v1/approval-workflows/tasks/")
        self.assertEqual(len(inbox.data), 1)
        self.assertTrue(inbox.data[0]["is_delegated"])
        self.assertEqual(inbox.data[0]["delegated_from"], str(self.approver.pk))

        # Delegate approves task
        url = f"/api/v1/approval-workflows/tasks/{task.pk}/"
        approved = self.client.post(url, {
            "action": "APPROVE", "version": 1, "comment": "Duyệt thay anh",
        }, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["request_status"], "APPROVED")

        # Verify event and task recorded both delegate and delegator (BR-APR-48)
        event = ApprovalEvent.objects.get(action="APPROVE")
        self.assertEqual(event.actor_id, delegate_account.pk)
        self.assertEqual(event.delegated_from_id, self.approver.pk)

        task.refresh_from_db()
        self.assertEqual(task.delegated_from_id, self.approver.pk)

    def test_bulk_decision_flow(self):
        # Create 2 documents
        doc1 = self.submit("PR-BULK-01")
        doc2 = self.submit("PR-BULK-02")
        tasks = list(ApprovalTask.objects.filter(status="PENDING").order_by("created_at"))
        self.assertEqual(len(tasks), 2)

        self.client.force_authenticate(self.approver_auth)
        bulk_resp = self.client.post("/api/v1/approval-workflows/tasks/bulk-decision/", {
            "decisions": [
                {"task_id": str(tasks[0].pk), "action": "APPROVE", "comment": "Duyệt lô 1", "version": 1},
                {"task_id": str(tasks[1].pk), "action": "APPROVE", "comment": "Duyệt lô 2", "version": 1},
            ]
        }, format="json")
        self.assertEqual(bulk_resp.status_code, 200, bulk_resp.data)
        results = bulk_resp.data["results"]
        self.assertEqual(len(results), 2)
        self.assertTrue(results[0]["success"])
        self.assertTrue(results[1]["success"])

        for t in ApprovalTask.objects.filter(pk__in=[tasks[0].pk, tasks[1].pk]):
            self.assertEqual(t.status, "APPROVED")

    def test_security_version_lock_and_fingerprint_check(self):
        document_id = self.submit()
        task = ApprovalTask.objects.get()
        self.client.force_authenticate(self.approver_auth)
        url = f"/api/v1/approval-workflows/tasks/{task.pk}/"

        # Optimistic locking version mismatch (EF-14)
        mismatch = self.client.post(url, {"action": "APPROVE", "version": 99, "comment": "OK"}, format="json")
        self.assertEqual(mismatch.status_code, 400)
        self.assertIn("version", mismatch.data)

        # Tampering document triggers fingerprint mismatch (EF-07, BR-APR-33)
        from purchases.models import PurchaseRequest
        doc = PurchaseRequest.objects.get(pk=document_id)
        doc.purpose = "Sửa đổi sau khi gửi duyệt"
        doc.save(update_fields=["purpose"])

        fingerprint_err = self.client.post(url, {"action": "APPROVE", "version": 1, "comment": "OK"}, format="json")
        self.assertEqual(fingerprint_err.status_code, 400)
        self.assertIn("Chứng từ đã thay đổi", str(fingerprint_err.data))
