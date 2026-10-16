import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts_receivable', '0024_debt_adjustment_voucher_permissions'),
        ('general_ledger', '0004_account_default_currency_account_description_and_more'),
        ('iam', '0029_account_management_permissions'),
        ('master_data', '0024_item_requires_service_acceptance'),
        ('organization', '0005_employee_address_employee_advance_account_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomerDebtReconciliation',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('number', models.CharField(max_length=80)),
                ('statement_date', models.DateField()),
                ('from_date', models.DateField()),
                ('to_date', models.DateField()),
                ('contact_person', models.CharField(blank=True, max_length=255)),
                ('contact_email', models.CharField(blank=True, max_length=255)),
                ('note', models.TextField(blank=True)),
                ('opening_balance', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('period_increase', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('period_decrease', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('closing_balance', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('unallocated_receipts', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('data_extracted_at', models.DateTimeField(blank=True, null=True)),
                ('snapshot_data', models.JSONField(blank=True, default=dict)),
                ('status', models.CharField(choices=[('DRAFT', 'Nháp'), ('PENDING_RESPONSE', 'Chờ phản hồi'), ('MATCHED', 'Đã xác nhận khớp'), ('DISCREPANCY', 'Có chênh lệch'), ('CANCELLED', 'Đã hủy')], default='DRAFT', max_length=30)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('sent_channel', models.CharField(blank=True, max_length=100)),
                ('sent_note', models.CharField(blank=True, max_length=500)),
                ('response_date', models.DateField(blank=True, null=True)),
                ('customer_confirmer_name', models.CharField(blank=True, max_length=255)),
                ('customer_confirmed_balance', models.DecimalField(blank=True, decimal_places=4, max_digits=20, null=True)),
                ('customer_confirmed_unallocated', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('balance_difference', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('unallocated_difference', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('response_comment', models.TextField(blank=True)),
                ('difference_reason', models.TextField(blank=True)),
                ('confirmation_documents', models.JSONField(blank=True, default=list)),
                ('responded_at', models.DateTimeField(blank=True, null=True)),
                ('cancelled_at', models.DateTimeField(blank=True, null=True)),
                ('cancel_reason', models.CharField(blank=True, max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('version', models.PositiveIntegerField(default=1)),
                ('branch', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ar_customer_debt_reconciliations', to='organization.branch')),
                ('cancelled_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='ar_reconciliations_cancelled', to='iam.useraccount')),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ar_customer_debt_reconciliations', to='organization.company')),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ar_reconciliations_created', to='iam.useraccount')),
                ('currency', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='master_data.currency')),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ar_customer_debt_reconciliations', to='master_data.party')),
                ('previous_reconciliation', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='re_reconciliations', to='accounts_receivable.customerdebtreconciliation')),
                ('receivable_account', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ar_reconciliations_rec_account', to='general_ledger.account')),
                ('responded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='ar_reconciliations_responded', to='iam.useraccount')),
                ('sent_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='ar_reconciliations_sent', to='iam.useraccount')),
            ],
            options={
                'db_table': 'ar_customer_debt_reconciliation',
                'ordering': ('-statement_date', '-created_at'),
            },
        ),
        migrations.CreateModel(
            name='CustomerDebtReconciliationLine',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('line_no', models.PositiveIntegerField()),
                ('posting_date', models.DateField()),
                ('document_date', models.DateField(blank=True, null=True)),
                ('document_number', models.CharField(max_length=100)),
                ('document_type', models.CharField(blank=True, max_length=100)),
                ('description', models.CharField(blank=True, max_length=500)),
                ('increase_amount', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('decrease_amount', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('running_balance', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('source_entity_type', models.CharField(blank=True, max_length=100)),
                ('source_entity_id', models.CharField(blank=True, max_length=100)),
                ('receivable', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='reconciliation_lines', to='accounts_receivable.receivable')),
                ('reconciliation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lines', to='accounts_receivable.customerdebtreconciliation')),
            ],
            options={
                'db_table': 'ar_customer_debt_reconciliation_line',
                'ordering': ('line_no',),
            },
        ),
        migrations.AddConstraint(
            model_name='customerdebtreconciliation',
            constraint=models.UniqueConstraint(fields=('company', 'number'), name='uq_ar_customer_debt_reconciliation_number'),
        ),
        migrations.AddConstraint(
            model_name='customerdebtreconciliation',
            constraint=models.CheckConstraint(condition=models.Q(from_date__lte=models.F('to_date')), name='ck_ar_reconciliation_date_range'),
        ),
        migrations.AddConstraint(
            model_name='customerdebtreconciliationline',
            constraint=models.UniqueConstraint(fields=('reconciliation', 'line_no'), name='uq_ar_reconciliation_line_no'),
        ),
    ]
