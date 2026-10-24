import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.http import FileResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import mixins, serializers as drf_serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet, ReadOnlyModelViewSet

from . import costing, count_resolution, models, sale_issue, serializers, services, stock_alerts, stock_summary
from .permissions import InventoryPermission

logger = logging.getLogger(__name__)


def permissions(resource):
    return {"GET": f"{resource}.VIEW", "POST": f"{resource}.CREATE", "PUT": f"{resource}.EDIT", "PATCH": f"{resource}.EDIT", "DELETE": f"{resource}.CANCEL"}


class CompanyViewSet(ModelViewSet):
    permission_classes = (InventoryPermission,)
    filter_backends = (SearchFilter, OrderingFilter)
    ordering = ("-created_at",)

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        queryset = super().get_queryset()
        return queryset.filter(company_id=company_id) if company_id else queryset.none()

    def perform_create(self, serializer):
        obj = serializer.save(created_by=services.actor(self.request)) if "created_by" in [f.name for f in serializer.Meta.model._meta.fields] else serializer.save()
        services.audit(self.request, obj, "CREATE", after=serializer.data)

    def perform_update(self, serializer):
        before = self.get_serializer(serializer.instance).data
        obj = serializer.save()
        services.audit(self.request, obj, "EDIT", before=before, after=serializer.data)

    def perform_destroy(self, instance):
        if hasattr(instance, "status") and instance.status != "DRAFT":
            raise drf_serializers.ValidationError("Chỉ chứng từ nháp mới được xóa.")
        services.audit(self.request, instance, "DELETE", before=self.get_serializer(instance).data)
        instance.delete()


class PolicyViewSet(CompanyViewSet):
    queryset = models.InventoryPolicy.objects.select_related("company", "warehouse", "item", "base_uom")
    serializer_class = serializers.PolicySerializer
    iam_permissions = permissions("INV.POLICY")
    search_fields = ("warehouse__code", "warehouse__name", "item__code", "item__name")
    ordering_fields = ("minimum_quantity", "maximum_quantity", "created_at")

    def perform_create(self, serializer):
        obj = serializer.save()
        services.audit(self.request, obj, "CREATE", after=serializer.data)


class LotSerialViewSet(CompanyViewSet):
    queryset = models.LotSerial.objects.select_related("company", "item")
    serializer_class = serializers.LotSerialSerializer
    iam_permissions = permissions("INV.LOT_SERIAL")
    action_permissions = {"trace": "INV.LOT_SERIAL.VIEW"}
    search_fields = ("code", "item__code", "item__name")
    ordering_fields = ("expiry_date", "created_at")

    def perform_create(self, serializer):
        obj = serializer.save()
        services.audit(self.request, obj, "CREATE", after=serializer.data)

    @action(detail=True, methods=("get",))
    def trace(self, request, pk=None):
        obj = self.get_object()
        movements = models.StockMovement.objects.filter(lot_serial=obj).select_related("warehouse", "transaction", "line")
        return Response({"lot_serial": self.get_serializer(obj).data, "movements": serializers.MovementSerializer(movements, many=True).data})


