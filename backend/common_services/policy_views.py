from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from organization.models import Company, CompanyStatus

from .models import AccountingPolicy
from .module_views import get_actor_user
from .permissions import CommonCompanyPermission
from .policy_serializers import (
    AccountingPolicyActivateSerializer,
    AccountingPolicyApproveSerializer,
    AccountingPolicyCopySerializer,
    AccountingPolicyCreateSerializer,
    AccountingPolicyDetailSerializer,
    AccountingPolicyNewVersionSerializer,
    AccountingPolicySerializer,
    AccountingPolicyUpdateSerializer,
    PolicyImpactReportSerializer,
    ResolvePolicyRequestSerializer,
)
from .policy_services import (
    activate_accounting_policy,
    analyze_policy_impact,
    approve_accounting_policy,
    copy_policy_template,
    create_accounting_policy,
    create_new_policy_version,
    resolve_effective_policy,
    update_draft_policy,
)


def resolve_company(request, pk=None):
    company_id = (
        request.query_params.get("company_id")
        or request.query_params.get("company")
        or (request.data.get("company") if isinstance(request.data, dict) else None)
        or (request.data.get("company_id") if isinstance(request.data, dict) else None)
    )
    if not company_id and pk:
        company_id = AccountingPolicy.objects.filter(pk=pk).values_list("company_id", flat=True).first()
    if not company_id and hasattr(request.user, "iam_account"):
        company_id = request.user.iam_account.memberships.filter(membership_status="ACTIVE").values_list("company_id", flat=True).first()

    if not company_id:
        raise ValidationError({"company": "Tham số doanh nghiệp (company hoặc company_id) là bắt buộc."})
    try:
        company = Company.objects.get(pk=company_id)
    except (Company.DoesNotExist, ValueError):
        raise ValidationError({"company": "Doanh nghiệp không tồn tại."})
    if company.status == CompanyStatus.INACTIVE:
        raise ValidationError({"company": "Doanh nghiệp hiện đang ngừng hoạt động."})
    return company


def get_policy_or_404(pk, company=None):
    qs = AccountingPolicy.objects.all()
    if company:
        qs = qs.filter(company=company)
    policy = qs.filter(pk=pk).first()
    if not policy:
        raise NotFound("Không tìm thấy chính sách kế toán tương ứng.")
    return policy


class AccountingPolicyListView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.POLICY.VIEW", "POST": "SYS.POLICY.CONFIGURE"}

    def get(self, request):
        company = resolve_company(request)
        qs = AccountingPolicy.objects.filter(company=company).select_related(
            "branch", "effective_from_period", "effective_to_period", "accounting_currency"
        ).order_by("-created_at")

        if st := request.query_params.get("status"):
            qs = qs.filter(status=st)
        if sc := request.query_params.get("scope"):
            qs = qs.filter(scope=sc)
        if reg := request.query_params.get("accounting_regime"):
            qs = qs.filter(accounting_regime=reg)
        if br := request.query_params.get("branch"):
            qs = qs.filter(branch_id=br)
        if q := request.query_params.get("q"):
            qs = qs.filter(code__icontains=q) | qs.filter(name__icontains=q)

        serializer = AccountingPolicySerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        company = resolve_company(request)
        actor = get_actor_user(request)
        serializer = AccountingPolicyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        policy = create_accounting_policy(company, serializer.validated_data, actor)
        return Response(AccountingPolicyDetailSerializer(policy).data, status=status.HTTP_201_CREATED)


class AccountingPolicyDetailView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {
        "GET": "SYS.POLICY.VIEW",
        "PATCH": "SYS.POLICY.CONFIGURE",
        "PUT": "SYS.POLICY.CONFIGURE",
    }

    def get(self, request, pk):
        company = resolve_company(request, pk=pk)
        policy = get_policy_or_404(pk, company)
        return Response(AccountingPolicyDetailSerializer(policy).data)

    def patch(self, request, pk):
        company = resolve_company(request, pk=pk)
        actor = get_actor_user(request)
        policy = get_policy_or_404(pk, company)

        serializer = AccountingPolicyUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated_policy = update_draft_policy(policy, serializer.validated_data, actor)
        return Response(AccountingPolicyDetailSerializer(updated_policy).data)

    def put(self, request, pk):
        return self.patch(request, pk)


class AccountingPolicyImpactView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.POLICY.VIEW", "POST": "SYS.POLICY.VIEW"}

    def get(self, request, pk):
        company = resolve_company(request, pk=pk)
        policy = get_policy_or_404(pk, company)
        impact = analyze_policy_impact(policy)
        serializer = PolicyImpactReportSerializer(impact)
        return Response(serializer.data)

    def post(self, request, pk):
        company = resolve_company(request, pk=pk)
        policy = get_policy_or_404(pk, company)
        impact = analyze_policy_impact(policy, proposed_data=request.data)
        serializer = PolicyImpactReportSerializer(impact)
        return Response(serializer.data)


class AccountingPolicyActivateView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.POLICY.CONFIGURE"}

    def post(self, request, pk):
        company = resolve_company(request, pk=pk)
        actor = get_actor_user(request)
        policy = get_policy_or_404(pk, company)

        serializer = AccountingPolicyActivateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        require_app = serializer.validated_data.get("require_approval", False)
        skip_app = serializer.validated_data.get("skip_approval", False)

        activated_policy = activate_accounting_policy(
            policy=policy,
            actor=actor,
            require_approval=require_app,
            skip_approval=skip_app,
        )
        return Response(AccountingPolicyDetailSerializer(activated_policy).data)


