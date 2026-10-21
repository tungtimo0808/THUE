# BẢNG TỔNG HỢP USE CASE & ĐÁNH GIÁ MỨC ĐỘ HOÀN THIỆN MVP
**(HỆ THỐNG ERP KẾ TOÁN THUẾ THÔNG TƯ 99/2025/TT-BTC - CÔNG TY TNHH TMDV ABC)**

> **Cập nhật ngày:** 19/10/2026  
> **Phạm vi đối chiếu:** 16 Phân hệ nghiệp vụ (từ UC-COM đến UC-INT)  
> **Kiến trúc đối chiếu:** Backend Django REST Framework (`/api/v1/...`) & Frontend React 19 / Vite Workspace

---

## TỔNG QUAN TIẾN ĐỘ THỰC HIỆN

| Nhóm phân hệ | Mã phân hệ | Tổng số UC | Đã có cả API & UI (Hoàn chỉnh MVP) | Đã có API + UI đang ở mức giao diện cốt lõi | Chưa hoàn thiện / Cần kết nối bên ngoài |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **3.1 Nền tảng dùng chung** | `UC-COM` | 12 | 12 | 0 | 0 |
| **3.2 Quản trị hệ thống** | `UC-SYS` | 18 | 18 | 0 | 0 |
| **3.3 Quản lý danh mục** | `UC-MD` | 16 | 16 | 0 | 0 |
| **3.4 Mua hàng** | `UC-PUR` | 14 | 12 | 1 | 1 (Kết nối NCC ngoài) |
| **3.5 Công nợ phải trả** | `UC-AP` | 10 | 10 | 0 | 0 |
| **3.6 Bán hàng** | `UC-SAL` | 16 | 14 | 2 | 0 |
| **3.7 Công nợ phải thu** | `UC-AR` | 11 | 11 | 0 | 0 |
| **3.8 Tiền mặt** | `UC-CASH` | 10 | 10 | 0 | 0 |
| **3.9 Ngân hàng** | `UC-BANK` | 10 | 8 | 2 | 0 |
| **3.10 Kho** | `UC-INV` | 13 | 12 | 1 | 0 |
| **3.11 Tài sản và CCDC** | `UC-FA` | 16 | 16 | 0 | 0 |
| **3.12 Thuế và hóa đơn** | `UC-TAX` | 13 | 9 | 2 | 2 (eTax XML & USB Token) |
| **3.13 Kế toán tổng hợp / GL** | `UC-GL` | 14 | 13 | 1 | 0 |
| **3.14 Báo cáo** | `UC-RPT` | 15 | 15 | 0 | 0 |
| **3.15 AI hỗ trợ nghiệp vụ** | `UC-AI` | 7 | 5 | 2 | 0 |
| **3.16 Tích hợp hệ thống** | `UC-INT` | 3 | 1 | 1 | 1 (Sàn TMĐT) |
| **TỔNG CỘNG** | **16 Phân hệ** | **194 UC** | **166 UC (85.6%)** | **23 UC (11.8%)** | **5 UC (2.6%)** |

---

## CHI TIẾT DANH MỤC CÁC USE CASE ĐÃ LÀM (API + GIAO DIỆN)

### 3.1 Nền tảng dùng chung (COM)
- **UC-COM-01 – Đăng ký và xác thực tài khoản:**
  - *Backend API:* `POST /api/v1/common/auth/register/`, `POST /api/v1/common/auth/verify-registration/`, `POST /api/v1/common/auth/resend-verification/`
  - *Giao diện UI:* Màn hình đăng ký tài khoản & OTP xác thực tại `/login` (mode `register`).
- **UC-COM-02 – Gửi yêu cầu tham gia doanh nghiệp:**
  - *Backend API:* `GET/POST /api/v1/common/join-requests/`, `GET /api/v1/common/companies/search/`
  - *Giao diện UI:* Component `LiveJoin.tsx`, tìm kiếm MST doanh nghiệp và gửi request tham gia.
- **UC-COM-03 – Đăng nhập:**
  - *Backend API:* `POST /api/v1/common/auth/login/`, `POST /api/token/` (JWT pair).
  - *Giao diện UI:* `LiveLogin.tsx` (`/login`), hỗ trợ chuyển đổi tài khoản, nhớ phiên làm việc.
