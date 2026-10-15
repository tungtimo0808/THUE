from rest_framework.permissions import BasePermission
from iam.permissions import has_effective_permission
from organization.models import Company
class BankPermission(BasePermission):
    def has_permission(self,r,v):
        if not r.user or not r.user.is_authenticated:return False
        if r.user.is_superuser:return True
        cid=r.query_params.get("company_id") or r.data.get("company")
        if not cid and v.kwargs.get("pk"):
            model = getattr(getattr(v, "queryset", None), "model", None)
            if model:
                cid = model.objects.filter(pk=v.kwargs["pk"]).values_list("company_id", flat=True).first()
        if not cid or not hasattr(r.user,"iam_account"):return False
        try:c=Company.objects.get(pk=cid)
        except (Company.DoesNotExist,ValueError):return False
        code=getattr(v,"action_permissions",{}).get(v.action) or getattr(v,"iam_permissions",{}).get(r.method)
        return bool(code and has_effective_permission(r.user.iam_account,c,code,branch_id=r.query_params.get("branch_id") or r.data.get("branch")))
