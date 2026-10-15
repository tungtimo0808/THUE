from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from organization.models import Company, CompanyStatus

from .models import (
    FiscalPeriod,
    FiscalPeriodStatus,
    FiscalYear,
    FiscalYearStatus,
)
from .module_views import get_actor_user
from .period_serializers import (
    DeterminePeriodRequestSerializer,
    FiscalPeriodSerializer,
    FiscalPeriodStatusChangeSerializer,
    FiscalYearActivateSerializer,
    FiscalYearCopySerializer,
    FiscalYearCreateSerializer,
    FiscalYearDetailSerializer,
    FiscalYearSerializer,
    FiscalYearUpdateSerializer,
    PreviewPeriodsRequestSerializer,
)
from .period_services import (
    activate_fiscal_year,
    change_period_status,
    close_fiscal_year,
    copy_fiscal_year_structure,
    create_fiscal_year,
    determine_period_for_date,
    generate_suggested_periods,
    update_fiscal_year_draft,
    update_period_metadata,
)
from .permissions import CommonCompanyPermission


def resolve_company(request, pk=None):
    company_id = (
        request.query_params.get("company_id")
        or request.query_params.get("company")
        or (request.data.get("company") if isinstance(request.data, dict) else None)
        or (request.data.get("company_id") if isinstance(request.data, dict) else None)
    )
    if not company_id and pk:
        company_id = (
            FiscalYear.objects.filter(pk=pk).values_list("company_id", flat=True).first()
            or FiscalPeriod.objects.filter(pk=pk).values_list("company_id", flat=True).first()
        )
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


def get_fiscal_year_or_404(pk, company=None):
    qs = FiscalYear.objects.all()
    if company:
        qs = qs.filter(company=company)
    fy = qs.filter(pk=pk).first()
    if not fy:
        raise NotFound("Không tìm thấy năm tài chính tương ứng.")
    return fy


def get_fiscal_period_or_404(pk, company=None):
    qs = FiscalPeriod.objects.all()
    if company:
        qs = qs.filter(company=company)
    period = qs.filter(pk=pk).first()
    if not period:
        raise NotFound("Không tìm thấy kỳ kế toán tương ứng.")
    return period


class FiscalYearListView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.PERIOD.VIEW", "POST": "SYS.PERIOD.CONFIGURE"}

    def get(self, request):
        company = resolve_company(request)
        qs = FiscalYear.objects.filter(company=company).select_related("created_by", "updated_by").prefetch_related("periods")
        if st := request.query_params.get("status"):
            qs = qs.filter(status=st)
        if yt := request.query_params.get("year_type"):
            qs = qs.filter(year_type=yt)
        if q := request.query_params.get("q"):
            qs = qs.filter(code__icontains=q) | qs.filter(name__icontains=q)

        serializer = FiscalYearSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        company = resolve_company(request)
        actor = get_actor_user(request)
        serializer = FiscalYearCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        fy = create_fiscal_year(company, serializer.validated_data, actor)
        return Response(FiscalYearDetailSerializer(fy).data, status=status.HTTP_201_CREATED)


class FiscalYearDetailView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {
        "GET": "SYS.PERIOD.VIEW",
        "PATCH": "SYS.PERIOD.CONFIGURE",
        "PUT": "SYS.PERIOD.CONFIGURE",
        "DELETE": "SYS.PERIOD.CONFIGURE",
    }

    def get(self, request, pk):
        company = resolve_company(request, pk=pk)
        fy = get_fiscal_year_or_404(pk, company)
        return Response(FiscalYearDetailSerializer(fy).data)

    def patch(self, request, pk):
        company = resolve_company(request, pk=pk)
        actor = get_actor_user(request)
        fy = get_fiscal_year_or_404(pk, company)

        serializer = FiscalYearUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated_fy = update_fiscal_year_draft(fy, serializer.validated_data, actor)
        return Response(FiscalYearDetailSerializer(updated_fy).data)

    def put(self, request, pk):
        return self.patch(request, pk)

    def delete(self, request, pk):
        company = resolve_company(request, pk=pk)
        fy = get_fiscal_year_or_404(pk, company)

        if fy.status != FiscalYearStatus.DRAFT:
            raise ValidationError("Chỉ có thể xóa năm tài chính ở trạng thái DRAFT. Năm tài chính đã kích hoạt không được xóa cứng (BR-PERIOD-29).")

        fy.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FiscalYearActivateView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.PERIOD.CONFIGURE"}

    def post(self, request, pk):
        company = resolve_company(request, pk=pk)
        actor = get_actor_user(request)
        fy = get_fiscal_year_or_404(pk, company)

        serializer = FiscalYearActivateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        activated_fy = activate_fiscal_year(
            fy,
            actor,
            open_first_period=serializer.validated_data.get("open_first_period", False),
            open_current_period=serializer.validated_data.get("open_current_period", False),
        )
        return Response({
            "detail": "Kích hoạt năm tài chính thành công.",
            "data": FiscalYearDetailSerializer(activated_fy).data,
        })


