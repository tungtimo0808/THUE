# UI FUNCTIONAL ARCHITECTURE – ERP KẾ TOÁN & THUẾ
## V5 — Audit chuyên sâu Module Tab / Inner Tab / Document Tab
## Master Frontend Structure – tham chiếu AMIS Kế toán 2026 + Thông tư 99/2025/TT-BTC

**Phiên bản:** 5.0 — Nested Tabs Audited – Detailed UI/Function Map  
**Mục đích:** Làm tài liệu master để thiết kế Frontend/Wireframe/Prototype trước khi đặc tả API và database.  
**Phạm vi:** Mô tả đầy đủ cây giao diện, màn hình, tab, panel, nút, menu con, chức năng nhỏ bên trong từng khu vực và quan hệ điều hướng giữa các màn hình.  
**Không đi vào ở bản này:** font chữ, kích thước pixel, màu sắc, spacing, framework frontend, API contract, database schema, công thức hạch toán chi tiết, validation backend cấp field.

---


# 0A. TAB HIERARCHY MASTER — BẢN AUDIT CHUYÊN SÂU TAB CON

> **Mục này là nguồn chuẩn cao nhất về cấu trúc tab trong tài liệu V5.**  
> Nếu các cây đơn giản ở phần dưới có khác với mục này, ưu tiên mục `0A`.
>
> Lý do bổ sung: audit lại giao diện AMIS cho thấy nhiều chức năng không nằm cùng cấp. Một phân hệ có thể có:
>
> `Sidebar module → Module tab → Inner tab → Document tab → View/Mode → Action`.
>
> Không được đưa tất cả các chức năng lên cùng một hàng tab.

## 0A.1. Quy tắc phân loại

```text
LEVEL 1  SIDEBAR MODULE
LEVEL 2  MODULE TAB               ← hàng tab ngang ngay dưới header
LEVEL 3  INNER TAB                ← tab con bên trong một module tab
LEVEL 4  DOCUMENT TAB             ← tab bên trong form/chứng từ
LEVEL 5  VIEW / MODE              ← chế độ xem, không nhất thiết là tab nghiệp vụ
LEVEL 6  ACTION                   ← nút/menu, tuyệt đối không coi là tab
```

Ví dụ đúng:

```text
Công cụ dụng cụ                    [LEVEL 1]
└─ Chi phí trả trước               [LEVEL 2]
   ├─ Danh sách chi phí trả trước  [LEVEL 3]
   ├─ Phân bổ chi phí trả trước    [LEVEL 3]
   └─ Ghi giảm                     [LEVEL 3]
```

Ví dụ sai:

```text
Công cụ dụng cụ
├─ Ghi tăng
├─ Phân bổ
├─ Điều chuyển
├─ Chi phí trả trước
└─ Ghi giảm
```

vì đã làm phẳng các chức năng thuộc nhiều cấp khác nhau.

---

# 0B. CÔNG CỤ DỤNG CỤ — CẤU TRÚC TAB ĐÃ XÁC MINH

## 0B.1. LEVEL 2 — Module tabs

Từ ảnh giao diện AMIS thực tế do người dùng cung cấp:

```text
CÔNG CỤ DỤNG CỤ
├─ Quy trình
├─ Sổ theo dõi công cụ dụng cụ
├─ Quản lý công cụ dụng cụ
├─ Chi phí trả trước
└─ Báo cáo
```

## 0B.2. `Sổ theo dõi công cụ dụng cụ` → LEVEL 3

```text
SỔ THEO DÕI CÔNG CỤ DỤNG CỤ
├─ Theo công cụ dụng cụ
└─ Theo đơn vị sử dụng
```

Khi mở một CCDC ở view `Theo công cụ dụng cụ`, phần chi tiết còn có:

```text
CHI TIẾT CCDC
├─ Thông tin CCDC / đơn vị sử dụng
└─ Nguồn gốc hình thành
```

`Nguồn gốc hình thành` cho phép truy ngược các chứng từ ghi tăng, ghi giảm, điều chuyển, phân bổ...

## 0B.3. `Quản lý công cụ dụng cụ` → LEVEL 3

```text
QUẢN LÝ CÔNG CỤ DỤNG CỤ
├─ Ghi tăng
├─ Phân bổ chi phí
├─ Điều chỉnh
├─ Điều chuyển
├─ Ghi giảm
└─ Kiểm kê
```

### `Ghi tăng` → LEVEL 4 trong chứng từ

```text
GHI TĂNG CCDC
├─ Đơn vị sử dụng
├─ Thiết lập phân bổ
├─ Mô tả chi tiết
└─ Nguồn gốc hình thành
```

`Thông tin chung` nằm phía trên form, không coi là tab.

### `Phân bổ chi phí` → LEVEL 4 trong chứng từ

```text
PHÂN BỔ CHI PHÍ CCDC
├─ Xác định mức chi phí
├─ Phân bổ
└─ Hạch toán
```

Đây là tên tab đã xác minh từ Help AMIS.

### `Kiểm kê` → LEVEL 4

```text
KIỂM KÊ CCDC
├─ Công cụ dụng cụ
├─ Thành viên tham gia
└─ Kết quả xử lý
```

### `Điều chỉnh`

Chưa thấy Help chính thức xác nhận thêm nhiều tab con cố định.  
Frontend chỉ nên dựng phần thông tin điều chỉnh + bảng CCDC + hạch toán khi đặc tả screen chi tiết, không tự tạo tab nếu chưa có căn cứ.

### `Điều chuyển`

Chưa xác minh có hàng tab con cố định.  
Giữ một document workspace với danh sách CCDC điều chuyển và thông tin đơn vị cũ/mới.

### `Ghi giảm`

Chưa xác minh có nhiều tab con cố định.  
Giữ document workspace, chỉ bổ sung tab khi có ảnh/Help xác nhận.

## 0B.4. `Chi phí trả trước` → LEVEL 3

Từ ảnh AMIS thực tế:

```text
CHI PHÍ TRẢ TRƯỚC
├─ Danh sách chi phí trả trước
├─ Phân bổ chi phí trả trước
└─ Ghi giảm
```

### `Danh sách chi phí trả trước` → form chi tiết LEVEL 4

Khi thêm/mở một CPTT:

```text
CHI PHÍ TRẢ TRƯỚC
├─ Thiết lập phân bổ
└─ Tập hợp chứng từ
```

`Thông tin chung` nằm trên form, không phải tab.

### `Phân bổ chi phí trả trước` → LEVEL 4

Help AMIS xác minh tối thiểu:

```text
PHÂN BỔ CPTT
├─ Phân bổ
└─ Hạch toán
```

Phần xác định các khoản CPTT cần phân bổ xuất hiện trước/đồng thời trong chứng từ; nếu UI build hiện tại thể hiện thành tab riêng thì dùng tên trên UI thực tế. Không tự đặt tên tab nếu chưa có ảnh xác minh.

### `Ghi giảm`

Đây là inner tab riêng ở UI 2026.  
Màn hình chi tiết ghi giảm cần giữ riêng với `Phân bổ CPTT`, không gộp thành một action trong danh sách.

## 0B.5. `Báo cáo` → nhóm con

```text
BÁO CÁO
├─ Báo cáo Công cụ dụng cụ
├─ Báo cáo Chi phí trả trước
└─ Báo cáo đối chiếu
```

Các report con đã xác minh gồm:

```text
Báo cáo CCDC
├─ Bảng tính phân bổ công cụ dụng cụ
├─ Sổ theo dõi công cụ dụng cụ
├─ Bảng tính phân bổ công cụ dụng cụ theo năm
├─ Báo cáo chi tiết giảm công cụ dụng cụ
└─ Sổ theo dõi công cụ dụng cụ theo đơn vị sử dụng

Báo cáo CPTT
├─ Tình hình phân bổ chi phí trả trước
├─ Bảng tính phân bổ chi phí trả trước
└─ Tình hình phân bổ chi phí trả trước theo năm

Báo cáo đối chiếu
└─ Đối chiếu CCDC/CPTT với Sổ cái
```

---

# 0C. TÀI SẢN CỐ ĐỊNH — AUDIT TAB CON

## 0C.1. LEVEL 2 — Module tabs

Các workspace nghiệp vụ đã xác minh:

```text
TÀI SẢN CỐ ĐỊNH
├─ Sổ tài sản
├─ Ghi tăng
├─ Đánh giá lại
├─ Tính khấu hao
├─ Điều chuyển
├─ Ghi giảm
├─ Kiểm kê
└─ Chuyển TSCĐ thuê tài chính thành TSCĐ sở hữu [khi sử dụng]
```

`Báo cáo TSCĐ` có thể truy cập từ Report Center; không mặc định coi `Báo cáo` là tab ngang của TSCĐ nếu UI thực tế không hiển thị.

## 0C.2. `Ghi tăng` → LEVEL 4

Help AMIS xác minh:

```text
GHI TĂNG TSCĐ
├─ Thông tin khấu hao
├─ Thiết lập phân bổ
├─ Nguồn gốc hình thành
├─ Bộ phận cấu thành / Dụng cụ, phụ tùng kèm theo
└─ Thông tin khác
```

`Thông tin chung` là khu phía trên, không phải tab.

## 0C.3. `Đánh giá lại` → LEVEL 4

```text
ĐÁNH GIÁ LẠI TSCĐ
├─ Chi tiết điều chỉnh
└─ Hạch toán
```

## 0C.4. `Tính khấu hao` → LEVEL 4

```text
TÍNH KHẤU HAO
├─ Tính khấu hao
├─ Phân bổ
└─ Hạch toán
```

## 0C.5. `Ghi giảm` → LEVEL 4

```text
GHI GIẢM TSCĐ
├─ Tài sản
└─ Hạch toán
```

## 0C.6. `Kiểm kê` → LEVEL 4

Help AMIS xác minh:

```text
KIỂM KÊ TSCĐ
├─ Tài sản cố định cần điều chỉnh
├─ Thành viên tham gia
└─ Kết luận kiểm kê
```

Trong Help, phần kết luận được khai báo sau tab Thành viên; nếu UI thực tế ở phiên bản đang dùng thể hiện nó dưới dạng section thay vì tab thì Frontend phải bám ảnh thật.

## 0C.7. `Điều chuyển`

Không thấy tài liệu chính thức xác nhận hàng tab con cố định.  
Không tự tạo tab `Tài sản/Hạch toán` nếu không có ảnh UI.

---

# 0D. MUA HÀNG — AUDIT TAB CON

## 0D.1. LEVEL 2 — Module tabs

Help AMIS hiện xác minh:

```text
MUA HÀNG
├─ Quy trình
├─ Biểu đồ
├─ Đơn mua hàng
├─ Hợp đồng mua hàng
├─ Mua hàng
├─ Nhận hóa đơn
├─ Xử lý hóa đơn đầu vào
├─ Trả lại hàng mua
├─ Giảm giá hàng mua
└─ Trả tiền theo hóa đơn
```

## 0D.2. `Mua hàng` → loại chứng từ/mode, KHÔNG phải tab ngang

```text
THÊM CHỨNG TỪ MUA HÀNG
├─ Trong nước nhập kho
├─ Trong nước không qua kho
├─ Nhập khẩu nhập kho
├─ Nhập khẩu không qua kho
├─ Mua dịch vụ
└─ Mua hàng nhiều hóa đơn
```

## 0D.3. Chứng từ `Trong nước nhập kho` → LEVEL 4

Trường hợp nhận kèm hóa đơn:

```text
TAB CẤP CHỨNG TỪ
├─ Phiếu nhập
├─ Phiếu chi / Ủy nhiệm chi   [phụ thuộc phương thức thanh toán]
├─ Hóa đơn
└─ Điều khoản thanh toán

TAB CHI TIẾT
├─ Hàng tiền
├─ Thuế
├─ Chi phí
├─ Thông tin bổ sung
└─ Khác
```

Nếu `Không kèm hóa đơn/Không có hóa đơn`, tab `Hóa đơn` không hiển thị.

## 0D.4. `Trong nước không qua kho` → LEVEL 4

```text
TAB CẤP CHỨNG TỪ
├─ Chứng từ ghi nợ / Phiếu chi / Ủy nhiệm chi
└─ Hóa đơn                    [chỉ khi nghiệp vụ có hóa đơn]

TAB CHI TIẾT
├─ Hàng tiền
├─ Thuế
├─ Thống kê
├─ Chi phí
└─ Khác
```

## 0D.5. `Nhập khẩu nhập kho` → LEVEL 4

```text
├─ Phiếu nhập
├─ Chứng từ thanh toán/công nợ
├─ Hóa đơn / thông tin tờ khai nhập khẩu
├─ Hàng tiền
├─ Thuế
├─ Phí trước hải quan
├─ Phí hàng về kho
├─ Thống kê
└─ Thông tin bổ sung
```

## 0D.6. `Nhập khẩu không qua kho` → LEVEL 4

```text
├─ Chứng từ thanh toán/công nợ
├─ Hóa đơn / thông tin tờ khai nhập khẩu
├─ Hàng tiền
├─ Thuế
├─ Phí trước hải quan
├─ Chi phí mua hàng
├─ Thống kê
└─ Thông tin bổ sung
```

## 0D.7. `Mua dịch vụ` → LEVEL 4

Help AMIS xác minh:

```text
MUA DỊCH VỤ
├─ Hạch toán
├─ Thuế
├─ Thống kê
├─ Khác
└─ Thông tin bổ sung
```

Hình thức thanh toán `Chưa thanh toán / Tiền mặt / Ủy nhiệm chi` là mode của chứng từ, không phải module tab.

## 0D.8. `Mua hàng nhiều hóa đơn` → LEVEL 4

Help AMIS xác minh các tab:

```text
MUA HÀNG NHIỀU HÓA ĐƠN
├─ Phiếu nhập
├─ Phiếu chi
├─ Ủy nhiệm chi
├─ Hàng tiền
├─ Thuế
├─ Chi phí
├─ Phí trước hải quan
├─ Phí hàng về kho
├─ Thông tin bổ sung
└─ Thông tin khác
```

Tab xuất hiện phụ thuộc loại chứng từ/phương thức thanh toán.

## 0D.9. `Xử lý hóa đơn đầu vào`

Đây chủ yếu là List/Processing Workspace:

```text
Danh sách hóa đơn
Preview hóa đơn
Trạng thái kiểm tra
Trạng thái lập chứng từ
Chứng từ hạch toán
```

Các chức năng `Lập chứng từ mua hàng / Mua dịch vụ / Phiếu chi / UNC / CTNVK...` là action, không được biến thành tab con.

---

# 0E. BÁN HÀNG — AUDIT TAB CON

## 0E.1. LEVEL 2 — các workspace chức năng

Help AMIS hiện mô tả các chức năng:

```text
BÁN HÀNG
├─ Quy trình
├─ Báo giá
├─ Đơn đặt hàng
├─ Hợp đồng bán hàng
├─ Bán hàng
├─ Hóa đơn
├─ Tự động hạch toán HĐ
├─ Trả lại hàng bán
├─ Giảm giá hàng bán
├─ Phân bổ doanh thu nhận trước
├─ Công nợ
├─ Thu nợ
├─ Khác
└─ Báo cáo
```

`Biểu đồ` có thể xuất hiện ở UI mới/cấu hình; không nên hard-code nếu ảnh dữ liệu hiện tại không có.

## 0E.2. `Chứng từ bán hàng` → LEVEL 4

Với chứng từ có công nợ + kiêm phiếu xuất + lập kèm hóa đơn, Help AMIS xác minh tối thiểu:

```text
CHỨNG TỪ BÁN HÀNG
├─ Chứng từ ghi nợ
├─ Phiếu xuất
├─ Hóa đơn
├─ Hàng tiền
└─ Giá vốn
```

Tùy phương thức thu tiền, `Chứng từ ghi nợ` có thể được thay bằng:

```text
Phiếu thu
hoặc
Thu tiền gửi
```

Nếu không `Kiêm phiếu xuất` → không hiển thị tab `Phiếu xuất`.

Nếu không `Lập kèm hóa đơn` → không hiển thị tab `Hóa đơn`.

Do đó Frontend phải render tab theo cấu hình chứng từ, không dùng một tab set cố định.

## 0E.3. `Hóa đơn`

Hóa đơn độc lập có tối thiểu:

```text
├─ Hàng tiền
└─ Các tab đặc thù theo loại hóa đơn
```

Ví dụ hóa đơn chiết khấu hiện có:

```text
├─ Hàng tiền
└─ Bảng kê hóa đơn liên quan
```

Không dùng một cấu trúc tab duy nhất cho mọi loại hóa đơn.

## 0E.4. `Trả lại hàng bán`

Help cho thấy có `Hàng tiền`; nếu kiêm phiếu nhập/giá vốn thì UI có thêm vùng/tab tương ứng.  
Chưa đủ căn cứ để khẳng định mọi trường hợp đều có cùng tab set.

---

# 0F. KHO — AUDIT TAB CON

## 0F.1. LEVEL 2 — Module tabs

Help AMIS xác minh lõi:

```text
KHO
├─ Quy trình
├─ Nhập kho
├─ Xuất kho
├─ Chuyển kho
├─ Lệnh sản xuất
├─ Lắp ráp, tháo dỡ
└─ Kiểm kê
```

Ảnh AMIS 2026 do người dùng cung cấp còn hiển thị:

```text
Biểu đồ
Báo cáo
Hàng hóa, dịch vụ
```

Vì vậy Frontend nên coi 3 tab này là tab cấu hình/version-specific và cho phép bật/tắt.

## 0F.2. `Lắp ráp, tháo dỡ`

Đây là **một tab cấp 2**, bên trong dùng bộ lọc loại:

```text
Loại:
├─ Lắp ráp
└─ Tháo dỡ
```

Không tách `Lắp ráp` và `Tháo dỡ` thành hai module tab nếu UI AMIS hiện tại gộp.

## 0F.3. `Lệnh sản xuất`

Ảnh thực tế cho thấy:

```text
LIST
↓
QUICK DETAIL
```

Quick Detail hiển thị danh sách thành phẩm, nhưng đây là detail panel, không phải inner tab.

Full lệnh sản xuất có các vùng:

```text
Thông tin lệnh
Thành phẩm
Định mức / NVL
Chứng từ nhập/xuất liên quan
```

Chưa có bằng chứng đủ mạnh rằng bốn vùng này luôn là tab ngang; không nên tự biến chúng thành tab.

## 0F.4. `Kiểm kê`

Là workspace riêng. Tên tab con trong biên bản phải bám UI thực tế; không tái sử dụng máy móc tab kiểm kê CCDC/TSCĐ.

---

# 0G. TÀI SẢN / CCDC SO SÁNH TAB — TRÁNH DÙNG CHUNG SAI

```text
CCDC Ghi tăng:
Đơn vị sử dụng
Thiết lập phân bổ
Mô tả chi tiết
Nguồn gốc hình thành

TSCĐ Ghi tăng:
Thông tin khấu hao
Thiết lập phân bổ
Nguồn gốc hình thành
Bộ phận cấu thành / Dụng cụ, phụ tùng kèm theo
Thông tin khác
```

Hai form nhìn giống nhau nhưng **không dùng cùng tab set**.

---

# 0H. TIỀN MẶT — AUDIT TAB CON

## 0H.1. LEVEL 2

Help AMIS xác minh:

```text
TIỀN MẶT
├─ Quy trình
├─ Thu, chi tiền
├─ Kiểm kê
└─ Dự báo dòng tiền
```

## 0H.2. `Thu, chi tiền`

`Thu tiền` và `Chi tiền` là **nút tạo / nhóm loại chứng từ**, không phải inner tab.

Ví dụ menu Thu:

```text
Thu tiền khách hàng (không theo hóa đơn)
Thu hoàn ứng nhân viên
Rút tiền gửi về nhập quỹ
Thu hồi các khoản cho vay
Thu khác
Thu tiền KH theo hóa đơn
Thu tiền theo hóa đơn nhiều KH
```

## 0H.3. `Chi mua ngoài có hóa đơn` → LEVEL 4

Nếu không hạch toán gộp:

```text
├─ Hạch toán
└─ Kê khai hóa đơn và hạch toán thuế
```

Nếu tích `Hạch toán gộp nhiều hóa đơn`:

```text
├─ Hạch toán
└─ Kê khai hóa đơn
```

Đây là một ví dụ quan trọng: tab con thay đổi theo checkbox/mode ngay trên cùng chứng từ.

---

# 0I. TIỀN GỬI — AUDIT TAB CON

## 0I.1. LEVEL 2

Help AMIS xác minh:

```text
TIỀN GỬI
├─ Quy trình
├─ Thu, chi tiền
├─ Đối chiếu ngân hàng
├─ Dự báo dòng tiền
├─ Ngân hàng điện tử
├─ Khế ước đi vay
├─ Khế ước cho vay
└─ Báo cáo
```

## 0I.2. `Đối chiếu ngân hàng`

Help xác minh 3 **hình thức đối chiếu**:

```text
Đối chiếu online
Đối chiếu offline
Đối chiếu với AVA
```

Cần kiểm tra ảnh UI cụ thể trước khi quyết định render ba mục này thành inner tab, segmented control hay dropdown.  
Trong tài liệu Frontend phải ghi là `MODE`, không mặc định coi là tab.

## 0I.3. `Khế ước đi vay`

Các mục sau là action/detail screen:

```text
Xem tình hình thực hiện
Lập chứng từ nhận giải ngân
Xem lịch trả nợ
Thay đổi lãi suất
Tất toán khoản vay
```

Không đưa chúng thành module tab.

## 0I.4. `Khế ước cho vay`

```text
Xem tình hình thực hiện
Xem lịch thu nợ
```

là action/detail, không phải tab cấp 2.

---

# 0J. TIỀN LƯƠNG — AUDIT TAB CON

## 0J.1. LEVEL 2 khi sử dụng Tiền lương trong AMIS Kế toán

Help AMIS mô tả các workspace:

```text
TIỀN LƯƠNG
├─ Quy trình
├─ Chấm công
├─ Tổng hợp chấm công
├─ Tính lương
├─ Hạch toán chi phí
└─ [Các workspace khác phụ thuộc cấu hình/kết nối]
```

Trong `Quy trình` có các node:

```text
Chấm công
Tổng hợp chấm công
Tính lương
Hạch toán chi phí
Trả lương
Nộp bảo hiểm
```

`Trả lương` và `Nộp bảo hiểm` không được tự động coi là tab ngang nếu UI thực tế đang đặt chúng trong Quy trình.

## 0J.2. Khi kết nối AMIS Tiền lương

