import uuid
from django.db import models
from django.db.models import Q


class DocumentStatus(models.TextChoices):
    DRAFT="DRAFT","Bản nháp"
    PENDING_APPROVAL="PENDING_APPROVAL","Chờ phê duyệt"
    APPROVED="APPROVED","Đã phê duyệt"
    REJECTED="REJECTED","Bị từ chối"
    POSTED="POSTED","Đã ghi sổ"
    REVERSED="REVERSED","Đã đảo"
    CANCELLED="CANCELLED","Đã hủy"


class ReceivableStatus(models.TextChoices):
    OPEN="OPEN","Chưa thu"
    PARTIALLY_PAID="PARTIALLY_PAID","Đã thu một phần"
    PAID="PAID","Đã thu đủ"
    REVERSED="REVERSED","Đã đảo"


class PostingStatus(models.TextChoices):
    DRAFT="DRAFT","Bản nháp"
    POSTED="POSTED","Đã ghi sổ"
    REVERSED="REVERSED","Đã đảo"


class ReceiptStatus(models.TextChoices):
    CONFIRMED="CONFIRMED","Có hiệu lực"
    CANCELLED="CANCELLED","Đã hủy"


class CreditControlMode(models.TextChoices):
    BLOCK="BLOCK","Chặn"
    WARN="WARN","Cảnh báo"
    APPROVAL="APPROVAL","Yêu cầu duyệt"
    NONE="NONE","Không kiểm soát"


class ApprovalDecisionType(models.TextChoices):
    SUBMITTED="SUBMITTED","Đã gửi"
    APPROVED="APPROVED","Phê duyệt"
    REJECTED="REJECTED","Từ chối"


class ReceivableDocument(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT,related_name="receivable_documents")
    branch=models.ForeignKey("organization.Branch",on_delete=models.PROTECT,null=True,blank=True)
    number=models.CharField(max_length=80)
    document_type=models.CharField(max_length=30,choices=(("SALES_INVOICE","Hóa đơn bán"),("SALES_DOCUMENT","Chứng từ bán"),("OTHER","Phải thu khác")))
    document_date=models.DateField()
    posting_date=models.DateField()
    due_date=models.DateField()
    payment_term=models.ForeignKey("master_data.PaymentTerm",on_delete=models.PROTECT,null=True,blank=True,related_name="receivable_documents")
    payment_method_config=models.ForeignKey("master_data.PaymentMethod",on_delete=models.PROTECT,null=True,blank=True,related_name="receivable_documents")
    payment_method_snapshot=models.JSONField(default=dict,blank=True)
    customer=models.ForeignKey("master_data.Party",on_delete=models.PROTECT,related_name="receivable_documents")
    currency=models.ForeignKey("master_data.Currency",on_delete=models.PROTECT)
    exchange_rate=models.DecimalField(max_digits=20,decimal_places=8,default=1)
    amount=models.DecimalField(max_digits=20,decimal_places=4)
    description=models.CharField(max_length=500)
    sales_order=models.ForeignKey("sales.SalesOrder",on_delete=models.PROTECT,null=True,blank=True,related_name="receivable_documents")
    sales_contract=models.ForeignKey("sales.SalesContract",on_delete=models.PROTECT,null=True,blank=True,related_name="receivable_documents")
    invoice_request=models.ForeignKey("sales.InvoiceRequest",on_delete=models.PROTECT,null=True,blank=True,related_name="receivable_documents")
    source_reference=models.CharField(max_length=120,blank=True)
    status=models.CharField(max_length=30,choices=DocumentStatus.choices,default=DocumentStatus.DRAFT)
    approval_required=models.BooleanField(default=True)
    workflow_snapshot=models.JSONField(default=dict,blank=True)
    posting_reference=models.CharField(max_length=120,blank=True)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="receivable_documents_created")
    submitted_at=models.DateTimeField(null=True,blank=True)
    approved_at=models.DateTimeField(null=True,blank=True)
    posted_at=models.DateTimeField(null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        db_table="ar_document"; ordering=("-document_date","-created_at")
        constraints=[models.UniqueConstraint(fields=("company","document_type","number"),name="uq_ar_document_number"),models.CheckConstraint(condition=Q(amount__gt=0,exchange_rate__gt=0),name="ck_ar_document_amounts")]


class ApprovalDecision(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT,related_name="ar_approval_decisions")
    document=models.ForeignKey(ReceivableDocument,on_delete=models.PROTECT,related_name="approval_decisions")
    level=models.PositiveSmallIntegerField(default=1)
    decision=models.CharField(max_length=20,choices=ApprovalDecisionType.choices)
    actor=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="ar_approval_decisions")
    comment=models.CharField(max_length=1000,blank=True)
    decided_at=models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table="ar_approval_decision"; ordering=("decided_at",)


