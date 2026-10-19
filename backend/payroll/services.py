"""Payroll: salary calculation (insurance, progressive personal income tax) and posting to the general ledger."""
import calendar
from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from audit_log.services import record_audit
from general_ledger.models import Account, AccountingPeriod, JournalEntry, JournalLine
from general_ledger.services import post as post_journal
from master_data.models import Party

from . import models

VND = Decimal("1")
PERCENT = Decimal("100")
# Liability accounts for each insurance fund (Thông tư 200/99).
FUND_ACCOUNTS = {"social": "3383", "health": "3384", "unemployment": "3386", "union": "3382"}


def actor(request):
    return request.user.iam_account


def audit(request, obj, action, before=None, after=None):
    record_audit(company=obj.company, actor_user=actor(request), module_code="PAYROLL", action_code=action, entity=obj,
                 before=before or {}, after=after or {}, request=request)


def settings_for(company):
    setting, _ = models.PayrollSetting.objects.get_or_create(company=company)
    return setting


def _round(value):
    return value.quantize(VND, rounding=ROUND_HALF_UP)


def personal_income_tax(taxable, brackets):
    """Progressive monthly tax on taxable income."""
    tax, lower = Decimal("0"), Decimal("0")
    for row in brackets:
        upper = Decimal(str(row["up_to"])) if row.get("up_to") not in (None, "") else None
        rate = Decimal(str(row["rate"])) / PERCENT
        if taxable <= lower:
            break
        portion = (min(taxable, upper) if upper is not None else taxable) - lower
        tax += portion * rate
        if upper is None:
            break
        lower = upper
    return _round(tax)


def calculate(profile, setting, working_days, standard_days):
    rates = setting.insurance_rates
    gross = _round(profile.base_salary * Decimal(working_days) / Decimal(standard_days)) + profile.allowance
    insurance_base = profile.insurance_salary or profile.base_salary
    employee_parts = {fund: _round(insurance_base * Decimal(str(rate)) / PERCENT) for fund, rate in rates["employee"].items()}
    employer_parts = {fund: _round(insurance_base * Decimal(str(rate)) / PERCENT) for fund, rate in rates["employer"].items()}
    employee_insurance = sum(employee_parts.values(), Decimal("0"))
    deductions = setting.personal_deduction + setting.dependent_deduction * profile.dependents
    taxable = max(gross - employee_insurance - deductions, Decimal("0"))
    tax = personal_income_tax(taxable, setting.tax_brackets)
    return {
        "gross": gross, "employee_insurance": employee_insurance, "employer_insurance": sum(employer_parts.values(), Decimal("0")),
        "taxable_income": taxable, "personal_income_tax": tax, "net": gross - employee_insurance - tax,
        "detail": {"employee": {k: str(v) for k, v in employee_parts.items()}, "employer": {k: str(v) for k, v in employer_parts.items()},
                   "deductions": str(deductions)},
    }


@transaction.atomic
def create_salary_sheet(company, data, request):
    period = str(data.get("period") or "")
    try:
        year, month = (int(part) for part in period.split("-"))
        date(year, month, 1)
    except ValueError as exc:
        raise ValidationError({"period": "Kỳ lương phải có dạng yyyy-mm."}) from exc
    setting = settings_for(company)
    standard_days = Decimal(str(data.get("standard_days") or setting.standard_days))
    attendance = None
    if data.get("attendance_sheet"):
        attendance = models.AttendanceSheet.objects.filter(company=company, pk=data["attendance_sheet"]).first()
        if not attendance:
            raise ValidationError({"attendance_sheet": "Bảng chấm công không thuộc doanh nghiệp."})
    profiles = models.PayProfile.objects.filter(company=company, is_active=True).select_related("employee", "expense_account")
    if data.get("departments"):
        profiles = profiles.filter(employee__department_id__in=data["departments"])
    profiles = list(profiles)
    if not profiles:
        raise ValidationError("Chưa có nhân viên nào có hồ sơ lương đang áp dụng.")
    days = {line.employee_id: line.working_days + line.paid_leave_days for line in attendance.lines.all()} if attendance else {}
    sheet = models.SalarySheet.objects.create(
        company=company, name=str(data.get("name") or f"Bảng lương tháng {month:02d}/{year}")[:255], period=period,
        attendance_sheet=attendance, standard_days=standard_days, created_by=actor(request),
    )
    for profile in profiles:
        worked = days.get(profile.employee_id, standard_days) if attendance else standard_days
        values = calculate(profile, setting, worked, standard_days)
        models.SalaryLine.objects.create(sheet=sheet, employee=profile.employee, expense_account=profile.expense_account,
            base_salary=profile.base_salary, allowance=profile.allowance, working_days=worked, **values)
    audit(request, sheet, "CALCULATE", after={"period": period, "lines": len(profiles)})
    return sheet


