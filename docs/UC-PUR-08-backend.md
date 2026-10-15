# UC-PUR-08 — API đối chiếu chứng từ mua hàng (Purchase Document Reconciliation)

Prefix: `/api/v1/purchases/reconciliations/`. Mọi request cần xác thực và `company_id` trong query string hoặc body. Các quyền IAM là `PUR.RECONCILIATION.VIEW`, `MATCH`, `CREATE`, `APPROVE`, `CANCEL`; backend tự động kiểm tra phạm vi dữ liệu chi nhánh (`branch`).

---

## 1. Các phương thức đối chiếu

| Phương thức | Mã (`matching_method`) | Chứng từ so sánh | Nghiệp vụ áp dụng |
| :--- | :--- | :--- | :--- |
| **Đối chiếu ba bên** | `THREE_WAY` | Đơn mua hàng – Chứng từ nhận hàng – Hóa đơn đầu vào | Mua hàng hóa qua kho |
| **Đối chiếu hai bên** | `TWO_WAY` | Đơn mua hàng – Hóa đơn đầu vào | Mua dịch vụ hoặc không theo dõi kho |
| **Đối chiếu trực tiếp** | `DIRECT` | Chứng từ mua hàng – Hóa đơn đầu vào | Mua trực tiếp không qua đơn mua |

---

## 2. Truy vấn dữ liệu tiền đề

- `GET /api/v1/purchases/reconciliations/eligible-invoices/?company_id=<uuid>`: Liệt kê các hóa đơn đầu vào ở trạng thái `VALID`, chưa bị thay thế (`is_replaced=False`) và chưa hoàn tất đối chiếu (`match_status != 'MATCHED'`).
- `GET /api/v1/purchases/reconciliations/eligible-documents/?company_id=<uuid>&invoice_id=<uuid>`: Lấy danh sách các đơn mua hàng (`PurchaseOrder`), chứng từ nhận hàng (`PurchaseReceipt`), chứng từ mua hàng (`GoodsPurchase`) cùng doanh nghiệp và cùng Nhà cung cấp với hóa đơn.
- `GET /api/v1/purchases/reconciliations/candidate-lines/?company_id=<uuid>&invoice_id=<uuid>&method=<THREE_WAY|TWO_WAY|DIRECT>&purchase_order_id=<uuid>&purchase_receipt_id=<uuid>&goods_purchase_id=<uuid>`: Tự động ghép các dòng hóa đơn với dòng chứng từ nguồn theo mã Vật tư/Hàng hóa (`Item`) và Đơn vị tính (`UOM`) theo quy tắc `BR-PUR-MAT-11`.

---

## 3. Xem trước kết quả đối chiếu (Preview / Calculate)

`POST /api/v1/purchases/reconciliations/preview/?company_id=<uuid>`

Thực hiện kiểm tra, so sánh các chỉ tiêu (số lượng, đơn giá, chiết khấu, thuế suất, tiền thuế, tiền trước thuế, tổng thanh toán) và trả về kết quả dự kiến mà **không lưu vào cơ sở dữ liệu** và **không thay đổi trạng thái chứng từ nguồn** (BR-PUR-MAT-28, AF-09).

### Request Payload:
```json
{
  "invoice": "<uuid hóa đơn đầu vào VALID>",
  "matching_method": "THREE_WAY",
  "purchase_order": "<uuid đơn mua hàng APPROVED/SENT/IN_PROGRESS/COMPLETED>",
  "purchase_receipt": "<uuid chứng từ nhận hàng CONFIRMED>",
  "goods_purchase": null,
  "lines": [
    {
      "invoice_line": "<uuid dòng hóa đơn>",
      "order_line": "<uuid dòng đơn mua>",
      "receipt_line": "<uuid dòng nhận hàng>",
      "purchase_line": null,
      "matched_quantity": "2.000000",
      "difference_reason": ""
    }
  ]
}
```

