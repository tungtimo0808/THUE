import uuid
from django.db import migrations
RES={"BANK.ACCOUNT":("Tài khoản ngân hàng",("VIEW","CREATE","EDIT","CONFIGURE")),"BANK.TRANSACTION":("Giao dịch ngân hàng",("VIEW","CREATE","EDIT","SUBMIT","APPROVE","REJECT","POST","REVERSE","CANCEL")),"BANK.TRANSFER":("Điều chuyển ngân hàng",("VIEW","CREATE","EDIT","TRANSFER","REVERSE")),"BANK.STATEMENT":("Sao kê ngân hàng",("VIEW","CREATE","EDIT","IMPORT")),"BANK.RECONCILIATION":("Đối chiếu ngân hàng",("VIEW","RECONCILE")),"BANK.INTEGRATION":("Kết nối ngân hàng",("VIEW","IMPORT","EXPORT","CONFIGURE")),"BANK.REVALUATION":("Đánh giá lại ngoại tệ",("VIEW","CREATE","EDIT","POST")),"BANK.APPROVAL":("Lịch sử phê duyệt ngân hàng",("VIEW",))}
def seed(apps,schema_editor):
 A=apps.get_model("iam","PermissionAction");R=apps.get_model("iam","PermissionResource");P=apps.get_model("iam","Permission");names={"VIEW":"Xem","CREATE":"Tạo","EDIT":"Cập nhật","CONFIGURE":"Cấu hình","SUBMIT":"Gửi duyệt","APPROVE":"Phê duyệt","REJECT":"Từ chối","POST":"Ghi sổ","REVERSE":"Đảo","CANCEL":"Hủy","TRANSFER":"Điều chuyển","IMPORT":"Nhập","EXPORT":"Gửi","RECONCILE":"Đối chiếu"};actions={}
 for c,n in names.items():actions[c],_=A.objects.get_or_create(code=c,defaults={"id":uuid.uuid4(),"name":n,"risk_level":"HIGH" if c in {"APPROVE","POST","REVERSE","TRANSFER"} else "NORMAL"})
 for code,(name,codes) in RES.items():
  resource,_=R.objects.get_or_create(code=code,defaults={"id":uuid.uuid4(),"module_code":"BANK","name":name,"status":"ACTIVE"})
  for a in codes:P.objects.get_or_create(code=f"{code}.{a}",defaults={"id":uuid.uuid4(),"resource_id":resource.id,"action_id":actions[a].id,"description":f"{names[a]} - {name}","status":"ACTIVE"})
class Migration(migrations.Migration):dependencies=[("bank_management","0001_initial"),("iam","0005_seed_uc_md")];operations=[migrations.RunPython(seed,migrations.RunPython.noop)]
