from decimal import Decimal
from rest_framework import serializers

from master_data.models import Bank, CompanyBankAccount, Currency, Item, Party, TaxRate, UnitOfMeasure
from organization.models import Branch, Company
from . import models


class SalesCommercialInvoiceLineSerializer(serializers.ModelSerializer):
    item_id = serializers.PrimaryKeyRelatedField(
        queryset=Item.objects.all(), source="item", required=False, allow_null=True
    )
    uom_id = serializers.PrimaryKeyRelatedField(
        queryset=UnitOfMeasure.objects.all(), source="uom", required=False, allow_null=True
    )
    tax_rate_id = serializers.PrimaryKeyRelatedField(
        queryset=TaxRate.objects.all(), source="tax_rate", required=False, allow_null=True
    )
    source_order_line_id = serializers.PrimaryKeyRelatedField(
        queryset=models.SalesOrderLine.objects.all(), source="source_order_line", required=False, allow_null=True
    )
    source_contract_line_id = serializers.PrimaryKeyRelatedField(
        queryset=models.SalesContractLine.objects.all(), source="source_contract_line", required=False, allow_null=True
    )

    class Meta:
        model = models.SalesCommercialInvoiceLine
        fields = [
            "id",
            "line_no",
            "item_id",
            "item_name",
            "description",
            "hs_code",
            "origin_country",
            "uom_id",
            "uom_name",
            "quantity",
            "unit_price",
            "discount_amount",
            "line_amount",
            "package_quantity",
            "net_weight",
            "gross_weight",
            "tax_rate_id",
            "tax_rate_percentage",
            "tax_amount",
            "line_total",
            "source_order_line_id",
            "source_contract_line_id",
            "source_sales_line_id",
        ]
        read_only_fields = ["id", "line_amount", "tax_amount", "line_total"]


class SalesCommercialInvoiceListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    invoice_form_display = serializers.CharField(source="get_invoice_form_display", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)

    class Meta:
        model = models.SalesCommercialInvoice
        fields = [
            "id",
            "code",
            "number",
            "invoice_number",
            "invoice_form",
            "invoice_form_display",
            "template_code",
            "invoice_series",
            "invoice_date",
            "customer",
            "customer_name",
            "buyer_name",
            "buyer_country",
            "currency",
            "currency_code",
            "exchange_rate",
            "total_lines_amount",
            "total_charges",
            "total_tax_amount",
            "total_amount",
            "incoterms",
            "payment_terms",
            "status",
            "status_display",
            "document_version",
            "is_current_version",
            "xml_file_url",
            "pdf_file_url",
            "created_at",
            "updated_at",
        ]


class SalesCommercialInvoiceDetailSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    invoice_form_display = serializers.CharField(source="get_invoice_form_display", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    lines = SalesCommercialInvoiceLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.SalesCommercialInvoice
        fields = [
            "id",
            "code",
            "number",
            "invoice_number",
            "invoice_form",
            "invoice_form_display",
            "template_code",
            "invoice_series",
            "invoice_date",
            "company",
            "branch",
            "branch_name",
            "seller_name",
            "seller_address",
            "seller_tax_code",
            "seller_contact",
            "customer",
            "customer_name",
            "buyer_name",
            "buyer_address",
            "buyer_country",
            "buyer_tax_code",
            "buyer_email",
            "consignee_name",
            "consignee_address",
            "consignee_country",
            "sales_contract",
            "sales_order",
            "source_sales_document_type",
            "source_sales_document_id",
            "currency",
            "currency_code",
            "exchange_rate",
            "incoterms_term",
            "incoterms_version",
            "incoterms_location",
            "incoterms",
            "payment_terms",
            "beneficiary_bank",
            "beneficiary_bank_account",
            "beneficiary_bank_info",
            "transport_method",
            "port_of_loading",
            "port_of_discharge",
            "vessel_flight_no",
            "bill_of_lading_number",
            "bill_of_lading_date",
            "customs_declaration_number",
            "customs_clearance_date",
            "freight_charge",
            "insurance_charge",
            "other_charges",
            "total_lines_amount",
            "total_charges",
            "total_tax_amount",
            "subtotal",
            "tax_amount",
            "fee_amount",
            "total_amount",
            "published_at",
            "published_by",
            "connector",
            "transaction_code",
            "issue_control_code",
            "tax_invoice",
            "xml_file_url",
            "pdf_file_url",
            "issue_error_message",
            "issued_at",
            "issued_by",
            "document_version",
            "is_current_version",
            "parent_invoice",
            "status",
            "status_display",
            "version",
            "attachments",
            "notes",
            "created_at",
            "updated_at",
            "lines",
        ]


class SalesCommercialInvoiceLineInputSerializer(serializers.Serializer):
    line_no = serializers.IntegerField(required=False)
    item = serializers.PrimaryKeyRelatedField(queryset=Item.objects.all(), required=False, allow_null=True)
    item_name = serializers.CharField(required=False, allow_blank=True, default="")
    description = serializers.CharField(required=True)
    hs_code = serializers.CharField(required=False, allow_blank=True, default="")
    origin_country = serializers.CharField(required=False, allow_blank=True, default="")
    uom = serializers.PrimaryKeyRelatedField(queryset=UnitOfMeasure.objects.all(), required=False, allow_null=True)
    uom_name = serializers.CharField(required=False, allow_blank=True, default="")
    quantity = serializers.DecimalField(max_digits=20, decimal_places=4, required=True)
    unit_price = serializers.DecimalField(max_digits=20, decimal_places=4, required=True)
    discount_amount = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, default=0)
    package_quantity = serializers.IntegerField(required=False, allow_null=True)
    net_weight = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, allow_null=True)
    gross_weight = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, allow_null=True)
    tax_rate = serializers.PrimaryKeyRelatedField(queryset=TaxRate.objects.all(), required=False, allow_null=True)
    tax_rate_percentage = serializers.DecimalField(max_digits=9, decimal_places=4, required=False, default=0)
    source_order_line = serializers.PrimaryKeyRelatedField(queryset=models.SalesOrderLine.objects.all(), required=False, allow_null=True)
    source_contract_line = serializers.PrimaryKeyRelatedField(queryset=models.SalesContractLine.objects.all(), required=False, allow_null=True)
    source_sales_line_id = serializers.UUIDField(required=False, allow_null=True)


