---
name: security-audit
description: Audit bảo mật và phân quyền nghiệp vụ Thue ERP - cô lập dữ liệu giữa công ty, RBAC, quyền duyệt/ghi sổ/xóa, audit log, OWASP cho Django/DRF và React. Dùng khi người dùng gõ /security-audit hoặc hỏi về phân quyền, lộ dữ liệu.
---

# Security Audit

Chỉ đọc.

1. Gọi `security-auditor`. Với ứng dụng lớn, chia làm hai agent song song: (a) `iam`, `organization`, `audit_log`, `config`, `reporting`; (b) các app nghiệp vụ còn lại.
2. Tự đọc lại code của mọi phát hiện Critical/High; nếu cần chứng minh truy cập chéo công ty, gọi `qa-auditor` viết test gọi API bằng người dùng công ty khác.
3. Ghi `ERP_AUDIT/runs/<yyyy-mm-dd>-security/05_SECURITY.md` và `findings.json`. Không ghi giá trị bí mật.
4. Báo lại đường dẫn và các điểm chính.
