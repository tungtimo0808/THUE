from decimal import Decimal
import uuid
from django.db.models import Sum
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers
from master_data.payment_terms import calculate_payment_dates, resolve_payment_term, validate_payment_term_selection
from master_data.payment_methods import method_snapshot, prepare_document_method, validate_method_selection
from . import models


def valid_customer(company,customer):
    if customer.company_id!=company.id or customer.status!="ACTIVE" or not customer.roles.filter(role_type="CUSTOMER").exists():
        raise serializers.ValidationError({"customer":"Khách hàng không hợp lệ hoặc chưa có vai trò CUSTOMER."})


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.ReceivableDocument; fields="__all__"
        read_only_fields=("id","status","workflow_snapshot","posting_reference","created_by","submitted_at","approved_at","posted_at","created_at","updated_at","payment_method_snapshot")
        extra_kwargs={"due_date":{"required":False}}
    def validate(self,attrs):
        if self.instance and self.instance.status not in {models.DocumentStatus.DRAFT,models.DocumentStatus.REJECTED}: raise serializers.ValidationError("Chỉ chứng từ DRAFT hoặc REJECTED được sửa.")
        company=attrs.get("company") or self.instance.company; customer=attrs.get("customer") or self.instance.customer; valid_customer(company,customer)
        doc_date=attrs.get("document_date") or getattr(self.instance,"document_date",None)
        if not self.instance and "payment_method_config" not in attrs:
            order=attrs.get("sales_order")
            contract=attrs.get("sales_contract")
            inherited=(order.payment_method_config if order else None) or (contract.payment_method_config if contract else None)
            if inherited: attrs["payment_method_config"]=inherited
        prepare_document_method(attrs,self.instance,company=company,scope="RECEIPT",on_date=doc_date)
        term=attrs.get("payment_term") if "payment_term" in attrs else getattr(self.instance,"payment_term",None)
        if not self.instance and "payment_term" not in attrs:
            order=attrs.get("sales_order")
            contract=attrs.get("sales_contract")
            term=(order.payment_term if order and order.payment_term_id else None) or (contract.payment_term if contract and contract.payment_term_id else None)
            term=term or resolve_payment_term(company=company,scope="SALE",on_date=doc_date,party=customer)
            if term: attrs["payment_term"]=term
        validate_payment_term_selection(term,company=company,scope="SALE",on_date=doc_date,previous=getattr(self.instance,"payment_term",None))
        if term and (not self.instance or "payment_term" in attrs or "document_date" in attrs):
            doc_type=attrs.get("document_type") or getattr(self.instance,"document_type",None)
            if term.due_base not in ("DOCUMENT","INVOICE") or (term.due_base=="INVOICE" and doc_type!="SALES_INVOICE"):
                raise serializers.ValidationError({"payment_term":"This document does not have the date required by the payment term."})
            attrs["due_date"]=calculate_payment_dates(term,document_date=doc_date,invoice_date=doc_date if doc_type=="SALES_INVOICE" else None)["due_date"]
        if not self.instance and "due_date" not in attrs:
            raise serializers.ValidationError({"due_date":"Due date or an applicable payment term is required."})
        branch=attrs.get("branch") or getattr(self.instance,"branch",None)
        if branch and branch.company_id!=company.id: raise serializers.ValidationError({"branch":"Chi nhánh phải thuộc cùng doanh nghiệp."})
        for name in ("sales_order","sales_contract","invoice_request"):
            source=attrs.get(name) or getattr(self.instance,name,None)
            if source and (source.company_id!=company.id or source.customer_id!=customer.id): raise serializers.ValidationError({name:"Chứng từ nguồn không tương thích."})
        invoice=attrs.get("invoice_request") or getattr(self.instance,"invoice_request",None)
        order=attrs.get("sales_order") or getattr(self.instance,"sales_order",None)
        if invoice and order and invoice.order_id!=order.id: raise serializers.ValidationError({"invoice_request":"Đề nghị hóa đơn không thuộc đơn bán đã chọn."})
        due=attrs.get("due_date") or self.instance.due_date; doc_date=attrs.get("document_date") or self.instance.document_date
        if due<doc_date: raise serializers.ValidationError({"due_date":"Hạn thanh toán không được trước ngày chứng từ."})
        return attrs


class ReceivableScheduleSerializer(serializers.ModelSerializer):
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = models.ReceivableSchedule
        fields = (
            "id",
            "installment_no",
            "amount",
            "due_date",
            "collected_amount",
            "balance",
            "status",
            "notes",
            "is_overdue",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "collected_amount", "balance", "status", "created_at", "updated_at", "is_overdue")


class ReceivableScheduleHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source="changed_by.username", read_only=True)

    class Meta:
        model = models.ReceivableScheduleHistory
        fields = (
            "id",
            "changed_by",
            "changed_by_name",
            "changed_at",
            "reason",
            "old_schedule",
            "new_schedule",
        )
        read_only_fields = fields


