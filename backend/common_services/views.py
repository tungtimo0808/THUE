from django.conf import settings
from django.db import IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers as drf_serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, AuthenticationFailed, NotFound, PermissionDenied, Throttled
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import mixins
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from iam.models import ActiveStatus, CompanyMembership
from iam.permissions import has_effective_permission
from organization.models import Branch, Company
from organization.serializers import CompanySerializer

import logging

logger = logging.getLogger(__name__)

from . import services
from .authentication import PermissiveRevocableJWTAuthentication
from .models import AIConversation, AIInteraction, CompanyJoinRequest, CoreCompanySetting, Notification, UserLoginSession, UserPreference, WorkItem
from .permissions import CommonCompanyPermission
from .serializers import (
    AIFeedbackSerializer, AIConversationCreateSerializer, AIConversationSerializer,
    AIInteractionSerializer, AIQuerySerializer, CompanyBootstrapSerializer, CompanyJoinRequestSerializer, AdminCompanyJoinRequestSerializer, CompanySummarySerializer,
    CompanySettingSerializer, CompanySwitchSerializer, DashboardRequestSerializer,
    ChangePasswordSerializer, JoinDecisionSerializer, LoginSerializer, LogoutSerializer, NotificationSerializer,
    PasswordResetConfirmSerializer, PasswordResetRequestSerializer, PasswordResetVerifyOTPSerializer, ProfileSerializer, RegistrationSerializer,
    RegistrationEmailChangeSerializer, ResendVerificationSerializer, SearchOpenSerializer,
    SearchRequestSerializer, UserPreferenceSerializer, VerificationSerializer,
    WorkItemHistorySerializer, WorkItemSerializer,
)


class RegisterView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(request=RegistrationSerializer, responses={201: dict, 200: dict})
    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user, challenge, is_resumed = services.register(serializer.validated_data, request)
        except IntegrityError as exc:
            raise drf_serializers.ValidationError({"email": "Email hoặc số điện thoại đã được sử dụng."}) from exc
        response_data = {
            "id": str(user.iam_account.id),
            "verification_required": bool(challenge),
            "challenge": str(challenge.id) if challenge else None,
        }
        if is_resumed:
            response_data["status"] = "PENDING_VERIFICATION"
            response_data["message"] = "Tài khoản chưa xác thực email. Mã xác thực OTP mới đã được gửi."
        if challenge and hasattr(challenge, "email_sent") and not challenge.email_sent:
            response_data["email_sent"] = False
            response_data["warning"] = "Chưa thể gửi mã xác thực. Vui lòng thử lại."
        if settings.DEBUG and challenge and hasattr(challenge, "raw_code"):
            response_data["dev_otp"] = challenge.raw_code
        status_code = status.HTTP_200_OK if is_resumed else status.HTTP_201_CREATED
        return Response(response_data, status=status_code)


class VerifyRegistrationView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(request=VerificationSerializer, responses={200: dict})
    def post(self, request):
        serializer = VerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.activate_registration(
            serializer.validated_data["challenge"], serializer.validated_data["code"], request=request
        )
        refresh, session = services.issue_session(user, request)
        return Response({
            "verified": True,
            "user": str(user.iam_account.id),
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "next": "company-setup",
            "actions": ["create_company", "join_company"],
        })


class ResendVerificationView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(request=ResendVerificationSerializer, responses={202: dict})
    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        challenge = services.resend_verification(serializer.validated_data["challenge"], request)
        response_data = {"challenge": str(challenge.id)}
        if challenge and hasattr(challenge, "email_sent") and not challenge.email_sent:
            response_data["email_sent"] = False
            response_data["warning"] = "Chưa thể gửi mã xác thực. Vui lòng thử lại."
        if settings.DEBUG and hasattr(challenge, "raw_code"):
            response_data["dev_otp"] = challenge.raw_code
        return Response(response_data, status=status.HTTP_202_ACCEPTED)


class RegistrationEmailChangeView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(request=RegistrationEmailChangeSerializer, responses={202: dict})
    def post(self, request):
        serializer = RegistrationEmailChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        challenge = services.change_registration_email(
            serializer.validated_data["challenge"], serializer.validated_data["email"], request
        )
        response_data = {"challenge": str(challenge.id)}
        if settings.DEBUG and hasattr(challenge, "raw_code"):
            response_data["dev_otp"] = challenge.raw_code
        return Response(response_data, status=status.HTTP_202_ACCEPTED)


class LoginView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(request=LoginSerializer, responses={200: dict})
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            return Response(services.login(serializer.validated_data, request))
        except (AuthenticationFailed, Throttled, drf_serializers.ValidationError):
            raise
        except Exception:
            raise AuthenticationFailed("Không thể đăng nhập. Vui lòng thử lại sau.")


logger = logging.getLogger(__name__)


class LogoutView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = (PermissiveRevocableJWTAuthentication,)

    @extend_schema(request=LogoutSerializer, responses={204: None})
    def post(self, request):
        serializer = LogoutSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        refresh_value = serializer.validated_data.get("refresh", "")
        try:
            services.logout(refresh_value, request)
        except Exception as exc:
            logger.warning("Error during logout: %s", exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChangePasswordView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=ChangePasswordSerializer, responses={200: dict})
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            services.change_password(request.user, serializer.validated_data, request)
            return Response({
                "changed": True,
                "detail": "Mật khẩu đã được thay đổi thành công.",
            })
        except (drf_serializers.ValidationError, AuthenticationFailed, PermissionDenied):
            raise
        except Exception:
            raise APIException("Không thể đổi mật khẩu. Vui lòng thử lại sau.")


