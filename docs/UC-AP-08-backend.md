# UC-AP-08: Đối chiếu công nợ nhà cung cấp (Supplier Debt Reconciliation) - Backend Architecture & Technical Specification

Tài liệu thiết kế kiến trúc kỹ thuật và đặc tả API Backend cho nghiệp vụ **UC-AP-08: Đối chiếu công nợ nhà cung cấp**.  
Chuẩn hóa theo Activity Flow (bước 1–33), 6 luồng thay thế (**AF-AP-REC-01** đến **AF-AP-REC-06**), 19 chốt chặn ngoại lệ (**EX-AP-REC-01** đến **EX-AP-REC-19**) và toàn diện 18 quy tắc nghiệp vụ (**BR-AP-REC-01** đến **BR-AP-REC-18**).

---

## 1. Tổng quan Kiến trúc Backend

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CHỨNG TỪ CÔNG NỢ & THANH TOÁN (AP LEDGER)       │
│  - Hóa đơn / Chứng từ mua hàng / Khoản phải trả khác (Payable > 0)     │
│  - Thanh toán NCC (Payment), Bù trừ công nợ (DebtOffset), Netting      │
│  - Điều chỉnh tăng/giảm công nợ (PayableAdjustmentVoucher)             │
│  - Toàn bộ đều ở trạng thái ĐÃ GHI SỔ (Status == POSTED / CONFIRMED)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │        UC-AP-08 Supplier Debt Reconciliation Service    │
       │  - Phân quyền IAM (AP.RECONCILIATION.VIEW, CREATE,      │
       │                    CONFIRM, CANCEL)                     │
       │  - Lấy dữ liệu (preview): Tính Đầu kỳ, Phát sinh tăng,  │
       │    Phát sinh giảm, Cuối kỳ & Danh sách giao dịch        │
       │  - Tạo chữ ký bảo vệ dữ liệu (snapshot_token SHA-256)   │
       │  - Khóa bộ đếm & cấp số: DCNCC-YYYY-NNNNNN (BR-08..12)  │
       │  - Lưu biên bản trạng thái PENDING (Chờ NCC xác nhận)   │
       │  - Lưu ảnh chụp giao dịch bất biến (Immutable Snapshot) │
       │  - Xuất biên bản đối chiếu ra PDF theo chuẩn in ấn      │
       │  - Ghi nhận xác nhận: Khớp (MATCHED) hoặc               │
       │    Có chênh lệch (DIFFERENT, bắt buộc lý do & xử lý)    │
       │  - PHI TIỀN TỆ: Không tạo bút toán GL, không sửa nợ     │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │             ap_supplier_reconciliation                  │
       │  - number: DCNCC-YYYY-NNNNNN                            │
       │  - supplier_id (FK Party), currency_id (FK Currency)    │
       │  - period_start, period_end, content (max 500 chars)    │
       │  - opening_balance, period_increase, period_decrease,   │
       │    closing_balance                                      │
       │  - snapshot (JSONB lưu chi tiết giao dịch)              │
       │  - snapshot_token (SHA-256 chống dữ liệu bị sửa đổi)    │
       │  - status: PENDING / MATCHED / DIFFERENT / CANCELLED    │
       │  - confirmation_date, confirmed_by_name (max 255 chars) │
       │  - supplier_balance, difference                         │
       │  - confirmation_attachments (JSONB file đính kèm)       │
       │  - difference_reason, resolution (max 500 chars)        │
       └─────────────────────────────────────────────────────────┘
