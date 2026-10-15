# Tài liệu Kỹ thuật Backend: UC-PUR-10 Theo dõi thực hiện đơn mua

## 1. Mô tả tổng quan

| Thuộc tính | Chi tiết |
| :--- | :--- |
| **Mã Use Case** | `UC-PUR-10` |
| **Tên Use Case** | Theo dõi thực hiện đơn mua (Purchase Order Execution Tracking) |
| **Module** | Mua hàng (`purchases`), Công nợ phải trả (`accounts_payable`) |
| **Mục đích** | Cho phép User theo dõi tiến độ nhận hàng, nghiệm thu dịch vụ, hàng mua trả lại và hóa đơn đầu vào của từng đơn mua đã được phê duyệt trong thời gian thực mà không làm biến đổi dữ liệu đơn mua hay chứng từ liên quan (`BR-PUR-TRK-35`). |
| **Base URL** | `/api/v1/purchases/tracking/` |

---

## 2. Phân quyền IAM & Kiểm tra quyền hạn

### 2.1. Quyền IAM cho chức năng theo dõi
- **`PUR.TRACKING.VIEW`**: Quyền xem danh sách theo dõi tiến độ và thông tin chi tiết thực hiện đơn mua (`BR-PUR-TRK-01`).
  - *Cơ chế Fallback*: Nếu tài khoản chưa gán riêng mã `PUR.TRACKING.VIEW`, hệ thống cho phép kế thừa từ `PUR.ORDER.VIEW` hoặc `PUR.ORDER.TRACK`.
- **`PUR.TRACKING.EXPORT`**: Quyền xuất dữ liệu báo cáo theo dõi tiến độ đơn mua (`AF-12`).
  - *Cơ chế Fallback*: Kế thừa từ `PUR.ORDER.EXPORT`, `PUR.TRACKING.VIEW`, hoặc `PUR.ORDER.VIEW`.

### 2.2. Kiểm tra quyền xem chứng từ liên quan (`BR-PUR-TRK-03`, `EF-11`)
Quyền xem tiến độ đơn mua **không mặc nhiên** bao gồm quyền xem chi tiết chứng từ mua hàng, trả lại hay hóa đơn liên quan. Khi User bấm xem chứng từ liên quan, hệ thống kiểm tra độc lập:
- Mua hàng hóa: `PUR.GOODS.VIEW`
- Mua dịch vụ: `PUR.SERVICE.VIEW`
- Hàng mua trả lại: `PUR.RETURN.VIEW`
- Giảm giá hàng mua: `PUR.DISCOUNT.VIEW`
- Hóa đơn đầu vào: `AP.INVOICE.VIEW` hoặc `PUR.INPUT_INVOICE.VIEW`

---

## 3. Công thức tính toán & Quy tắc nghiệp vụ (Business Rules)

### 3.1. Hàng hóa vật tư (Goods Tracking)
- **Số lượng đặt mua**: Lấy theo phiên bản đơn mua đã phê duyệt gần nhất trên `PurchaseOrderLine`.
- **Số lượng đã nhận**: Tổng số lượng trên các chứng từ mua hàng hóa `GoodsPurchaseLine` đã ghi sổ (`status = "POSTED"`).
- **Số lượng đã trả lại**: Tổng số lượng trên các chứng từ hàng mua trả lại `PurchaseReturnLine` đã ghi sổ (`status = "POSTED"`).
- **Số lượng thực nhận** (`BR-PUR-TRK-09`):
  $$\text{Số lượng thực nhận} = \text{Số lượng đã nhận} - \text{Số lượng đã trả lại}$$
- **Số lượng còn phải nhận** (`BR-PUR-TRK-10`):
  $$\text{Số lượng còn phải nhận} = \max(\text{Số lượng đặt mua} - \text{Số lượng thực nhận}, 0)$$
- **Cảnh báo nhận vượt** (`AF-03`, `BR-PUR-TRK-11`):
  Khi $\text{Số lượng thực nhận} > \text{Số lượng đặt mua}$, hệ thống gắn cờ `is_over_received = true`, hiển thị lượng nhận vượt `over_received_quantity = net_received - ordered`.
