import uuid
from django.db import models
from django.db.models import Q
from .storage import PrivateStatementStorage
class TransactionStatus(models.TextChoices):
    DRAFT="DRAFT","Bản nháp";PENDING_APPROVAL="PENDING_APPROVAL","Chờ duyệt";APPROVED="APPROVED","Đã duyệt";REJECTED="REJECTED","Từ chối";POSTED="POSTED","Có hiệu lực";REVERSED="REVERSED","Đã đảo";CANCELLED="CANCELLED","Đã hủy"
class MatchStatus(models.TextChoices):UNMATCHED="UNMATCHED","Chưa khớp";MATCHED="MATCHED","Đã khớp";PARTIALLY_MATCHED="PARTIALLY_MATCHED","Khớp một phần";VARIANCE="VARIANCE","Chênh lệch"
class AccountProfile(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);account=models.OneToOneField("master_data.CompanyBankAccount",on_delete=models.PROTECT,related_name="bank_profile");company=models.ForeignKey("organization.Company",on_delete=models.PROTECT,related_name="bank_profiles");balance=models.DecimalField(max_digits=20,decimal_places=4,default=0);allow_overdraft=models.BooleanField(default=False);overdraft_limit=models.DecimalField(max_digits=20,decimal_places=4,default=0);swift_code=models.CharField(max_length=30,blank=True);integration_enabled=models.BooleanField(default=False);connector_code=models.CharField(max_length=80,blank=True);integration_config=models.JSONField(default=dict,blank=True);created_at=models.DateTimeField(auto_now_add=True);updated_at=models.DateTimeField(auto_now=True)
    class Meta:db_table="bank_account_profile";constraints=[models.CheckConstraint(condition=Q(overdraft_limit__gte=0),name="ck_bank_overdraft_limit")]
class BankTransaction(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);company=models.ForeignKey("organization.Company",on_delete=models.PROTECT);account=models.ForeignKey(AccountProfile,on_delete=models.PROTECT,related_name="transactions");number=models.CharField(max_length=80);transaction_type=models.CharField(max_length=20,choices=(("RECEIPT","Thu"),("PAYMENT","Chi"),("FEE","Phí ngân hàng"),("INTEREST","Lãi tiền gửi"),("OTHER_IN","Thu khác"),("OTHER_OUT","Chi khác")));business_type=models.CharField(max_length=50);transaction_date=models.DateField();value_date=models.DateField(null=True,blank=True);party=models.ForeignKey("master_data.Party",on_delete=models.PROTECT,null=True,blank=True);counterparty_name=models.CharField(max_length=255);counterparty_account=models.CharField(max_length=100,blank=True);currency=models.ForeignKey("master_data.Currency",on_delete=models.PROTECT);amount=models.DecimalField(max_digits=20,decimal_places=4);exchange_rate=models.DecimalField(max_digits=20,decimal_places=8,default=1);base_amount=models.DecimalField(max_digits=20,decimal_places=4);description=models.CharField(max_length=500);bank_reference=models.CharField(max_length=120,blank=True);status=models.CharField(max_length=30,choices=TransactionStatus.choices,default=TransactionStatus.DRAFT);approval_required=models.BooleanField(default=True);workflow_snapshot=models.JSONField(default=dict,blank=True);balance_applied=models.BooleanField(default=False);integration_status=models.CharField(max_length=20,choices=(("NOT_SENT","Chưa gửi"),("PENDING","Đang xử lý"),("SUCCESS","Thành công"),("FAILED","Thất bại")),default="NOT_SENT");gl_status=models.CharField(max_length=20,choices=(("PENDING","Chờ hạch toán"),("POSTED","Đã hạch toán"),("ERROR","Lỗi")),default="PENDING");gl_reference=models.CharField(max_length=120,blank=True);source_module=models.CharField(max_length=20,blank=True);source_reference=models.CharField(max_length=120,blank=True);created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="bank_transactions_created");submitted_at=models.DateTimeField(null=True,blank=True);approved_at=models.DateTimeField(null=True,blank=True);posted_at=models.DateTimeField(null=True,blank=True);created_at=models.DateTimeField(auto_now_add=True);updated_at=models.DateTimeField(auto_now=True)
    class Meta:db_table="bank_transaction";ordering=("-transaction_date","-created_at");constraints=[models.UniqueConstraint(fields=("company","number"),name="uq_bank_transaction_number"),models.CheckConstraint(condition=Q(amount__gt=0,exchange_rate__gt=0,base_amount__gt=0),name="ck_bank_transaction_amounts")]
    payment_method_config=models.ForeignKey("master_data.PaymentMethod",on_delete=models.PROTECT,null=True,blank=True,related_name="bank_transactions")
    payment_method_snapshot=models.JSONField(default=dict,blank=True)
    payment_details=models.JSONField(default=dict,blank=True)
