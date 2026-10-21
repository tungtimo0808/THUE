from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_serializer
from master_data.payment_methods import method_snapshot, validate_method_selection
from .payment_validation import validate_payment
from .transfer_validation import validate_transfer
from . import models
class ProfileSerializer(serializers.ModelSerializer):
    account_number=serializers.CharField(source="account.account_number",read_only=True)
    account_name=serializers.CharField(source="account.account_name",read_only=True)
    bank_name=serializers.CharField(source="account.bank.name",read_only=True)
    currency_code=serializers.CharField(source="account.currency.code",read_only=True)
    currency_id=serializers.UUIDField(source="account.currency_id",read_only=True)
    gl_code=serializers.CharField(source="account.gl_account.code",read_only=True)
    gl_account_id=serializers.UUIDField(source="account.gl_account_id",read_only=True)
    branch_id=serializers.UUIDField(source="account.branch_id",read_only=True)
    branch_name=serializers.CharField(source="account.branch.name",read_only=True)
    bank_branch=serializers.CharField(source="account.bank_branch",read_only=True)
    class Meta:model=models.AccountProfile;fields="__all__";read_only_fields=("id","balance","created_at","updated_at")
    def validate(self,a):
        account=a.get("account") or self.instance.account;company=a.get("company") or self.instance.company
        if account.company_id!=company.id or not account.gl_account_id:raise serializers.ValidationError({"account":"Tài khoản ngân hàng phải thuộc doanh nghiệp và có tài khoản GL."})
        if self.instance and self.instance.transactions.exists() and account.id!=self.instance.account_id:raise serializers.ValidationError("Hồ sơ đã phát sinh giao dịch không được đổi tài khoản.")
        return a
@extend_schema_serializer(component_name="BankTransaction")
class TransactionSerializer(serializers.ModelSerializer):
    source_account_number=serializers.CharField(source="account.account.account_number",read_only=True)
    source_bank_name=serializers.CharField(source="account.account.bank.name",read_only=True)
    currency_code=serializers.CharField(source="currency.code",read_only=True)
    class Meta:model=models.BankTransaction;fields="__all__";read_only_fields=("id","status","workflow_snapshot","base_amount","balance_applied","integration_status","gl_status","gl_reference","source_reference","payment_method_snapshot","created_by","submitted_at","approved_at","posted_at","created_at","updated_at")
    def validate(self,a):
        if self.instance and self.instance.status not in {"DRAFT","REJECTED"}:raise serializers.ValidationError("Giao dịch đã xử lý không được sửa.")
        company=a.get("company") or self.instance.company;account=a.get("account") or self.instance.account;currency=a.get("currency") or self.instance.currency;party=a.get("party") or getattr(self.instance,"party",None)
        method=a.get("payment_method_config") if "payment_method_config" in a else getattr(self.instance,"payment_method_config",None)
        if method and (not self.instance or getattr(self.instance,"payment_method_config_id",None) != method.pk): a["payment_method_snapshot"]=method_snapshot(method)
        elif "payment_method_config" in a and method is None: a["payment_method_snapshot"]={}
        if method:
            if method.group!="BANK":raise serializers.ValidationError({"payment_method_config":"A bank transaction requires a bank method."})
            scope="RECEIPT" if (a.get("transaction_type") or getattr(self.instance,"transaction_type",None)) in {"RECEIPT","OTHER_IN","INTEREST"} else "PAYMENT"
            validate_method_selection(method,company=company,scope=scope,on_date=a.get("transaction_date") or self.instance.transaction_date,
                                      reference=a.get("bank_reference",getattr(self.instance,"bank_reference","")),bank_account=account.account,
                                      previous=getattr(self.instance,"payment_method_config",None))
        if account.company_id!=company.id or account.account.status!="ACTIVE":raise serializers.ValidationError({"account":"Tài khoản không hợp lệ hoặc ngừng hoạt động."})
        if currency.id!=account.account.currency_id:raise serializers.ValidationError({"currency":"Loại tiền không khớp tài khoản."})
        if party and party.company_id!=company.id:raise serializers.ValidationError({"party":"Đối tượng phải cùng doanh nghiệp."})
        return validate_payment(a,self.instance)
    def create(self,d):d["base_amount"]=d["amount"]*d.get("exchange_rate",Decimal("1"));return super().create(d)
    def update(self,i,d):o=super().update(i,d);o.base_amount=o.amount*o.exchange_rate;o.save(update_fields=("base_amount",));return o
