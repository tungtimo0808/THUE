# UC-AR-06: Điều chỉnh công nợ phải thu (AR Debt Adjustment) - Backend Architecture & API Specification

Tài liệu thiết kế kỹ thuật và đặc tả API backend cho use case **UC-AR-06: Điều chỉnh công nợ phải thu**.
Triển khai tuân thủ toàn diện các quy tắc nghiệp vụ (**BR01** đến **BR14**), luồng hoạt động chính (**Activity Flow Bước 1–8**), luồng thay thế (**AF01** đến **AF06**) và luồng ngoại lệ (**EF01** đến **EF10**).

---

## 1. Sơ đồ Hoạt động (Activity Diagram - Mermaid)

Sơ đồ thể hiện luồng xử lý điều chỉnh tăng / giảm công nợ khách hàng qua các phân vùng (swimlanes):

```mermaid
flowchart TD
    subgraph ACTOR ["👤 User (Kế toán Công nợ / Người duyệt)"]
        U_START(["Bắt đầu: Vào Công nợ phải thu → Điều chỉnh công nợ"])
        U_ADD["Bước 2-3: Nhấn 'Thêm', chọn Khách hàng & Loại điều chỉnh (Tăng/Giảm)"]
        U_LINES["Bước 4: Nhập chi tiết dòng: Khoản phải thu, Đợt, Số tiền, TK đối ứng, Hạn TT"]
        U_SAVE["Bước 5: Nhập lý do, tài liệu căn cứ và nhấn 'Lưu' (Nháp)"]
        U_SUBMIT["Bước 6: Nhấn 'Gửi duyệt' (nếu áp dụng phê duyệt)"]
        U_POST["Bước 7-8: Chọn chứng từ đủ điều kiện và nhấn 'Ghi sổ' → Xác nhận"]
        U_VIEW(["Xem kết quả: Đã ghi sổ, Công nợ cập nhật, Bút toán GL đã sinh"])
    end

    subgraph SYSTEM_FE ["💻 Giao diện Điều chỉnh Công nợ (Frontend)"]
        FE_LIST["Hiển thị danh sách chứng từ điều chỉnh"]
        FE_FORM["Hiển thị biểu mẫu: Điền tiền tệ, TK 131 & gợi ý khoản phải thu còn dư"]
        FE_CALC["Tính tổng tiền điều chỉnh, giá trị quy đổi và hiển thị số dư"]
        FE_RESULT["Hiển thị chứng từ trạng thái ĐÃ GHI SỔ, liên kết bút toán GL"]
    end

    subgraph ADJ_SVC ["⚙️ Adjustment Voucher Service (Backend)"]
        CHK_PERM{"Kiểm tra quyền IAM & Chi nhánh"}
        VAL_CUST{"Khách hàng hoạt động & có vai trò CUSTOMER?"}
        FETCH_REC["Truy vấn công nợ đủ điều kiện (eligible-receivables)"]
        VAL_LINES{"BR02-BR06: Hợp lệ TK đối ứng, Loại tiền & Số tiền <= Số dư?"}
        SAVE_DRAFT["Lưu chứng từ ở trạng thái NHÁP (Không thay đổi số dư công nợ)"]
        WF_CHECK{"Có quy trình duyệt?"}
        DO_APPROVE["Chuyển ĐÃ DUYỆT / Ghi nhận Approval Decision"]
        ATOMIC_POST["Mở giao dịch Atomic Transaction"]
        RECHECK_BAL{"Kiểm tra lại số dư & Kỳ kế toán còn mở?"}
        CREATE_GL["Sinh bút toán GL: Nợ 131/Có TK đối ứng (Tăng) hoặc Nợ TK đối ứng/Có 131 (Giảm)"]
        UPDATE_DEBTS["Tạo Receivable mới (Tăng) HOẶC Giảm số dư Receivable/Schedule (Giảm)"]
    end

    subgraph GL_DB ["🗄️ Database & Sổ cái GL"]
        DB_VOUCHER[("Bảng ar_debt_adjustment_voucher & line")]
        DB_GL[("Bảng gl_journal_entry & line")]
        DB_DEBTS[("Bảng ar_receivable & ar_receivable_schedule")]
        DB_AUDIT[("Bảng audit_log")]
    end

    subgraph EXCEPTIONS ["⚠️ Luồng ngoại lệ & Xử lý chặn"]
        ERR_PERM["EF01: Chặn 403 Forbidden"]
        ERR_REQ["EF02: Báo lỗi thiếu Loại điều chỉnh, Lý do, Tài liệu căn cứ"]
        ERR_VAL["EF03-EF06: Báo lỗi Số tiền <= 0, Trùng TK đối ứng hoặc Vượt số dư"]
        ERR_CHANGED["EF07: Chặn ghi sổ - Số dư công nợ đã thay đổi"]
        ERR_PERIOD["EF08: Chặn ghi sổ - Kỳ kế toán đóng"]
        ERR_DEP["EF09: Chặn bỏ ghi sổ - Có thu tiền/bù trừ phụ thuộc"]
    end

    %% Connections
    U_START --> CHK_PERM
    CHK_PERM -- Không có quyền --> ERR_PERM
    CHK_PERM -- Hợp lệ --> FE_LIST
    FE_LIST --> U_ADD

    U_ADD --> VAL_CUST
    VAL_CUST -- Hợp lệ --> FETCH_REC
    FETCH_REC --> FE_FORM

    FE_FORM --> U_LINES
    U_LINES --> FE_CALC
    FE_CALC --> U_SAVE

    U_SAVE --> VAL_LINES
    VAL_LINES -- Thiếu trường bắt buộc --> ERR_REQ
    VAL_LINES -- Lỗi dữ liệu/Trùng TK/Vượt số dư --> ERR_VAL
    VAL_LINES -- Hợp lệ --> SAVE_DRAFT
    SAVE_DRAFT --> DB_VOUCHER
    SAVE_DRAFT --> U_SUBMIT

    U_SUBMIT --> WF_CHECK
    WF_CHECK -- Có Workflow --> DO_APPROVE
    WF_CHECK -- Không Workflow --> U_POST
    DO_APPROVE --> U_POST

    U_POST --> ATOMIC_POST
    ATOMIC_POST --> RECHECK_BAL
    RECHECK_BAL -- Kỳ kế toán đóng --> ERR_PERIOD
    RECHECK_BAL -- Số dư bị đổi/không đủ --> ERR_CHANGED
    RECHECK_BAL -- Hợp lệ --> CREATE_GL
    CREATE_GL --> DB_GL
    CREATE_GL --> UPDATE_DEBTS
    UPDATE_DEBTS --> DB_DEBTS
    UPDATE_DEBTS --> DB_AUDIT
    UPDATE_DEBTS --> FE_RESULT
    FE_RESULT --> U_VIEW
```

