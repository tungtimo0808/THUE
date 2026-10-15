# UC-AP-08: Đối chiếu công nợ nhà cung cấp (backend)

Các endpoint yêu cầu xác thực và `company_id` trong query string. Quyền tương ứng là `AP.RECONCILIATION.VIEW`, `AP.RECONCILIATION.CREATE`, `AP.RECONCILIATION.CONFIRM`, `AP.RECONCILIATION.CANCEL`.

- `GET /api/v1/accounts-payable/supplier-reconciliations/?company_id=...`: danh sách; lọc thêm `supplier_id`, `status`.
- `GET /api/v1/accounts-payable/supplier-reconciliations/{id}/?company_id=...`: chi tiết cùng ảnh chụp số liệu.
- `GET /api/v1/accounts-payable/supplier-reconciliations/preview/?company_id=...&supplier=...&currency=...&period_start=YYYY-MM-DD&period_end=YYYY-MM-DD`: tính số dư đầu kỳ, phát sinh, cuối kỳ và các giao dịch; trả `snapshot_token`.
- `POST /api/v1/accounts-payable/supplier-reconciliations/?company_id=...`: lập biên bản từ dữ liệu vừa lấy. Gửi `company`, `supplier`, `currency`, `period_start`, `period_end`, `snapshot_token` và `content` tùy chọn. Nếu dữ liệu thay đổi sau lúc lấy, API yêu cầu lấy lại.
- `GET /api/v1/accounts-payable/supplier-reconciliations/{id}/pdf/?company_id=...`: tải PDF từ ảnh chụp đã lưu.
- `POST /api/v1/accounts-payable/supplier-reconciliations/{id}/complete/?company_id=...`: ghi nhận xác nhận của nhà cung cấp.
- `POST /api/v1/accounts-payable/supplier-reconciliations/{id}/cancel/?company_id=...`: hủy biên bản còn chờ xác nhận với `{"reason":"..."}`.

Ví dụ hoàn thành đối chiếu:

```json
{
  "confirmation_date": "2026-10-09",
  "confirmed_by_name": "Nguyễn Văn A",
  "supplier_balance": "500000.0000",
  "confirmation_attachments": [
    {"name": "xac-nhan.pdf", "size": 102400, "url": "<stored-file-reference>"}
  ],
  "difference_reason": "Sai chứng từ thanh toán",
  "resolution": "Kiểm tra và lập chứng từ xử lý"
}
```

`difference_reason` và `resolution` chỉ bắt buộc khi số dư nhà cung cấp khác số dư hệ thống. Tệp đính kèm là metadata của tệp đã lưu: PDF/PNG/JPG/JPEG, mỗi tệp tối đa 10 MB, tối đa 20 tệp. Việc tải tệp do dịch vụ lưu trữ của ứng dụng xử lý.

Biên bản lưu nguyên ảnh chụp giao dịch và số dư. Thanh toán đã ghi sổ được tính tại ngày thanh toán, kể cả khoản trả trước; phân bổ khoản thanh toán không được tính lại thành một khoản giảm công nợ. Biên bản không tạo bút toán và không thay đổi công nợ.
