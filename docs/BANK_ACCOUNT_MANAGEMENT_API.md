# UC-MD-08: Quản lý tài khoản ngân hàng doanh nghiệp (API)

Backend cung cấp danh mục tài khoản ngân hàng của doanh nghiệp tại `/api/v1/master-data/company-bank-accounts/`. Các thao tác yêu cầu xác thực người dùng, quyền `MD.BANK_ACCOUNT.*`, Data Scope tương ứng và doanh nghiệp có cấu hình hợp lệ.
Gửi `company_id` trên query string khi truy vấn danh sách, chi tiết, báo cáo ảnh hưởng, lịch sử, thao tác trạng thái, kết nối ngân hàng hoặc xóa; gửi `company` trong body khi tạo tài khoản hoặc import CSV.

---

## 1. Phạm vi nghiệp vụ & Nguyên tắc cốt lõi

- **Chỉ quản lý tài khoản của doanh nghiệp**: Không quản lý tài khoản ngân hàng của khách hàng, nhà cung cấp hay nhân viên tại danh mục này (các đối tượng đó thuộc UC-MD-02, UC-MD-03, UC-MD-06).
- **Tuyệt đối không sửa số dư trực tiếp**: Danh mục chỉ quản lý thông tin định danh và chính sách sử dụng. Số dư tài khoản được hình thành và biến động thông qua các giao dịch thu/chi tiền gửi, sổ phụ ngân hàng, hoặc bút toán hạch toán kế toán.
- **Che dấu số tài khoản (Data Masking)**: Người dùng thông thường chỉ nhìn thấy số tài khoản dạng mặt nạ (ví dụ: `****9901`). Chỉ người dùng được cấp quyền `MD.BANK_ACCOUNT.VIEW_UNMASKED` mới xem được đầy đủ số tài khoản thực tế.
- **Khóa chỉnh sửa thông tin cốt lõi**: Khi tài khoản đã phát sinh giao dịch hoặc sổ phụ ngân hàng, hệ thống khóa cứng các trường: `account_number`, `bank`, và `currency`.
- **Kiểm soát tính hợp lệ kế toán**: Tài khoản GL liên kết (`gl_account`) phải là tài khoản chi tiết (postable), đang hoạt động (ACTIVE) và phù hợp với loại tiền tệ của tài khoản ngân hàng.

---

## 2. Danh mục tài khoản ngân hàng

### 2.1 Tạo tài khoản ngân hàng (`POST /company-bank-accounts/`)
**Payload mẫu:**
```json
{
  "company": "6fa85f64-5717-4562-b3fc-2c963f66afa6",
  "code": "TKNH0001",
  "account_number": "19038888999901",
  "account_name": "CONG TY TNHH ABC - TAI KHOAN THANH TOAN",
  "bank": "5fa85f64-5717-4562-b3fc-2c963f66afa1",
  "bank_branch": "Hội sở chính",
  "currency": "VND",
  "account_type": "PAYMENT",
  "account_scope": "COMPANY_SHARED",
  "branch": null,
  "gl_account": "4fa85f64-5717-4562-b3fc-2c963f66afa2",
  "allow_receipt": true,
  "allow_payment": true,
  "is_default": false,
  "opened_date": "2026-01-01",
  "swift_bic": "VTCBVNVX",
  "notes": "Tài khoản thanh toán chính"
}
```

- **Mã tài khoản (`code`)**: Tự động sinh nếu để trống (dạng `TKNH0001`, `TKNH0002`...). Duy nhất trong phạm vi doanh nghiệp.
- **Số tài khoản (`account_number`)**: Tự động chuẩn hóa (loại bỏ khoảng trắng, viết hoa ký tự). Cặp `(company, bank, account_number, currency)` là duy nhất.
- **Ngân hàng (`bank`) & Tiền tệ (`currency`)**: Phải ở trạng thái `ACTIVE`.
- **Phạm vi tài khoản (`account_scope`)**:
  - `COMPANY_SHARED`: Dùng chung toàn doanh nghiệp, `branch` phải là `null`.
  - `BRANCH`: Dùng riêng cho chi nhánh, bắt buộc cung cấp `branch`.
  - `PROJECT`: Dùng cho dự án, liên kết `project`.
  - `PURPOSE_SPECIFIC`: Dùng cho mục đích đặc thù.
- **Chính sách thu/chi (`allow_receipt`, `allow_payment`)**: Tài khoản trạng thái `ACTIVE` phải cho phép ít nhất một trong hai mục đích thu hoặc chi.

---

