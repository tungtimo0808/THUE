# KẾ HOẠCH DỰ ÁN KẾ TOÁN & THUẾ (SỔ VIỆT ERP)
> **Nguyên tắc cốt lõi sau mốc 20/11:** **Tập trung MAINTAIN & RÀ SOÁT LỖI. Chỉ khi nào hệ thống THẬT SỰ ỔN ĐỊNH mới bắt đầu phát triển tính năng mới.**  
> **Mục tiêu trước mắt:** Hoàn thiện và bàn giao phiên bản MVP đúng hẹn vào **20/11/2026** (Hiện tại đã hoàn thành **~85%** khối lượng MVP từ 124 commit Git thật).

---

## 1. SƠ ĐỒ ĐIỀU HÀNH DỰ ÁN

```
[CHẶNG 1: XÂY DỰNG NỀN TẢNG (21/09 → 04/11)]  ──►  ĐÃ XONG ≈ 85% (124 commits Git thật)
                       │
                       ▼
[CHẶNG 2: VỀ ĐÍCH BẢN MVP (05/11 → 20/11/2026)] ──►  CÒN 15 NGÀY NƯỚC RÚT ĐỂ BÀN GIAO
                       │
                       ▼
[CHẶNG 3: BẢO TRÌ & RÀ SOÁT LỖI (23/11 → 18/12/2026) - 4 TUẦN TRỌNG TÂM MAINTAIN]
   • Tuần 10: Đồng hành hỗ trợ kế toán nhập liệu chứng từ thật hàng ngày
   • Tuần 11: Rà soát toàn diện: lệch số sổ cái, lỗi in ấn, lỗi lọc, sót trường
   • Tuần 12: Vá lỗi thực tế, tối ưu tốc độ cho các thao tác thường dùng
   • Tuần 13: CỔNG ĐÁNH GIÁ ỔN ĐỊNH ──► ĐẠT ỔN ĐỊNH THÌ MỚI BẬT ĐÈN XANH LÀM TÍNH NĂNG MỚI!
                       │
                       ▼ (Chỉ triển khai khi hệ thống ĐÃ ỔN ĐỊNH)
[CHẶNG 4: MỞ RỘNG TÍNH NĂNG MỚI (TỪ CUỐI THÁNG 12/2026 TRỞ ĐI)]
   • Cuối 12/2026: Khóa sổ năm tài chính 2026 & chuyển số dư sang 2027
   • Tháng 01/2027: Tính giá thành sản xuất + Bảng lương tự động + Nộp thuế TVAN
   • Q1/2027 (Sau Tết): AI tự động đọc hóa đơn + App điện thoại cho Sếp duyệt chi
```

---

## 2. BẢNG LỘ TRÌNH TUẦN THEO TUẦN (W1 → SAU 20/11)

### PHẦN A: 9 TUẦN ĐẦU TIÊN – HOÀN THÀNH BẢN MVP (21/09 → 20/11/2026)

| Tuần | Thời gian | Trọng tâm | Công việc thực hiện chi tiết | Trạng thái |
| :---: | :---: | :--- | :--- | :---: |
| **W1** | 21–27/09/2026 | Khung giao diện | Khởi tạo dự án, dựng khung màn hình theo Figma cho Kế toán, Thuế, Kho | **ĐÃ XONG** |
| **W2** | 28/09–04/10/2026 | Chuẩn hóa nghiệp vụ | Khảo sát biểu mẫu, danh mục tài khoản, quy tắc kiểm tra khách hàng, NCC | **ĐÃ XONG** |
| **W3** | 05–11/10/2026 | Thu/Chi & Mẫu in | Làm mẫu in tiếng Việt (hợp đồng, nợ); phân hệ Thu/Chi tiền mặt, đối chiếu ngân hàng | **ĐÃ XONG** |
| **W4** | 12–18/10/2026 | Dữ liệu thật | Nạp cơ sở dữ liệu thật cho 13 phân hệ; hoàn thiện đăng nhập và phân quyền | **ĐÃ XONG** |
| **W5** | 19–25/10/2026 | Chuẩn MISA & TT99 | Đồng bộ giao diện MISA / Sổ Việt ERP; áp dụng TT99; test dữ liệu cty ABC | **ĐÃ XONG** |
| **W6** | 26/10–01/11/2026 | Cao điểm BCTC | Trọn bộ BCTC TT133, quản lý Đa công ty, phân hệ Tài sản cố định, tối ưu tốc độ | **ĐÃ XONG (45 commits)** |
| **W7** | 02–08/11/2026 | Khớp số (Hiện tại) | Chế độ TT58, 21 vai trò kế toán, khóa menu cố định, đối chiếu sổ sách Nợ=Có | **ĐANG LÀM (85%)** |
| **W8** | 09–15/11/2026 | Ổn định & Dữ liệu | Test chịu tải nhiều người, tự động sao lưu dữ liệu, hoàn thiện nạp Excel | **KẾ HOẠCH W8** |
| **W9** | 16–20/11/2026 | Nghiệm thu bàn giao | Kế toán trưởng nghiệm thu thực tế (UAT); ký biên bản nghiệm thu bàn giao | **VỀ ĐÍCH 20/11** |

---