class PasswordResetRequestView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(request=PasswordResetRequestSerializer, responses={202: dict})
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email_or_identifier = serializer.validated_data.get("email") or serializer.validated_data["identifier"]
        challenge = services.request_password_reset(email_or_identifier, request)
        response_data = {
            "detail": "Nếu email đã được đăng ký, mã xác thực sẽ được gửi đến email.",
            "challenge": str(challenge.id),
        }
        if settings.DEBUG and hasattr(challenge, "raw_code") and challenge.raw_code:
            response_data["dev_otp"] = challenge.raw_code
        return Response(response_data, status=status.HTTP_202_ACCEPTED)


class PasswordResetVerifyOTPView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(request=PasswordResetVerifyOTPSerializer, responses={200: dict})
    def post(self, request):
        serializer = PasswordResetVerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.verify_reset_otp(
            serializer.validated_data["challenge"],
            serializer.validated_data["code"],
            request=request,
        )
        return Response(result)


class PasswordResetConfirmView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(request=PasswordResetConfirmSerializer, responses={200: dict})
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            services.reset_password(
                challenge_id=serializer.validated_data.get("challenge"),
                code=serializer.validated_data.get("code"),
                new_password=serializer.validated_data["new_password"],
                reset_token=serializer.validated_data.get("reset_token"),
                request=request,
            )
            return Response({
                "reset": True,
                "detail": "Mật khẩu đã được đặt lại thành công.",
            })
        except drf_serializers.ValidationError:
            raise
        except Exception:
            raise APIException("Không thể đặt lại mật khẩu. Vui lòng thử lại sau.")


class ProfileView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=ProfileSerializer)
    def get(self, request):
        account = services.iam_user(request)
        if account.status != ActiveStatus.ACTIVE or not request.user.is_active:
            sid = str(request.auth.get("sid", "")) if request.auth else ""
            if sid:
                UserLoginSession.objects.filter(pk=sid, user=request.user).update(
                    revoked_at=timezone.now(), revoke_reason="ACCOUNT_INACTIVE"
                )
            raise AuthenticationFailed({"detail": "Tài khoản không hoạt động hoặc đã bị vô hiệu hóa.", "code": "account_inactive"})
        return Response(ProfileSerializer(services.profile_data(account)).data)

    @extend_schema(request=ProfileSerializer, responses=ProfileSerializer)
    def patch(self, request):
        account = services.iam_user(request)
        if account.status != ActiveStatus.ACTIVE or not request.user.is_active:
            sid = str(request.auth.get("sid", "")) if request.auth else ""
            if sid:
                UserLoginSession.objects.filter(pk=sid, user=request.user).update(
                    revoked_at=timezone.now(), revoke_reason="ACCOUNT_INACTIVE"
                )
            raise AuthenticationFailed({"detail": "Tài khoản không hoạt động hoặc đã bị vô hiệu hóa.", "code": "account_inactive"})
        serializer = ProfileSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        account, challenge = services.update_profile(account, serializer.validated_data, request)
        result = ProfileSerializer(services.profile_data(account)).data
        result["email_verification_challenge"] = str(challenge.id) if challenge else None
        result["detail"] = "Thông tin cá nhân đã được cập nhật."
        result["message"] = "Thông tin cá nhân đã được cập nhật."
        return Response(result)

    @extend_schema(request=ProfileSerializer, responses=ProfileSerializer)
    def put(self, request):
        return self.patch(request)


class ConfirmEmailView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=VerificationSerializer, responses={200: dict})
    def post(self, request):
        serializer = VerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.confirm_email_change(serializer.validated_data["challenge"], serializer.validated_data["code"], request.user)
        return Response({"email": user.email, "verified": True})


class CompanyBootstrapView(APIView):
    permission_classes = (IsAuthenticated,)

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user and request.user.is_authenticated:
            account = services.iam_user(request)
            if account.status != ActiveStatus.ACTIVE or not request.user.is_active:
                sid = str(request.auth.get("sid", "")) if request.auth else ""
                if sid:
                    UserLoginSession.objects.filter(pk=sid, user=request.user).update(
                        revoked_at=timezone.now(), revoke_reason="ACCOUNT_INACTIVE"
                    )
                raise PermissionDenied("Tài khoản không ở trạng thái ACTIVE.")
            if not UserPreference.objects.filter(user=account, email_verified_at__isnull=False).exists():
                raise PermissionDenied("Email của tài khoản chưa được xác thực. Vui lòng xác thực Email để tiếp tục.")
            if not account.can_create_company:
                raise PermissionDenied("Tài khoản không có quyền tạo doanh nghiệp.")

    def get(self, request):
        tax_code = request.query_params.get("tax_code", "").strip()
        if not tax_code:
            return Response({"message": "Vui lòng cung cấp mã số thuế để tra cứu."}, status=status.HTTP_400_BAD_REQUEST)
        import re
        clean_tax = re.sub(r"\s+", "", tax_code)
        if not re.fullmatch(r"\d{10}(?:-\d{3})?", clean_tax):
            raise drf_serializers.ValidationError({"tax_code": "Mã số thuế không đúng định dạng."})
        existing = Company.objects.filter(tax_code=clean_tax).first()
        if existing:
            return Response({
                "tax_code": clean_tax,
                "exists_on_system": True,
                "company_id": str(existing.id),
                "company_name": existing.name,
                "message": "Doanh nghiệp đã tồn tại; hãy gửi yêu cầu tham gia.",
            })
        return Response({
            "tax_code": clean_tax,
            "exists_on_system": False,
            "legal_name": f"Công ty Cổ phần {clean_tax}",
            "address": "Địa chỉ tra cứu theo đăng ký kinh doanh",
            "province": "Hà Nội",
            "legal_representative": "Người đại diện theo pháp luật",
            "business_type": "LLC_ONE_MEMBER",
            "note": "Thông tin tra cứu chỉ mang tính hỗ trợ; vui lòng kiểm tra trước khi xác nhận tạo doanh nghiệp.",
        })

    @extend_schema(request=CompanyBootstrapSerializer, responses={201: CompanySerializer})
    def post(self, request):
        serializer = CompanyBootstrapSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            company = services.create_company(serializer.validated_data, request)
        except APIException:
            raise
        except Exception as exc:
            error = APIException("Không thể khởi tạo doanh nghiệp. Vui lòng thử lại sau.")
            error.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            raise error from exc
        payload = CompanySerializer(company, context={"request": request}).data
        payload.update({
            "message": "Doanh nghiệp đã được khởi tạo thành công.",
            "next": f"/company-setup/{company.id}",
        })
        return Response(payload, status=status.HTTP_201_CREATED)


