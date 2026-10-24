from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from django.db import transaction
from decimal import Decimal
from drf_spectacular.utils import extend_schema_serializer

from . import models
from .models import Account, AccountClass, ChartOfAccounts


class ValidatedModelSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance or self.Meta.model()
        for name, value in attrs.items():
            setattr(instance, name, value)
        try:
            instance.full_clean(exclude=[field.name for field in instance._meta.fields if field.null and field.name not in attrs])
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs


class AccountClassSerializer(ValidatedModelSerializer):
    class Meta:
        model = AccountClass
        fields = "__all__"


class ChartOfAccountsSerializer(ValidatedModelSerializer):
    accounts_count = serializers.IntegerField(source="accounts.count", read_only=True)

    class Meta:
        model = ChartOfAccounts
        fields = "__all__"


class AccountSerializer(ValidatedModelSerializer):
    parent_code = serializers.CharField(source="parent.code", read_only=True)
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    children_count = serializers.IntegerField(source="children.count", read_only=True)

    class Meta:
        model = Account
        fields = "__all__"
        read_only_fields = ("version",)

    def validate_code(self, value):
        if self.instance and self.instance.code != value:
            if self.instance.is_system:
                raise serializers.ValidationError("Không được thay đổi số hiệu của tài khoản hệ thống.")
            if self.instance.journal_lines.exists():
                raise serializers.ValidationError("Số hiệu tài khoản đã phát sinh bút toán không được sửa trực tiếp.")
            if self.instance.status == "ACTIVE":
                raise serializers.ValidationError("Không đổi số hiệu trực tiếp; hãy ngừng tài khoản cũ và tạo tài khoản mới.")
        return value

    def validate_account_type(self, value):
        if self.instance and self.instance.account_type != value:
            if self.instance.is_system:
                raise serializers.ValidationError("Không được thay đổi bản chất của tài khoản hệ thống.")
            if self.instance.balances.filter(
                models.Q(closing_debit__gt=0) | models.Q(closing_credit__gt=0) | models.Q(opening_debit__gt=0) | models.Q(opening_credit__gt=0)
            ).exists():
                raise serializers.ValidationError("Không thể thay đổi bản chất tài khoản khi đã có số dư.")
        return value

    def validate_normal_balance(self, value):
        if self.instance and self.instance.normal_balance != value:
            if self.instance.is_system:
                raise serializers.ValidationError("Không được thay đổi tính chất số dư của tài khoản hệ thống.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        parent = attrs.get("parent") or (self.instance.parent if self.instance else None)
        code = attrs.get("code") or (self.instance.code if self.instance else None)
        account_type = attrs.get("account_type") or (self.instance.account_type if self.instance else None)

        if parent:
            if code and not code.startswith(parent.code):
                raise serializers.ValidationError({"code": f"Số hiệu tài khoản con ({code}) phải bắt đầu bằng số hiệu tài khoản cha ({parent.code})."})
            if account_type and account_type != parent.account_type:
                raise serializers.ValidationError({"account_type": f"Bản chất tài khoản con ({account_type}) phải tương thích với tài khoản cha ({parent.account_type})."})

        is_postable = attrs.get("is_postable", self.instance.is_postable if self.instance else True)
        if self.instance and is_postable and self.instance.children.filter(status__in=("ACTIVE", models.AccountStatus.ACTIVE)).exists():
            raise serializers.ValidationError({"is_postable": "Tài khoản có tài khoản con đang hoạt động không được chọn làm tài khoản ghi sổ."})

        return attrs


class PeriodLockHistorySerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True, default="")
    approved_by_username = serializers.CharField(source="approved_by.username", read_only=True, default="")
    period_code = serializers.CharField(source="period.code", read_only=True, default="")
    action_label = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = models.PeriodLockHistory
        fields = "__all__"
        read_only_fields = (
            "id",
            "company",
            "period",
            "checklist",
            "action",
            "lock_scope",
            "lock_to_date",
            "document_types",
            "status_before",
            "status_after",
            "reason",
            "notes",
            "warnings_at_lock",
            "workflow_result",
            "is_auto_lock",
            "actor",
            "approved_by",
            "snapshot",
            "occurred_at",
        )


class PeriodCloseChecklistSerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="period.code", read_only=True, default="")
    created_by_username = serializers.CharField(source="created_by.username", read_only=True, default="")
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = models.PeriodCloseChecklist
        fields = "__all__"
        read_only_fields = (
            "id",
            "company",
            "period",
            "status",
            "can_confirm_close",
            "blocker_count",
            "warning_count",
            "info_count",
            "passed_count",
            "source_watermark",
            "period_version_snapshot",
            "checks",
            "blockers",
            "warnings",
            "infos",
            "created_by",
            "created_at",
        )


@extend_schema_serializer(component_name="GeneralLedgerPeriod")
class PeriodSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    closed_by_username = serializers.CharField(source="closed_by.username", read_only=True, default="")
    reopened_by_username = serializers.CharField(source="reopened_by.username", read_only=True, default="")
    reopen_requested_by_username = serializers.CharField(source="reopen_requested_by.username", read_only=True, default="")
    reopen_approved_by_username = serializers.CharField(source="reopen_approved_by.username", read_only=True, default="")

    class Meta:
        model = models.AccountingPeriod
        fields = "__all__"
        read_only_fields = (
            "id",
            "closed_by",
            "closed_at",
            "reopened_by",
            "reopened_at",
            "reopen_reason",
            "reopen_workflow_status",
            "reopen_requested_by",
            "reopen_requested_at",
            "reopen_approved_by",
            "reopen_approved_at",
            "last_checklist_watermark",
            "last_closed_watermark",
            "version",
        )


class BudgetSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)
    period_code = serializers.CharField(source="period.code", read_only=True)

    class Meta:
        model = models.BudgetLine
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        instance = self.instance
        company = attrs.get("company", instance.company if instance else None)
        for name in ("period", "account", "branch", "department", "project", "cost_center"):
            value = attrs.get(name, getattr(instance, name, None) if instance else None)
            if value and value.company_id != company.id:
                raise serializers.ValidationError({name: "Dữ liệu phải thuộc cùng doanh nghiệp."})
        return attrs


class JournalLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = models.JournalLine
        fields = "__all__"
        read_only_fields = ("id", "entry")


class JournalPostingHistorySerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True, default="")
    action_type = serializers.CharField(source="action", read_only=True)
    from_status = serializers.CharField(source="status_before", read_only=True)
    to_status = serializers.CharField(source="status_after", read_only=True)
    acted_at = serializers.DateTimeField(source="occurred_at", read_only=True)

    class Meta:
        model = models.JournalPostingHistory
        fields = (
            "id",
            "company",
            "entry",
            "action",
            "action_type",
            "status_before",
            "from_status",
            "status_after",
            "to_status",
            "reference",
            "reason",
            "error_code",
            "actor",
            "actor_username",
            "occurred_at",
            "acted_at",
            "snapshot",
        )
        read_only_fields = fields


@extend_schema_serializer(component_name="GeneralLedgerJournalEntry")
class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True)
    period_code = serializers.CharField(source="period.code", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    original_entry_number = serializers.CharField(source="original_entry.number", read_only=True, default="")
    replacement_for_entry_number = serializers.CharField(source="replacement_for_entry.number", read_only=True, default="")
    status_code = serializers.SerializerMethodField()
    remaining_reversible_amount = serializers.SerializerMethodField()
    posting_histories = JournalPostingHistorySerializer(many=True, read_only=True)

    class Meta:
        model = models.JournalEntry
        fields = "__all__"
        read_only_fields = (
            "id", "status", "workflow_snapshot", "total_debit", "total_credit", "created_by",
            "approved_by", "posted_by", "unposted_by", "submitted_at", "approved_at", "posted_at",
            "unposted_at", "posting_reference", "unpost_reference", "unpost_reason",
            "is_adjusted", "reversed_amount", "version",
            "created_at", "updated_at",
        )

    def get_status_code(self, obj):
        if obj.status in ("POSTED", "REVERSED", "CANCELLED"):
            return obj.status
        return "UNPOSTED"

    def get_remaining_reversible_amount(self, obj):
        rem = max(Decimal("0"), (obj.total_debit or Decimal("0")) - (obj.reversed_amount or Decimal("0")))
        return str(rem)

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.status not in {"DRAFT", "REJECTED"}:
            raise serializers.ValidationError("Chỉ bút toán nháp hoặc bị từ chối mới được sửa (BR-GL-ADJ-01).")
        if instance and instance.original_entry_id and "original_entry" in attrs and attrs["original_entry"] != instance.original_entry:
            raise serializers.ValidationError({"original_entry": "Không được xóa hoặc thay đổi tham chiếu bút toán gốc trên chứng từ sửa sai (BR-GL-ADJ-10, 13)."})
        company = attrs.get("company", instance.company if instance else None)
        period = attrs.get("period", instance.period if instance else None)
        posting_date = attrs.get("posting_date", instance.posting_date if instance else None)
        branch = attrs.get("branch", instance.branch if instance else None)
        orig_entry = attrs.get("original_entry", instance.original_entry if instance else None)
        repl_entry = attrs.get("replacement_for_entry", instance.replacement_for_entry if instance else None)
        if orig_entry and orig_entry.company_id != company.id:
            raise serializers.ValidationError({"original_entry": "Bút toán gốc phải thuộc cùng doanh nghiệp (BR-GL-ADJ-76)."})
        if repl_entry and repl_entry.company_id != company.id:
            raise serializers.ValidationError({"replacement_for_entry": "Bút toán thay thế phải thuộc cùng doanh nghiệp (BR-GL-ADJ-76)."})
        if period.company_id != company.id or not period.start_date <= posting_date <= period.end_date:
            raise serializers.ValidationError("Ngày hạch toán không thuộc kỳ kế toán được chọn.")
        entry_type_val = attrs.get("entry_type", instance.entry_type if instance else "MANUAL")
        src_mod_val = (attrs.get("source_module", instance.source_module if instance else "") or "").upper()
        num_val = str(attrs.get("number", instance.number if instance else "") or "").upper()
        if entry_type_val == "CLOSING":
            doc_code = "KCLL"
        elif num_val.startswith("QT"):
            doc_code = "QTU"
        elif src_mod_val == "CASH":
            doc_code = "PT" if num_val.startswith("PT") else "PC"
        elif src_mod_val == "BANK":
            doc_code = "BC" if num_val.startswith("BC") else "BN"
        elif src_mod_val in ("SAL", "AR"):
            doc_code = "HDBH"
        else:
            doc_code = "PKT"

        from common_services.document_lock_services import _extract_period_locked_doc_date

        # Kiểm tra cả kỳ cũ (nếu đang sửa chứng từ) và kỳ đích (EF-19, EF-20, BR-GL-LOCK-10..12, 31, 32, 47..49)
        for check_period, check_date in (
            [(instance.period, instance.posting_date), (period, posting_date)]
            if instance
            else [(period, posting_date)]
        ):
            if check_period.status == "CLOSED":
                eff_lock_date = check_period.lock_to_date or check_period.end_date
                if check_date <= eff_lock_date:
                    raise serializers.ValidationError("Không được tạo hoặc sửa bút toán trong kỳ đã đóng.")
            elif check_period.status == "PARTIALLY_LOCKED":
                locked_dt = _extract_period_locked_doc_date(check_period, doc_code) or _extract_period_locked_doc_date(
                    check_period, entry_type_val
                )
                if locked_dt and check_date <= locked_dt:
                    raise serializers.ValidationError(
                        f"Loại chứng từ {doc_code} trong kỳ {check_period.code} đã bị khóa sổ đến ngày {locked_dt.strftime('%d/%m/%Y')}, không được tạo hoặc sửa bút toán."
                    )
        if branch and branch.company_id != company.id:
            raise serializers.ValidationError({"branch": "Chi nhánh phải thuộc cùng doanh nghiệp."})
        return attrs

    def _prepare_line(self, company, row, entry_type=None):
        account = row["account"]
        if account.company_id != company.id:
            raise serializers.ValidationError({"lines": "Tài khoản phải thuộc cùng doanh nghiệp."})
        if (
            row["currency"].id != company.accounting_currency_id
            and entry_type != "REVALUATION"
            and row.get("foreign_amount", 0) <= 0
        ):
            raise serializers.ValidationError({"lines": "Dòng ngoại tệ phải có nguyên tệ."})
        for name in ("party", "department", "project", "cost_center", "warehouse"):
            value = row.get(name)
            if value and value.company_id != company.id:
                raise serializers.ValidationError({"lines": f"Chiều {name} phải thuộc cùng doanh nghiệp."})
        return row

    def _totals(self, obj):
        debit = sum((line.debit for line in obj.lines.all()), Decimal("0"))
        credit = sum((line.credit for line in obj.lines.all()), Decimal("0"))
        obj.total_debit, obj.total_credit = debit, credit
        obj.save(update_fields=("total_debit", "total_credit", "updated_at"))

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        obj = models.JournalEntry.objects.create(**validated_data)
        for row in lines:
            models.JournalLine.objects.create(entry=obj, **self._prepare_line(obj.company, row, entry_type=obj.entry_type))
        self._totals(obj)
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        instance = super().update(instance, validated_data)
        instance.version = (instance.version or 1) + 1
        instance.save(update_fields=("version", "updated_at"))
        if lines is not None:
            instance.lines.all().delete()
            for row in lines:
                models.JournalLine.objects.create(entry=instance, **self._prepare_line(instance.company, row, entry_type=instance.entry_type))
            self._totals(instance)
        return instance


@extend_schema_serializer(component_name="GeneralLedgerApproval")
class ApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.JournalApproval
        fields = "__all__"
        read_only_fields = ("id", "decided_at")


@extend_schema_serializer(component_name="GeneralLedgerBalance")
class BalanceSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)
    period_code = serializers.CharField(source="period.code", read_only=True)

    class Meta:
        model = models.AccountBalance
        fields = "__all__"
        read_only_fields = (
            "id", "company", "period", "account", "branch", "opening_debit", "opening_credit",
            "period_debit", "period_credit", "closing_debit", "closing_credit", "updated_at",
        )


class AllocationDestinationSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)
    offset_account_code = serializers.CharField(source="offset_account.code", read_only=True, default="")
    department_name = serializers.CharField(source="department.name", read_only=True, default="")
    project_code = serializers.CharField(source="project.code", read_only=True, default="")
    cost_center_code = serializers.CharField(source="cost_center.code", read_only=True, default="")
    party_code = serializers.CharField(source="party.code", read_only=True, default="")

    class Meta:
        model = models.AllocationDestination
        fields = "__all__"
        read_only_fields = ("id", "rule")
        extra_kwargs = {
            "percentage": {"required": False, "default": Decimal("0")},
            "coefficient": {"required": False, "default": Decimal("0")},
            "basis_value": {"required": False, "default": Decimal("0")},
            "direct_amount": {"required": False, "default": Decimal("0")},
        }


class AllocationRuleSerializer(serializers.ModelSerializer):
    destinations = AllocationDestinationSerializer(many=True)
    source_account_code = serializers.CharField(source="source_account.code", read_only=True, default="")
    source_account_name = serializers.CharField(source="source_account.name", read_only=True, default="")
    offset_account_code = serializers.CharField(source="offset_account.code", read_only=True, default="")

    class Meta:
        model = models.AllocationRule
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        company = attrs.get("company", self.instance.company if self.instance else None)
        source = attrs.get("source_account", self.instance.source_account if self.instance else None)
        offset = attrs.get("offset_account", self.instance.offset_account if self.instance else None)
        if offset is None and source is not None:
            offset = source
            attrs["offset_account"] = source
        source_filter = attrs.get("source_filter", self.instance.source_filter if self.instance else {}) or {}
        method = attrs.get("method", self.instance.method if self.instance else "FIXED_PERCENT")
        destinations = attrs.get("destinations")

        if source is None and not source_filter.get("source_account_ids") and not source_filter.get("source_account_codes"):
            raise serializers.ValidationError({"source_account": "Bắt buộc chọn tài khoản nguồn hoặc danh sách tài khoản nguồn."})
        if source is not None and source.company_id != company.id:
            raise serializers.ValidationError("Tài khoản nguồn/đối ứng phải thuộc cùng doanh nghiệp.")
        if offset is not None and offset.company_id != company.id:
            raise serializers.ValidationError("Tài khoản nguồn/đối ứng phải thuộc cùng doanh nghiệp.")

        effective_from = attrs.get("effective_from", self.instance.effective_from if self.instance else None)
        effective_to = attrs.get("effective_to", self.instance.effective_to if self.instance else None)
        if effective_from and effective_to and effective_from > effective_to:
            raise serializers.ValidationError({"effective_to": "Ngày kết thúc hiệu lực không được nhỏ hơn ngày bắt đầu hiệu lực."})

        if destinations is not None:
            if not destinations:
                raise serializers.ValidationError({"destinations": "Phải khai báo ít nhất một đối tượng nhận phân bổ."})
            if any(row["account"].company_id != company.id for row in destinations):
                raise serializers.ValidationError({"destinations": "Tài khoản đích phải thuộc cùng doanh nghiệp."})

        if method == "FIXED_PERCENT":
            percentages = (
                [row.get("percentage", Decimal("0")) for row in destinations]
                if destinations is not None
                else list(self.instance.destinations.values_list("percentage", flat=True))
                if self.instance
                else []
            )
            if abs(sum(percentages, Decimal("0")) - Decimal("100")) > Decimal("0.0001"):
                raise serializers.ValidationError({"destinations": "Tổng tỷ lệ phân bổ phải bằng 100%."})
        elif method == "COEFFICIENT" and destinations is not None:
            coeffs = [row.get("coefficient", Decimal("0")) for row in destinations]
            if sum(coeffs, Decimal("0")) <= Decimal("0"):
                raise serializers.ValidationError({"destinations": "Tổng hệ số phân bổ phải lớn hơn 0."})
        elif method == "DIRECT_AMOUNT" and destinations is not None:
            directs = [row.get("direct_amount", Decimal("0")) for row in destinations]
            if sum(directs, Decimal("0")) <= Decimal("0"):
                raise serializers.ValidationError({"destinations": "Tổng số tiền phân bổ trực tiếp phải lớn hơn 0."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        destinations = validated_data.pop("destinations")
        obj = models.AllocationRule.objects.create(**validated_data)
        for idx, row in enumerate(destinations, start=1):
            row.setdefault("line_no", idx)
            models.AllocationDestination.objects.create(rule=obj, **row)
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        destinations = validated_data.pop("destinations", None)
        instance = super().update(instance, validated_data)
        if destinations is not None:
            instance.destinations.all().delete()
            for idx, row in enumerate(destinations, start=1):
                row.setdefault("line_no", idx)
                models.AllocationDestination.objects.create(rule=instance, **row)
        return instance


class AllocationRunSerializer(serializers.ModelSerializer):
    rule_code = serializers.CharField(source="rule.code", read_only=True, default="")
    rule_name = serializers.CharField(source="rule.name", read_only=True, default="")
    period_code = serializers.CharField(source="period.code", read_only=True, default="")
    entry_number = serializers.CharField(source="entry.number", read_only=True, default="")
    entry_status = serializers.CharField(source="entry.status", read_only=True, default="")
    reversal_entry_number = serializers.CharField(source="reversal_entry.number", read_only=True, default="")

    class Meta:
        model = models.AllocationRun
        fields = "__all__"
        read_only_fields = ("id", "amount", "entry", "reversal_entry", "created_by", "created_at", "updated_at")


class ClosingRuleSerializer(serializers.ModelSerializer):
    source_account_code = serializers.CharField(source="source_account.code", read_only=True, default="")
    source_account_name = serializers.CharField(source="source_account.name", read_only=True, default="")
    destination_account_code = serializers.CharField(source="destination_account.code", read_only=True, default="")
    destination_account_name = serializers.CharField(source="destination_account.name", read_only=True, default="")
    result_type_label = serializers.CharField(source="get_result_type_display", read_only=True)
    direction_label = serializers.CharField(source="get_direction_display", read_only=True)

    class Meta:
        model = models.ClosingRule
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class ClosingRunLineSerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source="rule.name", read_only=True, default="")
    account_code = serializers.CharField(source="account.code", read_only=True, default="")
    debit_account_code = serializers.CharField(source="debit_account.code", read_only=True, default="")
    debit_account_name = serializers.CharField(source="debit_account.name", read_only=True, default="")
    credit_account_code = serializers.CharField(source="credit_account.code", read_only=True, default="")
    credit_account_name = serializers.CharField(source="credit_account.name", read_only=True, default="")

    class Meta:
        model = models.ClosingRunLine
        fields = "__all__"
        read_only_fields = ("id", "closing_run")


class ClosingRunSerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="period.code", read_only=True, default="")
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    entry_number = serializers.CharField(source="entry.number", read_only=True, default="")
    entry_status = serializers.CharField(source="entry.status", read_only=True, default="")
    reversal_entry_number = serializers.CharField(source="reversal_entry.number", read_only=True, default="")
    lines = ClosingRunLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.ClosingRun
        fields = "__all__"
        read_only_fields = (
            "id",
            "total_revenue_amount",
            "total_expense_amount",
            "net_profit_loss",
            "result_nature",
            "total_debit",
            "total_credit",
            "source_fingerprint",
            "source_snapshot",
            "closing_lines_snapshot",
            "warnings",
            "entry",
            "reversal_entry",
            "version",
            "created_by",
            "created_at",
            "updated_at",
        )


class BalanceAggregationRunSerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="period.code", read_only=True, default="")
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = models.BalanceAggregationRun
        fields = "__all__"
        read_only_fields = (
            "id",
            "watermark",
            "posted_entries_count",
            "total_opening_debit",
            "total_opening_credit",
            "total_period_debit",
            "total_period_credit",
            "total_closing_debit",
            "total_closing_credit",
            "is_balanced",
            "checks_summary",
            "warnings",
            "errors",
            "account_balances_snapshot",
            "dimension_balances_snapshot",
            "fx_balances_snapshot",
            "created_by",
            "started_at",
            "completed_at",
        )


class GlReconciliationRuleSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True, default="")
    account_name = serializers.CharField(source="account.name", read_only=True, default="")
    reconciliation_type_label = serializers.CharField(source="get_reconciliation_type_display", read_only=True)
    tolerance_behavior_label = serializers.CharField(source="get_tolerance_behavior_display", read_only=True)
    severity_label = serializers.CharField(source="get_severity_on_period_close_display", read_only=True)

    class Meta:
        model = models.GlReconciliationRule
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class GlReconciliationLineSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    discrepancy_type_label = serializers.CharField(source="get_discrepancy_type_display", read_only=True)

    class Meta:
        model = models.GlReconciliationLine
        fields = "__all__"
        read_only_fields = ("id", "reconciliation")


@extend_schema_serializer(component_name="GeneralLedgerReconciliation")
class ReconciliationSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True, default="")
    account_name = serializers.CharField(source="account.name", read_only=True, default="")
    period_code = serializers.CharField(source="period.code", read_only=True, default="")
    rule_code = serializers.CharField(source="rule.code", read_only=True, default="")
    rule_name = serializers.CharField(source="rule.name", read_only=True, default="")
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    lines = GlReconciliationLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.GlReconciliation
        fields = "__all__"
        read_only_fields = (
            "id",
            "gl_amount",
            "difference",
            "gl_opening_debit",
            "gl_opening_credit",
            "gl_period_debit",
            "gl_period_credit",
            "gl_closing_debit",
            "gl_closing_credit",
            "sub_opening_debit",
            "sub_opening_credit",
            "sub_period_debit",
            "sub_period_credit",
            "sub_closing_debit",
            "sub_closing_credit",
            "diff_opening",
            "diff_period_debit",
            "diff_period_credit",
            "diff_closing",
            "total_difference_amount",
            "matched_lines_count",
            "difference_lines_count",
            "warning_lines_count",
            "error_lines_count",
            "gl_aggregation_status",
            "snapshot_watermark",
            "blocks_period_close",
            "status",
            "warnings",
            "errors",
            "reconciliation_lines_snapshot",
            "created_by",
            "created_at",
            "completed_at",
        )


