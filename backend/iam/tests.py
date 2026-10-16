from datetime import timedelta
import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from audit_log.models import AuditLog
from common_services.models import WorkItem
from master_data.models import Currency
from organization.models import Branch, Company, Department, Employee

from .models import (
    CompanyMembership,
    DataScopeBranch,
    DataScopeSet,
    Permission,
    PermissionBundle,
    PermissionBundleItem,
    Role,
    RolePermission,
    RolePermissionBundle,
    UserRoleAssignment,
)
from .permissions import has_effective_permission


class IamFixture(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(
            code="IAMCO", name="IAM Company", legal_name="IAM Company Ltd", tax_code="0100999999",
            accounting_currency=currency, legal_reporting_currency=currency,
        )
        self.branch_a = Branch.objects.create(company=self.company, code="A", name="Chi nhánh A")
        self.branch_b = Branch.objects.create(company=self.company, code="B", name="Chi nhánh B")
        self.department_a = Department.objects.create(company=self.company, branch=self.branch_a, code="DA", name="Phòng A")
        self.admin_auth = get_user_model().objects.create_user(
            username="iam-admin", email="admin@example.com", password="password-123",
            is_staff=True, is_superuser=True,
        )
        self.admin = self.admin_auth.iam_account
        self.admin.display_name = "IAM Admin"
        self.admin.save()
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.admin, created_by=self.admin
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin_auth)