---

## 2. Sơ đồ Vòng đời Trạng thái Chứng từ (State Diagram - Mermaid)

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Tạo mới / Lưu chứng từ (BR07)
    
    DRAFT --> PENDING_APPROVAL: Gửi duyệt (Có Workflow)
    DRAFT --> APPROVED: Gửi duyệt (Không Workflow / BR08)
    DRAFT --> POSTED: Ghi sổ trực tiếp (Không Workflow / BR08)
    DRAFT --> CANCELLED: Hủy chứng từ nháp (kèm lý do / AF05)
    
    PENDING_APPROVAL --> DRAFT: Thu hồi chứng từ (Recall / AF05)
    PENDING_APPROVAL --> APPROVED: Người duyệt chấp thuận
    PENDING_APPROVAL --> REJECTED: Người duyệt từ chối (kèm lý do)
    PENDING_APPROVAL --> REVISION_REQUESTED: Yêu cầu chỉnh sửa (kèm lý do)
    
    REVISION_REQUESTED --> PENDING_APPROVAL: Cập nhật & Gửi lại
    REVISION_REQUESTED --> CANCELLED: Hủy chứng từ (AF05)
    REJECTED --> CANCELLED: Hủy chứng từ (AF05)
    
    APPROVED --> POSTED: Ghi sổ (Tạo Receivable mới hoặc giảm nợ & ghi GL / BR09)
    
    POSTED --> DRAFT: Bỏ ghi sổ (Unpost / Hoàn tác GL & hoàn trả số dư / AF06)
    
    CANCELLED --> [*]: Lưu vết hủy
    POSTED --> [*]: Hoàn tất chu kỳ điều chỉnh
