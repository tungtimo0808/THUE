from rest_framework.permissions import BasePermission

from iam.permissions import assignment_permission_codes, effective_assignments, has_effective_permission
from organization.models import Company

from .models import ReportDefinition


class ReportingPermission(BasePermission):
    @staticmethod
    def has_any_grant(user_account, company, code):
        return any(code in assignment_permission_codes(item) for item in effective_assignments(user_account, company))

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        company_id = request.query_params.get("company_id") or request.data.get("company")
        if not company_id or not hasattr(request.user, "iam_account"):
            return False
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return False
        action = getattr(view, "action", None)
        code = getattr(view, "action_permissions", {}).get(action)
        code = code or getattr(view, "iam_permissions", {}).get(request.method)
        if action == "execute":
            definition = ReportDefinition.objects.filter(code=request.data.get("report_code"), is_active=True).first()
            code = definition.permission_code if definition else None
        elif action in {"drill_down", "export"}:
            from .models import ReportRun
            run = ReportRun.objects.select_related("report").filter(pk=view.kwargs.get("pk"), company=company).first()
            if not run:
                return False
            code = run.report.permission_code
            if action == "export":
                export_action = "PRINT" if request.data.get("format") == "PRINT" else "EXPORT"
                code = code.rsplit(".", 1)[0] + f".{export_action}"
        if not code:
            return False
        if action in {"list", "retrieve"} and code == "RPT.CENTER.VIEW":
            return self.has_any_grant(request.user.iam_account, company, code)
        scope = run.parameters if action in {"drill_down", "export"} else request.data
        return has_effective_permission(
            request.user.iam_account, company, code,
            branch_id=request.query_params.get("branch_id") or scope.get("branch"),
            department_id=request.query_params.get("department_id") or scope.get("department"),
            warehouse_id=request.query_params.get("warehouse_id") or scope.get("warehouse"),
            bank_account_id=request.query_params.get("bank_account_id") or scope.get("bank_account"),
        )

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True
        if isinstance(obj, ReportDefinition):
            if request.method == "GET":
                company = Company.objects.filter(pk=request.query_params.get("company_id")).first()
                return bool(company and self.has_any_grant(request.user.iam_account, company, obj.permission_code))
            return True
        if hasattr(obj, "report") and isinstance(obj.report, ReportDefinition) and not hasattr(obj, "company_id"):
            return True
        company_id = getattr(obj, "company_id", None) or getattr(getattr(obj, "run", None), "company_id", None)
        return str(company_id) == str(request.query_params.get("company_id") or request.data.get("company"))
