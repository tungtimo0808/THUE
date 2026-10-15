from rest_framework import serializers

from master_data.models import DocumentType
from organization.models import Branch

from .models import (
    DateSource,
    DocumentNumberHistory,
    DocumentNumberingRule,
    GenerationEvent,
    NumberingMode,
    NumberingRuleStatus,
    NumberingSequenceTracker,
    OverflowStrategy,
    ResetCycle,
    SequenceScope,
)


class DocumentNumberingRuleSerializer(serializers.ModelSerializer):
    document_type_code = serializers.CharField(source="document_type.code", read_only=True)
    document_type_name = serializers.CharField(source="document_type.name", read_only=True)
    branch_code = serializers.CharField(source="branch.code", read_only=True, default=None)
    branch_name = serializers.CharField(source="branch.name", read_only=True, default=None)
    created_by_name = serializers.CharField(source="created_by.display_name", read_only=True, default=None)
    updated_by_name = serializers.CharField(source="updated_by.display_name", read_only=True, default=None)

    class Meta:
        model = DocumentNumberingRule
        fields = [
            "id", "code", "name", "document_type", "document_type_code", "document_type_name",
            "numbering_mode", "sequence_scope", "branch", "branch_code", "branch_name",
            "accounting_book", "custom_scope_key", "pattern", "prefix", "suffix", "separator",
            "start_number", "padding_length", "increment_by", "reset_cycle", "date_source",
            "generation_event", "overflow_strategy", "effective_from", "effective_to",
            "status", "version", "previous_version", "deactivation_reason", "notes",
            "created_by", "created_by_name", "updated_by", "updated_by_name",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "status", "version", "previous_version", "created_by", "updated_by", "created_at", "updated_at"]


class DocumentNumberingRuleCreateSerializer(serializers.Serializer):
    company = serializers.UUIDField(required=False)
    code = serializers.CharField(max_length=80, required=True)
    name = serializers.CharField(max_length=255, required=True)
    document_type = serializers.UUIDField(required=True)
    numbering_mode = serializers.ChoiceField(choices=NumberingMode.choices, default=NumberingMode.AUTO)
    sequence_scope = serializers.ChoiceField(choices=SequenceScope.choices, default=SequenceScope.COMPANY)
    branch = serializers.UUIDField(required=False, allow_null=True)
    accounting_book = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    custom_scope_key = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    pattern = serializers.CharField(max_length=150, default="{Prefix}-{Year}-{Sequence:6}")
    prefix = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    suffix = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    separator = serializers.CharField(max_length=10, required=False, default="-", allow_blank=True)
    start_number = serializers.IntegerField(default=1)
    padding_length = serializers.IntegerField(default=6)
    increment_by = serializers.IntegerField(default=1)
    reset_cycle = serializers.ChoiceField(choices=ResetCycle.choices, default=ResetCycle.YEARLY)
    date_source = serializers.ChoiceField(choices=DateSource.choices, default=DateSource.DOCUMENT_DATE)
    generation_event = serializers.ChoiceField(choices=GenerationEvent.choices, default=GenerationEvent.ON_CREATE)
    overflow_strategy = serializers.ChoiceField(choices=OverflowStrategy.choices, default=OverflowStrategy.AUTO_EXPAND)
    effective_from = serializers.DateField(required=False)
    effective_to = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class DocumentNumberingRuleUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    numbering_mode = serializers.ChoiceField(choices=NumberingMode.choices, required=False)
    sequence_scope = serializers.ChoiceField(choices=SequenceScope.choices, required=False)
    branch = serializers.UUIDField(required=False, allow_null=True)
    accounting_book = serializers.CharField(max_length=50, required=False, allow_blank=True)
    custom_scope_key = serializers.CharField(max_length=100, required=False, allow_blank=True)
    pattern = serializers.CharField(max_length=150, required=False)
    prefix = serializers.CharField(max_length=30, required=False, allow_blank=True)
    suffix = serializers.CharField(max_length=30, required=False, allow_blank=True)
    separator = serializers.CharField(max_length=10, required=False, allow_blank=True)
    start_number = serializers.IntegerField(required=False)
    padding_length = serializers.IntegerField(required=False)
    increment_by = serializers.IntegerField(required=False)
    reset_cycle = serializers.ChoiceField(choices=ResetCycle.choices, required=False)
    date_source = serializers.ChoiceField(choices=DateSource.choices, required=False)
    generation_event = serializers.ChoiceField(choices=GenerationEvent.choices, required=False)
    overflow_strategy = serializers.ChoiceField(choices=OverflowStrategy.choices, required=False)
    effective_from = serializers.DateField(required=False)
    effective_to = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class NumberingRulePreviewRequestSerializer(serializers.Serializer):
    pattern = serializers.CharField(max_length=150, default="{Prefix}-{Year}-{Sequence:6}")
    numbering_mode = serializers.ChoiceField(choices=NumberingMode.choices, default=NumberingMode.AUTO)
    reset_cycle = serializers.ChoiceField(choices=ResetCycle.choices, default=ResetCycle.YEARLY)
    padding_length = serializers.IntegerField(default=6)
    prefix = serializers.CharField(max_length=30, required=False, allow_blank=True, default="DOC")
    suffix = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    separator = serializers.CharField(max_length=10, required=False, default="-", allow_blank=True)
    start_number = serializers.IntegerField(default=1)
    increment_by = serializers.IntegerField(default=1)
    overflow_strategy = serializers.ChoiceField(choices=OverflowStrategy.choices, default=OverflowStrategy.AUTO_EXPAND)
    branch_code = serializers.CharField(max_length=30, required=False, default="HN")
    document_type_code = serializers.CharField(max_length=50, required=False, default="PC")


