from decimal import Decimal

from django.db import transaction
from rest_framework import mixins, serializers, status
from rest_framework.decorators import action
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

    def to_representation(self, instance):
        if isinstance(instance.committee, dict) and instance.committee.get("_uc08"):
            return services.serialize_stocktake_voucher_uc08(instance)
        if isinstance(instance.committee, dict) and instance.committee.get("_uc15"):
            return services.serialize_tool_stocktake_voucher_uc15(instance)
        return super().to_representation(instance)


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


class AssetCountViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    permission_classes = (FixedAssetPermission,)
    serializer_class = AssetCountSerializer
    queryset = models.AssetCount.objects.prefetch_related("lines__asset__department")
    iam_permissions = {
        "GET": "FA.ASSET.VIEW",
        "POST": "FA.ASSET.CREATE",
        "PUT": "FA.ASSET.UPDATE",
        "PATCH": "FA.ASSET.UPDATE",
    }

    def get_queryset(self):
        company = (
            self.request.query_params.get("company_id")
            or self.request.query_params.get("company")
            or (self.request.data.get("company") if hasattr(self.request, "data") and isinstance(self.request.data, dict) else None)
            or (self.request.data.get("company_id") if hasattr(self.request, "data") and isinstance(self.request.data, dict) else None)
        )
        if not company and self.kwargs.get("pk"):
            return self.queryset.all()
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        asset_type = self.request.query_params.get("asset_type")
        return queryset.filter(asset_type=asset_type) if asset_type else queryset

    def create(self, request, *args, **kwargs):
        asset_type = str(request.data.get("asset_type") or "FIXED_ASSET").strip().upper()
        if asset_type == "TOOL" and not request.data.get("_uc08"):
            if (
                request.data.get("_uc15")
                or "committee" in request.data
                or "count_to_date" in request.data
                or "to_date" in request.data
            ):
                res = services.save_tool_stocktake_uc15(request, request.data)
                http_status = status.HTTP_200_OK if res.get("idempotent_replayed") else status.HTTP_201_CREATED
                return Response(res, status=http_status)
            company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
            if not company:
                raise serializers.ValidationError({"company": "Không tìm thấy doanh nghiệp."})
            return Response(self.get_serializer(create_count(company, request.data, request)).data, status=status.HTTP_201_CREATED)

        res = services.save_fixed_asset_stocktake_uc08(request, request.data)
        http_status = status.HTTP_200_OK if res.get("idempotent_replayed") else status.HTTP_201_CREATED
        return Response(res, status=http_status)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.asset_type == "TOOL" or (isinstance(instance.committee, dict) and instance.committee.get("_uc15")):
            res = services.save_tool_stocktake_uc15(request, request.data, instance=instance)
            return Response(res, status=status.HTTP_200_OK)
        res = services.save_fixed_asset_stocktake_uc08(request, request.data, instance=instance)
        return Response(res, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.asset_type == "TOOL" or (isinstance(instance.committee, dict) and instance.committee.get("_uc15")):
            res = services.save_tool_stocktake_uc15(request, request.data, instance=instance)
            return Response(res, status=status.HTTP_200_OK)
        res = services.save_fixed_asset_stocktake_uc08(request, request.data, instance=instance)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="next-number")
    def next_stocktake_number(self, request):
        company_id = request.query_params.get("company_id") or request.query_params.get("company")
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise serializers.ValidationError({"company": "Không tìm thấy doanh nghiệp."})
        year_based = str(request.query_params.get("year_based") or "").lower() in ("true", "1")
        prefix = request.query_params.get("prefix") or "KKTS"
        count_date = request.query_params.get("count_date")
        next_no = services.get_next_stocktake_voucher_no(
            company=company,
            count_date=count_date,
            year_based=year_based,
            prefix=prefix,
        )
        return Response({"voucher_no": next_no, "number": next_no})

    @action(detail=False, methods=("get", "post"), url_path="load-book-assets")
    def load_book_assets(self, request):
        res = services.load_book_assets_for_stocktake_uc08(request, request.data)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=True, methods=("post", "put", "patch"), url_path="update-stocktake")
    def update_stocktake(self, request, pk=None):
        instance = self.get_object()
        res = services.save_fixed_asset_stocktake_uc08(request, request.data, instance=instance)
        return Response(res, status=status.HTTP_200_OK)

