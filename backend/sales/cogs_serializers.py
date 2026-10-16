from rest_framework import serializers

from general_ledger.models import Account
from inventory.models import InventoryTransaction, InventoryTransactionLine
from master_data.models import Item, Warehouse
from organization.models import Branch, Company
from sales import models


class CostOfGoodsSoldLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    cogs_account_code = serializers.CharField(source="cogs_account.code", read_only=True)
    cogs_account_name = serializers.CharField(source="cogs_account.name", read_only=True)
    inventory_account_code = serializers.CharField(source="inventory_account.code", read_only=True)
    inventory_account_name = serializers.CharField(source="inventory_account.name", read_only=True)
    transaction_number = serializers.CharField(source="inventory_transaction_line.transaction.number", read_only=True)

    class Meta:
        model = models.CostOfGoodsSoldLine
        fields = [
            "id",
            "line_no",
            "inventory_transaction_line",
            "transaction_number",
            "item",
            "item_code",
            "item_name",
            "warehouse",
            "warehouse_code",
            "warehouse_name",
            "uom",
            "uom_name",
            "quantity",
            "costing_method",
            "unit_cost",
            "cogs_amount",
            "cogs_account",
            "cogs_account_code",
            "cogs_account_name",
            "inventory_account",
            "inventory_account_code",
            "inventory_account_name",
            "costing_version",
            "source_status",
        ]


class CostOfGoodsSoldListSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True, default="")
    branch_name = serializers.CharField(source="branch.name", read_only=True, default="")
    journal_entry_number = serializers.CharField(source="journal_entry.number", read_only=True, default=None)
    created_by_name = serializers.CharField(source="created_by.display_name", read_only=True, default="")

    class Meta:
        model = models.CostOfGoodsSold
        fields = [
            "id",
            "number",
            "document_date",
            "posting_date",
            "costing_period",
            "branch",
            "branch_name",
            "warehouse",
            "warehouse_name",
            "description",
            "total_cogs_amount",
            "status",
            "journal_entry",
            "journal_entry_number",
            "version",
            "created_by_name",
            "created_at",
            "posted_at",
        ]


class CostOfGoodsSoldDetailSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True, default="")
    branch_name = serializers.CharField(source="branch.name", read_only=True, default="")
    journal_entry_number = serializers.CharField(source="journal_entry.number", read_only=True, default=None)
    created_by_name = serializers.CharField(source="created_by.display_name", read_only=True, default="")
    posted_by_name = serializers.CharField(source="posted_by.display_name", read_only=True, default="")
    lines = CostOfGoodsSoldLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.CostOfGoodsSold
        fields = [
            "id",
            "company",
            "branch",
            "branch_name",
            "warehouse",
            "warehouse_name",
            "number",
            "document_date",
            "posting_date",
            "costing_period",
            "inventory_transaction",
            "goods_sale",
            "currency",
            "exchange_rate",
            "description",
            "total_cogs_amount",
            "status",
            "journal_entry",
            "journal_entry_number",
            "version",
            "attachments",
            "cancellation_reason",
            "rejection_reason",
            "withdrawal_reason",
            "created_by",
            "created_by_name",
            "posted_by",
            "posted_by_name",
            "created_at",
            "updated_at",
            "submitted_at",
            "approved_at",
            "posted_at",
            "lines",
        ]


class CostOfGoodsSoldLineInputSerializer(serializers.Serializer):
    inventory_transaction_line = serializers.UUIDField()
    cogs_account = serializers.UUIDField(required=False, allow_null=True)
    inventory_account = serializers.UUIDField(required=False, allow_null=True)


class CostOfGoodsSoldCreateUpdateSerializer(serializers.Serializer):
    company = serializers.UUIDField()
    branch = serializers.UUIDField(required=False, allow_null=True)
    warehouse = serializers.UUIDField(required=False, allow_null=True)
    document_date = serializers.DateField(required=False)
    posting_date = serializers.DateField(required=False)
    costing_period = serializers.CharField(required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="Ghi nhận giá vốn hàng bán")
    inventory_transaction = serializers.UUIDField(required=False, allow_null=True)
    goods_sale = serializers.UUIDField(required=False, allow_null=True)
    attachments = serializers.ListField(required=False, default=list)
    version = serializers.IntegerField(required=False)
    lines = CostOfGoodsSoldLineInputSerializer(many=True)


class CancelActionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, allow_blank=False, max_length=500)


class CommentActionSerializer(serializers.Serializer):
    comment = serializers.CharField(required=True, allow_blank=False, max_length=1000)


class OptionalCommentActionSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="")