### PHẦN B: KẾ HOẠCH BẢO TRÌ & RÀ SOÁT LỖI NGAY SAU 20/11 (4 TUẦN CAO ĐIỂM)

> **Mục tiêu:** Không vội vàng làm tính năng mới ngay. Tập trung bảo trì và kiểm tra kỹ lưỡng xem còn lỗi ngầm hoặc sót nghiệp vụ nào không.

| Tuần | Thời gian | Trọng tâm rà soát | Công việc kiểm tra cụ thể | Tiêu chuẩn đánh giá "ĐÃ ỔN" | Phụ trách |
| :---: | :---: | :--- | :--- | :--- | :---: |
| **W10** | 23–27/11/2026 | **Hỗ trợ người dùng nhập liệu thật** | Đồng hành trực tiếp cùng kế toán nhập hóa đơn mua/bán, phiếu thu/chi thực tế hàng ngày; trực giải đáp lỗi | Kế toán tự nhập liệu trơn tru, không gặp lỗi hệ thống chặn thao tác | Triển khai + Kế toán |
| **W11** | 30/11–04/12/2026 | **Rà soát đối chiếu Sổ sách & Mẫu in** | Kiểm tra Bảng cân đối phát sinh có luôn cân Nợ=Có không; kiểm tra xuất Excel/PDF BCTC có lệch cột, tràn chữ không | 100% số liệu sổ sách cân đối tuyệt đối; báo cáo xuất ra in ấn đẹp mắt | Kế toán trưởng + UI |
| **W12** | 07–11/12/2026 | **Vá lỗi thực tế & Tối ưu tốc độ** | Sửa dứt điểm các lỗi phát sinh trong quá trình dùng thử; kiểm tra kỹ tính tách biệt dữ liệu giữa các công ty | Mọi thao tác phản hồi dưới 1 giây; dữ liệu đa công ty an toàn 100% | Lập trình viên |
| **W13** | 14–18/12/2026 | **CỔNG ĐÁNH GIÁ ỔN ĐỊNH HỆ THỐNG** | Họp đánh giá toàn diện: Xác nhận hệ thống không còn lỗi tồn đọng; người dùng kế toán hoàn toàn hài lòng | **NẾU ĐÃ ỔN:** Bật đèn xanh làm tính năng mới.<br>**NẾU CHƯA ỔN:** Tiếp tục maintain đến khi ổn. | **Ban Lãnh đạo + Toàn đội** |

---

### PHẦN C: KẾ HOẠCH MỞ RỘNG TÍNH NĂNG MỚI (CHỈ TRIỂN KHAI KHI HỆ THỐNG ĐÃ ỔN ĐỊNH)

Sau khi Cổng đánh giá Tuần 13 xác nhận hệ thống đã thực sự ổn định, các tính năng mới sẽ được phát triển tuần tự:

1. **Cuối tháng 12/2026 (W14): Khóa sổ năm tài chính 2026:**
   - Kết chuyển kết quả hoạt động kinh doanh (TK 911), xác định lãi lỗ và khóa sổ năm 2026.
   - Tự động chuyển số dư sang năm tài chính 2027 an toàn.
2. **Tháng 01/2027 (W15 – W18): Bổ sung tính năng kế toán mở rộng:**
   - **Tính giá thành sản xuất cơ bản:** Tập hợp chi phí NVL (621), nhân công (622), sản xuất chung (627) để tính giá thành sản phẩm nhập kho (154/155).
   - **Bảng lương & Chấm công:** Bảng chấm công tự động, trích BHXH và tính thuế TNCN.
   - **Cổng nộp thuế TVAN & Ngân hàng điện tử:** Nộp tờ khai thuế 1 click; tự động lấy sao kê ngân hàng.
3. **Q1/2027 (Sau Tết Nguyên Đán): Nghiên cứu tính năng thông minh:**
   - AI tự động đọc hóa đơn PDF/ảnh chụp (OCR gợi ý định khoản).
   - Ứng dụng điện thoại (Mobile App) cho Giám đốc theo dõi doanh thu và duyệt chi từ xa.

---

## 3. KẾ HOẠCH HÀNH ĐỘNG 15 NGÀY NƯỚC RÚT VỀ ĐÍCH BẢN MVP (05/11 → 20/11)

- **05/11 (Hôm nay):** Khóa menu điều khiển phía trên, hết giật màn hình khi cuộn danh sách (*Đã xong*).
- **06–08/11:** Kiểm tra Bảng cân đối phát sinh luôn cân 100% Nợ = Có; test xuất file Excel/PDF BCTC TT133 & TT99.
- **09–12/11:** Test nhiều người dùng cùng lúc; test tự động sao lưu dữ liệu phòng sự cố.
- **13–15/11:** Hoàn thiện file mẫu Excel danh mục và số dư để kế toán nạp nhanh vào phần mềm.
- **16–18/11:** Kế toán thao tác thử toàn bộ luồng mua - bán - kho - tiền trên dữ liệu thực tế (UAT).
- **19–20/11:** Xử lý góp ý nhỏ, hoàn tất hướng dẫn nhanh, **ký biên bản nghiệm thu và chính thức bàn giao bản MVP vào ngày 20/11/2026**.
