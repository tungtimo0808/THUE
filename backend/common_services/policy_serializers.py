from rest_framework import serializers

from master_data.models import Currency
from organization.models import Branch

from .models import (
    AccountingBasis,
    AccountingPolicy,
    AccountingRegime,
    AllocationMethod,
    DebtTrackingMethod,
    DepreciationMethod,
    ExchangeRateSource,
    FiscalPeriod,
    InventoryMethod,
    InventoryValuationMethod,
    PolicyScope,
    PolicyStatus,
    PostingMode,
    RoundingMethod,
    TaxCalculationMethod,
)


class AccountingPolicySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    scope_display = serializers.CharField(source="get_scope_display", read_only=True)
    accounting_regime_display = serializers.CharField(source="get_accounting_regime_display", read_only=True)
    accounting_basis_display = serializers.CharField(source="get_accounting_basis_display", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    effective_from_period_code = serializers.CharField(source="effective_from_period.code", read_only=True)
    effective_to_period_code = serializers.CharField(source="effective_to_period.code", read_only=True)
    accounting_currency_code = serializers.CharField(source="accounting_currency.code", read_only=True)

    class Meta:
        model = AccountingPolicy
        fields = (
            "id",
            "company",
            "code",
            "name",
            "version",
            "previous_version",
            "scope",
            "scope_display",
            "branch",
            "branch_name",
            "effective_from_period",
            "effective_from_period_code",
            "effective_to_period",
            "effective_to_period_code",
            "status",
            "status_display",
            "accounting_regime",
            "accounting_regime_display",
            "accounting_basis",
            "accounting_basis_display",
            "accounting_currency",
            "accounting_currency_code",
            "allow_multi_currency",
            "posting_mode",
            "inventory_valuation",
            "rounding_method",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class AccountingPolicyDetailSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    scope_display = serializers.CharField(source="get_scope_display", read_only=True)
    accounting_regime_display = serializers.CharField(source="get_accounting_regime_display", read_only=True)
    accounting_basis_display = serializers.CharField(source="get_accounting_basis_display", read_only=True)
    inventory_accounting_display = serializers.CharField(source="get_inventory_accounting_display", read_only=True)
    inventory_valuation_display = serializers.CharField(source="get_inventory_valuation_display", read_only=True)
    depreciation_method_display = serializers.CharField(source="get_depreciation_method_display", read_only=True)
    allocation_method_display = serializers.CharField(source="get_allocation_method_display", read_only=True)
    posting_mode_display = serializers.CharField(source="get_posting_mode_display", read_only=True)
    tax_method_display = serializers.CharField(source="get_tax_method_display", read_only=True)
    debt_tracking_display = serializers.CharField(source="get_debt_tracking_display", read_only=True)
    rounding_method_display = serializers.CharField(source="get_rounding_method_display", read_only=True)
    exchange_rate_source_display = serializers.CharField(source="get_exchange_rate_source_display", read_only=True)

    branch_name = serializers.CharField(source="branch.name", read_only=True)
    effective_from_period_code = serializers.CharField(source="effective_from_period.code", read_only=True)
    effective_to_period_code = serializers.CharField(source="effective_to_period.code", read_only=True)
    accounting_currency_code = serializers.CharField(source="accounting_currency.code", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)
    approved_by_username = serializers.CharField(source="approved_by.username", read_only=True)

    class Meta:
        model = AccountingPolicy
        fields = (
            "id",
            "company",
            "code",
            "name",
            "version",
            "previous_version",
            "scope",
            "scope_display",
            "branch",
            "branch_name",
            "effective_from_period",
            "effective_from_period_code",
            "effective_to_period",
            "effective_to_period_code",
            "status",
            "status_display",
            "accounting_regime",
            "accounting_regime_display",
            "accounting_basis",
            "accounting_basis_display",
            "accounting_currency",
            "accounting_currency_code",
            "allow_multi_currency",
            "exchange_rate_source",
            "exchange_rate_source_display",
            "inventory_accounting",
            "inventory_accounting_display",
            "inventory_valuation",
            "inventory_valuation_display",
            "depreciation_method",
            "depreciation_method_display",
            "allocation_method",
            "allocation_method_display",
            "posting_mode",
            "posting_mode_display",
            "tax_method",
            "tax_method_display",
            "debt_tracking",
            "debt_tracking_display",
            "amount_decimals",
            "unit_price_decimals",
            "quantity_decimals",
            "exchange_rate_decimals",
            "rounding_method",
            "rounding_method_display",
            "config_snapshot",
            "legal_basis",
            "change_reason",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
            "approved_by",
            "approved_by_username",
            "approved_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class AccountingPolicyCreateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=255)
    scope = serializers.ChoiceField(choices=PolicyScope.choices, default=PolicyScope.COMPANY)
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False, allow_null=True)
    effective_from_period = serializers.PrimaryKeyRelatedField(queryset=FiscalPeriod.objects.all())
    effective_to_period = serializers.PrimaryKeyRelatedField(queryset=FiscalPeriod.objects.all(), required=False, allow_null=True)
    accounting_regime = serializers.ChoiceField(choices=AccountingRegime.choices, default=AccountingRegime.CIRCULAR_133)
    accounting_basis = serializers.ChoiceField(choices=AccountingBasis.choices, default=AccountingBasis.ACCRUAL)
    accounting_currency = serializers.PrimaryKeyRelatedField(queryset=Currency.objects.all(), required=False, allow_null=True)
    allow_multi_currency = serializers.BooleanField(default=False)
    exchange_rate_source = serializers.ChoiceField(choices=ExchangeRateSource.choices, default=ExchangeRateSource.MANUAL)
    inventory_accounting = serializers.ChoiceField(choices=InventoryMethod.choices, default=InventoryMethod.PERPETUAL)
    inventory_valuation = serializers.ChoiceField(choices=InventoryValuationMethod.choices, default=InventoryValuationMethod.WEIGHTED_AVERAGE)
    depreciation_method = serializers.ChoiceField(choices=DepreciationMethod.choices, default=DepreciationMethod.STRAIGHT_LINE)
    allocation_method = serializers.ChoiceField(choices=AllocationMethod.choices, default=AllocationMethod.BY_MONTHS)
    posting_mode = serializers.ChoiceField(choices=PostingMode.choices, default=PostingMode.MANUAL)
    tax_method = serializers.ChoiceField(choices=TaxCalculationMethod.choices, default=TaxCalculationMethod.DEDUCTION)
    debt_tracking = serializers.ChoiceField(choices=DebtTrackingMethod.choices, default=DebtTrackingMethod.INVOICE)
    amount_decimals = serializers.IntegerField(default=0, min_value=0, max_value=4)
    unit_price_decimals = serializers.IntegerField(default=2, min_value=0, max_value=6)
    quantity_decimals = serializers.IntegerField(default=2, min_value=0, max_value=6)
    exchange_rate_decimals = serializers.IntegerField(default=2, min_value=0, max_value=6)
    rounding_method = serializers.ChoiceField(choices=RoundingMethod.choices, default=RoundingMethod.HALF_UP)
    legal_basis = serializers.CharField(required=False, allow_blank=True, default="")
    change_reason = serializers.CharField(required=False, allow_blank=True, default="")


class AccountingPolicyUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    scope = serializers.ChoiceField(choices=PolicyScope.choices, required=False)
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False, allow_null=True)
    effective_from_period = serializers.PrimaryKeyRelatedField(queryset=FiscalPeriod.objects.all(), required=False)
    effective_to_period = serializers.PrimaryKeyRelatedField(queryset=FiscalPeriod.objects.all(), required=False, allow_null=True)
    accounting_regime = serializers.ChoiceField(choices=AccountingRegime.choices, required=False)
    accounting_basis = serializers.ChoiceField(choices=AccountingBasis.choices, required=False)
    accounting_currency = serializers.PrimaryKeyRelatedField(queryset=Currency.objects.all(), required=False, allow_null=True)
    allow_multi_currency = serializers.BooleanField(required=False)
    exchange_rate_source = serializers.ChoiceField(choices=ExchangeRateSource.choices, required=False)
    inventory_accounting = serializers.ChoiceField(choices=InventoryMethod.choices, required=False)
    inventory_valuation = serializers.ChoiceField(choices=InventoryValuationMethod.choices, required=False)
    depreciation_method = serializers.ChoiceField(choices=DepreciationMethod.choices, required=False)
    allocation_method = serializers.ChoiceField(choices=AllocationMethod.choices, required=False)
    posting_mode = serializers.ChoiceField(choices=PostingMode.choices, required=False)
    tax_method = serializers.ChoiceField(choices=TaxCalculationMethod.choices, required=False)
    debt_tracking = serializers.ChoiceField(choices=DebtTrackingMethod.choices, required=False)
    amount_decimals = serializers.IntegerField(min_value=0, max_value=4, required=False)
    unit_price_decimals = serializers.IntegerField(min_value=0, max_value=6, required=False)
    quantity_decimals = serializers.IntegerField(min_value=0, max_value=6, required=False)
    exchange_rate_decimals = serializers.IntegerField(min_value=0, max_value=6, required=False)
    rounding_method = serializers.ChoiceField(choices=RoundingMethod.choices, required=False)
    legal_basis = serializers.CharField(required=False, allow_blank=True)
    change_reason = serializers.CharField(required=False, allow_blank=True)


class AccountingPolicyNewVersionSerializer(serializers.Serializer):
    change_reason = serializers.CharField(required=False, allow_blank=True, default="")


class AccountingPolicyActivateSerializer(serializers.Serializer):
    require_approval = serializers.BooleanField(default=False, required=False)
    skip_approval = serializers.BooleanField(default=False, required=False)


class AccountingPolicyApproveSerializer(serializers.Serializer):
    approved = serializers.BooleanField(default=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AccountingPolicyCopySerializer(serializers.Serializer):
    new_code = serializers.CharField(max_length=50)
    new_name = serializers.CharField(max_length=255)
    effective_from_period = serializers.PrimaryKeyRelatedField(queryset=FiscalPeriod.objects.all())


class PolicyImpactReportSerializer(serializers.Serializer):
    can_activate = serializers.BooleanField()
    blocked_reasons = serializers.ListField(child=serializers.CharField())
    warnings = serializers.ListField(child=serializers.CharField())
    changes = serializers.ListField(child=serializers.DictField())
    affected_modules = serializers.ListField(child=serializers.CharField())
    effective_from_period = serializers.CharField()
    summary = serializers.CharField()


class ResolvePolicyRequestSerializer(serializers.Serializer):
    target_date = serializers.DateField(required=False, allow_null=True)
    period = serializers.PrimaryKeyRelatedField(queryset=FiscalPeriod.objects.all(), required=False, allow_null=True)
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False, allow_null=True)
