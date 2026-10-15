from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

import re

from organization.models import BusinessType

from .models import (
    AIFeedback, AIConversation, AIInteraction, CompanyJoinRequest, CoreCompanySetting,
    Notification, UserPreference, WorkItem, WorkItemHistory,
)


PHONE_PATTERN = re.compile(r"^\+?[0-9][0-9 .()-]{7,28}$")
VIETNAM_PHONE_0_PATTERN = re.compile(r"^0(3|5|7|8|9)\d{8}$")
VIETNAM_PHONE_84_PATTERN = re.compile(r"^\+84(3|5|7|8|9)\d{8}$")
EMAIL_DOMAIN_PATTERN = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$")


def validate_strong_password(value: str) -> str:
    """Validate password according to BR-COM-REG-PWD-01 and BR-COM-REG-PWD-02."""
    if not value or not isinstance(value, str):
        raise serializers.ValidationError("Mật khẩu là bắt buộc.")
    # BR-COM-REG-PWD-02: Mật khẩu không được chứa khoảng trắng, Tab hoặc ký tự xuống dòng.
    if any(c in " \t\r\n" or c.isspace() for c in value):
        raise serializers.ValidationError("Mật khẩu không được chứa khoảng trắng, tab hoặc ký tự xuống dòng.")
    # BR-COM-REG-PWD-01: Mật khẩu phải có từ 8–64 ký tự, gồm ít nhất một chữ hoa, một chữ thường, một chữ số và một ký tự đặc biệt.
    if len(value) < 8 or len(value) > 64:
        raise serializers.ValidationError("Mật khẩu phải có độ dài từ 8 đến 64 ký tự.")
    if not any(c.isupper() for c in value):
        raise serializers.ValidationError("Mật khẩu phải chứa ít nhất một chữ cái viết hoa.")
    if not any(c.islower() for c in value):
        raise serializers.ValidationError("Mật khẩu phải chứa ít nhất một chữ cái viết thường.")
    if not any(c.isdigit() for c in value):
        raise serializers.ValidationError("Mật khẩu phải chứa ít nhất một chữ số.")
    if not any(not c.isalnum() and not c.isspace() for c in value):
        raise serializers.ValidationError("Mật khẩu phải chứa ít nhất một ký tự đặc biệt.")
    validate_password(value)
    return value


def validate_and_normalize_full_name(value: str) -> str:
    """Validate and normalize full name according to BR-COM-REG-DATA-04."""
    if not value or not isinstance(value, str):
        raise serializers.ValidationError("Họ và tên là bắt buộc.")
    normalized = " ".join(value.strip().split())
    if len(normalized) < 2 or len(normalized) > 100:
        raise serializers.ValidationError("Họ và tên phải có độ dài từ 2 đến 100 ký tự sau khi chuẩn hóa.")
    for ch in normalized:
        if not (ch.isalpha() or ch in (" ", "-", "'")):
            raise serializers.ValidationError(
                "Họ và tên chỉ được chứa chữ cái Unicode, khoảng trắng, dấu gạch nối (-) và dấu nháy đơn ('). Không chấp nhận chữ số, ký tự đặc biệt hoặc Emoji."
            )
    return normalized


def validate_and_normalize_email(value: str) -> str:
    """Validate and normalize email according to BR-COM-REG-ID-03 and BR-COM-REG-ID-04."""
    if not value or not isinstance(value, str):
        raise serializers.ValidationError("Email là bắt buộc.")
    raw = value.strip()
    if any(c.isspace() for c in raw):
        raise serializers.ValidationError("Email không được chứa khoảng trắng.")
    if len(raw) > 254:
        raise serializers.ValidationError("Email không được vượt quá 254 ký tự.")
    if raw.count("@") != 1:
        raise serializers.ValidationError("Email phải chứa đúng một ký tự '@'.")
    local_part, domain = raw.split("@")
    if not local_part or not domain:
        raise serializers.ValidationError("Email phải có nội dung ở cả hai phía của ký tự '@'.")
    if len(local_part) > 64:
        raise serializers.ValidationError("Phần tên hộp thư trước '@' không được vượt quá 64 ký tự.")
    if local_part.startswith(".") or local_part.endswith("."):
        raise serializers.ValidationError("Phần tên hộp thư không được bắt đầu hoặc kết thúc bằng dấu chấm.")
    if ".." in local_part:
        raise serializers.ValidationError("Phần tên hộp thư không được chứa hai dấu chấm liên tiếp.")
    if domain.startswith(".") or domain.endswith(".") or ".." in domain or not EMAIL_DOMAIN_PATTERN.match(domain):
        raise serializers.ValidationError("Tên miền của email không đúng định dạng.")
    return raw.lower()


