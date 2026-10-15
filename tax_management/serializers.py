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
        if models.TaxPeriod.objects.filter(company=company, start_date__lte=attrs.get("invoice_date", instance.invoice_date if instance else None), end_date__gte=attrs.get("invoice_date", instance.invoice_date if instance else None), status="CLOSED").exists():
            raise serializers.ValidationError({"invoice_date": "Không được tạo hoặc sửa hóa đơn trong kỳ thuế đã đóng."})
        if party and party.company_id != company.id:
            raise serializers.ValidationError({"party": "Đối tượng phải thuộc cùng doanh nghiệp."})
        invoice_type = attrs.get("invoice_type", getattr(instance, "invoice_type", "ORIGINAL"))
        original = attrs.get("original_invoice", getattr(instance, "original_invoice", None))
        if invoice_type in {"ADJUSTMENT", "REPLACEMENT"} and (not original or original.status != "ISSUED"):
            raise serializers.ValidationError({"original_invoice": "Hóa đơn xử lý phải tham chiếu hóa đơn gốc đã phát hành."})
        if original and (original.company_id != company.id or original.direction != attrs.get("direction", instance.direction if instance else None)):
            raise serializers.ValidationError({"original_invoice": "Hóa đơn gốc không cùng doanh nghiệp/chiều hóa đơn."})
        effect = attrs.get("adjustment_effect", getattr(instance, "adjustment_effect", ""))
        if invoice_type == "ADJUSTMENT" and effect not in {"INCREASE", "DECREASE"}:
            raise serializers.ValidationError({"adjustment_effect": "Phải xác định điều chỉnh tăng hoặc giảm."})
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
        return instance


class ValidationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InvoiceValidation
        fields = "__all__"
        read_only_fields = ("id", "checked_at")


class HistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InvoiceStatusHistory
        fields = "__all__"
        read_only_fields = ("id", "changed_at")


class DocumentLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.InvoiceDocumentLink
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at")

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


class ObligationSerializer(serializers.ModelSerializer):
    outstanding_amount = serializers.DecimalField(max_digits=24, decimal_places=4, read_only=True)
    period_code = serializers.CharField(source="period.code", read_only=True)

    class Meta:
        model = models.TaxObligation
        fields = "__all__"
        read_only_fields = ("id", "paid_amount", "status", "created_by", "created_at", "updated_at")

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


class PaymentLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TaxPaymentLink
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at")


@extend_schema_serializer(component_name="TaxReconciliation")
class ReconciliationSerializer(serializers.ModelSerializer):
    period_code = serializers.CharField(source="period.code", read_only=True)

    class Meta:
        model = models.ReconciliationRun
        fields = "__all__"
        read_only_fields = ("id", "status", "discrepancy_count", "details", "created_by", "created_at")


class ConnectorSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ConnectorConfig
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


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
