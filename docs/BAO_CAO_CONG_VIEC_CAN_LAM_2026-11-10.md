**BÁO CÁO CÁC VIỆC CẦN LÀM TIẾP THEO**

Ngày lập: 10/11/2026  
Dự án: Sổ Việt ERP – Quản lý kế toán và thuế  
Phạm vi: giao diện hiện tại, đăng nhập – đăng ký, môi trường Docker và kiểm thử.

**1. Các việc đã hoàn thành**

- Chạy PostgreSQL, backend, frontend và worker bằng Docker; backend và cơ sở dữ liệu có trạng thái healthy tại lần kiểm tra gần nhất.
- Đổi phông chữ sang Roboto, thống nhất màu nhấn xanh và nền trắng; thay các emoji trang trí bằng icon Lucide.
- Chỉnh trang đăng nhập, đăng ký và khôi phục mật khẩu về form ở giữa trang theo yêu cầu mới nhất; bỏ sidebar và taskbar đã thêm ở các trang này.
- Sửa cách hiển thị hộp thông báo trên màn hình nhỏ và lỗi tràn ngang ở phân hệ Tổng hợp.
- Tạo tài khoản kiểm thử riêng, có quyền quản trị tại doanh nghiệp Demo; đã xác nhận đăng nhập API thành công và lấy được doanh nghiệp được phép truy cập.
- Đã thực hiện kiểm tra hiển thị trên 51 màn hình ở đợt rà soát chung. Sau lần chỉnh form cuối, đã kiểm tra thêm ba trang tài khoản ở ba kích thước màn hình, gồm hiện/ẩn mật khẩu và tràn ngang.

**2. Các việc cần làm theo thứ tự ưu tiên**

| Mức độ | Công việc | Cơ sở và phạm vi | Điều kiện hoàn thành |
| --- | --- | --- | --- |
| Ưu tiên 1 | Sửa chức năng “Ghi nhớ phiên đăng nhập” | `LiveLogin.tsx` có checkbox nhưng chưa truyền lựa chọn này vào `signIn`; `ApiSession.tsx` hiện luôn ghi phiên vào `localStorage`. | Chọn và bỏ chọn tạo ra hành vi lưu phiên tương ứng; khôi phục phiên, làm mới token và đăng xuất hoạt động thống nhất. |
| Ưu tiên 1 | Hoàn tất kiểm thử đăng ký và xác thực email | Kiểm tra tài khoản mới, trùng email/số điện thoại, mật khẩu không hợp lệ, OTP sai/hết hạn và gửi lại OTP. Cấu hình email mặc định trong Compose dùng bộ nhớ tạm. | Hoàn thành một lượt đăng ký bằng email nhận được mã thật trên môi trường kiểm thử; thông báo lỗi rõ ràng và không tạo tài khoản trùng. |
| Ưu tiên 1 | Kiểm thử quên và đặt lại mật khẩu | Rà soát toàn bộ luồng yêu cầu OTP, xác nhận OTP và đặt mật khẩu mới. | Mật khẩu mới đăng nhập được, mật khẩu cũ bị từ chối, OTP đã dùng không sử dụng lại được và phiên cũ bị thu hồi đúng thiết kế. |
| Ưu tiên 1 | Kiểm thử luồng sử dụng bằng tài khoản Demo | Thực hiện đăng nhập qua giao diện, chọn doanh nghiệp, mở phân hệ, tải lại trang và đăng xuất. | Người kiểm thử thực hiện được toàn bộ luồng bằng tài khoản đã cấp và chỉ truy cập được doanh nghiệp được phân quyền. |
| Ưu tiên 2 | Nghiệm thu giao diện đăng nhập – đăng ký | Đối chiếu mẫu về màu xanh, nền trắng, Roboto, icon, kích thước form và khoảng cách. | Người dùng xác nhận giao diện; kiểm tra thêm trạng thái đang gửi, lỗi xác thực và nội dung dài trên điện thoại. |
| Ưu tiên 2 | Rà soát các hộp thoại và màn hình con | Đợt kiểm tra 51 màn hình tập trung vào hiển thị. Cần mở thêm form tạo/sửa, bộ lọc, hộp chọn và xem trước báo cáo. | Các luồng chính có chữ, icon, nút và màu trạng thái thống nhất; không che nút hoặc tràn nội dung ngoài vùng cuộn. |
| Ưu tiên 2 | Chuẩn hóa kiểm thử tự động | Playwright hiện tham chiếu file trạng thái đăng nhập lưu sẵn; cần tạo phiên mới khi chạy kiểm thử. | Bộ kiểm thử tài khoản chạy lại được với tài khoản test; bao phủ đăng nhập, đăng ký, khôi phục mật khẩu và các kích thước màn hình quan trọng. |
| Ưu tiên 2 | Kiểm thử một chu trình nghiệp vụ thực tế | Chọn doanh nghiệp Demo để tạo chứng từ, lưu nháp, duyệt/ghi sổ, xem sổ và báo cáo. | Số liệu xuyên suốt chứng từ, sổ và báo cáo khớp nhau; trường hợp thiếu quyền hoặc dữ liệu không hợp lệ được xử lý đúng. |
| Ưu tiên 3 | Hoàn thiện hướng dẫn chạy Docker | Bổ sung hướng dẫn cho Linux, địa chỉ truy cập, Docker context, biến `DEBUG`, xem log và cập nhật bản giao diện. | Một người mới có thể khởi chạy dự án theo tài liệu, kể cả khi máy có nhiều Docker context hoặc cổng bị chiếm. |
| Ưu tiên 3 | Kiểm tra khởi chạy từ môi trường sạch | Frontend có volume riêng cho `node_modules`; cần xác nhận dependency Roboto và bản build được cập nhật đúng sau khi dựng lại. | Khởi chạy trên bộ container/volume thử nghiệm mới thành công, không ảnh hưởng volume dữ liệu hiện có. |
| Ưu tiên 3 | Tổng hợp kết quả và chuẩn bị bàn giao | Ghi lại các luồng đã thử, lỗi còn mở, ảnh nghiệm thu và cách sử dụng tài khoản Demo. | Có danh sách lỗi kèm mức độ, kết quả kiểm thử và hướng dẫn sử dụng được cập nhật. |

**3. Trình tự thực hiện đề xuất**

1. Sửa “Ghi nhớ phiên đăng nhập”, sau đó kiểm thử đăng nhập và quản lý phiên.
2. Cấu hình email kiểm thử; chạy trọn luồng đăng ký, xác thực và đặt lại mật khẩu.
3. Chốt giao diện đăng nhập – đăng ký; rà soát các hộp thoại và biểu mẫu còn lại.
4. Thử một chu trình nghiệp vụ trên doanh nghiệp Demo và đối chiếu số liệu.
5. Chuẩn hóa kiểm thử tự động, tài liệu Docker và hồ sơ bàn giao.

**4. Lưu ý khi đánh giá tiến độ**

Các kiểm tra hiển thị và build đã thực hiện là cơ sở xác nhận phần giao diện. Việc nghiệm thu chức năng cần bổ sung kết quả cho từng luồng đăng ký, OTP, quản lý phiên và nghiệp vụ kế toán trong danh sách trên. Thời gian hoàn thành từng hạng mục cần được xác định sau khi chốt phạm vi kiểm thử và cấu hình email.
