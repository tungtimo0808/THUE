from rest_framework.permissions import BasePermission

from iam.permissions import has_effective_permission
from organization.models import Company


class FixedAssetPermission(BasePermission):
    message = "Bạn không có quyền thực hiện thao tác này."

    def has_permission(self, request, view):
        action_name = getattr(view, "action", None)
        basename = getattr(view, "basename", "") or view.__class__.__name__.lower()
        if action_name == "acquire" or (action_name == "create" and basename == "fixed-asset"):
            self.message = "Bạn không có quyền ghi tăng tài sản cố định."
        elif action_name in ("transfer", "next_transfer_number") or (
            action_name == "create"
            and "transaction" in basename
            and request.data.get("transaction_type") == "TRANSFER"
        ):
            self.message = "Bạn không có quyền điều chuyển tài sản cố định."
        elif action_name in ("revaluate", "next_revaluation_number") or (
            action_name == "create"
            and "transaction" in basename
            and request.data.get("transaction_type") in ("VALUE_INCREASE", "VALUE_DECREASE", "LIFE_CHANGE", "REVALUATION")
        ):
            self.message = "Bạn không có quyền đánh giá lại tài sản cố định."
        elif action_name in ("dispose", "next_disposal_number") or (
            action_name == "create"
            and "transaction" in basename
            and request.data.get("transaction_type") == "DISPOSAL"
        ):
            self.message = "Bạn không có quyền ghi giảm tài sản cố định."
        elif "count" in basename or action_name in (
            "stocktake", "next_stocktake_number", "load_book_assets", "save_stocktake", "update_stocktake",
        ):
            self.message = "Bạn không có quyền thực hiện kiểm kê tài sản cố định."
        elif action_name in ("register", "reports", "report_catalog"):
            self.message = "Bạn không có quyền xem sổ hoặc báo cáo tài sản cố định."
        elif action_name in (
            "default_allocation_period", "setup_allocation_period", "validate_allocation_voucher",
        ):
            self.message = "Bạn không có quyền lập chứng từ phân bổ chi phí."
        elif action_name in (
            "calculate_allocation_uc12", "save_allocation_voucher_uc12",
            "unpost_allocation_voucher_uc12", "export_allocation_excel_uc12",
            "allocation_reference_vouchers_uc12",
        ):
            self.message = "Bạn không có quyền ghi nhận chứng từ phân bổ chi phí."
        elif action_name in (
            "next_tool_transfer_number", "transferable_tools", "transfer_tools", "cancel_tool_transfer",
        ):
            self.message = "Bạn không có quyền lập hoặc ghi nhận chứng từ điều chuyển CCDC."
        elif action_name in (
            "next_tool_decrease_number", "disposable_tools", "decrease_tools", "cancel_tool_decrease",
            "next_prepaid_decrease_number", "disposable_prepaid_expenses", "decrease_prepaid_expenses",
            "cancel_prepaid_decrease", "decrease_reference_vouchers",
        ):
            self.message = "Bạn không có quyền ghi giảm CCDC hoặc chi phí trả trước."
        elif action_name in (
            "validate_tool_stocktake_date", "next_tool_stocktake_number", "tool_stocktake_items",
            "save_tool_stocktake", "resolve_tool_stocktake", "cancel_tool_stocktake",
            "export_tool_stocktake_excel",
        ):
            self.message = "Bạn không có quyền lập biên bản kiểm kê CCDC."
        elif action_name == "tool_register_uc16":
            self.message = "Bạn không có quyền xem Sổ theo dõi công cụ dụng cụ."
        elif action_name in ("tool_report_catalog", "tool_reports", "tool_report_preferences"):
            self.message = "Bạn không có quyền xem báo cáo này."
        elif action_name == "tool_detail_trace":
            self.message = "Bạn không có quyền xem chi tiết CCDC này."
        elif action_name == "export_tool_register":
            self.message = "Bạn không có quyền xuất dữ liệu này."
        elif action_name in (
            "acquire_tool", "acquire_tools_batch", "tool_source_vouchers",
            "prepaid_expenses", "import_prepaid_excel", "tool_register",
        ):
            self.message = "Bạn không có quyền thực hiện nghiệp vụ này."
        elif action_name == "post" and "calculation" in basename:
            self.message = "Bạn không có quyền ghi sổ chứng từ khấu hao."
        elif "calculation" in basename or action_name in (
            "preview", "calculate", "save_voucher", "unpost", "recalculate", "export_allocation",
        ):
            self.message = "Bạn không có quyền tính khấu hao tài sản cố định."
        else:
            self.message = "Bạn không có quyền thực hiện thao tác này."

        if not request.user or not request.user.is_authenticated:
            return False

        company_id = request.query_params.get("company_id") or request.data.get("company")
        target_company_id = None
        if getattr(view, "kwargs", {}).get("pk"):
            model = getattr(getattr(view, "queryset", None), "model", None)
            if model:
                try:
                    target_company_id = model.objects.filter(pk=view.kwargs["pk"]).values_list("company_id", flat=True).first()
                except Exception:
                    target_company_id = None

        if company_id and target_company_id and str(company_id) != str(target_company_id):
            if action_name in (
                "default_allocation_period", "setup_allocation_period", "validate_allocation_voucher",
            ):
                self.message = "Bạn không có quyền thực hiện phân bổ cho dữ liệu này."
            elif action_name in (
                "calculate_allocation_uc12", "save_allocation_voucher_uc12",
                "unpost_allocation_voucher_uc12", "export_allocation_excel_uc12",
                "allocation_reference_vouchers_uc12",
            ):
                self.message = "Bạn không có quyền ghi nhận chứng từ phân bổ chi phí."
            elif action_name in (
                "next_tool_transfer_number", "transferable_tools", "transfer_tools", "cancel_tool_transfer",
            ):
                self.message = "Không thể điều chuyển CCDC của doanh nghiệp khác bằng chứng từ điều chuyển nội bộ."
            elif action_name in (
                "next_tool_decrease_number", "disposable_tools", "decrease_tools", "cancel_tool_decrease",
                "next_prepaid_decrease_number", "disposable_prepaid_expenses", "decrease_prepaid_expenses",
                "cancel_prepaid_decrease", "decrease_reference_vouchers",
            ):
                self.message = "Bạn không có quyền ghi giảm CCDC hoặc chi phí trả trước."
            elif action_name in (
                "validate_tool_stocktake_date", "next_tool_stocktake_number", "tool_stocktake_items",
                "save_tool_stocktake", "resolve_tool_stocktake", "cancel_tool_stocktake",
                "export_tool_stocktake_excel",
            ):
                self.message = "Bạn không có quyền lập biên bản kiểm kê CCDC."
            elif action_name == "tool_register_uc16":
                self.message = "Bạn không có quyền xem Sổ theo dõi công cụ dụng cụ."
            elif action_name in ("tool_report_catalog", "tool_reports", "tool_report_preferences"):
                self.message = "Bạn không có quyền xem báo cáo này."
            elif action_name == "tool_detail_trace":
                self.message = "Bạn không có quyền xem chi tiết CCDC này."
            elif action_name == "export_tool_register":
                self.message = "Bạn không có quyền xuất dữ liệu này."
            elif "calculation" in basename:
                self.message = "Bạn không có quyền ghi sổ chứng từ khấu hao thuộc doanh nghiệp khác."
            elif action_name in ("revaluate", "next_revaluation_number"):
                self.message = "Bạn không có quyền thực hiện nghiệp vụ đối với tài sản này."
            elif action_name in ("dispose", "next_disposal_number"):
                self.message = "Bạn không có quyền ghi giảm tài sản này."
            elif "count" in basename or action_name in (
                "stocktake", "next_stocktake_number", "load_book_assets", "save_stocktake", "update_stocktake",
            ):
                self.message = "Bạn không có quyền kiểm kê tài sản thuộc phạm vi này."
            elif action_name in ("register", "reports", "report_catalog"):
                self.message = "Bạn không có quyền xem sổ hoặc báo cáo tài sản cố định thuộc doanh nghiệp khác."
            elif action_name in (
                "acquire_tool", "acquire_tools_batch", "tool_source_vouchers",
                "prepaid_expenses", "import_prepaid_excel", "tool_register",
            ):
                self.message = "Bạn không có quyền sử dụng dữ liệu này."
            else:
                self.message = "Bạn không có quyền cập nhật tài sản thuộc doanh nghiệp khác."
            return False

        if not company_id and target_company_id:
            company_id = target_company_id

        if request.user.is_superuser:
            return True

        if not company_id or not hasattr(request.user, "iam_account"):
            return False
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return False

        # EF18 (UC-FA-02) / EF21 (UC-FA-04) / EF30 (UC-FA-06 / UC-FA-07) / EF23 (UC-FA-08) / EF17 (UC-FA-11): If target record or company belongs to a company different from the user's company memberships
        from iam.models import CompanyMembership
        user_memberships = CompanyMembership.objects.filter(user=request.user.iam_account)
        check_comp_id = target_company_id or (company_id if action_name in (
            "default_allocation_period", "setup_allocation_period", "validate_allocation_voucher",
            "calculate_allocation_uc12", "save_allocation_voucher_uc12",
            "unpost_allocation_voucher_uc12", "export_allocation_excel_uc12",
            "allocation_reference_vouchers_uc12",
            "next_tool_transfer_number", "transferable_tools", "transfer_tools", "cancel_tool_transfer",
            "next_tool_decrease_number", "disposable_tools", "decrease_tools", "cancel_tool_decrease",
            "next_prepaid_decrease_number", "disposable_prepaid_expenses", "decrease_prepaid_expenses",
            "cancel_prepaid_decrease", "decrease_reference_vouchers",
            "validate_tool_stocktake_date", "next_tool_stocktake_number", "tool_stocktake_items",
            "save_tool_stocktake", "resolve_tool_stocktake", "cancel_tool_stocktake",
            "export_tool_stocktake_excel",
            "tool_register_uc16", "export_tool_register", "tool_detail_trace",
            "tool_report_catalog", "tool_reports", "tool_report_preferences",
            "acquire_tool", "acquire_tools_batch", "tool_source_vouchers",
            "prepaid_expenses", "import_prepaid_excel", "tool_register",
        ) else None)
        if check_comp_id and user_memberships.exists() and not user_memberships.filter(company_id=check_comp_id).exists():
            if action_name in (
                "default_allocation_period", "setup_allocation_period", "validate_allocation_voucher",
            ):
                self.message = "Bạn không có quyền thực hiện phân bổ cho dữ liệu này."
            elif action_name in (
                "calculate_allocation_uc12", "save_allocation_voucher_uc12",
                "unpost_allocation_voucher_uc12", "export_allocation_excel_uc12",
                "allocation_reference_vouchers_uc12",
            ):
                self.message = "Bạn không có quyền ghi nhận chứng từ phân bổ chi phí."
            elif action_name in (
                "next_tool_transfer_number", "transferable_tools", "transfer_tools", "cancel_tool_transfer",
            ):
                self.message = "Bạn không có quyền lập hoặc ghi nhận chứng từ điều chuyển CCDC."
            elif action_name in (
                "next_tool_decrease_number", "disposable_tools", "decrease_tools", "cancel_tool_decrease",
                "next_prepaid_decrease_number", "disposable_prepaid_expenses", "decrease_prepaid_expenses",
                "cancel_prepaid_decrease", "decrease_reference_vouchers",
            ):
                self.message = "Bạn không có quyền ghi giảm CCDC hoặc chi phí trả trước."
            elif action_name in (
                "validate_tool_stocktake_date", "next_tool_stocktake_number", "tool_stocktake_items",
                "save_tool_stocktake", "resolve_tool_stocktake", "cancel_tool_stocktake",
                "export_tool_stocktake_excel",
            ):
                self.message = "Bạn không có quyền lập biên bản kiểm kê CCDC."
            elif action_name == "tool_register_uc16":
                self.message = "Bạn không có quyền xem Sổ theo dõi công cụ dụng cụ."
            elif action_name in ("tool_report_catalog", "tool_reports", "tool_report_preferences"):
                self.message = "Bạn không có quyền xem báo cáo này."
            elif action_name == "tool_detail_trace":
                self.message = "Bạn không có quyền xem chi tiết CCDC này."
            elif action_name == "export_tool_register":
                self.message = "Bạn không có quyền xuất dữ liệu này."
            elif "calculation" in basename:
                self.message = "Bạn không có quyền ghi sổ chứng từ khấu hao thuộc doanh nghiệp khác."
            elif action_name in ("revaluate", "next_revaluation_number"):
                self.message = "Bạn không có quyền thực hiện nghiệp vụ đối với tài sản này."
            elif action_name in ("dispose", "next_disposal_number"):
                self.message = "Bạn không có quyền ghi giảm tài sản này."
            elif "count" in basename or action_name in (
                "stocktake", "next_stocktake_number", "load_book_assets", "save_stocktake", "update_stocktake",
            ):
                self.message = "Bạn không có quyền kiểm kê tài sản thuộc phạm vi này."
            elif action_name in ("register", "reports", "report_catalog"):
                self.message = "Bạn không có quyền xem sổ hoặc báo cáo tài sản cố định thuộc doanh nghiệp khác."
            elif action_name in (
                "acquire_tool", "acquire_tools_batch", "tool_source_vouchers",
                "prepaid_expenses", "import_prepaid_excel", "tool_register",
            ):
                self.message = "Bạn không có quyền sử dụng dữ liệu này."
            else:
                self.message = "Bạn không có quyền cập nhật tài sản thuộc doanh nghiệp khác."
            return False

        code = getattr(view, "action_permissions", {}).get(action_name)
        code = code or getattr(view, "iam_permissions", {}).get(request.method)
        if action_name == "create" and getattr(view, "basename", "") == "fixed-asset-transaction":
            if request.data.get("transaction_type") == "TRANSFER":
                code = "FA.TRANSACTION.TRANSFER"
            elif request.data.get("transaction_type") == "DISPOSAL":
                code = "FA.TRANSACTION.DISPOSE"
            elif request.data.get("transaction_type") in ("VALUE_INCREASE", "VALUE_DECREASE", "LIFE_CHANGE", "REVALUATION"):
                code = "FA.TRANSACTION.REVALUATE"
        if not code:
            return False
        branches = [value for value in (request.query_params.get("branch_id"), request.data.get("branch"), request.data.get("target_branch")) if value]
        if action_name in (
            "default_allocation_period", "setup_allocation_period", "validate_allocation_voucher",
            "calculate_allocation_uc12", "save_allocation_voucher_uc12",
            "unpost_allocation_voucher_uc12", "export_allocation_excel_uc12",
            "allocation_reference_vouchers_uc12",
        ):
            candidate_codes = (code, "FA.CALCULATION.CALCULATE", "FA.CALCULATION.CREATE", "FA.CALCULATION.POST", "FA.ASSET.CREATE", "GL.JOURNAL.CREATE")
            if not branches:
                return any(has_effective_permission(request.user.iam_account, company, c) for c in candidate_codes if c)
            return all(
                any(has_effective_permission(request.user.iam_account, company, c, branch_id=value) for c in candidate_codes if c)
                for value in set(branches)
            )
        if action_name in ("next_tool_transfer_number", "transferable_tools", "transfer_tools", "cancel_tool_transfer"):
            candidate_codes = (code, "FA.TRANSACTION.TRANSFER", "FA.ASSET.EDIT", "FA.ASSET.CREATE")
            if not branches:
                return any(has_effective_permission(request.user.iam_account, company, c) for c in candidate_codes if c)
            return all(
                any(has_effective_permission(request.user.iam_account, company, c, branch_id=value) for c in candidate_codes if c)
                for value in set(branches)
            )
        if action_name in (
            "next_tool_decrease_number", "disposable_tools", "decrease_tools", "cancel_tool_decrease",
            "next_prepaid_decrease_number", "disposable_prepaid_expenses", "decrease_prepaid_expenses",
            "cancel_prepaid_decrease", "decrease_reference_vouchers",
        ):
            candidate_codes = (
                code, "FA.TRANSACTION.DISPOSE", "FA.ASSET.EDIT", "FA.ASSET.CREATE",
                "GL.ALLOCATION.RUN", "GL.JOURNAL.CREATE",
            )
            if not branches:
                return any(has_effective_permission(request.user.iam_account, company, c) for c in candidate_codes if c)
            return all(
                any(has_effective_permission(request.user.iam_account, company, c, branch_id=value) for c in candidate_codes if c)
                for value in set(branches)
            )
        if action_name in (
            "validate_tool_stocktake_date", "next_tool_stocktake_number", "tool_stocktake_items",
            "save_tool_stocktake", "resolve_tool_stocktake", "cancel_tool_stocktake",
            "export_tool_stocktake_excel",
        ):
            candidate_codes = (
                code, "FA.COUNT.CREATE", "FA.COUNT.EDIT", "FA.COUNT.VIEW",
                "FA.ASSET.CREATE", "FA.ASSET.EDIT", "FA.ASSET.VIEW",
            )
            if not branches:
                return any(has_effective_permission(request.user.iam_account, company, c) for c in candidate_codes if c)
            return all(
                any(has_effective_permission(request.user.iam_account, company, c, branch_id=value) for c in candidate_codes if c)
                for value in set(branches)
            )
        if action_name in (
            "tool_register_uc16", "export_tool_register", "tool_detail_trace",
            "tool_report_catalog", "tool_reports", "tool_report_preferences",
        ):
            candidate_codes = (
                code, "FA.ASSET.VIEW", "FA.ASSET.CREATE", "FA.ASSET.EDIT",
                "FA.REPORT.VIEW", "FA.CALCULATION.VIEW", "GL.REPORT.VIEW",
            )
            if not branches:
                return any(has_effective_permission(request.user.iam_account, company, c) for c in candidate_codes if c)
            return all(
                any(has_effective_permission(request.user.iam_account, company, c, branch_id=value) for c in candidate_codes if c)
                for value in set(branches)
            )
        if not branches:
            return has_effective_permission(request.user.iam_account, company, code)
        return all(has_effective_permission(request.user.iam_account, company, code, branch_id=value) for value in set(branches))
