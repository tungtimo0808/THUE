from django.contrib import admin

from .models import ReportDefinition, ReportExport, ReportLineMapping, ReportRun


class ReportLineInline(admin.TabularInline):
    model = ReportLineMapping
    extra = 0


@admin.register(ReportDefinition)
class ReportDefinitionAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "group", "is_active")
    list_filter = ("group", "is_active")
    search_fields = ("code", "name")
    inlines = (ReportLineInline,)


@admin.register(ReportRun)
class ReportRunAdmin(admin.ModelAdmin):
    list_display = ("report", "company", "status", "row_count", "requested_by", "generated_at")
    readonly_fields = ("company", "report", "requested_by", "parameters", "result", "status", "row_count", "source_trace", "generated_at")


admin.site.register(ReportExport)
