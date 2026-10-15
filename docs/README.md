# Tài liệu dự án ERP kế toán – thuế

## Danh sách tài liệu

| Tài liệu | Nội dung |
| --- | --- |
| [Test plan chức năng dùng chung](./COMMON_SERVICES_TEST_PLAN.md) | Phạm vi, chiến lược và ma trận test cho UC-COM-01 đến UC-COM-12 |
| [Test case chức năng dùng chung](./COMMON_SERVICES_TEST_CASES.xlsx) | Workbook thực thi gồm hướng dẫn, test data, traceability và 12 sheet test case UC-COM |
| [Báo cáo chạy test UC-COM](./COMMON_SERVICES_TEST_EXECUTION_REPORT.md) | Kết quả thực thi trên SQLite/PostgreSQL, coverage theo 12 UC và defect đã xác nhận |
| [Postman Common Services](./postman/COMMON_SERVICES.postman_collection.json) | Collection thực thi theo test case, dùng cùng file environment mẫu trong thư mục `postman` |
| [Hướng dẫn test qua mạng LAN](./LAN_TESTING_GUIDE.md) | URL truy cập, lệnh start/stop, Postman và cấu hình Windows Firewall cho tester cùng mạng |
| [Mô phỏng vận hành công ty trong một năm](./ERP_ONE_YEAR_SIMULATION.md) | Số liệu 12 tháng, phép cộng/trừ, sơ đồ, toàn bộ nhóm API, báo cáo cuối năm và điều kiện nghiệm thu |
| [Bản Word có biểu đồ và form nhập](./ERP_ONE_YEAR_SIMULATION.docx) | Bản trình bày để gửi, in hoặc chỉnh sửa trong Microsoft Word |
| [Database và API General Ledger](./GENERAL_LEDGER_DATABASE_API.md) | 15 bảng GL, quan hệ dữ liệu, payload, quyền, API và quy trình từ đầu đến cuối |

## Thống kê API

- API v1: **446 endpoint path**, tương ứng **783 HTTP operation**.
- Toàn bộ `/api/` gồm token và tài liệu kỹ thuật: **451 endpoint path**, tương ứng **788 HTTP operation**.
- Kết quả backend hiện tại: **56/56 test pass**.

## Cách đọc

1. Đọc tài liệu mô phỏng để hiểu quy trình xuyên suốt doanh nghiệp.
2. Đọc tài liệu GL để hiểu chi tiết bảng dữ liệu, trạng thái và cách ghi sổ.
3. Mở `/api/docs/` khi server chạy để thử request theo OpenAPI schema hiện hành.

## Tạo lại file Word

```powershell
.\venv\Scripts\python.exe scripts\build_erp_word_report.py
```

Script đọc nội dung Markdown, tạo lại các biểu đồ và xuất `ERP_ONE_YEAR_SIMULATION.docx`. Ảnh giao diện có thể chụp lại khi frontend đang chạy bằng:

```powershell
cd frontend
node scripts/capture_word_assets.mjs
```
