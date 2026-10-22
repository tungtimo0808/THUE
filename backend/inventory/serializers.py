from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_serializer
from rest_framework.validators import UniqueTogetherValidator

from master_data.models import ItemUomConversion, fixed_uom_factor, validate_uom_quantity
from django.core.exceptions import ValidationError as DjangoValidationError
from . import models


class PolicySerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    uom_name = serializers.CharField(source="base_uom.name", read_only=True)

    class Meta:
        model = models.InventoryPolicy
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        instance = self.instance
        if attrs.get("source_module", getattr(instance, "source_module", "")) == "INV_COUNT_RESOLUTION":
            raise serializers.ValidationError("Chứng từ xử lý kiểm kê chỉ được lập từ phương án đã phê duyệt.")
        company = attrs.get("company", instance.company if instance else None)
        warehouse = attrs.get("warehouse", instance.warehouse if instance else None)
        item = attrs.get("item", instance.item if instance else None)
        base_uom = attrs.get("base_uom", instance.base_uom if instance else None)
        if warehouse.company_id != company.id or item.company_id != company.id:
            raise serializers.ValidationError("Kho và hàng hóa phải thuộc cùng doanh nghiệp.")
        if not item.track_inventory or item.status != "ACTIVE":
            raise serializers.ValidationError({"item": "Hàng hóa không hoạt động hoặc không theo dõi tồn kho."})
        if base_uom.id != item.base_uom_id:
            raise serializers.ValidationError({"base_uom": "Phải dùng đơn vị cơ sở của hàng hóa."})
        minimum = attrs.get("minimum_quantity", instance.minimum_quantity if instance else Decimal("0"))
        maximum = attrs.get("maximum_quantity", instance.maximum_quantity if instance else None)
        if maximum is not None and minimum > maximum:
            raise serializers.ValidationError({"maximum_quantity": "Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu."})
        stock_exists = instance and models.StockBalance.objects.filter(
            warehouse=instance.warehouse, item=instance.item, quantity__gt=0
        ).exists()
        if stock_exists and any(
            name in attrs and attrs[name] != getattr(instance, name)
            for name in ("track_lot", "track_serial", "valuation_method")
        ):
            raise serializers.ValidationError("Không được đổi cách theo dõi Lot/Serial khi vẫn còn tồn.")
        return attrs


class LotSerialSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.LotSerial
        fields = "__all__"
        read_only_fields = ("id", "created_at")

    def validate(self, attrs):
        company = attrs.get("company", self.instance.company if self.instance else None)
        item = attrs.get("item", self.instance.item if self.instance else None)
        if item.company_id != company.id:
            raise serializers.ValidationError({"item": "Hàng hóa phải thuộc cùng doanh nghiệp."})
        has_serial_policy = models.InventoryPolicy.objects.filter(item=item, track_serial=True, is_active=True).exists()
        if attrs.get("tracking_type", getattr(self.instance, "tracking_type", None)) == "SERIAL" and not (item.track_serial or has_serial_policy):
            raise serializers.ValidationError({"tracking_type": "Hàng hóa chưa được cấu hình quản lý serial."})
        return attrs


