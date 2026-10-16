from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from .models import ReportDefinition, ReportExport, ReportLineMapping, ReportRun


@extend_schema_serializer(component_name="ReportingLineMapping")
class ReportLineMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportLineMapping
        fields = "__all__"

    def validate(self, attrs):
        prefixes = attrs.get("account_prefixes", getattr(self.instance, "account_prefixes", []))
        if not isinstance(prefixes, list) or any(not isinstance(value, str) for value in prefixes):
            raise serializers.ValidationError({"account_prefixes": "Phải là danh sách tiền tố tài khoản."})
        return attrs


@extend_schema_serializer(component_name="ReportingDefinition")
class ReportDefinitionSerializer(serializers.ModelSerializer):
    line_mappings = ReportLineMappingSerializer(many=True, read_only=True)

    class Meta:
        model = ReportDefinition
        fields = "__all__"


@extend_schema_serializer(component_name="ReportingRun")
class ReportRunSerializer(serializers.ModelSerializer):
    report_code = serializers.CharField(source="report.code", read_only=True)
    report_name = serializers.CharField(source="report.name", read_only=True)

    class Meta:
        model = ReportRun
        fields = "__all__"
        read_only_fields = (
            "id", "company", "report", "requested_by", "parameters", "result",
            "status", "row_count", "source_trace", "generated_at",
        )


@extend_schema_serializer(component_name="ReportingExport")
class ReportExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportExport
        fields = "__all__"
        read_only_fields = ("id", "run", "requested_by", "format", "file_name", "content_type", "created_at")


class ReportRequestSerializer(serializers.Serializer):
    company = serializers.UUIDField()
    report_code = serializers.CharField(max_length=50)
    period = serializers.UUIDField(required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    comparison_period = serializers.UUIDField(required=False)
    branch = serializers.UUIDField(required=False)
    department = serializers.UUIDField(required=False)
    warehouse = serializers.UUIDField(required=False)
    bank_account = serializers.UUIDField(required=False)
    account = serializers.UUIDField(required=False)
    party = serializers.UUIDField(required=False)
    item = serializers.UUIDField(required=False)
    status = serializers.CharField(required=False)
    as_of_date = serializers.DateField(required=False)
    dimensions = serializers.ListField(child=serializers.CharField(), required=False)

    def validate(self, attrs):
        if attrs.get("date_from") and attrs.get("date_to") and attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError("Từ ngày không được lớn hơn đến ngày.")
        return attrs


class ExportRequestSerializer(serializers.Serializer):
    format = serializers.ChoiceField(choices=("XLSX", "PDF", "PRINT"))
