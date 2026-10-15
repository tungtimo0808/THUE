# Tài liệu Kỹ thuật Backend: UC-PUR-11 Ghi nhận chi phí mua hàng

## 1. Mô tả tổng quan

| Thuộc tính | Chi tiết |
| :--- | :--- |
| **Mã Use Case** | `UC-PUR-11` |
| **Tên Use Case** | Ghi nhận chi phí mua hàng (Purchase Cost / Landed Cost Incurrence) |
| **Module** | Mua hàng (`purchases`), Sổ cái kế toán (`general_ledger`), Công nợ phải trả (`accounts_payable`) |
| **Mô tả** | Cung cấp toàn bộ API quản lý vòng đời chứng từ ghi nhận các chi phí phát sinh trực tiếp trong quá trình mua hàng (vận chuyển, bốc xếp, bảo hiểm, kiểm định, lưu kho, hải quan, thuế phí không hoàn lại...). Khi ghi sổ, hệ thống tự động sinh bút toán hạch toán, tăng công nợ phải trả (nếu chưa thanh toán), liên kết chứng từ mua hàng liên quan và thiết lập trạng thái phân bổ chi phí sẵn sàng cho UC-PUR-12. |
| **Base URL** | `/api/v1/purchases/purchase-costs/` |

---

## 2. Phạm vi chi phí & Trạng thái

### 2.1. Phân loại chi phí (`CostType`)

Hệ thống hỗ trợ 8 loại chi phí mua hàng được chuẩn hóa:

| Mã | Tên tiếng Việt | Diễn giải |
| :--- | :--- | :--- |
| `TRANSPORT` | Vận chuyển | Cước vận chuyển đường bộ, biển, hàng không |
| `LOADING` | Bốc xếp | Chi phí bốc dỡ hàng hóa tại cảng, kho |
| `INSURANCE` | Bảo hiểm | Phí bảo hiểm hàng hóa trên đường vận chuyển |
| `INSPECTION` | Kiểm định | Phí giám định, kiểm dịch, kiểm tra chất lượng |
| `STORAGE` | Kho bãi | Phí lưu kho, lưu bãi trước khi nhập kho chính thức |
| `CUSTOMS` | Hải quan | Chi phí làm thủ tục hải quan, mở tờ khai |
| `NON_REFUNDABLE_TAX` | Thuế, phí không hoàn lại | Các khoản lệ phí, thuế nhập khẩu không được khấu trừ |
| `OTHER` | Khác | Chi phí mua hàng khác có liên quan trực tiếp |

### 2.2. Vòng đời trạng thái chứng từ (`DocumentStatus`)

```
   [DRAFT] (Nháp)
      │
      ├── submit() ──────────────────────────┐ (nếu không có workflow duyệt: AF-09)
      ▼                                      ▼
[PENDING_APPROVAL] (Chờ phê duyệt) ──► [APPROVED] (Đã phê duyệt)
      │               ▲                      │
      ├── reject()    │ update()             ├── post()
      ▼               │                      ▼
  [REJECTED] ─────────┘                 [POSTED] (Đã ghi sổ)
  (Bị từ chối)                           (Khóa sửa đổi)

* Bất kỳ trạng thái nào trước POSTED đều có thể cancel() -> [CANCELLED] (Đã hủy)
```

### 2.3. Trạng thái phân bổ chi phí (`CostAllocationStatus`)

| Trạng thái | Mã | Ý nghĩa |
| :--- | :--- | :--- |
| **Không yêu cầu phân bổ** | `NOT_REQUIRED` | Dòng chi phí được tính trực tiếp vào tài khoản chi phí thời kỳ (ví dụ 641, 642) |
| **Chưa phân bổ** | `UNALLOCATED` | Chi phí cần phân bổ vào giá trị hàng mua (TK 1562), sẵn sàng phân bổ tại UC-PUR-12 |
| **Phân bổ một phần** | `PARTIALLY_ALLOCATED` | Một phần giá trị chi phí đã được phân bổ vào các chứng từ nhập kho |
| **Đã phân bổ** | `ALLOCATED` | Toàn bộ 100% giá trị đã được phân bổ hoàn tất |

