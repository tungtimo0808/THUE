from rest_framework.permissions import BasePermission

from iam.permissions import has_effective_permission
from organization.models import Company


class FixedAssetPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        company_id = request.query_params.get("company_id") or request.data.get("company")
        if not company_id and getattr(view, "kwargs", {}).get("pk"):
            model = getattr(getattr(view, "queryset", None), "model", None)
            if model:
                company_id = model.objects.filter(pk=view.kwargs["pk"]).values_list("company_id", flat=True).first()
        if not company_id or not hasattr(request.user, "iam_account"):
            return False
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return False
        code = getattr(view, "action_permissions", {}).get(getattr(view, "action", None))
        code = code or getattr(view, "iam_permissions", {}).get(request.method)
        if getattr(view, "action", None) == "create" and getattr(view, "basename", "") == "fixed-asset-transaction":
            if request.data.get("transaction_type") == "TRANSFER":
                code = "FA.TRANSACTION.TRANSFER"
            elif request.data.get("transaction_type") == "DISPOSAL":
                code = "FA.TRANSACTION.DISPOSE"
        if not code:
            return False
        branches = [value for value in (request.query_params.get("branch_id"), request.data.get("branch"), request.data.get("target_branch")) if value]
        if not branches:
            return has_effective_permission(request.user.iam_account, company, code)
        return all(has_effective_permission(request.user.iam_account, company, code, branch_id=value) for value in set(branches))