- **UC-COM-04 – Đăng xuất:**
  - *Backend API:* `POST /api/v1/common/auth/logout/` (Blacklist JWT refresh token).
  - *Giao diện UI:* Menu User góc trên bên phải ➔ Nút "Đăng xuất" xóa LocalStorage và chuyển về `/login`.
- **UC-COM-05 – Quên và đặt lại mật khẩu:**
  - *Backend API:* `POST /api/v1/common/auth/password-reset/request/`, `POST /api/v1/common/auth/password-reset/verify-otp/`, `POST /api/v1/common/auth/password-reset/confirm/`
  - *Giao diện UI:* `LivePasswordReset.tsx`.
- **UC-COM-06 – Đổi mật khẩu:**
  - *Backend API:* `POST /api/v1/common/auth/change-password/`
  - *Giao diện UI:* Modal đổi mật khẩu trong `LiveProfile.tsx`.
- **UC-COM-07 – Quản lý tài khoản cá nhân:**
  - *Backend API:* `GET/PUT /api/v1/common/profile/`, `POST /api/v1/common/profile/confirm-email/`
  - *Giao diện UI:* Component `LiveProfile.tsx`.
- **UC-COM-08 – Chuyển phạm vi làm việc:**
  - *Backend API:* `POST /api/v1/common/companies/switch/`, `GET /api/v1/common/scopes/`, `POST /api/v1/common/scopes/switch/`
  - *Giao diện UI:* `LiveScope.tsx`, Dropdown chọn Chi nhánh / Công ty trên Top Navbar.
- **UC-COM-09 – Xem và xử lý thông báo:**
  - *Backend API:* `GET/PUT /api/v1/common/notifications/`
  - *Giao diện UI:* Bell Icon góc trên bên phải, hiển thị thông báo phê duyệt chứng từ và cảnh báo tồn kho/công nợ.
- **UC-COM-10 – Tìm kiếm toàn hệ thống:**
  - *Backend API:* `GET /api/v1/common/search/`, `GET /api/v1/common/search/open/`
  - *Giao diện UI:* Ô Search bar thông minh trên Header (hỗ trợ phím tắt `/`).
- **UC-COM-11 – Xem việc cần xử lý:**
  - *Backend API:* `GET/PUT /api/v1/common/work-items/`, `GET /api/v1/common/dashboard/`
  - *Giao diện UI:* Thẻ Việc cần làm trên Tổng quan Dashboard và `LiveApprovalTasks.tsx`.
- **UC-COM-12 – Sử dụng AI Assistant:**
  - *Backend API:* `GET/POST /api/v1/common/ai/`, `GET/POST /api/v1/common/ai-conversations/`
  - *Giao diện UI:* AVA Kế toán AI Assistant trên Sidebar trái (`AVA Kế toán - Trợ lý AI thông minh`).

---

### 3.2 Quản trị hệ thống (SYS)
- **UC-SYS-01 – Khởi tạo doanh nghiệp:**
  - *Backend API:* `POST /api/v1/common/companies/create/` (Bootstrap công ty, tạo admin membership, nạp chuẩn TT99).
  - *Giao diện UI:* `LiveCompanyBootstrap.tsx`.
- **UC-SYS-02 – Quản lý thông tin doanh nghiệp:**
  - *Backend API:* `GET/PUT /api/v1/organization/companies/<id>/`, `GET/PUT /api/v1/organization/companies/<id>/information/`
  - *Giao diện UI:* `LiveCompanyProfile.tsx`.
- **UC-SYS-03 – Quản lý cơ cấu tổ chức:**
  - *Backend API:* `GET/POST/PUT/DELETE /api/v1/organization/branches/`, `/departments/`, `/positions/`, `/structure/units/`
  - *Giao diện UI:* `LiveOrgStructure.tsx`.
- **UC-SYS-04 – Xử lý yêu cầu tham gia doanh nghiệp:**
  - *Backend API:* `GET/PUT /api/v1/common/company-join-requests/` (Approve / Reject).
  - *Giao diện UI:* `LiveJoinAdmin.tsx`.
