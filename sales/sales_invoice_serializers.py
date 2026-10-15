from rest_framework import serializers

from . import models, sales_invoice_services


class SalesInvoiceLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    tax_rate_code = serializers.CharField(source="tax_rate.code", read_only=True)
    tax_rate_percent = serializers.DecimalField(source="tax_rate.rate_percent", max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = models.SalesInvoiceLine
        fields = [
            "id", "line_no", "item", "item_code", "item_name", "description",
            "uom", "uom_name", "quantity", "unit_price", "amount",
            "discount_rate", "discount_amount",
            "tax_rate", "tax_rate_code", "tax_rate_percent", "tax_amount",
            "line_total", "goods_sale_line", "service_sale_line", "order_line",
        ]
        read_only_fields = ["id", "line_no", "amount", "line_total"]
        extra_kwargs = {
            "item_name": {"required": False, "allow_blank": True},
            "unit_price": {"required": False},
            "tax_rate": {"required": False},
        }


class SalesInvoiceSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    goods_sale_number = serializers.CharField(source="goods_sale.number", read_only=True)
    service_sale_number = serializers.CharField(source="service_sale.number", read_only=True)
    sales_order_number = serializers.CharField(source="sales_order.number", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    issued_by_name = serializers.CharField(source="issued_by.username", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    number = serializers.CharField(required=False, allow_blank=True)

    lines = SalesInvoiceLineSerializer(many=True, required=False)

    class Meta:
        model = models.SalesInvoice
        fields = [
            "id", "company", "branch", "number", "document_date", "invoice_date",
            "customer", "customer_code", "customer_name",
            "invoice_category", "invoice_series", "template_code", "invoice_number",
            "seller_name", "seller_tax_code", "seller_address",
            "buyer_name", "buyer_legal_name", "buyer_tax_code", "buyer_address", "buyer_email",
            "payment_method",
            "goods_sale", "goods_sale_number",
            "service_sale", "service_sale_number",
            "sales_order", "sales_order_number",
            "currency", "currency_code", "exchange_rate",
            "subtotal", "discount_amount", "tax_amount", "total_amount",
            "status", "approval_required", "workflow_snapshot",
            "connector", "transaction_code", "issue_control_code",
            "xml_file_url", "pdf_file_url", "lookup_url", "lookup_code",
            "issued_at", "issued_by", "issued_by_name",
            "tax_invoice",
            "issue_error_message",
            "notes", "attachments", "version",
            "rejection_reason", "withdrawal_reason",
            "created_by", "created_by_name", "created_at", "updated_at",
            "lines",
        ]
        read_only_fields = [
            "id", "subtotal", "discount_amount", "tax_amount", "total_amount",
            "status", "invoice_number", "transaction_code",
            "xml_file_url", "pdf_file_url", "lookup_url", "lookup_code",
            "issued_at", "issued_by", "tax_invoice",
            "issue_error_message",
            "created_by", "created_at", "updated_at",
        ]
        validators = []
        extra_kwargs = {
            "number": {"required": False, "allow_blank": True},
            "document_date": {"required": False},
            "invoice_date": {"required": False},
            "currency": {"required": False},
            "exchange_rate": {"required": False},
            "invoice_series": {"required": False, "allow_blank": True},
            "seller_name": {"required": False, "allow_blank": True},
            "seller_tax_code": {"required": False, "allow_blank": True},
            "seller_address": {"required": False, "allow_blank": True},
            "buyer_name": {"required": False, "allow_blank": True},
            "buyer_legal_name": {"required": False, "allow_blank": True},
            "buyer_tax_code": {"required": False, "allow_blank": True},
            "buyer_address": {"required": False, "allow_blank": True},
            "buyer_email": {"required": False, "allow_blank": True},
        }

    def create(self, validated_data):
        lines_data = self.initial_data.get("lines", [])
        request = self.context.get("request")
        return sales_invoice_services.create_sales_invoice(request, validated_data, lines_data)

    def update(self, instance, validated_data):
        lines_data = self.initial_data.get("lines") if "lines" in self.initial_data else None
        request = self.context.get("request")
        return sales_invoice_services.update_sales_invoice(request, instance, validated_data, lines_data)
