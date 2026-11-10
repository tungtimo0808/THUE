# Rà soát UI/UX ngày 10/11/2026

## Giảm màn hình trung gian và thống kê lặp lại

- Trang Thông báo bỏ dải thống kê; số lượng nằm trên tab, nội dung bắt đầu bằng bộ lọc và danh sách.
- Tiền mặt, tiền gửi, mua hàng, bán hàng và tổng hợp mở vào danh sách chứng từ; kho mở Nhập kho; tài sản và công cụ mở sổ theo dõi; tiền lương mở Chấm công; ngân sách mở Kế hoạch; bảo hiểm mở Hồ sơ; giá thành mở Sản xuất liên tục – Giản đơn.
- Các tab Quy trình và Biểu đồ chuyển xuống cuối; đường dẫn truy cập trực tiếp và icon quy trình vẫn hoạt động.
- Các màn hình nhập/xuất kho, tài sản, công cụ, tiền lương và một số danh sách bán hàng mở bảng trực tiếp thay vì trang giới thiệu.
- Quản trị doanh nghiệp mở Nhân sự & Phân quyền; bỏ hai nhóm KPI lặp lại, giữ hồ sơ và cấu hình ở các tab riêng.
- Tổng quan vẫn là dashboard tài chính chính. Báo cáo, phân tích và tổng số gắn với nghiệp vụ vẫn có thể truy cập khi cần.
- Kiểm chứng sau thay đổi: build và TypeScript đạt; 85/85 kiểm thử đạt, gồm 12 màn hình mặc định mới, thông báo/quản trị, các thao tác báo cáo và bố cục quy trình ở 5 chiều rộng.

## Các thay đổi đã triển khai

- Giữ Roboto và màu xanh–trắng; giảm gradient, bóng đổ và khung trang trí. Giữ các icon minh họa nghiệp vụ cũ.
- Thông báo dùng danh sách gọn, có trạng thái tải, rỗng, lỗi và thử lại; không tạo cảnh báo tài chính hay thời hạn thuế từ dữ liệu mẫu.
- Đọc tất cả chỉ đổi trạng thái khi API thành công. Mở chứng từ qua API kiểm tra quyền, giữ tham số chứng từ và sửa đường dẫn quyết toán cũ.
- Thông báo kết quả chuyển sang dạng nhỏ, không chặn thao tác. Lỗi không tự biến thành thông báo thành công.
- Bổ sung xuất bảng Excel và chuẩn bị bản in thực; nút lỗi có phản hồi cụ thể.
- Lưu và mở lại bản chụp bảng báo cáo theo người dùng và công ty trong trình duyệt. Giới hạn 20 bản; có xuất, in và xóa.
- Bổ sung thao tác lưu/xem bản đã lưu cho màn hình báo cáo lấy dữ liệu API.
- Nối lại một số nút làm mới dữ liệu và lối tắt đối chiếu/chứng từ sổ cái.
- Bỏ banner giới thiệu tích hợp tiền lương. Máy chấm công chưa kết nối và bốn nút XML cũ chưa tích hợp được vô hiệu hóa và ghi rõ lý do.

## Phạm vi kiểm tra

Quét tĩnh các tệp TSX cấp đầu trong `frontend/src` phát hiện 693 callback chỉ gọi hàm hiển thị thông báo với chuỗi cố định. Đây là danh sách cần phân loại, **không phải 693 nút hỏng**: có cả hướng dẫn và kiểm tra điều kiện hợp lệ.

Trong nhóm này đã sửa 69 callback in/xuất bảng và 72 callback khác: 61 lưu/mở báo cáo, 4 làm mới, 3 xuất bảng, 4 đánh dấu XML chưa tích hợp. Số lượng phản ánh thay đổi mã nguồn; không đồng nghĩa đã bấm từng nút trên trình duyệt. Một số thành phần báo cáo cũ hiện được thay thế bằng màn hình báo cáo API.

Danh mục chi tiết: `UI_CONTROL_AUDIT_2026-11-10.csv`. Số dòng là vị trí khi quét ban đầu, có thể lệch sau chỉnh sửa. Mục `review` cần đọc ngữ cảnh và kiểm tra tiếp.

Kiểm thử trình duyệt bao gồm bố cục 11 màn hình ở 5 kích thước, thao tác điều hướng nghiệp vụ, thông báo ở desktop/mobile, trạng thái lỗi API, bộ lọc và bàn phím, xuất tệp XLSX có đọc lại nội dung, lưu/mở/xuất bản chụp báo cáo, chuẩn bị bản in và trạng thái máy chấm công chưa kết nối. Dữ liệu thông báo trong các ca này là fixture có kiểm soát để kiểm tra các trường hợp lỗi/rỗng; không phải thông báo được thêm vào hệ thống thật.

