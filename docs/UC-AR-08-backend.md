# UC-AR-08: Theo dõi công nợ đến hạn (Due and Overdue Accounts Receivable Tracking) - Backend Architecture & API Specification

Tài liệu thiết kế kỹ thuật và đặc tả API backend cho use case **UC-AR-08: Theo dõi công nợ đến hạn**.
Triển khai tuân thủ toàn diện các quy tắc nghiệp vụ (**BR01** đến **BR14**), luồng hoạt động chính (**Activity Flow Bước 1–5**), luồng thay thế (**AF01** đến **AF08**) và luồng ngoại lệ (**EF01** đến **EF08**).

---

## 1. Sơ đồ Hoạt động (Activity Diagram - Mermaid)

Sơ đồ thể hiện quy trình lọc, theo dõi, phân loại công nợ theo hạn thanh toán, tra cứu chi tiết và chuẩn bị thu tiền khách hàng:

```mermaid
flowchart TD
    subgraph ACTOR ["👤 User (Kế toán Công nợ / Quản lý)"]
        U_START(["Bắt đầu: Vào Công nợ phải thu → Công nợ đến hạn"])
        U_DEFAULT["Bước 1: Xem bộ lọc mặc định & danh sách Quá hạn hôm nay"]
        U_FILTER["Bước 2: Thay đổi bộ lọc (Ngày theo dõi, KH, Nhóm hạn, NV phụ trách, Khoảng ngày) & nhấn 'Áp dụng'"]
        U_VIEW_DETAIL["Bước 3: Chọn một dòng công nợ để xem chi tiết lịch thanh toán, giảm trừ & số dư"]
        U_VIEW_SOURCE["Bước 4: Nhấn số chứng từ phát sinh để xem chứng từ nguồn (nếu có quyền)"]
        U_COLLECT["Bước 5: Chọn các khoản nợ cần thu & nhấn 'Thu tiền'"]
        U_EXPORT["AF05: Nhấn 'Xuất Excel' để tải báo cáo danh sách & tổng hợp"]
    end

    subgraph SYSTEM_FE ["💻 Giao diện Theo dõi Công nợ đến hạn (Frontend)"]
        FE_VIEW["Hiển thị bảng công nợ, tổng hợp theo loại tiền & tổng quy đổi"]
        FE_DETAIL_MODAL["Hiển thị modal chi tiết: Chứng từ, đợt thanh toán, tiền đã giảm"]
        FE_TRANSIT["Chuyển sang UC-AR-03 kèm dữ liệu khách hàng, loại tiền, khoản nợ"]
    end

    subgraph DUE_SVC ["⚙️ Due Tracking Service (Backend: due_tracking.py)"]
        CHK_PERM{"Kiểm tra quyền IAM (AR.DUE_TRACKING.VIEW) & Chi nhánh"}
        VAL_FILTERS{"BR05-06, EF02-03: Kiểm tra Ngày theo dõi <= hôm nay, upcoming_days > 0, overdue_range hợp lệ?"}
        QUERY_REC["BR02, BR04, BR08: Lấy khoản phải thu đã ghi sổ, có hiệu lực <= ngày theo dõi"]
        EVAL_LINES["BR03: Tách từng đợt thanh toán (Installment) hoặc theo dõi khoản đơn"]
        CALC_REDUCED["BR04: Tính tổng giảm trừ (Thu tiền phân bổ, Bù trừ, Điều chỉnh giảm) <= ngày theo dõi"]
        CALC_REMAINING["Tính Số tiền còn phải thu = Gốc - Đã giảm. Bỏ qua khoản còn dư <= 0"]
        CLASSIFY["Mục 3: Phân loại Quá hạn, Đến hạn hôm nay, Sắp đến hạn, Chưa đến hạn, Chưa có hạn"]
        CALC_SUMMARY["Mục 2.3, BR09: Tính tổng hợp theo từng loại tiền & Tổng quy đổi theo tỷ giá ghi sổ"]
        SORT_DATA["BR10: Sắp xếp Quá hạn (ngày quá hạn giảm dần, số tiền giảm dần)"]
        VAL_COLLECT{"EF05, EF06: Cùng KH, cùng tiền tệ, cùng TK 131 & số dư hiện tại > 0?"}
        PREP_COLLECT["BR12: Đóng gói payload nạp sẵn vào chức năng Thu tiền UC-AR-03"]
        GEN_EXCEL["AF05, BR14: Tạo file Excel chuyên nghiệp kèm metadata, tổng hợp & chi tiết"]
    end

    subgraph AR_DB ["🗄️ Database & Sổ chi tiết AR"]
        DB_REC[("Bảng ar_receivable & ar_receivable_schedule")]
        DB_ALLOC[("Bảng ar_receipt_allocation & ar_receipt")]
        DB_NET[("Bảng ar_debt_netting_voucher_line")]
        DB_ADJ[("Bảng ar_debt_adjustment_voucher_line")]
    end

    subgraph EXCEPTIONS ["⚠️ Luồng ngoại lệ & Xử lý chặn"]
        ERR_PERM["EF01/EF07: 403 Forbidden"]
        ERR_DATE["EF02: Chặn ngày theo dõi tương lai"]
        ERR_RANGE["EF03: Chặn số ngày sắp đến hạn <= 0 hoặc khoảng quá hạn min > max"]
        ERR_MISMATCH["EF05: Chặn chọn thu tiền khác KH, loại tiền hoặc TK phải thu"]
        ERR_ZERO_BAL["EF06: Chặn chọn thu tiền cho khoản nợ đã tất toán"]
    end

    %% Connections
    U_START --> CHK_PERM
    CHK_PERM -- Không có quyền --> ERR_PERM
    CHK_PERM -- Hợp lệ --> VAL_FILTERS

    VAL_FILTERS -- Ngày > hôm nay --> ERR_DATE
    VAL_FILTERS -- Khoảng ngày sai --> ERR_RANGE
    VAL_FILTERS -- Hợp lệ --> QUERY_REC

    QUERY_REC --> DB_REC
    QUERY_REC --> EVAL_LINES
    EVAL_LINES --> CALC_REDUCED
    CALC_REDUCED --> DB_ALLOC
    CALC_REDUCED --> DB_NET
    CALC_REDUCED --> DB_ADJ
    CALC_REDUCED --> CALC_REMAINING
    CALC_REMAINING --> CLASSIFY
    CLASSIFY --> CALC_SUMMARY
    CALC_SUMMARY --> SORT_DATA
    SORT_DATA --> FE_VIEW
    FE_VIEW --> U_DEFAULT

    U_FILTER --> VAL_FILTERS
    U_VIEW_DETAIL --> FE_DETAIL_MODAL
    U_COLLECT --> VAL_COLLECT

    VAL_COLLECT -- Khác KH/Tiền/TK --> ERR_MISMATCH
    VAL_COLLECT -- Số dư = 0 --> ERR_ZERO_BAL
    VAL_COLLECT -- Hợp lệ --> PREP_COLLECT
    PREP_COLLECT --> FE_TRANSIT

    U_EXPORT --> GEN_EXCEL
```

