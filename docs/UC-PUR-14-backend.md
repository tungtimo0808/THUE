# Tài liệu Kỹ thuật Backend: UC-PUR-14 Kiểm tra rủi ro nhà cung cấp

## 1. Mô tả tổng quan

| Thuộc tính | Chi tiết |
| :--- | :--- |
| **Mã Use Case** | `UC-PUR-14` |
| **Tên Use Case** | Kiểm tra rủi ro nhà cung cấp (Supplier Risk Assessment) |
| **Module** | Mua hàng (`purchases`), IAM (`iam`), Master Data (`master_data`), Phải trả (`accounts_payable`) |
| **Actor** | User được cấp quyền kiểm tra rủi ro nhà cung cấp; Nhân viên mua hàng; Quản trị viên/Người phê duyệt ngoại lệ |
| **Trigger** | User chọn **Kiểm tra rủi ro** tại danh mục nhà cung cấp, hoặc hệ thống tự động kiểm tra khi lập hợp đồng, đơn mua hàng, chứng từ mua hàng. |
| **Tiền điều kiện** | User đã đăng nhập và có quyền kiểm tra rủi ro; Nhà cung cấp đã được khai báo trên hệ thống. |
| **Hậu điều kiện** | Kết quả đánh giá rủi ro được lưu trữ theo nhà cung cấp (tạo bản ghi mới theo thời gian, không ghi đè); hệ thống sử dụng kết quả còn hiệu lực để cảnh báo hoặc chặn giao dịch mua hàng. Không tạo chứng từ và không tạo bút toán kế toán (BR23). |
| **Base URL** | `/api/v1/purchases/supplier-risk/` |

---

## 2. Mô hình Dữ liệu (Data Models)

### 2.1. Phân loại mức độ rủi ro (`RiskLevel`)
```python
class RiskLevel(models.TextChoices):
    LOW = "LOW", "Thấp"                      # 0 - 19 điểm (BR06)
    MEDIUM = "MEDIUM", "Trung bình"          # 20 - 39 điểm (BR07)
    HIGH = "HIGH", "Cao"                     # 40 - 100 điểm (BR08)
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA", "Chưa đủ dữ liệu" # BR09, EX06
```

### 2.2. Kết quả kiểm tra rủi ro (`SupplierRiskAssessment`)
Bảng: `pur_supplier_risk_assessment`

| Cột | Kiểu | Ràng buộc | Diễn giải |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | Khóa chính |
| `company_id` | UUID | Foreign Key (`Company`) | Doanh nghiệp sở hữu |
| `supplier_id` | UUID | Foreign Key (`Party`) | Nhà cung cấp được đánh giá |
| `assessment_date`| DateTime | Auto now add | Thời điểm thực hiện đánh giá (BR01) |
| `valid_until` | DateTime | Not null | Thời điểm hết hạn hiệu lực (mặc định 30 ngày, BR03, BR04) |
| `score` | Integer | Default 0 | Tổng điểm rủi ro (0 - 100, BR05) |
| `risk_level` | Char(20) | Choices (`RiskLevel`) | Mức rủi ro (LOW, MEDIUM, HIGH, INSUFFICIENT_DATA) |
| `is_blocked` | Boolean | Default False | Cờ đánh dấu bị chặn giao dịch (BR10, BR21) |
| `tax_status` | Char(50) | Default "ACTIVE" | Trạng thái MST (ACTIVE, INACTIVE, WARNED, UNVERIFIED) |
| `tax_code_status_verified` | Boolean | Default False | Cờ xác minh từ nguồn dữ liệu thuế (AF02, EX05) |
| `criteria_breakdown` | JSONField | Default list | Chi tiết từng tiêu chí, điểm cộng, nguồn (INTERNAL/EXTERNAL, BR22) |
| `data_summary` | JSONField | Default dict | Thống kê: tổng đơn, tỷ lệ giao chậm, số HĐ bất thường, hoàn trả |
| `assessed_by_id` | UUID | Foreign Key (`UserAccount`)| Người thực hiện đánh giá (BR24) |
| `notes` | TextField | Blank | Ghi chú đánh giá của người dùng (Step 19, BR24) |
| `version` | PositiveInt | Default 1 | Phiên bản đánh giá (tăng dần, bảo toàn lịch sử, BR02, AF05) |

