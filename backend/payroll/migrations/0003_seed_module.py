from django.db import migrations


def seed(apps, schema_editor):
    ModuleCatalog = apps.get_model("common_services", "ModuleCatalog")
    ModuleCatalog.objects.get_or_create(code="PAYROLL", defaults={
        "name": "Tiền lương", "category": "OPTIONAL",
        "description": "Hồ sơ lương, chấm công, tính lương, bảo hiểm, thuế TNCN và hạch toán chi phí lương.",
        "icon": "Users", "dependencies": ["GL"], "menu_group": "Kế toán", "display_order": 30,
    })


class Migration(migrations.Migration):
    dependencies = [("payroll", "0002_seed_permissions"), ("common_services", "0015_seed_policy_permissions")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