---

## 3. Phân quyền IAM (Identity & Access Management)

Hệ thống áp dụng chính sách phân quyền tập trung cho phân hệ Mua hàng:

| Mã quyền IAM | Mô tả quyền | Các hành động API tương ứng |
| :--- | :--- | :--- |
| `PUR.COST.VIEW` | Quyền xem danh sách, chi tiết và chứng từ liên kết | `list`, `retrieve`, `eligible_purchases` |
| `PUR.COST.CREATE` | Quyền lập chứng từ chi phí mua hàng | `create` (POST) |
| `PUR.COST.EDIT` | Quyền cập nhật chứng từ Nháp hoặc Bị từ chối | `update`, `partial_update` (PUT / PATCH) |
| `PUR.COST.DELETE` | Quyền xóa chứng từ (chỉ áp dụng khi chưa ghi sổ) | `destroy` (DELETE) |
| `PUR.COST.SUBMIT` | Quyền gửi phê duyệt chứng từ | `submit` (POST) |
| `PUR.COST.APPROVE` | Quyền phê duyệt hoặc từ chối chứng từ chi phí | `approve`, `reject` (POST) |
| `PUR.COST.POST` | Quyền ghi sổ kế toán và tạo công nợ | `post` (POST) |
| `PUR.COST.CANCEL` | Quyền hủy chứng từ chi phí chưa ghi sổ | `cancel` (POST) |

---

## 4. Đặc tả API Endpoints

### 4.1. Lấy danh sách chứng từ chi phí mua hàng
- **URL**: `GET /api/v1/purchases/purchase-costs/`
- **Quyền**: `PUR.COST.VIEW`
- **Query Parameters**:
  - `company_id` (*bắt buộc*, UUID): Mã công ty.
  - `number` / `code` (*tùy chọn*): Lọc theo số chứng từ.
  - `supplier_id` (*tùy chọn*, UUID): Lọc theo nhà cung cấp chi phí.
  - `status` (*tùy chọn*): `DRAFT`, `PENDING_APPROVAL`, `REJECTED`, `APPROVED`, `POSTED`, `CANCELLED`.
  - `allocation_status` (*tùy chọn*): `NOT_REQUIRED`, `UNALLOCATED`, `PARTIALLY_ALLOCATED`, `ALLOCATED`.
  - `document_date_from`, `document_date_to` (*tùy chọn*, YYYY-MM-DD): Khoảng ngày lập.

---

### 4.2. Lấy danh sách đơn mua và chứng từ mua đủ điều kiện liên kết
- **URL**: `GET /api/v1/purchases/purchase-costs/eligible-purchases/`
- **Quyền**: `PUR.COST.VIEW`
- **Query Parameters**:
  - `company_id` (*bắt buộc*, UUID)
- **Quy tắc (BR-PUR-CST-08, 11)**: Chỉ lấy các đơn mua (`PurchaseOrder`) và chứng từ mua hàng hóa (`GoodsPurchase`) đã ở trạng thái `APPROVED`, `IN_PROGRESS`, `PARTIALLY_RECEIVED`, `FULLY_RECEIVED`, `COMPLETED` hoặc `POSTED`, không bị hủy.

#### Response Success (200 OK):
```json
{
  "orders": [
    {
      "id": "e963b655-bdf9-42b4-9c94-cb4e11dbbf37",
      "number": "PO-2026-0001",
      "document_date": "2026-10-06",
      "supplier": "d05eb41d-cb56-4279-9134-8c01ba47cf1c",
      "supplier_name": "Công ty TNHH Cung Cấp Hàng A",
      "total_amount": "100000000.0000",
      "status": "APPROVED"
    }
  ],
  "goods_purchases": [
    {
      "id": "67246ec2-53b7-4b71-b258-20da4cbdf02f",
      "number": "GP-2026-0001",
      "document_date": "2026-10-06",
      "supplier": "d05eb41d-cb56-4279-9134-8c01ba47cf1c",
      "supplier_name": "Công ty TNHH Cung Cấp Hàng A",
      "purchase_type": "WAREHOUSE",
      "total_amount": "100000000.0000",
      "status": "POSTED"
    }
  ]
}
```

