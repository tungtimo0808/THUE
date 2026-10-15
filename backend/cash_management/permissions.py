from rest_framework.permissions import BasePermission
from iam.permissions import has_effective_permission
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
        return has_effective_permission(request.user.iam_account,company,code,branch_id=request.query_params.get("branch_id") or request.data.get("branch"),warehouse_id=None)
