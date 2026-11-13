import uuid
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
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


def _ensure_dedicated_superadmin():
    """Ensure the dedicated Super Admin account (username='admin', password='admin') exists and is the sole platform superadmin."""
    # If another user (like old ketoan.mua) held username='admin' without being superadmin, free the username
    existing_admin = User.objects.filter(username="admin").first()
    if existing_admin and existing_admin.email == "admin@example.com":
        existing_admin.username = "ketoan.mua"
        existing_admin.email = "ketoan.mua@soviet.vn"
        existing_admin.is_superuser = False
        existing_admin.is_staff = False
        existing_admin.save(update_fields=("username", "email", "is_superuser", "is_staff"))

    super_user, created = User.objects.get_or_create(
        username="admin",
        defaults={
            "email": "superadmin@soviet.vn",
            "first_name": "Super",
            "last_name": "Admin",
            "is_superuser": True,
            "is_staff": True,
            "is_active": True,
        },
    )
    if created or not super_user.is_superuser or not super_user.is_active:
        super_user.is_superuser = True
        super_user.is_staff = True
        super_user.is_active = True
        if created:
            super_user.set_password("admin")
        super_user.save()

    acc, _ = UserAccount.objects.get_or_create(
        auth_user=super_user,
        defaults={"display_name": "Super Admin Hệ Thống", "phone": "0900000000"},
    )
    if acc.display_name != "Super Admin Hệ Thống" or acc.status != ActiveStatus.ACTIVE:
        acc.display_name = "Super Admin Hệ Thống"
        acc.status = ActiveStatus.ACTIVE
        acc.locked_until = None
        acc.failed_login_count = 0
        acc.save(update_fields=("display_name", "status", "locked_until", "failed_login_count", "updated_at"))

    from common_services.models import UserPreference
    pref, _ = UserPreference.objects.get_or_create(user=acc)
    if not pref.email_verified_at:
        pref.email_verified_at = timezone.now()
        pref.save(update_fields=("email_verified_at", "updated_at"))

    # Ensure tungtimo0808@gmail.com / timodapoettt stays a regular company owner account
    User.objects.filter(
        Q(email__iexact="tungtimo0808@gmail.com") | Q(username__iexact="timodapoettt")
    ).update(is_superuser=False, is_staff=False)

    return super_user, acc


def require_superuser(request):
    if not (request.user and request.user.is_authenticated and request.user.is_superuser):
        raise PermissionDenied("Chỉ Super Admin mới có quyền truy cập chức năng này.")
    if getattr(request.user, "email", "").lower() == "tungtimo0808@gmail.com" or getattr(request.user, "username", "").lower() == "timodapoettt":
        request.user.is_superuser = False
        request.user.is_staff = False
        request.user.save(update_fields=("is_superuser", "is_staff"))
        raise PermissionDenied("Tài khoản tungtimo0808@gmail.com là tài khoản Chủ doanh nghiệp, vui lòng đăng nhập bằng tài khoản Super Admin (admin).")


class PlatformLoginView(APIView):
    """Dedicated step-up authentication endpoint for Super Admin (/super-admin)."""
    permission_classes = (AllowAny,)

    def post(self, request):
        raw_user = (
            request.data.get("username")
            or request.data.get("login")
            or request.data.get("identifier")
            or request.data.get("email")
            or ""
        ).strip()
        raw_pass = (request.data.get("password") or "").strip()

        if not raw_user or not raw_pass:
            raise ValidationError({"detail": "Vui lòng nhập đầy đủ Tài khoản và Mật khẩu Super Admin."})

        if raw_user.lower() in ("tungtimo0808@gmail.com", "timodapoettt"):
            raise PermissionDenied(
                "Tài khoản tungtimo0808@gmail.com là tài khoản người dùng tạo doanh nghiệp, không phải tài khoản Super Admin. Vui lòng đăng nhập bằng tài khoản 'admin'."
            )

        super_user, super_acc = _ensure_dedicated_superadmin()

        target_user = super_user
        target_acc = super_acc
        if raw_user.lower() != "admin":
            candidate = User.objects.filter(
                Q(username__iexact=raw_user) | Q(email__iexact=raw_user),
                is_superuser=True,
                is_active=True,
            ).first()
            if not candidate:
                raise PermissionDenied("Tài khoản hoặc mật khẩu Super Admin không chính xác (sử dụng tài khoản 'admin').")
            target_user = candidate
            target_acc, _ = UserAccount.objects.get_or_create(
                auth_user=target_user,
                defaults={"display_name": target_user.get_full_name() or target_user.username, "status": ActiveStatus.ACTIVE},
            )

        if not target_user.check_password(raw_pass):
            # If password was not yet initialized to 'admin', verify if raw_pass == 'admin'
            if target_user.username.lower() == "admin" and raw_pass == "admin":
                target_user.set_password("admin")
                target_user.save(update_fields=("password",))
            else:
                raise PermissionDenied("Tài khoản hoặc mật khẩu Super Admin không chính xác.")

        from common_services import services as common_srv
        refresh, session = common_srv.issue_session(target_user, request)
        target_user.last_login = timezone.now()
        target_user.save(update_fields=("last_login",))

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "session": str(session.id),
            "user": {
                "id": str(target_acc.id),
                "username": target_user.username,
                "email": target_user.email,
                "display_name": target_acc.display_name or "Super Admin Hệ Thống",
                "is_superuser": True,
            },
        })


