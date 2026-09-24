# THUẾ ERP — Database V2

> Tài liệu này đi cùng `THUE_ERP_DATABASE_V2.dbml`. Đây là **target physical model V2** đã audit về naming, PK/FK, nullability, unique/index, cascade, ownership module và khả năng truy vết kế toán.

## 1. Phạm vi và cơ sở thiết kế

Database này lấy **yêu cầu dự án** và **Thông tư 99/2025/TT-BTC** làm chuẩn nghiệp vụ kế toán. MISA chỉ có thể dùng để tham khảo UX/luồng sản phẩm khi cần, không phải nguồn của schema vật lý.

Các điểm pháp lý chính đã phản ánh vào thiết kế:

- TT99 Điều 8–10: mọi nghiệp vụ kinh tế, tài chính phải có chứng từ; doanh nghiệp có thể thiết kế/sửa mẫu nhưng phải bảo đảm đầy đủ, kịp thời, trung thực, minh bạch, kiểm tra/đối chiếu được.
- TT99 Điều 11: hệ thống tài khoản tại Phụ lục II là nền cho ghi sổ; doanh nghiệp có thể chi tiết/sửa đổi trong giới hạn không làm sai bản chất và BCTC.
- TT99 Điều 12–13: sổ kế toán phải căn cứ chứng từ; dữ liệu sổ phải chính xác, đầy đủ và có khóa sổ theo kỳ.
- TT99 Điều 17–18: BCTC gồm Báo cáo tình hình tài chính, KQHĐKD, LCTT và thuyết minh; mẫu B01/B02/B03/B09 được version hóa trong schema báo cáo.
- Chính TT99 nêu nghĩa vụ thuế thực hiện theo pháp luật thuế. Vì vậy `tax.*` được thiết kế **versioned/configurable**, không hard-code toàn bộ luật thuế vào tên bảng.

## 2. Kết quả audit V2

- **19 schema**
- **262 bảng**
- **2245 column**
- **785 quan hệ FK/1:1**
- **816 index/PK index**
- **176 unique index**
- **25 CHECK constraint trong DBML**
- **756 quan hệ ON DELETE RESTRICT**
- **29 quan hệ ON DELETE CASCADE** cho dữ liệu phụ thuộc thuần/config/helper

| Hạng mục audit | Kết quả | Ghi chú |
|---|---|---|
| Tên bảng `schema.table`, snake_case | **PASS** | 0 tên sai convention |
| Mọi bảng có PK | **PASS** | 0 bảng thiếu PK |
| Mọi column ghi rõ NULL/NOT NULL | **PASS** | 0 column mơ hồ |
| FK không dangling | **PASS** | 0 FK trỏ bảng/cột không tồn tại |
| FK có index hỗ trợ phía child | **PASS** | 0 FK thiếu index hỗ trợ |
| Tên index trùng trong cùng schema | **PASS** | 0 trùng |
| Cascade tài chính | **PASS** | Transaction/history mặc định RESTRICT; CASCADE chỉ helper/config |
| One-to-one thể hiện đúng trên ERD | **PASS** | Shared PK/profile/lock dùng quan hệ 1:1 |
| Nullable UNIQUE | **REVIEWED** | 3 trường hợp cố ý: party.tax_code, journal.source_document_id, membership.employee_id |
| RLS / trigger / exclusion constraint | **SQL PHASE** | Không thể mô tả đầy đủ bằng DBML; bắt buộc bổ sung ở migration PostgreSQL |

### 2.1. Các lỗi/điểm yếu của V1 đã sửa trong V2

1. Thêm `iam.company_membership` để một tài khoản toàn cục tham gia nhiều doanh nghiệp nhưng quyền được tách theo từng doanh nghiệp.
2. Thay `data_scope_rule(scope_type, scope_object_id)` bằng các bảng scope typed để FK thật sự kiểm soát branch/department/warehouse/bank/project/cost center.
3. Thêm SoD (`segregation_of_duties_*`) cho Creator ≠ Approver / Creator ≠ Poster.
4. Workflow đổi tên rõ nghĩa, version snapshot và tách instance/task/action log.
5. Thêm cấu hình versioned (`configuration_definition`, `company_configuration_value`).
6. Tách quy tắc đánh số và bộ đếm (`document_numbering_rule` + `document_number_sequence`) để cấp số atomic.
7. Bổ sung hợp đồng mua/bán và các bảng allocation đối chiếu request/order/receipt/invoice/delivery.
8. Bỏ FK trực tiếp `purchase_invoice.tax_invoice_id` / `sales_invoice.tax_invoice_id`; dùng `tax.tax_invoice_document_link` để hỗ trợ 1:N/N:N.
9. Bổ sung application của tạm ứng và chi tiết bù trừ AP/AR để truy vết khoản nào được cấn vào khoản nào.
10. Tách tồn kho tổng, theo location và theo lot; bổ sung costing run/layer/allocation.
11. Bổ sung biên bản kiểm nghiệm kho và các nghiệp vụ TSCĐ tương ứng các biểu mẫu TT99 cần cho phạm vi dự án.
12. Bổ sung `chart_of_accounts`, opening balance, account balance, dimension balance và đánh giá lại ngoại tệ.
13. Bổ sung template/version/line/mapping/run/value cho BCTC và template sổ kế toán.
14. Bổ sung tax form versioning, tax calculation rule version và deduplication key cho hóa đơn.
15. Bổ sung audit đăng nhập, export, security event; integration webhook subscription và sync checkpoint.
16. Bổ sung `document_rendered_output` để biết chính xác version mẫu nào đã dùng để kết xuất/ký chứng từ.
17. Chuẩn hóa tên bảng/cột và tự audit index cho toàn bộ FK.

## 3. Những kiểm soát bắt buộc ở PostgreSQL migration, không nên giả lập bằng DBML

DBML mô tả tốt table/column/PK/FK/index/check/referential action, nhưng production phải bổ sung bằng SQL migration:

- `CREATE EXTENSION pgcrypto` hoặc chiến lược UUID tương đương cho `gen_random_uuid()`.
- Row Level Security theo `company_id`/membership như lớp phòng thủ bổ sung.
- Unique case-insensitive cho email/username, ví dụ expression index `lower(email)` nếu yêu cầu.
- Exclusion constraint để ngăn các khoảng `valid_from/valid_to` chồng nhau ở role assignment/workflow/config khi nghiệp vụ yêu cầu.
- Deferred trigger hoặc controlled posting procedure để bảo đảm **SUM(debit) = SUM(credit)** cho mỗi `gl.journal_entry`.
- Trigger/privilege chặn UPDATE/DELETE với journal đã POST, stock movement, cash/bank book, VAT ledger và audit log.
- Cấp số chứng từ bằng row lock / atomic `UPDATE ... RETURNING`; không dùng `MAX()+1`.
- Composite tenant validation hoặc trigger kiểm `company_id` cho các FK cross-module để ngăn tham chiếu chéo doanh nghiệp.
- Partitioning theo thời gian cho audit/event/ledger nếu dữ liệu lớn.

## 4. Naming convention

Quy tắc thống nhất: **English + snake_case + singular**. Schema có thể dùng mã module ngắn, nhưng tên bảng/cột phải đủ nghĩa.

```text
pur.purchase_order
pur.purchase_order_line
ap.payable_open_item
sal.sales_invoice
ar.receivable_settlement
cash.cash_receipt
bank.bank_statement
inv.stock_movement
fa.fixed_asset
tax.tax_invoice
gl.journal_entry
gl.journal_entry_line
```

Quy ước cột:

- `*_id`: UUID FK/PK.
- `*_date`: ngày nghiệp vụ (`date`).
- `*_at`: thời điểm hệ thống (`timestamptz`).
- `*_by_user_id`: người thao tác.
- `*_amount`: tiền `numeric(20,4)`.
- `*_quantity`: số lượng `numeric(20,6)`.
- `exchange_rate`: `numeric(20,8)`.
- `code`: mã danh mục; `document_no`: số chứng từ; `reference_no`: số tham chiếu ngoài.
- Không dùng tên kiểu `status1`, `data1`, `obj_id`, `ref_id`, `qty1`, `amount1`.

## 5. Quy tắc ownership và phân phối bảng cho NestJS

Nguyên tắc: **mỗi schema có đúng một module sở hữu quyền ghi**. Module khác không import repository để UPDATE trực tiếp; phải gọi application/domain service của owner. Reporting được phép đọc chéo nhưng không ghi ngược nghiệp vụ.

| Schema | Ý nghĩa | NestJS owner | Nhóm UC | Số bảng |
|---|---|---|---|---:|
| `org` | Tổ chức doanh nghiệp | `OrganizationModule` | UC-SYS / cơ cấu tổ chức | 6 |
| `iam` | Định danh và phân quyền | `IamModule` | UC-SYS | 22 |
| `workflow` | Workflow phê duyệt | `WorkflowModule` | UC-SYS | 9 |
| `audit` | Audit và bảo mật | `AuditModule` | UC-SYS | 5 |
| `mdm` | Danh mục dùng chung | `MasterDataModule` | UC-MD | 24 |
| `core` | Lõi chứng từ và cấu hình | `DocumentCoreModule` | Cross-cutting / UC-SYS | 14 |
| `pur` | Mua hàng | `PurchaseModule` | UC-PUR | 21 |
| `ap` | Công nợ phải trả | `AccountsPayableModule` | UC-AP | 10 |
| `sal` | Bán hàng | `SalesModule` | UC-SAL | 14 |
| `ar` | Công nợ phải thu | `AccountsReceivableModule` | UC-AR | 10 |
| `cash` | Tiền mặt | `CashModule` | UC-CASH | 10 |
| `bank` | Ngân hàng | `BankingModule` | UC-BANK | 11 |
| `inv` | Kho và giá vốn | `InventoryModule` | UC-INV | 21 |
| `fa` | Tài sản cố định | `FixedAssetModule` | UC-FA | 14 |
| `ccdc` | Công cụ dụng cụ và chi phí trả trước | `CcdcModule` | UC-FA/CCDC | 9 |
| `tax` | Thuế và hóa đơn điện tử | `TaxModule` | UC-TAX | 22 |
| `gl` | Kế toán tổng hợp | `GeneralLedgerModule` | UC-GL | 18 |
| `report` | Sổ kế toán và báo cáo | `ReportingModule` | UC-RPT | 12 |
| `integration` | Tích hợp hệ thống | `IntegrationModule` | Cross-cutting | 10 |

Gợi ý cấu trúc backend:

```text
src/modules/organization/
src/modules/iam/
src/modules/workflow/
src/modules/audit/
src/modules/master-data/
src/modules/document-core/
src/modules/purchase/
src/modules/accounts-payable/
src/modules/sales/
src/modules/accounts-receivable/
src/modules/cash/
src/modules/banking/
src/modules/inventory/
src/modules/fixed-assets/
src/modules/ccdc/
src/modules/tax/
src/modules/general-ledger/
src/modules/reporting/
src/modules/integration/
```

### 5.1. Quyền ghi đặc biệt

- `gl.journal_entry` / `gl.journal_entry_line`: chỉ `PostingService` hoặc `GeneralLedgerService` ghi.
- `inv.stock_movement`: chỉ Inventory Posting ghi khi chứng từ POST.
- `cash.cash_book_entry` / `bank.bank_book_entry`: sinh từ posting/subledger, không nhập tay.
- `audit.*`: append-only bởi Audit/Security layer.
- `*_balance`: dữ liệu dẫn xuất; rebuild được, không nhập tay.
- `report.*`: ReportingService tạo; không làm thay đổi chứng từ/GL.
- `integration.outbox_event`: tạo cùng transaction nghiệp vụ theo transactional outbox.

## 6. Luồng dữ liệu chuẩn

### 6.1. Purchase-to-Pay

```text
purchase_request
  -> purchase_order / purchase_contract
  -> goods_receipt | service_receipt
  -> purchase_invoice
  -> tax_invoice_document_link
  -> payable_open_item
  -> payable_settlement / vendor_advance_application / payable_offset
  -> cash_payment | bank_payment
  -> journal_entry
```

### 6.2. Order-to-Cash

```text
quotation
  -> sales_order / sales_contract
  -> delivery
  -> sales_invoice
  -> tax_invoice_document_link
  -> receivable_open_item
  -> receivable_settlement / customer_advance_application / receivable_offset
  -> cash_receipt | bank_receipt
  -> journal_entry
```

### 6.3. Posting

```text
business_document APPROVED
  -> validate permission + scope + workflow + open period
  -> resolve posting_rule
  -> create journal_entry + journal_entry_line
  -> update subledger (AP/AR/stock/tax/cash/bank)
  -> mark document POSTED
  -> write audit + outbox
```

Tất cả bước trên phải nằm trong một transaction logic/idempotent. Controller không tự tạo journal.

## 7. Mapping TT99 vào database

| Nội dung TT99 | Database V2 | Ghi chú |
|---|---|---|
| Chứng từ kế toán nói chung | `core.business_document` + bảng chuyên ngành | Header dùng chung, extension theo nghiệp vụ |
| Mẫu 01-VT Phiếu nhập kho | `inv.stock_receipt` + `_line` | `mdm.document_type.legal_form_code = 01-VT` |
| Mẫu 02-VT Phiếu xuất kho | `inv.stock_issue` + `_line` | `legal_form_code = 02-VT` |
| Mẫu 03-VT Biên bản kiểm nghiệm | `inv.inventory_inspection` + `_line` | Tách khỏi phiếu nhập để lưu kết quả kiểm nghiệm |
| Mẫu 04-VT vật tư còn lại cuối kỳ | Report từ inventory balance/movement | Không cần tạo transaction table riêng |
| Mẫu 05-VT kiểm kê | `inv.stocktake` + `_line` | Có thể sinh stock adjustment sau xử lý chênh lệch |
| Mẫu 06-VT bảng kê mua hàng | Report từ `pur.*` | Không duplicate dữ liệu nguồn |
| Mẫu 07-VT bảng phân bổ NVL/CCDC | Report từ inventory/CCDC/GL | Không nhập tay vào bảng báo cáo |
| Mẫu 01-TT Phiếu thu | `cash.cash_receipt` + `_line` | Loại chứng từ chứa mã pháp lý |
| Mẫu 02-TT Phiếu chi | `cash.cash_payment` + `_line` |  |
| Mẫu 03-TT Đề nghị tạm ứng | `cash.advance_request` |  |
| Mẫu 04-TT Thanh toán tạm ứng | `cash.advance_settlement` |  |
| Mẫu 05-TT Đề nghị thanh toán | `cash.payment_request` |  |
| Mẫu 08a/08b-TT Kiểm kê quỹ | `cash.cash_count` | Phân biệt tiền tệ bằng currency/fund |
| Mẫu 01-TSCĐ Giao nhận | `fa.fixed_asset_acquisition` |  |
| Mẫu 02-TSCĐ Thanh lý | `fa.fixed_asset_disposal` |  |
| Mẫu 03-TSCĐ sửa chữa/nâng cấp hoàn thành | `fa.fixed_asset_maintenance_completion` |  |
| Mẫu 04-TSCĐ Đánh giá lại | `fa.fixed_asset_revaluation` |  |
| Mẫu 05-TSCĐ Kiểm kê | `fa.fixed_asset_inventory` + `_line` |  |
| Mẫu 06-TSCĐ Khấu hao | `fa.depreciation_run` + `_line` / report |  |
| Hệ thống tài khoản Phụ lục II | `gl.chart_of_accounts` + `gl.account` | Account list là seed/master data, không hard-code thành table |
| Sổ kế toán Phụ lục III | Journal/subledger + `report.accounting_book_template*` | Sổ được sinh từ dữ liệu đã POST |
| B01-DN | `report.financial_statement_template*` | Báo cáo tình hình tài chính |
| B02-DN | `report.financial_statement_template*` | KQHĐKD |
| B03-DN | `report.financial_statement_template*` | Lưu chuyển tiền tệ |
| B09-DN | `report.financial_statement_template*` | Thuyết minh BCTC |

**Lưu ý:** các biểu mẫu TT99 ngoài phạm vi chức năng dự án hiện tại không nên tạo bảng riêng chỉ vì tồn tại trong phụ lục. Chỉ tạo specialized table khi có Use Case nghiệp vụ; còn mã mẫu/version/layout được quản lý bằng document/report template.

## 8. Seed/config bắt buộc sau khi tạo schema

### Permission Action

`VIEW, CREATE, EDIT, DELETE, SUBMIT, APPROVE, REJECT, CONFIRM, POST, UNPOST, CANCEL, REVERSE, PRINT, IMPORT, EXPORT, CONFIGURE`.

### Document Class

`OPERATIONAL, ACCOUNTING, TAX, INTERNAL, LEGAL`.

### Document Status

`DRAFT -> SUBMITTED -> APPROVED -> POSTED`; nhánh kết thúc/sửa sai: `CANCELLED` hoặc `REVERSED`.

### Hệ thống tài khoản và báo cáo

- Seed `gl.chart_of_accounts` / `gl.account` từ **Phụ lục II TT99 chính thức**. Không tự đoán danh mục tài khoản.
- Seed `report.financial_statement_template*` cho B01/B02/B03/B09 và bản giữa niên độ theo Phụ lục IV.
- Seed `mdm.document_type` cho các chứng từ dự án dùng, kèm `legal_form_code`, `legal_basis`, flags posting/kho/công nợ/thuế.

## 9. Thứ tự triển khai/migration

Do có quan hệ vòng hợp lý giữa Organization ↔ MDM ↔ GL, khi sinh PostgreSQL nên **create table trước, add FK sau** thay vì cố tạo từng table theo một thứ tự tuyến tính duy nhất.

Thứ tự module để phát triển ứng dụng:

1. `mdm.currency` bootstrap + `org`.
2. `iam`, `audit`, cấu hình cơ bản.
3. `mdm` còn lại + `gl` chart/account/fiscal periods.
4. `core` + `workflow`.
5. `pur`, `ap`, `cash`, `bank`.
6. `sal`, `ar`.
7. `inv`.
8. `fa`, `ccdc`.
9. `tax` + integration HĐĐT/TVAN nếu có.
10. `report` + integration/outbox/webhook.

## 10. Cách dùng trên dbdiagram.io

1. Mở dbdiagram.io → New Diagram → DBML.
2. Import/paste `THUE_ERP_DATABASE_V2.dbml`.
3. Không mở full view để review hằng ngày; chọn `DiagramView` theo nghiệp vụ.
4. Review theo chuỗi: `01_organization_iam_workflow` → `02_master_data_and_document_core` → `03_purchase_to_pay` → `04_order_to_cash` → `06_inventory_and_costing` → `08_tax_and_einvoice` → `09_general_ledger` → `10_financial_reporting`.
5. Sau khi BA/Kế toán/Backend chốt V2 mới sinh PostgreSQL DDL và Prisma.

## 11. Data Dictionary — cách sử dụng từng bảng

Trong phần này, **Write owner** là module duy nhất được phép ghi trực tiếp. **Read consumers** được suy ra từ quan hệ FK và ownership; không có nghĩa các module được phép UPDATE bảng đó.

## 11.1. Schema `org` — Tổ chức doanh nghiệp

**Owner:** `OrganizationModule` · **Use Case:** UC-SYS / cơ cấu tổ chức · **Số bảng:** 6

### `org.company` — Doanh nghiệp

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `OrganizationModule`
- **Read consumers:** `AccountsPayableModule`, `AccountsReceivableModule`, `AuditModule`, `BankingModule`, `CashModule`, `CcdcModule`, `DocumentCoreModule`, `FixedAssetModule`, `GeneralLedgerModule`, `IamModule`, `IntegrationModule`, `InventoryModule`, `MasterDataModule`, `OrganizationModule`, `ReportingModule`, `TaxModule`, `WorkflowModule`
- **Mục đích:** Danh mục Doanh nghiệp dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `accounting_currency_id` → `mdm.currency.id` (DELETE RESTRICT); `legal_reporting_currency_id` → `mdm.currency.id` (DELETE RESTRICT)
- **UNIQUE:** `code`, `tax_code`
- **Nullability:** 13 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `legal_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `tax_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `address` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `phone` | `varchar(30)` | YES | Thuộc tính nghiệp vụ |
| `email` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `accounting_currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `legal_reporting_currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `accounting_regime` | `varchar(30)` | NO | Thuộc tính nghiệp vụ; default='TT99' |
| `fiscal_year_start_month` | `smallint` | NO | Thuộc tính nghiệp vụ; default=1 |
| `timezone` | `varchar(80)` | NO | Thuộc tính nghiệp vụ; default='Asia/Ho_Chi_Minh' |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `code (uq_company_code)`; `tax_code (uq_company_tax_code)`; `status (idx_company_status)`; `accounting_currency_id (idx_company_accounting_currency_id)`; `legal_reporting_currency_id (idx_company_legal_reporting_currency_id)`

**CHECK:** ``fiscal_year_start_month between 1 and 12` [name: 'ck_company_fiscal_year_start_month']`

### `org.branch` — Chi nhánh

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `OrganizationModule`
- **Read consumers:** `AccountsPayableModule`, `AccountsReceivableModule`, `BankingModule`, `CashModule`, `CcdcModule`, `DocumentCoreModule`, `FixedAssetModule`, `GeneralLedgerModule`, `IamModule`, `InventoryModule`, `MasterDataModule`, `OrganizationModule`, `ReportingModule`, `WorkflowModule`
- **Mục đích:** Danh mục Chi nhánh dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `parent_branch_id` → `org.branch.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 8 cột bắt buộc / 7 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `parent_branch_id` | `uuid` | YES | FK → `org.branch.id`; ON DELETE RESTRICT |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `tax_code` | `varchar(30)` | YES | Mã nghiệp vụ/danh mục |
| `address` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `phone` | `varchar(30)` | YES | Thuộc tính nghiệp vụ |
| `representative_name` | `varchar(255)` | YES | Tên/nhãn hiển thị |
| `established_date` | `date` | YES | Ngày nghiệp vụ |
| `closed_date` | `date` | YES | Ngày nghiệp vụ |
| `is_head_office` | `boolean` | NO | Cờ cấu hình; default=false |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, code) (uq_branch_company_code)`; `(company_id, status) (idx_branch_company_status)`; `parent_branch_id (idx_branch_parent)`

### `org.department` — Phòng ban

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `OrganizationModule`
- **Read consumers:** `CcdcModule`, `FixedAssetModule`, `IamModule`, `OrganizationModule`, `PurchaseModule`
- **Mục đích:** Danh mục Phòng ban dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `manager_employee_id` → `org.employee.id` (DELETE RESTRICT); `parent_department_id` → `org.department.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 8 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `parent_department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `manager_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, code) (uq_department_company_code)`; `(branch_id, status) (idx_department_branch_status)`; `parent_department_id (idx_department_parent)`; `manager_employee_id (idx_department_manager_employee_id)`

### `org.position` — Chức vụ

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `OrganizationModule`
- **Read consumers:** `OrganizationModule`
- **Mục đích:** Danh mục Chức vụ dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 7 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(150)` | NO | Tên/nhãn hiển thị |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, code) (uq_position_company_code)`

### `org.employee` — Nhân viên

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `OrganizationModule`
- **Read consumers:** `CashModule`, `CcdcModule`, `FixedAssetModule`, `IamModule`, `InventoryModule`, `MasterDataModule`, `OrganizationModule`, `PurchaseModule`, `SalesModule`
- **Mục đích:** Danh mục Nhân viên dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `department_id` → `org.department.id` (DELETE RESTRICT); `position_id` → `org.position.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, employee_code)`
- **Nullability:** 8 cột bắt buộc / 6 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `position_id` | `uuid` | YES | FK → `org.position.id`; ON DELETE RESTRICT |
| `employee_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `full_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `email` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `phone` | `varchar(30)` | YES | Thuộc tính nghiệp vụ |
| `hire_date` | `date` | YES | Ngày nghiệp vụ |
| `termination_date` | `date` | YES | Ngày nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, employee_code) (uq_employee_company_code)`; `(branch_id, department_id, status) (idx_employee_org_status)`; `email (idx_employee_email)`; `department_id (idx_employee_department_id)`; `position_id (idx_employee_position_id)`

### `org.employee_assignment` — Lịch sử phân công nhân viên

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `OrganizationModule`
- **Read consumers:** `OrganizationModule`
- **Mục đích:** Danh mục Lịch sử phân công nhân viên dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `department_id` → `org.department.id` (DELETE RESTRICT); `employee_id` → `org.employee.id` (DELETE RESTRICT); `position_id` → `org.position.id` (DELETE RESTRICT)
- **UNIQUE:** `(employee_id, valid_from)`
- **Nullability:** 6 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `employee_id` | `uuid` | NO | FK → `org.employee.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `position_id` | `uuid` | YES | FK → `org.position.id`; ON DELETE RESTRICT |
| `valid_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `valid_to` | `date` | YES | Thuộc tính nghiệp vụ |
| `is_primary` | `boolean` | NO | Cờ cấu hình; default=true |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(employee_id, valid_from) (uq_employee_assignment_version)`; `(branch_id, department_id, valid_from) (idx_employee_assignment_org)`; `department_id (idx_employee_assignment_department_id)`; `position_id (idx_employee_assignment_position_id)`

## 11.2. Schema `iam` — Định danh và phân quyền

**Owner:** `IamModule` · **Use Case:** UC-SYS · **Số bảng:** 22

### `iam.user_account` — Tài khoản người dùng

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `AuditModule`, `BankingModule`, `CcdcModule`, `DocumentCoreModule`, `FixedAssetModule`, `GeneralLedgerModule`, `IamModule`, `IntegrationModule`, `InventoryModule`, `ReportingModule`, `TaxModule`, `WorkflowModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Tài khoản người dùng; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `username`, `email`
- **Nullability:** 8 cột bắt buộc / 4 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `username` | `varchar(100)` | NO | Thuộc tính nghiệp vụ |
| `email` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `display_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `phone` | `varchar(30)` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `failed_login_count` | `integer` | NO | Thuộc tính nghiệp vụ; default=0 |
| `locked_until` | `timestamptz` | YES | Thuộc tính nghiệp vụ |
| `last_login_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `password_changed_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `username (uq_user_account_username)`; `email (uq_user_account_email)`; `status (idx_user_account_status)`

### `iam.user_identity` — Định danh đăng nhập

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Định danh đăng nhập; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `id`
- **FK ra:** `user_id` → `iam.user_account.id` (DELETE CASCADE)
- **UNIQUE:** `(provider, provider_subject)`
- **Nullability:** 5 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE CASCADE |
| `provider` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `provider_subject` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `password_hash` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `verified_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(provider, provider_subject) (uq_identity_provider_subject)`; `user_id (idx_identity_user)`

### `iam.user_session` — Phiên đăng nhập

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Phiên đăng nhập; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `id`
- **FK ra:** `user_id` → `iam.user_account.id` (DELETE CASCADE)
- **UNIQUE:** `refresh_token_hash`
- **Nullability:** 5 cột bắt buộc / 4 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE CASCADE |
| `refresh_token_hash` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `device_name` | `varchar(255)` | YES | Tên/nhãn hiển thị |
| `ip_address` | `varchar(64)` | YES | Thuộc tính nghiệp vụ |
| `user_agent` | `text` | YES | Thuộc tính nghiệp vụ |
| `expires_at` | `timestamptz` | NO | Thời điểm hệ thống |
| `revoked_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(user_id, expires_at) (idx_session_user_expiry)`; `refresh_token_hash (uq_session_refresh_hash)`

### `iam.role` — Vai trò

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`, `WorkflowModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Vai trò; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 9 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `role_type` | `varchar(20)` | NO | Thuộc tính nghiệp vụ; default='CUSTOM' |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `description` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `is_system_admin` | `boolean` | NO | Cờ cấu hình; default=false |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, code) (uq_role_company_code)`; `(company_id, status) (idx_role_company_status)`

### `iam.permission_resource` — Đối tượng phân quyền

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Đối tượng phân quyền; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `code`
- **Nullability:** 5 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `code` | `varchar(100)` | NO | Mã nghiệp vụ/danh mục |
| `module_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `code (uq_permission_resource_code)`; `(module_code, status) (idx_permission_resource_module)`

### `iam.permission_action` — Hành động quyền

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Hành động quyền; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `code`
- **Nullability:** 4 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(150)` | NO | Tên/nhãn hiển thị |
| `risk_level` | `varchar(20)` | NO | Thuộc tính nghiệp vụ; default='NORMAL' |

**Indexes:** `code (uq_permission_action_code)`

### `iam.permission` — Quyền chi tiết

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Quyền chi tiết; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `id`
- **FK ra:** `action_id` → `iam.permission_action.id` (DELETE RESTRICT); `resource_id` → `iam.permission_resource.id` (DELETE RESTRICT)
- **UNIQUE:** `(resource_id, action_id)`, `code`
- **Nullability:** 5 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `resource_id` | `uuid` | NO | FK → `iam.permission_resource.id`; ON DELETE RESTRICT |
| `action_id` | `uuid` | NO | FK → `iam.permission_action.id`; ON DELETE RESTRICT |
| `code` | `varchar(160)` | NO | Mã nghiệp vụ/danh mục |
| `description` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(resource_id, action_id) (uq_permission_resource_action)`; `code (uq_permission_code)`; `action_id (idx_permission_action_id)`

### `iam.role_permission` — Quyền của vai trò

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Quyền của vai trò; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `role_id`, `permission_id`
- **FK ra:** `permission_id` → `iam.permission.id` (DELETE CASCADE); `role_id` → `iam.role.id` (DELETE CASCADE)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `role_id` | `uuid` | NO | FK → `iam.role.id`; ON DELETE CASCADE |
| `permission_id` | `uuid` | NO | FK → `iam.permission.id`; ON DELETE CASCADE |
| `effect` | `varchar(10)` | NO | Thuộc tính nghiệp vụ; default='ALLOW' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `permission_id (idx_role_permission_permission)`

### `iam.user_role_assignment` — Gán vai trò cho người dùng

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `AuditModule`, `IamModule`
- **Mục đích:** Gán một Role cho một thành viên doanh nghiệp theo khoảng hiệu lực và Data Scope cụ thể. Quyền hiệu lực phải tính theo từng assignment, không gộp scope giữa các role.
- **PK:** `id`
- **FK ra:** `assigned_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `company_membership_id` → `iam.company_membership.id` (DELETE RESTRICT); `data_scope_set_id` → `iam.data_scope_set.id` (DELETE RESTRICT); `revoked_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `role_id` → `iam.role.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_membership_id, role_id, valid_from)`
- **Nullability:** 7 cột bắt buộc / 5 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_membership_id` | `uuid` | NO | FK → `iam.company_membership.id`; ON DELETE RESTRICT |
| `role_id` | `uuid` | NO | FK → `iam.role.id`; ON DELETE RESTRICT |
| `data_scope_set_id` | `uuid` | YES | FK → `iam.data_scope_set.id`; ON DELETE RESTRICT |
| `valid_from` | `timestamptz` | NO | Thuộc tính nghiệp vụ; default=`now()` |
| `valid_to` | `timestamptz` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `assigned_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `assigned_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `revoked_by_user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `revoked_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `revoke_reason` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(company_membership_id, role_id, valid_from) (uq_user_role_assignment_version)`; `(company_membership_id, status) (idx_user_role_assignment_membership_status)`; `(role_id, status) (idx_user_role_assignment_role_status)`; `data_scope_set_id (idx_user_role_assignment_scope)`; `assigned_by_user_id (idx_user_role_assignment_assigned_by_user_id)`; `revoked_by_user_id (idx_user_role_assignment_revoked_by_user_id)`

**CHECK:** ``valid_to is null or valid_to >= valid_from` [name: 'ck_user_role_assignment_validity']`

### `iam.permission_bundle` — Gói quyền

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình/danh mục cho Gói quyền. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `code`
- **Nullability:** 5 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `module_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `description` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `code (uq_permission_bundle_code)`

### `iam.permission_bundle_item` — Quyền trong gói

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Quyền trong gói; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `bundle_id`, `permission_id`
- **FK ra:** `bundle_id` → `iam.permission_bundle.id` (DELETE CASCADE); `permission_id` → `iam.permission.id` (DELETE CASCADE)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 2 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `bundle_id` | `uuid` | NO | FK → `iam.permission_bundle.id`; ON DELETE CASCADE |
| `permission_id` | `uuid` | NO | FK → `iam.permission.id`; ON DELETE CASCADE |

**Indexes:** `permission_id (idx_permission_bundle_item_permission_id)`

### `iam.role_permission_bundle` — Gói quyền của vai trò

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình/danh mục cho Gói quyền của vai trò. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.
- **PK:** `role_id`, `bundle_id`
- **FK ra:** `bundle_id` → `iam.permission_bundle.id` (DELETE CASCADE); `role_id` → `iam.role.id` (DELETE CASCADE)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `role_id` | `uuid` | NO | FK → `iam.role.id`; ON DELETE CASCADE |
| `bundle_id` | `uuid` | NO | FK → `iam.permission_bundle.id`; ON DELETE CASCADE |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `bundle_id (idx_role_permission_bundle_bundle_id)`

### `iam.company_membership` — Thành viên doanh nghiệp

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Thành viên doanh nghiệp; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `employee_id` → `org.employee.id` (DELETE RESTRICT); `user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, user_id)`, `(company_id, employee_id)`
- **Nullability:** 8 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `membership_status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `joined_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `left_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, user_id) (uq_company_membership_company_user)`; `(company_id, employee_id) (uq_company_membership_company_employee)`; `(company_id, membership_status) (idx_company_membership_status)`; `created_by_user_id (idx_company_membership_created_by_user_id)`; `employee_id (idx_company_membership_employee_id)`; `user_id (idx_company_membership_user_id)`

### `iam.data_scope_set` — Bộ phạm vi dữ liệu

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Header của một bộ phạm vi dữ liệu. Scope chi tiết được tách sang bảng branch/department/warehouse/bank/project/cost center để có FK vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 10 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `allow_all_company_data` | `boolean` | NO | Cờ cấu hình; default=false |
| `allow_owned_records` | `boolean` | NO | Cờ cấu hình; default=false |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, code) (uq_data_scope_set_company_code)`; `(company_id, status) (idx_data_scope_set_status)`; `created_by_user_id (idx_data_scope_set_created_by_user_id)`

### `iam.data_scope_branch` — Phạm vi chi nhánh

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Phạm vi chi nhánh; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `data_scope_set_id`, `branch_id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `data_scope_set_id` → `iam.data_scope_set.id` (DELETE CASCADE)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `data_scope_set_id` | `uuid` | NO | FK → `iam.data_scope_set.id`; ON DELETE CASCADE |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `include_descendants` | `boolean` | NO | Thuộc tính nghiệp vụ; default=false |

**Indexes:** `branch_id (idx_data_scope_branch_branch_id)`

### `iam.data_scope_department` — Phạm vi phòng ban

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Phạm vi phòng ban; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `data_scope_set_id`, `department_id`
- **FK ra:** `data_scope_set_id` → `iam.data_scope_set.id` (DELETE CASCADE); `department_id` → `org.department.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `data_scope_set_id` | `uuid` | NO | FK → `iam.data_scope_set.id`; ON DELETE CASCADE |
| `department_id` | `uuid` | NO | FK → `org.department.id`; ON DELETE RESTRICT |
| `include_descendants` | `boolean` | NO | Thuộc tính nghiệp vụ; default=false |

