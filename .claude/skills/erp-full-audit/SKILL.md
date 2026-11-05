---
name: erp-full-audit
description: Chạy audit toàn bộ Thue ERP (code + nghiệp vụ kế toán Việt Nam + dữ liệu + bảo mật + kiểm thử), điều phối 6 auditor agent và ghi báo cáo có bằng chứng vào ERP_AUDIT/. Dùng khi người dùng yêu cầu audit toàn bộ dự án hoặc gõ /erp-full-audit. Tham số tùy chọn - tên một phân hệ (vd. "sales") để giới hạn phạm vi.
---

# ERP Full Audit

Bạn là người điều phối. Bạn giao việc cho các agent trong `.claude/agents/`, đối chiếu kết quả và viết báo cáo. Lần audit này **chỉ đọc**: không sửa code ứng dụng, không `migrate`, không ghi dữ liệu. File được phép ghi: `ERP_AUDIT/**` và `backend/audit_repro/**` (qua `qa-auditor`).

Nếu người dùng truyền tên phân hệ, chỉ chạy phạm vi đó; nếu không, chạy toàn bộ.

## Giai đoạn 0 — Chuẩn bị
1. Tạo thư mục chạy: `ERP_AUDIT/runs/<yyyy-mm-dd>/` (thêm hậu tố `-2`, `-3` nếu đã có).
2. Ghi `00_RUN_INFO.md`: nhánh git, commit (`git rev-parse --short HEAD`), `git status --short`, phạm vi, `DB_ENGINE` trong `.env` (không in mật khẩu).
3. Đọc các báo cáo cũ làm mốc: `BUSINESS_LOGIC_ISSUES.md`, `SECURITY_ISSUES.md`, `CLEAN_CODE_ISSUES.md`, `AUDIT_REPORT.md` ở thư mục gốc, và lần chạy gần nhất trong `ERP_AUDIT/runs/` nếu có.

## Giai đoạn 1 — Bản đồ
Gọi `code-auditor` với nhiệm vụ "bản đồ dự án". Lưu kết quả vào `01_PROJECT_MAP.md`.

## Giai đoạn 2 — Audit chuyên môn
Gọi song song, mỗi agent nhận bản đồ ở giai đoạn 1 và phạm vi:
- `accounting-auditor` — chia theo nhóm: (a) GL, khóa kỳ, kết chuyển, báo cáo tài chính; (b) bán hàng, phải thu, giá vốn; (c) mua hàng, phải trả, kho; (d) quỹ, ngân hàng, tài sản, lương, thuế. Một agent cho mỗi nhóm.
- `business-auditor` — các luồng xuyên phân hệ trong định nghĩa agent.
- `database-auditor`
- `security-auditor`
- `code-auditor` — nhiệm vụ "audit chất lượng".

Đừng gửi lại toàn bộ hội thoại cho agent; gửi phạm vi, bản đồ liên quan, và đường dẫn tới `accounting-audit/`.

## Giai đoạn 3 — Xác minh
1. Gom mọi phát hiện. Gộp phát hiện trùng (cùng gốc lỗi) giữ mã của agent phát hiện đầu tiên, ghi các mã bị gộp.
2. Tự đọc lại code ở `file:dòng` của từng phát hiện Critical/High để chắc bằng chứng đúng. Hạ mức hoặc bỏ phát hiện không đứng được.
3. Gọi `qa-auditor` để viết và chạy test tái hiện cho mọi phát hiện Critical/High còn `SUSPECTED`, cùng các tình huống trong `accounting-audit/test-scenarios/core-scenarios.md` chưa có test.
4. Cập nhật trạng thái từ kết quả test.

## Giai đoạn 4 — Báo cáo
Ghi vào thư mục chạy:
- `02_ACCOUNTING_COMPLIANCE.md` — theo phân hệ, kèm bảng hoàn thiện nghiệp vụ.
- `03_BUSINESS_FLOWS.md` — chuỗi từng luồng và chỗ đứt.
- `04_DATA_INTEGRITY.md`
- `05_SECURITY.md`
- `06_CODE_QUALITY.md`
- `07_TEST_EVIDENCE.md` — lệnh, kết quả, độ phủ.
- `08_MISSING_FEATURES.md` — chức năng chưa có hoặc chỉ có giao diện.
- `09_REMEDIATION_PLAN.md` — thứ tự sửa theo mức độ và phụ thuộc, mỗi mục ghi tiêu chí xác minh.
- `findings.json` — theo `accounting-audit/findings.schema.json`.
- `README.md` — tóm tắt điều hành: số phát hiện theo mức, 5 vấn đề nghiêm trọng nhất, phân hệ chưa đủ bằng chứng, việc cần kế toán trưởng xác nhận, so sánh với lần chạy trước (mới / đã sửa / còn mở).

## Quy tắc kết luận
- Không tuyên bố ERP "tuân thủ" hay "đạt" chỉ dựa trên đọc code. Mức cao nhất là `PASS trong phạm vi đã kiểm thử`.
- Còn phát hiện Critical mở → kết luận chung là `FAIL`.
- Nghiệp vụ trọng yếu không có bằng chứng thực thi → `UNKNOWN`, không phải `PASS`.
- Kết luận về quy định pháp lý chỉ dựa trên nguồn trong `accounting-audit/regulations/README.md`; còn lại ghi `NEEDS_HUMAN_REVIEW`.

Kết thúc bằng tin nhắn ngắn cho người dùng: đường dẫn thư mục chạy, số phát hiện theo mức, 3–5 điểm nổi bật. Hỏi trước khi bắt đầu sửa bất kỳ lỗi nào.
