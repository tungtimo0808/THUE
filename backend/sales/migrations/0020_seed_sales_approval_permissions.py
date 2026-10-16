import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="SAL.APPROVAL",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "SAL",
            "name": "Phê duyệt chứng từ bán hàng",
            "status": "ACTIVE",
        },
    )
    for code, name, risk in (
        ("VIEW", "Xem chứng từ chờ phê duyệt bán hàng", "NORMAL"),
        ("APPROVE", "Phê duyệt chứng từ bán hàng", "HIGH"),
        ("REJECT", "Từ chối chứng từ bán hàng", "NORMAL"),
        ("REQUEST_REVISION", "Yêu cầu chỉnh sửa chứng từ bán hàng", "NORMAL"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": risk},
        )
        Permission.objects.get_or_create(
            code=f"SAL.APPROVAL.{code}",
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
        ("sales", "0019_approvaldecision_document_version_and_more"),
    ]
    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
