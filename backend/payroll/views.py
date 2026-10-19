from rest_framework import mixins, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from iam.permissions import HasIamPermission
from organization.models import Company, Employee

from . import models, services


def _company(request):
    company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
    if not company:
        raise serializers.ValidationError({"company": "Không tìm thấy doanh nghiệp."})
    return company


class SettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.PayrollSetting
        fields = ("standard_days", "personal_deduction", "dependent_deduction", "insurance_rates", "tax_brackets", "payable_account_code", "accounting_rule", "integration_mode")

    def validate_standard_days(self, value):
        if value < 1 or value > 31:
            raise serializers.ValidationError("Số ngày công chuẩn phải từ 1 đến 31.")
        return value

    def validate_tax_brackets(self, value):
        if not value or any(not isinstance(row, dict) or "rate" not in row for row in value) or value[-1].get("up_to") not in (None, ""):
            raise serializers.ValidationError("Biểu thuế phải có ít nhất một bậc và bậc cuối không giới hạn.")
        return value

    def validate_insurance_rates(self, value):
        if not isinstance(value, dict) or not {"employee", "employer"} <= set(value):
            raise serializers.ValidationError("Cần tỷ lệ bảo hiểm của người lao động và doanh nghiệp.")
        unknown = {fund for side in value.values() for fund in side} - set(services.FUND_ACCOUNTS)
        if unknown:
            raise serializers.ValidationError(f"Quỹ bảo hiểm không hỗ trợ: {', '.join(sorted(unknown))}.")
        return value


class PayrollSettingView(APIView):
    permission_classes = (HasIamPermission,)
    iam_permissions = {"GET": "PAYROLL.SETTING.VIEW", "PUT": "PAYROLL.SETTING.EDIT"}

    def get(self, request):
        return Response(SettingSerializer(services.settings_for(_company(request))).data)

    def put(self, request):
        setting = services.settings_for(_company(request))
        serializer = SettingSerializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        services.audit(request, setting, "CONFIGURE", after=serializer.data)
        return Response(serializer.data)


class PayProfileSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True, default="")
    expense_account_code = serializers.CharField(source="expense_account.code", read_only=True)

    class Meta:
        model = models.PayProfile
        fields = ("id", "company", "employee", "employee_code", "employee_name", "department_name", "base_salary", "allowance",
                  "insurance_salary", "dependents", "expense_account", "expense_account_code", "bank_account", "is_active")

    def validate(self, attrs):
        company = attrs.get("company") or self.instance.company
        employee = attrs.get("employee") or self.instance.employee
        account = attrs.get("expense_account") or self.instance.expense_account
        if employee.company_id != company.pk or account.company_id != company.pk or not account.is_postable:
            raise serializers.ValidationError("Nhân viên và tài khoản chi phí phải thuộc doanh nghiệp (tài khoản chi tiết).")
        return attrs


class _CompanyMixin:
    permission_classes = (HasIamPermission,)

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company) if company else self.queryset.none()


class PayProfileViewSet(_CompanyMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, GenericViewSet):
    queryset = models.PayProfile.objects.select_related("employee__department", "expense_account").order_by("employee__employee_code")
    serializer_class = PayProfileSerializer
    iam_permissions = {"GET": "PAYROLL.PROFILE.VIEW", "POST": "PAYROLL.PROFILE.CREATE", "PATCH": "PAYROLL.PROFILE.EDIT", "PUT": "PAYROLL.PROFILE.EDIT"}


class AttendanceLineSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = models.AttendanceLine
        fields = ("employee", "employee_code", "employee_name", "working_days", "paid_leave_days", "overtime_hours")


class AttendanceSheetSerializer(serializers.ModelSerializer):
    lines = AttendanceLineSerializer(many=True, required=False)

    class Meta:
        model = models.AttendanceSheet
        fields = ("id", "company", "kind", "method", "name", "period", "lines", "created_at")

    def create(self, validated_data):
        lines = validated_data.pop("lines", None)
        sheet = models.AttendanceSheet.objects.create(**validated_data)
        company = sheet.company
        if lines is None:
            # A new sheet starts with every active employee at the standard number of days.
            days = services.settings_for(company).standard_days
            lines = [{"employee": employee, "working_days": days} for employee in Employee.objects.filter(company=company, status="ACTIVE")]
        for row in lines:
            if row["employee"].company_id != company.pk:
                raise serializers.ValidationError({"lines": "Nhân viên không thuộc doanh nghiệp."})
            models.AttendanceLine.objects.create(sheet=sheet, **row)
        return sheet


class AttendanceSheetViewSet(_CompanyMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, GenericViewSet):
    queryset = models.AttendanceSheet.objects.prefetch_related("lines__employee")
    serializer_class = AttendanceSheetSerializer
    iam_permissions = {"GET": "PAYROLL.ATTENDANCE.VIEW", "POST": "PAYROLL.ATTENDANCE.CREATE"}

    def perform_create(self, serializer):
        sheet = serializer.save(created_by=services.actor(self.request))
        services.audit(self.request, sheet, "CREATE", after={"name": sheet.name, "period": sheet.period})


class SalaryLineSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    expense_account_code = serializers.CharField(source="expense_account.code", read_only=True)

    class Meta:
        model = models.SalaryLine
        exclude = ("sheet",)


class SalarySheetSerializer(serializers.ModelSerializer):
    lines = SalaryLineSerializer(many=True, read_only=True)
    journal_number = serializers.CharField(source="journal_entry.number", read_only=True, default="")

    class Meta:
        model = models.SalarySheet
        fields = ("id", "company", "name", "period", "attendance_sheet", "standard_days", "status", "journal_entry", "journal_number",
                  "payment_reference", "insurance_payment_reference", "lines", "created_at")


class SalarySheetViewSet(_CompanyMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    queryset = models.SalarySheet.objects.select_related("journal_entry").prefetch_related("lines__employee", "lines__expense_account")
    serializer_class = SalarySheetSerializer
    iam_permissions = {"GET": "PAYROLL.SHEET.VIEW", "POST": "PAYROLL.SHEET.CREATE"}
    action_permissions = {"post_sheet": "PAYROLL.SHEET.POST", "paid": "PAYROLL.SHEET.PAY", "insurance_paid": "PAYROLL.SHEET.PAY"}

    def create(self, request, *args, **kwargs):
        sheet = services.create_salary_sheet(_company(request), request.data, request)
        return Response(self.get_serializer(sheet).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="post")
    def post_sheet(self, request, pk=None):
        return Response(self.get_serializer(services.post_salary_sheet(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def paid(self, request, pk=None):
        return Response(self.get_serializer(services.mark_paid(self.get_object(), request)).data)

    @action(detail=True, methods=("post",), url_path="insurance-paid")
    def insurance_paid(self, request, pk=None):
        return Response(self.get_serializer(services.mark_paid(self.get_object(), request, insurance=True)).data)
