# Tài liệu Kỹ thuật Backend: UC-PUR-13 Quản lý hợp đồng mua hàng

## 1. Mô tả tổng quan

| Thuộc tính | Chi tiết |
| :--- | :--- |
| **Mã Use Case** | `UC-PUR-13` |
| **Tên Use Case** | Quản lý hợp đồng mua hàng (Purchase Contract Management) |
| **Module** | Mua hàng (`purchases`), IAM (`iam`), Master Data (`master_data`), Workflows (`approval_workflows`) |
| **Actor** | User được cấp quyền quản lý hợp đồng mua hàng; User được cấp quyền phê duyệt |
| **Trigger** | User truy cập danh mục Hợp đồng mua hàng |
| **Tiền điều kiện** | User đã đăng nhập; có quyền quản lý hợp đồng mua hàng; nhà cung cấp, hàng hóa/dịch vụ và thuế suất còn hiệu lực. |
| **Hậu điều kiện** | Hợp đồng được lưu với trạng thái phù hợp; được liên kết với đơn mua hàng; cập nhật tiến độ thực hiện; hệ thống ghi nhận lịch sử audit và phê duyệt. |
| **Base URL** | `/api/v1/purchases/purchase-contracts/` |

---

## 2. Vòng đời trạng thái hợp đồng (`DocumentStatus`)

```
             ┌─────────────────────────── [DRAFT] (Nháp / Chưa phê duyệt) ──────────────────────────┐
             │                                   │                                                  │
             │ confirm() (AF04)                  │ submit() (Steps 25-26)                           │ delete() (AF07)
             │ (Doanh nghiệp không dùng workflow)│                                                  ▼
             │                                   ▼                                             [DELETED]
             │                         [PENDING_APPROVAL] (Chờ phê duyệt)
             │                           │              ▲
             │          approve() (Step 27)             │
             │                           ├── reject()   │ update() (AF03 Step 4)
             │                           ▼ (AF03)       │
             │                       [REJECTED] ────────┘
             ▼                       (Bị từ chối)
   ┌─────────────────────────────────────┐
   │ today < start_date: [APPROVED]     │
   │ today >= start_date: [IN_PROGRESS] │
   └──────────────────┬──────────────────┘
                      │
                      ├── create_order() ──► Cập nhật ordered_amount & ordered_quantity, trạng thái chuyển IN_PROGRESS
                      ├── complete() (AF05) ─► [COMPLETED] (Hoàn thành - Khóa tạo thêm PO)
                      ├── cancel() (AF06) ──► [CANCELLED] (Đã hủy - Chỉ khi chưa có PO hoạt động)
                      └── today > end_date ─► [EXPIRED] (Hết hiệu lực - BR20)
```

### Các trạng thái chuẩn hóa:
1. `DRAFT`: Hợp đồng vừa tạo, chưa gửi phê duyệt. Được phép sửa, xóa.
2. `PENDING_APPROVAL`: Đang chờ người có thẩm quyền phê duyệt.
3. `REJECTED`: Bị từ chối duyệt, có ghi nhận lý do từ chối. Được phép sửa và nộp lại (chuyển về DRAFT).
4. `APPROVED`: Đã phê duyệt nhưng chưa tới ngày bắt đầu hiệu lực (`today < start_date`). Được dùng để tạo đơn mua hàng (BR15).
5. `IN_PROGRESS`: Đang thực hiện (`today >= start_date` hoặc đã phát sinh đơn mua hàng). Được dùng để tạo đơn mua hàng.
6. `COMPLETED`: Đã hoàn thành toàn bộ hoặc hoàn thành trước hạn (kèm lý do hoàn thành). Không cho phép tạo thêm đơn mua hàng.
7. `EXPIRED`: Đã quá ngày kết thúc (`today > end_date`) mà chưa hoàn thành hoặc chưa hủy (BR20).
8. `CANCELLED`: Đã hủy (kèm lý do hủy). Số hợp đồng đã hủy không được cấp lại cho hợp đồng khác (BR05).

---

## 3. Quy tắc sinh số hợp đồng (BR02 - BR05)

- **Cấu trúc**: `HDMH-{NĂM}-{SỐ THỨ TỰ 5 CHỮ SỐ}` (ví dụ: `HDMH-2026-00001`).
- **Phạm vi thứ tự**: Tăng dần trong từng năm và từng doanh nghiệp (Company), bắt đầu từ `00001`.
- **Thời điểm cấp**: Số hợp đồng chỉ được cấp khi người dùng bấm Lưu và dữ liệu hợp lệ (BR01, BR04).
- **Tính duy nhất & Bất biến**: Duy nhất trong phạm vi doanh nghiệp. Số hợp đồng của hợp đồng đã hủy không được cấp lại cho bất kỳ hợp đồng nào khác (BR05).

