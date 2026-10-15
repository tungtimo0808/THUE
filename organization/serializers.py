import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers

from .models import BusinessType, Branch, Company, CompanyInformationVersion, Department, Employee, EmployeeAssignment, EmployeeBankAccount, OrganizationUnit, OrganizationUnitHistory, Position
from .services import assign_employee


class ModelValidationMixin:
    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance or self.Meta.model()
        for name, value in attrs.items():
            setattr(instance, name, value)
        try:
            instance.full_clean(exclude=self._missing_fields(attrs))
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs

    def _missing_fields(self, attrs):
        if self.instance is not None:
            return []
        supplied = set(attrs)
        return [
            field.name
            for field in self.Meta.model._meta.fields
            if field.name not in supplied and not field.has_default() and field.null
        ]


class CompanySerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class CompanyInformationReadSerializer(serializers.ModelSerializer):
    version = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Company
        fields = (
            "id", "code", "tax_code", "legal_name", "short_name", "name", "business_type",
            "legal_representative", "representative_title", "country_code", "province", "district",
            "ward", "address", "phone", "email", "website", "logo", "timezone", "default_locale",
            "status", "version",
        )
        read_only_fields = fields


class CompanyInformationUpdateSerializer(serializers.Serializer):
    version = serializers.DateTimeField(write_only=True)
    effective_from = serializers.DateField(required=False, write_only=True)
    legal_name = serializers.CharField(max_length=255, required=False)
    short_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    name = serializers.CharField(max_length=255, required=False)
    business_type = serializers.ChoiceField(choices=BusinessType.choices, required=False)
    legal_representative = serializers.CharField(max_length=255, required=False)
    representative_title = serializers.CharField(max_length=100, required=False, allow_blank=True)
    country_code = serializers.RegexField(r"^[A-Za-z]{2}$", required=False)
    province = serializers.CharField(max_length=100, required=False)
    district = serializers.CharField(max_length=100, required=False, allow_blank=True)
    ward = serializers.CharField(max_length=100, required=False, allow_blank=True)
    address = serializers.CharField(max_length=500, required=False)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    website = serializers.URLField(required=False, allow_blank=True)
    logo = serializers.FileField(required=False, allow_null=True, write_only=True)
    remove_logo = serializers.BooleanField(required=False, default=False, write_only=True)
    timezone = serializers.CharField(max_length=80, required=False)
    default_locale = serializers.RegexField(r"^[a-z]{2,3}(?:-[A-Z]{2})?$", max_length=20, required=False)

    def validate_phone(self, value):
        value = value.strip()
        if value and not re.fullmatch(r"^\+?[0-9][0-9 .()-]{7,28}$", value):
            raise serializers.ValidationError("Số điện thoại không đúng định dạng.")
        return value

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise serializers.ValidationError("Múi giờ không hợp lệ.") from exc
        return value

    def validate_logo(self, value):
        if value is None:
            return value
        max_bytes = getattr(settings, "COMPANY_LOGO_MAX_BYTES", 5 * 1024 * 1024)
        if value.size > max_bytes:
            raise serializers.ValidationError(f"Logo không được vượt quá {max_bytes} byte.")
        extension = value.name.rsplit(".", 1)[-1].lower() if "." in value.name else ""
        allowed = set(getattr(settings, "COMPANY_LOGO_ALLOWED_EXTENSIONS", ("jpg", "jpeg", "png")))
        header = value.read(12)
        value.seek(0)
        valid_content = (
            extension in {"jpg", "jpeg"} and header.startswith(b"\xff\xd8\xff")
        ) or (
            extension == "png" and header.startswith(b"\x89PNG\r\n\x1a\n")
        )
        if extension not in allowed or not valid_content:
            raise serializers.ValidationError("Logo không đúng định dạng hoặc nội dung file không hợp lệ.")
        try:
            image = Image.open(value)
            width, height = image.size
            image.verify()
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise serializers.ValidationError("Không thể đọc nội dung file logo.") from exc
        finally:
            value.seek(0)
        max_width = getattr(settings, "COMPANY_LOGO_MAX_WIDTH", 2048)
        max_height = getattr(settings, "COMPANY_LOGO_MAX_HEIGHT", 2048)
        if width > max_width or height > max_height:
            raise serializers.ValidationError(
                f"Kích thước logo không được vượt quá {max_width}x{max_height} pixel."
            )
        return value

    def validate(self, attrs):
        protected = set(self.initial_data) & {
            "id", "code", "tax_code", "status", "accounting_currency", "legal_reporting_currency",
            "accounting_regime", "fiscal_year_start_month",
        }
        if "tax_code" in protected:
            raise serializers.ValidationError({"tax_code": "Mã số thuế phải được thay đổi qua quy trình riêng."})
        if protected:
            raise serializers.ValidationError({field: "Trường này không được cập nhật tại chức năng này." for field in protected})
        if attrs.get("logo") is not None and attrs.get("remove_logo"):
            raise serializers.ValidationError({"remove_logo": "Không thể đồng thời thay và xóa logo."})
        editable = set(attrs) - {"version", "effective_from", "remove_logo"}
        if not editable and not attrs.get("remove_logo"):
            raise serializers.ValidationError("Không có thông tin doanh nghiệp nào được thay đổi.")
        for field in (
            "legal_name", "name", "legal_representative", "province", "address",
            "short_name", "representative_title", "district", "ward",
        ):
            if field in attrs:
                attrs[field] = " ".join(attrs[field].split())
        for required in ("legal_name", "name", "legal_representative", "province", "address"):
            if required in attrs and not attrs[required]:
                raise serializers.ValidationError({required: "Trường này không được để trống."})
        if "country_code" in attrs:
            attrs["country_code"] = attrs["country_code"].upper()
        return attrs


class CompanyInformationVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyInformationVersion
        fields = ("id", "effective_from", "status", "data", "created_at", "applied_at")
        read_only_fields = fields


class OrganizationUnitSerializer(serializers.ModelSerializer):
    version = serializers.DateTimeField(source="updated_at", read_only=True)
    manager_name = serializers.CharField(source="manager_membership.user.display_name", read_only=True, allow_null=True)
    is_effective = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationUnit
        fields = (
            "id", "company", "parent", "unit_type", "code", "name", "short_name",
            "manager_membership", "manager_name", "phone", "email", "address", "tax_code",
            "business_location_code", "start_date", "end_date", "status", "description",
            "pending_parent", "pending_move_effective_from", "is_effective", "created_at", "version",
        )
        read_only_fields = fields

    def get_is_effective(self, obj) -> bool:
        from django.utils import timezone
        today = timezone.localdate()
        return obj.status == "ACTIVE" and obj.start_date <= today and (not obj.end_date or obj.end_date >= today)


class OrganizationUnitWriteSerializer(serializers.Serializer):
    version = serializers.DateTimeField(required=False, write_only=True)
    unit_type = serializers.ChoiceField(choices=OrganizationUnit.UnitType.choices, required=False)
    code = serializers.RegexField(r"^[A-Za-z0-9_.-]+$", max_length=30, required=False)
    name = serializers.CharField(max_length=255, required=False)
    short_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    parent = serializers.UUIDField(required=False)
    manager_membership = serializers.UUIDField(required=False, allow_null=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    address = serializers.CharField(max_length=500, required=False, allow_blank=True)
    tax_code = serializers.RegexField(r"^\d{10}(?:-\d{3})?$", required=False, allow_blank=True)
    business_location_code = serializers.CharField(max_length=50, required=False, allow_blank=True)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False, allow_null=True)
    description = serializers.CharField(max_length=1000, required=False, allow_blank=True)

    def validate_code(self, value):
        return value.strip().upper()

    def validate_phone(self, value):
        if value and not re.fullmatch(r"^\+?[0-9][0-9 .()-]{7,28}$", value.strip()):
            raise serializers.ValidationError("Số điện thoại không đúng định dạng.")
        return value.strip()

    def validate(self, attrs):
        creating = self.context.get("creating")
        protected = set(self.initial_data) & {
            "id", "company", "status", "created_at", "updated_at", "pending_parent",
            "pending_move_effective_from", "created_by_user_id", "updated_by_user_id",
        }
        if protected:
            raise serializers.ValidationError({field: "Trường này không được cập nhật trực tiếp." for field in protected})
        if not creating and "parent" in self.initial_data:
            raise serializers.ValidationError({"parent": "Hãy sử dụng thao tác Di chuyển để đổi đơn vị cấp trên."})
        if not creating and "end_date" in self.initial_data:
            raise serializers.ValidationError({"end_date": "Hãy sử dụng thao tác Ngừng sử dụng để đặt ngày kết thúc."})
        if creating:
            required = {"unit_type", "code", "name", "parent", "start_date"}
            missing = {field: "Trường này là bắt buộc." for field in required - set(attrs)}
            if missing:
                raise serializers.ValidationError(missing)
        elif "version" not in attrs:
            raise serializers.ValidationError({"version": "Phiên bản dữ liệu là bắt buộc."})
        if attrs.get("unit_type") == "COMPANY":
            raise serializers.ValidationError({"unit_type": "Không được tạo thêm hoặc chuyển loại sang nút doanh nghiệp."})
        if attrs.get("start_date") and attrs.get("end_date") and attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError({"end_date": "Ngày kết thúc không được trước ngày bắt đầu."})
        return attrs


