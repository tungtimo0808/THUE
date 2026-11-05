# ERP_AUDIT

Kết quả các lần audit bằng AI. Mỗi lần chạy là một thư mục `runs/<yyyy-mm-dd>[-phạm vi]/`, gồm báo cáo Markdown và `findings.json` (schema: `accounting-audit/findings.schema.json`).

## Lệnh (trong Claude Code, mở tại thư mục gốc repo)
| Lệnh | Việc |
|---|---|
| `/erp-full-audit` | Audit toàn bộ: bản đồ → 6 auditor → xác minh bằng test → báo cáo |
| `/erp-full-audit sales` | Như trên, giới hạn một phân hệ |
| `/accounting-vn-audit [phân hệ]` | Chỉ nghiệp vụ kế toán |
| `/cross-module-audit [luồng]` | Lần theo luồng giao diện → API → service → bút toán → báo cáo |
| `/database-audit` | Schema, transaction, race condition, đối soát dữ liệu |
| `/security-audit` | Phân quyền, cô lập công ty, OWASP |
| `/audit-verify [mã \| lần chạy]` | Kiểm tra lại sau khi sửa |

Thành phần: agent ở `.claude/agents/`, skill ở `.claude/skills/`, quy tắc ở `.claude/rules/`, kiến thức và mẫu ở `accounting-audit/`. Test tái hiện do `qa-auditor` viết nằm ở `backend/audit_repro/`.

Audit chỉ đọc; sửa lỗi làm riêng trên nhánh khác sau khi đọc báo cáo.