---

### 4.3. Thêm mới chứng từ chi phí mua hàng
- **URL**: `POST /api/v1/purchases/purchase-costs/?company_id={company_id}`
- **Quyền**: `PUR.COST.CREATE`
- **Request Body**:
```json
{
  "branch": "a910ea76-13ea-44fb-811c-c2b61ff6fe60",
  "document_date": "2026-10-06",
  "posting_date": "2026-10-06",
  "supplier": "d05eb41d-cb56-4279-9134-8c01ba47cf1c",
  "payment_type": "UNPAID",
  "payment_account": "887a0201-94fb-4b53-93d1-3dbfa1202888",
  "supplier_invoice": null,
  "related_orders": ["e963b655-bdf9-42b4-9c94-cb4e11dbbf37"],
  "related_goods_purchases": [],
  "notes": "Cước vận chuyển lô hàng máy tính",
  "attachments": [],
  "lines": [
    {
      "line_no": 1,
      "cost_type": "TRANSPORT",
      "description": "Vận chuyển hàng từ cảng Hải Phòng về kho Hà Nội",
      "pre_tax_amount": "5000000.0000",
      "tax_rate": "b1b7fcf4-54c7-4ee4-9e33-7bbde10375f1",
      "tax_amount": "500000.0000",
      "total_amount": "5500000.0000",
      "requires_allocation": true,
      "account": "5c117d60-449e-4df7-8c46-95f00e2b9c31"
    }
  ]
}
```

#### Response Success (201 Created):
```json
{
  "id": "763ce142-b7e1-45ce-844f-c020f92b77ff",
  "number": "CP202610060001",
  "document_date": "2026-10-06",
  "posting_date": "2026-10-06",
  "supplier": "d05eb41d-cb56-4279-9134-8c01ba47cf1c",
  "payment_type": "UNPAID",
  "payment_type_display": "Chưa thanh toán",
  "payment_account": "887a0201-94fb-4b53-93d1-3dbfa1202888",
  "supplier_invoice": null,
  "related_orders": ["e963b655-bdf9-42b4-9c94-cb4e11dbbf37"],
  "related_goods_purchases": [],
  "version": 1,
  "subtotal": "5000000.0000",
  "tax_amount": "500000.0000",
  "total_amount": "5500000.0000",
  "status": "DRAFT",
  "status_display": "Bản nháp",
  "allocation_status": "UNALLOCATED",
  "allocation_status_display": "Chưa phân bổ",
  "notes": "Cước vận chuyển lô hàng máy tính",
  "attachments": [],
  "journal_entry": null,
  "lines": [
    {
      "id": "40b15b31-3aa2-4c2f-b44c-20fe1bc277c0",
      "line_no": 1,
      "cost_type": "TRANSPORT",
      "cost_type_display": "Vận chuyển",
      "description": "Vận chuyển hàng từ cảng Hải Phòng về kho Hà Nội",
      "pre_tax_amount": "5000000.0000",
      "tax_rate": "b1b7fcf4-54c7-4ee4-9e33-7bbde10375f1",
      "tax_amount": "500000.0000",
      "total_amount": "5500000.0000",
      "requires_allocation": true,
      "account": "5c117d60-449e-4df7-8c46-95f00e2b9c31",
      "allocation_status": "UNALLOCATED",
      "allocation_status_display": "Chưa phân bổ",
      "allocated_amount": "0.0000"
    }
  ]
}
```

---