---

## 2. Sơ đồ Phân loại Hạn thanh toán (Due Classification Flow)

Mỗi khoản còn phải thu tại ngày theo dõi (`remaining_balance > 0`) được phân loại vào đúng một trong năm nhóm duy nhất (**Mục 3, BR05, BR06, BR07**):

```mermaid
flowchart TD
    START(["Khoản phải thu / Đợt thanh toán có số dư > 0 tại Ngày theo dõi"])
    CHK_HAS_DUE{"Có khai báo Hạn thanh toán (due_date)?"}
    NO_DUE["Nhóm: CHƯA CÓ HẠN THANH TOÁN (NO_DUE_DATE)<br/>• BR07: Không suy đoán từ ngày chứng từ<br/>• days_due = null, days_overdue = null"]

    CHK_DUE_VS_ASOF{"So sánh due_date với Ngày theo dõi (as_of_date)"}
    OVERDUE["Nhóm: QUÁ HẠN (OVERDUE)<br/>• Điều kiện: due_date < as_of_date<br/>• days_overdue = as_of_date - due_date (> 0)<br/>• Mặc định hiển thị ban đầu"]
    DUE_TODAY["Nhóm: ĐẾN HẠN HÔM NAY (DUE_TODAY)<br/>• Điều kiện: due_date == as_of_date<br/>• BR05: Chưa coi là quá hạn<br/>• days_due = 0, days_overdue = 0"]

    CHK_UPCOMING{"due_date <= as_of_date + upcoming_days?"}
    UPCOMING["Nhóm: SẮP ĐẾN HẠN (UPCOMING)<br/>• Điều kiện: as_of_date < due_date <= as_of_date + upcoming_days<br/>• days_due = due_date - as_of_date (1 .. N)"]
    NOT_DUE["Nhóm: CHƯA ĐẾN HẠN (NOT_DUE)<br/>• Điều kiện: due_date > as_of_date + upcoming_days<br/>• days_due = due_date - as_of_date (> N)"]

    START --> CHK_HAS_DUE
    CHK_HAS_DUE -- "Không có hạn" --> NO_DUE
    CHK_HAS_DUE -- "Có hạn" --> CHK_DUE_VS_ASOF

    CHK_DUE_VS_ASOF -- "due_date < as_of_date" --> OVERDUE
    CHK_DUE_VS_ASOF -- "due_date == as_of_date" --> DUE_TODAY
    CHK_DUE_VS_ASOF -- "due_date > as_of_date" --> CHK_UPCOMING

    CHK_UPCOMING -- "Đúng" --> UPCOMING
    CHK_UPCOMING -- "Sai" --> NOT_DUE
```