# Messages that differ between UC-INV-03 (sale issue) and UC-INV-04 (other issue); anything else uses the generic text.
ISSUE_MESSAGES = {
    "INV_SALE_ISSUE": {
        "number": "Vui lòng nhập số phiếu xuất.", "duplicate": "Số phiếu xuất đã tồn tại. Vui lòng nhập số khác.",
        "no_lines": "Vui lòng chọn ít nhất một vật tư/hàng hóa để xuất kho.", "item": "vật tư/hàng hóa không hợp lệ để xuất kho.",
        "quantity": "số lượng xuất phải lớn hơn 0.", "warehouse": "vui lòng chọn kho xuất.",
        "account": "tài khoản hạch toán không hợp lệ. Vui lòng kiểm tra lại.",
    },
    "INV_OTHER_ISSUE": {
        "number": "Vui lòng nhập số chứng từ.", "duplicate": "Số chứng từ đã tồn tại. Vui lòng nhập số chứng từ khác.",
        "no_lines": "Vui lòng chọn ít nhất một hàng hóa cần xuất kho.", "item": "vui lòng chọn mã hàng hợp lệ.",
        "quantity": "số lượng xuất kho phải lớn hơn 0.", "warehouse": "vui lòng chọn kho xuất cho hàng hóa.",
        "account": "vui lòng chọn tài khoản hạch toán hợp lệ.",
    },
}
ISSUE_MESSAGES["INV_TRANSFER"] = {
    "number": "Vui lòng nhập số chứng từ.", "duplicate": "Số chứng từ đã tồn tại. Vui lòng nhập số chứng từ khác.",
    "no_lines": "Vui lòng chọn ít nhất một hàng hóa cần chuyển kho.", "item": "vui lòng chọn mã hàng hợp lệ.",
    "quantity": "số lượng chuyển kho phải lớn hơn 0.", "warehouse": "vui lòng chọn kho xuất cho hàng hóa.",
    "account": "vui lòng chọn tài khoản hạch toán hợp lệ.",
}
# Server-managed keys of document_metadata: clients cannot write them through the voucher API.
PROTECTED_METADATA = ("attachments", "receipt_status", "transit_warehouse", "received_at", "received_by",
    "received_lines", "discrepancies", "discrepancy_reason")
GENERIC_MESSAGES = {
    "number": "Vui lòng nhập số chứng từ.", "duplicate": "Số chứng từ đã tồn tại. Vui lòng nhập số khác.",
    "no_lines": "Vui lòng thêm ít nhất một vật tư/hàng hóa.", "item": "vật tư/hàng hóa không còn hoạt động.",
    "account": "tài khoản hạch toán không hợp lệ. Vui lòng kiểm tra lại.",
}
# AF02: contributing goods as capital needs the receiving party (EF14).
INVESTMENT_ACCOUNT_PREFIXES = ("221", "222", "228")


class TransactionLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InventoryTransactionLine
        fields = "__all__"
        read_only_fields = ("id", "transaction", "base_quantity", "line_value")


