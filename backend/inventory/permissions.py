from rest_framework.permissions import BasePermission

from iam.permissions import company_identifiers_agree, get_user_allowed_branch_ids, has_effective_permission
from master_data.models import Warehouse
from organization.models import Company


class InventoryPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        if not company_identifiers_agree(request):
            return False
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
        if getattr(view, "action", None) in ("summary", "summary_options", "multi_warehouse_summary", "movement_detail", "detail_ledger", "alerts"):
            return any(
                has_effective_permission(request.user.iam_account, company, code,
                                         warehouse_id=warehouse.pk, branch_id=warehouse.branch_id)
                for warehouse in Warehouse.objects.filter(company=company).only("id", "branch_id")
            )
        if view.__class__.__name__ == "ValuationViewSet" and getattr(view, "action", None) in ("options", "create", "list", "retrieve"):
            if warehouse_id := request.data.get("warehouse"):
                warehouse = Warehouse.objects.filter(company=company, pk=warehouse_id).first()
                return bool(warehouse and has_effective_permission(request.user.iam_account, company, code,
                    warehouse_id=warehouse.pk, branch_id=warehouse.branch_id))
            return any(has_effective_permission(request.user.iam_account, company, code,
                       warehouse_id=row.pk, branch_id=row.branch_id)
                       for row in Warehouse.objects.filter(company=company).only("id", "branch_id"))
        warehouse_ids = [
            value for value in (
                request.query_params.get("warehouse_id"),
                request.data.get("warehouse") if isinstance(request.data, dict) else None,
                request.data.get("source_warehouse") if isinstance(request.data, dict) else None,
                request.data.get("destination_warehouse") if isinstance(request.data, dict) else None,
            ) if value
        ]
        raw_branch = request.query_params.get("branch_id") or (
            request.data.get("branch") if isinstance(request.data, dict) else None
        )
        branch_id = None if (not raw_branch or str(raw_branch).lower() in ("all", "head-office")) else raw_branch
        if not warehouse_ids:
            if has_effective_permission(request.user.iam_account, company, code, branch_id=branch_id):
                return True
            if not branch_id and request.method in ("GET", "HEAD", "OPTIONS"):
                allowed = get_user_allowed_branch_ids(request, company.id)
                if allowed and any(
                    has_effective_permission(request.user.iam_account, company, code, branch_id=bid)
                    for bid in allowed
                ):
                    return True
            return False
        wh_rows = {
            str(w.pk): w.branch_id
            for w in Warehouse.objects.filter(company=company, pk__in=set(warehouse_ids)).only("id", "branch_id")
        }
        return all(
            has_effective_permission(
                request.user.iam_account,
                company,
                code,
                warehouse_id=value,
                branch_id=wh_rows.get(str(value)) or branch_id,
            )
            for value in set(warehouse_ids)
        )

