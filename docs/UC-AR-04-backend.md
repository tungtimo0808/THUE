# UC-AR-04 — Phân bổ khoản thu

API: `/api/v1/accounts-receivable/allocation-vouchers/`.

- `GET` danh sách, `GET /{id}/` chi tiết, `POST` tạo Nháp, `PATCH /{id}/` sửa Nháp.
- `POST /{id}/post/` ghi sổ phân bổ; gửi lặp cho phiếu đã ghi sổ trả cùng kết quả.
- `POST /{id}/unpost/` bỏ ghi sổ với `reason`; kỳ phân bổ phải mở và không có nghiệp vụ phụ thuộc phát sinh sau.
- `POST /{id}/cancel/` hủy phiếu Nháp với `reason`.
- `GET /suggest-allocations/?company_id=...&branch_id=...&receipt_id=...` đề xuất theo hạn thanh toán sớm nhất, sau đó ngày hạch toán và mã khoản phải thu.

Quyền riêng: `AR.ALLOCATION_VOUCHER.VIEW/CREATE/EDIT/POST/UNPOST/CANCEL`. Số phiếu lấy từ `DocumentNumberingRule` của doanh nghiệp hoặc chi nhánh; mặc định `AR-AL-YYYY-00001`.

Tạo phiếu cần `company`, `branch`, `customer`, `receipt` và ít nhất một `line` gồm `receivable`, `schedule` và `amount`. `allocation_date` mặc định ngày hiện tại và không được trước ngày thu tiền; `description` mặc định theo chứng từ thu và khách hàng. `schedule` bắt buộc khi khoản phải thu có lịch thanh toán. `currency`, `credit_account`, ngày thu, tiền đã thu, đã phân bổ, có thể phân bổ và các giá trị quy đổi được xác định từ dữ liệu nguồn.

Lưu Nháp chỉ kiểm tra dữ liệu, không giữ chỗ số dư. Ghi sổ khóa khoản thu và công nợ, kiểm tra lại giới hạn và kỳ kế toán, tạo phân bổ có hiệu lực và bút toán chênh lệch tỷ giá nếu cần. Không tạo thêm phiếu thu, giao dịch quỹ hoặc tiền gửi. Bỏ ghi sổ giữ bản ghi phân bổ với `reversed_at`, hoàn lại số dư và đảo bút toán tỷ giá trong một giao dịch cơ sở dữ liệu.

Phiếu thu từ phân hệ Tiền cần liên kết đến giao dịch đã ghi sổ. Nếu nguồn cũ chưa lưu tài khoản công nợ, hệ thống chỉ suy ra khi mọi dòng phân bổ có cùng một tài khoản. Không xác định được tài khoản thì từ chối lưu để tránh phân bổ sai.
