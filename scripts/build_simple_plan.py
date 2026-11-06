import openpyxl
import sys
sys.stdout.reconfigure(encoding='utf-8')
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def build_simple_plan():
    wb = openpyxl.Workbook()
    default_sheet = wb.active
    
    font_family = "Segoe UI"
    
    title_font = Font(name=font_family, size=14, bold=True, color="1F497D")
    subtitle_font = Font(name=font_family, size=10, italic=True, color="595959")
    header_font = Font(name=font_family, size=10, bold=True, color="FFFFFF")
    cell_font = Font(name=font_family, size=9, color="000000")
    bold_cell_font = Font(name=font_family, size=9, bold=True, color="000000")
    kpi_num_font = Font(name=font_family, size=12, bold=True, color="1F497D")
    
    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    kpi_fill = PatternFill(start_color="F2F5F9", end_color="F2F5F9", fill_type="solid")
    done_fill = PatternFill(start_color="E8F8F5", end_color="E8F8F5", fill_type="solid")
    doing_fill = PatternFill(start_color="FEF9E7", end_color="FEF9E7", fill_type="solid")
    plan_fill = PatternFill(start_color="EBF5FB", end_color="EBF5FB", fill_type="solid")
    future_fill = PatternFill(start_color="F4ECF7", end_color="F4ECF7", fill_type="solid")
    
    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )
    
    align_center = Alignment(horizontal='center', vertical='center', wrap_text=True)
    align_left = Alignment(horizontal='left', vertical='center', wrap_text=True)

    # -------------------------------------------------------------
    # TAB 1: 01_LO_TRINH (Đơn giản - Xuyên suốt)
    # -------------------------------------------------------------
    ws1 = wb.create_sheet(title="01_LO_TRINH")
    ws1.views.sheetView[0].showGridLines = True
    
    ws1.merge_cells("A1:F1")
    ws1["A1"] = "KẾ HOẠCH LỘ TRÌNH DỰ ÁN KẾ TOÁN & THUẾ (SỔ VIỆT ERP)"
    ws1["A1"].font = title_font
    
    ws1.merge_cells("A2:F2")
    ws1["A2"] = "Từ ngày đầu (21/09/2026) → Về đích MVP (20/11/2026) → Kế hoạch tiếp theo sau 20/11 (Hết Q1/2027)"
    ws1["A2"].font = subtitle_font
    
    # 3 Cards
    cards = [
        ("HIỆN TẠI", "05/11/2026 (Xong ~85%)", "A4:B4", "A5:B5", "A4", "A5"),
        ("MỐC MVP", "20/11/2026 (Còn 15 ngày)", "C4:D4", "C5:D5", "C4", "C5"),
        ("SAU 20/11", "V1.1, V1.2 & V2.0 (Đến Q1/2027)", "E4:F4", "E5:F5", "E4", "E5")
    ]
    for lbl, val, m1, m2, c1, c2 in cards:
        ws1.merge_cells(m1); ws1.merge_cells(m2)
        ws1[c1] = lbl; ws1[c1].font = Font(name=font_family, size=9, bold=True, color="595959"); ws1[c1].alignment = align_center; ws1[c1].fill = kpi_fill
        ws1[c2] = val; ws1[c2].font = kpi_num_font; ws1[c2].alignment = align_center; ws1[c2].fill = kpi_fill
        
    for r in range(4, 6):
        for c in range(1, 7):
            ws1.cell(r, c).border = thin_border
            
    headers1 = ["Thời gian", "Giai đoạn", "Nội dung thực hiện", "Kết quả thực tế", "Ghi chú", "Trạng thái"]
    for c_idx, h_text in enumerate(headers1, start=1):
        c = ws1.cell(7, c_idx, h_text)
        c.font = header_font; c.fill = header_fill; c.alignment = align_center; c.border = thin_border
        
    rows1 = [
        ("21–27/09", "Tuần 1", "Khởi tạo mã nguồn & dựng giao diện mẫu Figma", "Có khung phần mềm Kế toán, Thuế, Kho", "9 commits", "ĐÃ XONG"),
        ("28/09–04/10", "Tuần 2", "Khảo sát nghiệp vụ kế toán & chuẩn hóa danh mục", "Chốt tài liệu yêu cầu chi tiết", "Khảo sát", "ĐÃ XONG"),
        ("05–11/10", "Tuần 3", "Làm mẫu in tiếng Việt & phân hệ Thu/Chi tiền mặt", "In được hợp đồng, nợ; nhập được phiếu thu/chi", "14 commits", "ĐÃ XONG"),
        ("12–18/10", "Tuần 4", "Nạp dữ liệu thật vào 13 phân hệ & làm Đăng nhập", "Hệ thống chạy trên dữ liệu thật, có tài khoản riêng", "9 commits", "ĐÃ XONG"),
        ("19–25/10", "Tuần 5", "Chuẩn hóa giao diện MISA, TT99, test cty ABC", "Chạy thông suốt luồng Mua hàng - Kho - Tiền", "23 commits", "ĐÃ XONG"),
        ("26/10–01/11", "Tuần 6", "Làm BCTC TT133, quản lý Đa công ty, Tài sản", "Trọn bộ BCTC TT133, đổi cty nhanh, mở trang cực nhanh", "45 commits", "ĐÃ XONG"),
        ("02–08/11", "Tuần 7 (Nay)", "Chế độ TT58, 21 vai trò kế toán, khóa menu, khớp số", "Sổ sách cân đối Nợ=Có, xuất file Excel/PDF đẹp", "23 commits", "ĐANG LÀM (85%)"),
        ("09–15/11", "Tuần 8", "Test chịu tải nhiều người, sao lưu dữ liệu, nạp Excel", "Hệ thống ổn định, nạp số dư đầu kỳ từ Excel dễ dàng", "2 tuần tới", "KẾ HOẠCH"),
        ("16–20/11", "Tuần 9", "Kế toán nghiệm thu thực tế (UAT) & Bàn giao", "KÝ BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO BẢN MVP ĐÚNG HẠN", "Chốt 20/11", "VỀ ĐÍCH 20/11"),
        ("12/2026", "Sau 20/11 (V1.1)", "Thí điểm 2-3 doanh nghiệp + Tính Giá thành & Lương", "Có phân hệ tính giá thành sản xuất & bảng lương tự động", "Sau 20/11", "SAU 20/11 (V1.1)"),
        ("01/2027", "Sau 20/11 (V1.2)", "Nộp thuế điện tử (TVAN) + Tự động lấy sao kê ngân hàng", "Nộp tờ khai thuế 1 click; tự khớp giao dịch ngân hàng", "Sau 20/11", "SAU 20/11 (V1.2)"),
        ("Q1/2027", "Sau 20/11 (V2.0)", "AI quét đọc hóa đơn tự động + App điện thoại cho Sếp", "AI gợi ý định khoản; Sếp xem báo cáo & duyệt chi trên phone", "Sau Tết", "SAU 20/11 (V2.0)")
    ]
    
    for r_idx, r_data in enumerate(rows1, start=8):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws1.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 2, 6] else cell_font
            c.border = thin_border
            c.alignment = align_center if c_idx in [1, 2, 5, 6] else align_left
            if "ĐÃ XONG" in val: c.fill = done_fill
            elif "ĐANG LÀM" in val: c.fill = doing_fill
            elif "KẾ HOẠCH" in val or "VỀ ĐÍCH" in val: c.fill = plan_fill
            elif "SAU 20/11" in val: c.fill = future_fill

    # -------------------------------------------------------------
    # TAB 2: 02_TINH_NANG (MVP 20/11 vs Sau 20/11)
    # -------------------------------------------------------------
    ws2 = wb.create_sheet(title="02_TINH_NANG")
    ws2.views.sheetView[0].showGridLines = True
    
    ws2.merge_cells("A1:E1")
    ws2["A1"] = "BẢNG PHÂN BỔ TÍNH NĂNG: BẢN MVP (20/11) VS SAU 20/11"
    ws2["A1"].font = title_font
    
    headers2 = ["Phân hệ", "Tính năng có trong bản MVP (20/11/2026)", "Tiến độ MVP", "Tính năng làm tiếp sau 20/11", "Thời gian sau 20/11"]
    for c_idx, h_text in enumerate(headers2, start=1):
        c = ws2.cell(3, c_idx, h_text)
        c.font = header_font; c.fill = header_fill; c.alignment = align_center; c.border = thin_border
        
    rows2 = [
        ("1. Đa công ty", "Tạo nhiều công ty, đổi công ty nhanh, phân quyền 21 vị trí, nhật ký sửa xóa", "90% (Xong)", "Đăng nhập 1 lần (SSO), tự trừ tiền thuê bao", "Tháng 1/2027"),
        ("2. Danh mục", "Khách hàng, NCC, Kho, Hàng hóa, Tài khoản kế toán, Ngân hàng, Thuế", "95% (Xong)", "Tự động đồng bộ danh bạ từ phần mềm ngoài", "Tháng 1/2027"),
        ("3. Chứng từ", "Lập nháp → Gửi duyệt → Ghi sổ; số nhảy tự động liên tục; chống sửa khi ghi sổ", "85% (Xong)", "Tự vẽ quy trình duyệt linh hoạt nhiều cấp", "Tháng 12/2026"),
        ("4. Mua hàng & Nợ NCC", "Đơn mua, Nhập kho, Hóa đơn mua vào, Sổ nợ NCC, Giấy đề nghị thanh toán", "90% (Xong)", "Đánh giá xếp hạng nhà cung cấp tự động", "Tháng 1/2027"),
        ("5. Tiền mặt & Ngân hàng", "Phiếu thu/chi tiền mặt, Báo Nợ/Có ngân hàng, đối chiếu số dư sổ phụ", "90% (Xong)", "Tự động đồng bộ giao dịch từ Ngân hàng điện tử", "Tháng 1/2027"),
        ("6. Bán hàng & Thu nợ", "Báo giá, Đơn bán, Xuất kho, Hóa đơn, Sổ nợ khách hàng, Thu tiền theo hóa đơn", "85% (Xong)", "Chính sách chiết khấu bậc thang, chăm sóc khách hàng", "Tháng 1/2027"),
        ("7. Kho & Giá vốn", "Nhập, Xuất, Chuyển kho, Kiểm kê, tự động tính giá vốn hàng xuất", "85% (Xong)", "Tính giá thành sản xuất (tập hợp 621/622/627 -> 154/155)", "Tháng 12/2026"),
        ("8. Sổ Cái & Tổng hợp", "Tự định khoản Nợ/Có, khóa sổ, Bảng cân đối phát sinh tài khoản", "85% (Đang làm)", "Phân bổ chi phí quản lý phức tạp đa chi nhánh", "Tháng 1/2027"),
        ("9. Thuế & Hóa đơn", "Bảng kê mua vào/bán ra, xuất file số liệu lập Tờ khai thuế GTGT", "80% (Đang làm)", "Nộp thẳng tờ khai lên cổng thuế (TVAN) + API hóa đơn", "Tháng 1/2027"),
        ("10. Tài sản & CCDC", "Tự trích khấu hao hàng tháng, phân bổ chi phí CCDC, ghi giảm tài sản", "85% (Xong)", "Quản lý kế hoạch bảo dưỡng máy móc nâng cao", "Q1/2027"),
        ("11. Báo cáo tài chính", "Trọn bộ BCTC TT133 & TT99 (CĐKT, KQKD, LCTT, Thuyết minh); xuất Excel/PDF", "85% (Đang làm)", "Hệ thống biểu đồ phân tích tài chính cho Sếp", "Tháng 1/2027"),
        ("12. Lương nhân viên", "Hạch toán chi phí lương & phiếu chi trả lương cơ bản", "70% (Xong cơ bản)", "Bảng chấm công tự động, tính BHXH, Thuế TNCN", "Tháng 12/2026"),
        ("13. AI & Ứng dụng", "Giao diện tối ưu chạy mượt trên Web máy tính & iPad phòng kế toán", "85% (Xong)", "AI quét hóa đơn tự động + App điện thoại cho Sếp", "Q1/2027")
    ]
    
    for r_idx, r_data in enumerate(rows2, start=4):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws2.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 3, 5] else cell_font
            c.border = thin_border
            c.alignment = align_center if c_idx in [1, 3, 5] else align_left
            if "Xong" in val: c.fill = done_fill
            elif "Đang làm" in val: c.fill = doing_fill
            if c_idx == 5: c.fill = future_fill

    # -------------------------------------------------------------
    # TAB 3: 03_15_NGAY_NUOC_RUT (Từ 05/11 đến 20/11)
    # -------------------------------------------------------------
    ws3 = wb.create_sheet(title="03_15_NGAY_NUOC_RUT")
    ws3.views.sheetView[0].showGridLines = True
    
    ws3.merge_cells("A1:E1")
    ws3["A1"] = "KẾ HOẠCH HÀNH ĐỘNG 15 NGÀY NƯỚC RÚT VỀ ĐÍCH (05/11 → 20/11)"
    ws3["A1"].font = title_font
    
    headers3 = ["Ngày", "Hạng mục trọng tâm", "Việc cần làm cụ thể", "Mục tiêu đạt được", "Trạng thái"]
    for c_idx, h_text in enumerate(headers3, start=1):
        c = ws3.cell(3, c_idx, h_text)
        c.font = header_font; c.fill = header_fill; c.alignment = align_center; c.border = thin_border
        
    rows3 = [
        ("05/11 (Hôm nay)", "Khóa menu & giao diện xem báo cáo", "Khóa cố định thanh điều khiển phía trên; kiểm tra bộ lọc ngày tháng", "Giao diện mượt mà, hết giật màn hình khi cuộn", "ĐÃ XONG"),
        ("06–08/11", "Khớp số Nợ=Có & Xuất BCTC", "Kiểm tra Bảng cân đối phát sinh luôn cân 100%; test xuất file Excel/PDF TT133 & TT99", "Số liệu sổ cái chuẩn xác, báo cáo xuất đúng mẫu", "ĐANG THỰC HIỆN"),
        ("09–12/11", "Kiểm tra chịu tải & Sao lưu", "Thử nghiệm nhiều kế toán cùng nhập liệu; kiểm tra tự động sao lưu dữ liệu", "Phần mềm chạy ổn định, không lo mất dữ liệu", "SẮP BẮT ĐẦU"),
        ("13–15/11", "Nhập số dư ban đầu từ Excel", "Hoàn thiện file mẫu Excel danh mục và số dư để kế toán nạp nhanh vào phần mềm", "Khách hàng mới dễ dàng chuyển số liệu cũ sang", "SẮP BẮT ĐẦU"),
        ("16–18/11", "Kế toán nghiệm thu thực tế (UAT)", "Cho kế toán thao tác thử toàn bộ luồng mua - bán - kho - tiền trên dữ liệu thật", "Phát hiện và chỉnh sửa nhanh các góp ý thực tế", "SẮP BẮT ĐẦU"),
        ("19–20/11", "Bàn giao chính thức bản MVP", "Hoàn tất hướng dẫn sử dụng nhanh; ký biên bản nghiệm thu", "BÀN GIAO PHIÊN BẢN MVP ĐÚNG HẠN 20/11/2026", "MỤC TIÊU VỀ ĐÍCH")
    ]
    
    for r_idx, r_data in enumerate(rows3, start=4):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws3.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 5] else cell_font
            c.border = thin_border
            c.alignment = align_center if c_idx in [1, 5] else align_left
            if "ĐÃ XONG" in val: c.fill = done_fill
            elif "ĐANG THỰC HIỆN" in val: c.fill = doing_fill
            elif "SẮP BẮT ĐẦU" in val or "MỤC TIÊU" in val: c.fill = plan_fill

    wb.remove(default_sheet)
    
    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                if cell.row in [1, 2]: continue
                lines = val.split("\n")
                for line in lines: max_len = max(max_len, len(line))
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 45)
            
    out_file = r"d:\THUẾ\KE_HOACH_DON_GIAN_ERP_THUE_2026.xlsx"
    wb.save(out_file)
    print(f"Generated simple plan: {out_file}")

if __name__ == "__main__":
    build_simple_plan()
