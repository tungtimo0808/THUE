from rest_framework.permissions import BasePermission
from iam.permissions import company_identifiers_agree, get_user_allowed_branch_ids, has_effective_permission
from organization.models import Company


class AccountsPayablePermission(BasePermission):
    message = "Bạn không có quyền xem công nợ phải trả."

    def has_permission(self, request, view):
        self.message = getattr(view, "permission_denied_message", "Bạn không có quyền xem công nợ phải trả.")
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.is_superuser and not company_identifiers_agree(request):
            return False
        company_id = request.query_params.get("company_id") or request.data.get("company")
        strict = getattr(view, "enforce_strict_permissions", False)
        if request.user.is_superuser and not strict:
            return True
        if not company_id or not hasattr(request.user, "iam_account"):
            return False
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return False

        from iam.models import CompanyMembership
        if not getattr(request.user, "is_superuser", False):
            if not CompanyMembership.objects.filter(company=company, user=request.user.iam_account, membership_status="ACTIVE").exists():
                self.message = "Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên."
                return False

        code = getattr(view, "action_permissions", {}).get(view.action) or getattr(view, "iam_permissions", {}).get(request.method)
        if not code:
            return False
        raw_branch = request.query_params.get("branch_id") or (
            request.data.get("branch") if isinstance(request.data, dict) else None
        )
        branch_id = None if (not raw_branch or str(raw_branch).lower() in ("all", "head-office")) else raw_branch
        codes = list(code) if isinstance(code, (list, tuple, set)) else [code]
        if any(has_effective_permission(request.user.iam_account, company, c, branch_id=branch_id) for c in codes):
            return True
        if not branch_id and request.method in ("GET", "HEAD", "OPTIONS"):
            allowed = get_user_allowed_branch_ids(request, company.id)
            if allowed and any(
                has_effective_permission(request.user.iam_account, company, c, branch_id=bid)
                for c in codes
                for bid in allowed
            ):
                return True
        return False
