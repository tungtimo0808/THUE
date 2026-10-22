from decimal import Decimal
import json
from django.db import IntegrityError, transaction
from django.http import FileResponse
from organization.models import Branch
from django.db.models import Q,Sum,Prefetch
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.http import HttpResponse
from rest_framework.exceptions import PermissionDenied
from rest_framework import mixins,serializers as drf_serializers
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.filters import SearchFilter,OrderingFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet,ReadOnlyModelViewSet
from . import models,serializers,services,statement_import,reconciliation,period_reconciliation,unmatched,balance_report,deposit_ledger
from .permissions import BankPermission
from .payment_validation import PAYMENT_TYPES
def perms(x):return {"GET":f"{x}.VIEW","POST":f"{x}.CREATE","PUT":f"{x}.EDIT","PATCH":f"{x}.EDIT"}
class Base(mixins.CreateModelMixin,mixins.ListModelMixin,mixins.RetrieveModelMixin,mixins.UpdateModelMixin,GenericViewSet):
    permission_classes=(BankPermission,);filter_backends=(SearchFilter,OrderingFilter);ordering=("-created_at",)
    def get_queryset(self):
        c=self.request.query_params.get("company_id");qs=super().get_queryset().filter(company_id=c) if c else super().get_queryset().none()
        if s:=self.request.query_params.get("status"):qs=qs.filter(status=s)
        return qs
    def perform_create(self,s):o=s.save(created_by=services.actor(self.request));services.audit(self.request,o,"CREATE",after=s.data)
    def perform_update(self,s):b=self.get_serializer(s.instance).data;o=s.save();services.audit(self.request,o,"EDIT",b,s.data)
class ProfileViewSet(Base):
    queryset=models.AccountProfile.objects.select_related("company","account__bank","account__currency","account__gl_account");serializer_class=serializers.ProfileSerializer;iam_permissions=perms("BANK.ACCOUNT");search_fields=("account__account_number","account__account_name","account__bank__name");ordering_fields=("balance","created_at")
    def perform_create(self,s):o=s.save();services.audit(self.request,o,"CREATE",after=s.data)
    @action(detail=True,methods=("get",))
    def ledger(self,r,pk=None):
        o=self.get_object();qs=o.transactions.filter(status="POSTED");income=qs.filter(transaction_type__in=["RECEIPT","INTEREST","OTHER_IN"]).aggregate(v=Sum("amount"))["v"] or Decimal("0");expense=qs.exclude(transaction_type__in=["RECEIPT","INTEREST","OTHER_IN"]).aggregate(v=Sum("amount"))["v"] or Decimal("0")
        incoming=o.incoming_transfers.filter(status="CONFIRMED");outgoing=o.outgoing_transfers.filter(status="CONFIRMED")
        income+=incoming.aggregate(v=Sum("destination_amount"))["v"] or Decimal("0")
        expense+=outgoing.aggregate(v=Sum("source_amount"))["v"] or Decimal("0")
        transfers=[{"id":str(t.pk),"number":t.number,"transaction_date":t.posting_date,"transaction_type":"TRANSFER_IN" if t.destination_account_id==o.pk else "TRANSFER_OUT","amount":t.destination_amount if t.destination_account_id==o.pk else t.source_amount,"description":t.description,"currency_code":o.account.currency.code,"status":"POSTED","source_account_number":t.source_account.account.account_number,"destination_account_number":t.destination_account.account.account_number,"gl_reference":t.gl_reference} for t in list(incoming.select_related("source_account__account","destination_account__account"))+list(outgoing.select_related("source_account__account","destination_account__account"))]
        return Response({"account":str(o.id),"currency":o.account.currency.code,"total_receipts":income,"total_payments":expense,"current_balance":o.balance,"transactions":[*serializers.TransactionSerializer(qs,many=True).data,*transfers]})