- **Tỷ lệ thực hiện (%)** (`BR-PUR-TRK-21`):
  Tỷ lệ thực hiện hiển thị tối đa 100%. Phần nhận vượt được tách riêng:
  $$\text{Tỷ lệ thực hiện} = \min\left(100\%, \frac{\text{Số lượng thực nhận}}{\text{Số lượng đặt mua}} \times 100\right)$$
- **Chuyển đổi trạng thái khi phát sinh trả hàng** (`BR-PUR-TRK-22`):
  Hàng mua trả lại làm giảm số lượng thực nhận, có thể đưa trạng thái nhận hàng từ `Đã nhận đủ` (`FULLY_RECEIVED`) trở về `Nhận một phần` (`PARTIALLY_RECEIVED`).

### 3.2. Dịch vụ (Service Tracking)
- **Dịch vụ quản lý số lượng** (`BR-PUR-TRK-13`): Theo dõi theo khối lượng nghiệm thu thực tế tương tự hàng hóa.
- **Dịch vụ không quản lý số lượng** (`AF-04`, `BR-PUR-TRK-14`): Theo dõi theo giá trị trước thuế đã nghiệm thu so với giá trị đặt mua.
- **Giảm trừ chiết khấu / giảm giá** (`BR-PUR-TRK-16`): Giá trị giảm giá hàng mua đã ghi sổ (`PurchaseDiscount`) được trừ trực tiếp khỏi giá trị còn phải thực hiện của dịch vụ:
  $$\text{Giá trị còn phải thực hiện} = \max(\text{Giá trị đặt} - \text{Giá trị đã nghiệm thu} - \text{Giá trị giảm giá}, 0)$$

### 3.3. Hóa đơn đầu vào (Input Invoice Tracking)
- **Hóa đơn hợp lệ** (`BR-PUR-TRK-23`, `BR-PUR-TRK-29`): Chỉ tính các hóa đơn đầu vào `SupplierInvoice` có `validation_status = "VALID"` và không ở trạng thái `CANCELLED`.
- **Giá trị theo dõi hóa đơn** (`BR-PUR-TRK-24`): Giá trị trước thuế sau giảm giá: $\text{subtotal} - \text{discount\_amount}$.
- **Trạng thái hóa đơn**:
  - `Chưa nhận` (`NOT_INVOICED`): Giá trị hóa đơn hợp lệ bằng 0 (`BR-PUR-TRK-25`).
  - `Nhận một phần` (`PARTIALLY_INVOICED`): $0 < \text{Giá trị hóa đơn} < \text{Giá trị cần nhận hóa đơn}$ (`BR-PUR-TRK-26`).
  - `Đã nhận đủ` (`FULLY_INVOICED`): $\text{Giá trị hóa đơn} = \text{Giá trị cần nhận hóa đơn}$ (`BR-PUR-TRK-27`).
  - `Nhận vượt` (`OVER_INVOICED`): $\text{Giá trị hóa đơn} > \text{Giá trị cần nhận hóa đơn}$, thể hiện rõ số tiền chênh lệch vượt (`AF-05`, `BR-PUR-TRK-28`).

### 3.4. Quá hạn & Tiến độ tổng thể
- **Quá hạn dòng** (`BR-PUR-TRK-30`): Một dòng quá hạn khi chưa hoàn thành (`receiving_status != "FULLY_RECEIVED"`) và $\text{Ngày hiện tại} > \text{Ngày dự kiến nhận}$.
- **Số ngày quá hạn** (`BR-PUR-TRK-31`):
  $$\text{Số ngày quá hạn} = \text{Ngày hiện tại} - \text{Ngày dự kiến nhận gần nhất chưa hoàn thành}$$
- **Quá hạn đơn mua** (`BR-PUR-TRK-32`): Đơn mua bị gắn cờ `Quá hạn` (`is_overdue = true`) nếu có ít nhất một dòng còn hiệu lực bị quá hạn.
- **Đơn mua đã hoàn thành** (`BR-PUR-TRK-33`, `AF-06`): Đơn mua ở trạng thái `COMPLETED` không bị tính quá hạn, kể cả khi nghiệm thu sau ngày dự kiến (hệ thống ghi nhận là hoàn thành trễ `completed_late = true`).

