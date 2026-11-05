---
name: accounting-vn-audit
description: Audit riêng nghiệp vụ kế toán Việt Nam (định khoản, ghi sổ/đảo/điều chỉnh, khóa kỳ, sổ chi tiết so với sổ cái, báo cáo tài chính TT99/TT200/TT133) trong Thue ERP. Dùng khi người dùng gõ /accounting-vn-audit hoặc chỉ muốn kiểm nghiệp vụ kế toán của một phân hệ. Tham số - tên phân hệ hoặc để trống cho toàn bộ.
---

# Accounting VN Audit

Chỉ đọc. Không sửa code ứng dụng.

1. Xác định phạm vi từ tham số (vd. `sales`, `general_ledger`, `reporting`). Để trống = 4 nhóm như trong `/erp-full-audit` giai đoạn 2.
2. Gọi `accounting-auditor` cho từng nhóm (song song nếu nhiều nhóm).
3. Tự đọc lại code của mọi phát hiện Critical/High.
4. Hỏi người dùng có muốn chạy `qa-auditor` để xác minh bằng test không (tốn thời gian); nếu có, gọi cho các phát hiện `SUSPECTED`.
5. Ghi `ERP_AUDIT/runs/<yyyy-mm-dd>-accounting[-<phân hệ>]/02_ACCOUNTING_COMPLIANCE.md` và `findings.json` (theo `accounting-audit/findings.schema.json`).
6. Báo lại: đường dẫn, số phát hiện theo mức, các điểm cần kế toán trưởng xác nhận.
