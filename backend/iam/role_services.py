import re

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit
from common_services.models import WorkItem
from organization.models import Company

from .models import (
    ActiveStatus, CompanyMembership, Permission, Role, RolePermission, RoleStatus,
    RoleType, UserRoleAssignment,
)
from .permissions import (
    assignment_permission_codes, effective_assignments, has_effective_permission,
)


class RoleVersionConflict(ValidationError):
    status_code = 409
    default_detail = "Role đã được cập nhật. Vui lòng tải lại dữ liệu."


def require_role_actor(*, company, actor, permission_code, is_platform_admin=False):
    current_company = Company.objects.select_for_update().get(pk=company.pk)
    if current_company.status != "ACTIVE":
        raise ValidationError("Doanh nghiệp không hoạt động.")
    if not CompanyMembership.objects.filter(
        company=company, user=actor, membership_status=ActiveStatus.ACTIVE,
    ).exists():
        raise PermissionDenied("Người xử lý không còn Membership ACTIVE.")
    if not is_platform_admin and not has_effective_permission(actor, company, permission_code):
        raise PermissionDenied("Không có quyền quản lý Role.")


def _role_code(value, company, *, current=None):
    code = value.strip().upper()
    if not re.fullmatch(r"[A-Z][A-Z0-9_]{1,79}", code):
        raise ValidationError({"code": "Mã Role phải gồm chữ in hoa, số hoặc dấu gạch dưới."})
    if code in {"ADMIN", "COMPANY_ADMIN", "SYSTEM_ADMIN", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"} or code.startswith(("SYS_", "SYSTEM_", "PLATFORM_")):
        raise ValidationError({"code": "Mã Role dành riêng cho hệ thống."})
    existing = Role.objects.filter(company=company, code__iexact=code)
    if current:
        existing = existing.exclude(pk=current.pk)
    if existing.exists():
        raise ValidationError({"code": "Mã Role đã được sử dụng."})
    return code


def _role_name(value, company, *, current=None):
    name = value.strip()
    if not name:
        raise ValidationError({"name": "Cần nhập tên Role."})
    existing = Role.objects.filter(company=company, name__iexact=name)
    if current:
        existing = existing.exclude(pk=current.pk)
    if existing.exists():
        raise ValidationError({"name": "Tên Role đã được sử dụng."})
    return name


def _permission_codes(role):
    codes = set(role.role_permissions.filter(
        effect="ALLOW", permission__status=ActiveStatus.ACTIVE,
        permission__resource__status=ActiveStatus.ACTIVE,
    ).values_list("permission__code", flat=True))
    for item in role.role_bundles.filter(bundle__status=ActiveStatus.ACTIVE):
        codes.update(item.bundle.permissionbundleitem_set.filter(
            permission__status=ActiveStatus.ACTIVE,
            permission__resource__status=ActiveStatus.ACTIVE,
        ).values_list("permission__code", flat=True))
    return codes


def _audit(role, actor, action, before, after, request):
    record_audit(
        company=role.company, actor_user=actor, module_code="SYS", action_code=action,
        entity=role, before=before, after=after, request=request,
    )


@transaction.atomic
def create_role(*, company, actor, data, request=None, is_platform_admin=False):
    require_role_actor(company=company, actor=actor, permission_code="SYS.ROLE.CREATE", is_platform_admin=is_platform_admin)
    role = Role(
        company=company, code=_role_code(data["code"], company),
        name=_role_name(data["name"], company), description=data.get("description", "").strip(),
        role_type=RoleType.CUSTOM, status=RoleStatus.ACTIVE,
        created_by=actor, updated_by=actor,
    )
    role.full_clean()
    role.save()
    _audit(role, actor, "ROLE_CREATE", {}, {
        "code": role.code, "name": role.name, "description": role.description,
        "status": role.status, "role_type": role.role_type,
    }, request)
    return role


@transaction.atomic
def clone_role(*, source_id, company, actor, data, request=None, is_platform_admin=False):
    require_role_actor(company=company, actor=actor, permission_code="SYS.ROLE.CLONE", is_platform_admin=is_platform_admin)
    source = Role.objects.select_for_update().get(pk=source_id, company=company)
    if source.status != RoleStatus.ACTIVE:
        raise ValidationError("Role nguồn không còn hoạt động.")
    if source.updated_at != data["version"]:
        raise RoleVersionConflict()
    permission_codes = _permission_codes(source)
    if not is_platform_admin:
        actor_assignments = list(effective_assignments(actor, company))
        granted = set().union(*(
            assignment_permission_codes(a) for a in actor_assignments
            if a.data_scope_set_id is None or a.data_scope_set.allow_all_company_data
        ))
        if not permission_codes <= granted:
            raise PermissionDenied("Role nguồn có Permission vượt quá phạm vi của người sao chép.")
        if source.is_system_admin and not any(a.role.is_system_admin for a in actor_assignments):
            raise PermissionDenied("Không được sao chép Role quản trị hệ thống.")
    role = Role(
        company=company, code=_role_code(data["code"], company),
        name=_role_name(data["name"], company),
        description=data.get("description", source.description).strip(),
        role_type=RoleType.CUSTOM, status=RoleStatus.ACTIVE,
        source_role=source, created_by=actor, updated_by=actor,
    )
    role.full_clean()
    role.save()
    permissions = list(Permission.objects.filter(code__in=permission_codes))
    RolePermission.objects.bulk_create([
        RolePermission(role=role, permission=permission, effect="ALLOW") for permission in permissions
    ])
    _audit(role, actor, "ROLE_CLONE", {}, {
        "source_role_id": str(source.pk), "code": role.code, "name": role.name,
        "description": role.description, "permission_codes": sorted(permission_codes),
    }, request)
    return role


@transaction.atomic
def update_role(*, role_id, company, actor, data, request=None, is_platform_admin=False):
    require_role_actor(company=company, actor=actor, permission_code="SYS.ROLE.EDIT", is_platform_admin=is_platform_admin)
    role = Role.objects.select_for_update().get(pk=role_id, company=company)
    if role.role_type != RoleType.CUSTOM or role.is_system_admin:
        raise ValidationError("System Role được bảo vệ; hãy sao chép để tùy chỉnh.")
    if role.updated_at != data["version"]:
        raise RoleVersionConflict()
    before = {"code": role.code, "name": role.name, "description": role.description}
    changed = []
    if "code" in data:
        code = _role_code(data["code"], company, current=role)
        if code != role.code:
            if role.user_assignments.exists():
                raise ValidationError({"code": "Role đã được gán cho User, không thể đổi mã."})
            role.code = code
            changed.append("code")
    if "name" in data:
        name = _role_name(data["name"], company, current=role)
        if name != role.name:
            role.name = name
            changed.append("name")
    if "description" in data:
        description = data["description"].strip()
        if description != role.description:
            role.description = description
            changed.append("description")
    if changed:
        role.updated_by = actor
        role.full_clean()
        role.save(update_fields=(*changed, "updated_by", "updated_at"))
        _audit(role, actor, "ROLE_EDIT", before, {
            "code": role.code, "name": role.name, "description": role.description,
        }, request)
    return role


def role_impact(role):
    now = timezone.now()
    assignments = UserRoleAssignment.objects.filter(
        role=role, status=ActiveStatus.ACTIVE, valid_from__lte=now,
        company_membership__membership_status=ActiveStatus.ACTIVE,
        company_membership__user__auth_user__is_active=True,
    ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now)).select_related(
        "company_membership__user__auth_user", "data_scope_set"
    )
    users = [
        {"user_id": str(a.company_membership.user_id),
         "name": a.company_membership.user.display_name,
         "email": a.company_membership.user.auth_user.email,
         "assignment_id": str(a.pk), "valid_to": a.valid_to,
         "data_scope_set_id": str(a.data_scope_set_id) if a.data_scope_set_id else None}
        for a in assignments
    ]
    tasks = list(WorkItem.objects.filter(
        company=role.company, assignee_role=role,
        status__in=(WorkItem.Status.PENDING, WorkItem.Status.IN_PROGRESS, WorkItem.Status.OVERDUE),
    ).values("id", "title", "status"))
    return {"active_user_count": len({user["user_id"] for user in users}),
            "users": users, "active_work_item_count": len(tasks), "active_work_items": tasks}


