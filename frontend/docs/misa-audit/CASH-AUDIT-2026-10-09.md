# Kết luận audit Tiền mặt — 09/10/2026

Đã truy cập trực tiếp MISA và frontend đang chạy, duyệt 7 tab chính và ghi nhận 20 nhóm component. Frontend đã có khung khá đầy đủ, nhưng chưa đạt mức tương đương MISA về form, tham số và thao tác. Một nút hiển thị thông báo chưa được tính là một chức năng hoàn tất.

Lượt này chỉ kiểm tra và lập kết luận, giữ nguyên mã frontend bạn vừa sửa. Các thao tác trên MISA chỉ mở/xem/hủy; không cất chứng từ, ghi sổ, trả tiền hoặc nhập dữ liệu. Đánh giá tập trung vào giao diện và thao tác frontend; số liệu mẫu của hai hệ thống khác nhau.

## Những phần đã kiểm tra đạt

- Có đủ 7 tab: Quy trình, Đề nghị chi tiền, Thu chi tiền, Đề nghị quyết toán tạm ứng, Dự báo dòng tiền, Kiểm kê, Báo cáo.
- Quy trình có đủ 4 nút nghiệp vụ, 5 báo cáo nhanh, 4 tiện ích và khối AMIS Quy trình.
- Đề nghị chi tiền: nội dung luồng tự động 3 bước khớp MISA.
- Thu chi: có cột cốt lõi, bảng chi tiết, chọn dòng, tổng, phân trang; lọc tháng không có dữ liệu sẽ ẩn chi tiết cũ.
- Thu theo hóa đơn: lấy dữ liệu khách hàng mẫu được. Thu nhiều hóa đơn có đủ 16 cột nội dung.
- Nộp bảo hiểm, Trả lương: khung trường và cột tương ứng MISA; lấy dữ liệu mẫu được.
- Trả tiền NCC theo hóa đơn: lấy dữ liệu mẫu được; 11 cột đầu khớp.
- Phiếu chi: thêm dòng tăng từ 1 lên 2. Chi mua ngoài: 1.000.000 × 10% cho tiền thuế 100.000; ẩn TK Nợ/TK Có hoạt động.
- Không thấy lỗi console trong các trang vừa kiểm tra.

Các kết quả trên chỉ xác nhận đúng phần đã thử; chưa xác nhận toàn bộ các nhánh, lưu/in/xuất hoặc tính toán nghiệp vụ.

## Việc cần sửa trước

1. Báo cáo: 7 thẻ khác nhau đang mở lại cùng mẫu Sổ chi tiết quỹ tiền mặt. Chọn tháng 08 chỉ đổi tên kỳ, ngày và giao dịch vẫn là tháng 09. Cần mẫu riêng và tham số thật cho từng báo cáo.
2. Hoàn thiện các nút đang chỉ notify: thêm quyết toán/đề nghị, kiểm kê, xuất/nhập, thiết lập cột, bộ lọc nâng cao và báo cáo nhanh.
3. Bổ sung form Kiểm kê và Dự báo dòng tiền đúng luồng MISA, đồng thời giữ các bảng và biểu đồ hiện có.
4. Thay mốc ngày cố định bằng ngày/kỳ đang chọn; Phiếu thu/chi, Thu nhiều hóa đơn, Nộp thuế/bảo hiểm, Trả lương, Trả tiền NCC đều có mốc cũ.
5. Bổ sung trường/cột còn thiếu: Nhân viên Phiếu thu; Người nhận Phiếu chi; chiết khấu trả NCC; Có hóa đơn/Nhóm HHDV mua vào; nhánh thuế nhập khẩu.
6. Hoàn thiện điều hướng Khách hàng/NCC dưới Quy trình, menu chứng từ và thanh thao tác hàng loạt.

## Kết quả theo từng trang và component

### Quy trình

**Kết luận:** Khớp nội dung chính; cần kiểm tra menu và liên kết.

Đã có/đã thử:

- 7 tab chính
- 4 nút nghiệp vụ
- 5 báo cáo nhanh
- Khách hàng/Nhà cung cấp/Nhân viên/Tùy chọn
- khối AMIS Quy trình

Còn thiếu hoặc cần kiểm tra:

- Tỷ lệ/chiều cao sơ đồ và cột báo cáo khác
- Báo cáo nhanh chỉ notify trong mã, chưa mở đúng báo cáo