class ApprovalDecision(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);company=models.ForeignKey("organization.Company",on_delete=models.PROTECT,related_name="bank_approvals");transaction=models.ForeignKey(BankTransaction,on_delete=models.PROTECT,related_name="approval_decisions");level=models.PositiveSmallIntegerField(default=1);decision=models.CharField(max_length=20);actor=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="bank_approvals");comment=models.CharField(max_length=1000,blank=True);decided_at=models.DateTimeField(auto_now_add=True)
    class Meta:db_table="bank_approval";ordering=("decided_at",)
class BankTransfer(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);company=models.ForeignKey("organization.Company",on_delete=models.PROTECT);number=models.CharField(max_length=80);source_account=models.ForeignKey(AccountProfile,on_delete=models.PROTECT,related_name="outgoing_transfers");destination_account=models.ForeignKey(AccountProfile,on_delete=models.PROTECT,related_name="incoming_transfers");transfer_date=models.DateField();source_amount=models.DecimalField(max_digits=20,decimal_places=4);destination_amount=models.DecimalField(max_digits=20,decimal_places=4);exchange_rate=models.DecimalField(max_digits=20,decimal_places=8,default=1);description=models.CharField(max_length=500);status=models.CharField(max_length=20,choices=(("DRAFT","Bản nháp"),("CONFIRMED","Đã xác nhận"),("REVERSED","Đã đảo"),("CANCELLED","Đã hủy")),default="DRAFT");created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT);confirmed_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="bank_transfers_confirmed");created_at=models.DateTimeField(auto_now_add=True)
    class Meta:db_table="bank_transfer";constraints=[models.UniqueConstraint(fields=("company","number"),name="uq_bank_transfer_number"),models.CheckConstraint(condition=Q(source_amount__gt=0,destination_amount__gt=0,exchange_rate__gt=0),name="ck_bank_transfer_amounts")]
    posting_date=models.DateField(null=True,blank=True)
    details=models.JSONField(default=dict,blank=True)
    posted_at=models.DateTimeField(null=True,blank=True)
    gl_reference=models.CharField(max_length=120,blank=True)
    version=models.PositiveIntegerField(default=1)
    updated_at=models.DateTimeField(auto_now=True)
    cancelled_at=models.DateTimeField(null=True,blank=True)
    reversed_at=models.DateTimeField(null=True,blank=True)
class StatementImport(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);company=models.ForeignKey("organization.Company",on_delete=models.PROTECT);account=models.ForeignKey(AccountProfile,on_delete=models.PROTECT,related_name="statement_imports");source=models.CharField(max_length=20,choices=(("FILE","Tệp"),("CONNECTOR","Kết nối"),("MANUAL","Thủ công")));source_reference=models.CharField(max_length=150);period_from=models.DateField();period_to=models.DateField();raw_file=models.JSONField(default=dict,blank=True);created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT);created_at=models.DateTimeField(auto_now_add=True)
    source_file=models.FileField(upload_to="bank_statements/%Y/%m/",storage=PrivateStatementStorage(),null=True,blank=True)
    reconciliation_confirmed_at=models.DateTimeField(null=True,blank=True)
    class Meta:db_table="bank_statement_import";constraints=[models.UniqueConstraint(fields=("account","source","source_reference"),name="uq_bank_statement_import")]
class StatementLine(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);statement=models.ForeignKey(StatementImport,on_delete=models.CASCADE,related_name="lines");external_id=models.CharField(max_length=150);transaction_date=models.DateField();value_date=models.DateField(null=True,blank=True);direction=models.CharField(max_length=10,choices=(("CREDIT","Tiền vào"),("DEBIT","Tiền ra")));amount=models.DecimalField(max_digits=20,decimal_places=4);currency=models.ForeignKey("master_data.Currency",on_delete=models.PROTECT);reference=models.CharField(max_length=150,blank=True);description=models.CharField(max_length=1000,blank=True);counterparty=models.CharField(max_length=255,blank=True);raw_data=models.JSONField(default=dict,blank=True);match_status=models.CharField(max_length=30,choices=MatchStatus.choices,default=MatchStatus.UNMATCHED)
    processing_note=models.TextField(blank=True)
    tracking_status=models.CharField(max_length=20,choices=(("NORMAL","Bình thường"),("NEEDS_REVIEW","Cần kiểm tra"),("WAITING","Chờ xử lý")),default="NORMAL")
    review_reason=models.TextField(blank=True)
    updated_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="bank_statement_lines_updated")
    updated_at=models.DateTimeField(null=True,blank=True)
    deleted_at=models.DateTimeField(null=True,blank=True)
    deleted_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="bank_statement_lines_deleted")
    class Meta:db_table="bank_statement_line";constraints=[models.UniqueConstraint(fields=("statement","external_id"),name="uq_bank_statement_line"),models.CheckConstraint(condition=Q(amount__gt=0),name="ck_bank_statement_amount")]
