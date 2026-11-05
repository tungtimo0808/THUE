---
name: database-audit
description: Audit schema, migration, transaction, race condition, cấp số chứng từ và đối soát dữ liệu kế toán của Thue ERP bằng truy vấn chỉ-đọc. Dùng khi người dùng gõ /database-audit hoặc hỏi về toàn vẹn dữ liệu, số dư lệch, chứng từ trùng.
---

# Database Audit

Chỉ đọc code và chỉ chạy truy vấn đọc.

1. Kiểm tra `.env`: nếu `DB_ENGINE=postgres`, hỏi người dùng database đó là dev hay production và có được truy vấn đọc không trước khi tiếp tục. Mặc định SQLite dev thì tiếp tục.
2. Gọi `database-auditor`.
3. Với rủi ro race condition hoặc mất dữ liệu được ghi `SUSPECTED`, đề nghị người dùng chạy `qa-auditor` để tái hiện.
4. Ghi `ERP_AUDIT/runs/<yyyy-mm-dd>-database/04_DATA_INTEGRITY.md` và `findings.json`.
5. Báo lại đường dẫn và các điểm chính.
