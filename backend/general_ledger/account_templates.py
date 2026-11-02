"""
Account Templates Catalog for Vietnamese Accounting Standards (TT200 and TT133).
Implements BR-COA-04, BR-COA-52, AF-02, AF-19.
"""
from typing import Any, Dict, List, Optional


# =====================================================================
# THÔNG TƯ 200/2014/TT-BTC (Chế độ kế toán Doanh nghiệp)
# =====================================================================

TT200_ACCOUNTS: List[Dict[str, Any]] = [
    # --- LOẠI 1: TÀI SẢN NGẮN HẠN ---
    {
        "code": "111", "name": "Tiền mặt", "name_en": "Cash on hand",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": False, "is_essential": True, "description": "Tài khoản tổng hợp tiền mặt",
    },
    {
        "code": "1111", "name": "Tiền Việt Nam", "name_en": "Vietnamese Dong",
        "parent_code": "111", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True, "description": "Tiền mặt bằng đồng Việt Nam",
    },
    {
        "code": "1112", "name": "Ngoại tệ", "name_en": "Foreign currencies",
        "parent_code": "111", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_foreign_currency": True, "is_essential": True, "description": "Tiền mặt ngoại tệ",
    },
    {
        "code": "112", "name": "Tiền gửi ngân hàng", "name_en": "Cash in bank",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": False, "is_essential": True, "description": "Tài khoản tổng hợp tiền gửi ngân hàng",
        "dimension_requirements": {"BANK_ACCOUNT": "REQUIRED"},
    },
    {
        "code": "1121", "name": "Tiền Việt Nam", "name_en": "Vietnamese Dong in bank",
        "parent_code": "112", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True, "description": "Tiền gửi ngân hàng bằng VND",
        "dimension_requirements": {"BANK_ACCOUNT": "REQUIRED"},
    },
    {
        "code": "1122", "name": "Ngoại tệ", "name_en": "Foreign currencies in bank",
        "parent_code": "112", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_foreign_currency": True, "is_essential": True, "description": "Tiền gửi ngân hàng bằng ngoại tệ",
        "dimension_requirements": {"BANK_ACCOUNT": "REQUIRED"},
    },
    {
        "code": "113", "name": "Tiền đang chuyển", "name_en": "Cash in transit",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
    },
    {
        "code": "121", "name": "Chứng khoán kinh doanh", "name_en": "Trading securities",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
    },
    {
        "code": "128", "name": "Đầu tư nắm giữ đến ngày đáo hạn", "name_en": "Held-to-maturity investments",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
    },
    {
        "code": "131", "name": "Phải thu của khách hàng", "name_en": "Trade receivables",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "BOTH",
        "is_postable": True, "is_essential": True, "description": "Công nợ phải thu theo khách hàng",
        "dimension_requirements": {"CUSTOMER": "REQUIRED"},
    },
    {
        "code": "133", "name": "Thuế GTGT được khấu trừ", "name_en": "Deductible VAT",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": False, "is_essential": True,
    },
    {
        "code": "1331", "name": "Thuế GTGT được khấu trừ của hàng hóa, dịch vụ", "name_en": "Deductible VAT of goods and services",
        "parent_code": "133", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "1332", "name": "Thuế GTGT được khấu trừ của tài sản cố định", "name_en": "Deductible VAT of fixed assets",
        "parent_code": "133", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "136", "name": "Phải thu nội bộ", "name_en": "Internal receivables",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
    },
    {
        "code": "138", "name": "Phải thu khác", "name_en": "Other receivables",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "BOTH",
        "is_postable": True, "is_essential": False,
    },
    {
        "code": "141", "name": "Tạm ứng", "name_en": "Advances to employees",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True, "description": "Tạm ứng cho người lao động",
        "dimension_requirements": {"EMPLOYEE": "REQUIRED"},
    },
    {
        "code": "151", "name": "Hàng mua đang đi đường", "name_en": "Goods in transit",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
    },
    {
        "code": "152", "name": "Nguyên liệu, vật liệu", "name_en": "Raw materials",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"ITEM": "REQUIRED", "WAREHOUSE": "REQUIRED"},
    },
    {
        "code": "153", "name": "Công cụ, dụng cụ", "name_en": "Tools and supplies",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"ITEM": "REQUIRED", "WAREHOUSE": "REQUIRED", "CCDC": "OPTIONAL"},
    },
    {
        "code": "154", "name": "Chi phí sản xuất, kinh doanh dở dang", "name_en": "Work in progress",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"COST_CENTER": "OPTIONAL", "PROJECT": "OPTIONAL"},
    },
    {
        "code": "155", "name": "Thành phẩm", "name_en": "Finished goods",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"ITEM": "REQUIRED", "WAREHOUSE": "REQUIRED"},
    },
    {
        "code": "156", "name": "Hàng hóa", "name_en": "Merchandise",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": False, "is_essential": True,
        "dimension_requirements": {"ITEM": "REQUIRED", "WAREHOUSE": "REQUIRED"},
    },
    {
        "code": "1561", "name": "Giá mua hàng hóa", "name_en": "Merchandise purchasing cost",
        "parent_code": "156", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"ITEM": "REQUIRED", "WAREHOUSE": "REQUIRED"},
    },
    {
        "code": "1562", "name": "Chi phí thu mua hàng hóa", "name_en": "Merchandise landing cost",
        "parent_code": "156", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
    },
    {
        "code": "157", "name": "Hàng gửi đi bán", "name_en": "Consignment goods",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
    },

    # --- LOẠI 2: TÀI SẢN DÀI HẠN ---
    {
        "code": "211", "name": "Tài sản cố định hữu hình", "name_en": "Tangible fixed assets",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": False, "is_essential": True,
        "dimension_requirements": {"FIXED_ASSET": "REQUIRED"},
    },
    {
        "code": "2111", "name": "Nhà cửa, vật kiến trúc", "name_en": "Buildings and structures",
        "parent_code": "211", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"FIXED_ASSET": "REQUIRED"},
    },
    {
        "code": "2112", "name": "Máy móc, thiết bị", "name_en": "Machinery and equipment",
        "parent_code": "211", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"FIXED_ASSET": "REQUIRED"},
    },
    {
        "code": "2113", "name": "Phương tiện vận tải, truyền dẫn", "name_en": "Vehicles and transport",
        "parent_code": "211", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"FIXED_ASSET": "REQUIRED"},
    },
    {
        "code": "214", "name": "Hao mòn tài sản cố định", "name_en": "Accumulated depreciation",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"FIXED_ASSET": "REQUIRED"},
    },
    {
        "code": "241", "name": "Xây dựng cơ bản dở dang", "name_en": "Construction in progress",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
        "dimension_requirements": {"PROJECT": "REQUIRED"},
    },
    {
        "code": "242", "name": "Chi phí trả trước", "name_en": "Prepaid expenses",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },

    # --- LOẠI 3: NỢ PHẢI TRẢ ---
    {
        "code": "331", "name": "Phải trả cho người bán", "name_en": "Trade payables",
        "parent_code": None, "account_type": "LIABILITY", "normal_balance": "BOTH",
        "is_postable": True, "is_essential": True, "description": "Công nợ phải trả theo nhà cung cấp",
        "dimension_requirements": {"SUPPLIER": "REQUIRED"},
    },
    {
        "code": "333", "name": "Thuế và các khoản phải nộp Nhà nước", "name_en": "Taxes and statutory payables",
        "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT",
        "is_postable": False, "is_essential": True,
    },
    {
        "code": "3331", "name": "Thuế giá trị gia tăng phải nộp", "name_en": "VAT payables",
        "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "3334", "name": "Thuế thu nhập doanh nghiệp", "name_en": "Corporate income tax payables",
        "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "3335", "name": "Thuế thu nhập cá nhân", "name_en": "Personal income tax payables",
        "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "334", "name": "Phải trả người lao động", "name_en": "Payables to employees",
        "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"EMPLOYEE": "OPTIONAL"},
    },
    {
        "code": "338", "name": "Phải trả, phải nộp khác", "name_en": "Other payables",
        "parent_code": None, "account_type": "LIABILITY", "normal_balance": "BOTH",
        "is_postable": True, "is_essential": False,
    },
    {
        "code": "341", "name": "Vay và nợ thuê tài chính", "name_en": "Borrowings and financial lease payables",
        "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": False,
    },

    # --- LOẠI 4: VỐN CHỦ SỞ HỮU ---
    {
        "code": "411", "name": "Vốn đầu tư của chủ sở hữu", "name_en": "Owner's contributed capital",
        "parent_code": None, "account_type": "EQUITY", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "421", "name": "Lợi nhuận sau thuế chưa phân phối", "name_en": "Undistributed earnings",
        "parent_code": None, "account_type": "EQUITY", "normal_balance": "BOTH",
        "is_postable": False, "is_essential": True,
    },
    {
        "code": "4211", "name": "Lợi nhuận sau thuế chưa phân phối năm trước", "name_en": "Prior-year undistributed earnings",
        "parent_code": "421", "account_type": "EQUITY", "normal_balance": "BOTH",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "4212", "name": "Lợi nhuận sau thuế chưa phân phối năm nay", "name_en": "Current-year undistributed earnings",
        "parent_code": "421", "account_type": "EQUITY", "normal_balance": "BOTH",
        "is_postable": True, "is_essential": True,
    },

    # --- LOẠI 5: DOANH THU ---
    {
        "code": "511", "name": "Doanh thu bán hàng và cung cấp dịch vụ", "name_en": "Revenue from sales and services",
        "parent_code": None, "account_type": "REVENUE", "normal_balance": "CREDIT",
        "is_postable": False, "is_essential": True,
    },
    {
        "code": "5111", "name": "Doanh thu bán hàng hóa", "name_en": "Revenue from merchandise sales",
        "parent_code": "511", "account_type": "REVENUE", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "5112", "name": "Doanh thu bán các thành phẩm", "name_en": "Revenue from finished goods sales",
        "parent_code": "511", "account_type": "REVENUE", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "5113", "name": "Doanh thu cung cấp dịch vụ", "name_en": "Revenue from services rendered",
        "parent_code": "511", "account_type": "REVENUE", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "515", "name": "Doanh thu hoạt động tài chính", "name_en": "Financial income",
        "parent_code": None, "account_type": "REVENUE", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "521", "name": "Các khoản giảm trừ doanh thu", "name_en": "Revenue deductions",
        "parent_code": None, "account_type": "REVENUE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
    },

    # --- LOẠI 6: CHI PHÍ SẢN XUẤT, KINH DOANH ---
    {
        "code": "621", "name": "Chi phí nguyên liệu, vật liệu trực tiếp", "name_en": "Direct material costs",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
        "dimension_requirements": {"COST_CENTER": "OPTIONAL", "PROJECT": "OPTIONAL"},
    },
    {
        "code": "622", "name": "Chi phí nhân công trực tiếp", "name_en": "Direct labor costs",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
        "dimension_requirements": {"COST_CENTER": "OPTIONAL", "PROJECT": "OPTIONAL"},
    },
    {
        "code": "627", "name": "Chi phí sản xuất chung", "name_en": "Manufacturing overhead",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": False,
        "dimension_requirements": {"COST_CENTER": "OPTIONAL"},
    },
    {
        "code": "632", "name": "Giá vốn hàng bán", "name_en": "Cost of goods sold",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "635", "name": "Chi phí tài chính", "name_en": "Financial expenses",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "641", "name": "Chi phí bán hàng", "name_en": "Selling expenses",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"DEPARTMENT": "OPTIONAL", "COST_CENTER": "OPTIONAL"},
    },
    {
        "code": "642", "name": "Chi phí quản lý doanh nghiệp", "name_en": "General and administrative expenses",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": False, "is_essential": True,
        "dimension_requirements": {"DEPARTMENT": "OPTIONAL", "COST_CENTER": "OPTIONAL"},
    },
    {
        "code": "6421", "name": "Chi phí nhân viên quản lý", "name_en": "Administrative personnel expenses",
        "parent_code": "642", "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"DEPARTMENT": "OPTIONAL"},
    },
    {
        "code": "6422", "name": "Chi phí vật liệu quản lý", "name_en": "Administrative supplies expenses",
        "parent_code": "642", "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },

    # --- LOẠI 7: THU NHẬP KHÁC ---
    {
        "code": "711", "name": "Thu nhập khác", "name_en": "Other income",
        "parent_code": None, "account_type": "OTHER_INCOME", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },

    # --- LOẠI 8: CHI PHÍ KHÁC ---
    {
        "code": "811", "name": "Chi phí khác", "name_en": "Other expenses",
        "parent_code": None, "account_type": "OTHER_EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "821", "name": "Chi phí thuế thu nhập doanh nghiệp", "name_en": "Corporate income tax expense",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },

    # --- LOẠI 9: XÁC ĐỊNH KẾT QUẢ KINH DOANH ---
    {
        "code": "911", "name": "Xác định kết quả kinh doanh", "name_en": "Income summary",
        "parent_code": None, "account_type": "EQUITY", "normal_balance": "NONE",
        "is_postable": True, "is_essential": True, "description": "Tài khoản kết chuyển xác định kết quả kinh doanh",
    },
    # --- CHI TIẾT TÀI KHOẢN CẤP 1 & CẤP 2 CHUẨN THÔNG TƯ 200/2014/TT-BTC ---
    {"code": "1113", "name": "Vàng tiền tệ", "name_en": "Monetary gold", "parent_code": "111", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1123", "name": "Vàng tiền tệ gửi ngân hàng", "name_en": "Monetary gold in bank", "parent_code": "112", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1211", "name": "Cổ phiếu", "name_en": "Trading equities", "parent_code": "121", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1212", "name": "Trái phiếu", "name_en": "Trading bonds", "parent_code": "121", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1281", "name": "Tiền gửi có kỳ hạn", "name_en": "Term deposits", "parent_code": "128", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1282", "name": "Trái phiếu nắm giữ đến ngày đáo hạn", "name_en": "Held-to-maturity bonds", "parent_code": "128", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1283", "name": "Cho vay", "name_en": "Loans receivable", "parent_code": "128", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1361", "name": "Vốn kinh doanh ở các đơn vị trực thuộc", "name_en": "Capital in dependent units", "parent_code": "136", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1368", "name": "Phải thu nội bộ khác", "name_en": "Other internal receivables", "parent_code": "136", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1381", "name": "Tài sản thiếu chờ xử lý", "name_en": "Shortage of assets awaiting resolution", "parent_code": "138", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1385", "name": "Phải thu về cổ phần hóa", "name_en": "Equitization receivables", "parent_code": "138", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1388", "name": "Phải thu khác", "name_en": "Other miscellaneous receivables", "parent_code": "138", "account_type": "ASSET", "normal_balance": "BOTH", "is_postable": True, "is_essential": True},
    {"code": "1531", "name": "Công cụ, dụng cụ", "name_en": "Tools and supplies", "parent_code": "153", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "1532", "name": "Bao bì luân chuyển", "name_en": "Reusable packaging", "parent_code": "153", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1533", "name": "Đồ dùng cho thuê", "name_en": "Tools for rent", "parent_code": "153", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1534", "name": "Thiết bị, phụ tùng thay thế", "name_en": "Spare parts and equipment", "parent_code": "153", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "2114", "name": "Thiết bị, dụng cụ quản lý", "name_en": "Management equipment", "parent_code": "211", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "212", "name": "Tài sản cố định thuê tài chính", "name_en": "Finance lease fixed assets", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "213", "name": "Tài sản cố định vô hình", "name_en": "Intangible fixed assets", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "2131", "name": "Quyền sử dụng đất", "name_en": "Land use rights", "parent_code": "213", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "2135", "name": "Chương trình phần mềm", "name_en": "Computer software", "parent_code": "213", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "2141", "name": "Hao mòn TSCĐ hữu hình", "name_en": "Accumulated depreciation of tangible FA", "parent_code": "214", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "2142", "name": "Hao mòn TSCĐ thuê tài chính", "name_en": "Accumulated depreciation of leased FA", "parent_code": "214", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "2143", "name": "Hao mòn TSCĐ vô hình", "name_en": "Accumulated amortization of intangible FA", "parent_code": "214", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "217", "name": "Bất động sản đầu tư", "name_en": "Investment properties", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "221", "name": "Đầu tư vào công ty con", "name_en": "Investment in subsidiaries", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "222", "name": "Đầu tư vào công ty liên doanh, liên kết", "name_en": "Investment in associates and joint ventures", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "228", "name": "Đầu tư khác", "name_en": "Other long-term investments", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "229", "name": "Dự phòng tổn thất tài sản", "name_en": "Provision for asset impairment", "parent_code": None, "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "243", "name": "Tài sản thuế thu nhập hoãn lại", "name_en": "Deferred tax assets", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "244", "name": "Cầm cố, thế chấp, ký quỹ, ký cược", "name_en": "Pledges, mortgages, collateral and deposits", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "33311", "name": "Thuế GTGT đầu ra", "name_en": "Output VAT", "parent_code": "3331", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "33312", "name": "Thuế GTGT hàng nhập khẩu", "name_en": "Import VAT", "parent_code": "3331", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3332", "name": "Thuế tiêu thụ đặc biệt", "name_en": "Special consumption tax", "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "3333", "name": "Thuế xuất, nhập khẩu", "name_en": "Import and export duties", "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3338", "name": "Thuế bảo vệ môi trường và các loại thuế khác", "name_en": "Other taxes", "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "3339", "name": "Phí, lệ phí và các khoản phải nộp khác", "name_en": "Fees, charges and other statutory payables", "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3341", "name": "Phải trả công nhân viên", "name_en": "Payables to staff", "parent_code": "334", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "335", "name": "Chi phí phải trả", "name_en": "Accrued expenses", "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3381", "name": "Tài sản thừa chờ giải quyết", "name_en": "Surplus assets awaiting resolution", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "3382", "name": "Kinh phí công đoàn", "name_en": "Trade union fees", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3383", "name": "Bảo hiểm xã hội", "name_en": "Social insurance", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3384", "name": "Bảo hiểm y tế", "name_en": "Health insurance", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3386", "name": "Bảo hiểm thất nghiệp", "name_en": "Unemployment insurance", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3387", "name": "Doanh thu chưa thực hiện", "name_en": "Unearned revenue", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "3388", "name": "Phải trả, phải nộp khác", "name_en": "Other payables", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "BOTH", "is_postable": True, "is_essential": True},
    {"code": "3411", "name": "Các khoản đi vay", "name_en": "Borrowings", "parent_code": "341", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3412", "name": "Nợ thuê tài chính", "name_en": "Finance lease liabilities", "parent_code": "341", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "352", "name": "Dự phòng phải trả", "name_en": "Provisions for payables", "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "353", "name": "Quỹ khen thưởng, phúc lợi", "name_en": "Bonus and welfare fund", "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "4111", "name": "Vốn góp của chủ sở hữu", "name_en": "Contributed capital", "parent_code": "411", "account_type": "EQUITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "4112", "name": "Thặng dư vốn cổ phần", "name_en": "Share premium", "parent_code": "411", "account_type": "EQUITY", "normal_balance": "BOTH", "is_postable": True, "is_essential": False},
    {"code": "413", "name": "Chênh lệch tỷ giá hối đoái", "name_en": "Foreign exchange differences", "parent_code": None, "account_type": "EQUITY", "normal_balance": "BOTH", "is_postable": True, "is_essential": False},
    {"code": "414", "name": "Quỹ đầu tư phát triển", "name_en": "Investment and development fund", "parent_code": None, "account_type": "EQUITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "418", "name": "Các quỹ khác thuộc vốn chủ sở hữu", "name_en": "Other equity funds", "parent_code": None, "account_type": "EQUITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "441", "name": "Nguồn vốn đầu tư xây dựng cơ bản", "name_en": "Capital construction investment fund", "parent_code": None, "account_type": "EQUITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "5211", "name": "Chiết khấu thương mại", "name_en": "Trade discounts", "parent_code": "521", "account_type": "REVENUE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "5212", "name": "Hàng bán bị trả lại", "name_en": "Sales returns", "parent_code": "521", "account_type": "REVENUE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "5213", "name": "Giảm giá hàng bán", "name_en": "Sales allowances", "parent_code": "521", "account_type": "REVENUE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "6411", "name": "Chi phí nhân viên bán hàng", "name_en": "Sales staff expenses", "parent_code": "641", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "6412", "name": "Chi phí vật liệu, bao bì", "name_en": "Sales materials and packaging", "parent_code": "641", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "6413", "name": "Chi phí dụng cụ, đồ dùng", "name_en": "Sales tools and supplies", "parent_code": "641", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "6414", "name": "Chi phí khấu hao TSCĐ bán hàng", "name_en": "Sales FA depreciation", "parent_code": "641", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "6417", "name": "Chi phí dịch vụ mua ngoài (bán hàng)", "name_en": "Sales outsourced services", "parent_code": "641", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "6418", "name": "Chi phí bằng tiền khác (bán hàng)", "name_en": "Other cash selling expenses", "parent_code": "641", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "6423", "name": "Chi phí đồ dùng văn phòng", "name_en": "Office supplies expenses", "parent_code": "642", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "6424", "name": "Chi phí khấu hao TSCĐ quản lý", "name_en": "Admin FA depreciation", "parent_code": "642", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "6425", "name": "Thuế, phí và lệ phí", "name_en": "Taxes, fees and charges", "parent_code": "642", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "6427", "name": "Chi phí dịch vụ mua ngoài (QLDN)", "name_en": "Admin outsourced services", "parent_code": "642", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "6428", "name": "Chi phí bằng tiền khác (QLDN)", "name_en": "Other cash admin expenses", "parent_code": "642", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "8211", "name": "Chi phí thuế TNDN hiện hành", "name_en": "Current corporate income tax expense", "parent_code": "821", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "8212", "name": "Chi phí thuế TNDN hoãn lại", "name_en": "Deferred corporate income tax expense", "parent_code": "821", "account_type": "EXPENSE", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
]


# =====================================================================
# THÔNG TƯ 133/2016/TT-BTC (Chế độ kế toán Doanh nghiệp nhỏ và vừa)
# Đặc điểm chuẩn pháp lý TT133:
# - Không có TK 621, 622, 623, 627 (hạch toán thẳng chi phí SXKD vào TK 154)
# - Không có TK 641 (dùng TK 642 - Chi phí quản lý kinh doanh: 6421 - Chi phí bán hàng, 6422 - Chi phí QLDN)
# - Không có TK 521 (các khoản giảm trừ doanh thu hạch toán giảm trực tiếp TK 511)
# - Không có TK 212, 213 riêng (gộp vào TK 211: 2111 - TSCĐ hữu hình, 2112 - TSCĐ thuê tài chính, 2113 - TSCĐ vô hình)
# - Không có TK 244 (dùng TK 1386 - Cầm cố, thế chấp, ký quỹ, ký cược)
# =====================================================================

TT133_ACCOUNTS: List[Dict[str, Any]] = [
    {
        "code": "111", "name": "Tiền mặt", "name_en": "Cash on hand",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": False, "is_essential": True,
    },
    {
        "code": "1111", "name": "Tiền Việt Nam", "name_en": "Vietnamese Dong",
        "parent_code": "111", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "1112", "name": "Ngoại tệ", "name_en": "Foreign currencies",
        "parent_code": "111", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_foreign_currency": True, "is_essential": True,
    },
    {
        "code": "112", "name": "Tiền gửi ngân hàng", "name_en": "Cash in bank",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": False, "is_essential": True,
        "dimension_requirements": {"BANK_ACCOUNT": "REQUIRED"},
    },
    {
        "code": "1121", "name": "Tiền Việt Nam", "name_en": "Vietnamese Dong in bank",
        "parent_code": "112", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"BANK_ACCOUNT": "REQUIRED"},
    },
    {
        "code": "1122", "name": "Ngoại tệ", "name_en": "Foreign currencies in bank",
        "parent_code": "112", "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_foreign_currency": True, "is_essential": True,
        "dimension_requirements": {"BANK_ACCOUNT": "REQUIRED"},
    },
    {"code": "121", "name": "Chứng khoán kinh doanh", "name_en": "Trading securities", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "128", "name": "Đầu tư nắm giữ đến ngày đáo hạn", "name_en": "Held-to-maturity investments", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1281", "name": "Tiền gửi có kỳ hạn", "name_en": "Term deposits", "parent_code": "128", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1288", "name": "Các khoản đầu tư khác nắm giữ đến ngày đáo hạn", "name_en": "Other held-to-maturity investments", "parent_code": "128", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {
        "code": "131", "name": "Phải thu của khách hàng", "name_en": "Trade receivables",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "BOTH",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"CUSTOMER": "REQUIRED"},
    },
    {
        "code": "133", "name": "Thuế GTGT được khấu trừ", "name_en": "Deductible VAT",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {"code": "1331", "name": "Thuế GTGT được khấu trừ của hàng hóa, dịch vụ", "name_en": "Deductible VAT of goods and services", "parent_code": "133", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "1332", "name": "Thuế GTGT được khấu trừ của tài sản cố định", "name_en": "Deductible VAT of fixed assets", "parent_code": "133", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True},
    {"code": "136", "name": "Phải thu nội bộ", "name_en": "Internal receivables", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1361", "name": "Vốn kinh doanh ở đơn vị trực thuộc", "name_en": "Capital in dependent units", "parent_code": "136", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1368", "name": "Phải thu nội bộ khác", "name_en": "Other internal receivables", "parent_code": "136", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "138", "name": "Phải thu khác", "name_en": "Other receivables", "parent_code": None, "account_type": "ASSET", "normal_balance": "BOTH", "is_postable": True, "is_essential": True},
    {"code": "1381", "name": "Tài sản thiếu chờ xử lý", "name_en": "Shortage of assets awaiting resolution", "parent_code": "138", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1386", "name": "Cầm cố, thế chấp, ký quỹ, ký cược", "name_en": "Pledges, mortgages, collateral and deposits", "parent_code": "138", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "1388", "name": "Phải thu khác", "name_en": "Other miscellaneous receivables", "parent_code": "138", "account_type": "ASSET", "normal_balance": "BOTH", "is_postable": True, "is_essential": True},
    {
        "code": "141", "name": "Tạm ứng", "name_en": "Advances to employees",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"EMPLOYEE": "REQUIRED"},
    },
    {"code": "151", "name": "Hàng mua đang đi đường", "name_en": "Goods in transit", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {
        "code": "152", "name": "Nguyên liệu, vật liệu", "name_en": "Raw materials",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"ITEM": "REQUIRED", "WAREHOUSE": "REQUIRED"},
    },
    {
        "code": "153", "name": "Công cụ, dụng cụ", "name_en": "Tools and supplies",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"ITEM": "REQUIRED", "WAREHOUSE": "REQUIRED", "CCDC": "OPTIONAL"},
    },
    {
        "code": "154", "name": "Chi phí sản xuất, kinh doanh dở dang", "name_en": "Work in progress",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "155", "name": "Thành phẩm", "name_en": "Finished goods",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"ITEM": "REQUIRED", "WAREHOUSE": "REQUIRED"},
    },
    {
        "code": "156", "name": "Hàng hóa", "name_en": "Merchandise",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"ITEM": "REQUIRED", "WAREHOUSE": "REQUIRED"},
    },
    {"code": "157", "name": "Hàng gửi đi bán", "name_en": "Consignment goods", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {
        "code": "211", "name": "Tài sản cố định", "name_en": "Fixed assets",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"FIXED_ASSET": "REQUIRED"},
    },
    {"code": "2111", "name": "Tài sản cố định hữu hình", "name_en": "Tangible fixed assets", "parent_code": "211", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True, "dimension_requirements": {"FIXED_ASSET": "REQUIRED"}},
    {"code": "2112", "name": "Tài sản cố định thuê tài chính", "name_en": "Finance lease fixed assets", "parent_code": "211", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False, "dimension_requirements": {"FIXED_ASSET": "REQUIRED"}},
    {"code": "2113", "name": "Tài sản cố định vô hình", "name_en": "Intangible fixed assets", "parent_code": "211", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": True, "dimension_requirements": {"FIXED_ASSET": "REQUIRED"}},
    {
        "code": "214", "name": "Hao mòn tài sản cố định", "name_en": "Accumulated depreciation",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"FIXED_ASSET": "REQUIRED"},
    },
    {"code": "2141", "name": "Hao mòn TSCĐ hữu hình", "name_en": "Accumulated depreciation of tangible FA", "parent_code": "214", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True, "dimension_requirements": {"FIXED_ASSET": "REQUIRED"}},
    {"code": "2142", "name": "Hao mòn TSCĐ thuê tài chính", "name_en": "Accumulated depreciation of leased FA", "parent_code": "214", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False, "dimension_requirements": {"FIXED_ASSET": "REQUIRED"}},
    {"code": "2143", "name": "Hao mòn TSCĐ vô hình", "name_en": "Accumulated amortization of intangible FA", "parent_code": "214", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True, "dimension_requirements": {"FIXED_ASSET": "REQUIRED"}},
    {"code": "2147", "name": "Hao mòn bất động sản đầu tư", "name_en": "Accumulated depreciation of investment properties", "parent_code": "214", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "217", "name": "Bất động sản đầu tư", "name_en": "Investment properties", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "228", "name": "Đầu tư góp vốn vào đơn vị khác", "name_en": "Investments in other entities", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "2281", "name": "Đầu tư vào công ty liên doanh, liên kết", "name_en": "Investments in associates and joint ventures", "parent_code": "228", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "2288", "name": "Đầu tư khác", "name_en": "Other long-term investments", "parent_code": "228", "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "229", "name": "Dự phòng tổn thất tài sản", "name_en": "Provision for asset impairment", "parent_code": None, "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "2291", "name": "Dự phòng giảm giá chứng khoán kinh doanh", "name_en": "Provision for decline in trading securities", "parent_code": "229", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "2292", "name": "Dự phòng tổn thất đầu tư vào đơn vị khác", "name_en": "Provision for long-term investment losses", "parent_code": "229", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "2293", "name": "Dự phòng phải thu khó đòi", "name_en": "Allowance for doubtful debts", "parent_code": "229", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "2294", "name": "Dự phòng giảm giá hàng tồn kho", "name_en": "Provision for inventory obsolescence", "parent_code": "229", "account_type": "ASSET", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "241", "name": "Xây dựng cơ bản dở dang", "name_en": "Construction in progress", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {
        "code": "242", "name": "Chi phí trả trước", "name_en": "Prepaid expenses",
        "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "331", "name": "Phải trả cho người bán", "name_en": "Trade payables",
        "parent_code": None, "account_type": "LIABILITY", "normal_balance": "BOTH",
        "is_postable": True, "is_essential": True,
        "dimension_requirements": {"SUPPLIER": "REQUIRED"},
    },
    {
        "code": "333", "name": "Thuế và các khoản phải nộp Nhà nước", "name_en": "Taxes and statutory payables",
        "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {"code": "3331", "name": "Thuế giá trị gia tăng phải nộp", "name_en": "VAT payables", "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "33311", "name": "Thuế GTGT đầu ra", "name_en": "Output VAT", "parent_code": "3331", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "33312", "name": "Thuế GTGT hàng nhập khẩu", "name_en": "Import VAT", "parent_code": "3331", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3332", "name": "Thuế tiêu thụ đặc biệt", "name_en": "Special consumption tax", "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "3333", "name": "Thuế xuất, nhập khẩu", "name_en": "Import and export duties", "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3334", "name": "Thuế thu nhập doanh nghiệp", "name_en": "Corporate income tax payables", "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3335", "name": "Thuế thu nhập cá nhân", "name_en": "Personal income tax payables", "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3338", "name": "Thuế bảo vệ môi trường và các loại thuế khác", "name_en": "Other taxes", "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "3339", "name": "Phí, lệ phí và các khoản phải nộp khác", "name_en": "Fees, charges and other statutory payables", "parent_code": "333", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {
        "code": "334", "name": "Phải trả người lao động", "name_en": "Payables to employees",
        "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {"code": "335", "name": "Chi phí phải trả", "name_en": "Accrued expenses", "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "336", "name": "Phải trả nội bộ", "name_en": "Internal payables", "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "338", "name": "Phải trả, phải nộp khác", "name_en": "Other payables", "parent_code": None, "account_type": "LIABILITY", "normal_balance": "BOTH", "is_postable": True, "is_essential": True},
    {"code": "3381", "name": "Tài sản thừa chờ giải quyết", "name_en": "Surplus assets awaiting resolution", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "3382", "name": "Kinh phí công đoàn", "name_en": "Trade union fees", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3383", "name": "Bảo hiểm xã hội", "name_en": "Social insurance", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3384", "name": "Bảo hiểm y tế", "name_en": "Health insurance", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3386", "name": "Bảo hiểm thất nghiệp", "name_en": "Unemployment insurance", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3387", "name": "Doanh thu chưa thực hiện", "name_en": "Unearned revenue", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "3388", "name": "Phải trả, phải nộp khác", "name_en": "Other miscellaneous payables", "parent_code": "338", "account_type": "LIABILITY", "normal_balance": "BOTH", "is_postable": True, "is_essential": True},
    {"code": "341", "name": "Vay và nợ thuê tài chính", "name_en": "Borrowings and finance lease liabilities", "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3411", "name": "Các khoản đi vay", "name_en": "Borrowings", "parent_code": "341", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "3412", "name": "Nợ thuê tài chính", "name_en": "Finance lease liabilities", "parent_code": "341", "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "352", "name": "Dự phòng phải trả", "name_en": "Provisions for payables", "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "353", "name": "Quỹ khen thưởng, phúc lợi", "name_en": "Bonus and welfare fund", "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {
        "code": "411", "name": "Vốn đầu tư của chủ sở hữu", "name_en": "Owner's contributed capital",
        "parent_code": None, "account_type": "EQUITY", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {"code": "4111", "name": "Vốn góp của chủ sở hữu", "name_en": "Contributed capital", "parent_code": "411", "account_type": "EQUITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "4112", "name": "Thặng dư vốn cổ phần", "name_en": "Share premium", "parent_code": "411", "account_type": "EQUITY", "normal_balance": "BOTH", "is_postable": True, "is_essential": False},
    {"code": "4118", "name": "Vốn khác", "name_en": "Other capital", "parent_code": "411", "account_type": "EQUITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "413", "name": "Chênh lệch tỷ giá hối đoái", "name_en": "Foreign exchange differences", "parent_code": None, "account_type": "EQUITY", "normal_balance": "BOTH", "is_postable": True, "is_essential": False},
    {"code": "418", "name": "Các quỹ thuộc vốn chủ sở hữu", "name_en": "Equity funds", "parent_code": None, "account_type": "EQUITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {"code": "419", "name": "Cổ phiếu quỹ", "name_en": "Treasury shares", "parent_code": None, "account_type": "EQUITY", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {
        "code": "421", "name": "Lợi nhuận sau thuế chưa phân phối", "name_en": "Undistributed earnings",
        "parent_code": None, "account_type": "EQUITY", "normal_balance": "BOTH",
        "is_postable": True, "is_essential": True,
    },
    {"code": "4211", "name": "Lợi nhuận sau thuế chưa phân phối năm trước", "name_en": "Prior-year undistributed earnings", "parent_code": "421", "account_type": "EQUITY", "normal_balance": "BOTH", "is_postable": True, "is_essential": True},
    {"code": "4212", "name": "Lợi nhuận sau thuế chưa phân phối năm nay", "name_en": "Current-year undistributed earnings", "parent_code": "421", "account_type": "EQUITY", "normal_balance": "BOTH", "is_postable": True, "is_essential": True},
    {
        "code": "511", "name": "Doanh thu bán hàng và cung cấp dịch vụ", "name_en": "Revenue from sales and services",
        "parent_code": None, "account_type": "REVENUE", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {"code": "5111", "name": "Doanh thu bán hàng hóa", "name_en": "Revenue from merchandise sales", "parent_code": "511", "account_type": "REVENUE", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "5112", "name": "Doanh thu bán thành phẩm", "name_en": "Revenue from finished goods sales", "parent_code": "511", "account_type": "REVENUE", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "5113", "name": "Doanh thu cung cấp dịch vụ", "name_en": "Revenue from services rendered", "parent_code": "511", "account_type": "REVENUE", "normal_balance": "CREDIT", "is_postable": True, "is_essential": True},
    {"code": "5118", "name": "Doanh thu khác", "name_en": "Other sales revenue", "parent_code": "511", "account_type": "REVENUE", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
    {
        "code": "515", "name": "Doanh thu hoạt động tài chính", "name_en": "Financial income",
        "parent_code": None, "account_type": "REVENUE", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "632", "name": "Giá vốn hàng bán", "name_en": "Cost of goods sold",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "635", "name": "Chi phí tài chính", "name_en": "Financial expenses",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "642", "name": "Chi phí quản lý kinh doanh", "name_en": "Selling and administrative expenses",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": False, "is_essential": True,
    },
    {
        "code": "6421", "name": "Chi phí bán hàng", "name_en": "Selling expenses",
        "parent_code": "642", "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "6422", "name": "Chi phí quản lý doanh nghiệp", "name_en": "Administrative expenses",
        "parent_code": "642", "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "711", "name": "Thu nhập khác", "name_en": "Other income",
        "parent_code": None, "account_type": "OTHER_INCOME", "normal_balance": "CREDIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "811", "name": "Chi phí khác", "name_en": "Other expenses",
        "parent_code": None, "account_type": "OTHER_EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "821", "name": "Chi phí thuế thu nhập doanh nghiệp", "name_en": "Corporate income tax expense",
        "parent_code": None, "account_type": "EXPENSE", "normal_balance": "DEBIT",
        "is_postable": True, "is_essential": True,
    },
    {
        "code": "911", "name": "Xác định kết quả kinh doanh", "name_en": "Income summary",
        "parent_code": None, "account_type": "EQUITY", "normal_balance": "NONE",
        "is_postable": True, "is_essential": True,
    },
]


# =====================================================================
# THÔNG TƯ 58/2026/TT-BTC (Chế độ kế toán Doanh nghiệp siêu nhỏ, hiệu lực 01/07/2026, thay thế TT132/2018/TT-BTC)
# Rút gọn từ hệ thống tài khoản TT133 gồm các tài khoản cốt lõi thiết yếu cho DN siêu nhỏ
# =====================================================================

TT58_ACCOUNTS: List[Dict[str, Any]] = [
    dict(acc) for acc in TT133_ACCOUNTS if acc.get("is_essential", False)
]


# =====================================================================
# THÔNG TƯ 99/2025/TT-BTC (Chế độ kế toán Doanh nghiệp mới nhất, hiệu lực 01/01/2026)
# Kế thừa danh mục chuẩn và bổ sung các tài khoản đặc thù mới theo Thông tư 99/2025/TT-BTC
# =====================================================================

TT99_ACCOUNTS: List[Dict[str, Any]] = [
    *TT200_ACCOUNTS,
    {"code": "158", "name": "Nguyên liệu, vật liệu tại kho bảo thuế", "name_en": "Materials in bonded warehouse", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "215", "name": "Tài sản sinh học", "name_en": "Biological assets", "parent_code": None, "account_type": "ASSET", "normal_balance": "DEBIT", "is_postable": True, "is_essential": False},
    {"code": "332", "name": "Phải trả cổ tức, lợi nhuận", "name_en": "Dividends and profit payable", "parent_code": None, "account_type": "LIABILITY", "normal_balance": "CREDIT", "is_postable": True, "is_essential": False},
]


def get_template_accounts(regime: str = "TT99", scope: str = "FULL") -> List[Dict[str, Any]]:
    """Lấy danh sách tài khoản theo mẫu chế độ kế toán (TT99, TT200, TT133, TT58) và phạm vi (FULL / ESSENTIAL)."""
    regime_upper = (regime or "TT99").upper()
    if regime_upper not in {
        "TT99", "99", "CIRCULAR_99",
        "TT133", "CIRCULAR_133", "133",
        "TT200", "CIRCULAR_200", "200",
        "TT58", "CIRCULAR_58", "58",
    }:
        raise ValueError("Chế độ kế toán không hợp lệ.")
    if (scope or "FULL").upper() not in {"FULL", "ESSENTIAL"}:
        raise ValueError("Phạm vi mẫu không hợp lệ.")
    if regime_upper in ("TT58", "CIRCULAR_58", "58"):
        accounts = TT58_ACCOUNTS
    elif regime_upper in ("TT133", "CIRCULAR_133", "133"):
        accounts = TT133_ACCOUNTS
    elif regime_upper in ("TT200", "CIRCULAR_200", "200"):
        accounts = TT200_ACCOUNTS
    else:
        accounts = TT99_ACCOUNTS

    if scope and scope.upper() in ("ESSENTIAL", "MINIMAL"):
        return [acc for acc in accounts if acc.get("is_essential", False)]
    return list(accounts)
