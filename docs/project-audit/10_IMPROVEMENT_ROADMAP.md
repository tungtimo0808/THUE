# 10. Lộ trình hoàn thiện

Lộ trình chia 5 giai đoạn. Không ước lượng thời gian vì chưa biết năng lực đội ngũ. Phải xong giai đoạn trước mới chuyển giai đoạn sau, trừ khi ghi khác.

## P0 — Lỗi nghiêm trọng

Điều kiện để thử nghiệm với bất kỳ dữ liệu thật nào.

| ID | Công việc | Tiêu chí nghiệm thu | Phụ thuộc |
|---|---|---|---|
| P0-1 | Tạo một lớp kiểm tra công ty và quyền dùng chung, áp cho toàn bộ `reporting/` | Người ngoài nhận 403 ở mọi route báo cáo. Có test tự động theo ma trận 5 vai trò trong [05_SECURITY_AUDIT.md](05_SECURITY_AUDIT.md) | Không |
| P0-2 | Xóa mọi nguồn quyền từ `X-User-Permissions`, `X-Sales-Permissions`, `X-Tax-Permissions`, `X-Allowed-Companies`, `mock_permissions` | Tìm trong code không còn. Gửi header không đổi kết quả | P0-1 |
| P0-3 | Bỏ fallback `Company.objects.first()` và `DEFAULT-COMPANY` | Thiếu hoặc sai `company_id` trả 400 hoặc 403 | P0-1 |
| P0-4 | Sửa toàn bộ `select_for_update` lỗi | 35 test nhóm này đạt trên PostgreSQL. Rà hết 48 dòng | Không |
| P0-5 | Sửa 11 route trả 500 | Không route nào trả 500 trong lượt quét API | Không |
| P0-6 | Sửa B02 TK 642 | `test_uc_gl_13` đạt. Kế toán xác nhận một bộ số tính tay | Không |
| P0-7 | Thêm backend test PostgreSQL vào CI, chặn merge | Pipeline đỏ không merge được vào `main` | Không |
| P0-8 | Xử lý hết 61 test không đạt | 0 failure, 0 error. Mỗi test sửa có giải thích test sai hay nghiệp vụ sai | P0-4, P0-6 |
| P0-9 | Sao lưu và diễn tập khôi phục PostgreSQL | Khôi phục thành công từ bản sao lưu trên máy khác, có biên bản | Không |
| P0-10 | Rút ngắn JWT, tắt docs ở production, đổi mật khẩu mẫu | Access tối đa 15 phút. `check --deploy` với cấu hình production không còn cảnh báo bảo mật chưa được chấp nhận | Không |

## P1 — Cốt lõi còn thiếu

Điều kiện để triển khai cho khách hàng.

| ID | Công việc | Tiêu chí nghiệm thu | Phụ thuộc |
|---|---|---|---|
| P1-1 | Bộ dữ liệu vàng từ chứng từ đến BCTC | Mua, bán, thu, chi, khấu hao, lương, thuế, kết chuyển chạy qua API thật. Số khớp bảng tính tay được kế toán ký | P0 |
| P1-2 | Kiểm chứng giá vốn, thuế GTGT, khóa sổ, đảo bút toán | Mỗi nghiệp vụ có kịch bản đạt, ghi lùi vào kỳ khóa bị từ chối ở mọi loại chứng từ | P1-1 |
| P1-3 | Hợp nhất hai bộ tính BCTC | Chỉ còn một nguồn tính | P0-6 |
| P1-4 | Làm thật hoặc ẩn 47 báo cáo chưa gọi API | Không còn số mẫu trên màn hình | P0-1 |
| P1-5 | Kiểm tra từng báo cáo bán hàng, giải thích 30 báo cáo 328 dòng | Mỗi báo cáo đúng cột và cách tổng hợp đã mô tả | P0-1 |
| P1-6 | Đối chiếu 95 báo cáo công nợ, tiền, kho, tài sản và 15 báo cáo thuế | Mỗi báo cáo có biên bản đối chiếu | P0-1, P1-1 |
| P1-7 | Hoàn thiện B09 và sai khác mẫu | Kế toán trưởng xác nhận | P1-3 |
| P1-8 | Kết nối hóa đơn điện tử | Phát hành và tra cứu được với một nhà cung cấp trong môi trường thử | P0 |
| P1-9 | Email thật, nhập số dư đầu kỳ, log và cảnh báo lỗi | Có nghiệm thu từng mục | P0 |
| P1-10 | Thay thông báo thành công giả | Không còn thông báo thành công khi chưa gọi server | Không |

## P2 — Hoàn thiện

| ID | Công việc | Tiêu chí nghiệm thu | Phụ thuộc |
|---|---|---|---|
| P2-1 | Lương đầy đủ | Bảng lương mẫu khớp tính tay, sinh đúng bút toán | P1-1 |
| P2-2 | Giá thành | Kịch bản sản xuất mẫu khớp tính tay | P1-2 |
| P2-3 | T-VAN, kết nối ngân hàng | Chạy được với môi trường thử của nhà cung cấp | P1 |
| P2-4 | Menu theo quyền, hạn chế dữ liệu theo chi nhánh | Kiểm thử theo từng vai trò | P0-1 |
| P2-5 | Chạy Playwright smoke trong CI trên staging | Pipeline báo kết quả | P0-7 |
| P2-6 | Kiểm tra sức khỏe sổ sách trước khóa kỳ | Cảnh báo được các lệch đã tạo có chủ ý | P1-1 |

## P3 — Nâng cấp

| ID | Công việc | Tiêu chí nghiệm thu | Phụ thuộc |
|---|---|---|---|
| P3-1 | Tách các file `services.py` và workspace lớn | Không file nào quá ngưỡng đội thống nhất, test giữ nguyên | P0-8 |
| P3-2 | Hiệu năng, chỉ mục, hàng đợi tác vụ | Có mục tiêu tải và kết quả đo | P1 |
| P3-3 | Dọn git và hằng số mẫu | Không còn file rác tracked | Không |
| P3-4 | Chạy frontend bằng web server tĩnh, HTTPS chuẩn | Đạt khi kiểm tra cấu hình production | Không |

## P4 — AI

Chỉ làm sau khi số liệu đã đáng tin. AI đề xuất, người dùng duyệt, không tự ghi sổ.

| ID | Công việc | Tiêu chí nghiệm thu | Phụ thuộc |
|---|---|---|---|
| P4-1 | Đọc hóa đơn và gợi ý tài khoản | Đạt độ chính xác đã thống nhất trên bộ mẫu thật, có bước duyệt | P1 |
| P4-2 | Trợ lý hỏi đáp số liệu | Câu trả lời có dẫn nguồn và tôn trọng phân quyền | P0-1, P1 |
| P4-3 | Phát hiện bất thường | Bắt được các bất thường đã cài sẵn, tỷ lệ báo nhầm chấp nhận được | P1-1 |
