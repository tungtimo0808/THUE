# Tài liệu bảng dữ liệu và API phân hệ General Ledger

> Tài liệu tham chiếu bảng dữ liệu, API và quy trình GL theo code hiện tại.

## 1. Phạm vi

Tài liệu này mô tả cấu trúc dữ liệu và API đang được cài đặt trong app `general_ledger`.

- Base URL: `/api/v1/general-ledger/`
- Xác thực: JWT.
- Dữ liệu được tách theo doanh nghiệp (`company`).
- Hầu hết request phải truyền `company_id=<uuid>` trong query string.
- Request tạo mới phải truyền trường `company` trong JSON body.
- Người dùng thường phải có IAM Permission và Data Scope phù hợp. Superuser được phép bỏ qua bước kiểm tra này.
- Các thao tác nghiệp vụ quan trọng được ghi Audit Log.

## 2. Tổng quan nhóm bảng

| Nhóm | Bảng | Vai trò |
| --- | --- | --- |
| Hệ thống tài khoản | `gl_account_class` | Phân loại tài khoản theo tính chất Nợ/Có |
| Hệ thống tài khoản | `gl_chart_of_accounts` | Danh mục hệ thống tài khoản áp dụng cho doanh nghiệp |
| Hệ thống tài khoản | `gl_account` | Tài khoản kế toán và cấu trúc cây cha-con |
| Kỳ và ngân sách | `gl_accounting_period` | Kỳ kế toán, trạng thái mở/đóng |
| Kỳ và ngân sách | `gl_budget_line` | Ngân sách theo tài khoản, kỳ và chiều quản trị |
| Bút toán | `gl_journal_entry` | Phần đầu của chứng từ/bút toán GL |
| Bút toán | `gl_journal_line` | Các dòng Nợ/Có của bút toán |
| Bút toán | `gl_journal_approval` | Lịch sử gửi duyệt, duyệt và từ chối |
| Tổng hợp | `gl_account_balance` | Số dư đầu kỳ, phát sinh và cuối kỳ |
| Phân bổ | `gl_allocation_rule` | Quy tắc phân bổ |
| Phân bổ | `gl_allocation_destination` | Tài khoản/chiều nhận phân bổ và tỷ lệ |
| Phân bổ | `gl_allocation_run` | Lịch sử từng lần chạy phân bổ |
| Kết chuyển | `gl_closing_rule` | Quy tắc kết chuyển tài khoản |
| Kết chuyển | `gl_closing_run` | Lịch sử từng lần chạy kết chuyển |
| Đối chiếu | `gl_reconciliation` | Kết quả đối chiếu GL với phân hệ nguồn |

## 3. Quan hệ dữ liệu chính

```text
Company
├── AccountClass
├── ChartOfAccounts ──< Account ──< JournalLine
│                         ├──< BudgetLine
│                         ├──< AccountBalance
│                         ├──< AllocationRule / AllocationDestination
│                         └──< ClosingRule
├── AccountingPeriod
│   ├──< BudgetLine
│   ├──< JournalEntry ──< JournalLine
│   │                     └──< JournalApproval
│   ├──< AccountBalance
│   ├──< AllocationRun ── JournalEntry
│   ├──< ClosingRun ───── JournalEntry
│   └──< GlReconciliation
└── Branch / Department / Project / CostCenter / Warehouse / Party
    được dùng làm các chiều hạch toán và quản trị.
```

Ký hiệu `──<` nghĩa là quan hệ một-nhiều.

## 4. Giải thích chi tiết các bảng

### 4.1. `gl_account_class` — Phân loại tài khoản

Mục đích: phân nhóm tài khoản kế toán và xác định bản chất số dư thông thường.

| Trường | Kiểu/quan hệ | Giải thích |
| --- | --- | --- |
| `id` | UUID, PK | Mã định danh |
| `company_id` | FK → Company | Doanh nghiệp sở hữu dữ liệu |
| `code` | varchar(30) | Mã loại tài khoản |
| `name` | varchar(150) | Tên loại tài khoản |
| `normal_balance` | `DEBIT`/`CREDIT` | Bên có số dư thông thường |

Ràng buộc: `code` duy nhất trong từng doanh nghiệp.

### 4.2. `gl_chart_of_accounts` — Hệ thống tài khoản

Mục đích: quản lý một hoặc nhiều bộ hệ thống tài khoản của doanh nghiệp theo thời gian hiệu lực.

| Trường | Giải thích |
| --- | --- |
| `company_id` | Doanh nghiệp áp dụng |
| `code`, `name` | Mã và tên hệ thống tài khoản |
| `accounting_regime` | Chế độ kế toán, mặc định `TT99` |
| `effective_from`, `effective_to` | Khoảng thời gian hiệu lực |
| `is_default` | Có phải hệ thống mặc định hay không |
| `status` | Trạng thái sử dụng, mặc định `ACTIVE` |

Ràng buộc: mã duy nhất theo doanh nghiệp; ngày kết thúc không được trước ngày bắt đầu.

### 4.3. `gl_account` — Tài khoản kế toán

Mục đích: lưu cây tài khoản tổng hợp/chi tiết và các chiều bắt buộc khi hạch toán.

| Nhóm trường | Trường | Giải thích |
| --- | --- | --- |
| Phạm vi | `company_id` | Doanh nghiệp sở hữu |
| Phân loại | `chart_of_accounts_id`, `account_class_id` | Hệ thống và loại tài khoản |
| Cấu trúc cây | `parent_id`, `account_level` | Tài khoản cha và cấp tài khoản |
| Nhận diện | `code`, `name` | Số hiệu và tên tài khoản |
| Tính chất | `account_type`, `normal_balance` | Loại tài khoản và bên số dư thông thường |
| Pháp định | `statutory_account_code`, `is_statutory_account` | Liên hệ với tài khoản theo chế độ kế toán |
| Hạch toán | `is_postable` | `false` đối với tài khoản tổng hợp không được ghi trực tiếp |
| Chiều bắt buộc | `requires_party`, `requires_project`, `requires_cost_center`, `requires_warehouse` | Yêu cầu nhập đối tượng tương ứng trên dòng bút toán |
| Trạng thái | `status` | Thường dùng `ACTIVE`/`INACTIVE` |

Ràng buộc chính:

