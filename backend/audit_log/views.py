from datetime import datetime

from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from iam.permissions import HasIamPermission, has_effective_permission
from organization.models import Company, CompanyStatus

from .models import AuditLog
from .serializers import AuditLogExportRequestSerializer, AuditLogSerializer
from .services import (
    export_audit_logs_data,
    generate_audit_ai_summary,
    validate_and_filter_audit_logs,
)


def resolve_company(request, pk=None):
    company_id = (
        request.query_params.get("company_id")
        or request.query_params.get("company")
        or (request.data.get("company") if isinstance(request.data, dict) else None)
        or (request.data.get("company_id") if isinstance(request.data, dict) else None)
    )
    if not company_id and pk:
        company_id = AuditLog.objects.filter(pk=pk).values_list("company_id", flat=True).first()
    if not company_id and hasattr(request.user, "iam_account"):
        company_id = request.user.iam_account.memberships.filter(
            membership_status="ACTIVE"
        ).values_list("company_id", flat=True).first()

    if not company_id:
        raise ValidationError({"company": "Tham số doanh nghiệp (company hoặc company_id) là bắt buộc."})
    try:
        company = Company.objects.get(pk=company_id)
    except (Company.DoesNotExist, ValueError):
        raise ValidationError({"company": "Doanh nghiệp không tồn tại."})
    if company.status == CompanyStatus.INACTIVE:
        raise ValidationError({"company": "Doanh nghiệp hiện đang ngừng hoạt động."})
    return company


