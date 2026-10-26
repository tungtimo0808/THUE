from django.http import HttpResponse
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ReadOnlyModelViewSet
from . import models, serializers, services, tracking_services, payment_request_services, payment_voucher_services, allocation_services, offset_services, adjustment_voucher_services, reconciliation_services, due_payables_services
from .due_payables_pdf import render_due_payables_pdf
from . import report_services
from .report_pdf import render_report_pdf
from .permissions import AccountsPayablePermission


def perms(resource): return {"GET": f"{resource}.VIEW", "POST": f"{resource}.CREATE", "PUT": f"{resource}.EDIT", "PATCH": f"{resource}.EDIT"}


class BaseViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, GenericViewSet):
    permission_classes = (AccountsPayablePermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    ordering = ("-created_at",)
    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id: return super().get_queryset().none()
        qs = super().get_queryset().filter(company_id=company_id)
        if value := self.request.query_params.get("status"): qs = qs.filter(status=value)
        return qs
    def perform_create(self, serializer):
        obj = serializer.save(created_by=services.actor(self.request)); services.audit(self.request, obj, "CREATE", after=serializer.data)
    def perform_update(self, serializer):
        before = self.get_serializer(serializer.instance).data; obj = serializer.save(); services.audit(self.request, obj, "EDIT", before, serializer.data)


class ApprovalMixin:
    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None): return Response(self.get_serializer(services.submit(self.get_object(), request)).data)
    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None): return Response(self.get_serializer(services.decide(self.get_object(), request, True)).data)
    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None): return Response(self.get_serializer(services.decide(self.get_object(), request, False)).data)


class InvoiceViewSet(ApprovalMixin, BaseViewSet):
    queryset = models.SupplierInvoice.objects.select_related("company", "branch", "supplier", "currency", "created_by").prefetch_related("lines__item", "lines__purchase_order_line", "lines__receipt_line")
    serializer_class = serializers.InvoiceSerializer
    iam_permissions = perms("AP.INVOICE")
    action_permissions = {"submit": "AP.INVOICE.SUBMIT", "approve": "AP.INVOICE.APPROVE", "reject": "AP.INVOICE.REJECT", "match": "AP.INVOICE.MATCH", "post": "AP.INVOICE.POST", "reverse": "AP.INVOICE.REVERSE"}
    search_fields = ("invoice_number", "invoice_series", "supplier_tax_code", "supplier__name")
    ordering_fields = ("invoice_date", "due_date", "total_amount", "created_at")
    def get_queryset(self):
        qs = super().get_queryset()
        if supplier := self.request.query_params.get("supplier_id"): qs = qs.filter(supplier_id=supplier)
        if match_status := self.request.query_params.get("match_status"): qs = qs.filter(match_status=match_status)
        return qs
    @action(detail=True, methods=("post",))
    def match(self, request, pk=None): return Response(self.get_serializer(services.match_invoice(self.get_object(), request)).data)
    @action(detail=True, methods=("post",))
    def post(self, request, pk=None): return Response(self.get_serializer(services.post_invoice(self.get_object(), request)).data)
    @action(detail=True, methods=("post",))
    def reverse(self, request, pk=None): return Response(self.get_serializer(services.reverse_invoice(self.get_object(), request)).data)


