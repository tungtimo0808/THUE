import requests
import json
import time
from urllib.parse import urljoin

BACKEND_URL = "http://127.0.0.1:8080"
FRONTEND_URL = "http://127.0.0.1:2601"

report = {
    "target_backend": BACKEND_URL,
    "target_frontend": FRONTEND_URL,
    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    "security_headers": {},
    "cors_analysis": {},
    "sensitive_files_exposure": [],
    "sql_injection_fuzzing": [],
    "auth_rate_limiting": {},
    "http_method_tampering": []
}

print("=====================================================================")
print("     EXTERNAL WEB APPLICATION PENETRATION & DAST AUDIT              ")
print("=====================================================================")

# 1. SECURITY HEADERS AUDIT
print("\n[*] 1. Testing Security Headers on Backend & Frontend...")
REQUIRED_HEADERS = [
    "Strict-Transport-Security",
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy"
]

for label, url in [("Backend API", BACKEND_URL), ("Frontend", FRONTEND_URL)]:
    try:
        r = requests.get(url, timeout=5)
        headers = dict(r.headers)
        missing = [h for h in REQUIRED_HEADERS if h.lower() not in [k.lower() for k in headers.keys()]]
        info_leak = {k: headers[k] for k in ["Server", "X-Powered-By"] if k in headers}
        
        report["security_headers"][label] = {
            "status_code": r.status_code,
            "present_security_headers": [h for h in REQUIRED_HEADERS if h.lower() in [k.lower() for k in headers.keys()]],
            "missing_security_headers": missing,
            "server_information_leak": info_leak
        }
        print(f"  [{label}] Missing headers: {len(missing)} ({', '.join(missing)})")
        if info_leak:
            print(f"  [{label}] Server info leak: {info_leak}")
    except Exception as e:
        print(f"  [{label}] Failed to connect: {e}")

# 2. CORS MISCONFIGURATION AUDIT
print("\n[*] 2. Testing CORS Misconfiguration...")
evil_origin = "https://evil-attacker.com"
try:
    r = requests.options(f"{BACKEND_URL}/api/v1/auth/login/", headers={"Origin": evil_origin, "Access-Control-Request-Method": "POST"}, timeout=5)
    acao = r.headers.get("Access-Control-Allow-Origin")
    acac = r.headers.get("Access-Control-Allow-Credentials")
    
    cors_vulnerable = (acao == evil_origin and acac == "true") or (acao == "*" and acac == "true")
    report["cors_analysis"] = {
        "tested_origin": evil_origin,
        "Access-Control-Allow-Origin": acao,
        "Access-Control-Allow-Credentials": acac,
        "is_cors_vulnerable": cors_vulnerable,
        "risk_level": "HIGH" if cors_vulnerable else "LOW_TO_MEDIUM" if acao == "*" else "SAFE"
    }
    print(f"  ACAO: {acao}, ACAC: {acac} -> Vulnerable: {cors_vulnerable}")
except Exception as e:
    print(f"  CORS check error: {e}")

# 3. SENSITIVE FILES & EXPOSED DIRECTORIES
print("\n[*] 3. Probing Sensitive Files & Exposed Paths...")
PROBE_PATHS = [
    "/.env",
    "/.env.local",
    "/.env.production",
    "/.git/HEAD",
    "/.git/config",
    "/manage.py",
    "/config/settings.py",
    "/backup.sql",
    "/dump.sql",
    "/admin/",
    "/api/v1/schema/",
    "/api/v1/docs/",
    "/swagger/",
    "/redoc/",
    "/.aws/credentials",
    "/server-status"
]

