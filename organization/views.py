from django.shortcuts import get_object_or_404
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from django.db import transaction
from django.http import HttpResponse
import csv
import io
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from audit_log.services import record_audit
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.viewsets import GenericViewSet
from rest_framework.response import Response
from rest_framework.views import APIView

from iam.models import ActiveStatus, CompanyMembership
from iam.permissions import has_effective_permission

from .models import Branch, Company, Department, Employee, EmployeeAssignment, EmployeeBankAccount, OrganizationUnit, Position
from .serializers import (
    BranchSerializer,
    CompanySerializer,
    DepartmentSerializer,
    EmployeeAssignmentSerializer,
    EmployeeSerializer,
    EmployeeBankAccountSerializer,
    PositionSerializer,
    CompanyInformationReadSerializer,
    CompanyInformationUpdateSerializer,
    CompanyInformationVersionSerializer,
    OrganizationUnitDeactivateSerializer,
    OrganizationUnitHistorySerializer,
    OrganizationUnitMoveSerializer,
    OrganizationUnitReactivateSerializer,
    OrganizationUnitSerializer,
    OrganizationUnitWriteSerializer,
)
from .company_information import apply_due_versions, authorize, update_company_information
from . import structure_services


class ProtectedModelViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    permission_classes = (IsAdminUser,)


class CompanyScopedViewSet(ProtectedModelViewSet):
    permission_classes = (IsAuthenticated,)
    filter_backends = (SearchFilter, OrderingFilter)

    def get_queryset(self):
        queryset = super().get_queryset()
        company_id = self.request.query_params.get("company_id")
        if company_id:
            queryset = queryset.filter(company_id=company_id)
        return queryset


class CompanyViewSet(ProtectedModelViewSet):
    # Company creation and mutation are handled by UC-SYS-01/UC-SYS-02 so protected
    # identifiers and accounting settings cannot be bypassed through this catalog API.
    http_method_names = ("get", "head", "options")
    permission_classes = (IsAuthenticated,)
    queryset = Company.objects.select_related("accounting_currency", "legal_reporting_currency")
    serializer_class = CompanySerializer
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("code", "name", "legal_name", "tax_code")
    ordering_fields = ("code", "name", "created_at")

    def get_queryset(self):
        account = getattr(self.request.user, "iam_account", None)
        if account is None:
            return self.queryset.none()
        company_ids = [
            company.id
            for company in Company.objects.filter(
                memberships__user=account,
                memberships__membership_status=ActiveStatus.ACTIVE,
            ).distinct()
            if has_effective_permission(account, company, "SYS.COMPANY_PROFILE.VIEW")
        ]
        return self.queryset.filter(pk__in=company_ids)

    def list(self, request, *args, **kwargs):
        if not self.get_queryset().exists():
            raise PermissionDenied("Bạn không có quyền xem thông tin doanh nghiệp.")
        return super().list(request, *args, **kwargs)