---

## 4. Đặc tả API Endpoints

### 4.1. Danh sách theo dõi thực hiện đơn mua
- **URL**: `GET /api/v1/purchases/tracking/`
- **Quyền**: `PUR.TRACKING.VIEW` (hoặc `PUR.ORDER.VIEW`)
- **Query Parameters**:
  - `company_id` (*bắt buộc*, UUID): Mã doanh nghiệp.
  - `code` (*tùy chọn*, String): Tìm kiếm theo toàn bộ hoặc một phần mã đơn mua.
  - `supplier_id` (*tùy chọn*, UUID hoặc danh sách): Lọc theo nhà cung cấp.
  - `order_date_from`, `order_date_to` (*tùy chọn*, YYYY-MM-DD): Khoảng ngày lập đơn mua.
  - `expected_delivery_date_from`, `expected_delivery_date_to` (*tùy chọn*, YYYY-MM-DD): Khoảng ngày dự kiến nhận hàng/nghiệm thu.
  - `status` (*tùy chọn*, String): Trạng thái đơn mua (`APPROVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
  - `receiving_status` (*tùy chọn*): `NOT_RECEIVED`, `PARTIALLY_RECEIVED`, `FULLY_RECEIVED`.
  - `invoicing_status` (*tùy chọn*): `NOT_INVOICED`, `PARTIALLY_INVOICED`, `FULLY_INVOICED`, `OVER_INVOICED`.
  - `overdue_status` (*tùy chọn*): `ALL`, `NOT_OVERDUE`, `OVERDUE`.
  - `buyer_id` (*tùy chọn*, UUID): Người phụ trách thực hiện đơn mua.

#### Response Success (200 OK):
```json
{
  "count": 1,
  "results": [
    {
      "id": "e963b655-bdf9-42b4-9c94-cb4e11dbbf37",
      "number": "PO-2026-001",
      "document_date": "2026-10-06",
      "status": "APPROVED",
      "status_display": "Đã phê duyệt",
      "supplier": {
        "id": "8c6b6537-8270-4e1d-8472-ee1d8ea8344e",
        "code": "S1",
        "name": "Supplier"
      },
      "buyer": {
        "id": "c138f6d2-8f19-4f70-a3bc-2244ea490dc6",
        "name": "Trần Văn A",
        "email": "a.tran@example.com"
      },
      "currency": {
        "id": "672ebaf6-c567-4638-b7ae-1bdceebdb7f4",
        "code": "VND"
      },
      "delivery_date": "2026-10-13",
      "initial_delivery_date": "2026-10-13",
      "total_pre_tax_amount": "1000.0000",
      "progress_percent": "70.00",
      "receiving_status": "PARTIALLY_RECEIVED",
      "receiving_status_display": "Nhận một phần",
      "invoicing_status": "PARTIALLY_INVOICED",
      "invoicing_status_display": "Nhận một phần",
      "invoiced_pre_tax_amount": "600.0000",
      "order_value_to_invoice": "1000.0000",
      "difference_invoice_amount": "400.0000",
      "is_overdue": false,
      "overdue_days": 0,
      "completed_late": false,
      "lines_count": 1
    }
  ]
}
```

---

### 4.2. Chi tiết thực hiện đơn mua
- **URL**: `GET /api/v1/purchases/tracking/{id}/`
- **Quyền**: `PUR.TRACKING.VIEW` (hoặc `PUR.ORDER.VIEW`)
- **Query Parameters**:
  - `company_id` (*bắt buộc*, UUID)

#### Response Success (200 OK):
Bao gồm thông tin tổng hợp, chi tiết từng dòng hàng hóa/dịch vụ, danh sách chứng từ thực hiện liên quan và dòng thời gian (timeline):
```json
{
  "order": {
    "id": "e963b655-bdf9-42b4-9c94-cb4e11dbbf37",
    "number": "PO-2026-001",
    "document_date": "2026-10-06",
    "delivery_date": "2026-10-13",
    "status": "APPROVED",
    "status_display": "Đã phê duyệt",
    "total_pre_tax_amount": "1000.0000",
    "total_amount": "1000.0000",
    "notes": "Đơn mua hàng thử nghiệm"
  },
  "summary": { ... },
  "lines": [
    {
      "id": "3c9cb54f-4fa1-45ce-8c50-c8f8b8a5d4d3",
      "line_no": 1,
      "item": {
        "id": "6c49129e-2ba7-4a00-99e4-5394e334a1ce",
        "code": "I1",
        "name": "Item",
        "item_type": "GOODS"
      },
      "uom": { "id": "...", "code": "PCS", "name": "Piece" },
      "description": "",
      "is_service": false,
      "unit_price": "100.0000",
      "ordered_quantity": "10.000000",
      "received_quantity": "10.000000",
      "returned_quantity": "3.000000",
      "net_received_quantity": "7.000000",
      "remaining_quantity": "3.000000",
      "is_over_received": false,
      "over_received_quantity": "0.000000",
      "accepted_value": "1000.0000",
      "discounted_value": "0.0000",
      "remaining_service_value": "0.0000",
      "is_over_accepted_value": false,
      "pre_tax_amount": "1000.0000",
      "realized_pre_tax": "700.0000",
      "progress_percent": "70.00",
      "receiving_status": "PARTIALLY_RECEIVED",
      "receiving_status_display": "Nhận một phần",
      "expected_delivery_date": "2026-10-13",
      "latest_execution_date": "2026-10-06",
      "is_overdue": false,
      "overdue_days": 0
    }
  ],
  "has_execution_documents": true,
  "execution_message": "",
  "related_documents": {
    "goods_receipts": [
      {
        "id": "67246ec2-53b7-4b71-b258-20da4cbdf02f",
        "document_type": "GOODS_PURCHASE",
        "document_type_display": "Mua hàng hóa",
        "number": "GP-001",
        "document_date": "2026-10-06",
        "status": "POSTED",
        "pre_tax_amount": "600.0000",
        "total_amount": "600.0000"
      }
    ],
    "service_receipts": [],
    "returns": [
      {
        "id": "824b6f12-0761-46be-91c6-30248a803f29",
        "document_type": "PURCHASE_RETURN",
        "document_type_display": "Hàng mua trả lại",
        "number": "RET-001",
        "document_date": "2026-10-06",
        "status": "POSTED",
        "pre_tax_amount": "300.0000",
        "total_amount": "300.0000",
        "reason": "Defective goods"
      }
    ],
    "discounts": [],
    "invoices": [
      {
        "id": "18cf15d3-85e6-42d1-93c6-2f1950dbcc47",
        "document_type": "SUPPLIER_INVOICE",
        "document_type_display": "Hóa đơn đầu vào",
        "series": "AA/26E",
        "number": "000101",
        "document_date": "2026-10-06",
        "status": "POSTED",
        "validation_status": "VALID",
        "pre_tax_amount": "600.0000",
        "total_amount": "600.0000"
      }
    ]
  },
  "timeline": [
    {
      "document_date": "2026-10-06",
      "document_type": "PURCHASE_ORDER",
      "document_type_display": "Đơn mua",
      "document_number": "PO-2026-001",
      "document_id": "e963b655-bdf9-42b4-9c94-cb4e11dbbf37",
      "description": "Lập đơn mua hàng PO-2026-001",
      "pre_tax_amount": "1000.0000",
      "amount": "1000.0000"
    },
    {
      "document_date": "2026-10-06",
      "document_type": "GOODS_PURCHASE",
      "document_type_display": "Mua hàng hóa",
      "document_number": "GP-001",
      "document_id": "67246ec2-53b7-4b71-b258-20da4cbdf02f",
      "description": "Ghi nhận mua hàng hóa theo đơn PO-2026-001",
      "pre_tax_amount": "600.0000",
      "amount": "600.0000"
    },
    {
      "document_date": "2026-10-06",
      "document_type": "PURCHASE_RETURN",
      "document_type_display": "Hàng mua trả lại",
      "document_number": "RET-001",
      "document_id": "824b6f12-0761-46be-91c6-30248a803f29",
      "description": "Defective goods",
      "pre_tax_amount": "-300.0000",
      "amount": "-300.0000"
    }
  ]
}
```

---

### 4.3. Xuất dữ liệu theo dõi (`AF-12`, `BR-PUR-TRK-36`)
- **URL**: `GET /api/v1/purchases/tracking/export/`
- **Quyền**: `PUR.TRACKING.EXPORT` (hoặc `PUR.ORDER.EXPORT`, `PUR.ORDER.VIEW`)
- **Định dạng trả về**: CSV UTF-8 with BOM (`text/csv; charset=utf-8-sig`), tải xuống với tên file `theo_doi_thuc_hien_don_mua.csv`.
- **Nội dung các cột**:
  1. Mã đơn mua
  2. Ngày đặt hàng
  3. Nhà cung cấp
  4. Người phụ trách
  5. Tổng giá trị đơn
  6. Ngày dự kiến nhận
  7. Tiến độ thực hiện (%)
  8. Trạng thái nhận hàng
  9. Trạng thái hóa đơn
  10. Quá hạn
  11. Số ngày quá hạn
  12. Trạng thái đơn

---

### 4.4. Xem trước chứng từ liên quan ở chế độ chỉ đọc (`Steps 32-34`)
- **URL**: `GET /api/v1/purchases/tracking/{id}/document-preview/`
- **Query Parameters**:
  - `company_id` (*bắt buộc*, UUID)
  - `document_type` (*bắt buộc*): `GOODS_PURCHASE`, `SERVICE_PURCHASE`, `PURCHASE_RETURN`, `PURCHASE_DISCOUNT`, `SUPPLIER_INVOICE`.
  - `document_id` (*bắt buộc*, UUID): Mã ID chứng từ cần xem.
- **Xử lý ngoại lệ**:
  - `EF-11`: Nếu User không có quyền xem loại chứng từ tương ứng -> HTTP 403: `{"detail": "Bạn không có quyền xem chứng từ này."}`.
  - `EF-07`: Nếu chứng từ không tồn tại hoặc đã bị xóa -> HTTP 404: `{"detail": "Chứng từ không còn tồn tại hoặc đã được cập nhật."}`.

---

## 5. Bảng đối chiếu mã ngoại lệ (Exception Flows)

| Mã ngoại lệ | Trường hợp phát sinh | Mã HTTP | Thông báo phản hồi chính xác |
| :--- | :--- | :--- | :--- |
| `EF-01` | User không có quyền sử dụng chức năng | 403 Forbidden | `"Bạn không có quyền theo dõi thực hiện đơn mua."` |
| `EF-02` | Không truyền hoặc không xác định được `company_id` | 400 Bad Request | `"Không xác định được phạm vi dữ liệu của tài khoản. Vui lòng liên hệ quản trị viên."` |
| `EF-03` | Ngày bắt đầu lớn hơn ngày kết thúc (`order_date` hoặc `delivery_date`) | 400 Bad Request | `"Ngày bắt đầu không được lớn hơn ngày kết thúc."` |
| `EF-04` | Lỗi truy vấn danh sách đơn mua | 500 Internal Error | `"Không thể tải danh sách đơn mua. Vui lòng thử lại."` |
| `EF-05` | Lỗi tổng hợp tiến độ chi tiết | 500 Internal Error | `"Không thể tổng hợp tiến độ thực hiện đơn mua. Vui lòng thử lại."` |
| `EF-06` | Đơn mua không tồn tại, ở trạng thái Nháp hoặc bị xóa | 404 Not Found | `"Đơn mua không tồn tại hoặc bạn không còn quyền truy cập."` |
| `EF-07` | Chứng từ liên quan không còn tồn tại | 404 Not Found | `"Chứng từ không còn tồn tại hoặc đã được cập nhật."` |
| `EF-08` | Không thể tạo tệp xuất dữ liệu CSV | 500 Internal Error | `"Không thể xuất dữ liệu theo dõi đơn mua. Vui lòng thử lại."` |
| `EF-09` | Phiên đăng nhập hết hạn hoặc chưa đăng nhập | 401 Unauthorized | `"Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."` |
| `EF-11` | User không có quyền xem chi tiết chứng từ liên quan | 403 Forbidden | `"Bạn không có quyền xem chứng từ này."` |
