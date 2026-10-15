from decimal import Decimal
from django.db import transaction
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_serializer
from master_data.payment_methods import method_snapshot, validate_method_selection
from . import models
class ProfileSerializer(serializers.ModelSerializer):
    account_number=serializers.CharField(source="account.account_number",read_only=True)
    account_name=serializers.CharField(source="account.account_name",read_only=True)
    bank_name=serializers.CharField(source="account.bank.name",read_only=True)
    currency_code=serializers.CharField(source="account.currency.code",read_only=True)
    currency_id=serializers.UUIDField(source="account.currency_id",read_only=True)
    gl_code=serializers.CharField(source="account.gl_account.code",read_only=True)
    class Meta:model=models.AccountProfile;fields="__all__";read_only_fields=("id","balance","created_at","updated_at")
    def validate(self,a):
        account=a.get("account") or self.instance.account;company=a.get("company") or self.instance.company
        if account.company_id!=company.id or not account.gl_account_id:raise serializers.ValidationError({"account":"Tài khoản ngân hàng phải thuộc doanh nghiệp và có tài khoản GL."})
        if self.instance and self.instance.transactions.exists() and account.id!=self.instance.account_id:raise serializers.ValidationError("Hồ sơ đã phát sinh giao dịch không được đổi tài khoản.")
        return a
@extend_schema_serializer(component_name="BankTransaction")
class TransactionSerializer(serializers.ModelSerializer):
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
        return a
    def create(self,d):d["base_amount"]=d["amount"]*d.get("exchange_rate",Decimal("1"));return super().create(d)
    def update(self,i,d):o=super().update(i,d);o.base_amount=o.amount*o.exchange_rate;o.save(update_fields=("base_amount",));return o
@extend_schema_serializer(component_name="BankTransfer")
class TransferSerializer(serializers.ModelSerializer):
    class Meta:model=models.BankTransfer;fields="__all__";read_only_fields=("id","status","created_by","confirmed_by","created_at")
    def validate(self,a):
        company=a.get("company") or self.instance.company;s=a.get("source_account") or self.instance.source_account;d=a.get("destination_account") or self.instance.destination_account
        if s.id==d.id or s.company_id!=company.id or d.company_id!=company.id:raise serializers.ValidationError("Tài khoản nguồn/đích không hợp lệ.")
        if self.instance and self.instance.status!="DRAFT":raise serializers.ValidationError("Điều chuyển đã xử lý không được sửa.")
        return a
class StatementLineSerializer(serializers.ModelSerializer):
    class Meta:model=models.StatementLine;fields="__all__";read_only_fields=("id","statement","match_status")
class StatementSerializer(serializers.ModelSerializer):
    lines=StatementLineSerializer(many=True)
    class Meta:model=models.StatementImport;fields="__all__";read_only_fields=("id","created_by","created_at")
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
    class Meta:model=models.Reconciliation;fields="__all__";read_only_fields=("id","variance","status","created_by","created_at")
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