class Receivable(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    branch=models.ForeignKey("organization.Branch",on_delete=models.PROTECT,null=True,blank=True)
    code=models.CharField(max_length=80,blank=True,default="")
    customer=models.ForeignKey("master_data.Party",on_delete=models.PROTECT,related_name="receivables")
    source_document_type=models.CharField(max_length=50,blank=True,default="AR_DOCUMENT")
    source_document_id=models.CharField(max_length=100,blank=True,default="")
    source_document_number=models.CharField(max_length=100,blank=True,default="")
    source_line_id=models.CharField(max_length=100,blank=True,default="")
    document=models.OneToOneField(ReceivableDocument,on_delete=models.PROTECT,null=True,blank=True,related_name="receivable")
    journal_entry=models.ForeignKey("general_ledger.JournalEntry",on_delete=models.PROTECT,null=True,blank=True,related_name="receivables")
    account=models.ForeignKey("general_ledger.Account",on_delete=models.PROTECT,null=True,blank=True,related_name="receivables")
    document_date=models.DateField(null=True,blank=True)
    posting_date=models.DateField(null=True,blank=True)
    currency=models.ForeignKey("master_data.Currency",on_delete=models.PROTECT)
    exchange_rate=models.DecimalField(max_digits=20,decimal_places=8,default=1)
    original_amount=models.DecimalField(max_digits=20,decimal_places=4)
    collected_amount=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    netted_amount=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    adjustment_amount=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    balance=models.DecimalField(max_digits=20,decimal_places=4)
    payment_term=models.ForeignKey("master_data.PaymentTerm",on_delete=models.PROTECT,null=True,blank=True,related_name="receivables")
    due_date=models.DateField(null=True,blank=True)
    sales_order=models.ForeignKey("sales.SalesOrder",on_delete=models.PROTECT,null=True,blank=True,related_name="receivables")
    sales_contract=models.ForeignKey("sales.SalesContract",on_delete=models.PROTECT,null=True,blank=True,related_name="receivables")
    description=models.CharField(max_length=500,blank=True,default="")
    status=models.CharField(max_length=30,choices=ReceivableStatus.choices,default=ReceivableStatus.OPEN)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="receivables_created")
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)
    reversed_at=models.DateTimeField(null=True,blank=True)

    class Meta:
        db_table="ar_receivable"
        ordering=("due_date","created_at")
        constraints=[
            models.CheckConstraint(condition=Q(original_amount__gte=0,collected_amount__gte=0,netted_amount__gte=0,balance__gte=0),name="ck_ar_receivable_amounts"),
            models.UniqueConstraint(fields=("company","code"),name="uq_ar_receivable_code",condition=Q(code__gt="")),
            models.UniqueConstraint(fields=("company","source_document_type","source_document_id","source_line_id"),name="uq_ar_receivable_source",condition=Q(source_document_id__gt="")),
        ]

    @property
    def is_overdue(self):
        from django.utils import timezone
        today = timezone.localdate()
        if self.balance <= 0 or self.status == ReceivableStatus.PAID:
            return False
        active_schedules = self.schedules.filter(balance__gt=0)
        if active_schedules.exists():
            return any(bool(s.due_date and s.due_date < today) for s in active_schedules)
        return bool(self.due_date and self.due_date < today)


class ReceivableSchedule(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT,related_name="receivable_schedules")
    receivable=models.ForeignKey(Receivable,on_delete=models.CASCADE,related_name="schedules")
    installment_no=models.PositiveIntegerField(default=1)
    amount=models.DecimalField(max_digits=20,decimal_places=4)
    due_date=models.DateField()
    collected_amount=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    balance=models.DecimalField(max_digits=20,decimal_places=4)
    status=models.CharField(max_length=30,choices=ReceivableStatus.choices,default=ReceivableStatus.OPEN)
    notes=models.CharField(max_length=500,blank=True,default="")
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        db_table="ar_receivable_schedule"
        ordering=("installment_no",)
        constraints=[
            models.UniqueConstraint(fields=("receivable","installment_no"),name="uq_ar_schedule_installment"),
            models.CheckConstraint(condition=Q(amount__gt=0),name="ck_ar_schedule_amount_positive"),
        ]

    @property
    def is_overdue(self):
        from django.utils import timezone
        return self.due_date < timezone.localdate() and self.balance > 0 and self.status != ReceivableStatus.PAID


