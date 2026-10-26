import secrets
import time
import hashlib
import unicodedata
import uuid
import json
import re
from urllib import error as urllib_error
from urllib import request as urllib_request
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.mail import send_mail
from django.core.cache import cache
from django.core import signing
from django.db import IntegrityError, transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, Throttled, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from audit_log.models import LoginLog, SecurityEvent
from audit_log.services import record_audit
from iam.models import (
    ActiveStatus, CompanyMembership, DataScopeSet, OrganizationAssignment, Permission, Role, RolePermission, RoleStatus,
    UserRoleAssignment,
)
from iam.permissions import assignment_permission_codes, effective_assignments, has_effective_permission
from master_data.models import Currency
from organization.models import Branch, Company, CompanyStatus, OrganizationUnit

from .models import (
    AIFeedback, AIConversation, AIInteraction, CompanyInvitation, CompanyJoinRequest,
    CoreCompanySetting, Notification, UserLoginSession, UserPreference, UserSessionState,
    VerificationChallenge, WorkItem, WorkItemHistory,
)


def iam_user(request):
    if not hasattr(request.user, "iam_account"):
        raise PermissionDenied("Tài khoản chưa được liên kết với IAM.")
    return request.user.iam_account


def _client_ip(request):
    return request.META.get("REMOTE_ADDR", "")[:64]


def _security_event(event_type, request=None, user=None, *, severity="INFO", detail=None, company=None):
    target_user = None
    if user and getattr(user, "is_authenticated", False):
        target_user = getattr(user, "iam_account", user)
    elif user and hasattr(user, "_meta") and user._meta.model_name == "useraccount":
        target_user = user

    return SecurityEvent.objects.create(
        company=company,
        user=target_user,
        event_type=event_type,
        severity=severity,
        event_detail_json=detail or {},
        ip_address=_client_ip(request) if request else "",
        request_id=request.headers.get("X-Request-ID", "")[:100] if request else "",
    )


def _enforce_rate_limit(bucket, identities, *, limit, window_seconds, message=None):
    """Small cache-backed limiter; identifiers are hashed before becoming cache keys."""
    for identity in {str(value).strip().lower() for value in identities if value}:
        digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        key = f"common-rate:{bucket}:{digest}"
        if cache.add(key, 1, timeout=window_seconds):
            count = 1
        else:
            try:
                count = cache.incr(key)
            except ValueError:
                cache.set(key, 1, timeout=window_seconds)
                count = 1
        if count > limit:
            raise Throttled(wait=window_seconds, detail=message or "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.")


def _challenge(user, identifier, purpose, request=None, *, send_code=True, enforce_cooldown=False):
    now = timezone.now()
    identifier = identifier.strip().lower()

    # BR-COM-REG-OTP-03: Mỗi Email được nhận tối đa 5 OTP trong 1 giờ và 10 OTP trong 24 giờ.
    if "@" in identifier and purpose == VerificationChallenge.Purpose.REGISTER:
        _enforce_rate_limit("otp-email-1h", (identifier,), limit=5, window_seconds=3600)
        _enforce_rate_limit("otp-email-24h", (identifier,), limit=10, window_seconds=86400)

    latest = VerificationChallenge.objects.filter(identifier__iexact=identifier, purpose=purpose).first()
    cooldown = getattr(settings, "COMMON_OTP_RESEND_SECONDS", 60)
    if enforce_cooldown and latest and latest.created_at > now - timedelta(seconds=cooldown):
        remaining = max(1, cooldown - int((now - latest.created_at).total_seconds()))
        raise ValidationError({"detail": f"Vui lòng thử lại sau {remaining} giây.", "retry_after": remaining})
    VerificationChallenge.objects.filter(identifier__iexact=identifier, purpose=purpose, consumed_at__isnull=True).update(consumed_at=now)
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = VerificationChallenge.objects.create(
        user=user, identifier=identifier.lower(), purpose=purpose, code_hash=make_password(code),
        expires_at=now + timedelta(minutes=getattr(settings, "COMMON_VERIFICATION_MINUTES", 5)),
        requested_ip=_client_ip(request) if request else "",
    )
    challenge.raw_code = code
    challenge.email_sent = True
    if getattr(settings, "DEBUG", False):
        print(f"[OTP DEV] Mã OTP cho '{identifier}' (Purpose: {purpose}, Challenge: {challenge.id}): {code}")
    if send_code and "@" in identifier:
        try:
            send_mail(
                subject="Mã xác thực tài khoản",
                message=f"Mã xác thực của bạn là {code}. Mã hết hạn sau {getattr(settings, 'COMMON_VERIFICATION_MINUTES', 5)} phút.",
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.local"),
                recipient_list=[identifier], fail_silently=False,
            )
        except Exception:
            challenge.email_sent = False
            _security_event("OTP_EMAIL_FAILED", request, user, severity="WARNING", detail={"purpose": purpose})
    return challenge


def verify_challenge(challenge_id, code, purpose=None, request=None):
    error_to_raise = None
    with transaction.atomic():
        try:
            challenge = VerificationChallenge.objects.select_for_update().get(pk=challenge_id)
        except VerificationChallenge.DoesNotExist as exc:
            raise ValidationError({"challenge": "Yêu cầu xác thực không hợp lệ."}) from exc
        now = timezone.now()
        if purpose and challenge.purpose != purpose:
            raise ValidationError({"challenge": "Mục đích xác thực không hợp lệ."})

        # EF-07 / BR-COM-REG-ACC-04: OTP đã được sử dụng
        if challenge.consumed_at:
            _security_event("VERIFY_FAILED", request, challenge.user, severity="WARNING", detail={"reason": "ALREADY_CONSUMED", "purpose": challenge.purpose})
            error_to_raise = ValidationError({"code": "Mã xác thực đã được sử dụng hoặc không còn hiệu lực."})
        # EF-05: OTP đã hết hạn
        elif challenge.expires_at <= now:
            _security_event("VERIFY_FAILED", request, challenge.user, severity="WARNING", detail={"reason": "EXPIRED", "purpose": challenge.purpose})
            error_to_raise = ValidationError({"code": "Mã xác thực đã hết hạn."})
        # EF-06: Đã nhập sai quá 5 lần trước đó
        elif challenge.attempts >= 5:
            _security_event("VERIFY_FAILED", request, challenge.user, severity="WARNING", detail={"reason": "MAX_ATTEMPTS_EXCEEDED", "purpose": challenge.purpose})
            error_to_raise = ValidationError({"code": "Mã xác thực đã bị vô hiệu hóa do nhập sai quá 5 lần. Vui lòng yêu cầu mã mới."})
        else:
            challenge.attempts += 1
            if not check_password(code, challenge.code_hash):
                if challenge.attempts >= 5:
                    challenge.consumed_at = now
                    challenge.save(update_fields=("attempts", "consumed_at"))
                    _security_event("VERIFY_FAILED", request, challenge.user, severity="WARNING", detail={"reason": "MAX_ATTEMPTS_EXCEEDED", "attempts": challenge.attempts, "purpose": challenge.purpose})
                    error_to_raise = ValidationError({"code": "Mã xác thực không chính xác. Bạn đã nhập sai 5 lần liên tiếp, mã đã bị vô hiệu hóa."})
                else:
                    challenge.save(update_fields=("attempts",))
                    _security_event("VERIFY_FAILED", request, challenge.user, severity="WARNING", detail={"reason": "INVALID_OTP", "attempts": challenge.attempts, "purpose": challenge.purpose})
                    error_to_raise = ValidationError({"code": "Mã xác thực không chính xác."})
            else:
                challenge.consumed_at = now
                challenge.save(update_fields=("attempts", "consumed_at"))

    if error_to_raise:
        raise error_to_raise
    return challenge


@transaction.atomic
def register(data, request):
    # BR-COM-REG-SEC-01: Mỗi Số điện thoại hoặc Email được gửi Form đăng ký tối đa 5 lần trong 15 phút.
    _enforce_rate_limit("register-email", (data["email"],), limit=5, window_seconds=900)
    _enforce_rate_limit("register-phone", (data["phone"],), limit=5, window_seconds=900)
    _enforce_rate_limit("register-ip", (_client_ip(request),), limit=100, window_seconds=900)

    # BR-COM-REG-SEC-02: Backend bảo đảm hai yêu cầu gửi đồng thời không tạo hai tài khoản trùng Số điện thoại hoặc Email
    email_lock_key = f"reg-lock:email:{hashlib.sha256(data['email'].encode()).hexdigest()}"
    phone_lock_key = f"reg-lock:phone:{hashlib.sha256(data['phone'].encode()).hexdigest()}"
    if not cache.add(email_lock_key, 1, timeout=15) or not cache.add(phone_lock_key, 1, timeout=15):
        raise ValidationError("Yêu cầu đăng ký đang được xử lý. Vui lòng đợi trong giây lát.")

    try:
        User = get_user_model()
        require_verification = getattr(settings, "COMMON_REQUIRE_VERIFICATION", True)

        # AF-03 / BR-COM-REG-ID-06: Tiếp tục xác thực nếu đã tồn tại tài khoản PENDING_VERIFICATION có cùng Email và SĐT
        existing_pending_user = data.get("existing_pending_user")
        if existing_pending_user:
            user = existing_pending_user
            challenge = _challenge(user, user.email, VerificationChallenge.Purpose.REGISTER, request, enforce_cooldown=False)
            _security_event("REGISTER_RESUME", request, user, detail={"status": "PENDING_VERIFICATION", "result": "SUCCESS"})
            return user, challenge, True

        user = User.objects.create_user(
            username=data["username"], email=data["email"].lower(), password=data["password"],
            is_active=not require_verification,
        )
        account = user.iam_account
        account.display_name = data["display_name"]
        account.phone = data.get("phone", "")
        account.save(update_fields=("display_name", "phone", "updated_at"))
        preference = UserPreference.objects.create(
            user=account,
            normalized_email=user.email,
            terms_accepted_at=timezone.now(),
            terms_version=data["terms_version"],
            privacy_version=data["privacy_version"],
        )
        UserSessionState.objects.create(user=user)
        challenge = _challenge(user, user.email, VerificationChallenge.Purpose.REGISTER, request) if require_verification else None
        if not require_verification:
            preference.email_verified_at = timezone.now()
            preference.save(update_fields=("email_verified_at", "updated_at"))
        _security_event("REGISTER", request, user, detail={"verification_required": require_verification, "result": "SUCCESS"})
        return user, challenge, False
    finally:
        cache.delete(email_lock_key)
        cache.delete(phone_lock_key)


def activate_registration(challenge_id, code, request=None):
    existing = VerificationChallenge.objects.filter(pk=challenge_id, purpose=VerificationChallenge.Purpose.REGISTER).select_related("user").first()
    if existing and existing.consumed_at and existing.user and existing.user.is_active:
        return existing.user
    challenge = verify_challenge(challenge_id, code, VerificationChallenge.Purpose.REGISTER, request=request)
    with transaction.atomic():
        user = challenge.user
        if not user:
            raise ValidationError("Tài khoản xác thực không tồn tại.")
        user.is_active = True
        user.save(update_fields=("is_active",))
        preference, _ = UserPreference.objects.get_or_create(user=user.iam_account)
        preference.email_verified_at = timezone.now()
        preference.save(update_fields=("email_verified_at", "updated_at"))
        # BR-COM-REG-SEC-03: Ghi Audit Log khi xác thực thành công
        _security_event("VERIFY_SUCCESS", request, user, detail={"result": "SUCCESS", "status": "ACTIVE", "identifier": challenge.identifier})
        return user


def resend_verification(challenge_id, request):
    original = VerificationChallenge.objects.filter(pk=challenge_id).select_related("user").first()
    if not original:
        raise ValidationError({"challenge": "Yêu cầu xác thực không hợp lệ."})
    _enforce_rate_limit("otp", (original.identifier, _client_ip(request)), limit=10, window_seconds=3600)
    if original.user and original.user.is_active and original.purpose == VerificationChallenge.Purpose.REGISTER:
        raise ValidationError({"challenge": "Tài khoản đã được xác thực."})
    try:
        challenge = _challenge(original.user, original.identifier, original.purpose, request, enforce_cooldown=True)
    except ValidationError:
        _security_event("RESEND_OTP_FAILED", request, original.user, severity="WARNING", detail={"reason": "COOLDOWN_ACTIVE", "identifier": original.identifier})
        raise
    # BR-COM-REG-SEC-03: Ghi Audit Log khi gửi lại OTP
    _security_event("RESEND_OTP", request, original.user, detail={"result": "SUCCESS", "identifier": original.identifier})
    return challenge


