from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings

from .models import UserLoginSession


class RevocableJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError as exc:
            raise InvalidToken("Token contained no recognizable user identification") from exc

        try:
            user = self.user_model.objects.select_related(
                "iam_account", "common_session_state"
            ).get(**{api_settings.USER_ID_FIELD: user_id})
        except self.user_model.DoesNotExist as exc:
            raise AuthenticationFailed("User not found", code="user_not_found") from exc

        if not api_settings.USER_AUTHENTICATION_RULE(user):
            raise AuthenticationFailed("User is inactive", code="user_inactive")

        try:
            state = user.common_session_state
        except ObjectDoesNotExist:
            state = None
        issued_at = int(validated_token.get("iat", 0))
        if state and issued_at < state.valid_after_epoch:
            raise AuthenticationFailed("Phiên đăng nhập đã kết thúc.", code="session_revoked")
        session_id = validated_token.get("sid")
        if session_id:
            session = UserLoginSession.objects.filter(
                pk=session_id, user_id=user.pk
            ).only("id", "revoked_at", "expires_at").first()
            if not session or session.revoked_at or session.expires_at <= timezone.now():
                raise AuthenticationFailed("Phiên đăng nhập đã kết thúc.", code="session_revoked")
        return user


class RevocableTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        from rest_framework_simplejwt.tokens import RefreshToken

        token = RefreshToken(attrs["refresh"])
        session_id = token.get("sid")
        if session_id:
            session = UserLoginSession.objects.filter(pk=session_id).first()
            if not session or session.revoked_at or session.expires_at <= timezone.now():
                raise AuthenticationFailed("Phiên đăng nhập đã kết thúc.", code="session_revoked")
        return super().validate(attrs)


class PermissiveRevocableJWTAuthentication(RevocableJWTAuthentication):
    """
    Permissive JWT authentication for logout and cleanup endpoints.
    Allows request to proceed even if token has already expired or been revoked,
    enabling idempotent logout without 401 errors (BR-COM-LOGOUT-07, BR-COM-LOGOUT-16, EF-01, EF-02).
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except Exception:
            return None
