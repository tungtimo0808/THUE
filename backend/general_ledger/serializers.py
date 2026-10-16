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


@extend_schema_serializer(component_name="GeneralLedgerPeriod")
class PeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.AccountingPeriod
        fields = "__all__"
        read_only_fields = ("id", "closed_by", "closed_at", "reopened_by", "reopened_at", "reopen_reason")


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


@extend_schema_serializer(component_name="GeneralLedgerJournalEntry")
class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True)
    period_code = serializers.CharField(source="period.code", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = models.JournalEntry
        fields = "__all__"
        read_only_fields = (
            "id", "status", "workflow_snapshot", "total_debit", "total_credit", "created_by",
            "approved_by", "posted_by", "submitted_at", "approved_at", "posted_at", "created_at", "updated_at",
        )

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.status not in {"DRAFT", "REJECTED"}:
            raise serializers.ValidationError("Chỉ bút toán nháp hoặc bị từ chối mới được sửa.")
        company = attrs.get("company", instance.company if instance else None)
        period = attrs.get("period", instance.period if instance else None)
        posting_date = attrs.get("posting_date", instance.posting_date if instance else None)
        branch = attrs.get("branch", instance.branch if instance else None)
        if period.company_id != company.id or not period.start_date <= posting_date <= period.end_date:
            raise serializers.ValidationError("Ngày hạch toán không thuộc kỳ kế toán được chọn.")
        if period.status == "CLOSED":
            raise serializers.ValidationError("Không được tạo hoặc sửa bút toán trong kỳ đã đóng.")
        if branch and branch.company_id != company.id:
            raise serializers.ValidationError({"branch": "Chi nhánh phải thuộc cùng doanh nghiệp."})
        return attrs

    def _prepare_line(self, company, row):
        account = row["account"]
        if account.company_id != company.id:
            raise serializers.ValidationError({"lines": "Tài khoản phải thuộc cùng doanh nghiệp."})
        if row["currency"].id != company.accounting_currency_id and row.get("foreign_amount", 0) <= 0:
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
            models.JournalLine.objects.create(entry=obj, **self._prepare_line(obj.company, row))
        self._totals(obj)
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        instance = super().update(instance, validated_data)
        if lines is not None:
            instance.lines.all().delete()
            for row in lines:
                models.JournalLine.objects.create(entry=instance, **self._prepare_line(instance.company, row))
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
    class Meta:
        model = models.AllocationDestination
        fields = "__all__"
        read_only_fields = ("id", "rule")


class AllocationRuleSerializer(serializers.ModelSerializer):
    destinations = AllocationDestinationSerializer(many=True)
    source_account_code = serializers.CharField(source="source_account.code", read_only=True)
    offset_account_code = serializers.CharField(source="offset_account.code", read_only=True)

    class Meta:
        model = models.AllocationRule
        fields = "__all__"
        read_only_fields = ("id", "created_at")

    def validate(self, attrs):
        company = attrs.get("company", self.instance.company if self.instance else None)
        source = attrs.get("source_account", self.instance.source_account if self.instance else None)
        offset = attrs.get("offset_account", self.instance.offset_account if self.instance else None)
        destinations = attrs.get("destinations")
        if source.company_id != company.id or offset.company_id != company.id:
            raise serializers.ValidationError("Tài khoản nguồn/đối ứng phải thuộc cùng doanh nghiệp.")
        percentages = [row["percentage"] for row in destinations] if destinations is not None else list(self.instance.destinations.values_list("percentage", flat=True)) if self.instance else []
        if sum(percentages, Decimal("0")) != Decimal("100"):
            raise serializers.ValidationError({"destinations": "Tổng tỷ lệ phân bổ phải bằng 100%."})
        if destinations is not None and any(row["account"].company_id != company.id for row in destinations):
            raise serializers.ValidationError({"destinations": "Tài khoản đích phải thuộc cùng doanh nghiệp."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        destinations = validated_data.pop("destinations")
        obj = models.AllocationRule.objects.create(**validated_data)
        for row in destinations:
            models.AllocationDestination.objects.create(rule=obj, **row)
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        destinations = validated_data.pop("destinations", None)
        instance = super().update(instance, validated_data)
        if destinations is not None:
            instance.destinations.all().delete()
            for row in destinations:
                models.AllocationDestination.objects.create(rule=instance, **row)
        return instance


class AllocationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.AllocationRun
        fields = "__all__"
        read_only_fields = ("id", "amount", "entry", "created_by", "created_at")


class ClosingRuleSerializer(serializers.ModelSerializer):
    source_account_code = serializers.CharField(source="source_account.code", read_only=True)
    destination_account_code = serializers.CharField(source="destination_account.code", read_only=True)

    class Meta:
        model = models.ClosingRule
        fields = "__all__"
        read_only_fields = ("id",)


class ClosingRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ClosingRun
        fields = "__all__"
        read_only_fields = ("id", "entry", "created_by", "created_at")


@extend_schema_serializer(component_name="GeneralLedgerReconciliation")
class ReconciliationSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    period_code = serializers.CharField(source="period.code", read_only=True)

    class Meta:
        model = models.GlReconciliation
        fields = "__all__"
        read_only_fields = ("id", "gl_amount", "difference", "status", "created_by", "created_at")
