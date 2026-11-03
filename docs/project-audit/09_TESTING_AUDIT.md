# 09. Kiểm tra kiểm thử

## Kết quả đã chạy

| Hạng mục | Kết quả |
|---|---|
| Backend trên PostgreSQL, chạy tuần tự | **1.375 test: 1.314 đạt, 24 failure, 37 error** |
| `tsc` | 0 lỗi, tính cả 7 file sửa chưa commit |
| `oxlint` | 0 lỗi, nhiều cảnh báo |
| `vite build` | Đạt |
| `manage.py makemigrations --check` | Không thay đổi |
| `manage.py check --deploy` | 275 vấn đề, chạy với `DEBUG=True` nên chưa phản ánh production |
| Playwright (133 file) | **Chưa chạy** |

Chưa sửa test nào trong quá trình audit. SQLite không được dùng làm kết quả.

## Phân loại 61 test không đạt

Mục "Lỗi nghiệp vụ" là đánh giá sơ bộ của người audit. Chưa rà từng test ở mức dòng.

| Nhóm | Số lượng | Kết luận | Ghi chú |
|---|---:|---|---|
| `FOR UPDATE` trên PostgreSQL (phải thu, phải trả, tổ chức) | 35 | **Lỗi code thật** | Xem TEC-01 |
| Đối chiếu công nợ khách hàng | 10 | Nhiều khả năng test phụ thuộc ngày, chưa chứng minh | Ngày trong kỳ là mùng 1 + 2 ngày, lớn hơn hôm nay 02/11 |
| `general_ledger.tests.test_uc_gl_13` | 3 | **Lỗi code nhiều khả năng** | B02, TK 642 |
| Đánh số đề nghị xuất hóa đơn | Thuộc nhóm còn lại | **Lỗi code** | Rơi về `DXHD` |
| Từ chối yêu cầu tham gia | Thuộc nhóm còn lại | **Lỗi code** | 200 thay vì 403 |
| Module đã tắt vẫn cho tạo | Thuộc nhóm còn lại | **Lỗi code** | |
| Thứ tự kiểm tra khi bootstrap | Thuộc nhóm còn lại | Test hoặc thứ tự validate | Mã số thuế báo lỗi trước |
| `debt_offset` EX01-22 | Thuộc nhóm còn lại | Chưa rõ | Khác thông báo |
| `supplier_debt_tracking` | Thuộc nhóm còn lại | Nhiều khả năng dữ liệu test | `ck_ap_document_due_date` |
| `DrilldownUcRpt14Tests` | Thuộc nhóm còn lại | Test cần cập nhật xác thực | 401 sau khi bắt buộc thành viên |
| `test_future_effect` tổ chức | Thuộc nhóm còn lại | Hệ quả của lỗi tổ chức | |

Các test này không được sửa chỉ để qua. Mỗi test cần xác định test sai hay nghiệp vụ sai.

## Độ phủ theo rủi ro

| Khu vực | Nhận xét |
|---|---|
| Cách ly công ty ở báo cáo | **Không phát hiện được lỗ hổng** dù có test. Một số test có thể đang dùng header làm bộ giả lập quyền, cần rà khi sửa SEC-03 |
| Kho | 20 test cho module quyết định giá vốn |
| Tiền mặt | 5 test |
| Lương, giá thành | 5 và 3 test |
| Kịch bản xuyên module | Chưa có bộ end-to-end được chứng minh từ chứng từ đến BCTC |
| Đồng thời, tải | Chưa có bằng chứng |

## Vấn đề quy trình

| ID | Vấn đề | Mức độ | Đề xuất |
|---|---|---|---|
| TST-01 | CI không có backend test job | Nghiêm trọng | Thêm job PostgreSQL, chặn merge khi đỏ |
| TST-02 | Chạy song song lỗi `cannot pickle traceback` | Thấp | Chạy tuần tự hoặc sửa để chạy song song |
| TST-03 | Test phụ thuộc ngày hệ thống | Trung bình | Cố định thời gian trong test |
| TST-04 | Playwright không chạy trong CI | Cao | Chạy nhóm smoke trên staging |
| TST-05 | Không có bộ đối chiếu kế toán tính tay | Cao | Dựng bộ dữ liệu vàng do kế toán xác nhận |