def validate_and_normalize_vietnam_phone(value: str) -> str:
    """Validate and normalize Vietnam phone according to BR-COM-REG-ID-01 and BR-COM-REG-ID-02."""
    if not value or not isinstance(value, str):
        raise serializers.ValidationError("Số điện thoại là bắt buộc.")
    raw = value.strip()
    if any(c.isspace() for c in raw):
        raise serializers.ValidationError("Số điện thoại không được chứa khoảng trắng.")
    if VIETNAM_PHONE_0_PATTERN.fullmatch(raw):
        # Chuyển số bắt đầu bằng 0 sang định dạng +84
        return "+84" + raw[1:]
    elif VIETNAM_PHONE_84_PATTERN.fullmatch(raw):
        return raw
    else:
        raise serializers.ValidationError(
            "Số điện thoại phải có định dạng 0xxxxxxxxx (10 chữ số, đầu 03, 05, 07, 08, 09) hoặc +84xxxxxxxxx."
        )


def validate_phone_format(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        return cleaned
    if not PHONE_PATTERN.fullmatch(cleaned):
        raise serializers.ValidationError("Số điện thoại không đúng định dạng.")
    digits = re.sub(r"\D", "", cleaned)
    if not (8 <= len(digits) <= 15):
        raise serializers.ValidationError("Số điện thoại không đúng định dạng.")
    return cleaned


class RegistrationSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    display_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    email = serializers.CharField(max_length=254)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=30, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8, max_length=64)
    password_confirm = serializers.CharField(write_only=True, min_length=8, max_length=64, required=False)
    confirm_password = serializers.CharField(write_only=True, min_length=8, max_length=64, required=False)
    terms_accepted = serializers.BooleanField(write_only=True)
    terms_version = serializers.CharField(max_length=40, write_only=True, default="current")
    privacy_version = serializers.CharField(max_length=40, write_only=True, default="current")

    def validate(self, attrs):
        from iam.models import UserAccount
        User = get_user_model()

        # BR-COM-REG-DATA-01 & BR-COM-REG-DATA-04: Họ và tên
        raw_name = attrs.get("full_name") or attrs.get("display_name") or ""
        if not raw_name.strip():
            raise serializers.ValidationError({"display_name": "Họ và tên là thông tin bắt buộc."})
        try:
            attrs["display_name"] = validate_and_normalize_full_name(raw_name)
            attrs["full_name"] = attrs["display_name"]
        except serializers.ValidationError as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else exc.detail
            raise serializers.ValidationError({"display_name": msg})

        # BR-COM-REG-ID-03 & BR-COM-REG-ID-04: Email
        try:
            attrs["email"] = validate_and_normalize_email(attrs.get("email", ""))
        except serializers.ValidationError as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else exc.detail
            raise serializers.ValidationError({"email": msg})

        # BR-COM-REG-ID-01 & BR-COM-REG-ID-02: Số điện thoại
        raw_phone = attrs.get("phone") or attrs.get("phone_number") or ""
        if not raw_phone.strip():
            raise serializers.ValidationError({"phone": "Số điện thoại là thông tin bắt buộc."})
        try:
            normalized_phone = validate_and_normalize_vietnam_phone(raw_phone)
            attrs["phone"] = normalized_phone
        except serializers.ValidationError as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else exc.detail
            raise serializers.ValidationError({"phone": msg})

        # BR-COM-REG-PWD-01 & BR-COM-REG-PWD-02: Mật khẩu
        password = attrs.get("password", "")
        try:
            validate_strong_password(password)
        except serializers.ValidationError as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else exc.detail
            raise serializers.ValidationError({"password": msg})

        # BR-COM-REG-PWD-04: Mật khẩu không được trùng hoàn toàn với Số điện thoại hoặc Email đăng ký
        if password.lower() == attrs["email"] or password in (raw_phone, normalized_phone):
            raise serializers.ValidationError({"password": "Mật khẩu không được trùng hoàn toàn với số điện thoại hoặc email đăng ký."})

        # BR-COM-REG-PWD-03: Xác nhận mật khẩu
        confirm_pwd = attrs.get("password_confirm") if "password_confirm" in attrs else attrs.get("confirm_password")
        if not confirm_pwd:
            raise serializers.ValidationError({"password_confirm": "Xác nhận mật khẩu là thông tin bắt buộc."})
        if password != confirm_pwd:
            raise serializers.ValidationError({"password_confirm": "Xác nhận mật khẩu không khớp."})

        # BR-COM-REG-CONSENT-01: Đồng ý điều khoản
        if not attrs.get("terms_accepted"):
            raise serializers.ValidationError({"terms_accepted": "Bạn phải chủ động đồng ý với điều khoản sử dụng và chính sách bảo mật."})

        # BR-COM-REG-DATA-02 & 03: Hệ thống tự sinh username cho auth_user; người dùng không nhập username
        attrs["username"] = str(self.initial_data.get("username") or normalized_phone).strip()[:150]

        # BR-COM-REG-ID-05, BR-COM-REG-ID-06, AF-03, EF-02: Kiểm tra trùng lặp và tài khoản PENDING_VERIFICATION
        user_by_email = User.objects.filter(email__iexact=attrs["email"]).first()
        if not user_by_email:
            pref = UserPreference.objects.filter(normalized_email=attrs["email"]).select_related("user__auth_user").first()
            if pref and hasattr(pref.user, "auth_user"):
                user_by_email = pref.user.auth_user

        phone_candidates = [normalized_phone]
        if normalized_phone.startswith("+84"):
            phone_candidates.append("0" + normalized_phone[3:])
        account_by_phone = UserAccount.objects.filter(phone__in=phone_candidates).select_related("auth_user").first()
        user_by_phone = account_by_phone.auth_user if account_by_phone else None

        def is_pending_verification(u):
            if not u:
                return False
            has_verified = UserPreference.objects.filter(user=u.iam_account, email_verified_at__isnull=False).exists()
            return not u.is_active and not has_verified

        if user_by_email and user_by_phone:
            if user_by_email.id == user_by_phone.id:
                # Cùng thuộc một tài khoản
                if is_pending_verification(user_by_email):
                    # AF-03 / BR-COM-REG-ID-06: Tiếp tục xác thực tài khoản đó
                    attrs["existing_pending_user"] = user_by_email
                else:
                    # EF-02: Tài khoản đã ACTIVE, LOCKED hoặc INACTIVE
                    raise serializers.ValidationError({"email": "Email đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng chức năng Quên mật khẩu."})
            else:
                # Một trong hai thông tin thuộc tài khoản khác (BR-COM-REG-ID-06)
                if not is_pending_verification(user_by_email):
                    raise serializers.ValidationError({"email": "Email đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng chức năng Quên mật khẩu."})
                raise serializers.ValidationError({"phone": "Số điện thoại đã được sử dụng."})
        elif user_by_email and not user_by_phone:
            if not is_pending_verification(user_by_email):
                raise serializers.ValidationError({"email": "Email đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng chức năng Quên mật khẩu."})
            raise serializers.ValidationError({"email": "Email đã được đăng ký với số điện thoại khác."})
        elif user_by_phone and not user_by_email:
            raise serializers.ValidationError({"phone": "Số điện thoại đã được sử dụng."})
        else:
            if attrs.get("username") and attrs["username"] != attrs["email"]:
                if User.objects.filter(username__iexact=attrs["username"]).exists():
                    raise serializers.ValidationError({"username": "Tên đăng nhập đã được sử dụng."})

        return attrs


