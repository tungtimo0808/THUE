from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from audit_log.services import record_audit
from approval_workflows.submission import configured_snapshot
from approval_workflows.execution import approval_progress
from common_services.document_lock_services import assert_not_locked
from . import models
from .payment_validation import PAYMENT_TYPES, validate_payment
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
    if tx.business_type in PAYMENT_TYPES:
        return _post_payment_draft(tx,account,r)
    assert_not_locked(tx.company,"BC" if incoming(tx) else "BN",tx.transaction_date)
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


def _post_payment_draft(tx, account, request):
    """Post the bank balance, GL journal and supplier debt in one database transaction."""
    from datetime import date
    from types import SimpleNamespace
    from uuid import NAMESPACE_URL, uuid5

    from accounts_payable import models as ap_models
    from accounts_payable.services import allocate, update_payable_status
    from general_ledger.models import Account
    from general_ledger.money_journal import journalize
    from organization.models import Branch

    validate_payment({}, tx)
    if tx.currency_id != tx.company.accounting_currency_id:
        raise ValidationError("Ghi sổ ngoại tệ cần xử lý tỷ giá xuất tiền và chênh lệch tại UC-GL-05.")
    if not tx.account.account.branch_id and not tx.payment_details.get("branch"):
        raise ValidationError("Chứng từ thiếu chi nhánh hạch toán.")
    branch_id = tx.payment_details.get("branch") or tx.account.account.branch_id
    branch = Branch.objects.filter(pk=branch_id,company=tx.company,status="ACTIVE").first()
    if not branch:
        raise ValidationError("Chi nhánh hạch toán không hợp lệ.")
    posting_date = date.fromisoformat(tx.payment_details["posting_date"])
    assert_not_locked(tx.company,"BN",posting_date)
    available = account.balance + (account.overdraft_limit if account.allow_overdraft else Decimal("0"))
    if available < tx.amount:
        raise ValidationError("Số dư khả dụng không đủ để ghi sổ chứng từ chi tiền gửi.")
    lines = tx.payment_details["lines"]
    journal_lines = [{"account": line["debit_account"], "amount": line["amount"],
                      "description": line["description"],
                      "dimensions": {**(line.get("dimensions") or {}),
                                     **({"employee_id":tx.payment_details["employee"]} if tx.business_type=="EMPLOYEE_ADVANCE" else {})}}
                     for line in lines]
    entry = journalize(tx,request,module="BANK",money_account=account.account.gl_account,incoming=False,
                       branch=branch,counterpart_name=tx.counterparty_name,lines=journal_lines,
                       money_dimensions={"bank_account_id":str(account.account_id)},posting_date=posting_date)
    allocations = tx.payment_details.get("allocations") or []
    payment = None
    if tx.business_type in {"SUPPLIER_ADVANCE","SUPPLIER_INVOICE"}:
        if ap_models.Payment.objects.filter(external_type="BANK",external_reference=str(tx.id)).exists():
            raise ValidationError("Khoản chi đã có chứng từ thanh toán công nợ.")
        payment = ap_models.Payment.objects.create(
            company=tx.company,branch_id=branch_id,number=tx.number,payment_source="DIRECT",
            supplier=tx.party,currency=tx.currency,exchange_rate=tx.exchange_rate,payment_date=posting_date,
            amount=tx.amount,payment_method="BANK_TRANSFER",payment_content=tx.description,
            recipient_name=tx.counterparty_name,company_bank_account=account.account,
            beneficiary_name=tx.payment_details.get("beneficiary_name",""),
            beneficiary_account_number=tx.payment_details.get("beneficiary_account",""),
            beneficiary_bank_name=tx.payment_details.get("beneficiary_bank",""),
            bank_transaction_code=tx.bank_reference,external_type="BANK",external_reference=str(tx.id),
            journal_entry=entry,status="CONFIRMED",posted_at=timezone.now(),posted_by=actor(request),
            created_by=actor(request),
        )
        if allocations:
            proxy=SimpleNamespace(user=request.user,data={"allocations":[
                {"payable":item["payable"],"amount":item["amount"]} for item in allocations
            ]},META=request.META,headers=request.headers,method=request.method,path=request.path)
            allocate(payment,proxy)
    discounts=[(item,Decimal(str(item.get("discount") or "0"))) for item in allocations]
    discounts=[(item,value) for item,value in discounts if value>0]
    if discounts:
        discount_account=Account.objects.filter(company=tx.company,code__startswith="515",status="ACTIVE",is_postable=True).order_by("code").first()
        if not discount_account:
            raise ValidationError("Chưa có tài khoản doanh thu tài chính 515 chi tiết để hạch toán chiết khấu.")
        discount_total=sum((value for _,value in discounts),Decimal("0"))
        discount_tx=SimpleNamespace(
            id=uuid5(NAMESPACE_URL,f"BANK-DISCOUNT:{tx.id}"),company=tx.company,currency=tx.currency,
            transaction_date=tx.transaction_date,description=f"Chiết khấu thanh toán {tx.number}",
            amount=discount_total,exchange_rate=tx.exchange_rate,party=tx.party,number=f"{tx.number}-CK"[:80],
        )
        discount_lines=[]
        for item,value in discounts:
            payable=ap_models.Payable.objects.select_for_update().get(pk=item["payable"])
            if value>payable.balance:
                raise ValidationError("Chiết khấu vượt công nợ còn lại sau thanh toán.")
            payable_account_id=payable.document.payable_account_id if payable.document_id else lines[0]["debit_account"]
            discount_lines.append({"account":payable_account_id,"amount":str(value),"description":f"Chiết khấu {tx.number}"})
            ap_models.PayableAdjustment.objects.create(company=tx.company,payable=payable,
                adjustment_date=posting_date,amount=-value,reason=f"Chiết khấu thanh toán {tx.number}",
                posting_reference=f"{tx.number}-CK",status="POSTED",created_by=actor(request))
            payable.adjustment_amount-=value
            payable.balance-=value
            update_payable_status(payable)
        journalize(discount_tx,request,module="BANK",money_account=discount_account,incoming=False,
                   branch=branch,counterpart_name=tx.counterparty_name,
                   lines=discount_lines,posting_date=posting_date)
    account.balance-=tx.amount
    account.save(update_fields=("balance","updated_at"))
    tx.balance_applied=True
    tx.status="POSTED"
    tx.posted_at=timezone.now()
    tx.gl_status="POSTED"
    tx.gl_reference=entry.number
    tx.source_module="AP" if payment else ""
    tx.source_reference=str(payment.id) if payment else ""
    tx.save(update_fields=("balance_applied","status","posted_at","gl_status","gl_reference",
                           "source_module","source_reference","updated_at"))
    audit(request,tx,"POST",after={"balance":str(account.balance),"gl_reference":entry.number})
    return tx
