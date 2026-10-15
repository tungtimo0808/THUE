from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, DocumentType
from organization.models import Company, OrganizationUnit, OrganizationUnitDependency

from .models import Workflow, WorkflowVersion
from .submission import configured_snapshot, document_context
from .validation import allowed_fields
from .execution import approval_progress
from .services import choose_workflow
from rest_framework.exceptions import ValidationError
from purchases.models import ApprovalDecision
from purchases.tests import PurchaseApiFixture
from .models import DocumentApprovalPolicy


class WorkflowApiTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(code="WFTEST", name="Workflow Test", legal_name="Workflow Test",
                                              tax_code="0088000001", accounting_currency=currency,
                                              legal_reporting_currency=currency)
        self.document_type = DocumentType.objects.create(module_code="PUR", code="PUR.REQUEST", name="Purchase Request",
                                                         document_class="PURCHASE", supports_workflow=True)
        self.auth_user = get_user_model().objects.create_user(username="workflow-admin", password="secret")
        self.actor = self.auth_user.iam_account
        membership = CompanyMembership.objects.create(company=self.company, user=self.actor, created_by=self.actor)
        role = Role.objects.create(company=self.company, code="WF_CONFIG", name="Workflow config")
        UserRoleAssignment.objects.create(company_membership=membership, role=role, assigned_by=self.actor)
        RolePermission.objects.create(role=role, permission=Permission.objects.get(code="SYS.WORKFLOW.CONFIGURE"))
        RolePermission.objects.create(role=role, permission=Permission.objects.get(code="PUR.REQUEST.APPROVE"))
        self.client = APIClient()
        self.client.force_authenticate(self.auth_user)
        self.base = "/api/v1/approval-workflows/"
        self.steps = [{"order": 1, "name": "Manager review", "mode": "ANY_ONE",
                       "approvers": [{"type": "USER", "id": str(self.actor.pk)}],
                       "on_approve": "COMPLETE", "on_reject": "REJECT"}]

    def test_asset_and_journal_condition_fields(self):
        asset_type = DocumentType(module_code="FA", code="FA.ACQUISITION")
        journal_type = DocumentType(module_code="GL", code="GL.JOURNAL_ENTRY")
        self.assertTrue({"total_amount", "branch_id", "transaction_type"} <= allowed_fields(asset_type))
        self.assertTrue({"total_amount", "branch_id", "transaction_type"} <= allowed_fields(journal_type))
        asset = SimpleNamespace(branch_id=uuid4(), department_id=uuid4())
        context = document_context(SimpleNamespace(asset_id=uuid4(), asset=asset,
                                                   amount=120000000, transaction_type="ACQUISITION"))
        self.assertEqual(context["total_amount"], "120000000")
        self.assertEqual(context["branch_id"], str(asset.branch_id))
        self.assertEqual(context["department_id"], str(asset.department_id))
        journal_context = document_context(SimpleNamespace(total_debit=230000000, entry_type="ADJUSTMENT"))
        self.assertEqual(journal_context["total_amount"], "230000000")
        self.assertEqual(journal_context["transaction_type"], "ADJUSTMENT")

    def policy(self, value="REQUIRED"):
        return self.client.post(self.base + "policies/", {
            "company": str(self.company.pk), "document_type": str(self.document_type.pk), "policy": value,
        }, format="json")

    def create(self, code="WF1", **extra):
        return self.client.post(self.base + "workflows/", {
            "company": str(self.company.pk), "document_type": str(self.document_type.pk),
            "code": code, "name": code, "effective_from": self.today.isoformat(),
            "steps": self.steps, **extra,
        }, format="json")

    def detail(self, version, suffix=""):
        return f"{self.base}versions/{version['id']}/{suffix}?company_id={self.company.pk}"

    def test_create_validate_activate_and_snapshot(self):
        self.assertEqual(self.policy().status_code, 200)
        created = self.create(conditions={"field": "total_amount", "operator": "gte", "value": "100000000"})
        self.assertEqual(created.status_code, 201, created.data)
        version = created.data["latest_version"]
        check = self.client.post(self.detail(version, "validate/"), {
            "samples": [{"total_amount": "120000000"}, {"total_amount": "50000000"}],
        }, format="json")
        self.assertEqual(check.status_code, 200, check.data)
        self.assertEqual(check.data["errors"], [])
        self.assertEqual([x["matched"] for x in check.data["simulations"]], [True, False])
        self.assertEqual(check.data["simulations"][0]["would_select_version"], version["id"])
        active = self.client.post(self.detail(version, "activate/"), {"version": version["version"]}, format="json")
        self.assertEqual(active.status_code, 200, active.data)
        obj = SimpleNamespace(company=self.company, total_amount=120000000, created_by_id=self.actor.pk)
        snapshot = configured_snapshot(obj, "PUR.REQUEST")
        self.assertEqual(snapshot["version_id"], active.data["id"])
        self.assertEqual(snapshot["first_step_approvers"], [str(self.actor.pk)])
        self.assertEqual(snapshot["levels"], 1)
        self.assertTrue(AuditLog.objects.filter(action_code="WORKFLOW_ACTIVATE").exists())

    def test_versioning_schedule_and_old_version_immutability(self):
        self.policy()
        first = self.create().data["latest_version"]
        activated = self.client.post(self.detail(first, "activate/"), {"version": first["version"]}, format="json")
        self.assertEqual(activated.status_code, 200, activated.data)
        edit = self.client.patch(self.detail(activated.data), {"version": activated.data["version"],
                                                               "name": "Overwrite"}, format="json")
        self.assertEqual(edit.status_code, 400)
        workflow_id = activated.data["workflow"]
        new = self.client.post(f"{self.base}workflows/{workflow_id}/new-version/?company_id={self.company.pk}", {}, format="json")
        self.assertEqual(new.status_code, 201, new.data)
        future = (self.today + timedelta(days=2)).isoformat()
        updated = self.client.patch(self.detail(new.data), {"version": new.data["version"],
                                                              "effective_from": future, "priority": 99}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(WorkflowVersion.objects.get(pk=first["id"]).priority, 0)
        self.assertEqual(choose_workflow(company=self.company, document_type=self.document_type, context={}).pk,
                         WorkflowVersion.objects.get(pk=first["id"]).pk)
        scheduled = self.client.post(self.detail(updated.data, "activate/"),
                                     {"version": updated.data["version"]}, format="json")
        self.assertEqual(scheduled.status_code, 200, scheduled.data)
        self.assertEqual(scheduled.data["status"], "SCHEDULED")
        self.assertEqual(WorkflowVersion.objects.get(pk=first["id"]).status, "ACTIVE")
        with patch("django.utils.timezone.localdate", return_value=self.today + timedelta(days=2)):
            call_command("sync_approval_workflows", verbosity=0)
        self.assertEqual(WorkflowVersion.objects.get(pk=first["id"]).status, "INACTIVE")
        self.assertEqual(WorkflowVersion.objects.get(pk=scheduled.data["id"]).status, "ACTIVE")
        old = self.client.get(self.detail(first)).data
        archived = self.client.post(self.detail(old, "archive/"), {"version": old["version"]}, format="json")
        self.assertEqual(archived.status_code, 200, archived.data)
        self.assertEqual(archived.data["status"], "ARCHIVED")

    def test_invalid_configuration_conflict_and_permission(self):
        self.policy()
        invalid = self.create(conditions={"field": "password", "operator": "eq", "value": "x"})
        self.assertEqual(invalid.status_code, 400)
        first = self.create().data["latest_version"]
        self.assertEqual(self.create().status_code, 400)
        bad = self.client.patch(self.detail(first), {"version": first["version"], "steps": []}, format="json")
        self.assertEqual(bad.status_code, 200, bad.data)
        blocked = self.client.post(self.detail(bad.data, "activate/"), {"version": bad.data["version"]}, format="json")
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(WorkflowVersion.objects.get(pk=first["id"]).status, "DRAFT")
        self.auth_user.iam_account.memberships.first().role_assignments.first().role.role_permissions.all().delete()
        denied = self.client.get(f"{self.base}workflows/?company_id={self.company.pk}")
        self.assertEqual(denied.status_code, 403)

    def test_audit_failure_rolls_back_activation(self):
        self.policy()
        version = self.create().data["latest_version"]
        with patch("approval_workflows.services.record_audit", side_effect=RuntimeError("audit unavailable")):
            with self.assertRaises(RuntimeError):
                self.client.post(self.detail(version, "activate/"), {"version": version["version"]}, format="json")
        self.assertEqual(WorkflowVersion.objects.get(pk=version["id"]).status, "DRAFT")

    def test_required_without_workflow_blocks_and_not_required_skips(self):
        self.policy()
        obj = SimpleNamespace(company=self.company, total_amount=200, created_by_id=self.actor.pk)
        with self.assertRaises(ValidationError):
            configured_snapshot(obj, "PUR.REQUEST")
        self.policy("NOT_REQUIRED")
        snapshot = configured_snapshot(obj, "PUR.REQUEST")
        self.assertFalse(snapshot["approval_required"])
        self.assertEqual(snapshot["levels"], 0)

    def test_all_mode_requires_distinct_eligible_approvers(self):
        second_auth = get_user_model().objects.create_user(username="workflow-second", password="secret")
        second = second_auth.iam_account
        membership = CompanyMembership.objects.create(company=self.company, user=second, created_by=self.actor)
        role = self.actor.memberships.get(company=self.company).role_assignments.first().role
        UserRoleAssignment.objects.create(company_membership=membership, role=role, assigned_by=self.actor)
        self.policy()
        steps = [{**self.steps[0], "mode": "ALL", "approvers": [
            {"type": "USER", "id": str(self.actor.pk)}, {"type": "USER", "id": str(second.pk)},
        ]}]
        version = self.create(steps=steps).data["latest_version"]
        active = self.client.post(self.detail(version, "activate/"), {"version": version["version"]}, format="json")
        self.assertEqual(active.status_code, 200, active.data)
        obj = SimpleNamespace(company=self.company, total_amount=100, created_by_id=uuid4(),
                              workflow_snapshot=configured_snapshot(SimpleNamespace(
                                  company=self.company, total_amount=100, created_by_id=uuid4()), "PUR.REQUEST"))
        document_id = uuid4()
        decisions = ApprovalDecision.objects.filter(company=self.company, document_type="REQUEST", document_id=document_id)
        first = approval_progress(obj, self.actor, True, decisions)
        self.assertFalse(first["final"])
        ApprovalDecision.objects.create(company=self.company, document_type="REQUEST", document_id=document_id,
                                        level=1, decision="APPROVED", actor=self.actor)
        with self.assertRaises(ValidationError):
            approval_progress(obj, self.actor, True, decisions)
        final = approval_progress(obj, second, True, decisions)
        self.assertTrue(final["final"])

    def test_priority_then_condition_specificity_selects_workflow(self):
        self.policy()
        first = self.create(code="DEFAULT", priority=10).data["latest_version"]
        self.assertEqual(self.client.post(self.detail(first, "activate/"),
                                          {"version": first["version"]}, format="json").status_code, 200)
        specific = self.create(code="SPECIFIC", priority=10,
            conditions={"field": "total_amount", "operator": "gte", "value": "100"}).data["latest_version"]
        self.assertEqual(self.client.post(self.detail(specific, "activate/"),
                                          {"version": specific["version"]}, format="json").status_code, 200)
        selected = choose_workflow(company=self.company, document_type=self.document_type,
                                   context={"total_amount": "150"})
        self.assertEqual(str(selected.pk), specific["id"])
        high = self.create(code="HIGH", priority=20,
            conditions={"field": "total_amount", "operator": "gte", "value": "1000"}).data["latest_version"]
        self.assertEqual(self.client.post(self.detail(high, "activate/"),
                                          {"version": high["version"]}, format="json").status_code, 200)
        selected = choose_workflow(company=self.company, document_type=self.document_type,
                                   context={"total_amount": "1500"})
        self.assertEqual(str(selected.pk), high["id"])

    def test_rejection_to_previous_step_preserves_history_and_restarts_step(self):
        steps = [self.steps[0] | {"on_approve": "NEXT"},
                 self.steps[0] | {"order": 2, "name": "Second", "on_reject": "PREVIOUS"}]
        obj = SimpleNamespace(company=self.company, workflow_snapshot={
            "version_id": str(uuid4()), "document_type_code": "PUR.REQUEST", "steps": steps,
        }, created_by_id=uuid4())
        doc_id = uuid4()
        decisions = ApprovalDecision.objects.filter(company=self.company, document_type="REQUEST", document_id=doc_id)
        ApprovalDecision.objects.create(company=self.company, document_type="REQUEST", document_id=doc_id,
                                        level=1, decision="APPROVED", actor=self.actor)
        ApprovalDecision.objects.create(company=self.company, document_type="REQUEST", document_id=doc_id,
                                        level=2, decision="REJECTED", actor=self.actor)
        progress = approval_progress(obj, self.actor, True, decisions)
        self.assertEqual(progress["level"], 1)
        self.assertFalse(progress["final"])

    def test_resubmission_starts_a_new_approval_round(self):
        steps = [self.steps[0] | {"on_approve": "NEXT"},
                 self.steps[0] | {"order": 2, "name": "Second"}]
        obj = SimpleNamespace(company=self.company, workflow_snapshot={
            "version_id": str(uuid4()), "document_type_code": "PUR.REQUEST", "steps": steps,
        }, created_by_id=uuid4())
        doc_id = uuid4()
        decisions = ApprovalDecision.objects.filter(company=self.company, document_type="REQUEST", document_id=doc_id)
        for decision, level in (("SUBMITTED", 0), ("APPROVED", 1), ("REJECTED", 2), ("SUBMITTED", 0)):
            ApprovalDecision.objects.create(company=self.company, document_type="REQUEST", document_id=doc_id,
                                            level=level, decision=decision, actor=self.actor)
        progress = approval_progress(obj, self.actor, True, decisions)
        self.assertEqual(progress["level"], 1)
        self.assertFalse(progress["final"])

    def test_equivalent_condition_order_conflicts_at_same_priority(self):
        self.policy()
        rules = [{"field": "total_amount", "operator": "gte", "value": "100"},
                 {"field": "branch_id", "operator": "eq", "value": str(uuid4())}]
        first = self.create(code="C1", priority=3, conditions={"op": "AND", "rules": rules}).data["latest_version"]
        self.assertEqual(self.client.post(self.detail(first, "activate/"),
                                          {"version": first["version"]}, format="json").status_code, 200)
        second = self.create(code="C2", priority=3,
                             conditions={"op": "AND", "rules": list(reversed(rules))}).data["latest_version"]
        blocked = self.client.post(self.detail(second, "activate/"),
                                   {"version": second["version"]}, format="json")
        self.assertEqual(blocked.status_code, 400, blocked.data)

    def test_unit_manager_dependency_tracks_active_version(self):
        self.policy()
        root = OrganizationUnit.objects.get(company=self.company, unit_type="COMPANY")
        unit = OrganizationUnit.objects.create(company=self.company, parent=root, unit_type="BRANCH",
            code="WF-BR", name="Workflow branch", start_date=self.today,
            manager_membership=CompanyMembership.objects.get(company=self.company, user=self.actor),
            created_by_user_id=self.actor.pk, updated_by_user_id=self.actor.pk)
        steps = [{**self.steps[0], "approvers": [{"type": "UNIT_MANAGER", "id": str(unit.pk)}]}]
        version = self.create(steps=steps).data["latest_version"]
        active = self.client.post(self.detail(version, "activate/"), {"version": version["version"]}, format="json")
        self.assertEqual(active.status_code, 200, active.data)
        dependency = OrganizationUnitDependency.objects.get(unit=unit, dependency_type="WORKFLOW",
                                                            reference=version["id"])
        self.assertTrue(dependency.is_active)
        stopped = self.client.post(self.detail(active.data, "stop/"),
                                   {"version": active.data["version"]}, format="json")
        self.assertEqual(stopped.status_code, 200, stopped.data)
        dependency.refresh_from_db()
        self.assertFalse(dependency.is_active)


class WorkflowPurchaseIntegrationTests(PurchaseApiFixture):
    def test_submission_uses_active_version_and_rejects_other_approver(self):
        document_type = DocumentType.objects.create(module_code="PUR", code="PUR.REQUEST",
            name="Purchase request", document_class="PURCHASE", supports_workflow=True)
        approver = self.approver_auth.iam_account
        membership = CompanyMembership.objects.create(company=self.company, user=approver, created_by=approver)
        role = Role.objects.create(company=self.company, code="PUR_APPROVER_WF", name="Purchasing approver")
        UserRoleAssignment.objects.create(company_membership=membership, role=role, assigned_by=approver)
        RolePermission.objects.create(role=role, permission=Permission.objects.get(code="PUR.REQUEST.APPROVE"))
        DocumentApprovalPolicy.objects.create(company=self.company, document_type=document_type,
                                              policy="REQUIRED", updated_by=approver)
        workflow = Workflow.objects.create(company=self.company, document_type=document_type,
                                           code="PUR_WF", name="Purchase workflow", created_by=approver)
        version = WorkflowVersion.objects.create(workflow=workflow, number=1, status="ACTIVE",
            effective_from=self.today, created_by=approver, activated_by=approver,
            steps=[{"order": 1, "name": "Approver", "mode": "ANY_ONE",
                    "approvers": [{"type": "USER", "id": str(approver.pk)}],
                    "on_approve": "COMPLETE", "on_reject": "REJECT"}])
        request_id = self.create_request().data["id"]
        submitted = self.client.post(
            f"/api/v1/purchases/purchase-requests/{request_id}/submit/?company_id={self.company.pk}",
            {"workflow_snapshot": {"version": "FORGED", "levels": 20, "allow_self_approval": True}}, format="json")
        self.assertEqual(submitted.status_code, 200, submitted.data)
        self.assertEqual(submitted.data["workflow_snapshot"]["version_id"], str(version.pk))
        outsider = get_user_model().objects.create_superuser(username="wf-outsider", password="secret")
        self.client.force_authenticate(outsider)
        denied = self.client.post(
            f"/api/v1/purchases/purchase-requests/{request_id}/approve/?company_id={self.company.pk}",
            {}, format="json")
        self.assertEqual(denied.status_code, 403, denied.data)
        self.client.force_authenticate(self.approver_auth)
        approved = self.client.post(
            f"/api/v1/purchases/purchase-requests/{request_id}/approve/?company_id={self.company.pk}",
            {}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["status"], "APPROVED")
