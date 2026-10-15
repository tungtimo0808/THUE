from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from . import models
def actor(r):
    if hasattr(r, "user") and hasattr(r.user, "iam_account"):
        return r.user.iam_account
    from iam.models import UserAccount
    if hasattr(r, "user") and isinstance(r.user, UserAccount):
        return r.user
    return UserAccount.objects.first()
def audit(r,o,a,before=None,after=None,reason=""):record_audit(company=o.company,actor_user=actor(r),module_code="BANK",action_code=a,entity=o,before=before or {},after=after or {},request=r,reason=reason)
def incoming(tx):return tx.transaction_type in {"RECEIPT","INTEREST","OTHER_IN"}
@transaction.atomic
def submit(tx,r):
    tx=models.BankTransaction.objects.select_for_update().get(pk=tx.pk)
    if tx.status not in {"DRAFT","REJECTED"}:raise ValidationError("Trạng thái không cho phép gửi duyệt.")
    raw=r.data.get("workflow_snapshot") or {}
    try:levels=max(1,min(int(raw.get("levels",1)),20))
    except (TypeError,ValueError):raise ValidationError("Số cấp phê duyệt không hợp lệ.")
    tx.workflow_snapshot={"version":str(raw.get("version","DEFAULT"))[:80],"levels":levels,"allow_self_approval":bool(raw.get("allow_self_approval",True))}
    configured=configured_snapshot(tx,f"BANK.{tx.transaction_type}")
    if configured is not None:
        tx.workflow_snapshot=configured
        tx.approval_required=configured["approval_required"]
    before=tx.status;tx.status="PENDING_APPROVAL" if tx.approval_required else "APPROVED";tx.submitted_at=timezone.now();tx.approved_at=timezone.now() if tx.status=="APPROVED" else None;tx.save();models.ApprovalDecision.objects.create(company=tx.company,transaction=tx,decision="SUBMITTED",actor=actor(r));audit(r,tx,"SUBMIT",{"status":before},{"status":tx.status});return tx
@transaction.atomic
def decide(tx,r,approved):
    tx=models.BankTransaction.objects.select_for_update().get(pk=tx.pk);comment=r.data.get("comment","").strip()
    if tx.status!="PENDING_APPROVAL":raise ValidationError("Giao dịch không chờ duyệt.")
    if not approved and not comment:raise ValidationError({"comment":"Ý kiến từ chối là bắt buộc."})
    allow_self = tx.workflow_snapshot.get("allow_self_approval", True) or getattr(r.user, "is_superuser", False)
    if tx.created_by_id==actor(r).id and not allow_self:raise ValidationError("Không được tự phê duyệt.")
    level=tx.approval_decisions.filter(decision="APPROVED").count()+1;final=approved and level>=int(tx.workflow_snapshot.get("levels",1))
    progress=approval_progress(tx,actor(r),approved,tx.approval_decisions.all())
    if progress is not None:level,final=progress["level"],progress["final"]
    before=tx.status;tx.status="APPROVED" if final else "PENDING_APPROVAL" if approved or progress and progress["return_to_previous"] else "REJECTED";tx.approved_at=timezone.now() if final else None;tx.save(update_fields=("status","approved_at","updated_at"));models.ApprovalDecision.objects.create(company=tx.company,transaction=tx,level=level,decision="APPROVED" if approved else "REJECTED",actor=actor(r),comment=comment);audit(r,tx,"APPROVE" if approved else "REJECT",{"status":before},{"status":tx.status},comment);return tx
@transaction.atomic
def post(tx,r):
    tx=models.BankTransaction.objects.select_for_update().get(pk=tx.pk);account=models.AccountProfile.objects.select_for_update().get(pk=tx.account_id)
    if tx.status!="APPROVED" or tx.balance_applied:raise ValidationError("Giao dịch chưa duyệt hoặc đã cập nhật số dư.")
    available=account.balance+account.overdraft_limit
    if not incoming(tx) and not account.allow_overdraft and account.balance<tx.amount or not incoming(tx) and account.allow_overdraft and available<tx.amount:raise ValidationError("Số dư khả dụng không đủ.")
    account.balance=account.balance+tx.amount if incoming(tx) else account.balance-tx.amount;account.save(update_fields=("balance","updated_at"));tx.balance_applied=True;tx.status="POSTED";tx.posted_at=timezone.now();tx.bank_reference=r.data.get("bank_reference",tx.bank_reference);tx.save(update_fields=("balance_applied","status","posted_at","bank_reference","updated_at"));allocs=r.data.get("allocations",[])
    if tx.party_id and (allocs or incoming(tx) and tx.source_module=="AR"):
        proxy=type("Proxy",(),{"user":r.user,"data":{"allocations":allocs},"META":r.META,"method":r.method,"path":r.path})()
        if incoming(tx) and tx.source_module=="AR":
            from accounts_receivable.models import Receipt
            from accounts_receivable.services import allocate
            obj=Receipt.objects.create(company=tx.company,branch=tx.account.account.branch,customer=tx.party,currency=tx.currency,receipt_date=tx.transaction_date,amount=tx.amount,exchange_rate=tx.exchange_rate,base_amount=tx.base_amount,external_type="BANK",external_reference=str(tx.id),created_by=actor(r))
            if allocs: allocate(obj,proxy)
            tx.source_reference=str(obj.id)
        elif not incoming(tx) and tx.source_module=="AP":
            from accounts_payable.models import Payment
            from accounts_payable.services import allocate
            obj=Payment.objects.create(company=tx.company,supplier=tx.party,currency=tx.currency,payment_date=tx.transaction_date,amount=tx.amount,external_type="BANK",external_reference=str(tx.id),created_by=actor(r));allocate(obj,proxy);tx.source_reference=str(obj.id)
        tx.save(update_fields=("source_reference",))
    audit(r,tx,"POST",after={"balance":str(account.balance)});return tx