class FiscalYearCloseView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.PERIOD.CONFIGURE"}

    def post(self, request, pk):
        company = resolve_company(request, pk=pk)
        actor = get_actor_user(request)
        fy = get_fiscal_year_or_404(pk, company)

        closed_fy = close_fiscal_year(fy, actor)
        return Response({
            "detail": "Đóng năm tài chính thành công.",
            "data": FiscalYearDetailSerializer(closed_fy).data,
        })


class FiscalYearCopyView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.PERIOD.CONFIGURE"}

    def post(self, request, pk):
        company = resolve_company(request, pk=pk)
        actor = get_actor_user(request)
        source_fy = get_fiscal_year_or_404(pk, company)

        serializer = FiscalYearCopySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        copied_fy = copy_fiscal_year_structure(
            source_fiscal_year=source_fy,
            new_code=serializer.validated_data["code"],
            new_name=serializer.validated_data["name"],
            new_start_date=serializer.validated_data["start_date"],
            new_end_date=serializer.validated_data["end_date"],
            actor=actor,
        )
        return Response(FiscalYearDetailSerializer(copied_fy).data, status=status.HTTP_201_CREATED)


class FiscalYearPreviewPeriodsView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.PERIOD.VIEW"}

    def post(self, request):
        serializer = PreviewPeriodsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        suggested = generate_suggested_periods(
            year_type=data["year_type"],
            start_date=data["start_date"],
            end_date=data["end_date"],
            period_structure=data["period_structure"],
            has_adjustment_period=data.get("has_adjustment_period", False),
            code_prefix=data.get("code_prefix", "FY"),
        )
        return Response({
            "total_periods": len(suggested),
            "periods": suggested,
        })


class FiscalPeriodListView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.PERIOD.VIEW"}

    def get(self, request):
        company = resolve_company(request)
        qs = FiscalPeriod.objects.filter(company=company).select_related("fiscal_year", "closed_by", "locked_by", "reopened_by")

        if fy_id := request.query_params.get("fiscal_year"):
            qs = qs.filter(fiscal_year_id=fy_id)
        if st := request.query_params.get("status"):
            qs = qs.filter(status=st)
        if pt := request.query_params.get("period_type"):
            qs = qs.filter(period_type=pt)

        serializer = FiscalPeriodSerializer(qs, many=True)
        return Response(serializer.data)


class FiscalPeriodDetailView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {
        "GET": "SYS.PERIOD.VIEW",
        "PATCH": "SYS.PERIOD.CONFIGURE",
    }

    def get(self, request, pk):
        company = resolve_company(request, pk=pk)
        period = get_fiscal_period_or_404(pk, company)
        return Response(FiscalPeriodSerializer(period).data)

    def patch(self, request, pk):
        company = resolve_company(request, pk=pk)
        actor = get_actor_user(request)
        period = get_fiscal_period_or_404(pk, company)

        name = request.data.get("name")
        notes = request.data.get("notes")
        allow_adjustment = request.data.get("allow_adjustment")

        updated_period = update_period_metadata(
            period=period,
            name=name,
            notes=notes,
            allow_adjustment=allow_adjustment,
            actor=actor,
        )
        return Response(FiscalPeriodSerializer(updated_period).data)


class FiscalPeriodChangeStatusView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "SYS.PERIOD.CLOSE"}

    def post(self, request, pk):
        company = resolve_company(request, pk=pk)
        actor = get_actor_user(request)
        period = get_fiscal_period_or_404(pk, company)

        serializer = FiscalPeriodStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated_period = change_period_status(
            period=period,
            new_status=serializer.validated_data["status"],
            actor=actor,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response({
            "detail": f"Đã chuyển trạng thái kỳ [{period.code}] sang {updated_period.get_status_display()}.",
            "data": FiscalPeriodSerializer(updated_period).data,
        })


class DeterminePeriodView(APIView):
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"GET": "SYS.PERIOD.VIEW", "POST": "SYS.PERIOD.VIEW"}

    def handle(self, request):
        company = resolve_company(request)
        data = request.query_params if request.method == "GET" else request.data
        serializer = DeterminePeriodRequestSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        result = determine_period_for_date(
            company=company,
            target_date=serializer.validated_data["date"],
            date_type=serializer.validated_data.get("date_type", "DOCUMENT_DATE"),
        )
        return Response({
            "fiscal_year": FiscalYearSerializer(result["fiscal_year"]).data,
            "period": FiscalPeriodSerializer(result["period"]).data,
            "period_status": result["status"],
            "is_open": result["is_open"],
            "can_draft": result["can_draft"],
            "can_post": result["can_post"],
        })

    def get(self, request):
        return self.handle(request)

    def post(self, request):
        return self.handle(request)
