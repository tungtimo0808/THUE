from rest_framework import serializers

from . import models


class PurchaseCostLineSerializer(serializers.ModelSerializer):
    cost_type_display = serializers.CharField(source="get_cost_type_display", read_only=True)
    allocation_status_display = serializers.CharField(source="get_allocation_status_display", read_only=True)

    class Meta:
        model = models.PurchaseCostLine
        fields = (
            "id",
            "line_no",
            "cost_type",
            "cost_type_display",
            "description",
            "pre_tax_amount",
            "tax_rate",
            "tax_amount",
            "total_amount",
            "requires_allocation",
            "account",
            "cost_center",
            "expense_item",
            "allocation_status",
            "allocation_status_display",
            "allocated_amount",
        )
        read_only_fields = ("id", "allocated_amount")


class PurchaseCostSerializer(serializers.ModelSerializer):
    lines = PurchaseCostLineSerializer(many=True, required=False)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    allocation_status_display = serializers.CharField(source="get_allocation_status_display", read_only=True)
    payment_type_display = serializers.CharField(source="get_payment_type_display", read_only=True)

    class Meta:
        model = models.PurchaseCost
        fields = (
            "id",
            "company",
            "branch",
            "number",
            "document_date",
            "posting_date",
            "supplier",
            "payment_type",
            "payment_type_display",
            "payment_account",
            "supplier_invoice",
            "related_orders",
            "related_goods_purchases",
            "version",
            "subtotal",
            "tax_amount",
            "total_amount",
            "status",
            "status_display",
            "allocation_status",
            "allocation_status_display",
            "notes",
            "attachments",
            "rejection_reason",
            "cancellation_reason",
            "journal_entry",
            "created_by",
            "created_at",
            "updated_at",
            "lines",
        )
        read_only_fields = (
            "id",
            "version",
            "subtotal",
            "tax_amount",
            "total_amount",
            "status",
            "allocation_status",
            "rejection_reason",
            "cancellation_reason",
            "journal_entry",
            "created_by",
            "created_at",
            "updated_at",
        )


class EligiblePurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = models.PurchaseOrder
        fields = (
            "id",
            "number",
            "document_date",
            "supplier",
            "supplier_name",
            "total_amount",
            "status",
        )


class EligibleGoodsPurchaseSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = models.GoodsPurchase
        fields = (
            "id",
            "number",
            "document_date",
            "supplier",
            "supplier_name",
            "purchase_type",
            "total_amount",
            "status",
        )