class AccountingPolicyApproveView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.POLICY.APPROVE"}

    def post(self, request, pk):
        company = resolve_company(request, pk=pk)
        actor = get_actor_user(request)
        policy = get_policy_or_404(pk, company)

        serializer = AccountingPolicyApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        approved = serializer.validated_data.get("approved", True)
        notes = serializer.validated_data.get("notes", "")

        result = approve_accounting_policy(
            policy=policy,
            actor=actor,
            approved=approved,
            notes=notes,
        )
        return Response(AccountingPolicyDetailSerializer(result).data)


class AccountingPolicyNewVersionView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.POLICY.CONFIGURE"}

    def post(self, request, pk):
        company = resolve_company(request, pk=pk)
        actor = get_actor_user(request)
        policy = get_policy_or_404(pk, company)

        serializer = AccountingPolicyNewVersionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get("change_reason", "")
        new_version = create_new_policy_version(policy, actor, change_reason=reason)
        return Response(AccountingPolicyDetailSerializer(new_version).data, status=status.HTTP_201_CREATED)


class AccountingPolicyCopyView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.POLICY.CONFIGURE"}

    def post(self, request, pk):
        company = resolve_company(request, pk=pk)
        actor = get_actor_user(request)
        policy = get_policy_or_404(pk, company)

        serializer = AccountingPolicyCopySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        copied = copy_policy_template(
            source_policy=policy,
            new_code=serializer.validated_data["new_code"],
            new_name=serializer.validated_data["new_name"],
            effective_from_period=serializer.validated_data["effective_from_period"],
            actor=actor,
        )
        return Response(AccountingPolicyDetailSerializer(copied).data, status=status.HTTP_201_CREATED)


class ResolveEffectivePolicyView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.POLICY.VIEW", "POST": "SYS.POLICY.VIEW"}

    def get(self, request):
        company = resolve_company(request)
        serializer = ResolvePolicyRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        target_date = serializer.validated_data.get("target_date")
        period = serializer.validated_data.get("period")
        branch = serializer.validated_data.get("branch")

        resolved = resolve_effective_policy(
            company=company,
            target_date=target_date,
            period=period,
            branch=branch,
        )

        return Response({
            "policy_id": str(resolved.policy.id),
            "policy_code": resolved.policy.code,
            "policy_name": resolved.policy.name,
            "version": resolved.policy.version,
            "scope": resolved.policy.scope,
            "branch_override_policy_id": str(resolved.branch_policy.id) if resolved.branch_policy else None,
            "accounting_regime": resolved.accounting_regime,
            "accounting_basis": resolved.accounting_basis,
            "accounting_currency": resolved.accounting_currency.code if resolved.accounting_currency else None,
            "allow_multi_currency": resolved.allow_multi_currency,
            "inventory_accounting": resolved.inventory_accounting,
            "inventory_valuation": resolved.inventory_valuation,
            "depreciation_method": resolved.depreciation_method,
            "allocation_method": resolved.allocation_method,
            "posting_mode": resolved.posting_mode,
            "tax_method": resolved.tax_method,
            "debt_tracking": resolved.debt_tracking,
            "amount_decimals": resolved.amount_decimals,
            "unit_price_decimals": resolved.unit_price_decimals,
            "quantity_decimals": resolved.quantity_decimals,
            "exchange_rate_decimals": resolved.exchange_rate_decimals,
            "rounding_method": resolved.rounding_method,
        })

    def post(self, request):
        company = resolve_company(request)
        serializer = ResolvePolicyRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_date = serializer.validated_data.get("target_date")
        period = serializer.validated_data.get("period")
        branch = serializer.validated_data.get("branch")

        resolved = resolve_effective_policy(
            company=company,
            target_date=target_date,
            period=period,
            branch=branch,
        )

        return Response({
            "policy_id": str(resolved.policy.id),
            "policy_code": resolved.policy.code,
            "policy_name": resolved.policy.name,
            "version": resolved.policy.version,
            "scope": resolved.policy.scope,
            "branch_override_policy_id": str(resolved.branch_policy.id) if resolved.branch_policy else None,
            "accounting_regime": resolved.accounting_regime,
            "accounting_basis": resolved.accounting_basis,
            "accounting_currency": resolved.accounting_currency.code if resolved.accounting_currency else None,
            "allow_multi_currency": resolved.allow_multi_currency,
            "inventory_accounting": resolved.inventory_accounting,
            "inventory_valuation": resolved.inventory_valuation,
            "depreciation_method": resolved.depreciation_method,
            "allocation_method": resolved.allocation_method,
            "posting_mode": resolved.posting_mode,
            "tax_method": resolved.tax_method,
            "debt_tracking": resolved.debt_tracking,
            "amount_decimals": resolved.amount_decimals,
            "unit_price_decimals": resolved.unit_price_decimals,
            "quantity_decimals": resolved.quantity_decimals,
            "exchange_rate_decimals": resolved.exchange_rate_decimals,
            "rounding_method": resolved.rounding_method,
        })
