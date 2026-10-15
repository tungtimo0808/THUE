from django.db import migrations


def seed_vnd(apps, schema_editor):
    Currency = apps.get_model("master_data", "Currency")
    Currency.objects.get_or_create(
        code="VND",
        defaults={
            "name": "Đồng Việt Nam",
            "numeric_code": "704",
            "decimal_places": 0,
            "is_active": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("master_data", "0001_initial")]
    operations = [migrations.RunPython(seed_vnd, migrations.RunPython.noop)]