class ReceivableSerializer(serializers.ModelSerializer):
    age_days = serializers.SerializerMethodField()
    due_state = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    account_code = serializers.CharField(source="account.code", read_only=True, default=None)
    account_name = serializers.CharField(source="account.name", read_only=True, default=None)
    payment_term_name = serializers.CharField(source="payment_term.name", read_only=True, default=None)
    schedules = ReceivableScheduleSerializer(many=True, read_only=True)
    schedule_histories = ReceivableScheduleHistorySerializer(many=True, read_only=True)

    class Meta:
        model = models.Receivable
        fields = "__all__"

    @extend_schema_field(serializers.IntegerField())
    def get_age_days(self, obj):
        doc_date = obj.document_date or (obj.document.document_date if obj.document else obj.posting_date) or timezone.localdate()
        return (timezone.localdate() - doc_date).days

    @extend_schema_field(serializers.CharField())
    def get_due_state(self, obj):
        if obj.status == models.ReceivableStatus.PAID:
            return "PAID"
        if not obj.due_date:
            return "NOT_DUE"
        days = (obj.due_date - timezone.localdate()).days
        return "OVERDUE" if days < 0 else "DUE" if days == 0 else "NOT_DUE"


class RecognizeScheduleItemSerializer(serializers.Serializer):
    installment_no = serializers.IntegerField(default=1)
    amount = serializers.DecimalField(max_digits=20, decimal_places=4)
    due_date = serializers.DateField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class RecognizeReceivableSerializer(serializers.Serializer):
    company = serializers.UUIDField()
    source_document_type = serializers.ChoiceField(choices=["AR_DOCUMENT", "JOURNAL_ENTRY"], default="AR_DOCUMENT")
    source_document_id = serializers.CharField()
    source_line_id = serializers.CharField(required=False, allow_blank=True, default="")
    code = serializers.CharField(required=False, allow_blank=True, default="")
    due_date = serializers.DateField(required=False, allow_null=True)
    payment_term = serializers.UUIDField(required=False, allow_null=True)
    account = serializers.UUIDField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    schedules = RecognizeScheduleItemSerializer(many=True, required=False, default=list)


class BulkRecognizeSerializer(serializers.Serializer):
    company = serializers.UUIDField()
    items = RecognizeReceivableSerializer(many=True)


class UpdateScheduleSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True)
    schedules = RecognizeScheduleItemSerializer(many=True, required=True)


class ReverseReceivableSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True)


class UnrecognizedSourceSerializer(serializers.Serializer):
    source_document_type = serializers.CharField()
    source_document_id = serializers.CharField()
    source_document_number = serializers.CharField()
    source_line_id = serializers.CharField(allow_blank=True)
    customer_id = serializers.CharField()
    customer_code = serializers.CharField()
    customer_name = serializers.CharField()
    account_id = serializers.CharField(allow_null=True)
    account_code = serializers.CharField(allow_null=True)
    account_name = serializers.CharField(allow_null=True)
    currency_id = serializers.CharField()
    currency_code = serializers.CharField()
    exchange_rate = serializers.CharField()
    original_amount = serializers.CharField()
    document_date = serializers.CharField()
    posting_date = serializers.CharField()
    due_date = serializers.CharField()
    payment_term_id = serializers.CharField(allow_null=True)
    payment_term_name = serializers.CharField(allow_null=True)
    sales_order_id = serializers.CharField(allow_null=True)
    sales_contract_id = serializers.CharField(allow_null=True)
    description = serializers.CharField(allow_blank=True)


class CreditPolicySerializer(serializers.ModelSerializer):
    used_limit=serializers.SerializerMethodField(); available_limit=serializers.SerializerMethodField(); overdue_balance=serializers.SerializerMethodField()
    class Meta:
        model=models.CreditPolicy; fields="__all__"; read_only_fields=("id","created_by","created_at","updated_at","used_limit","available_limit","overdue_balance")
    def validate(self,attrs):
        company=attrs.get("company") or self.instance.company; customer=attrs.get("customer") or self.instance.customer; valid_customer(company,customer)
        branch=attrs.get("branch") or getattr(self.instance,"branch",None)
        if branch and branch.company_id!=company.id: raise serializers.ValidationError({"branch":"Chi nhánh phải thuộc cùng doanh nghiệp."})
        start=attrs.get("effective_from") or self.instance.effective_from; end=attrs.get("effective_to") if "effective_to" in attrs else getattr(self.instance,"effective_to",None)
        if end and end<start: raise serializers.ValidationError({"effective_to":"Ngày kết thúc không hợp lệ."})
        if self.instance and not attrs.get("reason",self.instance.reason).strip(): raise serializers.ValidationError({"reason":"Lý do thay đổi hạn mức là bắt buộc."})
        return attrs
    def _used(self,obj):
        debt=models.Receivable.objects.filter(company=obj.company,customer=obj.customer,balance__gt=0)
        if obj.branch_id: debt=debt.filter(branch=obj.branch)
        if obj.currency_id: debt=debt.filter(currency=obj.currency)
        debt_value=debt.aggregate(total=Sum("balance"))["total"] or Decimal("0")
        orders=obj.customer.salesorder_set.exclude(status__in=["COMPLETED","CANCELLED"])
        if obj.branch_id: orders=orders.filter(branch=obj.branch)
        if obj.currency_id: orders=orders.filter(currency=obj.currency)
        commitment=orders.aggregate(total=Sum("total_amount"))["total"] or Decimal("0")
        return debt_value+commitment
    @extend_schema_field(serializers.DecimalField(max_digits=20,decimal_places=4))
    def get_used_limit(self,obj): return self._used(obj)
    @extend_schema_field(serializers.DecimalField(max_digits=20,decimal_places=4))
    def get_available_limit(self,obj): return max(obj.credit_limit-self._used(obj),Decimal("0"))
    @extend_schema_field(serializers.DecimalField(max_digits=20,decimal_places=4))
    def get_overdue_balance(self,obj):
        qs=models.Receivable.objects.filter(company=obj.company,customer=obj.customer,balance__gt=0,due_date__lt=timezone.localdate())
        if obj.branch_id: qs=qs.filter(branch=obj.branch)
        if obj.currency_id: qs=qs.filter(currency=obj.currency)
        return qs.aggregate(total=Sum("balance"))["total"] or Decimal("0")


class CollectionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.CollectionPlan; fields="__all__"; read_only_fields=("id","status","contact_history","created_by","created_at","updated_at")
    def validate(self,attrs):
        company=attrs.get("company") or self.instance.company; debt=attrs.get("receivable") or self.instance.receivable
        if debt.company_id!=company.id or debt.balance<=0: raise serializers.ValidationError({"receivable":"Khoản phải thu không hợp lệ hoặc đã tất toán."})
        amount=attrs.get("expected_amount") or self.instance.expected_amount
        plans=debt.collection_plans.exclude(status__in=["COMPLETED","CANCELLED"])
        if self.instance: plans=plans.exclude(pk=self.instance.pk)
        planned=plans.aggregate(total=Sum("expected_amount"))["total"] or 0
        if amount+planned>debt.balance: raise serializers.ValidationError({"expected_amount":"Tổng kế hoạch thu vượt số dư công nợ."})
        return attrs


@extend_schema_serializer(component_name="ArReceipt")
class ReceiptSerializer(serializers.ModelSerializer):
    unallocated_amount=serializers.SerializerMethodField()
    class Meta:
        model=models.Receipt; fields="__all__"; read_only_fields=("id","allocated_amount","status","payment_method_snapshot","created_by","created_at","branch","credit_account","exchange_rate","base_amount"); extra_kwargs={"external_type":{"required":False},"external_reference":{"required":False,"allow_blank":True}}; validators=[]
    @extend_schema_field(serializers.DecimalField(max_digits=20,decimal_places=4))
    def get_unallocated_amount(self,obj): return obj.amount-obj.allocated_amount
    def validate(self,attrs):
        if self.instance:
            from .allocation_voucher import receipt_source_is_posted
            if receipt_source_is_posted(self.instance):
                raise serializers.ValidationError("Chứng từ thu đã ghi sổ không được sửa trực tiếp.")
        company=attrs.get("company") or self.instance.company; customer=attrs.get("customer") or self.instance.customer; valid_customer(company,customer)
        method=attrs.get("payment_method_config") if "payment_method_config" in attrs else getattr(self.instance,"payment_method_config",None)
        if method and (not self.instance or getattr(self.instance,"payment_method_config_id",None) != method.pk): attrs["payment_method_snapshot"]=method_snapshot(method)
        elif "payment_method_config" in attrs and method is None: attrs["payment_method_snapshot"]={}
        if method:
            expected="CASH" if method.group=="CASH" else "BANK" if method.group=="BANK" else "OTHER"
            if attrs.get("external_type",expected)!=expected:
                raise serializers.ValidationError({"external_type":"External type conflicts with the selected method."})
            attrs["external_type"]=expected
            account=attrs.get("company_bank_account") or getattr(self.instance,"company_bank_account",None) or method.default_bank_account
            fund=attrs.get("cash_fund") or getattr(self.instance,"cash_fund",None) or method.default_cash_fund
            if account: attrs["company_bank_account"]=account
            if fund: attrs["cash_fund"]=fund
            validate_method_selection(method,company=company,scope="RECEIPT",on_date=attrs.get("receipt_date") or self.instance.receipt_date,
                                      reference=attrs.get("external_reference",getattr(self.instance,"external_reference","")),bank_account=account,cash_fund=fund,
                                      previous=getattr(self.instance,"payment_method_config",None))
            if not self.instance and not attrs.get("external_reference"):
                attrs["external_reference"] = str(uuid.uuid4())
        elif not attrs.get("external_type",getattr(self.instance,"external_type",None)):
            raise serializers.ValidationError({"external_type":"External type is required."})
        elif not attrs.get("external_reference",getattr(self.instance,"external_reference",None)):
            raise serializers.ValidationError({"external_reference":"External reference is required."})
        duplicate=models.Receipt.objects.filter(company=company,external_type=attrs.get("external_type",getattr(self.instance,"external_type",None)),external_reference=attrs.get("external_reference",getattr(self.instance,"external_reference",None)))
        if self.instance: duplicate=duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists(): raise serializers.ValidationError({"external_reference":"Duplicate transaction reference."})
        if self.instance and self.instance.allocations.exists(): raise serializers.ValidationError("Không thể sửa khoản thu đã phân bổ.")
        return attrs


class CustomerReceiptLineSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.CustomerReceiptLine
        fields=("id","receivable","schedule","amount","receipt_allocation")
        read_only_fields=("id","receipt_allocation")