Có thêm các workspace dữ liệu nhận từ app ngoài:

```text
Đề nghị hạch toán chi phí lương
Đề nghị chi trả tiền lương
```

Chúng là danh sách nghiệp vụ riêng, không phải tab con của `Tính lương`.

---

# 0K. GIÁ THÀNH — AUDIT TAB CON SÂU

## 0K.1. LEVEL 2 — Phương pháp

Help AMIS xác minh 6 phương pháp:

```text
GIÁ THÀNH
├─ Sản xuất liên tục – Giản đơn
├─ Sản xuất liên tục – Hệ số, tỷ lệ
├─ Sản xuất liên tục – Phân bước
├─ Công trình
├─ Đơn hàng
└─ Hợp đồng
```

## 0K.2. `Giản đơn` → chi tiết một Kỳ tính giá

Khi bấm `Xem` kỳ tính giá, các bảng/tab đã xác minh:

```text
CHI TIẾT KỲ TÍNH GIÁ – GIẢN ĐƠN
├─ Tổng hợp chi phí
├─ Bảng phân bổ chi phí chung
├─ Bảng tính giá thành
├─ Tập hợp chi phí trực tiếp
├─ Tập hợp khoản giảm giá thành
├─ Bảng tập hợp chi phí theo yếu tố
└─ Bảng tập hợp chi phí theo khoản mục
```

## 0K.3. `Hệ số, tỷ lệ` → chi tiết kỳ

```text
├─ Tổng hợp chi phí
├─ Bảng phân bổ chi phí chung
├─ Bảng tính giá thành
├─ Bảng xác định tỷ lệ phân bổ giá thành
├─ Tập hợp chi phí trực tiếp
├─ Tập hợp khoản giảm giá thành
├─ Bảng tập hợp chi phí theo yếu tố
└─ Bảng tập hợp chi phí theo khoản mục
```

## 0K.4. `Công trình`

Trong workspace Công trình, tài liệu xác minh có các màn hình/sub-workspace như:

```text
Kỳ tính giá
Nghiệm thu công trình
Kết chuyển chi phí           [TT200/TT99]
```

Trong chi tiết Kỳ tính giá có:

```text
Tổng hợp chi phí
Bảng phân bổ chi phí chung
Tập hợp chi phí trực tiếp
Tập hợp khoản giảm giá thành
Bảng tập hợp chi phí theo yếu tố
Bảng tập hợp chi phí theo khoản mục
```

`Phân bổ chi phí chung`, `Kết chuyển chi phí`, `Nghiệm thu công trình` có thể là action từ dòng Kỳ tính giá hoặc inner workspace tùy phiên bản; không hard-code cùng một kiểu.

## 0K.5. `Đơn hàng`

Tương tự:

```text
Kỳ tính giá
Nghiệm thu đơn hàng
Kết chuyển chi phí [nếu chế độ kế toán áp dụng]
```

Chi tiết kỳ:

```text
Tổng hợp chi phí
Bảng phân bổ chi phí chung
Tập hợp chi phí trực tiếp
Tập hợp khoản giảm giá thành
Bảng tập hợp chi phí theo yếu tố
Bảng tập hợp chi phí theo khoản mục
```

## 0K.6. `Hợp đồng`

```text
Kỳ tính giá
Kết chuyển chi phí
Nghiệm thu hợp đồng
```

Chi tiết kỳ:

```text
Tổng hợp chi phí
Bảng phân bổ chi phí chung
Tập hợp chi phí trực tiếp
Tập hợp khoản giảm giá thành
Bảng tập hợp chi phí theo yếu tố
Bảng tập hợp chi phí theo khoản mục
```

---

# 0L. THUẾ — AUDIT TAB CON

## 0L.1. LEVEL 2

Workspace trung tâm đã xác minh:

```text
THUẾ
└─ Khai thuế
```

Các loại tờ khai được mở từ `Lập tờ khai`, `Khai bổ sung`, `Đăng ký tờ khai sử dụng`; không nên biến mỗi sắc thuế thành module tab nếu UI AMIS hiện tại dùng menu tạo.

## 0L.2. `Khai thuế` → menu/action

```text
Đăng ký tờ khai sử dụng

Lập tờ khai
├─ GTGT khấu trừ 01/GTGT
├─ TNDN / Quyết toán TNDN
├─ TNCN
├─ TTĐB
├─ Tài nguyên
└─ ... theo tờ khai đã đăng ký

Khai bổ sung
└─ Danh sách loại tờ khai có thể khai bổ sung
```

## 0L.3. Tờ khai GTGT → LEVEL 4

Tùy tham số người dùng chọn:

```text
TỜ KHAI
├─ Tờ khai chính
├─ BKMV_01-2/GTGT       [nếu chọn]
├─ BKBR_01-1/GTGT       [nếu chọn]
└─ Các phụ lục được chọn
```

## 0L.4. Tờ khai bổ sung → LEVEL 4

```text
├─ Tờ khai bổ sung
├─ 01/KHBS
├─ 01-1/KHBS
├─ BKMV                  [nếu chọn]
├─ BKBR                  [nếu chọn]
└─ Phụ lục khác theo loại tờ khai
```

Các phụ lục là tab động theo `Loại tờ khai + tham số`, không cố định toàn hệ thống.

---

# 0M. TỔNG HỢP — AUDIT TAB CON

## 0M.1. Không làm phẳng các node Quy trình

Các nghiệp vụ:

```text
Quyết toán tạm ứng
Chứng từ ghi sổ
Kết chuyển lợi nhuận
Tính tỷ giá xuất quỹ
Kết chuyển lãi lỗ
Đánh giá lại ngoại tệ
Phân bổ chi phí
Khóa sổ
Chọn hoạt động LCTT
Kiểm tra đối chiếu
```

không được mặc định coi là tất cả đều là tab cấp 2.

## 0M.2. Workspace chính

Tài liệu AMIS xác minh các entry point lớn:

```text
TỔNG HỢP
├─ Quy trình
├─ Chứng từ nghiệp vụ khác
├─ Lập báo cáo tài chính
└─ Dữ liệu phục vụ hợp nhất [nếu sử dụng]
```

## 0M.3. `Lập báo cáo tài chính`

Bên trong:

```text
├─ Lập báo cáo tài chính
├─ Lập báo cáo tài chính tổng hợp
└─ Lập báo cáo tài chính giữa niên độ
```

Một bộ BCTC có 4 báo cáo theo TT99:

```text
Báo cáo tình hình tài chính
Báo cáo kết quả hoạt động kinh doanh
Báo cáo lưu chuyển tiền tệ
Bản thuyết minh BCTC
```

Bốn báo cáo trên có thể render thành tab/section trong bộ BCTC, tùy wireframe; chúng không phải module tab.

---

# 0N. QUY TẮC DÀNH CHO FRONTEND SAU AUDIT

Khi dựng một module, bắt buộc tạo config phân cấp thay vì mảng tab phẳng.

Ví dụ:

```ts
module = {
  id: "tools",
  tabs: [
    { id: "process" },
    { id: "register", views: ["by-tool", "by-department"] },
    {
      id: "management",
      tabs: [
        "increase",
        "allocation",
        "adjustment",
        "transfer",
        "decrease",
        "inventory"
      ]
    },
    {
      id: "prepaid-expenses",
      tabs: [
        "list",
        "allocation",
        "decrease"
      ]
    },
    { id: "reports" }
  ]
}
```

Không dùng:

```ts
tabs = [
  "process",
  "increase",
  "allocation",
  "adjustment",
  "transfer",
  "decrease",
  "prepaid-expenses",
  "reports"
]
```

---

# 0O. KẾT QUẢ AUDIT — NHỮNG ĐIỂM BẢN V4 CHƯA ĐỦ

| Phân hệ | Thiếu/nhầm ở V4 | V5 sửa |
|---|---|---|
| CCDC | Chưa phản ánh đầy đủ 2 tầng `Quản lý CCDC` và `CPTT` | Đã bóc Level 2 → Level 3 → Document tabs |
| CCDC Ghi tăng | Thiếu tab `Đơn vị sử dụng`, `Mô tả chi tiết` | Đã bổ sung |
| CCDC Phân bổ | Tên tab chưa chính xác | Sửa thành `Xác định mức chi phí / Phân bổ / Hạch toán` |
| CPTT | Thiếu hierarchy rõ | `Danh sách / Phân bổ / Ghi giảm`; form có `Thiết lập phân bổ / Tập hợp chứng từ` |
| TSCĐ | Chưa đủ tab bên trong form | Đã thêm Ghi tăng, Đánh giá lại, Khấu hao, Ghi giảm, Kiểm kê |
| Mua hàng | Chưa phân biệt loại chứng từ và tab | Đã bóc 4 loại mua hàng + mua dịch vụ + nhiều HĐ |
| Bán hàng | Chưa thể hiện tab động theo Kiêm PX/Lập kèm HĐ | Đã bổ sung dynamic document tabs |
| Kho | Một số vùng detail bị gọi là tab | Đã phân biệt tab / filter / quick detail |
| Tiền mặt | Thiếu tab động ở Chi mua ngoài có HĐ | Đã bổ sung 2 cấu hình tab |
| Tiền gửi | 3 hình thức đối chiếu dễ bị nhầm thành tab | Đánh dấu `MODE` |
| Giá thành | Thiếu các tab/bảng trong chi tiết kỳ | Đã bóc theo từng phương pháp |
| Thuế | Đã làm sắc thuế giống tab ngang | Sửa thành menu tờ khai + tab phụ lục động |
| Tổng hợp | Làm phẳng các node Quy trình | Sửa thành workspace chính + node/action |


# 0. QUY ƯỚC NGUỒN VÀ MỨC ĐỘ XÁC THỰC

Tài liệu dùng 4 nhãn để phân biệt rõ nguồn:

| Nhãn | Ý nghĩa |
|---|---|
| `[MISA]` | Đã đối chiếu với Help AMIS Kế toán hiện hành, tài liệu chức năng MISA hoặc ảnh giao diện AMIS đã cung cấp. |
| `[TT99]` | Bắt nguồn từ hoặc cần có vị trí giao diện để đáp ứng Thông tư 99/2025/TT-BTC. |
| `[KHUNG]` | Cách tổ chức frontend đề xuất để ghép các chức năng thành hệ thống thống nhất; không khẳng định MISA bố trí pixel y hệt. |
| `[OPTION]` | Tùy gói, cấu hình, doanh nghiệp hoặc phase triển khai; có thể bật/tắt. |

**Nguyên tắc audit:** Nếu MISA cho phép ẩn/hiện nghiệp vụ hoặc tab thì tài liệu không coi tab đó luôn bắt buộc xuất hiện. Frontend phải hỗ trợ cấu hình hiển thị theo quyền và cấu hình doanh nghiệp.

---

# 1. XƯƠNG SỐNG NGHIỆP VỤ THEO THÔNG TƯ 99

[TT99] Giao diện kế toán phải có chỗ để quản lý toàn bộ chuỗi sau:

```text
QUẢN TRỊ & KIỂM SOÁT NỘI BỘ
            ↓
DANH MỤC / HỆ THỐNG TÀI KHOẢN
            ↓
CHỨNG TỪ KẾ TOÁN
            ↓
GHI SỔ / SỔ KẾ TOÁN
            ↓
ĐỐI CHIẾU / KIỂM SOÁT
            ↓
KHÓA SỔ
            ↓
BÁO CÁO TÀI CHÍNH
```

[TT99] Mọi nghiệp vụ kinh tế, tài chính phát sinh phải có chứng từ kế toán; doanh nghiệp được thiết kế thêm hoặc sửa đổi biểu mẫu chứng từ nếu vẫn bảo đảm yêu cầu pháp luật. Vì vậy hệ thống không nên hard-code một biểu mẫu duy nhất mà cần có **Mẫu in / Sửa mẫu / Trường mở rộng / Cấu hình hiển thị**.

[TT99] Hệ thống tài khoản và sổ kế toán cũng có khả năng điều chỉnh/bổ sung theo nhu cầu quản lý trong phạm vi quy định. Vì vậy frontend cần có **Danh mục tài khoản dạng cây**, **thiết lập tài khoản**, **sổ sách**, **khóa sổ** và **BCTC**.

[TT99] Phân hệ Thuế không được coi là “toàn bộ do TT99 quy định”. TT99 nêu nghĩa vụ thuế thực hiện theo pháp luật thuế; vì vậy module Thuế trong sản phẩm là module nghiệp vụ riêng, cần tiếp tục đặc tả theo quy định thuế hiện hành.

---

# 2. KIẾN TRÚC GIAO DIỆN TOÀN HỆ THỐNG

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ GLOBAL HEADER                                                              │
│ App | Công ty/Dữ liệu | Tìm kiếm thông minh | Công việc | 🔔 | ? | ⚙ | User│
├─────────────────┬──────────────────────────────────────────────────────────┤
│ + THÊM NHANH    │ MODULE TAB BAR                                           │
│                 ├──────────────────────────────────────────────────────────┤
│ LEFT SIDEBAR    │                                                          │
│                 │                       WORKSPACE                           │
│ Module cấp 1    │                                                          │
│                 │                                                          │
│                 ├──────────────────────────────────────────────────────────┤
│ Danh mục        │ QUICK DETAIL / STATUS BAR / PAGINATION                   │
│ Số dư ban đầu   │                                                          │
└─────────────────┴──────────────────────────────────────────────────────────┘
```

Frontend được tổ chức thành các lớp:

```text
L0  GLOBAL SHELL
    Global Header + Left Sidebar + Global Search + Quick Create

L1  MODULE NAVIGATION
    Mua hàng / Bán hàng / Kho / Thuế / ...

L2  MODULE TAB + QUICK MENU
    Quy trình / Biểu đồ / Đơn mua / Mua hàng / ...

L3  WORKSPACE
    Process / Dashboard / List / Reconciliation / Report / Settings

L4  RECORD CONTEXT
    Quick Detail / Row Action / Bulk Action

L5  FULL OBJECT
    Document Detail / Create/Edit / Related Document / Modal / Drawer
```

---


# 2A. QUY TẮC BẮT BUỘC: KHÔNG ĐƯỢC “LÀM PHẲNG” CÂY GIAO DIỆN

Đây là điểm quan trọng nhất sau khi audit lại ảnh giao diện AMIS thực tế.

Một phân hệ không chỉ có:

```text
Module
└─ Danh sách chức năng
```

mà có thể có tới 6–7 cấp UI:

```text
LEVEL 1 — SIDEBAR MODULE
Công cụ dụng cụ

LEVEL 2 — MODULE TAB
Quy trình
Sổ theo dõi công cụ dụng cụ
Quản lý công cụ dụng cụ
Chi phí trả trước
Báo cáo

LEVEL 3 — INNER TAB
Ví dụ trong "Quản lý công cụ dụng cụ":
Ghi tăng
Phân bổ chi phí
Điều chỉnh
Điều chuyển
Ghi giảm
Kiểm kê

Ví dụ trong "Chi phí trả trước":
Danh sách chi phí trả trước
Phân bổ chi phí trả trước
Ghi giảm

LEVEL 4 — PAGE TOOLBAR
Search
Thời gian
Nạp
Xuất
Cấu hình cột
Lọc
Thêm / Thêm ▼

LEVEL 5 — GRID / ROW ACTION
Xem
Sửa
Xóa
Ghi sổ
Bỏ ghi
Nhân bản
...

LEVEL 6 — FULL DOCUMENT
Thông tin chung
Các tab chi tiết
Nguồn gốc hình thành
Phân bổ
Hạch toán
Tham chiếu
...

LEVEL 7 — MODAL / DRAWER / PICKER
Chọn chứng từ nguồn
Chọn đối tượng phân bổ
Import Excel
Thiết lập phân bổ
Xác nhận
...
```

**Quy tắc cho tất cả mockup Frontend:** phải xác định đúng chức năng thuộc cấp nào.  
Không được lấy các `inner tab` hoặc `action trong Quy trình` rồi đưa hết thành `module tab` cấp trên.

Ảnh AMIS `Công cụ dụng cụ → Chi phí trả trước` là ví dụ rõ nhất:  
`Chi phí trả trước` là tab cấp 2, còn `Danh sách chi phí trả trước / Phân bổ chi phí trả trước / Ghi giảm` là tab cấp 3.

---

# 3. GLOBAL HEADER – CẤU TRÚC ĐẦY ĐỦ

```text
[App Switcher] [Logo / Kế toán]
[Công ty ▼] [Dữ liệu/Năm ▼] [Chi nhánh/Đơn vị ▼]
[Tìm kiếm thông minh................................]
[Công việc] [Thông báo] [Trợ giúp] [⚙ Tiện ích & thiết lập] [User ▼]
```

| Khu vực | Bên trong bao gồm |
|---|---|
| App Switcher | Danh sách ứng dụng trong hệ sinh thái; Kế toán là app hiện tại. |
| Context doanh nghiệp | Công ty, chi nhánh/đơn vị, bộ dữ liệu/năm làm việc. |
| Tìm kiếm thông minh | Chứng từ, hóa đơn, KH, NCC, hàng hóa/dịch vụ, tài khoản, hợp đồng, tài sản, tờ khai. |
| Công việc | Việc cần xử lý, việc chờ duyệt, việc phát sinh từ workflow. |
| Thông báo | Chứng từ, hóa đơn, công nợ, thuế, cảnh báo dữ liệu/hệ thống. |
| Trợ giúp | Help center, hướng dẫn, video, tài liệu. |
| Tiện ích & thiết lập | Toàn bộ utility/settings toàn hệ thống. |
| Tài khoản | Hồ sơ người dùng, vai trò, chế độ làm việc, đăng xuất. |

## 3.1. Tìm kiếm thông minh

```text
[Tìm kiếm thông minh................................]

KẾT QUẢ
├─ Chứng từ
├─ Hóa đơn
├─ Khách hàng
├─ Nhà cung cấp
├─ Hàng hóa / dịch vụ
├─ Tài sản / CCDC
├─ Hợp đồng / đơn hàng
├─ Tài khoản
└─ Tờ khai / báo cáo (nếu hỗ trợ)
```

[KHUNG] Kết quả có thể mở **Quick View** trước, sau đó chuyển sang **Full Detail**.

## 3.2. Chế độ làm việc

[MISA][OPTION] Chuẩn bị entry point đổi chế độ:

```text
Kế toán
Thủ kho
Thủ quỹ
```

---

# 4. LEFT SIDEBAR – CÂY CẤP 1

Cấu trúc đề xuất gần với AMIS Kế toán mới:

```text
+ THÊM NHANH

QUẢN LÝ HÓA ĐƠN

TIỀN MẶT
TIỀN GỬI
MUA HÀNG
BÁN HÀNG
KHO
CÔNG CỤ DỤNG CỤ
TÀI SẢN CỐ ĐỊNH
TIỀN LƯƠNG
THUẾ
GIÁ THÀNH
KẾT NỐI VAY VỐN             [OPTION]
TỔNG HỢP
NGÂN SÁCH                    [OPTION]
PHÂN TÍCH TÀI CHÍNH          [OPTION]

BÁO CÁO

────────────────────────────

DANH MỤC
SỐ DƯ BAN ĐẦU
```

**Không đưa các nút CRUD như Thêm/Sửa/Xóa vào sidebar.** Chúng nằm trong Workspace và Document.

[MISA] Danh mục và Số dư ban đầu nên có entry point riêng. Các chức năng quản trị hệ thống chủ yếu đi qua `⚙ Các tiện ích và thiết lập`.

---

# 5. + THÊM NHANH – MENU TOÀN CỤC

```text
+ THÊM NHANH
├─ TIỀN MẶT
│  ├─ Thu tiền mặt
│  └─ Chi tiền mặt
├─ TIỀN GỬI
│  ├─ Thu tiền gửi
│  └─ Chi tiền gửi
├─ KHO
│  ├─ Nhập kho
│  ├─ Xuất kho
│  └─ Chuyển kho
├─ MUA HÀNG
│  ├─ Mua hàng
│  └─ Mua dịch vụ
├─ BÁN HÀNG
│  ├─ Bán hàng
│  └─ Bán dịch vụ
└─ TỔNG HỢP
   ├─ Chứng từ nghiệp vụ khác
   └─ Quyết toán tạm ứng
```

[MISA] Đây là nhóm shortcut đã được xác minh trên giao diện mới. [KHUNG] Có thể thêm shortcut khác về sau theo quyền, nhưng không nên biến `+ Thêm nhanh` thành một menu quá dài.

---

# 6. MODULE TAB BAR VÀ MODULE QUICK MENU

## 6.1. Module Tab Bar

[MISA] Các nghiệp vụ chính hiển thị thành tab ngang phía trên Workspace.

Người dùng có thể:

```text
☑ Chọn tab hiển thị
☐ Ẩn tab không dùng
↕ Kéo thả đổi thứ tự
⚙ Thiết lập nâng cao → Ẩn/hiện nghiệp vụ
```

## 6.2. Module Quick Menu

[MISA] Khi bấm tên phân hệ, mở panel đường tắt:

```text
TÊN PHÂN HỆ
├─ NGHIỆP VỤ
├─ TIỆN ÍCH
├─ DANH MỤC LIÊN QUAN
└─ BÁO CÁO LIÊN QUAN
```

Quick Menu là đường tắt; **không thay thế Tab Bar**.

---

# 7. CÁC LOẠI WORKSPACE CHUẨN

| Loại | Dùng cho |
|---|---|
| PROCESS WORKSPACE | Tab Quy trình: sơ đồ nghiệp vụ + shortcut danh mục/tiện ích/báo cáo. |
| DASHBOARD WORKSPACE | Biểu đồ/KPI ở Mua, Bán, Kho, Ngân sách, Phân tích. |
| LIST WORKSPACE | Danh sách chứng từ, đơn, hợp đồng, tờ khai, bảng phân bổ. |
| DOCUMENT WORKSPACE | Tạo/Xem/Sửa object nghiệp vụ chi tiết. |
| RECONCILIATION WORKSPACE | Đối chiếu ngân hàng, kiểm kê, kiểm tra chứng từ-sổ sách. |
| REPORT WORKSPACE | Chọn tham số → Viewer → In/Xuất. |
| MASTER DATA WORKSPACE | Danh mục dạng cây/danh sách/detail. |
| SETTINGS WORKSPACE | Công ty, người dùng, quyền, dữ liệu, nghiệp vụ, kết nối. |

---

# 8. LIST WORKSPACE – BỐ CỤC CHI TIẾT

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ MODULE TAB BAR                                                            │
├───────────────────────────────────────────────────────────────────────────┤
│ [Search................] [Kỳ/Thời gian] [Loại ▼]                         │
│                         [Nạp] [Xuất] [Lọc] [⚙ Cột] [Tiện ích ...]        │
│                                     [AI nếu có] [Nút tạo mới ▼]          │
├───────────────────────────────────────────────────────────────────────────┤
│ ☐ | CỘT DỮ LIỆU... | TRẠNG THÁI... | CHỨC NĂNG                          │
│ ☐ | ...                                     | [Primary Action] [▼]       │
│ ☐ | ...                                     | [Xem] [▼]                 │
├───────────────────────────────────────────────────────────────────────────┤
│ BULK ACTION BAR xuất hiện khi chọn dòng                                  │
├───────────────────────────────────────────────────────────────────────────┤
│ Tổng số... | Số dòng/trang... | Phân trang                               │
├───────────────────────────────────────────────────────────────────────────┤
│                           CHI TIẾT NHANH [∨/∧]                            │
├───────────────────────────────────────────────────────────────────────────┤
│ Quick Detail Grid / Tabs                                                  │
└───────────────────────────────────────────────────────────────────────────┘
```