class VerificationSerializer(serializers.Serializer):
    challenge = serializers.UUIDField()
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Mã xác thực phải gồm đúng 6 chữ số."})


class ResendVerificationSerializer(serializers.Serializer):
    challenge = serializers.UUIDField()


class RegistrationEmailChangeSerializer(serializers.Serializer):
    challenge = serializers.UUIDField()
    email = serializers.CharField(max_length=254)

    def validate_email(self, value):
        return validate_and_normalize_email(value)


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=255, required=False, allow_blank=True)
    login = serializers.CharField(max_length=255, required=False, allow_blank=True)
    username = serializers.CharField(max_length=255, required=False, allow_blank=True, write_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate(self, attrs):
        raw_login = (attrs.get("email") or attrs.get("login") or attrs.get("username") or "").strip()
        raw_password = (attrs.get("password") or "").strip()

        errors = {}
        if not raw_login:
            errors["email"] = "Email là bắt buộc."
        if not raw_password:
            errors["password"] = "Mật khẩu là bắt buộc."
        if errors:
            raise serializers.ValidationError(errors)

        # BR-COM-LOGIN-PHONE-01: Chuẩn hóa số điện thoại về định dạng +84 nếu là số điện thoại
        is_phone = False
        if raw_login.startswith("+84") and raw_login[3:].isdigit() and len(raw_login) == 12:
            is_phone = True
            attrs["login"] = raw_login
        elif raw_login.startswith("0") and raw_login[1:].isdigit() and len(raw_login) == 10:
            is_phone = True
            attrs["login"] = "+84" + raw_login[1:]
        elif raw_login.isdigit() and len(raw_login) in (9, 10, 11):
            is_phone = True
            attrs["login"] = "+84" + raw_login if not raw_login.startswith("84") else "+" + raw_login

        if not is_phone:
            # EF-02: Email sai định dạng -> "Email không đúng định dạng."
            try:
                attrs["login"] = validate_and_normalize_email(raw_login)
            except serializers.ValidationError:
                raise serializers.ValidationError({"email": "Email không đúng định dạng."})

        attrs["password"] = raw_password
        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True, default="")
    confirm_discard = serializers.BooleanField(required=False, default=False)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.CharField(required=False, allow_blank=True, max_length=254, trim_whitespace=True)
    identifier = serializers.CharField(required=False, allow_blank=True, max_length=254, trim_whitespace=True)

    def validate(self, attrs):
        raw_email = (attrs.get("email") or attrs.get("identifier") or "").strip()
        if not raw_email:
            raise serializers.ValidationError({"email": "Email là bắt buộc."})
        try:
            from django.core.validators import validate_email
            validate_email(raw_email)
        except Exception:
            raise serializers.ValidationError({"email": "Email không đúng định dạng."})
        attrs["email"] = raw_email.lower()
        attrs["identifier"] = attrs["email"]
        return attrs


