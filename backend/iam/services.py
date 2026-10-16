from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit_log.services import record_audit

from .models import ActiveStatus, CompanyMembership, UserRoleAssignment
from .permissions import (
    has_effective_permission,
    has_other_effective_system_admin,
    memberships_in_scope,
    sync_assignment_statuses,
)


@transaction.atomic
def revoke_role_assignment(*, assignment: UserRoleAssignment, actor, reason="", request=None):
    if assignment.status == ActiveStatus.INACTIVE:
        return assignment
    if assignment.role.is_system_admin and not has_other_effective_system_admin(
        assignment.company_membership.company, excluded_assignment=assignment
    ):
        raise ValueError("Không thể gỡ Role Assignment quản trị cuối cùng của doanh nghiệp.")
    before = {"status": assignment.status, "valid_to": assignment.valid_to, "revoke_reason": assignment.revoke_reason}
    now = timezone.now()
    assignment.status = ActiveStatus.INACTIVE
    assignment.valid_to = assignment.valid_to or now
    assignment.revoked_by = actor
    assignment.revoked_at = now
    assignment.revoke_reason = reason
    assignment.full_clean()
    assignment.save(update_fields=("status", "valid_to", "revoked_by", "revoked_at", "revoke_reason"))
    record_audit(
        company=assignment.company_membership.company,
        actor_user=actor,
        module_code="IAM",
        action_code="REVOKE",
        entity=assignment,
        before=before,
        after={"status": assignment.status, "valid_to": assignment.valid_to, "revoke_reason": reason},
        request=request,
        reason=reason,
    )
    return assignment


class MembershipVersionConflict(ValidationError):
    status_code = 409
    default_detail = "Thông tin User đã thay đổi. Vui lòng tải lại."


@transaction.atomic
def update_company_user(*, membership_id, company, actor, data, request=None, is_platform_admin=False):
    membership = CompanyMembership.objects.select_for_update().select_related(
        "company", "employee", "user"
    ).get(pk=membership_id, company=company)
    if company.status != "ACTIVE":
        raise ValidationError("Doanh nghiệp không hoạt động.")
    if not CompanyMembership.objects.filter(
        company=company, user=actor, membership_status=ActiveStatus.ACTIVE
    ).exists():
        raise PermissionDenied("Người quản lý không còn Membership ACTIVE.")
    if membership.membership_status == "TERMINATED":
        raise ValidationError("Membership đã chấm dứt, chỉ được xem lịch sử.")
    if not is_platform_admin and not memberships_in_scope(actor, company, "SYS.USER.EDIT").filter(pk=membership.pk).exists():
        raise PermissionDenied("User nằm ngoài phạm vi quản lý.")
    if data["version"] != membership.updated_at:
        raise MembershipVersionConflict()

    before = {
        "internal_display_name": membership.internal_display_name,
        "internal_note": membership.internal_note,
        "employee_id": str(membership.employee_id) if membership.employee_id else None,
    }
    changed = []
    for field in ("internal_display_name", "internal_note"):
        if field in data and getattr(membership, field) != data[field]:
            setattr(membership, field, data[field])
            changed.append(field)

    if "employee" in data:
        employee = data["employee"]
        new_employee_id = employee.pk if employee else None
        if new_employee_id != membership.employee_id:
            if employee:
                if employee.company_id != company.pk or employee.status != "ACTIVE" or (
                    employee.termination_date and employee.termination_date < timezone.localdate()
                ):
                    raise ValidationError({"employee": "Hồ sơ nhân viên không hợp lệ trong doanh nghiệp."})
                if CompanyMembership.objects.filter(company=company, employee=employee).exclude(pk=membership.pk).exists():
                    raise ValidationError({"employee": "Hồ sơ nhân viên đã liên kết với User khác."})
                if not is_platform_admin and not has_effective_permission(
                    actor, company, "SYS.USER.LINK_EMPLOYEE",
                    branch_id=employee.branch_id, department_id=employee.department_id,
                ):
                    raise PermissionDenied("Hồ sơ nhân viên nằm ngoài phạm vi quản lý.")
            else:
                if not is_platform_admin and not has_effective_permission(
                    actor, company, "SYS.USER.LINK_EMPLOYEE",
                    branch_id=membership.employee.branch_id, department_id=membership.employee.department_id,
                ):
                    raise PermissionDenied("Không có quyền bỏ liên kết hồ sơ nhân viên.")
                if not data.get("confirm_unlink"):
                    raise ValidationError({"confirm_unlink": "Cần xác nhận bỏ liên kết hồ sơ nhân viên."})
            membership.employee = employee
            changed.append("employee")

    if not changed:
        return membership
    membership.updated_by = actor
    membership.full_clean()
    membership.save(update_fields=(*changed, "updated_by", "updated_at"))
    after = {
        "internal_display_name": membership.internal_display_name,
        "internal_note": membership.internal_note,
        "employee_id": str(membership.employee_id) if membership.employee_id else None,
    }
    record_audit(
        company=company, actor_user=actor, module_code="SYS", action_code="USER_MEMBERSHIP_UPDATE",
        entity=membership, before=before, after=after, request=request,
    )
    return membership


def check_user_management_permission(actor, company, action_code="LOCK"):
    """
    Check if actor has permission to lock/unlock user in company.
    Supports SYS.USER.LOCK / SYS.USER.UNLOCK with fallback to SYS.USER.EDIT or superuser.
    """
    if getattr(actor, "auth_user", None) and actor.auth_user.is_superuser:
        return True
    perm_code = f"SYS.USER.{action_code}"
    if has_effective_permission(actor, company, perm_code):
        return True
    if has_effective_permission(actor, company, "SYS.USER.EDIT"):
        return True
    return False


