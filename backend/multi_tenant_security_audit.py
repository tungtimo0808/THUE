import os
import sys
import django
import json
import traceback

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.urls import get_resolver
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSetMixin
from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth import get_user_model
from organization.models import Company
from iam.models import UserAccount, CompanyMembership
from django.apps import apps

User = get_user_model()

def run_isolated_tenant_audit():
    print("=====================================================================")
    print("      DEEP ISOLATION & LEAKAGE AUDIT (STRICT MULTI-TENANCY)         ")
    print("=====================================================================")

    user_a = User.objects.filter(username="loadtest_c01_u01").first()
    user_b = User.objects.filter(username="loadtest_c02_u01").first()

    if not user_a or not user_b:
        print("[!] ERROR: loadtest_c01_u01 or loadtest_c02_u01 not found.")
        return

    comp_a = CompanyMembership.objects.filter(user__auth_user=user_a, membership_status="ACTIVE").first().company
    comp_b = CompanyMembership.objects.filter(user__auth_user=user_b, membership_status="ACTIVE").first().company

    print(f"[*] Tenant A: {comp_a.name} ({comp_a.code}) - ID: {comp_a.id}")
    print(f"    User A: {user_a.username} (Superuser: {user_a.is_superuser})")
    print(f"[*] Tenant B: {comp_b.name} ({comp_b.code}) - ID: {comp_b.id}")
    print(f"    User B: {user_b.username} (Superuser: {user_b.is_superuser})")

    factory = APIRequestFactory()

    # 1. TEST DIRECT DATA ACCESSIBILITY ACROSS VIEWSETS
    # We will test all major business modules:
    # - accounts_payable
    # - accounts_receivable
    # - cash_management
    # - bank_management
    # - general_ledger
    # - purchases
    # - sales
    # - inventory
    # - fixed_assets
    # - payroll
    # - tax_management
    # - master_data
    # - organization
    # - audit_log
    # - common_services

    # Extract all viewsets registered
    resolver = get_resolver()
    routes = []

    def extract_urls(urlpatterns, prefix=""):
        for pattern in urlpatterns:
            if hasattr(pattern, "url_patterns"):
                extract_urls(pattern.url_patterns, prefix + str(pattern.pattern))
            else:
                routes.append((prefix + str(pattern.pattern), pattern.callback))

    extract_urls(resolver.url_patterns)

    api_routes = [(p, cb) for p, cb in routes if p.startswith("api/v1/")]
    print(f"[*] Total API v1 routes: {len(api_routes)}")

    PUBLIC_PATHS = [
        "api/v1/auth/login/",
        "api/v1/auth/register/",
        "api/v1/auth/verify-registration/",
        "api/v1/auth/resend-verification/",
        "api/v1/auth/password-reset/request/",
        "api/v1/auth/password-reset/verify-otp/",
        "api/v1/auth/password-reset/confirm/",
        "api/v1/auth/confirm-email/",
        "api/v1/auth/token/refresh/",
        "api/v1/schema/",
        "api/v1/docs/",
    ]

    cross_tenant_leaks = []
    missing_scope_leaks = []
    idor_leaks = []
    tested_count = 0

    print("\n--- PHASE 1: LIST / COLLECTION ENDPOINT AUDIT ---")
    for path, callback in api_routes:
        if "<" in path or "(?P<" in path:
            continue
        if any(path.startswith(p) for p in PUBLIC_PATHS):
            continue

        url = "/" + path
        tested_count += 1

        # Test 1: User A calls endpoint with Tenant B ID (?company_id=<comp_b.id>)
        # User A has ZERO rights in Tenant B. This must NOT return Tenant B's data!
        for param_name in ["company_id", "company"]:
            req = factory.get(f"{url}?{param_name}={comp_b.id}")
            force_authenticate(req, user=user_a)
            try:
                resp = callback(req)
                if resp.status_code == 200:
                    data = getattr(resp, "data", None)
                    records = []
                    if isinstance(data, list):
                        records = data
                    elif isinstance(data, dict):
                        records = data.get("results", []) or data.get("items", [])
                    
                    if records:
                        # Cross-tenant data exposed!
                        cross_tenant_leaks.append({
                            "path": path,
                            "query_param": param_name,
                            "status": 200,
                            "record_count": len(records),
                            "sample": str(records[0])[:150]
                        })
                        break
            except Exception:
                pass

        # Test 2: User A calls endpoint with NO company_id parameter
        # If the view defaults to all() or queryset without filtering, it may return Tenant B data
        req_none = factory.get(url)
        force_authenticate(req_none, user=user_a)
        try:
            resp_none = callback(req_none)
            if resp_none.status_code == 200:
                data = getattr(resp_none, "data", None)
                records = []
                if isinstance(data, list):
                    records = data
                elif isinstance(data, dict):
                    records = data.get("results", []) or data.get("items", [])
                
                if records:
                    # Check if any record belongs to Tenant B
                    tenant_b_found = False
                    for r in records[:50]:
                        if isinstance(r, dict):
                            cid = str(r.get("company") or r.get("company_id") or "")
                            if cid == str(comp_b.id):
                                tenant_b_found = True
                                break
                    if tenant_b_found:
                        missing_scope_leaks.append({
                            "path": path,
                            "status": 200,
                            "reason": "Exposes Tenant B data when company_id is omitted"
                        })
        except Exception:
            pass

    print(f"[*] Tested {tested_count} list endpoints.")
    print(f"[*] Cross-tenant list leaks found: {len(cross_tenant_leaks)}")
    print(f"[*] Missing scope multi-tenant leaks found: {len(missing_scope_leaks)}")

    print("\n--- PHASE 2: IDOR / DIRECT OBJECT ACCESS AUDIT ---")
    # For key business models, we find an object belonging to Tenant B,
    # and User A attempts to directly GET, PUT, or DELETE it by UUID.
    test_models = [
        ("accounts_payable", "SupplierInvoice", "api/v1/accounts-payable/invoices/{id}/"),
        ("accounts_payable", "PaymentVoucher", "api/v1/accounts-payable/payments/{id}/"),
        ("accounts_receivable", "ReceivableDocument", "api/v1/accounts-receivable/documents/{id}/"),
        ("cash_management", "CashTransaction", "api/v1/cash/transactions/{id}/"),
        ("cash_management", "CashCount", "api/v1/cash/counts/{id}/"),
        ("bank_management", "BankTransaction", "api/v1/bank/transactions/{id}/"),
        ("purchases", "PurchaseOrder", "api/v1/purchases/orders/{id}/"),
        ("sales", "SalesOrder", "api/v1/sales/orders/{id}/"),
        ("inventory", "InventoryReceipt", "api/v1/inventory/receipts/{id}/"),
        ("inventory", "InventoryIssue", "api/v1/inventory/issues/{id}/"),
        ("general_ledger", "JournalEntry", "api/v1/general-ledger/journal-entries/{id}/"),
        ("organization", "Employee", "api/v1/organization/employees/{id}/"),
        ("master_data", "Party", "api/v1/master-data/parties/{id}/"),
        ("master_data", "Item", "api/v1/master-data/items/{id}/"),
        ("approval_workflows", "Workflow", "api/v1/approvals/workflows/{id}/"),
    ]

    for app_name, model_name, path_pattern in test_models:
        try:
            model_cls = apps.get_model(app_name, model_name)
        except LookupError:
            continue

        # Find an object of Tenant B
        obj_b = None
        if any(f.name == "company" for f in model_cls._meta.fields):
            obj_b = model_cls.objects.filter(company=comp_b).first()
        elif any(f.name == "company_id" for f in model_cls._meta.fields):
            obj_b = model_cls.objects.filter(company_id=comp_b.id).first()

        if not obj_b:
            continue

        # User A tries to GET obj_b:
        # Case 1: without company_id
        # Case 2: with comp_a.id
        # Case 3: with comp_b.id
        # In all cases, User A should receive 403 or 404, NEVER 200 with obj_b data!
        
        # Find callback for this route
        obj_url = path_pattern.replace("{id}", str(obj_b.id))
        
        # Match callback in api_routes
        matched_cb = None
        for p, cb in api_routes:
            # simple prefix match
            prefix = path_pattern.split("{id}")[0]
            if p.startswith(prefix) and ("<pk>" in p or "<id>" in p or "(?P<pk>" in p or "(?P<id>" in p):
                matched_cb = cb
                break

        if not matched_cb:
            continue

        for probe_name, extra_param in [("no_param", ""), ("comp_a_param", f"?company_id={comp_a.id}"), ("comp_b_param", f"?company_id={comp_b.id}")]:
            req = factory.get(f"/{obj_url}{extra_param}")
            force_authenticate(req, user=user_a)
            try:
                resp = matched_cb(req, pk=str(obj_b.id))
                if resp.status_code == 200:
                    data = getattr(resp, "data", {})
                    # If returned data matches obj_b, this is an IDOR leak!
                    idor_leaks.append({
                        "model": f"{app_name}.{model_name}",
                        "path": obj_url,
                        "probe": probe_name,
                        "status": 200,
                        "leak_type": "IDOR_CROSS_TENANT_OBJECT_ACCESS",
                        "data_sample": str(data)[:150]
                    })
            except Exception:
                pass

    print(f"[*] IDOR cross-tenant leaks found: {len(idor_leaks)}")

    print("\n--- PHASE 3: GLOBAL SEARCH & REPORTS AUDIT ---")
    search_leaks = []
    # Test Global Search: User A searches Tenant B's data
    search_url = "/api/v1/common/search/"
    for p, cb in api_routes:
        if p == "api/v1/common/search/":
            # Probe 1: search with company=comp_b.id
            req = factory.get(f"{search_url}?company={comp_b.id}&q=a")
            force_authenticate(req, user=user_a)
            try:
                resp = cb(req)
                if resp.status_code == 200:
                    data = getattr(resp, "data", {})
                    search_leaks.append({
                        "endpoint": "GlobalSearch",
                        "probe": "comp_b_id",
                        "status": 200,
                        "data": str(data)[:150]
                    })
            except Exception:
                pass

    print(f"[*] Global search leaks found: {len(search_leaks)}")

    print("\n=====================================================================")
    print("                     FINAL AUDIT SUMMARY                             ")
    print("=====================================================================")
    print(f"Cross-Tenant List Leaks: {len(cross_tenant_leaks)}")
    print(f"Missing-Scope Multi-Tenant Leaks: {len(missing_scope_leaks)}")
    print(f"IDOR Object Access Leaks: {len(idor_leaks)}")
    print(f"Search Scope Leaks: {len(search_leaks)}")

    if cross_tenant_leaks:
        print("\n[!] CRITICAL CROSS-TENANT LIST LEAKS:")
        for l in cross_tenant_leaks:
            print(f"  - {l['path']} (?{l['query_param']}): {l['record_count']} records exposed!")
            print(f"    Sample: {l['sample']}")

    if missing_scope_leaks:
        print("\n[!] HIGH MISSING SCOPE LEAKS:")
        for l in missing_scope_leaks:
            print(f"  - {l['path']}: {l['reason']}")

    if idor_leaks:
        print("\n[!] CRITICAL IDOR LEAKS:")
        for l in idor_leaks:
            print(f"  - Model: {l['model']} via {l['path']} ({l['probe']})")
            print(f"    Sample: {l['data_sample']}")

    final_report = {
        "tenant_a": {"id": str(comp_a.id), "code": comp_a.code},
        "tenant_b": {"id": str(comp_b.id), "code": comp_b.code},
        "user_a": user_a.username,
        "user_b": user_b.username,
        "cross_tenant_leaks": cross_tenant_leaks,
        "missing_scope_leaks": missing_scope_leaks,
        "idor_leaks": idor_leaks,
        "search_leaks": search_leaks,
    }
    with open("multi_tenant_audit_report.json", "w", encoding="utf-8") as f:
        json.dump(final_report, f, indent=2, ensure_ascii=False)
    print("\n[*] Full results written to multi_tenant_audit_report.json")

if __name__ == "__main__":
    run_isolated_tenant_audit()
