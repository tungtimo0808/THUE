# Nguồn pháp lý cho audit

Agent **chỉ** được trích dẫn văn bản có trạng thái `ĐÃ XÁC MINH`. Văn bản `CHƯA XÁC MINH` là danh sách gợi ý để người phụ trách kế toán kiểm tra số hiệu, hiệu lực và văn bản sửa đổi; phát hiện dựa vào chúng phải ghi `NEEDS_HUMAN_REVIEW`.

Để xác minh: tải văn bản gốc từ Cơ sở dữ liệu quốc gia về văn bản pháp luật (vbpl.vn) hoặc Cổng thông tin Bộ Tài chính (mof.gov.vn), lưu vào thư mục này (`<số-hiệu>.pdf` hoặc trích điều khoản cần dùng thành `<số-hiệu>.md`), rồi đổi trạng thái và ghi ngày xác minh.

| Văn bản | Phạm vi dùng trong audit | Áp dụng | Trạng thái | Người/ngày xác minh |
|---|---|---|---|---|
| Luật Kế toán 88/2015/QH13 (và văn bản sửa đổi) | Chứng từ, sổ kế toán, sửa chữa sổ, lưu trữ | Mọi doanh nghiệp | CHƯA XÁC MINH | |
| Thông tư 99/2025/TT-BTC | Chế độ kế toán doanh nghiệp, hệ thống tài khoản, BCTC | Năm tài chính bắt đầu từ 01/01/2026 (cần xác minh) | CHƯA XÁC MINH | |
| Thông tư 200/2014/TT-BTC | Chế độ kế toán doanh nghiệp | Năm tài chính trước khi TT99 có hiệu lực | CHƯA XÁC MINH | |
| Thông tư 133/2016/TT-BTC | Chế độ kế toán doanh nghiệp nhỏ và vừa | Doanh nghiệp chọn chế độ TT133 | CHƯA XÁC MINH | |
| Văn bản về hóa đơn điện tử (Nghị định 123/2020/NĐ-CP và văn bản sửa đổi) | Hóa đơn, thời điểm lập hóa đơn | Mọi doanh nghiệp | CHƯA XÁC MINH | |
| Luật Thuế GTGT hiện hành và văn bản hướng dẫn | Thuế GTGT đầu vào/đầu ra, khấu trừ, tờ khai | Doanh nghiệp nộp thuế GTGT | CHƯA XÁC MINH | |
| Luật Thuế TNDN hiện hành và văn bản hướng dẫn | Chi phí được trừ, quyết toán TNDN | | CHƯA XÁC MINH | |
| Văn bản về khấu hao TSCĐ (Thông tư 45/2013/TT-BTC và văn bản sửa đổi) | Thời gian, phương pháp khấu hao | | CHƯA XÁC MINH | |

## Chế độ kế toán trong code
ERP chọn chế độ theo `AccountingPolicy.accounting_regime` (`backend/common_services/models.py`): `TT99`, `TT200`, `TT133`. Khi audit, đối chiếu theo chế độ của doanh nghiệp **và** năm tài chính của chứng từ — không áp quy định của TT99 cho năm tài chính trước ngày hiệu lực.

## Quy tắc không phải pháp lý
Các bất biến trong `../business-rules/invariants.md` là nguyên tắc kế toán và kiểm soát nội bộ chung (cân Nợ/Có, khóa kỳ, không sửa chứng từ đã ghi sổ…). Chúng dùng được mà không cần trích văn bản, nhưng không được trình bày như "vi phạm thông tư X".