class AuditLogViewSet(ReadOnlyModelViewSet):
    """
    API ViewSet for querying, inspecting, exporting, and verifying Audit Logs (UC-SYS-16).
    Enforces append-only immutability, date limits, data scopes, and sensitive masking.
    """
    serializer_class = AuditLogSerializer
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "SYS.AUDIT.VIEW"}
    action_permissions = {
        "list": "SYS.AUDIT.VIEW",
        "retrieve": "SYS.AUDIT.VIEW",
        "export": "SYS.AUDIT.EXPORT",
        "record_history": "SYS.AUDIT.VIEW",
        "correlation": "SYS.AUDIT.VIEW",
        "ai_summary": "SYS.AUDIT.VIEW",
        "verify_integrity": "SYS.AUDIT.VIEW",
        "verify_batch": "SYS.AUDIT.VIEW",
    }
    allow_scoped_list_permission = True

    def perform_content_negotiation(self, request, force=False):
        if getattr(self, "action", None) == "export":
            from rest_framework.renderers import JSONRenderer
            return JSONRenderer(), "application/json"
        return super().perform_content_negotiation(request, force=force)

    def get_queryset(self):
        company = resolve_company(self.request)
        actor_account = getattr(self.request.user, "iam_account", None)
        return validate_and_filter_audit_logs(
            company=company,
            user_account=actor_account,
            params=self.request.query_params,
        )

    def retrieve(self, request, *args, **kwargs):
        company = resolve_company(request, pk=kwargs.get("pk"))
        instance = self.get_object()
        if instance.company_id != company.id:
            raise NotFound("Không tìm thấy bản ghi Audit Log tương ứng trong doanh nghiệp.")
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=["get", "post"], url_path="export")
    def export(self, request):
        """Export audit logs to JSON or CSV format (Section 2.3, BR-AUD-28, 37..40)."""
        company = resolve_company(request)
        actor_account = getattr(request.user, "iam_account", None)

        # Enforce SYS.AUDIT.EXPORT permission explicitly (BR-AUD-02, 05, 37)
        if not request.user.is_superuser and not has_effective_permission(actor_account, company, "SYS.AUDIT.EXPORT"):
            raise PermissionDenied("Bạn không có quyền xuất dữ liệu Audit Log (SYS.AUDIT.EXPORT) (EF-01, BR-AUD-02).")

        params = request.data if request.method == "POST" else request.query_params
        serializer = AuditLogExportRequestSerializer(data=params)
        serializer.is_valid(raise_exception=True)

        qs = validate_and_filter_audit_logs(company=company, user_account=actor_account, params=params)
        export_fmt = serializer.validated_data.get("format", "json")

        content, content_type = export_audit_logs_data(
            queryset=qs,
            export_format=export_fmt,
            actor_user=actor_account,
            request=request,
            company=company,
        )

        filename = f"audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{export_fmt}"
        response = HttpResponse(content, content_type=f"{content_type}; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=["get"], url_path="record-history")
    def record_history(self, request):
        """View audit history for a specific business entity (Section 2.2)."""
        company = resolve_company(request)
        actor_account = getattr(request.user, "iam_account", None)

        entity_type = request.query_params.get("entity_type")
        entity_id = request.query_params.get("entity_id")
        resource_code = request.query_params.get("resource_code")

        if not (entity_type and entity_id) and not resource_code:
            raise ValidationError("Cần cung cấp (entity_type + entity_id) hoặc resource_code để tra cứu lịch sử bản ghi.")

        qs = validate_and_filter_audit_logs(
            company=company,
            user_account=actor_account,
            params=request.query_params,
        )
        if entity_type and entity_id:
            qs = qs.filter(entity_type__icontains=entity_type, entity_id=entity_id)
        elif resource_code:
            qs = qs.filter(resource_code=resource_code)

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="correlation")
    def correlation(self, request):
        """View complete sequence of events linked by Correlation ID (AF-07, BR-AUD-30)."""
        company = resolve_company(request)
        actor_account = getattr(request.user, "iam_account", None)

        corr_id = request.query_params.get("correlation_id")
        if not corr_id:
            raise ValidationError({"correlation_id": "Tham số correlation_id là bắt buộc."})

        qs = validate_and_filter_audit_logs(
            company=company,
            user_account=actor_account,
            params={"correlation_id": corr_id},
        ).order_by("occurred_at")

        serializer = self.get_serializer(qs, many=True)
        return Response({
            "correlation_id": corr_id,
            "total_events": qs.count(),
            "events": serializer.data,
        })

    @action(detail=False, methods=["get", "post"], url_path="ai-summary")
    def ai_summary(self, request):
        """Summarize audit activity and detect potential security anomalies (AF-13, BR-AUD-50..52)."""
        company = resolve_company(request)
        actor_account = getattr(request.user, "iam_account", None)

        params = request.data if request.method == "POST" else request.query_params
        qs = validate_and_filter_audit_logs(company=company, user_account=actor_account, params=params)

        summary_data = generate_audit_ai_summary(qs)
        return Response(summary_data)

    @action(detail=True, methods=["get", "post"], url_path="verify-integrity")
    def verify_integrity(self, request, pk=None):
        """Verify the integrity hash of an audit log record (BR-AUD-44, 45, EF-14)."""
        instance = self.get_object()
        is_valid, msg = instance.verify_integrity()
        return Response({
            "audit_id": str(instance.id),
            "is_valid": is_valid,
            "stored_hash": instance.integrity_hash,
            "expected_hash": instance.compute_integrity_hash(),
            "message": msg,
        }, status=status.HTTP_200_OK if is_valid else status.HTTP_409_CONFLICT)

    @action(detail=False, methods=["post"], url_path="verify-batch")
    def verify_batch(self, request):
        """Batch verify integrity across recent audit logs (BR-AUD-44, 45)."""
        company = resolve_company(request)
        actor_account = getattr(request.user, "iam_account", None)
        qs = validate_and_filter_audit_logs(company=company, user_account=actor_account, params=request.data)[:100]

        results = []
        tampered_count = 0
        for log in qs:
            valid, msg = log.verify_integrity()
            if not valid:
                tampered_count += 1
            results.append({
                "audit_id": str(log.id),
                "action_code": log.action_code,
                "is_valid": valid,
                "message": msg,
            })

        return Response({
            "total_verified": len(results),
            "tampered_count": tampered_count,
            "all_valid": tampered_count == 0,
            "details": results,
        }, status=status.HTTP_200_OK if tampered_count == 0 else status.HTTP_409_CONFLICT)
