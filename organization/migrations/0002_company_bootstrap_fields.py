import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("organization", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="company",
            name="business_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("LLC_ONE_MEMBER", "Công ty TNHH một thành viên"),
                    ("LLC_MULTI_MEMBER", "Công ty TNHH hai thành viên trở lên"),
                    ("JOINT_STOCK", "Công ty cổ phần"),
                    ("PRIVATE_ENTERPRISE", "Doanh nghiệp tư nhân"),
                    ("PARTNERSHIP", "Công ty hợp danh"),
                    ("OTHER", "Khác"),
                ],
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="company", name="province", field=models.CharField(blank=True, max_length=100)
        ),
        migrations.AddField(
            model_name="company", name="legal_representative", field=models.CharField(blank=True, max_length=255)
        ),
        migrations.AddField(
            model_name="company", name="logo", field=models.FileField(blank=True, upload_to="company_logos/%Y/%m/")
        ),
        migrations.AddField(
            model_name="company", name="created_by_user_id", field=models.UUIDField(blank=True, editable=False, null=True)
        ),
        migrations.AlterField(
            model_name="company",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING_SETUP", "Chờ thiết lập"),
                    ("ACTIVE", "Đang hoạt động"),
                    ("INACTIVE", "Ngừng hoạt động"),
                ],
                default="ACTIVE",
                max_length=20,
            ),
        ),
    ]
