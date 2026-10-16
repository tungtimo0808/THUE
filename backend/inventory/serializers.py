from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_serializer

from master_data.models import ItemUomConversion, fixed_uom_factor, validate_uom_quantity
from django.core.exceptions import ValidationError as DjangoValidationError
from . import models


class PolicySerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    uom_name = serializers.CharField(source="base_uom.name", read_only=True)

    class Meta:
        model = models.InventoryPolicy
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        instance = self.instance
        company = attrs.get("company", instance.company if instance else None)
        warehouse = attrs.get("warehouse", instance.warehouse if instance else None)
        item = attrs.get("item", instance.item if instance else None)
        base_uom = attrs.get("base_uom", instance.base_uom if instance else None)
        if warehouse.company_id != company.id or item.company_id != company.id:
            raise serializers.ValidationError("Kho và hàng hóa phải thuộc cùng doanh nghiệp.")
        if not item.track_inventory or item.status != "ACTIVE":
            raise serializers.ValidationError({"item": "Hàng hóa không hoạt động hoặc không theo dõi tồn kho."})
        if base_uom.id != item.base_uom_id:
            raise serializers.ValidationError({"base_uom": "Phải dùng đơn vị cơ sở của hàng hóa."})
        minimum = attrs.get("minimum_quantity", instance.minimum_quantity if instance else Decimal("0"))
        maximum = attrs.get("maximum_quantity", instance.maximum_quantity if instance else None)
        if maximum is not None and minimum > maximum:
            raise serializers.ValidationError({"maximum_quantity": "Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu."})
        stock_exists = instance and models.StockBalance.objects.filter(
            warehouse=instance.warehouse, item=instance.item, quantity__gt=0
        ).exists()
        if stock_exists and any(
            name in attrs and attrs[name] != getattr(instance, name)
            for name in ("track_lot", "track_serial", "valuation_method")
        ):
            raise serializers.ValidationError("Không được đổi cách theo dõi Lot/Serial khi vẫn còn tồn.")
        return attrs


class LotSerialSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.LotSerial
        fields = "__all__"
        read_only_fields = ("id", "created_at")

    def validate(self, attrs):
        company = attrs.get("company", self.instance.company if self.instance else None)
        item = attrs.get("item", self.instance.item if self.instance else None)
        if item.company_id != company.id:
            raise serializers.ValidationError({"item": "Hàng hóa phải thuộc cùng doanh nghiệp."})
        has_serial_policy = models.InventoryPolicy.objects.filter(item=item, track_serial=True, is_active=True).exists()
        if attrs.get("tracking_type", getattr(self.instance, "tracking_type", None)) == "SERIAL" and not (item.track_serial or has_serial_policy):
            raise serializers.ValidationError({"tracking_type": "Hàng hóa chưa được cấu hình quản lý serial."})
        return attrs


class TransactionLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InventoryTransactionLine
        fields = "__all__"
        read_only_fields = ("id", "transaction", "base_quantity", "line_value")