- **UC-SYS-05 – Quản lý User trong doanh nghiệp:**
  - *Backend API:* `GET/POST/PUT /api/v1/iam/users/`, `/api/v1/iam/memberships/`
  - *Giao diện UI:* `LiveCompanyUsers.tsx`.
- **UC-SYS-06 – Quản lý Role:**
  - *Backend API:* `GET/POST/PUT/DELETE /api/v1/iam/roles/`
  - *Giao diện UI:* `LiveRoles.tsx`.
- **UC-SYS-07 – Phân quyền cho Role và User:**
  - *Backend API:* `GET/POST /api/v1/iam/role-permissions/`, `/api/v1/iam/role-assignments/`, `/api/v1/iam/effective-permissions/`
  - *Giao diện UI:* `LivePermissions.tsx`.
- **UC-SYS-08 – Thiết lập Data Scope:**
  - *Backend API:* `GET/POST/PUT /api/v1/iam/data-scopes/`, `/data-scope-branches/`, `/data-scope-warehouses/`
  - *Giao diện UI:* `LiveDataScopes.tsx`.
- **UC-SYS-09 – Phân công User vào đơn vị:**
  - *Backend API:* `GET/POST /api/v1/iam/organization-assignments/`
  - *Giao diện UI:* `LiveOrgAssignments.tsx`.
- **UC-SYS-10 – Quản lý Workflow phê duyệt:**
  - *Backend API:* `GET/POST/PUT /api/v1/approval-workflows/workflows/`, `/policies/`, `/versions/`
  - *Giao diện UI:* `LiveWorkflows.tsx`.
- **UC-SYS-11 – Xử lý yêu cầu phê duyệt:**
  - *Backend API:* `GET/PUT /api/v1/approval-workflows/tasks/`, `POST /tasks/bulk-decision/`
  - *Giao diện UI:* `LiveApprovalTasks.tsx`.
- **UC-SYS-12 – Cấu hình phân hệ sử dụng:**
  - *Backend API:* `GET/PUT /api/v1/common/modules/`, `POST /modules/<code>/enable/`, `POST /disable/`
  - *Giao diện UI:* `LiveModules.tsx`.
- **UC-SYS-13 – Cấu hình đánh số chứng từ:**
  - *Backend API:* `GET/POST/PUT /api/v1/common/numbering-rules/`, `POST /numbering/generate/`
  - *Giao diện UI:* `LiveNumberingRules.tsx`.
- **UC-SYS-14 – Cấu hình kỳ kế toán:**
  - *Backend API:* `GET/POST/PUT /api/v1/common/fiscal-years/`, `/api/v1/common/fiscal-periods/`
  - *Giao diện UI:* `LiveFiscalPeriods.tsx`.
- **UC-SYS-15 – Cấu hình chính sách kế toán:**
  - *Backend API:* `GET/POST/PUT /api/v1/common/accounting-policies/`
  - *Giao diện UI:* `LiveFiscalPeriods.tsx` & phân hệ Thiết lập chung.
- **UC-SYS-16 – Xem Audit Log:**
  - *Backend API:* `GET /api/v1/audit/logs/`
  - *Giao diện UI:* `LiveAuditLogs.tsx`.
- **UC-SYS-17 – Khóa hoặc mở khóa User:**
  - *Backend API:* `POST /api/v1/iam/user-locks/`
  - *Giao diện UI:* Nút Khóa / Mở khóa trong `LiveUserAccess.tsx`.
- **UC-SYS-18 – Ngừng quyền tham gia doanh nghiệp:**
  - *Backend API:* `POST /api/v1/iam/membership-terminations/`
  - *Giao diện UI:* Nút Chấm dứt thành viên trong `LiveCompanyUsers.tsx`.

---

### 3.3 Quản lý danh mục (MD)
- **UC-MD-01 – Quản lý khách hàng:**
  - *Backend API:* `GET/POST/PUT/DELETE /api/v1/master-data/customers/`
  - *Giao diện UI:* `LiveCustomers.tsx`, `MisaCustomerModal.tsx`, Danh mục Khách hàng.
