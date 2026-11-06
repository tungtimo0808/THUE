import openpyxl
import sys
sys.stdout.reconfigure(encoding='utf-8')
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def build_maintain_first_plan():
    wb = openpyxl.Workbook()
    default_sheet = wb.active
    
    font_family = "Segoe UI"
    
    title_font = Font(name=font_family, size=14, bold=True, color="1F497D")
    subtitle_font = Font(name=font_family, size=10, italic=True, color="595959")
    header_font = Font(name=font_family, size=10, bold=True, color="FFFFFF")
    cell_font = Font(name=font_family, size=9, color="000000")
    bold_cell_font = Font(name=font_family, size=9, bold=True, color="000000")
    kpi_num_font = Font(name=font_family, size=11, bold=True, color="1F497D")
    
    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    kpi_fill = PatternFill(start_color="F2F5F9", end_color="F2F5F9", fill_type="solid")
    done_fill = PatternFill(start_color="E8F8F5", end_color="E8F8F5", fill_type="solid")
    doing_fill = PatternFill(start_color="FEF9E7", end_color="FEF9E7", fill_type="solid")
    plan_fill = PatternFill(start_color="EBF5FB", end_color="EBF5FB", fill_type="solid")
    maintain_fill = PatternFill(start_color="FCF3CF", end_color="FCF3CF", fill_type="solid") # Vàng cam nhạt cho maintain
    gate_fill = PatternFill(start_color="D5F5E3", end_color="D5F5E3", fill_type="solid") # Xanh lá cổng đánh giá
    future_fill = PatternFill(start_color="F4ECF7", end_color="F4ECF7", fill_type="solid")
    
    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )
    
    align_center = Alignment(horizontal='center', vertical='center', wrap_text=True)
    align_left = Alignment(horizontal='left', vertical='center', wrap_text=True)

    # =========================================================================
    # TAB 1: 01_LO_TRINH_XUYEN_SUOT
    # =========================================================================
    ws1 = wb.create_sheet(title="01_LO_TRINH_XUYEN_SUOT")
    ws1.views.sheetView[0].showGridLines = True
    
    ws1.merge_cells("A1:G1")
    ws1["A1"] = "LỘ TRÌNH DỰ ÁN KẾ TOÁN & THUẾ (SỔ VIỆT ERP) - NGUYÊN TẮC: ỔN ĐỊNH RỒI MỚI MỞ RỘNG"
    ws1["A1"].font = title_font
    
    ws1.merge_cells("A2:G2")
    ws1["A2"] = "Sau mốc 20/11: Tập trung 100% nguồn lực vào BẢO TRÌ (Maintain), rà soát kỹ lưỡng; khi hệ thống thật sự ỔN ĐỊNH mới làm tính năng mới"
    ws1["A2"].font = subtitle_font
    
    # 4 Cards
    cards = [
        ("HIỆN TẠI", "05/11/2026 (Xong ~85% MVP)", "A4:B4", "A5:B5", "A4", "A5"),
        ("MỐC VỀ ĐÍCH MVP", "20/11/2026 (Còn 15 ngày)", "C4:D4", "C5:D5", "C4", "C5"),
        ("TRỌNG TÂM SAU 20/11", "Bảo trì & Rà soát lỗi (4 Tuần)", "E4:F4", "E5:F5", "E4", "E5"),
        ("MỞ RỘNG MỚI", "Chỉ làm khi HỆ THỐNG ĐÃ ỔN", "G4:G4", "G5:G5", "G4", "G5")
    ]
    for lbl, val, m1, m2, c1, c2 in cards:
        ws1.merge_cells(m1); ws1.merge_cells(m2)
        ws1[c1] = lbl; ws1[c1].font = Font(name=font_family, size=9, bold=True, color="595959"); ws1[c1].alignment = align_center; ws1[c1].fill = kpi_fill
        ws1[c2] = val; ws1[c2].font = kpi_num_font; ws1[c2].alignment = align_center; ws1[c2].fill = kpi_fill
        
    for r in range(4, 6):
        for c in range(1, 8):
            ws1.cell(r, c).border = thin_border
            
    headers1 = ["Tuần", "Thời gian", "Giai đoạn", "Trọng tâm công việc", "Nội dung thực hiện chi tiết", "Kết quả mang lại cho doanh nghiệp", "Trạng thái"]
    for c_idx, h_text in enumerate(headers1, start=1):
        c = ws1.cell(7, c_idx, h_text)
        c.font = header_font; c.fill = header_fill; c.alignment = align_center; c.border = thin_border
        
    all_weeks = [
        # --- GIAI ĐOẠN 1: TRƯỚC 20/11 (XÂY DỰNG MVP) ---
        ("W1", "21–27/09/2026", "Khởi động", "Khung giao diện", "Khởi tạo mã nguồn, dựng màn hình khung theo Figma cho Kế toán, Thuế, Kho", "Có khung giao diện để cả đội thống nhất bố cục", "ĐÃ XONG"),
        ("W2", "28/09–04/10/2026", "Khảo sát", "Chuẩn hóa kế toán", "Khảo sát biểu mẫu, danh mục tài khoản, quy tắc kiểm tra khách hàng, NCC", "Bộ hồ sơ yêu cầu chi tiết làm chuẩn phát triển", "ĐÃ XONG"),
        ("W3", "05–11/10/2026", "Tiền & Mẫu in", "Thu/Chi & In ấn", "Làm mẫu in tiếng Việt (hợp đồng, nợ); phân hệ Thu/Chi tiền mặt, đối chiếu ngân hàng", "In được biểu mẫu ra giấy/PDF, nhập thử tiền mặt", "ĐÃ XONG"),
        ("W4", "12–18/10/2026", "Dữ liệu thật", "13 Phân hệ & Đăng nhập", "Xây dựng cơ sở dữ liệu thật cho 13 phân hệ; hoàn thiện đăng ký/đăng nhập an toàn", "Chấm dứt dữ liệu giả; web lưu trữ dữ liệu thật trên server", "ĐÃ XONG"),
        ("W5", "19–25/10/2026", "Chuẩn MISA", "TT99 & Dữ liệu ABC", "Đồng bộ giao diện MISA / Sổ Việt ERP; áp dụng TT99; test bộ chứng từ cty ABC", "Chạy thông suốt chu trình Mua hàng - Kho - Tiền", "ĐÃ XONG"),
        ("W6", "26/10–01/11/2026", "Cao điểm BCTC", "BCTC TT133 & Đa cty", "Trọn bộ BCTC TT133, quản lý nhiều cty độc lập, tài sản cố định, tối ưu tải trang", "Hệ thống thành hình đầy đủ phần mềm kế toán thực thụ", "ĐÃ XONG"),
        ("W7", "02–08/11/2026", "Khớp số (Nay)", "TT58 & Khớp Nợ=Có", "Chế độ kế toán TT58, 21 vai trò kế toán, khóa menu cố định, đối chiếu sổ sách", "Sổ sách cân đối Nợ=Có, xuất file báo cáo Excel/PDF đẹp", "ĐANG LÀM (85%)"),
        ("W8", "09–15/11/2026", "Ổn định", "Chịu tải & Nhập Excel", "Thử nghiệm nhiều người dùng cùng lúc, tự động sao lưu dữ liệu, hoàn thiện nạp Excel", "Phần mềm chạy ổn định; dễ nạp danh mục và số dư cũ", "KẾ HOẠCH W8"),
        ("W9", "16–20/11/2026", "Nghiệm thu", "BÀN GIAO BẢN MVP", "Kế toán trưởng nghiệm thu thực tế (UAT); ký biên bản nghiệm thu bàn giao", "CHÍNH THỨC BÀN GIAO PHIÊN BẢN MVP ĐI VÀO SỬ DỤNG", "VỀ ĐÍCH 20/11"),
        
        # --- GIAI ĐOẠN 2: SAU 20/11 (TRỌNG TÂM: MAINTAIN & RÀ SOÁT LỖI) ---
        ("W10", "23–27/11/2026", "Sau 20/11: Maintain", "Hỗ trợ vận hành thực tế", "Đồng hành trực tiếp cùng kế toán đưa chứng từ thật vào phần mềm; trực hỗ trợ tức thời", "Người dùng nhập liệu thực tế hàng ngày, ghi nhận ngay các lỗi phát sinh", "TRỌNG TÂM MAINTAIN"),
        ("W11", "30/11–04/12/2026", "Sau 20/11: Maintain", "Rà soát lỗi & số liệu", "Rà soát toàn diện: kiểm tra có bị lệch số sổ cái không, lỗi in ấn, lỗi lọc dữ liệu, sót trường", "Phát hiện và liệt kê toàn bộ các điểm chưa mượt mà trong thực tế", "TRỌNG TÂM MAINTAIN"),
        ("W12", "07–11/12/2026", "Sau 20/11: Maintain", "Vá lỗi & Tối ưu tốc độ", "Sửa triệt để các lỗi người dùng phản ánh; tối ưu lại các thao tác kế toán bấm nhiều nhất", "Hệ thống mượt mà hơn, kế toán thao tác nhanh không bị vướng mắc", "TRỌNG TÂM MAINTAIN"),
        ("W13", "14–18/12/2026", "Sau 20/11: Đánh giá", "CỔNG ĐÁNH GIÁ ỔN ĐỊNH", "Họp đánh giá toàn bộ hệ thống: Nếu 100% số liệu cân đối, không còn lỗi tồn đọng -> DUYỆT ỔN ĐỊNH", "ĐIỀU KIỆN TIÊN QUYẾT: ĐẠT ỔN ĐỊNH MỚI BẮT ĐẦU LÀM TÍNH NĂNG MỚI", "CỔNG ỔN ĐỊNH"),
        
        # --- GIAI ĐOẠN 3: KHI HỆ THỐNG ĐÃ ỔN ĐỊNH (MỚI PHÁT TRIỂN CÁI MỚI) ---
        ("W14", "21–25/12/2026", "Mở rộng (Nếu ổn)", "Khóa sổ năm tài chính", "Hỗ trợ kế toán khóa sổ năm 2026, kết chuyển kết quả kinh doanh 911 và chuyển số dư sang 2027", "Khóa sổ năm tài chính cũ an toàn, chuẩn bị năm mới", "DỰ KIẾN KHI ỔN"),
        ("W15–16", "28/12–08/01/2027", "Mở rộng (Nếu ổn)", "Tính Giá thành & Lương", "Làm phân hệ tính giá thành sản xuất cơ bản và bảng tính lương, trích nộp bảo hiểm, thuế TNCN", "Doanh nghiệp tự động hóa tính giá vốn sản phẩm và tính lương", "DỰ KIẾN KHI ỔN"),
        ("W17–18", "11–22/01/2027", "Mở rộng (Nếu ổn)", "Thuế điện tử & Ngân hàng", "Kết nối nộp thuế điện tử trực tiếp (TVAN) và tự động tải sao kê từ ngân hàng điện tử", "Nộp tờ khai thuế 1 click; tự động khớp tiền ngân hàng mỗi sáng", "DỰ KIẾN KHI ỔN"),
        ("NGHỈ TẾT", "25/01–05/02/2027", "Nghỉ Tết Nguyên Đán", "Trực kỹ thuật nhẹ", "Bảo trì định kỳ máy chủ và hỗ trợ nhẹ nhàng dịp Tết", "Hệ thống chạy an toàn xuyên Tết", "NGHỈ TẾT"),
        ("Sau Tết", "08/02–26/03/2027", "Mở rộng (Nếu ổn)", "AI & App điện thoại", "Sau Tết mới nghiên cứu AI đọc hóa đơn tự động và App điện thoại cho Giám đốc duyệt chi", "Nâng cấp trải nghiệm thông minh cho người dùng", "DỰ KIẾN SAU TẾT")
    ]
    
    for r_idx, r_data in enumerate(all_weeks, start=8):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws1.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 2, 7] else cell_font
            c.border = thin_border
            c.alignment = align_center if c_idx in [1, 2, 7] else align_left
            if "ĐÃ XONG" in val: c.fill = done_fill
            elif "ĐANG LÀM" in val: c.fill = doing_fill
            elif "KẾ HOẠCH W8" in val or "VỀ ĐÍCH 20/11" in val: c.fill = plan_fill
            elif "MAINTAIN" in val: c.fill = maintain_fill
            elif "CỔNG ỔN ĐỊNH" in val: c.fill = gate_fill
            elif "DỰ KIẾN" in val: c.fill = future_fill
            elif "NGHỈ TẾT" in val: c.fill = kpi_fill

    # =========================================================================
    # TAB 2: 02_KE_HOACH_MAINTAIN_SAU_20-11
    # =========================================================================
    ws2 = wb.create_sheet(title="02_MAINTAIN_VA_KIEM_TRA")
    ws2.views.sheetView[0].showGridLines = True
    
    ws2.merge_cells("A1:F1")
    ws2["A1"] = "KẾ HOẠCH BẢO TRÌ (MAINTAIN) & RÀ SOÁT HỆ THỐNG SAU 20/11"
    ws2["A1"].font = title_font
    
    ws2.merge_cells("A2:F2")
    ws2["A2"] = "Mục tiêu: Đảm bảo phần mềm MVP vận hành 100% trơn tru, không còn lỗi sót; CHỈ KHI NÀO ỔN MỚI LÀM CÁI MỚI"
    ws2["A2"].font = subtitle_font
    
    headers2 = ["Hạng mục rà soát", "Thời gian", "Nội dung kiểm tra chi tiết xem còn gì sót không", "Tiêu chuẩn đánh giá là 'ỔN'", "Hành động khi chưa ổn", "Bộ phận phụ trách"]
    for c_idx, h_text in enumerate(headers2, start=1):
        c = ws2.cell(4, c_idx, h_text)
        c.font = header_font; c.fill = header_fill; c.alignment = align_center; c.border = thin_border
        
    maintain_details = [
        ("1. Hỗ trợ người dùng nhập liệu thật", "Tuần 10 (23–27/11)", "Theo dõi kế toán nhập liệu chứng từ hàng ngày (hóa đơn mua, bán, phiếu thu, phiếu chi); hỗ trợ giải đáp trực tiếp.", "Người dùng tự nhập liệu trơn tru, không gặp lỗi hệ thống chặn thao tác.", "Ghi nhận ngay lỗi người dùng gặp phải để đưa vào danh sách sửa gấp.", "Triển khai + Kế toán"),
        ("2. Rà soát cân đối Sổ sách Kế toán", "Tuần 11 (30/11–04/12)", "Kiểm tra kỹ lưỡng: Bảng cân đối phát sinh tài khoản có luôn cân Nợ = Có không; sổ chi tiết có khớp với sổ cái không; có phát sinh hạch toán sai tài khoản không.", "100% các báo cáo sổ sách cân đối tuyệt đối trên dữ liệu thực tế phát sinh.", "Kế toán trưởng trực tiếp đối soát và kiểm tra lại quy tắc định khoản tự động.", "Kế toán trưởng"),
        ("3. Rà soát Báo cáo tài chính & Mẫu in", "Tuần 11 (30/11–04/12)", "Kiểm tra xem khi xuất file Excel/PDF các biểu mẫu (Bảng CĐKT, KQKD, LCTT, Thuyết minh, Phiếu thu/chi) có bị tràn chữ, lệch cột, mất nét in không.", "Mọi file xuất ra đều đẹp mắt, đúng định dạng chuẩn Thông tư 133, TT99, in ra giấy A4 chuẩn.", "Căn chỉnh lại CSS/mẫu in và bộ chuyển đổi Excel/PDF.", "Giao diện + Kế toán"),
        ("4. Rà soát Bảo mật & Tách biệt Đa công ty", "Tuần 12 (07–11/12)", "Kiểm tra xem khi chuyển đổi giữa các công ty có bị lẫn lộn số liệu không; tài khoản nhân viên công ty A có bao giờ xem nhầm số liệu công ty B không.", "Dữ liệu các công ty hoàn toàn độc lập, an toàn tuyệt đối 100%.", "Nếu phát hiện rò rỉ dữ liệu phải khóa ngay và vá lỗ hổng lập tức.", "Kỹ thuật hệ thống"),
        ("5. Sửa lỗi thực tế & Tối ưu tốc độ", "Tuần 12 (07–11/12)", "Xử lý dứt điểm toàn bộ các góp ý nhỏ: phím tắt, nút Lưu & Đóng, tốc độ tìm kiếm danh mục, thông báo lỗi bằng tiếng Việt dễ hiểu.", "Phần mềm chạy nhanh dưới 1 giây, thao tác gõ số liệu mượt mà, không bị khựng.", "Tối ưu câu lệnh cơ sở dữ liệu và bộ nhớ đệm.", "Đội ngũ Lập trình"),
        ("6. ĐÁNH GIÁ CHỐT HỆ THỐNG ỔN ĐỊNH", "Tuần 13 (14–18/12)", "Họp nghiệm thu giai đoạn bảo trì: Kiểm tra lại toàn bộ hệ thống; xác nhận không còn lỗi nghiêm trọng nào; người dùng kế toán hài lòng.", "ĐẠT TRẠNG THÁI ỔN ĐỊNH: Hệ thống vận hành trơn tru không cần can thiệp kỹ thuật hàng ngày.", "NẾU CHƯA ỔN: Tiếp tục bảo trì đến khi ổn. NẾU ĐÃ ỔN: Mới bật đèn xanh phát triển tính năng mới.", "Ban Lãnh đạo + Toàn đội"),
        ("7. PHÁT TRIỂN TÍNH NĂNG MỚI (NẾU ỔN)", "Từ cuối 12/2026 trở đi", "Sau khi đã chốt hệ thống ổn định, mới triển khai các tính năng tiếp theo: Khóa sổ năm 2026, Giá thành, Lương, Hóa đơn điện tử, Ngân hàng, AI.", "Tính năng mới được xây dựng trên nền tảng cốt lõi đã hoàn toàn vững chắc.", "Tính năng mới phát triển tuần tự từng cái một, làm xong cái nào chắc chắn cái đó.", "Toàn bộ Đội ngũ")
    ]
    
    for r_idx, r_data in enumerate(maintain_details, start=5):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws2.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 2, 6] else cell_font
            c.border = thin_border
            c.alignment = align_center if c_idx in [1, 2, 6] else align_left
            if "ĐÁNH GIÁ" in val: c.fill = gate_fill
            elif "PHÁT TRIỂN" in val: c.fill = future_fill
            else: c.fill = maintain_fill

    # =========================================================================
    # TAB 3: 03_15_NGAY_NUOC_RUT_MVP
    # =========================================================================
    ws3 = wb.create_sheet(title="03_15_NGAY_NUOC_RUT_MVP")
    ws3.views.sheetView[0].showGridLines = True
    
    ws3.merge_cells("A1:E1")
    ws3["A1"] = "KẾ HOẠCH HÀNH ĐỘNG 15 NGÀY NƯỚC RÚT VỀ ĐÍCH BẢN MVP (05/11 → 20/11/2026)"
    ws3["A1"].font = title_font
    
    headers3 = ["Ngày", "Hạng mục trọng tâm", "Công việc thực hiện cụ thể", "Mục tiêu đạt được để nghiệm thu", "Trạng thái"]
    for c_idx, h_text in enumerate(headers3, start=1):
        c = ws3.cell(3, c_idx, h_text)
        c.font = header_font; c.fill = header_fill; c.alignment = align_center; c.border = thin_border
        
    mvp_sprint = [
        ("05/11 (Hôm nay)", "Khóa menu & xem báo cáo", "Khóa cố định thanh điều khiển phía trên; kiểm tra bộ chọn ngày tháng và bộ lọc", "Giao diện mượt mà, hết giật màn hình khi cuộn xem danh sách dài", "ĐÃ XONG"),
        ("06–08/11", "Khớp số Nợ=Có & Xuất BCTC", "Kiểm tra Bảng cân đối phát sinh luôn cân 100%; test xuất file Excel/PDF TT133 & TT99", "Số liệu sổ cái chuẩn xác tuyệt đối, báo cáo xuất ra đúng mẫu", "ĐANG THỰC HIỆN"),
        ("09–12/11", "Kiểm tra chịu tải & Sao lưu", "Thử nghiệm nhiều kế toán cùng nhập liệu; kiểm tra tự động sao lưu dữ liệu phòng sự cố", "Phần mềm chạy ổn định, không lo gián đoạn hay mất dữ liệu", "SẮP BẮT ĐẦU"),
        ("13–15/11", "Nhập số dư ban đầu từ Excel", "Hoàn thiện file mẫu Excel danh mục và số dư để kế toán nạp nhanh vào phần mềm", "Khách hàng mới dễ dàng chuyển số liệu từ Excel cũ sang dùng phần mềm", "SẮP BẮT ĐẦU"),
        ("16–18/11", "Kế toán nghiệm thu thực tế (UAT)", "Cho kế toán thao tác thử toàn bộ luồng mua - bán - kho - tiền trên dữ liệu thực tế", "Ghi nhận và tinh chỉnh nhanh các chi tiết thao tác theo góp ý thực tế", "SẮP BẮT ĐẦU"),
        ("19–20/11", "Bàn giao chính thức bản MVP", "Hoàn tất tài liệu hướng dẫn nhanh; ký biên bản nghiệm thu bàn giao", "KÝ BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO BẢN MVP ĐÚNG HẠN 20/11/2026", "MỤC TIÊU VỀ ĐÍCH")
    ]
    
    for r_idx, r_data in enumerate(mvp_sprint, start=4):
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
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 48)
            
    out_file = r"d:\THUẾ\KE_HOACH_DON_GIAN_ERP_THUE_2026.xlsx"
    wb.save(out_file)
    print(f"Generated maintain-first plan: {out_file}")

if __name__ == "__main__":
    build_maintain_first_plan()
