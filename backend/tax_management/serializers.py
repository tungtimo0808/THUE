from decimal import Decimal

from django.db import transaction
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_serializer

from . import models


@extend_schema_serializer(component_name="TaxInvoiceLine")
class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TaxInvoiceLine
        fields = "__all__"
        read_only_fields = ("id", "invoice", "taxable_amount", "tax_amount", "total_amount")


@extend_schema_serializer(component_name="TaxInvoice")
class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    party_name = serializers.CharField(source="party.name", read_only=True, default="")
    source_filename = serializers.SerializerMethodField()
    link_status = serializers.SerializerMethodField()

    def get_source_filename(self, obj):
        return obj.source_file.filename if hasattr(obj, "source_file") else ""

    def get_link_status(self, obj):
        if obj.direction != "INPUT":
            return "UNLINKED"
        from .linking import link_summary
        return link_summary(obj)["status"]

    class Meta:
        model = models.TaxInvoice
        fields = "__all__"
        read_only_fields = (
            "id", "subtotal", "tax_amount", "total_amount", "external_status", "external_reference",
            "status", "tax_eligible", "duplicate_suspected", "validation_summary", "issued_at",
            "received_at", "created_by", "created_at", "updated_at",
        )

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.status in {"ISSUED", "CANCELLED", "REPLACED", "ADJUSTED"}:
            raise serializers.ValidationError("Hóa đơn đã phát hành/xử lý không được sửa trực tiếp.")
        company = attrs.get("company", instance.company if instance else None)
        branch = attrs.get("branch", instance.branch if instance else None)
        party = attrs.get("party", instance.party if instance else None)
        currency = attrs.get("currency", instance.currency if instance else None)
        if branch.company_id != company.id or currency is None:
            raise serializers.ValidationError("Chi nhánh hoặc tiền tệ không hợp lệ.")
        direction = attrs.get("direction", instance.direction if instance else None)
        if direction == "INPUT" and not attrs.get("invoice_number", instance.invoice_number if instance else ""):
            raise serializers.ValidationError({"invoice_number": "Hóa đơn đầu vào cần có số hóa đơn."})
        if direction == "OUTPUT" and attrs.get("seller_tax_code", instance.seller_tax_code if instance else "") != company.tax_code:
            raise serializers.ValidationError({"seller_tax_code": "MST người bán phải khớp doanh nghiệp."})
        if instance and instance.status == "ISSUING":
            raise serializers.ValidationError("Hóa đơn đang chờ kết quả phát hành, không thể sửa.")
        if models.TaxPeriod.objects.filter(company=company, start_date__lte=attrs.get("invoice_date", instance.invoice_date if instance else None), end_date__gte=attrs.get("invoice_date", instance.invoice_date if instance else None), status="CLOSED").exists():
            raise serializers.ValidationError({"invoice_date": "Không được tạo hoặc sửa hóa đơn trong kỳ thuế đã đóng."})
        if party and party.company_id != company.id:
            raise serializers.ValidationError({"party": "Đối tượng phải thuộc cùng doanh nghiệp."})
        invoice_type = attrs.get("invoice_type", getattr(instance, "invoice_type", "ORIGINAL"))
        original = attrs.get("original_invoice", getattr(instance, "original_invoice", None))
        if instance and (invoice_type != instance.invoice_type or
                (original.pk if original else None) != instance.original_invoice_id):
            raise serializers.ValidationError("Không thể đổi loại hoặc hóa đơn gốc sau khi tạo hóa đơn.")
        if invoice_type in {"ADJUSTMENT", "REPLACEMENT"} and (not original or original.status not in {"ISSUED", "ADJUSTED"}):
            raise serializers.ValidationError({"original_invoice": "Hóa đơn xử lý phải tham chiếu hóa đơn gốc đã phát hành."})
        if original and instance and original.pk == instance.pk:
            raise serializers.ValidationError({"original_invoice": "Không thể chọn chính hóa đơn đang xử lý."})
        if original and (original.company_id != company.id or original.direction != attrs.get("direction", instance.direction if instance else None)):
            raise serializers.ValidationError({"original_invoice": "Hóa đơn gốc không cùng doanh nghiệp/chiều hóa đơn."})
        effect = attrs.get("adjustment_effect", getattr(instance, "adjustment_effect", ""))
        if invoice_type == "ADJUSTMENT" and effect not in {"INCREASE", "DECREASE", "INFO"}:
            raise serializers.ValidationError({"adjustment_effect": "Phải xác định điều chỉnh tăng hoặc giảm."})
        if direction == "OUTPUT" and invoice_type in {"ADJUSTMENT", "REPLACEMENT"}:
            raw = attrs.get("raw_data", getattr(instance, "raw_data", {})) or {}
            if not str(raw.get("correction_reason", "")).strip():
                raise serializers.ValidationError({"raw_data": "Nhập lý do hoặc nội dung xử lý hóa đơn."})
            if models.IntegrationRequest.objects.filter(invoice=original, task_type="CANCEL", status="PENDING").exists():
                raise serializers.ValidationError({"original_invoice": "Hóa đơn gốc đang chờ kết quả hủy."})
            if invoice_type == "REPLACEMENT" and models.TaxInvoice.objects.filter(
                original_invoice=original, invoice_type="REPLACEMENT"
            ).exclude(pk=instance.pk if instance else None).exclude(status="ISSUE_FAILED").exists():
                raise serializers.ValidationError({"original_invoice": "Hóa đơn gốc đã có bản thay thế; hãy xử lý bản hiện có."})
            if invoice_type == "ADJUSTMENT" and effect == "INFO" and any(
                row["quantity"] * row["unit_price"] - row.get("discount_amount", Decimal("0")) != 0
                for row in attrs.get("lines", [])):
                raise serializers.ValidationError({"lines": "Điều chỉnh thông tin không được tạo chênh lệch tiền."})
        return attrs

    def _prepare(self, company, row):
        if row.get("item") and row["item"].company_id != company.id:
            raise serializers.ValidationError({"lines": "Hàng hóa phải thuộc cùng doanh nghiệp."})
        taxable = row["quantity"] * row["unit_price"] - row.get("discount_amount", Decimal("0"))
        if taxable < 0:
            raise serializers.ValidationError({"lines": "Chiết khấu không được vượt giá trị dòng."})
        tax = taxable * row["tax_rate"] / Decimal("100")
        row["taxable_amount"], row["tax_amount"], row["total_amount"] = taxable, tax, taxable + tax
        return row

    def _totals(self, invoice):
        subtotal = sum((line.taxable_amount for line in invoice.lines.all()), Decimal("0"))
        tax = sum((line.tax_amount for line in invoice.lines.all()), Decimal("0"))
        invoice.subtotal, invoice.tax_amount, invoice.total_amount = subtotal, tax, subtotal + tax
        invoice.save(update_fields=("subtotal", "tax_amount", "total_amount", "updated_at"))

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        validated_data["seller_tax_code"] = validated_data["seller_tax_code"].strip()
        validated_data["buyer_tax_code"] = validated_data.get("buyer_tax_code", "").strip()
        validated_data["status"] = "RECEIVED" if validated_data["direction"] == "INPUT" else "DRAFT"
        obj = models.TaxInvoice.objects.create(**validated_data)
        if obj.direction == "OUTPUT" and obj.original_invoice_id:
            models.TaxInvoiceLink.objects.create(company=obj.company, original=obj.original_invoice,
                target=obj, link_type=obj.invoice_type, reason=obj.raw_data["correction_reason"])
        for row in lines:
            models.TaxInvoiceLine.objects.create(invoice=obj, **self._prepare(obj.company, row))
        self._totals(obj)
        return obj

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        instance = super().update(instance, validated_data)
        if lines is not None:
            instance.lines.all().delete()
            for row in lines:
                models.TaxInvoiceLine.objects.create(invoice=instance, **self._prepare(instance.company, row))
            self._totals(instance)
        if instance.direction == "OUTPUT" and instance.status in {"VALIDATED", "BLOCKED", "ISSUE_FAILED"}:
            instance.status = "DRAFT"
            instance.validation_summary = {}
            instance.external_status = ""
            instance.validation_results.all().delete()
            instance.save(update_fields=("status", "validation_summary", "external_status", "updated_at"))
        return instance


class ValidationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InvoiceValidation
        fields = "__all__"
        read_only_fields = ("id", "checked_at")


class ValidationRunSerializer(serializers.ModelSerializer):
    results = ValidationSerializer(many=True, read_only=True)
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = models.InvoiceValidationRun
        fields = "__all__"

    def get_is_current(self, obj):
        from .input_validation import run_is_current
        return run_is_current(obj)


class HistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InvoiceStatusHistory
        fields = "__all__"
        read_only_fields = ("id", "changed_at")


class DocumentLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InvoiceDocumentLink
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at", "allocated_amount_before_tax",
                            "allocated_tax_amount", "status", "document_version", "removed_at",
                            "removed_by", "removal_reason")

    def validate(self, attrs):
        if attrs["invoice"].company_id != attrs["company"].id:
            raise serializers.ValidationError("Hóa đơn và liên kết phải cùng doanh nghiệp.")
        return attrs


class PeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TaxPeriod
        fields = "__all__"
        read_only_fields = ("id",)


class SummarySerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="period.code", read_only=True)

    class Meta:
        model = models.TaxSummary
        fields = "__all__"
        read_only_fields = ("id", "version", "input_taxable_amount", "input_tax_amount", "output_taxable_amount", "output_tax_amount", "tax_difference", "exception_count", "details", "created_by", "created_at")


