# UC-AP-06: Bù trừ công nợ phải trả (backend)

Các endpoint yêu cầu xác thực và `company_id` trong query string. Quyền sử dụng là `AP.OFFSET.VIEW`, `AP.OFFSET.CREATE` và `AP.OFFSET.CANCEL`.

- `GET /api/v1/accounts-payable/debt-offsets/?company_id=...`: danh sách; có thể lọc `partner_id`, `status`.
- `GET /api/v1/accounts-payable/debt-offsets/{id}/?company_id=...`: chi tiết.
- `GET /api/v1/accounts-payable/debt-offsets/eligible-partners/?company_id=...`: đối tác có cả vai trò khách hàng và nhà cung cấp, có công nợ hai chiều.
- `GET /api/v1/accounts-payable/debt-offsets/eligible-debts/?company_id=...&partner_id=...`: các khoản công nợ còn số dư.
- `POST /api/v1/accounts-payable/debt-offsets/?company_id=...`: ghi sổ bù trừ ngay, không lưu nháp.
- `POST /api/v1/accounts-payable/debt-offsets/{id}/cancel/?company_id=...`: hủy với `{"reason":"..."}`; tạo bút toán đảo trong kỳ hiện đang mở.

Ví dụ yêu cầu ghi sổ:

```json
{
  "company": "<company-uuid>",
  "partner": "<party-uuid>",
  "offset_date": "2026-10-09",
  "basis": "Biên bản bù trừ số 01",
  "description": "Bù trừ công nợ với đối tác",
  "payable_lines": [
    {"payable": "<payable-uuid>", "amount": "50000.0000", "expected_balance": "80000.0000"}
  ],
  "receivable_lines": [
    {"receivable": "<receivable-uuid>", "amount": "50000.0000", "expected_balance": "70000.0000"}
  ],
  "attachments": [
    {"name": "bien-ban.pdf", "size": 102400, "url": "<stored-file-reference>"}
  ]
}
```

`attachments` là metadata của các tệp đã lưu, tối đa 20 tệp PDF/PNG/JPG/JPEG, mỗi tệp tối đa 10 MB. API kiểm tra tên và kích thước metadata; việc tải tệp do dịch vụ lưu trữ tệp của ứng dụng xử lý. Hai tổng dòng phải bằng nhau và lớn hơn 0. Khi ghi sổ, API khóa và kiểm tra lại công nợ, cập nhật hai phía và tạo bút toán Nợ 331/Có 131 trong cùng giao dịch. Khi hủy, API khôi phục công nợ và tạo bút toán Nợ 131/Có 331.
