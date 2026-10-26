# Generated for UC-RPT-03 – Xem bảng cân đối kế toán (Báo cáo tình hình tài chính)

import django.db.models.deletion
import uuid
from django.db import migrations, models
from reporting.financial_position_services import seed_balance_sheet_uc_rpt_03


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("reporting", "0005_financial_bundles_uc_rpt_02"),
    ]

    operations = [
        migrations.AddField(
            model_name="financialstatementline",
            name="parent_line",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="child_lines",
                to="reporting.financialstatementline",
            ),
        ),
        migrations.AddField(
            model_name="financialstatementline",
            name="parent_indicator_code",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="financialstatementline",
            name="level",
            field=models.PositiveSmallIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="financialstatementline",
            name="is_negative_presentation",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="financialstatementline",
            name="is_drilldown_available",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="financialstatementaccountmapping",
            name="condition_json",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="financialstatementrun",
            name="comparison_as_of_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="FinancialStatementRunValidation",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("validation_run_id", models.UUIDField(default=uuid.uuid4)),
                ("rule_code", models.CharField(max_length=50)),
                ("column_code", models.CharField(default="CLOSING", max_length=20)),
                ("indicator_code", models.CharField(blank=True, default="", max_length=40)),
                (
                    "expected_amount",
                    models.DecimalField(blank=True, decimal_places=4, max_digits=24, null=True),
                ),
                (
                    "actual_amount",
                    models.DecimalField(blank=True, decimal_places=4, max_digits=24, null=True),
                ),
                (
                    "difference_amount",
                    models.DecimalField(blank=True, decimal_places=4, max_digits=24, null=True),
                ),
                (
                    "severity",
                    models.CharField(
                        choices=[("WARNING", "Cảnh báo"), ("BLOCKER", "Lỗi chặn")],
                        default="BLOCKER",
                        max_length=20,
                    ),
                ),
                ("status", models.CharField(default="PASSED", max_length=30)),
                ("message", models.CharField(max_length=1000)),
                ("checked_at", models.DateTimeField(auto_now_add=True)),
                (
                    "statement_run",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="validations",
                        to="reporting.financialstatementrun",
                    ),
                ),
            ],
            options={
                "db_table": "rpt_fs_run_validation",
                "ordering": ("-checked_at", "rule_code", "column_code"),
            },
        ),
        migrations.RunPython(seed_balance_sheet_uc_rpt_03, migrations.RunPython.noop),
    ]