@transaction.atomic
def reverse(tx,r):
    tx=models.BankTransaction.objects.select_for_update().get(pk=tx.pk);reason=r.data.get("reason","").strip()
    if tx.status!="POSTED" or not reason or tx.source_reference:raise ValidationError("Giao dịch không thể đảo; cần lý do và xử lý liên kết AR/AP trước.")
    if tx.reconciliations.filter(cancelled_at__isnull=True).exists():raise ValidationError("Chứng từ đã ghép sao kê; hãy hủy ghép trước khi đảo.")
    if models.BankReconciliationItem.objects.filter(transaction=tx).exists():raise ValidationError("Chứng từ thuộc kỳ đối chiếu đã xác nhận; không thể đảo.")
    account=models.AccountProfile.objects.select_for_update().get(pk=tx.account_id);new=account.balance-tx.amount if incoming(tx) else account.balance+tx.amount
    if new<0 and not account.allow_overdraft:raise ValidationError("Đảo giao dịch sẽ làm số dư âm.")
    account.balance=new;account.save(update_fields=("balance","updated_at"));tx.status="REVERSED";tx.save(update_fields=("status","updated_at"));audit(r,tx,"REVERSE",after={"balance":str(new)},reason=reason);return tx
@transaction.atomic
def post_gl(tx,r):
    tx=models.BankTransaction.objects.select_for_update().get(pk=tx.pk);ref=r.data.get("gl_reference","").strip()
    if tx.status=="POSTED" and tx.gl_status!="POSTED" and r.data.get("lines"):
        # The voucher's own accounting rows: the journal is generated and posted here.
        from general_ledger.money_journal import journalize
        bank=tx.account.account;ref=journalize(tx,r,module="BANK",money_account=bank.gl_account,incoming=tx.transaction_type in {"RECEIPT","INTEREST","OTHER_IN"},branch=bank.branch,counterpart_name=tx.counterparty_name,lines=r.data["lines"],money_dimensions={"bank_account_id":str(bank.id)}).number
    if tx.status!="POSTED" or tx.gl_status=="POSTED" or not ref:raise ValidationError("Giao dịch chưa hiệu lực, đã hạch toán hoặc thiếu mã GL.")
    tx.gl_status="POSTED";tx.gl_reference=ref;tx.save(update_fields=("gl_status","gl_reference","updated_at"));audit(r,tx,"POST_GL",after={"gl_reference":ref});return tx