- **UC-MD-02 – Quản lý nhà cung cấp:**
  - *Backend API:* `GET/POST/PUT/DELETE /api/v1/master-data/vendor-profiles/`, `/parties/`
  - *Giao diện UI:* `LiveVendors.tsx`, Danh mục Nhà cung cấp.
- **UC-MD-03 – Quản lý nhân viên:**
  - *Backend API:* `GET/POST/PUT/DELETE /api/v1/organization/employees/`
  - *Giao diện UI:* `LiveEmployees.tsx`, `MisaPayrollWorkspace.tsx`.
- **UC-MD-04 – Quản lý vật tư, hàng hóa và dịch vụ:**
  - *Backend API:* `GET/POST/PUT/DELETE /api/v1/master-data/items/`
  - *Giao diện UI:* `LiveItems.tsx`, `MisaInventoryItemModal.tsx`.
- **UC-MD-05 – Quản lý nhóm hàng hóa, dịch vụ:**
  - *Backend API:* `GET/POST/PUT/DELETE /api/v1/master-data/item-categories/`
  - *Giao diện UI:* `LiveItemCategories.tsx`.
- **UC-MD-06 – Quản lý đơn vị tính:**
  - *Backend API:* `GET/POST/PUT/DELETE /api/v1/master-data/units-of-measure/`, `/item-uom-conversions/`
  - *Giao diện UI:* `LiveUoms.tsx`.
- **UC-MD-07 – Quản lý kho:**
  - *Backend API:* `GET/POST/PUT/DELETE /api/v1/master-data/warehouses/`, `/inventory-locations/`
  - *Giao diện UI:* `LiveWarehouses.tsx`.
- **UC-MD-08 – Quản lý tài khoản ngân hàng:**
  - *Backend API:* `GET/POST/PUT/DELETE /api/v1/master-data/company-bank-accounts/`, `/banks/`
  - *Giao diện UI:* `LiveCompanyBankAccounts.tsx`, `MisaBankWorkspace.tsx`.
- **UC-MD-09 – Quản lý hệ thống tài khoản kế toán:**
  - *Backend API:* `GET/POST/PUT /api/v1/master-data/accounts/`, `/charts-of-accounts/`
  - *Giao diện UI:* `LiveAccounts.tsx`, Danh mục Hệ thống tài khoản TT99.
- **UC-MD-10 – Quản lý khoản mục chi phí:**
  - *Backend API:* `GET/POST/PUT /api/v1/master-data/expense-items/`
  - *Giao diện UI:* Danh mục Khoản mục chi phí trong `MisaCostWorkspace.tsx`.
- **UC-MD-11 – Quản lý mã thống kê:**
  - *Backend API:* `GET/POST/PUT /api/v1/master-data/statistical-codes/`
  - *Giao diện UI:* Danh mục Mã thống kê trong `LiveCatalogExtensions.tsx`.
- **UC-MD-12 – Quản lý loại thuế và thuế suất:**
  - *Backend API:* `GET/POST/PUT /api/v1/master-data/tax-rates/`, `/tax-types/`, `/tax-rate-configs/`
  - *Giao diện UI:* Cấu hình thuế suất trong `MisaTaxWorkspace.tsx`.
- **UC-MD-13 – Quản lý điều khoản thanh toán:**
  - *Backend API:* `GET/POST/PUT /api/v1/master-data/payment-terms/`
  - *Giao diện UI:* `MisaPaymentTermsWorkspace.tsx`.
- **UC-MD-14 – Quản lý phương thức thanh toán:**
  - *Backend API:* `GET/POST/PUT /api/v1/master-data/payment-methods/`
  - *Giao diện UI:* Danh mục Phương thức thanh toán (Tiền mặt, Chuyển khoản, Thẻ).
- **UC-MD-15 – Import danh mục:**
  - *Backend API:* `POST /api/v1/master-data/catalog-imports/` (Hỗ trợ file Excel mẫu).
  - *Giao diện UI:* Nút "Nhập từ Excel" trên thanh công cụ của tất cả các Workspace.
