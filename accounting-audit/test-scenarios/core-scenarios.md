# Tình huống kiểm thử cơ sở

`qa-auditor` viết test cho các tình huống chưa có test tương đương trong repo, đặt ở `backend/audit_repro/test_<mã>.py`. Cột "Bất biến" trỏ tới `../business-rules/invariants.md`.

| Mã | Tình huống | Kết quả mong đợi | Bất biến |
|---|---|---|---|
| ACC-T01 | Ghi sổ một chứng từ hợp lệ | Một bút toán, cân Nợ/Có, số dư tài khoản cập nhật | GL-1, GL-6 |
| ACC-T02 | Gọi API ghi sổ hai lần cho cùng chứng từ (tuần tự và đồng thời) | Đúng một bút toán; lần hai báo lỗi hoặc trả kết quả cũ | GL-5 |
| ACC-T03 | Sửa trực tiếp chứng từ đã ghi sổ qua API PATCH/PUT | Bị từ chối; chỉ cho điều chỉnh/đảo | GL-4 |
| ACC-T04 | Hủy chứng từ nguồn đã ghi sổ (bán hàng, mua hàng, thu/chi) | Bút toán bị đảo hoặc chặn hủy; sổ chi tiết khôi phục | GL-4, SA-3, PU-3 |
| ACC-T05 | Xuất kho bán hàng | Tồn kho giảm, bút toán giá vốn cùng giá trị | SA-2, IN-3 |
| ACC-T06 | Nhập hàng có hóa đơn NCC, công nợ | Kho, thuế đầu vào, phải trả đồng bộ; không ghi trùng | PU-1, PU-4 |
| ACC-T07 | Thu tiền khách hàng, phân bổ hóa đơn, rồi hủy phiếu thu | Công nợ giảm rồi khôi phục đúng | SA-5, SA-4 |
| ACC-T08 | Ghi sổ, bỏ ghi, điều chỉnh vào kỳ đã khóa (API đơn, batch) | Bị từ chối ở mọi đường | GL-3 |
| ACC-T09 | Hai người cùng xuất một mặt hàng còn ít tồn (đồng thời) | Không xuất vượt tồn | IN-1 |
| ACC-T10 | Lập B01, B02, B03 sau bộ chứng từ mẫu | B01 cân; lợi nhuận B02 khớp B01; tiền cuối kỳ B03 khớp B01 | RP-1, RP-3, RP-4 |
| ACC-T11 | Ghi lùi ngày vào kỳ trước khi kỳ sau đã có số dư | Số dư các kỳ sau được cập nhật | GL-6, IN-2 |
| ACC-T12 | Người dùng công ty A gọi API báo cáo/chứng từ với `company_id` của công ty B | 403/404, không trả dữ liệu | RP-5 |
| ACC-T13 | Người lập tự duyệt chứng từ của mình | Bị từ chối khi quy trình yêu cầu duyệt | CT-1 |
| ACC-T14 | Hai request tạo chứng từ cùng lúc | Số chứng từ không trùng, không lỗi 500 | CT-3 |
| ACC-T15 | Trả hàng bán một phần | Doanh thu, thuế, công nợ, kho, giá vốn đảo đúng phần trả | SA-3 |

Giới hạn: test chạy trên SQLite (`test_db.sqlite3`). Tình huống đồng thời (T02, T09, T14) trên SQLite không chứng minh an toàn trên PostgreSQL; ghi rõ trong kết quả.
