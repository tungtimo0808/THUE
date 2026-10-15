from decimal import Decimal
from rest_framework import serializers


SALES_DOCUMENT_TYPE_CHOICES = [
    ("QUOTATION", "Báo giá"),
    ("ORDER", "Đơn bán hàng"),
    ("CONTRACT", "Hợp đồng bán"),
    ("GOODS_SALE", "Bán hàng hóa"),
    ("SERVICE_SALE", "Bán dịch vụ"),
    ("SALES_RETURN", "Hàng bán trả lại"),
    ("SALES_ALLOWANCE", "Giảm giá hàng bán"),
    ("SALES_INVOICE", "Hóa đơn đầu ra"),
    ("DISCOUNT_INVOICE", "Hóa đơn chiết khấu"),
    ("COMMERCIAL_INVOICE", "Hóa đơn thương mại"),
]

SALES_DOCUMENT_TYPE_KEYS = [choice[0] for choice in SALES_DOCUMENT_TYPE_CHOICES]


class ApprovalPendingItemSerializer(serializers.Serializer):
    document_type = serializers.CharField()
    document_type_name = serializers.CharField()
    document_id = serializers.CharField()
    number = serializers.CharField()
    document_date = serializers.CharField()
    creator_id = serializers.CharField(allow_null=True)
    creator_name = serializers.CharField(allow_blank=True)
    customer_id = serializers.CharField(allow_null=True)
    customer_name = serializers.CharField(allow_blank=True)
    customer_code = serializers.CharField(allow_blank=True)
    branch_id = serializers.CharField(allow_null=True)
    branch_name = serializers.CharField(allow_blank=True)
    currency_code = serializers.CharField(allow_blank=True)
    total_amount = serializers.CharField()
    current_level = serializers.IntegerField()
    total_levels = serializers.IntegerField()
    submitted_at = serializers.CharField()
    version = serializers.IntegerField()
    status = serializers.CharField()
    due_date = serializers.CharField(allow_null=True, required=False)
    notes = serializers.CharField(allow_blank=True)


class ApprovalDecisionInputSerializer(serializers.Serializer):
    company_id = serializers.UUIDField(required=True)
    document_type = serializers.ChoiceField(
        choices=SALES_DOCUMENT_TYPE_KEYS,
        required=True,
    )
    document_id = serializers.UUIDField(required=True)
    action = serializers.ChoiceField(
        choices=["APPROVE", "REQUEST_REVISION", "REJECT"],
        required=True,
    )
    comment = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=500,
    )
    version = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        action = attrs.get("action")
        comment = (attrs.get("comment") or "").strip()
        attrs["comment"] = comment

        if action == "REQUEST_REVISION" and not comment:
            raise serializers.ValidationError({"comment": "Vui lòng nhập nội dung yêu cầu chỉnh sửa."})
        if action == "REJECT" and not comment:
            raise serializers.ValidationError({"comment": "Vui lòng nhập lý do từ chối."})
        if len(comment) > 500:
            if action == "REQUEST_REVISION":
                raise serializers.ValidationError({"comment": "Nội dung yêu cầu chỉnh sửa tối đa 500 ký tự."})
            elif action == "REJECT":
                raise serializers.ValidationError({"comment": "Lý do từ chối tối đa 500 ký tự."})
            else:
                raise serializers.ValidationError({"comment": "Ý kiến phê duyệt tối đa 500 ký tự."})
        return attrs


class ApprovalWithdrawInputSerializer(serializers.Serializer):
    company_id = serializers.UUIDField(required=True)
    document_type = serializers.ChoiceField(
        choices=SALES_DOCUMENT_TYPE_KEYS,
        required=True,
    )
    document_id = serializers.UUIDField(required=True)
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=500,
    )
    version = serializers.IntegerField(required=False, allow_null=True)


class ApprovalDecisionResultSerializer(serializers.Serializer):
    message = serializers.CharField()
    status = serializers.CharField()
    document_id = serializers.CharField()
    document_type = serializers.CharField()
    version = serializers.IntegerField()


class ApprovalHistorySerializer(serializers.Serializer):
    id = serializers.CharField()
    level = serializers.IntegerField()
    decision = serializers.CharField()
    decision_name = serializers.CharField()
    actor_id = serializers.CharField()
    actor_name = serializers.CharField()
    comment = serializers.CharField(allow_blank=True)
    decided_at = serializers.CharField()
    document_version = serializers.IntegerField()
    workflow_version = serializers.CharField(allow_blank=True)
