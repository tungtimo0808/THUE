from django.core.exceptions import ValidationError
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from audit_log.models import AuditLog
from organization.models import Company
from sales import link_serializers, link_services, models
from sales.permissions import SalesPermission


class SalesDocumentLinkViewSet(viewsets.ModelViewSet):
    """
    API Quản lý liên kết chứng từ bán hàng (UC-SAL-11).
    """
    queryset = models.SalesDocumentLink.objects.all()
    permission_classes = [IsAuthenticated, SalesPermission]

    action_permissions = {
        "list": "SAL.LINK.VIEW",
        "retrieve": "SAL.LINK.VIEW",
        "create": "SAL.LINK.CREATE",
        "unlink": "SAL.LINK.UNLINK",
        "document_links": "SAL.LINK.VIEW",
        "matchable_lines": "SAL.LINK.VIEW",
        "history": "SAL.LINK.VIEW",
    }

    def get_serializer_class(self):
        if self.action == "list":
            return link_serializers.SalesDocumentLinkListSerializer
        if self.action == "create":
            return link_serializers.SalesDocumentLinkCreateSerializer
        if self.action == "unlink":
            return link_serializers.SalesDocumentLinkUnlinkSerializer
        return link_serializers.SalesDocumentLinkDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        company_id = self.request.query_params.get("company_id")
        if not company_id and isinstance(self.request.data, dict):
            company_id = self.request.data.get("company") or self.request.data.get("company_id")

        if not company_id:
            if self.kwargs.get("pk"):
                return qs.filter(pk=self.kwargs["pk"]).select_related(
                    "company", "customer", "currency", "created_by", "unlinked_by"
                ).prefetch_related("lines__item", "lines__source_uom", "lines__target_uom")
            return qs.none()

        qs = qs.filter(company_id=company_id).select_related(
            "company", "customer", "currency", "created_by", "unlinked_by"
        ).prefetch_related("lines__item", "lines__source_uom", "lines__target_uom")

        # Filters
        relation_type = self.request.query_params.get("relation_type")
        if relation_type:
            qs = qs.filter(relation_type=relation_type)

        link_status = self.request.query_params.get("status")
        if link_status:
            qs = qs.filter(status=link_status)

        link_mode = self.request.query_params.get("link_mode")
        if link_mode:
            qs = qs.filter(link_mode=link_mode)

        source_doc_type = self.request.query_params.get("source_document_type")
        if source_doc_type:
            qs = qs.filter(source_document_type=source_doc_type)

        target_doc_type = self.request.query_params.get("target_document_type")
        if target_doc_type:
            qs = qs.filter(target_document_type=target_doc_type)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(link_number__icontains=search)
                | Q(source_document_number__icontains=search)
                | Q(target_document_number__icontains=search)
                | Q(notes__icontains=search)
            )

        return qs

    def create(self, request, *args, **kwargs):
        serializer = link_serializers.SalesDocumentLinkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            link = link_services.create_document_link(request, serializer.validated_data)
            output_serializer = link_serializers.SalesDocumentLinkDetailSerializer(link)
            return Response(output_serializer.data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"detail": e.messages if hasattr(e, "messages") else str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="unlink")
    def unlink(self, request, pk=None):
        link = self.get_object()
        serializer = link_serializers.SalesDocumentLinkUnlinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data["reason"]
        try:
            unlinked_link = link_services.unlink_document(request, link, reason)
            return Response(link_serializers.SalesDocumentLinkDetailSerializer(unlinked_link).data, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({"detail": e.messages if hasattr(e, "messages") else str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], url_path="document-links")
    def document_links(self, request):
        company_id = request.query_params.get("company_id")
        doc_type = request.query_params.get("document_type")
        doc_id = request.query_params.get("document_id")

        if not company_id or not doc_type or not doc_id:
            return Response(
                {"detail": "company_id, document_type, và document_id là bắt buộc."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            company = Company.objects.get(pk=company_id)
        except Company.DoesNotExist:
            return Response({"detail": "Doanh nghiệp không tồn tại."}, status=status.HTTP_400_BAD_REQUEST)

        links = link_services.get_document_links(company, doc_type, doc_id)
        return Response(link_serializers.SalesDocumentLinkDetailSerializer(links, many=True).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="matchable-lines")
    def matchable_lines(self, request):
        company_id = request.query_params.get("company_id")
        source_type = request.query_params.get("source_type")
        source_id = request.query_params.get("source_id")
        target_type = request.query_params.get("target_type")
        target_id = request.query_params.get("target_id")
        relation_type = request.query_params.get("relation_type")

        if not all([company_id, source_type, source_id, target_type, target_id, relation_type]):
            return Response(
                {"detail": "Vui lòng cung cấp đủ company_id, source_type, source_id, target_type, target_id, relation_type."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            company = Company.objects.get(pk=company_id)
            data = link_services.get_matchable_lines(
                company, source_type, source_id, target_type, target_id, relation_type
            )
            return Response(data, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({"detail": e.messages if hasattr(e, "messages") else str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        link = self.get_object()
        logs = AuditLog.objects.filter(
            company=link.company,
            entity_id=link.id,
        ).order_by("-occurred_at")

        history_records = [
            {
                "id": str(log.id),
                "action_code": log.action_code,
                "actor_name": log.actor_name_snapshot or (
                    log.actor_user.display_name if log.actor_user else ""
                ),
                "occurred_at": log.occurred_at.isoformat(),
                "reason": log.reason,
                "result": log.result,
            }
            for log in logs
        ]

        return Response({
            "link_id": str(link.id),
            "link_number": link.link_number,
            "status": link.status,
            "link_mode": link.link_mode,
            "created_at": link.created_at.isoformat() if link.created_at else None,
            "unlinked_at": link.unlinked_at.isoformat() if link.unlinked_at else None,
            "unlinked_reason": link.unlinked_reason,
            "audit_logs": history_records,
        }, status=status.HTTP_200_OK)
