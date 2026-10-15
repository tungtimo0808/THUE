# UC-MD-11: Quản lý mã thống kê (API)

Backend cung cấp danh mục mã thống kê tại endpoint `/api/v1/master-data/statistical-codes/`. Các thao tác yêu cầu xác thực người dùng, quyền hạn `MD.STATISTICAL_CODE.*` và doanh nghiệp đang hoạt động.
Gửi `company_id` trên query string khi truy vấn danh sách, chi tiết, báo cáo tác động, lịch sử, đổi trạng thái, gợi ý AI hoặc xuất CSV; gửi `company` trong body khi tạo mới, thêm nhanh hoặc import CSV.

---

## 1. Phạm vi nghiệp vụ & Nguyên tắc cốt lõi

- **Mục đích của mã thống kê**: Tiêu chí phân loại linh hoạt do doanh nghiệp tự xây dựng nhằm theo dõi theo các nhu cầu quản trị chuyên biệt (chương trình khuyến mại, chiến dịch marketing, chuyến xe vận chuyển, hợp đồng nội bộ, kênh bán hàng...).
- **Phân biệt với các danh mục khác**:
  - **Tài khoản kế toán**: Xác định nghiệp vụ được hạch toán Nợ/Có vào tài khoản nào.
  - **Khoản mục chi phí**: Phân loại nội dung chi phí phục vụ quản trị và báo cáo chi phí.
  - **Dự án/Công trình**: Quản lý một đối tượng dự án hoặc công trình cụ thể.
  - **Phòng ban/Đơn vị**: Xác định bộ phận phát sinh nghiệp vụ.
  - **Mã thống kê**: Chiều phân tích bổ sung linh hoạt. **Không tự tạo bút toán hạch toán, không làm thay đổi số tiền hay tài khoản Nợ/Có trên chứng từ** (BR-MD-STAT-08, 09).
- **Thiết lập cho phép chọn trên chứng từ (`allow_voucher_selection`)**:
  - `True`: Cho phép người dùng gắn trực tiếp vào các dòng hạch toán chứng từ.
  - `False`: Mã cấp cha chỉ dùng để gom nhóm và tổng hợp báo cáo quản trị, không được chọn trực tiếp trên chứng từ mới (BR-MD-STAT-07).
- **Thêm nhanh ngay khi nhập chứng từ (`quick-create`)**: Hỗ trợ người dùng tạo nhanh mã thống kê với thông tin tối thiểu mà không cần thoát khỏi màn hình lập chứng từ (AF-07, BR-MD-STAT-22).
- **Khóa mã định danh khi đã phát sinh dữ liệu**: Khi mã thống kê đã phát sinh trên các dòng chứng từ sổ cái, trường `code` bị khóa cứng không được phép chỉnh sửa (BR-MD-STAT-14, EF-07).
- **Nguyên tắc xóa**: Không được xóa vật lý mã đã phát sinh dữ liệu hoặc đang có mã con. Chỉ được chuyển sang trạng thái `INACTIVE` (Ngừng sử dụng) (BR-MD-STAT-12, 13, EF-08).

---

## 2. Thông tin mã thống kê

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `code` | String (max 50) | Có | Mã định danh duy nhất trong doanh nghiệp (không phân biệt chữ hoa/thường) |
| `name` | String (max 255) | Có | Tên đầy đủ của mã thống kê |
| `parent` | UUID (Mã cha) | Không | ID mã thống kê cấp trên nếu quản lý theo cây phân cấp |
| `category` | String (max 100) | Không | Nhóm/Loại mã (ví dụ: `CAMPAIGN`, `LOGISTICS`, `CHANNEL`, `INTERNAL`...) |
| `allow_voucher_selection` | Boolean | Có | Cho phép chọn trên chứng từ (`True`) hay chỉ dùng để tổng hợp (`False`). Mặc định: `True` |
| `applicable_scope` | String (max 100) | Không | Phạm vi chứng từ áp dụng: `ALL`, `PURCHASE`, `SALES`, `PAYMENT`, `RECEIPT`... |
| `start_date` | Date (YYYY-MM-DD) | Không | Ngày bắt đầu có hiệu lực |
| `end_date` | Date (YYYY-MM-DD) | Không | Ngày kết thúc hiệu lực (`end_date >= start_date`) |
| `description` | Text | Không | Diễn giải, mục đích sử dụng mã thống kê |
| `status` | Choice | Có | `ACTIVE` (Đang sử dụng) hoặc `INACTIVE` (Ngừng sử dụng). Mặc định: `ACTIVE` |
| `version` | Integer | Có | Phiên bản dữ liệu phục vụ khóa lạc quan (Optimistic Locking) |