class MyCompaniesView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=CompanySummarySerializer(many=True))
    def get(self, request):
        memberships = CompanyMembership.objects.filter(user=services.iam_user(request), membership_status=ActiveStatus.ACTIVE).select_related("company")
        return Response([
            {
                "id": str(x.company_id), "code": x.company.code,
                "name": x.company.name, "status": x.company.status,
            }
            for x in memberships
        ])


class SwitchCompanyView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=CompanySwitchSerializer, responses=UserPreferenceSerializer)
    def post(self, request):
        account = services.iam_user(request)
        if account.status != ActiveStatus.ACTIVE or not request.user.is_active:
            sid = str(request.auth.get("sid", "")) if request.auth else ""
            if sid:
                UserLoginSession.objects.filter(pk=sid, user=request.user).update(
                    revoked_at=timezone.now(), revoke_reason="ACCOUNT_INACTIVE"
                )
            raise AuthenticationFailed({"detail": "Tài khoản không hoạt động hoặc đã bị vô hiệu hóa.", "code": "account_inactive"})

        serializer = CompanySwitchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        company_id = serializer.validated_data["company"]
        company = Company.objects.filter(pk=company_id).first()
        if not company:
            raise NotFound("Không tìm thấy doanh nghiệp.")
        if company.status != "ACTIVE":
            raise PermissionDenied("Doanh nghiệp đã ngừng hoạt động hoặc phạm vi không khả dụng.")

        branch = None
        if serializer.validated_data.get("branch"):
            branch = Branch.objects.filter(pk=serializer.validated_data["branch"]).first()
            if not branch or branch.company_id != company.id or branch.status != "ACTIVE":
                raise PermissionDenied("Bạn không có quyền truy cập chi nhánh đã chọn hoặc chi nhánh không khả dụng.")

        preference = services.switch_scope(
            account, company, branch, serializer.validated_data["all_branches"], request
        )
        result = UserPreferenceSerializer(preference).data
        result.update({
            "detail": "Chuyển phạm vi làm việc thành công.",
            "message": "Chuyển phạm vi làm việc thành công.",
            "target_screen": "DASHBOARD",
            "company": {
                "id": str(company.id),
                "code": company.code,
                "name": company.name,
            },
            "branch": {
                "id": str(branch.id),
                "code": branch.code,
                "name": branch.name,
            } if branch else None,
            "all_branches": preference.all_branches,
        })
        return Response(result)


class ScopeOptionsView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses={200: dict})
    def get(self, request):
        account = services.iam_user(request)
        if account.status != ActiveStatus.ACTIVE or not request.user.is_active:
            sid = str(request.auth.get("sid", "")) if request.auth else ""
            if sid:
                UserLoginSession.objects.filter(pk=sid, user=request.user).update(
                    revoked_at=timezone.now(), revoke_reason="ACCOUNT_INACTIVE"
                )
            raise AuthenticationFailed({"detail": "Tài khoản không hoạt động hoặc đã bị vô hiệu hóa.", "code": "account_inactive"})
        return Response({"scopes": services.available_scopes(account)})


class CompanyDiscoveryView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=CompanySummarySerializer(many=True))
    def get(self, request):
        account = services.iam_user(request)

        # EF-02: Tài khoản User đang bị khóa
        if account.locked_until and account.locked_until > timezone.now():
            raise PermissionDenied("Tài khoản đang bị khóa. Vui lòng liên hệ bộ phận hỗ trợ để được xử lý")

        # BR-COM-JOIN-01 / EF-01: Chỉ tài khoản ở trạng thái ACTIVE và đã xác thực email
        if not account.auth_user.is_active or not UserPreference.objects.filter(user=account, email_verified_at__isnull=False).exists():
            raise PermissionDenied("Tài khoản chưa được xác thực. Vui lòng xác thực Email để tiếp tục")

        query = request.query_params.get("q", "").strip()
        cleaned = query.strip("{}'\"[] ").strip()
        if len(cleaned) < 2:
            raise drf_serializers.ValidationError({"q": "Nhập ít nhất 2 ký tự."})

        try:
            companies = Company.objects.filter(status="ACTIVE").filter(
                Q(code__icontains=cleaned) | Q(name__icontains=cleaned) | Q(tax_code__icontains=cleaned)
            )[:20]
            return Response([
                {
                    "id": str(x.id),
                    "code": x.code,
                    "name": x.name,
                    "tax_code": f"***{x.tax_code[-4:]}" if len(x.tax_code) > 4 else x.tax_code,
                    "address": x.address or "",
                    "status": x.status,
                }
                for x in companies
            ])
        except Exception:
            raise drf_serializers.ValidationError("Không thể tải danh sách doanh nghiệp. Vui lòng thử lại")


