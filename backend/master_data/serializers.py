from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from iam.permissions import has_effective_permission
from . import models


class ModelValidationMixin:
    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance or self.Meta.model()
        for name, value in attrs.items():
            setattr(instance, name, value)
        read_only = set(getattr(self.Meta, "read_only_fields", ()))
        try:
            instance.full_clean(exclude=[
                field.name for field in instance._meta.fields
                if field.name in read_only or (field.null and field.name not in attrs)
            ])
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs


class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Currency
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_code(self, value):
        value = value.upper().strip()
        if len(value) != 3 or not value.isalpha():
            raise serializers.ValidationError("Mã tiền tệ phải gồm đúng 3 chữ cái.")
        return value


def _serializer(name, model, read_only=()):
    meta = type("Meta", (), {"model": model, "fields": "__all__", "read_only_fields": read_only})
    return type(name, (ModelValidationMixin, serializers.ModelSerializer), {"Meta": meta, "__module__": __name__})


ExchangeRateTypeSerializer = _serializer("ExchangeRateTypeSerializer", models.ExchangeRateType)
ExchangeRateSerializer = _serializer("ExchangeRateSerializer", models.ExchangeRate, ("id", "created_at"))
PaymentTermSerializer = _serializer("PaymentTermSerializer", models.PaymentTerm)
TaxRateSerializer = _serializer("TaxRateSerializer", models.TaxRate)
ProjectSerializer = _serializer("ProjectSerializer", models.Project)
CostCenterSerializer = _serializer("CostCenterSerializer", models.CostCenter)
PartySerializer = _serializer("PartySerializer", models.Party, ("id", "created_at", "updated_at"))
PartyRoleSerializer = _serializer("PartyRoleSerializer", models.PartyRole)
PartyAddressSerializer = _serializer("PartyAddressSerializer", models.PartyAddress)
BankSerializer = _serializer("BankSerializer", models.Bank)
PartyBankAccountSerializer = _serializer("PartyBankAccountSerializer", models.PartyBankAccount)
PartyContactSerializer = _serializer("PartyContactSerializer", models.PartyContact)
CustomerProfileSerializer = _serializer("CustomerProfileSerializer", models.CustomerProfile)
VendorProfileSerializer = _serializer("VendorProfileSerializer", models.VendorProfile)
class ItemCategorySerializer(ModelValidationMixin, serializers.ModelSerializer):
    version = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = models.ItemCategory
        fields = "__all__"
        read_only_fields = ("id", "depth", "path", "created_at", "updated_at")

    def validate_code(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        if self.instance:
            for field in ("company", "parent", "status", "code"):
                if field in attrs and attrs[field] != getattr(self.instance, field):
                    raise serializers.ValidationError({field: "Hãy dùng thao tác chuyên biệt hoặc giữ nguyên trường này."})
            if "applicable_types" in attrs:
                types = set(attrs["applicable_types"])
                if any(item.item_type not in types for item in self.instance.items.all()):
                    raise serializers.ValidationError({"applicable_types": "Nhóm đang có đối tượng không thuộc loại mới."})
                if any(set(child.applicable_types) - types for child in self.instance.children.all()):
                    raise serializers.ValidationError({"applicable_types": "Nhóm con đang có loại ngoài phạm vi mới."})
        elif "applicable_types" not in self.initial_data:
            raise serializers.ValidationError({"applicable_types": "Cần chọn loại đối tượng áp dụng."})
        return super().validate(attrs)
class UnitOfMeasureSerializer(ModelValidationMixin, serializers.ModelSerializer):
    version = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = models.UnitOfMeasure
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_code(self, value):
        return value.strip().upper()

    def validate_symbol(self, value):
        return value.strip()

    def validate(self, attrs):
        if not self.instance:
            missing = {field: "Trường này là bắt buộc." for field in ("code", "name", "symbol", "measurement_type", "decimal_places") if not self.initial_data.get(field) and self.initial_data.get(field) != 0}
            if missing:
                raise serializers.ValidationError(missing)
            if attrs.get("is_reference") and "factor_to_reference" not in attrs:
                attrs["factor_to_reference"] = 1
        else:
            if "company" in attrs and attrs["company"].pk != self.instance.company_id:
                raise serializers.ValidationError({"company": "Không thể chuyển đơn vị sang doanh nghiệp khác."})
            if "status" in attrs and attrs["status"] != self.instance.status:
                raise serializers.ValidationError({"status": "Hãy dùng thao tác đổi trạng thái."})
            if "measurement_type" in attrs and attrs["measurement_type"] != self.instance.measurement_type:
                used = (self.instance.items.exists() or self.instance.purchase_items.exists() or self.instance.sales_items.exists()
                        or self.instance.conversions_from.exists() or self.instance.conversions_to.exists()
                        or self.instance.fixed_conversions.exists())
                if used:
                    raise serializers.ValidationError({"measurement_type": "Đơn vị đã được sử dụng; không thể đổi nhóm đo lường."})
            if any(field in attrs and attrs[field] != getattr(self.instance, field) for field in ("is_reference", "reference_uom", "factor_to_reference")):
                if self.instance.fixed_conversions.exists():
                    raise serializers.ValidationError({"reference_uom": "Đơn vị tham chiếu đang có quy đổi phụ thuộc."})
                document_apps = {"inventory", "purchases", "sales", "accounts_payable"}
                used_on_document = any(
                    relation.field.name == "uom"
                    and relation.related_model._meta.app_label in document_apps
                    and relation.related_model.objects.filter(uom=self.instance).exists()
                    for relation in self.instance._meta.related_objects
                )
                if used_on_document:
                    raise serializers.ValidationError({"factor_to_reference": "Đơn vị đã được dùng trên chứng từ; không thể sửa quy đổi hồi tố."})
        return super().validate(attrs)
class ItemSerializer(ModelValidationMixin, serializers.ModelSerializer):
    version = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = models.Item
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_code(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        if not self.instance and attrs.get("category"):
            category = attrs["category"]
            if category.status != "ACTIVE":
                raise serializers.ValidationError({"category": "Chỉ được chọn nhóm đang hoạt động cho đối tượng mới."})
            mapping = {
                "revenue_account": "default_revenue_account", "expense_account": "default_expense_account",
                "inventory_account": "default_inventory_account", "cogs_account": "default_cogs_account",
                "purchase_tax_rate": "default_purchase_tax_rate", "sales_tax_rate": "default_sales_tax_rate",
                "track_inventory": "default_track_inventory",
            }
            for target, source in mapping.items():
                if target in self.initial_data:
                    continue
                ancestor = category
                while ancestor:
                    value = getattr(ancestor, source)
                    if value is not None:
                        if target != "track_inventory" or attrs.get("item_type") != "SERVICE":
                            attrs[target] = value
                        break
                    ancestor = ancestor.parent
        if self.instance:
            if "company" in attrs:
                raise serializers.ValidationError({"company": "Không thể chuyển đối tượng sang doanh nghiệp khác."})
            if "status" in attrs and attrs["status"] != self.instance.status:
                raise serializers.ValidationError({"status": "Hãy dùng thao tác đổi trạng thái."})
            if any(field in attrs and attrs[field] != getattr(self.instance, field) for field in ("item_type", "base_uom", "track_lot", "track_serial", "track_expiry")):
                from inventory.models import InventoryTransactionLine
                from purchases.models import PurchaseOrderLine
                from sales.models import SalesOrderLine
                if (self.instance.stock_balances.exists() or self.instance.inventory_lots.exists()
                    or InventoryTransactionLine.objects.filter(item=self.instance).exists()
                    or PurchaseOrderLine.objects.filter(item=self.instance).exists()
                    or SalesOrderLine.objects.filter(item=self.instance).exists()):
                    raise serializers.ValidationError("Không thể đổi loại, đơn vị cơ sở hoặc cách theo dõi khi đã có dữ liệu kho.")
        elif attrs.get("status", "ACTIVE") not in {"ACTIVE", "DRAFT"}:
            raise serializers.ValidationError({"status": "Đối tượng mới chỉ có thể là ACTIVE hoặc DRAFT."})
        return super().validate(attrs)


class ItemBarcodeSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = models.ItemBarcode
        fields = "__all__"
        read_only_fields = ("id",)

    def validate_code(self, value):
        return value.strip()
ItemUomConversionSerializer = _serializer("ItemUomConversionSerializer", models.ItemUomConversion)
class WarehouseSerializer(ModelValidationMixin, serializers.ModelSerializer):
    version = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = models.Warehouse
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_code(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        if self.instance:
            if "company" in attrs and attrs["company"].pk != self.instance.company_id:
                raise serializers.ValidationError({"company": "Không thể chuyển kho sang doanh nghiệp khác."})
            if "status" in attrs and attrs["status"] != self.instance.status:
                raise serializers.ValidationError({"status": "Hãy dùng thao tác đổi trạng thái."})
            if "is_default" in attrs and attrs["is_default"] != self.instance.is_default:
                raise serializers.ValidationError({"is_default": "Hãy dùng thao tác đặt kho mặc định."})
            if any(field in attrs and attrs[field] != getattr(self.instance, field) for field in ("branch", "warehouse_scope", "warehouse_type", "project")):
                if (self.instance.stock_balances.exists() or self.instance.stock_movements.exists()
                    or self.instance.inventory_transactions_in.exists() or self.instance.inventory_transactions_out.exists()):
                    raise serializers.ValidationError("Kho đã phát sinh dữ liệu; không thể đổi loại hoặc phạm vi quản lý.")
        else:
            missing = {field: "Trường này là bắt buộc." for field in ("code", "name", "warehouse_type", "warehouse_scope") if not self.initial_data.get(field)}
            if missing:
                raise serializers.ValidationError(missing)
            if attrs.get("status", "ACTIVE") not in {"ACTIVE", "DRAFT"}:
                raise serializers.ValidationError({"status": "Kho mới chỉ được tạo ACTIVE hoặc DRAFT."})
        return super().validate(attrs)


class InventoryLocationSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = models.InventoryLocation
        fields = "__all__"
        read_only_fields = ("id",)

    def validate_code(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        if self.instance:
            if "warehouse" in attrs and attrs["warehouse"].pk != self.instance.warehouse_id:
                raise serializers.ValidationError({"warehouse": "Không thể chuyển vị trí sang kho khác."})
            if "status" in attrs and attrs["status"] != self.instance.status:
                raise serializers.ValidationError({"status": "Hãy dùng thao tác đổi trạng thái."})
            if any(field in attrs and attrs[field] != getattr(self.instance, field) for field in ("parent", "can_store")):
                from inventory.models import StockBalance
                if StockBalance.objects.filter(location=self.instance).exclude(quantity=0).exists():
                    raise serializers.ValidationError("Vị trí còn tồn; không thể đổi cấu trúc hoặc khả năng chứa hàng.")
        return super().validate(attrs)
class CompanyBankAccountSerializer(ModelValidationMixin, serializers.ModelSerializer):
    version = serializers.DateTimeField(source="updated_at", read_only=True)
    bank_name = serializers.CharField(source="bank.name", read_only=True)
    currency_code = serializers.CharField(source="currency.code", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    masked_account_number = serializers.SerializerMethodField()

    class Meta:
        model = models.CompanyBankAccount
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "connection_status",
            "last_sync_at",
            "last_error",
        )

    def get_masked_account_number(self, obj):
        from .bank_account_services import mask_account_number
        return mask_account_number(obj.account_number)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        can_view_unmasked = (
            user is not None
            and (
                user.is_superuser
                or not hasattr(user, "iam_account")
                or (hasattr(user, "iam_account") and user.iam_account is None)
                or (
                    hasattr(user, "iam_account")
                    and user.iam_account is not None
                    and (
                        has_effective_permission(user.iam_account, instance.company, "MD.BANK_ACCOUNT.VIEW_UNMASKED")
                        or has_effective_permission(user.iam_account, instance.company, "MD.BANK_ACCOUNT.CREATE")
                        or has_effective_permission(user.iam_account, instance.company, "MD.BANK_ACCOUNT.EDIT")
                        or not user.iam_account.memberships.filter(company=instance.company).exists()  # fallback if superuser/staff
                    )
                )
            )
        )
        if not can_view_unmasked:
            from .bank_account_services import mask_account_number
            ret["account_number"] = mask_account_number(instance.account_number)
        return ret

    def validate(self, attrs):
        if self.instance:
            # BR-BANK-ACC-28, EF-15: check if transaction exists
            from decimal import Decimal
            from .bank_account_services import get_bank_account_impact
            impact = get_bank_account_impact(self.instance)
            has_trx = (
                impact["transactions_count"] > 0
                or Decimal(impact["bank_balance"]) != 0
                or impact["statements_count"] > 0
            )

            if has_trx:
                if "account_number" in attrs and attrs["account_number"] != self.instance.account_number:
                    raise serializers.ValidationError({"account_number": "Số tài khoản, ngân hàng và đồng tiền không được sửa trực tiếp sau khi đã phát sinh giao dịch. Hãy tạo tài khoản mới."})
                if "bank" in attrs and attrs["bank"].pk != self.instance.bank_id:
                    raise serializers.ValidationError({"bank": "Số tài khoản, ngân hàng và đồng tiền không được sửa trực tiếp sau khi đã phát sinh giao dịch. Hãy tạo tài khoản mới."})
                if "currency" in attrs and attrs["currency"].pk != self.instance.currency_id:
                    raise serializers.ValidationError({"currency": "Số tài khoản, ngân hàng và đồng tiền không được sửa trực tiếp sau khi đã phát sinh giao dịch. Hãy tạo tài khoản mới."})

            if "status" in attrs and attrs["status"] != self.instance.status:
                raise serializers.ValidationError({"status": "Hãy dùng thao tác đổi trạng thái (change-status)."})
            if "is_default" in attrs and attrs["is_default"] != self.instance.is_default:
                raise serializers.ValidationError({"is_default": "Hãy dùng thao tác đặt mặc định (set-default)."})
        else:
            if attrs.get("is_default"):
                raise serializers.ValidationError({"is_default": "Tạo tài khoản trước, sau đó dùng thao tác đặt mặc định."})

        return super().validate(attrs)


class ExpenseItemSerializer(ModelValidationMixin, serializers.ModelSerializer):
    parent_code = serializers.CharField(source="parent.code", read_only=True)
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    default_account_code = serializers.CharField(source="default_account.code", read_only=True)
    default_account_name = serializers.CharField(source="default_account.name", read_only=True)
    has_children = serializers.SerializerMethodField()

    class Meta:
        model = models.ExpenseItem
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )
        validators = []

    def get_has_children(self, obj):
        return obj.children.exists()

    def validate(self, attrs):
        company = attrs.get("company") or (self.instance.company if self.instance else None)
        code = attrs.get("code")
        if code and company:
            norm_code = code.strip().upper()
            attrs["code"] = norm_code
            qs = models.ExpenseItem.objects.filter(company=company, code__iexact=norm_code)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"code": "Mã khoản mục chi phí đã tồn tại trong doanh nghiệp."})

        if self.instance:
            from .expense_item_services import has_expense_item_transactions
            if has_expense_item_transactions(self.instance):
                # BR-MD-EXP-14, EF-08: Mã khoản mục đã phát sinh giao dịch không được thay đổi
                if "code" in attrs and attrs["code"] != self.instance.code:
                    raise serializers.ValidationError({"code": "Mã khoản mục chi phí đã phát sinh giao dịch không được thay đổi."})

            if "status" in attrs and attrs["status"] != self.instance.status:
                raise serializers.ValidationError({"status": "Hãy dùng thao tác đổi trạng thái (change-status)."})
        return super().validate(attrs)


class StatisticalCodeSerializer(ModelValidationMixin, serializers.ModelSerializer):
    parent_code = serializers.CharField(source="parent.code", read_only=True)
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    has_children = serializers.SerializerMethodField()

    class Meta:
        model = models.StatisticalCode
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )
        validators = []

    def get_has_children(self, obj):
        return obj.children.exists()

    def validate(self, attrs):
        company = attrs.get("company") or (self.instance.company if self.instance else None)
        code = attrs.get("code")
        if code and company:
            norm_code = code.strip().upper()
            attrs["code"] = norm_code
            qs = models.StatisticalCode.objects.filter(company=company, code__iexact=norm_code)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"code": "Mã thống kê đã tồn tại trong doanh nghiệp."})

        if self.instance:
            from .statistical_code_services import has_statistical_code_transactions
            if has_statistical_code_transactions(self.instance):
                # BR-MD-STAT-14, EF-07: Mã thống kê đã phát sinh giao dịch không được thay đổi mã định danh
                if "code" in attrs and attrs["code"] != self.instance.code:
                    raise serializers.ValidationError({"code": "Mã thống kê đã phát sinh giao dịch không được thay đổi."})

            if "status" in attrs and attrs["status"] != self.instance.status:
                raise serializers.ValidationError({"status": "Hãy dùng thao tác đổi trạng thái (change-status)."})
        return super().validate(attrs)


DocumentTypeSerializer = _serializer("DocumentTypeSerializer", models.DocumentType)
DocumentNumberingRuleSerializer = _serializer("DocumentNumberingRuleSerializer", models.DocumentNumberingRule)


