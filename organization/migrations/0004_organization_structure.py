import django.db.models.deletion
import uuid
from django.db import migrations, models


def create_roots(apps, schema_editor):
    Company = apps.get_model("organization", "Company")
    Unit = apps.get_model("organization", "OrganizationUnit")
    for company in Company.objects.all():
        actor_id = company.created_by_user_id or uuid.uuid4()
        Unit.objects.get_or_create(
            company_id=company.id, unit_type="COMPANY",
            defaults={
                "id": uuid.uuid4(), "code": company.code, "name": company.name,
                "short_name": company.short_name, "start_date": company.created_at.date(),
                "status": "ACTIVE", "created_by_user_id": actor_id,
                "updated_by_user_id": actor_id,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("organization", "0003_company_information_management"), ("iam", "0007_seed_company_information_permissions")]
    operations = [
        migrations.CreateModel(
            name="OrganizationUnit",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("unit_type", models.CharField(choices=[("COMPANY", "Doanh nghiệp"), ("BRANCH", "Chi nhánh"), ("DEPARTMENT", "Phòng ban"), ("OTHER", "Đơn vị khác")], max_length=20)),
                ("code", models.CharField(max_length=30)), ("name", models.CharField(max_length=255)),
                ("short_name", models.CharField(blank=True, max_length=100)), ("phone", models.CharField(blank=True, max_length=30)),
                ("email", models.EmailField(blank=True, max_length=254)), ("address", models.CharField(blank=True, max_length=500)),
                ("tax_code", models.CharField(blank=True, max_length=30)), ("business_location_code", models.CharField(blank=True, max_length=50)),
                ("start_date", models.DateField()), ("end_date", models.DateField(blank=True, null=True)),
                ("status", models.CharField(choices=[("ACTIVE", "Đang hoạt động"), ("INACTIVE", "Ngừng hoạt động")], default="ACTIVE", max_length=20)),
                ("description", models.CharField(blank=True, max_length=1000)),
                ("pending_move_effective_from", models.DateField(blank=True, null=True)),
                ("created_by_user_id", models.UUIDField(editable=False)), ("updated_by_user_id", models.UUIDField(editable=False)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="organization_units", to="organization.company")),
                ("manager_membership", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="managed_organization_units", to="iam.companymembership")),
                ("parent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="children", to="organization.organizationunit")),
                ("pending_parent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="pending_children", to="organization.organizationunit")),
            ], options={"db_table": "org_organization_unit", "ordering": ("company_id", "code")}),
        migrations.CreateModel(
            name="OrganizationUnitHistory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("action", models.CharField(max_length=30)), ("effective_from", models.DateField()),
                ("before", models.JSONField(default=dict)), ("after", models.JSONField(default=dict)),
                ("actor_user_id", models.UUIDField(editable=False)), ("occurred_at", models.DateTimeField(auto_now_add=True)),
                ("unit", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="history", to="organization.organizationunit")),
            ], options={"db_table": "org_organization_unit_history", "ordering": ("-occurred_at",)}),
        migrations.CreateModel(
            name="OrganizationUnitDependency",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("dependency_type", models.CharField(choices=[("USER_ASSIGNMENT", "Phân công User"), ("WORKFLOW", "Workflow"), ("DATA_SCOPE", "Data Scope"), ("OTHER", "Khác")], max_length=30)),
                ("reference", models.CharField(max_length=255)), ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("unit", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="dependencies", to="organization.organizationunit")),
            ], options={"db_table": "org_organization_unit_dependency"}),
        migrations.AddConstraint(model_name="organizationunit", constraint=models.UniqueConstraint(fields=("company", "code"), name="uq_org_unit_company_code")),
        migrations.AddConstraint(model_name="organizationunit", constraint=models.UniqueConstraint(condition=models.Q(("unit_type", "COMPANY")), fields=("company",), name="uq_org_unit_company_root")),
        migrations.AddConstraint(model_name="organizationunit", constraint=models.CheckConstraint(condition=models.Q(("end_date__isnull", True), ("end_date__gte", models.F("start_date")), _connector="OR"), name="ck_org_unit_dates")),
        migrations.AddConstraint(model_name="organizationunitdependency", constraint=models.UniqueConstraint(fields=("unit", "dependency_type", "reference"), name="uq_org_unit_dependency")),
        migrations.RunPython(create_roots, migrations.RunPython.noop),
    ]