### 4.4. Gửi phê duyệt chứng từ (`POST /submit/`)
- **URL**: `POST /api/v1/purchases/purchase-costs/{id}/submit/?company_id={company_id}`
- **Quyền**: `PUR.COST.SUBMIT`
- **Xử lý**:
  - Kiểm tra kỳ kế toán chưa khóa (`EF-09`).
  - Kiểm tra chứng từ mua liên quan và tính duy nhất của hóa đơn (`EF-04`, `EF-05`).
  - Nếu cấu hình workflow cho phép người lập tự duyệt hoặc không có workflow (`AF-09`), chuyển thẳng sang `APPROVED`.
  - Ngược lại, chuyển sang `PENDING_APPROVAL`.

---

### 4.5. Phê duyệt & Từ chối chứng từ (`POST /approve/`, `POST /reject/`)
- **Phê duyệt**: `POST /api/v1/purchases/purchase-costs/{id}/approve/`
  - Body: `{"comment": "Đồng ý phê duyệt"}`
  - Trạng thái chuyển sang: `APPROVED`.
- **Từ chối**: `POST /api/v1/purchases/purchase-costs/{id}/reject/`
  - Body: `{"reason": "Đơn giá vận chuyển quá cao"}` (*bắt buộc nhập lý do - BR-PUR-CST-37*)
  - Trạng thái chuyển sang: `REJECTED`.

---

### 4.6. Ghi sổ chứng từ chi phí (`POST /post/`)
- **URL**: `POST /api/v1/purchases/purchase-costs/{id}/post/?company_id={company_id}`
- **Quyền**: `PUR.COST.POST`
- **Điều kiện**: Chứng từ phải ở trạng thái `APPROVED` (`BR-PUR-CST-04`).
- **Hành động trong một Transaction Atomic (`BR-PUR-CST-32`)**:
  1. **Tạo bút toán Sổ cái (`JournalEntry`)**:
     - Nợ TK Chi phí chờ phân bổ (1562) hoặc TK Chi phí trực tiếp (641/642...): `pre_tax_amount`.
     - Nợ TK Thuế GTGT đầu vào được khấu trừ (1331) nếu có thuế: `tax_amount`.
     - Có TK Công nợ (331), Tiền mặt (111) hoặc Tiền gửi (112): `total_amount`.
  2. **Ghi nhận công nợ (`Payable`)**:
     - Nếu `payment_type == "UNPAID"`, tự động tạo bản ghi `Payable` tương ứng với nhà cung cấp dịch vụ chi phí (`BR-PUR-CST-27`).
  3. **Cập nhật trạng thái phân bổ**:
     - Dòng `requires_allocation = True` gán `allocation_status = "UNALLOCATED"`.
     - Dòng `requires_allocation = False` gán `allocation_status = "NOT_REQUIRED"`.
  4. **Chuyển trạng thái chứng từ** sang `POSTED` và ghi Audit Log.

#### Response Success (200 OK):
```json
{
  "detail": "Ghi sổ chứng từ chi phí mua hàng thành công.",
  "data": {
    "id": "763ce142-b7e1-45ce-844f-c020f92b77ff",
    "status": "POSTED",
    "status_display": "Đã ghi sổ",
    "allocation_status": "UNALLOCATED",
    "journal_entry": "b1b7fcf4-54c7-4ee4-9e33-7bbde10375f1"
  }
}
```

---

### 4.7. Hủy chứng từ chi phí (`POST /cancel/`)
- **URL**: `POST /api/v1/purchases/purchase-costs/{id}/cancel/?company_id={company_id}`
- **Quyền**: `PUR.COST.CANCEL`
- **Body**: `{"reason": "Lý do hủy chứng từ"}` (*bắt buộc nhập lý do - AF-12*)
- **Ràng buộc**: Không được hủy chứng từ đã ghi sổ (`BR-PUR-CST-05`).

---

## 5. Quy tắc nghiệp vụ (Business Rules Mapping)

