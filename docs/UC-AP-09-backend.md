# UC-AP-09: Theo dõi công nợ đến hạn (Track Due and Overdue Payables) - Backend Architecture & Technical Specification

Tài liệu thiết kế kiến trúc kỹ thuật và đặc tả API Backend cho nghiệp vụ **UC-AP-09: Theo dõi công nợ đến hạn**.  
Chuẩn hóa theo Activity Flow (bước 1–27), 7 luồng thay thế (**AF-AP-DUE-01** đến **AF-AP-DUE-07**), 13 chốt chặn ngoại lệ (**EX-AP-DUE-01** đến **EX-AP-DUE-13**) và toàn diện 18 quy tắc nghiệp vụ (**BR-AP-DUE-01** đến **BR-AP-DUE-18**).

---

## 1. Tổng quan Nghiệp vụ & Kiến trúc Backend

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CHỨNG TỪ CÔNG NỢ & THANH TOÁN (AP LEDGER)       │
│  - Hóa đơn / Chứng từ mua hàng / Khoản phải trả khác (Payable > 0)     │
│  - Thanh toán NCC (Payment), Bù trừ công nợ (DebtOffset), Netting      │
│  - Điều chỉnh tăng/giảm công nợ (PayableAdjustment, Voucher)           │
│  - Phân bổ thanh toán tạm ứng (PaymentAllocationVoucher)               │
│  - Trạng thái ĐÃ GHI SỔ (Status == POSTED / CONFIRMED), Chưa bị hủy    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │             UC-AP-09 Due Payables Engine                │
       │  - Phân quyền IAM (AP.PAYABLE.VIEW)                     │
       │  - Tái hiện số dư lịch sử tại Ngày xác định công nợ     │
       │    (As-of-date balance reconstruction - BR-01..04)      │
       │  - Phân loại 5 nhóm thời hạn thanh toán (BR-05..08):    │
       │    + Quá hạn (OVERDUE)                                  │
       │    + Đến hạn hôm nay (DUE_TODAY)                        │
       │    + Sắp đến hạn (DUE_SOON, trong cảnh báo 1..365 ngày) │
       │    + Chưa đến hạn (NOT_DUE)                             │
       │    + Chưa xác định hạn (NO_DUE_DATE / UNDETERMINED)     │
       │  - Tính Số ngày quá hạn / Số ngày còn lại đến hạn       │
       │  - Sắp xếp chuẩn: Nhóm -> Hạn tăng dần -> Ngày CT tăng  │
       │  - Tính Tổng hợp số liệu theo đơn vị tiền tệ duy nhất   │
       │  - Tích hợp UC-AP-03 (Lập đề nghị thanh toán từ khoản nợ│
       │  - Xuất báo cáo bảng tính Excel & in ấn PDF (A4 ngang)  │
       │  - PHI TIỀN TỆ: Không tạo bút toán GL, không sửa nợ     │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │                REST API & Output Data Model             │
       │  - GET  /api/v1/accounts-payable/due-payables/          │
       │  - GET  /api/v1/accounts-payable/due-payables/{id}/     │
       │  - POST /api/v1/accounts-payable/due-payables/          │
       │         prepare-payment-request/                        │
       │  - GET  /api/v1/accounts-payable/due-payables/          │
       │         export-excel/                                   │
       │  - GET  /api/v1/accounts-payable/due-payables/          │
       │         export-pdf/                                     │
       └─────────────────────────────────────────────────────────┘
```

### Nguyên tắc tài chính & kế toán cốt lõi:
1. **Nghiệp vụ Phi tiền tệ (Non-monetary Invariant - BR-AP-DUE-16)**:
   - Việc tra cứu, phân loại nhóm hạn, cảnh báo quá hạn hoàn toàn **không tạo bất kỳ bút toán Sổ cái (GL) nào**.
   - Việc chuyển từ nhóm `Chưa đến hạn` sang `Quá hạn` không làm thay đổi số tiền công nợ.
2. **Tính toán số dư tại thời điểm lịch sử (As-of-date Reconstruction - BR-AP-DUE-01..02)**:
   - Hệ thống chỉ xét các nghiệp vụ phát sinh có ngày ghi sổ/hạch toán $\le \text{Ngày xác định công nợ}$.
   - Tạm ứng của nhà cung cấp chưa phân bổ vào chứng từ công nợ cụ thể không làm giảm công nợ của chứng từ đó.
3. **Phân loại động tại thời điểm tra cứu (Dynamic Aging - BR-AP-DUE-15)**:
   - Nhóm thời hạn được tính toán động (runtime) dựa trên chênh lệch giữa `Hạn thanh toán` (`due_date`) và `Ngày xác định công nợ` (`as_of_date`), không lưu tĩnh vào cơ sở dữ liệu.
4. **Đơn tệ duy nhất (Single-currency Consistency - BR-AP-DUE-14)**:
   - Mỗi lần tra cứu và báo cáo chỉ áp dụng cho một loại tiền duy nhất (mặc định VND), không cộng dồn giữa các loại tiền khác nhau.

---

## 2. Quy tắc Nghiệp vụ (Business Rules)

### 2.1. Bộ lọc tìm kiếm (Section 3.1)
| Trường | Bắt buộc | Mặc định | Quy định chi tiết |
| :--- | :--- | :--- | :--- |
| `Ngày xác định công nợ` (`as_of_date`) | Có | Ngày hiện tại (`today`) | Không lớn hơn ngày hiện tại (EX-07) |
| `Nhà cung cấp` (`supplier_ids`) | Không | Để trống | Cho phép chọn 1 hoặc nhiều ID; để trống là tất cả nhà cung cấp |
| `Loại tiền` (`currency_id` / `currency`) | Có | `VND` | Chỉ được chọn 1 loại tiền đang hoạt động (EX-03) |
| `Nhóm thời hạn` (`due_group`) | Có | `ALL` (`Tất cả`) | Một trong các giá trị: `ALL`, `OVERDUE`, `DUE_TODAY`, `DUE_SOON`, `NOT_DUE`, `NO_DUE_DATE` (hỗ trợ alias `UNDETERMINED` và nhãn tiếng Việt) |
| `Số ngày cảnh báo trước hạn` (`warning_days`) | Có | `7` | Số nguyên dương trong khoảng từ 1 đến 365 (EX-05, EX-08) |
| `Trạng thái thanh toán` (`payment_status`) | Có | `ALL` (`Tất cả`) | Một trong các giá trị: `ALL`, `OPEN` (`UNPAID`), `PARTIALLY_PAID` (hỗ trợ nhãn tiếng Việt) |

### 2.2. Công thức tính công nợ (Section 3.2)
- **BR-AP-DUE-01**:
  $$\text{Còn phải trả} = \text{Số tiền gốc} + \text{Phát sinh tăng} - \text{Thanh toán} - \text{Trả lại hàng} - \text{Giảm giá hàng} - \text{Bù trừ} - \text{Điều chỉnh giảm}$$
- **BR-AP-DUE-02**: Chỉ tính các nghiệp vụ có $\text{Ngày hạch toán} \le \text{Ngày xác định công nợ}$.
- **BR-AP-DUE-03**: Chỉ hiển thị chứng từ có $\text{Còn phải trả} > 0$.
- **BR-AP-DUE-04**: Chứng từ đã hủy (`CANCELLED`, `REVERSED`) không được đưa vào kết quả.

### 2.3. Xác định nhóm thời hạn & Số ngày (Section 3.3 & 3.4)
| Nhóm thời hạn | Điều kiện xác định | Công thức Số ngày (`days`) |
| :--- | :--- | :--- |
| **Quá hạn** (`OVERDUE`) | `due_date < as_of_date` | `Số ngày quá hạn = as_of_date - due_date` |
| **Đến hạn hôm nay** (`DUE_TODAY`) | `due_date == as_of_date` | `0` ngày |
| **Sắp đến hạn** (`DUE_SOON`) | `as_of_date < due_date <= as_of_date + warning_days` | `Số ngày còn lại = due_date - as_of_date` |
| **Chưa đến hạn** (`NOT_DUE`) | `due_date > as_of_date + warning_days` | `Số ngày còn lại = due_date - as_of_date` |
| **Chưa xác định hạn** (`NO_DUE_DATE`) | `due_date is NULL` | `None` (Không tính số ngày - BR-08) |

### 2.4. Tổng hợp số liệu (Section 3.5)
- **BR-AP-DUE-09**: $\text{Tổng còn phải trả} = \sum \text{Còn phải trả các dòng kết quả}$.
- **BR-AP-DUE-10**: $\text{Tổng quá hạn} = \sum \text{Còn phải trả nhóm Quá hạn}$.
- **BR-AP-DUE-11**: $\text{Tổng đến hạn hôm nay} = \sum \text{Còn phải trả nhóm Đến hạn hôm nay}$.
- **BR-AP-DUE-12**: $\text{Tổng sắp đến hạn} = \sum \text{Còn phải trả nhóm Sắp đến hạn}$.
- **BR-AP-DUE-13**: $\text{Tổng chưa đến hạn} = \sum \text{Còn phải trả nhóm Chưa đến hạn}$.
- **BR-AP-DUE-14**: Tất cả tổng số tiền chỉ tính trong loại tiền đã chọn, không quy đổi gộp nhiều loại tiền.

### 2.5. Thứ tự sắp xếp (Steps 23 & 24)
- **Cấp 1**: Thứ tự nhóm cố định: `Quá hạn` $\rightarrow$ `Đến hạn hôm nay` $\rightarrow$ `Sắp đến hạn` $\rightarrow$ `Chưa đến hạn` $\rightarrow$ `Chưa xác định hạn`.
- **Cấp 2**: Trong cùng một nhóm, sắp xếp `Hạn thanh toán` tăng dần (`due_date ASC`).
- **Cấp 3**: Nếu cùng hạn thanh toán, sắp xếp `Ngày chứng từ` tăng dần (`document_date ASC`).

---

## 3. Luồng xử lý chi tiết (Activity & Alternative Flows)

### 3.1. Luồng chính (Steps 1–27)
1. **Bước 1–2**: User truy cập chức năng. Hệ thống xác thực quyền `AP.PAYABLE.VIEW`.
2. **Bước 3–7**: Hệ thống nạp giá trị mặc định cho bộ lọc (`as_of_date = today`, `currency = VND`, `due_group = ALL`, `warning_days = 7`, `payment_status = ALL`).
3. **Bước 8–12**: User tùy chỉnh điều kiện lọc (chọn NCC, đổi loại tiền, đổi nhóm hạn, đổi số ngày cảnh báo, đổi trạng thái thanh toán).
4. **Bước 13–15**: User bấm `Tìm kiếm`. Hệ thống kiểm tra hợp lệ toàn bộ trường dữ liệu.
5. **Bước 16–18**: Hệ thống truy vấn các chứng từ `Payable` thỏa mãn, nạp toàn bộ lịch sử thanh toán, bù trừ, điều chỉnh trước/trong `as_of_date` và tính số tiền còn phải trả.
6. **Bước 19–21**: So sánh `due_date` với `as_of_date`, phân nhóm và tính số ngày quá hạn/còn lại.
7. **Bước 22–24**: Lọc và sắp xếp danh sách kết quả theo đúng quy định.
8. **Bước 25–26**: Trả về danh sách chứng từ, dòng chi tiết và khối tổng hợp công nợ.
9. **Bước 27**: User chọn 1 dòng công nợ để xem chi tiết lịch sử chứng từ.

### 3.2. Luồng thay thế (Alternative Flows)
- **AF-AP-DUE-01 (Xem tất cả)**: Chọn `Tất cả` $\rightarrow$ hiển thị cả 5 nhóm thời hạn.
- **AF-AP-DUE-02 (Xem quá hạn)**: Chọn `Quá hạn` $\rightarrow$ chỉ hiển thị các khoản có `due_date < as_of_date`.
- **AF-AP-DUE-03 (Xem sắp đến hạn)**: Chọn `Sắp đến hạn` $\rightarrow$ chỉ hiển thị các khoản có `as_of_date < due_date <= as_of_date + warning_days`.
- **AF-AP-DUE-04 (Xem chưa xác định hạn)**: Chọn `Chưa xác định hạn` $\rightarrow$ chỉ hiển thị các khoản không có `due_date`.
- **AF-AP-DUE-05 (Lập đề nghị thanh toán)**: Chọn 1 hoặc nhiều khoản cùng nhà cung cấp $\rightarrow$ gọi endpoint `prepare-payment-request` để chuẩn bị dữ liệu prefill cho UC-AP-03.
- **AF-AP-DUE-06 (Xuất danh sách)**: Xuất file bảng tính Excel (`export-excel`) hoặc tài liệu PDF (`export-pdf`) định dạng A4 ngang.
- **AF-AP-DUE-07 (Không có dữ liệu)**: Khi kết quả rỗng, trả về mảng `rows = []` kèm thông điệp: `"Không có khoản công nợ phù hợp với điều kiện tìm kiếm."`.

---

## 4. Chốt chặn ngoại lệ (Exception Flows Matrix)

| Mã ngoại lệ | Vị trí kiểm tra | Điều kiện kích hoạt | HTTP Code | Thông báo chuẩn hệ thống |
| :--- | :--- | :--- | :--- | :--- |
| **EX-AP-DUE-01** | Bước 1 | User không có quyền `AP.PAYABLE.VIEW` | `403` | `Bạn không có quyền xem công nợ phải trả.` |
| **EX-AP-DUE-02** | Bước 13 | Chưa nhập hoặc để trống `as_of_date` | `400` | `Vui lòng nhập Ngày xác định công nợ.` |
| **EX-AP-DUE-03** | Bước 13 | Chưa chọn hoặc để trống `currency_id` | `400` | `Vui lòng chọn Loại tiền.` |
| **EX-AP-DUE-04** | Bước 13 | Chưa chọn hoặc để trống `due_group` | `400` | `Vui lòng chọn Nhóm thời hạn.` |
| **EX-AP-DUE-05** | Bước 13 | Chưa nhập hoặc để trống `warning_days` | `400` | `Vui lòng nhập Số ngày cảnh báo trước hạn.` |
| **EX-AP-DUE-06** | Bước 13 | Chưa chọn hoặc để trống `payment_status` | `400` | `Vui lòng chọn Trạng thái thanh toán.` |
| **EX-AP-DUE-07** | Bước 14 | `as_of_date` lớn hơn ngày hiện tại | `400` | `Ngày xác định công nợ không được lớn hơn ngày hiện tại.` |
| **EX-AP-DUE-08** | Bước 15 | `warning_days` không phải số nguyên từ 1 đến 365 | `400` | `Số ngày cảnh báo trước hạn phải là số nguyên từ 1 đến 365.` |
| **EX-AP-DUE-09** | AF-05 | `payable_ids` rỗng | `400` | `Vui lòng chọn ít nhất một khoản công nợ.` |
| **EX-AP-DUE-10** | AF-05 | Các khoản công nợ thuộc nhiều nhà cung cấp khác nhau | `400` | `Các khoản công nợ được chọn phải thuộc cùng một nhà cung cấp.` |
| **EX-AP-DUE-11** | AF-05 | Khoản công nợ không còn số tiền khả dụng (đã đề nghị hết) | `400` | `Chứng từ {Số chứng từ} không còn số tiền có thể lập đề nghị thanh toán.` |
| **EX-AP-DUE-12** | AF-06 | Lỗi trong quá trình render/xuất tệp Excel hoặc PDF | `500` | `Không thể xuất danh sách công nợ. Vui lòng thử lại.` |
| **EX-AP-DUE-13** | Bước 16–26 | Lỗi truy vấn hoặc lỗi hệ thống không lường trước | `500` | `Không thể tải dữ liệu công nợ. Vui lòng thử lại.` |

---

## 5. Đặc tả API Endpoints

### 5.1. Danh sách công nợ đến hạn (List)
- **Method / Path**: `GET /api/v1/accounts-payable/due-payables/`
- **Query Parameters**:
  - `company_id` (UUID, bắt buộc): ID công ty.
  - `as_of_date` (Date string, YYYY-MM-DD): Mặc định ngày hiện tại.
  - `currency_id` / `currency` (String/UUID): Mã loại tiền hoặc ID. Mặc định `VND`.
  - `due_group` (String): `ALL`, `OVERDUE`, `DUE_TODAY`, `DUE_SOON`, `NOT_DUE`, `NO_DUE_DATE` (hoặc alias tiếng Việt / `UNDETERMINED`). Mặc định `ALL`.
  - `warning_days` (Integer): Số ngày cảnh báo trước hạn. Mặc định `7`.
  - `payment_status` (String): `ALL`, `OPEN`, `PARTIALLY_PAID` (hoặc alias tiếng Việt). Mặc định `ALL`.
  - `supplier_ids` (UUID list / comma-separated): Danh sách ID nhà cung cấp cần lọc.
- **Response Format (200 OK)**:
```json
{
  "filters": {
    "as_of_date": "2026-10-12",
    "currency_id": "c1f7...",
    "currency_code": "VND",
    "due_group": "ALL",
    "warning_days": 7,
    "payment_status": "ALL",
    "supplier_ids": []
  },
  "rows": [
    {
      "payable_id": "p01...",
      "supplier_id": "s01...",
      "supplier_name": "Công ty TNHH Cung Cấp A",
      "supplier_code": "NCC-A",
      "document_number": "HD-2026-001",
      "invoice_number": "0001234",
      "document_date": "2026-09-15",
      "due_date": "2026-10-05",
      "currency_code": "VND",
      "total_debt": 100000000.0,
      "paid_amount": 30000000.0,
      "remaining_amount": 70000000.0,
      "due_group": "OVERDUE",
      "due_group_name": "Quá hạn",
      "days": 7,
      "payment_status": "PARTIALLY_PAID",
      "payment_status_display": "Đã thanh toán một phần",
      "source_type": "INVOICE",
      "source_document_id": "inv01..."
    }
  ],
  "totals": {
    "overdue": 70000000.0,
    "due_today": 0.0,
    "due_soon": 50000000.0,
    "not_due": 120000000.0,
    "no_due_date": 10000000.0,
    "remaining_amount": 250000000.0,
    "total_remaining": 250000000.0,
    "total_overdue": 70000000.0,
    "total_due_today": 0.0,
    "total_due_soon": 50000000.0,
    "total_not_due": 120000000.0,
    "total_undetermined": 10000000.0
  },
  "count": 1,
  "message": ""
}
```

### 5.2. Chi tiết công nợ & Lịch sử chứng từ (Detail)
- **Method / Path**: `GET /api/v1/accounts-payable/due-payables/{payable_id}/`
- **Query Parameters**: Đồng bộ bộ lọc với màn hình tra cứu.
- **Response Format (200 OK)**:
```json
{
  "payable_id": "p01...",
  "supplier_name": "Công ty TNHH Cung Cấp A",
  "total_debt": 100000000.0,
  "paid_amount": 30000000.0,
  "remaining_amount": 70000000.0,
  "history": [
    {
      "type": "ORIGINAL",
      "posting_date": "2026-09-15",
      "amount": 100000000.0,
      "document_number": "HD-2026-001",
      "source_id": "inv01...",
      "note": ""
    },
    {
      "type": "PAYMENT",
      "posting_date": "2026-10-01",
      "amount": 30000000.0,
      "document_number": "UNC-2026-088",
      "source_id": "pay01...",
      "note": "Thanh toán đợt 1"
    }
  ]
}
```

### 5.3. Tiền đề nghị thanh toán (Prepare Payment Request - AF-05)
- **Method / Path**: `POST /api/v1/accounts-payable/due-payables/prepare-payment-request/?company_id=...`
- **Request Body**:
```json
{
  "payable_ids": ["p01...", "p02..."]
}
```
- **Response Format (200 OK)**:
```json
{
  "supplier_id": "s01...",
  "supplier_name": "Công ty TNHH Cung Cấp A",
  "currency_id": "c1f7...",
  "currency_code": "VND",
  "request_type": "DEBT_PAYMENT",
  "lines": [
    {
      "payable": "p01...",
      "document_number": "HD-2026-001",
      "available_amount": 70000000.0,
      "amount": 70000000.0
    }
  ],
  "total_amount": 70000000.0
}
```

### 5.4. Xuất Excel & PDF (AF-06)
- **GET** `/api/v1/accounts-payable/due-payables/export-excel/?company_id=...`
  - MIME: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - Filename: `due_payables.xlsx`
  - Nội dung: Header thông tin tra cứu, bảng 10 cột dữ liệu định dạng tiền tệ và các dòng tổng cộng từng nhóm.
- **GET** `/api/v1/accounts-payable/due-payables/export-pdf/?company_id=...`
  - MIME: `application/pdf`
  - Filename: `due_payables.pdf`
  - Khổ giấy: A4 nằm ngang (Landscape), hiển thị tiêu đề, ngày xác định công nợ, bảng dữ liệu phân trang và khối chữ ký.

---

## 6. Kế hoạch Kiểm thử & Kết quả Xác minh

Bộ kiểm thử tự động tại [accounts_payable/test_due_payables_uc_ap_09.py](file:///c:/Users/Admin/LapTrinh/Thue/accounts_payable/test_due_payables_uc_ap_09.py) bao gồm 10 test case toàn diện:
1. `test_groups_order_totals_and_exports`: Xác minh phân loại cả 5 nhóm, tính số ngày, tính tổng, xem chi tiết lịch sử và xuất Excel/PDF.
2. `test_historical_balance_and_filters`: Xác minh tính số dư tại thời điểm quá khứ (as-of-date) và loại trừ khoản nợ đã thanh toán trước ngày xác định.
3. `test_prepare_request_uses_current_unreserved_balance`: Xác minh AF-05 kiểm tra số dư khả dụng loại trừ các đề nghị thanh toán đang duyệt.
4. `test_reversal_filter_and_supplier_selection`: Xác minh xử lý chứng từ đảo/reversal và kiểm tra ràng buộc cùng một nhà cung cấp.
5. `test_unposted_and_empty_result`: Xác minh loại bỏ chứng từ nháp và trả về thông báo AF-07 khi kết quả tìm kiếm rỗng.
6. `test_allocated_advance_enters_balance_on_allocation_date`: Xác minh tạm ứng chỉ làm giảm số dư tại thời điểm phiếu phân bổ (`PaymentAllocationVoucher`) được ghi sổ.
7. `test_rbac_permissions_ex_ap_due_01`: Xác minh phân quyền RBAC `AP.PAYABLE.VIEW` và thông báo lỗi 403 `EX-AP-DUE-01`.
8. `test_exception_flows_validation_messages`: Xác minh toàn bộ thông báo lỗi chuẩn xác từ `EX-02` đến `EX-11`.
9. `test_vietnamese_labels_and_alternative_flows`: Xác minh tiếp nhận giá trị tiếng Việt cho `due_group` và `payment_status` cũng như các alias tổng cộng.
10. `test_sorting_order_and_business_rules`: Xác minh quy tắc sắp xếp 3 cấp: Thứ tự nhóm cố định $\rightarrow$ Hạn thanh toán tăng dần $\rightarrow$ Ngày chứng từ tăng dần.

Tất cả các kiểm thử đều vượt qua 100% không có lỗi hồi quy.