def get_pending_tasks_for_user(membership, company):
    """Thống kê các Approval Task đang chờ của User trong doanh nghiệp (Section 2.1 Step 7)."""
    try:
        from approval_workflows.models import ApprovalTask
        tasks = ApprovalTask.objects.select_related("request__document_type").filter(
            request__company=company,
            assignee=membership.user,
            status="PENDING",
        )
        task_list = [
            {
                "id": str(t.id),
                "request_id": str(t.request_id),
                "step_order": t.step_order,
                "document_type_code": t.request.document_type.code if t.request.document_type else "",
                "due_at": t.due_at.isoformat() if t.due_at else None,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tasks
        ]
        return {
            "membership_id": str(membership.id),
            "user_id": str(membership.user_id),
            "display_name": membership.user.display_name,
            "pending_tasks_count": len(task_list),
            "tasks": task_list,
        }
    except Exception:
        return {
            "membership_id": str(membership.id),
            "user_id": str(membership.user_id),
            "display_name": membership.user.display_name,
            "pending_tasks_count": 0,
            "tasks": [],
        }


@transaction.atomic
def lock_user(
    *, company, actor, target_membership_id=None, target_user_id=None,
    lock_type="MANUAL", lock_scope="COMPANY_ACCESS", lock_reason,
    start_time=None, auto_unlock_at=None, task_handling="KEEP",
    substitute_user_id=None, notify_user=True, request=None, is_system=False,
):
    """
    Khóa User tạm thời hoặc theo lịch trong doanh nghiệp (UC-SYS-17).
    """
    from .models import (
        LockRecordStatus,
        LockScope,
        LockType,
        MembershipStatus,
        TaskHandlingOption,
        UserAccount,
        UserLockRecord,
    )
    from audit_log.models import ActorType, EventCategory

    if not lock_reason or not str(lock_reason).strip():
        raise ValidationError("Lý do khóa là thông tin bắt buộc (BR-LOCK-08, EF-09).")

    # 1. Permission check (BR-LOCK-03, EF-03)
    if not is_system and not check_user_management_permission(actor, company, "LOCK"):
        raise PermissionDenied("Bạn không có Permission khóa User trong doanh nghiệp (BR-LOCK-03, EF-03).")

    # 2. Scope check: Global Account lock requires platform admin (BR-LOCK-05, BR-LOCK-06, BR-LOCK-07)
    if lock_scope == LockScope.GLOBAL_ACCOUNT:
        is_platform_admin = bool(getattr(actor, "auth_user", None) and actor.auth_user.is_superuser)
        if not is_platform_admin and not is_system:
            raise PermissionDenied("Admin doanh nghiệp không được khóa tài khoản toàn hệ thống (BR-LOCK-05, BR-LOCK-06).")

    # 3. Fetch membership with lock (select_for_update for concurrency guard - BR-LOCK-43)
    queryset = CompanyMembership.objects.select_for_update().select_related("company", "user__auth_user", "employee")
    if target_membership_id:
        membership = queryset.filter(pk=target_membership_id, company=company).first()
    elif target_user_id:
        membership = queryset.filter(user_id=target_user_id, company=company).first()
    else:
        raise ValidationError("Cần cung cấp membership_id hoặc user_id.")

    if not membership:
        raise ValidationError("User không thuộc doanh nghiệp hiện tại (EF-02).")

    if membership.membership_status in (MembershipStatus.TERMINATED, "ENDED"):
        raise ValidationError("Membership của User đã ở trạng thái đã chấm dứt (ENDED), không thể khóa (BR-LOCK-35, EF-04).")

    if membership.membership_status == MembershipStatus.LOCKED:
        raise ValidationError("User hiện đang ở trạng thái bị khóa (EF-05).")

    # 4. Data Scope check (BR-LOCK-04, EF-06)
    if not is_system and not (getattr(actor, "auth_user", None) and actor.auth_user.is_superuser):
        scoped = memberships_in_scope(actor, company, "SYS.USER.LOCK")
        if not scoped.filter(pk=membership.pk).exists():
            scoped = memberships_in_scope(actor, company, "SYS.USER.EDIT")
            if not scoped.filter(pk=membership.pk).exists():
                raise PermissionDenied("User mục tiêu nằm ngoài phạm vi quản lý của bạn (BR-LOCK-04, EF-06).")

    # 5. Admin protections (BR-LOCK-23, BR-LOCK-24, EF-07, EF-08)
    if not is_system:
        # Self-lock check
        if actor and actor == membership.user:
            if not has_other_effective_system_admin(company, excluded_user=actor):
                raise ValidationError("Không thể tự khóa chính mình khi không có User quản trị khác trong doanh nghiệp (BR-LOCK-24, EF-07).")

        # Last active system admin check
        is_sys_admin = membership.role_assignments.filter(
            role__is_system_admin=True,
            status=ActiveStatus.ACTIVE,
        ).filter(
            Q(valid_to__isnull=True) | Q(valid_to__gte=timezone.now())
        ).exists()
        if is_sys_admin and not has_other_effective_system_admin(company, excluded_user=membership.user):
            raise ValidationError("User mục tiêu là User quản trị hoạt động cuối cùng của doanh nghiệp. Không thể khóa khi chưa chỉ định người thay thế (BR-LOCK-23, EF-08).")

    # 6. Time validations (BR-LOCK-26, EF-10)
    now = timezone.now()
    start_time = start_time or now
    if lock_type == LockType.TEMPORARY:
        if not auto_unlock_at:
            raise ValidationError("Khóa tạm thời bắt buộc phải có thời điểm tự mở khóa (BR-LOCK-26).")
        if auto_unlock_at <= start_time:
            raise ValidationError("Thời điểm tự mở khóa phải lớn hơn thời điểm bắt đầu (EF-10).")

    # 7. Task handling validations (BR-LOCK-20, BR-LOCK-21, EF-11)
    substitute_account = None
    if task_handling == TaskHandlingOption.TRANSFER:
        if not substitute_user_id:
            raise ValidationError("Vui lòng chọn User thay thế để chuyển giao công việc đang chờ.")
        try:
            substitute_account = UserAccount.objects.get(pk=substitute_user_id)
        except UserAccount.DoesNotExist:
            raise ValidationError("User thay thế không tồn tại.")
        if substitute_account == membership.user:
            raise ValidationError("User thay thế không được trùng với User đang bị khóa.")
        sub_membership = CompanyMembership.objects.filter(
            company=company, user=substitute_account, membership_status=MembershipStatus.ACTIVE
        ).first()
        if not sub_membership or not substitute_account.auth_user.is_active:
            raise ValidationError("User thay thế không có Membership ACTIVE tại doanh nghiệp này (BR-LOCK-21, EF-11).")

        # Verify permissions on tasks
        try:
            from approval_workflows.models import ApprovalTask
            pending_tasks = list(ApprovalTask.objects.select_related("request__document_type").filter(
                request__company=company, assignee=membership.user, status="PENDING"
            ))
            for task in pending_tasks:
                doc_code = task.request.document_type.code if task.request.document_type else ""
                if doc_code and not has_effective_permission(substitute_account, company, f"{doc_code}.APPROVE"):
                    raise ValidationError(f"User thay thế không có Permission hoặc Data Scope phê duyệt cho loại chứng từ {doc_code} (BR-LOCK-21, EF-11).")
        except ImportError:
            pass

    # 8. State transition
    is_immediate = (start_time <= now)
    before_status = membership.membership_status
    new_status = MembershipStatus.LOCKED if is_immediate else MembershipStatus.SCHEDULED_LOCK
    record_status = LockRecordStatus.ACTIVE if is_immediate else LockRecordStatus.PENDING

    membership.membership_status = new_status
    membership.updated_by = actor
    membership.save(update_fields=("membership_status", "updated_by", "updated_at"))

    lock_record = UserLockRecord.objects.create(
        company=company,
        membership=membership,
        user=membership.user,
        lock_scope=lock_scope,
        lock_type=lock_type,
        lock_reason=lock_reason,
        start_time=start_time,
        auto_unlock_at=auto_unlock_at,
        task_handling=task_handling,
        substitute_user=substitute_account,
        notify_user=notify_user,
        status=record_status,
        locked_by=actor,
    )

    # 9. Immediate lock actions
    if is_immediate:
        # Invalidate current company context in UserPreference (BR-LOCK-09, BR-LOCK-10)
        try:
            from common_services.models import UserPreference
            pref = UserPreference.objects.filter(user=membership.user).first()
            if pref and pref.current_company_id == company.id:
                pref.current_company = None
                pref.current_branch = None
                pref.save(update_fields=("current_company", "current_branch", "updated_at"))
        except Exception:
            pass

        # Revoke sessions if GLOBAL_ACCOUNT (BR-LOCK-12, BR-LOCK-14)
        if lock_scope == LockScope.GLOBAL_ACCOUNT:
            try:
                from common_services.models import UserLoginSession, UserSessionState
                auth_user = membership.user.auth_user
                UserLoginSession.objects.filter(user=auth_user, revoked_at__isnull=True).update(
                    revoked_at=now, revoke_reason=f"GLOBAL_ACCOUNT_LOCK: {lock_reason}"
                )
                state, _ = UserSessionState.objects.get_or_create(user=auth_user)
                state.valid_after_epoch = int(now.timestamp())
                state.save(update_fields=("valid_after_epoch", "updated_at"))
            except Exception:
                pass

        # Reassign pending tasks if TRANSFER (BR-LOCK-20, BR-LOCK-21)
        if task_handling == TaskHandlingOption.TRANSFER and substitute_account:
            try:
                from approval_workflows.models import ApprovalTask, ApprovalEvent
                pending_tasks = list(ApprovalTask.objects.filter(
                    request__company=company, assignee=membership.user, status="PENDING"
                ))
                for pt in pending_tasks:
                    pt.status = "FORWARDED"
                    pt.forwarded_to = substitute_account
                    pt.completed_at = now
                    pt.version += 1
                    pt.save(update_fields=("status", "forwarded_to", "completed_at", "version"))
                    ApprovalTask.objects.create(
                        request=pt.request,
                        step_order=pt.step_order,
                        cycle=pt.cycle,
                        assignee=substitute_account,
                        due_at=pt.due_at,
                        version=1,
                    )
                    ApprovalEvent.objects.create(
                        request=pt.request,
                        task=pt,
                        actor=actor or membership.user,
                        action="FORWARD",
                        comment=f"Chuyển xử lý do User bị khóa: {lock_reason}",
                        metadata={"from_user": str(membership.user_id), "to_user": str(substitute_account.id), "reason": lock_reason},
                    )
            except Exception:
                pass

    # 10. Notification (AF-06, BR-LOCK-40)
    if notify_user:
        try:
            from common_services.models import Notification
            Notification.objects.create(
                user=membership.user,
                title="Thông báo khóa truy cập doanh nghiệp",
                message=f"Tài khoản của bạn tại doanh nghiệp {company.name} đã bị khóa ({lock_type}). Lý do: {lock_reason}",
                level=Notification.Level.WARNING,
            )
        except Exception:
            pass

    # 11. Audit Log (BR-LOCK-46, 47, 48)
    record_audit(
        company=company,
        actor_user=actor,
        actor_type=ActorType.SYSTEM if (actor is None or is_system) else ActorType.USER,
        module_code="IAM",
        event_category=EventCategory.USER_MANAGEMENT,
        action_code="USER_SCHEDULED_LOCK" if not is_immediate else "USER_LOCK",
        entity=lock_record,
        resource_code=membership.user.display_name,
        description=f"Khóa User {membership.user.display_name} ({lock_type}/{lock_scope}): {lock_reason}",
        before={"membership_status": before_status},
        after={
            "membership_status": new_status,
            "lock_type": lock_type,
            "lock_scope": lock_scope,
            "lock_reason": lock_reason,
            "start_time": start_time.isoformat(),
            "auto_unlock_at": auto_unlock_at.isoformat() if auto_unlock_at else None,
        },
        reason=lock_reason,
        request=request,
    )

    return lock_record


@transaction.atomic
def unlock_user(
    *, company, actor, target_membership_id=None, target_user_id=None,
    unlock_reason, require_password_change=False, require_mfa=False,
    request=None, is_system=False,
):
    """
    Mở khóa User trong doanh nghiệp (UC-SYS-17).
    """
    from .models import (
        LockRecordStatus,
        MembershipStatus,
        UserLockRecord,
    )
    from audit_log.models import ActorType, EventCategory

    if not unlock_reason or not str(unlock_reason).strip():
        raise ValidationError("Lý do mở khóa là thông tin bắt buộc (BR-LOCK-08).")

    # 1. Permission check (BR-LOCK-03, EF-16)
    if not is_system and not check_user_management_permission(actor, company, "UNLOCK"):
        raise PermissionDenied("Bạn không có Permission mở khóa User trong doanh nghiệp (BR-LOCK-03, EF-16).")

    # 2. Fetch membership with lock (BR-LOCK-43)
    queryset = CompanyMembership.objects.select_for_update().select_related("company", "user__auth_user")
    if target_membership_id:
        membership = queryset.filter(pk=target_membership_id, company=company).first()
    elif target_user_id:
        membership = queryset.filter(user_id=target_user_id, company=company).first()
    else:
        raise ValidationError("Cần cung cấp membership_id hoặc user_id.")

    if not membership:
        raise ValidationError("User không thuộc doanh nghiệp hiện tại (EF-02).")

    if membership.membership_status in (MembershipStatus.TERMINATED, "ENDED"):
        raise ValidationError("Membership của User đã ở trạng thái đã chấm dứt (ENDED), không thể mở khóa (BR-LOCK-35, EF-18).")

    if membership.membership_status not in (MembershipStatus.LOCKED, MembershipStatus.INACTIVE, MembershipStatus.SCHEDULED_LOCK):
        raise ValidationError("User không ở trạng thái bị khóa, không cần mở khóa (EF-17).")

    # 3. Check global lock (BR-LOCK-07, EF-19)
    now = timezone.now()
    is_superuser = bool(actor and getattr(actor, "auth_user", None) and actor.auth_user.is_superuser)
    if not is_superuser and not is_system:
        if not membership.user.auth_user.is_active or (membership.user.locked_until and membership.user.locked_until > now):
            raise ValidationError("Tài khoản đang bị khóa toàn hệ thống (GLOBAL_ACCOUNT). Vui lòng xử lý khóa toàn hệ thống trước khi mở khóa doanh nghiệp (BR-LOCK-07, EF-19).")

    before_status = membership.membership_status

    # 4. Release active / pending lock records
    active_locks = UserLockRecord.objects.filter(
        company=company,
        membership=membership,
        status__in=(LockRecordStatus.ACTIVE, LockRecordStatus.PENDING),
    )
    for al in active_locks:
        al.status = LockRecordStatus.RELEASED
        al.unlock_reason = unlock_reason
        al.unlocked_by = actor
        al.unlocked_at = now
        al.require_password_change = require_password_change
        al.require_mfa = require_mfa
        al.save()

    # 5. Re-activate membership
    membership.membership_status = MembershipStatus.ACTIVE
    membership.updated_by = actor
    membership.save(update_fields=("membership_status", "updated_by", "updated_at"))

    # 6. Re-evaluate expired roles/scopes (BR-LOCK-32, 33)
    sync_assignment_statuses(membership.user, company, at=now)

    # 7. Handle require_password_change
    if require_password_change:
        membership.user.password_changed_at = None
        membership.user.save(update_fields=("password_changed_at", "updated_at"))

    # 8. Reset failed login count if any
    if membership.user.failed_login_count > 0 or membership.user.locked_until:
        membership.user.failed_login_count = 0
        if is_superuser or is_system:
            membership.user.locked_until = None
        membership.user.save(update_fields=("failed_login_count", "locked_until", "updated_at"))

    # 9. Notify user
    try:
        from common_services.models import Notification
        Notification.objects.create(
            user=membership.user,
            title="Mở khóa tài khoản doanh nghiệp",
            message=f"Tài khoản của bạn tại {company.name} đã được mở khóa thành công. Lý do: {unlock_reason}",
            level=Notification.Level.SUCCESS,
        )
    except Exception:
        pass

    # 10. Audit Log (BR-LOCK-46, 47, 48)
    record_audit(
        company=company,
        actor_user=actor,
        actor_type=ActorType.SYSTEM if (actor is None or is_system) else ActorType.USER,
        module_code="IAM",
        event_category=EventCategory.USER_MANAGEMENT,
        action_code="USER_UNLOCK",
        entity=membership,
        resource_code=membership.user.display_name,
        description=f"Mở khóa User {membership.user.display_name}: {unlock_reason}",
        before={"membership_status": before_status},
        after={"membership_status": MembershipStatus.ACTIVE, "reason": unlock_reason},
        reason=unlock_reason,
        request=request,
    )

    return membership


def process_scheduled_and_expired_locks(at=None):
    """
    Xử lý tự động:
    1. Kích hoạt các bản ghi SCHEDULED_LOCK khi đến start_time (BR-LOCK-27).
    2. Tự động mở khóa các bản ghi TEMPORARY khi hết auto_unlock_at (AF-10, BR-LOCK-28).
    """
    from .models import LockRecordStatus, LockScope, LockType, MembershipStatus, UserLockRecord
    from audit_log.models import ActorType, EventCategory

    now = at or timezone.now()
    activated = 0
    unlocked = 0

    # 1. Kích hoạt khóa theo lịch
    pending_records = UserLockRecord.objects.select_related("company", "membership", "user").filter(
        status=LockRecordStatus.PENDING,
        start_time__lte=now,
    )
    for rec in pending_records:
        rec.status = LockRecordStatus.ACTIVE
        rec.save(update_fields=("status",))
        if rec.membership and rec.membership.membership_status == MembershipStatus.SCHEDULED_LOCK:
            rec.membership.membership_status = MembershipStatus.LOCKED
            rec.membership.save(update_fields=("membership_status", "updated_at"))
            record_audit(
                company=rec.company,
                actor_user=None,
                actor_type=ActorType.SYSTEM,
                module_code="IAM",
                event_category=EventCategory.USER_MANAGEMENT,
                action_code="USER_LOCK",
                entity=rec,
                resource_code=rec.user.display_name,
                description=f"Kích hoạt khóa theo lịch cho User {rec.user.display_name}: {rec.lock_reason}",
                before={"membership_status": MembershipStatus.SCHEDULED_LOCK},
                after={"membership_status": MembershipStatus.LOCKED, "reason": rec.lock_reason},
                reason=rec.lock_reason,
            )
            activated += 1

    # 2. Mở khóa tự động khi hết hạn tạm thời
    expired_records = UserLockRecord.objects.select_related("company", "membership", "user").filter(
        status=LockRecordStatus.ACTIVE,
        lock_type=LockType.TEMPORARY,
        auto_unlock_at__lte=now,
    )
    for rec in expired_records:
        if rec.lock_scope == LockScope.SECURITY_LOCK:
            # BR-LOCK-29: Khóa bảo mật không tự động mở
            continue
        try:
            unlock_user(
                company=rec.company,
                actor=None,
                target_membership_id=rec.membership_id,
                unlock_reason="Hết thời hạn khóa tạm thời (Hệ thống tự động mở khóa theo chính sách)",
                is_system=True,
            )
            unlocked += 1
        except Exception:
            pass

    return {"activated_count": activated, "unlocked_count": unlocked}


def trigger_security_lock(
    *, user_account, company=None,
    reason="Phát hiện đăng nhập thất bại vượt quá số lần cho phép",
    ip_address=None, max_attempts=5, lock_duration_minutes=30,
):
    """Tự động khóa bảo mật khi có hành vi bất thường hoặc vượt số lần đăng nhập sai (BR-LOCK-37, 38)."""
    from .models import LockRecordStatus, LockScope, LockType, MembershipStatus, UserLockRecord
    from audit_log.models import ActorType, EventCategory

    user_account.failed_login_count += 1
    now = timezone.now()
    if user_account.failed_login_count >= max_attempts:
        user_account.locked_until = now + timezone.timedelta(minutes=lock_duration_minutes)
        user_account.save(update_fields=("failed_login_count", "locked_until", "updated_at"))

        membership = None
        if company:
            membership = CompanyMembership.objects.filter(company=company, user=user_account).first()
            if membership and membership.membership_status == MembershipStatus.ACTIVE:
                membership.membership_status = MembershipStatus.LOCKED
                membership.save(update_fields=("membership_status", "updated_at"))

        rec = UserLockRecord.objects.create(
            company=company,
            membership=membership,
            user=user_account,
            lock_scope=LockScope.SECURITY_LOCK,
            lock_type=LockType.SECURITY,
            lock_reason=reason,
            start_time=now,
            auto_unlock_at=now + timezone.timedelta(minutes=lock_duration_minutes),
            status=LockRecordStatus.ACTIVE,
            notify_user=False,
            metadata={"ip_address": ip_address, "failed_count": user_account.failed_login_count},
        )
        record_audit(
            company=company,
            actor_user=None,
            actor_type=ActorType.SYSTEM,
            module_code="IAM",
            event_category=EventCategory.SECURITY,
            action_code="SECURITY_LOCK",
            entity=rec,
            resource_code=user_account.display_name,
            description=f"Tự động khóa bảo mật User {user_account.display_name}: {reason}",
            before={"failed_login_count": user_account.failed_login_count - 1},
            after={"failed_login_count": user_account.failed_login_count, "locked_until": user_account.locked_until.isoformat()},
            reason=reason,
        )
        return rec
    else:
        user_account.save(update_fields=("failed_login_count", "updated_at"))
        return None


def bulk_lock_users(*, company, actor, items, default_reason="Khóa hàng loạt", request=None):
    """Khóa hàng loạt User, kiểm tra và xử lý độc lập từng User (AF-15, BR-LOCK-44, 45)."""
    from .models import LockScope, LockType, TaskHandlingOption

    succeeded = []
    failed = []
    for item in items:
        membership_id = item.get("membership_id")
        user_id = item.get("user_id")
        reason = item.get("lock_reason") or item.get("reason") or default_reason
        sid = str(membership_id or user_id)
        try:
            with transaction.atomic():
                rec = lock_user(
                    company=company,
                    actor=actor,
                    target_membership_id=membership_id,
                    target_user_id=user_id,
                    lock_type=item.get("lock_type", LockType.MANUAL),
                    lock_scope=item.get("lock_scope", LockScope.COMPANY_ACCESS),
                    lock_reason=reason,
                    start_time=item.get("start_time"),
                    auto_unlock_at=item.get("auto_unlock_at"),
                    task_handling=item.get("task_handling", TaskHandlingOption.KEEP),
                    substitute_user_id=item.get("substitute_user_id"),
                    notify_user=item.get("notify_user", True),
                    request=request,
                )
                succeeded.append({
                    "id": sid,
                    "user_id": str(rec.user_id),
                    "user_name": rec.user.display_name,
                    "status": rec.status,
                })
        except Exception as e:
            failed.append({
                "id": sid,
                "error": str(e),
            })
    return {"succeeded": succeeded, "failed": failed}


def bulk_unlock_users(*, company, actor, items, default_reason="Mở khóa hàng loạt", request=None):
    """Mở khóa hàng loạt User, kiểm tra và xử lý độc lập từng User (AF-15, BR-LOCK-44, 45)."""
    succeeded = []
    failed = []
    for item in items:
        membership_id = item.get("membership_id")
        user_id = item.get("user_id")
        reason = item.get("unlock_reason") or item.get("reason") or default_reason
        sid = str(membership_id or user_id)
        try:
            with transaction.atomic():
                mem = unlock_user(
                    company=company,
                    actor=actor,
                    target_membership_id=membership_id,
                    target_user_id=user_id,
                    unlock_reason=reason,
                    require_password_change=item.get("require_password_change", False),
                    require_mfa=item.get("require_mfa", False),
                    request=request,
                )
                succeeded.append({
                    "id": sid,
                    "user_id": str(mem.user_id),
                    "user_name": mem.user.display_name,
                    "status": mem.membership_status,
                })
        except Exception as e:
            failed.append({
                "id": sid,
                "error": str(e),
            })
    return {"succeeded": succeeded, "failed": failed}


def get_user_lock_history(membership):
    """Tra cứu toàn bộ lịch sử khóa và mở khóa của Membership (AF-14)."""
    from .models import UserLockRecord
    return UserLockRecord.objects.filter(membership=membership).order_by("-locked_at")


# =====================================================================
# UC-SYS-18: NGỪNG QUYỀN THAM GIA DOANH NGHIỆP (MEMBERSHIP TERMINATION)
# =====================================================================

def _is_company_admin(membership):
    if not membership:
        return False
    from .models import AssignmentStatus, RoleStatus
    now = timezone.now()
    has_admin_role = membership.role_assignments.filter(
        role__is_system_admin=True,
        role__status=RoleStatus.ACTIVE,
        status=AssignmentStatus.ACTIVE,
        valid_from__lte=now,
    ).filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=now)
    ).exists()
    if has_admin_role:
        return True
    if membership.company and membership.company.created_by_user_id and membership.company.created_by_user_id == membership.user_id:
        return True
    return False


