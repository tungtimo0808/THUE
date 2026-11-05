# Sửa lỗi và xác minh — 05/11/2026

Nhánh `tanh`, chưa commit. Trạng thái từng phát hiện được cập nhật trong `findings.json`: **42/42 đã sửa** (5 có test hồi quy xác minh). Một số lựa chọn nghiệp vụ ở đợt 2 cần kế toán trưởng xác nhận.

## Cách sửa chính

| Nhóm | Phát hiện | Cách sửa |
|---|---|---|
| Bỏ ghi sổ | ACC-101, ACC-103, ACC-102, ACC-205 | Bỏ ghi sổ chứng từ bán, bán dịch vụ, trả hàng, giảm giá đi qua `general_ledger.services.unpost` (hoàn số dư kể cả kỳ sau, kiểm tra kỳ/ngày khóa, kết chuyển, phân bổ, giữ lịch sử). Bút toán được giữ ở DRAFT và dùng lại khi ghi sổ lại (`sales/posting_helpers.py: source_journal`). Chặn bỏ ghi chứng từ bán khi đã có trả hàng/giảm giá ghi sổ, hóa đơn phát hành, hoặc công nợ đã thu/cấn trừ/điều chỉnh. Ghi sổ lại tạo phiếu kho mới với số `-XK-2`, `-NK-2`. |
| Tiền ghi giảm hai lần | ACC-202, ACC-211 | Đối ứng của trả hàng/giảm giá luôn là tài khoản 131; hoàn tiền ghi Nợ đúng tài khoản 131 đã ghi Có, ghi tài khoản ngân hàng nếu có. |
| Giá vốn, tồn kho | ACC-105, ACC-106, ACC-107, ACC-108, ACC-204, ACC-209, ACC-112 | Phiếu xuất/nhập của chứng từ bán dùng kho của từng dòng và giá theo phương pháp tính giá (`inventory.services.VALUED_ISSUE_MODULES`); số lượng quy đổi về ĐVT cơ sở; giá vốn bút toán lấy từ giá trị phiếu xuất thực tế; dòng xuất được gắn ngược dòng bán và phiếu kho đã tự hạch toán bị loại khỏi chứng từ giá vốn. Trả hàng nhập lại theo giá vốn đã xuất thực tế; chặn khi chưa có giá vốn. Đảo phiếu kho theo ngày phiếu gốc và chặn kỳ kho đã đóng. |
| Ngoại tệ | ACC-104, ACC-317 | Quy đổi dòng bút toán sang đồng tiền hạch toán trước khi ghi sổ, giữ nguyên tệ và tỷ giá; tờ khai/sổ thuế GTGT quy đổi hóa đơn ngoại tệ. |
| Hóa đơn | ACC-301, ACC-302, ACC-303, ACC-306, ACC-313, ACC-315 | Mọi hóa đơn chưa hủy đều giữ chỗ số lượng; số đã xuất hóa đơn tính qua mọi đường (đơn hàng, chứng từ bán, hóa đơn thương mại); kiểm tra lại khi phát hành và chặn khi chứng từ đã gắn hóa đơn. Đơn giá/thuế suất khóa theo chứng từ bán đã ghi sổ. Hóa đơn thương mại điện tử không phát hành giả lập ở môi trường thật. Sửa lỗi 500 và chặn tự duyệt ở luồng duyệt hóa đơn. |
| Công nợ | ACC-109, ACC-307, ACC-308, ACC-310, ACC-311 | Tài khoản Nợ khớp hình thức thanh toán và giống nhau trên mọi dòng; không ghi nhận công nợ lần hai từ bút toán đã có công nợ; không bỏ ghi nhận công nợ của chứng từ bán; tuổi nợ bỏ khoản đã hủy; chặn dòng phân bổ âm. |
| Khác | ACC-110, ACC-113, ACC-114, ACC-203, ACC-207, ACC-208, ACC-212, ACC-213, ACC-215, ACC-216, ACC-304, ACC-312 | Làm tròn dòng doanh thu; chứng từ giá vốn dùng request nguồn và cần duyệt khi có workflow; cấp số không nuốt lỗi, số trùng trả 400; trả hàng trừ phần đã giảm giá; kiểm tra hóa đơn điều chỉnh khi liên kết; tài khoản giảm trừ mặc định 5212 (TT133: tài khoản doanh thu của dòng); kiểm tra lại nguồn khi sửa phiếu trả hàng; khóa dòng bán nguồn; hóa đơn chiết khấu trừ trả hàng/giảm giá và làm tròn theo loại tiền; trạng thái công nợ khi trả một phần; tổng hợp thuế cảnh báo chứng từ bán chưa có hóa đơn; liên kết chứng từ chỉ nhận dòng của đúng chứng từ. |