class CustomerReceiptVoucherSerializer(serializers.ModelSerializer):
    document_date=serializers.DateField(required=False,default=timezone.localdate)
    posting_date=serializers.DateField(required=False)
    lines=CustomerReceiptLineSerializer(many=True,required=False)
    unallocated_amount=serializers.SerializerMethodField()
    allocated_amount=serializers.SerializerMethodField()
    base_amount=serializers.SerializerMethodField()

    class Meta:
        model=models.CustomerReceiptVoucher
        fields="__all__"
        extra_kwargs={"bank_reference":{"required":False,"allow_blank":True}}
        validators=[]
        read_only_fields=(
            "id","number","currency","debit_account","status","workflow_snapshot",
            "receipt","cash_transaction","bank_transaction","journal_entry",
            "created_by","approved_by","posted_by","submitted_at","approved_at",
            "posted_at","cancelled_at","cancel_reason","created_at","updated_at",
        )

    def get_allocated_amount(self,obj):
        return sum((line.amount for line in obj.lines.all()),Decimal("0"))

    def get_unallocated_amount(self,obj):
        return obj.amount-self.get_allocated_amount(obj)

    def get_base_amount(self,obj):
        return obj.amount*obj.exchange_rate

    def validate(self,attrs):
        from .receipt_voucher import validate_voucher_data
        if self.instance is not None:
            for field in ("company","branch"):
                if field in attrs and attrs[field].pk != getattr(self.instance,field+"_id"):
                    raise serializers.ValidationError({field:"Không được đổi doanh nghiệp hoặc chi nhánh của phiếu thu."})
        if self.instance is None:
            attrs.setdefault("document_date",timezone.localdate())
            attrs.setdefault("posting_date",attrs["document_date"])
            attrs.setdefault("method","CASH")
            attrs.setdefault("purpose","DEBT")
        lines=attrs.get("lines")
        validate_voucher_data(attrs,self.instance,lines)
        return attrs

    def create(self,validated_data):
        from .receipt_voucher import save_voucher
        return save_voucher(validated_data,None,self.context["request"])

    def update(self,instance,validated_data):
        from .receipt_voucher import save_voucher
        return save_voucher(validated_data,instance,self.context["request"])


class ReceiptAllocationVoucherLineSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.ReceiptAllocationVoucherLine
        fields=("id","receivable","schedule","installment_no","amount",
                "receipt_book_amount","debt_book_amount","fx_difference","allocation")
        read_only_fields=("id","installment_no","receipt_book_amount",
                          "debt_book_amount","fx_difference","allocation")


class ReceiptAllocationVoucherSerializer(serializers.ModelSerializer):
    allocation_date=serializers.DateField(required=False,default=timezone.localdate)
    description=serializers.CharField(required=False,allow_blank=True)
    lines=ReceiptAllocationVoucherLineSerializer(many=True,required=True)
    receipt_date=serializers.DateField(source="receipt.receipt_date",read_only=True)
    receipt_amount=serializers.DecimalField(source="receipt.amount",max_digits=20,decimal_places=4,read_only=True)
    already_allocated=serializers.DecimalField(source="receipt.allocated_amount",max_digits=20,decimal_places=4,read_only=True)
    available_amount=serializers.SerializerMethodField()
    allocated_amount=serializers.SerializerMethodField()
    remaining_amount=serializers.SerializerMethodField()

    class Meta:
        model=models.ReceiptAllocationVoucher
        fields="__all__"
        read_only_fields=(
            "id","number","currency","credit_account","status","journal_entry",
            "created_by","posted_by","posted_at","unposted_by","unposted_at",
            "unpost_reason","posting_count","cancelled_at","cancel_reason",
            "created_at","updated_at",
        )

    def get_available_amount(self,obj):
        return obj.receipt.amount-obj.receipt.allocated_amount

    def get_allocated_amount(self,obj):
        return sum((line.amount for line in obj.lines.all()),Decimal("0"))

    def get_remaining_amount(self,obj):
        return self.get_available_amount(obj)-self.get_allocated_amount(obj) if obj.status=="DRAFT" else obj.receipt.amount-obj.receipt.allocated_amount

    def validate(self,attrs):
        from .allocation_voucher import validate_data
        if self.instance is None and "description" not in attrs:
            receipt=attrs.get("receipt")
            customer=attrs.get("customer")
            if receipt and customer:
                attrs["description"]=f"Phân bổ khoản thu {receipt.external_reference} cho {customer.name}"
        if self.instance:
            for field in ("company","branch"):
                if field in attrs and attrs[field].pk != getattr(self.instance,field+"_id"):
                    raise serializers.ValidationError({field:"Không được đổi doanh nghiệp hoặc chi nhánh."})
        validate_data(attrs,self.instance,attrs.get("lines"))
        return attrs

    def create(self,validated_data):
        from .allocation_voucher import save
        return save(validated_data,None,self.context["request"])

    def update(self,instance,validated_data):
        from .allocation_voucher import save
        return save(validated_data,instance,self.context["request"])


@extend_schema_serializer(component_name="ArNetting")
class NettingSerializer(serializers.ModelSerializer):
    class Meta: model=models.Netting; fields="__all__"; read_only_fields=("id","status","posting_reference","created_by","created_at")
    def validate(self,attrs):
        company=attrs.get("company") or self.instance.company; debt=attrs.get("receivable") or self.instance.receivable; payable=attrs.get("payable") or getattr(self.instance,"payable",None)
        if debt.company_id!=company.id: raise serializers.ValidationError({"receivable":"Khoản phải thu phải thuộc cùng doanh nghiệp."})
        if payable and (payable.company_id!=company.id or payable.supplier_id!=debt.customer_id): raise serializers.ValidationError({"payable":"Khoản phải trả đối ứng không cùng đối tượng."})
        if self.instance and self.instance.status!=models.PostingStatus.DRAFT: raise serializers.ValidationError("Chứng từ đã ghi sổ không được sửa.")
        return attrs


class BalanceConfirmationSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.BalanceConfirmation; fields="__all__"; read_only_fields=("id","opening_balance","charges","receipts","closing_balance","status","sent_history","response_note","created_by","created_at","updated_at")
    def validate(self,attrs):
        company=attrs.get("company") or self.instance.company; customer=attrs.get("customer") or self.instance.customer; valid_customer(company,customer)
        start=attrs.get("period_from") or self.instance.period_from; end=attrs.get("period_to") or self.instance.period_to
        if end<start: raise serializers.ValidationError({"period_to":"Kỳ xác nhận không hợp lệ."})
        return attrs
    def create(self,validated_data):
        company=validated_data["company"]; customer=validated_data["customer"]; start=validated_data["period_from"]; end=validated_data["period_to"]
        charges=models.Receivable.objects.filter(company=company,customer=customer,document__posting_date__range=(start,end)).aggregate(total=Sum("original_amount"))["total"] or 0
        receipts=models.ReceiptAllocation.objects.filter(receivable__company=company,receivable__customer=customer,receipt__receipt_date__range=(start,end),receipt__status=models.ReceiptStatus.CONFIRMED).aggregate(total=Sum("amount"))["total"] or 0
        closing=models.Receivable.objects.filter(company=company,customer=customer,document__posting_date__lte=end).aggregate(total=Sum("balance"))["total"] or 0
        opening=closing-charges+receipts
        return models.BalanceConfirmation.objects.create(opening_balance=opening,charges=charges,receipts=receipts,closing_balance=closing,**validated_data)


@extend_schema_serializer(component_name="ArAdjustment")
class AdjustmentSerializer(serializers.ModelSerializer):
    class Meta: model=models.ReceivableAdjustment; fields="__all__"; read_only_fields=("id","status","posting_reference","reverses","created_by","created_at")
    def validate(self,attrs):
        company=attrs.get("company") or self.instance.company; debt=attrs.get("receivable") or self.instance.receivable
        if debt.company_id!=company.id: raise serializers.ValidationError({"receivable":"Khoản phải thu phải thuộc cùng doanh nghiệp."})
        if self.instance and self.instance.status!=models.PostingStatus.DRAFT: raise serializers.ValidationError("Điều chỉnh đã ghi sổ không được sửa.")
        return attrs


@extend_schema_serializer(component_name="ArApproval")
class ApprovalSerializer(serializers.ModelSerializer):
    class Meta: model=models.ApprovalDecision; fields="__all__"; read_only_fields=("id","decided_at")


class DebtNettingVoucherLineSerializer(serializers.ModelSerializer):
    receivable_code=serializers.CharField(source="receivable.code",read_only=True)
    receivable_source_document_number=serializers.CharField(source="receivable.source_document_number",read_only=True)
    receivable_document_date=serializers.DateField(source="receivable.document_date",read_only=True)
    receivable_due_date=serializers.DateField(source="receivable.due_date",read_only=True)
    receivable_balance=serializers.DecimalField(source="receivable.balance",max_digits=20,decimal_places=4,read_only=True)
    receivable_schedule_installment_no=serializers.IntegerField(source="receivable_schedule.installment_no",read_only=True)
    receivable_schedule_balance=serializers.DecimalField(source="receivable_schedule.balance",max_digits=20,decimal_places=4,read_only=True)
    receivable_schedule_due_date=serializers.DateField(source="receivable_schedule.due_date",read_only=True)
    payable_source_document_number=serializers.SerializerMethodField()
    payable_due_date=serializers.DateField(source="payable.due_date",read_only=True)
    payable_balance=serializers.DecimalField(source="payable.balance",max_digits=20,decimal_places=4,read_only=True)

    def get_payable_source_document_number(self,obj):
        if not obj.payable:
            return ""
        if obj.payable.invoice:
            return obj.payable.invoice.invoice_number
        if obj.payable.goods_purchase:
            return obj.payable.goods_purchase.number
        return str(obj.payable.id)[:8]

    class Meta:
        model=models.DebtNettingVoucherLine
        fields=(
            "id","line_no","receivable","receivable_schedule","payable","amount",
            "receivable_exchange_rate","payable_exchange_rate",
            "receivable_converted_amount","payable_converted_amount",
            "exchange_gain_loss","netting_record","receivable_code",
            "receivable_source_document_number","receivable_document_date","receivable_due_date",
            "receivable_balance","receivable_schedule_installment_no",
            "receivable_schedule_balance","receivable_schedule_due_date",
            "payable_source_document_number","payable_due_date","payable_balance",
        )
        read_only_fields=(
            "id","line_no","receivable_exchange_rate","payable_exchange_rate",
            "receivable_converted_amount","payable_converted_amount",
            "exchange_gain_loss","netting_record","receivable_code",
            "receivable_source_document_number","receivable_document_date","receivable_due_date",
            "receivable_balance","receivable_schedule_installment_no",
            "receivable_schedule_balance","receivable_schedule_due_date",
            "payable_source_document_number","payable_due_date","payable_balance",
        )


