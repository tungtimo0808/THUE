# UC-AR-02 — API theo dõi công nợ khách hàng

Các API chỉ đọc, dùng quyền `AR.RECEIVABLE.VIEW` và giới hạn theo chi nhánh được cấp.

## Tra cứu

`GET /api/v1/accounts-receivable/receivables/customer-debts/`

Tham số bắt buộc: `company_id`. Tùy chọn: `from_date`, `to_date` (ISO 8601, mặc định đầu tháng đến hôm nay), `branch_id`, `customer_id`, `customer_group`, `account_id`, `currency_id` (các ID cho phép lặp hoặc phân tách bằng dấu phẩy), `status` (`OPEN`, `PARTIALLY_PAID`, `PAID`), `overdue_only=true`, `include_zero=true`.

Kết quả `rows` phân theo khách hàng, chi nhánh, tài khoản và loại tiền. Mỗi dòng có `opening`, `increase`, `reduction`, `payment`, `netting`, `closing`, `overdue`, `advance`, `age` và `receivables`. Các khoản phải thu kèm lịch thanh toán, chứng từ phát sinh, tuổi nợ và cảnh báo chênh lệch. Tiền ứng trước có `advances` riêng, không trừ tự động. `refund_due=null` khi chưa có dữ liệu hoàn tiền riêng trong phân hệ.

`GET /api/v1/accounts-receivable/receivables/customer-debts/detail/?company_id=...&customer_id=...` trả các dòng của một khách hàng. Có thể dùng các bộ lọc ngày, chi nhánh, tài khoản và loại tiền như API tra cứu.

Phát sinh được tính theo ngày có hiệu lực: nguồn theo ngày hạch toán; khoản thu theo ngày phân bổ có hiệu lực; bù trừ và điều chỉnh theo ngày ghi sổ. Tổng đầu kỳ lấy trước `from_date`, phát sinh kỳ bao gồm hai đầu ngày. Lịch thanh toán lịch sử lấy từ các phiên bản thay đổi đến `to_date`.

## Xuất và in

- `GET /api/v1/accounts-receivable/receivables/customer-debts/export/` tải XLSX, cần `AR.RECEIVABLE.EXPORT`.
- `GET /api/v1/accounts-receivable/receivables/customer-debts/print/` trả HTML để in, cần `AR.RECEIVABLE.PRINT`.

Cả hai dùng cùng tham số tra cứu và cùng phép tính với API màn hình. Quyền xuất/in độc lập với quyền xem, đồng thời kết quả chỉ gồm dữ liệu chi nhánh được phép xem.

## Giới hạn dữ liệu nguồn

Phiếu thu hiện chưa gắn chi nhánh. Với tài khoản chỉ có quyền theo chi nhánh, khoản ứng trước chỉ hiện khi khớp duy nhất với một nhóm công nợ được phép xem. Khoản còn phải hoàn chưa có bảng nghiệp vụ riêng; API trả `null` thay vì ghi sai là 0. Chứng từ lịch sử trước khi có các trường ngày ghi sổ/phân bổ mới dùng ngày tạo làm mốc gần đúng.
