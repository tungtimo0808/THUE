from rest_framework import mixins, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.views import APIView

from iam.permissions import HasIamPermission
from organization.models import Company

from . import models, services


def _company(request):
    company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
    if not company:
        raise serializers.ValidationError({"company": "Không tìm thấy doanh nghiệp."})
    return company


class CostObjectSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.CostObjectSetting
        fields = ("id", "company", "object_type", "object_id", "object_code", "object_name", "coefficient", "planned_cost",
                  "opening_wip", "material_norms", "estimate", "finished_item", "updated_at")
        read_only_fields = ("object_code", "object_name")


class CostAllocationSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.CostAllocationSetting
        fields = ("labor_basis", "overhead_basis")

    def validate(self, attrs):
        for field in ("labor_basis", "overhead_basis"):
            if field in attrs and attrs[field] not in ("AUTO", "MATERIAL", "LABOR", "PLAN", "OUTPUT"):
                raise serializers.ValidationError({field: "Tiêu thức phân bổ không hợp lệ."})
        return attrs


class CostAllocationSettingView(APIView):
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "COST.SETTING.VIEW", "PUT": "COST.SETTING.EDIT"}

    def get(self, request):
        setting, _ = models.CostAllocationSetting.objects.get_or_create(company=_company(request))
        return Response(CostAllocationSettingSerializer(setting).data)

    def put(self, request):
        setting, _ = models.CostAllocationSetting.objects.get_or_create(company=_company(request))
        serializer = CostAllocationSettingSerializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        services.audit(request, setting, "CONFIGURE", after=serializer.data)
        return Response(serializer.data)


class CostPeriodObjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.CostPeriodObject
        exclude = ("period",)


class CostPeriodSerializer(serializers.ModelSerializer):
    objects = CostPeriodObjectSerializer(many=True, read_only=True, source="cost_objects")
    transfer_number = serializers.CharField(source="transfer_entry.number", read_only=True, default="")
    acceptance_number = serializers.CharField(source="acceptance_entry.number", read_only=True, default="")

    class Meta:
        model = models.CostPeriod
        fields = ("id", "company", "code", "name", "method", "start_date", "end_date", "status", "pools", "objects",
                  "transfer_entry", "transfer_number", "acceptance_entry", "acceptance_number", "created_at")


class _CompanyMixin:
    permission_classes = (HasIamPermission,)

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        method = self.request.query_params.get("method")
        return queryset.filter(method__in=method.split(",")) if method and hasattr(self.queryset.model, "method") else queryset


class CostObjectSettingViewSet(_CompanyMixin, mixins.ListModelMixin, mixins.CreateModelMixin, GenericViewSet):
    """Upsert norms of a cost object (coefficient, planned cost, opening WIP, material norms, estimate)."""
    queryset = models.CostObjectSetting.objects.all()
    serializer_class = CostObjectSettingSerializer
    iam_permissions = {"GET": "COST.SETTING.VIEW", "POST": "COST.SETTING.EDIT"}

    def create(self, request, *args, **kwargs):
        company = _company(request)
        object_type, object_id = request.data.get("object_type"), request.data.get("object_id")
        code, name = services.resolve_object(company, object_type, object_id)
        setting = models.CostObjectSetting.objects.filter(company=company, object_type=object_type, object_id=object_id).first()
        serializer = self.get_serializer(setting, data={**request.data, "company": str(company.pk)}, partial=bool(setting))
        serializer.is_valid(raise_exception=True)
        setting = serializer.save(object_code=code, object_name=name)
        services.audit(request, setting, "CONFIGURE", after=serializer.data)
        return Response(self.get_serializer(setting).data, status=status.HTTP_201_CREATED)


class CostPeriodViewSet(_CompanyMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    queryset = models.CostPeriod.objects.select_related("transfer_entry", "acceptance_entry").prefetch_related("cost_objects")
    serializer_class = CostPeriodSerializer
    iam_permissions = {"GET": "COST.PERIOD.VIEW", "POST": "COST.PERIOD.CREATE"}
    action_permissions = {"recalculate": "COST.PERIOD.CREATE", "transfer": "COST.PERIOD.POST", "accept": "COST.PERIOD.POST"}

    def create(self, request, *args, **kwargs):
        return Response(self.get_serializer(services.create_period(_company(request), request.data, request)).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def recalculate(self, request, pk=None):
        period = self.get_object()
        for row in request.data.get("objects") or []:
            period.cost_objects.filter(pk=row.get("id")).update(**{key: row[key] for key in ("output_quantity", "closing_wip", "opening_wip", "coefficient", "planned_cost") if key in row})
        return Response(self.get_serializer(services.calculate(period)).data)

    @action(detail=True, methods=("post",))
    def transfer(self, request, pk=None):
        return Response(self.get_serializer(services.transfer(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def accept(self, request, pk=None):
        return Response(self.get_serializer(services.accept(self.get_object(), request)).data)