---

## 3. Kiến trúc Triển khai (Architecture & Components)

### 3.1. Phân quyền IAM & Migration ([`0027_due_tracking_permissions.py`](file:///c:/Users/Admin/LapTrinh/Thue/accounts_receivable/migrations/0027_due_tracking_permissions.py))
- Resource: `AR.DUE_TRACKING` ("Theo dõi công nợ đến hạn").
- Actions:
  - `VIEW`: Xem danh sách, tra cứu chi tiết công nợ đến hạn (`AR.DUE_TRACKING.VIEW`). Fallback tự động: `AR.RECEIVABLE.VIEW`.
  - `EXPORT`: Xuất danh sách Excel (`AR.DUE_TRACKING.EXPORT`). Fallback tự động: `AR.RECEIVABLE.EXPORT`.
- Permission Handler: [`DueTrackingPermission`](file:///c:/Users/Admin/LapTrinh/Thue/accounts_receivable/permissions.py) kế thừa `AccountsReceivablePermission`.

### 3.2. Core Engine ([`accounts_receivable/due_tracking.py`](file:///c:/Users/Admin/LapTrinh/Thue/accounts_receivable/due_tracking.py))
- `validate_due_tracking_filters`: Kiểm tra hợp lệ bộ lọc, giới hạn ngày quá khứ / hiện tại (`EF02`), kiểm tra số ngày nguyên dương và khoảng từ - đến (`EF03`).
- `classify_due_item`: Hàm thuần nhất phân loại theo công thức nghiệp vụ Mục 3.
- `get_due_tracking_report`:
  - Trích xuất toàn bộ công nợ đã ghi sổ `<= as_of_date` (**BR02**).
  - Tách bạch từng đợt thanh toán theo `ReceivableSchedule` (**BR03**).
  - Tính giảm trừ có hiệu lực tại ngày theo dõi từ `ReceiptAllocation`, `DebtNettingVoucherLine`, `DebtAdjustmentVoucherLine` (**BR04**).
  - Tính số dư còn lại và giá trị quy đổi theo tỷ giá ghi sổ ban đầu (**BR09**).
  - Phân loại 5 nhóm và tính tổng hợp đa loại tiền và tổng hợp quy đổi tiền hạch toán (**Mục 2.3**).
  - Lọc theo nhóm hạn, khoảng ngày quá hạn và sắp xếp giảm dần theo ngày quá hạn (**BR10**).
- `get_due_item_detail`: Cung cấp lịch sử phân bổ, bù trừ, điều chỉnh của chứng từ nguồn cho bước tra cứu chi tiết (**Bước 3-4**).
- `prepare_collection_payload`: Kiểm tra điều kiện đồng nhất khách hàng, loại tiền, tài khoản 131 (**EF05**) và số dư hiện tại còn dư (**EF06**), chuẩn bị dữ liệu gọi sang **UC-AR-03** (**Bước 5, AF07, BR12**).
- `export_due_tracking_excel`: Sinh file OpenPyXL chuyên nghiệp có đủ Header, Metadata, Tổng hợp theo loại tiền và Bảng chi tiết từng dòng (**AF05, BR08, BR14**).

### 3.3. RESTful API Endpoints ([`accounts_receivable/views.py`](file:///c:/Users/Admin/LapTrinh/Thue/accounts_receivable/views.py#L870))

| Method | Endpoint | Quyền IAM | Mục đích / Đáp ứng |
|---|---|---|---|
| `GET` | `/api/v1/accounts-receivable/due-tracking/` | `AR.DUE_TRACKING.VIEW` | Lấy danh sách công nợ theo bộ lọc & tổng hợp (**Bước 1-2, AF01-AF04, AF08**) |
| `GET` | `/api/v1/accounts-receivable/due-tracking/item-detail/` | `AR.DUE_TRACKING.VIEW` | Xem chi tiết lịch thanh toán & giảm trừ của khoản nợ (**Bước 3-4**) |
| `POST` | `/api/v1/accounts-receivable/due-tracking/refresh/` | `AR.DUE_TRACKING.VIEW` | Làm mới số liệu tức thời (**AF06**) |
| `GET` | `/api/v1/accounts-receivable/due-tracking/export/` | `AR.DUE_TRACKING.EXPORT` | Xuất báo cáo Excel định dạng XLSX (**AF05, BR14, EF08**) |
| `POST` | `/api/v1/accounts-receivable/due-tracking/prepare-collection/` | `AR.RECEIVABLE.VIEW` | Kiểm tra tính hợp lệ & đóng gói danh sách nợ chuyển sang Thu tiền (**Bước 5, AF07, EF05, EF06, BR12**) |

---

## 4. Ma trận Quy tắc Nghiệp vụ (Business Rules Traceability)

| Mã BR | Tóm tắt quy tắc | Hiện thực kỹ thuật trong Codebase |
|---|---|---|
| **BR01** | Backend kiểm tra quyền và phạm vi dữ liệu độc lập; quyền xem không mặc định có quyền xuất/thu tiền | [`DueTrackingPermission`](file:///c:/Users/Admin/LapTrinh/Thue/accounts_receivable/permissions.py), phân quyền độc lập `AR.DUE_TRACKING.VIEW` và `AR.DUE_TRACKING.EXPORT`. |
| **BR02** | Chỉ lấy khoản phải thu phát sinh từ chứng từ đã ghi sổ, có hiệu lực và còn số dư tại ngày theo dõi | `rec_qs.filter(posting_date__lte=as_of_date).exclude(status=ReceivableStatus.REVERSED)` |
| **BR03** | Nếu có nhiều đợt thanh toán, theo dõi từng đợt riêng; không hiển thị dòng tổng gây cộng trùng | Khi `rec.schedules.exists()`, duyệt qua từng `ReceivableSchedule`, không cộng dồn bản ghi cha. |
| **BR04** | Số dư tại ngày theo dõi tính theo các nghiệp vụ tăng, giảm có hiệu lực đến ngày đó; tiền thu chưa phân bổ không tự giảm | Lọc `ReceiptAllocation`, `DebtNettingVoucherLine`, `DebtAdjustmentVoucherLine` có ngày hiệu lực/ghi sổ `<= as_of_date`. |
| **BR05** | `Số ngày quá hạn = Ngày theo dõi - Hạn thanh toán`. Hạn trùng ngày theo dõi chưa coi là quá hạn | `due_date < as_of_date` -> `days_overdue = as_of_date - due_date`. Nếu `due_date == as_of_date` -> xếp vào `DUE_TODAY`. |
| **BR06** | `Số ngày còn đến hạn = Hạn thanh toán - Ngày theo dõi`. Tính theo ngày lịch | `(due_date - as_of_date).days`, tính toán thuần túy theo `datetime.date`. |
| **BR07** | Khoản chưa có hạn thanh toán xếp riêng (`NO_DUE_DATE`), không suy đoán hạn | `due_date is None` -> category `NO_DUE_DATE`, `days_due=None`, `days_overdue=None`. |
| **BR08** | Xem ngày quá khứ dùng số liệu và lịch có hiệu lực ngày đó; nhân viên phụ trách dùng phân công hiện tại | Tính toán số dư quá khứ qua biến động lũy kế; thông tin `owner` lấy từ `Party` hiện tại và ghi chú rõ ràng trên xuất báo cáo. |
| **BR09** | Không cộng trực tiếp tiền khác loại; quy đổi dùng tỷ giá ghi sổ ban đầu | Phân rã tổng hợp theo từng `currency_code`; tính `base_remaining_balance = remaining * rec.exchange_rate`. |
| **BR10** | Danh sách quá hạn sắp xếp số ngày quá hạn giảm dần, sau đó số tiền còn phải thu giảm dần | `sort_key`: `(-(it["days_overdue"] or 0), -it["remaining_balance"])`. |
| **BR11** | Nhóm hạn chỉ phản ánh thời điểm đến hạn, không thay đổi sổ kế toán hay số dư công nợ | Đọc dữ liệu (Read-only query engine), không sinh bút toán hay sửa đổi trạng thái model. |
| **BR12** | Chuyển sang thu tiền truyền danh sách khoản phải thu & đợt thanh toán; kiểm tra lại quyền & số dư | API `prepare-collection` kiểm tra quyền, số dư trực tiếp trong DB và trả về cấu trúc nạp sang UC-AR-03. |
| **BR13** | Không cho phép sửa trực tiếp hạn thanh toán trên màn hình này | Endpoint thuần query và action điều phối, không cung cấp API cập nhật hạn thanh toán trực tiếp. |
| **BR14** | Kết quả hiển thị và xuất có ngày theo dõi, bộ lọc, loại tiền và thời điểm lấy dữ liệu | Trả về khối metadata `as_of_date`, `filters`, `data_extracted_at`, `assigned_staff_note` trên cả API và file Excel. |
