# Rà danh sách lựa chọn Tiền mặt và Tiền gửi — 12/10/2026

Tiêu chí: đủ component trên màn hình; không yêu cầu xử lý Cất/in/backend.

| Nhóm | Kết quả kiểm tra | Giới hạn |
|---|---|---|
| Đối tượng | Bổ sung bảng6cột và tìm kiếm, đã chọn thửKH002 | Một số nhánh chưa đối chiếu từng dropdown nguồn |
| Nhân viên | Bảng4cột và tìm kiếm đã hiện | Thông tin điện thoại mẫu thiếu đểtrống |
| Tài khoản chi/nhận | Bảng4cột/tìm kiếm, chọnBIDV đã kiểm | Danh sách nhận chưa đối chiếu nguồn riêng |
| TK Nợ/Có | 208gợi ý theo catalog đãaudit, giữ nhập tay | Kiểu mở native khác MISA, chưa pixelverified |
| Kỳ thu/chi | Bổ sung38kỳ giữ5mục cũ | Tests legacy/date đạt, cầnUIQA các kỳ thêm |
| Thuế/bảo hiểm/lương/hóa đơn | Mở đủ8form Cash/Bank, lưu options và bảng | Options dữ liệu mẫu, chưa mọi lựa chọn nguồn |
| Khế ước vay/cho vay | Mở10tab và hợp đồng tín dụng | Vẫn cóquickadd placeholder |
| Báo cáo | Mở10Cash/12Bank cùng tham số từng báo cáo cópopup | Không coi mọi reportuserextra là nguồnMISA |
| Thêm nhanh | Xác địnhprompt vàalert còn trong nhiều nhánh | CHƯA đủ form MISA, cần triển khai |

Bằng chứng: work/cash-bank-special-form-choices-2026-10-12.json, credit-choices-review-2026-10-12.json, lend-choices-review-2026-10-12.json, cash-report-popups-2026-10-12.json, bank-report-popups-2026-10-12.json.

Chưa thể chốt đã rà/hoàn thiện mọi ngóc ngách. Những thiếu cụ thể còn lại: các form Thêm nhanh đối tượng, nhân viên, tài khoản; dropdown trong hợp đồng/khếước cần đối chiếu lựa chọn riêng; UI38kỳ mới và nativeTK.