@extend_schema_serializer(component_name="GeneralLedgerAdvanceSettlementRequest")
class AdvanceSettlementRequestSerializer(serializers.ModelSerializer):
    requester_code = serializers.CharField(source="requester.employee_code", read_only=True)
    requester_name = serializers.CharField(source="requester.full_name", read_only=True)
    requester_email = serializers.CharField(source="requester.email", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True, default="")
    department_name = serializers.CharField(source="department.name", read_only=True, default="")
    branch_name = serializers.CharField(source="branch.name", read_only=True, default="")
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    sync_status_label = serializers.CharField(source="get_sync_status_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    settled_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    is_settled = serializers.SerializerMethodField()
    eligible_for_settlement = serializers.SerializerMethodField()

    class Meta:
        model = models.AdvanceSettlementRequest
        fields = (
            "id",
            "company",
            "branch",
            "branch_name",
            "number",
            "request_date",
            "requester",
            "requester_code",
            "requester_name",
            "requester_email",
            "department",
            "department_code",
            "department_name",
            "amount",
            "settled_amount",
            "remaining_amount",
            "purpose",
            "status",
            "status_label",
            "sync_status",
            "sync_status_label",
            "sync_error_message",
            "synced_at",
            "idempotency_key",
            "workflow_snapshot",
            "current_approval_level",
            "created_by",
            "created_by_name",
            "approved_by",
            "approved_by_name",
            "submitted_at",
            "approved_at",
            "rejection_reason",
            "settlement_entry",
            "settlement_voucher_no",
            "is_settled",
            "eligible_for_settlement",
            "version",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "number",
            "status",
            "sync_status",
            "sync_error_message",
            "synced_at",
            "workflow_snapshot",
            "current_approval_level",
            "created_by",
            "approved_by",
            "submitted_at",
            "approved_at",
            "settlement_entry",
            "settlement_voucher_no",
            "version",
            "created_at",
            "updated_at",
        )

    def get_created_by_name(self, obj):
        if obj.created_by:
            return (
                getattr(obj.created_by, "full_name", "")
                or getattr(getattr(obj.created_by, "auth_user", None), "username", "")
            )
        return ""

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return (
                getattr(obj.approved_by, "full_name", "")
                or getattr(getattr(obj.approved_by, "auth_user", None), "username", "")
            )
        return ""

    def _compute_settled_amount(self, obj):
        from django.db.models import Sum

        v_sum = (
            models.AdvanceSettlementVoucher.objects.filter(
                company_id=obj.company_id,
                advance_request_id=obj.id,
            )
            .exclude(status=models.AdvanceSettlementVoucherStatus.CANCELLED)
            .aggregate(s=Sum("total_amount"))["s"]
        )
        if v_sum is not None:
            return v_sum
        if obj.settlement_entry_id or obj.settlement_voucher_no:
            return obj.amount
        return Decimal("0")

    def get_settled_amount(self, obj):
        return str(self._compute_settled_amount(obj))

    def get_remaining_amount(self, obj):
        rem = max(Decimal("0"), obj.amount - self._compute_settled_amount(obj))
        return str(rem)

    def get_is_settled(self, obj):
        settled = self._compute_settled_amount(obj)
        return bool(settled >= obj.amount or obj.settlement_entry_id)

    def get_eligible_for_settlement(self, obj):
        settled = self._compute_settled_amount(obj)
        return obj.status == models.AdvanceRequestStatus.APPROVED and settled < obj.amount and not obj.settlement_entry_id


class AdvanceSettlementLineSerializer(serializers.ModelSerializer):
    debit_account_code = serializers.CharField(source="debit_account.code", read_only=True)
    debit_account_name = serializers.CharField(source="debit_account.name", read_only=True)
    credit_account_code = serializers.CharField(source="credit_account.code", read_only=True)
    credit_account_name = serializers.CharField(source="credit_account.name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True, default="")
    department_name = serializers.CharField(source="department.name", read_only=True, default="")

    class Meta:
        model = models.AdvanceSettlementLine
        fields = (
            "id",
            "line_no",
            "description",
            "debit_account",
            "debit_account_code",
            "debit_account_name",
            "credit_account",
            "credit_account_code",
            "credit_account_name",
            "amount",
            "debit_object_code",
            "debit_object_name",
            "credit_object_code",
            "credit_object_name",
            "party",
            "department",
            "department_code",
            "department_name",
            "project",
            "cost_center",
            "warehouse",
            "dimensions",
        )


class AdvanceSettlementTaxLineSerializer(serializers.ModelSerializer):
    tax_account_code = serializers.CharField(source="tax_account.code", read_only=True)
    tax_account_name = serializers.CharField(source="tax_account.name", read_only=True)
    credit_account_code = serializers.CharField(source="credit_account.code", read_only=True)
    credit_account_name = serializers.CharField(source="credit_account.name", read_only=True)

    class Meta:
        model = models.AdvanceSettlementTaxLine
        fields = (
            "id",
            "line_no",
            "description",
            "tax_account",
            "tax_account_code",
            "tax_account_name",
            "credit_account",
            "credit_account_code",
            "credit_account_name",
            "goods_group",
            "pre_tax_amount",
            "vat_rate",
            "vat_amount",
            "invoice_date",
            "invoice_number",
            "invoice_form",
            "invoice_serial",
            "supplier",
            "supplier_code",
            "supplier_name",
            "supplier_tax_code",
        )


class AdvanceSettlementVoucherSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True, default="")
    department_name = serializers.CharField(source="department.name", read_only=True, default="")
    period_code = serializers.CharField(source="period.code", read_only=True)
    advance_request_number = serializers.CharField(source="advance_request.number", read_only=True, default="")
    cash_advance_number = serializers.CharField(source="cash_advance.number", read_only=True, default="")
    journal_status = serializers.CharField(source="journal_entry.status", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    accounting_lines = AdvanceSettlementLineSerializer(many=True, read_only=True)
    tax_lines = AdvanceSettlementTaxLineSerializer(many=True, read_only=True)
    journal_lines_count = serializers.SerializerMethodField()
    advance_balance_summary = serializers.SerializerMethodField()

    class Meta:
        model = models.AdvanceSettlementVoucher
        fields = (
            "id",
            "company",
            "branch",
            "period",
            "period_code",
            "number",
            "posting_date",
            "document_date",
            "employee",
            "employee_code",
            "employee_name",
            "department",
            "department_code",
            "department_name",
            "description",
            "settle_per_advance",
            "group_invoices",
            "advance_request",
            "advance_request_number",
            "cash_advance",
            "cash_advance_number",
            "source_advance_ref",
            "source_advance_amount",
            "references",
            "attachments",
            "accounting_amount",
            "tax_amount",
            "total_amount",
            "status",
            "status_label",
            "journal_entry",
            "journal_status",
            "journal_lines_count",
            "advance_balance_summary",
            "idempotency_key",
            "version",
            "created_by",
            "accounting_lines",
            "tax_lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "journal_entry",
            "accounting_amount",
            "tax_amount",
            "total_amount",
            "version",
            "created_by",
            "created_at",
            "updated_at",
        )

    def get_journal_lines_count(self, obj):
        if obj.journal_entry_id:
            return obj.journal_entry.lines.count()
        return 0

    def get_advance_balance_summary(self, obj):
        """
        AF-15, BR-GL-QTTU-52, BR-GL-QTTU-53:
        Thông tin chênh lệch giữa số tạm ứng nguồn và số quyết toán thực tế (hoàn ứng hoặc chi thêm),
        không tự động sinh phiếu thu/phiếu chi ngoài phạm vi UC-GL-02.
        """
        src_amt = Decimal("0")
        if obj.cash_advance_id and obj.cash_advance:
            src_amt = obj.cash_advance.amount
        elif obj.source_advance_amount > Decimal("0"):
            src_amt = obj.source_advance_amount
        elif obj.advance_request_id and obj.advance_request:
            src_amt = obj.advance_request.amount

        diff = src_amt - obj.total_amount if src_amt > Decimal("0") else Decimal("0")
        return {
            "source_amount": str(src_amt),
            "settled_amount": str(obj.total_amount),
            "remaining_to_refund": str(max(Decimal("0"), diff)),
            "additional_to_pay": str(max(Decimal("0"), -diff)),
        }


class GeneralBusinessVoucherLineSerializer(serializers.ModelSerializer):
    debit_account_code = serializers.CharField(source="debit_account.code", read_only=True)
    debit_account_name = serializers.CharField(source="debit_account.name", read_only=True)
    credit_account_code = serializers.CharField(source="credit_account.code", read_only=True)
    credit_account_name = serializers.CharField(source="credit_account.name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True, default="")

    class Meta:
        model = models.GeneralBusinessVoucherLine
        fields = (
            "id",
            "line_no",
            "description",
            "debit_account",
            "debit_account_code",
            "debit_account_name",
            "credit_account",
            "credit_account_code",
            "credit_account_name",
            "amount",
            "operation",
            "debit_object_code",
            "debit_object_name",
            "credit_object_code",
            "credit_object_name",
            "loan_contract",
            "expense_item",
            "department_name",
            "cost_object",
            "party",
            "credit_party",
            "department",
            "department_code",
            "project",
            "cost_center",
            "dimensions",
        )


class GeneralBusinessVoucherTaxLineSerializer(serializers.ModelSerializer):
    tax_account_code = serializers.CharField(source="tax_account.code", read_only=True)
    tax_account_name = serializers.CharField(source="tax_account.name", read_only=True)
    credit_account_code = serializers.CharField(source="credit_account.code", read_only=True)
    credit_account_name = serializers.CharField(source="credit_account.name", read_only=True)

    class Meta:
        model = models.GeneralBusinessVoucherTaxLine
        fields = (
            "id",
            "line_no",
            "description",
            "tax_account",
            "tax_account_code",
            "tax_account_name",
            "credit_account",
            "credit_account_code",
            "credit_account_name",
            "goods_group",
            "pre_tax_amount",
            "vat_rate",
            "vat_amount",
            "invoice_date",
            "invoice_number",
            "invoice_form",
            "invoice_serial",
            "supplier",
            "supplier_code",
            "supplier_name",
            "supplier_tax_code",
        )


class GeneralBusinessVoucherSerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="period.code", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    journal_status = serializers.CharField(source="journal_entry.status", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    accounting_lines = GeneralBusinessVoucherLineSerializer(many=True, read_only=True)
    tax_lines = GeneralBusinessVoucherTaxLineSerializer(many=True, read_only=True)
    journal_lines_count = serializers.SerializerMethodField()

    class Meta:
        model = models.GeneralBusinessVoucher
        fields = (
            "id",
            "company",
            "period",
            "period_code",
            "number",
            "business_type",
            "business_type_label",
            "closing_year",
            "posting_date",
            "document_date",
            "due_date",
            "description",
            "references",
            "currency",
            "currency_code",
            "exchange_rate",
            "group_invoices",
            "exclude_from_vat_declaration",
            "total_accounting_amount",
            "total_tax_amount",
            "total_amount",
            "attachments",
            "status",
            "status_label",
            "journal_entry",
            "journal_status",
            "journal_lines_count",
            "idempotency_key",
            "version",
            "created_by",
            "updated_by",
            "accounting_lines",
            "tax_lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "journal_entry",
            "total_accounting_amount",
            "total_tax_amount",
            "total_amount",
            "version",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )

    def get_journal_lines_count(self, obj):
        if obj.journal_entry_id:
            return obj.journal_entry.lines.count()
        return 0


class SubledgerPostingRuleSerializer(serializers.ModelSerializer):
    source_module_label = serializers.CharField(source="get_source_module_display", read_only=True)
    posting_mode_label = serializers.CharField(source="get_posting_mode_display", read_only=True)
    debit_account_code = serializers.CharField(source="debit_account.code", read_only=True)
    debit_account_name = serializers.CharField(source="debit_account.name", read_only=True)
    credit_account_code = serializers.CharField(source="credit_account.code", read_only=True)
    credit_account_name = serializers.CharField(source="credit_account.name", read_only=True)
    tax_account_code = serializers.CharField(source="tax_account.code", read_only=True, default="")
    tax_account_name = serializers.CharField(source="tax_account.name", read_only=True, default="")

    class Meta:
        model = models.SubledgerPostingRule
        fields = (
            "id",
            "company",
            "source_module",
            "source_module_label",
            "source_business_type",
            "source_document_type",
            "name",
            "debit_account",
            "debit_account_code",
            "debit_account_name",
            "credit_account",
            "credit_account_code",
            "credit_account_name",
            "tax_account",
            "tax_account_code",
            "tax_account_name",
            "posting_mode",
            "posting_mode_label",
            "description_template",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class SubledgerJournalIngestionSerializer(serializers.ModelSerializer):
    source_module_label = serializers.CharField(source="get_source_module_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    posting_mode_label = serializers.CharField(source="get_posting_mode_display", read_only=True)
    callback_status_label = serializers.CharField(source="get_callback_status_display", read_only=True)
    period_code = serializers.CharField(source="period.code", read_only=True, default="")
    currency_code = serializers.CharField(source="currency.code", read_only=True, default="VND")
    primary_journal_number = serializers.CharField(source="primary_journal_entry.number", read_only=True, default="")
    primary_journal_status = serializers.CharField(source="primary_journal_entry.status", read_only=True, default="")
    journal_entries_summary = serializers.SerializerMethodField()

    class Meta:
        model = models.SubledgerJournalIngestion
        fields = (
            "id",
            "company",
            "source_module",
            "source_module_label",
            "source_business_type",
            "source_document_type",
            "source_document_id",
            "source_document_number",
            "source_document_status",
            "source_event_id",
            "document_date",
            "posting_date",
            "period",
            "period_code",
            "description",
            "currency",
            "currency_code",
            "exchange_rate",
            "total_debit",
            "total_credit",
            "posting_mode",
            "posting_mode_label",
            "status",
            "status_label",
            "callback_status",
            "callback_status_label",
            "callback_error",
            "error_code",
            "error_message",
            "retry_count",
            "primary_journal_entry",
            "primary_journal_number",
            "primary_journal_status",
            "journal_entries_summary",
            "posting_rule",
            "raw_payload",
            "resolved_lines",
            "version",
            "created_by",
            "updated_by",
            "processed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "callback_status",
            "callback_error",
            "error_code",
            "error_message",
            "retry_count",
            "primary_journal_entry",
            "resolved_lines",
            "version",
            "created_by",
            "updated_by",
            "processed_at",
            "created_at",
            "updated_at",
        )

    def get_journal_entries_summary(self, obj):
        entries = list(obj.journal_entries.all())
        if obj.primary_journal_entry and obj.primary_journal_entry not in entries:
            entries.insert(0, obj.primary_journal_entry)
        return [
            {
                "id": str(e.id),
                "number": e.number,
                "status": e.status,
                "posting_date": e.posting_date.isoformat() if e.posting_date else None,
                "total_debit": str(e.total_debit),
                "total_credit": str(e.total_credit),
                "lines": [
                    {
                        "line_no": ln.line_no,
                        "account_code": ln.account.code,
                        "account_name": ln.account.name,
                        "debit": str(ln.debit),
                        "credit": str(ln.credit),
                        "description": ln.description,
                    }
                    for ln in e.lines.select_related("account").all()
                ],
            }
            for e in entries
        ]


class ForeignCurrencyRevaluationRuleSerializer(serializers.ModelSerializer):
    item_group_label = serializers.CharField(source="get_item_group_display", read_only=True)
    target_account_code = serializers.CharField(source="target_account.code", read_only=True, default="")
    target_account_name = serializers.CharField(source="target_account.name", read_only=True, default="")
    fx_difference_account_code = serializers.CharField(source="fx_difference_account.code", read_only=True, default="")
    fx_difference_account_name = serializers.CharField(source="fx_difference_account.name", read_only=True, default="")
    fx_gain_account_code = serializers.CharField(source="fx_gain_account.code", read_only=True, default="")
    fx_gain_account_name = serializers.CharField(source="fx_gain_account.name", read_only=True, default="")
    fx_loss_account_code = serializers.CharField(source="fx_loss_account.code", read_only=True, default="")
    fx_loss_account_name = serializers.CharField(source="fx_loss_account.name", read_only=True, default="")
    rate_type_code = serializers.CharField(source="rate_type.code", read_only=True, default="")

    class Meta:
        model = models.ForeignCurrencyRevaluationRule
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        company = attrs.get("company", self.instance.company if self.instance else None)
        target = attrs.get("target_account", self.instance.target_account if self.instance else None)
        diff = attrs.get("fx_difference_account", self.instance.fx_difference_account if self.instance else None)
        gain = attrs.get("fx_gain_account", self.instance.fx_gain_account if self.instance else None)
        loss = attrs.get("fx_loss_account", self.instance.fx_loss_account if self.instance else None)

        if target and company and target.company_id != company.id:
            raise serializers.ValidationError({"target_account": "Tài khoản ngoại tệ phải thuộc cùng doanh nghiệp."})
        for field_name, acc in (
            ("fx_difference_account", diff),
            ("fx_gain_account", gain),
            ("fx_loss_account", loss),
        ):
            if acc and company and acc.company_id != company.id:
                raise serializers.ValidationError({field_name: "Tài khoản xử lý chênh lệch phải thuộc cùng doanh nghiệp."})
            if acc and not acc.is_postable:
                raise serializers.ValidationError({field_name: "Tài khoản xử lý chênh lệch phải là tài khoản chi tiết (is_postable=True)."})
            if acc and acc.status != "ACTIVE":
                raise serializers.ValidationError({field_name: "Tài khoản xử lý chênh lệch đang ngừng sử dụng."})

        if not diff and not (gain and loss):
            raise serializers.ValidationError(
                "Phải cấu hình Tài khoản chênh lệch tỷ giá chung (VD: 4131) hoặc đủ cặp Tài khoản Lãi/Lỗ chênh lệch tỷ giá."
            )
        return attrs


class ForeignCurrencyRevaluationLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)
    fx_difference_account_code = serializers.CharField(source="fx_difference_account.code", read_only=True, default="")
    fx_difference_account_name = serializers.CharField(source="fx_difference_account.name", read_only=True, default="")
    debit_account_code = serializers.CharField(source="debit_account.code", read_only=True, default="")
    debit_account_name = serializers.CharField(source="debit_account.name", read_only=True, default="")
    credit_account_code = serializers.CharField(source="credit_account.code", read_only=True, default="")
    credit_account_name = serializers.CharField(source="credit_account.name", read_only=True, default="")
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    party_code = serializers.CharField(source="party.code", read_only=True, default="")
    party_name = serializers.CharField(source="party.name", read_only=True, default="")
    department_code = serializers.CharField(source="department.code", read_only=True, default="")
    department_name = serializers.CharField(source="department.name", read_only=True, default="")
    project_code = serializers.CharField(source="project.code", read_only=True, default="")
    cost_center_code = serializers.CharField(source="cost_center.code", read_only=True, default="")

    class Meta:
        model = models.ForeignCurrencyRevaluationLine
        fields = "__all__"
        read_only_fields = ("id", "run")


class ForeignCurrencyRevaluationRunSerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="period.code", read_only=True, default="")
    currency_code = serializers.CharField(source="currency.code", read_only=True, default="")
    currency_name = serializers.CharField(source="currency.name", read_only=True, default="")
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    fx_difference_account_code = serializers.CharField(source="fx_difference_account.code", read_only=True, default="")
    fx_gain_account_code = serializers.CharField(source="fx_gain_account.code", read_only=True, default="")
    fx_loss_account_code = serializers.CharField(source="fx_loss_account.code", read_only=True, default="")
    entry_number = serializers.CharField(source="entry.number", read_only=True, default="")
    entry_status = serializers.CharField(source="entry.status", read_only=True, default="")
    reversal_entry_number = serializers.CharField(source="reversal_entry.number", read_only=True, default="")
    lines = ForeignCurrencyRevaluationLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.ForeignCurrencyRevaluationRun
        fields = "__all__"
        read_only_fields = (
            "id",
            "total_foreign_balance",
            "total_book_value_before",
            "total_revalued_value",
            "total_increase_amount",
            "total_decrease_amount",
            "total_gain_amount",
            "total_loss_amount",
            "net_difference",
            "evaluated_lines_count",
            "source_fingerprint",
            "source_snapshot",
            "revaluation_lines",
            "entry",
            "reversal_entry",
            "calculated_at",
            "version",
            "created_by",
            "created_at",
            "updated_at",
        )


# ==============================================================================
# UC-GL-13 – LẬP BÁO CÁO TÀI CHÍNH (FINANCIAL STATEMENTS - TT99/2025/TT-BTC)
# ==============================================================================


class FinancialStatementMappingRuleSerializer(serializers.ModelSerializer):
    form_code_label = serializers.CharField(source="get_form_code_display", read_only=True)
    cash_flow_method_label = serializers.CharField(source="get_cash_flow_method_display", read_only=True)
    source_type_label = serializers.CharField(source="get_source_type_display", read_only=True)
    balance_side_label = serializers.CharField(source="get_balance_side_display", read_only=True)

    class Meta:
        model = models.FinancialStatementMappingRule
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class FinancialStatementLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.FinancialStatementLine
        fields = (
            "id",
            "report",
            "line_no",
            "section_code",
            "indicator_code",
            "indicator_name",
            "note_ref",
            "level",
            "is_total_line",
            "is_custom_indicator",
            "source_type",
            "formula_or_mapping",
            "raw_current_amount",
            "raw_prior_amount",
            "raw_ytd_current_amount",
            "raw_ytd_prior_amount",
            "current_amount",
            "prior_amount",
            "ytd_current_amount",
            "ytd_prior_amount",
            "manual_explanation",
            "account_breakdown",
            "entry_ids_trace",
        )
        read_only_fields = ("id", "report")


class FinancialStatementReportSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    lines = FinancialStatementLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.FinancialStatementReport
        fields = (
            "id",
            "batch",
            "company",
            "form_code",
            "form_name",
            "cash_flow_method",
            "going_concern_assumption",
            "interim_format",
            "status",
            "status_label",
            "summary_metrics",
            "notes_sections",
            "validation_errors",
            "lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "batch", "company", "created_at", "updated_at")


class FinancialStatementBatchSerializer(serializers.ModelSerializer):
    report_group_label = serializers.CharField(source="get_report_group_display", read_only=True)
    going_concern_label = serializers.CharField(source="get_going_concern_assumption_display", read_only=True)
    interim_format_label = serializers.CharField(source="get_interim_format_display", read_only=True)
    cash_flow_method_label = serializers.CharField(source="get_cash_flow_method_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    period_code = serializers.CharField(source="period.code", read_only=True, default="")
    comparison_period_code = serializers.CharField(source="comparison_period.code", read_only=True, default="")
    presentation_currency_code = serializers.CharField(source="presentation_currency.code", read_only=True, default="VND")
    inherited_from_batch_number = serializers.CharField(source="inherited_from_batch.batch_number", read_only=True, default="")
    reports = FinancialStatementReportSerializer(many=True, read_only=True)

    class Meta:
        model = models.FinancialStatementBatch
        fields = (
            "id",
            "company",
            "branch",
            "period",
            "period_code",
            "comparison_period",
            "comparison_period_code",
            "batch_number",
            "report_group",
            "report_group_label",
            "period_type",
            "period_label",
            "fiscal_year",
            "from_date",
            "to_date",
            "comparison_from_date",
            "comparison_to_date",
            "going_concern_assumption",
            "going_concern_label",
            "interim_format",
            "interim_format_label",
            "cash_flow_method",
            "cash_flow_method_label",
            "selected_forms",
            "presentation_currency",
            "presentation_currency_code",
            "unit_scale",
            "reuse_latest_notes",
            "inherited_from_batch",
            "inherited_from_batch_number",
            "mapping_version",
            "version_number",
            "status",
            "status_label",
            "source_watermark",
            "gl_aggregation_status",
            "period_lock_status_snapshot",
            "is_balanced",
            "blocker_count",
            "warning_count",
            "info_count",
            "precheck_results",
            "cross_check_results",
            "notes_general_info",
            "notes_explanations",
            "custom_indicators",
            "idempotency_key",
            "outdated_reason",
            "outdated_at",
            "finalized_by",
            "finalized_at",
            "finalize_note",
            "created_by",
            "created_at",
            "updated_at",
            "reports",
        )
        read_only_fields = (
            "id",
            "version_number",
            "status",
            "source_watermark",
            "gl_aggregation_status",
            "period_lock_status_snapshot",
            "is_balanced",
            "blocker_count",
            "warning_count",
            "info_count",
            "precheck_results",
            "cross_check_results",
            "outdated_reason",
            "outdated_at",
            "finalized_by",
            "finalized_at",
            "created_by",
            "created_at",
            "updated_at",
            "reports",
        )


