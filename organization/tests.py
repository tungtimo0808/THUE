from datetime import date, timedelta
from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.test.utils import override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from PIL import Image

from audit_log.models import AuditLog
from iam.models import (
    CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment,
)
from master_data.models import Currency

from .models import (
    Branch, Company, CompanyInformationVersion, Department, Employee, EmployeeAssignment,
    OrganizationUnit, OrganizationUnitDependency, OrganizationUnitHistory, Position,
)
from .services import assign_employee


class OrganizationFixture(TestCase):
    def setUp(self):
        self.currency, _ = Currency.objects.get_or_create(
            code="VND",
            defaults={"name": "Đồng Việt Nam", "numeric_code": "704"},
        )
        self.company = Company.objects.create(
            code="MA", name="Minh An", legal_name="Công ty Minh An", tax_code="0100000001",
            business_type="LLC_ONE_MEMBER", legal_representative="Nguyễn Văn A",
            province="Hà Nội", address="1 Tràng Tiền",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.branch = Branch.objects.create(company=self.company, code="HCM", name="Hồ Chí Minh", is_head_office=True)
        self.department = Department.objects.create(company=self.company, branch=self.branch, code="KT", name="Kế toán")
        self.position = Position.objects.create(company=self.company, code="KT", name="Kế toán viên")
        self.employee = Employee.objects.create(
            company=self.company, branch=self.branch, department=self.department,
            position=self.position, employee_code="NV001", full_name="Nguyễn Văn A",
        )


class OrganizationModelTests(OrganizationFixture):
    def test_branch_parent_must_belong_to_same_company(self):
        other = Company.objects.create(
            code="AP", name="An Phát", legal_name="Công ty An Phát", tax_code="0100000002",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        foreign_parent = Branch.objects.create(company=other, code="HN", name="Hà Nội")
        branch = Branch(company=self.company, parent=foreign_parent, code="DN", name="Đà Nẵng")
        with self.assertRaises(ValidationError):
            branch.full_clean()

    def test_employee_department_must_belong_to_selected_branch(self):
        other_branch = Branch.objects.create(company=self.company, code="HN", name="Hà Nội")
        employee = Employee(
            company=self.company, branch=other_branch, department=self.department,
            employee_code="NV002", full_name="Trần Văn B",
        )
        with self.assertRaises(ValidationError):
            employee.full_clean()

    def test_assign_employee_closes_previous_primary_assignment(self):
        first = assign_employee(
            employee=self.employee, valid_from=date(2026, 1, 1), branch=self.branch,
            department=self.department, position=self.position,
        )
        new_department = Department.objects.create(company=self.company, branch=self.branch, code="KD", name="Kinh doanh")
        second = assign_employee(
            employee=self.employee, valid_from=date(2026, 7, 1), branch=self.branch,
            department=new_department, position=self.position,
        )
        first.refresh_from_db()
        self.employee.refresh_from_db()
        self.assertEqual(first.valid_to, date(2026, 6, 30))
        self.assertIsNone(second.valid_to)
        self.assertEqual(self.employee.department, new_department)
        self.assertEqual(EmployeeAssignment.objects.filter(employee=self.employee, is_primary=True).count(), 2)


class OrganizationApiTests(OrganizationFixture):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="org-admin", password="test-password", is_staff=True
        )

    def test_authentication_is_required(self):
        response = self.client.get("/api/v1/organization/companies/")
        self.assertEqual(response.status_code, 401)

    def test_company_filter_limits_branch_list(self):
        other = Company.objects.create(
            code="AP", name="An Phát", legal_name="Công ty An Phát", tax_code="0100000002",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        Branch.objects.create(company=other, code="HN", name="Hà Nội")
        self.client.force_authenticate(self.user)
        response = self.client.get(f"/api/v1/organization/branches/?company_id={self.company.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(str(response.data[0]["company"]), str(self.company.id))

    def test_non_admin_user_cannot_access_organization_api(self):
        regular_user = get_user_model().objects.create_user(
            username="regular-user", password="test-password"
        )
        self.client.force_authenticate(regular_user)
        response = self.client.get("/api/v1/organization/companies/")
        self.assertEqual(response.status_code, 403)

    def test_assignment_api_closes_previous_assignment(self):
        account = self.user.iam_account
        membership = CompanyMembership.objects.create(company=self.company, user=account, created_by=account)
        role = Role.objects.create(company=self.company, code="EMP_ASSIGN", name="Phân công nhân viên")
        UserRoleAssignment.objects.create(company_membership=membership, role=role, assigned_by=account)
        RolePermission.objects.create(role=role, permission=Permission.objects.get(code="MD.EMPLOYEE.EDIT"), effect="ALLOW")
        self.client.force_authenticate(self.user)
        endpoint = "/api/v1/organization/employee-assignments/"
        payload = {
            "employee": str(self.employee.id),
            "branch": str(self.branch.id),
            "department": str(self.department.id),
            "position": str(self.position.id),
            "valid_from": "2026-01-01",
        }
        first_response = self.client.post(endpoint, payload, format="json")
        self.assertEqual(first_response.status_code, 201, first_response.data)

        new_department = Department.objects.create(
            company=self.company, branch=self.branch, code="KD", name="Kinh doanh"
        )
        payload["department"] = str(new_department.id)
        payload["valid_from"] = "2026-07-01"
        second_response = self.client.post(endpoint, payload, format="json")
        self.assertEqual(second_response.status_code, 201, second_response.data)

        first = EmployeeAssignment.objects.get(pk=first_response.data["id"])
        self.assertEqual(first.valid_to, date(2026, 6, 30))
        self.assertEqual(Employee.objects.get(pk=self.employee.pk).department, new_department)

    def test_assignment_history_cannot_be_deleted(self):
        assignment = assign_employee(
            employee=self.employee,
            valid_from=date(2026, 1, 1),
            branch=self.branch,
            department=self.department,
            position=self.position,
        )
        self.client.force_authenticate(self.user)
        response = self.client.delete(
            f"/api/v1/organization/employee-assignments/{assignment.id}/"
        )
        self.assertEqual(response.status_code, 405)


class CompanyInformationApiTests(OrganizationFixture):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.auth_user = get_user_model().objects.create_user(
            username="company-editor", email="editor@example.com", password="test-password"
        )
        self.account = self.auth_user.iam_account
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.account, created_by=self.account
        )
        self.role = Role.objects.create(
            company=self.company, code="PROFILE_EDITOR", name="Quản lý thông tin doanh nghiệp"
        )
        UserRoleAssignment.objects.create(
            company_membership=self.membership, role=self.role, assigned_by=self.account
        )
        self.client.force_authenticate(self.auth_user)
        self.endpoint = f"/api/v1/organization/companies/{self.company.id}/information/"

    def grant(self, *codes):
        for code in codes:
            RolePermission.objects.get_or_create(
                role=self.role, permission=Permission.objects.get(code=code), defaults={"effect": "ALLOW"}
            )

    def current_version(self):
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["company"]["version"]

    def test_view_and_edit_permissions_are_independent(self):
        denied = self.client.get(self.endpoint)
        self.assertEqual(denied.status_code, 403)
        self.grant("SYS.COMPANY_PROFILE.VIEW")
        viewed = self.client.get(self.endpoint)
        self.assertEqual(viewed.status_code, 200, viewed.data)
        self.assertFalse(viewed.data["can_edit"])
        edited = self.client.patch(self.endpoint, {
            "version": viewed.data["company"]["version"], "name": "Tên mới",
        }, format="json")
        self.assertEqual(edited.status_code, 403)

        self.role.role_permissions.all().delete()
        self.grant("SYS.COMPANY_PROFILE.EDIT")
        edit_only = self.client.patch(self.endpoint, {
            "version": viewed.data["company"]["version"], "name": "Editor không có quyền xem",
        }, format="json")
        self.assertEqual(edit_only.status_code, 200, edit_only.data)
        self.assertEqual(self.client.get(self.endpoint).status_code, 403)

    def test_company_catalog_cannot_bypass_profile_view_permission(self):
        catalog = "/api/v1/organization/companies/"
        self.assertEqual(self.client.get(catalog).status_code, 403)
        self.grant("SYS.COMPANY_PROFILE.VIEW")
        response = self.client.get(catalog)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([item["id"] for item in response.data], [str(self.company.id)])
        other = Company.objects.create(
            code="OTHER", name="Other", legal_name="Other", tax_code="0109999998",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        self.assertEqual(self.client.get(f"{catalog}{other.id}/").status_code, 404)

    def test_update_is_versioned_and_audited_while_protected_fields_are_blocked(self):
        self.grant("SYS.COMPANY_PROFILE.VIEW", "SYS.COMPANY_PROFILE.EDIT")
        version = self.current_version()
        response = self.client.patch(self.endpoint, {
            "version": version, "name": "Minh An mới", "phone": "+84 912 345 678",
            "website": "https://minhan.example", "default_locale": "vi-VN",
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["message"], "Cập nhật thông tin doanh nghiệp thành công")
        self.company.refresh_from_db()
        self.assertEqual(self.company.name, "Minh An mới")
        self.assertEqual(CompanyInformationVersion.objects.filter(company=self.company, status="ACTIVE").count(), 1)
        audit = AuditLog.objects.get(company=self.company, action_code="UPDATE_COMPANY_INFORMATION")
        self.assertTrue(audit.changes.filter(field_name="name").exists())
        blocked = self.client.patch(self.endpoint, {
            "version": response.data["company"]["version"], "tax_code": "0109999999",
        }, format="json")
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.assertIn("quy trình riêng", str(blocked.data["tax_code"]))
        self.company.refresh_from_db()
        self.assertEqual(self.company.tax_code, "0100000001")

    def test_legal_change_requires_date_and_future_change_is_scheduled(self):
        self.grant("SYS.COMPANY_PROFILE.VIEW", "SYS.COMPANY_PROFILE.EDIT")
        version = self.current_version()
        missing_date = self.client.patch(self.endpoint, {
            "version": version, "legal_name": "Công ty Minh An Mới",
        }, format="json")
        self.assertEqual(missing_date.status_code, 400, missing_date.data)
        self.assertIn("effective_from", missing_date.data)

        future = timezone.localdate() + timedelta(days=10)
        scheduled = self.client.patch(self.endpoint, {
            "version": version, "legal_name": "Công ty Minh An Tương Lai",
            "effective_from": future.isoformat(),
        }, format="json")
        self.assertEqual(scheduled.status_code, 202, scheduled.data)
        self.assertTrue(scheduled.data["scheduled"])
        self.company.refresh_from_db()
        self.assertEqual(self.company.legal_name, "Công ty Minh An")
        pending = CompanyInformationVersion.objects.get(company=self.company, status="PENDING")
        self.assertEqual(pending.effective_from, future)

        immediate = self.client.patch(self.endpoint, {
            "version": version, "name": "Tên hiển thị cập nhật sau khi lên lịch",
        }, format="json")
        self.assertEqual(immediate.status_code, 200, immediate.data)
        pending.effective_from = timezone.localdate()
        pending.save(update_fields=("effective_from",))
        effective = self.client.get(self.endpoint)
        self.assertEqual(effective.status_code, 200, effective.data)
        self.assertEqual(effective.data["company"]["legal_name"], "Công ty Minh An Tương Lai")
        self.assertEqual(effective.data["company"]["name"], "Tên hiển thị cập nhật sau khi lên lịch")

    def test_future_legal_change_applies_contact_details_immediately(self):
        self.grant("SYS.COMPANY_PROFILE.VIEW", "SYS.COMPANY_PROFILE.EDIT")
        version = self.current_version()
        future = timezone.localdate() + timedelta(days=10)
        response = self.client.patch(self.endpoint, {
            "version": version,
            "effective_from": future.isoformat(),
            "legal_name": "Công ty Minh An Tương Lai",
            "email": "new@example.com",
            "name": "Minh An mới",
        }, format="json")
        self.assertEqual(response.status_code, 202, response.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.legal_name, "Công ty Minh An")
        self.assertEqual(self.company.email, "new@example.com")
        self.assertEqual(self.company.name, "Minh An mới")
        pending = CompanyInformationVersion.objects.get(company=self.company, status="PENDING")
        self.assertEqual(pending.data["_changed_fields"], ["legal_name"])
        self.assertEqual(CompanyInformationVersion.objects.filter(company=self.company, status="ACTIVE").count(), 1)
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="UPDATE_COMPANY_INFORMATION").exists())
        self.assertTrue(AuditLog.objects.filter(company=self.company, action_code="SCHEDULE_COMPANY_INFORMATION").exists())
        pending.effective_from = timezone.localdate()
        pending.save(update_fields=("effective_from",))
        effective = self.client.get(self.endpoint)
        self.assertEqual(effective.status_code, 200, effective.data)
        self.assertEqual(effective.data["company"]["legal_name"], "Công ty Minh An Tương Lai")
        self.assertEqual(effective.data["company"]["email"], "new@example.com")

    def test_future_contact_only_change_waits_for_effective_date(self):
        self.grant("SYS.COMPANY_PROFILE.VIEW", "SYS.COMPANY_PROFILE.EDIT")
        version = self.current_version()
        future = timezone.localdate() + timedelta(days=5)
        response = self.client.patch(self.endpoint, {
            "version": version, "effective_from": future.isoformat(),
            "email": "later@example.com",
        }, format="json")
        self.assertEqual(response.status_code, 202, response.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.email, "")
        pending = CompanyInformationVersion.objects.get(company=self.company, status="PENDING")
        self.assertEqual(pending.data["_changed_fields"], ["email"])

    def test_future_legal_change_and_logo_applies_logo_now(self):
        self.grant("SYS.COMPANY_PROFILE.VIEW", "SYS.COMPANY_PROFILE.EDIT")
        version = self.current_version()
        image = BytesIO()
        Image.new("RGB", (2, 2), "blue").save(image, format="PNG")
        image.seek(0)
        with TemporaryDirectory() as media_dir, override_settings(MEDIA_ROOT=media_dir):
            response = self.client.patch(self.endpoint, {
                "version": version,
                "effective_from": (timezone.localdate() + timedelta(days=5)).isoformat(),
                "legal_name": "Công ty Minh An Tương Lai",
                "logo": SimpleUploadedFile("logo.png", image.read(), content_type="image/png"),
            }, format="multipart")
            self.assertEqual(response.status_code, 202, response.data)
            self.company.refresh_from_db()
            self.assertTrue(self.company.logo.name)
            self.assertTrue(self.company.logo.storage.exists(self.company.logo.name))
            self.assertEqual(self.company.legal_name, "Công ty Minh An")
            pending = CompanyInformationVersion.objects.get(company=self.company, status="PENDING")
            self.assertEqual(pending.data["_changed_fields"], ["legal_name"])

    def test_mixed_future_update_rolls_back_when_audit_fails(self):
        self.grant("SYS.COMPANY_PROFILE.VIEW", "SYS.COMPANY_PROFILE.EDIT")
        version = self.current_version()
        with patch("organization.company_information.record_audit", side_effect=[None, RuntimeError("audit failed")]):
            response = self.client.patch(self.endpoint, {
                "version": version,
                "effective_from": (timezone.localdate() + timedelta(days=5)).isoformat(),
                "legal_name": "Công ty Minh An Tương Lai",
                "email": "new@example.com",
            }, format="json")
        self.assertEqual(response.status_code, 500)
        self.company.refresh_from_db()
        self.assertEqual(self.company.email, "")
        self.assertEqual(self.company.legal_name, "Công ty Minh An")
        self.assertFalse(CompanyInformationVersion.objects.filter(company=self.company).exists())

    def test_stale_version_and_company_status_prevent_overwrite(self):
        self.grant("SYS.COMPANY_PROFILE.VIEW", "SYS.COMPANY_PROFILE.EDIT")
        stale = self.current_version()
        first = self.client.patch(self.endpoint, {"version": stale, "name": "Lần một"}, format="json")
        self.assertEqual(first.status_code, 200, first.data)
        conflict = self.client.patch(self.endpoint, {"version": stale, "name": "Ghi đè"}, format="json")
        self.assertEqual(conflict.status_code, 409, conflict.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.name, "Lần một")

        self.company.status = "INACTIVE"
        self.company.save(update_fields=("status", "updated_at"))
        view_inactive = self.client.get(self.endpoint)
        self.assertEqual(view_inactive.status_code, 200)
        update_inactive = self.client.patch(self.endpoint, {
            "version": view_inactive.data["company"]["version"], "name": "Không được lưu",
        }, format="json")
        self.assertEqual(update_inactive.status_code, 403)

    def test_suspended_company_needs_special_permission_and_logo_is_validated(self):
        self.grant("SYS.COMPANY_PROFILE.VIEW", "SYS.COMPANY_PROFILE.EDIT")
        self.company.status = "SUSPENDED"
        self.company.save(update_fields=("status", "updated_at"))
        version = self.current_version()
        denied = self.client.patch(self.endpoint, {"version": version, "name": "Bị chặn"}, format="json")
        self.assertEqual(denied.status_code, 403)

        self.grant("SYS.COMPANY_PROFILE.EDIT_SUSPENDED")
        invalid_logo = SimpleUploadedFile("logo.gif", b"GIF89a-invalid", content_type="image/gif")
        invalid = self.client.patch(self.endpoint, {
            "version": version, "logo": invalid_logo,
        }, format="multipart")
        self.assertEqual(invalid.status_code, 400, invalid.data)
        updated = self.client.patch(self.endpoint, {"version": version, "name": "Được cập nhật"}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)

    def test_legacy_company_endpoint_cannot_bypass_protected_update_flow(self):
        self.client.force_authenticate(get_user_model().objects.create_user(
            username="staff-bypass", password="test-password", is_staff=True
        ))
        response = self.client.patch(
            f"/api/v1/organization/companies/{self.company.id}/",
            {"tax_code": "0109999999"}, format="json",
        )
        self.assertEqual(response.status_code, 405)


class OrganizationStructureApiTests(OrganizationFixture):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.auth_user = get_user_model().objects.create_user(
            username="structure-admin", email="structure@example.com", password="test-password"
        )
        self.account = self.auth_user.iam_account
        self.membership = CompanyMembership.objects.create(
            company=self.company, user=self.account, created_by=self.account
        )
        self.role = Role.objects.create(company=self.company, code="STRUCTURE_ADMIN", name="Quản lý cơ cấu")
        assignment = UserRoleAssignment.objects.create(
            company_membership=self.membership, role=self.role, assigned_by=self.account
        )
        for permission in Permission.objects.filter(code__startswith="SYS.ORG_STRUCTURE."):
            RolePermission.objects.create(role=self.role, permission=permission)
        self.client.force_authenticate(self.auth_user)
        self.root = OrganizationUnit.objects.get(company=self.company, unit_type="COMPANY")
        # Structure scenarios use 2026-09-30 as their business date, regardless of test run date.
        clock = patch("django.utils.timezone.localdate", return_value=date(2026, 9, 30))
        clock.start()
        self.addCleanup(clock.stop)
        self.root.start_date = date(2026, 9, 30)
        self.root.save(update_fields=("start_date",))
        self.base = f"/api/v1/organization/structure/units/?company_id={self.company.id}"

    def create_unit(self, code, unit_type="BRANCH", parent=None, **extra):
        payload = {
            "unit_type": unit_type, "code": code, "name": f"Đơn vị {code}",
            "parent": str((parent or self.root).id), "start_date": "2026-09-30", **extra,
        }
        response = self.client.post(self.base, payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return OrganizationUnit.objects.get(pk=response.data["unit"]["id"]), response.data["unit"]

    def detail(self, unit, suffix=""):
        return f"/api/v1/organization/structure/units/{unit.id}/{suffix}?company_id={self.company.id}"

    def test_exactly_one_root_and_root_is_immutable(self):
        self.assertEqual(OrganizationUnit.objects.filter(company=self.company, unit_type="COMPANY").count(), 1)
        duplicate = self.client.post(self.base, {
            "unit_type": "COMPANY", "code": "ROOT2", "name": "Root 2",
            "parent": str(self.root.id), "start_date": "2026-09-30",
        }, format="json")
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        edited = self.client.patch(self.detail(self.root), {
            "version": self.root.updated_at.isoformat(), "name": "Không được đổi",
        }, format="json")
        self.assertEqual(edited.status_code, 400)
        deleted = self.client.delete(self.detail(self.root))
        self.assertEqual(deleted.status_code, 405)

    def test_permissions_membership_and_company_scope_are_enforced(self):
        self.role.role_permissions.all().delete()
        denied = self.client.get(self.base)
        self.assertEqual(denied.status_code, 403)
        view_permission = Permission.objects.get(code="SYS.ORG_STRUCTURE.VIEW")
        RolePermission.objects.create(role=self.role, permission=view_permission)
        viewed = self.client.get(self.base)
        self.assertEqual(viewed.status_code, 200, viewed.data)
        created = self.client.post(self.base, {
            "unit_type": "BRANCH", "code": "NOPE", "name": "Không quyền",
            "parent": str(self.root.id), "start_date": "2026-09-30",
        }, format="json")
        self.assertEqual(created.status_code, 403)

        other = Company.objects.create(
            code="OTHER", name="Khác", legal_name="Công ty Khác", tax_code="0109999998",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        cross = self.client.get(f"/api/v1/organization/structure/units/?company_id={other.id}")
        self.assertEqual(cross.status_code, 403)

    def test_create_rejects_duplicate_invalid_parent_dates_and_manager(self):
        missing = self.client.post(self.base, {}, format="json")
        self.assertEqual(missing.status_code, 400, missing.data)
        self.assertIn("code", missing.data)
        invalid_formats = self.client.post(self.base, {
            "unit_type": "BRANCH", "code": "BAD CODE", "name": "Sai định dạng",
            "parent": str(self.root.id), "start_date": "2026-09-30",
            "phone": "abc", "email": "not-an-email", "tax_code": "123",
        }, format="json")
        self.assertEqual(invalid_formats.status_code, 400, invalid_formats.data)
        self.assertIn("phone", invalid_formats.data)
        self.assertIn("email", invalid_formats.data)
        self.assertIn("tax_code", invalid_formats.data)
        branch, _ = self.create_unit("BR01")
        duplicate = self.client.post(self.base, {
            "unit_type": "BRANCH", "code": "BR01", "name": "Trùng",
            "parent": str(self.root.id), "start_date": "2026-09-30",
        }, format="json")
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        wrong_parent = self.client.post(self.base, {
            "unit_type": "BRANCH", "code": "BR02", "name": "Sai cha",
            "parent": str(branch.id), "start_date": "2026-09-30",
        }, format="json")
        self.assertEqual(wrong_parent.status_code, 400, wrong_parent.data)
        bad_dates = self.client.post(self.base, {
            "unit_type": "DEPARTMENT", "code": "D01", "name": "Sai ngày",
            "parent": str(branch.id), "start_date": "2026-10-01", "end_date": "2026-09-30",
        }, format="json")
        self.assertEqual(bad_dates.status_code, 400, bad_dates.data)

        outsider = get_user_model().objects.create_user(username="outsider", password="test-password")
        other_company = Company.objects.create(
            code="OUT", name="Out", legal_name="Out", tax_code="0109999997",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        outsider_membership = CompanyMembership.objects.create(
            company=other_company, user=outsider.iam_account, created_by=outsider.iam_account
        )
        bad_manager = self.client.post(self.base, {
            "unit_type": "DEPARTMENT", "code": "D02", "name": "Sai quản lý",
            "parent": str(branch.id), "start_date": "2026-09-30",
            "manager_membership": str(outsider_membership.id),
        }, format="json")
        self.assertEqual(bad_manager.status_code, 400, bad_manager.data)
        branch.status = "INACTIVE"; branch.save(update_fields=("status", "updated_at"))
        inactive_parent = self.client.post(self.base, {
            "unit_type": "DEPARTMENT", "code": "D03", "name": "Cha inactive",
            "parent": str(branch.id), "start_date": "2026-09-30",
        }, format="json")
        self.assertEqual(inactive_parent.status_code, 400, inactive_parent.data)

    def test_codes_are_normalized_and_end_date_uses_deactivation_flow(self):
        branch, data = self.create_unit("branch_one")
        self.assertEqual(branch.code, "BRANCH_ONE")
        duplicate = self.client.post(self.base, {
            "unit_type": "BRANCH", "code": "BRANCH_ONE", "name": "Duplicate",
            "parent": str(self.root.id), "start_date": "2026-09-30",
        }, format="json")
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        bypass = self.client.patch(self.detail(branch), {
            "version": data["version"], "end_date": "2026-10-01",
        }, format="json")
        self.assertEqual(bypass.status_code, 400, bypass.data)
        branch.refresh_from_db()
        self.assertIsNone(branch.end_date)

    def test_pending_moves_cannot_be_overwritten_or_form_future_cycle(self):
        first, first_data = self.create_unit("PENDING-A", "DEPARTMENT")
        second, second_data = self.create_unit("PENDING-B", "DEPARTMENT")
        scheduled = self.client.post(self.detail(second, "move/"), {
            "version": second_data["version"], "parent": str(first.id), "effective_from": "2026-10-01",
        }, format="json")
        self.assertEqual(scheduled.status_code, 200, scheduled.data)
        repeated = self.client.post(self.detail(second, "move/"), {
            "version": scheduled.data["unit"]["version"], "parent": str(self.root.id), "effective_from": "2026-10-02",
        }, format="json")
        self.assertEqual(repeated.status_code, 400, repeated.data)
        cycle = self.client.post(self.detail(first, "move/"), {
            "version": first_data["version"], "parent": str(second.id), "effective_from": "2026-10-01",
        }, format="json")
        self.assertEqual(cycle.status_code, 400, cycle.data)
        self.assertIn("parent", cycle.data)

    def test_due_move_and_deactivation_are_recorded_once(self):
        destination, _ = self.create_unit("DEST", "DEPARTMENT")
        moving, moving_data = self.create_unit("MOVING", "DEPARTMENT")
        stopped, stopped_data = self.create_unit("STOP-LATER", "BRANCH")
        moved = self.client.post(self.detail(moving, "move/"), {
            "version": moving_data["version"], "parent": str(destination.id), "effective_from": "2026-10-01",
        }, format="json")
        self.assertEqual(moved.status_code, 200, moved.data)
        deactivated = self.client.post(self.detail(stopped, "deactivate/"), {
            "version": stopped_data["version"], "end_date": "2026-10-01", "confirm": True,
        }, format="json")
        self.assertEqual(deactivated.status_code, 200, deactivated.data)
        with patch("django.utils.timezone.localdate", return_value=date(2026, 10, 2)):
            self.assertEqual(self.client.get(self.detail(moving)).status_code, 200)
            self.assertEqual(self.client.get(self.detail(stopped)).status_code, 200)
            self.assertEqual(self.client.get(self.detail(moving)).status_code, 200)
        moving.refresh_from_db(); stopped.refresh_from_db()
        self.assertEqual(moving.parent_id, destination.id)
        self.assertEqual(stopped.status, "INACTIVE")
        self.assertEqual(OrganizationUnitHistory.objects.filter(unit=moving, action="APPLY_MOVE").count(), 1)
        self.assertEqual(OrganizationUnitHistory.objects.filter(unit=stopped, action="APPLY_DEACTIVATE").count(), 1)
        self.assertEqual(AuditLog.objects.filter(entity_id=moving.id, action_code="ORG_UNIT_APPLY_MOVE").count(), 1)
        self.assertEqual(AuditLog.objects.filter(entity_id=stopped.id, action_code="ORG_UNIT_APPLY_DEACTIVATE").count(), 1)

    def test_manager_assignment_blocks_deactivation_and_requires_move_confirmation(self):
        unit, data = self.create_unit("MANAGED", "DEPARTMENT", manager_membership=str(self.membership.id))
        destination, _ = self.create_unit("DEST-MANAGED", "DEPARTMENT")
        blocked = self.client.post(self.detail(unit, "deactivate/"), {
            "version": data["version"], "end_date": "2026-09-30", "confirm": True,
        }, format="json")
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.assertIn("assignments", blocked.data)
        impact = self.client.post(self.detail(unit, "move/"), {
            "version": data["version"], "parent": str(destination.id), "effective_from": "2026-09-30",
        }, format="json")
        self.assertEqual(impact.status_code, 400, impact.data)
        self.assertIn("impacts", impact.data)

    def test_scheduled_deactivation_cannot_be_replaced_or_moved_past_end_date(self):
        unit, data = self.create_unit("END-LATER", "DEPARTMENT")
        stopped = self.client.post(self.detail(unit, "deactivate/"), {
            "version": data["version"], "end_date": "2026-10-01", "confirm": True,
        }, format="json")
        self.assertEqual(stopped.status_code, 200, stopped.data)
        repeated = self.client.post(self.detail(unit, "deactivate/"), {
            "version": stopped.data["unit"]["version"], "end_date": "2026-10-02", "confirm": True,
        }, format="json")
        self.assertEqual(repeated.status_code, 400, repeated.data)
        destination, _ = self.create_unit("DEST-END", "DEPARTMENT")
        move = self.client.post(self.detail(unit, "move/"), {
            "version": stopped.data["unit"]["version"], "parent": str(destination.id), "effective_from": "2026-10-02",
        }, format="json")
        self.assertEqual(move.status_code, 400, move.data)
        self.assertIn("effective_from", move.data)

    def test_scheduled_to_stop_unit_cannot_gain_new_child(self):
        parent, data = self.create_unit("PARENT-STOP", "DEPARTMENT")
        stopped = self.client.post(self.detail(parent, "deactivate/"), {
            "version": data["version"], "end_date": "2026-10-01", "confirm": True,
        }, format="json")
        self.assertEqual(stopped.status_code, 200, stopped.data)
        child = self.client.post(self.base, {
            "unit_type": "DEPARTMENT", "code": "LATE-CHILD", "name": "Late child",
            "parent": str(parent.id), "start_date": "2026-09-30",
        }, format="json")
        self.assertEqual(child.status_code, 400, child.data)
        self.assertIn("parent", child.data)

    def test_move_rejects_self_descendant_cross_company_and_stale_version(self):
        branch, _ = self.create_unit("B1")
        department, dep_data = self.create_unit("D1", "DEPARTMENT", branch)
        child, _ = self.create_unit("D2", "DEPARTMENT", department)
        self_move = self.client.post(self.detail(department, "move/"), {
            "version": dep_data["version"], "parent": str(department.id), "effective_from": "2026-09-30",
        }, format="json")
        self.assertEqual(self_move.status_code, 400, self_move.data)
        cycle = self.client.post(self.detail(department, "move/"), {
            "version": dep_data["version"], "parent": str(child.id), "effective_from": "2026-09-30",
        }, format="json")
        self.assertEqual(cycle.status_code, 400, cycle.data)

        other = Company.objects.create(
            code="CROSS", name="Cross", legal_name="Cross", tax_code="0109999996",
            accounting_currency=self.currency, legal_reporting_currency=self.currency,
        )
        cross_parent = OrganizationUnit.objects.get(company=other, unit_type="COMPANY")
        cross = self.client.post(self.detail(department, "move/"), {
            "version": dep_data["version"], "parent": str(cross_parent.id), "effective_from": "2026-09-30",
        }, format="json")
        self.assertEqual(cross.status_code, 400, cross.data)

        impact = OrganizationUnitDependency.objects.create(
            unit=department, dependency_type="DATA_SCOPE", reference="SCOPE-DEPARTMENT"
        )
        impact_block = self.client.post(self.detail(department, "move/"), {
            "version": dep_data["version"], "parent": str(self.root.id), "effective_from": "2026-09-30",
        }, format="json")
        self.assertEqual(impact_block.status_code, 400, impact_block.data)
        self.assertIn("impacts", impact_block.data)
        impact.delete()

        changed = self.client.patch(self.detail(department), {
            "version": dep_data["version"], "name": "Đã đổi",
        }, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        bypass = self.client.patch(self.detail(department), {
            "version": changed.data["unit"]["version"], "parent": str(self.root.id),
        }, format="json")
        self.assertEqual(bypass.status_code, 400, bypass.data)
        self.assertIn("Di chuyển", str(bypass.data["parent"]))
        stale = self.client.post(self.detail(department, "move/"), {
            "version": dep_data["version"], "parent": str(self.root.id), "effective_from": "2026-09-30",
        }, format="json")
        self.assertEqual(stale.status_code, 409, stale.data)

    def test_deactivate_checks_confirmation_children_and_dependencies_then_reactivates(self):
        branch, branch_data = self.create_unit("STOP")
        child, _ = self.create_unit("STOP-D", "DEPARTMENT", branch)
        no_confirm = self.client.post(self.detail(branch, "deactivate/"), {
            "version": branch_data["version"], "end_date": "2026-09-30", "confirm": False,
        }, format="json")
        self.assertEqual(no_confirm.status_code, 400, no_confirm.data)
        children = self.client.post(self.detail(branch, "deactivate/"), {
            "version": branch_data["version"], "end_date": "2026-09-30", "confirm": True,
        }, format="json")
        self.assertEqual(children.status_code, 400, children.data)
        self.assertIn("children", children.data)
        child.status = "INACTIVE"; child.end_date = date(2026, 9, 30); child.save()
        dependency = OrganizationUnitDependency.objects.create(
            unit=branch, dependency_type="WORKFLOW", reference="WF-APPROVAL"
        )
        dependency_block = self.client.post(self.detail(branch, "deactivate/"), {
            "version": branch_data["version"], "end_date": "2026-09-30", "confirm": True,
        }, format="json")
        self.assertEqual(dependency_block.status_code, 400, dependency_block.data)
        self.assertIn("dependencies", dependency_block.data)
        dependency.is_active = False; dependency.save(update_fields=("is_active",))
        stopped = self.client.post(self.detail(branch, "deactivate/"), {
            "version": branch_data["version"], "end_date": "2026-09-30", "confirm": True,
        }, format="json")
        self.assertEqual(stopped.status_code, 200, stopped.data)
        self.assertEqual(stopped.data["unit"]["status"], "INACTIVE")
        self.assertTrue(AuditLog.objects.filter(action_code="ORG_UNIT_DEACTIVATE", entity_id=branch.id).exists())

        self.root.status = "INACTIVE"; self.root.save(update_fields=("status", "updated_at"))
        blocked = self.client.post(self.detail(branch, "reactivate/"), {
            "version": stopped.data["unit"]["version"], "start_date": "2026-10-01",
        }, format="json")
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.root.status = "ACTIVE"; self.root.save(update_fields=("status", "updated_at"))
        reactivated = self.client.post(self.detail(branch, "reactivate/"), {
            "version": stopped.data["unit"]["version"], "start_date": "2026-10-01",
        }, format="json")
        self.assertEqual(reactivated.status_code, 200, reactivated.data)

    def test_future_effect_search_tree_history_and_transaction_rollback(self):
        first, _ = self.create_unit("TREE-A")
        second, second_data = self.create_unit("TREE-B")
        department, dep_data = self.create_unit("FUTURE", "DEPARTMENT", first, start_date="2027-01-01")
        self.assertFalse(dep_data["is_effective"])
        moved = self.client.post(self.detail(department, "move/"), {
            "version": dep_data["version"], "parent": str(second.id), "effective_from": "2027-02-01",
        }, format="json")
        self.assertEqual(moved.status_code, 200, moved.data)
        department.refresh_from_db()
        self.assertEqual(department.parent_id, first.id)
        self.assertEqual(department.pending_parent_id, second.id)
        searched = self.client.get(f"{self.base}&q=FUTURE&type=DEPARTMENT&status=ACTIVE")
        self.assertEqual(len(searched.data["results"]), 1)
        tree = self.client.get(f"{self.base}&view=tree")
        self.assertEqual(tree.status_code, 200, tree.data)
        history = self.client.get(self.detail(department, "history/"))
        self.assertEqual(history.status_code, 200, history.data)
        self.assertGreaterEqual(len(history.data["results"]), 2)

        before_name = department.name
        with patch("organization.structure_services.record_history", side_effect=RuntimeError("audit failed")):
            failed = self.client.patch(self.detail(department), {
                "version": moved.data["unit"]["version"], "name": "Không được commit",
            }, format="json")
        self.assertEqual(failed.status_code, 500, failed.data)
        self.assertEqual(failed.data["detail"], "Không thể lưu cơ cấu tổ chức. Vui lòng thử lại sau.")
        department.refresh_from_db()
        self.assertEqual(department.name, before_name)

    def test_company_state_and_type_change_dependencies_are_enforced(self):
        branch, branch_data = self.create_unit("TYPE")
        self.create_unit("TYPE-D", "DEPARTMENT", branch)
        type_change = self.client.patch(self.detail(branch), {
            "version": branch_data["version"], "unit_type": "OTHER",
        }, format="json")
        self.assertEqual(type_change.status_code, 400, type_change.data)
        self.company.status = "INACTIVE"; self.company.save(update_fields=("status", "updated_at"))
        blocked = self.client.post(self.base, {
            "unit_type": "BRANCH", "code": "LATE", "name": "Bị chặn",
            "parent": str(self.root.id), "start_date": "2026-09-30",
        }, format="json")
        self.assertEqual(blocked.status_code, 403, blocked.data)
