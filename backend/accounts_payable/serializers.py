from decimal import Decimal
import uuid
from django.db import transaction
from django.db.models import Sum
from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers
from master_data.payment_terms import calculate_payment_dates, resolve_payment_term, validate_payment_term_selection
from master_data.payment_methods import method_snapshot, prepare_document_method, validate_method_selection
from . import models


class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.SupplierInvoiceLine
        fields = "__all__"
        read_only_fields = ("id", "invoice")


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True)

    class Meta:
        model = models.SupplierInvoice
        fields = "__all__"
        read_only_fields = ("id", "status", "match_status", "match_details", "workflow_snapshot", "created_by", "submitted_at", "approved_at", "posted_at", "posting_reference", "created_at", "updated_at", "subtotal", "tax_amount", "total_amount", "payment_method_snapshot", "received_via_purchase", "validation_status", "linked_amount", "is_replaced")

    def validate(self, attrs):
        if self.instance and self.instance.received_via_purchase:
            raise serializers.ValidationError("Hóa đơn đã tiếp nhận không được sửa dữ liệu gốc.")
        if self.instance and self.instance.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}:
            raise serializers.ValidationError("Chỉ hóa đơn DRAFT hoặc REJECTED được sửa.")
        company = attrs.get("company") or self.instance.company
        supplier = attrs.get("supplier") or self.instance.supplier
        invoice_date = attrs.get("invoice_date") or getattr(self.instance, "invoice_date", None)
        prepare_document_method(attrs, self.instance, company=company, scope="PAYMENT", on_date=invoice_date)
        term = attrs.get("payment_term") if "payment_term" in attrs else getattr(self.instance, "payment_term", None)
        if not self.instance and "payment_term" not in attrs:
            term = resolve_payment_term(company=company, scope="PURCHASE", on_date=invoice_date, party=supplier)
            if term:
                attrs["payment_term"] = term
        validate_payment_term_selection(term, company=company, scope="PURCHASE", on_date=invoice_date, previous=getattr(self.instance, "payment_term", None))
        if term and (not self.instance or "payment_term" in attrs or "invoice_date" in attrs):
            if term.due_base not in ("DOCUMENT", "INVOICE"):
                raise serializers.ValidationError({"payment_term": "This invoice does not have the date required by the payment term."})
            attrs["due_date"] = calculate_payment_dates(term, document_date=invoice_date, invoice_date=invoice_date)["due_date"]
        if supplier.company_id != company.id or supplier.status != "ACTIVE":
            raise serializers.ValidationError({"supplier": "Nhà cung cấp không hợp lệ."})
        lines = attrs.get("lines", [])
        if not lines and not self.instance:
            raise serializers.ValidationError({"lines": "Hóa đơn phải có ít nhất một dòng."})
        for line in lines:
            for key in ("item", "uom", "tax_rate"):
                value = line.get(key)
                if value and value.company_id != company.id:
                    raise serializers.ValidationError({"lines": "Danh mục dòng hóa đơn phải thuộc cùng doanh nghiệp."})
            po = line.get("purchase_order_line")
            receipt = line.get("receipt_line")
            if po and (po.order.company_id != company.id or po.order.supplier_id != supplier.id):
                raise serializers.ValidationError({"lines": "Đơn mua nguồn không hợp lệ."})
            if receipt and receipt.receipt.order.supplier_id != supplier.id:
                raise serializers.ValidationError({"lines": "Lần nhận hàng nguồn không hợp lệ."})
        return attrs

    @staticmethod
    def amounts(lines):
        subtotal = sum((x["quantity"] * x["unit_price"] for x in lines), Decimal("0"))
        tax = sum((x.get("tax_amount", Decimal("0")) for x in lines), Decimal("0"))
        return subtotal, tax

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        subtotal, tax = self.amounts(lines)
        validated_data.update(subtotal=subtotal, tax_amount=tax, total_amount=subtotal + tax + validated_data.get("adjustment_amount", 0))
        invoice = models.SupplierInvoice.objects.create(**validated_data)
        for i, line in enumerate(lines, 1):
            models.SupplierInvoiceLine.objects.create(invoice=invoice, line_no=line.pop("line_no", i), **line)
        return invoice

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        for key, value in validated_data.items(): setattr(instance, key, value)
        if lines is not None:
            instance.lines.all().delete()
            subtotal, tax = self.amounts(lines)
            instance.subtotal, instance.tax_amount = subtotal, tax
            instance.total_amount = subtotal + tax + instance.adjustment_amount
            for i, line in enumerate(lines, 1):
                models.SupplierInvoiceLine.objects.create(invoice=instance, line_no=line.pop("line_no", i), **line)
        instance.save()
        return instance