@transaction.atomic
def reverse(tx,r):
    tx=models.BankTransaction.objects.select_for_update().get(pk=tx.pk);reason=r.data.get("reason","").strip()
    if tx.status!="POSTED" or not reason or tx.source_reference:raise ValidationError("Giao dịch không thể đảo; cần lý do và xử lý liên kết AR/AP trước.")
    account=models.AccountProfile.objects.select_for_update().get(pk=tx.account_id);new=account.balance-tx.amount if incoming(tx) else account.balance+tx.amount
    if new<0 and not account.allow_overdraft:raise ValidationError("Đảo giao dịch sẽ làm số dư âm.")
    account.balance=new;account.save(update_fields=("balance","updated_at"));tx.status="REVERSED";tx.save(update_fields=("status","updated_at"));audit(r,tx,"REVERSE",after={"balance":str(new)},reason=reason);return tx
@transaction.atomic
def post_gl(tx,r):
    tx=models.BankTransaction.objects.select_for_update().get(pk=tx.pk);ref=r.data.get("gl_reference","").strip()
    if tx.status!="POSTED" or tx.gl_status=="POSTED" or not ref:raise ValidationError("Giao dịch chưa hiệu lực, đã hạch toán hoặc thiếu mã GL.")
    tx.gl_status="POSTED";tx.gl_reference=ref;tx.save(update_fields=("gl_status","gl_reference","updated_at"));audit(r,tx,"POST_GL",after={"gl_reference":ref});return tx
@transaction.atomic
def confirm_transfer(o,r):
    o=models.BankTransfer.objects.select_for_update().get(pk=o.pk)
    if o.status!="DRAFT":raise ValidationError("Điều chuyển đã xử lý.")
    s=models.AccountProfile.objects.select_for_update().get(pk=o.source_account_id);d=models.AccountProfile.objects.select_for_update().get(pk=o.destination_account_id)
    if s.balance+(s.overdraft_limit if s.allow_overdraft else 0)<o.source_amount:raise ValidationError("Số dư nguồn không đủ.")
    s.balance-=o.source_amount;d.balance+=o.destination_amount;s.save(update_fields=("balance","updated_at"));d.save(update_fields=("balance","updated_at"));o.status="CONFIRMED";o.confirmed_by=actor(r);o.save(update_fields=("status","confirmed_by"));audit(r,o,"TRANSFER",after={"status":o.status});return o
@transaction.atomic
def reconcile(line,tx,amount,note,r):
    line=models.StatementLine.objects.select_for_update().get(pk=line.pk);tx=models.BankTransaction.objects.select_for_update().get(pk=tx.pk);amount=Decimal(str(amount))
    if line.match_status=="MATCHED" or line.statement.account_id!=tx.account_id:raise ValidationError("Dòng sao kê đã khớp hoặc không cùng tài khoản.")
    expected_direction="CREDIT" if incoming(tx) else "DEBIT"
    if line.direction!=expected_direction:raise ValidationError("Chiều giao dịch không khớp.")
    variance=line.amount-amount;status="MATCHED" if variance==0 and amount==tx.amount else "VARIANCE";obj=models.Reconciliation.objects.create(company=tx.company,statement_line=line,transaction=tx,matched_amount=amount,variance=variance,status=status,note=note,created_by=actor(r));line.match_status="MATCHED" if status=="MATCHED" else "VARIANCE";line.save(update_fields=("match_status",));audit(r,obj,"RECONCILE",after={"status":status,"variance":str(variance)});return obj
@transaction.atomic
def send_integration(tx,r):
    tx=models.BankTransaction.objects.select_for_update().get(pk=tx.pk);key=r.data.get("idempotency_key","").strip()
    if not tx.account.integration_enabled or not key:raise ValidationError("Tài khoản chưa bật tích hợp hoặc thiếu idempotency key.")
    if models.IntegrationRequest.objects.filter(idempotency_key=key).exists():raise ValidationError({"idempotency_key":"Yêu cầu này đã được gửi trước đó."})
    obj=models.IntegrationRequest.objects.create(company=tx.company,account=tx.account,transaction=tx,request_type="PAYMENT",idempotency_key=key,request_payload=r.data.get("payload",{}),created_by=actor(r));tx.integration_status="PENDING";tx.save(update_fields=("integration_status","updated_at"));audit(r,tx,"SEND_BANK",after={"request":str(obj.id)});return tx
@transaction.atomic
def integration_result(o,r):
    o=models.IntegrationRequest.objects.select_for_update().get(pk=o.pk);status=r.data.get("status")
    if o.status!="PENDING" or status not in {"SUCCESS","FAILED"}:raise ValidationError("Kết quả tích hợp không hợp lệ.")
    o.status=status;o.response_payload=r.data.get("response",{});o.error_message=r.data.get("error_message","");o.save(update_fields=("status","response_payload","error_message","updated_at"))
    if o.transaction_id:o.transaction.integration_status=status;o.transaction.save(update_fields=("integration_status","updated_at"))
    audit(r,o,"BANK_RESULT",after={"status":status});return o