### Phiếu thu

**Kết luận:** Form đã có; chưa khớp trường và mặc định.

Đã có/đã thử:

- 5 loại thu tiền đúng danh sách
- 7 cột hạch toán
- Thêm dòng/Xóa hết dòng/Ghi chú
- Kèm theo/Tham chiếu/Tổng tiền/Cất/Cất và Thêm/Hủy

Còn thiếu hoặc cần kiểm tra:

- Thiếu trường Nhân viên ở phần thông tin chung (MISA loại 1 và 5 có)
- Loại 1 dùng Mã/Tên đối tượng thay vì Mã/Tên khách hàng
- Ngày mặc định 02/10/2026 khác ngày hiện tại 09/10/2026
- Thu khác tự điền TK Có 711 trong khi MISA để trống
- Đính kèm và các nút phụ cần kiểm tra hành vi

### Đề nghị chi tiền

**Kết luận:** Khớp luồng giới thiệu; danh sách chưa đủ tương tác.

Đã có/đã thử:

- Luồng 3 bước AMIS Quy trình → Kế toán
- 5 loại đề nghị
- Nút Thiết lập tự động

Còn thiếu hoặc cần kiểm tra:

- Thêm đề nghị chi trên danh sách chỉ hiện toast, không có form
- Mở số đề nghị chỉ notify (đọc mã)
- Danh sách đề nghị là phần thêm của frontend, MISA dataset hiện chỉ có luồng tự động; chưa xác minh nguồn danh sách

### Thu, chi tiền

**Kết luận:** Bảng khớp khung; toolbar và KPI chưa hoàn thiện.

Đã có/đã thử:

- Cột chính theo MISA, giữ thêm Ngày chứng từ/Trạng thái của frontend
- Tìm kiếm, lọc kỳ, chọn dòng, tổng và phân trang
- Chi tiết không hiện chứng từ cũ khi lọc trống

Còn thiếu hoặc cần kiểm tra:

- Bộ lọc nâng cao chưa có form 5 trường và nút Lọc/Bộ lọc mặc định
- Xuất/nhập, thiết lập cột, làm mới, sắp xếp chỉ notify
- Chi tiết thiếu tổng và phân trang riêng
- Chọn hàng loạt thiếu Ghi sổ/Bỏ ghi/Xóa; chưa có menu Nhân bản từng dòng
- 3 thẻ tổng thu/chi/tồn quỹ dùng số và mốc thời gian cố định

### Phiếu chi

**Kết luận:** Có form; thiếu trường và menu.

Đã có/đã thử:

- 8 loại chuẩn (MISA còn có loại 9 tùy chỉnh)
- Các trường NCC/địa chỉ/nhân viên/lý do/kèm theo/tham chiếu
- Thêm dòng chạy được (1→2)
- TK 331/111 của loại 1 khớp

Còn thiếu hoặc cần kiểm tra:

- Thiếu Người nhận
- Thiếu Đối tượng/Tên đối tượng ở bảng hạch toán
- Ngày mặc định cố định 02/10/2026
- Thiếu menu Cất và In (frontend chỉ Cất và Thêm)
- Thiếu thêm nhanh lý do thu/chi tùy chỉnh (MISA có nút + và loại 9)

### Đề nghị quyết toán tạm ứng

**Kết luận:** Chưa khớp màn hình MISA hiện tại.

Đã có/đã thử:

- Có trang, danh sách mẫu, tìm kiếm và nút lập phiếu thu hoàn ứng

Còn thiếu hoặc cần kiểm tra:

- Thiếu luồng tự động 3 bước và Thiết lập tự động như MISA
- Lập quyết toán tạm ứng chỉ toast, không mở form
- Số quyết toán chỉ notify
- Chưa xác minh nguồn bảng danh sách vì MISA hiện mở trang luồng

### Dự báo dòng tiền

**Kết luận:** Giao diện khác MISA đáng kể; giữ phần đã có và bổ sung luồng MISA.

Đã có/đã thử:

- Có giao diện thu/chi/tồn và thêm khoản dự kiến riêng của frontend

Còn thiếu hoặc cần kiểm tra:

- Thiếu bước chọn Kỳ/Từ ngày/Đến ngày
- Thiếu form MISA gồm Mã chỉ tiêu/Tên chỉ tiêu/Số tiền, nhóm A/B/C/D và tiền mặt/tiền gửi/tiền đang chuyển
- Thiếu Thêm chỉ tiêu, Cất và In, danh sách các bản dự báo
- Kỳ/ngày, phân tích AVA và độ tin cậy đang là dữ liệu cố định; chưa khớp MISA
- Xuất Excel chỉ notify

