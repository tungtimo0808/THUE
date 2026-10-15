from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("iam", "0005_seed_uc_md")]

    operations = [
        migrations.AddField(
            model_name="useraccount",
            name="can_create_company",
            field=models.BooleanField(default=True),
        )
    ]
