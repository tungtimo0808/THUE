from rest_framework import status
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from organization.models import Company

from . import approval_serializers, approval_services, models, serializers
from .permissions import SalesPermission


class ApprovalViewSet(ReadOnlyModelViewSet):
    """Centralized Approval Workspace ViewSet (UC-SAL-08)."""
    permission_classes = (SalesPermission,)
    serializer_class = serializers.ApprovalSerializer
    queryset = models.ApprovalDecision.objects.select_related("company", "actor")
    iam_permissions = {"GET": "SAL.APPROVAL.VIEW"}
    action_permissions = {
        "list": "SAL.APPROVAL.VIEW",
        "retrieve": "SAL.APPROVAL.VIEW",
        "pending": "SAL.APPROVAL.VIEW",
        "detail_info": "SAL.APPROVAL.VIEW",
        "history": "SAL.APPROVAL.VIEW",
        "decide": "SAL.APPROVAL.APPROVE",
        "withdraw": "SAL.APPROVAL.VIEW",
    }
    filter_backends = (OrderingFilter,)
    ordering = ("-decided_at",)

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id:
            return self.queryset.none()
        qs = self.queryset.filter(company_id=company_id)
        if document_type := self.request.query_params.get("document_type"):
            qs = qs.filter(document_type=document_type)
        if document_id := self.request.query_params.get("document_id"):
            qs = qs.filter(document_id=document_id)
        return qs

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

    @action(detail=False, methods=("post",), url_path="withdraw")
    def withdraw(self, request):
        serializer = approval_serializers.ApprovalWithdrawInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            company = Company.objects.get(pk=data["company_id"])
        except (Company.DoesNotExist, ValueError):
            return Response({"company_id": ["Doanh nghiệp không hợp lệ."]}, status=status.HTTP_400_BAD_REQUEST)

        result = approval_services.execute_approval_withdrawal(
            company=company,
            user=request.user,
            document_type_code=data["document_type"],
            document_id=data["document_id"],
            reason=data.get("reason", ""),
            version=data.get("version"),
            request=request,
        )
        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=("get",), url_path="history")
    def history(self, request):
        company_id = request.query_params.get("company_id")
        document_type = request.query_params.get("document_type")
        document_id = request.query_params.get("document_id")

        if not company_id:
            return Response({"company_id": ["Doanh nghiệp là bắt buộc."]}, status=status.HTTP_400_BAD_REQUEST)
        if not document_id:
            return Response({"document_id": ["Mã chứng từ là bắt buộc."]}, status=status.HTTP_400_BAD_REQUEST)

        qs = self.queryset.filter(company_id=company_id, document_id=document_id)
        if document_type:
            qs = qs.filter(document_type=document_type)

        decisions_data = [
            {
                "id": str(d.id),
                "level": d.level,
                "decision": d.decision,
                "decision_name": approval_services.DECISION_NAMES.get(d.decision, d.decision),
                "actor_id": str(d.actor_id),
                "actor_name": approval_services.get_user_display_name(d.actor),
                "comment": d.comment,
                "decided_at": d.decided_at.isoformat(),
                "document_version": d.document_version,
                "workflow_version": d.workflow_version,
            }
            for d in qs.order_by("decided_at")
        ]
        return Response(decisions_data)
