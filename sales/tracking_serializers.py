from rest_framework import serializers


class OrderTrackingFilterSerializer(serializers.Serializer):
    company_id = serializers.UUIDField(required=True)
    code = serializers.CharField(required=False, allow_blank=True)
    number = serializers.CharField(required=False, allow_blank=True)
    customer_id = serializers.UUIDField(required=False, allow_null=True)
    assigned_employee_id = serializers.UUIDField(required=False, allow_null=True)
    order_date_from = serializers.DateField(required=False, allow_null=True)
    order_date_to = serializers.DateField(required=False, allow_null=True)
    delivery_date_from = serializers.DateField(required=False, allow_null=True)
    delivery_date_to = serializers.DateField(required=False, allow_null=True)
    order_status = serializers.ChoiceField(
        choices=["APPROVED", "CLOSED", "CANCELLED"], required=False, allow_null=True
    )
    fulfillment_status = serializers.ChoiceField(
        choices=["NOT_STARTED", "PARTIALLY_FULFILLED", "FULFILLED", "CLOSED_REMAINDER"],
        required=False,
        allow_null=True,
    )
    sales_status = serializers.ChoiceField(
        choices=["NOT_RECORDED", "PARTIALLY_RECORDED", "FULLY_RECORDED"],
        required=False,
        allow_null=True,
    )
    invoicing_status = serializers.ChoiceField(
        choices=["NOT_READY", "NOT_INVOICED", "PARTIALLY_INVOICED", "FULLY_INVOICED"],
        required=False,
        allow_null=True,
    )
    payment_status = serializers.ChoiceField(
        choices=["NO_RECEIVABLE", "UNPAID", "PARTIALLY_PAID", "PAID", "SETTLED_BY_CREDIT"],
        required=False,
        allow_null=True,
    )
    overdue_type = serializers.ChoiceField(
        choices=["DELIVERY_OVERDUE", "PAYMENT_OVERDUE", "ANY_OVERDUE"],
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        order_date_from = attrs.get("order_date_from")
        order_date_to = attrs.get("order_date_to")
        if order_date_from and order_date_to and order_date_from > order_date_to:
            raise serializers.ValidationError("Ngày bắt đầu không được lớn hơn ngày kết thúc.")

        delivery_date_from = attrs.get("delivery_date_from")
        delivery_date_to = attrs.get("delivery_date_to")
        if delivery_date_from and delivery_date_to and delivery_date_from > delivery_date_to:
            raise serializers.ValidationError("Ngày bắt đầu không được lớn hơn ngày kết thúc.")
        return attrs


class OrderTrackingListItemSerializer(serializers.Serializer):
    order_id = serializers.CharField()
    number = serializers.CharField()
    document_date = serializers.CharField()
    requested_delivery_date = serializers.CharField(allow_null=True)
    customer_id = serializers.CharField(allow_null=True)
    customer_code = serializers.CharField(allow_blank=True)
    customer_name = serializers.CharField(allow_blank=True)
    branch_id = serializers.CharField(allow_null=True)
    branch_name = serializers.CharField(allow_blank=True)
    assigned_employee_id = serializers.CharField(allow_null=True)
    assigned_employee_name = serializers.CharField(allow_blank=True)
    currency_code = serializers.CharField()
    total_amount = serializers.CharField()
    order_status = serializers.CharField()
    order_status_label = serializers.CharField()
    invoicing_policy = serializers.CharField()

    # Fulfillment (Delivery / Services)
    fulfillment_status = serializers.CharField()
    fulfillment_label = serializers.CharField()
    fulfillment_rate = serializers.DecimalField(max_digits=5, decimal_places=2)

    # Sales recording
    sales_status = serializers.CharField()
    sales_label = serializers.CharField()
    sales_rate = serializers.DecimalField(max_digits=5, decimal_places=2)

    # Invoicing
    invoicing_status = serializers.CharField()
    invoicing_label = serializers.CharField()
    invoicing_rate = serializers.DecimalField(max_digits=5, decimal_places=2)

    # Payment & Receivables
    payment_status = serializers.CharField()
    payment_label = serializers.CharField()
    payment_rate = serializers.DecimalField(max_digits=5, decimal_places=2)

    # Quantities totals
    total_ordered_quantity = serializers.CharField()
    total_delivered_quantity = serializers.CharField()
    total_closed_quantity = serializers.CharField()
    total_remaining_quantity = serializers.CharField()
    total_recorded_sales_quantity = serializers.CharField()
    total_invoiced_quantity = serializers.CharField()
    total_pending_invoice_quantity = serializers.CharField()
    total_returned_quantity = serializers.CharField()
    total_allowance_amount = serializers.CharField()

    # Amounts totals
    total_receivable_incurred = serializers.CharField()
    total_collected_amount = serializers.CharField()
    remaining_receivable_amount = serializers.CharField()

    # Warnings / Overdue
    delivery_overdue = serializers.BooleanField()
    payment_overdue = serializers.BooleanField()
    has_warning = serializers.BooleanField()
    warning_messages = serializers.ListField(child=serializers.CharField())


class OrderTrackingLineSerializer(serializers.Serializer):
    line_id = serializers.CharField()
    line_no = serializers.IntegerField()
    item_id = serializers.CharField(allow_null=True)
    item_code = serializers.CharField(allow_blank=True)
    item_name = serializers.CharField(allow_blank=True)
    item_type = serializers.CharField(allow_blank=True)
    uom_id = serializers.CharField(allow_null=True)
    uom_name = serializers.CharField(allow_blank=True)
    warehouse_id = serializers.CharField(allow_null=True)
    warehouse_name = serializers.CharField(allow_blank=True)
    quantity = serializers.CharField()
    unit_price = serializers.CharField()
    discount_amount = serializers.CharField()
    tax_amount = serializers.CharField()
    line_total = serializers.CharField()
    delivered_quantity = serializers.CharField()
    closed_quantity = serializers.CharField()
    remaining_quantity = serializers.CharField()
    recorded_sales_quantity = serializers.CharField()
    invoiced_quantity = serializers.CharField()
    pending_invoice_quantity = serializers.CharField()
    returned_quantity = serializers.CharField()
    allowance_amount = serializers.CharField()
    delivery_date = serializers.CharField(allow_null=True)
    fulfillment_status = serializers.CharField()
    fulfillment_label = serializers.CharField()
    sales_status = serializers.CharField()
    sales_label = serializers.CharField()
    invoicing_status = serializers.CharField()
    invoicing_label = serializers.CharField()
    is_delivery_overdue = serializers.BooleanField()
    related_documents = serializers.DictField()


class OrderTrackingDeliveryTabSerializer(serializers.Serializer):
    lines = serializers.ListField(child=serializers.DictField())
    deliveries = serializers.ListField(child=serializers.DictField())
    summary = serializers.DictField()


class OrderTrackingSalesInvoiceTabSerializer(serializers.Serializer):
    lines = serializers.ListField(child=serializers.DictField())
    goods_sales = serializers.ListField(child=serializers.DictField())
    service_sales = serializers.ListField(child=serializers.DictField())
    sales_invoices = serializers.ListField(child=serializers.DictField())
    sales_returns = serializers.ListField(child=serializers.DictField())
    sales_allowances = serializers.ListField(child=serializers.DictField())
    summary = serializers.DictField()


class OrderTrackingPaymentTabSerializer(serializers.Serializer):
    incurred_receivable = serializers.CharField()
    deductions = serializers.CharField()
    allocated_collections = serializers.CharField()
    remaining_receivable = serializers.CharField()
    payment_term = serializers.DictField(allow_null=True)
    due_date = serializers.CharField(allow_null=True)
    is_payment_overdue = serializers.BooleanField()
    payment_status = serializers.CharField()
    payment_label = serializers.CharField()
    receivables = serializers.ListField(child=serializers.DictField())
    direct_collections = serializers.ListField(child=serializers.DictField())


class OrderTrackingDetailSerializer(serializers.Serializer):
    summary = OrderTrackingListItemSerializer()
    delivery_tab = OrderTrackingDeliveryTabSerializer()
    sales_invoice_tab = OrderTrackingSalesInvoiceTabSerializer()
    payment_tab = OrderTrackingPaymentTabSerializer()
    lines = OrderTrackingLineSerializer(many=True)
    related_document_counts = serializers.DictField()
