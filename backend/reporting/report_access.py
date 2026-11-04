"""Company isolation and IAM permissions shared by every report group."""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework.exceptions import PermissionDenied, ValidationError

from iam.permissions import CompanyMemberMixin, has_effective_permission
from organization.models import Company

AREA_PERMISSIONS = {
    "tax": "RPT.TAX",
    "purchase": "RPT.COMMERCE",
    "sales": "RPT.COMMERCE",
    "debt": "RPT.DEBT",
    "money": "RPT.MONEY",
    "inventory": "RPT.INVENTORY",
    "asset": "RPT.ASSET",
    "financial": "RPT.FINANCIAL",
}


# Everything else in a group (profit, cost, reconciliation, identity numbers) needs the DETAIL right.
BASE_VIEW_PERMISSIONS = {
    "VIEW", "RPT_TAX_VIEW", "RPT_PURCHASE_VIEW", "RPT_SALES_VIEW", "RPT_DEBT_VIEW", "RPT_AR_VIEW", "RPT_AP_VIEW",
    "RPT_MONEY_VIEW", "RPT_CASH_VIEW", "RPT_BANK_VIEW", "RPT_LOAN_VIEW", "RPT_INVENTORY_VIEW", "RPT_PRODUCTION_VIEW",
    "RPT_ASSET_VIEW", "RPT_FA_VIEW", "RPT_CCDC_VIEW", "RPT_PREPAID_VIEW", "RPT_DEPRECIATION_VIEW", "RPT_ALLOCATION_VIEW",
}


def _level(permission_code):
    code = str(permission_code).upper()
    if "EXPORT" in code:
        return "EXPORT"
    return "VIEW" if code in BASE_VIEW_PERMISSIONS else "DETAIL.VIEW"


def has_report_permission(user, request, area, permission_code):
    """A report permission is granted by the IAM code of its group, in the company being read."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    company = getattr(request, "report_company", None)
    account = getattr(user, "iam_account", None)
    if company is None or account is None:
        return False
    query_params = getattr(request, "query_params", {})
    return has_effective_permission(
        account, company, f"{AREA_PERMISSIONS[area]}.{_level(permission_code)}",
        branch_id=query_params.get("branch_id") or None,
    )


def granted_report_permissions(user, request, area, permission_codes):
    return {code for code in permission_codes if has_report_permission(user, request, area, code)}


def report_company(request, params=None):
    """The company checked by ReportAccessMixin; a request cannot name a different one."""
    company = getattr(request, "report_company", None)
    if company is None:
        raise ValidationError({"company_id": "Phải xác định doanh nghiệp làm việc (company_id)."})
    requested = (params or {}).get("company_id")
    if requested and str(requested) != str(company.id):
        raise PermissionDenied("Người dùng không thuộc doanh nghiệp này.")
    return company


class ReportAccessMixin(CompanyMemberMixin):
    """Resolves and authorises the company before any report action runs."""
    report_area = ""
    report_run_model = None

    def _company_of_run(self, run_id):
        if self.report_run_model is None or run_id is None:
            return None
        try:
            company_id = self.report_run_model.objects.filter(pk=run_id).values_list("company_id", flat=True).first()
        except (ValueError, TypeError, DjangoValidationError):
            raise Http404
        return str(company_id) if company_id else None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        data = request.data if isinstance(request.data, dict) else {}
        company_id = (
            self._company_of_run(kwargs.get("run_id"))
            or request.query_params.get("company_id") or data.get("company_id") or data.get("company")
            or request.headers.get("X-Company-Id")
        )
        if not company_id:
            raise ValidationError({"company_id": "Phải xác định doanh nghiệp làm việc (company_id)."})
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError, TypeError, DjangoValidationError):
            company = Company.objects.filter(code__iexact=str(company_id).strip()).first()
            if not company:
                raise ValidationError({"company_id": "Doanh nghiệp không tồn tại hoặc không hợp lệ."})
        request.report_company = company
        if not has_report_permission(request.user, request, self.report_area, "VIEW"):
            raise PermissionDenied("Bạn không có quyền xem báo cáo này của doanh nghiệp.")
