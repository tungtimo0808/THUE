from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from . import models

def actor(request):return request.user.iam_account
def audit(request,obj,action,before=None,after=None,reason=""):record_audit(company=obj.company,actor_user=actor(request),module_code="CASH",action_code=action,entity=obj,before=before or {},after=after or {},request=request,reason=reason)
def incoming(tx):return tx.transaction_type in {"RECEIPT","ADVANCE_RETURN","ADJUSTMENT_IN"}

@transaction.atomic
def submit(tx,request):
    tx=models.CashTransaction.objects.select_for_update().get(pk=tx.pk)
    if tx.status not in {models.TransactionStatus.DRAFT,models.TransactionStatus.REJECTED}:raise ValidationError("Trạng thái không cho phép gửi duyệt.")
    raw=request.data.get("workflow_snapshot") or {}
    try:levels=max(1,min(int(raw.get("levels",1)),20))
    except (TypeError,ValueError):raise ValidationError({"workflow_snapshot":"Số cấp phê duyệt không hợp lệ."})
    tx.workflow_snapshot={"version":str(raw.get("version","DEFAULT"))[:80],"levels":levels,"allow_self_approval":bool(raw.get("allow_self_approval",False)),"separate_cashier":bool(raw.get("separate_cashier",True))}
    configured=configured_snapshot(tx,f"CASH.{tx.transaction_type}")
    if configured is not None:
        tx.workflow_snapshot={**configured,"separate_cashier":bool(raw.get("separate_cashier",True))}
        tx.approval_required=configured["approval_required"]
    before=tx.status;tx.status=models.TransactionStatus.PENDING_APPROVAL if tx.approval_required else models.TransactionStatus.APPROVED;tx.submitted_at=timezone.now();tx.approved_at=timezone.now() if tx.status==models.TransactionStatus.APPROVED else None;tx.save();models.ApprovalDecision.objects.create(company=tx.company,transaction=tx,decision="SUBMITTED",actor=actor(request));audit(request,tx,"SUBMIT",{"status":before},{"status":tx.status});return tx

@transaction.atomic
def decide(tx,request,approved):
    tx=models.CashTransaction.objects.select_for_update().get(pk=tx.pk)
    if tx.status!=models.TransactionStatus.PENDING_APPROVAL:raise ValidationError("Giao dịch không chờ phê duyệt.")
    comment=request.data.get("comment","").strip()
    if not approved and not comment:raise ValidationError({"comment":"Ý kiến từ chối là bắt buộc."})
    if tx.created_by_id==actor(request).id and not tx.workflow_snapshot.get("allow_self_approval",False):raise ValidationError("Không được tự phê duyệt.")
    level=tx.approval_decisions.filter(decision="APPROVED").count()+1;final=approved and level>=int(tx.workflow_snapshot.get("levels",1))
    progress=approval_progress(tx,actor(request),approved,tx.approval_decisions.all())
    if progress is not None:level,final=progress["level"],progress["final"]
    before=tx.status;tx.status=models.TransactionStatus.APPROVED if final else models.TransactionStatus.PENDING_APPROVAL if approved or progress and progress["return_to_previous"] else models.TransactionStatus.REJECTED;tx.approved_at=timezone.now() if final else None;tx.save(update_fields=("status","approved_at","updated_at"));models.ApprovalDecision.objects.create(company=tx.company,transaction=tx,level=level,decision="APPROVED" if approved else "REJECTED",actor=actor(request),comment=comment);audit(request,tx,"APPROVE" if approved else "REJECT",{"status":before},{"status":tx.status},comment);return tx

