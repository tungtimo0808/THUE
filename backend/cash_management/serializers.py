from decimal import Decimal
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field,extend_schema_serializer
from master_data.payment_methods import method_snapshot, validate_method_selection
from . import models

class FundSerializer(serializers.ModelSerializer):
    class Meta:model=models.CashFund;fields="__all__";read_only_fields=("id","balance","created_at","updated_at")
    def validate(self,attrs):
        company=attrs.get("company") or self.instance.company;branch=attrs.get("branch") or self.instance.branch;keeper=attrs.get("keeper") or getattr(self.instance,"keeper",None);account=attrs.get("gl_account") or self.instance.gl_account
        if branch.company_id!=company.id or account.company_id!=company.id or (keeper and keeper.company_id!=company.id):raise serializers.ValidationError("Chi nhánh, thủ quỹ và tài khoản GL phải thuộc cùng doanh nghiệp.")
        if self.instance and self.instance.transactions.exists() and attrs.get("currency",self.instance.currency)!=self.instance.currency:raise serializers.ValidationError("Quỹ đã phát sinh giao dịch không được đổi loại tiền.")
        return attrs

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:model=models.CashTransaction;fields="__all__";read_only_fields=("id","status","workflow_snapshot","balance_applied","base_amount","gl_status","gl_reference","payment_method_snapshot","created_by","cashier","submitted_at","approved_at","posted_at","created_at","updated_at")
    def validate(self,attrs):
        if self.instance and self.instance.status not in {models.TransactionStatus.DRAFT,models.TransactionStatus.REJECTED}:raise serializers.ValidationError("Chỉ giao dịch DRAFT hoặc REJECTED được sửa.")
        company=attrs.get("company") or self.instance.company;fund=attrs.get("fund") or self.instance.fund;currency=attrs.get("currency") or self.instance.currency;party=attrs.get("party") or getattr(self.instance,"party",None)
        method=attrs.get("payment_method_config") if "payment_method_config" in attrs else getattr(self.instance,"payment_method_config",None)
        if method and (not self.instance or getattr(self.instance,"payment_method_config_id",None) != method.pk): attrs["payment_method_snapshot"]=method_snapshot(method)
        elif "payment_method_config" in attrs and method is None: attrs["payment_method_snapshot"]={}
        if method:
            if method.group!="CASH": raise serializers.ValidationError({"payment_method_config":"A cash transaction requires a cash method."})
            scope="RECEIPT" if (attrs.get("transaction_type") or getattr(self.instance,"transaction_type",None)) in {"RECEIPT","ADVANCE_RETURN","ADJUSTMENT_IN"} else "PAYMENT"
            validate_method_selection(method,company=company,scope=scope,on_date=attrs.get("transaction_date") or self.instance.transaction_date,
                                      reference=attrs.get("source_reference",getattr(self.instance,"source_reference","")),cash_fund=fund,
                                      previous=getattr(self.instance,"payment_method_config",None))
        if fund.company_id!=company.id or fund.status!="ACTIVE":raise serializers.ValidationError({"fund":"Quỹ không hợp lệ hoặc đã ngừng hoạt động."})
        if currency.id!=fund.currency_id:raise serializers.ValidationError({"currency":"Loại tiền giao dịch phải khớp loại tiền của quỹ."})
        if party and party.company_id!=company.id:raise serializers.ValidationError({"party":"Đối tượng phải thuộc cùng doanh nghiệp."})
        return attrs
    def create(self,validated_data):validated_data["base_amount"]=validated_data["amount"]*validated_data.get("exchange_rate",Decimal("1"));return super().create(validated_data)
    def update(self,instance,validated_data):
        obj=super().update(instance,validated_data);obj.base_amount=obj.amount*obj.exchange_rate;obj.save(update_fields=("base_amount",));return obj

