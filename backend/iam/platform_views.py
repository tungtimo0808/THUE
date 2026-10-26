import uuid
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from audit_log.models import AuditLog
from audit_log.services import record_audit
from common_services.setup_services import complete_company_setup
from organization.models import Branch, Company, CompanyStatus, Department, Employee
from .models import (
    ActiveStatus, CompanyMembership, Permission, Role, RolePermission,
    RoleStatus, RoleType, UserAccount, UserRoleAssignment,
)

User = get_user_model()


def require_superuser(request):
    if not (request.user and request.user.is_authenticated and request.user.is_superuser):
        raise PermissionDenied("Chỉ Super Admin mới có quyền truy cập chức năng này.")


class PlatformStatsView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        require_superuser(request)

        total_companies = Company.objects.count()
        active_companies = Company.objects.filter(status=CompanyStatus.ACTIVE).count()
        pending_companies = Company.objects.filter(status=CompanyStatus.PENDING_SETUP).count()
        suspended_companies = Company.objects.filter(status=CompanyStatus.SUSPENDED).count()

        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        superusers = User.objects.filter(is_superuser=True).count()
        total_memberships = CompanyMembership.objects.count()
        total_audit_logs = AuditLog.objects.count()

        recent_companies = [
            {
                "id": str(c.id),
                "code": c.code,
                "name": c.name,
                "tax_code": c.tax_code,
                "status": c.status,
                "legal_representative": c.legal_representative,
                "created_at": c.created_at.isoformat() if hasattr(c, "created_at") and c.created_at else None,
                "members_count": c.memberships.count(),
            }
            for c in Company.objects.order_by("-updated_at")[:8]
        ]

        recent_logs = [
            {
                "id": str(log.id),
                "action": log.action_code,
                "module": log.module_code,
                "actor": log.actor_user.display_name if log.actor_user else "Hệ thống",
                "company_name": log.company.name if log.company else "Toàn hệ thống",
                "occurred_at": log.occurred_at.isoformat(),
            }
            for log in AuditLog.objects.select_related("actor_user", "company").order_by("-occurred_at")[:10]
        ]

        return Response({
            "metrics": {
                "total_companies": total_companies,
                "active_companies": active_companies,
                "pending_companies": pending_companies,
                "suspended_companies": suspended_companies,
                "total_users": total_users,
                "active_users": active_users,
                "superusers": superusers,
                "total_memberships": total_memberships,
                "total_audit_logs": total_audit_logs,
            },
            "recent_companies": recent_companies,
            "recent_logs": recent_logs,
            "system_status": "ONLINE",
            "server_time": timezone.now().isoformat(),
        })