- Mã tài khoản duy nhất trong doanh nghiệp.
- Tài khoản, loại tài khoản, hệ thống tài khoản và tài khoản cha phải cùng doanh nghiệp.
- Tài khoản cha phải cùng hệ thống tài khoản.
- Không cho phép cây tài khoản tạo chu trình.
- API không hỗ trợ xóa; nên chuyển trạng thái sang `INACTIVE`.
- Không cho đổi mã trực tiếp khi tài khoản đang `ACTIVE`.

### 4.4. `gl_accounting_period` — Kỳ kế toán

| Trường | Giải thích |
| --- | --- |
| `company_id` | Doanh nghiệp |
| `code` | Mã kỳ, ví dụ `2026-09` |
| `fiscal_year`, `period_number` | Năm tài chính và số thứ tự kỳ |
| `start_date`, `end_date` | Ngày bắt đầu/kết thúc |
| `status` | `OPEN` hoặc `CLOSED` |
| `closed_by`, `closed_at` | Người và thời điểm đóng kỳ |
| `reopened_by`, `reopened_at`, `reopen_reason` | Thông tin mở lại kỳ |

Ràng buộc: mã kỳ và cặp `(fiscal_year, period_number)` duy nhất theo doanh nghiệp; `period_number` từ 1 đến 99; ngày kết thúc không trước ngày bắt đầu.

### 4.5. `gl_budget_line` — Dòng ngân sách

Mục đích: lưu hạn mức ngân sách theo kỳ, tài khoản và các chiều quản trị.

| Trường | Giải thích |
| --- | --- |
| `company_id`, `period_id`, `account_id` | Doanh nghiệp, kỳ và tài khoản |
| `branch_id`, `department_id` | Chi nhánh/phòng ban, không bắt buộc |
| `project_id`, `cost_center_id` | Dự án/trung tâm chi phí, không bắt buộc |
| `amount` | Giá trị ngân sách |
| `allow_negative` | Cho phép giá trị âm |
| `notes` | Ghi chú |
| `created_at`, `updated_at` | Thời gian tạo/cập nhật |

Ràng buộc: không trùng hoàn toàn bộ chiều `(period, account, branch, department, project, cost_center)`; số tiền không âm trừ khi `allow_negative=true`; tất cả chiều phải cùng doanh nghiệp.

### 4.6. `gl_journal_entry` — Đầu bút toán

Mục đích: lưu thông tin chung, nguồn phát sinh, trạng thái workflow và tổng tiền của một bút toán.

| Nhóm | Trường | Giải thích |
| --- | --- | --- |
| Phạm vi | `company_id`, `branch_id`, `period_id` | Doanh nghiệp, chi nhánh, kỳ |
| Chứng từ | `number`, `posting_date`, `document_date`, `description` | Số, ngày hạch toán, ngày chứng từ, diễn giải |
| Loại | `entry_type` | `MANUAL`, `SUBLEDGER`, `ALLOCATION`, `CLOSING`, `ADJUSTMENT`, `REVERSAL`, `OPENING` |
| Nguồn | `source_module`, `source_event_id`, `source_entity_type`, `source_entity_id` | Thông tin truy vết về nghiệp vụ nguồn |
| Liên kết | `original_entry_id` | Bút toán gốc đối với điều chỉnh/đảo |
| Workflow | `status`, `workflow_snapshot` | Trạng thái và cấu hình duyệt tại thời điểm gửi |
| Tổng tiền | `total_debit`, `total_credit` | Tổng Nợ/Có, được tính từ các dòng |
| Người xử lý | `created_by`, `approved_by`, `posted_by` | Người tạo, duyệt, ghi sổ |
| Thời gian | `submitted_at`, `approved_at`, `posted_at`, `created_at`, `updated_at` | Các mốc nghiệp vụ |

Trạng thái chuẩn:

```text
DRAFT → PENDING_APPROVAL → APPROVED → POSTED
             └──────────→ REJECTED
DRAFT/REJECTED ─────────→ CANCELLED
POSTED ─────────────────→ REVERSED
```

Ràng buộc: số bút toán duy nhất theo doanh nghiệp; `source_event_id` duy nhất toàn hệ thống để chống sinh trùng từ phân hệ; tổng Nợ/Có không âm.

### 4.7. `gl_journal_line` — Dòng bút toán

| Nhóm | Trường | Giải thích |
| --- | --- | --- |
| Liên kết | `entry_id`, `line_no`, `account_id` | Bút toán, số dòng, tài khoản |
| Số tiền | `debit`, `credit` | Tiền Nợ hoặc Có; mỗi dòng chỉ được ghi một bên |
| Ngoại tệ | `currency_id`, `foreign_amount`, `exchange_rate` | Loại tiền, nguyên tệ, tỷ giá |
| Nội dung | `description` | Diễn giải dòng |
| Chiều | `party_id`, `department_id`, `project_id`, `cost_center_id`, `warehouse_id` | Chiều hạch toán chi tiết |
| Mở rộng | `dimensions` | JSON cho các chiều động khác |

Ràng buộc: `line_no` duy nhất trong bút toán; chỉ Nợ hoặc Có được lớn hơn 0; tỷ giá phải lớn hơn 0; chiều dữ liệu phải cùng doanh nghiệp; phải nhập đủ chiều mà tài khoản yêu cầu.

### 4.8. `gl_journal_approval` — Lịch sử phê duyệt

| Trường | Giải thích |
| --- | --- |
| `company_id`, `entry_id` | Doanh nghiệp và bút toán |
| `level` | Cấp phê duyệt |
| `decision` | `SUBMITTED`, `APPROVED` hoặc `REJECTED` |
| `actor_id` | Người thực hiện |
| `comment` | Ý kiến; bắt buộc khi từ chối |
| `decided_at` | Thời điểm quyết định |

Bảng này là lịch sử nghiệp vụ, chỉ đọc qua API.

### 4.9. `gl_account_balance` — Số dư tài khoản

| Trường | Giải thích |
| --- | --- |
| `company_id`, `period_id`, `account_id`, `branch_id` | Phạm vi số dư |
| `opening_debit`, `opening_credit` | Số dư đầu kỳ |
| `period_debit`, `period_credit` | Phát sinh trong kỳ |
| `closing_debit`, `closing_credit` | Số dư cuối kỳ |
| `updated_at` | Lần cập nhật gần nhất |

Mỗi tổ hợp `(period, account, branch)` chỉ có một dòng. Bảng được cập nhật khi ghi sổ/đảo bút toán hoặc tổng hợp lại, không được nhập tay qua API.

### 4.10. `gl_allocation_rule` — Quy tắc phân bổ