@extend_schema_serializer(component_name="BankTransfer")
class TransferSerializer(serializers.ModelSerializer):
    source_account_number=serializers.CharField(source="source_account.account.account_number",read_only=True)
    destination_account_number=serializers.CharField(source="destination_account.account.account_number",read_only=True)
    currency_code=serializers.CharField(source="source_account.account.currency.code",read_only=True)
    source_gl_code=serializers.CharField(source="source_account.account.gl_account.code",read_only=True)
    destination_gl_code=serializers.CharField(source="destination_account.account.gl_account.code",read_only=True)
    class Meta:model=models.BankTransfer;fields="__all__";read_only_fields=("id","status","created_by","confirmed_by","posted_at","gl_reference","created_at","updated_at","cancelled_at","reversed_at")
    def validate(self,a):
        company=a.get("company") or self.instance.company;s=a.get("source_account") or self.instance.source_account;d=a.get("destination_account") or self.instance.destination_account
        if s.id==d.id:raise serializers.ValidationError({"destination_account":"Tài khoản đi và tài khoản đến phải khác nhau."})
        if s.company_id!=company.id or d.company_id!=company.id:raise serializers.ValidationError("Tài khoản nguồn/đích không thuộc doanh nghiệp.")
        if self.instance and self.instance.status!="DRAFT":raise serializers.ValidationError("Điều chuyển đã xử lý không được sửa.")
        if self.instance and a.get("version") != self.instance.version:
            raise serializers.ValidationError({"version":"Chứng từ đã thay đổi. Vui lòng tải lại trước khi lưu."})
        return validate_transfer(a,self.instance)
    def update(self,instance,validated_data):
        validated_data.pop("version",None)
        instance=super().update(instance,validated_data)
        instance.version+=1
        instance.save(update_fields=("version","updated_at"))
        return instance
class StatementLineSerializer(serializers.ModelSerializer):
    class Meta:model=models.StatementLine;fields="__all__";read_only_fields=("id","statement","match_status","processing_note","tracking_status","review_reason","updated_by","updated_at","deleted_at","deleted_by")
class StatementLineManagementSerializer(serializers.ModelSerializer):
    source=serializers.CharField(source="statement.source",read_only=True)
    source_reference=serializers.CharField(source="statement.source_reference",read_only=True)
    account=serializers.UUIDField(source="statement.account_id",read_only=True)
    account_number=serializers.CharField(source="statement.account.account.account_number",read_only=True)
    branch=serializers.UUIDField(source="statement.account.account.branch_id",read_only=True)
    currency_code=serializers.CharField(source="currency.code",read_only=True)
    period_from=serializers.DateField(source="statement.period_from",read_only=True)
    period_to=serializers.DateField(source="statement.period_to",read_only=True)
    period_confirmed=serializers.SerializerMethodField()
    file_name=serializers.SerializerMethodField()
    matched_amount=serializers.SerializerMethodField()
    remaining_amount=serializers.SerializerMethodField()
    linked_vouchers=serializers.SerializerMethodField()
    class Meta:
        model=models.StatementLine
        fields=("id","statement","external_id","transaction_date","value_date","direction","amount","currency","currency_code","reference","description","counterparty","raw_data","match_status","processing_note","tracking_status","review_reason","updated_by","updated_at","source","source_reference","account","account_number","branch","period_from","period_to","period_confirmed","file_name","matched_amount","remaining_amount","linked_vouchers")
        read_only_fields=fields
    def get_file_name(self,obj):return obj.statement.raw_file.get("file_name","")
    def get_period_confirmed(self,obj):
        from .reconciliation import period_confirmed
        return period_confirmed(obj)
    def _links(self,obj):
        return getattr(obj,"active_reconciliations",None) if hasattr(obj,"active_reconciliations") else obj.reconciliations.filter(cancelled_at__isnull=True).select_related("transaction")
    def get_matched_amount(self,obj):
        return str(sum((match.matched_amount for match in self._links(obj)),start=0))
    def get_remaining_amount(self,obj):
        return str(obj.amount-sum((match.matched_amount for match in self._links(obj)),start=0))
    def get_linked_vouchers(self,obj):
        return [{"link_id":str(match.pk),"id":str(match.transaction_id),"number":match.transaction.number,
            "amount":str(match.matched_amount),"gl_status":match.transaction.gl_status,
            "voucher_amount":str(match.transaction.amount),
            "voucher_remaining_amount":str(match.transaction.amount-(models.Reconciliation.objects.filter(transaction_id=match.transaction_id,cancelled_at__isnull=True).aggregate(total=Sum("matched_amount"))["total"] or 0)),
            "transaction_date":match.transaction.payment_details.get("posting_date") or str(match.transaction.transaction_date),
            "transaction_type":match.transaction.transaction_type,
            "counterparty_name":match.transaction.counterparty_name,"description":match.transaction.description,
            "status":match.transaction.status} for match in self._links(obj)]