## 8.1. Thanh công cụ chung

| Nhóm | Chức năng nhỏ |
|---|---|
| Tra cứu | Tìm kiếm nhanh; kỳ/thời gian; lọc loại chứng từ; bộ lọc nâng cao. |
| Dữ liệu | Nạp/làm mới; Xuất Excel; Nhập Excel khi nghiệp vụ hỗ trợ. |
| Hiển thị | Tùy chỉnh cột; lọc theo cột; sắp xếp. |
| Tạo | Thêm; menu mũi tên cạnh Thêm; Thêm bằng AI ở màn hình hỗ trợ. |
| Tiện ích | Các thao tác đặc thù; lấy dữ liệu; liên kết dịch vụ. |
| Hàng loạt | Ghi sổ/Bỏ ghi/Xóa/Cập nhật trạng thái/... tùy màn hình. |

## 8.2. Row Action

Mỗi dòng có thể có một `Primary Action` và một dropdown.

Các action thường gặp trên AMIS:

```text
Xem
Sửa / Sửa nhanh
Ghi sổ
Bỏ ghi
Xóa
Nhân bản
In
Gửi chứng từ qua email
Lập chứng từ liên quan
Cập nhật trạng thái
Xem tình hình thực hiện
```

## 8.3. Quick Detail

[MISA] Chọn record ở danh sách sẽ hiển thị vùng xem nhanh phía dưới.

```text
CHI TIẾT NHANH
├─ Chi tiết hàng hóa / dịch vụ
├─ Hạch toán
├─ Thuế
├─ Tham chiếu
└─ Thông tin nghiệp vụ đặc thù
```

Quick Detail có:

```text
Mở rộng
Thu gọn
Mở Full Detail
```

## 8.4. Bulk Action

Khi chọn nhiều record:

```text
Đã chọn N bản ghi
[Ghi sổ] [Bỏ ghi] [Xóa] [Thực hiện hàng loạt ▼]
```

Tùy module có thể thay bằng:

```text
Cập nhật trạng thái
Ghi doanh số
Từ chối ghi doanh số
Cập nhật ngày giao hàng
Phát hành
Đánh dấu đã hạch toán
...
```

## 8.5. Tùy chỉnh cột

```text
⚙ TÙY CHỈNH GIAO DIỆN
├─ Chọn cột hiển thị
├─ Ẩn cột
├─ Sắp xếp thứ tự
├─ Trường mở rộng
└─ Một số màn hình: Sửa mẫu hiện tại
```

Các trường metadata có thể gồm:

```text
Người tạo
Ngày tạo
Người sửa
Ngày sửa
Chi nhánh
Trạng thái ký số
Workflow
Trường mở rộng 1..n
```

---

# 9. DOCUMENT WORKSPACE – CẤU TRÚC CHUNG

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ ← TÊN CHỨNG TỪ              Số CT / Ngày              [TRẠNG THÁI]      │
│                                           [Action chính] [Tiện ích ▼]    │
├───────────────────────────────────────────────────────────────────────────┤
│ THÔNG TIN CHUNG                                                          │
│ Đối tượng | Người giao/nhận | Địa chỉ | Diễn giải | Nhân viên | ...     │
├───────────────────────────────────────────────────────────────────────────┤
│ TAB CẤP CHỨNG TỪ (nếu có)                                                │
│ Phiếu nhập | Phiếu chi/UNC | Hóa đơn | Điều khoản thanh toán | ...      │
├───────────────────────────────────────────────────────────────────────────┤
│ TAB CHI TIẾT                                                             │
│ Hàng tiền | Hạch toán | Thuế | Chi phí | Thống kê | Bổ sung | Khác      │
├───────────────────────────────────────────────────────────────────────────┤
│ DETAIL GRID                                                              │
├───────────────────────────────────────────────────────────────────────────┤
│ TỔNG HỢP GIÁ TRỊ / THÔNG TIN KẾT QUẢ                                    │
├───────────────────────────────────────────────────────────────────────────┤
│ Tham chiếu | Đính kèm | Lịch sử | Nguồn/Sinh ra                         │
├───────────────────────────────────────────────────────────────────────────┤
│ [Hủy]                                              [Cất] [Cất & ...]     │
└───────────────────────────────────────────────────────────────────────────┘
```

## 9.1. Các chức năng nhỏ dùng lặp lại trong chứng từ

```text
+  Thêm nhanh danh mục ngay tại trường chọn
🔍 Chọn chứng từ tham chiếu
⚙  Sửa mẫu hiện tại / ẩn hiện cột
📎 Đính kèm tài liệu
🕘 Lịch sử / nguồn gốc
🖨 In
✉  Gửi email
⧉  Nhân bản
✓  Cất
✓  Ghi sổ
↶  Bỏ ghi
⋯  Tiện ích khác
```

## 9.2. Nhóm tab chi tiết chuẩn

| Tab | Nội dung |
|---|---|
| Hàng tiền | Hàng hóa/dịch vụ, số lượng, đơn giá, thành tiền, chiết khấu. |
| Hạch toán | Dòng tài khoản và đối tượng theo dõi. |
| Thuế | Thông tin thuế/hóa đơn theo nghiệp vụ. |
| Chi phí | Chi phí mua, phân bổ, khoản mục liên quan. |
| Thống kê | Đối tượng THCP, công trình, đơn vị, mục thu/chi, mã thống kê... |
| Thông tin bổ sung | Trường mở rộng dùng chung toàn chứng từ. |
| Khác | Thông tin ít dùng/đặc thù. |
| Tham chiếu | Chứng từ nguồn, chứng từ liên quan, chứng từ sinh ra. |

---

# 10. PROCESS WORKSPACE

```text
QUY TRÌNH
├─ SƠ ĐỒ NGHIỆP VỤ
│  ├─ Bước 1
│  ├─ Bước 2
│  └─ ...
├─ DANH MỤC LIÊN QUAN
├─ TIỆN ÍCH
├─ TÙY CHỌN
└─ BÁO CÁO LIÊN QUAN
```

[MISA] Node và shortcut trong Quy trình phải click được để đi vào màn hình nghiệp vụ.

---

# 11. DASHBOARD / BIỂU ĐỒ WORKSPACE

```text
BIỂU ĐỒ
├─ Bộ chọn kỳ
├─ KPI tổng quan
├─ Biểu đồ chính
├─ Biểu đồ phụ
├─ Danh sách/cảnh báo cần chú ý
└─ Nạp lại
```

[MISA] Tab Biểu đồ đã được xác minh ở Mua hàng, Bán hàng và Kho.

---

# 12. QUẢN LÝ HÓA ĐƠN – CHI TIẾT

[MISA] `Quản lý hóa đơn` là entry point riêng, phân biệt với `Mua hàng → Xử lý hóa đơn đầu vào` và `Bán hàng → Hóa đơn`.

## 12.1. Cây chức năng

```text
QUẢN LÝ HÓA ĐƠN
├─ Kết nối / Thiết lập dịch vụ HĐĐT
├─ Danh sách hóa đơn
├─ Lập hóa đơn
├─ Phát hành hóa đơn
├─ Gửi hóa đơn cho khách hàng
├─ Tra cứu / tìm kiếm / trạng thái
├─ Tải hóa đơn
├─ Chuyển HĐĐT thành bản giấy
├─ Hóa đơn điều chỉnh
├─ Hóa đơn thay thế
├─ Hủy / Xóa / Xử lý HĐ không hợp lệ
├─ Thiết lập email gửi hóa đơn
├─ Thiết lập ký số
└─ Báo cáo hóa đơn điện tử
```

## 12.2. Danh sách hóa đơn

```text
TOOLBAR
Search
Khoảng thời gian
Loại hóa đơn
Trạng thái phát hành
Trạng thái CQT
Lọc
Nạp
Xuất
[+ Lập hóa đơn]

GRID
Ngày
Mẫu/Ký hiệu
Số hóa đơn
Khách hàng
MST
Giá trị trước thuế
Thuế
Tổng thanh toán
Trạng thái phát hành
Trạng thái CQT
Chức năng

ROW ACTION
Xem
Phát hành
Gửi khách hàng
Tải
In / Chuyển bản giấy
Điều chỉnh
Thay thế
Hủy / Xử lý không hợp lệ
```

[KHUNG] Action hiển thị theo trạng thái và quy định hóa đơn điện tử hiện hành.

---

# 13. TIỀN MẶT – CÂY GIAO DIỆN HOÀN CHỈNH

```text
TIỀN MẶT
├─ Quy trình
├─ Thu, chi tiền
├─ Kiểm kê
└─ Dự báo dòng tiền
```

## 13.1. Quy trình

```text
Phiếu thu
Phiếu chi
Kiểm kê quỹ

DANH MỤC / SHORTCUT
Khách hàng
Nhà cung cấp
Nhân viên

TIỆN ÍCH
Tính tỷ giá xuất quỹ
Tùy chọn
Báo cáo Tiền mặt
```

## 13.2. Thu, chi tiền – List Workspace

```text
TOOLBAR
Search
Kỳ / Thời gian
Tất cả | Phiếu thu | Phiếu chi
Nạp
Xuất Excel
Lọc
⚙ Cột
[Thu tiền]
[Chi tiền]

BULK ACTION
Ghi sổ
Bỏ ghi
Xóa

ROW ACTION
Xem
Ghi sổ
Bỏ ghi
Xóa
Nhân bản (trừ một số loại)
```

## 13.3. Menu `Thu tiền`

[MISA] Các loại đã xác minh:

```text
THU TIỀN
├─ Thu tiền khách hàng (không theo hóa đơn)
├─ Thu hoàn ứng nhân viên
├─ Rút tiền gửi về nhập quỹ
├─ Thu hồi các khoản cho vay
├─ Thu khác
├─ Thu tiền khách hàng theo hóa đơn
└─ Thu tiền theo hóa đơn nhiều khách hàng
```

## 13.4. Bên trong chứng từ Thu

```text
THÔNG TIN CHUNG
├─ Đối tượng / KH / NV tùy loại
├─ Người nộp
├─ Địa chỉ
├─ Nhân viên
├─ Lý do nộp
└─ Chứng từ gốc kèm theo

TAB HẠCH TOÁN
├─ Diễn giải
├─ TK Nợ
├─ TK Có
├─ Số tiền
├─ Đối tượng
├─ TK ngân hàng
├─ Khế ước đi vay / cho vay
├─ Khoản mục chi phí
├─ Đơn vị
├─ Đối tượng THCP
├─ Công trình
├─ Đơn đặt hàng
├─ Đơn mua hàng
├─ Hợp đồng bán
├─ Hợp đồng mua
├─ Mục thu/chi
├─ Mã thống kê
└─ Trường mở rộng

THÔNG TIN BỔ SUNG
└─ Trường mở rộng dùng chung toàn chứng từ
```

## 13.5. Menu `Chi tiền`

[MISA] Các loại chi chính được mô tả trong tài liệu chi tiết:

```text
CHI TIỀN
├─ Trả tiền nhà cung cấp (không theo hóa đơn)
├─ Tạm ứng cho nhân viên
└─ Chi mua ngoài có hóa đơn
```

Các luồng như trả NCC theo hóa đơn, trả lương, nộp thuế/bảo hiểm có thể được mở từ nghiệp vụ nguồn tương ứng.

## 13.6. Chi mua ngoài có hóa đơn

```text
THÔNG TIN CHUNG
├─ Đối tượng
├─ Người nhận
├─ Địa chỉ
├─ Lý do chi
└─ Chứng từ gốc

[ ] Hạch toán gộp nhiều hóa đơn

NẾU KHÔNG GỘP
├─ Hạch toán
└─ Kê khai hóa đơn và hạch toán thuế

NẾU GỘP
├─ Hạch toán
└─ Kê khai hóa đơn
```

Tab kê khai hóa đơn có các nhóm:

```text
Diễn giải thuế
TK thuế
Giá trị trước thuế
Thuế suất
Tiền thuế
Ngày hóa đơn
Số hóa đơn
Mẫu số
Ký hiệu
Mã/đường dẫn tra cứu
Nhóm HHDV mua vào
Nhà cung cấp
MST nhà cung cấp
```

## 13.7. Kiểm kê quỹ

```text
DANH SÁCH BIÊN BẢN KIỂM KÊ
├─ Thêm bảng kiểm kê
├─ Xem
├─ Xóa
├─ Xuất Excel
├─ Nạp
└─ Tùy chỉnh cột

BIÊN BẢN KIỂM KÊ [TT99]
├─ Số dư theo sổ quỹ
├─ Kiểm kê thực tế theo mệnh giá
├─ Chênh lệch
├─ Lý do thừa/thiếu
└─ Kết luận
```

## 13.8. Dự báo dòng tiền

```text
DANH SÁCH DỰ BÁO
├─ Search
├─ Nạp
├─ Xuất Excel
├─ Thêm / Sửa (theo quyền)
├─ Xem
└─ Xóa

CHI TIẾT DỰ BÁO
├─ Dự thu
├─ Dự chi
├─ Số dư dự kiến
└─ Mốc thời gian
```

---

# 14. TIỀN GỬI – CÂY GIAO DIỆN HOÀN CHỈNH

```text
TIỀN GỬI
├─ Quy trình
├─ Thu, chi tiền
├─ Đối chiếu ngân hàng
├─ Dự báo dòng tiền
├─ Ngân hàng điện tử
├─ Khế ước đi vay
├─ Khế ước cho vay
└─ Báo cáo
```

## 14.1. Quy trình

```text
Thu tiền
Chi tiền
Đối chiếu ngân hàng
Dự báo dòng tiền
Ngân hàng điện tử
Khế ước đi vay
Khế ước cho vay

SHORTCUT
Tài khoản ngân hàng
Khách hàng
Nhà cung cấp
Nhân viên
Tính tỷ giá xuất quỹ
Tùy chọn
Báo cáo
```

## 14.2. Thu, chi tiền

```text
LIST TOOLBAR
Search
Kỳ
Tất cả | Thu | Chi
Lọc
Nạp
Xuất
⚙ Cột
[Thu tiền]
[Chi tiền]

GRID CÓ THỂ BAO GỒM
Ngày hạch toán
Ngày chứng từ
Số chứng từ
Diễn giải
Số tiền
Đối tượng
Tài khoản ngân hàng
Ngân hàng
Lý do
Loại chứng từ
Đã quyết toán
Chi nhánh
Chức năng

ROW
Xem
Ghi sổ
Bỏ ghi
Xóa
Nhân bản (trừ một số loại)

BULK
Ghi sổ
Bỏ ghi
Xóa
```

## 14.3. Đối chiếu ngân hàng

```text
ĐỐI CHIẾU
├─ Chọn tài khoản ngân hàng
├─ Chọn thời gian
├─ Số liệu sổ kế toán
├─ Sao kê / dữ liệu ngân hàng
├─ Giao dịch đã khớp
├─ Giao dịch chưa khớp
├─ Chênh lệch
└─ Kết quả đối chiếu
```

## 14.4. Ngân hàng điện tử

[MISA] Các chức năng nhỏ đã xác minh:

```text
NGÂN HÀNG ĐIỆN TỬ
├─ Chuyển tiền trực tuyến
├─ Kiểm duyệt lệnh chuyển tiền
├─ Thu hồi lệnh chuyển tiền
├─ Danh sách lệnh chuyển tiền
├─ Tra cứu số dư tài khoản
├─ Xuất Excel
├─ Lịch sử giao dịch
├─ Biến động số dư
├─ Quy tắc hạch toán tự động
└─ Kết nối thu nợ
```

## 14.5. Khế ước đi vay

```text
LIST
Search
Lọc thời gian / đối tượng / trạng thái
Nạp
Xuất
[Thêm hợp đồng tín dụng đi vay]
[Thêm khế ước đi vay]

ROW ACTION
Xem tình hình thực hiện
Lập chứng từ nhận giải ngân
Xem lịch trả nợ
Thay đổi lãi suất
Tất toán khoản vay
Xóa
Nhân bản
```

## 14.6. Khế ước cho vay

```text
LIST
Search
Lọc
Nạp
Xuất
[Thêm hợp đồng tín dụng cho vay]
[Thêm khế ước cho vay]

ROW ACTION
Xem tình hình thực hiện
Xem lịch thu nợ
Xóa
Nhân bản
```

---

# 15. MUA HÀNG – CÂY GIAO DIỆN HOÀN CHỈNH

```text
MUA HÀNG
├─ Quy trình
├─ Biểu đồ
├─ Đơn mua hàng
├─ Hợp đồng mua hàng
├─ Mua hàng
├─ Nhận hóa đơn
├─ Xử lý hóa đơn đầu vào
├─ Trả lại hàng mua
├─ Giảm giá hàng mua
└─ Trả tiền theo hóa đơn

TIỆN ÍCH / NGHIỆP VỤ LIÊN QUAN
├─ Công nợ phải trả
├─ Đối chiếu công nợ NCC
├─ Đối trừ / bù trừ công nợ
├─ Tự động hạch toán hóa đơn đầu vào
└─ Báo cáo Mua hàng
```


## 15.0. Quick Menu của Mua hàng — ĐỐI CHIẾU TRỰC TIẾP ẢNH AMIS

Ảnh giao diện người dùng cung cấp cho thấy khi trỏ/bấm `Mua hàng`, AMIS mở panel 2 cột:

```text
MUA HÀNG QUICK MENU

NGHIỆP VỤ                         TIỆN ÍCH
├─ Đơn mua hàng                   ├─ Đối trừ chứng từ
├─ Hợp đồng mua                   ├─ Đối trừ chứng từ nhiều đối tượng
├─ Mua hàng hóa, dịch vụ          ├─ Bỏ đối trừ
├─ Nhận hóa đơn                   ├─ Bỏ đối trừ chứng từ nhiều đối tượng
├─ Trả lại hàng mua               ├─ Bù trừ công nợ
├─ Giảm giá hàng mua              ├─ Nhà cung cấp
├─ Xử lý hóa đơn đầu vào          └─ Hàng hóa, dịch vụ
├─ Đối chiếu công nợ
└─ Biểu đồ
```

Điểm cần áp dụng vào frontend:

```text
Sidebar module
→ có Quick Menu riêng
→ Quick Menu KHÔNG đồng nghĩa với Tab Bar
→ một số mục là nghiệp vụ
→ một số mục là tiện ích/danh mục liên kết
```

## 15.1. Quy trình

```text
Đơn mua hàng
      ↓
Hợp đồng mua hàng
      ↓
Nhận hàng hóa / dịch vụ
      ↓
Nhận hóa đơn
      ↓
Xử lý hóa đơn đầu vào
      ↓
Trả tiền theo hóa đơn

NHÁNH
Trả lại hàng mua
Giảm giá hàng mua

SHORTCUT
Nhà cung cấp
Hàng hóa / dịch vụ
Điều khoản thanh toán
Tiện ích
Tùy chọn
Báo cáo
```

## 15.2. Biểu đồ

```text
Bộ chọn kỳ
├─ Giá trị mua
├─ Công nợ phải trả
├─ Tình hình mua / thanh toán
├─ NCC / nhóm hàng nổi bật
└─ Danh sách cần chú ý
```

## 15.3. Đơn mua hàng – List

```text
TOOLBAR
Search theo số đơn / NCC / mã NCC
Kỳ
Lọc trạng thái / thời gian / NCC
Nạp
Xuất Excel
⚙ Cột
[+ Thêm ▼]
    └─ Nhập từ Excel

BULK
Xóa

ROW ACTION
Xem
Lập chứng từ mua hàng
Xóa
Nhân bản
Cập nhật trạng thái
Gửi chứng từ qua email
```

Trạng thái có thể gồm:

```text
Chưa thực hiện
Đang thực hiện
Hoàn thành
Hủy bỏ
```

## 15.4. Đơn mua hàng – Full Detail

```text
HEADER
Thông tin đơn / trạng thái / action

THÔNG TIN NCC
Nhà cung cấp
Người liên hệ
Địa chỉ
MST

THÔNG TIN GIAO HÀNG
Địa điểm
Ngày dự kiến
Điều kiện giao nhận

THÔNG TIN ĐƠN
Ngày
Số đơn
Nhân viên mua hàng
Điều khoản thanh toán
Diễn giải

DETAIL GRID
Hàng hóa/Dịch vụ
Số lượng
Đơn giá
Chiết khấu
Thuế
Thành tiền
Thông tin giao

SUMMARY
Tổng tiền hàng
Chiết khấu
Thuế
Giá trị đơn hàng

RELATED
Hợp đồng
Chứng từ mua hàng đã lập
Tình hình thực hiện
Đính kèm
Lịch sử
```

[KHUNG] Đây là shell đầy đủ để vẽ frontend; field bắt buộc/validation sẽ đặc tả ở Screen Spec sau.

## 15.5. Hợp đồng mua hàng

```text
LIST TOOLBAR
Search
Lọc trạng thái / thời gian / NCC
Nạp
Xuất
Cột
[+ Thêm ▼]
    └─ Nhập Excel

GRID THEO DÕI
Số hợp đồng
Ngày ký
NCC
Giá trị
Giá trị thực hiện
% hoàn thành
Số đợt thanh toán
Đã trả
Còn phải trả
Tình trạng
Giao hàng
...

ROW ACTION
Xem tình hình thực hiện
Sửa
Xóa
Nhân bản
Cập nhật tình trạng
```

## 15.6. Mua hàng – List

```text
TOOLBAR
Search
Kỳ
Lọc trạng thái ghi sổ
Lọc trạng thái thanh toán
Lọc loại chứng từ
Nạp
Xuất
Cột
Tiện ích
[+ Thêm]

