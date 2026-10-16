from rest_framework import serializers

from .models import (
    FiscalPeriod,
    FiscalPeriodStatus,
    FiscalPeriodType,
    FiscalYear,
    FiscalYearStatus,
    FiscalYearType,
    PeriodStructure,
)


class FiscalPeriodSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    period_type_display = serializers.CharField(source="get_period_type_display", read_only=True)

    class Meta:
        model = FiscalPeriod
        fields = (
            "id",
            "code",
            "name",
            "period_number",
            "start_date",
            "end_date",
            "period_type",
            "period_type_display",
            "status",
            "status_display",
            "allow_adjustment",
            "notes",
            "closed_at",
            "locked_at",
            "reopened_at",
            "reopen_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class FiscalPeriodCreateUpdateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=100)
    period_number = serializers.IntegerField(min_value=1, max_value=99)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    period_type = serializers.ChoiceField(choices=FiscalPeriodType.choices, default=FiscalPeriodType.MONTH)
    status = serializers.ChoiceField(choices=FiscalPeriodStatus.choices, default=FiscalPeriodStatus.FUTURE, required=False)
    allow_adjustment = serializers.BooleanField(default=False, required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class FiscalPeriodStatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=FiscalPeriodStatus.choices)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class FiscalYearSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    year_type_display = serializers.CharField(source="get_year_type_display", read_only=True)
    period_structure_display = serializers.CharField(source="get_period_structure_display", read_only=True)
    periods_count = serializers.IntegerField(source="periods.count", read_only=True)

    class Meta:
        model = FiscalYear
        fields = (
            "id",
            "company",
            "code",
            "name",
            "year_type",
            "year_type_display",
            "start_date",
            "end_date",
            "period_structure",
            "period_structure_display",
            "has_adjustment_period",
            "status",
            "status_display",
            "notes",
            "periods_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class FiscalYearDetailSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    year_type_display = serializers.CharField(source="get_year_type_display", read_only=True)
    period_structure_display = serializers.CharField(source="get_period_structure_display", read_only=True)
    periods = FiscalPeriodSerializer(many=True, read_only=True)

    class Meta:
        model = FiscalYear
        fields = (
            "id",
            "company",
            "code",
            "name",
            "year_type",
            "year_type_display",
            "start_date",
            "end_date",
            "period_structure",
            "period_structure_display",
            "has_adjustment_period",
            "status",
            "status_display",
            "notes",
            "periods",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class FiscalYearCreateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=30)
    name = serializers.CharField(max_length=100)
    year_type = serializers.ChoiceField(choices=FiscalYearType.choices, default=FiscalYearType.CALENDAR_YEAR)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    period_structure = serializers.ChoiceField(choices=PeriodStructure.choices, default=PeriodStructure.MONTHLY)
    has_adjustment_period = serializers.BooleanField(default=False, required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    periods = FiscalPeriodCreateUpdateSerializer(many=True, required=False)


class FiscalYearUpdateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=30, required=False)
    name = serializers.CharField(max_length=100, required=False)
    year_type = serializers.ChoiceField(choices=FiscalYearType.choices, required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    period_structure = serializers.ChoiceField(choices=PeriodStructure.choices, required=False)
    has_adjustment_period = serializers.BooleanField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    periods = FiscalPeriodCreateUpdateSerializer(many=True, required=False)


class FiscalYearCopySerializer(serializers.Serializer):
    code = serializers.CharField(max_length=30)
    name = serializers.CharField(max_length=100)
    start_date = serializers.DateField()
    end_date = serializers.DateField()


class FiscalYearActivateSerializer(serializers.Serializer):
    open_first_period = serializers.BooleanField(default=False, required=False)
    open_current_period = serializers.BooleanField(default=False, required=False)


class PreviewPeriodsRequestSerializer(serializers.Serializer):
    year_type = serializers.ChoiceField(choices=FiscalYearType.choices, default=FiscalYearType.CALENDAR_YEAR)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    period_structure = serializers.ChoiceField(choices=PeriodStructure.choices, default=PeriodStructure.MONTHLY)
    has_adjustment_period = serializers.BooleanField(default=False, required=False)
    code_prefix = serializers.CharField(max_length=30, default="FY", required=False)


class DeterminePeriodRequestSerializer(serializers.Serializer):
    date = serializers.DateField()
    date_type = serializers.ChoiceField(choices=["DOCUMENT_DATE", "POSTING_DATE"], default="DOCUMENT_DATE", required=False)