@transaction.atomic
def change_registration_email(challenge_id, email, request):
    from .serializers import validate_and_normalize_email
    email = validate_and_normalize_email(email)
    original = VerificationChallenge.objects.select_for_update().filter(
        pk=challenge_id, purpose=VerificationChallenge.Purpose.REGISTER
    ).first()
    if not original or not original.user or original.user.is_active:
        raise ValidationError({"challenge": "Yêu cầu đăng ký không hợp lệ."})
    if get_user_model().objects.exclude(pk=original.user_id).filter(email__iexact=email).exists() or UserPreference.objects.exclude(
        user=original.user.iam_account
    ).filter(normalized_email=email).exists():
        raise ValidationError({"email": "Email đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng chức năng Quên mật khẩu."})
    original.user.email = email
    original.user.username = email if original.user.username == original.identifier else original.user.username
    original.user.save(update_fields=("email", "username"))
    preference, _ = UserPreference.objects.get_or_create(user=original.user.iam_account)
    preference.normalized_email = email
    preference.save(update_fields=("normalized_email", "updated_at"))
    VerificationChallenge.objects.filter(
        user=original.user, purpose=VerificationChallenge.Purpose.REGISTER, consumed_at__isnull=True
    ).update(consumed_at=timezone.now())
    challenge = _challenge(original.user, email, VerificationChallenge.Purpose.REGISTER, request)
    # BR-COM-REG-SEC-03: Ghi Audit Log khi thay đổi Email
    _security_event("REGISTRATION_EMAIL_CHANGED", request, original.user, detail={"result": "SUCCESS", "new_email": email})
    return challenge


def login(data, request):
    User = get_user_model()
    login_value = data.get("login") or data.get("email") or data.get("username") or ""

    # BR-COM-LOGIN-21 / EF-08: Giới hạn số yêu cầu đăng nhập liên tiếp
    _enforce_rate_limit(
        "login",
        (login_value, _client_ip(request)),
        limit=30,
        window_seconds=300,
        message="Bạn đã gửi quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau.",
    )

    # BR-COM-LOGIN-PHONE-01: Chuẩn hóa số điện thoại về định dạng +84 trước khi đối chiếu
    phone_candidates = [login_value]
    if login_value.startswith("0") and len(login_value) == 10 and login_value.isdigit():
        phone_candidates.append("+84" + login_value[1:])
    elif login_value.startswith("+84") and len(login_value) == 12:
        phone_candidates.append("0" + login_value[3:])

    # BR-COM-LOGIN-02: Chuẩn hóa email, so sánh không phân biệt hoa thường
    candidate = User.objects.filter(
        Q(email__iexact=login_value) |
        Q(iam_account__phone__in=phone_candidates) |
        Q(username__iexact=login_value)
    ).first()

    now = timezone.now()

    # BR-COM-LOGIN-07 / EF-03: Email không tồn tại -> hiển thị cùng thông báo lỗi chung
    if not candidate:
        LoginLog.objects.create(
            user=None, username_or_email=login_value, login_result="FAILED",
            failure_reason="INVALID_CREDENTIALS", ip_address=_client_ip(request)
        )
        _security_event("LOGIN_FAILED", request, None, detail={"reason": "USER_NOT_FOUND", "identifier": login_value})
        raise AuthenticationFailed("Email hoặc mật khẩu không chính xác.")

    account = candidate.iam_account

    # BR-COM-LOGIN-10: Sau khi hết 15 phút, bộ đếm đăng nhập sai được tính lại từ đầu
    if account.locked_until and account.locked_until <= now:
        account.failed_login_count = 0
        account.locked_until = None
        account.save(update_fields=("failed_login_count", "locked_until", "updated_at"))

    # EF-05 / BR-COM-LOGIN-06: Tài khoản ở trạng thái LOCKED
    if account.locked_until and account.locked_until > now:
        LoginLog.objects.create(
            user=account, username_or_email=login_value, login_result="FAILED",
            failure_reason="LOCKED", ip_address=_client_ip(request)
        )
        _security_event("LOGIN_LOCKED", request, candidate, detail={"reason": "ACCOUNT_LOCKED"})
        raise AuthenticationFailed("Tài khoản đang bị khóa. Vui lòng thử lại sau.")

    # EF-04 / BR-COM-LOGIN-05: Tài khoản PENDING_VERIFICATION (chưa hoàn thành xác thực email)
    has_verified = UserPreference.objects.filter(
        user=account, email_verified_at__isnull=False
    ).exists()
    if not has_verified and (not candidate.is_active or candidate.verification_challenges.filter(purpose=VerificationChallenge.Purpose.REGISTER).exists()):
        latest_challenge = candidate.verification_challenges.filter(
            purpose=VerificationChallenge.Purpose.REGISTER,
            consumed_at__isnull=True,
        ).order_by("-created_at").first()
        challenge_id = str(latest_challenge.id) if latest_challenge else None
        LoginLog.objects.create(
            user=account, username_or_email=login_value, login_result="FAILED",
            failure_reason="PENDING_VERIFICATION", ip_address=_client_ip(request)
        )
        _security_event("LOGIN_UNVERIFIED", request, candidate, detail={"reason": "PENDING_VERIFICATION"})
        raise AuthenticationFailed({
            "detail": "Tài khoản chưa được xác thực. Vui lòng xác thực Email để tiếp tục.",
            "code": "pending_verification",
            "challenge": challenge_id,
        })

    # EF-06 / BR-COM-LOGIN-06: Tài khoản INACTIVE (đã xác thực nhưng bị vô hiệu hóa)
    if not candidate.is_active:
        LoginLog.objects.create(
            user=account, username_or_email=login_value, login_result="FAILED",
            failure_reason="INACTIVE", ip_address=_client_ip(request)
        )
        _security_event("LOGIN_INACTIVE", request, candidate, detail={"reason": "ACCOUNT_INACTIVE"})
        raise AuthenticationFailed("Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ bộ phận hỗ trợ để được xử lý.")

    # BR-COM-LOGIN-03: So sánh mật khẩu bằng mã hóa một chiều
    user = authenticate(request=request, username=candidate.username, password=data["password"])
    if not user:
        account.failed_login_count += 1
        lock_triggered = False
        if account.failed_login_count >= getattr(settings, "COMMON_MAX_LOGIN_ATTEMPTS", 5):
            account.locked_until = now + timedelta(minutes=getattr(settings, "COMMON_LOCK_MINUTES", 15))
            lock_triggered = True
            # BR-COM-LOGIN-22: Thu hồi phiên đăng nhập đang tồn tại
            UserLoginSession.objects.filter(user=candidate, revoked_at__isnull=True).update(
                revoked_at=now, revoke_reason="ACCOUNT_LOCKED"
            )
            _security_event("LOGIN_LOCK_TRIGGERED", request, candidate, detail={"failed_attempts": account.failed_login_count})
        account.save(update_fields=("failed_login_count", "locked_until", "updated_at"))

        LoginLog.objects.create(
            user=account, username_or_email=login_value, login_result="FAILED",
            failure_reason="INVALID_CREDENTIALS", ip_address=_client_ip(request)
        )
        _security_event("LOGIN_FAILED", request, candidate, detail={"reason": "INVALID_PASSWORD", "failed_count": account.failed_login_count})

        # EF-07 / BR-COM-LOGIN-09: Khi sai 5 lần liên tiếp -> thông báo tạm khóa 15 phút
        if lock_triggered:
            raise AuthenticationFailed("Tài khoản đã bị tạm khóa trong 15 phút do nhập sai mật khẩu 5 lần liên tiếp. Vui lòng thử lại sau.")
        raise AuthenticationFailed("Email hoặc mật khẩu không chính xác.")

    # BR-COM-LOGIN-11: Đăng nhập thành công, reset số lần đăng nhập sai về 0
    account.failed_login_count = 0
    account.locked_until = None
    account.save(update_fields=("failed_login_count", "locked_until", "updated_at"))

    # Cập nhật thời điểm đăng nhập gần nhất (last_login)
    candidate.last_login = now
    candidate.save(update_fields=("last_login",))

    # BR-COM-LOGIN-12: Tạo phiên đăng nhập, mã xác thực phiên và thời điểm hết hiệu lực
    try:
        refresh, session = issue_session(user, request)
    except Exception:
        raise AuthenticationFailed("Không thể tạo phiên đăng nhập. Vui lòng thử lại.")

    # Bước 10, 11, 12: Kiểm tra các doanh nghiệp mà User đang có tư cách thành viên hoạt động
    memberships = CompanyMembership.objects.filter(
        user=account, membership_status=ActiveStatus.ACTIVE
    ).select_related("company")

    companies = [
        {
            "id": str(item.company_id), "code": item.company.code,
            "name": item.company.name, "status": item.company.status,
        }
        for item in memberships
    ]
    if user.is_superuser and not companies:
        all_comps = Company.objects.filter(status=CompanyStatus.ACTIVE).order_by("created_at")
        companies = [
            {
                "id": str(c.id), "code": c.code, "name": c.name, "status": c.status,
            }
            for c in all_comps
        ]

    active_companies = [item for item in companies if item["status"] == "ACTIVE"]
    pending_setup_companies = [item for item in companies if item["status"] == CompanyStatus.PENDING_SETUP]

    selected_company = active_companies[0] if len(active_companies) == 1 and not pending_setup_companies else None
    if selected_company:
        preference, _ = UserPreference.objects.get_or_create(user=account)
        preference.current_company_id = selected_company["id"]
        preference.save(update_fields=("current_company", "updated_at"))
        target_screen = "DASHBOARD"
    elif pending_setup_companies:
        target_screen = "COMPANY_SETUP"
    elif len(active_companies) > 1:
        target_screen = "COMPANY_SELECTION"
    else:
        target_screen = "COMPANY_SETUP_OR_JOIN"

    if user.is_superuser:
        target_screen = "SUPER_ADMIN"

    # BR-COM-LOGIN-19: Ghi nhận sự kiện đăng nhập thành công
    LoginLog.objects.create(user=account, username_or_email=login_value, login_result="SUCCESS", ip_address=_client_ip(request))
    _security_event("LOGIN_SUCCESS", request, user, detail={"session_id": str(session.id)})

    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "session": str(session.id),
        "user": {
            "id": str(account.id),
            "display_name": account.display_name,
            "username": user.username,
            "email": user.email,
            "is_superuser": bool(user.is_superuser),
            "is_staff": bool(user.is_staff),
        },
        "companies": companies,
        "current_company": selected_company,
        "target_screen": target_screen,
        "requires_company_selection": len(active_companies) > 1 and not pending_setup_companies and not user.is_superuser,
        "requires_company_setup": (not active_companies or bool(pending_setup_companies)) and not user.is_superuser,
        "setup_company": pending_setup_companies[0] if pending_setup_companies else None,
    }


def issue_session(user, request):
    refresh = RefreshToken.for_user(user)
    session = UserLoginSession.objects.create(
        user=user,
        refresh_jti=str(refresh["jti"]),
        ip_address=_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        expires_at=timezone.now() + timedelta(seconds=max(0, int(refresh["exp"]) - int(time.time()))),
    )
    refresh["sid"] = str(session.id)
    return refresh, session


def logout(refresh_value, request):
    user = request.user if getattr(request.user, "is_authenticated", False) else None
    sid = str(request.auth.get("sid", "")) if request.auth else ""

    token = None
    if refresh_value:
        try:
            token = RefreshToken(refresh_value)
            if not sid:
                sid = str(token.get("sid", ""))
        except Exception:
            token = None

    if sid:
        filter_kwargs = {"pk": sid, "revoked_at__isnull": True}
        if user:
            filter_kwargs["user"] = user
        UserLoginSession.objects.filter(**filter_kwargs).update(
            revoked_at=timezone.now(), revoke_reason="LOGOUT"
        )
        if not user:
            session = UserLoginSession.objects.filter(pk=sid).select_related("user").first()
            if session:
                user = session.user

    if token:
        try:
            token_sid = str(token.get("sid", ""))
            if not sid or not token_sid or token_sid == sid:
                token.blacklist()
        except Exception:
            pass

    if user or sid:
        _security_event("LOGOUT", request, user, detail={"session_id": sid} if sid else None)


def _blacklist_all(user):
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def request_password_reset(identifier, request):
    User = get_user_model()
    identifier = identifier.strip().lower()
    _enforce_rate_limit("password-reset", (identifier, _client_ip(request)), limit=10, window_seconds=3600)
    
    # BR-COM-RESET-01, BR-COM-RESET-02: chuẩn hóa email, tìm tài khoản không phân biệt hoa thường
    user = User.objects.filter(email__iexact=identifier).first()
    if not user:
        user = User.objects.filter(username__iexact=identifier).first()

    if user:
        account = getattr(user, "iam_account", None)
        # EF-04: Tài khoản ở trạng thái INACTIVE
        if not user.is_active or (account and account.status == ActiveStatus.INACTIVE):
            raise ValidationError({
                "email": "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ bộ phận hỗ trợ để được xử lý.",
                "code": "account_inactive",
            })

        # EF-03: Tài khoản chưa xác thực email
        pref = UserPreference.objects.filter(user=account, email_verified_at__isnull=False).first() if account else None
        if not pref:
            raise ValidationError({
                "email": "Tài khoản chưa được xác thực email. Vui lòng hoàn tất xác thực email trước khi đặt lại mật khẩu.",
                "code": "pending_verification",
            })

        challenge = _challenge(
            user, user.email, VerificationChallenge.Purpose.PASSWORD_RESET, request, enforce_cooldown=True
        )
        if hasattr(challenge, "email_sent") and not challenge.email_sent:
            # EF-05: Dịch vụ Email không phản hồi hoặc gửi thất bại
            raise ValidationError({
                "detail": "Chưa thể gửi mã xác thực qua email. Vui lòng thử lại sau.",
                "code": "email_send_failed",
            })
        _security_event("PASSWORD_RESET_REQUESTED", request, user)
        return challenge

    # EF-02 / BR-COM-RESET-03: Email không tồn tại trên hệ thống -> tạo challenge giả lập không gửi email
    return _challenge(
        None,
        identifier,
        VerificationChallenge.Purpose.PASSWORD_RESET,
        request,
        send_code=False,
    )


