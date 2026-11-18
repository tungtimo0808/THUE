from rest_framework import mixins, serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from iam.permissions import HasIamPermission
from organization.models import Company, Employee

from . import models, services


def _actor_label(user):
    if not user:
        return ""
    return getattr(user, "full_name", "") or getattr(user, "display_name", "") or getattr(user, "username", "") or getattr(user, "email", "")


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
    job_title = serializers.CharField(source="employee.job_title", read_only=True, default="")
    personal_tax_code = serializers.CharField(source="employee.personal_tax_code", read_only=True, default="")
    expense_account_code = serializers.CharField(source="expense_account.code", read_only=True)

    class Meta:
        model = models.PayProfile
        fields = ("id", "company", "employee", "employee_code", "employee_name", "department_name", "job_title", "personal_tax_code",
                  "base_salary", "allowance", "insurance_salary", "dependents", "expense_account", "expense_account_code", "bank_account", "is_active")

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


class PayProfileViewSet(_CompanyMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, GenericViewSet):
    queryset = models.PayProfile.objects.select_related("employee__department", "expense_account").order_by("employee__employee_code")
    serializer_class = PayProfileSerializer
    iam_permissions = {
        "GET": "PAYROLL.PROFILE.VIEW",
        "POST": "PAYROLL.PROFILE.CREATE",
        "PATCH": "PAYROLL.PROFILE.EDIT",
        "PUT": "PAYROLL.PROFILE.EDIT",
        "DELETE": "PAYROLL.PROFILE.EDIT",
    }

    def perform_destroy(self, instance):
        services.audit(self.request, instance, "DELETE", before={"employee": instance.employee.employee_code})
        instance.delete()


class AttendanceLineSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True, default="")

    class Meta:
        model = models.AttendanceLine
        fields = ("employee", "employee_code", "employee_name", "department_name", "working_days", "paid_leave_days", "overtime_hours")


class AttendanceSheetSerializer(serializers.ModelSerializer):
    lines = AttendanceLineSerializer(many=True, required=False)
    created_by_name = serializers.SerializerMethodField()
    departments = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    aggregate_from_details = serializers.BooleanField(required=False, default=False, write_only=True)

    class Meta:
        model = models.AttendanceSheet
        fields = ("id", "company", "kind", "method", "name", "period", "lines", "created_by_name", "created_at", "departments", "aggregate_from_details")

    def get_created_by_name(self, obj):
        return _actor_label(getattr(obj, "created_by", None))

    def create(self, validated_data):
        lines = validated_data.pop("lines", None)
        departments = validated_data.pop("departments", None)
        aggregate_from_details = validated_data.pop("aggregate_from_details", False)
        sheet = models.AttendanceSheet.objects.create(**validated_data)
        company = sheet.company
        if lines is None:
            days = services.settings_for(company).standard_days
            emp_qs = Employee.objects.filter(company=company, status="ACTIVE").order_by("employee_code")
            if departments:
                emp_qs = emp_qs.filter(department_id__in=departments)
            detail_map = {}
            if sheet.kind == "SUMMARY" and aggregate_from_details:
                detail_sheets = models.AttendanceSheet.objects.filter(company=company, period=sheet.period, kind="DETAIL").prefetch_related("lines")
                for ds in detail_sheets:
                    for dl in ds.lines.all():
                        if dl.employee_id not in detail_map:
                            detail_map[dl.employee_id] = {
                                "working_days": dl.working_days,
                                "paid_leave_days": dl.paid_leave_days,
                                "overtime_hours": dl.overtime_hours,
                            }
            lines = []
            for employee in emp_qs:
                agg = detail_map.get(employee.pk)
                if agg:
                    lines.append({"employee": employee, **agg})
                else:
                    lines.append({"employee": employee, "working_days": days})
        for row in lines:
            if row["employee"].company_id != company.pk:
                raise serializers.ValidationError({"lines": "Nhân viên không thuộc doanh nghiệp."})
            models.AttendanceLine.objects.create(sheet=sheet, **row)
        return sheet

    def update(self, instance, validated_data):
        validated_data.pop("departments", None)
        validated_data.pop("aggregate_from_details", None)
        lines = validated_data.pop("lines", None)
        for field in ("name", "method", "period", "kind"):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        if lines is not None:
            seen_ids = []
            for row in lines:
                emp = row["employee"]
                if emp.company_id != instance.company_id:
                    raise serializers.ValidationError({"lines": "Nhân viên không thuộc doanh nghiệp."})
                line_obj, _ = models.AttendanceLine.objects.update_or_create(
                    sheet=instance,
                    employee=emp,
                    defaults={
                        "working_days": row.get("working_days", 0),
                        "paid_leave_days": row.get("paid_leave_days", 0),
                        "overtime_hours": row.get("overtime_hours", 0),
                    },
                )
                seen_ids.append(line_obj.pk)
            instance.lines.exclude(pk__in=seen_ids).delete()
        return instance