GRID
Ngày hạch toán
Số chứng từ
Hóa đơn
NCC
Diễn giải
Tiền hàng
Chiết khấu
Thuế GTGT
Thuế nhập khẩu / TTĐB / BVMT... khi có
Chi phí mua
Giá trị nhập kho
Trạng thái nhận HĐ
Trạng thái thanh toán
Loại chứng từ
Chức năng

ROW ACTION
Xem
Trả tiền
Nhân bản
Ghi sổ
Bỏ ghi
Xóa

BULK
Ghi sổ
Bỏ ghi
Xóa
```

## 15.7. Menu tạo chứng từ Mua hàng

```text
MUA HÀNG
├─ Chứng từ mua hàng
│  ├─ Trong nước nhập kho
│  ├─ Trong nước không qua kho
│  ├─ Nhập khẩu nhập kho
│  └─ Nhập khẩu không qua kho
├─ Chứng từ mua dịch vụ
└─ Chứng từ mua hàng nhiều hóa đơn
```

## 15.8. Chứng từ mua hàng – các lớp tab bên trong

### A. Trong nước nhập kho

```text
TAB CẤP CHỨNG TỪ
Phiếu nhập
Phiếu chi / Ủy nhiệm chi
Hóa đơn
Điều khoản thanh toán

TAB CHI TIẾT
Hàng tiền
Thuế
Chi phí
Thông tin bổ sung
Khác
```

### B. Trong nước không qua kho

```text
TAB CẤP CHỨNG TỪ
Chứng từ ghi nợ / Phiếu chi / Ủy nhiệm chi
Hóa đơn

TAB CHI TIẾT
Hàng tiền
Thuế
Thống kê
Chi phí
Khác
```

### C. Nhập khẩu

```text
Hàng tiền
Thuế
Phí trước hải quan
Phí hàng về kho / Chi phí mua hàng
Thống kê
Thông tin bổ sung
```

## 15.9. Chứng từ mua dịch vụ

```text
HÌNH THỨC THANH TOÁN
Chưa thanh toán
Thanh toán ngay bằng Tiền mặt
Thanh toán ngay bằng Ủy nhiệm chi

TAB
Hạch toán
Thuế
Thống kê
Khác
Thông tin bổ sung

TIỆN ÍCH
[ ] Là chi phí mua hàng
[Phân bổ CP]
[+] Thêm nhanh NCC
```

## 15.10. Nhận hóa đơn

```text
LIST
Search số CT / số HĐ / NCC
Lọc trạng thái ghi sổ / thời gian
Nạp
Xuất
Cột
[+ Thêm]

ROW
Trả tiền
Xem
Ghi sổ
Bỏ ghi

BULK
Ghi sổ
Bỏ ghi
Xóa

DETAIL
Thông tin NCC
Thông tin hóa đơn
Hạch toán liên quan
Thuế
Tham chiếu chứng từ nhận hàng/mua hàng
```

## 15.11. Xử lý hóa đơn đầu vào – Workspace trọng yếu

```text
┌────────────────────────────────────────────────────────────────────┐
│ Search / Kỳ / Trạng thái / NCC / Đồng bộ / Lọc                    │
├────────────────────────────────┬───────────────────────────────────┤
│ DANH SÁCH HÓA ĐƠN ĐẦU VÀO     │ PREVIEW HÓA ĐƠN                  │
│                                │                                   │
│ Trạng thái lập chứng từ        │ Nội dung hóa đơn                  │
│ Trạng thái hạch toán           │ Đối chiếu danh mục                │
│ Chứng từ thanh toán liên kết   │ Thông tin cảnh báo                │
├────────────────────────────────┴───────────────────────────────────┤
│ ACTION / BULK ACTION                                               │
└────────────────────────────────────────────────────────────────────┘
```

Các action nhỏ cần có chỗ trên UI:

```text
Lập chứng từ mua hàng
Lập chứng từ mua dịch vụ
Lập Phiếu chi tiền mặt
Lập Ủy nhiệm chi
Lập Chứng từ nghiệp vụ khác
Lập chứng từ trả lại hàng bán
Lập chứng từ trả lại hàng mua
Lập chứng từ giảm giá hàng mua
Lập Quyết toán tạm ứng
Lập Nhận hóa đơn
Đánh dấu đã hạch toán
Bỏ đánh dấu đã hạch toán
Chọn chứng từ đã hạch toán để liên kết
Xử lý hàng loạt
```

Khi liên kết chứng từ đã hạch toán, UI phải cho chọn các loại chứng từ nguồn phù hợp và hiển thị chứng từ liên kết để click mở lại.

## 15.12. Trả lại hàng mua / Giảm giá hàng mua

```text
LIST
Search
Kỳ
Lọc trạng thái ghi sổ
Nạp
Xuất
Cột
[+ Thêm ▼]
  ├─ Nhập Excel
  └─ Lập hóa đơn thay thế (ở nghiệp vụ phù hợp)

ROW
Xem
Ghi sổ
Bỏ ghi
Xóa

BULK
Ghi sổ
Bỏ ghi
Xóa
```

## 15.13. Trả tiền theo hóa đơn

```text
Chọn NCC
    ↓
Danh sách hóa đơn/chứng từ còn phải trả
    ↓
Chọn một/nhiều hóa đơn
    ↓
Chọn phương thức thanh toán
    ├─ Tiền mặt
    └─ Tiền gửi
    ↓
Sinh chứng từ thanh toán
    ↓
Xem chứng từ liên kết
```

## 15.14. Công nợ nhà cung cấp

```text
Công nợ theo NCC
Trước hạn / Đến hạn / Quá hạn
Tuổi nợ
Hạn thanh toán
Đối chiếu công nợ
Xuất Excel
Đối trừ công nợ
Bù trừ công nợ
```

---

# 16. BÁN HÀNG – CÂY GIAO DIỆN HOÀN CHỈNH

```text
BÁN HÀNG
├─ Quy trình
├─ Biểu đồ
├─ Báo giá
├─ Đơn đặt hàng
├─ Hợp đồng bán
├─ Bán hàng
├─ Hóa đơn
├─ Tự động hạch toán hóa đơn
├─ Trả lại hàng bán
├─ Giảm giá hàng bán
├─ Phân bổ doanh thu nhận trước
├─ Công nợ
├─ Thu nợ
└─ Khác / Workflow liên quan

TIỆN ÍCH LIÊN QUAN
├─ Đề nghị xuất hóa đơn
├─ Đề nghị trả lại hàng bán
├─ Đối trừ / bù trừ
├─ Tính giá bán
├─ Chính sách giá
├─ Ghi/Bỏ ghi doanh số hợp đồng bán
├─ Ghi/Bỏ ghi doanh số đơn hàng
└─ Email nhắc nợ
```

## 16.1. Quy trình

```text
Báo giá
   ↓
Đơn đặt hàng
   ↓
Hợp đồng bán
   ↓
Ghi nhận doanh thu / Bán hàng
   ↓
Xuất hóa đơn
   ↓
Thu tiền theo hóa đơn

NHÁNH
Trả lại hàng bán
Giảm giá hàng bán

SHORTCUT
Khách hàng
Hàng hóa / dịch vụ
Điều khoản thanh toán
Tiện ích
Tùy chọn
Báo cáo
```

## 16.2. Biểu đồ

```text
Bộ chọn kỳ
├─ Doanh thu
├─ Công nợ phải thu
├─ Doanh số đơn hàng
├─ Tình hình thu tiền
├─ Top khách hàng / hàng hóa
└─ Danh sách cần chú ý
```

## 16.3. Báo giá

```text
LIST TOOLBAR
Search
Lọc hiệu lực / KH / NV bán hàng / thời gian
Nạp
Xuất
Cột
[+ Thêm ▼]
    └─ Nhập Excel

BULK
Xóa

ROW ACTION
Lập đơn đặt hàng
Lập chứng từ bán hàng
Xem
Sửa
Xóa
Nhân bản
Gửi chứng từ qua email
```

### Báo giá – Full Detail

```text
HEADER
Số báo giá | Ngày | Hiệu lực | Trạng thái

THÔNG TIN KHÁCH HÀNG
KH | Người liên hệ | Địa chỉ | MST

THÔNG TIN BÁO GIÁ
NV bán hàng | Điều khoản thanh toán | Diễn giải | Hạn hiệu lực

DETAIL GRID
Hàng hóa / dịch vụ
Số lượng
Đơn giá
Chiết khấu
Thuế
Thành tiền

SUMMARY
Tổng tiền hàng
Chiết khấu
Thuế
Tổng báo giá

RELATED
Đơn đặt hàng sinh ra
Chứng từ bán hàng sinh ra
Đính kèm
Lịch sử
```

## 16.4. Đơn đặt hàng

```text
TOOLBAR
Search
Lọc KH / NV / trạng thái đơn / trạng thái ghi doanh số
Nạp
Xuất
Cột
[Thêm bằng AI]
[+ Thêm ▼]
    └─ Nhập Excel

BULK
Xóa
Ghi doanh số
Từ chối ghi doanh số
Cập nhật tình trạng đơn
Cập nhật ngày giao hàng

ROW ACTION
Xem tình hình thực hiện
Ghi doanh số
Từ chối ghi doanh số
Lập hợp đồng bán
Cập nhật tình trạng đơn hàng
Cập nhật ngày giao hàng
Xem
Xóa
Nhân bản
Gửi chứng từ qua email
```

### Đơn đặt hàng – Full Detail

```text
HEADER
Số đơn | Ngày | Trạng thái đơn | Trạng thái ghi doanh số

THÔNG TIN KH
Khách hàng | Người liên hệ | Địa chỉ | MST

THÔNG TIN GIAO HÀNG
Địa điểm giao | Ngày giao | Người nhận

THÔNG TIN ĐƠN
NV bán hàng | Báo giá nguồn | Điều khoản thanh toán | Diễn giải

DETAIL GRID
Hàng hóa
Số lượng đặt
Số lượng đã giao
Còn lại
Đơn giá
Chiết khấu
Thuế
Thành tiền

RELATED
Báo giá
Hợp đồng bán
Chứng từ bán
Phiếu xuất
Hóa đơn
Tình hình giao hàng
Tình hình thanh toán
```

## 16.5. Hợp đồng bán

```text
LIST
Search
Lọc
Nạp
Xuất
Cột
[+ Thêm]

GRID
Số hợp đồng
Ngày ký
Khách hàng
Giá trị
Doanh số
Đã xuất hóa đơn
Đã thu
Còn phải thu
Tình trạng
...

ROW / DETAIL ACTION
Xem tình hình thực hiện
Sửa
Nhân bản
Xóa
Ghi/Bỏ ghi doanh số
Gửi email
```

### Hợp đồng bán – Detail

```text
Thông tin hợp đồng
Khách hàng
Giá trị hợp đồng
Thời hạn
Giao hàng
Các đợt thanh toán
Doanh số
Hóa đơn
Thu tiền
Công nợ
Đính kèm
Lịch sử thực hiện
```

## 16.6. Bán hàng – List

```text
TOOLBAR
Search
Kỳ
Lọc loại chứng từ / trạng thái ghi sổ / trạng thái thanh toán
Nạp
Xuất
Cột
Tiện ích
[+ Thêm]

ROW ACTION PHỔ BIẾN
Xem
Ghi sổ
Bỏ ghi
Xóa
Nhân bản
Thu tiền
Lập phiếu xuất
Phát hành HĐĐT
Gửi email
Gửi email nhắc nợ

BULK
Ghi sổ
Bỏ ghi
Xóa
```

## 16.7. Menu tạo Bán hàng

```text
BÁN HÀNG
├─ Chứng từ bán hàng
├─ Chứng từ bán dịch vụ
└─ Các tình huống nguồn
   ├─ Từ báo giá
   ├─ Từ đơn đặt hàng
   ├─ Từ hợp đồng bán
   ├─ Bán hàng hóa / dịch vụ trong nước
   ├─ Bán xuất khẩu
   ├─ Chiết khấu thương mại
   ├─ Khuyến mại
   └─ Combo / bộ sản phẩm nếu doanh nghiệp dùng
```

## 16.8. Chứng từ bán – bố cục bên trong

```text
THÔNG TIN CHUNG
Khách hàng
Người liên hệ
Địa chỉ
MST
NV bán hàng
Diễn giải
Điều khoản thanh toán
Loại tiền
...

TAB CẤP CHỨNG TỪ
Chứng từ bán
Phiếu xuất
Hóa đơn
(hiển thị tùy trường hợp)

TAB CHI TIẾT
Hàng tiền
Thuế / Hóa đơn
Giá vốn (theo quyền)
Thống kê
Thông tin bổ sung
Khác

RELATED
Báo giá
Đơn đặt hàng
Hợp đồng bán
Phiếu xuất
Hóa đơn
Phiếu thu / Thu tiền gửi
```

## 16.9. Hóa đơn bán hàng

```text
LIST
Search
Loại hóa đơn
Trạng thái hạch toán
Trạng thái phát hành
Kỳ
Lọc
Nạp
Xuất
Cột
Tiện ích lấy HĐ từ meInvoice / nhà cung cấp liên kết

ROW ACTION
Xem
Lập chứng từ bán hàng
Lập chứng từ trả lại hàng bán (khi nghiệp vụ phù hợp)
Lập chứng từ giảm giá hàng bán
Lập chứng từ nghiệp vụ khác
Xử lý hóa đơn điều chỉnh / thay thế
Phát hành / gửi / tải theo trạng thái
```

## 16.10. Tự động hạch toán hóa đơn đầu ra

```text
THIẾT LẬP QUY TẮC
        ↓
LẤY / ĐỒNG BỘ HÓA ĐƠN
        ↓
KIỂM TRA DANH MỤC KH / VTHH
        ↓
GHÉP DANH MỤC / TẠO MỚI NẾU CẦN
        ↓
PREVIEW HẠCH TOÁN
        ↓
SINH CHỨNG TỪ
        ↓
DANH SÁCH KẾT QUẢ / LỖI CẦN XỬ LÝ
```

## 16.11. Trả lại hàng bán / Giảm giá hàng bán

```text
LIST CHUẨN
Search
Kỳ
Lọc
Nạp
Xuất
Cột
[+ Thêm]

ROW
Xem
Ghi sổ
Bỏ ghi
Xóa
In (theo loại)

DETAIL
Khách hàng
Hóa đơn / chứng từ gốc
Chi tiết hàng / dịch vụ
Thuế
Phương thức hoàn tiền / giảm công nợ
Tham chiếu
```

## 16.12. Công nợ phải thu

```text
CÔNG NỢ
├─ Tổng quan phải thu
├─ Công nợ theo khách hàng
├─ Trước hạn
├─ Đến hạn
├─ Quá hạn
├─ Tuổi nợ
├─ Đối chiếu công nợ
├─ Đối trừ
├─ Bù trừ
└─ Xuất Excel
```

## 16.13. Thu nợ

```text
Chọn khách hàng
    ↓
Danh sách hóa đơn/chứng từ còn phải thu
    ↓
Chọn một / nhiều hóa đơn
    ↓
Phương thức thu
    ├─ Tiền mặt
    └─ Tiền gửi
    ↓
Sinh chứng từ thu
    ↓
Liên kết ngược về hóa đơn / công nợ
```

## 16.14. Phân bổ doanh thu nhận trước

```text
DANH SÁCH KHOẢN PHÂN BỔ
Thêm
Xem/Sửa
Xóa
Ghi sổ
Bỏ ghi
In
Xuất

DETAIL
Khoản doanh thu nhận trước
Kỳ phân bổ
Thời gian phân bổ
Đối tượng / hợp đồng
Bảng phân bổ từng kỳ
Chứng từ hạch toán liên quan
```

## 16.15. Workflow / tiện ích nhỏ trong Bán hàng

```text
ĐỀ NGHỊ XUẤT HÓA ĐƠN
├─ Danh sách đề nghị
├─ Duyệt đề nghị
├─ Từ chối xuất hóa đơn
├─ Từ chối đề nghị
└─ Hủy hóa đơn theo luồng phù hợp

ĐỀ NGHỊ TRẢ LẠI HÀNG BÁN
├─ Danh sách
├─ Duyệt
└─ Từ chối

TIỆN ÍCH
Chính sách giá
Tính giá bán
Ghi/Bỏ ghi doanh số hợp đồng
Ghi/Bỏ ghi doanh số đơn hàng
Email tự động nhắc nợ
```

---

# 17. KHO – CÂY GIAO DIỆN HOÀN CHỈNH

```text
KHO
├─ Quy trình
├─ Biểu đồ
├─ Nhập kho
├─ Xuất kho
├─ Chuyển kho
├─ Lệnh sản xuất
├─ Lắp ráp, tháo dỡ
├─ Kiểm kê
├─ Báo cáo
└─ Hàng hóa, dịch vụ
```

## 17.1. Quy trình

```text
Nhập kho
Xuất kho
Chuyển kho
Lệnh sản xuất
Lắp ráp / Tháo dỡ
Kiểm kê

SHORTCUT
Hàng hóa / dịch vụ
Kho
Đơn vị tính
Tính giá xuất kho
Báo cáo Kho
```

## 17.2. Nhập kho

```text
LIST
Search
Kỳ
Lọc
Nạp
Xuất
Cột
[+ Thêm]

GRID CÓ THỂ HIỂN THỊ
Ngày hạch toán
Ngày chứng từ
Số chứng từ
Diễn giải
Tổng tiền
Người giao
Đối tượng
Ngày ghi sổ kho
Nhân viên
Loại chứng từ
Workflow
Metadata
Chức năng

ROW
Xem
Ghi sổ / Bỏ ghi
Xóa
Nhân bản

BULK
Ghi sổ
Bỏ ghi
Xóa
```

### Nhập kho – Full Detail

```text
Thông tin phiếu
Người giao
Kho / địa điểm
Chứng từ nguồn

DETAIL GRID
VTHH
Mã
ĐVT
Số lượng theo chứng từ
Số lượng thực nhập
Đơn giá
Thành tiền

TAB / PANEL
Hạch toán
Thống kê
Tham chiếu
Đính kèm
```

[TT99] Phiếu nhập kho phải có chỗ thể hiện thông tin cơ bản tương ứng biểu mẫu 01-VT; frontend có thể tùy biến hiển thị nhưng phải lưu đủ thông tin cần thiết.

## 17.3. Xuất kho

```text
LIST
Search | Kỳ | Lọc | Nạp | Xuất | Cột | [+ Thêm]
Row: Xem | Ghi sổ/Bỏ ghi | Xóa | Nhân bản
Bulk: Ghi sổ | Bỏ ghi | Xóa

DETAIL
Người nhận
Bộ phận / địa chỉ
Lý do xuất
Kho / địa điểm
Chứng từ nguồn

GRID
VTHH
ĐVT
Số lượng yêu cầu
Số lượng thực xuất
Đơn giá
Thành tiền

PANEL
Hạch toán
Thống kê
Tham chiếu
Đính kèm
```

[TT99] Cần có chỗ thể hiện nội dung tương ứng Phiếu xuất kho 02-VT.

## 17.4. Chuyển kho

```text
LIST
Search | Kỳ | Lọc | Nạp | Xuất | Cột | [+ Thêm]
Row: Xem | Ghi sổ/Bỏ ghi | Xóa | Nhân bản

DETAIL
Kho đi
Kho đến
Người giao / nhận
Ngày chuyển
Diễn giải
Chi tiết VTHH
Số lượng
Thông tin vận chuyển / điều chuyển
Hạch toán nếu có
Tham chiếu
```

## 17.5. Lệnh sản xuất – bám ảnh AMIS đã cung cấp

```text
TAB BAR
Quy trình | Biểu đồ | Nhập kho | Xuất kho | Chuyển kho |
Lệnh sản xuất | Lắp ráp, tháo dỡ | Kiểm kê | Báo cáo | Hàng hóa,dịch vụ

TOOLBAR
Search
Kỳ: Đầu năm tới hiện tại / ...
Nạp
Xuất
Lọc
Thêm bằng AI
[Thêm lệnh sản xuất ▼]

MASTER GRID
Ngày
Số lệnh
Diễn giải
Đã lập đủ PN
Đã lập đủ PX
Tình trạng
Chi nhánh
Chức năng

ROW ACTION
Lập phiếu xuất (khi phù hợp)
Xem ▼
Lập phiếu nhập
Cập nhật tình trạng
Nhân bản
Xóa

QUICK DETAIL
Mã thành phẩm
Tên thành phẩm
ĐVT
Số lượng
Đơn đặt hàng
Hợp đồng bán
Đối tượng THCP
```

## 17.6. Lệnh sản xuất – Full Detail

```text
THÔNG TIN LỆNH
Số lệnh
Ngày
Diễn giải
Trạng thái
Đơn hàng / Hợp đồng / Đối tượng THCP

THÀNH PHẨM
Mã
Tên
ĐVT
Số lượng
Thông tin theo dõi

ĐỊNH MỨC / NVL
Nguyên vật liệu
ĐVT
Định mức
Số lượng cần

RELATED DOCUMENTS
Phiếu xuất NVL
Phiếu nhập thành phẩm
Tình trạng lập đủ PN/PX
```

## 17.7. Lắp ráp / Tháo dỡ

```text
LIST
Lọc loại: Lắp ráp | Tháo dỡ
Lọc trạng thái nhập kho
Lọc trạng thái xuất kho
Search
Nạp
Xuất
[+ Thêm]

BULK
Xóa

ROW
Xem
Xóa
Nhân bản
Lập phiếu nhập / xuất liên quan theo tình trạng

DETAIL
Thành phẩm / bộ phận
NVL / cấu thành
Số lượng
Phiếu nhập liên quan
Phiếu xuất liên quan
```

## 17.8. Kiểm kê kho

```text
DANH SÁCH KIỂM KÊ
Search
Kho
Thời gian
Trạng thái
Nạp
Xuất
[+ Thêm kiểm kê]

ROW
Xem / Sửa
Xóa
Lập chứng từ xử lý chênh lệch nếu có