def verify_reset_otp(challenge_id, code, request=None):
    """Step 10-11: Xác thực OTP hợp lệ và cấp quyền (reset_token) thiết lập mật khẩu mới trong 5 phút."""
    challenge = verify_challenge(challenge_id, code, VerificationChallenge.Purpose.PASSWORD_RESET, request=request)
    user = challenge.user
    if not user:
        raise ValidationError({"code": "Mã xác thực không chính xác."})
    reset_token = signing.dumps(
        {"user_id": user.pk, "challenge_id": str(challenge.id), "purpose": "PASSWORD_RESET"},
        salt="common.password_reset",
    )
    return {
        "valid": True,
        "detail": "Mã xác thực hợp lệ.",
        "reset_token": reset_token,
    }


@transaction.atomic
def reset_password(challenge_id=None, code=None, new_password=None, *, reset_token=None, request=None):
    user = None
    if reset_token:
        try:
            data = signing.loads(reset_token, salt="common.password_reset", max_age=300)
            if data.get("purpose") != "PASSWORD_RESET":
                raise ValidationError({"detail": "Quyền đặt lại mật khẩu không hợp lệ. Vui lòng thực hiện lại từ đầu.", "code": "reset_token_invalid"})
            User = get_user_model()
            user = User.objects.filter(pk=data.get("user_id")).first()
        except signing.SignatureExpired:
            # EF-12: Quyền đặt lại mật khẩu đã hết hiệu lực
            raise ValidationError({"detail": "Quyền đặt lại mật khẩu đã hết hiệu lực. Vui lòng thực hiện lại từ đầu.", "code": "reset_token_expired"})
        except Exception:
            raise ValidationError({"detail": "Quyền đặt lại mật khẩu không hợp lệ. Vui lòng thực hiện lại từ đầu.", "code": "reset_token_invalid"})
    elif challenge_id and code:
        challenge = verify_challenge(challenge_id, code, VerificationChallenge.Purpose.PASSWORD_RESET, request=request)
        user = challenge.user
    else:
        raise ValidationError("Thông tin xác thực đặt lại mật khẩu không đầy đủ.")

    if not user:
        raise ValidationError({"code": "Mã xác thực không đúng."})

    validate_password(new_password, user=user)
    if user.check_password(new_password):
        # BR-COM-RESET-14: Mật khẩu mới không được trùng với mật khẩu hiện tại
        raise ValidationError({"new_password": "Mật khẩu mới không được trùng với mật khẩu hiện tại."})

    user.set_password(new_password)
    user.save(update_fields=("password",))

    account = user.iam_account
    account.password_changed_at = timezone.now()
    account.failed_login_count = 0
    account.locked_until = None
    account.save(update_fields=("password_changed_at", "failed_login_count", "locked_until", "updated_at"))

    state, _ = UserSessionState.objects.get_or_create(user=user)
    state.valid_after_epoch = int(time.time())
    state.save(update_fields=("valid_after_epoch", "updated_at"))
    _blacklist_all(user)
    UserLoginSession.objects.filter(user=user, revoked_at__isnull=True).update(
        revoked_at=timezone.now(), revoke_reason="PASSWORD_RESET"
    )

    try:
        send_mail(
            "Mật khẩu đã được đặt lại",
            "Mật khẩu tài khoản của bạn vừa được đặt lại. Nếu không phải bạn thực hiện, hãy liên hệ hỗ trợ.",
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.local"),
            [user.email], fail_silently=False,
        )
    except Exception:
        _security_event("PASSWORD_RESET_EMAIL_FAILED", user=user, severity="WARNING")

    _security_event("PASSWORD_RESET", user=user)
    return user


def change_password(user, data, request):
    session = None
    sid = str(request.auth.get("sid", "")) if request.auth else ""
    if sid:
        session = UserLoginSession.objects.filter(pk=sid, user=user, revoked_at__isnull=True).first()
    account = getattr(user, "iam_account", None)
    # EF-03 & BR-COM-CHANGE-01: Tài khoản phải ở trạng thái ACTIVE
    if not user.is_active or (account and account.status == ActiveStatus.INACTIVE):
        if session:
            session.revoked_at = timezone.now()
            session.revoke_reason = "ACCOUNT_INACTIVE"
            session.save(update_fields=("revoked_at", "revoke_reason", "last_seen_at"))
        raise AuthenticationFailed({"detail": "Tài khoản không hoạt động hoặc đã bị vô hiệu hóa.", "code": "account_inactive"})

    # EF-04, EF-05 & BR-COM-CHANGE-11: So sánh mật khẩu hiện tại & kiểm tra 5 lần sai liên tiếp
    if not user.check_password(data["current_password"]):
        if session:
            session.password_check_failures += 1
            if session.password_check_failures >= 5:
                session.revoked_at = timezone.now()
                session.revoke_reason = "PASSWORD_CHECK_FAILED"
            session.save(update_fields=("password_check_failures", "revoked_at", "revoke_reason", "last_seen_at"))
        _security_event("CHANGE_PASSWORD_FAILED", request, user, severity="WARNING")
        if session and session.password_check_failures >= 5:
            raise AuthenticationFailed(
                {
                    "detail": "Bạn đã nhập sai mật khẩu hiện tại 5 lần liên tiếp. Phiên đăng nhập đã bị kết thúc. Vui lòng đăng nhập lại hoặc sử dụng Quên mật khẩu.",
                    "code": "session_revoked",
                }
            )
        raise ValidationError({"current_password": "Mật khẩu hiện tại không chính xác."})

    # EF-07 & BR-COM-CHANGE-06: Mật khẩu mới không được trùng mật khẩu hiện tại
    if user.check_password(data["new_password"]):
        raise ValidationError({"new_password": "Mật khẩu mới không được trùng với mật khẩu hiện tại."})

    # EF-06 & BR-COM-CHANGE-05: Kiểm tra chính sách mật khẩu
    validate_password(data["new_password"], user=user)

    with transaction.atomic():
        user.set_password(data["new_password"])
        user.save(update_fields=("password",))
        if account:
            account.password_changed_at = timezone.now()
            account.save(update_fields=("password_changed_at", "updated_at"))
        other_sessions = UserLoginSession.objects.filter(user=user, revoked_at__isnull=True)
        if session:
            other_sessions = other_sessions.exclude(pk=session.pk)
            session.password_check_failures = 0
            session.save(update_fields=("password_check_failures", "last_seen_at"))
        other_sessions.update(revoked_at=timezone.now(), revoke_reason="PASSWORD_CHANGED")

    try:
        send_mail(
            "Mật khẩu đã được thay đổi",
            "Mật khẩu tài khoản của bạn vừa được thay đổi. Nếu không phải bạn thực hiện, hãy đặt lại mật khẩu ngay.",
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.local"),
            [user.email], fail_silently=False,
        )
    except Exception:
        _security_event("CHANGE_PASSWORD_EMAIL_FAILED", request, user, severity="WARNING")
    _security_event("PASSWORD_CHANGED", request, user)


def profile_data(account):
    user = account.auth_user
    preference, _ = UserPreference.objects.get_or_create(user=account)
    avatar_url = preference.avatar.url if preference.avatar else None
    return {"id": account.id, "username": user.username, "email": user.email, "display_name": account.display_name, "phone": account.phone, "first_name": user.first_name, "last_name": user.last_name, "avatar_url": avatar_url, "status": account.status, "created_at": account.created_at, "last_login": user.last_login, "updated_at": account.updated_at}


@transaction.atomic
def update_profile(account, data, request):
    account = account.__class__.objects.select_for_update().select_related("auth_user").get(pk=account.pk)
    expected_version = data.pop("version", None)
    if expected_version and account.updated_at != expected_version:
        raise ValidationError({"version": "Hồ sơ đã được cập nhật ở phiên khác. Vui lòng tải lại dữ liệu."})
    if data.get("phone") and account.__class__.objects.exclude(pk=account.pk).filter(phone=data["phone"]).exists():
        raise ValidationError({"phone": "Số điện thoại đã được sử dụng."})
    before = profile_data(account)
    preference, _ = UserPreference.objects.get_or_create(user=account)
    avatar = data.pop("avatar", None)
    remove_avatar = data.pop("remove_avatar", False)
    user = account.auth_user
    for field in ("first_name", "last_name"):
        if field in data:
            setattr(user, field, data[field])
    user_fields = tuple(field for field in ("first_name", "last_name") if field in data)
    if user_fields:
        user.save(update_fields=user_fields)
    for field in ("display_name", "phone"):
        if field in data:
            setattr(account, field, data[field])
    account_fields = tuple(field for field in ("display_name", "phone") if field in data)
    if account_fields:
        account.save(update_fields=account_fields + ("updated_at",))
    else:
        account.save(update_fields=("updated_at",))
    if avatar is not None:
        preference.avatar = avatar
        preference.save(update_fields=("avatar", "updated_at"))
    elif remove_avatar:
        if preference.avatar:
            try:
                preference.avatar.delete(save=False)
            except Exception:
                pass
            preference.avatar = ""
            preference.save(update_fields=("avatar", "updated_at"))
    memberships = account.memberships.filter(membership_status=ActiveStatus.ACTIVE).select_related("company")
    for membership in memberships:
        record_audit(company=membership.company, actor_user=account, module_code="COM", action_code="PROFILE_EDIT", entity=account, before=before, after=profile_data(account), request=request)
    _security_event("PROFILE_UPDATED", request, account, detail={"fields": sorted(data)})
    return account, None


@transaction.atomic
def confirm_email_change(challenge_id, code, expected_user):
    challenge = VerificationChallenge.objects.filter(pk=challenge_id, user=expected_user, purpose=VerificationChallenge.Purpose.CHANGE_EMAIL).first()
    if not challenge:
        raise ValidationError({"challenge": "Yêu cầu xác thực không thuộc tài khoản hiện tại."})
    challenge = verify_challenge(challenge_id, code, VerificationChallenge.Purpose.CHANGE_EMAIL)
    if not challenge.user:
        raise ValidationError("Tài khoản xác thực không tồn tại.")
    if get_user_model().objects.exclude(pk=challenge.user_id).filter(email__iexact=challenge.identifier).exists():
        raise ValidationError({"email": "Email đã được sử dụng."})
    challenge.user.email = challenge.identifier
    challenge.user.save(update_fields=("email",))
    preference, _ = UserPreference.objects.get_or_create(user=challenge.user.iam_account)
    preference.normalized_email = challenge.identifier
    preference.save(update_fields=("normalized_email", "updated_at"))
    return challenge.user


