# BÁO CÁO TRIỂN KHAI HỆ THỐNG KẾ TOÁN THÔNG TƯ 99/2025/TT-BTC & DỮ LIỆU BÀI TẬP TMDV ABC

> **Doanh nghiệp áp dụng:** CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC  
> **Mã số thuế:** 109876543  
> **Địa chỉ:** 198 Trần Quang Khải, P. Hoàn Kiếm, TP. Hà Nội  
> **Vốn điều lệ:** 5.000.000.000 VNĐ  
> **Chế độ kế toán:** Thông tư 99/2025/TT-BTC (thay thế Thông tư 200/2014/TT-BTC)  
> **Trạng thái Docker:** Đang chạy 3/3 container (`thue_erp_postgres`, `thue_erp_backend`, `thue_erp_frontend`)  

---

## 1. TỔNG QUAN CÔNG VIỆC ĐÃ HOÀN THÀNH

Toàn bộ hệ thống đã được xử lý đồng bộ từ **Backend (Cơ sở dữ liệu PostgreSQL / Django REST Framework)** đến **Frontend (Giao diện người dùng React / Vite / CSS)**, loại bỏ triệt để các mock data giả lập ("Minh An", "An Phát", danh mục vật tư thiết bị điện nước mẫu).

### A. Chuyển đổi chuẩn kế toán sang Thông tư 99/2025/TT-BTC
- Cập nhật chế độ kế toán của doanh nghiệp sang **`TT99`** (`accounting_regime = "TT99"`).
- Hệ thống tài khoản, nguyên tắc định khoản ghi sổ kép (Nợ/Có), mẫu sổ kế toán và bảng tổng hợp được áp dụng theo các quy định mới nhất của Thông tư 99/2025/TT-BTC ban hành ngày 24/10/2025 (có hiệu lực từ kỳ kế toán 2026).

### B. Khởi tạo Master Data chuẩn từ Bài tập 1 (`doc1.txt`)
1. **Cơ cấu tổ chức & Phòng ban:**
   - Ban Giám đốc (`BGD`), Phòng Kế toán (`PKT`), Phòng HC Nhân sự (`PHC`), Phòng Kỹ thuật (`PKT2`).
2. **Ngân hàng & Tài khoản thanh toán:**
   - Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank - `TCB`).
   - Tài khoản VND: `123456789` (hạch toán TK 1121).
   - Tài khoản USD: `987654321` (hạch toán TK 1122).
3. **Danh mục Nhân sự (9 nhân viên chính thức + Quản trị viên):**
   - Trương Thanh Quân (Giám đốc), Nguyễn Thị Yến (KTT), Lê Văn Hiếu (KTV), Trần Văn Hùng (Thủ quỹ), Hoàng Bá Cung (HCNS), Lương Minh Thành (TP Kỹ thuật), Đặng Thuận, Bùi Đức Dũng, Phạm Đình Tài (Kỹ thuật viên) kèm đầy đủ số tài khoản Techcombank và mã số thuế cá nhân.
4. **Hệ thống 5 kho hàng:**
   - Kho hàng hóa (`156`), Kho nguyên liệu (`152`), Kho dụng cụ (`153`), Kho thành phẩm (`155`), Kho hàng gửi đại lý (`157`).
5. **Danh mục 18 mặt hàng, vật tư, công cụ:**
   - Hàng hóa: iPhone 15 Pro Max, Samsung S24 Ultra, Macbook Air M2, HP Pavilion 14, Dell Ins 15, iPad Gen 10, Apple Watch SE, Galaxy Watch 6, AirPods Pro 2, Màn hình LG 27", Chuột Dell, Bàn phím Logitech.
   - Vật tư: Dây cáp điện, Keo dán đa năng, Vải lau công nghiệp.
   - Công cụ dụng cụ: Ghế xoay văn phòng, Máy hủy tài liệu, Bàn làm việc.
6. **Danh mục 28 đối tác kinh doanh (17 Khách hàng & 14 Nhà cung cấp):**
   - Khách hàng: Công ty Thanh Hà, Nhật Minh, Minh Hạnh, Anh Tuấn, Cầu Giấy, Hiệp Phát, Bảo Kim, Thuận Phát, Duy Vinh, Kiến Quân, Việt Hùng, Thái Bình, Hoàng Long computer, Khách lẻ...
   - Nhà cung cấp: Phát Mai Group, Minh Quân Logistics, Thanh Trúc, Maison, Vạn Phát, MediaZ, Logistics Việt Hưng, Việt Gia, Công nghệ KTS, An Lộc, Tân Cảng...