class MyJoinRequestViewSet(ModelViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = CompanyJoinRequestSerializer
    queryset = CompanyJoinRequest.objects.all()
    http_method_names = ("get", "post", "head", "options")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.user and request.user.is_authenticated:
            account = services.iam_user(request)
            if account.locked_until and account.locked_until > timezone.now():
                raise PermissionDenied("Tài khoản đang bị khóa. Vui lòng liên hệ bộ phận hỗ trợ để được xử lý")
            if not account.auth_user.is_active or not UserPreference.objects.filter(user=account, email_verified_at__isnull=False).exists():
                raise PermissionDenied("Tài khoản chưa được xác thực. Vui lòng xác thực Email để tiếp tục")

    def get_queryset(self):
        expired = CompanyJoinRequest.objects.filter(
            requester=services.iam_user(self.request), status="PENDING", expires_at__lte=timezone.now()
        )
        for req in expired:
            req.status = "EXPIRED"
            req.decided_at = timezone.now()
            req.save(update_fields=("status", "decided_at"))
            services.record_audit(
                company=req.company, actor_user=req.requester, module_code="COM",
                action_code="JOIN_REQUEST_EXPIRED", entity=req,
                after={"status": "EXPIRED"}, request=self.request
            )
            services.create_notification(
                req.requester, "Yêu cầu tham gia đã hết hạn",
                f"Yêu cầu tham gia {req.company.name} đã quá hạn xử lý.",
                req.company, level="WARNING", source_module="COM",
                entity_type="CompanyJoinRequest", entity_id=req.id,
                event_key=f"join-request:{req.id}:expired",
            )
        return CompanyJoinRequest.objects.filter(requester=services.iam_user(self.request)).select_related("company", "requester", "decided_by")

    def perform_create(self, serializer):
        company = serializer.validated_data.get("company")
        item = services.create_join_request(
            company, serializer.validated_data.get("message", ""), self.request,
            serializer.validated_data.get("invitation_code", ""),
        )
        serializer.instance = item

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        return Response(self.get_serializer(services.cancel_join_request(self.get_object(), services.iam_user(request), request)).data)


class CompanyJoinRequestAdminViewSet(ReadOnlyModelViewSet):
    permission_classes = (CommonCompanyPermission,)
    serializer_class = AdminCompanyJoinRequestSerializer
    queryset = CompanyJoinRequest.objects.select_related("company", "requester", "decided_by")
    iam_permissions = {"GET": "COM.JOIN_REQUEST.VIEW"}
    action_permissions = {"decide": "COM.JOIN_REQUEST.APPROVE"}

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        if company:
            expired = CompanyJoinRequest.objects.filter(
                company_id=company, status="PENDING", expires_at__lte=timezone.now()
            )
            for req in expired:
                req.status = "EXPIRED"
                req.decided_at = timezone.now()
                req.save(update_fields=("status", "decided_at"))
                services.record_audit(
                    company=req.company, actor_user=None, module_code="COM",
                    action_code="JOIN_REQUEST_EXPIRED", entity=req,
                    after={"status": "EXPIRED"}, request=self.request
                )
                services.create_notification(
                    req.requester, "Yêu cầu tham gia đã hết hạn",
                    f"Yêu cầu tham gia {req.company.name} đã quá hạn xử lý.",
                    req.company, level="WARNING", source_module="COM",
                    entity_type="CompanyJoinRequest", entity_id=req.id,
                    event_key=f"join-request:{req.id}:expired",
                )
        queryset = self.queryset.filter(company_id=company) if company else self.queryset.none()
        if state := self.request.query_params.get("status"):
            queryset = queryset.filter(status=state)
        if query := self.request.query_params.get("q"):
            queryset = queryset.filter(
                Q(requester__display_name__icontains=query) |
                Q(requester__auth_user__email__icontains=query) |
                Q(requester__phone__icontains=query)
            )
        if date_from := self.request.query_params.get("date_from"):
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to := self.request.query_params.get("date_to"):
            queryset = queryset.filter(created_at__date__lte=date_to)
        if company and not self.request.user.is_superuser and not has_effective_permission(
            services.iam_user(self.request), Company.objects.get(pk=company),
            "COM.JOIN_REQUEST.VIEW_HISTORY",
        ):
            queryset = queryset.filter(status="PENDING")
        return queryset.order_by("status", "-created_at")

    @action(detail=True, methods=("post",))
    def decide(self, request, pk=None):
        serializer = JoinDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = services.decide_join_request(
            self.get_object(), serializer.validated_data["decision"],
            serializer.validated_data.get("reason", ""), request,
            options=serializer.validated_data,
        )
        return Response(self.get_serializer(item).data)


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class NotificationViewSet(ReadOnlyModelViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = NotificationSerializer
    queryset = Notification.objects.select_related("company", "recipient")
    pagination_class = NotificationPagination

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        account = services.iam_user(request)
        if account.status != ActiveStatus.ACTIVE or not request.user.is_active:
            sid = str(request.auth.get("sid", "")) if request.auth else ""
            if sid:
                UserLoginSession.objects.filter(pk=sid, user=request.user).update(
                    revoked_at=timezone.now(), revoke_reason="ACCOUNT_INACTIVE"
                )
            raise AuthenticationFailed({"detail": "Tài khoản không hoạt động hoặc đã bị vô hiệu hóa.", "code": "account_inactive"})

    def get_queryset(self):
        account = services.iam_user(self.request)
        queryset = self.queryset.filter(recipient=account).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
        )
        status_param = (self.request.query_params.get("status") or "").upper()
        archived_param = self.request.query_params.get("archived")
        if getattr(self, "action", None) == "unarchive":
            pass
        elif status_param == "ARCHIVED" or archived_param in ("true", "1", "True"):
            queryset = queryset.filter(hidden_at__isnull=False)
        else:
            queryset = queryset.filter(hidden_at__isnull=True)

        if status_param == "UNREAD" or self.request.query_params.get("unread") in ("true", "1", "True"):
            queryset = queryset.filter(read_at__isnull=True)
        elif status_param == "READ":
            queryset = queryset.filter(read_at__isnull=False)

        company = self.request.query_params.get("company_id") or self.request.query_params.get("company")
        if company:
            queryset = queryset.filter(company_id=company)
        elif self.request.query_params.get("current_scope") in ("true", "1", "True"):
            pref = getattr(account, "preference", None)
            if pref and pref.current_company_id:
                queryset = queryset.filter(company_id=pref.current_company_id)

        type_param = (
            self.request.query_params.get("type")
            or self.request.query_params.get("notification_type")
            or self.request.query_params.get("source_module")
        )
        if type_param:
            queryset = queryset.filter(
                Q(source_module__iexact=type_param) | Q(entity_type__iexact=type_param)
            )

        level = self.request.query_params.get("level") or self.request.query_params.get("severity")
        if level:
            queryset = queryset.filter(level__iexact=level)

        date_from = self.request.query_params.get("date_from") or self.request.query_params.get("created_after")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        date_to = self.request.query_params.get("date_to") or self.request.query_params.get("created_before")
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset

    def retrieve(self, request, *args, **kwargs):
        item = self.get_object()
        if item.read_at is None:
            item.read_at = timezone.now()
            item.save(update_fields=("read_at",))
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=("post",))
    def read(self, request, pk=None):
        item = self.get_object()
        item.read_at = item.read_at or timezone.now()
        item.save(update_fields=("read_at",))
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=("post",))
    def unread(self, request, pk=None):
        item = self.get_object()
        item.read_at = None
        item.save(update_fields=("read_at",))
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=("post",))
    def hide(self, request, pk=None):
        item = self.get_object()
        item.hidden_at = timezone.now()
        item.save(update_fields=("hidden_at",))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=("post",))
    def archive(self, request, pk=None):
        return self.hide(request, pk)

    @action(detail=True, methods=("post",))
    def unarchive(self, request, pk=None):
        item = self.get_object()
        item.hidden_at = None
        item.save(update_fields=("hidden_at",))
        return Response(self.get_serializer(item).data)

    @action(detail=False, methods=("post",), url_path="read-all")
    def read_all(self, request):
        count = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({
            "updated": count,
            "message": "Đã đánh dấu tất cả thông báo là đã đọc.",
            "detail": "Đã đánh dấu tất cả thông báo là đã đọc.",
        })

    @action(detail=False, methods=("post",), url_path="mark-all-read")
    def mark_all_read(self, request):
        return self.read_all(request)

    @action(detail=False, methods=("get",), url_path="unread-count")
    def unread_count(self, request):
        count = self.get_queryset().filter(read_at__isnull=True).count()
        return Response({"count": count, "unread_count": count})

    @action(detail=True, methods=("post", "get"))
    def open(self, request, pk=None):
        item = self.get_object()
        account = services.iam_user(request)
        if item.company:
            services.require_membership(account, item.company)
            if item.company.status != ActiveStatus.ACTIVE:
                raise PermissionDenied("Doanh nghiệp đã ngừng hoạt động hoặc phạm vi không khả dụng.")
            if item.permission_code and not has_effective_permission(
                account, item.company, item.permission_code
            ):
                raise PermissionDenied("Bạn không có quyền truy cập nội dung này.")

        entity_available = True
        entity_obj = None
        if item.entity_type and item.entity_id:
            try:
                from django.apps import apps
                model = None
                if "." in item.entity_type:
                    model = apps.get_model(item.entity_type)
                else:
                    for app_cfg in apps.get_app_configs():
                        try:
                            model = app_cfg.get_model(item.entity_type)
                            if model:
                                break
                        except LookupError:
                            continue
                if model:
                    entity_obj = model.objects.filter(pk=item.entity_id).first()
                    if not entity_obj:
                        entity_available = False
                    else:
                        raw_status = str(getattr(entity_obj, "status", getattr(entity_obj, "request_status", ""))).upper()
                        if raw_status in {"CANCELLED", "DELETED", "INACTIVE"}:
                            entity_available = False
                        
                        if item.company:
                            branch_id = getattr(entity_obj, "branch_id", None)
                            if branch_id:
                                user_scopes = services.effective_data_scopes(account, item.company)
                                if user_scopes:
                                    is_allowed = any(
                                        s.allow_all_branches or branch_id in s.allowed_branches.values_list("id", flat=True)
                                        for s in user_scopes
                                    )
                                    if not is_allowed:
                                        raise PermissionDenied("Dữ liệu liên quan nằm ngoài Data Scope được cấp.")
            except PermissionDenied:
                raise
            except Exception:
                pass

        item.read_at = item.read_at or timezone.now()
        item.save(update_fields=("read_at",))

        if not entity_available:
            return Response({
                "notification": self.get_serializer(item).data,
                "link": None,
                "available": False,
                "detail": "Nội dung liên quan không còn khả dụng.",
                "message": "Nội dung liên quan không còn khả dụng.",
            })

        return Response({
            "notification": self.get_serializer(item).data,
            "link": item.link or None,
            "available": True,
        })


