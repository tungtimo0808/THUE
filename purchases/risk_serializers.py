from rest_framework import serializers

from master_data.models import Party
from purchases.models import SupplierIncident, SupplierRiskAssessment, SupplierRiskConfig, SupplierRiskOverrideLog


class SupplierRiskAssessmentSerializer(serializers.ModelSerializer):
    supplier_code = serializers.CharField(source="supplier.code", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    supplier_tax_code = serializers.CharField(source="supplier.tax_code", read_only=True)
    assessed_by_name = serializers.SerializerMethodField()
    is_valid = serializers.SerializerMethodField()

    class Meta:
        model = SupplierRiskAssessment
        fields = [
            "id",
            "company",
            "supplier",
            "supplier_code",
            "supplier_name",
            "supplier_tax_code",
            "assessment_date",
            "valid_until",
            "score",
            "risk_level",
            "is_blocked",
            "tax_status",
            "tax_code_status_verified",
            "criteria_breakdown",
            "data_summary",
            "assessed_by",
            "assessed_by_name",
            "notes",
            "version",
            "is_valid",
            "created_at",
        ]
        read_only_fields = fields

    def get_assessed_by_name(self, obj):
        if obj.assessed_by and hasattr(obj.assessed_by, "user"):
            return obj.assessed_by.user.get_full_name() or obj.assessed_by.user.username
        return ""

    def get_is_valid(self, obj):
        from django.utils import timezone
        return obj.valid_until >= timezone.now()


class SupplierRiskConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierRiskConfig
        fields = [
            "id",
            "company",
            "validity_days",
            "low_threshold",
            "medium_threshold",
            "invalid_invoice_points",
            "duplicate_invoice_points",
            "late_delivery_tier1_points",
            "late_delivery_tier2_points",
            "return_ratio_tier1_points",
            "return_ratio_tier2_points",
            "incident_points",
            "require_high_risk_workflow",
            "custom_rules",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "created_at", "updated_at"]


class SupplierIncidentSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SupplierIncident
        fields = [
            "id",
            "company",
            "supplier",
            "incident_type",
            "title",
            "description",
            "status",
            "related_order",
            "related_contract",
            "reported_by",
            "reported_by_name",
            "resolved_by",
            "resolved_by_name",
            "resolved_at",
            "resolution_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "created_at", "updated_at", "reported_by"]

    def get_reported_by_name(self, obj):
        if obj.reported_by and hasattr(obj.reported_by, "user"):
            return obj.reported_by.user.get_full_name() or obj.reported_by.user.username
        return ""

    def get_resolved_by_name(self, obj):
        if obj.resolved_by and hasattr(obj.resolved_by, "user"):
            return obj.resolved_by.user.get_full_name() or obj.resolved_by.user.username
        return ""


class SupplierRiskOverrideLogSerializer(serializers.ModelSerializer):
    override_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SupplierRiskOverrideLog
        fields = [
            "id",
            "company",
            "supplier",
            "assessment",
            "risk_level",
            "document_type",
            "document_id",
            "reason",
            "override_by",
            "override_by_name",
            "override_at",
            "is_exception_approved",
            "approved_by",
            "approval_notes",
        ]
        read_only_fields = fields

    def get_override_by_name(self, obj):
        if obj.override_by and hasattr(obj.override_by, "user"):
            return obj.override_by.user.get_full_name() or obj.override_by.user.username
        return ""


class RiskCheckInputSerializer(serializers.Serializer):
    supplier_id = serializers.UUIDField(required=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    external_tax_status = serializers.CharField(required=False, allow_blank=True, default="ACTIVE")
    simulate_external_failure = serializers.BooleanField(required=False, default=False)


class TransactionCheckInputSerializer(serializers.Serializer):
    supplier_id = serializers.UUIDField(required=True)
    document_type = serializers.CharField(required=True)
    document_id = serializers.CharField(required=False, allow_blank=True, default="")
    reason = serializers.CharField(required=False, allow_blank=True, default="")
    confirm = serializers.BooleanField(required=False, default=False)
