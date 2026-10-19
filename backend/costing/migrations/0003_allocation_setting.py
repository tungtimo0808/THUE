import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("costing", "0002_seed_permissions_and_module"), ("organization", "0005_employee_address_employee_advance_account_and_more")]

    operations = [
        migrations.CreateModel(
            name="CostAllocationSetting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("company", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="cost_allocation_setting", to="organization.company")),
                ("labor_basis", models.CharField(default="AUTO", max_length=20)),
                ("overhead_basis", models.CharField(default="AUTO", max_length=20)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "cost_allocation_setting"},
        ),
    ]
