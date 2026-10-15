import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class Status(models.TextChoices):
    ACTIVE = "ACTIVE", "Đang hoạt động"
    INACTIVE = "INACTIVE", "Ngừng hoạt động"


class CompanyStatus(models.TextChoices):
    PENDING_SETUP = "PENDING_SETUP", "Chờ thiết lập"
    ACTIVE = "ACTIVE", "Đang hoạt động"
    SUSPENDED = "SUSPENDED", "Tạm ngừng"
    INACTIVE = "INACTIVE", "Ngừng hoạt động"


class BusinessType(models.TextChoices):
    LLC_ONE_MEMBER = "LLC_ONE_MEMBER", "Công ty TNHH một thành viên"
    LLC_MULTI_MEMBER = "LLC_MULTI_MEMBER", "Công ty TNHH hai thành viên trở lên"
    JOINT_STOCK = "JOINT_STOCK", "Công ty cổ phần"
    PRIVATE_ENTERPRISE = "PRIVATE_ENTERPRISE", "Doanh nghiệp tư nhân"
    PARTNERSHIP = "PARTNERSHIP", "Công ty hợp danh"
    OTHER = "OTHER", "Khác"


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Company(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=100, blank=True)
    legal_name = models.CharField(max_length=255)
    tax_code = models.CharField(max_length=30, unique=True)
    business_type = models.CharField(max_length=30, choices=BusinessType.choices, blank=True)
    address = models.CharField(max_length=500, blank=True)
    province = models.CharField(max_length=100, blank=True)
    legal_representative = models.CharField(max_length=255, blank=True)
    representative_title = models.CharField(max_length=100, blank=True)
    country_code = models.CharField(max_length=2, default="VN")
    district = models.CharField(max_length=100, blank=True)
    ward = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    logo = models.FileField(upload_to="company_logos/%Y/%m/", blank=True)
    created_by_user_id = models.UUIDField(null=True, blank=True, editable=False)
    accounting_currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT, related_name="accounting_companies")
    legal_reporting_currency = models.ForeignKey("master_data.Currency", on_delete=models.PROTECT, related_name="reporting_companies")
    accounting_regime = models.CharField(max_length=30, default="TT99")
    fiscal_year_start_month = models.PositiveSmallIntegerField(default=1)
    timezone = models.CharField(max_length=80, default="Asia/Ho_Chi_Minh")
    default_locale = models.CharField(max_length=20, default="vi-VN")
    status = models.CharField(max_length=20, choices=CompanyStatus.choices, default=CompanyStatus.ACTIVE)

    class Meta:
        db_table = "org_company"
        ordering = ("code",)
        constraints = [models.CheckConstraint(condition=Q(fiscal_year_start_month__gte=1, fiscal_year_start_month__lte=12), name="ck_company_fiscal_year_start_month")]

    def save(self, *args, **kwargs):
        self.code = self.code.upper().strip()
        self.tax_code = self.tax_code.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.name}"


class CompanyInformationVersion(models.Model):
    class VersionStatus(models.TextChoices):
        PENDING = "PENDING", "Chờ hiệu lực"
        ACTIVE = "ACTIVE", "Đang hiệu lực"
        SUPERSEDED = "SUPERSEDED", "Hết hiệu lực"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="information_versions")
    effective_from = models.DateField()
    status = models.CharField(max_length=20, choices=VersionStatus.choices)
    data = models.JSONField(default=dict)
    based_on_updated_at = models.DateTimeField()
    created_by_user_id = models.UUIDField(editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "org_company_information_version"
        ordering = ("company_id", "-effective_from", "-created_at")
        indexes = [models.Index(fields=("company", "status", "effective_from"), name="ix_org_company_version_due")]


class OrganizationUnit(TimeStampedModel):
    class UnitType(models.TextChoices):
        COMPANY = "COMPANY", "Doanh nghiệp"
        BRANCH = "BRANCH", "Chi nhánh"
        DEPARTMENT = "DEPARTMENT", "Phòng ban"
        OTHER = "OTHER", "Đơn vị khác"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="organization_units")
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")
    unit_type = models.CharField(max_length=20, choices=UnitType.choices)
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=100, blank=True)
    manager_membership = models.ForeignKey(
        "iam.CompanyMembership", on_delete=models.PROTECT, null=True, blank=True,
        related_name="managed_organization_units",
    )
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=500, blank=True)
    tax_code = models.CharField(max_length=30, blank=True)
    business_location_code = models.CharField(max_length=50, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    description = models.CharField(max_length=1000, blank=True)
    pending_parent = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="pending_children"
    )
    pending_move_effective_from = models.DateField(null=True, blank=True)
    created_by_user_id = models.UUIDField(editable=False)
    updated_by_user_id = models.UUIDField(editable=False)

    class Meta:
        db_table = "org_organization_unit"
        ordering = ("company_id", "code")
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_org_unit_company_code"),
            models.UniqueConstraint(
                fields=("company",), condition=Q(unit_type="COMPANY"), name="uq_org_unit_company_root"
            ),
            models.CheckConstraint(
                condition=Q(end_date__isnull=True) | Q(end_date__gte=models.F("start_date")),
                name="ck_org_unit_dates",
            ),
        ]


class OrganizationUnitHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    unit = models.ForeignKey(OrganizationUnit, on_delete=models.PROTECT, related_name="history")
    action = models.CharField(max_length=30)
    effective_from = models.DateField()
    before = models.JSONField(default=dict)
    after = models.JSONField(default=dict)
    actor_user_id = models.UUIDField(editable=False)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "org_organization_unit_history"
        ordering = ("-occurred_at",)


class OrganizationUnitDependency(models.Model):
    class DependencyType(models.TextChoices):
        USER_ASSIGNMENT = "USER_ASSIGNMENT", "Phân công User"
        WORKFLOW = "WORKFLOW", "Workflow"
        DATA_SCOPE = "DATA_SCOPE", "Data Scope"
        OTHER = "OTHER", "Khác"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    unit = models.ForeignKey(OrganizationUnit, on_delete=models.PROTECT, related_name="dependencies")
    dependency_type = models.CharField(max_length=30, choices=DependencyType.choices)
    reference = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "org_organization_unit_dependency"
        constraints = [
            models.UniqueConstraint(
                fields=("unit", "dependency_type", "reference"), name="uq_org_unit_dependency"
            )
        ]


class Branch(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="branches")
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=255)
    tax_code = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=500, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    representative_name = models.CharField(max_length=255, blank=True)
    established_date = models.DateField(null=True, blank=True)
    closed_date = models.DateField(null=True, blank=True)
    is_head_office = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        db_table = "org_branch"
        ordering = ("company_id", "code")
        constraints = [
            models.UniqueConstraint(fields=("company", "code"), name="uq_branch_company_code"),
            models.CheckConstraint(condition=Q(closed_date__isnull=True) | Q(closed_date__gte=models.F("established_date")), name="ck_branch_dates"),
        ]

    def clean(self):
        super().clean()
        if self.parent_id:
            if self.parent_id == self.id:
                raise ValidationError({"parent": "Chi nhánh không thể là cha của chính nó."})
            if self.parent.company_id != self.company_id:
                raise ValidationError({"parent": "Chi nhánh cha phải thuộc cùng doanh nghiệp."})
            ancestor, visited = self.parent, {self.id}
            while ancestor:
                if ancestor.id in visited:
                    raise ValidationError({"parent": "Cây chi nhánh không được tạo chu trình."})
                visited.add(ancestor.id)
                ancestor = ancestor.parent

    def __str__(self):
        return f"{self.code} - {self.name}"


class Position(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="positions")
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=150)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        db_table = "org_position"
        ordering = ("company_id", "code")
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_position_company_code")]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Department(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="departments")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="departments")
    parent = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="children")
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=255)
    manager = models.ForeignKey("Employee", on_delete=models.PROTECT, null=True, blank=True, related_name="managed_departments")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        db_table = "org_department"
        ordering = ("company_id", "code")
        constraints = [models.UniqueConstraint(fields=("company", "code"), name="uq_department_company_code")]

    def clean(self):
        super().clean()
        errors = {}
        if self.branch_id and self.company_id and self.branch.company_id != self.company_id:
            errors["branch"] = "Chi nhánh phải thuộc cùng doanh nghiệp."
        if self.parent_id:
            if self.parent_id == self.id:
                errors["parent"] = "Phòng ban không thể là cha của chính nó."
            elif self.parent.company_id != self.company_id:
                errors["parent"] = "Phòng ban cha phải thuộc cùng doanh nghiệp."
            else:
                ancestor, visited = self.parent, {self.id}
                while ancestor:
                    if ancestor.id in visited:
                        errors["parent"] = "Cây phòng ban không được tạo chu trình."
                        break
                    visited.add(ancestor.id)
                    ancestor = ancestor.parent
        if self.manager_id and self.manager.company_id != self.company_id:
            errors["manager"] = "Trưởng phòng phải thuộc cùng doanh nghiệp."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.code} - {self.name}"


