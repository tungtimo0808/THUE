import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts_receivable', '0028_alter_receivable_due_date_nullable'),
        ('general_ledger', '0004_account_default_currency_account_description_and_more'),
        ('iam', '0029_account_management_permissions'),
        ('master_data', '0024_item_requires_service_acceptance'),
        ('organization', '0005_employee_address_employee_advance_account_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomerPaymentReminder',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('notice_number', models.CharField(max_length=80)),
                ('notice_date', models.DateField()),
                ('recipient_name', models.CharField(max_length=255)),
                ('recipient_email', models.CharField(blank=True, max_length=255)),
                ('customer_address', models.CharField(blank=True, max_length=500)),
                ('requested_due_date', models.DateField()),
                ('title', models.CharField(default='Thông báo đề nghị thanh toán công nợ', max_length=255)),
                ('content', models.TextField(blank=True)),
                ('payment_method', models.CharField(choices=[('BANK_TRANSFER', 'Chuyển khoản'), ('CASH', 'Tiền mặt')], default='BANK_TRANSFER', max_length=20)),
                ('bank_info_snapshot', models.JSONField(blank=True, default=dict)),
                ('cash_location', models.CharField(blank=True, max_length=500)),
                ('transfer_note', models.CharField(blank=True, max_length=255)),
                ('total_requested_amount', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('signer_name', models.CharField(blank=True, max_length=255)),
                ('signer_title', models.CharField(blank=True, max_length=150)),
                ('attachments', models.JSONField(blank=True, default=list)),
                ('data_extracted_at', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('DRAFT', 'Nháp'), ('SENT', 'Đã gửi'), ('CANCELLED', 'Đã hủy')], default='DRAFT', max_length=30)),
                ('last_sent_at', models.DateTimeField(blank=True, null=True)),
                ('last_sent_channel', models.CharField(blank=True, max_length=100)),
                ('send_count', models.PositiveIntegerField(default=0)),
                ('cancelled_at', models.DateTimeField(blank=True, null=True)),
                ('cancel_reason', models.CharField(blank=True, max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('version', models.PositiveIntegerField(default=1)),
                ('branch', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='ar_customer_payment_reminders', to='organization.branch')),
                ('cancelled_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='ar_reminders_cancelled', to='iam.useraccount')),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ar_customer_payment_reminders', to='organization.company')),
                ('company_bank_account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='customer_payment_reminders', to='master_data.companybankaccount')),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ar_reminders_created', to='iam.useraccount')),
                ('currency', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='master_data.currency')),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ar_customer_payment_reminders', to='master_data.party')),
                ('previous_notice', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='re_notices', to='accounts_receivable.customerpaymentreminder')),
                ('receivable_account', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ar_reminders_rec_account', to='general_ledger.account')),
                ('signer_employee', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='signed_payment_reminders', to='organization.employee')),
                ('signer_user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='signed_payment_reminders', to='iam.useraccount')),
            ],
            options={
                'db_table': 'ar_customer_payment_reminder',
                'ordering': ('-notice_date', '-created_at'),
            },
        ),
        migrations.CreateModel(
            name='CustomerPaymentReminderSendLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('sent_date', models.DateField()),
                ('sent_channel', models.CharField(choices=[('EMAIL', 'Email'), ('PAPER', 'Bản giấy'), ('OTHER', 'Kênh khác')], max_length=20)),
                ('channel_other_name', models.CharField(blank=True, max_length=100)),
                ('actual_recipient', models.CharField(max_length=255)),
                ('proof_documents', models.JSONField(blank=True, default=list)),
                ('note', models.TextField(blank=True)),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('notice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='send_logs', to='accounts_receivable.customerpaymentreminder')),
                ('sent_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ar_reminder_send_logs', to='iam.useraccount')),
            ],
            options={
                'db_table': 'ar_customer_payment_reminder_send_log',
                'ordering': ('-sent_date', '-sent_at'),
            },
        ),
        migrations.CreateModel(
            name='CustomerPaymentReminderLine',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('line_no', models.PositiveIntegerField()),
                ('installment_no', models.PositiveIntegerField(default=1)),
                ('source_document_number', models.CharField(blank=True, max_length=100)),
                ('source_document_date', models.DateField(blank=True, null=True)),
                ('invoice_series', models.CharField(blank=True, max_length=50)),
                ('invoice_number', models.CharField(blank=True, max_length=80)),
                ('invoice_date', models.DateField(blank=True, null=True)),
                ('original_due_date', models.DateField(blank=True, null=True)),
                ('remaining_balance', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('requested_amount', models.DecimalField(decimal_places=4, max_digits=20)),
                ('days_overdue', models.IntegerField(blank=True, null=True)),
                ('line_note', models.CharField(blank=True, max_length=500)),
                ('notice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lines', to='accounts_receivable.customerpaymentreminder')),
                ('receivable', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='reminder_lines', to='accounts_receivable.receivable')),
                ('receivable_schedule', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='reminder_lines', to='accounts_receivable.receivableschedule')),
            ],
            options={
                'db_table': 'ar_customer_payment_reminder_line',
                'ordering': ('line_no',),
            },
        ),
        migrations.AddConstraint(
            model_name='customerpaymentreminder',
            constraint=models.UniqueConstraint(fields=('company', 'notice_number'), name='uq_ar_customer_payment_reminder_number'),
        ),
        migrations.AddConstraint(
            model_name='customerpaymentreminder',
            constraint=models.CheckConstraint(condition=models.Q(requested_due_date__gte=models.F('notice_date')), name='ck_ar_reminder_due_date'),
        ),
        migrations.AddConstraint(
            model_name='customerpaymentreminderline',
            constraint=models.UniqueConstraint(fields=('notice', 'line_no'), name='uq_ar_reminder_line_no'),
        ),
        migrations.AddConstraint(
            model_name='customerpaymentreminderline',
            constraint=models.UniqueConstraint(condition=models.Q(receivable_schedule__isnull=True), fields=('notice', 'receivable'), name='uq_ar_reminder_rec_no_schedule'),
        ),
        migrations.AddConstraint(
            model_name='customerpaymentreminderline',
            constraint=models.UniqueConstraint(condition=models.Q(receivable_schedule__isnull=False), fields=('notice', 'receivable', 'receivable_schedule'), name='uq_ar_reminder_rec_with_schedule'),
        ),
        migrations.AddConstraint(
            model_name='customerpaymentreminderline',
            constraint=models.CheckConstraint(condition=models.Q(requested_amount__gt=0), name='ck_ar_reminder_line_requested_positive'),
        ),
    ]
