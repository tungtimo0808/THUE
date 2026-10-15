from django.test import TestCase


class AuditModuleSmokeTests(TestCase):
    def test_audit_models_are_registered(self):
        from .models import AuditChange, AuditLog

        self.assertEqual(AuditLog._meta.db_table, "audit_audit_log")
        self.assertEqual(AuditChange._meta.db_table, "audit_audit_change")