class GlobalSearchView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(parameters=[], responses={200: dict})
    def get(self, request):
        serializer = SearchRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        account = services.iam_user(request)
        if account.status != ActiveStatus.ACTIVE or not request.user.is_active:
            sid = str(request.auth.get("sid", "")) if request.auth else ""
            if sid:
                UserLoginSession.objects.filter(pk=sid, user=request.user).update(
                    revoked_at=timezone.now(), revoke_reason="ACCOUNT_INACTIVE"
                )
            raise AuthenticationFailed({"detail": "Tài khoản không hoạt động hoặc đã bị vô hiệu hóa.", "code": "account_inactive"})

        company_id = serializer.validated_data.get("company") or getattr(
            getattr(account, "preference", None), "current_company_id", None
        )
        if not company_id:
            raise PermissionDenied("Bạn chưa có phạm vi làm việc hợp lệ. Vui lòng chọn doanh nghiệp.")
        company = Company.objects.filter(pk=company_id).first()
        if not company or company.status != ActiveStatus.ACTIVE:
            raise PermissionDenied("Doanh nghiệp đã ngừng hoạt động hoặc phạm vi không khả dụng.")

        branch_id = serializer.validated_data.get("branch")
        resolved_branch, _, _ = services._search_scope(account, company, branch_id)
        can_search = has_effective_permission(account, company, "COM.SEARCH.USE", branch_id=resolved_branch)
        if not can_search:
            can_search = any(
                services._source_permission(account, company, spec, resolved_branch)
                for spec in services.SEARCH_SOURCES.values()
            )
        if not can_search:
            raise PermissionDenied("Bạn không có quyền tìm kiếm toàn hệ thống.")

        try:
            return Response(services.global_search(
                company, serializer.validated_data["q"], account,
                group=serializer.validated_data.get("group"),
                date_from=serializer.validated_data.get("date_from"),
                date_to=serializer.validated_data.get("date_to"),
                status=serializer.validated_data.get("status"), branch_id=branch_id,
                page=serializer.validated_data["page"], page_size=serializer.validated_data["page_size"],
                preview_size=serializer.validated_data["preview_size"], request=request,
            ))
        except (APIException, drf_serializers.ValidationError):
            raise
        except Exception as exc:
            logger.exception("Global search error: %s", exc)
            error = APIException("Không thể tìm kiếm. Vui lòng thử lại sau.")
            error.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            raise error from exc