@transaction.atomic
def create_company(data, request):
    account = iam_user(request)
    if not account.auth_user.is_active:
        raise PermissionDenied("Tài khoản không ở trạng thái ACTIVE.")
    if not UserPreference.objects.filter(user=account, email_verified_at__isnull=False).exists():
        raise PermissionDenied("Email của tài khoản chưa được xác thực.")
    if not account.can_create_company:
        raise PermissionDenied("Tài khoản không có quyền tạo doanh nghiệp.")
    if Company.objects.filter(tax_code=data["tax_code"]).exists():
        raise ValidationError({"tax_code": "Doanh nghiệp đã tồn tại; hãy gửi yêu cầu tham gia."})
    code = data.get("code") or f"DN{data['tax_code'].replace('-', '')}"
    if Company.objects.filter(code__iexact=code).exists():
        raise ValidationError({"code": "Mã doanh nghiệp đã tồn tại."})
    currency = Currency.objects.filter(pk=data.get("accounting_currency")).first() if data.get("accounting_currency") else Currency.objects.filter(code="VND").first()
    if not currency:
        raise ValidationError({"accounting_currency": "Đơn vị tiền tệ không hợp lệ."})
    try:
        with transaction.atomic():
            company = Company.objects.create(
                code=code, name=data["name"], legal_name=data["legal_name"], tax_code=data["tax_code"],
                business_type=data["business_type"], address=data["address"], province=data["province"],
                legal_representative=data["legal_representative"], phone=data.get("phone", ""),
                email=data.get("email", ""), logo=data.get("logo") or "", created_by_user_id=account.id,
                accounting_currency=currency, legal_reporting_currency=currency,
                accounting_regime=data["accounting_regime"], fiscal_year_start_month=data["fiscal_year_start_month"],
                timezone=data["timezone"], status=CompanyStatus.PENDING_SETUP,
            )
    except IntegrityError as exc:
        if Company.objects.filter(tax_code=data["tax_code"]).exists():
            raise ValidationError({"tax_code": "Doanh nghiệp đã tồn tại; hãy gửi yêu cầu tham gia."}) from exc
        raise ValidationError({"code": "Mã doanh nghiệp đã tồn tại."}) from exc
    Branch.objects.create(company=company, code="HQ", name="Trụ sở chính", address=company.address, phone=company.phone, is_head_office=True)
    root, _ = OrganizationUnit.objects.get_or_create(
        company=company, unit_type="COMPANY",
        defaults={
            "code": company.code, "name": company.name, "short_name": company.short_name,
            "start_date": timezone.localdate(), "status": "ACTIVE",
            "created_by_user_id": account.id, "updated_by_user_id": account.id,
        },
    )
    if root.created_by_user_id != account.id:
        root.created_by_user_id = account.id
        root.updated_by_user_id = account.id
        root.save(update_fields=("created_by_user_id", "updated_by_user_id", "updated_at"))
    CoreCompanySetting.objects.create(
        company=company,
        configuration={
            "setup_completed": False,
            "required_steps": [
                "fiscal_year", "accounting_periods", "accounting_regime",
                "accounting_currency", "chart_of_accounts",
            ],
        },
    )
    membership = CompanyMembership.objects.create(company=company, user=account, created_by=account, join_source="BOOTSTRAP")
    role = Role.objects.create(
        company=company, code="COMPANY_ADMIN", name="Admin doanh nghiệp",
        role_type="STANDARD", status=RoleStatus.ACTIVE, is_system_admin=True,
        created_by=account,
    )
    admin_permissions = Permission.objects.filter(
        status=ActiveStatus.ACTIVE,
    ).exclude(
        code="SYS.COMPANY_PROFILE.EDIT_SUSPENDED",
    ).filter(
        Q(code__startswith="SYS.")
        | Q(code__startswith="COM.")
        | Q(action__code="VIEW")
    )
    RolePermission.objects.bulk_create([RolePermission(role=role, permission=item) for item in admin_permissions])
    UserRoleAssignment.objects.create(company_membership=membership, role=role, assigned_by=account)
    # The founder of a one-person company works at the company root by default.
    membership.organization_unit = root
    membership.save(update_fields=("organization_unit", "updated_at"))
    initial_assignment = OrganizationAssignment.objects.create(
        membership=membership, unit=root, assignment_type="PRIMARY",
        start_date=timezone.localdate(), status="ACTIVE", created_by=account,
    )
    record_audit(
        company=company, actor_user=account, module_code="SYS", action_code="ORG_ASSIGNMENT_CREATE",
        entity=initial_assignment, before={}, after={
            "membership": str(membership.pk), "unit": str(root.pk), "assignment_type": "PRIMARY",
            "start_date": initial_assignment.start_date.isoformat(), "status": "ACTIVE",
        }, request=request,
    )
    preference, _ = UserPreference.objects.get_or_create(user=account)
    preference.current_company = company
    preference.save(update_fields=("current_company", "updated_at"))
    record_audit(
        company=company, actor_user=account, module_code="SYS", action_code="CREATE_COMPANY",
        entity=company,
        after={
            "code": company.code, "tax_code": company.tax_code, "legal_name": company.legal_name,
            "name": company.name, "business_type": company.business_type, "address": company.address,
            "province": company.province, "legal_representative": company.legal_representative,
            "email": company.email, "phone": company.phone, "status": company.status,
            "created_by_user_id": company.created_by_user_id,
        },
        request=request,
    )
    return company


def require_membership(account, company):
    membership = CompanyMembership.objects.filter(user=account, company=company, membership_status=ActiveStatus.ACTIVE).first()
    if not membership:
        raise PermissionDenied("Bạn không có Membership ACTIVE tại doanh nghiệp này.")
    return membership


def available_scopes(account):
    result = []
    memberships = CompanyMembership.objects.filter(
        user=account, membership_status=ActiveStatus.ACTIVE, company__status="ACTIVE"
    ).select_related("company")
    for membership in memberships:
        assignments = list(effective_assignments(account, membership.company))
        all_branches = any(
            assignment.data_scope_set is None or assignment.data_scope_set.allow_all_company_data
            for assignment in assignments
        )
        if all_branches:
            branches = Branch.objects.filter(company=membership.company, status="ACTIVE")
        else:
            branch_ids = set()
            include_descendant_roots = set()
            for assignment in assignments:
                if not assignment.data_scope_set_id:
                    continue
                for item in assignment.data_scope_set.branch_scopes.all():
                    branch_ids.add(item.branch_id)
                    if item.include_descendants:
                        include_descendant_roots.add(item.branch_id)
            if include_descendant_roots:
                candidates = list(Branch.objects.filter(company=membership.company).values("id", "parent_id"))
                changed = True
                while changed:
                    changed = False
                    for candidate in candidates:
                        if candidate["parent_id"] in branch_ids and candidate["id"] not in branch_ids:
                            branch_ids.add(candidate["id"])
                            changed = True
            branches = Branch.objects.filter(company=membership.company, id__in=branch_ids, status="ACTIVE")
        result.append({
            "company": {"id": str(membership.company_id), "code": membership.company.code, "name": membership.company.name},
            "all_branches_allowed": all_branches,
            "branches": [{"id": str(branch.id), "code": branch.code, "name": branch.name} for branch in branches.order_by("code")],
        })
    return result


@transaction.atomic
def switch_scope(account, company, branch=None, all_branches=False, request=None):
    require_membership(account, company)
    if company.status != "ACTIVE":
        raise ValidationError("Doanh nghiệp không còn hoạt động.")
    options = next((item for item in available_scopes(account) if item["company"]["id"] == str(company.id)), None)
    if not options:
        raise PermissionDenied("Bạn không có phạm vi làm việc hợp lệ tại doanh nghiệp này.")
    allowed_ids = {item["id"] for item in options["branches"]}
    if all_branches and not options["all_branches_allowed"]:
        raise PermissionDenied("Bạn không có Data Scope toàn doanh nghiệp.")
    if branch:
        if branch.company_id != company.id or str(branch.id) not in allowed_ids:
            raise PermissionDenied("Bạn không có quyền truy cập chi nhánh đã chọn.")
        all_branches = False
    elif not all_branches:
        if len(allowed_ids) == 1:
            branch = Branch.objects.get(pk=next(iter(allowed_ids)))
        elif len(options["branches"]) > 1:
            raise ValidationError({"branch": "Vui lòng chọn chi nhánh hoặc phạm vi tất cả chi nhánh."})
        elif not options["branches"]:
            all_branches = True
    preference, _ = UserPreference.objects.select_for_update().get_or_create(user=account)
    before = {"company": str(preference.current_company_id or ""), "branch": str(preference.current_branch_id or ""), "all_branches": preference.all_branches}
    preference.current_company = company
    preference.current_branch = branch
    preference.all_branches = all_branches
    preference.save(update_fields=("current_company", "current_branch", "all_branches", "updated_at"))
    record_audit(
        company=company, actor_user=account, module_code="COM", action_code="SCOPE_SWITCH",
        entity=preference, before=before,
        after={"company": str(company.id), "branch": str(branch.id) if branch else "", "all_branches": all_branches},
        request=request,
    )
    _security_event(
        "SWITCH_SCOPE", request, account,
        detail={
            "before": before,
            "after": {"company": str(company.id), "branch": str(branch.id) if branch else "", "all_branches": all_branches},
        },
        company=company,
    )
    return preference


def create_notification(recipient, title, message, company=None, **kwargs):
    event_key = kwargs.get("event_key", "")
    if event_key:
        item, _ = Notification.objects.get_or_create(
            recipient=recipient,
            event_key=event_key,
            defaults={"company": company, "title": title, "message": message, **kwargs},
        )
        return item
    return Notification.objects.create(recipient=recipient, company=company, title=title, message=message, **kwargs)


@transaction.atomic
def _valid_invitation(code):
    if not code:
        return None
    now = timezone.now()
    for invitation in CompanyInvitation.objects.select_related("company").filter(
        revoked_at__isnull=True, company__status="ACTIVE"
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)):
        if invitation.max_uses is not None and invitation.use_count >= invitation.max_uses:
            continue
        if check_password(code, invitation.code_hash):
            return invitation
    raise ValidationError({"invitation_code": "Mã mời không hợp lệ hoặc đã hết hạn."})


@transaction.atomic
def create_join_request(company, message, request, invitation_code=""):
    account = iam_user(request)

    # EF-02: Tài khoản User đang bị khóa
    if account.locked_until and account.locked_until > timezone.now():
        raise PermissionDenied("Tài khoản đang bị khóa. Vui lòng liên hệ bộ phận hỗ trợ để được xử lý")

    # BR-COM-JOIN-01 / EF-01: Chỉ tài khoản ở trạng thái ACTIVE và đã xác thực email
    if not account.auth_user.is_active or not UserPreference.objects.filter(user=account, email_verified_at__isnull=False).exists():
        raise PermissionDenied("Tài khoản chưa được xác thực. Vui lòng xác thực Email để tiếp tục")

    # EF-09: Lời nhắn/Lý do tham gia vượt quá 500 ký tự
    if message and len(message) > 500:
        raise ValidationError({"message": "Lời nhắn không được vượt quá 500 ký tự"})

    # EF-10: User đã gửi tối đa 10 yêu cầu tham gia trong 24 giờ
    _enforce_rate_limit(
        "join-request",
        (account.id,),
        limit=10,
        window_seconds=86400,
        message="Bạn đã gửi quá nhiều yêu cầu tham gia. Vui lòng thử lại sau",
    )
    if CompanyJoinRequest.objects.filter(
        requester=account, created_at__gte=timezone.now() - timedelta(hours=24)
    ).count() >= 10:
        raise Throttled(wait=86400, detail="Bạn đã gửi quá nhiều yêu cầu tham gia. Vui lòng thử lại sau")

    invitation = _valid_invitation(invitation_code)
    if invitation:
        company = invitation.company

    if not company:
        raise ValidationError("Cần chọn doanh nghiệp hoặc nhập mã mời.")

    # EF-07 / BR-COM-JOIN-11: Doanh nghiệp không ở trạng thái ACTIVE
    if company.status != "ACTIVE":
        raise ValidationError("Doanh nghiệp hiện không thể tiếp nhận yêu cầu tham gia. Vui lòng chọn doanh nghiệp khác")

    setting, _ = CoreCompanySetting.objects.get_or_create(company=company)

    # EF-08: Doanh nghiệp đã tắt chức năng tiếp nhận yêu cầu tham gia
    if not setting.configuration.get("allow_join_requests", True):
        raise ValidationError("Doanh nghiệp hiện không tiếp nhận yêu cầu tham gia. Vui lòng liên hệ Admin doanh nghiệp")

    # BR-COM-JOIN-03 / EF-05 / AF-04: User đã là thành viên đang hoạt động của doanh nghiệp
    if CompanyMembership.objects.filter(company=company, user=account, membership_status=ActiveStatus.ACTIVE).exists():
        raise ValidationError("Bạn đã là thành viên của doanh nghiệp này")

    # BR-COM-JOIN-04 / EF-06 / AF-05: User đã có yêu cầu PENDING tại doanh nghiệp
    existing_pending = CompanyJoinRequest.objects.filter(company=company, requester=account, status="PENDING").first()
    if existing_pending:
        raise ValidationError({
            "detail": "Bạn đã có yêu cầu tham gia đang chờ xử lý tại doanh nghiệp này",
            "existing_request": {
                "id": str(existing_pending.id),
                "company_name": existing_pending.company.name,
                "created_at": existing_pending.created_at.isoformat(),
                "status": existing_pending.status,
                "status_display": existing_pending.get_status_display(),
            }
        })

    # BR-COM-JOIN-15 / AF-06: Nếu yêu cầu trước đó bị từ chối, kiểm tra thời gian chờ cấu hình
    cooldown_hours = int(setting.configuration.get("join_reapply_wait_hours", 24))
    rejected = CompanyJoinRequest.objects.filter(
        company=company, requester=account, status=CompanyJoinRequest.Status.REJECTED,
        decided_at__gt=timezone.now() - timedelta(hours=cooldown_hours),
    ).exists()
    if rejected:
        raise ValidationError(f"Bạn có thể gửi lại yêu cầu sau {cooldown_hours} giờ kể từ lần bị từ chối.")

    expiry_days = int(setting.configuration.get("join_request_expiry_days", 30))
    try:
        with transaction.atomic():
            item = CompanyJoinRequest.objects.create(
                company=company, requester=account, message=message or "",
                expires_at=timezone.now() + timedelta(days=expiry_days),
            )
    except IntegrityError:
        # BR-COM-JOIN-19: Xử lý đồng thời không tạo nhiều yêu cầu PENDING
        raise ValidationError("Bạn đã có yêu cầu tham gia đang chờ xử lý tại doanh nghiệp này")
    except Exception:
        # EF-11: Không thể lưu yêu cầu do lỗi hệ thống hoặc Database
        raise ValidationError("Không thể gửi yêu cầu. Vui lòng thử lại")

    if invitation:
        invitation.use_count += 1
        invitation.save(update_fields=("use_count",))

    # BR-COM-JOIN-12: Gửi thông báo đến Admin doanh nghiệp hoặc User có Permission COM.JOIN_REQUEST.APPROVE
    admin_ids = set(
        account.__class__.objects.filter(
            memberships__company=company,
            memberships__membership_status=ActiveStatus.ACTIVE,
            memberships__role_assignments__status=ActiveStatus.ACTIVE,
        ).filter(
            Q(memberships__role_assignments__role__is_system_admin=True) |
            Q(memberships__role_assignments__role__role_permissions__permission__code="COM.JOIN_REQUEST.APPROVE",
              memberships__role_assignments__role__role_permissions__effect="ALLOW")
        ).values_list("id", flat=True)
    )
    for admin in account.__class__.objects.filter(id__in=admin_ids):
        try:
            create_notification(
                admin, "Yêu cầu tham gia doanh nghiệp",
                f"{account.display_name} yêu cầu tham gia {company.name}.",
                company, level="IMPORTANT", source_module="COM",
                entity_type="CompanyJoinRequest", entity_id=item.id,
                permission_code="COM.JOIN_REQUEST.APPROVE",
                event_key=f"join-request:{item.id}:pending",
            )
        except Exception:
            # AF-11: Yêu cầu đã được tạo nhưng chưa gửi được thông báo cho Admin -> giữ nguyên PENDING, ghi nhận lỗi
            pass

    # BR-COM-JOIN-17: Gửi thông báo cho User khi yêu cầu được gửi
    try:
        create_notification(
            account, "Đã gửi yêu cầu tham gia",
            f"Yêu cầu tham gia {company.name} đang chờ xử lý.",
            company, source_module="COM", entity_type="CompanyJoinRequest",
            entity_id=item.id, event_key=f"join-request:{item.id}:created",
        )
    except Exception:
        pass

    # BR-COM-JOIN-16: Ghi audit log
    record_audit(
        company=company, actor_user=account, module_code="COM",
        action_code="JOIN_REQUEST_CREATE", entity=item,
        after={"status": item.status, "message": item.message}, request=request
    )

    if invitation and (invitation.auto_approve or setting.configuration.get("auto_approve_invites", False)):
        return decide_join_request(item, CompanyJoinRequest.Status.APPROVED, "Tự động chấp thuận bằng mã mời", request, auto_approve=True)
    return item


