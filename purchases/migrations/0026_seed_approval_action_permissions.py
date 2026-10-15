import uuid

from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")

    resource, _ = Resource.objects.get_or_create(
        code="PUR.APPROVAL",
        defaults={
            "id": uuid.uuid4(),
            "module_code": "PUR",
            "name": "Phê duyệt mua hàng",
            "status": "ACTIVE",
        },
    )
    for code, name in (
        ("VIEW", "Xem chứng từ chờ phê duyệt mua hàng"),
        ("APPROVE", "Phê duyệt chứng từ mua hàng"),
        ("REJECT", "Từ chối chứng từ mua hàng"),
        ("REQUEST_REVISION", "Yêu cầu chỉnh sửa chứng từ mua hàng"),
    ):
        action, _ = Action.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "name": name, "risk_level": "NORMAL"},
        )
        Permission.objects.get_or_create(
            code=f"PUR.APPROVAL.{code}",
            defaults={
                "id": uuid.uuid4(),
                "resource_id": resource.id,
                "action_id": action.id,
                "description": name,
                "status": "ACTIVE",
            },
        )


class Migration(migrations.Migration):
    dependencies = [("purchases", "0025_approvaldecision_document_version")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
