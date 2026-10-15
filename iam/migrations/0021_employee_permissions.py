import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    resource, _ = Resource.objects.get_or_create(code="MD.EMPLOYEE", defaults={
        "id": uuid.uuid4(), "module_code": "MD", "name": "Nhân viên", "status": "ACTIVE",
    })
    for code, name in (
        ("VIEW", "Xem"), ("CREATE", "Tạo"), ("EDIT", "Cập nhật"),
        ("DEACTIVATE", "Ngừng sử dụng"), ("LINK_USER", "Liên kết User"),
        ("IMPORT", "Nhập"), ("EXPORT", "Xuất"), ("VIEW_SENSITIVE", "Xem dữ liệu nhạy cảm"),
    ):
        action, _ = Action.objects.get_or_create(code=code, defaults={
            "id": uuid.uuid4(), "name": name, "risk_level": "HIGH" if code in {"DEACTIVATE", "LINK_USER", "VIEW_SENSITIVE"} else "NORMAL",
        })
        permission, _ = Permission.objects.get_or_create(code=f"MD.EMPLOYEE.{code}", defaults={
            "id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk,
            "description": f"{name} - Nhân viên", "status": "ACTIVE",
        })
        for role in Role.objects.filter(is_system_admin=True):
            RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0020_alter_companymembership_membership_status_and_more"), ("organization", "0005_employee_address_employee_advance_account_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