class OrganizationUnitMoveSerializer(serializers.Serializer):
    version = serializers.DateTimeField()
    parent = serializers.UUIDField()
    effective_from = serializers.DateField()
    confirm_impact = serializers.BooleanField(default=False)


class OrganizationUnitDeactivateSerializer(serializers.Serializer):
    version = serializers.DateTimeField()
    end_date = serializers.DateField()
    confirm = serializers.BooleanField()


class OrganizationUnitReactivateSerializer(serializers.Serializer):
    version = serializers.DateTimeField()
    start_date = serializers.DateField()


class OrganizationUnitHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationUnitHistory
        fields = "__all__"
        read_only_fields = tuple(field.name for field in OrganizationUnitHistory._meta.fields)


class BranchSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class DepartmentSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class PositionSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class EmployeeSerializer(ModelValidationMixin, serializers.ModelSerializer):
    version = serializers.DateTimeField(source="updated_at", read_only=True)
    linked_user = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def get_linked_user(self, obj):
        membership = obj.memberships.select_related("user").first()
        return str(membership.user_id) if membership else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        from iam.permissions import has_effective_permission
        account = getattr(getattr(request, "user", None), "iam_account", None)
        if not account or not has_effective_permission(account, instance.company, "MD.EMPLOYEE.VIEW_SENSITIVE", branch_id=instance.branch_id, department_id=instance.department_id):
            for field in ("identity_number", "personal_tax_code", "address", "date_of_birth"):
                data.pop(field, None)
        return data

    def validate(self, attrs):
        if not self.instance and attrs.get("status", "ACTIVE") not in {"ACTIVE", "DRAFT"}:
            raise serializers.ValidationError({"status": "Hồ sơ mới chỉ có thể là ACTIVE hoặc DRAFT."})
        if self.instance and any(field in attrs for field in ("branch", "department", "position")):
            raise serializers.ValidationError({"branch": "Hãy dùng API phân công để lưu lịch sử đơn vị và chức vụ."})
        if self.instance and "company" in attrs:
            raise serializers.ValidationError({"company": "Không thể chuyển nhân viên sang doanh nghiệp khác."})
        if self.instance and "employee_code" in attrs and attrs["employee_code"] != self.instance.employee_code:
            raise serializers.ValidationError({"employee_code": "Không thể đổi mã nhân viên đã tạo."})
        return super().validate(attrs)

    def validate_employee_code(self, value):
        return value.strip().upper()

    def validate_identity_number(self, value):
        value = value.strip().replace(" ", "")
        if value and Employee.objects.filter(company=self.initial_data.get("company") or getattr(self.instance, "company_id", None), identity_number=value, status="ACTIVE").exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("Số định danh đã thuộc nhân viên ACTIVE khác.")
        return value


class EmployeeBankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeBankAccount
        fields = "__all__"
        read_only_fields = ("id",)

    def validate(self, attrs):
        employee = attrs.get("employee") or getattr(self.instance, "employee", None)
        if not employee:
            raise serializers.ValidationError({"employee": "Cần chọn nhân viên."})
        if self.instance and "employee" in attrs and attrs["employee"].pk != self.instance.employee_id:
            raise serializers.ValidationError({"employee": "Không thể chuyển tài khoản ngân hàng sang nhân viên khác."})
        if employee.status == "TERMINATED":
            raise serializers.ValidationError({"employee": "Không thể thay đổi tài khoản của nhân viên đã nghỉ việc."})
        if attrs.get("is_default", getattr(self.instance, "is_default", False)) and attrs.get("is_active", getattr(self.instance, "is_active", True)) and EmployeeBankAccount.objects.filter(
            employee=employee, currency=attrs.get("currency", getattr(self.instance, "currency", "VND")), purpose=attrs.get("purpose", getattr(self.instance, "purpose", "PAYMENT")),
            is_default=True, is_active=True,
        ).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError({"is_default": "Đã có tài khoản mặc định cho mục đích và đồng tiền này."})
        return attrs


class EmployeeAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeAssignment
        fields = "__all__"
        read_only_fields = ("id", "created_at", "valid_to", "is_primary")

    def create(self, validated_data):
        try:
            return assign_employee(**validated_data)
        except ValueError as exc:
            raise serializers.ValidationError({"valid_from": str(exc)}) from exc

    def validate(self, attrs):
        candidate = EmployeeAssignment(**attrs, is_primary=False)
        try:
            candidate.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        return attrs
