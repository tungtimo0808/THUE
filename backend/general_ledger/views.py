from decimal import Decimal

from django.db.models import Sum
from rest_framework import mixins, serializers as drf_serializers, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet, ReadOnlyModelViewSet

from audit_log.services import record_audit
from iam.permissions import HasIamPermission

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from organization.models import Company

from . import account_services, models, serializers, services
from .models import Account, AccountClass, ChartOfAccounts
from .permissions import GeneralLedgerPermission
from .serializers import AccountClassSerializer, AccountSerializer, ChartOfAccountsSerializer


class AccountMasterViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin, GenericViewSet,
):
    permission_classes = (HasIamPermission,)
    iam_permissions = {
        "GET": "MD.ACCOUNT.VIEW", "POST": "MD.ACCOUNT.CREATE",
        "PUT": "MD.ACCOUNT.EDIT", "PATCH": "MD.ACCOUNT.EDIT",
        "DELETE": "MD.ACCOUNT.DELETE",
    }
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("code", "name", "name_en")
    ordering_fields = ("code", "name", "account_level", "account_type")
    ordering = ("code",)

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        return super().get_queryset().filter(company_id=company_id) if company_id else super().get_queryset().none()

    def perform_create(self, serializer):
        instance = serializer.save()
        user_account = getattr(self.request.user, "iam_account", None)
        if user_account:
            record_audit(
                company=instance.company, actor_user=user_account,
                module_code="GL", action_code="CREATE", entity=instance,
                after=serializer.data, request=self.request,
            )

    def perform_update(self, serializer):
        before = type(serializer)(serializer.instance).data
        instance = serializer.save(version=serializer.instance.version + 1)
        user_account = getattr(self.request.user, "iam_account", None)
        if user_account:
            record_audit(
                company=instance.company, actor_user=user_account,
                module_code="GL", action_code="EDIT", entity=instance,
                before=before, after=serializer.data, request=self.request,
                reason=self.request.headers.get("X-Audit-Reason", ""),
            )


class AccountClassViewSet(AccountMasterViewSet):
    queryset = AccountClass.objects.all()
    serializer_class = AccountClassSerializer


class ChartOfAccountsViewSet(AccountMasterViewSet, mixins.DestroyModelMixin):
    queryset = ChartOfAccounts.objects.all()
    serializer_class = ChartOfAccountsSerializer


