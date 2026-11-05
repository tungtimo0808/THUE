# Thue ERP — ghi chú dự án

ERP kế toán & thuế doanh nghiệp Việt Nam.

## Stack
- Backend: Django + DRF, `backend/` (19 app: `general_ledger`, `sales`, `purchases`, `inventory`, `accounts_receivable`, `accounts_payable`, `cash_management`, `bank_management`, `fixed_assets`, `payroll`, `costing`, `tax_management`, `reporting`, `iam`, `approval_workflows`, `audit_log`, `master_data`, `organization`, `common_services`).
- Frontend: React + Vite + TypeScript, `frontend/`.
- Database: PostgreSQL khi `DB_ENGINE=postgres`, mặc định SQLite (`backend/db.sqlite3`) cho dev. Cấu hình tại `backend/config/settings.py`, biến môi trường ở `.env` gốc.
- Python venv: `venv/` ở thư mục gốc (không phải `backend/venv`).

## Lệnh
- Backend: `cd backend; ..\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8080` (Vite proxy `/api` → cổng **8080**).
- Frontend: `cd frontend; npm run dev` (cổng 2601). `npm run typecheck`, `npm run lint` (oxlint), `npm run test:e2e` (Playwright).
- Test backend dùng Django test runner, không phải pytest: `..\venv\Scripts\python.exe manage.py test <app>`. Test DB là `backend/test_db.sqlite3`.
- Sao lưu `backend/db.sqlite3` trước khi `migrate` (đặt tên `db.sqlite3.before_<lý do>_<yyyymmdd>.bak`).

## Nghiệp vụ kế toán
- Chế độ kế toán theo doanh nghiệp: `AccountingPolicy.accounting_regime` (`common_services/models.py`) — TT99/2025, TT200/2014, TT133/2016.
- Ghi sổ GL tập trung ở `backend/general_ledger/services.py`: `post`, `unpost`, `adjust`, `reverse`, `create_replacement_entry`, `close_period`, `reopen_period`. Các phân hệ nghiệp vụ gọi vào đây, không ghi `JournalEntry` trực tiếp.
- Báo cáo ở `backend/reporting/` (B01/B02/B03/B09, báo cáo mua/bán/thuế, TT133 ở `tt133_reports.py`).

## Audit
Bộ AI audit nằm ở `.claude/agents/`, `.claude/skills/`, `accounting-audit/`; kết quả ghi vào `ERP_AUDIT/`. Bắt đầu bằng `/erp-full-audit`. Các báo cáo audit trước đó ở thư mục gốc (`BUSINESS_LOGIC_ISSUES.md`, `SECURITY_ISSUES.md`, `CLEAN_CODE_ISSUES.md`, `AUDIT_REPORT.md`).
