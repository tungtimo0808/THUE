from rest_framework import serializers

from . import models, goods_sale_services


class GoodsSaleLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    receivable_or_payment_account_code = serializers.CharField(source="receivable_or_payment_account.code", read_only=True)
    revenue_account_code = serializers.CharField(source="revenue_account.code", read_only=True)
    tax_account_code = serializers.CharField(source="tax_account.code", read_only=True)
    cogs_account_code = serializers.CharField(source="cogs_account.code", read_only=True)
    inventory_account_code = serializers.CharField(source="inventory_account.code", read_only=True)

    class Meta:
        model = models.GoodsSaleLine
        fields = [
            "id", "line_no", "item", "item_code", "item_name",
            "description", "uom", "uom_name", "warehouse", "warehouse_code",
            "quantity", "unit_price", "discount_rate", "discount_amount",
            "tax_rate", "tax_amount", "line_total",
            "receivable_or_payment_account", "receivable_or_payment_account_code",
            "revenue_account", "revenue_account_code",
            "tax_account", "tax_account_code",
            "cogs_account", "cogs_account_code",
            "inventory_account", "inventory_account_code",
            "unit_cost", "cogs_amount",
            "order_line", "inventory_transaction_line",
        ]
        read_only_fields = ["id", "line_no", "line_total", "unit_cost", "cogs_amount"]


class GoodsSaleSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    sales_order_number = serializers.CharField(source="sales_order.number", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    payment_term_name = serializers.CharField(source="payment_term.name", read_only=True)
    company_bank_account_number = serializers.CharField(source="company_bank_account.account_number", read_only=True)
    inventory_transaction_number = serializers.CharField(source="inventory_transaction.number", read_only=True)
    tax_invoice_number = serializers.CharField(source="tax_invoice.invoice_number", read_only=True)
    journal_entry_number = serializers.CharField(source="journal_entry.number", read_only=True)
    receivable_code = serializers.CharField(source="receivable.code", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    posted_by_name = serializers.CharField(source="posted_by.username", read_only=True)
    number = serializers.CharField(required=False, allow_blank=True)
    issue_status = serializers.SerializerMethodField()

    lines = GoodsSaleLineSerializer(many=True, required=False)

    class Meta:
        model = models.GoodsSale
        fields = [
            "id", "company", "branch", "number", "document_date", "posting_date",
            "customer", "customer_code", "customer_name", "customer_address", "customer_tax_code",
            "sales_order", "sales_order_number", "currency", "currency_code", "exchange_rate",
            "payment_type", "payment_term", "payment_term_name", "due_date",
            "company_bank_account", "company_bank_account_number",
            "inventory_handling", "inventory_transaction", "inventory_transaction_number", "inventory_created",
            "issue_status", "delivery", "tax_invoice", "tax_invoice_number", "invoice_link_notes",
            "subtotal", "discount_amount", "tax_amount", "total_amount",
            "status", "approval_required", "workflow_snapshot",
            "description", "notes", "attachments", "version",
            "journal_entry", "journal_entry_number",
            "receivable", "receivable_code",
            "posted_at", "posted_by", "posted_by_name",
            "cancellation_reason", "rejection_reason", "withdrawal_reason",
            "created_by", "created_by_name", "created_at", "updated_at",
            "lines",
        ]
        read_only_fields = [
            "id", "subtotal", "discount_amount", "tax_amount", "total_amount",
            "status", "inventory_created", "journal_entry", "receivable",
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

    def get_issue_status(self, obj):
        from inventory.sale_issue import sale_issue_status
        return sale_issue_status(obj)

    def create(self, validated_data):
        lines_data = self.initial_data.get("lines", [])
        request = self.context.get("request")
        return goods_sale_services.create_goods_sale(request, validated_data, lines_data)

    def update(self, instance, validated_data):
        lines_data = self.initial_data.get("lines") if "lines" in self.initial_data else None
        request = self.context.get("request")
        return goods_sale_services.update_goods_sale(request, instance, validated_data, lines_data)
