from decimal import Decimal
from django.db.models import Sum
from rest_framework import mixins,serializers as drf_serializers
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter,OrderingFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet,ReadOnlyModelViewSet
from . import models,serializers,services
from .permissions import BankPermission
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
        o=self.get_object();qs=o.transactions.filter(status="POSTED");income=qs.filter(transaction_type__in=["RECEIPT","INTEREST","OTHER_IN"]).aggregate(v=Sum("amount"))["v"] or Decimal("0");expense=qs.exclude(transaction_type__in=["RECEIPT","INTEREST","OTHER_IN"]).aggregate(v=Sum("amount"))["v"] or Decimal("0");return Response({"account":str(o.id),"currency":o.account.currency.code,"total_receipts":income,"total_payments":expense,"current_balance":o.balance,"transactions":serializers.TransactionSerializer(qs,many=True).data})
class TransactionViewSet(Base):
    queryset=models.BankTransaction.objects.select_related("company","account__account","currency","party","created_by");serializer_class=serializers.TransactionSerializer;iam_permissions=perms("BANK.TRANSACTION");action_permissions={"submit":"BANK.TRANSACTION.SUBMIT","approve":"BANK.TRANSACTION.APPROVE","reject":"BANK.TRANSACTION.REJECT","post":"BANK.TRANSACTION.POST","reverse":"BANK.TRANSACTION.REVERSE","post_gl":"BANK.TRANSACTION.POST","send_bank":"BANK.INTEGRATION.EXPORT"};search_fields=("number","counterparty_name","bank_reference","description");ordering_fields=("transaction_date","amount","created_at")
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
    queryset=models.BankTransfer.objects.select_related("company","source_account","destination_account","created_by");serializer_class=serializers.TransferSerializer;iam_permissions=perms("BANK.TRANSFER");action_permissions={"confirm":"BANK.TRANSFER.TRANSFER"};search_fields=("number","description")
    @action(detail=True,methods=("post",))
    def confirm(self,r,pk=None):return Response(self.get_serializer(services.confirm_transfer(self.get_object(),r)).data)
class StatementViewSet(Base):
    queryset=models.StatementImport.objects.select_related("company","account","created_by").prefetch_related("lines");serializer_class=serializers.StatementSerializer;iam_permissions=perms("BANK.STATEMENT");search_fields=("source_reference",);ordering_fields=("period_from","period_to","created_at")
class ReconciliationViewSet(ReadOnlyModelViewSet):
    permission_classes=(BankPermission,);serializer_class=serializers.ReconciliationSerializer;queryset=models.Reconciliation.objects.select_related("company","statement_line","transaction","created_by");iam_permissions={"GET":"BANK.RECONCILIATION.VIEW"};action_permissions={"match":"BANK.RECONCILIATION.RECONCILE"}
    def get_queryset(self):
        c=self.request.query_params.get("company_id");return self.queryset.filter(company_id=c) if c else self.queryset.none()
    @action(detail=False,methods=("post",))
    def match(self,r):
        try:line=models.StatementLine.objects.get(pk=r.data.get("statement_line"));tx=models.BankTransaction.objects.get(pk=r.data.get("transaction"))
        except (models.StatementLine.DoesNotExist,models.BankTransaction.DoesNotExist,ValueError):raise drf_serializers.ValidationError("Dòng sao kê hoặc giao dịch không hợp lệ.")
        return Response(self.get_serializer(services.reconcile(line,tx,r.data.get("matched_amount"),r.data.get("note",""),r)).data)
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
