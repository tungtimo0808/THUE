from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from rest_framework import serializers

from general_ledger.models import Account
from general_ledger.models import JournalEntry
from organization.models import Company
from .models import GoodsPurchase, PurchaseReturn, PurchaseReturnLine

MONEY = Decimal("0.0001")


class PurchaseReturnLineSerializer(serializers.ModelSerializer):
    debit_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all(), required=False)
    credit_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all(), required=False)

    class Meta:
        model = PurchaseReturnLine
        fields = "__all__"
        read_only_fields = ("id", "document", "item", "uom", "unit_price", "discount_rate", "tax_rate",
                            "discount_amount", "pre_tax_amount",
                            "tax_amount", "total_amount")


class PurchaseReturnSerializer(serializers.ModelSerializer):
    lines = PurchaseReturnLineSerializer(many=True)

    class Meta:
        model = PurchaseReturn
        fields = "__all__"
        read_only_fields = ("id", "company", "branch", "number", "status", "supplier", "supplier_invoice",
                            "created_by", "submitted_at", "approved_at", "created_at", "updated_at",
                            "version", "subtotal", "discount_amount", "tax_amount", "total_amount",
                            "adjustment_invoice_status", "issue_created", "journal_entry",
                            "payable_adjustment", "payable_paid_before", "payable_netted_before",
                            "posted_at", "workflow_snapshot", "approval_required")

    def validate(self, attrs):
        original = attrs.get("original_purchase", getattr(self.instance, "original_purchase", None))
        if not original or original.status != "POSTED" or original.purchase_type == "SERVICE":
            raise serializers.ValidationError({"original_purchase": "Chứng từ mua hàng chưa được ghi sổ hoặc không còn hiệu lực."})
        if self.instance and original.pk != self.instance.original_purchase_id:
            raise serializers.ValidationError({"original_purchase": "Không được thay đổi chứng từ mua gốc."})
        reason = attrs.get("reason", getattr(self.instance, "reason", ""))
        if not reason or not reason.strip() or len(reason) > 500:
            raise serializers.ValidationError({"reason": "Lý do trả lại là bắt buộc, tối đa 500 ký tự."})
        if len(attrs.get("notes", getattr(self.instance, "notes", ""))) > 500:
            raise serializers.ValidationError({"notes": "Diễn giải tối đa 500 ký tự."})
        warehouse = attrs.get("warehouse", getattr(self.instance, "warehouse", None))
        if original.purchase_type == "WAREHOUSE" and not warehouse:
            raise serializers.ValidationError({"warehouse": "Kho xuất trả là bắt buộc."})
        if original.purchase_type == "DIRECT" and warehouse:
            raise serializers.ValidationError({"warehouse": "Hàng mua không qua kho không được chọn kho."})
        if warehouse and (warehouse.company_id != original.company_id or warehouse.branch_id not in (None, original.branch_id)):
            raise serializers.ValidationError({"warehouse": "Kho xuất trả không cùng phạm vi."})
        issue = attrs.get("issue_transaction", getattr(self.instance, "issue_transaction", None))
        if issue and (original.purchase_type != "WAREHOUSE" or issue.company_id != original.company_id or
                      issue.branch_id != original.branch_id or issue.supplier_id != original.supplier_id or
                      issue.transaction_type != "ISSUE" or issue.status != "POSTED"):
            raise serializers.ValidationError({"issue_transaction": "Phiếu xuất kho không hợp lệ."})
        attachments = attrs.get("attachments", getattr(self.instance, "attachments", []))
        for attachment in attachments:
            try:
                valid_size = 0 <= int(attachment.get("size", -1)) <= 10 * 1024 * 1024
            except (AttributeError, TypeError, ValueError):
                valid_size = False
            if not isinstance(attachment, dict) or str(attachment.get("name", "")).rsplit(".", 1)[-1].lower() not in {"pdf", "docx", "xlsx", "png", "jpg", "jpeg"} or not valid_size:
                raise serializers.ValidationError({"attachments": "Tệp phải đúng định dạng và không vượt quá 10 MB."})
        lines = attrs.get("lines")
        if lines is None and self.instance:
            return attrs
        if not lines:
            raise serializers.ValidationError({"lines": "Chứng từ phải có ít nhất một dòng hàng trả lại."})
        seen = set()
        for line in lines:
            source = line["original_line"]
            if source.purchase_id != original.pk or source.item.item_type == "SERVICE":
                raise serializers.ValidationError({"lines": "Dòng hàng phải thuộc chứng từ mua gốc."})
            if line["line_no"] in seen:
                raise serializers.ValidationError({"lines": "Số dòng phải duy nhất."})
            seen.add(line["line_no"])
            if line["quantity"] <= 0:
                raise serializers.ValidationError({"lines": "Số lượng trả lại phải lớn hơn 0."})
            for account_name in ("debit_account", "credit_account"):
                account = line.get(account_name)
                if account and account.company_id != original.company_id:
                    raise serializers.ValidationError({"lines": "Tài khoản phải thuộc doanh nghiệp."})
            line_warehouse = line.get("warehouse")
            if original.purchase_type == "WAREHOUSE" and line_warehouse and line_warehouse.pk != warehouse.pk:
                raise serializers.ValidationError({"lines": "Các dòng trả lại phải cùng kho xuất."})
            if original.purchase_type == "DIRECT" and line_warehouse:
                raise serializers.ValidationError({"lines": "Hàng không qua kho không được chọn kho."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        from .return_services import number_for, save_lines
        lines = validated_data.pop("lines")
        original = validated_data["original_purchase"]
        Company.objects.select_for_update().get(pk=original.company_id)
        validated_data.update(company=original.company, branch=original.branch, supplier=original.supplier,
                              supplier_invoice=original.supplier_invoice,
                              number=number_for(original.company, validated_data["document_date"], original.branch))
        document = PurchaseReturn.objects.create(**validated_data)
        save_lines(document, lines)
        return document

    @transaction.atomic
    def update(self, instance, validated_data):
        from .return_services import save_lines
        was_unposted = instance.status == "APPROVED" and JournalEntry.objects.filter(
            source_entity_type="PurchaseReturn", source_entity_id=instance.pk, status="REVERSED").exists()
        if instance.status not in {"DRAFT", "REVISION_REQUIRED"} and not was_unposted:
            raise serializers.ValidationError("Chỉ chứng từ nháp hoặc yêu cầu chỉnh sửa mới được sửa.")
        lines = validated_data.pop("lines", None)
        validated_data.pop("original_purchase", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.version += 1
        instance.save()
        if lines is not None:
            instance.lines.all().delete()
            save_lines(instance, lines)
        return instance
