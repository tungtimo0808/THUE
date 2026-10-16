from decimal import Decimal
from rest_framework import serializers

from sales import models


class SalesDocumentLinkLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    source_uom_name = serializers.CharField(source="source_uom.name", read_only=True)
    target_uom_name = serializers.CharField(source="target_uom.name", read_only=True)

    class Meta:
        model = models.SalesDocumentLinkLine
        fields = [
            "id",
            "line_no",
            "source_line_id",
            "target_line_id",
            "item",
            "item_code",
            "item_name",
            "source_uom",
            "source_uom_name",
            "target_uom",
            "target_uom_name",
            "conversion_rate",
            "linked_quantity",
            "linked_amount",
            "notes",
        ]


class SalesDocumentLinkDetailSerializer(serializers.ModelSerializer):
    lines = SalesDocumentLinkLineSerializer(many=True, read_only=True)
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    relation_type_display = serializers.CharField(source="get_relation_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    link_mode_display = serializers.CharField(source="get_link_mode_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    unlinked_by_name = serializers.SerializerMethodField()

    class Meta:
        model = models.SalesDocumentLink
        fields = [
            "id",
            "company",
            "link_number",
            "source_document_type",
            "source_document_id",
            "source_document_number",
            "target_document_type",
            "target_document_id",
            "target_document_number",
            "relation_type",
            "relation_type_display",
            "customer",
            "customer_code",
            "customer_name",
            "currency",
            "currency_code",
            "notes",
            "status",
            "status_display",
            "link_mode",
            "link_mode_display",
            "created_by",
            "created_by_name",
            "created_at",
            "unlinked_by",
            "unlinked_by_name",
            "unlinked_at",
            "unlinked_reason",
            "version",
            "lines",
        ]

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ""
        return obj.created_by.display_name or getattr(getattr(obj.created_by, "auth_user", None), "username", "")

    def get_unlinked_by_name(self, obj):
        if not obj.unlinked_by:
            return ""
        return obj.unlinked_by.display_name or getattr(getattr(obj.unlinked_by, "auth_user", None), "username", "")


class SalesDocumentLinkListSerializer(serializers.ModelSerializer):
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    relation_type_display = serializers.CharField(source="get_relation_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    link_mode_display = serializers.CharField(source="get_link_mode_display", read_only=True)
    line_count = serializers.IntegerField(source="lines.count", read_only=True)

    class Meta:
        model = models.SalesDocumentLink
        fields = [
            "id",
            "company",
            "link_number",
            "source_document_type",
            "source_document_id",
            "source_document_number",
            "target_document_type",
            "target_document_id",
            "target_document_number",
            "relation_type",
            "relation_type_display",
            "customer",
            "customer_code",
            "customer_name",
            "currency",
            "currency_code",
            "notes",
            "status",
            "status_display",
            "link_mode",
            "link_mode_display",
            "line_count",
            "created_at",
            "unlinked_at",
            "unlinked_reason",
            "version",
        ]


class SalesDocumentLinkCreateLineSerializer(serializers.Serializer):
    source_line_id = serializers.UUIDField(required=False, allow_null=True)
    target_line_id = serializers.UUIDField(required=False, allow_null=True)
    conversion_rate = serializers.DecimalField(max_digits=20, decimal_places=8, default=Decimal(1))
    linked_quantity = serializers.DecimalField(max_digits=22, decimal_places=6, required=False, allow_null=True)
    linked_amount = serializers.DecimalField(max_digits=24, decimal_places=4, required=False, allow_null=True)
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class SalesDocumentLinkCreateSerializer(serializers.Serializer):
    company = serializers.UUIDField(required=False)
    company_id = serializers.UUIDField(required=False)
    source_document_type = serializers.CharField(max_length=30)
    source_document_id = serializers.UUIDField()
    target_document_type = serializers.CharField(max_length=30)
    target_document_id = serializers.UUIDField()
    relation_type = serializers.ChoiceField(choices=models.LinkRelationType.choices)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    link_mode = serializers.ChoiceField(choices=models.LinkMode.choices, default=models.LinkMode.MANUAL)
    lines = SalesDocumentLinkCreateLineSerializer(many=True, required=False, default=list)


class SalesDocumentLinkUnlinkSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500, required=True, allow_blank=False)
