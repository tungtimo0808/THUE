from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from organization.models import Company
from . import contract_serializers, contract_services, models
from .permissions import PurchasePermission
from .serializers import PurchaseOrderSerializer


class PurchaseContractViewSet(ModelViewSet):
    """
    UC-PUR-13: Quản lý hợp đồng mua hàng.
    Provides complete lifecycle management: Create, Edit, Submit, Approve, Reject, Confirm,
    Create Order, Execution Tracking, Complete, Cancel, and Delete.
    """
    permission_classes = (PurchasePermission,)
    serializer_class = contract_serializers.PurchaseContractSerializer
    action_permissions = {
        "list": "PUR.CONTRACT.VIEW",
        "retrieve": "PUR.CONTRACT.VIEW",
        "create": "PUR.CONTRACT.CREATE",
        "update": "PUR.CONTRACT.EDIT",
        "partial_update": "PUR.CONTRACT.EDIT",
        "destroy": "PUR.CONTRACT.DELETE",
        "submit": "PUR.CONTRACT.SUBMIT",
        "approve": "PUR.CONTRACT.APPROVE",
        "reject": "PUR.CONTRACT.APPROVE",
        "confirm": "PUR.CONTRACT.APPROVE",
        "complete": "PUR.CONTRACT.EDIT",
        "cancel": "PUR.CONTRACT.CANCEL",
        "create_order": "PUR.ORDER.CREATE",
        "execution": "PUR.CONTRACT.VIEW",
        "approval_history": "PUR.CONTRACT.VIEW",
    }

    def get_company(self):
        company_id = (
            self.request.query_params.get("company_id")
            or self.request.data.get("company")
            or (self.request.data.get("company_id") if isinstance(self.request.data, dict) else None)
        )
        if not company_id and self.kwargs.get("pk"):
            contract = models.PurchaseContract.objects.filter(pk=self.kwargs["pk"]).first()
            if contract:
                return contract.company
        if not company_id:
            raise ValidationError("Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên.")
        try:
            return Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError("Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên.")

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id:
            return models.PurchaseContract.objects.none()

        today = timezone.now().date()
        # BR20: Chuyển sang Hết hiệu lực nếu quá end_date
        models.PurchaseContract.objects.filter(
            company_id=company_id,
            end_date__lt=today,
            status__in=[models.DocumentStatus.APPROVED, models.DocumentStatus.IN_PROGRESS],
        ).update(status=models.DocumentStatus.EXPIRED, updated_at=timezone.now())

        qs = models.PurchaseContract.objects.filter(company_id=company_id).select_related(
            "company", "branch", "department", "supplier", "currency", "payment_term", "assigned_to", "created_by"
        ).prefetch_related(
            "lines__item",
            "lines__uom",
            "lines__tax_rate",
            "orders",
        )

        # AF01: Tìm kiếm và lọc
        q = self.request.query_params.get("q") or self.request.query_params.get("search")
        if q:
            q_clean = q.strip()
            qs = qs.filter(
                Q(number__icontains=q_clean)
                | Q(title__icontains=q_clean)
                | Q(supplier__name__icontains=q_clean)
                | Q(supplier__code__icontains=q_clean)
            )

        number = self.request.query_params.get("number")
        if number:
            qs = qs.filter(number__icontains=number.strip())

        title = self.request.query_params.get("title")
        if title:
            qs = qs.filter(title__icontains=title.strip())

        supplier = self.request.query_params.get("supplier") or self.request.query_params.get("supplier_id")
        if supplier:
            qs = qs.filter(supplier_id=supplier)

        doc_status = self.request.query_params.get("status")
        if doc_status:
            qs = qs.filter(status=doc_status)

        # Ngày ký
        signed_date = self.request.query_params.get("signed_date")
        if signed_date:
            qs = qs.filter(signed_date=signed_date)
        signed_from = self.request.query_params.get("signed_date_from")
        if signed_from:
            qs = qs.filter(signed_date__gte=signed_from)
        signed_to = self.request.query_params.get("signed_date_to")
        if signed_to:
            qs = qs.filter(signed_date__lte=signed_to)

        # Thời hạn hiệu lực
        start_from = self.request.query_params.get("start_date_from")
        if start_from:
            qs = qs.filter(start_date__gte=start_from)
        end_to = self.request.query_params.get("end_date_to")
        if end_to:
            qs = qs.filter(end_date__lte=end_to)

        return qs.order_by("-signed_date", "-created_at")

    def create(self, request, *args, **kwargs):
        company = self.get_company()
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        data["company"] = company
        contract = contract_services.create_contract(request, data)
        serializer = self.get_serializer(contract)
        res_data = dict(serializer.data)
        res_data["message"] = "Lưu hợp đồng mua hàng thành công."
        return Response(res_data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        contract = self.get_object()
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        updated = contract_services.update_contract(contract, request, data)
        serializer = self.get_serializer(updated)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        contract = self.get_object()
        contract_services.delete_contract(contract, request)
        return Response({"message": "Xóa hợp đồng mua hàng thành công."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        contract = self.get_object()
        submitted = contract_services.submit_contract(contract, request)
        serializer = self.get_serializer(submitted)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        contract = self.get_object()
        approved = contract_services.approve_contract(contract, request)
        serializer = self.get_serializer(approved)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        contract = self.get_object()
        rejected = contract_services.reject_contract(contract, request)
        serializer = self.get_serializer(rejected)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        contract = self.get_object()
        confirmed = contract_services.confirm_contract(contract, request)
        serializer = self.get_serializer(confirmed)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        contract = self.get_object()
        completed = contract_services.complete_contract(contract, request)
        serializer = self.get_serializer(completed)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        contract = self.get_object()
        cancelled = contract_services.cancel_contract(contract, request)
        serializer = self.get_serializer(cancelled)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="create-order")
    def create_order(self, request, pk=None):
        contract = self.get_object()
        if request.method == "GET":
            # Step 29: Hiển thị các dòng hàng hóa, dịch vụ cùng số lượng và giá trị còn được đặt mua
            contract_services.check_and_update_contract_expiration(contract)
            serializer = self.get_serializer(contract)
            return Response(serializer.data)

        # POST: Steps 30-31
        input_serializer = contract_serializers.CreateOrderFromContractSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        order = contract_services.create_order_from_contract(contract, request, input_serializer.validated_data)
        return Response(PurchaseOrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="execution")
    def execution(self, request, pk=None):
        contract = self.get_object()
        summary = contract_services.get_contract_execution_summary(contract)
        return Response(summary)

    @action(detail=True, methods=["get"], url_path="approval-history")
    def approval_history(self, request, pk=None):
        contract = self.get_object()
        decisions = models.ApprovalDecision.objects.filter(
            document_type="CONTRACT",
            document_id=contract.pk,
        ).select_related("actor").order_by("decided_at")

        history = [
            {
                "id": str(d.id),
                "level": d.level,
                "decision": d.decision,
                "actor": getattr(d.actor, "username", str(d.actor)),
                "comment": d.comment,
                "decided_at": d.decided_at.isoformat() if d.decided_at else None,
            }
            for d in decisions
        ]
        return Response(history)
