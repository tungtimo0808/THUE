from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from organization.models import Company
from . import models, services, contract_services, contract_serializers
from .permissions import SalesPermission


class SalesContractViewSet(viewsets.ModelViewSet):
    permission_classes = (SalesPermission,)
    iam_permissions = {
        "GET": "SAL.CONTRACT.VIEW",
        "POST": "SAL.CONTRACT.CREATE",
        "PUT": "SAL.CONTRACT.EDIT",
        "PATCH": "SAL.CONTRACT.EDIT",
        "DELETE": "SAL.CONTRACT.EDIT",
    }
    action_permissions = {
        "submit": "SAL.CONTRACT.SUBMIT",
        "approve": "SAL.CONTRACT.APPROVE",
        "reject": "SAL.CONTRACT.REJECT",
        "revoke": "SAL.CONTRACT.SUBMIT",
        "return_to_draft": "SAL.CONTRACT.EDIT",
        "sign": "SAL.CONTRACT.SIGN",
        "liquidate": "SAL.CONTRACT.LIQUIDATE",
        "terminate": "SAL.CONTRACT.TERMINATE",
        "cancel": "SAL.CONTRACT.CANCEL",
        "open_transactions": "SAL.CONTRACT.VIEW",
        "create_annex": "SAL.CONTRACT.ANNEX",
        "sign_annex": "SAL.CONTRACT.ANNEX",
        "annexes": "SAL.CONTRACT.VIEW",
        "prepare_order": "SAL.CONTRACT.VIEW",
        "from_quotation": "SAL.CONTRACT.CREATE",
        "allocations": "SAL.CONTRACT.VIEW",
        "extend": "SAL.CONTRACT.EXTEND",
    }
    permission_denied_message = "Bạn không có quyền quản lý hợp đồng bán hàng."

    def get_serializer_class(self):
        if self.action == "list":
            return contract_serializers.SalesContractListSerializer
        return contract_serializers.SalesContractDetailSerializer

    def get_company(self):
        company_id = (
            self.request.query_params.get("company_id")
            or (self.request.data.get("company") if isinstance(self.request.data, dict) else None)
            or (self.request.data.get("company_id") if isinstance(self.request.data, dict) else None)
        )
        if not company_id and self.kwargs.get("pk"):
            contract = models.SalesContract.objects.filter(pk=self.kwargs["pk"]).first()
            if contract:
                return contract.company
        if not company_id:
            raise ValidationError({"company_id": "Mã doanh nghiệp là bắt buộc."})
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise ValidationError({"company_id": "Doanh nghiệp không tồn tại."})
        return company

    def get_queryset(self):
        company_id = self.request.query_params.get("company_id")
        if not company_id:
            return models.SalesContract.objects.none()

        qs = (
            models.SalesContract.objects.filter(company_id=company_id)
            .select_related(
                "company",
                "branch",
                "customer",
                "currency",
                "assigned_employee",
                "company_signer",
                "created_by",
            )
            .prefetch_related(
                "lines__item",
                "lines__uom",
                "lines__tax_rate",
                "annexes",
                "orders",
            )
            .order_by("-document_date", "-created_at")
        )

        if customer_id := self.request.query_params.get("customer_id"):
            qs = qs.filter(customer_id=customer_id)
        if doc_status := self.request.query_params.get("status"):
            qs = qs.filter(status=doc_status)
        if emp_id := self.request.query_params.get("assigned_employee_id"):
            qs = qs.filter(assigned_employee_id=emp_id)
        if value_type := self.request.query_params.get("value_type"):
            qs = qs.filter(value_type=value_type)
        if search := self.request.query_params.get("search"):
            qs = qs.filter(
                models.Q(contract_number__icontains=search)
                | models.Q(number__icontains=search)
                | models.Q(title__icontains=search)
                | models.Q(customer__name__icontains=search)
            )

        # Validity filter
        if validity_param := self.request.query_params.get("validity"):
            matching_ids = [
                c.id for c in qs if contract_services.get_contract_validity(c) == validity_param
            ]
            qs = qs.filter(id__in=matching_ids)

        return qs

    def create(self, request, *args, **kwargs):
        company = self.get_company()
        contract = contract_services.save_contract(request, company, request.data)
        serializer = contract_serializers.SalesContractDetailSerializer(contract)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        contract = self.get_object()
        company = contract.company
        contract = contract_services.save_contract(request, company, request.data, instance=contract)
        serializer = contract_serializers.SalesContractDetailSerializer(contract)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        contract = self.get_object()
        contract_services.delete_contract(request, contract)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        contract = self.get_object()
        contract = contract_services.submit_contract(request, contract)
        return Response(contract_serializers.SalesContractDetailSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        contract = self.get_object()
        contract = services.decide(contract, request, approved=True)
        return Response(contract_serializers.SalesContractDetailSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        contract = self.get_object()
        contract = services.decide(contract, request, approved=False)
        return Response(contract_serializers.SalesContractDetailSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        contract = self.get_object()
        serializer = contract_serializers.SalesContractRevokeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contract = contract_services.revoke_contract_submission(
            request, contract, reason=serializer.validated_data.get("reason", "")
        )
        return Response(contract_serializers.SalesContractDetailSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def return_to_draft(self, request, pk=None):
        contract = self.get_object()
        contract = contract_services.return_contract_to_draft(request, contract)
        return Response(contract_serializers.SalesContractDetailSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def sign(self, request, pk=None):
        contract = self.get_object()
        serializer = contract_serializers.SalesContractSignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contract = contract_services.sign_contract(
            request,
            contract,
            signed_date=serializer.validated_data["signed_date"],
            signed_file=serializer.validated_data["signed_file"],
        )
        return Response(contract_serializers.SalesContractDetailSerializer(contract).data)

    @action(detail=True, methods=["get"])
    def open_transactions(self, request, pk=None):
        contract = self.get_object()
        return Response(contract_services.get_open_transactions(contract))

    @action(detail=True, methods=["post"])
    def liquidate(self, request, pk=None):
        contract = self.get_object()
        serializer = contract_serializers.SalesContractLiquidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contract = contract_services.liquidate_contract(
            request,
            contract,
            liquidation_date=serializer.validated_data.get("liquidation_date"),
            reason=serializer.validated_data["reason"],
            liquidation_file=serializer.validated_data.get("liquidation_file"),
            open_settlement_notes=serializer.validated_data.get("open_settlement_notes", ""),
        )
        return Response(contract_serializers.SalesContractDetailSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def terminate(self, request, pk=None):
        contract = self.get_object()
        serializer = contract_serializers.SalesContractTerminateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contract = contract_services.terminate_contract(
            request,
            contract,
            reason=serializer.validated_data["reason"],
            open_settlement_notes=serializer.validated_data.get("open_settlement_notes", ""),
        )
        return Response(contract_serializers.SalesContractDetailSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def extend(self, request, pk=None):
        contract = self.get_object()
        contract = services.extend_contract(contract, request)
        return Response(contract_serializers.SalesContractDetailSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        contract = self.get_object()
        serializer = contract_serializers.SalesContractCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contract = contract_services.cancel_contract(
            request, contract, reason=serializer.validated_data["reason"]
        )
        return Response(contract_serializers.SalesContractDetailSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def create_annex(self, request, pk=None):
        contract = self.get_object()
        serializer = contract_serializers.SalesContractAnnexCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        annex = contract_services.create_annex(request, contract, serializer.validated_data)
        return Response(
            contract_serializers.SalesContractAnnexSerializer(annex).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="annexes/(?P<annex_id>[^/.]+)/sign")
    def sign_annex(self, request, pk=None, annex_id=None):
        contract = self.get_object()
        annex = contract.annexes.filter(pk=annex_id).first()
        if not annex:
            raise ValidationError("Phụ lục hợp đồng không tồn tại.")
        serializer = contract_serializers.SalesContractAnnexSignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        annex = contract_services.sign_annex(
            request,
            annex,
            signed_date=serializer.validated_data.get("signed_date"),
            effective_date=serializer.validated_data["effective_date"],
            signed_file=serializer.validated_data["signed_file"],
        )
        return Response(contract_serializers.SalesContractAnnexSerializer(annex).data)

    @action(detail=True, methods=["get"])
    def annexes(self, request, pk=None):
        contract = self.get_object()
        return Response(
            contract_serializers.SalesContractAnnexSerializer(contract.annexes.all(), many=True).data
        )

    @action(detail=True, methods=["get", "post"])
    def prepare_order(self, request, pk=None):
        contract = self.get_object()
        payload = contract_services.prepare_order_from_contract(contract)
        return Response(payload)

    @action(detail=False, methods=["post"], url_path="from_quotation")
    def from_quotation(self, request):
        company = self.get_company()
        serializer = contract_serializers.SalesContractFromQuotationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contract = contract_services.create_from_quotation(
            request,
            company,
            quotation_id=serializer.validated_data["quotation_id"],
            extra_data=serializer.validated_data,
        )
        return Response(
            contract_serializers.SalesContractDetailSerializer(contract).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"])
    def allocations(self, request, pk=None):
        contract = self.get_object()
        return Response(contract_services.calculate_contract_allocations(contract))
