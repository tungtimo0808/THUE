# 🎨 TÀI LIỆU ĐẶC TẢ THIẾT KẾ FIGMA (FIGMA UI/UX DESIGN SPECIFICATION)
## HỆ THỐNG QUẢN LÝ THUẾ – KẾ TOÁN THÔNG MINH TÍCH HỢP AI
### (AI-Powered Enterprise Tax & Accounting Platform)

---

* **Dự án:** Hệ thống Quản lý Thuế – Kế toán Doanh nghiệp (Enterprise Tax & Accounting Platform)
* **Phiên bản tài liệu:** v1.0 (Official UI/UX Design Spec for Figma)
* **Căn cứ nghiệp vụ:** SRS v1.0 (Thông tư 200/2014/TT-BTC, Thông tư 133/2016/TT-BTC, Nghị định 123/2020/NĐ-CP, Thông tư 78/2021/TT-BTC)
* **Định vị giao diện (Design Archetype):** Tối giản (Minimalist), Linh hoạt (Flexibility), Hiện đại (Fintech / Modern B2B SaaS), Tối ưu trải nghiệm cho Doanh nghiệp 1 người (Solopreneur / Micro-business) & mở rộng đa doanh nghiệp (Multi-tenant).
* **Đối tượng sử dụng tài liệu:** UI/UX Designer, Design System Lead, Frontend Developer, Product Owner.

---

## MỤC LỤC