class PayableDocumentViewSet(BaseViewSet):
    queryset = models.PayableDocument.objects.select_related(
        "company", "branch", "supplier", "currency", "payable_account", "tax_account", "payment_term", "created_by"
    ).prefetch_related("lines__debit_account", "lines__cost_center", "lines__expense_item", "lines__statistical_code")
    serializer_class = serializers.PayableDocumentSerializer
    iam_permissions = perms("AP.DOCUMENT")
    action_permissions = {
        "preview_number": "AP.DOCUMENT.VIEW",
        "supplier_info": "AP.DOCUMENT.VIEW",
        "submit": "AP.DOCUMENT.SUBMIT",
        "approve": "AP.DOCUMENT.APPROVE",
        "reject": "AP.DOCUMENT.REJECT",
        "post": "AP.DOCUMENT.POST",
        "cancel": "AP.DOCUMENT.CANCEL",
    }
    search_fields = ("number", "supplier__name", "supplier__code", "description")
    ordering_fields = ("document_date", "posting_date", "due_date", "total_amount", "created_at")

    def get_queryset(self):
        qs = super().get_queryset()
        if supplier := self.request.query_params.get("supplier_id"):
            qs = qs.filter(supplier_id=supplier)
        if source_type := self.request.query_params.get("source_type"):
            qs = qs.filter(source_type=source_type)
        if branch := self.request.query_params.get("branch_id"):
            qs = qs.filter(branch_id=branch)
        return qs

    def create(self, request, *args, **kwargs):
        action_type = request.data.get("action", "SAVE_DRAFT")
        doc = services.save_payable_document(request, request.data, action=action_type)
        return Response(self.get_serializer(doc).data, status=201)

    def update(self, request, *args, **kwargs):
        doc = self.get_object()
        action_type = request.data.get("action", "SAVE_DRAFT")
        updated = services.save_payable_document(request, request.data, instance=doc, action=action_type)
        return Response(self.get_serializer(updated).data)

    @action(detail=False, methods=("get",), url_path="preview-number")
    def preview_number(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            return Response({"detail": "company_id là bắt buộc."}, status=400)
        from organization.models import Company
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return Response({"detail": "Công ty không tồn tại."}, status=400)
        num = services.preview_payable_document_number(
            company,
            branch=request.query_params.get("branch_id"),
            document_date=request.query_params.get("document_date"),
        )
        from django.utils import timezone
        today = timezone.localdate().isoformat()
        return Response({
            "preview_number": num,
            "document_date": request.query_params.get("document_date") or today,
            "posting_date": today,
        })

    @action(detail=False, methods=("get",), url_path="supplier-info")
    def supplier_info(self, request):
        company_id = request.query_params.get("company_id")
        supplier_id = request.query_params.get("supplier_id")
        if not company_id or not supplier_id:
            return Response({"detail": "company_id và supplier_id là bắt buộc."}, status=400)
        from organization.models import Company
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return Response({"detail": "Công ty không tồn tại."}, status=400)
        info = services.get_supplier_info(company, supplier_id)
        return Response(info)

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        doc = self.get_object()
        updated = services.submit_payable_document(doc, request)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        doc = self.get_object()
        updated = services.approve_payable_document(doc, request)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        doc = self.get_object()
        updated = services.reject_payable_document(doc, request)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        doc = self.get_object()
        updated = services.post_payable_document(doc, request)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        doc = self.get_object()
        updated = services.cancel_payable_document(doc, request)
        return Response(self.get_serializer(updated).data)


class PayableViewSet(ReadOnlyModelViewSet):
    permission_classes = (AccountsPayablePermission,); serializer_class = serializers.PayableSerializer
    queryset = models.Payable.objects.select_related("company", "branch", "supplier", "invoice", "document", "currency")
    iam_permissions = {"GET": "AP.PAYABLE.VIEW"}; filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("supplier__name", "invoice__invoice_number", "invoice__invoice_series", "document__number")
    ordering_fields = ("due_date", "balance", "original_amount", "created_at")
    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        if not company: return self.queryset.none()
        qs = self.queryset.filter(company_id=company)
        for key in ("supplier_id", "branch_id", "currency_id"):
            if value := self.request.query_params.get(key): qs = qs.filter(**{key: value})
        if status := self.request.query_params.get("status"):
            if status == "OVERDUE":
                from django.utils import timezone
                qs = qs.filter(due_date__lt=timezone.localdate(), balance__gt=0)
            else:
                qs = qs.filter(status=status)
        if self.request.query_params.get("overdue") == "true":
            from django.utils import timezone
            qs = qs.filter(due_date__lt=timezone.localdate(), balance__gt=0)
        return qs


class PaymentRequestViewSet(BaseViewSet):
    queryset = models.PaymentRequest.objects.select_related(
        "company", "branch", "supplier", "currency", "cash_fund", "company_bank_account",
        "beneficiary_account", "approver", "created_by"
    ).prefetch_related("lines__payable__document", "lines__payable__invoice", "lines__purchase_order")
    serializer_class = serializers.PaymentRequestSerializer
    iam_permissions = perms("AP.PAYMENT_REQUEST")
    action_permissions = {
        "preview_number": "AP.PAYMENT_REQUEST.VIEW",
        "eligible_payables": "AP.PAYMENT_REQUEST.VIEW",
        "eligible_orders": "AP.PAYMENT_REQUEST.VIEW",
        "submit": "AP.PAYMENT_REQUEST.SUBMIT",
        "recall": "AP.PAYMENT_REQUEST.EDIT",
        "approve": "AP.PAYMENT_REQUEST.APPROVE",
        "reject": "AP.PAYMENT_REQUEST.REJECT",
        "cancel": "AP.PAYMENT_REQUEST.CANCEL",
    }
    search_fields = ("number", "supplier__name", "payment_content", "notes", "beneficiary_name")
    ordering_fields = ("requested_date", "planned_payment_date", "total_amount", "created_at")

    def get_queryset(self):
        qs = super().get_queryset()
        if supplier := self.request.query_params.get("supplier_id"):
            qs = qs.filter(supplier_id=supplier)
        if req_type := self.request.query_params.get("request_type"):
            qs = qs.filter(request_type=req_type)
        if branch := self.request.query_params.get("branch_id"):
            qs = qs.filter(branch_id=branch)
        return qs

    def create(self, request, *args, **kwargs):
        action_type = request.data.get("action", "SAVE_DRAFT")
        req_obj = payment_request_services.save_payment_request(request, request.data, action=action_type)
        serializer = self.get_serializer(req_obj)
        response_data = serializer.data
        if action_type == "SUBMIT":
            response_data["message"] = "Gửi đề nghị thanh toán thành công."
        return Response(response_data, status=201)

    def update(self, request, *args, **kwargs):
        req_obj = self.get_object()
        action_type = request.data.get("action", "SAVE_DRAFT")
        updated = payment_request_services.save_payment_request(request, request.data, instance=req_obj, action=action_type)
        serializer = self.get_serializer(updated)
        response_data = serializer.data
        if action_type == "SUBMIT":
            response_data["message"] = "Gửi đề nghị thanh toán thành công."
        return Response(response_data)

    @action(detail=False, methods=("get",), url_path="preview-number")
    def preview_number(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Mã doanh nghiệp là bắt buộc."})
        from organization.models import Company
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})
        req_date = request.query_params.get("requested_date")
        preview = payment_request_services.generate_payment_request_number(company, requested_date=req_date, is_preview=True)
        return Response({"preview_number": preview})

    @action(detail=False, methods=("get",), url_path="eligible-payables")
    def eligible_payables(self, request):
        company_id = request.query_params.get("company_id")
        supplier_id = request.query_params.get("supplier_id")
        if not company_id:
            raise ValidationError({"company_id": "Mã doanh nghiệp là bắt buộc."})
        if not supplier_id:
            raise ValidationError({"supplier_id": "Mã nhà cung cấp là bắt buộc."})
        from organization.models import Company
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})
        exclude_req = request.query_params.get("exclude_request_id")
        data = payment_request_services.get_eligible_payables_for_supplier(company, supplier_id, exclude_request_id=exclude_req)
        return Response(data)

    @action(detail=False, methods=("get",), url_path="eligible-orders")
    def eligible_orders(self, request):
        company_id = request.query_params.get("company_id")
        supplier_id = request.query_params.get("supplier_id")
        if not company_id:
            raise ValidationError({"company_id": "Mã doanh nghiệp là bắt buộc."})
        if not supplier_id:
            raise ValidationError({"supplier_id": "Mã nhà cung cấp là bắt buộc."})
        from organization.models import Company
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})
        exclude_req = request.query_params.get("exclude_request_id")
        data = payment_request_services.get_eligible_orders_for_advance(company, supplier_id, exclude_request_id=exclude_req)
        return Response(data)

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        req_obj = self.get_object()
        updated = payment_request_services.save_payment_request(request, request.data or {}, instance=req_obj, action="SUBMIT")
        res = self.get_serializer(updated).data
        res["message"] = "Gửi đề nghị thanh toán thành công."
        return Response(res)

    @action(detail=True, methods=("post",))
    def recall(self, request, pk=None):
        updated = payment_request_services.recall_payment_request(request, self.get_object())
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        updated = payment_request_services.approve_payment_request(request, self.get_object())
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        reason = request.data.get("comment") or request.data.get("reason", "")
        updated = payment_request_services.reject_payment_request(request, self.get_object(), reason=reason)
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        reason = request.data.get("comment") or request.data.get("reason", "")
        updated = payment_request_services.cancel_payment_request(request, self.get_object(), reason=reason)
        return Response(self.get_serializer(updated).data)