class GlobalSearchOpenView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=SearchOpenSerializer, responses={200: dict})
    def post(self, request):
        serializer = SearchOpenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = services.iam_user(request)
        if account.status != ActiveStatus.ACTIVE or not request.user.is_active:
            sid = str(request.auth.get("sid", "")) if request.auth else ""
            if sid:
                UserLoginSession.objects.filter(pk=sid, user=request.user).update(
                    revoked_at=timezone.now(), revoke_reason="ACCOUNT_INACTIVE"
                )
            raise AuthenticationFailed({"detail": "Tài khoản không hoạt động hoặc đã bị vô hiệu hóa.", "code": "account_inactive"})

        company_id = serializer.validated_data.get("company") or getattr(
            getattr(account, "preference", None), "current_company_id", None
        )
        if not company_id:
            raise PermissionDenied("Bạn chưa có phạm vi làm việc hợp lệ. Vui lòng chọn doanh nghiệp.")
        company = Company.objects.filter(pk=company_id).first()
        if not company or company.status != ActiveStatus.ACTIVE:
            raise PermissionDenied("Doanh nghiệp đã ngừng hoạt động hoặc phạm vi không khả dụng.")

        try:
            return Response(services.open_search_result(
                account, company, serializer.validated_data["entity_type"],
                serializer.validated_data["entity_id"], serializer.validated_data.get("branch"),
            ))
        except (APIException, drf_serializers.ValidationError):
            raise
        except Exception as exc:
            logger.exception("Global search open error: %s", exc)
            error = APIException("Không thể mở dữ liệu. Vui lòng thử lại sau.")
            error.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            raise error from exc


