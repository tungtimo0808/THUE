# UC-AP-10: Xem báo cáo công nợ phải trả (Accounts Payable Reports) - Backend Architecture & Technical Specification

Tài liệu thiết kế kiến trúc kỹ thuật và đặc tả API Backend cho nghiệp vụ **UC-AP-10: Xem báo cáo công nợ phải trả**.  
Chuẩn hóa theo Activity Flow (bước 1–29), 6 luồng thay thế (**AF-AP-RPT-01** đến **AF-AP-RPT-06**), 11 chốt chặn ngoại lệ (**EX-AP-RPT-01** đến **EX-AP-RPT-11**) và toàn diện 12 quy tắc nghiệp vụ (**BR-AP-RPT-01** đến **BR-AP-RPT-12**).

---

## 1. Tổng quan Nghiệp vụ & Kiến trúc Backend

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CHỨNG TỪ CÔNG NỢ & THANH TOÁN (AP LEDGER)       │
│  - Hóa đơn / Chứng từ mua hàng / Chi phí mua hàng (Payable)            │
│  - Thanh toán NCC / Chi tiền tạm ứng (Payment)                         │
│  - Bù trừ công nợ phải trả / Bù trừ AR-AP (Netting, DebtOffset)        │
│  - Hàng mua trả lại, Giảm giá hàng mua, Điều chỉnh nợ (Adjustment)     │
│  - Trạng thái ĐÃ GHI SỔ (Status == POSTED / CONFIRMED), Chưa bị hủy    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │             UC-AP-10 Payable Report Engine              │
       │  - Phân quyền IAM (AP.REPORT.VIEW)                      │
       │  - Tái tạo dòng tiền & phát sinh theo thời gian thực    │
       │    + Số dư đầu kỳ (trước start_date - BR-01)            │
       │    + Phát sinh tăng trong kỳ (start_date..end_date)     │
       │    + Phát sinh giảm trong kỳ (start_date..end_date)     │
       │    + Số dư cuối kỳ = Đầu kỳ + Tăng - Giảm (BR-04)       │
       │  - 2 Mẫu báo cáo (Report Types):                        │
       │    + SUMMARY: Tổng hợp theo từng nhà cung cấp           │
       │    + DETAIL: Chi tiết từng giao dịch & Số dư chạy       │
       │  - Sắp xếp giao dịch chi tiết chuẩn:                    │
       │    Ngày hạch toán -> Thời điểm ghi sổ -> Số chứng từ    │
       │  - Hỗ trợ Drill-down xem chứng từ gốc & kiểm tra quyền  │
       │  - Xuất báo cáo bảng tính Excel & in ấn PDF (A4 ngang)  │
       │  - PHI TIỀN TỆ: Không tạo bút toán GL, không sửa nợ     │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │                REST API & Output Data Model             │
       │  - GET  /api/v1/accounts-payable/reports/               │
       │  - GET  /api/v1/accounts-payable/reports/               │
       │         supplier-detail/                                │
       │  - GET  /api/v1/accounts-payable/reports/source/        │
       │  - GET  /api/v1/accounts-payable/reports/               │
       │         export-excel/                                   │
       │  - GET  /api/v1/accounts-payable/reports/               │
       │         export-pdf/                                     │
       └─────────────────────────────────────────────────────────┘