def _count_active_admins(company):
    from .models import CompanyMembership, MembershipStatus, AssignmentStatus, RoleStatus
    now = timezone.now()
    admin_user_ids = set(
        CompanyMembership.objects.filter(
            company=company,
            membership_status__in=[
                MembershipStatus.ACTIVE,
                MembershipStatus.LOCKED,
                MembershipStatus.SCHEDULED_LOCK,
                getattr(MembershipStatus, "END_SCHEDULED", "END_SCHEDULED"),
            ],
            user__auth_user__is_active=True,
            role_assignments__role__is_system_admin=True,
            role_assignments__role__status=RoleStatus.ACTIVE,
            role_assignments__status=AssignmentStatus.ACTIVE,
            role_assignments__valid_from__lte=now,
        ).filter(
            Q(role_assignments__valid_to__isnull=True) | Q(role_assignments__valid_to__gte=now)
        ).values_list("user_id", flat=True)
    )
    if company.created_by_user_id:
        owner_mem = CompanyMembership.objects.filter(
            company=company,
            user_id=company.created_by_user_id,
            membership_status__in=[
                MembershipStatus.ACTIVE,
                MembershipStatus.LOCKED,
                MembershipStatus.SCHEDULED_LOCK,
                getattr(MembershipStatus, "END_SCHEDULED", "END_SCHEDULED"),
            ],
        ).first()
        if owner_mem:
            admin_user_ids.add(company.created_by_user_id)
    return len(admin_user_ids)


