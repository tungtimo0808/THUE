from rest_framework import serializers

from .models import AuditChange, AuditLog


class AuditChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditChange
        fields = ("id", "field_name", "old_value_json", "new_value_json")
        read_only_fields = fields


class AuditLogSerializer(serializers.ModelSerializer):
    actor_type_display = serializers.CharField(source="get_actor_type_display", read_only=True)
    event_category_display = serializers.CharField(source="get_event_category_display", read_only=True)
    result_display = serializers.CharField(source="get_result_display", read_only=True)
    severity_display = serializers.CharField(source="get_severity_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    changes = AuditChangeSerializer(many=True, read_only=True)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "company",
            "branch",
            "branch_name",
            "occurred_at",
            "actor_user",
            "actor_type",
            "actor_type_display",
            "actor_name_snapshot",
            "role_assignment",
            "module_code",
            "event_category",
            "event_category_display",
            "action_code",
            "entity_type",
            "entity_id",
            "resource_code",
            "description",
            "result",
            "result_display",
            "failure_reason",
            "severity",
            "severity_display",
            "source",
            "source_display",
            "request_id",
            "correlation_id",
            "ip_address",
            "user_agent",
            "reason",
            "is_archived",
            "integrity_hash",
            "changes",
        )
        read_only_fields = fields


class AuditLogExportRequestSerializer(serializers.Serializer):
    format = serializers.ChoiceField(choices=["json", "csv"], default="json")
    from_date = serializers.CharField(required=False, allow_blank=True)
    to_date = serializers.CharField(required=False, allow_blank=True)
    module_code = serializers.CharField(required=False, allow_blank=True)
    event_category = serializers.CharField(required=False, allow_blank=True)
    result = serializers.CharField(required=False, allow_blank=True)
    severity = serializers.CharField(required=False, allow_blank=True)
    source = serializers.CharField(required=False, allow_blank=True)
    resource_code = serializers.CharField(required=False, allow_blank=True)
    correlation_id = serializers.CharField(required=False, allow_blank=True)
    q = serializers.CharField(required=False, allow_blank=True)