```

### Nguyên tắc tài chính & kế toán cốt lõi:
1. **Nghiệp vụ Phi tiền tệ & Tính toán tức thời (Non-monetary Invariant - BR-AP-RPT-11..12)**:
   - Nghiệp vụ xem hoặc xuất báo cáo hoàn toàn **không tạo bất kỳ bút toán Sổ cái (GL) nào**, không làm thay đổi số dư công nợ.
   - Báo cáo được tính toán động (runtime) tại thời điểm User tra cứu; hệ thống không lưu thành chứng từ tĩnh và không sinh số báo cáo.
2. **Nguyên tắc không nhân đôi khoản chi (Non-duplication - BR-AP-RPT-08)**:
   - Chứng từ phân bổ thanh toán (`PaymentAllocationVoucher`) không được tính thêm vào Phát sinh giảm vì khoản tiền thanh toán/tạm ứng đã được ghi nhận khi chi tiền (`Payment`).
3. **Quy ước số dư công nợ**:
   - $\text{Số dư} > 0$: Doanh nghiệp còn phải trả nhà cung cấp.
   - $\text{Số dư} = 0$: Doanh nghiệp không còn công nợ với nhà cung cấp.
   - $\text{Số dư} < 0$: Doanh nghiệp đã trả trước/ứng trước cho nhà cung cấp (Thanh toán lớn hơn công nợ).
4. **Đơn tệ duy nhất (Single-currency Consistency - BR-AP-RPT-06)**:
   - Mỗi lần tra cứu và kết xuất báo cáo chỉ áp dụng cho một loại tiền tệ duy nhất (mặc định VND), không cộng gộp giữa các loại tiền khác nhau.

---

## 2. Quy tắc Nghiệp vụ (Business Rules)

### 2.1. Bộ lọc tìm kiếm (Section 3.1)
| Trường | Bắt buộc | Mặc định | Quy định chi tiết |
| :--- | :--- | :--- | :--- |
| `Mẫu báo cáo` (`report_type`) | Có | `Tổng hợp theo nhà cung cấp` (`SUMMARY`) | Cho phép chọn `SUMMARY` (`Tổng hợp theo nhà cung cấp`) hoặc `DETAIL` (`Chi tiết phát sinh`). Hỗ trợ alias tiếng Việt (EX-02). |
| `Ngày bắt đầu kỳ` (`start_date` / `from_date`) | Có | Ngày đầu tháng hiện tại | Không lớn hơn Ngày kết thúc kỳ (EX-03, EX-06). |
| `Ngày kết thúc kỳ` (`end_date` / `to_date`) | Có | Ngày hiện tại (`today`) | Không lớn hơn ngày hiện tại (EX-04, EX-07). |
| `Nhà cung cấp` (`supplier_ids`) | Không | Để trống | Cho phép chọn 1 hoặc nhiều ID; để trống là tất cả nhà cung cấp. |
| `Loại tiền` (`currency_id` / `currency`) | Có | `VND` | Chỉ được chọn 1 loại tiền đang hoạt động (EX-05). |
| `Chỉ hiển thị NCC còn số dư cuối kỳ` (`has_balance_only` / `only_nonzero_closing`) | Không | Được chọn (`True`) | Checkbox boolean. Nếu bỏ chọn (`False`), hiển thị nhà cung cấp có số dư đầu kỳ $\ne 0$ hoặc có phát sinh trong kỳ (BR-09). |
| `Phân trang` (`page`, `page_size`) | Không | `page=1`, `page_size=20` | `page_size` chỉ nhận các giá trị: `20`, `50`, `100` (Bước 27). |

### 2.2. Công thức tính toán báo cáo (Section 3.2)
- **BR-AP-RPT-01**:
  $$\text{Số dư đầu kỳ} = \sum \text{Phát sinh tăng trước start\_date} - \sum \text{Phát sinh giảm trước start\_date}$$
- **BR-AP-RPT-02**:
  $$\text{Phát sinh tăng trong kỳ} = \text{Công nợ mua hàng} + \text{Chi phí mua hàng} + \text{Điều chỉnh tăng}$$
- **BR-AP-RPT-03**:
  $$\text{Phát sinh giảm trong kỳ} = \text{Thanh toán} + \text{Trả lại hàng mua} + \text{Giảm giá hàng mua} + \text{Bù trừ công nợ} + \text{Điều chỉnh giảm}$$
- **BR-AP-RPT-04**:
  $$\text{Số dư cuối kỳ} = \text{Số dư đầu kỳ} + \text{Phát sinh tăng trong kỳ} - \text{Phát sinh giảm trong kỳ}$$
- **BR-AP-RPT-05**:
  $$\text{Tổng cộng từng cột} = \sum \text{Giá trị tương ứng của tất cả nhà cung cấp thuộc kết quả báo cáo}$$

### 2.3. Báo cáo Chi tiết phát sinh & Số dư sau giao dịch (Section 3.4)
Mỗi dòng giao dịch hiển thị:
- `Ngày hạch toán` (`posting_date`)
- `Số chứng từ` (`document_number`)
- `Loại nghiệp vụ` (`transaction_type_display`): `Mua hàng`, `Chi phí mua hàng`, `Thanh toán`, `Trả lại hàng`, `Giảm giá`, `Bù trừ`, `Điều chỉnh`.
- `Diễn giải` (`description`)
- `Phát sinh tăng` (`increase`)
- `Phát sinh giảm` (`decrease`)
- `Số dư sau giao dịch` (`balance_after`)

**Thứ tự tính số dư sau giao dịch**:
1. Ngày hạch toán tăng dần (`posting_date ASC`).
2. Thời điểm ghi sổ tăng dần (`posted_at ASC`).
3. Mã chứng từ tăng dần (`document_number ASC`).

---

## 3. Luồng xử lý chi tiết (Activity & Alternative Flows)

### 3.1. Luồng chính (Steps 1–29)
1. **Bước 1–7**: User truy cập chức năng. Hệ thống xác thực quyền `AP.REPORT.VIEW`. Mặc định bộ lọc: Mẫu báo cáo `Tổng hợp theo nhà cung cấp`, Ngày bắt đầu là ngày đầu tháng hiện tại, Ngày kết thúc là ngày hiện tại, Loại tiền là `VND`, không lọc NCC, chọn `Chỉ hiển thị nhà cung cấp còn số dư cuối kỳ`.
2. **Bước 8–13**: User tùy chỉnh điều kiện lọc (chọn mẫu báo cáo, điều chỉnh ngày, chọn NCC, loại tiền, checkbox số dư).
3. **Bước 14–16**: User chọn `Xem báo cáo`. Hệ thống kiểm tra hợp lệ: bắt buộc đủ trường, Ngày bắt đầu $\le$ Ngày kết thúc, Ngày kết thúc $\le$ Ngày hiện tại.
4. **Bước 17–23**: Hệ thống truy vấn các chứng từ nợ và thanh toán thỏa mãn, tính số dư đầu kỳ, phát sinh tăng/giảm trong kỳ, số dư cuối kỳ theo từng nhà cung cấp. Nếu `Chỉ hiển thị NCC còn số dư cuối kỳ` được chọn, loại các NCC có số dư cuối kỳ $= 0$.
5. **Bước 24–27**:
   - Nếu Mẫu `Tổng hợp`: hiển thị Mã NCC, Tên NCC, Số dư đầu kỳ, Phát sinh tăng, Phát sinh giảm, Số dư cuối kỳ.
   - Nếu Mẫu `Chi tiết`: hiển thị từng giao dịch theo thứ tự và số dư sau giao dịch.
   - Hiển thị dòng Tổng cộng toàn bộ các cột. Phân trang 20, 50 hoặc 100 dòng.
6. **Bước 28**: Chọn 1 nhà cung cấp trong bảng tổng hợp $\rightarrow$ Mở báo cáo chi tiết phát sinh của riêng nhà cung cấp đó trong cùng kỳ (`supplier-detail`).
7. **Bước 29**: Chọn 1 giao dịch $\rightarrow$ Gọi API `source` để kiểm tra quyền và mở chi tiết chứng từ nguồn tương ứng.

### 3.2. Luồng thay thế (Alternative Flows)
- **AF-AP-RPT-01 (Xem tổng hợp theo nhà cung cấp)**: Hiển thị 1 dòng cho mỗi NCC kèm 4 cột số dư và phát sinh.
- **AF-AP-RPT-02 (Xem chi tiết phát sinh)**: Hiển thị từng giao dịch kèm loại nghiệp vụ tiếng Việt và số dư sau giao dịch.
- **AF-AP-RPT-03 (Hiển thị cả NCC hết công nợ)**: Bỏ chọn `Chỉ hiển thị NCC còn số dư cuối kỳ` $\rightarrow$ hiển thị các NCC có số dư cuối kỳ $= 0$ nhưng có số dư đầu kỳ $\ne 0$ hoặc có phát sinh trong kỳ.
- **AF-AP-RPT-04 (Xuất Excel)**: Xuất toàn bộ dữ liệu báo cáo (không bị giới hạn phân trang) ra file `.xlsx`.
- **AF-AP-RPT-05 (Xuất PDF)**: Xuất toàn bộ dữ liệu ra tệp PDF khổ A4 ngang (Landscape) chuẩn in ấn với tiêu đề, kỳ báo cáo, loại tiền, danh sách nhà cung cấp, bảng dữ liệu và tổng cộng.
- **AF-AP-RPT-06 (Không có dữ liệu)**: Khi kết quả rỗng, trả về mảng `rows = []` kèm thông điệp: `"Không có dữ liệu công nợ phù hợp với điều kiện báo cáo."`.

---

## 4. Chốt chặn ngoại lệ (Exception Flows Matrix)

| Mã ngoại lệ | Vị trí kiểm tra | Điều kiện kích hoạt | HTTP Code | Thông báo chuẩn hệ thống |
| :--- | :--- | :--- | :--- | :--- |
| **EX-AP-RPT-01** | Bước 1 | User không có quyền `AP.REPORT.VIEW` | `403` | `Bạn không có quyền xem báo cáo công nợ phải trả.` |
| **EX-AP-RPT-02** | Bước 14 | Chưa chọn hoặc để trống `report_type` | `400` | `Vui lòng chọn Mẫu báo cáo.` |
| **EX-AP-RPT-03** | Bước 14 | Chưa nhập hoặc để trống `start_date` | `400` | `Vui lòng nhập Ngày bắt đầu kỳ báo cáo.` |
| **EX-AP-RPT-04** | Bước 14 | Chưa nhập hoặc để trống `end_date` | `400` | `Vui lòng nhập Ngày kết thúc kỳ báo cáo.` |
| **EX-AP-RPT-05** | Bước 14 | Chưa chọn hoặc để trống `currency_id` | `400` | `Vui lòng chọn Loại tiền.` |
| **EX-AP-RPT-06** | Bước 15 | `start_date` lớn hơn `end_date` | `400` | `Ngày bắt đầu kỳ báo cáo không được lớn hơn Ngày kết thúc kỳ báo cáo.` |
| **EX-AP-RPT-07** | Bước 16 | `end_date` lớn hơn ngày hiện tại | `400` | `Ngày kết thúc kỳ báo cáo không được lớn hơn ngày hiện tại.` |
| **EX-AP-RPT-08** | Bước 17–26 | Lỗi trong quá trình tính toán hoặc tải dữ liệu | `500` | `Không thể tải báo cáo công nợ phải trả. Vui lòng thử lại.` |
| **EX-AP-RPT-09** | AF-04 | Lỗi trong quá trình kết xuất file Excel | `500` | `Không thể xuất báo cáo Excel. Vui lòng thử lại.` |
| **EX-AP-RPT-10** | AF-05 | Lỗi trong quá trình kết xuất file PDF | `500` | `Không thể xuất báo cáo PDF. Vui lòng thử lại.` |
| **EX-AP-RPT-11** | Bước 29 | Giao dịch không tồn tại hoặc không tìm thấy chứng từ nguồn | `400` | `Không tìm thấy chứng từ nguồn của giao dịch đã chọn.` |

---

## 5. Đặc tả API Endpoints

### 5.1. Xem Báo cáo Công nợ (List Report)
- **Method / Path**: `GET /api/v1/accounts-payable/reports/`
- **Query Parameters**:
  - `company_id` (UUID, bắt buộc)
  - `report_type` (String, mặc định `SUMMARY`): `SUMMARY` hoặc `DETAIL` (chấp nhận alias tiếng Việt).
  - `start_date` / `from_date` (Date, mặc định đầu tháng): YYYY-MM-DD.
  - `end_date` / `to_date` (Date, mặc định hôm nay): YYYY-MM-DD.
  - `currency_id` / `currency` (String/UUID, mặc định `VND`)
  - `supplier_ids` (UUID list / comma-separated): Danh sách NCC cần lọc.
  - `has_balance_only` / `only_nonzero_closing` (Boolean, mặc định `true`)
  - `page` (Integer, mặc định `1`)
  - `page_size` (Integer, mặc định `20`): `20`, `50` hoặc `100`.
- **Response Format (200 OK - SUMMARY)**:
```json
{
  "company_name": "Công ty Cổ phần ABC",
  "filters": {
    "report_type": "SUMMARY",
    "start_date": "2026-10-01",
    "end_date": "2026-10-12",
    "currency_id": "c1f7...",
    "currency_code": "VND",
    "supplier_ids": [],
    "only_nonzero_closing": true
  },
  "supplier_filter": "Tất cả nhà cung cấp",
  "suppliers": null,
  "rows": [
    {
      "supplier_id": "s01...",
      "supplier_code": "NCC-01",
      "supplier_name": "Công ty TNHH Cung Cấp X",
      "opening_balance": 10000000.0,
      "period_increase": 50000000.0,
      "period_decrease": 20000000.0,
      "closing_balance": 40000000.0
    }
  ],
  "totals": {
    "opening_balance": 10000000.0,
    "period_increase": 50000000.0,
    "period_decrease": 20000000.0,
    "closing_balance": 40000000.0,
    "total_opening": 10000000.0,
    "total_increase": 50000000.0,
    "total_decrease": 20000000.0,
    "total_closing": 40000000.0
  },
  "count": 1,
  "page": 1,
  "page_size": 20,
  "total_pages": 1,
  "message": ""
}
```

### 5.2. Chi tiết phát sinh của 1 Nhà cung cấp (Drill-down)
- **Method / Path**: `GET /api/v1/accounts-payable/reports/supplier-detail/?company_id=...&supplier_id=...`
- Tự động áp dụng `report_type=DETAIL` cho riêng nhà cung cấp được chọn.

### 5.3. Xem Chứng từ nguồn (Source Document Navigation - Bước 29)
- **Method / Path**: `GET /api/v1/accounts-payable/reports/source/?company_id=...&transaction_id=...`
- **Quy tắc phân quyền (BR-10)**: Kiểm tra quyền xem chi tiết tương ứng với loại chứng từ nguồn:
  - Hóa đơn mua hàng: `AP.INVOICE.VIEW`
  - Chứng từ thanh toán: `AP.PAYMENT.VIEW`
  - Đơn mua hàng hóa: `PURCHASE.GOODS.VIEW`
  - Chi phí mua hàng: `PURCHASE.COST.VIEW`
  - Bù trừ công nợ: `AP.NETTING.VIEW` hoặc `AP.OFFSET.VIEW`
- **Response Format (200 OK)**:
```json
{
  "source_type": "AP.INVOICE",
  "source_id": "inv01...",
  "document_number": "HD-2026-001",
  "mode": "READ_ONLY"
}
```

### 5.4. Xuất Báo cáo Excel & PDF (AF-04 & AF-05)
- **GET** `/api/v1/accounts-payable/reports/export-excel/?company_id=...`
  - MIME: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - Filename: `payable_report.xlsx`
  - Xuất toàn bộ dữ liệu báo cáo không giới hạn phân trang.
- **GET** `/api/v1/accounts-payable/reports/export-pdf/?company_id=...`
  - MIME: `application/pdf`
  - Filename: `payable_report.pdf`
  - Định dạng A4 ngang (Landscape) hiển thị thông tin doanh nghiệp, tiêu đề, kỳ báo cáo, loại tiền và bảng dữ liệu.

---

## 6. Kế hoạch Kiểm thử & Kết quả Xác minh

Bộ kiểm thử tự động tại [accounts_payable/test_report_uc_ap_10.py](file:///c:/Users/Admin/LapTrinh/Thue/accounts_payable/test_report_uc_ap_10.py) bao gồm 10 test case toàn diện:
1. `test_opening_movements_negative_advance_and_zero_supplier_filter`: Xác minh tính số dư đầu kỳ, phát sinh tăng/giảm, số dư âm (tạm ứng vượt nợ) và loại trừ NCC hết số dư.
2. `test_detail_source_and_validation`: Xác minh báo cáo chi tiết phát sinh, số dư sau giao dịch (`balance_after`), và API mở chứng từ nguồn.
3. `test_exports_contain_all_rows_despite_pagination`: Xác minh AF-04 và AF-05 xuất toàn bộ dữ liệu không bị giới hạn bởi phân trang.
4. `test_report_does_not_include_unposted_or_cancelled_source`: Xác minh loại bỏ chứng từ nháp (`DRAFT`) và thông điệp AF-06 khi kết quả rỗng.
5. `test_allocation_does_not_double_count_disbursed_payment`: Xác minh nguyên tắc BR-08 không nhân đôi phát sinh giảm khi phân bổ tạm ứng.
6. `test_rbac_permissions_ex_ap_rpt_01`: Xác minh phân quyền RBAC `AP.REPORT.VIEW` và trả về mã lỗi 403 `EX-AP-RPT-01`.
7. `test_exception_flows_validation_messages`: Xác minh toàn bộ các thông báo lỗi chuẩn xác từ `EX-02` đến `EX-07` và `EX-11`.
8. `test_vietnamese_labels_and_alternative_flows`: Xác minh xử lý nhãn tiếng Việt cho mẫu báo cáo, loại nghiệp vụ, bộ lọc số dư và alias tổng cộng.
9. `test_source_document_permission_check_br_ap_rpt_10`: Xác minh kiểm tra quyền xem chứng từ nguồn tương ứng theo BR-10.
10. `test_pagination_options_step_27`: Xác minh hỗ trợ các tùy chọn kích thước trang `20`, `50`, `100` và từ chối các giá trị không hợp lệ.

Tất cả các kiểm thử đều vượt qua 100% không có lỗi hồi quy.
