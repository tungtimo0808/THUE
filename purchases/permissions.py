from rest_framework.permissions import BasePermission

from iam.permissions import has_effective_permission
from organization.models import Company


class PurchasePermission(BasePermission):
    """Resolve IAM permission by DRF action so workflow actions stay separate."""
    message = "Bạn không có quyền thực hiện thao tác này."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            self.message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            return False
        if request.user.is_superuser:
            return True
        company_id = (
            request.query_params.get("company_id")
            or request.data.get("company")
            or (request.data.get("company_id") if isinstance(request.data, dict) else None)
        )
        if not company_id and getattr(view, "kwargs", {}).get("pk"):
            model = getattr(getattr(view, "queryset", None), "model", None)
            if model:
                company_id = model.objects.filter(pk=view.kwargs["pk"]).values_list("company_id", flat=True).first()
        if not company_id or not hasattr(request.user, "iam_account"):
            action_perm = getattr(view, "action_permissions", {}).get(view.action) or getattr(view, "iam_permissions", {}).get(request.method)
            if action_perm == "PUR.ORDER.CREATE":
                self.message = "Bạn không có quyền lập đơn mua hàng."
            elif action_perm == "PUR.ORDER.VIEW":
                self.message = "Bạn không có quyền xem đơn mua hàng."
            elif action_perm == "PUR.REQUEST.CREATE":
                self.message = "Bạn không có quyền lập yêu cầu mua hàng."
            elif action_perm == "PUR.REQUEST.VIEW":
                self.message = "Bạn không có quyền xem yêu cầu mua hàng."
            elif action_perm == "PUR.SERVICE.CREATE":
                self.message = "Bạn không có quyền ghi nhận mua dịch vụ."
            elif action_perm == "PUR.SERVICE.POST":
                self.message = "Bạn không có quyền ghi sổ chứng từ mua dịch vụ."
            elif action_perm == "PUR.RETURN.CREATE":
                self.message = "Bạn không có quyền ghi nhận hàng mua trả lại."
            elif action_perm == "PUR.RETURN.POST":
                self.message = "Bạn không có quyền ghi sổ chứng từ hàng mua trả lại."
            elif action_perm == "PUR.DISCOUNT.CREATE":
                self.message = "Bạn không có quyền ghi nhận giảm giá hàng mua."
            elif action_perm == "PUR.DISCOUNT.POST":
                self.message = "Bạn không có quyền ghi sổ chứng từ giảm giá hàng mua."
            elif action_perm == "PUR.INPUT_INVOICE.RECEIVE":
                self.message = "Bạn không có quyền tiếp nhận hóa đơn đầu vào."
            elif action_perm in ("PUR.RECONCILIATION.MATCH", "PUR.RECONCILIATION.CREATE"):
                self.message = "Bạn không có quyền đối chiếu chứng từ mua hàng."
            elif action_perm == "PUR.RECONCILIATION.VIEW":
                self.message = "Bạn không có quyền xem đối chiếu chứng từ mua hàng."
            elif action_perm == "PUR.RECONCILIATION.APPROVE":
                self.message = "Bạn không có quyền phê duyệt chênh lệch đối chiếu."
            elif action_perm == "PUR.RECONCILIATION.CANCEL":
                self.message = "Bạn không có quyền hủy kết quả đối chiếu."
            elif action_perm in ("PUR.APPROVAL.APPROVE", "PUR.APPROVAL.REJECT", "PUR.APPROVAL.REQUEST_REVISION", "PUR.APPROVAL.VIEW"):
                self.message = "Bạn không có quyền phê duyệt chứng từ mua hàng."
            elif action_perm in ("PUR.TRACKING.VIEW", "PUR.TRACKING.EXPORT", "PUR.ORDER.TRACK"):
                if not company_id:
                    self.message = "Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên."
                else:
                    self.message = "Bạn không có quyền theo dõi thực hiện đơn mua."
            elif action_perm == "PUR.COST.CREATE":
                self.message = "Bạn không có quyền lập chứng từ chi phí mua hàng."
            elif action_perm == "PUR.COST.VIEW":
                self.message = "Bạn không có quyền xem chứng từ chi phí mua hàng."
            elif action_perm == "PUR.COST.POST":
                self.message = "Bạn không có quyền ghi sổ chứng từ chi phí mua hàng."
            elif action_perm == "PUR.COST.APPROVE":
                self.message = "Bạn không có quyền phê duyệt chứng từ chi phí mua hàng."
            elif action_perm == "PUR.COST.CANCEL":
                self.message = "Bạn không có quyền hủy chứng từ chi phí mua hàng."
            elif action_perm and (action_perm.startswith("PUR.CONTRACT") or action_perm.startswith("PUR.SUPPLIER_RISK")):
                self.message = "Bạn không có quyền thực hiện chức năng này."
            else:
                self.message = "Bạn không có quyền thực hiện thao tác này."
            return False
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            action_perm = getattr(view, "action_permissions", {}).get(view.action) or getattr(view, "iam_permissions", {}).get(request.method)
            if action_perm in ("PUR.TRACKING.VIEW", "PUR.TRACKING.EXPORT", "PUR.ORDER.TRACK"):
                self.message = "Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên."
            else:
                self.message = "Doanh nghiệp không hợp lệ."
            return False
        permission_code = getattr(view, "action_permissions", {}).get(view.action)
        if not permission_code:
            permission_code = getattr(view, "iam_permissions", {}).get(request.method)
        if not permission_code:
            self.message = "Bạn không có quyền thực hiện thao tác này."
            return False
        has_perm = has_effective_permission(
            request.user.iam_account,
            company,
            permission_code,
            branch_id=request.query_params.get("branch_id") or request.data.get("branch"),
            department_id=request.query_params.get("department_id") or request.data.get("department"),
            warehouse_id=request.query_params.get("warehouse_id") or request.data.get("warehouse") or request.data.get("receiving_warehouse"),
        )
        if not has_perm and permission_code == "PUR.APPROVAL.VIEW":
            if has_effective_permission(request.user.iam_account, company, "PUR.APPROVAL.APPROVE"):
                has_perm = True
            elif any(
                has_effective_permission(request.user.iam_account, company, perm)
                for perm in [
                    "PUR.REQUEST.APPROVE",
                    "PUR.ORDER.APPROVE",
                    "PUR.GOODS.APPROVE",
                    "PUR.SERVICE.APPROVE",
                    "PUR.RETURN.APPROVE",
                    "PUR.DISCOUNT.APPROVE",
                    "PUR.COST.APPROVE",
                    "PUR.CONTRACT.APPROVE",
                ]
            ):
                has_perm = True
        elif not has_perm and permission_code in ("PUR.APPROVAL.APPROVE", "PUR.APPROVAL.REJECT", "PUR.APPROVAL.REQUEST_REVISION"):
            dt = request.data.get("document_type") if isinstance(request.data, dict) else None
            doc_perm_map = {
                "REQUEST": "PUR.REQUEST.APPROVE",
                "ORDER": "PUR.ORDER.APPROVE",
                "GOODS": "PUR.GOODS.APPROVE",
                "SERVICE": "PUR.SERVICE.APPROVE",
                "RETURN": "PUR.RETURN.APPROVE",
                "DISCOUNT": "PUR.DISCOUNT.APPROVE",
                "COST": "PUR.COST.APPROVE",
                "CONTRACT": "PUR.CONTRACT.APPROVE",
            }
            if dt and dt in doc_perm_map:
                if has_effective_permission(request.user.iam_account, company, doc_perm_map[dt]):
                    has_perm = True
            if not has_perm and has_effective_permission(request.user.iam_account, company, "PUR.APPROVAL.APPROVE"):
                has_perm = True
        elif not has_perm and permission_code in ("PUR.TRACKING.VIEW", "PUR.ORDER.TRACK"):
            if has_effective_permission(request.user.iam_account, company, "PUR.ORDER.VIEW") or has_effective_permission(request.user.iam_account, company, "PUR.TRACKING.VIEW"):
                has_perm = True
        elif not has_perm and permission_code == "PUR.TRACKING.EXPORT":
            if any(
                has_effective_permission(request.user.iam_account, company, perm)
                for perm in ["PUR.TRACKING.EXPORT", "PUR.ORDER.EXPORT", "PUR.TRACKING.VIEW", "PUR.ORDER.VIEW"]
            ):
                has_perm = True
        elif not has_perm and permission_code in ("PUR.SUPPLIER_RISK.VIEW", "PUR.SUPPLIER_RISK.CHECK_TX"):
            if (
                any(
                    has_effective_permission(request.user.iam_account, company, perm)
                    for perm in [
                        "PUR.ORDER.CREATE", "PUR.CONTRACT.CREATE", "PUR.ORDER.VIEW",
                        "PUR.CONTRACT.VIEW", "PUR.GOODS.CREATE", "PUR.SUPPLIER_RISK.VIEW",
                        "PUR.SUPPLIER_RISK.CHECK",
                    ]
                )
                or (
                    hasattr(request.user, "iam_account")
                    and request.user.iam_account.memberships.filter(company=company, membership_status="ACTIVE").exists()
                )
            ):
                has_perm = True

        if not has_perm:
            if permission_code == "PUR.REQUEST.CREATE":
                self.message = "Bạn không có quyền lập yêu cầu mua hàng."
            elif permission_code == "PUR.REQUEST.VIEW":
                self.message = "Bạn không có quyền xem yêu cầu mua hàng."
            elif permission_code == "PUR.ORDER.CREATE":
                self.message = "Bạn không có quyền lập đơn mua hàng."
            elif permission_code == "PUR.ORDER.VIEW":
                self.message = "Bạn không có quyền xem đơn mua hàng."
            elif permission_code == "PUR.SERVICE.CREATE":
                self.message = "Bạn không có quyền ghi nhận mua dịch vụ."
            elif permission_code == "PUR.SERVICE.POST":
                self.message = "Bạn không có quyền ghi sổ chứng từ mua dịch vụ."
            elif permission_code == "PUR.RETURN.CREATE":
                self.message = "Bạn không có quyền ghi nhận hàng mua trả lại."
            elif permission_code == "PUR.RETURN.POST":
                self.message = "Bạn không có quyền ghi sổ chứng từ hàng mua trả lại."
            elif permission_code == "PUR.DISCOUNT.CREATE":
                self.message = "Bạn không có quyền ghi nhận giảm giá hàng mua."
            elif permission_code == "PUR.DISCOUNT.POST":
                self.message = "Bạn không có quyền ghi sổ chứng từ giảm giá hàng mua."
            elif permission_code == "PUR.INPUT_INVOICE.RECEIVE":
                self.message = "Bạn không có quyền tiếp nhận hóa đơn đầu vào."
            elif permission_code in ("PUR.RECONCILIATION.MATCH", "PUR.RECONCILIATION.CREATE"):
                self.message = "Bạn không có quyền đối chiếu chứng từ mua hàng."
            elif permission_code == "PUR.RECONCILIATION.VIEW":
                self.message = "Bạn không có quyền xem đối chiếu chứng từ mua hàng."
            elif permission_code == "PUR.RECONCILIATION.APPROVE":
                self.message = "Bạn không có quyền phê duyệt chênh lệch đối chiếu."
            elif permission_code == "PUR.RECONCILIATION.CANCEL":
                self.message = "Bạn không có quyền hủy kết quả đối chiếu."
            elif permission_code in ("PUR.APPROVAL.APPROVE", "PUR.APPROVAL.REJECT", "PUR.APPROVAL.REQUEST_REVISION", "PUR.APPROVAL.VIEW"):
                self.message = "Bạn không có quyền phê duyệt chứng từ mua hàng."
            elif permission_code in ("PUR.TRACKING.VIEW", "PUR.TRACKING.EXPORT", "PUR.ORDER.TRACK"):
                self.message = "Bạn không có quyền theo dõi thực hiện đơn mua."
            elif permission_code == "PUR.COST.CREATE":
                self.message = "Bạn không có quyền lập chứng từ chi phí mua hàng."
            elif permission_code == "PUR.COST.VIEW":
                self.message = "Bạn không có quyền xem chứng từ chi phí mua hàng."
            elif permission_code == "PUR.COST.POST":
                self.message = "Bạn không có quyền ghi sổ chứng từ chi phí mua hàng."
            elif permission_code == "PUR.COST.APPROVE":
                self.message = "Bạn không có quyền phê duyệt chứng từ chi phí mua hàng."
            elif permission_code == "PUR.COST.CANCEL":
                self.message = "Bạn không có quyền hủy chứng từ chi phí mua hàng."
            elif permission_code and (permission_code.startswith("PUR.CONTRACT") or permission_code.startswith("PUR.SUPPLIER_RISK")):
                self.message = "Bạn không có quyền thực hiện chức năng này."
            else:
                self.message = "Quyền truy cập của bạn đã thay đổi. Vui lòng tải lại trang."
            return False
        return True
