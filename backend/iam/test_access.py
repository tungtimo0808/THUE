from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit_log.models import AuditLog
from common_services.models import CoreCompanySetting
from master_data.models import Currency
from organization.models import Company

from .models import (CompanyMembership, Permission, Role, RolePermission,
                     UserPermissionOverride, UserRoleAssignment)
from .permissions import has_effective_permission


class AccessManagementTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "VND"})
        self.company = Company.objects.create(code="ACCESS", name="Access", legal_name="Access Ltd",
                                              tax_code="0100888888", status="ACTIVE",
                                              accounting_currency=currency, legal_reporting_currency=currency)
        self.admin_auth = get_user_model().objects.create_user(username="access-admin", password="pass",
                                                                is_superuser=True)
        self.admin = self.admin_auth.iam_account
        CompanyMembership.objects.create(company=self.company, user=self.admin, created_by=self.admin)
        self.target_auth = get_user_model().objects.create_user(username="access-target", password="pass")
        self.target = self.target_auth.iam_account
        self.target_membership = CompanyMembership.objects.create(company=self.company, user=self.target,
                                                                  created_by=self.admin)
        self.role = Role.objects.create(company=self.company, code="ACCESS_ROLE", name="Access Role")
        self.permission = Permission.objects.get(code="SYS.USER.VIEW")
        self.client = APIClient()
        self.client.force_authenticate(self.admin_auth)

    def test_matrix_is_versioned_and_revocation_takes_effect(self):
        url = f"/api/v1/iam/roles/{self.role.id}/set-matrix/?company_id={self.company.id}"
        response = self.client.post(url, {"version": self.role.updated_at.isoformat(),
                                          "permission_codes": [self.permission.code]}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        stale = self.client.post(url, {"version": self.role.updated_at.isoformat(),
                                       "permission_codes": []}, format="json")
        self.assertEqual(stale.status_code, 409)
        assigned = self.client.post(f"/api/v1/iam/role-assignments/?company_id={self.company.id}",
                                    {"company_membership": str(self.target_membership.id),
                                     "role": str(self.role.id)}, format="json")
        self.assertEqual(assigned.status_code, 201, assigned.data)
        self.assertTrue(has_effective_permission(self.target, self.company, self.permission.code))
        removed = self.client.post(url, {"version": response.data["version"],
                                        "permission_codes": []}, format="json")
        self.assertEqual(removed.status_code, 200, removed.data)
        self.assertFalse(has_effective_permission(self.target, self.company, self.permission.code))
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="PERMISSION_MATRIX_UPDATE").exists())

    def test_scheduled_assignment_overlap_and_revoke(self):
        RolePermission.objects.create(role=self.role, permission=self.permission)
        start = timezone.now() + timedelta(days=2)
        url = f"/api/v1/iam/role-assignments/?company_id={self.company.id}"
        payload = {"company_membership": str(self.target_membership.id), "role": str(self.role.id),
                   "valid_from": start.isoformat()}
        first = self.client.post(url, payload, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data["status"], "SCHEDULED")
        self.assertFalse(has_effective_permission(self.target, self.company, self.permission.code))
        self.assertEqual(self.client.post(url, payload, format="json").status_code, 400)
        revoke_url = f"/api/v1/iam/role-assignments/{first.data['id']}/revoke/?company_id={self.company.id}"
        self.assertEqual(self.client.post(revoke_url, {}, format="json").status_code, 400)
        self.assertEqual(self.client.post(revoke_url, {"reason": "Change"}, format="json").status_code, 200)
        payload["valid_from"] = (start + timedelta(seconds=1)).isoformat()
        self.assertEqual(self.client.post(url, payload, format="json").status_code, 201)

    def test_direct_deny_precedes_role_and_requires_setting(self):
        RolePermission.objects.create(role=self.role, permission=self.permission)
        UserRoleAssignment.objects.create(company_membership=self.target_membership, role=self.role,
                                          assigned_by=self.admin, valid_from=timezone.now() - timedelta(minutes=1))
        url = f"/api/v1/iam/permission-overrides/?company_id={self.company.id}"
        payload = {"company_membership": str(self.target_membership.id), "permission_code": self.permission.code,
                   "effect": "DENY", "reason": "Restricted"}
        self.assertEqual(self.client.post(url, payload, format="json").status_code, 400)
        CoreCompanySetting.objects.update_or_create(company=self.company,
            defaults={"configuration": {"direct_user_permissions_enabled": True}})
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(has_effective_permission(self.target, self.company, self.permission.code))
        revoke = self.client.post(f"/api/v1/iam/permission-overrides/{response.data['id']}/revoke/?company_id={self.company.id}",
                                  {"reason": "Restore"}, format="json")
        self.assertEqual(revoke.status_code, 200, revoke.data)
        self.assertTrue(has_effective_permission(self.target, self.company, self.permission.code))
        self.assertEqual(UserPermissionOverride.objects.count(), 1)

    def test_manager_cannot_grant_permission_they_do_not_have(self):
        manager_auth = get_user_model().objects.create_user(username="access-manager", password="pass")
        manager = manager_auth.iam_account
        manager_membership = CompanyMembership.objects.create(company=self.company, user=manager,
                                                              created_by=self.admin)
        management_role = Role.objects.create(company=self.company, code="ACCESS_MANAGER", name="Access Manager")
        RolePermission.objects.create(role=management_role,
                                      permission=Permission.objects.get(code="SYS.PERMISSION.CONFIGURE"))
        UserRoleAssignment.objects.create(company_membership=manager_membership, role=management_role,
                                          assigned_by=self.admin, valid_from=timezone.now() - timedelta(minutes=1))
        self.client.force_authenticate(manager_auth)
        url = f"/api/v1/iam/roles/{self.role.id}/set-matrix/?company_id={self.company.id}"
        response = self.client.post(url, {"version": self.role.updated_at.isoformat(),
                                          "permission_codes": [self.permission.code]}, format="json")
        self.assertEqual(response.status_code, 403, response.data)
        self.assertFalse(RolePermission.objects.filter(role=self.role).exists())

    def test_failed_audit_rolls_back_permission_matrix(self):
        url = f"/api/v1/iam/roles/{self.role.id}/set-matrix/?company_id={self.company.id}"
        with patch("iam.access_services.record_audit", side_effect=RuntimeError("audit unavailable")):
            with self.assertRaises(RuntimeError):
                self.client.post(url, {"version": self.role.updated_at.isoformat(),
                                       "permission_codes": [self.permission.code]}, format="json")
        self.assertFalse(RolePermission.objects.filter(role=self.role).exists())

    def test_legacy_grant_write_endpoint_is_read_only(self):
        response = self.client.post(
            f"/api/v1/iam/role-permissions/?company_id={self.company.id}",
            {"role": str(self.role.id), "permission": str(self.permission.id)}, format="json")
        self.assertEqual(response.status_code, 405)
