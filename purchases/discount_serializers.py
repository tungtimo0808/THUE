from django.db import transaction
from rest_framework import serializers

from accounts_payable.models import SupplierInvoice
from general_ledger.models import Account, JournalEntry
from organization.models import Company

from .discount_services import invoice_status, number_for, save_lines
from .models import PurchaseDiscount, PurchaseDiscountLine


class PurchaseDiscountLineSerializer(serializers.ModelSerializer):
    debit_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all(), required=False)
    credit_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all(), required=False)
    rate_percent = serializers.DecimalField(max_digits=9, decimal_places=4, required=False)
    pre_tax_amount = serializers.DecimalField(max_digits=24, decimal_places=4, required=False)

    class Meta:
        model = PurchaseDiscountLine
        fields = "__all__"
        read_only_fields = ("id", "document", "item", "uom", "tax_rate", "tax_amount", "total_amount")


class PurchaseDiscountSerializer(serializers.ModelSerializer):
    lines = PurchaseDiscountLineSerializer(many=True)
    adjustment_invoice = serializers.PrimaryKeyRelatedField(queryset=SupplierInvoice.objects.all(), required=False, allow_null=True)

    class Meta:
        model = PurchaseDiscount
        fields = "__all__"
        read_only_fields = ("id", "company", "branch", "number", "status", "supplier", "supplier_invoice",
            "created_by", "submitted_at", "approved_at", "created_at", "updated_at", "version",
            "pre_tax_amount", "tax_amount", "total_amount", "adjustment_invoice_status", "journal_entry",
            "payable_adjustment", "payable_paid_before", "payable_netted_before", "posted_at",
            "workflow_snapshot", "approval_required")

    def validate(self, attrs):
        original = attrs.get("original_purchase", getattr(self.instance, "original_purchase", None))
        if not original or original.status != "POSTED" or original.purchase_type == "SERVICE":
            raise serializers.ValidationError({"original_purchase": "Chứng từ mua hàng chưa được ghi sổ hoặc không còn hiệu lực."})
        if self.instance and original.pk != self.instance.original_purchase_id:
            raise serializers.ValidationError({"original_purchase": "Không được thay đổi chứng từ mua gốc."})
        reason = attrs.get("reason", getattr(self.instance, "reason", ""))
        if not reason or not reason.strip() or len(reason) > 500:
            raise serializers.ValidationError({"reason": "Lý do giảm giá là bắt buộc, tối đa 500 ký tự."})
        if len(attrs.get("notes", getattr(self.instance, "notes", ""))) > 500:
            raise serializers.ValidationError({"notes": "Diễn giải tối đa 500 ký tự."})
        invoice = attrs.get("adjustment_invoice", getattr(self.instance, "adjustment_invoice", None))
        if invoice:
            if invoice.company_id != original.company_id or invoice.supplier_id != original.supplier_id or invoice.pk == original.supplier_invoice_id:
                raise serializers.ValidationError({"adjustment_invoice": "Hóa đơn điều chỉnh không thuộc Nhà cung cấp của chứng từ mua hàng."})
            used = PurchaseDiscount.objects.filter(adjustment_invoice=invoice)
            if self.instance:
                used = used.exclude(pk=self.instance.pk)
            if used.exists():
                raise serializers.ValidationError({"adjustment_invoice": "Hóa đơn điều chỉnh đã được sử dụng."})
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
            if attrs.get("method", self.instance.method) != self.instance.method:
                raise serializers.ValidationError({"lines": "Cần nhập lại chi tiết khi đổi phương pháp giảm giá."})
            return attrs
        if not lines:
            raise serializers.ValidationError({"lines": "Chứng từ phải có ít nhất một dòng giảm giá."})
        method = attrs.get("method", getattr(self.instance, "method", None))
        seen_numbers = set()
        seen_lines = set()
        for line in lines:
            source = line["original_line"]
            if source.purchase_id != original.pk or source.item.item_type == "SERVICE":
                raise serializers.ValidationError({"lines": "Dòng giảm giá phải thuộc chứng từ mua gốc."})
            if line["line_no"] in seen_numbers or source.pk in seen_lines:
                raise serializers.ValidationError({"lines": "Dòng giảm giá bị lặp."})
            seen_numbers.add(line["line_no"])
            seen_lines.add(source.pk)
            if method == "PERCENT":
                rate = line.get("rate_percent")
                if rate is None or rate <= 0 or rate > 100:
                    raise serializers.ValidationError({"lines": "Tỷ lệ giảm phải lớn hơn 0 và không vượt 100%."})
                if line.get("pre_tax_amount") is not None:
                    raise serializers.ValidationError({"lines": "Chỉ nhập tỷ lệ khi chọn giảm theo tỷ lệ."})
            elif method == "AMOUNT":
                if line.get("pre_tax_amount") is None or line["pre_tax_amount"] <= 0:
                    raise serializers.ValidationError({"lines": "Số tiền giảm phải lớn hơn 0."})
                if line.get("rate_percent") not in (None, 0):
                    raise serializers.ValidationError({"lines": "Chỉ nhập số tiền khi chọn giảm theo số tiền."})
            for name in ("debit_account", "credit_account"):
                account = line.get(name)
                if account and account.company_id != original.company_id:
                    raise serializers.ValidationError({"lines": "Tài khoản phải thuộc doanh nghiệp."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        original = validated_data["original_purchase"]
        Company.objects.select_for_update().get(pk=original.company_id)
        validated_data.update(company=original.company, branch=original.branch, supplier=original.supplier,
            supplier_invoice=original.supplier_invoice,
            number=number_for(original.company, validated_data["document_date"], original.branch))
        document = PurchaseDiscount.objects.create(**validated_data)
        save_lines(document, lines)
        return document

    @transaction.atomic
    def update(self, instance, validated_data):
        was_unposted = instance.status == "APPROVED" and JournalEntry.objects.filter(
            source_entity_type="PurchaseDiscount", source_entity_id=instance.pk, status="REVERSED").exists()
        invoice_only = instance.status == "APPROVED" and set(validated_data) == {"adjustment_invoice"}
        if instance.status not in {"DRAFT", "REVISION_REQUIRED"} and not was_unposted and not invoice_only:
            raise serializers.ValidationError("Chỉ chứng từ nháp hoặc yêu cầu chỉnh sửa mới được sửa.")
        lines = validated_data.pop("lines", None)
        validated_data.pop("original_purchase", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.version += 1
        instance.adjustment_invoice_status = invoice_status(instance)
        instance.save()
        if lines is not None:
            instance.lines.all().delete()
            save_lines(instance, lines)
        return instance
