---
paths:
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
---

# Quy tắc React frontend

1. Ẩn nút theo quyền chỉ là trải nghiệm người dùng; backend vẫn phải chặn.
2. Gọi API qua lớp chung (`live-api.ts`, `misa-api-writes.ts`) để xử lý lỗi và token thống nhất.
3. Thao tác ghi (ghi sổ, duyệt, lưu báo cáo) phải chặn bấm/gọi lặp khi request đang chạy.
4. Không hiển thị một chức năng như đã hoàn thiện nếu backend chưa có endpoint thật (không dùng dữ liệu giả cho màn hình nghiệp vụ).
5. Chạy `npm run typecheck` sau khi sửa.