---

## 4. Phân quyền IAM (Identity & Access Management)

Hệ thống áp dụng chính sách phân quyền thông qua `PurchasePermission` với mã tài nguyên `PUR.CONTRACT`:

| Mã quyền IAM | Tên hành động | API / View Action | Mô tả nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `PUR.CONTRACT.VIEW` | Xem | `list`, `retrieve`, `execution`, `approval_history` | Xem danh sách, chi tiết và tiến độ hợp đồng |
| `PUR.CONTRACT.CREATE` | Tạo | `create` (POST) | Lập mới hợp đồng mua hàng ở trạng thái Nháp |
| `PUR.CONTRACT.EDIT` | Sửa | `update`, `partial_update`, `complete` | Chỉnh sửa hợp đồng Nháp/Từ chối; hoàn thành hợp đồng |
| `PUR.CONTRACT.DELETE` | Xóa | `destroy` (DELETE) | Xóa hợp đồng Nháp chưa có chứng từ liên quan |
| `PUR.CONTRACT.SUBMIT` | Gửi duyệt | `submit` (POST) | Gửi hợp đồng vào quy trình phê duyệt |
| `PUR.CONTRACT.APPROVE` | Phê duyệt | `approve`, `reject`, `confirm` | Phê duyệt, từ chối hoặc xác nhận hợp đồng |
| `PUR.CONTRACT.CANCEL` | Hủy | `cancel` (POST) | Hủy hợp đồng chưa có đơn mua hoạt động |
| `PUR.ORDER.CREATE` | Lập đơn mua | `create_order` (POST) | Tạo đơn mua hàng từ hợp đồng đã duyệt |

> **Thông báo từ chối truy cập (EX14)**: Khi người dùng không có quyền tương ứng, hệ thống trả về mã lỗi HTTP 403 Forbidden với thông báo:
> `{"detail": "Bạn không có quyền thực hiện chức năng này."}`

---

## 5. Đặc tả chi tiết API Endpoints

### 5.1. Danh sách và tìm kiếm hợp đồng (AF01, Steps 1-2)
- **URL**: `GET /api/v1/purchases/purchase-contracts/`
- **Quyền**: `PUR.CONTRACT.VIEW`
- **Query Parameters**:
  - `company_id` (*bắt buộc*, UUID): Mã doanh nghiệp.
  - `q` / `search` (*tùy chọn*, string): Tìm kiếm theo Số hợp đồng, Tên hợp đồng, Tên hoặc Mã nhà cung cấp (AF01).
  - `number` (*tùy chọn*): Lọc chính xác/chứa số hợp đồng.
  - `supplier` (*tùy chọn*, UUID): Lọc theo nhà cung cấp.
  - `status` (*tùy chọn*): Lọc theo trạng thái (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `IN_PROGRESS`, `COMPLETED`, `EXPIRED`, `CANCELLED`).
  - `signed_date`, `signed_date_from`, `signed_date_to` (*tùy chọn*, YYYY-MM-DD): Lọc theo ngày ký.
  - `start_date_from`, `end_date_to` (*tùy chọn*, YYYY-MM-DD): Lọc theo thời hạn hiệu lực.

#### Response Success (200 OK):
Trả về danh sách hợp đồng kèm các trường theo dõi tài chính:
```json
[
  {
    "id": "c1f7a244-1234-4567-8901-abcdefabcdef",
    "number": "HDMH-2026-00001",
    "title": "Hợp đồng cung cấp vật tư Q4/2026",
    "supplier": "s1b2c3d4-...",
    "supplier_code": "S1",
    "supplier_name": "Công ty TNHH Cung ứng Vật tư",
    "signed_date": "2026-10-06",
    "start_date": "2026-10-06",
    "end_date": "2026-12-31",
    "currency_code": "VND",
    "total_amount": "990000000.0000",
    "ordered_amount": "594000000.0000",
    "remaining_amount": "396000000.0000",
    "progress_percent": "60.00",
    "status": "IN_PROGRESS",
    "status_display": "Đang thực hiện"
  }
]
```

---