@transaction.atomic
def cancel_join_request(item, account, request=None):
    try:
        item = CompanyJoinRequest.objects.select_for_update().get(pk=item.pk)
    except Exception:
        # EF-13: Không thể hủy yêu cầu do lỗi hệ thống
        raise ValidationError("Không thể hủy yêu cầu. Vui lòng thử lại")

    if item.requester_id != account.id:
        raise PermissionDenied("Bạn chỉ được hủy yêu cầu của mình.")

    # BR-COM-JOIN-13, BR-COM-JOIN-14, EF-12:
    if item.status != "PENDING":
        raise ValidationError("Yêu cầu đã được xử lý và không thể hủy")

    item.status = "CANCELLED"
    item.decided_at = timezone.now()
    item.save(update_fields=("status", "decided_at", "updated_at"))

    # BR-COM-JOIN-17: Gửi thông báo cho user khi yêu cầu bị hủy
    try:
        create_notification(
            account, "Đã hủy yêu cầu tham gia",
            f"Yêu cầu tham gia {item.company.name} đã được hủy.",
            item.company, source_module="COM", entity_type="CompanyJoinRequest",
            entity_id=item.id, event_key=f"join-request:{item.id}:cancelled",
        )
    except Exception:
        pass

    # BR-COM-JOIN-16: Ghi audit log
    if request:
        record_audit(
            company=item.company, actor_user=account, module_code="COM",
            action_code="JOIN_REQUEST_CANCEL", entity=item,
            after={"status": item.status}, request=request
        )
    return item


def decide_join_request(item, decision, reason, request, *, options=None, auto_approve=False):
    options = options or {}
    actor = iam_user(request)
    if decision not in ("APPROVED", "REJECTED"):
        raise ValidationError("Quyết định không hợp lệ.")
    if decision == "REJECTED" and not reason.strip():
        raise ValidationError({"reason": "Cần nhập lý do từ chối."})

    with transaction.atomic():
        item = CompanyJoinRequest.objects.select_for_update().select_related(
            "company", "requester__auth_user", "requester__preference"
        ).get(pk=item.pk)
        company = item.company
        now = timezone.now()
        if item.status != "PENDING":
            raise ValidationError("Yêu cầu đã được xử lý.")
        if item.expires_at and item.expires_at <= now:
            raise ValidationError("Yêu cầu đã hết hạn.")
        if company.status != CompanyStatus.ACTIVE:
            raise ValidationError("Doanh nghiệp không hoạt động.")
        if not auto_approve:
            if not CompanyMembership.objects.filter(
                company=company, user=actor, membership_status=ActiveStatus.ACTIVE
            ).exists():
                raise PermissionDenied("Người xử lý không là thành viên đang hoạt động.")
            permission = f"COM.JOIN_REQUEST.{ 'APPROVE' if decision == 'APPROVED' else 'REJECT' }"
            if not has_effective_permission(actor, company, permission):
                raise PermissionDenied("Không có quyền xử lý yêu cầu.")

        snapshot = {}
        if decision == "APPROVED":
            requester = item.requester
            if (not requester.auth_user.is_active or
                    (requester.locked_until and requester.locked_until > now) or
                    not requester.preference.email_verified_at):
                raise ValidationError("Tài khoản người gửi chưa được xác thực hoặc không hoạt động.")
            membership = CompanyMembership.objects.select_for_update().filter(
                company=company, user=requester
            ).first()
            if membership and membership.membership_status == ActiveStatus.ACTIVE:
                raise ValidationError("User đã là thành viên của doanh nghiệp.")
            if membership and not options.get("reactivate_membership"):
                raise ValidationError("Cần xác nhận kích hoạt lại Membership.")

            unit = None
            if options.get("organization_unit"):
                if not auto_approve and not has_effective_permission(actor, company, "COM.JOIN_REQUEST.ASSIGN_UNIT"):
                    raise PermissionDenied("Không có quyền phân công đơn vị.")
                unit = OrganizationUnit.objects.filter(pk=options["organization_unit"], company=company).first()
                today = timezone.localdate()
                if not unit or unit.status != "ACTIVE" or unit.start_date > today or (unit.end_date and unit.end_date < today):
                    raise ValidationError({"organization_unit": "Đơn vị không còn hiệu lực."})

            selected = options.get("role_assignments")
            if selected is None and not options.get("membership_only"):
                default_code = CoreCompanySetting.objects.get_or_create(company=company)[0].configuration.get("default_member_role", "MEMBER")
                default_role = Role.objects.filter(company=company, code=default_code, status=RoleStatus.ACTIVE).first()
                if default_role is None and default_code == "MEMBER":
                    default_role, _ = Role.objects.get_or_create(
                        company=company, code="MEMBER",
                        defaults={"name": "Thành viên", "role_type": "STANDARD", "status": RoleStatus.ACTIVE},
                    )
                if default_role is None:
                    raise ValidationError("Role mặc định không còn hiệu lực.")
                if default_role.is_system_admin:
                    raise ValidationError("Role Admin phải được chọn rõ ràng khi chấp thuận.")
                selected = [{"role": str(default_role.pk)}]
            selected = selected or []
            if options.get("membership_only") and selected:
                raise ValidationError("Không thể vừa chọn Role vừa chỉ tạo Membership.")
            if not selected and not (auto_approve or CoreCompanySetting.objects.get_or_create(company=company)[0].configuration.get("allow_membership_without_role")):
                raise ValidationError("Doanh nghiệp chưa cho phép Membership không có Role.")
            if options.get("role_assignments") is not None and not auto_approve and not has_effective_permission(actor, company, "COM.JOIN_REQUEST.ASSIGN_ROLE"):
                raise PermissionDenied("Không có quyền gán Role.")

            grants = []
            seen = set()
            actor_assignments = list(effective_assignments(actor, company)) if not auto_approve else []
            actor_permissions = set().union(*(assignment_permission_codes(a) for a in actor_assignments))
            actor_is_admin = any(a.role.is_system_admin for a in actor_assignments)
            for entry in selected:
                if not isinstance(entry, dict) or not entry.get("role"):
                    raise ValidationError({"role_assignments": "Mỗi mục cần có Role."})
                role = Role.objects.filter(pk=entry["role"], company=company, status=RoleStatus.ACTIVE).first()
                if role is None or role.pk in seen:
                    raise ValidationError({"role_assignments": "Role không hợp lệ hoặc bị trùng."})
                seen.add(role.pk)
                if not auto_approve:
                    role_permissions = set(RolePermission.objects.filter(role=role, effect="ALLOW", permission__status=ActiveStatus.ACTIVE).values_list("permission__code", flat=True))
                    for bundle in role.role_bundles.filter(bundle__status=ActiveStatus.ACTIVE):
                        role_permissions.update(bundle.bundle.permissionbundleitem_set.filter(permission__status=ActiveStatus.ACTIVE).values_list("permission__code", flat=True))
                    if (role.is_system_admin and not actor_is_admin) or not role_permissions <= actor_permissions:
                        raise PermissionDenied("Role vượt quá phạm vi được phép gán.")
                scope = None
                if entry.get("data_scope_set"):
                    if not auto_approve and not has_effective_permission(actor, company, "COM.JOIN_REQUEST.ASSIGN_SCOPE"):
                        raise PermissionDenied("Không có quyền gán Data Scope.")
                    scope = DataScopeSet.objects.filter(pk=entry["data_scope_set"], company=company, status=ActiveStatus.ACTIVE).first()
                    if scope is None:
                        raise ValidationError({"data_scope_set": "Data Scope không hợp lệ."})
                    if not auto_approve and not any(
                        a.data_scope_set_id is None or a.data_scope_set.allow_all_company_data or a.data_scope_set_id == scope.pk
                        for a in actor_assignments
                    ):
                        raise PermissionDenied("Data Scope vượt quá phạm vi được phép gán.")
                if not auto_approve and role_permissions and scope is None and not any(
                    a.data_scope_set_id is None or a.data_scope_set.allow_all_company_data
                    for a in actor_assignments
                ):
                    raise PermissionDenied("Không thể cấp Role toàn doanh nghiệp từ quyền có phạm vi giới hạn.")
                grants.append((role, scope))

            if membership is None:
                membership = CompanyMembership.objects.create(
                    company=company, user=requester, created_by=actor,
                    organization_unit=unit, join_source="APPROVED",
                )
            else:
                membership.membership_status = ActiveStatus.ACTIVE
                membership.left_at = None
                membership.joined_at = now
                membership.organization_unit = unit
                membership.join_source = "APPROVED"
                membership.full_clean()
                membership.save(update_fields=("membership_status", "left_at", "joined_at", "organization_unit", "join_source", "updated_at"))
                UserRoleAssignment.objects.filter(company_membership=membership, status=ActiveStatus.ACTIVE).update(
                    status=ActiveStatus.INACTIVE, valid_to=now, revoked_by=actor, revoked_at=now,
                    revoke_reason="Kích hoạt lại Membership",
                )
            for role, scope in grants:
                assignment = UserRoleAssignment(
                    company_membership=membership, role=role, data_scope_set=scope,
                    assigned_by=actor, valid_from=now,
                )
                assignment.full_clean()
                assignment.save()
            snapshot = {
                "membership_id": str(membership.pk),
                "organization_unit_id": str(unit.pk) if unit else None,
                "roles": [{"role_id": str(role.pk), "data_scope_set_id": str(scope.pk) if scope else None} for role, scope in grants],
            }
            record_audit(
                company=company, actor_user=actor, module_code="COM",
                action_code="JOIN_REQUEST_MEMBERSHIP", entity=membership,
                after=snapshot, request=request,
            )

        item.status = decision
        item.decision_reason = reason.strip()
        item.internal_note = options.get("internal_note", "")
        item.decision_snapshot = snapshot
        item.decided_by = actor
        item.decided_at = now
        item.save(update_fields=("status", "decision_reason", "internal_note", "decision_snapshot", "decided_by", "decided_at", "updated_at"))
        record_audit(
            company=company, actor_user=actor, module_code="COM",
            action_code=decision, entity=item,
            after={"status": decision, "reason": item.decision_reason, **snapshot}, request=request,
        )

    retries = CoreCompanySetting.objects.get_or_create(company=company)[0].configuration.get(
        "join_request_notification_retries", 2
    )
    retries = retries if isinstance(retries, int) and not isinstance(retries, bool) else 2
    for attempt in range(min(max(retries, 0), 5) + 1):
        try:
            create_notification(
                item.requester, "Kết quả yêu cầu tham gia",
                f"Yêu cầu tham gia {company.name}: {item.get_status_display()}."
                + (f" Lý do: {item.decision_reason}" if decision == "REJECTED" else ""),
                company, level="SUCCESS" if decision == "APPROVED" else "WARNING",
                source_module="COM", entity_type="CompanyJoinRequest", entity_id=item.id,
                event_key=f"join-request:{item.id}:{decision.lower()}",
            )
            break
        except Exception:
            if attempt == min(max(retries, 0), 5):
                import logging
                logging.getLogger(__name__).exception("Failed to notify join request decision %s", item.pk)
    return item