### Response:
```json
{
  "status": "MATCHED",
  "total_invoice_amount": "200.0000",
  "total_matched_amount": "200.0000",
  "total_difference_amount": "0.0000",
  "lines": [
    {
      "line_no": 1,
      "invoice_line": "<uuid>",
      "order_line": "<uuid>",
      "receipt_line": "<uuid>",
      "purchase_line": null,
      "item": "<uuid>",
      "item_name": "Tên hàng",
      "uom": "<uuid>",
      "order_quantity": "2.000000",
      "received_quantity": "2.000000",
      "invoice_quantity": "2.000000",
      "matched_quantity": "2.000000",
      "order_unit_price": "100.0000",
      "invoice_unit_price": "100.0000",
      "expected_tax_rate": "0.0000",
      "invoice_tax_rate": "0.0000",
      "document_pre_tax_amount": "200.0000",
      "invoice_pre_tax_amount": "200.0000",
      "tax_difference": "0.0000",
      "total_difference": "0.0000",
      "line_result": "MATCHED",
      "difference_reason": ""
    }
  ]
}
```

---

## 4. Thực hiện và lưu kết quả đối chiếu

`POST /api/v1/purchases/reconciliations/?company_id=<uuid>`

- Cùng cấu trúc payload với preview (có thể bổ sung `reconciliation_date`, `notes`).
- Thực hiện kiểm tra toàn vẹn dữ liệu trong một `transaction.atomic` (BR-PUR-MAT-36, 37).
- Nếu khớp toàn bộ (`MATCHED`):
  - Cập nhật số lượng đã hóa đơn (`invoiced_quantity`) trên từng dòng đơn mua (`PurchaseOrderLine`).
  - Cập nhật tổng tiền đã hóa đơn (`invoiced_amount`) và tiến độ (`invoicing_status`) trên `PurchaseOrder`.
  - Cập nhật `linked_amount` và `match_status = 'MATCHED'` trên `SupplierInvoice`.
  - Lưu liên kết dòng chứng từ (`purchase_order_line`, `receipt_line`).
  - Đối với đối chiếu trực tiếp, tạo bản ghi `PurchaseInvoiceMatch` và cập nhật `invoice_status = 'INVOICED'` trên `GoodsPurchase`.
  - Ghi Audit Log hành động `MATCH` (BR-PUR-MAT-38, 39).
  - Không tự động tạo bút toán sổ cái, công nợ hay tồn kho (BR-PUR-MAT-34).
- Nếu khớp một phần (`PARTIALLY_MATCHED`): cập nhật tiến độ tương ứng với số lượng đã đối chiếu.
- Nếu có chênh lệch (`MISMATCH`): lưu kết quả đối chiếu ở trạng thái `MISMATCH`, ghi nhận chi tiết nguyên nhân, chưa cập nhật tiến độ chính thức cho đến khi xử lý chênh lệch (AF-06).

---

## 5. Xử lý chênh lệch và vòng đời kết quả

- `POST {id}/request-resolve/`: Đề nghị chấp thuận chênh lệch (AF-08). Cần `reason` (1–500 ký tự).
- `POST {id}/resolve/`: Phê duyệt chấp thuận chênh lệch. Yêu cầu quyền `PUR.RECONCILIATION.APPROVE`. Chuyển trạng thái sang `RESOLVED`, cập nhật tiến độ chứng từ nguồn và ghi Audit Log.
- `POST {id}/recalculate/`: Đối chiếu lại sau khi người dùng sửa chứng từ nguồn (AF-07, BR-PUR-MAT-33). Tải lại số liệu mới nhất và so sánh lại toàn bộ.
- `POST {id}/cancel/`: Hủy kết quả đối chiếu (AF-09). Hoàn tác số lượng đã hóa đơn và trạng thái trên các chứng từ nguồn. Yêu cầu quyền `PUR.RECONCILIATION.CANCEL`.

Body các thao tác trên hỗ trợ `version` phục vụ khóa lạc quan (Optimistic Concurrency Control).