### 5.2. Thêm mới hợp đồng mua hàng (Steps 3-24)
- **URL**: `POST /api/v1/purchases/purchase-contracts/`
- **Quyền**: `PUR.CONTRACT.CREATE`
- **Body JSON**:
```json
{
  "company": "company-uuid",
  "branch": "branch-uuid",
  "department": "dept-uuid",
  "title": "Hợp đồng cung cấp thép cuộn",
  "supplier": "supplier-uuid",
  "signed_date": "2026-10-06",
  "start_date": "2026-10-06",
  "end_date": "2026-12-31",
  "currency": "currency-uuid",
  "exchange_rate": "1",
  "payment_term": "payment-term-uuid",
  "delivery_place": "Kho tổng Hải Phòng",
  "delivery_term": "DAP",
  "content": "Điều khoản mua bán chi tiết...",
  "notes": "Ưu tiên giao sớm đợt 1",
  "lines": [
    {
      "item": "item-uuid",
      "uom": "uom-uuid",
      "quantity": "100.0000",
      "unit_price": "15000000.0000",
      "discount_rate": "5.0000",
      "tax_rate": "tax-rate-uuid",
      "expected_delivery_date": "2026-11-15",
      "description": "Thép cuộn cán nóng SS400"
    }
  ],
  "payment_schedules": [
    {
      "stage_name": "Tạm ứng đợt 1",
      "amount": "400000000.0000",
      "percentage": "25.00",
      "due_date": "2026-10-15",
      "condition": "Sau khi ký hợp đồng"
    }
  ],
  "attachments": [
    {
      "file_name": "hop_dong_ky_ket.pdf",
      "file_size": 2097152
    }
  ]
}
```

#### Quy tắc kiểm tra (Validation):
- `title`, `supplier`, `signed_date`, `start_date`, `end_date`, `payment_term`: bắt buộc (BR06, EX01).
- `end_date >= start_date`: nếu nhỏ hơn -> lỗi `"Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu."` (BR10, EX02).
- `supplier.status == "ACTIVE"`: nếu nhà cung cấp ngừng hoạt động -> lỗi `"Nhà cung cấp đã ngừng hoạt động. Vui lòng chọn nhà cung cấp đang hoạt động."` (EX03).
- `lines`: ít nhất 1 dòng -> nếu rỗng -> lỗi `"Hợp đồng phải có ít nhất một hàng hóa hoặc dịch vụ."` (BR07, EX04).
- Mỗi dòng phải có: `item`, `uom`, `tax_rate`, `quantity > 0`, `unit_price >= 0`, `0 <= discount_rate <= 100` (BR08, BR09, EX05-EX08).
- `currency != VND`: tỷ giá bắt buộc và phải `> 0` -> nếu không hợp lệ -> lỗi `"Vui lòng nhập tỷ giá lớn hơn 0."` (BR11, EX09).
- Tổng tiền các đợt thanh toán (`sum(payment_schedules.amount)`): không vượt quá `total_amount` hợp đồng -> lỗi `"Tổng tiền các đợt thanh toán không được vượt Tổng giá trị hợp đồng."` (BR12, EX10).
- `attachments`: định dạng hỗ trợ PDF, DOCX, XLSX, PNG, JPG, JPEG; dung lượng tối đa 10 MB (EX16).

#### Công thức tính toán tài chính (Steps 12-16):
- `Thành tiền = Số lượng × Đơn giá`
- `Tiền chiết khấu = Thành tiền × Tỷ lệ chiết khấu`
- `Giá trị trước thuế = Thành tiền − Tiền chiết khấu`
- `Tiền thuế GTGT = Giá trị trước thuế × Thuế suất GTGT`
- `Tổng tiền hợp đồng = Tổng trước thuế + Tổng thuế GTGT`

#### Response Success (201 Created):
```json
{
  "id": "c1f7a244-...",
  "number": "HDMH-2026-00001",
  "title": "Hợp đồng cung cấp thép cuộn",
  "status": "DRAFT",
  "subtotal": "1500000000.0000",
  "discount_amount": "75000000.0000",
  "tax_amount": "142500000.0000",
  "total_amount": "1567500000.0000",
  "remaining_amount": "1567500000.0000",
  "message": "Lưu hợp đồng mua hàng thành công."
}
```

---

