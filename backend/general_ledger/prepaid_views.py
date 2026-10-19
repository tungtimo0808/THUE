from rest_framework import mixins, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from organization.models import Company

from . import models, prepaid_services
from .permissions import GeneralLedgerPermission


class PrepaidTargetSerializer(serializers.ModelSerializer):
    expense_account_code = serializers.CharField(source="expense_account.code", read_only=True)

    class Meta:
        model = models.PrepaidExpenseTarget
        fields = ("line_no", "expense_account", "expense_account_code", "rate", "description")


class PrepaidExpenseSerializer(serializers.ModelSerializer):
    targets = PrepaidTargetSerializer(many=True, read_only=True)
    prepaid_account_code = serializers.CharField(source="prepaid_account.code", read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=24, decimal_places=4, read_only=True)
    remaining_periods = serializers.IntegerField(read_only=True)
    next_period_amount = serializers.SerializerMethodField()

    class Meta:
        model = models.PrepaidExpense
        fields = ("id", "company", "code", "name", "record_date", "start_date", "amount", "allocation_periods",
                  "prepaid_account", "prepaid_account_code", "is_opening", "opening_allocated_amount",
                  "opening_allocated_periods", "allocated_amount", "allocated_periods", "remaining_amount",
                  "remaining_periods", "next_period_amount", "status", "targets", "created_at")

    def get_next_period_amount(self, obj):
        return str(prepaid_services.period_amount(obj)) if obj.status == "ACTIVE" else "0"


class PrepaidAllocationLineSerializer(serializers.ModelSerializer):
    prepaid_code = serializers.CharField(source="prepaid.code", read_only=True)
    prepaid_name = serializers.CharField(source="prepaid.name", read_only=True)
    expense_account_code = serializers.CharField(source="expense_account.code", read_only=True)

    class Meta:
        model = models.PrepaidAllocationLine
        fields = ("prepaid", "prepaid_code", "prepaid_name", "expense_account", "expense_account_code", "amount")


class PrepaidAllocationSerializer(serializers.ModelSerializer):
    lines = PrepaidAllocationLineSerializer(many=True, read_only=True)
    period_code = serializers.CharField(source="period.code", read_only=True)
    entry_number = serializers.CharField(source="entry.number", read_only=True)
    status = serializers.CharField(source="entry.status", read_only=True)

    class Meta:
        model = models.PrepaidAllocation
        fields = ("id", "company", "kind", "number", "period", "period_code", "document_date", "posting_date",
                  "description", "total_amount", "entry", "entry_number", "status", "lines", "created_at")


class _CompanyMixin:
    permission_classes = (GeneralLedgerPermission,)

    def company(self):
        company = Company.objects.filter(pk=self.request.query_params.get("company_id") or self.request.data.get("company")).first()
        if not company:
            raise serializers.ValidationError({"company": "Không tìm thấy doanh nghiệp."})
        return company

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class PrepaidExpenseViewSet(_CompanyMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, GenericViewSet):
    queryset = models.PrepaidExpense.objects.select_related("prepaid_account").prefetch_related("targets__expense_account").order_by("code")
    serializer_class = PrepaidExpenseSerializer
    iam_permissions = {"GET": "GL.ALLOCATION.VIEW", "POST": "GL.ALLOCATION.CREATE"}

    def create(self, request, *args, **kwargs):
        prepaid = prepaid_services.create_prepaid(self.company(), request.data, request)
        return Response(self.get_serializer(prepaid).data, status=status.HTTP_201_CREATED)


class PrepaidAllocationViewSet(_CompanyMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    queryset = models.PrepaidAllocation.objects.select_related("period", "entry").prefetch_related(
        "lines__prepaid", "lines__expense_account")
    serializer_class = PrepaidAllocationSerializer
    iam_permissions = {"GET": "GL.ALLOCATION.VIEW", "POST": "GL.ALLOCATION.RUN"}
    kind = "ALLOCATION"

    def get_queryset(self):
        return super().get_queryset().filter(kind=self.kind)

    def create(self, request, *args, **kwargs):
        service = prepaid_services.allocate if self.kind == "ALLOCATION" else prepaid_services.decrease
        allocation = service(self.company(), request.data, request)
        return Response(self.get_serializer(allocation).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("get",))
    def preview(self, request):
        """What an allocation on the given posting date would book, item by item."""
        from datetime import date
        try:
            posting_date = date.fromisoformat(request.query_params.get("posting_date", ""))
        except ValueError as exc:
            raise serializers.ValidationError({"posting_date": "Ngày hạch toán không hợp lệ."}) from exc
        period = prepaid_services._period_for(self.company(), posting_date)
        rows = prepaid_services.allocation_preview(self.company(), period)
        return Response([{
            "prepaid": str(row["prepaid"].id), "code": row["prepaid"].code, "name": row["prepaid"].name,
            "amount": str(row["amount"]), "remaining_amount": str(row["prepaid"].remaining_amount),
            "lines": [{"expense_account": account.code, "amount": str(value)} for account, value in row["split"]],
        } for row in rows])


class PrepaidDecreaseViewSet(PrepaidAllocationViewSet):
    kind = "DECREASE"