def _has_other_company_admin(role):
    required = {"SYS.USER.EDIT", "SYS.ROLE.EDIT"}
    now = timezone.now()
    assignments = UserRoleAssignment.objects.filter(
        company_membership__company=role.company,
        company_membership__membership_status=ActiveStatus.ACTIVE,
        company_membership__user__auth_user__is_active=True,
        role__status=RoleStatus.ACTIVE, status=ActiveStatus.ACTIVE,
        valid_from__lte=now,
    ).exclude(role=role).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=now)
    ).filter(
        Q(data_scope_set__isnull=True) | Q(data_scope_set__allow_all_company_data=True)
    ).prefetch_related(
        "role__role_permissions__permission__resource",
        "role__role_bundles__bundle__permissionbundleitem_set__permission__resource",
    )
    by_user = {}
    for assignment in assignments:
        by_user.setdefault(assignment.company_membership.user_id, set()).update(
            assignment_permission_codes(assignment)
        )
    return any(required <= codes for codes in by_user.values())


@transaction.atomic
def set_role_active(*, role_id, company, actor, active, data, request=None, is_platform_admin=False):
    permission = "SYS.ROLE.REACTIVATE" if active else "SYS.ROLE.DEACTIVATE"
    require_role_actor(company=company, actor=actor, permission_code=permission, is_platform_admin=is_platform_admin)
    role = Role.objects.select_for_update().get(pk=role_id, company=company)
    if role.role_type != RoleType.CUSTOM or role.is_system_admin:
        raise ValidationError("System Role được bảo vệ và không đổi trạng thái trực tiếp.")
    if role.updated_at != data["version"]:
        raise RoleVersionConflict()
    desired = RoleStatus.ACTIVE if active else RoleStatus.INACTIVE
    if role.status == desired:
        raise ValidationError("Role đã ở trạng thái được yêu cầu.")
    impact = role_impact(role)
    if not active:
        if impact["active_work_item_count"]:
            raise ValidationError({"active_work_items": "Cần phân công lại công việc đang sử dụng Role."})
        if (impact["active_user_count"] and
                {"SYS.USER.EDIT", "SYS.ROLE.EDIT"} <= _permission_codes(role) and
                not _has_other_company_admin(role)):
            raise ValidationError("Không thể ngừng Role quản trị cuối cùng của doanh nghiệp.")
    before = {"status": role.status}
    role.status = desired
    role.updated_by = actor
    role.save(update_fields=("status", "updated_by", "updated_at"))
    _audit(role, actor, "ROLE_REACTIVATE" if active else "ROLE_DEACTIVATE", before, {
        "status": desired, "affected_user_count": impact["active_user_count"],
    }, request)
    return role


