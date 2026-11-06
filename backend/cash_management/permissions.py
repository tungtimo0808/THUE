from rest_framework.permissions import BasePermission
from iam.permissions import get_user_allowed_branch_ids, has_effective_permission
from organization.models import Company
class CashPermission(BasePermission):
    def has_permission(self,request,view):
        if not request.user or not request.user.is_authenticated:return False
        if request.user.is_superuser:return True
        company_id=request.query_params.get("company_id") or request.data.get("company")
        if not company_id or not hasattr(request.user,"iam_account"):return False
        try:company=Company.objects.get(pk=company_id)
        except (Company.DoesNotExist,ValueError):return False
        code=getattr(view,"action_permissions",{}).get(view.action) or getattr(view,"iam_permissions",{}).get(request.method)
        if not code:return False
        raw_branch=request.query_params.get("branch_id") or (request.data.get("branch") if isinstance(request.data, dict) else None)
        branch_id=None if (not raw_branch or str(raw_branch).lower() in ("all", "head-office")) else raw_branch
        if has_effective_permission(request.user.iam_account,company,code,branch_id=branch_id,warehouse_id=None):
            return True
        if not branch_id and request.method == "GET":
            allowed = get_user_allowed_branch_ids(request, company.id)
            if allowed and any(has_effective_permission(request.user.iam_account, company, code, branch_id=bid) for bid in allowed):
                return True
        return False