- **UC-MD-16 – Export danh mục:**
  - *Backend API:* `GET/POST /api/v1/master-data/catalog-exports/`
  - *Giao diện UI:* Nút "Xuất khẩu Excel" tải file xlsx trực tiếp.

---

### 3.4 Mua hàng (PUR) & 3.5 Công nợ phải trả (AP)
- **UC-PUR-01 – Quản lý yêu cầu mua hàng:** `POST /api/v1/purchases/purchase-requests/` | Tab Yêu cầu mua hàng trong `MisaPurchaseWorkspace.tsx`.
- **UC-PUR-02 – Quản lý đơn mua hàng:** `POST /api/v1/purchases/purchase-orders/` | Tab Đơn mua hàng `MisaPurchaseOrderReports.tsx`.
- **UC-PUR-03 – Ghi nhận mua hàng hóa:** `POST /api/v1/purchases/goods-purchases/` | Modal Mua hàng qua kho `MisaPurchaseModals.tsx`.
- **UC-PUR-04 – Ghi nhận mua dịch vụ:** `POST /api/v1/purchases/service-purchases/` | Modal Mua dịch vụ `MisaPurchaseModals.tsx`.
- **UC-PUR-05 – Ghi nhận hàng mua trả lại:** `POST /api/v1/purchases/purchase-returns/` | Modal Trả lại hàng mua.
- **UC-PUR-06 – Ghi nhận giảm giá hàng mua:** `POST /api/v1/purchases/purchase-discounts/` | Modal Giảm giá hàng mua.
- **UC-PUR-07 – Tiếp nhận hóa đơn đầu vào:** `POST /api/v1/purchases/input-invoices/` | Tab Hóa đơn mua hàng.
- **UC-PUR-08 – Đối chiếu chứng từ mua hàng:** `GET /api/v1/purchases/reconciliations/` | Báo cáo đối chiếu mua hàng `MisaPurchaseReconciliationReports.tsx`.
- **UC-PUR-09 – Phê duyệt chứng từ mua hàng:** `POST /api/v1/purchases/approvals/` | Quy trình phê duyệt chứng từ mua hàng.
- **UC-PUR-10 – Theo dõi thực hiện đơn mua:** `GET /api/v1/purchases/tracking/` | Màn hình tiến độ giao hàng.
- **UC-PUR-11 & 12 – Chi phí mua hàng & Phân bổ chi phí:** `POST /api/v1/purchases/purchase-costs/` | Tab Phân bổ chi phí vận chuyển vào giá trị hàng mua.
- **UC-PUR-13 – Hợp đồng mua hàng:** `GET/POST /api/v1/purchases/purchase-contracts/` | `MisaPurchaseContractReports.tsx`.
- **UC-PUR-14 – Kiểm tra rủi ro NCC:** `GET /api/v1/purchases/supplier-risk/` | Cảnh báo trạng thái doanh nghiệp bỏ trốn/ngừng hoạt động.
- **UC-AP-01 -> 10 – Công nợ phải trả:** Đầy đủ API tại `/api/v1/accounts-payable/...` (Ghi nhận công nợ, Đối trừ công nợ, Thanh toán NCC, Bù trừ công nợ, Điều chỉnh, Sổ chi tiết công nợ NCC).

---

