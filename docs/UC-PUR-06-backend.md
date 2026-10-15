# UC-PUR-06 — API giảm giá hàng mua

Prefix: `/api/v1/purchases/purchase-discounts/`. Request cần xác thực và `company_id` trong query string. Các quyền IAM là `PUR.DISCOUNT.VIEW`, `CREATE`, `EDIT`, `SUBMIT`, `APPROVE`, `POST`, `UNPOST`, `CANCEL`.

`GET eligible-purchases/?company_id=<uuid>` liệt kê chứng từ mua đã ghi sổ và còn giá trị có thể giảm trong phạm vi dữ liệu được cấp quyền.

`GET available-lines/?company_id=<uuid>&original_purchase_id=<uuid>` trả giá trị trước thuế của từng dòng mua gốc, giá trị đã trả lại, đã giảm và còn được giảm.

`POST /api/v1/purchases/purchase-discounts/?company_id=<uuid>`:

```json
{
  "original_purchase": "<uuid chứng từ mua POSTED>",
  "document_date": "2026-10-06",
  "posting_date": "2026-10-06",
  "method": "AMOUNT",
  "handling": "REDUCE_PAYABLE",
  "reason": "Nhà cung cấp chấp thuận giảm giá",
  "adjustment_invoice": null,
  "notes": "",
  "attachments": [],
  "lines": [{
    "line_no": 1,
    "original_line": "<uuid dòng mua>",
    "pre_tax_amount": "50.0000"
  }]
}
```

Với `method: "PERCENT"`, dòng hàng dùng `rate_percent` (lớn hơn 0, tối đa 100) thay cho `pre_tax_amount`. Tỷ lệ áp dụng trên **giá trị còn được giảm**. `handling` nhận `REDUCE_PAYABLE`, `OFFSET_FUTURE` hoặc `REFUND`. Có thể chọn `debit_account`, `credit_account` trên từng dòng; nếu bỏ trống, backend đảo tài khoản của dòng mua gốc. Giá trị thuế và tổng tiền do backend tính. Tệp đính kèm là metadata có `name` và `size` byte; mỗi tệp tối đa 10 MB.

Hóa đơn điều chỉnh (`adjustment_invoice`) phải thuộc cùng nhà cung cấp và chưa liên kết với chứng từ giảm giá khác. Khi chứng từ mua gốc có hóa đơn và khoản giảm phát sinh thuế, có thể gửi duyệt khi chưa có hóa đơn điều chỉnh, nhưng phải bổ sung hóa đơn đã ghi sổ trước khi ghi sổ chứng từ giảm giá. Chứng từ `APPROVED` chỉ cho phép cập nhật riêng trường hóa đơn điều chỉnh.

`adjustment_invoice_status` nhận `PENDING_ADJUSTMENT_INVOICE`, `LINKED` hoặc `NOT_REQUIRED` theo dữ liệu thuế và hóa đơn gốc.

## Vòng đời

- `POST {id}/submit/`: kiểm tra giá trị còn được giảm, kỳ mở và workflow; tự duyệt nếu không có workflow.
- `POST {id}/approve/`, `reject/`, `request-revision/`: xử lý phê duyệt; từ chối hoặc yêu cầu sửa cần `reason`.
- `POST {id}/post/`: tạo bút toán, giảm công nợ còn mở hoặc ghi nhận khoản phải hoàn/bù trừ, điều chỉnh thuế và giá trị thực hiện của đơn mua. Không thay đổi số lượng hay tồn kho.
- `POST {id}/unpost/`: khi kỳ còn mở và chưa có dữ liệu phụ thuộc, đảo bút toán, công nợ và giá trị thực hiện; cần `reason`.
- `POST {id}/cancel/`: hủy chứng từ chưa ghi sổ.

Body mỗi action cần `{"version": <version hiện tại>}`. Chứng từ đã bỏ ghi sổ có thể sửa rồi ghi sổ lại.