class IamApiTests(IamFixture):
    def test_create_user_creates_membership_and_audit_log(self):
        response = self.client.post(
            "/api/v1/iam/users/",
            {
                "username": "accountant",
                "email": "accountant@example.com",
                "display_name": "Kế toán viên",
                "password": "password-123",
                "company": str(self.company.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(CompanyMembership.objects.filter(company=self.company, user_id=response.data["id"]).exists())
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="CREATE", entity_id=response.data["id"]).exists())

    def test_user_cannot_deactivate_self(self):
        response = self.client.patch(
            f"/api/v1/iam/users/{self.admin.id}/?company_id={self.company.id}",
            {"is_active": False, "company": str(self.company.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_iam_records_cannot_be_deleted_via_api(self):
        response = self.client.delete(f"/api/v1/iam/users/{self.admin.id}/?company_id={self.company.id}")
        self.assertEqual(response.status_code, 405)

    def test_deactivating_user_revokes_refresh_tokens(self):
        target_auth = get_user_model().objects.create_user(
            username="target", email="target@example.com", password="password-123"
        )
        target = target_auth.iam_account
        CompanyMembership.objects.create(
            company=self.company, user=target, created_by=self.admin
        )
        RefreshToken.for_user(target_auth)

        response = self.client.patch(
            f"/api/v1/iam/users/{target.id}/?company_id={self.company.id}",
            {"is_active": False, "company": str(self.company.id)},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        target_auth.refresh_from_db()
        self.assertFalse(target_auth.is_active)
        self.assertEqual(BlacklistedToken.objects.filter(token__user=target_auth).count(), 1)

    def test_audit_log_is_read_only_and_requires_company_filter(self):
        response = self.client.get("/api/v1/audit/logs/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_non_superuser_is_limited_to_effective_permission(self):
        viewer_auth = get_user_model().objects.create_user(
            username="viewer", email="viewer@example.com", password="password-123"
        )
        viewer = viewer_auth.iam_account
        membership = CompanyMembership.objects.create(
            company=self.company, user=viewer, created_by=self.admin
        )
        role = Role.objects.create(company=self.company, code="USER_READER", name="Đọc User")
        RolePermission.objects.create(
            role=role, permission=Permission.objects.get(code="SYS.USER.VIEW")
        )
        scope = DataScopeSet.objects.create(
            company=self.company, code="ALL", name="Toàn công ty",
            allow_all_company_data=True, created_by=self.admin,
        )
        UserRoleAssignment.objects.create(
            company_membership=membership, role=role, data_scope_set=scope,
            valid_from=timezone.now() - timedelta(minutes=1), assigned_by=self.admin,
        )
        self.client.force_authenticate(viewer_auth)
        list_response = self.client.get(
            f"/api/v1/iam/users/?company_id={self.company.id}"
        )
        create_response = self.client.post(
            "/api/v1/iam/users/",
            {
                "username": "forbidden-create",
                "email": "forbidden@example.com",
                "display_name": "Không được tạo",
                "password": "password-123",
                "company": str(self.company.id),
            },
            format="json",
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(create_response.status_code, 403)


class EffectivePermissionTests(IamFixture):
    def test_permission_scope_is_not_merged_between_roles(self):
        view_user = Permission.objects.get(code="SYS.USER.VIEW")
        view_audit = Permission.objects.get(code="SYS.AUDIT.VIEW")
        role_user = Role.objects.create(company=self.company, code="USER_VIEWER", name="Xem User")
        role_audit = Role.objects.create(company=self.company, code="AUDITOR", name="Kiểm toán")
        RolePermission.objects.create(role=role_user, permission=view_user)
        RolePermission.objects.create(role=role_audit, permission=view_audit)

        scope_a = DataScopeSet.objects.create(company=self.company, code="SCOPE_A", name="Scope A", created_by=self.admin)
        scope_b = DataScopeSet.objects.create(company=self.company, code="SCOPE_B", name="Scope B", created_by=self.admin)
        DataScopeBranch.objects.create(data_scope_set=scope_a, branch=self.branch_a)
        DataScopeBranch.objects.create(data_scope_set=scope_b, branch=self.branch_b)
        now = timezone.now()
        UserRoleAssignment.objects.create(
            company_membership=self.membership, role=role_user, data_scope_set=scope_a,
            valid_from=now - timedelta(minutes=1), assigned_by=self.admin,
        )
        UserRoleAssignment.objects.create(
            company_membership=self.membership, role=role_audit, data_scope_set=scope_b,
            valid_from=now - timedelta(minutes=1), assigned_by=self.admin,
        )

        self.assertTrue(has_effective_permission(self.admin, self.company, "SYS.USER.VIEW", branch_id=self.branch_a.id))
        self.assertFalse(has_effective_permission(self.admin, self.company, "SYS.USER.VIEW", branch_id=self.branch_b.id))
        self.assertTrue(has_effective_permission(self.admin, self.company, "SYS.AUDIT.VIEW", branch_id=self.branch_b.id))

    def test_inactive_role_cannot_be_assigned_by_api(self):
        role = Role.objects.create(company=self.company, code="OLD", name="Role cũ", status="INACTIVE")
        response = self.client.post(
            f"/api/v1/iam/role-assignments/?company_id={self.company.id}",
            {
                "company_membership": str(self.membership.id),
                "role": str(role.id),
                "valid_from": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_last_system_admin_assignment_cannot_be_revoked(self):
        role = Role.objects.create(
            company=self.company, code="ROLE_ADMIN", name="Quản trị", is_system_admin=True
        )
        assignment = UserRoleAssignment.objects.create(
            company_membership=self.membership,
            role=role,
            valid_from=timezone.now() - timedelta(minutes=1),
            assigned_by=self.admin,
        )
        response = self.client.post(
            f"/api/v1/iam/role-assignments/{assignment.id}/revoke/?company_id={self.company.id}",
            {"reason": "Test"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "ACTIVE")


class CompanyUserManagementTests(IamFixture):
    def setUp(self):
        super().setUp()
        self.company.status = "ACTIVE"
        self.company.save(update_fields=("status",))
        self.target_auth = get_user_model().objects.create_user(
            username="managed-user", email="managed@example.com", password="password-123",
        )
        self.target = self.target_auth.iam_account
        self.target_membership = CompanyMembership.objects.create(
            company=self.company, user=self.target, created_by=self.admin, join_source="APPROVED",
        )
        self.employee = Employee.objects.create(
            company=self.company, branch=self.branch_a, employee_code="EMP001", full_name="Managed Employee",
        )
        self.url = f"/api/v1/iam/memberships/{self.target_membership.pk}/?company_id={self.company.pk}"

    def test_list_detail_and_update_only_company_fields(self):
        listed = self.client.get(f"/api/v1/iam/memberships/?company_id={self.company.pk}&q=managed")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data), 1)
        detail = self.client.get(self.url)
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data["email"], "managed@example.com")
        changed = self.client.patch(self.url, {
            "version": detail.data["updated_at"], "internal_display_name": "Tên nội bộ",
            "internal_note": "Ghi chú quản lý", "employee": str(self.employee.pk),
        }, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        self.target_membership.refresh_from_db()
        self.target_auth.refresh_from_db()
        self.assertEqual(self.target_membership.employee_id, self.employee.pk)
        self.assertEqual(self.target_membership.internal_display_name, "Tên nội bộ")
        self.assertEqual(self.target_auth.email, "managed@example.com")
        self.assertTrue(AuditLog.objects.filter(
            company=self.company, entity_id=self.target_membership.pk, action_code="USER_MEMBERSHIP_UPDATE",
        ).exists())
        history = self.client.get(self.url.replace("/?", "/history/?"))
        self.assertEqual(history.status_code, 200, history.data)
        self.assertEqual(history.data[0]["action"], "USER_MEMBERSHIP_UPDATE")
        unlink_unconfirmed = self.client.patch(self.url, {
            "version": changed.data["updated_at"], "employee": None,
        }, format="json")
        self.assertEqual(unlink_unconfirmed.status_code, 400, unlink_unconfirmed.data)
        unlinked = self.client.patch(self.url, {
            "version": changed.data["updated_at"], "employee": None, "confirm_unlink": True,
        }, format="json")
        self.assertEqual(unlinked.status_code, 200, unlinked.data)
        self.assertIsNone(unlinked.data["employee"])

    def test_rejects_forbidden_fields_stale_version_and_duplicate_employee(self):
        detail = self.client.get(self.url).data
        forbidden = self.client.patch(self.url, {
            "version": detail["updated_at"], "membership_status": "INACTIVE", "email": "other@example.com",
        }, format="json")
        self.assertEqual(forbidden.status_code, 400, forbidden.data)
        initial = self.client.patch(self.url, {
            "version": detail["updated_at"], "internal_display_name": "Version 1",
        }, format="json")
        self.assertEqual(initial.status_code, 200, initial.data)
        stale = self.client.patch(self.url, {
            "version": detail["updated_at"], "internal_display_name": "Overwrite",
        }, format="json")
        self.assertEqual(stale.status_code, 409, stale.data)
        other_auth = get_user_model().objects.create_user(username="other-managed", email="other-managed@example.com")
        CompanyMembership.objects.create(
            company=self.company, user=other_auth.iam_account, employee=self.employee,
            created_by=self.admin,
        )
        duplicate = self.client.patch(self.url, {
            "version": initial.data["updated_at"], "employee": str(self.employee.pk),
        }, format="json")
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        foreign_company = Company.objects.create(
            code="FOREIGN", name="Foreign", legal_name="Foreign", tax_code="0100888888",
            accounting_currency=self.company.accounting_currency,
            legal_reporting_currency=self.company.legal_reporting_currency,
        )
        foreign_branch = Branch.objects.create(company=foreign_company, code="F", name="Foreign Branch")
        foreign_employee = Employee.objects.create(
            company=foreign_company, branch=foreign_branch, employee_code="F001", full_name="Foreign Employee",
        )
        foreign = self.client.patch(self.url, {
            "version": initial.data["updated_at"], "employee": str(foreign_employee.pk),
        }, format="json")
        self.assertEqual(foreign.status_code, 400, foreign.data)
        self.target_membership.refresh_from_db()
        self.assertIsNone(self.target_membership.employee_id)
        self.assertEqual(self.target_membership.internal_display_name, "Version 1")

    def test_audit_failure_rolls_back_and_create_membership_is_disabled(self):
        detail = self.client.get(self.url).data
        with patch("iam.services.record_audit", side_effect=RuntimeError("audit down")):
            with self.assertRaises(RuntimeError):
                self.client.patch(self.url, {
                    "version": detail["updated_at"], "internal_note": "Should roll back",
                }, format="json")
        self.target_membership.refresh_from_db()
        self.assertEqual(self.target_membership.internal_note, "")
        created = self.client.post(f"/api/v1/iam/memberships/?company_id={self.company.pk}", {
            "company": str(self.company.pk), "user": str(self.target.pk),
        }, format="json")
        self.assertEqual(created.status_code, 405)

    def test_company_scope_and_global_account_write_are_restricted(self):
        manager_auth = get_user_model().objects.create_user(
            username="scope-manager", email="scope-manager@example.com", password="password-123",
        )
        manager_membership = CompanyMembership.objects.create(
            company=self.company, user=manager_auth.iam_account, created_by=self.admin,
        )
        role = Role.objects.create(company=self.company, code="USER_MANAGER", name="Quản lý User")
        for code in ("SYS.USER.VIEW", "SYS.USER.EDIT", "SYS.USER.CREATE", "SYS.USER.LINK_EMPLOYEE"):
            RolePermission.objects.create(role=role, permission=Permission.objects.get(code=code))
        scope = DataScopeSet.objects.create(company=self.company, code="BRANCH_A", name="Chi nhánh A", created_by=self.admin)
        DataScopeBranch.objects.create(data_scope_set=scope, branch=self.branch_a)
        UserRoleAssignment.objects.create(
            company_membership=manager_membership, role=role, data_scope_set=scope,
            valid_from=timezone.now() - timedelta(minutes=1), assigned_by=self.admin,
        )
        self.target_membership.employee = self.employee
        self.target_membership.save(update_fields=("employee",))
        outside_auth = get_user_model().objects.create_user(username="outside", email="outside@example.com")
        outside_employee = Employee.objects.create(
            company=self.company, branch=self.branch_b, employee_code="EMP002", full_name="Outside Employee",
        )
        outside_membership = CompanyMembership.objects.create(
            company=self.company, user=outside_auth.iam_account, employee=outside_employee,
            created_by=self.admin,
        )
        self.client.force_authenticate(manager_auth)
        listed = self.client.get(f"/api/v1/iam/memberships/?company_id={self.company.pk}")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual({row["id"] for row in listed.data}, {str(self.target_membership.pk)})
        self.assertIsNone(listed.data[0]["account_status"])
        self.assertIsNone(listed.data[0]["last_login"])
        denied = self.client.get(f"/api/v1/iam/memberships/{outside_membership.pk}/?company_id={self.company.pk}")
        self.assertEqual(denied.status_code, 404)
        history_denied = self.client.get(
            f"/api/v1/iam/memberships/{self.target_membership.pk}/history/?company_id={self.company.pk}"
        )
        self.assertEqual(history_denied.status_code, 403)
        legacy_list = self.client.get(f"/api/v1/iam/users/?company_id={self.company.pk}")
        self.assertEqual(legacy_list.status_code, 200, legacy_list.data)
        self.assertEqual({row["id"] for row in legacy_list.data}, {str(self.target.pk)})
        self.assertNotIn("is_active", legacy_list.data[0])
        global_edit = self.client.patch(
            f"/api/v1/iam/users/{self.target.pk}/?company_id={self.company.pk}",
            {"email": "hijack@example.com", "company": str(self.company.pk)}, format="json",
        )
        self.assertEqual(global_edit.status_code, 403)
        self.target_auth.refresh_from_db()
        self.assertEqual(self.target_auth.email, "managed@example.com")
        scope.status = "INACTIVE"
        scope.save(update_fields=("status",))
        inactive_scope = self.client.get(f"/api/v1/iam/memberships/?company_id={self.company.pk}")
        self.assertEqual(inactive_scope.status_code, 403)

    def test_view_only_hides_internal_note_and_terminated_membership_is_read_only(self):
        viewer_auth = get_user_model().objects.create_user(username="company-viewer", email="company-viewer@example.com")
        viewer_membership = CompanyMembership.objects.create(
            company=self.company, user=viewer_auth.iam_account, created_by=self.admin,
        )
        role = Role.objects.create(company=self.company, code="VIEW_ONLY", name="Chỉ xem User")
        RolePermission.objects.create(role=role, permission=Permission.objects.get(code="SYS.USER.VIEW"))
        UserRoleAssignment.objects.create(
            company_membership=viewer_membership, role=role,
            valid_from=timezone.now() - timedelta(minutes=1), assigned_by=self.admin,
        )
        self.target_membership.internal_note = "Internal secret"
        self.target_membership.save(update_fields=("internal_note",))
        self.client.force_authenticate(viewer_auth)
        detail = self.client.get(self.url)
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertIsNone(detail.data["internal_note"])
        self.assertFalse(detail.data["can_update"])
        denied = self.client.patch(self.url, {
            "version": detail.data["updated_at"], "internal_note": "Unauthorized",
        }, format="json")
        self.assertEqual(denied.status_code, 403)
        self.client.force_authenticate(self.admin_auth)
        self.target_membership.membership_status = "TERMINATED"
        self.target_membership.save(update_fields=("membership_status",))
        terminated = self.client.get(self.url)
        self.assertEqual(terminated.status_code, 200, terminated.data)
        self.assertFalse(terminated.data["can_update"])
        denied = self.client.patch(self.url, {
            "version": terminated.data["updated_at"], "internal_note": "Unauthorized",
        }, format="json")
        self.assertEqual(denied.status_code, 400, denied.data)


class RoleManagementTests(IamFixture):
    def setUp(self):
        super().setUp()
        self.company.status = "ACTIVE"
        self.company.save(update_fields=("status",))
        self.base_url = f"/api/v1/iam/roles/?company_id={self.company.pk}"

    def _create_role(self, code="ACCOUNTANT", name="Kế toán"):
        response = self.client.post(self.base_url, {"code": code, "name": name}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response

    def _url(self, role_id):
        return f"/api/v1/iam/roles/{role_id}/?company_id={self.company.pk}"

    def _action(self, role_id, action):
        return f"/api/v1/iam/roles/{role_id}/{action}/?company_id={self.company.pk}"

    def test_create_search_edit_and_reject_reserved_duplicate_or_forbidden_fields(self):
        created = self._create_role()
        self.assertEqual(created.data["role_class"], "COMPANY")
        self.assertEqual(created.data["status"], "ACTIVE")
        self.assertEqual(created.data["permission_count"], 0)
        self.assertEqual(str(created.data["created_by"]), str(self.admin.pk))
        listed = self.client.get(f"{self.base_url}&q=account")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(len(listed.data), 1)
        role_id = created.data["id"]
        changed = self.client.patch(self._url(role_id), {
            "version": created.data["updated_at"], "name": "Kế toán trưởng", "description": "Ghi sổ",
        }, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(changed.data["name"], "Kế toán trưởng")
        self.assertEqual(self.client.patch(self._url(role_id), {
            "version": changed.data["updated_at"], "status": "INACTIVE",
        }, format="json").status_code, 400)
        self.assertEqual(self.client.put(self._url(role_id), {"name": "Overwrite"}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(self._url(role_id)).status_code, 405)
        self.assertEqual(self.client.post(self.base_url, {
            "code": "accountant", "name": "Tên khác",
        }, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.base_url, {
            "code": "SYS_ADMIN", "name": "Tên khác",
        }, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.base_url, {
            "code": "OTHER", "name": "kế toán trưởng",
        }, format="json").status_code, 400)
        self.assertEqual(Role.objects.filter(company=self.company).count(), 1)
        history = self.client.get(self._action(role_id, "history"))
        self.assertEqual(history.status_code, 200, history.data)
        self.assertEqual([row["action"] for row in history.data[:2]], ["ROLE_EDIT", "ROLE_CREATE"])

    def test_clone_flattens_valid_permissions_and_keeps_source_independent(self):
        source = self._create_role("SOURCE", "Role nguồn")
        source_role = Role.objects.get(pk=source.data["id"])
        permission = Permission.objects.get(code="SYS.USER.VIEW")
        bundle = PermissionBundle.objects.create(code="TEST_BUNDLE", name="Test", module_code="SYS")
        PermissionBundleItem.objects.create(bundle=bundle, permission=permission)
        RolePermissionBundle.objects.create(role=source_role, bundle=bundle)
        source_version = self.client.get(self._url(source_role.pk)).data["updated_at"]
        copied = self.client.post(self._action(source_role.pk, "clone"), {
            "version": source_version, "code": "COPY", "name": "Bản sao",
        }, format="json")
        self.assertEqual(copied.status_code, 201, copied.data)
        self.assertNotEqual(copied.data["id"], source.data["id"])
        self.assertEqual(str(copied.data["source_role"]), source.data["id"])
        self.assertEqual(copied.data["permission_codes"], ["SYS.USER.VIEW"])
        self.assertFalse(RolePermissionBundle.objects.filter(role_id=copied.data["id"]).exists())
        PermissionBundleItem.objects.filter(bundle=bundle).delete()
        self.assertEqual(self.client.get(self._url(copied.data["id"])).data["permission_codes"], ["SYS.USER.VIEW"])
        self.assertEqual(self.client.get(self._url(source_role.pk)).data["permission_codes"], [])
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="ROLE_CLONE", entity_id=copied.data["id"]).exists())

    def test_deactivate_checks_work_items_and_reactivation_restores_effective_permission(self):
        created = self._create_role("REVIEWER", "Người xem")
        role = Role.objects.get(pk=created.data["id"])
        RolePermission.objects.create(role=role, permission=Permission.objects.get(code="SYS.USER.VIEW"))
        target_auth = get_user_model().objects.create_user(username="role-target", email="role-target@example.com")
        target_membership = CompanyMembership.objects.create(
            company=self.company, user=target_auth.iam_account, created_by=self.admin,
        )
        assignment = UserRoleAssignment.objects.create(
            company_membership=target_membership, role=role,
            valid_from=timezone.now() - timedelta(minutes=1), assigned_by=self.admin,
        )
        task = WorkItem.objects.create(
            company=self.company, assignee_role=role, title="Cần xem", task_type="TEST",
            entity_type="iam.Role", entity_id=role.pk, permission_code="SYS.USER.VIEW",
            dedupe_key=f"role-test-{uuid.uuid4()}",
        )
        impact = self.client.get(self._action(role.pk, "impact"))
        self.assertEqual(impact.status_code, 200, impact.data)
        self.assertEqual(impact.data["active_user_count"], 1)
        self.assertEqual(impact.data["active_work_item_count"], 1)
        version = self.client.get(self._url(role.pk)).data["updated_at"]
        blocked = self.client.post(self._action(role.pk, "deactivate"), {
            "version": version, "confirm": True,
        }, format="json")
        self.assertEqual(blocked.status_code, 400, blocked.data)
        task.status = WorkItem.Status.COMPLETED
        task.save(update_fields=("status",))
        stopped = self.client.post(self._action(role.pk, "deactivate"), {
            "version": version, "confirm": True,
        }, format="json")
        self.assertEqual(stopped.status_code, 200, stopped.data)
        from common_services.services import create_work_item
        with self.assertRaises(ValidationError):
            create_work_item(
                company=self.company, title="Không được giao", task_type="TEST", entity=role,
                permission_code="SYS.USER.VIEW", dedupe_key=f"inactive-role-{uuid.uuid4()}",
                assignee_role=role,
            )
        self.assertFalse(has_effective_permission(target_auth.iam_account, self.company, "SYS.USER.VIEW"))
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, "ACTIVE")
        resumed = self.client.post(self._action(role.pk, "reactivate"), {
            "version": stopped.data["updated_at"], "confirm": True,
        }, format="json")
        self.assertEqual(resumed.status_code, 200, resumed.data)
        self.assertTrue(has_effective_permission(target_auth.iam_account, self.company, "SYS.USER.VIEW"))

    def test_protected_role_stale_version_and_audit_rollback(self):
        protected = Role.objects.create(
            company=self.company, code="COMPANY_ADMIN", name="System Admin",
            role_type="STANDARD", is_system_admin=True, created_by=self.admin,
        )
        protected_detail = self.client.get(self._url(protected.pk)).data
        self.assertEqual(self.client.patch(self._url(protected.pk), {
            "version": protected_detail["updated_at"], "name": "Changed",
        }, format="json").status_code, 400)
        self.assertEqual(self.client.post(self._action(protected.pk, "deactivate"), {
            "version": protected_detail["updated_at"], "confirm": True,
        }, format="json").status_code, 400)
        created = self._create_role("NORMAL", "Role thường")
        changed = self.client.patch(self._url(created.data["id"]), {
            "version": created.data["updated_at"], "description": "First",
        }, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        stale = self.client.patch(self._url(created.data["id"]), {
            "version": created.data["updated_at"], "description": "Overwrite",
        }, format="json")
        self.assertEqual(stale.status_code, 409, stale.data)
        with patch("iam.role_services.record_audit", side_effect=RuntimeError("audit down")):
            with self.assertRaises(RuntimeError):
                self.client.patch(self._url(created.data["id"]), {
                    "version": changed.data["updated_at"], "description": "Not saved",
                }, format="json")
        self.assertEqual(Role.objects.get(pk=created.data["id"]).description, "First")

    def test_role_permissions_are_separate_for_view_and_create(self):
        manager_auth = get_user_model().objects.create_user(username="role-manager", email="role-manager@example.com")
        membership = CompanyMembership.objects.create(company=self.company, user=manager_auth.iam_account, created_by=self.admin)
        manager_role = Role.objects.create(company=self.company, code="ROLE_READER", name="Xem Role")
        RolePermission.objects.create(role=manager_role, permission=Permission.objects.get(code="SYS.ROLE.VIEW"))
        UserRoleAssignment.objects.create(
            company_membership=membership, role=manager_role,
            valid_from=timezone.now() - timedelta(minutes=1), assigned_by=self.admin,
        )
        self.client.force_authenticate(manager_auth)
        self.assertEqual(self.client.get(self.base_url).status_code, 200)
        denied = self.client.post(self.base_url, {"code": "NO", "name": "Không được tạo"}, format="json")
        self.assertEqual(denied.status_code, 403, denied.data)
        RolePermission.objects.create(role=manager_role, permission=Permission.objects.get(code="SYS.ROLE.CLONE"))
        source = Role.objects.create(company=self.company, code="SOURCE_ONLY", name="Role nguồn riêng")
        RolePermission.objects.create(role=source, permission=Permission.objects.get(code="SYS.USER.VIEW"))
        denied_clone = self.client.post(self._action(source.pk, "clone"), {
            "version": source.updated_at.isoformat(), "code": "ESCALATE", "name": "Vượt quyền",
        }, format="json")
        self.assertEqual(denied_clone.status_code, 403, denied_clone.data)
        self.assertFalse(Role.objects.filter(company=self.company, code="ESCALATE").exists())

    def test_last_company_admin_role_cannot_be_deactivated(self):
        first = self._create_role("ADMIN_ROLE", "Quản trị riêng")
        role = Role.objects.get(pk=first.data["id"])
        for code in ("SYS.USER.EDIT", "SYS.ROLE.EDIT"):
            RolePermission.objects.create(role=role, permission=Permission.objects.get(code=code))
        target_auth = get_user_model().objects.create_user(username="only-admin", email="only-admin@example.com")
        membership = CompanyMembership.objects.create(company=self.company, user=target_auth.iam_account, created_by=self.admin)
        UserRoleAssignment.objects.create(
            company_membership=membership, role=role,
            valid_from=timezone.now() - timedelta(minutes=1), assigned_by=self.admin,
        )
        blocked = self.client.post(self._action(role.pk, "deactivate"), {
            "version": first.data["updated_at"], "confirm": True,
        }, format="json")
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.assertEqual(Role.objects.get(pk=role.pk).status, "ACTIVE")
        replacement = Role.objects.create(company=self.company, code="REPLACEMENT", name="Quản trị thay thế")
        for code in ("SYS.USER.EDIT", "SYS.ROLE.EDIT"):
            RolePermission.objects.create(role=replacement, permission=Permission.objects.get(code=code))
        UserRoleAssignment.objects.create(
            company_membership=membership, role=replacement,
            valid_from=timezone.now() - timedelta(minutes=1), assigned_by=self.admin,
        )
        stopped = self.client.post(self._action(role.pk, "deactivate"), {
            "version": first.data["updated_at"], "confirm": True,
        }, format="json")
        self.assertEqual(stopped.status_code, 200, stopped.data)
