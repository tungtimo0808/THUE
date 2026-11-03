from django.db import migrations
from django.db.models import Exists, OuterRef


def unset_parents(apps, schema_editor):
    # BR-COA-14: a summary account with active children cannot be posted to, so posting flows must not pick it.
    Account = apps.get_model("general_ledger", "Account")
    active_child = Account.objects.filter(parent_id=OuterRef("pk"), status="ACTIVE")
    Account.objects.filter(is_postable=True).filter(Exists(active_child)).update(is_postable=False)


class Migration(migrations.Migration):
    dependencies = [("general_ledger", "0021_opening_balance_permissions")]
    operations = [migrations.RunPython(unset_parents, migrations.RunPython.noop)]
