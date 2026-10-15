from django.db.models import Sum
from django.utils import timezone
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet,ReadOnlyModelViewSet
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from django.db import transaction
from django.http import HttpResponse
from openpyxl import Workbook
from io import BytesIO
from html import escape
from organization.models import Company
from . import customer_debt
from . import receipt_voucher
from . import allocation_voucher
from . import netting_voucher, adjustment_voucher, debt_reconciliation, due_tracking, payment_reminder
from . import models,serializers,services
from .permissions import AccountsReceivablePermission, DebtAdjustmentVoucherPermission, CustomerDebtReconciliationPermission, DueTrackingPermission, PaymentReminderPermission


def perms(resource):return {"GET":f"{resource}.VIEW","POST":f"{resource}.CREATE","PUT":f"{resource}.EDIT","PATCH":f"{resource}.EDIT"}


class BaseViewSet(mixins.CreateModelMixin,mixins.ListModelMixin,mixins.RetrieveModelMixin,mixins.UpdateModelMixin,GenericViewSet):
    permission_classes=(AccountsReceivablePermission,);filter_backends=(SearchFilter,OrderingFilter);ordering=("-created_at",)
    def get_queryset(self):
        company=self.request.query_params.get("company_id")
        if not company:return super().get_queryset().none()
        qs=super().get_queryset().filter(company_id=company)
        if status:=self.request.query_params.get("status"):qs=qs.filter(status=status)
        if customer:=self.request.query_params.get("customer_id"):
            if any(f.name=="customer" for f in qs.model._meta.fields):qs=qs.filter(customer_id=customer)
            elif qs.model in {models.CollectionPlan,models.ReceivableAdjustment}:qs=qs.filter(receivable__customer_id=customer)
        return qs
    def perform_create(self,serializer):
        obj=serializer.save(created_by=services.actor(self.request));services.audit(self.request,obj,"CREATE",after=serializer.data)
    def perform_update(self,serializer):
        before=self.get_serializer(serializer.instance).data;obj=serializer.save();services.audit(self.request,obj,"EDIT",before,serializer.data,getattr(obj,"reason",""))


class DocumentViewSet(BaseViewSet):
    queryset=models.ReceivableDocument.objects.select_related("company","branch","customer","currency","sales_order","sales_contract","invoice_request","created_by")
    serializer_class=serializers.DocumentSerializer;iam_permissions=perms("AR.DOCUMENT")
    action_permissions={"submit":"AR.DOCUMENT.SUBMIT","approve":"AR.DOCUMENT.APPROVE","reject":"AR.DOCUMENT.REJECT","post":"AR.DOCUMENT.POST","reverse":"AR.DOCUMENT.REVERSE"}
    search_fields=("number","customer__name","source_reference","description");ordering_fields=("document_date","posting_date","due_date","amount","created_at")
    @action(detail=True,methods=("post",))
    def submit(self,request,pk=None):return Response(self.get_serializer(services.submit(self.get_object(),request)).data)
    @action(detail=True,methods=("post",))
    def approve(self,request,pk=None):return Response(self.get_serializer(services.decide(self.get_object(),request,True)).data)
    @action(detail=True,methods=("post",))
    def reject(self,request,pk=None):return Response(self.get_serializer(services.decide(self.get_object(),request,False)).data)
    @action(detail=True,methods=("post",))
    def post(self,request,pk=None):return Response(self.get_serializer(services.post_document(self.get_object(),request)).data)
    @action(detail=True,methods=("post",))
    def reverse(self,request,pk=None):return Response(self.get_serializer(services.reverse_document(self.get_object(),request)).data)


