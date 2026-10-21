from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("cash_management", "0005_cashtransaction_payment_method_snapshot")]

    operations = [
        migrations.AddField(
            model_name="cashtransaction",
            name="receipt_details",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
