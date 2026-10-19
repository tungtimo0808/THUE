from decimal import Decimal

from django.db import transaction
from rest_framework import mixins, serializers, status
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from organization.models import Company

from . import models, services
from .permissions import FixedAssetPermission


class AssetCountLineSerializer(serializers.ModelSerializer):
    asset_code = serializers.CharField(source="asset.code", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    department_name = serializers.CharField(source="asset.department.name", read_only=True, default="")
    difference = serializers.SerializerMethodField()

    class Meta:
        model = models.AssetCountLine
        fields = ("id", "asset", "asset_code", "asset_name", "department_name", "book_quantity", "actual_quantity",
                  "difference", "book_value", "condition", "recommendation", "note")

    def get_difference(self, obj):
        return str(obj.actual_quantity - obj.book_quantity)


class AssetCountSerializer(serializers.ModelSerializer):
    lines = AssetCountLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.AssetCount
        fields = ("id", "company", "asset_type", "number", "count_date", "purpose", "conclusion", "committee", "lines", "created_at")


@transaction.atomic
def create_count(company, data, request):
    asset_type = data.get("asset_type")
    if asset_type not in ("FIXED_ASSET", "TOOL"):
        raise serializers.ValidationError({"asset_type": "Chọn kiểm kê TSCĐ hoặc CCDC."})
    number = str(data.get("number") or "").strip()
    if not number or models.AssetCount.objects.filter(company=company, number=number).exists():
        raise serializers.ValidationError({"number": "Số biên bản trống hoặc đã tồn tại."})
    rows = data.get("lines") or []
    if not rows:
        raise serializers.ValidationError({"lines": "Biên bản cần ít nhất một tài sản."})
    count = models.AssetCount.objects.create(
        company=company, asset_type=asset_type, number=number, count_date=data["count_date"],
        purpose=str(data.get("purpose") or "")[:500], conclusion=str(data.get("conclusion") or ""),
        committee=data.get("committee") or [], created_by=services.actor(request),
    )
    seen = set()
    for row in rows:
        asset = models.AssetRecord.objects.filter(company=company, pk=row.get("asset"), asset_type=asset_type).first()
        if not asset or asset.pk in seen:
            raise serializers.ValidationError({"lines": "Tài sản không hợp lệ, khác loại hoặc bị lặp."})
        seen.add(asset.pk)
        actual = Decimal(str(row.get("actual_quantity", asset.quantity)))
        if actual < 0:
            raise serializers.ValidationError({"lines": f"Số lượng thực tế của {asset.code} không được âm."})
        models.AssetCountLine.objects.create(
            count=count, asset=asset, book_quantity=asset.quantity, actual_quantity=actual,
            book_value=asset.remaining_value, condition=str(row.get("condition") or "")[:255],
            recommendation=str(row.get("recommendation") or "")[:255], note=str(row.get("note") or "")[:500],
        )
    services.audit(request, count, "CREATE", after={"number": number, "lines": len(rows)})
    return count


class AssetCountViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, GenericViewSet):
    permission_classes = (FixedAssetPermission,)
    serializer_class = AssetCountSerializer
    queryset = models.AssetCount.objects.prefetch_related("lines__asset__department")
    iam_permissions = {"GET": "FA.ASSET.VIEW", "POST": "FA.ASSET.CREATE"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        asset_type = self.request.query_params.get("asset_type")
        return queryset.filter(asset_type=asset_type) if asset_type else queryset

    def create(self, request, *args, **kwargs):
        company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
        if not company:
            raise serializers.ValidationError({"company": "Không tìm thấy doanh nghiệp."})
        return Response(self.get_serializer(create_count(company, request.data, request)).data, status=status.HTTP_201_CREATED)
