# UC-MD-10: Quản lý khoản mục chi phí (API)

Backend cung cấp danh mục khoản mục chi phí tại endpoint `/api/v1/master-data/expense-items/`. Các thao tác yêu cầu xác thực người dùng, quyền hạn `MD.EXPENSE_ITEM.*` và doanh nghiệp đang hoạt động.
Gửi `company_id` trên query string khi truy vấn danh sách, chi tiết, báo cáo tác động, lịch sử, đổi trạng thái, gợi ý AI hoặc xuất CSV; gửi `company` trong body khi tạo mới hoặc import CSV.

---

## 1. Phạm vi nghiệp vụ & Nguyên tắc cốt lõi

- **Phân biệt khoản mục chi phí và tài khoản kế toán**:
  - **Tài khoản kế toán** (621, 622, 627, 641, 642, 635, 811...): Xác định chi phí được hạch toán vào tài khoản nào trong sổ cái kế toán và báo cáo tài chính.
  - **Khoản mục chi phí**: Là chiều phân tích quản trị bổ sung (nguyên vật liệu, nhân công, vận chuyển, tiếp khách, văn phòng phẩm...), **không thay thế tài khoản kế toán** và **không tự động tạo bút toán hạch toán**. Một tài khoản kế toán có thể dùng chung với nhiều khoản mục chi phí khác nhau.
- **Tài khoản kế toán mặc định (`default_account`)**: Chỉ mang tính gợi ý khi người dùng lập chứng từ. Phải là tài khoản chi tiết (postable), đang hoạt động (`ACTIVE`) và thuộc cùng doanh nghiệp.
- **Quản lý phân cấp cha – con**: Hệ thống hỗ trợ cả danh mục dạng phẳng lẫn danh mục cây phân cấp nhiều tầng. Kiểm soát chặt chẽ để không tạo chu trình vòng lặp và không cho phép tạo con dưới một cha đã ngừng sử dụng.
- **Khóa chỉnh sửa mã khi đã có dữ liệu**: Mã khoản mục (`code`) đã phát sinh trên các dòng chứng từ sổ cái sẽ bị khóa cứng, không được phép thay đổi.
- **Nguyên tắc xóa**: Không được xóa khoản mục đã phát sinh dữ liệu giao dịch hoặc đang có khoản mục con. Trong trường hợp đó, người dùng chỉ được chuyển sang trạng thái `INACTIVE` (Ngừng sử dụng).

---

## 2. Thông tin khoản mục chi phí

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `code` | String (max 50) | Có | Mã khoản mục duy nhất trong doanh nghiệp (không phân biệt hoa/thường) |
| `name` | String (max 255) | Có | Tên đầy đủ của khoản mục chi phí |
| `parent` | UUID (Khoản mục cha) | Không | ID khoản mục cấp trên nếu quản lý theo cây phân cấp |
| `expense_type` | Choice / String | Không | Nhóm phân loại: `MATERIAL`, `LABOR`, `GENERAL_PRODUCTION`, `SELLING`, `ADMIN`, `FINANCIAL`, `OTHER` |
| `default_account` | UUID (Tài khoản GL) | Không | Tài khoản kế toán mặc định được gợi ý khi lập chứng từ |
| `applicable_scope` | String (max 100) | Không | Phạm vi chứng từ áp dụng: `ALL`, `PURCHASE`, `PAYMENT`, `GENERAL_VOUCHER`... |
| `start_date` | Date (YYYY-MM-DD) | Không | Ngày bắt đầu có hiệu lực sử dụng |
| `end_date` | Date (YYYY-MM-DD) | Không | Ngày kết thúc hiệu lực sử dụng (`end_date >= start_date`) |
| `description` | Text | Không | Diễn giải, mục đích sử dụng khoản mục chi phí |
| `status` | Choice | Có | `ACTIVE` (Đang sử dụng) hoặc `INACTIVE` (Ngừng sử dụng). Mặc định: `ACTIVE` |
| `version` | Integer | Có | Phiên bản dữ liệu phục vụ khóa lạc quan (Optimistic Locking) |

---

## 3. Bảng tổng hợp Endpoint & Quyền hạn

