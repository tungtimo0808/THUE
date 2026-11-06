import openpyxl
import sys
sys.stdout.reconfigure(encoding='utf-8')
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def build_full_detailed_plan():
    wb = openpyxl.Workbook()
    default_sheet = wb.active
    
    font_family = "Segoe UI"
    
    title_font = Font(name=font_family, size=14, bold=True, color="1F497D")
    subtitle_font = Font(name=font_family, size=10, italic=True, color="595959")
    header_font = Font(name=font_family, size=10, bold=True, color="FFFFFF")
    cell_font = Font(name=font_family, size=9, color="000000")
    bold_cell_font = Font(name=font_family, size=9, bold=True, color="000000")
    kpi_num_font = Font(name=font_family, size=11, bold=True, color="1F497D")
    section_font = Font(name=font_family, size=11, bold=True, color="1F497D")
    
    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    section_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
    kpi_fill = PatternFill(start_color="F2F5F9", end_color="F2F5F9", fill_type="solid")
    done_fill = PatternFill(start_color="E8F8F5", end_color="E8F8F5", fill_type="solid")
    doing_fill = PatternFill(start_color="FEF9E7", end_color="FEF9E7", fill_type="solid")
    plan_fill = PatternFill(start_color="EBF5FB", end_color="EBF5FB", fill_type="solid")
    v11_fill = PatternFill(start_color="EAFAF1", end_color="EAFAF1", fill_type="solid")
    v12_fill = PatternFill(start_color="FEF5E7", end_color="FEF5E7", fill_type="solid")
    v20_fill = PatternFill(start_color="F4ECF7", end_color="F4ECF7", fill_type="solid")
    
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
    ws1["A1"] = "LỘ TRÌNH DỰ ÁN KẾ TOÁN & THUẾ (SỔ VIỆT ERP) - TOÀN DIỆN TỪ ĐẦU ĐẾN Q1/2027"
    ws1["A1"].font = title_font
    
    ws1.merge_cells("A2:G2")
    ws1["A2"] = "Chi tiết tuần theo tuần: 9 tuần đầu (Mốc MVP 20/11/2026) và 16 tuần tiếp theo sau 20/11 (V1.1, V1.2, V2.0)"
    ws1["A2"].font = subtitle_font
    
    # KPI cards
    cards = [
        ("MỐC HIỆN TẠI", "05/11/2026 (Xong ~85% MVP)", "A4:B4", "A5:B5", "A4", "A5"),
        ("MỐC VỀ ĐÍCH MVP", "20/11/2026 (Còn 15 ngày)", "C4:D4", "C5:D5", "C4", "C5"),
        ("MỐC V1.1 & V1.2", "21/11/2026 → 22/01/2027", "E4:F4", "E5:F5", "E4", "E5"),
        ("MỐC V2.0 (AI & APP)", "08/02/2027 → 26/03/2027", "G4:G4", "G5:G5", "G4", "G5")
    ]
    for lbl, val, m1, m2, c1, c2 in cards:
        ws1.merge_cells(m1); ws1.merge_cells(m2)
        ws1[c1] = lbl; ws1[c1].font = Font(name=font_family, size=9, bold=True, color="595959"); ws1[c1].alignment = align_center; ws1[c1].fill = kpi_fill
        ws1[c2] = val; ws1[c2].font = kpi_num_font; ws1[c2].alignment = align_center; ws1[c2].fill = kpi_fill
        
    for r in range(4, 6):
        for c in range(1, 8):
            ws1.cell(r, c).border = thin_border
            
    headers1 = ["Tuần", "Thời gian", "Giai đoạn", "Trọng tâm nghiệp vụ", "Công việc thực hiện chi tiết", "Kết quả mang lại cho doanh nghiệp", "Trạng thái"]
    for c_idx, h_text in enumerate(headers1, start=1):
        c = ws1.cell(7, c_idx, h_text)
        c.font = header_font; c.fill = header_fill; c.alignment = align_center; c.border = thin_border
        
    all_weeks = [
        # --- GIAI ĐOẠN 1: TRƯỚC 20/11 (MVP) ---
        ("W1", "21–27/09/2026", "Khởi động", "Khung giao diện", "Khởi tạo mã nguồn, dựng màn hình khung theo Figma cho Kế toán, Thuế, Kho", "Có khung giao diện trực quan để cả đội ngũ thống nhất", "ĐÃ XONG"),
        ("W2", "28/09–04/10/2026", "Khảo sát", "Chuẩn hóa kế toán", "Khảo sát biểu mẫu, hệ thống tài khoản, quy tắc kiểm tra khách hàng, NCC", "Bộ hồ sơ yêu cầu chi tiết làm chuẩn phát triển", "ĐÃ XONG"),
        ("W3", "05–11/10/2026", "Tiền & Mẫu in", "Thu/Chi & In ấn", "Làm mẫu in tiếng Việt (hợp đồng, nợ); phân hệ Thu/Chi tiền mặt, đối chiếu ngân hàng", "In được biểu mẫu ra giấy/PDF, nhập thử tiền mặt", "ĐÃ XONG"),
        ("W4", "12–18/10/2026", "Dữ liệu thật", "13 Phân hệ & Đăng nhập", "Xây dựng cơ sở dữ liệu thật cho 13 phân hệ; hoàn thiện đăng ký/đăng nhập an toàn", "Chấm dứt dữ liệu giả; web lưu trữ dữ liệu thật trên server", "ĐÃ XONG"),
        ("W5", "19–25/10/2026", "Chuẩn MISA", "TT99 & Dữ liệu ABC", "Đồng bộ giao diện MISA / Sổ Việt ERP; áp dụng TT99; test bộ chứng từ cty ABC", "Chạy thông suốt chu trình Mua hàng - Kho - Tiền", "ĐÃ XONG"),
        ("W6", "26/10–01/11/2026", "Cao điểm BCTC", "BCTC TT133 & Đa cty", "Trọn bộ BCTC TT133, quản lý nhiều cty độc lập, tài sản cố định, tối ưu tải trang", "Hệ thống thành hình đầy đủ phần mềm kế toán thực thụ", "ĐÃ XONG"),
        ("W7", "02–08/11/2026", "Khớp số (Nay)", "TT58 & Khớp Nợ=Có", "Chế độ kế toán TT58, 21 vai trò kế toán, khóa menu cố định, đối chiếu số sách", "Sổ sách cân đối Nợ=Có, xuất file báo cáo Excel/PDF đẹp", "ĐANG LÀM (85%)"),
        ("W8", "09–15/11/2026", "Ổn định", "Chịu tải & Nhập Excel", "Thử nghiệm nhiều người dùng cùng lúc, tự động sao lưu dữ liệu, hoàn thiện nạp Excel", "Phần mềm chạy ổn định; dễ nạp danh mục và số dư cũ", "KẾ HOẠCH W8"),
        ("W9", "16–20/11/2026", "Nghiệm thu", "BÀN GIAO BẢN MVP", "Kế toán trưởng nghiệm thu thực tế (UAT); ký biên bản nghiệm thu bàn giao", "CHÍNH THỨC BÀN GIAO PHIÊN BẢN MVP ĐI VÀO SỬ DỤNG", "VỀ ĐÍCH 20/11"),
        
        # --- GIAI ĐOẠN 2: SAU 20/11 (V1.1 - THÁNG 12/2026) ---
        ("W10", "23–27/11/2026", "Sau 20/11 (V1.1)", "Thí điểm Pilot thực tế", "Cài đặt chạy thử nghiệm tại 2-3 doanh nghiệp thân thiết; đào tạo kế toán thực tế", "Ghi nhận phản hồi vận hành thực tế tại doanh nghiệp", "KẾ HOẠCH V1.1"),
        ("W11", "30/11–04/12/2026", "Sau 20/11 (V1.1)", "Tập hợp chi phí giá thành", "Xây dựng phân hệ Giá thành: tập hợp chi phí NVL (621), nhân công (622), SX chung (627)", "Theo dõi chi phí sản xuất theo từng đơn hàng/lô sản phẩm", "KẾ HOẠCH V1.1"),
        ("W12", "07–11/12/2026", "Sau 20/11 (V1.1)", "Tính giá thành & Nhập kho", "Đánh giá sản phẩm dở dang cuối kỳ (154); tự động tính giá thành đơn vị và nhập kho (155)", "Biết chính xác giá vốn sản xuất của từng sản phẩm làm ra", "KẾ HOẠCH V1.1"),
        ("W13", "14–18/12/2026", "Sau 20/11 (V1.1)", "Bảng lương & Chấm công", "Bảng chấm công tự động, tính lương thời gian/KPI, trích nộp BHXH và thuế TNCN", "Tự động hóa hoàn toàn việc lập bảng lương và trả lương", "KẾ HOẠCH V1.1"),
        
        # --- GIAI ĐOẠN 3: SAU 20/11 (V1.2 - THÁNG 01/2027) ---
        ("W14", "21–25/12/2026", "Sau 20/11 (V1.2)", "Khóa sổ năm tài chính", "Quy trình khóa sổ năm 2026, bút toán kết chuyển lãi lỗ (911), chuyển số dư sang 2027", "Hỗ trợ doanh nghiệp quyết toán năm tài chính trọn vẹn", "KẾ HOẠCH V1.2"),
        ("W15", "28/12–02/01/2027", "Sau 20/11 (V1.2)", "Hóa đơn điện tử qua API", "Kết nối API trực tiếp với VNPT, Viettel, MISA meInvoice; xuất hóa đơn ngay khi bán hàng", "Xuất hóa đơn điện tử hợp lệ 1 click từ màn hình bán hàng", "KẾ HOẠCH V1.2"),
        ("W16", "04–08/01/2027", "Sau 20/11 (V1.2)", "Cổng nộp thuế TVAN", "Cắm Token chữ ký số, ký số tờ khai thuế và nộp trực tiếp sang Tổng cục Thuế", "Nộp tờ khai thuế trực tuyến không cần xuất file XML thủ công", "KẾ HOẠCH V1.2"),
        ("W17", "11–15/01/2027", "Sau 20/11 (V1.2)", "Ngân hàng điện tử (Bank)", "Kết nối Open Banking với Vietcombank, MB, Techcombank; tự động tải sao kê", "Tự động khớp tiền ngân hàng mỗi ngày, giảm 90% việc nhập tay", "KẾ HOẠCH V1.2"),
        ("W18", "18–22/01/2027", "Sau 20/11 (V1.2)", "Báo cáo quản trị dòng tiền", "Biểu đồ cảnh báo nợ xấu, dự báo dòng tiền thu - chi 30-60 ngày cho Ban Giám đốc", "Sếp nắm chắc sức khỏe tài chính trước kỳ nghỉ Tết", "KẾ HOẠCH V1.2"),
        ("NGHỈ TẾT", "25/01–05/02/2027", "Nghỉ Tết Nguyên Đán", "Trực kỹ thuật hỗ trợ nhẹ", "Bảo trì định kỳ máy chủ và trực hỗ trợ khách hàng dịp Tết", "Hệ thống chạy ổn định xuyên Tết", "NGHỈ TẾT"),
        
        # --- GIAI ĐOẠN 4: SAU 20/11 (V2.0 - Q1/2027 SAU TẾT) ---
        ("W19", "08–12/02/2027", "Sau 20/11 (V2.0)", "AI đọc hóa đơn (OCR - P1)", "Huấn luyện mô hình AI tự nhận diện hóa đơn PDF và ảnh chụp (tên NCC, MST, tiền hàng)", "Kế toán chỉ cần kéo thả file hóa đơn vào phần mềm", "KẾ HOẠCH V2.0"),
        ("W20", "15–19/02/2027", "Sau 20/11 (V2.0)", "AI gợi ý hạch toán (P2)", "AI tự động phân tích mặt hàng và gợi ý tài khoản Nợ/Có chuẩn; kế toán chỉ bấm duyệt", "Tự động hóa 80% thời gian nhập liệu hóa đơn đầu vào", "KẾ HOẠCH V2.0"),
        ("W21", "22–26/02/2027", "Sau 20/11 (V2.0)", "App điện thoại Giám đốc (P1)", "Phát triển ứng dụng Mobile (iOS/Android): màn hình xem doanh thu, chi phí, tồn quỹ tiền", "Giám đốc xem tình hình công ty mọi lúc mọi nơi trên điện thoại", "KẾ HOẠCH V2.0"),
        ("W22", "01–05/03/2027", "Sau 20/11 (V2.0)", "App điện thoại Duyệt chi (P2)", "Tính năng thông báo và duyệt phiếu chi tiền, đơn mua hàng trực tiếp trên điện thoại", "Ký duyệt chứng từ từ xa không cần có mặt ở văn phòng", "KẾ HOẠCH V2.0"),
        ("W23", "08–12/03/2027", "Sau 20/11 (V2.0)", "Kiểm toán tự động (Audit AI)", "Công cụ tự động quét lỗi kế toán: lệch kho âm, hóa đơn trùng, định khoản sai nguyên tắc", "Cảnh báo sớm các rủi ro kế toán trước kỳ thanh tra thuế", "KẾ HOẠCH V2.0"),
        ("W24", "15–19/03/2027", "Sau 20/11 (V2.0)", "Thử nghiệm toàn diện V2.0", "Kiểm thử bảo mật, khả năng phục hồi dữ liệu và hiệu năng toàn bộ hệ thống mở rộng", "Bản phát hành V2.0 đạt tiêu chuẩn an toàn cao nhất", "KẾ HOẠCH V2.0"),
        ("W25", "22–26/03/2027", "Sau 20/11 (V2.0)", "PHÁT HÀNH BẢN V2.0", "Chính thức phát hành bản V2.0 toàn diện; đóng gói giải pháp thương mại hóa ra thị trường", "SỔ VIỆT ERP TRỞ THÀNH HỆ SINH THÁI TÀI CHÍNH TOÀN DIỆN", "KẾ HOẠCH V2.0")
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
            elif "V1.1" in val: c.fill = v11_fill
            elif "V1.2" in val: c.fill = v12_fill
            elif "V2.0" in val: c.fill = v20_fill
            elif "NGHỈ TẾT" in val: c.fill = kpi_fill

    # =========================================================================
    # TAB 2: 02_CHI_TIET_SAU_20-11
    # =========================================================================
    ws2 = wb.create_sheet(title="02_CHI_TIET_SAU_20-11")
    ws2.views.sheetView[0].showGridLines = True
    
    ws2.merge_cells("A1:G1")
    ws2["A1"] = "KẾ HOẠCH CHI TIẾT GIAI ĐOẠN SAU 20/11/2026 (TỪ 21/11/2026 ĐẾN HẾT THÁNG 03/2027)"
    ws2["A1"].font = title_font
    
    ws2.merge_cells("A2:G2")
    ws2["A2"] = "Phân rã chi tiết từng tính năng, kết quả nghiệm thu và bộ phận chịu trách nhiệm cho V1.1, V1.2 và V2.0"
    ws2["A2"].font = subtitle_font
    
    headers2 = ["Giai đoạn", "Tuần", "Phân hệ nghiệp vụ", "Tính năng phát triển chi tiết", "Ý nghĩa và giá trị cho doanh nghiệp", "Tiêu chuẩn nghiệm thu tính năng", "Bộ phận phụ trách"]
    for c_idx, h_text in enumerate(headers2, start=1):
        c = ws2.cell(4, c_idx, h_text)
        c.font = header_font; c.fill = header_fill; c.alignment = align_center; c.border = thin_border
        
    post_details = [
        # Giai đoạn V1.1
        ("V1.1 (Tháng 12/2026)", "W10 (23–27/11)", "Thí điểm (Pilot)", "Triển khai phần mềm tại 2–3 doanh nghiệp thực tế; nạp số dư thật và đào tạo người dùng", "Kiểm chứng phần mềm trong môi trường kế toán thực tế hàng ngày", "Doanh nghiệp thí điểm nhập liệu trơn tru, không phát sinh lỗi chặn", "Triển khai + Kế toán"),
        ("V1.1 (Tháng 12/2026)", "W11 (30/11–04/12)", "Giá thành sản xuất", "Tập hợp chi phí trực tiếp: Xuất kho nguyên vật liệu (621), bảng chấm công nhân công (622), chi phí chung (627)", "Nắm rõ chi phí bỏ ra cho từng đơn hàng hoặc từng phân xưởng sản xuất", "Phiếu xuất kho sản xuất và chi phí nhân công tự động liên kết vào mã lệnh sản xuất", "Kế toán + Lập trình"),
        ("V1.1 (Tháng 12/2026)", "W12 (07–11/12)", "Giá thành sản xuất", "Đánh giá chi phí sản phẩm dở dang cuối kỳ (154); tự động tính giá thành đơn vị thành phẩm nhập kho (155)", "Tính chính xác giá vốn sản xuất để làm cơ sở định giá bán và tính lãi lỗ", "Bảng tính giá thành cân đối 100%; tự động sinh phiếu nhập kho thành phẩm đúng giá trị", "Kế toán trưởng + Lập trình"),
        ("V1.1 (Tháng 12/2026)", "W13 (14–18/12)", "Lương & Nhân sự", "Bảng chấm công tự động, tính lương theo ngày công/KPI, tự động trích BHXH, BHYT và tính Thuế TNCN lũy tiến", "Kế toán tiền lương chỉ mất 15 phút để ra bảng lương tháng thay vì cộng Excel thủ công", "Bảng lương tự động tính đúng biểu thuế TNCN và sinh phiếu hạch toán chi phí lương", "Kế toán lương + Giao diện"),
        
        # Giai đoạn V1.2
        ("V1.2 (Tháng 01/2027)", "W14 (21–25/12)", "Khóa sổ năm tài chính", "Thực hiện quy trình khóa sổ năm 2026: kết chuyển doanh thu, chi phí, xác định kết quả kinh doanh (911) và chuyển số dư sang 2027", "Đảm bảo số liệu tài chính năm cũ được chốt an toàn, sẵn sàng cho năm tài chính mới", "Bảng cân đối phát sinh năm 2026 khớp đúng tuyệt đối; số dư đầu kỳ năm 2027 chuẩn xác", "Kế toán trưởng"),
        ("V1.2 (Tháng 01/2027)", "W15 (28/12–02/01)", "Hóa đơn điện tử API", "Kết nối hệ thống hóa đơn điện tử của VNPT, Viettel, MISA meInvoice: xuất hóa đơn có mã/không mã trực tiếp từ đơn bán hàng", "Xuất hóa đơn điện tử tức thời cho khách hàng mà không cần mở phần mềm hóa đơn ngoài", "Bấm 'Phát hành hóa đơn' trên màn hình bán hàng, hóa đơn được cấp mã thuế thành công", "Lập trình hệ thống"),
        ("V1.2 (Tháng 01/2027)", "W16 (04–08/01)", "Cổng nộp thuế TVAN", "Kết nối dịch vụ nộp thuế điện tử T-VAN: cắm Token chữ ký số, ký số tờ khai GTGT, TNCN, TNDN và nộp thẳng lên cơ quan thuế", "Doanh nghiệp nộp tờ khai thuế trực tuyến ngay trên phần mềm, nhận thông báo tiếp nhận của thuế tự động", "Tờ khai nộp thành công và nhận mã xác nhận hợp lệ từ hệ thống Tổng cục Thuế", "Lập trình + Kế toán thuế"),
        ("V1.2 (Tháng 01/2027)", "W17 (11–15/01)", "Ngân hàng điện tử", "Kết nối Open Banking với Vietcombank, MB, Techcombank, BIDV: tự động tải lịch sử giao dịch và số dư về phần mềm mỗi sáng", "Loại bỏ hoàn toàn công việc gõ tay từng giao dịch chuyển tiền từ sổ phụ ngân hàng vào phần mềm", "Số dư trên phần mềm khớp 100% với số dư thực tế tại ngân hàng mà không cần gõ tay", "Lập trình hệ thống"),
        ("V1.2 (Tháng 01/2027)", "W18 (18–22/01)", "Báo cáo quản trị Sếp", "Xây dựng bảng điều khiển quản trị tài chính cho Giám đốc: cảnh báo công nợ quá hạn, biểu đồ thu chi và dự báo dòng tiền 30 ngày", "Ban Giám đốc nắm chắc nguồn tiền và tình hình sức khỏe công ty trước kỳ nghỉ Tết", "Biểu đồ trực quan, cập nhật số liệu thời gian thực theo từng giờ", "Giao diện + Kế toán trưởng"),
        
        # Giai đoạn V2.0
        ("V2.0 (Sau Tết - Q1/2027)", "W19 (08–12/02)", "Trí tuệ nhân tạo (AI)", "Xây dựng công nghệ AI đọc và bóc tách thông tin hóa đơn (OCR): tự động đọc file PDF hoặc ảnh chụp (MST, ngày, tên hàng, tiền thuế)", "Kế toán chỉ cần kéo thả file hóa đơn vào phần mềm là thông tin tự điền vào các ô", "Tỷ lệ nhận diện đúng thông tin hóa đơn đạt trên 95% với các mẫu hóa đơn phổ biến", "Nhóm AI / Công nghệ"),
        ("V2.0 (Sau Tết - Q1/2027)", "W20 (15–19/02)", "Trí tuệ nhân tạo (AI)", "Huấn luyện AI tự động học thói quen định khoản của kế toán để gợi ý tài khoản Nợ/Có chuẩn xác cho từng mặt hàng", "Kế toán mới vào nghề cũng hạch toán đúng như kế toán trưởng, giảm 80% thời gian nhập liệu", "AI gợi ý đúng tài khoản kế toán phù hợp với danh mục tài khoản của công ty", "Nhóm AI + Kế toán"),
        ("V2.0 (Sau Tết - Q1/2027)", "W21 (22–26/02)", "App điện thoại Giám đốc", "Phát triển ứng dụng Mobile Sổ Việt ERP (iOS & Android): xem báo cáo doanh thu, chi phí, tồn kho và tiền mặt/ngân hàng", "Giám đốc đi công tác xa vẫn mở điện thoại ra là biết ngay hôm nay công ty thu bao nhiêu, chi bao nhiêu", "App mở nhanh, bảo mật bằng vân tay/FaceID, giao diện trực quan dễ nhìn", "Nhóm Lập trình Mobile"),
        ("V2.0 (Sau Tết - Q1/2027)", "W22 (01–05/03)", "App điện thoại Giám đốc", "Tính năng phê duyệt online trên điện thoại: Giám đốc nhận thông báo và bấm Duyệt/Từ chối phiếu chi tiền hoặc đơn mua hàng", "Quy trình duyệt chi thông suốt, kế toán không phải chờ Giám đốc về ký giấy", "Bấm duyệt trên điện thoại, trạng thái phiếu trên máy tính kế toán lập tức chuyển sang 'Đã duyệt'", "Nhóm Lập trình Mobile"),
        ("V2.0 (Sau Tết - Q1/2027)", "W23 (08–12/03)", "Kiểm toán tự động (Audit AI)", "Xây dựng công cụ quét tự động phát hiện lỗi: âm kho, định khoản tài khoản trái quy tắc, sót hóa đơn, chênh lệch bảng kê", "Phát hiện và cảnh báo trước mọi sai sót kế toán để sửa chữa kịp thời trước khi cơ quan thuế kiểm tra", "Báo cáo kiểm tra rà soát chỉ rõ từng chứng từ bị nghi vấn sai sót kèm hướng dẫn sửa", "Nhóm AI + Kế toán trưởng"),
        ("V2.0 (Sau Tết - Q1/2027)", "W24–25 (15–26/03)", "Đóng gói & Thương mại hóa", "Kiểm thử toàn diện, tối ưu bảo mật, đóng gói hệ thống và chính thức công bố phiên bản V2.0 ra thị trường", "Sổ Việt ERP trở thành nền tảng quản trị tài chính - kế toán - thuế thông minh toàn diện", "Toàn bộ hệ thống vận hành mượt mà, tài liệu và video hướng dẫn sử dụng đầy đủ", "Toàn bộ Đội ngũ")
    ]
    
    for r_idx, r_data in enumerate(post_details, start=5):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws2.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 2, 7] else cell_font
            c.border = thin_border
            c.alignment = align_center if c_idx in [1, 2, 7] else align_left
            if "V1.1" in val: c.fill = v11_fill
            elif "V1.2" in val: c.fill = v12_fill
            elif "V2.0" in val: c.fill = v20_fill

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
    print(f"Generated complete detailed plan: {out_file}")

if __name__ == "__main__":
    build_full_detailed_plan()
