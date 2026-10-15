import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("organization", "0002_company_bootstrap_fields")]

    operations = [
        migrations.AddField(model_name="company", name="short_name", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="company", name="representative_title", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="company", name="country_code", field=models.CharField(default="VN", max_length=2)),
        migrations.AddField(model_name="company", name="district", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="company", name="ward", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="company", name="website", field=models.URLField(blank=True)),
        migrations.AddField(model_name="company", name="default_locale", field=models.CharField(default="vi-VN", max_length=20)),
        migrations.AlterField(
            model_name="company", name="status",
            field=models.CharField(
                choices=[
                    ("PENDING_SETUP", "Chờ thiết lập"), ("ACTIVE", "Đang hoạt động"),
                    ("SUSPENDED", "Tạm ngừng"), ("INACTIVE", "Ngừng hoạt động"),
                ], default="ACTIVE", max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="CompanyInformationVersion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("effective_from", models.DateField()),
                ("status", models.CharField(choices=[("PENDING", "Chờ hiệu lực"), ("ACTIVE", "Đang hiệu lực"), ("SUPERSEDED", "Hết hiệu lực")], max_length=20)),
                ("data", models.JSONField(default=dict)),
                ("based_on_updated_at", models.DateTimeField()),
                ("created_by_user_id", models.UUIDField(editable=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("applied_at", models.DateTimeField(blank=True, null=True)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="information_versions", to="organization.company")),
            ],
            options={"db_table": "org_company_information_version", "ordering": ("company_id", "-effective_from", "-created_at")},
        ),
        migrations.AddIndex(
            model_name="companyinformationversion",
            index=models.Index(fields=["company", "status", "effective_from"], name="ix_org_company_version_due"),
        ),
    ]
