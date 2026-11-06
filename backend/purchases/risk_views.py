from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from iam.permissions import has_effective_permission
from master_data.models import Party
from organization.models import Company
from purchases import models, risk_serializers, risk_services
from purchases.permissions import PurchasePermission


class SupplierRiskViewSet(viewsets.ViewSet):
    """
    UC-PUR-14: Kiểm tra rủi ro nhà cung cấp.
    Evaluates supplier risks, tracks legal & historical transaction factors,
    enforces pre-transaction restrictions and overrides.
    """
    permission_classes = (PurchasePermission,)
    action_permissions = {
        "list": "PUR.SUPPLIER_RISK.VIEW",
        "retrieve": "PUR.SUPPLIER_RISK.VIEW",
        "check": "PUR.SUPPLIER_RISK.CHECK",
        "recheck": "PUR.SUPPLIER_RISK.CHECK",
        "check_transaction": "PUR.SUPPLIER_RISK.CHECK_TX",
        "override": "PUR.SUPPLIER_RISK.OVERRIDE",
        "get_config": "PUR.SUPPLIER_RISK.VIEW",
        "update_config": "PUR.SUPPLIER_RISK.CONFIG",
        "list_incidents": "PUR.SUPPLIER_RISK.VIEW",
        "create_incident": "PUR.SUPPLIER_RISK.INCIDENT",
        "resolve_incident": "PUR.SUPPLIER_RISK.INCIDENT",
    }

    def get_company(self):
        company_id = (
            self.request.query_params.get("company_id")
            or self.request.data.get("company")
            or (self.request.data.get("company_id") if isinstance(self.request.data, dict) else None)
        )
        if not company_id and self.kwargs.get("pk"):
            supplier = Party.objects.filter(pk=self.kwargs["pk"]).first()
            if supplier:
                return supplier.company
        if not company_id:
            raise ValidationError("Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên.")
        try:
            return Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError("Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên.")

    def list(self, request):
        """
        Activity Flow Step 1-3:
        List suppliers in user's company scope with latest risk assessment status.
        Supports searching by code, name, or tax code.
        """
        company = self.get_company()
        search_query = request.query_params.get("q") or request.query_params.get("search")

        qs = Party.objects.filter(company=company)
        if search_query:
            clean_q = search_query.strip()
            qs = qs.filter(
                Q(code__icontains=clean_q)
                | Q(name__icontains=clean_q)
                | Q(tax_code__icontains=clean_q)
            )

        now = timezone.now()
        results = []
        for supplier in qs:
            latest = (
                models.SupplierRiskAssessment.objects.filter(
                    company=company,
                    supplier=supplier,
                )
                .order_by("-version", "-created_at")
                .first()
            )
            assessor_name = ""
            if latest and latest.assessed_by and hasattr(latest.assessed_by, "user"):
                assessor_name = latest.assessed_by.user.get_full_name() or latest.assessed_by.user.username

            results.append({
                "supplier_id": supplier.id,
                "supplier_code": supplier.code,
                "supplier_name": supplier.name,
                "tax_code": supplier.tax_code or "",
                "operating_status": supplier.get_status_display(),
                "status_code": supplier.status,
                "latest_risk_level": latest.risk_level if latest else None,
                "latest_risk_level_display": latest.get_risk_level_display() if latest else None,
                "latest_score": latest.score if latest else None,
                "latest_check_date": latest.created_at if latest else None,
                "valid_until": latest.valid_until if latest else None,
                "is_valid": (latest.valid_until >= now) if latest else False,
                "assessor": assessor_name,
            })

        return Response({"count": len(results), "results": results})

    def retrieve(self, request, pk=None):
        """
        Activity Flow Step 4:
        Show supplier information, latest check result, and assessment history.
        """
        company = self.get_company()
        supplier = Party.objects.filter(pk=pk, company=company).first()
        if not supplier:
            return Response({"detail": "Không tìm thấy nhà cung cấp."}, status=status.HTTP_404_NOT_FOUND)

        assessments = models.SupplierRiskAssessment.objects.filter(
            company=company,
            supplier=supplier,
        ).order_by("-version", "-created_at")

        latest = assessments.first()
        latest_data = (
            risk_serializers.SupplierRiskAssessmentSerializer(latest).data
            if latest
            else None
        )
        history_data = risk_serializers.SupplierRiskAssessmentSerializer(
            assessments, many=True
        ).data

        return Response({
            "supplier": {
                "id": supplier.id,
                "code": supplier.code,
                "name": supplier.name,
                "tax_code": supplier.tax_code or "",
                "status": supplier.status,
                "status_display": supplier.get_status_display(),
            },
            "latest_assessment": latest_data,
            "history": history_data,
        })

    @action(detail=False, methods=["post"], url_path="check")
    def check(self, request):
        """
        Activity Flow Step 5-21:
        Check supplier risk and save result.
        Returns assessment and confirmation message (Step 21).
        """
        company = self.get_company()
        serializer = risk_serializers.RiskCheckInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        supplier_id = serializer.validated_data["supplier_id"]
        supplier = Party.objects.filter(pk=supplier_id, company=company).first()
        if not supplier:
            raise ValidationError("Vui lòng chọn nhà cung cấp.")  # EX01

        notes = serializer.validated_data.get("notes", "")
        external_tax_status = serializer.validated_data.get("external_tax_status")
        simulate_failure = serializer.validated_data.get("simulate_external_failure", False)

        assessment = risk_services.assess_supplier_risk(
            company=company,
            supplier=supplier,
            user=request.user,
            notes=notes,
            external_tax_status=external_tax_status,
            simulate_external_failure=simulate_failure,
        )

        resp_data = risk_serializers.SupplierRiskAssessmentSerializer(assessment).data
        return Response(
            {
                "message": "Lưu kết quả kiểm tra rủi ro nhà cung cấp thành công.",
                "data": resp_data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="recheck")
    def recheck(self, request, pk=None):
        """
        Alternative Flow AF05:
        Re-evaluate supplier risk and save new record without overwriting history (BR02).
        """
        company = self.get_company()
        supplier = Party.objects.filter(pk=pk, company=company).first()
        if not supplier:
            raise ValidationError("Vui lòng chọn nhà cung cấp.")

        notes = request.data.get("notes", "")
        external_tax_status = request.data.get("external_tax_status")
        simulate_failure = request.data.get("simulate_external_failure", False)

        assessment = risk_services.assess_supplier_risk(
            company=company,
            supplier=supplier,
            user=request.user,
            notes=notes,
            external_tax_status=external_tax_status,
            simulate_external_failure=simulate_failure,
        )

        resp_data = risk_serializers.SupplierRiskAssessmentSerializer(assessment).data
        return Response(
            {
                "message": "Lưu kết quả kiểm tra rủi ro nhà cung cấp thành công.",
                "data": resp_data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="check-transaction")
    def check_transaction(self, request):
        """
        Alternative Flows AF01, AF03, AF04 & Exception Flows EX07, EX08:
        Verify transaction eligibility prior to creating contract, PO, or purchase voucher.
        """
        company = self.get_company()
        serializer = risk_serializers.TransactionCheckInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        supplier_id = serializer.validated_data["supplier_id"]
        supplier = Party.objects.filter(pk=supplier_id, company=company).first()
        if not supplier:
            raise ValidationError("Vui lòng chọn nhà cung cấp.")

        document_type = serializer.validated_data["document_type"]
        document_id = serializer.validated_data.get("document_id", "")
        reason = serializer.validated_data.get("reason", "")
        confirm = serializer.validated_data.get("confirm", False)

        result = risk_services.check_transaction_allowed(
            company=company,
            supplier=supplier,
            user=request.user,
            document_type=document_type,
            document_id=document_id,
            reason=reason,
            allow_override=confirm,
        )

        assessment_data = (
            risk_serializers.SupplierRiskAssessmentSerializer(result["assessment"]).data
            if result.get("assessment")
            else None
        )

        return Response({
            "allowed": result["allowed"],
            "status": result["status"],
            "message": result["message"],
            "risk_level": result["risk_level"],
            "assessment": assessment_data,
        })

    @action(detail=False, methods=["post"], url_path="override")
    def override(self, request):
        """
        Record override log when continuing with medium or high risk suppliers (BR19, BR20, BR25).
        """
        company = self.get_company()
        supplier_id = request.data.get("supplier_id")
        reason = request.data.get("reason", "")
        document_type = request.data.get("document_type", "PURCHASE")
        document_id = request.data.get("document_id", "")

        if not supplier_id:
            raise ValidationError("Vui lòng chọn nhà cung cấp.")
        supplier = Party.objects.filter(pk=supplier_id, company=company).first()
        if not supplier:
            raise ValidationError("Vui lòng chọn nhà cung cấp.")
        if not reason or not reason.strip():
            raise ValidationError("Vui lòng nhập lý do tiếp tục giao dịch.")

        assessment = risk_services.get_active_assessment(company, supplier)
        risk_level = assessment.risk_level if assessment else "HIGH"

        # Check permissions for HIGH risk override
        if risk_level == "HIGH":
            has_perm = (
                request.user.is_superuser
                or (
                    hasattr(request.user, "iam_account")
                    and has_effective_permission(request.user.iam_account, company, "PUR.SUPPLIER_RISK.OVERRIDE")
                )
            )
            if not has_perm:
                raise PermissionDenied("Bạn không có quyền cho phép giao dịch với nhà cung cấp rủi ro cao. Vui lòng gửi phê duyệt ngoại lệ.")

        override_log = risk_services.record_risk_override(
            company=company,
            supplier=supplier,
            user=request.user,
            assessment=assessment,
            risk_level=risk_level,
            document_type=document_type,
            document_id=document_id,
            reason=reason.strip(),
            is_exception_approved=True,
            approved_by=request.user,
        )

        return Response(
            risk_serializers.SupplierRiskOverrideLogSerializer(override_log).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get", "put", "patch"], url_path="config")
    def config(self, request):
        """
        Get or update supplier risk configuration (BR04, BR17).
        """
        company = self.get_company()
        config_obj = risk_services.get_or_create_risk_config(company)

        if request.method in ["PUT", "PATCH"]:
            # Check config permission
            if not request.user.is_superuser:
                if not hasattr(request.user, "iam_account") or not has_effective_permission(
                    request.user.iam_account, company, "PUR.SUPPLIER_RISK.CONFIG"
                ):
                    raise PermissionDenied("Bạn không có quyền thực hiện chức năng này.")

            serializer = risk_serializers.SupplierRiskConfigSerializer(
                config_obj, data=request.data, partial=(request.method == "PATCH")
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        serializer = risk_serializers.SupplierRiskConfigSerializer(config_obj)
        return Response(serializer.data)

    @action(detail=False, methods=["get", "post"], url_path="incidents")
    def incidents(self, request):
        """
        List or report supplier incidents/complaints/violations (BR16).
        """
        company = self.get_company()

        if request.method == "POST":
            # Check incident permission
            if not request.user.is_superuser:
                if not hasattr(request.user, "iam_account") or not has_effective_permission(
                    request.user.iam_account, company, "PUR.SUPPLIER_RISK.INCIDENT"
                ):
                    raise PermissionDenied("Bạn không có quyền thực hiện chức năng này.")

            supplier_id = request.data.get("supplier")
            supplier = Party.objects.filter(pk=supplier_id, company=company).first()
            if not supplier:
                raise ValidationError("Vui lòng chọn nhà cung cấp.")

            serializer = risk_serializers.SupplierIncidentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            incident = serializer.save(
                company=company,
                reported_by=request.user.iam_account if hasattr(request.user, "iam_account") else None,
            )
            return Response(
                risk_serializers.SupplierIncidentSerializer(incident).data,
                status=status.HTTP_201_CREATED,
            )

        # GET
        supplier_id = request.query_params.get("supplier_id")
        qs = models.SupplierIncident.objects.filter(company=company)
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        return Response(
            risk_serializers.SupplierIncidentSerializer(qs, many=True).data
        )

    @action(detail=False, methods=["post"], url_path=r"incidents/(?P<incident_id>[^/.]+)/resolve")
    def resolve_incident(self, request, incident_id=None):
        """Resolve an incident."""
        company = self.get_company()
        if not request.user.is_superuser:
            if not hasattr(request.user, "iam_account") or not has_effective_permission(
                request.user.iam_account, company, "PUR.SUPPLIER_RISK.INCIDENT"
            ):
                raise PermissionDenied("Bạn không có quyền thực hiện chức năng này.")

        incident = models.SupplierIncident.objects.filter(pk=incident_id, company=company).first()
        if not incident:
            return Response({"detail": "Không tìm thấy sự cố."}, status=status.HTTP_404_NOT_FOUND)

        incident.status = models.SupplierIncident.Status.RESOLVED
        incident.resolved_at = timezone.now()
        incident.resolved_by = request.user.iam_account if hasattr(request.user, "iam_account") else None
        incident.resolution_notes = request.data.get("resolution_notes", "")
        incident.save()

        return Response(risk_serializers.SupplierIncidentSerializer(incident).data)
