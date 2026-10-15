from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from iam.permissions import has_effective_permission
from organization.models import Company
from . import models, tracking_serializers, tracking_services
from .permissions import PurchasePermission


class OrderTrackingViewSet(ViewSet):
    """
    UC-PUR-10: Theo dõi thực hiện đơn mua.
    Pure read-only aggregation interface for tracking PO fulfillment, receipts,
    returns, discounts, and input invoices.
    """
    permission_classes = (PurchasePermission,)
    action_permissions = {
        "list": "PUR.TRACKING.VIEW",
        "retrieve": "PUR.TRACKING.VIEW",
        "export": "PUR.TRACKING.EXPORT",
        "document_preview": "PUR.TRACKING.VIEW",
    }

    def get_company(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError("Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên.")
        try:
            return Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError("Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên.")

    def list(self, request):
        company = self.get_company(request)
        try:
            queryset = tracking_services.get_order_tracking_queryset(company, request.query_params)
        except ValidationError:
            raise
        except Exception:
            return Response(
                {"detail": "Không thể tải danh sách đơn mua. Vui lòng thử lại."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        summaries = [tracking_services.compute_order_tracking_summary(order) for order in queryset]
        filtered_summaries = tracking_services.filter_summaries_by_computed_fields(
            summaries, request.query_params
        )

        if not filtered_summaries:
            return Response({
                "count": 0,
                "results": [],
                "message": "Không tìm thấy đơn mua phù hợp với điều kiện tìm kiếm.",
            })

        serializer = tracking_serializers.OrderTrackingListItemSerializer(filtered_summaries, many=True)
        return Response({
            "count": len(filtered_summaries),
            "results": serializer.data,
        })

    def retrieve(self, request, pk=None):
        company = self.get_company(request)
        try:
            order = models.PurchaseOrder.objects.filter(
                pk=pk,
                company=company,
            ).exclude(status=models.DocumentStatus.DRAFT).select_related(
                "company", "branch", "supplier", "currency", "buyer"
            ).prefetch_related(
                "lines__item",
                "lines__uom",
                "lines__tax_rate",
                "lines__warehouse",
            ).first()
        except Exception:
            order = None

        if not order:
            return Response(
                {"detail": "Đơn mua không tồn tại hoặc bạn không còn quyền truy cập."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            detail_data = tracking_services.compute_order_tracking_detail(order)
            serializer = tracking_serializers.OrderTrackingDetailSerializer(detail_data)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {"detail": "Không thể tổng hợp tiến độ thực hiện đơn mua. Vui lòng thử lại."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["get"])
    def export(self, request):
        company = self.get_company(request)
        try:
            queryset = tracking_services.get_order_tracking_queryset(company, request.query_params)
            summaries = [tracking_services.compute_order_tracking_summary(order) for order in queryset]
            filtered_summaries = tracking_services.filter_summaries_by_computed_fields(
                summaries, request.query_params
            )
            csv_content = tracking_services.generate_tracking_export_csv(filtered_summaries)

            response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8-sig")
            response["Content-Disposition"] = 'attachment; filename="theo_doi_thuc_hien_don_mua.csv"'
            return response
        except ValidationError:
            raise
        except Exception:
            return Response(
                {"detail": "Không thể xuất dữ liệu theo dõi đơn mua. Vui lòng thử lại."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get"], url_path="document-preview")
    def document_preview(self, request, pk=None):
        """
        Preview a related document in read-only mode (Steps 32-34, EF-07, EF-11).
        Enforces BR-PUR-TRK-03: checking specific document permissions.
        """
        company = self.get_company(request)
        doc_type = request.query_params.get("document_type")
        doc_id = request.query_params.get("document_id")

        if not doc_type or not doc_id:
            raise ValidationError("document_type và document_id là bắt buộc.")

        # Permission check per document type (BR-PUR-TRK-03, EF-11)
        perm_map = {
            "GOODS_PURCHASE": "PUR.GOODS.VIEW",
            "SERVICE_PURCHASE": "PUR.SERVICE.VIEW",
            "PURCHASE_RETURN": "PUR.RETURN.VIEW",
            "PURCHASE_DISCOUNT": "PUR.DISCOUNT.VIEW",
            "SUPPLIER_INVOICE": "AP.INVOICE.VIEW",
        }
        required_perm = perm_map.get(doc_type)
        if required_perm and hasattr(request.user, "iam_account"):
            has_perm = (
                request.user.is_superuser or
                has_effective_permission(request.user.iam_account, company, required_perm) or
                has_effective_permission(request.user.iam_account, company, "PUR.TRACKING.VIEW")
            )
            # If user explicitly does not have the specific permission when checked
            if not request.user.is_superuser and not has_effective_permission(request.user.iam_account, company, required_perm):
                return Response(
                    {"detail": "Bạn không có quyền xem chứng từ này."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # Lookup document (EF-07)
        doc_data = None
        if doc_type in ("GOODS_PURCHASE", "SERVICE_PURCHASE"):
            obj = models.GoodsPurchase.objects.filter(pk=doc_id, company=company).first()
            if obj:
                doc_data = {
                    "id": obj.id,
                    "number": obj.number,
                    "document_date": obj.document_date,
                    "status": obj.status,
                    "purchase_type": obj.purchase_type,
                    "supplier": {"id": obj.supplier_id, "name": obj.supplier.name},
                    "total_amount": obj.total_amount,
                    "notes": obj.notes,
                }
        elif doc_type == "PURCHASE_RETURN":
            obj = models.PurchaseReturn.objects.filter(pk=doc_id, company=company).first()
            if obj:
                doc_data = {
                    "id": obj.id,
                    "number": obj.number,
                    "document_date": obj.document_date,
                    "status": obj.status,
                    "reason": obj.reason,
                    "total_amount": obj.total_amount,
                }
        elif doc_type == "PURCHASE_DISCOUNT":
            obj = models.PurchaseDiscount.objects.filter(pk=doc_id, company=company).first()
            if obj:
                doc_data = {
                    "id": obj.id,
                    "number": obj.number,
                    "document_date": obj.document_date,
                    "status": obj.status,
                    "reason": obj.reason,
                    "total_amount": obj.total_amount,
                }
        elif doc_type == "SUPPLIER_INVOICE":
            from accounts_payable.models import SupplierInvoice
            obj = SupplierInvoice.objects.filter(pk=doc_id, company=company).first()
            if obj:
                doc_data = {
                    "id": obj.id,
                    "series": obj.invoice_series,
                    "number": obj.invoice_number,
                    "document_date": obj.invoice_date,
                    "status": obj.status,
                    "validation_status": obj.validation_status,
                    "total_amount": obj.total_amount,
                }

        if not doc_data:
            return Response(
                {"detail": "Chứng từ không còn tồn tại hoặc đã được cập nhật."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(doc_data)
