import uuid

from django.db import migrations


RESOURCES = {
    "MD.PARTY": "Khách hàng và nhà cung cấp",
    "MD.ITEM": "Vật tư, hàng hóa và dịch vụ",
    "MD.WAREHOUSE": "Kho và vị trí kho",
    "MD.ACCOUNT": "Hệ thống tài khoản kế toán",
    "MD.BANK_ACCOUNT": "Tài khoản ngân hàng",
    "MD.ORGANIZATION": "Dự án và đối tượng tập hợp",
    "MD.COMMON": "Danh mục kế toán dùng chung",
}
ACTIONS = ("VIEW", "CREATE", "EDIT", "IMPORT", "EXPORT")


def seed_uc_md(apps, schema_editor):
    PermissionAction = apps.get_model("iam", "PermissionAction")
    PermissionResource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    actions = {item.code: item for item in PermissionAction.objects.filter(code__in=ACTIONS)}
    for code, name in RESOURCES.items():
        resource, _ = PermissionResource.objects.get_or_create(
            code=code,
            defaults={"id": uuid.uuid4(), "module_code": "MD", "name": name, "status": "ACTIVE"},
        )
        for action_code in ACTIONS:
            action = actions[action_code]
            Permission.objects.get_or_create(
                code=f"{code}.{action_code}",
                defaults={
                    "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
                    "description": f"{action.name} - {name}", "status": "ACTIVE",
                },
            )


class Migration(migrations.Migration):
    dependencies = [("iam", "0004_datascopebankaccount_company_bank_account_and_more")]
    operations = [migrations.RunPython(seed_uc_md, migrations.RunPython.noop)]