### 5.3. Cập nhật hợp đồng mua hàng (AF02, BR18, EX15)
- **URL**: `PUT / PATCH /api/v1/purchases/purchase-contracts/{id}/`
- **Quyền**: `PUR.CONTRACT.EDIT`
- **Quy tắc**:
  - Chỉ cho phép sửa khi trạng thái là `DRAFT` hoặc `REJECTED` (BR18, AF02).
  - Hợp đồng `APPROVED` hoặc `IN_PROGRESS` bị khóa sửa đổi nghiệp vụ trực tiếp (BR18).
  - Khóa lạc quan (Optimistic Concurrency Control): kiểm tra trường `version` trong payload. Nếu không khớp với bản ghi hiện tại -> lỗi HTTP 400: `"Hợp đồng đã được User khác cập nhật. Vui lòng tải lại thông tin mới nhất."` (EX15).
  - Khi sửa hợp đồng ở trạng thái `REJECTED`, hệ thống xóa lý do từ chối, tăng `version` và hoàn trả về trạng thái `DRAFT` (AF03 Bước 4).

---

### 5.4. Gửi phê duyệt hợp đồng (Steps 25-26, EX11)
- **URL**: `POST /api/v1/purchases/purchase-contracts/{id}/submit/`
- **Quyền**: `PUR.CONTRACT.SUBMIT`
- **Quy tắc**:
  - Hợp đồng phải ở trạng thái `DRAFT` hoặc `REJECTED`.
  - Hợp đồng phải có ít nhất 1 dòng và tổng giá trị lớn hơn 0.
  - Nếu doanh nghiệp cấu hình quy trình duyệt tự động / không dùng workflow (`allow_creator_posting` hoặc không có bước duyệt) -> chuyển thẳng sang `APPROVED` (nếu chưa đến ngày bắt đầu) hoặc `IN_PROGRESS` (nếu đã đến ngày bắt đầu) (AF04).
  - Nếu quy trình có bước duyệt nhưng không xác định được Approver -> báo lỗi `"Chưa thiết lập người phê duyệt cho nghiệp vụ này."` (EX11).
  - Trạng thái thông thường chuyển sang `PENDING_APPROVAL`.

---

### 5.5. Phê duyệt hợp đồng (Steps 27-28)
- **URL**: `POST /api/v1/purchases/purchase-contracts/{id}/approve/`
- **Quyền**: `PUR.CONTRACT.APPROVE`
- **Quy tắc (Step 28)**:
  - Hợp đồng phải ở trạng thái `PENDING_APPROVAL`.
  - Ghi nhận `approved_at`, người phê duyệt và bản ghi `ApprovalDecision`.
  - Nếu `today < start_date`: Hợp đồng chuyển sang `APPROVED` (Đã phê duyệt).
  - Nếu `today >= start_date`: Hợp đồng chuyển sang `IN_PROGRESS` (Đang thực hiện).

---

### 5.6. Từ chối phê duyệt hợp đồng (AF03)
- **URL**: `POST /api/v1/purchases/purchase-contracts/{id}/reject/`
- **Quyền**: `PUR.CONTRACT.APPROVE`
- **Body JSON**: `{"reason": "Đơn giá chưa đúng bảng báo giá mới"}`
- **Quy tắc**:
  - Bắt buộc nhập lý do từ chối (`reason`). Nếu để trống -> báo lỗi `"Vui lòng nhập lý do từ chối."` (AF03 Bước 1-2).
  - Chuyển trạng thái hợp đồng sang `REJECTED`, lưu lý do vào `rejection_reason` và bảng `ApprovalDecision`.

---

### 5.7. Xác nhận hợp đồng trực tiếp (AF04)
- **URL**: `POST /api/v1/purchases/purchase-contracts/{id}/confirm/`
- **Quyền**: `PUR.CONTRACT.APPROVE`
- **Quy tắc**: Áp dụng khi doanh nghiệp không dùng workflow duyệt. Chuyển hợp đồng từ `DRAFT` sang `APPROVED` (nếu chưa tới ngày bắt đầu) hoặc `IN_PROGRESS` (nếu đã tới ngày bắt đầu).

---

### 5.8. Tạo đơn mua hàng từ hợp đồng (Steps 29-31, BR15-BR17, EX12)
- **URL**: `GET / POST /api/v1/purchases/purchase-contracts/{id}/create-order/`
- **Quyền**:
  - `GET`: `PUR.CONTRACT.VIEW` (Xem số lượng, giá trị còn được phép đặt - Step 29).
  - `POST`: `PUR.ORDER.CREATE` (Tạo đơn mua hàng - Steps 30-31).