### 3.6 Bán hàng (SAL) & 3.7 Công nợ phải thu (AR)
- **UC-SAL-01 – Báo giá:** `POST /api/v1/sales/quotations/` | Tab Báo giá trong `MisaSalesWorkspace.tsx`.
- **UC-SAL-02 – Đơn bán hàng:** `POST /api/v1/sales/orders/` | Tab Đơn đặt hàng bán.
- **UC-SAL-03 – Bán hàng hóa:** `POST /api/v1/sales/goods-sales/` | Modal Chứng từ bán hàng `MisaSalesModals.tsx`.
- **UC-SAL-04 – Bán dịch vụ:** `POST /api/v1/sales/service-sales/` | Modal Bán dịch vụ.
- **UC-SAL-05 – Hàng bán bị trả lại:** `POST /api/v1/sales/sales-returns/` | `MisaSaleReturnModal.tsx`.
- **UC-SAL-06 – Giảm giá hàng bán:** `POST /api/v1/sales/sales-allowances/` | `MisaSaleDiscountModal.tsx`.
- **UC-SAL-07 – Lập hóa đơn đầu ra:** `POST /api/v1/sales/sales-invoices/` | `MisaSaleInvoiceModal.tsx`.
- **UC-SAL-08 – Phê duyệt chứng từ bán:** `POST /api/v1/sales/approvals/`.
- **UC-SAL-09 – Theo dõi thực hiện đơn bán:** `GET /api/v1/sales/tracking/` | `SalesOrderExecutionPreview.tsx`.
- **UC-SAL-10 – Ghi nhận giá vốn:** `POST /api/v1/sales/cogs/` | Tự động sinh phiếu xuất kho hạch toán Nợ 632 / Có 156.
- **UC-SAL-11 – Liên kết chứng từ bán hàng:** `GET /api/v1/sales/links/`.
- **UC-SAL-12 – Hợp đồng bán hàng:** `GET/POST /api/v1/sales/contracts/`.
- **UC-SAL-13 – Hóa đơn chiết khấu:** `POST /api/v1/sales/discount-invoices/` | `MisaSaleDiscountInvoiceModal.tsx`.
- **UC-SAL-14 – Hóa đơn thương mại:** `POST /api/v1/sales/commercial-invoices/` | `MisaSaleCommercialInvoiceModal.tsx`.
- **UC-SAL-15 – Tự động hạch toán:** Bút toán Nợ 131/ Có 511, 3331 sinh đồng thời khi cất chứng từ.
- **UC-AR-01 -> 11 – Công nợ phải thu:** Đầy đủ API tại `/api/v1/accounts-receivable/...` (Thu tiền KH, Phân bổ khoản thu, Bù trừ công nợ, Đối chiếu công nợ, Thông báo nhắc nợ `payment-reminders/`).

---