---

## 3. Bảng tổng hợp Endpoint & Quyền hạn

| Hành động | Endpoint | HTTP Method | Quyền IAM | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| **Danh sách mã thống kê** | `/statistical-codes/` | `GET` | `MD.STATISTICAL_CODE.VIEW` | Lọc theo `search`, `parent_id`, `root_only`, `category`, `status`, `allow_voucher_selection` |
| **Cây phân cấp mã thống kê** | `/statistical-codes/tree/` | `GET` | `MD.STATISTICAL_CODE.VIEW` | Cấu trúc cây đa cấp (hoặc phẳng) lồng nhau theo cha - con (BR-MD-STAT-04, 30) |
| **Báo cáo tổng hợp số liệu** | `/statistical-codes/summary/` | `GET` | `MD.STATISTICAL_CODE.VIEW` | Tổng hợp Doanh thu, Chi phí, Nợ, Có trực tiếp và cộng dồn cây mã không tính trùng (BR-MD-STAT-20, 21) |
| **Chi tiết mã thống kê** | `/statistical-codes/{id}/` | `GET` | `MD.STATISTICAL_CODE.VIEW` | Xem chi tiết thông tin và `version` |
| **Báo cáo tác động** | `/statistical-codes/{id}/impact/` | `GET` | `MD.STATISTICAL_CODE.VIEW` | Kiểm tra số lượng con, chứng từ phát sinh và cờ `can_delete` |
| **Lịch sử kiểm toán** | `/statistical-codes/{id}/history/` | `GET` | `MD.STATISTICAL_CODE.VIEW` | Danh sách vết Audit Log của mã thống kê |
| **Tạo mới mã thống kê** | `/statistical-codes/` | `POST` | `MD.STATISTICAL_CODE.CREATE` | Khởi tạo mã thống kê đầy đủ |
| **Thêm nhanh mã thống kê** | `/statistical-codes/quick-create/` | `POST` | `MD.STATISTICAL_CODE.CREATE` | Thêm nhanh từ màn hình chứng từ với thông tin rút gọn (AF-07, BR-MD-STAT-22) |
| **Cập nhật mã thống kê** | `/statistical-codes/{id}/` | `PATCH` | `MD.STATISTICAL_CODE.EDIT` | Cập nhật thông tin kèm kiểm tra `version` (HTTP 409 nếu xung đột) |
| **Đổi trạng thái** | `/statistical-codes/{id}/change-status/` | `POST` | `MD.STATISTICAL_CODE.DEACTIVATE` | Chuyển giữa `ACTIVE` và `INACTIVE` (hỗ trợ xử lý lan truyền con cháu) |
| **Xóa mã thống kê** | `/statistical-codes/{id}/` | `DELETE` | `MD.STATISTICAL_CODE.DELETE` | Chỉ xóa được khi chưa có giao dịch và không có con (BR-MD-STAT-12, 13) |
| **AI Assistant gợi ý** | `/statistical-codes/ai-suggest/` | `POST` | `MD.STATISTICAL_CODE.VIEW` | Gợi ý mã thống kê phù hợp dựa trên nội dung chứng từ (BR-MD-STAT-27..29) |
| **Xuất danh sách CSV** | `/statistical-codes/export-csv/` | `GET` | `MD.STATISTICAL_CODE.EXPORT` | Xuất file CSV danh mục mã thống kê (BR-MD-STAT-24) |
| **Nhập danh sách CSV** | `/statistical-codes/import-csv/` | `POST` | `MD.STATISTICAL_CODE.IMPORT` | Nhập file CSV kèm báo cáo lỗi chi tiết từng dòng (BR-MD-STAT-24, 25) |

---

## 4. Các quy trình tác vụ đặc biệt

