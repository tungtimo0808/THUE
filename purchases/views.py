from django.db.models import F, Q, Prefetch
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ReadOnlyModelViewSet

from . import approval_serializers, approval_services, models, serializers, services
from .permissions import PurchasePermission
from organization.models import Company


def crud_permissions(resource):
    return {
        "GET": f"{resource}.VIEW",
        "POST": f"{resource}.CREATE",
        "PUT": f"{resource}.EDIT",
        "PATCH": f"{resource}.EDIT",
        "DELETE": f"{resource}.DELETE",
    }


class PurchaseViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    GenericViewSet,
):
    permission_classes = (PurchasePermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("number", "notes")
    ordering_fields = ("number", "document_date", "created_at", "updated_at")
    ordering = ("-document_date", "-created_at")

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id:
            return super().get_queryset().none()
        queryset = super().get_queryset().filter(company_id=company_id)
        for parameter in ("status", "branch_id"):
            if value := self.request.query_params.get(parameter):
                queryset = queryset.filter(**{parameter: value})
        if date_from := self.request.query_params.get("date_from"):
            queryset = queryset.filter(document_date__gte=date_from)
        if date_to := self.request.query_params.get("date_to"):
            queryset = queryset.filter(document_date__lte=date_to)
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save(created_by=services.actor_for(self.request))
        services.audit(self.request, instance, "CREATE", after=serializer.data)

    def perform_update(self, serializer):
        before = self.get_serializer(serializer.instance).data
        instance = serializer.save()
        services.audit(self.request, instance, "EDIT", before=before, after=serializer.data)


class ApprovalActionsMixin:
    document_resource = ""

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        instance = services.submit_document(self.get_object(), request)
        data = self.get_serializer(instance).data
        if isinstance(instance, models.PurchaseRequest):
            data["message"] = "Gửi yêu cầu mua hàng phê duyệt thành công."
        elif isinstance(instance, models.PurchaseOrder):
            data["message"] = "Gửi đơn mua hàng phê duyệt thành công."
        return Response(data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        instance = services.decide_document(self.get_object(), request, True)
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        instance = services.decide_document(self.get_object(), request, False)
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=("post",), url_path="request-revision")
    def request_revision(self, request, pk=None):
        instance = services.request_revision(self.get_object(), request)
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=("get",), url_path="approval-history")
    def approval_history(self, request, pk=None):
        instance = self.get_object()
        decisions = models.ApprovalDecision.objects.filter(
            company=instance.company,
            document_type=services.DOCUMENT_TYPE[type(instance)],
            document_id=instance.pk,
        )
        return Response(serializers.ApprovalDecisionSerializer(decisions, many=True).data)


