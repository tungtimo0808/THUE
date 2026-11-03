import uuid

from django.db import migrations

AREAS = {
    "RPT.TAX.DETAIL": "Chi tiết báo cáo thuế, đối chiếu và số định danh",
    "RPT.COMMERCE.DETAIL": "Chi tiết báo cáo mua bán, lợi nhuận và hợp đồng",
    "RPT.DEBT.DETAIL": "Chi tiết báo cáo công nợ",
    "RPT.MONEY.DETAIL": "Chi tiết báo cáo tiền và đối chiếu ngân hàng",
    "RPT.INVENTORY.DETAIL": "Giá trị, giá vốn và đối chiếu tồn kho",
    "RPT.ASSET.DETAIL": "Chi tiết và đối chiếu báo cáo tài sản",
}
GRANTED_ROLES = ("COMPANY_ADMIN", "SYSTEM_ADMIN", "KT_TRUONG")


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    Role = apps.get_model("iam", "Role")
    RolePermission = apps.get_model("iam", "RolePermission")
    action, _ = Action.objects.get_or_create(code="VIEW", defaults={"id": uuid.uuid4(), "name": "Xem", "risk_level": "NORMAL"})
    for code, name in AREAS.items():
        resource, _ = Resource.objects.get_or_create(code=code, defaults={"id": uuid.uuid4(), "module_code": "RPT", "name": name})
        permission, _ = Permission.objects.get_or_create(code=f"{code}.VIEW", defaults={
            "id": uuid.uuid4(), "resource_id": resource.pk, "action_id": action.pk, "description": name, "status": "ACTIVE"})
        for role in Role.objects.filter(code__in=GRANTED_ROLES):
            RolePermission.objects.get_or_create(role=role, permission=permission, defaults={"effect": "ALLOW"})


class Migration(migrations.Migration):
    dependencies = [("iam", "0033_fixed_asset_report_permission")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
