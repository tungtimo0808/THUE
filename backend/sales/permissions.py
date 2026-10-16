from rest_framework.permissions import BasePermission

from iam.permissions import has_effective_permission
from organization.models import Company

DOC_APPROVAL_PERMS = {
    "QUOTATION": "SAL.QUOTATION.APPROVE",
    "ORDER": "SAL.ORDER.APPROVE",
    "CONTRACT": "SAL.CONTRACT.APPROVE",
    "GOODS_SALE": "SAL.GOODS_SALE.APPROVE",
    "SERVICE_SALE": "SAL.SERVICE_SALE.APPROVE",
    "SALES_RETURN": "SAL.SALES_RETURN.APPROVE",
    "SALES_ALLOWANCE": "SAL.SALES_ALLOWANCE.APPROVE",
    "SALES_INVOICE": "SAL.SALES_INVOICE.APPROVE",
    "COGS": "SAL.COGS.APPROVE",
    "DISCOUNT_INVOICE": "SAL.DISCOUNT_INVOICE.APPROVE",
    "COMMERCIAL_INVOICE": "SAL.COMMERCIAL_INVOICE.APPROVE",
}

ALL_DOC_APPROVE_PERMS = list(DOC_APPROVAL_PERMS.values())


class SalesPermission(BasePermission):
    message = "Bạn không có quyền truy cập chức năng bán hàng."

    def has_permission(self, request, view):
        self.message = getattr(view, "permission_denied_message", self.message)
        if not request.user or not request.user.is_authenticated:
            self.message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            return False
        if request.user.is_superuser:
            return True

        company_id = (
            request.headers.get("X-Company-ID")
            or request.META.get("HTTP_X_COMPANY_ID")
            or request.query_params.get("company_id")
            or (request.data.get("company") if isinstance(request.data, dict) else None)
            or (request.data.get("company_id") if isinstance(request.data, dict) else None)
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

        code = getattr(view, "action_permissions", {}).get(view.action) or getattr(view, "iam_permissions", {}).get(request.method)
        if not code:
            return False

        branch_id = request.query_params.get("branch_id") or (request.data.get("branch") if isinstance(request.data, dict) else None)
        warehouse_id = (
            request.query_params.get("warehouse_id")
            or (request.data.get("warehouse") if isinstance(request.data, dict) else None)
            or (request.data.get("default_warehouse") if isinstance(request.data, dict) else None)
        )

        has_perm = has_effective_permission(
            request.user.iam_account,
            company,
            code,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
        )

        # Fallback for approval permissions
        if not has_perm and code == "SAL.APPROVAL.VIEW":
            if has_effective_permission(request.user.iam_account, company, "SAL.APPROVAL.APPROVE"):
                has_perm = True
            elif any(
                has_effective_permission(request.user.iam_account, company, perm, branch_id=branch_id)
                for perm in ALL_DOC_APPROVE_PERMS
            ):
                has_perm = True

        elif not has_perm and code in ("SAL.APPROVAL.APPROVE", "SAL.APPROVAL.REJECT", "SAL.APPROVAL.REQUEST_REVISION"):
            doc_type = (request.data.get("document_type") if isinstance(request.data, dict) else None) or request.query_params.get("document_type")
            if doc_type and doc_type in DOC_APPROVAL_PERMS:
                if has_effective_permission(request.user.iam_account, company, DOC_APPROVAL_PERMS[doc_type], branch_id=branch_id):
                    has_perm = True
            if not has_perm and has_effective_permission(request.user.iam_account, company, "SAL.APPROVAL.APPROVE", branch_id=branch_id):
                has_perm = True

        elif not has_perm and code in ("SAL.TRACKING.VIEW", "SAL.ORDER.TRACK"):
            if (
                has_effective_permission(request.user.iam_account, company, "SAL.ORDER.VIEW", branch_id=branch_id)
                or has_effective_permission(request.user.iam_account, company, "SAL.TRACKING.VIEW", branch_id=branch_id)
                or has_effective_permission(request.user.iam_account, company, "SAL.ORDER.TRACK", branch_id=branch_id)
            ):
                has_perm = True

        elif not has_perm and code == "SAL.TRACKING.EXPORT":
            if any(
                has_effective_permission(request.user.iam_account, company, perm, branch_id=branch_id)
                for perm in ["SAL.TRACKING.EXPORT", "SAL.ORDER.EXPORT", "SAL.TRACKING.VIEW", "SAL.ORDER.VIEW", "SAL.ORDER.TRACK"]
            ):
                has_perm = True

        elif not has_perm and code == "SAL.LINK.VIEW":
            if (
                has_effective_permission(request.user.iam_account, company, "SAL.LINK.CREATE", branch_id=branch_id)
                or has_effective_permission(request.user.iam_account, company, "SAL.LINK.UNLINK", branch_id=branch_id)
                or has_effective_permission(request.user.iam_account, company, "SAL.ORDER.VIEW", branch_id=branch_id)
                or has_effective_permission(request.user.iam_account, company, "SAL.GOODS_SALE.VIEW", branch_id=branch_id)
            ):
                has_perm = True

        elif not has_perm and code.startswith("SAL.CONTRACT."):
            action = code.split(".")[-1]
            if action in ("SIGN", "ANNEX", "LIQUIDATE", "CANCEL"):
                if (
                    has_effective_permission(request.user.iam_account, company, f"SAL.CONTRACT.{action}", branch_id=branch_id)
                    or has_effective_permission(request.user.iam_account, company, "SAL.CONTRACT.EDIT", branch_id=branch_id)
                    or has_effective_permission(request.user.iam_account, company, "SAL.CONTRACT.TERMINATE", branch_id=branch_id)
                ):
                    has_perm = True
            elif action == "VIEW":
                if any(
                    has_effective_permission(request.user.iam_account, company, f"SAL.CONTRACT.{act}", branch_id=branch_id)
                    for act in ("VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "TERMINATE")
                ):
                    has_perm = True

        elif not has_perm and code.startswith("SAL.DISCOUNT_INVOICE."):
            action = code.split(".")[-1]
            if action in ("ISSUE", "RETRY"):
                if (
                    has_effective_permission(request.user.iam_account, company, f"SAL.DISCOUNT_INVOICE.{action}", branch_id=branch_id)
                    or has_effective_permission(request.user.iam_account, company, "SAL.DISCOUNT_INVOICE.CREATE", branch_id=branch_id)
                    or has_effective_permission(request.user.iam_account, company, "SAL.SALES_INVOICE.ISSUE", branch_id=branch_id)
                ):
                    has_perm = True
            elif action == "VIEW":
                if any(
                    has_effective_permission(request.user.iam_account, company, f"SAL.DISCOUNT_INVOICE.{act}", branch_id=branch_id)
                    for act in ("VIEW", "CREATE", "EDIT", "APPROVE", "ISSUE")
                ):
                    has_perm = True

        elif not has_perm and code.startswith("SAL.COMMERCIAL_INVOICE."):
            action = code.split(".")[-1]
            if action in ("PUBLISH", "ISSUE", "RETRY"):
                if (
                    has_effective_permission(request.user.iam_account, company, f"SAL.COMMERCIAL_INVOICE.{action}", branch_id=branch_id)
                    or has_effective_permission(request.user.iam_account, company, "SAL.COMMERCIAL_INVOICE.CREATE", branch_id=branch_id)
                    or has_effective_permission(request.user.iam_account, company, "SAL.SALES_INVOICE.ISSUE", branch_id=branch_id)
                ):
                    has_perm = True
            elif action == "VIEW":
                if any(
                    has_effective_permission(request.user.iam_account, company, f"SAL.COMMERCIAL_INVOICE.{act}", branch_id=branch_id)
                    for act in ("VIEW", "CREATE", "EDIT", "APPROVE", "PUBLISH", "ISSUE")
                ):
                    has_perm = True

        if not has_perm:
            if code.startswith("SAL.APPROVAL"):
                self.message = "Bạn không có quyền phê duyệt chứng từ bán hàng."
            elif code.startswith("SAL.TRACKING") or code == "SAL.ORDER.TRACK":
                self.message = "Bạn không có quyền theo dõi thực hiện đơn bán."
            elif code.startswith("SAL.COGS"):
                self.message = "Bạn không có quyền thao tác trên chứng từ giá vốn hàng bán."
            elif code.startswith("SAL.LINK"):
                self.message = "Bạn không có quyền liên kết chứng từ bán hàng."
            elif code.startswith("SAL.CONTRACT"):
                self.message = "Bạn không có quyền quản lý hợp đồng bán hàng."
            elif code.startswith("SAL.DISCOUNT_INVOICE"):
                self.message = "Bạn không có quyền lập hóa đơn chiết khấu."
            elif code.startswith("SAL.COMMERCIAL_INVOICE"):
                self.message = "Bạn không có quyền thao tác trên hóa đơn thương mại."
            return False

        return True