BIÊN BẢN
Kho / địa điểm
Danh sách VTHH
Theo sổ
Thực kiểm
Chênh lệch
Nguyên nhân
Xử lý
Ghi chú / kết luận
```

[TT99] Có thể đối chiếu với mẫu 05-VT và các biểu mẫu kiểm nghiệm/tồn cuối kỳ thuộc Phụ lục I.

## 17.9. Hàng hóa, dịch vụ

```text
HÀNG HÓA, DỊCH VỤ
├─ Danh sách hàng hóa/dịch vụ
├─ Nhóm
├─ Đơn vị tính
├─ Định mức / cấu thành nếu có
├─ Chính sách giá / giá bán liên quan
├─ Theo dõi tồn
├─ Theo dõi lô/hạn dùng nếu cấu hình
└─ Import / Export
```

## 17.10. Tiện ích Kho

[MISA] Các tiện ích nhỏ cần có vị trí:

```text
Tính giá xuất kho
Cập nhật giá nhập kho thành phẩm
Xem giá trị phiếu nhập kho (theo quyền)
Sắp xếp thứ tự chứng từ nhập/xuất
Xem giá vốn trên phiếu xuất/chuyển/báo cáo (theo quyền)
Kiểm tra đối chiếu Kho – Mua hàng
Kiểm tra đối chiếu Kho – Bán hàng
```

---

# 18. CÔNG CỤ DỤNG CỤ / CHI PHÍ TRẢ TRƯỚC — ĐÃ AUDIT LẠI THEO UI AMIS 2026

> **Sửa quan trọng so với bản trước:** Không được đưa `Ghi tăng / Phân bổ / Điều chỉnh / Điều chuyển / Ghi giảm / Kiểm kê` thành các tab cấp cao ngang với `Sổ theo dõi CCDC`.  
> Ảnh giao diện AMIS và Help hiện tại cho thấy phân hệ này có cấu trúc **2 tầng tab**.

## 18.1. Level 2 — Module Tab Bar

```text
CÔNG CỤ DỤNG CỤ
├─ Quy trình
├─ Sổ theo dõi công cụ dụng cụ
├─ Quản lý công cụ dụng cụ
├─ Chi phí trả trước
└─ Báo cáo
```

Đây là thanh tab ngang cấp cao mà Frontend cần dựng.

---

## 18.2. Tab `Quy trình`

Đây là workspace sơ đồ nghiệp vụ/shortcut, không phải danh sách chứng từ.

```text
QUY TRÌNH CCDC
│
├─ Ghi tăng CCDC
├─ Ghi tăng CCDC hàng loạt
├─ Phân bổ chi phí CCDC
├─ Điều chỉnh CCDC
├─ Điều chuyển CCDC
├─ Ghi giảm CCDC
├─ Kiểm kê CCDC
│
├─ Chi phí trả trước
│  ├─ Ghi nhận / khai báo CPTT
│  ├─ Phân bổ CPTT
│  └─ Ghi giảm CPTT
│
└─ Shortcut / tiện ích liên quan
   ├─ Loại công cụ dụng cụ
   ├─ Đơn vị sử dụng
   ├─ Kiểm tra đối chiếu CCDC – CPTT – Sổ cái
   └─ Báo cáo liên quan
```

Các chức năng nhỏ đã xác minh từ Help AMIS:

```text
Ghi tăng CCDC
Ghi tăng CCDC hàng loạt
Lấy CCDC từ chứng từ xuất kho / mua hàng
Lấy CCDC từ chứng từ ghi giảm TSCĐ
Thiết lập phân bổ
Phân bổ chi phí CCDC
Điều chỉnh
Điều chuyển
Ghi giảm
Kiểm kê
```

---

## 18.3. Tab `Sổ theo dõi công cụ dụng cụ`

Bên trong tab này lại có **view cấp 3**:

```text
[Theo công cụ dụng cụ]
[Theo đơn vị sử dụng]
```

### 18.3.1. Toolbar

```text
Search
Lọc trạng thái
Lọc đơn vị sử dụng
Nạp
Xuất Excel
Tùy chỉnh hiển thị nếu có
```

### 18.3.2. View `Theo công cụ dụng cụ`

```text
MASTER LIST
Mã CCDC
Tên CCDC
Loại / Nhóm
Ngày ghi tăng
Số lượng
Giá trị
Số kỳ phân bổ
Số kỳ còn lại
Giá trị đã phân bổ
Giá trị còn lại
Đơn vị sử dụng
Trạng thái
Chức năng
```

Khi chọn/mở một CCDC:

```text
CHI TIẾT CCDC
├─ Thông tin chung
├─ Đơn vị đang sử dụng
├─ Số lượng theo từng đơn vị
└─ Nguồn gốc hình thành
   ├─ Chứng từ ghi tăng
   ├─ Chứng từ phân bổ
   ├─ Chứng từ điều chỉnh
   ├─ Chứng từ điều chuyển
   └─ Chứng từ ghi giảm
```

Người dùng có thể click số chứng từ để mở chứng từ gốc.

### 18.3.3. View `Theo đơn vị sử dụng`

```text
Đơn vị / Phòng ban
└─ Các CCDC đang sử dụng
   ├─ Mã CCDC
   ├─ Tên CCDC
   ├─ Số lượng tăng
   ├─ Số lượng giảm
   ├─ Số lượng còn lại
   ├─ Tổng giá trị
   ├─ Đã phân bổ
   └─ Còn lại
```

---

## 18.4. Tab `Quản lý công cụ dụng cụ`

Đây mới là nơi chứa **inner tab cấp 3**:

```text
QUẢN LÝ CÔNG CỤ DỤNG CỤ
├─ Ghi tăng
├─ Phân bổ chi phí
├─ Điều chỉnh
├─ Điều chuyển
├─ Ghi giảm
└─ Kiểm kê
```

### 18.4.1. Inner tab `Ghi tăng`

```text
TOOLBAR
Search
Kỳ / thời gian
Lọc
Nạp
Xuất Excel
[Thêm ▼]
   ├─ Thêm ghi tăng
   └─ Nhập từ Excel
```

Các entry point tạo khác:

```text
Ghi tăng CCDC hàng loạt
Lấy CCDC từ chứng từ xuất kho / mua hàng
Lấy CCDC từ chứng từ ghi giảm TSCĐ
```

Grid:

```text
Ngày ghi tăng
Số chứng từ
Mã CCDC
Tên CCDC
Loại / Nhóm
Số lượng
Giá trị
Số kỳ phân bổ
Đơn vị sử dụng
Chi nhánh
Chức năng
```

Row action:

```text
Xem / Sửa
Xóa
In
```

Full Document `Ghi tăng CCDC`:

```text
THÔNG TIN CHUNG
├─ Số chứng từ
├─ Ngày ghi tăng
├─ Mã / Tên CCDC
├─ Loại / Nhóm CCDC
├─ Số lượng / Đơn giá / Giá trị
├─ Số kỳ phân bổ
├─ Ngày bắt đầu phân bổ
└─ Ngừng phân bổ

ĐƠN VỊ SỬ DỤNG
├─ Đơn vị / phòng ban
└─ Số lượng sử dụng

THIẾT LẬP PHÂN BỔ
├─ Đối tượng phân bổ
├─ Tỷ lệ
├─ TK chi phí
├─ Khoản mục chi phí
└─ Các đối tượng theo dõi

NGUỒN GỐC HÌNH THÀNH
├─ Chọn chứng từ nguồn
├─ Các dòng hạch toán nguồn
└─ Giá trị liên kết
```

### 18.4.2. Inner tab `Phân bổ chi phí`

```text
LIST
Search
Kỳ
Nạp
Xuất
Cột
[Thêm phân bổ]

Bulk:
Bỏ ghi
Xóa
Ghi sổ (theo trạng thái)
```

Full Document:

```text
Kỳ phân bổ

TAB TÍNH PHÂN BỔ
├─ CCDC
├─ Giá trị
├─ Giá trị còn lại
├─ Số kỳ còn lại
└─ Số tiền phân bổ kỳ này

TAB PHÂN BỔ
├─ Đối tượng phân bổ
├─ Tỷ lệ
├─ TK chi phí
├─ Khoản mục chi phí
└─ Thiết lập phân bổ cho nhiều CCDC cùng lúc

TAB HẠCH TOÁN
└─ Bút toán phân bổ
```

### 18.4.3. Inner tab `Điều chỉnh`

```text
LIST
Search | Kỳ | Nạp | Xuất | Thêm

DOCUMENT
CCDC
Thông tin trước điều chỉnh
Thông tin sau điều chỉnh
Giá trị / thời gian phân bổ
Tập hợp chứng từ nguồn nếu liên quan
Hạch toán
Lý do
```

Actions:

```text
Thêm
Xem/Sửa
Xóa
Ghi sổ
Bỏ ghi
In
```

### 18.4.4. Inner tab `Điều chuyển`

```text
DOCUMENT
Ngày điều chuyển
CCDC
Đơn vị cũ
Đơn vị mới
Số lượng
Lý do
Thông tin liên quan
```

Actions:

```text
Thêm
Xem/Sửa
Xóa
Ghi sổ
Bỏ ghi
In
Xuất Excel
```

### 18.4.5. Inner tab `Ghi giảm`

```text
DOCUMENT
Ngày ghi giảm
Lý do ghi giảm
CCDC
Đơn vị sử dụng
Số lượng giảm
Giá trị CCDC
Giá trị đã phân bổ
Giá trị còn lại
Hạch toán / xử lý giá trị còn lại nếu có
```

Actions:

```text
Thêm ghi giảm CCDC
Xem/Sửa
Xóa
Ghi sổ
Bỏ ghi
In
Xuất Excel
```

### 18.4.6. Inner tab `Kiểm kê`

```text
LIST
Search | Kỳ | Nạp | Xuất | Thêm kiểm kê
```

Full Document kiểm kê có **3 tab nhỏ đã xác minh**:

```text
[Công cụ dụng cụ]
[Thành viên tham gia]
[Kết quả xử lý]
```

Tab `Công cụ dụng cụ`:

```text
Danh sách CCDC theo sổ
Số lượng thực tế còn tốt
Số lượng hỏng
Chênh lệch
Kiến nghị xử lý
```

Tab `Thành viên tham gia`:

```text
Danh sách thành viên
Chức vụ
Đại diện
Vai trò
```

Tab `Kết quả xử lý`:

```text
Kết luận kiểm kê
Hướng xử lý
Ghi chú
```

Actions:

```text
Cất
In Biên bản kiểm kê CCDC
```

---

## 18.5. Tab `Chi phí trả trước`

Ảnh AMIS người dùng cung cấp xác nhận tab này có **3 inner tab cấp 3**:

```text
CHI PHÍ TRẢ TRƯỚC
├─ Danh sách chi phí trả trước
├─ Phân bổ chi phí trả trước
└─ Ghi giảm
```

### 18.5.1. `Danh sách chi phí trả trước`

Toolbar đúng pattern ảnh:

```text
Search
Kỳ / thời gian
Nạp
Xuất
⚙ Tùy chỉnh
Lọc
[Thêm chi phí trả trước ▼]
   └─ Nhập từ Excel
```

Grid nên có các nhóm thông tin:

```text
Mã CPTT
Tên CPTT
Ngày bắt đầu phân bổ
Ngày ghi nhận
Số kỳ phân bổ
Số kỳ còn lại
Số tiền
Đã phân bổ
Còn lại
TK chờ phân bổ
Chi nhánh
Chức năng
```

Row action:

```text
Xem
Sửa
Xóa
```

Full Detail:

```text
THÔNG TIN CHUNG
Mã CPTT
Tên CPTT
Ngày ghi nhận
Số kỳ phân bổ
Giá trị
Ngừng phân bổ

TẬP HỢP CHỨNG TỪ
Chọn chứng từ nguồn
Các dòng hạch toán TK 242 liên quan

THIẾT LẬP PHÂN BỔ
Đối tượng
Tỷ lệ
TK chi phí
Khoản mục chi phí
```

### 18.5.2. `Phân bổ chi phí trả trước`

```text
LIST
Search | Kỳ | Nạp | Xuất | Cột | [Thêm phân bổ CPTT]

FULL DOCUMENT
├─ Kỳ phân bổ
├─ Tab Tính phân bổ
├─ Tab Phân bổ
└─ Tab Hạch toán
```

Các action:

```text
Thêm
Xem/Sửa
Xóa
Ghi sổ
Bỏ ghi
In
Xuất Excel
```

Trên tab Hạch toán có thể hiển thị/thiết lập cột:

```text
Chi phí không hợp lý
```

### 18.5.3. `Ghi giảm`

Đây là chức năng mới được AMIS bổ sung trong 2026.

```text
LIST
Search | Kỳ | Nạp | Xuất | [Thêm ghi giảm CPTT]

DOCUMENT
Ngày
Lý do ghi giảm
Chi phí trả trước
Số tiền còn lại
Thông tin xử lý
Hạch toán
Tham chiếu

ACTION
Cất
Xem/Sửa
Xóa
Ghi sổ/Bỏ ghi nếu nghiệp vụ áp dụng
```

---

## 18.6. Tab `Báo cáo`

Bên trong cần chia tiếp theo nhóm, không chỉ để một nút `Báo cáo`.

```text
BÁO CÁO CCDC
├─ Báo cáo Công cụ dụng cụ
│  ├─ Bảng tính phân bổ công cụ dụng cụ
│  ├─ Sổ theo dõi công cụ dụng cụ
│  ├─ Bảng tính phân bổ công cụ dụng cụ theo năm
│  ├─ Báo cáo chi tiết giảm công cụ dụng cụ
│  └─ Sổ theo dõi công cụ dụng cụ theo đơn vị sử dụng
│
├─ Báo cáo Chi phí trả trước
│  ├─ Tình hình phân bổ chi phí trả trước
│  ├─ Bảng tính phân bổ chi phí trả trước
│  └─ Tình hình phân bổ chi phí trả trước theo năm
│
└─ Báo cáo đối chiếu
   └─ Đối chiếu sổ theo dõi CCDC, CPTT và Sổ cái
```

Một Report Viewer:

```text
Chọn tham số
Xem báo cáo
Sửa mẫu hiện tại
Gửi email
In
Xuất Excel dạng dữ liệu
Xuất Excel dạng mẫu in
```

---

## 18.7. Liên kết chéo với các phân hệ khác

CCDC/CPTT không hoạt động độc lập:

```text
Mua hàng / Tiền mặt / Tiền gửi / Tổng hợp
        ↓ chứng từ hạch toán TK 242
Ghi tăng CCDC / CPTT
        ↓
Nguồn gốc hình thành / Tập hợp chứng từ
        ↓
Phân bổ
        ↓
Sổ cái / Báo cáo
```

Các nguồn CCDC đặc biệt:

```text
Xuất kho CCDC ra sử dụng
Mua CCDC đưa vào sử dụng ngay
Chuyển TSCĐ thành CCDC
```

Vì vậy trong frontend cần có `Select source document` và `Related document` thay vì nhập CCDC như một danh mục độc lập.

---

## 18.8. Nguồn audit cho phân hệ CCDC

Các trang Help AMIS đã dùng để rà lại:

```text
https://helpact.misa.vn/kb/so_theo_doi_ccdc/
https://helpact.misa.vn/kb/theodoi_va_phanbo_chiphitratruoc/
https://helpact.misa.vn/kb/html_18030100/
https://helpact.misa.vn/kb/html_18030200/
https://helpact.misa.vn/kb/html_18040200/
https://helpact.misa.vn/kb/kiem_ke_ccdc/
https://helpact.misa.vn/kb/bao_cao_ccdc/
https://helpact.misa.vn/kb/cac-cau-hoi-thuong-gap-lien-quan-den-cong-cu-dung-cu-chi-phi-tra-truoc/
```

---


# 19. TÀI SẢN CỐ ĐỊNH

```text
TÀI SẢN CỐ ĐỊNH
├─ Sổ tài sản
├─ Ghi tăng
├─ Đánh giá lại
├─ Tính khấu hao
├─ Điều chuyển
├─ Ghi giảm
├─ Kiểm kê
├─ Chuyển đổi TSCĐ thuê tài chính      [OPTION]
└─ Báo cáo
```

## 19.1. Sổ tài sản

```text
TOOLBAR
Search
Lọc
Cột
Xuất
[+ Khai báo tài sản]

LIST
Mã TSCĐ
Tên
Nhóm
Ngày ghi tăng
Nguyên giá
Hao mòn lũy kế
Giá trị còn lại
Đơn vị sử dụng
Trạng thái
...

DETAIL
Thông tin tài sản
Thông tin khấu hao
Nguyên giá / Giá trị còn lại
Đơn vị sử dụng
Nguồn gốc hình thành
Tài liệu đính kèm
Lịch sử biến động
Chứng từ liên quan
```

## 19.2. Ghi tăng TSCĐ

```text
HEADER CHỨNG TỪ GHI TĂNG

DANH SÁCH TÀI SẢN
Mỗi tài sản có:
├─ Thông tin chung
├─ Thông tin khấu hao
├─ Nguyên giá
├─ Thời gian sử dụng
├─ TK nguyên giá
├─ TK hao mòn
├─ TK chi phí
├─ Đơn vị sử dụng
├─ Nguồn hình thành
└─ Đính kèm biên bản/hồ sơ

ACTION
Ghi tăng
In
Xem/Sửa/Xóa theo quyền
```

## 19.3. Đánh giá lại

```text
LIST
Search
Kỳ
Nạp
Xuất
[+ Thêm]

ROW
Xem/Sửa
Xóa
Ghi sổ
Bỏ ghi
In

DETAIL
Tài sản
Giá trị đang ghi sổ
Giá trị đánh giá lại
Chênh lệch
Thông tin biên bản
Hạch toán
```

## 19.4. Tính khấu hao

```text
DANH SÁCH BẢNG KHẤU HAO
Kỳ
Search
Nạp
Xuất
Cột
[+ Thêm bảng tính]

ROW
Xem/Sửa
Ghi sổ
Bỏ ghi
Xóa
In

DETAIL
Tài sản
Nguyên giá
Giá trị tính khấu hao
Thời gian sử dụng
Khấu hao kỳ này
Hao mòn lũy kế
Giá trị còn lại
Tài khoản
Khoản mục
Bộ phận / đơn vị
```

## 19.5. Điều chuyển

```text
LIST + DOCUMENT
Tài sản
Đơn vị cũ
Đơn vị mới
Ngày điều chuyển
Người quản lý cũ / mới nếu theo dõi
Lý do
Ghi sổ / Bỏ ghi
Đính kèm
```

## 19.6. Ghi giảm

```text
Tài sản
Lý do ghi giảm
Ngày
Nguyên giá
Hao mòn
Giá trị còn lại
Thanh lý / Nhượng bán / Mất / Khác
Hạch toán
Tham chiếu chứng từ bán/thu nếu có
```

## 19.7. Kiểm kê

```text
Theo sổ kế toán
Thực kiểm
Chênh lệch số lượng
Chênh lệch nguyên giá
Chênh lệch giá trị còn lại
Nơi sử dụng
Ý kiến xử lý
```

[TT99] Có vị trí cho Biên bản tổng hợp kiểm kê TSCĐ, biên bản đánh giá lại, giao nhận, thanh lý, bàn giao sửa chữa/nâng cấp và bảng tính/phân bổ khấu hao.

## 19.8. Chuyển đổi TSCĐ thuê tài chính [OPTION]

```text
List
Thêm
Sửa
Xóa
Ghi sổ
Bỏ ghi
In
Xuất

Detail
Tài sản thuê
Thông tin chuyển đổi
Ngày
Giá trị
Hạch toán
Tài liệu liên quan
```

---

# 20. TIỀN LƯƠNG — ĐÃ SỬA LẠI CẤP TAB

> Bản trước đã nhầm một số **node trong Quy trình** thành **tab cấp cao**.  
> Help AMIS 2026 xác minh cấu trúc khi dùng Tiền lương trên AMIS Kế toán như sau:

```text
TIỀN LƯƠNG
├─ Quy trình
├─ Chấm công
├─ Tổng hợp chấm công
├─ Tính lương
├─ Hạch toán chi phí
├─ Khấu trừ thuế TNCN
└─ Báo cáo
```

`Trả lương` và `Nộp bảo hiểm` là các bước/nghiệp vụ trong **Quy trình**, không mặc định phải là tab cấp cao.

## 20.0A. Bên trong `Quy trình`

```text
Chấm công
   ↓
Tổng hợp chấm công
   ↓
Tính lương
   ↓
Hạch toán chi phí
   ↓
Trả lương
   ↓
Nộp bảo hiểm

Shortcut:
Nhân viên
Ký hiệu chấm công
Biểu thuế TNCN
Quy định lương, bảo hiểm, thuế TNCN
Tùy chọn
```

## 20.0B. Nếu kết nối AMIS Tiền lương

UI thay đổi theo mode kết nối:

```text
Quy trình
├─ Tính lương trên AMIS Tiền lương
├─ Đề nghị hạch toán chi phí lương
├─ Đề nghị chi trả tiền lương
├─ Hạch toán chi phí
├─ Trả lương
└─ Nộp bảo hiểm
```

Các workspace nhận dữ liệu:

```text
Đề nghị hạch toán chi phí lương
→ Xem
→ Lập chứng từ
→ Xóa
→ Search / Lọc / Nạp / Xuất
→ Thiết lập TK hạch toán

Đề nghị chi trả tiền lương
→ Xem
→ Chi tiền gửi
→ Chi tiền mặt
→ Xóa
→ Search / Lọc / Nạp / Xuất
→ Thiết lập TK hạch toán
```

## 20.1. Quy trình

```text
Chấm công
   ↓
Tổng hợp chấm công
   ↓
Tính lương
   ↓
Hạch toán chi phí
   ↓
Trả lương
   ↓
Nộp bảo hiểm

SHORTCUT
Nhân viên
Ký hiệu chấm công
Biểu tính thuế TNCN
Quy định lương/BH/TNCN
Tùy chọn
```

## 20.2. Chấm công

```text
LIST
Search
Kỳ
Lọc
Nạp
Xuất
[+ Thêm bảng chấm công]

ROW
Xem
Xóa

DETAIL
Kỳ
Nhân viên
Ngày / ca / giờ / ký hiệu công
Nghỉ
Làm thêm
Tổng công
```

## 20.3. Tổng hợp chấm công

```text
LIST
Search | Kỳ | Nạp | Xuất | [+ Thêm]
Row: Xem | Xóa

DETAIL
Nhân viên
Công hưởng lương
Nghỉ hưởng lương
Nghỉ không lương
Làm thêm ngày thường
Làm thêm cuối tuần
Làm thêm ngày lễ
Làm thêm ban đêm
Các tổng hợp khác
```

## 20.4. Tính lương

```text
LIST
Search
Kỳ
Nạp
Xuất
[+ Thêm bảng lương]

ROW
Xem
Xóa
Phân bổ lương
Hạch toán lương

