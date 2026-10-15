from decimal import Decimal
from django.db.models import Sum
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter,OrderingFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet,ReadOnlyModelViewSet
from . import models,serializers,services
from .permissions import CashPermission
def perms(r):return {"GET":f"{r}.VIEW","POST":f"{r}.CREATE","PUT":f"{r}.EDIT","PATCH":f"{r}.EDIT"}
class BaseViewSet(mixins.CreateModelMixin,mixins.ListModelMixin,mixins.RetrieveModelMixin,mixins.UpdateModelMixin,GenericViewSet):
    permission_classes=(CashPermission,);filter_backends=(SearchFilter,OrderingFilter);ordering=("-created_at",)
    def get_queryset(self):
        company=self.request.query_params.get("company_id")
        if not company:return super().get_queryset().none()
        qs=super().get_queryset().filter(company_id=company)
        if status:=self.request.query_params.get("status"):qs=qs.filter(status=status)
        return qs
    def perform_create(self,s):obj=s.save(created_by=services.actor(self.request));services.audit(self.request,obj,"CREATE",after=s.data)
    def perform_update(self,s):before=self.get_serializer(s.instance).data;obj=s.save();services.audit(self.request,obj,"EDIT",before,s.data)
class FundViewSet(BaseViewSet):
    queryset=models.CashFund.objects.select_related("company","branch","currency","keeper","gl_account");serializer_class=serializers.FundSerializer;iam_permissions=perms("CASH.FUND");search_fields=("code","name");ordering_fields=("code","balance","created_at")
    def perform_create(self,s):
        obj=s.save();services.audit(self.request,obj,"CREATE",after=s.data)
    @action(detail=True,methods=("get",),permission_classes=(CashPermission,))
    def ledger(self,request,pk=None):
        fund=self.get_object();qs=fund.transactions.filter(status=models.TransactionStatus.POSTED)
        if start:=request.query_params.get("date_from"):qs=qs.filter(transaction_date__gte=start)
        if end:=request.query_params.get("date_to"):qs=qs.filter(transaction_date__lte=end)
        income=qs.filter(transaction_type__in=["RECEIPT","ADVANCE_RETURN","ADJUSTMENT_IN"]).aggregate(v=Sum("amount"))["v"] or Decimal("0");expense=qs.exclude(transaction_type__in=["RECEIPT","ADVANCE_RETURN","ADJUSTMENT_IN"]).aggregate(v=Sum("amount"))["v"] or Decimal("0")
        return Response({"fund":str(fund.id),"currency":fund.currency.code,"total_receipts":income,"total_payments":expense,"current_balance":fund.balance,"transactions":serializers.TransactionSerializer(qs,many=True).data})