class PlatformCompanyViewSet(ViewSet):
    permission_classes = (IsAuthenticated,)

    def list(self, request):
        require_superuser(request)
        companies = Company.objects.select_related("accounting_currency").annotate(
            members_count=Count("memberships", distinct=True),
            branches_count=Count("branches", distinct=True),
            employees_count=Count("employees", distinct=True),
        ).order_by("-updated_at")

        q = request.query_params.get("q", "").strip().lower()
        status_filter = request.query_params.get("status", "").strip().upper()

        data = []
        for c in companies:
            if status_filter and c.status != status_filter:
                continue
            if q and not (q in c.name.lower() or q in c.code.lower() or q in (c.tax_code or "").lower()):
                continue

            data.append({
                "id": str(c.id),
                "code": c.code,
                "name": c.name,
                "legal_name": c.legal_name,
                "tax_code": c.tax_code or "",
                "status": c.status,
                "legal_representative": c.legal_representative or "",
                "representative_title": c.representative_title or "",
                "address": c.address or "",
                "accounting_regime": c.accounting_regime,
                "accounting_currency": c.accounting_currency.code if c.accounting_currency else "VND",
                "members_count": c.members_count,
                "branches_count": c.branches_count,
                "employees_count": c.employees_count,
                "created_at": c.created_at.isoformat() if hasattr(c, "created_at") and c.created_at else None,
                "updated_at": c.updated_at.isoformat() if hasattr(c, "updated_at") and c.updated_at else None,
            })

        return Response(data)

    def retrieve(self, request, pk=None):
        require_superuser(request)
        company = get_object_or_404(Company, pk=pk)
        members = CompanyMembership.objects.filter(company=company).select_related("user__auth_user", "employee", "organization_unit")
        branches = Branch.objects.filter(company=company)

        return Response({
            "id": str(company.id),
            "code": company.code,
            "name": company.name,
            "legal_name": company.legal_name,
            "tax_code": company.tax_code or "",
            "status": company.status,
            "legal_representative": company.legal_representative or "",
            "representative_title": company.representative_title or "",
            "address": company.address or "",
            "accounting_regime": company.accounting_regime,
            "branches": [{"id": str(b.id), "code": b.code, "name": b.name, "is_head_office": b.is_head_office} for b in branches],
            "members": [
                {
                    "id": str(m.id),
                    "user_id": str(m.user_id),
                    "name": m.user.display_name,
                    "email": m.user.auth_user.email,
                    "status": m.membership_status,
                    "employee_name": m.employee.full_name if m.employee else None,
                    "unit_name": m.organization_unit.name if m.organization_unit else None,
                }
                for m in members
            ],
        })

    @action(detail=True, methods=("post",), url_path="set-status")
    def set_status(self, request, pk=None):
        require_superuser(request)
        company = get_object_or_404(Company, pk=pk)
        new_status = request.data.get("status", "").strip().upper()
        if new_status not in dict(CompanyStatus.choices):
            raise ValidationError({"status": f"Trạng thái không hợp lệ: {new_status}"})

        before = company.status
        company.status = new_status
        company.save(update_fields=("status", "updated_at"))

        actor_account = getattr(request.user, "iam_account", None)
        if actor_account:
            record_audit(
                company=company, actor_user=actor_account, module_code="SYS",
                action_code="COMPANY_STATUS_CHANGE", entity=company,
                before={"status": before}, after={"status": new_status}, request=request,
            )

        return Response({"id": str(company.id), "status": company.status, "message": f"Đã chuyển trạng thái doanh nghiệp thành {new_status}"})

    @action(detail=False, methods=("post",), url_path="create-company")
    def create_company(self, request):
        require_superuser(request)
        data = request.data
        code = (data.get("code") or "").strip().upper()
        name = (data.get("name") or "").strip()
        tax_code = (data.get("tax_code") or "").strip()
        accounting_regime = data.get("accounting_regime", "TT99")
        legal_representative = (data.get("legal_representative") or "").strip()

        if not code or not name:
            raise ValidationError({"message": "Cần nhập đầy đủ Mã và Tên doanh nghiệp."})

        if Company.objects.filter(code=code).exists():
            raise ValidationError({"code": f"Mã doanh nghiệp {code} đã tồn tại."})

        with transaction.atomic():
            company = Company.objects.create(
                code=code,
                name=name,
                legal_name=data.get("legal_name") or name,
                tax_code=tax_code,
                accounting_regime=accounting_regime,
                legal_representative=legal_representative,
                status=CompanyStatus.PENDING_SETUP,
                address=data.get("address", ""),
            )

            actor = getattr(request.user, "iam_account", None)
            if actor:
                CompanyMembership.objects.create(
                    company=company,
                    user=actor,
                    membership_status=ActiveStatus.ACTIVE,
                    created_by=actor,
                )

            # Auto run basic setup
            if actor:
                try:
                    complete_company_setup(company, actor, request)
                except Exception:
                    pass

        return Response({
            "id": str(company.id),
            "code": company.code,
            "name": company.name,
            "status": company.status,
            "message": "Đã tạo doanh nghiệp mới thành công.",
        }, status=status.HTTP_201_CREATED)


