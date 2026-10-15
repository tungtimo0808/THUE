import json
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.http import HttpResponse
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from accounts_payable.models import SupplierInvoice
from iam.permissions import has_effective_permission
from master_data.models import Party
from organization.models import Company

from .input_invoice_serializers import (InputInvoiceCreateSerializer, InputInvoiceReadSerializer,
                                        InvoiceMatchInputSerializer)
from .input_invoice_services import (audit, check_scope, confirm_invoice, create_invoice,
                                     link_lines, parse_xml, read_upload, unlink)
from .models import GoodsPurchase, PurchaseInvoiceDraft, PurchaseInvoiceFile, PurchaseInvoiceMatch
from .permissions import PurchasePermission


class InputInvoiceViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    queryset = SupplierInvoice.objects.filter(received_via_purchase=True).select_related(
        "company", "branch", "supplier", "original_invoice", "purchase_order").prefetch_related(
        "lines", "purchase_files")
    serializer_class = InputInvoiceReadSerializer
    permission_classes = (PurchasePermission,)
    parser_classes = (JSONParser, MultiPartParser, FormParser)
    iam_permissions = {"GET": "PUR.INPUT_INVOICE.VIEW", "POST": "PUR.INPUT_INVOICE.RECEIVE"}
    action_permissions = {"preview_xml": "PUR.INPUT_INVOICE.RECEIVE",
        "receive_xml": "PUR.INPUT_INVOICE.RECEIVE", "confirm": "PUR.INPUT_INVOICE.RECEIVE",
        "add_links": "PUR.INPUT_INVOICE.LINK", "remove_link": "PUR.INPUT_INVOICE.UNLINK",
        "download_file": "PUR.INPUT_INVOICE.VIEW", "upload_preview": "PUR.INPUT_INVOICE.RECEIVE",
        "eligible_purchases": "PUR.INPUT_INVOICE.VIEW", "available_lines": "PUR.INPUT_INVOICE.VIEW",
        "drafts": "PUR.INPUT_INVOICE.RECEIVE", "draft_detail": "PUR.INPUT_INVOICE.RECEIVE",
        "confirm_draft": "PUR.INPUT_INVOICE.RECEIVE"}

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        queryset = super().get_queryset()
        if not company_id:
            return queryset.none()
        queryset = queryset.filter(company_id=company_id)
        for key in ("branch_id", "supplier_id", "validation_status", "match_status", "invoice_type"):
            if value := self.request.query_params.get(key):
                queryset = queryset.filter(**{key: value})
        if not self.request.user.is_superuser:
            company = Company.objects.filter(pk=company_id).first()
            if not company:
                return queryset.none()
            permission = self.action_permissions.get(self.action, self.iam_permissions.get(self.request.method))
            allowed = [branch_id for branch_id in queryset.values_list("branch_id", flat=True).distinct()
                if has_effective_permission(self.request.user.iam_account, company, permission, branch_id=branch_id)]
            queryset = queryset.filter(branch_id__in=allowed)
        return queryset

    def _company(self, request):
        company = Company.objects.filter(pk=request.query_params.get("company_id")).first()
        if not company:
            raise ValidationError({"company_id": "Doanh nghiệp không hợp lệ."})
        return company

    def create(self, request):
        company = self._company(request)
        serializer = InputInvoiceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = create_invoice(serializer.validated_data, company, request)
        return Response(self.get_serializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("post", "get"), url_path="drafts")
    def drafts(self, request):
        company = self._company(request)
        if request.method == "GET":
            queryset = PurchaseInvoiceDraft.objects.filter(company=company)
            if not request.user.is_superuser:
                queryset = queryset.filter(created_by=request.user.iam_account)
            result = [{"id": str(obj.pk), "branch": str(obj.branch_id), "payload": obj.payload,
                "status": obj.status, "version": obj.version} for obj in queryset
                if request.user.is_superuser or has_effective_permission(request.user.iam_account,
                    company, "PUR.INPUT_INVOICE.RECEIVE", branch_id=obj.branch_id)]
            return Response(result)
        if request.data.get("source", "MANUAL") != "MANUAL":
            raise ValidationError("Chỉ hóa đơn nhập thủ công được lưu nháp.")
        branch_id = request.data.get("branch")
        if not branch_id or not company.branches.filter(pk=branch_id, status="ACTIVE").exists():
            raise ValidationError({"branch": "Chi nhánh là bắt buộc."})
        check_scope(request, company, branch_id, "PUR.INPUT_INVOICE.RECEIVE")
        payload = dict(request.data)
        draft = PurchaseInvoiceDraft.objects.create(company=company, branch_id=branch_id,
            payload=payload, created_by=request.user.iam_account)
        audit(request, draft, "DRAFT", after={"source": "MANUAL", "status": draft.status})
        return Response({"id": str(draft.pk), "branch": str(branch_id), "payload": draft.payload,
            "status": draft.status, "version": draft.version}, status=status.HTTP_201_CREATED)

    def _draft(self, request, draft_id):
        draft = PurchaseInvoiceDraft.objects.filter(pk=draft_id, company=self._company(request)).first()
        if not draft or (not request.user.is_superuser and draft.created_by_id != request.user.iam_account.pk):
            raise NotFound()
        check_scope(request, draft.company, draft.branch_id, "PUR.INPUT_INVOICE.RECEIVE")
        return draft

    @action(detail=False, methods=("get", "patch", "delete"), url_path=r"drafts/(?P<draft_id>[^/.]+)")
    def draft_detail(self, request, draft_id=None):
        draft = self._draft(request, draft_id)
        if request.method == "PATCH":
            if draft.status != "PENDING_VALIDATION" or str(request.data.get("version")) != str(draft.version):
                raise ValidationError("Bản nháp đã được cập nhật. Vui lòng tải lại dữ liệu.")
            payload = dict(draft.payload)
            payload.update({key: value for key, value in request.data.items() if key != "version"})
            if payload.get("source", "MANUAL") != "MANUAL":
                raise ValidationError("Chỉ hóa đơn nhập thủ công được lưu nháp.")
            branch_id = payload.get("branch")
            if not draft.company.branches.filter(pk=branch_id, status="ACTIVE").exists():
                raise ValidationError({"branch": "Chi nhánh không hợp lệ."})
            check_scope(request, draft.company, branch_id, "PUR.INPUT_INVOICE.RECEIVE")
            draft.branch_id = branch_id
            draft.payload = payload
            draft.version += 1
            draft.save(update_fields=("branch", "payload", "version", "updated_at"))
            audit(request, draft, "EDIT_DRAFT", after={"version": draft.version})
        elif request.method == "DELETE":
            if draft.status != "PENDING_VALIDATION":
                raise ValidationError("Bản nháp đã xác nhận không được xóa.")
            audit(request, draft, "DELETE_DRAFT", before={"payload": draft.payload})
            draft.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response({"id": str(draft.pk), "branch": str(draft.branch_id), "payload": draft.payload,
            "status": draft.status, "version": draft.version})

    @action(detail=False, methods=("post",), url_path=r"drafts/(?P<draft_id>[^/.]+)/confirm")
    def confirm_draft(self, request, draft_id=None):
        draft = self._draft(request, draft_id)
        if draft.status != "PENDING_VALIDATION" or str(request.data.get("version")) != str(draft.version):
            raise ValidationError("Bản nháp đã được cập nhật. Vui lòng tải lại dữ liệu.")
        payload = dict(draft.payload)
        payload.update({key: value for key, value in request.data.items() if key != "version"})
        payload.pop("save_draft", None)
        serializer = InputInvoiceCreateSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            invoice = create_invoice(serializer.validated_data, draft.company, request)
            draft.status = "CONFIRMED"
            draft.save(update_fields=("status", "updated_at"))
            audit(request, draft, "CONFIRM_DRAFT", after={"invoice": str(invoice.pk)})
        return Response(self.get_serializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("post",), url_path="preview-xml")
    def preview_xml(self, request):
        company = self._company(request)
        content = read_upload(request.FILES.get("file"), xml=True)
        parsed = parse_xml(content)
        supplier = Party.objects.filter(company=company, tax_code=parsed["supplier_tax_code"], status="ACTIVE").first()
        duplicate = SupplierInvoice.objects.filter(company=company, supplier_tax_code=parsed["supplier_tax_code"],
            invoice_series=parsed["invoice_series"], invoice_number=parsed["invoice_number"]).exists()
        return Response({"data": parsed, "supplier": str(supplier.pk) if supplier else None,
            "buyer_tax_code_matches": parsed["buyer_tax_code"] == company.tax_code,
            "duplicate": duplicate, "sha256": __import__("hashlib").sha256(content).hexdigest()})

    @action(detail=False, methods=("post",), url_path="receive-xml")
    def receive_xml(self, request):
        company = self._company(request)
        upload = request.FILES.get("file")
        content = read_upload(upload, xml=True)
        parsed = parse_xml(content)
        supplier = Party.objects.filter(company=company, tax_code=parsed["supplier_tax_code"], status="ACTIVE").first()
        if not supplier:
            raise ValidationError("Nhà cung cấp chưa tồn tại trong danh mục.")
        parsed.update({"supplier": str(supplier.pk), "branch": request.data.get("branch")})
        for key in ("invoice_type", "adjustment_effect", "original_invoice", "purchase_order", "notes"):
            if request.data.get(key):
                parsed[key] = request.data[key]
        raw_links = request.data.get("links", "[]")
        try:
            parsed["links"] = json.loads(raw_links) if isinstance(raw_links, str) else raw_links
        except json.JSONDecodeError:
            raise ValidationError({"links": "Dữ liệu liên kết không hợp lệ."})
        serializer = InputInvoiceCreateSerializer(data=parsed)
        serializer.is_valid(raise_exception=True)
        preview = request.FILES.get("preview_file")
        preview_content = read_upload(preview) if preview else None
        invoice = create_invoice(serializer.validated_data, company, request,
            xml_content=content, xml_name=upload.name,
            preview_content=preview_content, preview_name=preview.name if preview else None)
        return Response(self.get_serializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def confirm(self, request, pk=None):
        invoice = self.get_object()
        rows = InvoiceMatchInputSerializer(data=request.data.get("links", []), many=True)
        rows.is_valid(raise_exception=True)
        try:
            invoice = confirm_invoice(invoice, request, rows.validated_data)
        except ValidationError:
            if invoice.validation_status == "PENDING_VALIDATION":
                invoice.validation_status = "INVALID"
                invoice.save(update_fields=("validation_status", "updated_at"))
            raise
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=("post",), url_path="links")
    def add_links(self, request, pk=None):
        invoice = self.get_object()
        rows = InvoiceMatchInputSerializer(data=request.data.get("links", []), many=True)
        rows.is_valid(raise_exception=True)
        with transaction.atomic():
            invoice = SupplierInvoice.objects.select_for_update().get(pk=invoice.pk)
            check_scope(request, invoice.company, invoice.branch_id, "PUR.INPUT_INVOICE.LINK")
            link_lines(invoice, rows.validated_data, request)
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=("delete",), url_path=r"links/(?P<match_id>[^/.]+)")
    def remove_link(self, request, pk=None, match_id=None):
        return Response(self.get_serializer(unlink(self.get_object(), match_id, request)).data)

    @action(detail=True, methods=("get",), url_path=r"files/(?P<kind>xml|preview)")
    def download_file(self, request, pk=None, kind=None):
        invoice = self.get_object()
        file = PurchaseInvoiceFile.objects.filter(invoice=invoice, kind=kind.upper()).first()
        if not file:
            raise NotFound("File hóa đơn không tồn tại.")
        response = HttpResponse(bytes(file.content), content_type=file.content_type)
        response["Content-Disposition"] = f'attachment; filename="{file.filename.replace(chr(34), "")}"'
        return response

    @action(detail=True, methods=("post",), url_path="upload-preview")
    def upload_preview(self, request, pk=None):
        invoice = self.get_object()
        if invoice.validation_status == "INVALID":
            raise ValidationError("Hóa đơn không hợp lệ.")
        check_scope(request, invoice.company, invoice.branch_id, "PUR.INPUT_INVOICE.RECEIVE")
        upload = request.FILES.get("file")
        content = read_upload(upload)
        import hashlib
        with transaction.atomic():
            PurchaseInvoiceFile.objects.update_or_create(invoice=invoice, kind="PREVIEW", defaults={
                "filename": upload.name, "content_type": "application/pdf" if upload.name.lower().endswith(".pdf") else "image/jpeg",
                "size": len(content), "sha256": hashlib.sha256(content).hexdigest(), "content": content})
            audit(request, invoice, "UPLOAD_PREVIEW", after={"filename": upload.name, "number": invoice.invoice_number})
        return Response(self.get_serializer(invoice).data)

    @action(detail=False, methods=("get",), url_path="eligible-purchases")
    def eligible_purchases(self, request):
        company = self._company(request)
        supplier_id = request.query_params.get("supplier_id")
        if not supplier_id:
            raise ValidationError({"supplier_id": "Nhà cung cấp là bắt buộc."})
        result = []
        for purchase in GoodsPurchase.objects.filter(company=company, supplier_id=supplier_id,
                status="POSTED").select_related("branch"):
            if not request.user.is_superuser and not has_effective_permission(
                    request.user.iam_account, company, "PUR.INPUT_INVOICE.VIEW", branch_id=purchase.branch_id):
                continue
            remaining = sum((line.total_amount - (PurchaseInvoiceMatch.objects.filter(purchase_line=line,
                invoice_line__invoice__validation_status="VALID", invoice_line__invoice__is_replaced=False).aggregate(
                total=Sum("amount"))["total"] or Decimal("0")) for line in purchase.lines.all()), Decimal("0"))
            if remaining > 0:
                result.append({"id": str(purchase.pk), "number": purchase.number,
                    "branch": str(purchase.branch_id), "remaining_amount": str(remaining)})
        return Response(result)

    @action(detail=False, methods=("get",), url_path="available-lines")
    def available_lines(self, request):
        company = self._company(request)
        purchase = GoodsPurchase.objects.filter(pk=request.query_params.get("purchase_id"),
            company=company, status="POSTED").first()
        if not purchase:
            raise NotFound("Chứng từ mua hàng chưa được ghi sổ hoặc không còn hiệu lực.")
        if not request.user.is_superuser and not has_effective_permission(
                request.user.iam_account, company, "PUR.INPUT_INVOICE.VIEW", branch_id=purchase.branch_id):
            raise NotFound()
        result = []
        for line in purchase.lines.select_related("item", "tax_rate"):
            linked = PurchaseInvoiceMatch.objects.filter(purchase_line=line,
                invoice_line__invoice__validation_status="VALID", invoice_line__invoice__is_replaced=False).aggregate(
                amount=Sum("amount"), quantity=Sum("quantity"))
            result.append({"purchase_line": str(line.pk), "item": str(line.item_id),
                "quantity": str(line.quantity), "remaining_quantity": str(line.quantity - (linked["quantity"] or Decimal("0"))),
                "unit_price": str(line.unit_price), "tax_rate_percent": str(line.tax_rate.rate_percent) if line.tax_rate_id else None,
                "total_amount": str(line.total_amount), "linked_amount": str(linked["amount"] or Decimal("0")),
                "remaining_amount": str(line.total_amount - (linked["amount"] or Decimal("0")))})
        return Response(result)
