# 02. Kiểm tra module

## Kiến trúc

| Hạng mục | Nhận xét |
|---|---|
| Backend | Django/DRF chia theo ứng dụng nghiệp vụ. Ranh giới rõ, nhưng logic gom vào các file rất lớn |
| Frontend | React/TS, mỗi màn hình nghiệp vụ một workspace lớn |
| Database | PostgreSQL 16. 439 ràng buộc Check/Unique, không dùng `FloatField` trong model |
| Hạ tầng | Docker Compose gồm postgres, backend (gunicorn), worker, frontend. `compose.prod.yaml` có kiểm tra biến bắt buộc |
| Tác vụ nền | Một lệnh worker `run_catalog_worker`. Không có Celery hay Redis |
| Tích hợp ngoài | Chỉ có một lời gọi HTTP ra ngoài: trợ lý AI ở `common_services/services.py`, tắt khi chưa cấu hình URL. Không có lời gọi tới hóa đơn điện tử, T-VAN, ngân hàng |

## Đánh giá module

Trạng thái: **Khá** = có nghiệp vụ và test, còn lỗi cục bộ. **Một phần** = có khung, còn thiếu hoặc lỗi lớn. **Tối thiểu** = quá nhỏ so với phạm vi nghiệp vụ. **Lỗi chặn** = lỗi ngăn chạy thật.

Cột Quy mô ghi: dòng code / test / model.

| Module | Quy mô | Nghiệp vụ | Trạng thái | Điểm | Vấn đề |
|---|---|---|---:|---:|---|
| `accounts_receivable` | 9.650 / 147 / 37 | Công nợ phải thu, phiếu thu, phân bổ, bù trừ | Lỗi chặn | 45 | Phiếu thu và phân bổ lỗi `FOR UPDATE` trên PostgreSQL |
| `accounts_payable` | 8.405 / 113 / 34 | Công nợ phải trả, phiếu chi, điều chỉnh | Lỗi chặn | 45 | Phiếu chi, phân bổ, điều chỉnh cùng lỗi |
| `organization` | 2.071 / 42 / 15 | Công ty, chi nhánh, cơ cấu | Lỗi chặn | 45 | `structure_services.py:99` làm cơ cấu tổ chức trả 500 |
| `general_ledger` | 31.718 / 95 / 57 | Sổ cái, bút toán, kỳ kế toán, báo cáo | Khá | 60 | B02 sai TK 642, 2 route 500, `services.py` 21.160 dòng |
| `fixed_assets` | 27.699 / 71 / 25 | TSCĐ, CCDC, khấu hao, phân bổ | Một phần | 55 | 8 route 500, `services.py` 24.317 dòng |
| `sales` | 20.344 / 188 / 56 | Đơn hàng, bán hàng, hóa đơn | Khá | 65 | Lỗi đánh số đề nghị xuất hóa đơn, hóa đơn điện tử chưa kết nối thật |
| `purchases` | 12.364 / 157 / 40 | Đơn mua, nhận hàng, trả hàng | Khá | 65 | Chưa chạy kịch bản ghi sổ độc lập |
| `inventory` | 3.284 / 20 / 19 | Kho, tồn, giá xuất | Một phần | 50 | Rất ít test so với độ quan trọng, chưa kiểm chứng FIFO và bình quân |
| `bank_management` | 2.675 / 21 / 18 | Tài khoản ngân hàng, giao dịch | Một phần | 50 | Không kết nối ngân hàng, một số báo cáo chưa có API |
| `cash_management` | 687 / 5 / 14 | Quỹ tiền mặt | Tối thiểu | 45 | 5 test, 687 dòng |
| `tax_management` | 3.599 / 21 / 30 | Thuế, tờ khai, nộp thuế | Một phần | 45 | Dữ liệu thuế chưa kiểm chứng, không có T-VAN thật |
| `payroll` | 536 / 5 / 6 | Bảng lương, chấm công | Tối thiểu | 30 | 536 dòng, chưa xác minh công thức BHXH và TNCN |
| `costing` | 530 / 3 / 4 | Giá thành | Tối thiểu | 30 | 3 test |
| `reporting` | 55.030 / 126 / 73 | Báo cáo, dashboard, xuất file | Lỗi chặn | 40 | Lỗ hổng phân quyền, 95 báo cáo chặn người dùng hợp lệ |
| `iam` | 6.646 / 70 / 37 | Người dùng, vai trò, quyền | Khá | 60 | Mô hình tốt, nhưng `reporting` không dùng |
| `master_data` | 9.524 / 137 / 38 | Danh mục | Khá | 70 | Đổi được tên tài khoản và đối tượng đã phát sinh |
| `common_services` | 12.409 / 107 / 48 | Thông báo, phê duyệt, tiện ích | Khá | 60 | Từ chối yêu cầu tham gia không kiểm tra quyền riêng |
| `approval_workflows` | 2.153 / 20 / 9 | Quy trình duyệt | Khá | 60 | Chưa rà từng luồng |
| `audit_log` | 1.021 / 19 / 9 | Nhật ký thao tác | Khá | 65 | Chưa kiểm tra chống sửa log |

## Trùng lặp lớn cần xử lý

Có hai bộ tính báo cáo tài chính riêng ở `general_ledger` và `reporting`. Khi hai bên khác công thức, cùng một báo cáo có thể ra hai số. Điều này chưa kiểm chứng trên số liệu.