DETAIL
Nhân viên
Lương sản phẩm
Lương thời gian
Phụ cấp
Làm thêm
Tạm ứng
Bảo hiểm
Thuế TNCN
Các khoản khấu trừ
Thực lĩnh
```

[TT99] UI cần có khả năng in/biểu diễn các mẫu tiền lương theo Phụ lục I như Bảng thanh toán tiền lương, thưởng, làm thêm giờ, thuê ngoài, trích nộp, phân bổ.

## 20.5. Kết nối AMIS Tiền lương

```text
DANH SÁCH ĐỀ NGHỊ
├─ Đề nghị hạch toán chi phí lương
└─ Đề nghị chi trả tiền lương

ACTION
Xem
Lập chứng từ hạch toán
Lập Chi tiền mặt
Lập Chi tiền gửi
Xóa nếu được phép
Search
Lọc
Nạp
Xuất
Thiết lập tài khoản
```

---

# 21. THUẾ – CÂY GIAO DIỆN CHI TIẾT

**Lưu ý:** Module này cần tiếp tục được cập nhật theo pháp luật thuế hiện hành. TT99 chỉ là nền kế toán.

```text
THUẾ
├─ Khai thuế
│  ├─ Đăng ký tờ khai sử dụng
│  ├─ Danh sách tờ khai đã lập
│  ├─ Lập tờ khai
│  ├─ Khai bổ sung
│  └─ Giấy nộp tiền / nộp thuế (khi tích hợp)
├─ GTGT khấu trừ
├─ Khấu trừ thuế GTGT
├─ GTGT dự án đầu tư
├─ GTGT trực tiếp trên GTGT
├─ GTGT trực tiếp trên doanh thu
├─ TNCN 05/KK-TNCN
├─ Quyết toán TNCN 05/QTT-TNCN
├─ Quyết toán TNDN 03/TNDN
├─ TTĐB 01/TTĐB
├─ Thuế tài nguyên 01/TAIN
├─ Các loại thuế khác
├─ Tờ khai bổ sung
├─ Xuất XML
├─ Kết nối mTax / nộp hồ sơ
├─ Thiết lập cơ quan thuế / đại lý thuế / DV kế toán
└─ Báo cáo thuế
```

## 21.1. Khai thuế – List Workspace

```text
TOOLBAR
Kỳ
Loại tờ khai
Trạng thái
Search
Nạp
Xuất
[Đăng ký tờ khai sử dụng]
[Lập tờ khai ▼]
[Khai bổ sung ▼]
[Giấy nộp tiền] nếu tích hợp mTax

GRID
Kỳ
Mẫu tờ khai
Lần khai / bổ sung
Trạng thái
Ngày lập
Người lập
Chức năng

ROW
Xem
Sửa
Xóa
In
Xuất
Xuất XML
Nộp hồ sơ nếu tích hợp
```

## 21.2. Tờ khai – Document Workspace

```text
HEADER
Loại tờ khai
Kỳ
Lần khai
Trạng thái

TAB
Tờ khai chính
Phụ lục BKMV
Phụ lục BKBR
Các phụ lục khác tùy loại

TOOLBAR / ACTION
Chọn chứng từ/hóa đơn
Thêm phụ lục
Bỏ phụ lục
Tổng hợp
Kiểm tra
Cất
In
Xuất XML
Nộp qua mTax nếu kết nối

DETAIL
Các chỉ tiêu tờ khai
Danh sách hóa đơn/chứng từ nguồn
Thông tin cảnh báo
Kết quả đối chiếu
```

## 21.3. Khai bổ sung

```text
Chọn tờ khai / kỳ gốc
        ↓
Mở tờ khai bổ sung
        ↓
Sửa chỉ tiêu
        ↓
[Chọn HĐ thay thế/điều chỉnh khác kỳ] nếu có
        ↓
[Tổng hợp khai bổ sung]
        ↓
Phụ lục KHBS / giải trình
        ↓
[Cất]
        ↓
[Hạch toán điều chỉnh] nếu phát sinh
```

## 21.4. Thiết lập thuế

```text
Cơ quan thuế quản lý
Đại lý thuế
Đơn vị cung cấp dịch vụ kế toán
Đăng ký tờ khai sử dụng
Biểu thuế TTĐB
Biểu thuế tài nguyên
Biểu thuế TNCN / thiết lập liên quan
Kết nối dịch vụ nộp thuế
Thông tin chữ ký số nếu dùng
```

---

# 22. GIÁ THÀNH

```text
GIÁ THÀNH
├─ Sản xuất liên tục – Giản đơn
├─ Sản xuất liên tục – Hệ số, tỷ lệ
├─ Sản xuất liên tục – Phân bước
├─ Công trình
├─ Đơn hàng
├─ Hợp đồng
└─ Báo cáo
```

## 22.1. Khung chung của một phương pháp

```text
KỲ TÍNH GIÁ THÀNH
├─ Danh sách kỳ
├─ Thêm kỳ
├─ Xem
├─ Tính giá thành
├─ Kết chuyển chi phí
└─ Xóa / Ghi sổ theo nghiệp vụ

TRONG CHI TIẾT KỲ
├─ Tổng hợp chi phí
├─ Tập hợp chi phí trực tiếp
├─ Phân bổ chi phí chung
├─ Khoản giảm giá thành
├─ Đánh giá sản phẩm dở dang
├─ Bảng tính giá thành
├─ Tập hợp theo yếu tố
└─ Tập hợp theo khoản mục
```

## 22.2. Sản xuất liên tục – Giản đơn

```text
Kỳ tính giá
Đối tượng THCP
Thành phẩm
Chi phí trực tiếp
Chi phí chung
Phân bổ
Dở dang
Tính giá thành
Kết chuyển
```

## 22.3. Hệ số, tỷ lệ

```text
Kỳ tính giá
Nhóm sản phẩm
Hệ số / tỷ lệ
Chi phí tập hợp
Phân bổ theo hệ số/tỷ lệ
Dở dang
Kết quả giá thành từng sản phẩm
```

## 22.4. Phân bước

```text
Kỳ tính giá
Các bước / công đoạn
Đối tượng THCP theo bước
Chi phí từng bước
Chi phí chuyển tiếp
Dở dang từng bước
Giá thành bán thành phẩm
Giá thành thành phẩm
```

## 22.5. Công trình / Đơn hàng / Hợp đồng

```text
Đối tượng tính giá
Kỳ
Tập hợp chi phí
Phân bổ
Dự toán nếu có
Nghiệm thu
Kết chuyển
Kết quả lãi/lỗ / giá thành
Báo cáo chi phí
```

## 22.6. Tiện ích giá thành

```text
Khai báo nhanh chi phí dở dang đầu kỳ
Định mức giá thành
Định mức phân bổ chi phí
Kiểm tra đối chiếu giá thành
```

---

# 23. TỔNG HỢP

```text
TỔNG HỢP
├─ Quy trình
├─ Chứng từ nghiệp vụ khác
├─ Quyết toán tạm ứng
├─ Chứng từ ghi sổ
├─ Tính tỷ giá xuất quỹ
├─ Kết chuyển lãi lỗ
├─ Kết chuyển lợi nhuận năm nay sang năm trước
├─ Đánh giá lại tài khoản ngoại tệ
├─ Phân bổ chi phí bán hàng / QLDN / chi phí khác
├─ Phân bổ chi phí cho chi nhánh
├─ Khóa sổ / Bỏ khóa sổ
├─ Lập BCTC
├─ Lập BCTC tổng hợp
├─ Lập BCTC giữa niên độ
├─ Dữ liệu phục vụ hợp nhất              [OPTION]
├─ Thiết lập BCTC
├─ Chọn nghiệp vụ cho KQHĐKD
├─ Chọn hoạt động LCTT
├─ Kiểm tra đối chiếu chứng từ-sổ sách
└─ Báo cáo tổng hợp
```


## 23.0. Phân biệt Tab cấp cao và chức năng trong `Quy trình`

Không nên render toàn bộ danh sách dưới đây thành tab ngang.

Các entry point được Help AMIS xác minh rõ:

```text
TỔNG HỢP
├─ Quy trình
├─ Chứng từ nghiệp vụ khác
├─ Lập báo cáo tài chính
└─ Dữ liệu phục vụ hợp nhất        [OPTION theo mô hình/gói]
```

Trong `Quy trình` mới chứa các action/shortcut:

```text
Chứng từ nghiệp vụ khác
Quyết toán tạm ứng
Chứng từ ghi sổ
Kết chuyển lợi nhuận năm nay sang năm trước
Tính tỷ giá xuất quỹ
Kết chuyển lãi lỗ
Đánh giá lại tài khoản ngoại tệ
Phân bổ chi phí bán hàng / QLDN / chi phí khác
Lập BCTC
Khóa sổ / Bỏ khóa sổ
Chọn hoạt động LCTT
Chọn nghiệp vụ cho KQHĐKD
Kiểm tra đối chiếu chứng từ – sổ sách
```

`Lập báo cáo tài chính` là một tab/workspace riêng có danh sách các bộ BCTC đã lập và menu:

```text
Lập báo cáo tài chính
Lập báo cáo tài chính tổng hợp
Lập báo cáo tài chính giữa niên độ
Thuyết minh báo cáo tài chính
```

## 23.1. Quy trình Tổng hợp

```text
Chứng từ nghiệp vụ khác
Quyết toán tạm ứng
Tỷ giá xuất quỹ
Đánh giá ngoại tệ
Phân bổ
Kết chuyển
Khóa sổ
Báo cáo tài chính

SHORTCUT
Hệ thống tài khoản
Tài khoản kết chuyển
Thiết lập BCTC
Báo cáo sổ sách
Kiểm tra đối chiếu
```

## 23.2. Chứng từ nghiệp vụ khác

```text
LIST
Search
Kỳ
Lọc
Nạp
Xuất
Cột
[+ Thêm]

BULK
Ghi sổ
Bỏ ghi
Xóa

ROW
Xem
Ghi sổ
Bỏ ghi
Xóa
Nhân bản

DETAIL
Thông tin chung
Tab Hạch toán
Tab Kê khai hóa đơn / Thuế khi có
Tab Thống kê
Thông tin bổ sung
Tham chiếu
Đính kèm
```

## 23.3. Quyết toán tạm ứng

```text
DANH SÁCH QUYẾT TOÁN
Search | Kỳ | NV | Nạp | Xuất | Thêm

DETAIL
Nhân viên
Khoản tạm ứng
Số tạm ứng kỳ trước
Số tạm ứng kỳ này
Danh sách chứng từ chi thực tế
Số đã chi
Chênh lệch
Hoàn ứng / Chi thêm
Hạch toán
Ghi sổ
```

[TT99] Có thể in/đối chiếu với Giấy thanh toán tiền tạm ứng 04-TT.

## 23.4. Kết chuyển lãi lỗ

```text
Chọn kỳ
↓
Preview bút toán kết chuyển
↓
Chọn / bỏ chọn dòng
↓
Ghi sổ
↓
Xem chứng từ kết chuyển
↓
Bỏ ghi / lập lại nếu cần
```

## 23.5. Đánh giá lại ngoại tệ

```text
Chọn kỳ
Chọn tài khoản / đối tượng ngoại tệ
Tỷ giá đánh giá
Số dư nguyên tệ
Số dư quy đổi
Chênh lệch
Bút toán đánh giá
Ghi sổ
```

## 23.6. Phân bổ chi phí

```text
Chọn kỳ
Nguồn chi phí
Đối tượng nguồn
Tiêu thức phân bổ
Đối tượng nhận
Preview kết quả phân bổ
Chỉnh phân bổ nếu được phép
Ghi sổ
Xem chứng từ
```

## 23.7. Khóa sổ

```text
KHÓA SỔ
├─ Chọn kỳ
├─ Xem tình trạng sổ
├─ Kiểm tra dữ liệu trước khóa
├─ Danh sách vấn đề chưa xử lý
├─ Khóa sổ
├─ Bỏ khóa sổ
└─ Lịch sử khóa / mở
```

[TT99] Khóa sổ là một workspace riêng quan trọng vì sổ kế toán phải được khóa tại thời điểm kết thúc kỳ kế toán để lập BCTC.

## 23.8. Lập Báo cáo tài chính

```text
DANH SÁCH BCTC ĐÃ LẬP
[+ Lập BCTC]
[+ BCTC tổng hợp]
[+ BCTC giữa niên độ]

MỘT BỘ BCTC [TT99]
├─ Báo cáo tình hình tài chính
├─ Báo cáo kết quả hoạt động kinh doanh
├─ Báo cáo lưu chuyển tiền tệ
└─ Bản thuyết minh Báo cáo tài chính

ACTION
Xem
Sửa
Xóa
In
Xuất
Thiết lập chỉ tiêu
Chọn nghiệp vụ cho KQHĐKD
Chọn hoạt động LCTT
```

---

# 24. NGÂN SÁCH [OPTION]

```text
NGÂN SÁCH
├─ Kế hoạch ngân sách
├─ Biểu đồ
├─ Cảnh báo vượt dự toán
└─ Báo cáo ngân sách
```

## 24.1. Kế hoạch ngân sách

```text
LIST
Năm
Đơn vị / phòng ban
Dự toán theo tháng / quý
Doanh thu
Chi phí
Thuế TNDN
Lợi nhuận
Trạng thái

ACTION
Thêm
Sửa
Xóa
In
Xuất
Nhân bản nếu hỗ trợ
```

### Detail

```text
Năm ngân sách
Đơn vị / phòng ban
Theo tháng / quý
Doanh thu dự toán
Chi phí dự toán
Các chỉ tiêu ngân sách
Ghi chú
Phê duyệt nếu có workflow
```

## 24.2. Biểu đồ

```text
Kế hoạch
Thực hiện
Chênh lệch
% thực hiện
Theo đơn vị
Theo nhóm chỉ tiêu
```

## 24.3. Cảnh báo vượt dự toán

```text
Danh sách chỉ tiêu vượt
Ngân sách được duyệt
Số đã thực hiện
Số còn lại
Mức vượt
Đơn vị
Chứng từ liên quan
```

---

# 25. PHÂN TÍCH TÀI CHÍNH [OPTION]

```text
PHÂN TÍCH TÀI CHÍNH
├─ Chỉ số phân tích tài chính
├─ Báo cáo phân tích
└─ AVA / AI phân tích tài chính [OPTION theo gói]
```

## 25.1. Chỉ số tài chính

```text
Thanh khoản
Cơ cấu tài sản / nguồn vốn
Khả năng thanh toán
Hiệu quả hoạt động
Khả năng sinh lời
Dòng tiền
So sánh kỳ
So sánh chi nhánh
```

## 25.2. Báo cáo phân tích

```text
So sánh Bảng cân đối giữa nhiều kỳ / chi nhánh
So sánh KQHĐKD
Phân tích doanh thu
Phân tích chi phí
Phân tích lợi nhuận
Phân tích dòng tiền
```

---

# 26. KẾT NỐI VAY VỐN [OPTION]

[MISA] AMIS có entry point kết nối vay vốn với nền tảng MISA Lending. Nếu sản phẩm không tích hợp đối tác lending thì để phase sau.

```text
KẾT NỐI VAY VỐN
├─ Giới thiệu / trạng thái kết nối
├─ Danh sách gói vay
├─ Xem chi tiết gói vay
├─ Nộp hồ sơ
├─ Theo dõi hồ sơ
├─ Bổ sung hồ sơ
└─ Theo dõi khoản vay / trạng thái giải ngân
```

---

# 27. REPORT CENTER – TRUNG TÂM BÁO CÁO

[MISA] Báo cáo là entry point riêng, có tìm kiếm, báo cáo đã lưu, yêu thích và phân nhóm theo phân hệ.

```text
BÁO CÁO
├─ Tìm báo cáo
├─ Báo cáo đã lưu
├─ Báo cáo yêu thích
└─ NHÓM
   ├─ Báo cáo tài chính
   ├─ Báo cáo phân tích
   ├─ Tiền mặt
   ├─ Tiền gửi
   ├─ Mua hàng
   ├─ Bán hàng
   ├─ Kho
   ├─ Công cụ dụng cụ
   ├─ Tài sản cố định
   ├─ Tiền lương
   ├─ Thuế
   ├─ Giá thành
   ├─ Tổng hợp
   ├─ Ngân sách
   └─ Báo cáo đối chiếu
```

## 27.1. Màn hình chọn báo cáo

```text
LEFT PANEL
Nhóm báo cáo

MAIN
Search
Yêu thích
Đã lưu
Danh sách báo cáo

MỖI BÁO CÁO
Tên
Mô tả ngắn
★ Yêu thích
Mở
```

## 27.2. Màn hình chạy báo cáo

```text
TÊN BÁO CÁO
        ↓
THAM SỐ
├─ Kỳ
├─ Đơn vị / chi nhánh
├─ Tài khoản
├─ Đối tượng
├─ Kho
├─ Loại tiền
└─ Tham số riêng
        ↓
[Xem báo cáo]
        ↓
REPORT VIEWER
        ↓
In
Excel
PDF
Email
Sửa mẫu hiện tại (nếu hỗ trợ)
Lưu tham số / Lưu báo cáo [KHUNG]
```

## 27.3. Báo cáo tài chính [TT99]

Bắt buộc có vị trí rõ:

```text
Báo cáo tình hình tài chính
Báo cáo kết quả hoạt động kinh doanh
Báo cáo lưu chuyển tiền tệ
Bản thuyết minh Báo cáo tài chính
```

## 27.4. Nhóm Sổ sách kế toán [TT99]

Nên nằm trong `Báo cáo → Tổng hợp`:

```text
Sổ cái
Sổ nhật ký
Sổ chi tiết tài khoản
Bảng cân đối số phát sinh
Các sổ chi tiết nghiệp vụ
Sổ quỹ
Sổ tiền gửi
Sổ kho
Sổ tài sản / CCDC
```

---

# 28. DANH MỤC – CÂY ĐẦY ĐỦ

```text
DANH MỤC
├─ ĐỐI TƯỢNG
│  ├─ Khách hàng
│  ├─ Nhà cung cấp
│  ├─ Nhân viên
│  └─ Nhóm KH/NCC
├─ VẬT TƯ HÀNG HÓA
│  ├─ Vật tư, hàng hóa
│  ├─ Nhóm VTHH
│  ├─ Kho
│  ├─ Vị trí VTHH
│  └─ Đơn vị tính
├─ TÀI KHOẢN
│  ├─ Hệ thống tài khoản
│  ├─ Tài khoản kết chuyển
│  └─ Tài khoản ngầm định
├─ CHI PHÍ
│  ├─ Đối tượng THCP
│  ├─ Khoản mục chi phí
│  ├─ Loại công trình
│  └─ Công trình
├─ NGÂN HÀNG
│  ├─ Ngân hàng
│  └─ Tài khoản ngân hàng
├─ CƠ CẤU
│  ├─ Chi nhánh
│  └─ Phòng ban / cơ cấu tổ chức
├─ TÀI SẢN
│  ├─ Loại CCDC
│  └─ Loại TSCĐ
├─ THUẾ
│  ├─ Biểu thuế TTĐB
│  └─ Biểu thuế tài nguyên
├─ TIỀN LƯƠNG
│  ├─ Ký hiệu chấm công
│  └─ Biểu thuế TNCN
└─ KHÁC
   ├─ Điều khoản thanh toán
   ├─ Mục thu/chi
   ├─ Loại tiền
   ├─ Loại chứng từ
   └─ Mã thống kê
```

## 28.1. Pattern màn hình danh mục

```text
TOOLBAR
Search
Lọc
Xuất
Nhập Excel nếu hỗ trợ
[+ Thêm]

GRID / TREE
Mã
Tên
Nhóm
Trạng thái
Thông tin chính
Chức năng

ROW ACTION
Xem / Sửa
Xóa
Ngừng sử dụng / Kích hoạt
Nhân bản nếu có
Gộp nếu danh mục hỗ trợ
```

## 28.2. Khách hàng / Nhà cung cấp

```text
LIST
Mã
Tên
MST
Địa chỉ
Điện thoại
Email
Nhóm
Điều khoản thanh toán
Công nợ / hạn nợ nếu hiển thị
Trạng thái

DETAIL
Thông tin chung
Thông tin liên hệ
Thông tin thuế
Thông tin thanh toán
Tài khoản ngân hàng
Điều khoản thanh toán
Địa chỉ giao/nhận
Thông tin mở rộng
Lịch sử chứng từ / công nợ [KHUNG]
```

## 28.3. Vật tư, hàng hóa, dịch vụ

```text
LIST
Mã
Tên
Loại
Nhóm
ĐVT
Tính chất hàng hóa / dịch vụ
Theo dõi kho
Thuế suất
Giá mua / giá bán tham khảo nếu có
Trạng thái

DETAIL
Thông tin chung
Đơn vị tính / quy đổi
Thuế
Kho mặc định
Tài khoản ngầm định
Định mức / cấu thành nếu dùng
Theo dõi lô / hạn sử dụng nếu bật
Thông tin giá
Trường mở rộng
```

## 28.4. Hệ thống tài khoản [TT99]

```text
HỆ THỐNG TÀI KHOẢN
├─ Cây tài khoản
├─ Tài khoản cha / con
├─ Số hiệu
├─ Tên
├─ Tính chất
├─ Theo dõi chi tiết theo đối tượng
├─ Trạng thái sử dụng
└─ Thiết lập liên quan

TOOLBAR
Search
Thêm tài khoản
Sửa
Ngừng sử dụng / Kích hoạt
Xuất
```

[TT99] Không hard-code chỉ một cây tài khoản bất biến; doanh nghiệp có thể điều chỉnh/bổ sung theo quy định.

---

# 29. SỐ DƯ BAN ĐẦU – CÂY ĐẦY ĐỦ

```text
SỐ DƯ BAN ĐẦU
├─ Số dư tài khoản
├─ Số dư tài khoản ngân hàng
├─ Công nợ khách hàng
├─ Công nợ nhà cung cấp
├─ Công nợ nhân viên
├─ Doanh thu nhận trước đầu kỳ
├─ Chi phí trả trước đầu kỳ
├─ Tồn kho VTHH
├─ Chi phí dở dang
├─ CCDC đầu kỳ
└─ TSCĐ đầu kỳ
```

## 29.1. Pattern chung

```text
Chọn nhóm số dư
        ↓
Danh sách tài khoản / đối tượng
        ↓
Nhập trực tiếp
hoặc
Nhập Excel
        ↓
Tổng hợp / đối chiếu
        ↓
