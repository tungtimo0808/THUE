from rest_framework import serializers
from drf_spectacular.utils import extend_schema_serializer

from . import models


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.AssetCategory
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        instance = self.instance
        company = attrs.get("company", instance.company if instance else None)
        parent = attrs.get("parent", instance.parent if instance else None)
        asset_type = attrs.get("asset_type", instance.asset_type if instance else None)
        if parent and (parent.company_id != company.id or parent.asset_type != asset_type or parent.id == getattr(instance, "id", None)):
            raise serializers.ValidationError({"parent": "Nhóm cha không hợp lệ."})
        for name in ("asset_account", "accumulated_account", "expense_account"):
            account = attrs.get(name, getattr(instance, name, None) if instance else None)
            if account and account.company_id != company.id:
                raise serializers.ValidationError({name: "Tài khoản phải thuộc cùng doanh nghiệp."})
        return attrs


class AssetSerializer(serializers.ModelSerializer):
    remaining_value = serializers.DecimalField(max_digits=24, decimal_places=4, read_only=True)
    processed_value = serializers.DecimalField(max_digits=24, decimal_places=4, read_only=True)
    category_code = serializers.CharField(source="category.code", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default="")
    custodian_name = serializers.CharField(source="custodian.full_name", read_only=True, default="")

    class Meta:
        model = models.AssetRecord
        fields = "__all__"
        read_only_fields = (
            "id", "accumulated_depreciation", "allocated_value", "periods_processed",
            "status", "disposed_at", "created_by", "created_at", "updated_at",
        )

    def validate(self, attrs):
        instance = self.instance
        company = attrs.get("company", instance.company if instance else None)
        category = attrs.get("category", instance.category if instance else None)
        asset_type = attrs.get("asset_type", instance.asset_type if instance else None)
        branch = attrs.get("branch", instance.branch if instance else None)
        if category.company_id != company.id or category.asset_type != asset_type:
            raise serializers.ValidationError({"category": "Nhóm phải cùng doanh nghiệp và đúng loại tài sản."})
        if branch.company_id != company.id:
            raise serializers.ValidationError({"branch": "Chi nhánh phải thuộc cùng doanh nghiệp."})
        for name in ("department", "custodian"):
            value = attrs.get(name, getattr(instance, name, None) if instance else None)
            if value and value.company_id != company.id:
                raise serializers.ValidationError({name: "Dữ liệu sử dụng phải thuộc cùng doanh nghiệp."})
        original = attrs.get("original_cost", instance.original_cost if instance else 0)
        salvage = attrs.get("salvage_value", instance.salvage_value if instance else 0)
        if salvage > original:
            raise serializers.ValidationError({"salvage_value": "Giá trị thu hồi không được vượt nguyên giá."})
        if instance and instance.transactions.filter(status__in=("APPROVED", "POSTED")).exists():
            protected = ("asset_type", "category", "original_cost", "salvage_value", "method", "useful_life_periods", "branch", "department", "custodian")
            if any(name in attrs and attrs[name] != getattr(instance, name) for name in protected):
                raise serializers.ValidationError("Thông tin đã hình thành từ giao dịch phải thay đổi bằng giao dịch tài sản.")
        return attrs


@extend_schema_serializer(component_name="FixedAssetTransaction")
class TransactionSerializer(serializers.ModelSerializer):
    asset_code = serializers.CharField(source="asset.code", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    target_category_name = serializers.CharField(source="target_category.name", read_only=True, default="")
    target_branch_name = serializers.CharField(source="target_branch.name", read_only=True, default="")
    target_department_name = serializers.CharField(source="target_department.name", read_only=True, default="")
    target_custodian_name = serializers.CharField(source="target_custodian.full_name", read_only=True, default="")

    class Meta:
        model = models.AssetTransaction
        fields = "__all__"
        read_only_fields = (
            "id", "before_snapshot", "after_snapshot", "workflow_snapshot", "status", "asset_applied",
            "gl_status", "gl_reference", "created_by", "submitted_at", "approved_at", "posted_at",
            "created_at", "updated_at",
        )

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.status not in {"DRAFT", "REJECTED"}:
            raise serializers.ValidationError("Chỉ giao dịch nháp hoặc bị từ chối mới được sửa.")
        company = attrs.get("company", instance.company if instance else None)
        asset = attrs.get("asset", instance.asset if instance else None)
        kind = attrs.get("transaction_type", instance.transaction_type if instance else None)
        amount = attrs.get("amount", instance.amount if instance else 0)
        if asset.company_id != company.id:
            raise serializers.ValidationError({"asset": "Tài sản phải thuộc cùng doanh nghiệp."})
        if asset.status == "DISPOSED" and kind != "REVERSAL":
            raise serializers.ValidationError("Tài sản đã ghi giảm không được phát sinh giao dịch mới.")
        if kind == "DEPRECIATION" and asset.asset_type != "FIXED_ASSET" or kind == "ALLOCATION" and asset.asset_type != "TOOL":
            raise serializers.ValidationError("Loại giao dịch không phù hợp loại tài sản.")
        if kind in {"ACQUISITION", "DEPRECIATION", "ALLOCATION", "VALUE_INCREASE", "VALUE_DECREASE", "DISPOSAL"} and amount <= 0:
            raise serializers.ValidationError({"amount": "Giá trị giao dịch phải lớn hơn 0."})
        reason = attrs.get("reason", getattr(instance, "reason", ""))
        if kind in {"TRANSFER", "RECLASSIFICATION", "VALUE_INCREASE", "VALUE_DECREASE", "DISPOSAL"} and not reason:
            raise serializers.ValidationError({"reason": "Giao dịch bắt buộc có lý do."})
        target_category = attrs.get("target_category", getattr(instance, "target_category", None))
        if kind == "RECLASSIFICATION" and (not target_category or target_category.id == asset.category_id or target_category.asset_type != asset.asset_type):
            raise serializers.ValidationError({"target_category": "Nhóm đích phải khác nhóm hiện tại và cùng loại tài sản."})
        if kind == "TRANSFER" and not any(attrs.get(x, getattr(instance, x, None)) for x in ("target_branch", "target_department", "target_custodian")):
            raise serializers.ValidationError("Điều chuyển phải xác định ít nhất một đơn vị/người nhận.")
        original = attrs.get("original_transaction", getattr(instance, "original_transaction", None))
        if original and (original.company_id != company.id or original.asset_id != asset.id):
            raise serializers.ValidationError({"original_transaction": "Giao dịch gốc không hợp lệ."})
        return attrs


class CalculationLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.CalculationLine
        fields = "__all__"
        read_only_fields = ("id", "run", "opening_value", "amount", "closing_value", "transaction")


class CalculationRunSerializer(serializers.ModelSerializer):
    lines = CalculationLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.CalculationRun
        fields = "__all__"
        read_only_fields = ("id", "status", "total_amount", "created_by", "created_at")

    def validate(self, attrs):
        if attrs["period_end"] < attrs["period_start"]:
            raise serializers.ValidationError({"period_end": "Kỳ tính không hợp lệ."})
        return attrs


@extend_schema_serializer(component_name="FixedAssetPeriod")
class PeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.AssetPeriod
        fields = "__all__"
        read_only_fields = ("id",)


@extend_schema_serializer(component_name="FixedAssetApproval")
class ApprovalSerializer(serializers.ModelSerializer):
    transaction_number = serializers.CharField(source="transaction.number", read_only=True)
    actor_name = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = models.ApprovalDecision
        fields = "__all__"
        read_only_fields = ("id", "decided_at")