class TransactionViewSet(CompanyViewSet):
    queryset = models.InventoryTransaction.objects.select_related("company", "source_warehouse", "destination_warehouse", "created_by").prefetch_related("lines")
    serializer_class = serializers.TransactionSerializer
    iam_permissions = permissions("INV.TRANSACTION")
    action_permissions = {
        "submit": "INV.TRANSACTION.SUBMIT", "approve": "INV.TRANSACTION.APPROVE",
        "reject": "INV.TRANSACTION.APPROVE", "post": "INV.TRANSACTION.POST",
        "reverse": "INV.TRANSACTION.CANCEL", "cancel": "INV.TRANSACTION.CANCEL",
        "post_gl": "INV.GL.POST", "gl_error": "INV.GL.POST", "sale_sources": "INV.TRANSACTION.VIEW",
        "submit_and_post": "INV.TRANSACTION.POST", "attachments": "INV.TRANSACTION.EDIT",
        "attachment_file": "INV.TRANSACTION.VIEW", "remove_attachment": "INV.TRANSACTION.EDIT",
        # The receive right is checked per destination warehouse inside the service (BR02).
        "receive": "INV.TRANSACTION.VIEW",
    }
    search_fields = ("number", "source_reference", "reason")
    ordering_fields = ("transaction_date", "total_value", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        if kind := self.request.query_params.get("transaction_type"):
            queryset = queryset.filter(transaction_type=kind)
        if state := self.request.query_params.get("status"):
            queryset = queryset.filter(status=state)
        if warehouse := self.request.query_params.get("warehouse_id"):
            queryset = queryset.filter(Q(source_warehouse_id=warehouse) | Q(destination_warehouse_id=warehouse))
        return queryset

    def permission_denied(self, request, message=None, code=None):
        if self.action == "create" and request.data.get("transaction_type") == "ISSUE":
            message = "Bạn không có quyền tạo phiếu xuất kho."
        elif self.action == "create" and request.data.get("source_module") == "INV_TRANSFER":
            message = "Bạn không có quyền lập chứng từ chuyển kho."
        elif self.action in {"post", "submit_and_post"}:
            obj = models.InventoryTransaction.objects.filter(pk=self.kwargs.get("pk")).only("source_module").first()
            message = services.post_denied_message(obj) if obj else "Bạn không có quyền ghi sổ chứng từ."
        super().permission_denied(request, message=message, code=code)

    @action(detail=False, methods=("get",), url_path="sale-sources")
    def sale_sources(self, request):
        """UC-INV-03: posted sale documents still waiting for a separate issue voucher."""
        params = request.query_params
        date_from, date_to = parse_date(params.get("date_from", "")), parse_date(params.get("date_to", ""))
        if params.get("date_from") and not date_from or params.get("date_to") and not date_to:
            raise drf_serializers.ValidationError({"date": "Khoảng thời gian không hợp lệ."})
        if date_from and date_to and date_from > date_to:
            raise drf_serializers.ValidationError({"date": "Từ ngày phải nhỏ hơn hoặc bằng Đến ngày."})
        return Response(sale_issue.sale_sources(
            params.get("company_id"), search=params.get("search", "").strip(), customer=params.get("customer", "").strip(),
            date_from=date_from, date_to=date_to, include_completed=params.get("include_completed") == "true",
        ))

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        return Response(self.get_serializer(services.submit(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return Response(self.get_serializer(services.decide(self.get_object(), request, True)).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return Response(self.get_serializer(services.decide(self.get_object(), request, False)).data)

    def _posting(self, run, obj, request):
        try:
            return run(obj, request)
        except ValidationError:
            raise
        except Exception:
            # EF18: the atomic posting already rolled back; report a clean failure for warehouse issues.
            if obj.source_module not in services.WAREHOUSE_VOUCHER_MODULES:
                raise
            logger.exception("Posting inventory voucher %s failed", obj.pk)
            raise ValidationError(services.voucher_message(obj, "failed"))

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        return Response(self.get_serializer(self._posting(services.post, self.get_object(), request)).data)

    @action(detail=True, methods=("post",), url_path="submit-and-post")
    def submit_and_post(self, request, pk=None):
        return Response(self.get_serializer(self._posting(services.submit_and_post, self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def receive(self, request, pk=None):
        """UC-INV-05 AF16: confirm the quantities received from the transit warehouse."""
        obj = services.receive_transfer(self.get_object(), request, request.data.get("lines"),
            accept_discrepancy=bool(request.data.get("accept_discrepancy")), reason=request.data.get("reason", ""))
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=("post",), parser_classes=(MultiPartParser, FormParser))
    def attachments(self, request, pk=None):
        obj = services.add_attachment(self.get_object(), request, request.FILES.get("file"))
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("get",), url_path=r"attachments/(?P<attachment_id>[0-9a-f-]{36})")
    def attachment_file(self, request, pk=None, attachment_id=None):
        entry, handle = services.attachment_file(self.get_object(), attachment_id)
        return FileResponse(handle, as_attachment=True, filename=entry["name"], content_type=entry.get("content_type") or None)

    @action(detail=True, methods=("post",), url_path=r"attachments/(?P<attachment_id>[0-9a-f-]{36})/remove")
    def remove_attachment(self, request, pk=None, attachment_id=None):
        return Response(self.get_serializer(services.remove_attachment(self.get_object(), request, attachment_id)).data)

    @action(detail=True, methods=("post",))
    def reverse(self, request, pk=None):
        return Response(self.get_serializer(services.reverse(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        obj = self.get_object()
        if obj.status not in {"DRAFT", "REJECTED"}:
            raise drf_serializers.ValidationError("Chỉ giao dịch nháp hoặc bị từ chối mới được hủy.")
        old = obj.status
        obj.status = "CANCELLED"
        obj.save(update_fields=("status", "updated_at"))
        services.audit(request, obj, "CANCEL", {"status": old}, {"status": obj.status}, request.data.get("reason", ""))
        return Response(self.get_serializer(obj).data)

    @action(detail=True, methods=("post",), url_path="post-gl")
    def post_gl(self, request, pk=None):
        return Response(self.get_serializer(services.post_gl(self.get_object(), request)).data)

    @action(detail=True, methods=("post",), url_path="gl-error")
    def gl_error(self, request, pk=None):
        obj = self.get_object()
        if obj.status != "POSTED" or obj.gl_status == "POSTED":
            raise drf_serializers.ValidationError("Trạng thái giao dịch không hợp lệ.")
        obj.gl_status = "ERROR"
        obj.save(update_fields=("gl_status", "updated_at"))
        services.audit(request, obj, "GL_ERROR", after={"error": request.data.get("error", "")})
        return Response(self.get_serializer(obj).data)


class BalanceViewSet(ReadOnlyModelViewSet):
    permission_classes = (InventoryPermission,)
    serializer_class = serializers.BalanceSerializer
    queryset = models.StockBalance.objects.select_related("company", "warehouse", "item", "location", "lot_serial")
    iam_permissions = {"GET": "INV.BALANCE.VIEW"}
    action_permissions = {"history": "INV.BALANCE.VIEW", "as_of": "INV.BALANCE.VIEW",
        "summary": "INV.BALANCE.VIEW", "summary_options": "INV.BALANCE.VIEW",
        "multi_warehouse_summary": "INV.BALANCE.VIEW", "movement_detail": "INV.BALANCE.VIEW",
        "detail_ledger": "INV.BALANCE.VIEW",
        "alerts": "INV.BALANCE.VIEW"}
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("warehouse__code", "item__code", "item__name", "lot_serial__code")
    ordering_fields = ("quantity", "inventory_value", "updated_at")

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        for field, param in (("warehouse_id", "warehouse_id"), ("item_id", "item_id"), ("lot_serial_id", "lot_serial_id")):
            if value := self.request.query_params.get(param):
                queryset = queryset.filter(**{field: value})
        return queryset

    def _summary_company(self, request):
        from organization.models import Company
        from uuid import UUID
        try:
            company_id = UUID(request.query_params.get("company_id", ""))
        except (ValueError, AttributeError):
            raise drf_serializers.ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise drf_serializers.ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})
        return company

    @action(detail=False, methods=("get",), url_path="summary-options")
    def summary_options(self, request):
        return Response(stock_summary.options(self._summary_company(request), request))

    @action(detail=False, methods=("get",))
    def alerts(self, request):
        return Response(stock_alerts.alerts(self._summary_company(request), request))

    def _summary_dates(self, request):
        try:
            start = parse_date(request.query_params.get("date_from", ""))
            end = parse_date(request.query_params.get("date_to", ""))
        except ValueError:
            start = end = None
        if not start or not end:
            raise drf_serializers.ValidationError({"date": "Vui lòng nhập ngày hợp lệ theo định dạng YYYY-MM-DD."})
        if start > end:
            raise drf_serializers.ValidationError({"date": "Từ ngày phải nhỏ hơn hoặc bằng Đến ngày."})
        return start, end

    @action(detail=False, methods=("get",))
    def summary(self, request):
        return Response(stock_summary.summary(self._summary_company(request), request, *self._summary_dates(request)))

    @action(detail=False, methods=("get",), url_path="multi-warehouse-summary")
    def multi_warehouse_summary(self, request):
        return Response(stock_summary.multi_warehouse_summary(self._summary_company(request), request, *self._summary_dates(request)))

    @action(detail=False, methods=("get",), url_path="movement-detail")
    def movement_detail(self, request):
        return Response(stock_summary.movement_detail(self._summary_company(request), request, *self._summary_dates(request)))

    @action(detail=False, methods=("get",), url_path="detail-ledger")
    def detail_ledger(self, request):
        return Response(stock_summary.detail_ledger(self._summary_company(request), request, *self._summary_dates(request)))

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        balance = self.get_object()
        movements = models.StockMovement.objects.filter(
            warehouse=balance.warehouse, item=balance.item, location=balance.location, lot_serial=balance.lot_serial,
        ).select_related("transaction", "line")
        return Response(serializers.MovementSerializer(movements, many=True).data)

    @action(detail=False, methods=("get",), url_path="as-of")
    def as_of(self, request):
        at_date = parse_date(request.query_params.get("date", ""))
        if not at_date:
            raise drf_serializers.ValidationError({"date": "Ngày tra cứu không hợp lệ."})
        movements = models.StockMovement.objects.filter(company_id=request.query_params.get("company_id"), movement_date__lte=at_date)
        if warehouse := request.query_params.get("warehouse_id"):
            movements = movements.filter(warehouse_id=warehouse)
        if item := request.query_params.get("item_id"):
            movements = movements.filter(item_id=item)
        rows = movements.values("warehouse_id", "item_id", "location_id", "lot_serial_id").annotate(
            quantity=Sum("quantity_delta"), inventory_value=Sum("value_delta")
        ).order_by("warehouse_id", "item_id")
        return Response(list(rows))


class MovementViewSet(ReadOnlyModelViewSet):
    permission_classes = (InventoryPermission,)
    serializer_class = serializers.MovementSerializer
    queryset = models.StockMovement.objects.select_related("company", "transaction", "line", "warehouse", "item", "lot_serial")
    iam_permissions = {"GET": "INV.BALANCE.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class StockCountViewSet(CompanyViewSet):
    queryset = models.StockCount.objects.select_related("company", "warehouse", "created_by", "adjustment_transaction").prefetch_related("lines")
    serializer_class = serializers.StockCountSerializer
    iam_permissions = permissions("INV.COUNT")
    action_permissions = {"confirm": "INV.COUNT.COUNT", "create_adjustment": "INV.COUNT.COUNT"}
    search_fields = ("number", "warehouse__code", "notes")
    ordering_fields = ("count_date", "created_at")

    @action(detail=True, methods=("post",), url_path="create-adjustment")
    def create_adjustment(self, request, pk=None):
        raise ValidationError("Hãy xác nhận biên bản, lập và phê duyệt phương án xử lý trước khi điều chỉnh tồn kho.")

    @action(detail=True, methods=("post",))
    def confirm(self, request, pk=None):
        obj = self.get_object()
        if not services._may_at(request, obj, "INV.COUNT.COUNT", obj.warehouse_id):
            raise ValidationError("Bạn không có quyền xác nhận kiểm kê tại kho này.")
        return Response(self.get_serializer(count_resolution.confirm_count(obj, request)).data)


class CountResolutionViewSet(CompanyViewSet):
    queryset = models.CountResolution.objects.select_related("company", "count_line__stock_count", "count_line__item", "created_by", "approved_by")
    serializer_class = serializers.CountResolutionSerializer
    iam_permissions = permissions("INV.COUNT")
    action_permissions = {"submit": "INV.COUNT.EDIT", "approve": "INV.TRANSACTION.APPROVE",
        "reject": "INV.TRANSACTION.APPROVE", "request_info": "INV.TRANSACTION.APPROVE",
        "create_voucher": "INV.TRANSACTION.CREATE", "post_voucher": "INV.TRANSACTION.POST"}

    def get_queryset(self):
        queryset = super().get_queryset()
        if count_id := self.request.query_params.get("count_id"):
            queryset = queryset.filter(count_line__stock_count_id=count_id)
        return queryset

    def perform_create(self, serializer):
        count = serializer.validated_data["count_line"].stock_count
        if str(count.company_id) != str(self.request.data.get("company", count.company_id)):
            raise ValidationError("Dòng kiểm kê không thuộc doanh nghiệp đã chọn.")
        if not services._may_at(self.request, count, "INV.COUNT.CREATE", count.warehouse_id):
            raise ValidationError("Bạn không có quyền lập phương án tại kho này.")
        obj = serializer.save(company=count.company,
            created_by=services.actor(self.request))
        services.audit(self.request, obj, "CREATE", after=serializer.data)

    def _at_warehouse(self, request, obj, code):
        warehouse_id = obj.count_line.stock_count.warehouse_id
        if not services._may_at(request, obj, code, warehouse_id):
            raise ValidationError("Bạn không có quyền thực hiện tại kho kiểm kê này.")

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        obj = self.get_object()
        self._at_warehouse(request, obj, "INV.COUNT.EDIT")
        return Response(self.get_serializer(count_resolution.submit(obj, request)).data)

    def _decision(self, request, decision):
        obj = self.get_object()
        self._at_warehouse(request, obj, "INV.TRANSACTION.APPROVE")
        return Response(self.get_serializer(count_resolution.decide(obj, request, decision, request.data.get("note", ""))).data)

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return self._decision(request, "APPROVED")

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return self._decision(request, "REJECTED")

    @action(detail=True, methods=("post",), url_path="request-info")
    def request_info(self, request, pk=None):
        return self._decision(request, "NEEDS_INFO")

    @action(detail=True, methods=("post",), url_path="create-voucher")
    def create_voucher(self, request, pk=None):
        obj = self.get_object()
        self._at_warehouse(request, obj, "INV.TRANSACTION.CREATE")
        voucher = count_resolution.create_voucher(obj, request)
        return Response(serializers.TransactionSerializer(voucher).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="post-voucher")
    @transaction.atomic
    def post_voucher(self, request, pk=None):
        obj = self.get_object()
        self._at_warehouse(request, obj, "INV.TRANSACTION.POST")
        voucher = obj.adjustment_transaction
        if not voucher or voucher.status != "DRAFT":
            raise ValidationError("Chứng từ chưa được lập hoặc đã ghi sổ.")
        voucher.status = "APPROVED"
        voucher.approved_at = timezone.now()
        voucher.save(update_fields=("status", "approved_at", "updated_at"))
        services.audit(request, voucher, "APPROVE", after={"resolution": str(obj.pk)})
        return Response(serializers.TransactionSerializer(services.post(voucher, request)).data)


class AssemblyViewSet(CompanyViewSet):
    queryset = models.AssemblyOrder.objects.select_related("company", "warehouse", "created_by").prefetch_related("lines")
    serializer_class = serializers.AssemblySerializer
    iam_permissions = permissions("INV.ASSEMBLY")
    action_permissions = {"post": "INV.ASSEMBLY.POST"}
    search_fields = ("number", "warehouse__code")
    ordering_fields = ("assembly_date", "created_at")

    @action(detail=True, methods=("post",))
    def post(self, request, pk=None):
        return Response(self.get_serializer(services.post_assembly(self.get_object(), request)).data)


class ValuationViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    permission_classes = (InventoryPermission,)
    serializer_class = serializers.ValuationSerializer
    queryset = models.ValuationRun.objects.select_related("company", "warehouse", "created_by")
    iam_permissions = {"GET": "INV.VALUATION.VIEW", "POST": "INV.VALUATION.RUN"}
    action_permissions = {"options": "INV.VALUATION.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        if not company:
            return self.queryset.none()
        queryset = self.queryset.filter(company_id=company)
        if self.request.user.is_superuser:
            return queryset
        from master_data.models import Warehouse
        from iam.permissions import has_effective_permission
        allowed = [row.pk for row in Warehouse.objects.filter(company_id=company)
                   if has_effective_permission(services.actor(self.request), row.company,
                       "INV.VALUATION.VIEW", warehouse_id=row.pk, branch_id=row.branch_id)]
        if len(allowed) == Warehouse.objects.filter(company_id=company).count():
            return queryset.filter(Q(warehouse_id__in=allowed) | Q(warehouse__isnull=True))
        return queryset.filter(warehouse_id__in=allowed)

    @action(detail=False, methods=("get",))
    def options(self, request):
        from organization.models import Company
        from uuid import UUID
        try:
            company_id = UUID(request.query_params.get("company_id", ""))
        except (ValueError, AttributeError):
            raise drf_serializers.ValidationError("Doanh nghiệp không hợp lệ.")
        selected = Company.objects.filter(pk=company_id).first()
        if not selected:
            raise drf_serializers.ValidationError("Doanh nghiệp không hợp lệ.")
        return Response(costing.options(selected, request))

    def create(self, request, *args, **kwargs):
        try:
            run = costing.run(request.data, request)
        except ValidationError as error:
            costing.record_failure(request.data, request, error)
            raise
        return Response(self.get_serializer(run).data, status=status.HTTP_201_CREATED)


class PeriodViewSet(ModelViewSet):
    permission_classes = (InventoryPermission,)
    serializer_class = serializers.PeriodSerializer
    queryset = models.InventoryPeriod.objects.select_related("company")
    iam_permissions = permissions("INV.PERIOD")

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class ApprovalViewSet(ReadOnlyModelViewSet):
    permission_classes = (InventoryPermission,)
    serializer_class = serializers.ApprovalSerializer
    queryset = models.ApprovalDecision.objects.select_related("company", "transaction", "actor")
    iam_permissions = {"GET": "INV.APPROVAL.VIEW"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()
