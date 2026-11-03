# 04. Kiểm tra báo cáo

## Tổng hợp

| Phân loại | Số lượng | Ghi chú |
|---|---:|---|
| API trả dữ liệu với `COMPANY_ADMIN` | 47 | 36 bán hàng, 11 mua hàng (1 báo cáo mua hàng 0 dòng) |
| API từ chối `COMPANY_ADMIN` | 95 | Công nợ 49, tiền 17, kho 15, tài sản 14 |
| Báo cáo thuế chưa chạy theo mã | 15 | 7 AS-IS, 8 TO-BE |
| Component báo cáo không gọi API | 47/69 | Giao diện trống hoặc dữ liệu mẫu |
| File chứa hằng dữ liệu `DEFAULT_`, `BASE_`, `MOCK_` | 49 | Chưa rà từng file |

## Bất thường cần lưu ý

- **30/36 báo cáo bán hàng trả đúng 328 dòng**, kể cả các báo cáo có bản chất khác nhau như chi tiết, so sánh, phân tích. Nhiều báo cáo có thể chỉ trả cùng một tập dữ liệu thô. Cần kiểm tra nội dung từng báo cáo.
- Một lần trước, tôi báo "130/142 báo cáo có dữ liệu". Con số đó đo bằng superuser ở tầng API, không phải trên màn hình. Không nên dùng làm mức hoàn thành.
- Bảng xem trước chung của Trung tâm báo cáo có dữ liệu mẫu "Dell Vostro".

## Báo cáo tài chính và màn hình đã duyệt

| Mã báo cáo | Tên báo cáo | Có dữ liệu | Đã đối chiếu | Trạng thái |
|---|---|---|---|---|
| B01-DN | Tình hình tài chính | Có | Tổng cân đối, so mẫu MISA | Có giao diện và dữ liệu thật. Dòng 134 khác mẫu |
| B02-DN | Kết quả kinh doanh | Có | So mẫu. Test `test_uc_gl_13` thất bại | Có lỗi: TK 642 |
| B03-DN | Lưu chuyển tiền tệ trực tiếp | Có | Mã 70 khớp tiền | Có giao diện và dữ liệu thật |
| B03-DN-GT | Lưu chuyển tiền tệ gián tiếp | Có | Mã 70 khớp tiền | Có giao diện và dữ liệu thật |
| B09-DN | Thuyết minh | Một phần | Chưa | Có dữ liệu, chưa xác minh. Nhiều phần chưa đủ |
| TT133 | Bộ báo cáo tài chính TT133 | Chưa kiểm tra đủ | Chưa | Có dữ liệu, chưa xác minh |
| Sổ tiền gửi | Sổ tiền gửi ngân hàng | Có | Duyệt tay | Có giao diện và dữ liệu thật |
| Bảng kê số dư | Bảng kê số dư ngân hàng | Có | Duyệt tay | Có giao diện và dữ liệu thật |
| Số dư theo ngày | Số dư tiền theo ngày | Không | Duyệt tay | Dữ liệu mẫu, hardcode |
| S03a1, S03a2 | Nhật ký thu, chi tiền | Không trên màn hình | Duyệt tay | Có giao diện, chưa có dữ liệu. API RPT-0036 tồn tại |
| Chuyển tiền nội bộ | Chi tiết chuyển tiền nội bộ | Không | Duyệt tay | Có giao diện, chưa có dữ liệu |

## Component báo cáo chưa gọi API

Nhóm tên tiêu biểu: `MisaCashReceiptJournalReport`, `MisaCashDisbursementJournalReport`, `MisaDailyCashBalanceReport`, `MisaInternalFundTransferDetailReport`, nhóm `Borrow*`, `Lend*`, `Purchase*`, `Payables*`, `MultiBranch*`, `MultiPeriod*`, nhóm phân tích tăng trưởng, `MisaSalesSummaryReports`, `MisaPurchaseContractReports`.

Phân loại cả nhóm: **Có giao diện chưa có dữ liệu** hoặc **Dữ liệu mẫu, hardcode**. Chưa phân tách được từng file.

## Danh sách API theo mã

"Đã đối chiếu" đều là **Chưa**: bảng này chỉ cho biết API chạy được ở vai trò `COMPANY_ADMIN`, không xác nhận số liệu đúng.