| Trường | Giải thích |
| --- | --- |
| `company_id`, `code`, `name` | Doanh nghiệp, mã và tên quy tắc |
| `source_account_id` | Tài khoản lấy số dư làm cơ sở |
| `offset_account_id` | Tài khoản đối ứng khi tạo bút toán |
| `method` | Hiện hỗ trợ `FIXED_PERCENT` |
| `is_active` | Quy tắc còn hiệu lực |
| `created_at` | Thời gian tạo |

Mã quy tắc duy nhất theo doanh nghiệp.

### 4.11. `gl_allocation_destination` — Đích phân bổ

| Trường | Giải thích |
| --- | --- |
| `rule_id` | Quy tắc phân bổ |
| `account_id` | Tài khoản nhận phân bổ |
| `department_id`, `project_id`, `cost_center_id` | Chiều nhận phân bổ |
| `percentage` | Tỷ lệ lớn hơn 0 và không quá 100 |

Tổng tỷ lệ của tất cả đích trong một quy tắc phải bằng 100%.

### 4.12. `gl_allocation_run` — Lần chạy phân bổ

| Trường | Giải thích |
| --- | --- |
| `company_id`, `rule_id`, `period_id` | Phạm vi chạy |
| `idempotency_key` | Khóa duy nhất chống chạy trùng |
| `amount` | Tổng giá trị đã phân bổ |
| `entry_id` | Bút toán GL được tự động tạo và ghi sổ |
| `created_by`, `created_at` | Người và thời điểm chạy |

### 4.13. `gl_closing_rule` — Quy tắc kết chuyển

| Trường | Giải thích |
| --- | --- |
| `company_id`, `code`, `name` | Doanh nghiệp, mã, tên |
| `source_account_id` | Tài khoản cần kết chuyển hết số dư |
| `destination_account_id` | Tài khoản nhận kết chuyển |
| `sequence` | Thứ tự chạy |
| `is_active` | Còn hiệu lực |

Mã quy tắc duy nhất theo doanh nghiệp.

### 4.14. `gl_closing_run` — Lần chạy kết chuyển

| Trường | Giải thích |
| --- | --- |
| `company_id`, `rule_id`, `period_id` | Phạm vi chạy |
| `entry_id` | Bút toán kết chuyển tự động |
| `created_by`, `created_at` | Người và thời điểm chạy |

Một quy tắc chỉ được chạy một lần trong một kỳ.

### 4.15. `gl_reconciliation` — Đối chiếu GL

| Trường | Giải thích |
| --- | --- |
| `company_id`, `period_id` | Doanh nghiệp và kỳ |
| `source_module` | Phân hệ nguồn như AP, AR, CASH, BANK, INV, FA, TAX |
| `account_id` | Tài khoản cần đối chiếu |
| `subledger_amount` | Giá trị từ phân hệ chi tiết |
| `gl_amount` | Giá trị tính từ các dòng GL đã ghi sổ |
| `difference` | `gl_amount - subledger_amount` |
| `status` | `MATCHED` hoặc `VARIANCE` |
| `details` | JSON chứa chi tiết/chứng cứ xử lý |
| `resolved` | Chênh lệch đã được xử lý hay chưa |
| `created_by`, `created_at` | Người và thời điểm đối chiếu |

## 5. Quy ước API chung

### 5.1. Header

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Khi sửa dữ liệu master, có thể truyền thêm:

```http
X-Audit-Reason: Lý do thay đổi
```

### 5.2. CRUD chuẩn

Với resource cho phép đầy đủ CRUD:

| Method | URL | Ý nghĩa | Thành công |
| --- | --- | --- | --- |
| `GET` | `/<resource>/?company_id=...` | Danh sách | 200 |
| `POST` | `/<resource>/?company_id=...` | Tạo mới | 201 |
| `GET` | `/<resource>/<id>/?company_id=...` | Chi tiết | 200 |
| `PUT` | `/<resource>/<id>/?company_id=...` | Thay toàn bộ | 200 |
| `PATCH` | `/<resource>/<id>/?company_id=...` | Sửa một phần | 200 |
| `DELETE` | `/<resource>/<id>/?company_id=...` | Xóa nếu nghiệp vụ cho phép | 204 |

Các tham số DRF thường dùng: `search`, `ordering`, `page` nếu dự án bật phân trang.

## 6. Danh sách API

### 6.1. Hệ thống tài khoản

| Resource | Endpoint | Method | Permission | Ghi chú |
| --- | --- | --- | --- | --- |
| Loại tài khoản | `/account-classes/` | GET, POST, PUT, PATCH | `MD.ACCOUNT.VIEW/CREATE/EDIT` | Không hỗ trợ DELETE |
| Hệ thống tài khoản | `/charts-of-accounts/` | GET, POST, PUT, PATCH | `MD.ACCOUNT.VIEW/CREATE/EDIT` | Không hỗ trợ DELETE |
| Tài khoản | `/accounts/` | GET, POST, PUT, PATCH | `MD.ACCOUNT.VIEW/CREATE/EDIT` | Không hỗ trợ DELETE |

Hỗ trợ `search=...` theo mã/tên và `ordering=code` hoặc `ordering=name`.

Ví dụ tạo tài khoản:

```json
{
  "company": "<company-uuid>",
  "chart_of_accounts": "<chart-uuid>",
  "account_class": "<class-uuid>",
  "parent": "<parent-account-uuid-or-null>",
  "code": "1111",
  "name": "Tiền Việt Nam",
  "account_level": 2,
  "account_type": "ASSET",
  "normal_balance": "DEBIT",
  "is_postable": true,
  "requires_party": false,
  "requires_project": false,
  "requires_cost_center": false,
  "requires_warehouse": false,
  "status": "ACTIVE"
}
```

### 6.2. Kỳ kế toán

| Method | Endpoint | Permission | Ý nghĩa |
| --- | --- | --- | --- |
| CRUD | `/periods/` | `GL.PERIOD.VIEW/CREATE/EDIT/DELETE` | Quản lý kỳ |
| POST | `/periods/<id>/aggregate/` | `GL.BALANCE.AGGREGATE` | Tính lại số dư từ bút toán đã ghi sổ |
| POST | `/periods/<id>/close/` | `GL.PERIOD.CLOSE_PERIOD` | Đóng kỳ |
| POST | `/periods/<id>/reopen/` | `GL.PERIOD.REOPEN_PERIOD` | Mở lại kỳ |

Body mở lại kỳ:

