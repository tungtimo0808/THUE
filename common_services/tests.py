import re
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from unittest.mock import patch

from audit_log.models import AuditLog
from iam.models import CompanyMembership, DataScopeSet, Role, RolePermission, UserRoleAssignment
from master_data.models import Currency, Party
from organization.models import Branch, Company, OrganizationUnit

from . import services
from .models import (
    AIConversation, CompanyJoinRequest, CoreCompanySetting, Notification, UserLoginSession,
    VerificationChallenge, WorkItem, WorkItemHistory,
)


class CommonServicesApiTests(TestCase):
    def setUp(self):
        cache.clear()
        Currency.objects.get_or_create(code="VND", defaults={"name": "Đồng Việt Nam"})
        self.client = APIClient()

    def register_and_verify(self, username="new-user", email="new@example.com"):
        phone = f"09000{get_user_model().objects.count():05d}"
        response = self.client.post("/api/v1/common/auth/register/", {
            "username": username, "email": email, "display_name": "Người dùng mới",
            "phone": phone, "password": "StrongPass!2026", "password_confirm": "StrongPass!2026",
            "terms_accepted": True, "terms_version": "2026-01", "privacy_version": "2026-01",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["verification_required"])
        code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
        verified = self.client.post("/api/v1/common/auth/verify-registration/", {"challenge": response.data["challenge"], "code": code}, format="json")
        self.assertEqual(verified.status_code, 200, verified.data)
        return get_user_model().objects.get(username=username)

    def create_company(self, user, code="ACME", tax_code="0101234567", *, activate=True):
        self.client.force_authenticate(user)
        response = self.client.post("/api/v1/common/companies/create/", {
            "code": code, "name": f"Công ty {code}", "legal_name": f"Công ty {code}",
            "tax_code": tax_code, "business_type": "LLC_ONE_MEMBER",
            "address": "1 Tràng Tiền", "province": "Hà Nội",
            "legal_representative": "Nguyễn Văn A", "confirmed_authority": True,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        if activate:
            Company.objects.filter(pk=response.data["id"]).update(status="ACTIVE")
        return response.data

    def test_register_verify_login_logout_and_password_reset(self):
        user = self.register_and_verify()
        login = self.client.post("/api/v1/common/auth/login/", {"login": user.email, "password": "StrongPass!2026"}, format="json")
        self.assertEqual(login.status_code, 200, login.data)
        self.assertTrue(login.data["requires_company_setup"])
        self.assertIn("access", login.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        logout = self.client.post("/api/v1/common/auth/logout/", {"refresh": login.data["refresh"]}, format="json")
        self.assertEqual(logout.status_code, 204)
        self.assertEqual(self.client.get("/api/v1/common/profile/").status_code, 401)
        self.client.credentials()
        request_reset = self.client.post("/api/v1/common/auth/password-reset/request/", {"identifier": user.email}, format="json")
        self.assertEqual(request_reset.status_code, 202, request_reset.data)
        self.assertIn("challenge", request_reset.data)
        challenge = VerificationChallenge.objects.filter(user=user, purpose="PASSWORD_RESET").latest("created_at")
        self.assertEqual(request_reset.data["challenge"], str(challenge.id))
        reset_code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
        reset = self.client.post("/api/v1/common/auth/password-reset/confirm/", {"challenge": str(challenge.id), "code": reset_code, "new_password": "NewStrongPass!2026", "new_password_confirm": "NewStrongPass!2026"}, format="json")
        self.assertEqual(reset.status_code, 200, reset.data)
        self.assertTrue(self.client.login(username=user.username, password="NewStrongPass!2026"))

        reused = self.client.post("/api/v1/common/auth/reset-password/", {
            "challenge": str(challenge.id), "code": reset_code,
            "new_password": "AnotherStrongPass!2026", "new_password_confirm": "AnotherStrongPass!2026",
        }, format="json")
        self.assertEqual(reused.status_code, 400, reused.data)

    def test_forgot_password_does_not_disclose_unknown_account(self):
        before = len(mail.outbox)
        response = self.client.post("/api/v1/common/auth/forgot-password/", {
            "identifier": "unknown@example.com",
        }, format="json")

        self.assertEqual(response.status_code, 202, response.data)
        self.assertIn("challenge", response.data)
        challenge = VerificationChallenge.objects.get(pk=response.data["challenge"])
        self.assertIsNone(challenge.user)
        self.assertEqual(challenge.purpose, VerificationChallenge.Purpose.PASSWORD_RESET)
        self.assertEqual(len(mail.outbox), before)

    def test_company_bootstrap_profile_and_switch_context(self):
        user = self.register_and_verify()
        company = self.create_company(user, activate=False)
        created_company = Company.objects.get(pk=company["id"])
        self.assertEqual(created_company.status, "PENDING_SETUP")
        self.assertEqual(company["message"], "Doanh nghiệp đã được khởi tạo thành công.")
        self.assertEqual(company["next"], f"/company-setup/{created_company.id}")
        membership = CompanyMembership.objects.get(company_id=company["id"], user=user.iam_account)
        self.assertEqual(membership.membership_status, "ACTIVE")
        self.assertTrue(membership.role_assignments.filter(role__is_system_admin=True, status="ACTIVE").exists())
        setting = CoreCompanySetting.objects.get(company_id=company["id"])
        self.assertFalse(setting.configuration["setup_completed"])
        self.assertEqual(len(setting.configuration["required_steps"]), 5)
        self.assertTrue(AuditLog.objects.filter(company=created_company, action_code="CREATE_COMPANY").exists())
        admin_role = membership.role_assignments.get(role__is_system_admin=True).role
        accounting_risk_grants = admin_role.role_permissions.exclude(
            permission__code__startswith="SYS."
        ).exclude(permission__code__startswith="COM.").filter(
            permission__action__code__in=("APPROVE", "POST", "UNPOST", "REVERSE")
        )
        self.assertFalse(accounting_risk_grants.exists())
        self.assertTrue(admin_role.role_permissions.filter(permission__code="COM.SETTING.CONFIGURE").exists())
        self.client.force_authenticate(user=None)
        relogin = self.client.post("/api/v1/common/auth/login/", {
            "login": user.email, "password": "StrongPass!2026",
        }, format="json")
        self.assertEqual(relogin.status_code, 200, relogin.data)
        self.assertTrue(relogin.data["requires_company_setup"])
        self.assertEqual(relogin.data["setup_company"]["id"], company["id"])
        self.client.force_authenticate(user)
        companies = self.client.get("/api/v1/common/companies/mine/")
        self.assertEqual(companies.status_code, 200, companies.data)
        self.assertEqual(len(companies.data), 1)
        created_company.status = "ACTIVE"
        created_company.save(update_fields=("status", "updated_at"))
        switched = self.client.post("/api/v1/common/companies/switch/", {"company": company["id"], "confirm_discard": True}, format="json")
        self.assertEqual(switched.status_code, 200, switched.data)
        profile = self.client.patch("/api/v1/common/profile/", {"display_name": "Tên đã đổi"}, format="json")
        self.assertEqual(profile.status_code, 200, profile.data)
        self.assertEqual(profile.data["display_name"], "Tên đã đổi")

    def test_company_bootstrap_validates_required_data_confirmation_and_logo(self):
        user = self.register_and_verify()
        self.client.force_authenticate(user)
        invalid = self.client.post("/api/v1/common/companies/create/", {
            "legal_name": "Công ty Thiếu", "tax_code": "123",
            "business_type": "LLC_ONE_MEMBER", "address": "", "province": "",
            "legal_representative": "", "confirmed_authority": False,
        }, format="json")
        self.assertEqual(invalid.status_code, 400, invalid.data)
        self.assertIn("tax_code", invalid.data)
        self.assertIn("confirmed_authority", invalid.data)
        self.assertEqual(Company.objects.count(), 0)

        bad_logo = SimpleUploadedFile("logo.gif", b"GIF89a-not-supported", content_type="image/gif")
        invalid_logo = self.client.post("/api/v1/common/companies/create/", {
            "legal_name": "Công ty Logo", "tax_code": "0107654321",
            "business_type": "JOINT_STOCK", "address": "1 Lê Lợi", "province": "TP Hồ Chí Minh",
            "legal_representative": "Trần Văn B", "confirmed_authority": True, "logo": bad_logo,
        }, format="multipart")
        self.assertEqual(invalid_logo.status_code, 400, invalid_logo.data)
        self.assertIn("logo", invalid_logo.data)
        self.assertEqual(Company.objects.count(), 0)

    def test_company_bootstrap_requires_verified_active_authorized_account(self):
        user = self.register_and_verify()
        preference = user.iam_account.preference
        preference.email_verified_at = None
        preference.save(update_fields=("email_verified_at", "updated_at"))
        self.client.force_authenticate(user)
        payload = {
            "legal_name": "Công ty Quyền", "tax_code": "0107654322",
            "business_type": "PRIVATE_ENTERPRISE", "address": "2 Lê Lợi", "province": "Đà Nẵng",
            "legal_representative": "Lê Văn C", "confirmed_authority": True,
        }
        unverified = self.client.post("/api/v1/common/companies/create/", payload, format="json")
        self.assertEqual(unverified.status_code, 403, unverified.data)

        preference.email_verified_at = timezone.now()
        preference.save(update_fields=("email_verified_at", "updated_at"))
        user.iam_account.can_create_company = False
        user.iam_account.save(update_fields=("can_create_company", "updated_at"))
        unauthorized = self.client.post("/api/v1/common/companies/create/", payload, format="json")
        self.assertEqual(unauthorized.status_code, 403, unauthorized.data)

        user.iam_account.can_create_company = True
        user.iam_account.save(update_fields=("can_create_company", "updated_at"))
        user.is_active = False
        user.save(update_fields=("is_active",))
        inactive = self.client.post("/api/v1/common/companies/create/", payload, format="json")
        self.assertEqual(inactive.status_code, 403, inactive.data)
        self.assertEqual(Company.objects.count(), 0)

    def test_company_bootstrap_rejects_duplicate_tax_code_and_rolls_back(self):
        user = self.register_and_verify()
        self.create_company(user, "FIRST", "0107654323", activate=False)
        duplicate = self.client.post("/api/v1/common/companies/create/", {
            "code": "SECOND", "legal_name": "Công ty Trùng", "tax_code": "0107654323",
            "business_type": "PARTNERSHIP", "address": "3 Lê Lợi", "province": "Huế",
            "legal_representative": "Phạm Văn D", "confirmed_authority": True,
        }, format="json")
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        self.assertIn("gửi yêu cầu tham gia", str(duplicate.data["tax_code"]))
        self.assertEqual(Company.objects.count(), 1)

        payload = {
            "code": "ROLLBACK", "legal_name": "Công ty Rollback", "tax_code": "0107654324",
            "business_type": "OTHER", "address": "4 Lê Lợi", "province": "Cần Thơ",
            "legal_representative": "Võ Văn E", "confirmed_authority": True,
        }
        with patch("common_services.services.Role.objects.create", side_effect=RuntimeError("role failure")):
            failed = self.client.post("/api/v1/common/companies/create/", payload, format="json")
        self.assertEqual(failed.status_code, 500, failed.data)
        self.assertEqual(failed.data["detail"], "Không thể khởi tạo doanh nghiệp. Vui lòng thử lại sau.")
        self.assertFalse(Company.objects.filter(tax_code="0107654324").exists())
        self.assertEqual(CompanyMembership.objects.count(), 1)

    def test_join_request_approval_and_notification_ownership(self):
        owner = self.register_and_verify("owner", "owner@example.com")
        company = self.create_company(owner, "JOINCO", "0101234568")
        applicant = self.register_and_verify("applicant", "applicant@example.com")
        self.client.force_authenticate(applicant)
        created = self.client.post("/api/v1/common/join-requests/", {"company": company["id"], "message": "Xin tham gia"}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        duplicate = self.client.post("/api/v1/common/join-requests/", {"company": company["id"]}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        self.client.force_authenticate(owner)
        pending = self.client.get(f"/api/v1/common/company-join-requests/?company_id={company['id']}&status=PENDING")
        self.assertEqual(pending.status_code, 200, pending.data)
        decided = self.client.post(f"/api/v1/common/company-join-requests/{created.data['id']}/decide/?company_id={company['id']}", {"company": company["id"], "decision": "APPROVED", "reason": "Đồng ý"}, format="json")
        self.assertEqual(decided.status_code, 200, decided.data)
        self.assertTrue(CompanyMembership.objects.filter(company_id=company["id"], user=applicant.iam_account, membership_status="ACTIVE").exists())
        self.client.force_authenticate(applicant)
        notices = self.client.get(f"/api/v1/common/notifications/?company_id={company['id']}")
        self.assertEqual(notices.status_code, 200, notices.data)
        self.assertGreaterEqual(len(notices.data["results"]), 1)
        target = next(item for item in notices.data["results"] if item["entity_id"] == created.data["id"])
        read = self.client.post(f"/api/v1/common/notifications/{target['id']}/read/", {}, format="json")
        self.assertIsNotNone(read.data["read_at"])

    def test_join_request_rejection_requires_reason_and_keeps_membership_absent(self):
        owner = self.register_and_verify("reject-owner", "reject-owner@example.com")
        company = self.create_company(owner, "REJECTCO", "0101234570")
        applicant = self.register_and_verify("reject-applicant", "reject-applicant@example.com")
        self.client.force_authenticate(applicant)
        created = self.client.post("/api/v1/common/join-requests/", {"company": company["id"]}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        url = f"/api/v1/common/company-join-requests/{created.data['id']}/decide/?company_id={company['id']}"
        self.client.force_authenticate(owner)
        missing = self.client.post(url, {"decision": "REJECTED"}, format="json")
        self.assertEqual(missing.status_code, 400, missing.data)
        self.assertEqual(CompanyJoinRequest.objects.get(pk=created.data["id"]).status, "PENDING")
        rejected = self.client.post(url, {
            "decision": "REJECTED", "reason": "Không phù hợp", "internal_note": "Chỉ dùng nội bộ",
        }, format="json")
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(rejected.data["status"], "REJECTED")
        self.assertEqual(rejected.data["internal_note"], "Chỉ dùng nội bộ")
        self.assertFalse(CompanyMembership.objects.filter(company_id=company["id"], user=applicant.iam_account).exists())
        self.assertEqual(self.client.post(url, {"decision": "APPROVED"}, format="json").status_code, 400)
        self.client.force_authenticate(applicant)
        mine = self.client.get(f"/api/v1/common/join-requests/{created.data['id']}/")
        self.assertEqual(mine.status_code, 200, mine.data)
        self.assertNotIn("internal_note", mine.data)
        self.assertNotIn("decision_snapshot", mine.data)

    def test_join_request_approval_is_atomic_and_notification_failure_is_tolerated(self):
        owner = self.register_and_verify("atomic-owner", "atomic-owner@example.com")
        company = self.create_company(owner, "ATOMICCO", "0101234571")
        applicant = self.register_and_verify("atomic-applicant", "atomic-applicant@example.com")
        self.client.force_authenticate(applicant)
        created = self.client.post("/api/v1/common/join-requests/", {"company": company["id"]}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        url = f"/api/v1/common/company-join-requests/{created.data['id']}/decide/?company_id={company['id']}"
        self.client.force_authenticate(owner)
        with patch("common_services.services.record_audit", side_effect=RuntimeError("audit failure")):
            with self.assertRaises(RuntimeError):
                self.client.post(url, {"decision": "APPROVED"}, format="json")
        self.assertEqual(CompanyJoinRequest.objects.get(pk=created.data["id"]).status, "PENDING")
        self.assertFalse(CompanyMembership.objects.filter(company_id=company["id"], user=applicant.iam_account).exists())
        with patch("common_services.services.create_notification", side_effect=RuntimeError("notification failure")):
            approved = self.client.post(url, {"decision": "APPROVED"}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertTrue(CompanyMembership.objects.filter(company_id=company["id"], user=applicant.iam_account, membership_status="ACTIVE").exists())
        self.assertTrue(AuditLog.objects.filter(company_id=company["id"], action_code="APPROVED").exists())

    def test_join_request_rejects_invalid_role_and_inactive_requester(self):
        owner = self.register_and_verify("role-owner", "role-owner@example.com")
        company = self.create_company(owner, "ROLECO", "0101234572")
        applicant = self.register_and_verify("role-applicant", "role-applicant@example.com")
        self.client.force_authenticate(applicant)
        created = self.client.post("/api/v1/common/join-requests/", {"company": company["id"]}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        url = f"/api/v1/common/company-join-requests/{created.data['id']}/decide/?company_id={company['id']}"
        self.client.force_authenticate(owner)
        invalid = self.client.post(url, {"decision": "APPROVED", "role_assignments": [{"role": "00000000-0000-0000-0000-000000000000"}]}, format="json")
        self.assertEqual(invalid.status_code, 400, invalid.data)
        self.assertFalse(CompanyMembership.objects.filter(company_id=company["id"], user=applicant.iam_account).exists())
        applicant.is_active = False
        applicant.save(update_fields=("is_active",))
        inactive = self.client.post(url, {"decision": "APPROVED"}, format="json")
        self.assertEqual(inactive.status_code, 400, inactive.data)
        self.assertEqual(CompanyJoinRequest.objects.get(pk=created.data["id"]).status, "PENDING")

    def test_join_request_assigns_explicit_role_unit_and_scope(self):
        owner = self.register_and_verify("grant-owner", "grant-owner@example.com")
        company = self.create_company(owner, "GRANTCO", "0101234573")
        applicant = self.register_and_verify("grant-applicant", "grant-applicant@example.com")
        company_object = Company.objects.get(pk=company["id"])
        role = Role.objects.create(company=company_object, code="STAFF", name="Nhân viên")
        unit = OrganizationUnit.objects.create(
            company=company_object, unit_type="DEPARTMENT", code="SALES", name="Kinh doanh",
            start_date=timezone.localdate(), created_by_user_id=owner.iam_account.pk,
            updated_by_user_id=owner.iam_account.pk,
        )
        scope = DataScopeSet.objects.create(
            company=company_object, code="STAFF_SCOPE", name="Phạm vi nhân viên",
            created_by=owner.iam_account,
        )
        self.client.force_authenticate(applicant)
        created = self.client.post("/api/v1/common/join-requests/", {"company": company["id"]}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.client.force_authenticate(owner)
        approved = self.client.post(
            f"/api/v1/common/company-join-requests/{created.data['id']}/decide/?company_id={company['id']}",
            {"decision": "APPROVED", "organization_unit": str(unit.pk),
             "role_assignments": [{"role": str(role.pk), "data_scope_set": str(scope.pk)}]},
            format="json",
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        membership = CompanyMembership.objects.get(company=company_object, user=applicant.iam_account)
        self.assertEqual(membership.organization_unit_id, unit.pk)
        assignment = UserRoleAssignment.objects.get(company_membership=membership)
        self.assertEqual(assignment.role_id, role.pk)
        self.assertEqual(assignment.data_scope_set_id, scope.pk)
        self.assertEqual(approved.data["decision_snapshot"]["roles"][0]["role_id"], str(role.pk))

    def test_join_request_reject_permission_is_independent_of_approve(self):
        owner = self.register_and_verify("permission-owner", "permission-owner@example.com")
        company = self.create_company(owner, "PERMCO", "0101234574")
        applicant = self.register_and_verify("permission-applicant", "permission-applicant@example.com")
        self.client.force_authenticate(applicant)
        created = self.client.post("/api/v1/common/join-requests/", {"company": company["id"]}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        RolePermission.objects.filter(
            role__company_id=company["id"], permission__code="COM.JOIN_REQUEST.REJECT"
        ).delete()
        self.client.force_authenticate(owner)
        url = f"/api/v1/common/company-join-requests/{created.data['id']}/decide/?company_id={company['id']}"
        denied = self.client.post(url, {"decision": "REJECTED", "reason": "Không phù hợp"}, format="json")
        self.assertEqual(denied.status_code, 403, denied.data)
        self.assertEqual(CompanyJoinRequest.objects.get(pk=created.data["id"]).status, "PENDING")
        approved = self.client.post(url, {"decision": "APPROVED"}, format="json")
        self.assertEqual(approved.status_code, 200, approved.data)

    def test_dashboard_search_and_ai_fallback(self):
        user = self.register_and_verify()
        company = self.create_company(user, "AICO", "0101234569")
        self.client.force_authenticate(user)
        dashboard = self.client.get(f"/api/v1/common/dashboard/?company={company['id']}")
        self.assertEqual(dashboard.status_code, 200, dashboard.data)
        self.assertIn("updated_at", dashboard.data)
        too_short = self.client.get(f"/api/v1/common/search/?company={company['id']}&q=a")
        self.assertEqual(too_short.status_code, 400)
        search = self.client.get(f"/api/v1/common/search/?company={company['id']}&q=khongco")
        self.assertEqual(search.status_code, 200, search.data)
        unavailable = self.client.post("/api/v1/common/ai/query/", {"company": company["id"], "question": "Phân tích tình hình hiện tại"}, format="json")
        self.assertEqual(unavailable.status_code, 503, unavailable.data)
        self.assertEqual(unavailable.data["status"], "UNAVAILABLE")
        setting = CoreCompanySetting.objects.get(company_id=company["id"])
        setting.ai_enabled = True
        setting.save(update_fields=("ai_enabled", "updated_at"))
        no_data = self.client.post("/api/v1/common/ai/query/", {"company": company["id"], "question": "Phân tích tình hình hiện tại"}, format="json")
        self.assertEqual(no_data.status_code, 201, no_data.data)
        self.assertEqual(no_data.data["status"], "INSUFFICIENT_DATA")

    def test_logout_only_revokes_current_device_session(self):
        user = self.register_and_verify()
        first = self.client.post("/api/v1/common/auth/login/", {"login": user.email, "password": "StrongPass!2026"}, format="json").data
        second = self.client.post("/api/v1/common/auth/login/", {"login": user.email, "password": "StrongPass!2026"}, format="json").data

        first_client = APIClient()
        first_client.credentials(HTTP_AUTHORIZATION=f"Bearer {first['access']}")
        self.assertEqual(first_client.post("/api/v1/common/auth/logout/", {"refresh": first["refresh"]}, format="json").status_code, 204)
        self.assertEqual(first_client.get("/api/v1/common/profile/").status_code, 401)

        second_client = APIClient()
        second_client.credentials(HTTP_AUTHORIZATION=f"Bearer {second['access']}")
        self.assertEqual(second_client.get("/api/v1/common/profile/").status_code, 200)

    def test_change_password_keeps_current_session_and_revokes_other_sessions(self):
        user = self.register_and_verify()
        current = self.client.post("/api/v1/common/auth/login/", {"login": user.email, "password": "StrongPass!2026"}, format="json").data
        other = self.client.post("/api/v1/common/auth/login/", {"login": user.email, "password": "StrongPass!2026"}, format="json").data
        current_client = APIClient()
        current_client.credentials(HTTP_AUTHORIZATION=f"Bearer {current['access']}")
        changed = current_client.post("/api/v1/common/auth/change-password/", {
            "current_password": "StrongPass!2026",
            "new_password": "ChangedPass!2026",
            "new_password_confirm": "ChangedPass!2026",
        }, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(current_client.get("/api/v1/common/profile/").status_code, 200)
        other_client = APIClient()
        other_client.credentials(HTTP_AUTHORIZATION=f"Bearer {other['access']}")
        self.assertEqual(other_client.get("/api/v1/common/profile/").status_code, 401)
        self.assertTrue(UserLoginSession.objects.filter(pk=current["session"], revoked_at__isnull=True).exists())

    def test_registration_requires_consent_and_resend_has_cooldown(self):
        rejected = self.client.post("/api/v1/common/auth/register/", {
            "email": "terms@example.com", "display_name": "Terms User",
            "password": "StrongPass!2026", "password_confirm": "StrongPass!2026",
            "terms_accepted": False,
        }, format="json")
        self.assertEqual(rejected.status_code, 400)
        created = self.client.post("/api/v1/common/auth/register/", {
            "username": "otp-user", "email": "otp@example.com", "display_name": "OTP User",
            "phone": "0901234588",
            "password": "StrongPass!2026", "password_confirm": "StrongPass!2026",
            "terms_accepted": True,
        }, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        response = self.client.post("/api/v1/common/auth/resend-verification/", {"challenge": created.data["challenge"]}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_branch_scope_and_notification_state_actions(self):
        user = self.register_and_verify()
        company_data = self.create_company(user, "SCOPECO", "0101234570")
        company = Company.objects.get(pk=company_data["id"])
        Branch.objects.create(company=company, code="HCM", name="Chi nhánh HCM")

        scopes = self.client.get("/api/v1/common/scopes/")
        self.assertEqual(scopes.status_code, 200, scopes.data)
        self.assertTrue(scopes.data["scopes"][0]["all_branches_allowed"])
        self.assertEqual(len(scopes.data["scopes"][0]["branches"]), 2)
        switched = self.client.post("/api/v1/common/companies/switch/", {
            "company": company_data["id"], "all_branches": True, "confirm_discard": True,
        }, format="json")
        self.assertEqual(switched.status_code, 200, switched.data)
        self.assertTrue(switched.data["all_branches"])

        notice = Notification.objects.create(
            recipient=user.iam_account, company=company, title="Kiểm tra", message="Nội dung",
        )
        count = self.client.get(f"/api/v1/common/notifications/unread-count/?company_id={company.id}")
        self.assertEqual(count.data["count"], 1)
        read = self.client.post(f"/api/v1/common/notifications/{notice.id}/read/", {}, format="json")
        self.assertEqual(read.data["status"], "READ")
        unread = self.client.post(f"/api/v1/common/notifications/{notice.id}/unread/", {}, format="json")
        self.assertEqual(unread.data["status"], "UNREAD")
        archived = self.client.post(f"/api/v1/common/notifications/{notice.id}/archive/", {}, format="json")
        self.assertEqual(archived.status_code, 204)

    def test_profile_email_is_read_only(self):
        user = self.register_and_verify()
        self.client.force_authenticate(user)
        response = self.client.patch("/api/v1/common/profile/", {"email": "other@example.com"}, format="json")
        self.assertEqual(response.status_code, 400)
        user.refresh_from_db()
        self.assertEqual(user.email, "new@example.com")

    def test_global_search_is_accent_insensitive_and_rechecks_access(self):
        user = self.register_and_verify()
        company_data = self.create_company(user, "SEARCHCO", "0101234571")
        company = Company.objects.get(pk=company_data["id"])
        party = Party.objects.create(
            company=company, code="KH-ANH", name="Khách hàng Ánh Dương", tax_code="0109988776",
        )
        response = self.client.get(f"/api/v1/common/search/?company={company.id}&q=anh%20duong")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["groups"]["parties"]["items"][0]["id"], str(party.id))
        opened = self.client.post("/api/v1/common/search/open/", {
            "company": str(company.id), "entity_type": "master_data.Party", "entity_id": str(party.id),
        }, format="json")
        self.assertEqual(opened.status_code, 200, opened.data)

    def test_work_items_are_scoped_overdue_and_have_history(self):
        user = self.register_and_verify()
        company_data = self.create_company(user, "TASKCO", "0101234572")
        company = Company.objects.get(pk=company_data["id"])
        party = Party.objects.create(company=company, code="KH-TASK", name="Khách hàng công việc")
        item = services.create_work_item(
            company=company, title="Kiểm tra hồ sơ khách hàng", task_type="REVIEW",
            entity=party, permission_code="MD.PARTY.VIEW", dedupe_key=f"party-review:{party.id}",
            assignee=user.iam_account, created_by=user.iam_account,
            due_at=timezone.now() - timedelta(hours=1),
        )
        duplicate = services.create_work_item(
            company=company, title="Không tạo trùng", task_type="REVIEW",
            entity=party, permission_code="MD.PARTY.VIEW", dedupe_key=f"party-review:{party.id}",
            assignee=user.iam_account,
        )
        self.assertEqual(item.id, duplicate.id)
        listed = self.client.get(f"/api/v1/common/work-items/?company_id={company.id}")
        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(listed.data["results"][0]["status"], "OVERDUE")
        opened = self.client.post(f"/api/v1/common/work-items/{item.id}/open/?company_id={company.id}", {}, format="json")
        self.assertEqual(opened.status_code, 200, opened.data)
        self.assertGreaterEqual(WorkItemHistory.objects.filter(work_item=item).count(), 2)
        with self.assertRaises(ValidationError):
            services.transition_work_item(item, WorkItem.Status.COMPLETED, actor=user.iam_account)

    def test_ai_conversation_idempotency_context_redaction_and_feedback(self):
        user = self.register_and_verify()
        company_data = self.create_company(user, "AICHAT", "0101234573")
        company = Company.objects.get(pk=company_data["id"])
        setting = CoreCompanySetting.objects.get(company=company)
        setting.ai_enabled = True
        setting.save(update_fields=("ai_enabled", "updated_at"))
        conversation = self.client.post("/api/v1/common/ai-conversations/", {
            "company": str(company.id), "title": "Phân tích tháng",
        }, format="json")
        self.assertEqual(conversation.status_code, 201, conversation.data)
        payload = {
            "company": str(company.id), "conversation": conversation.data["id"],
            "question": "Hướng dẫn tôi kiểm tra số liệu", "request_type": "GUIDANCE",
            "request_id": "same-request", "context": {"password": "secret", "screen": "dashboard"},
        }
        first = self.client.post("/api/v1/common/ai/query/", payload, format="json")
        second = self.client.post("/api/v1/common/ai/query/", payload, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(first.data["context"]["password"], "[REDACTED]")
        feedback = self.client.post(
            f"/api/v1/common/ai/{first.data['id']}/feedback/?company_id={company.id}",
            {"helpful": True, "comment": "Hữu ích"}, format="json",
        )
        self.assertEqual(feedback.status_code, 200, feedback.data)
        self.assertTrue(feedback.data["helpful"])
        self.assertEqual(AIConversation.objects.get(pk=conversation.data["id"]).user, user.iam_account)