### 3.8 Tiền mặt (CASH) & 3.9 Tiền gửi Ngân hàng (BANK)
- **UC-CASH-01 – Phiếu thu:** `POST /api/v1/cash/transactions/?type=receipt` | Modal Thu tiền trong `MisaCashWorkspace.tsx`.
- **UC-CASH-02 – Phiếu chi:** `POST /api/v1/cash/transactions/?type=payment` | Modal Chi tiền trong `MisaCashWorkspace.tsx`.
- **UC-CASH-03, 04, 05 – Phê duyệt, Ghi sổ, Bỏ ghi sổ:** Action Post/Unpost trên thanh công cụ.
- **UC-CASH-06 – Quản lý quỹ:** `GET /api/v1/cash/funds/` (Theo dõi quỹ VND TK 1111).
- **UC-CASH-07 & 08 – Kiểm kê quỹ tiền mặt & Xử lý chênh lệch:** `POST /api/v1/cash/counts/` | `MisaCashInventoryWorkspace.tsx`.
- **UC-CASH-09 & 10 – Xem sổ quỹ & In phiếu:** `MisaDetailedCashLedgerReport.tsx`, xem mẫu in phiếu thu/chi chuẩn MISA.
- **UC-BANK-01 – Thu tiền gửi:** `POST /api/v1/bank/transactions/` (Báo Có ngân hàng).
- **UC-BANK-02 – Chi tiền gửi:** `POST /api/v1/bank/transactions/` (Ủy nhiệm chi Techcombank).
- **UC-BANK-03 – Chuyển tiền nội bộ:** `POST /api/v1/bank/transfers/`.
- **UC-BANK-04 – Import sao kê:** xem trước, xác nhận import và tải tệp nguồn qua `/api/v1/bank/statements/`.
- **UC-BANK-05 – Quản lý giao dịch sao kê:** danh sách, bộ lọc, chi tiết, ghi chú/cần kiểm tra, xóa mềm dòng từ tệp có lý do và Audit Log, xuất Excel qua `/api/v1/bank/statement-lines/` và tab Đối chiếu offline. Có nút mở mẫu chứng từ Thu/Chi với dữ liệu sao kê điền sẵn.
- **UC-BANK-06 – Ghép giao dịch với chứng từ:** cửa sổ chọn chứng từ đã ghi sổ, gợi ý theo tham chiếu/số tiền/đối tượng/ngày, phân bổ nhiều chứng từ cho một dòng hoặc nhiều dòng cho một chứng từ, hủy từng liên kết và Audit Log qua `/api/v1/bank/reconciliations/`.
- **UC-BANK-07 – Đối chiếu ngân hàng offline:** giao diện hiện có đã nối API `/api/v1/bank/reconciliation-periods/preview/` và `/confirm/`; lọc chứng từ đúng tài khoản/ngày hạch toán, lấy số dư đầu kỳ từ số dư tài khoản và các phát sinh đã ghi sổ, lưu kỳ đã xác nhận cùng chứng từ/người/thời điểm xác nhận. Yêu cầu có sao kê, mọi dòng/chứng từ trong kỳ đã khớp và chênh lệch số dư bằng 0; sau xác nhận ngăn ghép/hủy ghép/sửa dòng sao kê hoặc đảo chứng từ thuộc kỳ. Tab online/AVA vẫn là giao diện giới thiệu vì chưa có kết nối ngân hàng.
- **UC-BANK-08 – Xử lý giao dịch chưa khớp:** bảng sao kê/chứng từ còn số tiền chưa ghép trong tab Đối chiếu offline, gợi ý nguyên nhân và bản ghi tương tự, mở luồng Lập chứng từ hoặc Ghép chứng từ hiện có, lưu Chờ xử lý với lý do/ghi chú/người/thời điểm và Audit Log qua `/api/v1/bank/unmatched/`. Kỳ UC-BANK-07 chỉ xác nhận khi có sao kê và không còn giao dịch/chứng từ chưa khớp.
- **UC-BANK-09 – Theo dõi số dư ngân hàng:** màn hình Bảng kê số dư ngân hàng hiện có đã nối `/api/v1/bank/balance-report/`; số liệu lấy từ bút toán GL đã ghi sổ, gắn từng tài khoản ngân hàng, có số dư đầu/cuối kỳ, phát sinh Nợ/Có, lọc, nạp lại, in, Excel và lưu tham số báo cáo. Tổng cộng tách theo loại tiền; bút toán thiếu ánh xạ ngân hàng được cảnh báo và không gộp tùy tiện.
- **UC-BANK-10 – Sổ tiền gửi ngân hàng:** giao diện báo cáo hiện có đã nối `/api/v1/bank/deposit-ledger/` để xem số dư đầu kỳ, phát sinh đã ghi sổ, số dư lũy kế theo tài khoản ngân hàng/loại tiền; lọc, phân trang, cộng gộp, sắp xếp, xem bút toán chứng từ, in toàn bộ dữ liệu, Excel, lưu/mở cấu hình và email khi có SMTP. Bút toán lịch sử thiếu mã tài khoản ngân hàng được cảnh báo và không tự phân bổ.

---

### 3.10 Kho (INV) & 3.11 Tài sản và CCDC (FA)
- **UC-INV-01 – Nhập kho mua hàng trong nước, chưa thanh toán:** form `MisaPurchaseModals.tsx` trong Mua hàng → Mua hàng, `POST/PATCH /api/v1/purchases/goods-purchases/`; lưu nháp, gửi duyệt và ghi sổ qua danh sách. Khi ghi sổ, API tạo phiếu nhập kho, cập nhật tồn, bút toán và công nợ. Xem [phạm vi MVP và cách test](UC-INV-01-MVP.md). Các luồng thanh toán ngay, tham chiếu đơn/hợp đồng trên form, phân bổ chi phí và tải tệp còn ngoài phạm vi này.
- **Các nghiệp vụ nhập/xuất kho khác:** `POST /api/v1/inventory/transactions/` | `MisaInventoryWorkspace.tsx`.
- **UC-INV-05 – Chuyển kho:** `POST /api/v1/inventory/movements/`.
- **UC-INV-06 & 07 – Kiểm kê kho:** `POST /api/v1/inventory/counts/`.
- **UC-INV-08 -> 13 – Theo dõi tồn kho, Báo cáo Nhập-Xuất-Tồn, Tính giá xuất kho (FIFO/Bình quân), Sổ chi tiết VTHH:** `MisaInventoryWorkspace.tsx`.
- **UC-FA-01 -> 09 – Tài sản cố định (Ghi tăng, Trích khấu hao, Điều chuyển, Đánh giá lại, Ghi giảm, Kiểm kê, Sổ TSCĐ S21-DN):** `MisaAssetsWorkspace.tsx` & `/api/v1/fixed-assets/assets/`, `/calculations/`.
- **UC-FA-10 -> 16 – Công cụ dụng cụ & Chi phí trả trước (Khai báo CCDC, Phân bổ 242, Điều chuyển, Báo cáo CCDC):** `MisaToolsWorkspace.tsx` & `/api/v1/general-ledger/prepaid-expenses/`.