**Indexes:** `department_id (idx_data_scope_department_department_id)`

### `iam.data_scope_warehouse` — Phạm vi kho

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Phạm vi kho; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `data_scope_set_id`, `warehouse_id`
- **FK ra:** `data_scope_set_id` → `iam.data_scope_set.id` (DELETE CASCADE); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 2 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `data_scope_set_id` | `uuid` | NO | FK → `iam.data_scope_set.id`; ON DELETE CASCADE |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |

**Indexes:** `warehouse_id (idx_data_scope_warehouse_warehouse_id)`

### `iam.data_scope_bank_account` — Phạm vi tài khoản ngân hàng

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Phạm vi tài khoản ngân hàng; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `data_scope_set_id`, `company_bank_account_id`
- **FK ra:** `company_bank_account_id` → `mdm.company_bank_account.id` (DELETE RESTRICT); `data_scope_set_id` → `iam.data_scope_set.id` (DELETE CASCADE)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 2 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `data_scope_set_id` | `uuid` | NO | FK → `iam.data_scope_set.id`; ON DELETE CASCADE |
| `company_bank_account_id` | `uuid` | NO | FK → `mdm.company_bank_account.id`; ON DELETE RESTRICT |

**Indexes:** `company_bank_account_id (idx_data_scope_bank_account_company_bank_account_id)`

### `iam.data_scope_project` — Phạm vi dự án

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Phạm vi dự án; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `data_scope_set_id`, `project_id`
- **FK ra:** `data_scope_set_id` → `iam.data_scope_set.id` (DELETE CASCADE); `project_id` → `mdm.project.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 2 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `data_scope_set_id` | `uuid` | NO | FK → `iam.data_scope_set.id`; ON DELETE CASCADE |
| `project_id` | `uuid` | NO | FK → `mdm.project.id`; ON DELETE RESTRICT |

**Indexes:** `project_id (idx_data_scope_project_project_id)`

### `iam.data_scope_cost_center` — Phạm vi trung tâm chi phí

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Phạm vi trung tâm chi phí; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `data_scope_set_id`, `cost_center_id`
- **FK ra:** `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `data_scope_set_id` → `iam.data_scope_set.id` (DELETE CASCADE)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 2 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `data_scope_set_id` | `uuid` | NO | FK → `iam.data_scope_set.id`; ON DELETE CASCADE |
| `cost_center_id` | `uuid` | NO | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |

**Indexes:** `cost_center_id (idx_data_scope_cost_center_cost_center_id)`

### `iam.segregation_of_duties_rule` — Quy tắc phân tách nhiệm vụ

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình/danh mục cho Quy tắc phân tách nhiệm vụ. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 12 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `resource_code` | `varchar(100)` | NO | Mã nghiệp vụ/danh mục |
| `first_action_code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `conflicting_action_code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `enforcement_mode` | `varchar(20)` | NO | Thuộc tính nghiệp vụ; default='BLOCK' |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `effective_from` | `timestamptz` | NO | Thuộc tính nghiệp vụ; default=`now()` |
| `effective_to` | `timestamptz` | YES | Thuộc tính nghiệp vụ |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, code) (uq_sod_rule_company_code)`; `(company_id, resource_code, status) (idx_sod_rule_resource_status)`; `created_by_user_id (idx_segregation_of_duties_rule_created_by_user_id)`

### `iam.segregation_of_duties_violation` — Vi phạm phân tách nhiệm vụ

- **Loại bảng:** `SECURITY_CONFIG`
- **Write owner:** `IamService`
- **Read consumers:** `IamModule`
- **Mục đích:** Cấu hình bảo mật/phân quyền cho Vi phạm phân tách nhiệm vụ; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT); `overridden_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `rule_id` → `iam.segregation_of_duties_rule.id` (DELETE RESTRICT); `user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 7 cột bắt buộc / 4 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `rule_id` | `uuid` | NO | FK → `iam.segregation_of_duties_rule.id`; ON DELETE RESTRICT |
| `document_id` | `uuid` | YES | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `detected_action` | `varchar(50)` | NO | Thuộc tính nghiệp vụ |
| `resolution_status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |
| `override_reason` | `text` | YES | Thuộc tính nghiệp vụ |
| `overridden_by_user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `detected_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `resolved_at` | `timestamptz` | YES | Thời điểm hệ thống |

**Indexes:** `(company_id, resolution_status, detected_at) (idx_sod_violation_status)`; `(rule_id, user_id, detected_at) (idx_sod_violation_rule_user)`; `document_id (idx_segregation_of_duties_violation_document_id)`; `overridden_by_user_id (idx_segregation_of_duties_violation_overridden_by_user_id)`; `user_id (idx_segregation_of_duties_violation_user_id)`

## 11.3. Schema `workflow` — Workflow phê duyệt

**Owner:** `WorkflowModule` · **Use Case:** UC-SYS · **Số bảng:** 9

### `workflow.approval_workflow` — Workflow phê duyệt

- **Loại bảng:** `WORKFLOW`
- **Write owner:** `WorkflowService`
- **Read consumers:** `WorkflowModule`
- **Mục đích:** Dữ liệu workflow cho Workflow phê duyệt; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `document_type_id` → `mdm.document_type.id` (DELETE RESTRICT); `updated_by_user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 11 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `module_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `document_type_id` | `uuid` | YES | FK → `mdm.document_type.id`; ON DELETE RESTRICT |
| `business_type_code` | `varchar(80)` | YES | Mã nghiệp vụ/danh mục |
| `priority` | `integer` | NO | Thuộc tính nghiệp vụ; default=100 |
| `status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, code) (uq_approval_workflow_company_code)`; `(company_id, document_type_id, status, priority) (idx_approval_workflow_selector)`; `created_by_user_id (idx_approval_workflow_created_by_user_id)`; `document_type_id (idx_approval_workflow_document_type_id)`; `updated_by_user_id (idx_approval_workflow_updated_by_user_id)`

### `workflow.approval_workflow_version` — Phiên bản workflow phê duyệt

- **Loại bảng:** `VERSIONED_CONFIG`
- **Write owner:** `WorkflowService`
- **Read consumers:** `WorkflowModule`
- **Mục đích:** Snapshot phiên bản workflow. Sau khi publish và có giao dịch sử dụng thì không sửa nội dung; thay đổi phải tạo version mới.
- **PK:** `id`
- **FK ra:** `approval_workflow_id` → `workflow.approval_workflow.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `published_by_user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** `(approval_workflow_id, version_no)`
- **Nullability:** 10 cột bắt buộc / 3 cột nullable
- **Delete policy:** VERSIONED — không sửa/xóa version đã publish hoặc đã được tham chiếu.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `approval_workflow_id` | `uuid` | NO | FK → `workflow.approval_workflow.id`; ON DELETE RESTRICT |
| `version_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `effective_from` | `timestamptz` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `timestamptz` | YES | Thuộc tính nghiệp vụ |
| `allow_self_approval` | `boolean` | NO | Cờ cấu hình; default=false |
| `require_creator_different_from_approver` | `boolean` | NO | Thuộc tính nghiệp vụ; default=true |
| `require_creator_different_from_poster` | `boolean` | NO | Thuộc tính nghiệp vụ; default=false |
| `version_status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `published_by_user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `published_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(approval_workflow_id, version_no) (uq_approval_workflow_version)`; `(approval_workflow_id, version_status, effective_from) (idx_approval_workflow_version_effective)`; `created_by_user_id (idx_approval_workflow_version_created_by_user_id)`; `published_by_user_id (idx_approval_workflow_version_published_by_user_id)`

**CHECK:** ``effective_to is null or effective_to >= effective_from` [name: 'ck_approval_workflow_version_validity']`

### `workflow.approval_step` — Bước phê duyệt

- **Loại bảng:** `WORKFLOW`
- **Write owner:** `WorkflowService`
- **Read consumers:** `WorkflowModule`
- **Mục đích:** Dữ liệu workflow cho Bước phê duyệt; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.
- **PK:** `id`
- **FK ra:** `approval_workflow_version_id` → `workflow.approval_workflow_version.id` (DELETE RESTRICT)
- **UNIQUE:** `(approval_workflow_version_id, step_no)`
- **Nullability:** 8 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `approval_workflow_version_id` | `uuid` | NO | FK → `workflow.approval_workflow_version.id`; ON DELETE RESTRICT |
| `step_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `approval_mode` | `varchar(20)` | NO | Thuộc tính nghiệp vụ; default='ANY' |
| `minimum_approval_count` | `integer` | NO | Thuộc tính nghiệp vụ; default=1 |
| `can_return` | `boolean` | NO | Thuộc tính nghiệp vụ; default=true |
| `can_reject` | `boolean` | NO | Thuộc tính nghiệp vụ; default=true |
| `service_level_hours` | `integer` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(approval_workflow_version_id, step_no) (uq_approval_step_no)`

### `workflow.approval_step_assignee` — Người hoặc vai trò phê duyệt

- **Loại bảng:** `WORKFLOW`
- **Write owner:** `WorkflowService`
- **Read consumers:** `WorkflowModule`
- **Mục đích:** Dữ liệu workflow cho Người hoặc vai trò phê duyệt; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.
- **PK:** `id`
- **FK ra:** `approval_step_id` → `workflow.approval_step.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `role_id` → `iam.role.id` (DELETE RESTRICT); `user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 6 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `approval_step_id` | `uuid` | NO | FK → `workflow.approval_step.id`; ON DELETE RESTRICT |
| `assignee_type` | `varchar(20)` | NO | Thuộc tính nghiệp vụ |
| `user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `role_id` | `uuid` | YES | FK → `iam.role.id`; ON DELETE RESTRICT |
| `minimum_amount` | `numeric(20,4)` | YES | Giá trị tiền tệ |
| `maximum_amount` | `numeric(20,4)` | YES | Giá trị tiền tệ |
| `branch_id` | `uuid` | YES | FK → `org.branch.id`; ON DELETE RESTRICT |
| `condition_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |

**Indexes:** `(approval_step_id, assignee_type, user_id, role_id, branch_id) (idx_approval_step_assignee)`; `user_id (idx_approval_step_assignee_user)`; `role_id (idx_approval_step_assignee_role)`; `branch_id (idx_approval_step_assignee_branch_id)`

### `workflow.approval_condition` — Điều kiện workflow

- **Loại bảng:** `WORKFLOW`
- **Write owner:** `WorkflowService`
- **Read consumers:** `WorkflowModule`
- **Mục đích:** Dữ liệu workflow cho Điều kiện workflow; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.
- **PK:** `id`
- **FK ra:** `approval_workflow_version_id` → `workflow.approval_workflow_version.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `approval_workflow_version_id` | `uuid` | NO | FK → `workflow.approval_workflow_version.id`; ON DELETE RESTRICT |
| `condition_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `field_name` | `varchar(100)` | YES | Tên/nhãn hiển thị |
| `operator` | `varchar(20)` | NO | Thuộc tính nghiệp vụ |
| `value_json` | `jsonb` | NO | Dữ liệu cấu hình/payload có cấu trúc |
| `priority` | `integer` | NO | Thuộc tính nghiệp vụ; default=100 |

**Indexes:** `(approval_workflow_version_id, priority) (idx_approval_condition_priority)`

### `workflow.approval_instance` — Phiên phê duyệt chứng từ

- **Loại bảng:** `WORKFLOW`
- **Write owner:** `WorkflowService`
- **Read consumers:** `WorkflowModule`
- **Mục đích:** Dữ liệu workflow cho Phiên phê duyệt chứng từ; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.
- **PK:** `id`
- **FK ra:** `approval_workflow_version_id` → `workflow.approval_workflow_version.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT); `submitted_by_user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 7 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `approval_workflow_version_id` | `uuid` | NO | FK → `workflow.approval_workflow_version.id`; ON DELETE RESTRICT |
| `current_step_no` | `integer` | YES | Số chứng từ/tham chiếu |
| `instance_status` | `varchar(20)` | NO | Trạng thái; default='RUNNING' |
| `submitted_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `started_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `completed_at` | `timestamptz` | YES | Thời điểm hệ thống |

**Indexes:** `(document_id, instance_status) (idx_approval_instance_document)`; `(company_id, instance_status, started_at) (idx_approval_instance_company)`; `approval_workflow_version_id (idx_approval_instance_approval_workflow_version_id)`; `submitted_by_user_id (idx_approval_instance_submitted_by_user_id)`

### `workflow.approval_task` — Nhiệm vụ phê duyệt

- **Loại bảng:** `WORKFLOW`
- **Write owner:** `WorkflowService`
- **Read consumers:** `WorkflowModule`
- **Mục đích:** Dữ liệu workflow cho Nhiệm vụ phê duyệt; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.
- **PK:** `id`
- **FK ra:** `acted_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `approval_instance_id` → `workflow.approval_instance.id` (DELETE RESTRICT); `approval_step_id` → `workflow.approval_step.id` (DELETE RESTRICT); `assigned_role_id` → `iam.role.id` (DELETE RESTRICT); `assigned_user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 6 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `approval_instance_id` | `uuid` | NO | FK → `workflow.approval_instance.id`; ON DELETE RESTRICT |
| `approval_step_id` | `uuid` | NO | FK → `workflow.approval_step.id`; ON DELETE RESTRICT |
| `assigned_user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `assigned_role_id` | `uuid` | YES | FK → `iam.role.id`; ON DELETE RESTRICT |
| `task_status` | `varchar(20)` | NO | Trạng thái; default='PENDING' |
| `due_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `acted_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `acted_by_user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `comment` | `text` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(assigned_user_id, task_status, due_at) (idx_approval_task_user)`; `(assigned_role_id, task_status, due_at) (idx_approval_task_role)`; `(approval_instance_id, task_status) (idx_approval_task_instance)`; `acted_by_user_id (idx_approval_task_acted_by_user_id)`; `approval_step_id (idx_approval_task_approval_step_id)`

### `workflow.approval_action_log` — Nhật ký hành động phê duyệt

- **Loại bảng:** `AUDIT_LOG`
- **Write owner:** `WorkflowService`
- **Read consumers:** `WorkflowModule`
- **Mục đích:** Lưu Nhật ký hành động phê duyệt theo mô hình append-only phục vụ truy vết, kiểm toán và điều tra sự cố; UI nghiệp vụ không được UPDATE/DELETE.
- **PK:** `id`
- **FK ra:** `actor_user_id` → `iam.user_account.id` (DELETE RESTRICT); `approval_instance_id` → `workflow.approval_instance.id` (DELETE RESTRICT); `approval_task_id` → `workflow.approval_task.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `approval_instance_id` | `uuid` | NO | FK → `workflow.approval_instance.id`; ON DELETE RESTRICT |
| `approval_task_id` | `uuid` | YES | FK → `workflow.approval_task.id`; ON DELETE RESTRICT |
| `action_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `actor_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `from_status` | `varchar(30)` | YES | Trạng thái |
| `to_status` | `varchar(30)` | NO | Trạng thái |
| `comment` | `text` | YES | Thuộc tính nghiệp vụ |
| `acted_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(approval_instance_id, acted_at) (idx_approval_action_instance)`; `actor_user_id (idx_approval_action_log_actor_user_id)`; `approval_task_id (idx_approval_action_log_approval_task_id)`

### `workflow.approval_delegation` — Ủy quyền phê duyệt

- **Loại bảng:** `WORKFLOW`
- **Write owner:** `WorkflowService`
- **Read consumers:** `WorkflowModule`
- **Mục đích:** Dữ liệu workflow cho Ủy quyền phê duyệt; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `delegate_user_id` → `iam.user_account.id` (DELETE RESTRICT); `delegator_user_id` → `iam.user_account.id` (DELETE RESTRICT); `document_type_id` → `mdm.document_type.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 9 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `delegator_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `delegate_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `valid_from` | `timestamptz` | NO | Thuộc tính nghiệp vụ |
| `valid_to` | `timestamptz` | NO | Thuộc tính nghiệp vụ |
| `document_type_id` | `uuid` | YES | FK → `mdm.document_type.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | YES | FK → `org.branch.id`; ON DELETE RESTRICT |
| `maximum_amount` | `numeric(20,4)` | YES | Giá trị tiền tệ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, delegator_user_id, valid_from, valid_to) (idx_approval_delegation_delegator)`; `(company_id, delegate_user_id, status) (idx_approval_delegation_delegate)`; `branch_id (idx_approval_delegation_branch_id)`; `created_by_user_id (idx_approval_delegation_created_by_user_id)`; `delegate_user_id (idx_approval_delegation_delegate_user_id)`; `delegator_user_id (idx_approval_delegation_delegator_user_id)`; `document_type_id (idx_approval_delegation_document_type_id)`

**CHECK:** ``valid_to > valid_from` [name: 'ck_approval_delegation_validity']`

## 11.4. Schema `audit` — Audit và bảo mật

**Owner:** `AuditModule` · **Use Case:** UC-SYS · **Số bảng:** 5

### `audit.audit_log` — Nhật ký kiểm toán

- **Loại bảng:** `AUDIT_LOG`
- **Write owner:** `AuditService / SecurityInterceptor`
- **Read consumers:** `AuditModule`
- **Mục đích:** Nhật ký hành động cấp cao dạng append-only: ai, lúc nào, thao tác gì, trên đối tượng nào. Chi tiết giá trị cũ/mới nằm ở audit_change.
- **PK:** `id`
- **FK ra:** `actor_user_id` → `iam.user_account.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT); `role_assignment_id` → `iam.user_role_assignment.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 7 cột bắt buộc / 7 cột nullable
- **Delete policy:** APPEND_ONLY — không UPDATE/DELETE qua ứng dụng; retention chỉ bằng tác vụ quản trị đặc biệt.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `actor_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `role_assignment_id` | `uuid` | YES | FK → `iam.user_role_assignment.id`; ON DELETE RESTRICT |
| `module_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `action_code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `entity_type` | `varchar(100)` | NO | Thuộc tính nghiệp vụ |
| `entity_id` | `uuid` | YES | Thuộc tính nghiệp vụ |
| `document_id` | `uuid` | YES | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `request_id` | `varchar(100)` | YES | Thuộc tính nghiệp vụ |
| `ip_address` | `varchar(64)` | YES | Thuộc tính nghiệp vụ |
| `user_agent` | `text` | YES | Thuộc tính nghiệp vụ |
| `reason` | `text` | YES | Thuộc tính nghiệp vụ |
| `occurred_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, occurred_at) (idx_audit_log_company_time)`; `(company_id, actor_user_id, occurred_at) (idx_audit_log_actor_time)`; `(entity_type, entity_id, occurred_at) (idx_audit_log_entity)`; `(document_id, occurred_at) (idx_audit_log_document)`; `actor_user_id (idx_audit_log_actor_user_id)`; `role_assignment_id (idx_audit_log_role_assignment_id)`

### `audit.audit_change` — Chi tiết thay đổi dữ liệu

- **Loại bảng:** `AUDIT_LOG`
- **Write owner:** `AuditService / SecurityInterceptor`
- **Read consumers:** `AuditModule`
- **Mục đích:** Lưu Chi tiết thay đổi dữ liệu theo mô hình append-only phục vụ truy vết, kiểm toán và điều tra sự cố; UI nghiệp vụ không được UPDATE/DELETE.
- **PK:** `id`
- **FK ra:** `audit_log_id` → `audit.audit_log.id` (DELETE CASCADE)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 2 cột nullable
- **Delete policy:** APPEND_ONLY — không UPDATE/DELETE qua ứng dụng; retention chỉ bằng tác vụ quản trị đặc biệt.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `audit_log_id` | `uuid` | NO | FK → `audit.audit_log.id`; ON DELETE CASCADE |
| `field_name` | `varchar(150)` | NO | Tên/nhãn hiển thị |
| `old_value_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |
| `new_value_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |

**Indexes:** `audit_log_id (idx_audit_change_log)`

### `audit.login_log` — Nhật ký đăng nhập

- **Loại bảng:** `AUDIT_LOG`
- **Write owner:** `AuditService / SecurityInterceptor`
- **Read consumers:** `AuditModule`
- **Mục đích:** Lưu Nhật ký đăng nhập theo mô hình append-only phục vụ truy vết, kiểm toán và điều tra sự cố; UI nghiệp vụ không được UPDATE/DELETE.
- **PK:** `id`
- **FK ra:** `user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 5 cột nullable
- **Delete policy:** APPEND_ONLY — không UPDATE/DELETE qua ứng dụng; retention chỉ bằng tác vụ quản trị đặc biệt.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `username_or_email` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `login_result` | `varchar(20)` | NO | Thuộc tính nghiệp vụ |
| `failure_reason` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `ip_address` | `varchar(64)` | YES | Thuộc tính nghiệp vụ |
| `user_agent` | `text` | YES | Thuộc tính nghiệp vụ |
| `occurred_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(user_id, occurred_at) (idx_login_log_user_time)`; `(login_result, occurred_at) (idx_login_log_result_time)`

### `audit.data_export_log` — Nhật ký xuất dữ liệu

- **Loại bảng:** `AUDIT_LOG`
- **Write owner:** `AuditService / SecurityInterceptor`
- **Read consumers:** `AuditModule`
- **Mục đích:** Lưu Nhật ký xuất dữ liệu theo mô hình append-only phục vụ truy vết, kiểm toán và điều tra sự cố; UI nghiệp vụ không được UPDATE/DELETE.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 3 cột nullable
- **Delete policy:** APPEND_ONLY — không UPDATE/DELETE qua ứng dụng; retention chỉ bằng tác vụ quản trị đặc biệt.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `module_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `export_type` | `varchar(80)` | NO | Thuộc tính nghiệp vụ |
| `filter_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |
| `row_count` | `bigint` | YES | Thuộc tính nghiệp vụ |
| `file_name` | `varchar(255)` | YES | Tên/nhãn hiển thị |
| `occurred_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, user_id, occurred_at) (idx_data_export_log_user_time)`; `user_id (idx_data_export_log_user_id)`

### `audit.security_event` — Sự kiện bảo mật

- **Loại bảng:** `AUDIT_LOG`
- **Write owner:** `AuditService / SecurityInterceptor`
- **Read consumers:** `AuditModule`
- **Mục đích:** Lưu Sự kiện bảo mật theo mô hình append-only phục vụ truy vết, kiểm toán và điều tra sự cố; UI nghiệp vụ không được UPDATE/DELETE.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 5 cột nullable
- **Delete policy:** APPEND_ONLY — không UPDATE/DELETE qua ứng dụng; retention chỉ bằng tác vụ quản trị đặc biệt.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | YES | FK → `org.company.id`; ON DELETE RESTRICT |
| `user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `event_type` | `varchar(80)` | NO | Thuộc tính nghiệp vụ |
| `severity` | `varchar(20)` | NO | Thuộc tính nghiệp vụ |
| `event_detail_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |
| `ip_address` | `varchar(64)` | YES | Thuộc tính nghiệp vụ |
| `request_id` | `varchar(100)` | YES | Thuộc tính nghiệp vụ |
| `occurred_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(severity, occurred_at) (idx_security_event_severity_time)`; `(company_id, user_id, occurred_at) (idx_security_event_user_time)`; `user_id (idx_security_event_user_id)`

## 11.5. Schema `mdm` — Danh mục dùng chung

**Owner:** `MasterDataModule` · **Use Case:** UC-MD · **Số bảng:** 24

### `mdm.currency` — Tiền tệ

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `AccountsPayableModule`, `AccountsReceivableModule`, `CashModule`, `DocumentCoreModule`, `GeneralLedgerModule`, `MasterDataModule`, `OrganizationModule`, `PurchaseModule`, `ReportingModule`, `SalesModule`, `TaxModule`
- **Mục đích:** Danh mục Tiền tệ dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `code`
- **Nullability:** 5 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `code` | `varchar(3)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(100)` | NO | Tên/nhãn hiển thị |
| `decimal_places` | `smallint` | NO | Thuộc tính nghiệp vụ; default=0 |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `code (uq_currency_code)`

### `mdm.exchange_rate_type` — Loại tỷ giá

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `GeneralLedgerModule`, `MasterDataModule`
- **Mục đích:** Danh mục Loại tỷ giá dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 5 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(100)` | NO | Tên/nhãn hiển thị |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_exchange_rate_type)`

### `mdm.exchange_rate` — Tỷ giá

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `MasterDataModule`
- **Mục đích:** Danh mục Tỷ giá dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `from_currency_id` → `mdm.currency.id` (DELETE RESTRICT); `rate_type_id` → `mdm.exchange_rate_type.id` (DELETE RESTRICT); `source_bank_id` → `mdm.bank.id` (DELETE RESTRICT); `to_currency_id` → `mdm.currency.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, rate_type_id, from_currency_id, to_currency_id, effective_date)`
- **Nullability:** 8 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `rate_type_id` | `uuid` | NO | FK → `mdm.exchange_rate_type.id`; ON DELETE RESTRICT |
| `from_currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `to_currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `effective_date` | `date` | NO | Ngày nghiệp vụ |
| `rate` | `numeric(20,8)` | NO | Thuộc tính nghiệp vụ |
| `source_bank_id` | `uuid` | YES | FK → `mdm.bank.id`; ON DELETE RESTRICT |
| `source_description` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, rate_type_id, from_currency_id, to_currency_id, effective_date) (uq_exchange_rate)`; `(company_id, effective_date) (idx_exchange_rate_date)`; `from_currency_id (idx_exchange_rate_from_currency_id)`; `rate_type_id (idx_exchange_rate_rate_type_id)`; `source_bank_id (idx_exchange_rate_source_bank_id)`; `to_currency_id (idx_exchange_rate_to_currency_id)`

**CHECK:** ``rate > 0` [name: 'ck_exchange_rate_positive']`

### `mdm.payment_term` — Điều khoản thanh toán

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `MasterDataModule`, `PurchaseModule`, `SalesModule`
- **Mục đích:** Danh mục Điều khoản thanh toán dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 6 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(150)` | NO | Tên/nhãn hiển thị |
| `due_days` | `integer` | NO | Thuộc tính nghiệp vụ; default=0 |
| `discount_days` | `integer` | YES | Thuộc tính nghiệp vụ |
| `discount_rate` | `numeric(9,6)` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_payment_term)`

### `mdm.tax_rate` — Thuế suất

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `GeneralLedgerModule`, `MasterDataModule`, `PurchaseModule`, `SalesModule`
- **Mục đích:** Danh mục Thuế suất dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code, effective_from)`
- **Nullability:** 8 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `tax_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `rate_percent` | `numeric(9,4)` | NO | Thuộc tính nghiệp vụ |
| `deductible` | `boolean` | NO | Thuộc tính nghiệp vụ; default=true |
| `effective_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code, effective_from) (uq_tax_rate_version)`; `(company_id, tax_type, status) (idx_tax_rate_type)`

**CHECK:** ``effective_to is null or effective_to >= effective_from` [name: 'ck_tax_rate_validity']`

### `mdm.project` — Dự án

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `BankingModule`, `CashModule`, `DocumentCoreModule`, `GeneralLedgerModule`, `IamModule`, `MasterDataModule`, `PurchaseModule`, `SalesModule`
- **Mục đích:** Danh mục Dự án dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 5 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `start_date` | `date` | YES | Ngày nghiệp vụ |
| `end_date` | `date` | YES | Ngày nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_project)`

### `mdm.cost_center` — Trung tâm chi phí

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `BankingModule`, `CashModule`, `DocumentCoreModule`, `GeneralLedgerModule`, `IamModule`, `MasterDataModule`, `PurchaseModule`, `SalesModule`
- **Mục đích:** Danh mục Trung tâm chi phí dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `parent_id` → `mdm.cost_center.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 5 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `parent_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_cost_center)`; `parent_id (idx_cost_center_parent)`

### `mdm.party` — Đối tượng khách hàng/NCC

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `AccountsPayableModule`, `AccountsReceivableModule`, `BankingModule`, `CashModule`, `DocumentCoreModule`, `FixedAssetModule`, `GeneralLedgerModule`, `InventoryModule`, `MasterDataModule`, `PurchaseModule`, `SalesModule`, `TaxModule`
- **Mục đích:** Danh mục Đối tượng khách hàng/NCC dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `default_currency_id` → `mdm.currency.id` (DELETE RESTRICT); `payment_term_id` → `mdm.payment_term.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`, `(company_id, tax_code)`
- **Nullability:** 7 cột bắt buộc / 5 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `legal_name` | `varchar(255)` | YES | Tên/nhãn hiển thị |
| `tax_code` | `varchar(30)` | YES | Mã nghiệp vụ/danh mục |
| `identity_no` | `varchar(50)` | YES | Số chứng từ/tham chiếu |
| `default_currency_id` | `uuid` | YES | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `payment_term_id` | `uuid` | YES | FK → `mdm.payment_term.id`; ON DELETE RESTRICT |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, code) (uq_party_company_code)`; `(company_id, tax_code) (uq_party_company_tax_code)`; `(company_id, name) (idx_party_name)`; `default_currency_id (idx_party_default_currency_id)`; `payment_term_id (idx_party_payment_term_id)`

### `mdm.party_role` — Vai trò của đối tượng

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `MasterDataModule`
- **Mục đích:** Danh mục Vai trò của đối tượng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `party_id`, `role_type`
- **FK ra:** `party_id` → `mdm.party.id` (DELETE CASCADE)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `party_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE CASCADE |
| `role_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `active_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `active_to` | `date` | YES | Thuộc tính nghiệp vụ |

**Indexes:** Không có index phụ

### `mdm.party_address` — Địa chỉ đối tượng

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `MasterDataModule`
- **Mục đích:** Danh mục Địa chỉ đối tượng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `party_id` → `mdm.party.id` (DELETE CASCADE)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `party_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE CASCADE |
| `address_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `address_line` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `province_code` | `varchar(20)` | YES | Mã nghiệp vụ/danh mục |
| `district_code` | `varchar(20)` | YES | Mã nghiệp vụ/danh mục |
| `ward_code` | `varchar(20)` | YES | Mã nghiệp vụ/danh mục |
| `is_default` | `boolean` | NO | Cờ cấu hình; default=false |

**Indexes:** `(party_id, address_type) (idx_party_address_type)`

### `mdm.bank` — Ngân hàng

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `MasterDataModule`
- **Mục đích:** Danh mục Ngân hàng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `code`
- **Nullability:** 4 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `swift_code` | `varchar(30)` | YES | Mã nghiệp vụ/danh mục |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `code (uq_bank_code)`

### `mdm.party_bank_account` — Tài khoản ngân hàng đối tượng

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `MasterDataModule`
- **Mục đích:** Danh mục Tài khoản ngân hàng đối tượng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `bank_id` → `mdm.bank.id` (DELETE RESTRICT); `party_id` → `mdm.party.id` (DELETE CASCADE)
- **UNIQUE:** `(party_id, account_number)`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `party_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE CASCADE |
| `bank_id` | `uuid` | NO | FK → `mdm.bank.id`; ON DELETE RESTRICT |
| `account_number` | `varchar(100)` | NO | Thuộc tính nghiệp vụ |
| `account_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `branch_name` | `varchar(255)` | YES | Tên/nhãn hiển thị |
| `is_default` | `boolean` | NO | Cờ cấu hình; default=false |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(party_id, account_number) (uq_party_bank_account)`; `bank_id (idx_party_bank_account_bank_id)`

### `mdm.item_category` — Nhóm vật tư/hàng hóa

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `MasterDataModule`
- **Mục đích:** Danh mục Nhóm vật tư/hàng hóa dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `parent_id` → `mdm.item_category.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 5 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `parent_id` | `uuid` | YES | FK → `mdm.item_category.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_item_category)`; `parent_id (idx_item_category_parent)`

### `mdm.unit_of_measure` — Đơn vị tính

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `InventoryModule`, `MasterDataModule`, `PurchaseModule`, `SalesModule`
- **Mục đích:** Danh mục Đơn vị tính dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 5 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(100)` | NO | Tên/nhãn hiển thị |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_uom)`

### `mdm.item` — Vật tư/hàng hóa/dịch vụ

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `InventoryModule`, `MasterDataModule`, `PurchaseModule`, `SalesModule`
- **Mục đích:** Danh mục Vật tư/hàng hóa/dịch vụ dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `base_uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT); `category_id` → `mdm.item_category.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `default_tax_rate_id` → `mdm.tax_rate.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 12 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `category_id` | `uuid` | YES | FK → `mdm.item_category.id`; ON DELETE RESTRICT |
| `base_uom_id` | `uuid` | NO | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `item_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `track_inventory` | `boolean` | NO | Thuộc tính nghiệp vụ; default=true |
| `track_lot` | `boolean` | NO | Thuộc tính nghiệp vụ; default=false |
| `track_serial` | `boolean` | NO | Thuộc tính nghiệp vụ; default=false |
| `valuation_method` | `varchar(30)` | YES | Thuộc tính nghiệp vụ |
| `default_tax_rate_id` | `uuid` | YES | FK → `mdm.tax_rate.id`; ON DELETE RESTRICT |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, code) (uq_item)`; `(company_id, category_id, status) (idx_item_category_status)`; `base_uom_id (idx_item_base_uom_id)`; `category_id (idx_item_category_id)`; `default_tax_rate_id (idx_item_default_tax_rate_id)`

### `mdm.item_uom_conversion` — Quy đổi đơn vị tính

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `MasterDataModule`
- **Mục đích:** Danh mục Quy đổi đơn vị tính dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `from_uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE CASCADE); `to_uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(item_id, from_uom_id, to_uom_id)`
- **Nullability:** 5 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE CASCADE |
| `from_uom_id` | `uuid` | NO | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `to_uom_id` | `uuid` | NO | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `factor` | `numeric(20,8)` | NO | Thuộc tính nghiệp vụ |

**Indexes:** `(item_id, from_uom_id, to_uom_id) (uq_item_uom_conversion)`; `from_uom_id (idx_item_uom_conversion_from_uom_id)`; `to_uom_id (idx_item_uom_conversion_to_uom_id)`

### `mdm.warehouse` — Kho

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `GeneralLedgerModule`, `IamModule`, `InventoryModule`, `MasterDataModule`, `PurchaseModule`, `SalesModule`
- **Mục đích:** Danh mục Kho dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `keeper_employee_id` → `org.employee.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 6 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `address` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `keeper_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_warehouse)`; `(branch_id, status) (idx_warehouse_branch_status)`; `keeper_employee_id (idx_warehouse_keeper_employee_id)`