### 2.2 Danh sách & Chi tiết
- `GET /company-bank-accounts/?company_id=...`: Hỗ trợ bộ lọc `search`, `bank_id`, `branch_id`, `currency`, `account_type`, `account_scope`, `status`, `ordering`.
- `GET /company-bank-accounts/{id}/?company_id=...`: Trả về chi tiết tài khoản kèm trường `version` dùng cho Optimistic Locking.
- `GET /company-bank-accounts/{id}/impact/?company_id=...`: Trả về báo cáo tác động gồm:
  - Số dư sổ cái GL hiện tại (`gl_balance`).
  - Số dư hồ sơ tài khoản ngân hàng (`profile_balance`).
  - Số lượng giao dịch đang mở (`open_transactions_count`).
  - Dòng sao kê chưa đối chiếu (`unreconciled_statement_lines_count`).
  - Tổng số sao kê và giao dịch phát sinh.
  - Các cờ kiểm tra điều kiện đóng (`can_close`) và điều kiện xóa (`can_delete`).
- `GET /company-bank-accounts/{id}/history/?company_id=...`: Trả về danh sách nhật ký kiểm toán (Audit Logs) của tài khoản.

---

### 2.3 Cập nhật tài khoản (`PATCH /company-bank-accounts/{id}/?company_id=...`)
Gửi kèm `version` lấy từ lần đọc gần nhất.
- Nếu `version` không khớp, hệ thống trả về lỗi **HTTP 409 Conflict**.
- Nếu tài khoản đã phát sinh giao dịch hoặc sao kê ngân hàng, hệ thống từ chối cập nhật các trường `account_number`, `bank`, và `currency`.

---

### 2.4 Bảng tổng hợp Endpoint & Quyền hạn

| Hành động | Endpoint | Quyền IAM | Mô tả |
| :--- | :--- | :--- | :--- |
| **Danh sách tài khoản** | `GET /` | `MD.BANK_ACCOUNT.VIEW` | Lọc theo Data Scope của người dùng |
| **Chi tiết tài khoản** | `GET /{id}/` | `MD.BANK_ACCOUNT.VIEW` | Số tài khoản bị mask nếu thiếu quyền unmasked |
| **Báo cáo tác động** | `GET /{id}/impact/` | `MD.BANK_ACCOUNT.VIEW` | Kiểm tra số dư và chứng từ liên quan |
| **Lịch sử thay đổi** | `GET /{id}/history/` | `MD.BANK_ACCOUNT.VIEW` | Tra cứu vết Audit Log |
| **Tạo mới tài khoản** | `POST /` | `MD.BANK_ACCOUNT.CREATE` | Khởi tạo tài khoản ngân hàng doanh nghiệp |
| **Cập nhật tài khoản** | `PATCH /{id}/` | `MD.BANK_ACCOUNT.EDIT` | Cập nhật thông tin kèm kiểm tra version |
| **Thiết lập mặc định** | `POST /{id}/set-default/` | `MD.BANK_ACCOUNT.EDIT` | Đặt làm tài khoản mặc định theo phạm vi |
| **Thay đổi trạng thái** | `POST /{id}/change-status/` | `MD.BANK_ACCOUNT.DEACTIVATE` | Chuyển trạng thái (INACTIVE, BLOCKED, CLOSED) |
| **Xóa tài khoản** | `DELETE /{id}/` | `MD.BANK_ACCOUNT.DELETE` | Chỉ xóa được khi chưa từng phát sinh dữ liệu |
| **Kết nối Open Banking** | `POST /{id}/connect-bank/` | `MD.BANK_ACCOUNT.CONNECT` | Cập nhật trạng thái liên kết dịch vụ ngân hàng |
| **Hủy kết nối ngân hàng**| `POST /{id}/disconnect-bank/` | `MD.BANK_ACCOUNT.CONNECT` | Ngắt kết nối dịch vụ ngân hàng điện tử |
| **Xuất danh sách CSV** | `GET /export-csv/` | `MD.BANK_ACCOUNT.EXPORT` | Xuất CSV theo Data Scope |
| **Nhập danh sách CSV** | `POST /import-csv/` | `MD.BANK_ACCOUNT.IMPORT` | Nhập dữ liệu CSV kèm báo lỗi theo dòng |
| **Xem số TK đầy đủ** | *(Xem trong GET)* | `MD.BANK_ACCOUNT.VIEW_UNMASKED` | Quyền xem số tài khoản không che dấu |

---

## 3. Các quy trình tác vụ đặc biệt