class NumberingRuleActivateRequestSerializer(serializers.Serializer):
    effective_from = serializers.DateField(required=False, allow_null=True)


class NumberingRuleDeactivateRequestSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, allow_blank=False, error_messages={
        "required": "Lý do ngừng áp dụng quy tắc là bắt buộc.",
        "blank": "Lý do ngừng áp dụng quy tắc không được để trống.",
    })
    effective_to = serializers.DateField(required=False, allow_null=True)


class NumberingRuleCopyRequestSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=80, required=True)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    document_type = serializers.UUIDField(required=False, allow_null=True)


class NumberingSequenceTrackerSerializer(serializers.ModelSerializer):
    class Meta:
        model = NumberingSequenceTracker
        fields = [
            "id", "rule", "scope_key", "period_key", "current_number",
            "last_issued_number", "last_issued_at", "updated_at",
        ]


class DocumentNumberHistorySerializer(serializers.ModelSerializer):
    document_type_code = serializers.CharField(source="document_type.code", read_only=True)
    issued_by_name = serializers.CharField(source="issued_by.display_name", read_only=True, default=None)
    branch_code = serializers.CharField(source="branch.code", read_only=True, default=None)

    class Meta:
        model = DocumentNumberHistory
        fields = [
            "id", "document_type", "document_type_code", "document_number",
            "status", "sequence_number", "entity_type", "entity_id",
            "branch", "branch_code", "is_manual", "notes", "issued_by",
            "issued_by_name", "issued_at",
        ]


class GenerateDocumentNumberRequestSerializer(serializers.Serializer):
    company = serializers.UUIDField(required=False)
    document_type = serializers.CharField(required=True)
    document_date = serializers.DateField(required=False, allow_null=True)
    branch = serializers.UUIDField(required=False, allow_null=True)
    accounting_book = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    custom_scope_key = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    entity_type = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    entity_id = serializers.UUIDField(required=False, allow_null=True)
    event = serializers.ChoiceField(choices=GenerationEvent.choices, default=GenerationEvent.ON_CREATE)


class ManualNumberValidationRequestSerializer(serializers.Serializer):
    company = serializers.UUIDField(required=False)
    document_type = serializers.CharField(required=True)
    document_number = serializers.CharField(max_length=120, required=True)
    branch = serializers.UUIDField(required=False, allow_null=True)
    entity_type = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    entity_id = serializers.UUIDField(required=False, allow_null=True)