### `mdm.inventory_location` — Vị trí trong kho

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `InventoryModule`, `MasterDataModule`, `PurchaseModule`, `SalesModule`
- **Mục đích:** Danh mục Vị trí trong kho dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `parent_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(warehouse_id, code)`
- **Nullability:** 5 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `parent_id` | `uuid` | YES | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(150)` | NO | Tên/nhãn hiển thị |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(warehouse_id, code) (uq_inventory_location)`; `parent_id (idx_inventory_location_parent_id)`

### `mdm.company_bank_account` — Tài khoản ngân hàng doanh nghiệp

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `BankingModule`, `IamModule`, `MasterDataModule`, `TaxModule`
- **Mục đích:** Danh mục Tài khoản ngân hàng doanh nghiệp dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `bank_id` → `mdm.bank.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `gl_account_id` → `gl.account.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, account_number)`
- **Nullability:** 8 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `bank_id` | `uuid` | NO | FK → `mdm.bank.id`; ON DELETE RESTRICT |
| `account_number` | `varchar(100)` | NO | Thuộc tính nghiệp vụ |
| `account_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `gl_account_id` | `uuid` | YES | FK → `gl.account.id`; ON DELETE RESTRICT |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, account_number) (uq_company_bank_account)`; `(branch_id, status) (idx_company_bank_branch)`; `bank_id (idx_company_bank_account_bank_id)`; `currency_id (idx_company_bank_account_currency_id)`; `gl_account_id (idx_company_bank_account_gl_account_id)`

### `mdm.document_type` — Loại chứng từ

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `DocumentCoreModule`, `GeneralLedgerModule`, `MasterDataModule`, `WorkflowModule`
- **Mục đích:** Registry loại chứng từ. Lưu phân hệ, lớp chứng từ, mã mẫu pháp lý, cờ workflow/posting/kho/công nợ/thuế; không hard-code mã mẫu TT99 vào tên bảng.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `code`
- **Nullability:** 13 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `module_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `document_class` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `legal_form_code` | `varchar(50)` | YES | Mã nghiệp vụ/danh mục |
| `legal_basis` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `supports_workflow` | `boolean` | NO | Cờ cấu hình; default=true |
| `requires_posting` | `boolean` | NO | Cờ cấu hình; default=false |
| `creates_inventory` | `boolean` | NO | Cờ cấu hình; default=false |
| `creates_receivable` | `boolean` | NO | Cờ cấu hình; default=false |
| `creates_payable` | `boolean` | NO | Cờ cấu hình; default=false |
| `creates_tax_record` | `boolean` | NO | Cờ cấu hình; default=false |
| `allows_manual_number` | `boolean` | NO | Thuộc tính nghiệp vụ; default=false |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `code (uq_document_type_code)`; `(module_code, document_class, status) (idx_document_type_module_class)`

### `mdm.document_numbering_rule` — Quy tắc đánh số chứng từ

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `DocumentCoreModule`, `MasterDataModule`
- **Mục đích:** Cấu hình/danh mục cho Quy tắc đánh số chứng từ. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `document_type_id` → `mdm.document_type.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 10 cột bắt buộc / 5 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | YES | FK → `org.branch.id`; ON DELETE RESTRICT |
| `document_type_id` | `uuid` | NO | FK → `mdm.document_type.id`; ON DELETE RESTRICT |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `prefix` | `varchar(30)` | YES | Thuộc tính nghiệp vụ |
| `suffix` | `varchar(30)` | YES | Thuộc tính nghiệp vụ |
| `separator` | `varchar(10)` | YES | Thuộc tính nghiệp vụ |
| `padding_length` | `smallint` | NO | Thuộc tính nghiệp vụ; default=6 |
| `reset_policy` | `varchar(20)` | NO | Thuộc tính nghiệp vụ; default='YEARLY' |
| `include_branch_code` | `boolean` | NO | Mã nghiệp vụ/danh mục; default=false |
| `include_fiscal_year` | `boolean` | NO | Thuộc tính nghiệp vụ; default=true |
| `effective_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_document_numbering_rule_code)`; `(company_id, document_type_id, branch_id, effective_from) (idx_document_numbering_rule_scope)`; `branch_id (idx_document_numbering_rule_branch_id)`; `document_type_id (idx_document_numbering_rule_document_type_id)`

**CHECK:** ``effective_to is null or effective_to >= effective_from` [name: 'ck_document_numbering_rule_validity']`; ``padding_length > 0` [name: 'ck_document_numbering_rule_padding']`

### `mdm.party_contact` — Người liên hệ đối tượng

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `MasterDataModule`
- **Mục đích:** Danh mục Người liên hệ đối tượng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `id`
- **FK ra:** `party_id` → `mdm.party.id` (DELETE CASCADE)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `party_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE CASCADE |
| `contact_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `contact_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `job_title` | `varchar(150)` | YES | Thuộc tính nghiệp vụ |
| `email` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `phone` | `varchar(30)` | YES | Thuộc tính nghiệp vụ |
| `is_default` | `boolean` | NO | Cờ cấu hình; default=false |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(party_id, contact_type, status) (idx_party_contact_type)`

### `mdm.customer_profile` — Hồ sơ khách hàng

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `MasterDataModule`
- **Mục đích:** Danh mục Hồ sơ khách hàng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `party_id`
- **FK ra:** `receivable_account_id` → `gl.account.id` (DELETE RESTRICT); `revenue_account_id` → `gl.account.id` (DELETE RESTRICT); `party_id` → `mdm.party.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 2 cột bắt buộc / 5 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `party_id` | `uuid` | NO | FK → `mdm.party.id`; PK; ON DELETE RESTRICT |
| `receivable_account_id` | `uuid` | YES | FK → `gl.account.id`; ON DELETE RESTRICT |
| `revenue_account_id` | `uuid` | YES | FK → `gl.account.id`; ON DELETE RESTRICT |
| `credit_limit` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `credit_days` | `integer` | YES | Thuộc tính nghiệp vụ |
| `price_list_code` | `varchar(80)` | YES | Mã nghiệp vụ/danh mục |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `receivable_account_id (idx_customer_profile_receivable_account_id)`; `revenue_account_id (idx_customer_profile_revenue_account_id)`

### `mdm.vendor_profile` — Hồ sơ nhà cung cấp

- **Loại bảng:** `MASTER_DATA`
- **Write owner:** `MasterDataModule`
- **Read consumers:** `MasterDataModule`
- **Mục đích:** Danh mục Hồ sơ nhà cung cấp dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.
- **PK:** `party_id`
- **FK ra:** `party_id` → `mdm.party.id` (DELETE RESTRICT); `expense_account_id` → `gl.account.id` (DELETE RESTRICT); `payable_account_id` → `gl.account.id` (DELETE RESTRICT); `purchase_account_id` → `gl.account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 2 cột bắt buộc / 4 cột nullable
- **Delete policy:** DEACTIVATE — chuyển INACTIVE/LOCKED; FK RESTRICT bảo vệ khi đã được dùng.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `party_id` | `uuid` | NO | FK → `mdm.party.id`; PK; ON DELETE RESTRICT |
| `payable_account_id` | `uuid` | YES | FK → `gl.account.id`; ON DELETE RESTRICT |
| `expense_account_id` | `uuid` | YES | FK → `gl.account.id`; ON DELETE RESTRICT |
| `purchase_account_id` | `uuid` | YES | FK → `gl.account.id`; ON DELETE RESTRICT |
| `payment_priority` | `varchar(20)` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `expense_account_id (idx_vendor_profile_expense_account_id)`; `payable_account_id (idx_vendor_profile_payable_account_id)`; `purchase_account_id (idx_vendor_profile_purchase_account_id)`

## 11.6. Schema `core` — Lõi chứng từ và cấu hình

**Owner:** `DocumentCoreModule` · **Use Case:** Cross-cutting / UC-SYS · **Số bảng:** 14

### `core.business_document` — Chứng từ nghiệp vụ dùng chung

- **Loại bảng:** `DOCUMENT_CORE`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `AccountsPayableModule`, `AccountsReceivableModule`, `AuditModule`, `BankingModule`, `CashModule`, `CcdcModule`, `DocumentCoreModule`, `FixedAssetModule`, `GeneralLedgerModule`, `IamModule`, `InventoryModule`, `PurchaseModule`, `SalesModule`, `TaxModule`, `WorkflowModule`
- **Mục đích:** Header chuẩn dùng chung cho mọi chứng từ nghiệp vụ: số chứng từ, ngày, tiền tệ, trạng thái, workflow, tổng tiền và người tạo/sửa. Các bảng chứng từ chuyên ngành mở rộng 1:1 từ bảng này.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `counterparty_id` → `mdm.party.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `document_type_id` → `mdm.document_type.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT); `updated_by_user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, branch_id, document_type_id, fiscal_year, document_no)`
- **Nullability:** 20 cột bắt buộc / 6 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `document_type_id` | `uuid` | NO | FK → `mdm.document_type.id`; ON DELETE RESTRICT |
| `document_no` | `varchar(80)` | NO | Số chứng từ/tham chiếu |
| `fiscal_year` | `integer` | NO | Thuộc tính nghiệp vụ |
| `document_date` | `date` | NO | Ngày nghiệp vụ |
| `posting_date` | `date` | YES | Ngày nghiệp vụ |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `exchange_rate` | `numeric(20,8)` | NO | Thuộc tính nghiệp vụ; default=1 |
| `counterparty_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |
| `document_status` | `varchar(30)` | NO | Trạng thái; default='DRAFT' |
| `workflow_status` | `varchar(30)` | NO | Trạng thái; default='NOT_STARTED' |
| `source_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ; default='MANUAL' |
| `total_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `total_tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `total_amount_base` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `description` | `text` | YES | Thuộc tính nghiệp vụ |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `row_version` | `bigint` | NO | Thuộc tính nghiệp vụ; default=1 |
| `deleted_at` | `timestamptz` | YES | Thời điểm hệ thống |

**Indexes:** `(company_id, branch_id, document_type_id, fiscal_year, document_no) (uq_business_document_no)`; `(company_id, document_type_id, document_date) (idx_business_document_type_date)`; `(company_id, branch_id, document_status, document_date) (idx_business_document_branch_status_date)`; `counterparty_id (idx_business_document_counterparty)`; `posting_date (idx_business_document_posting_date)`; `branch_id (idx_business_document_branch_id)`; `cost_center_id (idx_business_document_cost_center_id)`; `created_by_user_id (idx_business_document_created_by_user_id)`; `currency_id (idx_business_document_currency_id)`; `document_type_id (idx_business_document_document_type_id)`; `project_id (idx_business_document_project_id)`; `updated_by_user_id (idx_business_document_updated_by_user_id)`

**CHECK:** ``document_status in ('DRAFT','SUBMITTED','APPROVED','POSTED','CANCELLED','REVERSED')` [name: 'ck_business_document_status']`; ``workflow_status in ('NOT_STARTED','RUNNING','APPROVED','REJECTED','CANCELLED')` [name: 'ck_business_document_workflow_status']`; ``exchange_rate > 0` [name: 'ck_business_document_exchange_rate']`; ``row_version > 0` [name: 'ck_business_document_row_version']`

### `core.document_status_history` — Lịch sử trạng thái chứng từ

- **Loại bảng:** `HISTORY`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Lưu dữ liệu Lịch sử trạng thái chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.
- **PK:** `id`
- **FK ra:** `changed_by` → `iam.user_account.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `from_status` | `varchar(30)` | YES | Trạng thái |
| `to_status` | `varchar(30)` | NO | Trạng thái |
| `changed_by` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `changed_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `reason` | `text` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(document_id, changed_at) (idx_document_status_history)`; `changed_by (idx_document_status_history_changed_by)`

### `core.document_link` — Liên kết chuỗi chứng từ

- **Loại bảng:** `RELATIONSHIP`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Bảng quan hệ/ánh xạ cho Liên kết chuỗi chứng từ; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `source_document_id` → `core.business_document.id` (DELETE RESTRICT); `target_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `(source_document_id, target_document_id, link_type)`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `source_document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `target_document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `link_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `linked_amount` | `numeric(20,4)` | YES | Giá trị tiền tệ |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(source_document_id, target_document_id, link_type) (uq_document_link)`; `source_document_id (idx_document_link_source)`; `target_document_id (idx_document_link_target)`; `company_id (idx_document_link_company_id)`; `created_by_user_id (idx_document_link_created_by_user_id)`

### `core.document_attachment` — Tệp đính kèm chứng từ

- **Loại bảng:** `DOCUMENT_CORE`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Lưu dữ liệu Tệp đính kèm chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.
- **PK:** `id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `uploaded_by` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 8 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `file_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `mime_type` | `varchar(120)` | NO | Thuộc tính nghiệp vụ |
| `storage_key` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `file_size` | `bigint` | NO | Thuộc tính nghiệp vụ |
| `checksum_sha256` | `varchar(64)` | YES | Thuộc tính nghiệp vụ |
| `uploaded_by` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `uploaded_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(document_id, uploaded_at) (idx_document_attachment)`; `uploaded_by (idx_document_attachment_uploaded_by)`

### `core.document_reference` — Tham chiếu ngoài của chứng từ

- **Loại bảng:** `DOCUMENT_CORE`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Lưu dữ liệu Tham chiếu ngoài của chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.
- **PK:** `id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `(document_id, reference_type, reference_no)`
- **Nullability:** 4 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `reference_type` | `varchar(50)` | NO | Thuộc tính nghiệp vụ |
| `reference_no` | `varchar(150)` | NO | Số chứng từ/tham chiếu |
| `reference_date` | `date` | YES | Ngày nghiệp vụ |
| `issuer_name` | `varchar(255)` | YES | Tên/nhãn hiển thị |

**Indexes:** `(document_id, reference_type, reference_no) (uq_document_reference)`

### `core.document_signature` — Chữ ký chứng từ

- **Loại bảng:** `DOCUMENT_CORE`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Lưu dữ liệu Chữ ký chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.
- **PK:** `id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `rendered_output_id` → `core.document_rendered_output.id` (DELETE RESTRICT); `signer_user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 4 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `rendered_output_id` | `uuid` | YES | FK → `core.document_rendered_output.id`; ON DELETE RESTRICT |
| `signer_user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `signer_name_snapshot` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `signer_title_snapshot` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `signature_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `signature_hash` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `signed_at` | `timestamptz` | NO | Thời điểm hệ thống |

**Indexes:** `(document_id, signed_at) (idx_document_signature)`; `rendered_output_id (idx_document_signature_rendered_output_id)`; `signer_user_id (idx_document_signature_signer_user_id)`

### `core.document_template` — Mẫu in chứng từ

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Cấu hình/danh mục cho Mẫu in chứng từ. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `document_type_id` → `mdm.document_type.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `document_type_id` | `uuid` | NO | FK → `mdm.document_type.id`; ON DELETE RESTRICT |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_document_template_code)`; `document_type_id (idx_document_template_document_type_id)`

### `core.document_template_version` — Phiên bản mẫu in

- **Loại bảng:** `VERSIONED_CONFIG`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Phiên bản hóa Phiên bản mẫu in. Khi version đã được publish/được chứng từ tham chiếu thì giữ bất biến và tạo version mới khi thay đổi.
- **PK:** `id`
- **FK ra:** `template_id` → `core.document_template.id` (DELETE CASCADE)
- **UNIQUE:** `(template_id, version_no)`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** VERSIONED — không sửa/xóa version đã publish hoặc đã được tham chiếu.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `template_id` | `uuid` | NO | FK → `core.document_template.id`; ON DELETE CASCADE |
| `version_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `template_engine` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `template_body` | `text` | NO | Thuộc tính nghiệp vụ |
| `effective_from` | `timestamptz` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `timestamptz` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(template_id, version_no) (uq_document_template_version)`

### `core.document_lock` — Khóa chỉnh sửa chứng từ

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Khóa chỉnh sửa chứng từ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `locked_by_user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** `lock_token`
- **Nullability:** 5 cột bắt buộc / 0 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `locked_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `lock_token` | `varchar(100)` | NO | Thuộc tính nghiệp vụ |
| `locked_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `expires_at` | `timestamptz` | NO | Thời điểm hệ thống |

**Indexes:** `lock_token (uq_document_lock_token)`; `(locked_by_user_id, expires_at) (idx_document_lock_user)`

### `core.configuration_definition` — Định nghĩa cấu hình

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Cấu hình/danh mục cho Định nghĩa cấu hình. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `configuration_key`
- **Nullability:** 8 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `configuration_key` | `varchar(120)` | NO | Thuộc tính nghiệp vụ |
| `configuration_group` | `varchar(50)` | NO | Thuộc tính nghiệp vụ |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `description` | `varchar(1000)` | YES | Thuộc tính nghiệp vụ |
| `data_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `default_value_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |
| `validation_rule_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |
| `is_sensitive` | `boolean` | NO | Cờ cấu hình; default=false |
| `requires_confirmation` | `boolean` | NO | Cờ cấu hình; default=false |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `configuration_key (uq_configuration_definition_key)`; `(configuration_group, status) (idx_configuration_definition_group)`

### `core.company_configuration_value` — Giá trị cấu hình doanh nghiệp

- **Loại bảng:** `DOCUMENT_CORE`
- **Write owner:** `ConfigurationService`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Lưu dữ liệu Giá trị cấu hình doanh nghiệp thuộc phân hệ Lõi chứng từ và cấu hình.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `configuration_definition_id` → `core.configuration_definition.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, configuration_scope_key, configuration_definition_id, effective_from)`
- **Nullability:** 9 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | YES | FK → `org.branch.id`; ON DELETE RESTRICT |
| `configuration_definition_id` | `uuid` | NO | FK → `core.configuration_definition.id`; ON DELETE RESTRICT |
| `configuration_scope_key` | `varchar(120)` | NO | Thuộc tính nghiệp vụ |
| `value_json` | `jsonb` | NO | Dữ liệu cấu hình/payload có cấu trúc |
| `effective_from` | `timestamptz` | NO | Thuộc tính nghiệp vụ; default=`now()` |
| `effective_to` | `timestamptz` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `change_reason` | `text` | YES | Thuộc tính nghiệp vụ |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, configuration_scope_key, configuration_definition_id, effective_from) (uq_company_configuration_version)`; `(company_id, configuration_definition_id, status) (idx_company_configuration_active)`; `branch_id (idx_company_configuration_value_branch_id)`; `configuration_definition_id (idx_company_configuration_value_configuration_definition_id)`; `created_by_user_id (idx_company_configuration_value_created_by_user_id)`

**CHECK:** ``effective_to is null or effective_to >= effective_from` [name: 'ck_company_configuration_validity']`

### `core.document_number_sequence` — Bộ đếm số chứng từ

- **Loại bảng:** `DOCUMENT_CORE`
- **Write owner:** `DocumentNumberingService`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Bộ đếm số chứng từ theo scope/năm tài chính. Khi cấp số phải khóa hàng hoặc dùng UPDATE ... RETURNING; tuyệt đối không dùng MAX(document_no)+1.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `document_type_id` → `mdm.document_type.id` (DELETE RESTRICT); `numbering_rule_id` → `mdm.document_numbering_rule.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, sequence_scope_key, fiscal_year)`
- **Nullability:** 8 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | YES | FK → `org.branch.id`; ON DELETE RESTRICT |
| `document_type_id` | `uuid` | NO | FK → `mdm.document_type.id`; ON DELETE RESTRICT |
| `numbering_rule_id` | `uuid` | NO | FK → `mdm.document_numbering_rule.id`; ON DELETE RESTRICT |
| `fiscal_year` | `integer` | NO | Thuộc tính nghiệp vụ |
| `sequence_scope_key` | `varchar(120)` | NO | Thuộc tính nghiệp vụ |
| `last_number` | `bigint` | NO | Thuộc tính nghiệp vụ; default=0 |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, sequence_scope_key, fiscal_year) (uq_document_number_sequence_scope)`; `(numbering_rule_id, fiscal_year) (idx_document_number_sequence_rule)`; `branch_id (idx_document_number_sequence_branch_id)`; `document_type_id (idx_document_number_sequence_document_type_id)`

### `core.document_note` — Ghi chú chứng từ

- **Loại bảng:** `DOCUMENT_CORE`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Lưu dữ liệu Ghi chú chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.
- **PK:** `id`
- **FK ra:** `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `note_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ; default='INTERNAL' |
| `note_text` | `text` | NO | Thuộc tính nghiệp vụ |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(document_id, created_at) (idx_document_note)`; `created_by_user_id (idx_document_note_created_by_user_id)`

### `core.document_rendered_output` — Bản kết xuất chứng từ

- **Loại bảng:** `DOCUMENT_CORE`
- **Write owner:** `DocumentCoreModule`
- **Read consumers:** `DocumentCoreModule`
- **Mục đích:** Lưu dữ liệu Bản kết xuất chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.
- **PK:** `id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `generated_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `template_version_id` → `core.document_template_version.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 10 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `template_version_id` | `uuid` | NO | FK → `core.document_template_version.id`; ON DELETE RESTRICT |
| `output_format` | `varchar(20)` | NO | Thuộc tính nghiệp vụ |
| `storage_key` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `file_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `checksum_sha256` | `varchar(64)` | NO | Thuộc tính nghiệp vụ |
| `is_final` | `boolean` | NO | Cờ cấu hình; default=false |
| `generated_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `generated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(document_id, generated_at) (idx_document_rendered_output_document)`; `checksum_sha256 (idx_document_rendered_output_checksum)`; `generated_by_user_id (idx_document_rendered_output_generated_by_user_id)`; `template_version_id (idx_document_rendered_output_template_version_id)`

## 11.7. Schema `pur` — Mua hàng

**Owner:** `PurchaseModule` · **Use Case:** UC-PUR · **Số bảng:** 21

### `pur.purchase_request` — Yêu cầu mua hàng

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Yêu cầu mua hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `department_id` → `org.department.id` (DELETE RESTRICT); `requester_employee_id` → `org.employee.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 3 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `requester_employee_id` | `uuid` | NO | FK → `org.employee.id`; ON DELETE RESTRICT |
| `department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `required_date` | `date` | YES | Ngày nghiệp vụ |
| `priority` | `varchar(20)` | NO | Thuộc tính nghiệp vụ; default='NORMAL' |
| `purpose` | `text` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `department_id (idx_purchase_request_department_id)`; `requester_employee_id (idx_purchase_request_requester_employee_id)`

### `pur.purchase_request_line` — Chi tiết yêu cầu mua hàng

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết yêu cầu mua hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT); `purchase_request_id` → `pur.purchase_request.document_id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(purchase_request_id, line_no)`
- **Nullability:** 5 cột bắt buộc / 6 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `purchase_request_id` | `uuid` | NO | FK → `pur.purchase_request.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_id` | `uuid` | YES | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `description` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `uom_id` | `uuid` | YES | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `quantity` | `numeric(20,6)` | NO | Số lượng |
| `estimated_unit_price` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |

**Indexes:** `(purchase_request_id, line_no) (uq_purchase_request_line)`; `cost_center_id (idx_purchase_request_line_cost_center_id)`; `item_id (idx_purchase_request_line_item_id)`; `project_id (idx_purchase_request_line_project_id)`; `uom_id (idx_purchase_request_line_uom_id)`; `warehouse_id (idx_purchase_request_line_warehouse_id)`

### `pur.purchase_order` — Đơn mua hàng

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Đơn mua hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `buyer_employee_id` → `org.employee.id` (DELETE RESTRICT); `payment_term_id` → `mdm.payment_term.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 5 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `buyer_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `payment_term_id` | `uuid` | YES | FK → `mdm.payment_term.id`; ON DELETE RESTRICT |
| `delivery_address` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `expected_delivery_date` | `date` | YES | Ngày nghiệp vụ |
| `contract_no` | `varchar(100)` | YES | Số chứng từ/tham chiếu |
| `subtotal` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `discount_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `buyer_employee_id (idx_purchase_order_buyer_employee_id)`; `payment_term_id (idx_purchase_order_payment_term_id)`; `vendor_id (idx_purchase_order_vendor_id)`

### `pur.purchase_order_line` — Chi tiết đơn mua hàng

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết đơn mua hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT); `purchase_contract_line_id` → `pur.purchase_contract_line.id` (DELETE RESTRICT); `purchase_order_id` → `pur.purchase_order.document_id` (DELETE RESTRICT); `tax_rate_id` → `mdm.tax_rate.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(purchase_order_id, line_no)`
- **Nullability:** 9 cột bắt buộc / 7 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `purchase_order_id` | `uuid` | NO | FK → `pur.purchase_order.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `purchase_contract_line_id` | `uuid` | YES | FK → `pur.purchase_contract_line.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | YES | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `description` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `uom_id` | `uuid` | YES | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `ordered_quantity` | `numeric(20,6)` | NO | Số lượng |
| `unit_price` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `discount_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `tax_rate_id` | `uuid` | YES | FK → `mdm.tax_rate.id`; ON DELETE RESTRICT |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `line_total_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |

**Indexes:** `(purchase_order_id, line_no) (uq_purchase_order_line)`; `purchase_contract_line_id (idx_purchase_order_line_contract)`; `cost_center_id (idx_purchase_order_line_cost_center_id)`; `item_id (idx_purchase_order_line_item_id)`; `project_id (idx_purchase_order_line_project_id)`; `tax_rate_id (idx_purchase_order_line_tax_rate_id)`; `uom_id (idx_purchase_order_line_uom_id)`; `warehouse_id (idx_purchase_order_line_warehouse_id)`

### `pur.goods_receipt` — Nhận hàng mua

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Nhận hàng mua. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `received_by_employee_id` → `org.employee.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 2 cột bắt buộc / 4 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `received_by_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `delivery_note_no` | `varchar(100)` | YES | Số chứng từ/tham chiếu |
| `receipt_reason` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `received_by_employee_id (idx_goods_receipt_received_by_employee_id)`; `vendor_id (idx_goods_receipt_vendor_id)`; `warehouse_id (idx_goods_receipt_warehouse_id)`

### `pur.goods_receipt_line` — Chi tiết nhận hàng mua

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `InventoryModule`, `PurchaseModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết nhận hàng mua. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `goods_receipt_id` → `pur.goods_receipt.document_id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `location_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `lot_id` → `inv.lot.id` (DELETE RESTRICT); `purchase_order_line_id` → `pur.purchase_order_line.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(goods_receipt_id, line_no)`
- **Nullability:** 7 cột bắt buộc / 5 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `goods_receipt_id` | `uuid` | NO | FK → `pur.goods_receipt.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `purchase_order_line_id` | `uuid` | YES | FK → `pur.purchase_order_line.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `uom_id` | `uuid` | NO | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `document_quantity` | `numeric(20,6)` | NO | Số lượng |
| `actual_quantity` | `numeric(20,6)` | NO | Số lượng |
| `unit_cost` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `amount` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `location_id` | `uuid` | YES | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |
| `lot_id` | `uuid` | YES | FK → `inv.lot.id`; ON DELETE RESTRICT |

**Indexes:** `(goods_receipt_id, line_no) (uq_goods_receipt_line)`; `purchase_order_line_id (idx_gr_line_po_line)`; `item_id (idx_goods_receipt_line_item_id)`; `location_id (idx_goods_receipt_line_location_id)`; `lot_id (idx_goods_receipt_line_lot_id)`; `uom_id (idx_goods_receipt_line_uom_id)`

### `pur.service_receipt` — Nghiệm thu dịch vụ mua

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Nghiệm thu dịch vụ mua. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `accepted_by_employee_id` → `org.employee.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `accepted_by_employee_id` | `uuid` | NO | FK → `org.employee.id`; ON DELETE RESTRICT |
| `service_period_from` | `date` | YES | Thuộc tính nghiệp vụ |
| `service_period_to` | `date` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `accepted_by_employee_id (idx_service_receipt_accepted_by_employee_id)`; `vendor_id (idx_service_receipt_vendor_id)`

### `pur.service_receipt_line` — Chi tiết nghiệm thu dịch vụ

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết nghiệm thu dịch vụ. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `expense_account_id` → `gl.account.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT); `purchase_order_line_id` → `pur.purchase_order_line.id` (DELETE RESTRICT); `service_receipt_id` → `pur.service_receipt.document_id` (DELETE RESTRICT)
- **UNIQUE:** `(service_receipt_id, line_no)`
- **Nullability:** 7 cột bắt buộc / 4 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `service_receipt_id` | `uuid` | NO | FK → `pur.service_receipt.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `purchase_order_line_id` | `uuid` | YES | FK → `pur.purchase_order_line.id`; ON DELETE RESTRICT |
| `description` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `quantity` | `numeric(20,6)` | NO | Số lượng; default=1 |
| `unit_price` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `expense_account_id` | `uuid` | YES | FK → `gl.account.id`; ON DELETE RESTRICT |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |

**Indexes:** `(service_receipt_id, line_no) (uq_service_receipt_line)`; `cost_center_id (idx_service_receipt_line_cost_center_id)`; `expense_account_id (idx_service_receipt_line_expense_account_id)`; `project_id (idx_service_receipt_line_project_id)`; `purchase_order_line_id (idx_service_receipt_line_purchase_order_line_id)`

### `pur.purchase_invoice` — Chứng từ hóa đơn mua

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Chứng từ hóa đơn mua. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `payment_term_id` → `mdm.payment_term.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 4 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `payment_term_id` | `uuid` | YES | FK → `mdm.payment_term.id`; ON DELETE RESTRICT |
| `due_date` | `date` | YES | Ngày nghiệp vụ |
| `supplier_invoice_reference_no` | `varchar(100)` | YES | Số chứng từ/tham chiếu |
| `supplier_invoice_reference_date` | `date` | YES | Ngày nghiệp vụ |
| `subtotal_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `discount_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `total_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `payment_term_id (idx_purchase_invoice_payment_term_id)`; `vendor_id (idx_purchase_invoice_vendor_id)`

### `pur.purchase_invoice_line` — Chi tiết chứng từ hóa đơn mua

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết chứng từ hóa đơn mua. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `ap_account_id` → `gl.account.id` (DELETE RESTRICT); `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `expense_or_inventory_account_id` → `gl.account.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT); `purchase_invoice_id` → `pur.purchase_invoice.document_id` (DELETE RESTRICT); `tax_rate_id` → `mdm.tax_rate.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(purchase_invoice_id, line_no)`
- **Nullability:** 8 cột bắt buộc / 7 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `purchase_invoice_id` | `uuid` | NO | FK → `pur.purchase_invoice.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_id` | `uuid` | YES | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `description` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `uom_id` | `uuid` | YES | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `quantity` | `numeric(20,6)` | YES | Số lượng |
| `unit_price` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `amount_before_tax` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `tax_rate_id` | `uuid` | YES | FK → `mdm.tax_rate.id`; ON DELETE RESTRICT |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `expense_or_inventory_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `ap_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |

**Indexes:** `(purchase_invoice_id, line_no) (uq_purchase_invoice_line)`; `ap_account_id (idx_purchase_invoice_line_ap_account_id)`; `cost_center_id (idx_purchase_invoice_line_cost_center_id)`; `expense_or_inventory_account_id (idx_purchase_invoice_line_expense_or_inventory_account_id)`; `item_id (idx_purchase_invoice_line_item_id)`; `project_id (idx_purchase_invoice_line_project_id)`; `tax_rate_id (idx_purchase_invoice_line_tax_rate_id)`; `uom_id (idx_purchase_invoice_line_uom_id)`

### `pur.purchase_return` — Trả lại hàng mua

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Trả lại hàng mua. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 1 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `reason` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |

**Indexes:** `vendor_id (idx_purchase_return_vendor_id)`; `warehouse_id (idx_purchase_return_warehouse_id)`

### `pur.purchase_return_line` — Chi tiết trả lại hàng mua

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết trả lại hàng mua. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `item_id` → `mdm.item.id` (DELETE RESTRICT); `original_invoice_line_id` → `pur.purchase_invoice_line.id` (DELETE RESTRICT); `original_receipt_line_id` → `pur.goods_receipt_line.id` (DELETE RESTRICT); `purchase_return_id` → `pur.purchase_return.document_id` (DELETE RESTRICT); `tax_rate_id` → `mdm.tax_rate.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(purchase_return_id, line_no)`
- **Nullability:** 6 cột bắt buộc / 6 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `purchase_return_id` | `uuid` | NO | FK → `pur.purchase_return.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `original_receipt_line_id` | `uuid` | YES | FK → `pur.goods_receipt_line.id`; ON DELETE RESTRICT |
| `original_invoice_line_id` | `uuid` | YES | FK → `pur.purchase_invoice_line.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | YES | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `uom_id` | `uuid` | YES | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `quantity` | `numeric(20,6)` | NO | Số lượng |
| `unit_price` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `tax_rate_id` | `uuid` | YES | FK → `mdm.tax_rate.id`; ON DELETE RESTRICT |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `(purchase_return_id, line_no) (uq_purchase_return_line)`; `item_id (idx_purchase_return_line_item_id)`; `original_invoice_line_id (idx_purchase_return_line_original_invoice_line_id)`; `original_receipt_line_id (idx_purchase_return_line_original_receipt_line_id)`; `tax_rate_id (idx_purchase_return_line_tax_rate_id)`; `uom_id (idx_purchase_return_line_uom_id)`

### `pur.landed_cost` — Chi phí mua hàng phân bổ

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Chi phí mua hàng phân bổ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 0 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `allocation_method` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `total_cost` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |

### `pur.landed_cost_line` — Chi tiết chi phí mua hàng

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết chi phí mua hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `landed_cost_id` → `pur.landed_cost.document_id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT)
- **UNIQUE:** `(landed_cost_id, line_no)`
- **Nullability:** 6 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `landed_cost_id` | `uuid` | NO | FK → `pur.landed_cost.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `cost_type` | `varchar(50)` | NO | Thuộc tính nghiệp vụ |
| `vendor_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |

**Indexes:** `(landed_cost_id, line_no) (uq_landed_cost_line)`; `account_id (idx_landed_cost_line_account_id)`; `vendor_id (idx_landed_cost_line_vendor_id)`

### `pur.landed_cost_allocation` — Phân bổ chi phí mua hàng

