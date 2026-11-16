from rest_framework.permissions import BasePermission

from iam.permissions import company_identifiers_agree, get_user_allowed_branch_ids, has_effective_permission
from organization.models import Company


class GeneralLedgerPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        if not company_identifiers_agree(request):
            return False
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
        codes = [code] if isinstance(code, str) else list(code)
        raw_branch = request.query_params.get("branch_id") or (
            request.data.get("branch") if isinstance(request.data, dict) else None
        )
        branch_id = None if (not raw_branch or str(raw_branch).lower() in ("all", "head-office")) else raw_branch
        dept_id = request.query_params.get("department_id") or (
            request.data.get("department") if isinstance(request.data, dict) else None
        )
        proj_id = request.query_params.get("project_id") or (
            request.data.get("project") if isinstance(request.data, dict) else None
        )
        cc_id = request.query_params.get("cost_center_id") or (
            request.data.get("cost_center") if isinstance(request.data, dict) else None
        )
        if any(
            has_effective_permission(
                request.user.iam_account, company, c,
                branch_id=branch_id,
                department_id=dept_id,
                project_id=proj_id,
                cost_center_id=cc_id,
            )
            for c in codes
        ):
            return True
        if not branch_id and request.method in ("GET", "HEAD", "OPTIONS"):
            allowed = get_user_allowed_branch_ids(request, company.id)
            if allowed and any(
                has_effective_permission(
                    request.user.iam_account, company, c,
                    branch_id=bid,
                    department_id=dept_id,
                    project_id=proj_id,
                    cost_center_id=cc_id,
                )
                for c in codes
                for bid in allowed
            ):
                return True
        return False