Kết quả cuối: 72/72 kiểm thử Playwright đạt; TypeScript và build đạt. Quét trình duyệt 51 đường dẫn ở kích thước 1440×1000 không phát hiện tràn ngang, lỗi JavaScript cấp trang hoặc icon minh họa bị ẩn. Kiểm tra này không xác nhận mọi thao tác nghiệp vụ trên 51 màn hình.

## Giới hạn và việc còn lại

- Chưa xác nhận từng nút của toàn bộ hệ thống. Các nút hướng dẫn, gửi mail, thiết lập chữ ký, nhập liệu và tích hợp ngoài còn cần kiểm tra theo từng quy trình, quyền và dữ liệu thật.
- Bản báo cáo đã lưu nằm trên trình duyệt hiện tại, không đồng bộ máy khác hoặc lưu trên máy chủ.
- Xuất bảng dùng văn bản đang hiển thị để giữ nguyên mã, ngày và định dạng tiền Việt Nam; chưa cam kết tất cả ô số là kiểu số phục vụ tính toán Excel.
- Các tích hợp XML, thiết bị và dịch vụ ngoài cần hợp đồng API/cấu hình thực; không tạo dữ liệu tài chính hay xác nhận giao dịch giả để thay thế.
- Một số màn hình còn lớn về kích thước bundle; build thành công không đồng nghĩa đã tối ưu xong thời gian tải trên mạng chậm. Nên đo trên thiết bị thật trước khi tách tiếp các màn hình lớn.

## Lượt 2 (10/11/2026) — hệ màu, tương phản, phản hồi

Rà soát tĩnh (máy thực hiện không có Node nên **chưa chạy typecheck, build hay Playwright** cho lượt này). Bản sao lưu `src/` trước khi sửa nằm ở scratchpad của phiên làm việc.

Đã sửa:

- **Splash** (`index.html`): dùng `var(--brand)` trước khi CSS nạp nên ô logo chữ trắng và thanh tải bị trong suốt. Đổi sang mã màu cố định, thêm `role="status"`, tôn trọng `prefers-reduced-motion`; `theme-color` khớp brand.
- **Token tập trung** trong `index.css`: brand, trạng thái (success/warning/danger), bảng, focus. `--brand` trước đây chỉ khai báo ở `ui-consistency.css` (nạp sau).
- **Focus bàn phím**: viền cũ rgba 35% gần như vô hình; khu admin tắt hẳn outline của nút/liên kết. Nay viền 2px màu brand cho mọi phần tử tương tác.
- Đã thử chuyển các màu xanh lá/olive sang brand xanh dương, sau đó **hoàn tác theo yêu cầu**: giữ nguyên tông xanh lá cho bảng, dòng chọn, dropdown và chip.
- `.erp3-warn` tô cảnh báo bằng xanh lá → màu cảnh báo.
- **Tương phản chữ**: 332 chỗ chữ `#94a3b8` trên nền trắng ở màn hình báo cáo/modal → `#64748b`. 43 cỡ chữ < 10px (ngoài bản in) → 10px; `.status`, `td small` → 11px.
- **Phản hồi**: thêm `showNotice()` / `showPendingFeature()`; thay toàn bộ 28 `alert()` chặn màn hình bằng toast. Hai chỗ trình bày kết quả giả được sửa cho trung thực: nút trợ lý báo "Đã kiểm tra hạch toán hợp lệ!" khi không kiểm tra gì; nút ghi chú báo "Đã thêm ghi chú" khi không lưu. Bốn nút chưa có chức năng nay ghi rõ "chưa tích hợp".
- `DESIGN.md` cập nhật theo hệ thiết kế thực tế (trước đó mô tả màu rêu/kem đào, font Be Vietnam Pro, "chưa tích hợp API").

Việc còn lại, theo thứ tự ưu tiên:

1. Chạy `npm run typecheck`, `npm run build`, `npm run test:e2e` cho các thay đổi trên; chụp lại màn hình bảng modal và báo cáo để xác nhận màu header mới.
2. **968** phần tử `div/span/td/tr/img` có `onClick` nhưng không có `role`/`tabIndex` (98 tệp; nhiều nhất `MisaCostWorkspace`, `MisaLedgerWorkspace`, `MisaToolsWorkspace`) — không dùng được bằng bàn phím. Cần sửa thủ công theo ngữ cảnh (đổi sang `<button>` hoặc thêm role + xử lý Enter/Space).
3. 54 `confirm()`/`prompt()` trình duyệt: cần hộp thoại xác nhận dùng chung (async) để thay.
4. ~30.800 inline style và 685 mã màu khác nhau: chuyển dần sang class + token khi chạm vào từng màn hình; 427 `!important` trong CSS là dấu hiệu các lớp ghi đè chồng chéo (`index.css` có nhiều selector dựa trên `style*=` để vá inline style).
5. Chữ `#94a3b8` còn trong các workspace lớn và CSS (chưa đổi vì có vùng nền tối như sidebar — cần kiểm tra trực quan).
