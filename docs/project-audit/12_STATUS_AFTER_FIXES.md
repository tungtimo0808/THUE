# 12. Trạng thái sau khi sửa (03/11/2026)

Các tài liệu 01–11 ghi nhận tình trạng lúc audit ngày 02/11/2026. Tài liệu này cho biết những gì đã thay đổi sau đó. Toàn bộ thay đổi nằm trên nhánh `tanh`, chưa commit.

## Kết quả kiểm thử

| Hạng mục | Lúc audit | Hiện tại |
|---|---|---|
| Test backend trên PostgreSQL | 1.375 test, 61 không đạt | **1.401 test, tất cả đạt** |
| Kịch bản nghiệp vụ qua API thật | Chưa có | 13 kịch bản đạt, số liệu khớp tính tay |
| Màn hình báo cáo trên Chrome | Chưa kiểm tra | 134/134 mở được, không lỗi JavaScript hay lỗi máy chủ |
| `tsc`, `vite build` | Đạt | Đạt |
| Làm mới phiên đăng nhập (Playwright) | Chưa chạy | Đạt sau khi rút ngắn token |

## Lỗi đã sửa

| Mã audit | Nội dung | Cách sửa |
|---|---|---|
| SEC-01..07 | Rò dữ liệu giữa công ty, tự cấp quyền bằng header, `COMPANY_ADMIN` bị chặn | Lớp `reporting/report_access.py` dùng chung cho mọi nhóm báo cáo, quyền lấy từ IAM. Xóa toàn bộ quyền đọc từ header và fallback công ty |
| — | Đọc lần chạy báo cáo của công ty khác bằng id | Công ty được xác định từ chính lần chạy |
| SEC-08, 12, 13 | Token dài hạn, không giới hạn đăng nhập, cấu hình lỏng | Token 30 phút / 7 ngày, throttle cho đăng nhập và đăng ký, mặc định an toàn, tắt tài liệu API khi `DEBUG=False` |
| TEC-01 | `FOR UPDATE` lỗi trên PostgreSQL | 84 chỗ chuyển sang `select_for_update(of=("self",))` |
| TEC-02..04 | 11 route trả 500 | Sửa import, trường sắp xếp, tên quan hệ |
| ACC-01 | B02 sai TK 642 | Chọn công thức theo chế độ kế toán của công ty |
| ACC-02 | Sai số đề nghị xuất hóa đơn | Gọi đúng hàm cấp số, không nuốt lỗi |
| RPT-01 | 47 màn báo cáo không gọi API | Màn hình chung `LiveReportScreen` cho 134 tiêu đề, API phân tích đa chi nhánh, đa kỳ |
| RPT-02 | 30 báo cáo bán hàng cùng 328 dòng | Gom theo cột nhóm của từng báo cáo, bỏ giá trị giả, báo rõ khi chưa có nguồn |
| OPS-01, 02, 05, TST-01 | Sao lưu, logging, seed mặc định, CI | Script `scripts/backup_postgres.sh`, `LOGGING`, `SEED_DEMO_DATA` mặc định tắt, job `backend:test` (chưa chặn merge) |

## Lỗi mới tìm thấy và đã sửa

| Lỗi | Hậu quả | Cách sửa |
|---|---|---|
| Giá vốn trong báo cáo bán hàng luôn bằng 0 | Lãi gộp bằng doanh thu | Đọc đúng `cogs_amount`, trừ phần hàng trả lại. Khớp TK 632 |
| Công ty mới không ghi sổ được bán hàng có thuế | Hạch toán vào TK tổng hợp 3331 | TK đã có tài khoản con không nhận bút toán. Migration `general_ledger.0022` sửa dữ liệu cũ |
| Phát hành hóa đơn điện tử là giả lập | Sinh số và link tra cứu giả | Tắt ngoài môi trường test (`EINVOICE_SIMULATION`). Thêm ghi nhận hóa đơn đã phát hành ở phần mềm khác |
| Tính giá FIFO thất bại với phiếu xuất từ bán hàng | Không chạy được tính giá cuối kỳ | Phiếu xuất ghi kèm tài khoản giá vốn và hàng tồn kho |
| Dashboard phải thu sai 45.980.000 | Cột điều chỉnh có hai quy ước dấu | Suy dấu từ số dư thực. Sửa trạng thái công nợ tương tự |
| Xem chi tiết số liệu lỗi với người dùng thường | Gọi sai tham số hàm quyền | Gọi đúng `has_effective_permission` |
| Năm 2026 viết cứng trong trạng thái ban đầu của 52 màn hình | Sang năm mới sai kỳ | Lấy theo năm hiện tại |

## Kịch bản nghiệp vụ đã chứng minh

Chạy qua API thật trên công ty thiết lập như khách hàng, do chủ công ty thao tác. File `backend/reporting/test_end_to_end_accounting.py`.

| Nghiệp vụ | Kết quả kiểm chứng |
|---|---|
| Mua, bán, thu, chi | Sổ cái, kho, công nợ, quỹ, báo cáo khớp tính tay. Bảng cân đối cân |
| Hàng bán trả lại | Kho, công nợ, doanh thu, thuế hoàn đúng |
| Khóa kỳ | Chứng từ bán hàng mới bị từ chối |
| Số dư đầu kỳ | Vào sổ và cộng dồn đúng |
| Kết chuyển cuối kỳ | Lãi 20.000.000 chuyển sang 421, TK 5–6–9 về 0 |
| FIFO | Giá vốn 76.000.000 (10 × 6tr + 2 × 8tr), tồn 64.000.000 |
| Thuế GTGT đầu ra | 5.000.000, khớp TK 3331 |
| Khấu hao đường thẳng | 10.000.000 vào Nợ 642 / Có 214 |

## Còn tồn đọng

| Hạng mục | Ghi chú |
|---|---|
| Kết nối hóa đơn điện tử, T-VAN, ngân hàng | Cần nhà cung cấp |
| Email SMTP | Chưa có thì khách không nhận được mã xác thực |
| Kế toán trưởng đối chiếu | B02, B09, các báo cáo, tuân thủ TT99/TT133 |
| Lương, giá thành | Module còn rất nhỏ, chưa kiểm chứng |
| Tỷ giá | Có test riêng tính tay. Chưa chạy trên công ty mới |
| Báo cáo thiếu nguồn | Nhân viên bán hàng khi không qua đơn hàng, sàn thương mại điện tử, bảo hành, lãi/lỗ theo đơn hàng và hợp đồng |
| 373 nút không có hành động | Chủ yếu nút biểu tượng trong form. Không vô hiệu hóa hàng loạt vì có nút được xử lý ở thẻ cha |
| Thông báo thành công giả | Chỉ xuất hiện ở chế độ xem thử khi chưa đăng nhập; người dùng đăng nhập luôn đi qua API |
| Bộ Playwright | 36 đạt, 84 lỗi, 17 bỏ qua. Lỗi có sẵn từ trước: chạy cùng nhóm bài trên bản gốc cũng lỗi y hệt. Đa số so khớp giao diện mô phỏng với số chứng từ mẫu, cổng 5173, công ty giả `minh-an`. Cần viết lại theo giao diện hiện tại |
| Cột `adjustment_amount` của phải thu | Vẫn hai quy ước dấu; báo cáo và trạng thái đã tránh được |
| CI | Job test cần chạy thử trên GitLab, rồi bỏ `allow_failure` |