### 4.1 Thêm nhanh mã thống kê (`POST /statistical-codes/quick-create/`)
Dùng khi người dùng đang nhập chứng từ mà chưa có mã phù hợp (AF-07, BR-MD-STAT-22):
**Payload:**
```json
{
  "company": "6fa85f64-5717-4562-b3fc-2c963f66afa6",
  "code": "CD-TET2026",
  "name": "Chiến dịch Tết 2026",
  "category": "CAMPAIGN"
}
```
**Response (HTTP 201 Created):** Trả về đối tượng vừa tạo với `allow_voucher_selection: true` và `status: ACTIVE` để tự động điền vào dòng chứng từ.

---

### 4.2 Cây phân cấp mã thống kê (`GET /statistical-codes/tree/`)
**Query parameter:** `company_id=...&status=ACTIVE` (status là tùy chọn).  
**Response (HTTP 200 OK):**
```json
[
  {
    "id": "11111111-2222-3333-4444-555555555555",
    "code": "KM-ROOT",
    "name": "Tổng hợp chương trình khuyến mại",
    "category": "CAMPAIGN",
    "allow_voucher_selection": false,
    "status": "ACTIVE",
    "version": 1,
    "has_children": true,
    "children": [
      {
        "id": "22222222-3333-4444-5555-666666666666",
        "code": "KM-ONLINE",
        "name": "Khuyến mại kênh Online",
        "category": "CAMPAIGN",
        "allow_voucher_selection": true,
        "status": "ACTIVE",
        "version": 1,
        "has_children": false,
        "children": []
      }
    ]
  }
]
```

---

### 4.3 Báo cáo tổng hợp số liệu theo mã (`GET /statistical-codes/summary/`)
Tổng hợp phát sinh Doanh thu, Chi phí, Nợ, Có theo từng mã và cộng dồn cây mã cấp trên (BR-MD-STAT-20, 21):
**Query parameters:**
- `company_id`: ID doanh nghiệp (bắt buộc)
- `code_id`: ID hoặc Code của mã thống kê cần lọc chi tiết (tùy chọn)
- `from_date`, `to_date`: Khoảng thời gian ghi sổ (định dạng `YYYY-MM-DD`, tùy chọn)

**Response (HTTP 200 OK):**
```json
[
  {
    "id": "11111111-2222-3333-4444-555555555555",
    "code": "KM-ROOT",
    "name": "Tổng hợp chương trình khuyến mại",
    "direct": {
      "debit": "0",
      "credit": "0",
      "revenue": "0",
      "expense": "0",
      "net": "0"
    },
    "total": {
      "debit": "800000.00",
      "credit": "0.00",
      "revenue": "0.00",
      "expense": "800000.00",
      "net": "-800000.00"
    }
  },
  {
    "id": "22222222-3333-4444-5555-666666666666",
    "code": "KM-ONLINE",
    "name": "Khuyến mại kênh Online",
    "direct": {
      "debit": "500000.00",
      "credit": "0.00",
      "revenue": "0.00",
      "expense": "500000.00",
      "net": "-500000.00"
    },
    "total": {
      "debit": "500000.00",
      "credit": "0.00",
      "revenue": "0.00",
      "expense": "500000.00",
      "net": "-500000.00"
    }
  }
]
```
> [!NOTE]
> Số liệu `direct` là phát sinh trực tiếp gắn mã đó. Số liệu `total` cộng dồn toàn bộ con cháu theo cấu trúc cây mà **không tính trùng lặp** số liệu vì mỗi dòng chứng từ chỉ gắn duy nhất 1 mã thống kê lá/cụ thể (BR-MD-STAT-21).

---

### 4.4 Đổi trạng thái (`POST /statistical-codes/{id}/change-status/`)
**Query parameter:** `company_id=...`  
**Payload:**
```json
{
  "status": "INACTIVE",
  "version": 1,
  "reason": "Kết thúc chiến dịch",
  "deactivate_children": true
}
```
- **Ngừng sử dụng (`INACTIVE`)**:
  - Nếu mã có mã con đang `ACTIVE` và không gửi `deactivate_children: true`, hệ thống từ chối và cảnh báo người dùng phải xử lý các mã con trước (BR-MD-STAT-17, EF-09).
  - Khi có `deactivate_children: true`, toàn bộ cây mã con cháu sẽ được đồng thời chuyển sang trạng thái `INACTIVE` và ghi nhận Audit Log riêng biệt.
- **Kích hoạt lại (`ACTIVE`)**:
  - Nếu mã cha trực tiếp đang ở trạng thái `INACTIVE`, hệ thống từ chối kích hoạt mã con để đảm bảo tính toàn vẹn của cây phân cấp (BR-MD-STAT-16).