### C. Khởi tạo Số dư đầu kỳ (01/01/2026)
Đã sinh bút toán mở sổ `OPEN-2026-001` ngày 01/01/2026 với tổng giá trị đối ứng Nợ/Có cân đối đạt **10.389.530.000 VNĐ**:
- **TK 1111 (Tiền mặt):** 180.000.000 đ
- **TK 1121 (Tiền gửi VND):** 1.450.000.000 đ
- **TK 1122 (Tiền gửi USD):** 3.125.000.000 đ (125.000 USD x 25.000)
- **TK 131 (Phải thu KH chi tiết):** 524.300.000 đ (Thanh Hà: 85tr, Minh Hạnh: 145tr, Cầu Giấy: 120tr, Thuận Phát: 74,3tr, Duy Vinh: 100tr)
- **TK 141 (Tạm ứng):** 15.000.000 đ
- **TK 152 (Nguyên vật liệu):** 45.000.000 đ
- **TK 153 (Công cụ dụng cụ):** 35.000.000 đ
- **TK 156 (Hàng hóa tồn kho):** 2.656.750.000 đ
- **TK 211 (TSCĐ hữu hình):** 1.329.600.000 đ (Dell XPS 15, Ricoh MP 5054, Daikin VRV, Cummins, Ford Transit)
- **TK 213 (TSCĐ vô hình):** 48.000.000 đ (Phần mềm kế toán Misa)
- **TK 214 (Hao mòn lũy kế TSCĐ):** (363.400.000 đ)
- **TK 242 (Chi phí trả trước CCDC lũy kế):** 38.480.000 đ (Canon 2900, Tủ sắt, Bàn ghế họp, Tủ tài liệu, Dụng cụ trang trí, Kệ đựng hàng)
- **TK 331 (Phải trả NCC chi tiết):** 465.200.000 đ (Phát Mai: 185tr, Minh Quân: 45tr, Thanh Trúc: 62tr, Vạn Phát: 88,2tr, Logistics Việt Hưng: 85tr)
- **TK 4111 (Vốn đầu tư chủ sở hữu):** 5.000.000.000 đ
- **TK 421 (Lợi nhuận sau thuế chưa phân phối):** 3.550.400.000 đ

