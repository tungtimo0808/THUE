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


class RevaluationMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.RevaluationMember
        fields = ("id", "line_no", "full_name", "title", "representing")
        read_only_fields = ("id", "line_no")
        extra_kwargs = {"full_name": {"allow_blank": True}, "title": {"allow_blank": True}, "representing": {"allow_blank": True}}


class RevaluationLineSerializer(serializers.ModelSerializer):
    asset_code = serializers.CharField(source="asset.code", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    department_name = serializers.CharField(source="asset.department.name", read_only=True, default="")
    expense_account_code = serializers.CharField(source="expense_account.code", read_only=True, default="")
    revaluation_account_code = serializers.CharField(source="revaluation_account.code", read_only=True, default="")

    class Meta:
        model = models.RevaluationLine
        exclude = ("revaluation",)
        read_only_fields = ("id", "line_no", "before_snapshot", "asset_transaction")


class RevaluationEntrySerializer(serializers.ModelSerializer):
    debit_account_code = serializers.CharField(source="debit_account.code", read_only=True)
    credit_account_code = serializers.CharField(source="credit_account.code", read_only=True)
    party_code = serializers.CharField(source="party.code", read_only=True, default="")
    party_name = serializers.CharField(source="party.name", read_only=True, default="")
    expense_item_code = serializers.CharField(source="expense_item.code", read_only=True, default="")
    department_name = serializers.CharField(source="department.name", read_only=True, default="")

    class Meta:
        model = models.RevaluationEntry
        exclude = ("revaluation",)
        read_only_fields = ("id", "line_no")


class RevaluationSerializer(serializers.ModelSerializer):
    """UC-FA-06 document; every save runs the full rule check of `revaluation.check` in the same transaction."""
    members = RevaluationMemberSerializer(many=True, required=False)
    lines = RevaluationLineSerializer(many=True, required=False)
    entries = RevaluationEntrySerializer(many=True, required=False)
    reason_label = serializers.CharField(source="get_reason_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    journal_entry_number = serializers.CharField(source="journal_entry.number", read_only=True, default="")
    totals = serializers.SerializerMethodField()

    class Meta:
        model = models.AssetRevaluation
        fields = "__all__"
        read_only_fields = ("id", "status", "journal_entry", "attachments", "created_by", "posted_by", "posted_at",
            "reversed_at", "reversal_reason", "created_at", "updated_at")
        extra_kwargs = {"effective_date": {"required": False}, "document_date": {"required": False}, "posting_date": {"required": False}}
        validators = []

    def get_totals(self, obj):
        # Step 33: value differences only; the change of remaining life is not money (BR27).
        lines = obj.lines.all()
        cost = sum((line.after_original_cost - line.before_original_cost for line in lines), 0)
        accumulated = sum((line.after_accumulated_depreciation - line.before_accumulated_depreciation for line in lines), 0)
        depreciable = sum((line.after_depreciable_value - line.before_depreciable_value for line in lines), 0)
        return {"original_cost": str(cost), "accumulated_depreciation": str(accumulated),
            "remaining_value": str(cost - accumulated), "depreciable_value": str(depreciable)}

    def to_internal_value(self, data):
        from .revaluation import MESSAGES
        for field, code in (("number", "EF02"), ("reason", "EF07")):
            if field in data and not str(data.get(field) or "").strip():
                raise serializers.ValidationError({field: MESSAGES[code]})
        if not self.instance:
            for field, code in (("number", "EF02"), ("reason", "EF07"), ("document_date", "EF05"), ("posting_date", "EF05")):
                if not data.get(field):
                    raise serializers.ValidationError({field: MESSAGES[code]})
        try:
            return super().to_internal_value(data)
        except serializers.ValidationError as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            if "document_date" in detail or "posting_date" in detail:
                raise serializers.ValidationError({"document_date": MESSAGES["EF05"]})
            if "record_date" in detail:
                raise serializers.ValidationError({"record_date": MESSAGES["EF04"]})
            if "reason" in detail:
                raise serializers.ValidationError({"reason": MESSAGES["EF07"]})
            raise

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.status != "DRAFT":
            # AF28: a posted document is corrected by unposting, never by editing it in place.
            raise serializers.ValidationError("Chứng từ đã ghi sổ không được sửa trực tiếp. Vui lòng bỏ ghi sổ trước khi điều chỉnh.")
        record_date = attrs.get("record_date", getattr(instance, "record_date", None))
        posting_date = attrs.get("posting_date", getattr(instance, "posting_date", None))
        if not attrs.get("effective_date"):
            # Step 5: without a separate effective date the valuation date applies.
            attrs["effective_date"] = record_date or posting_date
        attrs["references"] = [str(value).strip()[:100] for value in attrs.get("references", getattr(instance, "references", []) or []) if str(value).strip()]
        number = attrs.get("number", getattr(instance, "number", ""))
        company = attrs.get("company", getattr(instance, "company", None))
        if models.AssetRevaluation.objects.filter(company=company, number=number).exclude(pk=getattr(instance, "pk", None)).exists():
            from .revaluation import MESSAGES
            raise serializers.ValidationError({"number": MESSAGES["EF02"]})
        seen = set()
        for line in attrs.get("lines") or []:
            if line["asset"].pk in seen:
                from .revaluation import MESSAGES
                raise serializers.ValidationError({"lines": MESSAGES["EF14"].format(code=line["asset"].code)})
            seen.add(line["asset"].pk)
        return attrs

    def _save_children(self, revaluation, members, lines, entries):
        from .revaluation import check
        if members is not None:
            revaluation.members.all().delete()
            for index, row in enumerate(members, start=1):
                models.RevaluationMember.objects.create(revaluation=revaluation, line_no=index, **row)
        if lines is not None:
            revaluation.lines.all().delete()
            for index, row in enumerate(lines, start=1):
                models.RevaluationLine.objects.create(revaluation=revaluation, line_no=index, **row)
        if entries is not None:
            revaluation.entries.all().delete()
            for index, row in enumerate(entries, start=1):
                models.RevaluationEntry.objects.create(revaluation=revaluation, line_no=index, **row)
        check(revaluation, self.context["request"])

    def create(self, validated_data):
        from django.db import transaction
        from django.db import IntegrityError
        members, lines, entries = (validated_data.pop(key, []) for key in ("members", "lines", "entries"))
        try:
            with transaction.atomic():
                revaluation = models.AssetRevaluation.objects.create(**validated_data)
                self._save_children(revaluation, members, lines, entries)
        except IntegrityError:
            # BR05: two users saving the same number at the same time.
            from .revaluation import MESSAGES
            raise serializers.ValidationError({"number": MESSAGES["EF02"]})
        return revaluation

    def update(self, instance, validated_data):
        from django.db import transaction
        members, lines, entries = (validated_data.pop(key, None) for key in ("members", "lines", "entries"))
        with transaction.atomic():
            instance = super().update(instance, validated_data)
            self._save_children(instance, members, lines, entries)
        return instance