# =====================================================================
# DANH MỤC 21 ROLE CHUẨN NỘI BỘ DOANH NGHIỆP (SRS Mục 2.5.4)
# (Không tính ROLE_SUPER_ADMIN cấp Platform và ROLE_CUSTOM do DN tự tạo)
# =====================================================================

STANDARD_ROLE_DEFINITIONS = [
    # A. Nhóm quản trị và quản lý (System & Management)
    {
        "code": "ROLE_ADMIN",
        "name": "Quản trị doanh nghiệp",
        "group": "System",
        "is_system_admin": True,
        "description": "Quản lý user, role, permission, chi nhánh và cấu hình hệ thống của doanh nghiệp.",
        "permission_prefixes": ["*"],
    },
    {
        "code": "ROLE_DIRECTOR",
        "name": "Giám đốc",
        "group": "Management",
        "description": "Theo dõi tình hình tài chính, xem báo cáo điều hành và phê duyệt nghiệp vụ theo thẩm quyền.",
        "permission_prefixes": [
            "COM.DASHBOARD", "RPT.", "RPT_", "SYS.AUDIT", "SYS.COMPANY_PROFILE.VIEW", "SYS.WORKFLOW",
            "AP.APPROVAL", "AR.APPROVAL", "BANK.APPROVAL", "CASH.APPROVAL", "FA.APPROVAL",
            "GL.APPROVAL", "INV.APPROVAL", "PUR.APPROVAL", "SAL.APPROVAL",
            "GL.LEDGER.VIEW", "GL.BALANCE.VIEW", "GL.JOURNAL.VIEW",
            "CASH.FUND.VIEW", "BANK.ACCOUNT.VIEW", "BANK.STATEMENT.VIEW",
            "AR.RECEIVABLE.VIEW", "AP.PAYABLE.VIEW", "INV.BALANCE.VIEW", "TAX.SUMMARY.VIEW",
        ],
        "allowed_suffixes": [".VIEW", "_VIEW", ".EXPORT", "_EXPORT", ".PRINT", "_PRINT", ".APPROVE", ".REJECT"],
    },
    # B. Nhóm kế toán (Accounting)
    {
        "code": "ROLE_CHIEF_ACCOUNTANT",
        "name": "Kế toán trưởng",
        "group": "Accounting",
        "description": "Kiểm soát toàn bộ nghiệp vụ kế toán, duyệt chứng từ, ghi/bỏ ghi sổ, khóa kỳ kế toán và lập BCTC.",
        "permission_prefixes": [
            "GL.", "OPENING_BALANCE_", "CASH.", "BANK.", "PUR.", "SAL.", "INV.", "FA.",
            "TAX.", "RPT.", "RPT_", "AP.", "AR.", "COST.", "PAYROLL.", "MD.",
            "SYS.PERIOD", "SYS.POLICY", "SYS.NUMBERING", "SYS.AUDIT", "COM.DASHBOARD",
        ],
    },
    {
        "code": "ROLE_GENERAL_ACCOUNTANT",
        "name": "Kế toán tổng hợp",
        "group": "Accounting",
        "description": "Tổng hợp số liệu, sổ cái, bút toán tổng hợp, phân bổ, kết chuyển cuối kỳ, đối chiếu và lập báo cáo.",
        "permission_prefixes": [
            "GL.", "OPENING_BALANCE_", "COST.", "RPT.", "RPT_",
            "TAX.", "MD.", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".APPROVE", ".UNLOCK", ".LOCK_PERIOD"],
    },
    {
        "code": "ROLE_TAX_ACCOUNTANT",
        "name": "Kế toán thuế",
        "group": "Accounting",
        "description": "Quản lý thuế GTGT (VAT), TNDN, TNCN, hóa đơn điện tử, tờ khai và báo cáo thuế.",
        "permission_prefixes": [
            "TAX.", "RPT.TAX", "RPT.FINANCIAL", "RPT_FINANCIAL",
            "SAL.SALES_INVOICE", "PUR.INPUT_INVOICE", "MD.TAX_RATE", "MD.TAX_TYPE",
            "MD.PARTY.VIEW", "GL.LEDGER.VIEW", "GL.BALANCE.VIEW", "COM.DASHBOARD",
        ],
    },
    {
        "code": "ROLE_AP_ACCOUNTANT",
        "name": "Kế toán phải trả",
        "group": "Accounting",
        "description": "Quản lý hóa đơn đầu vào, nhà cung cấp, công nợ phải trả, đối chiếu và đề nghị thanh toán.",
        "permission_prefixes": [
            "AP.", "PUR.INPUT_INVOICE", "PUR.RECONCILIATION", "PUR.RETURN",
            "MD.PARTY", "MD.PAYMENT_TERM", "RPT.DEBT", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".APPROVE"],
    },
    {
        "code": "ROLE_AR_ACCOUNTANT",
        "name": "Kế toán phải thu",
        "group": "Accounting",
        "description": "Quản lý hóa đơn bán hàng, khách hàng, công nợ phải thu, đối chiếu và thu hồi công nợ.",
        "permission_prefixes": [
            "AR.", "SAL.SALES_INVOICE", "SAL.COMMERCIAL_INVOICE", "SAL.SALES_RETURN",
            "SAL.SALES_ALLOWANCE", "MD.PARTY", "MD.PAYMENT_TERM", "RPT.DEBT", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".APPROVE"],
    },
    {
        "code": "ROLE_PURCHASE_ACCOUNTANT",
        "name": "Kế toán mua hàng",
        "group": "Accounting",
        "description": "Theo dõi nghiệp vụ mua hàng, chứng từ mua, nhận hàng, chi phí mua và nhà cung cấp.",
        "permission_prefixes": [
            "PUR.", "AP.INVOICE", "AP.PAYABLE.VIEW", "MD.PARTY", "MD.ITEM",
            "MD.UOM", "MD.WAREHOUSE.VIEW", "RPT.COMMERCE", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".APPROVE"],
    },
    {
        "code": "ROLE_SALES_ACCOUNTANT",
        "name": "Kế toán bán hàng",
        "group": "Accounting",
        "description": "Ghi nhận bán hàng, doanh thu, hóa đơn đầu ra và chứng từ bán hàng.",
        "permission_prefixes": [
            "SAL.", "AR.RECEIVABLE.VIEW", "MD.PARTY", "MD.ITEM", "MD.UOM",
            "RPT.COMMERCE", "RPT.BUSINESS_RESULT", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".APPROVE"],
    },
    {
        "code": "ROLE_CASH_ACCOUNTANT",
        "name": "Kế toán tiền mặt",
        "group": "Accounting",
        "description": "Lập và hạch toán phiếu thu, phiếu chi, tạm ứng và nghiệp vụ liên quan đến tiền mặt.",
        "permission_prefixes": [
            "CASH.", "GL.ADVANCE_REQUEST", "GL.ADVANCE_SETTLEMENT",
            "MD.PARTY.VIEW", "MD.EMPLOYEE.VIEW", "RPT.MONEY", "RPT.CASH_FLOW", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".APPROVE"],
    },
    {
        "code": "ROLE_BANK_ACCOUNTANT",
        "name": "Kế toán ngân hàng",
        "group": "Accounting",
        "description": "Hạch toán thu/chi qua ngân hàng, ủy nhiệm chi, chuyển tiền và đối soát sao kê ngân hàng.",
        "permission_prefixes": [
            "BANK.", "MD.BANK_ACCOUNT", "MD.PARTY.VIEW", "RPT.MONEY", "RPT.CASH_FLOW", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".APPROVE"],
    },
    {
        "code": "ROLE_INVENTORY_ACCOUNTANT",
        "name": "Kế toán kho",
        "group": "Accounting",
        "description": "Hạch toán nhập, xuất, điều chuyển, kiểm kê và tính giá trị hàng tồn kho.",
        "permission_prefixes": [
            "INV.", "COST.", "MD.ITEM", "MD.ITEM_GROUP", "MD.WAREHOUSE", "MD.UOM", "RPT.INVENTORY", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".APPROVE"],
    },
    {
        "code": "ROLE_ASSET_ACCOUNTANT",
        "name": "Kế toán tài sản",
        "group": "Accounting",
        "description": "Ghi tăng, ghi giảm, điều chuyển, tính khấu hao và quản lý tài sản cố định (TSCĐ).",
        "permission_prefixes": [
            "FA.", "MD.ORGANIZATION.VIEW", "RPT.ASSET", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".APPROVE"],
    },
    {
        "code": "ROLE_CCDC_ACCOUNTANT",
        "name": "Kế toán CCDC",
        "group": "Accounting",
        "description": "Quản lý công cụ dụng cụ, ghi tăng/giảm, xuất dùng và phân bổ chi phí CCDC.",
        "permission_prefixes": [
            "GL.ALLOCATION", "FA.ASSET.VIEW", "FA.COUNT", "FA.REPORT",
            "INV.TRANSACTION.VIEW", "MD.EXPENSE_ITEM", "RPT.ASSET", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".APPROVE"],
    },
    # C. Nhóm vận hành (Operation) — Không có quyền Ghi sổ cái (POST/UNPOST/REVERSE) hoặc Phê duyệt (APPROVE)
    {
        "code": "ROLE_TREASURER",
        "name": "Thủ quỹ",
        "group": "Operation",
        "description": "Thực hiện và xác nhận thu/chi tiền mặt thực tế, theo dõi sổ quỹ và kiểm kê tồn quỹ.",
        "permission_prefixes": [
            "CASH.", "BANK.ACCOUNT.VIEW", "BANK.TRANSACTION.VIEW", "BANK.TRANSACTION.CONFIRM",
            "BANK.STATEMENT.VIEW", "BANK.TRANSFER.VIEW", "BANK.RECONCILIATION.VIEW",
            "RPT.MONEY.VIEW", "RPT.MONEY.PRINT", "RPT.CASH_FLOW.VIEW", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".POST", ".UNPOST", ".REVERSE", ".DELETE", ".APPROVE"],
    },
    {
        "code": "ROLE_STOREKEEPER",
        "name": "Thủ kho",
        "group": "Operation",
        "description": "Xác nhận nhập/xuất kho thực tế, kiểm kê kho và quản lý số lượng tồn kho.",
        "permission_prefixes": [
            "INV.TRANSACTION", "INV.BALANCE.VIEW", "INV.COUNT", "INV.LOT_SERIAL",
            "MD.ITEM.VIEW", "MD.WAREHOUSE.VIEW", "MD.UOM.VIEW", "RPT.INVENTORY.VIEW", "RPT.INVENTORY.PRINT", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".POST", ".UNPOST", ".REVERSE", ".DELETE", ".APPROVE"],
    },
    {
        "code": "ROLE_PURCHASER",
        "name": "Nhân viên mua hàng",
        "group": "Operation",
        "description": "Lập đề nghị mua hàng, đơn đặt hàng mua, hợp đồng mua và theo dõi tiến độ giao hàng NCC.",
        "permission_prefixes": [
            "PUR.REQUEST", "PUR.ORDER", "PUR.CONTRACT", "PUR.RECEIPT.VIEW",
            "PUR.TRACKING", "MD.PARTY.VIEW", "MD.ITEM.VIEW", "INV.BALANCE.VIEW", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".POST", ".UNPOST", ".REVERSE", ".APPROVE"],
    },
    {
        "code": "ROLE_SALESPERSON",
        "name": "Nhân viên bán hàng",
        "group": "Operation",
        "description": "Lập báo giá, tạo đơn bán hàng, quản lý thông tin khách hàng và theo dõi quá trình giao hàng.",
        "permission_prefixes": [
            "SAL.QUOTATION", "SAL.ORDER", "SAL.CONTRACT", "SAL.DELIVERY.VIEW",
            "SAL.TRACKING", "MD.PARTY.VIEW", "MD.ITEM.VIEW", "INV.BALANCE.VIEW", "COM.DASHBOARD",
        ],
        "excluded_suffixes": [".POST", ".UNPOST", ".REVERSE", ".APPROVE"],
    },
    # D. Nhóm phê duyệt, kiểm soát & xem báo cáo (Approval, Control, View Only)
    {
        "code": "ROLE_APPROVER",
        "name": "Người phê duyệt",
        "group": "Approval",
        "description": "Thực hiện phê duyệt hoặc từ chối chứng từ/nghiệp vụ theo quy trình (workflow) được cấu hình.",
        "permission_prefixes": [
            "AP.", "AR.", "BANK.", "CASH.", "FA.", "GL.", "INV.", "PUR.", "SAL.",
            "SYS.WORKFLOW.VIEW", "COM.DASHBOARD",
        ],
        "allowed_suffixes": [".APPROVE", ".REJECT", ".APPROVAL.VIEW", ".WORKFLOW.VIEW", ".DASHBOARD.VIEW"],
    },
    {
        "code": "ROLE_AUDITOR",
        "name": "Kiểm tra / Kiểm toán",
        "group": "Control",
        "description": "Tra cứu chứng từ, sổ kế toán, báo cáo tài chính và nhật ký kiểm toán (Audit Log); chỉ đọc.",
        "permission_prefixes": [
            "SYS.AUDIT", "RPT.", "RPT_", "GL.", "OPENING_BALANCE_VIEW",
            "TAX.", "FA.", "INV.", "AP.", "AR.", "CASH.", "BANK.", "PUR.", "SAL.", "COST.", "COM.DASHBOARD",
        ],
        "allowed_suffixes": [".VIEW", "_VIEW", ".EXPORT", "_EXPORT", ".PRINT", "_PRINT"],
    },
    {
        "code": "ROLE_REPORT_VIEWER",
        "name": "Người xem báo cáo",
        "group": "View Only",
        "description": "Chỉ được xem các bảng điều khiển (Dashboard) và báo cáo được cấp quyền, không sửa chứng từ.",
        "permission_prefixes": [
            "COM.DASHBOARD", "RPT.", "RPT_",
        ],
        "allowed_suffixes": [".VIEW", "_VIEW", ".EXPORT", "_EXPORT", ".PRINT", "_PRINT"],
    },
]

