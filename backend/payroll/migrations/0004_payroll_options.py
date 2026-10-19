from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("payroll", "0003_seed_module")]

    operations = [
        migrations.AddField(
            model_name="payrollsetting", name="accounting_rule",
            field=models.CharField(max_length=20, choices=[("DETAIL", "Theo nhân viên"), ("DEPARTMENT", "Theo bộ phận")], default="DETAIL"),
        ),
        migrations.AddField(
            model_name="payrollsetting", name="integration_mode",
            field=models.CharField(max_length=20, choices=[("LOCAL", "Tính trên hệ thống"), ("CLOUD", "Kết nối ứng dụng nhân sự")], default="LOCAL"),
        ),
    ]
