from rest_framework import serializers

from .goods_serializers import GoodsPurchaseLineSerializer, GoodsPurchaseSerializer


class ServicePurchaseLineSerializer(GoodsPurchaseLineSerializer):
    pass


class ServicePurchaseSerializer(GoodsPurchaseSerializer):
    purchase_type = serializers.ChoiceField(choices=("SERVICE",), default="SERVICE")
    lines = ServicePurchaseLineSerializer(many=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get("purchase_type", getattr(self.instance, "purchase_type", None)) != "SERVICE":
            raise serializers.ValidationError({"purchase_type": "Loại chứng từ không hợp lệ."})
        if attrs.get("inventory_transaction"):
            raise serializers.ValidationError({"inventory_transaction": "Mua dịch vụ không phát sinh nhập kho."})
        lines = attrs.get("lines")
        if lines is None and self.instance:
            return attrs
        for line in lines:
            item = line["item"]
            if item.item_type != "SERVICE":
                raise serializers.ValidationError({"lines": "Chỉ được chọn danh mục dịch vụ."})
            if line.get("service_from") and line.get("service_to") and line["service_to"] < line["service_from"]:
                raise serializers.ValidationError({"lines": "Ngày kết thúc dịch vụ không được trước ngày bắt đầu."})
            if line.get("description") and len(line["description"]) > 500:
                raise serializers.ValidationError({"lines": "Diễn giải dòng tối đa 500 ký tự."})
        return attrs