class PaymentViewSet(BaseViewSet):
    queryset = models.Payment.objects.select_related(
        "company", "branch", "supplier", "currency", "cash_fund", "company_bank_account",
        "payment_request", "posted_by", "canceled_by", "created_by"
    ).prefetch_related("allocations__payable__document")
    serializer_class = serializers.PaymentSerializer
    iam_permissions = perms("AP.PAYMENT")
    action_permissions = {
        "preview_number": "AP.PAYMENT.VIEW",
        "eligible_requests": "AP.PAYMENT.VIEW",
        "request_detail": "AP.PAYMENT.VIEW",
        "post_voucher": "AP.PAYMENT.POST",
        "cancel": "AP.PAYMENT.CANCEL",
        "allocate": "AP.PAYMENT.ALLOCATE",
    }
    search_fields = ("number", "external_reference", "supplier__name", "payment_content", "recipient_name", "beneficiary_name")
    ordering_fields = ("payment_date", "amount", "created_at", "posted_at")

    def get_queryset(self):
        qs = super().get_queryset()
        if supplier := self.request.query_params.get("supplier_id"):
            qs = qs.filter(supplier_id=supplier)
        if method := self.request.query_params.get("payment_method"):
            qs = qs.filter(payment_method=method)
        if source := self.request.query_params.get("payment_source"):
            qs = qs.filter(payment_source=source)
        return qs

    def create(self, request, *args, **kwargs):
        if "action" not in request.data and ("external_type" in request.data or "payment_method_config" in request.data) and "payment_method" not in request.data:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            config = serializer.validated_data.get("payment_method_config")
            ext_type = serializer.validated_data.get("external_type") or (config.group if config else "OTHER")
            snapshot = serializer.validated_data.get("payment_method_snapshot") or ({
                "code": config.code, "name": config.name, "group": config.group,
            } if config else {})
            obj = serializer.save(status="CONFIRMED", external_type=ext_type, payment_method_snapshot=snapshot, created_by=services.actor(self.request))
            services.audit(self.request, obj, "CREATE", after=serializer.data)
            return Response(self.get_serializer(obj).data, status=201)

        action_type = request.data.get("action", "POST")
        voucher = payment_voucher_services.save_payment_voucher(request, request.data, action=action_type)
        serializer = self.get_serializer(voucher)
        res_data = serializer.data
        if action_type == "POST":
            res_data["message"] = f"Ghi sổ chứng từ thanh toán thành công. Số chứng từ: {voucher.number}."
        return Response(res_data, status=201)

    def update(self, request, *args, **kwargs):
        action_type = request.data.get("action", "SAVE_DRAFT")
        voucher = payment_voucher_services.save_payment_voucher(
            request, request.data, instance=self.get_object(), action=action_type
        )
        serializer = self.get_serializer(voucher)
        res_data = serializer.data
        if action_type == "POST":
            res_data["message"] = f"Ghi sổ chứng từ thanh toán thành công. Số chứng từ: {voucher.number}."
        return Response(res_data)

    @action(detail=False, methods=("get",), url_path="preview-number")
    def preview_number(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Mã doanh nghiệp là bắt buộc."})
        from organization.models import Company
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})

        payment_method = request.query_params.get("payment_method", models.PaymentRequestMethod.CASH)
        payment_date = request.query_params.get("payment_date")
        preview = payment_voucher_services.generate_payment_voucher_number(
            company, payment_method=payment_method, payment_date=payment_date, is_preview=True
        )
        return Response({"preview_number": preview})

    @action(detail=False, methods=("get",), url_path="eligible-requests")
    def eligible_requests(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Mã doanh nghiệp là bắt buộc."})
        from organization.models import Company
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})

        supplier_id = request.query_params.get("supplier_id")
        data = payment_voucher_services.get_eligible_payment_requests(company, supplier_id=supplier_id)
        return Response(data)

    @action(detail=False, methods=("get",), url_path="request-detail")
    def request_detail(self, request):
        company_id = request.query_params.get("company_id")
        request_id = request.query_params.get("request_id")
        if not company_id:
            raise ValidationError({"company_id": "Mã doanh nghiệp là bắt buộc."})
        if not request_id:
            raise ValidationError({"request_id": "Mã đề nghị thanh toán là bắt buộc."})
        from organization.models import Company
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})

        data = payment_voucher_services.get_payment_request_detail_for_payment(company, request_id)
        return Response(data)

    @action(detail=True, methods=("post",), url_path="post")
    def post_voucher(self, request, pk=None):
        voucher = payment_voucher_services.save_payment_voucher(
            request, request.data or {}, instance=self.get_object(), action="POST"
        )
        res_data = self.get_serializer(voucher).data
        res_data["message"] = f"Ghi sổ chứng từ thanh toán thành công. Số chứng từ: {voucher.number}."
        return Response(res_data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        reason = request.data.get("reason") or request.data.get("comment", "")
        voucher = payment_voucher_services.cancel_payment_voucher(request, self.get_object(), reason=reason)
        return Response(self.get_serializer(voucher).data)

    @action(detail=True, methods=("post",))
    def allocate(self, request, pk=None):
        return Response(self.get_serializer(services.allocate(self.get_object(), request)).data)


class PaymentAllocationVoucherViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    queryset = models.PaymentAllocationVoucher.objects.select_related("payment", "created_by", "reversed_by").prefetch_related(
        "lines__payable__document", "lines__payable__invoice", "lines__payable__goods_purchase", "lines__payable__purchase_cost"
    )
    serializer_class = serializers.PaymentAllocationVoucherSerializer
    permission_classes = (AccountsPayablePermission,)
    iam_permissions = {
        "GET": ["AP.ALLOCATION.VIEW", "AP.PAYMENT.VIEW"],
        "POST": ["AP.ALLOCATION.CREATE", "AP.PAYMENT.ALLOCATE"],
    }
    action_permissions = {
        "eligible_payments": ["AP.ALLOCATION.VIEW", "AP.PAYMENT.VIEW"],
        "eligible_payables": ["AP.ALLOCATION.VIEW", "AP.PAYMENT.VIEW"],
        "auto_suggest": ["AP.ALLOCATION.CREATE", "AP.PAYMENT.ALLOCATE"],
        "reverse": ["AP.ALLOCATION.REVERSE", "AP.PAYMENT.ALLOCATE"],
    }
    permission_denied_message = "Bạn không có quyền xem phân bổ thanh toán."

    def get_permissions(self):
        if self.action in ("create", "auto_suggest"):
            self.permission_denied_message = "Bạn không có quyền thực hiện phân bổ thanh toán."
        elif self.action == "reverse":
            self.permission_denied_message = "Bạn không có quyền đảo phân bổ thanh toán."
        elif self.action in ("list", "retrieve", "eligible_payments", "eligible_payables"):
            self.permission_denied_message = "Bạn không có quyền xem phân bổ thanh toán."
        return super().get_permissions()

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id and getattr(self, "detail", False):
            qs = super().get_queryset()
        elif company_id:
            qs = super().get_queryset().filter(company_id=company_id)
        else:
            qs = super().get_queryset().none()
        if supplier_id := self.request.query_params.get("supplier_id"):
            qs = qs.filter(payment__supplier_id=supplier_id)
        if status := self.request.query_params.get("status"):
            qs = qs.filter(status=status)
        return qs

    @action(detail=False, methods=("get",), url_path="eligible-payments")
    def eligible_payments(self, request):
        from organization.models import Company
        company = Company.objects.filter(pk=request.query_params.get("company_id")).first()
        if not company:
            raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})
        return Response(allocation_services.eligible_payments(company, request.query_params.get("supplier_id")))

    @action(detail=False, methods=("get",), url_path="eligible-payables")
    def eligible_payables(self, request):
        payment = models.Payment.objects.filter(
            pk=request.query_params.get("payment_id"), company_id=request.query_params.get("company_id"),
            status__in=(models.PaymentStatus.POSTED, models.PaymentStatus.CONFIRMED),
        ).first()
        if not payment or allocation_services._remaining(payment) <= 0:
            raise ValidationError({"payment_id": "Chứng từ thanh toán không còn tiền để phân bổ."})
        return Response(allocation_services.eligible_payables(payment))

    @action(detail=False, methods=("post",), url_path="auto-suggest")
    def auto_suggest(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.data.get("company")
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        payment_id = request.data.get("payment") or request.data.get("payment_id")
        if not payment_id:
            raise ValidationError({"payment": "Vui lòng chọn Chứng từ thanh toán."})
        payment = models.Payment.objects.filter(
            pk=payment_id, company=company,
            status__in=(models.PaymentStatus.POSTED, models.PaymentStatus.CONFIRMED),
        ).first()
        if not payment:
            raise ValidationError({"payment": "Chứng từ thanh toán không hợp lệ."})
        allocation_date = request.data.get("allocation_date")
        payable_ids = request.data.get("payable_ids")
        if payable_ids is None and "lines" in request.data:
            payable_ids = [row["payable"] for row in request.data["lines"] if isinstance(row, dict) and "payable" in row]
        result = allocation_services.auto_suggest_allocation(company, payment, payable_ids=payable_ids, allocation_date_raw=allocation_date)
        return Response(result)

    def create(self, request):
        from organization.models import Company
        company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
        if not company:
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        voucher = allocation_services.create_allocation(request, company, request.data)
        data = self.get_serializer(voucher).data
        data["message"] = f"Phân bổ thanh toán thành công. Số phiếu: {voucher.number}."
        return Response(data, status=201)

    @action(detail=True, methods=("post",))
    def reverse(self, request, pk=None):
        voucher = allocation_services.reverse_allocation(request, self.get_object(), request.data.get("reason"))
        return Response(self.get_serializer(voucher).data)


class DebtOffsetVoucherViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    queryset = models.DebtOffsetVoucher.objects.select_related(
        "partner", "currency", "journal_entry", "reversal_journal_entry"
    ).prefetch_related("payable_lines", "receivable_lines")
    serializer_class = serializers.DebtOffsetVoucherSerializer
    permission_classes = (AccountsPayablePermission,)
    iam_permissions = {"GET": "AP.OFFSET.VIEW", "POST": "AP.OFFSET.CREATE"}
    action_permissions = {"eligible_partners": "AP.OFFSET.VIEW", "eligible_debts": "AP.OFFSET.VIEW",
                          "cancel": "AP.OFFSET.CANCEL"}
    permission_denied_message = "Bạn không có quyền xem chứng từ bù trừ công nợ."

    def get_permissions(self):
        if self.action == "create":
            self.permission_denied_message = "Bạn không có quyền thực hiện bù trừ công nợ."
        elif self.action == "cancel":
            self.permission_denied_message = "Bạn không có quyền hủy chứng từ bù trừ công nợ."
        elif self.action in ("list", "retrieve", "eligible_partners", "eligible_debts"):
            self.permission_denied_message = "Bạn không có quyền xem chứng từ bù trừ công nợ."
        return super().get_permissions()

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id and getattr(self, "detail", False):
            qs = super().get_queryset()
        elif company_id:
            qs = super().get_queryset().filter(company_id=company_id)
        else:
            qs = super().get_queryset().none()
        if partner_id := self.request.query_params.get("partner_id"):
            qs = qs.filter(partner_id=partner_id)
        if status := self.request.query_params.get("status"):
            qs = qs.filter(status=status)
        return qs

    def _company(self, request):
        from organization.models import Company
        company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
        if not company:
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        return company

    @action(detail=False, methods=("get",), url_path="eligible-partners")
    def eligible_partners(self, request):
        return Response(offset_services.eligible_partners(self._company(request)))

    @action(detail=False, methods=("get",), url_path="eligible-debts")
    def eligible_debts(self, request):
        return Response(offset_services.eligible_debts(self._company(request), request.query_params.get("partner_id")))

    def create(self, request):
        voucher = offset_services.post_offset(request, self._company(request), request.data)
        data = self.get_serializer(voucher).data
        data["message"] = f"Ghi sổ chứng từ bù trừ thành công. Số chứng từ: {voucher.number}."
        return Response(data, status=201)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        return Response(self.get_serializer(offset_services.cancel_offset(
            request, self.get_object(), request.data.get("reason")
        )).data)


class NettingViewSet(BaseViewSet):
    queryset = models.Netting.objects.select_related("company", "payable", "created_by")
    serializer_class = serializers.NettingSerializer; iam_permissions = perms("AP.NETTING"); action_permissions = {"post": "AP.NETTING.POST"}
    search_fields = ("number", "counterparty_reference", "reason")
    @action(detail=True, methods=("post",))
    def post(self, request, pk=None): return Response(self.get_serializer(services.post_netting(self.get_object(), request)).data)


class PayableAdjustmentVoucherViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    queryset = models.PayableAdjustmentVoucher.objects.select_related(
        "supplier", "payable__document", "payable__invoice", "payable__goods_purchase",
        "payable__purchase_cost", "counter_account", "journal_entry", "reversal_journal_entry",
        "created_by", "cancelled_by"
    )
    serializer_class = serializers.PayableAdjustmentVoucherSerializer
    permission_classes = (AccountsPayablePermission,)
    iam_permissions = {"GET": "AP.ADJUSTMENT_VOUCHER.VIEW", "POST": "AP.ADJUSTMENT_VOUCHER.CREATE"}
    action_permissions = {"eligible_payables": "AP.ADJUSTMENT_VOUCHER.VIEW",
                          "eligible_accounts": "AP.ADJUSTMENT_VOUCHER.VIEW",
                          "cancel": "AP.ADJUSTMENT_VOUCHER.CANCEL"}
    permission_denied_message = "Bạn không có quyền xem điều chỉnh công nợ phải trả."

    def get_permissions(self):
        if self.action == "create":
            self.permission_denied_message = "Bạn không có quyền điều chỉnh công nợ phải trả."
        elif self.action == "cancel":
            self.permission_denied_message = "Bạn không có quyền hủy điều chỉnh công nợ phải trả."
        return super().get_permissions()

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id") or self.request.data.get("company")
        if company_id:
            qs = super().get_queryset().filter(company_id=company_id)
        elif getattr(self, "detail", False) or getattr(self, "action", None) in {"retrieve", "cancel"}:
            qs = super().get_queryset()
        else:
            qs = super().get_queryset().none()
        if supplier_id := self.request.query_params.get("supplier_id"):
            qs = qs.filter(supplier_id=supplier_id)
        if status := self.request.query_params.get("status"):
            qs = qs.filter(status=status)
        return qs

    def _company(self, request):
        from organization.models import Company
        company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
        if not company:
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        return company

    @action(detail=False, methods=("get",), url_path="eligible-payables")
    def eligible_payables(self, request):
        return Response(adjustment_voucher_services.eligible_payables(
            self._company(request), request.query_params.get("supplier_id"), request.query_params.get("kind")
        ))

    @action(detail=False, methods=("get",), url_path="eligible-accounts")
    def eligible_accounts(self, request):
        return Response(adjustment_voucher_services.eligible_accounts(self._company(request)))

    def create(self, request):
        voucher = adjustment_voucher_services.post_adjustment(request, self._company(request), request.data)
        data = self.get_serializer(voucher).data
        data["message"] = f"Ghi sổ điều chỉnh công nợ thành công. Số chứng từ: {voucher.number}."
        return Response(data, status=201)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        voucher = adjustment_voucher_services.cancel_adjustment(
            request, self.get_object(), request.data.get("reason")
        )
        data = self.get_serializer(voucher).data
        data["message"] = f"Hủy chứng từ điều chỉnh công nợ thành công. Số chứng từ: {voucher.number}."
        return Response(data)


class SupplierReconciliationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    queryset = models.SupplierReconciliation.objects.select_related(
        "supplier", "currency", "created_by", "completed_by", "cancelled_by"
    )
    serializer_class = serializers.SupplierReconciliationSerializer
    permission_classes = (AccountsPayablePermission,)
    iam_permissions = {"GET": "AP.RECONCILIATION.VIEW", "POST": "AP.RECONCILIATION.CREATE"}
    action_permissions = {"preview": "AP.RECONCILIATION.VIEW", "pdf": "AP.RECONCILIATION.VIEW",
                          "complete": "AP.RECONCILIATION.CONFIRM", "cancel": "AP.RECONCILIATION.CANCEL"}
    permission_denied_message = "Bạn không có quyền xem đối chiếu công nợ nhà cung cấp."

    def get_permissions(self):
        if self.action == "create":
            self.permission_denied_message = "Bạn không có quyền thực hiện đối chiếu công nợ nhà cung cấp."
        elif self.action == "cancel":
            self.permission_denied_message = "Bạn không có quyền hủy đối chiếu công nợ nhà cung cấp."
        elif self.action == "complete":
            self.permission_denied_message = "Bạn không có quyền ghi nhận xác nhận đối chiếu công nợ."
        return super().get_permissions()

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id") or self.request.data.get("company")
        if company_id:
            qs = super().get_queryset().filter(company_id=company_id)
        elif getattr(self, "detail", False) or getattr(self, "action", None) in {"retrieve", "complete", "cancel", "pdf"}:
            qs = super().get_queryset()
        else:
            qs = super().get_queryset().none()
        if supplier_id := self.request.query_params.get("supplier_id"):
            qs = qs.filter(supplier_id=supplier_id)
        if status := self.request.query_params.get("status"):
            qs = qs.filter(status=status)
        return qs

    def _company(self, request):
        from organization.models import Company
        company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
        if not company:
            raise ValidationError({"company": "Doanh nghiệp không hợp lệ."})
        return company

    @action(detail=False, methods=("get",))
    def preview(self, request):
        return Response(reconciliation_services.preview(self._company(request), request.query_params))

    def create(self, request):
        record = reconciliation_services.create_reconciliation(request, self._company(request), request.data)
        data = self.get_serializer(record).data
        data["message"] = f"Lập biên bản đối chiếu công nợ thành công. Số biên bản: {record.number}."
        return Response(data, status=201)

    @action(detail=True, methods=("post",))
    def complete(self, request, pk=None):
        record = reconciliation_services.complete_reconciliation(request, self.get_object(), request.data)
        result = self.get_serializer(record).data
        result["message"] = f"Hoàn thành đối chiếu công nợ. Kết quả: {record.get_status_display()}."
        return Response(result)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        record = reconciliation_services.cancel_reconciliation(
            request, self.get_object(), request.data.get("reason")
        )
        data = self.get_serializer(record).data
        data["message"] = f"Hủy biên bản đối chiếu công nợ thành công. Số biên bản: {record.number}."
        return Response(data)

    @action(detail=True, methods=("get",))
    def pdf(self, request, pk=None):
        from .reconciliation_pdf import render_reconciliation_pdf
        record = self.get_object()
        content = render_reconciliation_pdf(record)
        response = HttpResponse(content, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{record.number}.pdf"'
        return response


class AdjustmentViewSet(BaseViewSet):
    queryset = models.PayableAdjustment.objects.select_related("company", "payable", "created_by")
    serializer_class = serializers.AdjustmentSerializer; iam_permissions = perms("AP.ADJUSTMENT")
    action_permissions = {"post": "AP.ADJUSTMENT.POST", "reverse": "AP.ADJUSTMENT.REVERSE"}; search_fields = ("reason", "posting_reference")
    @action(detail=True, methods=("post",))
    def post(self, request, pk=None): return Response(self.get_serializer(services.post_adjustment(self.get_object(), request)).data)
    @action(detail=True, methods=("post",))
    def reverse(self, request, pk=None): return Response(self.get_serializer(services.reverse_adjustment(self.get_object(), request)).data)


class ApprovalViewSet(ReadOnlyModelViewSet):
    permission_classes=(AccountsPayablePermission,); serializer_class=serializers.ApprovalSerializer
    queryset=models.ApprovalDecision.objects.select_related("company", "actor"); iam_permissions={"GET":"AP.APPROVAL.VIEW"}
    def get_queryset(self):
        company=self.request.query_params.get("company_id"); qs=self.queryset.filter(company_id=company) if company else self.queryset.none()
        if doc := self.request.query_params.get("document_id"): qs=qs.filter(document_id=doc)
        return qs


class SupplierDebtTrackingViewSet(viewsets.ViewSet):
    permission_classes = (AccountsPayablePermission,)
    enforce_strict_permissions = True
    permission_denied_message = "Bạn không có quyền theo dõi công nợ nhà cung cấp."
    action_permissions = {
        "summary": ("AP.TRACKING.VIEW", "AP.PAYABLE.VIEW"),
        "debt_detail": ("AP.TRACKING.VIEW", "AP.PAYABLE.VIEW"),
        "timeline": ("AP.TRACKING.VIEW", "AP.PAYABLE.VIEW"),
        "document_preview": ("AP.TRACKING.VIEW", "AP.PAYABLE.VIEW"),
        "export_summary": ("AP.TRACKING.EXPORT", "AP.TRACKING.VIEW", "AP.PAYABLE.VIEW"),
        "export_detail": ("AP.TRACKING.EXPORT", "AP.TRACKING.VIEW", "AP.PAYABLE.VIEW"),
    }

    def _get_company(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError("company_id là bắt buộc.")
        from organization.models import Company
        try:
            return Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError("Công ty không tồn tại.")

    @action(detail=False, methods=("get",), url_path="summary")
    def summary(self, request):
        company = self._get_company(request)
        filters = tracking_services.validate_tracking_filters(company, request.query_params, user=request.user)
        data = tracking_services.get_supplier_debt_summary(company, filters, user=request.user)
        return Response(data)

    @action(detail=False, methods=("get",), url_path="detail")
    def debt_detail(self, request):
        company = self._get_company(request)
        supplier_id = request.query_params.get("supplier_id")
        if not supplier_id:
            raise ValidationError("supplier_id là bắt buộc.")
        filters = tracking_services.validate_tracking_filters(company, request.query_params, user=request.user)
        data = tracking_services.get_supplier_debt_detail(company, supplier_id, filters, user=request.user)
        return Response(data)

    @action(detail=False, methods=("get",), url_path="timeline")
    def timeline(self, request):
        company = self._get_company(request)
        payable_id = request.query_params.get("payable_id")
        if not payable_id:
            raise ValidationError("payable_id là bắt buộc.")
        data = tracking_services.get_payable_timeline(company, payable_id, user=request.user)
        return Response(data)

    @action(detail=False, methods=("get",), url_path="document-preview")
    def document_preview(self, request):
        company = self._get_company(request)
        doc_type = request.query_params.get("document_type")
        doc_id = request.query_params.get("document_id")
        if not doc_type or not doc_id:
            raise ValidationError("document_type và document_id là bắt buộc.")

        allowed = tracking_services.verify_document_view_permission(request.user, company, doc_type, doc_id)
        if not allowed:
            return Response({"detail": "Bạn không có quyền xem chứng từ này."}, status=403)

        preview_data = {"document_type": doc_type, "document_id": doc_id, "mode": "READ_ONLY"}
        if doc_type in ("AP.DOCUMENT", "DOCUMENT"):
            doc = models.PayableDocument.objects.filter(pk=doc_id, company=company).first()
            if not doc or doc.status == models.DocumentStatus.CANCELLED:
                return Response({"detail": "Chứng từ không còn tồn tại hoặc đã bị hủy."}, status=400)
            preview_data.update({
                "number": doc.number,
                "document_date": str(doc.document_date),
                "posting_date": str(doc.posting_date),
                "supplier_name": doc.supplier.name,
                "total_amount": str(doc.total_amount),
                "status": doc.status,
                "description": doc.description,
            })
        elif doc_type in ("AP.INVOICE", "INVOICE"):
            inv = models.SupplierInvoice.objects.filter(pk=doc_id, company=company).first()
            if not inv:
                return Response({"detail": "Chứng từ không còn tồn tại hoặc đã bị hủy."}, status=400)
            preview_data.update({
                "number": inv.invoice_number,
                "document_date": str(inv.invoice_date),
                "total_amount": str(inv.total_amount),
                "status": inv.status,
            })
        elif doc_type in ("AP.PAYMENT", "PAYMENT"):
            pm = models.Payment.objects.filter(pk=doc_id, company=company).first()
            if not pm:
                return Response({"detail": "Chứng từ không còn tồn tại hoặc đã bị hủy."}, status=400)
            preview_data.update({
                "number": pm.external_reference,
                "document_date": str(pm.payment_date),
                "total_amount": str(pm.amount),
                "status": pm.status,
            })
        return Response(preview_data)

    @action(detail=False, methods=("get",), url_path="export-summary")
    def export_summary(self, request):
        company = self._get_company(request)
        filters = tracking_services.validate_tracking_filters(company, request.query_params, user=request.user)
        data = tracking_services.get_supplier_debt_summary(company, filters, user=request.user)
        content = tracking_services.export_supplier_debt_summary_excel(company, data)
        resp = HttpResponse(content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = 'attachment; filename="supplier_debt_summary.xlsx"'
        return resp

    @action(detail=False, methods=("get",), url_path="export-detail")
    def export_detail(self, request):
        company = self._get_company(request)
        supplier_id = request.query_params.get("supplier_id")
        if not supplier_id:
            raise ValidationError("supplier_id là bắt buộc.")
        filters = tracking_services.validate_tracking_filters(company, request.query_params, user=request.user)
        data = tracking_services.get_supplier_debt_detail(company, supplier_id, filters, user=request.user)
        content = tracking_services.export_supplier_debt_detail_excel(company, data)
        resp = HttpResponse(content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = f'attachment; filename="supplier_debt_detail_{supplier_id}.xlsx"'
        return resp


class DuePayableViewSet(viewsets.ViewSet):
    """UC-AP-09: all actions are read-only, including prefill and exports."""
    permission_classes = (AccountsPayablePermission,)
    permission_denied_message = "Bạn không có quyền xem công nợ phải trả."
    action_permissions = {name: "AP.PAYABLE.VIEW" for name in
                          ("list", "retrieve", "prepare_payment_request", "export_excel", "export_pdf")}

    def _company_filters(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id") or request.data.get("company")
        if not company_id:
            raise ValidationError({"company_id": "company_id là bắt buộc."})
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError({"company_id": "Công ty không tồn tại."})
        return company, due_payables_services.validate_filters(company, request.query_params)

    def list(self, request):
        company, filters = self._company_filters(request)
        try:
            return Response(due_payables_services.get_due_payables(company, filters))
        except Exception:
            return Response({"detail": "Không thể tải dữ liệu công nợ. Vui lòng thử lại."}, status=500)

    def retrieve(self, request, pk=None):
        company, filters = self._company_filters(request)
        try:
            return Response(due_payables_services.get_detail(company, pk, filters))
        except ValidationError:
            raise
        except Exception:
            return Response({"detail": "Không thể tải dữ liệu công nợ. Vui lòng thử lại."}, status=500)

    @action(detail=False, methods=("post",), url_path="prepare-payment-request")
    def prepare_payment_request(self, request):
        company, filters = self._company_filters(request)
        ids = request.data.get("payable_ids", [])
        if not isinstance(ids, list):
            raise ValidationError({"payable_ids": "Danh sách công nợ không hợp lệ."})
        return Response(due_payables_services.prepare_payment_request(company, ids, filters["currency"]))

    @action(detail=False, methods=("get",), url_path="export-excel")
    def export_excel(self, request):
        company, filters = self._company_filters(request)
        try:
            content = due_payables_services.export_excel(due_payables_services.get_due_payables(company, filters))
        except Exception:
            return Response({"detail": "Không thể xuất danh sách công nợ. Vui lòng thử lại."}, status=500)
        response = HttpResponse(content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = 'attachment; filename="due_payables.xlsx"'
        return response

    @action(detail=False, methods=("get",), url_path="export-pdf")
    def export_pdf(self, request):
        company, filters = self._company_filters(request)
        try:
            content = render_due_payables_pdf(due_payables_services.get_due_payables(company, filters))
        except Exception:
            return Response({"detail": "Không thể xuất danh sách công nợ. Vui lòng thử lại."}, status=500)
        response = HttpResponse(content, content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="due_payables.pdf"'
        return response


class PayableReportViewSet(viewsets.ViewSet):
    """UC-AP-10 read-only supplier payable report."""
    permission_classes = (AccountsPayablePermission,)
    permission_denied_message = "Bạn không có quyền xem báo cáo công nợ phải trả."
    action_permissions = {name: "AP.REPORT.VIEW" for name in
                          ("list", "supplier_detail", "source", "export_excel", "export_pdf")}

    def _company_filters(self, request):
        from organization.models import Company
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "company_id là bắt buộc."})
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError({"company_id": "Công ty không tồn tại."})
        return company, report_services.validate_filters(company, request.query_params)

    def list(self, request):
        company, filters = self._company_filters(request)
        try:
            return Response(report_services.build_report(company, filters))
        except Exception:
            return Response({"detail": "Không thể tải báo cáo công nợ phải trả. Vui lòng thử lại."}, status=500)

    @action(detail=False, methods=("get",), url_path="supplier-detail")
    def supplier_detail(self, request):
        company, filters = self._company_filters(request)
        supplier_id = request.query_params.get("supplier_id")
        if not supplier_id:
            raise ValidationError({"supplier_id": "Vui lòng chọn Nhà cung cấp."})
        supplier_id = report_services._uuid(supplier_id, "supplier_id")
        if filters["supplier_ids"] and supplier_id not in filters["supplier_ids"]:
            raise ValidationError({"supplier_id": "Nhà cung cấp không thuộc điều kiện báo cáo."})
        filters = {**filters, "report_type": "DETAIL", "supplier_ids": [supplier_id]}
        try:
            return Response(report_services.build_report(company, filters))
        except Exception:
            return Response({"detail": "Không thể tải báo cáo công nợ phải trả. Vui lòng thử lại."}, status=500)

    @action(detail=False, methods=("get",), url_path="source")
    def source(self, request):
        company, filters = self._company_filters(request)
        transaction_id = request.query_params.get("transaction_id")
        if not transaction_id:
            raise ValidationError({"transaction_id": "Vui lòng chọn giao dịch."})
        return Response(report_services.source_for_transaction(company, filters, transaction_id, request.user))

    @action(detail=False, methods=("get",), url_path="export-excel")
    def export_excel(self, request):
        company, filters = self._company_filters(request)
        try:
            content = report_services.export_excel(report_services.build_report(company, filters, paginate=False))
        except Exception:
            return Response({"detail": "Không thể xuất báo cáo Excel. Vui lòng thử lại."}, status=500)
        response = HttpResponse(content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = 'attachment; filename="payable_report.xlsx"'
        return response

    @action(detail=False, methods=("get",), url_path="export-pdf")
    def export_pdf(self, request):
        company, filters = self._company_filters(request)
        try:
            content = render_report_pdf(report_services.build_report(company, filters, paginate=False))
        except Exception:
            return Response({"detail": "Không thể xuất báo cáo PDF. Vui lòng thử lại."}, status=500)
        response = HttpResponse(content, content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="payable_report.pdf"'
        return response