- **Loại bảng:** `RELATIONSHIP`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Bảng phân bổ/đối chiếu phục vụ Phân bổ chi phí mua hàng. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.
- **PK:** `id`
- **FK ra:** `goods_receipt_line_id` → `pur.goods_receipt_line.id` (DELETE RESTRICT); `landed_cost_line_id` → `pur.landed_cost_line.id` (DELETE RESTRICT)
- **UNIQUE:** `(landed_cost_line_id, goods_receipt_line_id)`
- **Nullability:** 4 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `landed_cost_line_id` | `uuid` | NO | FK → `pur.landed_cost_line.id`; ON DELETE RESTRICT |
| `goods_receipt_line_id` | `uuid` | NO | FK → `pur.goods_receipt_line.id`; ON DELETE RESTRICT |
| `allocated_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `(landed_cost_line_id, goods_receipt_line_id) (uq_landed_cost_allocation)`; `goods_receipt_line_id (idx_landed_cost_allocation_goods_receipt_line_id)`

### `pur.purchase_contract` — Hợp đồng mua hàng

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Hợp đồng mua hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `payment_term_id` → `mdm.payment_term.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 7 cột bắt buộc / 3 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `contract_no` | `varchar(100)` | NO | Số chứng từ/tham chiếu |
| `contract_date` | `date` | NO | Ngày nghiệp vụ |
| `effective_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | YES | Thuộc tính nghiệp vụ |
| `payment_term_id` | `uuid` | YES | FK → `mdm.payment_term.id`; ON DELETE RESTRICT |
| `contract_value` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `contract_status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(vendor_id, contract_no) (idx_purchase_contract_vendor_no)`; `currency_id (idx_purchase_contract_currency_id)`; `payment_term_id (idx_purchase_contract_payment_term_id)`

### `pur.purchase_contract_line` — Chi tiết hợp đồng mua

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết hợp đồng mua. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT); `purchase_contract_id` → `pur.purchase_contract.document_id` (DELETE RESTRICT); `tax_rate_id` → `mdm.tax_rate.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(purchase_contract_id, line_no)`
- **Nullability:** 5 cột bắt buộc / 8 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `purchase_contract_id` | `uuid` | NO | FK → `pur.purchase_contract.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_id` | `uuid` | YES | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `description` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `uom_id` | `uuid` | YES | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `contracted_quantity` | `numeric(20,6)` | YES | Số lượng |
| `unit_price` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `contract_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `tax_rate_id` | `uuid` | YES | FK → `mdm.tax_rate.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |

**Indexes:** `(purchase_contract_id, line_no) (uq_purchase_contract_line)`; `cost_center_id (idx_purchase_contract_line_cost_center_id)`; `item_id (idx_purchase_contract_line_item_id)`; `project_id (idx_purchase_contract_line_project_id)`; `tax_rate_id (idx_purchase_contract_line_tax_rate_id)`; `uom_id (idx_purchase_contract_line_uom_id)`; `warehouse_id (idx_purchase_contract_line_warehouse_id)`

### `pur.purchase_request_order_allocation` — Phân bổ yêu cầu mua vào đơn mua

- **Loại bảng:** `RELATIONSHIP`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Bảng phân bổ/đối chiếu phục vụ Phân bổ yêu cầu mua vào đơn mua. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.
- **PK:** `id`
- **FK ra:** `purchase_order_line_id` → `pur.purchase_order_line.id` (DELETE RESTRICT); `purchase_request_line_id` → `pur.purchase_request_line.id` (DELETE RESTRICT)
- **UNIQUE:** `(purchase_request_line_id, purchase_order_line_id)`
- **Nullability:** 4 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `purchase_request_line_id` | `uuid` | NO | FK → `pur.purchase_request_line.id`; ON DELETE RESTRICT |
| `purchase_order_line_id` | `uuid` | NO | FK → `pur.purchase_order_line.id`; ON DELETE RESTRICT |
| `allocated_quantity` | `numeric(20,6)` | NO | Số lượng |

**Indexes:** `(purchase_request_line_id, purchase_order_line_id) (uq_purchase_request_order_allocation)`; `purchase_order_line_id (idx_purchase_request_order_allocation_purchase_order_line_id)`

### `pur.purchase_invoice_line_order_allocation` — Đối chiếu dòng hóa đơn mua với đơn mua

- **Loại bảng:** `ALLOCATION_LINK`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Bảng phân bổ/đối chiếu phục vụ Đối chiếu dòng hóa đơn mua với đơn mua. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.
- **PK:** `id`
- **FK ra:** `purchase_invoice_line_id` → `pur.purchase_invoice_line.id` (DELETE RESTRICT); `purchase_order_line_id` → `pur.purchase_order_line.id` (DELETE RESTRICT)
- **UNIQUE:** `(purchase_invoice_line_id, purchase_order_line_id)`
- **Nullability:** 4 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `purchase_invoice_line_id` | `uuid` | NO | FK → `pur.purchase_invoice_line.id`; ON DELETE RESTRICT |
| `purchase_order_line_id` | `uuid` | NO | FK → `pur.purchase_order_line.id`; ON DELETE RESTRICT |
| `allocated_quantity` | `numeric(20,6)` | YES | Số lượng |
| `allocated_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `(purchase_invoice_line_id, purchase_order_line_id) (uq_purchase_invoice_order_allocation)`; `purchase_order_line_id (idx_purchase_invoice_line_order_allocation_purchase_d41fac6f)`

### `pur.purchase_invoice_line_goods_receipt_allocation` — Đối chiếu hóa đơn mua với nhận hàng

- **Loại bảng:** `ALLOCATION_LINK`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Bảng phân bổ/đối chiếu phục vụ Đối chiếu hóa đơn mua với nhận hàng. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.
- **PK:** `id`
- **FK ra:** `goods_receipt_line_id` → `pur.goods_receipt_line.id` (DELETE RESTRICT); `purchase_invoice_line_id` → `pur.purchase_invoice_line.id` (DELETE RESTRICT)
- **UNIQUE:** `(purchase_invoice_line_id, goods_receipt_line_id)`
- **Nullability:** 4 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `purchase_invoice_line_id` | `uuid` | NO | FK → `pur.purchase_invoice_line.id`; ON DELETE RESTRICT |
| `goods_receipt_line_id` | `uuid` | NO | FK → `pur.goods_receipt_line.id`; ON DELETE RESTRICT |
| `allocated_quantity` | `numeric(20,6)` | YES | Số lượng |
| `allocated_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `(purchase_invoice_line_id, goods_receipt_line_id) (uq_purchase_invoice_goods_receipt_allocation)`; `goods_receipt_line_id (idx_purchase_invoice_line_goods_receipt_allocation__c13c8fa2)`

### `pur.purchase_invoice_line_service_receipt_allocation` — Đối chiếu hóa đơn mua với nghiệm thu dịch vụ

- **Loại bảng:** `ALLOCATION_LINK`
- **Write owner:** `PurchaseModule`
- **Read consumers:** `PurchaseModule`
- **Mục đích:** Bảng phân bổ/đối chiếu phục vụ Đối chiếu hóa đơn mua với nghiệm thu dịch vụ. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.
- **PK:** `id`
- **FK ra:** `purchase_invoice_line_id` → `pur.purchase_invoice_line.id` (DELETE RESTRICT); `service_receipt_line_id` → `pur.service_receipt_line.id` (DELETE RESTRICT)
- **UNIQUE:** `(purchase_invoice_line_id, service_receipt_line_id)`
- **Nullability:** 4 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `purchase_invoice_line_id` | `uuid` | NO | FK → `pur.purchase_invoice_line.id`; ON DELETE RESTRICT |
| `service_receipt_line_id` | `uuid` | NO | FK → `pur.service_receipt_line.id`; ON DELETE RESTRICT |
| `allocated_quantity` | `numeric(20,6)` | YES | Số lượng |
| `allocated_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `(purchase_invoice_line_id, service_receipt_line_id) (uq_purchase_invoice_service_receipt_allocation)`; `service_receipt_line_id (idx_purchase_invoice_line_service_receipt_allocatio_dbb1a552)`

## 11.8. Schema `ap` — Công nợ phải trả

**Owner:** `AccountsPayableModule` · **Use Case:** UC-AP · **Số bảng:** 10

### `ap.payable_open_item` — Khoản phải trả còn mở

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `AccountsPayableModule`
- **Read consumers:** `AccountsPayableModule`, `AccountsReceivableModule`
- **Mục đích:** Khoản công nợ phải trả còn mở phát sinh từ chứng từ đã POST; thanh toán/điều chỉnh/bù trừ cập nhật thông qua settlement, không sửa trực tiếp số gốc.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT); `source_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `source_document_id`
- **Nullability:** 12 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `source_document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `original_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `settled_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `open_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `due_date` | `date` | YES | Ngày nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(vendor_id, due_date, status) (idx_ap_vendor_due_status)`; `source_document_id (uq_ap_source_document)`; `(company_id, status) (idx_ap_company_status)`; `account_id (idx_payable_open_item_account_id)`; `branch_id (idx_payable_open_item_branch_id)`; `currency_id (idx_payable_open_item_currency_id)`

### `ap.payable_schedule` — Lịch đến hạn phải trả

- **Loại bảng:** `SCHEDULE`
- **Write owner:** `AccountsPayableModule`
- **Read consumers:** `AccountsPayableModule`
- **Mục đích:** Lịch chi tiết cho Lịch đến hạn phải trả, dùng chia khoản phải thu/phải trả/khấu hao/phân bổ theo kỳ và làm căn cứ settlement/run.
- **PK:** `id`
- **FK ra:** `open_item_id` → `ap.payable_open_item.id` (DELETE RESTRICT)
- **UNIQUE:** `(open_item_id, installment_no)`
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `open_item_id` | `uuid` | NO | FK → `ap.payable_open_item.id`; ON DELETE RESTRICT |
| `installment_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `due_date` | `date` | NO | Ngày nghiệp vụ |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `settled_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `(open_item_id, installment_no) (uq_ap_schedule)`

### `ap.vendor_advance` — Tạm ứng nhà cung cấp

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `AccountsPayableModule`
- **Read consumers:** `AccountsPayableModule`
- **Mục đích:** Lưu dữ liệu Tạm ứng nhà cung cấp thuộc phân hệ Công nợ phải trả.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT); `payment_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `payment_document_id`
- **Nullability:** 10 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `payment_document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `original_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `applied_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `remaining_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |

**Indexes:** `(vendor_id, status) (idx_vendor_advance_status)`; `payment_document_id (uq_vendor_advance_payment)`; `branch_id (idx_vendor_advance_branch_id)`; `company_id (idx_vendor_advance_company_id)`; `currency_id (idx_vendor_advance_currency_id)`

### `ap.payable_settlement` — Thanh toán công nợ phải trả

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `AccountsPayableModule`
- **Read consumers:** `AccountsPayableModule`
- **Mục đích:** Lưu dữ liệu Thanh toán công nợ phải trả thuộc phân hệ Công nợ phải trả.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT); `settlement_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `settlement_document_id`
- **Nullability:** 8 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `settlement_document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `settlement_date` | `date` | NO | Ngày nghiệp vụ |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `total_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `status` | `varchar(20)` | NO | Trạng thái; default='POSTED' |

**Indexes:** `settlement_document_id (uq_ap_settlement_document)`; `(vendor_id, settlement_date) (idx_ap_settlement_vendor)`; `company_id (idx_payable_settlement_company_id)`; `currency_id (idx_payable_settlement_currency_id)`

### `ap.payable_settlement_line` — Chi tiết thanh toán phải trả

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `AccountsPayableModule`
- **Read consumers:** `AccountsPayableModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết thanh toán phải trả. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `open_item_id` → `ap.payable_open_item.id` (DELETE RESTRICT); `schedule_id` → `ap.payable_schedule.id` (DELETE RESTRICT); `settlement_id` → `ap.payable_settlement.id` (DELETE RESTRICT)
- **UNIQUE:** `(settlement_id, open_item_id, schedule_id)`
- **Nullability:** 7 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `settlement_id` | `uuid` | NO | FK → `ap.payable_settlement.id`; ON DELETE RESTRICT |
| `open_item_id` | `uuid` | NO | FK → `ap.payable_open_item.id`; ON DELETE RESTRICT |
| `schedule_id` | `uuid` | NO | FK → `ap.payable_schedule.id`; ON DELETE RESTRICT |
| `settled_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `discount_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `exchange_difference` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |

**Indexes:** `(settlement_id, open_item_id, schedule_id) (uq_ap_settlement_line)`; `open_item_id (idx_payable_settlement_line_open_item_id)`; `schedule_id (idx_payable_settlement_line_schedule_id)`

### `ap.payable_offset` — Bù trừ công nợ phải trả

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `AccountsPayableModule`
- **Read consumers:** `AccountsPayableModule`
- **Mục đích:** Lưu dữ liệu Bù trừ công nợ phải trả thuộc phân hệ Công nợ phải trả.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `receivable_party_id` → `mdm.party.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `document_id`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `receivable_party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `offset_date` | `date` | NO | Ngày nghiệp vụ |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='POSTED' |

**Indexes:** `document_id (uq_ap_offset_document)`; `company_id (idx_payable_offset_company_id)`; `receivable_party_id (idx_payable_offset_receivable_party_id)`; `vendor_id (idx_payable_offset_vendor_id)`

### `ap.payable_adjustment` — Điều chỉnh công nợ phải trả

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `AccountsPayableModule`
- **Read consumers:** `AccountsPayableModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Điều chỉnh công nợ phải trả. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `adjustment_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `adjustment_reason` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `total_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `currency_id (idx_payable_adjustment_currency_id)`; `vendor_id (idx_payable_adjustment_vendor_id)`

### `ap.payable_adjustment_line` — Chi tiết điều chỉnh phải trả

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `AccountsPayableModule`
- **Read consumers:** `AccountsPayableModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết điều chỉnh phải trả. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `payable_adjustment_id` → `ap.payable_adjustment.document_id` (DELETE RESTRICT); `payable_open_item_id` → `ap.payable_open_item.id` (DELETE RESTRICT)
- **UNIQUE:** `(payable_adjustment_id, line_no)`
- **Nullability:** 6 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `payable_adjustment_id` | `uuid` | NO | FK → `ap.payable_adjustment.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `payable_open_item_id` | `uuid` | YES | FK → `ap.payable_open_item.id`; ON DELETE RESTRICT |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `debit_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `credit_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `description` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(payable_adjustment_id, line_no) (uq_payable_adjustment_line)`; `account_id (idx_payable_adjustment_line_account_id)`; `payable_open_item_id (idx_payable_adjustment_line_payable_open_item_id)`

### `ap.vendor_advance_application` — Cấn trừ tạm ứng nhà cung cấp

- **Loại bảng:** `RELATIONSHIP`
- **Write owner:** `AccountsPayableModule`
- **Read consumers:** `AccountsPayableModule`
- **Mục đích:** Bảng quan hệ/ánh xạ cho Cấn trừ tạm ứng nhà cung cấp; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.
- **PK:** `id`
- **FK ra:** `payable_open_item_id` → `ap.payable_open_item.id` (DELETE RESTRICT); `settlement_id` → `ap.payable_settlement.id` (DELETE RESTRICT); `vendor_advance_id` → `ap.vendor_advance.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `vendor_advance_id` | `uuid` | NO | FK → `ap.vendor_advance.id`; ON DELETE RESTRICT |
| `payable_open_item_id` | `uuid` | NO | FK → `ap.payable_open_item.id`; ON DELETE RESTRICT |
| `settlement_id` | `uuid` | YES | FK → `ap.payable_settlement.id`; ON DELETE RESTRICT |
| `applied_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `applied_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(vendor_advance_id, payable_open_item_id, settlement_id) (idx_vendor_advance_application)`; `payable_open_item_id (idx_vendor_advance_application_payable_open_item_id)`; `settlement_id (idx_vendor_advance_application_settlement_id)`

### `ap.payable_offset_line` — Chi tiết bù trừ phải trả

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `AccountsPayableModule`
- **Read consumers:** `AccountsPayableModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết bù trừ phải trả. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `payable_offset_id` → `ap.payable_offset.id` (DELETE RESTRICT); `payable_open_item_id` → `ap.payable_open_item.id` (DELETE RESTRICT); `receivable_open_item_id` → `ar.receivable_open_item.id` (DELETE RESTRICT)
- **UNIQUE:** `(payable_offset_id, payable_open_item_id, receivable_open_item_id)`
- **Nullability:** 5 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `payable_offset_id` | `uuid` | NO | FK → `ap.payable_offset.id`; ON DELETE RESTRICT |
| `payable_open_item_id` | `uuid` | NO | FK → `ap.payable_open_item.id`; ON DELETE RESTRICT |
| `receivable_open_item_id` | `uuid` | NO | FK → `ar.receivable_open_item.id`; ON DELETE RESTRICT |
| `offset_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `(payable_offset_id, payable_open_item_id, receivable_open_item_id) (uq_payable_offset_line)`; `payable_open_item_id (idx_payable_offset_line_payable_open_item_id)`; `receivable_open_item_id (idx_payable_offset_line_receivable_open_item_id)`

## 11.9. Schema `sal` — Bán hàng

**Owner:** `SalesModule` · **Use Case:** UC-SAL · **Số bảng:** 14

### `sal.quotation` — Báo giá

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Báo giá. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `customer_id` → `mdm.party.id` (DELETE RESTRICT); `payment_term_id` → `mdm.payment_term.id` (DELETE RESTRICT); `sales_employee_id` → `org.employee.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 3 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `customer_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `valid_until` | `date` | YES | Thuộc tính nghiệp vụ |
| `sales_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `payment_term_id` | `uuid` | YES | FK → `mdm.payment_term.id`; ON DELETE RESTRICT |
| `subtotal` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `discount_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `customer_id (idx_quotation_customer_id)`; `payment_term_id (idx_quotation_payment_term_id)`; `sales_employee_id (idx_quotation_sales_employee_id)`

### `sal.quotation_line` — Chi tiết báo giá

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết báo giá. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `item_id` → `mdm.item.id` (DELETE RESTRICT); `quotation_id` → `sal.quotation.document_id` (DELETE RESTRICT); `tax_rate_id` → `mdm.tax_rate.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(quotation_id, line_no)`
- **Nullability:** 9 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `quotation_id` | `uuid` | NO | FK → `sal.quotation.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_id` | `uuid` | YES | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `description` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `uom_id` | `uuid` | YES | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `quantity` | `numeric(20,6)` | NO | Số lượng |
| `unit_price` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `discount_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `tax_rate_id` | `uuid` | YES | FK → `mdm.tax_rate.id`; ON DELETE RESTRICT |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `line_total` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |

**Indexes:** `(quotation_id, line_no) (uq_quotation_line)`; `item_id (idx_quotation_line_item_id)`; `tax_rate_id (idx_quotation_line_tax_rate_id)`; `uom_id (idx_quotation_line_uom_id)`

### `sal.sales_order` — Đơn bán hàng

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Đơn bán hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `customer_id` → `mdm.party.id` (DELETE RESTRICT); `payment_term_id` → `mdm.payment_term.id` (DELETE RESTRICT); `sales_employee_id` → `org.employee.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 4 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `customer_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `sales_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `payment_term_id` | `uuid` | YES | FK → `mdm.payment_term.id`; ON DELETE RESTRICT |
| `delivery_address` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `expected_delivery_date` | `date` | YES | Ngày nghiệp vụ |
| `subtotal` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `discount_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `customer_id (idx_sales_order_customer_id)`; `payment_term_id (idx_sales_order_payment_term_id)`; `sales_employee_id (idx_sales_order_sales_employee_id)`

### `sal.sales_order_line` — Chi tiết đơn bán

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết đơn bán. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `item_id` → `mdm.item.id` (DELETE RESTRICT); `quotation_line_id` → `sal.quotation_line.id` (DELETE RESTRICT); `sales_contract_line_id` → `sal.sales_contract_line.id` (DELETE RESTRICT); `sales_order_id` → `sal.sales_order.document_id` (DELETE RESTRICT); `tax_rate_id` → `mdm.tax_rate.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(sales_order_id, line_no)`
- **Nullability:** 9 cột bắt buộc / 6 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `sales_order_id` | `uuid` | NO | FK → `sal.sales_order.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `quotation_line_id` | `uuid` | YES | FK → `sal.quotation_line.id`; ON DELETE RESTRICT |
| `sales_contract_line_id` | `uuid` | YES | FK → `sal.sales_contract_line.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | YES | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `description` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `uom_id` | `uuid` | YES | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `ordered_quantity` | `numeric(20,6)` | NO | Số lượng |
| `unit_price` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `discount_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `tax_rate_id` | `uuid` | YES | FK → `mdm.tax_rate.id`; ON DELETE RESTRICT |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `line_total_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |

**Indexes:** `(sales_order_id, line_no) (uq_sales_order_line)`; `quotation_line_id (idx_sales_order_line_quotation)`; `sales_contract_line_id (idx_sales_order_line_contract)`; `item_id (idx_sales_order_line_item_id)`; `tax_rate_id (idx_sales_order_line_tax_rate_id)`; `uom_id (idx_sales_order_line_uom_id)`; `warehouse_id (idx_sales_order_line_warehouse_id)`

### `sal.delivery` — Giao hàng

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Giao hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `customer_id` → `mdm.party.id` (DELETE RESTRICT); `delivered_by_employee_id` → `org.employee.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 3 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `customer_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `delivery_address` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `delivered_by_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `delivery_note_no` | `varchar(100)` | YES | Số chứng từ/tham chiếu |

**Indexes:** `customer_id (idx_delivery_customer_id)`; `delivered_by_employee_id (idx_delivery_delivered_by_employee_id)`; `warehouse_id (idx_delivery_warehouse_id)`

### `sal.delivery_line` — Chi tiết giao hàng

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết giao hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `delivery_id` → `sal.delivery.document_id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `location_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `lot_id` → `inv.lot.id` (DELETE RESTRICT); `sales_order_line_id` → `sal.sales_order_line.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(delivery_id, line_no)`
- **Nullability:** 6 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `delivery_id` | `uuid` | NO | FK → `sal.delivery.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `sales_order_line_id` | `uuid` | YES | FK → `sal.sales_order_line.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `uom_id` | `uuid` | NO | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `quantity` | `numeric(20,6)` | NO | Số lượng |
| `location_id` | `uuid` | YES | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |
| `lot_id` | `uuid` | YES | FK → `inv.lot.id`; ON DELETE RESTRICT |

**Indexes:** `(delivery_id, line_no) (uq_delivery_line)`; `sales_order_line_id (idx_delivery_line_so)`; `item_id (idx_delivery_line_item_id)`; `location_id (idx_delivery_line_location_id)`; `lot_id (idx_delivery_line_lot_id)`; `uom_id (idx_delivery_line_uom_id)`

### `sal.sales_invoice` — Chứng từ hóa đơn bán

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Chứng từ hóa đơn bán. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `customer_id` → `mdm.party.id` (DELETE RESTRICT); `payment_term_id` → `mdm.payment_term.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `customer_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `payment_term_id` | `uuid` | YES | FK → `mdm.payment_term.id`; ON DELETE RESTRICT |
| `due_date` | `date` | YES | Ngày nghiệp vụ |
| `subtotal_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `discount_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `total_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `customer_id (idx_sales_invoice_customer_id)`; `payment_term_id (idx_sales_invoice_payment_term_id)`

### `sal.sales_invoice_line` — Chi tiết chứng từ hóa đơn bán

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết chứng từ hóa đơn bán. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `ar_account_id` → `gl.account.id` (DELETE RESTRICT); `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT); `revenue_account_id` → `gl.account.id` (DELETE RESTRICT); `sales_invoice_id` → `sal.sales_invoice.document_id` (DELETE RESTRICT); `tax_rate_id` → `mdm.tax_rate.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(sales_invoice_id, line_no)`
- **Nullability:** 8 cột bắt buộc / 7 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `sales_invoice_id` | `uuid` | NO | FK → `sal.sales_invoice.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_id` | `uuid` | YES | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `description` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `uom_id` | `uuid` | YES | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `quantity` | `numeric(20,6)` | YES | Số lượng |
| `unit_price` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `amount_before_tax` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `tax_rate_id` | `uuid` | YES | FK → `mdm.tax_rate.id`; ON DELETE RESTRICT |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `revenue_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `ar_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |

**Indexes:** `(sales_invoice_id, line_no) (uq_sales_invoice_line)`; `ar_account_id (idx_sales_invoice_line_ar_account_id)`; `cost_center_id (idx_sales_invoice_line_cost_center_id)`; `item_id (idx_sales_invoice_line_item_id)`; `project_id (idx_sales_invoice_line_project_id)`; `revenue_account_id (idx_sales_invoice_line_revenue_account_id)`; `tax_rate_id (idx_sales_invoice_line_tax_rate_id)`; `uom_id (idx_sales_invoice_line_uom_id)`

### `sal.sales_return` — Hàng bán bị trả lại

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Hàng bán bị trả lại. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `customer_id` → `mdm.party.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 1 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `customer_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `reason` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |

**Indexes:** `customer_id (idx_sales_return_customer_id)`; `warehouse_id (idx_sales_return_warehouse_id)`

### `sal.sales_return_line` — Chi tiết hàng bán bị trả lại

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết hàng bán bị trả lại. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `item_id` → `mdm.item.id` (DELETE RESTRICT); `original_delivery_line_id` → `sal.delivery_line.id` (DELETE RESTRICT); `original_invoice_line_id` → `sal.sales_invoice_line.id` (DELETE RESTRICT); `sales_return_id` → `sal.sales_return.document_id` (DELETE RESTRICT); `tax_rate_id` → `mdm.tax_rate.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(sales_return_id, line_no)`
- **Nullability:** 6 cột bắt buộc / 6 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `sales_return_id` | `uuid` | NO | FK → `sal.sales_return.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `original_delivery_line_id` | `uuid` | YES | FK → `sal.delivery_line.id`; ON DELETE RESTRICT |
| `original_invoice_line_id` | `uuid` | YES | FK → `sal.sales_invoice_line.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | YES | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `uom_id` | `uuid` | YES | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `quantity` | `numeric(20,6)` | NO | Số lượng |
| `unit_price` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `tax_rate_id` | `uuid` | YES | FK → `mdm.tax_rate.id`; ON DELETE RESTRICT |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `(sales_return_id, line_no) (uq_sales_return_line)`; `item_id (idx_sales_return_line_item_id)`; `original_delivery_line_id (idx_sales_return_line_original_delivery_line_id)`; `original_invoice_line_id (idx_sales_return_line_original_invoice_line_id)`; `tax_rate_id (idx_sales_return_line_tax_rate_id)`; `uom_id (idx_sales_return_line_uom_id)`

### `sal.sales_contract` — Hợp đồng bán hàng

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Hợp đồng bán hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `customer_id` → `mdm.party.id` (DELETE RESTRICT); `payment_term_id` → `mdm.payment_term.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 7 cột bắt buộc / 3 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `customer_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `contract_no` | `varchar(100)` | NO | Số chứng từ/tham chiếu |
| `contract_date` | `date` | NO | Ngày nghiệp vụ |
| `effective_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | YES | Thuộc tính nghiệp vụ |
| `payment_term_id` | `uuid` | YES | FK → `mdm.payment_term.id`; ON DELETE RESTRICT |
| `contract_value` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `contract_status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(customer_id, contract_no) (idx_sales_contract_customer_no)`; `currency_id (idx_sales_contract_currency_id)`; `payment_term_id (idx_sales_contract_payment_term_id)`

### `sal.sales_contract_line` — Chi tiết hợp đồng bán

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết hợp đồng bán. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `item_id` → `mdm.item.id` (DELETE RESTRICT); `sales_contract_id` → `sal.sales_contract.document_id` (DELETE RESTRICT); `tax_rate_id` → `mdm.tax_rate.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(sales_contract_id, line_no)`
- **Nullability:** 5 cột bắt buộc / 6 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `sales_contract_id` | `uuid` | NO | FK → `sal.sales_contract.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_id` | `uuid` | YES | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `description` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `uom_id` | `uuid` | YES | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `contracted_quantity` | `numeric(20,6)` | YES | Số lượng |
| `unit_price` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `contract_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `tax_rate_id` | `uuid` | YES | FK → `mdm.tax_rate.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |

**Indexes:** `(sales_contract_id, line_no) (uq_sales_contract_line)`; `item_id (idx_sales_contract_line_item_id)`; `tax_rate_id (idx_sales_contract_line_tax_rate_id)`; `uom_id (idx_sales_contract_line_uom_id)`; `warehouse_id (idx_sales_contract_line_warehouse_id)`

### `sal.sales_invoice_line_order_allocation` — Đối chiếu hóa đơn bán với đơn bán

- **Loại bảng:** `ALLOCATION_LINK`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Bảng phân bổ/đối chiếu phục vụ Đối chiếu hóa đơn bán với đơn bán. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.
- **PK:** `id`
- **FK ra:** `sales_invoice_line_id` → `sal.sales_invoice_line.id` (DELETE RESTRICT); `sales_order_line_id` → `sal.sales_order_line.id` (DELETE RESTRICT)
- **UNIQUE:** `(sales_invoice_line_id, sales_order_line_id)`
- **Nullability:** 4 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `sales_invoice_line_id` | `uuid` | NO | FK → `sal.sales_invoice_line.id`; ON DELETE RESTRICT |
| `sales_order_line_id` | `uuid` | NO | FK → `sal.sales_order_line.id`; ON DELETE RESTRICT |
| `allocated_quantity` | `numeric(20,6)` | YES | Số lượng |
| `allocated_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `(sales_invoice_line_id, sales_order_line_id) (uq_sales_invoice_order_allocation)`; `sales_order_line_id (idx_sales_invoice_line_order_allocation_sales_order_line_id)`

### `sal.sales_invoice_line_delivery_allocation` — Đối chiếu hóa đơn bán với giao hàng

- **Loại bảng:** `ALLOCATION_LINK`
- **Write owner:** `SalesModule`
- **Read consumers:** `SalesModule`
- **Mục đích:** Bảng phân bổ/đối chiếu phục vụ Đối chiếu hóa đơn bán với giao hàng. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.
- **PK:** `id`
- **FK ra:** `delivery_line_id` → `sal.delivery_line.id` (DELETE RESTRICT); `sales_invoice_line_id` → `sal.sales_invoice_line.id` (DELETE RESTRICT)
- **UNIQUE:** `(sales_invoice_line_id, delivery_line_id)`
- **Nullability:** 4 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `sales_invoice_line_id` | `uuid` | NO | FK → `sal.sales_invoice_line.id`; ON DELETE RESTRICT |
| `delivery_line_id` | `uuid` | NO | FK → `sal.delivery_line.id`; ON DELETE RESTRICT |
| `allocated_quantity` | `numeric(20,6)` | YES | Số lượng |
| `allocated_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `(sales_invoice_line_id, delivery_line_id) (uq_sales_invoice_delivery_allocation)`; `delivery_line_id (idx_sales_invoice_line_delivery_allocation_delivery_line_id)`

## 11.10. Schema `ar` — Công nợ phải thu

**Owner:** `AccountsReceivableModule` · **Use Case:** UC-AR · **Số bảng:** 10

### `ar.receivable_open_item` — Khoản phải thu còn mở

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `AccountsReceivableModule`
- **Read consumers:** `AccountsPayableModule`, `AccountsReceivableModule`
- **Mục đích:** Khoản công nợ phải thu còn mở phát sinh từ chứng từ đã POST; thu tiền/điều chỉnh/bù trừ cập nhật thông qua settlement, không sửa trực tiếp số gốc.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `customer_id` → `mdm.party.id` (DELETE RESTRICT); `source_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `source_document_id`
- **Nullability:** 12 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `customer_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `source_document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `original_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `settled_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `open_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `due_date` | `date` | YES | Ngày nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(customer_id, due_date, status) (idx_ar_customer_due_status)`; `source_document_id (uq_ar_source_document)`; `(company_id, status) (idx_ar_company_status)`; `account_id (idx_receivable_open_item_account_id)`; `branch_id (idx_receivable_open_item_branch_id)`; `currency_id (idx_receivable_open_item_currency_id)`

### `ar.receivable_schedule` — Lịch đến hạn phải thu

- **Loại bảng:** `SCHEDULE`
- **Write owner:** `AccountsReceivableModule`
- **Read consumers:** `AccountsReceivableModule`
- **Mục đích:** Lịch chi tiết cho Lịch đến hạn phải thu, dùng chia khoản phải thu/phải trả/khấu hao/phân bổ theo kỳ và làm căn cứ settlement/run.
- **PK:** `id`
- **FK ra:** `open_item_id` → `ar.receivable_open_item.id` (DELETE RESTRICT)
- **UNIQUE:** `(open_item_id, installment_no)`
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `open_item_id` | `uuid` | NO | FK → `ar.receivable_open_item.id`; ON DELETE RESTRICT |
| `installment_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `due_date` | `date` | NO | Ngày nghiệp vụ |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `settled_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `(open_item_id, installment_no) (uq_ar_schedule)`

### `ar.customer_advance` — Khách hàng trả trước

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `AccountsReceivableModule`
- **Read consumers:** `AccountsReceivableModule`
- **Mục đích:** Lưu dữ liệu Khách hàng trả trước thuộc phân hệ Công nợ phải thu.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `customer_id` → `mdm.party.id` (DELETE RESTRICT); `receipt_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `receipt_document_id`
- **Nullability:** 10 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `customer_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `receipt_document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `original_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `applied_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `remaining_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |

**Indexes:** `(customer_id, status) (idx_customer_advance_status)`; `receipt_document_id (uq_customer_advance_receipt)`; `branch_id (idx_customer_advance_branch_id)`; `company_id (idx_customer_advance_company_id)`; `currency_id (idx_customer_advance_currency_id)`

### `ar.receivable_settlement` — Thu/cấn trừ công nợ phải thu

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `AccountsReceivableModule`
- **Read consumers:** `AccountsReceivableModule`
- **Mục đích:** Lưu dữ liệu Thu/cấn trừ công nợ phải thu thuộc phân hệ Công nợ phải thu.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `customer_id` → `mdm.party.id` (DELETE RESTRICT); `settlement_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `settlement_document_id`
- **Nullability:** 8 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `customer_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `settlement_document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `settlement_date` | `date` | NO | Ngày nghiệp vụ |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `total_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `status` | `varchar(20)` | NO | Trạng thái; default='POSTED' |

**Indexes:** `settlement_document_id (uq_ar_settlement_document)`; `(customer_id, settlement_date) (idx_ar_settlement_customer)`; `company_id (idx_receivable_settlement_company_id)`; `currency_id (idx_receivable_settlement_currency_id)`

### `ar.receivable_settlement_line` — Chi tiết tất toán phải thu

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `AccountsReceivableModule`
- **Read consumers:** `AccountsReceivableModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết tất toán phải thu. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `open_item_id` → `ar.receivable_open_item.id` (DELETE RESTRICT); `schedule_id` → `ar.receivable_schedule.id` (DELETE RESTRICT); `settlement_id` → `ar.receivable_settlement.id` (DELETE RESTRICT)
- **UNIQUE:** `(settlement_id, open_item_id, schedule_id)`
- **Nullability:** 7 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `settlement_id` | `uuid` | NO | FK → `ar.receivable_settlement.id`; ON DELETE RESTRICT |
| `open_item_id` | `uuid` | NO | FK → `ar.receivable_open_item.id`; ON DELETE RESTRICT |
| `schedule_id` | `uuid` | NO | FK → `ar.receivable_schedule.id`; ON DELETE RESTRICT |
| `settled_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `discount_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `exchange_difference` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |

**Indexes:** `(settlement_id, open_item_id, schedule_id) (uq_ar_settlement_line)`; `open_item_id (idx_receivable_settlement_line_open_item_id)`; `schedule_id (idx_receivable_settlement_line_schedule_id)`

### `ar.receivable_offset` — Bù trừ công nợ phải thu

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `AccountsReceivableModule`
- **Read consumers:** `AccountsReceivableModule`
- **Mục đích:** Lưu dữ liệu Bù trừ công nợ phải thu thuộc phân hệ Công nợ phải thu.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `customer_id` → `mdm.party.id` (DELETE RESTRICT); `payable_party_id` → `mdm.party.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `document_id`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `customer_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `payable_party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `offset_date` | `date` | NO | Ngày nghiệp vụ |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='POSTED' |

**Indexes:** `document_id (uq_ar_offset_document)`; `company_id (idx_receivable_offset_company_id)`; `customer_id (idx_receivable_offset_customer_id)`; `payable_party_id (idx_receivable_offset_payable_party_id)`

### `ar.receivable_adjustment` — Điều chỉnh công nợ phải thu

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `AccountsReceivableModule`
- **Read consumers:** `AccountsReceivableModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Điều chỉnh công nợ phải thu. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `customer_id` → `mdm.party.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `customer_id` | `uuid` | NO | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `adjustment_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `adjustment_reason` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `total_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `currency_id (idx_receivable_adjustment_currency_id)`; `customer_id (idx_receivable_adjustment_customer_id)`

### `ar.receivable_adjustment_line` — Chi tiết điều chỉnh phải thu

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `AccountsReceivableModule`
- **Read consumers:** `AccountsReceivableModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết điều chỉnh phải thu. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `receivable_adjustment_id` → `ar.receivable_adjustment.document_id` (DELETE RESTRICT); `receivable_open_item_id` → `ar.receivable_open_item.id` (DELETE RESTRICT)
- **UNIQUE:** `(receivable_adjustment_id, line_no)`
- **Nullability:** 6 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `receivable_adjustment_id` | `uuid` | NO | FK → `ar.receivable_adjustment.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `receivable_open_item_id` | `uuid` | YES | FK → `ar.receivable_open_item.id`; ON DELETE RESTRICT |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `debit_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `credit_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `description` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(receivable_adjustment_id, line_no) (uq_receivable_adjustment_line)`; `account_id (idx_receivable_adjustment_line_account_id)`; `receivable_open_item_id (idx_receivable_adjustment_line_receivable_open_item_id)`

### `ar.customer_advance_application` — Cấn trừ tiền khách hàng trả trước

- **Loại bảng:** `RELATIONSHIP`
- **Write owner:** `AccountsReceivableModule`
- **Read consumers:** `AccountsReceivableModule`
- **Mục đích:** Bảng quan hệ/ánh xạ cho Cấn trừ tiền khách hàng trả trước; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.
- **PK:** `id`
- **FK ra:** `customer_advance_id` → `ar.customer_advance.id` (DELETE RESTRICT); `receivable_open_item_id` → `ar.receivable_open_item.id` (DELETE RESTRICT); `settlement_id` → `ar.receivable_settlement.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `customer_advance_id` | `uuid` | NO | FK → `ar.customer_advance.id`; ON DELETE RESTRICT |
| `receivable_open_item_id` | `uuid` | NO | FK → `ar.receivable_open_item.id`; ON DELETE RESTRICT |
| `settlement_id` | `uuid` | YES | FK → `ar.receivable_settlement.id`; ON DELETE RESTRICT |
| `applied_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `applied_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(customer_advance_id, receivable_open_item_id, settlement_id) (idx_customer_advance_application)`; `receivable_open_item_id (idx_customer_advance_application_receivable_open_item_id)`; `settlement_id (idx_customer_advance_application_settlement_id)`

### `ar.receivable_offset_line` — Chi tiết bù trừ phải thu

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `AccountsReceivableModule`
- **Read consumers:** `AccountsReceivableModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết bù trừ phải thu. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `payable_open_item_id` → `ap.payable_open_item.id` (DELETE RESTRICT); `receivable_offset_id` → `ar.receivable_offset.id` (DELETE RESTRICT); `receivable_open_item_id` → `ar.receivable_open_item.id` (DELETE RESTRICT)
- **UNIQUE:** `(receivable_offset_id, receivable_open_item_id, payable_open_item_id)`
- **Nullability:** 5 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `receivable_offset_id` | `uuid` | NO | FK → `ar.receivable_offset.id`; ON DELETE RESTRICT |
| `receivable_open_item_id` | `uuid` | NO | FK → `ar.receivable_open_item.id`; ON DELETE RESTRICT |
| `payable_open_item_id` | `uuid` | NO | FK → `ap.payable_open_item.id`; ON DELETE RESTRICT |
| `offset_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `(receivable_offset_id, receivable_open_item_id, payable_open_item_id) (uq_receivable_offset_line)`; `payable_open_item_id (idx_receivable_offset_line_payable_open_item_id)`; `receivable_open_item_id (idx_receivable_offset_line_receivable_open_item_id)`

## 11.11. Schema `cash` — Tiền mặt

**Owner:** `CashModule` · **Use Case:** UC-CASH · **Số bảng:** 10

### `cash.cash_fund` — Quỹ tiền mặt

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `CashModule`
- **Read consumers:** `CashModule`
- **Mục đích:** Lưu dữ liệu Quỹ tiền mặt thuộc phân hệ Tiền mặt.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `cash_account_id` → `gl.account.id` (DELETE RESTRICT); `cashier_employee_id` → `org.employee.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 8 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(150)` | NO | Tên/nhãn hiển thị |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `cash_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `cashier_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_cash_fund)`; `branch_id (idx_cash_fund_branch_id)`; `cash_account_id (idx_cash_fund_cash_account_id)`; `cashier_employee_id (idx_cash_fund_cashier_employee_id)`; `currency_id (idx_cash_fund_currency_id)`

### `cash.cash_receipt` — Phiếu thu

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `CashModule`
- **Read consumers:** `CashModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Phiếu thu. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `cash_fund_id` → `cash.cash_fund.id` (DELETE RESTRICT); `payer_party_id` → `mdm.party.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `cash_fund_id` | `uuid` | NO | FK → `cash.cash_fund.id`; ON DELETE RESTRICT |
| `payer_party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `payer_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `payer_address` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `reason` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `received_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `cash_fund_id (idx_cash_receipt_cash_fund_id)`; `payer_party_id (idx_cash_receipt_payer_party_id)`

### `cash.cash_receipt_line` — Chi tiết phiếu thu

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `CashModule`
- **Read consumers:** `CashModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết phiếu thu. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `cash_receipt_id` → `cash.cash_receipt.document_id` (DELETE RESTRICT); `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `party_id` → `mdm.party.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT)
- **UNIQUE:** `(cash_receipt_id, line_no)`
- **Nullability:** 5 cột bắt buộc / 4 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `cash_receipt_id` | `uuid` | NO | FK → `cash.cash_receipt.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |
| `description` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(cash_receipt_id, line_no) (uq_cash_receipt_line)`; `account_id (idx_cash_receipt_line_account_id)`; `cost_center_id (idx_cash_receipt_line_cost_center_id)`; `party_id (idx_cash_receipt_line_party_id)`; `project_id (idx_cash_receipt_line_project_id)`

### `cash.cash_payment` — Phiếu chi

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `CashModule`
- **Read consumers:** `CashModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Phiếu chi. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `cash_fund_id` → `cash.cash_fund.id` (DELETE RESTRICT); `payee_party_id` → `mdm.party.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `cash_fund_id` | `uuid` | NO | FK → `cash.cash_fund.id`; ON DELETE RESTRICT |
| `payee_party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `payee_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `payee_address` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `reason` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `paid_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `cash_fund_id (idx_cash_payment_cash_fund_id)`; `payee_party_id (idx_cash_payment_payee_party_id)`

### `cash.cash_payment_line` — Chi tiết phiếu chi

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `CashModule`
- **Read consumers:** `CashModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết phiếu chi. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `cash_payment_id` → `cash.cash_payment.document_id` (DELETE RESTRICT); `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `party_id` → `mdm.party.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT)
- **UNIQUE:** `(cash_payment_id, line_no)`
- **Nullability:** 5 cột bắt buộc / 4 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `cash_payment_id` | `uuid` | NO | FK → `cash.cash_payment.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |
| `description` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(cash_payment_id, line_no) (uq_cash_payment_line)`; `account_id (idx_cash_payment_line_account_id)`; `cost_center_id (idx_cash_payment_line_cost_center_id)`; `party_id (idx_cash_payment_line_party_id)`; `project_id (idx_cash_payment_line_project_id)`

### `cash.advance_request` — Giấy đề nghị tạm ứng

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `CashModule`
- **Read consumers:** `CashModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Giấy đề nghị tạm ứng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `employee_id` → `org.employee.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 1 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `employee_id` | `uuid` | NO | FK → `org.employee.id`; ON DELETE RESTRICT |
| `requested_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `purpose` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `settlement_due_date` | `date` | YES | Ngày nghiệp vụ |

**Indexes:** `employee_id (idx_advance_request_employee_id)`

### `cash.advance_settlement` — Giấy thanh toán tạm ứng

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `CashModule`
- **Read consumers:** `CashModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Giấy thanh toán tạm ứng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `advance_document_id` → `cash.advance_request.document_id` (DELETE RESTRICT); `employee_id` → `org.employee.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 7 cột bắt buộc / 0 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `employee_id` | `uuid` | NO | FK → `org.employee.id`; ON DELETE RESTRICT |
| `advance_document_id` | `uuid` | NO | FK → `cash.advance_request.document_id`; ON DELETE RESTRICT |
| `advanced_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `actual_spent_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `refund_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `additional_payment_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `advance_document_id (idx_advance_settlement_advance_document_id)`; `employee_id (idx_advance_settlement_employee_id)`

### `cash.payment_request` — Giấy đề nghị thanh toán

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `CashModule`
- **Read consumers:** `CashModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Giấy đề nghị thanh toán. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `payee_party_id` → `mdm.party.id` (DELETE RESTRICT); `requester_employee_id` → `org.employee.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `requester_employee_id` | `uuid` | NO | FK → `org.employee.id`; ON DELETE RESTRICT |
| `payee_party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `requested_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `purpose` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `requested_payment_date` | `date` | YES | Ngày nghiệp vụ |

**Indexes:** `payee_party_id (idx_payment_request_payee_party_id)`; `requester_employee_id (idx_payment_request_requester_employee_id)`

### `cash.cash_count` — Kiểm kê quỹ

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `CashModule`
- **Read consumers:** `CashModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Kiểm kê quỹ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `cash_fund_id` → `cash.cash_fund.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `cash_fund_id` | `uuid` | NO | FK → `cash.cash_fund.id`; ON DELETE RESTRICT |
| `book_balance` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `actual_balance` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `difference_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `counted_at` | `timestamptz` | NO | Thời điểm hệ thống |

**Indexes:** `cash_fund_id (idx_cash_count_cash_fund_id)`

### `cash.cash_book_entry` — Dòng sổ quỹ tiền mặt

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `Posting/SubledgerService`
- **Read consumers:** `CashModule`
- **Mục đích:** Lưu dữ liệu Dòng sổ quỹ tiền mặt thuộc phân hệ Tiền mặt.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `cash_fund_id` → `cash.cash_fund.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `source_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `(cash_fund_id, entry_date, sequence_no)`
- **Nullability:** 10 cột bắt buộc / 2 cột nullable
- **Delete policy:** IMMUTABLE_AFTER_POST — không xóa; sai thì reverse/adjust/rebuild theo quy trình.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `cash_fund_id` | `uuid` | NO | FK → `cash.cash_fund.id`; ON DELETE RESTRICT |
| `source_document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `entry_date` | `date` | NO | Ngày nghiệp vụ |
| `sequence_no` | `bigint` | NO | Số chứng từ/tham chiếu |
| `receipt_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `payment_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `balance_after_entry` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `description` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(cash_fund_id, entry_date, sequence_no) (uq_cash_book_entry_sequence)`; `source_document_id (idx_cash_book_entry_source)`; `branch_id (idx_cash_book_entry_branch_id)`; `company_id (idx_cash_book_entry_company_id)`

## 11.12. Schema `bank` — Ngân hàng

**Owner:** `BankingModule` · **Use Case:** UC-BANK · **Số bảng:** 11

### `bank.bank_receipt` — Thu tiền qua ngân hàng

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `BankingModule`
- **Read consumers:** `BankingModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Thu tiền qua ngân hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `bank_account_id` → `mdm.company_bank_account.id` (DELETE RESTRICT); `payer_party_id` → `mdm.party.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `bank_account_id` | `uuid` | NO | FK → `mdm.company_bank_account.id`; ON DELETE RESTRICT |
| `payer_party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `transaction_reference` | `varchar(150)` | YES | Thuộc tính nghiệp vụ |
| `value_date` | `date` | NO | Ngày nghiệp vụ |
| `received_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `bank_account_id (idx_bank_receipt_bank_account_id)`; `payer_party_id (idx_bank_receipt_payer_party_id)`

### `bank.bank_receipt_line` — Chi tiết thu ngân hàng

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `BankingModule`
- **Read consumers:** `BankingModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết thu ngân hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `bank_receipt_id` → `bank.bank_receipt.document_id` (DELETE RESTRICT); `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `party_id` → `mdm.party.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT)
- **UNIQUE:** `(bank_receipt_id, line_no)`
- **Nullability:** 5 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `bank_receipt_id` | `uuid` | NO | FK → `bank.bank_receipt.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |

**Indexes:** `(bank_receipt_id, line_no) (uq_bank_receipt_line)`; `account_id (idx_bank_receipt_line_account_id)`; `cost_center_id (idx_bank_receipt_line_cost_center_id)`; `party_id (idx_bank_receipt_line_party_id)`; `project_id (idx_bank_receipt_line_project_id)`

### `bank.bank_payment` — Chi tiền qua ngân hàng

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `BankingModule`
- **Read consumers:** `BankingModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Chi tiền qua ngân hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `bank_account_id` → `mdm.company_bank_account.id` (DELETE RESTRICT); `payee_party_id` → `mdm.party.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `bank_account_id` | `uuid` | NO | FK → `mdm.company_bank_account.id`; ON DELETE RESTRICT |
| `payee_party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `transaction_reference` | `varchar(150)` | YES | Thuộc tính nghiệp vụ |
| `value_date` | `date` | NO | Ngày nghiệp vụ |
| `paid_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `bank_account_id (idx_bank_payment_bank_account_id)`; `payee_party_id (idx_bank_payment_payee_party_id)`

### `bank.bank_payment_line` — Chi tiết chi ngân hàng

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `BankingModule`
- **Read consumers:** `BankingModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết chi ngân hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `bank_payment_id` → `bank.bank_payment.document_id` (DELETE RESTRICT); `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `party_id` → `mdm.party.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT)
- **UNIQUE:** `(bank_payment_id, line_no)`
- **Nullability:** 5 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `bank_payment_id` | `uuid` | NO | FK → `bank.bank_payment.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |

**Indexes:** `(bank_payment_id, line_no) (uq_bank_payment_line)`; `account_id (idx_bank_payment_line_account_id)`; `cost_center_id (idx_bank_payment_line_cost_center_id)`; `party_id (idx_bank_payment_line_party_id)`; `project_id (idx_bank_payment_line_project_id)`

### `bank.payment_order` — Ủy nhiệm chi/Lệnh thanh toán

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `BankingModule`
- **Read consumers:** `BankingModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Ủy nhiệm chi/Lệnh thanh toán. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `bank_account_id` → `mdm.company_bank_account.id` (DELETE RESTRICT); `beneficiary_party_id` → `mdm.party.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 8 cột bắt buộc / 1 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `bank_account_id` | `uuid` | NO | FK → `mdm.company_bank_account.id`; ON DELETE RESTRICT |
| `beneficiary_party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `beneficiary_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `beneficiary_account_no` | `varchar(100)` | NO | Số chứng từ/tham chiếu |
| `beneficiary_bank_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `purpose` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `bank_status` | `varchar(30)` | NO | Trạng thái; default='NOT_SENT' |

**Indexes:** `bank_account_id (idx_payment_order_bank_account_id)`; `beneficiary_party_id (idx_payment_order_beneficiary_party_id)`

### `bank.bank_transfer` — Chuyển tiền giữa tài khoản

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `BankingModule`
- **Read consumers:** `BankingModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Chuyển tiền giữa tài khoản. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `from_bank_account_id` → `mdm.company_bank_account.id` (DELETE RESTRICT); `to_bank_account_id` → `mdm.company_bank_account.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `from_bank_account_id` | `uuid` | NO | FK → `mdm.company_bank_account.id`; ON DELETE RESTRICT |
| `to_bank_account_id` | `uuid` | NO | FK → `mdm.company_bank_account.id`; ON DELETE RESTRICT |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `bank_fee` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `value_date` | `date` | NO | Ngày nghiệp vụ |

**Indexes:** `from_bank_account_id (idx_bank_transfer_from_bank_account_id)`; `to_bank_account_id (idx_bank_transfer_to_bank_account_id)`

### `bank.statement` — Sao kê ngân hàng

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `BankingModule`
- **Read consumers:** `BankingModule`
- **Mục đích:** Lưu dữ liệu Sao kê ngân hàng thuộc phân hệ Ngân hàng.
- **PK:** `id`
- **FK ra:** `bank_account_id` → `mdm.company_bank_account.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(bank_account_id, statement_no)`
- **Nullability:** 9 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `bank_account_id` | `uuid` | NO | FK → `mdm.company_bank_account.id`; ON DELETE RESTRICT |
| `statement_no` | `varchar(100)` | NO | Số chứng từ/tham chiếu |
| `from_date` | `date` | NO | Ngày nghiệp vụ |
| `to_date` | `date` | NO | Ngày nghiệp vụ |
| `opening_balance` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `closing_balance` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `imported_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(bank_account_id, statement_no) (uq_bank_statement_no)`; `(bank_account_id, from_date, to_date) (idx_bank_statement_period)`; `company_id (idx_statement_company_id)`

### `bank.statement_line` — Dòng sao kê

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `BankingModule`
- **Read consumers:** `BankingModule`
- **Mục đích:** Lưu chi tiết dòng của Dòng sao kê. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `statement_id` → `bank.statement.id` (DELETE RESTRICT)
- **UNIQUE:** `(statement_id, line_no)`
- **Nullability:** 6 cột bắt buộc / 6 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `statement_id` | `uuid` | NO | FK → `bank.statement.id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `transaction_date` | `date` | NO | Ngày nghiệp vụ |
| `value_date` | `date` | YES | Ngày nghiệp vụ |
| `reference_no` | `varchar(150)` | YES | Số chứng từ/tham chiếu |
| `description` | `varchar(1000)` | YES | Thuộc tính nghiệp vụ |
| `debit_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `credit_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `balance` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `counterparty_account` | `varchar(100)` | YES | Thuộc tính nghiệp vụ |
| `counterparty_name` | `varchar(255)` | YES | Tên/nhãn hiển thị |

**Indexes:** `(statement_id, line_no) (uq_bank_statement_line)`; `(transaction_date, reference_no) (idx_bank_statement_line_ref)`

### `bank.reconciliation` — Đối chiếu ngân hàng

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `BankingModule`
- **Read consumers:** `BankingModule`
- **Mục đích:** Lưu dữ liệu Đối chiếu ngân hàng thuộc phân hệ Ngân hàng.
- **PK:** `id`
- **FK ra:** `bank_account_id` → `mdm.company_bank_account.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `completed_by` → `iam.user_account.id` (DELETE RESTRICT); `started_by` → `iam.user_account.id` (DELETE RESTRICT); `statement_id` → `bank.statement.id` (DELETE RESTRICT)
- **UNIQUE:** `(bank_account_id, statement_id)`
- **Nullability:** 7 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `bank_account_id` | `uuid` | NO | FK → `mdm.company_bank_account.id`; ON DELETE RESTRICT |
| `statement_id` | `uuid` | NO | FK → `bank.statement.id`; ON DELETE RESTRICT |
| `reconciliation_date` | `date` | NO | Ngày nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |
| `started_by` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `completed_by` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `completed_at` | `timestamptz` | YES | Thời điểm hệ thống |

**Indexes:** `(bank_account_id, statement_id) (uq_bank_reconciliation_statement)`; `company_id (idx_reconciliation_company_id)`; `completed_by (idx_reconciliation_completed_by)`; `started_by (idx_reconciliation_started_by)`; `statement_id (idx_reconciliation_statement_id)`

### `bank.reconciliation_line` — Chi tiết đối chiếu ngân hàng

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `BankingModule`
- **Read consumers:** `BankingModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết đối chiếu ngân hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `matched_document_id` → `core.business_document.id` (DELETE RESTRICT); `reconciliation_id` → `bank.reconciliation.id` (DELETE RESTRICT); `statement_line_id` → `bank.statement_line.id` (DELETE RESTRICT)
- **UNIQUE:** `(reconciliation_id, statement_line_id)`
- **Nullability:** 6 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `reconciliation_id` | `uuid` | NO | FK → `bank.reconciliation.id`; ON DELETE RESTRICT |
| `statement_line_id` | `uuid` | NO | FK → `bank.statement_line.id`; ON DELETE RESTRICT |
| `matched_document_id` | `uuid` | YES | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `matched_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `match_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='MATCHED' |

**Indexes:** `(reconciliation_id, statement_line_id) (uq_bank_reconciliation_line)`; `matched_document_id (idx_reconciliation_line_matched_document_id)`; `statement_line_id (idx_reconciliation_line_statement_line_id)`

### `bank.bank_book_entry` — Dòng sổ tiền gửi ngân hàng

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `Posting/SubledgerService`
- **Read consumers:** `BankingModule`
- **Mục đích:** Lưu dữ liệu Dòng sổ tiền gửi ngân hàng thuộc phân hệ Ngân hàng.
- **PK:** `id`
- **FK ra:** `bank_account_id` → `mdm.company_bank_account.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `source_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `(bank_account_id, entry_date, sequence_no)`
- **Nullability:** 10 cột bắt buộc / 3 cột nullable
- **Delete policy:** IMMUTABLE_AFTER_POST — không xóa; sai thì reverse/adjust/rebuild theo quy trình.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `bank_account_id` | `uuid` | NO | FK → `mdm.company_bank_account.id`; ON DELETE RESTRICT |
| `source_document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `entry_date` | `date` | NO | Ngày nghiệp vụ |
| `sequence_no` | `bigint` | NO | Số chứng từ/tham chiếu |
| `debit_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `credit_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `balance_after_entry` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `bank_reference_no` | `varchar(150)` | YES | Số chứng từ/tham chiếu |
| `description` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(bank_account_id, entry_date, sequence_no) (uq_bank_book_entry_sequence)`; `source_document_id (idx_bank_book_entry_source)`; `branch_id (idx_bank_book_entry_branch_id)`; `company_id (idx_bank_book_entry_company_id)`

## 11.13. Schema `inv` — Kho và giá vốn

**Owner:** `InventoryModule` · **Use Case:** UC-INV · **Số bảng:** 21

### `inv.stock_receipt` — Phiếu nhập kho

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Phiếu nhập kho. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `received_by_employee_id` → `org.employee.id` (DELETE RESTRICT); `source_party_id` → `mdm.party.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `receipt_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `source_party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `received_by_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |

**Indexes:** `received_by_employee_id (idx_stock_receipt_received_by_employee_id)`; `source_party_id (idx_stock_receipt_source_party_id)`; `warehouse_id (idx_stock_receipt_warehouse_id)`

### `inv.stock_receipt_line` — Chi tiết phiếu nhập kho

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết phiếu nhập kho. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `item_id` → `mdm.item.id` (DELETE RESTRICT); `location_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `lot_id` → `inv.lot.id` (DELETE RESTRICT); `stock_receipt_id` → `inv.stock_receipt.document_id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(stock_receipt_id, line_no)`
- **Nullability:** 7 cột bắt buộc / 4 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `stock_receipt_id` | `uuid` | NO | FK → `inv.stock_receipt.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `uom_id` | `uuid` | NO | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `document_quantity` | `numeric(20,6)` | NO | Số lượng |
| `actual_quantity` | `numeric(20,6)` | NO | Số lượng |
| `unit_cost` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `amount` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `location_id` | `uuid` | YES | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |
| `lot_id` | `uuid` | YES | FK → `inv.lot.id`; ON DELETE RESTRICT |

**Indexes:** `(stock_receipt_id, line_no) (uq_stock_receipt_line)`; `item_id (idx_stock_receipt_line_item_id)`; `location_id (idx_stock_receipt_line_location_id)`; `lot_id (idx_stock_receipt_line_lot_id)`; `uom_id (idx_stock_receipt_line_uom_id)`

### `inv.stock_issue` — Phiếu xuất kho

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Phiếu xuất kho. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `issued_by_employee_id` → `org.employee.id` (DELETE RESTRICT); `recipient_party_id` → `mdm.party.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 3 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `issue_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `recipient_party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `issued_by_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `reason` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `issued_by_employee_id (idx_stock_issue_issued_by_employee_id)`; `recipient_party_id (idx_stock_issue_recipient_party_id)`; `warehouse_id (idx_stock_issue_warehouse_id)`

### `inv.stock_issue_line` — Chi tiết phiếu xuất kho

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết phiếu xuất kho. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `item_id` → `mdm.item.id` (DELETE RESTRICT); `location_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `lot_id` → `inv.lot.id` (DELETE RESTRICT); `stock_issue_id` → `inv.stock_issue.document_id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(stock_issue_id, line_no)`
- **Nullability:** 7 cột bắt buộc / 4 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `stock_issue_id` | `uuid` | NO | FK → `inv.stock_issue.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `uom_id` | `uuid` | NO | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `requested_quantity` | `numeric(20,6)` | NO | Số lượng |
| `actual_quantity` | `numeric(20,6)` | NO | Số lượng |
| `unit_cost` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `amount` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `location_id` | `uuid` | YES | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |
| `lot_id` | `uuid` | YES | FK → `inv.lot.id`; ON DELETE RESTRICT |

**Indexes:** `(stock_issue_id, line_no) (uq_stock_issue_line)`; `item_id (idx_stock_issue_line_item_id)`; `location_id (idx_stock_issue_line_location_id)`; `lot_id (idx_stock_issue_line_lot_id)`; `uom_id (idx_stock_issue_line_uom_id)`

### `inv.stock_transfer` — Điều chuyển kho

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Điều chuyển kho. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `from_warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT); `to_warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 1 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `from_warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `to_warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `transfer_date` | `date` | NO | Ngày nghiệp vụ |
| `received_date` | `date` | YES | Ngày nghiệp vụ |

**Indexes:** `from_warehouse_id (idx_stock_transfer_from_warehouse_id)`; `to_warehouse_id (idx_stock_transfer_to_warehouse_id)`

### `inv.stock_transfer_line` — Chi tiết điều chuyển kho

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết điều chuyển kho. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `from_location_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `lot_id` → `inv.lot.id` (DELETE RESTRICT); `stock_transfer_id` → `inv.stock_transfer.document_id` (DELETE RESTRICT); `to_location_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(stock_transfer_id, line_no)`
- **Nullability:** 6 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `stock_transfer_id` | `uuid` | NO | FK → `inv.stock_transfer.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `uom_id` | `uuid` | NO | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `quantity` | `numeric(20,6)` | NO | Số lượng |
| `from_location_id` | `uuid` | YES | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |
| `to_location_id` | `uuid` | YES | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |
| `lot_id` | `uuid` | YES | FK → `inv.lot.id`; ON DELETE RESTRICT |

**Indexes:** `(stock_transfer_id, line_no) (uq_stock_transfer_line)`; `from_location_id (idx_stock_transfer_line_from_location_id)`; `item_id (idx_stock_transfer_line_item_id)`; `lot_id (idx_stock_transfer_line_lot_id)`; `to_location_id (idx_stock_transfer_line_to_location_id)`; `uom_id (idx_stock_transfer_line_uom_id)`

### `inv.stock_adjustment` — Điều chỉnh tồn kho

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Điều chỉnh tồn kho. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 0 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `adjustment_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `reason` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |

**Indexes:** `warehouse_id (idx_stock_adjustment_warehouse_id)`

### `inv.stock_adjustment_line` — Chi tiết điều chỉnh tồn kho

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết điều chỉnh tồn kho. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `item_id` → `mdm.item.id` (DELETE RESTRICT); `location_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `lot_id` → `inv.lot.id` (DELETE RESTRICT); `stock_adjustment_id` → `inv.stock_adjustment.document_id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(stock_adjustment_id, line_no)`
- **Nullability:** 7 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `stock_adjustment_id` | `uuid` | NO | FK → `inv.stock_adjustment.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `uom_id` | `uuid` | NO | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `quantity_delta` | `numeric(20,6)` | NO | Số lượng |
| `value_delta` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `location_id` | `uuid` | YES | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |
| `lot_id` | `uuid` | YES | FK → `inv.lot.id`; ON DELETE RESTRICT |

**Indexes:** `(stock_adjustment_id, line_no) (uq_stock_adjustment_line)`; `item_id (idx_stock_adjustment_line_item_id)`; `location_id (idx_stock_adjustment_line_location_id)`; `lot_id (idx_stock_adjustment_line_lot_id)`; `uom_id (idx_stock_adjustment_line_uom_id)`

### `inv.stocktake` — Kiểm kê kho

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Kiểm kê kho. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 0 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `count_date` | `date` | NO | Ngày nghiệp vụ |
| `count_scope` | `varchar(30)` | NO | Thuộc tính nghiệp vụ; default='FULL' |

**Indexes:** `warehouse_id (idx_stocktake_warehouse_id)`

### `inv.stocktake_line` — Chi tiết kiểm kê kho

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết kiểm kê kho. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `item_id` → `mdm.item.id` (DELETE RESTRICT); `location_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `lot_id` → `inv.lot.id` (DELETE RESTRICT); `stocktake_id` → `inv.stocktake.document_id` (DELETE RESTRICT)
- **UNIQUE:** `(stocktake_id, line_no)`
- **Nullability:** 7 cột bắt buộc / 4 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `stocktake_id` | `uuid` | NO | FK → `inv.stocktake.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `location_id` | `uuid` | YES | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |
| `lot_id` | `uuid` | YES | FK → `inv.lot.id`; ON DELETE RESTRICT |
| `book_quantity` | `numeric(20,6)` | NO | Số lượng |
| `actual_quantity` | `numeric(20,6)` | NO | Số lượng |
| `difference_quantity` | `numeric(20,6)` | NO | Số lượng |
| `book_value` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `difference_value` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(stocktake_id, line_no) (uq_stocktake_line)`; `item_id (idx_stocktake_line_item_id)`; `location_id (idx_stocktake_line_location_id)`; `lot_id (idx_stocktake_line_lot_id)`

### `inv.lot` — Lô hàng

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`, `PurchaseModule`, `SalesModule`
- **Mục đích:** Lưu dữ liệu Lô hàng thuộc phân hệ Kho và giá vốn.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, item_id, lot_no)`
- **Nullability:** 5 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `lot_no` | `varchar(100)` | NO | Số chứng từ/tham chiếu |
| `manufacture_date` | `date` | YES | Ngày nghiệp vụ |
| `expiry_date` | `date` | YES | Ngày nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, item_id, lot_no) (uq_inventory_lot)`; `item_id (idx_lot_item_id)`

### `inv.serial_number` — Số sê-ri

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Lưu dữ liệu Số sê-ri thuộc phân hệ Kho và giá vốn.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `current_location_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `current_warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, item_id, serial_no)`
- **Nullability:** 5 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `serial_no` | `varchar(150)` | NO | Số chứng từ/tham chiếu |
| `status` | `varchar(20)` | NO | Trạng thái; default='IN_STOCK' |
| `current_warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `current_location_id` | `uuid` | YES | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |

**Indexes:** `(company_id, item_id, serial_no) (uq_inventory_serial)`; `current_location_id (idx_serial_number_current_location_id)`; `current_warehouse_id (idx_serial_number_current_warehouse_id)`; `item_id (idx_serial_number_item_id)`

### `inv.stock_movement` — Phát sinh nhập xuất tồn

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `InventoryPostingService`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Sổ phát sinh nhập-xuất tồn bất biến sau POST. Balance và costing được tính/tái dựng từ các movement này.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `location_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `lot_id` → `inv.lot.id` (DELETE RESTRICT); `source_document_id` → `core.business_document.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 13 cột bắt buộc / 4 cột nullable
- **Delete policy:** IMMUTABLE_AFTER_POST — không xóa; sai thì reverse/adjust/rebuild theo quy trình.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `location_id` | `uuid` | YES | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `lot_id` | `uuid` | YES | FK → `inv.lot.id`; ON DELETE RESTRICT |
| `source_document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `source_line_id` | `uuid` | YES | Thuộc tính nghiệp vụ |
| `movement_date` | `date` | NO | Ngày nghiệp vụ |
| `movement_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `quantity_in` | `numeric(20,6)` | NO | Số lượng; default=0 |
| `quantity_out` | `numeric(20,6)` | NO | Số lượng; default=0 |
| `unit_cost` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `value_in` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `value_out` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, warehouse_id, item_id, movement_date) (idx_stock_movement_item_date)`; `source_document_id (idx_stock_movement_source)`; `branch_id (idx_stock_movement_branch_id)`; `item_id (idx_stock_movement_item_id)`; `location_id (idx_stock_movement_location_id)`; `lot_id (idx_stock_movement_lot_id)`; `warehouse_id (idx_stock_movement_warehouse_id)`

### `inv.inventory_balance` — Số dư tồn kho theo kho

- **Loại bảng:** `DERIVED_BALANCE`
- **Write owner:** `InventoryCostingService`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Bảng số dư dẫn xuất cho Số dư tồn kho theo kho. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, warehouse_id, item_id, as_of_date)`
- **Nullability:** 8 cột bắt buộc / 1 cột nullable
- **Delete policy:** REBUILDABLE — không sửa tay; có thể truncate/rebuild bằng service chuyên trách khi kiểm soát.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `as_of_date` | `date` | NO | Ngày nghiệp vụ |
| `quantity_on_hand` | `numeric(20,6)` | NO | Số lượng |
| `inventory_value` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `average_unit_cost` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, warehouse_id, item_id, as_of_date) (uq_inventory_balance)`; `(company_id, item_id, as_of_date) (idx_inventory_balance_item)`; `item_id (idx_inventory_balance_item_id)`; `warehouse_id (idx_inventory_balance_warehouse_id)`

### `inv.inventory_location_balance` — Số dư tồn theo vị trí

- **Loại bảng:** `DERIVED_BALANCE`
- **Write owner:** `InventoryCostingService`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Bảng số dư dẫn xuất cho Số dư tồn theo vị trí. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `location_id` → `mdm.inventory_location.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, warehouse_id, location_id, item_id, as_of_date)`
- **Nullability:** 9 cột bắt buộc / 0 cột nullable
- **Delete policy:** REBUILDABLE — không sửa tay; có thể truncate/rebuild bằng service chuyên trách khi kiểm soát.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `location_id` | `uuid` | NO | FK → `mdm.inventory_location.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `as_of_date` | `date` | NO | Ngày nghiệp vụ |
| `quantity_on_hand` | `numeric(20,6)` | NO | Số lượng |
| `inventory_value` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, warehouse_id, location_id, item_id, as_of_date) (uq_inventory_location_balance)`; `item_id (idx_inventory_location_balance_item_id)`; `location_id (idx_inventory_location_balance_location_id)`; `warehouse_id (idx_inventory_location_balance_warehouse_id)`

### `inv.inventory_lot_balance` — Số dư tồn theo lô

- **Loại bảng:** `DERIVED_BALANCE`
- **Write owner:** `InventoryCostingService`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Bảng số dư dẫn xuất cho Số dư tồn theo lô. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `lot_id` → `inv.lot.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, warehouse_id, item_id, lot_id, as_of_date)`
- **Nullability:** 9 cột bắt buộc / 0 cột nullable
- **Delete policy:** REBUILDABLE — không sửa tay; có thể truncate/rebuild bằng service chuyên trách khi kiểm soát.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `lot_id` | `uuid` | NO | FK → `inv.lot.id`; ON DELETE RESTRICT |
| `as_of_date` | `date` | NO | Ngày nghiệp vụ |
| `quantity_on_hand` | `numeric(20,6)` | NO | Số lượng |
| `inventory_value` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, warehouse_id, item_id, lot_id, as_of_date) (uq_inventory_lot_balance)`; `item_id (idx_inventory_lot_balance_item_id)`; `lot_id (idx_inventory_lot_balance_lot_id)`; `warehouse_id (idx_inventory_lot_balance_warehouse_id)`