class Reconciliation(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);company=models.ForeignKey("organization.Company",on_delete=models.PROTECT);statement_line=models.ForeignKey(StatementLine,on_delete=models.PROTECT,related_name="reconciliations");transaction=models.ForeignKey(BankTransaction,on_delete=models.PROTECT,related_name="reconciliations");matched_amount=models.DecimalField(max_digits=20,decimal_places=4);variance=models.DecimalField(max_digits=20,decimal_places=4,default=0);status=models.CharField(max_length=20,choices=(("MATCHED","Đã khớp"),("PARTIALLY_MATCHED","Khớp một phần"),("VARIANCE","Chênh lệch"),("CANCELLED","Đã hủy ghép")));note=models.CharField(max_length=500,blank=True);created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT);created_at=models.DateTimeField(auto_now_add=True)
    cancelled_at=models.DateTimeField(null=True,blank=True)
    cancelled_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,null=True,blank=True,related_name="bank_reconciliations_cancelled")
    class Meta:db_table="bank_reconciliation";constraints=[models.CheckConstraint(condition=Q(matched_amount__gt=0),name="ck_bank_reconcile_amount"),models.UniqueConstraint(fields=("statement_line","transaction"),condition=Q(cancelled_at__isnull=True),name="uq_bank_active_reconcile_pair")]