class WorkItemViewSet(ReadOnlyModelViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = WorkItemSerializer
    pagination_class = NotificationPagination
    queryset = WorkItem.objects.none()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        account = services.iam_user(request)
        if account.status != ActiveStatus.ACTIVE or not request.user.is_active:
            sid = str(request.auth.get("sid", "")) if request.auth else ""
            if sid:
                UserLoginSession.objects.filter(pk=sid, user=request.user).update(
                    revoked_at=timezone.now(), revoke_reason="ACCOUNT_INACTIVE"
                )
            raise AuthenticationFailed({"detail": "Tài khoản không hoạt động hoặc đã bị vô hiệu hóa.", "code": "account_inactive"})

    def get_queryset(self):
        account = services.iam_user(self.request)
        company_id = self.request.query_params.get("company_id") or getattr(
            getattr(account, "preference", None), "current_company_id", None
        )
        if not company_id:
            return WorkItem.objects.none()
        company = Company.objects.filter(pk=company_id).first()
        if not company or company.status != ActiveStatus.ACTIVE:
            raise PermissionDenied("Doanh nghiệp đã ngừng hoạt động hoặc phạm vi không khả dụng.")
        services.synchronize_work_items(company)
        queryset = services.visible_work_items(account, company, self.request.query_params.get("branch_id"))
        services.refresh_overdue_work_items(queryset)
        if task_type := self.request.query_params.get("task_type"):
            queryset = queryset.filter(task_type=task_type)
        if state := self.request.query_params.get("status"):
            queryset = queryset.filter(status=state.upper())
        if priority := self.request.query_params.get("priority"):
            queryset = queryset.filter(priority=priority.upper())
        if query := self.request.query_params.get("q"):
            queryset = queryset.filter(Q(title__icontains=query) | Q(reference_code__icontains=query))
        if due_from := self.request.query_params.get("due_from"):
            queryset = queryset.filter(due_at__date__gte=due_from)
        if due_to := self.request.query_params.get("due_to"):
            queryset = queryset.filter(due_at__date__lte=due_to)
        ordering = self.request.query_params.get("ordering", "priority")
        if ordering == "due_at":
            return queryset.order_by("due_at", "-created_at")
        if ordering == "created_at":
            return queryset.order_by("-created_at")
        priority_order = {"URGENT": 0, "HIGH": 1, "NORMAL": 2}
        from django.db.models import Case, IntegerField, Value, When
        return queryset.annotate(
            priority_rank=Case(
                *[When(priority=key, then=Value(value)) for key, value in priority_order.items()],
                default=Value(3), output_field=IntegerField(),
            ),
            status_rank=Case(
                When(status="OVERDUE", then=Value(0)), default=Value(1), output_field=IntegerField(),
            ),
        ).order_by("status_rank", "priority_rank", "due_at", "-created_at")

    @action(detail=False, methods=("get",))
    def count(self, request):
        count = self.get_queryset().filter(
            status__in=(WorkItem.Status.PENDING, WorkItem.Status.IN_PROGRESS, WorkItem.Status.OVERDUE)
        ).count()
        return Response({"count": count})

    @action(detail=True, methods=("post", "get"))
    def open(self, request, pk=None):
        item = services.open_work_item(self.get_object(), services.iam_user(request))
        return Response({"work_item": self.get_serializer(item).data, "link": item.link or None})

    @action(detail=True, methods=("get",))
    def history(self, request, pk=None):
        item = self.get_object()
        return Response(WorkItemHistorySerializer(item.history.select_related("actor"), many=True).data)


class DashboardView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(parameters=[], responses={200: dict})
    def get(self, request):
        serializer = DashboardRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        company = get_object_or_404(Company, pk=serializer.validated_data["company"])
        return Response(services.dashboard(company, services.iam_user(request), serializer.validated_data.get("date_from"), serializer.validated_data.get("date_to")))


class CompanySetupCompleteView(APIView):
    """Create the accounting foundations of a PENDING_SETUP company and activate it."""
    permission_classes = (CommonCompanyPermission,)
    iam_permissions = {"POST": "COM.SETTING.CONFIGURE"}

    def post(self, request):
        from organization.models import Company
        from .setup_services import complete_company_setup

        company = Company.objects.filter(pk=request.query_params.get("company_id") or request.data.get("company")).first()
        if not company:
            raise drf_serializers.ValidationError({"company": "Không tìm thấy doanh nghiệp."})
        return Response(complete_company_setup(company, services.iam_user(request), request))


class CompanySettingView(APIView):
    permission_classes = (CommonCompanyPermission,)
    serializer_class = CompanySettingSerializer
    iam_permissions = {"GET": "COM.SETTING.VIEW", "PATCH": "COM.SETTING.CONFIGURE"}

    def get(self, request):
        setting, _ = CoreCompanySetting.objects.get_or_create(company_id=request.query_params.get("company_id"))
        return Response(CompanySettingSerializer(setting).data)

    def patch(self, request):
        setting, _ = CoreCompanySetting.objects.get_or_create(company_id=request.data.get("company"))
        serializer = CompanySettingSerializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AIInteractionViewSet(ReadOnlyModelViewSet):
    permission_classes = (CommonCompanyPermission,)
    serializer_class = AIInteractionSerializer
    queryset = AIInteraction.objects.select_related("company", "user")
    iam_permissions = {"GET": "COM.AI.USE"}
    action_permissions = {
        "query": "COM.AI.USE", "confirm": "COM.AI.USE",
        "feedback": "COM.AI.USE", "source": "COM.AI.USE",
        "suggestions": "COM.AI.USE",
    }

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        account = services.iam_user(request)
        if account.status != ActiveStatus.ACTIVE or not request.user.is_active:
            sid = str(request.auth.get("sid", "")) if request.auth else ""
            if sid:
                UserLoginSession.objects.filter(pk=sid, user=request.user).update(
                    revoked_at=timezone.now(), revoke_reason="ACCOUNT_INACTIVE"
                )
            raise AuthenticationFailed({"detail": "Tài khoản không hoạt động hoặc đã bị vô hiệu hóa.", "code": "account_inactive"})

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        queryset = self.queryset.filter(company_id=company, user=services.iam_user(self.request)) if company else self.queryset.none()
        if conversation := self.request.query_params.get("conversation_id"):
            queryset = queryset.filter(conversation_id=conversation)
        return queryset

    @action(detail=False, methods=("get",))
    def suggestions(self, request):
        screen = (request.query_params.get("screen") or "default").lower()
        company_id = request.query_params.get("company_id")
        if company_id:
            company = get_object_or_404(Company, pk=company_id, status="ACTIVE")
            setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
            if not setting.ai_enabled:
                raise drf_serializers.ValidationError({"company": "Chức năng AI chưa được kích hoạt cho doanh nghiệp này."})
        mapping = {
            "dashboard": [
                "Tóm tắt tình hình tài chính của doanh nghiệp trong tháng này",
                "Có bao nhiêu công việc đang chờ xử lý?",
                "Doanh thu và chi phí kỳ này biến động như thế nào?",
            ],
            "purchases": [
                "Các đơn mua hàng đang chờ phê duyệt?",
                "Tình hình công nợ phải trả theo hạn thanh toán?",
            ],
            "payable": [
                "Các hóa đơn mua hàng sắp đến hạn thanh toán?",
                "Nhà cung cấp nào có số dư công nợ lớn nhất?",
            ],
            "sales": [
                "Doanh thu bán hàng tháng này so với tháng trước?",
                "Khách hàng nào có doanh số cao nhất?",
            ],
            "receivable": [
                "Các khoản phải thu quá hạn trong tháng này?",
                "Khách hàng nào có nợ quá hạn cao nhất?",
            ],
            "general_ledger": [
                "Giải thích biến động chi phí quản lý tháng này",
                "Có bút toán hoặc giao dịch nào bất thường không?",
            ],
            "tax": [
                "Kỳ tính thuế giá trị gia tăng tiếp theo là khi nào?",
                "Hướng dẫn lập tờ khai thuế GTGT",
            ],
            "reports": [
                "Tóm tắt báo cáo kết quả hoạt động kinh doanh",
                "So sánh chi phí hoạt động theo từng chi nhánh",
            ],
        }
        suggestions_list = mapping.get(screen, [
            "Tóm tắt tình hình công nợ của doanh nghiệp",
            "Các công việc cần xử lý hôm nay",
            "Hướng dẫn kiểm tra và đối chiếu số liệu kế toán",
        ])
        return Response({"screen": screen, "suggestions": suggestions_list})

    @action(detail=False, methods=("post",))
    def query(self, request):
        serializer = AIQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = get_object_or_404(Company, pk=serializer.validated_data["company"])
        interaction = services.ai_query(
            company, serializer.validated_data["question"], serializer.validated_data.get("context", {}), request,
            conversation_id=serializer.validated_data.get("conversation"),
            parent_id=serializer.validated_data.get("parent"),
            request_key=serializer.validated_data.get("request_id", ""),
            request_type=serializer.validated_data["request_type"],
        )
        response_status = status.HTTP_201_CREATED
        if interaction.status == "UNAVAILABLE":
            response_status = status.HTTP_503_SERVICE_UNAVAILABLE
        elif interaction.status == "DENIED":
            response_status = status.HTTP_403_FORBIDDEN
        return Response(self.get_serializer(interaction).data, status=response_status)

    @action(detail=True, methods=("post",))
    def confirm(self, request, pk=None):
        interaction = self.get_object()
        if interaction.status != "COMPLETED":
            raise drf_serializers.ValidationError("Chỉ kết quả hoàn thành mới được xác nhận.")
        interaction.confirmed_at = timezone.now()
        interaction.save(update_fields=("confirmed_at",))
        return Response(self.get_serializer(interaction).data)

    @action(detail=True, methods=("post",))
    def feedback(self, request, pk=None):
        serializer = AIFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = services.save_ai_feedback(
            self.get_object(), services.iam_user(request),
            serializer.validated_data["helpful"], serializer.validated_data.get("comment", ""),
        )
        return Response(AIFeedbackSerializer(item).data)

    @action(detail=True, methods=("post",), url_path=r"source/(?P<source_index>\d+)")
    def source(self, request, pk=None, source_index=None):
        return Response(services.open_ai_source(
            self.get_object(), services.iam_user(request), int(source_index)
        ))


class AIConversationViewSet(mixins.CreateModelMixin, ReadOnlyModelViewSet):
    permission_classes = (CommonCompanyPermission,)
    serializer_class = AIConversationSerializer
    queryset = AIConversation.objects.select_related("company", "branch", "user")
    iam_permissions = {"GET": "COM.AI.USE", "POST": "COM.AI.USE"}
    action_permissions = {"close": "COM.AI.USE"}

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        account = services.iam_user(request)
        if account.status != ActiveStatus.ACTIVE or not request.user.is_active:
            sid = str(request.auth.get("sid", "")) if request.auth else ""
            if sid:
                UserLoginSession.objects.filter(pk=sid, user=request.user).update(
                    revoked_at=timezone.now(), revoke_reason="ACCOUNT_INACTIVE"
                )
            raise AuthenticationFailed({"detail": "Tài khoản không hoạt động hoặc đã bị vô hiệu hóa.", "code": "account_inactive"})

    def get_queryset(self):
        company = self.request.query_params.get("company_id")
        return self.queryset.filter(company_id=company, user=services.iam_user(self.request)) if company else self.queryset.none()

    def create(self, request, *args, **kwargs):
        serializer = AIConversationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = get_object_or_404(Company, pk=serializer.validated_data["company"], status="ACTIVE")
        setting, _ = CoreCompanySetting.objects.get_or_create(company=company)
        if not setting.ai_enabled:
            raise drf_serializers.ValidationError({"company": "Chức năng AI chưa được kích hoạt cho doanh nghiệp này."})
        branch = None
        if serializer.validated_data.get("branch"):
            branch = get_object_or_404(Branch, pk=serializer.validated_data["branch"], company=company, status="ACTIVE")
        item = services.create_ai_conversation(
            company, services.iam_user(request), branch=branch,
            title=serializer.validated_data.get("title", ""),
        )
        return Response(self.get_serializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def close(self, request, pk=None):
        conversation = self.get_object()
        conversation.status = AIConversation.Status.CLOSED
        conversation.save(update_fields=("status", "updated_at"))
        return Response(self.get_serializer(conversation).data)