#### Phương thức GET (Step 29):
Trả về chi tiết hợp đồng kèm trường `remaining_quantity` của từng dòng hàng hóa và `remaining_amount` của hợp đồng.

#### Phương thức POST (Steps 30-31):
- **Body JSON**:
```json
{
  "document_date": "2026-10-10",
  "delivery_date": "2026-11-01",
  "receiving_location": "Kho tổng Hải Phòng",
  "lines": [
    {
      "contract_line_id": "contract-line-uuid",
      "quantity": "40.0000"
    }
  ]
}
```

#### Quy tắc kiểm tra (BR15, BR16, BR17, EX12):
1. Hợp đồng phải ở trạng thái `APPROVED` hoặc `IN_PROGRESS`, chưa bị hết hiệu lực (`EXPIRED`) và chưa bị hủy (`CANCELLED`) (BR15).
2. Số lượng đặt mua tại từng dòng không được vượt quá số lượng còn lại (`quantity - ordered_quantity`) của dòng hợp đồng (BR17, EX12).
3. Tổng giá trị đơn mua không được vượt quá giá trị còn lại (`total_amount - ordered_amount`) của hợp đồng (BR17, EX12).
4. Nhà cung cấp và Loại tiền trên đơn mua tự động kế thừa chính xác từ hợp đồng (BR16).
5. Khi tạo đơn mua thành công:
   - Tạo bản ghi `PurchaseOrder` và `PurchaseOrderLine`.
   - Cập nhật tăng `ordered_quantity` và `ordered_amount` trên từng dòng hợp đồng.
   - Cập nhật tăng `ordered_amount` trên hợp đồng.
   - Chuyển trạng thái hợp đồng sang `IN_PROGRESS` (nếu đang là `APPROVED`).

---

### 5.9. Theo dõi tiến độ thực hiện hợp đồng (Step 32)
- **URL**: `GET /api/v1/purchases/purchase-contracts/{id}/execution/`
- **Quyền**: `PUR.CONTRACT.VIEW`

#### Response Success (200 OK):
Hiển thị đầy đủ 5 chiều giá trị thực hiện và tiến độ phần trăm:
```json
{
  "contract_id": "c1f7a244-...",
  "number": "HDMH-2026-00001",
  "title": "Hợp đồng cung cấp thép cuộn",
  "status": "IN_PROGRESS",
  "status_display": "Đang thực hiện",
  "total_amount": "1567500000.0000",
  "ordered_amount": "627000000.0000",
  "remaining_amount": "940500000.0000",
  "progress_percent": "40.00",
  "received_amount": "500000000.0000",
  "invoiced_amount": "500000000.0000",
  "paid_amount": "400000000.0000",
  "lines": [
    {
      "id": "line-uuid",
      "line_no": 1,
      "item_code": "I1",
      "item_name": "Thép cuộn",
      "contract_quantity": "100.0000",
      "ordered_quantity": "40.0000",
      "remaining_quantity": "60.0000",
      "unit_price": "15000000.0000",
      "line_total": "1567500000.0000",
      "ordered_amount": "627000000.0000",
      "progress_percent": "40.00"
    }
  ],
  "orders": [
    {
      "id": "order-uuid",
      "number": "PO-2026-0001",
      "document_date": "2026-10-10",
      "status": "APPROVED",
      "total_amount": "627000000.0000"
    }
  ]
}
```

---

### 5.10. Hoàn thành hợp đồng (AF05)
- **URL**: `POST /api/v1/purchases/purchase-contracts/{id}/complete/`
- **Quyền**: `PUR.CONTRACT.EDIT`
- **Body JSON**: `{"reason": "Hai bên thỏa thuận kết thúc hợp đồng trước hạn"}`
- **Quy tắc**:
  - Hợp đồng phải ở trạng thái `IN_PROGRESS` hoặc `APPROVED`.
  - Nếu hợp đồng chưa được thực hiện hết (`ordered_amount < total_amount`), bắt buộc phải nhập lý do hoàn thành trước hạn (`reason`). Nếu để trống -> báo lỗi `"Vui lòng nhập lý do hoàn thành trước hạn."` (AF05 Bước 3).
  - Sau khi hoàn thành, hợp đồng chuyển sang `COMPLETED` và bị khóa, không cho phép tạo thêm đơn mua hàng (AF05 Bước 4).

---