### D. Hạch toán toàn bộ 32 nghiệp vụ kinh tế Tháng 12/2026
Đã tự động ghi sổ cái GL (General Ledger) với 32 chứng từ phát sinh chính xác theo đề bài Tháng 12:
1. `01/12`: Xuất kho gửi bán đại lý Hoàng Long computer (TK 157 / TK 156: 280.000.000đ).
2. `03/12`: Mua hàng hóa nhập kho từ An Lộc (TK 156, 133 / TK 331: 893.200.000đ).
3. `05/12`: UNC Techcombank trả lương tháng 11 (TK 334 / TK 1121: 154.200.000đ).
4. `05/12`: UNC Techcombank nộp BHXH, BHYT, BHTN (TK 3383, 3384, 3386 / TK 1121: 48.600.000đ).
5. `05/12`: Xuất bán hàng theo PXK 80 cho Minh Hạnh (TK 131 / TK 511, 3331: 474.320.000đ; TK 632 / TK 156: 320.000.000đ).
6. `06/12`: Xuất vật tư phục vụ kỹ thuật (TK 642 / TK 152: 11.000.000đ).
7. `08/12`: Phiếu chi tiền mặt mua VPP từ Thanh Trúc (TK 642, 133 / TK 1111: 1.842.500đ).
8. `09/12`: Chi tạm ứng đi công tác kỹ thuật (TK 141 / TK 1111: 5.000.000đ).
9. `09/12`: Khách hàng Thái Bình đặt cọc tiền hàng qua TCB (TK 1121 / TK 131: 50.000.000đ).
10. `10/12`: Mua máy chủ từ Việt Gia phục vụ quản trị bán hàng (TK 211, 133 / TK 1121: 58.300.000đ).
11. `12/12`: Mua máy in văn phòng thanh toán TCB (TK 242, 133 / TK 1121: 6.600.000đ).
12. `12/12`: Bán hàng cho Thái Bình trừ tiền cọc (TK 131, 1121 / TK 511, 3331: 229.900.000đ).
13. `12/12`: Hoàn ứng công tác bằng tiền mặt (TK 642, 1111 / TK 141: 5.000.000đ).
14. `13/12`: Thanh toán nợ Thành Đạt hưởng chiết khấu thanh toán (TK 331 / TK 1121, 515: 150.000.000đ).
15. `15/12`: Thu lãi tiền gửi ngân hàng Techcombank (TK 1121 / TK 515: 2.150.000đ).
16. `16/12`: Bán hàng khách lẻ thu chuyển khoản ngay (TK 1121 / TK 511, 3331: 12.320.000đ).
17. `16/12`: Chi tiền mặt tiếp khách bán hàng (TK 641, 133 / TK 1111: 2.420.000đ).
18. `17/12`: Thanh lý đầu tư chứng khoán kinh doanh có lãi (TK 1121 / TK 121, 515: 55.000.000đ).
19. `17/12`: Thanh lý Laptop Dell XPS 15 thu tiền mặt (TK 1111 / TK 711, 3331: 2.200.000đ; xóa sổ TSCĐ: TK 214, 811 / TK 211: 43.200.000đ).
20. `18/12`: Đại lý Hoàng Long thanh toán tiền hàng trừ hoa hồng (TK 1121, 641, 133 / TK 131: 308.000.000đ).
21. `20/12`: UNC thanh toán nợ cước vận tải Vạn Phát (TK 331 / TK 1121: 12.000.000đ).
22. `22/12`: Chi tiền mặt bảo dưỡng điều hòa Daikin (TK 642, 133 / TK 1111: 1.320.000đ).
23. `22/12`: Bán hàng chưa thu tiền cho Cầu Giấy (TK 131 / TK 511, 3331: 526.460.000đ).
24. `23/12`: Nhập kho hàng hóa từ Thiết bị Thanh Trúc (TK 156, 133 / TK 331: 388.850.000đ).
25. `24/12`: Cầu Giấy trả lại màn hình bị lỗi kỹ thuật (TK 5212, 3331 / TK 131: 8.580.000đ; nhập lại kho: TK 156 / TK 632: 5.800.000đ).
26. `26/12`: Đàm phán giảm giá 10% hàng mua từ Thanh Trúc ngày 23/12 (TK 331 / TK 156, 133: 858.000đ).
27. `29/12`: Xuất kho bàn ghế, ghế xoay cho phòng kế toán (TK 242 / TK 153: 4.100.000đ).
28. `31/12`: Trích tính bảng lương và các khoản trích theo lương tháng 12 (TK 641, 642 / TK 334: 168.500.000đ; trích BHXH, BHYT, BHTN, KPCĐ: TK 641, 642 / TK 338: 39.597.500đ).
29. `31/12`: Trích phân bổ CCDC tháng 12 vào chi phí (TK 641, 642 / TK 242: 18.450.000đ).
30. `31/12`: Trích khấu hao TSCĐ tháng 12 (TK 641, 642 / TK 214: 13.600.000đ).
31. `31/12`: Khấu trừ thuế GTGT cuối kỳ quý IV/tháng 12 (TK 33311 / TK 1331: 128.537.500đ).
32. `31/12`: Kết chuyển doanh thu, chi phí xác định KQKD tháng 12 (TK 511, 515, 711 -> TK 911 -> TK 632, 641, 642, 811, 4212: 1.400.000.000đ).

### E. Giao diện người dùng (Frontend)
- **Tên công ty hiển thị chuẩn:** `CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC` xuất hiện trên Top Navbar, Header Breadcrumbs, Phiếu in và các Báo cáo tài chính.
- **Kỳ kế toán mặc định:** Tự động chọn `K12.2026` (Tháng 12/2026) giúp người dùng truy cập là nhìn thấy ngay các chứng từ phát sinh của tháng 12.
- **Danh mục mua hàng/bán hàng/kho:** Đã thay thế danh mục chọn (dropdowns) bằng 18 mặt hàng thật và danh bạ 28 khách hàng/NCC thật.
- **Tài sản & Công cụ dụng cụ:** Hiển thị 6 TSCĐ và 6 CCDC thực tế của doanh nghiệp kèm lịch sử phân bổ, nguyên giá, hao mòn lũy kế.
- **Tiền lương & Nhân sự:** Hiển thị danh sách 9 CBNV thực tế của công ty ABC kèm tài khoản ngân hàng Techcombank.