### Kiểm kê

**Kết luận:** Chưa có form hoạt động theo MISA.

Đã có/đã thử:

- Có danh sách biên bản và bảng mệnh giá mẫu
- Có tổng tiền thực tế/sổ sách/chênh lệch

Còn thiếu hoặc cần kiểm tra:

- Nút Thêm/In/Xử lý chênh lệch chỉ notify
- Thiếu bước chọn Đến ngày
- Thiếu form Mục đích/Kiểm kê đến ngày/Loại tiền/Tham chiếu/Số/Ngày/Giờ
- Thiếu bảng thành viên Họ tên/Chức danh/Đại diện
- Chỉ có 6 mệnh giá, MISA có 9 (thiếu 5.000/2.000/1.000)
- Thiếu số lượng editable/diễn giải/thêm-xóa dòng/Đối chiếu/Lý do/Kết luận/Đã xử lý chênh lệch/Đính kèm
- Biên bản mẫu không đổi khi chọn số biên bản

### Báo cáo Tiền mặt

**Kết luận:** Danh sách có; mẫu báo cáo và tham số chưa đúng.

Đã có/đã thử:

- Có 9 thẻ báo cáo, tìm kiếm, nhóm và ghim yêu thích
- Mẫu Sổ chi tiết và mẫu tổng hợp 12 tháng mở được

Còn thiếu hoặc cần kiểm tra:

- 7 báo cáo khác (index 2–8) đều mở cùng mẫu Sổ kế toán chi tiết quỹ tiền mặt, không có mẫu riêng
- Đổi tháng 08 nhưng ngày Từ/Đến và giao dịch vẫn là tháng 09
- Thiếu chọn tài khoản, cộng gộp bút toán/chứng từ và thứ tự thu-chi
- Chọn tham số và Xuất Excel chỉ notify
- Thiếu Ngôn ngữ báo cáo, Ẩn/hiện báo cáo, lưu báo cáo/danh sách đã lưu
- Mẫu chi tiết thiếu Số phiếu thu/Số phiếu chi riêng, Tài khoản, Người nhận/Người nộp so với bảng MISA

### Tiện ích dưới Quy trình

**Kết luận:** Có nút nhưng điều hướng chưa khớp.

Đã có/đã thử:

- Có đủ 4 nút Khách hàng/Nhà cung cấp/Nhân viên/Tùy chọn

Còn thiếu hoặc cần kiểm tra:

- Khách hàng mở Thu tiền theo hóa đơn, trong khi MISA mở Danh mục Khách hàng (đã kiểm tra trực tiếp)
- Nhà cung cấp mở Trả tiền NCC thay vì Danh mục (đọc mã; cần xác minh lại MISA)
- Nhân viên/Tùy chọn/Thiết lập tự động/bài viết chỉ notify
- 5 báo cáo nhanh/Tất cả báo cáo chỉ notify

### Thu tiền theo hóa đơn

**Kết luận:** Khá gần MISA; thiếu một cột và cần kiểm tra số thu.

Đã có/đã thử:

- Phương thức Tiền mặt/Tiền gửi
- Khách hàng/Nhân viên bán hàng/Ngày thu tiền
- Lấy dữ liệu hoạt động với khách hàng mẫu (5 dòng)
- Các cột công nợ, điều khoản và chiết khấu
- Ngày mới lấy đúng 09/10/2026

Còn thiếu hoặc cần kiểm tra:

- Thiếu cột Ngày chứng từ
- Chưa kiểm tra đầy đủ phân bổ số thu, chiết khấu, lưu chuyển sang Phiếu thu

### Thu nhiều hóa đơn/nhiều khách hàng

**Kết luận:** Khớp nhiều trường; sai ngày kỳ.

Đã có/đã thử:

- Đủ 16 cột nội dung theo MISA
- Phương thức/Thời gian/Từ-Đến/Nhân viên/Nhóm KH/Ngày thu
- Lấy dữ liệu và tìm kiếm có giao diện

Còn thiếu hoặc cần kiểm tra:

- Hôm nay/Ngày thu mặc định 30/09/2026 thay vì ngày hiện tại
- Tháng này tạo kỳ tháng 09/2026 trong ngày 09/10/2026
- Chưa kiểm tra phân bổ thu/chiết khấu và tạo phiếu cuối luồng

### Nộp thuế

**Kết luận:** Thuế khác gần đúng; Thuế nhập khẩu chưa đúng cấu trúc.

Đã có/đã thử:

- Loại thuế/ngày/phương thức/Tổng tiền
- Thuế khác: bảng Khoản phải nộp/Số phải nộp/Số nộp lần này
- Các loại thuế phụ trên frontend được giữ

Còn thiếu hoặc cần kiểm tra:

- Ngày nộp cố định 30/09/2026
- Thuế nhập khẩu thiếu 5 checkbox loại thuế và điều kiện TKĐƯ 133
- Thiếu bảng chứng từ mua hàng nhiều nhóm cột thuế NK/CBPG/TTĐB/BVMT/GTGT và tài khoản
- MISA nhánh Loại thuế có 2 loại; frontend 6 loại là phần thêm, chưa có dạng nhập khẩu tương ứng

### Nộp bảo hiểm

**Kết luận:** Khớp form cơ bản; cần sửa ngày và kiểm tra hoàn tất luồng.

Đã có/đã thử:

- Phương thức Tiền mặt/Tiền gửi
- Ngày nộp/Lấy dữ liệu
- 3 cột khoản phải nộp và tiền
- Lấy dữ liệu hiển thị 4 dòng mẫu

Còn thiếu hoặc cần kiểm tra:

- Ngày cố định 30/09/2026
- Chưa kiểm tra phân bổ số nộp và chuyển sang chứng từ cuối luồng

### Trả lương

**Kết luận:** Khớp form cơ bản; cần sửa ngày và kiểm tra hoàn tất luồng.

Đã có/đã thử:

- Đủ các cột nhân viên/đơn vị/tài khoản/ngân hàng/số còn phải trả/số trả/chức năng
- Phương thức thanh toán/ngày trả/Lấy dữ liệu
- Lấy dữ liệu hoạt động với 4 nhân viên mẫu

Còn thiếu hoặc cần kiểm tra:

- Ngày trả cố định 30/09/2026
- Chưa kiểm tra tạo chứng từ cuối luồng, sửa đối tượng và phân bổ tiền

### Trả tiền nhà cung cấp theo hóa đơn

**Kết luận:** Gần đúng form; thiếu chiết khấu và sai ngày.

Đã có/đã thử:

- Phương thức/NCC/Nhân viên mua/Ngày trả/Lấy dữ liệu
- 11 cột công nợ đầu tiên
- Lấy dữ liệu hoạt động với NCC mẫu

Còn thiếu hoặc cần kiểm tra:

- Thiếu Tỷ lệ CK (%), Tiền chiết khấu, TK Chiết khấu
- Ngày cố định 29/09/2026
- Chưa kiểm tra số trả, chiết khấu và tạo phiếu cuối luồng

### Chi mua ngoài có hóa đơn

**Kết luận:** Có tương tác và tính thuế; chưa khớp trường và gộp hóa đơn.

Đã có/đã thử:

- Có 2 tab Hạch toán/Kê khai hóa đơn và hạch toán thuế
- Hạch toán đủ 7 cột
- Tiền chưa thuế 1.000.000 × 10% → tiền thuế 100.000 (đã thử)
- Ẩn hiện TK Nợ/TK Có hoạt động

Còn thiếu hoặc cần kiểm tra:

- Thiếu Người nhận
- Tab thuế thiếu Có hóa đơn và Nhóm HHDV mua vào; bố cục/cột khác MISA
- Hạch toán gộp nhiều hóa đơn chỉ giữ state checkbox, chưa được dùng trong tính toán/payload (đọc mã)
- Đính kèm chỉ giữ tên file, chưa kiểm tra 5MB hoặc kéo-thả (đọc mã)
- Ngày và số hóa đơn/MST mặc định là dữ liệu cố định

### Thao tác chứng từ và hàng loạt

**Kết luận:** Thiếu thanh và menu thao tác.

Đã có/đã thử:

- Chọn tất cả/đếm số đã chọn trên frontend

Còn thiếu hoặc cần kiểm tra:

- MISA menu từng dòng có Ghi sổ/Nhân bản/Xóa; frontend mới In/Xem
- MISA chọn 2 dòng hiện thanh Bỏ chọn/Ghi sổ/Bỏ ghi/Xóa; frontend không có các nút này
- Menu Thu/Chi MISA có Nhập từ Excel; frontend chưa có luồng nhập