```json
{ "reason": "Điều chỉnh theo kết quả kiểm toán" }
```

Điều kiện đóng kỳ:

- Kỳ đang `OPEN`.
- Không còn bút toán chưa hoàn tất.
- Không còn đối chiếu `VARIANCE` chưa xử lý.
- Tổng phát sinh Nợ và Có sau tổng hợp phải cân bằng.

### 6.3. Ngân sách

| Method | Endpoint | Permission | Ý nghĩa |
| --- | --- | --- | --- |
| CRUD | `/budgets/` | `GL.BUDGET.VIEW/CREATE/EDIT/DELETE` | Quản lý dòng ngân sách |

Tìm kiếm theo mã/tên tài khoản, mã kỳ và ghi chú. Sắp xếp theo `amount`, `period__start_date`, `created_at`.

### 6.4. Bút toán

| Method | Endpoint | Permission | Ý nghĩa |
| --- | --- | --- | --- |
| CRUD | `/journals/` | `GL.JOURNAL.VIEW/CREATE/EDIT/DELETE` | Tạo, xem, sửa và xóa bút toán khi được phép |
| POST | `/journals/<id>/submit/` | `GL.JOURNAL.SUBMIT` | Gửi duyệt |
| POST | `/journals/<id>/approve/` | `GL.JOURNAL.APPROVE` | Duyệt |
| POST | `/journals/<id>/reject/` | `GL.JOURNAL.APPROVE` | Từ chối |
| POST | `/journals/<id>/post/` | `GL.JOURNAL.POST` | Ghi sổ |
| POST | `/journals/<id>/reverse/` | `GL.JOURNAL.REVERSE` | Tạo và ghi sổ bút toán đảo |
| POST | `/journals/<id>/cancel/` | `GL.JOURNAL.CANCEL` | Hủy bút toán nháp/bị từ chối |

Bộ lọc danh sách: `period_id`, `status`, `entry_type`, `source_module`, `branch_id`, `account_id`, `date_from`, `date_to`, `search`, `ordering`.

Payload tạo bút toán tối thiểu:

```json
{
  "company": "<company-uuid>",
  "branch": "<branch-uuid>",
  "period": "<period-uuid>",
  "number": "JV-2026-0001",
  "entry_type": "MANUAL",
  "posting_date": "2026-09-25",
  "document_date": "2026-09-25",
  "description": "Chi phí phát sinh",
  "source_module": "",
  "lines": [
    {
      "line_no": 1,
      "account": "<expense-account-uuid>",
      "debit": "1000000.0000",
      "credit": "0",
      "currency": "<currency-uuid>",
      "exchange_rate": "1"
    },
    {
      "line_no": 2,
      "account": "<cash-account-uuid>",
      "debit": "0",
      "credit": "1000000.0000",
      "currency": "<currency-uuid>",
      "exchange_rate": "1"
    }
  ]
}
```

Body gửi duyệt có thể chứa snapshot workflow:

```json
{
  "workflow_snapshot": {
    "version": "DEFAULT",
    "levels": 1,
    "allow_self_approval": false,
    "allow_creator_posting": false
  }
}
```

Body duyệt/từ chối:

```json
{ "comment": "Đồng ý" }
```

Khi từ chối, `comment` là bắt buộc.

Body đảo bút toán:

```json
{
  "period": "<open-period-uuid>",
  "posting_date": "2026-09-26",
  "number": "REV-JV-2026-0001",
  "reason": "Sửa sai tài khoản"
}
```

Quy tắc quan trọng:

- Chỉ sửa/xóa bút toán `DRAFT` hoặc `REJECTED` trong kỳ mở.
- Gửi duyệt sẽ kiểm tra cân đối Nợ/Có, kỳ, tài khoản và chiều bắt buộc.
- Mặc định người tạo không được tự duyệt hoặc tự ghi sổ.
- Chỉ bút toán `APPROVED` mới được ghi sổ.
- Bút toán `POSTED` không sửa trực tiếp; phải đảo bằng một bút toán mới có liên kết tới bút toán gốc.

### 6.5. Số dư, bảng cân đối và sổ cái

| Method | Endpoint | Permission | Ý nghĩa |
| --- | --- | --- | --- |
| GET | `/balances/` | `GL.BALANCE.VIEW` | Danh sách số dư |
| GET | `/balances/<id>/` | `GL.BALANCE.VIEW` | Chi tiết số dư |
| GET | `/balances/trial-balance/` | `GL.BALANCE.VIEW` | Bảng cân đối số phát sinh và tổng cộng |
| GET | `/balances/ledger/` | `GL.LEDGER.VIEW` | Sổ chi tiết của một tài khoản |

Bộ lọc số dư: `company_id`, `period_id`, `account_id`, `branch_id`.

Ví dụ tra sổ tài khoản:

```http
GET /api/v1/general-ledger/balances/ledger/?company_id=<company>&account_id=<account>&period_id=<period>
```

Kết quả mỗi dòng gồm `entry_id`, `number`, `posting_date`, `description`, `debit`, `credit`, `source_module`, `source_entity_type`, `source_entity_id`.

### 6.6. Phân bổ

| Method | Endpoint | Permission | Ý nghĩa |
| --- | --- | --- | --- |
| CRUD | `/allocation-rules/` | `GL.ALLOCATION.VIEW/CREATE/EDIT/DELETE` | Quản lý quy tắc |
| POST | `/allocation-rules/<id>/run/` | `GL.ALLOCATION.RUN` | Chạy phân bổ |
| GET | `/allocation-runs/` | `GL.ALLOCATION.VIEW` | Xem lịch sử chạy |
| GET | `/allocation-runs/<id>/` | `GL.ALLOCATION.VIEW` | Chi tiết lần chạy |

Ví dụ tạo quy tắc:

```json
{
  "company": "<company-uuid>",
  "code": "PB01",
  "name": "Phân bổ chi phí quản lý",
  "source_account": "<source-account-uuid>",
  "offset_account": "<offset-account-uuid>",
  "method": "FIXED_PERCENT",
  "is_active": true,
  "destinations": [
    { "account": "<destination-1>", "department": "<department-1>", "percentage": "60" },
    { "account": "<destination-2>", "department": "<department-2>", "percentage": "40" }
  ]
}
```

Ví dụ chạy:

```json
{
  "company": "<company-uuid>",
  "period": "<period-uuid>",
  "idempotency_key": "ALLOC:2026-09:PB01"
}
```

