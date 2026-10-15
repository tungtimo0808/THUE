from decimal import Decimal
from rest_framework import serializers

from . import models


class DiscountInvoiceLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)

    class Meta:
        model = models.SalesDiscountInvoiceLine
        fields = [
            "id",
            "line_no",
            "original_invoice",
            "original_invoice_series",
            "original_invoice_number",
            "original_invoice_date",
            "original_invoice_line",
            "item",
            "item_code",
            "item_name",
            "description",
            "uom",
            "uom_name",
            "eligible_revenue",
            "used_discount_amount",
            "held_discount_amount",
            "allocated_discount_amount",
            "tax_rate",
            "tax_rate_percentage",
            "adjusted_tax_amount",
            "line_total",
        ]


class DiscountInvoiceListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = models.SalesDiscountInvoice
        fields = [
            "id",
            "code",
            "number",
            "invoice_series",
            "template_code",
            "invoice_number",
            "invoice_date",
            "customer",
            "customer_name",
            "buyer_name",
            "buyer_tax_code",
            "period_start",
            "period_end",
            "discount_basis",
            "calculation_method",
            "discount_rate",
            "eligible_revenue",
            "total_discount_before_tax",
            "total_tax_amount",
            "total_adjusted_amount",
            "currency",
            "currency_code",
            "status",
            "status_display",
            "created_at",
            "version",
        ]


class DiscountInvoiceDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    lines = DiscountInvoiceLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.SalesDiscountInvoice
        fields = [
            "id",
            "code",
            "number",
            "invoice_series",
            "template_code",
            "invoice_number",
            "invoice_date",
            "document_date",
            "company",
            "branch",
            "branch_name",
            "customer",
            "customer_name",
            "seller_name",
            "seller_tax_code",
            "seller_address",
            "buyer_name",
            "buyer_legal_name",
            "buyer_tax_code",
            "buyer_address",
            "buyer_email",
            "discount_basis",
            "contract",
            "period_start",
            "period_end",
            "calculation_method",
            "discount_rate",
            "eligible_revenue",
            "total_discount_before_tax",
            "total_tax_amount",
            "total_adjusted_amount",
            "subtotal",
            "tax_amount",
            "total_amount",
            "currency",
            "currency_code",
            "exchange_rate",
            "description",
            "accounting_document_ref",
            "status",
            "status_display",
            "transaction_code",
            "issue_control_code",
            "tax_invoice",
            "xml_file_url",
            "pdf_file_url",
            "lookup_url",
            "lookup_code",
            "issue_error_message",
            "issued_at",
            "issued_by",
            "version",
            "attachments",
            "cancellation_reason",
            "rejection_reason",
            "withdrawal_reason",
            "created_at",
            "updated_at",
            "lines",
        ]


class DiscountInvoiceLineInputSerializer(serializers.Serializer):
    line_no = serializers.IntegerField(required=False)
    original_invoice = serializers.UUIDField(required=False)
    original_invoice_id = serializers.UUIDField(required=False)
    original_invoice_line = serializers.UUIDField(required=False)
    original_invoice_line_id = serializers.UUIDField(required=False)
    item = serializers.UUIDField(required=False, allow_null=True)
    item_id = serializers.UUIDField(required=False, allow_null=True)
    item_name = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    uom = serializers.UUIDField(required=False, allow_null=True)
    uom_id = serializers.UUIDField(required=False, allow_null=True)
    eligible_revenue = serializers.DecimalField(max_digits=20, decimal_places=4, required=False)
    used_discount_amount = serializers.DecimalField(max_digits=20, decimal_places=4, required=False)
    held_discount_amount = serializers.DecimalField(max_digits=20, decimal_places=4, required=False)
    allocated_discount_amount = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, allow_null=True)
    tax_rate = serializers.UUIDField(required=False, allow_null=True)
    tax_rate_id = serializers.UUIDField(required=False, allow_null=True)
    tax_rate_percentage = serializers.DecimalField(max_digits=9, decimal_places=4, required=False)


class DiscountInvoiceInputSerializer(serializers.Serializer):
    company = serializers.UUIDField(required=False)
    branch = serializers.UUIDField(required=False, allow_null=True)
    customer = serializers.UUIDField(required=True)
    invoice_series = serializers.CharField(max_length=50, required=True)
    template_code = serializers.CharField(max_length=50, required=False, allow_blank=True)
    invoice_date = serializers.DateField(required=False)
    currency = serializers.UUIDField(required=False)
    exchange_rate = serializers.DecimalField(max_digits=20, decimal_places=8, required=False)
    discount_basis = serializers.CharField(max_length=255, required=True)
    contract = serializers.UUIDField(required=False, allow_null=True)
    period_start = serializers.DateField(required=True)
    period_end = serializers.DateField(required=True)
    calculation_method = serializers.ChoiceField(
        choices=models.DiscountInvoiceCalculationMethod.choices,
        default=models.DiscountInvoiceCalculationMethod.AMOUNT
    )
    discount_rate = serializers.DecimalField(max_digits=9, decimal_places=4, required=False)
    total_discount_before_tax = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)
    buyer_email = serializers.EmailField(required=False, allow_blank=True)
    accounting_document_ref = serializers.CharField(max_length=100, required=False, allow_blank=True)
    lines = serializers.ListField(
        child=DiscountInvoiceLineInputSerializer(),
        required=True,
        allow_empty=False,
    )


class CalculateAllocationInputSerializer(serializers.Serializer):
    total_discount_before_tax = serializers.DecimalField(max_digits=20, decimal_places=4, required=True)
    lines = serializers.ListField(
        child=DiscountInvoiceLineInputSerializer(),
        required=True,
        allow_empty=False,
    )


class IssueDiscountInvoiceSerializer(serializers.Serializer):
    force_fail = serializers.BooleanField(required=False, default=False)
    error_message = serializers.CharField(required=False, allow_blank=True, default="")


class CancelDiscountInvoiceSerializer(serializers.Serializer):
    cancellation_reason = serializers.CharField(max_length=500, required=True)


class WithdrawDiscountInvoiceSerializer(serializers.Serializer):
    withdrawal_reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class SendEmailDiscountInvoiceSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