### Tùy chỉnh cột Thu chi

**Kết luận:** Nút chỉ notify; thiếu toàn bộ drawer tương ứng.

Đã có/đã thử:

- Frontend có nút thiết lập cột

Còn thiếu hoặc cần kiểm tra:

- Chưa có form tìm cột/chọn hiển thị/sửa tên-độ rộng/sắp xếp/Lấy mẫu ngầm định/Cất
- Thiếu cột tùy chọn Mã đối tượng/Người nhận-Người nộp/Địa chỉ/Nhân viên/Ngày ghi sổ quỹ/Đã quyết toán/10 trường mở rộng/Người tạo-Ngày tạo-Người sửa-Ngày sửa

### Nhập Phiếu chi từ Excel

**Kết luận:** Chưa triển khai; đã đối chiếu bước đầu MISA.

Đã có/đã thử:

- Frontend có icon Xuất/Nhập

Còn thiếu hoặc cần kiểm tra:

- Chưa có trình 4 bước Chọn tệp/Ghép dữ liệu/Kiểm tra/Kết quả
- Thiếu chọn Sheet/Dòng tiêu đề/Tự ghép cột AVA
- Thiếu tải mẫu cơ bản/nâng cao và kiểm tra XLS/XLSX 20MB, tối đa 500 dòng chi tiết/chứng từ
- Chưa thực hiện bước 2–4 trên MISA vì cần tệp nhập, không nhập dữ liệu thật

## Tham số MISA cần bổ sung vào Báo cáo Tiền mặt

| Báo cáo | Tham số đọc trực tiếp |
| --- | --- |
| S03a1-DN / S03a2-DN | Kỳ, Từ ngày, Đến ngày, Tài khoản, Tài khoản ngân hàng (vô hiệu hóa khi TK 111), Cộng gộp bút toán giống nhau, Xóa điều kiện |
| Bảng kê số dư tiền theo ngày | Đến ngày; So sánh với N ngày trước |
| Dòng tiền | Kỳ, Từ ngày, Đến ngày |
| Sổ chi tiết quỹ tiền mặt | Kỳ, Từ/Đến ngày, chọn tài khoản trong bảng Số/Tên/Bậc; cộng gộp bút toán, cộng gộp theo chứng từ, thứ tự lập, thu trước chi trong ngày |

Thanh báo cáo MISA còn có Lưu báo cáo, Danh sách báo cáo đã lưu, chọn ngôn ngữ và Ẩn/hiện báo cáo. Dòng tiền của MISA cần mẫu riêng; không coi mẫu B03 hoặc bảng tổng hợp tháng hiện có là tương đương chỉ dựa vào tên.

## Phạm vi chưa xác nhận

- Chưa thử hoàn tất Cất/Cất và In, tạo phiếu từ thu/trả hóa đơn hoặc gửi/nhập dữ liệu trên MISA.
- Chưa kiểm tra mọi nhánh của 5 loại thu, 8 loại chi; đã đối chiếu trực tiếp loại thu 1/5, chi 1/8 và chi mua ngoài 3 cùng tab thuế.
- Chưa kiểm tra đầy đủ các picker thêm nhanh đối tượng/tài khoản/nhân viên, mẫu chứng từ, tham chiếu, AVA, bàn phím F3/F9 và mọi form con của chúng.
- Chưa xác nhận bản in trên giấy/PDF, tải Excel thực, lưu cấu hình qua lần tải lại, giới hạn tệp 5MB và thao tác kéo-thả bằng tệp kiểm tra.
- Trình nhập Excel chỉ đọc bước 1, bước 2–4 cần tệp; không nhập thử dữ liệu thật.
- Thứ tự Kiểm kê/Dự báo dòng tiền trên MISA thay đổi giữa các màn hình đã quan sát; không kết luận đây là lỗi mất tính năng.
- Chưa audit Tiền gửi trong lượt này: phạm vi yêu cầu mới tập trung Tiền mặt.

Điểm tiếp tục: ưu tiên sửa/đối chiếu các thiếu sót quan trọng nêu trên, sau đó kiểm tra các nhánh và component còn chưa xác nhận. Không có cơ sở đánh dấu toàn phân hệ Tiền mặt là hoàn tất.
