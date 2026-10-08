# Audit frontend Sổ Việt so với MISA — 08/10/2026

## Phạm vi và nguyên tắc

Mục tiêu toàn bộ yêu cầu **chưa hoàn thành**. Chỉ bổ sung frontend, không sửa backend, không sửa dữ liệu hoặc thiết lập trên MISA. Giữ các màn hình, danh mục và chức năng hiện có của người dùng.

Thư mục dự án: D:\THUẾ\FRONTEND. Dev server đang chạy trên http://127.0.0.1:5173. Trang nguồn: https://actapp.misa.vn/app/RP/ReportList.

Ba file đã có thay đổi của người dùng trước khi bắt đầu và không được chỉnh trong đợt này: MisaDebtReconciliationReport.tsx, MisaPayablesAgingAnalysisReport.tsx, MisaSupplierPayablesLedgerReport.tsx.

## Kết quả kiểm kê

Danh mục có 263 mục trong 15 nhóm, không tính nhóm Yêu thích. Số mục theo nhóm trùng danh mục MISA đã tải ở tài khoản này. Đây là số **mục trong danh mục**, có báo cáo được liệt kê ở nhiều nhóm; không phải 263 báo cáo độc lập. Một số tên cũ viết Số thay vì Sổ hoặc có dấu cách trong mã biểu mẫu; danh mục Yêu thích cũng có biến thể tên trùng. Chưa sửa các tên cũ.

| Nhóm | Mục trong danh mục | Màn hình riêng | Bảng mẫu chung |
|---|---:|---:|---:|
| Báo cáo tài chính | 11 | 11 | 0 |
| Báo cáo phân tích | 18 | 18 | 0 |
| Tiền mặt | 5 | 5 | 0 |
| Tiền gửi | 12 | 12 | 0 |
| Mua hàng | 29 | 29 | 0 |
| Bán hàng | 67 | 3 | 64 |
| Kho | 15 | 1 | 14 |
| Công cụ dụng cụ | 9 | 0 | 9 |
| Tài sản cố định | 5 | 0 | 5 |
| Tiền lương | 3 | 0 | 3 |
| Thuế | 6 | 0 | 6 |
| Giá thành | 40 | 0 | 40 |
| Tổng hợp | 26 | 0 | 26 |
| Ngân sách | 4 | 0 | 4 |
| Báo cáo đối chiếu | 13 | 3 | 10 |

Tổng cộng: 82 mục có nhánh render riêng; 181 mục vẫn mở bảng mẫu chung. Có nhánh render riêng **không đồng nghĩa** đã khớp bộ lọc, các lựa chọn con hoặc mọi thao tác MISA.

Đã lưu cấu trúc của 79 báo cáo: 67 Bán hàng, 3 hợp đồng mua, 3 Tiền lương, 6 Thuế. Hồ sơ ghi nhãn tham số, checkbox và tiêu đề bảng cùng colspan/rowspan, không ghi dữ liệu khách hàng/nhà cung cấp thực tế. Các lựa chọn bên trong dropdown chưa được audit toàn bộ. Loại parameterOnly mới quan sát hộp tham số, chưa kiểm tra mẫu in cuối cùng. Một số tiêu đề bảng động có bản sao do cơ chế cuộn/fixed columns của MISA; cần đọc và khử bản sao trước khi dùng để triển khai.

## Sáu màn hình đã bổ sung

1. Tổng hợp công nợ phải trả theo hợp đồng mua.
2. Tình hình thực hiện hợp đồng mua.
3. Chi tiết công nợ phải trả theo hợp đồng mua.
4. Tổng hợp bán hàng theo mặt hàng.
5. Tổng hợp bán hàng theo khách hàng.
6. Tổng hợp bán hàng theo mặt hàng và khách hàng.