def get_membership_impact_analysis(company, membership_id, actor=None):
    """
    Phân tích tác động trước khi ngừng quyền tham gia doanh nghiệp (Main Flow Bước 6, 7).
    Kiểm tra Role, Permission, Data Scope, Org Assignment, Approval Task, Workflow, Draft, Job, Sessions.
    """
    from .models import (
        AssignmentStatus,
        CompanyMembership,
        MembershipStatus,
        OrganizationAssignment,
        UserRoleAssignment,
    )
    from .permissions import has_effective_permission, is_platform_admin_user, memberships_in_scope

    membership = CompanyMembership.objects.select_related("user", "company", "employee", "organization_unit").filter(
        pk=membership_id, company=company
    ).first()
    if not membership:
        raise ValidationError({"membership": "Không tìm thấy Membership trong doanh nghiệp (EF-02)."})

    user = membership.user

    # 1. Quản trị & Owner
    is_owner = (company.created_by_user_id == user.id) or (membership.join_source == "BOOTSTRAP")
    active_admins_count = _count_active_admins(company)
    target_is_admin = _is_company_admin(membership)
    is_last_admin = target_is_admin and (active_admins_count <= 1)
    
    total_active_members = CompanyMembership.objects.filter(
        company=company,
        membership_status__in=[MembershipStatus.ACTIVE, MembershipStatus.LOCKED, MembershipStatus.SCHEDULED_LOCK, MembershipStatus.END_SCHEDULED]
    ).count()
    is_sole_member = total_active_members <= 1

    # 2. Roles & Direct Permissions
    roles_qs = membership.role_assignments.filter(status=AssignmentStatus.ACTIVE).select_related("role")
    active_roles = [{"id": str(r.role_id), "code": r.role.code, "name": r.role.name} for r in roles_qs]

    # Direct permission overrides
    overrides_qs = membership.permission_overrides.filter(
        Q(valid_to__isnull=True) | Q(valid_to__gte=timezone.now())
    ).select_related("permission")
    direct_permissions = [{"id": str(o.permission_id), "code": o.permission.code, "effect": o.effect} for o in overrides_qs]

    # 3. Data Scopes
    data_scopes = []
    for r in roles_qs:
        if r.data_scope_set:
            data_scopes.append({"id": str(r.data_scope_set_id), "name": r.data_scope_set.name})

    # 4. Organization Assignments
    org_qs = membership.organization_assignments.filter(status=OrganizationAssignment.State.ACTIVE).select_related("unit", "position")
    org_assignments = [{
        "id": str(o.id),
        "unit_name": o.unit.name,
        "assignment_type": o.assignment_type,
        "position_name": o.position.name if o.position else o.job_title,
    } for o in org_qs]

    # 5. Pending Approval Tasks
    pending_tasks = []
    try:
        from approval_workflows.models import ApprovalTask
        tasks_qs = ApprovalTask.objects.filter(
            request__company=company,
            assignee=user,
            status="PENDING",
        ).select_related("request", "request__document_type")
        for t in tasks_qs:
            pending_tasks.append({
                "id": str(t.id),
                "request_id": str(t.request_id),
                "document_type": getattr(t.request.document_type, "code", ""),
                "document_name": getattr(t.request.document_type, "name", ""),
                "step_order": t.step_order,
                "created_at": t.created_at.isoformat() if hasattr(t, "created_at") and t.created_at else None,
            })
    except Exception:
        pass

    # 6. Referenced Workflows (BR-MEM-END-29, EF-07)
    referenced_workflows = []
    try:
        from approval_workflows.models import WorkflowVersion
        active_versions = WorkflowVersion.objects.filter(
            workflow__company=company,
            status=WorkflowVersion.State.ACTIVE,
        ).select_related("workflow")
        for ver in active_versions:
            for idx, step in enumerate(ver.steps or []):
                approvers = step.get("approvers", [])
                has_user = any(a.get("type") == "USER" and str(a.get("id")) == str(user.id) for a in approvers)
                if has_user:
                    referenced_workflows.append({
                        "workflow_id": str(ver.workflow_id),
                        "workflow_code": ver.workflow.code,
                        "workflow_name": ver.workflow.name,
                        "step_order": step.get("order", idx + 1),
                        "step_name": step.get("name", f"Bước {idx + 1}"),
                        "is_sole_approver": len(approvers) == 1,
                        "has_fallback": bool(step.get("fallback")),
                    })
    except Exception:
        pass

    # 7. Draft Documents
    draft_documents_count = 0
    # Search draft documents in purchases / sales / cash / general ledger if available
    for model_path in ("purchases.PurchaseOrder", "sales.SalesOrder", "cash_management.CashPaymentVoucher"):
        try:
            from django.apps import apps
            app_label, model_name = model_path.split(".")
            M = apps.get_model(app_label, model_name)
            if M:
                draft_documents_count += M.objects.filter(company=company, created_by=user, status="DRAFT").count()
        except Exception:
            pass

    # 8. Active Sessions
    active_sessions_count = 0
    try:
        from common_services.models import UserLoginSession
        active_sessions_count = UserLoginSession.objects.filter(user=user.auth_user, company=company, is_active=True).count()
    except Exception:
        pass

    return {
        "membership_id": str(membership.id),
        "user_id": str(user.id),
        "display_name": user.display_name,
        "email": user.auth_user.email,
        "current_status": membership.access_status,
        "joined_at": membership.joined_at.isoformat() if membership.joined_at else None,
        "is_owner": is_owner,
        "is_last_admin": is_last_admin,
        "is_sole_member": is_sole_member,
        "active_roles": active_roles,
        "direct_permissions": direct_permissions,
        "data_scopes": data_scopes,
        "org_assignments": org_assignments,
        "pending_approval_tasks": pending_tasks,
        "referenced_workflows": referenced_workflows,
        "draft_documents_count": draft_documents_count,
        "running_jobs_count": 0,
        "active_sessions_count": active_sessions_count,
    }


