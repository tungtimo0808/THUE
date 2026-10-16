import uuid
from django.db import migrations

# Permission codes the services and views check, but that no earlier migration created.
# Without them no ordinary user (only superusers) can perform these actions.
PERMISSIONS = {
    "AP.PAYMENT.POST": "Ghi sổ chứng từ thanh toán nhà cung cấp",
    "AP.PAYMENT.POST_DIRECT": "Ghi sổ thanh toán không qua đề nghị",
    "AP.PAYMENT.CANCEL_POSTED": "Hủy chứng từ thanh toán đã ghi sổ",
    "AR.ADJUSTMENT.SUBMIT": "Gửi duyệt chứng từ điều chỉnh công nợ",
    "AR.ADJUSTMENT.APPROVE": "Duyệt chứng từ điều chỉnh công nợ",
    "AR.ADJUSTMENT.CANCEL": "Hủy chứng từ điều chỉnh công nợ",
    "AR.ADJUSTMENT.UNPOST": "Bỏ ghi chứng từ điều chỉnh công nợ",
    "AR.NETTING.SUBMIT": "Gửi duyệt chứng từ bù trừ công nợ",
    "AR.NETTING.APPROVE": "Duyệt chứng từ bù trừ công nợ",
    "AR.NETTING.CANCEL": "Hủy chứng từ bù trừ công nợ",
    "AR.NETTING.UNPOST": "Bỏ ghi chứng từ bù trừ công nợ",
    "MD.PARTY.DELETE": "Xóa đối tượng",
    "MD.PARTY.MERGE": "Gộp đối tượng",
    "MD.PARTY.STATUS": "Đổi trạng thái đối tượng",
    "PUR.COST.DELETE": "Xóa chứng từ chi phí mua hàng",
    "PUR.ORDER.EXPORT": "Xuất khẩu đơn mua hàng",
    "PUR.SUPPLIER_RISK.CHECK_TX": "Kiểm tra rủi ro nhà cung cấp khi lập chứng từ",
    "RPT.REPORT.VIEW": "Xem báo cáo",
    "SAL.ORDER.EDIT_PAYMENT_TERM": "Sửa điều khoản thanh toán của đơn bán",
    "SAL.ORDER.EXPORT": "Xuất khẩu đơn bán hàng",
    "SYS.MEMBERSHIP.TERMINATE": "Chấm dứt thành viên doanh nghiệp",
}

ACTION_NAMES = {
    "POST": "Ghi sổ", "POST_DIRECT": "Ghi sổ trực tiếp", "CANCEL_POSTED": "Hủy đã ghi sổ", "SUBMIT": "Gửi duyệt",
    "APPROVE": "Duyệt", "CANCEL": "Hủy", "UNPOST": "Bỏ ghi", "DELETE": "Xóa", "MERGE": "Gộp", "STATUS": "Đổi trạng thái",
    "EXPORT": "Xuất khẩu", "CHECK_TX": "Kiểm tra giao dịch", "VIEW": "Xem", "EDIT_PAYMENT_TERM": "Sửa điều khoản thanh toán",
    "TERMINATE": "Chấm dứt",
}
HIGH_RISK = {"POST", "POST_DIRECT", "CANCEL_POSTED", "UNPOST", "DELETE", "MERGE", "TERMINATE"}


def seed(apps, schema_editor):
    Action = apps.get_model("iam", "PermissionAction")
    Resource = apps.get_model("iam", "PermissionResource")
    Permission = apps.get_model("iam", "Permission")
    for code, description in PERMISSIONS.items():
        resource_code, action_code = code.rsplit(".", 1)
        action, _ = Action.objects.get_or_create(code=action_code, defaults={
            "id": uuid.uuid4(), "name": ACTION_NAMES[action_code],
            "risk_level": "HIGH" if action_code in HIGH_RISK else "NORMAL"})
        resource, _ = Resource.objects.get_or_create(code=resource_code, defaults={
            "id": uuid.uuid4(), "module_code": resource_code.split(".")[0], "name": resource_code, "status": "ACTIVE"})
        Permission.objects.get_or_create(code=code, defaults={
            "id": uuid.uuid4(), "resource_id": resource.id, "action_id": action.id,
            "description": description, "status": "ACTIVE"})


class Migration(migrations.Migration):
    dependencies = [
        ("iam", "0029_account_management_permissions"),
        ("accounts_payable", "0028_seed_report_permission"),
        ("accounts_receivable", "0030_payment_reminder_permissions"),
        ("master_data", "0024_item_requires_service_acceptance"),
        ("purchases", "0034_alter_supplierriskassessment_options"),
        ("sales", "0032_seed_sales_commercial_invoice_permissions"),
        ("common_services", "0015_seed_policy_permissions"),
    ]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