### 3.1 Thiết lập tài khoản mặc định (`POST /{id}/set-default/`)
**Query parameter:** `company_id=...`  
**Payload mẫu:**
```json
{
  "version": 1,
  "confirm_replace": true
}
```
- Mỗi cặp `(company, currency, account_scope, branch)` chỉ được có duy nhất **một** tài khoản mặc định đang hoạt động (`ACTIVE`).
- Nếu đã tồn tại tài khoản mặc định khác trong cùng phạm vi và cùng loại tiền tệ:
  - Nếu không gửi `confirm_replace: true`, hệ thống trả về mã lỗi `DEFAULT_ALREADY_EXISTS` kèm ID tài khoản mặc định hiện tại.
  - Khi có `confirm_replace: true`, hệ thống tự động gỡ cờ mặc định của tài khoản cũ và gắn cờ mặc định cho tài khoản này.

---

### 3.2 Đổi trạng thái tài khoản (`POST /{id}/change-status/`)
**Query parameter:** `company_id=...`  
**Payload mẫu:**
```json
{
  "status": "CLOSED",
  "version": 1,
  "reason": "Đóng tài khoản theo quyết định HĐQT",
  "replacement_account_id": "8fa85f64-5717-4562-b3fc-2c963f66afa8"
}
```
- **Hỗ trợ các trạng thái**: `ACTIVE`, `INACTIVE`, `BLOCKED`, `CLOSED`.
- **Quy tắc khi ĐÓNG TÀI KHOẢN (`CLOSED`)**:
  - Số dư tài khoản phải bằng 0 (cả trên số dư hồ sơ ngân hàng lẫn số dư sổ cái kế toán GL).
  - Không còn giao dịch ngân hàng nào đang ở trạng thái mở hoặc chờ xử lý.
  - Không còn dòng sao kê ngân hàng nào chưa được đối chiếu hoàn tất.
  - Nếu tài khoản đóng đang là tài khoản mặc định, người dùng có thể chỉ định `replacement_account_id` để thay thế làm mặc định mới.

---

### 3.3 Kết nối và Ngắt kết nối ngân hàng điện tử
- **Kết nối (`POST /{id}/connect-bank/`)**:
  ```json
  {
    "provider": "VIETINBANK_OPEN_API",
    "connection_id": "CONN-VTB-00123",
    "sync_scope": "BALANCE_AND_STATEMENT",
    "auth_expires_at": "2027-01-01T00:00:00Z"
  }
  ```
  *(Lưu ý: Tuyệt đối không lưu trữ hay truyền nhận mật khẩu/access token dạng plaintext trong danh mục Master Data).*
- **Ngắt kết nối (`POST /{id}/disconnect-bank/`)**: Chuyển trạng thái liên kết sang `DISCONNECTED` và hủy bỏ thông tin phiên làm việc.

---

### 3.4 Xóa tài khoản (`DELETE /{id}/?company_id=...`)
- Tài khoản ngân hàng **chỉ có thể xóa vật lý** khi chưa từng được tham chiếu trong:
  - Bút toán sổ cái kế toán (GL Journal Entries).
  - Giao dịch ngân hàng (Bank Transactions / Payments / Receipts).
  - Sao kê ngân hàng (Bank Statements).
  - Hồ sơ số dư tài khoản ngân hàng (Account Profile).
- Nếu đã phát sinh bất kỳ liên kết dữ liệu nào, hệ thống từ chối xóa và hướng dẫn người dùng chuyển sang trạng thái `INACTIVE` hoặc `CLOSED`.

---

## 4. Xuất / Nhập CSV

### 4.1 Cấu trúc file CSV
Cấu trúc tiêu đề chuẩn:
```csv
code,account_number,account_name,bank_code,currency_code,account_type,account_scope,branch_code,gl_account_code,allow_receipt,allow_payment,status,swift_bic,notes
```

- **Mã tham chiếu**: `bank_code` (mã ngân hàng), `currency_code` (mã tiền tệ VND, USD...), `branch_code` (mã chi nhánh), `gl_account_code` (mã tài khoản kế toán 1121...).
- **Xử lý lỗi theo dòng**: API nhập CSV đọc toàn bộ file và trả về chi tiết các dòng thành công cũng như các dòng lỗi kèm nguyên nhân cụ thể (`row`, `code`, `errors`).
- **Bảo mật khi xuất CSV**: Trường `account_number` tự động được che dấu (masked) nếu người thực hiện xuất file không có quyền `MD.BANK_ACCOUNT.VIEW_UNMASKED`.