class VatDeductionDocumentSerializer(serializers.ModelSerializer):
    input_account_code = serializers.CharField(source="input_account.code", read_only=True)
    output_account_code = serializers.CharField(source="output_account.code", read_only=True)

    class Meta:
        model = models.VatDeductionDocument
        fields = ("id", "company", "period", "calculation", "amount", "input_account", "input_account_code",
                  "output_account", "output_account_code", "document_date", "posting_date", "description",
                  "status", "created_at")


class VatCalculationSerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="period.code", read_only=True)
    source_is_current = serializers.SerializerMethodField()
    document = serializers.SerializerMethodField()

    def get_source_is_current(self, obj):
        from .vat import is_current
        return is_current(obj)

    def get_document(self, obj):
        document = obj.deduction_documents.select_related("input_account", "output_account").first()
        return VatDeductionDocumentSerializer(document).data if document else None

    class Meta:
        model = models.VatCalculation
        fields = ("id", "company", "period", "period_code", "version", "rule_version", "status",
                  "source_is_current", "input_tax_amount", "input_deductible_amount", "input_pending_amount",
                  "output_tax_amount", "carry_forward_in", "deducted_amount", "payable_amount",
                  "carry_forward_out", "warnings", "sources", "document", "calculated_at")


class FilingSerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="period.code", read_only=True)

    class Meta:
        model = models.TaxFiling
        fields = "__all__"
        read_only_fields = ("id", "warnings", "status", "submission_reference", "submitted_at", "created_by", "created_at", "updated_at")

    def validate(self, attrs):
        if attrs["summary"].period_id != attrs["period"].id or attrs["period"].company_id != attrs["company"].id:
            raise serializers.ValidationError("Kỳ, bảng tổng hợp và doanh nghiệp không khớp.")
        return attrs


class TaxDeclarationSerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="period.code", read_only=True)
    calculation_version = serializers.IntegerField(source="source_calculation.version", read_only=True)
    source_is_current = serializers.SerializerMethodField()

    def get_source_is_current(self, obj):
        from .declarations import source_current
        return source_current(obj)

    class Meta:
        model = models.TaxDeclaration
        fields = ("id", "company", "period", "period_code", "form_code", "form_version",
                  "version", "declaration_type", "source_calculation", "calculation_version",
                  "source_is_current", "indicators", "warnings", "preparation_status", "notes",
                  "row_version", "confirmed_at", "created_by", "confirmed_by", "created_at", "updated_at")


class TaxSubmissionEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TaxSubmissionEvent
        fields = ("id", "from_status", "to_status", "evidence_reference", "note", "actor", "created_at")


class TaxSubmissionSerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="declaration.period.code", read_only=True)
    events = TaxSubmissionEventSerializer(many=True, read_only=True)

    class Meta:
        model = models.TaxSubmission
        fields = ("id", "company", "declaration", "declaration_version", "declaration_snapshot",
                  "snapshot_hash", "period_code", "channel", "verification_source", "status",
                  "external_reference", "submitted_at", "evidence_reference", "note",
                  "created_by", "created_at", "updated_at", "events")


