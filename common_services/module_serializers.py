from rest_framework import serializers

from .models import ModuleCatalog, CompanyModuleConfig, ModuleCategory, ModuleStatus


class ModuleCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModuleCatalog
        fields = [
            "code", "name", "category", "description", "icon",
            "dependencies", "default_config", "menu_group", "display_order", "is_active",
        ]


class ModuleDependencyItemSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()
    is_satisfied = serializers.BooleanField()


class ModuleImpactSerializer(serializers.Serializer):
    module_code = serializers.CharField()
    module_name = serializers.CharField()
    category = serializers.CharField()
    historical_records_count = serializers.IntegerField()
    pending_tasks_count = serializers.IntegerField()
    active_dependent_modules = serializers.ListField(child=serializers.DictField())
    can_disable = serializers.BooleanField()


class CompanyModuleItemSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()
    category = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    icon = serializers.CharField(allow_blank=True)
    dependencies = serializers.ListField(child=serializers.CharField())
    menu_group = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    effective_from = serializers.CharField(allow_null=True)
    effective_to = serializers.CharField(allow_null=True)
    configuration = serializers.DictField(default=dict)
    reason = serializers.CharField(allow_blank=True)
    notes = serializers.CharField(allow_blank=True)
    version = serializers.IntegerField()
    updated_at = serializers.DateTimeField(allow_null=True)
    updated_by = serializers.CharField(allow_null=True)


class ModuleDetailSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()
    category = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    icon = serializers.CharField(allow_blank=True)
    dependencies = ModuleDependencyItemSerializer(many=True)
    menu_group = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    effective_from = serializers.CharField(allow_null=True)
    effective_to = serializers.CharField(allow_null=True)
    configuration = serializers.DictField(default=dict)
    reason = serializers.CharField(allow_blank=True)
    notes = serializers.CharField(allow_blank=True)
    version = serializers.IntegerField()
    updated_at = serializers.DateTimeField(allow_null=True)
    updated_by = serializers.CharField(allow_null=True)
    impact = ModuleImpactSerializer()


class ModuleEnableRequestSerializer(serializers.Serializer):
    company = serializers.UUIDField(required=False)
    effective_from = serializers.DateField(required=False, allow_null=True)
    configuration = serializers.DictField(required=False, default=dict)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    version = serializers.IntegerField(required=False, allow_null=True)


class ModuleDisableRequestSerializer(serializers.Serializer):
    company = serializers.UUIDField(required=False)
    reason = serializers.CharField(required=True, allow_blank=False, error_messages={
        "required": "Lý do ngừng sử dụng phân hệ là bắt buộc.",
        "blank": "Lý do ngừng sử dụng phân hệ không được để trống.",
    })
    effective_to = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    force = serializers.BooleanField(required=False, default=False)
    version = serializers.IntegerField(required=False, allow_null=True)


class ModuleConfigUpdateRequestSerializer(serializers.Serializer):
    company = serializers.UUIDField(required=False)
    configuration = serializers.DictField(required=False, default=dict)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    version = serializers.IntegerField(required=False, allow_null=True)