def terminate_membership(
    *, company, actor, target_membership_id=None, target_user_id=None,
    termination_type=None, reason="", effective_at=None,
    substitute_user_id=None, task_handling="KEEP",
    draft_handling="KEEP", job_handling="SYSTEM_CONTINUE",
    notify_user=True, note="", is_system=False, request=None,
):
    """
    Thực hiện chấm dứt hoặc lên lịch chấm dứt quyền tham gia doanh nghiệp của User (UC-SYS-18 Main Flow 2.1).
    """
    from .models import (
        AssignmentStatus,
        CompanyMembership,
        DraftHandlingOption,
        JobHandlingOption,
        MembershipStatus,
        MembershipTerminationRecord,
        OrganizationAssignment,
        TaskHandlingOption,
        TerminationRecordStatus,
        TerminationType,
        UserAccount,
    )
    from .permissions import has_effective_permission, is_platform_admin_user, memberships_in_scope
    from audit_log.models import ActorType, EventCategory

    # 1. Validate reason (EF-06, BR-MEM-END-06)
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Lý do ngừng quyền tham gia là bắt buộc (EF-06, BR-MEM-END-06)."})

    # 2. Check Actor permission (EF-01, EF-04, BR-MEM-END-04, 05)
    is_platform_admin = is_platform_admin_user(actor) if actor else False
    if not is_system and not is_platform_admin:
        if not actor or not (
            has_effective_permission(actor, company, "SYS.USER.TERMINATE")
            or has_effective_permission(actor, company, "SYS.MEMBERSHIP.TERMINATE")
            or has_effective_permission(actor, company, "SYS.USER.EDIT")
        ):
            raise ValidationError({"actor": "Actor không có Permission quản lý Membership hoặc ngừng User (EF-01, BR-MEM-END-04)."})

    # 3. Locate Membership with select_for_update (BR-MEM-END-46, 47, EF-14)
    with transaction.atomic():
        query = CompanyMembership.objects.select_for_update().select_related("user", "company", "employee")
        if target_membership_id:
            membership = query.filter(pk=target_membership_id, company=company).first()
        elif target_user_id:
            membership = query.filter(user_id=target_user_id, company=company).first()
        else:
            raise ValidationError({"membership": "Vui lòng chỉ định Membership hoặc User cần ngừng tham gia."})

        if not membership:
            raise ValidationError({"membership": "User không thuộc doanh nghiệp hiện tại (EF-02, BR-MEM-END-05)."})

        # Check actor management scope (EF-04)
        if not is_system and not is_platform_admin:
            if not memberships_in_scope(actor, company, "SYS.USER.EDIT").filter(pk=membership.pk).exists():
                raise PermissionDenied("Actor không được quản lý User mục tiêu (EF-04, BR-MEM-END-05).")

        # 4. Check current status: must not be already ENDED (EF-03)
        if membership.membership_status in (MembershipStatus.TERMINATED, "ENDED", MembershipStatus.ENDED):
            raise ValidationError({"membership": "Membership đã ở trạng thái ENDED; User đã ngừng tham gia doanh nghiệp (EF-03)."})

        # 5. Determine termination type & effective_at
        now = timezone.now()
        if not termination_type:
            termination_type = TerminationType.IMMEDIATE if not effective_at or effective_at <= now else TerminationType.SCHEDULED

        if termination_type == TerminationType.IMMEDIATE:
            effective_at = now
        else:
            if not effective_at:
                effective_at = now
            elif (now - effective_at).total_seconds() > 60:
                raise ValidationError({"effective_at": "Thời điểm ngừng theo lịch không thể trong quá khứ (EF-05)."})
            elif effective_at < now:
                effective_at = now

        is_scheduled = (effective_at > now) and (termination_type != TerminationType.IMMEDIATE)

        # 6. Admin Safety Checks (BR-MEM-END-31, 32, 33, 34, EF-11, EF-12)
        target_user = membership.user
        target_is_admin = _is_company_admin(membership)
        active_admins_count = _count_active_admins(company)

        # EF-12: Actor cố tự ngừng Membership của mình khi không còn Admin khác
        if actor and actor.id == target_user.id and target_is_admin and active_admins_count <= 1:
            raise ValidationError({"user": "Bạn là Admin duy nhất của doanh nghiệp, không thể tự ngừng Membership khi chưa chỉ định Admin thay thế (EF-12, BR-MEM-END-33)."})

        # EF-11: User mục tiêu là User quản trị cuối cùng
        if target_is_admin and active_admins_count <= 1:
            raise ValidationError({"user": "Không thể ngừng Membership của User quản trị hoạt động cuối cùng khi chưa có User quản trị thay thế (EF-11, BR-MEM-END-31)."})

        # Owner / Sole member check
        is_owner = (company.created_by_user_id == target_user.id) or (membership.join_source == "BOOTSTRAP")
        active_members_count = CompanyMembership.objects.filter(
            company=company,
            membership_status__in=[MembershipStatus.ACTIVE, MembershipStatus.LOCKED, MembershipStatus.SCHEDULED_LOCK, MembershipStatus.END_SCHEDULED]
        ).count()
        if is_owner and active_members_count <= 1:
            raise ValidationError({"user": "Owner hoặc thành viên duy nhất không thể ngừng Membership của doanh nghiệp duy nhất còn hoạt động. Vui lòng chuyển giao quyền quản trị hoặc thực hiện thủ tục giải thể doanh nghiệp (BR-MEM-END-32, 33, 34, EF-11)."})

        # 7. Check Workflow References (BR-MEM-END-29, 30, EF-07)
        try:
            from approval_workflows.models import WorkflowVersion
            active_versions = WorkflowVersion.objects.filter(
                workflow__company=company,
                status=WorkflowVersion.State.ACTIVE,
            ).select_related("workflow")
            for ver in active_versions:
                for idx, step in enumerate(ver.steps or []):
                    approvers = step.get("approvers", [])
                    user_approvers = [a for a in approvers if a.get("type") == "USER" and str(a.get("id")) == str(target_user.id)]
                    if user_approvers and len(approvers) == 1 and not substitute_user_id and not step.get("fallback"):
                        raise ValidationError({
                            "workflow": f"User là Approver bắt buộc duy nhất của bước {idx + 1} trong quy trình '{ver.workflow.name}'. Vui lòng cấu hình Fallback hoặc chỉ định User thay thế trước khi ngừng Membership (BR-MEM-END-29, EF-07)."
                        })
        except ValidationError:
            raise
        except Exception:
            pass

        # 8. Handle substitute user & pending tasks (BR-MEM-END-23, 24, 25, EF-08, EF-09)
        substitute_user = None
        if substitute_user_id:
            sub_membership = CompanyMembership.objects.filter(
                company=company,
                user_id=substitute_user_id,
                membership_status__in=[MembershipStatus.ACTIVE, "ACTIVE"],
            ).first()
            if not sub_membership:
                raise ValidationError({"substitute_user": "User tiếp nhận không có Membership ACTIVE trong doanh nghiệp (EF-08, BR-MEM-END-25)."})
            substitute_user = sub_membership.user

        pending_tasks = []
        try:
            from approval_workflows.models import ApprovalTask
            pending_tasks = list(ApprovalTask.objects.filter(
                request__company=company,
                assignee=target_user,
                status="PENDING",
            ).select_related("request", "request__document_type"))
        except Exception:
            pass

        if pending_tasks:
            if task_handling == TaskHandlingOption.TRANSFER:
                if not substitute_user:
                    raise ValidationError({"substitute_user": "Vui lòng chọn User tiếp nhận khi chọn phương án chuyển giao công việc phê duyệt (BR-MEM-END-24)."})
                
                # Check permissions of substitute user (EF-09, BR-MEM-END-25)
                for t in pending_tasks:
                    doc_type_code = getattr(t.request.document_type, "code", "")
                    perm_code = f"{doc_type_code}.APPROVE"
                    if not has_effective_permission(substitute_user, company, perm_code) and not has_effective_permission(substitute_user, company, "APPROVAL.PROCESS"):
                        raise ValidationError({"substitute_user": f"User tiếp nhận không có quyền phê duyệt chứng từ loại {doc_type_code} (EF-09, BR-MEM-END-25)."})

                # Execute task transfer
                from approval_workflows.models import ApprovalTask
                for t in pending_tasks:
                    t.status = "FORWARDED"
                    t.forwarded_to = substitute_user
                    t.save(update_fields=("status", "forwarded_to"))
                    ApprovalTask.objects.create(
                        request=t.request,
                        step_order=t.step_order,
                        cycle=t.cycle,
                        assignee=substitute_user,
                        status="PENDING",
                    )
            elif task_handling == TaskHandlingOption.UNASSIGNED:
                for t in pending_tasks:
                    t.assignee = None
                    t.save(update_fields=("assignee",))
            elif task_handling == TaskHandlingOption.FALLBACK:
                # Follow fallback logic
                pass
            # BR-MEM-END-23: Absolutely NEVER auto-approve tasks!

        # 9. Handle Draft Documents (BR-MEM-END-26, 27, 28, AF-06, AF-07)
        if draft_handling == DraftHandlingOption.TRANSFER and substitute_user:
            # Reassign draft documents without modifying created_by (BR-MEM-END-26)
            for model_path in ("purchases.PurchaseOrder", "sales.SalesOrder", "cash_management.CashPaymentVoucher"):
                try:
                    from django.apps import apps
                    app_label, model_name = model_path.split(".")
                    M = apps.get_model(app_label, model_name)
                    if M and hasattr(M, "assignee"):
                        M.objects.filter(company=company, created_by=target_user, status="DRAFT").update(assignee=substitute_user)
                except Exception:
                    pass
        elif draft_handling == DraftHandlingOption.CANCEL:
            for model_path in ("purchases.PurchaseOrder", "sales.SalesOrder", "cash_management.CashPaymentVoucher"):
                try:
                    from django.apps import apps
                    app_label, model_name = model_path.split(".")
                    M = apps.get_model(app_label, model_name)
                    if M and hasattr(M, "status"):
                        M.objects.filter(company=company, created_by=target_user, status="DRAFT").update(status="CANCELLED")
                except Exception:
                    pass

        # 10. Update Membership Status & Termination Record
        before_status = membership.membership_status
        record_status = TerminationRecordStatus.PENDING if is_scheduled else TerminationRecordStatus.COMPLETED

        term_record = MembershipTerminationRecord.objects.create(
            company=company,
            membership=membership,
            user=target_user,
            termination_type=termination_type,
            status=record_status,
            reason=reason,
            note=note,
            effective_at=effective_at,
            substitute_user=substitute_user,
            task_handling=task_handling,
            draft_handling=draft_handling,
            job_handling=job_handling,
            notify_user=notify_user,
            created_by=actor,
            completed_at=now if not is_scheduled else None,
        )

        if is_scheduled:
            membership.membership_status = MembershipStatus.END_SCHEDULED
            membership.save(update_fields=("membership_status", "updated_at"))
        else:
            # Immediate Termination
            membership.membership_status = MembershipStatus.ENDED
            membership.left_at = effective_at
            membership.save(update_fields=("membership_status", "left_at", "updated_at"))

            # 11. Expire Assignments & Revoke Access (BR-MEM-END-13, 14, 15, 16, 17, 18)
            membership.role_assignments.filter(status=AssignmentStatus.ACTIVE).update(
                status=AssignmentStatus.EXPIRED,
                valid_to=effective_at,
                revoked_by=actor,
                revoked_at=effective_at,
                revoke_reason=f"Ngừng quyền tham gia doanh nghiệp ({reason})",
            )
            membership.permission_overrides.filter(Q(valid_to__isnull=True) | Q(valid_to__gte=effective_at)).update(
                valid_to=effective_at,
                revoked_by=actor,
                revoked_at=effective_at,
            )
            membership.organization_assignments.filter(status=OrganizationAssignment.State.ACTIVE).update(
                status=OrganizationAssignment.State.REVOKED,
                end_date=effective_at.date(),
                updated_by=actor,
                updated_at=effective_at,
            )

            # 12. Revoke company session & preference (BR-MEM-END-12)
            try:
                from common_services.models import UserPreference
                UserPreference.objects.filter(user=target_user, current_company=company).update(current_company=None)
            except Exception:
                pass

            try:
                from common_services.models import UserLoginSession
                UserLoginSession.objects.filter(user=target_user.auth_user, company=company, is_active=True).update(
                    is_active=False,
                    logout_at=effective_at,
                    revocation_reason=f"Ngừng quyền tham gia doanh nghiệp ({reason})",
                )
            except Exception:
                pass

        # 13. Send Notification if applicable (BR-MEM-END-49, 50)
        if notify_user and termination_type != TerminationType.SECURITY:
            try:
                from common_services.models import Notification
                time_str = effective_at.strftime("%d/%m/%Y %H:%M")
                msg = f"Quyền tham gia doanh nghiệp {company.name} của bạn đã kết thúc vào {time_str}. Lý do: {reason}" if not is_scheduled else f"Quyền tham gia doanh nghiệp {company.name} của bạn đã được lên lịch kết thúc vào {time_str}. Lý do: {reason}"
                Notification.objects.create(
                    user=target_user,
                    title="Thông báo ngừng quyền tham gia doanh nghiệp",
                    message=msg,
                    level=Notification.Level.WARNING if not is_scheduled else Notification.Level.INFO,
                )
            except Exception:
                pass

        # 14. Record Audit Log (BR-MEM-END-51, 52)
        record_audit(
            company=company,
            actor_user=actor,
            actor_type=ActorType.SYSTEM if (actor is None or is_system) else ActorType.USER,
            module_code="IAM",
            event_category=EventCategory.USER_MANAGEMENT,
            action_code="MEMBERSHIP_TERMINATE",
            entity=term_record,
            resource_code=target_user.display_name,
            description=f"Ngừng quyền tham gia doanh nghiệp của {target_user.display_name} ({termination_type}): {reason}",
            before={"membership_status": before_status},
            after={"membership_status": membership.membership_status, "effective_at": effective_at.isoformat(), "reason": reason},
            reason=reason,
            request=request,
        )

        return term_record


