---
name: audit-verify
description: Audit lại sau khi sửa lỗi - chạy lại test tái hiện trong backend/audit_repro/ và đọc lại code cho các phát hiện trong một lần audit trước, cập nhật trạng thái Fixed/Verified/Still open. Dùng khi người dùng gõ /audit-verify hoặc hỏi các lỗi audit đã sửa xong chưa. Tham số - mã phát hiện (vd. ACC-003) hoặc thư mục lần chạy.
---

# Audit Verify

1. Chọn lần chạy: tham số nếu có, ngược lại lần mới nhất trong `ERP_AUDIT/runs/`. Đọc `findings.json`.
2. Lọc phát hiện cần xác minh: mã được truyền vào, hoặc mọi phát hiện có `status` khác `VERIFIED`.
3. Với mỗi phát hiện:
   - Có test `backend/audit_repro/test_<mã>.py`: chạy `..\venv\Scripts\python.exe manage.py test audit_repro.test_<mã> --noinput` trong `backend/`. PASS → đã sửa.
   - Không có test: đọc lại code ở vị trí ghi trong phát hiện (vị trí có thể đã dịch dòng; tìm theo tên hàm) và kiểm tra `verification` của phát hiện.
   - Chạy thêm test có sẵn của app bị sửa (`manage.py test <app>`) để bắt hồi quy.
4. Cập nhật `status` trong `findings.json` (`FIXED` khi code đã đổi, `VERIFIED` khi có test PASS, `OPEN` nếu chưa) và ghi `ERP_AUDIT/runs/<lần chạy>/10_VERIFICATION_<yyyy-mm-dd>.md`: mã, kết quả, lệnh, test hồi quy hỏng (nếu có).
5. Báo lại: bao nhiêu đã xác minh, bao nhiêu còn mở, hồi quy mới.

Không sửa code ứng dụng trong skill này.