### `inv.inventory_inspection` — Biên bản kiểm nghiệm vật tư/hàng hóa

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Biên bản kiểm nghiệm vật tư/hàng hóa. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `supplier_id` → `mdm.party.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `supplier_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `inspection_date` | `date` | NO | Ngày nghiệp vụ |
| `inspection_result` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `inspection_note` | `text` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `supplier_id (idx_inventory_inspection_supplier_id)`; `warehouse_id (idx_inventory_inspection_warehouse_id)`

### `inv.inventory_inspection_line` — Chi tiết kiểm nghiệm

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `InventoryModule`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết kiểm nghiệm. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `goods_receipt_line_id` → `pur.goods_receipt_line.id` (DELETE RESTRICT); `inventory_inspection_id` → `inv.inventory_inspection.document_id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `uom_id` → `mdm.unit_of_measure.id` (DELETE RESTRICT)
- **UNIQUE:** `(inventory_inspection_id, line_no)`
- **Nullability:** 9 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `inventory_inspection_id` | `uuid` | NO | FK → `inv.inventory_inspection.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `goods_receipt_line_id` | `uuid` | YES | FK → `pur.goods_receipt_line.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `uom_id` | `uuid` | NO | FK → `mdm.unit_of_measure.id`; ON DELETE RESTRICT |
| `inspected_quantity` | `numeric(20,6)` | NO | Số lượng |
| `accepted_quantity` | `numeric(20,6)` | NO | Số lượng |
| `rejected_quantity` | `numeric(20,6)` | NO | Số lượng; default=0 |
| `quality_result` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `note` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(inventory_inspection_id, line_no) (uq_inventory_inspection_line)`; `goods_receipt_line_id (idx_inventory_inspection_line_goods_receipt_line_id)`; `item_id (idx_inventory_inspection_line_item_id)`; `uom_id (idx_inventory_inspection_line_uom_id)`

### `inv.inventory_costing_run` — Lần tính giá xuất kho

- **Loại bảng:** `PROCESS_RUN`
- **Write owner:** `InventoryCostingService`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Header của một lần xử lý Lần tính giá xuất kho. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `fiscal_period_id` → `gl.fiscal_period.id` (DELETE RESTRICT); `started_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, fiscal_period_id, run_no)`
- **Nullability:** 8 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `fiscal_period_id` | `uuid` | NO | FK → `gl.fiscal_period.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `costing_method` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `run_no` | `varchar(80)` | NO | Số chứng từ/tham chiếu |
| `run_status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `started_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `started_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `completed_at` | `timestamptz` | YES | Thời điểm hệ thống |

**Indexes:** `(company_id, fiscal_period_id, run_no) (uq_inventory_costing_run)`; `fiscal_period_id (idx_inventory_costing_run_fiscal_period_id)`; `started_by_user_id (idx_inventory_costing_run_started_by_user_id)`; `warehouse_id (idx_inventory_costing_run_warehouse_id)`

### `inv.inventory_cost_layer` — Lớp giá tồn kho

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `InventoryCostingService`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Lưu dữ liệu Lớp giá tồn kho thuộc phân hệ Kho và giá vốn.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `item_id` → `mdm.item.id` (DELETE RESTRICT); `lot_id` → `inv.lot.id` (DELETE RESTRICT); `source_movement_id` → `inv.stock_movement.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 10 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | NO | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `item_id` | `uuid` | NO | FK → `mdm.item.id`; ON DELETE RESTRICT |
| `lot_id` | `uuid` | YES | FK → `inv.lot.id`; ON DELETE RESTRICT |
| `source_movement_id` | `uuid` | NO | FK → `inv.stock_movement.id`; ON DELETE RESTRICT |
| `layer_date` | `date` | NO | Ngày nghiệp vụ |
| `original_quantity` | `numeric(20,6)` | NO | Số lượng |
| `remaining_quantity` | `numeric(20,6)` | NO | Số lượng |
| `unit_cost` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `layer_status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |

**Indexes:** `(warehouse_id, item_id, layer_date, layer_status) (idx_inventory_cost_layer_open)`; `source_movement_id (idx_inventory_cost_layer_source)`; `company_id (idx_inventory_cost_layer_company_id)`; `item_id (idx_inventory_cost_layer_item_id)`; `lot_id (idx_inventory_cost_layer_lot_id)`

### `inv.inventory_cost_allocation` — Phân bổ lớp giá cho xuất kho

- **Loại bảng:** `RELATIONSHIP`
- **Write owner:** `InventoryCostingService`
- **Read consumers:** `InventoryModule`
- **Mục đích:** Bảng phân bổ/đối chiếu phục vụ Phân bổ lớp giá cho xuất kho. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.
- **PK:** `id`
- **FK ra:** `cost_layer_id` → `inv.inventory_cost_layer.id` (DELETE RESTRICT); `costing_run_id` → `inv.inventory_costing_run.id` (DELETE RESTRICT); `outbound_movement_id` → `inv.stock_movement.id` (DELETE RESTRICT)
- **UNIQUE:** `(outbound_movement_id, cost_layer_id, costing_run_id)`
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `costing_run_id` | `uuid` | NO | FK → `inv.inventory_costing_run.id`; ON DELETE RESTRICT |
| `outbound_movement_id` | `uuid` | NO | FK → `inv.stock_movement.id`; ON DELETE RESTRICT |
| `cost_layer_id` | `uuid` | NO | FK → `inv.inventory_cost_layer.id`; ON DELETE RESTRICT |
| `allocated_quantity` | `numeric(20,6)` | NO | Số lượng |
| `allocated_value` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |

**Indexes:** `(outbound_movement_id, cost_layer_id, costing_run_id) (uq_inventory_cost_allocation)`; `cost_layer_id (idx_inventory_cost_allocation_cost_layer_id)`; `costing_run_id (idx_inventory_cost_allocation_costing_run_id)`

## 11.14. Schema `fa` — Tài sản cố định

**Owner:** `FixedAssetModule` · **Use Case:** UC-FA · **Số bảng:** 14

### `fa.fixed_asset_category` — Nhóm tài sản cố định

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Lưu dữ liệu Nhóm tài sản cố định thuộc phân hệ Tài sản cố định.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 5 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `default_useful_life_months` | `integer` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_asset_category)`

### `fa.depreciation_method` — Phương pháp khấu hao

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Lưu dữ liệu Phương pháp khấu hao thuộc phân hệ Tài sản cố định.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(150)` | NO | Tên/nhãn hiển thị |
| `method_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_depreciation_method)`

### `fa.fixed_asset` — Tài sản cố định

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Lưu dữ liệu Tài sản cố định thuộc phân hệ Tài sản cố định.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `category_id` → `fa.fixed_asset_category.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `custodian_employee_id` → `org.employee.id` (DELETE RESTRICT); `department_id` → `org.department.id` (DELETE RESTRICT); `depreciation_method_id` → `fa.depreciation_method.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, asset_code)`
- **Nullability:** 15 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `category_id` | `uuid` | NO | FK → `fa.fixed_asset_category.id`; ON DELETE RESTRICT |
| `asset_code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `asset_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `serial_no` | `varchar(150)` | YES | Số chứng từ/tham chiếu |
| `department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `custodian_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `acquisition_date` | `date` | NO | Ngày nghiệp vụ |
| `in_service_date` | `date` | NO | Ngày nghiệp vụ |
| `original_cost` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `residual_value` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `useful_life_months` | `integer` | NO | Thuộc tính nghiệp vụ |
| `depreciation_method_id` | `uuid` | NO | FK → `fa.depreciation_method.id`; ON DELETE RESTRICT |
| `accumulated_depreciation` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `net_book_value` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, asset_code) (uq_asset_code)`; `(branch_id, department_id, status) (idx_asset_org_status)`; `category_id (idx_fixed_asset_category_id)`; `custodian_employee_id (idx_fixed_asset_custodian_employee_id)`; `department_id (idx_fixed_asset_department_id)`; `depreciation_method_id (idx_fixed_asset_depreciation_method_id)`

### `fa.fixed_asset_account_mapping` — Tài khoản hạch toán của TSCĐ

- **Loại bảng:** `RELATIONSHIP`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Bảng quan hệ/ánh xạ cho Tài khoản hạch toán của TSCĐ; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.
- **PK:** `asset_id`
- **FK ra:** `asset_id` → `fa.fixed_asset.id` (DELETE RESTRICT); `accum_depr_account_id` → `gl.account.id` (DELETE RESTRICT); `asset_account_id` → `gl.account.id` (DELETE RESTRICT); `depreciation_expense_account_id` → `gl.account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `asset_id` | `uuid` | NO | FK → `fa.fixed_asset.id`; PK; ON DELETE RESTRICT |
| `asset_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `accum_depr_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `depreciation_expense_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |

**Indexes:** `accum_depr_account_id (idx_fixed_asset_account_mapping_accum_depr_account_id)`; `asset_account_id (idx_fixed_asset_account_mapping_asset_account_id)`; `depreciation_expense_account_id (idx_fixed_asset_account_mapping_depreciation_expens_1c7c9eaf)`

### `fa.fixed_asset_acquisition` — Ghi tăng/Giao nhận TSCĐ

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Ghi tăng/Giao nhận TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `asset_id` → `fa.fixed_asset.id` (DELETE RESTRICT); `source_invoice_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `asset_id` | `uuid` | NO | FK → `fa.fixed_asset.id`; ON DELETE RESTRICT |
| `source_invoice_document_id` | `uuid` | YES | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `handover_form_no` | `varchar(100)` | YES | Số chứng từ/tham chiếu |
| `acquisition_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |

**Indexes:** `asset_id (idx_fixed_asset_acquisition_asset_id)`; `source_invoice_document_id (idx_fixed_asset_acquisition_source_invoice_document_id)`

### `fa.fixed_asset_transfer` — Điều chuyển TSCĐ

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Điều chuyển TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `asset_id` → `fa.fixed_asset.id` (DELETE RESTRICT); `from_branch_id` → `org.branch.id` (DELETE RESTRICT); `from_department_id` → `org.department.id` (DELETE RESTRICT); `to_branch_id` → `org.branch.id` (DELETE RESTRICT); `to_department_id` → `org.department.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 3 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `asset_id` | `uuid` | NO | FK → `fa.fixed_asset.id`; ON DELETE RESTRICT |
| `from_branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `to_branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `from_department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `to_department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `transfer_date` | `date` | NO | Ngày nghiệp vụ |
| `reason` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `asset_id (idx_fixed_asset_transfer_asset_id)`; `from_branch_id (idx_fixed_asset_transfer_from_branch_id)`; `from_department_id (idx_fixed_asset_transfer_from_department_id)`; `to_branch_id (idx_fixed_asset_transfer_to_branch_id)`; `to_department_id (idx_fixed_asset_transfer_to_department_id)`

### `fa.fixed_asset_revaluation` — Đánh giá lại TSCĐ

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Đánh giá lại TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `asset_id` → `fa.fixed_asset.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 8 cột bắt buộc / 0 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `asset_id` | `uuid` | NO | FK → `fa.fixed_asset.id`; ON DELETE RESTRICT |
| `revaluation_date` | `date` | NO | Ngày nghiệp vụ |
| `old_original_cost` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `new_original_cost` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `old_accumulated_depreciation` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `new_accumulated_depreciation` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `reason` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |

**Indexes:** `asset_id (idx_fixed_asset_revaluation_asset_id)`

### `fa.fixed_asset_disposal` — Thanh lý/nhượng bán TSCĐ

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Thanh lý/nhượng bán TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `asset_id` → `fa.fixed_asset.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 1 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `asset_id` | `uuid` | NO | FK → `fa.fixed_asset.id`; ON DELETE RESTRICT |
| `disposal_date` | `date` | NO | Ngày nghiệp vụ |
| `disposal_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `proceeds_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `disposal_cost` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `reason` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `asset_id (idx_fixed_asset_disposal_asset_id)`

### `fa.depreciation_schedule` — Lịch khấu hao

- **Loại bảng:** `SCHEDULE`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Lịch chi tiết cho Lịch khấu hao, dùng chia khoản phải thu/phải trả/khấu hao/phân bổ theo kỳ và làm căn cứ settlement/run.
- **PK:** `id`
- **FK ra:** `asset_id` → `fa.fixed_asset.id` (DELETE RESTRICT)
- **UNIQUE:** `(asset_id, period_start)`
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `asset_id` | `uuid` | NO | FK → `fa.fixed_asset.id`; ON DELETE RESTRICT |
| `period_start` | `date` | NO | Thuộc tính nghiệp vụ |
| `period_end` | `date` | NO | Thuộc tính nghiệp vụ |
| `depreciation_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `status` | `varchar(20)` | NO | Trạng thái; default='PLANNED' |

**Indexes:** `(asset_id, period_start) (uq_asset_depr_schedule)`

### `fa.depreciation_run` — Lần tính khấu hao

- **Loại bảng:** `PROCESS_RUN`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Header của một lần xử lý Lần tính khấu hao. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `created_by` → `iam.user_account.id` (DELETE RESTRICT); `fiscal_period_id` → `gl.fiscal_period.id` (DELETE RESTRICT); `journal_entry_id` → `gl.journal_entry.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, fiscal_period_id, run_no)`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `fiscal_period_id` | `uuid` | NO | FK → `gl.fiscal_period.id`; ON DELETE RESTRICT |
| `run_no` | `varchar(50)` | NO | Số chứng từ/tham chiếu |
| `status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `journal_entry_id` | `uuid` | YES | FK → `gl.journal_entry.id`; ON DELETE RESTRICT |
| `created_by` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, fiscal_period_id, run_no) (uq_depreciation_run)`; `created_by (idx_depreciation_run_created_by)`; `fiscal_period_id (idx_depreciation_run_fiscal_period_id)`; `journal_entry_id (idx_depreciation_run_journal_entry_id)`

### `fa.depreciation_run_line` — Chi tiết tính khấu hao

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết tính khấu hao. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `accum_depr_account_id` → `gl.account.id` (DELETE RESTRICT); `asset_id` → `fa.fixed_asset.id` (DELETE RESTRICT); `depreciation_run_id` → `fa.depreciation_run.id` (DELETE RESTRICT); `expense_account_id` → `gl.account.id` (DELETE RESTRICT)
- **UNIQUE:** `(depreciation_run_id, asset_id)`
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `depreciation_run_id` | `uuid` | NO | FK → `fa.depreciation_run.id`; ON DELETE RESTRICT |
| `asset_id` | `uuid` | NO | FK → `fa.fixed_asset.id`; ON DELETE RESTRICT |
| `depreciation_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `expense_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `accum_depr_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |

**Indexes:** `(depreciation_run_id, asset_id) (uq_depreciation_run_asset)`; `accum_depr_account_id (idx_depreciation_run_line_accum_depr_account_id)`; `asset_id (idx_depreciation_run_line_asset_id)`; `expense_account_id (idx_depreciation_run_line_expense_account_id)`

### `fa.fixed_asset_maintenance_completion` — Nghiệm thu sửa chữa/nâng cấp TSCĐ

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Nghiệm thu sửa chữa/nâng cấp TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `fixed_asset_id` → `fa.fixed_asset.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 8 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `fixed_asset_id` | `uuid` | NO | FK → `fa.fixed_asset.id`; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `maintenance_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `work_description` | `text` | NO | Thuộc tính nghiệp vụ |
| `started_date` | `date` | YES | Ngày nghiệp vụ |
| `completed_date` | `date` | NO | Ngày nghiệp vụ |
| `expense_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `capitalized_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `acceptance_result` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |

**Indexes:** `fixed_asset_id (idx_fixed_asset_maintenance_completion_fixed_asset_id)`; `vendor_id (idx_fixed_asset_maintenance_completion_vendor_id)`

### `fa.fixed_asset_inventory` — Kiểm kê TSCĐ

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Kiểm kê TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `department_id` → `org.department.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `inventory_date` | `date` | NO | Ngày nghiệp vụ |
| `inventory_scope` | `varchar(30)` | NO | Thuộc tính nghiệp vụ; default='FULL' |
| `conclusion` | `text` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `branch_id (idx_fixed_asset_inventory_branch_id)`; `department_id (idx_fixed_asset_inventory_department_id)`

### `fa.fixed_asset_inventory_line` — Chi tiết kiểm kê TSCĐ

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `FixedAssetModule`
- **Read consumers:** `FixedAssetModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết kiểm kê TSCĐ. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `fixed_asset_id` → `fa.fixed_asset.id` (DELETE RESTRICT); `fixed_asset_inventory_id` → `fa.fixed_asset_inventory.document_id` (DELETE RESTRICT)
- **UNIQUE:** `(fixed_asset_inventory_id, line_no)`
- **Nullability:** 7 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `fixed_asset_inventory_id` | `uuid` | NO | FK → `fa.fixed_asset_inventory.document_id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `fixed_asset_id` | `uuid` | NO | FK → `fa.fixed_asset.id`; ON DELETE RESTRICT |
| `book_status` | `varchar(30)` | NO | Trạng thái |
| `actual_status` | `varchar(30)` | NO | Trạng thái |
| `book_value` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `actual_value` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `difference_amount` | `numeric(20,4)` | YES | Giá trị tiền tệ |
| `handling_proposal` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(fixed_asset_inventory_id, line_no) (uq_fixed_asset_inventory_line)`; `fixed_asset_id (idx_fixed_asset_inventory_line_fixed_asset_id)`

## 11.15. Schema `ccdc` — Công cụ dụng cụ và chi phí trả trước

**Owner:** `CcdcModule` · **Use Case:** UC-FA/CCDC · **Số bảng:** 9

### `ccdc.tool_category` — Nhóm công cụ dụng cụ

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `CcdcModule`
- **Read consumers:** `CcdcModule`
- **Mục đích:** Lưu dữ liệu Nhóm công cụ dụng cụ thuộc phân hệ Công cụ dụng cụ và chi phí trả trước.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 5 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `default_allocation_months` | `integer` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_tool_category)`

### `ccdc.tool` — Công cụ dụng cụ

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `CcdcModule`
- **Read consumers:** `CcdcModule`
- **Mục đích:** Lưu dữ liệu Công cụ dụng cụ thuộc phân hệ Công cụ dụng cụ và chi phí trả trước.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `category_id` → `ccdc.tool_category.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `custodian_employee_id` → `org.employee.id` (DELETE RESTRICT); `department_id` → `org.department.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 11 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `category_id` | `uuid` | NO | FK → `ccdc.tool_category.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `quantity` | `numeric(20,6)` | NO | Số lượng |
| `original_value` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `remaining_value` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `allocation_months` | `integer` | NO | Thuộc tính nghiệp vụ |
| `department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `custodian_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_tool_code)`; `branch_id (idx_tool_branch_id)`; `category_id (idx_tool_category_id)`; `custodian_employee_id (idx_tool_custodian_employee_id)`; `department_id (idx_tool_department_id)`

### `ccdc.tool_issue` — Xuất dùng công cụ dụng cụ

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `CcdcModule`
- **Read consumers:** `CcdcModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Xuất dùng công cụ dụng cụ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `department_id` → `org.department.id` (DELETE RESTRICT); `employee_id` → `org.employee.id` (DELETE RESTRICT); `tool_id` → `ccdc.tool.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 2 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `tool_id` | `uuid` | NO | FK → `ccdc.tool.id`; ON DELETE RESTRICT |
| `department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `issue_date` | `date` | NO | Ngày nghiệp vụ |
| `quantity` | `numeric(20,6)` | NO | Số lượng |

**Indexes:** `department_id (idx_tool_issue_department_id)`; `employee_id (idx_tool_issue_employee_id)`; `tool_id (idx_tool_issue_tool_id)`

### `ccdc.tool_transfer` — Điều chuyển công cụ dụng cụ

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `CcdcModule`
- **Read consumers:** `CcdcModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Điều chuyển công cụ dụng cụ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `from_department_id` → `org.department.id` (DELETE RESTRICT); `from_employee_id` → `org.employee.id` (DELETE RESTRICT); `to_department_id` → `org.department.id` (DELETE RESTRICT); `to_employee_id` → `org.employee.id` (DELETE RESTRICT); `tool_id` → `ccdc.tool.id` (DELETE RESTRICT); `document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 4 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `tool_id` | `uuid` | NO | FK → `ccdc.tool.id`; ON DELETE RESTRICT |
| `from_department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `to_department_id` | `uuid` | YES | FK → `org.department.id`; ON DELETE RESTRICT |
| `from_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `to_employee_id` | `uuid` | YES | FK → `org.employee.id`; ON DELETE RESTRICT |
| `transfer_date` | `date` | NO | Ngày nghiệp vụ |

**Indexes:** `from_department_id (idx_tool_transfer_from_department_id)`; `from_employee_id (idx_tool_transfer_from_employee_id)`; `to_department_id (idx_tool_transfer_to_department_id)`; `to_employee_id (idx_tool_transfer_to_employee_id)`; `tool_id (idx_tool_transfer_tool_id)`

### `ccdc.allocation_schedule` — Lịch phân bổ CCDC

- **Loại bảng:** `SCHEDULE`
- **Write owner:** `CcdcModule`
- **Read consumers:** `CcdcModule`
- **Mục đích:** Bảng phân bổ/đối chiếu phục vụ Lịch phân bổ CCDC. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.
- **PK:** `id`
- **FK ra:** `expense_account_id` → `gl.account.id` (DELETE RESTRICT); `tool_id` → `ccdc.tool.id` (DELETE RESTRICT)
- **UNIQUE:** `(tool_id, period_start)`
- **Nullability:** 7 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `tool_id` | `uuid` | NO | FK → `ccdc.tool.id`; ON DELETE RESTRICT |
| `period_start` | `date` | NO | Thuộc tính nghiệp vụ |
| `period_end` | `date` | NO | Thuộc tính nghiệp vụ |
| `allocation_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `expense_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `status` | `varchar(20)` | NO | Trạng thái; default='PLANNED' |

**Indexes:** `(tool_id, period_start) (uq_tool_allocation_schedule)`; `expense_account_id (idx_allocation_schedule_expense_account_id)`

### `ccdc.allocation_run` — Lần phân bổ CCDC

- **Loại bảng:** `PROCESS_RUN`
- **Write owner:** `CcdcModule`
- **Read consumers:** `CcdcModule`
- **Mục đích:** Bảng phân bổ/đối chiếu phục vụ Lần phân bổ CCDC. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `created_by` → `iam.user_account.id` (DELETE RESTRICT); `fiscal_period_id` → `gl.fiscal_period.id` (DELETE RESTRICT); `journal_entry_id` → `gl.journal_entry.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, fiscal_period_id, run_no)`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `fiscal_period_id` | `uuid` | NO | FK → `gl.fiscal_period.id`; ON DELETE RESTRICT |
| `run_no` | `varchar(50)` | NO | Số chứng từ/tham chiếu |
| `status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `journal_entry_id` | `uuid` | YES | FK → `gl.journal_entry.id`; ON DELETE RESTRICT |
| `created_by` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, fiscal_period_id, run_no) (uq_tool_allocation_run)`; `created_by (idx_allocation_run_created_by)`; `fiscal_period_id (idx_allocation_run_fiscal_period_id)`; `journal_entry_id (idx_allocation_run_journal_entry_id)`

### `ccdc.allocation_run_line` — Chi tiết phân bổ CCDC

- **Loại bảng:** `ALLOCATION_LINK`
- **Write owner:** `CcdcModule`
- **Read consumers:** `CcdcModule`
- **Mục đích:** Bảng phân bổ/đối chiếu phục vụ Chi tiết phân bổ CCDC. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.
- **PK:** `id`
- **FK ra:** `allocation_run_id` → `ccdc.allocation_run.id` (DELETE RESTRICT); `expense_account_id` → `gl.account.id` (DELETE RESTRICT); `prepaid_account_id` → `gl.account.id` (DELETE RESTRICT); `tool_id` → `ccdc.tool.id` (DELETE RESTRICT)
- **UNIQUE:** `(allocation_run_id, tool_id)`
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `allocation_run_id` | `uuid` | NO | FK → `ccdc.allocation_run.id`; ON DELETE RESTRICT |
| `tool_id` | `uuid` | NO | FK → `ccdc.tool.id`; ON DELETE RESTRICT |
| `allocation_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `expense_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `prepaid_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |

**Indexes:** `(allocation_run_id, tool_id) (uq_tool_allocation_run_line)`; `expense_account_id (idx_allocation_run_line_expense_account_id)`; `prepaid_account_id (idx_allocation_run_line_prepaid_account_id)`; `tool_id (idx_allocation_run_line_tool_id)`

### `ccdc.prepaid_expense` — Chi phí trả trước

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `CcdcModule`
- **Read consumers:** `CcdcModule`
- **Mục đích:** Lưu dữ liệu Chi phí trả trước thuộc phân hệ Công cụ dụng cụ và chi phí trả trước.
- **PK:** `id`
- **FK ra:** `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `expense_account_id` → `gl.account.id` (DELETE RESTRICT); `prepaid_account_id` → `gl.account.id` (DELETE RESTRICT); `source_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 12 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `source_document_id` | `uuid` | YES | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `original_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `remaining_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `start_date` | `date` | NO | Ngày nghiệp vụ |
| `allocation_months` | `integer` | NO | Thuộc tính nghiệp vụ |
| `prepaid_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `expense_account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_prepaid_expense_code)`; `branch_id (idx_prepaid_expense_branch_id)`; `expense_account_id (idx_prepaid_expense_expense_account_id)`; `prepaid_account_id (idx_prepaid_expense_prepaid_account_id)`; `source_document_id (idx_prepaid_expense_source_document_id)`

### `ccdc.prepaid_expense_schedule` — Lịch phân bổ chi phí trả trước

- **Loại bảng:** `SCHEDULE`
- **Write owner:** `CcdcModule`
- **Read consumers:** `CcdcModule`
- **Mục đích:** Lịch chi tiết cho Lịch phân bổ chi phí trả trước, dùng chia khoản phải thu/phải trả/khấu hao/phân bổ theo kỳ và làm căn cứ settlement/run.
- **PK:** `id`
- **FK ra:** `prepaid_expense_id` → `ccdc.prepaid_expense.id` (DELETE RESTRICT)
- **UNIQUE:** `(prepaid_expense_id, period_start)`
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `prepaid_expense_id` | `uuid` | NO | FK → `ccdc.prepaid_expense.id`; ON DELETE RESTRICT |
| `period_start` | `date` | NO | Thuộc tính nghiệp vụ |
| `period_end` | `date` | NO | Thuộc tính nghiệp vụ |
| `allocation_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `status` | `varchar(20)` | NO | Trạng thái; default='PLANNED' |

**Indexes:** `(prepaid_expense_id, period_start) (uq_prepaid_expense_schedule)`

## 11.16. Schema `tax` — Thuế và hóa đơn điện tử

**Owner:** `TaxModule` · **Use Case:** UC-TAX · **Số bảng:** 22

### `tax.tax_service_provider` — Nhà cung cấp dịch vụ thuế/HĐĐT

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu dữ liệu Nhà cung cấp dịch vụ thuế/HĐĐT thuộc phân hệ Thuế và hóa đơn điện tử.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 8 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `provider_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `supports_einvoice` | `boolean` | NO | Cờ cấu hình; default=false |
| `supports_tax_filing` | `boolean` | NO | Cờ cấu hình; default=false |
| `api_base_url` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `credential_reference` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_tax_service_provider)`; `(company_id, provider_type, status) (idx_tax_service_provider_type)`

### `tax.einvoice_raw_payload` — Dữ liệu HĐĐT thô

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu dữ liệu Dữ liệu HĐĐT thô thuộc phân hệ Thuế và hóa đơn điện tử.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `provider_id` → `tax.tax_service_provider.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `provider_id` | `uuid` | YES | FK → `tax.tax_service_provider.id`; ON DELETE RESTRICT |
| `external_id` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `payload_type` | `varchar(50)` | NO | Dữ liệu cấu hình/payload có cấu trúc |
| `payload_json` | `jsonb` | NO | Dữ liệu cấu hình/payload có cấu trúc |
| `checksum_sha256` | `varchar(64)` | YES | Thuộc tính nghiệp vụ |
| `received_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(provider_id, external_id) (idx_einvoice_raw_external)`; `(company_id, received_at) (idx_einvoice_raw_time)`

### `tax.tax_invoice` — Hóa đơn thuế/hóa đơn điện tử chuẩn hóa

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Bản chuẩn hóa hóa đơn thuế/hóa đơn điện tử tách biệt với chứng từ kế toán. Dùng để kiểm tra hợp lệ, khấu trừ/kê khai và liên kết với chứng từ mua/bán.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `provider_id` → `tax.tax_service_provider.id` (DELETE RESTRICT); `raw_payload_id` → `tax.einvoice_raw_payload.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, direction, deduplication_key)`
- **Nullability:** 17 cột bắt buộc / 8 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `provider_id` | `uuid` | YES | FK → `tax.tax_service_provider.id`; ON DELETE RESTRICT |
| `direction` | `varchar(10)` | NO | Thuộc tính nghiệp vụ |
| `invoice_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `form_symbol` | `varchar(50)` | YES | Thuộc tính nghiệp vụ |
| `invoice_symbol` | `varchar(50)` | YES | Thuộc tính nghiệp vụ |
| `invoice_number` | `varchar(80)` | NO | Thuộc tính nghiệp vụ |
| `invoice_date` | `date` | NO | Ngày nghiệp vụ |
| `seller_tax_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `seller_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `buyer_tax_code` | `varchar(30)` | YES | Mã nghiệp vụ/danh mục |
| `buyer_name` | `varchar(255)` | YES | Tên/nhãn hiển thị |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `exchange_rate` | `numeric(20,8)` | NO | Thuộc tính nghiệp vụ; default=1 |
| `amount_before_tax` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `total_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `lookup_code` | `varchar(150)` | YES | Mã nghiệp vụ/danh mục |
| `provider_invoice_id` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `deduplication_key` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `invoice_status` | `varchar(30)` | NO | Trạng thái |
| `processing_status` | `varchar(30)` | NO | Trạng thái; default='NEW' |
| `raw_payload_id` | `uuid` | YES | FK → `tax.einvoice_raw_payload.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, direction, deduplication_key) (uq_tax_invoice_deduplication)`; `(provider_id, provider_invoice_id) (idx_tax_invoice_provider_external)`; `(company_id, invoice_date, processing_status) (idx_tax_invoice_processing)`; `(seller_tax_code, invoice_date) (idx_tax_invoice_seller)`; `currency_id (idx_tax_invoice_currency_id)`; `raw_payload_id (idx_tax_invoice_raw_payload_id)`

### `tax.tax_invoice_line` — Chi tiết hóa đơn thuế

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết hóa đơn thuế. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `tax_invoice_id` → `tax.tax_invoice.id` (DELETE RESTRICT)
- **UNIQUE:** `(tax_invoice_id, line_no)`
- **Nullability:** 7 cột bắt buộc / 4 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `tax_invoice_id` | `uuid` | NO | FK → `tax.tax_invoice.id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `item_name` | `varchar(500)` | NO | Tên/nhãn hiển thị |
| `uom_name` | `varchar(100)` | YES | Tên/nhãn hiển thị |
| `quantity` | `numeric(20,6)` | YES | Số lượng |
| `unit_price` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `amount_before_tax` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `tax_rate_percent` | `numeric(9,4)` | YES | Thuộc tính nghiệp vụ |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `discount_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `(tax_invoice_id, line_no) (uq_tax_invoice_line)`

### `tax.tax_invoice_link` — Quan hệ điều chỉnh/thay thế hóa đơn

- **Loại bảng:** `RELATIONSHIP`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Bảng quan hệ/ánh xạ cho Quan hệ điều chỉnh/thay thế hóa đơn; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.
- **PK:** `id`
- **FK ra:** `source_tax_invoice_id` → `tax.tax_invoice.id` (DELETE RESTRICT); `target_tax_invoice_id` → `tax.tax_invoice.id` (DELETE RESTRICT)
- **UNIQUE:** `(source_tax_invoice_id, target_tax_invoice_id, link_type)`
- **Nullability:** 5 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `source_tax_invoice_id` | `uuid` | NO | FK → `tax.tax_invoice.id`; ON DELETE RESTRICT |
| `target_tax_invoice_id` | `uuid` | NO | FK → `tax.tax_invoice.id`; ON DELETE RESTRICT |
| `link_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `reason` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(source_tax_invoice_id, target_tax_invoice_id, link_type) (uq_tax_invoice_link)`; `target_tax_invoice_id (idx_tax_invoice_link_target_tax_invoice_id)`

### `tax.input_invoice_processing` — Xử lý hóa đơn đầu vào

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu dữ liệu Xử lý hóa đơn đầu vào thuộc phân hệ Thuế và hóa đơn điện tử.
- **PK:** `tax_invoice_id`
- **FK ra:** `linked_document_id` → `core.business_document.id` (DELETE RESTRICT); `reviewed_by` → `iam.user_account.id` (DELETE RESTRICT); `vendor_id` → `mdm.party.id` (DELETE RESTRICT); `tax_invoice_id` → `tax.tax_invoice.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 3 cột bắt buộc / 5 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `tax_invoice_id` | `uuid` | NO | FK → `tax.tax_invoice.id`; PK; ON DELETE RESTRICT |
| `vendor_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `linked_document_id` | `uuid` | YES | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `accounting_status` | `varchar(30)` | NO | Trạng thái; default='UNACCOUNTED' |
| `deductibility_status` | `varchar(30)` | NO | Trạng thái; default='PENDING' |
| `reviewed_by` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `reviewed_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `note` | `text` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `linked_document_id (idx_input_invoice_processing_linked_document_id)`; `reviewed_by (idx_input_invoice_processing_reviewed_by)`; `vendor_id (idx_input_invoice_processing_vendor_id)`

