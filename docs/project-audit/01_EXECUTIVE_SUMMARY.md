# 01. Tóm tắt điều hành

## Kết luận

**Thue ERP chưa dùng được cho doanh nghiệp thật và chưa triển khai được cho khách hàng.** Điểm tổng là **49/100**. Dự án có phạm vi rất rộng nhưng còn hai lỗi chặn:

1. **Dữ liệu các công ty không được cách ly ở báo cáo.** Bất kỳ ai đăng nhập cũng đọc được báo cáo bán hàng, mua hàng của công ty khác, không cần là thành viên. Đã chứng minh trên PostgreSQL.
2. **Các nghiệp vụ cốt lõi lỗi trên PostgreSQL.** Lập phiếu thu, phiếu chi, phân bổ, điều chỉnh công nợ và cơ cấu tổ chức trả lỗi vì câu lệnh khóa dòng không tương thích. PostgreSQL là database triển khai thật.

## Tổng quan dự án

| Hạng mục | Thực trạng |
|---|---|
| Công nghệ | Django/DRF, PostgreSQL 16, React/TypeScript/Vite, Docker Compose, GitLab CI |
| Quy mô | 19 ứng dụng backend, 3.268 route API, khoảng 288 nghìn dòng TSX |
| Kiểm thử backend | 1.375 test, **61 test không đạt** (24 failure, 37 error) |
| Build | `tsc` 0 lỗi, `oxlint` 0 lỗi, `vite build` đạt, `makemigrations --check` không thay đổi |
| Báo cáo | 142 báo cáo API đã chạy thử, 47/69 component báo cáo ở frontend không gọi API |

## Điểm theo trọng số

Điểm do người audit đánh giá dựa trên bằng chứng trong bộ tài liệu này, không phải kết quả đo tự động.

| Tiêu chí | Trọng số | Điểm | Quy đổi | Căn cứ chính |
|---|---:|---:|---:|---|
| Đầy đủ nghiệp vụ | 25% | 60 | 15,00 | Phạm vi rộng, nhiều màn hình chỉ có giao diện, không có kết nối ngoài |
| Chính xác dữ liệu và kế toán | 25% | 50 | 12,50 | Chứng từ đã ghi sổ được bảo vệ, nhưng B02 sai với TK 642 và luồng thu chi lỗi |
| Backend/API | 15% | 55 | 8,25 | Cấu trúc khá, nhưng lỗi Postgres và 11 route trả 500 |
| Frontend/UI/UX | 10% | 55 | 5,50 | Giao diện rộng, nhiều dữ liệu mẫu, file quá lớn |
| Phân quyền và bảo mật | 10% | 15 | 1,50 | Lỗ hổng xuyên công ty, tin header do client gửi |
| Kiểm thử | 10% | 45 | 4,50 | Nhiều test nhưng CI không chạy backend test |
| Khả năng vận hành | 5% | 40 | 2,00 | Có Docker, chưa có sao lưu, giám sát, logging |
| **Tổng** | **100%** | | **49,25** | |

## Rủi ro lớn nhất

| # | Rủi ro | Hậu quả | Mức bằng chứng |
|---|---|---|---|
| 1 | Rò dữ liệu giữa công ty qua báo cáo (SEC-01, SEC-02) | Lộ doanh thu, khách hàng, giá mua | Đã chứng minh |
| 2 | Tự cấp quyền bằng header HTTP (SEC-03) | Đọc báo cáo công nợ, tiền, kho không cần quyền | Đã chứng minh |
| 3 | `FOR UPDATE` lỗi trên PostgreSQL (TEC-01) | Không ghi sổ được phiếu thu, phiếu chi, phân bổ | Đã chứng minh |
| 4 | `COMPANY_ADMIN` bị chặn 95 báo cáo (SEC-04) | Người dùng hợp lệ không xem được báo cáo | Đã chứng minh |
| 5 | B02 tính sai TK 642 (ACC-01) | Sai kết quả kinh doanh | Test thất bại, nguyên nhân từ đọc code |
| 6 | Chưa có sao lưu và khôi phục (OPS-01) | Mất dữ liệu kế toán không phục hồi được | Không tìm thấy trong repo |
| 7 | CI không chạy backend test (TST-01) | Lỗi lên `main` mà không bị chặn | Đã chứng minh |
| 8 | Báo cáo có giao diện nhưng dữ liệu mẫu (RPT-01) | Người dùng tin vào số không có thật | Đọc code, duyệt tay một phần |

## Cần xử lý ngay

1. Sửa cách ly công ty và bỏ toàn bộ cơ chế đọc quyền từ header, tham số `mock_permissions`.
2. Sửa `select_for_update` trên quan hệ nullable, rồi chạy lại toàn bộ test trên PostgreSQL.
3. Cho kiểm tra quyền báo cáo dùng IAM thật.
4. Thêm job backend test PostgreSQL vào CI và chặn merge khi đỏ.
5. Sửa các route 500 và công thức B02.
6. Dán nhãn hoặc ẩn các báo cáo chưa có dữ liệu thật.

## Trả lời câu hỏi kết luận

| Câu hỏi | Trả lời |
|---|---|
| Dùng thực tế được chưa? | **Chưa.** Có thể dùng để demo và kiểm thử nội bộ với dữ liệu giả |
| Triển khai cho khách hàng được chưa? | **Chưa.** Phải xong P0 và P1, cùng nghiệm thu của kế toán trưởng |
| Nghiệp vụ nào chưa chính xác? | Thu chi và công nợ trên PostgreSQL, B02, đánh số đề nghị xuất hóa đơn. Báo cáo bán hàng đáng ngờ. Xem [03_ACCOUNTING_AUDIT.md](03_ACCOUNTING_AUDIT.md) |
| Chức năng nào còn thiếu? | Kết nối hóa đơn điện tử, T-VAN, ngân hàng, sao lưu, nhiều báo cáo chỉ có giao diện, phần B09. Xem [07_MISSING_FEATURES.md](07_MISSING_FEATURES.md) |
| Rủi ro lớn nhất? | Rò dữ liệu giữa các công ty |
| Cần bao nhiêu giai đoạn? | **5 giai đoạn (P0–P4).** Không thể thử nghiệm với khách hàng trước khi xong P0. Triển khai chính thức cần xong P1 |

Những phần chưa đủ bằng chứng được liệt kê trong [AUDIT_MASTER_INDEX.md](AUDIT_MASTER_INDEX.md).
