from rest_framework import serializers


class OrderTrackingFilterSerializer(serializers.Serializer):
    company_id = serializers.UUIDField(required=True)
    code = serializers.CharField(required=False, allow_blank=True)
    supplier_id = serializers.CharField(required=False, allow_blank=True)
    supplier = serializers.CharField(required=False, allow_blank=True)
    order_date_from = serializers.DateField(required=False)
    order_date_to = serializers.DateField(required=False)
    expected_delivery_date_from = serializers.DateField(required=False)
    expected_delivery_date_to = serializers.DateField(required=False)
    delivery_date_from = serializers.DateField(required=False)
    delivery_date_to = serializers.DateField(required=False)
    status = serializers.CharField(required=False, allow_blank=True)
    receiving_status = serializers.ChoiceField(
        choices=["NOT_RECEIVED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED"],
        required=False,
    )
    invoicing_status = serializers.ChoiceField(
        choices=["NOT_INVOICED", "PARTIALLY_INVOICED", "FULLY_INVOICED", "OVER_INVOICED"],
        required=False,
    )
    overdue_status = serializers.ChoiceField(
        choices=["ALL", "NOT_OVERDUE", "OVERDUE"],
        required=False,
    )
    buyer = serializers.UUIDField(required=False)
    buyer_id = serializers.UUIDField(required=False)
    assignee = serializers.UUIDField(required=False)


class SupplierSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()
    name = serializers.CharField()


class BuyerSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    email = serializers.EmailField(allow_blank=True, required=False)


class CurrencySummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()


class OrderTrackingListItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    number = serializers.CharField()
    document_date = serializers.DateField()
    status = serializers.CharField()
    status_display = serializers.CharField()
    supplier = SupplierSummarySerializer(allow_null=True)
    buyer = BuyerSummarySerializer(allow_null=True)
    currency = CurrencySummarySerializer(allow_null=True)
    delivery_date = serializers.DateField(allow_null=True)
    initial_delivery_date = serializers.DateField(allow_null=True)
    total_pre_tax_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    progress_percent = serializers.DecimalField(max_digits=7, decimal_places=2)
    receiving_status = serializers.CharField()
    receiving_status_display = serializers.CharField()
    invoicing_status = serializers.CharField()
    invoicing_status_display = serializers.CharField()
    invoiced_pre_tax_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    order_value_to_invoice = serializers.DecimalField(max_digits=24, decimal_places=4)
    difference_invoice_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    is_overdue = serializers.BooleanField()
    overdue_days = serializers.IntegerField()
    completed_late = serializers.BooleanField()
    lines_count = serializers.IntegerField()


class ItemSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()
    name = serializers.CharField()
    item_type = serializers.CharField()


class UomSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()
    name = serializers.CharField()


class OrderTrackingLineSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    line_no = serializers.IntegerField()
    item = ItemSummarySerializer()
    uom = UomSummarySerializer(allow_null=True)
    description = serializers.CharField(allow_blank=True)
    is_service = serializers.BooleanField()
    unit_price = serializers.DecimalField(max_digits=20, decimal_places=4)
    ordered_quantity = serializers.DecimalField(max_digits=20, decimal_places=6)
    received_quantity = serializers.DecimalField(max_digits=20, decimal_places=6)
    returned_quantity = serializers.DecimalField(max_digits=20, decimal_places=6)
    net_received_quantity = serializers.DecimalField(max_digits=20, decimal_places=6)
    remaining_quantity = serializers.DecimalField(max_digits=20, decimal_places=6)
    is_over_received = serializers.BooleanField()
    over_received_quantity = serializers.DecimalField(max_digits=20, decimal_places=6)
    accepted_value = serializers.DecimalField(max_digits=24, decimal_places=4)
    discounted_value = serializers.DecimalField(max_digits=24, decimal_places=4)
    remaining_service_value = serializers.DecimalField(max_digits=24, decimal_places=4)
    is_over_accepted_value = serializers.BooleanField()
    pre_tax_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    realized_pre_tax = serializers.DecimalField(max_digits=24, decimal_places=4)
    progress_percent = serializers.DecimalField(max_digits=7, decimal_places=2)
    receiving_status = serializers.CharField()
    receiving_status_display = serializers.CharField()
    expected_delivery_date = serializers.DateField(allow_null=True)
    latest_execution_date = serializers.DateField(allow_null=True)
    is_overdue = serializers.BooleanField()
    overdue_days = serializers.IntegerField()


class RelatedDocumentSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    document_type = serializers.CharField()
    document_type_display = serializers.CharField()
    number = serializers.CharField()
    document_date = serializers.DateField()
    status = serializers.CharField()
    pre_tax_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    total_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    notes = serializers.CharField(allow_blank=True, required=False)
    reason = serializers.CharField(allow_blank=True, required=False)
    series = serializers.CharField(allow_blank=True, required=False)
    validation_status = serializers.CharField(allow_blank=True, required=False)


class RelatedDocumentsMapSerializer(serializers.Serializer):
    goods_receipts = RelatedDocumentSerializer(many=True)
    service_receipts = RelatedDocumentSerializer(many=True)
    returns = RelatedDocumentSerializer(many=True)
    discounts = RelatedDocumentSerializer(many=True)
    invoices = RelatedDocumentSerializer(many=True)


class TimelineItemSerializer(serializers.Serializer):
    document_date = serializers.DateField()
    document_type = serializers.CharField()
    document_type_display = serializers.CharField()
    document_number = serializers.CharField()
    document_id = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    pre_tax_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    amount = serializers.DecimalField(max_digits=24, decimal_places=4)


class OrderTrackingDetailSerializer(serializers.Serializer):
    order = serializers.DictField()
    summary = OrderTrackingListItemSerializer()
    lines = OrderTrackingLineSerializer(many=True)
    has_execution_documents = serializers.BooleanField()
    execution_message = serializers.CharField(allow_blank=True)
    related_documents = RelatedDocumentsMapSerializer()
    timeline = TimelineItemSerializer(many=True)
