# KẾ HOẠCH TRIỂN KHAI PHẦN MỀM KẾ TOÁN & THUẾ DOANH NGHIỆP (SỔ VIỆT ERP)
> **Mục tiêu tối thượng:** Hoàn thành toàn diện phiên bản vận hành cốt lõi (MVP) để nghiệm thu và đưa vào sử dụng thực tế vào ngày **20/11/2026**.  
> **Thời gian thực hiện:** 21/09/2026 → 20/11/2026 (Tổng cộng 9 tuần).  
> **Dữ liệu đối soát:** Tổng hợp và kiểm chứng dựa trên toàn bộ lịch sử 124 commits thực tế tại kho mã nguồn GitLab `timodapoettt/thue`.

---

## MỤC LỤC
1. [Phần 1: Bảng Điều Khiển Tổng Quan (Dashboard)](#phần-1-bảng-điều-khiển-tổng-quan-dashboard)
2. [Phần 2: 4 Quyết Định Then Chốt Giữ Vững Mốc 20/11](#phần-2-4-quyết-định-then-chốt-giữ-vững-mốc-2011)
3. [Phần 3: Lộ Trình 9 Tuần Chi Tiết (Từ Khởi Đầu Đến Ngày Về Đích)](#phần-3-lộ-trình-9-tuần-chi-tiết-từ-khởi-đầu-đến-ngày-về-đích)
4. [Phần 4: Báo Cáo Thực Tế Quá Trình Triển Khai (Dựa Trên Lịch Sử Git)](#phần-4-báo-cáo-thực-tế-quá-trình-triển-khai-dựa-trên-lịch-sử-git)
5. [Phần 5: Phạm Vi 12 Phân Hệ Nghiệp Vụ (Bản MVP 20/11 so với Bản Sau)](#phần-5-phạm-vi-12-phân-hệ-nghiệp-vụ-bản-mvp-2011-so-với-bản-sau)
6. [Phần 6: Quản Trị Rủi Ro & 5 Cổng Nghiệm Thu Bắt Buộc](#phần-6-quản-trị-rủi-ro--5-cổng-nghiệm-thu-bắt-buộc)
7. [Phần 7: Bộ Tiêu Chuẩn Chất Lượng & An Toàn Dữ Liệu Dễ Hiểu](#phần-7-bộ-tiêu-chuẩn-chất-lượng--an-toàn-dữ-liệu-dễ-hiểu)
8. [Phần 8: Kế Hoạch 15 Ngày Nước Rút Về Đích (05/11 → 20/11)](#phần-8-kế-hoạch-15-ngày-nước-rút-về-đích-0511--2011)

---

## PHẦN 1: BẢNG ĐIỀU KHIỂN TỔNG QUAN (DASHBOARD)

| Chỉ số theo dõi | Giá trị đo lường | Giải thích ý nghĩa thực tế |
| :--- | :---: | :--- |
| **Mốc về đích MVP** | **20/11/2026** | Thời hạn chốt phiên bản chạy thực tế có thể nghiệm thu bàn giao cho người dùng. |
| **Ngày hiện tại** | **05/11/2026** | Đang ở giữa Tuần 7. Dự án chỉ còn đúng **15 ngày** làm việc nước rút. |
| **Mức độ hoàn thành** | **≈ 85%** | Đã hoàn tất khung hệ thống, dữ liệu thật 13 phân hệ, đa công ty, BCTC TT133, TT58 và xuất báo cáo. |
| **Thời gian còn lại** | **2 Tuần** | Tuần 8 (Thử nghiệm toàn diện, an toàn sao lưu) & Tuần 9 (Nghiệm thu người dùng UAT & Bàn giao). |
| **Phương châm thực hiện** | **Chắc chắn - Đủ dùng** | Ưu tiên số một: Số liệu kế toán phải cân đối, chính xác tuyệt đối, dễ dùng cho kế toán viên. |

---

## PHẦN 2: 4 QUYẾT ĐỊNH THEN CHỐT GIỮ VỮNG MỐC 20/11

Để tránh tình trạng "vỡ tiến độ" thường gặp ở các dự án phần mềm kế toán, toàn đội ngũ thống nhất tuân thủ nghiêm ngặt 4 nguyên tắc sau:

1. **Không thay đổi nền tảng kỹ thuật giữa chừng:**  
   *Nguyên tắc:* Giữ nguyên toàn bộ cấu trúc công nghệ hiện tại đang hoạt động ổn định. Tuyệt đối không đập đi xây lại hay chuyển đổi sang công nghệ khác trong giai đoạn này để tập trung 100% thời gian cho việc hoàn thiện các bài toán kế toán thực tế.
2. **Chốt cứng danh sách tính năng (Freeze Scope):**  
   *Nguyên tắc:* Tập trung giải quyết dứt điểm các nghiệp vụ bắt buộc phải có cho một doanh nghiệp làm kế toán hàng ngày (Mua - Bán - Kho - Tiền - Thuế - Báo cáo tài chính). Mọi ý tưởng mới hoặc tính năng mở rộng phát sinh thêm sẽ được ghi nhận và đưa vào phiên bản sau (V1.1).
3. **Làm tính năng nào hoàn chỉnh ngay tính năng đó:**  
   *Nguyên tắc:* Không chấp nhận việc một màn hình chỉ "vẽ cho đẹp" mà bên dưới không lưu được số liệu thật. Mỗi khi một màn hình ra đời, nó phải có chức năng lưu dữ liệu, kiểm tra quyền hạn nhân viên, tự động sinh phiếu kế toán chuẩn xác và vào đúng sổ sách kế toán.
4. **Tạm hoãn các tính năng phức tạp chưa cấp thiết:**  
   *Nguyên tắc:* Tạm gác các phần việc nặng như: kết nối tự động trực tiếp với cổng cơ quan thuế (TVAN), trợ lý ảo AI, bảng chấm công tính lương chuyên sâu nhiều ngạch, dây chuyền sản xuất nhiều công đoạn. Những tính năng này sẽ triển khai ở giai đoạn 2 khi hệ thống kế toán cốt lõi đã chạy mượt mà.

---

## PHẦN 3: LỘ TRÌNH 9 TUẦN CHI TIẾT (TỪ KHỞI ĐẦU ĐẾN NGÀY VỀ ĐÍCH)

Lộ trình được chia theo từng tuần với các mục tiêu nghiệp vụ cụ thể:

```
[Tuần 1-2: Khởi động & Nghiệp vụ]  ──►  [Tuần 3-5: Dữ liệu thật & Quy trình Mua/Bán/Kho]
                  │                                            │
                  ▼                                            ▼
[Tuần 6-7: Báo cáo tài chính & Đa công ty]  ──►  [Tuần 8-9: Thử nghiệm & Về đích 20/11]
```

### Chi tiết từng tuần:

| Tuần | Khoảng ngày | Tên giai đoạn | Mục tiêu nghiệp vụ dễ hiểu | Kết quả thực tế đạt được | Trạng thái |
| :---: | :---: | :--- | :--- | :--- | :---: |
| **W1** | 21/09 – 27/09 | **Khởi động & Định hình giao diện** | Thiết lập dự án, thống nhất giao diện chuẩn của phần mềm kế toán. | Khởi tạo mã nguồn, đưa thiết kế Figma vào khung làm việc cho phân hệ Kế toán, Thuế, Kho. | **ĐÃ XONG** |
| **W2** | 28/09 – 04/10 | **Khảo sát nghiệp vụ kế toán** | Chuẩn hóa danh mục tài khoản, quy tắc kiểm tra tính hợp lệ của khách hàng, nhà cung cấp, hàng hóa. | Hoàn thành hồ sơ yêu cầu chi tiết cho toàn bộ các chứng từ mua bán và danh mục dùng chung. | **ĐÃ XONG** |
| **W3** | 05/10 – 11/10 | **Biểu mẫu in & Quản lý Tiền** | Thiết kế biểu mẫu in tiếng Việt (hợp đồng, thông báo nợ); phân hệ Thu - Chi - Ngân hàng. | Người dùng nhập thử phiếu thu/chi tiền mặt, nhập sổ phụ ngân hàng để đối chiếu; in biểu mẫu ra giấy/PDF. | **ĐÃ XONG** |
| **W4** | 12/10 – 18/10 | **Kết nối dữ liệu thật 13 phân hệ** | Thay thế toàn bộ dữ liệu tĩnh bằng cơ sở dữ liệu thật; hoàn thiện đăng ký, đăng nhập an toàn. | 13 phân hệ kết nối dữ liệu thật; người dùng có tài khoản riêng, dữ liệu lưu trữ trực tiếp trên máy chủ. | **ĐÃ XONG** |
| **W5** | 19/10 – 25/10 | **Chuẩn MISA & Thông tư 99** | Đồng bộ giao diện chuẩn MISA / Sổ Việt ERP; áp dụng TT 99/2025; nạp số liệu công ty thực tế (ABC). | Chạy thông suốt luồng Mua hàng → Nhập kho → Trả tiền trên chứng từ thực tế của công ty mẫu. | **ĐÃ XONG** |
| **W6** | 26/10 – 01/11 | **Đợt cao điểm - BCTC TT133 & Đa công ty** | Hoàn thành trọn bộ Báo cáo tài chính TT 133; quản lý nhiều công ty độc lập; tài sản cố định; tăng tốc mở trang. | Tuần bùng nổ (45 commit): Đưa lên máy chủ kiểm thử tự động, trọn bộ BCTC TT 133, quản lý tài sản, nút Lưu & In. | **ĐÃ XONG** |
| **W7** | 02/11 – 08/11 | **Chuẩn hóa TT 58 & Khớp số sổ sách** | Bổ sung Chế độ kế toán TT 58, 21 vai trò kế toán, kiểm tra cân đối Nợ=Có; xuất file Excel/PDF. | Đang hoàn thiện: Khớp số sổ cái, xuất file báo cáo đa năng, khóa thanh điều khiển không bị giật cuộn chuột. | **ĐANG LÀM (85%)** |
| **W8** | 09/11 – 15/11 | **Thử nghiệm toàn diện & Sao lưu an toàn** | Kiểm tra chịu tải nhiều người cùng dùng, tự động sao lưu dữ liệu, hoàn thiện công cụ nạp file Excel. | Chạy thử toàn bộ các kịch bản thực tế; đảm bảo người dùng nạp danh mục và số dư từ Excel mượt mà. | **KẾ HOẠCH BẮT BUỘC** |
| **W9** | 16/11 – 20/11 | **Nghiệm thu người dùng & Bàn giao chính thức** | Kế toán trưởng nghiệm thu thực tế (UAT); xử lý góp ý nhỏ cuối cùng; bàn giao phiên bản MVP chính thức. | Đóng gói phiên bản phát hành, hoàn thành tài liệu hướng dẫn nhanh, bàn giao đưa vào vận hành thực tế. | **MỤC TIÊU VỀ ĐÍCH** |

---

## PHẦN 4: BÁO CÁO THỰC TẾ QUÁ TRÌNH TRIỂN KHAI (DỰA TRÊN LỊCH SỬ GIT)

Tổng hợp từ **124 lượt đóng góp (commits)** của đội ngũ phát triển tại kho mã nguồn GitLab:

### 1. Giai đoạn tháng 09/2026: Đặt nền móng dự án (9 commits)
- **Công việc nổi bật:** Khởi tạo mã nguồn dự án, chuyển hóa bản thiết kế chi tiết trên Figma thành giao diện làm việc trực quan.
- **Giá trị mang lại:** Toàn bộ đội ngũ (kế toán, thiết kế, kỹ thuật) cùng nhìn thấy một bức tranh giao diện thống nhất, dễ hiểu, tránh hiểu lầm yêu cầu ngay từ vạch xuất phát.

### 2. Giai đoạn tuần 1 & tuần 2 tháng 10/2026: Dữ liệu thật & Biểu mẫu in ấn (24 commits)
- **Công việc nổi bật:** Xây dựng các mẫu in hợp đồng kinh tế, biên bản đối chiếu công nợ, thông báo thanh toán; hoàn thiện cơ chế Thu - Chi tiền mặt và đối chiếu số dư ngân hàng; kết nối cơ sở dữ liệu thật cho 13 phân hệ.
- **Giá trị mang lại:** Phần mềm thoát khỏi trạng thái "mô hình tĩnh" để bắt đầu nhận dữ liệu thật từ bàn phím người dùng.

### 3. Giai đoạn cuối tháng 10/2026: Tuần cao điểm bùng nổ tính năng (68 commits)
Đây là giai đoạn làm việc cường độ cao nhất của nhóm phát triển (từ 19/10 đến 01/11):
- **Chuẩn hóa nhận diện thương hiệu Sổ Việt ERP:** Thiết kế sơ đồ quy trình nghiệp vụ rõ ràng từng bước theo thói quen của kế toán viên Việt Nam.
- **Áp dụng chế độ kế toán Thông tư 99/2025/TT-BTC:** Điều chỉnh hệ thống tài khoản và mẫu biểu phù hợp quy định mới.
- **Đưa số liệu thực tế vào kiểm thử:** Sử dụng bộ chứng từ thực tế của công ty thương mại (ABC Company) để chạy thử nghiệm toàn bộ quy trình mua hàng, bán hàng, nhập xuất kho.
- **Tích hợp trọn bộ Báo cáo tài chính theo Thông tư 133/2016/TT-BTC:** Bảng cân đối kế toán, Báo cáo kết quả hoạt động kinh doanh, Báo cáo lưu chuyển tiền tệ và Thuyết minh BCTC.
- **Quản lý đa doanh nghiệp (Multi-Company):** Cho phép một người dùng quản lý độc lập nhiều công ty khác nhau, chuyển đổi qua lại chỉ bằng một cú nhấp chuột mà không bao giờ bị lẫn lộn số liệu.
- **Nâng cấp trải nghiệm người dùng kế toán:** Thêm bộ nút thao tác quen thuộc: "Lưu & Đóng", "Lưu & Thêm", "Lưu & In"; tối ưu hóa tốc độ tải trang cực nhanh (tải ngầm thông minh, không còn hiện tượng trắng trang).

### 4. Giai đoạn đầu tháng 11/2026 (Tính đến hôm nay 05/11): Hoàn thiện chiều sâu & Khớp số (23 commits)
- **Tích hợp thêm Chế độ kế toán Thông tư 58:** Cho phép doanh nghiệp linh hoạt lựa chọn chế độ kế toán phù hợp với quy mô.
- **Ma trận 21 vị trí công việc kế toán chuẩn:** Phân chia quyền hạn chi tiết: Kế toán trưởng, Kế toán bán hàng, Kế toán mua hàng, Kế toán kho, Thủ quỹ, Kế toán tổng hợp...
- **Bảo vệ dữ liệu cá nhân theo Luật mới (Nghị định 356 & Luật 91/2025):** Đảm bảo an toàn thông tin cá nhân của người sử dụng phần mềm.
- **Kiểm tra khớp đối chiếu sổ sách khép kín (End-to-End):** Đảm bảo số liệu từ chứng từ gốc chạy vào sổ chi tiết và lên Sổ cái luôn luôn cân đối Nợ = Có tuyệt đối.
- **Nâng cấp màn hình Báo cáo động & Xuất dữ liệu đa năng:** Cho phép kế toán xem báo cáo trực tiếp, hỗ trợ xuất file Excel, PDF, in ra giấy chuẩn biểu mẫu.
- **Cố định thanh điều khiển phía trên:** Khắc phục triệt để hiện tượng giật màn hình hoặc nhảy tab khi cuộn chuột xem danh sách dài.

---

## PHẦN 5: PHẠM VI 12 PHÂN HỆ NGHIỆP VỤ (BẢN MVP 20/11 SO VỚI BẢN SAU)

Để tất cả các thành viên hiểu rõ phần mềm làm được gì vào ngày 20/11, dưới đây là bảng phân định chi tiết:

| TT | Phân hệ nghiệp vụ | Tính năng BẮT BUỘC có trong bản MVP (20/11) | Lợi ích thiết thực cho người dùng | Tính năng TẠM HOÃN sang bản sau (V1.1) | Trạng thái hiện tại |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | **Quản lý Hệ thống & Đa Công ty** | Tạo nhiều công ty; phân quyền 21 vị trí kế toán; chuyển đổi công ty nhanh; ghi nhật ký ai đã làm gì. | Một phần mềm quản lý nhiều công ty, bảo mật riêng tư, không lo xem nhầm số liệu. | Đăng nhập tập trung một lần cho tập đoàn lớn (SSO phức tạp), tính cước tự động. | **90% (Đã xong)** |
| **2** | **Danh mục Dùng chung** | Khách hàng, Nhà cung cấp, Nhân viên, Kho hàng, Hàng hóa/Dịch vụ, Tài khoản ngân hàng, Hệ thống tài khoản kế toán. | Chuẩn hóa thông tin toàn công ty, tìm kiếm nhanh, tự động kiểm tra trùng mã số thuế. | Tự động đồng bộ danh bạ từ nhiều phần mềm ngoài khác. | **95% (Đã xong)** |
| **3** | **Quy trình Chứng từ & Phê duyệt** | Lập nháp → Gửi duyệt → Đã duyệt → Ghi sổ kế toán; số chứng từ nhảy tự động liên tục không trùng; người lập không tự duyệt. | Kiểm soát chặt chẽ quy trình nội bộ, chứng từ rõ ràng, không bị nhảy số hay ghi trùng lặp. | Bộ công cụ tự vẽ quy trình duyệt động phức tạp nhiều nhánh rẽ. | **85% (Đã xong)** |
| **4** | **Mua hàng & Công nợ phải trả** | Đơn mua hàng, Nhập kho mua hàng, Hóa đơn mua hàng đầu vào, Sổ chi tiết nợ phải trả từng nhà cung cấp, Phiếu đề nghị thanh toán. | Nắm rõ hàng đã về kho chưa, hạn nợ của từng nhà cung cấp, tránh thanh toán nhầm hoặc trễ hạn. | Đánh giá và xếp hạng nhà cung cấp chuyên sâu nhiều tiêu chí. | **90% (Đã xong)** |
| **5** | **Tiền mặt & Tiền gửi Ngân hàng** | Phiếu thu, Phiếu chi tiền mặt; Giấy báo Nợ, Báo Có ngân hàng; Chuyển tiền nội bộ; Nhập sổ phụ ngân hàng để đối chiếu số dư. | Kiểm soát dòng tiền vào ra mỗi ngày, đối chiếu khớp đúng với số dư thực tế tại ngân hàng. | Kết nối tự động trực tiếp với ngân hàng điện tử (Open Banking thời gian thực). | **90% (Đã xong)** |
| **6** | **Bán hàng & Thu hồi Công nợ** | Báo giá, Đơn đặt hàng, Xuất kho bán hàng, Hóa đơn bán hàng, Sổ theo dõi nợ phải thu từng khách hàng, Thu tiền bán hàng theo hóa đơn. | Theo dõi sát sao từng đơn hàng giao cho khách, đốc thúc thu hồi công nợ đúng hạn, tránh thất thoát tiền. | Chăm sóc khách hàng tự động (CRM) chuyên sâu nhiều bước. | **85% (Đã xong)** |
| **7** | **Quản lý Kho & Giá vốn xuất kho** | Phiếu nhập kho, xuất kho, chuyển kho; Báo cáo tồn kho tức thời; Biên bản kiểm kê kho; Tự động tính giá vốn hàng xuất bán. | Biết ngay trong kho còn bao nhiêu hàng, giá trị tồn kho là bao nhiêu, phát hiện thừa thiếu khi kiểm kê. | Hoạch định nguyên vật liệu sản xuất phức tạp (MRP) nhiều công đoạn. | **85% (Đã xong)** |
| **8** | **Kế toán Tổng hợp & Sổ Cái** | Tự động định khoản Nợ/Có; Phiếu kế toán tổng hợp; Khóa sổ kỳ kế toán; Nhập số dư đầu kỳ; Lập Bảng cân đối phát sinh tài khoản tự động. | Kế toán trưởng kiểm soát toàn bộ số liệu tài chính; số liệu tự động tổng hợp, không phải cộng tay. | Tự động phân bổ chi phí đa chiều phức tạp nhiều chi nhánh hợp nhất. | **85% (Đang hoàn thiện)** |
| **9** | **Thuế & Hóa đơn** | Gắn link hóa đơn điện tử; Bảng kê hóa đơn GTGT mua vào; Bảng kê hóa đơn GTGT bán ra; Hỗ trợ xuất dữ liệu phục vụ lập Tờ khai thuế GTGT. | Tiết kiệm 90% thời gian tổng hợp bảng kê hóa đơn thuế, sẵn sàng dữ liệu để nộp báo cáo thuế đúng hạn. | Kết nối trực tiếp tự động nộp tờ khai lên cổng thuế điện tử (T-VAN trực tiếp). | **80% (Đang hoàn thiện)** |
| **10** | **Tài sản Cố định & Công cụ Dụng cụ** | Khai báo tăng tài sản; Tự động tính và trích khấu hao hàng tháng; Phân bổ chi phí công cụ dụng cụ theo từng kỳ; Ghi giảm/thanh lý tài sản. | Không lo quên trích khấu hao, số liệu phân bổ chi phí đưa vào chi phí hợp lý hàng tháng chính xác. | Lập kế hoạch bảo trì bảo dưỡng thiết bị máy móc nâng cao. | **85% (Đã xong)** |
| **11** | **Báo cáo Tài chính & Sổ Sách** | Trọn bộ BCTC theo TT 133 / TT 99 / MISA (Bảng Cân đối kế toán, Kết quả kinh doanh, Lưu chuyển tiền tệ, Thuyết minh); Sổ cái; Xuất Excel/PDF. | Doanh nghiệp có sẵn báo cáo tài chính chuẩn mực để nộp cơ quan thuế, ngân hàng hoặc phục vụ quản trị. | Hệ thống báo cáo biểu đồ trực quan thông minh (BI) tùy biến nâng cao. | **85% (Đang hoàn thiện)** |
| **12** | **Nhập Dữ liệu Excel & Sao Lưu An Toàn** | Nạp nhanh danh mục Khách hàng, NCC, Hàng hóa và Số dư ban đầu từ file Excel; Tự động sao lưu dữ liệu dự phòng hàng ngày; Khôi phục dữ liệu. | Giúp khách hàng mới dễ dàng chuyển số liệu từ Excel cũ sang dùng phần mềm; yên tâm không sợ mất dữ liệu. | Tự động chuyển đổi từ hàng chục loại phần mềm kế toán cũ khác nhau. | **70% (Trọng tâm W8)** |

---

## PHẦN 6: QUẢN TRỊ RỦI RO & 5 CỔNG NGHIỆM THU BẮT BUỘC

### 1. Quản trị các rủi ro thường gặp
1. **Rủi ro phát sinh việc mới làm trễ hạn:**  
   *Xử lý:* Thực hiện kỷ luật "Đóng băng phạm vi" (Freeze scope). Mọi đề xuất phát sinh mới đều hẹn lại cho bản V1.1.
2. **Rủi ro sai lệch số liệu kế toán (Sổ cái không cân):**  
   *Xử lý:* Hệ thống bắt buộc mọi chứng từ khi ghi sổ phải có Tổng Nợ = Tổng Có. Chứng từ đã ghi sổ muốn sửa phải thực hiện thủ tục Bỏ ghi sổ rõ ràng.
3. **Rủi ro lẫn lộn dữ liệu giữa các công ty:**  
   *Xử lý:* Mỗi yêu cầu tra cứu số liệu đều bị kiểm tra nghiêm ngặt mã công ty tại máy chủ. Người của công ty A tuyệt đối không xem được dữ liệu công ty B.
4. **Rủi ro bấm đúp chuột tạo chứng từ trùng:**  
   *Xử lý:* Hệ thống tự động khóa phím bấm khi đang gửi dữ liệu; mỗi chứng từ chỉ được lưu đúng 1 lần duy nhất dù người dùng bấm chuột liên tục.
5. **Rủi ro file Excel nhập liệu bị sai:**  
   *Xử lý:* Cung cấp file mẫu Excel chuẩn, phần mềm tự kiểm tra trước số liệu và chỉ rõ dòng bị sai để người dùng chỉnh sửa nhanh chóng.

### 2. Bộ 5 Cổng nghiệm thu (Go / No-Go Gates)

```
[Cổng 1: Chốt phạm vi (W3)]  ──►  [Cổng 2: Luồng Mua/Bán/Kho (W5)]  ──►  [Cổng 3: Sổ sách cân đối (W7)]
                                                                                       │
                                                                                       ▼
[Cổng 5: Nghiệm thu bàn giao (20/11)]  ◄───  [Cổng 4: Ổn định & Nhập Excel (W8)] ◄────┘
```

- **CỔNG 1 (Tuần 3 - ĐÃ VƯỢT QUA):** Chốt toàn bộ danh sách tính năng phiên bản MVP, không mở thêm phân hệ mới.
- **CỔNG 2 (Tuần 5 - ĐÃ VƯỢT QUA):** Luồng Mua hàng → Kho → Hóa đơn → Trả tiền chạy trơn tru trên dữ liệu công ty mẫu ABC.
- **CỔNG 3 (Tuần 7 - HẠN CHÓT 08/11):** Bảng cân đối phát sinh tài khoản tự động cân đối Nợ = Có; Báo cáo tài chính xuất đúng số liệu đã ghi sổ.
- **CỔNG 4 (Tuần 8 - HẠN CHÓT 15/11):** Hệ thống không còn lỗi nghiêm trọng; kiểm tra sao lưu tự động thành công; nhập dữ liệu từ file Excel mượt mà.
- **CỔNG 5 (Tuần 9 - HẠN CHÓT 20/11):** Kế toán trưởng và người dùng đại diện ký biên bản nghiệm thu; phần mềm chính thức đi vào hoạt động thực tế.

---

## PHẦN 7: BỘ TIÊU CHUẨN CHẤT LƯỢNG & AN TOÀN DỮ LIỆU DỄ HIỂU

Thay vì dùng các thuật ngữ kỹ thuật phức tạp (SaaS NFR, Multi-tenant, RLS, PITR...), toàn bộ tiêu chuẩn chất lượng được chuẩn hóa thành ngôn ngữ kinh doanh rõ ràng:

1. **Tính riêng tư và bảo mật thông tin:**  
   Mỗi công ty sử dụng phần mềm có một không gian dữ liệu riêng biệt. Dù hàng trăm công ty cùng dùng chung một phần mềm thì thông tin số liệu kế toán vẫn được bảo vệ tuyệt đối bí mật, không thể rò rỉ sang nhau.
2. **Tốc độ làm việc nhanh chóng:**  
   Phần mềm mở các danh mục thông thường trong vòng chưa đầy 1 giây. Các thao tác bấm nút Lưu phiếu, Tìm kiếm chứng từ diễn ra tức thì, không để kế toán phải chờ đợi lâu.
3. **Không làm gián đoạn công việc của nhau:**  
   Khi một kế toán viên đang xuất một bảng báo cáo sổ sách rất nặng cả năm, các nhân viên khác ở phòng bán hàng hoặc thủ kho vẫn nhập liệu và xuất hóa đơn bình thường mà không bị chậm.
4. **An toàn đăng nhập và bảo vệ tài khoản:**  
   Mật khẩu của người dùng được mã hóa an toàn nhiều lớp. Hệ thống tự động khóa tạm thời tài khoản nếu có người cố tình nhập dò mật khẩu quá 5 lần.
5. **Nhật ký minh bạch (Truy vết rõ ràng):**  
   Hệ thống tự động ghi lại lịch sử thao tác: Ai đã lập phiếu, ai đã duyệt, ai đã sửa đổi và sửa vào thời điểm nào. Điều này giúp công tác quản lý và kiểm toán nội bộ diễn ra minh bạch, rõ ràng.
6. **Bảo toàn dữ liệu phòng sự cố (Sao lưu tự động):**  
   Dữ liệu kế toán được tự động sao lưu dự phòng đều đặn mỗi ngày. Nếu chẳng may máy chủ gặp sự cố kỹ thuật ngoài ý muốn, dữ liệu được khôi phục đầy đủ và đưa hệ thống hoạt động trở lại trong vòng tối đa 2 giờ.
7. **Khởi tạo doanh nghiệp mới nhanh chóng:**  
   Khi có một khách hàng mới bắt đầu sử dụng, việc khởi tạo công ty mới chỉ mất khoảng 2 phút với đầy đủ hệ thống tài khoản, biểu mẫu và phân quyền sẵn có để dùng được ngay.

---

## PHẦN 8: KẾ HOẠCH 15 NGÀY NƯỚC RÚT VỀ ĐÍCH (05/11 → 20/11)

Chỉ còn đúng **15 ngày** trước mốc bàn giao 20/11. Dưới đây là lịch trình hành động cụ thể cho từng ngày:

```
[05 - 08/11]: Hoàn thiện Khớp số & Xuất BCTC  ──►  [09 - 15/11]: Kiểm thử toàn diện & Nhập liệu Excel
                                                                     │
                                                                     ▼
                                                  [16 - 20/11]: Nghiệm thu thực tế & BÀN GIAO MVP
```

### 1. Giai đoạn Hoàn tất Khớp số & Xuất báo cáo (05/11 – 08/11):
- **Ngày 05/11 (Hôm nay):** Hoàn thiện việc khóa cố định thanh điều khiển, kiểm tra lại bộ chọn ngày tháng và bộ lọc báo cáo không bị giật lag.
- **Ngày 06/11:** Kiểm tra kỹ lưỡng các mẫu xuất báo cáo (Excel, PDF) đảm bảo đúng mẫu Thông tư 133 và Thông tư 99, định dạng số tiền VND rõ ràng (dấu phẩy, dấu chấm chuẩn mực).
- **Ngày 07/11:** Chạy kịch bản kiểm tra đối chiếu số liệu khép kín: Nhập thử nghiệp vụ từ Mua hàng, Bán hàng, Thu tiền, Chi tiền, trích khấu hao tài sản → Kiểm tra Bảng cân đối phát sinh tài khoản tự động cân đối 100%.
- **Ngày 08/11:** Tổ chức họp rà soát Cổng 3 (Accounting Close Gate) để chốt bước hoàn thiện nghiệp vụ kế toán cốt lõi.

### 2. Giai đoạn Thử nghiệm Toàn diện & Nhập liệu Excel (09/11 – 15/11):
- **Ngày 09/11 – 11/11:** Kiểm tra tính ổn định khi nhiều người cùng vào làm việc cùng lúc; thử nghiệm cơ chế tự động sao lưu dữ liệu và kịch bản khôi phục khi có sự cố.
- **Ngày 12/11 – 13/11:** Hoàn thiện bộ công cụ nhập dữ liệu từ file Excel (Danh mục Khách hàng, Nhà cung cấp, Hàng hóa, Số dư đầu kỳ). Đảm bảo kế toán nạp file mẫu thành công mà không gặp lỗi.
- **Ngày 14/11 – 15/11:** Rà soát và xử lý toàn bộ các lỗi hiển thị hoặc lỗi thao tác còn tồn đọng; chốt phiên bản ứng viên phát hành (RC1 - Cổng 4).

### 3. Giai đoạn Nghiệm thu Người dùng & Bàn giao Chính thức (16/11 – 20/11):
- **Ngày 16/11 – 17/11:** Hướng dẫn kế toán trưởng và người dùng đại diện thao tác trực tiếp trên phần mềm theo kịch bản thực tế của doanh nghiệp.
- **Ngày 18/11:** Tiếp thu và chỉnh sửa nhanh các góp ý về sự thuận tiện khi thao tác (nếu có).
- **Ngày 19/11:** Hoàn tất bộ tài liệu hướng dẫn sử dụng nhanh và video ngắn hướng dẫn các thao tác cơ bản (Lập chứng từ, Quản lý kho, Xuất báo cáo tài chính).
- **Ngày 20/11/2026:** **KÝ BIÊN BẢN NGHIỆM THU VÀ CHÍNH THỨC BÀN GIAO PHIÊN BẢN MVP ĐI VÀO SỬ DỤNG.**