class ObligationSerializer(serializers.ModelSerializer):
    outstanding_amount = serializers.DecimalField(max_digits=24, decimal_places=4, read_only=True)
    period_code = serializers.CharField(source="period.code", read_only=True)
    due_status = serializers.SerializerMethodField()
    due_days = serializers.SerializerMethodField()

    def get_due_status(self, obj):
        from .obligations import due_status
        return due_status(obj)[0]

    def get_due_days(self, obj):
        from .obligations import due_status
        return due_status(obj)[1]

    class Meta:
        model = models.TaxObligation
        fields = "__all__"
        read_only_fields = ("id", "paid_amount", "status", "source_declaration", "basis_status", "created_by", "created_at", "updated_at")

    def validate(self, attrs):
        company = attrs.get("company", self.instance.company if self.instance else None)
        period = attrs.get("period", self.instance.period if self.instance else None)
        filing = attrs.get("filing", self.instance.filing if self.instance else None)
        adjustment = attrs.get("adjustment_amount", self.instance.adjustment_amount if self.instance else Decimal("0"))
        reason = attrs.get("reason", self.instance.reason if self.instance else "")
        if period.company_id != company.id or filing and (filing.company_id != company.id or filing.period_id != period.id):
            raise serializers.ValidationError("Kỳ, hồ sơ và doanh nghiệp không khớp.")
        if adjustment and not reason:
            raise serializers.ValidationError({"reason": "Điều chỉnh nghĩa vụ thuế phải có lý do."})
        return attrs


class TaxPaymentOrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TaxPaymentOrderLine
        fields = ("id", "obligation", "content", "subitem_code", "amount")


class TaxPaymentOrderSerializer(serializers.ModelSerializer):
    lines = TaxPaymentOrderLineSerializer(many=True, read_only=True)

    class Meta:
        model = models.TaxPaymentOrder
        fields = ("id", "company", "number", "payment_method", "treasury", "treasury_account",
                  "payment_date", "total_amount", "status", "lines", "created_by", "created_at")


class PaymentLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TaxPaymentLink
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at")


@extend_schema_serializer(component_name="TaxReconciliation")
class ReconciliationSerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="period.code", read_only=True)
    source_is_current = serializers.SerializerMethodField()

    def get_source_is_current(self, obj):
        from . import reconciliation
        return reconciliation.is_current(obj)

    class Meta:
        model = models.ReconciliationRun
        fields = "__all__"
        read_only_fields = ("id", "status", "discrepancy_count", "details", "created_by", "created_at")


class ConnectorSerializer(serializers.ModelSerializer):
    connection_status = serializers.SerializerMethodField()

    class Meta:
        model = models.ConnectorConfig
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_config(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Cấu hình phải là một đối tượng.")
        forbidden = {"password", "api_secret", "private_key", "access_token", "refresh_token", "token"}
        def contains_secret(item):
            if isinstance(item, dict):
                return any(str(key).lower() in forbidden or contains_secret(child) for key, child in item.items())
            if isinstance(item, list):
                return any(contains_secret(child) for child in item)
            return False
        if contains_secret(value):
            raise serializers.ValidationError("Không lưu mật khẩu hoặc token trong cấu hình. Chỉ dùng tham chiếu credential.")
        capabilities = value.get("capabilities", [])
        allowed = {"INVOICE_SYNC_INPUT", "INVOICE_SYNC_OUTPUT", "INVOICE_LOOKUP", "INVOICE_ISSUE",
                   "INVOICE_ADJUST", "INVOICE_REPLACE", "INVOICE_CANCEL", "INVOICE_STATUS_QUERY",
                   "DECLARATION_SUBMIT", "DECLARATION_STATUS_QUERY"}
        if not isinstance(capabilities, list) or any(capability not in allowed for capability in capabilities):
            raise serializers.ValidationError("Capability không hợp lệ.")
        return value

    def get_connection_status(self, instance):
        return "NOT_VERIFIED" if instance.is_active else "INACTIVE"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["config"] = {key: value for key, value in data.get("config", {}).items()
                          if key not in {"callback_secret", "password", "api_secret", "private_key", "access_token", "refresh_token", "token"}}
        return data


@extend_schema_serializer(component_name="TaxIntegration")
class IntegrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.IntegrationRequest
        fields = "__all__"
        read_only_fields = ("id", "response_payload", "status", "error_message", "created_by", "created_at", "updated_at")


class ExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TaxExport
        fields = "__all__"
        read_only_fields = ("id", "data_snapshot", "warnings", "submission_status", "submission_reference", "exported_by", "exported_at")