| Hành động | Endpoint | HTTP Method | Quyền IAM | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| **Danh sách khoản mục** | `/expense-items/` | `GET` | `MD.EXPENSE_ITEM.VIEW` | Lọc theo `search`, `parent_id`, `root_only`, `expense_type`, `status` |
| **Chi tiết khoản mục** | `/expense-items/{id}/` | `GET` | `MD.EXPENSE_ITEM.VIEW` | Xem chi tiết thông tin và phiên bản `version` |
| **Báo cáo tác động** | `/expense-items/{id}/impact/` | `GET` | `MD.EXPENSE_ITEM.VIEW` | Kiểm tra số lượng con, chứng từ phát sinh và cờ `can_delete` |
| **Lịch sử kiểm toán** | `/expense-items/{id}/history/` | `GET` | `MD.EXPENSE_ITEM.VIEW` | Danh sách Audit Log của khoản mục chi phí |
| **Tạo mới khoản mục** | `/expense-items/` | `POST` | `MD.EXPENSE_ITEM.CREATE` | Khởi tạo khoản mục chi phí mới |
| **Cập nhật khoản mục** | `/expense-items/{id}/` | `PATCH` | `MD.EXPENSE_ITEM.EDIT` | Cập nhật thông tin kèm kiểm tra `version` (HTTP 409 nếu xung đột) |
| **Đổi trạng thái** | `/expense-items/{id}/change-status/` | `POST` | `MD.EXPENSE_ITEM.DEACTIVATE` | Chuyển giữa `ACTIVE` và `INACTIVE` |
| **Xóa khoản mục** | `/expense-items/{id}/` | `DELETE` | `MD.EXPENSE_ITEM.DELETE` | Chỉ xóa được khi chưa có giao dịch và không có con |
| **AI Assistant gợi ý** | `/expense-items/ai-suggest/` | `POST` | `MD.EXPENSE_ITEM.VIEW` | Gợi ý nhóm phân loại và tài khoản kế toán |
| **Xuất danh sách CSV** | `/expense-items/export-csv/` | `GET` | `MD.EXPENSE_ITEM.EXPORT` | Xuất file CSV danh mục khoản mục chi phí |
| **Nhập danh sách CSV** | `/expense-items/import-csv/` | `POST` | `MD.EXPENSE_ITEM.IMPORT` | Nhập file CSV kèm báo cáo lỗi chi tiết từng dòng |

---

## 4. Các quy trình tác vụ đặc biệt

### 4.1 Tạo mới và cập nhật khoản mục
- **Tạo mới (`POST /expense-items/`)**:
  ```json
  {
    "company": "6fa85f64-5717-4562-b3fc-2c963f66afa6",
    "code": "CP-VPP",
    "name": "Chi phí văn phòng phẩm",
    "parent": null,
    "expense_type": "ADMIN",
    "default_account": "4fa85f64-5717-4562-b3fc-2c963f66afa2",
    "applicable_scope": "PAYMENT,PURCHASE",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "description": "Khoản mục mua sắm văn phòng phẩm"
  }
  ```
- **Cập nhật (`PATCH /expense-items/{id}/`)**:
  Gửi kèm `version` lấy từ lần đọc gần nhất. Nếu `version` trong CSDL đã bị người dùng khác thay đổi, hệ thống trả về mã lỗi **HTTP 409 Conflict**.
  Nếu khoản mục đã từng xuất hiện trên chứng từ kế toán, việc sửa trường `code` sẽ bị từ chối.

---

### 4.2 Đổi trạng thái (`POST /expense-items/{id}/change-status/`)
**Query parameter:** `company_id=...`  
**Payload:**
```json
{
  "status": "INACTIVE",
  "version": 1,
  "reason": "Ngừng sử dụng nhóm chi phí này",
  "deactivate_children": true
}
```
- **Ngừng sử dụng (`INACTIVE`)**:
  - Nếu khoản mục có khoản mục con đang `ACTIVE` và không gửi `deactivate_children: true`, hệ thống từ chối và cảnh báo người dùng phải xử lý các khoản mục con trước.
  - Khi có `deactivate_children: true`, toàn bộ cây khoản mục con cháu sẽ được đồng thời chuyển sang trạng thái `INACTIVE`.
- **Kích hoạt lại (`ACTIVE`)**:
  - Nếu khoản mục cha trực tiếp đang ở trạng thái `INACTIVE`, hệ thống từ chối kích hoạt khoản mục con để đảm bảo tính toàn vẹn của cây phân cấp.

---

### 4.3 Trợ lý AI Assistant gợi ý (`POST /expense-items/ai-suggest/`)
**Payload:**
```json
{
  "company": "6fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Tiền lương và phụ cấp nhân viên bán hàng",
  "description": "Lương cứng và thưởng KPI hàng tháng"
}
```
**Response mẫu:**
```json
{
  "suggested_expense_type": "LABOR",
  "suggested_account_id": "4fa85f64-5717-4562-b3fc-2c963f66afa2",
  "suggested_account_code": "6411",
  "suggested_account_name": "Chi phí nhân viên bán hàng",
  "confidence": 0.85,
  "reasoning": "Gợi ý nhóm 'LABOR' dựa trên từ khóa nhận diện 'lương' trong tên/mô tả khoản mục."
}
```
*Lưu ý: AI chỉ đóng vai trò hỗ trợ gợi ý. Hệ thống không tự động lưu dữ liệu nếu người dùng chưa xác nhận.*

---

### 4.4 Xuất và Nhập CSV

#### Cấu trúc file CSV chuẩn
```csv
code,name,parent_code,expense_type,default_account_code,applicable_scope,start_date,end_date,status,description
CP-VPP,Chi phí văn phòng phẩm,,ADMIN,6428,PAYMENT,2026-01-01,2026-12-31,ACTIVE,Văn phòng phẩm phục vụ chung
CP-VPP-GIAY,Giấy in A4,CP-VPP,ADMIN,6428,PAYMENT,2026-01-01,2026-12-31,ACTIVE,Giấy in Double A
```

- Tiêu đề bắt buộc có `code` và `name`.
- `parent_code`: Mã khoản mục cha (phải tồn tại và đang hoạt động).
- `default_account_code`: Mã tài khoản kế toán hợp lệ (postable và active).
- Import hỗ trợ kiểm tra và báo cáo lỗi theo từng số dòng cụ thể (`line`, `code`, `errors`).
