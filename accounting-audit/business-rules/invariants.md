# Bất biến nghiệp vụ cần kiểm tra

Nguyên tắc kế toán và kiểm soát nội bộ chung. Tài khoản cụ thể ghi ở đây là tài khoản thường gặp để định hướng tìm code; định khoản đúng cho từng chế độ phải lấy từ `general_ledger/account_templates.py` và văn bản đã xác minh trong `../regulations/README.md`.

## Sổ cái (general_ledger)
- GL-1 Mỗi bút toán ghi sổ cân Nợ = Có theo VND và theo từng nguyên tệ.
- GL-2 Không hạch toán vào tài khoản tổng hợp có tài khoản con.
- GL-3 Không ghi sổ, bỏ ghi, điều chỉnh vào kỳ đã khóa — qua mọi đường: API đơn lẻ, batch, import, tự động phân bổ, kết chuyển.
- GL-4 Bút toán đã ghi sổ chỉ thay đổi qua đảo/điều chỉnh/thay thế, có liên kết bút toán gốc và nhật ký.
- GL-5 Ghi sổ lặp lại (gửi lại request) không sinh bút toán thứ hai.
- GL-6 Số dư tài khoản (`AccountBalance`) = số dư đầu kỳ + phát sinh Nợ − phát sinh Có (theo tính chất tài khoản), và cập nhật dây chuyền cho các kỳ sau khi ghi lùi kỳ.
- GL-7 Kết chuyển cuối kỳ đưa số dư doanh thu/chi phí về 0 và không bị tính lại vào báo cáo kết quả kinh doanh.

## Bán hàng và phải thu
- SA-1 Hóa đơn bán hàng ghi nhận doanh thu, thuế GTGT đầu ra và phải thu (hoặc tiền) trong cùng một bút toán.
- SA-2 Xuất kho bán hàng sinh bút toán giá vốn và giảm tồn kho nhất quán (cùng số lượng, cùng giá trị).
- SA-3 Trả hàng bán, giảm giá, chiết khấu đảo đúng doanh thu, thuế, công nợ và (với trả hàng) nhập lại kho + đảo giá vốn.
- SA-4 Tổng công nợ chi tiết theo khách hàng = số dư tài khoản phải thu tổng hợp.
- SA-5 Thu tiền phân bổ cho hóa đơn không vượt số còn phải thu; hủy phiếu thu khôi phục số còn phải thu.

## Mua hàng và phải trả
- PU-1 Nhận hàng + hóa đơn NCC tăng kho/chi phí, thuế GTGT đầu vào và phải trả; không ghi nhận hai lần khi nhận hàng và hóa đơn là hai chứng từ.
- PU-2 Chi phí mua hàng phân bổ vào giá trị hàng nhập theo tiêu thức nhất quán.
- PU-3 Trả hàng mua đảo kho, thuế đầu vào và công nợ.
- PU-4 Tổng công nợ chi tiết theo NCC = số dư tài khoản phải trả tổng hợp.
- PU-5 Thanh toán, bù trừ công nợ không vượt số còn phải trả.

## Kho
- IN-1 Không xuất âm kho trừ khi có cấu hình cho phép rõ ràng.
- IN-2 Giá xuất kho theo phương pháp đã chọn (bình quân, FIFO…) và tính lại khi có chứng từ lùi ngày.
- IN-3 Giá trị tồn kho trên sổ kho = số dư các tài khoản hàng tồn kho.
- IN-4 Kiểm kê: chênh lệch sinh chứng từ điều chỉnh có duyệt.

## Quỹ và ngân hàng
- CB-1 Số dư quỹ tiền mặt không âm.
- CB-2 Chuyển tiền nội bộ ghi hai đầu cân nhau, không ghi nhận doanh thu/chi phí.
- CB-3 Đối chiếu sao kê: mỗi dòng sao kê khớp tối đa một chứng từ; số dư sổ = số dư sao kê sau khi trừ chênh lệch đã giải thích.
- CB-4 Chênh lệch tỷ giá khi đánh giá lại và khi thanh toán được ghi nhận.

## Tài sản cố định
- FA-1 Khấu hao bắt đầu/dừng đúng thời điểm, không vượt nguyên giá.
- FA-2 Thanh lý ghi giảm nguyên giá và hao mòn lũy kế, ghi nhận thu nhập/chi phí thanh lý.
- FA-3 Tài sản không khấu hao phải có lý do (`no_depreciation_reason`).

## Lương
- PY-1 Bảng lương hạch toán chi phí lương, các khoản trích theo lương và phải trả người lao động; hạch toán vào tài khoản chi tiết.
- PY-2 Chi trả lương giảm phải trả và tiền tương ứng.

## Thuế
- TX-1 Thuế GTGT đầu ra/đầu vào trên tờ khai khớp sổ chi tiết tài khoản thuế và bảng kê hóa đơn.
- TX-2 Hóa đơn bị hủy/điều chỉnh/thay thế phản ánh đúng trên tờ khai kỳ phát sinh.

## Báo cáo
- RP-1 Bảng cân đối kế toán cân: Tổng tài sản = Tổng nguồn vốn.
- RP-2 Chỉ tiêu báo cáo lấy đúng số dư/phát sinh tài khoản theo mẫu của chế độ kế toán đang áp dụng.
- RP-3 Lợi nhuận trên báo cáo kết quả = thay đổi lợi nhuận chưa phân phối trên bảng cân đối (khi không có phân phối).
- RP-4 Tiền cuối kỳ trên lưu chuyển tiền tệ = tiền và tương đương tiền trên bảng cân đối.
- RP-5 Báo cáo chỉ chứa dữ liệu của công ty được chọn.

## Kiểm soát
- CT-1 Người lập không tự duyệt chứng từ của mình khi quy trình yêu cầu duyệt.
- CT-2 Ghi sổ, bỏ ghi, khóa/mở kỳ, xóa đều có nhật ký: ai, khi nào, giá trị trước/sau, lý do.
- CT-3 Số chứng từ duy nhất trong phạm vi công ty, không trùng khi tạo đồng thời.