def scope_for(account, company, permission_code):
    allowed = []
    for assignment in effective_assignments(account, company):
        if permission_code not in assignment_permission_codes(assignment):
            continue
        scope = assignment.data_scope_set
        if scope is None or scope.allow_all_company_data:
            return None
        allowed.extend(scope.branch_scopes.values_list("branch_id", flat=True))
    return set(allowed)


SEARCH_SOURCES = {
    "parties": {"model": "master_data.Party", "permission": "MD.PARTY.VIEW", "module": "MD", "code": "code", "texts": ("name", "legal_name", "tax_code"), "status": "status"},
    "items": {"model": "master_data.Item", "permission": "MD.ITEM.VIEW", "module": "MD", "code": "code", "texts": ("name",), "status": "status"},
    "purchase_orders": {"model": "purchases.PurchaseOrder", "permission": "PUR.ORDER.VIEW", "module": "PUR", "code": "number", "texts": ("notes",), "date": "document_date", "status": "status", "branch": "branch_id"},
    "sales_orders": {"model": "sales.SalesOrder", "permission": "SAL.ORDER.VIEW", "module": "SAL", "code": "number", "texts": ("notes",), "date": "document_date", "status": "status", "branch": "branch_id"},
    "journals": {"model": "general_ledger.JournalEntry", "permission": "GL.JOURNAL.VIEW", "module": "GL", "code": "number", "texts": ("description", "reference"), "date": "posting_date", "status": "status", "branch": "branch_id"},
    "supplier_invoices": {"model": "accounts_payable.SupplierInvoice", "permission": "AP.INVOICE.VIEW", "module": "AP", "code": "invoice_number", "texts": ("invoice_series", "supplier_tax_code"), "date": "invoice_date", "status": "status", "branch": "branch_id"},
    "receivable_documents": {"model": "accounts_receivable.ReceivableDocument", "permission": "AR.DOCUMENT.VIEW", "module": "AR", "code": "number", "texts": ("description", "source_reference"), "date": "document_date", "status": "status", "branch": "branch_id"},
    "cash_transactions": {"model": "cash_management.CashTransaction", "permission": "CASH.TRANSACTION.VIEW", "module": "CASH", "code": "number", "texts": ("description", "payer_payee"), "date": "transaction_date", "status": "status", "branch": "fund__branch_id"},
    "bank_transactions": {"model": "bank_management.BankTransaction", "permission": "BANK.TRANSACTION.VIEW", "module": "BANK", "code": "number", "texts": ("description", "counterparty_name", "bank_reference"), "date": "transaction_date", "status": "status", "branch": "account__account__branch_id"},
    "inventory_transactions": {"model": "inventory.InventoryTransaction", "permission": "INV.TRANSACTION.VIEW", "module": "INV", "code": "number", "texts": ("reason", "source_reference"), "date": "transaction_date", "status": "status", "branches": ("source_warehouse__branch_id", "destination_warehouse__branch_id")},
    "assets": {"model": "fixed_assets.AssetRecord", "permission": "FA.ASSET.VIEW", "module": "FA", "code": "code", "texts": ("name", "description", "serial_number"), "date": "acquisition_date", "status": "status", "branch": "branch_id"},
    "tax_invoices": {"model": "tax_management.TaxInvoice", "permission": "TAX.INVOICE.VIEW", "module": "TAX", "code": "invoice_number", "texts": ("invoice_series", "seller_name", "seller_tax_code", "buyer_name"), "date": "invoice_date", "status": "status", "branch": "branch_id"},
    "reports": {"model": "reporting.ReportDefinition", "permission_field": "permission_code", "module": "RPT", "code": "code", "texts": ("name", "description"), "status": "is_active", "global": True},
}


def _plain_text(value):
    return "".join(
        character for character in unicodedata.normalize("NFD", str(value or "").lower())
        if unicodedata.category(character) != "Mn"
    ).replace("đ", "d")


def _search_scope(account, company, branch_id=None):
    require_membership(account, company)
    preference, _ = UserPreference.objects.get_or_create(user=account)
    if preference.current_company_id and preference.current_company_id != company.id:
        raise PermissionDenied("Doanh nghiệp không thuộc phạm vi làm việc hiện tại.")
    branch_id = branch_id or preference.current_branch_id
    options = next((item for item in available_scopes(account) if item["company"]["id"] == str(company.id)), None)
    if not options:
        raise PermissionDenied("Bạn không còn phạm vi làm việc hợp lệ.")
    allowed = {item["id"] for item in options["branches"]}
    if branch_id and str(branch_id) not in allowed:
        raise PermissionDenied("Chi nhánh nằm ngoài Data Scope hiện tại.")
    if not branch_id and not options["all_branches_allowed"] and len(allowed) != 1:
        raise ValidationError({"branch": "Vui lòng chọn lại chi nhánh làm việc."})
    if not branch_id and not options["all_branches_allowed"] and len(allowed) == 1:
        branch_id = next(iter(allowed))
    return str(branch_id) if branch_id else None, options["all_branches_allowed"], allowed


def _source_permission(account, company, spec, branch_id):
    if spec.get("permission"):
        return has_effective_permission(account, company, spec["permission"], branch_id=branch_id)
    if spec.get("permission_field"):
        return has_effective_permission(account, company, "RPT.REPORT.VIEW", branch_id=branch_id)
    return False


def global_search(company, query, account, *, group=None, date_from=None, date_to=None, status=None, branch_id=None, page=1, page_size=20, preview_size=5, request=None):
    from django.apps import apps

    query = " ".join(query.split())
    setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
    if len(query) < setting.minimum_search_length:
        raise ValidationError({"q": f"Từ khóa phải có ít nhất {setting.minimum_search_length} ký tự."})
    _enforce_rate_limit("search-user", (account.id,), limit=120, window_seconds=60)
    resolved_branch, all_branches, allowed_branches = _search_scope(account, company, branch_id)
    enabled_modules = set(setting.configuration.get("enabled_modules", []))
    selected = {group: SEARCH_SOURCES[group]} if group in SEARCH_SOURCES else SEARCH_SOURCES
    if group and group not in SEARCH_SOURCES:
        raise ValidationError({"group": "Nhóm dữ liệu không được hỗ trợ."})
    normalized_query = _plain_text(query)
    groups, unavailable = {}, []
    for key, spec in selected.items():
        if enabled_modules and spec["module"] not in enabled_modules:
            continue
        if not _source_permission(account, company, spec, resolved_branch):
            continue
        try:
            model = apps.get_model(spec["model"])
            queryset = model.objects.all()
            if not spec.get("global"):
                queryset = queryset.filter(company=company)
            if spec.get("branch"):
                if resolved_branch:
                    queryset = queryset.filter(**{spec["branch"]: resolved_branch})
                elif not all_branches:
                    queryset = queryset.filter(**{f"{spec['branch']}__in": allowed_branches})
            if spec.get("branches"):
                branch_values = [resolved_branch] if resolved_branch else list(allowed_branches)
                branch_filter = Q()
                for lookup in spec["branches"]:
                    branch_filter |= Q(**{f"{lookup}__in": branch_values})
                queryset = queryset.filter(branch_filter)
            if date_from and spec.get("date"):
                queryset = queryset.filter(**{f"{spec['date']}__gte": date_from})
            if date_to and spec.get("date"):
                queryset = queryset.filter(**{f"{spec['date']}__lte": date_to})
            if status is not None and spec.get("status"):
                filter_value = status
                if spec["status"] == "is_active":
                    filter_value = str(status).lower() in {"active", "true", "1"}
                queryset = queryset.filter(**{spec["status"]: filter_value})
            elif spec.get("status") == "status":
                queryset = queryset.exclude(status__in=("CANCELLED", "INACTIVE"))
            permission_field = spec.get("permission_field")
            candidates = list(queryset.order_by("-updated_at")[:500])
            ranked = []
            for item in candidates:
                item_permission = getattr(item, permission_field) if permission_field else spec.get("permission")
                if item_permission and not has_effective_permission(account, company, item_permission, branch_id=resolved_branch):
                    continue
                code = str(getattr(item, spec["code"], "") or "")
                text_values = [str(getattr(item, field, "") or "") for field in spec["texts"]]
                code_plain = _plain_text(code)
                text_plain = " ".join(_plain_text(value) for value in text_values)
                if normalized_query not in code_plain and normalized_query not in text_plain:
                    continue
                score = 100 if code_plain == normalized_query else 80 if code_plain.startswith(normalized_query) else 60 if normalized_query in code_plain else 40
                updated = getattr(item, "updated_at", getattr(item, "created_at", timezone.now()))
                ranked.append((score, updated, {
                    "id": str(item.pk), "entity_type": item._meta.label,
                    "code": code, "name": next((value for value in text_values if value), code),
                    "date": str(getattr(item, spec.get("date", ""), "") or "") or None,
                    "status": str(getattr(item, spec.get("status", ""), "") or "") or None,
                    "branch": str(resolved_branch) if resolved_branch else None,
                    "permission": item_permission, "score": score,
                }))
            ranked.sort(key=lambda entry: (entry[0], entry[1]), reverse=True)
            total = len(ranked)
            start = (page - 1) * page_size if group else 0
            size = page_size if group else preview_size
            groups[key] = {"count": total, "has_more": total > start + size, "items": [entry[2] for entry in ranked[start:start + size]]}
        except Exception:
            unavailable.append(key)
    return {"query": query, "company": str(company.id), "branch": resolved_branch, "page": page, "page_size": page_size, "groups": groups, "unavailable_groups": unavailable}


def open_search_result(account, company, entity_type, entity_id, branch_id=None):
    from django.apps import apps

    resolved_branch, _, _ = _search_scope(account, company, branch_id)
    spec = next(
        (item for key, item in SEARCH_SOURCES.items()
         if item["model"].lower() == entity_type.lower()
         or key.lower() == entity_type.lower()
         or item["model"].split(".")[-1].lower() == entity_type.lower()),
        None
    )
    if not spec:
        raise ValidationError({"entity_type": "Loại dữ liệu không được hỗ trợ."})
    model = apps.get_model(spec["model"])
    filters = {"pk": entity_id}
    if not spec.get("global"):
        filters["company"] = company
    item = model.objects.filter(**filters).first()
    if not item:
        raise ValidationError("Dữ liệu không còn tồn tại hoặc không còn khả dụng.")
    permission = getattr(item, spec["permission_field"]) if spec.get("permission_field") else spec.get("permission")
    item_branch = None
    if spec.get("branch"):
        item_branch = item
        for segment in spec["branch"].removesuffix("_id").split("__"):
            item_branch = getattr(item_branch, segment)
        item_branch = getattr(item_branch, "id", item_branch)
        if resolved_branch and str(item_branch) != str(resolved_branch):
            raise PermissionDenied("Dữ liệu nằm ngoài Data Scope hiện tại.")
    if spec.get("branches"):
        item_branches = set()
        for lookup in spec["branches"]:
            value = item
            for segment in lookup.removesuffix("_id").split("__"):
                value = getattr(value, segment, None)
                if value is None:
                    break
            if value is not None:
                item_branches.add(str(getattr(value, "id", value)))
        if resolved_branch and str(resolved_branch) not in item_branches:
            raise PermissionDenied("Dữ liệu nằm ngoài Data Scope hiện tại.")
    if permission and not has_effective_permission(account, company, permission, branch_id=item_branch or resolved_branch):
        raise PermissionDenied("Bạn không có quyền truy cập nội dung này.")
    if str(getattr(item, "status", "")).upper() in {"CANCELLED", "INACTIVE"}:
        raise ValidationError("Dữ liệu không còn tồn tại hoặc không còn khả dụng.")
    return {"id": str(item.pk), "entity_type": item._meta.label, "permission": permission, "link": f"/{item._meta.app_label}/{item._meta.model_name}/{item.pk}"}


def _work_item_role_ids(account, company):
    return {assignment.role_id for assignment in effective_assignments(account, company)}