for p in PROBE_PATHS:
    target = urljoin(BACKEND_URL, p)
    try:
        r = requests.get(target, timeout=3, allow_redirects=False)
        content_preview = r.text[:100].replace("\n", " ").strip()
        is_exposed = False
        
        if r.status_code == 200:
            if p in ["/.env", "/.env.local", "/.env.production"] and ("SECRET_KEY" in r.text or "DEBUG" in r.text or "DB_" in r.text):
                is_exposed = True
            elif "/.git" in p and "ref: refs/" in r.text:
                is_exposed = True
            elif p in ["/manage.py", "/config/settings.py"] and ("django" in r.text or "import" in r.text):
                is_exposed = True
            elif p in ["/api/v1/schema/", "/api/v1/docs/", "/swagger/", "/admin/"]:
                is_exposed = True
        
        status_desc = "EXPOSED" if is_exposed else "PROTECTED" if r.status_code in (401, 403, 404) else f"STATUS_{r.status_code}"
        report["sensitive_files_exposure"].append({
            "path": p,
            "status_code": r.status_code,
            "status_desc": status_desc,
            "exposed": is_exposed,
            "preview": content_preview[:60]
        })
        if is_exposed or r.status_code not in (404, 301):
            print(f"  [{status_desc}] {p} -> HTTP {r.status_code}")
    except Exception as e:
        pass

# 4. SQL INJECTION FUZZING ON PUBLIC ENDPOINTS
print("\n[*] 4. Fuzzing Public Endpoints for SQL Injection...")
SQLI_PAYLOADS = [
    "' OR '1'='1",
    "\" OR \"1\"=\"1",
    "1' UNION SELECT NULL, NULL, NULL--",
    "1; SELECT pg_sleep(0.5)--",
    "' AND 1=1--",
    "' AND 1=2--"
]

test_url = f"{BACKEND_URL}/api/v1/common/search/"
for payload in SQLI_PAYLOADS:
    try:
        t0 = time.time()
        r = requests.get(f"{test_url}?q={payload}", timeout=5)
        dt = time.time() - t0
        
        has_sql_error = any(kw in r.text.lower() for kw in ["syntax error", "psycopg", "pg_catalog", "sql error", "unterminated quoted string"])
        
        report["sql_injection_fuzzing"].append({
            "payload": payload,
            "status_code": r.status_code,
            "response_time_sec": round(dt, 3),
            "sql_error_detected": has_sql_error
        })
        if has_sql_error:
            print(f"  [CRITICAL] SQL error leaked with payload: {payload}")
    except Exception as e:
        pass
print(f"  Tested {len(SQLI_PAYLOADS)} SQLi payloads. SQL Errors Detected: {sum(1 for x in report['sql_injection_fuzzing'] if x['sql_error_detected'])}")

# 5. AUTHENTICATION RATE-LIMITING TEST
print("\n[*] 5. Testing Rate Limiting on Login Endpoint...")
login_url = f"{BACKEND_URL}/api/v1/auth/login/"
throttled = False
throttle_at = None

for i in range(1, 35):
    try:
        r = requests.post(login_url, json={"username": f"user_test_{i}", "password": "wrong_password"}, timeout=3)
        if r.status_code == 429:
            throttled = True
            throttle_at = i
            print(f"  [PROTECTED] Rate limiting active: Blocked with HTTP 429 at request #{i}")
            break
    except Exception:
        break

report["auth_rate_limiting"] = {
    "rate_limited": throttled,
    "triggered_after_requests": throttle_at,
    "status": "PASS" if throttled else "FAIL"
}
if not throttled:
    print("  [WARNING] 30 rapid login attempts were NOT rate limited!")

# 6. HTTP METHOD TAMPERING
print("\n[*] 6. Testing HTTP Method Tampering on Protected Endpoints...")
protected_url = f"{BACKEND_URL}/api/v1/cash/transactions/"
for method in ["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE", "PATCH", "TRACE"]:
    try:
        r = requests.request(method, protected_url, timeout=3)
        report["http_method_tampering"].append({
            "method": method,
            "status_code": r.status_code
        })
    except Exception:
        pass

print(f"  Method testing complete: {report['http_method_tampering']}")

# Save report
with open("external_dast_audit_report.json", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)
print("\n[*] Audit report written to external_dast_audit_report.json")
