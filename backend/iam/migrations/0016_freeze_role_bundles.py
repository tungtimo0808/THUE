from django.db import migrations


def freeze(apps, schema_editor):
    Link = apps.get_model("iam", "RolePermissionBundle")
    Grant = apps.get_model("iam", "RolePermission")
    Item = apps.get_model("iam", "PermissionBundleItem")
    for link in Link.objects.all().iterator():
        for permission_id in Item.objects.filter(bundle_id=link.bundle_id).values_list("permission_id", flat=True):
            Grant.objects.update_or_create(role_id=link.role_id, permission_id=permission_id,
                                           defaults={"effect": "ALLOW"})
    Link.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("iam", "0015_access_management_permissions")]
    operations = [migrations.RunPython(freeze, migrations.RunPython.noop)]