WORKFLOW_TASK_SOURCES = (
    {"model": "purchases.PurchaseOrder", "permission": "PUR.ORDER.APPROVE", "type": "APPROVAL", "title": "Phê duyệt đơn mua hàng", "reference": "number", "branch": "branch_id"},
    {"model": "sales.SalesOrder", "permission": "SAL.ORDER.APPROVE", "type": "APPROVAL", "title": "Phê duyệt đơn bán hàng", "reference": "number", "branch": "branch_id"},
    {"model": "accounts_payable.SupplierInvoice", "permission": "AP.INVOICE.APPROVE", "type": "APPROVAL", "title": "Phê duyệt hóa đơn đầu vào", "reference": "invoice_number", "branch": "branch_id"},
    {"model": "accounts_receivable.ReceivableDocument", "permission": "AR.DOCUMENT.APPROVE", "type": "APPROVAL", "title": "Phê duyệt chứng từ phải thu", "reference": "number", "branch": "branch_id"},
    {"model": "cash_management.CashTransaction", "permission": "CASH.TRANSACTION.APPROVE", "type": "APPROVAL", "title": "Phê duyệt giao dịch tiền mặt", "reference": "number", "branch": "fund__branch_id"},
    {"model": "bank_management.BankTransaction", "permission": "BANK.TRANSACTION.APPROVE", "type": "APPROVAL", "title": "Phê duyệt giao dịch ngân hàng", "reference": "number", "branch": "account__account__branch_id"},
    {"model": "inventory.InventoryTransaction", "permission": "INV.TRANSACTION.APPROVE", "type": "APPROVAL", "title": "Phê duyệt giao dịch kho", "reference": "number", "branch": "source_warehouse__branch_id", "fallback_branch": "destination_warehouse__branch_id"},
    {"model": "fixed_assets.AssetTransaction", "permission": "FA.TRANSACTION.APPROVE", "type": "APPROVAL", "title": "Phê duyệt giao dịch tài sản", "reference": "number", "branch": "asset__branch_id"},
)


def _related_value(instance, path):
    value = instance
    for segment in path.removesuffix("_id").split("__"):
        value = getattr(value, segment, None)
        if value is None:
            return None
    return getattr(value, "id", value)


def synchronize_work_items(company):
    """Materialize approval responsibilities from current workflow state."""
    from django.apps import apps

    memberships = CompanyMembership.objects.filter(
        company=company, membership_status=ActiveStatus.ACTIVE,
        user__auth_user__is_active=True,
    ).select_related("user", "user__auth_user")
    for spec in WORKFLOW_TASK_SOURCES:
        model = apps.get_model(spec["model"])
        pending = list(model.objects.filter(company=company, status="PENDING_APPROVAL")[:1000])
        pending_ids = {item.pk for item in pending}
        prefix = f"workflow:{spec['model']}:"
        existing = WorkItem.objects.filter(company=company, dedupe_key__startswith=prefix).exclude(
            status__in=(WorkItem.Status.COMPLETED, WorkItem.Status.CANCELLED, WorkItem.Status.REASSIGNED)
        )
        for task in existing.exclude(entity_id__in=pending_ids):
            entity = _work_entity(task)
            entity_status = str(getattr(entity, "status", "")).upper() if entity else "MISSING"
            target = WorkItem.Status.COMPLETED if entity_status in {"APPROVED", "POSTED", "CONFIRMED", "CLOSED"} else WorkItem.Status.CANCELLED
            transition_work_item(
                task, target, reason=f"Đồng bộ trạng thái nghiệp vụ: {entity_status}",
                business_completed=target == WorkItem.Status.COMPLETED,
            )
        for entity in pending:
            branch_id = _related_value(entity, spec["branch"])
            if branch_id is None and spec.get("fallback_branch"):
                branch_id = _related_value(entity, spec["fallback_branch"])
            branch = Branch.objects.filter(pk=branch_id, company=company).first() if branch_id else None
            for membership in memberships:
                if not has_effective_permission(
                    membership.user, company, spec["permission"], branch_id=branch_id
                ):
                    continue
                reference = str(getattr(entity, spec["reference"], "") or "")
                create_work_item(
                    company=company, branch=branch,
                    assignee=membership.user, title=f"{spec['title']} {reference}".strip(),
                    task_type=spec["type"], entity=entity, permission_code=spec["permission"],
                    action_code="APPROVE", reference_code=reference,
                    link=f"/{entity._meta.app_label}/{entity._meta.model_name}/{entity.pk}",
                    priority="HIGH", dedupe_key=f"{prefix}{entity.pk}:APPROVE:{membership.user_id}",
                    metadata={"workflow_status": "PENDING_APPROVAL"},
                )


def visible_work_items(account, company, branch_id=None):
    resolved_branch, all_branches, allowed = _search_scope(account, company, branch_id)
    role_ids = _work_item_role_ids(account, company)
    queryset = WorkItem.objects.filter(company=company).filter(
        Q(assignee=account) | Q(assignee_role_id__in=role_ids)
    ).select_related("company", "branch", "assignee", "assignee_role", "created_by")
    if resolved_branch:
        queryset = queryset.filter(Q(branch_id=resolved_branch) | Q(branch__isnull=True))
    elif not all_branches:
        queryset = queryset.filter(Q(branch_id__in=allowed) | Q(branch__isnull=True))
    for item in queryset.filter(
        status__in=(WorkItem.Status.PENDING, WorkItem.Status.IN_PROGRESS, WorkItem.Status.OVERDUE)
    )[:1000]:
        entity = _work_entity(item)
        if entity is None or str(getattr(entity, "status", "")).upper() in {"CANCELLED", "INACTIVE"}:
            transition_work_item(item, WorkItem.Status.CANCELLED, reason="Dữ liệu nghiệp vụ không còn khả dụng")
    allowed_ids = [
        item["id"] for item in queryset.values("id", "permission_code", "branch_id")
        if has_effective_permission(account, company, item["permission_code"], branch_id=item["branch_id"] or resolved_branch)
    ]
    return queryset.filter(id__in=allowed_ids)


def refresh_overdue_work_items(queryset):
    now = timezone.now()
    items = list(queryset.filter(status__in=(WorkItem.Status.PENDING, WorkItem.Status.IN_PROGRESS), due_at__lt=now))
    for item in items:
        old_status = item.status
        item.status = WorkItem.Status.OVERDUE
        item.save(update_fields=("status", "updated_at"))
        WorkItemHistory.objects.create(work_item=item, from_status=old_status, to_status=item.status, reason="Quá hạn xử lý")
    return len(items)


def _work_entity(item):
    from django.apps import apps

    try:
        model = apps.get_model(item.entity_type)
    except (LookupError, ValueError):
        return None
    filters = {"pk": item.entity_id}
    if any(field.name == "company" for field in model._meta.fields):
        filters["company_id"] = item.company_id
    return model.objects.filter(**filters).first()


def can_access_work_item(item, account):
    directly_assigned = item.assignee_id == account.id
    role_assigned = item.assignee_role_id in _work_item_role_ids(account, item.company)
    if not (directly_assigned or role_assigned):
        return False
    return has_effective_permission(
        account, item.company, item.permission_code, branch_id=item.branch_id
    )


@transaction.atomic
def create_work_item(*, company, title, task_type, entity, permission_code, dedupe_key, assignee=None, assignee_role=None, branch=None, created_by=None, reference_code="", action_code="", link="", priority="NORMAL", due_at=None, metadata=None):
    if not assignee and not assignee_role:
        raise ValidationError("Công việc phải được giao cho User hoặc Role.")
    if assignee and not CompanyMembership.objects.filter(
        company=company, user=assignee, membership_status=ActiveStatus.ACTIVE
    ).exists():
        raise ValidationError("User được giao không có Membership ACTIVE tại doanh nghiệp.")
    if assignee_role and assignee_role.company_id != company.id:
        raise ValidationError("Role được giao không thuộc doanh nghiệp.")
    if assignee_role:
        assignee_role = Role.objects.select_for_update().get(pk=assignee_role.pk)
        if assignee_role.status != RoleStatus.ACTIVE:
            raise ValidationError("Không thể giao công việc cho Role đã ngừng sử dụng.")
    if branch and branch.company_id != company.id:
        raise ValidationError("Chi nhánh công việc không thuộc doanh nghiệp.")
    defaults = {
        "branch": branch, "assignee": assignee, "assignee_role": assignee_role,
        "created_by": created_by, "title": title, "task_type": task_type,
        "entity_type": entity._meta.label, "entity_id": entity.pk,
        "reference_code": reference_code, "permission_code": permission_code,
        "action_code": action_code, "link": link, "priority": priority,
        "due_at": due_at, "metadata": metadata or {},
    }
    item, created = WorkItem.objects.get_or_create(dedupe_key=dedupe_key, defaults={"company": company, **defaults})
    if created:
        WorkItemHistory.objects.create(work_item=item, to_status=item.status, actor=created_by, reason="Khởi tạo từ nghiệp vụ")
    return item


@transaction.atomic
def transition_work_item(item, to_status, *, actor=None, reason="", business_completed=False):
    item = WorkItem.objects.select_for_update().get(pk=item.pk)
    if to_status == WorkItem.Status.COMPLETED and not business_completed:
        raise ValidationError("Công việc chỉ hoàn thành sau khi nghiệp vụ liên quan hoàn tất.")
    allowed = {
        WorkItem.Status.PENDING: {WorkItem.Status.IN_PROGRESS, WorkItem.Status.OVERDUE, WorkItem.Status.COMPLETED, WorkItem.Status.CANCELLED, WorkItem.Status.REASSIGNED},
        WorkItem.Status.IN_PROGRESS: {WorkItem.Status.OVERDUE, WorkItem.Status.COMPLETED, WorkItem.Status.CANCELLED, WorkItem.Status.REASSIGNED},
        WorkItem.Status.OVERDUE: {WorkItem.Status.IN_PROGRESS, WorkItem.Status.COMPLETED, WorkItem.Status.CANCELLED, WorkItem.Status.REASSIGNED},
    }
    if to_status not in allowed.get(item.status, set()):
        raise ValidationError("Chuyển trạng thái công việc không hợp lệ.")
    old_status = item.status
    item.status = to_status
    item.completed_at = timezone.now() if to_status == WorkItem.Status.COMPLETED else None
    item.save(update_fields=("status", "completed_at", "updated_at"))
    WorkItemHistory.objects.create(work_item=item, from_status=old_status, to_status=to_status, actor=actor, reason=reason)
    return item


@transaction.atomic
def reassign_work_item(item, *, assignee=None, assignee_role=None, actor=None, reason=""):
    original = WorkItem.objects.select_for_update().get(pk=item.pk)
    if original.status not in {WorkItem.Status.PENDING, WorkItem.Status.IN_PROGRESS, WorkItem.Status.OVERDUE}:
        raise ValidationError("Công việc không còn có thể phân công lại.")
    entity = _work_entity(original)
    if entity is None:
        raise ValidationError("Dữ liệu nghiệp vụ không còn khả dụng.")
    transition_work_item(original, WorkItem.Status.REASSIGNED, actor=actor, reason=reason or "Phân công lại")
    return create_work_item(
        company=original.company, branch=original.branch, assignee=assignee,
        assignee_role=assignee_role, created_by=actor, title=original.title,
        task_type=original.task_type, entity=entity,
        permission_code=original.permission_code,
        dedupe_key=f"{original.dedupe_key}:reassigned:{uuid.uuid4()}",
        reference_code=original.reference_code, action_code=original.action_code,
        link=original.link, priority=original.priority, due_at=original.due_at,
        metadata=original.metadata,
    )


@transaction.atomic
def open_work_item(item, account):
    item = WorkItem.objects.select_for_update().get(pk=item.pk)
    if not can_access_work_item(item, account):
        raise PermissionDenied("Bạn không có quyền thực hiện công việc này.")
    if item.status == WorkItem.Status.COMPLETED:
        raise ValidationError("Công việc này đã hoàn thành.")
    if item.status == WorkItem.Status.CANCELLED:
        raise ValidationError("Nội dung không còn khả dụng hoặc công việc đã bị hủy.")
    entity = _work_entity(item)
    if entity is None or str(getattr(entity, "status", "")).upper() in {"CANCELLED", "INACTIVE"}:
        if item.status not in {WorkItem.Status.COMPLETED, WorkItem.Status.CANCELLED, WorkItem.Status.REASSIGNED}:
            item = transition_work_item(item, WorkItem.Status.CANCELLED, actor=account, reason="Dữ liệu nghiệp vụ không còn khả dụng")
        raise ValidationError("Nội dung không còn khả dụng hoặc nghiệp vụ đã bị hủy.")
    if item.status in {WorkItem.Status.PENDING, WorkItem.Status.OVERDUE}:
        item = transition_work_item(item, WorkItem.Status.IN_PROGRESS, actor=account, reason="User mở công việc")
    return item