Hệ thống lấy số dư tài khoản nguồn, tạo bút toán `ALLOCATION`, tự ghi sổ và lưu `AllocationRun`. `idempotency_key` ngăn cùng nghiệp vụ chạy hai lần.

### 6.7. Kết chuyển cuối kỳ

| Method | Endpoint | Permission | Ý nghĩa |
| --- | --- | --- | --- |
| CRUD | `/closing-rules/` | `GL.CLOSING.VIEW/CREATE/EDIT/DELETE` | Quản lý quy tắc kết chuyển |
| POST | `/closing-rules/<id>/run/` | `GL.CLOSING.RUN` | Chạy kết chuyển |
| GET | `/closing-runs/` | `GL.CLOSING.VIEW` | Lịch sử chạy |
| GET | `/closing-runs/<id>/` | `GL.CLOSING.VIEW` | Chi tiết lần chạy |

Payload chạy:

```json
{
  "company": "<company-uuid>",
  "period": "<period-uuid>"
}
```

Hệ thống xác định số dư ròng của tài khoản nguồn, tạo bút toán `CLOSING`, ghi sổ và ngăn chạy lại cùng quy tắc trong cùng kỳ.

### 6.8. Đối chiếu

| Method | Endpoint | Permission | Ý nghĩa |
| --- | --- | --- | --- |
| GET | `/reconciliations/` | `GL.RECONCILIATION.VIEW` | Danh sách kết quả |
| GET | `/reconciliations/<id>/` | `GL.RECONCILIATION.VIEW` | Chi tiết |
| POST | `/reconciliations/run/` | `GL.RECONCILIATION.RUN` | Chạy đối chiếu |
| POST | `/reconciliations/<id>/resolve/` | `GL.RECONCILIATION.RESOLVE` | Đánh dấu xử lý chênh lệch |

Payload chạy đối chiếu:

```json
{
  "company": "<company-uuid>",
  "period": "<period-uuid>",
  "account": "<account-uuid>",
  "source_module": "AP",
  "subledger_amount": "1000000.0000",
  "details": {
    "source_document_count": 10
  }
}
```

Payload xử lý chênh lệch:

```json
{ "reason": "Đã bổ sung bút toán còn thiếu" }
```

API `resolve` chỉ áp dụng cho bản ghi `VARIANCE` và bắt buộc có lý do. API không tự sửa dữ liệu GL hoặc phân hệ nguồn.

### 6.9. Lịch sử phê duyệt

| Method | Endpoint | Permission | Ý nghĩa |
| --- | --- | --- | --- |
| GET | `/approvals/` | `GL.APPROVAL.VIEW` | Danh sách lịch sử duyệt |
| GET | `/approvals/<id>/` | `GL.APPROVAL.VIEW` | Chi tiết quyết định |

Đây là API chỉ đọc. Mỗi lần submit/approve/reject sẽ tự sinh dữ liệu lịch sử.

## 7. Mapping Use Case BA với bảng và API

| Use Case | Bảng chính | API chính |
| --- | --- | --- |
| UC-GL-01 Quản lý hệ thống tài khoản | `gl_account_class`, `gl_chart_of_accounts`, `gl_account` | `/account-classes/`, `/charts-of-accounts/`, `/accounts/` |
| UC-GL-02 Quản lý ngân sách | `gl_budget_line` | `/budgets/` |
| UC-GL-03 Nhập bút toán trực tiếp | `gl_journal_entry`, `gl_journal_line` | `POST /journals/` |
| UC-GL-04 Tiếp nhận từ phân hệ | `gl_journal_entry`, `gl_journal_line` | `POST /journals/`, dùng `source_module` và `source_event_id` |
| UC-GL-05 Quản lý bút toán | Bút toán và phê duyệt | `/journals/...` actions, `/approvals/` |
| UC-GL-06 Phân bổ | Ba bảng `gl_allocation_*` và bút toán | `/allocation-rules/`, `/allocation-runs/` |
| UC-GL-07 Kết chuyển | Hai bảng `gl_closing_*` và bút toán | `/closing-rules/`, `/closing-runs/` |
| UC-GL-08 Điều chỉnh/đảo | `gl_journal_entry.original_entry_id` | `/journals/<id>/reverse/` |
| UC-GL-09 Tổng hợp số dư | `gl_account_balance` | `/periods/<id>/aggregate/`, `/balances/` |
| UC-GL-10 Đóng/mở kỳ | `gl_accounting_period` | `/periods/<id>/close|reopen/` |
| UC-GL-11 Đối chiếu | `gl_reconciliation` | `/reconciliations/...` |
| UC-GL-12 Tra cứu sổ cái | Bút toán, dòng bút toán, số dư | `/journals/`, `/balances/trial-balance/`, `/balances/ledger/` |

## 8. Mã lỗi thường gặp

| HTTP | Ý nghĩa thường gặp |
| --- | --- |
| 400 | Dữ liệu sai, kỳ đóng, Nợ/Có không cân, sai trạng thái hoặc thiếu lý do |
| 401 | Chưa đăng nhập/token không hợp lệ |
| 403 | Thiếu Permission hoặc nằm ngoài Data Scope |
| 404 | Không tìm thấy hoặc đối tượng không thuộc `company_id` đã truyền |
| 405 | Method không được hỗ trợ, ví dụ DELETE tài khoản |
| 409 | Không được dùng trực tiếp trong code hiện tại; xung đột nghiệp vụ thường trả 400 |

## 9. Điểm cần lưu ý khi tích hợp

1. Luôn truyền cùng một doanh nghiệp ở query `company_id`, body `company` và các khóa ngoại.
2. Không tự cập nhật `gl_account_balance`; chỉ ghi sổ hoặc gọi aggregate.
3. Với giao dịch từ phân hệ, tạo `source_event_id` ổn định và duy nhất.
4. Không sửa bút toán đã ghi sổ; sử dụng API reverse.
5. Không nhập bút toán vào kỳ `CLOSED`.
6. Tách người tạo, người duyệt và người ghi sổ trừ khi workflow cho phép rõ ràng.
7. Khi chạy phân bổ, mỗi lần chạy phải có `idempotency_key` mới.
8. Trước khi đóng kỳ, xử lý hết bút toán dở dang và chênh lệch đối chiếu.
9. Dùng Swagger tại `/api/docs/` để thử request theo schema hiện hành.

## 10. Quy trình nghiệp vụ GL từ đầu đến cuối

### 10.1. Sơ đồ tổng quát