class SalesCommercialInvoiceCreateUpdateSerializer(serializers.Serializer):
    invoice_form = serializers.ChoiceField(choices=models.CommercialInvoiceForm.choices, default=models.CommercialInvoiceForm.DOCUMENT)
    template_code = serializers.CharField(required=False, default="COMM_INV_EN")
    invoice_series = serializers.CharField(required=False, allow_blank=True, default="")
    invoice_date = serializers.DateField(required=False)
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False, allow_null=True)
    customer = serializers.PrimaryKeyRelatedField(queryset=Party.objects.all(), required=True)
    buyer_name = serializers.CharField(required=True)
    buyer_address = serializers.CharField(required=True)
    buyer_country = serializers.CharField(required=True)
    buyer_tax_code = serializers.CharField(required=False, allow_blank=True, default="")
    buyer_email = serializers.EmailField(required=False, allow_blank=True, default="")
    consignee_name = serializers.CharField(required=False, allow_blank=True, default="")
    consignee_address = serializers.CharField(required=False, allow_blank=True, default="")
    consignee_country = serializers.CharField(required=False, allow_blank=True, default="")
    sales_contract = serializers.PrimaryKeyRelatedField(queryset=models.SalesContract.objects.all(), required=False, allow_null=True)
    sales_order = serializers.PrimaryKeyRelatedField(queryset=models.SalesOrder.objects.all(), required=False, allow_null=True)
    source_sales_document_type = serializers.CharField(required=False, allow_blank=True, default="")
    source_sales_document_id = serializers.UUIDField(required=False, allow_null=True)
    currency = serializers.PrimaryKeyRelatedField(queryset=Currency.objects.all(), required=True)
    exchange_rate = serializers.DecimalField(max_digits=20, decimal_places=8, required=False, default=1)
    incoterms_term = serializers.CharField(required=False, allow_blank=True, default="")
    incoterms_version = serializers.CharField(required=False, allow_blank=True, default="2020")
    incoterms_location = serializers.CharField(required=False, allow_blank=True, default="")
    incoterms = serializers.CharField(required=False, allow_blank=True, default="")
    payment_terms = serializers.CharField(required=True)
    beneficiary_bank = serializers.PrimaryKeyRelatedField(queryset=Bank.objects.all(), required=False, allow_null=True)
    beneficiary_bank_account = serializers.PrimaryKeyRelatedField(queryset=CompanyBankAccount.objects.all(), required=False, allow_null=True)
    beneficiary_bank_info = serializers.CharField(required=False, allow_blank=True, default="")
    transport_method = serializers.CharField(required=False, allow_blank=True, default="SEA")
    port_of_loading = serializers.CharField(required=False, allow_blank=True, default="")
    port_of_discharge = serializers.CharField(required=False, allow_blank=True, default="")
    vessel_flight_no = serializers.CharField(required=False, allow_blank=True, default="")
    bill_of_lading_number = serializers.CharField(required=False, allow_blank=True, default="")
    bill_of_lading_date = serializers.DateField(required=False, allow_null=True)
    customs_declaration_number = serializers.CharField(required=False, allow_blank=True, default="")
    customs_clearance_date = serializers.DateField(required=False, allow_null=True)
    freight_charge = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, default=0)
    insurance_charge = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, default=0)
    other_charges = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, default=0)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    lines = SalesCommercialInvoiceLineInputSerializer(many=True, required=False)


class CommercialInvoiceReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class SendEmailSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    subject = serializers.CharField(required=False, allow_blank=True)
    body = serializers.CharField(required=False, allow_blank=True)
