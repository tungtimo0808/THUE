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
        """Khởi tạo hệ thống tài khoản từ mẫu Thông tư 200 hoặc Thông tư 133 (Main Flow 2.1)."""
        company_id = (
            request.query_params.get("company_id")
            or request.data.get("company_id")
            or request.data.get("company")
        )
        if not company_id:
            return Response({"detail": "Vui lòng chỉ định company_id."}, status=status.HTTP_400_BAD_REQUEST)
        company = get_object_or_404(Company, pk=company_id)
        regime = request.data.get("regime", "TT200")
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
    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.PeriodSerializer
    queryset = models.AccountingPeriod.objects.select_related("company", "closed_by", "reopened_by")
    iam_permissions = permissions("GL.PERIOD")
    action_permissions = {"close": "GL.PERIOD.CLOSE_PERIOD", "reopen": "GL.PERIOD.REOPEN_PERIOD", "aggregate": "GL.BALANCE.AGGREGATE"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()

    def perform_destroy(self, instance):
        if instance.journal_entries.exists():
            raise drf_serializers.ValidationError("Kỳ đã phát sinh bút toán không được xóa.")
        instance.delete()

    @action(detail=True, methods=("post",))
    def close(self, request, pk=None):
        return Response(self.get_serializer(services.close_period(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def reopen(self, request, pk=None):
        return Response(self.get_serializer(services.reopen_period(self.get_object(), request)).data)

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
    queryset = models.JournalEntry.objects.select_related("company", "branch", "period", "created_by", "approved_by", "posted_by", "original_entry").prefetch_related("lines__account")
    serializer_class = serializers.JournalEntrySerializer
    iam_permissions = permissions("GL.JOURNAL")
    action_permissions = {
        "submit": "GL.JOURNAL.SUBMIT", "approve": "GL.JOURNAL.APPROVE", "reject": "GL.JOURNAL.APPROVE",
        "post": "GL.JOURNAL.POST", "reverse": "GL.JOURNAL.REVERSE", "cancel": "GL.JOURNAL.CANCEL",
    }
    search_fields = ("number", "description", "source_module", "source_event_id")
    ordering_fields = ("posting_date", "total_debit", "total_credit", "created_at")
    ordering = ("-created_at",)

    def get_queryset(self):
        queryset = super().get_queryset()
        for field in ("period_id", "status", "entry_type", "source_module", "branch_id"):
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
        if instance.status not in {"DRAFT", "REJECTED"} or instance.period.status == "CLOSED":
            raise drf_serializers.ValidationError("Chỉ bút toán nháp/bị từ chối trong kỳ mở mới được xóa.")
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
    def reverse(self, request, pk=None):
        return Response(self.get_serializer(services.reverse(self.get_object(), request)).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        entry = self.get_object()
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
    iam_permissions = {"GET": "GL.BALANCE.VIEW"}
    action_permissions = {"trial_balance": "GL.BALANCE.VIEW", "ledger": "GL.LEDGER.VIEW"}
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("account__code", "account__name", "period__code")
    ordering_fields = ("account__code", "closing_debit", "closing_credit")

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
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
        company, account = request.query_params.get("company_id"), request.query_params.get("account_id")
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


class AllocationRuleViewSet(CompanyViewSet):
    queryset = models.AllocationRule.objects.select_related("company", "source_account", "offset_account").prefetch_related("destinations")
    serializer_class = serializers.AllocationRuleSerializer
    iam_permissions = permissions("GL.ALLOCATION")
    action_permissions = {"run": "GL.ALLOCATION.RUN"}
    search_fields = ("code", "name")
    ordering = ("code",)

    @action(detail=True, methods=("post",))
    def run(self, request, pk=None):
        try:
            period = models.AccountingPeriod.objects.get(pk=request.data.get("period"), company_id=request.data.get("company"))
        except (models.AccountingPeriod.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"period": "Kỳ kế toán không hợp lệ."})
        obj = services.run_allocation(self.get_object(), period, request.data.get("idempotency_key", ""), request)
        return Response(serializers.AllocationRunSerializer(obj).data, status=status.HTTP_201_CREATED)


class AllocationRunViewSet(ReadOnlyModelViewSet):
    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.AllocationRunSerializer
    queryset = models.AllocationRun.objects.select_related("company", "rule", "period", "entry", "created_by")
    iam_permissions = {"GET": "GL.ALLOCATION.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class ClosingRuleViewSet(CompanyViewSet):
    queryset = models.ClosingRule.objects.select_related("company", "source_account", "destination_account")
    serializer_class = serializers.ClosingRuleSerializer
    iam_permissions = permissions("GL.CLOSING")
    action_permissions = {"run": "GL.CLOSING.RUN"}
    search_fields = ("code", "name")
    ordering_fields = ("sequence", "code")
    ordering = ("sequence", "code")

    @action(detail=True, methods=("post",))
    def run(self, request, pk=None):
        try:
            period = models.AccountingPeriod.objects.get(pk=request.data.get("period"), company_id=request.data.get("company"))
        except (models.AccountingPeriod.DoesNotExist, ValueError):
            raise drf_serializers.ValidationError({"period": "Kỳ kế toán không hợp lệ."})
        obj = services.run_closing(self.get_object(), period, request)
        return Response(serializers.ClosingRunSerializer(obj).data, status=status.HTTP_201_CREATED)


class ClosingRunViewSet(ReadOnlyModelViewSet):
    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.ClosingRunSerializer
    queryset = models.ClosingRun.objects.select_related("company", "rule", "period", "entry", "created_by")
    iam_permissions = {"GET": "GL.CLOSING.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class ReconciliationViewSet(ReadOnlyModelViewSet):
    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.ReconciliationSerializer
    queryset = models.GlReconciliation.objects.select_related("company", "period", "account", "created_by")
    iam_permissions = {"GET": "GL.RECONCILIATION.VIEW"}
    action_permissions = {"run": "GL.RECONCILIATION.RUN", "resolve": "GL.RECONCILIATION.RESOLVE"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()

    @action(detail=False, methods=("post",))
    def run(self, request):
        try:
            period = models.AccountingPeriod.objects.get(pk=request.data.get("period"), company_id=request.data.get("company"))
            account = models.Account.objects.get(pk=request.data.get("account"), company_id=request.data.get("company"))
            amount = Decimal(str(request.data.get("subledger_amount")))
        except (models.AccountingPeriod.DoesNotExist, models.Account.DoesNotExist, ValueError, TypeError):
            raise drf_serializers.ValidationError("Kỳ, tài khoản hoặc số tiền không hợp lệ.")
        obj = services.reconcile(period, account, request.data.get("source_module", ""), amount, request.data.get("details", {}), request)
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def resolve(self, request, pk=None):
        obj = self.get_object()
        if obj.status != "VARIANCE" or not request.data.get("reason", "").strip():
            raise drf_serializers.ValidationError("Chỉ chênh lệch có lý do mới được đánh dấu xử lý.")
        obj.resolved = True
        obj.details = {**obj.details, "resolution": request.data["reason"], "resolved_by": str(services.actor(request).id)}
        obj.save(update_fields=("resolved", "details"))
        services.audit(request, obj, "RESOLVE", after={"resolved": True}, reason=request.data["reason"])
        return Response(self.get_serializer(obj).data)


class ApprovalViewSet(ReadOnlyModelViewSet):
    permission_classes = (GeneralLedgerPermission,)
    serializer_class = serializers.ApprovalSerializer
    queryset = models.JournalApproval.objects.select_related("company", "entry", "actor")
    iam_permissions = {"GET": "GL.APPROVAL.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()