Cất
```

## 29.2. Số dư tài khoản

```text
Tài khoản
Dư Nợ
Dư Có
Nguyên tệ nếu có
Chi nhánh / đơn vị
Đối tượng chi tiết nếu tài khoản theo dõi
```

## 29.3. Tồn kho đầu kỳ

```text
Kho
Hàng hóa
ĐVT
Số lượng
Đơn giá
Giá trị
Lô / hạn dùng nếu theo dõi
```

---

# 30. CHẾ ĐỘ THỦ KHO [OPTION NHƯNG AMIS CÓ]

```text
THỦ KHO
├─ Danh sách phiếu / đề nghị nhập xuất
├─ Chưa ghi sổ kho
├─ Đã ghi sổ kho
├─ Ghi sổ kho
├─ Bỏ ghi sổ kho
├─ Biên bản kiểm kê
└─ Báo cáo kho
```

## 30.1. Workspace Thủ kho

```text
Search
Kỳ
Loại phiếu
Trạng thái
Kho

GRID
Ngày
Số phiếu
Loại
Người giao/nhận
Kho
Diễn giải
Trạng thái ghi sổ kho
Chức năng

BULK
Ghi sổ kho
Bỏ ghi sổ kho
```

[MISA] Workflow một chiều điển hình: Kế toán lập chứng từ nhập/xuất → Thủ kho kiểm tra → Ghi sổ kho. Nếu kế toán sửa, Thủ kho bỏ ghi/ghi lại theo quy trình.

---

# 31. CHẾ ĐỘ THỦ QUỸ [OPTION NHƯNG AMIS CÓ]

```text
THỦ QUỸ
├─ Đề nghị thu, chi
├─ Chưa ghi sổ quỹ
├─ Đã ghi sổ quỹ
├─ Ghi sổ quỹ
├─ Bỏ ghi sổ quỹ
├─ Biên bản kiểm kê
└─ Sổ quỹ tiền mặt
```

## 31.1. Workspace Thủ quỹ

```text
Search
Kỳ
Phiếu thu / Phiếu chi
Trạng thái

GRID
Ngày
Số phiếu
Người nộp/nhận
Lý do
Số tiền
Trạng thái
Chức năng

BULK
Ghi sổ quỹ
Bỏ ghi sổ quỹ
```

[MISA] Có thể ghi sổ nhiều phiếu và chọn ngày ghi sổ theo nghiệp vụ/cấu hình.

---

# 32. CÁC TIỆN ÍCH VÀ THIẾT LẬP – CÂY ĐẦY ĐỦ

```text
⚙ CÁC TIỆN ÍCH VÀ THIẾT LẬP
├─ NGHIỆP VỤ
│  ├─ Quản lý danh mục
│  └─ Nhập số dư ban đầu
│
├─ TIỆN ÍCH
│  ├─ Tìm kiếm chứng từ
│  ├─ Ghi sổ / Bỏ ghi theo lô
│  ├─ Đánh lại số chứng từ
│  ├─ Phục hồi chứng từ đã xóa nhầm
│  ├─ Lấy chứng từ từ dữ liệu khác
│  ├─ Kiểm tra đối chiếu chứng từ – sổ sách
│  ├─ Bảo trì dữ liệu
│  ├─ Nhật ký truy cập
│  ├─ Mã QR thanh toán
│  └─ Danh sách lệnh tính giá / bảo trì đang chạy
│
├─ CÔNG CỤ KHÁC
│  ├─ Chuyển đổi dữ liệu
│  ├─ Cập nhật số dư từ dữ liệu năm trước
│  └─ Xóa bộ nhớ đệm nâng cao
│
├─ CÔNG TY CỦA BẠN
│  ├─ Thông tin công ty
│  ├─ Quản lý người dùng và phân quyền
│  └─ Quản lý dữ liệu
│
└─ THIẾT LẬP
   ├─ Tùy chọn chung
   ├─ Ẩn/hiện nghiệp vụ
   ├─ Ngày hạch toán
   ├─ Kết nối ứng dụng
   ├─ Ngôn ngữ
   ├─ Chữ ký số
   ├─ Thiết lập email
   ├─ Mẫu email
   ├─ Quy tắc đánh số chứng từ
   ├─ Trường mở rộng
   ├─ Mẫu in / Sửa mẫu
   └─ Thiết lập hiển thị
```

## 32.1. Thông tin công ty

```text
Thông tin pháp lý
MST
Địa chỉ
Người đại diện
Thông tin liên hệ
Thông tin đơn vị trực thuộc / chi nhánh
Thông tin kế toán
Logo / mẫu in liên quan nếu dùng
```

## 32.2. Quản lý dữ liệu

```text
Danh sách bộ dữ liệu
Năm dữ liệu
Trạng thái
Tạo dữ liệu mới
Chuyển đổi dữ liệu
Sao lưu / phục hồi nếu sản phẩm hỗ trợ
Đóng/mở dữ liệu theo quyền
```

## 32.3. Ẩn/hiện nghiệp vụ

```text
Danh sách phân hệ
→ Danh sách nghiệp vụ
→ Có sử dụng / Không sử dụng
→ Tab hiển thị tương ứng
```

---

# 33. QUẢN LÝ NGƯỜI DÙNG / VAI TRÒ / PHÂN QUYỀN

[TT99] Đây là vùng quan trọng để phân định quyền, nghĩa vụ và trách nhiệm trong kiểm soát nội bộ.

```text
QUẢN LÝ NGƯỜI DÙNG VÀ PHÂN QUYỀN
├─ Tab Người dùng
└─ Tab Vai trò & quyền hạn
```

## 33.1. Tab Người dùng

```text
LIST
Tên người dùng
Email
Vai trò
Chi nhánh
Trạng thái
Lần truy cập cuối

ACTION
Thêm người dùng
Sửa
Gán vai trò
Gán chi nhánh / phạm vi dữ liệu
Khóa / mở người dùng
```

## 33.2. Tab Vai trò & quyền hạn

```text
DANH SÁCH VAI TRÒ
Thêm vai trò
Nhân bản vai trò
Xóa vai trò
Sửa tên/mô tả

DETAIL VAI TRÒ
├─ Quyền hạn của vai trò
└─ Người dùng thuộc vai trò
```

## 33.3. Cây quyền

```text
DANH MỤC
NGHIỆP VỤ
BÁO CÁO
HỆ THỐNG
TIỆN ÍCH
THIẾT LẬP
```

## 33.4. Quyền action thường gặp

```text
Sử dụng / Xem
Thêm
Sửa
Sửa nhanh
Xóa
Ghi sổ
Bỏ ghi
In
Xuất Excel
Ẩn/hiện cột
```

Quyền đặc thù:

```text
Duyệt / Từ chối
Xem giá vốn
Tính giá xuất kho
Chính sách giá
Ghi doanh số
Phát hành HĐĐT
Khóa sổ
Thiết lập BCTC
Khai / Nộp thuế
Quản trị người dùng
...
```

---

# 34. KIỂM TRA ĐỐI CHIẾU CHỨNG TỪ – SỔ SÁCH

[MISA] Đây là tiện ích kiểm soát lớn, không nên bỏ khỏi frontend.

```text
KIỂM TRA ĐỐI CHIẾU
├─ Tham số thời gian
├─ Chọn nhóm kiểm tra
└─ Kết quả
   ├─ 1. Trạng thái ghi sổ chứng từ
   ├─ 2. Tiền mặt, tiền gửi
   ├─ 3. Kho, mua hàng
   ├─ 4. Công nợ phải thu / phải trả
   ├─ 5. Tài sản cố định
   ├─ 6. CCDC, chi phí trả trước
   ├─ 7. Thuế GTGT
   ├─ 8. Kho, bán hàng
   ├─ 9. Giá thành
   ├─ 10. Bảng cân đối phát sinh
   └─ 11. Kết chuyển lãi lỗ
```

## 34.1. Kết quả đối chiếu

```text
MỖI LỖI / CẢNH BÁO
Mức độ
Nhóm
Mô tả vấn đề
Chứng từ / đối tượng liên quan
[Xem chứng từ]
[Xem hướng dẫn xử lý]
Trạng thái đã xử lý / chưa xử lý [KHUNG]
```

Ví dụ nhóm Kho/Mua:

```text
Hạch toán TK kho nhưng không ghi sổ kho
Xuất kho chưa tính giá
Giá trị kế toán lệch sổ kho
Chi phí mua chưa phân bổ
Tồn kho bất thường
```

---

# 35. KHỞI TẠO DỮ LIỆU KẾ TOÁN / ONBOARDING

[MISA] Bước thiết lập dữ liệu kế toán hiện hỗ trợ lựa chọn chế độ kế toán, trong đó có TT99/2025/TT-BTC.

```text
BƯỚC 1  Thông tin công ty
BƯỚC 2  Lĩnh vực / ngành nghề
BƯỚC 3  Thiết lập dữ liệu kế toán
         ├─ Chế độ kế toán
         ├─ Đồng tiền hạch toán
         ├─ Ngày bắt đầu dữ liệu
         ├─ Phương pháp tính giá xuất kho
         └─ Phương pháp tính thuế GTGT
BƯỚC 4  Khai báo / nhập danh mục
BƯỚC 5  Nhập số dư ban đầu
BƯỚC 6  Kiểm tra thiết lập
BƯỚC 7  Bắt đầu sử dụng
```

[KHUNG] Sau khi onboarding hoàn tất, hệ thống chuyển về Dashboard/Phân hệ mặc định và mở checklist dữ liệu còn thiếu nếu cần.

---

# 36. TRUNG TÂM MẪU CHỨNG TỪ / MẪU IN THEO TT99

[TT99] Phụ lục I ban hành danh mục biểu mẫu chứng từ. Frontend nên có `Mẫu in / Sửa mẫu hiện tại` để vừa cung cấp mẫu chuẩn vừa cho phép doanh nghiệp tùy chỉnh hợp lệ.

## 36.1. Lao động tiền lương

```text
01-LĐTL  Bảng thanh toán tiền lương
02-LĐTL  Bảng thanh toán tiền thưởng
03-LĐTL  Bảng thanh toán tiền làm thêm giờ
04-LĐTL  Bảng thanh toán tiền thuê ngoài
05-LĐTL  Hợp đồng giao khoán
06-LĐTL  Biên bản thanh lý (nghiệm thu) hợp đồng giao khoán
07-LĐTL  Bảng kê trích nộp các khoản theo lương
08-LĐTL  Bảng phân bổ tiền lương và các khoản trích theo lương
```

## 36.2. Hàng tồn kho

```text
01-VT  Phiếu nhập kho
02-VT  Phiếu xuất kho
03-VT  Biên bản kiểm nghiệm vật tư, công cụ, sản phẩm, hàng hóa
04-VT  Bảng kê chi tiết vật tư còn lại cuối kỳ
05-VT  Biên bản tổng hợp kiểm kê vật tư, công cụ, sản phẩm, hàng hóa
06-VT  Bảng kê mua hàng
07-VT  Bảng phân bổ nguyên liệu, vật liệu, công cụ, dụng cụ
```

## 36.3. Bán hàng

```text
01-BH  Bảng thanh toán hàng đại lý, ký gửi
02-BH  Thẻ quầy hàng
```

## 36.4. Tiền tệ

```text
01-TT   Phiếu thu
02-TT   Phiếu chi
03-TT   Giấy đề nghị tạm ứng
04-TT   Giấy thanh toán tiền tạm ứng
05-TT   Giấy đề nghị thanh toán
06-TT   Biên lai thu tiền
07-TT   Bảng kê vàng tiền tệ
08a-TT  Bảng kiểm kê quỹ (VND)
08b-TT  Bảng kiểm kê quỹ (ngoại tệ, vàng tiền tệ)
09-TT   Bảng kê chi tiền
```

## 36.5. Tài sản cố định

```text
01-TSCĐ  Biên bản giao nhận TSCĐ
02-TSCĐ  Biên bản thanh lý TSCĐ
03-TSCĐ  Biên bản bàn giao TSCĐ sửa chữa/bảo dưỡng/nâng cấp hoàn thành
04-TSCĐ  Biên bản đánh giá lại TSCĐ
05-TSCĐ  Biên bản tổng hợp kiểm kê TSCĐ
06-TSCĐ  Bảng tính và phân bổ khấu hao TSCĐ
```

## 36.6. Bố cục màn hình quản lý mẫu

```text
MẪU CHỨNG TỪ
├─ Nhóm mẫu
├─ Danh sách mẫu
├─ Xem trước
├─ In
├─ Sửa mẫu hiện tại
├─ Nhân bản mẫu [KHUNG]
├─ Khôi phục mẫu chuẩn [KHUNG]
└─ Danh sách trường dữ liệu có thể chèn [KHUNG]
```

---

# 37. INVENTORY COMPONENT FRONTEND – TOÀN BỘ COMPONENT PHẢI THIẾT KẾ

| Nhóm | Component / Screen shell |
|---|---|
| Global Shell | AppHeader, CompanyContext, GlobalSearch, Notification, UserMenu, Sidebar, QuickCreate |
| Module | ModuleTabs, ModuleQuickMenu, ModuleProcess, ModuleDashboard |
| List | SearchBar, DateScope, FilterDrawer, ColumnSetting, DataGrid, RowActionMenu, BulkActionBar, Pagination, QuickDetail |
| Document | DocumentHeader, GeneralInfo, DocumentTabs, DetailTabs, EditableGrid, SummaryPanel, RelatedDocumentPanel, AttachmentPanel, AuditPanel, ActionFooter |
| Modal/Drawer | QuickCreateMaster, SelectReference, Confirmation, ImportExcel, AIExtractPreview, Filter, ColumnSetting, TabSetting |
| Report | ReportCenter, ReportSearch, FavoriteReports, SavedReports, ParameterPanel, ReportViewer |
| Master Data | MasterTree, MasterList, MasterDetail, ImportExcel, Export |
| Tax | TaxReturnList, TaxReturnForm, AnnexTabs, XMLAction, FilingStatus, TaxPayment |
| Control | PermissionTree, ReconciliationResult, LockPeriod, AccessLog, DataMaintenance |
| Role Mode | WarehouseKeeperWorkspace, CashierWorkspace |
| E-Invoice | InvoiceList, InvoicePreview, PublishAction, AdjustmentReplacementAction |
| Costing | CostingPeriodList, CostPool, Allocation, WIP, CostingResult |
| Budget | BudgetPlanList, BudgetPlanDetail, BudgetVsActual, OverrunAlert |

---

# 38. TEMPLATE BẮT BUỘC KHI ĐẶC TẢ TỪNG SCREEN Ở BƯỚC SAU

Mỗi screen cụ thể sau này phải có đủ khung này:

```text
SCREEN ID
SCREEN NAME
MODULE / TAB
SCREEN TYPE

A. ENTRY POINT
   Người dùng đi vào từ đâu?

B. TOP TOOLBAR
   Có những nút nào?

C. FILTERS
   Search / kỳ / trạng thái / đối tượng / bộ lọc nâng cao

D. GRID COLUMNS
   Danh sách cột hiển thị

E. PRIMARY ACTION
   Nút chính của màn hình

F. ROW ACTIONS
   Menu chức năng mỗi dòng

G. BULK ACTIONS
   Chức năng khi chọn nhiều dòng

H. QUICK DETAIL
   Vùng xem nhanh phía dưới

I. CREATE / EDIT DOCUMENT
   Bố cục khi thêm/sửa

J. DOCUMENT TABS
   Các tab cấp chứng từ + tab chi tiết

K. RELATED DOCUMENTS
   Chứng từ nguồn / sinh ra / liên quan

L. ATTACHMENT
   File đính kèm

M. HISTORY / AUDIT
   Lịch sử thay đổi / truy vết

N. REPORT / PRINT TEMPLATE
   Mẫu in, báo cáo liên quan

O. PERMISSION-BASED VISIBILITY
   Nút/tab nào ẩn theo quyền

P. UI STATES
   Empty / Loading / Error / No permission / No result
