"""
Master Data Catalog Export Service & API (UC-MD-16).
Supports 14 catalogues + cost-centers with strict IAM data-scope enforcement,
formula-injection protection, direct/background execution, 24h retention, and Audit Logging.
"""
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
import io
import re
from typing import Any, Callable, Dict, List, Optional
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import models as dj_models
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from audit_log.models import AuditResult
from audit_log.services import record_audit
from common_services.services import create_notification
from general_ledger.models import Account
from iam.permissions import assignment_permission_codes, effective_assignments, has_effective_permission
from organization.models import Company, Employee
from . import models


@dataclass(frozen=True)
class ExportColumn:
    title: str
    field: str
    type: str = "text"  # "text", "number", "date", "datetime", "boolean"
    is_string_id: bool = False  # preserve leading 0s (BR-MD-EXP-18)
    getter: Optional[Callable[[Any], Any]] = None


@dataclass(frozen=True)
class ExportTarget:
    target_key: str
    catalog_code: str  # Code used for file naming [MaDanhMuc]_[timestamp].xlsx (BR-MD-EXP-20)
    name: str  # Friendly Vietnamese name
    model: type
    resource: str  # IAM resource code
    columns: List[ExportColumn]
    role: str = ""
    search_fields: tuple = ("code", "name")
    ordering: tuple = ("code",)


def status_display(val: Any) -> str:
    mapping = {
        "ACTIVE": "Đang hoạt động",
        "INACTIVE": "Ngừng sử dụng",
        "DRAFT": "Nháp",
        "BLOCKED": "Khóa giao dịch",
        "MERGED": "Đã hợp nhất",
        "ARCHIVED": "Lưu trữ",
        "TERMINATED": "Đã nghỉ việc",
    }
    return mapping.get(str(val), str(val) if val is not None else "")