class ReceivableScheduleHistory(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    receivable=models.ForeignKey(Receivable,on_delete=models.CASCADE,related_name="schedule_histories")
    changed_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    changed_at=models.DateTimeField(auto_now_add=True)
    reason=models.CharField(max_length=500)
    old_schedule=models.JSONField(default=list)
    new_schedule=models.JSONField(default=list)

    class Meta:
        db_table="ar_receivable_schedule_history"
        ordering=("-changed_at",)


class CreditPolicy(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    customer=models.ForeignKey("master_data.Party",on_delete=models.PROTECT,related_name="credit_policies")
    branch=models.ForeignKey("organization.Branch",on_delete=models.PROTECT,null=True,blank=True)
    currency=models.ForeignKey("master_data.Currency",on_delete=models.PROTECT,null=True,blank=True)
    credit_limit=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    credit_days=models.PositiveIntegerField(default=0)
    control_mode=models.CharField(max_length=20,choices=CreditControlMode.choices,default=CreditControlMode.WARN)
    overdue_mode=models.CharField(max_length=20,choices=CreditControlMode.choices,default=CreditControlMode.WARN)
    effective_from=models.DateField()
    effective_to=models.DateField(null=True,blank=True)
    status=models.CharField(max_length=20,choices=(("ACTIVE","Hoạt động"),("INACTIVE","Ngừng")),default="ACTIVE")
    reason=models.CharField(max_length=500)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        db_table="ar_credit_policy"
        constraints=[models.UniqueConstraint(fields=("company","customer","branch","currency","effective_from"),name="uq_ar_credit_policy_version"),models.CheckConstraint(condition=Q(credit_limit__gte=0),name="ck_ar_credit_limit"),models.CheckConstraint(condition=Q(effective_to__isnull=True)|Q(effective_to__gte=models.F("effective_from")),name="ck_ar_credit_dates")]


class CollectionPlan(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    receivable=models.ForeignKey(Receivable,on_delete=models.PROTECT,related_name="collection_plans")
    expected_date=models.DateField()
    expected_amount=models.DecimalField(max_digits=20,decimal_places=4)
    responsible=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="ar_collection_plans")
    status=models.CharField(max_length=20,choices=(("PLANNED","Đã lập kế hoạch"),("CONTACTED","Đã liên hệ"),("PROMISED","Khách hẹn thanh toán"),("COMPLETED","Hoàn tất"),("CANCELLED","Đã hủy")),default="PLANNED")
    note=models.CharField(max_length=1000,blank=True)
    contact_history=models.JSONField(default=list,blank=True)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="ar_collection_plans_created")
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        db_table="ar_collection_plan"
        constraints=[models.CheckConstraint(condition=Q(expected_amount__gt=0),name="ck_ar_collection_plan_amount")]


class Receipt(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    customer=models.ForeignKey("master_data.Party",on_delete=models.PROTECT)
    currency=models.ForeignKey("master_data.Currency",on_delete=models.PROTECT)
    receipt_date=models.DateField()
    amount=models.DecimalField(max_digits=20,decimal_places=4)
    allocated_amount=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    external_type=models.CharField(max_length=20,choices=(("BANK","Ngân hàng"),("CASH","Tiền mặt"),("OTHER","Khác")))
    external_reference=models.CharField(max_length=120)
    payment_method_config=models.ForeignKey("master_data.PaymentMethod",on_delete=models.PROTECT,null=True,blank=True,related_name="receivable_receipts")
    payment_method_snapshot=models.JSONField(default=dict,blank=True)
    company_bank_account=models.ForeignKey("master_data.CompanyBankAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="receivable_receipts")
    cash_fund=models.ForeignKey("cash_management.CashFund",on_delete=models.PROTECT,null=True,blank=True,related_name="receivable_receipts")
    status=models.CharField(max_length=20,choices=ReceiptStatus.choices,default=ReceiptStatus.CONFIRMED)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    created_at=models.DateTimeField(auto_now_add=True)
    branch=models.ForeignKey("organization.Branch",on_delete=models.PROTECT,null=True,blank=True)
    credit_account=models.ForeignKey("general_ledger.Account",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_receipts")
    exchange_rate=models.DecimalField(max_digits=20,decimal_places=8,default=1)
    base_amount=models.DecimalField(max_digits=24,decimal_places=4,default=0)

    class Meta:
        db_table="ar_receipt"
        constraints=[models.UniqueConstraint(fields=("company","external_type","external_reference"),name="uq_ar_receipt_external"),models.CheckConstraint(condition=Q(amount__gt=0,allocated_amount__gte=0),name="ck_ar_receipt_amounts")]


class ReceiptAllocation(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    receipt=models.ForeignKey(Receipt,on_delete=models.PROTECT,related_name="allocations")
    receivable=models.ForeignKey(Receivable,on_delete=models.PROTECT,related_name="allocations")
    amount=models.DecimalField(max_digits=20,decimal_places=4)
    exchange_rate=models.DecimalField(max_digits=20,decimal_places=8,default=1)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    created_at=models.DateTimeField(auto_now_add=True)
    effective_date=models.DateField(null=True,blank=True)
    schedule=models.ForeignKey(ReceivableSchedule,on_delete=models.SET_NULL,null=True,blank=True,related_name="receipt_allocations")
    installment_no=models.PositiveIntegerField(null=True,blank=True)
    receipt_book_amount=models.DecimalField(max_digits=24,decimal_places=4,null=True,blank=True)
    debt_book_amount=models.DecimalField(max_digits=24,decimal_places=4,null=True,blank=True)
    reversed_at=models.DateTimeField(null=True,blank=True)

    class Meta:
        db_table="ar_receipt_allocation"
        constraints=[models.CheckConstraint(condition=Q(amount__gt=0,exchange_rate__gt=0),name="ck_ar_allocation_values")]


class CustomerReceiptVoucher(models.Model):
    class Status(models.TextChoices):
        DRAFT="DRAFT","Nháp"
        PENDING_APPROVAL="PENDING_APPROVAL","Chờ duyệt"
        REVISION_REQUESTED="REVISION_REQUESTED","Yêu cầu chỉnh sửa"
        REJECTED="REJECTED","Từ chối"
        APPROVED="APPROVED","Đã duyệt"
        POSTED="POSTED","Đã ghi sổ"
        CANCELLED="CANCELLED","Đã hủy"

    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    branch=models.ForeignKey("organization.Branch",on_delete=models.PROTECT)
    number=models.CharField(max_length=80)
    document_date=models.DateField()
    posting_date=models.DateField()
    customer=models.ForeignKey("master_data.Party",on_delete=models.PROTECT)
    payer_name=models.CharField(max_length=255,blank=True)
    method=models.CharField(max_length=10,choices=(("CASH","Tiền mặt"),("BANK","Chuyển khoản")),default="CASH")
    cash_fund=models.ForeignKey("cash_management.CashFund",on_delete=models.PROTECT,null=True,blank=True)
    bank_account=models.ForeignKey("master_data.CompanyBankAccount",on_delete=models.PROTECT,null=True,blank=True)
    bank_reference=models.CharField(max_length=120,blank=True)
    purpose=models.CharField(max_length=20,choices=(("DEBT","Thanh toán công nợ"),("ADVANCE","Ứng trước")),default="DEBT")
    currency=models.ForeignKey("master_data.Currency",on_delete=models.PROTECT)
    amount=models.DecimalField(max_digits=20,decimal_places=4)
    exchange_rate=models.DecimalField(max_digits=20,decimal_places=8,default=1)
    debit_account=models.ForeignKey("general_ledger.Account",on_delete=models.PROTECT,related_name="ar_receipt_debits")
    credit_account=models.ForeignKey("general_ledger.Account",on_delete=models.PROTECT,related_name="ar_receipt_credits")
    description=models.CharField(max_length=500)
    sales_order=models.ForeignKey("sales.SalesOrder",on_delete=models.PROTECT,null=True,blank=True)
    sales_contract=models.ForeignKey("sales.SalesContract",on_delete=models.PROTECT,null=True,blank=True)
    attachments=models.JSONField(default=list,blank=True)
    approval_required=models.BooleanField(default=False)
    status=models.CharField(max_length=30,choices=Status.choices,default=Status.DRAFT)
    workflow_snapshot=models.JSONField(default=dict,blank=True)
    receipt=models.OneToOneField(Receipt,on_delete=models.PROTECT,null=True,blank=True,related_name="voucher")
    cash_transaction=models.OneToOneField("cash_management.CashTransaction",on_delete=models.PROTECT,null=True,blank=True)
    bank_transaction=models.OneToOneField("bank_management.BankTransaction",on_delete=models.PROTECT,null=True,blank=True)
    journal_entry=models.OneToOneField("general_ledger.JournalEntry",on_delete=models.PROTECT,null=True,blank=True)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="ar_receipt_vouchers_created")
    approved_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_receipt_vouchers_approved")
    posted_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_receipt_vouchers_posted")
    submitted_at=models.DateTimeField(null=True,blank=True)
    approved_at=models.DateTimeField(null=True,blank=True)
    posted_at=models.DateTimeField(null=True,blank=True)
    cancelled_at=models.DateTimeField(null=True,blank=True)
    cancel_reason=models.CharField(max_length=500,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        db_table="ar_customer_receipt_voucher"
        constraints=[
            models.UniqueConstraint(fields=("company","number"),name="uq_ar_customer_receipt_number"),
            models.UniqueConstraint(fields=("company","bank_reference"),condition=Q(bank_reference__gt="",status="POSTED"),name="uq_ar_posted_bank_reference"),
            models.CheckConstraint(condition=Q(amount__gt=0,exchange_rate__gt=0),name="ck_ar_customer_receipt_amount"),
        ]


class CustomerReceiptLine(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    voucher=models.ForeignKey(CustomerReceiptVoucher,on_delete=models.CASCADE,related_name="lines")
    receivable=models.ForeignKey(Receivable,on_delete=models.PROTECT)
    schedule=models.ForeignKey(ReceivableSchedule,on_delete=models.SET_NULL,null=True,blank=True)
    amount=models.DecimalField(max_digits=20,decimal_places=4)
    receipt_allocation=models.OneToOneField(ReceiptAllocation,on_delete=models.PROTECT,null=True,blank=True)

    class Meta:
        db_table="ar_customer_receipt_line"
        constraints=[models.CheckConstraint(condition=Q(amount__gt=0),name="ck_ar_customer_receipt_line_amount")]


class CustomerReceiptApproval(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    voucher=models.ForeignKey(CustomerReceiptVoucher,on_delete=models.PROTECT,related_name="decisions")
    level=models.PositiveSmallIntegerField(default=1)
    decision=models.CharField(max_length=25)
    actor=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    comment=models.CharField(max_length=1000,blank=True)
    decided_at=models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table="ar_customer_receipt_approval"


class ReceiptAllocationVoucher(models.Model):
    class Status(models.TextChoices):
        DRAFT="DRAFT","Nháp"
        POSTED="POSTED","Đã ghi sổ"
        CANCELLED="CANCELLED","Đã hủy"
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    branch=models.ForeignKey("organization.Branch",on_delete=models.PROTECT)
    number=models.CharField(max_length=80)
    allocation_date=models.DateField()
    customer=models.ForeignKey("master_data.Party",on_delete=models.PROTECT)
    receipt=models.ForeignKey(Receipt,on_delete=models.PROTECT,related_name="allocation_vouchers")
    currency=models.ForeignKey("master_data.Currency",on_delete=models.PROTECT)
    credit_account=models.ForeignKey("general_ledger.Account",on_delete=models.PROTECT)
    description=models.CharField(max_length=500)
    attachments=models.JSONField(default=list,blank=True)
    status=models.CharField(max_length=20,choices=Status.choices,default=Status.DRAFT)
    journal_entry=models.OneToOneField("general_ledger.JournalEntry",on_delete=models.PROTECT,null=True,blank=True)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="ar_allocation_vouchers_created")
    posted_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_allocation_vouchers_posted")
    posted_at=models.DateTimeField(null=True,blank=True)
    unposted_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_allocation_vouchers_unposted")
    unposted_at=models.DateTimeField(null=True,blank=True)
    unpost_reason=models.CharField(max_length=500,blank=True)
    posting_count=models.PositiveIntegerField(default=0)
    cancelled_at=models.DateTimeField(null=True,blank=True)
    cancel_reason=models.CharField(max_length=500,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        db_table="ar_receipt_allocation_voucher"
        constraints=[models.UniqueConstraint(fields=("company","number"),name="uq_ar_allocation_voucher_number")]


class ReceiptAllocationVoucherLine(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    voucher=models.ForeignKey(ReceiptAllocationVoucher,on_delete=models.CASCADE,related_name="lines")
    receivable=models.ForeignKey(Receivable,on_delete=models.PROTECT)
    schedule=models.ForeignKey(ReceivableSchedule,on_delete=models.SET_NULL,null=True,blank=True)
    installment_no=models.PositiveIntegerField(null=True,blank=True)
    amount=models.DecimalField(max_digits=20,decimal_places=4)
    receipt_book_amount=models.DecimalField(max_digits=24,decimal_places=4,default=0)
    debt_book_amount=models.DecimalField(max_digits=24,decimal_places=4,default=0)
    fx_difference=models.DecimalField(max_digits=24,decimal_places=4,default=0)
    allocation=models.OneToOneField(ReceiptAllocation,on_delete=models.PROTECT,null=True,blank=True)

    class Meta:
        db_table="ar_receipt_allocation_voucher_line"
        constraints=[
            models.CheckConstraint(condition=Q(amount__gt=0),name="ck_ar_allocation_line_amount"),
            models.UniqueConstraint(fields=("voucher","receivable","installment_no"),name="uq_ar_allocation_line_target"),
        ]


class Netting(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT,related_name="ar_nettings")
    number=models.CharField(max_length=80)
    receivable=models.ForeignKey(Receivable,on_delete=models.PROTECT,related_name="nettings")
    payable=models.ForeignKey("accounts_payable.Payable",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_nettings")
    netting_date=models.DateField()
    amount=models.DecimalField(max_digits=20,decimal_places=4)
    reason=models.CharField(max_length=500)
    posting_reference=models.CharField(max_length=120,blank=True)
    status=models.CharField(max_length=20,choices=PostingStatus.choices,default=PostingStatus.DRAFT)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="ar_nettings_created")
    created_at=models.DateTimeField(auto_now_add=True)
    posted_at=models.DateTimeField(null=True,blank=True)
    reversed_at=models.DateTimeField(null=True,blank=True)

    class Meta:
        db_table="ar_netting"
        constraints=[models.UniqueConstraint(fields=("company","number"),name="uq_ar_netting_number"),models.CheckConstraint(condition=Q(amount__gt=0),name="ck_ar_netting_amount")]


class BalanceConfirmation(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    number=models.CharField(max_length=80)
    customer=models.ForeignKey("master_data.Party",on_delete=models.PROTECT)
    period_from=models.DateField()
    period_to=models.DateField()
    opening_balance=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    charges=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    receipts=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    closing_balance=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    status=models.CharField(max_length=20,choices=(("DRAFT","Bản nháp"),("PENDING_RESPONSE","Chờ phản hồi"),("AGREED","Đồng ý"),("VARIANCE","Có chênh lệch"),("REJECTED","Từ chối")),default="DRAFT")
    recipient=models.CharField(max_length=255,blank=True)
    sent_history=models.JSONField(default=list,blank=True)
    response_note=models.CharField(max_length=1000,blank=True)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        db_table="ar_balance_confirmation"
        constraints=[models.UniqueConstraint(fields=("company","number"),name="uq_ar_confirmation_number"),models.CheckConstraint(condition=Q(period_to__gte=models.F("period_from")),name="ck_ar_confirmation_dates")]


class ReceivableAdjustment(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    receivable=models.ForeignKey(Receivable,on_delete=models.PROTECT,related_name="adjustments")
    adjustment_date=models.DateField()
    amount=models.DecimalField(max_digits=20,decimal_places=4,help_text="Dương: tăng phải thu; âm: giảm phải thu")
    reason=models.CharField(max_length=500)
    posting_reference=models.CharField(max_length=120,blank=True)
    status=models.CharField(max_length=20,choices=PostingStatus.choices,default=PostingStatus.DRAFT)
    reverses=models.OneToOneField("self",on_delete=models.PROTECT,null=True,blank=True,related_name="reversal")
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    created_at=models.DateTimeField(auto_now_add=True)
    posted_at=models.DateTimeField(null=True,blank=True)

    class Meta:
        db_table="ar_adjustment"
        constraints=[models.CheckConstraint(condition=~Q(amount=0),name="ck_ar_adjustment_nonzero")]


class DebtNettingVoucher(models.Model):
    class Status(models.TextChoices):
        DRAFT="DRAFT","Nháp"
        PENDING_APPROVAL="PENDING_APPROVAL","Chờ duyệt"
        REVISION_REQUESTED="REVISION_REQUESTED","Yêu cầu chỉnh sửa"
        REJECTED="REJECTED","Từ chối"
        APPROVED="APPROVED","Đã duyệt"
        POSTED="POSTED","Đã ghi sổ"
        CANCELLED="CANCELLED","Đã hủy"

    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT,related_name="ar_debt_netting_vouchers")
    branch=models.ForeignKey("organization.Branch",on_delete=models.PROTECT,related_name="ar_debt_netting_vouchers")
    number=models.CharField(max_length=80)
    document_date=models.DateField()
    posting_date=models.DateField()
    customer=models.ForeignKey("master_data.Party",on_delete=models.PROTECT,related_name="ar_debt_netting_vouchers_as_customer")
    supplier=models.ForeignKey("master_data.Party",on_delete=models.PROTECT,related_name="ar_debt_netting_vouchers_as_supplier")
    currency=models.ForeignKey("master_data.Currency",on_delete=models.PROTECT)
    receivable_account=models.ForeignKey("general_ledger.Account",on_delete=models.PROTECT,related_name="ar_netting_vouchers_rec_account")
    payable_account=models.ForeignKey("general_ledger.Account",on_delete=models.PROTECT,related_name="ar_netting_vouchers_pay_account")
    total_amount=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    description=models.CharField(max_length=500)
    agreement_reference=models.CharField(max_length=255,blank=True)
    attachments=models.JSONField(default=list,blank=True)
    approval_required=models.BooleanField(default=False)
    status=models.CharField(max_length=30,choices=Status.choices,default=Status.DRAFT)
    workflow_snapshot=models.JSONField(default=dict,blank=True)
    journal_entry=models.OneToOneField("general_ledger.JournalEntry",on_delete=models.PROTECT,null=True,blank=True)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="ar_debt_netting_vouchers_created")
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)
    submitted_at=models.DateTimeField(null=True,blank=True)
    approved_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_debt_netting_vouchers_approved")
    approved_at=models.DateTimeField(null=True,blank=True)
    posted_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_debt_netting_vouchers_posted")
    posted_at=models.DateTimeField(null=True,blank=True)
    unposted_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_debt_netting_vouchers_unposted")
    unposted_at=models.DateTimeField(null=True,blank=True)
    unpost_reason=models.CharField(max_length=500,blank=True)
    cancelled_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_debt_netting_vouchers_cancelled")
    cancelled_at=models.DateTimeField(null=True,blank=True)
    cancel_reason=models.CharField(max_length=500,blank=True)
    rejection_reason=models.CharField(max_length=500,blank=True)
    revision_reason=models.CharField(max_length=500,blank=True)
    posting_count=models.PositiveIntegerField(default=0)
    version=models.PositiveIntegerField(default=1)

    class Meta:
        db_table="ar_debt_netting_voucher"
        constraints=[
            models.UniqueConstraint(fields=("company","number"),name="uq_ar_debt_netting_voucher_number"),
            models.CheckConstraint(condition=Q(total_amount__gte=0),name="ck_ar_netting_voucher_total_amount"),
        ]


class DebtNettingVoucherLine(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    voucher=models.ForeignKey(DebtNettingVoucher,on_delete=models.CASCADE,related_name="lines")
    line_no=models.PositiveIntegerField()
    receivable=models.ForeignKey(Receivable,on_delete=models.PROTECT,related_name="netting_voucher_lines")
    receivable_schedule=models.ForeignKey(ReceivableSchedule,on_delete=models.SET_NULL,null=True,blank=True,related_name="netting_voucher_lines")
    payable=models.ForeignKey("accounts_payable.Payable",on_delete=models.PROTECT,related_name="netting_voucher_lines")
    amount=models.DecimalField(max_digits=20,decimal_places=4)
    receivable_exchange_rate=models.DecimalField(max_digits=20,decimal_places=8,default=1)
    payable_exchange_rate=models.DecimalField(max_digits=20,decimal_places=8,default=1)
    receivable_converted_amount=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    payable_converted_amount=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    exchange_gain_loss=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    netting_record=models.ForeignKey(Netting,on_delete=models.SET_NULL,null=True,blank=True,related_name="netting_voucher_lines")

    class Meta:
        db_table="ar_debt_netting_voucher_line"
        ordering=("line_no",)
        constraints=[
            models.CheckConstraint(condition=Q(amount__gt=0),name="ck_ar_netting_voucher_line_amount"),
            models.UniqueConstraint(fields=("voucher","line_no"),name="uq_ar_netting_line_no"),
        ]


class DebtNettingApproval(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    voucher=models.ForeignKey(DebtNettingVoucher,on_delete=models.PROTECT,related_name="decisions")
    level=models.PositiveSmallIntegerField(default=1)
    decision=models.CharField(max_length=25)
    actor=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    comment=models.CharField(max_length=1000,blank=True)
    decided_at=models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table="ar_debt_netting_approval"
        ordering=("decided_at",)


class DebtAdjustmentVoucher(models.Model):
    class AdjustmentType(models.TextChoices):
        INCREASE="INCREASE","Tăng công nợ"
        DECREASE="DECREASE","Giảm công nợ"

    class Status(models.TextChoices):
        DRAFT="DRAFT","Nháp"
        PENDING_APPROVAL="PENDING_APPROVAL","Chờ duyệt"
        REVISION_REQUESTED="REVISION_REQUESTED","Yêu cầu chỉnh sửa"
        REJECTED="REJECTED","Từ chối"
        APPROVED="APPROVED","Đã duyệt"
        POSTED="POSTED","Đã ghi sổ"
        CANCELLED="CANCELLED","Đã hủy"

    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT,related_name="ar_debt_adjustment_vouchers")
    branch=models.ForeignKey("organization.Branch",on_delete=models.PROTECT,related_name="ar_debt_adjustment_vouchers")
    number=models.CharField(max_length=80)
    document_date=models.DateField()
    posting_date=models.DateField()
    customer=models.ForeignKey("master_data.Party",on_delete=models.PROTECT,related_name="ar_debt_adjustment_vouchers")
    adjustment_type=models.CharField(max_length=20,choices=AdjustmentType.choices)
    currency=models.ForeignKey("master_data.Currency",on_delete=models.PROTECT)
    receivable_account=models.ForeignKey("general_ledger.Account",on_delete=models.PROTECT,related_name="ar_adjustment_vouchers_rec_account")
    adjustment_reason=models.CharField(max_length=500)
    description=models.CharField(max_length=500)
    document_basis=models.CharField(max_length=255)
    attachments=models.JSONField(default=list,blank=True)
    total_amount=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    total_converted_amount=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    approval_required=models.BooleanField(default=False)
    status=models.CharField(max_length=30,choices=Status.choices,default=Status.DRAFT)
    workflow_snapshot=models.JSONField(default=dict,blank=True)
    journal_entry=models.OneToOneField("general_ledger.JournalEntry",on_delete=models.PROTECT,null=True,blank=True)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="ar_debt_adjustment_vouchers_created")
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)
    submitted_at=models.DateTimeField(null=True,blank=True)
    approved_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_debt_adjustment_vouchers_approved")
    approved_at=models.DateTimeField(null=True,blank=True)
    posted_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_debt_adjustment_vouchers_posted")
    posted_at=models.DateTimeField(null=True,blank=True)
    unposted_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_debt_adjustment_vouchers_unposted")
    unposted_at=models.DateTimeField(null=True,blank=True)
    unpost_reason=models.CharField(max_length=500,blank=True)
    cancelled_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="ar_debt_adjustment_vouchers_cancelled")
    cancelled_at=models.DateTimeField(null=True,blank=True)
    cancel_reason=models.CharField(max_length=500,blank=True)
    rejection_reason=models.CharField(max_length=500,blank=True)
    revision_reason=models.CharField(max_length=500,blank=True)
    posting_count=models.PositiveIntegerField(default=0)
    version=models.PositiveIntegerField(default=1)

    class Meta:
        db_table="ar_debt_adjustment_voucher"
        constraints=[
            models.UniqueConstraint(fields=("company","number"),name="uq_ar_debt_adjustment_voucher_number"),
            models.CheckConstraint(condition=Q(total_amount__gte=0),name="ck_ar_adj_voucher_total_amount"),
            models.CheckConstraint(condition=Q(total_converted_amount__gte=0),name="ck_ar_adj_voucher_total_converted"),
        ]


class DebtAdjustmentVoucherLine(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    voucher=models.ForeignKey(DebtAdjustmentVoucher,on_delete=models.CASCADE,related_name="lines")
    line_no=models.PositiveIntegerField()
    receivable=models.ForeignKey(Receivable,on_delete=models.PROTECT,null=True,blank=True,related_name="adjustment_voucher_lines")
    receivable_schedule=models.ForeignKey(ReceivableSchedule,on_delete=models.SET_NULL,null=True,blank=True,related_name="adjustment_voucher_lines")
    offset_account=models.ForeignKey("general_ledger.Account",on_delete=models.PROTECT,related_name="ar_adjustment_lines_offset_account")
    amount=models.DecimalField(max_digits=20,decimal_places=4)
    exchange_rate=models.DecimalField(max_digits=20,decimal_places=8,default=1)
    converted_amount=models.DecimalField(max_digits=20,decimal_places=4,default=0)
    new_due_date=models.DateField(null=True,blank=True)
    description=models.CharField(max_length=500,blank=True)
    created_receivable=models.ForeignKey(Receivable,on_delete=models.SET_NULL,null=True,blank=True,related_name="adjustment_voucher_origin_lines")
    legacy_adjustment=models.ForeignKey(ReceivableAdjustment,on_delete=models.SET_NULL,null=True,blank=True,related_name="adjustment_voucher_lines")

    class Meta:
        db_table="ar_debt_adjustment_voucher_line"
        ordering=("line_no",)
        constraints=[
            models.CheckConstraint(condition=Q(amount__gt=0,exchange_rate__gt=0),name="ck_ar_adj_line_amount_rate"),
            models.UniqueConstraint(fields=("voucher","line_no"),name="uq_ar_adj_line_no"),
        ]


class DebtAdjustmentApproval(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    voucher=models.ForeignKey(DebtAdjustmentVoucher,on_delete=models.PROTECT,related_name="decisions")
    level=models.PositiveSmallIntegerField(default=1)
    decision=models.CharField(max_length=25)
    actor=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    comment=models.CharField(max_length=1000,blank=True)
    decided_at=models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table="ar_debt_adjustment_approval"
        ordering=("decided_at",)


class CustomerDebtReconciliation(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Nháp"
        PENDING_RESPONSE = "PENDING_RESPONSE", "Chờ phản hồi"
        MATCHED = "MATCHED", "Đã xác nhận khớp"
        DISCREPANCY = "DISCREPANCY", "Có chênh lệch"
        CANCELLED = "CANCELLED", "Đã hủy"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="ar_customer_debt_reconciliations")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, related_name="ar_customer_debt_reconciliations")
    number = models.CharField(max_length=80)
    statement_date = models.DateField()
    from_date = models.DateField()
    to_date = models.DateField()
    customer = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="ar_customer_debt_reconciliations")
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    receivable_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="ar_reconciliations_rec_account")
    contact_person = models.CharField(max_length=255, blank=True)
    contact_email = models.CharField(max_length=255, blank=True)
    note = models.TextField(blank=True)

    # Số liệu đối chiếu (Snapshot tại data_extracted_at)
    opening_balance = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    period_increase = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    period_decrease = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    closing_balance = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    unallocated_receipts = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    data_extracted_at = models.DateTimeField(null=True, blank=True)
    snapshot_data = models.JSONField(default=dict, blank=True)

    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)

    # Ghi nhận đã gửi
    sent_at = models.DateTimeField(null=True, blank=True)
    sent_channel = models.CharField(max_length=100, blank=True)
    sent_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="ar_reconciliations_sent")
    sent_note = models.CharField(max_length=500, blank=True)

    # Phản hồi của khách hàng
    response_date = models.DateField(null=True, blank=True)
    customer_confirmer_name = models.CharField(max_length=255, blank=True)
    customer_confirmed_balance = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    customer_confirmed_unallocated = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    balance_difference = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    unallocated_difference = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    response_comment = models.TextField(blank=True)
    difference_reason = models.TextField(blank=True)
    confirmation_documents = models.JSONField(default=list, blank=True)
    responded_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="ar_reconciliations_responded")
    responded_at = models.DateTimeField(null=True, blank=True)

    # Đối chiếu lại (AF06)
    previous_reconciliation = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="re_reconciliations")

    # Hủy biên bản (AF07)
    cancelled_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="ar_reconciliations_cancelled")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=500, blank=True)

    # Audit & Versioning
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="ar_reconciliations_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "ar_customer_debt_reconciliation"
        ordering = ("-statement_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_ar_customer_debt_reconciliation_number"),
            models.CheckConstraint(condition=Q(from_date__lte=models.F("to_date")), name="ck_ar_reconciliation_date_range"),
        ]


class CustomerDebtReconciliationLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reconciliation = models.ForeignKey(CustomerDebtReconciliation, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    posting_date = models.DateField()
    document_date = models.DateField(null=True, blank=True)
    document_number = models.CharField(max_length=100)
    document_type = models.CharField(max_length=100, blank=True)
    description = models.CharField(max_length=500, blank=True)
    increase_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    decrease_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    receivable = models.ForeignKey(Receivable, on_delete=models.PROTECT, null=True, blank=True, related_name="reconciliation_lines")
    running_balance = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    source_entity_type = models.CharField(max_length=100, blank=True)
    source_entity_id = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "ar_customer_debt_reconciliation_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("reconciliation", "line_no"), name="uq_ar_reconciliation_line_no"),
        ]


class ReminderStatus(models.TextChoices):
    DRAFT = "DRAFT", "Nháp"
    SENT = "SENT", "Đã gửi"
    CANCELLED = "CANCELLED", "Đã hủy"


class ReminderPaymentMethod(models.TextChoices):
    BANK_TRANSFER = "BANK_TRANSFER", "Chuyển khoản"
    CASH = "CASH", "Tiền mặt"


class ReminderSendChannel(models.TextChoices):
    EMAIL = "EMAIL", "Email"
    PAPER = "PAPER", "Bản giấy"
    OTHER = "OTHER", "Kênh khác"


