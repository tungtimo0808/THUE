from decimal import Decimal

from django.db import transaction
from rest_framework import mixins, serializers, status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
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
        "GET": "FA.COUNT.VIEW",
        "POST": "FA.COUNT.CREATE",
        "PUT": "FA.COUNT.EDIT",
        "PATCH": "FA.COUNT.EDIT",
    }
    action_permissions = {
        "next_stocktake_number": "FA.COUNT.CREATE",
        "load_book_assets": "FA.COUNT.CREATE",
        "update_stocktake": "FA.COUNT.EDIT",
        "stocktake_references": "FA.COUNT.CREATE",
        "stocktake_attachments": "FA.COUNT.VIEW",
        "export_stocktakes": "FA.COUNT.VIEW",
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
        queryset = queryset.filter(asset_type=asset_type) if asset_type else queryset
        if not self.request.user.is_superuser and hasattr(self.request.user, "iam_account"):
            from iam.permissions import has_effective_permission
            permission = "FA.COUNT.EDIT" if self.action in ("update", "partial_update", "update_stocktake") else "FA.COUNT.VIEW"
            visible_ids = []
            for count in queryset.prefetch_related("lines__asset"):
                if all(has_effective_permission(self.request.user.iam_account, count.company, permission, branch_id=line.asset.branch_id)
                       for line in count.lines.all()):
                    visible_ids.append(count.id)
            queryset = queryset.filter(pk__in=visible_ids)
        return queryset

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

    @action(detail=False, methods=("get",), url_path="stocktake-references")
    def stocktake_references(self, request):
        from general_ledger.models import JournalEntry
        from iam.permissions import has_effective_permission

        company_id = request.query_params.get("company_id")
        if not Company.objects.filter(pk=company_id).exists():
            raise serializers.ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})
        from_date = services._parse_date(request.query_params.get("from_date")) if request.query_params.get("from_date") else None
        to_date = services._parse_date(request.query_params.get("to_date")) if request.query_params.get("to_date") else None
        if request.query_params.get("from_date") and not from_date or request.query_params.get("to_date") and not to_date:
            raise serializers.ValidationError("Điều kiện tìm kiếm chứng từ không hợp lệ.")
        if from_date and to_date and from_date > to_date:
            raise serializers.ValidationError({"from_date": "Ngày Từ không được lớn hơn ngày Đến."})
        qs = JournalEntry.objects.filter(company_id=company_id, status="POSTED").order_by("-posting_date", "-created_at")
        if from_date:
            qs = qs.filter(posting_date__gte=from_date)
        if to_date:
            qs = qs.filter(posting_date__lte=to_date)
        if request.query_params.get("number"):
            qs = qs.filter(number__icontains=request.query_params["number"].strip())
        if request.query_params.get("entry_type"):
            qs = qs.filter(entry_type=request.query_params["entry_type"].strip())
        rows = []
        for entry in qs[:300]:
            if not request.user.is_superuser and entry.branch_id and not has_effective_permission(
                request.user.iam_account, entry.company, "FA.COUNT.CREATE", branch_id=entry.branch_id
            ):
                continue
            rows.append({"id": str(entry.id), "number": entry.number, "posting_date": entry.posting_date,
                "document_date": entry.document_date, "description": entry.description, "entry_type": entry.entry_type})
        return Response(rows)

    @action(detail=True, methods=("get", "post"), url_path="stocktake-attachments", parser_classes=(MultiPartParser, FormParser))
    def stocktake_attachments(self, request, pk=None):
        import os
        import uuid
        from django.core.files.storage import default_storage
        from django.http import FileResponse
        from iam.permissions import has_effective_permission

        count = self.get_object()
        if count.asset_type != "FIXED_ASSET" or not isinstance(count.committee, dict) or not count.committee.get("_uc08"):
            raise serializers.ValidationError("Biên bản kiểm kê không hợp lệ.")
        attachments = count.committee.get("attachments") or []
        if request.method == "GET":
            attachment_id = request.query_params.get("attachment_id")
            if not attachment_id:
                return Response(attachments)
            item = next((a for a in attachments if a.get("id") == attachment_id), None)
            if not item or not item.get("storage_path") or not default_storage.exists(item["storage_path"]):
                raise serializers.ValidationError("Không tìm thấy tệp đính kèm.")
            return FileResponse(default_storage.open(item["storage_path"], "rb"), as_attachment=True, filename=item["name"])
        if not request.user.is_superuser and not has_effective_permission(request.user.iam_account, count.company, "FA.COUNT.EDIT"):
            raise serializers.ValidationError("Bạn không có quyền đính kèm hồ sơ kiểm kê.")
        upload = request.FILES.get("file")
        allowed = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".csv", ".txt"}
        if not upload or upload.size > 5 * 1024 * 1024 or os.path.splitext(upload.name)[1].lower() not in allowed:
            raise serializers.ValidationError("Tệp đính kèm không hợp lệ hoặc vượt quá dung lượng cho phép (tối đa 5MB).")
        if any(a.get("name") == upload.name and a.get("size") == upload.size and a.get("storage_path") for a in attachments):
            return Response(services.serialize_stocktake_voucher_uc08(count))
        attachment_id = str(uuid.uuid4())
        path = default_storage.save(f"fixed_assets/stocktakes/{count.company_id}/{count.id}/{attachment_id}{os.path.splitext(upload.name)[1].lower()}", upload)
        try:
            with transaction.atomic():
                locked = models.AssetCount.objects.select_for_update().get(pk=count.pk)
                meta = dict(locked.committee)
                meta["attachments"] = [a for a in meta.get("attachments", []) if not (a.get("name") == upload.name and a.get("size") == upload.size and not a.get("storage_path"))] + [
                    {"id": attachment_id, "name": upload.name, "size": upload.size, "storage_path": path}
                ]
                locked.committee = meta
                locked.save(update_fields=("committee",))
                services.audit(request, locked, "ATTACH_STOCKTAKE_ASSET", after={"attachment_id": attachment_id, "name": upload.name})
        except Exception:
            default_storage.delete(path)
            raise
        return Response(services.serialize_stocktake_voucher_uc08(locked), status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("get",), url_path="export-stocktakes")
    def export_stocktakes(self, request):
        rows = []
        for count in self.get_queryset().filter(asset_type="FIXED_ASSET"):
            record = services.serialize_stocktake_voucher_uc08(count)
            rows.append({"number": record["number"], "count_date": record["count_date"],
                "purpose": record["purpose"], "conclusion": record["conclusion"],
                "status": record["status_display"], **record["summary"]})
        return Response(rows)
