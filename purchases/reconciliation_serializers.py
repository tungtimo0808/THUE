from decimal import Decimal
from rest_framework import serializers

from accounts_payable.models import SupplierInvoice, SupplierInvoiceLine
from master_data.models import Item, Party, UnitOfMeasure
from organization.models import Branch, Company

from .models import (
    GoodsPurchase,
    GoodsPurchaseLine,
    MatchingMethod,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseReceipt,
    PurchaseReceiptLine,
    PurchaseReconciliation,
    PurchaseReconciliationLine,
    ReconciliationStatus,
)


class PurchaseReconciliationLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    invoice_line_no = serializers.IntegerField(source="invoice_line.line_no", read_only=True)

    class Meta:
        model = PurchaseReconciliationLine
        fields = (
            "id",
            "line_no",
            "item",
            "item_code",
            "item_name",
            "uom",
            "uom_name",
            "description",
            "invoice_line",
            "invoice_line_no",
            "order_line",
            "receipt_line",
            "purchase_line",
            "order_quantity",
            "received_quantity",
            "invoice_quantity",
            "matched_quantity",
            "order_unit_price",
            "invoice_unit_price",
            "expected_tax_rate",
            "invoice_tax_rate",
            "document_pre_tax_amount",
            "invoice_pre_tax_amount",
            "tax_difference",
            "total_difference",
            "line_result",
            "difference_reason",
        )


class PurchaseReconciliationDetailSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    supplier_code = serializers.CharField(source="supplier.code", read_only=True)
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    invoice_series = serializers.CharField(source="invoice.invoice_series", read_only=True)
    purchase_order_number = serializers.CharField(source="purchase_order.number", read_only=True)
    purchase_receipt_number = serializers.CharField(source="purchase_receipt.number", read_only=True)
    goods_purchase_number = serializers.CharField(source="goods_purchase.number", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    resolved_by_name = serializers.CharField(source="resolved_by.username", read_only=True)
    lines = PurchaseReconciliationLineSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseReconciliation
        fields = (
            "id",
            "number",
            "company",
            "branch",
            "reconciliation_date",
            "matching_method",
            "supplier",
            "supplier_code",
            "supplier_name",
            "invoice",
            "invoice_number",
            "invoice_series",
            "purchase_order",
            "purchase_order_number",
            "purchase_receipt",
            "purchase_receipt_number",
            "goods_purchase",
            "goods_purchase_number",
            "status",
            "notes",
            "total_invoice_amount",
            "total_matched_amount",
            "total_difference_amount",
            "difference_reason",
            "resolved_by",
            "resolved_by_name",
            "resolved_at",
            "resolution_note",
            "version",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
            "lines",
        )


class PurchaseReconciliationListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    supplier_code = serializers.CharField(source="supplier.code", read_only=True)
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    invoice_series = serializers.CharField(source="invoice.invoice_series", read_only=True)

    class Meta:
        model = PurchaseReconciliation
        fields = (
            "id",
            "number",
            "reconciliation_date",
            "matching_method",
            "supplier",
            "supplier_code",
            "supplier_name",
            "invoice",
            "invoice_number",
            "invoice_series",
            "status",
            "total_invoice_amount",
            "total_matched_amount",
            "total_difference_amount",
            "version",
            "created_at",
        )


class LineInputSerializer(serializers.Serializer):
    invoice_line = serializers.UUIDField()
    order_line = serializers.UUIDField(required=False, allow_null=True)
    receipt_line = serializers.UUIDField(required=False, allow_null=True)
    purchase_line = serializers.UUIDField(required=False, allow_null=True)
    matched_quantity = serializers.DecimalField(max_digits=20, decimal_places=6, required=False)
    difference_reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class PurchaseReconciliationCreateSerializer(serializers.Serializer):
    invoice = serializers.PrimaryKeyRelatedField(queryset=SupplierInvoice.objects.all())
    matching_method = serializers.ChoiceField(choices=MatchingMethod.choices)
    purchase_order = serializers.PrimaryKeyRelatedField(
        queryset=PurchaseOrder.objects.all(), required=False, allow_null=True
    )
    purchase_receipt = serializers.PrimaryKeyRelatedField(
        queryset=PurchaseReceipt.objects.all(), required=False, allow_null=True
    )
    goods_purchase = serializers.PrimaryKeyRelatedField(
        queryset=GoodsPurchase.objects.all(), required=False, allow_null=True
    )
    reconciliation_date = serializers.DateField(required=False)
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    lines = LineInputSerializer(many=True)