class TransactionViewSet(BaseViewSet):
    queryset=models.CashTransaction.objects.select_related("company","fund","currency","party","created_by","cashier");serializer_class=serializers.TransactionSerializer;iam_permissions=perms("CASH.TRANSACTION");action_permissions={"submit":"CASH.TRANSACTION.SUBMIT","approve":"CASH.TRANSACTION.APPROVE","reject":"CASH.TRANSACTION.REJECT","confirm":"CASH.TRANSACTION.CONFIRM","reverse":"CASH.TRANSACTION.REVERSE","post_gl":"CASH.TRANSACTION.POST"};search_fields=("number","payer_payee","description","source_reference");ordering_fields=("transaction_date","amount","created_at")
    @action(detail=True,methods=("post",))
    def submit(self,r,pk=None):return Response(self.get_serializer(services.submit(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def approve(self,r,pk=None):return Response(self.get_serializer(services.decide(self.get_object(),r,True)).data)
    @action(detail=True,methods=("post",))
    def reject(self,r,pk=None):return Response(self.get_serializer(services.decide(self.get_object(),r,False)).data)
    @action(detail=True,methods=("post",))
    def confirm(self,r,pk=None):return Response(self.get_serializer(services.confirm(self.get_object(),r)).data)
    @action(detail=True,methods=("post",),url_path="post-gl")
    def post_gl(self,r,pk=None):return Response(self.get_serializer(services.post_gl(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def reverse(self,r,pk=None):return Response(self.get_serializer(services.reverse(self.get_object(),r)).data)
class TransferViewSet(BaseViewSet):
    queryset=models.CashTransfer.objects.select_related("company","source_fund","destination_fund","bank_account","created_by");serializer_class=serializers.TransferSerializer;iam_permissions=perms("CASH.TRANSFER");action_permissions={"dispatch_transfer":"CASH.TRANSFER.TRANSFER","receive":"CASH.TRANSFER.CONFIRM"};search_fields=("number","bank_reference","description")
    @action(detail=True,methods=("post",),url_path="dispatch")
    def dispatch_transfer(self,r,pk=None):return Response(self.get_serializer(services.dispatch_transfer(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def receive(self,r,pk=None):return Response(self.get_serializer(services.receive_transfer(self.get_object(),r)).data)
class AdvanceViewSet(BaseViewSet):
    queryset=models.CashAdvance.objects.select_related("company","fund","recipient","created_by","disbursement");serializer_class=serializers.AdvanceSerializer;iam_permissions=perms("CASH.ADVANCE");action_permissions={"submit":"CASH.ADVANCE.SUBMIT","approve":"CASH.ADVANCE.APPROVE","reject":"CASH.ADVANCE.REJECT","disburse":"CASH.ADVANCE.CONFIRM","settle":"CASH.ADVANCE.SETTLE"};search_fields=("number","recipient__full_name","purpose")
    @action(detail=True,methods=("post",))
    def submit(self,r,pk=None):return Response(self.get_serializer(services.advance_action(self.get_object(),r,"submit")).data)
    @action(detail=True,methods=("post",))
    def approve(self,r,pk=None):return Response(self.get_serializer(services.advance_action(self.get_object(),r,"approve")).data)
    @action(detail=True,methods=("post",))
    def reject(self,r,pk=None):return Response(self.get_serializer(services.advance_action(self.get_object(),r,"reject")).data)
    @action(detail=True,methods=("post",))
    def disburse(self,r,pk=None):return Response(self.get_serializer(services.disburse_advance(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def settle(self,r,pk=None):return Response(self.get_serializer(services.settle_advance(self.get_object(),r)).data)
class SettlementViewSet(ReadOnlyModelViewSet):
    permission_classes=(CashPermission,);serializer_class=serializers.SettlementSerializer;queryset=models.AdvanceSettlement.objects.select_related("advance__company","created_by");iam_permissions={"GET":"CASH.ADVANCE.VIEW"}
    def get_queryset(self):
        c=self.request.query_params.get("company_id");return self.queryset.filter(advance__company_id=c) if c else self.queryset.none()
class CountViewSet(BaseViewSet):
    queryset=models.CashCount.objects.select_related("company","fund","adjustment","created_by");serializer_class=serializers.CountSerializer;iam_permissions=perms("CASH.COUNT");action_permissions={"confirm":"CASH.COUNT.COUNT","adjust":"CASH.COUNT.ADJUST"};search_fields=("number","reason","conclusion")
    @action(detail=True,methods=("post",))
    def confirm(self,r,pk=None):return Response(self.get_serializer(services.confirm_count(self.get_object(),r)).data)
    @action(detail=True,methods=("post",))
    def adjust(self,r,pk=None):return Response(self.get_serializer(services.adjust_count(self.get_object(),r)).data)
class RevaluationViewSet(BaseViewSet):
    queryset=models.FxRevaluation.objects.select_related("company","fund","created_by");serializer_class=serializers.FxRevaluationSerializer;iam_permissions=perms("CASH.REVALUATION");search_fields=("gl_reference",);ordering_fields=("revaluation_date","difference","created_at")
class ApprovalViewSet(ReadOnlyModelViewSet):
    permission_classes=(CashPermission,);serializer_class=serializers.ApprovalSerializer;queryset=models.ApprovalDecision.objects.select_related("company","transaction","actor");iam_permissions={"GET":"CASH.APPROVAL.VIEW"}
    def get_queryset(self):
        c=self.request.query_params.get("company_id");return self.queryset.filter(company_id=c) if c else self.queryset.none()
