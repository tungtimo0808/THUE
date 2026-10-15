from rest_framework import serializers

from . import models, sales_return_services


class SalesReturnLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    revenue_deduction_account_code = serializers.CharField(source="revenue_deduction_account.code", read_only=True)
    tax_account_code = serializers.CharField(source="tax_account.code", read_only=True)
    receivable_account_code = serializers.CharField(source="receivable_account.code", read_only=True)
    inventory_account_code = serializers.CharField(source="inventory_account.code", read_only=True)
    cogs_account_code = serializers.CharField(source="cogs_account.code", read_only=True)

    class Meta:
        model = models.SalesReturnLine
        fields = [
            "id", "line_no", "goods_sale_line",
            "item", "item_code", "item_name", "description",
            "uom", "uom_name", "warehouse", "warehouse_code",
            "sold_quantity", "return_quantity",
            "unit_price", "discount_amount", "tax_rate", "tax_amount", "line_total",
            "unit_cost", "cogs_amount",
            "revenue_deduction_account", "revenue_deduction_account_code",
            "tax_account", "tax_account_code",
            "receivable_account", "receivable_account_code",
            "inventory_account", "inventory_account_code",
            "cogs_account", "cogs_account_code",
        ]
        read_only_fields = [
            "id", "line_no", "sold_quantity", "line_total", "unit_cost", "cogs_amount"
        ]


class SalesReturnSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    goods_sale_number = serializers.CharField(source="goods_sale.number", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    inventory_transaction_number = serializers.CharField(source="inventory_transaction.number", read_only=True)
    original_tax_invoice_number = serializers.CharField(source="original_tax_invoice.invoice_number", read_only=True)
    tax_invoice_number = serializers.CharField(source="tax_invoice.invoice_number", read_only=True)
    journal_entry_number = serializers.CharField(source="journal_entry.number", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    posted_by_name = serializers.CharField(source="posted_by.username", read_only=True)
    number = serializers.CharField(required=False, allow_blank=True)
    lines = serializers.ListField(child=serializers.DictField(), required=False, write_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["lines"] = SalesReturnLineSerializer(instance.lines.all(), many=True).data
        return data

    class Meta:
        model = models.SalesReturn
        fields = [
            "id", "company", "branch", "number", "document_date", "posting_date",
            "customer", "customer_code", "customer_name",
            "goods_sale", "goods_sale_number",
            "currency", "currency_code", "exchange_rate",
            "return_reason", "inventory_handling",
            "inventory_transaction", "inventory_transaction_number", "inventory_created",
            "original_tax_invoice", "original_tax_invoice_number",
            "tax_invoice", "tax_invoice_number", "invoice_link_notes",
            "subtotal", "discount_amount", "tax_amount", "total_amount",
            "refundable_amount", "refunded_amount",
            "status", "approval_required", "workflow_snapshot",
            "notes", "attachments", "version",
            "journal_entry", "journal_entry_number",
            "posted_at", "posted_by", "posted_by_name",
            "cancellation_reason", "rejection_reason", "withdrawal_reason",
            "created_by", "created_by_name", "created_at", "updated_at",
            "lines",
        ]
        read_only_fields = [
            "id", "subtotal", "discount_amount", "tax_amount", "total_amount",
            "refundable_amount", "refunded_amount",
            "status", "inventory_created", "journal_entry",
            "posted_at", "posted_by", "created_by", "created_at", "updated_at",
        ]
        validators = []
        extra_kwargs = {
            "number": {"required": False, "allow_blank": True},
            "document_date": {"required": False},
            "posting_date": {"required": False},
            "currency": {"required": False},
            "exchange_rate": {"required": False},
        }

    def create(self, validated_data):
        lines_data = self.initial_data.get("lines", [])
        request = self.context.get("request")
        return sales_return_services.create_sales_return(request, validated_data, lines_data)

    def update(self, instance, validated_data):
        lines_data = self.initial_data.get("lines") if "lines" in self.initial_data else None
        request = self.context.get("request")
        return sales_return_services.update_sales_return(request, instance, validated_data, lines_data)
