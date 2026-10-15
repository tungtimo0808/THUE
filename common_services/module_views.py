from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from organization.models import Company, CompanyStatus

from .module_serializers import (
    CompanyModuleItemSerializer,
    ModuleConfigUpdateRequestSerializer,
    ModuleDetailSerializer,
    ModuleDisableRequestSerializer,
    ModuleEnableRequestSerializer,
    ModuleImpactSerializer,
)
from .module_services import (
    disable_module,
    enable_module,
    get_module_detail,
    list_modules,
    module_impact_summary,
    update_module_config,
)
from .permissions import CommonCompanyPermission


def resolve_company(request):
    company_id = (
        request.query_params.get("company_id")
        or request.query_params.get("company")
        or (request.data.get("company") if isinstance(request.data, dict) else None)
        or (request.data.get("company_id") if isinstance(request.data, dict) else None)
    )
    if not company_id:
        raise ValidationError({"company": "Tham số doanh nghiệp (company hoặc company_id) là bắt buộc."})
    try:
        company = Company.objects.get(pk=company_id)
    except (Company.DoesNotExist, ValueError):
        raise ValidationError({"company": "Doanh nghiệp không tồn tại."})
    if company.status == CompanyStatus.INACTIVE:
        raise ValidationError({"company": "Doanh nghiệp hiện đang ngừng hoạt động."})
    return company


def get_actor_user(request):
    if hasattr(request.user, "iam_account"):
        return request.user.iam_account
    from iam.models import UserAccount
    account, _ = UserAccount.objects.get_or_create(
        auth_user=request.user,
        defaults={"display_name": getattr(request.user, "username", "Admin")},
    )
    return account


class ModuleCatalogListView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.MODULE.VIEW"}

    def get(self, request):
        company = resolve_company(request)
        modules = list_modules(company)
        serializer = CompanyModuleItemSerializer(modules, many=True)
        return Response(serializer.data)


class ModuleDetailView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.MODULE.VIEW"}

    def get(self, request, module_code):
        company = resolve_company(request)
        detail = get_module_detail(company, module_code.upper())
        serializer = ModuleDetailSerializer(detail)
        return Response(serializer.data)


class ModuleImpactView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.MODULE.VIEW"}

    def get(self, request, module_code):
        company = resolve_company(request)
        impact = module_impact_summary(company, module_code.upper())
        serializer = ModuleImpactSerializer(impact)
        return Response(serializer.data)


class ModuleEnableView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.MODULE.CONFIGURE"}

    def post(self, request, module_code):
        company = resolve_company(request)
        actor = get_actor_user(request)
        serializer = ModuleEnableRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        config = enable_module(
            company=company,
            module_code=module_code.upper(),
            actor=actor,
            effective_from=serializer.validated_data.get("effective_from"),
            configuration=serializer.validated_data.get("configuration"),
            notes=serializer.validated_data.get("notes", ""),
            version=serializer.validated_data.get("version"),
        )
        detail = get_module_detail(company, module_code.upper())
        return Response({
            "detail": "Kích hoạt phân hệ thành công.",
            "data": ModuleDetailSerializer(detail).data,
        }, status=status.HTTP_200_OK)


class ModuleDisableView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.MODULE.CONFIGURE"}

    def post(self, request, module_code):
        company = resolve_company(request)
        actor = get_actor_user(request)
        serializer = ModuleDisableRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        config = disable_module(
            company=company,
            module_code=module_code.upper(),
            actor=actor,
            reason=serializer.validated_data["reason"],
            effective_to=serializer.validated_data.get("effective_to"),
            notes=serializer.validated_data.get("notes", ""),
            force=serializer.validated_data.get("force", False),
            version=serializer.validated_data.get("version"),
        )
        detail = get_module_detail(company, module_code.upper())
        return Response({
            "detail": "Ngừng sử dụng phân hệ thành công.",
            "data": ModuleDetailSerializer(detail).data,
        }, status=status.HTTP_200_OK)


class ModuleConfigUpdateView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"PATCH": "SYS.MODULE.CONFIGURE"}

    def patch(self, request, module_code):
        company = resolve_company(request)
        actor = get_actor_user(request)
        serializer = ModuleConfigUpdateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        config = update_module_config(
            company=company,
            module_code=module_code.upper(),
            actor=actor,
            configuration=serializer.validated_data.get("configuration"),
            notes=serializer.validated_data.get("notes"),
            version=serializer.validated_data.get("version"),
        )
        detail = get_module_detail(company, module_code.upper())
        return Response({
            "detail": "Cập nhật cấu hình phân hệ thành công.",
            "data": ModuleDetailSerializer(detail).data,
        }, status=status.HTTP_200_OK)
