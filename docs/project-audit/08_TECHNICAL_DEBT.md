# 08. Nợ kỹ thuật

## Bảng vấn đề

| ID | Vấn đề | File/Module | Mức độ | Nguyên nhân | Giải pháp |
|---|---|---|---|---|---|
| TEC-01 | `FOR UPDATE cannot be applied to the nullable side of an outer join` | `accounts_receivable/receipt_voucher.py:296`, `accounts_payable/adjustment_voucher_services.py:171`, `allocation_services.py:220`, `payment_voucher_services.py`, `organization/structure_services.py:99` và 48 dòng ứng viên | Nghiêm trọng | Kết hợp `select_for_update` với `select_related` nullable. SQLite bỏ qua lệnh khóa nên có thể không lộ khi chạy local (suy luận) | Dùng `of=("self",)`, rà đủ 48 dòng |
| TEC-02 | Thiếu import `timezone` | `general-vouchers/opening-profit-loss/` | Cao | `NameError`, đã chứng minh | Thêm import và test route |
| TEC-03 | Trường `created_at` không tồn tại | `general-ledger/balance-aggregations/` | Cao | `FieldError`, đã chứng minh | Sửa ordering |
| TEC-04 | `UserAccount` không có `company_memberships` | 8 route `fixed-assets/.../default-allocation-period`, `setup-allocation-period`, `default-period`, `preview` | Cao | Tên quan hệ sai. Đã chứng minh với 2 route, 6 route còn lại cùng nhóm và cùng 500 | Dùng đúng related name |
| TEC-05 | File quá lớn | `fixed_assets/services.py` 24.317 dòng, `general_ledger/services.py` 21.160 dòng, `MisaLedgerWorkspace` 20,5 nghìn dòng | Trung bình | Tích lũy | Tách dần theo nghiệp vụ, kèm test |
| TEC-06 | Hai bộ tính BCTC | `general_ledger`, `reporting` | Cao | Phát triển song song | Hợp nhất |
| TEC-07 | Mỗi nhóm báo cáo tự viết hàm quyền riêng | 8 hàm `check_*_permission` ở `reporting/` | Cao | Không có lớp dùng chung | Một lớp quyền duy nhất |
| TEC-08 | File rác trong git | `cloudflared.exe`, `backend/requirements.zip`, `test1.docx`, `test2.docx`, zip mẫu, `test-results` | Thấp | Commit nhầm | Gỡ khỏi tracking theo quy trình an toàn |
| TEC-09 | `float()` trong code nghiệp vụ | 159 chỗ | Trung bình, chưa rà | Có thể chỉ phục vụ hiển thị | Rà phần liên quan tiền |
| TEC-10 | `on_delete=CASCADE` | 177 chỗ, so với 1.211 `PROTECT` | Trung bình, chưa rà | Có thể làm mất dữ liệu kế toán khi xóa cha | Rà model kế toán |
| TEC-11 | Nuốt ngoại lệ, âm thầm rơi về mặc định | Đánh số đề nghị xuất hóa đơn | Trung bình | `except` rộng | Báo lỗi rõ |
| TEC-12 | Lưu `created_at` kiểu naive | Cảnh báo `PaymentAllocation.created_at` khi seed | Thấp | Dữ liệu seed | Dùng datetime có múi giờ |
| TEC-13 | Git chưa gọn | 7 file TS chưa commit, 1 stash, nhánh `backup/tanh-wip-20261102`, `tanh` chậm hơn `main` 1 commit | Thấp | Đang làm dở | Commit sau khi audit, dọn nhánh |

## Cơ sở dữ liệu

| Hạng mục | Kết quả |
|---|---|
| Migration | `makemigrations --check` không có thay đổi |
| Ràng buộc | 439 Check/Unique, 1.211 `PROTECT` |
| Kiểu tiền | Không có `FloatField` trong model |
| Chỉ mục, hiệu năng truy vấn | Chưa đủ bằng chứng |
| Soát từng migration đã deploy | Chưa thực hiện |

## DevOps

| ID | Vấn đề | Mức độ | Bằng chứng | Đề xuất |
|---|---|---|---|---|
| OPS-01 | Không có sao lưu, khôi phục | Nghiêm trọng khi có dữ liệu thật | Không có script hay `pg_dump` trong repo. Có thể tồn tại trên máy chủ | Sao lưu hằng ngày, diễn tập khôi phục |
| OPS-02 | Không cấu hình `LOGGING`, không có giám sát lỗi | Cao | Không thấy trong `settings.py`, không có Sentry | Log có cấu trúc, cảnh báo lỗi |
| OPS-03 | Không có reverse proxy, TLS trong repo | Chưa đủ bằng chứng | Không có file nginx, caddy, traefik. Có thể cấu hình ngoài repo | Xác nhận với hạ tầng |
| OPS-04 | Frontend chạy `vite preview` | Trung bình | `npm run build && preview` | Dùng web server tĩnh ở production |
| OPS-05 | `SEED_DEMO_DATA` mặc định `True` | Cao nếu quên override | `compose.yaml:38`. `compose.prod.yaml` đặt `False` | Mặc định `False` |
| OPS-06 | CI deploy không chạy backend test | Cao | `.gitlab-ci.yml` có lint, compileall, build, deploy | Xem TST-01 |

Điểm đạt: có healthcheck, `compose.prod.yaml` buộc khai báo secret và bỏ mount mã nguồn, CI có bước kiểm tra health sau deploy.