| Mã BR | Nội dung quy tắc | Triển khai Backend |
| :--- | :--- | :--- |
| **BR-PUR-CST-01** | Quyền lập, duyệt, ghi sổ, hủy, xem phân tách rõ ràng. | Áp dụng `PurchasePermission` với từng action tương ứng trong `action_permissions`. |
| **BR-PUR-CST-02** | Quyền lập không mặc nhiên bao gồm quyền duyệt/ghi sổ. | Tách riêng quyền `PUR.COST.CREATE`, `APPROVE`, `POST`. |
| **BR-PUR-CST-03** | Chỉ chứng từ Nháp hoặc Bị từ chối mới được sửa. | Chặn tại `update_purchase_cost` nếu `status not in (DRAFT, REJECTED)`. |
| **BR-PUR-CST-04** | Chỉ chứng từ Đã phê duyệt mới được ghi sổ. | Chặn tại `post_purchase_cost` nếu `status != APPROVED`. |
| **BR-PUR-CST-05** | Chứng từ Đã ghi sổ không được sửa hoặc xóa trực tiếp. | Chặn tại `destroy` và `update_purchase_cost`. |
| **BR-PUR-CST-06** | Mọi thay đổi trạng thái phải ghi Audit Log. | Gọi hàm `audit()` tại create, update, submit, approve, reject, post, cancel. |
| **BR-PUR-CST-07** | Bắt buộc liên kết ít nhất một đơn mua hoặc chứng từ mua hàng hóa. | Kiểm tra `related_orders` hoặc `related_goods_purchases` không rỗng. |
| **BR-PUR-CST-08** | Chứng từ mua liên quan phải đã duyệt hoặc ghi sổ, không bị hủy. | Kiểm tra trạng thái của đơn mua / chứng từ mua tại `validate_cost_header`. |
| **BR-PUR-CST-09** | Cho phép liên kết với nhiều chứng từ mua cùng lúc. | Thiết kế ManyToMany cho `related_orders` và `related_goods_purchases`. |
| **BR-PUR-CST-10** | NCC chi phí có thể khác NCC hàng hóa. | Cho phép chọn Party chi phí độc lập với bên bán hàng. |
| **BR-PUR-CST-11** | Đơn mua đã hoàn thành vẫn được ghi nhận thêm chi phí. | Cho phép PO ở trạng thái `COMPLETED` liên kết chi phí phát sinh sau. |
| **BR-PUR-CST-13** | Số tiền trước thuế mỗi dòng phải lớn hơn 0. | Kiểm tra `pre_tax_amount > 0` (`EF-06`). |
| **BR-PUR-CST-14** | Tiền thuế = Số tiền trước thuế × Thuế suất. | Tính tự động hoặc nhận tiền thuế tùy chỉnh theo hóa đơn. |
| **BR-PUR-CST-15** | Tổng thanh toán = Tiền trước thuế + Tiền thuế. | Tính toán chính xác theo từng dòng và cộng dồn toàn chứng từ. |
| **BR-PUR-CST-18** | Hóa đơn đầu vào không được sử dụng trùng lặp. | Kiểm tra `supplier_invoice` chưa liên kết với chứng từ chi phí khác (`EF-05`). |
| **BR-PUR-CST-20** | Yêu cầu phân bổ -> hạch toán vào TK chờ phân bổ (1562). | Kiểm tra tài khoản chi phí hợp lệ. |
| **BR-PUR-CST-21** | Không yêu cầu phân bổ -> hạch toán trực tiếp chi phí thời kỳ. | Ghi nhận trực tiếp vào TK chi phí người dùng chọn (641/642...). |
| **BR-PUR-CST-22** | Khi ghi sổ, dòng yêu cầu phân bổ có trạng thái Chưa phân bổ. | Cập nhật `allocation_status = UNALLOCATED` tại thời điểm ghi sổ. |
| **BR-PUR-CST-27** | Chi phí chưa thanh toán làm tăng công nợ phải trả. | Tạo bản ghi `Payable` (TK Có 331) khi `payment_type == UNPAID`. |
| **BR-PUR-CST-28** | Thanh toán tiền mặt ghi Có TK tiền mặt (111). | Ghi Có tài khoản tiền mặt được chọn trong `JournalEntry`. |
| **BR-PUR-CST-29** | Thanh toán chuyển khoản ghi Có TK tiền gửi (112). | Ghi Có tài khoản tiền gửi được chọn trong `JournalEntry`. |
| **BR-PUR-CST-30** | Tài khoản kế toán sử dụng phải đang hoạt động (`ACTIVE`). | Kiểm tra `account.status == ACTIVE` (`EF-07`). |
| **BR-PUR-CST-31** | Ngày hạch toán phải thuộc kỳ kế toán chưa khóa. | Kiểm tra `determine_period_for_date` đang `OPEN` (`EF-09`). |
| **BR-PUR-CST-32** | Tính toàn vẹn giao dịch (Atomic Transaction). | Toàn bộ thao tác ghi sổ đặt trong `@transaction.atomic` (`EF-15`). |
| **BR-PUR-CST-33** | Số chứng từ duy nhất theo doanh nghiệp. | Tự động sinh số theo quy tắc `number_for` và UniqueConstraint `(company, number)`. |
| **BR-PUR-CST-34** | Bút toán phát sinh liên kết ngược về chứng từ chi phí. | Lưu `journal_entry_id` trên `PurchaseCost`. |
| **BR-PUR-CST-37** | Bắt buộc nhập lý do khi từ chối chứng từ. | Validate `reason` không rỗng tại API `reject` (`AF-10`). |
| **BR-PUR-CST-40** | Chứng từ đã hủy không được dùng để phân bổ hay ghi sổ. | Khóa chứng từ `CANCELLED`. |