### 2.3. Cấu hình tiêu chí & ngưỡng rủi ro (`SupplierRiskConfig`)
Bảng: `pur_supplier_risk_config`

| Cột | Giá trị mặc định | Diễn giải |
| :--- | :--- | :--- |
| `validity_days` | 30 | Số ngày hiệu lực của kết quả đánh giá (BR03, BR04) |
| `low_threshold` | 19 | Ngưỡng trên của mức Thấp (0 - 19 điểm, BR06) |
| `medium_threshold` | 39 | Ngưỡng trên của mức Trung bình (20 - 39 điểm, BR07) |
| `invalid_invoice_points` | 40 | Điểm cộng khi có HĐ không hợp lệ trong 12 tháng (BR12) |
| `duplicate_invoice_points` | 30 | Điểm cộng khi có HĐ trùng lặp trong 12 tháng (BR13) |
| `late_delivery_tier1_points`| 10 | Điểm cộng khi tỷ lệ giao chậm 10% - <30% (BR14) |
| `late_delivery_tier2_points`| 20 | Điểm cộng khi tỷ lệ giao chậm >= 30% (BR14) |
| `return_ratio_tier1_points` | 10 | Điểm cộng khi tỷ lệ trả hàng/giảm giá 5% - <20% (BR15) |
| `return_ratio_tier2_points` | 20 | Điểm cộng khi tỷ lệ trả hàng/giảm giá >= 20% (BR15) |
| `incident_points` | 20 | Điểm cộng cho mỗi sự cố/khiếu nại chưa xử lý (BR16) |

### 2.4. Sự cố, vi phạm và khiếu nại nhà cung cấp (`SupplierIncident`)
Bảng: `pur_supplier_incident`

| Cột | Kiểu | Diễn giải |
| :--- | :--- | :--- |
| `supplier_id` | Foreign Key (`Party`) | Nhà cung cấp liên quan |
| `incident_type` | `COMPLAINT`, `CONTRACT_BREACH`, `QUALITY_ISSUE`, `OTHER` | Loại sự cố |
| `title`, `description` | String / Text | Tiêu đề và mô tả sự việc |
| `status` | `OPEN` (Chưa xử lý), `RESOLVED` (Đã xử lý), `CANCELLED` | Trạng thái (BR16) |
| `related_order_id`, `related_contract_id` | Foreign Key | Liên kết đơn mua hoặc hợp đồng mua hàng |
| `reported_by_id`, `resolved_by_id` | Foreign Key (`UserAccount`) | Người ghi nhận và người xử lý giải quyết |
| `resolved_at`, `resolution_notes` | DateTime / Text | Thời gian và biên bản giải quyết |

### 2.5. Nhật ký tiếp tục giao dịch với rủi ro (`SupplierRiskOverrideLog`)
Bảng: `pur_supplier_risk_override_log` (BR25)

| Cột | Kiểu | Diễn giải |
| :--- | :--- | :--- |
| `supplier_id` | Foreign Key (`Party`) | Nhà cung cấp có rủi ro |
| `assessment_id` | Foreign Key | Bản ghi đánh giá rủi ro tương ứng |
| `risk_level` | Char | Mức rủi ro tại thời điểm xác nhận (`MEDIUM` / `HIGH`) |
| `document_type` | String | Loại chứng từ (`CONTRACT`, `ORDER`, `GOODS`, v.v.) |
| `document_id` | String | Mã/ID chứng từ đang thao tác |
| `reason` | TextField | Lý do tiếp tục giao dịch (bắt buộc, BR19, BR20, BR25) |
| `override_by_id` | Foreign Key (`UserAccount`) | Người thực hiện xác nhận bỏ qua |
| `override_at` | DateTime | Thời điểm xác nhận ghi đè |
| `is_exception_approved` | Boolean | Cờ đã phê duyệt ngoại lệ (AF04, BR20) |
| `approved_by_id` | Foreign Key (`UserAccount`) | Người có thẩm quyền phê duyệt ngoại lệ |

---

## 3. Quy tắc Đánh giá và Tính điểm Rủi ro

