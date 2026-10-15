# UC-PUR-03 — API ghi nhận mua hàng hóa

Prefix: `/api/v1/purchases/goods-purchases/`. Các request cần xác thực và `company_id` trong query string. Quyền IAM: `PUR.GOODS.VIEW`, `CREATE`, `EDIT`, `SUBMIT`, `APPROVE`, `POST`, `UNPOST`, `CANCEL`; backend kiểm tra phạm vi chi nhánh.

## Tạo chứng từ

`POST /api/v1/purchases/goods-purchases/?company_id=<uuid>`

```json
{
  "company": "<uuid>",
  "branch": "<uuid>",
  "document_date": "2026-10-06",
  "posting_date": "2026-10-06",
  "purchase_type": "WAREHOUSE",
  "supplier": "<uuid>",
  "purchase_order": null,
  "receiving_warehouse": "<uuid>",
  "payment_type": "UNPAID",
  "payment": null,
  "supplier_invoice": null,
  "notes": "Mua hàng",
  "attachments": [],
  "lines": [{
    "line_no": 1,
    "item": "<uuid>",
    "uom": "<uuid>",
    "quantity": "2.000000",
    "unit_price": "100.0000",
    "discount_rate": "10.0000",
    "tax_rate": null,
    "debit_account": "<uuid>",
    "credit_account": "<uuid>",
    "order_line": null
  }]
}
```

Với mua không qua kho, dùng `purchase_type: "DIRECT"` và `receiving_warehouse: null`. Với thanh toán ngay, dùng `payment_type: "IMMEDIATE"` và truyền `payment` là ID của chứng từ thanh toán đã xác nhận, còn đủ số tiền chưa phân bổ.

`number`, trạng thái, số tiền dòng và tổng tiền do backend tính. `version` trong response phải được gửi lại ở mỗi thao tác sửa hoặc chuyển trạng thái.

## Vòng đời

- `POST {id}/submit/`: nháp hoặc yêu cầu sửa → chờ duyệt hoặc tự duyệt nếu không có workflow.
- `POST {id}/approve/`, `reject/`, `request-revision/`: xử lý phê duyệt; từ chối và yêu cầu sửa cần `reason`.
- `POST {id}/post/`: duyệt → ghi sổ; tạo bút toán, công nợ nếu chưa thanh toán, nhập kho nếu qua kho, cập nhật số lượng đơn mua trong một transaction.
- `POST {id}/unpost/`: ghi sổ → duyệt; cần `reason`, chỉ khi kỳ còn mở và không có thanh toán hoặc hóa đơn đã ghi sổ phụ thuộc.
- `POST {id}/cancel/`: hủy chứng từ chưa ghi sổ.

Body của mỗi action cần `{"version": <version hiện tại>}`. Bỏ ghi sổ cần thêm `reason`. Có thể liên kết phiếu nhập kho đã `POSTED` bằng `inventory_transaction` khi tạo chứng từ; phiếu sẽ được kiểm tra kho, hàng và số lượng. Phiếu liên kết sẵn không bị đảo tồn kho khi bỏ ghi sổ mua hàng.

Lưu ý: lượng hàng tồn hỗ trợ 6 chữ số thập phân; đơn vị tính hiện phải là đơn vị cơ sở của hàng hóa. Hệ thống dùng một phiếu nhập kho cho mỗi chứng từ mua qua kho, nên tất cả dòng phải cùng kho.