class PlatformUserViewSet(ViewSet):
    permission_classes = (IsAuthenticated,)

    def list(self, request):
        require_superuser(request)
        users = User.objects.select_related("iam_account").prefetch_related("iam_account__memberships__company").order_by("-date_joined")

        q = request.query_params.get("q", "").strip().lower()
        is_active_param = request.query_params.get("is_active")

        result = []
        for u in users:
            display_name = u.iam_account.display_name if hasattr(u, "iam_account") else f"{u.first_name} {u.last_name}".strip() or u.username
            phone = u.iam_account.phone if hasattr(u, "iam_account") else ""

            if is_active_param is not None and is_active_param != "":
                active_bool = is_active_param.lower() in ("true", "1")
                if u.is_active != active_bool:
                    continue

            if q:
                if not (q in u.username.lower() or q in u.email.lower() or q in display_name.lower() or q in phone):
                    continue

            memberships = []
            if hasattr(u, "iam_account"):
                memberships = [
                    {"company_id": str(m.company_id), "company_name": m.company.name, "status": m.membership_status}
                    for m in u.iam_account.memberships.all()
                ]

            result.append({
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "display_name": display_name,
                "phone": phone,
                "is_active": u.is_active,
                "is_superuser": u.is_superuser,
                "date_joined": u.date_joined.isoformat() if u.date_joined else None,
                "last_login": u.last_login.isoformat() if u.last_login else None,
                "memberships": memberships,
            })

        return Response(result)

    @action(detail=True, methods=("post",), url_path="toggle-superuser")
    def toggle_superuser(self, request, pk=None):
        require_superuser(request)
        target = get_object_or_404(User, pk=pk)
        if target.id == request.user.id and target.is_superuser:
            raise ValidationError("Không thể tự gỡ quyền Super Admin của chính mình.")

        target.is_superuser = not target.is_superuser
        target.is_staff = target.is_superuser
        target.save(update_fields=("is_superuser", "is_staff"))

        return Response({
            "id": str(target.id),
            "is_superuser": target.is_superuser,
            "message": f"Đã {'cấp' if target.is_superuser else 'gỡ'} quyền Super Admin cho {target.username}.",
        })

    @action(detail=True, methods=("post",), url_path="toggle-active")
    def toggle_active(self, request, pk=None):
        require_superuser(request)
        target = get_object_or_404(User, pk=pk)
        if target.id == request.user.id and target.is_active:
            raise ValidationError("Không thể tự khóa tài khoản của chính mình.")

        target.is_active = not target.is_active
        target.save(update_fields=("is_active",))

        return Response({
            "id": str(target.id),
            "is_active": target.is_active,
            "message": f"Đã {'kích hoạt' if target.is_active else 'khóa'} tài khoản {target.username}.",
        })

    @action(detail=True, methods=("post",), url_path="reset-password")
    def reset_password(self, request, pk=None):
        require_superuser(request)
        target = get_object_or_404(User, pk=pk)
        new_password = request.data.get("new_password", "").strip()
        if len(new_password) < 6:
            raise ValidationError({"new_password": "Mật khẩu mới phải có ít nhất 6 ký tự."})

        target.set_password(new_password)
        target.save(update_fields=("password",))

        return Response({"message": f"Đã cập nhật mật khẩu mới cho người dùng {target.username}."})