### 3.1. Phạm vi thời gian thu thập dữ liệu (BR01, Step 10-14)
Hệ thống tính toán lịch sử giao dịch trong **12 tháng gần nhất** tính lùi từ thời điểm đánh giá:
$$\text{cutoff\_date} = \text{now} - 365\text{ ngày}$$

### 3.2. Tiêu chí tính điểm (BR12 - BR16, BR05)
Tổng điểm rủi ro được tổng hợp theo các tiêu chí và **chặn trong khoảng từ 0 đến 100 điểm**:

$$\text{Total Score} = \min\left(100, \sum \text{Criteria Points}\right)$$

| Mã tiêu chí | Điều kiện phát hiện | Điểm cộng | Nguồn dữ liệu (BR22) |
| :--- | :--- | :---: | :---: |
| `INVALID_INVOICES` (BR12) | Có $\ge 1$ hóa đơn đầu vào trong 12 tháng có trạng thái `INVALID`, `CANCELLED`, `REJECTED`, hoặc `is_replaced=True` | **+40** | Nội bộ (`INTERNAL`) |
| `DUPLICATE_INVOICES` (BR13) | Có hóa đơn đầu vào trùng lặp số hóa đơn và ký hiệu trong 12 tháng | **+30** | Nội bộ (`INTERNAL`) |
| `LATE_DELIVERY` (BR14) | Tỷ lệ đơn mua giao chậm/thiếu: <br>• $10\% \le \text{rate} < 30\%$ <br>• $\text{rate} \ge 30\%$ | <br>**+10**<br>**+20** | Nội bộ (`INTERNAL`) |
| `RETURN_DISCOUNT_RATIO` (BR15) | Tỷ lệ giá trị hàng trả lại hoặc giảm giá so với tổng giá trị mua: <br>• $5\% \le \text{rate} < 20\%$ <br>• $\text{rate} \ge 20\%$ | <br>**+10**<br>**+20** | Nội bộ (`INTERNAL`) |
| `UNRESOLVED_INCIDENTS` (BR16) | Mỗi khiếu nại, sự cố, vi phạm hợp đồng đang ở trạng thái `OPEN` | **+20** / vụ việc | Nội bộ (`INTERNAL`) |
| `TAX_CODE_FORMAT` (EX03) | Mã số thuế không đúng định dạng quy chuẩn 10 số hoặc 13 số | **+10** | Nội bộ (`INTERNAL`) |
| `TAX_CODE_DUPLICATE` (EX04) | Mã số thuế trùng lặp với nhà cung cấp khác trong cùng doanh nghiệp | **+10** | Nội bộ (`INTERNAL`) |
| `EXTERNAL_TAX_STATUS` (BR11) | Nguồn dữ liệu thuế cảnh báo: MST không tồn tại, ngừng hoạt động, giải thể, bỏ trốn | **+50** | Thuế (`EXTERNAL`) |
| `INTERNAL_BLOCK_LIST` (BR10) | Nhà cung cấp ở trạng thái khóa giao dịch nội bộ (`BLOCKED`) | **+100** | Nội bộ (`INTERNAL`) |

### 3.3. Phân loại mức rủi ro (BR06 - BR09, EX06)
1. **Chưa đủ dữ liệu (`INSUFFICIENT_DATA`)** (BR09, EX06):
   - Áp dụng khi nhà cung cấp **chưa có lịch sử giao dịch trong 12 tháng** (không có đơn mua hàng, không có hóa đơn đầu vào, không có trả hàng, giảm giá và không có sự cố mở).
   - **Tuyệt đối không tự động xếp loại là Thấp** (BR09).
2. **Cao (`HIGH`)** (BR08, BR10, BR11):
   - Tổng điểm từ **40 đến 100 điểm**.
   - **HOẶC** nhà cung cấp nằm trong danh sách chặn nội bộ (`status = 'BLOCKED'`).
   - **HOẶC** nhà cung cấp có Mã số thuế ngừng hoạt động, không tồn tại hoặc bị cơ quan thuế cảnh báo.
3. **Trung bình (`MEDIUM`)** (BR07):
   - Tổng điểm từ **20 đến 39 điểm**.