```

Bản Master này dừng ở cấp cấu trúc/function map. Khi bắt đầu vẽ từng screen, dùng template trên để bóc tiếp field-level.

---

# 39. SCREEN INVENTORY TỔNG HỢP

| Phân hệ | Screen / Workspace | Loại |
|---|---|---|
| Global | App Shell | Header + Sidebar + Quick Create + Search + Settings |
| Global | Global Search | Search + grouped result + Quick View |
| Hóa đơn | Invoice List | List + E-invoice actions |
| Hóa đơn | Invoice Detail | Document / Preview |
| Hóa đơn | Adjustment / Replacement | Workflow Document |
| Tiền mặt | Quy trình | Process |
| Tiền mặt | Thu/Chi | List + Receipt/Payment Documents |
| Tiền mặt | Kiểm kê | List + Inventory Document |
| Tiền mặt | Dự báo | List + Forecast Detail |
| Tiền gửi | Quy trình | Process |
| Tiền gửi | Thu/Chi | List + Bank Documents |
| Tiền gửi | Đối chiếu NH | Reconciliation |
| Tiền gửi | NH điện tử | Commands + Transaction List |
| Tiền gửi | Khế ước đi vay | List + Loan Contract Detail |
| Tiền gửi | Khế ước cho vay | List + Lending Contract Detail |
| Mua hàng | Quy trình | Process |
| Mua hàng | Biểu đồ | Dashboard |
| Mua hàng | Đơn mua | List + PO Detail |
| Mua hàng | Hợp đồng mua | List + Contract Detail |
| Mua hàng | Mua hàng | List + Purchase Document Variants |
| Mua hàng | Nhận hóa đơn | List + Invoice Receipt Document |
| Mua hàng | Xử lý HĐ đầu vào | Invoice Inbox + Preview + Create/Link Actions |
| Mua hàng | Trả lại hàng mua | List + Document |
| Mua hàng | Giảm giá hàng mua | List + Document |
| Mua hàng | Trả tiền theo HĐ | Payment Selection Workspace |
| Mua hàng | Công nợ NCC | Debt / Reconciliation Workspace |
| Bán hàng | Quy trình | Process |
| Bán hàng | Biểu đồ | Dashboard |
| Bán hàng | Báo giá | List + Quote |
| Bán hàng | Đơn đặt hàng | List + Sales Order |
| Bán hàng | Hợp đồng bán | List + Contract |
| Bán hàng | Bán hàng | List + Sales Document |
| Bán hàng | Hóa đơn | Invoice List + Accounting Actions |
| Bán hàng | Auto hạch toán HĐ | Rule + Processing Result |
| Bán hàng | Trả lại / Giảm giá | List + Document |
| Bán hàng | Công nợ | Debt Workspace |
| Bán hàng | Thu nợ | Collection Workspace |
| Bán hàng | Phân bổ DT nhận trước | Allocation Workspace |
| Kho | Quy trình | Process |
| Kho | Biểu đồ | Dashboard |
| Kho | Nhập kho | List + Warehouse Receipt |
| Kho | Xuất kho | List + Warehouse Issue |
| Kho | Chuyển kho | List + Transfer Document |
| Kho | Lệnh sản xuất | Master-Detail + Production Order |
| Kho | Lắp ráp/Tháo dỡ | List + Assembly Command |
| Kho | Kiểm kê | List + Inventory Document |
| Kho | Hàng hóa, dịch vụ | Master Data Workspace |
| CCDC | Sổ CCDC | Dual-view Register |
| CCDC | Ghi tăng | List + Document |
| CCDC | Phân bổ | List + Allocation |
| CCDC | Điều chỉnh | List + Document |
| CCDC | Điều chuyển | List + Document |
| CCDC | Ghi giảm | List + Document |
| CCDC | Kiểm kê | List + Inventory |
| CCDC | CPTT | List + Detail |
| CCDC | Phân bổ CPTT | Allocation Workspace |
| TSCĐ | Sổ tài sản | Asset Register |
| TSCĐ | Ghi tăng | List + Document |
| TSCĐ | Đánh giá lại | List + Revaluation Document |
| TSCĐ | Tính khấu hao | List + Depreciation Sheet |
| TSCĐ | Điều chuyển | List + Transfer Document |
| TSCĐ | Ghi giảm | List + Disposal Document |
| TSCĐ | Kiểm kê | List + Inventory |
| TSCĐ | Chuyển đổi thuê TC | List + Conversion Document |
| Tiền lương | Quy trình | Process |
| Tiền lương | Chấm công | List + Timesheet |
| Tiền lương | Tổng hợp chấm công | List + Summary Sheet |
| Tiền lương | Tính lương | List + Payroll Sheet |
| Tiền lương | Hạch toán chi phí | Document / Integration |
| Tiền lương | Trả lương | Payment Workspace |
| Tiền lương | Nộp BH | Payment Workspace |
| Thuế | Khai thuế | Tax Return List |
| Thuế | Tờ khai | Tax Document + Annexes |
| Thuế | Khai bổ sung | Supplementary Workflow |
| Thuế | mTax / XML | Filing / Export Workspace |
| Giá thành | Kỳ tính giá | List + Calculation Workspace |
| Giá thành | Giản đơn | Costing Workspace |
| Giá thành | Hệ số/Tỷ lệ | Costing Workspace |
| Giá thành | Phân bước | Costing Workspace |
| Giá thành | Công trình | Costing Workspace |
| Giá thành | Đơn hàng | Costing Workspace |
| Giá thành | Hợp đồng | Costing Workspace |
| Tổng hợp | Quy trình | Process |
| Tổng hợp | CT nghiệp vụ khác | List + Document |
| Tổng hợp | Quyết toán tạm ứng | List + Document |
| Tổng hợp | Chứng từ ghi sổ | List + Document |
| Tổng hợp | Kết chuyển | Calculation + Document |
| Tổng hợp | Đánh giá ngoại tệ | Calculation + Document |
| Tổng hợp | Phân bổ | Allocation Workspace |
| Tổng hợp | Khóa sổ | Period Control |
| Tổng hợp | BCTC | FS List + FS Set |
| Ngân sách | Kế hoạch | Plan List + Detail |
| Ngân sách | Biểu đồ | Dashboard |
| Ngân sách | Cảnh báo | Alert Workspace |
| Phân tích | Chỉ số | Dashboard |
| Phân tích | Báo cáo phân tích | Report Workspace |
| Báo cáo | Report Center | Catalog + Viewer |
| Danh mục | Master Data | Grouped Masters |
| Số dư đầu | Opening Balance | Grouped Opening Balances |
| Settings | Công ty | Settings |
| Settings | Người dùng | Admin Workspace |
| Settings | Vai trò/Quyền | Permission Tree |
| Settings | Dữ liệu | Data Management |
| Settings | Tiện ích | Utility Center |
| Settings | Reconciliation | Control Workspace |
| Settings | Mẫu in | Template Center |
| Role Mode | Thủ kho | Warehousekeeper Workspace |
| Role Mode | Thủ quỹ | Cashier Workspace |

---

# 40. AUDIT ĐỐI CHIẾU VỚI AMIS KẾ TOÁN 2026

| Hạng mục audit | Trạng thái trong bản 3.0 |
|---|---|
| Quick Detail dưới danh sách | Đã có |
| Tab nghiệp vụ ngang | Đã có |
| Ẩn/hiện + kéo thả tab | Đã có |
| Quick Menu khi bấm tên phân hệ | Đã có |
| + Thêm nhanh toàn hệ thống | Đã có |
| Danh mục & Số dư ban đầu là entry point riêng | Đã có |
| Report Center riêng + search + favorite + saved | Đã có |
| Mua/Bán/Kho có Biểu đồ | Đã có |
| List có Search/Filter/Nạp/Xuất/Cột | Đã có |
| Row Action + Bulk Action | Đã có |
| Nhập Excel ở nhiều danh sách | Đã có |
| AI Add ở màn hình đã xác minh | Đã có vị trí |
| Mua hàng đủ Đơn/HĐ/Mua/Nhận HĐ/Xử lý HĐ/Trả lại/Giảm giá/Trả tiền | Đã có |
| Xử lý HĐ đầu vào có hành động tạo/liên kết nhiều loại chứng từ | Đã có |
| Bán hàng có Báo giá/Đơn/HĐ/Bán/HĐĐT/Trả lại/Giảm giá/Công nợ/Thu nợ | Đã có |
| Đơn hàng có ghi/từ chối doanh số, cập nhật trạng thái/ngày giao | Đã có |
| Kho đủ Nhập/Xuất/Chuyển/LSX/Lắp ráp/Tháo dỡ/Kiểm kê | Đã có |
| LSX bám đúng ảnh AMIS đã cung cấp | Đã có |
| Tiền gửi có Đối chiếu/NH điện tử/Khế ước vay & cho vay | Đã có |
| Ngân hàng điện tử có chuyển/duyệt/thu hồi/lịch sử/số dư | Đã có |
| CCDC có Sổ + biến động + CPTT | Đã có |
| TSCĐ có Sổ + ghi tăng/đánh giá/KH/điều chuyển/ghi giảm/kiểm kê | Đã có |
| Tiền lương đủ chấm công → trả lương/bảo hiểm | Đã có |
| Thuế có nhiều sắc thuế + khai bổ sung + XML/mTax | Đã có |
| Giá thành đủ các phương pháp chính | Đã có |
| Tổng hợp có CTNVK/kết chuyển/ngoại tệ/phân bổ/khóa sổ/BCTC | Đã có |
| Ngân sách | Đã có, optional |
| Phân tích tài chính | Đã có, optional |
| Kết nối vay vốn | Đã có, optional |
| Thủ kho / Thủ quỹ | Đã có, optional theo cấu hình |
| Quản lý người dùng & phân quyền chi tiết | Đã có |
| Kiểm tra đối chiếu 11 nhóm | Đã có |
| Onboarding dữ liệu kế toán / chọn TT99 | Đã có |
| Mẫu in / mẫu chứng từ TT99 | Đã có |

## 40.1. Những điểm cố ý không sao chép 1:1 MISA

```text
Branding
Tên sản phẩm
Màu sắc
Icon cụ thể
Pixel/layout chính xác
Gói license của MISA
Tính năng chỉ hoạt động trong hệ sinh thái MISA mà dự án không tích hợp
```

Mục tiêu là học **information architecture + interaction pattern + nghiệp vụ**, không clone sản phẩm.

---

# 41. AUDIT ĐỐI CHIẾU VỚI THÔNG TƯ 99/2025/TT-BTC

| Nội dung TT99 | Vị trí frontend trong bản này |
|---|---|
| Quản trị, kiểm soát nội bộ | Người dùng, Vai trò & quyền hạn, Quy trình phê duyệt, Nhật ký truy cập |
| Chứng từ kế toán | Document Workspace trong mọi phân hệ |
| Hệ thống biểu mẫu chứng từ | Mẫu in / Sửa mẫu / TT99 Template Center |
| Lập, ký và kiểm soát chứng từ | Document Action + Permission + Signature/Workflow area |
| Hệ thống tài khoản | Danh mục → Hệ thống tài khoản |
| Sổ kế toán | Report Center → Tổng hợp / Sổ sách |
| Ghi sổ | Row/Bulk/Document Actions |
| Khóa sổ | Tổng hợp → Khóa sổ / Bỏ khóa |
| BCTC | Tổng hợp + Report Center |
| Báo cáo tình hình tài chính | BCTC Set |
| Báo cáo KQHĐKD | BCTC Set |
| Báo cáo lưu chuyển tiền tệ | BCTC Set + Mapping hoạt động LCTT |
| Thuyết minh BCTC | BCTC Set |
| Đơn vị tiền tệ | Thiết lập dữ liệu + Danh mục loại tiền |
| Đơn vị trực thuộc | Context công ty/chi nhánh + Cơ cấu tổ chức |
| Hàng tồn kho | Kho + các mẫu VT |
| Tiền tệ | Tiền mặt/Tiền gửi + các mẫu TT |
| Lao động tiền lương | Tiền lương + các mẫu LĐTL |
| TSCĐ | TSCĐ + các mẫu TSCĐ |

**Kết quả:** Bản 3.0 đã có vị trí giao diện cho các nhóm cấu phần kế toán cốt lõi được TT99 đề cập.

---

# 42. NHỮNG PHẦN BẢN TRƯỚC CÒN THIẾU VÀ ĐÃ BỔ SUNG

| Thiếu ở bản trước | Đã bổ sung trong bản 3.0 |
|---|---|
| Chức năng nhỏ bên trong từng tab | Row Action, Bulk Action, Menu tạo, Detail Tabs, Related Documents |
| Xử lý hóa đơn đầu vào | Inbox + Preview + nhiều action tạo/liên kết chứng từ |
| Đơn đặt hàng bán | Ghi/Từ chối doanh số, trạng thái, ngày giao, AI, Bulk |
| Ngân hàng điện tử | Chuyển/Duyệt/Thu hồi/Lịch sử/Số dư/Quy tắc tự động |
| Khế ước vay/cho vay | Giải ngân, lịch trả/thu nợ, đổi lãi suất, tất toán |
| CCDC/CPTT | Sổ 2 view + nguồn gốc + biến động + phân bổ |
| TSCĐ | Sổ tài sản + chuyển đổi thuê TC + chi tiết khấu hao |
| Thuế | Sắc thuế, đăng ký tờ khai, bổ sung, XML, mTax, phụ lục |
| Giá thành | 6 hướng/phương pháp và workspace trong kỳ tính giá |
| Tổng hợp | CT ghi sổ, tỷ giá, phân bổ, BCTC tổng hợp/giữa niên độ, mapping report |
| Thủ kho/Thủ quỹ | Chế độ làm việc riêng |
| Ngân sách | Kế hoạch, biểu đồ, cảnh báo, báo cáo |
| Phân tích tài chính | Chỉ số, báo cáo, AI optional |
| Kết nối vay vốn | Module optional |
| Mẫu chứng từ TT99 | Đã bổ sung danh mục Phụ lục I theo nhóm |
| Onboarding | Setup wizard chọn chế độ kế toán/TT99 |
| Kiểm tra đối chiếu | 11 nhóm kiểm tra |
| Screen Inventory | Đã lập inventory toàn bộ màn hình chính |

---

# 43. THỨ TỰ DỰNG FRONTEND ĐỀ XUẤT

```text
PHASE 1 – KHUNG DÙNG CHUNG
1. App Shell
2. Sidebar
3. Global Search
4. Quick Create
5. Module Tabs + Tab Settings
6. List Workspace
7. Quick Detail
8. Document Workspace
9. Common Modal / Drawer
10. Report Center Shell

PHASE 2 – GOLDEN SCREENS
1. Kho → Lệnh sản xuất
2. Mua hàng → Đơn mua hàng
3. Mua hàng → Chứng từ mua hàng
4. Mua hàng → Xử lý hóa đơn đầu vào
5. Bán hàng → Đơn đặt hàng
6. Bán hàng → Chứng từ bán hàng
7. Tiền mặt → Thu/Chi
8. Tiền gửi → Thu/Chi
9. Thuế → Khai thuế
10. Tổng hợp → Chứng từ nghiệp vụ khác

PHASE 3 – NHÂN RỘNG THEO PATTERN
Kho / CCDC / TSCĐ / Tiền lương / Giá thành / Ngân sách

PHASE 4 – CONTROL & ADMIN
Danh mục
Số dư
Permission
Reconciliation
Settings
Reports
Thủ kho / Thủ quỹ
```

---

# 44. DEFINITION OF DONE CHO BỐ CỤC MỘT SCREEN

Một screen chỉ được coi là **đủ để chuyển sang vẽ mockup chi tiết** khi đã xác định:

```text
[ ] Module + Tab
[ ] Screen Type
[ ] Entry Point
[ ] Toolbar
[ ] Search / Filter
[ ] Grid columns chính
[ ] Primary Action
[ ] Row Actions
[ ] Bulk Actions nếu cần
[ ] Quick Detail nếu phù hợp
[ ] Full Detail / Create / Edit
[ ] Các Document Tabs
[ ] Related Documents
[ ] Attachment / History
[ ] Mẫu in / báo cáo liên quan
[ ] Quyền làm ẩn/hiện action
[ ] Empty State
[ ] Loading State
[ ] Error State
[ ] No Permission State
[ ] No Result State
```

Nếu thiếu một trong các nhóm quan trọng trên thì **không nên bắt đầu code screen đó**.

---

# 45. NGUỒN RESEARCH / AUDIT

## 45.1. MISA Help – nguồn chính

Các nhóm tài liệu đã dùng để audit:

```text
Giao diện AMIS Kế toán mới
Mua hàng
Chi tiết chứng từ mua hàng / mua dịch vụ
Xử lý hóa đơn đầu vào
Bán hàng
Kho
Tiền mặt
Chi tiết chứng từ Tiền mặt
Tiền gửi
Ngân hàng điện tử
Khế ước đi vay / cho vay
Tiền lương
Giá thành
Công cụ dụng cụ
Tài sản cố định
Tổng hợp
Thuế
Danh mục
Số dư ban đầu
Ngân sách
Phân quyền
Kiểm tra đối chiếu
Thiết lập dữ liệu kế toán
Thủ kho
Thủ quỹ
```

Một số URL chính:

- https://helpact.misa.vn/kb/cai-tien-giao-dien-tren-phan-mem-amis-ke-toan/
- https://helpact.misa.vn/kb/giai-thich-y-nghia-va-cac-chuc-nang-co-trong-phan-he-mua-hang/
- https://helpact.misa.vn/kb/giai-thich-y-nghia-va-cac-chuc-nang-co-trong-phan-he-ban-hang/
- https://helpact.misa.vn/kb/giai-thich-y-nghia-va-cac-chuc-nang-co-trong-phan-he-kho/
- https://helpact.misa.vn/kb/giai-thich-y-nghia-va-cac-chuc-nang-co-trong-phan-he-tien-mat/
- https://helpact.misa.vn/kb/giai-thich-y-nghia-va-cac-chuc-nang-co-trong-phan-he-tien-gui/
- https://helpact.misa.vn/kb/giai-thich-chi-tiet-y-nghia-va-chuc-nang-cua-tung-quyen-trong-muc-phan-vai-tro-tren-amis-ke-toan/
- https://helpact.misa.vn/kb/so_theo_doi_ccdc/
- https://helpact.misa.vn/kb/ghi_tang_tscd/
- https://helpact.misa.vn/kb/tong-hop/
- https://helpact.misa.vn/kb/ngan-sach/

## 45.2. Nguồn pháp lý / tài liệu dự án

```text
Thông tư 99/2025/TT-BTC
Ảnh giao diện AMIS: Kho → Lệnh sản xuất
SRS Template của project
Tài liệu phân tích yêu cầu ERP của FPT trong project
```

## 45.3. YouTube – nguồn bổ trợ hình dung thao tác

Đã tìm kiếm thêm video về thao tác AMIS Accounting và kiểm soát hóa đơn đầu vào. Kết quả hữu ích để **tham khảo cách người dùng thao tác thực tế**, nhưng không dùng metadata video thay cho tài liệu chức năng chính thức.

Các kết quả nổi bật tìm thấy:

```text
MISA AMIS Accounting Practice Guide for Beginners – YouTube (2025)
KIỂM SOÁT HÓA ĐƠN ĐẦU VÀO – MISA meInvoice – YouTube (2026)
```

**Nguyên tắc:** Các khẳng định chức năng trong tài liệu ưu tiên Help chính thức MISA và TT99; YouTube chỉ là nguồn tham khảo visual/workflow bổ trợ.

---

# 46. KẾT LUẬN – MASTER MAP ĐỂ BẮT ĐẦU FRONTEND

Bản 3.0 này không còn chỉ là sitemap. Nó đã xuống tới cấp:

```text
MODULE
  ↓
TAB
  ↓
WORKSPACE
  ↓
TOOLBAR
  ↓
LIST / MASTER GRID
  ↓
ROW ACTION / BULK ACTION
  ↓
QUICK DETAIL
  ↓
FULL DOCUMENT
  ↓
DOCUMENT TABS
  ↓
RELATED DOCUMENTS
  ↓
REPORT / PRINT / CONTROL
```

Frontend có thể dùng file này để dựng **Information Architecture và Wireframe tổng thể**. Sau khi duyệt IA, bước tiếp theo là chọn từng screen trong mục `39. Screen Inventory` và viết một file `SCREEN_SPEC_*.md` theo template mục `38` để bóc đến từng field, dropdown, popup và trạng thái hiển thị.

---

# 47. MICRO-FUNCTION MAP – CÁC CHỨC NĂNG NHỎ DỄ BỊ BỎ SÓT

Phần này dùng như checklist khi vẽ UI để tránh chỉ vẽ các màn hình lớn mà quên các thao tác nhỏ AMIS đang có.

## 47.1. Chức năng nhỏ trên danh sách

```text
Search nhanh
Search nâng cao
Chọn kỳ / khoảng thời gian
Lọc trạng thái
Lọc đối tượng
Lọc theo loại chứng từ
Nạp / Refresh
Xuất Excel
Nhập Excel
Tùy chỉnh cột
Lọc từng cột
Sắp xếp
Chọn một dòng
Chọn nhiều dòng
Chọn toàn trang
Bulk action
Quick Detail
Mở Full Detail
Mở chứng từ bằng click vào Số chứng từ
```

## 47.2. Chức năng nhỏ trên chứng từ

```text
Cất
Cất & Thêm (nếu màn hình hỗ trợ)
Ghi sổ
Bỏ ghi
Xem
Sửa
Sửa nhanh
Xóa
Nhân bản
In
Gửi email
Đính kèm
Xem lịch sử
Xem tham chiếu
Chọn chứng từ nguồn
Lập chứng từ liên quan
Thêm nhanh danh mục bằng dấu +
Sửa mẫu hiện tại
Ẩn/hiện cột chi tiết
Tùy chỉnh trường mở rộng
```

## 47.3. Sửa nhanh

[MISA] Một số chứng từ có chức năng `Sửa nhanh` để chỉnh các thông tin ít ảnh hưởng đến logic hạch toán mà không mở lại toàn bộ luồng sửa chứng từ.

Frontend cần chuẩn bị:

```text
[Sửa nhanh]
    ↓
Mở chế độ inline / drawer
    ↓
Chỉ field được phép sửa mới editable
    ↓
[Cất]
```

Các nhóm field thường có thể sửa nhanh ở chứng từ mua hàng gồm tên NCC, người giao, địa chỉ, nhân viên mua, diễn giải, tên hàng/dịch vụ, ghi chú, mô tả, mục thu/chi, lô/hạn dùng, khoản mục CP, đơn vị, đối tượng THCP, công trình, mã thống kê, trường mở rộng và đính kèm. Những field cốt lõi như ngày hạch toán, mã NCC, mã hàng, kho, tài khoản, số lượng, đơn giá... có thể bị khóa tùy loại chứng từ.

## 47.4. Lập chứng từ từ chứng từ nguồn

Đây là pattern rất quan trọng của ERP và AMIS; không chỉ có nút `Thêm`.

```text
[Thêm chứng từ]
        ↓
Nguồn lập
├─ Lập mới
├─ Lập từ Đơn mua / Đơn bán
├─ Lập từ Hợp đồng mua / Hợp đồng bán
├─ Lập từ Báo giá
├─ Lập từ Lệnh sản xuất
├─ Lập từ Hóa đơn đầu vào / đầu ra
├─ Lập từ đề nghị / workflow
└─ Lập từ chứng từ tham chiếu khác
```

[MISA] Ví dụ chứng từ mua hàng có thể lấy dữ liệu từ hợp đồng mua; một số luồng có thể lấy nhu cầu từ lệnh sản xuất. Frontend cần có `Select Source Dialog` chung:

```text
Tìm kiếm nguồn
Lọc thời gian
Lọc đối tượng
Lấy dữ liệu
Chọn một/nhiều nguồn
Chọn dòng chi tiết
Nhập số lượng thực hiện lần này
[Đồng ý]
```

## 47.5. Chứng từ liên kết và tham chiếu hai chiều

```text
NGUỒN
Báo giá / Đơn / Hợp đồng / Hóa đơn / Đề nghị
        ↓
CHỨNG TỪ HIỆN TẠI
        ↓
SINH RA
Phiếu nhập / Phiếu xuất / Phiếu thu / Phiếu chi / Hóa đơn / UNC / Bút toán
```

UI phải cho phép:

```text
Xem chứng từ nguồn
Xem chứng từ sinh ra
Click số chứng từ để mở
Xem tình hình thực hiện
Xem giá trị đã thực hiện / còn lại
```

## 47.6. Trường mở rộng

[MISA] Nhiều danh sách/chứng từ có `Trường mở rộng 1..10` và metadata.

Frontend cần có:

```text
⚙ Thiết lập trường mở rộng
├─ Đổi tên trường
├─ Chọn loại dữ liệu [KHUNG]
├─ Hiện/ẩn trên chứng từ
├─ Hiện/ẩn trên danh sách
└─ Hiện/ẩn trên mẫu in [KHUNG]
```

## 47.7. Email / Chat / Nhắc việc

```text
Gửi chứng từ qua email
Gửi hóa đơn cho khách hàng
Email nhắc nợ
Mẫu email
Địa chỉ người nhận
Lịch sử gửi

[OPTION – nếu tích hợp chat]
Trao đổi về đề nghị chi
Gửi phiếu lương
Mention / thread theo object
```

[MISA] Tính năng mới 2026 đã có các luồng trao đổi liên quan AMIS Chat; dự án có thể để phase sau nhưng nên chừa panel Collaboration.

## 47.8. Ký số / Workflow

```text
TRẠNG THÁI
Chưa gửi duyệt
Chờ duyệt
Đã duyệt
Từ chối
Đã ký

ACTION
Gửi duyệt
Duyệt
Từ chối
Hủy duyệt
Ký số
Xem lịch sử duyệt
```

[KHUNG] Không phải mọi chứng từ đều cần workflow; hiển thị theo cấu hình doanh nghiệp và quyền.

## 47.9. Import Excel

```text
[Nhập Excel]
    ↓
Chọn file
    ↓
Chọn sheet / mẫu
    ↓
Mapping cột
    ↓
Preview
    ↓
Danh sách lỗi
    ↓
Import dữ liệu hợp lệ
    ↓
Kết quả import
```

## 47.10. AI Add / AI Extract

```text
[Thêm bằng AI]
    ↓
Upload / nguồn dữ liệu
    ↓
AI đọc thông tin
    ↓
Preview field + confidence / cảnh báo
    ↓
Người dùng xác nhận
    ↓
Tạo chứng từ nháp
```

Không để AI tự ghi sổ, tự duyệt, tự nộp hồ sơ hoặc tự xóa mà không có bước người dùng xác nhận.

## 47.11. Print / Template

```text
[In ▼]
├─ Mẫu mặc định
├─ Mẫu TT99 / mẫu doanh nghiệp
├─ Mẫu tùy chỉnh
├─ Xem trước
└─ Sửa mẫu hiện tại (nếu có quyền)
```

## 47.12. Tiện ích hệ thống nhỏ nhưng quan trọng

Theo quyền có thể có:

```text
Ghi sổ / Bỏ ghi theo lô
Báo trừ dữ liệu
Đánh lại số chứng từ
Lấy chứng từ từ dữ liệu khác
Cho phép dữ liệu khác lấy chứng từ
Kiểm tra đối chiếu chứng từ-sổ sách
Nộp tờ khai/BCTC/giấy nộp tiền qua mTax
Sửa mẫu in chứng từ
Thiết lập mã QR thanh toán
Bảo trì dữ liệu
Phục hồi chứng từ đã xóa
Nhật ký truy cập
```

---

# 48. AUDIT BỔ SUNG SAU KHI RESEARCH MICRO-FUNCTION

Sau vòng research cuối, tài liệu được kiểm tra lại theo tiêu chí “Frontend nhìn vào có biết **bên trong tab còn gì** hay chưa”. Kết quả:

| Nhóm | Đã có trong master map |
|---|---|
| Module → Tab | Có |
| Tab → Toolbar | Có |
| Toolbar → Nút nhỏ | Có |
| List → Cột/Row Action | Có |
| List → Bulk Action | Có |
| List → Quick Detail | Có |
| Thêm → Các variant tạo | Có ở các module quan trọng |
| Document → Tab cấp chứng từ | Có |
| Document → Tab chi tiết | Có |
| Document → Related Documents | Có |
| Source → Lập chứng từ từ nguồn | Đã bổ sung |
| Sửa nhanh | Đã bổ sung |
| Import Excel flow | Đã bổ sung |
| AI Add flow | Đã bổ sung |
| Mẫu in / Sửa mẫu | Có |
| Email / Nhắc nợ / Chat optional | Có |
| Permission action-level | Có |
| Kiểm tra đối chiếu | Có |
| Thủ kho / Thủ quỹ | Có |
| Mẫu chứng từ TT99 | Có |
| BCTC TT99 | Có |
| Opening Balance | Có |
| Onboarding | Có |

**Kết luận audit:** Ở cấp **Information Architecture + UI Function Map**, bản này đã đủ rộng để bắt đầu thiết kế toàn bộ frontend. Phần còn lại cần làm theo từng screen là **field-level specification**, không phải mở rộng thêm sitemap chung.
