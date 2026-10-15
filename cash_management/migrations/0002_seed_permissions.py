import uuid
from django.db import migrations
RESOURCES={"CASH.FUND":("Quỹ tiền mặt",("VIEW","CREATE","EDIT")),"CASH.TRANSACTION":("Giao dịch tiền mặt",("VIEW","CREATE","EDIT","SUBMIT","APPROVE","REJECT","CONFIRM","POST","REVERSE","CANCEL")),"CASH.TRANSFER":("Điều chuyển tiền",("VIEW","CREATE","EDIT","TRANSFER","CONFIRM","CANCEL")),"CASH.ADVANCE":("Tạm ứng",("VIEW","CREATE","EDIT","SUBMIT","APPROVE","REJECT","CONFIRM","SETTLE")),"CASH.COUNT":("Kiểm kê quỹ",("VIEW","CREATE","EDIT","COUNT","ADJUST")),"CASH.REVALUATION":("Đánh giá lại ngoại tệ",("VIEW","CREATE","EDIT","POST")),"CASH.APPROVAL":("Lịch sử phê duyệt tiền mặt",("VIEW",))}
def seed(apps,schema_editor):
    A=apps.get_model("iam","PermissionAction");R=apps.get_model("iam","PermissionResource");P=apps.get_model("iam","Permission");names={"VIEW":"Xem","CREATE":"Tạo","EDIT":"Cập nhật","SUBMIT":"Gửi duyệt","APPROVE":"Phê duyệt","REJECT":"Từ chối","CONFIRM":"Xác nhận","POST":"Ghi sổ","REVERSE":"Đảo","CANCEL":"Hủy","TRANSFER":"Điều chuyển","SETTLE":"Quyết toán","COUNT":"Kiểm kê","ADJUST":"Điều chỉnh"};actions={}
    for c,n in names.items():actions[c],_=A.objects.get_or_create(code=c,defaults={"id":uuid.uuid4(),"name":n,"risk_level":"HIGH" if c in {"APPROVE","POST","REVERSE","ADJUST"} else "NORMAL"})
    for code,(name,codes) in RESOURCES.items():
        resource,_=R.objects.get_or_create(code=code,defaults={"id":uuid.uuid4(),"module_code":"CASH","name":name,"status":"ACTIVE"})
        for a in codes:P.objects.get_or_create(code=f"{code}.{a}",defaults={"id":uuid.uuid4(),"resource_id":resource.id,"action_id":actions[a].id,"description":f"{names[a]} - {name}","status":"ACTIVE"})
class Migration(migrations.Migration):
    dependencies=[("cash_management","0001_initial"),("iam","0005_seed_uc_md")];operations=[migrations.RunPython(seed,migrations.RunPython.noop)]