@extend_schema_serializer(component_name="InventoryTransaction")
class TransactionSerializer(serializers.ModelSerializer):
    lines = TransactionLineSerializer(many=True)
    source_warehouse_code = serializers.CharField(source="source_warehouse.code", read_only=True)
    source_warehouse_name = serializers.CharField(source="source_warehouse.name", read_only=True)
    destination_warehouse_code = serializers.CharField(source="destination_warehouse.code", read_only=True)
    destination_warehouse_name = serializers.CharField(source="destination_warehouse.name", read_only=True)

    class Meta:
        model = models.InventoryTransaction
        fields = "__all__"
        read_only_fields = (
            "id", "status", "workflow_snapshot", "inventory_applied", "total_value", "warnings",
            "gl_status", "gl_reference", "created_by", "submitted_at", "approved_at", "posted_at",
            "reversed_at", "created_at", "updated_at",
        )

    def get_validators(self):
        # Warehouse vouchers report a duplicate number with their own message in validate().
        validators = super().get_validators()
        data = getattr(self, "initial_data", None) or {}
        module = data.get("source_module") or getattr(self.instance, "source_module", "")
        if module in {"INV_OTHER", "INV_OTHER_ISSUE", "INV_SALE_ISSUE", "INV_TRANSFER"}:
            return [validator for validator in validators if not isinstance(validator, UniqueTogetherValidator)]
        return validators

    def to_internal_value(self, data):
        module = data.get("source_module") or getattr(self.instance, "source_module", "")
        if module in ISSUE_MESSAGES and "number" in data and not str(data.get("number") or "").strip():
            raise serializers.ValidationError({"number": [ISSUE_MESSAGES[module]["number"]]})
        return super().to_internal_value(data)

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.status not in {"DRAFT", "REJECTED"}:
            raise serializers.ValidationError("Chỉ giao dịch nháp hoặc bị từ chối mới được sửa.")
        company = attrs.get("company", instance.company if instance else None)
        if attrs.get("source_module", getattr(instance, "source_module", "")) == "INV_TRANSFER":
            self._validate_transfer(attrs, instance, company)
        source = attrs.get("source_warehouse", instance.source_warehouse if instance else None)
        destination = attrs.get("destination_warehouse", instance.destination_warehouse if instance else None)
        kind = attrs.get("transaction_type", instance.transaction_type if instance else None)
        if instance and instance.source_module in {"INV_OTHER", "INV_OTHER_ISSUE", "INV_SALE_ISSUE", "INV_TRANSFER"} and attrs.get("source_module", instance.source_module) != instance.source_module:
            raise serializers.ValidationError({"source_module": "Không thể đổi loại chứng từ kho."})
        if instance and instance.source_module == "INV_SALE_ISSUE" and attrs.get("source_reference", instance.source_reference) != instance.source_reference:
            raise serializers.ValidationError({"source_reference": "Không thể đổi chứng từ bán hàng tham chiếu."})
        if source and source.company_id != company.id or destination and destination.company_id != company.id:
            raise serializers.ValidationError("Kho phải thuộc cùng doanh nghiệp.")
        if kind in {"RECEIPT", "RETURN", "ADJUSTMENT_IN"} and not destination:
            raise serializers.ValidationError({"destination_warehouse": "Giao dịch nhập phải có kho đích."})
        if kind in {"ISSUE", "ADJUSTMENT_OUT"} and not source:
            raise serializers.ValidationError({"source_warehouse": "Giao dịch xuất phải có kho nguồn."})
        if kind == "TRANSFER" and (not source or not destination or source.id == destination.id):
            raise serializers.ValidationError("Kho nguồn và kho đích điều chuyển phải khác nhau.")
        if source:
            if source.status != "ACTIVE" and not (source.status == "INACTIVE" and kind == "ADJUSTMENT_OUT"):
                raise serializers.ValidationError({"source_warehouse": "Kho nguồn không hoạt động."})
            if kind == "TRANSFER" and not source.allow_transfer or kind != "TRANSFER" and not source.allow_issue:
                raise serializers.ValidationError({"source_warehouse": "Kho nguồn không cho phép nghiệp vụ này."})
        if destination:
            if destination.status != "ACTIVE":
                raise serializers.ValidationError({"destination_warehouse": "Kho đích không hoạt động."})
            if kind == "TRANSFER" and not destination.allow_transfer or kind != "TRANSFER" and not destination.allow_receipt:
                raise serializers.ValidationError({"destination_warehouse": "Kho đích không cho phép nghiệp vụ này."})
        if kind != "TRANSFER" and any(row and row.warehouse_type == "TRANSIT" for row in (source, destination)):
            raise serializers.ValidationError("Kho trung chuyển chỉ dùng cho giao dịch chuyển kho.")
        transaction_date = attrs.get("transaction_date", instance.transaction_date if instance else None)
        special_module = attrs.get("source_module", getattr(instance, "source_module", ""))
        issue_voucher = special_module in {"INV_OTHER_ISSUE", "INV_SALE_ISSUE"}
        message = ISSUE_MESSAGES.get(special_module, GENERIC_MESSAGES)
        if "document_metadata" in attrs:
            # Attachments are only changed through the attachment endpoints.
            metadata = {key: value for key, value in dict(attrs["document_metadata"] or {}).items() if key not in PROTECTED_METADATA}
            for key in PROTECTED_METADATA:
                if instance and key in (instance.document_metadata or {}):
                    metadata[key] = instance.document_metadata[key]
            metadata.setdefault("attachments", [])
            attrs["document_metadata"] = metadata
        if special_module in {"INV_OTHER", "INV_OTHER_ISSUE", "INV_SALE_ISSUE", "INV_TRANSFER"}:
            party = attrs.get("supplier", getattr(instance, "supplier", None))
            if party and (party.company_id != company.id or party.status != "ACTIVE"):
                raise serializers.ValidationError({"supplier": "Đối tượng không hợp lệ."})
            if kind != {"INV_OTHER": "RECEIPT", "INV_TRANSFER": "TRANSFER"}.get(special_module, "ISSUE"):
                raise serializers.ValidationError({"transaction_type": "Loại phiếu kho không hợp lệ."})
            if special_module in {"INV_OTHER_ISSUE", "INV_SALE_ISSUE"} and not str(attrs.get("reason", getattr(instance, "reason", "")) or "").strip():
                raise serializers.ValidationError({"reason": "Vui lòng nhập lý do xuất kho."})
            sale = None
            if special_module == "INV_SALE_ISSUE":
                from sales.models import GoodsSale
                sale = GoodsSale.objects.filter(pk=attrs.get("source_reference", getattr(instance, "source_reference", "")), company=company,
                    status="POSTED", inventory_handling="SEPARATE_ISSUE").first()
                if not sale:
                    raise serializers.ValidationError({"source_reference": "Chứng từ bán hàng không còn hợp lệ. Vui lòng chọn chứng từ khác."})
                if attrs.get("supplier", getattr(instance, "supplier", None)) != sale.customer:
                    raise serializers.ValidationError({"supplier": "Khách hàng trên phiếu xuất không khớp chứng từ bán hàng."})
            number = (attrs.get("number", getattr(instance, "number", "")) or "").strip()
            if not number:
                raise serializers.ValidationError({"number": message["number"]})
            if models.InventoryTransaction.objects.filter(company=company, number=number).exclude(pk=instance.pk if instance else None).exists():
                raise serializers.ValidationError({"number": message["duplicate"]})
            if not attrs.get("document_date", getattr(instance, "document_date", None)):
                raise serializers.ValidationError({"document_date": "Vui lòng chọn ngày chứng từ."})
            if not transaction_date:
                raise serializers.ValidationError({"transaction_date": "Vui lòng chọn ngày hạch toán."})
            if "lines" in attrs and not attrs["lines"]:
                raise serializers.ValidationError({"lines": message["no_lines"]})
            for index, line in enumerate(attrs.get("lines", []), start=1):
                if line["item"].status != "ACTIVE" or line["item"].company_id != company.id or issue_voucher and not line["item"].track_inventory:
                    raise serializers.ValidationError({"lines": f"Dòng {index}: {message['item']}"})
                if issue_voucher and line["quantity"] <= 0:
                    raise serializers.ValidationError({"lines": f"Dòng {index}: {message['quantity']}"})
                if special_module == "INV_OTHER_ISSUE" and line.get("unit_cost", Decimal("0")) < 0:
                    raise serializers.ValidationError({"lines": f"Dòng {index}: đơn giá xuất kho không hợp lệ."})
                for field in ("debit_account", "credit_account"):
                    account = line.get(field)
                    if account and (account.company_id != company.id or account.status != "ACTIVE" or not account.is_postable):
                        raise serializers.ValidationError({"lines": f"Dòng {index}: {message['account']}"})
                if issue_voucher:
                    warehouse = line.get("source_warehouse") or (source if special_module == "INV_SALE_ISSUE" else None)
                    if not warehouse:
                        raise serializers.ValidationError({"lines": f"Dòng {index}: {message['warehouse']}"})
                    if warehouse.company_id != company.id or warehouse.status != "ACTIVE" or not warehouse.allow_issue or warehouse.warehouse_type == "TRANSIT":
                        raise serializers.ValidationError({"lines": f"Dòng {index}: kho xuất không hợp lệ. Vui lòng chọn kho khác."})
                    request = self.context.get("request")
                    if request and not request.user.is_superuser:
                        from iam.permissions import has_effective_permission
                        if not has_effective_permission(request.user.iam_account, company, "INV.TRANSACTION.CREATE", warehouse_id=warehouse.pk):
                            raise serializers.ValidationError({"lines": f"Dòng {index}: bạn không có quyền lập phiếu tại kho này."})
                    if not line.get("debit_account") or not line.get("credit_account") or line["debit_account"] == line["credit_account"]:
                        raise serializers.ValidationError({"lines": f"Dòng {index}: {message['account']}"})
                if special_module == "INV_OTHER_ISSUE":
                    # BR10: the credit side is the inventory account (15x); the debit side follows the purpose of the issue.
                    if not line["credit_account"].code.startswith("15"):
                        raise serializers.ValidationError({"lines": f"Dòng {index}: TK Có phải là tài khoản hàng tồn kho (15x)."})
                    if line["debit_account"].code.startswith(INVESTMENT_ACCOUNT_PREFIXES) and not attrs.get("supplier", getattr(instance, "supplier", None)):
                        raise serializers.ValidationError({"supplier": "Vui lòng chọn đối tượng nhận góp vốn."})
                if special_module == "INV_SALE_ISSUE":
                    sale_line = line.get("sale_line")
                    if not sale_line or sale_line.sale_id != sale.pk or sale_line.item_id != line["item"].pk or sale_line.uom_id != line["uom"].pk:
                        raise serializers.ValidationError({"lines": f"Dòng {index}: hàng hóa không thuộc chứng từ bán hàng."})
                    if line.get("debit_account") != sale_line.cogs_account or line.get("credit_account") != sale_line.inventory_account:
                        raise serializers.ValidationError({"lines": f"Dòng {index}: tài khoản giá vốn không khớp chứng từ bán hàng."})
                    used = models.InventoryTransactionLine.objects.filter(sale_line=sale_line, transaction__status="POSTED").aggregate(total=Sum("quantity"))["total"] or Decimal("0")
                    if used >= sale_line.quantity:
                        raise serializers.ValidationError({"lines": f"Dòng {index}: hàng hóa đã được xuất kho đầy đủ."})
                    pending = sum(row["quantity"] for row in attrs.get("lines", []) if row.get("sale_line") == sale_line)
                    if pending > sale_line.quantity - used:
                        raise serializers.ValidationError({"lines": f"Dòng {index}: số lượng xuất vượt số lượng còn lại của chứng từ bán hàng."})
        for warehouse in (source, destination):
            if warehouse and transaction_date and ((warehouse.start_date and transaction_date < warehouse.start_date) or (warehouse.end_date and transaction_date > warehouse.end_date)):
                raise serializers.ValidationError("Ngày giao dịch nằm ngoài thời gian sử dụng kho.")
        for line in attrs.get("lines", []):
            location = line.get("location")
            destination_location = line.get("destination_location")
            if location and (not source or location.warehouse_id != source.pk):
                raise serializers.ValidationError({"lines": "Vị trí nguồn phải thuộc kho nguồn."})
            if destination_location and (not destination or destination_location.warehouse_id != destination.pk):
                raise serializers.ValidationError({"lines": "Vị trí đích phải thuộc kho đích."})
        original = attrs.get("original_transaction", instance.original_transaction if instance else None)
        if kind == "RETURN" and (not original or original.transaction_type != "ISSUE" or original.status != "POSTED"):
            raise serializers.ValidationError({"original_transaction": "Phải tham chiếu phiếu xuất đã ghi nhận."})
        if original and original.company_id != company.id:
            raise serializers.ValidationError({"original_transaction": "Giao dịch nguồn phải thuộc cùng doanh nghiệp."})
        if not attrs.get("reason", getattr(instance, "reason", "")) and kind in {"ADJUSTMENT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"}:
            raise serializers.ValidationError({"reason": "Điều chỉnh tồn kho bắt buộc có lý do."})
        return attrs

    def _validate_transfer(self, attrs, instance, company):
        """UC-INV-05: every line names its source and destination warehouse (AF06); messages EF05-EF14."""
        from .services import TRANSFER_KINDS, transit_warehouse
        text = ISSUE_MESSAGES["INV_TRANSFER"]
        metadata = attrs.get("document_metadata", getattr(instance, "document_metadata", None) or {}) or {}
        transfer_kind = metadata.get("transfer_kind") or "INTERNAL"
        if transfer_kind not in TRANSFER_KINDS:
            raise serializers.ValidationError({"document_metadata": "Loại chứng từ chuyển kho không hợp lệ."})
        if metadata.get("in_transit") and transfer_kind == "CONSIGNMENT":
            raise serializers.ValidationError({"document_metadata": "Hàng gửi bán đại lý không theo dõi qua kho trung chuyển."})
        if metadata.get("in_transit") and not transit_warehouse(company):
            raise serializers.ValidationError({"document_metadata": "Chưa khai báo kho trung chuyển (hàng đang đi đường) để theo dõi hàng đang vận chuyển."})
        party = attrs.get("supplier", getattr(instance, "supplier", None))
        if transfer_kind == "CONSIGNMENT" and not party:
            raise serializers.ValidationError({"supplier": "Vui lòng chọn đại lý nhận hàng gửi bán."})
        if "lines" not in attrs:
            return
        lines = attrs["lines"]
        if not lines:
            raise serializers.ValidationError({"lines": text["no_lines"]})
        request = self.context.get("request")
        for index, line in enumerate(lines, start=1):
            item = line["item"]
            if item.company_id != company.id or item.status != "ACTIVE" or not item.track_inventory:
                raise serializers.ValidationError({"lines": f"Dòng {index}: {text['item']}"})
            source, destination = line.get("source_warehouse"), line.get("destination_warehouse")
            if not source:
                raise serializers.ValidationError({"lines": f"Dòng {index}: vui lòng chọn kho xuất cho hàng hóa."})
            if not destination:
                raise serializers.ValidationError({"lines": f"Dòng {index}: vui lòng chọn kho nhập cho hàng hóa."})
            if source.pk == destination.pk:
                raise serializers.ValidationError({"lines": f"Dòng {index}: kho nhập phải khác kho xuất."})
            wanted_type = "CONSIGNMENT" if transfer_kind == "CONSIGNMENT" else None
            invalid = any(warehouse.company_id != company.id or warehouse.status != "ACTIVE" or not warehouse.allow_transfer
                or warehouse.warehouse_type == "TRANSIT" for warehouse in (source, destination))
            invalid = invalid or source.warehouse_type == "CONSIGNMENT" or (destination.warehouse_type == "CONSIGNMENT") != bool(wanted_type)
            if not invalid and request and not request.user.is_superuser:
                from iam.permissions import has_effective_permission
                invalid = not all(has_effective_permission(request.user.iam_account, company, "INV.TRANSACTION.TRANSFER", warehouse_id=warehouse.pk)
                    for warehouse in (source, destination))
            if invalid:
                hint = " Hàng gửi bán đại lý phải nhập vào kho hàng gửi bán." if transfer_kind == "CONSIGNMENT" and destination.warehouse_type != "CONSIGNMENT" else ""
                raise serializers.ValidationError({"lines": f"Dòng {index}: kho xuất hoặc kho nhập không hợp lệ.{hint}"})
            if line["quantity"] <= 0:
                raise serializers.ValidationError({"lines": f"Dòng {index}: {text['quantity']}"})
            if line.get("unit_cost", Decimal("0")) < 0:
                raise serializers.ValidationError({"lines": f"Dòng {index}: đơn giá chuyển kho không hợp lệ."})
            debit, credit = line.get("debit_account"), line.get("credit_account")
            if bool(debit) != bool(credit) or transfer_kind == "CONSIGNMENT" and not debit:
                raise serializers.ValidationError({"lines": f"Dòng {index}: {text['account']}"})
            if debit:
                # BR16: inventory accounts only; goods sent to an agent are carried on TK 157 (BR21).
                valid = all(account.company_id == company.id and account.status == "ACTIVE" and account.is_postable
                    and account.code.startswith("15") for account in (debit, credit))
                if not valid or transfer_kind == "CONSIGNMENT" and not debit.code.startswith("157"):
                    raise serializers.ValidationError({"lines": f"Dòng {index}: {text['account']}"})
        # The header mirrors the first line; posting uses each line's own warehouses.
        attrs["source_warehouse"] = lines[0]["source_warehouse"]
        attrs["destination_warehouse"] = lines[0]["destination_warehouse"]

    @staticmethod
    def _check_stock(obj):
        from .services import check_issue_stock
        if obj.source_module == "INV_OTHER_ISSUE":
            check_issue_stock(obj)
        elif obj.source_module == "INV_TRANSFER":
            check_issue_stock(obj, "Số lượng chuyển kho vượt quá tồn kho khả dụng.", "chuyển")

    def _prepare_line(self, company, raw, source_module=""):
        item, uom = raw["item"], raw["uom"]
        if item.company_id != company.id or uom.company_id != company.id or not item.track_inventory:
            raise serializers.ValidationError({"lines": "Hàng hóa hoặc đơn vị tính không hợp lệ."})
        try:
            validate_uom_quantity(uom, raw["quantity"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"lines": exc.messages}) from exc
        if uom.id == item.base_uom_id:
            factor = Decimal("1")
        else:
            conversion = ItemUomConversion.objects.filter(item=item, from_uom=uom, to_uom=item.base_uom).first()
            factor = conversion.factor if conversion else fixed_uom_factor(uom, item.base_uom)
            if factor is None:
                raise serializers.ValidationError({"lines": f"Thiếu quy đổi đơn vị cho hàng {item.code}."})
        raw["conversion_factor"] = factor
        raw["base_quantity"] = raw["quantity"] * factor
        if source_module in {"INV_OTHER", "INV_OTHER_ISSUE", "INV_SALE_ISSUE", "INV_TRANSFER"}:
            raw["unit_cost"] = raw.get("unit_cost", Decimal("0")) / factor
        raw["line_value"] = raw["base_quantity"] * raw.get("unit_cost", Decimal("0"))
        for field in ("location", "destination_location"):
            location = raw.get(field)
            if location and (location.warehouse.company_id != company.id or location.status != "ACTIVE" or not location.can_store):
                raise serializers.ValidationError({"lines": f"{field} không cho phép chứa hàng hoặc đã ngừng."})
        lot = raw.get("lot_serial")
        if lot and (lot.company_id != company.id or lot.item_id != item.id):
            raise serializers.ValidationError({"lines": "Lot/Serial không thuộc hàng hóa được chọn."})
        if lot and lot.tracking_type == "SERIAL" and raw["base_quantity"] != 1:
            raise serializers.ValidationError({"lines": "Mỗi dòng serial phải có số lượng cơ sở bằng 1."})
        return raw

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        obj = models.InventoryTransaction.objects.create(**validated_data)
        for raw in lines:
            models.InventoryTransactionLine.objects.create(transaction=obj, **self._prepare_line(obj.company, raw, obj.source_module))
        self._check_stock(obj)
        if obj.source_module in {"INV_OTHER", "INV_OTHER_ISSUE", "INV_SALE_ISSUE", "INV_TRANSFER"}:
            obj.total_value = sum((line.line_value for line in obj.lines.all()), Decimal("0"))
            obj.save(update_fields=("total_value", "updated_at"))
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        instance = super().update(instance, validated_data)
        if lines is not None:
            instance.lines.all().delete()
            for raw in lines:
                models.InventoryTransactionLine.objects.create(transaction=instance, **self._prepare_line(instance.company, raw, instance.source_module))
            self._check_stock(instance)
            if instance.source_module in {"INV_OTHER", "INV_OTHER_ISSUE", "INV_SALE_ISSUE", "INV_TRANSFER"}:
                instance.total_value = sum((line.line_value for line in instance.lines.all()), Decimal("0"))
                instance.save(update_fields=("total_value", "updated_at"))
        return instance