ROLE_GROUP_BY_CODE = {item["code"]: item["group"] for item in STANDARD_ROLE_DEFINITIONS}
ROLE_GROUP_BY_CODE["COMPANY_ADMIN"] = "System"
ROLE_GROUP_BY_CODE["ROLE_SUPER_ADMIN"] = "System"

LEGACY_ROLE_CODE_MAP = {
    "COMPANY_ADMIN": "ROLE_ADMIN",
    "KT_TRUONG": "ROLE_CHIEF_ACCOUNTANT",
    "KT_BANHANG": "ROLE_SALES_ACCOUNTANT",
    "KT_MUAHANG": "ROLE_PURCHASE_ACCOUNTANT",
    "THU_QUY": "ROLE_TREASURER",
    "KT_KHO": "ROLE_STOREKEEPER",
    "NVKD": "ROLE_SALESPERSON",
}

# =====================================================================
# PHÂN BỐ ROLE THEO 4 THÔNG TƯ / QUY MÔ DOANH NGHIỆP (SRS Mục 2.5.8 & 2.5.9)
# - Các Role trong danh sách của Thông tư sẽ ở trạng thái ACTIVE (Đang sử dụng).
# - Các Role còn lại trong 21 Role chuẩn sẽ ở trạng thái AVAILABLE (Có sẵn trong danh mục,
#   Admin doanh nghiệp có thể bật thêm bất kỳ lúc nào mà không làm rối giao diện).
# =====================================================================

