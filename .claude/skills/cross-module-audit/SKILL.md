---
name: cross-module-audit
description: Lần theo một hoặc nhiều luồng nghiệp vụ Thue ERP xuyên phân hệ từ giao diện React tới API, service, database, bút toán và báo cáo để tìm bước thiếu, trạng thái lệch, chức năng chỉ có giao diện. Dùng khi người dùng gõ /cross-module-audit hoặc hỏi một luồng (vd. "bán hàng → giá vốn → công nợ") có chạy đúng không.
---

# Cross-module Audit

Chỉ đọc.

1. Lấy luồng từ tham số (vd. "mua hàng", "trả hàng bán"). Để trống = toàn bộ luồng trong `.claude/agents/business-auditor.md`.
2. Gọi `business-auditor`, mỗi agent một nhóm 2–3 luồng, chạy song song.
3. Với mắt xích kết luận "bút toán sai" hoặc "số liệu báo cáo lệch", gọi thêm `accounting-auditor` cho đúng mắt xích đó.
4. Ghi `ERP_AUDIT/runs/<yyyy-mm-dd>-flows/03_BUSINESS_FLOWS.md` và `findings.json`.
5. Báo lại đường dẫn, luồng nào đứt ở đâu, chức năng nào chỉ có giao diện.