def _get_or_create_all_company_scope(company, creator):
    from .models import DataScopeSet
    scope_set = DataScopeSet.objects.filter(company=company, allow_all_company_data=True).first()
    if not scope_set:
        scope_set, _ = DataScopeSet.objects.get_or_create(
            company=company,
            code="ALL_COMPANY",
            defaults={
                "name": "Phạm vi Toàn doanh nghiệp",
                "allow_all_company_data": True,
                "allow_owned_records": True,
                "created_by": creator,
            },
        )
    return scope_set


def _get_or_create_branch_scope(company, branch, creator):
    from .models import DataScopeBranch, DataScopeSet
    code = f"SCOPE_BR_{branch.code}"[:40]
    scope_set, _ = DataScopeSet.objects.get_or_create(
        company=company,
        code=code,
        defaults={
            "name": f"Phạm vi Chi nhánh: {branch.name}"[:150],
            "allow_all_company_data": False,
            "allow_owned_records": True,
            "created_by": creator,
        },
    )
    if scope_set.allow_all_company_data:
        scope_set.allow_all_company_data = False
        scope_set.save(update_fields=("allow_all_company_data", "updated_at"))
    DataScopeBranch.objects.get_or_create(
        data_scope_set=scope_set,
        branch=branch,
        defaults={"include_descendants": True},
    )
    return scope_set