ROLE_PRESETS_BY_REGIME = {
    # Preset 1: Thông tư 58/2026/TT-BTC — Doanh nghiệp siêu nhỏ (3 Role ACTIVE)
    "TT58": [
        "ROLE_ADMIN",
        "ROLE_DIRECTOR",
        "ROLE_CHIEF_ACCOUNTANT",
    ],
    # Preset 2: Thông tư 133/2016/TT-BTC — Doanh nghiệp nhỏ & vừa SME (8 Role ACTIVE)
    "TT133": [
        "ROLE_ADMIN",
        "ROLE_DIRECTOR",
        "ROLE_CHIEF_ACCOUNTANT",
        "ROLE_GENERAL_ACCOUNTANT",
        "ROLE_TAX_ACCOUNTANT",
        "ROLE_SALES_ACCOUNTANT",
        "ROLE_TREASURER",
        "ROLE_STOREKEEPER",
    ],
    # Preset 3: Thông tư 200/2014/TT-BTC — Doanh nghiệp vừa & lớn (14 Role ACTIVE)
    "TT200": [
        "ROLE_ADMIN",
        "ROLE_DIRECTOR",
        "ROLE_CHIEF_ACCOUNTANT",
        "ROLE_GENERAL_ACCOUNTANT",
        "ROLE_TAX_ACCOUNTANT",
        "ROLE_AP_ACCOUNTANT",
        "ROLE_AR_ACCOUNTANT",
        "ROLE_PURCHASE_ACCOUNTANT",
        "ROLE_SALES_ACCOUNTANT",
        "ROLE_CASH_ACCOUNTANT",
        "ROLE_BANK_ACCOUNTANT",
        "ROLE_INVENTORY_ACCOUNTANT",
        "ROLE_TREASURER",
        "ROLE_STOREKEEPER",
    ],
    # Preset 4: Thông tư 99/2025/TT-BTC — Doanh nghiệp lớn / Đầy đủ chuyên trách (21 Role ACTIVE)
    "TT99": [item["code"] for item in STANDARD_ROLE_DEFINITIONS],
}