class TransferSerializer(serializers.ModelSerializer):
    class Meta:model=models.CashTransfer;fields="__all__";read_only_fields=("id","status","dispatched_by","received_by","created_by","created_at","updated_at")
    def validate(self,attrs):
        company=attrs.get("company") or self.instance.company;kind=attrs.get("transfer_type") or self.instance.transfer_type;source=attrs.get("source_fund") or getattr(self.instance,"source_fund",None);dest=attrs.get("destination_fund") or getattr(self.instance,"destination_fund",None);bank=attrs.get("bank_account") or getattr(self.instance,"bank_account",None)
        if source and source.company_id!=company.id or dest and dest.company_id!=company.id or bank and bank.company_id!=company.id:raise serializers.ValidationError("Quỹ và tài khoản ngân hàng phải thuộc cùng doanh nghiệp.")
        if kind=="FUND_TO_FUND" and (not source or not dest or source.id==dest.id or source.currency_id!=dest.currency_id):raise serializers.ValidationError("Điều chuyển quỹ yêu cầu hai quỹ khác nhau và cùng loại tiền.")
        if kind=="CASH_TO_BANK" and (not source or not bank):raise serializers.ValidationError("Nộp ngân hàng phải có quỹ nguồn và tài khoản đích.")
        if kind=="BANK_TO_CASH" and (not dest or not bank):raise serializers.ValidationError("Rút ngân hàng phải có tài khoản nguồn và quỹ đích.")
        if self.instance and self.instance.status!="DRAFT":raise serializers.ValidationError("Điều chuyển đã xử lý không được sửa.")
        return attrs

class AdvanceSerializer(serializers.ModelSerializer):
    remaining_amount=serializers.SerializerMethodField()
    class Meta:model=models.CashAdvance;fields="__all__";read_only_fields=("id","settled_amount","returned_amount","additional_paid","status","workflow_snapshot","disbursement","created_by","created_at","updated_at","remaining_amount")
    @extend_schema_field(serializers.DecimalField(max_digits=20,decimal_places=4))
    def get_remaining_amount(self,obj):return obj.remaining_amount
    def validate(self,attrs):
        company=attrs.get("company") or self.instance.company;fund=attrs.get("fund") or self.instance.fund;recipient=attrs.get("recipient") or self.instance.recipient
        if fund.company_id!=company.id or recipient.company_id!=company.id:raise serializers.ValidationError("Quỹ và người nhận phải thuộc cùng doanh nghiệp.")
        if self.instance and self.instance.status not in {"DRAFT","REJECTED"}:raise serializers.ValidationError("Khoản tạm ứng không còn được sửa.")
        return attrs

class SettlementSerializer(serializers.ModelSerializer):
    class Meta:model=models.AdvanceSettlement;fields="__all__";read_only_fields=("id","created_by","created_at")

class CountSerializer(serializers.ModelSerializer):
    class Meta:model=models.CashCount;fields="__all__";read_only_fields=("id","book_balance","difference","status","adjustment","created_by","created_at")
    def validate(self,attrs):
        company=attrs.get("company") or self.instance.company;fund=attrs.get("fund") or self.instance.fund
        if fund.company_id!=company.id:raise serializers.ValidationError({"fund":"Quỹ phải thuộc cùng doanh nghiệp."})
        if self.instance and self.instance.status!="DRAFT":raise serializers.ValidationError("Biên bản đã xác nhận không được sửa.")
        return attrs

class FxRevaluationSerializer(serializers.ModelSerializer):
    class Meta:model=models.FxRevaluation;fields="__all__";read_only_fields=("id","foreign_balance","difference","created_by","created_at")
    def validate(self,attrs):
        company=attrs.get("company") or self.instance.company;fund=attrs.get("fund") or self.instance.fund
        if fund.company_id!=company.id:raise serializers.ValidationError({"fund":"Quỹ phải thuộc cùng doanh nghiệp."})
        return attrs
    def create(self,validated_data):
        fund=validated_data["fund"];validated_data["foreign_balance"]=fund.balance;validated_data["difference"]=fund.balance*(validated_data["new_rate"]-validated_data["old_rate"]);return super().create(validated_data)

@extend_schema_serializer(component_name="CashApproval")
class ApprovalSerializer(serializers.ModelSerializer):
    class Meta:model=models.ApprovalDecision;fields="__all__";read_only_fields=("id","decided_at")
