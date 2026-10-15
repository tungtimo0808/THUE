# UC-AP-05: Phân bổ thanh toán (backend)

Các endpoint dưới đây yêu cầu xác thực và `company_id` trong query string. Quyền tương ứng là `AP.ALLOCATION.VIEW`, `AP.ALLOCATION.CREATE`, `AP.ALLOCATION.REVERSE`.

- `GET /api/v1/accounts-payable/payment-allocations/?company_id=...`: danh sách phiếu; có thể lọc `supplier_id`, `status`.
- `GET /api/v1/accounts-payable/payment-allocations/{id}/?company_id=...`: chi tiết phiếu.
- `GET /api/v1/accounts-payable/payment-allocations/eligible-payments/?company_id=...&supplier_id=...`: chứng từ đã ghi sổ còn tiền chưa phân bổ.
- `GET /api/v1/accounts-payable/payment-allocations/eligible-payables/?company_id=...&payment_id=...`: công nợ cùng nhà cung cấp, cùng tiền tệ và còn phải trả.
- `POST /api/v1/accounts-payable/payment-allocations/?company_id=...`: xác nhận phân bổ. Không có thao tác lưu nháp.
- `POST /api/v1/accounts-payable/payment-allocations/{id}/reverse/?company_id=...`: đảo phân bổ với `{"reason":"..."}`.

Ví dụ phân bổ thủ công:

```json
{
  "company": "<company-uuid>",
  "supplier": "<supplier-uuid>",
  "payment": "<payment-uuid>",
  "allocation_date": "2026-10-09",
  "description": "Phân bổ thanh toán",
  "mode": "MANUAL",
  "expected_unallocated_amount": "100000.0000",
  "lines": [
    {"payable": "<payable-uuid>", "amount": "50000.0000", "expected_balance": "80000.0000"}
  ]
}
```

Với `mode: "AUTO"`, gửi các khoản công nợ đã chọn trong `lines` và bỏ `amount`; hệ thống phân bổ lần lượt theo hạn thanh toán, ngày chứng từ, thời điểm tạo. `expected_unallocated_amount` và `expected_balance` là số liệu đã hiển thị cho người dùng; khi gửi chúng, API từ chối nếu dữ liệu đã thay đổi. Mọi số dư vẫn được tính và kiểm tra lại trong giao dịch trước khi ghi. Phiếu chỉ ghi nhận gắn tiền vào công nợ, không tạo thêm chứng từ chi hay bút toán.