4. **Thấp (`LOW`)** (BR06, BR18):
   - Tổng điểm từ **0 đến 19 điểm**.

---

## 4. Cơ chế Kiểm soát Giao dịch Mua hàng (AF01 - AF04, EX07 - EX08, BR18 - BR25)

Khi User lập Hợp đồng mua hàng, Đơn mua hàng hoặc Chứng từ mua hàng:

```
                            [Người dùng chọn Nhà cung cấp]
                                          │
                                          ▼
                      Có kết quả đánh giá rủi ro còn hiệu lực?
                                    (valid_until >= now)
                                   /                    \
                            Chưa có / Hết hạn             Có
                                 /                        │
                   [Cảnh báo: Chưa có kết quả             ▼
                    còn hiệu lực (AF01, BR03)]   Mức rủi ro là gì?
                                                 /        │        \
                                            Thấp     Trung bình     Cao / Bị chặn
                                             │            │               │
                                             │      Nhập lý do?           │
                                             │       (BR19, AF03)         │
                                             │      /            \        │
                                          Không    Có             │       │
                                            │       │             │       │
                                      [Yêu cầu     [Ghi nhật ký   │       │
                                       nhập lý do]  override      │       │
                                                    & Tiếp tục]   ▼       ▼
                                                             Có quyền OVERRIDE
                                                             hoặc Duyệt ngoại lệ?
                                                                 (BR20, AF04)
                                                                 /          \
                                                              Không         Có
                                                                │            │
                                                           [Chặn thao tác    Nhà cung cấp
                                                            Yêu cầu phê      bị khóa/MST đóng?
                                                            duyệt ngoại lệ]      (BR21)
                                                                               /        \
                                                                             Có          Không
                                                                             │             │
                                                                       [Chặn tuyệt đối] [Ghi nhật ký
                                                                       (EX07, BR21)     override
                                                                                        & Tiếp tục]
```

### Chi tiết các quy tắc ràng buộc:
- **Rủi ro Thấp (`LOW`)**: Được phép giao dịch bình thường (BR18).
- **Rủi ro Trung bình (`MEDIUM`)**: Chỉ được tiếp tục giao dịch sau khi User nhập **Lý do xác nhận** (AF03, BR19). Hệ thống bắt buộc lưu vết User thực hiện, thời gian và lý do vào `SupplierRiskOverrideLog` (BR25).
- **Rủi ro Cao (`HIGH`)**:
  - User không có quyền `PUR.SUPPLIER_RISK.OVERRIDE`: Hệ thống chặn thao tác và hiển thị thông báo ngoại lệ (EX08, AF04).
  - User có quyền `PUR.SUPPLIER_RISK.OVERRIDE`: Bắt buộc nhập lý do tiếp tục giao dịch; hệ thống lưu vết phê duyệt ngoại lệ (BR20, BR25).
- **Bị chặn giao dịch hoặc MST không còn hoạt động**: Tuyệt đối không cho phép tiếp tục giao dịch, kể cả khi User đã nhập lý do (BR21, EX07).

---

## 5. Danh sách API Endpoints

### 5.1. Danh sách nhà cung cấp kèm trạng thái rủi ro gần nhất (Step 1-3)
- **URL**: `GET /api/v1/purchases/supplier-risk/`
- **Quyền**: `PUR.SUPPLIER_RISK.VIEW`
- **Tham số Query**:
  - `company_id` (bắt buộc): UUID của doanh nghiệp.
  - `q` hoặc `search` (tùy chọn): Từ khóa tìm kiếm theo Mã NCC, Tên NCC hoặc Mã số thuế.
- **Response `200 OK`**:
```json
{
  "count": 2,
  "results": [
    {
      "supplier_id": "9342730a-2ddf-4402-9952-47528e1858a7",
      "supplier_code": "NCC-VIN",
      "supplier_name": "Công ty Cổ phần Vật liệu Xây dựng Vin",
      "tax_code": "0101234567",
      "operating_status": "Đang hoạt động",
      "status_code": "ACTIVE",
      "latest_risk_level": "LOW",
      "latest_risk_level_display": "Thấp",
      "latest_score": 10,
      "latest_check_date": "2026-10-06T10:00:00Z",
      "valid_until": "2026-11-05T10:00:00Z",
      "is_valid": true,
      "assessor": "Nguyễn Văn A"
    }
  ]
}
```

