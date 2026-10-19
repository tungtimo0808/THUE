from decimal import Decimal

from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from common_services.test_company_setup import FounderCompanyMixin
from general_ledger.models import Account, JournalEntry
from iam.models import Permission, Role, RolePermission
from organization.models import Branch, Employee
from payroll.models import DEFAULT_TAX_BRACKETS
from payroll.services import personal_income_tax


class PersonalIncomeTaxTests(SimpleTestCase):
    def test_progressive_brackets(self):
        self.assertEqual(personal_income_tax(Decimal("6900000"), DEFAULT_TAX_BRACKETS), Decimal("440000"))
        self.assertEqual(personal_income_tax(Decimal("0"), DEFAULT_TAX_BRACKETS), Decimal("0"))
        # 80M → 5%·5 + 10%·5 + 15%·8 + 20%·14 + 25%·20 + 30%·28 = 18.15M; then 35% above 80M.
        self.assertEqual(personal_income_tax(Decimal("100000000"), DEFAULT_TAX_BRACKETS), Decimal("25150000"))


@override_settings(COMMON_REQUIRE_VERIFICATION=False)
class SalarySheetTests(FounderCompanyMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.client.post(self.url, {"company": str(self.company.pk)}, format="json")
        role = Role.objects.get(company=self.company, code="COMPANY_ADMIN")
        have = set(role.role_permissions.values_list("permission_id", flat=True))
        RolePermission.objects.bulk_create([RolePermission(role=role, permission=p) for p in Permission.objects.exclude(id__in=have)])
        self.q = f"?company_id={self.company.pk}"
        branch = Branch.objects.filter(company=self.company).first()
        self.employee = Employee.objects.create(company=self.company, branch=branch, employee_code="NV01", full_name="Nguyễn Văn A", status="ACTIVE")
        expense = Account.objects.filter(company=self.company, code__startswith="642", is_postable=True).order_by("code").first()
        created = self.client.post(f"/api/v1/payroll/profiles/{self.q}", {
            "company": str(self.company.pk), "employee": str(self.employee.pk), "base_salary": "20000000",
            "insurance_salary": "20000000", "dependents": 0, "expense_account": str(expense.pk),
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.period = timezone.localdate().strftime("%Y-%m")

    def test_full_month_salary_is_calculated_and_posted(self):
        sheet = self.client.post(f"/api/v1/payroll/salary-sheets/{self.q}", {"company": str(self.company.pk), "period": self.period}, format="json")
        self.assertEqual(sheet.status_code, 201, sheet.data)
        line = sheet.data["lines"][0]
        self.assertEqual(
            [Decimal(line[key]) for key in ("gross", "employee_insurance", "personal_income_tax", "net", "employer_insurance")],
            [Decimal("20000000"), Decimal("2100000"), Decimal("440000"), Decimal("17460000"), Decimal("4700000")],
        )
        posted = self.client.post(f"/api/v1/payroll/salary-sheets/{sheet.data['id']}/post/{self.q}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        entry = JournalEntry.objects.get(pk=posted.data["journal_entry"])
        self.assertEqual((entry.status, entry.total_debit), ("POSTED", Decimal("27240000")))
        paid = self.client.post(f"/api/v1/payroll/salary-sheets/{sheet.data['id']}/paid/{self.q}", {"reference": "PC0001"}, format="json")
        self.assertEqual(paid.data["status"], "PAID")

    def test_payroll_options_round_trip(self):
        settings_url = f"/api/v1/payroll/settings/{self.q}"
        saved = self.client.put(settings_url, {
            "accounting_rule": "DEPARTMENT", "integration_mode": "LOCAL", "standard_days": "24",
        }, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        loaded = self.client.get(settings_url)
        self.assertEqual(loaded.status_code, 200, loaded.data)
        self.assertEqual(loaded.data["accounting_rule"], "DEPARTMENT")
        self.assertEqual(loaded.data["integration_mode"], "LOCAL")
        self.assertEqual(Decimal(loaded.data["standard_days"]), Decimal("24"))
        invalid = self.client.put(settings_url, {"standard_days": "0"}, format="json")
        self.assertEqual(invalid.status_code, 400)

    def test_department_rule_groups_salary_posting(self):
        self.client.put(f"/api/v1/payroll/settings/{self.q}", {"accounting_rule": "DEPARTMENT"}, format="json")
        second = Employee.objects.create(company=self.company, branch=self.employee.branch, employee_code="NV02", full_name="Nhân viên B", status="ACTIVE")
        expense = Account.objects.filter(company=self.company, code__startswith="642", is_postable=True).order_by("code").first()
        created = self.client.post(f"/api/v1/payroll/profiles/{self.q}", {
            "company": str(self.company.pk), "employee": str(second.pk), "base_salary": "10000000",
            "insurance_salary": "10000000", "expense_account": str(expense.pk),
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        sheet = self.client.post(f"/api/v1/payroll/salary-sheets/{self.q}", {"company": str(self.company.pk), "period": self.period}, format="json")
        self.assertEqual(sheet.status_code, 201, sheet.data)
        posted = self.client.post(f"/api/v1/payroll/salary-sheets/{sheet.data['id']}/post/{self.q}", {}, format="json")
        self.assertEqual(posted.status_code, 200, posted.data)
        entry = JournalEntry.objects.get(pk=posted.data["journal_entry"])
        salary_debits = entry.lines.filter(account=expense, debit__gt=0, description__startswith="Chi phí tiền lương")
        self.assertEqual(salary_debits.count(), 1)
        self.assertEqual(salary_debits.first().debit, Decimal("30000000"))

    def test_attendance_days_prorate_the_salary(self):
        attendance = self.client.post(f"/api/v1/payroll/attendance-sheets/{self.q}", {
            "company": str(self.company.pk), "name": "Chấm công", "period": self.period,
            "lines": [{"employee": str(self.employee.pk), "working_days": "11"}],
        }, format="json")
        self.assertEqual(attendance.status_code, 201, attendance.data)
        sheet = self.client.post(f"/api/v1/payroll/salary-sheets/{self.q}", {
            "company": str(self.company.pk), "period": self.period, "attendance_sheet": attendance.data["id"],
        }, format="json")
        self.assertEqual(Decimal(sheet.data["lines"][0]["gross"]), Decimal("10000000"))