@transaction.atomic
def confirm(tx,request):
    tx=models.CashTransaction.objects.select_for_update().get(pk=tx.pk);fund=models.CashFund.objects.select_for_update().get(pk=tx.fund_id)
    if tx.status!=models.TransactionStatus.APPROVED or tx.balance_applied:raise ValidationError("Giao dịch chưa được duyệt hoặc đã cập nhật số dư.")
    if tx.workflow_snapshot.get("separate_cashier",True) and tx.created_by_id==actor(request).id:raise ValidationError("Người lập không được đồng thời xác nhận tiền theo cấu hình.")
    if not incoming(tx) and not fund.allow_negative and fund.balance<tx.amount:raise ValidationError("Số dư quỹ không đủ.")
    fund.balance=fund.balance+tx.amount if incoming(tx) else fund.balance-tx.amount;fund.save(update_fields=("balance","updated_at"));tx.balance_applied=True;tx.status=models.TransactionStatus.POSTED;tx.cashier=actor(request);tx.posted_at=timezone.now();tx.save(update_fields=("balance_applied","status","cashier","posted_at","updated_at"))
    allocations=request.data.get("allocations",[])
    if tx.party_id and (allocations or incoming(tx) and tx.source_module=="AR"):
        if incoming(tx) and tx.source_module=="AR":
            from accounts_receivable.models import Receipt
            from accounts_receivable.services import allocate
            receipt=Receipt.objects.create(company=tx.company,branch=tx.fund.branch,customer=tx.party,currency=tx.currency,receipt_date=tx.transaction_date,amount=tx.amount,exchange_rate=tx.exchange_rate,base_amount=tx.base_amount,external_type="CASH",external_reference=str(tx.id),created_by=actor(request));proxy=type("RequestProxy",(),{"user":request.user,"data":{"allocations":allocations},"META":request.META,"method":request.method,"path":request.path})()
            if allocations: allocate(receipt,proxy)
            tx.source_reference=str(receipt.id)
        elif not incoming(tx) and tx.source_module=="AP":
            from accounts_payable.models import Payment
            from accounts_payable.services import allocate
            payment=Payment.objects.create(company=tx.company,supplier=tx.party,currency=tx.currency,payment_date=tx.transaction_date,amount=tx.amount,external_type="CASH",external_reference=str(tx.id),created_by=actor(request));proxy=type("RequestProxy",(),{"user":request.user,"data":{"allocations":allocations},"META":request.META,"method":request.method,"path":request.path})()
            allocate(payment,proxy);tx.source_reference=str(payment.id)
        tx.save(update_fields=("source_reference",))
    audit(request,tx,"CONFIRM",after={"status":tx.status,"fund_balance":str(fund.balance)});return tx

@transaction.atomic
def reverse(tx,request):
    tx=models.CashTransaction.objects.select_for_update().get(pk=tx.pk);reason=request.data.get("reason","").strip()
    if tx.status!=models.TransactionStatus.POSTED or not reason:raise ValidationError("Chỉ giao dịch có hiệu lực và có lý do mới được đảo.")
    if tx.source_reference:raise ValidationError("Phải đảo phân bổ AP/AR liên quan trước.")
    fund=models.CashFund.objects.select_for_update().get(pk=tx.fund_id);new=fund.balance-tx.amount if incoming(tx) else fund.balance+tx.amount
    if new<0 and not fund.allow_negative:raise ValidationError("Không thể đảo vì sẽ làm quỹ âm.")
    fund.balance=new;fund.save(update_fields=("balance","updated_at"));tx.status=models.TransactionStatus.REVERSED;tx.save(update_fields=("status","updated_at"));audit(request,tx,"REVERSE",after={"status":tx.status,"fund_balance":str(new)},reason=reason);return tx

@transaction.atomic
def post_gl(tx,request):
    tx=models.CashTransaction.objects.select_for_update().get(pk=tx.pk)
    if tx.status!=models.TransactionStatus.POSTED or tx.gl_status=="POSTED":raise ValidationError("Giao dịch chưa có hiệu lực hoặc đã chuyển GL.")
    reference=request.data.get("gl_reference","").strip()
    if not reference:raise ValidationError({"gl_reference":"Mã bút toán GL là bắt buộc."})
    tx.gl_status="POSTED";tx.gl_reference=reference;tx.save(update_fields=("gl_status","gl_reference","updated_at"));audit(request,tx,"POST_GL",after={"gl_status":tx.gl_status,"gl_reference":reference});return tx