---

### 4.5 Trợ lý AI Assistant gợi ý (`POST /statistical-codes/ai-suggest/`)
**Payload:**
```json
{
  "company": "6fa85f64-5717-4562-b3fc-2c963f66afa6",
  "description": "Chi phí thuê xe vận chuyển tuyến Hà Nội Hải Phòng",
  "context": "Chuyến xe vận tải hàng hóa"
}
```
**Response:**
```json
{
  "suggested_id": "4fa85f64-5717-4562-b3fc-2c963f66afa2",
  "suggested_code": "CX-HN-HP",
  "suggested_name": "Chuyến xe Hà Nội - Hải Phòng",
  "suggested_category": "LOGISTICS",
  "confidence": 0.85,
  "reasoning": "Gợi ý mã thống kê 'CX-HN-HP' dựa trên từ khóa nhận diện 'vận chuyển' trong nội dung chứng từ."
}
```
> [!IMPORTANT]
> AI Assistant chỉ trả về kết quả gợi ý. Hệ thống không tự động gán vào chứng từ nếu không có thao tác xác nhận của người dùng (BR-MD-STAT-27).

---

### 4.6 Xuất và Nhập CSV

#### Cấu trúc file CSV chuẩn
```csv
code,name,parent_code,category,allow_voucher_selection,applicable_scope,start_date,end_date,status,description
CX-001,Chuyến xe Bắc Nam,,LOGISTICS,FALSE,ALL,2026-01-01,2026-12-31,ACTIVE,Tuyến vận tải đường bộ
CX-001-HN,Chuyến xe Hà Nội,CX-001,LOGISTICS,TRUE,ALL,2026-01-01,2026-12-31,ACTIVE,Đầu bến Hà Nội
```

- Tiêu đề bắt buộc có `code` và `name`.
- `parent_code`: Mã thống kê cha (phải tồn tại và đang hoạt động).
- `allow_voucher_selection`: `TRUE` hoặc `FALSE`.
- Import hỗ trợ kiểm tra và báo cáo lỗi theo từng số dòng cụ thể (`line`, `code`, `errors`) (EF-12, EF-13, BR-MD-STAT-25).

---

### 4.7 Tích hợp với Sổ cái & Kiểm tra điều kiện khi gắn lên Chứng từ

Khi gắn mã thống kê vào dòng hạch toán (`JournalLine.dimensions={"statistical_code": "..."}` hoặc `dimensions={"statistical_code_id": "..."}`), backend thực hiện kiểm tra tự động qua hàm `validate_statistical_code_selection`:
1. **Phạm vi doanh nghiệp (BR-MD-STAT-03)**: Mã phải thuộc đúng doanh nghiệp đang hạch toán.
2. **Trạng thái hoạt động (BR-MD-STAT-10, EF-10)**: Không cho phép chọn mã ở trạng thái `INACTIVE`.
3. **Cờ chọn chứng từ (BR-MD-STAT-07, EF-10)**: Mã có `allow_voucher_selection = False` (mã dùng để tổng hợp) bị từ chối nếu đưa vào dòng giao dịch trực tiếp.
4. **Thời gian hiệu lực (BR-MD-STAT-10, EF-10)**: Ngày hạch toán phải nằm trong khoảng `[start_date, end_date]`.
5. **Phạm vi nghiệp vụ (BR-MD-STAT-10, EF-10)**: Nếu mã có khai báo `applicable_scope` (ví dụ `PAYMENT,PURCHASE`), chứng từ loại khác (ví dụ `SALES`) sẽ bị chặn.
6. **Bắt buộc theo tài khoản kế toán (BR-MD-STAT-19, EF-11)**: Khi tài khoản kế toán cấu hình `dimension_requirements={"STATISTICAL_CODE": "REQUIRED"}`, dòng hạch toán thiếu mã thống kê sẽ bị chặn khi gửi duyệt hoặc ghi sổ.

---

## 5. Bảng đối chiếu Quy tắc nghiệp vụ (Business Rules) & Luồng ngoại lệ

