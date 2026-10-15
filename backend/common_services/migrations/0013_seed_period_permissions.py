import uuid
from django.db import migrations


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")

    view_act, _ = Action.objects.get_or_create(code="VIEW", defaults={"id": uuid.uuid4(), "name": "Xem", "risk_level": "NORMAL"})
    cfg_act, _ = Action.objects.get_or_create(code="CONFIGURE", defaults={"id": uuid.uuid4(), "name": "Cấu hình", "risk_level": "HIGH"})
    close_act, _ = Action.objects.get_or_create(code="CLOSE", defaults={"id": uuid.uuid4(), "name": "Đóng/Khóa kỳ", "risk_level": "HIGH"})

    res, _ = Resource.objects.get_or_create(code="SYS.PERIOD", defaults={
        "id": uuid.uuid4(), "module_code": "SYS", "name": "Cấu hình kỳ kế toán", "status": "ACTIVE",
    })

    perm_view, _ = Permission.objects.get_or_create(code="SYS.PERIOD.VIEW", defaults={
        "id": uuid.uuid4(), "resource_id": res.pk, "action_id": view_act.pk, "description": "Xem cấu hình năm tài chính và kỳ kế toán", "status": "ACTIVE",
    })
    perm_cfg, _ = Permission.objects.get_or_create(code="SYS.PERIOD.CONFIGURE", defaults={
        "id": uuid.uuid4(), "resource_id": res.pk, "action_id": cfg_act.pk, "description": "Cấu hình, kích hoạt và sao chép năm tài chính/kỳ", "status": "ACTIVE",
    })
    perm_close, _ = Permission.objects.get_or_create(code="SYS.PERIOD.CLOSE", defaults={
        "id": uuid.uuid4(), "resource_id": res.pk, "action_id": close_act.pk, "description": "Đóng, khóa hoặc mở lại kỳ kế toán", "status": "ACTIVE",
    })

    for role in Role.objects.filter(is_system_admin=True):
        RolePermission.objects.get_or_create(role=role, permission=perm_view, defaults={"effect": "ALLOW"})
        RolePermission.objects.get_or_create(role=role, permission=perm_cfg, defaults={"effect": "ALLOW"})
        RolePermission.objects.get_or_create(role=role, permission=perm_close, defaults={"effect": "ALLOW"})


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("common_services", "0012_fiscalyear_fiscalperiod"),
        ("iam", "0005_seed_uc_md"),
    ]
    operations = [
        migrations.RunPython(seed, unseed),
    ]