### 5.2. Chi tiết nhà cung cấp và lịch sử đánh giá (Step 4, BR02)
- **URL**: `GET /api/v1/purchases/supplier-risk/{supplier_id}/`
- **Quyền**: `PUR.SUPPLIER_RISK.VIEW`
- **Response `200 OK`**:
```json
{
  "supplier": {
    "id": "9342730a-2ddf-4402-9952-47528e1858a7",
    "code": "NCC-VIN",
    "name": "Công ty Cổ phần Vật liệu Xây dựng Vin",
    "tax_code": "0101234567",
    "status": "ACTIVE",
    "status_display": "Đang hoạt động"
  },
  "latest_assessment": {
    "id": "e22a4fc7-1a42-4934-bc28-98e9882299aa",
    "score": 10,
    "risk_level": "LOW",
    "version": 2,
    "is_valid": true,
    "valid_until": "2026-11-05T10:00:00Z",
    "criteria_breakdown": [ ... ],
    "data_summary": { ... }
  },
  "history": [
    { "version": 2, "score": 10, "risk_level": "LOW", ... },
    { "version": 1, "score": 25, "risk_level": "MEDIUM", ... }
  ]
}
```

### 5.3. Thực hiện kiểm tra rủi ro nhà cung cấp (Steps 5-21)
- **URL**: `POST /api/v1/purchases/supplier-risk/check/`
- **Quyền**: `PUR.SUPPLIER_RISK.CHECK`
- **Request Body**:
```json
{
  "supplier_id": "9342730a-2ddf-4402-9952-47528e1858a7",
  "notes": "Kiểm tra định kỳ trước khi ký hợp đồng Q4",
  "external_tax_status": "ACTIVE",
  "simulate_external_failure": false
}
```
- **Response `201 Created`** (Step 21):
```json
{
  "message": "Lưu kết quả kiểm tra rủi ro nhà cung cấp thành công.",
  "data": {
    "id": "e22a4fc7-1a42-4934-bc28-98e9882299aa",
    "company": "21f7626f-d1ef-42a9-b68f-9a74aa96dfba",
    "supplier": "9342730a-2ddf-4402-9952-47528e1858a7",
    "supplier_code": "NCC-VIN",
    "supplier_name": "Công ty Cổ phần Vật liệu Xây dựng Vin",
    "score": 20,
    "risk_level": "MEDIUM",
    "version": 1,
    "valid_until": "2026-11-06T05:00:00Z",
    "is_valid": true,
    "criteria_breakdown": [
      {
        "code": "LATE_DELIVERY",
        "name": "Tỷ lệ giao hàng chậm / không hoàn thành",
        "source": "INTERNAL",
        "status": "MODERATE_LATE_RATE",
        "points": 10,
        "verified": true,
        "description": "Tỷ lệ giao chậm là 20.0% (2/10 đơn, 10% - <30%).",
        "related_items": ["PO-2026-0001", "PO-2026-0002"]
      },
      {
        "code": "RETURN_DISCOUNT_RATIO",
        "name": "Tỷ lệ hàng trả lại và giảm giá",
        "source": "INTERNAL",
        "status": "MODERATE_RATIO",
        "points": 10,
        "verified": true,
        "description": "Tỷ lệ hàng trả lại / giảm giá là 10.0% (5% - <20%).",
        "related_items": ["PR-2026-0001"]
      }
    ],
    "data_summary": {
      "total_orders": 10,
      "late_orders": 2,
      "late_delivery_rate": 20.0,
      "total_invoices": 5,
      "invalid_invoices": 0,
      "total_purchase_amount": 100000000.0,
      "total_return_discount_amount": 10000000.0,
      "return_discount_rate": 10.0,
      "open_incidents_count": 0
    }
  }
}
```

### 5.4. Đánh giá lại nhà cung cấp (AF05)
- **URL**: `POST /api/v1/purchases/supplier-risk/{supplier_id}/recheck/`
- **Quyền**: `PUR.SUPPLIER_RISK.CHECK`
- **Cơ chế**: Thu thập dữ liệu thời điểm hiện tại, tính lại điểm, tạo bản ghi đánh giá mới với `version` tăng thêm 1 và giữ nguyên toàn bộ lịch sử (BR01, BR02, AF05).