class PurchaseRequestViewSet(ApprovalActionsMixin, PurchaseViewSet):
    queryset = models.PurchaseRequest.objects.select_related("company", "branch", "department", "requester", "proposed_supplier", "created_by").prefetch_related("lines__item", "lines__uom")
    serializer_class = serializers.PurchaseRequestSerializer
    iam_permissions = crud_permissions("PUR.REQUEST")
    action_permissions = {
        "submit": "PUR.REQUEST.SUBMIT",
        "approve": "PUR.REQUEST.APPROVE",
        "reject": "PUR.REQUEST.REJECT",
        "request_revision": "PUR.REQUEST.APPROVE",
        "cancel": "PUR.REQUEST.CANCEL",
        "approval_history": "PUR.REQUEST.VIEW",
    }
    search_fields = ("number", "purpose", "requester__full_name", "department__name")

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        instance = services.cancel_request(self.get_object(), request)
        return Response(self.get_serializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # BR-PUR-REQ-18, BR-PUR-REQ-19
        if instance.status != models.DocumentStatus.DRAFT:
            return Response(
                {"detail": "Chỉ yêu cầu ở DRAFT và chưa liên kết với dữ liệu khác mới được xóa."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if models.PurchaseOrderRequestLine.objects.filter(request_line__request=instance).exists():
            return Response(
                {"detail": "Yêu cầu mua hàng đã liên kết với đơn mua, không thể xóa."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        before = self.get_serializer(instance).data
        services.audit(request, instance, "DELETE", before=before)
        instance.lines.all().delete()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PurchaseContractViewSet(ApprovalActionsMixin, PurchaseViewSet):
    queryset = models.PurchaseContract.objects.select_related("company", "branch", "supplier", "currency", "created_by").prefetch_related("lines__item", "lines__uom")
    serializer_class = serializers.PurchaseContractSerializer
    iam_permissions = crud_permissions("PUR.CONTRACT")
    action_permissions = {
        "submit": "PUR.CONTRACT.SUBMIT",
        "approve": "PUR.CONTRACT.APPROVE",
        "reject": "PUR.CONTRACT.REJECT",
        "terminate": "PUR.CONTRACT.CANCEL",
        "approval_history": "PUR.CONTRACT.VIEW",
    }
    search_fields = ("number", "supplier__code", "supplier__name", "notes")

    @action(detail=True, methods=("post",))
    def terminate(self, request, pk=None):
        instance = self.get_object()
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response({"reason": ["Lý do chấm dứt là bắt buộc."]}, status=status.HTTP_400_BAD_REQUEST)
        if instance.status in {models.DocumentStatus.CANCELLED, models.DocumentStatus.COMPLETED}:
            return Response({"detail": "Hợp đồng đã kết thúc."}, status=status.HTTP_400_BAD_REQUEST)
        before = instance.status
        instance.status = models.DocumentStatus.CANCELLED
        instance.terminated_at = services.timezone.now()
        instance.termination_reason = reason
        instance.save(update_fields=("status", "terminated_at", "termination_reason", "updated_at"))
        services.audit(request, instance, "CANCEL", {"status": before}, {"status": instance.status}, reason)
        return Response(self.get_serializer(instance).data)


class PurchaseOrderViewSet(ApprovalActionsMixin, PurchaseViewSet):
    queryset = models.PurchaseOrder.objects.select_related(
        "company", "branch", "supplier", "contract", "currency", "payment_term", "receiving_warehouse", "created_by"
    ).prefetch_related("lines__item", "lines__uom", "lines__warehouse", "lines__request_links__request_line", "receipts")
    serializer_class = serializers.PurchaseOrderSerializer
    iam_permissions = crud_permissions("PUR.ORDER")
    action_permissions = {
        "submit": "PUR.ORDER.SUBMIT",
        "approve": "PUR.ORDER.APPROVE",
        "reject": "PUR.ORDER.REJECT",
        "request_revision": "PUR.ORDER.APPROVE",
        "close": "PUR.ORDER.CLOSE",
        "cancel": "PUR.ORDER.CANCEL",
        "send_order": "PUR.ORDER.SEND",
        "tracking": "PUR.ORDER.VIEW",
        "approval_history": "PUR.ORDER.VIEW",
    }
    search_fields = ("number", "supplier__code", "supplier__name", "notes")

    def get_queryset(self):
        queryset = super().get_queryset()
        if supplier_id := self.request.query_params.get("supplier_id"):
            queryset = queryset.filter(supplier_id=supplier_id)
        if contract_id := self.request.query_params.get("contract_id"):
            queryset = queryset.filter(contract_id=contract_id)
        return queryset

    @action(detail=True, methods=("post",), url_path="send")
    def send_order(self, request, pk=None):
        instance = services.mark_order_sent(self.get_object(), request)
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=("post",))
    def close(self, request, pk=None):
        instance = services.finish_order(self.get_object(), request, cancel=False)
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        instance = services.finish_order(self.get_object(), request, cancel=True)
        return Response(self.get_serializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # BR-PUR-PO-29, AF-09
        if instance.status != models.DocumentStatus.DRAFT:
            return Response(
                {"detail": "Chỉ đơn ở DRAFT và chưa phát sinh dữ liệu liên quan mới được xóa."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.receipts.exists() or instance.lines.filter(Q(received_quantity__gt=0) | Q(invoiced_quantity__gt=0)).exists():
            return Response(
                {"detail": "Đơn mua hàng đã phát sinh dữ liệu liên quan và không thể xóa."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        before = self.get_serializer(instance).data
        services.audit(request, instance, "DELETE", before=before)
        affected_requests = set()
        for link in models.PurchaseOrderRequestLine.objects.filter(order_line__order=instance).select_related("request_line__request"):
            models.PurchaseRequestLine.objects.filter(pk=link.request_line_id).update(
                ordered_quantity=F("ordered_quantity") - link.quantity
            )
            affected_requests.add(link.request_line.request_id)
        instance.lines.all().delete()
        instance.delete()
        for req_id in affected_requests:
            req = models.PurchaseRequest.objects.get(pk=req_id)
            services.sync_purchase_request_status(req)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=("get",))
    def tracking(self, request, pk=None):
        return Response(services.order_tracking(self.get_object()))


class PurchaseReceiptViewSet(PurchaseViewSet):
    queryset = models.PurchaseReceipt.objects.select_related("company", "order", "warehouse", "created_by", "confirmed_by").prefetch_related("lines__order_line__item")
    serializer_class = serializers.PurchaseReceiptSerializer
    iam_permissions = crud_permissions("PUR.RECEIPT")
    action_permissions = {"confirm": "PUR.RECEIPT.CONFIRM"}
    search_fields = ("number", "order__number", "delivery_reference", "notes")
    ordering_fields = ("number", "receipt_date", "created_at", "updated_at")
    ordering = ("-receipt_date", "-created_at")

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id:
            return self.queryset.none()
        queryset = self.queryset.filter(company_id=company_id)
        if value := self.request.query_params.get("status"):
            queryset = queryset.filter(status=value)
        if order_id := self.request.query_params.get("order_id"):
            queryset = queryset.filter(order_id=order_id)
        return queryset

    @action(detail=True, methods=("post",))
    def confirm(self, request, pk=None):
        instance = services.confirm_receipt(self.get_object(), request)
        return Response(self.get_serializer(instance).data)


class ApprovalDecisionViewSet(ReadOnlyModelViewSet):
    permission_classes = (PurchasePermission,)
    serializer_class = serializers.ApprovalDecisionSerializer
    queryset = models.ApprovalDecision.objects.select_related("actor", "company")
    iam_permissions = {"GET": "PUR.APPROVAL.VIEW"}
    action_permissions = {
        "list": "PUR.APPROVAL.VIEW",
        "retrieve": "PUR.APPROVAL.VIEW",
        "pending": "PUR.APPROVAL.VIEW",
        "detail_info": "PUR.APPROVAL.VIEW",
        "decide": "PUR.APPROVAL.APPROVE",
    }
    filter_backends = (OrderingFilter,)
    ordering = ("-decided_at",)

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id:
            return self.queryset.none()
        queryset = self.queryset.filter(company_id=company_id)
        if document_type := self.request.query_params.get("document_type"):
            queryset = queryset.filter(document_type=document_type)
        if document_id := self.request.query_params.get("document_id"):
            queryset = queryset.filter(document_id=document_id)
        return queryset

    @action(detail=False, methods=("get",), url_path="pending")
    def pending(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            return Response({"company_id": ["Doanh nghiệp là bắt buộc."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return Response({"company_id": ["Doanh nghiệp không hợp lệ."]}, status=status.HTTP_400_BAD_REQUEST)

        doc_type = request.query_params.get("document_type")
        items = approval_services.list_pending_approvals(company, request.user, document_type_filter=doc_type)
        serializer = approval_serializers.ApprovalPendingItemSerializer(items, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=("get",), url_path="detail")
    def detail_info(self, request):
        company_id = request.query_params.get("company_id")
        document_type = request.query_params.get("document_type")
        document_id = request.query_params.get("document_id")

        if not company_id:
            return Response({"company_id": ["Doanh nghiệp là bắt buộc."]}, status=status.HTTP_400_BAD_REQUEST)
        if not document_type:
            return Response({"document_type": ["Loại chứng từ là bắt buộc."]}, status=status.HTTP_400_BAD_REQUEST)
        if not document_id:
            return Response({"document_id": ["Mã chứng từ là bắt buộc."]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            return Response({"company_id": ["Doanh nghiệp không hợp lệ."]}, status=status.HTTP_400_BAD_REQUEST)

        detail_data = approval_services.get_approval_detail(company, request.user, document_type, document_id)
        return Response(detail_data)

    @action(detail=False, methods=("post",), url_path="decide")
    def decide(self, request):
        serializer = approval_serializers.ApprovalDecisionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            company = Company.objects.get(pk=data["company_id"])
        except (Company.DoesNotExist, ValueError):
            return Response({"company_id": ["Doanh nghiệp không hợp lệ."]}, status=status.HTTP_400_BAD_REQUEST)

        result = approval_services.execute_approval_decision(
            company=company,
            user=request.user,
            document_type_code=data["document_type"],
            document_id=data["document_id"],
            action=data["action"],
            comment=data.get("comment", ""),
            version=data.get("version"),
            request=request,
        )
        return Response(result, status=status.HTTP_200_OK)

