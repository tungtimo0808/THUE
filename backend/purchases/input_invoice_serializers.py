from rest_framework import serializers

from accounts_payable.models import SupplierInvoice, SupplierInvoiceLine
from master_data.models import Party
from organization.models import Branch

from .models import GoodsPurchaseLine, PurchaseInvoiceMatch


class InputInvoiceLineInputSerializer(serializers.Serializer):
    line_no = serializers.IntegerField(min_value=1)
    description = serializers.CharField(max_length=500)
    item = serializers.UUIDField(required=False, allow_null=True)
    uom = serializers.UUIDField(required=False, allow_null=True)
    tracks_quantity = serializers.BooleanField(default=True)
    quantity = serializers.DecimalField(max_digits=20, decimal_places=4, required=False)
    unit_price = serializers.DecimalField(max_digits=20, decimal_places=4, required=False)
    discount_amount = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, default=0)
    taxable_amount = serializers.DecimalField(max_digits=20, decimal_places=4)
    tax_rate_percent = serializers.DecimalField(max_digits=9, decimal_places=4, required=False, allow_null=True)
    tax_amount = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, default=0)
    total_amount = serializers.DecimalField(max_digits=20, decimal_places=4)


class InvoiceMatchInputSerializer(serializers.Serializer):
    invoice_line_no = serializers.IntegerField(min_value=1)
    purchase_line = serializers.PrimaryKeyRelatedField(queryset=GoodsPurchaseLine.objects.all())
    amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    quantity = serializers.DecimalField(max_digits=20, decimal_places=6, required=False, default=0)


class InputInvoiceCreateSerializer(serializers.Serializer):
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all())
    supplier = serializers.PrimaryKeyRelatedField(queryset=Party.objects.all())
    source = serializers.ChoiceField(choices=("MANUAL", "IMPORT", "EINVOICE"), default="MANUAL")
    invoice_type = serializers.ChoiceField(choices=("ORIGINAL", "ADJUSTMENT", "REPLACEMENT"), default="ORIGINAL")
    adjustment_effect = serializers.ChoiceField(choices=("INCREASE", "DECREASE"), required=False, allow_blank=True)
    original_invoice = serializers.PrimaryKeyRelatedField(queryset=SupplierInvoice.objects.all(), required=False, allow_null=True)
    invoice_template = serializers.CharField(max_length=50)
    invoice_series = serializers.CharField(max_length=50)
    invoice_number = serializers.CharField(max_length=80)
    invoice_date = serializers.DateField()
    seller_name = serializers.CharField(max_length=255)
    supplier_tax_code = serializers.CharField(max_length=30)
    seller_address = serializers.CharField(max_length=500)
    buyer_name = serializers.CharField(max_length=255)
    buyer_tax_code = serializers.CharField(max_length=30)
    buyer_address = serializers.CharField(max_length=500, required=False, allow_blank=True)
    purchase_order = serializers.UUIDField(required=False, allow_null=True)
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True)
    subtotal = serializers.DecimalField(max_digits=20, decimal_places=4)
    discount_amount = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, default=0)
    tax_amount = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, default=0)
    total_amount = serializers.DecimalField(max_digits=20, decimal_places=4)
    lines = InputInvoiceLineInputSerializer(many=True)
    links = InvoiceMatchInputSerializer(many=True, required=False, default=list)
    save_draft = serializers.BooleanField(required=False, default=False)


class InputInvoiceLineReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierInvoiceLine
        fields = ("id", "line_no", "item", "description", "uom", "quantity", "tracks_quantity",
                  "unit_price", "discount_amount", "taxable_amount", "tax_rate_percent",
                  "tax_amount", "total_amount")


class InvoiceMatchReadSerializer(serializers.ModelSerializer):
    purchase_line = serializers.UUIDField(source="purchase_line_id")
    invoice_line = serializers.UUIDField(source="invoice_line_id")

    class Meta:
        model = PurchaseInvoiceMatch
        fields = ("id", "invoice_line", "purchase_line", "quantity", "amount")


class InputInvoiceReadSerializer(serializers.ModelSerializer):
    lines = InputInvoiceLineReadSerializer(many=True)
    adjusted_total_amount = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    files = serializers.SerializerMethodField()
    links = serializers.SerializerMethodField()

    class Meta:
        model = SupplierInvoice
        fields = ("id", "company", "branch", "supplier", "source", "invoice_type", "adjustment_effect",
            "original_invoice", "is_replaced", "invoice_template", "invoice_series", "invoice_number",
            "invoice_date", "seller_name", "supplier_tax_code", "seller_address", "buyer_name",
            "buyer_tax_code", "buyer_address", "purchase_order", "notes", "currency", "subtotal",
            "discount_amount", "tax_amount", "total_amount", "linked_amount", "validation_status",
            "adjusted_total_amount", "match_status", "match_details", "status", "lines", "links", "files", "created_at")

    def get_files(self, obj):
        return [{"id": str(file.pk), "kind": file.kind, "filename": file.filename,
                 "size": file.size, "sha256": file.sha256} for file in obj.purchase_files.all()]

    def get_links(self, obj):
        links = PurchaseInvoiceMatch.objects.filter(invoice_line__invoice=obj).select_related("purchase_line")
        return InvoiceMatchReadSerializer(links, many=True).data
