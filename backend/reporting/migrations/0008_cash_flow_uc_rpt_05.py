# Generated for UC-RPT-05 – Xem báo cáo lưu chuyển tiền tệ

import uuid
import django.db.models.deletion
from django.db import migrations, models
from reporting.cash_flow_services import seed_cash_flow_uc_rpt_05


class Migration(migrations.Migration):

    dependencies = [
        ("general_ledger", "0018_financial_statements_uc_gl_13"),
        ("iam", "0030_seed_referenced_permissions"),
        ("master_data", "0025_payment_term_monthly_due"),
        ("organization", "0005_employee_address_employee_advance_account_and_more"),
        ("reporting", "0007_business_result_uc_rpt_04"),
    ]

    operations = [
        migrations.CreateModel(
            name="CashEquivalentInstrument",
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
                ("instrument_code", models.CharField(max_length=80)),
                ("instrument_name", models.CharField(max_length=255)),
                ("acquisition_date", models.DateField()),
                ("original_maturity_date", models.DateField()),
                ("current_maturity_date", models.DateField(blank=True, null=True)),
                (
                    "principal_amount",
                    models.DecimalField(decimal_places=4, default=0, max_digits=24),
                ),
                ("is_readily_convertible", models.BooleanField(default=True)),
                ("amount_determinable", models.BooleanField(default=True)),
                (
                    "value_change_risk_assessment",
                    models.CharField(default="LOW", max_length=20),
                ),
                ("is_restricted", models.BooleanField(default=False)),
                (
                    "cash_equivalent_status",
                    models.CharField(
                        choices=[
                            ("ELIGIBLE", "Đủ điều kiện tương đương tiền"),
                            ("INELIGIBLE", "Không đủ điều kiện tương đương tiền"),
                            ("RECLASSIFIED_IN", "Tái phân loại thành tương đương tiền"),
                            ("RECLASSIFIED_OUT", "Tái phân loại khỏi tương đương tiền"),
                        ],
                        default="ELIGIBLE",
                        max_length=30,
                    ),
                ),
                (
                    "opening_classification",
                    models.CharField(blank=True, default="", max_length=40),
                ),
                (
                    "closing_classification",
                    models.CharField(blank=True, default="", max_length=40),
                ),
                (
                    "reclassification_effective_date",
                    models.DateField(blank=True, null=True),
                ),
                (
                    "reclassification_impact_amount",
                    models.DecimalField(decimal_places=4, default=0, max_digits=24),
                ),
                (
                    "reclassification_reason",
                    models.CharField(blank=True, default="", max_length=500),
                ),
                (
                    "source_reference",
                    models.CharField(blank=True, default="", max_length=150),
                ),
                ("is_cash_flow_transaction", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "account",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="general_ledger.account",
                    ),
                ),
                (
                    "branch",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="organization.branch",
                    ),
                ),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cash_equivalent_instruments",
                        to="organization.company",
                    ),
                ),
            ],
            options={
                "db_table": "rpt_cash_equivalent_instrument",
                "ordering": ("instrument_code", "acquisition_date"),
            },
        ),
        migrations.CreateModel(
            name="CashFlowEvent",
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
                ("source_system", models.CharField(default="GL", max_length=30)),
                (
                    "source_document_id",
                    models.CharField(blank=True, default="", max_length=150),
                ),
                (
                    "source_line_id",
                    models.CharField(blank=True, default="", max_length=150),
                ),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("RECEIPT", "Thu tiền"),
                            ("PAYMENT", "Chi tiền"),
                            (
                                "SPECIAL_PRESENTATION",
                                "Trình bày đặc biệt (Vay trả thẳng NCC)",
                            ),
                            ("FX_EFFECT", "Ảnh hưởng tỷ giá tiền & tương đương tiền"),
                            ("RECLASSIFICATION", "Tái phân loại tương đương tiền"),
                        ],
                        default="RECEIPT",
                        max_length=40,
                    ),
                ),
                ("transaction_date", models.DateField()),
                ("posting_date", models.DateField()),
                (
                    "amount_base",
                    models.DecimalField(decimal_places=4, default=0, max_digits=24),
                ),
                (
                    "amount_foreign",
                    models.DecimalField(decimal_places=4, default=0, max_digits=24),
                ),
                (
                    "exchange_rate",
                    models.DecimalField(decimal_places=8, default=1, max_digits=20),
                ),
                (
                    "internal_transfer_group_id",
                    models.CharField(blank=True, default="", max_length=120),
                ),
                ("is_internal_transfer", models.BooleanField(default=False)),
                ("is_non_cash_transaction", models.BooleanField(default=False)),
                ("is_loan_direct_payment", models.BooleanField(default=False)),
                ("is_split_unseparated", models.BooleanField(default=False)),
                ("is_duplicate_source", models.BooleanField(default=False)),
                (
                    "special_presentation_rule",
                    models.CharField(blank=True, default="", max_length=100),
                ),
                (
                    "source_reference",
                    models.CharField(blank=True, default="", max_length=255),
                ),
                ("source_version", models.PositiveIntegerField(default=1)),
                (
                    "event_status",
                    models.CharField(
                        choices=[
                            ("POSTED", "Có hiệu lực"),
                            ("DRAFT", "Bản nháp"),
                            ("REVERSED", "Đã đảo"),
                            ("CANCELLED", "Đã hủy"),
                        ],
                        default="POSTED",
                        max_length=30,
                    ),
                ),
                (
                    "dedupe_key",
                    models.CharField(blank=True, default="", max_length=180),
                ),
                (
                    "description",
                    models.CharField(blank=True, default="", max_length=500),
                ),
                ("metadata_json", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "branch",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="cash_flow_events",
                        to="organization.branch",
                    ),
                ),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cash_flow_events",
                        to="organization.company",
                    ),
                ),
                (
                    "currency",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="master_data.currency",
                    ),
                ),
                (
                    "journal_entry",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="cash_flow_events",
                        to="general_ledger.journalentry",
                    ),
                ),
                (
                    "journal_line",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="cash_flow_events",
                        to="general_ledger.journalline",
                    ),
                ),
                (
                    "party",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="master_data.party",
                    ),
                ),
            ],
            options={
                "db_table": "rpt_cash_flow_event",
                "ordering": ("posting_date", "created_at"),
            },
        ),
        migrations.CreateModel(
            name="CashFlowClassification",
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
                (
                    "source_document_id",
                    models.CharField(blank=True, default="", max_length=150),
                ),
                (
                    "cash_flow_method_scope",
                    models.CharField(
                        choices=[
                            ("BOTH", "Cả hai phương pháp"),
                            ("DIRECT", "Trực tiếp"),
                            ("INDIRECT", "Gián tiếp"),
                        ],
                        default="BOTH",
                        max_length=20,
                    ),
                ),
                (
                    "cash_flow_section",
                    models.CharField(
                        choices=[
                            ("OPERATING", "Hoạt động kinh doanh"),
                            ("INVESTING", "Hoạt động đầu tư"),
                            ("FINANCING", "Hoạt động tài chính"),
                            ("RECONCILIATION", "Đối chiếu & Tổng kết"),
                        ],
                        default="OPERATING",
                        max_length=30,
                    ),
                ),
                ("indicator_code", models.CharField(max_length=40)),
                (
                    "allocated_amount",
                    models.DecimalField(decimal_places=4, default=0, max_digits=24),
                ),
                ("sign", models.SmallIntegerField(default=1)),
                (
                    "classification_source",
                    models.CharField(
                        choices=[
                            ("RULE", "Theo quy tắc"),
                            ("MANUAL", "Phân loại thủ công"),
                            ("SYSTEM", "Hệ thống tự động"),
                        ],
                        default="RULE",
                        max_length=20,
                    ),
                ),
                (
                    "classification_rule_code",
                    models.CharField(blank=True, default="", max_length=80),
                ),
                ("rule_version", models.PositiveIntegerField(default=1)),
                ("effective_from", models.DateField(default="2000-01-01")),
                ("effective_to", models.DateField(blank=True, null=True)),
                (
                    "classification_status",
                    models.CharField(
                        choices=[
                            ("DRAFT", "Nháp"),
                            ("VALIDATED", "Đã kiểm tra"),
                            ("APPROVED", "Đã duyệt"),
                        ],
                        default="VALIDATED",
                        max_length=20,
                    ),
                ),
                ("reason", models.CharField(blank=True, default="", max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cash_flow_classifications",
                        to="organization.company",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="iam.useraccount",
                    ),
                ),
                (
                    "source_journal_line",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="cash_flow_classifications",
                        to="general_ledger.journalline",
                    ),
                ),
                (
                    "source_event",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="classifications",
                        to="reporting.cashflowevent",
                    ),
                ),
            ],
            options={
                "db_table": "rpt_cash_flow_classification",
                "ordering": ("indicator_code", "created_at"),
            },
        ),
        migrations.RunPython(seed_cash_flow_uc_rpt_05, migrations.RunPython.noop),
    ]
