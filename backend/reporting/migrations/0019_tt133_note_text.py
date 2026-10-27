import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("reporting", "0018_reportdrilldowndefinition_reportcellcontext_and_more"),
        ("organization", "0005_employee_address_employee_advance_account_and_more"),
        ("iam", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TT133NoteText",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("year", models.PositiveSmallIntegerField()),
                ("section_code", models.CharField(max_length=10)),
                ("content", models.TextField(blank=True, default="")),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="organization.company")),
                ("updated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, to="iam.useraccount")),
            ],
            options={
                "db_table": "rpt_tt133_note_text",
                "constraints": [models.UniqueConstraint(fields=("company", "year", "section_code"), name="uq_tt133_note_section")],
            },
        ),
    ]