### `tax.invoice_validation_result` — Kết quả kiểm tra hóa đơn

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu dữ liệu Kết quả kiểm tra hóa đơn thuộc phân hệ Thuế và hóa đơn điện tử.
- **PK:** `id`
- **FK ra:** `tax_invoice_id` → `tax.tax_invoice.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `tax_invoice_id` | `uuid` | NO | FK → `tax.tax_invoice.id`; ON DELETE RESTRICT |
| `rule_code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `severity` | `varchar(20)` | NO | Thuộc tính nghiệp vụ |
| `result` | `varchar(20)` | NO | Thuộc tính nghiệp vụ |
| `message` | `varchar(1000)` | YES | Thuộc tính nghiệp vụ |
| `checked_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(tax_invoice_id, rule_code) (idx_tax_invoice_validation)`

### `tax.invoice_risk_check` — Kết quả kiểm tra rủi ro NCC

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu dữ liệu Kết quả kiểm tra rủi ro NCC thuộc phân hệ Thuế và hóa đơn điện tử.
- **PK:** `id`
- **FK ra:** `tax_invoice_id` → `tax.tax_invoice.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `tax_invoice_id` | `uuid` | NO | FK → `tax.tax_invoice.id`; ON DELETE RESTRICT |
| `supplier_tax_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `risk_source` | `varchar(80)` | NO | Thuộc tính nghiệp vụ |
| `risk_level` | `varchar(20)` | NO | Thuộc tính nghiệp vụ |
| `risk_code` | `varchar(80)` | YES | Mã nghiệp vụ/danh mục |
| `detail` | `text` | YES | Thuộc tính nghiệp vụ |
| `checked_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(supplier_tax_code, checked_at) (idx_supplier_risk_check)`; `tax_invoice_id (idx_invoice_risk_check_tax_invoice_id)`

### `tax.vat_ledger` — Sổ VAT

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu dữ liệu Sổ VAT thuộc phân hệ Thuế và hóa đơn điện tử.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `source_document_id` → `core.business_document.id` (DELETE RESTRICT); `tax_invoice_id` → `tax.tax_invoice.id` (DELETE RESTRICT); `tax_period_id` → `tax.tax_period.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 9 cột bắt buộc / 2 cột nullable
- **Delete policy:** IMMUTABLE_AFTER_POST — không xóa; sai thì reverse/adjust/rebuild theo quy trình.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `tax_period_id` | `uuid` | NO | FK → `tax.tax_period.id`; ON DELETE RESTRICT |
| `tax_invoice_id` | `uuid` | NO | FK → `tax.tax_invoice.id`; ON DELETE RESTRICT |
| `source_document_id` | `uuid` | YES | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `direction` | `varchar(10)` | NO | Thuộc tính nghiệp vụ |
| `taxable_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `deductible_tax_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `tax_rate_percent` | `numeric(9,4)` | YES | Thuộc tính nghiệp vụ |
| `posted_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, tax_period_id, direction) (idx_vat_ledger_period)`; `tax_invoice_id (idx_vat_ledger_invoice)`; `source_document_id (idx_vat_ledger_source_document_id)`; `tax_period_id (idx_vat_ledger_tax_period_id)`

### `tax.tax_period` — Kỳ thuế

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu dữ liệu Kỳ thuế thuộc phân hệ Thuế và hóa đơn điện tử.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, tax_type, period_code)`
- **Nullability:** 7 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `tax_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `period_code` | `varchar(20)` | NO | Mã nghiệp vụ/danh mục |
| `period_start` | `date` | NO | Thuộc tính nghiệp vụ |
| `period_end` | `date` | NO | Thuộc tính nghiệp vụ |
| `filing_due_date` | `date` | YES | Ngày nghiệp vụ |
| `payment_due_date` | `date` | YES | Ngày nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |

**Indexes:** `(company_id, tax_type, period_code) (uq_tax_period)`

### `tax.tax_declaration` — Tờ khai thuế

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Tờ khai thuế. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `tax_form_version_id` → `tax.tax_form_version.id` (DELETE RESTRICT); `tax_period_id` → `tax.tax_period.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 9 cột bắt buộc / 0 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `tax_period_id` | `uuid` | NO | FK → `tax.tax_period.id`; ON DELETE RESTRICT |
| `tax_form_version_id` | `uuid` | NO | FK → `tax.tax_form_version.id`; ON DELETE RESTRICT |
| `declaration_type` | `varchar(50)` | NO | Thuộc tính nghiệp vụ |
| `declaration_version` | `integer` | NO | Thuộc tính nghiệp vụ; default=1 |
| `submission_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ; default='INITIAL' |
| `payable_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `refundable_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `carry_forward_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `tax_form_version_id (idx_tax_declaration_tax_form_version_id)`; `tax_period_id (idx_tax_declaration_tax_period_id)`

### `tax.tax_declaration_line` — Chỉ tiêu tờ khai thuế

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu chi tiết dòng của Chỉ tiêu tờ khai thuế. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `tax_declaration_id` → `tax.tax_declaration.document_id` (DELETE RESTRICT); `tax_form_indicator_id` → `tax.tax_form_indicator.id` (DELETE RESTRICT)
- **UNIQUE:** `(tax_declaration_id, indicator_code)`
- **Nullability:** 5 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `tax_declaration_id` | `uuid` | NO | FK → `tax.tax_declaration.document_id`; ON DELETE RESTRICT |
| `tax_form_indicator_id` | `uuid` | NO | FK → `tax.tax_form_indicator.id`; ON DELETE RESTRICT |
| `indicator_code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `indicator_name_snapshot` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `amount` | `numeric(20,4)` | YES | Thuộc tính nghiệp vụ |
| `text_value` | `varchar(1000)` | YES | Thuộc tính nghiệp vụ |
| `calculation_detail_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |

**Indexes:** `(tax_declaration_id, indicator_code) (uq_tax_declaration_indicator)`; `tax_form_indicator_id (idx_tax_declaration_line_tax_form_indicator_id)`

### `tax.tax_obligation` — Nghĩa vụ thuế phải nộp

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu dữ liệu Nghĩa vụ thuế phải nộp thuộc phân hệ Thuế và hóa đơn điện tử.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `source_declaration_id` → `tax.tax_declaration.document_id` (DELETE RESTRICT); `tax_period_id` → `tax.tax_period.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 9 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `tax_period_id` | `uuid` | NO | FK → `tax.tax_period.id`; ON DELETE RESTRICT |
| `tax_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `source_declaration_id` | `uuid` | YES | FK → `tax.tax_declaration.document_id`; ON DELETE RESTRICT |
| `assessed_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `paid_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `remaining_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `due_date` | `date` | NO | Ngày nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |

**Indexes:** `(company_id, tax_type, due_date, status) (idx_tax_obligation_due)`; `source_declaration_id (idx_tax_obligation_source_declaration_id)`; `tax_period_id (idx_tax_obligation_tax_period_id)`

### `tax.tax_payment` — Nộp thuế

- **Loại bảng:** `DOCUMENT_EXTENSION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Phần mở rộng nghiệp vụ cho Nộp thuế. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.
- **PK:** `document_id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `bank_account_id` → `mdm.company_bank_account.id` (DELETE RESTRICT); `tax_obligation_id` → `tax.tax_obligation.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 3 cột nullable
- **Delete policy:** NO_HARD_DELETE_AFTER_USE — Draft có thể soft-delete; đã Submit/Approve/Post thì Cancel/Reverse.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; PK; ON DELETE RESTRICT |
| `tax_obligation_id` | `uuid` | YES | FK → `tax.tax_obligation.id`; ON DELETE RESTRICT |
| `tax_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `payment_reference` | `varchar(150)` | YES | Thuộc tính nghiệp vụ |
| `payment_date` | `date` | NO | Ngày nghiệp vụ |
| `amount` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `bank_account_id` | `uuid` | YES | FK → `mdm.company_bank_account.id`; ON DELETE RESTRICT |

**Indexes:** `bank_account_id (idx_tax_payment_bank_account_id)`; `tax_obligation_id (idx_tax_payment_tax_obligation_id)`

### `tax.tax_submission` — Lần gửi tờ khai

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu dữ liệu Lần gửi tờ khai thuộc phân hệ Thuế và hóa đơn điện tử.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `provider_id` → `tax.tax_service_provider.id` (DELETE RESTRICT); `submitted_by` → `iam.user_account.id` (DELETE RESTRICT); `tax_declaration_id` → `tax.tax_declaration.document_id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `tax_declaration_id` | `uuid` | NO | FK → `tax.tax_declaration.document_id`; ON DELETE RESTRICT |
| `submission_no` | `varchar(100)` | YES | Số chứng từ/tham chiếu |
| `provider_id` | `uuid` | YES | FK → `tax.tax_service_provider.id`; ON DELETE RESTRICT |
| `submitted_at` | `timestamptz` | NO | Thời điểm hệ thống |
| `submitted_by` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `status` | `varchar(30)` | NO | Trạng thái |

**Indexes:** `(tax_declaration_id, submitted_at) (idx_tax_submission_declaration)`; `company_id (idx_tax_submission_company_id)`; `provider_id (idx_tax_submission_provider_id)`; `submitted_by (idx_tax_submission_submitted_by)`

### `tax.tax_submission_response` — Phản hồi nộp tờ khai

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu dữ liệu Phản hồi nộp tờ khai thuộc phân hệ Thuế và hóa đơn điện tử.
- **PK:** `id`
- **FK ra:** `submission_id` → `tax.tax_submission.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 4 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `submission_id` | `uuid` | NO | FK → `tax.tax_submission.id`; ON DELETE RESTRICT |
| `response_code` | `varchar(100)` | YES | Mã nghiệp vụ/danh mục |
| `response_status` | `varchar(30)` | NO | Trạng thái |
| `response_message` | `text` | YES | Thuộc tính nghiệp vụ |
| `response_payload` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |
| `received_at` | `timestamptz` | NO | Thời điểm hệ thống |

**Indexes:** `(submission_id, received_at) (idx_tax_submission_response)`

### `tax.einvoice_sync_batch` — Lần đồng bộ HĐĐT

- **Loại bảng:** `PROCESS_RUN`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Header của một lần xử lý Lần đồng bộ HĐĐT. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `provider_id` → `tax.tax_service_provider.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 10 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `provider_id` | `uuid` | NO | FK → `tax.tax_service_provider.id`; ON DELETE RESTRICT |
| `direction` | `varchar(10)` | NO | Thuộc tính nghiệp vụ |
| `from_time` | `timestamptz` | NO | Thuộc tính nghiệp vụ |
| `to_time` | `timestamptz` | NO | Thuộc tính nghiệp vụ |
| `started_at` | `timestamptz` | NO | Thời điểm hệ thống |
| `completed_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `status` | `varchar(20)` | NO | Trạng thái |
| `record_count` | `integer` | NO | Thuộc tính nghiệp vụ; default=0 |
| `error_count` | `integer` | NO | Thuộc tính nghiệp vụ; default=0 |

**Indexes:** `(company_id, provider_id, started_at) (idx_einvoice_sync_batch)`; `provider_id (idx_einvoice_sync_batch_provider_id)`

### `tax.tax_invoice_document_link` — Liên kết hóa đơn thuế với chứng từ kế toán

- **Loại bảng:** `RELATIONSHIP`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Bảng quan hệ/ánh xạ cho Liên kết hóa đơn thuế với chứng từ kế toán; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.
- **PK:** `id`
- **FK ra:** `document_id` → `core.business_document.id` (DELETE RESTRICT); `tax_invoice_id` → `tax.tax_invoice.id` (DELETE RESTRICT)
- **UNIQUE:** `(tax_invoice_id, document_id, link_type)`
- **Nullability:** 5 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `tax_invoice_id` | `uuid` | NO | FK → `tax.tax_invoice.id`; ON DELETE RESTRICT |
| `document_id` | `uuid` | NO | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `link_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `allocated_amount_before_tax` | `numeric(20,4)` | YES | Giá trị tiền tệ |
| `allocated_tax_amount` | `numeric(20,4)` | YES | Giá trị tiền tệ |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(tax_invoice_id, document_id, link_type) (uq_tax_invoice_document_link)`; `document_id (idx_tax_invoice_document_link_document)`

### `tax.tax_form_definition` — Định nghĩa mẫu tờ khai

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Cấu hình/danh mục cho Định nghĩa mẫu tờ khai. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `(tax_type, form_code)`
- **Nullability:** 6 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `tax_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `form_code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `form_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `legal_basis` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `filing_frequency` | `varchar(30)` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(tax_type, form_code) (uq_tax_form_definition)`

### `tax.tax_form_version` — Phiên bản mẫu tờ khai

- **Loại bảng:** `VERSIONED_CONFIG`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Phiên bản hóa Phiên bản mẫu tờ khai. Khi version đã được publish/được chứng từ tham chiếu thì giữ bất biến và tạo version mới khi thay đổi.
- **PK:** `id`
- **FK ra:** `tax_form_definition_id` → `tax.tax_form_definition.id` (DELETE CASCADE)
- **UNIQUE:** `(tax_form_definition_id, version_no)`
- **Nullability:** 6 cột bắt buộc / 2 cột nullable
- **Delete policy:** VERSIONED — không sửa/xóa version đã publish hoặc đã được tham chiếu.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `tax_form_definition_id` | `uuid` | NO | FK → `tax.tax_form_definition.id`; ON DELETE CASCADE |
| `version_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `effective_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | YES | Thuộc tính nghiệp vụ |
| `schema_version` | `varchar(50)` | YES | Thuộc tính nghiệp vụ |
| `version_status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(tax_form_definition_id, version_no) (uq_tax_form_version)`; `(tax_form_definition_id, version_status, effective_from) (idx_tax_form_version_effective)`

**CHECK:** ``effective_to is null or effective_to >= effective_from` [name: 'ck_tax_form_version_validity']`

### `tax.tax_form_indicator` — Chỉ tiêu mẫu tờ khai

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Lưu dữ liệu Chỉ tiêu mẫu tờ khai thuộc phân hệ Thuế và hóa đơn điện tử.
- **PK:** `id`
- **FK ra:** `parent_indicator_id` → `tax.tax_form_indicator.id` (DELETE RESTRICT); `tax_form_version_id` → `tax.tax_form_version.id` (DELETE CASCADE)
- **UNIQUE:** `(tax_form_version_id, indicator_code)`
- **Nullability:** 7 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `tax_form_version_id` | `uuid` | NO | FK → `tax.tax_form_version.id`; ON DELETE CASCADE |
| `parent_indicator_id` | `uuid` | YES | FK → `tax.tax_form_indicator.id`; ON DELETE RESTRICT |
| `indicator_code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `indicator_name` | `varchar(500)` | NO | Tên/nhãn hiển thị |
| `data_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `calculation_source` | `varchar(80)` | YES | Thuộc tính nghiệp vụ |
| `display_order` | `integer` | NO | Thuộc tính nghiệp vụ |
| `is_required` | `boolean` | NO | Cờ cấu hình; default=false |

**Indexes:** `(tax_form_version_id, indicator_code) (uq_tax_form_indicator)`; `(tax_form_version_id, display_order) (idx_tax_form_indicator_order)`; `parent_indicator_id (idx_tax_form_indicator_parent_indicator_id)`

### `tax.tax_calculation_rule` — Phiên bản quy tắc tính thuế

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `TaxModule`
- **Read consumers:** `TaxModule`
- **Mục đích:** Cấu hình/danh mục cho Phiên bản quy tắc tính thuế. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `(tax_type, rule_code, rule_version)`
- **Nullability:** 9 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `tax_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `rule_code` | `varchar(100)` | NO | Mã nghiệp vụ/danh mục |
| `rule_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `rule_version` | `integer` | NO | Thuộc tính nghiệp vụ |
| `implementation_key` | `varchar(150)` | NO | Thuộc tính nghiệp vụ |
| `legal_basis` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `effective_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(tax_type, rule_code, rule_version) (uq_tax_calculation_rule_version)`; `(tax_type, status, effective_from) (idx_tax_calculation_rule_effective)`

## 11.17. Schema `gl` — Kế toán tổng hợp

**Owner:** `GeneralLedgerModule` · **Use Case:** UC-GL · **Số bảng:** 18

### `gl.account_class` — Loại tài khoản kế toán

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Lưu dữ liệu Loại tài khoản kế toán thuộc phân hệ Kế toán tổng hợp.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 5 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(150)` | NO | Tên/nhãn hiển thị |
| `normal_balance` | `varchar(10)` | NO | Thuộc tính nghiệp vụ |

**Indexes:** `(company_id, code) (uq_account_class)`

### `gl.account` — Tài khoản kế toán

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `AccountsPayableModule`, `AccountsReceivableModule`, `BankingModule`, `CashModule`, `CcdcModule`, `FixedAssetModule`, `GeneralLedgerModule`, `MasterDataModule`, `PurchaseModule`, `ReportingModule`, `SalesModule`
- **Mục đích:** Danh mục tài khoản kế toán thực tế dùng ghi sổ, hỗ trợ cây cha-con, mã theo chế độ, tài khoản chi tiết và yêu cầu đối tượng theo dõi.
- **PK:** `id`
- **FK ra:** `account_class_id` → `gl.account_class.id` (DELETE RESTRICT); `chart_of_accounts_id` → `gl.chart_of_accounts.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `parent_account_id` → `gl.account.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 16 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `chart_of_accounts_id` | `uuid` | NO | FK → `gl.chart_of_accounts.id`; ON DELETE RESTRICT |
| `account_class_id` | `uuid` | NO | FK → `gl.account_class.id`; ON DELETE RESTRICT |
| `parent_account_id` | `uuid` | YES | FK → `gl.account.id`; ON DELETE RESTRICT |
| `code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `account_level` | `smallint` | NO | Thuộc tính nghiệp vụ |
| `account_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `normal_balance` | `varchar(10)` | NO | Thuộc tính nghiệp vụ |
| `statutory_account_code` | `varchar(50)` | YES | Mã nghiệp vụ/danh mục |
| `is_statutory_account` | `boolean` | NO | Cờ cấu hình; default=false |
| `is_postable` | `boolean` | NO | Cờ cấu hình; default=true |
| `requires_party` | `boolean` | NO | Cờ cấu hình; default=false |
| `requires_project` | `boolean` | NO | Cờ cấu hình; default=false |
| `requires_cost_center` | `boolean` | NO | Cờ cấu hình; default=false |
| `requires_warehouse` | `boolean` | NO | Cờ cấu hình; default=false |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_gl_account_company_code)`; `(chart_of_accounts_id, parent_account_id) (idx_gl_account_parent)`; `(company_id, statutory_account_code) (idx_gl_account_statutory_code)`; `account_class_id (idx_account_account_class_id)`; `parent_account_id (idx_account_parent_account_id)`

### `gl.fiscal_year` — Năm tài chính

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Lưu dữ liệu Năm tài chính thuộc phân hệ Kế toán tổng hợp.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, year_no)`
- **Nullability:** 6 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `year_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `start_date` | `date` | NO | Ngày nghiệp vụ |
| `end_date` | `date` | NO | Ngày nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |

**Indexes:** `(company_id, year_no) (uq_fiscal_year)`

**CHECK:** ``end_date >= start_date` [name: 'ck_fiscal_year_dates']`

### `gl.fiscal_period` — Kỳ kế toán

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `CcdcModule`, `FixedAssetModule`, `GeneralLedgerModule`, `InventoryModule`, `ReportingModule`
- **Mục đích:** Lưu dữ liệu Kỳ kế toán thuộc phân hệ Kế toán tổng hợp.
- **PK:** `id`
- **FK ra:** `fiscal_year_id` → `gl.fiscal_year.id` (DELETE RESTRICT)
- **UNIQUE:** `(fiscal_year_id, period_no)`
- **Nullability:** 7 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `fiscal_year_id` | `uuid` | NO | FK → `gl.fiscal_year.id`; ON DELETE RESTRICT |
| `period_no` | `smallint` | NO | Số chứng từ/tham chiếu |
| `name` | `varchar(100)` | NO | Tên/nhãn hiển thị |
| `start_date` | `date` | NO | Ngày nghiệp vụ |
| `end_date` | `date` | NO | Ngày nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |

**Indexes:** `(fiscal_year_id, period_no) (uq_fiscal_period)`

**CHECK:** ``end_date >= start_date` [name: 'ck_fiscal_period_dates']`

### `gl.period_lock` — Khóa kỳ

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Lưu dữ liệu Khóa kỳ thuộc phân hệ Kế toán tổng hợp.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `fiscal_period_id` → `gl.fiscal_period.id` (DELETE RESTRICT); `locked_by` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, fiscal_period_id, module_code)`
- **Nullability:** 5 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `fiscal_period_id` | `uuid` | NO | FK → `gl.fiscal_period.id`; ON DELETE RESTRICT |
| `module_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `lock_status` | `varchar(20)` | NO | Trạng thái; default='OPEN' |
| `locked_by` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `locked_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `reason` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(company_id, fiscal_period_id, module_code) (uq_period_lock)`; `fiscal_period_id (idx_period_lock_fiscal_period_id)`; `locked_by (idx_period_lock_locked_by)`

### `gl.journal_entry` — Bút toán kế toán

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `PostingService / GeneralLedgerService`
- **Read consumers:** `CcdcModule`, `FixedAssetModule`, `GeneralLedgerModule`
- **Mục đích:** Header bút toán ghi sổ. Chỉ PostingService/GLService được tạo khi POST chứng từ; không cho controller nghiệp vụ ghi trực tiếp.
- **PK:** `id`
- **FK ra:** `base_currency_id` → `mdm.currency.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `fiscal_period_id` → `gl.fiscal_period.id` (DELETE RESTRICT); `posted_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `posting_batch_id` → `gl.posting_batch.id` (DELETE RESTRICT); `reversal_of_journal_entry_id` → `gl.journal_entry.id` (DELETE RESTRICT); `source_document_id` → `core.business_document.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, journal_no)`, `(source_document_id, posting_version)`
- **Nullability:** 12 cột bắt buộc / 6 cột nullable
- **Delete policy:** IMMUTABLE_AFTER_POST — không xóa; sai thì reverse/adjust/rebuild theo quy trình.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `source_document_id` | `uuid` | YES | FK → `core.business_document.id`; ON DELETE RESTRICT |
| `posting_batch_id` | `uuid` | YES | FK → `gl.posting_batch.id`; ON DELETE RESTRICT |
| `journal_no` | `varchar(80)` | NO | Số chứng từ/tham chiếu |
| `journal_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `posting_version` | `integer` | NO | Thuộc tính nghiệp vụ; default=1 |
| `posting_date` | `date` | NO | Ngày nghiệp vụ |
| `fiscal_period_id` | `uuid` | NO | FK → `gl.fiscal_period.id`; ON DELETE RESTRICT |
| `base_currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `description` | `varchar(1000)` | YES | Thuộc tính nghiệp vụ |
| `journal_status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `reversal_of_journal_entry_id` | `uuid` | YES | FK → `gl.journal_entry.id`; ON DELETE RESTRICT |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `posted_by_user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `posted_at` | `timestamptz` | YES | Thời điểm hệ thống |

**Indexes:** `(company_id, journal_no) (uq_journal_entry_no)`; `(source_document_id, posting_version) (uq_journal_entry_source_version)`; `(company_id, posting_date, journal_status) (idx_journal_entry_posting_date)`; `source_document_id (idx_journal_entry_source_document)`; `base_currency_id (idx_journal_entry_base_currency_id)`; `branch_id (idx_journal_entry_branch_id)`; `created_by_user_id (idx_journal_entry_created_by_user_id)`; `fiscal_period_id (idx_journal_entry_fiscal_period_id)`; `posted_by_user_id (idx_journal_entry_posted_by_user_id)`; `posting_batch_id (idx_journal_entry_posting_batch_id)`; `reversal_of_journal_entry_id (idx_journal_entry_reversal_of_journal_entry_id)`

**CHECK:** ``journal_status in ('DRAFT','POSTED','REVERSED','CANCELLED')` [name: 'ck_journal_entry_status']`; ``posting_version > 0` [name: 'ck_journal_entry_posting_version']`

### `gl.journal_entry_line` — Dòng bút toán

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `PostingService / GeneralLedgerService`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Các dòng Nợ/Có của bút toán. Là nguồn sự thật cho sổ cái, số dư tài khoản và BCTC; tổng Nợ phải bằng tổng Có ở cấp journal.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `journal_entry_id` → `gl.journal_entry.id` (DELETE RESTRICT); `party_id` → `mdm.party.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT); `tax_rate_id` → `mdm.tax_rate.id` (DELETE RESTRICT); `transaction_currency_id` → `mdm.currency.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(journal_entry_id, line_no)`
- **Nullability:** 10 cột bắt buộc / 6 cột nullable
- **Delete policy:** IMMUTABLE_AFTER_POST — không xóa; sai thì reverse/adjust/rebuild theo quy trình.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `journal_entry_id` | `uuid` | NO | FK → `gl.journal_entry.id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `debit_amount_base` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `credit_amount_base` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `transaction_currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `exchange_rate` | `numeric(20,8)` | NO | Thuộc tính nghiệp vụ; default=1 |
| `debit_amount_foreign` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `credit_amount_foreign` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `tax_rate_id` | `uuid` | YES | FK → `mdm.tax_rate.id`; ON DELETE RESTRICT |
| `description` | `varchar(1000)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(journal_entry_id, line_no) (uq_journal_entry_line)`; `(account_id, journal_entry_id) (idx_journal_entry_line_account)`; `party_id (idx_journal_entry_line_party)`; `project_id (idx_journal_entry_line_project)`; `cost_center_id (idx_journal_entry_line_cost_center_id)`; `tax_rate_id (idx_journal_entry_line_tax_rate_id)`; `transaction_currency_id (idx_journal_entry_line_transaction_currency_id)`; `warehouse_id (idx_journal_entry_line_warehouse_id)`

**CHECK:** ``debit_amount_base >= 0 and credit_amount_base >= 0` [name: 'ck_journal_entry_line_base_nonnegative']`; ``(debit_amount_base > 0 and credit_amount_base = 0) or (credit_amount_base > 0 and debit_amount_base = 0)` [name: 'ck_journal_entry_line_base_one_side']`; ``not (debit_amount_foreign > 0 and credit_amount_foreign > 0)` [name: 'ck_journal_entry_line_foreign_one_side']`

### `gl.posting_rule` — Quy tắc hạch toán tự động

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Cấu hình/danh mục cho Quy tắc hạch toán tự động. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `document_type_id` → `mdm.document_type.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 8 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `document_type_id` | `uuid` | NO | FK → `mdm.document_type.id`; ON DELETE RESTRICT |
| `business_subtype` | `varchar(50)` | YES | Thuộc tính nghiệp vụ |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `priority` | `integer` | NO | Thuộc tính nghiệp vụ; default=100 |
| `condition_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |
| `effective_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_posting_rule_code)`; `(company_id, document_type_id, status, priority) (idx_posting_rule_doc)`; `document_type_id (idx_posting_rule_document_type_id)`

### `gl.posting_rule_line` — Dòng quy tắc hạch toán

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Lưu chi tiết dòng của Dòng quy tắc hạch toán. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `fixed_account_id` → `gl.account.id` (DELETE RESTRICT); `posting_rule_id` → `gl.posting_rule.id` (DELETE CASCADE)
- **UNIQUE:** `(posting_rule_id, line_no)`
- **Nullability:** 6 cột bắt buộc / 3 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `posting_rule_id` | `uuid` | NO | FK → `gl.posting_rule.id`; ON DELETE CASCADE |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `side` | `varchar(10)` | NO | Thuộc tính nghiệp vụ |
| `account_source_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `fixed_account_id` | `uuid` | YES | FK → `gl.account.id`; ON DELETE RESTRICT |
| `amount_source` | `varchar(80)` | NO | Giá trị tiền tệ |
| `dimension_rule_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |
| `description_template` | `varchar(500)` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(posting_rule_id, line_no) (uq_posting_rule_line)`; `fixed_account_id (idx_posting_rule_line_fixed_account_id)`

### `gl.posting_batch` — Lô ghi sổ

- **Loại bảng:** `PROCESS_RUN`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Header của một lần xử lý Lô ghi sổ. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, batch_no)`
- **Nullability:** 8 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `batch_no` | `varchar(80)` | NO | Số chứng từ/tham chiếu |
| `module_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `started_at` | `timestamptz` | NO | Thời điểm hệ thống |
| `completed_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `status` | `varchar(20)` | NO | Trạng thái |
| `processed_count` | `integer` | NO | Thuộc tính nghiệp vụ; default=0 |
| `error_count` | `integer` | NO | Thuộc tính nghiệp vụ; default=0 |

**Indexes:** `(company_id, batch_no) (uq_posting_batch)`

### `gl.closing_run` — Lần kết chuyển/khóa sổ

- **Loại bảng:** `PROCESS_RUN`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Header của một lần xử lý Lần kết chuyển/khóa sổ. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `created_by` → `iam.user_account.id` (DELETE RESTRICT); `fiscal_period_id` → `gl.fiscal_period.id` (DELETE RESTRICT); `journal_entry_id` → `gl.journal_entry.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, fiscal_period_id, run_type)`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `fiscal_period_id` | `uuid` | NO | FK → `gl.fiscal_period.id`; ON DELETE RESTRICT |
| `run_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `journal_entry_id` | `uuid` | YES | FK → `gl.journal_entry.id`; ON DELETE RESTRICT |
| `created_by` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, fiscal_period_id, run_type) (uq_closing_run)`; `created_by (idx_closing_run_created_by)`; `fiscal_period_id (idx_closing_run_fiscal_period_id)`; `journal_entry_id (idx_closing_run_journal_entry_id)`

### `gl.closing_run_line` — Chi tiết kết chuyển

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết kết chuyển. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `closing_run_id` → `gl.closing_run.id` (DELETE RESTRICT)
- **UNIQUE:** `(closing_run_id, account_id)`
- **Nullability:** 5 cột bắt buộc / 0 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `closing_run_id` | `uuid` | NO | FK → `gl.closing_run.id`; ON DELETE RESTRICT |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `debit_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `credit_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |

**Indexes:** `(closing_run_id, account_id) (uq_closing_run_line)`; `account_id (idx_closing_run_line_account_id)`

### `gl.chart_of_accounts` — Hệ thống tài khoản

- **Loại bảng:** `DOMAIN_TRANSACTION`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Phiên bản hệ thống tài khoản theo doanh nghiệp/chế độ kế toán. Dùng làm container cho tài khoản TT99 và tài khoản chi tiết doanh nghiệp mở thêm.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, code)`
- **Nullability:** 8 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `accounting_regime` | `varchar(30)` | NO | Thuộc tính nghiệp vụ; default='TT99' |
| `effective_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | YES | Thuộc tính nghiệp vụ |
| `is_default` | `boolean` | NO | Cờ cấu hình; default=false |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `(company_id, code) (uq_chart_of_accounts_company_code)`; `(company_id, is_default, status) (idx_chart_of_accounts_default)`

**CHECK:** ``effective_to is null or effective_to >= effective_from` [name: 'ck_chart_of_accounts_validity']`

### `gl.account_opening_balance` — Số dư đầu kỳ tài khoản

- **Loại bảng:** `DERIVED_BALANCE`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Bảng số dư dẫn xuất cho Số dư đầu kỳ tài khoản. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `fiscal_year_id` → `gl.fiscal_year.id` (DELETE RESTRICT); `party_id` → `mdm.party.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, branch_id, fiscal_year_id, account_id, currency_id, dimension_key)`
- **Nullability:** 12 cột bắt buộc / 5 cột nullable
- **Delete policy:** REBUILDABLE — không sửa tay; có thể truncate/rebuild bằng service chuyên trách khi kiểm soát.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `fiscal_year_id` | `uuid` | NO | FK → `gl.fiscal_year.id`; ON DELETE RESTRICT |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `opening_debit_amount_base` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `opening_credit_amount_base` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `opening_debit_amount_foreign` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `opening_credit_amount_foreign` | `numeric(20,4)` | NO | Giá trị tiền tệ; default=0 |
| `dimension_key` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `imported_from` | `varchar(100)` | YES | Thuộc tính nghiệp vụ |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, branch_id, fiscal_year_id, account_id, currency_id, dimension_key) (uq_account_opening_balance)`; `(account_id, fiscal_year_id) (idx_account_opening_balance_account)`; `branch_id (idx_account_opening_balance_branch_id)`; `cost_center_id (idx_account_opening_balance_cost_center_id)`; `currency_id (idx_account_opening_balance_currency_id)`; `fiscal_year_id (idx_account_opening_balance_fiscal_year_id)`; `party_id (idx_account_opening_balance_party_id)`; `project_id (idx_account_opening_balance_project_id)`; `warehouse_id (idx_account_opening_balance_warehouse_id)`

### `gl.account_balance` — Số dư tài khoản theo kỳ

- **Loại bảng:** `DERIVED_BALANCE`
- **Write owner:** `LedgerBalanceService`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Bảng số dư dẫn xuất cho Số dư tài khoản theo kỳ. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `fiscal_period_id` → `gl.fiscal_period.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, branch_id, fiscal_period_id, account_id)`
- **Nullability:** 12 cột bắt buộc / 0 cột nullable
- **Delete policy:** REBUILDABLE — không sửa tay; có thể truncate/rebuild bằng service chuyên trách khi kiểm soát.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `fiscal_period_id` | `uuid` | NO | FK → `gl.fiscal_period.id`; ON DELETE RESTRICT |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `opening_debit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `opening_credit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `period_debit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `period_credit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `closing_debit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `closing_credit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, branch_id, fiscal_period_id, account_id) (uq_account_balance)`; `(account_id, fiscal_period_id) (idx_account_balance_account_period)`; `branch_id (idx_account_balance_branch_id)`; `fiscal_period_id (idx_account_balance_fiscal_period_id)`