class AttendanceSheetViewSet(_CompanyMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin, GenericViewSet):
    queryset = models.AttendanceSheet.objects.select_related("created_by").prefetch_related("lines__employee__department")
    serializer_class = AttendanceSheetSerializer
    iam_permissions = {
        "GET": "PAYROLL.ATTENDANCE.VIEW",
        "POST": "PAYROLL.ATTENDANCE.CREATE",
        "PATCH": "PAYROLL.ATTENDANCE.CREATE",
        "PUT": "PAYROLL.ATTENDANCE.CREATE",
        "DELETE": "PAYROLL.ATTENDANCE.CREATE",
    }

    def perform_create(self, serializer):
        sheet = serializer.save(created_by=services.actor(self.request))
        services.audit(self.request, sheet, "CREATE", after={"name": sheet.name, "period": sheet.period})

    def perform_update(self, serializer):
        sheet = serializer.save()
        services.audit(self.request, sheet, "UPDATE", after={"name": sheet.name, "period": sheet.period, "lines": sheet.lines.count()})

    def perform_destroy(self, instance):
        if instance.salary_sheets.exists():
            raise ValidationError("Bảng chấm công đã được liên kết với bảng lương nên không thể xóa.")
        services.audit(self.request, instance, "DELETE", before={"name": instance.name, "period": instance.period})
        instance.delete()


class SalaryLineSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True, default="")
    personal_tax_code = serializers.CharField(source="employee.personal_tax_code", read_only=True, default="")
    expense_account_code = serializers.CharField(source="expense_account.code", read_only=True)

    class Meta:
        model = models.SalaryLine
        exclude = ("sheet",)


class SalarySheetSerializer(serializers.ModelSerializer):
    lines = SalaryLineSerializer(many=True, read_only=True)
    journal_number = serializers.CharField(source="journal_entry.number", read_only=True, default="")
    attendance_sheet_name = serializers.CharField(source="attendance_sheet.name", read_only=True, default="")
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = models.SalarySheet
        fields = ("id", "company", "name", "period", "attendance_sheet", "attendance_sheet_name", "standard_days", "status", "journal_entry",
                  "journal_number", "payment_reference", "insurance_payment_reference", "lines", "created_by_name", "created_at")

    def get_created_by_name(self, obj):
        return _actor_label(getattr(obj, "created_by", None))


class SalarySheetViewSet(_CompanyMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, GenericViewSet):
    queryset = models.SalarySheet.objects.select_related("journal_entry", "created_by", "attendance_sheet").prefetch_related("lines__employee__department", "lines__expense_account")
    serializer_class = SalarySheetSerializer
    iam_permissions = {"GET": "PAYROLL.SHEET.VIEW", "POST": "PAYROLL.SHEET.CREATE", "DELETE": "PAYROLL.SHEET.CREATE"}
    action_permissions = {"post_sheet": "PAYROLL.SHEET.POST", "paid": "PAYROLL.SHEET.PAY", "insurance_paid": "PAYROLL.SHEET.PAY"}

    def create(self, request, *args, **kwargs):
        sheet = services.create_salary_sheet(_company(request), request.data, request)
        return Response(self.get_serializer(sheet).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        if instance.status != models.SalarySheet.Status.CALCULATED:
            raise ValidationError("Bảng lương đã hạch toán không thể xóa.")
        services.audit(self.request, instance, "DELETE", before={"name": instance.name, "period": instance.period})
        instance.delete()

    @action(detail=True, methods=("post",), url_path="post")
    def post_sheet(self, request, pk=None):
        return Response(self.get_serializer(services.post_salary_sheet(self.get_object(), request)).data)

    @action(detail=True, methods=("post",))
    def paid(self, request, pk=None):
        return Response(self.get_serializer(services.mark_paid(self.get_object(), request)).data)

    @action(detail=True, methods=("post",), url_path="insurance-paid")
    def insurance_paid(self, request, pk=None):
        return Response(self.get_serializer(services.mark_paid(self.get_object(), request, insurance=True)).data)