class StatementSerializer(serializers.ModelSerializer):
    lines=StatementLineSerializer(many=True)
    source_file=serializers.SerializerMethodField()
    class Meta:model=models.StatementImport;fields="__all__";read_only_fields=("id","created_by","created_at","source_file","reconciliation_confirmed_at")
    def get_source_file(self,obj):
        return obj.source_file.name.rsplit("/",1)[-1] if obj.source_file else None
    def validate(self,a):
        company=a.get("company");account=a.get("account")
        if account.company_id!=company.id:raise serializers.ValidationError({"account":"Tài khoản phải cùng doanh nghiệp."})
        if a["period_to"]<a["period_from"]:raise serializers.ValidationError({"period_to":"Kỳ sao kê không hợp lệ."})
        for line in a.get("lines",[]):
            if line["currency"].id!=account.account.currency_id:raise serializers.ValidationError({"lines":"Loại tiền dòng sao kê không khớp tài khoản."})
        return a
    @transaction.atomic
    def create(self,d):
        lines=d.pop("lines");obj=models.StatementImport.objects.create(**d)
        for line in lines:models.StatementLine.objects.create(statement=obj,**line)
        return obj
class ReconciliationSerializer(serializers.ModelSerializer):
    class Meta:model=models.Reconciliation;fields="__all__";read_only_fields=("id","variance","status","created_by","created_at","cancelled_at","cancelled_by")
class IntegrationSerializer(serializers.ModelSerializer):
    class Meta:model=models.IntegrationRequest;fields="__all__";read_only_fields=("id","response_payload","status","error_message","created_by","created_at","updated_at")
class FxSerializer(serializers.ModelSerializer):
    class Meta:model=models.FxRevaluation;fields="__all__";read_only_fields=("id","foreign_balance","difference","created_by","created_at")
    def validate(self,a):
        company=a.get("company") or self.instance.company;account=a.get("account") or self.instance.account
        if account.company_id!=company.id:raise serializers.ValidationError("Tài khoản phải cùng doanh nghiệp.")
        if account.account.currency_id==company.accounting_currency_id:raise serializers.ValidationError("Không đánh giá lại đồng tiền kế toán.")
        return a
    def create(self,d):account=d["account"];d["foreign_balance"]=account.balance;d["difference"]=account.balance*(d["new_rate"]-d["old_rate"]);return super().create(d)
@extend_schema_serializer(component_name="BankApproval")
class ApprovalSerializer(serializers.ModelSerializer):
    class Meta:model=models.ApprovalDecision;fields="__all__";read_only_fields=("id","decided_at")
