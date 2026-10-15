from rest_framework.permissions import BasePermission

from iam.permissions import has_effective_permission
from organization.models import Company


class CommonCompanyPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        company_id = (
            request.query_params.get("company_id")
            or request.query_params.get("company")
            or (request.data.get("company") if isinstance(request.data, dict) else None)
            or (request.data.get("company_id") if isinstance(request.data, dict) else None)
        )
        if not company_id and hasattr(view, "kwargs") and "pk" in view.kwargs:
            from common_services.models import AccountingPolicy, DocumentNumberingRule, FiscalPeriod, FiscalYear
            pk = view.kwargs["pk"]
            company_id = (
                AccountingPolicy.objects.filter(pk=pk).values_list("company_id", flat=True).first()
                or DocumentNumberingRule.objects.filter(pk=pk).values_list("company_id", flat=True).first()
                or FiscalYear.objects.filter(pk=pk).values_list("company_id", flat=True).first()
                or FiscalPeriod.objects.filter(pk=pk).values_list("company_id", flat=True).first()
            )
        if not company_id and hasattr(request.user, "iam_account"):
            company_id = request.user.iam_account.memberships.filter(membership_status="ACTIVE").values_list("company_id", flat=True).first()

        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError, TypeError):
            return False
        code = getattr(view, "action_permissions", {}).get(getattr(view, "action", None))
        if getattr(view, "action", None) == "decide" and request.data.get("decision") == "REJECTED":
            code = "COM.JOIN_REQUEST.REJECT"
        code = code or getattr(view, "iam_permissions", {}).get(request.method)
        return bool(code and hasattr(request.user, "iam_account") and has_effective_permission(request.user.iam_account, company, code))

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True
        company_id = getattr(obj, "company_id", None)
        if not company_id:
            return True
        if hasattr(request.user, "iam_account"):
            return request.user.iam_account.memberships.filter(company_id=company_id, membership_status="ACTIVE").exists()
        return False