class CompanyInformationView(APIView):
    def _context(self, request, company_id, permission_code):
        company = get_object_or_404(Company, pk=company_id)
        if not hasattr(request.user, "iam_account"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Tài khoản chưa được liên kết với IAM.")
        account = request.user.iam_account
        authorize(account, company, permission_code)
        return account, company

    @extend_schema(responses={200: CompanyInformationReadSerializer})
    def get(self, request, company_id):
        account, company = self._context(request, company_id, "SYS.COMPANY_PROFILE.VIEW")
        if company.status in {"ACTIVE", "PENDING_SETUP"}:
            company = apply_due_versions(company, request=request)
        can_edit = (
            company.status != "INACTIVE"
            and has_effective_permission(account, company, "SYS.COMPANY_PROFILE.EDIT")
            and (
                company.status != "SUSPENDED"
                or has_effective_permission(account, company, "SYS.COMPANY_PROFILE.EDIT_SUSPENDED")
            )
        )
        return Response({
            "company": CompanyInformationReadSerializer(company, context={"request": request}).data,
            "can_edit": can_edit,
            "pending_versions": CompanyInformationVersionSerializer(
                company.information_versions.filter(status="PENDING"), many=True
            ).data,
        })

    @extend_schema(
        request=CompanyInformationUpdateSerializer,
        responses={200: CompanyInformationReadSerializer, 202: CompanyInformationVersionSerializer},
    )
    def patch(self, request, company_id):
        account, _company = self._context(request, company_id, "SYS.COMPANY_PROFILE.EDIT")
        if _company.status in {"ACTIVE", "PENDING_SETUP"}:
            apply_due_versions(_company, request=request)
        serializer = CompanyInformationUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            company, version, scheduled = update_company_information(
                company_id=company_id, account=account,
                data=serializer.validated_data, request=request,
            )
        except APIException:
            raise
        except Exception as exc:
            error = APIException("Chưa thể lưu thông tin doanh nghiệp. Vui lòng thử lại sau.")
            error.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            raise error from exc
        return Response({
            "message": "Đã lưu phiên bản chờ hiệu lực." if scheduled else "Cập nhật thông tin doanh nghiệp thành công",
            "company": CompanyInformationReadSerializer(company, context={"request": request}).data,
            "version": CompanyInformationVersionSerializer(version).data,
            "scheduled": scheduled,
        }, status=status.HTTP_202_ACCEPTED if scheduled else status.HTTP_200_OK)


class OrganizationStructureViewSet(GenericViewSet):
    queryset = OrganizationUnit.objects.select_related(
        "company", "parent", "manager_membership__user", "pending_parent"
    )
    serializer_class = OrganizationUnitSerializer

    def handle_exception(self, exc):
        if not isinstance(exc, (APIException, Http404)):
            wrapped = APIException("Không thể lưu cơ cấu tổ chức. Vui lòng thử lại sau.")
            wrapped.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            exc = wrapped
        return super().handle_exception(exc)

    def _company_account(self, permission_code):
        company = get_object_or_404(Company, pk=self.request.query_params.get("company_id"))
        if not hasattr(self.request.user, "iam_account"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Tài khoản chưa được liên kết với IAM.")
        account = self.request.user.iam_account
        structure_services.authorize(account, company, permission_code)
        return company, account

    def _unit(self, company):
        return get_object_or_404(self.get_queryset(), pk=self.kwargs["pk"], company=company)

    def list(self, request):
        company, _account = self._company_account("SYS.ORG_STRUCTURE.VIEW")
        queryset = self.get_queryset().filter(company=company)
        for unit in queryset:
            structure_services.apply_due(unit, request=request)
        queryset = self.get_queryset().filter(company=company)
        if request.query_params.get("status"):
            queryset = queryset.filter(status=request.query_params["status"])
        if request.query_params.get("type"):
            queryset = queryset.filter(unit_type=request.query_params["type"])
        query = request.query_params.get("q", "").strip()
        if query:
            from django.db.models import Q
            queryset = queryset.filter(Q(code__icontains=query) | Q(name__icontains=query))
        data = OrganizationUnitSerializer(queryset, many=True).data
        if request.query_params.get("view") != "tree":
            return Response({"results": data})
        by_parent = {}
        for item in data:
            by_parent.setdefault(str(item["parent"]) if item["parent"] else None, []).append(item)
        def descendants(parent_id):
            result = []
            for item in by_parent.get(parent_id, []):
                node = dict(item); node["children"] = descendants(str(item["id"])); result.append(node)
            return result
        return Response({"results": descendants(None)})

    def retrieve(self, request, pk=None):
        company, _account = self._company_account("SYS.ORG_STRUCTURE.VIEW")
        unit = structure_services.apply_due(self._unit(company), request=request)
        return Response(OrganizationUnitSerializer(unit).data)

    def create(self, request):
        company, account = self._company_account("SYS.ORG_STRUCTURE.CREATE")
        serializer = OrganizationUnitWriteSerializer(data=request.data, context={"creating": True})
        serializer.is_valid(raise_exception=True)
        unit = structure_services.create_unit(company, account, serializer.validated_data, request)
        return Response({"message": "Thêm đơn vị thành công", "unit": OrganizationUnitSerializer(unit).data}, status=201)

    def partial_update(self, request, pk=None):
        company, account = self._company_account("SYS.ORG_STRUCTURE.EDIT")
        self._unit(company)
        serializer = OrganizationUnitWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        unit = structure_services.update_unit(pk, company, account, serializer.validated_data, request)
        return Response({"message": "Cập nhật đơn vị thành công", "unit": OrganizationUnitSerializer(unit).data})

    @action(detail=True, methods=("post",))
    def move(self, request, pk=None):
        company, account = self._company_account("SYS.ORG_STRUCTURE.MOVE")
        self._unit(company)
        serializer = OrganizationUnitMoveSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        unit = structure_services.move_unit(pk, company, account, serializer.validated_data, request)
        return Response({"message": "Di chuyển đơn vị thành công", "unit": OrganizationUnitSerializer(unit).data})

    @action(detail=True, methods=("post",))
    def deactivate(self, request, pk=None):
        company, account = self._company_account("SYS.ORG_STRUCTURE.DEACTIVATE")
        self._unit(company)
        serializer = OrganizationUnitDeactivateSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        unit = structure_services.deactivate_unit(pk, company, account, serializer.validated_data, request)
        return Response({"message": "Đã cập nhật trạng thái đơn vị", "unit": OrganizationUnitSerializer(unit).data})

    @action(detail=True, methods=("post",))
    def reactivate(self, request, pk=None):
        company, account = self._company_account("SYS.ORG_STRUCTURE.REACTIVATE")
        self._unit(company)
        serializer = OrganizationUnitReactivateSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        unit = structure_services.reactivate_unit(pk, company, account, serializer.validated_data, request)
        return Response({"message": "Kích hoạt lại đơn vị thành công", "unit": OrganizationUnitSerializer(unit).data})

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        company, _account = self._company_account("SYS.ORG_STRUCTURE.VIEW_HISTORY")
        unit = self._unit(company)
        return Response({"results": OrganizationUnitHistorySerializer(unit.history.all(), many=True).data})


class BranchViewSet(CompanyScopedViewSet):
    queryset = Branch.objects.select_related("company", "parent")
    serializer_class = BranchSerializer
    search_fields = ("code", "name", "tax_code")
    ordering_fields = ("code", "name", "created_at")


class DepartmentViewSet(CompanyScopedViewSet):
    queryset = Department.objects.select_related("company", "branch", "parent", "manager")
    serializer_class = DepartmentSerializer
    search_fields = ("code", "name")
    ordering_fields = ("code", "name", "created_at")


class PositionViewSet(CompanyScopedViewSet):
    queryset = Position.objects.select_related("company")
    serializer_class = PositionSerializer
    search_fields = ("code", "name")
    ordering_fields = ("code", "name", "created_at")


class EmployeeViewSet(CompanyScopedViewSet):
    permission_classes = (IsAuthenticated,)
    queryset = Employee.objects.select_related("company", "branch", "department", "position")
    serializer_class = EmployeeSerializer
    search_fields = ("employee_code", "full_name", "email", "phone")
    ordering_fields = ("employee_code", "full_name", "created_at")

    def _account(self):
        return getattr(self.request.user, "iam_account", None)

    def _allowed(self, employee, code):
        account = self._account()
        return bool(account and has_effective_permission(account, employee.company, code, branch_id=employee.branch_id, department_id=employee.department_id))

    def _sensitive_allowed(self, employee):
        return self._allowed(employee, "MD.EMPLOYEE.VIEW_SENSITIVE")

    def get_queryset(self):
        account = self._account()
        if not account:
            return self.queryset.none()
        company_id = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company_id) if company_id else self.queryset.none()
        for field in ("status", "branch_id", "department_id", "position_id"):
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        return queryset.filter(pk__in=[item.pk for item in queryset if self._allowed(item, "MD.EMPLOYEE.VIEW")])

    def list(self, request, *args, **kwargs):
        if not request.query_params.get("company_id"):
            raise ValidationError({"company_id": "Cần chọn doanh nghiệp."})
        return super().list(request, *args, **kwargs)

    def _audit(self, employee, action, before=None):
        record_audit(company=employee.company, actor_user=self._account(), module_code="MD", event_category="MASTER_DATA", action_code=f"EMPLOYEE_{action}", entity=employee, before=before, after={"employee_code": employee.employee_code, "full_name": employee.full_name, "status": employee.status}, request=self.request)

    @transaction.atomic
    def perform_create(self, serializer):
        company = serializer.validated_data["company"]
        branch = serializer.validated_data.get("branch")
        department = serializer.validated_data.get("department")
        if not self._account() or not has_effective_permission(self._account(), company, "MD.EMPLOYEE.CREATE", branch_id=getattr(branch, "pk", None), department_id=getattr(department, "pk", None)):
            raise PermissionDenied("Không có quyền tạo nhân viên trong phạm vi này.")
        if company.status != "ACTIVE":
            raise ValidationError({"company": "Doanh nghiệp chưa hoạt động."})
        if any(field in serializer.validated_data for field in ("identity_number", "personal_tax_code", "address", "date_of_birth")) and not has_effective_permission(self._account(), company, "MD.EMPLOYEE.VIEW_SENSITIVE", branch_id=getattr(branch, "pk", None), department_id=getattr(department, "pk", None)):
            raise PermissionDenied("Không có quyền cập nhật dữ liệu nhạy cảm.")
        employee = serializer.save()
        self._audit(employee, "CREATE")

    @transaction.atomic
    def perform_update(self, serializer):
        employee = serializer.instance
        if not self._allowed(employee, "MD.EMPLOYEE.EDIT"):
            raise PermissionDenied("Không có quyền sửa nhân viên.")
        self._check_version(employee)
        if any(field in serializer.validated_data for field in ("identity_number", "personal_tax_code", "address", "date_of_birth")) and not self._sensitive_allowed(employee):
            raise PermissionDenied("Không có quyền cập nhật dữ liệu nhạy cảm.")
        before = {"employee_code": employee.employee_code, "full_name": employee.full_name, "status": employee.status}
        if "status" in serializer.validated_data and serializer.validated_data["status"] != employee.status:
            raise ValidationError({"status": "Hãy dùng thao tác đổi trạng thái."})
        employee = serializer.save()
        self._audit(employee, "UPDATE", before)

    def _check_version(self, employee):
        version = self.request.data.get("version")
        if not version:
            raise ValidationError({"version": "Cần gửi phiên bản hồ sơ hiện tại."})
        parsed_version = parse_datetime(str(version))
        if parsed_version is None or parsed_version != employee.updated_at:
            error = APIException("Hồ sơ đã được cập nhật. Hãy tải lại trước khi lưu.")
            error.status_code = 409
            raise error

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def change_status(self, request, pk=None):
        employee = self.get_object()
        if not self._allowed(employee, "MD.EMPLOYEE.DEACTIVATE"):
            raise PermissionDenied("Không có quyền đổi trạng thái nhân viên.")
        self._check_version(employee)
        new_status = request.data.get("status")
        if new_status not in ("ACTIVE", "INACTIVE", "TERMINATED"):
            raise ValidationError({"status": "Trạng thái không hợp lệ."})
        if new_status == "TERMINATED" and not request.data.get("termination_date"):
            raise ValidationError({"termination_date": "Cần ngày kết thúc."})
        if new_status in ("INACTIVE", "TERMINATED") and employee.assets_in_custody.exclude(status="DISPOSED").exists() and request.data.get("confirm_assets") is not True:
            raise ValidationError({"confirm_assets": "Nhân viên còn tài sản đang quản lý. Cần kiểm tra bàn giao và xác nhận."})
        before = {"status": employee.status}
        serializer = self.get_serializer(employee, data={"status": new_status, "termination_date": request.data.get("termination_date") if new_status == "TERMINATED" else None}, partial=True)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        self._audit(employee, "STATUS", before)
        return Response(self.get_serializer(employee).data)

    @action(detail=True, methods=("get",))
    def impact(self, request, pk=None):
        employee = self.get_object()
        return Response({"assets_in_custody": employee.assets_in_custody.exclude(status="DISPOSED").count(), "linked_user": EmployeeSerializer(employee, context={"request": request}).data["linked_user"]})

    @action(detail=True, methods=("post",), url_path="link-user")
    @transaction.atomic
    def link_user(self, request, pk=None):
        employee = self.get_object()
        if not self._allowed(employee, "MD.EMPLOYEE.LINK_USER"):
            raise PermissionDenied("Không có quyền liên kết User.")
        if employee.status != "ACTIVE":
            raise ValidationError({"employee": "Chỉ liên kết nhân viên ACTIVE."})
        membership = CompanyMembership.objects.select_for_update().filter(company=employee.company, user_id=request.data.get("user_id"), membership_status=ActiveStatus.ACTIVE).first()
        if not membership:
            raise ValidationError({"user_id": "User không có Membership ACTIVE trong doanh nghiệp."})
        if membership.employee_id or CompanyMembership.objects.filter(employee=employee).exists():
            raise ValidationError({"user_id": "Employee hoặc User đã được liên kết."})
        membership.employee = employee
        membership.save(update_fields=("employee", "updated_at"))
        self._audit(employee, "LINK_USER")
        return Response({"linked_user": str(membership.user_id)})

    @action(detail=True, methods=("post",), url_path="unlink-user")
    @transaction.atomic
    def unlink_user(self, request, pk=None):
        employee = self.get_object()
        if not self._allowed(employee, "MD.EMPLOYEE.LINK_USER"):
            raise PermissionDenied("Không có quyền hủy liên kết User.")
        membership = CompanyMembership.objects.select_for_update().filter(employee=employee).first()
        if membership:
            membership.employee = None
            membership.save(update_fields=("employee", "updated_at"))
            self._audit(employee, "UNLINK_USER")
        return Response({"linked_user": None})

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        employee = self.get_object()
        from audit_log.models import AuditLog
        logs = AuditLog.objects.filter(company=employee.company, entity_type="organization.Employee", entity_id=employee.id).values("action_code", "occurred_at", "actor_name_snapshot")
        return Response({"assignments": EmployeeAssignmentSerializer(employee.assignments.all(), many=True).data, "events": list(logs)})

    @action(detail=True, methods=("get", "post"), url_path="bank-accounts")
    @transaction.atomic
    def bank_accounts(self, request, pk=None):
        employee = self.get_object()
        if not self._sensitive_allowed(employee):
            raise PermissionDenied("Không có quyền xem thông tin thanh toán.")
        if request.method == "GET":
            return Response(EmployeeBankAccountSerializer(employee.bank_accounts.all(), many=True).data)
        if not self._allowed(employee, "MD.EMPLOYEE.EDIT"):
            raise PermissionDenied("Không có quyền sửa thông tin thanh toán.")
        serializer = EmployeeBankAccountSerializer(data={**request.data, "employee": str(employee.pk)})
        serializer.is_valid(raise_exception=True)
        account = serializer.save()
        self._audit(employee, "BANK_ADD")
        return Response(EmployeeBankAccountSerializer(account).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("patch",), url_path=r"bank-accounts/(?P<account_id>[^/.]+)")
    @transaction.atomic
    def bank_account_detail(self, request, pk=None, account_id=None):
        employee = self.get_object()
        if not self._sensitive_allowed(employee) or not self._allowed(employee, "MD.EMPLOYEE.EDIT"):
            raise PermissionDenied("Không có quyền sửa thông tin thanh toán.")
        account = get_object_or_404(EmployeeBankAccount, pk=account_id, employee=employee)
        serializer = EmployeeBankAccountSerializer(account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        account = serializer.save()
        self._audit(employee, "BANK_UPDATE")
        return Response(EmployeeBankAccountSerializer(account).data)

    @action(detail=False, methods=("get",), url_path="export-csv")
    def export_csv(self, request):
        company_id = request.query_params.get("company_id")
        company = get_object_or_404(Company, pk=company_id)
        employees = [employee for employee in self.get_queryset() if self._allowed(employee, "MD.EMPLOYEE.EXPORT")]
        if not self._account() or not employees:
            raise PermissionDenied("Không có quyền xuất nhân viên.")
        output = io.StringIO()
        writer = csv.writer(output)
        fields = ["employee_code", "full_name", "status", "email", "phone", "branch_id", "department_id", "position_id"]
        if any(self._sensitive_allowed(employee) for employee in employees):
            fields += ["identity_number", "personal_tax_code", "address"]
        writer.writerow(fields)
        for employee in employees:
            writer.writerow([getattr(employee, field) if field not in {"identity_number", "personal_tax_code", "address"} or self._sensitive_allowed(employee) else "" for field in fields])
        response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="employees.csv"'
        return response

    @action(detail=False, methods=("post",), url_path="import-csv")
    def import_csv(self, request):
        company = get_object_or_404(Company, pk=request.data.get("company_id"))
        if not self._account() or not CompanyMembership.objects.filter(company=company, user=self._account(), membership_status=ActiveStatus.ACTIVE).exists():
            raise PermissionDenied("Không có quyền nhập nhân viên.")
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": "Cần tải lên tệp CSV."})
        try:
            content = uploaded.read().decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(content))
            if not {"employee_code", "full_name", "branch_id"}.issubset(reader.fieldnames or []):
                raise ValidationError({"file": "Thiếu cột employee_code, full_name hoặc branch_id."})
            rows = list(reader)
        except UnicodeDecodeError as exc:
            raise ValidationError({"file": "Tệp phải dùng UTF-8."}) from exc
        if len(rows) > 1000:
            raise ValidationError({"file": "Tối đa 1000 dòng mỗi lần nhập."})
        created, errors = [], []
        for number, row in enumerate(rows, start=2):
            branch = Branch.objects.filter(pk=row.get("branch_id"), company=company, status="ACTIVE").first()
            if not branch or not has_effective_permission(self._account(), company, "MD.EMPLOYEE.IMPORT", branch_id=branch.pk) or not has_effective_permission(self._account(), company, "MD.EMPLOYEE.CREATE", branch_id=branch.pk):
                errors.append({"row": number, "error": "Chi nhánh không hợp lệ hoặc ngoài phạm vi."})
                continue
            serializer = EmployeeSerializer(data={"company": str(company.pk), "branch": str(branch.pk), "employee_code": row.get("employee_code", ""), "full_name": row.get("full_name", ""), "email": row.get("email", ""), "phone": row.get("phone", ""), "status": "ACTIVE"}, context={"request": request})
            if not serializer.is_valid():
                errors.append({"row": number, "error": serializer.errors})
                continue
            with transaction.atomic():
                employee = serializer.save()
                self._audit(employee, "IMPORT")
            created.append(str(employee.pk))
        return Response({"created": created, "errors": errors})


class EmployeeAssignmentViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    queryset = EmployeeAssignment.objects.select_related("employee", "branch", "department", "position")
    serializer_class = EmployeeAssignmentSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = (OrderingFilter,)
    ordering_fields = ("valid_from", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get("employee_id")
        company_id = self.request.query_params.get("company_id")
        account = getattr(self.request.user, "iam_account", None)
        if not account or not company_id:
            return queryset.none()
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        queryset = queryset.filter(employee__company_id=company_id)
        return queryset.filter(pk__in=[item.pk for item in queryset if has_effective_permission(account, item.employee.company, "MD.EMPLOYEE.VIEW", branch_id=item.branch_id, department_id=item.department_id)])

    def perform_create(self, serializer):
        employee = serializer.validated_data["employee"]
        account = getattr(self.request.user, "iam_account", None)
        branch = serializer.validated_data["branch"]
        department = serializer.validated_data.get("department")
        if not account or not has_effective_permission(account, employee.company, "MD.EMPLOYEE.EDIT", branch_id=employee.branch_id, department_id=employee.department_id) or not has_effective_permission(account, employee.company, "MD.EMPLOYEE.EDIT", branch_id=branch.pk, department_id=getattr(department, "pk", None)):
            raise PermissionDenied("Không có quyền phân công nhân viên trong phạm vi này.")
        with transaction.atomic():
            assignment = serializer.save()
            record_audit(company=employee.company, actor_user=account, module_code="MD", event_category="MASTER_DATA", action_code="EMPLOYEE_ASSIGN", entity=employee, after={"branch": str(branch.pk), "department": str(getattr(department, "pk", ""))}, request=self.request)