class Employee(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="employees")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True, related_name="employees")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True, blank=True, related_name="employees")
    position = models.ForeignKey(Position, on_delete=models.PROTECT, null=True, blank=True, related_name="employees")
    employee_code = models.CharField(max_length=30)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    identity_number = models.CharField(max_length=30, blank=True)
    personal_tax_code = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    manager = models.ForeignKey("self", on_delete=models.PROTECT, null=True, blank=True, related_name="direct_reports")
    employment_type = models.CharField(max_length=50, blank=True)
    cost_center = models.CharField(max_length=50, blank=True)
    track_advances = models.BooleanField(default=False)
    advance_account = models.CharField(max_length=30, blank=True)
    expense_account = models.CharField(max_length=30, blank=True)
    payment_method = models.CharField(max_length=20, blank=True)
    track_detail_balance = models.BooleanField(default=False)
    advance_limit = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    require_advance_settlement = models.BooleanField(default=False)
    hire_date = models.DateField(null=True, blank=True)
    termination_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=(("DRAFT", "Nháp"), ("ACTIVE", "Đang hoạt động"), ("INACTIVE", "Ngừng sử dụng"), ("TERMINATED", "Đã nghỉ việc")), default="ACTIVE")

    class Meta:
        db_table = "org_employee"
        ordering = ("company_id", "employee_code")
        constraints = [
            models.UniqueConstraint(fields=("company", "employee_code"), name="uq_employee_company_code"),
            models.CheckConstraint(condition=Q(termination_date__isnull=True) | Q(termination_date__gte=models.F("hire_date")), name="ck_employee_dates"),
        ]

    def clean(self):
        super().clean()
        errors = {}
        if self.branch_id and self.company_id and self.branch.company_id != self.company_id:
            errors["branch"] = "Chi nhánh phải thuộc cùng doanh nghiệp."
        if self.department_id:
            if self.department.company_id != self.company_id:
                errors["department"] = "Phòng ban phải thuộc cùng doanh nghiệp."
            elif self.department.branch_id != self.branch_id:
                errors["department"] = "Phòng ban phải thuộc chi nhánh của nhân viên."
        if self.position_id and self.position.company_id != self.company_id:
            errors["position"] = "Chức vụ phải thuộc cùng doanh nghiệp."
        if self.branch_id and self.branch.status != Status.ACTIVE and self.status == "ACTIVE":
            errors["branch"] = "Chi nhánh đã ngừng hoạt động."
        if self.department_id and self.department.status != Status.ACTIVE and self.status == "ACTIVE":
            errors["department"] = "Phòng ban đã ngừng hoạt động."
        if self.position_id and self.position.status != Status.ACTIVE and self.status == "ACTIVE":
            errors["position"] = "Chức vụ đã ngừng hoạt động."
        if self.manager_id and (self.manager_id == self.pk or self.manager.company_id != self.company_id):
            errors["manager"] = "Người quản lý phải là nhân viên khác trong cùng doanh nghiệp."
        if self.status == "ACTIVE" and not self.branch_id:
            errors["branch"] = "Nhân viên ACTIVE phải có chi nhánh."
        if self.status == "TERMINATED" and not self.termination_date:
            errors["termination_date"] = "Cần ngày kết thúc khi nghỉ việc."
        if self.termination_date and self.hire_date and self.termination_date < self.hire_date:
            errors["termination_date"] = "Ngày kết thúc không được trước ngày bắt đầu."
        if self.advance_limit is not None and self.advance_limit < 0:
            errors["advance_limit"] = "Hạn mức tạm ứng không được âm."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.employee_code} - {self.full_name}"


class EmployeeBankAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="bank_accounts")
    account_holder = models.CharField(max_length=255)
    account_number = models.CharField(max_length=50)
    bank_name = models.CharField(max_length=255)
    bank_branch = models.CharField(max_length=255, blank=True)
    currency = models.CharField(max_length=3, default="VND")
    purpose = models.CharField(max_length=30, default="PAYMENT")
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "org_employee_bank_account"
        constraints = [models.UniqueConstraint(fields=("employee", "currency", "purpose"), condition=Q(is_default=True, is_active=True), name="uq_employee_default_bank_purpose")]


class EmployeeAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="assignments")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="employee_assignments")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True, blank=True, related_name="employee_assignments")
    position = models.ForeignKey(Position, on_delete=models.PROTECT, null=True, blank=True, related_name="employee_assignments")
    valid_from = models.DateField()
    valid_to = models.DateField(null=True, blank=True)
    is_primary = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "org_employee_assignment"
        ordering = ("employee_id", "-valid_from")
        constraints = [
            models.UniqueConstraint(fields=("employee", "valid_from"), name="uq_employee_assignment_version"),
            models.CheckConstraint(condition=Q(valid_to__isnull=True) | Q(valid_to__gte=models.F("valid_from")), name="ck_employee_assignment_dates"),
        ]

    def clean(self):
        super().clean()
        errors = {}
        company_id = self.employee.company_id if self.employee_id else None
        if self.branch_id and company_id and self.branch.company_id != company_id:
            errors["branch"] = "Chi nhánh phân công phải thuộc doanh nghiệp của nhân viên."
        if self.department_id:
            if self.department.company_id != company_id:
                errors["department"] = "Phòng ban phân công phải thuộc doanh nghiệp của nhân viên."
            elif self.department.branch_id != self.branch_id:
                errors["department"] = "Phòng ban phân công phải thuộc chi nhánh đã chọn."
        if self.position_id and self.position.company_id != company_id:
            errors["position"] = "Chức vụ phân công phải thuộc doanh nghiệp của nhân viên."
        if self.employee_id and self.is_primary and self.valid_from:
            overlaps = type(self).objects.filter(employee=self.employee, is_primary=True).exclude(pk=self.pk)
            if self.valid_to:
                overlaps = overlaps.filter(valid_from__lte=self.valid_to)
            overlaps = overlaps.filter(Q(valid_to__isnull=True) | Q(valid_to__gte=self.valid_from))
            if overlaps.exists():
                errors["valid_from"] = "Khoảng phân công chính bị chồng lấn."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.employee} từ {self.valid_from}"
