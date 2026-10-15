from rest_framework.permissions import BasePermission

from iam.permissions import has_effective_permission
from organization.models import Company


class InventoryPermission(BasePermission):
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
        if not code:
            return False
        warehouse_ids = [
            value for value in (
                request.query_params.get("warehouse_id"), request.data.get("warehouse"),
                request.data.get("source_warehouse"), request.data.get("destination_warehouse"),
            ) if value
        ]
        if not warehouse_ids:
            return has_effective_permission(request.user.iam_account, company, code)
        return all(has_effective_permission(request.user.iam_account, company, code, warehouse_id=value) for value in set(warehouse_ids))

