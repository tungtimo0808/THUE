from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from iam.permissions import has_effective_permission
from organization.models import Company
from .goods_serializers import GoodsPurchaseSerializer
from .goods_services import decide, post, submit, unpost
from .models import GoodsPurchase
from .permissions import PurchasePermission
from .services import audit


class GoodsPurchaseViewSet(ModelViewSet):
    queryset = GoodsPurchase.objects.select_related("company", "branch", "supplier", "purchase_order", "receiving_warehouse").prefetch_related("lines")
    serializer_class = GoodsPurchaseSerializer
    permission_resource = "PUR.GOODS"
    purchase_type_filter = "GOODS"
    permission_classes = (PurchasePermission,)
    iam_permissions = {"GET": "PUR.GOODS.VIEW", "POST": "PUR.GOODS.CREATE", "PUT": "PUR.GOODS.EDIT", "PATCH": "PUR.GOODS.EDIT", "DELETE": "PUR.GOODS.CANCEL"}
    action_permissions = {"submit": "PUR.GOODS.SUBMIT", "approve": "PUR.GOODS.APPROVE", "reject": "PUR.GOODS.APPROVE",
                          "request_revision": "PUR.GOODS.APPROVE", "post": "PUR.GOODS.POST", "unpost": "PUR.GOODS.UNPOST",
                          "cancel": "PUR.GOODS.CANCEL"}

    def get_queryset(self):
        queryset = super().get_queryset()
        queryset = queryset.filter(purchase_type="SERVICE") if self.purchase_type_filter == "SERVICE" else queryset.exclude(purchase_type="SERVICE")
        company_id = self.request.query_params.get("company_id")
        if not company_id:
            return queryset.none()
        queryset = queryset.filter(company_id=company_id)
        if branch_id := self.request.query_params.get("branch_id"):
            queryset = queryset.filter(branch_id=branch_id)
        if status_value := self.request.query_params.get("status"):
            queryset = queryset.filter(status=status_value)
        if supplier_id := self.request.query_params.get("supplier_id"):
            queryset = queryset.filter(supplier_id=supplier_id)
        if not self.request.user.is_superuser:
            queryset = queryset.filter(branch_id__in=[branch_id for branch_id in queryset.values_list("branch_id", flat=True).distinct()
                if has_effective_permission(self.request.user.iam_account, Company.objects.get(pk=company_id),
                    self.action_permissions.get(self.action, self.iam_permissions.get(self.request.method)), branch_id=branch_id)])
        return queryset

    def perform_create(self, serializer):
        company = serializer.validated_data["company"]
        branch = serializer.validated_data["branch"]
        if not self.request.user.is_superuser and not has_effective_permission(self.request.user.iam_account, company, f"{self.permission_resource}.CREATE", branch_id=branch.id):
            raise ValidationError("Bạn không có quyền trong chi nhánh này.")
        with transaction.atomic():
            purchase = serializer.save(created_by=self.request.user.iam_account)
            audit(self.request, purchase, "CREATE", after={"status": purchase.status, "number": purchase.number})

    def perform_update(self, serializer):
        self._version(self.request, serializer.instance)
        branch = serializer.validated_data.get("branch", serializer.instance.branch)
        if not self.request.user.is_superuser and not has_effective_permission(
            self.request.user.iam_account, serializer.instance.company, f"{self.permission_resource}.EDIT", branch_id=branch.pk):
            raise ValidationError("Bạn không có quyền trong chi nhánh này.")
        old = serializer.instance.status
        with transaction.atomic():
            purchase = serializer.save()
            audit(self.request, purchase, "EDIT", {"status": old}, {"status": purchase.status, "number": purchase.number})

    def destroy(self, request, *args, **kwargs):
        raise ValidationError("Dùng thao tác hủy chứng từ.")

    def _version(self, request, purchase):
        value = request.data.get("version")
        if value is None or str(value) != str(purchase.version):
            raise ValidationError("Chứng từ đã được cập nhật. Vui lòng tải lại dữ liệu.")

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        purchase = self.get_object()
        self._version(request, purchase)
        return Response(self.get_serializer(submit(purchase, request)).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        purchase = self.get_object()
        self._version(request, purchase)
        return Response(self.get_serializer(decide(purchase, request, "APPROVED")).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        purchase = self.get_object()
        self._version(request, purchase)
        return Response(self.get_serializer(decide(purchase, request, "REJECTED")).data)

    @action(detail=True, methods=("post",), url_path="request-revision")
    def request_revision(self, request, pk=None):
        purchase = self.get_object()
        self._version(request, purchase)
        return Response(self.get_serializer(decide(purchase, request, "REVISION_REQUIRED")).data)

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        purchase = self.get_object()
        self._version(request, purchase)
        return Response(self.get_serializer(post(purchase, request)).data)

    @action(detail=True, methods=("post",))
    def unpost(self, request, pk=None):
        purchase = self.get_object()
        self._version(request, purchase)
        if not request.data.get("reason", "").strip():
            raise ValidationError({"reason": "Lý do bỏ ghi sổ là bắt buộc."})
        return Response(self.get_serializer(unpost(purchase, request)).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        purchase = self.get_object()
        self._version(request, purchase)
        if purchase.status not in {"DRAFT", "REJECTED", "REVISION_REQUIRED", "APPROVED"}:
            raise ValidationError("Trạng thái không cho phép hủy.")
        with transaction.atomic():
            old = purchase.status
            purchase.status = "CANCELLED"
            purchase.version += 1
            purchase.save(update_fields=("status", "version", "updated_at"))
            audit(request, purchase, "CANCEL", {"status": old}, {"status": "CANCELLED"}, request.data.get("reason", ""))
        return Response(self.get_serializer(purchase).data)