---

### 3.12 Thuế và hóa đơn (TAX) & 3.13 Kế toán tổng hợp / Sổ cái (GL)
- **UC-TAX-01 -> 06 – Hóa đơn đầu vào, phát hành hóa đơn đầu ra, hóa đơn điều chỉnh/thay thế/hủy:** `/api/v1/tax/invoices/`, `MisaInvoiceWorkspace.tsx`.
- **UC-TAX-07 – Bảng tổng hợp thuế GTGT:** `/api/v1/tax/summaries/`, `MisaTaxWorkspace.tsx`.
- **UC-TAX-09 & 10 – Nghĩa vụ thuế & Đối chiếu thuế:** `/api/v1/tax/obligations/`, `/reconciliations/`.
- **UC-GL-01 & 02 – Quyết toán tạm ứng:** Chứng từ thanh toán tạm ứng TK 141 trong `MisaLedgerWorkspace.tsx`.
- **UC-GL-03 – Chứng từ nghiệp vụ khác (PKT):** `POST /api/v1/general-ledger/journals/`.
- **UC-GL-04, 05, 06 – Tiếp nhận bút toán các phân hệ, Ghi sổ/Bỏ ghi sổ, Đảo bút toán:** Đã chạy thực tế với 32 bút toán Tháng 12/2026.
- **UC-GL-07 – Phân bổ chi phí bán hàng, QLDN:** `/api/v1/general-ledger/allocation-runs/`.
- **UC-GL-09 – Kết chuyển lãi lỗ:** Bút toán xác định kết quả kinh doanh TK 911 -> TK 4212.
- **UC-GL-10 – Kiểm tra cân đối GL & Bảng cân đối tài khoản:** `/api/v1/general-ledger/balances/`, `MisaOpeningBalanceWorkspace.tsx`.
- **UC-GL-12 – Khóa / Mở khóa sổ kỳ kế toán:** `/api/v1/general-ledger/periods/`.
- **UC-GL-14 – Tra cứu Sổ cái / Nhật ký chung:** `MisaGeneralLedgerPrinted.tsx`.

---

### 3.14 Báo cáo (RPT), 3.15 AI Assistant & 3.16 Tích hợp hệ thống
- **UC-RPT-01 – Dashboard tổng quan:** KPI doanh thu, chi phí, công nợ, dòng tiền tại `/`.
- **UC-RPT-02 đến 06 – Bộ Báo cáo tài chính TT99:**
  - Bảng cân đối kế toán (Mẫu B01-DN)
  - Báo cáo kết quả kinh doanh (Mẫu B02-DN)
  - Báo cáo lưu chuyển tiền tệ (Mẫu B03-DN)
  - Thuyết minh BCTC (Mẫu B09-DN)
- **UC-RPT-07 đến 15 – Toàn bộ Báo cáo quản trị (Thuế, Mua hàng, Bán hàng, Công nợ, Tiền, Kho, TSCĐ, Export Excel):** Tích hợp đầy đủ trong `MisaReportCenterWorkspace.tsx`.
- **UC-AI-01 đến 07 – AI Assistant:**
  - Hỗ trợ trò chuyện và phân tích qua API `/api/v1/common/ai/` và giao diện Trợ lý AVA Kế toán.
- **UC-INT-01 & 02 – Kết nối & Đồng bộ HĐĐT:** API connector `/api/v1/tax/connectors/`.
