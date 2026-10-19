from django.db import migrations

FLAGS = {"PROJECT": "requires_project", "COST_CENTER": "requires_cost_center", "WAREHOUSE": "requires_warehouse"}
PARTY = ("CUSTOMER", "SUPPLIER", "EMPLOYEE")


def relax(apps, schema_editor):
    """Accounts whose dimensions are only OPTIONAL were saved as if they were mandatory; clear those flags."""
    Account = apps.get_model("general_ledger", "Account")
    for account in Account.objects.exclude(dimension_requirements={}).iterator():
        reqs = account.dimension_requirements or {}
        changed = []
        for dimension, flag in FLAGS.items():
            if reqs.get(dimension) and reqs[dimension] != "REQUIRED" and getattr(account, flag):
                setattr(account, flag, False)
                changed.append(flag)
        party_levels = [reqs[key] for key in PARTY if key in reqs]
        if party_levels and "REQUIRED" not in party_levels and account.requires_party:
            account.requires_party = False
            changed.append("requires_party")
        if changed:
            account.save(update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [("general_ledger", "0005_prepaid_expenses")]
    operations = [migrations.RunPython(relax, migrations.RunPython.noop)]
