import openpyxl
import sys
sys.stdout.reconfigure(encoding='utf-8')
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def build_streamlined_plan():
    wb = openpyxl.Workbook()
    default_sheet = wb.active
    
    font_family = "Segoe UI"
    
    title_font = Font(name=font_family, size=15, bold=True, color="1F497D")
    subtitle_font = Font(name=font_family, size=10, italic=True, color="595959")
    header_font = Font(name=font_family, size=10, bold=True, color="FFFFFF")
    cell_font = Font(name=font_family, size=10, color="000000")
    bold_cell_font = Font(name=font_family, size=10, bold=True, color="000000")
    kpi_num_font = Font(name=font_family, size=13, bold=True, color="1F497D")
    section_font = Font(name=font_family, size=11, bold=True, color="1F497D")
    
    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    sub_fill = PatternFill(start_color="2980B9", end_color="2980B9", fill_type="solid")
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

    # =========================================================================
    # TAB 1: 01_LO_TRINH_XUYEN_SUOT (Từ Ngày Đầu -> 20/11 -> Phát Triển Sau 20/11)
    # =========================================================================
    ws1 = wb.create_sheet(title="01_LO_TRINH_XUYEN_SUOT")
    ws1.views.sheetView[0].showGridLines = True
    
    ws1.merge_cells("A1:G1")
    ws1["A1"] = "LỘ TRÌNH DỰ ÁN PHẦN MỀM KẾ TOÁN & THUẾ (SỔ VIỆT ERP)"
    ws1["A1"].font = title_font
    
    ws1.merge_cells("A2:G2")
    ws1["A2"] = "Xuyên suốt từ lúc khởi đầu (21/09/2026) → Về đích MVP (20/11/2026) → Kế hoạch phát triển tiếp theo (Đến Q1/2027)"
    ws1["A2"].font = subtitle_font
    
    # 3 Key Milestone Cards
    milestones = [
        ("MỐC HIỆN TẠI", "05/11/2026", "A4:B4", "A5:B5", "A4", "A5"),
        ("MỐC VỀ ĐÍCH MVP", "20/11/2026 (Còn 15 ngày)", "C4:D4", "C5:D5", "C4", "C5"),
        ("MỐC SAU 20/11", "Q1/2027 (V1.1, V1.2, V2.0)", "E4:G4", "E5:G5", "E4", "E5")
    ]
    for top_label, val, m1, m2, c1, c2 in milestones:
        ws1.merge_cells(m1)
        ws1.merge_cells(m2)
        ws1[c1] = top_label
        ws1[c1].font = Font(name=font_family, size=9, bold=True, color="595959")
        ws1[c1].alignment = align_center
        ws1[c1].fill = kpi_fill
        ws1[c2] = val
        ws1[c2].font = kpi_num_font
        ws1[c2].alignment = align_center
        ws1[c2].fill = kpi_fill
        
    for r in range(4, 6):
        for c in range(1, 8):
            ws1.cell(r, c).border = thin_border
            
    # Headers
    headers1 = ["Giai đoạn", "Khoảng thời gian", "Trọng tâm nghiệp vụ", "Công việc thực hiện dễ hiểu", "Kết quả mang lại cho doanh nghiệp", "Mức độ ưu tiên", "Trạng thái"]
    for c_idx, h_text in enumerate(headers1, start=1):
        c = ws1.cell(7, c_idx, h_text)
        c.font = header_font
        c.fill = header_fill
        c.alignment = align_center
        c.border = thin_border
        
    roadmap_rows = [
        # Giai đoạn trước 20/11
        ("GĐ 1: Khởi động", "21/09 – 27/09", "Khung giao diện", "Dựng khung phần mềm, thiết kế giao diện theo mẫu Figma", "Thống nhất giao diện trực quan cho Kế toán, Thuế, Kho", "Cốt lõi", "ĐÃ HOÀN THÀNH"),
        ("GĐ 1: Khởi động", "28/09 – 04/10", "Khảo sát kế toán", "Khảo sát biểu mẫu, danh mục tài khoản, quy tắc chứng từ", "Hồ sơ yêu cầu nghiệp vụ chuẩn cho toàn dự án", "Cốt lõi", "ĐÃ HOÀN THÀNH"),
        ("GĐ 2: Dữ liệu & Biểu mẫu", "05/10 – 11/10", "Tiền & Mẫu in", "Mẫu in tiếng Việt (hợp đồng, nợ); phân hệ Thu/Chi/Ngân hàng", "In ấn báo cáo giấy/PDF, nhập phiếu thu chi và sổ phụ ngân hàng", "Cốt lõi", "ĐÃ HOÀN THÀNH"),
        ("GĐ 2: Dữ liệu & Biểu mẫu", "12/10 – 18/10", "Dữ liệu thật", "Đưa cơ sở dữ liệu thật vào 13 phân hệ, kích hoạt đăng nhập", "Chấm dứt dữ liệu tĩnh; lưu trữ chứng từ thực trên hệ thống", "Cốt lõi", "ĐÃ HOÀN THÀNH"),
        ("GĐ 3: Chuẩn MISA & TT99", "19/10 – 25/10", "Chuẩn hóa & Thử nghiệm", "Đồng bộ giao diện MISA / Sổ Việt ERP; nạp số liệu công ty ABC", "Quy trình Mua hàng → Kho → Thanh toán chạy thông suốt", "Cốt lõi", "ĐÃ HOÀN THÀNH"),
        ("GĐ 4: Bùng nổ BCTC", "26/10 – 01/11", "BCTC TT133 & Đa công ty", "BCTC TT133, quản lý nhiều công ty độc lập, tài sản, tăng tốc", "Phần mềm hoàn thiện đầy đủ dáng dấp ERP kế toán thực thụ", "Cốt lõi", "ĐÃ HOÀN THÀNH"),
        ("GĐ 5: Khớp số (Hiện tại)", "02/11 – 08/11", "TT58 & Khớp số Nợ=Có", "Chế độ kế toán TT58, 21 vai trò kế toán, xuất Excel/PDF, khóa menu", "Sổ sách kế toán cân đối tuyệt đối; báo cáo xuất đẹp mắt", "Cốt lõi", "ĐANG LÀM (85%)"),
        ("GĐ 6: Thử nghiệm ổn định", "09/11 – 15/11", "Ổn định & Nhập Excel", "Thử nghiệm chịu tải, tự động sao lưu dữ liệu, nạp file Excel", "Phần mềm chạy ổn định; dễ dàng nạp danh mục và số dư cũ", "Bắt buộc", "KẾ HOẠCH W8"),
        ("GĐ 7: Nghiệm thu MVP", "16/11 – 20/11", "Nghiệm thu bàn giao", "Kế toán nghiệm thu thực tế (UAT), bàn giao phiên bản MVP", "KÝ BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO BẢN MVP ĐI VÀO SỬ DỤNG", "MỤC TIÊU", "VỀ ĐÍCH 20/11"),
        
        # Giai đoạn TIẾP TỤC SAU 20/11
        ("GĐ 8: Sau 20/11 (V1.1)", "21/11 – 15/12/2026", "Thí điểm & Mở rộng", "Chạy thí điểm (Pilot) với 2-3 doanh nghiệp; Phân hệ Tính giá thành sản xuất cơ bản; Phân hệ Lương & Bảo hiểm", "Doanh nghiệp có thể tính giá thành sản phẩm và lập bảng lương nhân viên tự động", "Ưu tiên cao", "SAU 20/11 (V1.1)"),
        ("GĐ 9: Sau 20/11 (V1.2)", "16/12 – 15/01/2027", "Thuế & Ngân hàng tự động", "Kết nối nộp thuế điện tử trực tiếp (T-VAN); Kết nối tự động sổ phụ với Ngân hàng điện tử (Open Banking); Báo cáo quản trị", "Nộp tờ khai thuế ngay trên phần mềm; tự động khớp giao dịch ngân hàng theo thời gian thực", "Nâng cao", "SAU 20/11 (V1.2)"),
        ("GĐ 10: Sau 20/11 (V2.0)", "Q1/2027 (Sau Tết)", "Thông minh & Di động", "Trợ lý AI đọc hóa đơn quét tự động (OCR gợi ý định khoản); Ứng dụng di động (Mobile App) cho Giám đốc duyệt chi và xem báo cáo", "Tự động hóa 80% khâu nhập liệu hóa đơn; sếp đi công tác vẫn theo dõi số liệu và duyệt chi tức thì", "Chiến lược", "SAU 20/11 (V2.0)")
    ]
    
    for r_idx, r_data in enumerate(roadmap_rows, start=8):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws1.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 2, 6, 7] else cell_font
            c.border = thin_border
            if c_idx in [1, 2, 6, 7]:
                c.alignment = align_center
            else:
                c.alignment = align_left
            if "ĐÃ HOÀN THÀNH" in val:
                c.fill = done_fill
            elif "ĐANG LÀM" in val:
                c.fill = doing_fill
            elif "KẾ HOẠCH" in val or "VỀ ĐÍCH" in val:
                c.fill = plan_fill
            elif "SAU 20/11" in val:
                c.fill = future_fill


    # =========================================================================
    # TAB 2: 02_TIEN_DO_VA_HANH_DONG (Tiến độ Git thật & 15 Ngày Về Đích)
    # =========================================================================
    ws2 = wb.create_sheet(title="02_TIEN_DO_VA_HANH_DONG")
    ws2.views.sheetView[0].showGridLines = True
    
    ws2.merge_cells("A1:G1")
    ws2["A1"] = "TIẾN ĐỘ THỰC TẾ (DỰA TRÊN 124 COMMIT GIT) & KẾ HOẠCH HÀNH ĐỘNG"
    ws2["A1"].font = title_font
    
    ws2.merge_cells("A2:G2")
    ws2["A2"] = "Nhật ký những gì đã hoàn thành qua mã nguồn thật + Các bước hành động nước rút để bàn giao đúng ngày 20/11"
    ws2["A2"].font = subtitle_font
    
    headers2 = ["Thời gian", "Nguồn đối soát", "Nội dung đã làm / Cần làm", "Giải thích ý nghĩa thực tế", "Kết quả mang lại", "Đánh giá tiến độ"]
    for c_idx, h_text in enumerate(headers2, start=1):
        c = ws2.cell(4, c_idx, h_text)
        c.font = header_font
        c.fill = header_fill
        c.alignment = align_center
        c.border = thin_border
        
    actions_data = [
        # Quá khứ
        ("21–27/09", "Git: 9 commits", "Khởi tạo dự án & Dựng khung giao diện Figma", "Dựng sẵn bố cục các phân hệ Kế toán, Thuế, Kho", "Có khung phần mềm để các bên thống nhất", "ĐÃ XONG 100%"),
        ("28/09–04/10", "Tài liệu & Khảo sát", "Chuẩn hóa danh mục & quy tắc chứng từ", "Quy định rõ thông tin khách hàng, nhà cung cấp, hàng hóa", "Bộ yêu cầu nghiệp vụ chuẩn xác", "ĐÃ XONG 100%"),
        ("05–11/10", "Git: 14 commits", "Biểu mẫu in tiếng Việt & Quản lý Thu/Chi", "Lập phiếu thu, phiếu chi, đối chiếu sổ phụ; in hợp đồng, thông báo nợ", "In ấn trực tiếp và quản lý dòng tiền ban đầu", "ĐÃ XONG 100%"),
        ("12–18/10", "Git: 9 commits", "Đưa cơ sở dữ liệu thật vào 13 phân hệ", "Lưu trữ dữ liệu thật trên máy chủ, hoàn thiện đăng nhập", "Phần mềm chạy bằng số liệu thật, không dùng dữ liệu giả", "ĐÃ XONG 100%"),
        ("19–25/10", "Git: 23 commits", "Chuẩn hóa MISA, TT99 & Thử nghiệm công ty ABC", "Đổi nhận diện Sổ Việt ERP, áp dụng TT99, chạy thử bộ chứng từ ABC", "Luồng Mua hàng - Kho - Tiền chạy mượt mà", "ĐÃ XONG 100%"),
        ("26/10–01/11", "Git: 45 commits", "BCTC TT133, Đa công ty, Tài sản & Nút Lưu/In", "Hoàn thành BCTC TT133; quản lý nhiều công ty độc lập; tăng tốc mở trang", "Bùng nổ tính năng, phần mềm thành hình ERP thực thụ", "ĐÃ XONG 100%"),
        
        # Tuần hiện tại
        ("02–04/11", "Git: 21 commits", "Chế độ kế toán TT58, 21 vai trò & Luật dữ liệu", "Bổ sung TT58; phân quyền 21 vị trí kế toán; bảo vệ dữ liệu cá nhân", "Đảm bảo tính pháp lý và phân quyền an toàn", "ĐÃ XONG"),
        ("05/11 (Hôm nay)", "Git: 2 commits", "Khóa cố định thanh điều khiển & Màn hình xem Báo cáo động", "Khắc phục triệt để giật cuộn chuột, kết nối xuất báo cáo Excel/PDF/In", "Trải nghiệm mượt mà, sẵn sàng xuất báo cáo", "ĐÃ XONG"),
        ("06–08/11", "Kế hoạch tuần 7", "Kiểm tra đối chiếu sổ sách khép kín, đảm bảo Nợ = Có", "Chạy thử các luồng chứng từ và kiểm tra Bảng cân đối phát sinh cân 100%", "Số liệu sổ cái chuẩn xác, không có sai lệch", "ĐANG THỰC HIỆN"),
        
        # 2 tuần tới về đích
        ("09–11/11", "Kế hoạch tuần 8", "Kiểm tra chịu tải nhiều người & Tự động sao lưu dữ liệu", "Đảm bảo nhiều kế toán cùng vào làm việc không bị chậm; tự động sao lưu", "Hệ thống vận hành an toàn, phòng ngừa mất dữ liệu", "SẮP BẮT ĐẦU"),
        ("12–15/11", "Kế hoạch tuần 8", "Hoàn thiện công cụ tải file Excel danh mục & số dư đầu kỳ", "Cung cấp file mẫu Excel chuẩn để kế toán nạp nhanh danh mục và số dư", "Khách hàng mới dễ dàng chuyển dữ liệu cũ sang", "SẮP BẮT ĐẦU"),
        ("16–18/11", "Kế hoạch tuần 9", "Tổ chức nghiệm thu người dùng thực tế (UAT)", "Kế toán trưởng thao tác kiểm tra toàn bộ luồng công việc thực tế", "Phát hiện và tinh chỉnh các chi tiết sử dụng", "SẮP BẮT ĐẦU"),
        ("19–20/11", "Kế hoạch tuần 9", "Hoàn tất tài liệu hướng dẫn nhanh & Ký biên bản nghiệm thu", "Bàn giao phần mềm chính thức đi vào hoạt động thực tế", "BÀN GIAO PHIÊN BẢN MVP ĐÚNG HẠN 20/11/2026", "MỤC TIÊU VỀ ĐÍCH")
    ]
    
    for r_idx, r_data in enumerate(actions_data, start=5):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws2.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 2, 6] else cell_font
            c.border = thin_border
            if c_idx in [1, 2, 6]:
                c.alignment = align_center
            else:
                c.alignment = align_left
            if "ĐÃ XONG" in val:
                c.fill = done_fill
            elif "ĐANG THỰC HIỆN" in val:
                c.fill = doing_fill
            elif "SẮP BẮT ĐẦU" in val or "MỤC TIÊU" in val:
                c.fill = plan_fill


    # =========================================================================
    # TAB 3: 03_PHAN_HE_MVP_VA_SAU_20-11 (Chi Tiết Tính Năng MVP vs Sau 20/11)
    # =========================================================================
    ws3 = wb.create_sheet(title="03_PHAN_HE_MVP_VA_SAU_20-11")
    ws3.views.sheetView[0].showGridLines = True
    
    ws3.merge_cells("A1:G1")
    ws3["A1"] = "BẢNG PHÂN BỔ PHÂN HỆ: BẢN MVP (20/11) SO VỚI KẾ HOẠCH SAU 20/11"
    ws3["A1"].font = title_font
    
    ws3.merge_cells("A2:G2")
    ws3["A2"] = "Phân định rõ ràng: Những gì có sẵn trong bản MVP để nghiệm thu 20/11 và Kế hoạch phát triển tiếp theo sau đó"
    ws3["A2"].font = subtitle_font
    
    headers3 = [
        "Phân hệ nghiệp vụ", "Có trong bản MVP (20/11/2026)", 
        "Tiến độ MVP hiện tại", "Kế hoạch phát triển tiếp theo sau 20/11", 
        "Thời điểm dự kiến xong", "Ý nghĩa thực tế cho doanh nghiệp"
    ]
    for c_idx, h_text in enumerate(headers3, start=1):
        c = ws3.cell(4, c_idx, h_text)
        c.font = header_font
        c.fill = header_fill
        c.alignment = align_center
        c.border = thin_border
        
    modules_detail = [
        (
            "1. Quản lý Đa Doanh nghiệp",
            "Tạo nhiều công ty; phân quyền 21 vị trí kế toán; chuyển đổi công ty linh hoạt; lưu nhật ký thao tác.",
            "90% (Đã xong)",
            "Đăng nhập tập trung (SSO) cho hệ thống tập đoàn lớn; tự động tính tiền thuê bao theo tháng.",
            "Giai đoạn V1.2 (Tháng 1/2027)",
            "Một tài khoản quản lý nhiều công ty độc lập, bảo mật tuyệt đối, không lo xem nhầm số liệu."
        ),
        (
            "2. Danh mục Dùng chung",
            "Khách hàng, Nhà cung cấp, Nhân viên, Kho hàng, Hàng hóa, Ngân hàng, Hệ thống tài khoản, Thuế.",
            "95% (Đã xong)",
            "Tự động kết nối danh bạ và đồng bộ từ các phần mềm CRM hoặc bán hàng bên ngoài.",
            "Giai đoạn V1.2 (Tháng 1/2027)",
            "Chuẩn hóa dữ liệu toàn công ty, tìm kiếm nhanh, kiểm tra trùng mã số thuế tự động."
        ),
        (
            "3. Quy trình Chứng từ & Duyệt",
            "Lập nháp → Gửi duyệt → Đã duyệt → Ghi sổ; số chứng từ nhảy tự động liên tục; chống sửa khi đã ghi sổ.",
            "85% (Đã xong)",
            "Bộ công cụ vẽ quy trình duyệt linh hoạt nhiều cấp theo giá trị đơn hàng.",
            "Giai đoạn V1.1 (Tháng 12/2026)",
            "Kiểm soát nội bộ minh bạch: người lập không tự duyệt, chứng từ rõ ràng không sợ ghi trùng."
        ),
        (
            "4. Mua hàng & Công nợ phải trả",
            "Đơn mua hàng, Nhập kho mua hàng, Hóa đơn mua vào, Sổ chi tiết nợ NCC, Phiếu đề nghị thanh toán.",
            "90% (Đã xong)",
            "Đánh giá và xếp hạng uy tín của từng nhà cung cấp theo thời gian giao hàng và chất lượng.",
            "Giai đoạn V1.2 (Tháng 1/2027)",
            "Nắm rõ đơn hàng đã về chưa, hạn nợ của từng nhà cung cấp, tránh thanh toán trễ hoặc nhầm."
        ),
        (
            "5. Tiền mặt & Ngân hàng",
            "Phiếu thu, Phiếu chi; Giấy báo Nợ/Có ngân hàng; Chuyển tiền nội bộ; Đối chiếu số dư sổ phụ ngân hàng.",
            "90% (Đã xong)",
            "Kết nối trực tiếp tự động với Ngân hàng điện tử (Open Banking) - tự động tải số dư và giao dịch thực.",
            "Giai đoạn V1.2 (Tháng 1/2027)",
            "Kiểm soát chính xác dòng tiền vào/ra mỗi ngày, đối chiếu khớp đúng với ngân hàng."
        ),
        (
            "6. Bán hàng & Thu nợ",
            "Báo giá, Đơn đặt hàng, Xuất kho bán hàng, Hóa đơn bán hàng, Sổ nợ khách hàng, Thu tiền theo hóa đơn.",
            "85% (Đã xong)",
            "Hệ thống tích điểm, chính sách chiết khấu bậc thang và chăm sóc khách hàng tự động.",
            "Giai đoạn V1.2 (Tháng 1/2027)",
            "Theo dõi sát từng đơn hàng giao khách, đốc thúc thu hồi công nợ đúng hạn, tránh thất thoát."
        ),
        (
            "7. Quản lý Kho & Giá vốn",
            "Phiếu nhập/xuất/chuyển kho; Báo cáo tồn kho tức thời; Biên bản kiểm kê; Tự động tính giá vốn xuất bán.",
            "85% (Đã xong)",
            "Tính giá thành sản xuất chuyên sâu (tập hợp chi phí 621, 622, 627 tính giá thành sản phẩm 154/155).",
            "Giai đoạn V1.1 (Tháng 12/2026)",
            "Biết ngay trong kho còn bao nhiêu hàng, giá trị tồn bao nhiêu; sau 20/11 mở rộng tính giá thành sản xuất."
        ),
        (
            "8. Kế toán Tổng hợp & Sổ Cái",
            "Tự động định khoản Nợ/Có; Phiếu kế toán tổng hợp; Khóa sổ kỳ; Nhập số dư đầu kỳ; Bảng cân đối phát sinh.",
            "85% (Đang làm)",
            "Tự động phân bổ chi phí quản lý doanh nghiệp đa chiều phức tạp nhiều chi nhánh con.",
            "Giai đoạn V1.2 (Tháng 1/2027)",
            "Kế toán trưởng kiểm soát toàn bộ số liệu; số liệu tự động tổng hợp không phải cộng tay."
        ),
        (
            "9. Thuế & Hóa đơn điện tử",
            "Gắn link hóa đơn điện tử; Bảng kê hóa đơn GTGT mua vào/bán ra; Hỗ trợ số liệu lập Tờ khai thuế GTGT.",
            "80% (Đang làm)",
            "Kết nối trực tiếp cổng Thuế điện tử (T-VAN nộp thẳng); Kết nối API xuất hóa đơn điện tử VNPT, Viettel, MISA.",
            "Giai đoạn V1.2 (Tháng 1/2027)",
            "MVP phục vụ tổng hợp dữ liệu thuế; sau 20/11 bấm nộp thẳng tờ khai lên cơ quan thuế."
        ),
        (
            "10. Tài sản Cố định & CCDC",
            "Khai báo tài sản; Tự động tính và trích khấu hao hàng tháng; Phân bổ chi phí CCDC; Thanh lý tài sản.",
            "85% (Đã xong)",
            "Quản lý lịch bảo trì bảo dưỡng thiết bị máy móc định kỳ.",
            "Giai đoạn V2.0 (Q1/2027)",
            "Tự động trích khấu hao và phân bổ chi phí đưa vào sổ sách hàng tháng chính xác."
        ),
        (
            "11. Báo cáo Tài chính & Sổ Sách",
            "Trọn bộ BCTC theo TT 133 / TT 99 / MISA (Bảng CĐKT, KQKD, LCTT, Thuyết minh); Sổ cái; Xuất Excel/PDF/In.",
            "85% (Đang làm)",
            "Hệ thống biểu đồ phân tích quản trị thông minh (BI) cho Giám đốc điều hành.",
            "Giai đoạn V1.2 (Tháng 1/2027)",
            "Đầy đủ bộ Báo cáo tài chính chuẩn để nộp cơ quan nhà nước, ngân hàng và cổ đông."
        ),
        (
            "12. Lương & Trích theo Lương",
            "Định khoản chi phí lương và thanh toán lương qua phiếu chi/chuyển khoản trong bản MVP.",
            "70% (Đã xong cơ bản)",
            "Bảng chấm công tự động, tính lương theo ca/KPI, tự động trích BHXH, BHYT và tính Thuế TNCN chi tiết.",
            "Giai đoạn V1.1 (Tháng 12/2026)",
            "Bản MVP quản lý chi trả lương; sau 20/11 có trọn bộ bảng chấm công và tính lương chuyên sâu."
        ),
        (
            "13. Ứng dụng Thông minh & Di động",
            "Tối ưu giao diện trên trình duyệt web máy tính và máy tính bảng của phòng kế toán.",
            "85% (Đã xong)",
            "Trợ lý AI quét hóa đơn tự động (OCR gợi ý định khoản); Ứng dụng di động (Mobile App) cho Giám đốc.",
            "Giai đoạn V2.0 (Q1/2027)",
            "Sau 20/11 phát triển AI giúp kế toán nhàn hơn và app điện thoại để Giám đốc duyệt chi mọi lúc mọi nơi."
        )
    ]
    
    for r_idx, r_data in enumerate(modules_detail, start=5):
        for c_idx, val in enumerate(r_data, start=1):
            c = ws3.cell(r_idx, c_idx, val)
            c.font = bold_cell_font if c_idx in [1, 3, 5] else cell_font
            c.border = thin_border
            if c_idx in [1, 3, 5]:
                c.alignment = align_center
            else:
                c.alignment = align_left
            if "95%" in val or "90%" in val or "85%" in val:
                if c_idx == 3:
                    c.fill = done_fill
            elif "80%" in val or "70%" in val:
                if c_idx == 3:
                    c.fill = doing_fill
            if c_idx == 5:
                c.fill = future_fill

    # Remove default sheet
    wb.remove(default_sheet)
    
    # Auto-adjust column widths
    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                if cell.row in [1, 2]:
                    continue
                lines = val.split("\n")
                for line in lines:
                    max_len = max(max_len, len(line))
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 48)
            
    output_path = r"d:\THUẾ\KE_HOACH_TONG_THE_ERP_THUE_2026.xlsx"
    wb.save(output_path)
    print(f"Successfully generated streamlined plan: {output_path}")

if __name__ == "__main__":
    build_streamlined_plan()
