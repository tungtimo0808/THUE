from decimal import Decimal
from rest_framework import serializers

from . import models, contract_services


class SalesContractLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    uom_code = serializers.CharField(source="uom.code", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)

    class Meta:
        model = models.SalesContractLine
        fields = (
            "id",
            "line_no",
            "item",
            "item_code",
            "item_name",
            "description",
            "uom",
            "uom_code",
            "uom_name",
            "quantity",
            "maximum_quantity",
            "unit_price",
            "discount_rate",
            "discount_amount",
            "tax_rate",
            "tax_amount",
            "line_total",
            "expected_delivery_date",
            "quotation_line",
        )
        read_only_fields = ("id", "line_total", "tax_amount", "discount_amount")


class SalesContractAnnexSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = models.SalesContractAnnex
        fields = (
            "id",
            "contract",
            "annex_number",
            "annex_date",
            "effective_date",
            "change_content",
            "status",
            "signed_file",
            "new_end_date",
            "new_contract_limit",
            "line_adjustments",
            "applied_at",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "status", "applied_at", "created_by", "created_at", "updated_at")

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ""
        return getattr(obj.created_by, "display_name", "") or getattr(getattr(obj.created_by, "auth_user", None), "username", "")


class SalesContractListSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    assigned_employee_name = serializers.CharField(source="assigned_employee.full_name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    validity = serializers.SerializerMethodField()
    validity_display = serializers.SerializerMethodField()

    class Meta:
        model = models.SalesContract
        fields = (
            "id",
            "number",
            "contract_number",
            "title",
            "document_date",
            "customer",
            "customer_code",
            "customer_name",
            "branch",
            "branch_name",
            "assigned_employee",
            "assigned_employee_name",
            "start_date",
            "end_date",
            "currency",
            "currency_code",
            "value_type",
            "contract_limit",
            "total_amount",
            "status",
            "status_display",
            "validity",
            "validity_display",
            "version",
            "created_at",
        )

    def get_validity(self, obj):
        return contract_services.get_contract_validity(obj)

    def get_validity_display(self, obj):
        v = contract_services.get_contract_validity(obj)
        return contract_services.get_contract_validity_display(v)


class SalesContractDetailSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    company_name = serializers.CharField(source="company.name", read_only=True)
    company_signer_display = serializers.SerializerMethodField()
    assigned_employee_name = serializers.CharField(source="assigned_employee.full_name", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    validity = serializers.SerializerMethodField()
    validity_display = serializers.SerializerMethodField()
    lines = serializers.SerializerMethodField()
    annexes = SalesContractAnnexSerializer(many=True, read_only=True)
    allocations = serializers.SerializerMethodField()

    class Meta:
        model = models.SalesContract
        fields = (
            "id",
            "number",
            "contract_number",
            "title",
            "company",
            "company_name",
            "branch",
            "branch_name",
            "document_date",
            "customer",
            "customer_code",
            "customer_name",
            "customer_representative",
            "customer_representative_position",
            "company_signer",
            "company_signer_name",
            "company_signer_position",
            "company_signer_display",
            "assigned_employee",
            "assigned_employee_name",
            "quotation",
            "signed_date",
            "start_date",
            "end_date",
            "currency",
            "currency_code",
            "exchange_rate",
            "value_type",
            "contract_limit",
            "maximum_value",
            "subtotal",
            "discount_amount",
            "tax_amount",
            "total_amount",
            "payment_terms_text",
            "payment_term",
            "delivery_terms",
            "signed_file",
            "attachments",
            "status",
            "status_display",
            "validity",
            "validity_display",
            "version",
            "approval_required",
            "workflow_snapshot",
            "cancellation_reason",
            "termination_reason",
            "terminated_at",
            "liquidation_reason",
            "liquidated_at",
            "liquidation_file",
            "open_settlement_notes",
            "withdrawal_reason",
            "rejection_reason",
            "notes",
            "lines",
            "annexes",
            "allocations",
            "created_at",
            "updated_at",
        )

    def get_company_signer_display(self, obj):
        if obj.company_signer:
            return obj.company_signer.full_name
        return obj.company_signer_name or ""

    def get_validity(self, obj):
        return contract_services.get_contract_validity(obj)

    def get_validity_display(self, obj):
        v = contract_services.get_contract_validity(obj)
        return contract_services.get_contract_validity_display(v)

    def get_lines(self, obj):
        allocs = contract_services.calculate_contract_allocations(obj)
        line_allocs = allocs.get("lines", {})
        res = []
        for line in obj.lines.all():
            data = SalesContractLineSerializer(line).data
            la = line_allocs.get(str(line.id), {})
            data["allocated_quantity"] = str(la.get("allocated_quantity", 0))
            data["remaining_quantity"] = str(la.get("remaining_quantity", 0))
            data["allocated_amount"] = str(la.get("allocated_amount", 0))
            data["remaining_amount"] = str(la.get("remaining_amount", 0))
            res.append(data)
        return res

    def get_allocations(self, obj):
        return contract_services.calculate_contract_allocations(obj)


class SalesContractSignSerializer(serializers.Serializer):
    signed_date = serializers.DateField(required=True)
    signed_file = serializers.JSONField(required=True)


class SalesContractLiquidateSerializer(serializers.Serializer):
    liquidation_date = serializers.DateField(required=False)
    reason = serializers.CharField(required=True)
    liquidation_file = serializers.JSONField(required=False, default=dict)
    open_settlement_notes = serializers.CharField(required=False, allow_blank=True, default="")


class SalesContractTerminateSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True)
    open_settlement_notes = serializers.CharField(required=False, allow_blank=True, default="")


class SalesContractCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True)


class SalesContractRevokeSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class SalesContractAnnexCreateSerializer(serializers.Serializer):
    annex_number = serializers.CharField(required=True)
    change_content = serializers.CharField(required=True)
    new_end_date = serializers.DateField(required=False, allow_null=True)
    new_contract_limit = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, allow_null=True)
    line_adjustments = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class SalesContractAnnexSignSerializer(serializers.Serializer):
    signed_date = serializers.DateField(required=False)
    effective_date = serializers.DateField(required=True)
    signed_file = serializers.JSONField(required=True)


class SalesContractFromQuotationSerializer(serializers.Serializer):
    quotation_id = serializers.UUIDField(required=True)
    contract_number = serializers.CharField(required=True)
    title = serializers.CharField(required=False, allow_blank=True)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    payment_terms_text = serializers.CharField(required=False, allow_blank=True)
    delivery_terms = serializers.CharField(required=False, allow_blank=True)
    customer_representative = serializers.CharField(required=False, allow_blank=True)
    customer_representative_position = serializers.CharField(required=False, allow_blank=True)
    company_signer = serializers.UUIDField(required=False, allow_null=True)
    company_signer_name = serializers.CharField(required=False, allow_blank=True)
    company_signer_position = serializers.CharField(required=False, allow_blank=True)