### 5.5. Kiểm tra tính hợp lệ trước giao dịch (AF01, AF03, AF04, EX07, EX08)
- **URL**: `POST /api/v1/purchases/supplier-risk/check-transaction/`
- **Quyền**: `PUR.SUPPLIER_RISK.CHECK_TX`
- **Request Body**:
```json
{
  "supplier_id": "9342730a-2ddf-4402-9952-47528e1858a7",
  "document_type": "ORDER",
  "document_id": "PO-2026-0099",
  "reason": "Nhà cung cấp đã ký biên bản cam kết bù hàng giao thiếu trong tuần",
  "confirm": true
}
```
- **Response Scenarios**:
  - **Trường hợp Thấp**: `allowed: true, status: "ALLOWED"`
  - **Trường hợp Chưa đánh giá hoặc hết hạn (AF01)**: `allowed: false, status: "ASSESSMENT_REQUIRED"`
  - **Trường hợp Trung bình thiếu lý do (BR19)**: `allowed: false, status: "REASON_REQUIRED"`
  - **Trường hợp Cao thiếu quyền override (EX08)**: `allowed: false, status: "OVERRIDE_REQUIRED"`
  - **Trường hợp Bị chặn / MST đóng (BR21)**: `allowed: false, status: "BLOCKED"`

### 5.6. Ghi nhật ký override (BR25)
- **URL**: `POST /api/v1/purchases/supplier-risk/override/`
- **Quyền**: `PUR.SUPPLIER_RISK.OVERRIDE`

### 5.7. Cấu hình quy tắc & ngưỡng rủi ro (BR04, BR17)
- **URL**: `GET /api/v1/purchases/supplier-risk/config/`
- **URL**: `PATCH /api/v1/purchases/supplier-risk/config/`
- **Quyền**: `PUR.SUPPLIER_RISK.CONFIG`

### 5.8. Quản lý sự cố, vi phạm nhà cung cấp (BR16)
- **URL**: `GET /api/v1/purchases/supplier-risk/incidents/`
- **URL**: `POST /api/v1/purchases/supplier-risk/incidents/`
- **URL**: `POST /api/v1/purchases/supplier-risk/incidents/{incident_id}/resolve/`
- **Quyền**: `PUR.SUPPLIER_RISK.INCIDENT`

---

## 6. Ma trận Phân quyền IAM

| Mã quyền | Tên quyền | Mức rủi ro | Mục đích sử dụng |
| :--- | :--- | :---: | :--- |
| `PUR.SUPPLIER_RISK.VIEW` | Xem rủi ro nhà cung cấp | NORMAL | Xem danh sách nhà cung cấp, lịch sử và chi tiết rủi ro |
| `PUR.SUPPLIER_RISK.CHECK` | Kiểm tra rủi ro | NORMAL | Thực hiện tính điểm, đánh giá và đánh giá lại nhà cung cấp |
| `PUR.SUPPLIER_RISK.OVERRIDE`| Cho phép tiếp tục giao dịch | HIGH | Cho phép tiếp tục giao dịch với nhà cung cấp rủi ro cao (BR20) |
| `PUR.SUPPLIER_RISK.CONFIG` | Cấu hình quy tắc rủi ro | HIGH | Sửa đổi thang điểm, tiêu chí và thời gian hiệu lực (BR04, BR17) |
| `PUR.SUPPLIER_RISK.INCIDENT`| Quản lý sự cố nhà cung cấp | NORMAL | Tạo và giải quyết khiếu nại, sự cố, vi phạm hợp đồng (BR16) |

---

## 7. Kết quả Kiểm thử Tự động (Automated Test Suite)

Bộ test case kiểm thử toàn diện được lưu tại `purchases/test_supplier_risk.py`.

```
System check identified 2 issues (0 silenced).
..................
----------------------------------------------------------------------
Ran 18 tests in 16.500s

OK
Preserving test database for alias 'default'...
Found 18 test(s).
```

### Chi tiết 18 test cases đã vượt qua 100%:

| Test Method | Mục tiêu kiểm thử | Quy tắc nghiệp vụ | Kết quả |
| :--- | :--- | :--- | :---: |
| `test_01_insufficient_data_does_not_default_to_low` | Nhà cung cấp mới không có lịch sử trả về `INSUFFICIENT_DATA`, không mặc định là Thấp | BR09, EX06 | **PASS** |
| `test_02_invalid_invoice_adds_40_points` | Hóa đơn đầu vào không hợp lệ trong 12 tháng cộng 40 điểm, xếp loại Cao | BR08, BR12 | **PASS** |
| `test_03_duplicate_invoice_adds_30_points` | Hóa đơn đầu vào trùng số và ký hiệu cộng 30 điểm | BR13 | **PASS** |
| `test_04_late_delivery_points_and_tiers` | Tỷ lệ đơn giao chậm 10% - <30% (+10đ, Thấp); $\ge 30\%$ (+20đ, Trung bình) | BR06, BR07, BR14 | **PASS** |
| `test_05_return_and_discount_ratio_scoring` | Tỷ lệ hàng trả/giảm giá 5% - <20% (+10đ); $\ge 20\%$ (+20đ, Trung bình) | BR07, BR15 | **PASS** |
| `test_06_unresolved_incidents_adds_20_points_each_capped_at_100` | 6 sự cố mở cộng 20đ/sự cố, chặn tối đa 100 điểm, xếp loại Cao | BR05, BR08, BR16 | **PASS** |
| `test_07_blocked_supplier_is_high_risk_and_blocked` | Nhà cung cấp bị khóa giao dịch nội bộ xếp loại Cao, chặn tuyệt đối trước giao dịch | BR10, BR21, EX07 | **PASS** |
| `test_08_external_tax_code_warning_or_inactive_is_high_risk` | Mã số thuế ngừng hoạt động hoặc bị cơ quan thuế cảnh báo xếp loại Cao và chặn | BR11, BR21 | **PASS** |
| `test_09_external_source_unavailable_fallback` | Không kết nối được nguồn thuế bên ngoài: tiếp tục kiểm tra nội bộ, đánh dấu chưa xác minh | AF02, EX05, BR22 | **PASS** |
| `test_10_tax_code_format_and_duplicate_warnings` | Phát hiện cảnh báo định dạng MST sai và trùng lặp mã số thuế nội bộ | EX03, EX04 | **PASS** |
| `test_11_recheck_creates_new_record_preserving_history` | Kiểm tra lại tạo bản ghi mới với version tăng dần, giữ nguyên toàn bộ lịch sử | BR01, BR02, AF05 | **PASS** |
| `test_12_validity_period_and_expiration` | Hết hạn 30 ngày cảnh báo chưa có kết quả rủi ro còn hiệu lực | BR03, BR04, AF01 | **PASS** |
| `test_13_medium_risk_override_requires_reason` | Rủi ro trung bình thiếu lý do bị từ chối; có lý do thành công và lưu nhật ký | AF03, BR19, BR25 | **PASS** |
| `test_14_high_risk_override_requires_permission` | Rủi ro cao cần quyền `OVERRIDE` và lý do; user thường bị từ chối | AF04, EX08, BR20 | **PASS** |
| `test_15_supplier_risk_config_api` | Admin xem và cấu hình lại tiêu chí, ngày hiệu lực và các ngưỡng điểm | BR04, BR17 | **PASS** |
| `test_16_supplier_incidents_api` | Khai báo sự cố, vi phạm hợp đồng và quy trình giải quyết sự cố | BR16 | **PASS** |
| `test_17_search_suppliers_risk_summary` | Xem danh sách nhà cung cấp kèm trạng thái rủi ro gần nhất và tìm kiếm | Step 1-3 | **PASS** |
| `test_18_permission_denied_message_ex10` | Chặn user không có quyền với thông báo "Bạn không có quyền thực hiện chức năng này." | EX10 | **PASS** |

### Kiểm tra Hồi quy (Regression Tests):
Đã chạy kiểm thử hồi quy đối với các chức năng liên quan `purchases.test_purchase_contract` và `purchases.test_purchase_cost`: **42/42 tests PASS 100%**.