TARGET_CONFIGS: Dict[str, ExportTarget] = {
    "customers": ExportTarget(
        target_key="customers",
        catalog_code="KHACH_HANG",
        name="Khách hàng",
        model=models.Party,
        resource="MD.PARTY",
        role="CUSTOMER",
        columns=[
            ExportColumn("Mã khách hàng", "code", is_string_id=True),
            ExportColumn("Tên khách hàng", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Tên pháp lý", "legal_name"),
            ExportColumn("Tên viết tắt", "short_name"),
            ExportColumn(
                "Loại đối tượng",
                "party_type",
                getter=lambda r: "Tổ chức" if r.party_type == "ORGANIZATION" else ("Hộ kinh doanh" if r.party_type == "HOUSEHOLD_BUSINESS" else "Cá nhân"),
            ),
            ExportColumn("Mã số thuế", "tax_code", is_string_id=True),
            ExportColumn("Số CMND/CCCD", "identity_no", is_string_id=True),
            ExportColumn("Người đại diện", "representative"),
            ExportColumn("Nhóm khách hàng", "customer_group"),
            ExportColumn("Chi nhánh", "branch", getter=lambda r: r.branch.code if r.branch else ""),
            ExportColumn("Điều khoản thanh toán", "payment_term", getter=lambda r: r.payment_term.code if r.payment_term else ""),
            ExportColumn("Tiền tệ ngầm định", "default_currency", getter=lambda r: r.default_currency.code if r.default_currency else ""),
            ExportColumn("Ghi chú", "notes"),
        ],
    ),
    "suppliers": ExportTarget(
        target_key="suppliers",
        catalog_code="NHA_CUNG_CAP",
        name="Nhà cung cấp",
        model=models.Party,
        resource="MD.PARTY",
        role="VENDOR",
        columns=[
            ExportColumn("Mã nhà cung cấp", "code", is_string_id=True),
            ExportColumn("Tên nhà cung cấp", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Tên pháp lý", "legal_name"),
            ExportColumn("Tên viết tắt", "short_name"),
            ExportColumn(
                "Loại đối tượng",
                "party_type",
                getter=lambda r: "Tổ chức" if r.party_type == "ORGANIZATION" else ("Hộ kinh doanh" if r.party_type == "HOUSEHOLD_BUSINESS" else "Cá nhân"),
            ),
            ExportColumn("Mã số thuế", "tax_code", is_string_id=True),
            ExportColumn("Người đại diện", "representative"),
            ExportColumn("Chi nhánh", "branch", getter=lambda r: r.branch.code if r.branch else ""),
            ExportColumn("Điều khoản thanh toán", "payment_term", getter=lambda r: r.payment_term.code if r.payment_term else ""),
            ExportColumn("Tiền tệ ngầm định", "default_currency", getter=lambda r: r.default_currency.code if r.default_currency else ""),
            ExportColumn("Ghi chú", "notes"),
        ],
    ),
    "employees": ExportTarget(
        target_key="employees",
        catalog_code="NHAN_VIEN",
        name="Nhân viên",
        model=Employee,
        resource="MD.EMPLOYEE",
        search_fields=("employee_code", "full_name"),
        ordering=("employee_code",),
        columns=[
            ExportColumn("Mã nhân viên", "employee_code", is_string_id=True),
            ExportColumn("Họ và tên", "full_name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Chi nhánh", "branch", getter=lambda r: r.branch.code if r.branch else ""),
            ExportColumn("Phòng ban", "department", getter=lambda r: r.department.name if r.department else ""),
            ExportColumn("Chức vụ", "position", getter=lambda r: r.position.name if r.position else ""),
            ExportColumn("Số điện thoại", "phone", is_string_id=True),
            ExportColumn("Email", "email"),
            ExportColumn("Ngày sinh", "date_of_birth", type="date"),
            ExportColumn("Giới tính", "gender"),
            ExportColumn("Căn cước công dân", "identity_number", is_string_id=True),
            ExportColumn("Mã số thuế cá nhân", "personal_tax_code", is_string_id=True),
            ExportColumn("Địa chỉ", "address"),
            ExportColumn("Ngày vào làm", "hire_date", type="date"),
            ExportColumn("Ngày nghỉ việc", "termination_date", type="date"),
            ExportColumn("Hạn mức tạm ứng", "advance_limit", type="number"),
            ExportColumn("Ghi chú", "notes"),
        ],
    ),
    "items": ExportTarget(
        target_key="items",
        catalog_code="VAT_TU_HANG_HOA",
        name="Vật tư, hàng hóa và dịch vụ",
        model=models.Item,
        resource="MD.ITEM",
        columns=[
            ExportColumn("Mã vật tư hàng hóa", "code", is_string_id=True),
            ExportColumn("Tên vật tư hàng hóa", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Tên thay thế", "alternate_name"),
            ExportColumn(
                "Tính chất",
                "item_type",
                getter=lambda r: {"MATERIAL": "Vật tư", "GOODS": "Hàng hóa", "FINISHED_GOOD": "Thành phẩm", "SERVICE": "Dịch vụ"}.get(r.item_type, r.item_type),
            ),
            ExportColumn("Nhóm hàng hóa", "category", getter=lambda r: r.category.code if r.category else ""),
            ExportColumn("Chi nhánh", "branch", getter=lambda r: r.branch.code if r.branch else ""),
            ExportColumn("Đơn vị tính cơ sở", "base_uom", getter=lambda r: r.base_uom.code if r.base_uom else ""),
            ExportColumn("Đơn vị mua", "purchase_uom", getter=lambda r: r.purchase_uom.code if r.purchase_uom else ""),
            ExportColumn("Đơn vị bán", "sales_uom", getter=lambda r: r.sales_uom.code if r.sales_uom else ""),
            ExportColumn("Giá mua", "purchase_price", type="number"),
            ExportColumn("Giá bán", "sales_price", type="number"),
            ExportColumn("Theo dõi tồn kho", "track_inventory", type="boolean"),
            ExportColumn("Theo dõi theo lô", "track_lot", type="boolean"),
            ExportColumn("Theo dõi serial", "track_serial", type="boolean"),
            ExportColumn("Theo dõi hạn sử dụng", "track_expiry", type="boolean"),
            ExportColumn("Tồn tối thiểu", "min_stock", type="number"),
            ExportColumn("Tồn tối đa", "max_stock", type="number"),
            ExportColumn("Tài khoản kho", "inventory_account", getter=lambda r: r.inventory_account.code if r.inventory_account else ""),
            ExportColumn("Tài khoản doanh thu", "revenue_account", getter=lambda r: r.revenue_account.code if r.revenue_account else ""),
            ExportColumn("Tài khoản giá vốn", "cogs_account", getter=lambda r: r.cogs_account.code if r.cogs_account else ""),
            ExportColumn("Tài khoản chi phí", "expense_account", getter=lambda r: r.expense_account.code if r.expense_account else ""),
            ExportColumn("Thuế suất mua", "purchase_tax_rate", getter=lambda r: r.purchase_tax_rate.code if r.purchase_tax_rate else ""),
            ExportColumn("Thuế suất bán", "sales_tax_rate", getter=lambda r: r.sales_tax_rate.code if r.sales_tax_rate else ""),
            ExportColumn("Mô tả", "description"),
        ],
    ),
    "item-categories": ExportTarget(
        target_key="item-categories",
        catalog_code="NHOM_HANG_HOA",
        name="Nhóm hàng hóa, dịch vụ",
        model=models.ItemCategory,
        resource="MD.ITEM_GROUP",
        columns=[
            ExportColumn("Mã nhóm", "code", is_string_id=True),
            ExportColumn("Tên nhóm", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Nhóm cha", "parent", getter=lambda r: r.parent.code if r.parent else ""),
            ExportColumn("Cấp bậc", "depth", type="number"),
            ExportColumn("Chi nhánh", "branch", getter=lambda r: r.branch.code if r.branch else ""),
            ExportColumn("Mô tả", "description"),
        ],
    ),
    "units-of-measure": ExportTarget(
        target_key="units-of-measure",
        catalog_code="DON_VI_TINH",
        name="Đơn vị tính",
        model=models.UnitOfMeasure,
        resource="MD.UOM",
        columns=[
            ExportColumn("Mã đơn vị tính", "code", is_string_id=True),
            ExportColumn("Tên đơn vị tính", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Ký hiệu", "symbol"),
            ExportColumn("Loại đo lường", "measurement_type"),
            ExportColumn("Số chữ số thập phân", "decimal_places", type="number"),
            ExportColumn("Chỉ dùng số nguyên", "integer_only", type="boolean"),
            ExportColumn("Là đơn vị chuẩn", "is_reference", type="boolean"),
            ExportColumn("Đơn vị tham chiếu", "reference_uom", getter=lambda r: r.reference_uom.code if r.reference_uom else ""),
            ExportColumn("Tỷ lệ quy đổi", "factor_to_reference", type="number"),
        ],
    ),
    "warehouses": ExportTarget(
        target_key="warehouses",
        catalog_code="KHO",
        name="Kho",
        model=models.Warehouse,
        resource="MD.WAREHOUSE",
        columns=[
            ExportColumn("Mã kho", "code", is_string_id=True),
            ExportColumn("Tên kho", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Loại kho", "warehouse_type"),
            ExportColumn("Địa chỉ", "address"),
            ExportColumn("Chi nhánh", "branch", getter=lambda r: r.branch.code if r.branch else ""),
            ExportColumn("Kho mặc định", "is_default", type="boolean"),
            ExportColumn("Cho phép nhập", "allow_receipt", type="boolean"),
            ExportColumn("Cho phép xuất", "allow_issue", type="boolean"),
            ExportColumn("Cho phép chuyển kho", "allow_transfer", type="boolean"),
            ExportColumn("Cho phép xuất âm", "allow_negative", type="boolean"),
            ExportColumn("Thủ kho", "keeper_employee", getter=lambda r: r.keeper_employee.full_name if r.keeper_employee else ""),
            ExportColumn("Mô tả", "description"),
        ],
    ),
    "company-bank-accounts": ExportTarget(
        target_key="company-bank-accounts",
        catalog_code="TAI_KHOAN_NGAN_HANG",
        name="Tài khoản ngân hàng",
        model=models.CompanyBankAccount,
        resource="MD.BANK_ACCOUNT",
        search_fields=("code", "account_number", "account_name"),
        ordering=("code", "account_number"),
        columns=[
            ExportColumn("Mã tài khoản", "code", is_string_id=True),
            ExportColumn("Số tài khoản", "account_number", is_string_id=True),
            ExportColumn("Tên tài khoản", "account_name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Ngân hàng", "bank", getter=lambda r: r.bank.name if r.bank else ""),
            ExportColumn("Chi nhánh ngân hàng", "bank_branch"),
            ExportColumn("Loại tài khoản", "account_type"),
            ExportColumn("Loại tiền", "currency", getter=lambda r: r.currency.code if r.currency else ""),
            ExportColumn("Chi nhánh quản lý", "branch", getter=lambda r: r.branch.code if r.branch else ""),
            ExportColumn("Tài khoản kế toán", "gl_account", getter=lambda r: r.gl_account.code if r.gl_account else ""),
            ExportColumn("Mặc định", "is_default", type="boolean"),
            ExportColumn("Cho phép thu", "allow_receipt", type="boolean"),
            ExportColumn("Cho phép chi", "allow_payment", type="boolean"),
            ExportColumn("Ngày mở", "opened_date", type="date"),
            ExportColumn("Ngày đóng", "closed_date", type="date"),
            ExportColumn("Ghi chú", "notes"),
        ],
    ),
    "accounts": ExportTarget(
        target_key="accounts",
        catalog_code="HE_THONG_TAI_KHOAN",
        name="Hệ thống tài khoản kế toán",
        model=Account,
        resource="MD.ACCOUNT",
        columns=[
            ExportColumn("Mã tài khoản", "code", is_string_id=True),
            ExportColumn("Tên tài khoản", "name"),
            ExportColumn("Tên tiếng Anh", "name_en"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Cấp tài khoản", "account_level", type="number"),
            ExportColumn("Tính chất tài khoản", "account_type", getter=lambda r: r.get_account_type_display() if hasattr(r, "get_account_type_display") else r.account_type),
            ExportColumn("Tính chất số dư", "normal_balance", getter=lambda r: r.get_normal_balance_display() if hasattr(r, "get_normal_balance_display") else r.normal_balance),
            ExportColumn("Tài khoản mẹ", "parent", getter=lambda r: r.parent.code if r.parent else ""),
            ExportColumn("Cho phép hạch toán", "is_postable", type="boolean"),
            ExportColumn("Theo dõi đối tượng", "requires_party", type="boolean"),
            ExportColumn("Theo dõi dự án", "requires_project", type="boolean"),
            ExportColumn("Theo dõi trung tâm chi phí", "requires_cost_center", type="boolean"),
            ExportColumn("Theo dõi kho", "requires_warehouse", type="boolean"),
            ExportColumn("Tiền tệ mặc định", "default_currency"),
            ExportColumn("Mô tả", "description"),
        ],
    ),
    "expense-items": ExportTarget(
        target_key="expense-items",
        catalog_code="KHOAN_MUC_CHI_PHI",
        name="Khoản mục chi phí",
        model=models.ExpenseItem,
        resource="MD.EXPENSE_ITEM",
        columns=[
            ExportColumn("Mã khoản mục", "code", is_string_id=True),
            ExportColumn("Tên khoản mục", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Khoản mục cha", "parent", getter=lambda r: r.parent.code if r.parent else ""),
            ExportColumn("Loại chi phí", "expense_type"),
            ExportColumn("Tài khoản ngầm định", "default_account", getter=lambda r: r.default_account.code if r.default_account else ""),
            ExportColumn("Ngày bắt đầu", "start_date", type="date"),
            ExportColumn("Ngày kết thúc", "end_date", type="date"),
            ExportColumn("Mô tả", "description"),
        ],
    ),
    "statistical-codes": ExportTarget(
        target_key="statistical-codes",
        catalog_code="MA_THONG_KE",
        name="Mã thống kê",
        model=models.StatisticalCode,
        resource="MD.STATISTICAL_CODE",
        columns=[
            ExportColumn("Mã thống kê", "code", is_string_id=True),
            ExportColumn("Tên mã thống kê", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Mã cha", "parent", getter=lambda r: r.parent.code if r.parent else ""),
            ExportColumn("Phân loại", "category"),
            ExportColumn("Phạm vi áp dụng", "applicable_scope"),
            ExportColumn("Cho phép chọn trên chứng từ", "allow_voucher_selection", type="boolean"),
            ExportColumn("Ngày bắt đầu", "start_date", type="date"),
            ExportColumn("Ngày kết thúc", "end_date", type="date"),
            ExportColumn("Mô tả", "description"),
        ],
    ),
    "tax-types": ExportTarget(
        target_key="tax-types",
        catalog_code="LOAI_THUE",
        name="Loại thuế",
        model=models.TaxType,
        resource="MD.TAX_TYPE",
        columns=[
            ExportColumn("Mã loại thuế", "code", is_string_id=True),
            ExportColumn("Tên loại thuế", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Mô tả", "description"),
        ],
    ),
    "tax-rates": ExportTarget(
        target_key="tax-rates",
        catalog_code="THUE_SUAT",
        name="Thuế suất",
        model=models.TaxRate,
        resource="MD.TAX_RATE",
        columns=[
            ExportColumn("Mã thuế suất", "code", is_string_id=True),
            ExportColumn("Tên thuế suất", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Loại thuế", "tax_type", getter=lambda r: r.tax_type.code if r.tax_type else ""),
            ExportColumn("Thuế suất (%)", "rate", type="number"),
            ExportColumn("Ngày hiệu lực", "effective_from", type="date"),
            ExportColumn("Ngày hết hạn", "effective_to", type="date"),
            ExportColumn("Mô tả", "description"),
        ],
    ),
    "payment-terms": ExportTarget(
        target_key="payment-terms",
        catalog_code="DIEU_KHOAN_THANH_TOAN",
        name="Điều khoản thanh toán",
        model=models.PaymentTerm,
        resource="MD.PAYMENT_TERM",
        columns=[
            ExportColumn("Mã điều khoản", "code", is_string_id=True),
            ExportColumn("Tên điều khoản", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Số ngày được nợ", "due_days", type="number"),
            ExportColumn("Số ngày hưởng chiết khấu", "discount_days", type="number"),
            ExportColumn("Tỷ lệ chiết khấu (%)", "discount_rate", type="number"),
            ExportColumn("Mô tả", "description"),
        ],
    ),
    "payment-methods": ExportTarget(
        target_key="payment-methods",
        catalog_code="PHUONG_THUC_THANH_TOAN",
        name="Phương thức thanh toán",
        model=models.PaymentMethod,
        resource="MD.PAYMENT_METHOD",
        columns=[
            ExportColumn("Mã phương thức", "code", is_string_id=True),
            ExportColumn("Tên phương thức", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn(
                "Nhóm phương thức",
                "group",
                getter=lambda r: {"CASH": "Tiền mặt", "BANK": "Ngân hàng"}.get(r.group, r.group),
            ),
            ExportColumn("Phạm vi", "scope"),
            ExportColumn("Yêu cầu số tham chiếu", "requires_reference", type="boolean"),
            ExportColumn("Yêu cầu tài khoản ngân hàng", "requires_bank_account", type="boolean"),
            ExportColumn("Hỗ trợ đối soát tự động", "supports_auto_reconcile", type="boolean"),
            ExportColumn("Mô tả", "description"),
        ],
    ),
    "cost-centers": ExportTarget(
        target_key="cost-centers",
        catalog_code="TRUNG_TAM_CHI_PHI",
        name="Trung tâm chi phí",
        model=models.CostCenter,
        resource="MD.ORGANIZATION",
        columns=[
            ExportColumn("Mã trung tâm chi phí", "code", is_string_id=True),
            ExportColumn("Tên trung tâm chi phí", "name"),
            ExportColumn("Trạng thái", "status", getter=lambda r: status_display(r.status)),
            ExportColumn("Trung tâm cha", "parent", getter=lambda r: r.parent.code if r.parent else ""),
            ExportColumn("Mô tả", "description"),
        ],
    ),
}

# Alias mapping for versatile query matching
TARGET_ALIASES: Dict[str, str] = {
    "customers": "customers", "customer": "customers", "khach_hang": "customers", "khach-hang": "customers",
    "suppliers": "suppliers", "supplier": "suppliers", "vendors": "suppliers", "vendor": "suppliers",
    "nha_cung_cap": "suppliers", "nha-cung-cap": "suppliers",
    "employees": "employees", "employee": "employees", "nhan_vien": "employees", "nhan-vien": "employees",
    "items": "items", "item": "items", "vat_tu_hang_hoa": "items", "vat-tu-hang-hoa": "items",
    "item-categories": "item-categories", "item_categories": "item-categories", "nhom_hang_hoa": "item-categories",
    "units-of-measure": "units-of-measure", "uom": "units-of-measure", "don_vi_tinh": "units-of-measure",
    "warehouses": "warehouses", "warehouse": "warehouses", "kho": "warehouses",
    "company-bank-accounts": "company-bank-accounts", "bank-accounts": "company-bank-accounts", "tai_khoan_ngan_hang": "company-bank-accounts",
    "accounts": "accounts", "account": "accounts", "he_thong_tai_khoan": "accounts",
    "expense-items": "expense-items", "expense_items": "expense-items", "khoan_muc_chi_phi": "expense-items",
    "statistical-codes": "statistical-codes", "statistical_codes": "statistical-codes", "ma_thong_ke": "statistical-codes",
    "tax-types": "tax-types", "tax_types": "tax-types", "loai_thue": "tax-types",
    "tax-rates": "tax-rates", "tax_rates": "tax-rates", "thue_suat": "tax-rates",
    "payment-terms": "payment-terms", "payment_terms": "payment-terms", "dieu_khoan_thanh_toan": "payment-terms",
    "payment-methods": "payment-methods", "payment_methods": "payment-methods", "phuong_thuc_thanh_toan": "payment-methods",
    "cost-centers": "cost-centers", "cost_centers": "cost-centers", "trung_tam_chi_phi": "cost-centers",
}


def resolve_target(name: str) -> Optional[ExportTarget]:
    if not name:
        return None
    normalized = str(name).strip().lower().replace(" ", "_")
    key = TARGET_ALIASES.get(normalized) or TARGET_ALIASES.get(normalized.replace("_", "-"))
    if not key and normalized in TARGET_CONFIGS:
        key = normalized
    return TARGET_CONFIGS.get(key)


def catalogue_grant(account, company, target: ExportTarget, action_code: str) -> bool:
    code = f"{target.resource}.{action_code}"
    if has_effective_permission(account, company, code):
        return True
    if not any(field.name == "branch" for field in target.model._meta.fields):
        return False
    return any(code in assignment_permission_codes(assignment) for assignment in effective_assignments(account, company))


def check_user_export_permissions(user, company, target_config: ExportTarget):
    """
    BR-MD-EXP-01: User phải có Permission xem và Permission Export đối với danh mục tương ứng.
    EF-01: Không có quyền Export -> 403 Forbidden.
    """
    if getattr(user, "is_superuser", False):
        return
    account = getattr(user, "iam_account", None)
    if not account:
        raise PermissionDenied("Bạn không có quyền Export danh mục này.")
    has_view = catalogue_grant(account, company, target_config, "VIEW")
    has_export = catalogue_grant(account, company, target_config, "EXPORT")
    if not (has_view and has_export):
        raise PermissionDenied("Bạn không có quyền Export danh mục này.")


def get_scoped_queryset(user, company, target_config: ExportTarget, export_scope: str = "ALL", selected_ids: Optional[List[str]] = None, filter_params: Optional[Dict[str, Any]] = None):
    """
    Builds the scoped QuerySet applying Permission, Data Scope, and Export Scope (BR-MD-EXP-03, 04, 05, 08, 09, 10, 11).
    """
    model = target_config.model
    if target_config.target_key == "customers":
        qs = model.objects.filter(company=company, roles__role_type="CUSTOMER").distinct()
    elif target_config.target_key == "suppliers":
        qs = model.objects.filter(company=company, roles__role_type="VENDOR").distinct()
    elif target_config.target_key == "accounts":
        qs = model.objects.filter(company=company)
    else:
        qs = model.objects.filter(company=company)

    # 1. Apply IAM Data Scope (BR-MD-EXP-04, 05, 11)
    if not getattr(user, "is_superuser", False):
        account = getattr(user, "iam_account", None)
        assignments = list(effective_assignments(account, company)) if account else []
        relevant_assignments = [
            a for a in assignments
            if f"{target_config.resource}.EXPORT" in assignment_permission_codes(a)
            or f"{target_config.resource}.VIEW" in assignment_permission_codes(a)
        ]
        has_full_scope = any(
            a.data_scope_set is None or a.data_scope_set.allow_all_company_data
            for a in relevant_assignments
        )
        if not has_full_scope and relevant_assignments:
            branches = set()
            departments = set()
            warehouses = set()
            bank_accounts = set()
            owned = False
            for a in relevant_assignments:
                scope = a.data_scope_set
                if scope:
                    branches.update(scope.branch_scopes.values_list("branch_id", flat=True))
                    departments.update(scope.department_scopes.values_list("department_id", flat=True))
                    warehouses.update(scope.warehouse_scopes.values_list("warehouse_id", flat=True))
                    bank_accounts.update(scope.bank_account_scopes.values_list("company_bank_account_id", flat=True))
                    owned |= scope.allow_owned_records

            if model is models.Party:
                cond = Q(branch_id__in=branches)
                if owned:
                    cond |= Q(owner=account)
                qs = qs.filter(cond)
            elif model is Employee:
                cond = Q(branch_id__in=branches) | Q(department_id__in=departments)
                qs = qs.filter(cond)
            elif model is models.Warehouse:
                qs = qs.filter(pk__in=warehouses)
            elif model is models.CompanyBankAccount:
                qs = qs.filter(pk__in=bank_accounts)
            elif any(field.name == "branch" for field in model._meta.fields):
                qs = qs.filter(branch_id__in=branches)

    # 2. Apply Export Scope (BR-MD-EXP-07, 08, 09, 10, 11)
    export_scope = (export_scope or "ALL").upper()
    filter_params = filter_params or {}

    if export_scope == "SELECTED":
        # BR-MD-EXP-07, 11: Only selected records that are inside the data scope
        selected_ids = selected_ids or []
        qs = qs.filter(pk__in=selected_ids)
    elif export_scope == "FILTERED":
        # BR-MD-EXP-08, 09: Apply filters, search keywords, ordering across all matching records
        search_term = str(filter_params.get("search") or filter_params.get("q") or "").strip()
        if search_term:
            q_filter = Q()
            for sf in target_config.search_fields:
                q_filter |= Q(**{f"{sf}__icontains": search_term})
            qs = qs.filter(q_filter)

        # Additional specific field filters
        for param, val in filter_params.items():
            if param in ("search", "q", "page", "page_size", "limit", "offset", "format", "company_id", "scope"):
                continue
            if val is not None and val != "":
                if any(field.name == param for field in model._meta.fields):
                    qs = qs.filter(**{param: val})
    # If scope is ALL: BR-MD-EXP-10: ignore screen filters, export all scoped data

    if target_config.ordering:
        qs = qs.order_by(*target_config.ordering)
    return qs


def sanitize_excel_cell_value(val: Any) -> Any:
    """
    BR-MD-EXP-19: Values starting with '=', '+', '-', '@' must be escaped to prevent Excel formula execution.
    """
    if val is None:
        return ""
    if isinstance(val, str):
        cleaned = val.strip()
        if cleaned and cleaned[0] in ("=", "+", "-", "@"):
            return f"'{cleaned}"
        return cleaned
    return val


def generate_excel(target_config: ExportTarget, queryset, company: Company) -> bytes:
    """
    BR-MD-EXP-12: Excel .xlsx format
    BR-MD-EXP-13: Row 1 = header names, subsequent rows = catalog records
    BR-MD-EXP-14: Mã, Tên, Trạng thái and main business fields
    BR-MD-EXP-15: No internal UUIDs, passwords, secrets
    BR-MD-EXP-16: Date dd/MM/yyyy, DateTime dd/MM/yyyy HH:mm:ss
    BR-MD-EXP-17: Numbers as Excel numbers
    BR-MD-EXP-18: Phone, Tax code, Bank account, Identity numbers preserved as text strings with leading 0s
    BR-MD-EXP-19: Formula injection protection
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = target_config.name[:31]

    # Header styling
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style="thin", color="D9D9D9"),
        right=Side(style="thin", color="D9D9D9"),
        top=Side(style="thin", color="D9D9D9"),
        bottom=Side(style="thin", color="D9D9D9"),
    )

    # Write headers
    for col_idx, col in enumerate(target_config.columns, 1):
        cell = ws.cell(row=1, column=col_idx, value=col.title)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    ws.row_dimensions[1].height = 28

    tz = ZoneInfo("Asia/Ho_Chi_Minh")

    # Write data rows
    row_num = 2
    for record in queryset.iterator():
        ws.row_dimensions[row_num].height = 20
        for col_idx, col in enumerate(target_config.columns, 1):
            cell = ws.cell(row=row_num, column=col_idx)
            cell.border = thin_border

            # Extract raw value
            if col.getter:
                raw_val = col.getter(record)
            else:
                raw_val = getattr(record, col.field, None)

            # Format cell based on type & rule
            if raw_val is None or raw_val == "":
                cell.value = ""
            elif col.is_string_id:
                # BR-MD-EXP-18: String ID / Tax / Phone / Account Number -> Must be saved as text
                str_val = str(raw_val).strip()
                cell.value = sanitize_excel_cell_value(str_val)
                cell.data_type = "s"
                cell.number_format = "@"
                cell.alignment = Alignment(horizontal="left", vertical="center")
            elif col.type == "number" or isinstance(raw_val, (int, float, Decimal)):
                # BR-MD-EXP-17: Numeric value
                num_val = float(raw_val) if isinstance(raw_val, Decimal) else raw_val
                cell.value = num_val
                cell.data_type = "n"
                cell.alignment = Alignment(horizontal="right", vertical="center")
            elif col.type == "boolean" or isinstance(raw_val, bool):
                cell.value = "Có" if raw_val else "Không"
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif isinstance(raw_val, datetime):
                # BR-MD-EXP-16: DateTime dd/MM/yyyy HH:mm:ss
                dt = raw_val.astimezone(tz) if timezone.is_aware(raw_val) else raw_val
                cell.value = dt.strftime("%d/%m/%Y %H:%M:%S")
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif isinstance(raw_val, date) or col.type == "date":
                # BR-MD-EXP-16: Date dd/MM/yyyy
                if isinstance(raw_val, date):
                    cell.value = raw_val.strftime("%d/%m/%Y")
                else:
                    cell.value = str(raw_val)
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                # Text value with formula injection prevention (BR-MD-EXP-19)
                str_val = str(raw_val).strip()
                cell.value = sanitize_excel_cell_value(str_val)
                cell.alignment = Alignment(horizontal="left", vertical="center")

        row_num += 1

    # Auto-adjust column width (min 14, max 50)
    for col_idx in range(1, len(target_config.columns) + 1):
        col_letter = get_column_letter(col_idx)
        max_len = max(len(str(ws.cell(row=r, column=col_idx).value or "")) for r in range(1, min(row_num, 50)))
        ws.column_dimensions[col_letter].width = max(14, min(max_len + 4, 50))

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def build_filename(target_config: ExportTarget, company: Optional[Company] = None) -> str:
    """
    BR-MD-EXP-20: Tên file có cấu trúc [MaDanhMuc]_[yyyyMMdd_HHmmss].xlsx
    Sử dụng múi giờ doanh nghiệp (Asia/Ho_Chi_Minh).
    """
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    now_str = timezone.now().astimezone(tz).strftime("%Y%m%d_%H%M%S")
    return f"{target_config.catalog_code}_{now_str}.xlsx"


def execute_export_batch(batch: models.CatalogExportBatch):
    """
    Worker function to process queued background export batch.
    """
    target_config = TARGET_CONFIGS.get(batch.target)
    if not target_config:
        batch.status = "FAILED"
        batch.error_message = f"Unsupported target {batch.target}"
        batch.finished_at = timezone.now()
        batch.save(update_fields=("status", "error_message", "finished_at"))
        return

    try:
        qs = get_scoped_queryset(
            user=batch.created_by,
            company=batch.company,
            target_config=target_config,
            export_scope=batch.export_scope,
            selected_ids=batch.selected_ids,
            filter_params=batch.filter_params,
        )
        file_bytes = generate_excel(target_config, qs, batch.company)
        filename = build_filename(target_config, batch.company)
        now = timezone.now()

        batch.file_data = file_bytes
        batch.file_size = len(file_bytes)
        batch.file_name = filename
        batch.status = "COMPLETED"
        batch.finished_at = now
        batch.expires_at = now + timedelta(hours=24)  # BR-MD-EXP-24
        batch.save(update_fields=("file_data", "file_size", "file_name", "status", "finished_at", "expires_at"))

        # Send notification (AF-05)
        create_notification(
            batch.created_by,
            "Export danh mục hoàn thành",
            f"File {batch.file_name} đã sẵn sàng để tải xuống. File có hiệu lực trong 24 giờ.",
            company=batch.company,
            level="SUCCESS",
            source_module="MDM",
            entity_type="CatalogExportBatch",
            entity_id=batch.pk,
            link=f"/api/v1/master-data/catalog-exports/{batch.pk}/download/?company_id={batch.company_id}",
            event_key=f"catalog-export-{batch.pk}",
            expires_at=batch.expires_at,
        )

        # BR-MD-EXP-29, 30: Audit Log (SUCCESS)
        record_audit(
            company=batch.company,
            actor_user=batch.created_by,
            module_code="MDM",
            action_code="EXPORT",
            entity=batch,
            after={
                "target": batch.target,
                "catalog_code": target_config.catalog_code,
                "export_scope": batch.export_scope,
                "total_records": batch.total_records,
                "file_name": batch.file_name,
                "result": "SUCCESS",
            },
        )
    except Exception as exc:
        batch.status = "FAILED"
        batch.error_message = str(exc)[:2000]
        batch.finished_at = timezone.now()
        batch.save(update_fields=("status", "error_message", "finished_at"))

        # Send failure notification (EF-08)
        create_notification(
            batch.created_by,
            "Export dữ liệu không thành công",
            "Export dữ liệu không thành công. Vui lòng thực hiện lại.",
            company=batch.company,
            level="WARNING",
            source_module="MDM",
            entity_type="CatalogExportBatch",
            entity_id=batch.pk,
            event_key=f"catalog-export-{batch.pk}",
        )

        # Audit Log (FAILURE)
        record_audit(
            company=batch.company,
            actor_user=batch.created_by,
            module_code="MDM",
            action_code="EXPORT",
            entity=batch,
            result=AuditResult.FAILURE,
            failure_reason=str(exc)[:500],
            after={
                "target": batch.target,
                "export_scope": batch.export_scope,
                "total_records": batch.total_records,
                "result": "FAILED",
            },
        )


class CatalogExportViewSet(viewsets.GenericViewSet):
    """
    Catalog Export API (UC-MD-16).
    """
    permission_classes = (IsAuthenticated,)
    queryset = models.CatalogExportBatch.objects.all()

    def _company(self) -> Company:
        company_id = self.request.query_params.get("company_id") or self.request.data.get("company_id")
        if not company_id:
            raise ValidationError({"company_id": "Working company is required."})
        try:
            company = Company.objects.get(pk=company_id)
        except (Company.DoesNotExist, ValueError):
            raise ValidationError({"company_id": "Unknown company."})
        if company.status != "ACTIVE":
            raise ValidationError({"company": "Doanh nghiệp đã ngừng hoạt động."})
        return company

    def _get_target(self, target_name: str) -> ExportTarget:
        target_config = resolve_target(target_name)
        if not target_config:
            raise ValidationError({"target": f"Danh mục '{target_name}' không được hỗ trợ."})
        return target_config

    @action(detail=False, methods=("get",))
    def targets(self, request):
        """
        Lists all supported export catalogues with current user access.
        """
        company = self._company()
        items = []
        for key, target in TARGET_CONFIGS.items():
            account = getattr(request.user, "iam_account", None)
            is_super = getattr(request.user, "is_superuser", False)
            if is_super or (account and catalogue_grant(account, company, target, "EXPORT") and catalogue_grant(account, company, target, "VIEW")):
                items.append({
                    "target": key,
                    "catalog_code": target.catalog_code,
                    "name": target.name,
                    "columns": [c.title for c in target.columns],
                })
        return Response(items)

    @action(detail=False, methods=("get", "post"))
    def estimate(self, request):
        """
        Step 4 in Activity Flow: Provides export options, estimated count, and recommended processing mode.
        """
        company = self._company()
        data = request.data if request.method == "POST" else request.query_params
        target_name = data.get("target")
        if not target_name:
            raise ValidationError({"target": "Vui lòng chọn danh mục cần Export."})
        target_config = self._get_target(target_name)
        check_user_export_permissions(request.user, company, target_config)

        export_scope = str(data.get("export_scope") or "ALL").upper()
        selected_ids = data.get("selected_ids") or []
        filter_params = data.get("filters") or {}

        if export_scope == "SELECTED" and not selected_ids:
            raise ValidationError({"detail": "Vui lòng chọn ít nhất một bản ghi để Export."})

        qs = get_scoped_queryset(request.user, company, target_config, export_scope, selected_ids, filter_params)
        count = qs.count()

        threshold = int(getattr(settings, "CATALOG_EXPORT_BACKGROUND_THRESHOLD", 10000))
        max_limit = 100000
        mode = "DIRECT" if count <= threshold else ("BACKGROUND" if count <= max_limit else "EXCEEDED")

        return Response({
            "target": target_config.target_key,
            "catalog_code": target_config.catalog_code,
            "name": target_config.name,
            "export_scope": export_scope,
            "file_format": "xlsx",
            "estimated_count": count,
            "mode": mode,
            "max_limit": max_limit,
            "background_threshold": threshold,
        })

    @action(detail=False, methods=("post",))
    def export(self, request):
        """
        Step 6 in Activity Flow: Confirms and triggers Export.
        BR-MD-EXP-21: <= 10,000 -> Direct file download.
        BR-MD-EXP-22: 10,001..100,000 -> Background processing (202 Accepted).
        BR-MD-EXP-23 / EF-04: > 100,000 -> Error 400.
        EF-03: 0 records -> Error 400.
        """
        company = self._company()
        target_name = request.data.get("target") or request.query_params.get("target")
        if not target_name:
            raise ValidationError({"target": "Vui lòng chọn danh mục cần Export."})
        target_config = self._get_target(target_name)
        check_user_export_permissions(request.user, company, target_config)

        export_scope = str(request.data.get("export_scope") or request.query_params.get("export_scope") or "ALL").upper()
        selected_ids = request.data.get("selected_ids") or request.query_params.getlist("selected_ids") or []
        filter_params = request.data.get("filters") or dict(request.query_params.items())

        # EF-02 / BR-MD-EXP-07: Check selected scope
        if export_scope == "SELECTED" and not selected_ids:
            raise ValidationError({"detail": "Vui lòng chọn ít nhất một bản ghi để Export."})

        started_at = timezone.now()
        qs = get_scoped_queryset(request.user, company, target_config, export_scope, selected_ids, filter_params)
        count = qs.count()

        # EF-03: No records found
        if count == 0:
            record_audit(
                company=company,
                actor_user=request.user.iam_account,
                module_code="MDM",
                action_code="EXPORT",
                result=AuditResult.FAILURE,
                failure_reason="Không có dữ liệu phù hợp để Export.",
                after={"target": target_config.target_key, "export_scope": export_scope, "total_records": 0},
                request=request,
            )
            raise ValidationError({"detail": "Không có dữ liệu phù hợp để Export."})

        # EF-04 / BR-MD-EXP-23: Over 100,000 records
        if count > 100000:
            record_audit(
                company=company,
                actor_user=request.user.iam_account,
                module_code="MDM",
                action_code="EXPORT",
                result=AuditResult.FAILURE,
                failure_reason="Dữ liệu vượt quá 100.000 bản ghi.",
                after={"target": target_config.target_key, "export_scope": export_scope, "total_records": count},
                request=request,
            )
            raise ValidationError({"detail": "Dữ liệu vượt quá 100.000 bản ghi. Vui lòng sử dụng bộ lọc để thu hẹp dữ liệu."})

        threshold = int(getattr(settings, "CATALOG_EXPORT_BACKGROUND_THRESHOLD", 10000))

        # BR-MD-EXP-22 / AF-04: Background processing
        if count > threshold:
            batch = models.CatalogExportBatch.objects.create(
                company=company,
                target=target_config.target_key,
                export_scope=export_scope,
                filter_params=filter_params,
                selected_ids=selected_ids if export_scope == "SELECTED" else [],
                status="QUEUED",
                total_records=count,
                created_by=request.user.iam_account,
            )
            # Record audit for queueing
            record_audit(
                company=company,
                actor_user=request.user.iam_account,
                module_code="MDM",
                action_code="EXPORT_QUEUE",
                entity=batch,
                after={"target": target_config.target_key, "export_scope": export_scope, "total_records": count, "batch_id": str(batch.id)},
                request=request,
            )
            return Response(
                {
                    "batch_id": str(batch.id),
                    "target": target_config.target_key,
                    "catalog_code": target_config.catalog_code,
                    "status": "QUEUED",
                    "total_records": count,
                    "message": "Yêu cầu Export đang được xử lý. Hệ thống sẽ thông báo khi file sẵn sàng.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        # BR-MD-EXP-21: Direct processing (<= 10,000 records)
        try:
            file_bytes = generate_excel(target_config, qs, company)
            filename = build_filename(target_config, company)
            finished_at = timezone.now()

            # Create completed batch record with 24h retention
            batch = models.CatalogExportBatch.objects.create(
                company=company,
                target=target_config.target_key,
                export_scope=export_scope,
                filter_params=filter_params,
                selected_ids=selected_ids if export_scope == "SELECTED" else [],
                status="COMPLETED",
                total_records=count,
                file_name=filename,
                file_data=file_bytes,
                file_size=len(file_bytes),
                created_by=request.user.iam_account,
                started_at=started_at,
                finished_at=finished_at,
                expires_at=finished_at + timedelta(hours=24),
            )

            # BR-MD-EXP-29, 30: Record Audit Log
            record_audit(
                company=company,
                actor_user=request.user.iam_account,
                module_code="MDM",
                action_code="EXPORT",
                entity=batch,
                after={
                    "target": target_config.target_key,
                    "catalog_code": target_config.catalog_code,
                    "export_scope": export_scope,
                    "total_records": count,
                    "file_name": filename,
                    "started_at": started_at.isoformat(),
                    "finished_at": finished_at.isoformat(),
                    "result": "SUCCESS",
                },
                request=request,
            )

            response = HttpResponse(file_bytes, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            response["X-Export-Status"] = "SUCCESS"
            response["X-Export-Batch-ID"] = str(batch.id)
            return response
        except Exception as exc:
            record_audit(
                company=company,
                actor_user=request.user.iam_account,
                module_code="MDM",
                action_code="EXPORT",
                result=AuditResult.FAILURE,
                failure_reason=str(exc)[:500],
                after={"target": target_config.target_key, "export_scope": export_scope, "total_records": count},
                request=request,
            )
            raise ValidationError({"detail": "Không thể tạo file Export. Vui lòng thử lại."})

    def retrieve(self, request, pk=None):
        """
        Checks batch status.
        """
        company = self._company()
        batch = models.CatalogExportBatch.objects.filter(pk=pk, company=company).first()
        if not batch:
            raise ValidationError({"batch": "Không tìm thấy yêu cầu Export."})
        # BR-MD-EXP-27: Ownership check
        if not request.user.is_superuser and batch.created_by_id != getattr(request.user.iam_account, "pk", None):
            raise PermissionDenied("Bạn không có quyền truy cập yêu cầu Export này.")
        return Response({
            "id": str(batch.id),
            "target": batch.target,
            "export_scope": batch.export_scope,
            "status": batch.status,
            "total_records": batch.total_records,
            "file_name": batch.file_name,
            "file_size": batch.file_size,
            "started_at": batch.started_at,
            "finished_at": batch.finished_at,
            "expires_at": batch.expires_at,
            "error_message": batch.error_message,
        })

    @action(detail=True, methods=("get",))
    def download(self, request, pk=None):
        """
        Downloads the generated export file (BR-MD-EXP-24, 25, 27, 28, EF-05, EF-09).
        """
        company = self._company()
        batch = models.CatalogExportBatch.objects.filter(pk=pk, company=company).first()
        if not batch:
            raise ValidationError({"batch": "Không tìm thấy file Export."})

        # BR-MD-EXP-27: Link tải file phải gắn với User đã tạo yêu cầu Export
        if not request.user.is_superuser and batch.created_by_id != getattr(request.user.iam_account, "pk", None):
            raise PermissionDenied("Bạn không có quyền tải file này.")

        # EF-05: Kiểm tra lại quyền Export và View hiện tại
        target_config = TARGET_CONFIGS.get(batch.target)
        if target_config:
            try:
                check_user_export_permissions(request.user, company, target_config)
            except PermissionDenied:
                raise PermissionDenied("Quyền truy cập của bạn đã thay đổi. Vui lòng tải lại trang và thử lại.")

        # BR-MD-EXP-24, 25, EF-09: Check 24-hour expiration
        now = timezone.now()
        if (batch.expires_at and now > batch.expires_at) or batch.status == "EXPIRED":
            if batch.status != "EXPIRED" or batch.file_data:
                batch.status = "EXPIRED"
                batch.file_data = None  # BR-MD-EXP-32: Clean physical/stored data
                batch.save(update_fields=("status", "file_data"))
            return Response({"detail": "File Export đã hết hạn. Vui lòng tạo yêu cầu Export mới."}, status=status.HTTP_410_GONE)

        if batch.status != "COMPLETED" or not batch.file_data:
            raise ValidationError({"detail": "Không thể tạo file Export. Vui lòng thử lại."})

        response = HttpResponse(bytes(batch.file_data), content_type=batch.content_type)
        response["Content-Disposition"] = f'attachment; filename="{batch.file_name}"'
        return response
