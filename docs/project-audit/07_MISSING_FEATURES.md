# 07. Chức năng còn thiếu

"Thiếu" ở đây nghĩa là không tìm thấy trong code, hoặc chỉ có giao diện. Lời gọi HTTP ra ngoài duy nhất của backend là trợ lý AI, nên các kết nối hóa đơn điện tử, T-VAN và ngân hàng hiện chưa có thật dù đã có bảng cấu hình `ConnectorConfig`.

## Theo vai trò

| Vai trò | Nhu cầu chưa đáp ứng |
|---|---|
| Kế toán viên | Phiếu thu chi lỗi trên PostgreSQL, sổ nhật ký thu chi chưa có dữ liệu trên màn hình |
| Kế toán trưởng | Không xem được báo cáo công nợ, tiền, kho, tài sản; B09 chưa đủ; chưa có đối chiếu tự động trước khóa sổ |
| Giám đốc | Dashboard có, nhưng báo cáo phân tích tăng trưởng chưa có dữ liệu |
| Nhân sự | Bảng lương quá sơ khai |
| Thủ kho | Ít test, chưa có kiểm chứng giá xuất |
| Quản trị hệ thống | Không có sao lưu, giám sát, log tập trung |
| Khách hàng triển khai | Chưa có công cụ nhập số dư đầu kỳ được kiểm chứng, tài liệu vận hành |

## Danh sách

| ID | Chức năng thiếu | Mục đích | Giá trị | Ưu tiên |
|---|---|---|---|---|
| MF-01 | Sao lưu và khôi phục tự động | Bảo vệ dữ liệu kế toán | Bắt buộc khi có dữ liệu thật | P0 |
| MF-02 | Dữ liệu thật cho 47 báo cáo chưa gọi API | Tránh số giả | Điều kiện để tin báo cáo | P1 |
| MF-03 | Kết nối hóa đơn điện tử | Phát hành hóa đơn hợp lệ | Bắt buộc với doanh nghiệp bán hàng | P1 |
| MF-04 | Gửi tờ khai qua T-VAN | Nộp thuế từ hệ thống | Giảm thao tác | P2 |
| MF-05 | Kết nối ngân hàng, nhập sao kê | Đối chiếu tự động | Giảm nhập tay | P2 |
| MF-06 | Hoàn thiện B09 | Đủ bộ BCTC | Bắt buộc khi quyết toán | P1 |
| MF-07 | Gửi email thật | Mời người dùng, đặt lại mật khẩu | Mặc định `locmem` nên không gửi được nếu chưa cấu hình | P1 |
| MF-08 | Lương đầy đủ: BHXH, TNCN, bút toán | Tính lương | Cần cho doanh nghiệp có nhân sự | P2 |
| MF-09 | Giá thành sản xuất | Phục vụ doanh nghiệp sản xuất | Mở rộng khách hàng | P2 |
| MF-10 | Kiểm tra sức khỏe sổ sách trước khóa kỳ | Phát hiện lệch GL và sổ chi tiết | Giảm sai sót | P2 |
| MF-11 | Giám sát lỗi, log tập trung | Phát hiện sự cố | Giảm thời gian xử lý | P1 |
| MF-12 | Nhập số dư đầu kỳ có kiểm chứng | Chuyển đổi từ phần mềm cũ | Điều kiện để khách hàng bắt đầu | P1 |
| MF-13 | Hàng đợi tác vụ cho xuất báo cáo lớn | Tránh quá tải | Ổn định | P3 |
| MF-14 | Phân loại chứng từ bằng AI, đọc hóa đơn OCR | Giảm nhập liệu | Cạnh tranh | P4 |
| MF-15 | Hoàn thiện trợ lý hỏi đáp số liệu | Tra cứu tự nhiên | Hỗ trợ lãnh đạo | P4 |
| MF-16 | Phát hiện bất thường trong bút toán | Hỗ trợ soát xét | Giảm rủi ro | P4 |

**Đính chính:** backend đã có trợ lý AI dạng hội thoại (`AIConversation`, `AIInteraction`, route `ai`, `ai-conversations`, màn hình `LiveCommonHub.tsx`). Hàm `_call_ai_provider` gửi câu hỏi, lịch sử và chỉ số dashboard tới `COMMON_AI_PROVIDER_URL`, và không gọi nếu URL trống. Chưa kiểm tra chất lượng câu trả lời, phân quyền dữ liệu đưa vào AI, hay việc chuyển dữ liệu tài chính ra nhà cung cấp ngoài. Chưa thấy OCR hay phát hiện bất thường.
