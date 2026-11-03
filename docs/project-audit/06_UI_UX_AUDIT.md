# 06. Kiểm tra giao diện

## Phạm vi

Đã duyệt tay các màn hình đăng nhập, đăng ký, báo cáo tài chính, nhóm báo cáo Ngân hàng. Phần còn lại đánh giá qua code. Chưa kiểm thử trên điện thoại, chưa kiểm tra trợ năng, chưa thử với người dùng thật.

## Phát hiện

| ID | Vấn đề | Vị trí | Mức độ | Bằng chứng | Đề xuất |
|---|---|---|---|---|---|
| UX-01 | Báo cáo hiển thị dữ liệu mẫu giống số thật | 47/69 component báo cáo, 49 file chứa hằng mẫu | Cao | Tìm kiếm code, duyệt nhóm Ngân hàng | Ẩn hoặc gắn nhãn "Chưa có dữ liệu" |
| UX-02 | Thông báo thành công không gắn với API | 252 dòng trong 63 file | Cao, cần rà | Tìm kiếm văn bản, có thể có trường hợp hợp lệ | Chỉ báo thành công sau khi server xác nhận |
| UX-03 | Bảng xem trước có "Dell Vostro" trong công ty điện thoại, tivi | Trung tâm báo cáo | Trung bình | Thấy trong code | Xóa dữ liệu mẫu |
| UX-04 | Nút có thể không có hành động | 168 nút không có `onClick` cùng dòng | Chưa đủ bằng chứng | Tìm một dòng, có thể báo sai | Rà có công cụ AST |
| UX-05 | Dùng `alert`, `confirm` của trình duyệt | 60 vị trí | Thấp | Tìm kiếm code | Dùng hộp thoại chung |
| UX-06 | Hardcode năm 2026 | 41 file | Trung bình | Tìm kiếm code | Lấy theo kỳ kế toán hiện tại |
| UX-07 | Menu không ẩn theo quyền | Chỉ `CompanyAdminWorkspace.tsx` có mẫu kiểm tra quyền | Trung bình, chưa đủ bằng chứng | Tìm kiếm theo vài tên hàm | Kiểm tra lại, ẩn menu theo quyền từ server |
| UX-08 | In bằng `document.write` | `misa-api-writes.ts:7144` | Thấp | Đọc code | Dùng mẫu in chung |
| UX-09 | File quá lớn, khó sửa giao diện đồng nhất | `MisaLedgerWorkspace` khoảng 20,5 nghìn dòng | Trung bình | Đếm dòng | Tách component |

## Điểm đạt

- Có `ErrorBoundary`.
- Dashboard gọi dữ liệu từ server. Backend dashboard dùng IAM đúng cách.
- Đăng nhập, đăng ký, đặt lại mật khẩu đã dùng chung một layout.
- Báo cáo tài chính có khung biểu mẫu và xuất Excel, PDF theo mẫu MISA.
