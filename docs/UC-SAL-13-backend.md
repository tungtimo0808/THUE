# TÀI LIỆU THIẾT KẾ KỸ THUẬT VÀ ĐẶC TẢ API BACKEND
## USE CASE UC-SAL-13: LẬP HÓA ĐƠN CHIẾT KHẤU (COMMERCIAL DISCOUNT INVOICE ISSUE)

---

### 1. Tổng quan Kiến trúc và Luồng Nghiệp vụ

Use case **UC-SAL-13: Lập hóa đơn chiết khấu** xử lý nghiệp vụ lập và phát hành hóa đơn điều chỉnh kèm bảng kê cho khoản chiết khấu thương mại xác định sau bán (cuối kỳ/đạt doanh số/số lượng), tuân thủ các quy định pháp luật về hóa đơn chứng từ điện tử (Nghị định 123/2020/NĐ-CP, Thông tư 78/2021/TT-BTC, và Nghị định 70/2025/NĐ-CP):

- **Phạm vi áp dụng**: Hóa đơn điều chỉnh chiết khấu thương mại phát sinh sau bán cho các hóa đơn bán hàng đã phát hành trong kỳ. Chiết khấu thương mại ngay trên từng hóa đơn bán hàng được thực hiện tại [UC-SAL-07](file:///c:/Users/Admin/LapTrinh/Thue/sales/models.py); chiết khấu thanh toán được xử lý tại phân hệ thanh toán/công nợ; giảm giá do lỗi quy cách/kém phẩm chất xử lý tại UC-SAL-06.
- **Tính toán và Phân bổ tự động (BR-SAL-13-04, BR-SAL-13-05)**:
  - Hỗ trợ 2 phương pháp: `AMOUNT` (User nhập số tiền giảm trước thuế bằng số dương) hoặc `PERCENTAGE` (tỷ lệ % áp trên tổng doanh số đủ điều kiện).
  - Tự động phân bổ số tiền chiết khấu theo tỷ trọng doanh số đủ điều kiện của từng dòng hóa đơn gốc được chọn.
  - Xử lý chênh lệch làm tròn: cộng/trừ khoản chênh lệch vào dòng có doanh số đủ điều kiện lớn nhất để đảm bảo tổng tiền phân bổ bằng chính xác tổng tiền chiết khấu (BR-SAL-13-05, EF-05).
- **Phân bổ theo nhóm thuế suất gốc (BR-SAL-13-06)**:
  - Thuế suất điều chỉnh được lấy trực tiếp từ dòng hóa đơn gốc (0%, 5%, 8%, 10%, không chịu thuế, không tính thuế), tuyệt đối không áp dụng thuế suất chung hay thuế danh mục hiện tại.
  - Thuế điều chỉnh từng dòng = Tiền chiết khấu phân bổ × Thuế suất.
- **Kiểm soát Doanh số đủ điều kiện & Giữ chỗ (BR-SAL-13-07, BR-SAL-13-08)**:
  - Doanh số đủ điều kiện ban đầu = Doanh số trước thuế của dòng hóa đơn gốc trừ đi các điều chỉnh giảm/trả lại liên quan.
  - Hệ thống tính toán và kiểm soát chặt chẽ:
    - `used_discount_amount`: Khoản chiết khấu đã được phát hành trên các hóa đơn chiết khấu trước (`ISSUED`).
    - `held_discount_amount`: Khoản chiết khấu đang được giữ bởi các hóa đơn chiết khấu chưa hoàn tất (`DRAFT`, `PENDING_APPROVAL`, `REVISION_REQUIRED`, `APPROVED`, `ISSUING`). Khi đang chỉnh sửa hoặc lưu chính hóa đơn hiện tại, phần giữ của chính hóa đơn đó được loại trừ để không bị tự tính trùng (BR-SAL-13-07).
    - Hạn mức còn lại = Doanh số đủ điều kiện - (Khoản đã dùng + Khoản đang giữ). Nếu phân bổ vượt quá hạn mức này, hệ thống từ chối lưu (EF-04, EF-06).
  - Khi xóa Nháp (`DELETE`) hoặc giảm phân bổ, khoản giữ chỗ tự động được giải phóng (AF-07, BR-SAL-13-08).
- **Quy trình Phê duyệt & Phát hành**:
  - Hỗ trợ workflow phê duyệt đa cấp ([UC-SAL-08](file:///c:/Users/Admin/LapTrinh/Thue/sales/approval_services.py)) hoặc phát hành trực tiếp từ `DRAFT` nếu đơn vị không áp dụng workflow.
  - Chuyển tiếp trạng thái phát hành: `DRAFT` / `APPROVED` → `ISSUING` → `ISSUED` (hoặc `ISSUE_FAILED`).
  - Khi gửi phát hành, sinh số hóa đơn thực tế từ `SalesDiscountInvoiceCounter`, đồng bộ sang phân hệ `tax_management` dưới dạng `TaxInvoice` (loại `ADJUSTMENT`, chiều `DECREASE`), sinh đường dẫn XML/PDF và mã tra cứu giao dịch.
  - Khi xảy ra lỗi kết nối (`ISSUING`), hệ thống cung cấp action `check-issue-status` để tra cứu trạng thái trước khi cho phép `retry-issue` nhằm tránh phát hành trùng (BR-SAL-13-14, EF-08, EF-09, AF-06).
- **Độc lập Kế toán & Tồn kho (BR-SAL-13-12, BR-SAL-13-13)**:
  - Phát hành hóa đơn chiết khấu **tuyệt đối không tự động ghi giảm doanh thu, thuế hoặc công nợ lần nữa** vào sổ cái (GL) để tránh hạch toán kép (khoản chiết khấu nếu chưa hạch toán sẽ được chuyển xử lý qua chứng từ kế toán riêng liên kết qua `accounting_document_ref`).
  - **Không làm thay đổi số lượng tồn kho, giá vốn, và không tự động hoàn tiền mặt**.

---

#### 1.1. Activity Diagram (Quy trình Lập và Phát hành Hóa đơn Chiết khấu)

```mermaid
flowchart TD
    Start([User chọn Bán hàng → Hóa đơn chiết khấu]) --> CheckViewPerm{Kiểm tra quyền SAL.DISCOUNT_INVOICE.VIEW}
    CheckViewPerm -- Không có quyền --> EF01[EF-01: 403 Forbidden]
    CheckViewPerm -- Hợp lệ --> Step1[Xem danh sách / Bộ lọc AF-01]

    Step1 --> Step2[Chọn Thêm mới, chọn Khách hàng & Kỳ chiết khấu]
    Step2 --> GetEligible[API eligible-invoices: Lấy các SalesInvoice ISSUED trong kỳ, tính Doanh số đủ điều kiện & Khoản đã dùng/Đang giữ]
    
    GetEligible --> Step3[Chọn Căn cứ chiết khấu, chọn các hóa đơn gốc & các dòng được hưởng]
    Step3 --> ValSource{Cùng Khách hàng & Loại tiền? BR-SAL-13-03, EF-03}
    ValSource -- Không đồng nhất --> EF03[EF-03: Báo lỗi không cho tổng hợp]
    ValSource -- Hợp lệ --> Step4[Nhập Phương pháp: Số tiền hoặc Tỷ lệ %]

    Step4 --> CalcAllocation[API calculate-allocation: Tự động phân bổ theo tỷ trọng doanh số, bù chênh lệch làm tròn vào dòng lớn nhất BR-SAL-13-05; Tính thuế theo thuế suất gốc BR-SAL-13-06]
    CalcAllocation --> Step5[User rà soát & điều chỉnh phân bổ thủ công AF-03]
    
    Step5 --> Step6[Chọn Mẫu/Ký hiệu, Ngày HĐ, nhập Nội dung & Xem trước preview]
    Step6 --> Step7[Chọn Lưu Nháp]
    Step7 --> ValSave{Kiểm tra Tổng phân bổ = Tổng CK (EF-05) & Không vượt hạn mức còn lại (EF-04, EF-06)}
    ValSave -- Vi phạm --> EF04_05[EF-04, EF-05: Chặn lưu, báo lỗi cân đối/vượt hạn mức]
    ValSave -- Hợp lệ --> SaveDraft[Sinh mã HDCK-YYYY-XXXX; Lưu DRAFT; Giữ chỗ hạn mức BR-SAL-13-08; Ghi Audit Log]

    SaveDraft --> WorkflowMode{Doanh nghiệp có Workflow?}
    WorkflowMode -- Có Workflow --> SubmitAppr[Gửi duyệt: Chuyển PENDING_APPROVAL UC-SAL-08]
    SubmitAppr --> ApprStep{Người duyệt xử lý}
    ApprStep -- Phê duyệt --> MarkApproved[Chuyển APPROVED]
    ApprStep -- Yêu cầu sửa --> MarkRevise[Chuyển REVISION_REQUIRED; Cho phép sửa AF-04]
    ApprStep -- Từ chối --> MarkReject[Chuyển REJECTED]
    WorkflowMode -- Không áp dụng Workflow --> DirectIssueReady[Sẵn sàng phát hành từ DRAFT]

    MarkApproved --> IssueAction[Chọn Phát hành]
    DirectIssueReady --> IssueAction
    IssueAction --> CheckPreIssue{Kiểm tra quyền ISSUE & Kiểm tra lại hạn mức giữ chỗ}
    CheckPreIssue -- Chuyển ISSUING --> CallEInv[Gọi Provider E-Invoice]

    CallEInv -- Thành công --> IssueSuccess[Cấp số HĐ từ SalesDiscountInvoiceCounter; Lưu XML/PDF/Mã giao dịch; Tạo TaxInvoice DECREASE; Chuyển ISSUED BR-SAL-13-11]
    CallEInv -- Thất bại xác nhận --> IssueFail[Lưu issue_error_message; Chuyển ISSUE_FAILED; Cho phép Thử lại AF-06]
    CallEInv -- Mất kết nối/Timeout --> IssuePending[Giữ ISSUING; Dùng check-issue-status tra cứu BR-SAL-13-14, EF-09]
```

---

#### 1.2. Sơ đồ Chuyển đổi Trạng thái (State Machine)

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Tạo mới / Lưu nháp (Lưu giữ khoản chiết khấu)
    
    DRAFT --> PENDING_APPROVAL: Gửi duyệt (submit-approval)
    DRAFT --> ISSUING: Phát hành trực tiếp (nếu không dùng workflow)
    DRAFT --> CANCELLED: Xóa / Hủy bỏ (Giải phóng giữ chỗ)
    
    PENDING_APPROVAL --> APPROVED: Duyệt đủ cấp
    PENDING_APPROVAL --> REVISION_REQUIRED: Yêu cầu chỉnh sửa
    PENDING_APPROVAL --> REJECTED: Từ chối duyệt
    PENDING_APPROVAL --> DRAFT: Thu hồi duyệt (recall)
    
    REVISION_REQUIRED --> PENDING_APPROVAL: Chỉnh sửa & Gửi duyệt lại
    REJECTED --> DRAFT: Sửa đổi đưa về Nháp
    
    APPROVED --> ISSUING: Phát hành hóa đơn (issue)
    APPROVED --> DRAFT: Đưa về Nháp khi chưa phát hành (AF-04)
    
    ISSUING --> ISSUED: Nhà cung cấp xác nhận thành công
    ISSUING --> ISSUE_FAILED: Nhà cung cấp báo lỗi xác nhận
    
    ISSUE_FAILED --> ISSUING: Thử lại phát hành (retry-issue)
    ISSUE_FAILED --> DRAFT: Sửa dữ liệu đưa về Nháp để điều chỉnh
    
    ISSUED --> [*]: Khóa sửa/xóa; Tải PDF/XML; Xử lý sai sót qua quy trình riêng (EF-10)
    CANCELLED --> [*]: Kết thúc
```

---

### 2. Cấu trúc Mô hình Dữ liệu (Database Models)

#### 2.1. Hóa đơn Chiết khấu `sal_discount_invoice` (`SalesDiscountInvoice`)

Kế thừa `SalesDocument` và `AbstractAuditableModel` (`id`, `created_at`, `updated_at`, `created_by`, `updated_by`).

| Tên trường | Kiểu dữ liệu | Thuộc tính | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, default=uuid4 | Khóa chính |
| `code` | CharField(50) | Indexed, unique | Mã hóa đơn nội bộ tự sinh định dạng `HDCK-YYYY-XXXX` (Bảng 2.1) |
| `invoice_series` | CharField(20) | | Ký hiệu mẫu hóa đơn (ví dụ `1C26TBB`, `C26TAA`) |
| `template_code` | CharField(50) | | Mẫu số hóa đơn điều chỉnh chiết khấu |
| `invoice_number` | CharField(50) | blank=True | Số hóa đơn chính thức cấp sau phát hành (8 chữ số, ví dụ `00000001`) |
| `invoice_date` | DateField | | Ngày hóa đơn |
| `company` | FK (`organization.Company`) | on_delete=PROTECT | Doanh nghiệp phát hành |
| `branch` | FK (`organization.Branch`) | null=True, on_delete=SET_NULL | Chi nhánh làm việc |
| `customer` | FK (`master_data.Party`) | on_delete=PROTECT | Khách hàng được hưởng chiết khấu |
| `buyer_name` | CharField(255) | | Tên người mua (kế thừa từ hóa đơn gốc) |
| `buyer_tax_code` | CharField(50) | blank=True | Mã số thuế người mua |
| `buyer_address` | CharField(500) | blank=True | Địa chỉ người mua |
| `buyer_email` | CharField(255) | blank=True | Email nhận hóa đơn (kế thừa từ KH, cho phép sửa) |
| `discount_basis` | CharField(500) | | Căn cứ chiết khấu (hợp đồng, phụ lục, chính sách) |
| `contract` | FK (`sales.SalesContract`) | null=True, on_delete=SET_NULL | Liên kết hợp đồng bán hàng nguồn (UC-SAL-12) nếu có |
| `period_start` | DateField | | Ngày bắt đầu kỳ tính chiết khấu |
| `period_end` | DateField | | Ngày kết thúc kỳ tính chiết khấu |
| `currency` | FK (`master_data.Currency`) | on_delete=PROTECT | Đồng tiền hóa đơn (đồng nhất với các HĐ gốc) |
| `exchange_rate` | DecimalField(18, 6) | default=1 | Tỷ giá hạch toán |
| `calculation_method` | CharField(20) | Choices: `AMOUNT`, `PERCENTAGE` | Cách nhập chiết khấu: Theo số tiền hoặc Theo tỷ lệ |
| `discount_rate` | DecimalField(5, 2) | null=True | Tỷ lệ chiết khấu (%) khi chọn `PERCENTAGE` (0 < rate <= 100) |
| `eligible_revenue` | DecimalField(18, 2) | default=0 | Tổng doanh số đủ điều kiện của các dòng được chọn |
| `total_discount_before_tax` | DecimalField(18, 2) | default=0 | Tổng tiền chiết khấu trước thuế |
| `total_tax_amount` | DecimalField(18, 2) | default=0 | Tổng thuế GTGT điều chỉnh giảm |
| `total_adjusted_amount` | DecimalField(18, 2) | default=0 | Tổng giá trị điều chỉnh (Tiền trước thuế + Thuế) |
| `accounting_document_ref` | CharField(100) | blank=True | Tham chiếu chứng từ kế toán chiết khấu (tránh hạch toán kép) |
| `status` | CharField(30) | Indexed | Trạng thái vòng đời hóa đơn chiết khấu |
| `transaction_code` | CharField(100) | blank=True | Mã giao dịch kiểm soát từ nhà cung cấp HĐĐT |
| `xml_file_url` | CharField(500) | blank=True | Đường dẫn tải tệp XML hóa đơn gốc từ nhà cung cấp |
| `pdf_file_url` | CharField(500) | blank=True | Đường dẫn tải tệp PDF hóa đơn thể hiện |
| `issue_error_message` | TextField | blank=True | Chi tiết thông điệp lỗi khi phát hành thất bại |
| `version` | PositiveIntegerField | default=1 | Kiểm soát concurrency và phiên bản cập nhật |

#### 2.2. Chi tiết Bảng kê Phân bổ `sal_discount_invoice_line` (`SalesDiscountInvoiceLine`)

| Tên trường | Kiểu dữ liệu | Thuộc tính | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, default=uuid4 | Khóa chính |
| `invoice` | FK (`SalesDiscountInvoice`) | related_name="lines", CASCADE | Hóa đơn chiết khấu cha |
| `line_no` | PositiveIntegerField | | Thứ tự dòng trong bảng kê phân bổ |
| `original_invoice` | FK (`sales.SalesInvoice`) | on_delete=PROTECT | Hóa đơn bán hàng gốc (UC-SAL-07) |
| `original_invoice_series`| CharField(20) | | Ký hiệu mẫu hóa đơn gốc |
| `original_invoice_number`| CharField(50) | | Số hóa đơn gốc |
| `original_invoice_date` | DateField | | Ngày hóa đơn gốc |
| `original_invoice_line` | FK (`sales.SalesInvoiceLine`) | on_delete=PROTECT | Dòng hàng hóa/dịch vụ cụ thể trên hóa đơn gốc |
| `item` | FK (`master_data.Item`) | null=True, on_delete=SET_NULL | Hàng hóa/dịch vụ |
| `item_name` | CharField(255) | | Tên mặt hàng trên hóa đơn gốc |
| `description` | CharField(500) | blank=True | Diễn giải dòng |
| `uom` | FK (`master_data.UnitOfMeasure`)| null=True, on_delete=SET_NULL | Đơn vị tính |
| `eligible_revenue` | DecimalField(18, 2) | | Doanh số trước thuế đủ điều kiện của dòng |
| `used_discount_amount` | DecimalField(18, 2) | default=0 | Khoản chiết khấu đã sử dụng trước đó |
| `held_discount_amount` | DecimalField(18, 2) | default=0 | Khoản chiết khấu đang giữ bởi các HĐ khác |
| `allocated_discount_amount`| DecimalField(18, 2)| | Tiền chiết khấu phân bổ cho dòng này |
| `tax_rate` | FK (`master_data.TaxRate`) | null=True, on_delete=SET_NULL | Nhóm thuế gốc |
| `tax_rate_percentage` | DecimalField(5, 2) | default=0 | Thuế suất % lấy từ dòng gốc (BR-SAL-13-06) |
| `adjusted_tax_amount` | DecimalField(18, 2) | | Thuế điều chỉnh dòng = Tiền CK phân bổ × Thuế suất % |
| `line_total` | DecimalField(18, 2) | | Tổng giá trị điều chỉnh dòng = Tiền CK + Thuế điều chỉnh |

#### 2.3. Bộ đếm Số hiệu Nội bộ `sal_discount_invoice_counter` (`SalesDiscountInvoiceCounter`)

Lưu trữ số thứ tự tăng dần theo cặp `(company, year)` với cơ chế `select_for_update()` chống nhảy số trùng lặp khi nhiều người dùng thao tác đồng thời.

---

### 3. Danh sách Quyền hạn (Permissions) & Ma trận Thao tác

| Mã quyền | Tên quyền | Phân công thao tác |
| :--- | :--- | :--- |
| `SAL.DISCOUNT_INVOICE.VIEW` | Xem hóa đơn chiết khấu | Xem danh sách, chi tiết, bảng kê phân bổ, preview hóa đơn |
| `SAL.DISCOUNT_INVOICE.CREATE`| Lập hóa đơn chiết khấu | Chọn HĐ gốc, tính phân bổ, tạo và lưu nháp |
| `SAL.DISCOUNT_INVOICE.EDIT` | Sửa hóa đơn chiết khấu | Cập nhật phân bổ ở trạng thái `DRAFT`, `REVISION_REQUIRED` |
| `SAL.DISCOUNT_INVOICE.DELETE`| Xóa hóa đơn chiết khấu | Xóa bỏ ở trạng thái `DRAFT` khi chưa gửi phát hành (giải phóng giữ chỗ) |
| `SAL.DISCOUNT_INVOICE.APPROVE`| Phê duyệt hóa đơn chiết khấu | Phê duyệt, yêu cầu sửa, từ chối theo Workflow UC-SAL-08 |
| `SAL.DISCOUNT_INVOICE.ISSUE` | Phát hành hóa đơn chiết khấu | Gửi yêu cầu ký và phát hành tới nhà cung cấp HĐĐT |
| `SAL.DISCOUNT_INVOICE.RETRY` | Thử lại phát hành | Thử lại gửi phát hành khi trạng thái là `ISSUE_FAILED` |
| `SAL.DISCOUNT_INVOICE.CANCEL`| Hủy hóa đơn chiết khấu | Hủy yêu cầu duyệt hoặc hủy hóa đơn chưa phát hành |

---

### 4. Đặc tả Chi tiết RESTful API Endpoints

Base URL: `/api/sales/discount-invoices/`

#### 4.1. Lấy danh sách hóa đơn đủ điều kiện `GET /api/sales/discount-invoices/eligible-invoices/`
Lấy danh sách các hóa đơn bán hàng gốc của khách hàng trong kỳ chiết khấu để người dùng chọn lập bảng kê (Activity Flow Bước 2 & 3, BR-SAL-13-03, EF-03).

- **Query Parameters**:
  - `customer_id` (UUID, bắt buộc): ID khách hàng.
  - `period_start` (YYYY-MM-DD, bắt buộc): Ngày bắt đầu kỳ.
  - `period_end` (YYYY-MM-DD, bắt buộc): Ngày kết thúc kỳ.
  - `currency_id` (UUID, tùy chọn): Lọc theo đồng tiền.
  - `current_invoice_id` (UUID, tùy chọn): Bỏ qua khoản giữ của chính hóa đơn đang sửa.
- **Response `200 OK`**:
```json
{
  "customer_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "customer_name": "Công ty TNHH Khách Hàng Thử Nghiệm",
  "buyer_tax_code": "0109998877",
  "buyer_address": "Tầng 5, Tòa nhà Landmark, Hà Nội",
  "buyer_email": "accounting@customer.vn",
  "currency_code": "VND",
  "exchange_rate": 1.0,
  "invoices": [
    {
      "id": "e6a188f5-419b-466d-bca5-b38fae1f7a01",
      "number": "00000101",
      "invoice_series": "1C26TBB",
      "invoice_date": "2026-10-01",
      "total_amount": "11000000.00",
      "lines": [
        {
          "id": "7a35da76-13a8-4228-9121-6ebbc412354a",
          "line_number": 1,
          "item_name": "Sản phẩm A",
          "eligible_revenue": "10000000.00",
          "used_discount_amount": "0.00",
          "held_discount_amount": "0.00",
          "remaining_eligible_revenue": "10000000.00",
          "tax_rate_id": "c13d8d67-4a0b-4e08-9df5-bb9024fef70d",
          "tax_rate_code": "VAT10",
          "tax_rate_percentage": "10.00"
        }
      ]
    }
  ]
}
```

#### 4.2. Tính toán phân bổ tự động `POST /api/sales/discount-invoices/calculate-allocation/`
Tự động phân bổ số tiền chiết khấu theo tỷ trọng doanh số đủ điều kiện và tính thuế điều chỉnh từng dòng (Activity Flow Bước 4 & 5, BR-SAL-13-04, BR-SAL-13-05, BR-SAL-13-06).

- **Request Body**:
```json
{
  "calculation_method": "AMOUNT",
  "discount_rate": null,
  "total_discount_before_tax": "1500000.00",
  "lines": [
    {
      "original_invoice_line_id": "7a35da76-13a8-4228-9121-6ebbc412354a",
      "allocated_discount_amount": null
    },
    {
      "original_invoice_line_id": "b3f68310-449e-4a62-a567-a02e64bb07c1",
      "allocated_discount_amount": null
    }
  ]
}
```
- **Response `200 OK`**:
```json
{
  "calculation_method": "AMOUNT",
  "discount_rate": null,
  "eligible_revenue": "30000000.00",
  "total_discount_before_tax": "1500000.00",
  "total_tax_amount": "150000.00",
  "total_adjusted_amount": "1650000.00",
  "lines": [
    {
      "original_invoice_id": "e6a188f5-419b-466d-bca5-b38fae1f7a01",
      "original_invoice_line_id": "7a35da76-13a8-4228-9121-6ebbc412354a",
      "item_name": "Sản phẩm A",
      "eligible_revenue": "20000000.00",
      "allocated_discount_amount": "1000000.00",
      "tax_rate_percentage": "10.00",
      "adjusted_tax_amount": "100000.00",
      "line_total": "11000000.00"
    },
    {
      "original_invoice_id": "e6a188f5-419b-466d-bca5-b38fae1f7a01",
      "original_invoice_line_id": "b3f68310-449e-4a62-a567-a02e64bb07c1",
      "item_name": "Sản phẩm B",
      "eligible_revenue": "10000000.00",
      "allocated_discount_amount": "500000.00",
      "tax_rate_percentage": "10.00",
      "adjusted_tax_amount": "50000.00",
      "line_total": "550000.00"
    }
  ]
}
```

#### 4.3. Tạo mới & Lưu nháp hóa đơn chiết khấu `POST /api/sales/discount-invoices/`
Tạo hóa đơn chiết khấu ở trạng thái `DRAFT` và thiết lập khoản giữ chỗ tương ứng (BR-SAL-13-07, BR-SAL-13-08, EF-04, EF-05).

- **Request Body**:
```json
{
  "customer": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "branch": "45d5a230-0199-4c22-b529-57ef9a8a719c",
  "invoice_series": "1C26TBB",
  "template_code": "1/001",
  "invoice_date": "2026-10-09",
  "currency": "231e67bb-9231-4ec4-9404-5ba323719ce3",
  "exchange_rate": "1.000000",
  "discount_basis": "Hợp đồng số 12/2026/HĐ-TM và Phụ lục 01",
  "period_start": "2026-10-01",
  "period_end": "2026-10-31",
  "calculation_method": "AMOUNT",
  "discount_rate": null,
  "eligible_revenue": "30000000.00",
  "total_discount_before_tax": "1500000.00",
  "total_tax_amount": "150000.00",
  "total_adjusted_amount": "1650000.00",
  "description": "Chiết khấu thương mại kỳ tháng 10/2026",
  "accounting_document_ref": "PKT-CK-2026-0001",
  "lines": [
    {
      "original_invoice": "e6a188f5-419b-466d-bca5-b38fae1f7a01",
      "original_invoice_line": "7a35da76-13a8-4228-9121-6ebbc412354a",
      "item": "129037ab-8f92-4f30-80d1-0f4b3df62ef0",
      "item_name": "Sản phẩm A",
      "uom": "36214ec0-1b22-442d-b153-6ce7f8674d81",
      "eligible_revenue": "20000000.00",
      "allocated_discount_amount": "1000000.00",
      "tax_rate": "c13d8d67-4a0b-4e08-9df5-bb9024fef70d",
      "tax_rate_percentage": "10.00",
      "adjusted_tax_amount": "100000.00",
      "line_total": "1100000.00"
    },
    {
      "original_invoice": "e6a188f5-419b-466d-bca5-b38fae1f7a01",
      "original_invoice_line": "b3f68310-449e-4a62-a567-a02e64bb07c1",
      "item": "3e9b1192-23f2-4bc0-8a71-061f5da9942a",
      "item_name": "Sản phẩm B",
      "uom": "36214ec0-1b22-442d-b153-6ce7f8674d81",
      "eligible_revenue": "10000000.00",
      "allocated_discount_amount": "500000.00",
      "tax_rate": "c13d8d67-4a0b-4e08-9df5-bb9024fef70d",
      "tax_rate_percentage": "10.00",
      "adjusted_tax_amount": "50000.00",
      "line_total": "550000.00"
    }
  ]
}
```
- **Response `201 Created`**:
```json
{
  "id": "893c528f-7c18-47c3-8e79-8d488e36780c",
  "code": "HDCK-2026-0001",
  "invoice_number": "",
  "status": "DRAFT",
  "status_display": "Nháp",
  "total_discount_before_tax": "1500000.00",
  "total_tax_amount": "150000.00",
  "total_adjusted_amount": "1650000.00",
  "version": 1
}
```

#### 4.4. Xem trước hóa đơn `GET /api/sales/discount-invoices/{id}/preview/`
Xem bản thể hiện trước khi phát hành (chưa cấp số chính thức) (Activity Flow Bước 6).

- **Response `200 OK`**: Trả về cấu trúc JSON chứa đầy đủ thông tin bên bán, bên mua, kỳ chiết khấu, căn cứ, bảng kê phân bổ từng dòng hóa đơn gốc và tổng điều chỉnh giảm.

#### 4.5. Phát hành hóa đơn chiết khấu `POST /api/sales/discount-invoices/{id}/issue/`
Thực hiện ký và phát hành hóa đơn chiết khấu (Activity Flow Bước 9 & 10, BR-SAL-13-11, BR-SAL-13-12, BR-SAL-13-13).

- **Response `200 OK`**:
```json
{
  "detail": "Phát hành hóa đơn chiết khấu thành công.",
  "invoice_number": "00000001",
  "transaction_code": "TX-HDCK-2026-0001-A1B2C3D4",
  "status": "ISSUED",
  "xml_file_url": "https://einvoice.internal/xml/HDCK-2026-0001.xml",
  "pdf_file_url": "https://einvoice.internal/pdf/HDCK-2026-0001.pdf"
}
```

#### 4.6. Tra cứu trạng thái phát hành `POST /api/sales/discount-invoices/{id}/check-issue-status/`
Tra cứu trạng thái của hóa đơn đang ở trạng thái treo `ISSUING` do mất kết nối hoặc timeout (BR-SAL-13-14, EF-09).

#### 4.7. Thử lại phát hành `POST /api/sales/discount-invoices/{id}/retry-issue/`
Thử lại phát hành cho các hóa đơn có trạng thái `ISSUE_FAILED` (AF-06).

#### 4.8. Tải tệp và Gửi email `GET /api/sales/discount-invoices/{id}/download-files/` & `POST /api/sales/discount-invoices/{id}/send-email/`
Hỗ trợ tải tệp PDF/XML và gửi email đến người mua kèm lưu vết lịch sử (AF-08).

---

### 5. Kết quả Kiểm thử Tự động (Automated Unit Tests)

Bộ kiểm thử tự động tại [sales/test_sales_discount_invoice_uc_sal_13.py](file:///c:/Users/Admin/LapTrinh/Thue/sales/test_sales_discount_invoice_uc_sal_13.py) bao gồm 18 kịch bản bao phủ toàn diện:

| STT | Tên phương thức kiểm thử | Mã quy tắc / Luồng kiểm tra | Kết quả |
| :---: | :--- | :--- | :---: |
| 1 | `test_01_view_permissions_and_list_filter` | BR-SAL-13-01, AF-01 (Lọc khách hàng, kỳ, trạng thái) | **PASSED** |
| 2 | `test_02_eligible_invoices_api` | Bước 2–3, BR-SAL-13-03, EF-03 (HĐ đã phát hành trong kỳ) | **PASSED** |
| 3 | `test_03_calculate_allocation_amount_method` | Bước 4, BR-SAL-13-04, BR-SAL-13-05, BR-SAL-13-06 (Bù làm tròn) | **PASSED** |
| 4 | `test_04_calculate_allocation_percentage_method` | Bước 4, BR-SAL-13-04, BR-SAL-13-05 (Tính từ % doanh số) | **PASSED** |
| 5 | `test_05_create_discount_invoice_draft` | Bước 7, BR-SAL-13-07, BR-SAL-13-08 (Lưu nháp & Giữ chỗ) | **PASSED** |
| 6 | `test_06_validation_held_exceeds_eligible_revenue`| EF-04, EF-06, BR-SAL-13-07 (Chặn vượt hạn mức còn lại) | **PASSED** |
| 7 | `test_07_validation_mismatched_allocation_sum` | EF-05 (Chặn tổng phân bổ lệch tổng chiết khấu) | **PASSED** |
| 8 | `test_08_update_discount_invoice_and_adjust_holding`| AF-04, BR-SAL-13-08 (Sửa nháp & điều chỉnh hạn mức giữ) | **PASSED** |
| 9 | `test_09_delete_draft_releases_holding` | AF-07, BR-SAL-13-08 (Xóa nháp giải phóng giữ chỗ) | **PASSED** |
| 10 | `test_10_cannot_delete_or_edit_locked_status` | EF-10 (Chặn sửa/xóa khi Đang phát hành hoặc Đã phát hành) | **PASSED** |
| 11 | `test_11_workflow_submit_and_approve` | Bước 8, AF-05, BR-SAL-13-10 (Workflow duyệt đủ cấp) | **PASSED** |
| 12 | `test_12_workflow_revision_and_rejection` | AF-05 (Yêu cầu chỉnh sửa & từ chối phê duyệt) | **PASSED** |
| 13 | `test_13_issue_discount_invoice_success` | Bước 9–10, BR-SAL-13-11, BR-SAL-13-12, BR-SAL-13-13 (Cấp số, TaxInvoice) | **PASSED** |
| 14 | `test_14_issue_discount_invoice_failure_and_retry`| EF-08, AF-06 (Xử lý lỗi phát hành và retry) | **PASSED** |
| 15 | `test_15_check_issuing_status_poll` | EF-09, BR-SAL-13-14 (Tra cứu trạng thái treo ISSUING) | **PASSED** |
| 16 | `test_16_download_files_and_send_email` | AF-08 (Tải tệp XML/PDF và gửi email khách hàng) | **PASSED** |
| 17 | `test_17_audit_log_recorded` | BR-SAL-13-14 (Ghi Audit Log đầy đủ các thao tác) | **PASSED** |
| 18 | `test_18_integration_with_doc_link_service` | UC-SAL-11 (Tích hợp liên kết chứng từ bán hàng) | **PASSED** |

- **Kết quả chạy test toàn hệ thống `sales`**: **166 / 166 tests passed (100% OK)**, không phát sinh bất kỳ lỗi hồi quy nào.
