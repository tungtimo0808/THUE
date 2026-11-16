from rest_framework.permissions import BasePermission

from iam.permissions import get_user_allowed_branch_ids, has_effective_permission
from organization.models import Company


class TaxPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        data_company = (request.data.get("company") or request.data.get("company_id")) if isinstance(request.data, dict) else None
        company_id = (
            request.query_params.get("company_id")
            or request.query_params.get("company")
            or request.headers.get("X-Company-ID")
            or request.META.get("HTTP_X_COMPANY_ID")
            or data_company
        )
        if not company_id and getattr(view, "kwargs", {}).get("pk"):
            model = getattr(getattr(view, "queryset", None), "model", None)
            if model:
                company_id = model.objects.filter(pk=view.kwargs["pk"]).values_list("company_id", flat=True).first()
        if not company_id and hasattr(request.user, "iam_account"):
            company_id = (
                request.user.iam_account.memberships.filter(membership_status="ACTIVE")
                .order_by("-is_default", "-joined_at")
                .values_list("company_id", flat=True)
                .first()
            )
        if not company_id or not hasattr(request.user, "iam_account"):
            return False
        request._resolved_company_id = str(company_id)
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return False
        code = getattr(view, "action_permissions", {}).get(getattr(view, "action", None))
        code = code or getattr(view, "iam_permissions", {}).get(request.method)
        if getattr(view, "action", None) == "create" and getattr(view, "basename", "") == "tax-invoice":
            if request.data.get("invoice_type") == "ADJUSTMENT":
                code = "TAX.INVOICE.ADJUST"
            elif request.data.get("invoice_type") == "REPLACEMENT":
                code = "TAX.INVOICE.REPLACE"
        if not code:
            return False
        raw_branch = request.query_params.get("branch_id") or (
            request.data.get("branch") if isinstance(request.data, dict) else None
        )
        branch_id = None if (not raw_branch or str(raw_branch).lower() in ("all", "head-office")) else raw_branch
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
