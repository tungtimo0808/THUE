from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import F
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from master_data.models import validate_uom_quantity
from master_data.payment_terms import validate_payment_term_selection
from master_data.payment_methods import prepare_document_method

from . import models


def validate_model(instance, *, exclude=()):
    try:
        instance.full_clean(exclude=exclude)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.message_dict) from exc


def validate_catalog(company, *, quantity=None, **values):
    errors = {}
    for name, value in values.items():
        if value and getattr(value, "company_id", None) != company.id:
            errors[name] = "Dữ liệu phải thuộc cùng doanh nghiệp."
        elif value and hasattr(value, "status") and value.status != "ACTIVE":
            errors[name] = "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."
        elif name == "item" and value and not value.allow_purchase:
            errors[name] = "Hàng hóa hoặc dịch vụ này không được phép mua."
    if errors:
        raise serializers.ValidationError(errors)
    if quantity is not None and values.get("uom"):
        try:
            validate_uom_quantity(values["uom"], quantity)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"quantity": exc.messages}) from exc


class PurchaseRequestLineSerializer(serializers.ModelSerializer):
    remaining_quantity = serializers.DecimalField(max_digits=20, decimal_places=6, read_only=True)
    estimated_amount = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    required_date = serializers.DateField(required=False, allow_null=True)
    estimated_unit_price = serializers.DecimalField(max_digits=20, decimal_places=4, required=False, allow_null=True, default=0)
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        default="",
        error_messages={"max_length": "Ghi chú không được vượt quá 500 ký tự."},
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        default="",
        error_messages={"max_length": "Diễn giải không được vượt quá 500 ký tự."},
    )

    class Meta:
        model = models.PurchaseRequestLine
        fields = "__all__"
        read_only_fields = ("id", "request", "ordered_quantity", "remaining_quantity", "estimated_amount")

    def validate_quantity(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Số lượng yêu cầu phải lớn hơn 0.")
        d = Decimal(str(value))
        if d.as_tuple().exponent < -6:
            raise serializers.ValidationError("Số lượng yêu cầu được nhập tối đa 6 chữ số thập phân.")
        return value

    def validate_estimated_unit_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Đơn giá dự kiến phải lớn hơn hoặc bằng 0.")
        return value

    def validate_notes(self, value):
        if value and len(value) > 500:
            raise serializers.ValidationError("Ghi chú không được vượt quá 500 ký tự.")
        return value


ALLOWED_ATTACHMENT_EXTS = {".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg"}
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024  # 10 MB


class PurchaseRequestSerializer(serializers.ModelSerializer):
    lines = PurchaseRequestLineSerializer(many=True)
    total_estimated_amount = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    receiving_location = serializers.CharField(required=False, allow_blank=True, max_length=255, default="")
    attachments = serializers.JSONField(required=False, default=list)
    version = serializers.IntegerField(required=False, default=1)
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        default="",
        error_messages={"max_length": "Ghi chú không được vượt quá 500 ký tự."},
    )
    purpose = serializers.CharField(
        max_length=500,
        error_messages={
            "blank": "Vui lòng nhập đầy đủ các trường bắt buộc.",
            "required": "Vui lòng nhập đầy đủ các trường bắt buộc.",
        },
    )
    number = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = models.PurchaseRequest
        fields = "__all__"
        read_only_fields = (
            "id", "status", "workflow_snapshot", "created_by", "submitted_at", "approved_at",
            "cancelled_by", "cancelled_at", "cancellation_reason", "created_at", "updated_at",
            "total_estimated_amount",
        )
        extra_kwargs = {
            "branch": {"error_messages": {"required": "Vui lòng nhập đầy đủ các trường bắt buộc.", "null": "Vui lòng nhập đầy đủ các trường bắt buộc."}},
            "department": {"error_messages": {"required": "Vui lòng nhập đầy đủ các trường bắt buộc.", "null": "Vui lòng nhập đầy đủ các trường bắt buộc."}},
            "requester": {"error_messages": {"required": "Vui lòng nhập đầy đủ các trường bắt buộc.", "null": "Vui lòng nhập đầy đủ các trường bắt buộc."}},
            "document_date": {"error_messages": {"required": "Vui lòng nhập đầy đủ các trường bắt buộc.", "null": "Vui lòng nhập đầy đủ các trường bắt buộc."}},
            "required_date": {"error_messages": {"required": "Vui lòng nhập đầy đủ các trường bắt buộc.", "null": "Vui lòng nhập đầy đủ các trường bắt buộc."}},
        }

    def validate_attachments(self, value):
        if not value:
            return value
        if not isinstance(value, list):
            raise serializers.ValidationError("Tệp đính kèm phải là danh sách.")
        import os
        for att in value:
            if isinstance(att, dict):
                file_name = att.get("file_name", att.get("name", ""))
                file_size = att.get("file_size", att.get("size", 0))
                if file_size and int(file_size) > MAX_ATTACHMENT_SIZE:
                    raise serializers.ValidationError(f"Tệp đính kèm '{file_name}' vượt quá 10 MB (BR-PUR-REQ-34).")
                if file_name:
                    ext = os.path.splitext(file_name)[1].lower()
                    if ext and ext not in ALLOWED_ATTACHMENT_EXTS:
                        raise serializers.ValidationError(f"Định dạng tệp '{ext}' không được phép. Định dạng cho phép gồm PDF, DOCX, XLSX, PNG, JPG và JPEG.")
        return value

    def validate(self, attrs):
        lines = attrs.get("lines", [])
        if self.instance and self.instance.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REVISION_REQUIRED}:
            raise serializers.ValidationError("Chỉ chứng từ DRAFT hoặc REVISION_REQUIRED được sửa.")

        if self.instance and attrs.get("version") is not None and attrs["version"] != self.instance.version:
            raise serializers.ValidationError("Dữ liệu đã được người khác cập nhật. Vui lòng tải lại trang.")

        if self.instance:
            num = attrs.get("number")
            if not num:
                attrs["number"] = self.instance.number
            elif num != self.instance.number:
                raise serializers.ValidationError({"number": "Không được tự sửa Số yêu cầu."})

        required_fields = {
            "branch": "Chi nhánh",
            "department": "Phòng ban",
            "requester": "Người đề nghị",
            "document_date": "Ngày yêu cầu",
            "required_date": "Ngày cần hàng",
            "purpose": "Mục đích mua",
        }
        missing = [f for f in required_fields if not attrs.get(f) and not getattr(self.instance, f, None)]
        if missing:
            raise serializers.ValidationError({
                f: "Vui lòng nhập đầy đủ các trường bắt buộc." for f in missing
            })

        if not lines and not self.instance:
            raise serializers.ValidationError({"lines": "Yêu cầu mua hàng phải có ít nhất một dòng hàng."})
        if self.instance and lines is not None and len(lines) == 0:
            raise serializers.ValidationError({"lines": "Yêu cầu mua hàng phải có ít nhất một dòng hàng."})

        doc_date = attrs.get("document_date") or getattr(self.instance, "document_date", None)
        req_date = attrs.get("required_date") or getattr(self.instance, "required_date", None)
        if doc_date and req_date and req_date < doc_date:
            raise serializers.ValidationError({"required_date": "Ngày cần hàng không được trước Ngày yêu cầu."})

        company = attrs.get("company") or self.instance.company
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)
        department = attrs.get("department") or getattr(self.instance, "department", None)

        if branch and getattr(branch, "status", None) != "ACTIVE":
            raise serializers.ValidationError({"branch": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})
        if department and getattr(department, "status", None) != "ACTIVE":
            raise serializers.ValidationError({"department": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})

        for line in lines:
            validate_catalog(company, item=line["item"], uom=line["uom"], quantity=line["quantity"])
            line_req_date = line.get("required_date") or req_date
            if doc_date and line_req_date and line_req_date < doc_date:
                raise serializers.ValidationError({"lines": "Ngày cần hàng không được trước Ngày yêu cầu."})

        if not self.instance and not attrs.get("number"):
            from .services import generate_purchase_request_number
            attrs["number"] = generate_purchase_request_number(company, branch=branch, document_date=doc_date)

        candidate = self.instance or models.PurchaseRequest()
        for key, value in attrs.items():
            if key not in ("lines", "version"):
                setattr(candidate, key, value)
        validate_model(candidate, exclude=("created_by",))
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        parent_req_date = validated_data.get("required_date")
        instance = models.PurchaseRequest.objects.create(**validated_data)
        for index, line in enumerate(lines, 1):
            line_req_date = line.get("required_date") or parent_req_date
            models.PurchaseRequestLine.objects.create(
                request=instance,
                line_no=line.get("line_no", index),
                required_date=line_req_date,
                **{k: v for k, v in line.items() if k not in ("line_no", "required_date")}
            )
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        parent_req_date = validated_data.get("required_date") or instance.required_date
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.version += 1
        instance.save()
        if lines is not None:
            if instance.lines.filter(ordered_quantity__gt=0).exists():
                raise serializers.ValidationError({"lines": "Không thể thay dòng đã được dùng để lập đơn mua."})
            instance.lines.all().delete()
            for index, line in enumerate(lines, 1):
                line_req_date = line.get("required_date") or parent_req_date
                models.PurchaseRequestLine.objects.create(
                    request=instance,
                    line_no=line.get("line_no", index),
                    required_date=line_req_date,
                    **{k: v for k, v in line.items() if k not in ("line_no", "required_date")}
                )
        return instance


class PurchaseContractLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PurchaseContractLine
        fields = "__all__"
        read_only_fields = ("id", "contract")


class PurchaseContractSerializer(serializers.ModelSerializer):
    lines = PurchaseContractLineSerializer(many=True, required=False)
    committed_value = serializers.SerializerMethodField()
    remaining_value = serializers.SerializerMethodField()

    class Meta:
        model = models.PurchaseContract
        fields = "__all__"
        read_only_fields = (
            "id", "status", "workflow_snapshot", "created_by", "submitted_at", "approved_at",
            "terminated_at", "termination_reason", "created_at", "updated_at", "committed_value", "remaining_value",
        )

    @extend_schema_field(serializers.DecimalField(max_digits=20, decimal_places=4))
    def get_committed_value(self, obj):
        return sum((order.total_amount for order in obj.orders.exclude(status=models.DocumentStatus.CANCELLED)), Decimal("0"))

    @extend_schema_field(serializers.DecimalField(max_digits=20, decimal_places=4, allow_null=True))
    def get_remaining_value(self, obj):
        return None if obj.maximum_value is None else obj.maximum_value - self.get_committed_value(obj)

    def validate(self, attrs):
        if self.instance and self.instance.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}:
            raise serializers.ValidationError("Chỉ hợp đồng DRAFT hoặc REJECTED được sửa trực tiếp.")
        company = attrs.get("company") or self.instance.company
        validate_catalog(company, supplier=attrs.get("supplier") or getattr(self.instance, "supplier", None))
        for line in attrs.get("lines", []):
            validate_catalog(company, item=line["item"], uom=line["uom"], quantity=line["quantity"])
        candidate = self.instance or models.PurchaseContract()
        for key, value in attrs.items():
            if key != "lines":
                setattr(candidate, key, value)
        validate_model(candidate, exclude=("created_by",))
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines", [])
        instance = models.PurchaseContract.objects.create(**validated_data)
        for index, line in enumerate(lines, 1):
            models.PurchaseContractLine.objects.create(contract=instance, line_no=line.get("line_no", index), **{k: v for k, v in line.items() if k != "line_no"})
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if lines is not None:
            instance.lines.all().delete()
            for index, line in enumerate(lines, 1):
                models.PurchaseContractLine.objects.create(contract=instance, line_no=line.get("line_no", index), **{k: v for k, v in line.items() if k != "line_no"})
        return instance


class PurchaseOrderRequestLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PurchaseOrderRequestLine
        fields = ("request_line", "quantity")


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    quantity = serializers.DecimalField(max_digits=20, decimal_places=6, error_messages={"max_decimal_places": "Số lượng đặt tối đa 6 chữ số thập phân."})
    unit_price = serializers.DecimalField(max_digits=20, decimal_places=4)
    discount_rate = serializers.DecimalField(max_digits=9, decimal_places=4, required=False, default=Decimal("0"))
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500, error_messages={"max_length": "Ghi chú không được vượt quá 500 ký tự."})
    description = serializers.CharField(required=False, allow_blank=True, max_length=500, error_messages={"max_length": "Diễn giải không được vượt quá 500 ký tự."})
    remaining_quantity = serializers.DecimalField(max_digits=20, decimal_places=6, read_only=True)
    invoiced_quantity = serializers.DecimalField(max_digits=20, decimal_places=6, read_only=True)
    request_links = PurchaseOrderRequestLineSerializer(many=True, required=False)
    line_subtotal = serializers.SerializerMethodField()
    pre_discount_amount = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    discount_amount = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    pre_tax_amount = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    tax_amount = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    line_total = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)

    class Meta:
        model = models.PurchaseOrderLine
        fields = "__all__"
        read_only_fields = (
            "id", "order", "received_quantity", "invoiced_quantity", "cancelled_quantity",
            "remaining_quantity", "line_subtotal", "pre_discount_amount", "discount_amount",
            "pre_tax_amount", "tax_amount", "line_total",
        )

    @extend_schema_field(serializers.DecimalField(max_digits=20, decimal_places=4))
    def get_line_subtotal(self, obj):
        return obj.pre_tax_amount

    def validate_quantity(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Số lượng đặt phải lớn hơn 0.")
        if value.as_tuple().exponent < -6:
            raise serializers.ValidationError("Số lượng đặt tối đa 6 chữ số thập phân.")
        return value

    def validate_unit_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Đơn giá phải lớn hơn hoặc bằng 0.")
        return value

    def validate_discount_rate(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("Tỷ lệ chiết khấu phải từ 0% đến 100%.")
        return value

    def validate_notes(self, value):
        if value and len(value) > 500:
            raise serializers.ValidationError("Ghi chú không được vượt quá 500 ký tự.")
        return value

    def validate_description(self, value):
        if value and len(value) > 500:
            raise serializers.ValidationError("Diễn giải không được vượt quá 500 ký tự.")
        return value


class PurchaseOrderSerializer(serializers.ModelSerializer):
    number = serializers.CharField(required=False, allow_blank=True, default="")
    lines = PurchaseOrderLineSerializer(many=True, required=False)
    receiving_location = serializers.CharField(required=False, allow_blank=True, default="")
    contact_person = serializers.CharField(required=False, allow_blank=True, default="")
    delivery_address = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    attachments = serializers.JSONField(required=False, default=list)
    version = serializers.IntegerField(required=False, default=1)
    delivery_date = serializers.DateField(required=False, allow_null=True)
    expected_delivery_date = serializers.DateField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = models.PurchaseOrder
        fields = "__all__"
        read_only_fields = (
            "id", "status", "receiving_status", "invoicing_status", "approval_required", "workflow_snapshot",
            "created_by", "submitted_at", "approved_at", "sent_at", "cancelled_at",
            "cancelled_by", "cancellation_reason", "subtotal", "tax_amount",
            "discount_amount", "total_amount", "closed_at", "closed_by",
            "close_reason", "created_at", "updated_at", "payment_method_snapshot",
        )
        extra_kwargs = {
            "supplier": {"error_messages": {"required": "Vui lòng nhập đầy đủ các trường bắt buộc.", "null": "Vui lòng nhập đầy đủ các trường bắt buộc."}},
            "branch": {"error_messages": {"required": "Vui lòng nhập đầy đủ các trường bắt buộc.", "null": "Vui lòng nhập đầy đủ các trường bắt buộc."}},
            "document_date": {"error_messages": {"required": "Vui lòng nhập đầy đủ các trường bắt buộc.", "null": "Vui lòng nhập đầy đủ các trường bắt buộc."}},
            "delivery_date": {"error_messages": {"required": "Vui lòng nhập đầy đủ các trường bắt buộc.", "null": "Vui lòng nhập đầy đủ các trường bắt buộc."}},
        }

    def validate_attachments(self, value):
        if not value:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Danh sách tệp đính kèm không hợp lệ.")
        allowed_exts = {".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg"}
        max_bytes = 10 * 1024 * 1024
        for att in value:
            if not isinstance(att, dict):
                raise serializers.ValidationError("Tệp đính kèm không đúng định dạng.")
            name = str(att.get("name", "")).lower()
            size = att.get("size", 0)
            if not any(name.endswith(ext) for ext in allowed_exts):
                raise serializers.ValidationError(
                    "Định dạng tệp không được hỗ trợ. Chỉ cho phép PDF, DOCX, XLSX, PNG, JPG, JPEG."
                )
            try:
                if int(size) > max_bytes:
                    raise serializers.ValidationError("Dung lượng tệp đính kèm không được vượt quá 10 MB.")
            except (ValueError, TypeError):
                pass
        return value

    def validate(self, attrs):
        if self.instance and attrs.get("version") is not None:
            if self.instance.version != attrs["version"]:
                raise serializers.ValidationError({"version": "Dữ liệu đã được người khác cập nhật. Vui lòng tải lại trang."})

        num = attrs.get("number")
        if self.instance:
            if num and num != self.instance.number:
                raise serializers.ValidationError({"number": "Không được tự sửa Số đơn mua."})
            if not num:
                attrs["number"] = self.instance.number

        if self.instance and self.instance.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REVISION_REQUIRED}:
            raise serializers.ValidationError("Chỉ đơn ở DRAFT hoặc REVISION_REQUIRED mới được sửa Nhà cung cấp, hàng hóa, số lượng, đơn giá hoặc tổng tiền.")

        company = attrs.get("company") or self.instance.company
        supplier = attrs.get("supplier") or getattr(self.instance, "supplier", None)
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)
        doc_date = attrs.get("document_date") or getattr(self.instance, "document_date", None)

        if "expected_delivery_date" in attrs:
            exp_date = attrs.pop("expected_delivery_date")
            if exp_date and not attrs.get("delivery_date"):
                attrs["delivery_date"] = exp_date

        deliv_date = attrs.get("delivery_date") or getattr(self.instance, "delivery_date", None)
        if not deliv_date and doc_date:
            deliv_date = doc_date
            attrs["delivery_date"] = deliv_date
        if not deliv_date and not self.instance:
            raise serializers.ValidationError({"delivery_date": "Vui lòng nhập đầy đủ các trường bắt buộc."})
        if deliv_date and doc_date and deliv_date < doc_date:
            raise serializers.ValidationError({"delivery_date": "Ngày giao dự kiến không được trước Ngày đặt hàng."})

        loc = attrs.get("receiving_location") or attrs.get("delivery_address") or attrs.get("receiving_warehouse")
        if not loc and not (getattr(self.instance, "receiving_location", None) or getattr(self.instance, "delivery_address", None) or getattr(self.instance, "receiving_warehouse", None)):
            raise serializers.ValidationError({"receiving_location": "Vui lòng nhập đầy đủ các trường bắt buộc."})

        if not supplier:
            raise serializers.ValidationError({"supplier": "Vui lòng nhập đầy đủ các trường bắt buộc."})
        if not branch:
            raise serializers.ValidationError({"branch": "Vui lòng nhập đầy đủ các trường bắt buộc."})
        if not doc_date:
            raise serializers.ValidationError({"document_date": "Vui lòng nhập đầy đủ các trường bắt buộc."})

        if attrs.get("notes") and len(attrs["notes"]) > 500:
            raise serializers.ValidationError({"notes": "Diễn giải không được vượt quá 500 ký tự."})

        # Link purchase request (BR-PUR-PO-20, EF-02)
        pr = attrs.get("purchase_request") or getattr(self.instance, "purchase_request", None)
        if pr:
            if pr.company_id != company.id:
                raise serializers.ValidationError({"purchase_request": "Dữ liệu liên kết phải thuộc cùng doanh nghiệp."})
            if pr.status not in (models.DocumentStatus.APPROVED, models.DocumentStatus.PARTIALLY_ORDERED) or not any(l.remaining_quantity > 0 for l in pr.lines.all()):
                raise serializers.ValidationError({"purchase_request": "Yêu cầu mua hàng không còn số lượng có thể đặt mua."})
            if not attrs.get("lines") and not self.instance:
                pop_lines = []
                for pr_line in pr.lines.filter(quantity__gt=F("ordered_quantity")):
                    rem = pr_line.remaining_quantity
                    pop_lines.append({
                        "line_no": pr_line.line_no,
                        "item": pr_line.item,
                        "uom": pr_line.uom,
                        "quantity": rem,
                        "unit_price": pr_line.estimated_unit_price or Decimal("0"),
                        "description": pr_line.description,
                        "notes": pr_line.notes,
                        "expected_delivery_date": pr_line.required_date or deliv_date,
                        "request_links": [{"request_line": pr_line, "quantity": rem}],
                    })
                attrs["lines"] = pop_lines

        lines = attrs.get("lines", [])
        if not lines and not self.instance:
            raise serializers.ValidationError({"lines": "Đơn mua hàng phải có ít nhất một dòng hàng."})

        # EF-08: Check active catalog status
        if supplier and getattr(supplier, "status", None) != "ACTIVE":
            raise serializers.ValidationError({"supplier": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})
        if branch and getattr(branch, "status", None) != "ACTIVE":
            raise serializers.ValidationError({"branch": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})
        rec_wh = attrs.get("receiving_warehouse") or getattr(self.instance, "receiving_warehouse", None)
        if rec_wh and getattr(rec_wh, "status", None) != "ACTIVE":
            raise serializers.ValidationError({"receiving_warehouse": "Dữ liệu được chọn đã ngừng sử dụng. Vui lòng chọn lại."})

        validate_payment_term_selection(attrs.get("payment_term") or getattr(self.instance, "payment_term", None), company=company, scope="PURCHASE", on_date=doc_date, previous=getattr(self.instance, "payment_term", None))
        prepare_document_method(attrs, self.instance, company=company, scope="PAYMENT", on_date=doc_date)

        for line in lines:
            validate_catalog(company, item=line["item"], uom=line["uom"], warehouse=line.get("warehouse"), quantity=line["quantity"])
            if line["item"].track_inventory and not (line.get("warehouse") or rec_wh):
                raise serializers.ValidationError({"lines": "Kho nhận là bắt buộc đối với hàng hóa theo dõi qua kho."})
            line_delivery = line.get("expected_delivery_date") or deliv_date
            if line_delivery and doc_date and line_delivery < doc_date:
                raise serializers.ValidationError({"lines": "Ngày giao dự kiến không được trước Ngày đặt hàng."})
            for link in line.get("request_links", []):
                source = link["request_line"]
                if source.request.company_id != company.id or source.request.status not in (models.DocumentStatus.APPROVED, models.DocumentStatus.PARTIALLY_ORDERED) or source.remaining_quantity <= 0:
                    raise serializers.ValidationError({"lines": "Yêu cầu mua hàng không còn số lượng có thể đặt mua."})
                if link["quantity"] > source.remaining_quantity:
                    raise serializers.ValidationError({"lines": "Số lượng đặt vượt quá số lượng còn lại của yêu cầu mua hàng."})

        if not self.instance and not attrs.get("number"):
            from .services import generate_purchase_order_number
            attrs["number"] = generate_purchase_order_number(company, branch=branch, document_date=doc_date)

        candidate = self.instance or models.PurchaseOrder()
        for key, value in attrs.items():
            if key not in ("lines", "version"):
                setattr(candidate, key, value)
        validate_model(candidate, exclude=("created_by", "buyer"))
        return attrs

    @staticmethod
    def _amounts(lines):
        subtotal = Decimal("0")
        tax = Decimal("0")
        discount = Decimal("0")
        for line in lines:
            qty = line["quantity"]
            price = line["unit_price"]
            disc_rate = line.get("discount_rate", Decimal("0"))
            base = (qty * price).quantize(Decimal("0.0001"))
            line_disc = (base * disc_rate / Decimal("100")).quantize(Decimal("0.0001"))
            pre_tax = base - line_disc
            subtotal += pre_tax
            discount += line_disc
            if line.get("tax_rate"):
                rate = getattr(line["tax_rate"], "rate_percent", None) or getattr(line["tax_rate"], "rate", Decimal("0"))
                tax += (pre_tax * rate / Decimal("100")).quantize(Decimal("0.0001"))
        return subtotal, tax, discount

    @transaction.atomic
    def create(self, validated_data):
        from .services import sync_purchase_request_status
        lines = validated_data.pop("lines")
        subtotal, tax, discount = self._amounts(lines)
        validated_data["subtotal"] = subtotal
        validated_data["tax_amount"] = tax
        validated_data["discount_amount"] = discount + validated_data.get("discount_amount", Decimal("0"))
        validated_data["total_amount"] = subtotal + tax + validated_data.get("fee_amount", Decimal("0"))
        if not validated_data.get("buyer"):
            request = self.context.get("request")
            if request and hasattr(request, "user"):
                from .services import actor_for
                validated_data["buyer"] = actor_for(request)
        instance = models.PurchaseOrder.objects.create(**validated_data)
        affected_requests = set()
        for index, line in enumerate(lines, 1):
            links = line.pop("request_links", [])
            order_line = models.PurchaseOrderLine.objects.create(order=instance, line_no=line.pop("line_no", index), **line)
            for link in links:
                models.PurchaseOrderRequestLine.objects.create(order_line=order_line, **link)
                models.PurchaseRequestLine.objects.filter(pk=link["request_line"].pk).update(ordered_quantity=F("ordered_quantity") + link["quantity"])
                affected_requests.add(link["request_line"].request_id)
        self._validate_contract_limit(instance)
        for req_id in affected_requests:
            req = models.PurchaseRequest.objects.get(pk=req_id)
            sync_purchase_request_status(req)
        return instance

    def _validate_contract_limit(self, instance):
        if instance.contract and instance.contract.maximum_value is not None:
            committed = sum((order.total_amount for order in instance.contract.orders.exclude(status=models.DocumentStatus.CANCELLED)), Decimal("0"))
            if committed > instance.contract.maximum_value:
                raise serializers.ValidationError({"contract": "Giá trị thực hiện vượt hạn mức hợp đồng."})

    @transaction.atomic
    def update(self, instance, validated_data):
        from .services import sync_purchase_request_status
        lines = validated_data.pop("lines", None)
        if lines is not None and instance.lines.filter(received_quantity__gt=0).exists():
            raise serializers.ValidationError({"lines": "Không thể thay dòng đơn mua đã nhận hàng."})
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.version += 1
        affected_requests = set()
        if lines is not None:
            for link in models.PurchaseOrderRequestLine.objects.filter(order_line__order=instance):
                models.PurchaseRequestLine.objects.filter(pk=link.request_line_id).update(ordered_quantity=F("ordered_quantity") - link.quantity)
                affected_requests.add(link.request_line.request_id)
            instance.lines.all().delete()
            subtotal, tax, discount = self._amounts(lines)
            instance.subtotal = subtotal
            instance.tax_amount = tax
            instance.discount_amount = discount + instance.discount_amount
            instance.total_amount = subtotal + tax + instance.fee_amount
            for index, line in enumerate(lines, 1):
                links = line.pop("request_links", [])
                order_line = models.PurchaseOrderLine.objects.create(order=instance, line_no=line.pop("line_no", index), **line)
                for link in links:
                    models.PurchaseOrderRequestLine.objects.create(order_line=order_line, **link)
                    models.PurchaseRequestLine.objects.filter(pk=link["request_line"].pk).update(ordered_quantity=F("ordered_quantity") + link["quantity"])
                    affected_requests.add(link["request_line"].request_id)
        instance.save()
        self._validate_contract_limit(instance)
        for req_id in affected_requests:
            req = models.PurchaseRequest.objects.get(pk=req_id)
            sync_purchase_request_status(req)
        return instance


class PurchaseReceiptLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PurchaseReceiptLine
        fields = "__all__"
        read_only_fields = ("id", "receipt")


class PurchaseReceiptSerializer(serializers.ModelSerializer):
    lines = PurchaseReceiptLineSerializer(many=True)

    class Meta:
        model = models.PurchaseReceipt
        fields = "__all__"
        read_only_fields = ("id", "status", "created_by", "confirmed_by", "confirmed_at", "created_at", "updated_at")

    def validate(self, attrs):
        if self.instance and self.instance.status != models.ReceiptStatus.DRAFT:
            raise serializers.ValidationError("Chỉ lần nhận DRAFT được sửa.")
        lines = attrs.get("lines", [])
        if not lines and not self.instance:
            raise serializers.ValidationError({"lines": "Lần nhận phải có ít nhất một dòng."})
        company = attrs.get("company") or self.instance.company
        order = attrs.get("order") or self.instance.order
        if order.company_id != company.id:
            raise serializers.ValidationError({"order": "Đơn mua phải thuộc cùng doanh nghiệp."})
        if order.status not in {models.DocumentStatus.APPROVED, models.DocumentStatus.PARTIALLY_RECEIVED}:
            raise serializers.ValidationError({"order": "Trạng thái đơn mua không cho phép nhận hàng/dịch vụ."})
        for line in lines:
            if line["order_line"].order_id != order.id:
                raise serializers.ValidationError({"lines": "Dòng nhận phải thuộc đơn mua đã chọn."})
            if not any((line.get("quantity"), line.get("accepted_value"), line.get("completion_percent"))):
                raise serializers.ValidationError({"lines": "Phải nhập số lượng, giá trị hoặc tỷ lệ hoàn thành."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        instance = models.PurchaseReceipt.objects.create(**validated_data)
        for line in lines:
            models.PurchaseReceiptLine.objects.create(receipt=instance, **line)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if lines is not None:
            instance.lines.all().delete()
            for line in lines:
                models.PurchaseReceiptLine.objects.create(receipt=instance, **line)
        return instance


class ApprovalDecisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ApprovalDecision
        fields = "__all__"
        read_only_fields = ("id", "decided_at")
