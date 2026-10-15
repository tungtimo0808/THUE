from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from master_data.models import validate_uom_quantity
from master_data.payment_terms import validate_payment_term_selection
from master_data.payment_methods import prepare_document_method

from . import models


def validate_party_and_catalog(company, customer, lines):
    if customer.company_id != company.id or customer.status != "ACTIVE":
        raise serializers.ValidationError({"customer": "Khách hàng không hợp lệ hoặc đã ngừng hoạt động."})
    if not customer.roles.filter(role_type="CUSTOMER").exists():
        raise serializers.ValidationError({"customer": "Đối tượng chưa có vai trò khách hàng."})
    for line in lines:
        if line.get("uom") and line.get("quantity") is not None:
            try:
                validate_uom_quantity(line["uom"], line["quantity"])
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"lines": exc.messages}) from exc
        for name in ("item", "uom", "tax_rate", "warehouse"):
            value = line.get(name)
            if value and getattr(value, "company_id", None) != company.id:
                raise serializers.ValidationError({"lines": f"{name} phải thuộc cùng doanh nghiệp."})
            if value and hasattr(value, "status") and value.status != "ACTIVE":
                raise serializers.ValidationError({"lines": f"{name} phải đang hoạt động."})
            if name == "item" and value and not value.allow_sale:
                raise serializers.ValidationError({"lines": "Hàng hóa hoặc dịch vụ này không được phép bán."})


def totals(lines, fee=Decimal("0")):
    subtotal = discount = tax = Decimal("0")
    for line in lines:
        if line.get("quantity") is None or line.get("unit_price") is None:
            continue
        gross = line["quantity"] * line["unit_price"]
        line_discount = gross * line.get("discount_rate", Decimal("0")) / Decimal("100")
        taxable = gross - line_discount
        rate = line.get("tax_rate")
        subtotal += gross
        discount += line_discount
        if rate:
            tax += taxable * rate.rate_percent / Decimal("100")
    return subtotal, discount, tax, subtotal - discount + tax + fee


class QuotationLineSerializer(serializers.ModelSerializer):
    remaining_quantity = serializers.SerializerMethodField()
    gross_amount = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()
    before_tax_amount = serializers.SerializerMethodField()
    tax_amount = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = models.SalesQuotationLine
        fields = "__all__"
        read_only_fields = ("id", "quotation", "ordered_quantity", "remaining_quantity", "gross_amount", "discount_amount", "before_tax_amount", "tax_amount", "total_amount")
        extra_kwargs = {"line_no": {"required": False}}

    def _amounts(self, obj):
        if obj.quantity is None or obj.unit_price is None:
            return None
        precision = obj.quotation.currency.decimal_places
        quantum = Decimal(1).scaleb(-precision)
        gross = (obj.quantity * obj.unit_price).quantize(quantum, rounding=ROUND_HALF_UP)
        discount = (gross * obj.discount_rate / 100).quantize(quantum, rounding=ROUND_HALF_UP)
        before_tax = gross - discount
        tax = (before_tax * (obj.tax_rate.rate_percent or 0) / 100).quantize(quantum, rounding=ROUND_HALF_UP) if obj.tax_rate and obj.tax_rate.application_form == "PERCENT" else Decimal("0")
        return gross, discount, before_tax, tax, before_tax + tax

    def get_gross_amount(self, obj):
        amounts = self._amounts(obj)
        return amounts[0] if amounts else None

    def get_discount_amount(self, obj):
        amounts = self._amounts(obj)
        return amounts[1] if amounts else None

    def get_before_tax_amount(self, obj):
        amounts = self._amounts(obj)
        return amounts[2] if amounts else None

    def get_tax_amount(self, obj):
        amounts = self._amounts(obj)
        return amounts[3] if amounts else None

    def get_total_amount(self, obj):
        amounts = self._amounts(obj)
        return amounts[4] if amounts else None

    @extend_schema_field(serializers.DecimalField(max_digits=22, decimal_places=6))
    def get_remaining_quantity(self, obj):
        if obj.quantity is None:
            return None
        ordered = obj.order_lines.exclude(order__status=models.DocumentStatus.CANCELLED).aggregate(total=Sum("quantity"))["total"] or 0
        return max(obj.quantity - ordered, Decimal("0"))


