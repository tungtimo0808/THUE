import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth import get_user_model
from organization.models import Company
from master_data.views import ItemViewSet, PartyViewSet
from cash_management.views import TransactionViewSet
from general_ledger.views import JournalViewSet
from master_data.models import Item, Party
from cash_management.models import CashTransaction
from general_ledger.models import JournalEntry

User = get_user_model()

def run_idor_test():
    ub = User.objects.get(username="loadtest_c02_u01")
    comp_a = Company.objects.get(code="ABC")
    comp_b = Company.objects.get(code="SOVIET_272")
    f = APIRequestFactory()

    tests = [
        ("Item", Item.objects.filter(company=comp_a).first(), ItemViewSet),
        ("Party", Party.objects.filter(company=comp_a).first(), PartyViewSet),
        ("Cash Tx", CashTransaction.objects.filter(company=comp_a).first(), TransactionViewSet),
        ("Journal Entry", JournalEntry.objects.filter(company=comp_a).first(), JournalViewSet),
    ]

    for name, obj, vs in tests:
        if not obj:
            print(f"Skipping {name}: no object in Comp A")
            continue
        print(f"\n--- Testing {name} (ID: {obj.id}) ---")
        for param_desc, q in [
            ("No company_id", ""),
            ("Comp A ID (?company_id=comp_a.id)", f"?company_id={comp_a.id}"),
            ("Comp B ID (?company_id=comp_b.id)", f"?company_id={comp_b.id}")
        ]:
            req = f.get(f"/{obj.id}/{q}")
            force_authenticate(req, user=ub)
            try:
                resp = vs.as_view({"get": "retrieve"})(req, pk=str(obj.id))
                data = getattr(resp, "data", None)
                print(f"  [{param_desc}] -> Status: {resp.status_code}, Response: {str(data)[:100]}")
            except Exception as e:
                print(f"  [{param_desc}] -> Exception: {type(e).__name__}: {e}")

if __name__ == "__main__":
    run_idor_test()