class DebtNettingVoucherSerializer(serializers.ModelSerializer):
    lines=DebtNettingVoucherLineSerializer(many=True,required=False)
    customer_name=serializers.CharField(source="customer.name",read_only=True)
    supplier_name=serializers.CharField(source="supplier.name",read_only=True)
    currency_code=serializers.CharField(source="currency.code",read_only=True)
    receivable_account_code=serializers.CharField(source="receivable_account.code",read_only=True)
    payable_account_code=serializers.CharField(source="payable_account.code",read_only=True)

    class Meta:
        model=models.DebtNettingVoucher
        fields="__all__"
        read_only_fields=(
            "id","number","supplier","total_amount","status","workflow_snapshot",
            "journal_entry","created_by","created_at","updated_at","submitted_at",
            "approved_by","approved_at","posted_by","posted_at","unposted_by",
            "unposted_at","unpost_reason","cancelled_by","cancelled_at",
            "cancel_reason","rejection_reason","revision_reason","posting_count",
        )

    def validate(self,attrs):
        from .netting_voucher import validate_voucher_data
        if self.instance and self.instance.status not in {
            models.DebtNettingVoucher.Status.DRAFT,
            models.DebtNettingVoucher.Status.REVISION_REQUESTED,
            models.DebtNettingVoucher.Status.REJECTED,
        }:
            raise serializers.ValidationError("Không thể sửa chứng từ ở trạng thái hiện tại.")
        if self.instance:
            for field in ("company","branch"):
                if field in attrs and attrs[field].pk != getattr(self.instance,field+"_id"):
                    raise serializers.ValidationError({field:"Không được đổi doanh nghiệp hoặc chi nhánh."})
        lines_data=attrs.get("lines")
        validate_voucher_data(attrs,self.instance,lines_data)
        return attrs

    def create(self,validated_data):
        from .netting_voucher import save_voucher
        user=self.context["request"].user.iam_account if hasattr(self.context["request"].user,"iam_account") else None
        return save_voucher(validated_data,None,user)

    def update(self,instance,validated_data):
        from .netting_voucher import save_voucher
        user=self.context["request"].user.iam_account if hasattr(self.context["request"].user,"iam_account") else None
        return save_voucher(validated_data,instance,user)


class DebtNettingApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.DebtNettingApproval
        fields="__all__"
        read_only_fields=("id","decided_at")


class DebtAdjustmentVoucherLineSerializer(serializers.ModelSerializer):
    receivable_code=serializers.CharField(source="receivable.code",read_only=True)
    receivable_source_document_number=serializers.CharField(source="receivable.source_document_number",read_only=True)
    receivable_document_date=serializers.DateField(source="receivable.document_date",read_only=True)
    receivable_posting_date=serializers.DateField(source="receivable.posting_date",read_only=True)
    receivable_due_date=serializers.DateField(source="receivable.due_date",read_only=True)
    receivable_balance=serializers.DecimalField(source="receivable.balance",max_digits=20,decimal_places=4,read_only=True)
    receivable_schedule_installment_no=serializers.IntegerField(source="receivable_schedule.installment_no",read_only=True)
    receivable_schedule_balance=serializers.DecimalField(source="receivable_schedule.balance",max_digits=20,decimal_places=4,read_only=True)
    receivable_schedule_due_date=serializers.DateField(source="receivable_schedule.due_date",read_only=True)
    created_receivable_code=serializers.CharField(source="created_receivable.code",read_only=True)
    offset_account_code=serializers.CharField(source="offset_account.code",read_only=True)

    class Meta:
        model=models.DebtAdjustmentVoucherLine
        fields=(
            "id","line_no","receivable","receivable_schedule","offset_account",
            "amount","exchange_rate","converted_amount","new_due_date",
            "description","created_receivable","legacy_adjustment",
            "receivable_code","receivable_source_document_number","receivable_document_date",
            "receivable_posting_date","receivable_due_date","receivable_balance",
            "receivable_schedule_installment_no","receivable_schedule_balance","receivable_schedule_due_date",
            "created_receivable_code","offset_account_code",
        )
        read_only_fields=(
            "id","line_no","converted_amount","created_receivable","legacy_adjustment",
            "receivable_code","receivable_source_document_number","receivable_document_date",
            "receivable_posting_date","receivable_due_date","receivable_balance",
            "receivable_schedule_installment_no","receivable_schedule_balance","receivable_schedule_due_date",
            "created_receivable_code","offset_account_code",
        )


class DebtAdjustmentVoucherSerializer(serializers.ModelSerializer):
    lines=DebtAdjustmentVoucherLineSerializer(many=True,required=False)
    customer_name=serializers.CharField(source="customer.name",read_only=True)
    currency_code=serializers.CharField(source="currency.code",read_only=True)
    receivable_account_code=serializers.CharField(source="receivable_account.code",read_only=True)

    class Meta:
        model=models.DebtAdjustmentVoucher
        fields="__all__"
        read_only_fields=(
            "id","number","total_amount","total_converted_amount","status","workflow_snapshot",
            "journal_entry","created_by","created_at","updated_at","submitted_at",
            "approved_by","approved_at","posted_by","posted_at","unposted_by",
            "unposted_at","unpost_reason","cancelled_by","cancelled_at",
            "cancel_reason","rejection_reason","revision_reason","posting_count","version",
        )

    def validate(self,attrs):
        from .adjustment_voucher import validate_voucher_data
        if self.instance and self.instance.status not in {
            models.DebtAdjustmentVoucher.Status.DRAFT,
            models.DebtAdjustmentVoucher.Status.REVISION_REQUESTED,
            models.DebtAdjustmentVoucher.Status.REJECTED,
        }:
            raise serializers.ValidationError("Không thể sửa chứng từ ở trạng thái hiện tại.")
        if self.instance:
            for field in ("company","branch"):
                if field in attrs and attrs[field].pk != getattr(self.instance,field+"_id"):
                    raise serializers.ValidationError({field:"Không được đổi doanh nghiệp hoặc chi nhánh."})
        lines_data=attrs.get("lines")
        validate_voucher_data(attrs,self.instance,lines_data)
        return attrs

    def create(self,validated_data):
        from .adjustment_voucher import save_voucher
        user=self.context["request"].user.iam_account if hasattr(self.context["request"].user,"iam_account") else None
        return save_voucher(validated_data,None,user)

    def update(self,instance,validated_data):
        from .adjustment_voucher import save_voucher
        user=self.context["request"].user.iam_account if hasattr(self.context["request"].user,"iam_account") else None
        return save_voucher(validated_data,instance,user)


