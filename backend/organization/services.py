from datetime import timedelta

from django.db import transaction

from .models import Employee, EmployeeAssignment


@transaction.atomic
def assign_employee(*, employee: Employee, valid_from, branch, department=None, position=None):
    """Create the next primary assignment and keep the employee snapshot in sync."""
    employee = Employee.objects.select_for_update().get(pk=employee.pk)
    current = (
        EmployeeAssignment.objects.select_for_update()
        .filter(employee=employee, is_primary=True, valid_to__isnull=True)
        .order_by("-valid_from")
        .first()
    )
    if current:
        if valid_from <= current.valid_from:
            raise ValueError("Ngày phân công mới phải sau ngày bắt đầu của phân công hiện tại.")
        current.valid_to = valid_from - timedelta(days=1)
        current.full_clean()
        current.save(update_fields=("valid_to",))

    assignment = EmployeeAssignment(
        employee=employee,
        branch=branch,
        department=department,
        position=position,
        valid_from=valid_from,
        is_primary=True,
    )
    assignment.full_clean()
    assignment.save()

    employee.branch = branch
    employee.department = department
    employee.position = position
    employee.full_clean()
    employee.save(update_fields=("branch", "department", "position", "updated_at"))
    return assignment