| Mã BR / EF | Nội dung yêu cầu | Hiện thực trong Backend |
| :--- | :--- | :--- |
| **BR-MD-STAT-01** | Bắt buộc mã và tên | Model `StatisticalCode`, Serializer validation (`EF-02`) |
| **BR-MD-STAT-02** | Mã duy nhất trong doanh nghiệp (không phân biệt hoa/thường) | `clean()` với `iexact` và `UniqueConstraint` (`EF-03`) |
| **BR-MD-STAT-03** | Mã doanh nghiệp này không được dùng cho doanh nghiệp khác | `validate_statistical_code_selection`, Company Scope Filter |
| **BR-MD-STAT-04, 30** | Hỗ trợ danh mục phẳng và phân cấp cha–con | Trường `parent`, Endpoint `/tree/` |
| **BR-MD-STAT-05** | Không tự làm cha của chính mình, không tạo vòng lặp | Hàm kiểm tra `_validate_tree` đệ quy (`EF-05`) |
| **BR-MD-STAT-06** | Một mã con chỉ thuộc 1 cha trực tiếp tại cùng thời điểm | Quan hệ `ForeignKey("self")` |
| **BR-MD-STAT-07** | Mã chỉ dùng tổng hợp không được chọn trực tiếp trên chứng từ | Cờ `allow_voucher_selection` & `validate_statistical_code_selection` |
| **BR-MD-STAT-08, 09** | Không tự tạo bút toán, không thay đổi Nợ/Có/số tiền | Mã thống kê là chiều phân tích trong `JournalLine.dimensions` |
| **BR-MD-STAT-10, EF-10** | Chỉ được chọn mã khi ACTIVE, còn hạn, đúng phạm vi | `validate_statistical_code_selection` trong `general_ledger/services.py` |
| **BR-MD-STAT-11** | Mã ngừng sử dụng vẫn hiển thị trên chứng từ lịch sử | Khóa mềm qua `status=INACTIVE`, không xóa vật lý |
| **BR-MD-STAT-12, 14, EF-07** | Đã phát sinh giao dịch không được sửa code, không xóa vật lý | `has_statistical_code_transactions` chặn sửa code và chặn delete |
| **BR-MD-STAT-13, EF-08** | Chưa phát sinh dữ liệu và không có con mới được xóa | `get_statistical_code_impact`, kiểm tra `can_delete` |
| **BR-MD-STAT-15** | Đổi tên/mô tả không làm đổi số liệu lịch sử | Chỉ cập nhật trường thông tin miêu tả, không ảnh hưởng số tiền |
| **BR-MD-STAT-16, EF-04** | Không tạo/kích hoạt con dưới cha đang ngừng sử dụng | Kiểm tra `parent.status == ACTIVE` khi tạo và đổi trạng thái |
| **BR-MD-STAT-17, EF-09** | Ngừng cha có con đang hoạt động: cảnh báo / cascade | `deactivate_children=True` để ngừng lan truyền |
| **BR-MD-STAT-18** | Mỗi dòng hạch toán gắn 1 mã thống kê | Cấu trúc `dimensions.statistical_code` |
| **BR-MD-STAT-19, EF-11** | Tài khoản yêu cầu mã thống kê: bắt buộc nhập trước khi ghi sổ | Kiểm tra `dimension_requirements["STATISTICAL_CODE"]` trong `_validate_entry` |
| **BR-MD-STAT-20, 21** | Tổng hợp theo mã hoặc cây mã không tính trùng lặp | Endpoint `/summary/` tính `direct` vs `total` theo cây |
| **BR-MD-STAT-22** | Thêm nhanh từ chứng từ yêu cầu quyền CREATE | Endpoint `/quick-create/` với quyền `MD.STATISTICAL_CODE.CREATE` |
| **BR-MD-STAT-23** | Kiểm tra quyền IAM độc lập tại Backend | `permission_map("MD.STATISTICAL_CODE")`, `action_permissions` |
| **BR-MD-STAT-24, 25** | Import & Export theo quyền và kiểm tra hợp lệ | Endpoint `/export-csv/`, `/import-csv/` kiểm tra từng dòng (`EF-12, EF-13`) |
| **BR-MD-STAT-26** | Ghi vết Audit Log cho mọi thay đổi | Ghi `AuditLog` với `before`, `after`, `occurred_at` |
| **BR-MD-STAT-27..29** | AI chỉ gợi ý, không tự ý áp dụng | Endpoint `/ai-suggest/` trả về gợi ý kèm lý do và độ tin cậy |
| **EF-14** | Khóa lạc quan chống ghi đè đồng thời | Kiểm tra `version`, trả về HTTP 409 Conflict |

