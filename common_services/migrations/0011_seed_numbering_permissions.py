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
    override_act, _ = Action.objects.get_or_create(code="MANUAL_OVERRIDE", defaults={"id": uuid.uuid4(), "name": "Ghi đè thủ công", "risk_level": "HIGH"})

    res, _ = Resource.objects.get_or_create(code="SYS.NUMBERING", defaults={
        "id": uuid.uuid4(), "module_code": "SYS", "name": "Cấu hình đánh số chứng từ", "status": "ACTIVE",
    })

    perm_view, _ = Permission.objects.get_or_create(code="SYS.NUMBERING.VIEW", defaults={
        "id": uuid.uuid4(), "resource_id": res.pk, "action_id": view_act.pk, "description": "Xem quy tắc đánh số chứng từ", "status": "ACTIVE",
    })
    perm_cfg, _ = Permission.objects.get_or_create(code="SYS.NUMBERING.CONFIGURE", defaults={
        "id": uuid.uuid4(), "resource_id": res.pk, "action_id": cfg_act.pk, "description": "Cấu hình và kích hoạt quy tắc đánh số", "status": "ACTIVE",
    })
    perm_override, _ = Permission.objects.get_or_create(code="SYS.NUMBERING.MANUAL_OVERRIDE", defaults={
        "id": uuid.uuid4(), "resource_id": res.pk, "action_id": override_act.pk, "description": "Nhập và điều chỉnh số chứng từ thủ công", "status": "ACTIVE",
    })

    for role in Role.objects.filter(is_system_admin=True):
        RolePermission.objects.get_or_create(role=role, permission=perm_view, defaults={"effect": "ALLOW"})
        RolePermission.objects.get_or_create(role=role, permission=perm_cfg, defaults={"effect": "ALLOW"})
        RolePermission.objects.get_or_create(role=role, permission=perm_override, defaults={"effect": "ALLOW"})


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("common_services", "0010_documentnumberingrule_documentnumberhistory_and_more"),
        ("iam", "0005_seed_uc_md"),
    ]
    operations = [
        migrations.RunPython(seed, unseed),
    ]
