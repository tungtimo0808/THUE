from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from iam.models import CompanyMembership, DataScopeSet, OrganizationAssignment, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency
from organization.models import Company, OrganizationUnit


class OrganizationAssignmentApiTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        currency = Currency.objects.get(code="VND")
        self.company = Company.objects.create(code="ASSIGN", name="Assign", legal_name="Assign", tax_code="0099000001",
                                              accounting_currency=currency, legal_reporting_currency=currency)
        self.root = OrganizationUnit.objects.get(company=self.company, unit_type="COMPANY")
        self.root.start_date = self.today - timedelta(days=30)
        self.root.save(update_fields=("start_date",))
        self.units = [OrganizationUnit.objects.create(
            company=self.company, parent=self.root, unit_type="DEPARTMENT", code=f"D{i}", name=f"Department {i}",
            start_date=self.today - timedelta(days=30), created_by_user_id=self.root.created_by_user_id,
            updated_by_user_id=self.root.updated_by_user_id,
        ) for i in range(2)]
        self.admin = get_user_model().objects.create_user(username="asg-admin", password="secret")
        self.user = get_user_model().objects.create_user(username="asg-target", password="secret")
        self.actor = self.admin.iam_account
        self.membership = CompanyMembership.objects.create(company=self.company, user=self.actor, created_by=self.actor)
        self.target = CompanyMembership.objects.create(company=self.company, user=self.user.iam_account, created_by=self.actor)
        self.role = Role.objects.create(company=self.company, code="ASSIGN_MANAGER", name="Assignment manager")
        UserRoleAssignment.objects.create(company_membership=self.membership, role=self.role, assigned_by=self.actor)
        self.permission = Permission.objects.get(code="SYS.ORG_ASSIGNMENT.MANAGE")
        RolePermission.objects.create(role=self.role, permission=self.permission)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = "/api/v1/iam/organization-assignments/"

    def create(self, unit=None, kind="PRIMARY", **extra):
        return self.client.post(self.url, {
            "company": str(self.company.pk), "membership": str(self.target.pk),
            "unit": str((unit or self.units[0]).pk), "assignment_type": kind,
            "start_date": self.today.isoformat(), **extra,
        }, format="json")

    def test_primary_transfer_is_atomic_and_preserves_history(self):
        first = self.create()
        self.assertEqual(first.status_code, 201, first.data)
        self.target.refresh_from_db()
        self.assertEqual(self.target.organization_unit_id, self.units[0].pk)
        denied = self.create(unit=self.units[1])
        self.assertEqual(denied.status_code, 400, denied.data)
        self.assertEqual(OrganizationAssignment.objects.count(), 1)
        preview = self.client.post(f"{self.url}preview/", {
            "company": str(self.company.pk), "membership": str(self.target.pk),
            "unit": str(self.units[1].pk), "assignment_type": "PRIMARY",
            "start_date": (self.today + timedelta(days=1)).isoformat(),
        }, format="json")
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertTrue(preview.data["requires_transfer"])
        self.assertEqual(OrganizationAssignment.objects.count(), 1)
        moved = self.create(unit=self.units[1], start_date=(self.today + timedelta(days=1)).isoformat(), transfer=True)
        self.assertEqual(moved.status_code, 201, moved.data)
        old = OrganizationAssignment.objects.get(pk=first.data["id"])
        self.assertEqual(old.end_date, self.today)
        self.assertEqual(moved.data["status"], "SCHEDULED")
        with patch("django.utils.timezone.localdate", return_value=self.today + timedelta(days=1)):
            call_command("sync_organization_assignments", verbosity=0)
            result = self.client.get(self.url, {"company_id": str(self.company.pk), "membership_id": str(self.target.pk)})
        self.assertEqual(result.status_code, 200, result.data)
        self.target.refresh_from_db()
        self.assertEqual(self.target.organization_unit_id, self.units[1].pk)
        self.assertEqual(AuditLog.objects.filter(action_code__startswith="ORG_ASSIGNMENT_").count(), 5)

    def test_temporary_duplicate_version_and_revoke(self):
        missing_end = self.create(kind="TEMPORARY")
        self.assertEqual(missing_end.status_code, 400)
        created = self.create(kind="TEMPORARY", end_date=(self.today + timedelta(days=2)).isoformat())
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(self.create(kind="TEMPORARY", end_date=(self.today + timedelta(days=2)).isoformat()).status_code, 400)
        detail = f"{self.url}{created.data['id']}/?company_id={self.company.pk}"
        stale = self.client.patch(detail, {"version": "2020-01-01T00:00:00Z", "note": "stale"}, format="json")
        self.assertEqual(stale.status_code, 400)
        changed = self.client.patch(detail, {"version": created.data["version"], "note": "updated"}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        revoked = self.client.post(f"{self.url}{created.data['id']}/revoke/?company_id={self.company.pk}",
                                   {"version": changed.data["version"], "reason": "done"}, format="json")
        self.assertEqual(revoked.status_code, 200, revoked.data)
        self.assertEqual(revoked.data["status"], "REVOKED")

    def test_permission_membership_and_unit_boundaries(self):
        self.role.role_permissions.all().delete()
        self.assertEqual(self.create().status_code, 403)
        RolePermission.objects.create(role=self.role, permission=self.permission)
        other = Company.objects.create(code="OTHERASG", name="Other", legal_name="Other", tax_code="0099000002",
                                       accounting_currency=self.company.accounting_currency,
                                       legal_reporting_currency=self.company.legal_reporting_currency)
        foreign = OrganizationUnit.objects.get(company=other, unit_type="COMPANY")
        self.assertEqual(self.create(unit=foreign).status_code, 400)
        self.target.membership_status = "INACTIVE"
        self.target.save(update_fields=("membership_status",))
        self.assertEqual(self.create().status_code, 400)

    def test_audit_failure_rolls_back_assignment_and_inactive_unit_is_rejected(self):
        self.units[0].status = "INACTIVE"
        self.units[0].save(update_fields=("status",))
        self.assertEqual(self.create().status_code, 400)
        self.units[0].status = "ACTIVE"
        self.units[0].save(update_fields=("status",))
        with patch("iam.organization_assignment_services.record_audit", side_effect=RuntimeError("audit unavailable")):
            with self.assertRaises(RuntimeError):
                self.create()
        self.assertFalse(OrganizationAssignment.objects.filter(membership=self.target).exists())
        self.assertIsNone(self.target.organization_unit_id)

    def test_scoped_actor_cannot_assign_unrelated_user(self):
        scope = DataScopeSet.objects.create(company=self.company, code="LIMITED", name="Limited", created_by=self.actor)
        assignment = UserRoleAssignment.objects.get(company_membership=self.membership)
        assignment.data_scope_set = scope
        assignment.save(update_fields=("data_scope_set",))
        response = self.create()
        self.assertEqual(response.status_code, 403, response.data)
        self.assertFalse(OrganizationAssignment.objects.exists())
