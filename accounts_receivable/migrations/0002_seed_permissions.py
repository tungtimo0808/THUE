import uuid
from django.db import migrations

RESOURCES={
    "AR.DOCUMENT":("Chứng từ phải thu",("VIEW","CREATE","EDIT","SUBMIT","APPROVE","REJECT","POST","REVERSE")),
    "AR.RECEIVABLE":("Công nợ khách hàng",("VIEW",)),
    "AR.CREDIT_POLICY":("Hạn mức tín dụng",("VIEW","CREATE","EDIT")),
    "AR.COLLECTION_PLAN":("Kế hoạch thu và nhắc nợ",("VIEW","CREATE","EDIT","REMIND")),
    "AR.RECEIPT":("Khoản thu và phân bổ",("VIEW","CREATE","EDIT","ALLOCATE","CANCEL")),
    "AR.NETTING":("Đối trừ công nợ",("VIEW","CREATE","EDIT","POST","REVERSE")),
    "AR.CONFIRMATION":("Xác nhận công nợ",("VIEW","CREATE","EDIT","SEND","RESPOND")),
    "AR.ADJUSTMENT":("Điều chỉnh công nợ",("VIEW","CREATE","EDIT","POST","REVERSE")),
    "AR.APPROVAL":("Lịch sử phê duyệt phải thu",("VIEW",)),
}

def seed(apps,schema_editor):
    Action=apps.get_model("iam","PermissionAction");Resource=apps.get_model("iam","PermissionResource");Permission=apps.get_model("iam","Permission")
    names={"VIEW":"Xem","CREATE":"Tạo","EDIT":"Cập nhật","SUBMIT":"Gửi duyệt","APPROVE":"Phê duyệt","REJECT":"Từ chối","POST":"Ghi sổ","REVERSE":"Đảo","REMIND":"Gửi nhắc nợ","ALLOCATE":"Phân bổ","CANCEL":"Hủy","SEND":"Gửi","RESPOND":"Ghi nhận phản hồi"}
    actions={}
    for code,name in names.items():actions[code],_=Action.objects.get_or_create(code=code,defaults={"id":uuid.uuid4(),"name":name,"risk_level":"HIGH" if code in {"APPROVE","POST","REVERSE"} else "NORMAL"})
    for code,(name,codes) in RESOURCES.items():
        resource,_=Resource.objects.get_or_create(code=code,defaults={"id":uuid.uuid4(),"module_code":"AR","name":name,"status":"ACTIVE"})
        for action in codes:Permission.objects.get_or_create(code=f"{code}.{action}",defaults={"id":uuid.uuid4(),"resource_id":resource.id,"action_id":actions[action].id,"description":f"{names[action]} - {name}","status":"ACTIVE"})

class Migration(migrations.Migration):
    dependencies=[("accounts_receivable","0001_initial"),("iam","0005_seed_uc_md")]
    operations=[migrations.RunPython(seed,migrations.RunPython.noop)]