---

## 6. Xử lý ngoại lệ (Exception Flows Mapping)

| Mã lỗi | Trường hợp ngoại lệ | HTTP Status | Thông báo trả về |
| :--- | :--- | :--- | :--- |
| **EF-01** | Không có quyền xem danh sách/chi tiết | `403 Forbidden` | `"Bạn không có quyền xem chứng từ chi phí mua hàng."` |
| **EF-02** | Không có quyền lập chứng từ | `403 Forbidden` | `"Bạn không có quyền lập chứng từ chi phí mua hàng."` |
| **EF-03** | Nhà cung cấp chi phí không còn hoạt động | `400 Bad Request` | `"Nhà cung cấp chi phí không còn hoạt động."` |
| **EF-04** | Chứng từ mua liên quan không còn hợp lệ (nháp/hủy) | `400 Bad Request` | `"Chứng từ mua được chọn không còn đủ điều kiện liên kết."` |
| **EF-05** | Hóa đơn đầu vào đã được sử dụng cho chứng từ khác | `400 Bad Request` | `"Hóa đơn đầu vào đã được sử dụng cho chứng từ khác."` |
| **EF-06** | Số tiền trước thuế nhỏ hơn hoặc bằng 0 | `400 Bad Request` | `"Số tiền trước thuế phải lớn hơn 0."` |
| **EF-07** | Tài khoản kế toán đã ngừng sử dụng | `400 Bad Request` | `"Tài khoản kế toán đã ngừng sử dụng. Vui lòng chọn tài khoản khác."` |
| **EF-08** | Thiếu các trường bắt buộc | `400 Bad Request` | `"Vui lòng nhập đầy đủ các trường bắt buộc."` |
| **EF-09** | Ngày hạch toán thuộc kỳ kế toán đã khóa | `400 Bad Request` | `"Ngày hạch toán thuộc kỳ kế toán đã khóa."` |
| **EF-10** | Không có dòng chi phí hợp lệ | `400 Bad Request` | `"Chứng từ phải có ít nhất một dòng chi phí hợp lệ."` |
| **EF-12** | Chứng từ đã được xử lý bởi người dùng khác | `400 Bad Request` | `"Chứng từ đã được xử lý bởi người dùng khác."` |
| **EF-13** | Không có quyền ghi sổ | `403 Forbidden` | `"Bạn không có quyền ghi sổ chứng từ chi phí mua hàng."` |
| **EF-14** | Dữ liệu liên quan thay đổi sau khi phê duyệt | `400 Bad Request` | `"Dữ liệu liên quan đã thay đổi. Vui lòng kiểm tra và phê duyệt lại chứng từ."` |
| **EF-15** | Tạo bút toán hoặc công nợ thất bại (rollback hoàn toàn) | `400 Bad Request` | `"Ghi sổ không thành công. Không có bút toán hoặc công nợ nào được tạo."` |