@transaction.atomic
def dispatch_transfer(obj,request):
    obj=models.CashTransfer.objects.select_for_update().get(pk=obj.pk)
    if obj.status!="DRAFT":raise ValidationError("Điều chuyển đã xử lý.")
    if obj.transfer_type in {"FUND_TO_FUND","CASH_TO_BANK"}:
        fund=models.CashFund.objects.select_for_update().get(pk=obj.source_fund_id)
        if not fund.allow_negative and fund.balance<obj.amount:raise ValidationError("Số dư quỹ nguồn không đủ.")
        fund.balance-=obj.amount;fund.save(update_fields=("balance","updated_at"))
    obj.status="IN_TRANSIT";obj.dispatched_by=actor(request);obj.save(update_fields=("status","dispatched_by","updated_at"));audit(request,obj,"DISPATCH",after={"status":obj.status});return obj

@transaction.atomic
def receive_transfer(obj,request):
    obj=models.CashTransfer.objects.select_for_update().get(pk=obj.pk)
    if obj.status!="IN_TRANSIT":raise ValidationError("Điều chuyển chưa ở trạng thái đang chuyển.")
    if obj.transfer_type in {"FUND_TO_FUND","BANK_TO_CASH"}:
        fund=models.CashFund.objects.select_for_update().get(pk=obj.destination_fund_id);fund.balance+=obj.amount;fund.save(update_fields=("balance","updated_at"))
    if obj.transfer_type!="FUND_TO_FUND" and not obj.bank_reference:obj.bank_reference=request.data.get("bank_reference","")
    obj.status="CONFIRMED";obj.received_by=actor(request);obj.save(update_fields=("status","received_by","bank_reference","updated_at"));audit(request,obj,"RECEIVE",after={"status":obj.status});return obj

@transaction.atomic
def advance_action(obj,request,action):
    obj=models.CashAdvance.objects.select_for_update().get(pk=obj.pk)
    if action=="submit" and obj.status in {"DRAFT","REJECTED"}:obj.status="PENDING_APPROVAL"
    elif action in {"approve","reject"} and obj.status=="PENDING_APPROVAL":obj.status="APPROVED" if action=="approve" else "REJECTED"
    else:raise ValidationError("Trạng thái tạm ứng không cho phép thao tác.")
    obj.save(update_fields=("status","updated_at"));audit(request,obj,action.upper(),after={"status":obj.status});return obj

@transaction.atomic
def disburse_advance(obj,request):
    obj=models.CashAdvance.objects.select_for_update().get(pk=obj.pk);fund=models.CashFund.objects.select_for_update().get(pk=obj.fund_id)
    if obj.status!="APPROVED" or fund.balance<obj.amount:raise ValidationError("Tạm ứng chưa duyệt hoặc quỹ không đủ số dư.")
    tx=models.CashTransaction.objects.create(company=obj.company,fund=fund,number=f"TU-{obj.number}",transaction_type="ADVANCE",business_type="EMPLOYEE_ADVANCE",transaction_date=timezone.localdate(),payer_payee=obj.recipient.full_name,currency=fund.currency,amount=obj.amount,base_amount=obj.amount,description=obj.purpose,status=models.TransactionStatus.POSTED,approval_required=False,balance_applied=True,created_by=actor(request),cashier=actor(request),posted_at=timezone.now());fund.balance-=obj.amount;fund.save(update_fields=("balance","updated_at"));obj.disbursement=tx;obj.status="ACTIVE";obj.save(update_fields=("disbursement","status","updated_at"));audit(request,obj,"DISBURSE",after={"transaction":str(tx.id)});return obj