class CustomerDebtReconciliationLineSerializer(serializers.ModelSerializer):
    receivable_code = serializers.CharField(source="receivable.code", read_only=True)

    class Meta:
        model = models.CustomerDebtReconciliationLine
        fields = (
            "id", "line_no", "posting_date", "document_date", "document_number",
            "document_type", "description", "increase_amount", "decrease_amount",
            "receivable", "receivable_code", "running_balance",
            "source_entity_type", "source_entity_id",
        )
        read_only_fields = ("id", "line_no", "running_balance", "receivable_code")


class CustomerDebtReconciliationSerializer(serializers.ModelSerializer):
    lines = CustomerDebtReconciliationLineSerializer(many=True, required=False)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    receivable_account_code = serializers.CharField(source="receivable_account.code", read_only=True)
    previous_reconciliation_number = serializers.CharField(source="previous_reconciliation.number", read_only=True)

    class Meta:
        model = models.CustomerDebtReconciliation
        fields = "__all__"
        read_only_fields = (
            "id", "number", "opening_balance", "period_increase", "period_decrease",
            "closing_balance", "unallocated_receipts", "data_extracted_at",
            "status", "sent_at", "sent_channel", "sent_by", "sent_note",
            "response_date", "customer_confirmer_name", "customer_confirmed_balance",
            "customer_confirmed_unallocated", "balance_difference", "unallocated_difference",
            "response_comment", "difference_reason", "confirmation_documents",
            "responded_by", "responded_at", "cancelled_by", "cancelled_at", "cancel_reason",
            "created_by", "created_at", "updated_at", "version",
            "customer_name", "customer_code", "currency_code", "receivable_account_code",
            "previous_reconciliation_number",
        )

    def validate(self, attrs):
        from .debt_reconciliation import validate_reconciliation_data
        if self.instance and self.instance.status != models.CustomerDebtReconciliation.Status.DRAFT:
            raise serializers.ValidationError("Không thể sửa biên bản ở trạng thái hiện tại.")
        if self.instance:
            for field in ("company", "branch"):
                if field in attrs and attrs[field].pk != getattr(self.instance, field + "_id"):
                    raise serializers.ValidationError({field: "Không được đổi doanh nghiệp hoặc chi nhánh."})
        validate_reconciliation_data(attrs, self.instance)
        return attrs

    def create(self, validated_data):
        from .debt_reconciliation import save_reconciliation
        user = self.context["request"].user if "request" in self.context else None
        return save_reconciliation(validated_data, None, user)

    def update(self, instance, validated_data):
        from .debt_reconciliation import save_reconciliation
        user = self.context["request"].user if "request" in self.context else None
        return save_reconciliation(validated_data, instance, user)



class DebtAdjustmentApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.DebtAdjustmentApproval
        fields="__all__"
        read_only_fields=("id","decided_at")


class DueDebtItemSerializer(serializers.Serializer):
    receivable_id = serializers.CharField()
    receivable_code = serializers.CharField()
    schedule_id = serializers.CharField(allow_null=True)
    installment_no = serializers.IntegerField(allow_null=True)
    schedule_code = serializers.CharField(allow_blank=True)
    customer_id = serializers.CharField()
    customer_code = serializers.CharField()
    customer_name = serializers.CharField()
    customer_group = serializers.CharField(allow_blank=True)
    assigned_staff_id = serializers.CharField(allow_null=True)
    assigned_staff_name = serializers.CharField()
    branch_id = serializers.CharField(allow_null=True)
    branch_name = serializers.CharField(allow_blank=True)
    document_number = serializers.CharField()
    document_date = serializers.CharField(allow_null=True)
    posting_date = serializers.CharField(allow_null=True)
    receivable_account_id = serializers.CharField(allow_null=True)
    receivable_account_code = serializers.CharField()
    receivable_account_name = serializers.CharField()
    currency_id = serializers.CharField()
    currency_code = serializers.CharField()
    exchange_rate = serializers.CharField()
    original_amount = serializers.CharField()
    reduced_amount = serializers.CharField()
    remaining_balance = serializers.CharField()
    base_remaining_balance = serializers.CharField()
    due_date = serializers.CharField(allow_null=True)
    due_category = serializers.CharField()
    due_category_label = serializers.CharField()
    days_due = serializers.IntegerField(allow_null=True)
    days_overdue = serializers.IntegerField(allow_null=True)