def cancel_scheduled_termination(*, company, actor, membership_id, reason="", request=None):
    """
    Hủy lịch ngừng quyền tham gia doanh nghiệp trước khi đến thời điểm hiệu lực (AF-12, BR-MEM-END-08).
    """
    from .models import CompanyMembership, MembershipStatus, MembershipTerminationRecord, TerminationRecordStatus
    from .permissions import has_effective_permission, is_platform_admin_user
    from audit_log.models import ActorType, EventCategory

    reason = (reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Lý do hủy lịch ngừng là bắt buộc (BR-MEM-END-06)."})

    is_platform_admin = is_platform_admin_user(actor) if actor else False
    if not is_platform_admin:
        if not actor or not (
            has_effective_permission(actor, company, "SYS.USER.TERMINATE")
            or has_effective_permission(actor, company, "SYS.MEMBERSHIP.TERMINATE")
            or has_effective_permission(actor, company, "SYS.USER.EDIT")
        ):
            raise ValidationError({"actor": "Actor không có Permission quản lý Membership (EF-01, BR-MEM-END-04)."})

    with transaction.atomic():
        membership = CompanyMembership.objects.select_for_update().select_related("user").filter(
            pk=membership_id, company=company
        ).first()
        if not membership:
            raise ValidationError({"membership": "Không tìm thấy Membership trong doanh nghiệp (EF-02)."})

        if membership.membership_status != MembershipStatus.END_SCHEDULED:
            raise ValidationError({"membership": "Membership không ở trạng thái END_SCHEDULED để hủy lịch ngừng."})

        # Find pending termination record
        rec = MembershipTerminationRecord.objects.select_for_update().filter(
            membership=membership,
            status=TerminationRecordStatus.PENDING,
        ).order_by("-created_at").first()

        now = timezone.now()
        if rec:
            rec.status = TerminationRecordStatus.CANCELLED
            rec.cancelled_at = now
            rec.cancelled_by = actor
            rec.cancellation_reason = reason
            rec.save(update_fields=("status", "cancelled_at", "cancelled_by", "cancellation_reason"))

        membership.membership_status = MembershipStatus.ACTIVE
        membership.save(update_fields=("membership_status", "updated_at"))

        record_audit(
            company=company,
            actor_user=actor,
            actor_type=ActorType.USER if actor else ActorType.SYSTEM,
            module_code="IAM",
            event_category=EventCategory.USER_MANAGEMENT,
            action_code="MEMBERSHIP_TERMINATION_CANCELLED",
            entity=membership,
            resource_code=membership.user.display_name,
            description=f"Hủy lịch ngừng Membership của {membership.user.display_name}: {reason}",
            before={"membership_status": MembershipStatus.END_SCHEDULED},
            after={"membership_status": MembershipStatus.ACTIVE, "reason": reason},
            reason=reason,
            request=request,
        )

        return membership


def process_scheduled_terminations(at=None):
    """
    Xử lý tự động kích hoạt các bản ghi END_SCHEDULED khi đến thời điểm effective_at (AF-02, BR-MEM-END-07).
    """
    from .models import (
        AssignmentStatus,
        MembershipStatus,
        MembershipTerminationRecord,
        OrganizationAssignment,
        TerminationRecordStatus,
    )
    from audit_log.models import ActorType, EventCategory

    now = at or timezone.now()
    pending_records = MembershipTerminationRecord.objects.select_for_update().select_related(
        "company", "membership", "user", "substitute_user"
    ).filter(
        status=TerminationRecordStatus.PENDING,
        effective_at__lte=now,
    )

    completed_count = 0
    for rec in pending_records:
        with transaction.atomic():
            membership = rec.membership
            if membership.membership_status == MembershipStatus.END_SCHEDULED:
                membership.membership_status = MembershipStatus.ENDED
                membership.left_at = rec.effective_at
                membership.save(update_fields=("membership_status", "left_at", "updated_at"))

                # Expire assignments
                membership.role_assignments.filter(status=AssignmentStatus.ACTIVE).update(
                    status=AssignmentStatus.EXPIRED,
                    valid_to=rec.effective_at,
                    revoked_at=rec.effective_at,
                    revoke_reason=f"Hệ thống thực hiện ngừng theo lịch ({rec.reason})",
                )
                membership.permission_overrides.filter(Q(valid_to__isnull=True) | Q(valid_to__gte=rec.effective_at)).update(
                    valid_to=rec.effective_at,
                    revoked_at=rec.effective_at,
                )
                membership.organization_assignments.filter(status=OrganizationAssignment.State.ACTIVE).update(
                    status=OrganizationAssignment.State.REVOKED,
                    end_date=rec.effective_at.date(),
                    updated_at=rec.effective_at,
                )

                # Revoke sessions
                try:
                    from common_services.models import UserPreference
                    UserPreference.objects.filter(user=rec.user, current_company=rec.company).update(current_company=None)
                except Exception:
                    pass

                try:
                    from common_services.models import UserLoginSession
                    UserLoginSession.objects.filter(user=rec.user.auth_user, company=rec.company, is_active=True).update(
                        is_active=False,
                        logout_at=rec.effective_at,
                        revocation_reason=f"Hệ thống thực hiện ngừng theo lịch ({rec.reason})",
                    )
                except Exception:
                    pass

            rec.status = TerminationRecordStatus.COMPLETED
            rec.completed_at = now
            rec.save(update_fields=("status", "completed_at"))

            record_audit(
                company=rec.company,
                actor_user=None,
                actor_type=ActorType.SYSTEM,
                module_code="IAM",
                event_category=EventCategory.USER_MANAGEMENT,
                action_code="MEMBERSHIP_TERMINATE",
                entity=rec,
                resource_code=rec.user.display_name,
                description=f"Hệ thống kích hoạt ngừng Membership theo lịch của {rec.user.display_name}: {rec.reason}",
                before={"membership_status": MembershipStatus.END_SCHEDULED},
                after={"membership_status": MembershipStatus.ENDED, "effective_at": rec.effective_at.isoformat()},
                reason=rec.reason,
            )
            completed_count += 1

    return {"completed_count": completed_count}


def request_membership_exit(*, company, user, reason="", desired_effective_date=None, note=""):
    """
    User chủ động gửi yêu cầu rời khỏi doanh nghiệp (Main Flow 2.2).
    """
    from .models import CompanyMembership, ExitRequestStatus, MembershipExitRequest, MembershipStatus

    reason = (reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "Lý do xin rời doanh nghiệp là bắt buộc (BR-MEM-END-06)."})

    membership = CompanyMembership.objects.filter(company=company, user=user).first()
    if not membership:
        raise ValidationError({"user": "Bạn không có Membership trong doanh nghiệp này (EF-02)."})

    if membership.membership_status in (MembershipStatus.TERMINATED, "ENDED", MembershipStatus.ENDED):
        raise ValidationError({"membership": "Membership đã kết thúc trước đó (EF-03)."})

    # Check Admin/Owner rules for exit request (EF-21, BR-MEM-END-31, 32, 33, 34)
    target_is_admin = _is_company_admin(membership)
    active_admins_count = _count_active_admins(company)
    if target_is_admin and active_admins_count <= 1:
        raise ValidationError({"user": "Bạn là Admin duy nhất của doanh nghiệp. Vui lòng bàn giao quyền quản trị trước khi gửi yêu cầu rời doanh nghiệp (EF-21, BR-MEM-END-31)."})

    is_owner = (company.created_by_user_id == user.id) or (membership.join_source == "BOOTSTRAP")
    active_members_count = CompanyMembership.objects.filter(
        company=company,
        membership_status__in=[MembershipStatus.ACTIVE, MembershipStatus.LOCKED, MembershipStatus.SCHEDULED_LOCK, MembershipStatus.END_SCHEDULED]
    ).count()
    if is_owner and active_members_count <= 1:
        raise ValidationError({"user": "Owner hoặc thành viên duy nhất không thể rời doanh nghiệp khi doanh nghiệp vẫn đang hoạt động (EF-21, BR-MEM-END-32, 33)."})

    now = timezone.now()
    desired_date = desired_effective_date or now
    if desired_date < now:
        desired_date = now

    req = MembershipExitRequest.objects.create(
        company=company,
        membership=membership,
        user=user,
        reason=reason,
        desired_effective_date=desired_date,
        note=note,
        status=ExitRequestStatus.PENDING,
    )

    # Notify admins
    try:
        from common_services.models import Notification
        admins = CompanyMembership.objects.filter(
            company=company,
            membership_status=MembershipStatus.ACTIVE,
            role_assignments__role__is_system_admin=True,
        ).distinct()
        for adm in admins:
            Notification.objects.create(
                user=adm.user,
                title="Yêu cầu rời doanh nghiệp mới",
                message=f"User {user.display_name} đã gửi yêu cầu rời doanh nghiệp vào {desired_date.strftime('%d/%m/%Y')}. Lý do: {reason}",
                level=Notification.Level.INFO,
            )
    except Exception:
        pass

    return req