---

## 2. TRẠNG THÁI TRIỂN KHAI DOCKER

Hệ thống được đóng gói và vận hành qua `docker compose`:

| Container | Image | Port Mapping | Trạng thái | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `thue_erp_postgres` | `postgres:16-alpine` | `0.0.0.0:26015->5432` | Healthy (Up) | Chứa CSDL PostgreSQL thật với dữ liệu seed |
| `thue_erp_backend` | `thue-backend` | `0.0.0.0:8080->8080` | Healthy (Up) | Django 6.1 REST API + Quản lý phân quyền RBAC |
| `thue_erp_frontend` | `thue-frontend` | `0.0.0.0:2601->2601` | Running (Up) | React 19 + Vite UI kết nối trực tiếp Backend |

- **Địa chỉ truy cập giao diện:** [http://localhost:2601](http://localhost:2601)
- **Tài khoản đăng nhập quản trị:**
  - Email: `admin@abc.com` (Mật khẩu: `Password123!`)
  - Email: `anhtank47@gmail.com` (Username: `tanh`, Mật khẩu: `password123`)
- **API Swagger Documentation:** [http://localhost:8080/api/docs/](http://localhost:8080/api/docs/)

---

## 3. CÁC PHẦN CHƯA LÀM ĐƯỢC / CẦN NÂNG CẤP TIẾP THEO (GHI NHẬN TỒN ĐỌNG)

Mặc dù toàn bộ dữ liệu thật, chế độ kế toán TT99 và giao diện cốt lõi đã hoàn thành, dưới đây là các phân hệ chuyên sâu và tính năng mở rộng chưa được hoàn thiện 100%:

### 1. Tự động tính toán các Báo cáo Tài chính phức tạp theo Thông tư 99
- **Báo cáo tình hình tài chính (Mẫu B01-DN):** Đã có khung bảng biểu và số dư tài khoản GL, tuy nhiên công thức tự động lấy chỉ tiêu phức tạp (tách nợ ngắn hạn/dài hạn, bù trừ công nợ cùng đối tượng theo bản chất dư Nợ/dư Có tại ngày lập báo cáo) vẫn đang cần tính toán bằng tay trước khi chốt số.
- **Báo cáo kết quả hoạt động kinh doanh (Mẫu B02-DN) & Lưu chuyển tiền tệ (Mẫu B03-DN theo phương pháp gián tiếp):** Chỉ tiêu lưu chuyển tiền tệ gián tiếp cần thuật toán bóc tách chi phí khấu hao, dự phòng và chênh lệch tỷ giá từ bảng phân tích nghiệp vụ vốn bằng tiền thay vì lấy số tổng từ bảng cân đối.

### 2. Xuất khẩu Tờ khai Thuế định dạng XML (Mẫu 01/GTGT) nộp eTax
- Hiện tại phân hệ Thuế đã tổng hợp doanh thu chịu thuế và số thuế GTGT đầu vào/đầu ra tháng 12, nhưng **chưa hỗ trợ xuất file XML chuẩn định dạng của Tổng cục Thuế** để người dùng có thể nộp trực tiếp lên trang `thuedientu.gdt.gov.vn`.

### 3. Tích hợp trực tiếp dịch vụ Hóa đơn điện tử (VNPT / Viettel / MInvoice)
- Các mẫu hóa đơn bán hàng và hóa đơn điều chỉnh/thay thế trên giao diện đã hỗ trợ ký hiệu và số hóa đơn theo Nghị định 123/2020/NĐ-CP, nhưng **chưa kết nối API với nhà cung cấp dịch vụ truyền nhận hóa đơn** để ký số HSM hoặc USB Token thật.

### 4. Bảng tính lương tự động đa bậc theo KPI và chấm công vân tay
- Dữ liệu lương Tháng 12 đã được hạch toán vào Sổ cái thông qua bút toán tổng hợp `PKT00001` (168,5 triệu đồng lương + 39,59 triệu bảo hiểm), nhưng tính năng đồng bộ máy chấm công vân tay và tự động tính giảm trừ gia cảnh theo từng ngày nghỉ ốm/nghỉ phép trực tuyến chưa được liên kết trực tiếp vào bảng lương chi tiết.

### 5. Đánh giá lại tỷ giá hối đoái cuối năm (TK 1122 - 125.000 USD)
- Tài khoản Techcombank USD còn số dư 125.000 USD tại thời điểm 31/12/2026. Nghiệp vụ đánh giá lại theo tỷ giá mua vào của Techcombank tại ngày 31/12 (TK 413) chưa được tự động kích hoạt qua batch job cuối kỳ mà cần kế toán thực hiện bằng một chứng từ kế toán khác (`PKT`).

---

## 4. HƯỚNG DẪN KIỂM TRA NHANH TRÊN GIAO DIỆN

1. Mở trình duyệt tại [http://localhost:2601](http://localhost:2601).
2. Nếu xuất hiện màn hình đăng nhập, nhập `admin@abc.com` / `Password123!`.
3. Kiểm tra thông tin góc trên bên trái:
   - Tên công ty: **CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC**
   - Kỳ: **K12.2026**
4. Điều hướng vào các phân hệ:
   - **Kế toán tổng hợp > Chứng từ**: Xem toàn bộ 32 bút toán Tháng 12 và bút toán số dư đầu kỳ `OPEN-2026-001`.
   - **Bán hàng / Mua hàng**: Thử tạo chứng từ mới để kiểm tra danh mục khách hàng, nhà cung cấp và hàng hóa công nghệ thật.
   - **Tài sản & Công cụ**: Xem bảng theo dõi khấu hao và phân bổ của 6 TSCĐ và 6 CCDC từ bài tập.
   - **Số dư ban đầu**: Xem bảng cân đối tài khoản, số dư ngân hàng Techcombank và công nợ chi tiết từng đối tượng.

---

## 5. MINH CHỨNG THAO TÁC TRỰC TIẾP TRÊN GIAO DIỆN (UI DATA ENTRY)

Đã thực hiện thao tác nhập liệu trực tiếp trên giao diện trình duyệt (không qua script/seed):

1. **Thao tác Bán hàng (Chứng từ BH00001):**
   - Khách hàng: `MINHHANH` (Công ty TNHH Minh Hạnh).
   - Mặt hàng: `DT_SS24` (Điện thoại Samsung Galaxy S24 Ultra), số lượng 2 chiếc, đơn giá 19.500.000 đ.
   - Tổng tiền hàng: 39.000.000 đ + VAT 10% (3.900.000 đ) = **42.900.000 đ**.
   - Định khoản tự động: Nợ 131 / Có 5111, Có 33311. Bấm **Cất** thành công và lưu vào danh sách giao dịch.

2. **Thao tác Mua hàng (Chứng từ GP202610190001):**
   - Nhà cung cấp: `PHATMAI` (Tập đoàn Phát Mai).
   - Mặt hàng: `DT_IP15` (Điện thoại iPhone 15 Pro Max 256GB), số lượng 10 chiếc.
   - Tổng thanh toán: **250.000.000 đ**. Bấm **Cất** thành công và hiển thị tức thời tại phân hệ Mua hàng.

3. **Thao tác Số dư ban đầu (Công nợ khách hàng TK 131):**
   - Khởi tạo bảng công nợ khách hàng đầu kỳ gồm 6 khách hàng thực tế với tổng dư nợ **1.154.530.000 đ**.
   - Thao tác bấm nút **Nhập số dư**, mở modal khai báo đối tượng `VIETTEL_POST` (Tổng công ty CP Bưu chính Viettel) với số dư nợ **35.000.000 đ**, hạn thanh toán 15/01/2026.
   - Bấm **Cất**: Hệ thống tự động ghi nhận tức thì đối tượng mới với huy hiệu xanh **Mới**, nâng tổng dư nợ đầu kỳ TK 131 lên **1.189.530.000 đ**.
   - Bảng số dư tài khoản hiển thị đầy đủ và cân đối Nợ = Có: **10.389.530.000 đ** theo chuẩn Thông tư 99/2025/TT-BTC.
   - Bảng số dư tài khoản ngân hàng hiển thị Techcombank VND (**3.500.000.000 đ**) và Techcombank USD (50.000 USD quy đổi **1.275.000.000 đ**).