def resolve_regime_preset_key(raw_regime_or_preset: str | None) -> str:
    val = str(raw_regime_or_preset or "").strip().upper()
    if val in ("TT58", "CIRCULAR_58", "58", "MICRO", "PRESET_1"):
        return "TT58"
    if val in ("TT133", "CIRCULAR_133", "133", "SME", "SMALL", "PRESET_2"):
        return "TT133"
    if val in ("TT200", "CIRCULAR_200", "200", "MEDIUM", "PRESET_3"):
        return "TT200"
    return "TT99"


def _migrate_legacy_roles_for_company(company):
    """Chuyển đổi các mã Role cũ (KT_TRUONG, THU_QUY, COMPANY_ADMIN...) sang mã chuẩn SRS ROLE_*."""
    for old_code, new_code in LEGACY_ROLE_CODE_MAP.items():
        old_role = Role.objects.filter(company=company, code=old_code).first()
        if not old_role:
            continue
        new_role = Role.objects.filter(company=company, code=new_code).first()
        if not new_role:
            old_role.code = new_code
            old_role.role_type = RoleType.STANDARD
            if new_code == "ROLE_ADMIN":
                old_role.is_system_admin = True
            old_role.save(update_fields=("code", "role_type", "is_system_admin", "updated_at"))
        else:
            # Chuyển toàn bộ nhân sự đang gán old_role sang new_role rồi xóa old_role
            for assign in list(UserRoleAssignment.objects.filter(role=old_role)):
                if not UserRoleAssignment.objects.filter(
                    company_membership=assign.company_membership, role=new_role
                ).exists():
                    assign.role = new_role
                    assign.save(update_fields=("role",))
                else:
                    assign.delete()
            old_role.delete()