class ReceivableViewSet(ReadOnlyModelViewSet):
    permission_classes = (AccountsReceivablePermission,)
    serializer_class = serializers.ReceivableSerializer
    queryset = models.Receivable.objects.select_related(
        "company", "branch", "customer", "currency", "document", "account", "payment_term"
    ).prefetch_related("schedules", "schedule_histories")
    iam_permissions = {"GET": "AR.RECEIVABLE.VIEW", "POST": "AR.RECEIVABLE.CREATE"}
    action_permissions = {
        "summary": "AR.RECEIVABLE.VIEW",
        "customer_debts": "AR.RECEIVABLE.VIEW",
        "customer_debt_detail": "AR.RECEIVABLE.VIEW",
        "customer_debts_export": "AR.RECEIVABLE.EXPORT",
        "customer_debts_print": "AR.RECEIVABLE.PRINT",
        "due_tracking": "AR.RECEIVABLE.VIEW",
        "due_tracking_detail": "AR.RECEIVABLE.VIEW",
        "due_tracking_export": "AR.RECEIVABLE.EXPORT",
        "due_tracking_prepare_collection": "AR.RECEIVABLE.VIEW",
        "unrecognized_sources": "AR.RECEIVABLE.VIEW",
        "by_source": "AR.RECEIVABLE.VIEW",
        "recognize": "AR.RECEIVABLE.CREATE",
        "bulk_recognize": "AR.RECEIVABLE.CREATE",
        "update_schedule": "AR.RECEIVABLE.EDIT",
        "reverse": "AR.RECEIVABLE.CANCEL",
    }
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("code", "customer__name", "customer__code", "source_document_number", "document__number", "description")
    ordering_fields = ("code", "due_date", "balance", "original_amount", "created_at", "document_date", "posting_date")

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        if not company:
            return self.queryset.none()
        qs = self.queryset.filter(company_id=company)
        for key in ("customer_id", "branch_id", "currency_id", "status", "code", "source_document_type", "source_document_number"):
            if value := self.request.query_params.get(key):
                qs = qs.filter(**{key: value})
        if self.request.query_params.get("overdue") == "true":
            qs = qs.filter(due_date__lt=timezone.localdate(), balance__gt=0).exclude(status__in=[models.ReceivableStatus.PAID, models.ReceivableStatus.REVERSED])
        return qs

    @action(detail=False, methods=("get",))
    def summary(self, request):
        values = self.get_queryset().aggregate(
            original=Sum("original_amount"),
            collected=Sum("collected_amount"),
            netted=Sum("netted_amount"),
            adjustments=Sum("adjustment_amount"),
            balance=Sum("balance"),
        )
        return Response({key: value or 0 for key, value in values.items()})

    def _customer_debt_report(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Doanh nghiệp là bắt buộc."})
        company = Company.objects.filter(pk=company_id).first()
        if company is None:
            raise NotFound("Không tìm thấy doanh nghiệp.")
        filters = customer_debt.parse_filters(request.query_params)
        with transaction.atomic():
            rows = customer_debt.report(company, request.user, filters)
        return filters, rows

    @action(detail=False, methods=("get",), url_path="customer-debts")
    def customer_debts(self, request):
        filters, rows = self._customer_debt_report(request)
        return Response({"from_date": filters["from_date"], "to_date": filters["to_date"], "rows": rows})

    @action(detail=False, methods=("get",), url_path="customer-debts/detail")
    def customer_debt_detail(self, request):
        customer_id = request.query_params.get("customer_id")
        if not customer_id:
            raise ValidationError({"customer_id": "Khách hàng là bắt buộc."})
        filters, rows = self._customer_debt_report(request)
        matches = [row for row in rows if row["customer_id"] == customer_id]
        if not matches:
            raise NotFound("Không tìm thấy công nợ khách hàng trong phạm vi được cấp.")
        return Response({"from_date": filters["from_date"], "to_date": filters["to_date"], "rows": matches})

    @action(detail=False, methods=("get",), url_path="customer-debts/export")
    def customer_debts_export(self, request):
        filters, rows = self._customer_debt_report(request)
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Cong no khach hang"
        sheet.append(["Từ ngày", str(filters["from_date"]), "Đến ngày", str(filters["to_date"])])
        sheet.append(["Mã KH", "Tên khách hàng", "Chi nhánh", "Tài khoản", "Tiền tệ",
                      "Đầu kỳ", "Tăng", "Giảm trừ", "Thanh toán", "Bù trừ",
                      "Cuối kỳ", "Quá hạn", "Ứng trước"])
        for row in rows:
            sheet.append([
                row["customer_code"], row["customer_name"], row["branch_id"],
                row["account_id"], row["currency_code"],
                *[row[key] for key in (
                    "opening", "increase", "reduction", "payment", "netting",
                    "closing", "overdue", "advance"
                )],
            ])
        output = BytesIO()
        workbook.save(output)
        response = HttpResponse(output.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = 'attachment; filename="customer-debts.xlsx"'
        return response

    @action(detail=False, methods=("get",), url_path="customer-debts/print")
    def customer_debts_print(self, request):
        filters, rows = self._customer_debt_report(request)
        cells = []
        for row in rows:
            values = [
                row["customer_code"], row["customer_name"], row["branch_id"] or "",
                row["account_id"] or "", row["currency_code"],
                *[str(row[key]) for key in (
                    "opening", "increase", "reduction", "payment", "netting",
                    "closing", "overdue", "advance"
                )],
            ]
            cells.append("<tr>" + "".join(f"<td>{escape(value)}</td>" for value in values) + "</tr>")
        headings = ["Mã KH", "Tên khách hàng", "Chi nhánh", "Tài khoản", "Tiền tệ",
                    "Đầu kỳ", "Tăng", "Giảm trừ", "Thanh toán", "Bù trừ",
                    "Cuối kỳ", "Quá hạn", "Ứng trước"]
        html = (
            "<!doctype html><html lang='vi'><meta charset='utf-8'>"
            "<title>Công nợ khách hàng</title>"
            f"<h1>Công nợ khách hàng: {filters['from_date']} – {filters['to_date']}</h1>"
            "<table border='1'><thead><tr>"
            + "".join(f"<th>{escape(label)}</th>" for label in headings)
            + "</tr></thead><tbody>" + "".join(cells) + "</tbody></table></html>"
        )
        return HttpResponse(html, content_type="text/html; charset=utf-8")

    @action(detail=False, methods=("get",), url_path="due-tracking")
    def due_tracking(self, request):
        company_id = request.query_params.get("company_id") or request.data.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Doanh nghiệp là bắt buộc."})
        company = Company.objects.get(pk=company_id)
        filters = due_tracking.validate_due_tracking_filters(request.query_params)
        return Response(due_tracking.get_due_tracking_report(company, request.user, filters))

    @action(detail=False, methods=("get",), url_path="due-tracking/item-detail")
    def due_tracking_detail(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Doanh nghiệp là bắt buộc."})
        company = Company.objects.get(pk=company_id)
        rec_id = request.query_params.get("receivable_id")
        if not rec_id:
            raise ValidationError({"receivable_id": "Mã khoản phải thu là bắt buộc."})
        sch_id = request.query_params.get("schedule_id")
        as_of_raw = request.query_params.get("as_of_date")
        as_of_date = due_tracking.parse_date_param(as_of_raw, default=timezone.localdate())
        return Response(due_tracking.get_due_item_detail(rec_id, sch_id, as_of_date, company))

    @action(detail=False, methods=("get",), url_path="due-tracking/export")
    def due_tracking_export(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Doanh nghiệp là bắt buộc."})
        company = Company.objects.get(pk=company_id)
        filters = due_tracking.validate_due_tracking_filters(request.query_params)
        excel_content = due_tracking.export_due_tracking_excel(company, request.user, filters)
        filename = f"bao-cao-cong-no-den-han-{filters['as_of_date']}.xlsx"
        response = HttpResponse(
            excel_content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=("post",), url_path="due-tracking/prepare-collection")
    def due_tracking_prepare_collection(self, request):
        company_id = request.query_params.get("company_id") or request.data.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Doanh nghiệp là bắt buộc."})
        company = Company.objects.get(pk=company_id)
        selected_items = request.data.get("selected_items")
        return Response(due_tracking.prepare_collection_payload(selected_items, company, request.user))

    @action(detail=False, methods=("get",), url_path="unrecognized-sources")
    def unrecognized_sources(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            return Response([])
        from organization.models import Company
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            return Response([])
        branch_id = request.query_params.get("branch_id")
        customer_id = request.query_params.get("customer_id")
        search = request.query_params.get("search")
        sources = services.get_unrecognized_sources(
            company=company,
            branch=branch_id,
            customer=customer_id,
            search=search,
        )
        return Response(sources)

    @action(detail=False, methods=("get",), url_path="by-source")
    def by_source(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            return Response({"detail": "company_id là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)
        source_type = request.query_params.get("source_document_type") or request.query_params.get("source_type") or "AR_DOCUMENT"
        source_id = request.query_params.get("source_document_id") or request.query_params.get("source_id")
        source_line_id = request.query_params.get("source_line_id", "")
        if not source_id:
            return Response({"detail": "source_document_id là bắt buộc."}, status=status.HTTP_400_BAD_REQUEST)

        from django.db.models import Q
        qs = models.Receivable.objects.filter(company_id=company_id).exclude(status=models.ReceivableStatus.REVERSED)
        if source_type == "AR_DOCUMENT":
            qs = qs.filter(Q(document_id=source_id) | Q(source_document_id=source_id))
        else:
            qs = qs.filter(source_document_type=source_type, source_document_id=source_id)
        if source_line_id:
            qs = qs.filter(source_line_id=source_line_id)

        rec = qs.first()
        if rec:
            return Response({"exists": True, "receivable": serializers.ReceivableSerializer(rec).data})

        from organization.models import Company
        company = Company.objects.filter(pk=company_id).first()
        sources = services.get_unrecognized_sources(company=company) if company else []
        matching = [
            s for s in sources
            if s["source_document_type"] == source_type
            and s["source_document_id"] == str(source_id)
            and (not source_line_id or s["source_line_id"] == str(source_line_id))
        ]
        source_data = matching[0] if matching else None
        return Response({"exists": False, "source_data": source_data, "can_recognize": source_data is not None})

    @action(detail=False, methods=("post",))
    def recognize(self, request):
        serializer = serializers.RecognizeReceivableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from organization.models import Company
        company = Company.objects.get(pk=serializer.validated_data["company"])
        user = services.actor(request)
        rec = services.recognize_receivable(company, serializer.validated_data, user=user, request=request)
        return Response(serializers.ReceivableSerializer(rec).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("post",), url_path="bulk-recognize")
    def bulk_recognize(self, request):
        serializer = serializers.BulkRecognizeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from organization.models import Company
        company = Company.objects.get(pk=serializer.validated_data["company"])
        user = services.actor(request)
        results = services.bulk_recognize_receivables(company, serializer.validated_data["items"], user=user, request=request)
        return Response({"results": results})

    @action(detail=True, methods=("post",), url_path="update-schedule")
    def update_schedule(self, request, pk=None):
        obj = self.get_object()
        serializer = serializers.UpdateScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.actor(request)
        updated_rec = services.update_payment_schedule(
            obj,
            serializer.validated_data["schedules"],
            serializer.validated_data["reason"],
            user=user,
            request=request,
        )
        return Response(serializers.ReceivableSerializer(updated_rec).data)

    @action(detail=True, methods=("post",))
    def reverse(self, request, pk=None):
        obj = self.get_object()
        serializer = serializers.ReverseReceivableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.actor(request)
        rev = services.reverse_receivable(
            obj,
            serializer.validated_data["reason"],
            user=user,
            request=request,
        )
        return Response(serializers.ReceivableSerializer(rev).data)



class CreditPolicyViewSet(BaseViewSet):
    queryset=models.CreditPolicy.objects.select_related("company","customer","branch","currency","created_by");serializer_class=serializers.CreditPolicySerializer;iam_permissions=perms("AR.CREDIT_POLICY");search_fields=("customer__name","reason");ordering_fields=("effective_from","credit_limit","created_at")
    action_permissions={"check":"AR.CREDIT_POLICY.VIEW"}
    @action(detail=False,methods=("post",))
    def check(self,request):
        from master_data.models import Currency,Party
        from organization.models import Branch,Company
        try:
            company=Company.objects.get(pk=request.data.get("company"));customer=Party.objects.get(pk=request.data.get("customer"));branch=Branch.objects.filter(pk=request.data.get("branch")).first();currency=Currency.objects.filter(pk=request.data.get("currency")).first();amount=request.data.get("amount",0)
            return Response(services.evaluate_credit(company,customer,amount,branch,currency))
        except (Company.DoesNotExist,Party.DoesNotExist,ValueError,TypeError):
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Dữ liệu kiểm tra hạn mức không hợp lệ.")


class CollectionPlanViewSet(BaseViewSet):
    queryset=models.CollectionPlan.objects.select_related("company","receivable__customer","responsible","created_by");serializer_class=serializers.CollectionPlanSerializer;iam_permissions=perms("AR.COLLECTION_PLAN");action_permissions={"remind":"AR.COLLECTION_PLAN.REMIND"};search_fields=("receivable__customer__name","note");ordering_fields=("expected_date","expected_amount","created_at")
    @action(detail=True,methods=("post",))
    def remind(self,request,pk=None):return Response(self.get_serializer(services.contact_plan(self.get_object(),request)).data)


class ReceiptViewSet(BaseViewSet):
    queryset=models.Receipt.objects.select_related("company","customer","currency","created_by").prefetch_related("allocations__receivable");serializer_class=serializers.ReceiptSerializer;iam_permissions=perms("AR.RECEIPT");action_permissions={"allocate":"AR.RECEIPT.ALLOCATE"};search_fields=("external_reference","customer__name");ordering_fields=("receipt_date","amount","created_at")
    @action(detail=True,methods=("post",))
    def allocate(self,request,pk=None):return Response(self.get_serializer(services.allocate(self.get_object(),request)).data)


class CustomerReceiptVoucherViewSet(BaseViewSet):
    queryset=models.CustomerReceiptVoucher.objects.select_related(
        "company","branch","customer","currency","cash_fund","bank_account",
        "debit_account","credit_account","receipt","journal_entry",
    ).prefetch_related("lines")
    serializer_class=serializers.CustomerReceiptVoucherSerializer
    iam_permissions=perms("AR.RECEIPT_VOUCHER")
    action_permissions={
        "submit":"AR.RECEIPT_VOUCHER.SUBMIT",
        "approve":"AR.RECEIPT_VOUCHER.APPROVE",
        "reject":"AR.RECEIPT_VOUCHER.APPROVE",
        "request_revision":"AR.RECEIPT_VOUCHER.APPROVE",
        "recall":"AR.RECEIPT_VOUCHER.EDIT",
        "cancel":"AR.RECEIPT_VOUCHER.CANCEL",
        "post":"AR.RECEIPT_VOUCHER.POST",
        "suggest_allocations":"AR.RECEIPT_VOUCHER.VIEW",
    }
    search_fields=("number","customer__name","customer__code","bank_reference")
    ordering_fields=("document_date","posting_date","amount","created_at")

    def get_queryset(self):
        qs=super().get_queryset()
        if self.request.user.is_superuser:
            return qs
        company_id=self.request.query_params.get("company_id")
        company=Company.objects.filter(pk=company_id).first() if company_id else None
        if not company:
            return qs.none()
        from iam.permissions import has_effective_permission
        code=self.action_permissions.get(getattr(self,"action",None)) or self.iam_permissions.get(self.request.method)
        branches=[
            branch_id for branch_id in qs.values_list("branch_id",flat=True).distinct()
            if has_effective_permission(self.request.user.iam_account,company,code,branch_id=branch_id)
        ]
        return qs.filter(branch_id__in=branches)

    def perform_create(self,serializer):
        serializer.save()

    def perform_update(self,serializer):
        serializer.save()

    @action(detail=False,methods=("get",),url_path="suggest-allocations")
    def suggest_allocations(self,request):
        from decimal import Decimal
        from master_data.models import Party,Currency
        from general_ledger.models import Account
        branch_id=request.query_params.get("branch_id")
        company=Company.objects.filter(pk=request.query_params.get("company_id")).first()
        customer=Party.objects.filter(pk=request.query_params.get("customer_id"),company=company).first()
        currency=Currency.objects.filter(pk=request.query_params.get("currency_id")).first()
        account=Account.objects.filter(pk=request.query_params.get("account_id"),company=company).first()
        if not all((company,branch_id,customer,currency,account)):
            raise ValidationError("Thiếu điều kiện đề xuất phân bổ.")
        from iam.permissions import has_effective_permission
        if not request.user.is_superuser and not has_effective_permission(
            request.user.iam_account,company,"AR.RECEIPT_VOUCHER.VIEW",branch_id=branch_id
        ):
            raise PermissionDenied("Chi nhánh ngoài phạm vi được cấp.")
        try:
            amount=Decimal(request.query_params.get("amount","0"))
        except Exception:
            raise ValidationError({"amount":"Số tiền không hợp lệ."})
        if amount<=0:
            raise ValidationError({"amount":"Số tiền phải lớn hơn 0."})
        return Response(receipt_voucher.suggest_allocations(company,branch_id,customer,currency,account,amount))

    @action(detail=True,methods=("post",))
    def submit(self,request,pk=None):
        return Response(self.get_serializer(receipt_voucher.transition(self.get_object(),"submit",request)).data)

    @action(detail=True,methods=("post",))
    def approve(self,request,pk=None):
        return Response(self.get_serializer(receipt_voucher.transition(self.get_object(),"approve",request)).data)

    @action(detail=True,methods=("post",))
    def reject(self,request,pk=None):
        return Response(self.get_serializer(receipt_voucher.transition(self.get_object(),"reject",request)).data)

    @action(detail=True,methods=("post",),url_path="request-revision")
    def request_revision(self,request,pk=None):
        return Response(self.get_serializer(receipt_voucher.transition(self.get_object(),"request_revision",request)).data)

    @action(detail=True,methods=("post",))
    def recall(self,request,pk=None):
        return Response(self.get_serializer(receipt_voucher.transition(self.get_object(),"recall",request)).data)

    @action(detail=True,methods=("post",))
    def cancel(self,request,pk=None):
        return Response(self.get_serializer(receipt_voucher.transition(self.get_object(),"cancel",request)).data)

    @action(detail=True,methods=("post",))
    def post(self,request,pk=None):
        return Response(self.get_serializer(receipt_voucher.post(self.get_object(),request)).data)


class ReceiptAllocationVoucherViewSet(BaseViewSet):
    queryset=models.ReceiptAllocationVoucher.objects.select_related(
        "company","branch","customer","receipt","currency","credit_account",
        "journal_entry",
    ).prefetch_related("lines")
    serializer_class=serializers.ReceiptAllocationVoucherSerializer
    iam_permissions=perms("AR.ALLOCATION_VOUCHER")
    action_permissions={
        "post":"AR.ALLOCATION_VOUCHER.POST",
        "unpost":"AR.ALLOCATION_VOUCHER.UNPOST",
        "cancel":"AR.ALLOCATION_VOUCHER.CANCEL",
        "suggest_allocations":"AR.ALLOCATION_VOUCHER.VIEW",
    }
    search_fields=("number","customer__name","customer__code","receipt__external_reference")
    ordering_fields=("allocation_date","created_at")

    def get_queryset(self):
        qs=super().get_queryset()
        if self.request.user.is_superuser:
            return qs
        company_id=self.request.query_params.get("company_id")
        company=Company.objects.filter(pk=company_id).first() if company_id else None
        if not company:
            return qs.none()
        from iam.permissions import has_effective_permission
        code=self.action_permissions.get(getattr(self,"action",None)) or self.iam_permissions.get(self.request.method)
        branches=[
            branch_id for branch_id in qs.values_list("branch_id",flat=True).distinct()
            if has_effective_permission(self.request.user.iam_account,company,code,branch_id=branch_id)
        ]
        return qs.filter(branch_id__in=branches)

    def perform_create(self,serializer):
        serializer.save()

    def perform_update(self,serializer):
        serializer.save()

    @action(detail=False,methods=("get",),url_path="suggest-allocations")
    def suggest_allocations(self,request):
        receipt_id=request.query_params.get("receipt_id")
        branch_id=request.query_params.get("branch_id")
        receipt=models.Receipt.objects.select_related("company","customer","currency","credit_account").filter(
            pk=receipt_id,company_id=request.query_params.get("company_id"),
        ).first()
        if not receipt or not branch_id or (receipt.branch_id and str(receipt.branch_id)!=branch_id):
            raise ValidationError("Chứng từ thu hoặc chi nhánh không hợp lệ.")
        from iam.permissions import has_effective_permission
        if not request.user.is_superuser and not has_effective_permission(
            request.user.iam_account,receipt.company,"AR.ALLOCATION_VOUCHER.VIEW",branch_id=branch_id
        ):
            raise PermissionDenied("Chi nhánh ngoài phạm vi được cấp.")
        if not allocation_voucher.receipt_source_is_posted(receipt):
            raise ValidationError("Chứng từ thu chưa ghi sổ.")
        account=allocation_voucher.receipt_credit_account(receipt)
        if not account:
            candidates=models.Receivable.objects.filter(
                company=receipt.company,customer=receipt.customer,currency=receipt.currency,
                branch_id=branch_id,balance__gt=0,
            ).values_list("account_id",flat=True).distinct()
            ids=[pk for pk in candidates if pk]
            if len(ids)==1:
                account=models.Receivable.objects.filter(account_id=ids[0]).first().account
        if not account:
            raise ValidationError("Không xác định được tài khoản công nợ của khoản thu.")
        return Response(allocation_voucher.suggest(receipt,branch_id,account))

    @action(detail=True,methods=("post",))
    def post(self,request,pk=None):
        return Response(self.get_serializer(allocation_voucher.post(self.get_object(),request)).data)

    @action(detail=True,methods=("post",))
    def unpost(self,request,pk=None):
        return Response(self.get_serializer(allocation_voucher.unpost(self.get_object(),request)).data)

    @action(detail=True,methods=("post",))
    def cancel(self,request,pk=None):
        return Response(self.get_serializer(allocation_voucher.cancel(self.get_object(),request)).data)


class NettingViewSet(BaseViewSet):
    queryset=models.Netting.objects.select_related("company","receivable__customer","payable","created_by");serializer_class=serializers.NettingSerializer;iam_permissions=perms("AR.NETTING");action_permissions={"post":"AR.NETTING.POST","reverse":"AR.NETTING.REVERSE"};search_fields=("number","receivable__customer__name","reason","posting_reference")
    @action(detail=True,methods=("post",))
    def post(self,request,pk=None):return Response(self.get_serializer(services.post_netting(self.get_object(),request)).data)
    @action(detail=True,methods=("post",))
    def reverse(self,request,pk=None):return Response(self.get_serializer(services.reverse_netting(self.get_object(),request)).data)


class ConfirmationViewSet(BaseViewSet):
    queryset=models.BalanceConfirmation.objects.select_related("company","customer","created_by");serializer_class=serializers.BalanceConfirmationSerializer;iam_permissions=perms("AR.CONFIRMATION");action_permissions={"send":"AR.CONFIRMATION.SEND","respond":"AR.CONFIRMATION.RESPOND"};search_fields=("number","customer__name","recipient");ordering_fields=("period_from","period_to","closing_balance","created_at")
    @action(detail=True,methods=("post",))
    def send(self,request,pk=None):return Response(self.get_serializer(services.send_confirmation(self.get_object(),request)).data)
    @action(detail=True,methods=("post",))
    def respond(self,request,pk=None):return Response(self.get_serializer(services.respond_confirmation(self.get_object(),request)).data)


class AdjustmentViewSet(BaseViewSet):
    queryset=models.ReceivableAdjustment.objects.select_related("company","receivable__customer","created_by");serializer_class=serializers.AdjustmentSerializer;iam_permissions=perms("AR.ADJUSTMENT");action_permissions={"post":"AR.ADJUSTMENT.POST","reverse":"AR.ADJUSTMENT.REVERSE"};search_fields=("reason","posting_reference");ordering_fields=("adjustment_date","amount","created_at")
    @action(detail=True,methods=("post",))
    def post(self,request,pk=None):return Response(self.get_serializer(services.post_adjustment(self.get_object(),request)).data)
    @action(detail=True,methods=("post",))
    def reverse(self,request,pk=None):return Response(self.get_serializer(services.reverse_adjustment(self.get_object(),request)).data)


class ApprovalViewSet(ReadOnlyModelViewSet):
    permission_classes=(AccountsReceivablePermission,);serializer_class=serializers.ApprovalSerializer;queryset=models.ApprovalDecision.objects.select_related("company","document","actor");iam_permissions={"GET":"AR.APPROVAL.VIEW"}
    def get_queryset(self):
        company=self.request.query_params.get("company_id");qs=self.queryset.filter(company_id=company) if company else self.queryset.none()
        if document:=self.request.query_params.get("document_id"):qs=qs.filter(document_id=document)
        return qs


class DebtNettingVoucherViewSet(BaseViewSet):
    queryset=models.DebtNettingVoucher.objects.select_related(
        "company","branch","customer","supplier","currency",
        "receivable_account","payable_account","journal_entry",
        "created_by","approved_by","posted_by",
    ).prefetch_related("lines__receivable","lines__receivable_schedule","lines__payable")
    serializer_class=serializers.DebtNettingVoucherSerializer
    iam_permissions=perms("AR.NETTING_VOUCHER")
    action_permissions={
        "submit":"AR.NETTING_VOUCHER.SUBMIT",
        "recall":"AR.NETTING_VOUCHER.EDIT",
        "approve":"AR.NETTING_VOUCHER.APPROVE",
        "reject":"AR.NETTING_VOUCHER.APPROVE",
        "request_revision":"AR.NETTING_VOUCHER.APPROVE",
        "cancel":"AR.NETTING_VOUCHER.CANCEL",
        "post":"AR.NETTING_VOUCHER.POST",
        "unpost":"AR.NETTING_VOUCHER.UNPOST",
        "eligible_debts":"AR.NETTING_VOUCHER.VIEW",
    }
    search_fields=("number","customer__name","customer__code","supplier__name","description")
    ordering_fields=("document_date","posting_date","total_amount","created_at")

    def get_queryset(self):
        qs=super().get_queryset()
        if self.request.user.is_superuser:
            return qs
        company_id=self.request.query_params.get("company_id")
        company=Company.objects.filter(pk=company_id).first() if company_id else None
        if not company:
            return qs.none()
        from iam.permissions import has_effective_permission
        code=self.action_permissions.get(getattr(self,"action",None)) or self.iam_permissions.get(self.request.method)
        branches=[
            branch_id for branch_id in qs.values_list("branch_id",flat=True).distinct()
            if has_effective_permission(self.request.user.iam_account,company,code,branch_id=branch_id)
        ]
        return qs.filter(branch_id__in=branches)

    @action(detail=False,methods=("get",),url_path="eligible-debts")
    def eligible_debts(self,request):
        company_id=request.query_params.get("company_id")
        customer_id=request.query_params.get("customer_id")
        currency_id=request.query_params.get("currency_id")
        receivable_account_id=request.query_params.get("receivable_account_id")
        payable_account_id=request.query_params.get("payable_account_id")
        branch_id=request.query_params.get("branch_id")
        company=Company.objects.filter(pk=company_id).first()
        if not company:
            raise ValidationError("Doanh nghiệp không hợp lệ.")
        return Response(netting_voucher.eligible_debts(
            company=company,
            branch_id=branch_id,
            customer_id=customer_id,
            currency_id=currency_id,
            receivable_account_id=receivable_account_id,
            payable_account_id=payable_account_id,
        ))

    @action(detail=True,methods=("post",))
    def submit(self,request,pk=None):
        return Response(self.get_serializer(netting_voucher.transition(self.get_object(),"submit",request)).data)

    @action(detail=True,methods=("post",))
    def recall(self,request,pk=None):
        return Response(self.get_serializer(netting_voucher.transition(self.get_object(),"recall",request)).data)

    @action(detail=True,methods=("post",))
    def approve(self,request,pk=None):
        return Response(self.get_serializer(netting_voucher.transition(self.get_object(),"approve",request)).data)

    @action(detail=True,methods=("post",))
    def reject(self,request,pk=None):
        return Response(self.get_serializer(netting_voucher.transition(self.get_object(),"reject",request)).data)

    @action(detail=True,methods=("post",),url_path="request-revision")
    def request_revision(self,request,pk=None):
        return Response(self.get_serializer(netting_voucher.transition(self.get_object(),"request_revision",request)).data)

    @action(detail=True,methods=("post",))
    def cancel(self,request,pk=None):
        return Response(self.get_serializer(netting_voucher.transition(self.get_object(),"cancel",request)).data)

    @action(detail=True,methods=("post",))
    def post(self,request,pk=None):
        return Response(self.get_serializer(netting_voucher.post_voucher(self.get_object(),request)).data)

    @action(detail=True,methods=("post",))
    def unpost(self,request,pk=None):
        return Response(self.get_serializer(netting_voucher.unpost_voucher(self.get_object(),request)).data)


class DebtAdjustmentVoucherViewSet(BaseViewSet):
    queryset=models.DebtAdjustmentVoucher.objects.select_related(
        "company","branch","customer","currency","receivable_account","journal_entry",
        "created_by","approved_by","posted_by",
    ).prefetch_related(
        "lines__receivable","lines__receivable_schedule","lines__offset_account",
        "lines__created_receivable","lines__legacy_adjustment","decisions"
    )
    serializer_class=serializers.DebtAdjustmentVoucherSerializer
    iam_permissions=perms("AR.ADJUSTMENT_VOUCHER")
    search_fields=("number","customer__name","customer__code","adjustment_reason","description")
    ordering_fields=("document_date","posting_date","total_amount","created_at")

    iam_permissions={
        "GET":"AR.ADJUSTMENT_VOUCHER.VIEW",
        "POST":"AR.ADJUSTMENT_VOUCHER.CREATE",
        "PUT":"AR.ADJUSTMENT_VOUCHER.EDIT",
        "PATCH":"AR.ADJUSTMENT_VOUCHER.EDIT",
        "DELETE":"AR.ADJUSTMENT_VOUCHER.EDIT",
    }
    action_permissions={
        "submit":"AR.ADJUSTMENT_VOUCHER.SUBMIT",
        "recall":"AR.ADJUSTMENT_VOUCHER.SUBMIT",
        "approve":"AR.ADJUSTMENT_VOUCHER.APPROVE",
        "reject":"AR.ADJUSTMENT_VOUCHER.APPROVE",
        "request_revision":"AR.ADJUSTMENT_VOUCHER.APPROVE",
        "cancel":"AR.ADJUSTMENT_VOUCHER.CANCEL",
        "post":"AR.ADJUSTMENT_VOUCHER.POST",
        "unpost":"AR.ADJUSTMENT_VOUCHER.UNPOST",
        "eligible_receivables":"AR.ADJUSTMENT_VOUCHER.VIEW",
    }

    def perform_create(self,serializer):
        obj=serializer.save(created_by=services.actor(self.request))
        services.audit(self.request,obj,"CREATE",after=serializer.data)

    def perform_update(self,serializer):
        obj=serializer.save()
        services.audit(self.request,obj,"UPDATE",after=serializer.data)

    def perform_destroy(self,instance):
        if instance.status != models.DebtAdjustmentVoucher.Status.DRAFT:
            raise ValidationError("Chỉ cho phép xóa chứng từ ở trạng thái Nháp.")
        services.audit(self.request,instance,"DELETE")
        instance.delete()

    def get_queryset(self):
        qs=super().get_queryset()
        if self.request.user.is_superuser:
            return qs
        company_id=self.request.query_params.get("company_id")
        company=Company.objects.filter(pk=company_id).first() if company_id else None
        if not company:
            return qs.none()
        from iam.permissions import has_effective_permission
        code=self.action_permissions.get(getattr(self,"action",None)) or self.iam_permissions.get(self.request.method)
        branches=[
            branch_id for branch_id in qs.values_list("branch_id",flat=True).distinct()
            if has_effective_permission(self.request.user.iam_account,company,code,branch_id=branch_id)
        ]
        return qs.filter(branch_id__in=branches)

    @action(detail=False,methods=("get",),url_path="eligible-receivables")
    def eligible_receivables(self,request):
        company_id=request.query_params.get("company_id")
        customer_id=request.query_params.get("customer_id")
        currency_id=request.query_params.get("currency_id")
        receivable_account_id=request.query_params.get("receivable_account_id")
        branch_id=request.query_params.get("branch_id")
        company=Company.objects.filter(pk=company_id).first()
        if not company:
            raise ValidationError("Doanh nghiệp không hợp lệ.")
        return Response(adjustment_voucher.eligible_receivables(
            company=company,
            branch_id=branch_id,
            customer_id=customer_id,
            currency_id=currency_id,
            receivable_account_id=receivable_account_id,
        ))

    @action(detail=True,methods=("post",))
    def submit(self,request,pk=None):
        user_account=request.user.iam_account if hasattr(request.user,"iam_account") else None
        return Response(self.get_serializer(adjustment_voucher.transition(self.get_object(),"submit",user_account)).data)

    @action(detail=True,methods=("post",))
    def recall(self,request,pk=None):
        user_account=request.user.iam_account if hasattr(request.user,"iam_account") else None
        reason=request.data.get("reason","")
        return Response(self.get_serializer(adjustment_voucher.transition(self.get_object(),"recall",user_account,reason)).data)

    @action(detail=True,methods=("post",))
    def approve(self,request,pk=None):
        user_account=request.user.iam_account if hasattr(request.user,"iam_account") else None
        reason=request.data.get("reason","")
        return Response(self.get_serializer(adjustment_voucher.transition(self.get_object(),"approve",user_account,reason)).data)

    @action(detail=True,methods=("post",))
    def reject(self,request,pk=None):
        user_account=request.user.iam_account if hasattr(request.user,"iam_account") else None
        reason=request.data.get("reason","")
        return Response(self.get_serializer(adjustment_voucher.transition(self.get_object(),"reject",user_account,reason)).data)

    @action(detail=True,methods=("post",),url_path="request-revision")
    def request_revision(self,request,pk=None):
        user_account=request.user.iam_account if hasattr(request.user,"iam_account") else None
        reason=request.data.get("reason","")
        return Response(self.get_serializer(adjustment_voucher.transition(self.get_object(),"request_revision",user_account,reason)).data)

    @action(detail=True,methods=("post",))
    def cancel(self,request,pk=None):
        user_account=request.user.iam_account if hasattr(request.user,"iam_account") else None
        reason=request.data.get("reason","")
        return Response(self.get_serializer(adjustment_voucher.transition(self.get_object(),"cancel",user_account,reason)).data)

    @action(detail=True,methods=("post",))
    def post(self,request,pk=None):
        return Response(self.get_serializer(adjustment_voucher.post_voucher(self.get_object(),request)).data)

    @action(detail=True,methods=("post",))
    def unpost(self,request,pk=None):
        return Response(self.get_serializer(adjustment_voucher.unpost_voucher(self.get_object(),request)).data)


class CustomerDebtReconciliationViewSet(BaseViewSet):
    queryset = models.CustomerDebtReconciliation.objects.select_related(
        "company", "branch", "customer", "currency", "receivable_account",
        "sent_by", "responded_by", "cancelled_by", "created_by", "previous_reconciliation"
    ).prefetch_related("lines__receivable")
    serializer_class = serializers.CustomerDebtReconciliationSerializer
    permission_classes = (CustomerDebtReconciliationPermission,)
    iam_permissions = perms("AR.RECONCILIATION")
    search_fields = ("number", "customer__name", "customer__code", "contact_person", "note")
    ordering_fields = ("statement_date", "created_at", "closing_balance")

    action_permissions = {
        "GET": "AR.RECONCILIATION.VIEW",
        "POST": "AR.RECONCILIATION.CREATE",
        "PUT": "AR.RECONCILIATION.EDIT",
        "PATCH": "AR.RECONCILIATION.EDIT",
        "DELETE": "AR.RECONCILIATION.CANCEL",
        "extract_data": "AR.RECONCILIATION.VIEW",
        "refresh_data": "AR.RECONCILIATION.EDIT",
        "record_sent": "AR.RECONCILIATION.SEND",
        "record_response": "AR.RECONCILIATION.RESPOND",
        "re_reconcile": "AR.RECONCILIATION.CREATE",
        "cancel": "AR.RECONCILIATION.CANCEL",
        "export_pdf": "AR.RECONCILIATION.EXPORT",
    }

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != models.CustomerDebtReconciliation.Status.DRAFT:
            raise ValidationError("Chỉ có thể xóa biên bản ở trạng thái Nháp.")
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=("get",), url_path="extract-data")
    def extract_data(self, request):
        company_id = request.query_params.get("company_id")
        customer_id = request.query_params.get("customer_id")
        currency_id = request.query_params.get("currency_id")
        receivable_account_id = request.query_params.get("receivable_account_id")
        from_date = request.query_params.get("from_date")
        to_date = request.query_params.get("to_date")
        branch_id = request.query_params.get("branch_id")

        if not all([company_id, customer_id, currency_id, receivable_account_id, from_date, to_date]):
            raise ValidationError("Vui lòng cung cấp đầy đủ thông tin: company_id, customer_id, currency_id, receivable_account_id, from_date, to_date.")

        from datetime import date
        try:
            parsed_from = date.fromisoformat(from_date)
            parsed_to = date.fromisoformat(to_date)
        except ValueError:
            raise ValidationError("Định dạng ngày không hợp lệ (YYYY-MM-DD).")

        from master_data.models import Party, Currency
        from general_ledger.models import Account
        from organization.models import Company, Branch

        company = Company.objects.get(pk=company_id)
        customer = Party.objects.get(pk=customer_id)
        currency = Currency.objects.get(pk=currency_id)
        account = Account.objects.get(pk=receivable_account_id)
        branch = Branch.objects.get(pk=branch_id) if branch_id else None

        data = debt_reconciliation.extract_reconciliation_data(
            company=company,
            customer=customer,
            from_date=parsed_from,
            to_date=parsed_to,
            currency=currency,
            receivable_account=account,
            branch=branch,
        )
        return Response({
            "opening_balance": str(data["opening_balance"]),
            "period_increase": str(data["period_increase"]),
            "period_decrease": str(data["period_decrease"]),
            "closing_balance": str(data["closing_balance"]),
            "unallocated_receipts": str(data["unallocated_receipts"]),
            "data_extracted_at": data["data_extracted_at"].isoformat(),
            "lines": [
                {
                    "line_no": l["line_no"],
                    "posting_date": l["posting_date"].isoformat(),
                    "document_date": l["document_date"].isoformat() if l.get("document_date") else None,
                    "document_number": l["document_number"],
                    "document_type": l["document_type"],
                    "description": l["description"],
                    "increase_amount": str(l["increase_amount"]),
                    "decrease_amount": str(l["decrease_amount"]),
                    "receivable_id": str(l["receivable"].id) if l.get("receivable") else None,
                    "running_balance": str(l["running_balance"]),
                }
                for l in data["lines"]
            ],
        })

    @action(detail=True, methods=("post",), url_path="refresh-data")
    def refresh_data(self, request, pk=None):
        recon = debt_reconciliation.refresh_reconciliation_data(self.get_object(), request.user)
        return Response(self.get_serializer(recon).data)

    @action(detail=True, methods=("post",), url_path="record-sent")
    def record_sent(self, request, pk=None):
        user_account = request.user.iam_account if hasattr(request.user, "iam_account") else None
        recon = debt_reconciliation.record_sent(self.get_object(), request.data, user_account)
        return Response(self.get_serializer(recon).data)

    @action(detail=True, methods=("post",), url_path="record-response")
    def record_response(self, request, pk=None):
        user_account = request.user.iam_account if hasattr(request.user, "iam_account") else None
        recon = debt_reconciliation.record_response(self.get_object(), request.data, user_account)
        return Response(self.get_serializer(recon).data)

    @action(detail=True, methods=("post",), url_path="re-reconcile")
    def re_reconcile(self, request, pk=None):
        user_account = request.user.iam_account if hasattr(request.user, "iam_account") else None
        new_recon = debt_reconciliation.re_reconcile(self.get_object(), user_account)
        return Response(self.get_serializer(new_recon).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        user_account = request.user.iam_account if hasattr(request.user, "iam_account") else None
        reason = request.data.get("reason", "")
        recon = debt_reconciliation.cancel_reconciliation(self.get_object(), reason, user_account)
        return Response(self.get_serializer(recon).data)

    @action(detail=True, methods=("get",), url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        data = debt_reconciliation.export_pdf_payload(self.get_object())
        return Response(data)


class DueTrackingViewSet(GenericViewSet):
    permission_classes = (DueTrackingPermission,)
    serializer_class = serializers.DueTrackingReportSerializer
    iam_permissions = {"GET": "AR.DUE_TRACKING.VIEW", "POST": "AR.DUE_TRACKING.VIEW"}
    action_permissions = {
        "list": "AR.DUE_TRACKING.VIEW",
        "item_detail": "AR.DUE_TRACKING.VIEW",
        "refresh": "AR.DUE_TRACKING.VIEW",
        "export": "AR.DUE_TRACKING.EXPORT",
        "export_excel": "AR.DUE_TRACKING.EXPORT",
        "prepare_collection": "AR.RECEIVABLE.VIEW",
    }

    def _get_company(self, request):
        company_id = request.query_params.get("company_id") or request.data.get("company_id") or request.data.get("company")
        if not company_id:
            raise ValidationError({"company_id": "Doanh nghiệp là bắt buộc."})
        try:
            return Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise NotFound("Không tìm thấy doanh nghiệp.")

    def list(self, request):
        company = self._get_company(request)
        filters = due_tracking.validate_due_tracking_filters(request.query_params)
        report = due_tracking.get_due_tracking_report(company, request.user, filters)
        return Response(report)

    @action(detail=False, methods=("get",), url_path="item-detail")
    def item_detail(self, request):
        company = self._get_company(request)
        rec_id = request.query_params.get("receivable_id")
        if not rec_id:
            raise ValidationError({"receivable_id": "Mã khoản phải thu là bắt buộc."})
        sch_id = request.query_params.get("schedule_id")
        as_of_raw = request.query_params.get("as_of_date")
        as_of_date = due_tracking.parse_date_param(as_of_raw, default=timezone.localdate())
        detail = due_tracking.get_due_item_detail(rec_id, sch_id, as_of_date, company)
        return Response(detail)

    @action(detail=False, methods=("post",), url_path="refresh")
    def refresh(self, request):
        company = self._get_company(request)
        params = request.data if request.data else request.query_params
        filters = due_tracking.validate_due_tracking_filters(params)
        report = due_tracking.get_due_tracking_report(company, request.user, filters)
        return Response(report)

    @action(detail=False, methods=("get",), url_path="export")
    def export(self, request):
        company = self._get_company(request)
        filters = due_tracking.validate_due_tracking_filters(request.query_params)
        excel_content = due_tracking.export_due_tracking_excel(company, request.user, filters)
        filename = f"bao-cao-cong-no-den-han-{filters['as_of_date']}.xlsx"
        response = HttpResponse(
            excel_content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=("get",), url_path="export-excel")
    def export_excel(self, request):
        return self.export(request)

    @action(detail=False, methods=("post",), url_path="prepare-collection")
    def prepare_collection(self, request):
        company = self._get_company(request)
        selected_items = request.data.get("selected_items")
        result = due_tracking.prepare_collection_payload(selected_items, company, request.user)
        return Response(result, status=status.HTTP_200_OK)


class CustomerPaymentReminderViewSet(BaseViewSet):
    queryset = models.CustomerPaymentReminder.objects.select_related(
        "company", "branch", "customer", "currency", "receivable_account",
        "company_bank_account", "company_bank_account__bank",
        "signer_employee", "signer_user", "created_by", "cancelled_by", "previous_notice"
    ).prefetch_related(
        "lines__receivable", "lines__receivable_schedule", "send_logs__sent_by"
    )
    serializer_class = serializers.CustomerPaymentReminderSerializer
    permission_classes = (PaymentReminderPermission,)
    iam_permissions = perms("AR.PAYMENT_REMINDER")
    search_fields = ("notice_number", "customer__name", "customer__code", "recipient_name", "title")
    ordering_fields = ("notice_date", "created_at", "total_requested_amount", "requested_due_date")

    action_permissions = {
        "GET": "AR.PAYMENT_REMINDER.VIEW",
        "POST": "AR.PAYMENT_REMINDER.CREATE",
        "PUT": "AR.PAYMENT_REMINDER.EDIT",
        "PATCH": "AR.PAYMENT_REMINDER.EDIT",
        "DELETE": "AR.PAYMENT_REMINDER.CANCEL",
        "eligible_receivables": "AR.PAYMENT_REMINDER.VIEW",
        "default_customer_info": "AR.PAYMENT_REMINDER.VIEW",
        "create_from_due_tracking": "AR.PAYMENT_REMINDER.CREATE",
        "refresh_balances": "AR.PAYMENT_REMINDER.EDIT",
        "record_sent": "AR.PAYMENT_REMINDER.SEND",
        "re_notice": "AR.PAYMENT_REMINDER.CREATE",
        "cancel": "AR.PAYMENT_REMINDER.CANCEL",
        "export_pdf": "AR.PAYMENT_REMINDER.EXPORT",
    }

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != models.ReminderStatus.DRAFT:
            raise ValidationError("Chỉ có thể xóa thông báo ở trạng thái Nháp.")
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=("get",), url_path="eligible-receivables")
    def eligible_receivables(self, request):
        company_id = request.query_params.get("company_id")
        customer_id = request.query_params.get("customer_id")
        currency_id = request.query_params.get("currency_id")
        receivable_account_id = request.query_params.get("receivable_account_id")
        branch_id = request.query_params.get("branch_id")

        if not all([company_id, customer_id, currency_id, receivable_account_id]):
            raise ValidationError("Vui lòng cung cấp đầy đủ thông tin: company_id, customer_id, currency_id, receivable_account_id.")

        from master_data.models import Party, Currency
        from general_ledger.models import Account
        from organization.models import Company, Branch

        company = Company.objects.get(pk=company_id)
        customer = Party.objects.get(pk=customer_id)
        currency = Currency.objects.get(pk=currency_id)
        account = Account.objects.get(pk=receivable_account_id)
        branch = Branch.objects.get(pk=branch_id) if branch_id else None

        items = payment_reminder.extract_eligible_receivables(
            company=company,
            customer=customer,
            currency=currency,
            receivable_account=account,
            branch=branch,
        )
        return Response({"items": items, "total_count": len(items)})

    @action(detail=False, methods=("get",), url_path="default-customer-info")
    def default_customer_info(self, request):
        customer_id = request.query_params.get("customer_id")
        if not customer_id:
            raise ValidationError("Mã khách hàng (customer_id) là bắt buộc.")
        from master_data.models import Party
        customer = Party.objects.get(pk=customer_id)
        return Response(payment_reminder.get_default_customer_info(customer))

    @action(detail=False, methods=("post",), url_path="create-from-due-tracking")
    def create_from_due_tracking(self, request):
        company_id = request.data.get("company_id")
        if not company_id:
            raise ValidationError("Mã doanh nghiệp (company_id) là bắt buộc.")
        from organization.models import Company
        company = Company.objects.get(pk=company_id)
        items = request.data.get("items", [])
        user = request.user.iam_account if hasattr(request.user, "iam_account") else None
        draft_payload = payment_reminder.create_from_due_tracking(company, items, user)
        return Response(draft_payload)

    @action(detail=True, methods=("post",), url_path="refresh-balances")
    def refresh_balances(self, request, pk=None):
        user = request.user.iam_account if hasattr(request.user, "iam_account") else None
        res = payment_reminder.refresh_reminder_balances(self.get_object(), user)
        return Response({
            "reminder": self.get_serializer(res["reminder"]).data,
            "discrepancies": res["discrepancies"],
        })

    @action(detail=True, methods=("post",), url_path="record-sent")
    def record_sent(self, request, pk=None):
        user = request.user.iam_account if hasattr(request.user, "iam_account") else None
        obj = payment_reminder.record_notice_sent(self.get_object(), request.data, user)
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=("post",), url_path="re-notice")
    def re_notice(self, request, pk=None):
        user = request.user.iam_account if hasattr(request.user, "iam_account") else None
        new_obj = payment_reminder.re_notice(self.get_object(), user)
        return Response(self.get_serializer(new_obj).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        user = request.user.iam_account if hasattr(request.user, "iam_account") else None
        reason = request.data.get("reason", "")
        obj = payment_reminder.cancel_notice(self.get_object(), reason, user)
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=("get",), url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        data = payment_reminder.export_pdf_payload(self.get_object())
        return Response(data)





