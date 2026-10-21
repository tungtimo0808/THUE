import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('bank_management', '0015_bankbalancereportpreset')]
    operations = [migrations.CreateModel(
        name='BankDepositLedgerPreset',
        fields=[
            ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
            ('name', models.CharField(max_length=150)),
            ('parameters', models.JSONField(default=dict)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('company', models.ForeignKey(to='organization.company', on_delete=django.db.models.deletion.PROTECT)),
            ('created_by', models.ForeignKey(to='iam.useraccount', on_delete=django.db.models.deletion.PROTECT)),
        ], options={'db_table': 'bank_deposit_ledger_preset', 'ordering': ('-created_at',)},
    )]