## Đợt 2 — các điểm trước đó chờ quyết định (đã sửa theo cách thông dụng, cần kế toán trưởng xác nhận)

| Mã | Đã chọn |
|---|---|
| ACC-206 | Phát hành hóa đơn chiết khấu tự hạch toán: Nợ 5211 (TT133: tài khoản doanh thu của dòng gốc), Nợ 33311 / Có 131, và giảm công nợ của chứng từ bán gốc. |
| ACC-314 | Chứng từ bán có xuất kho kèm được tính là một lần giao hàng: cập nhật số đã giao và trạng thái đơn; bỏ ghi sổ và trả hàng trừ lại. Không cho xuất vượt số còn phải giao. |
| ACC-111 | Giữ làm tròn thuế theo dòng (không đổi số liệu chứng từ cũ); khi gắn hóa đơn đối chiếu riêng tiền thuế. |
| ACC-318 | Số hóa đơn chính thức liên tục theo từng ký hiệu, tách khỏi số nội bộ. |
| ACC-303 | Hóa đơn không gắn chứng từ bán vẫn cho phép, nhưng hiện cảnh báo trên tổng hợp thuế và tờ khai. |
| ACC-207 | Không chặn ghi sổ; tổng hợp thuế và tờ khai cảnh báo trả hàng/giảm giá chưa có hóa đơn điều chỉnh. |
| ACC-212 | Trả hàng liên kết phiếu nhập có giá trị và chưa tự hạch toán thì đảo giá vốn theo giá trị phiếu đó. |

Giới hạn: ACC-213 (khóa dòng khi chạy đồng thời) chưa test được trên PostgreSQL vì máy dev không có PostgreSQL.

Ngoài phạm vi audit, đã sửa thêm:
- 5 test báo cáo hỏng sẵn từ code `main`: test dùng chữ ký `Movement` cũ và nhãn chữ ký in hoa cũ — đã cập nhật test theo code hiện tại.
- `bank_management/deposit_ledger.py`: sổ tiền gửi sắp xếp chứng từ cùng thời điểm tạo theo UUID ngẫu nhiên, làm số dư lũy kế từng dòng thay đổi giữa các lần xem — thêm số chứng từ làm tiêu chí phụ.

## Test

- Test hồi quy mới: `sales/test_goods_sale_uc_sal_03.py::test_07b_unpost_goes_through_ledger_and_repost_reissues_stock` (ACC-101, ACC-102); bổ sung kiểm tra sổ 111/131 vào `sales/test_sales_return_uc_sal_05.py::test_08_customer_refund_for_excess_or_paid_sale` (ACC-202).
- Sửa test cũ: `sales/test_sales_invoice_uc_sal_07.py::test_08_approval_workflow_lifecycle` trước đây để người lập tự duyệt hóa đơn; nay kiểm tra tự duyệt bị chặn và chỉ duyệt được khi workflow cho phép.
- `manage.py test sales tax_management accounts_receivable inventory general_ledger`: 479 test, OK.
- Kết quả toàn bộ backend: xem phần cuối báo cáo của phiên.

## Thay đổi hành vi cần biết

- Chứng từ bán/trả hàng/giảm giá: tài khoản đối ứng phải đúng nhóm (131 / 111 / 112); dữ liệu cũ nhập sai sẽ bị từ chối khi sửa hoặc ghi sổ lại.
- Phiếu trả hàng nhập kho bị chặn nếu chưa xác định được giá vốn đã xuất.
- Hóa đơn GTGT từ chứng từ bán không đổi được đơn giá/thuế suất.
- Bỏ ghi sổ giờ bị chặn trong các trường hợp sổ cái chặn (kỳ khóa, đã kết chuyển/phân bổ, kỳ sau đã đóng).