def seed_standard_roles_for_company(company, actor=None, preset: str | None = None, force_preset_status: bool = False):
    """
    Khởi tạo đầy đủ 21 Role chuẩn theo SRS Mục 2.5 cho doanh nghiệp,
    đồng thời tự động bật (ACTIVE) số lượng Role phù hợp với Thông tư / Quy mô doanh nghiệp
    (TT58: 3 Role, TT133: 8 Role, TT200: 14 Role, TT99: 21 Role) và để các Role còn lại ở AVAILABLE.
    """
    created_roles = []
    preset_key = resolve_regime_preset_key(preset or getattr(company, "accounting_regime", "TT99"))
    active_codes_for_preset = set(ROLE_PRESETS_BY_REGIME.get(preset_key, ROLE_PRESETS_BY_REGIME["TT99"]))

    with transaction.atomic():
        _migrate_legacy_roles_for_company(company)
        all_perms = list(Permission.objects.filter(status=ActiveStatus.ACTIVE).select_related("resource"))

        for role_def in STANDARD_ROLE_DEFINITIONS:
            code = role_def["code"]
            is_admin = bool(role_def.get("is_system_admin", False))
            should_be_active = is_admin or (code in active_codes_for_preset)
            target_status = RoleStatus.ACTIVE if should_be_active else RoleStatus.AVAILABLE

            role, created = Role.objects.get_or_create(
                company=company,
                code=code,
                defaults={
                    "name": role_def["name"],
                    "description": role_def["description"],
                    "role_type": RoleType.STANDARD,
                    "status": target_status,
                    "is_system_admin": is_admin,
                    "created_by": actor,
                    "updated_by": actor,
                },
            )

            update_fields = []
            if role.name != role_def["name"]:
                role.name = role_def["name"]
                update_fields.append("name")
            if role.description != role_def["description"]:
                role.description = role_def["description"]
                update_fields.append("description")
            if is_admin and not role.is_system_admin:
                role.is_system_admin = True
                update_fields.append("is_system_admin")

            if not created and force_preset_status:
                # Nếu Role đang có nhân sự ACTIVE được gán thì giữ ACTIVE để không làm mất quyền nhân sự
                has_assigned_users = role.user_assignments.filter(status=ActiveStatus.ACTIVE).exists()
                desired_status = RoleStatus.ACTIVE if (should_be_active or has_assigned_users) else RoleStatus.AVAILABLE
                if role.status != desired_status:
                    role.status = desired_status
                    update_fields.append("status")

            if update_fields:
                update_fields.append("updated_at")
                role.save(update_fields=tuple(update_fields))

            prefixes = role_def["permission_prefixes"]
            allowed_suffixes = role_def.get("allowed_suffixes")
            excluded_suffixes = role_def.get("excluded_suffixes")
            baseline_codes = {
                "COM.SETTING.VIEW",
                "COM.NOTIFICATION.VIEW",
                "COM.SEARCH.USE",
                "COM.DASHBOARD.VIEW",
                "RPT.DASHBOARD.VIEW",
                "RPT.DASHBOARD.CONFIG",
                "SYS.COMPANY_PROFILE.VIEW",
                "SYS.PERIOD.VIEW",
                "SYS.POLICY.VIEW",
                "SYS.NUMBERING.VIEW",
                "MD.COMMON.VIEW",
                "MD.ACCOUNT.VIEW",
                "MD.PARTY.VIEW",
                "MD.EMPLOYEE.VIEW",
                "MD.ORGANIZATION.VIEW",
                "MD.BANK_ACCOUNT.VIEW",
                "MD.ITEM.VIEW",
                "MD.ITEM_GROUP.VIEW",
                "MD.UOM.VIEW",
                "MD.WAREHOUSE.VIEW",
                "MD.TAX_RATE.VIEW",
                "MD.TAX_TYPE.VIEW",
                "MD.PAYMENT_METHOD.VIEW",
                "MD.PAYMENT_TERM.VIEW",
                "MD.EXPENSE_ITEM.VIEW",
                "MD.STATISTICAL_CODE.VIEW",
            }

            if "*" in prefixes or is_admin:
                matched_perms = all_perms
            else:
                matched_perms = []
                for p in all_perms:
                    if p.code in baseline_codes:
                        matched_perms.append(p)
                        continue
                    if not any(p.code.startswith(prefix) for prefix in prefixes):
                        continue
                    if allowed_suffixes and not any(p.code.endswith(sfx) or sfx in p.code for sfx in allowed_suffixes):
                        continue
                    if excluded_suffixes and any(p.code.endswith(sfx) or sfx in p.code for sfx in excluded_suffixes):
                        continue
                    matched_perms.append(p)

            target_perm_ids = {p.id for p in matched_perms}
            if force_preset_status and role.role_type == RoleType.STANDARD and not is_admin:
                RolePermission.objects.filter(role=role).exclude(permission_id__in=target_perm_ids).delete()

            existing_perm_ids = set(RolePermission.objects.filter(role=role).values_list("permission_id", flat=True))
            new_grants = [
                RolePermission(role=role, permission=p, effect="ALLOW")
                for p in matched_perms if p.id not in existing_perm_ids
            ]
            if new_grants:
                RolePermission.objects.bulk_create(new_grants)

            if is_admin and actor:
                actor_mem = CompanyMembership.objects.filter(company=company, user=actor).first()
                if actor_mem:
                    UserRoleAssignment.objects.get_or_create(
                        company_membership=actor_mem,
                        role=role,
                        defaults={
                            "status": ActiveStatus.ACTIVE,
                            "assigned_by": actor,
                            "assign_reason": "Chủ sở hữu / Quản trị viên doanh nghiệp",
                        },
                    )

            created_roles.append({
                "id": str(role.id),
                "code": role.code,
                "name": role.name,
                "group": role_def["group"],
                "status": role.status,
                "created": created,
                "permission_count": len(matched_perms),
            })

    return created_roles