class CustomerPaymentReminder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="ar_customer_payment_reminders")
    branch = models.ForeignKey("organization.Branch", on_delete=models.PROTECT, null=True, blank=True, related_name="ar_customer_payment_reminders")
    notice_number = models.CharField(max_length=80)
    notice_date = models.DateField()
    customer = models.ForeignKey("master_data.Party", on_delete=models.PROTECT, related_name="ar_customer_payment_reminders")
    recipient_name = models.CharField(max_length=255)
    recipient_email = models.CharField(max_length=255, blank=True)
    customer_address = models.CharField(max_length=500, blank=True)
    currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT)
    receivable_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="ar_reminders_rec_account")
    requested_due_date = models.DateField()
    title = models.CharField(max_length=255, default="Thông báo đề nghị thanh toán công nợ")
    content = models.TextField(blank=True)
    payment_method = models.CharField(max_length=20, choices=ReminderPaymentMethod.choices, default=ReminderPaymentMethod.BANK_TRANSFER)
    company_bank_account = models.ForeignKey("master_data.CompanyBankAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="customer_payment_reminders")
    bank_info_snapshot = models.JSONField(default=dict, blank=True)
    cash_location = models.CharField(max_length=500, blank=True)
    transfer_note = models.CharField(max_length=255, blank=True)
    total_requested_amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    signer_employee = models.ForeignKey("organization.Employee", on_delete=models.PROTECT, null=True, blank=True, related_name="signed_payment_reminders")
    signer_user = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="signed_payment_reminders")
    signer_name = models.CharField(max_length=255, blank=True)
    signer_title = models.CharField(max_length=150, blank=True)
    attachments = models.JSONField(default=list, blank=True)
    data_extracted_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=ReminderStatus.choices, default=ReminderStatus.DRAFT)

    # Gửi thông báo
    last_sent_at = models.DateTimeField(null=True, blank=True)
    last_sent_channel = models.CharField(max_length=100, blank=True)
    send_count = models.PositiveIntegerField(default=0)

    # Đề nghị lại (AF07)
    previous_notice = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="re_notices")

    # Hủy thông báo (AF08)
    cancelled_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, null=True, blank=True, related_name="ar_reminders_cancelled")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.CharField(max_length=500, blank=True)

    # Audit & Versioning
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="ar_reminders_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "ar_customer_payment_reminder"
        ordering = ("-notice_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "notice_number"), name="uq_ar_customer_payment_reminder_number"),
            models.CheckConstraint(condition=Q(requested_due_date__gte=models.F("notice_date")), name="ck_ar_reminder_due_date"),
        ]


class CustomerPaymentReminderLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    notice = models.ForeignKey(CustomerPaymentReminder, on_delete=models.CASCADE, related_name="lines")
    line_no = models.PositiveIntegerField()
    receivable = models.ForeignKey(Receivable, on_delete=models.PROTECT, related_name="reminder_lines")
    receivable_schedule = models.ForeignKey(ReceivableSchedule, on_delete=models.PROTECT, null=True, blank=True, related_name="reminder_lines")
    installment_no = models.PositiveIntegerField(default=1)
    source_document_number = models.CharField(max_length=100, blank=True)
    source_document_date = models.DateField(null=True, blank=True)
    invoice_series = models.CharField(max_length=50, blank=True)
    invoice_number = models.CharField(max_length=80, blank=True)
    invoice_date = models.DateField(null=True, blank=True)
    original_due_date = models.DateField(null=True, blank=True)
    remaining_balance = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    requested_amount = models.DecimalField(max_digits=20, decimal_places=4)
    days_overdue = models.IntegerField(null=True, blank=True)
    line_note = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "ar_customer_payment_reminder_line"
        ordering = ("line_no",)
        constraints = [
            models.UniqueConstraint(fields=("notice", "line_no"), name="uq_ar_reminder_line_no"),
            models.UniqueConstraint(fields=("notice", "receivable"), condition=Q(receivable_schedule__isnull=True), name="uq_ar_reminder_rec_no_schedule"),
            models.UniqueConstraint(fields=("notice", "receivable", "receivable_schedule"), condition=Q(receivable_schedule__isnull=False), name="uq_ar_reminder_rec_with_schedule"),
            models.CheckConstraint(condition=Q(requested_amount__gt=0), name="ck_ar_reminder_line_requested_positive"),
        ]


class CustomerPaymentReminderSendLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    notice = models.ForeignKey(CustomerPaymentReminder, on_delete=models.CASCADE, related_name="send_logs")
    sent_date = models.DateField()
    sent_channel = models.CharField(max_length=20, choices=ReminderSendChannel.choices)
    channel_other_name = models.CharField(max_length=100, blank=True)
    actual_recipient = models.CharField(max_length=255)
    proof_documents = models.JSONField(default=list, blank=True)
    note = models.TextField(blank=True)
    sent_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="ar_reminder_send_logs")
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ar_customer_payment_reminder_send_log"
        ordering = ("-sent_date", "-sent_at")




