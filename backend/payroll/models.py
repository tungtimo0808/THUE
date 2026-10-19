import uuid

from django.db import models
from django.db.models import Q

# Defaults follow the values the payroll screens show; every company can change them in its payroll settings.
DEFAULT_RATES = {
    "employee": {"social": "8", "health": "1.5", "unemployment": "1"},
    "employer": {"social": "17.5", "health": "3", "unemployment": "1", "union": "2"},
}
DEFAULT_TAX_BRACKETS = [
    {"up_to": "5000000", "rate": "5"}, {"up_to": "10000000", "rate": "10"}, {"up_to": "18000000", "rate": "15"},
    {"up_to": "32000000", "rate": "20"}, {"up_to": "52000000", "rate": "25"}, {"up_to": "80000000", "rate": "30"},
    {"up_to": None, "rate": "35"},
]


def default_rates():
    return {side: dict(values) for side, values in DEFAULT_RATES.items()}


def default_brackets():
    return [dict(row) for row in DEFAULT_TAX_BRACKETS]


class PayrollSetting(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.OneToOneField("organization.Company", on_delete=models.CASCADE, related_name="payroll_setting")
    standard_days = models.DecimalField(max_digits=5, decimal_places=2, default=22)
    personal_deduction = models.DecimalField(max_digits=20, decimal_places=4, default=11000000)
    dependent_deduction = models.DecimalField(max_digits=20, decimal_places=4, default=4400000)
    insurance_rates = models.JSONField(default=default_rates)
    tax_brackets = models.JSONField(default=default_brackets)
    payable_account_code = models.CharField(max_length=20, default="334")
    accounting_rule = models.CharField(max_length=20, choices=(("DETAIL", "Theo nhân viên"), ("DEPARTMENT", "Theo bộ phận")), default="DETAIL")
    integration_mode = models.CharField(max_length=20, choices=(("LOCAL", "Tính trên hệ thống"), ("CLOUD", "Kết nối ứng dụng nhân sự")), default="LOCAL")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payroll_setting"


class PayProfile(models.Model):
    """Salary data of one employee."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="pay_profiles")
    employee = models.OneToOneField("organization.Employee", on_delete=models.PROTECT, related_name="pay_profile")
    base_salary = models.DecimalField(max_digits=20, decimal_places=4)
    allowance = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    insurance_salary = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    dependents = models.PositiveSmallIntegerField(default=0)
    expense_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="pay_profiles")
    bank_account = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payroll_pay_profile"
        constraints = [models.CheckConstraint(condition=Q(base_salary__gte=0, allowance__gte=0, insurance_salary__gte=0), name="ck_payroll_profile_amounts")]


class AttendanceSheet(models.Model):
    """Bảng chấm công (DETAIL) or Bảng tổng hợp chấm công (SUMMARY) of a month."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="attendance_sheets")
    kind = models.CharField(max_length=10, choices=(("DETAIL", "Chấm công"), ("SUMMARY", "Tổng hợp chấm công")), default="DETAIL")
    method = models.CharField(max_length=10, choices=(("SESSION", "Theo buổi"), ("HOUR", "Theo giờ")), default="SESSION")
    name = models.CharField(max_length=255)
    period = models.CharField(max_length=7)  # yyyy-mm
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="attendance_sheets")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "payroll_attendance_sheet"
        ordering = ("-period", "-created_at")


class AttendanceLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sheet = models.ForeignKey(AttendanceSheet, on_delete=models.CASCADE, related_name="lines")
    employee = models.ForeignKey("organization.Employee", on_delete=models.PROTECT)
    working_days = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    paid_leave_days = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    overtime_hours = models.DecimalField(max_digits=7, decimal_places=2, default=0)

    class Meta:
        db_table = "payroll_attendance_line"
        constraints = [models.UniqueConstraint(fields=("sheet", "employee"), name="uq_payroll_attendance_employee")]


class SalarySheet(models.Model):
    class Status(models.TextChoices):
        CALCULATED = "CALCULATED", "Đã tính lương"
        POSTED = "POSTED", "Đã hạch toán"
        PAID = "PAID", "Đã trả lương"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="salary_sheets")
    name = models.CharField(max_length=255)
    period = models.CharField(max_length=7)
    attendance_sheet = models.ForeignKey(AttendanceSheet, on_delete=models.PROTECT, null=True, blank=True, related_name="salary_sheets")
    standard_days = models.DecimalField(max_digits=5, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CALCULATED)
    journal_entry = models.ForeignKey("general_ledger.JournalEntry", on_delete=models.PROTECT, null=True, blank=True, related_name="salary_sheets")
    payment_reference = models.CharField(max_length=100, blank=True)
    insurance_payment_reference = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="salary_sheets")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "payroll_salary_sheet"
        ordering = ("-period", "-created_at")


class SalaryLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sheet = models.ForeignKey(SalarySheet, on_delete=models.CASCADE, related_name="lines")
    employee = models.ForeignKey("organization.Employee", on_delete=models.PROTECT)
    expense_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT)
    base_salary = models.DecimalField(max_digits=20, decimal_places=4)
    allowance = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    working_days = models.DecimalField(max_digits=6, decimal_places=2)
    gross = models.DecimalField(max_digits=20, decimal_places=4)
    employee_insurance = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    employer_insurance = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    taxable_income = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    personal_income_tax = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    net = models.DecimalField(max_digits=20, decimal_places=4)
    detail = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "payroll_salary_line"
