# UC-PUR-05 — API hàng mua trả lại

Prefix: `/api/v1/purchases/purchase-returns/`. Request cần xác thực và `company_id` trong query string. Các quyền IAM là `PUR.RETURN.VIEW`, `CREATE`, `EDIT`, `SUBMIT`, `APPROVE`, `POST`, `UNPOST`, `CANCEL`.

## Tạo chứng từ

`GET available-lines/?company_id=<uuid>&original_purchase_id=<uuid>` trả các dòng hàng của chứng từ mua đã ghi sổ cùng số lượng đã mua, đã trả và còn được trả.

`POST /api/v1/purchases/purchase-returns/?company_id=<uuid>`:

```json
{
  "original_purchase": "<uuid chứng từ mua POSTED>",
  "document_date": "2026-10-06",
  "posting_date": "2026-10-06",
  "warehouse": "<uuid kho nếu mua qua kho, null nếu mua trực tiếp>",
  "recipient": "Người nhận",
  "reason": "Sai quy cách",
  "handling": "REDUCE_PAYABLE",
  "notes": "",
  "attachments": [],
  "lines": [{
    "line_no": 1,
    "original_line": "<uuid dòng mua>",
    "quantity": "2.000000",
    "debit_account": "<uuid tùy chọn>",
    "credit_account": "<uuid tùy chọn>"
  }]
}
```

`handling` nhận `REDUCE_PAYABLE`, `OFFSET_FUTURE` hoặc `REFUND`. Nếu bỏ tài khoản Nợ/Có, backend đảo tài khoản Có/Nợ của dòng mua gốc. Chi nhánh, nhà cung cấp, hóa đơn gốc, hàng hóa, đơn vị tính, đơn giá, chiết khấu và thuế được lấy từ chứng từ mua; tiền được tính lại trên lượng trả. Tệp đính kèm là metadata với `name` và `size` byte; mỗi tệp tối đa 10 MB.

## Vòng đời

- `POST {id}/submit/`: kiểm tra kỳ mở, lượng còn được trả và tồn kho; gửi workflow hoặc tự duyệt.
- `POST {id}/approve/`, `reject/`, `request-revision/`: xử lý phê duyệt. Từ chối/yêu cầu sửa cần `reason`.
- `POST {id}/post/`: trong một giao dịch tạo phiếu xuất nếu hàng qua kho, bút toán đảo hàng mua, giảm công nợ còn mở hoặc ghi nhận khoản nhà cung cấp phải hoàn/bù trừ, cập nhật tiến độ đơn mua và ghi nhận số thuế đầu vào cần điều chỉnh trên chứng từ trả.
- `POST {id}/unpost/`: khi kỳ còn mở và chưa có thanh toán, bù trừ hay điều chỉnh công nợ phụ thuộc, đảo các phát sinh trên và đưa chứng từ về `APPROVED`; cần `reason`.
- `POST {id}/cancel/`: hủy chứng từ chưa ghi sổ.

Body mỗi action cần `{"version": <version hiện tại>}`. Chứng từ đã bỏ ghi sổ có thể sửa rồi ghi sổ lại. Hóa đơn gốc được giữ liên kết và chứng từ ở trạng thái `PENDING_ADJUSTMENT_INVOICE` cho đến khi có hóa đơn điều chỉnh.
