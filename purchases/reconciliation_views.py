from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from accounts_payable.models import SupplierInvoice
from iam.permissions import has_effective_permission
from organization.models import Company

from .models import (
    GoodsPurchase,
    MatchingMethod,
    PurchaseOrder,
    PurchaseReceipt,
    PurchaseReconciliation,
    ReconciliationStatus,
)
from .permissions import PurchasePermission
from .reconciliation_serializers import (
    PurchaseReconciliationCreateSerializer,
    PurchaseReconciliationDetailSerializer,
    PurchaseReconciliationListSerializer,
)
from .reconciliation_services import (
    build_candidate_lines,
    cancel_reconciliation,
    compute_comparison,
    execute_reconciliation,
    get_eligible_documents,
    get_eligible_invoices,
    recalculate_reconciliation,
    request_variance_resolution,
    resolve_variance,
)


class PurchaseReconciliationViewSet(viewsets.ModelViewSet):
    queryset = PurchaseReconciliation.objects.select_related(
        "company",
        "branch",
        "supplier",
        "invoice",
        "purchase_order",
        "purchase_receipt",
        "goods_purchase",
        "created_by",
        "resolved_by",
    ).prefetch_related("lines__item", "lines__uom")
    permission_classes = (PurchasePermission,)
    iam_permissions = {
        "GET": "PUR.RECONCILIATION.VIEW",
        "POST": "PUR.RECONCILIATION.MATCH",
        "PUT": "PUR.RECONCILIATION.MATCH",
        "PATCH": "PUR.RECONCILIATION.MATCH",
        "DELETE": "PUR.RECONCILIATION.CANCEL",
    }
    action_permissions = {
        "preview": "PUR.RECONCILIATION.MATCH",
        "candidate_lines": "PUR.RECONCILIATION.VIEW",
        "eligible_invoices": "PUR.RECONCILIATION.VIEW",
        "eligible_documents": "PUR.RECONCILIATION.VIEW",
        "request_resolve": "PUR.RECONCILIATION.MATCH",
        "resolve": "PUR.RECONCILIATION.APPROVE",
        "recalculate": "PUR.RECONCILIATION.MATCH",
        "cancel": "PUR.RECONCILIATION.CANCEL",
    }

    def get_serializer_class(self):
        if self.action == "list":
            return PurchaseReconciliationListSerializer
        if self.action == "create":
            return PurchaseReconciliationCreateSerializer
        return PurchaseReconciliationDetailSerializer

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        queryset = super().get_queryset()
        if not company_id:
            return queryset.none()
        queryset = queryset.filter(company_id=company_id)
        for param in ("branch_id", "supplier_id", "status", "matching_method", "invoice_id"):
            if val := self.request.query_params.get(param):
                queryset = queryset.filter(**{param: val})
        if not self.request.user.is_superuser:
            company = Company.objects.filter(pk=company_id).first()
            if not company:
                return queryset.none()
            perm = self.action_permissions.get(self.action, self.iam_permissions.get(self.request.method))
            allowed = [
                b_id
                for b_id in queryset.values_list("branch_id", flat=True).distinct()
                if has_effective_permission(self.request.user.iam_account, company, perm, branch_id=b_id)
            ]
            queryset = queryset.filter(branch_id__in=allowed)
        return queryset

    def _check_version(self, request, instance):
        if "version" in request.data and str(request.data.get("version")) != str(instance.version):
            raise ValidationError("Dữ liệu đối chiếu đã thay đổi. Vui lòng thực hiện lại.")

    def create(self, request, *args, **kwargs):
        company_id = request.query_params.get("company_id") or request.data.get("company")
        if not company_id:
            raise ValidationError("Thiếu thông tin công ty.")
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise ValidationError("Doanh nghiệp không hợp lệ.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invoice = data["invoice"]
        method = data["matching_method"]
        po = data.get("purchase_order")
        rcpt = data.get("purchase_receipt")
        gp = data.get("goods_purchase")
        rec_date = data.get("reconciliation_date")
        notes = data.get("notes", "")
        lines = data["lines"]

        reconciliation = execute_reconciliation(
            company=company,
            invoice=invoice,
            method=method,
            lines_data=lines,
            user=request.user,
            request=request,
            purchase_order=po,
            purchase_receipt=rcpt,
            goods_purchase=gp,
            notes=notes,
            reconciliation_date=rec_date,
        )

        detail_serializer = PurchaseReconciliationDetailSerializer(reconciliation)
        return Response(
            {
                "message": "Đối chiếu chứng từ mua hàng thành công.",
                "data": detail_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"])
    def preview(self, request):
        company_id = request.query_params.get("company_id") or request.data.get("company")
        if not company_id:
            raise ValidationError("Thiếu thông tin công ty.")
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise ValidationError("Doanh nghiệp không hợp lệ.")

        serializer = PurchaseReconciliationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invoice = data["invoice"]
        method = data["matching_method"]
        po = data.get("purchase_order")
        rcpt = data.get("purchase_receipt")
        gp = data.get("goods_purchase")
        lines = data["lines"]

        computed = compute_comparison(
            company=company,
            invoice=invoice,
            method=method,
            lines_data=lines,
            purchase_order=po,
            purchase_receipt=rcpt,
            goods_purchase=gp,
        )

        # Format output lines
        formatted_lines = []
        for line in computed["lines"]:
            formatted_lines.append(
                {
                    "line_no": line["line_no"],
                    "invoice_line": str(line["invoice_line"].id),
                    "order_line": str(line["order_line"].id) if line["order_line"] else None,
                    "receipt_line": str(line["receipt_line"].id) if line["receipt_line"] else None,
                    "purchase_line": str(line["purchase_line"].id) if line["purchase_line"] else None,
                    "item": str(line["item"].id) if line["item"] else None,
                    "item_name": line["item"].name if line["item"] else line["description"],
                    "uom": str(line["uom"].id) if line["uom"] else None,
                    "order_quantity": str(line["order_quantity"]),
                    "received_quantity": str(line["received_quantity"]),
                    "invoice_quantity": str(line["invoice_quantity"]),
                    "matched_quantity": str(line["matched_quantity"]),
                    "order_unit_price": str(line["order_unit_price"]),
                    "invoice_unit_price": str(line["invoice_unit_price"]),
                    "expected_tax_rate": str(line["expected_tax_rate"]),
                    "invoice_tax_rate": str(line["invoice_tax_rate"]),
                    "document_pre_tax_amount": str(line["document_pre_tax_amount"]),
                    "invoice_pre_tax_amount": str(line["invoice_pre_tax_amount"]),
                    "tax_difference": str(line["tax_difference"]),
                    "total_difference": str(line["total_difference"]),
                    "line_result": line["line_result"],
                    "difference_reason": line["difference_reason"],
                }
            )

        return Response(
            {
                "status": computed["status"],
                "total_invoice_amount": str(computed["total_invoice_amount"]),
                "total_matched_amount": str(computed["total_matched_amount"]),
                "total_difference_amount": str(computed["total_difference_amount"]),
                "lines": formatted_lines,
            }
        )

    @action(detail=False, methods=["get"], url_path="candidate-lines")
    def candidate_lines(self, request):
        company_id = request.query_params.get("company_id")
        invoice_id = request.query_params.get("invoice_id")
        method = request.query_params.get("method", MatchingMethod.THREE_WAY)
        po_id = request.query_params.get("purchase_order_id")
        rcpt_id = request.query_params.get("purchase_receipt_id")
        gp_id = request.query_params.get("goods_purchase_id")

        if not company_id or not invoice_id:
            raise ValidationError("company_id và invoice_id là bắt buộc.")

        invoice = SupplierInvoice.objects.filter(pk=invoice_id, company_id=company_id).first()
        if not invoice:
            raise NotFound("Không tìm thấy hóa đơn.")

        po = PurchaseOrder.objects.filter(pk=po_id).first() if po_id else None
        rcpt = PurchaseReceipt.objects.filter(pk=rcpt_id).first() if rcpt_id else None
        gp = GoodsPurchase.objects.filter(pk=gp_id).first() if gp_id else None

        candidates = build_candidate_lines(
            invoice=invoice,
            purchase_order=po,
            purchase_receipt=rcpt,
            goods_purchase=gp,
            method=method,
        )
        return Response(candidates)

    @action(detail=False, methods=["get"], url_path="eligible-invoices")
    def eligible_invoices(self, request):
        company_id = request.query_params.get("company_id")
        if not company_id:
            raise ValidationError("company_id là bắt buộc.")
        branch_id = request.query_params.get("branch_id")
        supplier_id = request.query_params.get("supplier_id")

        qs = get_eligible_invoices(company_id, branch=branch_id, supplier=supplier_id)
        results = [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "invoice_series": inv.invoice_series,
                "invoice_date": str(inv.invoice_date),
                "supplier_id": str(inv.supplier_id),
                "supplier_name": inv.seller_name or inv.supplier.name,
                "branch_id": str(inv.branch_id) if inv.branch_id else None,
                "total_amount": str(inv.total_amount),
                "linked_amount": str(inv.linked_amount),
                "match_status": inv.match_status,
            }
            for inv in qs[:100]
        ]
        return Response(results)

    @action(detail=False, methods=["get"], url_path="eligible-documents")
    def eligible_documents(self, request):
        company_id = request.query_params.get("company_id")
        invoice_id = request.query_params.get("invoice_id")
        if not company_id or not invoice_id:
            raise ValidationError("company_id và invoice_id là bắt buộc.")

        invoice = SupplierInvoice.objects.filter(pk=invoice_id, company_id=company_id).first()
        if not invoice:
            raise NotFound("Không tìm thấy hóa đơn.")

        docs = get_eligible_documents(company_id, invoice)
        orders = [
            {
                "id": str(o.id),
                "number": o.number,
                "document_date": str(o.document_date),
                "total_amount": str(o.total_amount),
                "invoiced_amount": str(o.invoiced_amount),
                "invoicing_status": o.invoicing_status,
            }
            for o in docs["purchase_orders"][:50]
        ]
        receipts = [
            {
                "id": str(r.id),
                "number": r.number,
                "receipt_date": str(r.receipt_date),
                "order_id": str(r.order_id),
                "order_number": r.order.number,
            }
            for r in docs["purchase_receipts"][:50]
        ]
        purchases = [
            {
                "id": str(p.id),
                "number": p.number,
                "document_date": str(p.document_date),
                "total_amount": str(p.total_amount),
                "invoice_status": p.invoice_status,
            }
            for p in docs["goods_purchases"][:50]
        ]
        return Response(
            {
                "purchase_orders": orders,
                "purchase_receipts": receipts,
                "goods_purchases": purchases,
            }
        )

    @action(detail=True, methods=["post"], url_path="request-resolve")
    def request_resolve(self, request, pk=None):
        instance = self.get_object()
        self._check_version(request, instance)
        reason = request.data.get("reason", "")
        updated = request_variance_resolution(instance, reason, request)
        return Response(PurchaseReconciliationDetailSerializer(updated).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        instance = self.get_object()
        self._check_version(request, instance)
        note = request.data.get("note", "")
        updated = resolve_variance(instance, note, request)
        return Response(PurchaseReconciliationDetailSerializer(updated).data)

    @action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        instance = self.get_object()
        self._check_version(request, instance)
        updated = recalculate_reconciliation(instance, request)
        return Response(PurchaseReconciliationDetailSerializer(updated).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        instance = self.get_object()
        self._check_version(request, instance)
        reason = request.data.get("reason", "")
        updated = cancel_reconciliation(instance, reason, request)
        return Response(PurchaseReconciliationDetailSerializer(updated).data)
