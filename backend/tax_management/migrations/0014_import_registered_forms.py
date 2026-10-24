from django.db import migrations


KNOWN_FORMS = {
    "01/GTGT", "02/GTGT", "03/GTGT", "05/KK-TNCN", "05/QTT-TNCN",
    "DS-TNCN", "03/TNDN", "01/TTĐB", "01/TAIN",
}


def import_legacy_registrations(apps, schema_editor):
    connector_model = apps.get_model("tax_management", "ConnectorConfig")
    registration_model = apps.get_model("tax_management", "CompanyTaxFormRegistration")
    for connector in connector_model.objects.filter(code="TAX_AUTHORITY"):
        for form in (connector.config or {}).get("registered_forms", []):
            if not isinstance(form, dict) or form.get("code") not in KNOWN_FORMS:
                continue
            registration_model.objects.get_or_create(company_id=connector.company_id,
                form_code=form["code"], defaults={"frequency": str(form.get("frequency") or "")[:30]})


class Migration(migrations.Migration):
    dependencies = [("tax_management", "0013_tax_declaration_mvp")]
    operations = [migrations.RunPython(import_legacy_registrations, migrations.RunPython.noop)]
