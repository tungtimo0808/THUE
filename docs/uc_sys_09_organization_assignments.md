# UC-SYS-09 — Phân công User vào đơn vị

API: `/api/v1/iam/organization-assignments/`. Mọi yêu cầu cần đăng nhập, Membership ACTIVE tại doanh nghiệp và Permission `SYS.ORG_ASSIGNMENT.MANAGE`. Dữ liệu trả về luôn giới hạn theo doanh nghiệp và phạm vi quản trị của Actor.

| Tác vụ | Method và đường dẫn | Dữ liệu chính |
| --- | --- | --- |
| Danh sách, lịch sử | `GET /?company_id=<uuid>&membership_id=<uuid>` | Gồm cả SCHEDULED, ACTIVE, EXPIRED, REVOKED |
| Xem chi tiết | `GET /<id>/?company_id=<uuid>` | Có `version` để chống cập nhật đồng thời |
| Xem trước | `POST /preview/` | Cùng payload tạo; trả `requires_transfer` và phân công chính cũ |
| Tạo | `POST /` | `company`, `membership`, `unit`, `assignment_type`, `start_date`; tùy chọn `end_date`, `position`, `job_title`, `note`, `transfer` |
| Sửa thời gian và thông tin | `PATCH /<id>/?company_id=<uuid>` | `version` và các trường cần sửa |
| Kết thúc | `POST /<id>/revoke/?company_id=<uuid>` | `version`, `reason` |

`TEMPORARY` phải có `end_date`. Hai phân công trùng User, đơn vị, loại và thời gian bị từ chối. Chuyển PRIMARY đang chồng thời gian cần `transfer: true`; hệ thống đóng phân công cũ vào ngày trước ngày bắt đầu mới trong cùng transaction. `PRIMARY` đang ACTIVE cập nhật đơn vị mặc định trên Membership. Ngày hiệu lực và hết hạn được đồng bộ khi đọc danh sách hoặc chi tiết. Mọi thao tác ghi có audit log; lỗi ghi audit khiến transaction rollback. Phân công đơn vị không tự cấp Role, Permission hay Data Scope.

Lập lịch chạy `python manage.py sync_organization_assignments` hằng ngày để đồng bộ trạng thái và đơn vị mặc định ngay khi sang ngày mới, kể cả lúc không có yêu cầu đọc API.

Đơn vị đang có phân công hiệu lực được ghi nhận trong dependency của cơ cấu tổ chức để Admin xử lý trước khi ngừng đơn vị. Đơn vị gốc được phân công PRIMARY mặc định cho người khởi tạo doanh nghiệp mới.
