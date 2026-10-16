from rest_framework.permissions import BasePermission
from iam.permissions import has_effective_permission, effective_assignments, assignment_permission_codes
from organization.models import Company
from uuid import UUID


class AccountsReceivablePermission(BasePermission):
    def has_permission(self,request,view):
        if not request.user or not request.user.is_authenticated:return False
        if request.user.is_superuser:return True
        company_id=request.query_params.get("company_id") or request.data.get("company_id") or request.data.get("company")
        if not company_id and getattr(view, "kwargs", {}).get("pk"):
            try:
                lookup_field = getattr(view, "lookup_field", "pk")
                obj_id = view.kwargs.get(lookup_field)
                model = getattr(view, "queryset", None)
                if model is not None:
                    obj = model.model.objects.filter(pk=obj_id).only("company_id").first()
                    if obj:
                        company_id = obj.company_id
            except Exception:
                pass
        if not company_id or not hasattr(request.user,"iam_account"):return False
        try:company=Company.objects.get(pk=company_id)
        except (Company.DoesNotExist,ValueError):return False
        code=getattr(view,"action_permissions",{}).get(view.action) or getattr(view,"iam_permissions",{}).get(request.method)
        if not code:return False
        if view.__class__.__name__ in {"CustomerReceiptVoucherViewSet","ReceiptAllocationVoucherViewSet","DebtNettingVoucherViewSet","DebtAdjustmentVoucherViewSet","CustomerDebtReconciliationViewSet","DueTrackingViewSet","CustomerPaymentReminderViewSet"} and request.method == "GET" and not request.query_params.get("branch_id"):
            return any(code in assignment_permission_codes(assignment) for assignment in effective_assignments(request.user.iam_account,company))
        if view.__class__.__name__ in {"CustomerReceiptVoucherViewSet","ReceiptAllocationVoucherViewSet","DebtNettingVoucherViewSet","DebtAdjustmentVoucherViewSet","CustomerDebtReconciliationViewSet","CustomerPaymentReminderViewSet"} and view.kwargs.get("pk") and not request.query_params.get("branch_id"):
            from .models import CustomerReceiptVoucher,ReceiptAllocationVoucher,DebtNettingVoucher,DebtAdjustmentVoucher,CustomerDebtReconciliation,CustomerPaymentReminder
            model_map = {
                "CustomerReceiptVoucherViewSet": CustomerReceiptVoucher,
                "ReceiptAllocationVoucherViewSet": ReceiptAllocationVoucher,
                "DebtNettingVoucherViewSet": DebtNettingVoucher,
                "DebtAdjustmentVoucherViewSet": DebtAdjustmentVoucher,
                "CustomerDebtReconciliationViewSet": CustomerDebtReconciliation,
                "CustomerPaymentReminderViewSet": CustomerPaymentReminder,
            }
            target_model = model_map.get(view.__class__.__name__)
            obj = target_model.objects.filter(pk=view.kwargs["pk"],company=company).only("branch_id").first() if target_model else None
            return bool(obj and has_effective_permission(request.user.iam_account,company,code,branch_id=obj.branch_id))
        if view.action in {"customer_debts", "customer_debt_detail", "customer_debts_export", "customer_debts_print"}:
            branch_values = request.query_params.getlist("branch_id")
            branch_ids = [part for value in branch_values for part in value.split(",") if part]
            if branch_ids:
                try:
                    for branch_id in branch_ids:
                        UUID(branch_id)
                except ValueError:
                    return False
                return all(has_effective_permission(request.user.iam_account,company,code,branch_id=branch_id) for branch_id in branch_ids)
            return any(code in assignment_permission_codes(assignment) for assignment in effective_assignments(request.user.iam_account,company))
        branch_param = request.query_params.get("branch_id") or request.data.get("branch")
        has_perm = has_effective_permission(request.user.iam_account,company,code,branch_id=branch_param)
        if not has_perm and code.startswith("AR.NETTING_VOUCHER."):
            fallback = code.replace("AR.NETTING_VOUCHER.", "AR.NETTING.")
            if fallback == "AR.NETTING.UNPOST":
                fallback = "AR.NETTING.REVERSE"
            elif fallback in {"AR.NETTING.SUBMIT", "AR.NETTING.APPROVE", "AR.NETTING.CANCEL"}:
                fallback = "AR.NETTING.EDIT"
            has_perm = has_effective_permission(request.user.iam_account,company,fallback,branch_id=branch_param)
        if not has_perm and code.startswith("AR.ADJUSTMENT_VOUCHER."):
            fallback = code.replace("AR.ADJUSTMENT_VOUCHER.", "AR.ADJUSTMENT.")
            if fallback == "AR.ADJUSTMENT.UNPOST":
                fallback = "AR.ADJUSTMENT.REVERSE"
            elif fallback in {"AR.ADJUSTMENT.SUBMIT", "AR.ADJUSTMENT.APPROVE", "AR.ADJUSTMENT.CANCEL"}:
                fallback = "AR.ADJUSTMENT.EDIT"
            has_perm = has_effective_permission(request.user.iam_account,company,fallback,branch_id=branch_param)
        if not has_perm and code.startswith("AR.RECONCILIATION."):
            fallback = "AR.RECEIVABLE.VIEW" if code.endswith("VIEW") else "AR.RECEIVABLE.EDIT"
            has_perm = has_effective_permission(request.user.iam_account,company,fallback,branch_id=branch_param)
        if not has_perm and code.startswith("AR.DUE_TRACKING."):
            fallback = "AR.RECEIVABLE.EXPORT" if code.endswith("EXPORT") else "AR.RECEIVABLE.VIEW"
            has_perm = has_effective_permission(request.user.iam_account,company,fallback,branch_id=branch_param)
        if not has_perm and code.startswith("AR.PAYMENT_REMINDER."):
            fallback = "AR.RECEIVABLE.EXPORT" if code.endswith("EXPORT") else ("AR.RECEIVABLE.VIEW" if code.endswith("VIEW") else "AR.RECEIVABLE.EDIT")
            has_perm = has_effective_permission(request.user.iam_account,company,fallback,branch_id=branch_param)
        return has_perm


class CustomerDebtReconciliationPermission(AccountsReceivablePermission):
    pass


class DebtAdjustmentVoucherPermission(AccountsReceivablePermission):
    pass


class DueTrackingPermission(AccountsReceivablePermission):
    pass


class PaymentReminderPermission(AccountsReceivablePermission):
    pass