class DueDebtSummarySerializer(serializers.Serializer):
    currency_id = serializers.CharField()
    currency_code = serializers.CharField()
    total_remaining_balance = serializers.CharField()
    overdue_balance = serializers.CharField()
    due_today_balance = serializers.CharField()
    upcoming_balance = serializers.CharField()
    not_due_balance = serializers.CharField()
    no_due_date_balance = serializers.CharField()
    total_count = serializers.IntegerField()
    overdue_count = serializers.IntegerField()
    due_today_count = serializers.IntegerField()
    upcoming_count = serializers.IntegerField()
    not_due_count = serializers.IntegerField()
    no_due_date_count = serializers.IntegerField()


class DueDebtBaseSummarySerializer(serializers.Serializer):
    accounting_currency_code = serializers.CharField()
    base_total_remaining_balance = serializers.CharField()
    base_overdue_balance = serializers.CharField()
    base_due_today_balance = serializers.CharField()
    base_upcoming_balance = serializers.CharField()
    base_not_due_balance = serializers.CharField()
    base_no_due_date_balance = serializers.CharField()
    total_count = serializers.IntegerField()
    overdue_count = serializers.IntegerField()
    due_today_count = serializers.IntegerField()
    upcoming_count = serializers.IntegerField()
    not_due_count = serializers.IntegerField()
    no_due_date_count = serializers.IntegerField()


class DueTrackingReportSerializer(serializers.Serializer):
    as_of_date = serializers.CharField()
    filters = serializers.DictField()
    assigned_staff_note = serializers.CharField()
    data_extracted_at = serializers.CharField()
    items = DueDebtItemSerializer(many=True)
    total_filtered_items = serializers.IntegerField()
    summaries = DueDebtSummarySerializer(many=True)
    base_summary = DueDebtBaseSummarySerializer()


class PrepareCollectionItemInputSerializer(serializers.Serializer):
    receivable_id = serializers.UUIDField()
    schedule_id = serializers.UUIDField(required=False, allow_null=True)


class PrepareCollectionRequestSerializer(serializers.Serializer):
    selected_items = PrepareCollectionItemInputSerializer(many=True)


class CustomerPaymentReminderSendLogSerializer(serializers.ModelSerializer):
    sent_by_username = serializers.CharField(source="sent_by.username", read_only=True)

    class Meta:
        model = models.CustomerPaymentReminderSendLog
        fields = (
            "id", "sent_date", "sent_channel", "channel_other_name",
            "actual_recipient", "proof_documents", "note", "sent_by",
            "sent_by_username", "sent_at",
        )
        read_only_fields = ("id", "sent_by", "sent_by_username", "sent_at")


class CustomerPaymentReminderLineSerializer(serializers.ModelSerializer):
    receivable_code = serializers.CharField(source="receivable.code", read_only=True)

    class Meta:
        model = models.CustomerPaymentReminderLine
        fields = (
            "id", "line_no", "receivable", "receivable_code",
            "receivable_schedule", "installment_no",
            "source_document_number", "source_document_date",
            "invoice_series", "invoice_number", "invoice_date",
            "original_due_date", "remaining_balance", "requested_amount",
            "days_overdue", "line_note",
        )
        read_only_fields = ("id", "line_no", "receivable_code", "remaining_balance", "days_overdue")


class CustomerPaymentReminderSerializer(serializers.ModelSerializer):
    lines = CustomerPaymentReminderLineSerializer(many=True, required=False)
    send_logs = CustomerPaymentReminderSendLogSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    receivable_account_code = serializers.CharField(source="receivable_account.code", read_only=True)
    company_bank_account_number = serializers.CharField(source="company_bank_account.account_number", read_only=True)
    previous_notice_number = serializers.CharField(source="previous_notice.notice_number", read_only=True)
    signer_name = serializers.CharField(required=False, allow_blank=True)
    signer_title = serializers.CharField(required=False, allow_blank=True)
    content = serializers.CharField(required=False, allow_blank=True)
    transfer_note = serializers.CharField(required=False, allow_blank=True)
    cash_location = serializers.CharField(required=False, allow_blank=True)


    class Meta:
        model = models.CustomerPaymentReminder
        fields = "__all__"
        read_only_fields = (
            "id", "notice_number", "total_requested_amount", "bank_info_snapshot",
            "data_extracted_at", "status", "last_sent_at", "last_sent_channel",
            "send_count", "previous_notice", "cancelled_by", "cancelled_at",
            "cancel_reason", "created_by", "created_at", "updated_at",
            "customer_name", "customer_code", "currency_code",
            "receivable_account_code", "company_bank_account_number",
            "previous_notice_number",
        )

    def validate(self, attrs):
        from .payment_reminder import validate_reminder_data
        company = attrs.get("company") or (self.instance.company if self.instance else None)
        if not company:
            company_id = self.initial_data.get("company") or self.initial_data.get("company_id")
            if company_id:
                from organization.models import Company
                company = Company.objects.filter(pk=company_id).first()
        if company:
            validate_reminder_data(company, self.initial_data, self.instance)
        return attrs

    def create(self, validated_data):
        from .payment_reminder import save_payment_reminder
        user = self.context["request"].user.iam_account if ("request" in self.context and hasattr(self.context["request"].user, "iam_account")) else None
        return save_payment_reminder(self.initial_data, None, user)

    def update(self, instance, validated_data):
        from .payment_reminder import save_payment_reminder
        user = self.context["request"].user.iam_account if ("request" in self.context and hasattr(self.context["request"].user, "iam_account")) else None
        return save_payment_reminder(self.initial_data, instance, user)




