# 03. Kiểm tra kế toán

Tài liệu này do người audit kỹ thuật lập, chưa có kế toán trưởng xác nhận.

## Hạn chế của phép đối chiếu

Dữ liệu thử là công ty điện tử giả lập, được seed ghi trực tiếp vào bảng. Các số khớp dưới đây **chỉ cho thấy báo cáo đọc đúng dữ liệu**. Chúng không chứng minh rằng chứng từ tự hạch toán đúng.

| Đối chiếu | Sổ cái | Sổ chi tiết / báo cáo | Kết quả |
|---|---:|---:|---|
| TK 131 và công nợ phải thu | 3.766.675.000 | 3.766.675.000 | Khớp |
| TK 331 và công nợ phải trả | 3.078.658.000 | 3.078.658.000 | Khớp |
| TK 156 và tồn kho | 1.301.540.000 | 1.301.540.000 | Khớp |
| Tiền và mã 70 lưu chuyển tiền tệ (trực tiếp, gián tiếp) | 5.922.418.000 | 5.922.418.000 | Khớp |

## Bảng kiểm tra nghiệp vụ

| Nghiệp vụ | Kết quả kiểm tra | Sai lệch | Rủi ro | Đề xuất |
|---|---|---|---|---|
| Phiếu thu, phân bổ phải thu | **Lỗi trên PostgreSQL.** `accounts_receivable/receipt_voucher.py:296` | Không ghi sổ được, 12 test lỗi riêng phần phiếu thu | Nghiêm trọng | Khóa dòng bằng `select_for_update(of=("self",))` hoặc bỏ `select_related` nullable |
| Phiếu chi, phân bổ, điều chỉnh phải trả | **Lỗi trên PostgreSQL.** `adjustment_voucher_services.py:171`, `allocation_services.py:220`, `payment_voucher_services.py` | Không ghi sổ được | Nghiêm trọng | Như trên |
| B02, TK 642 | **Test `test_uc_gl_13` thất bại 3 lần.** `general_ledger/services.py:18060` đổi tiền tố tài khoản theo chế độ; TK lá 642 cho kết quả 0 và 6421 ở TT99 bị xử lý như chi phí bán hàng | Chi phí QLDN có thể bằng 0 | Nghiêm trọng | Sửa ánh xạ. Thống nhất một bộ tính |
| Hai bộ tính báo cáo tài chính | Tồn tại ở `general_ledger` và `reporting` | Chưa đo | Cao | Giữ một nguồn tính duy nhất |
| Đối chiếu công nợ khách hàng | 10 test thất bại, khả năng do ngày cố định lớn hơn hôm nay | Chưa rõ | Trung bình | Xác định test sai hay nghiệp vụ sai, không sửa test để qua |
| Đánh số đề nghị xuất hóa đơn | Test sales 14 thất bại, hàm rơi về mã `DXHD` do nuốt ngoại lệ | Sai quy tắc số chứng từ | Cao | Không nuốt ngoại lệ |
| Sửa, xóa chứng từ đã ghi sổ | **Đạt.** JournalEntry, Cash, Bank, GoodsPurchase, Payment, SalesOrder đều bị từ chối 400 | Không | Thấp | Duy trì. `GoodsSale` và `SalesInvoice` không có route chuẩn nên chưa kiểm tra |
| Sửa danh mục đã phát sinh | **Không đạt một phần.** PATCH đổi được tên TK 111 và tên khách hàng đã phát sinh, trả 200 | Tên trên chứng từ cũ có thể đổi theo | Trung bình | Lưu vết thay đổi, cân nhắc khóa các trường quan trọng |
| Khóa sổ | Kiểm tra kỳ thấy rõ trong `fixed_assets`, `general_ledger`, `tax_management`, `bank_management` | Module khác dựa vào lúc ghi GL | Cao, chưa đủ bằng chứng | Chạy kịch bản ghi lùi vào kỳ đã khóa cho từng loại chứng từ |
| Giá vốn FIFO, bình quân | Có cấu hình, có chính sách âm kho. Chưa chạy kịch bản | Chưa đủ bằng chứng | Cao | Kịch bản tính tay đối chiếu |
| Thuế GTGT | `VatLedgerEntry` không có trong dữ liệu thử | Chưa đủ bằng chứng | Cao | Seed và đối chiếu tờ khai 01/GTGT |
| TNDN, TNCN | Chưa kiểm tra | Chưa đủ bằng chứng | Cao | Kế toán thuế xác nhận |
| Khấu hao TSCĐ, phân bổ CCDC | 71 test có trong module. 8 route liên quan kỳ phân bổ trả 500 | Chưa đo số | Cao | Sửa route, tính tay một bộ tài sản |
| Lương | Chưa kiểm tra | Chưa đủ bằng chứng | Cao | Kiểm tra BHXH, TNCN, bút toán lương |
| Kết chuyển cuối kỳ | Chưa chạy độc lập | Chưa đủ bằng chứng | Cao | Kiểm tra 911 và 421 |
| Ngoại tệ, chênh lệch tỷ giá | Chưa kiểm tra | Chưa đủ bằng chứng | Cao | Kịch bản đánh giá lại cuối kỳ |
| Đảo và hủy bút toán | Có nhiều hàm đảo, hủy. Chưa chạy kịch bản độc lập | Chưa đủ bằng chứng | Trung bình | Kiểm tra số dư sau đảo |

## Sai khác mẫu biểu đã biết

| Báo cáo | Sai khác |
|---|---|
| B09-DN (TT99) | Một số tab thuyết minh chưa đầy đủ |
| B01 TT99, dòng 134 | Tên dòng khác mẫu MISA |
| B01b TT133 | Khoản vay đang xếp toàn bộ vào dài hạn |
