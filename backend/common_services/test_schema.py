from django.test import SimpleTestCase
from drf_spectacular.generators import SchemaGenerator


class ResourceGroupedSchemaTests(SimpleTestCase):
    def test_accounts_payable_resources_have_separate_tags(self):
        schema = SchemaGenerator().get_schema(request=None, public=True)

        invoice = schema["paths"]["/api/v1/accounts-payable/invoices/"]["get"]
        adjustment = schema["paths"]["/api/v1/accounts-payable/adjustments/"]["get"]
        approval = schema["paths"]["/api/v1/accounts-payable/approvals/"]["get"]

        self.assertEqual(invoice["tags"], ["Accounts Payable / Invoices"])
        self.assertEqual(adjustment["tags"], ["Accounts Payable / Adjustments"])
        self.assertEqual(approval["tags"], ["Accounts Payable / Approvals"])

    def test_resource_actions_stay_in_their_resource_section(self):
        schema = SchemaGenerator().get_schema(request=None, public=True)

        approve = schema["paths"]["/api/v1/accounts-payable/invoices/{id}/approve/"]["post"]

        self.assertEqual(approve["tags"], ["Accounts Payable / Invoices"])
