# UC-AP-07: Điều chỉnh công nợ phải trả (Payable Debt Adjustment) - Backend Architecture & Technical Specification

Tài liệu thiết kế kiến trúc kỹ thuật và đặc tả API Backend cho nghiệp vụ **UC-AP-07: Điều chỉnh công nợ phải trả**.  
Chuẩn hóa theo Activity Flow (bước 1–33), 6 luồng thay thế (**AF-AP-ADJ-01** đến **AF-AP-ADJ-06**), 20 chốt chặn ngoại lệ (**EX-AP-ADJ-01** đến **EX-AP-ADJ-20**) và toàn diện 27 quy tắc nghiệp vụ (**BR-AP-ADJ-01** đến **BR-AP-ADJ-27**).

---

## 1. Tổng quan Kiến trúc Backend

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CHỨNG TỪ CÔNG NỢ PHẢI TRẢ (PAYABLE)             │
│  - Phát sinh từ Hóa đơn mua hàng (SupplierInvoice) / Chứng từ mua hàng │
│    hoặc Khoản phải trả khác đã ghi sổ (Status == POSTED)               │
│  - Thuộc Nhà cung cấp hợp lệ và kỳ kế toán chưa khóa                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │         UC-AP-07 Payable Adjustment Service             │
       │  - Phân quyền IAM (AP.ADJUSTMENT_VOUCHER.VIEW, CREATE)  │
       │  - Kiểm tra kỳ kế toán ngày điều chỉnh (Open period)    │
       │  - Khóa chọn chứng từ công nợ (select_for_update)       │
       │  - Kiểm tra giới hạn điều chỉnh giảm <= balance         │
       │  - Tài khoản đối ứng != 331, active & is_postable       │
       │  - Khóa bộ đếm & cấp số: DCPT-YYYY-NNNNNN (BR-19..23)   │
       │  - Tạo chứng từ điều chỉnh: POSTED (BR-3.4)             │
       │  - Sinh bút toán Sổ cái GL (BR-AP-ADJ-24):              │
       │     + Tăng: Nợ TK đối ứng / Có TK 331                   │
       │     + Giảm: Nợ TK 331 / Có TK đối ứng                   │
       │  - Cập nhật Payable: adjustment_amount, balance, status │
       │  - Ghi Audit Log & thông báo kết quả                    │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │             ap_payable_adjustment_voucher               │
       │  - number: DCPT-YYYY-NNNNNN                             │
       │  - supplier_id (FK Party), payable_id (FK Payable)      │
       │  - kind: INCREASE / DECREASE                            │
       │  - reason: RECONCILIATION / OPENING_BALANCE /           │
       │            ROUNDING / OTHER                             │
       │  - reason_detail: max 500 chars (bắt buộc khi OTHER)    │
       │  - basis: max 255 chars, description: max 500 chars     │
       │  - amount > 0, counter_account_id (FK Account != 331)   │
       │  - balance_before, balance_after                        │
       │  - status: POSTED / CANCELLED                           │
       │  - journal_entry_id (FK GL), reversal_journal_entry_id  │
       └─────────────────────────────────────────────────────────┘
