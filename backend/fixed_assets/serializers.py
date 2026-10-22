from rest_framework import serializers
from drf_spectacular.utils import extend_schema_serializer

from . import models


class CategorySerializer(serializers.ModelSerializer):
    asset_account_code = serializers.CharField(source="asset_account.code", read_only=True, default="")
    accumulated_account_code = serializers.CharField(source="accumulated_account.code", read_only=True, default="")
    expense_account_code = serializers.CharField(source="expense_account.code", read_only=True, default="")

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
    asset_account_code = serializers.CharField(source="asset_account.code", read_only=True, default="")
    accumulated_account_code = serializers.CharField(source="accumulated_account.code", read_only=True, default="")
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    accounting_reconciliation_status_display = serializers.CharField(
        source="get_accounting_reconciliation_status_display", read_only=True
    )
    created_by_name = serializers.CharField(source="created_by.username", read_only=True, default="")
    updated_by_name = serializers.CharField(source="updated_by.username", read_only=True, default="")

    class Meta:
        model = models.AssetRecord
        fields = "__all__"
        read_only_fields = (
            "id", "accumulated_depreciation", "allocated_value", "periods_processed",
            "status", "disposed_at", "version", "last_update_reason",
            "created_by", "updated_by", "created_at", "updated_at",
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
    department_name = serializers.CharField(source="asset.department.name", read_only=True, default="")
    asset_status = serializers.CharField(source="asset.status", read_only=True)
    asset_status_display = serializers.CharField(source="asset.get_status_display", read_only=True)
    accounting_reconciliation_status = serializers.CharField(
        source="asset.accounting_reconciliation_status", read_only=True
    )
    accounting_reconciliation_status_display = serializers.CharField(
        source="asset.get_accounting_reconciliation_status_display", read_only=True
    )
    target_category_name = serializers.CharField(source="target_category.name", read_only=True, default="")
    target_branch_name = serializers.CharField(source="target_branch.name", read_only=True, default="")
    target_department_name = serializers.CharField(source="target_department.name", read_only=True, default="")
    target_custodian_name = serializers.CharField(source="target_custodian.full_name", read_only=True, default="")
    voucher_no = serializers.SerializerMethodField()
    from_department_id = serializers.SerializerMethodField()
    from_department_name = serializers.SerializerMethodField()
    to_department_name = serializers.SerializerMethodField()
    deliverer = serializers.SerializerMethodField()
    receiver = serializers.SerializerMethodField()
    reference = serializers.SerializerMethodField()
    sales_contract = serializers.SerializerMethodField()
    sales_order = serializers.SerializerMethodField()
    project = serializers.SerializerMethodField()
    expense_item = serializers.SerializerMethodField()
    cost_object = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    def get_voucher_no(self, obj):
        after = obj.after_snapshot if isinstance(obj.after_snapshot, dict) else {}
        return str(after.get("voucher_no") or obj.source_reference or obj.number)

    def get_from_department_id(self, obj):
        before = obj.before_snapshot if isinstance(obj.before_snapshot, dict) else {}
        return str(before.get("from_department_id") or before.get("department") or "")

    def get_from_department_name(self, obj):
        before = obj.before_snapshot if isinstance(obj.before_snapshot, dict) else {}
        return str(
            before.get("from_department_name")
            or (obj.asset.department.name if obj.asset and obj.asset.department else "")
        )

    def get_to_department_name(self, obj):
        if obj.target_department_id and obj.target_department:
            return obj.target_department.name
        after = obj.after_snapshot if isinstance(obj.after_snapshot, dict) else {}
        return str(after.get("to_department_name") or "")

    def get_deliverer(self, obj):
        after = obj.after_snapshot if isinstance(obj.after_snapshot, dict) else {}
        return str(after.get("deliverer") or "")

    def get_receiver(self, obj):
        after = obj.after_snapshot if isinstance(obj.after_snapshot, dict) else {}
        return str(after.get("receiver") or "")

    def get_reference(self, obj):
        after = obj.after_snapshot if isinstance(obj.after_snapshot, dict) else {}
        return str(after.get("reference") or obj.source_reference or "")

    def get_sales_contract(self, obj):
        after = obj.after_snapshot if isinstance(obj.after_snapshot, dict) else {}
        return str(after.get("sales_contract") or "")

    def get_sales_order(self, obj):
        after = obj.after_snapshot if isinstance(obj.after_snapshot, dict) else {}
        return str(after.get("sales_order") or "")

    def get_project(self, obj):
        after = obj.after_snapshot if isinstance(obj.after_snapshot, dict) else {}
        return str(after.get("project") or "")

    def get_expense_item(self, obj):
        after = obj.after_snapshot if isinstance(obj.after_snapshot, dict) else {}
        return str(after.get("expense_item") or "")

    def get_cost_object(self, obj):
        after = obj.after_snapshot if isinstance(obj.after_snapshot, dict) else {}
        return str(after.get("cost_object") or "")

    def get_attachments(self, obj):
        after = obj.after_snapshot if isinstance(obj.after_snapshot, dict) else {}
        return after.get("attachments") or []

    class Meta:
        model = models.AssetTransaction
        fields = "__all__"
        read_only_fields = (
            "split_asset",
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
        quantity = attrs.get("quantity", getattr(instance, "quantity", None))
        # A partial disposal takes its value from the split-off part when posted.
        partial = kind == "DISPOSAL" and quantity is not None
        if kind in {"ACQUISITION", "DEPRECIATION", "ALLOCATION", "VALUE_INCREASE", "VALUE_DECREASE", "DISPOSAL"} and amount <= 0 and not partial:
            raise serializers.ValidationError({"amount": "Giá trị giao dịch phải lớn hơn 0."})
        if quantity is not None and kind not in {"TRANSFER", "DISPOSAL"}:
            raise serializers.ValidationError({"quantity": "Chỉ điều chuyển hoặc ghi giảm mới được chọn một phần số lượng."})
        if quantity is not None and (quantity <= 0 or quantity > asset.quantity):
            raise serializers.ValidationError({"quantity": "Số lượng phải lớn hơn 0 và không vượt số lượng đang theo dõi."})
        if kind == "LIFE_CHANGE" and not attrs.get("target_useful_life_periods", getattr(instance, "target_useful_life_periods", None)):
            raise serializers.ValidationError({"target_useful_life_periods": "Nhập số kỳ khấu hao/phân bổ mới."})
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
    asset_code = serializers.CharField(source="asset.code", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)

    class Meta:
        model = models.CalculationLine
        fields = "__all__"
        read_only_fields = ("id", "run", "opening_value", "amount", "closing_value", "transaction")


class CalculationRunSerializer(serializers.ModelSerializer):
    lines = CalculationLineSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True, default="")
    posted_by_name = serializers.CharField(source="posted_by.username", read_only=True, default="")

    class Meta:
        model = models.CalculationRun
        fields = "__all__"
        read_only_fields = (
            "id", "status", "total_amount", "total_deductible_amount",
            "total_non_deductible_amount", "created_by", "posted_by",
            "posted_at", "created_at", "updated_at",
        )

    def validate(self, attrs):
        p_start = attrs.get("period_start", getattr(self.instance, "period_start", None))
        p_end = attrs.get("period_end", getattr(self.instance, "period_end", None))
        if p_start and p_end and p_end < p_start:
            raise serializers.ValidationError({"period_end": "Vui lòng chọn kỳ tính khấu hao hợp lệ."})
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