### 5.11. Hủy hợp đồng (AF06, EX13)
- **URL**: `POST /api/v1/purchases/purchase-contracts/{id}/cancel/`
- **Quyền**: `PUR.CONTRACT.CANCEL`
- **Body JSON**: `{"reason": "Nhà cung cấp thay đổi chính sách phân phối"}`
- **Quy tắc**:
  - Bắt buộc nhập lý do hủy (`reason`). Nếu để trống -> báo lỗi `"Vui lòng nhập lý do hủy."` (AF06 Bước 2).
  - Kiểm tra xem hợp đồng đã có đơn mua hàng liên quan đang hoạt động hay không. Nếu có đơn mua chưa hủy -> từ chối hủy và báo lỗi: `"Không thể hủy hợp đồng đã có đơn mua hàng liên quan. Vui lòng xử lý hoặc hủy các đơn mua trước."` (EX13, AF06 Bước 1).
  - Chuyển trạng thái sang `CANCELLED`.

---

### 5.12. Xóa hợp đồng (AF07, BR19, EX13)
- **URL**: `DELETE /api/v1/purchases/purchase-contracts/{id}/`
- **Quyền**: `PUR.CONTRACT.DELETE`
- **Quy tắc**:
  - Chỉ cho phép xóa khi hợp đồng ở trạng thái `DRAFT` (Chưa phê duyệt) (AF07 Bước 1).
  - Tuyệt đối không cho xóa nếu hợp đồng đã có đơn mua hàng hoặc chứng từ liên quan (BR19, EX13).
  - Xóa thành công trả về HTTP 200 kèm thông báo: `{"message": "Xóa hợp đồng mua hàng thành công."}` (AF07 Bước 2).

---

## 6. Kiểm tra Tự động hóa quá hạn (BR20)

Hệ thống tích hợp cơ chế tự động kiểm tra hiệu lực hợp đồng:
- Khi người dùng truy cập danh sách, chi tiết hoặc tạo đơn mua từ hợp đồng, nếu `today > end_date` và hợp đồng đang ở trạng thái `APPROVED` hoặc `IN_PROGRESS`, hệ thống tự động chuyển trạng thái sang `EXPIRED` (Hết hiệu lực).
- Hợp đồng `EXPIRED` bị khóa chức năng tạo đơn mua hàng (BR15).

---

## 7. Không tạo bút toán kế toán (BR21)

Theo Chuẩn mực Kế toán và Quy tắc BR21:
- Việc lập, ký kết, phê duyệt, hoàn thành hợp đồng mua hàng không làm phát sinh sự thay đổi nguồn vốn hay tài sản, do đó **không hạch toán kế toán** và không tạo bất kỳ bản ghi `JournalEntry` nào.
- Bút toán kế toán chỉ phát sinh khi ghi nhận chứng từ mua hàng (`GoodsPurchase`, `ServicePurchase`), hóa đơn đầu vào hoặc chứng từ thanh toán.

---

## 8. Bảng đối chiếu Quy tắc Nghiệp vụ (Business Rules)