def approve_membership_exit(
    *, company, actor, request_id,
    termination_type=None, effective_at=None,
    substitute_user_id=None, task_handling="KEEP",
    draft_handling="KEEP", job_handling="SYSTEM_CONTINUE",
    note="", request=None,
):
    """
    Admin chấp thuận yêu cầu rời doanh nghiệp và kích hoạt quy trình ngừng Membership (Main Flow 2.2 Bước 9-11).
    """
    from .models import ExitRequestStatus, MembershipExitRequest, TerminationType

    with transaction.atomic():
        exit_req = MembershipExitRequest.objects.select_for_update().select_related("user", "membership").filter(
            pk=request_id, company=company
        ).first()
        if not exit_req:
            raise ValidationError({"request": "Không tìm thấy yêu cầu rời doanh nghiệp."})

        if exit_req.status != ExitRequestStatus.PENDING:
            raise ValidationError({"request": f"Yêu cầu rời doanh nghiệp đã ở trạng thái {exit_req.status}."})

        term_type = termination_type or TerminationType.VOLUNTARY
        eff_at = effective_at or exit_req.desired_effective_date

        term_rec = terminate_membership(
            company=company,
            actor=actor,
            target_membership_id=exit_req.membership_id,
            termination_type=term_type,
            reason=f"Chấp thuận yêu cầu rời doanh nghiệp: {exit_req.reason}",
            effective_at=eff_at,
            substitute_user_id=substitute_user_id,
            task_handling=task_handling,
            draft_handling=draft_handling,
            job_handling=job_handling,
            note=note or exit_req.note,
            request=request,
        )

        now = timezone.now()
        exit_req.status = ExitRequestStatus.APPROVED
        exit_req.processed_by = actor
        exit_req.processed_at = now
        exit_req.termination_record = term_rec
        exit_req.save(update_fields=("status", "processed_by", "processed_at", "termination_record", "updated_at"))

        return exit_req