class BankReconciliationPeriod(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    account=models.ForeignKey(AccountProfile,on_delete=models.PROTECT,related_name="reconciliation_periods")
    period_from=models.DateField()
    period_to=models.DateField()
    opening_balance=models.DecimalField(max_digits=20,decimal_places=4)
    receipt_total=models.DecimalField(max_digits=20,decimal_places=4)
    payment_total=models.DecimalField(max_digits=20,decimal_places=4)
    closing_balance=models.DecimalField(max_digits=20,decimal_places=4)
    bank_closing_balance=models.DecimalField(max_digits=20,decimal_places=4)
    confirmed_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    confirmed_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table="bank_reconciliation_period"
        ordering=("-period_to","-confirmed_at")
        constraints=[models.UniqueConstraint(fields=("account","period_from","period_to"),name="uq_bank_reconciliation_period")]
class BankReconciliationItem(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    period=models.ForeignKey(BankReconciliationPeriod,on_delete=models.PROTECT,related_name="items")
    transaction=models.OneToOneField(BankTransaction,on_delete=models.PROTECT,related_name="confirmed_reconciliation")
    amount=models.DecimalField(max_digits=20,decimal_places=4)
    direction=models.CharField(max_length=10)
    class Meta:db_table="bank_reconciliation_item"
class BankVoucherReview(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    transaction=models.OneToOneField(BankTransaction,on_delete=models.PROTECT,related_name="unmatched_review")
    status=models.CharField(max_length=20,choices=(("WAITING","Chờ xử lý"),))
    reason=models.CharField(max_length=500)
    note=models.TextField(blank=True)
    updated_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    updated_at=models.DateTimeField(auto_now=True)
    class Meta:db_table="bank_voucher_review"
class BankBalanceReportPreset(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    name=models.CharField(max_length=150)
    account_code=models.CharField(max_length=50)
    date_from=models.DateField()
    date_to=models.DateField()
    period_preset=models.CharField(max_length=50,blank=True)
    search=models.CharField(max_length=150,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:db_table="bank_balance_report_preset";ordering=("-created_at",)
class BankDepositLedgerPreset(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    company=models.ForeignKey("organization.Company",on_delete=models.PROTECT)
    created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT)
    name=models.CharField(max_length=150)
    parameters=models.JSONField(default=dict)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:db_table="bank_deposit_ledger_preset";ordering=("-created_at",)

class IntegrationRequest(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);company=models.ForeignKey("organization.Company",on_delete=models.PROTECT);account=models.ForeignKey(AccountProfile,on_delete=models.PROTECT);transaction=models.ForeignKey(BankTransaction,on_delete=models.PROTECT,null=True,blank=True,related_name="integration_requests");request_type=models.CharField(max_length=30);idempotency_key=models.CharField(max_length=120,unique=True);request_payload=models.JSONField(default=dict);response_payload=models.JSONField(default=dict);status=models.CharField(max_length=20,choices=(("PENDING","Đang xử lý"),("SUCCESS","Thành công"),("FAILED","Thất bại")),default="PENDING");error_message=models.CharField(max_length=1000,blank=True);created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT);created_at=models.DateTimeField(auto_now_add=True);updated_at=models.DateTimeField(auto_now=True)
    class Meta:db_table="bank_integration_request"
class FxRevaluation(models.Model):
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False);company=models.ForeignKey("organization.Company",on_delete=models.PROTECT,related_name="bank_fx_revaluations");account=models.ForeignKey(AccountProfile,on_delete=models.PROTECT,related_name="revaluations");revaluation_date=models.DateField();old_rate=models.DecimalField(max_digits=20,decimal_places=8);new_rate=models.DecimalField(max_digits=20,decimal_places=8);foreign_balance=models.DecimalField(max_digits=20,decimal_places=4);difference=models.DecimalField(max_digits=20,decimal_places=4);gl_reference=models.CharField(max_length=120,blank=True);created_by=models.ForeignKey("iam.UserAccount",on_delete=models.PROTECT,related_name="bank_fx_revaluations");created_at=models.DateTimeField(auto_now_add=True)
    class Meta:db_table="bank_fx_revaluation";constraints=[models.UniqueConstraint(fields=("account","revaluation_date"),name="uq_bank_fx_revaluation"),models.CheckConstraint(condition=Q(old_rate__gt=0,new_rate__gt=0),name="ck_bank_fx_rates")]


class CreditContract(models.Model):
    """Hợp đồng tín dụng: a credit line granted to us (BORROWING) or by us (LENDING)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="bank_credit_contracts")
    direction = models.CharField(max_length=10, choices=(("BORROWING", "Đi vay"), ("LENDING", "Cho vay")))
    contract_type = models.CharField(max_length=20, choices=(("LIMIT", "Hạn mức"), ("PRINCIPLE", "Nguyên tắc")), default="LIMIT")
    number = models.CharField(max_length=80)
    sign_date = models.DateField()
    partner_name = models.CharField(max_length=255)
    credit_limit = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    purpose = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=(("PENDING", "Chưa thực hiện"), ("ACTIVE", "Đang thực hiện"), ("CLOSED", "Đã tất toán")), default="PENDING")
    collaterals = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="bank_credit_contracts")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "bank_credit_contract"
        ordering = ("-sign_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_bank_credit_contract_number"),
            models.CheckConstraint(condition=Q(credit_limit__gte=0), name="ck_bank_credit_limit_nonnegative"),
        ]


class LoanAgreement(models.Model):
    """Khế ước cho vay / đi vay; disbursement and repayment happen through bank or cash vouchers."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="bank_loan_agreements")
    direction = models.CharField(max_length=10, choices=(("BORROWING", "Đi vay"), ("LENDING", "Cho vay")))
    number = models.CharField(max_length=80)
    counterparty_name = models.CharField(max_length=255)
    credit_contract = models.ForeignKey(CreditContract, on_delete=models.PROTECT, null=True, blank=True, related_name="loans")
    purpose = models.CharField(max_length=500, blank=True)
    principal_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="bank_loans_principal")
    interest_account = models.ForeignKey("general_ledger.Account", on_delete=models.PROTECT, related_name="bank_loans_interest")
    amount = models.DecimalField(max_digits=20, decimal_places=4)
    term = models.PositiveIntegerField()
    term_unit = models.CharField(max_length=10, choices=(("DAY", "Ngày"), ("MONTH", "Tháng"), ("YEAR", "Năm")), default="MONTH")
    disbursement_date = models.DateField()
    due_date = models.DateField()
    interest_rates = models.JSONField(default=list, blank=True)
    principal_period = models.CharField(max_length=50, blank=True)
    interest_period = models.CharField(max_length=50, blank=True)
    settlement_account = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=(("ACTIVE", "Đang hiệu lực"), ("CLOSED", "Đã tất toán")), default="ACTIVE")
    created_by = models.ForeignKey("iam.UserAccount", on_delete=models.PROTECT, related_name="bank_loan_agreements")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "bank_loan_agreement"
        ordering = ("-disbursement_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("company", "number"), name="uq_bank_loan_number"),
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_bank_loan_amount_positive"),
            models.CheckConstraint(condition=Q(due_date__gte=models.F("disbursement_date")), name="ck_bank_loan_dates"),
        ]