### `gl.account_dimension_balance` — Số dư tài khoản theo đối tượng

- **Loại bảng:** `DERIVED_BALANCE`
- **Write owner:** `LedgerBalanceService`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Bảng số dư dẫn xuất cho Số dư tài khoản theo đối tượng. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `cost_center_id` → `mdm.cost_center.id` (DELETE RESTRICT); `fiscal_period_id` → `gl.fiscal_period.id` (DELETE RESTRICT); `party_id` → `mdm.party.id` (DELETE RESTRICT); `project_id` → `mdm.project.id` (DELETE RESTRICT); `warehouse_id` → `mdm.warehouse.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, branch_id, fiscal_period_id, account_id, dimension_key)`
- **Nullability:** 13 cột bắt buộc / 4 cột nullable
- **Delete policy:** REBUILDABLE — không sửa tay; có thể truncate/rebuild bằng service chuyên trách khi kiểm soát.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | NO | FK → `org.branch.id`; ON DELETE RESTRICT |
| `fiscal_period_id` | `uuid` | NO | FK → `gl.fiscal_period.id`; ON DELETE RESTRICT |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `dimension_key` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `project_id` | `uuid` | YES | FK → `mdm.project.id`; ON DELETE RESTRICT |
| `cost_center_id` | `uuid` | YES | FK → `mdm.cost_center.id`; ON DELETE RESTRICT |
| `warehouse_id` | `uuid` | YES | FK → `mdm.warehouse.id`; ON DELETE RESTRICT |
| `opening_debit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `opening_credit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `period_debit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `period_credit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `closing_debit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `closing_credit` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ; default=0 |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, branch_id, fiscal_period_id, account_id, dimension_key) (uq_account_dimension_balance)`; `(account_id, fiscal_period_id) (idx_account_dimension_balance_account_period)`; `branch_id (idx_account_dimension_balance_branch_id)`; `cost_center_id (idx_account_dimension_balance_cost_center_id)`; `fiscal_period_id (idx_account_dimension_balance_fiscal_period_id)`; `party_id (idx_account_dimension_balance_party_id)`; `project_id (idx_account_dimension_balance_project_id)`; `warehouse_id (idx_account_dimension_balance_warehouse_id)`

### `gl.foreign_currency_revaluation_run` — Lần đánh giá lại ngoại tệ

- **Loại bảng:** `PROCESS_RUN`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Header của một lần xử lý Lần đánh giá lại ngoại tệ. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `fiscal_period_id` → `gl.fiscal_period.id` (DELETE RESTRICT); `journal_entry_id` → `gl.journal_entry.id` (DELETE RESTRICT); `rate_type_id` → `mdm.exchange_rate_type.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, fiscal_period_id, run_no)`
- **Nullability:** 9 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `fiscal_period_id` | `uuid` | NO | FK → `gl.fiscal_period.id`; ON DELETE RESTRICT |
| `revaluation_date` | `date` | NO | Ngày nghiệp vụ |
| `rate_type_id` | `uuid` | NO | FK → `mdm.exchange_rate_type.id`; ON DELETE RESTRICT |
| `run_no` | `varchar(80)` | NO | Số chứng từ/tham chiếu |
| `run_status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `journal_entry_id` | `uuid` | YES | FK → `gl.journal_entry.id`; ON DELETE RESTRICT |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, fiscal_period_id, run_no) (uq_foreign_currency_revaluation_run)`; `created_by_user_id (idx_foreign_currency_revaluation_run_created_by_user_id)`; `fiscal_period_id (idx_foreign_currency_revaluation_run_fiscal_period_id)`; `journal_entry_id (idx_foreign_currency_revaluation_run_journal_entry_id)`; `rate_type_id (idx_foreign_currency_revaluation_run_rate_type_id)`

### `gl.foreign_currency_revaluation_line` — Chi tiết đánh giá lại ngoại tệ

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `GeneralLedgerModule`
- **Read consumers:** `GeneralLedgerModule`
- **Mục đích:** Lưu chi tiết dòng của Chi tiết đánh giá lại ngoại tệ. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `currency_id` → `mdm.currency.id` (DELETE RESTRICT); `party_id` → `mdm.party.id` (DELETE RESTRICT); `revaluation_run_id` → `gl.foreign_currency_revaluation_run.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 9 cột bắt buộc / 1 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `revaluation_run_id` | `uuid` | NO | FK → `gl.foreign_currency_revaluation_run.id`; ON DELETE RESTRICT |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `party_id` | `uuid` | YES | FK → `mdm.party.id`; ON DELETE RESTRICT |
| `currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `foreign_balance` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `old_base_balance` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `new_exchange_rate` | `numeric(20,8)` | NO | Thuộc tính nghiệp vụ |
| `new_base_balance` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |
| `exchange_difference` | `numeric(20,4)` | NO | Thuộc tính nghiệp vụ |

**Indexes:** `(revaluation_run_id, account_id, party_id, currency_id) (idx_foreign_currency_revaluation_line)`; `account_id (idx_foreign_currency_revaluation_line_account_id)`; `currency_id (idx_foreign_currency_revaluation_line_currency_id)`; `party_id (idx_foreign_currency_revaluation_line_party_id)`

## 11.18. Schema `report` — Sổ kế toán và báo cáo

**Owner:** `ReportingModule` · **Use Case:** UC-RPT · **Số bảng:** 12

### `report.report_definition` — Định nghĩa báo cáo

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `ReportingModule`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Cấu hình/danh mục cho Định nghĩa báo cáo. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `code`
- **Nullability:** 7 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `module_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `report_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `data_source` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `code (uq_report_definition_code)`

### `report.report_parameter` — Tham số báo cáo

- **Loại bảng:** `REPORTING`
- **Write owner:** `ReportingModule`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Phục vụ Tham số báo cáo; ReportingService đọc dữ liệu đã POST/subledger để sinh báo cáo và không ghi ngược vào nghiệp vụ nguồn.
- **PK:** `id`
- **FK ra:** `report_definition_id` → `report.report_definition.id` (DELETE CASCADE)
- **UNIQUE:** `(report_definition_id, parameter_code)`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `report_definition_id` | `uuid` | NO | FK → `report.report_definition.id`; ON DELETE CASCADE |
| `parameter_code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `parameter_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `data_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `required` | `boolean` | NO | Thuộc tính nghiệp vụ; default=false |
| `default_value_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |
| `display_order` | `integer` | NO | Thuộc tính nghiệp vụ; default=0 |

**Indexes:** `(report_definition_id, parameter_code) (uq_report_parameter)`

### `report.saved_report` — Mẫu lọc báo cáo đã lưu

- **Loại bảng:** `REPORTING`
- **Write owner:** `ReportingModule`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Phục vụ Mẫu lọc báo cáo đã lưu; ReportingService đọc dữ liệu đã POST/subledger để sinh báo cáo và không ghi ngược vào nghiệp vụ nguồn.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `report_definition_id` → `report.report_definition.id` (DELETE RESTRICT); `user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** `(user_id, report_definition_id, name)`
- **Nullability:** 7 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `report_definition_id` | `uuid` | NO | FK → `report.report_definition.id`; ON DELETE RESTRICT |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `parameter_values_json` | `jsonb` | NO | Dữ liệu cấu hình/payload có cấu trúc |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(user_id, report_definition_id, name) (uq_saved_report)`; `company_id (idx_saved_report_company_id)`; `report_definition_id (idx_saved_report_report_definition_id)`

### `report.financial_statement_template` — Mẫu báo cáo tài chính

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `ReportingService`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Định nghĩa loại BCTC pháp lý như B01-DN, B02-DN, B03-DN, B09-DN; cấu trúc thực tế nằm ở phiên bản và các chỉ tiêu.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `code`
- **Nullability:** 7 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `statement_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `legal_form_code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `legal_basis` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `code (uq_financial_statement_template_code)`; `(statement_type, status) (idx_financial_statement_template_type)`

### `report.financial_statement_template_version` — Phiên bản mẫu BCTC

- **Loại bảng:** `VERSIONED_CONFIG`
- **Write owner:** `ReportingService`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Phiên bản hóa Phiên bản mẫu BCTC. Khi version đã được publish/được chứng từ tham chiếu thì giữ bất biến và tạo version mới khi thay đổi.
- **PK:** `id`
- **FK ra:** `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `template_id` → `report.financial_statement_template.id` (DELETE CASCADE)
- **UNIQUE:** `(template_id, version_no)`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** VERSIONED — không sửa/xóa version đã publish hoặc đã được tham chiếu.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `template_id` | `uuid` | NO | FK → `report.financial_statement_template.id`; ON DELETE CASCADE |
| `version_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `effective_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | YES | Thuộc tính nghiệp vụ |
| `version_status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(template_id, version_no) (uq_financial_statement_template_version)`; `(template_id, version_status, effective_from) (idx_financial_statement_template_effective)`; `created_by_user_id (idx_financial_statement_template_version_created_by_user_id)`

**CHECK:** ``effective_to is null or effective_to >= effective_from` [name: 'ck_financial_statement_template_version_validity']`

### `report.financial_statement_line` — Chỉ tiêu BCTC

- **Loại bảng:** `TRANSACTION_LINE`
- **Write owner:** `ReportingService`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Lưu chi tiết dòng của Chỉ tiêu BCTC. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.
- **PK:** `id`
- **FK ra:** `parent_line_id` → `report.financial_statement_line.id` (DELETE RESTRICT); `template_version_id` → `report.financial_statement_template_version.id` (DELETE CASCADE)
- **UNIQUE:** `(template_version_id, indicator_code)`
- **Nullability:** 8 cột bắt buộc / 2 cột nullable
- **Delete policy:** DEPENDENT — thay đổi qua aggregate/service cha; tài chính đã POST không xóa vật lý.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `template_version_id` | `uuid` | NO | FK → `report.financial_statement_template_version.id`; ON DELETE CASCADE |
| `parent_line_id` | `uuid` | YES | FK → `report.financial_statement_line.id`; ON DELETE RESTRICT |
| `line_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `indicator_code` | `varchar(50)` | NO | Mã nghiệp vụ/danh mục |
| `indicator_name` | `varchar(500)` | NO | Tên/nhãn hiển thị |
| `line_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `formula_expression` | `text` | YES | Thuộc tính nghiệp vụ |
| `display_order` | `integer` | NO | Thuộc tính nghiệp vụ |
| `is_required` | `boolean` | NO | Cờ cấu hình; default=true |

**Indexes:** `(template_version_id, indicator_code) (uq_financial_statement_line_indicator)`; `(template_version_id, display_order) (idx_financial_statement_line_order)`; `parent_line_id (idx_financial_statement_line_parent_line_id)`

### `report.financial_statement_account_mapping` — Ánh xạ tài khoản vào chỉ tiêu BCTC

- **Loại bảng:** `RELATIONSHIP`
- **Write owner:** `ReportingService`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Bảng quan hệ/ánh xạ cho Ánh xạ tài khoản vào chỉ tiêu BCTC; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.
- **PK:** `id`
- **FK ra:** `account_id` → `gl.account.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `statement_line_id` → `report.financial_statement_line.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, statement_line_id, account_id, mapping_side, effective_from)`
- **Nullability:** 7 cột bắt buộc / 2 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `statement_line_id` | `uuid` | NO | FK → `report.financial_statement_line.id`; ON DELETE RESTRICT |
| `account_id` | `uuid` | NO | FK → `gl.account.id`; ON DELETE RESTRICT |
| `mapping_side` | `varchar(20)` | NO | Thuộc tính nghiệp vụ |
| `sign_multiplier` | `numeric(9,4)` | NO | Thuộc tính nghiệp vụ; default=1 |
| `condition_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |
| `effective_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | YES | Thuộc tính nghiệp vụ |

**Indexes:** `(company_id, statement_line_id, account_id, mapping_side, effective_from) (uq_financial_statement_account_mapping)`; `(company_id, account_id) (idx_financial_statement_mapping_account)`; `account_id (idx_financial_statement_account_mapping_account_id)`; `statement_line_id (idx_financial_statement_account_mapping_statement_line_id)`

### `report.financial_statement_run` — Lần lập BCTC

- **Loại bảng:** `PROCESS_RUN`
- **Write owner:** `ReportingService`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Một lần lập BCTC cho kỳ và phạm vi báo cáo; lưu trạng thái draft/approved và người lập/duyệt, không thay thế sổ cái.
- **PK:** `id`
- **FK ra:** `approved_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT); `fiscal_period_id` → `gl.fiscal_period.id` (DELETE RESTRICT); `generated_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `reporting_currency_id` → `mdm.currency.id` (DELETE RESTRICT); `template_version_id` → `report.financial_statement_template_version.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 10 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | YES | FK → `org.branch.id`; ON DELETE RESTRICT |
| `reporting_scope` | `varchar(20)` | NO | Thuộc tính nghiệp vụ; default='COMPANY' |
| `template_version_id` | `uuid` | NO | FK → `report.financial_statement_template_version.id`; ON DELETE RESTRICT |
| `fiscal_period_id` | `uuid` | NO | FK → `gl.fiscal_period.id`; ON DELETE RESTRICT |
| `reporting_currency_id` | `uuid` | NO | FK → `mdm.currency.id`; ON DELETE RESTRICT |
| `run_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `run_status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `generated_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `generated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `approved_by_user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `approved_at` | `timestamptz` | YES | Thời điểm hệ thống |

**Indexes:** `(company_id, template_version_id, fiscal_period_id, branch_id, run_type) (idx_financial_statement_run_scope)`; `approved_by_user_id (idx_financial_statement_run_approved_by_user_id)`; `branch_id (idx_financial_statement_run_branch_id)`; `fiscal_period_id (idx_financial_statement_run_fiscal_period_id)`; `generated_by_user_id (idx_financial_statement_run_generated_by_user_id)`; `reporting_currency_id (idx_financial_statement_run_reporting_currency_id)`; `template_version_id (idx_financial_statement_run_template_version_id)`

**CHECK:** ``reporting_scope in ('COMPANY','BRANCH')` [name: 'ck_financial_statement_run_scope']`

### `report.financial_statement_value` — Giá trị chỉ tiêu BCTC

- **Loại bảng:** `REPORTING`
- **Write owner:** `ReportingService`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Phục vụ Giá trị chỉ tiêu BCTC; ReportingService đọc dữ liệu đã POST/subledger để sinh báo cáo và không ghi ngược vào nghiệp vụ nguồn.
- **PK:** `id`
- **FK ra:** `statement_line_id` → `report.financial_statement_line.id` (DELETE RESTRICT); `statement_run_id` → `report.financial_statement_run.id` (DELETE RESTRICT)
- **UNIQUE:** `(statement_run_id, statement_line_id)`
- **Nullability:** 3 cột bắt buộc / 4 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `statement_run_id` | `uuid` | NO | FK → `report.financial_statement_run.id`; ON DELETE RESTRICT |
| `statement_line_id` | `uuid` | NO | FK → `report.financial_statement_line.id`; ON DELETE RESTRICT |
| `current_period_amount` | `numeric(20,4)` | YES | Giá trị tiền tệ |
| `comparative_period_amount` | `numeric(20,4)` | YES | Giá trị tiền tệ |
| `text_value` | `text` | YES | Thuộc tính nghiệp vụ |
| `calculation_detail_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |

**Indexes:** `(statement_run_id, statement_line_id) (uq_financial_statement_value)`; `statement_line_id (idx_financial_statement_value_statement_line_id)`

### `report.accounting_book_template` — Mẫu sổ kế toán

- **Loại bảng:** `CONFIG_MASTER`
- **Write owner:** `ReportingModule`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Cấu hình/danh mục cho Mẫu sổ kế toán. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `code`
- **Nullability:** 6 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `book_type` | `varchar(50)` | NO | Thuộc tính nghiệp vụ |
| `legal_form_code` | `varchar(50)` | YES | Mã nghiệp vụ/danh mục |
| `legal_basis` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |

**Indexes:** `code (uq_accounting_book_template_code)`; `(book_type, status) (idx_accounting_book_template_type)`

### `report.accounting_book_template_version` — Phiên bản mẫu sổ kế toán

- **Loại bảng:** `VERSIONED_CONFIG`
- **Write owner:** `ReportingModule`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Phiên bản hóa Phiên bản mẫu sổ kế toán. Khi version đã được publish/được chứng từ tham chiếu thì giữ bất biến và tạo version mới khi thay đổi.
- **PK:** `id`
- **FK ra:** `accounting_book_template_id` → `report.accounting_book_template.id` (DELETE CASCADE); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** `(accounting_book_template_id, version_no)`
- **Nullability:** 8 cột bắt buộc / 1 cột nullable
- **Delete policy:** VERSIONED — không sửa/xóa version đã publish hoặc đã được tham chiếu.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `accounting_book_template_id` | `uuid` | NO | FK → `report.accounting_book_template.id`; ON DELETE CASCADE |
| `version_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `effective_from` | `date` | NO | Thuộc tính nghiệp vụ |
| `effective_to` | `date` | YES | Thuộc tính nghiệp vụ |
| `layout_definition_json` | `jsonb` | NO | Dữ liệu cấu hình/payload có cấu trúc |
| `version_status` | `varchar(20)` | NO | Trạng thái; default='DRAFT' |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(accounting_book_template_id, version_no) (uq_accounting_book_template_version)`; `created_by_user_id (idx_accounting_book_template_version_created_by_user_id)`

**CHECK:** ``effective_to is null or effective_to >= effective_from` [name: 'ck_accounting_book_template_version_validity']`

### `report.financial_statement_adjustment` — Điều chỉnh/loại trừ khi lập BCTC

- **Loại bảng:** `REPORTING`
- **Write owner:** `ReportingService`
- **Read consumers:** `ReportingModule`
- **Mục đích:** Phục vụ Điều chỉnh/loại trừ khi lập BCTC; ReportingService đọc dữ liệu đã POST/subledger để sinh báo cáo và không ghi ngược vào nghiệp vụ nguồn.
- **PK:** `id`
- **FK ra:** `approved_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `branch_id` → `org.branch.id` (DELETE RESTRICT); `created_by_user_id` → `iam.user_account.id` (DELETE RESTRICT); `statement_line_id` → `report.financial_statement_line.id` (DELETE RESTRICT); `statement_run_id` → `report.financial_statement_run.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 8 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `statement_run_id` | `uuid` | NO | FK → `report.financial_statement_run.id`; ON DELETE RESTRICT |
| `statement_line_id` | `uuid` | NO | FK → `report.financial_statement_line.id`; ON DELETE RESTRICT |
| `branch_id` | `uuid` | YES | FK → `org.branch.id`; ON DELETE RESTRICT |
| `adjustment_type` | `varchar(30)` | NO | Thuộc tính nghiệp vụ |
| `adjustment_amount` | `numeric(20,4)` | NO | Giá trị tiền tệ |
| `reason` | `varchar(1000)` | NO | Thuộc tính nghiệp vụ |
| `created_by_user_id` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `approved_by_user_id` | `uuid` | YES | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `approved_at` | `timestamptz` | YES | Thời điểm hệ thống |

**Indexes:** `(statement_run_id, statement_line_id) (idx_financial_statement_adjustment_line)`; `approved_by_user_id (idx_financial_statement_adjustment_approved_by_user_id)`; `branch_id (idx_financial_statement_adjustment_branch_id)`; `created_by_user_id (idx_financial_statement_adjustment_created_by_user_id)`; `statement_line_id (idx_financial_statement_adjustment_statement_line_id)`

## 11.19. Schema `integration` — Tích hợp hệ thống

**Owner:** `IntegrationModule` · **Use Case:** Cross-cutting · **Số bảng:** 10

### `integration.outbox_event` — Sự kiện Outbox

- **Loại bảng:** `INTEGRATION_EVENT`
- **Write owner:** `IntegrationService`
- **Read consumers:** `IntegrationModule`
- **Mục đích:** Hạ tầng tích hợp cho Sự kiện Outbox. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 6 cột bắt buộc / 3 cột nullable
- **Delete policy:** RETAIN_FOR_TRACE — retention theo chính sách tích hợp; không dùng làm nguồn kế toán.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | YES | FK → `org.company.id`; ON DELETE RESTRICT |
| `aggregate_type` | `varchar(100)` | NO | Thuộc tính nghiệp vụ |
| `aggregate_id` | `uuid` | YES | Thuộc tính nghiệp vụ |
| `event_type` | `varchar(150)` | NO | Thuộc tính nghiệp vụ |
| `payload_json` | `jsonb` | NO | Dữ liệu cấu hình/payload có cấu trúc |
| `occurred_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `published_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `retry_count` | `integer` | NO | Thuộc tính nghiệp vụ; default=0 |

**Indexes:** `(published_at, occurred_at) (idx_outbox_publish)`; `(aggregate_type, aggregate_id) (idx_outbox_aggregate)`; `company_id (idx_outbox_event_company_id)`

### `integration.inbox_message` — Thông điệp Inbox

- **Loại bảng:** `INTEGRATION_EVENT`
- **Write owner:** `IntegrationService`
- **Read consumers:** `IntegrationModule`
- **Mục đích:** Hạ tầng tích hợp cho Thông điệp Inbox. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.
- **PK:** `id`
- **FK ra:** Không có FK ra
- **UNIQUE:** `(source_system, message_id)`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** RETAIN_FOR_TRACE — retention theo chính sách tích hợp; không dùng làm nguồn kế toán.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `source_system` | `varchar(100)` | NO | Thuộc tính nghiệp vụ |
| `message_id` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `message_type` | `varchar(150)` | NO | Thuộc tính nghiệp vụ |
| `payload_json` | `jsonb` | NO | Dữ liệu cấu hình/payload có cấu trúc |
| `received_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `processed_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `status` | `varchar(20)` | NO | Trạng thái; default='RECEIVED' |

**Indexes:** `(source_system, message_id) (uq_inbox_message)`

### `integration.api_client` — Ứng dụng/API client

- **Loại bảng:** `OTHER`
- **Write owner:** `IntegrationService`
- **Read consumers:** `IntegrationModule`
- **Mục đích:** Lưu dữ liệu Ứng dụng/API client thuộc phân hệ Tích hợp hệ thống.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `client_code`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | YES | FK → `org.company.id`; ON DELETE RESTRICT |
| `client_code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `client_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `client_secret_hash` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `allowed_scopes_json` | `jsonb` | NO | Dữ liệu cấu hình/payload có cấu trúc |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `client_code (uq_api_client_code)`; `company_id (idx_api_client_company_id)`

### `integration.webhook_delivery` — Lần gửi webhook

- **Loại bảng:** `INTEGRATION_EVENT`
- **Write owner:** `IntegrationService`
- **Read consumers:** `IntegrationModule`
- **Mục đích:** Hạ tầng tích hợp cho Lần gửi webhook. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `event_id` → `integration.outbox_event.id` (DELETE RESTRICT); `webhook_subscription_id` → `integration.webhook_subscription.id` (DELETE RESTRICT)
- **UNIQUE:** `(event_id, webhook_subscription_id, attempt_no)`
- **Nullability:** 6 cột bắt buộc / 5 cột nullable
- **Delete policy:** RETAIN_FOR_TRACE — retention theo chính sách tích hợp; không dùng làm nguồn kế toán.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | YES | FK → `org.company.id`; ON DELETE RESTRICT |
| `webhook_subscription_id` | `uuid` | NO | FK → `integration.webhook_subscription.id`; ON DELETE RESTRICT |
| `event_id` | `uuid` | NO | FK → `integration.outbox_event.id`; ON DELETE RESTRICT |
| `target_url` | `varchar(1000)` | NO | Thuộc tính nghiệp vụ |
| `attempt_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `request_body` | `jsonb` | NO | Thuộc tính nghiệp vụ |
| `response_status` | `integer` | YES | Trạng thái |
| `response_body` | `text` | YES | Thuộc tính nghiệp vụ |
| `delivered_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `next_retry_at` | `timestamptz` | YES | Thời điểm hệ thống |

**Indexes:** `(event_id, webhook_subscription_id, attempt_no) (uq_webhook_delivery_attempt)`; `(webhook_subscription_id, next_retry_at) (idx_webhook_delivery_retry)`; `company_id (idx_webhook_delivery_company_id)`

### `integration.idempotency_key` — Khóa chống xử lý lặp

- **Loại bảng:** `OTHER`
- **Write owner:** `IntegrationService`
- **Read consumers:** `IntegrationModule`
- **Mục đích:** Lưu dữ liệu Khóa chống xử lý lặp thuộc phân hệ Tích hợp hệ thống.
- **PK:** `id`
- **FK ra:** `client_id` → `integration.api_client.id` (DELETE RESTRICT); `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(client_id, idempotency_key)`
- **Nullability:** 6 cột bắt buộc / 3 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | YES | FK → `org.company.id`; ON DELETE RESTRICT |
| `client_id` | `uuid` | NO | FK → `integration.api_client.id`; ON DELETE RESTRICT |
| `idempotency_key` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `request_hash` | `varchar(64)` | NO | Thuộc tính nghiệp vụ |
| `response_status` | `integer` | YES | Trạng thái |
| `response_body` | `jsonb` | YES | Thuộc tính nghiệp vụ |
| `expires_at` | `timestamptz` | NO | Thời điểm hệ thống |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(client_id, idempotency_key) (uq_idempotency_key)`; `company_id (idx_idempotency_key_company_id)`

### `integration.external_mapping` — Ánh xạ ID hệ thống ngoài

- **Loại bảng:** `RELATIONSHIP`
- **Write owner:** `IntegrationService`
- **Read consumers:** `IntegrationModule`
- **Mục đích:** Bảng quan hệ/ánh xạ cho Ánh xạ ID hệ thống ngoài; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, external_system, entity_type, external_id)`, `(company_id, external_system, entity_type, internal_id)`
- **Nullability:** 7 cột bắt buộc / 0 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `external_system` | `varchar(100)` | NO | Thuộc tính nghiệp vụ |
| `entity_type` | `varchar(100)` | NO | Thuộc tính nghiệp vụ |
| `internal_id` | `uuid` | NO | Thuộc tính nghiệp vụ |
| `external_id` | `varchar(255)` | NO | Thuộc tính nghiệp vụ |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, external_system, entity_type, external_id) (uq_external_mapping_external)`; `(company_id, external_system, entity_type, internal_id) (uq_external_mapping_internal)`

### `integration.import_job` — Lần nhập dữ liệu

- **Loại bảng:** `INTEGRATION_EVENT`
- **Write owner:** `IntegrationService`
- **Read consumers:** `IntegrationModule`
- **Mục đích:** Hạ tầng tích hợp cho Lần nhập dữ liệu. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT); `created_by` → `iam.user_account.id` (DELETE RESTRICT)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 12 cột bắt buộc / 1 cột nullable
- **Delete policy:** RETAIN_FOR_TRACE — retention theo chính sách tích hợp; không dùng làm nguồn kế toán.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `module_code` | `varchar(30)` | NO | Mã nghiệp vụ/danh mục |
| `import_type` | `varchar(80)` | NO | Thuộc tính nghiệp vụ |
| `file_name` | `varchar(255)` | NO | Tên/nhãn hiển thị |
| `storage_key` | `varchar(500)` | NO | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='PENDING' |
| `total_rows` | `integer` | NO | Thuộc tính nghiệp vụ; default=0 |
| `success_rows` | `integer` | NO | Thuộc tính nghiệp vụ; default=0 |
| `error_rows` | `integer` | NO | Thuộc tính nghiệp vụ; default=0 |
| `created_by` | `uuid` | NO | FK → `iam.user_account.id`; ON DELETE RESTRICT |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `completed_at` | `timestamptz` | YES | Thời điểm hệ thống |

**Indexes:** `(company_id, created_at) (idx_import_job_company_time)`; `created_by (idx_import_job_created_by)`

### `integration.import_row_error` — Lỗi từng dòng import

- **Loại bảng:** `INTEGRATION_EVENT`
- **Write owner:** `IntegrationService`
- **Read consumers:** `IntegrationModule`
- **Mục đích:** Hạ tầng tích hợp cho Lỗi từng dòng import. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.
- **PK:** `id`
- **FK ra:** `import_job_id` → `integration.import_job.id` (DELETE CASCADE)
- **UNIQUE:** Không có UNIQUE riêng ngoài PK
- **Nullability:** 5 cột bắt buộc / 2 cột nullable
- **Delete policy:** RETAIN_FOR_TRACE — retention theo chính sách tích hợp; không dùng làm nguồn kế toán.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `import_job_id` | `uuid` | NO | FK → `integration.import_job.id`; ON DELETE CASCADE |
| `row_no` | `integer` | NO | Số chứng từ/tham chiếu |
| `field_name` | `varchar(150)` | YES | Tên/nhãn hiển thị |
| `error_code` | `varchar(80)` | NO | Mã nghiệp vụ/danh mục |
| `error_message` | `varchar(1000)` | NO | Thuộc tính nghiệp vụ |
| `raw_row_json` | `jsonb` | YES | Dữ liệu cấu hình/payload có cấu trúc |

**Indexes:** `(import_job_id, row_no) (idx_import_row_error)`

### `integration.webhook_subscription` — Cấu hình webhook nhận sự kiện

- **Loại bảng:** `OTHER`
- **Write owner:** `IntegrationService`
- **Read consumers:** `IntegrationModule`
- **Mục đích:** Lưu dữ liệu Cấu hình webhook nhận sự kiện thuộc phân hệ Tích hợp hệ thống.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, event_type, target_url)`
- **Nullability:** 7 cột bắt buộc / 1 cột nullable
- **Delete policy:** RESTRICT_BY_DEFAULT — xóa vật lý chỉ cho dữ liệu chưa sử dụng; ưu tiên trạng thái/phiên bản.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `event_type` | `varchar(150)` | NO | Thuộc tính nghiệp vụ |
| `target_url` | `varchar(1000)` | NO | Thuộc tính nghiệp vụ |
| `secret_reference` | `varchar(255)` | YES | Thuộc tính nghiệp vụ |
| `status` | `varchar(20)` | NO | Trạng thái; default='ACTIVE' |
| `created_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, event_type, target_url) (uq_webhook_subscription)`; `(company_id, status) (idx_webhook_subscription_status)`

### `integration.sync_checkpoint` — Mốc đồng bộ hệ thống ngoài

- **Loại bảng:** `INTEGRATION_EVENT`
- **Write owner:** `IntegrationService`
- **Read consumers:** `IntegrationModule`
- **Mục đích:** Hạ tầng tích hợp cho Mốc đồng bộ hệ thống ngoài. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.
- **PK:** `id`
- **FK ra:** `company_id` → `org.company.id` (DELETE RESTRICT)
- **UNIQUE:** `(company_id, external_system, sync_scope)`
- **Nullability:** 6 cột bắt buộc / 3 cột nullable
- **Delete policy:** RETAIN_FOR_TRACE — retention theo chính sách tích hợp; không dùng làm nguồn kế toán.

| Column | Datatype | Null | Vai trò / Constraint |
|---|---|---|---|
| `id` | `uuid` | NO | Khóa chính; PK, default=`gen_random_uuid()` |
| `company_id` | `uuid` | NO | FK → `org.company.id`; ON DELETE RESTRICT |
| `external_system` | `varchar(100)` | NO | Thuộc tính nghiệp vụ |
| `sync_scope` | `varchar(100)` | NO | Thuộc tính nghiệp vụ |
| `checkpoint_value` | `varchar(1000)` | YES | Thuộc tính nghiệp vụ |
| `last_successful_sync_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `last_attempt_at` | `timestamptz` | YES | Thời điểm hệ thống |
| `status` | `varchar(20)` | NO | Trạng thái; default='READY' |
| `updated_at` | `timestamptz` | NO | Thời điểm hệ thống; default=`now()` |

**Indexes:** `(company_id, external_system, sync_scope) (uq_sync_checkpoint)`

## 12. Quy tắc thao tác dữ liệu cho Dev

### Master data

Không hard-delete master đã phát sinh giao dịch. Chuyển `status = INACTIVE`; lịch sử chứng từ vẫn giữ FK tới record cũ.

### Draft document

Cho phép EDIT theo permission + scope + workflow state. Nếu cần xóa khỏi UI thì ưu tiên soft delete (`deleted_at`) thay vì xóa chuỗi bảng.

### Submitted/Approved document

Không cho sửa các trường ảnh hưởng kế toán nếu chưa Return/Reject về trạng thái cho phép. Mọi chuyển trạng thái ghi status history + audit.

### Posted document

Không UPDATE/DELETE trực tiếp. Sửa sai bằng CANCEL/REVERSE/ADJUSTMENT theo loại nghiệp vụ và kỳ kế toán.

### Derived table

`*_balance`, financial statement values và cache có thể rebuild từ source-of-truth; tuyệt đối không dùng chúng làm nguồn tạo journal mới.

### Audit

Audit write cùng transaction hoặc cơ chế đảm bảo không mất log; người dùng thường không có quyền UPDATE/DELETE.

## 13. Source of truth

| Dữ liệu | Source of truth | Không được dùng thay thế |
|---|---|---|
| Chứng từ nghiệp vụ | `core.business_document` + extension | report/cache |
| Kế toán Nợ/Có | `gl.journal_entry*` | balance/report snapshot |
| Công nợ | AP/AR open item + settlement/application/adjustment | chỉ tổng hợp report |
| Kho | `inv.stock_movement` + costing allocations | inventory balance cache |
| Tiền mặt/ngân hàng | cash/bank document + book entry | report |
| Hóa đơn thuế | raw payload + normalized `tax.tax_invoice` | purchase/sales invoice một-một |
| VAT | `tax.vat_ledger` | tờ khai đã render |
| BCTC | GL + mapping + approved adjustment | giá trị nhập tay không có nguồn |

## 14. Điều kiện để chuyển sang PostgreSQL DDL / Prisma

Chỉ chốt schema production sau khi:

- BA/Kế toán xác nhận từng flow và mapping chứng từ.
- Chốt chart of accounts TT99 seed.
- Chốt posting rules từng nghiệp vụ.
- Chốt chính sách UNPOST vs REVERSE, khóa kỳ và quyền kế toán trưởng.
- Chốt quy tắc thuế/hóa đơn điện tử hiện hành cần tích hợp.
- Viết migration SQL bổ sung các kiểm soát PostgreSQL-only ở Mục 3.
- Có test: balanced journal, period lock, permission+scope, idempotency, document numbering concurrency, audit immutability, cross-company isolation.

---

**Trạng thái:** Database V2 đã qua audit cấu trúc DBML. Đây là bản target để review nghiệp vụ/kỹ thuật; bước tiếp theo là PostgreSQL DDL + seed + Prisma sau khi chốt các rule còn phụ thuộc quy định thuế và policy vận hành của doanh nghiệp.