| Mã BR | Nội dung quy tắc | Hiện thực Backend |
| :--- | :--- | :--- |
| **BR01** | Mở màn hình không tạo dữ liệu; chỉ tạo khi chọn Lưu và hợp lệ | Backend chỉ lưu bản ghi khi POST hợp lệ qua `create_contract()` |
| **BR02** | Số hợp đồng mặc định có cấu trúc `HDMH-{NĂM}-{SỐ THỨ TỰ 5 CHỮ SỐ}` | `number_for_contract()` sinh định dạng chuẩn `HDMH-{year}-{seq:05d}` |
| **BR03** | Số thứ tự tăng dần trong từng năm và từng doanh nghiệp | Truy vấn số lớn nhất theo tiền tố `HDMH-{year}-` của công ty và `+ 1` |
| **BR04** | Số hợp đồng chỉ cấp khi lưu thành công và duy nhất | Tự sinh khi lưu, ràng buộc duy nhất `number` trong doanh nghiệp |
| **BR05** | Số hợp đồng đã hủy không được cấp lại | Truy vấn lọc trên toàn bộ bảng hợp đồng (bao gồm CANCELLED) |
| **BR06** | Các trường bắt buộc: Tên, NCC, Ngày ký, Bắt đầu, Kết thúc, Tiền tệ, Điều khoản TT | `validate_contract_header()` kiểm tra và trả lỗi EX01 nếu thiếu |
| **BR07** | Phải có ít nhất một dòng hàng hóa/dịch vụ | `validate_contract_lines()` báo lỗi EX04 nếu rỗng |
| **BR08** | Mỗi dòng phải có Hàng hóa, ĐVT, Số lượng, Đơn giá, Thuế suất | `validate_contract_lines()` báo lỗi EX05 nếu thiếu |
| **BR09** | Số lượng > 0, Đơn giá >= 0, Tỷ lệ chiết khấu từ 0% đến 100% | `validate_contract_lines()` kiểm tra EX06, EX07, EX08 |
| **BR10** | Ngày kết thúc phải lớn hơn hoặc bằng Ngày bắt đầu | `validate_contract_header()` kiểm tra EX02 |
| **BR11** | Loại tiền mặc định VND; tiền tệ khác VND yêu cầu Tỷ giá > 0 | `validate_contract_header()` kiểm tra EX09 |
| **BR12** | Tổng tiền các đợt thanh toán không vượt quá Tổng giá trị hợp đồng | `validate_payment_schedules()` kiểm tra EX10 |
| **BR13** | Đơn vị, chi nhánh, phòng ban, người phụ trách là tùy chọn | Model cho phép null/blank các trường liên quan |
| **BR14** | Các trạng thái chuẩn hóa | Sử dụng `DocumentStatus` chuẩn hóa |
| **BR15** | Chỉ hợp đồng đã duyệt, chưa hết hạn, chưa hủy mới được tạo đơn mua | `create_order_from_contract()` kiểm tra trạng thái APPROVED/IN_PROGRESS |
| **BR16** | NCC và Loại tiền trên đơn mua phải trùng với hợp đồng | Gán trực tiếp `supplier` và `currency` từ hợp đồng |
| **BR17** | Số lượng và giá trị đơn mua không vượt phần còn lại của hợp đồng | Kiểm tra số lượng từng dòng và tổng giá trị đơn mua (EX12) |
| **BR18** | Hợp đồng đã duyệt không được sửa trực tiếp | Chặn PUT/PATCH khi không phải DRAFT/REJECTED |
| **BR19** | Không được xóa hợp đồng đã có đơn mua hoặc chứng từ liên quan | `delete_contract()` kiểm tra `contract.orders.exists()` |
| **BR20** | Quá Ngày kết thúc chưa xong thì chuyển sang Hết hiệu lực | `check_and_update_contract_expiration()` và trigger tự động |
| **BR21** | Hợp đồng không tạo bút toán kế toán | Không gọi kế toán, bảo toàn số lượng JournalEntry |
| **BR22** | Lưu người thực hiện, thời gian, lịch sử thay đổi | `services.audit()` và `ApprovalDecision` ghi nhận đầy đủ |

---

## 9. Bảng đối chiếu Xử lý Ngoại lệ (Exception Flows)

| Mã EX | Tình huống | Phản hồi từ Hệ thống |
| :--- | :--- | :--- |
| **EX01** | Thiếu trường bắt buộc | HTTP 400: `{"<field>": "Vui lòng nhập đầy đủ thông tin bắt buộc."}` |
| **EX02** | Ngày kết thúc < Ngày bắt đầu | HTTP 400: `{"end_date": "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu."}` |
| **EX03** | Nhà cung cấp đã ngừng hoạt động | HTTP 400: `{"supplier": "Nhà cung cấp đã ngừng hoạt động. Vui lòng chọn nhà cung cấp đang hoạt động."}` |
| **EX04** | Không có dòng hàng hóa/dịch vụ | HTTP 400: `"Hợp đồng phải có ít nhất một hàng hóa hoặc dịch vụ."` |
| **EX05** | Dòng chi tiết thiếu thông tin cốt lõi | HTTP 400: `"Dòng chi tiết thiếu Hàng hóa/Dịch vụ, Đơn vị tính hoặc Thuế suất."` |
| **EX06** | Số lượng <= 0 | HTTP 400: `"Vui lòng nhập số lượng lớn hơn 0."` |
| **EX07** | Đơn giá < 0 | HTTP 400: `"Vui lòng nhập lại đơn giá."` |
| **EX08** | Tỷ lệ chiết khấu ngoài [0, 100] | HTTP 400: `"Vui lòng nhập lại tỷ lệ chiết khấu."` |
| **EX09** | Tỷ giá <= 0 khi tiền tệ khác VND | HTTP 400: `{"exchange_rate": "Vui lòng nhập tỷ giá lớn hơn 0."}` |
| **EX10** | Đợt thanh toán vượt giá trị hợp đồng | HTTP 400: `"Tổng tiền các đợt thanh toán không được vượt Tổng giá trị hợp đồng."` |
| **EX11** | Không xác định được người phê duyệt | HTTP 400: `"Chưa thiết lập người phê duyệt cho nghiệp vụ này."` |
| **EX12** | Đơn mua vượt số lượng/giá trị còn lại | HTTP 400: `"Số lượng đặt mua (...) vượt quá số lượng còn lại..."` |
| **EX13** | Có chứng từ liên quan khi hủy/xóa | HTTP 400: `"Không thể xóa/hủy hợp đồng đã có đơn mua hàng liên quan."` |
| **EX14** | User không có quyền thao tác | HTTP 403: `{"detail": "Bạn không có quyền thực hiện chức năng này."}` |
| **EX15** | Xung đột cập nhật đồng thời | HTTP 400: `"Hợp đồng đã được User khác cập nhật. Vui lòng tải lại thông tin mới nhất."` |
| **EX16** | Tệp đính kèm không đúng định dạng / quá 10MB | HTTP 400: `"Định dạng tệp ... không được hỗ trợ" / "vượt quá 10 MB"` |