1. [Triết lý Thiết kế & Nguyên tắc Trải nghiệm Người dùng (Design Philosophy)](#1-triết-lý-thiết-kế--nguyên-tắc-trải-nghiệm-người-dùng)
2. [Hệ thống Design System & Foundations (Design Tokens)](#2-hệ-thống-design-system--foundations-design-tokens)
   - 2.1. Color Palette (Bảng màu ngữ nghĩa)
   - 2.2. Typography & Định dạng Kế toán
   - 2.3. Spacing, Grid & Breakpoints
   - 2.4. Elevation, Border Radius & Stroke
3. [Cấu trúc Khung sườn Giao diện Toàn cục (Global App Shell)](#3-cấu-trúc-khung-sườn-giao-diện-toàn-cục-global-app-shell)
   - 3.1. Sidebar Navigation (Menu 11 phân hệ)
   - 3.2. Topbar Navigation (Header toàn cục)
   - 3.3. Content Canvas & Breadcrumb
   - 3.4. AI Assistant Panel / Split-View Drawer
4. [Thư viện Linh kiện Master (Master Components Library)](#4-thư-viện-linh-kiện-master-master-components-library)
   - 4.1. Data Table / List View Component
   - 4.2. Form / Voucher View (Master-Detail Form)
   - 4.3. Dynamic Balance Bar (Thanh kiểm soát cân đối Nợ = Có)
   - 4.4. AI Chatbot & Insights Cards
   - 4.5. Status Badge & Tax Risk Indicators
   - 4.6. Confirmation & Danger Modals
5. [Đặc tả Chi tiết 8 Màn hình Cốt lõi (Core Screens Specification)](#5-đặc-tả-chi-tiết-8-màn-hình-cốt-lõi-core-screens-specification)
   - Screen 01: Executive & Solopreneur Dashboard
   - Screen 02: AI Financial Copilot (Trò chuyện & Phân tích tài chính)
   - Screen 03: Mua hàng & OCR Hóa đơn điện tử đầu vào
   - Screen 04: Form Chứng từ Chi tiết Đa năng (Voucher View)
   - Screen 05: Bán hàng & Phân tích Tuổi nợ (Sales & AR Aging)
   - Screen 06: Tiền gửi & Đối chiếu Tự động Sổ phụ Ngân hàng
   - Screen 07: Kê khai Thuế & Trung tâm Kiểm soát Rủi ro Thuế
   - Screen 08: Kế toán Tổng hợp, Khóa sổ & Báo cáo Tài chính Drill-down
6. [Quy chuẩn Phím tắt & Micro-interactions Kế toán](#6-quy-chuẩn-phím-tắt--micro-interactions-kế-toán)
7. [Checklist Bàn giao & Cấu trúc Trang trong File Figma](#7-checklist-bàn-giao--cấu-trúc-trang-trong-file-figma)

---

## 1. TRIẾT LÝ THIẾT KẾ & NGUYÊN TẮC TRẢI NGHIỆM NGƯỜI DÙNG

### 1.1. Tối giản nhưng Kỷ luật (Minimalism with Rigor)
* **Loại bỏ sự rườm rà truyền thống:** Khắc phục nhược điểm của các phần mềm kế toán cũ (quá nhiều bảng biểu xám xịt, hàng trăm nút bấm nhỏ xíu gây ngộp thở).
* **Thị giác rõ ràng (Visual Hierarchy):** Phân định rành mạch giữa **thông tin bao quát** (Tổng quan doanh thu, số dư tiền, hạn nộp thuế) và **dữ liệu nghiệp vụ sâu** (sổ cái, định khoản hạch toán).
* **Dành riêng cho Doanh nghiệp 1 người & Kế toán hiện đại:** Giao diện trực quan để người làm chủ không chuyên kế toán vẫn nắm trọn sức khỏe tài chính trong 5 giây, nhưng khi cần hạch toán chi tiết vẫn tuân thủ 100% Thông tư 200 / Thông tư 133.

### 1.2. AI-Centric & Human-in-the-Loop (AI làm trợ lý thông minh)
* **AI đề xuất - Con người quyết định:** AI đọc hóa đơn (OCR), gợi ý định khoản, cảnh báo sai lệch sổ sách và rủi ro thuế. Giao diện luôn thể hiện trạng thái: **Gợi ý của AI (AI Suggestion)** $\rightarrow$ **Nút Duyệt 1-click** $\rightarrow$ **Ghi sổ chính thức**.
* **Độ tin cậy minh bạch (Confidence Score):** Mọi trích xuất AI đều hiển thị mức độ tự tin (%) và highlight vùng dữ liệu đối chiếu trên hóa đơn gốc.

### 1.3. Tính bất biến & An toàn dữ liệu (Immutability & Safety)
* **Cân đối Nợ = Có trực quan:** Không bao giờ để người dùng bối rối vì sao không ghi sổ được. Thanh **Live Balance Bar** liên tục cập nhật theo thời gian thực (Xanh = Cân đối; Đỏ = Lệch kèm số tiền chênh).
* **Phòng chống thao tác nhầm (CR-UI-08):** Các hành động nguy hiểm (Xóa, Hủy, Bỏ ghi sổ, Lập bút toán đảo, Khóa/Mở kỳ) bắt buộc hiển thị **Confirmation Modal màu đỏ** yêu cầu xác nhận rõ ràng.

---

## 2. HỆ THỐNG DESIGN SYSTEM & FOUNDATIONS (DESIGN TOKENS)

### 2.1. Color Palette (Bảng màu ngữ nghĩa)

Thiết kế hỗ trợ 2 chế độ: **Light Mode (Mặc định)** và **Dark Mode (Hiện đại, giảm mỏi mắt cho kế toán viên làm việc ban đêm)**.

| Tên Token | Light Mode Hex | Dark Mode Hex | Ý nghĩa sử dụng |
| :--- | :--- | :--- | :--- |
| `primary-50` | `#EFF6FF` | `#172554` | Nền hover, highlight dòng được chọn |
| `primary-500` | `#2563EB` | `#3B82F6` | **Màu thương hiệu chính (Tech Blue)**, nút bấm chính (Primary CTA) |
| `primary-700` | `#1D4ED8` | `#1D4ED8` | Trạng thái Hover / Active của nút chính |
| `ai-shimmer-from` | `#6366F1` | `#818CF8` | **AI Accent Gradient (Indigo)** |
| `ai-shimmer-to` | `#06B6D4` | `#22D3EE` | **AI Accent Gradient (Cyan)** - Hiệu ứng tính năng AI |
| `success-500` | `#10B981` | `#34D399` | **Cân đối Nợ = Có**, Đã ghi sổ, Hóa đơn hợp lệ CQT |
| `success-50` | `#ECFDF5` | `#064E3B` | Nền badge trạng thái thành công |
| `warning-500` | `#F59E0B` | `#FBBF24` | **Cảnh báo thuế**, Hóa đơn nghi ngờ, Chưa đối soát, Sắp hết hạn |
| `warning-50` | `#FFFBEB` | `#78350F` | Nền badge cảnh báo |
| `danger-500` | `#EF4444` | `#F87171` | **Mất cân đối Nợ/Có**, Hóa đơn rủi ro/bỏ trốn, Quá hạn nợ, Nút xóa/hủy |
| `danger-50` | `#FEF2F2` | `#7F1D1D` | Nền cảnh báo lỗi, thanh lệch số cái |
| `neutral-surface` | `#FFFFFF` | `#111827` | Nền Card, Modal, Input, Bảng dữ liệu |
| `neutral-canvas` | `#F8FAFC` | `#0B0F17` | Nền tổng thể toàn bộ trang (Canvas background) |
| `neutral-border` | `#E2E8F0` | `#1E293B` | Viền Card, kẻ bảng, phân cách |
| `text-primary` | `#0F172A` | `#F8FAFC` | Chữ tiêu đề, số liệu chính, văn bản quan trọng |
| `text-secondary` | `#475569` | `#94A3B8` | Nhãn form, văn bản phụ trợ, ngày tháng |
| `text-muted` | `#94A3B8` | `#64748B` | Placeholder, icon thứ cấp, chú thích mờ |

---

### 2.2. Typography & Định dạng Số Kế toán

* **Font Family:** `Inter` (hoặc `Plus Jakarta Sans`) – Tối ưu khả năng hiển thị UI và chữ số.
* **Quy tắc Vàng cho Kế toán:** Toàn bộ bảng biểu, số tiền, tài khoản, ngày tháng **BẮT BUỘC bật tính năng OpenType: `tabular-nums` (Monospaced Numbers)** trong Figma để các con số thẳng hàng hoàn hảo khi căn phải.

| Style Name | Size / Line-height | Weight | Ứng dụng |
| :--- | :--- | :--- | :--- |
| `Display-1` | 32px / 40px | Bold (700) | Số dư tổng tài sản, KPI nổi bật trên Dashboard |
| `Heading-1` | 24px / 32px | SemiBold (600) | Tiêu đề màn hình (Page Title) |
| `Heading-2` | 18px / 26px | SemiBold (600) | Tiêu đề khối Card, Tên nhóm chứng từ |
| `Heading-3` | 15px / 22px | Medium (500) | Tiêu đề cột bảng, Tab navigation |
| `Body-Regular` | 14px / 20px | Regular (400) | Nội dung bảng, diễn giải chứng từ, đoạn văn |
| `Body-Medium` | 14px / 20px | Medium (500) | Giá trị ô input, Tên đối tượng, Tài khoản |
| `Table-Number` | 13px / 18px | SemiBold (600) + Tabular | **Số tiền ghi sổ, Số lượng, Đơn giá (Căn phải)** |
| `Caption` | 12px / 16px | Regular (400) | Gợi ý dưới ô nhập liệu, Timestamp, Metadata |
| `Badge-Text` | 11px / 14px | SemiBold (600) | Nhãn trạng thái (Status Tag) |

---

### 2.3. Spacing, Grid & Layout Breakpoints

* **Base Grid Unit:** Hệ thống 8-point Grid (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`).
* **Kích thước Frame chuẩn trong Figma:**
  * **Desktop 1440:** `1440px x 900px` (Frame thiết kế chính - chuẩn Laptop 13"-15").
  * **Desktop 1920:** `1920px x 1080px` (Frame màn hình rộng cho Kế toán viên văn phòng).
* **Bố cục Cột (Grid Columns):** 12 Cột, Gutter `16px` hoặc `24px`, Margin `24px`.

---

### 2.4. Elevation, Border Radius & Stroke

* **Border Radius:**
  * `radius-sm`: `6px` (Badge, Tag, Checkbox, Icon container).
  * `radius-md`: `8px` (Button, Input field, Dropdown item).
  * `radius-lg`: `12px` (Card container, Table container, Floating Toolbar).
  * `radius-xl`: `16px` (Modal Dialog, Drawer Panel).
  * `radius-full`: `9999px` (Avatar, Pill Status).
* **Elevation / Drop Shadow:**
  * `shadow-sm`: `0 1px 2px rgba(0, 0, 0, 0.05)` (Input focus, Card phẳng).
  * `shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)` (Card nổi, Dropdown).
  * `shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05)` (Drawer, Popover).
  * `shadow-modal`: `0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)` (Modal trung tâm).
  * `shadow-ai`: `0 0 15px rgba(99, 102, 241, 0.25)` (Hiệu ứng phát sáng tím nhẹ xung quanh ô Chat AI).

---

## 3. CẤU TRÚC KHUNG SƯỜN GIAO DIỆN TOÀN CỤC (GLOBAL APP SHELL)

Giao diện ứng dụng gồm 4 vùng cố định:

```text
+-----------------------------------------------------------------------------------------------+
| TOPBAR (Cao 64px)                                                                             |
| [Logo + Tenant Switcher]  [Search Ctrl+K]  [Kỳ Kế Toán 🟢]  [AI Quick Sparkle] [Bell] [Avatar]|
+-------------------+----------------------------------------------------+----------------------+
| SIDEBAR (240px)   | MAIN CONTENT CANVAS                                | AI COPILOT DRAWER    |
|                   |                                                    | (380px - có thể ẩn)  |
| 📊 Tổng quan      | Breadcrumbs: Bán hàng / Hóa đơn / Lập chứng từ     | 💬 Trò chuyện AI     |
| 💬 Trợ lý AI      | -------------------------------------------------- |                      |
| 🛍️ Bán hàng (AR)  | Tiêu đề trang + Action Bar                         | "Hóa đơn này có hợp  |
| 📦 Mua hàng (AP)  |                                                    | lệ với CQT không?"   |
| 💰 Tiền & Bank    | [ Bảng dữ liệu / Form chứng từ / Dashboard ]       |                      |
| 🏬 Kho & Giá thành|                                                    | Gợi ý hạch toán:     |
| 🏢 TSCĐ & CCDC    |                                                    | Nợ 1561 / Có 331     |
| 📑 Thuế & HĐĐT    |                                                    |                      |
| 📚 Sổ cái (GL)    |                                                    | [Áp dụng hạch toán]  |
| 📈 Báo cáo        |                                                    |                      |
| ⚙️ Cài đặt         |                                                    |                      |
+-------------------+----------------------------------------------------+----------------------+
```

### 3.1. Sidebar Navigation (Thanh điều hướng bên trái)
* **Chiều rộng:** `240px` (trạng thái mở rộng) hoặc `68px` (trạng thái thu gọn icon-only).
* **Khối Header:** Logo hệ thống + Doanh nghiệp đang làm việc (`Công ty TNHH Giải Pháp Alpha` + dropdown chuyển công ty cho mô hình Multi-tenant).
* **Danh sách 11 Nhóm Menu:**
  1. 📊 **Tổng quan (Dashboard):** Sức khỏe tài chính, dòng tiền tức thời.
  2. 💬 **Trợ lý AI (AI Copilot):** Trung tâm phân tích, trò chuyện tài chính.
  3. 🛍️ **Bán hàng & Phải thu (Sales & AR):** Đơn bán hàng, Hóa đơn bán ra, Công nợ khách hàng.
  4. 📦 **Mua hàng & Phải trả (Purchase & AP):** Đơn mua hàng, Hóa đơn mua vào, OCR hóa đơn, Công nợ nhà cung cấp.
  5. 💰 **Tiền mặt & Ngân hàng (Cash & Bank):** Thu/Chi quỹ, Báo Có/Báo Nợ, Sổ phụ e-Banking.
  6. 🏬 **Kho & Giá thành (Inventory & Costing):** Nhập/Xuất kho, Kiểm kê, Tính giá vốn.
  7. 🏢 **Tài sản & CCDC (Fixed Assets):** Khấu hao tự động, Phân bổ CCDC.
  8. 📑 **Thuế & Hóa đơn (Tax Compliance):** Tờ khai GTGT, TNDN, TNCN, Đối soát rủi ro HĐĐT với Tổng cục Thuế.
  9. 📚 **Kế toán Tổng hợp (General Ledger):** Bút toán tổng hợp, Kết chuyển cuối kỳ, Khóa sổ kỳ kế toán.
  10. 📈 **Báo cáo (Financial Reports):** Bảng CĐKT, KQKD, LCTT, Sổ cái, Thuyết minh BCTC.
  11. ⚙️ **Thiết lập (Settings & Master Data):** Cây tài khoản COA, Danh mục Đối tác, Phân quyền Role/Data Scope.
* **Khối Footer Sidebar:** Trạng thái kết nối dữ liệu (🟢 TCT Connected | 🟢 Bank API Online), Chuyển chế độ Dark/Light.

### 3.2. Topbar Navigation (Thanh tiêu đề trên)
* **Chiều cao:** `64px`, viền dưới `neutral-border`, cố định khi cuộn trang.
* **Các thành phần từ trái qua phải:**
  1. **Nút gập/mở Sidebar:** Icon Hamburger.
  2. **Bộ chọn Kỳ Kế toán Làm việc (Fiscal Period Picker):** Dropdown hiển thị `Tháng 09/2026` kèm Badge trạng thái:
     * 🟢 `Kỳ đang mở` (Cho phép hạch toán).
     * 🔒 `Kỳ đã khóa sổ` (Chỉ xem, khóa toàn bộ nút Thêm/Sửa/Xóa).
  3. **Thanh tìm kiếm toàn cục (Global Search - Ctrl + K):** Cho phép gõ tìm nhanh số hóa đơn, tên đối tác, số tài khoản, mã chứng từ.
  4. **Nút "Tạo mới nhanh" (+ Quick Add):** Dropdown tạo nhanh: Phiếu thu, Phiếu chi, HĐ bán ra, HĐ mua vào, Bút toán tổng hợp.
  5. **Nút AI Assistant Sparkle:** Icon tia sáng Gradient kèm dòng chữ `AI Copilot`, bấm để trượt mở Drawer phân tích.
  6. **Chuông thông báo (Notification Center):** Hiển thị số lượng cảnh báo đỏ/vàng (VD: 3 hóa đơn nghi ngờ rủi ro, 1 cảnh báo lệch thuế).
  7. **User Avatar & Profile Menu:** Tên người dùng, vai trò (`Kế toán trưởng` / `Chủ doanh nghiệp`), Menu đăng xuất.

### 3.3. Content Canvas & Breadcrumbs
* **Breadcrumb:** Định dạng chuẩn `Phân hệ / Chức năng / Chi tiết chứng từ` (VD: `Mua hàng / Hóa đơn mua vào / HĐ-2026-09-0012`).
* **Page Header:** Gồm Tiêu đề trang (H1), mô tả ngắn, và Thanh nút bấm hành động (Primary Action Button bên phải ngoài cùng).

### 3.4. AI Assistant Drawer (Khung trợ lý AI)
* **Vị trí:** Trượt từ mép phải màn hình hoặc cố định dạng **Split-View 50/50** khi đối chiếu chứng từ gốc.
* **Chiều rộng:** `400px` (có thể kéo dãn tối đa `560px`).
* **Cấu trúc:** Header (Tên AI Copilot + Nút thu nhỏ/đóng), Body (Lịch sử hội thoại & Thẻ khuyến nghị thông minh), Footer (Ô nhập lệnh chat, nút đính kèm hóa đơn PDF/ảnh để AI đọc tự động).

---

## 4. THƯ VIỆN LINH KIỆN MASTER (MASTER COMPONENTS LIBRARY)

### 4.1. Data Table / List View Component
* **Header Bảng (Sticky Header):** Cột Checkbox chọn tất cả, Tên cột kèm icon Sắp xếp (Sort $\uparrow\downarrow$), Bộ lọc nhanh tại từng cột (Filter).
* **Dòng dữ liệu (Row States):**
  * `Default`: Nền trắng (`neutral-surface`), viền dưới 1px.
  * `Hover`: Nền `primary-50` nhẹ, hiện nút thao tác nhanh (Quick actions).
  * `Selected`: Checkbox được tick, nền `primary-50` đậm hơn, viền trái màu xanh `primary-500` dày 3px.
* **Quy chuẩn căn lề cột:**
  * Mã chứng từ, Ngày tháng: **Căn giữa (Center)**.
  * Tên đối tác, Diễn giải nội dung: **Căn trái (Left)**.
  * Trạng thái chứng từ, Badge thuế: **Căn giữa (Center)**.
  * Số lượng, Đơn giá, Tiền hàng, Tiền thuế, Tổng tiền: **Căn phải (Right)** với font `Table-Number` (Tabular nums).
* **Row Actions (Menu 3 chấm):** Xem chi tiết, Chỉnh sửa, Nhân bản chứng từ (Duplicate), Bỏ ghi sổ (Unpost), Lập bút toán đảo (Reverse), In phiếu (PDF), Xóa nháp.
* **Dòng Tổng cộng (Sticky Summary Row):** Cố định ở đáy bảng, hiển thị tổng tiền lũy kế của trang hoặc của toàn bộ bộ lọc.
* **Thanh phân trang (Pagination Bar):** Hiển thị `Hiển thị 1 - 20 trên tổng số 1,450 chứng từ`, Dropdown chọn `20 / 50 / 100 dòng`, Nút chuyển trang (First, Prev, 1, 2, 3... Next, Last).

---

### 4.2. Form / Voucher View (Master-Detail Form)

Giao diện lập chứng từ kế toán (Phiếu thu, Phiếu chi, Hóa đơn, Bút toán) gồm 4 khu vực:

```text
+-----------------------------------------------------------------------------------------------+
| VOUCHER HEADER                                                                                |
| Mã đối tượng: [ KH001 - Công ty TNHH Mai Linh     ▼]   Số chứng từ:   [ PT-2026-09-001 ]      |
| Địa chỉ:      [ 123 Nguyễn Huệ, Q.1, TP.HCM       ]   Ngày chứng từ: [ 23/09/2026     📅]    |
| Mã số thuế:   [ 0312345678                        ]   Ngày hạch toán:[ 23/09/2026     📅]    |
| Diễn giải:    [ Thu tiền bán hàng theo HĐ số 0045 ]   Loại tiền:     [ VND - Tỷ giá: 1 ]      |
+-----------------------------------------------------------------------------------------------+
| DETAIL GRID (BẢNG HẠCH TOÁN ĐỊNH KHOẢN)                                                       |
| [# | Diễn giải dòng         | TK Nợ | TK Có | Số tiền        | Thuế % | Tiền thuế   | Đơn vị] |
| [1 | Thu tiền hàng Cty MaiLinh| 1111  | 131   | 15,000,000  ₫  | 0%     | 0  ₫        | P.KD  ] |
| [+ Thêm dòng mới]  [Nhập từ Excel]  [Gợi ý định khoản từ AI ✨]                               |
+-----------------------------------------------------------------------------------------------+
| LIVE BALANCE BAR (THANH KIỂM SOÁT CÂN ĐỐI NỢ - CÓ)                                            |
| Tổng Nợ: 15,000,000 ₫   |   Tổng Có: 15,000,000 ₫   |   Chênh lệch: 0 ₫  🟢 [CÂN ĐỐI - HỢP LỆ]|
+-----------------------------------------------------------------------------------------------+
| BOTTOM ACTION BAR                                                                             |
| [X Hủy bỏ]       [Lưu nháp]   [In phiếu]        [Lưu & Thêm mới]        [GHI SỔ CHỨNG TỪ (F8)]|
+-----------------------------------------------------------------------------------------------+
```

* **Ô nhập liệu Tài khoản (Account Lookup):** Khi gõ số `111` hoặc chữ `Tiền mặt`, dropdown bung danh sách tài khoản theo chuẩn TT200/TT133 kèm mã và tên gọi đầy đủ (VD: `1111 - Tiền Việt Nam`).
* **Hỗ trợ thao tác bằng bàn phím:** Người dùng có thể nhấn phím `Enter` hoặc `Tab` để nhảy qua ô tiếp theo, phím `Mũi tên xuống` để thêm dòng mới mà không cần chạm chuột.

---

### 4.3. Dynamic Balance Bar (Thanh kiểm soát cân đối Nợ = Có)

Thành phần kiểm soát cốt lõi tuân thủ nguyên tắc kế toán kép:

* **Trạng thái 1: Cân đối hoàn hảo (Balanced):**
  * Nền xanh nhạt (`success-50`), viền xanh (`success-500`).
  * Nội dung: `Tổng Nợ: 50.000.000 ₫` | `Tổng Có: 50.000.000 ₫` | `Chênh lệch: 0 ₫`.
  * Badge: 🟢 **CÂN ĐỐI – ĐỦ ĐIỀU KIỆN GHI SỔ**.
  * Nút "GHI SỔ CHỨNG TỪ" ở trạng thái Active (Màu xanh `primary-500`).
* **Trạng thái 2: Không cân đối (Unbalanced):**
  * Nền đỏ nhạt (`danger-50`), viền đỏ (`danger-500`).
  * Nội dung: `Tổng Nợ: 50.000.000 ₫` | `Tổng Có: 45.000.000 ₫` | `Chênh lệch: 5.000.000 ₫ (Thiếu bên Có)`.
  * Badge: 🔴 **MẤT CÂN ĐỐI – KHÔNG THỂ GHI SỔ**.
  * Nút "GHI SỔ CHỨNG TỪ" bị Disable (Màu xám, icon ổ khóa, tooltip giải thích lý do).

---

### 4.4. AI Chatbot & Insights Cards Component

* **User Message Bubble:** Bo góc 16px (góc dưới phải 4px), nền `primary-500`, chữ trắng, căn phải.
* **AI Message Bubble:** Bo góc 16px (góc dưới trái 4px), nền `neutral-surface`, viền `neutral-border`, kèm icon Sparkle màu tím/cyan, căn trái.
* **Interactive Insight Card (Thẻ khuyến nghị trong Chat):**
  * Tiêu đề: Có icon phân loại (💡 Gợi ý định khoản | ⚠️ Cảnh báo rủi ro thuế | 📊 Phân tích dòng tiền).
  * Chi tiết: Tóm tắt nội dung kèm các con số trực quan.
  * Confidence Tag: `Độ chính xác: 98% (Xác thực bởi CQT)`.
  * Khối nút hành động (Quick Action Buttons):
    * `[Áp dụng vào chứng từ]` $\rightarrow$ Điền tự động vào bảng hạch toán.
    * `[Xem chứng từ gốc]` $\rightarrow$ Mở popup xem file PDF hóa đơn.
    * `[Bỏ qua]` $\rightarrow$ Ẩn đề xuất.

---

### 4.5. Status Badge & Tax Risk Indicators

| Tên Badge | Màu sắc (Nền / Chữ) | Ý nghĩa hiển thị |
| :--- | :--- | :--- |
| `Dự thảo (Draft)` | Xám (`neutral-100` / `neutral-700`) | Chứng từ mới tạo, chưa ghi sổ, chưa ảnh hưởng số cái |
| `Chờ duyệt (Pending)` | Vàng cam (`warning-50` / `warning-700`) | Đã gửi lên Kế toán trưởng / Giám đốc chờ duyệt |
| `Đã ghi sổ (Posted)` | Xanh lá (`success-50` / `success-700`) | Đã ghi vào Sổ cái và sổ chi tiết |
| `Bút toán đảo (Reversed)`| Tím nhạt (`indigo-50` / `indigo-700`) | Chứng từ dùng để điều chỉnh/đảo số liệu chứng từ cũ |
| `Đã hủy (Voided)` | Đỏ nhạt (`danger-50` / `danger-700`) | Chứng từ đã hủy bỏ, giữ lại để truy vết audit |
| `Hợp lệ CQT` | Xanh ngọc (`emerald-50` / `emerald-700`) | Hóa đơn điện tử tồn tại hợp lệ trên cổng Tổng cục Thuế |
| `Rủi ro cao (Tax Risk)` | Đỏ đậm (`rose-100` / `rose-800`) | Doanh nghiệp bán hàng ngưng hoạt động / bỏ trốn |
| `Chênh lệch thuế` | Cam đậm (`amber-100` / `amber-800`) | Lệch tiền thuế giữa hóa đơn và kê khai |

---

### 4.6. Confirmation & Danger Modals (Theo chuẩn CR-UI-08)

Dành cho các hành động nguy hiểm không thể hoàn tác trực tiếp:

* **Header:** Icon Tam giác cảnh báo màu đỏ (`danger-500`) rung nhẹ, Tiêu đề: `Xác nhận Hủy chứng từ / Bỏ ghi sổ`.
* **Nội dung cảnh báo:** `Thao tác này sẽ hủy ghi nhận bút toán trong Sổ cái kỳ Tháng 09/2026. Báo cáo tài chính liên quan sẽ bị thay đổi.`
* **Ô nhập bắt buộc:** `Lý do hủy chứng từ (Tối thiểu 10 ký tự)` kèm checkbox `[ ] Tôi hiểu rõ rủi ro và xác nhận thực hiện`.
* **Nút bấm:**
  * Nút "Đóng / Giữ lại": Nền xám nhạt (`neutral-100`).
  * Nút "Xác nhận Hủy": Nền đỏ (`danger-500`), chỉ sáng lên khi người dùng đã tick checkbox và nhập lý do.

---

## 5. ĐẶC TẢ CHI TIẾT 8 MÀN HÌNH CỐT LÕI (CORE SCREENS SPECIFICATION)

### SCREEN 01: Executive & Solopreneur Dashboard (Bảng Điều Hành & Sức Khỏe Tài Chính)
* **Mục tiêu:** Màn hình chính sau khi đăng nhập, giúp chủ doanh nghiệp 1 người và Kế toán trưởng nắm trọn bức tranh tài chính trong 5 giây.
* **Khối 1 - Financial KPI Cards (4 thẻ trên cùng):**
  * Thẻ 1: **Số dư tiền tức thời** (Tổng tiền mặt tại quỹ + Tiền gửi ngân hàng) kèm biến động % so với tháng trước.
  * Thẻ 2: **Doanh thu thuần lũy kế** (So với chỉ tiêu kỳ này).
  * Thẻ 3: **Công nợ phải thu (AR)** (Bao gồm số tiền trong hạn và số tiền quá hạn báo đỏ).
  * Thẻ 4: **Nghĩa vụ Thuế dự kiến phải nộp** (Thuế GTGT + Thuế TNDN tạm tính quý này) kèm đồng hồ đếm ngược ngày đến hạn nộp tờ khai.
* **Khối 2 - Biểu đồ trực quan (Charts):**
  * Biểu đồ Cột kép: Doanh thu vs Chi phí theo từng tháng trong năm.
  * Biểu đồ Đường: Dự báo dòng tiền (Cash Flow Forecast) trong 30 ngày tới do AI tính toán dựa trên hóa đơn đến hạn.
* **Khối 3 - AI Daily Financial Briefing (Bản tin tài chính AI):**
  * Khối card với gradient tím nhẹ: `Trợ lý AI đã phát hiện 2 điểm cần lưu ý hôm nay: Khách hàng X quá hạn nợ 15 ngày (52.000.000 ₫); Có 1 hóa đơn đầu vào từ doanh nghiệp thuộc diện cảnh báo rủi ro thuế.`
* **Khối 4 - Quick Task Actions:** Nút tắt: Lập HĐ bán, Quét HĐ mua, Chi tiền, Nộp thuế.

---

### SCREEN 02: AI Financial Copilot (Màn Hình Trò Chuyện & Phân Tích Chuyên Sâu)
* **Mục tiêu:** Cho phép người dùng đàm thoại tự nhiên với AI về tình hình số liệu tài chính và tra cứu văn bản pháp luật thuế.
* **Cột trái (Lịch sử hội thoại - 260px):** Danh sách các phiên trò chuyện theo chủ đề (VD: `Phân tích chi phí Quý 3`, `Tra cứu chi phí hợp lý tiếp khách`, `Dự báo thuế TNDN 2026`).
* **Khu vực trung tâm (Khung Chat chính):**
  * Câu hỏi gợi ý nhanh (Prompt Starters): `Tháng này tôi lãi hay lỗ bao nhiêu?`, `Liệt kê các khoản chi phí lớn nhất tháng qua?`, `Khách hàng nào nợ nhiều nhất?`, `Kiểm tra rủi ro hóa đơn trước kỳ kê khai`.
  * Câu trả lời của AI: Trả lời dạng văn bản kết hợp **Bảng số liệu mini, Biểu đồ trực quan và Nút Drill-down** (nhấp để nhảy thẳng tới chứng từ gốc).
* **Cột phải (Bảng phân tích bổ trợ - 320px):** Hiển thị các chỉ số tài chính liên quan đến câu hỏi hiện tại (Biên lợi nhuận gộp, Tỷ suất EBITDA, Khả năng thanh toán tức thời).

---

### SCREEN 03: Mua Hàng & OCR Hóa Đơn Điện Tử Đầu Vào (AI Invoice Processing)
* **Mục tiêu:** Tự động hóa 100% khâu nhập liệu hóa đơn mua hàng bằng AI trích xuất.
* **Bố cục Split-View 50/50:**
  * **Nửa bên trái (Tài liệu gốc):** Trình xem file PDF/XML hóa đơn điện tử với khả năng zoom, xoay, highlight vùng dữ liệu.
  * **Nửa bên phải (Form dữ liệu AI đã trích xuất):**
    * Tên nhà cung cấp, Mã số thuế, Số hóa đơn, Ký hiệu, Ngày lập.
    * Bảng chi tiết từng dòng hàng hóa, dịch vụ, số lượng, đơn giá, thuế suất.
    * Gợi ý tự động tài khoản hạch toán: `Nợ 1561 / Nợ 1331 / Có 331`.
  * **Thanh cảnh báo kiểm tra CQT trên đầu trang:**
    * Badge xanh: `Đã đối soát cổng Tổng cục Thuế: Hóa đơn Hợp lệ - Bên bán đang hoạt động bình thường`.
    * Hoặc Badge đỏ: `CẢNH BÁO: Doanh nghiệp bán hàng đã ngừng hoạt động từ ngày 15/08/2026!`
  * **Nút bấm hành động:** `[Chỉnh sửa dữ liệu]`, `[Chấp thuận & Ghi sổ]`.

---

### SCREEN 04: Form Chứng Từ Chi Tiết Đa Năng (Voucher View)
* **Mục tiêu:** Màn hình tiêu chuẩn dùng chung cho Phiếu Thu, Phiếu Chi, Giấy Báo Nợ/Có, Bút toán Tổng hợp.
* **Đặc tả bố cục chi tiết:**
  * **Header:** Chứa đầy đủ trường Đối tượng, Địa chỉ, Mã số thuế, Lý do nộp/chi, Số CT (tự động nhảy theo quy tắc `CR-BR`), Ngày hạch toán, Ngày chứng từ.
  * **Bảng chi tiết Line-items:** Thêm dòng, xóa dòng, nhân bản dòng, kéo thả sắp xếp lại thứ tự dòng.
  * **Thanh Dynamic Balance Bar:** Hiển thị tức thời dưới đáy bảng hạch toán.
  * **Tab Thông tin bổ sung:** Chi phí theo Dự án, Trung tâm chi phí (Cost Center), Hợp đồng, Hạn thanh toán.
  * **Tab Lịch sử truy vết (Audit Trail):** Ghi rõ `Người tạo: Nguyễn Văn A (10:15 23/09/2026)` $\rightarrow$ `Kế toán trưởng phê duyệt: Trần Thị B (11:00 23/09/2026)`.

---

### SCREEN 05: Bán Hàng & Phân Tích Tuổi Nợ (Sales & AR Aging)
* **Khối 1 - Thống kê công nợ bán hàng:**
  * Tổng phải thu khách hàng | Nợ trong hạn (0 - 30 ngày) | Nợ quá hạn nhẹ (31 - 60 ngày) | Nợ rủi ro (> 90 ngày).
* **Khối 2 - Bảng Danh sách Hóa đơn Bán ra:**
  * Các cột: Số HĐ, Ký hiệu, Khách hàng, Ngày phát hành, Tổng tiền, Trạng thái HĐĐT (Chưa ký, Đã ký CKS, Đã gửi CQT, CQT chấp nhận), Trạng thái thanh toán (Chưa thanh toán, Thanh toán 1 phần, Đã thanh toán đủ).
* **Khối 3 - Nút thao tác nghiệp vụ:** `[Lập hóa đơn mới]`, `[Ký số hàng loạt CKS]`, `[Gửi email hóa đơn cho khách]`, `[Nhắc nợ tự động qua Zalo/Email]`.

---

### SCREEN 06: Tiền Gửi & Đối Chiếu Tự Động Sổ Phụ Ngân Hàng (Bank Auto-Reconciliation)
* **Mục tiêu:** Khớp nối giữa Sổ phụ Ngân hàng (tải từ e-Banking API) và Sổ kế toán nội bộ.
* **Bố cục 2 Cột so sánh (Side-by-Side Reconciliation):**
  * **Cột trái:** Giao dịch trên Sổ phụ Ngân hàng (Ngày, Nội dung chuyển khoản, Số tiền Thu/Chi).
  * **Cột phải:** Bút toán tương ứng trên Hệ thống kế toán.
* **AI Smart Match:**
  * Tự động khớp các cặp giao dịch trùng khớp số tiền và số tài khoản (Highlight màu xanh lá).
  * Gợi ý tạo nhanh Phiếu thu/Phiếu chi cho các giao dịch ngân hàng phát sinh nhưng chưa nhập vào kế toán (VD: Lãi tiền gửi, Phí chuyển tiền ngân hàng).
  * Nút bấm: `[Khớp lệnh tự động 1-click]` $\rightarrow$ Hoàn tất đối chiếu trong 3 giây.

---

### SCREEN 07: Kê Khai Thuế & Trung Tâm Kiểm Soát Rủi Ro Thuế (Tax Compliance & Audit)
* **Mục tiêu:** Kiểm tra toàn bộ tính hợp lệ trước khi lập tờ khai nộp Cơ quan Thuế.
* **Khối 1 - Bảng kiểm tra sức khỏe thuế (Tax Health Check):**
  * Tổng số hóa đơn đầu vào / đầu ra trong kỳ.
  * Số hóa đơn có rủi ro phát hiện bởi AI (chênh lệch thuế suất 8% vs 10%, mã số thuế không tồn tại).
* **Khối 2 - Tờ khai Thuế GTGT (Mẫu 01/GTGT):**
  * Bảng hiển thị tự động các chỉ tiêu: `[Chỉ tiêu 22 - Thuế còn được khấu trừ kỳ trước]`, `[Chỉ tiêu 23, 24, 25 - Hàng hóa mua vào]`, `[Chỉ tiêu 26, 27, 28... - Hàng hóa bán ra]`, `[Chỉ tiêu 40 - Thuế GTGT phải nộp]`.
* **Khối 3 - Xuất dữ liệu:** Nút `[Xuất file XML chuẩn HTKK]` để nộp trực tiếp lên hệ thống thuedientu.gdt.gov.vn.

---

### SCREEN 08: Kế Toán Tổng Hợp, Khóa Sổ & Báo Cáo Tài Chính Drill-Down
* **Khối 1 - Quy trình Khóa sổ Cuối kỳ (Closing Checklist Wizard):**
  * Bước 1: Tính giá vốn xuất kho tự động.
  * Bước 2: Trích khấu hao TSCĐ & Phân bổ CCDC.
  * Bước 3: Đánh giá lại chênh lệch tỷ giá cuối kỳ.
  * Bước 4: Tự động kết chuyển Doanh thu - Chi phí - Xác định kết quả kinh doanh (Tài khoản 911).
  * Bước 5: **Khóa sổ kế toán kỳ này (Prevent Backdating)**.
* **Khối 2 - Báo cáo Tài chính Đa năng (Financial Statements View):**
  * Cho phép chọn tab: Bảng cân đối phát sinh tài khoản, Báo cáo KQKD, Báo cáo LCTT.
  * **Tính năng Drill-down đỉnh cao:** Nhấp vào bất kỳ con số nào trên báo cáo $\rightarrow$ Mở rộng xem **Sổ chi tiết tài khoản** $\rightarrow$ Nhấp tiếp để mở ngay **Chứng từ gốc ban đầu**.

---

## 6. QUY CHUẨN PHÍM TẮT & MICRO-INTERACTIONS KẾ TOÁN

Để tối ưu tốc độ làm việc cho kế toán chuyên nghiệp và doanh nghiệp bận rộn:

| Phím tắt (Hotkeys) | Hành động kích hoạt trên UI |
| :--- | :--- |
| `Ctrl + K` (hoặc `Cmd + K`) | Mở thanh Tìm kiếm toàn cục (Global Search) |
| `Ctrl + N` | Tạo nhanh chứng từ mới thuộc phân hệ hiện tại |
| `Ctrl + S` | Lưu nháp chứng từ đang nhập |
| `F8` (hoặc `Ctrl + Enter`) | **GHI SỔ CHỨNG TỪ (Chỉ kích hoạt khi Nợ = Có)** |
| `F3` | Tìm kiếm đối tượng / tài khoản trong bảng hạch toán |
| `Ctrl + I` | Bật/tắt nhanh Khung chat Trợ lý AI (AI Copilot Drawer) |
| `Esc` | Đóng Modal, Đóng Drawer AI |
| `Tab` / `Shift + Tab` | Di chuyển giữa các ô nhập liệu trong bảng |

---

## 7. CHECKLIST BÀN GIAO & CẤU TRÚC TRANG TRONG FILE FIGMA

Khi thiết lập file Figma cho dự án, cấu trúc các trang (Pages) cần được phân chia khoa học như sau:

```text
📁 FIGMA FILE: [PROD] TAX & ACCOUNTING AI PLATFORM
├── 📱 00. Cover & Document Info (Thumbnail, Version, Release Notes)
├── 🎨 01. Design Tokens & Foundations (Colors, Typography, Spacing, Elevation, Icons)
├── 🧩 02. Master Components (Buttons, Inputs, Badges, Tables, Balance Bar, AI Chat)
├── 📐 03. Global App Shell (Sidebar, Topbar, Layout Grid Templates)
├── 🖥️ 04. Dashboard & AI Copilot (Screens 01 & 02)
├── 🛒 05. AP & AR Modules (Screens 03 & 05: Purchase, Sales, Invoices)
├── 📝 06. Voucher & Forms (Screen 04: Cash, Bank, Journals)
├── 🏦 07. Cash, Bank & Reconciliation (Screen 06: Auto-Recon)
├── 📑 08. Tax Compliance & Risk Audit (Screen 07: VAT 01/GTGT, Tax Risk)
├── 📊 09. General Ledger & Financial Reports (Screen 08: Closing, BCTC Drilldown)
└── ⚡ 10. Prototype & Interactive Flows (Micro-animations, Dialogs, Hotkeys overlay)
```

---

*Tài liệu này là căn cứ chuẩn mực để Designer triển khai toàn bộ hệ thống Component và Mockup chi tiết trên Figma, đảm bảo ăn khớp 100% với kiến trúc kỹ thuật và nghiệp vụ kế toán Việt Nam.*
