from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from iam.permissions import has_effective_permission
from organization.models import Company
from .models import GoodsPurchase, PurchaseReturn, PurchaseReturnLine
from .permissions import PurchasePermission
from .return_serializers import PurchaseReturnSerializer
from .return_services import decide, post, submit, unpost
from .services import audit


class PurchaseReturnViewSet(ModelViewSet):
    queryset = PurchaseReturn.objects.select_related("company", "branch", "supplier", "original_purchase", "warehouse").prefetch_related("lines")
    serializer_class = PurchaseReturnSerializer
    permission_classes = (PurchasePermission,)
    iam_permissions = {"GET": "PUR.RETURN.VIEW", "POST": "PUR.RETURN.CREATE",
                       "PUT": "PUR.RETURN.EDIT", "PATCH": "PUR.RETURN.EDIT", "DELETE": "PUR.RETURN.CANCEL"}
    action_permissions = {"submit": "PUR.RETURN.SUBMIT", "approve": "PUR.RETURN.APPROVE",
                          "reject": "PUR.RETURN.APPROVE", "request_revision": "PUR.RETURN.APPROVE",
                          "post": "PUR.RETURN.POST", "unpost": "PUR.RETURN.UNPOST",
                          "cancel": "PUR.RETURN.CANCEL", "available_lines": "PUR.RETURN.VIEW"}

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        queryset = super().get_queryset()
        if not company_id:
            return queryset.none()
        queryset = queryset.filter(company_id=company_id)
        for parameter in ("branch_id", "supplier_id", "status", "original_purchase_id"):
            if value := self.request.query_params.get(parameter):
                queryset = queryset.filter(**{parameter: value})
        if not self.request.user.is_superuser:
            company = Company.objects.filter(pk=company_id).first()
            if not company:
                return queryset.none()
            permission = self.action_permissions.get(self.action, self.iam_permissions.get(self.request.method))
            allowed = [branch_id for branch_id in queryset.values_list("branch_id", flat=True).distinct()
                       if has_effective_permission(self.request.user.iam_account, company, permission, branch_id=branch_id)]
            queryset = queryset.filter(branch_id__in=allowed)
        return queryset

    def _version(self, request, document):
        if str(request.data.get("version")) != str(document.version):
            raise ValidationError("Chứng từ đã được cập nhật. Vui lòng tải lại dữ liệu.")

    def perform_create(self, serializer):
        source = serializer.validated_data["original_purchase"]
        if str(self.request.query_params.get("company_id")) != str(source.company_id):
            raise ValidationError("Chứng từ mua gốc không thuộc doanh nghiệp đang làm việc.")
        if not self.request.user.is_superuser and not has_effective_permission(
                self.request.user.iam_account, source.company, "PUR.RETURN.CREATE", branch_id=source.branch_id):
            raise ValidationError("Bạn không có quyền trong chi nhánh này.")
        with transaction.atomic():
            document = serializer.save(created_by=self.request.user.iam_account)
            audit(self.request, document, "CREATE", after={"number": document.number,
                "status": document.status, "original_purchase": source.number})

    def perform_update(self, serializer):
        self._version(self.request, serializer.instance)
        with transaction.atomic():
            previous = serializer.instance.status
            document = serializer.save()
            audit(self.request, document, "EDIT", {"status": previous},
                {"status": document.status, "number": document.number,
                 "original_purchase": document.original_purchase.number})

    def destroy(self, request, *args, **kwargs):
        raise ValidationError("Dùng thao tác hủy chứng từ.")

    @action(detail=False, methods=("get",), url_path="available-lines")
    def available_lines(self, request):
        source = GoodsPurchase.objects.filter(pk=request.query_params.get("original_purchase_id"),
            company_id=request.query_params.get("company_id"), status="POSTED").exclude(purchase_type="SERVICE").first()
        if not source:
            raise NotFound("Chứng từ mua hàng chưa được ghi sổ hoặc không còn hiệu lực.")
        if not request.user.is_superuser and not has_effective_permission(
                request.user.iam_account, source.company, "PUR.RETURN.VIEW", branch_id=source.branch_id):
            raise NotFound()
        result = []
        for line in source.lines.select_related("item", "uom", "tax_rate"):
            returned = PurchaseReturnLine.objects.filter(original_line=line, document__status="POSTED").aggregate(total=Sum("quantity"))["total"] or Decimal("0")
            result.append({"original_line": str(line.pk), "item": str(line.item_id), "uom": str(line.uom_id),
                           "purchased_quantity": str(line.quantity), "returned_quantity": str(returned),
                           "remaining_quantity": str(line.quantity - returned), "unit_price": str(line.unit_price),
                           "discount_rate": str(line.discount_rate), "tax_rate": str(line.tax_rate_id) if line.tax_rate_id else None})
        if not any(Decimal(row["remaining_quantity"]) > 0 for row in result):
            raise ValidationError("Chứng từ mua hàng không còn số lượng có thể trả lại.")
        return Response(result)

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        document = self.get_object()
        self._version(request, document)
        return Response(self.get_serializer(submit(document, request)).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        document = self.get_object()
        self._version(request, document)
        return Response(self.get_serializer(decide(document, request, "APPROVED")).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        document = self.get_object()
        self._version(request, document)
        return Response(self.get_serializer(decide(document, request, "REJECTED")).data)

    @action(detail=True, methods=("post",), url_path="request-revision")
    def request_revision(self, request, pk=None):
        document = self.get_object()
        self._version(request, document)
        return Response(self.get_serializer(decide(document, request, "REVISION_REQUIRED")).data)

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        document = self.get_object()
        self._version(request, document)
        return Response(self.get_serializer(post(document, request)).data)

    @action(detail=True, methods=("post",))
    def unpost(self, request, pk=None):
        document = self.get_object()
        self._version(request, document)
        if not request.data.get("reason", "").strip():
            raise ValidationError({"reason": "Lý do bỏ ghi sổ là bắt buộc."})
        return Response(self.get_serializer(unpost(document, request)).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        document = self.get_object()
        self._version(request, document)
        if document.status not in {"DRAFT", "REJECTED", "REVISION_REQUIRED", "APPROVED"}:
            raise ValidationError("Trạng thái không cho phép hủy.")
        with transaction.atomic():
            previous = document.status
            document.status = "CANCELLED"
            document.version += 1
            document.save(update_fields=("status", "version", "updated_at"))
            audit(request, document, "CANCEL", {"status": previous},
                {"status": "CANCELLED", "number": document.number,
                 "original_purchase": document.original_purchase.number}, request.data.get("reason", ""))
        return Response(self.get_serializer(document).data)
