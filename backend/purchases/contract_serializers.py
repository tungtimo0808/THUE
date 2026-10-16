from decimal import Decimal
from rest_framework import serializers

from . import models


class PurchaseContractLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    uom_code = serializers.CharField(source="uom.code", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    remaining_quantity = serializers.SerializerMethodField()

    class Meta:
        model = models.PurchaseContractLine
        fields = (
            "id",
            "line_no",
            "item",
            "item_code",
            "item_name",
            "uom",
            "uom_code",
            "uom_name",
            "quantity",
            "unit_price",
            "discount_rate",
            "discount_amount",
            "tax_rate",
            "pre_tax_amount",
            "tax_amount",
            "total_amount",
            "expected_delivery_date",
            "description",
            "ordered_quantity",
            "ordered_amount",
            "remaining_quantity",
        )
        read_only_fields = (
            "id",
            "discount_amount",
            "pre_tax_amount",
            "tax_amount",
            "total_amount",
            "ordered_quantity",
            "ordered_amount",
            "remaining_quantity",
        )

    def get_remaining_quantity(self, obj):
        return max(Decimal("0"), obj.quantity - obj.ordered_quantity)


class PurchaseContractSerializer(serializers.ModelSerializer):
    lines = PurchaseContractLineSerializer(many=True, required=False)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    supplier_code = serializers.CharField(source="supplier.code", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    payment_term_name = serializers.CharField(source="payment_term.name", read_only=True)
    remaining_amount = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = models.PurchaseContract
        fields = (
            "id",
            "company",
            "branch",
            "department",
            "number",
            "title",
            "document_date",
            "signed_date",
            "start_date",
            "end_date",
            "supplier",
            "supplier_code",
            "supplier_name",
            "currency",
            "currency_code",
            "exchange_rate",
            "payment_term",
            "payment_term_name",
            "assigned_to",
            "delivery_place",
            "delivery_term",
            "content",
            "notes",
            "payment_schedules",
            "attachments",
            "version",
            "subtotal",
            "discount_amount",
            "tax_amount",
            "total_amount",
            "ordered_amount",
            "remaining_amount",
            "progress_percent",
            "received_amount",
            "invoiced_amount",
            "paid_amount",
            "status",
            "status_display",
            "rejection_reason",
            "cancellation_reason",
            "completion_reason",
            "created_by",
            "submitted_at",
            "approved_at",
            "created_at",
            "updated_at",
            "lines",
        )
        read_only_fields = (
            "id",
            "number",
            "version",
            "subtotal",
            "discount_amount",
            "tax_amount",
            "total_amount",
            "ordered_amount",
            "remaining_amount",
            "progress_percent",
            "received_amount",
            "invoiced_amount",
            "paid_amount",
            "status",
            "rejection_reason",
            "cancellation_reason",
            "completion_reason",
            "created_by",
            "submitted_at",
            "approved_at",
            "created_at",
            "updated_at",
        )

    def get_remaining_amount(self, obj):
        return max(Decimal("0"), obj.total_amount - obj.ordered_amount)

    def get_progress_percent(self, obj):
        if obj.total_amount > Decimal("0"):
            return min(Decimal("100"), (obj.ordered_amount / obj.total_amount * Decimal("100")).quantize(Decimal("0.01")))
        return Decimal("0")


class CreateOrderLineInputSerializer(serializers.Serializer):
    contract_line_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=20, decimal_places=4)


class CreateOrderFromContractSerializer(serializers.Serializer):
    document_date = serializers.DateField(required=False)
    delivery_date = serializers.DateField(required=False)
    branch = serializers.UUIDField(required=False, allow_null=True)
    receiving_warehouse = serializers.UUIDField(required=False, allow_null=True)
    receiving_location = serializers.CharField(required=False, allow_blank=True)
    delivery_address = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    lines = CreateOrderLineInputSerializer(many=True)
