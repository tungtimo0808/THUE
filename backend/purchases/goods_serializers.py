from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta

from django.db import transaction
from django.utils.dateparse import parse_date
from rest_framework import serializers

from .models import GoodsPurchase, GoodsPurchaseLine

MONEY = Decimal("0.0001")


class GoodsPurchaseLineSerializer(serializers.ModelSerializer):
    returned_pre_tax_amount = serializers.DecimalField(max_digits=24, decimal_places=4, read_only=True)
    discounted_pre_tax_amount = serializers.DecimalField(max_digits=24, decimal_places=4, read_only=True)
    remaining_discountable_amount = serializers.DecimalField(max_digits=24, decimal_places=4, read_only=True)

    class Meta:
        model = GoodsPurchaseLine
        fields = "__all__"
        read_only_fields = ("id", "purchase", "discount_amount", "pre_tax_amount", "tax_amount", "total_amount")


class GoodsPurchaseSerializer(serializers.ModelSerializer):
    lines = GoodsPurchaseLineSerializer(many=True)
    number = serializers.CharField(required=False, allow_blank=True, max_length=80)

    class Meta:
        model = GoodsPurchase
        fields = "__all__"
        validators = []  # Number is generated during create; duplicate numbers are checked in validate().
        read_only_fields = ("id", "status", "created_by", "approved_at", "submitted_at", "created_at", "updated_at", "version", "subtotal", "discount_amount", "tax_amount", "total_amount", "invoice_status", "inventory_created", "journal_entry", "posted_at", "workflow_snapshot", "approval_required", "order_status_before", "order_receiving_status_before")

    def validate(self, attrs):
        purchase = self.instance
        company = attrs.get("company", getattr(purchase, "company", None))
        branch = attrs.get("branch", getattr(purchase, "branch", None))
        supplier = attrs.get("supplier", getattr(purchase, "supplier", None))
        order = attrs.get("purchase_order", getattr(purchase, "purchase_order", None))
        kind = attrs.get("purchase_type", getattr(purchase, "purchase_type", None))
        if kind == "SERVICE" and self.__class__ is GoodsPurchaseSerializer:
            raise serializers.ValidationError({"purchase_type": "Dùng API mua dịch vụ."})
        warehouse = attrs.get("receiving_warehouse", getattr(purchase, "receiving_warehouse", None))
        if not company or not branch or not supplier:
            raise serializers.ValidationError("Doanh nghiệp, chi nhánh và nhà cung cấp là bắt buộc.")
        if branch.company_id != company.id or supplier.company_id != company.id:
            raise serializers.ValidationError("Chi nhánh và nhà cung cấp phải thuộc doanh nghiệp.")
        number = str(attrs.get("number") or "").strip()
        if number and GoodsPurchase.objects.filter(company=company, number=number).exclude(pk=getattr(purchase, "pk", None)).exists():
            raise serializers.ValidationError({"number": "Số phiếu nhập đã tồn tại."})
        if "number" in attrs:
            attrs["number"] = number or (getattr(purchase, "number", "") if purchase else "")
        details = attrs.get("invoice_details", getattr(purchase, "invoice_details", {})) or {}
        if not isinstance(details, dict):
            raise serializers.ValidationError({"invoice_details": "Thông tin hóa đơn không hợp lệ."})
        if details.get("received"):
            if not str(details.get("number") or "").strip() or not str(details.get("series") or "").strip():
                raise serializers.ValidationError({"invoice_details": "Vui lòng nhập ký hiệu và số hóa đơn."})
            invoice_date = parse_date(str(details.get("date") or ""))
            if not invoice_date:
                raise serializers.ValidationError({"invoice_details": "Ngày hóa đơn không hợp lệ."})
            details = {"received": True, "template": str(details.get("template") or "")[:50],
                       "series": str(details["series"]).strip()[:80], "number": str(details["number"]).strip()[:80],
                       "date": str(invoice_date)}
        else:
            details = {"received": False}
        attrs["invoice_details"] = details
        debt_days = attrs.get("debt_days", getattr(purchase, "debt_days", None))
        due_date = attrs.get("payment_due_date", getattr(purchase, "payment_due_date", None))
        if debt_days is not None and debt_days > 3650:
            raise serializers.ValidationError({"debt_days": "Số ngày được nợ không hợp lệ."})
        if debt_days is not None and not due_date:
            attrs["payment_due_date"] = attrs.get("document_date", purchase.document_date if purchase else None) + timedelta(days=debt_days)
        if kind == "WAREHOUSE" and not warehouse:
            raise serializers.ValidationError({"receiving_warehouse": "Kho nhận là bắt buộc."})
        if warehouse and (warehouse.company_id != company.id or warehouse.branch_id not in (None, branch.id)):
            raise serializers.ValidationError({"receiving_warehouse": "Kho nhận không cùng phạm vi."})
        if kind in ("DIRECT", "SERVICE") and warehouse:
            raise serializers.ValidationError({"receiving_warehouse": "Mua không qua kho không được chọn kho."})
        if order and (order.company_id != company.id or order.branch_id != branch.id or order.supplier_id != supplier.id):
            raise serializers.ValidationError({"purchase_order": "Đơn mua không khớp doanh nghiệp, chi nhánh hoặc nhà cung cấp."})
        invoice = attrs.get("supplier_invoice", getattr(purchase, "supplier_invoice", None))
        if invoice and (invoice.company_id != company.id or invoice.supplier_id != supplier.id):
            raise serializers.ValidationError({"supplier_invoice": "Hóa đơn không khớp nhà cung cấp."})
        payment = attrs.get("payment", getattr(purchase, "payment", None))
        payment_type = attrs.get("payment_type", getattr(purchase, "payment_type", None))
        if payment_type == "IMMEDIATE" and not payment:
            raise serializers.ValidationError({"payment": "Thanh toán ngay phải liên kết chứng từ thanh toán."})
        if payment and (payment.company_id != company.id or payment.supplier_id != supplier.id or payment.status != "CONFIRMED"):
            raise serializers.ValidationError({"payment": "Chứng từ thanh toán không hợp lệ."})
        receipt = attrs.get("inventory_transaction", getattr(purchase, "inventory_transaction", None))
        if receipt and (kind != "WAREHOUSE" or receipt.company_id != company.id or receipt.branch_id != branch.id or
                        receipt.supplier_id != supplier.id or receipt.transaction_type != "RECEIPT" or receipt.status != "POSTED"):
            raise serializers.ValidationError({"inventory_transaction": "Phiếu nhập kho không hợp lệ."})
        if len(attrs.get("notes", getattr(purchase, "notes", ""))) > 500:
            raise serializers.ValidationError({"notes": "Diễn giải tối đa 500 ký tự."})
        attachments = attrs.get("attachments", getattr(purchase, "attachments", []))
        for attachment in attachments:
            if not isinstance(attachment, dict) or str(attachment.get("name", "")).rsplit(".", 1)[-1].lower() not in {"pdf", "docx", "xlsx", "png", "jpg", "jpeg"} or int(attachment.get("size", 0)) > 10 * 1024 * 1024:
                raise serializers.ValidationError({"attachments": "Tệp phải đúng định dạng và không vượt quá 10 MB."})
        lines = attrs.get("lines")
        if lines is None and purchase:
            return attrs
        if not lines:
            raise serializers.ValidationError({"lines": "Chứng từ mua hàng phải có ít nhất một dòng hàng."})
        seen = set()
        for line in lines:
            if line["line_no"] in seen:
                raise serializers.ValidationError({"lines": "Số thứ tự dòng phải duy nhất."})
            seen.add(line["line_no"])
            for key in ("item", "uom", "warehouse", "tax_rate", "debit_account", "credit_account", "expense_item", "statistical_code", "department"):
                value = line.get(key)
                if value and getattr(value, "company_id", company.id) != company.id:
                    raise serializers.ValidationError({"lines": f"{key} phải thuộc doanh nghiệp."})
            item = line["item"]
            if not item.allow_purchase or item.status != "ACTIVE" or line["uom"].status != "ACTIVE":
                raise serializers.ValidationError({"lines": "Hàng hóa hoặc đơn vị tính không hoạt động."})
            if line["uom"].id != item.base_uom_id:
                raise serializers.ValidationError({"lines": "Hiện chỉ hỗ trợ đơn vị tính cơ sở của hàng hóa."})
            if kind == "WAREHOUSE" and not (line.get("warehouse") or warehouse):
                raise serializers.ValidationError({"lines": "Dòng mua qua kho thiếu kho."})
            if kind == "WAREHOUSE" and not item.track_inventory:
                raise serializers.ValidationError({"lines": "Hàng hóa không được theo dõi tồn kho."})
            if kind == "WAREHOUSE" and line.get("warehouse") and line["warehouse"].id != warehouse.id:
                raise serializers.ValidationError({"lines": "Một chứng từ nhập kho chỉ được chọn một kho nhận."})
            if kind in ("DIRECT", "SERVICE") and line.get("warehouse"):
                raise serializers.ValidationError({"lines": "Dòng mua không qua kho không được chọn kho."})
            if line["quantity"] <= 0:
                raise serializers.ValidationError({"lines": "Số lượng mua phải lớn hơn 0."})
            if line["unit_price"] < 0 or not 0 <= line.get("discount_rate", 0) <= 100:
                raise serializers.ValidationError({"lines": "Đơn giá hoặc chiết khấu không hợp lệ."})
            if kind == "WAREHOUSE" and line["unit_price"] == 0:
                raise serializers.ValidationError({"lines": "Đơn giá nhập kho phải lớn hơn 0."})
            for key in ("debit_account", "credit_account"):
                account = line[key]
                if account.status != "ACTIVE" or not account.is_postable:
                    raise serializers.ValidationError({"lines": "Tài khoản hạch toán không hợp lệ."})
            order_line = line.get("order_line")
            if order_line and (not order or order_line.order_id != order.id or order_line.item_id != item.id or order_line.uom_id != line["uom"].id):
                raise serializers.ValidationError({"lines": "Dòng đơn mua không khớp chứng từ."})
            if order and not order_line:
                raise serializers.ValidationError({"lines": "Dòng chứng từ phải liên kết dòng đơn mua."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        from .goods_services import number_for, save_lines
        lines = validated_data.pop("lines")
        company = validated_data["company"]
        from organization.models import Company
        Company.objects.select_for_update().get(pk=company.pk)
        validated_data["number"] = validated_data.get("number") or number_for(company, validated_data["document_date"], validated_data["branch"], validated_data["purchase_type"])
        purchase = GoodsPurchase.objects.create(**validated_data)
        save_lines(purchase, lines)
        return purchase

    @transaction.atomic
    def update(self, instance, validated_data):
        from .goods_services import save_lines
        if instance.status not in ("DRAFT", "REVISION_REQUIRED"):
            raise serializers.ValidationError("Chỉ chứng từ nháp hoặc yêu cầu chỉnh sửa mới được sửa.")
        if validated_data.get("company") and validated_data["company"].pk != instance.company_id:
            raise serializers.ValidationError("Không được đổi doanh nghiệp của chứng từ.")
        lines = validated_data.pop("lines", None)
        validated_data.pop("company", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.version += 1
        instance.save()
        if lines is not None:
            instance.lines.all().delete()
            save_lines(instance, lines)
        elif "supplier_invoice" in validated_data:
            instance.invoice_status = ("INVOICED" if instance.supplier_invoice.total_amount == instance.total_amount else "PARTIALLY_INVOICED") if instance.supplier_invoice_id else "NOT_INVOICED"
            instance.save(update_fields=("invoice_status", "updated_at"))
        return instance