def _account(company, code):
    """Exact postable account, else the closest postable parent (3341 → 334)."""
    for size in range(len(code), 2, -1):
        account = Account.objects.filter(company=company, code=code[:size], is_postable=True, status="ACTIVE").first()
        if account:
            return account
    raise ValidationError(f"Thiếu tài khoản {code} trong hệ thống tài khoản.")


def _employee_party(employee):
    """Employees are followed on 334/338 as individual parties keyed by their employee code."""
    party, _ = Party.objects.get_or_create(
        company=employee.company, code=f"NV-{employee.employee_code}"[:50],
        defaults={"name": employee.full_name, "legal_name": employee.full_name, "party_type": "INDIVIDUAL"},
    )
    return party


@transaction.atomic
def post_salary_sheet(sheet, request):
    sheet = models.SalarySheet.objects.select_for_update().get(pk=sheet.pk)
    if sheet.status != models.SalarySheet.Status.CALCULATED:
        raise ValidationError("Bảng lương đã được hạch toán.")
    year, month = (int(part) for part in sheet.period.split("-"))
    posting_date = date(year, month, calendar.monthrange(year, month)[1])
    period = AccountingPeriod.objects.filter(company=sheet.company, start_date__lte=posting_date, end_date__gte=posting_date, status="OPEN").first()
    if not period:
        raise ValidationError("Kỳ kế toán của tháng lương chưa mở hoặc đã khóa.")
    setting = settings_for(sheet.company)
    payable = _account(sheet.company, setting.payable_account_code or "334")
    rows = defaultdict(Decimal)  # (debit, credit, text, party, label) -> amount
    for line in sheet.lines.select_related("expense_account", "employee__company", "employee__department"):
        employee_party = _employee_party(line.employee)

        def key(debit, credit, text):
            detailed = setting.accounting_rule == "DETAIL" or debit.requires_party or credit.requires_party
            party = employee_party if detailed else None
            label = employee_party.name if detailed else (line.employee.department.name if line.employee.department_id else "Chưa phân bộ phận")
            return debit, credit, text, party, label

        rows[key(line.expense_account, payable, "Chi phí tiền lương")] += line.gross
        for fund, amount in line.detail.get("employer", {}).items():
            credit = _account(sheet.company, FUND_ACCOUNTS[fund])
            rows[key(line.expense_account, credit, f"Bảo hiểm doanh nghiệp đóng ({fund})")] += Decimal(amount)
        for fund, amount in line.detail.get("employee", {}).items():
            credit = _account(sheet.company, FUND_ACCOUNTS[fund])
            rows[key(payable, credit, f"Khấu trừ bảo hiểm người lao động ({fund})")] += Decimal(amount)
        rows[key(payable, _account(sheet.company, "3335"), "Khấu trừ thuế TNCN")] += line.personal_income_tax
    rows = {key: value for key, value in rows.items() if value}
    total = sum(rows.values(), Decimal("0"))
    entry = JournalEntry.objects.create(
        company=sheet.company, period=period, number=f"PL-{sheet.period}-{str(sheet.pk)[:6]}", entry_type="MANUAL",
        posting_date=posting_date, document_date=posting_date, description=f"Hạch toán {sheet.name}"[:500], source_module="GL",
        source_event_id=f"PAYROLL:{sheet.pk}", status="APPROVED", total_debit=total, total_credit=total,
        created_by=actor(request), approved_by=actor(request), approved_at=timezone.now(), workflow_snapshot={"allow_creator_posting": True},
    )
    for index, ((debit, credit, text, party, label), amount) in enumerate(rows.items()):
        for offset, account, side in ((1, debit, "debit"), (2, credit, "credit")):
            JournalLine.objects.create(entry=entry, line_no=index * 2 + offset, account=account, currency=sheet.company.accounting_currency,
                description=f"{text} - {label}"[:500], party=party if account.requires_party else None, **{side: amount})
    post_journal(entry, request)
    sheet.journal_entry = entry
    sheet.status = models.SalarySheet.Status.POSTED
    sheet.save(update_fields=("journal_entry", "status"))
    audit(request, sheet, "POST", after={"entry": entry.number, "total": str(total)})
    return sheet


@transaction.atomic
def mark_paid(sheet, request, insurance=False):
    """Link the cash/bank payment voucher that paid the salaries (or the insurance funds)."""
    sheet = models.SalarySheet.objects.select_for_update().get(pk=sheet.pk)
    reference = str(request.data.get("reference") or "").strip()
    if not reference:
        raise ValidationError({"reference": "Thiếu số chứng từ chi."})
    if sheet.status == models.SalarySheet.Status.CALCULATED:
        raise ValidationError("Phải hạch toán bảng lương trước khi chi trả.")
    if insurance:
        sheet.insurance_payment_reference = reference
        sheet.save(update_fields=("insurance_payment_reference",))
    else:
        sheet.payment_reference = reference
        sheet.status = models.SalarySheet.Status.PAID
        sheet.save(update_fields=("payment_reference", "status"))
    audit(request, sheet, "PAY_INSURANCE" if insurance else "PAY", after={"reference": reference})
    return sheet
