from datetime import date

from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.exceptions import ValidationError

from common_services.document_lock_services import assert_not_locked, auto_lock_date
from common_services.test_company_setup import FounderCompanyMixin


class AutoLockDateTests(SimpleTestCase):
    def test_previous_month_locks_once_the_lock_day_is_reached(self):
        rule = {"auto_lock": {"enabled": True, "day": 20}}
        self.assertEqual(auto_lock_date(rule, date(2026, 10, 20)), date(2026, 9, 30))
        self.assertEqual(auto_lock_date(rule, date(2026, 10, 19)), date(2026, 8, 31))
        self.assertEqual(auto_lock_date(rule, date(2026, 1, 5)), date(2025, 11, 30))

    def test_end_of_month_rule_and_disabled_rule(self):
        self.assertEqual(auto_lock_date({"auto_lock": {"enabled": True, "day": "END"}}, date(2026, 2, 28)), date(2026, 1, 31))
        self.assertIsNone(auto_lock_date({"auto_lock": {"enabled": False, "day": 15}}, date(2026, 2, 28)))


@override_settings(COMMON_REQUIRE_VERIFICATION=False)
class DocumentLockApiTests(FounderCompanyMixin, TestCase):
    """Reuses the founder/company fixture of the setup tests."""

    def test_saved_lock_blocks_documents_on_or_before_the_lock_date(self):
        url = f"/api/v1/common/document-locks/?company_id={self.company.pk}"
        saved = self.client.put(url, {"company": str(self.company.pk), "locks": [
            {"code": "PC", "locked": True, "lock_date": "2026-09-30"},
            {"code": "PT", "locked": False, "lock_date": "2026-09-30"},
        ], "auto_lock": {"enabled": False, "day": 20}}, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual({row["code"]: row["locked"] for row in saved.data["locks"]}["PC"], True)
        with self.assertRaises(ValidationError):
            assert_not_locked(self.company, "PC", date(2026, 9, 30))
        assert_not_locked(self.company, "PC", date(2026, 10, 1))
        assert_not_locked(self.company, "PT", date(2026, 9, 1))

    def test_invalid_lock_type_is_rejected(self):
        url = f"/api/v1/common/document-locks/?company_id={self.company.pk}"
        response = self.client.put(url, {"company": str(self.company.pk), "locks": [{"code": "XYZ", "locked": True, "lock_date": "2026-09-30"}]}, format="json")
        self.assertEqual(response.status_code, 400)
