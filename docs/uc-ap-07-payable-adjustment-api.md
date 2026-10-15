# UC-AP-07: Điều chỉnh công nợ phải trả (backend)

Các endpoint yêu cầu xác thực và `company_id` trong query string. Quyền sử dụng là `AP.ADJUSTMENT_VOUCHER.VIEW`, `AP.ADJUSTMENT_VOUCHER.CREATE`, `AP.ADJUSTMENT_VOUCHER.CANCEL`.

- `GET /api/v1/accounts-payable/adjustment-vouchers/?company_id=...`: danh sách; lọc thêm `supplier_id`, `status`.
- `GET /api/v1/accounts-payable/adjustment-vouchers/{id}/?company_id=...`: chi tiết.
- `GET /api/v1/accounts-payable/adjustment-vouchers/eligible-payables/?company_id=...&supplier_id=...&kind=INCREASE`: công nợ đủ điều kiện, gồm công nợ đã trả hết. Dùng `kind=DECREASE` để chỉ lấy công nợ còn số dư.
- `GET /api/v1/accounts-payable/adjustment-vouchers/eligible-accounts/?company_id=...`: tài khoản đối ứng đang hoạt động và được phép hạch toán.
- `POST /api/v1/accounts-payable/adjustment-vouchers/?company_id=...`: ghi sổ điều chỉnh ngay; không lưu nháp.
- `POST /api/v1/accounts-payable/adjustment-vouchers/{id}/cancel/?company_id=...`: hủy với `{"reason":"..."}`; tạo bút toán đảo trong kỳ hiện đang mở.

Ví dụ yêu cầu ghi sổ:

```json
{
  "company": "<company-uuid>",
  "supplier": "<supplier-uuid>",
  "payable": "<payable-uuid>",
  "kind": "INCREASE",
  "adjustment_date": "2026-10-09",
  "reason": "RECONCILIATION",
  "basis": "Biên bản đối chiếu số 01",
  "amount": "50000.0000",
  "counter_account": "<account-uuid>",
  "expected_balance": "80000.0000",
  "attachments": [{"name": "bien-ban.pdf", "size": 102400, "url": "<stored-file-reference>"}]
}
```

`kind` nhận `INCREASE` hoặc `DECREASE`. `reason` nhận `RECONCILIATION`, `OPENING_BALANCE`, `ROUNDING`, `OTHER`; với `OTHER` cần thêm `reason_detail` tối đa 500 ký tự. `description` có giá trị mặc định nếu bỏ qua. Tệp đính kèm là metadata của tệp đã lưu, tối đa 20 tệp PDF/PNG/JPG/JPEG, mỗi tệp tối đa 10 MB; việc tải tệp do dịch vụ lưu trữ của ứng dụng xử lý.

API khóa công nợ và kiểm tra lại `balance` trong giao dịch. Tăng công nợ ghi Nợ tài khoản đối ứng/Có 331; giảm ghi Nợ 331/Có tài khoản đối ứng. Hủy chứng từ tạo bút toán ngược và hoàn tác số dư công nợ.
