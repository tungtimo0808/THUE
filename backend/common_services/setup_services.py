"""Initial company setup: create the accounting foundations, then activate the company."""
import calendar
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from audit_log.services import record_audit
from general_ledger.account_services import init_chart_of_accounts_from_template
from general_ledger.models import Account, AccountingPeriod
from master_data.models import PaymentTerm, TaxRate, UnitOfMeasure, Warehouse
from organization.models import CompanyStatus

from .module_services import check_module_active, enable_module
from .models import CoreCompanySetting, FiscalPeriodStatus, FiscalYear, FiscalYearStatus
from .numbering_services import create_default_numbering_rules_for_company
from .period_services import activate_fiscal_year, create_fiscal_year

# Modules shown in the accounting workspace, ordered so dependencies are enabled first.
WORKSPACE_MODULES = ("GL", "TAX", "RPT", "CASH", "BANK", "AP", "PUR", "AR", "SAL", "INV", "FA", "PAYROLL", "COST")

DEFAULT_VAT_RATES = (
    ("VAT0", "Thuế GTGT 0%", Decimal("0")),
    ("VAT5", "Thuế GTGT 5%", Decimal("5")),
    ("VAT8", "Thuế GTGT 8%", Decimal("8")),
    ("VAT10", "Thuế GTGT 10%", Decimal("10")),
)


def _ensure_fiscal_year(company, actor, today):
    active = FiscalYear.objects.filter(
        company=company, status=FiscalYearStatus.ACTIVE, start_date__lte=today, end_date__gte=today,
    ).first()
    if active:
        return active
    start_month = company.fiscal_year_start_month or 1
    start_year = today.year if today.month >= start_month else today.year - 1
    start = date(start_year, start_month, 1)
    end_year, end_month = (start_year, 12) if start_month == 1 else (start_year + 1, start_month - 1)
    end = date(end_year, end_month, calendar.monthrange(end_year, end_month)[1])
    code = f"FY{start_year}"
    fiscal_year = FiscalYear.objects.filter(company=company, code=code).first() or create_fiscal_year(
        company, {"code": code, "name": f"Năm tài chính {start_year}", "start_date": start, "end_date": end}, actor,
    )
    if fiscal_year.status != FiscalYearStatus.ACTIVE:
        activate_fiscal_year(fiscal_year, actor, open_current_period=True)
    # Vouchers dated earlier in the year must also be postable.
    fiscal_year.periods.filter(start_date__lte=today, status=FiscalPeriodStatus.FUTURE).update(status=FiscalPeriodStatus.OPEN)
    return fiscal_year


def _ensure_gl_periods(company, fiscal_year):
    for period in fiscal_year.periods.order_by("period_number"):
        AccountingPeriod.objects.get_or_create(
            company=company, fiscal_year=fiscal_year.start_date.year, period_number=period.period_number,
            defaults={"code": period.start_date.strftime("%Y-%m"), "start_date": period.start_date,
                      "end_date": period.end_date, "status": "OPEN"},
        )


def _ensure_tax_rates(company, today):
    for code, name, rate in DEFAULT_VAT_RATES:
        if not TaxRate.objects.filter(company=company, code=code).exists():
            TaxRate.objects.create(
                company=company, code=code, name=name, tax_type="VAT", rate_percent=rate,
                effective_from=date(today.year, 1, 1), business_scope="BOTH", application_form="PERCENT",
            )


def _ensure_units(company):
    if not UnitOfMeasure.objects.filter(company=company).exists():
        UnitOfMeasure.objects.create(company=company, code="CAI", name="Cái", symbol="Cái",
                                      measurement_type="COUNT", decimal_places=0, integer_only=True, status="ACTIVE")


def _ensure_defaults(company):
    """A payment term and a warehouse so the first vouchers can be entered right away."""
    if not PaymentTerm.objects.filter(company=company).exists():
        PaymentTerm.objects.create(
            company=company, code="NGAY", name="Thanh toán ngay", due_days=0, scope="BOTH",
            due_base="DOCUMENT", default_purchase=True, default_sale=True,
        )
    if not Warehouse.objects.filter(company=company).exists():
        Warehouse.objects.create(company=company, code="KHO", name="Kho tổng", warehouse_type="PHYSICAL",
                                 warehouse_scope="COMPANY_SHARED", status="ACTIVE")


def _ensure_cash_fund(company):
    """A VND cash fund on 1111 so receipts and payments can be saved without extra setup."""
    from cash_management.models import CashFund
    from master_data.models import Currency
    from organization.models import Branch

    if CashFund.objects.filter(company=company).exists():
        return
    if not Branch.objects.filter(company=company).exists():
        # Vouchers are recorded per branch; a company without one gets its head office.
        Branch.objects.create(company=company, code="TRUSO", name=f"Trụ sở chính - {company.name}"[:255],
                              tax_code=company.tax_code or "", address=company.address or "", is_head_office=True)
    branch = Branch.objects.filter(company=company, status="ACTIVE").order_by("-is_head_office", "code").first()
    currency = Currency.objects.filter(code="VND").first()
    account = (Account.objects.filter(company=company, code="1111", is_postable=True).first()
               or Account.objects.filter(company=company, code__startswith="111", is_postable=True).order_by("code").first())
    if branch and currency and account:
        CashFund.objects.create(company=company, branch=branch, code="TM", name="Quỹ tiền mặt", currency=currency, gl_account=account)


@transaction.atomic
def complete_company_setup(company, actor, request=None):
    """Idempotently create the data every posting flow requires and activate the company."""
    if company.status not in (CompanyStatus.PENDING_SETUP, CompanyStatus.ACTIVE):
        from rest_framework.exceptions import ValidationError
        raise ValidationError({"company": "Doanh nghiệp không ở trạng thái có thể thiết lập."})
    today = timezone.localdate()
    fiscal_year = _ensure_fiscal_year(company, actor, today)
    _ensure_gl_periods(company, fiscal_year)
    if not Account.objects.filter(company=company).exists():
        init_chart_of_accounts_from_template(company, regime=company.accounting_regime, user=actor)
    create_default_numbering_rules_for_company(company, actor)
    _ensure_tax_rates(company, today)
    _ensure_units(company)
    _ensure_defaults(company)
    _ensure_cash_fund(company)
    from .models import ModuleCatalog
    available_catalog = set(ModuleCatalog.objects.values_list("code", flat=True))
    for module_code in WORKSPACE_MODULES:
        if module_code in available_catalog and not check_module_active(company, module_code):
            enable_module(company, module_code, actor, notes="Bật khi hoàn tất thiết lập ban đầu")

    # Ensure COMPANY_ADMIN and standard business accounting roles exist with complete permissions
    from iam.role_services import seed_standard_roles_for_company
    seed_standard_roles_for_company(company, actor)

    setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
    configuration = dict(setting.configuration or {})
    configuration["setup_completed"] = True
    setting.configuration = configuration
    setting.save()
    before = company.status
    if company.status != CompanyStatus.ACTIVE:
        company.status = CompanyStatus.ACTIVE
        company.save(update_fields=("status", "updated_at"))
    record_audit(
        company=company, actor_user=actor, module_code="SYS", action_code="COMPANY_SETUP_COMPLETE",
        entity=company, before={"status": before}, after={"status": company.status, "fiscal_year": fiscal_year.code},
        request=request,
    )
    return {"company": str(company.pk), "status": company.status, "fiscal_year": fiscal_year.code}