---

## 10. Kết quả Kiểm thử Tự động (Automated Test Suite)

Toàn bộ 23 ca kiểm thử trong `purchases/test_purchase_contract.py` kiểm tra 100% các luồng nghiệp vụ và quy tắc nêu trên:

1. `test_01_create_draft_and_auto_numbering`: Kiểm tra tạo nháp và sinh số `HDMH-2026-00001`, `00002`.
2. `test_02_cancelled_number_not_reused`: Kiểm tra số hợp đồng đã hủy không bị tái sử dụng.
3. `test_03_mandatory_fields_validation_ex01`: Kiểm tra bắt buộc các trường thông tin chung.
4. `test_04_dates_validation_ex02`: Kiểm tra ngày kết thúc >= ngày bắt đầu.
5. `test_05_inactive_supplier_ex03`: Kiểm tra chặn nhà cung cấp ngừng hoạt động.
6. `test_06_lines_required_ex04`: Kiểm tra bắt buộc có ít nhất 1 dòng chi tiết.
7. `test_07_line_field_validations_ex05_ex06_ex07_ex08`: Kiểm tra ràng buộc dữ liệu dòng chi tiết.
8. `test_08_foreign_currency_exchange_rate_ex09_br11`: Kiểm tra tỷ giá ngoại tệ.
9. `test_09_financial_calculations`: Kiểm tra công thức tính chiết khấu, thuế GTGT, tổng hợp đồng.
10. `test_10_payment_schedules_validation_ex10_br12`: Kiểm tra tổng đợt thanh toán không vượt giá trị hợp đồng.
11. `test_11_attachments_validation_ex16`: Kiểm tra định dạng và dung lượng tệp đính kèm.
12. `test_12_confirm_contract_without_workflow_af04`: Kiểm tra xác nhận trực tiếp không qua workflow.
13. `test_13_submit_approve_and_reject_flow`: Kiểm tra gửi duyệt, từ chối và phê duyệt.
14. `test_14_optimistic_locking_and_immutable_approved_contract_br18_ex15`: Kiểm tra khóa lạc quan và tính bất biến sau duyệt.
15. `test_15_create_order_from_contract_steps_29_31_br15_br17_ex12`: Kiểm tra tạo đơn mua hàng và cập nhật số lượng/giá trị còn lại.
16. `test_16_contract_execution_summary_step_32`: Kiểm tra API theo dõi tiến độ thực hiện.
17. `test_17_complete_contract_af05`: Kiểm tra hoàn thành hợp đồng và yêu cầu lý do nếu trước hạn.
18. `test_18_cancel_contract_af06_ex13`: Kiểm tra hủy hợp đồng và chặn hủy khi có đơn mua.
19. `test_19_delete_contract_af07_br19`: Kiểm tra xóa hợp đồng nháp và chặn xóa hợp đồng đã duyệt.
20. `test_20_expired_contract_br20`: Kiểm tra tự động chuyển trạng thái Hết hiệu lực khi quá hạn.
21. `test_21_search_and_filter_af01`: Kiểm tra tìm kiếm từ khóa và lọc dữ liệu.
22. `test_22_iam_permission_enforcement_ex14`: Kiểm tra phân quyền IAM và thông báo lỗi EX14.
23. `test_23_no_accounting_entries_br21`: Kiểm tra không phát sinh bút toán kế toán.
