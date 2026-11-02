from django.db import migrations

RELABELLED = (
    ("- Trong đó: Chi phí đi vay", "- Trong đó: Chi phí lãi vay"),
    ("4. Chi phí đi vay đã trả", "4. Tiền lãi vay đã trả"),
    ("- Chi phí đi vay", "- Chi phí lãi vay"),
    ("- Tăng, giảm chi phí chờ phân bổ", "- Tăng, giảm chi phí trả trước"),
)


def relabel(apps, schema_editor, pairs=RELABELLED):
    line_model = apps.get_model("reporting", "FinancialStatementLine")
    for old, new in pairs:
        line_model.objects.filter(indicator_name=old).update(indicator_name=new)


def restore(apps, schema_editor):
    relabel(apps, schema_editor, [(new, old) for old, new in RELABELLED])


class Migration(migrations.Migration):
    dependencies = [("reporting", "0019_tt133_note_text")]

    operations = [migrations.RunPython(relabel, restore)]
