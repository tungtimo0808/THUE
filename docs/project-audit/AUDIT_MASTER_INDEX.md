# Audit Thue ERP — Mục lục

- **Ngày audit:** 02/11/2026
- **Phạm vi code:** nhánh `tanh`, commit `4e2bf72` (cộng 7 file frontend sửa lỗi TS chưa commit). `origin/main` là `bf24dff`.
- **Loại nhiệm vụ:** AUDIT ONLY. Không sửa code nghiệp vụ, không commit, không push, không chạy seed trên database dùng hằng ngày.
- **Môi trường kiểm thử:** PostgreSQL 16 trong Docker. Kiểm thử ghi dữ liệu chỉ chạy trên database test riêng `test_thue_audit`, tự tạo và tự hủy sau mỗi lượt.

## Danh sách tài liệu

| File | Nội dung |
|---|---|
| [01_EXECUTIVE_SUMMARY.md](01_EXECUTIVE_SUMMARY.md) | Tổng quan, điểm số, rủi ro lớn nhất, kết luận |
| [02_MODULE_AUDIT.md](02_MODULE_AUDIT.md) | Đánh giá từng module và kiến trúc |
| [03_ACCOUNTING_AUDIT.md](03_ACCOUNTING_AUDIT.md) | Kiểm tra nghiệp vụ kế toán |
| [04_REPORT_AUDIT.md](04_REPORT_AUDIT.md) | Kiểm tra từng báo cáo |
| [05_SECURITY_AUDIT.md](05_SECURITY_AUDIT.md) | Bảo mật, phân quyền, cách ly dữ liệu |
| [06_UI_UX_AUDIT.md](06_UI_UX_AUDIT.md) | Giao diện và trải nghiệm |
| [07_MISSING_FEATURES.md](07_MISSING_FEATURES.md) | Chức năng thiếu theo vai trò người dùng |
| [08_TECHNICAL_DEBT.md](08_TECHNICAL_DEBT.md) | Nợ kỹ thuật, DevOps, cơ sở dữ liệu |
| [09_TESTING_AUDIT.md](09_TESTING_AUDIT.md) | Kết quả và độ phủ kiểm thử |
| [10_IMPROVEMENT_ROADMAP.md](10_IMPROVEMENT_ROADMAP.md) | Lộ trình P0–P4 và tiêu chí nghiệm thu |
| [11_FIX_PLAN.md](11_FIX_PLAN.md) | Kế hoạch sửa chi tiết theo từng merge request |
| [12_STATUS_AFTER_FIXES.md](12_STATUS_AFTER_FIXES.md) | **Trạng thái sau khi sửa, đọc trước** |
| [AUDIT_FINDINGS.csv](AUDIT_FINDINGS.csv) | Toàn bộ phát hiện dạng bảng |

## Cách đọc mức bằng chứng

| Mức | Ý nghĩa |
|---|---|
| **Đã chứng minh** | Có kết quả chạy thật trên PostgreSQL hoặc kết quả công cụ |
| **Đọc code** | Thấy trực tiếp trong mã nguồn, chưa chạy tình huống thực tế |
| **Suy luận** | Hợp lý từ bằng chứng khác, cần xác nhận |
| **Chưa đủ bằng chứng** | Không đủ căn cứ để kết luận đạt hay không đạt |

## Những phần chưa đủ bằng chứng

1. **Luồng ghi sổ thật từ chứng từ đến sổ cái.** Số liệu đối chiếu khớp trên dữ liệu seed, nhưng seed ghi trực tiếp vào bảng. Kết quả đó không chứng minh bộ máy hạch toán đúng.
2. **Thuế.** Dữ liệu thử không có `VatLedgerEntry`. Chưa đối chiếu tờ khai GTGT, TNDN, TNCN với số liệu gốc. Công thức thuế chưa được kế toán xác nhận.
3. **15 báo cáo thuế.** Chưa chạy từng mã. Tôi chỉ đọc code quyền và chạy `reports/tax/forms`.
4. **Giá vốn FIFO và bình quân, tỷ giá, kết chuyển cuối kỳ, khóa sổ, đảo bút toán.** Chưa chạy kịch bản độc lập.
5. **Lương và giá thành.** Chưa kiểm tra công thức. Hai module rất nhỏ nhưng chưa có kiểm chứng số liệu.
6. **Báo cáo công nợ, tiền, kho, tài sản với người dùng thường.** 95 báo cáo bị từ chối với `COMPANY_ADMIN`, nên chưa xác minh được nội dung ở vai trò này.
7. **Màn hình.** Chỉ duyệt tay nhóm Ngân hàng và báo cáo tài chính. Phần còn lại đánh giá qua code và API. Bộ Playwright chưa chạy.
8. **Sự cố đồng thời, hiệu năng, tải lớn, sao lưu và khôi phục.** Chưa kiểm thử.
9. **Môi trường test và production.** Chưa truy cập máy chủ, biến môi trường thật, TLS hay reverse proxy.
10. **Nút không có hành động và 252 thông báo thành công giả tiềm năng.** Số lượng lấy từ tìm kiếm văn bản, chưa rà từng nút.
11. **Tuân thủ TT99/2025, TT133.** Đã so với bộ mẫu MISA trong file zip, không phải đối chiếu pháp lý. Kế toán trưởng cần xác nhận.
12. **Tài khoản `tanh` có phải superuser hay không.** Hai lần kiểm tra cho kết quả mâu thuẫn, chưa kết luận.