class AccountViewSet(AccountMasterViewSet):
    queryset = Account.objects.select_related("chart_of_accounts", "account_class", "parent")
    serializer_class = AccountSerializer
    action_permissions = {
        "list": "MD.ACCOUNT.VIEW",
        "retrieve": "MD.ACCOUNT.VIEW",
        "create": "MD.ACCOUNT.CREATE",
        "update": "MD.ACCOUNT.EDIT",
        "partial_update": "MD.ACCOUNT.EDIT",
        "hard_delete": "MD.ACCOUNT.DELETE",
        "tree": "MD.ACCOUNT.VIEW",
        "impact": "MD.ACCOUNT.VIEW",
        "history": "MD.ACCOUNT.VIEW",
        "change_status": "MD.ACCOUNT.EDIT",
        "init_from_template": "MD.ACCOUNT.CREATE",
        "convert_tt99": "MD.ACCOUNT.VIEW",
        "export_csv": "MD.ACCOUNT.EXPORT",
        "import_csv": "MD.ACCOUNT.IMPORT",
    }

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id:
            return super().get_queryset().none()
        qs = super().get_queryset().filter(company_id=company_id)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        account_type = self.request.query_params.get("account_type")
        if account_type:
            qs = qs.filter(account_type=account_type.upper())
        parent_id = self.request.query_params.get("parent_id")
        if parent_id:
            qs = qs.filter(parent_id=parent_id)
        is_postable = self.request.query_params.get("is_postable")
        if is_postable is not None:
            qs = qs.filter(is_postable=is_postable.lower() in ("true", "1"))
        is_system = self.request.query_params.get("is_system")
        if is_system is not None:
            qs = qs.filter(is_system=is_system.lower() in ("true", "1"))
        chart_id = self.request.query_params.get("chart_of_accounts_id")
        if chart_id:
            qs = qs.filter(chart_of_accounts_id=chart_id)
        return qs

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        # Optimistic concurrency check (EF-24, BR-COA-58)
        if "version" in request.data:
            try:
                expected_version = int(request.data["version"])
                if instance.version != expected_version:
                    return Response(
                        {"detail": "Dữ liệu đã được người dùng khác cập nhật, vui lòng tải lại trang."},
                        status=status.HTTP_409_CONFLICT,
                    )
            except (ValueError, TypeError):
                pass
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    @action(detail=True, methods=["DELETE", "POST"], url_path="hard-delete")
    def hard_delete(self, request, pk=None):
        """Xóa cứng tài khoản (chỉ khi chưa có con, số dư, bút toán, tham chiếu - BR-COA-36, 37)."""
        instance = self.get_object()
        try:
            account_services.delete_account(instance, user=request.user)
        except DjangoValidationError as exc:
            return Response(
                {"detail": exc.message if hasattr(exc, "message") else str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["GET"], url_path="tree")
    def tree(self, request):
        """Trả về cây cấu trúc tài khoản theo phân cấp cha - con (Main Flow 2.2)."""
        company_id = request.query_params.get("company_id")
        if not company_id:
            return Response({"detail": "Vui lòng chỉ định company_id."}, status=status.HTTP_400_BAD_REQUEST)
        company = get_object_or_404(Company, pk=company_id)
        chart_id = request.query_params.get("chart_of_accounts_id")
        chart = ChartOfAccounts.objects.filter(pk=chart_id, company=company).first() if chart_id else None
        tree_data = account_services.get_account_tree(company, chart)
        return Response(tree_data)

    @action(detail=True, methods=["GET"], url_path="impact")
    def impact(self, request, pk=None):
        """Báo cáo phân tích tác động và khả năng ngừng / xóa tài khoản (Main Flow 2.3, 2.4)."""
        account = self.get_object()
        data = account_services.get_account_impact(account)
        return Response(data)

    @action(detail=True, methods=["POST"], url_path="change-status")
    def change_status(self, request, pk=None):
        """Chuyển đổi trạng thái tài khoản (ACTIVE, INACTIVE, DRAFT, ARCHIVED)."""
        account = self.get_object()
        new_status = request.data.get("new_status")
        if not new_status:
            return Response({"detail": "Vui lòng chỉ định trạng thái mới (new_status)."}, status=status.HTTP_400_BAD_REQUEST)

        version = request.data.get("version")
        reason = request.data.get("reason", "")
        end_date = request.data.get("end_date")
        repl_id = request.data.get("replacement_account_id") or request.data.get("replacement_account")
        replacement_account = Account.objects.filter(pk=repl_id).first() if repl_id else None

        try:
            updated = account_services.change_account_status(
                account=account,
                new_status=new_status,
                version=int(version) if version is not None else None,
                reason=reason,
                end_date=end_date,
                replacement_account=replacement_account,
                user=request.user,
            )
        except DjangoValidationError as exc:
            if getattr(exc, "code", None) == "concurrency_conflict":
                return Response(
                    {"detail": "Dữ liệu đã được người dùng khác cập nhật, vui lòng tải lại trang."},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(
                {"detail": exc.message if hasattr(exc, "message") else str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(AccountSerializer(updated).data)

    @action(detail=True, methods=["GET"], url_path="history")
    def history(self, request, pk=None):
        """Tra cứu lịch sử biến động và Audit Log của tài khoản (Main Flow 2.3)."""
        account = self.get_object()
        from audit_log.models import AuditLog
        logs = AuditLog.objects.filter(entity_id=str(account.id)).prefetch_related("changes").order_by("-occurred_at")
        results = []
        for log in logs:
            before_dict = {}
            after_dict = {}
            for ch in log.changes.all():
                before_dict[ch.field_name] = ch.old_value_json
                after_dict[ch.field_name] = ch.new_value_json
            results.append({
                "id": str(log.id),
                "action_code": log.action_code,
                "actor": (
                    log.actor_user.auth_user.username
                    if log.actor_user and getattr(log.actor_user, "auth_user", None)
                    else (log.actor_name_snapshot or "Hệ thống")
                ),
                "occurred_at": log.occurred_at.isoformat(),
                "before": before_dict,
                "after": after_dict,
                "reason": log.reason,
                "description": log.description,
            })
        return Response(results)

    @action(detail=False, methods=["POST"], url_path="init-from-template")
    def init_from_template(self, request):
        """Khởi tạo hệ thống tài khoản từ mẫu Thông tư 99, Thông tư 200 hoặc Thông tư 133 (Main Flow 2.1)."""
        company_id = (
            request.query_params.get("company_id")
            or request.data.get("company_id")
            or request.data.get("company")
        )
        if not company_id:
            return Response({"detail": "Vui lòng chỉ định company_id."}, status=status.HTTP_400_BAD_REQUEST)
        company = get_object_or_404(Company, pk=company_id)
        regime = request.data.get("regime", "TT99")
        scope = request.data.get("scope", "FULL")
        chart_code = request.data.get("chart_code")
        chart_name = request.data.get("chart_name")

        try:
            result = account_services.init_chart_of_accounts_from_template(
                company=company,
                regime=regime,
                scope=scope,
                chart_code=chart_code,
                chart_name=chart_name,
                user=request.user,
            )
        except DjangoValidationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["GET", "POST"], url_path="convert-tt99")
    def convert_tt99(self, request):
        """Chuyển đổi và chuẩn hóa hệ thống tài khoản sang Thông tư 99/2025/TT-BTC."""
        company_id = (
            request.query_params.get("company_id")
            or request.data.get("company_id")
            or request.data.get("company")
        )
        company = Company.objects.filter(pk=company_id).first() if company_id else Company.objects.first()
        if not company:
            return Response({"detail": "Vui lòng chỉ định company_id hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)
        result = account_services.convert_chart_of_accounts_to_tt99(company=company, user=request.user)
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=["GET"], url_path="export-csv")
    def export_csv(self, request):
        """Xuất danh sách hệ thống tài khoản sang file CSV (AF-18, BR-COA-51)."""
        company_id = request.query_params.get("company_id")
        if not company_id:
            return Response({"detail": "Vui lòng chỉ định company_id."}, status=status.HTTP_400_BAD_REQUEST)
        company = get_object_or_404(Company, pk=company_id)
        chart_id = request.query_params.get("chart_of_accounts_id")
        chart = ChartOfAccounts.objects.filter(pk=chart_id, company=company).first() if chart_id else None

        csv_content = account_services.export_accounts_to_csv(company, chart)
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="chart_of_accounts_{company.code}.csv"'
        return response

    @action(detail=False, methods=["POST"], url_path="import-csv")
    def import_csv(self, request):
        """Nhập danh sách tài khoản kế toán từ file CSV (AF-17, BR-COA-48..50)."""
        company_id = (
            request.query_params.get("company_id")
            or request.data.get("company_id")
            or request.data.get("company")
        )
        if not company_id:
            return Response({"detail": "Vui lòng chỉ định company_id."}, status=status.HTTP_400_BAD_REQUEST)
        company = get_object_or_404(Company, pk=company_id)

        chart_id = request.data.get("chart_of_accounts_id") or request.data.get("chart_of_accounts")
        if chart_id:
            chart = get_object_or_404(ChartOfAccounts, pk=chart_id, company=company)
        else:
            chart = ChartOfAccounts.objects.filter(company=company, is_default=True).first()
            if not chart:
                chart = ChartOfAccounts.objects.filter(company=company).first()
            if not chart:
                return Response(
                    {"detail": "Doanh nghiệp chưa có hệ thống tài khoản nào để nhập vào."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        csv_file = request.FILES.get("file")
        if csv_file:
            csv_content = csv_file.read().decode("utf-8-sig", errors="replace")
        else:
            csv_content = request.data.get("content", "")

        try:
            result = account_services.import_accounts_from_csv(
                company=company,
                chart_of_accounts=chart,
                csv_content=csv_content,
                user=request.user,
            )
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_201_CREATED)


def permissions(resource):
    return {"GET": f"{resource}.VIEW", "POST": f"{resource}.CREATE", "PUT": f"{resource}.EDIT", "PATCH": f"{resource}.EDIT", "DELETE": f"{resource}.DELETE"}


class CompanyViewSet(ModelViewSet):
    permission_classes = (GeneralLedgerPermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    ordering = ("-created_at",)

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return super().get_queryset().filter(company_id=company) if company else super().get_queryset().none()

    def perform_create(self, serializer):
        fields = {field.name for field in serializer.Meta.model._meta.fields}
        obj = serializer.save(created_by=services.actor(self.request)) if "created_by" in fields else serializer.save()
        services.audit(self.request, obj, "CREATE", after=serializer.data)

    def perform_update(self, serializer):
        before = self.get_serializer(serializer.instance).data
        obj = serializer.save()
        services.audit(self.request, obj, "EDIT", before=before, after=serializer.data)


class PeriodViewSet(ModelViewSet):
    """
    UC-GL-12 – Khóa / Bỏ khóa sổ kỳ kế toán (Main Flow Steps 1..35, AF-01..25, EF-01..30, BR-GL-LOCK-01..96).
    """

    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.PeriodSerializer
    queryset = models.AccountingPeriod.objects.select_related(
        "company", "closed_by", "reopened_by", "reopen_requested_by", "reopen_approved_by"
    )
    iam_permissions = permissions("GL.PERIOD")
    action_permissions = {
        "checklist": "GL.PERIOD.CLOSE_PERIOD",
        "close": "GL.PERIOD.CLOSE_PERIOD",
        "reopen": "GL.PERIOD.REOPEN_PERIOD",
        "unlock": "GL.PERIOD.REOPEN_PERIOD",
        "decide_reopen": "GL.PERIOD.REOPEN_PERIOD",
        "lock_history": "GL.PERIOD.VIEW",
        "auto_lock": "GL.PERIOD.CLOSE_PERIOD",
        "aggregate": "GL.BALANCE.AGGREGATE",
    }

    def _resolve_company(self, request):
        comp_id = (
            request.data.get("company")
            or request.data.get("company_id")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            return Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})

    def get_queryset(self):
        company = self.request.query_params.get("company_id") or self.request.query_params.get("company")
        qs = self.queryset.filter(company_id=company) if company else self.queryset.none()
        if fiscal_year := self.request.query_params.get("fiscal_year"):
            qs = qs.filter(fiscal_year=fiscal_year)
        if status_param := self.request.query_params.get("status"):
            qs = qs.filter(status=status_param.upper())
        return qs

    def perform_destroy(self, instance):
        if instance.status in ("CLOSED", "PARTIALLY_LOCKED") or instance.journal_entries.exists():
            raise drf_serializers.ValidationError("Kỳ đã khóa hoặc đã phát sinh bút toán không được xóa.")
        instance.delete()

    @action(detail=True, methods=("get", "post"), url_path="checklist")
    def checklist(self, request, pk=None):
        period = self.get_object()
        payload = (
            dict(request.query_params.items())
            if request.method == "GET"
            else (dict(request.data) if isinstance(request.data, dict) else request.data.dict())
        )
        checklist_obj = services.evaluate_period_close_checklist(period, payload, request=request, persist=True)
        return Response(serializers.PeriodCloseChecklistSerializer(checklist_obj).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",))
    def close(self, request, pk=None):
        period = services.close_period(self.get_object(), request)
        data = dict(self.get_serializer(period).data)
        data["message"] = "Khóa sổ kỳ kế toán thành công."
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",))
    def reopen(self, request, pk=None):
        period = services.reopen_period(self.get_object(), request)
        data = dict(self.get_serializer(period).data)
        if period.reopen_workflow_status == "PENDING_APPROVAL":
            data["message"] = "Đã gửi yêu cầu phê duyệt mở lại kỳ kế toán. Kỳ giữ trạng thái khóa trong thời gian chờ duyệt."
        else:
            data["message"] = "Bỏ khóa sổ kỳ kế toán thành công."
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",))
    def unlock(self, request, pk=None):
        return self.reopen(request, pk=pk)

    @action(detail=True, methods=("post",), url_path="decide-reopen")
    def decide_reopen(self, request, pk=None):
        period = services.decide_reopen_period(self.get_object(), request)
        data = dict(self.get_serializer(period).data)
        if period.reopen_workflow_status == "REJECTED":
            data["message"] = "Đã từ chối yêu cầu mở lại kỳ kế toán."
        else:
            data["message"] = "Đã phê duyệt và bỏ khóa sổ kỳ kế toán thành công."
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("get",), url_path="lock-history")
    def lock_history(self, request, pk=None):
        period = self.get_object()
        histories = period.lock_histories.select_related("actor", "approved_by", "checklist").all()
        checklists = period.close_checklists.select_related("created_by").all()[:20]
        return Response({
            "period_id": str(period.id),
            "period_code": period.code,
            "status": period.status,
            "lock_scope": period.lock_scope,
            "lock_to_date": str(period.lock_to_date) if period.lock_to_date else None,
            "locked_document_types": period.locked_document_types,
            "reopen_workflow_status": period.reopen_workflow_status,
            "version": period.version,
            "history_count": histories.count(),
            "histories": serializers.PeriodLockHistorySerializer(histories, many=True).data,
            "checklists": serializers.PeriodCloseChecklistSerializer(checklists, many=True).data,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",), url_path="auto-lock")
    def auto_lock(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        res = services.run_auto_period_lock(company, payload, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",))
    def aggregate(self, request, pk=None):
        return Response(services.aggregate(self.get_object(), request))


class BudgetViewSet(CompanyViewSet):
    queryset = models.BudgetLine.objects.select_related("company", "period", "account", "branch", "department", "project", "cost_center")
    serializer_class = serializers.BudgetSerializer
    iam_permissions = permissions("GL.BUDGET")
    search_fields = ("account__code", "account__name", "period__code", "notes")
    ordering_fields = ("amount", "period__start_date", "created_at")


class JournalViewSet(CompanyViewSet):
    queryset = models.JournalEntry.objects.select_related(
        "company", "branch", "period", "created_by", "approved_by", "posted_by", "unposted_by", "original_entry", "replacement_for_entry"
    ).prefetch_related("lines__account", "posting_histories__actor")
    serializer_class = serializers.JournalEntrySerializer
    iam_permissions = permissions("GL.JOURNAL")
    action_permissions = {
        "submit": "GL.JOURNAL.SUBMIT", "approve": "GL.JOURNAL.APPROVE", "reject": "GL.JOURNAL.APPROVE",
        "post": "GL.JOURNAL.POST", "unpost": "GL.JOURNAL.UNPOST",
        "batch_post": "GL.JOURNAL.POST", "batch_unpost": "GL.JOURNAL.UNPOST",
        "posting_history": "GL.JOURNAL.VIEW",
        "adjust": "GL.JOURNAL.ADJUST", "reverse": "GL.JOURNAL.REVERSE",
        "create_replacement": "GL.JOURNAL.CREATE", "correction_chain": "GL.JOURNAL.VIEW",
        "cancel": "GL.JOURNAL.CANCEL",
    }
    search_fields = ("number", "description", "source_module", "source_event_id")
    ordering_fields = ("posting_date", "total_debit", "total_credit", "created_at")
    ordering = ("-created_at",)

    def _resolve_company(self, request):
        company_id = (
            request.query_params.get("company_id")
            or request.query_params.get("company")
            or request.data.get("company")
            or request.data.get("company_id")
        )
        if company_id:
            company = Company.objects.filter(pk=company_id).first()
            if company:
                return company
        raise drf_serializers.ValidationError({"company": "Vui lòng chọn doanh nghiệp làm việc."})

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in ("period_id", "status", "entry_type", "source_module", "branch_id", "original_entry_id", "replacement_for_entry_id"):
            if value := self.request.query_params.get(field):
                queryset = queryset.filter(**{field: value})
        if account := self.request.query_params.get("account_id"):
            queryset = queryset.filter(lines__account_id=account).distinct()
        if date_from := self.request.query_params.get("date_from"):
            queryset = queryset.filter(posting_date__gte=date_from)
        if date_to := self.request.query_params.get("date_to"):
            queryset = queryset.filter(posting_date__lte=date_to)
        return queryset

    def perform_destroy(self, instance):
        from common_services.document_lock_services import assert_not_locked, journal_lock_code

        assert_not_locked(instance.company, journal_lock_code(instance), instance.posting_date)
        if instance.status not in {"DRAFT", "REJECTED"} or instance.period.status == "CLOSED":
            raise drf_serializers.ValidationError("Chỉ bút toán nháp/bị từ chối trong kỳ mở mới được xóa (BR-GL-ADJ-04, 52, BR-GL-LOCK-33).")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        return Response(self.get_serializer(services.submit(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return Response(self.get_serializer(services.decide(self.get_object(), request, True)).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return Response(self.get_serializer(services.decide(self.get_object(), request, False)).data)

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        return Response(self.get_serializer(services.post(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def unpost(self, request, pk=None):
        return Response(self.get_serializer(services.unpost(self.get_object(), request)).data)

    @action(detail=False, methods=("post",), url_path="batch-post")
    def batch_post(self, request):
        company = self._resolve_company(request)
        return Response(services.batch_post_journals(company, request.data, request))

    @action(detail=False, methods=("post",), url_path="batch-unpost")
    def batch_unpost(self, request):
        company = self._resolve_company(request)
        return Response(services.batch_unpost_journals(company, request.data, request))

    @action(detail=True, methods=("get",), url_path="posting-history")
    def posting_history(self, request, pk=None):
        entry = self.get_object()
        histories = entry.posting_histories.select_related("actor").all()
        return Response({
            "entry_id": str(entry.id),
            "number": entry.number,
            "status": entry.status,
            "version": entry.version,
            "count": histories.count(),
            "results": serializers.JournalPostingHistorySerializer(histories, many=True).data,
        })

    @action(detail=True, methods=("post",))
    def adjust(self, request, pk=None):
        created = services.adjust(self.get_object(), request)
        payload = dict(self.get_serializer(created).data)
        payload["message"] = "Đã tạo bút toán điều chỉnh thành công."
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def reverse(self, request, pk=None):
        created = services.reverse(self.get_object(), request)
        payload = dict(self.get_serializer(created).data)
        payload["message"] = "Đã tạo bút toán đảo thành công."
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="create-replacement")
    def create_replacement(self, request, pk=None):
        created = services.create_replacement_entry(self.get_object(), request)
        payload = dict(self.get_serializer(created).data)
        payload["message"] = "Đã tạo bút toán lập lại thay thế thành công."
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("get",), url_path="correction-chain")
    def correction_chain(self, request, pk=None):
        entry = self.get_object()
        return Response(services.get_correction_chain(entry))

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        from common_services.document_lock_services import assert_not_locked, journal_lock_code

        entry = self.get_object()
        assert_not_locked(entry.company, journal_lock_code(entry), entry.posting_date)
        if entry.status not in {"DRAFT", "REJECTED"} or entry.period.status == "CLOSED":
            raise drf_serializers.ValidationError("Bút toán không thể hủy.")
        old = entry.status
        entry.status = "CANCELLED"
        entry.save(update_fields=("status", "updated_at"))
        services.audit(request, entry, "CANCEL", {"status": old}, {"status": entry.status}, request.data.get("reason", ""))
        return Response(self.get_serializer(entry).data)


class BalanceViewSet(ReadOnlyModelViewSet):
    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.BalanceSerializer
    queryset = models.AccountBalance.objects.select_related("company", "period", "account", "branch")
    iam_permissions = {"GET": "GL.BALANCE.VIEW", "POST": "GL.BALANCE.VIEW"}
    action_permissions = {
        "trial_balance": "GL.BALANCE.VIEW",
        "ledger": "GL.LEDGER.VIEW",
        "aggregate": "GL.BALANCE.VIEW",
        "drilldown": "GL.BALANCE.VIEW",
    }
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("account__code", "account__name", "period__code")
    ordering_fields = ("account__code", "closing_debit", "closing_credit")

    def _resolve_company(self, request):
        comp_id = (
            request.data.get("company")
            or request.data.get("company_id")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            return Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})

    def get_queryset(self):
        company = self.request.query_params.get("company_id") or self.request.query_params.get("company")
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        for field in ("period_id", "account_id", "branch_id"):
            if value := self.request.query_params.get(field):
                queryset = queryset.filter(**{field: value})
        return queryset

    @action(detail=False, methods=("get",), url_path="trial-balance")
    def trial_balance(self, request):
        queryset = self.get_queryset()
        totals = queryset.aggregate(
            opening_debit=Sum("opening_debit"), opening_credit=Sum("opening_credit"),
            period_debit=Sum("period_debit"), period_credit=Sum("period_credit"),
            closing_debit=Sum("closing_debit"), closing_credit=Sum("closing_credit"),
        )
        return Response({"totals": {key: value or Decimal("0") for key, value in totals.items()}, "balances": self.get_serializer(queryset, many=True).data})

    @action(detail=False, methods=("get",))
    def ledger(self, request):
        company, account = request.query_params.get("company_id") or request.query_params.get("company"), request.query_params.get("account_id")
        if not account:
            raise drf_serializers.ValidationError({"account_id": "Tài khoản là bắt buộc."})
        lines = models.JournalLine.objects.filter(entry__company_id=company, entry__status__in=("POSTED", "REVERSED"), account_id=account).select_related("entry", "account")
        if period := request.query_params.get("period_id"):
            lines = lines.filter(entry__period_id=period)
        return Response([{
            "entry_id": str(line.entry_id), "number": line.entry.number, "posting_date": line.entry.posting_date,
            "description": line.description or line.entry.description, "debit": line.debit, "credit": line.credit,
            "source_module": line.entry.source_module, "source_entity_type": line.entry.source_entity_type,
            "source_entity_id": str(line.entry.source_entity_id) if line.entry.source_entity_id else None,
        } for line in lines.order_by("entry__posting_date", "entry__created_at", "line_no")])

    @action(detail=False, methods=("post",))
    def aggregate(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        res = services.aggregate_and_validate_gl_balances(company, payload, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"))
    def drilldown(self, request):
        company = self._resolve_company(request)
        if request.method == "GET":
            payload = dict(request.query_params.items())
        else:
            payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        res = services.drilldown_account_balance(company, payload)
        return Response(res, status=status.HTTP_200_OK)


class BalanceAggregationRunViewSet(ReadOnlyModelViewSet):
    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.BalanceAggregationRunSerializer
    queryset = models.BalanceAggregationRun.objects.select_related("company", "period", "created_by")
    iam_permissions = {"GET": "GL.BALANCE.VIEW", "POST": "GL.BALANCE.VIEW"}
    action_permissions = {
        "run": "GL.BALANCE.VIEW",
    }
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("period__code", "status", "watermark")
    ordering_fields = ("created_at", "period__code")
    ordering = ("-created_at",)

    def _resolve_company(self, request):
        comp_id = (
            request.data.get("company")
            or request.data.get("company_id")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            return Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})

    def get_queryset(self):
        company = self.request.query_params.get("company_id") or self.request.query_params.get("company")
        qs = self.queryset.filter(company_id=company) if company else self.queryset.none()
        period_id = self.request.query_params.get("period") or self.request.query_params.get("period_id")
        if period_id:
            qs = qs.filter(period_id=period_id)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs

    @action(detail=False, methods=("post",))
    def run(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        res = services.aggregate_and_validate_gl_balances(company, payload, request=request)
        return Response(res, status=status.HTTP_200_OK)


class AllocationRuleViewSet(CompanyViewSet):
    queryset = models.AllocationRule.objects.select_related("company", "source_account", "offset_account").prefetch_related("destinations")
    serializer_class = serializers.AllocationRuleSerializer
    iam_permissions = permissions("GL.ALLOCATION")
    action_permissions = {
        "run": "GL.ALLOCATION.RUN",
        "calculate": "GL.ALLOCATION.VIEW",
    }
    search_fields = ("code", "name", "description")
    ordering = ("code",)

    def perform_destroy(self, instance):
        if instance.runs.exclude(status="CANCELLED").exists():
            raise drf_serializers.ValidationError({
                "rule": "Quy tắc phân bổ đã phát sinh dữ liệu lịch sử phân bổ, không được xóa trực tiếp. Vui lòng chuyển sang trạng thái ngừng hoạt động."
            })
        audit_log(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=True, methods=("post",))
    def calculate(self, request, pk=None):
        rule = self.get_object()
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        payload["rule"] = str(rule.id)
        res = services.calculate_expense_allocation(rule.company, payload, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",))
    def run(self, request, pk=None):
        try:
            period = models.AccountingPeriod.objects.get(pk=request.data.get("period"), company_id=request.data.get("company"))
        except (models.AccountingPeriod.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"period": "Kỳ kế toán không hợp lệ."})
        obj = services.run_allocation(self.get_object(), period, request.data.get("idempotency_key", ""), request)
        return Response(serializers.AllocationRunSerializer(obj).data, status=status.HTTP_201_CREATED)


class AllocationRunViewSet(CompanyViewSet):
    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.AllocationRunSerializer
    queryset = models.AllocationRun.objects.select_related(
        "company", "rule", "period", "entry", "reversal_entry", "created_by"
    )
    iam_permissions = {
        **permissions("GL.ALLOCATION"),
        "POST": "GL.ALLOCATION.RUN",
    }
    action_permissions = {
        "fetch_source": "GL.ALLOCATION.VIEW",
        "calculate": "GL.ALLOCATION.VIEW",
        "confirm": "GL.ALLOCATION.RUN",
        "post_entry": "GL.JOURNAL.POST",
        "unpost_entry": "GL.JOURNAL.UNPOST",
        "reverse_entry": "GL.JOURNAL.REVERSE",
        "cancel": "GL.ALLOCATION.RUN",
        "trace": "GL.ALLOCATION.VIEW",
    }
    search_fields = ("number", "description", "idempotency_key")
    ordering_fields = ("created_at", "posting_date", "amount", "number")
    ordering = ("-created_at",)

    def _resolve_company(self, request):
        from organization.models import Company
        comp_id = (
            request.data.get("company")
            or request.data.get("company_id")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            return Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})

    def get_queryset(self):
        qs = super().get_queryset()
        period_id = self.request.query_params.get("period") or self.request.query_params.get("period_id")
        if period_id:
            qs = qs.filter(period_id=period_id)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        rule_id = self.request.query_params.get("rule") or self.request.query_params.get("rule_id")
        if rule_id:
            qs = qs.filter(rule_id=rule_id)
        group_param = self.request.query_params.get("allocation_group")
        if group_param:
            qs = qs.filter(allocation_group=group_param.upper())
        return qs

    def create(self, request, *args, **kwargs):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        run = services.create_expense_allocation_voucher(company, payload, request=request)
        return Response(self.get_serializer(run).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == "POSTED":
            raise drf_serializers.ValidationError({
                "status": "Chứng từ phân bổ đã ghi sổ (POSTED), không được phép sửa trực tiếp (EF-35, BR-GL-ALLOC-62).",
                "error_code": "CANNOT_EDIT_POSTED_ALLOCATION",
            })
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == "POSTED":
            raise drf_serializers.ValidationError({
                "status": "Chứng từ phân bổ đã ghi sổ (POSTED), không được phép xóa trực tiếp (EF-35, BR-GL-ALLOC-62).",
                "error_code": "CANNOT_DELETE_POSTED_ALLOCATION",
            })
        services.cancel_expense_allocation_run(instance, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=("post",), url_path="fetch-source")
    def fetch_source(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        res = services.fetch_allocation_source_data(company, payload, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",))
    def calculate(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        res = services.calculate_expense_allocation(company, payload, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",))
    def confirm(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        run = services.create_expense_allocation_voucher(company, payload, request=request)
        return Response(self.get_serializer(run).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="post")
    def post_entry(self, request, pk=None):
        run = self.get_object()
        if not run.entry_id:
            raise drf_serializers.ValidationError({"entry": "Đợt phân bổ chưa sinh chứng từ kế toán."})
        services.post(run.entry, request)
        run.refresh_from_db()
        return Response(self.get_serializer(run).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="unpost")
    def unpost_entry(self, request, pk=None):
        run = self.get_object()
        if not run.entry_id:
            raise drf_serializers.ValidationError({"entry": "Đợt phân bổ không có bút toán liên kết."})
        services.unpost(run.entry, request)
        run.refresh_from_db()
        return Response(self.get_serializer(run).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="reverse")
    def reverse_entry(self, request, pk=None):
        run = self.get_object()
        if not run.entry_id:
            raise drf_serializers.ValidationError({"entry": "Đợt phân bổ không có bút toán liên kết."})
        rev_entry = services.reverse(run.entry, request)
        run.refresh_from_db()
        data = self.get_serializer(run).data
        data["reversal_entry_detail"] = serializers.JournalEntrySerializer(rev_entry).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        run = self.get_object()
        run = services.cancel_expense_allocation_run(run, request=request)
        return Response(self.get_serializer(run).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("get",))
    def trace(self, request, pk=None):
        run = self.get_object()
        return Response(services.trace_expense_allocation_run(run), status=status.HTTP_200_OK)


class ClosingRuleViewSet(CompanyViewSet):
    queryset = models.ClosingRule.objects.select_related("company", "source_account", "destination_account")
    serializer_class = serializers.ClosingRuleSerializer
    iam_permissions = permissions("GL.CLOSING")
    action_permissions = {
        "run": "GL.CLOSING.RUN",
        "seed_defaults": "GL.CLOSING.CREATE",
    }
    search_fields = ("code", "name", "source_account_prefix")
    ordering_fields = ("sequence", "code")
    ordering = ("sequence", "code")

    def perform_destroy(self, instance):
        if instance.runs.exclude(status="CANCELLED").exists() or instance.run_lines.exists():
            raise drf_serializers.ValidationError({
                "rule": "Quy tắc kết chuyển đã phát sinh dữ liệu kết chuyển, không được xóa trực tiếp. Vui lòng chuyển sang trạng thái ngừng hoạt động."
            })
        audit_log(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=False, methods=("post",), url_path="seed-defaults")
    def seed_defaults(self, request):
        comp_id = (
            request.data.get("company")
            or request.data.get("company_id")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            company = Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})
        created_rules = services.seed_default_closing_rules(company, request=request)
        return Response(self.get_serializer(created_rules, many=True).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",))
    def run(self, request, pk=None):
        try:
            period = models.AccountingPeriod.objects.get(pk=request.data.get("period"), company_id=request.data.get("company"))
        except (models.AccountingPeriod.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"period": "Kỳ kế toán không hợp lệ."})
        obj = services.run_closing(self.get_object(), period, request)
        return Response(serializers.ClosingRunSerializer(obj).data, status=status.HTTP_201_CREATED)


class ClosingRunViewSet(CompanyViewSet):
    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.ClosingRunSerializer
    queryset = models.ClosingRun.objects.select_related(
        "company", "rule", "period", "entry", "reversal_entry", "created_by"
    ).prefetch_related("lines", "lines__account", "lines__debit_account", "lines__credit_account")
    iam_permissions = {
        **permissions("GL.CLOSING"),
        "POST": "GL.CLOSING.RUN",
    }
    action_permissions = {
        "fetch_data": "GL.CLOSING.VIEW",
        "confirm": "GL.CLOSING.RUN",
        "post_entry": "GL.JOURNAL.POST",
        "unpost_entry": "GL.JOURNAL.UNPOST",
        "reverse_entry": "GL.JOURNAL.REVERSE",
        "cancel": "GL.CLOSING.RUN",
        "trace": "GL.CLOSING.VIEW",
    }
    search_fields = ("number", "description", "reference", "idempotency_key")
    ordering_fields = ("created_at", "posting_date", "closing_to_date", "amount", "number")
    ordering = ("-created_at",)

    def _resolve_company(self, request):
        comp_id = (
            request.data.get("company")
            or request.data.get("company_id")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            return Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})

    def get_queryset(self):
        qs = super().get_queryset()
        period_id = self.request.query_params.get("period") or self.request.query_params.get("period_id")
        if period_id:
            qs = qs.filter(period_id=period_id)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        rule_id = self.request.query_params.get("rule") or self.request.query_params.get("rule_id")
        if rule_id:
            qs = qs.filter(rule_id=rule_id)
        return qs

    def create(self, request, *args, **kwargs):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        run = services.create_profit_loss_closing_voucher(company, payload, request=request)
        return Response(self.get_serializer(run).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status in ("COMPLETED", "POSTED"):
            raise drf_serializers.ValidationError({
                "status": "Chứng từ kết chuyển lãi lỗ đã ghi sổ (POSTED), không được phép sửa trực tiếp (EF-09-29, BR-GL-CLOSE-57).",
                "error_code": "CANNOT_EDIT_POSTED_CLOSING",
            })
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status in ("COMPLETED", "POSTED"):
            raise drf_serializers.ValidationError({
                "status": "Chứng từ kết chuyển lãi lỗ đã ghi sổ (POSTED), không được phép xóa trực tiếp (EF-09-29, BR-GL-CLOSE-57).",
                "error_code": "CANNOT_DELETE_POSTED_CLOSING",
            })
        services.cancel_closing_run(instance, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=("post",), url_path="fetch-data")
    def fetch_data(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        res = services.fetch_profit_loss_closing_data(company, payload, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",))
    def confirm(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        run = services.create_profit_loss_closing_voucher(company, payload, request=request)
        return Response(self.get_serializer(run).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="post")
    def post_entry(self, request, pk=None):
        run = self.get_object()
        if not run.entry_id:
            raise drf_serializers.ValidationError({"entry": "Đợt kết chuyển chưa sinh chứng từ kế toán."})
        services.post(run.entry, request)
        run.refresh_from_db()
        return Response(self.get_serializer(run).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="unpost")
    def unpost_entry(self, request, pk=None):
        run = self.get_object()
        if not run.entry_id:
            raise drf_serializers.ValidationError({"entry": "Đợt kết chuyển không có bút toán liên kết."})
        services.unpost(run.entry, request)
        run.refresh_from_db()
        return Response(self.get_serializer(run).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="reverse")
    def reverse_entry(self, request, pk=None):
        run = self.get_object()
        if not run.entry_id:
            raise drf_serializers.ValidationError({"entry": "Đợt kết chuyển không có bút toán liên kết."})
        rev_entry = services.reverse(run.entry, request)
        run.refresh_from_db()
        data = self.get_serializer(run).data
        data["reversal_entry_detail"] = serializers.JournalEntrySerializer(rev_entry).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        run = self.get_object()
        run = services.cancel_closing_run(run, request=request)
        return Response(self.get_serializer(run).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("get",))
    def trace(self, request, pk=None):
        run = self.get_object()
        return Response(services.trace_closing_run(run), status=status.HTTP_200_OK)


class ReconciliationRuleViewSet(CompanyViewSet):
    """
    UC-GL-11 (Section 1.1.B, BR-GL-REC-05..28):
    API quản lý cấu hình quy tắc đối chiếu giữa Sổ cái (GL) và các phân hệ chi tiết
    (GL ↔ AP, AR, CASH, BANK, INV, FA, TAX).
    """

    serializer_class = serializers.GlReconciliationRuleSerializer
    queryset = models.GlReconciliationRule.objects.select_related("company", "account")
    iam_permissions = {
        "GET": "GL.RECONCILIATION.VIEW",
        "POST": "GL.RECONCILIATION.RUN",
        "PUT": "GL.RECONCILIATION.RUN",
        "PATCH": "GL.RECONCILIATION.RUN",
        "DELETE": "GL.RECONCILIATION.RUN",
    }
    action_permissions = {
        "seed_defaults": "GL.RECONCILIATION.RUN",
    }
    search_fields = ("code", "name", "reconciliation_type", "source_module", "account_prefixes")
    ordering_fields = ("reconciliation_type", "code", "created_at")
    ordering = ("reconciliation_type", "code")

    def _resolve_company(self, request):
        comp_id = (
            request.data.get("company")
            or request.data.get("company_id")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            return Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})

    @action(detail=False, methods=("post",), url_path="seed-defaults")
    def seed_defaults(self, request):
        company = self._resolve_company(request)
        rules = services.seed_default_reconciliation_rules(company, request=request)
        return Response(self.get_serializer(rules, many=True).data, status=status.HTTP_200_OK)


class ReconciliationViewSet(ReadOnlyModelViewSet):
    """
    UC-GL-11 – Đối chiếu số liệu GL với các phân hệ (GL <-> Subledger Reconciliation).
    Bao phủ:
    - Chạy đối chiếu theo Loại đối chiếu (GL_AP, GL_AR, GL_CASH, GL_BANK, GL_INV, GL_FA, GL_TAX)
    - Drill-down từ khoản chênh lệch xuống Tài khoản/Đối tượng -> Bút toán GL -> Chứng từ phân hệ
    - Ghi chú nguyên nhân / xử lý chênh lệch mà không tự động sửa dữ liệu nguồn (BR-GL-REC-50, 56, 94)
    - Kiểm tra điều kiện đối chiếu trước khi khóa kỳ (UC-GL-12, BR-GL-REC-81..83)
    """

    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.ReconciliationSerializer
    queryset = models.GlReconciliation.objects.select_related(
        "company", "period", "rule", "account", "branch", "party", "currency", "created_by"
    ).prefetch_related("lines")
    iam_permissions = {"GET": "GL.RECONCILIATION.VIEW"}
    action_permissions = {
        "run": "GL.RECONCILIATION.RUN",
        "resolve": "GL.RECONCILIATION.RESOLVE",
        "annotate": "GL.RECONCILIATION.RESOLVE",
        "drilldown": "GL.RECONCILIATION.VIEW",
        "pre_closing_check": "GL.RECONCILIATION.VIEW",
    }

    def _resolve_company(self, request):
        comp_id = (
            request.data.get("company")
            or request.data.get("company_id")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            return Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})

    def get_queryset(self):
        company = self.request.query_params.get("company_id") or self.request.query_params.get("company")
        if not company:
            return self.queryset.none()
        qs = self.queryset.filter(company_id=company)
        period_id = self.request.query_params.get("period") or self.request.query_params.get("period_id")
        if period_id:
            qs = qs.filter(period_id=period_id)
        rec_type = self.request.query_params.get("reconciliation_type")
        if rec_type:
            qs = qs.filter(reconciliation_type=rec_type.upper())
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs

    @action(detail=False, methods=("post",))
    def run(self, request):
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        # Tương thích ngược với bài kiểm thử legacy khi chỉ truyền subledger_amount mà không truyền subledger_items / reconciliation_type
        if (
            "subledger_amount" in payload
            and "subledger_items" not in payload
            and "reconciliation_type" not in payload
            and payload.get("account")
        ):
            try:
                period = models.AccountingPeriod.objects.get(
                    pk=payload.get("period"), company_id=payload.get("company")
                )
                account = models.Account.objects.get(
                    pk=payload.get("account"), company_id=payload.get("company")
                )
                amount = Decimal(str(payload.get("subledger_amount")))
            except (models.AccountingPeriod.DoesNotExist, models.Account.DoesNotExist, ValueError, TypeError):
                raise drf_serializers.ValidationError("Kỳ, tài khoản hoặc số tiền không hợp lệ.")
            obj = services.reconcile(
                period,
                account,
                payload.get("source_module", ""),
                amount,
                payload.get("details", {}),
                request,
            )
            return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED)

        company = self._resolve_company(request)
        rec_run = services.run_gl_subledger_reconciliation(company, payload, request=request)
        return Response(self.get_serializer(rec_run).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("get", "post"), url_path="drilldown")
    def drilldown(self, request, pk=None):
        obj = self.get_object()
        params = {}
        params.update(request.query_params.dict())
        if isinstance(request.data, dict):
            params.update(request.data)
        res = services.drilldown_gl_reconciliation(obj, params, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="annotate")
    def annotate(self, request, pk=None):
        obj = self.get_object()
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        updated = services.annotate_reconciliation_note(obj, payload, request=request)
        return Response(self.get_serializer(updated).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",))
    def resolve(self, request, pk=None):
        obj = self.get_object()
        reason = (request.data.get("reason") or request.data.get("note") or "").strip()
        if obj.status not in ("VARIANCE", "DIFFERENCE", "WARNING") or not reason:
            raise drf_serializers.ValidationError("Chỉ chênh lệch có lý do mới được đánh dấu xử lý.")
        if request.data.get("legacy_resolve", True) and obj.status == "VARIANCE":
            obj.resolved = True
            obj.details = {
                **(obj.details or {}),
                "resolution": reason,
                "resolved_by": str(services.actor(request).id),
            }
            obj.save(update_fields=("resolved", "details"))
            services.audit(request, obj, "RESOLVE", after={"resolved": True}, reason=reason)
            return Response(self.get_serializer(obj).data)
        updated = services.annotate_reconciliation_note(obj, {"note": reason, "line_id": request.data.get("line_id")}, request=request)
        return Response(self.get_serializer(updated).data)

    @action(detail=False, methods=("get", "post"), url_path="pre-closing-check")
    def pre_closing_check(self, request):
        company = self._resolve_company(request)
        period_param = (
            request.data.get("period")
            or request.data.get("period_id")
            or request.query_params.get("period")
            or request.query_params.get("period_id")
        )
        if not period_param:
            raise drf_serializers.ValidationError({"period": "Bắt buộc chọn Kỳ kế toán (period)."})
        try:
            period = models.AccountingPeriod.objects.get(pk=period_param, company=company)
        except (models.AccountingPeriod.DoesNotExist, ValueError):
            period = models.AccountingPeriod.objects.filter(company=company, code=str(period_param).strip()).first()
            if not period:
                raise drf_serializers.ValidationError({"period": "Kỳ kế toán không tồn tại."})
        res = services.check_pre_closing_reconciliations(company, period, request=request)
        return Response(res, status=status.HTTP_200_OK)


class ApprovalViewSet(ReadOnlyModelViewSet):
    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.ApprovalSerializer
    queryset = models.JournalApproval.objects.select_related("company", "entry", "actor")
    iam_permissions = {"GET": "GL.APPROVAL.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class OpeningBalanceViewSet(GenericViewSet):
    """
    UC-GL-15: API quản lý, kiểm tra ràng buộc (EF-01..23, BR01..42), import Excel,
    in ấn, truy vấn chứng từ và đồng bộ Số dư ban đầu (10 nhóm A–J) theo Thông tư 99/2025/TT-BTC
    trực tiếp vào PostgreSQL (kết hợp CoreCompanySetting.configuration và bút toán đầu kỳ OPEN-2026-001 trên Sổ Cái).
    """
    permission_classes = ()

    def _resolve_company(self, request):
        company_id = (
            request.query_params.get("company_id")
            or request.data.get("company_id")
            or request.data.get("company")
        )
        if company_id:
            comp = Company.objects.filter(pk=company_id).first()
            if comp:
                return comp
        return Company.objects.first()

    def list(self, request):
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=status.HTTP_400_BAD_REQUEST)
        data = services.get_opening_balances_uc_gl_15(
            company,
            params=request.query_params,
            request=request,
        )
        return Response(data)

    def create(self, request):
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=status.HTTP_400_BAD_REQUEST)
        data = services.save_opening_balances_uc_gl_15(
            company,
            payload=request.data,
            request=request,
        )
        return Response(data)

    @action(detail=False, methods=["post"], url_path="save-item")
    def save_item(self, request):
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=status.HTTP_400_BAD_REQUEST)
        data = services.upsert_opening_balance_item_uc_gl_15(
            company,
            payload=request.data,
            request=request,
        )
        return Response(data)

    @action(detail=False, methods=["post"], url_path="delete-item")
    def delete_item(self, request):
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=status.HTTP_400_BAD_REQUEST)
        data = services.delete_opening_balance_item_uc_gl_15(
            company,
            payload=request.data,
            request=request,
        )
        return Response(data)

    @action(detail=False, methods=["post"], url_path="import-excel")
    def import_excel(self, request):
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=status.HTTP_400_BAD_REQUEST)
        data = services.import_opening_balances_excel_uc_gl_15(
            company,
            payload=request.data,
            request=request,
        )
        return Response(data)

    @action(detail=False, methods=["get"], url_path="vouchers")
    def vouchers(self, request):
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=status.HTTP_400_BAD_REQUEST)
        data = services.list_opening_balance_vouchers_uc_gl_15(
            company,
            params=request.query_params,
            request=request,
        )
        return Response(data)

    @action(detail=False, methods=["post"], url_path="print")
    def print_preview(self, request):
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=status.HTTP_400_BAD_REQUEST)
        data = services.print_opening_balance_uc_gl_15(
            company,
            payload=request.data,
            request=request,
        )
        return Response(data)


class AdvanceSettlementRequestViewSet(ModelViewSet):
    """
    UC-GL-01: Quản lý Đề nghị quyết toán tạm ứng (Advance Settlement Request).
    Hỗ trợ danh sách, tạo mới & gửi phê duyệt, phê duyệt (đa cấp), yêu cầu bổ sung, từ chối,
    gửi duyệt lại, thử đồng bộ lại và kế thừa lập chứng từ quyết toán tạm ứng (UC-GL-02).
    """

    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.AdvanceSettlementRequestSerializer
    queryset = models.AdvanceSettlementRequest.objects.select_related(
        "company",
        "branch",
        "requester",
        "department",
        "created_by",
        "approved_by",
        "settlement_entry",
    )
    iam_permissions = permissions("GL.ADVANCE_REQUEST")
    action_permissions = {
        "approve": "GL.ADVANCE_REQUEST.APPROVE",
        "reject": "GL.ADVANCE_REQUEST.APPROVE",
        "request_info": "GL.ADVANCE_REQUEST.APPROVE",
        "resubmit": "GL.ADVANCE_REQUEST.SUBMIT",
        "retry_sync": "GL.ADVANCE_REQUEST.APPROVE",
        "inherit_to_settlement": "GL.ADVANCE_REQUEST.VIEW",
    }
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("number", "purpose", "requester__full_name", "requester__employee_code", "department__name")
    ordering_fields = ("request_date", "amount", "created_at", "number")
    ordering = ("-request_date", "-created_at")

    def _resolve_company(self, request):
        company_id = (
            request.query_params.get("company_id")
            or request.data.get("company")
            or request.data.get("company_id")
        )
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Vui lòng chọn doanh nghiệp làm việc."})
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})
        return company

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id and getattr(self, "kwargs", {}).get("pk"):
            company_id = (
                models.AdvanceSettlementRequest.objects.filter(pk=self.kwargs["pk"])
                .values_list("company_id", flat=True)
                .first()
            )
        if not company_id:
            return self.queryset.none()
        qs = self.queryset.filter(company_id=company_id)
        for param, field in (
            ("status", "status"),
            ("sync_status", "sync_status"),
            ("requester_id", "requester_id"),
            ("department_id", "department_id"),
            ("branch_id", "branch_id"),
        ):
            val = self.request.query_params.get(param)
            if val:
                qs = qs.filter(**{field: val})
        eligible = self.request.query_params.get("eligible_for_settlement")
        if eligible and eligible.lower() in ("true", "1"):
            qs = qs.filter(
                status=models.AdvanceRequestStatus.APPROVED,
                settlement_entry__isnull=True,
            )
        return qs

    def create(self, request, *args, **kwargs):
        company = self._resolve_company(request)
        obj, created = services.create_advance_settlement_request(company, request.data, request)
        payload = dict(self.get_serializer(obj).data)
        payload["message"] = "Đã gửi đề nghị quyết toán tạm ứng lên cấp duyệt."
        payload["duplicate_prevented"] = not created
        return Response(
            payload,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        updated = services.update_or_resubmit_advance_request(instance, request.data, request)
        payload = dict(self.get_serializer(updated).data)
        payload["message"] = "Đã cập nhật và gửi lại đề nghị quyết toán tạm ứng lên cấp duyệt."
        return Response(payload)

    def perform_destroy(self, instance):
        if instance.settlement_entry_id or instance.settlement_voucher_no:
            raise drf_serializers.ValidationError(
                "Đề nghị đã được kế thừa lập chứng từ quyết toán không được phép xóa."
            )
        if instance.status in (
            models.AdvanceRequestStatus.PENDING_APPROVAL,
            models.AdvanceRequestStatus.APPROVED,
        ):
            raise drf_serializers.ValidationError(
                "Không được phép xóa đề nghị đang chờ duyệt hoặc đã được phê duyệt."
            )
        services.audit(self.request, instance, "DELETE_ADVANCE_REQUEST", before=self.get_serializer(instance).data)
        instance.delete()

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        obj = services.decide_advance_settlement_request(self.get_object(), request, "APPROVE")
        payload = dict(self.get_serializer(obj).data)
        if obj.status == models.AdvanceRequestStatus.APPROVED:
            payload["message"] = f"Đã phê duyệt đề nghị quyết toán tạm ứng {obj.number}."
        else:
            payload["message"] = (
                f"Đã phê duyệt cấp {obj.current_approval_level - 1}, chuyển sang cấp duyệt {obj.current_approval_level}."
            )
        return Response(payload)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        obj = services.decide_advance_settlement_request(self.get_object(), request, "REJECT")
        payload = dict(self.get_serializer(obj).data)
        payload["message"] = f"Đã từ chối đề nghị quyết toán tạm ứng {obj.number}."
        return Response(payload)

    @action(detail=True, methods=("post",), url_path="request-info")
    def request_info(self, request, pk=None):
        obj = services.decide_advance_settlement_request(self.get_object(), request, "RETURN")
        payload = dict(self.get_serializer(obj).data)
        payload["message"] = f"Đã gửi yêu cầu bổ sung thông tin cho đề nghị {obj.number}."
        return Response(payload)

    @action(detail=True, methods=("post",))
    def resubmit(self, request, pk=None):
        obj = services.update_or_resubmit_advance_request(self.get_object(), request.data, request)
        payload = dict(self.get_serializer(obj).data)
        payload["message"] = "Đã gửi đề nghị quyết toán tạm ứng lên cấp duyệt."
        return Response(payload)

    @action(detail=True, methods=("post",), url_path="retry-sync")
    def retry_sync(self, request, pk=None):
        obj = services.retry_sync_advance_settlement_request(self.get_object(), request)
        payload = dict(self.get_serializer(obj).data)
        payload["message"] = f"Đã đồng bộ thành công đề nghị {obj.number} sang danh sách quyết toán."
        return Response(payload)

    @action(detail=True, methods=("post",), url_path="inherit-to-settlement")
    def inherit_to_settlement(self, request, pk=None):
        obj = services.inherit_advance_request_for_settlement(self.get_object(), request)
        payload = dict(self.get_serializer(obj).data)
        payload["message"] = f"Đã kế thừa đề nghị {obj.number} vào chứng từ quyết toán {obj.settlement_voucher_no}."
        return Response(payload)


class AdvanceSettlementVoucherViewSet(ModelViewSet):
    """
    UC-GL-02: Lập chứng từ quyết toán tạm ứng (Advance Settlement Voucher).
    Lưu chứng từ quyết toán tạm ứng ở trạng thái Chưa ghi sổ (UNPOSTED), hỗ trợ
    kế thừa từ đề nghị đã duyệt (UC-GL-01), quyết toán theo từng lần tạm ứng,
    kê khai hóa đơn & thuế GTGT (tách dòng hoặc gộp hóa đơn), đính kèm tệp <= 5MB,
    Lưu / Lưu và Thêm, và sửa chứng từ khi chưa ghi sổ.
    """

    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.AdvanceSettlementVoucherSerializer
    queryset = models.AdvanceSettlementVoucher.objects.select_related(
        "company",
        "branch",
        "period",
        "employee",
        "department",
        "advance_request",
        "cash_advance",
        "journal_entry",
        "created_by",
    ).prefetch_related(
        "accounting_lines__debit_account",
        "accounting_lines__credit_account",
        "accounting_lines__department",
        "tax_lines__tax_account",
        "tax_lines__credit_account",
    )
    iam_permissions = permissions("GL.ADVANCE_SETTLEMENT")
    action_permissions = {
        "next_number": "GL.ADVANCE_SETTLEMENT.VIEW",
        "post": "GL.ADVANCE_SETTLEMENT.POST",
        "unpost": "GL.ADVANCE_SETTLEMENT.UNPOST",
    }
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = (
        "number",
        "description",
        "employee__full_name",
        "employee__employee_code",
        "advance_request__number",
        "source_advance_ref",
    )
    ordering_fields = ("posting_date", "document_date", "total_amount", "created_at", "number")
    ordering = ("-posting_date", "-created_at")

    def _resolve_company(self, request):
        company_id = (
            request.query_params.get("company_id")
            or request.data.get("company")
            or request.data.get("company_id")
        )
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Vui lòng chọn doanh nghiệp làm việc."})
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})
        return company

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id and getattr(self, "kwargs", {}).get("pk"):
            company_id = (
                models.AdvanceSettlementVoucher.objects.filter(pk=self.kwargs["pk"])
                .values_list("company_id", flat=True)
                .first()
            )
        if not company_id:
            return self.queryset.none()
        qs = self.queryset.filter(company_id=company_id)
        for param, field in (
            ("status", "status"),
            ("employee_id", "employee_id"),
            ("department_id", "department_id"),
            ("advance_request_id", "advance_request_id"),
            ("cash_advance_id", "cash_advance_id"),
            ("period_id", "period_id"),
        ):
            val = self.request.query_params.get(param)
            if val:
                qs = qs.filter(**{field: val})
        return qs

    def create(self, request, *args, **kwargs):
        company = self._resolve_company(request)
        voucher, created = services.create_advance_settlement_voucher(company, request.data, request)
        payload = dict(self.get_serializer(voucher).data)
        payload["message"] = f"Đã lưu chứng từ quyết toán tạm ứng {voucher.number} thành công."
        payload["duplicate_prevented"] = not created
        if request.data.get("save_and_new") or request.data.get("saveAndNew"):
            payload["next_number"] = services.next_advance_settlement_voucher_number(company)
        return Response(
            payload,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        updated = services.update_advance_settlement_voucher(instance, request.data, request)
        payload = dict(self.get_serializer(updated).data)
        payload["message"] = f"Đã lưu chứng từ quyết toán tạm ứng {updated.number} thành công."
        return Response(payload)

    def perform_destroy(self, instance):
        if instance.status != models.AdvanceSettlementVoucherStatus.UNPOSTED or instance.journal_entry.status == models.JournalStatus.POSTED:
            raise drf_serializers.ValidationError(
                "Chứng từ quyết toán tạm ứng đã ghi sổ không được phép xóa trực tiếp."
            )
        req_obj = instance.advance_request
        entry = instance.journal_entry
        services.audit(self.request, instance, "DELETE_ADVANCE_SETTLEMENT_VOUCHER", before=self.get_serializer(instance).data)
        instance.delete()
        if entry:
            entry.delete()
        if req_obj:
            services._update_advance_request_settlement_link(req_obj)

    @action(detail=False, methods=("get",), url_path="next-number")
    def next_number(self, request):
        company = self._resolve_company(request)
        num = services.next_advance_settlement_voucher_number(company)
        return Response({"number": num})

    @action(detail=True, methods=("post",), url_path="post")
    def post(self, request, pk=None):
        voucher = self.get_object()
        updated = services.post_advance_settlement_voucher(voucher, request)
        payload = dict(self.get_serializer(updated).data)
        payload["message"] = f"Đã ghi sổ chứng từ quyết toán tạm ứng {updated.number} thành công."
        return Response(payload)

    @action(detail=True, methods=("post",), url_path="unpost")
    def unpost(self, request, pk=None):
        voucher = self.get_object()
        updated = services.unpost_advance_settlement_voucher(voucher, request)
        payload = dict(self.get_serializer(updated).data)
        payload["message"] = f"Đã bỏ ghi sổ chứng từ quyết toán tạm ứng {updated.number} thành công."
        return Response(payload)


class GeneralBusinessVoucherViewSet(ModelViewSet):
    """
    UC-GL-03 – Lập chứng từ nghiệp vụ khác (NVK00001).
    Hỗ trợ đầy đủ 06 loại nghiệp vụ (01..06), kê khai hóa đơn & thuế GTGT (tách dòng hoặc gộp hóa đơn),
    Cất / Cất và In (EF-38), Nhập từ Excel (AF-16, EF-36, EF-37), và giữ chứng từ ở trạng thái
    Chưa ghi sổ (UNPOSTED) cho tới khi thực hiện Ghi sổ (UC-GL-05).
    """

    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.GeneralBusinessVoucherSerializer
    queryset = models.GeneralBusinessVoucher.objects.select_related(
        "company",
        "period",
        "currency",
        "journal_entry",
        "created_by",
        "updated_by",
    ).prefetch_related(
        "accounting_lines__debit_account",
        "accounting_lines__credit_account",
        "accounting_lines__department",
        "tax_lines__tax_account",
        "tax_lines__credit_account",
    )
    iam_permissions = permissions("GL.GENERAL_VOUCHER")
    action_permissions = {
        "next_number": "GL.GENERAL_VOUCHER.VIEW",
        "business_types": "GL.GENERAL_VOUCHER.VIEW",
        "opening_profit_loss": "GL.GENERAL_VOUCHER.VIEW",
        "import_excel": "GL.GENERAL_VOUCHER.CREATE",
        "post": "GL.GENERAL_VOUCHER.POST",
        "unpost": "GL.GENERAL_VOUCHER.UNPOST",
        "adjust": "GL.GENERAL_VOUCHER.ADJUST",
        "reverse": "GL.GENERAL_VOUCHER.REVERSE",
    }
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = (
        "number",
        "description",
        "business_type_label",
        "references",
    )
    ordering_fields = ("posting_date", "document_date", "total_amount", "created_at", "number")
    ordering = ("-posting_date", "-created_at")

    def _resolve_company(self, request):
        company_id = (
            request.query_params.get("company_id")
            or request.data.get("company")
            or request.data.get("company_id")
        )
        if not company_id:
            raise drf_serializers.ValidationError({"company": "Vui lòng chọn doanh nghiệp làm việc."})
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})
        return company

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id and getattr(self, "kwargs", {}).get("pk"):
            company_id = (
                models.GeneralBusinessVoucher.objects.filter(pk=self.kwargs["pk"])
                .values_list("company_id", flat=True)
                .first()
            )
        if not company_id:
            return self.queryset.none()
        qs = self.queryset.filter(company_id=company_id)
        for param, field in (
            ("status", "status"),
            ("business_type", "business_type"),
            ("period_id", "period_id"),
            ("closing_year", "closing_year"),
        ):
            val = self.request.query_params.get(param)
            if val:
                qs = qs.filter(**{field: val})
        return qs

    def create(self, request, *args, **kwargs):
        company = self._resolve_company(request)
        voucher, created = services.create_general_business_voucher(company, request.data, request)
        payload = dict(self.get_serializer(voucher).data)
        payload["message"] = f"Đã lưu chứng từ nghiệp vụ khác {voucher.number} thành công."
        payload["duplicate_prevented"] = not created

        # AF-15, EF-38: Xử lý 'Cất và In' (Lưu chứng từ trước, sau đó chuẩn bị dữ liệu in; nếu lỗi in thì vẫn giữ chứng từ đã lưu)
        if request.data.get("save_and_print") or request.data.get("saveAndPrint"):
            if request.data.get("simulate_print_error"):
                payload["print_status"] = "PRINT_ERROR"
                payload["print_warning"] = (
                    f"Đã lưu chứng từ nghiệp vụ khác {voucher.number} thành công, "
                    "nhưng dịch vụ tạo biểu mẫu in tạm thời gián đoạn. Bạn có thể in lại từ danh sách chứng từ."
                )
            else:
                payload["print_status"] = "READY_TO_PRINT"
                payload["print_data"] = {
                    "voucher_number": voucher.number,
                    "business_type_label": voucher.business_type_label,
                    "posting_date": str(voucher.posting_date),
                    "document_date": str(voucher.document_date),
                    "description": voucher.description,
                    "total_amount": str(voucher.total_amount),
                }

        return Response(
            payload,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        updated = services.update_general_business_voucher(instance, request.data, request)
        payload = dict(self.get_serializer(updated).data)
        payload["message"] = f"Đã lưu chứng từ nghiệp vụ khác {updated.number} thành công."
        return Response(payload)

    def perform_destroy(self, instance):
        if (
            instance.status != models.GeneralVoucherStatus.UNPOSTED
            or (instance.journal_entry_id and instance.journal_entry.status == models.JournalStatus.POSTED)
        ):
            raise drf_serializers.ValidationError(
                "Chứng từ nghiệp vụ khác đã ghi sổ không được phép xóa trực tiếp."
            )
        entry = instance.journal_entry
        services.audit(
            self.request,
            instance,
            "DELETE_GENERAL_BUSINESS_VOUCHER",
            before=self.get_serializer(instance).data,
        )
        instance.delete()
        if entry:
            entry.delete()

    @action(detail=False, methods=("get",), url_path="next-number")
    def next_number(self, request):
        company = self._resolve_company(request)
        num = services.next_general_business_voucher_number(company)
        return Response({"number": num})

    @action(detail=False, methods=("get",), url_path="business-types")
    def business_types(self, request):
        return Response(list(services.GENERAL_BUSINESS_TYPE_CONFIG.values()))

    @action(detail=False, methods=("get",), url_path="opening-profit-loss")
    def opening_profit_loss(self, request):
        company = self._resolve_company(request)
        raw_year = request.query_params.get("year")
        try:
            year = int(raw_year) if raw_year else timezone.localdate().year
        except (ValueError, TypeError):
            raise drf_serializers.ValidationError({"year": "Năm kết chuyển không hợp lệ."})

        # Tính số dư năm trước trên TK 4212 nếu có phát sinh đã ghi sổ hoặc số dư đầu kỳ
        acc_4212 = models.Account.objects.filter(company=company, code="4212").first()
        suggested_amount = Decimal("0")
        if acc_4212:
            bal_agg = models.AccountBalance.objects.filter(
                company=company,
                account=acc_4212,
                period__fiscal_year=year - 1,
            ).order_by("-period__period_number").first()
            if bal_agg:
                net_credit = (bal_agg.closing_credit or Decimal("0")) - (bal_agg.closing_debit or Decimal("0"))
                suggested_amount = abs(net_credit)

        return Response({
            "year": year,
            "posting_date": f"{year}-01-01",
            "document_date": f"{year}-01-01",
            "description": f"Kết chuyển lãi lỗ đầu năm {year}",
            "lines": [
                {
                    "description": f"Kết chuyển lãi lỗ đầu năm {year}",
                    "debit_account": "4212",
                    "credit_account": "4211",
                    "amount": str(suggested_amount),
                }
            ],
        })

    @action(detail=False, methods=("post",), url_path="import-excel")
    def import_excel(self, request):
        company = self._resolve_company(request)
        created_list = services.import_general_business_vouchers_excel(company, request.data, request)
        serialized = self.get_serializer(created_list, many=True).data
        return Response(
            {
                "count": len(created_list),
                "items": serialized,
                "message": f"Đã nhập thành công {len(created_list)} chứng từ nghiệp vụ khác từ Excel.",
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=("post",), url_path="post")
    def post(self, request, pk=None):
        voucher = self.get_object()
        updated = services.post_general_business_voucher(voucher, request)
        payload = dict(self.get_serializer(updated).data)
        payload["message"] = f"Đã ghi sổ chứng từ nghiệp vụ khác {updated.number} thành công."
        return Response(payload)

    @action(detail=True, methods=("post",), url_path="unpost")
    def unpost(self, request, pk=None):
        voucher = self.get_object()
        updated = services.unpost_general_business_voucher(voucher, request)
        payload = dict(self.get_serializer(updated).data)
        payload["message"] = f"Đã bỏ ghi sổ chứng từ nghiệp vụ khác {updated.number} thành công."
        return Response(payload)

    @action(detail=True, methods=("post",), url_path="adjust")
    def adjust(self, request, pk=None):
        voucher = self.get_object()
        adj_entry = services.adjust_general_business_voucher(voucher, request)
        payload = dict(serializers.JournalEntrySerializer(adj_entry).data)
        payload["message"] = "Đã tạo bút toán điều chỉnh thành công."
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="reverse")
    def reverse(self, request, pk=None):
        voucher = self.get_object()
        rev_entry = services.reverse_general_business_voucher(voucher, request)
        payload = dict(serializers.JournalEntrySerializer(rev_entry).data)
        payload["message"] = "Đã tạo bút toán đảo thành công."
        return Response(payload, status=status.HTTP_201_CREATED)


class SubledgerPostingRuleViewSet(ModelViewSet):
    """
    UC-GL-04 (AF-02, BR-GL-INT-11..13):
    Quản lý quy tắc định khoản cho bút toán tiếp nhận từ các phân hệ nguồn.
    """

    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.SubledgerPostingRuleSerializer
    queryset = models.SubledgerPostingRule.objects.select_related(
        "company", "debit_account", "credit_account", "tax_account"
    ).all()
    iam_permissions = {
        **permissions("GL.SUBLEDGER_INGESTION"),
        "create": "GL.SUBLEDGER_INGESTION.EDIT",
        "update": "GL.SUBLEDGER_INGESTION.EDIT",
        "partial_update": "GL.SUBLEDGER_INGESTION.EDIT",
        "destroy": "GL.SUBLEDGER_INGESTION.EDIT",
    }
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("name", "source_module", "source_business_type", "debit_account__code", "credit_account__code")
    ordering_fields = ("source_module", "source_business_type", "created_at")

    def get_queryset(self):
        company_id = (
            self.request.query_params.get("company_id")
            or self.request.query_params.get("company")
        )
        qs = self.queryset
        if company_id:
            qs = qs.filter(company_id=company_id)
        for param in ("source_module", "source_business_type", "posting_mode", "is_active"):
            val = self.request.query_params.get(param)
            if val is not None and val != "":
                if param == "is_active":
                    qs = qs.filter(is_active=str(val).lower() in ("true", "1", "yes"))
                else:
                    qs = qs.filter(**{param: val})
        return qs


class SubledgerJournalIngestionViewSet(ModelViewSet):
    """
    UC-GL-04 – Tiếp nhận bút toán từ các phân hệ (PUR, AP, SAL, AR, CASH, BANK, INV, FA, TOOLS, PAYROLL, TAX, COST).
    Hỗ trợ tiếp nhận idempotent theo source_event_id, tự động ghi sổ / chưa ghi sổ / workflow,
    lưu log lỗi ERROR và thử lại (retry), đồng bộ lại callback phân hệ nguồn, và truy vết hai chiều.
    """

    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.SubledgerJournalIngestionSerializer
    queryset = (
        models.SubledgerJournalIngestion.objects.select_related(
            "company",
            "period",
            "currency",
            "primary_journal_entry",
            "posting_rule",
            "created_by",
            "updated_by",
        )
        .prefetch_related("journal_entries__lines__account")
        .all()
    )
    iam_permissions = permissions("GL.SUBLEDGER_INGESTION")
    action_permissions = {
        "ingest": "GL.SUBLEDGER_INGESTION.CREATE",
        "retry": "GL.SUBLEDGER_INGESTION.RETRY",
        "retry_callback": "GL.SUBLEDGER_INGESTION.RETRY",
        "sync_unposted": "GL.SUBLEDGER_INGESTION.EDIT",
        "post_entry": "GL.SUBLEDGER_INGESTION.POST",
        "unpost_entry": "GL.SUBLEDGER_INGESTION.UNPOST",
        "trace": "GL.SUBLEDGER_INGESTION.VIEW",
        "default_rules": "GL.SUBLEDGER_INGESTION.VIEW",
    }
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = (
        "source_document_number",
        "source_document_id",
        "source_event_id",
        "source_business_type",
        "description",
        "primary_journal_entry__number",
    )
    ordering_fields = ("posting_date", "document_date", "created_at", "total_debit", "source_document_number")
    ordering = ("-posting_date", "-created_at")

    def get_queryset(self):
        company_id = (
            self.request.query_params.get("company_id")
            or self.request.query_params.get("company")
        )
        if not company_id and getattr(self, "kwargs", {}).get("pk"):
            company_id = (
                models.SubledgerJournalIngestion.objects.filter(pk=self.kwargs["pk"])
                .values_list("company_id", flat=True)
                .first()
            )
        qs = self.queryset
        if company_id:
            qs = qs.filter(company_id=company_id)
        for param in (
            "source_module",
            "source_business_type",
            "source_document_type",
            "source_document_id",
            "source_document_number",
            "source_event_id",
            "status",
            "posting_mode",
            "callback_status",
            "period",
        ):
            val = self.request.query_params.get(param)
            if val:
                qs = qs.filter(**{param: val})
        return qs

    def _resolve_company(self, request):
        cid = (
            request.data.get("company")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
            or getattr(request, "company_id", None)
        )
        if cid:
            comp = Company.objects.filter(pk=cid).first()
            if not comp:
                raise drf_serializers.ValidationError(
                    {"company": "EF-03: Doanh nghiệp nguồn không tồn tại trong hệ thống."}
                )
            return comp
        comp = Company.objects.filter(status="ACTIVE").order_by("created_at").first() or Company.objects.order_by("created_at").first()
        if not comp:
            raise drf_serializers.ValidationError({"company": "EF-03: Không xác định được doanh nghiệp."})
        return comp

    def _build_ingestion_response(self, ingestion, created):
        payload = dict(self.get_serializer(ingestion).data)
        payload["idempotent_reused"] = not created
        if not created:
            payload["message"] = (
                f"Sự kiện hạch toán '{ingestion.source_event_id}' đã được xử lý trước đó "
                f"(Trạng thái: {ingestion.status}). Hệ thống trả về kết quả hiện có để chống trùng lặp."
            )
        elif ingestion.status == models.SubledgerIngestionStatus.POSTED:
            payload["message"] = (
                f"Đã tiếp nhận và tự động ghi sổ thành công bút toán {ingestion.primary_journal_entry.number if ingestion.primary_journal_entry else ''} "
                f"từ phân hệ {ingestion.source_module} ({ingestion.source_document_number})."
            )
        elif ingestion.status == models.SubledgerIngestionStatus.UNPOSTED:
            payload["message"] = (
                f"Đã tiếp nhận bút toán {ingestion.primary_journal_entry.number if ingestion.primary_journal_entry else ''} "
                f"từ phân hệ {ingestion.source_module} ({ingestion.source_document_number}) ở trạng thái chưa ghi sổ."
            )
        else:
            payload["message"] = f"Tiếp nhận sự kiện '{ingestion.source_event_id}' hoàn tất với trạng thái {ingestion.status}."
        if ingestion.callback_status == models.SubledgerCallbackStatus.FAILED:
            payload["warning"] = ingestion.callback_error
        return Response(
            payload,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        company = self._resolve_company(request)
        ingestion, created = services.ingest_subledger_journal_event(company, request.data, request)
        return self._build_ingestion_response(ingestion, created)

    @action(detail=False, methods=("post",), url_path="ingest")
    def ingest(self, request):
        company = self._resolve_company(request)
        ingestion, created = services.ingest_subledger_journal_event(company, request.data, request)
        return self._build_ingestion_response(ingestion, created)

    @action(detail=True, methods=("post",), url_path="retry")
    def retry(self, request, pk=None):
        instance = self.get_object()
        updated, created = services.retry_subledger_journal_ingestion(instance, request.data, request)
        return self._build_ingestion_response(updated, created)

    @action(detail=True, methods=("post",), url_path="retry-callback")
    def retry_callback(self, request, pk=None):
        instance = self.get_object()
        updated = services.retry_subledger_source_callback(instance, request)
        payload = dict(self.get_serializer(updated).data)
        payload["message"] = (
            f"Đã đồng bộ lại trạng thái phản hồi về phân hệ nguồn {updated.source_module} "
            f"cho chứng từ {updated.source_document_number}."
        )
        return Response(payload)

    @action(detail=True, methods=("post",), url_path="sync-unposted")
    def sync_unposted(self, request, pk=None):
        instance = self.get_object()
        updated = services.sync_unposted_subledger_entry(instance, request.data, request)
        payload = dict(self.get_serializer(updated).data)
        payload["message"] = (
            f"Đã đồng bộ thay đổi từ chứng từ nguồn {updated.source_document_number} "
            f"(Trạng thái hiện tại: {updated.status})."
        )
        return Response(payload)

    @action(detail=True, methods=("post",), url_path="post")
    def post_entry(self, request, pk=None):
        instance = self.get_object()
        updated = services.post_subledger_ingestion_entry(instance, request)
        payload = dict(self.get_serializer(updated).data)
        payload["message"] = (
            f"Đã ghi sổ chính thức bút toán {updated.primary_journal_entry.number if updated.primary_journal_entry else ''} "
            f"vào Sổ cái."
        )
        return Response(payload)

    @action(detail=True, methods=("post",), url_path="unpost")
    def unpost_entry(self, request, pk=None):
        instance = self.get_object()
        updated = services.unpost_subledger_ingestion_entry(instance, request)
        payload = dict(self.get_serializer(updated).data)
        payload["message"] = (
            f"Đã bỏ ghi sổ bút toán {updated.primary_journal_entry.number if updated.primary_journal_entry else ''} "
            f"khỏi Sổ cái."
        )
        return Response(payload)

    @action(detail=False, methods=("get",), url_path="trace")
    def trace(self, request):
        company = self._resolve_company(request)
        results = services.trace_subledger_source_link(company, request.query_params)
        return Response({"count": len(results), "results": results})

    @action(detail=False, methods=("get",), url_path="default-rules")
    def default_rules(self, request):
        rules = []
        for (mod, btype), cfg in services.DEFAULT_SUBLEDGER_POSTING_RULES.items():
            rules.append({
                "source_module": mod,
                "source_module_label": dict(models.SubledgerSourceModule.choices).get(mod, mod),
                "source_business_type": btype,
                "name": cfg["name"],
                "debit_account_code": cfg["debit_code"],
                "credit_account_code": cfg["credit_code"],
                "tax_account_code": cfg.get("tax_code") or "",
                "posting_mode": cfg["posting_mode"],
            })
        return Response({
            "modules": [
                {"code": code, "label": label}
                for code, label in models.SubledgerSourceModule.choices
            ],
            "default_rules": rules,
        })

    def perform_destroy(self, instance):
        if instance.status == models.SubledgerIngestionStatus.POSTED or (
            instance.primary_journal_entry_id
            and instance.primary_journal_entry.status == "POSTED"
        ):
            raise drf_serializers.ValidationError(
                "EF-26 / BR-GL-INT-50: Bút toán tiếp nhận từ phân hệ đã ghi sổ vào Sổ cái, không được phép xóa trực tiếp."
            )
        entries = list(instance.journal_entries.all())
        if instance.primary_journal_entry and instance.primary_journal_entry not in entries:
            entries.insert(0, instance.primary_journal_entry)
        services.audit(
            self.request,
            instance,
            "DELETE_SUBLEDGER_INGESTION",
            before=self.get_serializer(instance).data,
        )
        instance.delete()
        for e in entries:
            if e.status != "POSTED":
                e.lines.all().delete()
                e.delete()


class ForeignCurrencyRevaluationRuleViewSet(CompanyViewSet):
    """
    UC-GL-08 (BR-GL-FX-04, 05, 19..23, 29..33):
    Quản lý quy tắc cấu hình đánh giá lại tài khoản ngoại tệ và tài khoản xử lý chênh lệch tỷ giá.
    """

    queryset = models.ForeignCurrencyRevaluationRule.objects.select_related(
        "company",
        "target_account",
        "fx_difference_account",
        "fx_gain_account",
        "fx_loss_account",
        "rate_type",
    )
    serializer_class = serializers.ForeignCurrencyRevaluationRuleSerializer
    iam_permissions = permissions("GL.REVALUATION")
    search_fields = ("code", "name", "account_prefix", "description")
    ordering_fields = ("sequence", "code", "created_at")
    ordering = ("sequence", "code")

    def get_queryset(self):
        qs = super().get_queryset()
        item_group = self.request.query_params.get("item_group")
        if item_group:
            qs = qs.filter(item_group=item_group.upper())
        is_active = self.request.query_params.get("is_active")
        if is_active is not None and is_active != "":
            qs = qs.filter(is_active=str(is_active).lower() in ("true", "1", "yes"))
        return qs


class ForeignCurrencyRevaluationRunViewSet(CompanyViewSet):
    """
    UC-GL-08 – Đánh giá lại tài khoản ngoại tệ cuối kỳ.
    Hỗ trợ lấy số dư khoản mục tiền tệ ngoại tệ (fetch-balances), tính chênh lệch tỷ giá (calculate),
    xác nhận lập chứng từ UNPOSTED (confirm / create), ghi sổ (post), bỏ ghi (unpost),
    đảo bút toán (reverse), hủy đợt chưa ghi sổ (cancel), và truy vết hai chiều (trace).
    """

    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.ForeignCurrencyRevaluationRunSerializer
    queryset = (
        models.ForeignCurrencyRevaluationRun.objects.select_related(
            "company",
            "period",
            "currency",
            "fx_difference_account",
            "fx_gain_account",
            "fx_loss_account",
            "entry",
            "reversal_entry",
            "created_by",
        )
        .prefetch_related(
            "lines__account",
            "lines__fx_difference_account",
            "lines__debit_account",
            "lines__credit_account",
            "lines__currency",
            "lines__party",
            "lines__department",
            "lines__project",
            "lines__cost_center",
        )
    )
    iam_permissions = {
        **permissions("GL.REVALUATION"),
        "POST": "GL.REVALUATION.RUN",
    }
    action_permissions = {
        "fetch_balances": "GL.REVALUATION.VIEW",
        "calculate": "GL.REVALUATION.VIEW",
        "confirm": "GL.REVALUATION.RUN",
        "post_entry": "GL.JOURNAL.POST",
        "unpost_entry": "GL.JOURNAL.UNPOST",
        "reverse_entry": "GL.JOURNAL.REVERSE",
        "cancel": "GL.REVALUATION.RUN",
        "trace": "GL.REVALUATION.VIEW",
    }
    search_fields = ("number", "description", "idempotency_key", "currency__code")
    ordering_fields = ("posting_date", "revaluation_date", "created_at", "net_difference", "number")
    ordering = ("-posting_date", "-created_at")

    def _resolve_company(self, request):
        comp_id = (
            request.data.get("company")
            or request.data.get("company_id")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            return Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})

    def get_queryset(self):
        qs = super().get_queryset()
        period_id = self.request.query_params.get("period") or self.request.query_params.get("period_id")
        if period_id:
            qs = qs.filter(period_id=period_id)
        currency_param = self.request.query_params.get("currency") or self.request.query_params.get("currency_id")
        if currency_param:
            if len(str(currency_param)) <= 10 and not "-" in str(currency_param):
                qs = qs.filter(currency__code__iexact=str(currency_param).strip())
            else:
                qs = qs.filter(currency_id=currency_param)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())
        account_scope = self.request.query_params.get("account_scope")
        if account_scope:
            qs = qs.filter(account_scope=account_scope.upper())
        return qs

    def create(self, request, *args, **kwargs):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        run = services.create_fx_revaluation_voucher(company, payload, request=request)
        return Response(self.get_serializer(run).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == "POSTED":
            raise drf_serializers.ValidationError(
                {
                    "status": "Chứng từ đánh giá lại ngoại tệ đã ghi sổ (POSTED), không được phép sửa trực tiếp (EF-29, BR-GL-FX-69).",
                    "error_code": "CANNOT_EDIT_POSTED_FX_REVALUATION",
                }
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == "POSTED":
            raise drf_serializers.ValidationError(
                {
                    "status": "Chứng từ đánh giá lại ngoại tệ đã ghi sổ (POSTED), không được phép xóa trực tiếp (EF-29, BR-GL-FX-69).",
                    "error_code": "CANNOT_DELETE_POSTED_FX_REVALUATION",
                }
            )
        services.cancel_fx_revaluation_run(instance, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=("post",), url_path="fetch-balances")
    def fetch_balances(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        res = services.fetch_fx_revaluation_balances(company, payload, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",))
    def calculate(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        res = services.calculate_fx_revaluation(company, payload, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=("post",))
    def confirm(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        run = services.create_fx_revaluation_voucher(company, payload, request=request)
        return Response(self.get_serializer(run).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="post")
    def post_entry(self, request, pk=None):
        run = self.get_object()
        if not run.entry_id:
            raise drf_serializers.ValidationError({"entry": "Đợt đánh giá lại chưa sinh chứng từ kế toán."})
        services.post(run.entry, request)
        run.refresh_from_db()
        return Response(self.get_serializer(run).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="unpost")
    def unpost_entry(self, request, pk=None):
        run = self.get_object()
        if not run.entry_id:
            raise drf_serializers.ValidationError({"entry": "Đợt đánh giá lại không có bút toán liên kết."})
        services.unpost(run.entry, request)
        run.refresh_from_db()
        return Response(self.get_serializer(run).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",), url_path="reverse")
    def reverse_entry(self, request, pk=None):
        run = self.get_object()
        if not run.entry_id:
            raise drf_serializers.ValidationError({"entry": "Đợt đánh giá lại không có bút toán liên kết."})
        if isinstance(request.data, dict):
            if "posting_date" not in request.data and "postingDate" not in request.data:
                request.data["posting_date"] = str(run.posting_date)
            if "auto_post" not in request.data and "autoPost" not in request.data:
                request.data["auto_post"] = True
        rev_entry = services.reverse(run.entry, request)
        run.refresh_from_db()
        data = self.get_serializer(run).data
        data["reversal_entry_detail"] = serializers.JournalEntrySerializer(rev_entry).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        run = self.get_object()
        run = services.cancel_fx_revaluation_run(run, request=request)
        return Response(self.get_serializer(run).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("get",))
    def trace(self, request, pk=None):
        run = self.get_object()
        return Response(services.trace_fx_revaluation_run(run), status=status.HTTP_200_OK)


class FinancialStatementMappingRuleViewSet(CompanyViewSet):
    """
    UC-GL-13 (Section 1.1.E, AF-14, BR-GL-FS-07..15, 53..59):
    API quản lý cấu hình quy tắc ánh xạ (Mapping) chỉ tiêu Báo cáo tài chính theo Thông tư 99/2025/TT-BTC.
    """

    serializer_class = serializers.FinancialStatementMappingRuleSerializer
    queryset = models.FinancialStatementMappingRule.objects.select_related("company")
    iam_permissions = {
        "GET": "GL.BALANCE.VIEW",
        "POST": "GL.CLOSING.RUN",
        "PUT": "GL.CLOSING.RUN",
        "PATCH": "GL.CLOSING.RUN",
        "DELETE": "GL.CLOSING.RUN",
    }
    action_permissions = {
        "seed_defaults": "GL.BALANCE.VIEW",
    }
    search_fields = ("form_code", "indicator_code", "indicator_name", "note_ref", "formula_expression")
    ordering_fields = ("form_code", "sequence", "indicator_code", "created_at")
    ordering = ("form_code", "cash_flow_method", "sequence", "indicator_code")

    def _resolve_company(self, request):
        comp_id = (
            request.data.get("company")
            or request.data.get("company_id")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            return Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})

    def get_queryset(self):
        qs = super().get_queryset()
        form_code = self.request.query_params.get("form_code")
        if form_code:
            qs = qs.filter(form_code=form_code.strip())
        cf_method = self.request.query_params.get("cash_flow_method")
        if cf_method:
            qs = qs.filter(cash_flow_method=cf_method.strip().upper())
        mapping_version = self.request.query_params.get("mapping_version")
        if mapping_version:
            qs = qs.filter(mapping_version=mapping_version.strip())
        return qs

    @action(detail=False, methods=("post",), url_path="seed-defaults")
    def seed_defaults(self, request):
        company = self._resolve_company(request)
        mapping_version = str(request.data.get("mapping_version") or "TT99-2025-V1").strip()
        rules = services.seed_default_financial_statement_mappings(
            company, mapping_version=mapping_version, request=request
        )
        return Response(self.get_serializer(rules, many=True).data, status=status.HTTP_200_OK)


class FinancialStatementBatchViewSet(CompanyViewSet):
    """
    UC-GL-13 – Lập Báo cáo tài chính (Financial Statement Preparation under Circular 99/2025/TT-BTC).
    Hỗ trợ:
    - Kiểm tra điều kiện nguồn trước khi lập (`precheck`)
    - Lập bộ Báo cáo tài chính năm / giữa niên độ / thuyết minh (`generate` / `create`)
    - Cập nhật thông tin chung & thuyết minh bổ sung B09 (`update-notes`)
    - Chốt phiên bản BCTC chính thức (`finalize`)
    - Truy vết ngược từ dòng chỉ tiêu xuống Tài khoản -> Bút toán POSTED -> Chứng từ nguồn (`drilldown`)
    - Xuất / In bộ BCTC theo đúng phiên bản đã chọn (`export`)
    """

    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.FinancialStatementBatchSerializer
    queryset = (
        models.FinancialStatementBatch.objects.select_related(
            "company",
            "branch",
            "period",
            "comparison_period",
            "presentation_currency",
            "inherited_from_batch",
            "finalized_by",
            "created_by",
        )
        .prefetch_related("reports__lines")
    )
    iam_permissions = {
        "GET": "GL.BALANCE.VIEW",
        "POST": "GL.BALANCE.VIEW",
        "PUT": "GL.BALANCE.VIEW",
        "PATCH": "GL.BALANCE.VIEW",
        "DELETE": "GL.CLOSING.RUN",
    }
    action_permissions = {
        "precheck": "GL.BALANCE.VIEW",
        "generate": "GL.BALANCE.VIEW",
        "update_notes": "GL.BALANCE.VIEW",
        "finalize": "GL.CLOSING.RUN",
        "drilldown": "GL.BALANCE.VIEW",
        "export": "GL.BALANCE.VIEW",
    }
    search_fields = ("batch_number", "period_label", "report_group", "status")
    ordering_fields = ("fiscal_year", "version_number", "created_at", "status")
    ordering = ("-fiscal_year", "-version_number", "-created_at")

    def _resolve_company(self, request):
        comp_id = (
            request.data.get("company")
            or request.data.get("company_id")
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            return Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})

    def get_queryset(self):
        qs = super().get_queryset()
        report_group = self.request.query_params.get("report_group")
        if report_group:
            qs = qs.filter(report_group=report_group.strip().upper())
        fiscal_year = self.request.query_params.get("fiscal_year") or self.request.query_params.get("year")
        if fiscal_year:
            qs = qs.filter(fiscal_year=int(fiscal_year))
        period_id = self.request.query_params.get("period") or self.request.query_params.get("period_id")
        if period_id:
            qs = qs.filter(period_id=period_id)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.strip().upper())
        return qs

    def create(self, request, *args, **kwargs):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        batch = services.generate_financial_statements(company, payload, request=request)
        return Response(self.get_serializer(batch).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("post",), url_path="generate")
    def generate(self, request):
        company = self._resolve_company(request)
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        batch = services.generate_financial_statements(company, payload, request=request)
        return Response(self.get_serializer(batch).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("get", "post"), url_path="precheck")
    def precheck(self, request):
        company = self._resolve_company(request)
        payload = {}
        payload.update(request.query_params.dict())
        if isinstance(request.data, dict):
            payload.update(request.data)
        dates_info = services._resolve_reporting_dates_and_periods(company, payload)
        res = services.evaluate_financial_statement_prechecks(
            company,
            dates_info["period"],
            dates_info["from_date"],
            dates_info["to_date"],
            data=payload,
            request=request,
        )
        res["unclosed_pnl"] = str(res["unclosed_pnl"])
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post", "patch"), url_path="update-notes")
    def update_notes(self, request, pk=None):
        batch = self.get_object()
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        updated = services.update_financial_statement_notes(batch, payload, request=request)
        return Response(self.get_serializer(updated).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post",))
    def finalize(self, request, pk=None):
        batch = self.get_object()
        payload = dict(request.data) if isinstance(request.data, dict) else request.data.dict()
        finalized = services.finalize_financial_statement_batch(batch, payload, request=request)
        return Response(self.get_serializer(finalized).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=("get", "post"), url_path="drilldown")
    def drilldown(self, request, pk=None):
        batch = self.get_object()
        params = {}
        params.update(request.query_params.dict())
        if isinstance(request.data, dict):
            params.update(request.data)
        res = services.drilldown_financial_statement_line(batch, params, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=True, methods=("get", "post"), url_path="export")
    def export(self, request, pk=None):
        batch = self.get_object()
        params = {}
        params.update(request.query_params.dict())
        if isinstance(request.data, dict):
            params.update(request.data)
        res = services.export_financial_statement_batch(batch, params=params, request=request)
        return Response(res, status=status.HTTP_200_OK)


class LedgerInquiryAndTraceViewSet(GenericViewSet):
    """
    UC-GL-14 – Tra cứu Sổ cái / Nhật ký / truy vết chứng từ
    (General Ledger & Journal Inquiry, Accounting Books under Circular 99/2025/TT-BTC
     & End-to-End Bidirectional Voucher Traceability).
    Hỗ trợ:
    - Danh mục các loại sổ & chế độ tra cứu (`catalog`)
    - Tra cứu Sổ nhật ký chung, Sổ cái, Sổ chi tiết, Bảng cân đối, Nhật ký thu/chi/mua/bán, Sổ ngoại tệ, Bút toán GL (`query` / `list`)
    - Truy vết chuỗi Sổ/Báo cáo ↔ Dòng phát sinh ↔ Bút toán GL (kèm chuỗi Điều chỉnh/Đảo) ↔ Chứng từ nghiệp vụ nguồn (`trace`)
    - In & Xuất dữ liệu Sổ kế toán theo đúng bộ lọc và Data Scope (`export`)
    """

    permission_classes = (GeneralLedgerPermission,)
    iam_permissions = {
        "GET": "GL.BALANCE.VIEW",
        "POST": "GL.BALANCE.VIEW",
    }
    action_permissions = {
        "catalog": "GL.BALANCE.VIEW",
        "query": "GL.BALANCE.VIEW",
        "trace": "GL.BALANCE.VIEW",
        "export": "GL.BALANCE.VIEW",
    }

    def _resolve_company(self, request):
        comp_id = (
            (request.data.get("company") if isinstance(request.data, dict) else None)
            or (request.data.get("company_id") if isinstance(request.data, dict) else None)
            or request.query_params.get("company_id")
            or request.query_params.get("company")
        )
        if not comp_id:
            first_co = Company.objects.order_by("created_at").first()
            if first_co:
                return first_co
            raise drf_serializers.ValidationError({"company": "Thiếu thông tin doanh nghiệp (company)."})
        try:
            return Company.objects.get(pk=comp_id)
        except (Company.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"company": "Doanh nghiệp không tồn tại."})

    def _extract_params(self, request):
        params = {}
        for k, v in request.query_params.items():
            params[k] = v
        if isinstance(request.data, dict):
            params.update(request.data)
        return params

    def list(self, request):
        company = self._resolve_company(request)
        params = self._extract_params(request)
        res = services.query_accounting_book_uc_gl_14(company, params=params, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="catalog")
    def catalog(self, request):
        return Response(
            {
                "books": list(services.BOOK_TYPE_CATALOG_UC_GL_14.values()),
                "trace_statuses": [
                    {"code": "TRACEABLE", "label": "Có thể truy vết đầy đủ tới chứng từ nguồn"},
                    {"code": "PARTIAL_TRACE", "label": "Truy vết được một phần chuỗi tham chiếu"},
                    {"code": "NO_SOURCE", "label": "Bút toán tổng hợp trực tiếp tại GL (không qua chứng từ phân hệ)"},
                    {"code": "BROKEN_LINK", "label": "Bút toán yêu cầu nguồn nhưng thiếu / đứt liên kết chứng từ nguồn"},
                    {"code": "ACCESS_RESTRICTED", "label": "Có chứng từ nguồn nhưng người dùng không có quyền xem phân hệ nguồn"},
                ],
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=("get", "post"), url_path="query")
    def query(self, request):
        company = self._resolve_company(request)
        params = self._extract_params(request)
        res = services.query_accounting_book_uc_gl_14(company, params=params, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="trace")
    def trace(self, request):
        company = self._resolve_company(request)
        params = self._extract_params(request)
        res = services.trace_gl_entry_and_source_voucher_uc_gl_14(company, params=params, request=request)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get", "post"), url_path="export")
    def export(self, request):
        company = self._resolve_company(request)
        params = self._extract_params(request)
        res = services.export_accounting_book_uc_gl_14(company, params=params, request=request)
        return Response(res, status=status.HTTP_200_OK)



