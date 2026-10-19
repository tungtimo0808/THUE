import uuid

from django.db import migrations

RESOURCES = {
    "COST.SETTING": ("Định mức và đối tượng tập hợp chi phí", ("VIEW", "EDIT")),
    "COST.PERIOD": ("Kỳ tính giá thành", ("VIEW", "CREATE", "POST")),
}
NAMES = {"VIEW": "Xem", "EDIT": "Cập nhật", "CREATE": "Tạo", "POST": "Ghi sổ"}


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    ModuleCatalog = apps.get_model("common_services", "ModuleCatalog")
    ModuleCatalog.objects.get_or_create(code="COST", defaults={
        "name": "Giá thành", "category": "OPTIONAL", "icon": "Factory", "dependencies": ["GL"], "menu_group": "Kế toán",
        "description": "Tập hợp chi phí 621/622/627, tính giá thành, kết chuyển và nghiệm thu.", "display_order": 31,
    })
    for code, (name, actions) in RESOURCES.items():
        resource, _ = Resource.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "module_code": "COST", "name": name, "status": "ACTIVE"})
        for action_code in actions:
            action, _ = Action.objects.get_or_create(code=action_code, defaults={
                "id": uuid.uuid4(), "name": NAMES[action_code], "risk_level": "HIGH" if action_code == "POST" else "NORMAL"})
            Permission.objects.get_or_create(code=f"{code}.{action_code}", defaults={
                "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
                "description": f"{NAMES[action_code]} - {name}", "status": "ACTIVE"})


class Migration(migrations.Migration):
    dependencies = [("costing", "0001_initial"), ("iam", "0030_seed_referenced_permissions"), ("common_services", "0015_seed_policy_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