```text
Thiết lập doanh nghiệp và IAM
            ↓
Thiết lập hệ thống tài khoản
            ↓
Tạo và mở kỳ kế toán
            ↓
Khai báo ngân sách (nếu sử dụng)
            ↓
Phát sinh bút toán trực tiếp hoặc nhận từ phân hệ
            ↓
Kiểm tra → Gửi duyệt → Duyệt → Ghi sổ
            ↓
Cập nhật số dư và tra cứu sổ cái
            ↓
Phân bổ chi phí và kết chuyển cuối kỳ
            ↓
Tổng hợp lại số dư
            ↓
Đối chiếu GL với các phân hệ
            ↓
Lập/kiểm tra báo cáo
            ↓
Đóng kỳ
            ↓
Nếu có sai sót: mở lại kỳ hoặc đảo bút toán trong kỳ mở
            ↓
Ghi Audit Log và lưu lịch sử xuyên suốt quy trình
```

### 10.2. Bước 1 — Thiết lập doanh nghiệp, người dùng và quyền

Đây là dữ liệu nền phải tồn tại trước khi sử dụng GL.

1. Tạo doanh nghiệp, chi nhánh, phòng ban và đồng tiền kế toán.
2. Tạo tài khoản người dùng và gắn người dùng vào doanh nghiệp.
3. Cấp role, permission và data scope.
4. Tách quyền tạo, duyệt, ghi sổ, đảo bút toán và đóng kỳ cho các vai trò phù hợp.

Các quyền GL điển hình:

| Nhóm quyền | Mục đích |
| --- | --- |
| `MD.ACCOUNT.*` | Quản lý hệ thống tài khoản |
| `GL.PERIOD.*` | Quản lý, đóng và mở lại kỳ |
| `GL.JOURNAL.CREATE/EDIT` | Nhập và sửa bút toán nháp |
| `GL.JOURNAL.SUBMIT` | Gửi bút toán đi duyệt |
| `GL.JOURNAL.APPROVE` | Duyệt hoặc từ chối |
| `GL.JOURNAL.POST` | Ghi sổ |
| `GL.JOURNAL.REVERSE` | Đảo bút toán đã ghi sổ |
| `GL.ALLOCATION.RUN` | Chạy phân bổ |
| `GL.CLOSING.RUN` | Chạy kết chuyển |
| `GL.RECONCILIATION.RUN/RESOLVE` | Đối chiếu và xử lý chênh lệch |
| `GL.BALANCE.VIEW`, `GL.LEDGER.VIEW` | Xem số dư, bảng cân đối và sổ cái |

Kết quả đầu ra: người dùng chỉ thao tác được trên đúng doanh nghiệp và đúng chiều dữ liệu được cấp.

### 10.3. Bước 2 — Thiết lập hệ thống tài khoản

Thứ tự thực hiện:

1. Tạo loại tài khoản qua `POST /account-classes/`.
2. Tạo hệ thống tài khoản qua `POST /charts-of-accounts/`.
3. Tạo tài khoản tổng hợp trước, sau đó tạo các tài khoản chi tiết qua `POST /accounts/`.
4. Đánh dấu tài khoản tổng hợp `is_postable=false`.
5. Khai báo các chiều bắt buộc như đối tượng, dự án, trung tâm chi phí hoặc kho.
6. Kiểm tra cây tài khoản bằng `GET /accounts/?company_id=...&ordering=code`.

| Dữ liệu đầu vào | Bảng được ghi | Kết quả |
| --- | --- | --- |
| Loại và tính chất tài khoản | `gl_account_class` | Phân loại Nợ/Có |
| Bộ tài khoản và chế độ kế toán | `gl_chart_of_accounts` | Hệ thống tài khoản có hiệu lực |
| Tài khoản cha/con và chiều hạch toán | `gl_account` | Cây tài khoản sẵn sàng sử dụng |

Tài khoản đã phát sinh dữ liệu không nên xóa hoặc đổi mã; chuyển `status` thành `INACTIVE` và tạo tài khoản mới nếu cần.

### 10.4. Bước 3 — Tạo kỳ kế toán

Gọi `POST /periods/?company_id=...` với năm tài chính, số kỳ, ngày bắt đầu và ngày kết thúc.

```json
{
  "company": "<company-uuid>",
  "code": "2026-09",
  "fiscal_year": 2026,
  "period_number": 9,
  "start_date": "2026-09-01",
  "end_date": "2026-09-30",
  "status": "OPEN"
}
```

Kỳ mới phải ở trạng thái `OPEN` để nhận bút toán. Ngày hạch toán của mọi bút toán phải nằm trong khoảng ngày của kỳ.

### 10.5. Bước 4 — Khai báo ngân sách

Bước này là tùy chọn và phục vụ kiểm soát/quản trị.

1. Chọn kỳ và tài khoản.
2. Chọn các chiều quản trị: chi nhánh, phòng ban, dự án, trung tâm chi phí.
3. Nhập hạn mức.
4. Gọi `POST /budgets/`.

Hệ thống ghi `gl_budget_line`, ngăn tổ hợp chiều bị trùng và mặc định không cho ngân sách âm. Việc thay đổi ngân sách không làm thay đổi bút toán thực tế.

### 10.6. Bước 5 — Tiếp nhận nghiệp vụ phát sinh

Có hai nguồn bút toán.

#### A. Bút toán nhập trực tiếp tại GL

Kế toán tạo bút toán `entry_type=MANUAL` qua `POST /journals/` và nhập tối thiểu hai dòng Nợ/Có.

#### B. Bút toán từ phân hệ nghiệp vụ

AP, AR, CASH, BANK, INV, FA hoặc TAX gọi cùng API nhưng sử dụng:

- `entry_type=SUBLEDGER`;
- `source_module` để xác định phân hệ;
- `source_event_id` làm khóa chống ghi nhận trùng;
- `source_entity_type` và `source_entity_id` để truy vết chứng từ nguồn.

Khi tạo thành công:

- `gl_journal_entry` được tạo với trạng thái `DRAFT`;
- các dòng Nợ/Có được ghi vào `gl_journal_line`;
- `total_debit` và `total_credit` được tính từ các dòng;
- chưa có thay đổi chính thức đối với `gl_account_balance`.

### 10.7. Bước 6 — Kiểm tra và gửi duyệt

Người tạo có thể sửa bút toán khi trạng thái là `DRAFT` hoặc `REJECTED`. Sau khi hoàn thiện, gọi:

```http
POST /journals/<id>/submit/?company_id=<company>
```

Hệ thống kiểm tra:

1. Có ít nhất một dòng Nợ và một dòng Có.
2. Tổng Nợ bằng tổng Có và lớn hơn 0.
3. Kỳ đang mở và ngày hạch toán thuộc kỳ.
4. Tài khoản đang `ACTIVE` và cho phép hạch toán.
5. Các chiều bắt buộc của tài khoản đã được nhập.
6. Dữ liệu tài khoản, chi nhánh và chiều hạch toán cùng doanh nghiệp.

Nếu hợp lệ:

```text
JournalEntry: DRAFT/REJECTED → PENDING_APPROVAL
JournalApproval: tạo bản ghi SUBMITTED
Audit Log: ghi hành động SUBMIT
```

### 10.8. Bước 7 — Phê duyệt hoặc từ chối

Người có quyền duyệt gọi một trong hai API:

```http
POST /journals/<id>/approve/?company_id=<company>
POST /journals/<id>/reject/?company_id=<company>
```

Luồng duyệt:

- Hệ thống kiểm tra bút toán đang `PENDING_APPROVAL` và kỳ chưa đóng.
- Nếu workflow không cho phép, người tạo không được tự duyệt.
- Nếu có nhiều cấp, trạng thái tiếp tục là `PENDING_APPROVAL` cho tới cấp cuối.
- Khi cấp cuối duyệt, trạng thái chuyển thành `APPROVED`.
- Mỗi quyết định sinh một dòng trong `gl_journal_approval`.

Luồng từ chối:

- Bắt buộc nhập `comment`.
- Trạng thái chuyển thành `REJECTED`.
- Người tạo sửa bút toán và gửi duyệt lại.

### 10.9. Bước 8 — Ghi sổ

Người có quyền gọi:

```http
POST /journals/<id>/post/?company_id=<company>
```

Điều kiện:

- Bút toán đang `APPROVED`.
- Kỳ đang mở.
- Bút toán vẫn đáp ứng toàn bộ quy tắc cân đối và chiều hạch toán.
- Người tạo không được tự ghi sổ nếu workflow không cho phép.

Tác động dữ liệu:

1. Với từng dòng bút toán, hệ thống tìm hoặc tạo `gl_account_balance` theo kỳ, tài khoản và chi nhánh.
2. Cộng `debit` vào `period_debit` và `credit` vào `period_credit`.
3. Tính lại `closing_debit` hoặc `closing_credit` từ số dư đầu kỳ và phát sinh.
4. Chuyển bút toán thành `POSTED`.
5. Lưu `posted_by`, `posted_at` và Audit Log.

Chỉ từ thời điểm này số liệu mới trở thành số liệu kế toán chính thức.

### 10.10. Bước 9 — Tra cứu bút toán, số dư và sổ cái

Sau ghi sổ, người dùng có thể:

| Nhu cầu | API |
| --- | --- |
| Tìm bút toán | `GET /journals/` với các bộ lọc |
| Xem số dư theo tài khoản/kỳ/chi nhánh | `GET /balances/` |
| Xem bảng cân đối phát sinh | `GET /balances/trial-balance/` |
| Xem sổ chi tiết tài khoản | `GET /balances/ledger/` |
| Truy vết về nguồn | Đọc `source_module`, `source_entity_type`, `source_entity_id` |
| Xem lịch sử duyệt | `GET /approvals/` |

Dữ liệu tra cứu chỉ bao gồm bút toán đã có hiệu lực đối với số dư chính thức; API sổ cái đọc các bút toán `POSTED` và `REVERSED`.

### 10.11. Bước 10 — Phân bổ chi phí

Nếu doanh nghiệp sử dụng phân bổ:

1. Khai báo `AllocationRule` và danh sách `AllocationDestination`.
2. Bảo đảm tổng tỷ lệ đích bằng 100%.
3. Gọi `POST /allocation-rules/<id>/run/` với kỳ và `idempotency_key`.
4. Hệ thống lấy số dư ròng của tài khoản nguồn.
5. Hệ thống phân chia giá trị theo tỷ lệ, phần làm tròn được dồn vào dòng cuối.
6. Tự tạo bút toán `ALLOCATION`, ghi sổ và cập nhật số dư.
7. Ghi `gl_allocation_run` để liên kết quy tắc, kỳ và bút toán.

Không thể chạy khi kỳ đã đóng, quy tắc ngừng hoạt động, không có số dư nguồn hoặc khóa chạy đã tồn tại.

### 10.12. Bước 11 — Kết chuyển cuối kỳ

1. Khai báo các `ClosingRule` theo đúng `sequence`.
2. Chạy từng quy tắc qua `POST /closing-rules/<id>/run/`.
3. Hệ thống lấy số dư ròng của tài khoản nguồn.
4. Tạo bút toán `CLOSING` chuyển số dư sang tài khoản đích.
5. Tự ghi sổ bút toán và tạo `gl_closing_run`.

Một quy tắc không thể chạy hai lần trong cùng kỳ. Nếu cần chạy lại, quy trình hiện tại cần xử lý/đảo lần chạy trước theo chính sách nghiệp vụ trước khi chạy lại.

### 10.13. Bước 12 — Tổng hợp lại số dư

Gọi:

```http
POST /periods/<id>/aggregate/?company_id=<company>
```

Hệ thống:

1. Đưa phát sinh của các dòng số dư trong kỳ về 0.
2. Lấy lại toàn bộ dòng bút toán có trạng thái `POSTED` hoặc `REVERSED`.
3. Tổng hợp theo tài khoản và chi nhánh.
4. Tính lại số dư cuối kỳ.
5. Kiểm tra tổng phát sinh Nợ bằng tổng phát sinh Có.
6. Ghi Audit Log.

Aggregate dùng để tái lập dữ liệu tổng hợp từ dữ liệu bút toán nguồn; không thay đổi bản thân các bút toán.

### 10.14. Bước 13 — Đối chiếu với phân hệ nguồn

Với từng phân hệ và tài khoản cần đối chiếu:

1. Lấy giá trị chi tiết từ AP, AR, CASH, BANK, INV, FA hoặc TAX.
2. Gọi `POST /reconciliations/run/` với `subledger_amount`.
3. GL tính `gl_amount` từ các dòng đã ghi sổ.
4. Hệ thống tính `difference = gl_amount - subledger_amount`.
5. Kết quả là `MATCHED` nếu bằng 0, ngược lại là `VARIANCE`.

