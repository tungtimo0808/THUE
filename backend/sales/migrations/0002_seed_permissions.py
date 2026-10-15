import uuid
from django.db import migrations


RESOURCES={
    "SAL.QUOTATION":("Báo giá bán",("VIEW","CREATE","EDIT","SUBMIT","APPROVE","REJECT","SEND","ACCEPT","CANCEL")),
    "SAL.CONTRACT":("Hợp đồng bán",("VIEW","CREATE","EDIT","SUBMIT","APPROVE","REJECT","EXTEND","TERMINATE")),
    "SAL.ORDER":("Đơn bán hàng",("VIEW","CREATE","EDIT","SUBMIT","APPROVE","REJECT","CLOSE","CANCEL")),
    "SAL.DELIVERY":("Giao hàng và dịch vụ",("VIEW","CREATE","EDIT","CONFIRM","CANCEL")),
    "SAL.INVOICE_REQUEST":("Đề nghị lập hóa đơn",("VIEW","CREATE","EDIT","SUBMIT","CANCEL")),
    "SAL.APPROVAL":("Lịch sử phê duyệt bán hàng",("VIEW",)),
}


def seed(apps,schema_editor):
    Action=apps.get_model("iam","PermissionAction"); Resource=apps.get_model("iam","PermissionResource"); Permission=apps.get_model("iam","Permission")
    names={"VIEW":"Xem","CREATE":"Tạo","EDIT":"Cập nhật","SUBMIT":"Gửi xử lý","APPROVE":"Phê duyệt","REJECT":"Từ chối","SEND":"Gửi khách hàng","ACCEPT":"Chấp nhận","CANCEL":"Hủy","CLOSE":"Đóng","CONFIRM":"Xác nhận","EXTEND":"Gia hạn","TERMINATE":"Chấm dứt"}
    actions={}
    for code,name in names.items(): actions[code],_=Action.objects.get_or_create(code=code,defaults={"id":uuid.uuid4(),"name":name,"risk_level":"HIGH" if code in {"APPROVE","CANCEL","TERMINATE"} else "NORMAL"})
    for code,(name,codes) in RESOURCES.items():
        resource,_=Resource.objects.get_or_create(code=code,defaults={"id":uuid.uuid4(),"module_code":"SAL","name":name,"status":"ACTIVE"})
        for action in codes: Permission.objects.get_or_create(code=f"{code}.{action}",defaults={"id":uuid.uuid4(),"resource_id":resource.id,"action_id":actions[action].id,"description":f"{names[action]} - {name}","status":"ACTIVE"})


class Migration(migrations.Migration):
    dependencies=[("sales","0001_initial"),("iam","0005_seed_uc_md")]
    operations=[migrations.RunPython(seed,migrations.RunPython.noop)]
