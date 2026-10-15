import uuid
from django.db import migrations

RESOURCES = {
    "AP.INVOICE": ("Hóa đơn đầu vào", ("VIEW", "CREATE", "EDIT", "MATCH", "SUBMIT", "APPROVE", "REJECT", "POST", "REVERSE")),
    "AP.PAYABLE": ("Công nợ nhà cung cấp", ("VIEW",)),
    "AP.PAYMENT_REQUEST": ("Đề nghị thanh toán", ("VIEW", "CREATE", "EDIT", "SUBMIT", "APPROVE", "REJECT", "CANCEL")),
    "AP.PAYMENT": ("Thanh toán và phân bổ", ("VIEW", "CREATE", "EDIT", "ALLOCATE", "CANCEL")),
    "AP.NETTING": ("Đối trừ công nợ", ("VIEW", "CREATE", "EDIT", "POST", "REVERSE")),
    "AP.ADJUSTMENT": ("Điều chỉnh công nợ", ("VIEW", "CREATE", "EDIT", "POST", "REVERSE")),
    "AP.APPROVAL": ("Lịch sử phê duyệt phải trả", ("VIEW",)),
}

def seed(apps, schema_editor):
    Action=apps.get_model("iam","PermissionAction"); Resource=apps.get_model("iam","PermissionResource"); Permission=apps.get_model("iam","Permission")
    names={"VIEW":"Xem","CREATE":"Tạo","EDIT":"Cập nhật","MATCH":"Đối chiếu","SUBMIT":"Gửi duyệt","APPROVE":"Phê duyệt","REJECT":"Từ chối","POST":"Ghi sổ","REVERSE":"Đảo","ALLOCATE":"Phân bổ","CANCEL":"Hủy"}
    actions={}
    for code,name in names.items(): actions[code],_=Action.objects.get_or_create(code=code,defaults={"id":uuid.uuid4(),"name":name,"risk_level":"HIGH" if code in {"POST","REVERSE","APPROVE"} else "NORMAL"})
    for code,(name,codes) in RESOURCES.items():
        resource,_=Resource.objects.get_or_create(code=code,defaults={"id":uuid.uuid4(),"module_code":"AP","name":name,"status":"ACTIVE"})
        for action in codes: Permission.objects.get_or_create(code=f"{code}.{action}",defaults={"id":uuid.uuid4(),"resource_id":resource.id,"action_id":actions[action].id,"description":f"{names[action]} - {name}","status":"ACTIVE"})

class Migration(migrations.Migration):
    dependencies=[("accounts_payable","0001_initial"),("iam","0005_seed_uc_md")]
    operations=[migrations.RunPython(seed,migrations.RunPython.noop)]
