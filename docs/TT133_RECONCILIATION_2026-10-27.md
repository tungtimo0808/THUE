# Đối chiếu báo cáo TT133 trên dữ liệu cục bộ — 27/10/2026

Đã chạy cả 7 mẫu TT133 cho hai doanh nghiệp có bút toán ghi sổ năm 2026 trong `backend/db.sqlite3`: `ABC` (33 bút toán) và `COMP_PUR` (38 bút toán). Đây là dữ liệu mẫu/thử nghiệm trong workspace, không phải xác nhận báo cáo pháp lý của doanh nghiệp. Bản sao cơ sở dữ liệu được dùng để thử migration trước khi áp dụng migration 0019 lên cơ sở dữ liệu cục bộ.

| Kiểm tra | ABC | COMP_PUR |
| --- | ---: | ---: |
| B01a: Tổng tài sản | 12.407.929.500 | -14.000.000 |
| B01a: Tổng nguồn vốn | 11.545.067.500 | 18.500.000 |
| Chênh lệch tài sản trừ nguồn vốn | 862.862.000 | -32.500.000 |
| B03: lưu chuyển tiền thuần trực tiếp | -81.212.500 | -36.000.000 |
| B03: lưu chuyển tiền thuần gián tiếp | -87.612.500 | -36.000.000 |
| Bút toán có ngày sau 27/10/2026 | 32 | 8 |

## Việc còn cần kế toán kiểm tra

- `ABC` đang dùng hệ thống tài khoản khác TT133; cần chọn đúng chế độ báo cáo. B01a không cân, B03 có một giao dịch tiền chưa phân loại, số dư tiền cuối kỳ không khớp sổ cái và hai phương pháp B03 lệch 6.400.000.
- `COMP_PUR` có tổng tài sản âm và B01a không cân. Kiểm tra số dư tiền, hàng tồn kho, bút toán kết chuyển và những tài khoản chưa được ánh xạ.
- B01b: sổ công nợ TK 131 và 331 của `ABC`, TK 131 của `COMP_PUR` chưa khớp số dư sổ cái ở cấp đối tượng. App giữ phân loại tạm, đánh dấu các dòng cần bổ sung và chỉ chuyển khoản phải thu/phải trả sang dài hạn khi số dư khớp và hạn thanh toán vượt 12 tháng.
- B09: năm mục thuyết minh bằng lời của mỗi doanh nghiệp còn trống. App hiện cho nhập và lưu từng mục; nội dung phải do kế toán cung cấp và duyệt. Không tự tạo nội dung thay doanh nghiệp.
- Năm 2026 chưa kết thúc và dữ liệu mẫu có bút toán hạch toán sau ngày kiểm tra. Không dùng bản đối chiếu này làm báo cáo đã khóa sổ hoặc để nộp.

## Kiểm thử kỹ thuật

- 7/7 mẫu TT133 tạo được kết quả trên cả hai doanh nghiệp sau migration.
- Kiểm thử backend xác nhận số liệu sổ cái, phân loại công nợ khi khớp, cảnh báo khi lệch, lưu/đọc B09, phân tách doanh nghiệp và quyền truy cập.
- Kiểm thử giao diện xác nhận mở 7 tab và lưu thuyết minh B09.
