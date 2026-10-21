from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("master_data", "0024_item_requires_service_acceptance")]

    operations = [
        migrations.AddField(model_name="paymentterm", name="due_mode", field=models.CharField(choices=[("DAYS", "Days"), ("MONTHLY", "Monthly")], default="DAYS", max_length=10)),
        migrations.AddField(model_name="paymentterm", name="due_day_of_month", field=models.PositiveSmallIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="paymentterm", name="due_after_months", field=models.PositiveSmallIntegerField(default=0)),
    ]