def dashboard(company, account, date_from=None, date_to=None):
    require_membership(account, company)
    now = timezone.now()
    data = {"company": {"id": str(company.id), "code": company.code, "name": company.name}, "updated_at": now, "indicators": [], "tasks": [], "unread_notifications": Notification.objects.filter(recipient=account, company=company, read_at__isnull=True, hidden_at__isnull=True).count()}
    task_specs = (
        ("PUR.ORDER.APPROVE", "Đơn mua chờ duyệt", "purchases", "PurchaseOrder", "PENDING_APPROVAL"),
        ("SAL.ORDER.APPROVE", "Đơn bán chờ duyệt", "sales", "SalesOrder", "PENDING_APPROVAL"),
        ("AP.INVOICE.APPROVE", "Hóa đơn mua chờ duyệt", "accounts_payable", "SupplierInvoice", "PENDING_APPROVAL"),
        ("AR.DOCUMENT.APPROVE", "Chứng từ phải thu chờ duyệt", "accounts_receivable", "ReceivableDocument", "PENDING_APPROVAL"),
    )
    from django.apps import apps
    for permission, label, app_label, model_name, pending_status in task_specs:
        branches = scope_for(account, company, permission)
        if branches == set():
            continue
        queryset = apps.get_model(app_label, model_name).objects.filter(company=company, status=pending_status)
        if branches is not None and any(field.name == "branch" for field in queryset.model._meta.fields):
            queryset = queryset.filter(branch_id__in=branches)
        count = queryset.count()
        if count:
            data["tasks"].append({"code": permission, "label": label, "count": count})
    synchronize_work_items(company)
    work_queryset = visible_work_items(account, company)
    refresh_overdue_work_items(work_queryset)
    data["pending_work_items"] = work_queryset.filter(
        status__in=(WorkItem.Status.PENDING, WorkItem.Status.IN_PROGRESS, WorkItem.Status.OVERDUE)
    ).count()
    branches = scope_for(account, company, "RPT.MANAGEMENT.VIEW")
    if branches != set():
        from general_ledger.models import JournalLine
        lines = JournalLine.objects.filter(entry__company=company, entry__status__in=("POSTED", "REVERSED"))
        if date_from:
            lines = lines.filter(entry__posting_date__gte=date_from)
        if date_to:
            lines = lines.filter(entry__posting_date__lte=date_to)
        if branches is not None:
            lines = lines.filter(entry__branch_id__in=branches)
        if lines.exists():
            grouped = {x["account__account_type"]: x for x in lines.values("account__account_type").annotate(debit=Sum("debit"), credit=Sum("credit"))}
            revenue = (grouped.get("REVENUE", {}).get("credit") or Decimal("0")) - (grouped.get("REVENUE", {}).get("debit") or Decimal("0"))
            expense = (grouped.get("EXPENSE", {}).get("debit") or Decimal("0")) - (grouped.get("EXPENSE", {}).get("credit") or Decimal("0"))
            data["indicators"].extend(({"code": "REVENUE", "label": "Doanh thu", "value": str(revenue)}, {"code": "EXPENSE", "label": "Chi phí", "value": str(expense)}, {"code": "PROFIT", "label": "Lợi nhuận", "value": str(revenue - expense)}))
    return data


SENSITIVE_CONTEXT_KEYS = {
    "password", "mật khẩu", "mat_khau", "otp", "token", "access", "refresh",
    "authorization", "cookie", "secret", "api_key", "session_id", "pin"
}
SENSITIVE_QUESTION_PATTERN = re.compile(
    r"(?i)\b(password|mật\s*khẩu|otp|access[_ -]?token|refresh[_ -]?token|authorization|secret|pin)\b\s*[:=]?\s*\S+"
)


def _sanitize_ai_context(value):
    if isinstance(value, dict):
        return {
            str(key): ("[REDACTED]" if str(key).lower() in SENSITIVE_CONTEXT_KEYS else _sanitize_ai_context(item))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_sanitize_ai_context(item) for item in value[:100]]
    if isinstance(value, str):
        return value[:2000]
    return value


def _sanitize_ai_question(question):
    return SENSITIVE_QUESTION_PATTERN.sub(lambda match: f"{match.group(1)} [REDACTED]", question)


def _call_ai_provider(question, request_type, context, conversation, dashboard_data):
    provider_url = getattr(settings, "COMMON_AI_PROVIDER_URL", "").strip()
    if not provider_url:
        return None
    history = list(
        conversation.interactions.filter(status=AIInteraction.Status.COMPLETED)
        .order_by("-created_at").values("question", "answer")[:10]
    )
    payload = json.dumps({
        "question": question,
        "request_type": request_type,
        "context": context,
        "history": list(reversed(history)),
        "authorized_data": {
            "indicators": dashboard_data["indicators"],
            "tasks": dashboard_data["tasks"],
            "updated_at": str(dashboard_data["updated_at"]),
        },
        "language": "vi",
    }, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    api_key = getattr(settings, "COMMON_AI_PROVIDER_API_KEY", "")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    outbound = urllib_request.Request(provider_url, data=payload, headers=headers, method="POST")
    try:
        with urllib_request.urlopen(
            outbound, timeout=getattr(settings, "COMMON_AI_TIMEOUT_SECONDS", 20)
        ) as response:
            raw_response = response.read(1_000_001)
            if len(raw_response) > 1_000_000:
                raise RuntimeError("AI provider response is too large")
            result = json.loads(raw_response.decode("utf-8"))
    except (OSError, ValueError, urllib_error.URLError) as exc:
        raise RuntimeError("AI provider unavailable") from exc
    answer = result.get("answer") if isinstance(result, dict) else None
    if not isinstance(answer, str) or not answer.strip():
        raise RuntimeError("AI provider returned an invalid response")
    return answer.strip()[:12000]


def create_ai_conversation(company, account, *, branch=None, title=""):
    resolved_branch, _, _ = _search_scope(account, company, branch.id if branch else None)
    return AIConversation.objects.create(
        company=company, branch_id=resolved_branch, user=account, title=title.strip()
    )


def ai_query(company, question, context, request, *, conversation_id=None, parent_id=None, request_key="", request_type="ANALYSIS"):
    started = time.monotonic()
    raw_question = question.strip()
    if len(raw_question) < 3:
        raise ValidationError({"question": "Câu hỏi quá ngắn hoặc không rõ ý định. Vui lòng nhập chi tiết hơn hoặc chọn câu hỏi gợi ý."})
    question = _sanitize_ai_question(raw_question)
    account = iam_user(request)
    require_membership(account, company)
    resolved_branch, _, _ = _search_scope(account, company, context.get("branch") if isinstance(context, dict) else None)
    if not has_effective_permission(account, company, "COM.AI.USE", branch_id=resolved_branch):
        raise PermissionDenied("Bạn không có Permission sử dụng AI Assistant.")
    _enforce_rate_limit("ai-user", (account.id,), limit=30, window_seconds=60)
    if request_key:
        existing = AIInteraction.objects.filter(user=account, request_key=request_key).first()
        if existing:
            return existing
    setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
    if not setting.ai_enabled:
        return AIInteraction.objects.create(
            company=company, user=account, question=question, context={}, request_key=request_key,
            request_type=request_type, scope_snapshot={"company": str(company.id), "branch": resolved_branch},
            status=AIInteraction.Status.UNAVAILABLE,
            answer="AI Assistant chưa được bật. Bạn vẫn có thể tiếp tục sử dụng các chức năng nghiệp vụ thủ công.",
            sources=[], processing_ms=int((time.monotonic() - started) * 1000)
        )
    if conversation_id:
        conversation = AIConversation.objects.filter(
            pk=conversation_id, company=company, user=account, status=AIConversation.Status.ACTIVE
        ).first()
        if not conversation:
            raise ValidationError({"conversation": "Hội thoại không hợp lệ hoặc không thuộc User hiện tại."})
        if str(conversation.branch_id or "") != str(resolved_branch or ""):
            raise ValidationError({"conversation": "Phạm vi làm việc đã thay đổi; hãy bắt đầu hội thoại mới."})
    else:
        conversation = AIConversation.objects.create(
            company=company, branch_id=resolved_branch, user=account, title=question[:120]
        )
    parent = None
    if parent_id:
        parent = AIInteraction.objects.filter(pk=parent_id, conversation=conversation, user=account).first()
        if not parent:
            raise ValidationError({"parent": "Câu hỏi trước không thuộc hội thoại hiện tại."})
    sanitized_context = _sanitize_ai_context(context or {})
    sanitized_context.pop("conversation_history", None)
    scope_snapshot = {"company": str(company.id), "branch": resolved_branch, "captured_at": str(timezone.now())}
    if request_type == "GUIDANCE":
        answer = "Đây là hướng dẫn hỗ trợ. Hãy mở chức năng nghiệp vụ liên quan và kiểm tra dữ liệu trước khi thao tác."
        return AIInteraction.objects.create(
            company=company, user=account, conversation=conversation, parent=parent, question=question,
            context=sanitized_context, request_key=request_key, request_type=request_type,
            scope_snapshot=scope_snapshot, status="COMPLETED", answer=answer, sources=[],
            processing_ms=int((time.monotonic() - started) * 1000),
        )

    # EF-07: Permission check on requested data
    can_view_dashboard = has_effective_permission(account, company, "COM.DASHBOARD.VIEW", branch_id=resolved_branch)
    can_view_reports = has_effective_permission(account, company, "RPT.MANAGEMENT.VIEW", branch_id=resolved_branch)
    if request_type in {"ANALYSIS", "EXPLAIN"} and not (can_view_dashboard or can_view_reports):
        return AIInteraction.objects.create(
            company=company, user=account, conversation=conversation, parent=parent, question=question,
            context=sanitized_context, request_key=request_key, request_type=request_type,
            scope_snapshot=scope_snapshot, status=AIInteraction.Status.DENIED,
            answer="Bạn không có quyền truy cập dữ liệu được yêu cầu.",
            sources=[], processing_ms=int((time.monotonic() - started) * 1000),
        )

    dashboard_data = dashboard(company, account)
    indicators = dashboard_data["indicators"]
    if not indicators and not dashboard_data["tasks"]:
        return AIInteraction.objects.create(
            company=company, user=account, conversation=conversation, parent=parent, question=question,
            context=sanitized_context, request_key=request_key, request_type=request_type,
            scope_snapshot=scope_snapshot, status="INSUFFICIENT_DATA",
            answer="Không đủ dữ liệu trong phạm vi được cấp quyền để đưa ra kết luận. Vui lòng bổ sung thời gian, đối tượng hoặc loại báo cáo.",
            sources=[], processing_ms=int((time.monotonic() - started) * 1000),
        )
    summary = "; ".join(f"{item['label']}: {item['value']}" for item in indicators) or f"Có {sum(item['count'] for item in dashboard_data['tasks'])} việc đang chờ xử lý"
    try:
        provider_answer = _call_ai_provider(
            question, request_type, sanitized_context, conversation, dashboard_data
        )
    except RuntimeError:
        return AIInteraction.objects.create(
            company=company, user=account, conversation=conversation, parent=parent,
            question=question, context=sanitized_context, request_key=request_key,
            request_type=request_type, scope_snapshot=scope_snapshot, status="UNAVAILABLE",
            answer="AI tạm thời không khả dụng. Bạn vẫn có thể tiếp tục xử lý nghiệp vụ thủ công.",
            sources=[], processing_ms=int((time.monotonic() - started) * 1000),
        )
    answer = provider_answer or f"Dữ liệu thực tế trong phạm vi hiện tại: {summary}. Đây là kết quả hỗ trợ và cần được người dùng kiểm tra."
    sources = [{"type": "DASHBOARD", "company": str(company.id), "branch": resolved_branch, "permission": "COM.DASHBOARD.VIEW", "updated_at": str(dashboard_data["updated_at"])}]
    interaction = AIInteraction.objects.create(
        company=company, user=account, conversation=conversation, parent=parent, question=question,
        context=sanitized_context, request_key=request_key, request_type=request_type,
        scope_snapshot=scope_snapshot, status="COMPLETED", answer=answer, sources=sources,
        processing_ms=int((time.monotonic() - started) * 1000),
    )
    conversation.updated_at = timezone.now()
    conversation.save(update_fields=("updated_at",))
    return interaction


def save_ai_feedback(interaction, account, helpful, comment=""):
    if interaction.user_id != account.id:
        raise PermissionDenied("Bạn chỉ được đánh giá câu trả lời của mình.")
    feedback, _ = AIFeedback.objects.update_or_create(
        interaction=interaction,
        defaults={"user": account, "helpful": helpful, "comment": comment},
    )
    return feedback


def open_ai_source(interaction, account, source_index):
    if interaction.user_id != account.id:
        raise PermissionDenied("Bạn không được truy cập hội thoại này.")
    try:
        source = interaction.sources[source_index]
    except (IndexError, TypeError):
        raise ValidationError({"source": "Nguồn tham chiếu không hợp lệ."})
    company = interaction.company
    require_membership(account, company)
    if company.status != ActiveStatus.ACTIVE:
        raise ValidationError("Nguồn dữ liệu không còn khả dụng.")
    permission = source.get("permission")
    branch_id = source.get("branch")
    if permission and not has_effective_permission(account, company, permission, branch_id=branch_id):
        raise PermissionDenied("Bạn không có quyền truy cập nguồn dữ liệu này.")
    entity_type = source.get("entity_type")
    entity_id = source.get("entity_id")
    if entity_type and entity_id:
        from django.apps import apps
        try:
            model = apps.get_model(entity_type)
            entity = model.objects.filter(pk=entity_id).first()
            if not entity or str(getattr(entity, "status", "")).upper() in {"CANCELLED", "INACTIVE", "DELETED"}:
                raise ValidationError("Nguồn dữ liệu không còn khả dụng hoặc đã bị hủy.")
        except LookupError:
            pass
    return {"source": source, "link": f"/dashboard?company={company.id}" if source.get("type") == "DASHBOARD" else source.get("link")}