```

### Nguyên tắc tài chính & kế toán cốt lõi:
1. **Định khoản chuẩn mực kế toán Việt Nam (BR-AP-ADJ-24)**:
   - **Điều chỉnh tăng (`INCREASE`)**:
     $$\begin{align*}
     \text{Nợ TK Đối ứng} & \text{ (Chi phí, TK 642, 811,...)}: & \text{Số tiền điều chỉnh} \\
     \text{Có TK 331} & \text{ (Phải trả cho người bán)}: & \text{Số tiền điều chỉnh}
     \end{align*}$$
   - **Điều chỉnh giảm (`DECREASE`)**:
     $$\begin{align*}
     \text{Nợ TK 331} & \text{ (Phải trả cho người bán)}: & \text{Số tiền điều chỉnh} \\
     \text{Có TK Đối ứng} & \text{ (Thu nhập khác, TK 711,...)}: & \text{Số tiền điều chỉnh}
     \end{align*}$$
2. **Phi tiền tệ (Non-monetary)**:
   - Nghiệp vụ điều chỉnh công nợ không tạo phiếu thu, phiếu chi, UNC, tài khoản tiền mặt/ngân hàng.
   - Không tự động thay đổi số lượng kho hay hóa đơn đầu vào (BR-AP-ADJ-24..26).
3. **Cập nhật số dư & trạng thái công nợ (BR-AP-ADJ-13..18)**:
   - `balance_after = balance_before + amount` (Tăng)
   - `balance_after = balance_before - amount` (Giảm, không được âm)
   - Nếu `balance == 0`: Trạng thái `PAID` ("Đã thanh toán").
   - Nếu `balance > 0` và `paid_amount > 0`: Trạng thái `PARTIALLY_PAID` ("Đã thanh toán một phần").
   - Nếu `balance > 0` và `paid_amount == 0`: Trạng thái `OPEN` ("Chưa thanh toán").
4. **Hủy chứng từ đã ghi sổ (AF-AP-ADJ-05)**:
   - Tạo bút toán đảo nguyên tắc SWAP nợ/có của bút toán gốc.
   - Khôi phục `balance` và `adjustment_amount` của Payable.
   - Chuyển chứng từ sang `CANCELLED`, lưu lý do hủy và vết người hủy.

---

## 2. Cấu trúc Mô hình Dữ liệu

### 2.1. Bảng Bộ đếm `ap_payable_adjustment_counter`
Quản lý dải số chứng từ điều chỉnh độc lập theo pháp nhân (`company`) và năm hạch toán (`year`).

```sql
CREATE TABLE ap_payable_adjustment_counter (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES organization_company(id),
    year INTEGER NOT NULL,
    value INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_ap_adjustment_counter UNIQUE (company_id, year)
);
```

### 2.2. Bảng Chứng từ Điều chỉnh `ap_payable_adjustment_voucher`

```sql
CREATE TABLE ap_payable_adjustment_voucher (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES organization_company(id),
    number VARCHAR(30) NOT NULL,
    supplier_id UUID NOT NULL REFERENCES master_data_party(id),
    payable_id UUID NOT NULL REFERENCES ap_payable(id),
    adjustment_date DATE NOT NULL,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('INCREASE', 'DECREASE')),
    reason VARCHAR(30) NOT NULL CHECK (reason IN ('RECONCILIATION', 'OPENING_BALANCE', 'ROUNDING', 'OTHER')),
    reason_detail VARCHAR(500) NOT NULL DEFAULT '',
    basis VARCHAR(255) NOT NULL,
    description VARCHAR(500) NOT NULL,
    amount NUMERIC(20, 4) NOT NULL CHECK (amount > 0),
    counter_account_id UUID NOT NULL REFERENCES gl_account(id),
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    balance_before NUMERIC(20, 4) NOT NULL CHECK (balance_before >= 0),
    balance_after NUMERIC(20, 4) NOT NULL CHECK (balance_after >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'CANCELLED')),
    journal_entry_id UUID NOT NULL UNIQUE REFERENCES gl_journal_entry(id),
    reversal_journal_entry_id UUID UNIQUE REFERENCES gl_journal_entry(id),
    created_by_id UUID NOT NULL REFERENCES iam_useraccount(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_by_id UUID REFERENCES iam_useraccount(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason VARCHAR(500) NOT NULL DEFAULT '',
    CONSTRAINT uq_ap_adjustment_voucher_number UNIQUE (company_id, number)
);
```

---

## 3. Ánh xạ Kịch bản Nghiệp vụ

### 3.1. Activity Flow (Bước 1 - 33)

| Bước | Actor | Hệ thống Backend | Xử lý Kỹ thuật |
| :---: | :--- | :--- | :--- |
| **1** | Mở menu Điều chỉnh công nợ | Kiểm tra quyền xem danh sách | Endpoint `GET /api/v1/accounts-payable/adjustment-vouchers/` yêu cầu `AP.ADJUSTMENT_VOUCHER.VIEW`. |
| **2** | Chọn Thêm mới | Mở màn hình tạo mới, không sinh dữ liệu trước | Client gọi `eligible-accounts` và `eligible-payables`. |
| **3** | Chọn Nhà cung cấp | Tải danh sách chứng từ công nợ đã ghi sổ | API `eligible_payables` lọc theo `company` và `supplier_id`. |
| **4** | Chọn Loại điều chỉnh | Phân nhánh `INCREASE` / `DECREASE` | Lọc lại chứng từ công nợ theo quy định bước 5. |
| **5** | — | Lọc danh sách công nợ theo loại | `INCREASE`: bao gồm cả `balance == 0` (đã thanh toán).<br>`DECREASE`: chỉ tải khoản có `balance > 0`. |
| **6** | Chọn Chứng từ công nợ | Hiển thị thông tin công nợ chi tiết | Trả về: `number`, `posting_date`, `invoice_number`, `supplier_name`, `original_amount`, `increase_amount`, `decrease_amount`, `paid_amount`, `balance`. |
| **7** | Nhập Ngày điều chỉnh | Mặc định ngày hiện tại | Kiểm tra định dạng ISO-8601 YYYY-MM-DD. |
| **8** | Chọn Lý do điều chỉnh | Cung cấp 4 danh mục lý do chuẩn hóa | `RECONCILIATION`, `OPENING_BALANCE`, `ROUNDING`, `OTHER`. |
| **9** | Nhập Chi tiết lý do (nếu `OTHER`) | Kiểm tra bắt buộc khi chọn `OTHER` | Validate `reason_detail` không rỗng và tối đa 500 ký tự (EX-07). |
| **10** | Nhập Căn cứ điều chỉnh | Biên bản, văn bản thỏa thuận | Validate `basis` không rỗng và tối đa 255 ký tự (EX-08). |
| **11** | Nhập Số tiền điều chỉnh | Kiểm tra số dương | Validate `amount > 0` và có tối đa 4 chữ số thập phân (EX-09). |
| **12** | Chọn Tài khoản đối ứng | Lọc tài khoản hoạt động khác 331 | Endpoint `eligible-accounts` loại bỏ `code.startswith("331")`. |
| **13** | Nhập Diễn giải | Mặc định `{Loại} công nợ chứng từ {Số}` | Cho phép chỉnh sửa, tối đa 500 ký tự (EX-12). |
| **14** | Đính kèm tệp | Tối đa 20 tệp, 10MB/tệp, định dạng PDF/Ảnh | Kiểm tra đuôi `.pdf`, `.png`, `.jpg`, `.jpeg` (EX-19). |
| **15** | — | Tính trước `balance_after` hiển thị UI | Tăng: `balance + amount`; Giảm: `balance - amount`. |
| **16** | Bấm `Ghi sổ` | Xác thực bắt buộc toàn bộ thông tin | Kiểm tra tất cả các trường bắt buộc (EX-02..EX-12). |
| **17** | — | Kiểm tra chi tiết lý do | Nếu lý do là `OTHER` thì bắt buộc `reason_detail`. |
| **18** | — | Kiểm tra ngày điều chỉnh vs ngày công nợ | `adjustment_date >= posting_date` (EX-13). |
| **19** | — | Kiểm tra ngày hiện tại & kỳ kế toán | `adjustment_date <= today` và kỳ kế toán `OPEN` (EX-14, EX-15). |
| **20** | — | Kiểm tra số tiền lớn hơn 0 | `amount > 0` (EX-09). |
| **21** | — | Kiểm tra hạn mức điều chỉnh giảm | `kind == DECREASE ==> amount <= balance` (EX-16). |
| **22** | — | Kiểm tra trạng thái tài khoản đối ứng | `status == ACTIVE and is_postable == True` (EX-17). |
| **23** | — | Khóa bi quan chứng từ công nợ | `_lock(Payable.objects).get(...)` (`select_for_update`). |
| **24** | — | Tính lại số dư còn phải trả tại thời điểm ghi sổ | Đảm bảo concurrency an toàn chống xung đột. |
| **25** | — | Kiểm tra lại giới hạn điều chỉnh giảm | So khớp `expected_balance == payable.balance` (EX-18). |
| **26** | — | Khóa và tăng bộ đếm số chứng từ | `_lock(PayableAdjustmentCounter.objects)` theo company & year. |
| **27** | — | Sinh mã chứng từ theo chuẩn | Sinh mã định dạng `DCPT-YYYY-NNNNNN` (BR-19). |
| **28** | — | Tạo bản ghi chứng từ ở trạng thái POSTED | Lưu bản ghi `PayableAdjustmentVoucher(status="POSTED")`. |
| **29A**| — | Tạo bút toán điều chỉnh tăng | **Nợ TK Đối ứng / Có TK 331** bằng `amount`. |
| **29B**| — | Tạo bút toán điều chỉnh giảm | **Nợ TK 331 / Có TK Đối ứng** bằng `amount`. |
| **30** | — | Cập nhật phát sinh chứng từ công nợ | `payable.adjustment_amount += delta` (dương nếu tăng, âm nếu giảm). |
| **31** | — | Cập nhật số dư và trạng thái thanh toán | Cập nhật `balance` và trạng thái `PAID`, `PARTIALLY_PAID`, hoặc `OPEN`. |
| **32** | — | Ghi Audit Log toàn diện | Ghi vết hành động `ADJUSTMENT_POST` với snapshot trước/sau. |
| **33** | — | Trả về thông báo thành công | Response HTTP 201 với `message` và chi tiết chứng từ. |

### 3.2. Alternative Flows (Luồng thay thế)

- **AF-AP-ADJ-01: Điều chỉnh tăng**  
  Cộng tiền vào công nợ; bút toán: **Nợ TK Đối ứng / Có TK 331**.
- **AF-AP-ADJ-02: Điều chỉnh giảm một phần**  
  Trừ tiền khỏi công nợ; bút toán: **Nợ TK 331 / Có TK Đối ứng**. Nếu còn nợ và đã từng thanh toán thì trạng thái là `PARTIALLY_PAID`, nếu chưa từng thanh toán thì là `OPEN`.
- **AF-AP-ADJ-03: Điều chỉnh giảm toàn bộ**  
  Nếu `balance_after == 0`, chuyển trạng thái chứng từ công nợ thành `PAID` ("Đã thanh toán").
- **AF-AP-ADJ-04: Điều chỉnh tăng chứng từ đã thanh toán**  
  Chứng từ công nợ đã `PAID` được mở lại số dư `balance > 0`. Do đã có khoản thanh toán trước đó (`paid_amount > 0`), trạng thái chuyển thành `PARTIALLY_PAID`.
- **AF-AP-ADJ-05: Hủy chứng từ đã ghi sổ**  
  User có quyền hủy gửi yêu cầu kèm lý do. Hệ thống tạo bút toán đảo nguyên tắc SWAP Nợ/Có, khôi phục `balance` và `adjustment_amount` của Payable, chuyển chứng từ thành `CANCELLED`.
- **AF-AP-ADJ-06: Thoát trước khi ghi sổ**  
  Không lưu chứng từ và không làm thay đổi dữ liệu công nợ.

---

## 4. Ma trận Ngoại lệ & Kiểm soát Rủi ro (EX-01 đến EX-20)

| Mã ngoại lệ | Bước | Điều kiện kích hoạt | Thông báo lỗi tiếng Việt chuẩn xác | HTTP |
| :--- | :---: | :--- | :--- | :---: |
| **EX-AP-ADJ-01** | 2 | User không có quyền tạo điều chỉnh | `Bạn không có quyền điều chỉnh công nợ phải trả.` | 403 |
| **EX-AP-ADJ-02** | 3 | Không truyền hoặc trống Nhà cung cấp | `Vui lòng chọn Nhà cung cấp.` | 400 |
| **EX-AP-ADJ-03** | 4 | Không chọn Loại điều chỉnh (INCREASE/DECREASE) | `Vui lòng chọn Loại điều chỉnh.` | 400 |
| **EX-AP-ADJ-04** | 6 | Không chọn Chứng từ công nợ cần điều chỉnh | `Vui lòng chọn Chứng từ công nợ cần điều chỉnh.` | 400 |
| **EX-AP-ADJ-05** | 7 | Chưa nhập Ngày điều chỉnh | `Vui lòng nhập Ngày điều chỉnh.` | 400 |
| **EX-AP-ADJ-06** | 8 | Chưa chọn Lý do điều chỉnh | `Vui lòng chọn Lý do điều chỉnh.` | 400 |
| **EX-AP-ADJ-07** | 9 | Chọn `Lý do khác` nhưng để trống chi tiết | `Vui lòng nhập Chi tiết lý do điều chỉnh.` | 400 |
| **EX-AP-ADJ-08** | 10 | Chưa nhập Căn cứ điều chỉnh | `Vui lòng nhập Căn cứ điều chỉnh.` | 400 |
| **EX-AP-ADJ-09** | 11 | Số tiền trống, <= 0 hoặc không phải số hợp lệ | `Số tiền điều chỉnh phải lớn hơn 0.` | 400 |
| **EX-AP-ADJ-10** | 12 | Chưa chọn Tài khoản đối ứng | `Vui lòng chọn Tài khoản đối ứng.` | 400 |
| **EX-AP-ADJ-11** | 12 | Chọn tài khoản 331 làm tài khoản đối ứng | `Tài khoản đối ứng phải khác tài khoản công nợ 331.` | 400 |
| **EX-AP-ADJ-12** | 13 | Diễn giải truyền chuỗi rỗng | `Vui lòng nhập Diễn giải.` | 400 |
| **EX-AP-ADJ-13** | 18 | Ngày điều chỉnh nhỏ hơn ngày chứng từ công nợ | `Ngày điều chỉnh không được nhỏ hơn ngày hạch toán của chứng từ công nợ.` | 400 |
| **EX-AP-ADJ-14** | 19 | Ngày điều chỉnh lớn hơn ngày hiện tại | `Ngày điều chỉnh không được lớn hơn ngày hiện tại.` | 400 |
| **EX-AP-ADJ-15** | 19 | Kỳ kế toán của ngày điều chỉnh đã bị khóa | `Kỳ kế toán của ngày điều chỉnh đã bị khóa.` | 400 |
| **EX-AP-ADJ-16** | 21 | Số tiền điều chỉnh giảm vượt số tiền còn nợ | `Số tiền điều chỉnh giảm không được vượt số tiền còn phải trả là {Số tiền}.` | 400 |
| **EX-AP-ADJ-17** | 22 | Tài khoản đối ứng INACTIVE hoặc không cho hạch toán | `Tài khoản đối ứng đã ngừng hoạt động hoặc không cho phép hạch toán.` | 400 |
| **EX-AP-ADJ-18** | 24 | Số dư công nợ thay đổi do giao dịch đồng thời | `Số tiền công nợ đã thay đổi. Vui lòng tải lại dữ liệu.` | 400 |
| **EX-AP-ADJ-19** | 14 | Tệp đính kèm sai đuôi hoặc vượt quá 10MB | `Tệp {Tên tệp} không đúng định dạng hoặc vượt quá dung lượng 10 MB.` | 400 |
| **EX-AP-ADJ-20** | 28–31| Lỗi kỹ thuật hoặc ngắt kết nối cơ sở dữ liệu | `Không thể ghi sổ chứng từ điều chỉnh. Dữ liệu công nợ chưa được thay đổi.` | 500/400 |

---

## 5. Danh mục Quy tắc Nghiệp vụ (BR-01 đến BR-27)

| Mã quy tắc | Nội dung quy định |
| :--- | :--- |
| **BR-AP-ADJ-01** | Loại điều chỉnh gồm `Điều chỉnh tăng` (`INCREASE`) và `Điều chỉnh giảm` (`DECREASE`). |
| **BR-AP-ADJ-02** | Lý do điều chỉnh gồm `Chênh lệch đối chiếu`, `Điều chỉnh số dư đầu kỳ`, `Chênh lệch làm tròn`, `Lý do khác`. |
| **BR-AP-ADJ-03** | Khi chọn `Lý do khác`, bắt buộc nhập Chi tiết lý do (tối đa 500 ký tự). |
| **BR-AP-ADJ-04** | Nhà cung cấp: Phải chọn một nhà cung cấp còn hoạt động. |
| **BR-AP-ADJ-05** | Loại điều chỉnh: Bắt buộc chọn một trong hai giá trị. |
| **BR-AP-ADJ-06** | Chứng từ công nợ: Phải đã ghi sổ (`POSTED`) và chưa bị hủy. |
| **BR-AP-ADJ-07** | Ngày điều chỉnh: Không nhỏ hơn ngày hạch toán công nợ; không lớn hơn ngày hiện tại; thuộc kỳ kế toán mở. |
| **BR-AP-ADJ-08** | Lý do điều chỉnh: Phải chọn trong danh mục hợp lệ. |
| **BR-AP-ADJ-09** | Căn cứ điều chỉnh: Bắt buộc nhập, tối đa 255 ký tự. |
| **BR-AP-ADJ-10** | Số tiền điều chỉnh: Phải lớn hơn 0, định dạng số thập phân tối đa 4 chữ số. |
| **BR-AP-ADJ-11** | Tài khoản đối ứng: Đang hoạt động (`ACTIVE`), cho phép hạch toán (`is_postable=True`) và khác 331. |
| **BR-AP-ADJ-12** | Diễn giải: Bắt buộc nhập hoặc lấy mặc định chuẩn hóa, tối đa 500 ký tự. |
| **BR-AP-ADJ-13** | Công thức: `Còn phải trả sau điều chỉnh tăng = Còn phải trả trước điều chỉnh + Số tiền điều chỉnh`. |
| **BR-AP-ADJ-14** | Công thức: `Còn phải trả sau điều chỉnh giảm = Còn phải trả trước điều chỉnh − Số tiền điều chỉnh`. |
| **BR-AP-ADJ-15** | Điều chỉnh giảm không được làm số tiền còn phải trả nhỏ hơn 0. |
| **BR-AP-ADJ-16** | Nếu còn phải trả bằng 0, trạng thái công nợ là `Đã thanh toán` (`PAID`). |
| **BR-AP-ADJ-17** | Nếu còn phải trả lớn hơn 0 và đã thanh toán một phần (`paid_amount > 0`), trạng thái là `Đã thanh toán một phần` (`PARTIALLY_PAID`). |
| **BR-AP-ADJ-18** | Nếu còn phải trả lớn hơn 0 và chưa thanh toán (`paid_amount == 0`), trạng thái là `Chưa thanh toán` (`OPEN`). |
| **BR-AP-ADJ-19** | Số chứng từ có cấu trúc `DCPT-YYYY-NNNNNN` (ví dụ `DCPT-2026-000001`). |
| **BR-AP-ADJ-20** | `YYYY` là năm của Ngày điều chỉnh; `NNNNNN` là số thứ tự 6 chữ số tự động tăng. |
| **BR-AP-ADJ-21** | Bộ đếm quản lý riêng theo doanh nghiệp và năm; bắt đầu từ `000001` vào ngày 01/01 hàng năm. |
| **BR-AP-ADJ-22** | Số đã cấp không được tái sử dụng kể cả khi chứng từ bị hủy. |
| **BR-AP-ADJ-23** | Khóa bộ đếm bi quan (`select_for_update`) khi cấp số để tránh trùng lặp trong môi trường đồng thời. |
| **BR-AP-ADJ-24** | Hạch toán tự động vào Sổ cái GL: Tăng ghi Nợ TK đối ứng / Có TK 331; Giảm ghi Nợ TK 331 / Có TK đối ứng. |
| **BR-AP-ADJ-25** | Giảm công nợ do trả lại hàng hoặc giảm giá hàng mua phải thực hiện ở use case tương ứng, không dùng chứng từ này. |
| **BR-AP-ADJ-26** | Thay đổi thuế GTGT phải thực hiện bằng điều chỉnh hóa đơn đầu vào, không dùng chứng từ này. |
| **BR-AP-ADJ-27** | Tạo chứng từ, tạo bút toán và cập nhật công nợ thực thi trong cùng giao dịch cơ sở dữ liệu (`transaction.atomic`). |

---

## 6. Đặc tả Kỹ thuật API Endpoints

### 6.1. Danh sách Chứng từ Điều chỉnh
- **Endpoint**: `GET /api/v1/accounts-payable/adjustment-vouchers/?company_id={company_id}`
- **Quyền yêu cầu**: `AP.ADJUSTMENT_VOUCHER.VIEW`
- **Bộ lọc hỗ trợ**: `supplier_id`, `status` (`POSTED`, `CANCELLED`).

### 6.2. Lấy Danh sách Tài khoản Đối ứng Hợp lệ
- **Endpoint**: `GET /api/v1/accounts-payable/adjustment-vouchers/eligible-accounts/?company_id={company_id}`
- **Quyền yêu cầu**: `AP.ADJUSTMENT_VOUCHER.VIEW`
- **Quy tắc lọc**: Loại bỏ tất cả tài khoản bắt đầu bằng `331`.

### 6.3. Lấy Danh sách Chứng từ Công nợ Hợp lệ
- **Endpoint**: `GET /api/v1/accounts-payable/adjustment-vouchers/eligible-payables/?company_id={company_id}&supplier_id={supplier_id}&kind={INCREASE|DECREASE}`
- **Quyền yêu cầu**: `AP.ADJUSTMENT_VOUCHER.VIEW`
- **Phản hồi mẫu**:
```json
[
  {
    "id": "e4b6005c-dfbc-4735-a1c2-3eefc6f96cfb",
    "number": "AP-DOC-2026-0001",
    "invoice_number": "AP07-001",
    "document_date": "2026-10-12",
    "posting_date": "2026-10-12",
    "due_date": "2026-10-25",
    "supplier_id": "c138848a-6b58-45b1-bb96-6df7d17300f8",
    "supplier_name": "Công ty TNHH Cung ứng Công nghiệp",
    "currency": "26d7f0fa-3e4b-4b13-a44d-45dbfaea4d40",
    "original_amount": "100000000.0000",
    "increase_amount": "0.0000",
    "decrease_amount": "0.0000",
    "paid_amount": "0.0000",
    "balance": "100000000.0000"
  }
]
```

### 6.4. Tạo và Ghi sổ Chứng từ Điều chỉnh
- **Endpoint**: `POST /api/v1/accounts-payable/adjustment-vouchers/`
- **Quyền yêu cầu**: `AP.ADJUSTMENT_VOUCHER.CREATE`
- **Yêu cầu (Payload)**:
```json
{
  "company": "f516a578-8fc8-4065-9b2f-7f8a7e00994f",
  "supplier": "c138848a-6b58-45b1-bb96-6df7d17300f8",
  "payable": "e4b6005c-dfbc-4735-a1c2-3eefc6f96cfb",
  "kind": "INCREASE",
  "adjustment_date": "2026-10-12",
  "reason": "RECONCILIATION",
  "basis": "Biên bản đối chiếu công nợ quý 3/2026 số BB-098",
  "amount": "25000000.0000",
  "counter_account": "a7940e72-246e-4e42-be52-6a6c429bbad6",
  "description": "Điều chỉnh tăng công nợ chứng từ AP-DOC-2026-0001",
  "expected_balance": "100000000.0000",
  "attachments": [
    {
      "name": "bien_ban_doi_chieu.pdf",
      "size": 1542000
    }
  ]
}
```
- **Phản hồi thành công (HTTP 201 Created)**:
```json
{
  "id": "78b7e28c-0975-4001-92b8-9ee2db64f02a",
  "number": "DCPT-2026-000001",
  "supplier": "c138848a-6b58-45b1-bb96-6df7d17300f8",
  "supplier_name": "Công ty TNHH Cung ứng Công nghiệp",
  "supplier_code": "NCC-CN01",
  "payable": "e4b6005c-dfbc-4735-a1c2-3eefc6f96cfb",
  "payable_number": "AP-DOC-2026-0001",
  "adjustment_date": "2026-10-12",
  "kind": "INCREASE",
  "reason": "RECONCILIATION",
  "reason_detail": "",
  "basis": "Biên bản đối chiếu công nợ quý 3/2026 số BB-098",
  "description": "Điều chỉnh tăng công nợ chứng từ AP-DOC-2026-0001",
  "amount": "25000000.0000",
  "counter_account": "a7940e72-246e-4e42-be52-6a6c429bbad6",
  "counter_account_code": "642",
  "counter_account_name": "Chi phí quản lý doanh nghiệp",
  "balance_before": "100000000.0000",
  "balance_after": "125000000.0000",
  "status": "POSTED",
  "journal_entry": "cb9c4f74-329b-449d-b4f0-ecb88a9ebfe0",
  "journal_entry_number": "GL-DCPT-2026-000001",
  "reversal_journal_entry": null,
  "reversal_journal_entry_number": "",
  "message": "Ghi sổ điều chỉnh công nợ thành công. Số chứng từ: DCPT-2026-000001."
}
```

### 6.5. Hủy Chứng từ Điều chỉnh đã Ghi sổ
- **Endpoint**: `POST /api/v1/accounts-payable/adjustment-vouchers/{id}/cancel/`
- **Quyền yêu cầu**: `AP.ADJUSTMENT_VOUCHER.CANCEL`
- **Yêu cầu (Payload)**:
```json
{
  "reason": "Phát hiện sai sót số liệu biên bản đối chiếu"
}
```
- **Phản hồi thành công (HTTP 200 OK)**:
```json
{
  "id": "78b7e28c-0975-4001-92b8-9ee2db64f02a",
  "number": "DCPT-2026-000001",
  "status": "CANCELLED",
  "cancel_reason": "Phát hiện sai sót số liệu biên bản đối chiếu",
  "reversal_journal_entry_number": "GL-REV-DCPT-2026-000001",
  "message": "Hủy chứng từ điều chỉnh công nợ thành công. Số chứng từ: DCPT-2026-000001."
}
```

---

## 7. Báo cáo Kết quả Kiểm thử Tự động

Kiểm thử được thực hiện bằng Django Test Runner với bộ kiểm thử chuyên biệt [accounts_payable/test_payable_adjustment_uc_ap_07.py](file:///c:/Users/Admin/LapTrinh/Thue/accounts_payable/test_payable_adjustment_uc_ap_07.py):

| Tên Test Case | Mục tiêu & Luồng kiểm tra | Kết quả |
| :--- | :--- | :---: |
| `test_increase_and_cancel_post_reverse_journal` | Vòng đời điều chỉnh tăng, kiểm tra định khoản Nợ 642/Có 331, hủy sinh bút toán đảo Nợ 331/Có 642. | **PASS** |
| `test_decrease_full_then_increase_reopens_paid_debt` | Điều chỉnh giảm 100% công nợ thành PAID; điều chỉnh tăng sau đó mở lại chứng từ về OPEN. | **PASS** |
| `test_partial_decrease_and_partially_paid_status` | Điều chỉnh giảm một phần, kiểm tra chuyển đổi trạng thái `OPEN` vs `PARTIALLY_PAID`. | **PASS** |
| `test_increase_reopens_paid_payment_and_cancel_keeps_number_used` | Điều chỉnh tăng chứng từ đã có thanh toán (`paid_amount > 0`); kiểm tra không tái sử dụng số chứng từ khi hủy. | **PASS** |
| `test_all_validation_exceptions_ex02_to_ex19` | Kiểm tra toàn bộ các thông báo ngoại lệ chuẩn hóa từ EX-02 đến EX-19 và tính nguyên tử khi lỗi. | **PASS** |
| `test_cancel_validation_and_idempotency` | Kiểm tra bắt buộc lý do hủy, độ dài tối đa 500 ký tự và ngăn chặn hủy lặp lại nhiều lần. | **PASS** |
| `test_cancel_blocked_when_balance_insufficient` | Ngăn chặn hủy điều chỉnh tăng nếu số dư công nợ sau đó đã bị thanh toán xuống thấp hơn số tiền điều chỉnh. | **PASS** |
| `test_eligible_payables_and_accounts_endpoints` | Kiểm tra lọc tài khoản đối ứng (loại 331) và lọc danh sách công nợ theo `INCREASE`/`DECREASE`. | **PASS** |
| `test_unposted_source_is_not_eligible` | Chứng từ mua hàng / hóa đơn chưa ghi sổ không đủ điều kiện điều chỉnh. | **PASS** |
| `test_rbac_permissions_ex01` | Phân quyền IAM chi tiết: kiểm tra mã lỗi HTTP 403 cho các thao tác xem, tạo và hủy. | **PASS** |

**Tổng kết:** `Ran 10 tests in 5.886s. OK.`