class QuotationSerializer(serializers.ModelSerializer):
    lines = QuotationLineSerializer(many=True)

    class Meta:
        model = models.SalesQuotation
        fields = [field.name for field in models.SalesQuotation._meta.fields if field.name != "pdf_content"] + ["lines"]
        read_only_fields = ("id", "status", "workflow_snapshot", "subtotal", "discount_amount", "tax_amount", "total_amount", "sent_versions", "created_by", "submitted_at", "approved_at", "created_at", "updated_at", "cancellation_reason", "payment_method_snapshot", "version", "original_quotation", "response_date", "response_content", "sent_at")

    def validate(self, attrs):
        if self.instance and attrs.get("number", self.instance.number) != self.instance.number:
            raise serializers.ValidationError({"number": "Số báo giá đã cấp không được thay đổi."})
        if len(str(attrs.get("notes", getattr(self.instance, "notes", "")))) > 1000:
            raise serializers.ValidationError({"notes": "Ghi chú không được vượt quá 1.000 ký tự."})
        if self.instance and self.instance.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}:
            raise serializers.ValidationError("Chỉ báo giá DRAFT hoặc REJECTED được sửa.")
        lines = attrs.get("lines", [])
        if not self.instance and not lines:
            raise serializers.ValidationError({"lines": "Báo giá phải có ít nhất một dòng."})
        company = attrs.get("company") or self.instance.company
        customer = attrs.get("customer") or self.instance.customer
        validate_party_and_catalog(company, customer, lines)
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)
        payment_term = attrs.get("payment_term") or getattr(self.instance, "payment_term", None)
        validate_payment_term_selection(payment_term, company=company, scope="SALE", on_date=attrs.get("document_date") or self.instance.document_date, previous=getattr(self.instance, "payment_term", None))
        prepare_document_method(attrs, self.instance, company=company, scope="RECEIPT", on_date=attrs.get("document_date") or self.instance.document_date)
        if branch and branch.company_id != company.id: raise serializers.ValidationError({"branch": "Chi nhánh phải thuộc cùng doanh nghiệp."})
        if payment_term and payment_term.company_id != company.id: raise serializers.ValidationError({"payment_term": "Điều khoản thanh toán phải thuộc cùng doanh nghiệp."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        values = totals(lines, validated_data.get("fee_amount", Decimal("0")))
        validated_data.update(zip(("subtotal", "discount_amount", "tax_amount", "total_amount"), values))
        obj = models.SalesQuotation.objects.create(**validated_data)
        for index, line in enumerate(lines, 1):
            models.SalesQuotationLine.objects.create(quotation=obj, line_no=line.pop("line_no", index), **line)
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        for key, value in validated_data.items(): setattr(instance, key, value)
        if lines is not None:
            instance.lines.all().delete()
            values = totals(lines, instance.fee_amount)
            instance.subtotal, instance.discount_amount, instance.tax_amount, instance.total_amount = values
            for index, line in enumerate(lines, 1):
                models.SalesQuotationLine.objects.create(quotation=instance, line_no=line.pop("line_no", index), **line)
        instance.save(); return instance


class ContractLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.SalesContractLine
        fields = "__all__"
        read_only_fields = ("id", "contract")
        extra_kwargs = {"line_no": {"required": False}}


class ContractSerializer(serializers.ModelSerializer):
    lines = ContractLineSerializer(many=True)

    class Meta:
        model = models.SalesContract
        fields = "__all__"
        read_only_fields = ("id", "status", "workflow_snapshot", "subtotal", "discount_amount", "tax_amount", "total_amount", "created_by", "submitted_at", "approved_at", "created_at", "updated_at", "terminated_at", "termination_reason", "payment_method_snapshot")

    def validate(self, attrs):
        if self.instance and self.instance.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REJECTED}:
            raise serializers.ValidationError("Chỉ hợp đồng DRAFT hoặc REJECTED được sửa.")
        lines = attrs.get("lines", [])
        if not self.instance and not lines: raise serializers.ValidationError({"lines": "Hợp đồng phải có ít nhất một dòng."})
        company = attrs.get("company") or self.instance.company; customer = attrs.get("customer") or self.instance.customer
        validate_party_and_catalog(company, customer, lines)
        branch = attrs.get("branch") or getattr(self.instance, "branch", None); payment_term = attrs.get("payment_term") or getattr(self.instance, "payment_term", None)
        validate_payment_term_selection(payment_term, company=company, scope="SALE", on_date=attrs.get("document_date") or self.instance.document_date, previous=getattr(self.instance, "payment_term", None))
        prepare_document_method(attrs, self.instance, company=company, scope="RECEIPT", on_date=attrs.get("document_date") or self.instance.document_date)
        if branch and branch.company_id != company.id: raise serializers.ValidationError({"branch": "Chi nhánh phải thuộc cùng doanh nghiệp."})
        if payment_term and payment_term.company_id != company.id: raise serializers.ValidationError({"payment_term": "Điều khoản thanh toán phải thuộc cùng doanh nghiệp."})
        start = attrs.get("start_date") or self.instance.start_date; end = attrs.get("end_date") or self.instance.end_date
        if end < start: raise serializers.ValidationError({"end_date": "Ngày kết thúc không được trước ngày bắt đầu."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines"); obj = models.SalesContract.objects.create(**validated_data)
        for index, line in enumerate(lines, 1): models.SalesContractLine.objects.create(contract=obj, line_no=line.pop("line_no", index), **line)
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        for key, value in validated_data.items(): setattr(instance, key, value)
        if lines is not None:
            instance.lines.all().delete()
            for index, line in enumerate(lines, 1): models.SalesContractLine.objects.create(contract=instance, line_no=line.pop("line_no", index), **line)
        instance.save(); return instance


class OrderLineSerializer(serializers.ModelSerializer):
    remaining_quantity = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    uom_code = serializers.CharField(source="uom.code", read_only=True)
    uom_name = serializers.CharField(source="uom.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    class Meta:
        model = models.SalesOrderLine
        fields = "__all__"
        read_only_fields = ("id", "order", "delivered_quantity", "invoiced_quantity", "cancelled_quantity", "closed_quantity", "remaining_quantity", "tax_amount", "line_total")
        extra_kwargs = {
            "line_no": {"required": False},
            "uom": {"required": False},
            "unit_price": {"required": False},
            "discount_amount": {"required": False},
        }

    def validate(self, attrs):
        qty = attrs.get("quantity")
        if qty is not None and qty <= 0:
            raise serializers.ValidationError({"quantity": "Số lượng tại mỗi dòng phải lớn hơn 0."})
        price = attrs.get("unit_price")
        if price is not None and price < 0:
            raise serializers.ValidationError({"unit_price": "Đơn giá không được nhỏ hơn 0."})
        disc_rate = attrs.get("discount_rate")
        if disc_rate is not None and (disc_rate < 0 or disc_rate > 100):
            raise serializers.ValidationError({"discount_rate": "Tỷ lệ chiết khấu phải từ 0% đến 100%."})
        disc_amount = attrs.get("discount_amount")
        if qty is not None and price is not None and disc_amount is not None:
            gross = qty * price
            if disc_amount < 0 or disc_amount > gross:
                raise serializers.ValidationError({"discount_amount": f"Tiền chiết khấu không được vượt quá thành tiền ({gross})."})
        return attrs


def _calculate_order_line_values(line, currency):
    quantum = Decimal(1).scaleb(-currency.decimal_places)
    qty = Decimal(str(line.get("quantity") or 0))
    price = Decimal(str(line.get("unit_price") or 0))
    gross = (qty * price).quantize(quantum, rounding=ROUND_HALF_UP)

    disc_amount = line.get("discount_amount")
    if disc_amount is not None and str(disc_amount).strip() != "":
        line_discount = Decimal(str(disc_amount)).quantize(quantum, rounding=ROUND_HALF_UP)
    else:
        disc_rate = Decimal(str(line.get("discount_rate") or 0))
        line_discount = (gross * disc_rate / Decimal("100")).quantize(quantum, rounding=ROUND_HALF_UP)

    taxable = gross - line_discount
    tax_rate = line.get("tax_rate")
    if tax_rate and getattr(tax_rate, "application_form", "PERCENT") == "PERCENT" and tax_rate.rate_percent is not None:
        tax_val = (taxable * tax_rate.rate_percent / Decimal("100")).quantize(quantum, rounding=ROUND_HALF_UP)
    else:
        tax_val = Decimal("0")

    line_tot = taxable + tax_val
    return gross, line_discount, tax_val, line_tot


class OrderSerializer(serializers.ModelSerializer):
    number = serializers.CharField(required=False, allow_blank=True)
    document_date = serializers.DateField(required=False)
    lines = OrderLineSerializer(many=True)
    customer_code = serializers.CharField(source="customer.code", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    employee_name = serializers.CharField(source="assigned_employee.full_name", read_only=True)
    delivered_value = serializers.SerializerMethodField()
    invoiced_value = serializers.SerializerMethodField()
    delivery_progress = serializers.SerializerMethodField()

    class Meta:
        model = models.SalesOrder
        fields = "__all__"
        read_only_fields = ("id", "status", "workflow_snapshot", "subtotal", "discount_amount", "tax_amount", "total_amount", "inventory_check", "credit_check", "invoiced_amount", "collected_amount", "created_by", "submitted_at", "approved_at", "created_at", "updated_at", "closed_at", "closed_by", "close_reason", "payment_method_snapshot")
        validators = []
        extra_kwargs = {
            "number": {"required": False, "allow_blank": True},
            "document_date": {"required": False},
            "currency": {"required": False},
            "exchange_rate": {"required": False},
        }

    def get_delivered_value(self, obj):
        return sum((line.delivered_quantity * line.unit_price for line in obj.lines.all()), Decimal("0"))

    def get_invoiced_value(self, obj):
        return obj.invoiced_amount

    def get_delivery_progress(self, obj):
        tot_qty = sum((line.quantity for line in obj.lines.all()), Decimal("0"))
        if tot_qty == 0:
            return 0
        del_qty = sum((line.delivered_quantity for line in obj.lines.all()), Decimal("0"))
        return float((del_qty / tot_qty * 100).quantize(Decimal("0.01")))

    def validate(self, attrs):
        if self.instance and self.instance.status not in {models.DocumentStatus.DRAFT, models.DocumentStatus.REVISION_REQUIRED, models.DocumentStatus.REJECTED}:
            raise serializers.ValidationError("Chỉ đơn bán DRAFT, REVISION_REQUIRED hoặc REJECTED được sửa.")

        # EF-08 & BR-SAL-31: Optimistic concurrency check
        if self.instance and self.initial_data.get("version") is not None:
            try:
                c_ver = int(self.initial_data["version"])
                if c_ver != self.instance.version:
                    raise serializers.ValidationError({"version": "Đơn bán hàng đã được cập nhật bởi người dùng khác. Vui lòng tải lại dữ liệu."})
            except (ValueError, TypeError):
                pass

        lines = attrs.get("lines", [])
        if not self.instance and not lines:
            raise serializers.ValidationError({"lines": "Đơn bán phải có ít nhất một dòng."})

        company = attrs.get("company") or self.instance.company
        customer = attrs.get("customer") or self.instance.customer
        if customer.company_id != company.id or customer.status != "ACTIVE":
            raise serializers.ValidationError({"customer": "Khách hàng không hợp lệ hoặc đã ngừng hoạt động."})

        # Set default document_date
        if not attrs.get("document_date") and not self.instance:
            attrs["document_date"] = timezone.localdate()
        doc_date = attrs.get("document_date") or self.instance.document_date

        # Currency & Exchange Rate (EF-06)
        currency = attrs.get("currency") or getattr(self.instance, "currency", None)
        if not currency:
            from master_data.models import Currency as CurrModel
            currency = CurrModel.objects.filter(code="VND", is_active=True).first()
            if not currency:
                raise serializers.ValidationError({"currency": "Vui lòng chọn loại tiền."})
            attrs["currency"] = currency

        if currency.id == company.accounting_currency_id:
            attrs["exchange_rate"] = Decimal("1")
        else:
            rate = attrs.get("exchange_rate") or getattr(self.instance, "exchange_rate", None)
            if rate is None or Decimal(str(rate)) <= 0:
                from master_data.models import ExchangeRate
                er = ExchangeRate.objects.filter(
                    company=company, from_currency=currency, to_currency=company.accounting_currency, effective_date__lte=doc_date
                ).order_by("-effective_date").first()
                if er and er.rate > 0:
                    attrs["exchange_rate"] = er.rate
                else:
                    raise serializers.ValidationError({"exchange_rate": "Thiếu tỷ giá ngoại tệ khi lưu. Vui lòng nhập tỷ giá lớn hơn 0 (EF-06)."})

        # Inherit customer fields
        if not attrs.get("customer_address") and not getattr(self.instance, "customer_address", None):
            addr = ""
            if hasattr(customer, "addresses"):
                addr = customer.addresses.order_by("-is_default", "id").values_list("address_line", flat=True).first() or ""
            if not addr:
                addr = getattr(customer, "address", "") or getattr(customer, "legal_address", "") or getattr(customer, "name", "")
            attrs["customer_address"] = addr
        if not attrs.get("delivery_address") and not getattr(self.instance, "delivery_address", None):
            attrs["delivery_address"] = attrs.get("customer_address") or getattr(customer, "name", "")
        if not attrs.get("contact_name") and not getattr(self.instance, "contact_name", None):
            ct = None
            if hasattr(customer, "contacts"):
                ct = customer.contacts.filter(status="ACTIVE").order_by("-is_default", "id").first()
            if ct:
                attrs["contact_name"] = ct.contact_name
                if not attrs.get("contact_phone") and not getattr(self.instance, "contact_phone", None):
                    attrs["contact_phone"] = ct.phone
                if not attrs.get("contact_email") and not getattr(self.instance, "contact_email", None):
                    attrs["contact_email"] = ct.email

        # Inherit employee if missing
        if not attrs.get("assigned_employee") and not getattr(self.instance, "assigned_employee", None):
            req = self.context.get("request")
            if req and hasattr(req.user, "iam_account"):
                from iam.models import CompanyMembership
                m = CompanyMembership.objects.filter(company=company, user=req.user.iam_account).first()
                if m and m.employee and m.employee.status == "ACTIVE":
                    attrs["assigned_employee"] = m.employee

        # Source quotation check
        if not self.instance and not attrs.get("quotation") and lines and all(line.get("quotation_line") for line in lines):
            source_ids = {line["quotation_line"].quotation_id for line in lines}
            if len(source_ids) == 1:
                candidate = lines[0]["quotation_line"].quotation
                if not models.SalesOrder.objects.filter(quotation=candidate).exists():
                    attrs["quotation"] = candidate

        quotation = attrs.get("quotation") or getattr(self.instance, "quotation", None)
        if quotation:
            if quotation.company_id != company.id or quotation.customer_id != customer.id or quotation.status not in {models.DocumentStatus.ACCEPTED, models.DocumentStatus.ORDERED}:
                raise serializers.ValidationError({"quotation": "Chỉ báo giá được khách hàng chấp nhận mới được chuyển thành đơn bán hàng."})
            if models.SalesOrder.objects.filter(quotation=quotation).exclude(pk=getattr(self.instance, "pk", None)).exists():
                raise serializers.ValidationError({"quotation": f"Báo giá đã được chuyển thành đơn bán hàng {quotation.converted_order.number}."})

        # Inherit payment term if not provided
        if not attrs.get("payment_term") and not getattr(self.instance, "payment_term", None):
            if quotation and quotation.payment_term:
                attrs["payment_term"] = quotation.payment_term
            else:
                default_pt = company.payment_terms.filter(status="ACTIVE", scope__in=["SALE", "BOTH"]).first()
                if default_pt:
                    attrs["payment_term"] = default_pt

        # BR-SAL-20: Check permission when overriding inherited payment term
        if quotation and quotation.payment_term and attrs.get("payment_term"):
            if attrs["payment_term"].id != quotation.payment_term_id:
                req = self.context.get("request")
                if req and not req.user.is_superuser:
                    from iam.permissions import has_effective_permission
                    if hasattr(req.user, "iam_account") and not has_effective_permission(req.user.iam_account, company, "SAL.ORDER.EDIT_PAYMENT_TERM", branch_id=getattr(attrs.get("branch"), "id", None)):
                        raise serializers.ValidationError({"payment_term": "Chỉ người dùng có quyền mới được đổi điều khoản thanh toán kế thừa (BR-SAL-20)."})

        validate_party_and_catalog(company, customer, lines)
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)
        payment_term = attrs.get("payment_term") or getattr(self.instance, "payment_term", None)
        default_warehouse = attrs.get("default_warehouse") or getattr(self.instance, "default_warehouse", None)
        validate_payment_term_selection(payment_term, company=company, scope="SALE", on_date=doc_date, previous=getattr(self.instance, "payment_term", None))
        prepare_document_method(attrs, self.instance, company=company, scope="RECEIPT", on_date=doc_date)

        for name, value in (("branch", branch), ("payment_term", payment_term), ("default_warehouse", default_warehouse)):
            if value and value.company_id != company.id:
                raise serializers.ValidationError({name: "Dữ liệu phải thuộc cùng doanh nghiệp."})

        contract = attrs.get("contract") or getattr(self.instance, "contract", None)
        if contract and (contract.customer_id != customer.id or contract.company_id != company.id or contract.status in {models.DocumentStatus.CANCELLED, models.DocumentStatus.TERMINATED}):
            raise serializers.ValidationError({"contract": "Hợp đồng nguồn không hợp lệ."})

        # BR-SAL-18: Goods requires delivery address, requested_delivery_date >= document_date
        has_goods = False
        for line in lines:
            item = line["item"]
            if item.item_type == "GOODS":
                has_goods = True
            # Default sales_uom or base_uom
            if not line.get("uom"):
                line["uom"] = item.sales_uom or item.base_uom
            # UOM conversion check
            from .order_services import _validate_uom_conversion
            if _validate_uom_conversion(item, line["uom"]) is None:
                raise serializers.ValidationError({"lines": f"Đơn vị tính {line['uom'].name} không có quy đổi hợp lệ về đơn vị cơ sở cho {item.name}."})

            # BR-SAL-19: Goods inventory warehouse
            if item.track_inventory and not (line.get("warehouse") or default_warehouse):
                raise serializers.ValidationError({"lines": f"Hàng theo dõi tồn kho ({item.name}) phải có kho xuất."})
            if item.item_type == "SERVICE":
                line["warehouse"] = None

            # Source quotation line check
            source = line.get("quotation_line")
            if source and (source.quotation.customer_id != customer.id or source.quotation.status not in {models.DocumentStatus.ACCEPTED, models.DocumentStatus.APPROVED, models.DocumentStatus.ORDERED}):
                raise serializers.ValidationError({"lines": "Dòng báo giá nguồn không hợp lệ."})
            if source:
                used_qs = source.order_lines.exclude(order__status=models.DocumentStatus.CANCELLED)
                if self.instance:
                    used_qs = used_qs.exclude(order=self.instance)
                used = used_qs.aggregate(total=Sum("quantity"))["total"] or 0
                if used + line["quantity"] > source.quantity:
                    raise serializers.ValidationError({"lines": "Số lượng đặt vượt phần còn lại của báo giá."})

            source_contract = line.get("contract_line")
            if source_contract and (not contract or source_contract.contract_id != contract.id):
                raise serializers.ValidationError({"lines": "Dòng hợp đồng nguồn không hợp lệ."})
            if source_contract and source_contract.maximum_quantity is not None:
                used_qs = source_contract.order_lines.exclude(order__status=models.DocumentStatus.CANCELLED)
                if self.instance:
                    used_qs = used_qs.exclude(order=self.instance)
                used = used_qs.aggregate(total=Sum("quantity"))["total"] or 0
                if used + line["quantity"] > source_contract.maximum_quantity:
                    raise serializers.ValidationError({"lines": "Số lượng đặt vượt hạn mức dòng hợp đồng."})

        delivery_addr = attrs.get("delivery_address") or getattr(self.instance, "delivery_address", "")
        if has_goods and not str(delivery_addr).strip():
            fallback = attrs.get("customer_address") or getattr(customer, "name", "")
            if fallback:
                attrs["delivery_address"] = fallback
            else:
                raise serializers.ValidationError({"delivery_address": "Địa điểm giao hàng là bắt buộc đối với hàng hóa cần giao (BR-SAL-18)."})

        req_del_date = attrs.get("requested_delivery_date") or getattr(self.instance, "requested_delivery_date", None)
        if req_del_date and req_del_date < doc_date:
            raise serializers.ValidationError({"requested_delivery_date": "Ngày giao dự kiến không được trước ngày lập đơn (BR-SAL-18)."})

        if contract and contract.maximum_value is not None and lines:
            orders = contract.orders.exclude(status=models.DocumentStatus.CANCELLED)
            if self.instance:
                orders = orders.exclude(pk=self.instance.pk)
            used_value = orders.aggregate(total=Sum("total_amount"))["total"] or 0
            proposed_value = sum((_calculate_order_line_values(l, currency)[3] for l in lines), Decimal("0"))
            if used_value + proposed_value > contract.maximum_value:
                raise serializers.ValidationError({"contract": "Giá trị đơn bán vượt hạn mức hợp đồng."})

        # Auto generate order number if not present
        if not self.instance and not attrs.get("number"):
            from .order_services import generate_order_number
            attrs["number"] = generate_order_number(company, branch=branch, document_date=doc_date)

        if attrs.get("number"):
            qs = models.SalesOrder.objects.filter(company=company, number=attrs["number"])
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"number": "Mã đơn bán hàng đã tồn tại trong doanh nghiệp."})

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        currency = validated_data.get("currency")
        subtotal = discount_amount = tax_amount = Decimal("0")
        processed_lines = []

        for index, line in enumerate(lines, 1):
            gross, disc, tax_val, line_tot = _calculate_order_line_values(line, currency)
            subtotal += gross
            discount_amount += disc
            tax_amount += tax_val
            line["discount_amount"] = disc
            line["tax_amount"] = tax_val
            line["line_total"] = line_tot
            line["line_no"] = line.pop("line_no", index)
            processed_lines.append(line)

        fee = validated_data.get("fee_amount", Decimal("0"))
        validated_data.update({
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "tax_amount": tax_amount,
            "total_amount": subtotal - discount_amount + tax_amount + fee,
            "status": models.DocumentStatus.DRAFT,
            "version": 1,
        })
        obj = models.SalesOrder.objects.create(**validated_data)
        for line in processed_lines:
            models.SalesOrderLine.objects.create(order=obj, **line)

        if obj.quotation_id:
            quote = models.SalesQuotation.objects.select_for_update().get(pk=obj.quotation_id)
            all_ordered = True
            for ql in quote.lines.all():
                used = ql.order_lines.exclude(order__status=models.DocumentStatus.CANCELLED).aggregate(t=Sum("quantity"))["t"] or Decimal("0")
                if used < ql.quantity:
                    all_ordered = False
                    break
            if all_ordered:
                quote.status = models.DocumentStatus.ORDERED
                quote.save(update_fields=("status", "updated_at"))

        req = self.context.get("request")
        if req:
            from .order_services import audit
            audit(req, obj, "CREATE", after={"number": obj.number, "total_amount": str(obj.total_amount), "status": obj.status})

        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        currency = validated_data.get("currency") or instance.currency
        for key, value in validated_data.items():
            setattr(instance, key, value)

        if lines is not None:
            instance.lines.all().delete()
            subtotal = discount_amount = tax_amount = Decimal("0")
            for index, line in enumerate(lines, 1):
                gross, disc, tax_val, line_tot = _calculate_order_line_values(line, currency)
                subtotal += gross
                discount_amount += disc
                tax_amount += tax_val
                line["discount_amount"] = disc
                line["tax_amount"] = tax_val
                line["line_total"] = line_tot
                models.SalesOrderLine.objects.create(order=instance, line_no=line.pop("line_no", index), **line)
            instance.subtotal = subtotal
            instance.discount_amount = discount_amount
            instance.tax_amount = tax_amount
            instance.total_amount = subtotal - discount_amount + tax_amount + instance.fee_amount

        instance.version += 1
        instance.save()

        req = self.context.get("request")
        if req:
            from .order_services import audit
            audit(req, instance, "EDIT", after={"number": instance.number, "total_amount": str(instance.total_amount), "version": instance.version})

        return instance


class DeliveryLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.SalesDeliveryLine
        fields = "__all__"
        read_only_fields = ("id", "delivery")


class DeliverySerializer(serializers.ModelSerializer):
    lines = DeliveryLineSerializer(many=True)

    class Meta:
        model = models.SalesDelivery
        fields = "__all__"
        read_only_fields = ("id", "status", "created_by", "confirmed_by", "confirmed_at", "created_at", "updated_at")

    def validate(self, attrs):
        if self.instance and self.instance.status != models.DeliveryStatus.DRAFT: raise serializers.ValidationError("Lần giao đã xác nhận không được sửa.")
        lines = attrs.get("lines", [])
        if not self.instance and not lines: raise serializers.ValidationError({"lines": "Phải có ít nhất một dòng giao."})
        company = attrs.get("company") or self.instance.company; order = attrs.get("order") or self.instance.order
        if order.company_id != company.id or order.status not in {models.DocumentStatus.APPROVED, models.DocumentStatus.PARTIALLY_DELIVERED}:
            raise serializers.ValidationError({"order": "Đơn bán chưa đủ điều kiện giao."})
        dtype = attrs.get("delivery_type") or self.instance.delivery_type; warehouse = attrs.get("warehouse") or getattr(self.instance, "warehouse", None)
        if dtype == "GOODS" and not warehouse: raise serializers.ValidationError({"warehouse": "Giao hàng hóa phải chọn kho xuất."})
        for line in lines:
            if line["order_line"].order_id != order.id: raise serializers.ValidationError({"lines": "Dòng giao không thuộc đơn bán."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines=validated_data.pop("lines"); obj=models.SalesDelivery.objects.create(**validated_data)
        for line in lines: models.SalesDeliveryLine.objects.create(delivery=obj, **line)
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        lines=validated_data.pop("lines",None)
        for key,value in validated_data.items(): setattr(instance,key,value)
        if lines is not None:
            instance.lines.all().delete()
            for line in lines: models.SalesDeliveryLine.objects.create(delivery=instance,**line)
        instance.save(); return instance


class InvoiceRequestLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InvoiceRequestLine
        fields = "__all__"
        read_only_fields = ("id", "request")


@extend_schema_serializer(component_name="SalesInvoiceRequest")
class InvoiceRequestSerializer(serializers.ModelSerializer):
    lines = InvoiceRequestLineSerializer(many=True)

    class Meta:
        model = models.InvoiceRequest
        fields = "__all__"
        read_only_fields = ("id", "status", "total_amount", "tax_amount", "external_reference", "cancellation_reason", "created_by", "created_at", "updated_at")

    def validate(self, attrs):
        if self.instance and self.instance.status != models.InvoiceRequestStatus.DRAFT: raise serializers.ValidationError("Chỉ đề nghị DRAFT được sửa.")
        lines=attrs.get("lines",[])
        if not self.instance and not lines: raise serializers.ValidationError({"lines":"Phải có ít nhất một dòng lập hóa đơn."})
        company=attrs.get("company") or self.instance.company; order=attrs.get("order") or self.instance.order; customer=attrs.get("customer") or self.instance.customer; currency=attrs.get("currency") or self.instance.currency
        if order.company_id != company.id or order.customer_id != customer.id or order.currency_id != currency.id: raise serializers.ValidationError("Đơn bán, khách hàng và loại tiền không tương thích.")
        for line in lines:
            order_line=line["order_line"]
            if order_line.order_id != order.id: raise serializers.ValidationError({"lines":"Dòng lập hóa đơn không thuộc đơn bán."})
            pending_qs=order_line.invoice_request_lines.exclude(request__status=models.InvoiceRequestStatus.CANCELLED)
            if self.instance: pending_qs=pending_qs.exclude(request=self.instance)
            pending=pending_qs.aggregate(total=Sum("quantity"))["total"] or 0
            if line["quantity"] + pending > order_line.delivered_quantity:
                raise serializers.ValidationError({"lines":"Số lượng đề nghị vượt số đã giao còn có thể lập hóa đơn."})
            delivery_line=line.get("delivery_line")
            if delivery_line and (delivery_line.order_line_id != order_line.id or delivery_line.delivery.status != models.DeliveryStatus.CONFIRMED):
                raise serializers.ValidationError({"lines":"Dòng giao nguồn không hợp lệ."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines=validated_data.pop("lines"); total=sum((x["quantity"]*x["unit_price"] for x in lines),Decimal("0")); tax=sum((x.get("tax_amount",Decimal("0")) for x in lines),Decimal("0"))
        obj=models.InvoiceRequest.objects.create(total_amount=total+tax,tax_amount=tax,**validated_data)
        for line in lines: models.InvoiceRequestLine.objects.create(request=obj,**line)
        return obj

    @transaction.atomic
    def update(self,instance,validated_data):
        lines=validated_data.pop("lines",None)
        for key,value in validated_data.items(): setattr(instance,key,value)
        if lines is not None:
            instance.lines.all().delete(); subtotal=sum((x["quantity"]*x["unit_price"] for x in lines),Decimal("0")); instance.tax_amount=sum((x.get("tax_amount",Decimal("0")) for x in lines),Decimal("0")); instance.total_amount=subtotal+instance.tax_amount
            for line in lines: models.InvoiceRequestLine.objects.create(request=instance,**line)
        instance.save(); return instance


@extend_schema_serializer(component_name="SalesApproval")
class ApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model=models.ApprovalDecision
        fields="__all__"
        read_only_fields=("id","decided_at")
