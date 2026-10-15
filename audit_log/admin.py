from django.contrib import admin

from .models import AuditChange, AuditLog, LoginLog, SecurityEvent


class AuditChangeInline(admin.TabularInline):
    model = AuditChange
    extra = 0
    can_delete = False
    readonly_fields = ("field_name", "old_value_json", "new_value_json")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("occurred_at", "company", "actor_name_snapshot", "module_code", "event_category", "action_code", "resource_code", "result", "severity")
    list_filter = ("company", "module_code", "event_category", "result", "severity", "source")
    search_fields = ("resource_code", "action_code", "actor_name_snapshot", "description", "reason", "request_id", "correlation_id")
    readonly_fields = [field.name for field in AuditLog._meta.fields]
    inlines = (AuditChangeInline,)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class AppendOnlyAdmin(admin.ModelAdmin):
    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(LoginLog, AppendOnlyAdmin)
admin.site.register(SecurityEvent, AppendOnlyAdmin)