| Mã báo cáo | Nhóm | Tên báo cáo | Có dữ liệu | Đã đối chiếu | Trạng thái |
|---|---|---|---|---|---|
| RPT-0158 | Tài sản | Bảng tính phân bổ công cụ dụng cụ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0159 | Tài sản | Sổ theo dõi công cụ dụng cụ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0160 | Tài sản | Bảng tính phân bổ công cụ dụng cụ theo năm | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0161 | Tài sản | Báo cáo chi tiết giảm công cụ dụng cụ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0162 | Tài sản | Sổ theo dõi công cụ dụng cụ theo đơn vị sử dụng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0163 | Tài sản | Tình hình phân bổ chi phí trả trước | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0164 | Tài sản | Bảng tính phân bổ chi phí trả trước | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0165 | Tài sản | Tình hình phân bổ chi phí trả trước theo năm | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0166 | Tài sản | Báo cáo đối chiếu sổ theo dõi CCDC, chi phí trả trước và sổ cái | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0167 | Tài sản | S21-DN: Sổ tài sản cố định | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0168 | Tài sản | Sổ tài sản cố định | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0169 | Tài sản | Thẻ tài sản cố định | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0170 | Tài sản | Bảng tính khấu hao tài sản cố định theo năm | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0171 | Tài sản | Báo cáo đối chiếu sổ tài sản và sổ cái | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0052 | Công nợ | Tổng hợp công nợ phải trả nhà cung cấp | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0053 | Công nợ | Báo cáo chi tiết công nợ phải trả theo mặt hàng tĩnh | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0054 | Công nợ | Báo cáo chi tiết công nợ phải trả theo hóa đơn | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0055 | Công nợ | Báo cáo chi tiết công nợ phải trả theo mặt hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0056 | Công nợ | Sổ chi tiết công nợ phải trả nhà cung cấp | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0057 | Công nợ | Báo cáo phân tích công nợ phải trả theo tuổi nợ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0058 | Công nợ | Biên bản đối chiếu và xác nhận công nợ phải trả | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0059 | Công nợ | Báo cáo chi tiết công nợ phải trả theo tuổi nợ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0060 | Công nợ | Thông báo công nợ nhà cung cấp | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0062 | Công nợ | Tổng hợp công nợ phải trả theo nhân viên | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0063 | Công nợ | Chi tiết công nợ phải trả theo nhân viên | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0065 | Công nợ | Chi tiết công nợ phải trả theo đơn mua hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0066 | Công nợ | Tổng hợp công nợ phải trả theo đơn mua hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0067 | Công nợ | Tổng hợp công nợ phải trả theo hợp đồng mua | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0069 | Công nợ | Chi tiết công nợ phải trả theo hợp đồng mua | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0071 | Công nợ | Chi tiết công nợ phải trả theo công trình | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0072 | Công nợ | Tổng hợp công nợ phải trả theo công trình | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0073 | Công nợ | Báo cáo đối chiếu chứng từ công nợ phải trả và chứng từ thanh toán | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0092 | Công nợ | Tổng hợp công nợ phải thu khách hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0093 | Công nợ | Báo cáo phân tích công nợ phải thu theo tuổi nợ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0094 | Công nợ | Tổng hợp công nợ phải thu theo nhóm khách hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0095 | Công nợ | Chi tiết công nợ phải thu theo mặt hàng tỉnh | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0096 | Công nợ | Biên bản đối chiếu và xác nhận công nợ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0097 | Công nợ | Chi tiết công nợ phải thu theo mặt hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0098 | Công nợ | Sổ chi tiết công nợ phải thu khách hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0099 | Công nợ | Tổng hợp công nợ phải thu chi tiết giảm trừ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0100 | Công nợ | Thông báo công nợ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0101 | Công nợ | Chi tiết công nợ phải thu theo khoản giảm trừ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0102 | Công nợ | Báo cáo ngày thanh toán theo khách hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0103 | Công nợ | Tổng hợp thanh toán công nợ khách hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0104 | Công nợ | Thông báo công nợ Mẫu 2 | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0105 | Công nợ | Báo cáo chi tiết công nợ phải thu theo tuổi nợ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0106 | Công nợ | Báo cáo chi tiết công nợ phải thu theo hóa đơn | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0107 | Công nợ | Giấy đề nghị thanh toán công nợ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0111 | Công nợ | Tổng hợp công nợ phải thu theo nhân viên và khách hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0112 | Công nợ | Tổng hợp công nợ phải thu theo nhân viên | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0115 | Công nợ | Tổng hợp thanh toán công nợ khách hàng theo nhân viên | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0116 | Công nợ | Chi tiết công nợ phải thu theo nhân viên | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0119 | Công nợ | Tổng hợp công nợ phải thu theo đơn vị kinh doanh | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0120 | Công nợ | Chi tiết công nợ phải thu theo đơn vị kinh doanh | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0123 | Công nợ | Tổng hợp công nợ phải thu theo đơn đặt hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0127 | Công nợ | Chi tiết công nợ phải thu theo đơn đặt hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0130 | Công nợ | Tình hình thanh toán hợp đồng theo đợt | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0131 | Công nợ | Chi tiết công nợ phải thu theo hợp đồng bán | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0138 | Công nợ | Tổng hợp công nợ phải thu theo hợp đồng bán | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0139 | Công nợ | Tổng hợp phải thu và phải trả theo hợp đồng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0140 | Công nợ | Chi tiết công nợ phải thu theo công trình | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0141 | Công nợ | Tổng hợp công nợ phải thu theo công trình | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0142 | Công nợ | Báo cáo đối chiếu chứng từ công nợ phải thu và chứng từ thanh toán | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0143 | Kho | Tổng hợp tồn kho | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0144 | Kho | Tổng hợp tồn trên nhiều kho (Dạng bảng chéo) | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0145 | Kho | Tổng hợp tồn kho theo nhiều đơn vị tính | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0146 | Kho | Tổng hợp nhập xuất tồn trên nhiều kho | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0147 | Kho | Tổng hợp tồn kho theo nhóm VTHH | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0148 | Kho | Báo cáo tồn theo chứng từ nhập chưa chuyển kho | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0149 | Kho | Sổ chi tiết vật tư hàng hóa | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0150 | Kho | Sổ chuyển kho nội bộ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0151 | Kho | Báo cáo tiến độ sản xuất | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0152 | Kho | Tổng hợp xuất kho theo lệnh sản xuất | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0153 | Kho | Báo cáo đối chiếu kho và sổ cái | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0154 | Kho | Đối chiếu chi phí mua hàng trên chứng từ chi phí và chứng từ mua hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0155 | Kho | Đối chiếu nhập xuất giữa kế toán và thủ kho | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0156 | Kho | Báo cáo đối chiếu giá thành và giá trị nhập kho | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0157 | Kho | Đối chiếu giá trị nhập, xuất kho của lệnh lắp ráp, tháo dỡ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0030 | Tiền | S03a1-DN: Sổ nhật ký thu tiền (Tiền mặt) | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0031 | Tiền | Báo cáo dòng tiền | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0032 | Tiền | Bảng kê số dư tiền theo ngày (Tiền mặt) | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0033 | Tiền | S03a2-DN: Sổ nhật ký chi tiền (Tiền mặt) | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0034 | Tiền | Sổ kế toán chi tiết quỹ tiền mặt | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0035 | Tiền | Bảng kê số dư tiền theo ngày (Tiền gửi) | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0036 | Tiền | S03a1-DN: Sổ nhật ký thu tiền (Tiền gửi) | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0037 | Tiền | Sổ tiền gửi ngân hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0038 | Tiền | S03a2-DN: Sổ nhật ký chi tiền (Tiền gửi) | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0039 | Tiền | Bảng kê số dư ngân hàng | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0040 | Tiền | Sổ chi tiết chuyển tiền nội bộ | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0041 | Tiền | Báo cáo tổng hợp tình hình khế ước vay | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0042 | Tiền | S34-DN: Sổ chi tiết tiền vay | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0043 | Tiền | Bảng kê chứng từ theo khế ước vay | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0044 | Tiền | Tổng hợp lịch trả nợ khế ước vay | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0045 | Tiền | Báo cáo tổng hợp tình hình khế ước cho vay | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0046 | Tiền | Bảng kê chứng từ theo khế ước cho vay | Chưa rõ | Chưa | Có lỗi: từ chối COMPANY_ADMIN (SEC-04) |
| RPT-0047 | Mua hàng | Sổ chi tiết mua hàng | 120 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0048 | Mua hàng | Tổng hợp mua hàng theo mặt hàng | 12 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0049 | Mua hàng | Tổng hợp mua hàng theo mặt hàng và nhà cung cấp | 36 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0050 | Mua hàng | Tổng hợp mua hàng theo nhà cung cấp | 3 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0051 | Mua hàng | Sổ nhật ký mua hàng | 32 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0061 | Mua hàng | Tổng hợp mua hàng theo mặt hàng và nhân viên | 12 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0064 | Mua hàng | Tình hình thực hiện đơn mua hàng | 120 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0068 | Mua hàng | Tình hình thực hiện hợp đồng mua | 3 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0070 | Mua hàng | Tổng hợp mua hàng theo nhà cung cấp và công trình | 36 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0074 | Mua hàng | Đối chiếu chi phí từ chứng từ chi phí sang chứng từ mua hàng | 0 dòng | Chưa | Có giao diện chưa có dữ liệu |
| RPT-0075 | Mua hàng | Đối chiếu chi phí từ chứng từ mua hàng sang chứng từ chi phí | 1 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0076 | Bán hàng | S35-DN: Sổ chi tiết bán hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0077 | Bán hàng | Tổng hợp bán hàng theo khách hàng | 7 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0078 | Bán hàng | Sổ chi tiết bán hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0079 | Bán hàng | So sánh số lượng, doanh số theo thời gian – Khách hàng và mặt hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0080 | Bán hàng | Tổng hợp bán hàng theo mặt hàng | 12 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0081 | Bán hàng | Tổng hợp bán hàng theo nhóm khách hàng | 1 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0082 | Bán hàng | Tổng hợp bán hàng theo mặt hàng và khách hàng | 84 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0083 | Bán hàng | Phân tích doanh thu sản phẩm/nhóm sản phẩm theo thời gian | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0084 | Bán hàng | Tổng hợp bán hàng theo mã thống kê và mặt hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0085 | Bán hàng | Tổng hợp xuất kho bán hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0086 | Bán hàng | Tổng hợp bán hàng theo sàn thương mại điện tử | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0087 | Bán hàng | So sánh theo thời gian: Nhân viên và mặt hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0088 | Bán hàng | Sổ nhật ký bán hàng | 140 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0089 | Bán hàng | Tổng hợp bán hàng theo nhóm mặt hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0090 | Bán hàng | Tổng hợp bán hàng theo địa phương | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0091 | Bán hàng | Sổ chi tiết theo dõi tình trạng bảo hành | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0108 | Bán hàng | Tổng hợp bán hàng theo nhân viên và khách hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0109 | Bán hàng | Tổng hợp bán hàng theo mặt hàng và nhân viên | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0110 | Bán hàng | Sổ chi tiết bán hàng theo nhân viên | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0113 | Bán hàng | Tổng hợp bán hàng theo nhân viên, khách hàng và mặt hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0114 | Bán hàng | Tổng hợp bán hàng theo nhân viên | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0117 | Bán hàng | Tổng hợp bán hàng theo đơn vị kinh doanh | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0118 | Bán hàng | Tổng hợp bán hàng theo đơn vị kinh doanh và mặt hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0121 | Bán hàng | Tình hình thực hiện đơn đặt hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0122 | Bán hàng | Báo cáo tổng hợp lãi/lỗ theo đơn hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0124 | Bán hàng | Thống kê tồn kho và số lượng đặt hàng chưa giao | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0125 | Bán hàng | Báo cáo chi tiết tình hình thực hiện đơn đặt hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0126 | Bán hàng | Báo cáo chi tiết lãi/lỗ theo đơn hàng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0128 | Bán hàng | Tình hình thực hiện hợp đồng bán | 6 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0129 | Bán hàng | Tổng hợp doanh số mặt hàng theo hợp đồng bán | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0132 | Bán hàng | Báo cáo tổng hợp lãi/lỗ theo hợp đồng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0133 | Bán hàng | Tổng hợp tình hình chi theo hợp đồng bán | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0134 | Bán hàng | Báo cáo chi tiết lãi/lỗ theo hợp đồng | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0135 | Bán hàng | Tổng hợp chi phí hợp đồng bán theo khoản mục chi phí | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0136 | Bán hàng | Tổng hợp doanh số hợp đồng theo đơn vị | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |
| RPT-0137 | Bán hàng | Sổ chi tiết tài khoản theo hợp đồng và khoản mục chi phí | 328 dòng | Chưa | Có dữ liệu, chưa xác minh |

Báo cáo thuế (15 báo cáo: RPT-0003, RPT-0175 đến RPT-0180, RPT-TAX-08 đến RPT-TAX-15): chưa chạy theo mã, chưa đủ bằng chứng để phân loại.
