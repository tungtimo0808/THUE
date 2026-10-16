from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts_receivable", "0027_due_tracking_permissions"),
    ]

    operations = [
        migrations.AlterField(
            model_name="receivable",
            name="due_date",
            field=models.DateField(null=True, blank=True),
        ),
    ]
