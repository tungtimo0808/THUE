import openpyxl
import sys
sys.stdout.reconfigure(encoding='utf-8')
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def create_excel_plan():
    wb = openpyxl.Workbook()
    # remove default sheet later
    default_sheet = wb.active
    
    # Define styles
    font_family = "Segoe UI"
    
    title_font = Font(name=font_family, size=16, bold=True, color="1F497D")
    subtitle_font = Font(name=font_family, size=11, italic=True, color="595959")
    section_font = Font(name=font_family, size=12, bold=True, color="1F497D")
    header_font = Font(name=font_family, size=11, bold=True, color="FFFFFF")
    cell_font = Font(name=font_family, size=10, color="000000")
    bold_cell_font = Font(name=font_family, size=10, bold=True, color="000000")
    kpi_num_font = Font(name=font_family, size=14, bold=True, color="1F497D")
    
    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    subheader_fill = PatternFill(start_color="2980B9", end_color="2980B9", fill_type="solid")
    kpi_fill = PatternFill(start_color="F2F5F9", end_color="F2F5F9", fill_type="solid")
    alt_fill = PatternFill(start_color="F9FAFC", end_color="F9FAFC", fill_type="solid")
    done_fill = PatternFill(start_color="E8F8F5", end_color="E8F8F5", fill_type="solid")
    doing_fill = PatternFill(start_color="FEF9E7", end_color="FEF9E7", fill_type="solid")
    plan_fill = PatternFill(start_color="EBF5FB", end_color="EBF5FB", fill_type="solid")
    
    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )
    kpi_border = Border(
        left=Side(style='medium', color='1F497D'),
        right=Side(style='medium', color='1F497D'),
        top=Side(style='medium', color='1F497D'),
        bottom=Side(style='medium', color='1F497D')
    )
    
    align_center = Alignment(horizontal='center', vertical='center', wrap_text=True)
    align_left = Alignment(horizontal='left', vertical='center', wrap_text=True)
    align_right = Alignment(horizontal='right', vertical='center', wrap_text=True)

    # -------------------------------------------------------------
    # SHEET 1: 00_TONG_QUAN (Dashboard)
    # -------------------------------------------------------------
    ws0 = wb.create_sheet(title="00_TONG_QUAN")
    ws0.views.sheetView[0].showGridLines = True
    
    ws0.merge_cells("A1:G1")
    ws0["A1"] = "HỆ THỐNG PHẦN MỀM KẾ TOÁN & THUẾ DOANH NGHIỆP (SỔ VIỆT ERP)"
    ws0["A1"].font = title_font
    ws0["A1"].alignment = align_left
    
    ws0.merge_cells("A2:G2")
    ws0["A2"] = "KẾ HOẠCH TRIỂN KHAI 2 THÁNG (21/09/2026 → 20/11/2026) • MỤC TIÊU: HOÀN THÀNH PHIÊN BẢN VẬN HÀNH MVP ĐỂ NGHIỆM THU"
    ws0["A2"].font = subtitle_font
    ws0["A2"].alignment = align_left
    
    # KPI Cards
    kpis = [
        ("MỐC VỀ ĐÍCH MVP", "20/11/2026", "A4:B4", "A5:B5", "A4", "A5"),
        ("MỨC ĐỘ HOÀN THÀNH", "≈ 85% (Theo Git)", "C4:D4", "C5:D5", "C4", "C5"),
        ("THỜI GIAN CÒN LẠI", "15 Ngày (2 Tuần)", "E4:E4", "E5:E5", "E4", "E5"),
        ("NGUYÊN TẮC THỰC THI", "Làm chuẩn - Đủ dùng - Chắc chắn", "F4:G4", "F5:G5", "F4", "F5")
    ]
    for top_label, val, m1, m2, c1, c2 in kpis:
        ws0.merge_cells(m1)
        ws0.merge_cells(m2)
        ws0[c1] = top_label
        ws0[c1].font = Font(name=font_family, size=9, bold=True, color="595959")
        ws0[c1].alignment = align_center
        ws0[c1].fill = kpi_fill
        ws0[c2] = val
        ws0[c2].font = kpi_num_font
        ws0[c2].alignment = align_center
        ws0[c2].fill = kpi_fill
        
    for r in range(4, 6):
        for c in range(1, 8):
            ws0.cell(r, c).border = thin_border
            
    # 4 Key Decisions
    ws0.cell(7, 1, "4 QUYẾT ĐỊNH QUAN TRỌNG ĐỂ ĐẢM BẢO HOÀN THÀNH ĐÚNG NGÀY 20/11").font = section_font
    
    decisions = [
        ("1. Không thay đổi nền tảng kỹ thuật", "Giữ nguyên nền tảng công nghệ đang phát triển ổn định; tuyệt đối không thay đổi giữa chừng để tập trung 100% sức lực vào hoàn thiện tính năng nghiệp vụ kế toán."),
        ("2. Chốt chặt danh sách tính năng (Freeze Scope)", "Tập trung giải quyết trọn vẹn các bài toán nghiệp vụ kế toán cốt lõi bắt buộc phải có cho ngày 20/11. Mọi đề xuất phát sinh mới không cấp bách đều chuyển sang bản cập nhật tiếp theo (V1.1)."),
        ("3. Hoàn thiện tính năng nào chắc chắn tính năng đó", "Mỗi nghiệp vụ (từ Mua hàng, Bán hàng, Kho, Tiền đến Sổ sách) khi đưa lên màn hình đều phải có lưu trữ số liệu thực tế, kiểm tra phân quyền chặt chẽ, tự động sinh phiếu kế toán chuẩn xác và khớp số liệu ngay lập tức."),
        ("4. Tạm hoãn các tính năng phức tạp chưa cần ngay", "Các tính năng như kết nối trực tiếp với cổng cơ quan thuế (TVAN), trợ lý AI, tính lương nâng cao hay dây chuyền sản xuất phức tạp sẽ chuyển sang giai đoạn sau để dồn sức cho kế toán vận hành trơn tru.")
    ]
    
    for idx, (title, desc) in enumerate(decisions, start=8):
        ws0.cell(idx, 1, title).font = bold_cell_font
        ws0.cell(idx, 1).alignment = align_left
        ws0.cell(idx, 1).border = thin_border
        ws0.merge_cells(start_row=idx, start_column=2, end_row=idx, end_column=7)
        c = ws0.cell(idx, 2, desc)
        c.font = cell_font
        c.alignment = align_left
        for col_i in range(2, 8):
            ws0.cell(idx, col_i).border = thin_border
            
    # Roadmap Summary
    ws0.cell(13, 1, "TÓM TẮT LỘ TRÌNH 9 TUẦN (TỪ KHỞI ĐẦU ĐẾN NGÀY VỀ ĐÍCH 20/11)").font = section_font
    
    rm_headers = ["Tuần", "Khoảng thời gian", "Giai đoạn", "Mục tiêu trọng tâm", "Kết quả thực tế đạt được", "Tiến độ", "Trạng thái"]
    for c_idx, h_text in enumerate(rm_headers, start=1):
        c = ws0.cell(14, c_idx, h_text)
        c.font = header_font
        c.fill = header_fill
        c.alignment = align_center
        c.border = thin_border
        
    rm_rows = [
        ("W1", "21/09 – 27/09", "Khởi động & Định hình", "Xây dựng khung phần mềm, thiết kế giao diện theo mẫu Figma", "Khởi tạo mã nguồn dự án, đưa mẫu thiết kế vào giao diện ban đầu", "100%", "ĐÃ XONG"),
        ("W2", "28/09 – 04/10", "Khảo sát nghiệp vụ", "Khảo sát biểu mẫu kế toán, danh mục tài khoản, quy tắc chứng từ", "Chuẩn hóa danh mục khách hàng, nhà cung cấp, vật tư và quy tắc kiểm tra", "100%", "ĐÃ XONG"),
        ("W3", "05/10 – 11/10", "Biểu mẫu & Tiền mặt", "Bổ sung mẫu in báo cáo tiếng Việt, phân hệ Quản lý Tiền mặt & Ngân hàng", "Hoàn thiện mẫu in công nợ, hợp đồng; luồng phiếu thu/chi, đối chiếu sổ phụ", "100%", "ĐÃ XONG"),
        ("W4", "12/10 – 18/10", "Kết nối dữ liệu thật", "Đưa cơ sở dữ liệu thật vào 13 phân hệ, kích hoạt tài khoản đăng nhập", "Thay thế dữ liệu tĩnh, kết nối dữ liệu thật vào màn hình Mua, Bán, Thuế, Báo cáo", "100%", "ĐÃ XONG"),
        ("W5", "19/10 – 25/10", "Chuẩn MISA & TT 99", "Đồng bộ giao diện chuẩn MISA, áp dụng TT 99/2025, thử nghiệm số liệu thật", "Đổi nhận diện Sổ Việt ERP, nạp dữ liệu công ty mẫu (ABC) vào chạy thử", "100%", "ĐÃ XONG"),
        ("W6", "26/10 – 01/11", "Đợt cao điểm - BCTC", "Lập BCTC TT 133, quản lý nhiều công ty, tài sản cố định, tối ưu tốc độ", "Đưa lên máy chủ thử nghiệm, hoàn thành BCTC TT133, đa công ty, nút Lưu & In", "100%", "ĐÃ XONG"),
        ("W7", "02/11 – 08/11", "Chuẩn hóa & Khớp số", "Chế độ kế toán TT 58, 21 vai trò kế toán, khớp số liệu Nợ=Có, xuất báo cáo", "Khớp đối chiếu sổ sách khép kín, xuất Excel/PDF, khóa cố định thanh điều khiển", "85%", "ĐANG LÀM"),
        ("W8", "09/11 – 15/11", "Thử nghiệm toàn diện", "Kiểm tra tải nhiều người dùng, tự động sao lưu dữ liệu, nhập liệu Excel", "Chạy thử thực tế toàn bộ quy trình, kiểm tra tính an toàn và khôi phục dữ liệu", "0%", "KẾ HOẠCH"),
        ("W9", "16/11 – 20/11", "Nghiệm thu & Bàn giao", "Người dùng thực tế nghiệm thu (UAT), xử lý góp ý cuối, bàn giao MVP", "Hoàn tất hướng dẫn sử dụng, chốt bản phát hành chính thức ngày 20/11/2026", "0%", "KẾ HOẠCH"),
    ]
    
    for r_idx, r_data in enumerate(rm_rows, start=15):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws0.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 6, 7] else cell_font
            c.border = thin_border
            if c_idx in [1, 2, 6, 7]:
                c.alignment = align_center
            else:
                c.alignment = align_left
            # fill status
            if val == "ĐÃ XONG":
                c.fill = done_fill
            elif val == "ĐANG LÀM":
                c.fill = doing_fill
            elif val == "KẾ HOẠCH":
                c.fill = plan_fill

    # Conditions
    start_cond = 25
    ws0.cell(start_cond, 1, "ĐIỀU KIỆN ĐẢM BẢO HOÀN THÀNH DỰ ÁN ĐÚNG HẠN").font = section_font
    conds = [
        ("Nguồn lực tập trung", "Đội ngũ phát triển tập trung 100% thời gian cho dự án Kế toán - Thuế, không bị phân tán sang các dự án khác."),
        ("Tiêu chí hoàn thành (Definition of Done)", "Một tính năng chỉ được tính là 'Hoàn thành' khi: người dùng nhập được số liệu thật, phần mềm tự kiểm tra tính đúng đắn, sinh phiếu kế toán chính xác, số liệu vào sổ sách cân đối và in được báo cáo."),
        ("Nguyên tắc xử lý tình huống", "Nếu gặp khó khăn về thời gian, sẽ linh hoạt tạm hoãn các chi tiết hiển thị thứ yếu; tuyệt đối không cắt giảm tiêu chuẩn an toàn dữ liệu và tính chính xác của sổ sách kế toán.")
    ]
    for idx, (title, desc) in enumerate(conds, start=start_cond+1):
        ws0.cell(idx, 1, title).font = bold_cell_font
        ws0.cell(idx, 1).alignment = align_left
        ws0.cell(idx, 1).border = thin_border
        ws0.merge_cells(start_row=idx, start_column=2, end_row=idx, end_column=7)
        c = ws0.cell(idx, 2, desc)
        c.font = cell_font
        c.alignment = align_left
        for col_i in range(2, 8):
            ws0.cell(idx, col_i).border = thin_border


    # -------------------------------------------------------------
    # SHEET 2: 01_LO_TRINH_9_TUAN
    # -------------------------------------------------------------
    ws1 = wb.create_sheet(title="01_LO_TRINH_9_TUAN")
    ws1.views.sheetView[0].showGridLines = True
    
    ws1.merge_cells("A1:H1")
    ws1["A1"] = "LỘ TRÌNH CHI TIẾT 9 TUẦN TỪ BẮT ĐẦU ĐẾN NGÀY VỀ ĐÍCH 20/11/2026"
    ws1["A1"].font = title_font
    
    headers1 = [
        "Tuần", "Thời gian", "Giai đoạn", "Mục tiêu tuần", 
        "Nghiệp vụ kế toán hoàn thành", "Giao diện người dùng hoàn thành", 
        "Tiêu chuẩn nghiệm thu tuần", "Trạng thái thực tế"
    ]
    for c_idx, h_text in enumerate(headers1, start=1):
        c = ws1.cell(3, c_idx, h_text)
        c.font = header_font
        c.fill = header_fill
        c.alignment = align_center
        c.border = thin_border
        
    roadmap_detailed = [
        (
            "Tuần 1", "21/09 – 27/09", "Khởi động & Định hình",
            "Thiết lập nền tảng dự án và dựng khung giao diện làm việc chung",
            "Khảo sát các vai trò trong phòng kế toán (Kế toán trưởng, Kế toán bán hàng, Mua hàng, Thủ quỹ, Thủ kho).",
            "Dựng giao diện khung chuẩn Figma: Phân hệ Kế toán, Thuế, Quản lý kho.",
            "Có được khung màn hình làm việc chung để các bộ phận thống nhất cách sắp xếp.",
            "ĐÃ HOÀN THÀNH"
        ),
        (
            "Tuần 2", "28/09 – 04/10", "Khảo sát nghiệp vụ",
            "Chuẩn hóa danh mục dùng chung và quy trình chứng từ mua/bán",
            "Quy định các trường thông tin bắt buộc cho Danh mục Khách hàng, Nhà cung cấp, Hàng hóa, Mã thuế.",
            "Màn hình danh mục, mẫu phiếu thu/chi và chứng từ mua hàng ban đầu.",
            "Thống nhất tài liệu yêu cầu nghiệp vụ chi tiết làm kim chỉ nam triển khai.",
            "ĐÃ HOÀN THÀNH"
        ),
        (
            "Tuần 3", "05/10 – 11/10", "Biểu mẫu & Tiền mặt",
            "Thiết kế biểu mẫu in ấn tiếng Việt và phân hệ Quản lý Tiền mặt - Ngân hàng",
            "Nghiệp vụ lập phiếu thu, phiếu chi, chuyển tiền nội bộ và nhập số dư sổ phụ ngân hàng để đối chiếu.",
            "Biểu mẫu in phiếu thu/chi, thông báo nợ, biên bản đối chiếu công nợ và hợp đồng mua bán.",
            "Người dùng kế toán có thể nhập thử phiếu thu/chi và in các biểu mẫu ra giấy/PDF.",
            "ĐÃ HOÀN THÀNH"
        ),
        (
            "Tuần 4", "12/10 – 18/10", "Dữ liệu thật 13 phân hệ",
            "Đưa cơ sở dữ liệu thật vào toàn bộ 13 phân hệ và hoàn thiện đăng nhập",
            "Lưu trữ dữ liệu thật cho Mua hàng, Bán hàng, Công nợ, Kho, Thuế; cơ chế phân quyền tài khoản người dùng.",
            "Kết nối toàn bộ 13 phân hệ màn hình với cơ sở dữ liệu thật; màn hình Đăng ký / Đăng nhập tiện lợi.",
            "Loại bỏ dữ liệu giả; toàn bộ các màn hình hiển thị dữ liệu thật lưu trong hệ thống.",
            "ĐÃ HOÀN THÀNH"
        ),
        (
            "Tuần 5", "19/10 – 25/10", "Chuẩn MISA & TT 99",
            "Đồng bộ giao diện chuẩn MISA, áp dụng Thông tư 99 và thử nghiệm dữ liệu thực tế",
            "Áp dụng quy chuẩn kế toán theo Thông tư 99/2025/TT-BTC; đưa dữ liệu doanh nghiệp mẫu (công ty ABC) vào kiểm thử.",
            "Chuẩn hóa giao diện nhận diện thương hiệu Sổ Việt ERP; vẽ sơ đồ quy trình nghiệp vụ trực quan dễ hiểu.",
            "Quy trình Mua hàng → Kho → Thanh toán chạy trơn tru với bộ chứng từ thực tế của doanh nghiệp mẫu.",
            "ĐÃ HOÀN THÀNH"
        ),
        (
            "Tuần 6", "26/10 – 01/11", "Đợt cao điểm - BCTC",
            "Hoàn thiện BCTC Thông tư 133, quản lý nhiều công ty, tài sản cố định và tăng tốc độ",
            "Trọn bộ Báo cáo tài chính TT 133; quản lý Tài sản cố định (trích khấu hao tự động), Công cụ dụng cụ; nhập số dư đầu kỳ.",
            "Giao diện quản lý nhiều công ty độc lập; các nút thao tác kế toán chuyên nghiệp (Lưu & Thêm, Lưu & In).",
            "Hệ thống tự động đưa lên máy chủ thử nghiệm, tải trang nhanh tức thì, không bị chậm giật.",
            "ĐÃ HOÀN THÀNH"
        ),
        (
            "Tuần 7", "02/11 – 08/11", "Chuẩn hóa & Khớp số",
            "Tích hợp Thông tư 58, 21 vai trò kế toán, kiểm tra khớp số liệu Nợ=Có và xuất báo cáo",
            "Bổ sung chế độ kế toán Thông tư 58; thiết lập 21 vai trò quyền hạn; kiểm tra đối chiếu sổ sách khép kín đảm bảo Nợ = Có.",
            "Màn hình xem Báo cáo động trực tiếp, xuất file đa dạng (Excel, PDF, In); cố định thanh tiêu đề không bị giật màn hình.",
            "Số liệu kế toán hoàn toàn chính xác, dữ liệu các công ty hoàn toàn độc lập và an toàn.",
            "ĐANG THỰC HIỆN (85%)"
        ),
        (
            "Tuần 8", "09/11 – 15/11", "Thử nghiệm toàn diện",
            "Thử nghiệm đồng thời nhiều người dùng, tự động sao lưu dữ liệu và hỗ trợ nhập khẩu Excel",
            "Kiểm tra tính an toàn dữ liệu, chống ghi đúp số liệu; hoàn thiện công cụ nhập khẩu danh mục và số dư từ file Excel.",
            "Kiểm tra giao diện trên các kích thước màn hình máy tính khác nhau của phòng kế toán; hoàn thiện thông báo nhắc lỗi dễ hiểu.",
            "Hệ thống vận hành ổn định, nhập liệu mượt mà, sẵn sàng cho công tác nghiệm thu.",
            "KẾ HOẠCH BẮT BUỘC"
        ),
        (
            "Tuần 9", "16/11 – 20/11", "Nghiệm thu & Bàn giao",
            "Nghiệm thu người dùng thực tế (UAT), xử lý các góp ý nhỏ cuối cùng và bàn giao bản MVP",
            "Kế toán trưởng và người dùng thực tế kiểm tra toàn bộ luồng nghiệp vụ; xử lý nhanh các vướng mắc phát sinh.",
            "Bàn giao hệ thống hoàn chỉnh cùng tài liệu hướng dẫn sử dụng nhanh cho người dùng.",
            "Chính thức bàn giao phiên bản MVP đi vào hoạt động thực tế vào đúng ngày 20/11/2026.",
            "MỤC TIÊU VỀ ĐÍCH"
        )
    ]
    
    for r_idx, r_data in enumerate(roadmap_detailed, start=4):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws1.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 2, 8] else cell_font
            c.border = thin_border
            if c_idx in [1, 2, 8]:
                c.alignment = align_center
            else:
                c.alignment = align_left
            if "ĐÃ HOÀN THÀNH" in val:
                c.fill = done_fill
            elif "ĐANG THỰC HIỆN" in val:
                c.fill = doing_fill
            elif "KẾ HOẠCH" in val or "MỤC TIÊU" in val:
                c.fill = plan_fill


    # -------------------------------------------------------------
    # SHEET 3: 02_NHAT_KY_VA_CONG_VIEC
    # -------------------------------------------------------------
    ws2 = wb.create_sheet(title="02_NHAT_KY_VA_CONG_VIEC")
    ws2.views.sheetView[0].showGridLines = True
    
    ws2.merge_cells("A1:G1")
    ws2["A1"] = "CHI TIẾT CÔNG VIỆC THEO MỐC THỜI GIAN (DỰA TRÊN 124 COMMIT THỰC TẾ & KẾ HOẠCH 20/11)"
    ws2["A1"].font = title_font
    
    headers2 = ["Giai đoạn", "Thời gian", "Bộ phận phụ trách", "Nội dung công việc dễ hiểu", "Kết quả thực tế trong phần mềm", "Mức độ quan trọng", "Trạng thái"]
    for c_idx, h_text in enumerate(headers2, start=1):
        c = ws2.cell(3, c_idx, h_text)
        c.font = header_font
        c.fill = header_fill
        c.alignment = align_center
        c.border = thin_border
        
    tasks_data = [
        # W1 & W2
        ("Giai đoạn 1: Khởi động", "21–25/09", "Thiết kế & Nghiệp vụ", "Dựng khung giao diện tổng quan và khảo sát quy trình kế toán", "Có khung phần mềm chuẩn Figma, bố cục các menu chức năng", "Bắt buộc", "ĐÃ XONG"),
        ("Giai đoạn 1: Khởi động", "28/09–02/10", "Nghiệp vụ kế toán", "Chuẩn hóa các trường thông tin cho Danh mục & Chứng từ kế toán", "Hồ sơ yêu cầu chi tiết cho Khách hàng, NCC, Kho, Mua/Bán", "Bắt buộc", "ĐÃ XONG"),
        
        # W3
        ("Giai đoạn 2: Biểu mẫu & Thu Chi", "05/10–06/10", "Kỹ thuật & Nghiệp vụ", "Thiết lập phân quyền đăng nhập và cơ chế quản lý theo từng công ty", "Đăng nhập an toàn, phân chia ranh giới dữ liệu từng doanh nghiệp", "Bắt buộc", "ĐÃ XONG"),
        ("Giai đoạn 2: Biểu mẫu & Thu Chi", "07/10–08/10", "Giao diện & Nghiệp vụ", "Thiết kế mẫu in tiếng Việt: Phiếu thu, chi, công nợ, hợp đồng", "In ấn trực tiếp ra giấy hoặc file PDF chuẩn mẫu quy định", "Bắt buộc", "ĐÃ XONG"),
        ("Giai đoạn 2: Biểu mẫu & Thu Chi", "09/10–11/10", "Kế toán & Kỹ thuật", "Phân hệ Tiền mặt - Tiền gửi: Lập phiếu thu chi, nhập sổ phụ ngân hàng", "Quản lý dòng tiền, theo dõi tồn quỹ tiền mặt và tiền gửi ngân hàng", "Bắt buộc", "ĐÃ XONG"),
        
        # W4
        ("Giai đoạn 3: Dữ liệu thật 13 phân hệ", "12/10–15/10", "Kỹ thuật hệ thống", "Xây dựng cơ sở dữ liệu thật cho Mua hàng, Bán hàng, Kho, Thuế, Báo cáo", "Thay thế dữ liệu tĩnh, hệ thống sẵn sàng lưu trữ chứng từ thực", "Bắt buộc", "ĐÃ XONG"),
        ("Giai đoạn 3: Dữ liệu thật 13 phân hệ", "16/10–18/10", "Giao diện & Nghiệp vụ", "Kết nối toàn bộ 13 phân hệ màn hình với cơ sở dữ liệu thật", "Người dùng tạo mới, sửa, xóa, tìm kiếm được trên dữ liệu thật", "Bắt buộc", "ĐÃ XONG"),
        
        # W5
        ("Giai đoạn 4: Chuẩn MISA & TT 99", "19/10–21/10", "Thiết kế & Giao diện", "Chuẩn hóa giao diện gọn gàng theo chuẩn MISA / Sổ Việt ERP", "Bảng biểu thu gọn, sơ đồ quy trình nghiệp vụ trực quan", "Bắt buộc", "ĐÃ XONG"),
        ("Giai đoạn 4: Chuẩn MISA & TT 99", "22/10–25/10", "Kế toán & Kỹ thuật", "Áp dụng Thông tư 99 và nạp dữ liệu thực tế công ty ABC để chạy thử", "Chạy thông suốt chu trình Mua hàng → Nhập kho → Trả tiền", "Bắt buộc", "ĐÃ XONG"),
        
        # W6
        ("Giai đoạn 5: Cao điểm BCTC & Đa công ty", "26/10–27/10", "Hạ tầng & Triển khai", "Đưa hệ thống lên máy chủ thử nghiệm tự động, tối ưu tốc độ mở trang", "Hệ thống mở tức thì, phản hồi nhanh, không bị giật lag", "Bắt buộc", "ĐÃ XONG"),
        ("Giai đoạn 5: Cao điểm BCTC & Đa công ty", "28/10–29/10", "Nghiệp vụ kế toán", "Hoàn thiện Tài sản cố định (khấu hao), Công cụ dụng cụ & Số dư đầu kỳ", "Tự động trích khấu hao hàng tháng, nhập số dư ban đầu", "Bắt buộc", "ĐÃ XONG"),
        ("Giai đoạn 5: Cao điểm BCTC & Đa công ty", "30/10–01/11", "Kế toán & Báo cáo", "Tích hợp Báo cáo tài chính theo TT 133 và Quản lý nhiều công ty độc lập", "Bộ BCTC chuẩn Thông tư 133; chuyển đổi linh hoạt giữa các công ty", "Bắt buộc", "ĐÃ XONG"),
        
        # W7 (Hôm nay 05/11)
        ("Giai đoạn 6: Hoàn thiện & Khớp số", "02/11–04/11", "Nghiệp vụ & Pháp lý", "Bổ sung Chế độ kế toán TT 58, 21 vai trò quyền hạn và Luật dữ liệu cá nhân", "Đa dạng chế độ kế toán; phân quyền chi tiết từng nhân viên", "Bắt buộc", "ĐÃ XONG"),
        ("Giai đoạn 6: Hoàn thiện & Khớp số", "05/11–06/11", "Kế toán & Báo cáo", "Nâng cấp xem Báo cáo động trực tiếp, xuất Excel/PDF/In; khóa thanh điều khiển", "Xem báo cáo tức thì, xuất dữ liệu đẹp mắt, thao tác không giật chuột", "Bắt buộc", "ĐANG LÀM"),
        ("Giai đoạn 6: Hoàn thiện & Khớp số", "07/11–08/11", "Kiểm thử kế toán", "Kiểm tra đối chiếu sổ sách khép kín, đảm bảo Bảng cân đối luôn khớp Nợ=Có", "Loại bỏ hoàn toàn sai lệch số liệu giữa sổ chi tiết và sổ cái", "Bắt buộc", "ĐANG LÀM"),
        
        # W8
        ("Giai đoạn 7: Thử nghiệm toàn diện", "09/11–11/11", "Kỹ thuật & An toàn", "Kiểm tra chịu tải nhiều người cùng dùng và cơ chế tự động sao lưu dữ liệu", "Phần mềm chạy ổn định, tự động sao lưu phòng sự cố mất dữ liệu", "Bắt buộc", "KẾ HOẠCH"),
        ("Giai đoạn 7: Thử nghiệm toàn diện", "12/11–15/11", "Nghiệp vụ & Hỗ trợ", "Hoàn thiện công cụ tải file Excel danh mục & số dư đầu kỳ vào phần mềm", "Kế toán chỉ cần copy file Excel là nạp được danh mục và số dư", "Bắt buộc", "KẾ HOẠCH"),
        
        # W9
        ("Giai đoạn 8: Nghiệm thu & Bàn giao", "16/11–18/11", "Người dùng & Kế toán", "Tổ chức kiểm thử nghiệm thu thực tế (UAT) với kế toán doanh nghiệp", "Kế toán thao tác trên chứng từ thực tế, ghi nhận và xử lý góp ý", "Bắt buộc", "KẾ HOẠCH"),
        ("Giai đoạn 8: Nghiệm thu & Bàn giao", "19/11–20/11", "Toàn đội ngũ", "Hoàn tất tài liệu hướng dẫn và chính thức bàn giao phiên bản MVP", "Phần mềm sẵn sàng vận hành chính thức phục vụ công tác kế toán", "Bắt buộc", "VỀ ĐÍCH 20/11")
    ]
    
    for r_idx, r_data in enumerate(tasks_data, start=4):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws2.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 2, 7] else cell_font
            c.border = thin_border
            if c_idx in [1, 2, 6, 7]:
                c.alignment = align_center
            else:
                c.alignment = align_left
            if "ĐÃ XONG" in val:
                c.fill = done_fill
            elif "ĐANG LÀM" in val:
                c.fill = doing_fill
            elif "KẾ HOẠCH" in val or "VỀ ĐÍCH" in val:
                c.fill = plan_fill


    # -------------------------------------------------------------
    # SHEET 4: 03_PHAM_VI_CAC_PHAN_HE
    # -------------------------------------------------------------
    ws3 = wb.create_sheet(title="03_PHAM_VI_CAC_PHAN_HE")
    ws3.views.sheetView[0].showGridLines = True
    
    ws3.merge_cells("A1:G1")
    ws3["A1"] = "PHẠM VI CÁC PHÂN HỆ NGHIỆP VỤ (PHIÊN BẢN MVP 20/11 SO VỚI GIAI ĐOẠN SAU)"
    ws3["A1"].font = title_font
    
    headers3 = [
        "Phân hệ nghiệp vụ", "Các tính năng BẮT BUỘC có trong bản MVP (20/11)", 
        "Lợi ích mang lại cho doanh nghiệp", "Mức độ hoàn thành hiện tại", 
        "Tính năng TẠM HOÃN sang bản sau (V1.1)", "Điều kiện để nghiệm thu phân hệ", "Bộ phận chịu trách nhiệm"
    ]
    for c_idx, h_text in enumerate(headers3, start=1):
        c = ws3.cell(3, c_idx, h_text)
        c.font = header_font
        c.fill = header_fill
        c.alignment = align_center
        c.border = thin_border
        
    modules_scope = [
        (
            "1. Quản lý Hệ thống & Đa Công ty",
            "Tạo nhiều công ty độc lập; phân quyền theo vai trò (Admin, Kế toán trưởng, Kế toán viên, Thủ quỹ, Thủ kho); chuyển đổi công ty linh hoạt; lưu nhật ký thao tác.",
            "Một phần mềm quản lý được nhiều công ty, bảo mật tuyệt đối, không lo xem nhầm số liệu của nhau.",
            "90% (Đã xong)",
            "Đăng nhập một lần nâng cao (SSO phức tạp), tự động tính cước thuê bao.",
            "Đăng nhập mượt mà, phân quyền chính xác, công ty nào chỉ thấy dữ liệu công ty đó.",
            "Kỹ thuật hệ thống + Nghiệp vụ"
        ),
        (
            "2. Danh mục Dùng chung",
            "Quản lý Khách hàng, Nhà cung cấp, Nhân viên, Kho hàng, Hàng hóa - Dịch vụ, Tài khoản ngân hàng, Hệ thống tài khoản kế toán, Thuế suất.",
            "Chuẩn hóa dữ liệu toàn công ty, tránh trùng lặp mã số thuế hoặc tên đối tác, tìm kiếm nhanh chóng.",
            "95% (Đã xong)",
            "Tự động đồng bộ danh bạ từ nhiều phần mềm ngoài khác nhau.",
            "Thêm mới, sửa, xóa, tìm kiếm nhanh và kiểm tra trùng mã số thuế tự động.",
            "Giao diện + Nghiệp vụ"
        ),
        (
            "3. Quy trình Chứng từ & Phê duyệt",
            "Quy trình lập chứng từ: Lập nháp → Gửi duyệt → Đã duyệt → Ghi sổ kế toán; tự động nhảy số chứng từ liên tục không trùng; nguyên tắc kiểm soát: người lập không tự duyệt.",
            "Kiểm soát chặt chẽ quy trình nội bộ, chứng từ rõ ràng, không bị nhảy số hay ghi trùng.",
            "85% (Đã xong)",
            "Bộ công cụ tự vẽ quy trình duyệt động phức tạp nhiều cấp linh hoạt.",
            "Phiếu tạo ra nhảy số tự động, lưu lịch sử ai duyệt ai ghi sổ rõ ràng.",
            "Kỹ thuật hệ thống + Kế toán"
        ),
        (
            "4. Mua hàng & Công nợ phải trả",
            "Đơn mua hàng, Nhập kho mua hàng, Hóa đơn mua hàng đầu vào, Theo dõi chi tiết công nợ phải trả theo từng nhà cung cấp, Lập phiếu đề nghị thanh toán.",
            "Nắm rõ từng đơn hàng đã về chưa, hạn nợ của từng nhà cung cấp, tránh thanh toán trễ hoặc nhầm lẫn.",
            "90% (Đã xong)",
            "Phân tích đánh giá hiệu quả nhà cung cấp chuyên sâu.",
            "Chạy thông suốt từ Đơn mua hàng → Nhập kho → Lên công nợ phải trả và sinh phiếu kế toán.",
            "Nghiệp vụ Mua hàng + Kế toán"
        ),
        (
            "5. Tiền mặt & Tiền gửi Ngân hàng",
            "Lập Phiếu thu, Phiếu chi tiền mặt; Giấy báo Nợ, Giấy báo Có ngân hàng; Chuyển tiền nội bộ giữa các tài khoản ngân hàng; Nhập sổ phụ ngân hàng để đối chiếu.",
            "Kiểm soát chính xác dòng tiền vào/ra mỗi ngày, đối chiếu khớp đúng với số dư thực tế tại ngân hàng.",
            "90% (Đã xong)",
            "Kết nối trực tiếp tự động qua cổng ngân hàng điện tử (Open Banking realtime).",
            "Sổ quỹ tiền mặt và Sổ tiền gửi ngân hàng khớp đúng với phiếu thu/chi thực tế.",
            "Nghiệp vụ Tiền mặt + Kế toán"
        ),
        (
            "6. Bán hàng & Thu hồi Công nợ",
            "Báo giá, Đơn đặt hàng, Xuất kho bán hàng, Hóa đơn bán hàng, Theo dõi chi tiết công nợ phải thu của từng khách hàng, Thu tiền bán hàng theo hóa đơn.",
            "Theo dõi sát sao từng đơn hàng giao cho khách, đốc thúc thu hồi công nợ đúng hạn, tránh thất thoát tiền.",
            "85% (Đã xong)",
            "Chăm sóc khách hàng tự động (CRM) chuyên sâu nhiều bước.",
            "Chạy trơn tru từ Đơn bán hàng → Xuất kho → Ghi nhận doanh thu → Thu tiền khách hàng.",
            "Nghiệp vụ Bán hàng + Kế toán"
        ),
        (
            "7. Quản lý Kho & Giá vốn xuất kho",
            "Phiếu nhập kho, Phiếu xuất kho, Phiếu điều chuyển kho nội bộ; Báo cáo tồn kho tức thời; Biên bản kiểm kê kho; Tự động tính giá vốn hàng xuất bán.",
            "Biết ngay trong kho còn bao nhiêu hàng, giá trị tồn kho là bao nhiêu, phát hiện thừa thiếu khi kiểm kê.",
            "85% (Đã xong)",
            "Hoạch định nguyên vật liệu sản xuất phức tạp (MRP) nhiều công đoạn.",
            "Báo cáo Nhập - Xuất - Tồn khớp đúng cả về số lượng và giá trị với Sổ cái tài khoản kho.",
            "Quản lý Kho + Kế toán kho"
        ),
        (
            "8. Kế toán Tổng hợp & Sổ Cái",
            "Tự động định khoản Nợ/Có; Quản lý các chứng từ nghiệp vụ khác; Khóa sổ kỳ kế toán; Nhập số dư đầu kỳ; Lập Bảng cân đối phát sinh tài khoản tự động.",
            "Kế toán trưởng kiểm soát toàn bộ số liệu tài chính; số liệu tự động tổng hợp, không phải cộng tay.",
            "85% (Đang hoàn thiện)",
            "Tự động phân bổ chi phí đa chiều phức tạp nhiều chi nhánh hợp nhất.",
            "Bảng cân đối phát sinh tài khoản luôn luôn cân đối tuyệt đối (Tổng Nợ = Tổng Có).",
            "Kế toán trưởng + Kỹ thuật"
        ),
        (
            "9. Thuế & Hóa đơn",
            "Gắn link hóa đơn điện tử; Lập Bảng kê hóa đơn GTGT đầu vào; Lập Bảng kê hóa đơn GTGT đầu ra; Hỗ trợ xuất dữ liệu phục vụ lập Tờ khai thuế GTGT.",
            "Giảm 90% thời gian tổng hợp bảng kê hóa đơn thuế, sẵn sàng dữ liệu để nộp báo cáo thuế đúng hạn.",
            "80% (Đang hoàn thiện)",
            "Kết nối trực tiếp tự động nộp tờ khai lên cổng thuế điện tử (T-VAN trực tiếp).",
            "Bảng kê thuế khớp đúng từng số hóa đơn và tổng tiền thuế với Sổ kế toán tài khoản thuế.",
            "Kế toán thuế + Kỹ thuật"
        ),
        (
            "10. Tài sản Cố định & Công cụ Dụng cụ",
            "Khai báo tăng tài sản cố định; Tự động tính và trích khấu hao hàng tháng; Theo dõi phân bổ chi phí công cụ dụng cụ theo từng kỳ; Ghi giảm/thanh lý tài sản.",
            "Không lo quên trích khấu hao, số liệu phân bổ chi phí đưa vào chi phí hợp lý hàng tháng chính xác.",
            "85% (Đã xong)",
            "Lập kế hoạch bảo trì bảo dưỡng thiết bị nâng cao.",
            "Bảng tính khấu hao hàng tháng tự động sinh phiếu kế toán chuẩn xác.",
            "Kế toán tài sản + Giao diện"
        ),
        (
            "11. Báo cáo Tài chính & Sổ Sách",
            "Trọn bộ Báo cáo tài chính theo Thông tư 133 / Thông tư 99 / MISA (Bảng Cân đối kế toán, Kết quả kinh doanh, Lưu chuyển tiền tệ, Thuyết minh); Sổ cái, Sổ nhật ký chung; Xuất Excel/PDF/In đẹp mắt.",
            "Doanh nghiệp có sẵn báo cáo tài chính chuẩn mực để nộp cơ quan nhà nước, làm việc với ngân hàng hoặc cổ đông.",
            "85% (Đang hoàn thiện)",
            "Hệ thống báo cáo biểu đồ trực quan thông minh (BI) tùy biến nâng cao.",
            "Báo cáo chỉ lấy số liệu từ các chứng từ đã ghi sổ; kiểm tra số dư kép chuẩn xác; xuất file Excel đúng mẫu.",
            "Kế toán trưởng + Kiểm thử"
        ),
        (
            "12. Nhập Dữ liệu Excel & Sao Lưu An Toàn",
            "Hỗ trợ nạp nhanh danh mục Khách hàng, Nhà cung cấp, Hàng hóa và Số dư ban đầu từ file Excel; Tự động sao lưu dữ liệu dự phòng hàng ngày; Hồi phục dữ liệu khi cần.",
            "Khách hàng mới dễ dàng chuyển đổi từ Excel sang dùng phần mềm; hoàn toàn yên tâm không sợ mất số liệu kế toán.",
            "70% (Trọng tâm W8)",
            "Chuyển đổi tự động từ hàng chục loại phần mềm kế toán cũ khác nhau.",
            "Tải mẫu Excel, điền số liệu, nạp vào thành công mà không báo lỗi.",
            "Kỹ thuật hạ tầng + Nghiệp vụ"
        )
    ]
    
    for r_idx, r_data in enumerate(modules_scope, start=4):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws3.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 4] else cell_font
            c.border = thin_border
            if c_idx in [1, 4, 7]:
                c.alignment = align_center
            else:
                c.alignment = align_left
            if "95%" in val or "90%" in val or "85%" in val:
                if c_idx == 4:
                    c.fill = done_fill
            elif "80%" in val or "70%" in val:
                if c_idx == 4:
                    c.fill = doing_fill


    # -------------------------------------------------------------
    # SHEET 5: 04_THUC_TE_TRIEN_KHAI
    # -------------------------------------------------------------
    ws4 = wb.create_sheet(title="04_THUC_TE_TRIEN_KHAI")
    ws4.views.sheetView[0].showGridLines = True
    
    ws4.merge_cells("A1:G1")
    ws4["A1"] = "BÁO CÁO THỰC TẾ TIẾN ĐỘ TỪ KHI BẮT ĐẦU ĐẾN HÔM NAY (DỰA TRÊN LỊCH SỬ GIT)"
    ws4["A1"].font = title_font
    
    headers4 = [
        "Tuần thực hiện", "Khoảng ngày", "Số lượng đóng góp (Commits)", 
        "Các hạng mục quan trọng đã đưa vào mã nguồn", 
        "Đánh giá giá trị thực tế mang lại", "Vấn đề kỹ thuật đã xử lý triệt để", "Đánh giá tiến độ"
    ]
    for c_idx, h_text in enumerate(headers4, start=1):
        c = ws4.cell(3, c_idx, h_text)
        c.font = header_font
        c.fill = header_fill
        c.alignment = align_center
        c.border = thin_border
        
    actual_data = [
        (
            "Tuần 1", "21/09 – 27/09", "9 commits",
            "Khởi tạo dự án, nạp bản đặc tả thiết kế Figma, dựng giao diện làm việc sơ bộ cho Kế toán, Thuế và Quản lý kho.",
            "Tạo dựng được khung làm việc trực quan ban đầu, giúp cả đội ngũ nhìn rõ diện mạo sản phẩm.",
            "Xử lý gỡ bỏ các khóa bảo mật thử nghiệm khỏi mã nguồn, bảo đảm an toàn ngay từ ngày đầu.",
            "ĐẠT 100%"
        ),
        (
            "Tuần 2", "28/09 – 04/10", "1 commit chính + Khảo sát",
            "Nghiên cứu chuyên sâu quy trình kế toán Việt Nam, chuẩn hóa danh mục tài khoản và các trường kiểm tra tính hợp lệ.",
            "Xây dựng xong bộ quy tắc nghiệp vụ kế toán chi tiết, làm nền tảng cho việc lập trình các tuần tiếp theo.",
            "Làm rõ ranh giới giữa dữ liệu dùng chung và dữ liệu riêng biệt của từng doanh nghiệp.",
            "ĐẠT 100%"
        ),
        (
            "Tuần 3", "05/10 – 11/10", "14 commits",
            "Thiết kế giao diện biểu mẫu in ấn tiếng Việt (hợp đồng mua/bán, thông báo công nợ, đối chiếu); hoàn thiện phân hệ Tiền mặt & Tiền gửi ngân hàng.",
            "Người dùng kế toán có thể nhập phiếu thu/chi thực tế và in ra các biểu mẫu chứng từ chuẩn mực.",
            "Giải quyết cách chọn ngày tháng chuẩn định dạng Việt Nam, căn chỉnh độ cao dòng báo cáo gọn gàng.",
            "ĐẠT 100%"
        ),
        (
            "Tuần 4", "12/10 – 18/10", "9 commits",
            "Xây dựng cơ sở dữ liệu thật cho 13 phân hệ (Bán hàng, Mua hàng, Công nợ, Kho, Thuế, Báo cáo); kích hoạt cơ chế đăng ký/đăng nhập an toàn.",
            "Hệ thống chính thức chuyển từ giao diện dữ liệu giả sang vận hành trên cơ sở dữ liệu thật lưu trong máy chủ.",
            "Khắc phục các lỗi xung đột giao diện và kết nối các chức năng với máy chủ nội bộ thông suốt.",
            "ĐẠT 100%"
        ),
        (
            "Tuần 5", "19/10 – 25/10", "23 commits",
            "Chuẩn hóa toàn bộ giao diện theo chuẩn MISA / Sổ Việt ERP; áp dụng biểu mẫu Thông tư 99; đưa dữ liệu doanh nghiệp mẫu (công ty ABC) vào chạy thử nghiệm.",
            "Giao diện làm việc thân thiện, quen thuộc với kế toán Việt Nam; kiểm chứng thành công các luồng nghiệp vụ trên dữ liệu doanh nghiệp thật.",
            "Xử lý thu gọn kích thước các nút bấm và ô bảng biểu, giúp hiển thị được nhiều dòng số liệu hơn trên một màn hình.",
            "ĐẠT 100%"
        ),
        (
            "Tuần 6", "26/10 – 01/11", "45 commits (Tuần bùng nổ)",
            "Đưa phần mềm lên máy chủ thử nghiệm tự động; hoàn thành trọn bộ Báo cáo tài chính TT 133; hỗ trợ quản lý nhiều công ty độc lập; phân hệ Tài sản cố định & CCDC; các nút thao tác nhanh (Lưu & Thêm, Lưu & In).",
            "Bước nhảy vọt quan trọng nhất của dự án: phần mềm đạt đầy đủ các tính năng của một hệ thống kế toán doanh nghiệp thực thụ.",
            "Tối ưu tốc độ mở trang cực nhanh (tải ngầm thông minh); khắc phục các lỗi hóc búa về khóa cơ sở dữ liệu và xử lý quyền hạn 229 chức năng mượt mà.",
            "ĐẠT 100%"
        ),
        (
            "Tuần 7", "02/11 – 05/11 (Hôm nay)", "23 commits",
            "Bổ sung chế độ kế toán Thông tư 58; thiết lập ma trận 21 vai trò quyền hạn kế toán; tuân thủ Luật Bảo vệ dữ liệu cá nhân; nâng cấp màn hình xem báo cáo động và xuất Excel/PDF/In; khóa thanh điều khiển cố định.",
            "Đảm bảo an toàn pháp lý tuyệt đối; số liệu báo cáo tự động cân đối Nợ = Có; trải nghiệm người dùng không còn tình trạng giật cuộn chuột.",
            "Xử lý cô lập báo cáo tuyệt đối giữa các công ty; đảm bảo khi nhấn xuất Excel/PDF thì số liệu lấy chuẩn xác từ chứng từ đã ghi sổ.",
            "ĐẠT TIẾN ĐỘ"
        )
    ]
    
    for r_idx, r_data in enumerate(actual_data, start=4):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws4.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 2, 3, 7] else cell_font
            c.border = thin_border
            if c_idx in [1, 2, 3, 7]:
                c.alignment = align_center
            else:
                c.alignment = align_left
            if "ĐẠT" in val:
                c.fill = done_fill


    # -------------------------------------------------------------
    # SHEET 6: 05_QUAN_TRI_RUI_RO
    # -------------------------------------------------------------
    ws5 = wb.create_sheet(title="05_QUAN_TRI_RUI_RO")
    ws5.views.sheetView[0].showGridLines = True
    
    ws5.merge_cells("A1:G1")
    ws5["A1"] = "QUẢN TRỊ RỦI RO & 5 CỔNG NGHIỆM THU ĐẢM BẢO VỀ ĐÍCH 20/11/2026"
    ws5["A1"].font = title_font
    
    headers5 = [
        "Mã rủi ro", "Tình huống rủi ro có thể gặp", "Mức độ ảnh hưởng", 
        "Hậu quả nếu xảy ra", "Biện pháp phòng ngừa và xử lý bắt buộc", 
        "Người chịu trách nhiệm", "Hạn kiểm soát"
    ]
    for c_idx, h_text in enumerate(headers5, start=1):
        c = ws5.cell(3, c_idx, h_text)
        c.font = header_font
        c.fill = header_fill
        c.alignment = align_center
        c.border = thin_border
        
    risks_data = [
        (
            "RR-01",
            "Phát sinh thêm nhiều yêu cầu mới ngoài kế hoạch ban đầu (Scope Creep)",
            "Rất cao",
            "Làm loãng nguồn lực, đội ngũ bị quá tải, dẫn đến chậm ngày bàn giao 20/11.",
            "Thực hiện nguyên tắc Chốt cứng tính năng (Freeze Scope): Chỉ tập trung hoàn thiện các tính năng đã chốt cho bản MVP; mọi đề xuất mới ghi nhận lại để đưa vào bản V1.1 sau ngày 20/11.",
            "Quản lý dự án (PM)",
            "Áp dụng xuyên suốt"
        ),
        (
            "RR-02",
            "Số liệu kế toán ghi sổ bị lệch, Sổ cái không cân đối Nợ - Có",
            "Đặc biệt nghiêm trọng",
            "Báo cáo tài chính sai lệch, phần mềm không thể đưa vào sử dụng thực tế được.",
            "Cài đặt cơ chế kiểm soát duy nhất: Mọi chứng từ khi Ghi sổ bắt buộc phải đảm bảo Tổng Nợ = Tổng Có; chứng từ đã ghi sổ thì không được tự ý sửa đổi khi chưa Bỏ ghi sổ.",
            "Kế toán trưởng + Kỹ thuật",
            "Đã kiểm soát xong W7"
        ),
        (
            "RR-03",
            "Xem nhầm hoặc rò rỉ dữ liệu giữa các công ty với nhau",
            "Đặc biệt nghiêm trọng",
            "Vi phạm nghiêm trọng tính bảo mật và an toàn thông tin của khách hàng.",
            "Thiết lập cơ chế rào chắn độc lập ở cấp máy chủ: mỗi yêu cầu xem dữ liệu đều tự động gắn mã công ty; người dùng thuộc công ty nào chỉ được phép truy cập dữ liệu công ty đó.",
            "Kỹ thuật hệ thống",
            "Đã kiểm soát xong W7"
        ),
        (
            "RR-04",
            "Người dùng bấm liên tục chuột khi mạng chậm làm sinh phiếu trùng",
            "Trung bình",
            "Sinh ra nhiều phiếu thu/chi hoặc đơn hàng trùng lặp, gây sai lệch số liệu tồn kho và tiền.",
            "Hệ thống tự động phát hiện và ngăn chặn bấm đúp chuột (chống ghi trùng); mỗi chứng từ chỉ được lưu duy nhất một lần.",
            "Kỹ thuật hệ thống",
            "Đã kiểm soát xong"
        ),
        (
            "RR-05",
            "File Excel số dư ban đầu của khách hàng bị sai lệch hoặc không đúng định dạng",
            "Cao",
            "Khách hàng mới không thể đưa dữ liệu cũ vào phần mềm để bắt đầu sử dụng.",
            "Cung cấp sẵn file mẫu Excel chuẩn có hướng dẫn chi tiết; phần mềm có chức năng kiểm tra trước số liệu và chỉ rõ dòng nào bị lỗi để người dùng sửa lại dễ dàng.",
            "Bộ phận triển khai + Kỹ thuật",
            "Hạn chót: 15/11/2026"
        ),
        (
            "CỔNG 1 (W3)",
            "Cổng Chốt phạm vi tính năng (Scope Frozen)",
            "Cổng Nghiệm thu",
            "Nếu không chốt, dự án sẽ kéo dài vô tận.",
            "Ký duyệt danh sách tính năng bắt buộc của phiên bản MVP; không mở thêm phân hệ mới.",
            "Toàn đội ngũ",
            "ĐÃ VƯỢT QUA"
        ),
        (
            "CỔNG 2 (W5)",
            "Cổng Vận hành luồng Mua hàng - Kho - Thanh toán thực tế",
            "Cổng Nghiệm thu",
            "Nếu luồng cơ bản không chạy được, kế hoạch đang bị chậm trễ.",
            "Chứng minh luồng Đơn mua → Nhập kho → Hóa đơn → Trả tiền chạy mượt mà trên dữ liệu thật của công ty ABC.",
            "Kế toán + Kỹ thuật",
            "ĐÃ VƯỢT QUA"
        ),
        (
            "CỔNG 3 (W7)",
            "Cổng Khóa sổ & Báo cáo tài chính cân đối",
            "Cổng Nghiệm thu",
            "Nếu số liệu không cân thì chưa đủ điều kiện cho khách hàng dùng thử.",
            "Bảng cân đối phát sinh tài khoản tự động cân đối Nợ = Có; Báo cáo tài chính chỉ lấy dữ liệu đã ghi sổ.",
            "Kế toán trưởng",
            "Hạn chót: 08/11/2026"
        ),
        (
            "CỔNG 4 (W8)",
            "Cổng Ổn định hệ thống & Sẵn sàng bàn giao (RC1)",
            "Cổng Nghiệm thu",
            "Nếu còn lỗi lớn thì không được chuyển sang bước nghiệm thu thực tế.",
            "Không còn bất kỳ lỗi nghiêm trọng nào; kiểm tra sao lưu dữ liệu tự động thành công; nhập dữ liệu Excel thông suốt.",
            "Đội kiểm thử (QA)",
            "Hạn chót: 15/11/2026"
        ),
        (
            "CỔNG 5 (W9)",
            "Cổng Nghiệm thu Bàn giao Chính thức (Go-Live MVP)",
            "Cổng Nghiệm thu",
            "Nếu chưa đủ chữ ký nghiệm thu thì không được đưa vào hoạt động chính thức.",
            "Kế toán trưởng và người dùng đại diện ký nghiệm thu bàn giao; hệ thống chính thức vận hành phục vụ doanh nghiệp.",
            "Ban Lãnh đạo + Toàn đội ngũ",
            "Hạn chót: 20/11/2026"
        )
    ]
    
    for r_idx, r_data in enumerate(risks_data, start=4):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws5.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 3, 7] else cell_font
            c.border = thin_border
            if c_idx in [1, 3, 6, 7]:
                c.alignment = align_center
            else:
                c.alignment = align_left
            if "ĐÃ VƯỢT QUA" in val or "Đã kiểm soát" in val:
                c.fill = done_fill
            elif "CỔNG" in r_data[0]:
                c.fill = subheader_fill if c_idx == 1 else plan_fill
                if c_idx == 1:
                    c.font = Font(name=font_family, size=10, bold=True, color="FFFFFF")


    # -------------------------------------------------------------
    # SHEET 7: 06_TIEU_CHUAN_CHAT_LUONG
    # -------------------------------------------------------------
    ws6 = wb.create_sheet(title="06_TIEU_CHUAN_CHAT_LUONG")
    ws6.views.sheetView[0].showGridLines = True
    
    ws6.merge_cells("A1:G1")
    ws6["A1"] = "TIÊU CHUẨN CHẤT LƯỢNG VẬN HÀNH & AN TOÀN DỮ LIỆU DỄ HIỂU"
    ws6["A1"].font = title_font
    
    headers6 = [
        "Nhóm tiêu chuẩn", "Tiêu chuẩn đặt ra", "Ý nghĩa và giá trị đối với doanh nghiệp", 
        "Quy chuẩn kiểm tra thực tế", "Thời điểm hoàn thành", "Mức độ ưu tiên", "Trạng thái thực tế"
    ]
    for c_idx, h_text in enumerate(headers6, start=1):
        c = ws6.cell(3, c_idx, h_text)
        c.font = header_font
        c.fill = header_fill
        c.alignment = align_center
        c.border = thin_border
        
    nfr_data = [
        (
            "1. Bảo mật & Độc lập dữ liệu",
            "Cách ly dữ liệu tuyệt đối giữa các doanh nghiệp",
            "Đảm bảo dữ liệu tài chính của công ty này tuyệt đối không thể bị xem nhầm hoặc can thiệp bởi công ty khác.",
            "Kiểm tra thử nghiệm đăng nhập công ty A nhưng cố tình xem báo cáo công ty B: hệ thống phải lập tức từ chối.",
            "Tuần 3 – Tuần 7",
            "Bắt buộc P0",
            "ĐÃ HOÀN THÀNH"
        ),
        (
            "2. Tốc độ & Trải nghiệm",
            "Tốc độ mở trang và lưu chứng từ nhanh chóng",
            "Kế toán thao tác hàng trăm chứng từ mỗi ngày không cảm thấy mệt mỏi, không phải chờ đợi máy tính quay vòng.",
            "Thời gian tải các danh mục thông thường dưới 1 giây; thao tác bấm Lưu phản hồi gần như tức thì.",
            "Tuần 6 – Tuần 8",
            "Bắt buộc P0",
            "ĐÃ TỐI ƯU TỐT"
        ),
        (
            "3. Không bị gián đoạn",
            "Xuất báo cáo lớn không làm đơ phần mềm",
            "Khi một kế toán đang xuất báo cáo sổ sách nặng, các nhân viên khác vẫn bán hàng và nhập liệu bình thường.",
            "Hệ thống tự động chuyển việc tạo báo cáo nặng sang chạy ngầm, kế toán vẫn tiếp tục làm việc khác bình thường.",
            "Tuần 7 – Tuần 8",
            "Bắt buộc P0",
            "ĐANG HOÀN THIỆN"
        ),
        (
            "4. An toàn đăng nhập",
            "Bảo vệ mật khẩu và tự động ngắt kết nối an toàn",
            "Phòng ngừa kẻ gian đánh cắp mật khẩu hoặc lợi dụng lúc kế toán rời khỏi bàn làm việc để vào phần mềm.",
            "Mật khẩu được mã hóa an toàn nhiều lớp; tài khoản tự động khóa tạm thời nếu nhập sai mật khẩu quá 5 lần.",
            "Tuần 3 – Tuần 7",
            "Bắt buộc P0",
            "ĐÃ HOÀN THÀNH"
        ),
        (
            "5. Nhật ký minh bạch",
            "Ghi lại nhật ký mọi thao tác trên hệ thống",
            "Biết chính xác 'Ai đã làm gì, vào thời điểm nào, sửa thông tin gì trên chứng từ' để phục vụ đối chiếu và kiểm toán.",
            "Mỗi khi có thao tác Lập phiếu, Sửa, Duyệt, Ghi sổ hoặc Xóa chứng từ, hệ thống đều lưu lại lịch sử chi tiết.",
            "Tuần 4 – Tuần 7",
            "Bắt buộc P0",
            "ĐÃ HOÀN THÀNH"
        ),
        (
            "6. Toàn vẹn số liệu",
            "Không bao giờ bị mất số liệu hoặc ghi trùng",
            "Đảm bảo số liệu trên báo cáo tài chính luôn chuẩn xác, không bị thất thoát tiền bạc hoặc sai lệch số tồn kho.",
            "Ghi sổ kế toán tuân thủ nguyên tắc Nợ = Có; chống bấm chuột nhiều lần; chứng từ ghi sổ không thể sửa tùy tiện.",
            "Tuần 5 – Tuần 7",
            "Bắt buộc P0",
            "ĐÃ HOÀN THÀNH"
        ),
        (
            "7. Sao lưu dự phòng",
            "Tự động sao lưu dữ liệu định kỳ phòng sự cố",
            "Nếu chẳng may máy chủ gặp sự cố kỹ thuật, toàn bộ số liệu kế toán vẫn được khôi phục đầy đủ và nhanh chóng.",
            "Hệ thống tự động sao lưu dữ liệu hàng ngày; thời gian khôi phục lại toàn bộ phần mềm tối đa trong vòng 2 giờ.",
            "Tuần 8 – Tuần 9",
            "Bắt buộc P0",
            "KẾ HOẠCH W8"
        ),
        (
            "8. Đưa doanh nghiệp mới vào sử dụng",
            "Khởi tạo công ty mới trong 2 phút",
            "Khi có doanh nghiệp mới bắt đầu dùng phần mềm, việc tạo tài khoản và cài đặt sẵn hệ thống chỉ mất vài phút.",
            "Thực hiện theo bảng kiểm tra chuẩn: Tạo công ty → Phân quyền kế toán → Cài đặt kỳ kế toán & mẫu hóa đơn.",
            "Tuần 9",
            "Bắt buộc P0",
            "KẾ HOẠCH W9"
        )
    ]
    
    for r_idx, r_data in enumerate(nfr_data, start=4):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws6.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 2, 6, 7] else cell_font
            c.border = thin_border
            if c_idx in [1, 2, 5, 6, 7]:
                c.alignment = align_center
            else:
                c.alignment = align_left
            if "ĐÃ" in val:
                c.fill = done_fill
            elif "ĐANG" in val:
                c.fill = doing_fill
            elif "KẾ HOẠCH" in val:
                c.fill = plan_fill

    # Remove default sheet
    wb.remove(default_sheet)
    
    # Auto-adjust column widths for all sheets
    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                # ignore merged title cells spanning multiple columns in length calculation
                if cell.row in [1, 2]:
                    continue
                lines = val.split("\n")
                for line in lines:
                    max_len = max(max_len, len(line))
            # clamp width
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 48)
            
    output_path = r"d:\THUẾ\KE_HOACH_TRIEN_KHAI_ERP_THUE_2026.xlsx"
    wb.save(output_path)
    print(f"Successfully generated: {output_path}")

if __name__ == "__main__":
    create_excel_plan()