class BalanceSerializer(serializers.ModelSerializer):
    available_quantity = serializers.DecimalField(max_digits=20, decimal_places=4, read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)
    uom_name = serializers.CharField(source="item.base_uom.name", read_only=True)

    class Meta:
        model = models.StockBalance
        fields = "__all__"
        read_only_fields = (
            "id", "company", "warehouse", "item", "location", "lot_serial", "quantity",
            "reserved_quantity", "inventory_value", "average_cost", "updated_at",
        )


class MovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.StockMovement
        fields = "__all__"
        read_only_fields = (
            "id", "company", "transaction", "line", "warehouse", "item", "location",
            "lot_serial", "movement_date", "quantity_delta", "value_delta", "balance_quantity",
            "balance_value", "created_at",
        )


class CountLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.StockCountLine
        fields = "__all__"
        read_only_fields = ("id", "stock_count", "system_quantity", "variance_quantity")

    def validate_actual_quantity(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Số lượng kiểm kê không được âm.")
        return value


class StockCountSerializer(serializers.ModelSerializer):
    lines = CountLineSerializer(many=True)

    class Meta:
        model = models.StockCount
        fields = "__all__"
        read_only_fields = ("id", "status", "adjustment_transaction", "created_by", "created_at")

    def validate(self, attrs):
        company = attrs.get("company", self.instance.company if self.instance else None)
        warehouse = attrs.get("warehouse", self.instance.warehouse if self.instance else None)
        if warehouse.company_id != company.id:
            raise serializers.ValidationError({"warehouse": "Kho phải thuộc cùng doanh nghiệp."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        obj = models.StockCount.objects.create(**validated_data)
        for raw in lines:
            movements = models.StockMovement.objects.filter(
                warehouse=obj.warehouse, item=raw["item"], location=raw.get("location"),
                lot_serial=raw.get("lot_serial"), movement_date__lte=obj.count_date,
            )
            system = movements.aggregate(value=Sum("quantity_delta"))["value"] or Decimal("0")
            actual = raw.get("actual_quantity")
            models.StockCountLine.objects.create(
                stock_count=obj, system_quantity=system,
                variance_quantity=(actual - system) if actual is not None else Decimal("0"), **raw,
            )
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        if instance.status != "DRAFT":
            raise serializers.ValidationError("Chỉ phiên kiểm kê nháp mới được cập nhật.")
        lines = validated_data.pop("lines", None)
        instance = super().update(instance, validated_data)
        if lines is not None:
            instance.lines.all().delete()
            for raw in lines:
                movements = models.StockMovement.objects.filter(
                    warehouse=instance.warehouse, item=raw["item"], location=raw.get("location"),
                    lot_serial=raw.get("lot_serial"), movement_date__lte=instance.count_date,
                )
                system = movements.aggregate(value=Sum("quantity_delta"))["value"] or Decimal("0")
                actual = raw.get("actual_quantity")
                models.StockCountLine.objects.create(
                    stock_count=instance, system_quantity=system,
                    variance_quantity=(actual - system) if actual is not None else Decimal("0"), **raw,
                )
        return instance


class CountResolutionSerializer(serializers.ModelSerializer):
    count = serializers.UUIDField(source="count_line.stock_count_id", read_only=True)
    item_code = serializers.CharField(source="count_line.item.code", read_only=True)
    variance_quantity = serializers.DecimalField(source="count_line.variance_quantity", max_digits=20, decimal_places=4, read_only=True)

    class Meta:
        model = models.CountResolution
        fields = "__all__"
        read_only_fields = ("id", "company", "status", "decision_note", "adjustment_transaction", "created_by",
            "approved_by", "submitted_at", "approved_at", "created_at", "updated_at")

    def validate(self, attrs):
        from .count_resolution import validate_resolution
        return validate_resolution(attrs, self.instance, self.context["request"])


class AssemblyLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.AssemblyLine
        fields = "__all__"
        read_only_fields = ("id", "assembly")


@extend_schema_serializer(component_name="InventoryAssembly")
class AssemblySerializer(serializers.ModelSerializer):
    lines = AssemblyLineSerializer(many=True)

    class Meta:
        model = models.AssemblyOrder
        fields = "__all__"
        read_only_fields = ("id", "status", "created_by", "posted_at", "created_at")

    def validate(self, attrs):
        lines = attrs.get("lines", [])
        if not any(x["role"] == "COMPONENT" for x in lines) or not any(x["role"] == "OUTPUT" for x in lines):
            raise serializers.ValidationError({"lines": "Phải có ít nhất một thành phần và một thành phẩm."})
        company = attrs.get("company", self.instance.company if self.instance else None)
        warehouse = attrs.get("warehouse", self.instance.warehouse if self.instance else None)
        if warehouse.company_id != company.id or any(x["item"].company_id != company.id for x in lines):
            raise serializers.ValidationError("Kho và hàng hóa phải thuộc cùng doanh nghiệp.")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        obj = models.AssemblyOrder.objects.create(**validated_data)
        for raw in lines:
            models.AssemblyLine.objects.create(assembly=obj, **raw)
        return obj


class ValuationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ValuationRun
        fields = "__all__"
        read_only_fields = ("id", "total_quantity", "total_value", "status", "details", "created_by", "created_at")


@extend_schema_serializer(component_name="InventoryPeriod")
class PeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InventoryPeriod
        fields = "__all__"
        read_only_fields = ("id",)


@extend_schema_serializer(component_name="InventoryApproval")
class ApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ApprovalDecision
        fields = "__all__"
        read_only_fields = ("id", "decided_at")
