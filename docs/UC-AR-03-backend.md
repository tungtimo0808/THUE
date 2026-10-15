# UC-AR-03 — Ghi nhận thu tiền khách hàng

Backend cung cấp `/api/v1/accounts-receivable/customer-receipt-vouchers/`.
Tạo hoặc sửa phiếu chỉ lưu bản nháp; không đổi số dư quỹ, tiền gửi, sổ cái hoặc công nợ.

## API

- `GET` danh sách, `GET /{id}/` chi tiết, `POST` tạo, `PATCH /{id}/` sửa.
- `POST /{id}/submit/`, `approve/`, `reject/`, `request-revision/`, `recall/`, `cancel/` cho vòng đời duyệt.
- `POST /{id}/post/` ghi sổ. Gửi lặp cho phiếu đã ghi sổ trả lại cùng kết quả.
- `GET /suggest-allocations/?company_id=...&branch_id=...&customer_id=...&currency_id=...&account_id=...&amount=...` đề xuất theo hạn sớm nhất, sau đó ngày hạch toán và mã công nợ.

Mọi yêu cầu cần `company_id` ở query hoặc `company` khi tạo. Quyền riêng: `AR.RECEIPT_VOUCHER.VIEW/CREATE/EDIT/SUBMIT/APPROVE/POST/CANCEL`.
Nếu doanh nghiệp cấu hình DocumentType `AR.RECEIPT_VOUCHER`, yêu cầu duyệt được đưa vào Approval Workflow và người duyệt phải xử lý đúng tác vụ được giao.

Trường tạo chính: `company`, `branch`, `customer`, `method` (`CASH` hoặc `BANK`), `cash_fund` hoặc `bank_account`, `credit_account`, `document_date`, `posting_date`, `amount`, `exchange_rate`, `purpose` (`DEBT` hoặc `ADVANCE`), `description`, `lines` (mỗi dòng có `receivable`, `schedule` tùy chọn, `amount`). `number`, `currency`, `debit_account`, tổng phân bổ, tiền chưa phân bổ và tiền quy đổi được hệ thống xác định.
Số phiếu dùng `DocumentNumberingRule` của doanh nghiệp/chi nhánh nếu có hiệu lực; mặc định là `AR-RC-YYYY-00001`.

Khi ghi sổ, backend kiểm tra lại kỳ kế toán, tài khoản, giao dịch ngân hàng trùng, số dư khoản phải thu và từng đợt. Cùng một transaction tạo phiếu thu AR, giao dịch quỹ hoặc tiền gửi, bút toán GL và phân bổ công nợ. Phần chưa phân bổ nằm tại phiếu thu; ứng trước không có dòng phân bổ. Phiếu thu từ phân hệ Tiền có thể phân bổ sau bằng `POST /api/v1/accounts-receivable/receipts/{id}/allocate/` mà không ghi nhận lại tiền.

Chênh lệch tỷ giá dùng tài khoản 515 hoặc 635 đang hoạt động; thiếu tài khoản thì chặn ghi sổ. Không ghi nhận lại doanh thu hoặc thuế.