class PayableSerializer(serializers.ModelSerializer):
    age_days = serializers.SerializerMethodField()
    due_state = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = models.Payable
        fields = "__all__"

    @extend_schema_field(serializers.IntegerField())
    def get_age_days(self, obj):
        from django.utils import timezone
        if obj.invoice_id:
            source_date = obj.invoice.invoice_date
        elif obj.goods_purchase_id:
            source_date = obj.goods_purchase.document_date
        elif getattr(obj, "purchase_cost_id", None):
            source_date = obj.purchase_cost.document_date
        elif getattr(obj, "document_id", None):
            source_date = obj.document.document_date
        else:
            source_date = obj.created_at.date() if obj.created_at else timezone.localdate()
        return (timezone.localdate() - source_date).days

    @extend_schema_field(serializers.CharField())
    def get_due_state(self, obj):
        from django.utils import timezone
        if not obj.due_date: return "NO_DUE_DATE"
        days = (obj.due_date - timezone.localdate()).days
        return "OVERDUE" if days < 0 else "DUE" if days == 0 else "NOT_DUE"


class PayableDocumentLineSerializer(serializers.ModelSerializer):
    debit_account_code = serializers.CharField(source="debit_account.code", read_only=True)
    debit_account_name = serializers.CharField(source="debit_account.name", read_only=True)
    cost_center_name = serializers.CharField(source="cost_center.name", read_only=True)
    expense_item_name = serializers.CharField(source="expense_item.name", read_only=True)
    statistical_code_name = serializers.CharField(source="statistical_code.name", read_only=True)

    class Meta:
        model = models.PayableDocumentLine
        fields = "__all__"
        read_only_fields = ("id", "document")