```

### Nguyên tắc tài chính & kế toán cốt lõi:
1. **Nghiệp vụ Phi tiền tệ (Non-monetary invariant - BR-AP-REC-16)**:
   - Nghiệp vụ đối chiếu công nợ **không tạo bất kỳ bút toán Sổ cái GL nào**.
   - Nghiệp vụ **không tự động thay đổi số dư công nợ** của các chứng từ phải trả hay số dư nhà cung cấp.
2. **Ảnh chụp dữ liệu bất biến (Immutable Snapshot Pattern - BR-AP-REC-15)**:
   - Khi lập biên bản, toàn bộ danh sách giao dịch, số dư đầu kỳ, phát sinh tăng/giảm và số dư cuối kỳ được đóng băng vào trường `snapshot` (JSONB).
   - Khi xem lại hoặc in PDF trong tương lai, số liệu hoàn toàn không bị ảnh hưởng bởi các giao dịch phát sinh sau thời điểm lập biên bản.
3. **Cơ chế chống sửa đổi ngầm (Optimistic Concurrency via Snapshot Token - EX-AP-REC-09)**:
   - Khi gọi API `preview` (Lấy dữ liệu), hệ thống sinh một mã băm SHA-256 `snapshot_token` từ toàn bộ trạng thái nợ và thanh toán.
   - Khi User bấm `Lập biên bản đối chiếu`, token gửi lên phải khớp với token tại thời điểm ghi nhận. Nếu có giao dịch ghi sổ mới, hệ thống từ chối và yêu cầu lấy lại dữ liệu.
4. **Xác định kết quả đối chiếu (BR-AP-REC-05..07)**:
   - $\text{Chênh lệch} = \text{Số dư nhà cung cấp xác nhận} - \text{Số dư cuối kỳ theo hệ thống}$.
   - Nếu $\text{Chênh lệch} = 0$: Trạng thái chuyển sang `MATCHED` ("Khớp").
   - Nếu $\text{Chênh lệch} \ne 0$: Bắt buộc nhập `Nguyên nhân chênh lệch` và `Hướng xử lý`, trạng thái chuyển sang `DIFFERENT` ("Có chênh lệch").
   - Cho phép số dư nhà cung cấp xác nhận là số dương (còn phải trả), số âm (doanh nghiệp đã trả trước/ứng trước) hoặc 0.

---

## 2. Cấu trúc Mô hình Dữ liệu

### 2.1. Bảng Bộ đếm `ap_supplier_reconciliation_counter`
Quản lý dải số biên bản độc lập theo doanh nghiệp (`company`) và năm hạch toán (`year`).

```sql
CREATE TABLE ap_supplier_reconciliation_counter (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES organization_company(id),
    year INTEGER NOT NULL,
    value INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_ap_reconciliation_counter UNIQUE (company_id, year)
);
```

### 2.2. Bảng Biên bản Đối chiếu `ap_supplier_reconciliation`

```sql
CREATE TABLE ap_supplier_reconciliation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES organization_company(id),
    number VARCHAR(35) NOT NULL,
    supplier_id UUID NOT NULL REFERENCES master_data_party(id),
    currency_id UUID NOT NULL REFERENCES master_data_currency(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    content VARCHAR(500) NOT NULL,
    opening_balance NUMERIC(24, 4) NOT NULL,
    period_increase NUMERIC(24, 4) NOT NULL,
    period_decrease NUMERIC(24, 4) NOT NULL,
    closing_balance NUMERIC(24, 4) NOT NULL,
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    snapshot_token VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MATCHED', 'DIFFERENT', 'CANCELLED')),
    confirmation_date DATE,
    confirmed_by_name VARCHAR(255) NOT NULL DEFAULT '',
    supplier_balance NUMERIC(24, 4),
    difference NUMERIC(24, 4),
    confirmation_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    difference_reason VARCHAR(500) NOT NULL DEFAULT '',
    resolution VARCHAR(500) NOT NULL DEFAULT '',
    created_by_id UUID NOT NULL REFERENCES iam_useraccount(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_by_id UUID REFERENCES iam_useraccount(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_by_id UUID REFERENCES iam_useraccount(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason VARCHAR(500) NOT NULL DEFAULT '',
    CONSTRAINT uq_ap_reconciliation_number UNIQUE (company_id, number),
    CONSTRAINT ck_ap_reconciliation_period CHECK (period_end >= period_start)
);
```

---

## 3. Ánh xạ Kịch bản Nghiệp vụ

### 3.1. Activity Flow (Bước 1 - 33)

| Bước | Actor | Hệ thống Backend | Xử lý Kỹ thuật |
| :---: | :--- | :--- | :--- |
| **1** | Chọn menu Đối chiếu công nợ | Kiểm tra quyền xem và hiển thị danh sách | `GET /api/v1/accounts-payable/supplier-reconciliations/` yêu cầu `AP.RECONCILIATION.VIEW`. |
| **2** | Chọn Thêm mới | Mở màn hình thêm mới, không tạo dữ liệu | Giao diện mở form, không sinh bản ghi database. |
| **3** | Chọn Nhà cung cấp | Hiển thị thông tin Mã, Tên, MST, Địa chỉ | Tải thông tin từ `Party` và địa chỉ chính trong hệ thống. |
| **4** | Chọn Loại tiền đối chiếu | Mặc định VND, mỗi biên bản 1 loại tiền | Lọc các giao dịch theo đúng `currency_id` (BR-AP-REC-13). |
| **5** | Nhập Ngày bắt đầu kỳ đối chiếu | Mặc định ngày đầu tháng hiện tại | Validate định dạng YYYY-MM-DD. |
| **6** | Nhập Ngày kết thúc kỳ đối chiếu | Mặc định ngày hiện tại | Validate định dạng YYYY-MM-DD. |
| **7** | Bấm `Lấy dữ liệu` | Kiểm tra bắt buộc các tham số | Gọi API `preview`, validate EX-02..EX-05. |
| **8** | — | Kiểm tra ngày bắt đầu <= ngày kết thúc | `start <= end` (EX-06). |
| **9** | — | Kiểm tra ngày kết thúc <= hiện tại | `end <= today` (EX-07). |
| **10** | — | Tính Số dư đầu kỳ | Tổng hợp nợ ghi sổ có ngày `< start` (BR-AP-REC-01). |
| **11** | — | Tổng hợp Phát sinh tăng trong kỳ | Mua hàng, chi phí mua hàng, điều chỉnh tăng ghi sổ trong kỳ (BR-AP-REC-02). |
| **12** | — | Tổng hợp Phát sinh giảm trong kỳ | Thanh toán, trả lại hàng, giảm giá hàng mua, bù trừ, điều chỉnh giảm trong kỳ (BR-AP-REC-03). |
| **13** | — | Tính Số dư cuối kỳ theo hệ thống | `closing = opening + increase - decrease` (BR-AP-REC-04). |
| **14** | — | Trả về bảng chi tiết giao dịch | Bảng chi tiết gồm `date`, `number`, `kind`, `description`, `increase`, `decrease`, `balance_after`. |
| **15** | Nhập Nội dung đối chiếu | Mặc định: `Đối chiếu công nợ từ ngày {start} đến ngày {end}` | Tối đa 500 ký tự (EX-08). |
| **16** | Chọn `Lập biên bản đối chiếu` | Kiểm tra đầy đủ thông tin lập biên bản | Validate bắt buộc các trường trước khi tạo. |
| **17** | — | Kiểm tra dữ liệu chưa thay đổi | So khớp `snapshot_token` hiện tại vs lúc preview (EX-09). |
| **18** | — | Khóa và tăng bộ đếm số biên bản | `select_for_update` bộ đếm theo `company` và `year` (BR-08..12). |
| **19** | — | Sinh số biên bản | Định dạng chuẩn `DCNCC-YYYY-NNNNNN`. |
| **20** | — | Lưu biên bản ở trạng thái PENDING | Lưu bản ghi `SupplierReconciliation(status="PENDING")` cùng snapshot. |
| **21** | — | Cho phép tải PDF | Endpoint `GET .../{id}/pdf/` trả về PDF biên bản đối chiếu ReportLab. |
| **22** | Mở biên bản khi nhận kết quả NCC | Hiển thị số liệu đã lưu | Giao diện mở màn hình chi tiết biên bản. |
| **23** | Chọn `Ghi nhận xác nhận` | Mở các trường nhập liệu xác nhận | Sẵn sàng tiếp nhận thông tin xác nhận. |
| **24** | Nhập Ngày xác nhận | Ngày ký nhận của nhà cung cấp | Bắt buộc nhập (EX-10). |
| **25** | Nhập Người xác nhận phía NCC | Tên đại diện hoặc kế toán NCC | Bắt buộc nhập, tối đa 255 ký tự (EX-11). |
| **26** | Nhập Số dư NCC xác nhận | Cho phép số dương, số âm hoặc 0 | Bắt buộc nhập số hợp lệ (EX-12, BR-AP-REC-07). |
| **27** | Đính kèm tài liệu xác nhận | Bắt buộc ít nhất 1 tệp PDF/Ảnh, <= 10MB | Kiểm tra đuôi file và kích thước (EX-13, EX-18). |
| **28** | Chọn `Hoàn thành đối chiếu` | Kiểm tra đầy đủ thông tin xác nhận | Validate bắt buộc các trường hoàn tất đối chiếu. |
| **29** | — | Kiểm tra ngày xác nhận hợp lệ | `period_end <= confirmation_date <= today` (EX-14, EX-15). |
| **30** | — | Tính Chênh lệch hai bên | `difference = supplier_balance - closing_balance` (BR-AP-REC-05). |
| **31** | — | Cập nhật trạng thái biên bản | Nếu `difference == 0`: chuyển sang `MATCHED` ("Khớp").<br>Nếu `difference != 0`: bắt buộc lý do/xử lý, chuyển sang `DIFFERENT` ("Có chênh lệch"). |
| **32** | — | Ghi Audit Log toàn diện | Ghi vết hành động `RECONCILIATION_COMPLETE` với snapshot hai bên. |
| **33** | — | Trả về thông báo thành công | `Hoàn thành đối chiếu công nợ. Kết quả: Khớp.` hoặc `Có chênh lệch.` |

### 3.2. Alternative Flows (Luồng thay thế)

- **AF-AP-REC-01: Không phát sinh giao dịch trong kỳ**  
  Hệ thống vẫn cho phép lập biên bản với Phát sinh tăng và giảm bằng 0 để xác nhận số dư đầu kỳ hoặc số dư bằng 0.
- **AF-AP-REC-02: Nhà cung cấp xác nhận có chênh lệch**  
  Nếu `difference != 0`, User bắt buộc nhập `Nguyên nhân chênh lệch` (EX-16) và `Hướng xử lý` (EX-17), mỗi trường tối đa 500 ký tự. Trạng thái chuyển thành `DIFFERENT`.
- **AF-AP-REC-03: Tải lại dữ liệu trước khi lập biên bản**  
  User gọi lại API `preview` để cập nhật snapshot token mới nhất trước khi lưu.
- **AF-AP-REC-04: Hủy biên bản chờ xác nhận**  
  User có quyền hủy biên bản ở trạng thái `PENDING`, bắt buộc nhập lý do hủy. Hệ thống chuyển trạng thái sang `CANCELLED`.
- **AF-AP-REC-05: Xử lý chênh lệch**  
  User xử lý nguyên nhân bằng các nghiệp vụ chuẩn (điều chỉnh nợ, thanh toán, trả hàng,...). Biên bản cũ giữ nguyên trạng thái `DIFFERENT` làm căn cứ kiểm toán.
- **AF-AP-REC-06: Thoát trước khi lập biên bản**  
  Không lưu dữ liệu biên bản.

---

## 4. Ma trận Ngoại lệ & Kiểm soát Rủi ro (EX-01 đến EX-19)

| Mã ngoại lệ | Bước | Điều kiện kích hoạt | Thông báo lỗi tiếng Việt chuẩn xác | HTTP |
| :--- | :---: | :--- | :--- | :---: |
| **EX-AP-REC-01** | 2 | User không có quyền tạo đối chiếu | `Bạn không có quyền thực hiện đối chiếu công nợ nhà cung cấp.` | 403 |
| **EX-AP-REC-02** | 7 | Chưa chọn Nhà cung cấp | `Vui lòng chọn Nhà cung cấp.` | 400 |
| **EX-AP-REC-03** | 7 | Chưa chọn Loại tiền | `Vui lòng chọn Loại tiền đối chiếu.` | 400 |
| **EX-AP-REC-04** | 7 | Chưa nhập Ngày bắt đầu | `Vui lòng nhập Ngày bắt đầu kỳ đối chiếu.` | 400 |
| **EX-AP-REC-05** | 7 | Chưa nhập Ngày kết thúc | `Vui lòng nhập Ngày kết thúc kỳ đối chiếu.` | 400 |
| **EX-AP-REC-06** | 8 | Ngày bắt đầu > Ngày kết thúc | `Ngày bắt đầu kỳ đối chiếu không được lớn hơn Ngày kết thúc kỳ đối chiếu.` | 400 |
| **EX-AP-REC-07** | 9 | Ngày kết thúc > Ngày hiện tại | `Ngày kết thúc kỳ đối chiếu không được lớn hơn ngày hiện tại.` | 400 |
| **EX-AP-REC-08** | 16 | Nội dung đối chiếu truyền rỗng | `Vui lòng nhập Nội dung đối chiếu.` | 400 |
| **EX-AP-REC-09** | 17 | Dữ liệu công nợ bị thay đổi kể từ lúc lấy dữ liệu | `Dữ liệu công nợ đã thay đổi. Vui lòng chọn Lấy dữ liệu trước khi lập biên bản.` | 400 |
| **EX-AP-REC-10** | 28 | Chưa nhập Ngày xác nhận | `Vui lòng nhập Ngày xác nhận.` | 400 |
| **EX-AP-REC-11** | 28 | Chưa nhập Người xác nhận phía NCC | `Vui lòng nhập Người xác nhận phía nhà cung cấp.` | 400 |
| **EX-AP-REC-12** | 28 | Chưa nhập Số dư NCC xác nhận | `Vui lòng nhập Số dư nhà cung cấp xác nhận.` | 400 |
| **EX-AP-REC-13** | 28 | Chưa đính kèm tài liệu xác nhận | `Vui lòng đính kèm tài liệu xác nhận của nhà cung cấp.` | 400 |
| **EX-AP-REC-14** | 29 | Ngày xác nhận < Ngày kết thúc kỳ | `Ngày xác nhận không được nhỏ hơn Ngày kết thúc kỳ đối chiếu.` | 400 |
| **EX-AP-REC-15** | 29 | Ngày xác nhận > Ngày hiện tại | `Ngày xác nhận không được lớn hơn ngày hiện tại.` | 400 |
| **EX-AP-REC-16** | AF-02 | Có chênh lệch nhưng chưa nhập nguyên nhân | `Vui lòng nhập Nguyên nhân chênh lệch.` | 400 |
| **EX-AP-REC-17** | AF-02 | Có chênh lệch nhưng chưa nhập hướng xử lý | `Vui lòng nhập Hướng xử lý chênh lệch.` | 400 |
| **EX-AP-REC-18** | 27 | Tệp đính kèm sai đuôi hoặc vượt 10MB | `Tệp {Tên tệp} không đúng định dạng hoặc vượt quá dung lượng 10 MB.` | 400 |
| **EX-AP-REC-19** | 20, 31| Lỗi kỹ thuật cập nhật dữ liệu | `Không thể hoàn tất đối chiếu. Dữ liệu chưa được thay đổi.` | 500/400 |

---

## 5. Danh mục Quy tắc Nghiệp vụ (BR-01 đến BR-18)

| Mã quy tắc | Nội dung quy định |
| :--- | :--- |
| **BR-AP-REC-01** | `Số dư đầu kỳ = Tổng công nợ phải trả đã ghi sổ trước Ngày bắt đầu kỳ đối chiếu`. |
| **BR-AP-REC-02** | `Phát sinh tăng = Mua hàng + Chi phí mua hàng + Điều chỉnh tăng trong kỳ`. |
| **BR-AP-REC-03** | `Phát sinh giảm = Thanh toán + Trả lại hàng mua + Giảm giá hàng mua + Bù trừ + Điều chỉnh giảm trong kỳ`. |
| **BR-AP-REC-04** | `Số dư cuối kỳ theo hệ thống = Số dư đầu kỳ + Phát sinh tăng − Phát sinh giảm`. |
| **BR-AP-REC-05** | `Chênh lệch = Số dư nhà cung cấp xác nhận − Số dư cuối kỳ theo hệ thống`. |
| **BR-AP-REC-06** | Chênh lệch bằng 0 là `Khớp` (`MATCHED`); chênh lệch khác 0 là `Có chênh lệch` (`DIFFERENT`). |
| **BR-AP-REC-07** | Số dư dương thể hiện doanh nghiệp còn phải trả; số dư âm thể hiện doanh nghiệp đã trả trước cho nhà cung cấp. |
| **BR-AP-REC-08** | Số biên bản có cấu trúc `DCNCC-YYYY-NNNNNN`, ví dụ `DCNCC-2026-000001`. |
| **BR-AP-REC-09** | `YYYY` là năm của Ngày kết thúc kỳ đối chiếu; `NNNNNN` là số thứ tự 6 chữ số tự động tăng. |
| **BR-AP-REC-10** | Bộ đếm quản lý riêng theo doanh nghiệp và năm; bắt đầu từ `000001` vào ngày 01/01. |
| **BR-AP-REC-11** | Số đã cấp không được tái sử dụng kể cả khi biên bản bị hủy. |
| **BR-AP-REC-12** | Hệ thống phải khóa bộ đếm (`select_for_update`) khi cấp số để tránh trùng lặp. |
| **BR-AP-REC-13** | Mỗi biên bản chỉ đối chiếu một nhà cung cấp và một loại tiền. |
| **BR-AP-REC-14** | Số liệu trên biên bản chỉ lấy từ các chứng từ đã ghi sổ và chưa bị hủy. |
| **BR-AP-REC-15** | Biên bản phải lưu ảnh chụp dữ liệu giao dịch (`snapshot`) tại thời điểm lập để kết quả bất biến khi xem lại. |
| **BR-AP-REC-16** | Đối chiếu công nợ không tạo bút toán Sổ cái GL và không tự động thay đổi số dư công nợ. |
| **BR-AP-REC-17** | Nếu có chênh lệch, User phải xử lý bằng chứng từ nghiệp vụ phù hợp, biên bản cũ giữ nguyên để kiểm tra. |
| **BR-AP-REC-18** | Nhà cung cấp không đăng nhập hệ thống; User ghi nhận kết quả xác nhận nhận được từ bên ngoài. |

---

## 6. Đặc tả Kỹ thuật API Endpoints

### 6.1. Lấy dữ liệu Đối chiếu (Preview)
- **Endpoint**: `GET /api/v1/accounts-payable/supplier-reconciliations/preview/?company_id={id}&supplier={id}&currency={id}&period_start={YYYY-MM-DD}&period_end={YYYY-MM-DD}`
- **Quyền yêu cầu**: `AP.RECONCILIATION.VIEW`
- **Phản hồi mẫu (HTTP 200 OK)**:
```json
{
  "snapshot": {
    "supplier": {
      "id": "c138848a-6b58-45b1-bb96-6df7d17300f8",
      "code": "NCC08",
      "name": "Công ty TNHH Cung ứng Vật tư",
      "tax_code": "0100000008",
      "address": "Số 123 Đường Giải Phóng, Hà Nội"
    },
    "currency": {
      "id": "26d7f0fa-3e4b-4b13-a44d-45dbfaea4d40",
      "code": "VND"
    },
    "period_start": "2026-10-01",
    "period_end": "2026-10-12",
    "opening_balance": "100000000.0000",
    "period_increase": "25000000.0000",
    "period_decrease": "40000000.0000",
    "closing_balance": "85000000.0000",
    "transactions": [
      {
        "date": "2026-10-05",
        "number": "AP-DOC-2026-0012",
        "kind": "Khoản phải trả khác",
        "description": "Ghi nhận công nợ AP-DOC-2026-0012",
        "increase": "25000000.0000",
        "decrease": "0.0000",
        "balance_after": "125000000.0000"
      },
      {
        "date": "2026-10-10",
        "number": "PAY-2026-0055",
        "kind": "PAYMENT",
        "description": "Thanh toán nhà cung cấp UNC 456",
        "increase": "0.0000",
        "decrease": "40000000.0000",
        "balance_after": "85000000.0000"
      }
    ]
  },
  "snapshot_token": "a4f89d31f0e4b85c34e8976b9e4a307bb8a1c97f8b9e6a0d4c82b1c4e9f3b5a1"
}
```

### 6.2. Lập Biên bản Đối chiếu
- **Endpoint**: `POST /api/v1/accounts-payable/supplier-reconciliations/`
- **Quyền yêu cầu**: `AP.RECONCILIATION.CREATE`
- **Yêu cầu (Payload)**:
```json
{
  "company": "f516a578-8fc8-4065-9b2f-7f8a7e00994f",
  "supplier": "c138848a-6b58-45b1-bb96-6df7d17300f8",
  "currency": "26d7f0fa-3e4b-4b13-a44d-45dbfaea4d40",
  "period_start": "2026-10-01",
  "period_end": "2026-10-12",
  "content": "Đối chiếu công nợ tháng 10/2026",
  "snapshot_token": "a4f89d31f0e4b85c34e8976b9e4a307bb8a1c97f8b9e6a0d4c82b1c4e9f3b5a1"
}
```
- **Phản hồi thành công (HTTP 201 Created)**:
```json
{
  "id": "18cf39a0-6c9f-43b2-9d3e-908cf49a027e",
  "number": "DCNCC-2026-000001",
  "supplier": "c138848a-6b58-45b1-bb96-6df7d17300f8",
  "supplier_name": "Công ty TNHH Cung ứng Vật tư",
  "supplier_code": "NCC08",
  "currency_code": "VND",
  "period_start": "2026-10-01",
  "period_end": "2026-10-12",
  "opening_balance": "100000000.0000",
  "period_increase": "25000000.0000",
  "period_decrease": "40000000.0000",
  "closing_balance": "85000000.0000",
  "status": "PENDING",
  "status_display": "Chờ nhà cung cấp xác nhận",
  "message": "Lập biên bản đối chiếu công nợ thành công. Số biên bản: DCNCC-2026-000001."
}
```

### 6.3. Tải Biên bản Đối chiếu dưới dạng PDF
- **Endpoint**: `GET /api/v1/accounts-payable/supplier-reconciliations/{id}/pdf/?company_id={id}`
- **Quyền yêu cầu**: `AP.RECONCILIATION.VIEW`
- **Header**: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="DCNCC-2026-000001.pdf"`.

### 6.4. Ghi nhận Xác nhận từ Nhà cung cấp
- **Endpoint**: `POST /api/v1/accounts-payable/supplier-reconciliations/{id}/complete/`
- **Quyền yêu cầu**: `AP.RECONCILIATION.CONFIRM`
- **Yêu cầu (Payload)**:
```json
{
  "confirmation_date": "2026-10-12",
  "confirmed_by_name": "Trần Thị Lan - Kế toán trưởng NCC",
  "supplier_balance": "85000000.0000",
  "confirmation_attachments": [
    {
      "name": "bien_ban_doi_chieu_ky_dong_dau.pdf",
      "size": 1824000
    }
  ],
  "difference_reason": "",
  "resolution": ""
}
```
- **Phản hồi thành công (HTTP 200 OK)**:
```json
{
  "id": "18cf39a0-6c9f-43b2-9d3e-908cf49a027e",
  "number": "DCNCC-2026-000001",
  "status": "MATCHED",
  "status_display": "Khớp",
  "supplier_balance": "85000000.0000",
  "difference": "0.0000",
  "confirmation_date": "2026-10-12",
  "confirmed_by_name": "Trần Thị Lan - Kế toán trưởng NCC",
  "message": "Hoàn thành đối chiếu công nợ. Kết quả: Khớp."
}
```

### 6.5. Hủy Biên bản Đối chiếu đang Chờ Xác nhận
- **Endpoint**: `POST /api/v1/accounts-payable/supplier-reconciliations/{id}/cancel/`
- **Quyền yêu cầu**: `AP.RECONCILIATION.CANCEL`
- **Yêu cầu (Payload)**:
```json
{
  "reason": "Lập sai kỳ đối chiếu, cần lập lại"
}
```
- **Phản hồi thành công (HTTP 200 OK)**:
```json
{
  "id": "18cf39a0-6c9f-43b2-9d3e-908cf49a027e",
  "number": "DCNCC-2026-000001",
  "status": "CANCELLED",
  "status_display": "Đã hủy",
  "cancel_reason": "Lập sai kỳ đối chiếu, cần lập lại",
  "message": "Hủy biên bản đối chiếu công nợ thành công. Số biên bản: DCNCC-2026-000001."
}
```

---

## 7. Báo cáo Kết quả Kiểm thử Tự động

Kiểm thử được thực hiện bằng Django Test Runner với bộ kiểm thử chuyên biệt [accounts_payable/test_supplier_reconciliation_uc_ap_08.py](file:///c:/Users/Admin/LapTrinh/Thue/accounts_payable/test_supplier_reconciliation_uc_ap_08.py):

| Tên Test Case | Mục tiêu & Luồng kiểm tra | Kết quả |
| :--- | :--- | :---: |
| `test_preview_snapshot_pdf_and_matching_confirmation` | Kiểm tra toàn bộ vòng đời đối chiếu: Lấy dữ liệu, tính đúng số dư, lập biên bản, xuất PDF, xác nhận Khớp (`MATCHED`), kiểm tra không phát sinh bút toán GL (BR-16). | **PASS** |
| `test_difference_requires_reason_and_resolution` | Nhà cung cấp xác nhận có chênh lệch (AF-02): Bắt buộc nhập nguyên nhân và hướng xử lý, chuyển trạng thái sang `DIFFERENT`. | **PASS** |
| `test_stale_preview_rejected_and_cancel_only_pending` | Kiểm tra chống sửa đổi ngầm (bắt token hết hạn khi phát sinh giao dịch mới), hủy biên bản chờ xác nhận, bảo vệ bộ đếm không bị dùng lại (BR-11). | **PASS** |
| `test_zero_activity_and_advance_balance` | Kiểm tra kỳ không có phát sinh giao dịch (AF-01), số dư đầu kỳ âm do trả trước (BR-07). | **PASS** |
| `test_posted_adjustment_and_validation` | Kiểm tra tính toán tổng hợp bao gồm cả các khoản điều chỉnh công nợ đã ghi sổ (BR-02, BR-03). | **PASS** |
| `test_all_validation_exceptions_ex02_to_ex18` | Kiểm tra toàn diện 16 chốt chặn ngoại lệ với thông báo tiếng Việt chuẩn xác từ EX-02 đến EX-18. | **PASS** |
| `test_saved_snapshot_does_not_follow_later_payment_change` | Kiểm tra tính bất biến của ảnh chụp dữ liệu (`snapshot`): Các thay đổi giao dịch sau này không làm thay đổi biên bản đã lập (BR-15). | **PASS** |
| `test_rbac_permissions_ex01` | Phân quyền IAM chi tiết: Kiểm tra mã lỗi HTTP 403 khi thiếu quyền `VIEW`, `CREATE`, `CONFIRM`, `CANCEL`. | **PASS** |

**Tổng kết:** `Ran 8 tests in 4.845s. OK.`