class TransactionViewSet(Base):
    queryset=models.BankTransaction.objects.select_related("company","account__account","currency","party","created_by");serializer_class=serializers.TransactionSerializer;iam_permissions=perms("BANK.TRANSACTION");action_permissions={"submit":"BANK.TRANSACTION.SUBMIT","approve":"BANK.TRANSACTION.APPROVE","reject":"BANK.TRANSACTION.REJECT","post":"BANK.TRANSACTION.POST","reverse":"BANK.TRANSACTION.REVERSE","post_gl":"BANK.TRANSACTION.POST","send_bank":"BANK.INTEGRATION.EXPORT"};search_fields=("number","counterparty_name","bank_reference","description");ordering_fields=("transaction_date","amount","created_at")
    def get_queryset(self):
        qs=super().get_queryset()
        branch_id=self.request.query_params.get("branch_id")
        if branch_id:
            qs=qs.filter(Q(account__account__branch_id=branch_id)|Q(payment_details__branch=branch_id))
        return qs
    def get_object(self):
        obj=super().get_object()
        if obj.business_type in PAYMENT_TYPES and self.action in {"submit","approve","reject","post","reverse","post_gl","send_bank"}:
            branch_id=self.request.query_params.get("branch_id") or self.request.data.get("branch")
            expected=obj.payment_details.get("branch") or obj.account.account.branch_id
            if not branch_id or str(expected)!=str(branch_id):
                raise drf_serializers.ValidationError({"branch_id":"Chi nhánh không khớp chứng từ chi tiền gửi."})
        return obj
    def perform_create(self,s):
        if s.validated_data.get("business_type") in PAYMENT_TYPES:
            account=s.validated_data["account"].account
            branch_id=self.request.query_params.get("branch_id")
            if str(s.validated_data["company"].pk) != self.request.query_params.get("company_id"):
                raise drf_serializers.ValidationError({"company":"Doanh nghiệp không khớp phạm vi làm việc."})
            if not branch_id or account.branch_id and str(account.branch_id)!=branch_id:
                raise drf_serializers.ValidationError({"branch_id":"Chi nhánh không khớp tài khoản chi."})
            if not Branch.objects.filter(pk=branch_id,company=s.validated_data["company"],status="ACTIVE").exists():
                raise drf_serializers.ValidationError({"branch_id":"Chi nhánh không thuộc doanh nghiệp hoặc đã ngừng hoạt động."})
        try:
            with transaction.atomic():
                super().perform_create(s)
        except IntegrityError as exc:
            raise drf_serializers.ValidationError({"number":"Số chứng từ đã tồn tại."}) from exc
    def perform_update(self,s):
        if "company" in s.validated_data and s.validated_data["company"].pk!=s.instance.company_id:
            raise drf_serializers.ValidationError({"company":"Không được chuyển chứng từ sang doanh nghiệp khác."})
        if s.instance.business_type in PAYMENT_TYPES:
            account=s.validated_data.get("account",s.instance.account).account
            branch_id=self.request.query_params.get("branch_id")
            if not branch_id or account.branch_id and str(account.branch_id)!=branch_id:
                raise drf_serializers.ValidationError({"branch_id":"Chi nhánh không khớp tài khoản chi."})
            if not Branch.objects.filter(pk=branch_id,company=s.instance.company,status="ACTIVE").exists():
                raise drf_serializers.ValidationError({"branch_id":"Chi nhánh không thuộc doanh nghiệp hoặc đã ngừng hoạt động."})
        super().perform_update(s)
    @action(detail=True,methods=("post",))
    def submit(self,r,pk=None):return Response(self.get_serializer(services.submit(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def approve(self,r,pk=None):return Response(self.get_serializer(services.decide(self.get_object(),r,True)).data)
    @action(detail=True,methods=("post",))
    def reject(self,r,pk=None):return Response(self.get_serializer(services.decide(self.get_object(),r,False)).data)
    @action(detail=True,methods=("post",))
    def post(self,r,pk=None):return Response(self.get_serializer(services.post(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def reverse(self,r,pk=None):return Response(self.get_serializer(services.reverse(self.get_object(),r)).data)
    @action(detail=True,methods=("post",),url_path="post-gl")
    def post_gl(self,r,pk=None):return Response(self.get_serializer(services.post_gl(self.get_object(),r)).data)
    @action(detail=True,methods=("post",),url_path="send-bank")
    def send_bank(self,r,pk=None):return Response(self.get_serializer(services.send_integration(self.get_object(),r)).data)
class TransferViewSet(Base):
    queryset=models.BankTransfer.objects.select_related("company","source_account","destination_account","created_by");serializer_class=serializers.TransferSerializer;iam_permissions=perms("BANK.TRANSFER");action_permissions={"confirm":"BANK.TRANSFER.TRANSFER","reverse":"BANK.TRANSFER.REVERSE","cancel":"BANK.TRANSFER.EDIT"};search_fields=("number","description")
    def get_queryset(self):
        qs=super().get_queryset()
        return qs.select_for_update() if self.action in {"update","partial_update"} else qs
    @transaction.atomic
    def update(self,r,*args,**kwargs):return super().update(r,*args,**kwargs)
    @transaction.atomic
    def partial_update(self,r,*args,**kwargs):return super().partial_update(r,*args,**kwargs)
    def perform_create(self,s):
        if str(s.validated_data["company"].pk)!=self.request.query_params.get("company_id"):
            raise drf_serializers.ValidationError({"company":"Doanh nghiệp không khớp phạm vi làm việc."})
        try:
            with transaction.atomic():super().perform_create(s)
        except IntegrityError as exc:
            raise drf_serializers.ValidationError({"number":"Số chứng từ đã tồn tại."}) from exc
    def perform_update(self,s):
        if "company" in s.validated_data and s.validated_data["company"].pk!=s.instance.company_id:
            raise drf_serializers.ValidationError({"company":"Không được chuyển chứng từ sang doanh nghiệp khác."})
        super().perform_update(s)
    @action(detail=True,methods=("post",))
    def confirm(self,r,pk=None):return Response(self.get_serializer(services.confirm_transfer(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def cancel(self,r,pk=None):return Response(self.get_serializer(services.cancel_transfer(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def reverse(self,r,pk=None):return Response(self.get_serializer(services.reverse_transfer(self.get_object(),r)).data)
class StatementViewSet(Base):
    queryset=models.StatementImport.objects.select_related("company","account","created_by").prefetch_related(Prefetch("lines",queryset=models.StatementLine.objects.filter(deleted_at__isnull=True)));serializer_class=serializers.StatementSerializer;iam_permissions=perms("BANK.STATEMENT");action_permissions={"preview_import":"BANK.STATEMENT.IMPORT","import_file":"BANK.STATEMENT.IMPORT"};search_fields=("source_reference",);ordering_fields=("period_from","period_to","created_at")
    def get_queryset(self):
        qs=super().get_queryset()
        branch=self.request.query_params.get("branch_id")
        return qs.filter(account__account__branch_id=branch) if branch else qs
    def update(self,r,*args,**kwargs):
        raise drf_serializers.ValidationError("Dữ liệu sao kê gốc không được sửa trực tiếp.")
    @action(detail=False,methods=("post",),url_path="preview-import")
    def preview_import(self,r):
        company_id=r.query_params.get("company_id")
        if str(r.data.get("company"))!=company_id:
            raise drf_serializers.ValidationError({"company":"Doanh nghiệp không khớp phạm vi làm việc."})
        return Response(statement_import.preview(r.data,company_id,r.query_params.get("branch_id")))
    @action(detail=False,methods=("post",),url_path="import-file",parser_classes=(MultiPartParser,FormParser))
    def import_file(self,r):
        try:payload=json.loads(r.data.get("payload") or "")
        except (TypeError,ValueError):raise drf_serializers.ValidationError({"payload":"Dữ liệu import không hợp lệ."})
        company_id=r.query_params.get("company_id")
        if not isinstance(payload,dict) or str(payload.get("company"))!=company_id:
            raise drf_serializers.ValidationError({"company":"Doanh nghiệp không khớp phạm vi làm việc."})
        from organization.models import Company
        company=Company.objects.filter(pk=company_id).first()
        if not company:raise drf_serializers.ValidationError({"company":"Doanh nghiệp không tồn tại."})
        statement=statement_import.confirm(payload,r.FILES.get("source_file"),company,services.actor(r),r)
        return Response(self.get_serializer(statement).data,status=201)
    @action(detail=True,methods=("get",),url_path="source-file")
    def source_file(self,r,pk=None):
        statement=self.get_object()
        if not statement.source_file:
            raise drf_serializers.ValidationError({"source_file":"Lần import không có tệp nguồn."})
        return FileResponse(statement.source_file.open("rb"),as_attachment=True,
            filename=statement.raw_file.get("file_name") or "statement.xlsx")
class StatementLineViewSet(mixins.ListModelMixin,mixins.RetrieveModelMixin,GenericViewSet):
    permission_classes=(BankPermission,)
    queryset=models.StatementLine.objects.select_related("statement__company","statement__account__account","currency","updated_by").prefetch_related(Prefetch("reconciliations",queryset=models.Reconciliation.objects.filter(cancelled_at__isnull=True).select_related("transaction"),to_attr="active_reconciliations"))
    serializer_class=serializers.StatementLineManagementSerializer
    iam_permissions={"GET":"BANK.STATEMENT.VIEW","PATCH":"BANK.STATEMENT.EDIT"}
    action_permissions={"remove":"BANK.STATEMENT.EDIT","export":"BANK.STATEMENT.VIEW"}
    def get_queryset(self):
        p=self.request.query_params
        qs=self.queryset.filter(statement__company_id=p["company_id"],deleted_at__isnull=True) if p.get("company_id") else self.queryset.none()
        if p.get("branch_id"):qs=qs.filter(statement__account__account__branch_id=p["branch_id"])
        if p.get("account"):qs=qs.filter(statement__account_id=p["account"])
        if p.get("statement"):qs=qs.filter(statement_id=p["statement"])
        if p.get("period_from"):qs=qs.filter(statement__period_from__gte=p["period_from"])
        if p.get("period_to"):qs=qs.filter(statement__period_to__lte=p["period_to"])
        if p.get("date_from"):qs=qs.filter(transaction_date__gte=p["date_from"])
        if p.get("date_to"):qs=qs.filter(transaction_date__lte=p["date_to"])
        for key in ("direction","match_status","tracking_status"):
            if p.get(key):qs=qs.filter(**{key:p[key]})
        if p.get("currency"):qs=qs.filter(currency__code=p["currency"])
        if p.get("source"):qs=qs.filter(statement__source=p["source"])
        if p.get("search"):
            word=p["search"]
            qs=qs.filter(Q(external_id__icontains=word)|Q(reference__icontains=word)|Q(description__icontains=word)|Q(counterparty__icontains=word))
        return qs.order_by("-transaction_date","-id")
    def _check_period(self,line):
        if reconciliation.period_confirmed(line):
            raise drf_serializers.ValidationError("Kỳ đối chiếu đã xác nhận; hãy bỏ đối chiếu trước khi sửa.")
    @transaction.atomic
    def partial_update(self,r,pk=None):
        line=self.get_queryset().select_for_update(of=("self",)).filter(pk=pk).first()
        if line is None:raise drf_serializers.ValidationError("Không tìm thấy giao dịch sao kê.")
        self._check_period(line)
        allowed={"processing_note","tracking_status","review_reason","updated_at"}
        extra=set(r.data)-allowed
        if extra:raise drf_serializers.ValidationError({key:"Trường sao kê gốc không được sửa." for key in extra})
        submitted_version=parse_datetime(str(r.data.get("updated_at") or ""))
        if submitted_version!=line.updated_at:
            raise drf_serializers.ValidationError("Giao dịch đã thay đổi; vui lòng tải lại trước khi lưu.")
        status=r.data.get("tracking_status",line.tracking_status)
        if status not in ("NORMAL","NEEDS_REVIEW","WAITING"):raise drf_serializers.ValidationError({"tracking_status":"Trạng thái không hợp lệ."})
        reason=str(r.data.get("review_reason",line.review_reason)).strip()
        if status in ("NEEDS_REVIEW","WAITING") and not reason:raise drf_serializers.ValidationError({"review_reason":"Vui lòng nhập lý do cần kiểm tra hoặc chờ xử lý."})
        before=self.get_serializer(line).data
        line.processing_note=str(r.data.get("processing_note",line.processing_note)).strip()
        line.tracking_status=status;line.review_reason=reason if status in ("NEEDS_REVIEW","WAITING") else ""
        line.updated_by=services.actor(r);line.updated_at=timezone.now()
        line.save(update_fields=("processing_note","tracking_status","review_reason","updated_by","updated_at"))
        result=self.get_serializer(line).data
        services.audit(r,line.statement,"STATEMENT_LINE_EDIT",before=dict(before),after=dict(result))
        return Response(result)
    @action(detail=True,methods=("post",))
    @transaction.atomic
    def remove(self,r,pk=None):
        line=self.get_queryset().select_for_update(of=("self",)).filter(pk=pk).first()
        if line is None:raise drf_serializers.ValidationError("Không tìm thấy giao dịch sao kê.")
        self._check_period(line)
        reason=str(r.data.get("reason","")).strip()
        if parse_datetime(str(r.data.get("updated_at") or ""))!=line.updated_at:
            raise drf_serializers.ValidationError("Giao dịch đã thay đổi; vui lòng tải lại trước khi xóa.")
        if not reason:raise drf_serializers.ValidationError({"reason":"Vui lòng nhập lý do xóa."})
        if line.statement.source!="FILE":raise drf_serializers.ValidationError("Chỉ được xóa giao dịch nhập từ tệp.")
        if line.match_status!="UNMATCHED" or models.Reconciliation.objects.filter(statement_line=line,cancelled_at__isnull=True).exists():
            raise drf_serializers.ValidationError("Giao dịch đã ghép chứng từ; hãy bỏ ghép trước khi xóa.")
        before=self.get_serializer(line).data
        line.deleted_at=timezone.now();line.deleted_by=services.actor(r)
        line.save(update_fields=("deleted_at","deleted_by"))
        totals=line.statement.lines.filter(deleted_at__isnull=True).values("direction").annotate(total=Sum("amount"))
        amounts={row["direction"]:row["total"] for row in totals}
        line.statement.raw_file={**line.statement.raw_file,"active_total_receipts":str(amounts.get("CREDIT",0)),"active_total_payments":str(amounts.get("DEBIT",0)),"active_line_count":line.statement.lines.filter(deleted_at__isnull=True).count()}
        line.statement.save(update_fields=("raw_file",))
        services.audit(r,line.statement,"STATEMENT_LINE_DELETE",before=dict(before),after={"line_id":str(line.id),"deleted_at":line.deleted_at.isoformat()},reason=reason)
        return Response({"id":str(line.id),"deleted":True})
    @action(detail=False,methods=("get",))
    def export(self,r):
        from openpyxl import Workbook
        from io import BytesIO
        rows=list(self.filter_queryset(self.get_queryset()))
        book=Workbook();sheet=book.active;sheet.title="Giao dịch sao kê"
        sheet.append(["Ngày GD","Ngày giá trị","Tài khoản","Mã GD","Tham chiếu","Nội dung","Đối tác","Thu","Chi","Loại tiền","Trạng thái ghép","Theo dõi","Ghi chú"])
        def safe(value):
            return "'"+value if isinstance(value,str) and value.startswith(("=","+","-","@")) else value
        for line in rows:
            sheet.append([str(line.transaction_date),str(line.value_date or ""),*[safe(value) for value in (line.statement.account.account.account_number,line.external_id,line.reference,line.description,line.counterparty)],float(line.amount) if line.direction=="CREDIT" else None,float(line.amount) if line.direction=="DEBIT" else None,line.currency.code,line.match_status,line.tracking_status,safe(line.processing_note)])
        output=BytesIO();book.save(output)
        response=HttpResponse(output.getvalue(),content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"]='attachment; filename="giao-dich-sao-ke.xlsx"'
        return response
class ReconciliationViewSet(ReadOnlyModelViewSet):
    permission_classes=(BankPermission,);serializer_class=serializers.ReconciliationSerializer;queryset=models.Reconciliation.objects.select_related("company","statement_line","transaction","created_by");iam_permissions={"GET":"BANK.RECONCILIATION.VIEW"};action_permissions={"match":"BANK.RECONCILIATION.RECONCILE","match_batch":"BANK.RECONCILIATION.RECONCILE","unmatch":"BANK.RECONCILIATION.RECONCILE","candidates":"BANK.RECONCILIATION.VIEW"}
    def get_queryset(self):
        p=self.request.query_params
        qs=self.queryset.filter(company_id=p["company_id"]) if p.get("company_id") else self.queryset.none()
        if p.get("branch_id"):qs=qs.filter(statement_line__statement__account__account__branch_id=p["branch_id"])
        if p.get("statement_line"):qs=qs.filter(statement_line_id=p["statement_line"])
        if p.get("transaction"):qs=qs.filter(transaction_id=p["transaction"])
        if not p.get("include_cancelled"):qs=qs.filter(cancelled_at__isnull=True)
        return qs.order_by("-created_at")
    @action(detail=False,methods=("get",))
    def candidates(self,r):
        from uuid import UUID
        try:UUID(str(r.query_params.get("statement_line")))
        except (TypeError,ValueError):raise drf_serializers.ValidationError("Giao dịch sao kê không tồn tại.")
        line=models.StatementLine.objects.select_related("statement__account__account").filter(pk=r.query_params.get("statement_line"),statement__company_id=r.query_params.get("company_id"),deleted_at__isnull=True).first()
        if not line:raise drf_serializers.ValidationError("Giao dịch sao kê không tồn tại.")
        if r.query_params.get("branch_id") and str(line.statement.account.account.branch_id)!=r.query_params["branch_id"]:
            raise drf_serializers.ValidationError("Bạn không có quyền truy cập tài khoản ngân hàng này.")
        return Response({"statement_line":str(line.pk),"remaining_amount":str(line.amount-reconciliation.matched_for_line(line.pk)),"candidates":reconciliation.candidates(line,r.query_params.get("search",""))})
    @action(detail=False,methods=("post",))
    def match(self,r):
        result=reconciliation.match_many(r.data.get("statement_line"),[{"transaction":r.data.get("transaction"),"matched_amount":r.data.get("matched_amount")}],r,r.data.get("expected_line_remaining"))
        return Response(self.get_serializer(result["links"][0]).data)
    @action(detail=False,methods=("post",),url_path="match-batch")
    def match_batch(self,r):
        result=reconciliation.match_many(r.data.get("statement_line"),r.data.get("allocations"),r,r.data.get("expected_line_remaining"))
        return Response({"status":result["status"],"matched_amount":result["matched_amount"],"remaining_amount":result["remaining_amount"],"links":self.get_serializer(result["links"],many=True).data})
    @action(detail=True,methods=("post",))
    def unmatch(self,r,pk=None):return Response(reconciliation.unmatch(pk,r))
class ReconciliationPeriodViewSet(GenericViewSet):
    permission_classes=(BankPermission,)
    queryset=models.BankReconciliationPeriod.objects.all()
    iam_permissions={"GET":"BANK.RECONCILIATION.VIEW"}
    action_permissions={"confirm":"BANK.RECONCILIATION.RECONCILE"}
    @action(detail=False,methods=("get",))
    def preview(self,r):
        profile,start,end=period_reconciliation.context(r)
        return Response(period_reconciliation.snapshot(profile,start,end))
    @action(detail=False,methods=("post",))
    def confirm(self,r):
        period=period_reconciliation.confirm(r)
        return Response({"id":str(period.pk),"account":str(period.account_id),
            "date_from":period.period_from,"date_to":period.period_to,
            "opening_balance":period.opening_balance,"receipt_total":period.receipt_total,
            "payment_total":period.payment_total,"closing_balance":period.closing_balance,
            "bank_closing_balance":period.bank_closing_balance,
            "confirmed_at":period.confirmed_at,"confirmed_by":str(period.confirmed_by_id)},status=201)
class UnmatchedViewSet(GenericViewSet):
    permission_classes=(BankPermission,)
    queryset=models.StatementLine.objects.all()
    iam_permissions={"GET":"BANK.RECONCILIATION.VIEW"}
    action_permissions={"mark_waiting":"BANK.RECONCILIATION.RECONCILE"}
    @action(detail=False,methods=("get",))
    def items(self,r):return Response(unmatched.rows(r))
    @action(detail=False,methods=("post",),url_path="mark-waiting")
    def mark_waiting(self,r):return Response(unmatched.set_waiting(r))
class BalanceReportViewSet(GenericViewSet):
    permission_classes=(BankPermission,)
    queryset=models.BankBalanceReportPreset.objects.all()
    iam_permissions={"GET":"BANK.ACCOUNT.VIEW"}
    action_permissions={"save":"BANK.ACCOUNT.VIEW"}
    @action(detail=False,methods=("get",))
    def options(self,r):
        from general_ledger.models import Account
        from uuid import UUID
        try:UUID(str(r.query_params.get("company_id")))
        except (TypeError,ValueError):raise drf_serializers.ValidationError("Doanh nghiệp không hợp lệ.")
        rows=Account.objects.filter(company_id=r.query_params.get("company_id"),code__startswith="112",status="ACTIVE").order_by("code")
        return Response([{"code":row.code,"name":row.name} for row in rows])
    @action(detail=False,methods=("get",))
    def summary(self,r):return Response(balance_report.summary(r))
    @action(detail=False,methods=("get",))
    def export(self,r):
        content=balance_report.excel(balance_report.summary(r))
        response=HttpResponse(content,content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"]='attachment; filename="bang-ke-so-du-ngan-hang.xlsx"'
        return response
    @action(detail=False,methods=("get",))
    def presets(self,r):
        actor=services.actor(r)
        rows=models.BankBalanceReportPreset.objects.filter(company_id=r.query_params.get("company_id"),created_by=actor)[:50]
        return Response([{"id":str(row.pk),"name":row.name,"account_code":row.account_code,
            "date_from":row.date_from,"date_to":row.date_to,"period_preset":row.period_preset,
            "search":row.search,"created_at":row.created_at} for row in rows])
    @action(detail=False,methods=("post",))
    def save(self,r):
        company,code,start,end=balance_report.parameters(r)
        name=str(r.data.get("name") or f"Bảng kê số dư ngân hàng {start} – {end}").strip()[:150]
        if not name:raise drf_serializers.ValidationError({"name":"Vui lòng nhập tên báo cáo."})
        row=models.BankBalanceReportPreset.objects.create(company_id=company,created_by=services.actor(r),
            name=name,account_code=code,date_from=start,date_to=end,
            period_preset=str(r.data.get("period_preset") or "")[:50],
            search=str(r.data.get("search") or "")[:150])
        return Response({"id":str(row.pk),"name":row.name},status=201)
class DepositLedgerViewSet(GenericViewSet):
    permission_classes=(BankPermission,)
    queryset=models.BankDepositLedgerPreset.objects.all()
    iam_permissions={"GET":"BANK.ACCOUNT.VIEW"}
    action_permissions={"save":"BANK.ACCOUNT.VIEW","email":"BANK.ACCOUNT.VIEW"}
    @action(detail=False,methods=("get",))
    def options(self,r):
        from general_ledger.models import Account
        from uuid import UUID
        try:UUID(str(r.query_params.get("company_id")))
        except (TypeError,ValueError):raise drf_serializers.ValidationError("Doanh nghiệp không hợp lệ.")
        company=r.query_params.get("company_id")
        accounts=Account.objects.filter(company_id=company,code__startswith="112",status="ACTIVE").order_by("code")
        profiles=models.AccountProfile.objects.filter(company_id=company).select_related("account__bank","account__gl_account","account__currency")
        if branch_id:=r.query_params.get("branch_id"):
            profiles=profiles.filter(account__branch_id=branch_id)
            codes={row.account.gl_account.code for row in profiles if row.account.gl_account_id}
            accounts=[row for row in accounts if any(bank_code.startswith(row.code) for bank_code in codes)]
        return Response({"accounts":[{"code":row.code,"name":row.name} for row in accounts],
            "bank_accounts":[{"id":str(row.account_id),"number":row.account.account_number,"bank_name":row.account.bank.name,
                "gl_account_code":row.account.gl_account.code if row.account.gl_account else "","currency":row.account.currency.code}
                for row in profiles if row.account.gl_account_id]})
    @action(detail=False,methods=("get",))
    def summary(self,r):return Response(deposit_ledger.ledger(r))
    @action(detail=False,methods=("get",),url_path=r"voucher/(?P<entry_id>[^/.]+)")
    def voucher(self,r,entry_id=None):
        from general_ledger.models import JournalEntry,JournalLine
        from uuid import UUID
        try:UUID(str(entry_id))
        except (TypeError,ValueError):raise drf_serializers.ValidationError("Chứng từ không hợp lệ.")
        report=deposit_ledger.ledger(r)
        if not any(row["journal_entry_id"]==entry_id for group in report["groups"] for row in group["rows"]):
            raise PermissionDenied("Bạn không có quyền xem chứng từ này trong phạm vi báo cáo.")
        entry=JournalEntry.objects.filter(pk=entry_id,company_id=r.query_params.get("company_id"),status="POSTED").first()
        if not entry:raise PermissionDenied("Chứng từ không tồn tại hoặc không còn hiệu lực.")
        lines=JournalLine.objects.filter(entry=entry).select_related("account").order_by("line_no")
        return Response({"id":str(entry.pk),"number":entry.number,"posting_date":entry.posting_date,
            "document_date":entry.document_date,"description":entry.description,"source_entity_type":entry.source_entity_type,
            "source_entity_id":str(entry.source_entity_id) if entry.source_entity_id else "",
            "lines":[{"line_no":line.line_no,"account_code":line.account.code,"description":line.description,
                "debit":str(line.debit),"credit":str(line.credit)} for line in lines]})
    @action(detail=False,methods=("get",))
    def export(self,r):
        content=deposit_ledger.excel(deposit_ledger.ledger(r))
        response=HttpResponse(content,content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"]='attachment; filename="so-tien-gui-ngan-hang.xlsx"'
        return response
    @action(detail=False,methods=("post",))
    def email(self,r):
        from django.conf import settings
        from django.core.mail import EmailMessage
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError
        recipient=str(r.data.get("to") or "").strip()
        try:validate_email(recipient)
        except DjangoValidationError:raise drf_serializers.ValidationError({"to":"Vui lòng nhập email người nhận hợp lệ."})
        subject=str(r.data.get("subject") or "").strip()[:200]
        if not subject:raise drf_serializers.ValidationError({"subject":"Vui lòng nhập tiêu đề email."})
        if settings.EMAIL_BACKEND.endswith(("locmem.EmailBackend","console.EmailBackend","dummy.EmailBackend")):
            raise drf_serializers.ValidationError("Chưa cấu hình dịch vụ gửi email. Vui lòng liên hệ quản trị viên.")
        data=deposit_ledger.ledger(r)
        message=EmailMessage(subject,str(r.data.get("body") or "")[:5000],to=[recipient])
        message.attach("so-tien-gui-ngan-hang.xlsx",deposit_ledger.excel(data),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        try:message.send(fail_silently=False)
        except Exception:raise drf_serializers.ValidationError("Gửi email thất bại. Vui lòng thử lại.")
        return Response({"sent":True})
    @action(detail=False,methods=("get",))
    def presets(self,r):
        from uuid import UUID
        try:UUID(str(r.query_params.get("company_id")))
        except (TypeError,ValueError):raise drf_serializers.ValidationError("Doanh nghiệp không hợp lệ.")
        rows=self.queryset.filter(company_id=r.query_params.get("company_id"),created_by=services.actor(r))[:50]
        return Response([{"id":str(row.pk),"name":row.name,"parameters":row.parameters,"created_at":row.created_at} for row in rows])
    @action(detail=False,methods=("post",))
    def save(self,r):
        company,code,start,end=balance_report.parameters(r)
        deposit_ledger.ledger(r)
        name=str(r.data.get("name") or f"Sổ tiền gửi ngân hàng {start} – {end}").strip()[:150]
        if not name:raise drf_serializers.ValidationError({"name":"Vui lòng nhập tên báo cáo."})
        allowed=("bank_account_id","merge_same","merge_voucher","order_created","receipt_first","period_preset","search")
        parameters={"account_code":code,"date_from":str(start),"date_to":str(end)}
        parameters.update({key:r.data[key] for key in allowed if key in r.data})
        row=self.queryset.create(company_id=company,created_by=services.actor(r),name=name,parameters=parameters)
        return Response({"id":str(row.pk),"name":row.name},status=201)
class IntegrationViewSet(ReadOnlyModelViewSet):
    permission_classes=(BankPermission,);serializer_class=serializers.IntegrationSerializer;queryset=models.IntegrationRequest.objects.select_related("company","account","transaction","created_by");iam_permissions={"GET":"BANK.INTEGRATION.VIEW"};action_permissions={"result":"BANK.INTEGRATION.IMPORT"}
    def get_queryset(self):
        c=self.request.query_params.get("company_id");return self.queryset.filter(company_id=c) if c else self.queryset.none()
    @action(detail=True,methods=("post",))
    def result(self,r,pk=None):return Response(self.get_serializer(services.integration_result(self.get_object(),r)).data)
class FxViewSet(Base):
    queryset=models.FxRevaluation.objects.select_related("company","account","created_by");serializer_class=serializers.FxSerializer;iam_permissions=perms("BANK.REVALUATION");search_fields=("gl_reference",);ordering_fields=("revaluation_date","difference","created_at")
class ApprovalViewSet(ReadOnlyModelViewSet):
    permission_classes=(BankPermission,);serializer_class=serializers.ApprovalSerializer;queryset=models.ApprovalDecision.objects.select_related("company","transaction","actor");iam_permissions={"GET":"BANK.APPROVAL.VIEW"}
    def get_queryset(self):
        c=self.request.query_params.get("company_id");return self.queryset.filter(company_id=c) if c else self.queryset.none()


class BankRuleViewSet(GenericViewSet):
    """API quản lý Quy tắc tự động hạch toán ngân hàng điện tử lưu trữ trực tiếp trong PostgreSQL."""
    permission_classes = ()

    def _resolve_company(self, request):
        from organization.models import Company
        cid = request.query_params.get("company_id") or request.data.get("company_id") or request.data.get("company")
        if cid:
            comp = Company.objects.filter(pk=cid).first()
            if comp:
                return comp
        return Company.objects.first()

    def list(self, request):
        from common_services.models import CoreCompanySetting
        company = self._resolve_company(request)
        if not company:
            return Response({"rules": [], "results": []})
        setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
        config = dict(setting.configuration or {})
        rules = config.get("bank_electronic_rules")
        if rules is None:
            rules = [
                {
                    "id": "rule-abc-01",
                    "name": "Thu tiền khách hàng chuyển khoản thanh toán hóa đơn (TK 131)",
                    "documentKind": "Thu tiền gửi",
                    "reason": "Thu nợ khách hàng theo hóa đơn",
                    "debit": "1121",
                    "credit": "131",
                    "partnerCode": "THANHHA",
                    "partnerName": "Công ty TNHH Thanh Hà",
                    "automatic": True,
                    "active": True,
                    "conditions": [
                        {"id": "c1", "join": "Và", "field": "Tài khoản giao dịch", "operator": "Bằng", "value": "123456789"},
                        {"id": "c2", "join": "Và", "field": "Nội dung giao dịch", "operator": "Chứa", "value": "THANH TOAN HD"},
                    ],
                    "statistics": [],
                },
                {
                    "id": "rule-abc-02",
                    "name": "Hạch toán phí dịch vụ chuyển tiền ngân hàng Techcombank (TK 6425)",
                    "documentKind": "Chi tiền gửi",
                    "reason": "Chi phí dịch vụ ngân hàng",
                    "debit": "6425",
                    "credit": "1121",
                    "partnerCode": "TCB",
                    "partnerName": "Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)",
                    "automatic": True,
                    "active": True,
                    "conditions": [
                        {"id": "c3", "join": "Và", "field": "Tài khoản giao dịch", "operator": "Bằng", "value": "123456789"},
                        {"id": "c4", "join": "Và", "field": "Nội dung giao dịch", "operator": "Chứa", "value": "PHI DICH VU"},
                    ],
                    "statistics": [],
                },
            ]
        return Response({"rules": rules, "results": rules})

    def create(self, request):
        from common_services.models import CoreCompanySetting
        company = self._resolve_company(request)
        if not company:
            return Response({"detail": "Chưa có doanh nghiệp."}, status=400)
        with transaction.atomic():
            setting, _ = CoreCompanySetting.objects.select_for_update().get_or_create(company=company)
            config = dict(setting.configuration or {})
            existing = list(config.get("bank_electronic_rules") or [])
            if isinstance(request.data.get("rules"), list):
                existing = request.data["rules"]
            elif isinstance(request.data.get("rule"), dict):
                rule = request.data["rule"]
                existing = [r for r in existing if r.get("id") != rule.get("id")] + [rule]
            config["bank_electronic_rules"] = existing
            setting.configuration = config
            setting.save(update_fields=["configuration", "updated_at"])
        return Response({"rules": existing, "results": existing})
