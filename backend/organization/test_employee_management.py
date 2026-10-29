from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from iam.models import CompanyMembership, Permission, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency
from audit_log.models import AuditLog
from .models import Branch, Company, Employee


class EmployeeManagementTests(TestCase):
    def setUp(self):
        currency, _ = Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.company = Company.objects.create(code="EMP_A", name="A", legal_name="A", tax_code="0999000001", accounting_currency=currency, legal_reporting_currency=currency, status="ACTIVE")
        self.other = Company.objects.create(code="EMP_B", name="B", legal_name="B", tax_code="0999000002", accounting_currency=currency, legal_reporting_currency=currency, status="ACTIVE")
        self.branch = Branch.objects.create(company=self.company, code="A", name="A")
        self.foreign_branch = Branch.objects.create(company=self.other, code="B", name="B")
        auth = get_user_model().objects.create_user(username="employee-editor", password="test")
        self.account = auth.iam_account
        self.membership = CompanyMembership.objects.create(company=self.company, user=self.account, created_by=self.account)
        self.role = Role.objects.create(company=self.company, code="EMP_EDITOR", name="Nhân sự")
        UserRoleAssignment.objects.create(company_membership=self.membership, role=self.role, assigned_by=self.account)
        self.client = APIClient()
        self.client.force_authenticate(auth)
        self.url = "/api/v1/organization/employees/"

    def grant(self, *actions):
        for action in actions:
            RolePermission.objects.get_or_create(role=self.role, permission=Permission.objects.get(code=f"MD.EMPLOYEE.{action}"), defaults={"effect": "ALLOW"})

    def create_employee(self, code="NV001", **fields):
        return Employee.objects.create(company=self.company, branch=self.branch, employee_code=code, full_name="Nguyễn Văn A", contract_type="RESIDENT_LONG", **fields)

    def test_create_requires_scoped_permission_and_keeps_company_boundary(self):
        payload = {"company": str(self.company.pk), "branch": str(self.branch.pk), "employee_code": "NV002", "full_name": "Trần B", "contract_type": "RESIDENT_LONG"}
        self.assertEqual(self.client.post(self.url, payload, format="json").status_code, 403)
        self.grant("CREATE")
        self.assertEqual(self.client.post(self.url, {**payload, "branch": str(self.foreign_branch.pk)}, format="json").status_code, 400)
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(AuditLog.objects.filter(entity_id=response.data["id"], action_code="EMPLOYEE_CREATE").exists())

    def test_read_is_company_scoped_and_sensitive_fields_need_grant(self):
        employee = self.create_employee(identity_number="123456789012", address="1 Đường A")
        Employee.objects.create(company=self.other, branch=self.foreign_branch, employee_code="NV999", full_name="Other")
        self.grant("VIEW")
        response = self.client.get(self.url, {"company_id": str(self.company.pk)})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data), 1)
        self.assertNotIn("identity_number", response.data[0])
        self.assertEqual(self.client.get(f"{self.url}{employee.pk}/").status_code, 404)
        self.grant("VIEW_SENSITIVE")
        response = self.client.get(self.url, {"company_id": str(self.company.pk)})
        self.assertEqual(response.data[0]["identity_number"], "123456789012")

    def test_status_change_requires_version_and_preserves_history(self):
        employee = self.create_employee()
        self.grant("VIEW", "DEACTIVATE")
        endpoint = f"{self.url}{employee.pk}/change_status/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(endpoint, {"status": "INACTIVE"}, format="json").status_code, 400)
        response = self.client.post(endpoint, {"status": "INACTIVE", "version": employee.updated_at.isoformat()}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], "INACTIVE")
        self.assertEqual(self.client.post(endpoint, {"status": "ACTIVE", "version": employee.updated_at.isoformat()}, format="json").status_code, 409)
        self.assertTrue(AuditLog.objects.filter(entity_id=employee.pk, action_code="EMPLOYEE_STATUS").exists())

    def test_link_user_only_with_active_membership(self):
        employee = self.create_employee()
        self.grant("VIEW", "LINK_USER")
        target = get_user_model().objects.create_user(username="employee-target", password="test")
        endpoint = f"{self.url}{employee.pk}/link-user/?company_id={self.company.pk}"
        self.assertEqual(self.client.post(endpoint, {"user_id": str(target.iam_account.pk)}, format="json").status_code, 400)
        membership = CompanyMembership.objects.create(company=self.company, user=target.iam_account, created_by=self.account)
        self.assertEqual(self.client.post(endpoint, {"user_id": str(target.iam_account.pk)}, format="json").status_code, 200)
        membership.refresh_from_db()
        self.assertEqual(membership.employee, employee)
        self.assertEqual(self.client.post(endpoint, {"user_id": str(target.iam_account.pk)}, format="json").status_code, 400)

    def test_bank_account_requires_sensitive_grant_and_one_default(self):
        employee = self.create_employee()
        self.grant("VIEW", "EDIT")
        endpoint = f"{self.url}{employee.pk}/bank-accounts/?company_id={self.company.pk}"
        payload = {"account_holder": "Nguyễn Văn A", "account_number": "12345", "bank_name": "Ngân hàng A", "is_default": True}
        self.assertEqual(self.client.post(endpoint, payload, format="json").status_code, 403)
        self.grant("VIEW_SENSITIVE")
        created = self.client.post(endpoint, payload, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(self.client.post(endpoint, {**payload, "account_number": "56789"}, format="json").status_code, 400)
        other_employee = self.create_employee(code="NV002")
        detail = f"{self.url}{employee.pk}/bank-accounts/{created.data['id']}/?company_id={self.company.pk}"
        self.assertEqual(self.client.patch(detail, {"employee": str(other_employee.pk)}, format="json").status_code, 400)

    def test_import_reports_invalid_rows_and_export_respects_scope(self):
        self.grant("VIEW", "CREATE", "IMPORT", "EXPORT")
        csv_file = SimpleUploadedFile("employees.csv", f"employee_code,full_name,branch_id,contract_type\nNV010,Nguyễn A,{self.branch.pk},RESIDENT_LONG\nNV011,Trần B,{self.foreign_branch.pk},RESIDENT_LONG\n".encode("utf-8"), content_type="text/csv")
        response = self.client.post(f"{self.url}import-csv/", {"company_id": str(self.company.pk), "file": csv_file}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data["created"]), 1)
        self.assertEqual(response.data["errors"][0]["row"], 3)
        exported = self.client.get(f"{self.url}export-csv/", {"company_id": str(self.company.pk)})
        self.assertEqual(exported.status_code, 200)
        self.assertIn(b"NV010", exported.content)
        self.assertNotIn(b"identity_number", exported.content)

    def test_draft_can_be_created_without_branch_but_active_cannot(self):
        self.grant("CREATE")
        base = {"company": str(self.company.pk), "employee_code": "NV_DRAFT", "full_name": "Nhân viên nháp"}
        self.assertEqual(self.client.post(self.url, base, format="json").status_code, 400)
        response = self.client.post(self.url, {**base, "status": "DRAFT"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)

    def test_update_rejects_company_change_and_stale_version(self):
        employee = self.create_employee()
        self.grant("VIEW", "EDIT")
        endpoint = f"{self.url}{employee.pk}/?company_id={self.company.pk}"
        self.assertEqual(self.client.patch(endpoint, {"company": str(self.other.pk), "version": employee.updated_at.isoformat()}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(endpoint, {"full_name": "Tên mới", "version": "2020-01-01T00:00:00Z"}, format="json").status_code, 409)
        self.assertEqual(self.client.patch(endpoint, {"identity_number": "123456789012", "version": employee.updated_at.isoformat()}, format="json").status_code, 403)
        self.assertEqual(Employee.objects.get(pk=employee.pk).full_name, "Nguyễn Văn A")

    def test_uc_md_03_saves_salary_contact_and_bank_atomically(self):
        self.grant("CREATE", "VIEW", "EDIT", "VIEW_SENSITIVE", "EXPORT")
        payload = {
            "company": str(self.company.pk), "branch": str(self.branch.pk),
            "employee_code": "NV_FULL", "full_name": "  Nguyễn Văn A  ",
            "contract_type": "RESIDENT_LONG", "job_title": "Kế toán",
            "agreed_salary": "12000000", "salary_coefficient": None,
            "insurance_salary": "9000000", "dependent_count": None,
            "phone": "0912345678", "identity_number": "123456789012",
            "bank_account": {"account_number": "123456", "bank_name": "Ngân hàng A", "account_holder": "Nguyễn Văn A"},
        }
        invalid = self.client.post(self.url, {**payload, "bank_account": {"account_number": "123456"}}, format="json")
        self.assertEqual(invalid.status_code, 400, invalid.data)
        self.assertFalse(Employee.objects.filter(employee_code="NV_FULL").exists())
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        employee = Employee.objects.get(pk=response.data["id"])
        self.assertEqual(employee.full_name, "Nguyễn Văn A")
        self.assertIsNone(employee.salary_coefficient)
        self.assertIsNone(employee.dependent_count)
        self.assertEqual(employee.bank_accounts.get().account_number, "123456")
        endpoint = f"{self.url}{employee.pk}/?company_id={self.company.pk}"
        updated = self.client.patch(endpoint, {"employee_code": "NV_NEW", "agreed_salary": "13000000", "version": response.data["version"], "bank_account": {"account_number": "654321", "bank_name": "Ngân hàng B", "account_holder": "Nguyễn Văn A"}}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        employee.refresh_from_db()
        self.assertEqual(employee.employee_code, "NV_NEW")
        self.assertEqual(employee.bank_accounts.count(), 1)
        self.assertEqual(employee.bank_accounts.get().account_number, "654321")
        exported = self.client.get(f"{self.url}export-xlsx/", {"company_id": str(self.company.pk)})
        self.assertEqual(exported.status_code, 200)
        self.assertIn("spreadsheetml.sheet", exported["Content-Type"])

    def test_uc_md_03_rejects_invalid_fields_and_requires_contract(self):
        self.grant("CREATE", "VIEW_SENSITIVE")
        base = {"company": str(self.company.pk), "branch": str(self.branch.pk), "employee_code": "NV_BAD", "full_name": "Nguyễn Văn A"}
        self.assertIn("contract_type", self.client.post(self.url, base, format="json").data)
        invalid = {**base, "contract_type": "RESIDENT_SHORT", "phone": "123", "identity_number": "123", "agreed_salary": "-1"}
        response = self.client.post(self.url, invalid, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Employee.objects.filter(employee_code="NV_BAD").exists())