class PasswordResetVerifyOTPSerializer(serializers.Serializer):
    challenge = serializers.UUIDField()
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Mã xác thực phải gồm đúng 6 chữ số."})


class PasswordResetConfirmSerializer(serializers.Serializer):
    challenge = serializers.UUIDField(required=False)
    code = serializers.RegexField(r"^\d{6}$", required=False, error_messages={"invalid": "Mã xác thực phải gồm đúng 6 chữ số."})
    reset_token = serializers.CharField(required=False, allow_blank=True)
    new_password = serializers.CharField(write_only=True, min_length=8, max_length=64)
    new_password_confirm = serializers.CharField(write_only=True, min_length=8, max_length=64)

    def validate_new_password(self, value):
        return validate_strong_password(value)

    def validate(self, attrs):
        has_otp = bool(attrs.get("challenge") and attrs.get("code"))
        has_token = bool(attrs.get("reset_token"))
        if not has_otp and not has_token:
            raise serializers.ValidationError("Cần cung cấp mã xác thực OTP (challenge + code) hoặc reset_token.")
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Xác nhận mật khẩu không khớp."})
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        write_only=True,
        error_messages={
            "blank": "Mật khẩu hiện tại là bắt buộc.",
            "required": "Mật khẩu hiện tại là bắt buộc.",
        },
    )
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        max_length=64,
        error_messages={
            "blank": "Mật khẩu mới là bắt buộc.",
            "required": "Mật khẩu mới là bắt buộc.",
            "min_length": "Mật khẩu phải có độ dài từ 8 đến 64 ký tự.",
            "max_length": "Mật khẩu phải có độ dài từ 8 đến 64 ký tự.",
        },
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        min_length=8,
        max_length=64,
        error_messages={
            "blank": "Xác nhận mật khẩu mới là bắt buộc.",
            "required": "Xác nhận mật khẩu mới là bắt buộc.",
            "min_length": "Mật khẩu phải có độ dài từ 8 đến 64 ký tự.",
            "max_length": "Mật khẩu phải có độ dài từ 8 đến 64 ký tự.",
        },
    )

    def validate_new_password(self, value):
        return validate_strong_password(value)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Xác nhận mật khẩu không khớp."})
        return attrs