def reject_membership_exit(*, company, actor, request_id, rejection_reason="", request=None):
    """
    Admin từ chối yêu cầu rời doanh nghiệp.
    """
    from .models import ExitRequestStatus, MembershipExitRequest
    from audit_log.models import ActorType, EventCategory

    rejection_reason = (rejection_reason or "").strip()
    if not rejection_reason:
        raise ValidationError({"rejection_reason": "Lý do từ chối yêu cầu rời doanh nghiệp là bắt buộc."})

    with transaction.atomic():
        exit_req = MembershipExitRequest.objects.select_for_update().select_related("user").filter(
            pk=request_id, company=company
        ).first()
        if not exit_req:
            raise ValidationError({"request": "Không tìm thấy yêu cầu rời doanh nghiệp."})

        if exit_req.status != ExitRequestStatus.PENDING:
            raise ValidationError({"request": f"Yêu cầu rời doanh nghiệp đã ở trạng thái {exit_req.status}."})

        now = timezone.now()
        exit_req.status = ExitRequestStatus.REJECTED
        exit_req.processed_by = actor
        exit_req.processed_at = now
        exit_req.rejection_reason = rejection_reason
        exit_req.save(update_fields=("status", "processed_by", "processed_at", "rejection_reason", "updated_at"))

        # Notify user
        try:
            from common_services.models import Notification
            Notification.objects.create(
                user=exit_req.user,
                title="Yêu cầu rời doanh nghiệp bị từ chối",
                message=f"Yêu cầu rời doanh nghiệp {company.name} của bạn đã bị từ chối. Lý do: {rejection_reason}",
                level=Notification.Level.WARNING,
            )
        except Exception:
            pass

        record_audit(
            company=company,
            actor_user=actor,
            actor_type=ActorType.USER if actor else ActorType.SYSTEM,
            module_code="IAM",
            event_category=EventCategory.USER_MANAGEMENT,
            action_code="MEMBERSHIP_EXIT_REJECTED",
            entity=exit_req,
            resource_code=exit_req.user.display_name,
            description=f"Từ chối yêu cầu rời doanh nghiệp của {exit_req.user.display_name}: {rejection_reason}",
            reason=rejection_reason,
            request=request,
        )

        return exit_req


def cancel_membership_exit(*, company, user, request_id):
    """
    User tự hủy yêu cầu rời doanh nghiệp đang chờ xử lý của mình.
    """
    from .models import ExitRequestStatus, MembershipExitRequest

    with transaction.atomic():
        exit_req = MembershipExitRequest.objects.select_for_update().filter(
            pk=request_id, company=company, user=user
        ).first()
        if not exit_req:
            raise ValidationError({"request": "Không tìm thấy yêu cầu rời doanh nghiệp của bạn."})

        if exit_req.status != ExitRequestStatus.PENDING:
            raise ValidationError({"request": "Chỉ có thể hủy yêu cầu đang ở trạng thái PENDING."})

        exit_req.status = ExitRequestStatus.CANCELLED
        exit_req.save(update_fields=("status", "updated_at"))
        return exit_req


def get_membership_history(company, membership_id=None, user_id=None):
    """
    Xem toàn bộ lịch sử Membership: các lần tham gia, khóa, ngừng và yêu cầu rời (AF-17).
    """
    from .models import CompanyMembership, MembershipExitRequest, MembershipTerminationRecord, UserLockRecord

    if membership_id:
        membership = CompanyMembership.objects.filter(pk=membership_id, company=company).first()
    elif user_id:
        membership = CompanyMembership.objects.filter(user_id=user_id, company=company).first()
    else:
        return []

    if not membership:
        return []

    history = []
    # 1. Joined
    history.append({
        "type": "JOINED",
        "timestamp": membership.joined_at.isoformat() if membership.joined_at else membership.created_at.isoformat(),
        "description": f"Gia nhập doanh nghiệp qua hình thức {membership.join_source}",
    })

    # 2. Locks
    for lk in UserLockRecord.objects.filter(membership=membership).order_by("start_time"):
        history.append({
            "type": "LOCKED",
            "timestamp": lk.start_time.isoformat(),
            "description": f"Khóa ({lk.lock_type} - {lk.lock_scope}): {lk.lock_reason}",
            "actor": lk.locked_by.display_name if lk.locked_by else "SYSTEM",
            "status": lk.status,
        })
        if lk.unlocked_at:
            history.append({
                "type": "UNLOCKED",
                "timestamp": lk.unlocked_at.isoformat(),
                "description": f"Mở khóa: {lk.unlock_reason}",
                "actor": lk.unlocked_by.display_name if lk.unlocked_by else "SYSTEM",
            })

    # 3. Exit Requests
    for req in MembershipExitRequest.objects.filter(membership=membership).order_by("created_at"):
        history.append({
            "type": "EXIT_REQUEST",
            "timestamp": req.created_at.isoformat(),
            "description": f"Yêu cầu rời doanh nghiệp: {req.reason} (Trạng thái: {req.status})",
        })

    # 4. Terminations
    for term in MembershipTerminationRecord.objects.filter(membership=membership).order_by("created_at"):
        history.append({
            "type": "TERMINATION",
            "timestamp": term.effective_at.isoformat(),
            "description": f"Ngừng quyền tham gia ({term.termination_type}): {term.reason} (Trạng thái: {term.status})",
            "actor": term.created_by.display_name if term.created_by else "SYSTEM",
            "substitute_user": term.substitute_user.display_name if term.substitute_user else None,
        })

    # Sort history by timestamp
    history.sort(key=lambda x: x.get("timestamp") or "")
    return history