Các màn hình có drawer tham số riêng; kỳ báo cáo và ngày dạng DD/MM/YYYY; các bảng chọn nhà cung cấp, hợp đồng, hàng hóa, khách hàng theo mẫu; nhóm và nhân viên khi phù hợp; cấu trúc cột đúng theo tiêu đề đã quan sát. Dữ liệu đều là fixture riêng của frontend. Lọc và tổng cộng hoạt động trên fixture; số dư công nợ được tách theo nhà cung cấp/hợp đồng/tài khoản. Hỗ trợ tìm kiếm, ẩn/hiện cột, lưu và khôi phục tham số trên trình duyệt, xuất CSV và gọi hộp in trình duyệt. Chưa kiểm tra toàn bộ hộp lưu/gửi/in/thiết lập của MISA. CSV là CSV mở bằng Excel, chưa phải tệp XLSX.

## Xác minh

- 8 kiểm tra logic đạt: kỳ báo cáo và năm nhuận; khoảng ngày; tổ hợp điều kiện chọn; số dư đầu kỳ; số dư tách đối tượng; cộng gộp bút toán; doanh thu thuần/lãi gộp; tổng hợp theo mặt hàng và khách hàng.
- Đã kiểm tra trên Edge: mở cả sáu màn hình; chọn đối tượng và nhân viên; tổng cộng; nhập khoảng ngày không hợp lệ; định dạng ngày Việt Nam; ẩn và hiện cột; tìm kiếm không có kết quả; lưu và mở lại tham số sau khi về danh mục.
- TypeScript kiểm tra riêng các file mới đạt; Vite đóng gói frontend được.
- npm run build đầy đủ bị chặn bởi các lỗi TypeScript có sẵn, gồm biến/import không dùng và lỗi kiểu trong các file cũ. Chưa sửa các lỗi đó. Không nới tsconfig để né lỗi.
- Browser download event không trả về hoàn tất trong lần kiểm tra CSV; cần kiểm tra thêm tải CSV và bản in hoàn chỉnh.

## Thứ tự tiếp tục

1. Bổ sung 64 báo cáo Bán hàng còn đang mở bảng mẫu chung. Dùng misa-report-schemas.json để bắt đầu, nhưng kiểm tra các lựa chọn con và kết quả in trên MISA trước khi kết luận khớp đầy đủ.
2. Bổ sung 3 báo cáo Tiền lương và 6 Thuế theo hồ sơ đã đọc. Tiền lương có chọn bảng lương; bảng kê 02/TNDN cần mở mẫu in thực tế.
3. Khảo sát và bổ sung Kho, Công cụ dụng cụ, Tài sản cố định, Giá thành, Tổng hợp, Ngân sách và Báo cáo đối chiếu.
4. Audit các báo cáo đã có màn hình riêng: nhiều drawer cũ còn là nội dung cố định, một số nút chỉ thông báo. Không coi danh mục đủ tên là đủ chức năng frontend.
5. Audit từng phân hệ ngoài Báo cáo: tab, bảng, form chứng từ, menu tiện ích, thiết lập cột, popup và trạng thái rỗng/lỗi. Chưa thực hiện đợt này.
6. Kiểm tra layout ở các kích thước màn hình và luồng bàn phím; xử lý lỗi build cũ theo từng phần, giữ nguyên thay đổi đang làm của người dùng.

## Các file mới quan trọng

- src/MisaPurchaseContractReports.tsx; src/purchase-contract-data.ts.
- src/MisaSalesSummaryReports.tsx; src/sales-summary-data.ts.
- src/ReportDateInput.tsx; src/report-date.ts; src/report-presets.ts.
- src/misa-purchase-contract-reports.css.
- tests/purchase-contract-data.test.ts; tests/sales-summary-data.test.ts; tests/report-date.test.ts.
- MisaReportCenterWorkspace.tsx chỉ thêm import, nhánh render và xử lý input tìm kiếm; không xóa nhánh cũ.

Lệnh kiểm tra logic: node --experimental-strip-types --test tests/purchase-contract-data.test.ts tests/sales-summary-data.test.ts tests/report-date.test.ts.