def _resolve_user_account(user_id):
    if not user_id:
        return None
    val = str(user_id).strip()
    try:
        uuid_val = uuid.UUID(val)
        acc = UserAccount.objects.select_related("auth_user").filter(pk=uuid_val).first()
        if acc:
            return acc
    except (ValueError, TypeError):
        pass
    if val.isdigit():
        u = User.objects.filter(pk=int(val)).first()
    else:
        u = User.objects.filter(Q(username=val) | Q(email=val)).first()
    if u:
        acc, _ = UserAccount.objects.get_or_create(
            auth_user=u,
            defaults={
                "display_name": f"{u.first_name} {u.last_name}".strip() or u.username,
            },
        )
        return acc
    return None


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

        companies_list = list(companies)
        company_ids = [c.id for c in companies_list]

        admin_by_company = {}
        owner_ids = {c.created_by_user_id for c in companies_list if c.created_by_user_id}
        owners_by_id = {
            u.id: u
            for u in UserAccount.objects.filter(id__in=owner_ids).select_related("auth_user")
        }
        for c in companies_list:
            if c.created_by_user_id and c.created_by_user_id in owners_by_id:
                owner_acc = owners_by_id[c.created_by_user_id]
                if not owner_acc.auth_user.is_superuser:
                    admin_by_company[c.id] = owner_acc

        for assignment in (
            UserRoleAssignment.objects.filter(
                company_membership__company_id__in=company_ids,
                role__is_system_admin=True,
                status=ActiveStatus.ACTIVE,
            )
            .exclude(company_membership__user__auth_user__is_superuser=True)
            .select_related("company_membership__user__auth_user")
            .order_by("assigned_at")
        ):
            cid = assignment.company_membership.company_id
            if cid not in admin_by_company and assignment.company_membership.user:
                admin_by_company[cid] = assignment.company_membership.user

        first_member_by_company = {}
        for mem in (
            CompanyMembership.objects.filter(company_id__in=company_ids)
            .exclude(user__auth_user__is_superuser=True)
            .select_related("user__auth_user")
            .order_by("joined_at")
        ):
            if mem.company_id not in first_member_by_company and mem.user:
                first_member_by_company[mem.company_id] = mem.user

        data = []
        for c in companies_list:
            if status_filter and c.status != status_filter:
                continue
            if q and not (q in c.name.lower() or q in c.code.lower() or q in (c.tax_code or "").lower()):
                continue

            u = admin_by_company.get(c.id) or first_member_by_company.get(c.id)
            admin_info = None
            if u:
                admin_info = {
                    "id": str(u.id),
                    "display_name": u.display_name or u.auth_user.get_username(),
                    "email": u.auth_user.email,
                    "phone": u.phone,
                }

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
                "bookkeeping_method": c.bookkeeping_method,
                "accounting_currency": c.accounting_currency.code if c.accounting_currency else "VND",
                "members_count": c.members_count,
                "branches_count": c.branches_count,
                "employees_count": c.employees_count,
                "admin": admin_info,
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

        status_labels = {
            "ACTIVE": "Đang hoạt động",
            "SUSPENDED": "Tạm khóa",
            "PENDING_SETUP": "Chờ thiết lập",
            "INACTIVE": "Ngừng hoạt động",
        }
        status_vn = status_labels.get(new_status, new_status)
        return Response({"id": str(company.id), "status": company.status, "message": f"Đã chuyển trạng thái doanh nghiệp sang '{status_vn}'."})

    @action(detail=True, methods=("post",), url_path="assign-company-admin")
    def assign_company_admin(self, request, pk=None):
        require_superuser(request)
        company = get_object_or_404(Company, pk=pk)
        user_id = request.data.get("user_id")
        if not user_id:
            raise ValidationError({"user_id": "Vui lòng chọn người dùng làm Admin/Chủ sở hữu."})
        target_account = _resolve_user_account(user_id)
        if not target_account:
            raise ValidationError({"user_id": "Không tìm thấy người dùng được chọn."})
        actor_account = getattr(request.user, "iam_account", None)

        from iam.role_services import seed_standard_roles_for_company
        from .models import DataScopeSet
        seed_standard_roles_for_company(company, actor_account)

        admin_role = Role.objects.filter(company=company, code__in=("ROLE_ADMIN", "COMPANY_ADMIN")).first()
        if not admin_role:
            admin_role = Role.objects.filter(company=company, is_system_admin=True).first()

        with transaction.atomic():
            company.created_by_user_id = target_account.id
            company.save(update_fields=("created_by_user_id", "updated_at"))

            membership, _ = CompanyMembership.objects.get_or_create(
                company=company,
                user=target_account,
                defaults={
                    "membership_status": ActiveStatus.ACTIVE,
                    "created_by": actor_account or target_account,
                },
            )
            if membership.membership_status != ActiveStatus.ACTIVE:
                membership.membership_status = ActiveStatus.ACTIVE
                membership.save(update_fields=("membership_status", "updated_at"))

            scope_set = _get_or_create_all_company_scope(company, actor_account or target_account)

            if admin_role:
                # Ensure each company has a single clear Company Admin / Owner
                UserRoleAssignment.objects.filter(
                    company_membership__company=company,
                    role__is_system_admin=True,
                ).exclude(company_membership=membership).delete()

                UserRoleAssignment.objects.update_or_create(
                    company_membership=membership,
                    role=admin_role,
                    defaults={
                        "data_scope_set": scope_set,
                        "status": ActiveStatus.ACTIVE,
                        "assigned_by": actor_account or target_account,
                        "assign_reason": "Super Admin chỉ định Chủ sở hữu Doanh nghiệp",
                    },
                )

        return Response({
            "message": f"Đã gán '{target_account.display_name}' làm Quản trị viên/Chủ sở hữu của {company.name}.",
            "company_id": str(company.id),
            "admin": {
                "id": str(target_account.id),
                "display_name": target_account.display_name,
                "email": target_account.auth_user.email,
            },
        })

    @action(detail=False, methods=("post",), url_path="create-company")
    def create_company(self, request):
        require_superuser(request)
        data = request.data
        code = (data.get("code") or "").strip().upper()
        name = (data.get("name") or "").strip()
        tax_code = (data.get("tax_code") or "").strip()
        accounting_regime = data.get("accounting_regime", "TT99")
        legal_representative = (data.get("legal_representative") or "").strip()
        admin_user_id = data.get("admin_user_id")

        if not code or not name:
            raise ValidationError({"message": "Cần nhập đầy đủ Mã và Tên doanh nghiệp."})

        if Company.objects.filter(code=code).exists():
            raise ValidationError({"code": f"Mã doanh nghiệp {code} đã tồn tại."})

        with transaction.atomic():
            from master_data.models import Currency
            from organization.models import Branch
            currency, _ = Currency.objects.get_or_create(
                code="VND",
                defaults={"name": "Đồng Việt Nam", "symbol": "₫", "decimal_places": 0, "is_base_currency": True},
            )
            company = Company.objects.create(
                code=code,
                name=name,
                legal_name=data.get("legal_name") or name,
                tax_code=tax_code,
                accounting_regime=accounting_regime,
                legal_representative=legal_representative,
                accounting_currency=currency,
                legal_reporting_currency=currency,
                status=CompanyStatus.ACTIVE,
                address=data.get("address", ""),
            )
            branch = Branch.objects.create(
                company=company,
                code="HQ",
                name=f"Trụ sở chính - {company.name}"[:255],
                tax_code=tax_code,
                address=data.get("address", ""),
                is_head_office=True,
            )

            actor = getattr(request.user, "iam_account", None)
            if not actor and request.user and request.user.is_authenticated:
                actor, _ = UserAccount.objects.get_or_create(
                    auth_user=request.user,
                    defaults={
                        "display_name": request.user.get_full_name() or request.user.get_username(),
                        "can_create_company": True,
                    },
                )
            target_admin = None
            if admin_user_id:
                target_admin = _resolve_user_account(admin_user_id)
            elif actor and not request.user.is_superuser:
                target_admin = actor

            membership = None
            if target_admin:
                company.created_by_user_id = target_admin.id
                company.save(update_fields=("created_by_user_id", "updated_at"))
                membership, _ = CompanyMembership.objects.get_or_create(
                    company=company,
                    user=target_admin,
                    defaults={
                        "membership_status": ActiveStatus.ACTIVE,
                        "join_source": "BOOTSTRAP",
                        "created_by": actor or target_admin,
                    },
                )

            # Auto run full company setup (COA, numbering, periods, roles, modules)
            setup_actor = target_admin or actor
            if setup_actor:
                from .models import DataScopeBranch
                complete_company_setup(company, setup_actor, request)
                scope_set = _get_or_create_all_company_scope(company, setup_actor)
                DataScopeBranch.objects.get_or_create(
                    data_scope_set=scope_set,
                    branch=branch,
                    defaults={"include_descendants": True},
                )
                admin_role = (
                    Role.objects.filter(company=company, code__in=("ROLE_ADMIN", "COMPANY_ADMIN")).first()
                    or Role.objects.filter(company=company, is_system_admin=True).first()
                )
                if admin_role and membership is not None:
                    UserRoleAssignment.objects.get_or_create(
                        company_membership=membership,
                        role=admin_role,
                        defaults={
                            "data_scope_set": scope_set,
                            "assigned_by": actor or setup_actor,
                        },
                    )

        return Response({
            "id": str(company.id),
            "code": company.code,
            "name": company.name,
            "status": company.status,
            "message": "Đã tạo doanh nghiệp mới và khởi tạo không gian làm việc hoàn chỉnh.",
        }, status=status.HTTP_201_CREATED)