Nếu có chênh lệch:

- tra cứu bút toán/chứng từ nguồn;
- xác định nguyên nhân;
- tạo bút toán bổ sung hoặc đảo/điều chỉnh theo đúng nghiệp vụ;
- chạy đối chiếu lại;
- hoặc gọi `/reconciliations/<id>/resolve/` kèm lý do để ghi nhận việc xử lý.

Đánh dấu `resolved` không tự sửa số liệu.

### 10.15. Bước 14 — Kiểm tra báo cáo trước khi đóng kỳ

Kế toán thực hiện tối thiểu:

1. Kiểm tra bảng cân đối phát sinh.
2. Kiểm tra tổng Nợ bằng tổng Có.
3. Kiểm tra số dư bất thường theo tính chất tài khoản.
4. Kiểm tra tất cả bút toán trong kỳ đã hoàn tất.
5. Kiểm tra không còn đối chiếu chênh lệch chưa xử lý.
6. Truy vết thử từ số liệu báo cáo đến tài khoản, bút toán và chứng từ nguồn.

Các báo cáo thuộc module reporting có thể đọc số liệu GL sau khi bút toán đã `POSTED`.

### 10.16. Bước 15 — Đóng kỳ

Người có quyền đặc biệt gọi:

```http
POST /periods/<id>/close/?company_id=<company>
```

Hệ thống khóa bản ghi kỳ và kiểm tra:

- kỳ đang `OPEN`;
- không còn bút toán ở trạng thái chưa hoàn tất;
- không còn kết quả `VARIANCE` chưa được xử lý;
- số liệu tổng hợp cân bằng.

Sau khi hợp lệ:

```text
AccountingPeriod: OPEN → CLOSED
closed_by/closed_at: được ghi nhận
Audit Log: ghi CLOSE_PERIOD
```

Kỳ `CLOSED` không nhận bút toán mới, không cho sửa, ghi sổ hoặc tổng hợp lại.

### 10.17. Bước 16 — Sửa sai sau ghi sổ hoặc sau đóng kỳ

#### Trường hợp kỳ vẫn mở

Không sửa bút toán `POSTED` trực tiếp. Gọi `/journals/<id>/reverse/` với lý do, kỳ mở và ngày đảo.

Hệ thống:

1. Tạo bút toán `REVERSAL`.
2. Đổi Nợ thành Có và Có thành Nợ trên từng dòng.
3. Liên kết `original_entry` với bút toán gốc.
4. Tự ghi sổ bút toán đảo.
5. Chuyển bút toán gốc thành `REVERSED`.
6. Cập nhật số dư và Audit Log.

Sau đó, nếu cần, kế toán tạo một bút toán đúng mới và thực hiện lại luồng duyệt–ghi sổ.

#### Trường hợp kỳ đã đóng

Có hai hướng theo chính sách kế toán:

- ghi bút toán điều chỉnh/đảo vào một kỳ đang mở; hoặc
- người có quyền đặc biệt gọi `/periods/<id>/reopen/` với lý do, xử lý sai sót, đối chiếu lại và đóng kỳ lần nữa.

Mở lại kỳ không xóa bút toán hoặc lịch sử cũ.

### 10.18. Bảng tóm tắt tác động theo từng giai đoạn

| Giai đoạn | Trạng thái/dữ liệu trước | Hành động | Dữ liệu sau |
| --- | --- | --- | --- |
| Nhập bút toán | Chưa có | `POST /journals/` | Header/lines, trạng thái `DRAFT` |
| Gửi duyệt | `DRAFT` hoặc `REJECTED` | `/submit/` | `PENDING_APPROVAL`, lịch sử `SUBMITTED` |
| Duyệt | `PENDING_APPROVAL` | `/approve/` | `APPROVED` hoặc tiếp tục chờ cấp sau |
| Từ chối | `PENDING_APPROVAL` | `/reject/` | `REJECTED` |
| Ghi sổ | `APPROVED` | `/post/` | `POSTED`, cập nhật `gl_account_balance` |
| Đảo | `POSTED` | `/reverse/` | Bút toán đảo `POSTED`, bút toán gốc `REVERSED` |
| Phân bổ | Quy tắc + số dư nguồn | `/allocation-rules/<id>/run/` | Bút toán phân bổ và `gl_allocation_run` |
| Kết chuyển | Quy tắc + số dư nguồn | `/closing-rules/<id>/run/` | Bút toán kết chuyển và `gl_closing_run` |
| Tổng hợp | Các bút toán đã ghi sổ | `/periods/<id>/aggregate/` | Số dư được tính lại |
| Đối chiếu | GL + số chi tiết phân hệ | `/reconciliations/run/` | `MATCHED` hoặc `VARIANCE` |
| Đóng kỳ | `OPEN`, dữ liệu hoàn tất | `/periods/<id>/close/` | `CLOSED` |
| Mở lại | `CLOSED` | `/periods/<id>/reopen/` | `OPEN`, lưu lý do và người mở |

### 10.19. Ví dụ một chu trình hoàn chỉnh

Ví dụ doanh nghiệp ghi nhận chi phí tiền mặt 1.000.000 VND trong tháng 09/2026:

1. Tài khoản 6421 và 1111 đã được cấu hình và cho phép hạch toán.
2. Kỳ `2026-09` đang `OPEN`.
3. Kế toán tạo bút toán `JV-2026-0001`: Nợ 6421/Có 1111, số tiền 1.000.000.
4. Bút toán ở `DRAFT`; chưa ảnh hưởng số dư.
5. Kế toán gửi duyệt; trạng thái thành `PENDING_APPROVAL`.
6. Kế toán trưởng duyệt; trạng thái thành `APPROVED`.
7. Người ghi sổ thực hiện post; trạng thái thành `POSTED`.
8. Số phát sinh Nợ của 6421 tăng 1.000.000; phát sinh Có của 1111 tăng 1.000.000.
9. Cuối kỳ, doanh nghiệp chạy phân bổ nếu chi phí cần phân bổ cho các phòng ban.
10. Chạy kết chuyển chi phí sang tài khoản kết quả kinh doanh.
11. Tổng hợp số dư và đối chiếu với các phân hệ liên quan.
12. Kiểm tra bảng cân đối, báo cáo và đóng kỳ 09/2026.
13. Nếu phát hiện sai sau đó, có thẩm quyền mở lại kỳ hoặc thực hiện bút toán đảo ở kỳ đang mở theo chính sách.