```

---

## 3. Mô hình Dữ liệu (Database Models)

### 3.1. `DebtAdjustmentVoucher` (`ar_debt_adjustment_voucher`)
- **Khóa chính**: `id` (UUID).
- **Mã chứng từ**: `number` (Tự sinh theo `DocumentNumberingRule` hoặc quy tắc `AR-ADJ-YYYY-00001`, duy nhất trong công ty).
- **Liên kết tổ chức & khách hàng**:
  - `company`: ForeignKey `Company`.
  - `branch`: ForeignKey `Branch`.
  - `customer`: ForeignKey `Party` (vai trò Khách hàng, trạng thái `ACTIVE`).
- **Phân loại & Tài chính**:
  - `adjustment_type`: `INCREASE` (Tăng công nợ) hoặc `DECREASE` (Giảm công nợ) (Bắt buộc, không mặc định).
  - `currency`: ForeignKey `Currency`.
  - `receivable_account`: ForeignKey `Account` (TK 131).
  - `total_amount`: DecimalField (Tổng tiền nguyên tệ = $\sum \text{amount}$).
  - `total_converted_amount`: DecimalField (Tổng giá trị quy đổi theo đồng tiền hạch toán).
- **Lý do & Hồ sơ căn cứ**:
  - `adjustment_reason`: Bắt buộc, nội dung và nguyên nhân điều chỉnh (BR03).
  - `document_basis`: Bắt buộc, biên bản đối chiếu, quyết định hoặc tài liệu xác nhận (BR03).
  - `description`: Mặc định `"[Tăng/Giảm] công nợ [Tên khách hàng]"`, cho phép sửa.
  - `attachments`: JSONField, danh sách tài liệu đính kèm.
- **Trạng thái & Phê duyệt**:
  - `status`: `DRAFT` | `PENDING_APPROVAL` | `REVISION_REQUESTED` | `REJECTED` | `APPROVED` | `POSTED` | `CANCELLED`.
  - `approval_required`: Boolean.
  - `journal_entry`: OneToOneField `JournalEntry` (bút toán Sổ cái khi Đã ghi sổ).
  - `posted_by`, `posted_at`, `unposted_by`, `unposted_at`, `unpost_reason`.
  - `cancelled_by`, `cancelled_at`, `cancel_reason`.

### 3.2. `DebtAdjustmentVoucherLine` (`ar_debt_adjustment_voucher_line`)
- `voucher`: ForeignKey `DebtAdjustmentVoucher`.
- `line_no`: Số thứ tự dòng.
- `receivable`: ForeignKey `Receivable` (Bắt buộc khi giảm công nợ; tùy chọn khi tăng công nợ có liên kết khoản cũ).
- `receivable_schedule`: ForeignKey `ReceivableSchedule` (Bắt buộc khi giảm khoản có nhiều đợt còn dư).
- `offset_account`: ForeignKey `Account` (Tài khoản đối ứng hoạt động, không trùng `receivable_account`).
- `amount`: Số tiền điều chỉnh nguyên tệ (> 0, BR05).
- `exchange_rate`: Tỷ giá (> 0). Tăng: lấy tỷ giá hạch toán / người dùng nhập. Giảm: lấy theo giá trị ghi sổ của khoản phải thu.
- `converted_amount`: Giá trị quy đổi = $\text{amount} \times \text{exchange\_rate}$.
- `new_due_date`: Hạn thanh toán mới (chỉ áp dụng khi điều chỉnh tăng).
- `description`: Nội dung chi tiết dòng điều chỉnh.
- `created_receivable`: ForeignKey `Receivable` (Khoản phải thu mới sinh ra khi ghi sổ điều chỉnh tăng, AF01).
- `legacy_adjustment`: ForeignKey `ReceivableAdjustment` (Bản ghi lưu vết điều chỉnh giảm phục vụ Sổ chi tiết công nợ).

---

## 4. Danh mục API Endpoints

Base URL: `/api/v1/accounts-receivable/debt-adjustment-vouchers/`

| Phương thức | Endpoint | Quyền IAM | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `AR.ADJUSTMENT_VOUCHER.VIEW` | Danh sách chứng từ điều chỉnh (lọc theo `company_id`, `branch_id`, `customer_id`, `status`). |
| `POST` | `/` | `AR.ADJUSTMENT_VOUCHER.CREATE` | Lập chứng từ điều chỉnh mới ở trạng thái `DRAFT` (BR07). |
| `GET` | `/{id}/` | `AR.ADJUSTMENT_VOUCHER.VIEW` | Chi tiết chứng từ và các dòng điều chỉnh. |
| `PATCH` | `/{id}/` | `AR.ADJUSTMENT_VOUCHER.EDIT` | Sửa chứng từ ở trạng thái `DRAFT`, `REVISION_REQUESTED`, `REJECTED`. |
| `GET` | `/eligible-receivables/` | `AR.ADJUSTMENT_VOUCHER.VIEW` | Lấy danh sách khoản phải thu còn dư, đợt thanh toán, gợi ý tiền tệ và tài khoản mặc định (Bước 3, AF04). |
| `POST` | `/{id}/submit/` | `AR.ADJUSTMENT_VOUCHER.SUBMIT` | Gửi duyệt chứng từ (tự duyệt nếu không cấu hình workflow / BR08). |
| `POST` | `/{id}/recall/` | `AR.ADJUSTMENT_VOUCHER.SUBMIT` | Thu hồi chứng từ đang chờ duyệt về `DRAFT` (AF05). |
| `POST` | `/{id}/approve/` | `AR.ADJUSTMENT_VOUCHER.APPROVE` | Phê duyệt chứng từ điều chỉnh. |
| `POST` | `/{id}/reject/` | `AR.ADJUSTMENT_VOUCHER.APPROVE` | Từ chối duyệt chứng từ (kèm `reason`). |
| `POST` | `/{id}/request-revision/` | `AR.ADJUSTMENT_VOUCHER.APPROVE` | Yêu cầu chỉnh sửa chứng từ (kèm `reason`). |
| `POST` | `/{id}/cancel/` | `AR.ADJUSTMENT_VOUCHER.CANCEL` | Hủy chứng từ chưa ghi sổ (kèm `reason` / AF05). |
| `POST` | `/{id}/post/` | `AR.ADJUSTMENT_VOUCHER.POST` | Ghi sổ điều chỉnh, cập nhật công nợ và sinh bút toán GL (Bước 7-8). |
| `POST` | `/{id}/unpost/` | `AR.ADJUSTMENT_VOUCHER.UNPOST` | Bỏ ghi sổ, hoàn tác bút toán GL và phục hồi công nợ (AF06). |

---

## 5. Bảng Đối chiếu Quy tắc Nghiệp vụ (Business Rules)

| Mã BR | Tóm tắt quy tắc | Hiện thực hóa trong Backend | Trạng thái |
| :--- | :--- | :--- | :--- :---: |
| **BR01** | Kiểm tra quyền IAM và phạm vi dữ liệu chi nhánh | `DebtAdjustmentVoucherPermission` kiểm tra IAM codes và phân quyền chi nhánh. | ✅ Đạt |
| **BR02** | Mỗi chứng từ 1 loại điều chỉnh, 1 KH, 1 loại tiền, 1 TK 131 | Ràng buộc duy nhất trên header; kiểm tra toàn bộ dòng phải khớp đối tượng và tài khoản. | ✅ Đạt |
| **BR03** | Có lý do và tài liệu căn cứ; không sửa trực tiếp nguồn | Bắt buộc `adjustment_reason` và `document_basis`; lưu chứng từ riêng độc lập. | ✅ Đạt |
| **BR04** | Tăng tạo Receivable mới; Giảm liên kết khoản còn dư | Tăng tạo `Receivable` mới (`created_receivable`); Giảm bắt buộc chọn khoản `OPEN`/`PARTIALLY_PAID`. | ✅ Đạt |
| **BR05** | Tổng giảm không vượt số dư; kiểm tra lại khi ghi sổ | Kiểm tra cộng dồn tại lúc lưu và kiểm tra khóa `select_for_update` khi ghi sổ. | ✅ Đạt |
| **BR06** | Không tạo số dư phải thu âm; chặn giảm khoản đã hết nợ | Chặn chọn khoản có `balance <= 0`; chặn giảm vượt số dư còn lại của khoản và từng đợt. | ✅ Đạt |
| **BR07** | Lưu Nháp không cập nhật công nợ và không giữ chỗ số dư | `DRAFT` không tạo bút toán và không thay đổi `balance` của Receivable. | ✅ Đạt |
| **BR08** | Điều kiện ghi sổ (APPROVED hoặc DRAFT nếu không workflow) | Kiểm tra `approval_required`: nếu True yêu cầu `APPROVED`, nếu False cho ghi sổ từ `DRAFT`. | ✅ Đạt |
| **BR09** | Bút toán GL: Tăng Nợ 131/Có đối ứng; Giảm Nợ đối ứng/Có 131 | Sinh `JournalEntry` đúng cặp đối ứng; không phát sinh thu/chi tiền mặt hay ngân hàng. | ✅ Đạt |
| **BR10** | Tỷ giá ghi sổ còn lại; giảm một phần tính theo tỷ lệ | Giảm công nợ lấy tỷ giá ghi sổ của `Receivable`; quy đổi tỷ lệ chính xác. | ✅ Đạt |
| **BR11** | Trả lại hàng, giảm giá xử lý tại nghiệp vụ tương ứng | Không cho ghi nhận trùng công nợ đã phát sinh từ các phân hệ bán hàng / hóa đơn. | ✅ Đạt |
| **BR12** | Sai sót chứng từ nguồn xử lý tại chứng từ nguồn | Không dùng điều chỉnh công nợ để che sai lệch doanh thu hoặc thuế. | ✅ Đạt |
| **BR13** | Không bỏ ghi sổ khoản tăng đã có thu tiền, phân bổ, bù trừ | Kiểm tra chặn `unpost` nếu `created_receivable` đã có `allocations` hoặc `netting_lines`. | ✅ Đạt |
| **BR14** | Bút toán & công nợ thành công đồng thời, Idempotent | Bọc trong `@transaction.atomic`; gọi lặp `post` trả về cùng kết quả; lưu Audit Log. | ✅ Đạt |