@transaction.atomic
def confirm_transfer(o,r):
    o=models.BankTransfer.objects.select_for_update().get(pk=o.pk)
    if o.status!="DRAFT":raise ValidationError("Điều chuyển đã xử lý.")
    from .transfer_validation import validate_transfer
    from general_ledger.models import AccountingPeriod, JournalEntry, JournalLine
    from general_ledger.services import post as post_journal
    validate_transfer({},o)
    period=AccountingPeriod.objects.filter(company=o.company,start_date__lte=o.posting_date,end_date__gte=o.posting_date,status="OPEN").first()
    if not period:raise ValidationError({"posting_date":"Không có kỳ kế toán đang mở cho ngày hạch toán."})
    assert_not_locked(o.company,"BN",o.posting_date)
    s=models.AccountProfile.objects.select_for_update().get(pk=o.source_account_id);d=models.AccountProfile.objects.select_for_update().get(pk=o.destination_account_id)
    if s.balance+(s.overdraft_limit if s.allow_overdraft else 0)<o.source_amount:raise ValidationError("Số dư nguồn không đủ.")
    now=timezone.now();entry=JournalEntry.objects.create(company=o.company,branch=s.account.branch,period=period,
        number=f"GL-{o.number}",entry_type="SUBLEDGER",posting_date=o.posting_date,document_date=o.transfer_date,
        description=o.description,source_module="BANK",source_event_id=f"BANK_TRANSFER:{o.pk}",
        source_entity_type="BankTransfer",source_entity_id=o.pk,status="APPROVED",
        workflow_snapshot={"allow_creator_posting":True},total_debit=o.source_amount,total_credit=o.source_amount,
        created_by=actor(r),approved_by=actor(r),approved_at=now)
    for index,line in enumerate(o.details["lines"]):
        amount=Decimal(str(line["amount"]));common={"entry":entry,"currency":s.account.currency,
            "foreign_amount":amount,"exchange_rate":Decimal("1"),"description":line["description"]}
        JournalLine.objects.create(line_no=index*2+1,account=d.account.gl_account,debit=amount,
            dimensions={"bank_account_id":str(d.account_id)},**common)
        JournalLine.objects.create(line_no=index*2+2,account=s.account.gl_account,credit=amount,
            dimensions={"bank_account_id":str(s.account_id)},**common)
    post_journal(entry,r)
    s.balance-=o.source_amount;d.balance+=o.destination_amount;s.save(update_fields=("balance","updated_at"));d.save(update_fields=("balance","updated_at"))
    o.status="CONFIRMED";o.confirmed_by=actor(r);o.posted_at=now;o.gl_reference=entry.number
    o.save(update_fields=("status","confirmed_by","posted_at","gl_reference"))
    audit(r,o,"TRANSFER",after={"status":o.status,"source_balance":str(s.balance),"destination_balance":str(d.balance),"gl_reference":entry.number})
    return o

@transaction.atomic
def cancel_transfer(o,r):
    o=models.BankTransfer.objects.select_for_update().get(pk=o.pk)
    if o.status!="DRAFT":raise ValidationError("Chỉ chứng từ chưa ghi sổ mới được hủy.")
    before={"status":o.status,"version":o.version}
    o.status="CANCELLED";o.cancelled_at=timezone.now();o.version+=1
    o.save(update_fields=("status","cancelled_at","version","updated_at"))
    audit(r,o,"CANCEL",before,{"status":o.status,"version":o.version},r.data.get("reason", ""))
    return o

@transaction.atomic
def reverse_transfer(o,r):
    o=models.BankTransfer.objects.select_for_update().get(pk=o.pk)
    if o.status!="CONFIRMED":raise ValidationError("Chỉ chứng từ đã ghi sổ mới được bỏ ghi.")
    reason=str(r.data.get("reason") or "").strip()
    if not reason:raise ValidationError({"reason":"Vui lòng nhập lý do bỏ ghi."})
    from general_ledger.models import JournalEntry
    from general_ledger.services import reverse as reverse_journal
    entry=JournalEntry.objects.select_for_update().filter(source_event_id=f"BANK_TRANSFER:{o.pk}",status="POSTED").first()
    if not entry:raise ValidationError("Không tìm thấy bút toán đã ghi sổ của chứng từ chuyển tiền.")
    assert_not_locked(o.company,"BN",o.posting_date)
    s=models.AccountProfile.objects.select_for_update().get(pk=o.source_account_id)
    d=models.AccountProfile.objects.select_for_update().get(pk=o.destination_account_id)
    if d.balance+(d.overdraft_limit if d.allow_overdraft else 0)<o.destination_amount:
        raise ValidationError("Số dư tài khoản nhận không đủ để bỏ ghi; hãy kiểm tra các giao dịch phát sinh sau.")
    reversal=reverse_journal(entry,r)
    s.balance+=o.source_amount;d.balance-=o.destination_amount
    s.save(update_fields=("balance","updated_at"));d.save(update_fields=("balance","updated_at"))
    o.status="REVERSED";o.reversed_at=timezone.now();o.version+=1
    o.save(update_fields=("status","reversed_at","version","updated_at"))
    audit(r,o,"UNPOST",{"status":"CONFIRMED"},{"status":o.status,"reversal":reversal.number},reason)
    return o
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