class PlatformUserViewSet(ViewSet):
    permission_classes = (IsAuthenticated,)

    def list(self, request):
        require_superuser(request)
        users = (
            User.objects.select_related("iam_account")
            .prefetch_related(
                "iam_account__memberships__company",
                "iam_account__memberships__role_assignments__role",
            )
            .order_by("-date_joined")
        )

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

            memberships_by_company = {}
            if hasattr(u, "iam_account"):
                for m in u.iam_account.memberships.all():
                    cid = str(m.company_id)
                    role_items = []
                    is_comp_admin = False
                    for ra in m.role_assignments.all():
                        if ra.status == ActiveStatus.ACTIVE and ra.role:
                            is_role_admin = bool(ra.role.is_system_admin or ra.role.code in ("COMPANY_ADMIN", "ROLE_ADMIN", "ADMIN"))
                            if is_role_admin:
                                is_comp_admin = True
                            role_items.append({
                                "code": ra.role.code,
                                "name": ra.role.name,
                                "is_admin": is_role_admin,
                            })
                    if cid not in memberships_by_company:
                        memberships_by_company[cid] = {
                            "company_id": cid,
                            "company_code": m.company.code,
                            "company_name": m.company.name,
                            "company_status": m.company.status,
                            "status": m.membership_status,
                            "roles": role_items,
                            "is_company_admin": is_comp_admin,
                        }
                    else:
                        existing = memberships_by_company[cid]
                        existing_codes = {r["code"] for r in existing["roles"]}
                        for r in role_items:
                            if r["code"] not in existing_codes:
                                existing["roles"].append(r)
                        if is_comp_admin:
                            existing["is_company_admin"] = True

            memberships = list(memberships_by_company.values())

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
        if not target.is_superuser and (
            target.email.lower() == "tungtimo0808@gmail.com"
            or target.username.lower() == "timodapoettt"
        ):
            raise ValidationError("Tài khoản tungtimo0808@gmail.com là tài khoản Chủ doanh nghiệp thực tế, không cấp quyền Super Admin nền tảng.")

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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def seed_standard_roles_view(request):
    """Initializes standard business roles, applies a regime role preset, or toggles an individual standard role."""
    company_id = request.query_params.get("company_id") or request.data.get("company_id")
    if not company_id:
        raise ValidationError({"company_id": "Vui lòng chọn doanh nghiệp cần khởi tạo Role mẫu."})

    company = get_object_or_404(Company, pk=company_id)
    actor_account = getattr(request.user, "iam_account", None)
    if not request.user.is_superuser:
        from iam.permissions import has_effective_permission, is_company_admin_member
        if not actor_account or not (
            is_company_admin_member(actor_account, company)
            or has_effective_permission(actor_account, company, "SYS.ROLE.CREATE")
            or has_effective_permission(actor_account, company, "SYS.ROLE.EDIT")
        ):
            raise PermissionDenied("Chỉ Quản trị viên doanh nghiệp mới có quyền khởi tạo hoặc cấu hình vai trò.")

    # Hỗ trợ bật/tắt nhanh từng Role chuẩn (AVAILABLE <-> ACTIVE)
    toggle_role_id = request.data.get("toggle_role_id")
    toggle_role_code = request.data.get("toggle_role_code")
    if toggle_role_id or toggle_role_code:
        role_qs = Role.objects.filter(company=company)
        target_role = role_qs.filter(pk=toggle_role_id).first() if toggle_role_id else role_qs.filter(code=toggle_role_code).first()
        if not target_role:
            raise ValidationError({"role": "Không tìm thấy vai trò trong doanh nghiệp."})
        if target_role.is_system_admin or target_role.code in ("ROLE_ADMIN", "COMPANY_ADMIN"):
            raise ValidationError({"role": "Vai trò Quản trị doanh nghiệp là bắt buộc, không thể tạm ẩn."})
        desired_status = request.data.get("status")
        if desired_status not in (RoleStatus.ACTIVE, RoleStatus.AVAILABLE, RoleStatus.INACTIVE):
            desired_status = RoleStatus.AVAILABLE if target_role.status == RoleStatus.ACTIVE else RoleStatus.ACTIVE
        if desired_status != RoleStatus.ACTIVE and target_role.user_assignments.filter(status=ActiveStatus.ACTIVE).exists():
            raise ValidationError({"role": f"Vai trò '{target_role.name}' đang được gán cho nhân sự hoạt động. Vui lòng chuyển vai trò của nhân sự trước khi tạm ẩn."})
        target_role.status = desired_status
        target_role.save(update_fields=("status", "updated_at"))
        return Response({
            "message": f"Đã chuyển vai trò '{target_role.name}' sang trạng thái {'Đang sử dụng (ACTIVE)' if desired_status == RoleStatus.ACTIVE else 'Có sẵn trong danh mục (AVAILABLE)'}.",
            "role_id": str(target_role.id),
            "role_code": target_role.code,
            "status": target_role.status,
        })

    preset = request.data.get("preset") or request.query_params.get("preset")
    force_preset = bool(preset) or bool(request.data.get("force_preset"))
    keep_modules = bool(request.data.get("keep_modules"))

    from iam.role_services import resolve_regime_preset_key, seed_standard_roles_for_company
    preset_key = resolve_regime_preset_key(preset or company.accounting_regime)

    coa_summary = None
    updated_modules = None
    if preset:
        if company.accounting_regime != preset_key:
            company.accounting_regime = preset_key
            company.save(update_fields=("accounting_regime", "updated_at"))

        try:
            from general_ledger.account_services import init_chart_of_accounts_from_template
            coa_scope = "ESSENTIAL" if preset_key in ("TT58", "TT88") else "FULL"
            coa_summary = init_chart_of_accounts_from_template(
                company=company,
                regime=preset_key,
                scope=coa_scope,
                user=actor_account,
            )
        except Exception:
            coa_summary = None

        if not keep_modules:
            from common_services.models import CoreCompanySetting
            if preset_key in ("TT58", "TT88"):
                updated_modules = [
                    "overview", "invoices", "cash", "bank", "purchases", "sales",
                    "tax", "ledger", "reports", "directory", "opening",
                ]
            elif preset_key == "TT133":
                updated_modules = [
                    "overview", "invoices", "cash", "bank", "purchases", "sales", "inventory",
                    "tools", "assets", "payroll", "tax", "ledger", "reports", "directory", "opening",
                ]
            else:
                updated_modules = [
                    "overview", "invoices", "cash", "bank", "purchases", "sales", "inventory",
                    "tools", "assets", "payroll", "tax", "cost", "insurance", "ledger",
                    "budget", "reports", "analysis", "directory", "opening", "connections",
                ]
            setting_obj, _ = CoreCompanySetting.objects.get_or_create(company=company)
            cfg = dict(setting_obj.configuration or {})
            cfg["ui_enabled_modules"] = updated_modules
            setting_obj.configuration = cfg
            setting_obj.save(update_fields=("configuration", "updated_at"))

    created_roles, reconcile_stats = seed_standard_roles_for_company(
        company,
        actor_account,
        preset=preset_key,
        force_preset_status=force_preset,
        return_meta=True,
    )
    active_count = sum(1 for r in created_roles if r["status"] == RoleStatus.ACTIVE)
    available_count = len(created_roles) - active_count
    remapped_count = reconcile_stats.get("remapped_count", 0)
    restored_count = reconcile_stats.get("restored_count", 0)

    extra_notes = []
    if remapped_count > 0:
        extra_notes.append(f"tự động kiêm nhiệm cho {remapped_count} nhân sự")
    if restored_count > 0:
        extra_notes.append(f"khôi phục vị trí chuyên trách cho {restored_count} nhân sự")
    extra_str = f" — {', '.join(extra_notes)}" if extra_notes else ""

    return Response({
        "message": (
            f"Đã chuyển đổi chế độ {preset_key} thành công: {active_count}/{len(created_roles)} vai trò đang kích hoạt, "
            f"{available_count} vai trò dự phòng có sẵn{extra_str}."
        ),
        "preset": preset_key,
        "accounting_regime": company.accounting_regime,
        "active_count": active_count,
        "available_count": available_count,
        "remapped_users_count": remapped_count,
        "restored_users_count": restored_count,
        "coa_summary": coa_summary,
        "ui_enabled_modules": updated_modules,
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
            role_assignments__role__code__in=["COMPANY_ADMIN", "ROLE_ADMIN", "ADMIN"],
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

    raw_branch = data.get("branch_id") or data.get("branch")
    all_branches = bool(data.get("all_branches")) or (str(raw_branch or "").strip().lower() == "all")
    is_admin_role = bool(role.is_system_admin or role.code in ("COMPANY_ADMIN", "ROLE_ADMIN", "ADMIN"))

    with transaction.atomic():
        if role.status != RoleStatus.ACTIVE:
            role.status = RoleStatus.ACTIVE
            role.save(update_fields=("status", "updated_at"))

        target_branch = None
        if raw_branch and not all_branches:
            target_branch = Branch.objects.filter(company=company, pk=raw_branch).first()
            if not target_branch:
                raise ValidationError({"branch_id": "Chi nhánh được chọn không thuộc doanh nghiệp."})
            if membership.employee_id:
                Employee.objects.filter(pk=membership.employee_id).update(branch=target_branch)

        if is_admin_role or all_branches:
            scope_set = _get_or_create_all_company_scope(company, actor or membership.user)
        elif target_branch:
            scope_set = _get_or_create_branch_scope(company, target_branch, actor or membership.user)
        else:
            existing_assignment = (
                UserRoleAssignment.objects.filter(company_membership=membership, status=ActiveStatus.ACTIVE)
                .select_related("data_scope_set")
                .first()
            )
            if existing_assignment and existing_assignment.data_scope_set and not existing_assignment.data_scope_set.allow_all_company_data:
                scope_set = existing_assignment.data_scope_set
            elif membership.employee_id and membership.employee.branch_id:
                scope_set = _get_or_create_branch_scope(company, membership.employee.branch, actor or membership.user)
            else:
                scope_set = _get_or_create_all_company_scope(company, actor or membership.user)

        UserRoleAssignment.objects.filter(
            company_membership=membership,
            status=ActiveStatus.ACTIVE,
        ).delete()

        assignment = UserRoleAssignment.objects.create(
            company_membership=membership,
            role=role,
            data_scope_set=scope_set,
            status=ActiveStatus.ACTIVE,
            assigned_by=actor or membership.user,
            assign_reason=data.get("reason", f"Phân công vai trò {role.name}"),
        )

        from common_services.models import UserPreference
        pref, _ = UserPreference.objects.get_or_create(user=membership.user)
        if scope_set.allow_all_company_data:
            pref.current_company = company
            pref.all_branches = True
            pref.save(update_fields=("current_company", "all_branches", "updated_at"))
        else:
            scoped_branch = target_branch or (membership.employee.branch if membership.employee_id else None)
            if scoped_branch:
                pref.current_company = company
                pref.current_branch = scoped_branch
                pref.all_branches = False
                pref.save(update_fields=("current_company", "current_branch", "all_branches", "updated_at"))

    return Response({
        "message": f"Đã phân vai trò '{role.name}' ({scope_set.name}) cho nhân sự {membership.user.display_name}.",
        "membership_id": str(membership.id),
        "role_code": role.code,
        "role_name": role.name,
        "scope_name": scope_set.name,
        "allow_all_company_data": scope_set.allow_all_company_data,
        "branch_id": str(target_branch.id) if target_branch else (str(membership.employee.branch_id) if membership.employee_id and membership.employee.branch_id else None),
        "assignment_id": str(assignment.id),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_staff_member_view(request):
    """Creates an Employee + UserAccount + CompanyMembership (and optional Role assignment) in one atomic step."""
    data = request.data
    company_id = data.get("company_id") or data.get("company") or request.query_params.get("company_id")
    if not company_id:
        raise ValidationError({"company_id": "Vui lòng chọn doanh nghiệp."})

    company = get_object_or_404(Company, pk=company_id)
    actor = getattr(request.user, "iam_account", None)

    if not request.user.is_superuser:
        if not actor:
            raise PermissionDenied("Tài khoản chưa liên kết IAM.")
        from iam.permissions import has_effective_permission, is_company_admin_member
        is_admin = (
            is_company_admin_member(actor, company)
            or has_effective_permission(actor, company, "SYS.USER.CREATE")
        )
        if not is_admin:
            raise PermissionDenied("Chỉ Quản trị viên doanh nghiệp mới có quyền thêm nhân sự trong doanh nghiệp này.")

    emp_code = (data.get("employee_code") or data.get("code") or "").strip().upper()
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip()
    raw_branch = data.get("branch_id") or data.get("branch") or None
    all_branches = bool(data.get("all_branches")) or (str(raw_branch or "").strip().lower() == "all")
    department_id = data.get("department") or data.get("department_id") or None
    position_id = data.get("position") or data.get("position_id") or None
    role_code = (data.get("role_code") or "").strip()

    if not emp_code or not full_name:
        raise ValidationError({"message": "Vui lòng nhập Mã nhân viên và Họ tên."})

    if not email:
        email = f"{emp_code.lower()}.{company.code.lower()}@soviet.local"

    with transaction.atomic():
        branch = None
        if raw_branch and not all_branches:
            branch = Branch.objects.filter(company=company, pk=raw_branch).first()
            if not branch:
                raise ValidationError({"branch_id": "Chi nhánh được chọn không thuộc doanh nghiệp."})

        if not branch:
            branch = Branch.objects.filter(company=company, status="ACTIVE").order_by("-is_head_office", "created_at").first()
        if not branch:
            branch = Branch.objects.create(
                company=company,
                code="HQ",
                name=f"Trụ sở chính - {company.name}"[:255],
                tax_code=company.tax_code or "",
                address=company.address or "",
                is_head_office=True,
            )

        dept = Department.objects.filter(company=company, pk=department_id).first() if department_id else None
        if dept and dept.branch_id and not (raw_branch and not all_branches):
            branch = dept.branch

        employee, _ = Employee.objects.update_or_create(
            company=company,
            employee_code=emp_code,
            defaults={
                "branch": branch,
                "department_id": dept.id if dept else None,
                "position_id": position_id or None,
                "full_name": full_name,
                "email": email,
                "phone": phone,
                "status": "ACTIVE",
            },
        )

        auth_user = User.objects.filter(email__iexact=email).first()
        if not auth_user:
            base_username = email.split("@")[0]
            candidate = base_username
            suffix = 1
            while User.objects.filter(username__iexact=candidate).exists():
                candidate = f"{base_username}_{company.code.lower()}_{suffix}"
                suffix += 1
            auth_user = User.objects.create_user(
                username=candidate,
                email=email,
                password=data.get("password") or "Soviet@123456",
            )

        user_account, _ = UserAccount.objects.get_or_create(
            auth_user=auth_user,
            defaults={
                "display_name": full_name,
                "phone": phone,
            },
        )
        if user_account.display_name != full_name or (phone and user_account.phone != phone):
            user_account.display_name = full_name
            if phone:
                user_account.phone = phone
            user_account.save(update_fields=("display_name", "phone", "updated_at"))

        membership, _ = CompanyMembership.objects.get_or_create(
            company=company,
            user=user_account,
            defaults={
                "employee": employee,
                "membership_status": ActiveStatus.ACTIVE,
                "join_source": "ADMIN_INVITE",
                "internal_display_name": full_name,
                "created_by": actor or user_account,
            },
        )
        if membership.employee_id != employee.id or membership.membership_status != ActiveStatus.ACTIVE:
            membership.employee = employee
            membership.membership_status = ActiveStatus.ACTIVE
            membership.save(update_fields=("employee", "membership_status", "updated_at"))

        assigned_role_name = None
        scope_name = None
        if role_code:
            role = Role.objects.filter(company=company, code=role_code).first()
            if role:
                is_admin_role = bool(role.is_system_admin or role.code in ("COMPANY_ADMIN", "ROLE_ADMIN", "ADMIN"))
                if is_admin_role or all_branches:
                    scope_set = _get_or_create_all_company_scope(company, actor or user_account)
                else:
                    scope_set = _get_or_create_branch_scope(company, branch, actor or user_account)
                scope_name = scope_set.name
                UserRoleAssignment.objects.filter(
                    company_membership=membership,
                    status=ActiveStatus.ACTIVE,
                ).delete()
                UserRoleAssignment.objects.create(
                    company_membership=membership,
                    role=role,
                    data_scope_set=scope_set,
                    status=ActiveStatus.ACTIVE,
                    assigned_by=actor or user_account,
                    assign_reason=f"Khởi tạo nhân sự với vai trò {role.name} ({scope_set.name})",
                )
                assigned_role_name = role.name

        from common_services.models import UserPreference
        pref, _ = UserPreference.objects.get_or_create(user=user_account)
        pref.current_company = company
        pref.current_branch = None if all_branches else branch
        pref.all_branches = bool(all_branches)
        pref.save(update_fields=("current_company", "current_branch", "all_branches", "updated_at"))

    return Response({
        "id": str(employee.id),
        "membership_id": str(membership.id),
        "employee_code": employee.employee_code,
        "full_name": employee.full_name,
        "email": email,
        "branch_id": str(branch.id),
        "branch_name": branch.name,
        "role_name": assigned_role_name,
        "scope_name": scope_name,
        "message": f"Đã thêm nhân viên {full_name} ({emp_code}) thuộc '{branch.name}' và tạo tài khoản phân quyền thành công.",
    }, status=status.HTTP_201_CREATED)
