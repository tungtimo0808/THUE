# Sổ Việt — Frontend kế toán & thuế

React + TypeScript + Vite, React Router, Recharts, Lucide và font Be Vietnam Pro tự phục vụ. Backend Django hiện có được giữ nguyên. Lựa chọn SPA phù hợp với workspace nội bộ và backend REST đã có; chưa cần thêm máy chủ SSR.

## Chạy giao diện

Yêu cầu Node.js 22.12+ hoặc 24 LTS.

```powershell
cd C:\Users\Admin\LapTrinh\Thue\frontend
npm install
npm run dev
```

Mở http://127.0.0.1:5173. Giao diện mẫu chạy độc lập, không cần chạy Django. Nếu phát triển API, Vite đã cấu hình proxy `/api` tới `http://127.0.0.1:8000`.

## Đã triển khai

- Tổng quan: chỉ tiêu, biểu đồ dòng tiền, việc chờ duyệt, chứng từ gần đây.
- Khung điều hướng responsive, sidebar thu gọn, doanh nghiệp và kỳ kế toán trong URL.
- Tiền mặt, tiền gửi, mua hàng, bán hàng, hóa đơn và tổng hợp dùng chung bảng giao dịch, quy trình, phân tích.
- Tìm kiếm toàn cục bằng Ctrl+K; lọc loại/trạng thái; phân trang; chọn chứng từ xuất CSV.
- Form tạo nháp: đối tượng, ngày, diễn giải, thêm/sao chép/xóa dòng và tính tổng số tiền; lưu trên trình duyệt.
- Chi tiết chứng từ, lịch sử nghiệp vụ minh họa, chuyển nháp sang chờ duyệt thử.
- Thuế: tổng quan GTGT/TNCN/TNDN, danh mục hồ sơ, liên kết đến dữ liệu nguồn; không tính hoặc gửi thuế.
- Báo cáo tổng hợp chứng từ theo loại/trạng thái, xuất CSV có BOM cho tiếng Việt và chống công thức từ nội dung nhập.
- Bàn phím, focus, native dialog, bảng thay thế biểu đồ, reduced motion, trạng thái rỗng và lỗi lưu trữ.

## Giới hạn cần biết

**Đây là frontend tương tác với dữ liệu mẫu, chưa phải hệ thống kế toán production.**

- Dữ liệu minh họa tháng 4–9/2026 cho hai doanh nghiệp; chọn tháng 9, tháng 8 hoặc cả năm.
- Kho, tài sản, lương, danh mục, thiết lập mới có khung phân hệ và thông báo rõ phạm vi.
- Không xác thực hoặc phân quyền thật, không gọi API nghiệp vụ, không hạch toán, không phê duyệt thật, không ký/nộp thuế.
- Mua/bán/hóa đơn hiện minh họa chứng từ tổng tiền, chưa có bảng hàng hóa, công nợ hoặc liên kết hóa đơn thật.
- Dữ liệu nháp dùng localStorage với khóa `soviet-demo-documents-v1`; không dùng cho dữ liệu thật/nhạy cảm. Xóa khóa này để về dữ liệu mẫu ban đầu. Các doanh nghiệp chỉ được phân tách để minh họa, không phải ranh giới bảo mật.
- Trạng thái và timeline của dữ liệu mẫu chỉ để trình bày, không phải audit log.

## Kiểm tra

```powershell
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
```

Nếu đã cài Chrome và không tải được Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

Kiểm thử bao gồm thay đổi kỳ, bộ lọc/deep link, CSV, lưu nháp nhiều dòng, phân tách doanh nghiệp, lỗi lưu trữ, modal, thuế, layout điện thoại và kiểm tra accessibility bằng axe. Ảnh kiểm tra nằm trong `test-results/`.

`npm run format` để định dạng mã. `npm run build` tạo thư mục `dist/`; khi triển khai SPA cần cấu hình máy chủ trả `index.html` cho route frontend và giữ `/api` riêng.

## Skill thiết kế đã cài

Trong `C:/Users/Admin/.codex/skills/`:

- `frontend-design` — anthropics/skills, `skills/frontend-design`.
- `web-design-guidelines` — vercel-labs/agent-skills, `skills/web-design-guidelines`.
- `ui-ux-pro-max` — nextlevelbuilder/ui-ux-pro-max-skill, `.claude/skills/ui-ux-pro-max`.

Cài bằng script `skill-installer` của Codex; có thể dùng từ lượt trò chuyện tiếp theo. Trong lượt triển khai này đã đọc và áp dụng trực tiếp các SKILL.md.

Thiết kế và nguồn tham khảo: [DESIGN.md](./DESIGN.md).
