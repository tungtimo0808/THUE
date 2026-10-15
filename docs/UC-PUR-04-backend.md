# UC-PUR-04 — API ghi nhận mua dịch vụ

Prefix: `/api/v1/purchases/service-purchases/`. Mọi request cần xác thực và `company_id` trong query string. Backend dùng quyền IAM `PUR.SERVICE.VIEW`, `CREATE`, `EDIT`, `SUBMIT`, `APPROVE`, `POST`, `UNPOST`, `CANCEL` và kiểm tra phạm vi chi nhánh.

## Tạo chứng từ

`POST /api/v1/purchases/service-purchases/?company_id=<uuid>`

```json
{
  "company": "<uuid>",
  "branch": "<uuid>",
  "document_date": "2026-10-06",
  "posting_date": "2026-10-06",
  "supplier": "<uuid>",
  "purchase_order": null,
  "payment_type": "UNPAID",
  "payment": null,
  "supplier_invoice": null,
  "contact_person": "",
  "acceptance_reference": "",
  "notes": "Mua dịch vụ",
  "attachments": [],
  "lines": [{
    "line_no": 1,
    "item": "<uuid dịch vụ>",
    "uom": "<uuid>",
    "quantity": "2.000000",
    "unit_price": "100.0000",
    "discount_rate": "10.0000",
    "tax_rate": null,
    "service_from": "2026-10-01",
    "service_to": "2026-10-06",
    "acceptance_date": "2026-10-06",
    "debit_account": "<uuid>",
    "credit_account": "<uuid>",
    "department": null,
    "expense_item": null,
    "statistical_code": null,
    "order_line": null
  }]
}
```

`purchase_type` được mặc định là `SERVICE`. `number`, số tiền và tổng tiền do backend tính. Nếu chọn thanh toán ngay (`IMMEDIATE`), cần truyền `payment` là ID của khoản thanh toán đã xác nhận và còn đủ giá trị. `acceptance_date` bắt buộc trước khi gửi duyệt đối với dịch vụ có `requires_service_acceptance=true`.

## Vòng đời

- `POST {id}/submit/`: nháp hoặc yêu cầu sửa → chờ duyệt hoặc tự duyệt nếu không có workflow.
- `POST {id}/approve/`, `reject/`, `request-revision/`: xử lý phê duyệt; từ chối và yêu cầu sửa cần `reason`.
- `POST {id}/post/`: tạo bút toán, công nợ nếu chưa thanh toán, cập nhật phần dịch vụ đã thực hiện trong đơn mua.
- `POST {id}/unpost/`: đảo bút toán, công nợ và tiến độ đơn mua khi kỳ còn mở và chưa có dữ liệu phụ thuộc; cần `reason`.
- `POST {id}/cancel/`: hủy chứng từ chưa ghi sổ.

Body của mỗi action cần `{"version": <version hiện tại>}`. Mua dịch vụ không tạo phiếu nhập kho hoặc thay đổi tồn kho. Một chứng từ có thể ghi nhận một phần số lượng dòng đơn mua và được tạo không cần đơn mua.