@transaction.atomic
def settle_advance(obj,request):
    obj=models.CashAdvance.objects.select_for_update().get(pk=obj.pk)
    if obj.status not in {"ACTIVE","PARTIAL"}:raise ValidationError("Khoản tạm ứng không còn mở.")
    accepted=Decimal(str(request.data.get("accepted_expense",0)));returned=Decimal(str(request.data.get("returned_cash",0)));additional=Decimal(str(request.data.get("additional_cash",0)))
    if min(accepted,returned,additional)<0 or accepted+returned>obj.remaining_amount+additional:raise ValidationError("Số liệu quyết toán không hợp lệ.")
    settlement=models.AdvanceSettlement.objects.create(advance=obj,settlement_date=request.data.get("settlement_date",timezone.localdate()),accepted_expense=accepted,returned_cash=returned,additional_cash=additional,documents=request.data.get("documents",[]),note=request.data.get("note",""),created_by=actor(request));fund=models.CashFund.objects.select_for_update().get(pk=obj.fund_id)
    net_cash=returned-additional
    if net_cash<0 and fund.balance<-net_cash:raise ValidationError("Quỹ không đủ chi phần vượt tạm ứng.")
    fund.balance+=net_cash;fund.save(update_fields=("balance","updated_at"));obj.settled_amount+=accepted;obj.returned_amount+=returned;obj.additional_paid+=additional;obj.status="CLOSED" if obj.remaining_amount==0 else "PARTIAL";obj.save(update_fields=("settled_amount","returned_amount","additional_paid","status","updated_at"));audit(request,obj,"SETTLE",after={"settlement":str(settlement.id),"status":obj.status});return obj

@transaction.atomic
def confirm_count(obj,request):
    obj=models.CashCount.objects.select_for_update().get(pk=obj.pk);fund=models.CashFund.objects.select_for_update().get(pk=obj.fund_id)
    if obj.status!="DRAFT":raise ValidationError("Biên bản đã xác nhận.")
    obj.book_balance=fund.balance;obj.difference=obj.actual_balance-fund.balance
    if obj.difference and not obj.reason.strip():raise ValidationError({"reason":"Phải nêu nguyên nhân khi có chênh lệch."})
    obj.status="CONFIRMED";obj.save(update_fields=("book_balance","difference","status"));audit(request,obj,"COUNT",after={"difference":str(obj.difference)});return obj

@transaction.atomic
def adjust_count(obj,request):
    obj=models.CashCount.objects.select_for_update().get(pk=obj.pk)
    if obj.status!="CONFIRMED" or not obj.difference:raise ValidationError("Biên bản không có chênh lệch cần xử lý.")
    fund=models.CashFund.objects.select_for_update().get(pk=obj.fund_id);kind="ADJUSTMENT_IN" if obj.difference>0 else "ADJUSTMENT_OUT";amount=abs(obj.difference)
    if kind=="ADJUSTMENT_OUT" and not fund.allow_negative and fund.balance<amount:raise ValidationError("Xử lý thiếu quỹ sẽ làm số dư âm.")
    tx=models.CashTransaction.objects.create(company=obj.company,fund=fund,number=f"KK-{obj.number}",transaction_type=kind,business_type="CASH_COUNT_DIFFERENCE",transaction_date=timezone.localdate(),payer_payee="Xử lý kiểm kê",currency=fund.currency,amount=amount,base_amount=amount,description=obj.reason,status=models.TransactionStatus.POSTED,approval_required=False,balance_applied=True,created_by=actor(request),cashier=actor(request),posted_at=timezone.now());fund.balance=fund.balance+amount if kind=="ADJUSTMENT_IN" else fund.balance-amount;fund.save(update_fields=("balance","updated_at"));obj.adjustment=tx;obj.status="ADJUSTED";obj.save(update_fields=("adjustment","status"));audit(request,obj,"ADJUST",after={"transaction":str(tx.id)});return obj