@extend_schema_serializer(component_name="CommonUserProfile")
class ProfileSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    display_name = serializers.CharField(
        max_length=255,
        required=False,
        error_messages={
            "blank": "Họ và tên không được để trống.",
            "required": "Họ và tên không được để trống.",
        },
    )
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    avatar = serializers.FileField(required=False, allow_null=True, write_only=True)
    avatar_url = serializers.CharField(read_only=True, allow_null=True)
    remove_avatar = serializers.BooleanField(required=False, write_only=True, default=False)
    version = serializers.DateTimeField(required=False, write_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    last_login = serializers.DateTimeField(read_only=True, allow_null=True)

    def validate_display_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Họ và tên không được để trống.")
        # BR-COM-PROFILE-04: Loại bỏ khoảng trắng thừa ở đầu, cuối và giữa các thành phần họ tên
        return " ".join(value.strip().split())

    def validate_phone(self, value):
        return validate_phone_format(value)

    def validate_avatar(self, value):
        if value is None:
            return value
        # BR-COM-PROFILE-10: Dung lượng không được vượt quá 5 MB
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Dung lượng ảnh đại diện không được vượt quá 5 MB.")
        name = getattr(value, "name", "").lower()
        if not any(name.endswith(ext) for ext in (".jpg", ".jpeg", ".png")):
            raise serializers.ValidationError("Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận các định dạng .jpg, .jpeg, .png.")
        # BR-COM-PROFILE-11: Kiểm tra định dạng thực tế qua magic bytes
        header = value.read(12)
        value.seek(0)
        is_jpeg = header.startswith(b"\xff\xd8\xff")
        is_png = header.startswith(b"\x89PNG\r\n\x1a\n")
        if not (is_jpeg or is_png):
            raise serializers.ValidationError("Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận các định dạng .jpg, .jpeg, .png.")
        return value

    def validate(self, attrs):
        if self.partial and not any(
            field in attrs for field in ("display_name", "phone", "first_name", "last_name", "avatar", "remove_avatar")
        ):
            raise serializers.ValidationError("Không có thông tin hồ sơ nào được thay đổi.")
        return attrs


class CompanyBootstrapSerializer(serializers.Serializer):
    code = serializers.RegexField(r"^[A-Za-z0-9_-]+$", max_length=30, required=False)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    legal_name = serializers.CharField(max_length=255)
    tax_code = serializers.CharField(max_length=30)
    business_type = serializers.ChoiceField(choices=BusinessType.choices)
    address = serializers.CharField(max_length=500)
    province = serializers.CharField(max_length=100)
    legal_representative = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True, error_messages={"invalid": "Email không đúng định dạng."})
    logo = serializers.FileField(required=False, allow_null=True)
    confirmed_authority = serializers.BooleanField(write_only=True)
    accounting_currency = serializers.UUIDField(required=False)
    accounting_regime = serializers.CharField(max_length=30, default="TT99")
    fiscal_year_start_month = serializers.IntegerField(min_value=1, max_value=12, default=1)
    timezone = serializers.CharField(max_length=80, default="Asia/Ho_Chi_Minh")

    def validate_tax_code(self, value):
        value = re.sub(r"\s+", "", value)
        if not re.fullmatch(r"\d{10}(?:-\d{3})?", value):
            raise serializers.ValidationError("Mã số thuế không đúng định dạng.")
        return value

    def validate_phone(self, value):
        return validate_phone_format(value)

    def validate_email(self, value):
        if value:
            try:
                return validate_and_normalize_email(value)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError("Email không đúng định dạng.") from exc
        return value

    def validate_logo(self, value):
        if value is None:
            return value
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Logo không được vượt quá 5 MB.")
        extension = value.name.rsplit(".", 1)[-1].lower() if "." in value.name else ""
        header = value.read(12)
        value.seek(0)
        valid_jpeg = extension in {"jpg", "jpeg"} and header.startswith(b"\xff\xd8\xff")
        valid_png = extension == "png" and header.startswith(b"\x89PNG\r\n\x1a\n")
        if not (valid_jpeg or valid_png):
            raise serializers.ValidationError("Logo phải là file .jpg, .jpeg hoặc .png hợp lệ.")
        return value

    def validate_confirmed_authority(self, value):
        if not value:
            raise serializers.ValidationError("Bạn phải xác nhận có quyền tạo và quản lý doanh nghiệp.")
        return value

    def validate(self, attrs):
        attrs["legal_name"] = " ".join(attrs["legal_name"].split())
        attrs["name"] = " ".join(attrs.get("name", "").split()) or attrs["legal_name"]
        attrs["address"] = " ".join(attrs["address"].split())
        attrs["province"] = " ".join(attrs["province"].split())
        attrs["legal_representative"] = " ".join(attrs["legal_representative"].split())
        required_text = {
            "legal_name": "Tên pháp lý là bắt buộc.",
            "address": "Địa chỉ đăng ký là bắt buộc.",
            "province": "Tỉnh/Thành phố là bắt buộc.",
            "legal_representative": "Người đại diện theo pháp luật là bắt buộc.",
        }
        errors = {field: message for field, message in required_text.items() if not attrs[field]}
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class CompanySummarySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()
    name = serializers.CharField()
    tax_code = serializers.CharField(required=False)
    address = serializers.CharField(required=False, allow_blank=True)
    status = serializers.CharField(required=False)


class CompanyJoinRequestSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    company_tax_code = serializers.CharField(source="company.tax_code", read_only=True)
    company_address = serializers.CharField(source="company.address", read_only=True)
    company_status = serializers.CharField(source="company.status", read_only=True)
    requester_name = serializers.CharField(source="requester.display_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    invitation_code = serializers.CharField(write_only=True, required=False, allow_blank=True)
    message = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        error_messages={"max_length": "Lời nhắn không được vượt quá 500 ký tự"},
    )
    notice = serializers.SerializerMethodField()

    class Meta:
        model = CompanyJoinRequest
        exclude = ("internal_note", "decision_snapshot")
        read_only_fields = ("id", "requester", "status", "decision_reason", "decided_by", "decided_at", "expires_at", "created_at", "updated_at")
        extra_kwargs = {"company": {"required": False}}

    def get_notice(self, obj):
        return "Yêu cầu tham gia doanh nghiệp đã được gửi"

    def validate_message(self, value):
        if value and len(value) > 500:
            raise serializers.ValidationError("Lời nhắn không được vượt quá 500 ký tự")
        return value

    def validate(self, attrs):
        if not attrs.get("company") and not attrs.get("invitation_code"):
            raise serializers.ValidationError("Cần chọn doanh nghiệp hoặc nhập mã mời.")
        return attrs


class InitialRoleAssignmentSerializer(serializers.Serializer):
    role = serializers.UUIDField()
    data_scope_set = serializers.UUIDField(required=False, allow_null=True)


class JoinDecisionSerializer(serializers.Serializer):
    company = serializers.UUIDField(required=False)
    decision = serializers.ChoiceField(choices=("APPROVED", "REJECTED"))
    reason = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    role_assignments = InitialRoleAssignmentSerializer(many=True, required=False)
    organization_unit = serializers.UUIDField(required=False, allow_null=True)
    internal_note = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    reactivate_membership = serializers.BooleanField(default=False)
    membership_only = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if attrs["decision"] == "REJECTED" and not attrs.get("reason", "").strip():
            raise serializers.ValidationError({"reason": "Cần nhập lý do từ chối."})
        if attrs["decision"] == "REJECTED" and any(
            attrs.get(key) for key in ("role_assignments", "organization_unit", "reactivate_membership", "membership_only")
        ):
            raise serializers.ValidationError("Không thể cấp quyền khi từ chối.")
        if attrs.get("membership_only") and attrs.get("role_assignments"):
            raise serializers.ValidationError("Không thể vừa chọn Role vừa chọn chỉ tạo Membership.")
        return attrs


class AdminCompanyJoinRequestSerializer(CompanyJoinRequestSerializer):
    class Meta(CompanyJoinRequestSerializer.Meta):
        exclude = None
        fields = "__all__"
        read_only_fields = tuple(field.name for field in CompanyJoinRequest._meta.fields)


class CompanySwitchSerializer(serializers.Serializer):
    company = serializers.UUIDField()
    branch = serializers.UUIDField(required=False, allow_null=True)
    all_branches = serializers.BooleanField(default=False)
    confirm_discard = serializers.BooleanField(default=False)


