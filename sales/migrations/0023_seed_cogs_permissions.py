import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="SAL.COGS",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "SAL",
            "name": "Giá vốn hàng bán",
            "status": "ACTIVE",
        },
    )
    for code, name in (
        ("VIEW", "Xem chứng từ giá vốn hàng bán"),
        ("CREATE", "Lập chứng từ giá vốn hàng bán"),
        ("EDIT", "Sửa chứng từ giá vốn hàng bán"),
        ("DELETE", "Xóa chứng từ giá vốn hàng bán"),
        ("POST", "Ghi sổ chứng từ giá vốn hàng bán"),
        ("CANCEL", "Hủy chứng từ giá vốn hàng bán"),
        ("APPROVE", "Phê duyệt chứng từ giá vốn hàng bán"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"SAL.COGS.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": name,
                "status": "ACTIVE",
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0022_alter_approvaldecision_document_type_costofgoodssold_and_more"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