---

## 7. Kiểm thử tự động (Automated Test Suite)

Toàn bộ các ca kiểm thử cho Use Case `UC-PUR-11` được đặt tại [purchases/test_purchase_cost.py](file:///c:/Users/Admin/LapTrinh/Thue/purchases/test_purchase_cost.py):

| Test Method | Nghiệp vụ kiểm thử |
| :--- | :--- |
| `test_create_cost_draft_success` | Lập chứng từ nháp, tính tổng tiền, trạng thái `DRAFT` và `UNALLOCATED`. |
| `test_pre_tax_amount_must_be_positive_ef_06` | Kiểm tra bắt buộc số tiền trước thuế > 0 (`EF-06`, `BR-PUR-CST-13`). |
| `test_inactive_supplier_ef_03` | Chặn nhà cung cấp đã ngừng hoạt động (`EF-03`). |
| `test_inactive_account_ef_07` | Chặn tài khoản kế toán không hoạt động (`EF-07`, `BR-PUR-CST-30`). |
| `test_missing_related_purchase_br_07` | Bắt buộc liên kết ít nhất 1 đơn mua hoặc chứng từ mua (`BR-PUR-CST-07`). |
| `test_invalid_or_draft_related_purchase_ef_04` | Chặn chứng từ mua ở trạng thái `DRAFT` hoặc `CANCELLED` (`EF-04`). |
| `test_invoice_reused_ef_05` | Chặn dùng trùng hóa đơn đầu vào (`EF-05`, `BR-PUR-CST-18`). |
| `test_closed_accounting_period_ef_09` | Chặn ngày hạch toán rơi vào kỳ kế toán đã khóa (`EF-09`, `BR-PUR-CST-31`). |
| `test_submit_approve_and_post_unpaid_flow` | Luồng hoàn chỉnh: Tạo nháp -> Gửi duyệt -> Duyệt -> Ghi sổ (Tạo Sổ cái & Công nợ 331). |
| `test_direct_expense_not_requiring_allocation_af_04` | Chi phí không phân bổ -> trạng thái `NOT_REQUIRED`, hạch toán chi phí trực tiếp (`AF-04`). |
| `test_reject_flow_and_revision_af_10_and_af_11` | Từ chối yêu cầu lý do -> Sửa tài liệu bị từ chối tăng version và gửi duyệt lại. |
| `test_cancellation_flow_af_12` | Hủy chứng từ trước khi ghi sổ bắt buộc nhập lý do (`AF-12`). |
| `test_eligible_purchases_endpoint` | Truy vấn danh sách PO và GP hợp lệ để liên kết. |
| `test_iam_permissions_ef_01_and_ef_02` | Kiểm tra phân quyền truy cập và lập chứng từ (`EF-01`, `EF-02`). |
| `test_cash_and_bank_payment_flows_af_06_af_07` | Thanh toán tiền mặt (111) và chuyển khoản (112) không sinh công nợ phải trả. |
| `test_multiple_related_purchases_af_01` | Một chi phí liên kết nhiều PO và GP cùng lúc (`AF-01`, `BR-PUR-CST-09`). |
| `test_no_tax_cost_af_03` | Chi phí không có thuế GTGT: tiền thuế = 0 (`AF-03`). |
| `test_concurrency_or_already_processed_ef_12` | Xử lý xung đột khi chứng từ đã được người khác xử lý (`EF-12`). |
| `test_related_data_changed_after_approval_ef_14` | Chứng từ mua liên quan bị hủy sau khi duyệt -> Chặn ghi sổ (`EF-14`). |

Kết quả chạy bộ kiểm thử tự động đạt **100% PASS (19/19 tests)**.