class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreference
        fields = "__all__"
        read_only_fields = ("user", "updated_at")


class NotificationSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    company_name = serializers.CharField(source="company.name", read_only=True, allow_null=True)
    content = serializers.CharField(source="message", read_only=True)
    notification_type = serializers.CharField(source="source_module", read_only=True)
    type = serializers.CharField(source="source_module", read_only=True)
    severity = serializers.CharField(source="level", read_only=True)
    sent_at = serializers.DateTimeField(source="created_at", read_only=True)
    action_url = serializers.CharField(source="link", read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = tuple(field.name for field in Notification._meta.fields)

    def get_status(self, obj) -> str:
        if obj.hidden_at:
            return "ARCHIVED"
        return "READ" if obj.read_at else "UNREAD"


class SearchRequestSerializer(serializers.Serializer):
    company = serializers.UUIDField(required=False)
    q = serializers.CharField(max_length=255)
    group = serializers.CharField(max_length=50, required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    status = serializers.CharField(max_length=40, required=False)
    branch = serializers.UUIDField(required=False)
    page = serializers.IntegerField(min_value=1, default=1)
    page_size = serializers.IntegerField(min_value=1, max_value=100, default=20)
    preview_size = serializers.IntegerField(min_value=1, max_value=20, default=5)

    def validate_q(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("Nhập ít nhất 2 ký tự.")
        return value

    def validate(self, attrs):
        if attrs.get("date_from") and attrs.get("date_to") and attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError("Từ ngày không được lớn hơn đến ngày.")
        return attrs


class SearchOpenSerializer(serializers.Serializer):
    company = serializers.UUIDField(required=False)
    branch = serializers.UUIDField(required=False)
    entity_type = serializers.CharField(max_length=100)
    entity_id = serializers.UUIDField()


class WorkItemSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True, allow_null=True)
    assignee_name = serializers.CharField(source="assignee.display_name", read_only=True, allow_null=True)
    assignee_role_name = serializers.CharField(source="assignee_role.name", read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source="created_by.display_name", read_only=True, allow_null=True)
    type = serializers.CharField(source="task_type", read_only=True)
    reference = serializers.CharField(source="reference_code", read_only=True)

    class Meta:
        model = WorkItem
        fields = "__all__"
        read_only_fields = tuple(field.name for field in WorkItem._meta.fields)


class WorkItemHistorySerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.display_name", read_only=True, allow_null=True)

    class Meta:
        model = WorkItemHistory
        fields = "__all__"
        read_only_fields = tuple(field.name for field in WorkItemHistory._meta.fields)


class DashboardRequestSerializer(serializers.Serializer):
    company = serializers.UUIDField()
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs):
        if attrs.get("date_from") and attrs.get("date_to") and attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError("Từ ngày không được lớn hơn đến ngày.")
        return attrs


class AIQuerySerializer(serializers.Serializer):
    company = serializers.UUIDField()
    question = serializers.CharField(min_length=3, max_length=4000)
    context = serializers.JSONField(required=False)
    conversation = serializers.UUIDField(required=False)
    parent = serializers.UUIDField(required=False)
    request_id = serializers.CharField(max_length=100, required=False)
    request_type = serializers.ChoiceField(
        choices=("LOOKUP", "EXPLAIN", "ANALYSIS", "GUIDANCE"), default="ANALYSIS"
    )


class AIConversationCreateSerializer(serializers.Serializer):
    company = serializers.UUIDField()
    branch = serializers.UUIDField(required=False, allow_null=True)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AIConversationSerializer(serializers.ModelSerializer):
    interactions_count = serializers.IntegerField(source="interactions.count", read_only=True)

    class Meta:
        model = AIConversation
        fields = "__all__"
        read_only_fields = tuple(field.name for field in AIConversation._meta.fields)


class AIFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIFeedback
        fields = ("helpful", "comment", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class AIInteractionSerializer(serializers.ModelSerializer):
    feedback = AIFeedbackSerializer(read_only=True)

    class Meta:
        model = AIInteraction
        fields = "__all__"
        read_only_fields = tuple(field.name for field in AIInteraction._meta.fields)


class CompanySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoreCompanySetting
        fields = "__all__"
        read_only_fields = ("id", "company", "created_at", "updated_at")