@extend_schema_serializer(component_name="InventoryTransaction")
class TransactionSerializer(serializers.ModelSerializer):
    lines = TransactionLineSerializer(many=True)
    source_warehouse_code = serializers.CharField(source="source_warehouse.code", read_only=True)
    source_warehouse_name = serializers.CharField(source="source_warehouse.name", read_only=True)
    destination_warehouse_code = serializers.CharField(source="destination_warehouse.code", read_only=True)
    destination_warehouse_name = serializers.CharField(source="destination_warehouse.name", read_only=True)

    class Meta:
        model = models.InventoryTransaction
        fields = "__all__"
        read_only_fields = (
            "id", "status", "workflow_snapshot", "inventory_applied", "total_value", "warnings",
            "gl_status", "gl_reference", "created_by", "submitted_at", "approved_at", "posted_at",
            "reversed_at", "created_at", "updated_at",
        )

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.status not in {"DRAFT", "REJECTED"}:
            raise serializers.ValidationError("Chỉ giao dịch nháp hoặc bị từ chối mới được sửa.")
        company = attrs.get("company", instance.company if instance else None)
        source = attrs.get("source_warehouse", instance.source_warehouse if instance else None)
        destination = attrs.get("destination_warehouse", instance.destination_warehouse if instance else None)
        kind = attrs.get("transaction_type", instance.transaction_type if instance else None)
        if source and source.company_id != company.id or destination and destination.company_id != company.id:
            raise serializers.ValidationError("Kho phải thuộc cùng doanh nghiệp.")
        if kind in {"RECEIPT", "RETURN", "ADJUSTMENT_IN"} and not destination:
            raise serializers.ValidationError({"destination_warehouse": "Giao dịch nhập phải có kho đích."})
        if kind in {"ISSUE", "ADJUSTMENT_OUT"} and not source:
            raise serializers.ValidationError({"source_warehouse": "Giao dịch xuất phải có kho nguồn."})
        if kind == "TRANSFER" and (not source or not destination or source.id == destination.id):
            raise serializers.ValidationError("Kho nguồn và kho đích điều chuyển phải khác nhau.")
        if source:
            if source.status != "ACTIVE" and not (source.status == "INACTIVE" and kind == "ADJUSTMENT_OUT"):
                raise serializers.ValidationError({"source_warehouse": "Kho nguồn không hoạt động."})
            if kind == "TRANSFER" and not source.allow_transfer or kind != "TRANSFER" and not source.allow_issue:
                raise serializers.ValidationError({"source_warehouse": "Kho nguồn không cho phép nghiệp vụ này."})
        if destination:
            if destination.status != "ACTIVE":
                raise serializers.ValidationError({"destination_warehouse": "Kho đích không hoạt động."})
            if kind == "TRANSFER" and not destination.allow_transfer or kind != "TRANSFER" and not destination.allow_receipt:
                raise serializers.ValidationError({"destination_warehouse": "Kho đích không cho phép nghiệp vụ này."})
        if kind != "TRANSFER" and any(row and row.warehouse_type == "TRANSIT" for row in (source, destination)):
            raise serializers.ValidationError("Kho trung chuyển chỉ dùng cho giao dịch chuyển kho.")
        transaction_date = attrs.get("transaction_date", instance.transaction_date if instance else None)
        for warehouse in (source, destination):
            if warehouse and transaction_date and ((warehouse.start_date and transaction_date < warehouse.start_date) or (warehouse.end_date and transaction_date > warehouse.end_date)):
                raise serializers.ValidationError("Ngày giao dịch nằm ngoài thời gian sử dụng kho.")
        for line in attrs.get("lines", []):
            location = line.get("location")
            destination_location = line.get("destination_location")
            if location and (not source or location.warehouse_id != source.pk):
                raise serializers.ValidationError({"lines": "Vị trí nguồn phải thuộc kho nguồn."})
            if destination_location and (not destination or destination_location.warehouse_id != destination.pk):
                raise serializers.ValidationError({"lines": "Vị trí đích phải thuộc kho đích."})
        original = attrs.get("original_transaction", instance.original_transaction if instance else None)
        if kind == "RETURN" and (not original or original.transaction_type != "ISSUE" or original.status != "POSTED"):
            raise serializers.ValidationError({"original_transaction": "Phải tham chiếu phiếu xuất đã ghi nhận."})
        if original and original.company_id != company.id:
            raise serializers.ValidationError({"original_transaction": "Giao dịch nguồn phải thuộc cùng doanh nghiệp."})
        if not attrs.get("reason", getattr(instance, "reason", "")) and kind in {"ADJUSTMENT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"}:
            raise serializers.ValidationError({"reason": "Điều chỉnh tồn kho bắt buộc có lý do."})
        return attrs

    def _prepare_line(self, company, raw):
        item, uom = raw["item"], raw["uom"]
        if item.company_id != company.id or uom.company_id != company.id or not item.track_inventory:
            raise serializers.ValidationError({"lines": "Hàng hóa hoặc đơn vị tính không hợp lệ."})
        try:
            validate_uom_quantity(uom, raw["quantity"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"lines": exc.messages}) from exc
        if uom.id == item.base_uom_id:
            factor = Decimal("1")
        else:
            conversion = ItemUomConversion.objects.filter(item=item, from_uom=uom, to_uom=item.base_uom).first()
            factor = conversion.factor if conversion else fixed_uom_factor(uom, item.base_uom)
            if factor is None:
                raise serializers.ValidationError({"lines": f"Thiếu quy đổi đơn vị cho hàng {item.code}."})
        raw["conversion_factor"] = factor
        raw["base_quantity"] = raw["quantity"] * factor
        raw["line_value"] = raw["base_quantity"] * raw.get("unit_cost", Decimal("0"))
        for field in ("location", "destination_location"):
            location = raw.get(field)
            if location and (location.warehouse.company_id != company.id or location.status != "ACTIVE" or not location.can_store):
                raise serializers.ValidationError({"lines": f"{field} không cho phép chứa hàng hoặc đã ngừng."})
        lot = raw.get("lot_serial")
        if lot and (lot.company_id != company.id or lot.item_id != item.id):
            raise serializers.ValidationError({"lines": "Lot/Serial không thuộc hàng hóa được chọn."})
        if lot and lot.tracking_type == "SERIAL" and raw["base_quantity"] != 1:
            raise serializers.ValidationError({"lines": "Mỗi dòng serial phải có số lượng cơ sở bằng 1."})
        return raw

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        obj = models.InventoryTransaction.objects.create(**validated_data)
        for raw in lines:
            models.InventoryTransactionLine.objects.create(transaction=obj, **self._prepare_line(obj.company, raw))
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        instance = super().update(instance, validated_data)
        if lines is not None:
            instance.lines.all().delete()
            for raw in lines:
                models.InventoryTransactionLine.objects.create(transaction=instance, **self._prepare_line(instance.company, raw))
        return instance