# --- SEED STANDARD ROLES FOR COMPANY ---
STANDARD_ROLE_DEFINITIONS = [
    {
        "code": "KT_TRUONG",
        "name": "Kế toán trưởng",
        "description": "Toàn quyền quản lý tài chính, kiểm soát sổ cái, phê duyệt chứng từ, khóa/mở kỳ kế toán.",
        "permission_prefixes": [
            "GL.", "CASH.", "BANK.", "PUR.", "SAL.", "INV.", "FA.", "TAX.", "RPT.", "AP.", "AR.", "COST.", "SYS.AUDIT",
        ],
    },
    {
        "code": "KT_BANHANG",
        "name": "Kế toán bán hàng & Công nợ phải thu",
        "description": "Lập báo giá, đơn hàng, hóa đơn bán hàng, theo dõi công nợ khách hàng và đối chiếu công nợ.",
        "permission_prefixes": [
            "SAL.", "AR.", "MD.PARTY.", "RPT.",
        ],
    },
    {
        "code": "KT_MUAHANG",
        "name": "Kế toán mua hàng & Công nợ phải trả",
        "description": "Lập đơn mua, hóa đơn mua hàng, theo dõi nợ nhà cung cấp và thanh toán chi phí mua hàng.",
        "permission_prefixes": [
            "PUR.", "AP.", "MD.PARTY.", "RPT.",
        ],
    },
    {
        "code": "THU_QUY",
        "name": "Thủ quỹ",
        "description": "Xác nhận thu/chi tiền mặt, nộp tiền ngân hàng, kiểm kê quỹ tiền mặt.",
        "permission_prefixes": [
            "CASH.TRANSACTION.VIEW", "CASH.TRANSACTION.CONFIRM", "CASH.COUNT.", "CASH.FUND.VIEW", "RPT.",
        ],
    },
    {
        "code": "KT_KHO",
        "name": "Thủ kho & Kế toán kho",
        "description": "Nhập kho, xuất kho, điều chuyển kho, kiểm kê hàng hóa, theo dõi thẻ kho.",
        "permission_prefixes": [
            "INV.", "MD.ITEM.", "MD.WAREHOUSE.", "MD.UOM.", "RPT.",
        ],
    },
    {
        "code": "NVKD",
        "name": "Nhân viên kinh doanh",
        "description": "Lập báo giá cho khách, tạo đơn đặt hàng, tra cứu tồn kho và thông tin khách hàng.",
        "permission_prefixes": [
            "SAL.QUOTATION.VIEW", "SAL.QUOTATION.CREATE", "SAL.QUOTATION.EDIT",
            "SAL.ORDER.VIEW", "SAL.ORDER.CREATE", "MD.PARTY.VIEW", "INV.BALANCE.VIEW",
        ],
    },
]


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def seed_standard_roles_view(request):
    """Initializes standard business roles for a specific company."""
    company_id = request.query_params.get("company_id") or request.data.get("company_id")
    if not company_id:
        raise ValidationError({"company_id": "Vui lòng chọn doanh nghiệp cần khởi tạo Role mẫu."})

    company = get_object_or_404(Company, pk=company_id)
    actor_account = getattr(request.user, "iam_account", None)

    created_roles = []
    with transaction.atomic():
        all_perms = list(Permission.objects.filter(status=ActiveStatus.ACTIVE).select_related("resource"))

        for role_def in STANDARD_ROLE_DEFINITIONS:
            role, created = Role.objects.get_or_create(
                company=company,
                code=role_def["code"],
                defaults={
                    "name": role_def["name"],
                    "description": role_def["description"],
                    "role_type": RoleType.STANDARD,
                    "status": RoleStatus.ACTIVE,
                    "created_by": actor_account,
                    "updated_by": actor_account,
                },
            )

            # Match permissions
            prefixes = role_def["permission_prefixes"]
            matched_perms = [
                p for p in all_perms
                if any(p.code.startswith(prefix) for prefix in prefixes)
            ]

            # Assign permissions to role
            existing_perm_ids = set(RolePermission.objects.filter(role=role).values_list("permission_id", flat=True))
            new_grants = [
                RolePermission(role=role, permission=p, effect="ALLOW")
                for p in matched_perms if p.id not in existing_perm_ids
            ]
            if new_grants:
                RolePermission.objects.bulk_create(new_grants)

            created_roles.append({
                "code": role.code,
                "name": role.name,
                "created": created,
                "permission_count": len(matched_perms),
            })

    return Response({
        "message": f"Đã khởi tạo thành công {len(created_roles)} vai trò mẫu cho công ty {company.name}.",
        "roles": created_roles,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assign_member_role_view(request):
    """Allows Company Admin (or superuser) to easily assign or change a role for a company member."""
    data = request.data
    company_id = data.get("company_id") or request.query_params.get("company_id")
    membership_id = data.get("membership_id")
    role_id = data.get("role_id")
    role_code = data.get("role_code")

    if not company_id or not membership_id:
        raise ValidationError({"message": "Thiếu thông tin company_id hoặc membership_id."})

    company = get_object_or_404(Company, pk=company_id)
    membership = get_object_or_404(CompanyMembership, pk=membership_id, company=company)

    actor = getattr(request.user, "iam_account", None)
    if not request.user.is_superuser:
        if not actor:
            raise PermissionDenied("Tài khoản chưa liên kết IAM.")
        is_admin = UserRoleAssignment.objects.filter(
            company_membership__company=company,
            company_membership__user=actor,
            role__is_system_admin=True,
            status=ActiveStatus.ACTIVE,
        ).exists() or CompanyMembership.objects.filter(
            company=company,
            user=actor,
            role_assignments__role__code__in=["COMPANY_ADMIN", "ADMIN"],
            membership_status=ActiveStatus.ACTIVE,
        ).exists()
        if not is_admin:
            raise PermissionDenied("Chỉ Quản trị viên doanh nghiệp mới có quyền phân vai trò cho nhân sự.")

    role = None
    if role_id:
        role = Role.objects.filter(company=company, pk=role_id).first()
    elif role_code:
        role = Role.objects.filter(company=company, code=role_code).first()

    if not role:
        raise ValidationError({"role": "Không tìm thấy vai trò tương ứng trong doanh nghiệp."})

    with transaction.atomic():
        UserRoleAssignment.objects.filter(
            company_membership=membership,
            status=ActiveStatus.ACTIVE,
        ).delete()

        assignment = UserRoleAssignment.objects.create(
            company_membership=membership,
            role=role,
            status=ActiveStatus.ACTIVE,
            assigned_by=actor or membership.user,
            assign_reason=data.get("reason", f"Phân công vai trò {role.name}"),
        )

    return Response({
        "message": f"Đã phân vai trò '{role.name}' cho nhân sự {membership.user.display_name}.",
        "membership_id": str(membership.id),
        "role_code": role.code,
        "role_name": role.name,
        "assignment_id": str(assignment.id),
    })
