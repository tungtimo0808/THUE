from rest_framework import mixins, serializers
from rest_framework.viewsets import GenericViewSet


from . import models, services
from .permissions import BankPermission


class CreditContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.CreditContract
        fields = ("id", "company", "direction", "contract_type", "number", "sign_date", "partner_name", "credit_limit",
                  "start_date", "end_date", "purpose", "status", "collaterals", "created_at")

    def validate(self, attrs):
        start, end = attrs.get("start_date"), attrs.get("end_date")
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "Ngày kết thúc không được trước ngày bắt đầu."})
        return attrs


class LoanAgreementSerializer(serializers.ModelSerializer):
    principal_account_code = serializers.CharField(source="principal_account.code", read_only=True)
    interest_account_code = serializers.CharField(source="interest_account.code", read_only=True)
    credit_contract_number = serializers.CharField(source="credit_contract.number", read_only=True, default="")

    class Meta:
        model = models.LoanAgreement
        fields = ("id", "company", "direction", "number", "counterparty_name", "credit_contract", "credit_contract_number",
                  "purpose", "principal_account", "principal_account_code", "interest_account", "interest_account_code",
                  "amount", "term", "term_unit", "disbursement_date", "due_date", "interest_rates", "principal_period",
                  "interest_period", "settlement_account", "status", "created_at")

    def validate(self, attrs):
        company = attrs.get("company")
        for field in ("principal_account", "interest_account"):
            account = attrs.get(field)
            if account and (account.company_id != company.pk or not account.is_postable or account.status != "ACTIVE"):
                raise serializers.ValidationError({field: "Tài khoản phải là tài khoản chi tiết đang sử dụng của doanh nghiệp."})
        contract = attrs.get("credit_contract")
        if contract and (contract.company_id != company.pk or contract.direction != attrs.get("direction")):
            raise serializers.ValidationError({"credit_contract": "Hợp đồng tín dụng không cùng doanh nghiệp hoặc khác chiều vay."})
        if attrs["due_date"] < attrs["disbursement_date"]:
            raise serializers.ValidationError({"due_date": "Ngày đến hạn không được trước ngày giải ngân."})
        for row in attrs.get("interest_rates") or []:
            if float(row.get("rate", 0)) < 0:
                raise serializers.ValidationError({"interest_rates": "Lãi suất không được âm."})
        return attrs


class _CompanyViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, GenericViewSet):
    permission_classes = (BankPermission,)
    iam_permissions = {"GET": "BANK.LOAN.VIEW", "POST": "BANK.LOAN.CREATE"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        direction = self.request.query_params.get("direction")
        return queryset.filter(direction=direction) if direction else queryset

    def perform_create(self, serializer):
        obj = serializer.save(created_by=services.actor(self.request))
        services.audit(self.request, obj, "CREATE", after=serializer.data)


class CreditContractViewSet(_CompanyViewSet):
    queryset = models.CreditContract.objects.all()
    serializer_class = CreditContractSerializer


class LoanAgreementViewSet(_CompanyViewSet):
    queryset = models.LoanAgreement.objects.select_related("principal_account", "interest_account", "credit_contract")
    serializer_class = LoanAgreementSerializer