class PayableDocumentSerializer(serializers.ModelSerializer):
    lines = PayableDocumentLineSerializer(many=True, read_only=True)
    supplier_code = serializers.CharField(source="supplier.code", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    supplier_tax_code = serializers.CharField(source="supplier.tax_code", read_only=True)
    payable_account_code = serializers.CharField(source="payable_account.code", read_only=True)
    payable_account_name = serializers.CharField(source="payable_account.name", read_only=True)
    tax_account_code = serializers.CharField(source="tax_account.code", read_only=True, default="")
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    payment_term_code = serializers.CharField(source="payment_term.code", read_only=True, default="")
    payment_term_name = serializers.CharField(source="payment_term.name", read_only=True, default="")

    class Meta:
        model = models.PayableDocument
        fields = "__all__"
        read_only_fields = (
            "id", "number", "subtotal", "tax_amount", "total_amount", "status",
            "journal_entry", "posting_reference", "created_by", "submitted_at",
            "approved_at", "posted_at", "cancelled_at", "version", "created_at", "updated_at"
        )


class PaymentRequestLineSerializer(serializers.ModelSerializer):
    payable_number = serializers.SerializerMethodField()
    purchase_order_number = serializers.CharField(source="purchase_order.number", read_only=True, default="")

    class Meta:
        model = models.PaymentRequestLine
        fields = "__all__"
        read_only_fields = ("id", "request")

    def get_payable_number(self, obj):
        if not obj.payable:
            return ""
        if obj.payable.document:
            return obj.payable.document.number
        if obj.payable.invoice:
            return obj.payable.invoice.invoice_number
        if obj.payable.goods_purchase:
            return obj.payable.goods_purchase.number
        return ""


class PaymentRequestSerializer(serializers.ModelSerializer):
    lines = PaymentRequestLineSerializer(many=True, required=False)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    supplier_code = serializers.CharField(source="supplier.code", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    approver_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    request_type_display = serializers.CharField(source="get_request_type_display", read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)
    cash_fund_name = serializers.CharField(source="cash_fund.name", read_only=True, default="")
    company_bank_account_number = serializers.CharField(source="company_bank_account.account_number", read_only=True, default="")

    class Meta:
        model = models.PaymentRequest
        fields = "__all__"
        read_only_fields = (
            "id", "number", "status", "total_amount", "created_by", "created_at", "updated_at",
            "submitted_at", "approved_at", "rejected_at", "rejection_reason", "canceled_at", "cancellation_reason",
        )

    def get_approver_name(self, obj):
        return obj.approver.display_name if obj.approver else ""

    def get_created_by_name(self, obj):
        return obj.created_by.display_name if obj.created_by else ""


class PaymentAllocationSerializer(serializers.ModelSerializer):
    payable_number = serializers.CharField(source="payable.document.number", read_only=True, default="")
    payable_due_date = serializers.DateField(source="payable.due_date", read_only=True, default=None)
    payable_balance = serializers.DecimalField(source="payable.balance", max_digits=20, decimal_places=4, read_only=True, default=0)

    class Meta:
        model = models.PaymentAllocation
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at")


class PaymentAllocationVoucherLineSerializer(serializers.ModelSerializer):
    payable_number = serializers.SerializerMethodField()
    invoice_number = serializers.SerializerMethodField()
    document_date = serializers.SerializerMethodField()
    due_date = serializers.DateField(source="payable.due_date", read_only=True, default=None)

    class Meta:
        model = models.PaymentAllocationVoucherLine
        fields = "__all__"

    def get_payable_number(self, obj):
        from .allocation_services import _payable_number
        return _payable_number(obj.payable)

    def get_invoice_number(self, obj):
        from .allocation_services import _invoice_number
        return _invoice_number(obj.payable)

    def get_document_date(self, obj):
        from .allocation_services import _posting_date
        dt = _posting_date(obj.payable)
        return str(dt) if dt else None


class PaymentAllocationVoucherSerializer(serializers.ModelSerializer):
    lines = PaymentAllocationVoucherLineSerializer(many=True, read_only=True)
    supplier = serializers.UUIDField(source="payment.supplier_id", read_only=True)
    supplier_name = serializers.CharField(source="payment.supplier.name", read_only=True, default="")
    supplier_code = serializers.CharField(source="payment.supplier.code", read_only=True, default="")
    currency = serializers.UUIDField(source="payment.currency_id", read_only=True)
    currency_code = serializers.CharField(source="payment.currency.code", read_only=True, default="")
    payment_number = serializers.CharField(source="payment.number", read_only=True, default="")
    created_by_name = serializers.CharField(source="created_by.display_name", read_only=True, default="")
    reversed_by_name = serializers.CharField(source="reversed_by.display_name", read_only=True, default="")

    class Meta:
        model = models.PaymentAllocationVoucher
        fields = "__all__"


class DebtOffsetPayableLineSerializer(serializers.ModelSerializer):
    payable_number = serializers.SerializerMethodField()
    invoice_number = serializers.SerializerMethodField()
    document_date = serializers.SerializerMethodField()
    due_date = serializers.DateField(source="payable.due_date", read_only=True)
    original_amount = serializers.DecimalField(source="payable.original_amount", max_digits=20, decimal_places=4, read_only=True)
    balance = serializers.DecimalField(source="payable.balance", max_digits=20, decimal_places=4, read_only=True)

    class Meta:
        model = models.DebtOffsetPayableLine
        fields = "__all__"

    def get_payable_number(self, obj):
        from .allocation_services import _payable_number
        return _payable_number(obj.payable) if obj.payable else ""

    def get_invoice_number(self, obj):
        from .allocation_services import _invoice_number
        return _invoice_number(obj.payable) if obj.payable else ""

    def get_document_date(self, obj):
        from .allocation_services import _posting_date
        return str(_posting_date(obj.payable)) if obj.payable else ""


class DebtOffsetReceivableLineSerializer(serializers.ModelSerializer):
    receivable_number = serializers.SerializerMethodField()
    document_date = serializers.SerializerMethodField()
    due_date = serializers.DateField(source="receivable.due_date", read_only=True)
    original_amount = serializers.DecimalField(source="receivable.original_amount", max_digits=20, decimal_places=4, read_only=True)
    balance = serializers.DecimalField(source="receivable.balance", max_digits=20, decimal_places=4, read_only=True)

    class Meta:
        model = models.DebtOffsetReceivableLine
        fields = "__all__"

    def get_receivable_number(self, obj):
        from .offset_services import _receivable_number
        return _receivable_number(obj.receivable) if obj.receivable else ""

    def get_document_date(self, obj):
        from .offset_services import _receivable_date
        return str(_receivable_date(obj.receivable)) if obj.receivable else ""


class DebtOffsetVoucherSerializer(serializers.ModelSerializer):
    partner_name = serializers.CharField(source="partner.name", read_only=True, default="")
    partner_code = serializers.CharField(source="partner.code", read_only=True, default="")
    currency_code = serializers.CharField(source="currency.code", read_only=True, default="")
    created_by_name = serializers.CharField(source="created_by.display_name", read_only=True, default="")
    cancelled_by_name = serializers.CharField(source="cancelled_by.display_name", read_only=True, default="")
    journal_entry_number = serializers.CharField(source="journal_entry.number", read_only=True, default="")
    reversal_journal_entry_number = serializers.CharField(source="reversal_journal_entry.number", read_only=True, default="")
    payable_lines = DebtOffsetPayableLineSerializer(many=True, read_only=True)
    receivable_lines = DebtOffsetReceivableLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.DebtOffsetVoucher
        fields = "__all__"


class PayableAdjustmentVoucherSerializer(serializers.ModelSerializer):
    payable_number = serializers.SerializerMethodField()
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default="")
    supplier_code = serializers.CharField(source="supplier.code", read_only=True, default="")
    counter_account_code = serializers.CharField(source="counter_account.code", read_only=True, default="")
    counter_account_name = serializers.CharField(source="counter_account.name", read_only=True, default="")
    journal_entry_number = serializers.CharField(source="journal_entry.number", read_only=True, default="")
    reversal_journal_entry_number = serializers.CharField(source="reversal_journal_entry.number", read_only=True, default="")
    created_by_name = serializers.CharField(source="created_by.display_name", read_only=True, default="")
    cancelled_by_name = serializers.CharField(source="cancelled_by.display_name", read_only=True, default="")

    class Meta:
        model = models.PayableAdjustmentVoucher
        fields = "__all__"

    def get_payable_number(self, obj):
        from .allocation_services import _payable_number
        return _payable_number(obj.payable)


class SupplierReconciliationSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default="")
    supplier_code = serializers.CharField(source="supplier.code", read_only=True, default="")
    currency_code = serializers.CharField(source="currency.code", read_only=True, default="")
    status_display = serializers.CharField(source="get_status_display", read_only=True, default="")
    created_by_name = serializers.CharField(source="created_by.display_name", read_only=True, default="")
    completed_by_name = serializers.CharField(source="completed_by.display_name", read_only=True, default="")
    cancelled_by_name = serializers.CharField(source="cancelled_by.display_name", read_only=True, default="")

    class Meta:
        model = models.SupplierReconciliation
        fields = "__all__"