class BalanceSerializer(serializers.ModelSerializer):
    available_quantity = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    uom_name = serializers.CharField(source="item.base_uom.name", read_only=True)

    class Meta:
        model = models.StockBalance
        fields = "__all__"
        read_only_fields = (
            "id", "company", "warehouse", "item", "location", "lot_serial", "quantity",
            "reserved_quantity", "inventory_value", "average_cost", "updated_at",
        )


class MovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.StockMovement
        fields = "__all__"
        read_only_fields = (
            "id", "company", "transaction", "line", "warehouse", "item", "location",
            "lot_serial", "movement_date", "quantity_delta", "value_delta", "balance_quantity",
            "balance_value", "created_at",
        )


class CountLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.StockCountLine
        fields = "__all__"
        read_only_fields = ("id", "stock_count", "system_quantity", "variance_quantity")

    def validate_actual_quantity(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Số lượng kiểm kê không được âm.")
        return value


class StockCountSerializer(serializers.ModelSerializer):
    lines = CountLineSerializer(many=True)

    class Meta:
        model = models.StockCount
        fields = "__all__"
        read_only_fields = ("id", "status", "adjustment_transaction", "created_by", "created_at")

    def validate(self, attrs):
        company = attrs.get("company", self.instance.company if self.instance else None)
        warehouse = attrs.get("warehouse", self.instance.warehouse if self.instance else None)
        if warehouse.company_id != company.id:
            raise serializers.ValidationError({"warehouse": "Kho phải thuộc cùng doanh nghiệp."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        obj = models.StockCount.objects.create(**validated_data)
        for raw in lines:
            movements = models.StockMovement.objects.filter(
                warehouse=obj.warehouse, item=raw["item"], location=raw.get("location"),
                lot_serial=raw.get("lot_serial"), movement_date__lte=obj.count_date,
            )
            system = movements.aggregate(value=Sum("quantity_delta"))["value"] or Decimal("0")
            actual = raw.get("actual_quantity")
            models.StockCountLine.objects.create(
                stock_count=obj, system_quantity=system,
                variance_quantity=(actual - system) if actual is not None else Decimal("0"), **raw,
            )
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        if instance.status != "DRAFT":
            raise serializers.ValidationError("Chỉ phiên kiểm kê nháp mới được cập nhật.")
        lines = validated_data.pop("lines", None)
        instance = super().update(instance, validated_data)
        if lines is not None:
            instance.lines.all().delete()
            for raw in lines:
                movements = models.StockMovement.objects.filter(
                    warehouse=instance.warehouse, item=raw["item"], location=raw.get("location"),
                    lot_serial=raw.get("lot_serial"), movement_date__lte=instance.count_date,
                )
                system = movements.aggregate(value=Sum("quantity_delta"))["value"] or Decimal("0")
                actual = raw.get("actual_quantity")
                models.StockCountLine.objects.create(
                    stock_count=instance, system_quantity=system,
                    variance_quantity=(actual - system) if actual is not None else Decimal("0"), **raw,
                )
        return instance


class AssemblyLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.AssemblyLine
        fields = "__all__"
        read_only_fields = ("id", "assembly")


@extend_schema_serializer(component_name="InventoryAssembly")
class AssemblySerializer(serializers.ModelSerializer):
    lines = AssemblyLineSerializer(many=True)

    class Meta:
        model = models.AssemblyOrder
        fields = "__all__"
        read_only_fields = ("id", "status", "created_by", "posted_at", "created_at")

    def validate(self, attrs):
        lines = attrs.get("lines", [])
        if not any(x["role"] == "COMPONENT" for x in lines) or not any(x["role"] == "OUTPUT" for x in lines):
            raise serializers.ValidationError({"lines": "Phải có ít nhất một thành phần và một thành phẩm."})
        company = attrs.get("company", self.instance.company if self.instance else None)
        warehouse = attrs.get("warehouse", self.instance.warehouse if self.instance else None)
        if warehouse.company_id != company.id or any(x["item"].company_id != company.id for x in lines):
            raise serializers.ValidationError("Kho và hàng hóa phải thuộc cùng doanh nghiệp.")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        obj = models.AssemblyOrder.objects.create(**validated_data)
        for raw in lines:
            models.AssemblyLine.objects.create(assembly=obj, **raw)
        return obj


class ValuationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ValuationRun
        fields = "__all__"
        read_only_fields = ("id", "total_quantity", "total_value", "status", "details", "created_by", "created_at")


@extend_schema_serializer(component_name="InventoryPeriod")
class PeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InventoryPeriod
        fields = "__all__"
        read_only_fields = ("id",)


@extend_schema_serializer(component_name="InventoryApproval")
class ApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ApprovalDecision
        fields = "__all__"
        read_only_fields = ("id", "decided_at")
