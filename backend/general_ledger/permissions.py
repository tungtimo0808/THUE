from rest_framework.permissions import BasePermission

from iam.permissions import has_effective_permission
from organization.models import Company


class GeneralLedgerPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        company_id = (
            request.query_params.get("company_id")
            or request.data.get("company")
            or request.data.get("company_id")
        )
        if not company_id and getattr(view, "kwargs", {}).get("pk"):
            model = getattr(getattr(view, "queryset", None), "model", None)
            if model and hasattr(model, "company_id"):
                company_id = model.objects.filter(pk=view.kwargs["pk"]).values_list("company_id", flat=True).first()
        if not company_id or not hasattr(request.user, "iam_account"):
            return False
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return False
        code = getattr(view, "action_permissions", {}).get(getattr(view, "action", None))
        code = code or getattr(view, "iam_permissions", {}).get(request.method)
        if not code:
            return False
        return has_effective_permission(
            request.user.iam_account, company, code,
            branch_id=request.query_params.get("branch_id") or request.data.get("branch"),
            department_id=request.query_params.get("department_id") or request.data.get("department"),
            project_id=request.query_params.get("project_id") or request.data.get("project"),
            cost_center_id=request.query_params.get("cost_center_id") or request.data.get("cost_center"),
        )