@extend_schema_serializer(component_name="ApPayment")
class PaymentSerializer(serializers.ModelSerializer):
    allocations = PaymentAllocationSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default="")
    supplier_code = serializers.CharField(source="supplier.code", read_only=True, default="")
    currency_code = serializers.CharField(source="currency.code", read_only=True, default="")
    cash_fund_name = serializers.CharField(source="cash_fund.name", read_only=True, default="")
    company_bank_account_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.display_name", read_only=True, default="")
    posted_by_name = serializers.CharField(source="posted_by.display_name", read_only=True, default="")
    unallocated_amount = serializers.SerializerMethodField()
    allocation_status = serializers.SerializerMethodField()

    class Meta:
        model = models.Payment
        fields = "__all__"
        read_only_fields = (
            "id", "number", "status", "allocated_amount", "journal_entry", "reversal_journal_entry",
            "posted_at", "posted_by", "canceled_at", "canceled_by", "cancellation_reason",
            "payment_method_snapshot", "created_by", "created_at", "updated_at",
        )
        extra_kwargs = {"external_type": {"required": False}, "external_reference": {"required": False, "allow_blank": True}}
        validators = []

    def get_company_bank_account_name(self, obj):
        if obj.company_bank_account and obj.company_bank_account.bank:
            return f"{obj.company_bank_account.account_number} - {obj.company_bank_account.bank.name}"
        return ""

    @extend_schema_field(serializers.DecimalField(max_digits=20, decimal_places=4))
    def get_unallocated_amount(self, obj):
        return obj.amount - obj.allocated_amount

    def get_allocation_status(self, obj):
        if obj.allocated_amount <= 0:
            return "UNALLOCATED"
        return "FULLY_ALLOCATED" if obj.allocated_amount >= obj.amount else "PARTIALLY_ALLOCATED"

    def validate(self, attrs):
        company = attrs.get("company") or (self.instance.company if self.instance else None)
        supplier = attrs.get("supplier") or (self.instance.supplier if self.instance else None)
        if company and supplier and supplier.company_id != company.id:
            raise serializers.ValidationError({"supplier": "Nhà cung cấp phải thuộc cùng doanh nghiệp."})
        return attrs


class NettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Netting
        fields = "__all__"
        read_only_fields = ("id", "status", "created_by", "created_at")
    def validate(self, attrs):
        company=attrs.get("company") or self.instance.company; payable=attrs.get("payable") or self.instance.payable
        if payable.company_id != company.id: raise serializers.ValidationError({"payable":"Khoản phải trả phải thuộc cùng doanh nghiệp."})
        if self.instance and self.instance.status != "DRAFT": raise serializers.ValidationError("Chứng từ đã ghi sổ không được sửa.")
        return attrs


class AdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PayableAdjustment
        fields = "__all__"
        read_only_fields = ("id", "status", "created_by", "created_at")
    def validate(self, attrs):
        company=attrs.get("company") or self.instance.company; payable=attrs.get("payable") or self.instance.payable
        if payable.company_id != company.id: raise serializers.ValidationError({"payable":"Khoản phải trả phải thuộc cùng doanh nghiệp."})
        if self.instance and self.instance.status != "DRAFT": raise serializers.ValidationError("Điều chỉnh đã ghi sổ không được sửa.")
        return attrs


class ApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ApprovalDecision
        fields = "__all__"
        read_only_fields = ("id", "decided_at")


class SupplierDebtSummaryItemSerializer(serializers.Serializer):
    supplier_id = serializers.UUIDField()
    supplier_code = serializers.CharField()
    supplier_name = serializers.CharField()
    tax_code = serializers.CharField(allow_blank=True)
    opening_payable_balance = serializers.DecimalField(max_digits=24, decimal_places=4)
    opening_advance_balance = serializers.DecimalField(max_digits=24, decimal_places=4)
    period_increase = serializers.DecimalField(max_digits=24, decimal_places=4)
    period_decrease = serializers.DecimalField(max_digits=24, decimal_places=4)
    closing_payable_balance = serializers.DecimalField(max_digits=24, decimal_places=4)
    closing_advance_balance = serializers.DecimalField(max_digits=24, decimal_places=4)
    due_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    overdue_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    earliest_due_date = serializers.DateField(allow_null=True)
    max_overdue_days = serializers.IntegerField()
    unpaid_count = serializers.IntegerField()


class SupplierDebtDetailItemSerializer(serializers.Serializer):
    payable_id = serializers.UUIDField()
    document_number = serializers.CharField()
    document_date = serializers.DateField()
    posting_date = serializers.DateField()
    due_date = serializers.DateField(allow_null=True)
    source_type = serializers.CharField()
    source_type_display = serializers.CharField()
    source_document_id = serializers.CharField()
    invoice_number = serializers.CharField(allow_blank=True)
    invoice_series = serializers.CharField(allow_blank=True)
    currency_code = serializers.CharField()
    original_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    increase_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    paid_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    discount_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    netted_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    remaining_amount = serializers.DecimalField(max_digits=24, decimal_places=4)
    days_remaining = serializers.IntegerField()
    overdue_days = serializers.IntegerField()
    due_status = serializers.CharField()
    due_status_display = serializers.CharField()
    aging_bucket = serializers.CharField()
    aging_bucket_display = serializers.CharField()
    status = serializers.CharField()
    status_display = serializers.CharField()
    is_overdue = serializers.BooleanField()

