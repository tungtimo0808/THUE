from django.contrib import admin

from .models import Branch, Company, Department, Employee, EmployeeAssignment, Position


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "tax_code", "status")
    search_fields = ("code", "name", "legal_name", "tax_code")
    list_filter = ("status", "accounting_regime")


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "company", "is_head_office", "status")
    list_filter = ("company", "status", "is_head_office")
    search_fields = ("code", "name", "tax_code")


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "company", "branch", "status")
    list_filter = ("company", "branch", "status")
    search_fields = ("code", "name")


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "company", "status")
    list_filter = ("company", "status")
    search_fields = ("code", "name")


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("employee_code", "full_name", "company", "branch", "department", "status")
    list_filter = ("company", "branch", "department", "status")
    search_fields = ("employee_code", "full_name", "email", "phone")


@admin.register(EmployeeAssignment)
class EmployeeAssignmentAdmin(admin.ModelAdmin):
    list_display = ("employee", "branch", "department", "position", "valid_from", "valid_to", "is_primary")
    list_filter = ("branch", "department", "is_primary")
