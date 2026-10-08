import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  Search,
  RotateCw,
  Mail,
  MessageCircle,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Calendar,
  ChevronDown,
  Sparkles,
  FileCheck,
  FileCode,
  Send,
} from "lucide-react";

export interface InterimBalanceSheetItem {
  name: string;
  code: string;
  note?: string;
  closingQuarter?: number; // Số cuối quý
  openingYear?: number;    // Số đầu năm
  level: number; // 0: Main (A, B, C, D), 1: Roman (I, II), 2: Numbered (1, 2), 3: Sub (- Nguyên giá...)
  isBold?: boolean;
  isClickable?: boolean;
}

export interface InterimIncomeItem {
  id: string;
  name: string;
  code: string;
  note?: string;
  quarterCurrent?: number;  // Quý IV - Năm nay
  quarterPrevious?: number; // Quý IV - Năm trước
  accumCurrent?: number;    // Lũy kế - Năm nay
  accumPrevious?: number;   // Lũy kế - Năm trước
  isBold?: boolean;
  isClickable?: boolean;
  indent?: boolean;
}

export interface InterimCashFlowItem {
  id: string;
  name: string;
  code?: string;
  note?: string;
  accumCurrent?: number;
  accumPrevious?: number;
  isHeader?: boolean;
  isBold?: boolean;
  isClickable?: boolean;
}

// 1. Full Catalogue of B01a - DN (Báo cáo tình hình tài chính giữa niên độ)
const FULL_B01A_DATA: InterimBalanceSheetItem[] = [
  // A. TÀI SẢN NGẮN HẠN
  { name: "A. TÀI SẢN NGẮN HẠN", code: "100", closingQuarter: 24475000, level: 0, isBold: true },
  { name: "I. Tiền và các khoản tương đương tiền", code: "110", note: "V.1", closingQuarter: -20000000, level: 1, isBold: true },
  { name: "1. Tiền", code: "111", closingQuarter: -20000000, level: 2 },
  { name: "2. Các khoản tương đương tiền", code: "112", level: 2 },

  { name: "II. Đầu tư tài chính ngắn hạn", code: "120", level: 1, isBold: true },
  { name: "1. Chứng khoán kinh doanh", code: "121", note: "V.2(a)", level: 2 },
  { name: "2. Dự phòng giảm giá chứng khoán kinh doanh (*)", code: "122", level: 2 },
  { name: "3. Đầu tư nắm giữ đến ngày đáo hạn", code: "123", note: "V.2(b)", level: 2 },
  { name: "4. Dự phòng đầu tư nắm giữ đến ngày đáo hạn ngắn hạn (*)", code: "124", level: 2 },
  { name: "5. Đầu tư ngắn hạn khác", code: "125", level: 2 },
  { name: "6. Dự phòng tổn thất các khoản đầu tư ngắn hạn khác (*)", code: "126", level: 2 },

  { name: "III. Các khoản phải thu ngắn hạn", code: "130", closingQuarter: 30000000, level: 1, isBold: true },
  { name: "1. Phải thu ngắn hạn của khách hàng", code: "131", note: "V.3(a)", closingQuarter: 20000000, level: 2, isClickable: true },
  { name: "2. Trả trước cho người bán ngắn hạn", code: "132", level: 2, isClickable: true },
  { name: "3. Phải thu nội bộ ngắn hạn", code: "133", level: 2 },
  { name: "4. Phải thu theo tiến độ hợp đồng xây dựng", code: "134", level: 2 },
  { name: "5. Phải thu ngắn hạn khác", code: "135", note: "V.4(a)", closingQuarter: 10000000, level: 2, isClickable: true },
  { name: "6. Dự phòng phải thu ngắn hạn khó đòi (*)", code: "136", level: 2 },
  { name: "7. Tài sản thiếu chờ xử lý", code: "137", note: "V.5", level: 2 },

  { name: "IV. Hàng tồn kho", code: "140", note: "V.7", closingQuarter: 12475000, level: 1, isBold: true },
  { name: "1. Hàng tồn kho", code: "141", closingQuarter: 12475000, level: 2 },
  { name: "2. Dự phòng giảm giá hàng tồn kho (*)", code: "142", level: 2 },

  { name: "V. Tài sản sinh học ngắn hạn", code: "150", level: 1, isBold: true },
  { name: "1. Súc vật nuôi lấy sản phẩm một lần ngắn hạn", code: "151", note: "V.12.1.1", level: 2 },
  { name: "2. Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần ngắn hạn", code: "152", note: "V.12.1.2", level: 2 },
  { name: "3. Dự phòng tổn thất tài sản sinh học ngắn hạn (*)", code: "153", level: 2 },

  { name: "VI. Tài sản ngắn hạn khác", code: "160", closingQuarter: 2000000, level: 1, isBold: true },
  { name: "1. Chi phí chờ phân bổ ngắn hạn", code: "161", note: "V.14(a)", level: 2 },
  { name: "2. Thuế GTGT được khấu trừ", code: "162", closingQuarter: 2000000, level: 2 },
  { name: "3. Thuế và các khoản khác phải thu Nhà nước", code: "163", note: "V.19(b)", level: 2 },
  { name: "4. Giao dịch mua bán lại trái phiếu Chính phủ", code: "164", note: "V.23", level: 2 },
  { name: "5. Tài sản ngắn hạn khác", code: "165", note: "V.15(a)", level: 2 },

  // B. TÀI SẢN DÀI HẠN
  { name: "B. TÀI SẢN DÀI HẠN", code: "200", level: 0, isBold: true },
  { name: "I. Các khoản phải thu dài hạn", code: "210", level: 1, isBold: true },
  { name: "1. Phải thu dài hạn của khách hàng", code: "211", level: 2 },
  { name: "2. Trả trước cho người bán dài hạn", code: "212", level: 2 },
  { name: "3. Vốn kinh doanh ở đơn vị trực thuộc", code: "213", level: 2 },
  { name: "4. Phải thu nội bộ dài hạn", code: "214", level: 2 },
  { name: "5. Phải thu dài hạn khác", code: "215", level: 2 },
  { name: "6. Dự phòng phải thu dài hạn khó đòi (*)", code: "216", level: 2 },

  { name: "II. Tài sản cố định", code: "220", level: 1, isBold: true },
  { name: "1. Tài sản cố định hữu hình", code: "221", note: "V.9", level: 2 },
  { name: "- Nguyên giá", code: "222", level: 3 },
  { name: "- Giá trị hao mòn lũy kế (*)", code: "223", level: 3 },
  { name: "2. Tài sản cố định thuê tài chính", code: "224", note: "V.11", level: 2 },
  { name: "- Nguyên giá", code: "225", level: 3 },
  { name: "- Giá trị hao mòn lũy kế (*)", code: "226", level: 3 },
  { name: "3. Tài sản cố định vô hình", code: "227", note: "V.10", level: 2 },
  { name: "- Nguyên giá", code: "228", level: 3 },
  { name: "- Giá trị hao mòn lũy kế (*)", code: "229", level: 3 },

  { name: "III. Tài sản sinh học dài hạn", code: "230", level: 1, isBold: true },
  { name: "1. Súc vật nuôi cho sản phẩm định kỳ", code: "231", level: 2 },
  { name: "a) Súc vật nuôi cho sản phẩm định kỳ chưa đến giai đoạn trưởng thành", code: "232", note: "V.12.1.3", level: 3 },
  { name: "b) Súc vật nuôi cho sản phẩm định kỳ đến giai đoạn trưởng thành", code: "233", note: "V.12.2", level: 3 },
  { name: "- Nguyên giá", code: "234", level: 3 },
  { name: "- Giá trị khấu hao lũy kế (*)", code: "235", level: 3 },
  { name: "2. Súc vật nuôi lấy sản phẩm một lần dài hạn", code: "236", level: 2 },
  { name: "3. Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần dài hạn", code: "237", level: 2 },
  { name: "4. Dự phòng tổn thất tài sản sinh học dài hạn (*)", code: "238", level: 2 },

  { name: "IV. Bất động sản đầu tư", code: "240", note: "V.13", level: 1, isBold: true },
  { name: "- Nguyên giá", code: "241", level: 3 },
  { name: "- Giá trị hao mòn lũy kế (*)", code: "242", level: 3 },

  { name: "V. Tài sản dở dang dài hạn", code: "250", level: 1, isBold: true },
  { name: "1. Chi phí sản xuất, kinh doanh dở dang dài hạn", code: "251", level: 2 },
  { name: "2. Chi phí xây dựng cơ bản dở dang", code: "252", level: 2 },

  { name: "VI. Đầu tư tài chính dài hạn", code: "260", level: 1, isBold: true },
  { name: "1. Đầu tư vào công ty con", code: "261", level: 2 },
  { name: "2. Đầu tư vào công ty liên doanh, liên kết", code: "262", level: 2 },
  { name: "3. Đầu tư góp vốn vào đơn vị khác", code: "263", level: 2 },
  { name: "4. Dự phòng tổn thất đầu tư vào đơn vị khác dài hạn (*)", code: "264", level: 2 },
  { name: "5. Đầu tư nắm giữ đến ngày đáo hạn dài hạn", code: "265", level: 2 },
  { name: "6. Dự phòng đầu tư nắm giữ đến ngày đáo hạn dài hạn (*)", code: "266", level: 2 },

  { name: "VII. Tài sản dài hạn khác", code: "270", level: 1, isBold: true },
  { name: "1. Chi phí chờ phân bổ dài hạn", code: "271", note: "V.14(b)", level: 2 },
  { name: "2. Tài sản thuế thu nhập hoãn lại", code: "272", note: "V.26(a)", level: 2 },
  { name: "3. Thiết bị, vật tư, phụ tùng thay thế dài hạn", code: "273", level: 2 },
  { name: "4. Tài sản dài hạn khác", code: "274", note: "V.15(b)", level: 2 },

  // TỔNG CỘNG TÀI SẢN
  { name: "TỔNG CỘNG TÀI SẢN (280 = 100 + 200)", code: "280", closingQuarter: 24475000, level: 0, isBold: true },

  // C. NỢ PHẢI TRẢ
  { name: "C - NỢ PHẢI TRẢ", code: "300", closingQuarter: 17000000, level: 0, isBold: true },
  { name: "I. Nợ ngắn hạn", code: "310", closingQuarter: 17000000, level: 1, isBold: true },
  { name: "1. Phải trả người bán ngắn hạn", code: "311", note: "V.17(a)", closingQuarter: 17000000, level: 2, isClickable: true },
  { name: "2. Người mua trả tiền trước ngắn hạn", code: "312", level: 2 },
  { name: "3. Phải trả cổ tức, lợi nhuận", code: "313", level: 2 },
  { name: "4. Thuế và các khoản phải nộp Nhà nước ngắn hạn", code: "314", note: "V.19(a)", level: 2 },
  { name: "5. Phải trả người lao động", code: "315", level: 2 },
  { name: "6. Chi phí phải trả ngắn hạn", code: "316", note: "V.20(a)", level: 2 },
  { name: "7. Phải trả nội bộ ngắn hạn", code: "317", level: 2 },
  { name: "8. Phải trả theo tiến độ hợp đồng xây dựng ngắn hạn", code: "318", level: 2 },
  { name: "9. Doanh thu chờ phân bổ ngắn hạn", code: "319", note: "V.22(a)", level: 2 },
  { name: "10. Phải trả ngắn hạn khác", code: "320", note: "V.21(a)", level: 2 },
  { name: "11. Vay và nợ thuê tài chính ngắn hạn", code: "321", note: "V.16(a)", level: 2 },
  { name: "12. Dự phòng phải trả ngắn hạn", code: "322", note: "V.25(a)", level: 2 },
  { name: "13. Quỹ khen thưởng, phúc lợi", code: "323", level: 2 },
  { name: "14. Quỹ bình ổn giá", code: "324", level: 2 },
  { name: "15. Giao dịch mua bán lại trái phiếu Chính phủ", code: "325", note: "V.23", level: 2 },

  { name: "II. Nợ dài hạn", code: "330", level: 1, isBold: true },
  { name: "1. Phải trả người bán dài hạn", code: "331", note: "V.17(b)", level: 2 },
  { name: "2. Người mua trả tiền trước dài hạn", code: "332", level: 2 },
  { name: "3. Thuế và các khoản phải nộp Nhà nước dài hạn", code: "333", note: "V.19(b)", level: 2 },
  { name: "4. Chi phí phải trả dài hạn", code: "334", note: "V.20(b)", level: 2 },
  { name: "5. Phải trả nội bộ về vốn kinh doanh", code: "335", level: 2 },
  { name: "6. Phải trả nội bộ dài hạn", code: "336", level: 2 },
  { name: "7. Doanh thu chờ phân bổ dài hạn", code: "337", note: "V.22(b)", level: 2 },
  { name: "8. Phải trả dài hạn khác", code: "338", note: "V.21(b)", level: 2 },
  { name: "9. Vay và nợ thuê tài chính dài hạn", code: "339", note: "V.16(b)", level: 2 },
  { name: "10. Trái phiếu chuyển đổi", code: "340", level: 2 },
  { name: "11. Cổ phiếu ưu đãi", code: "341", note: "V.24", level: 2 },
  { name: "12. Thuế thu nhập hoãn lại phải trả", code: "342", note: "V.26(b)", level: 2 },
  { name: "13. Dự phòng phải trả dài hạn", code: "343", note: "V.25(b)", level: 2 },
  { name: "14. Quỹ phát triển khoa học và công nghệ", code: "344", level: 2 },

  // D. VỐN CHỦ SỞ HỮU
  { name: "D - VỐN CHỦ SỞ HỮU", code: "400", level: 0, isBold: true },
  { name: "1. Vốn góp của chủ sở hữu", code: "411", note: "V.27(b)", level: 2 },
  { name: " - Cổ phiếu phổ thông có quyền biểu quyết", code: "411a", note: "V.27(d)", level: 3 },
  { name: " - Cổ phiếu ưu đãi", code: "411b", note: "V.27(d)", level: 3 },
  { name: "2. Thặng dư vốn", code: "412", note: "V.27(e)", level: 2 },
  { name: "3. Quyền chọn chuyển đổi trái phiếu", code: "413", note: "V.27(e)", level: 2 },
  { name: "4. Vốn khác của chủ sở hữu", code: "414", level: 2 },
  { name: "5. Cổ phiếu mua lại của chính mình (*)", code: "415", note: "V.27(e)", level: 2 },
  { name: "6. Chênh lệch đánh giá lại tài sản", code: "416", note: "V.28", level: 2 },
  { name: "7. Chênh lệch tỷ giá hối đoái", code: "417", note: "V.29", level: 2 },
  { name: "8. Quỹ đầu tư phát triển", code: "418", level: 2 },
  { name: "9. Quỹ khác thuộc vốn chủ sở hữu", code: "419", level: 2 },
  { name: "10. Lợi nhuận sau thuế chưa phân phối", code: "420", level: 2 },
  { name: "- LNST chưa phân phối lũy kế đến cuối kỳ trước", code: "420a", level: 3 },
  { name: "- LNST chưa phân phối kỳ này", code: "420b", level: 3 },

  // TỔNG CỘNG NGUỒN VỐN
  { name: "TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)", code: "440", closingQuarter: 17000000, level: 0, isBold: true },
];

// 2. Full Catalogue of B02a - DN (Báo cáo kết quả hoạt động giữa niên độ) matching Screenshot
const FULL_B02A_DATA: InterimIncomeItem[] = [
  {
    id: "01",
    name: "1. Doanh thu bán hàng và cung cấp dịch vụ",
    code: "01",
    note: "VI.1",
    quarterCurrent: 20000000,
    accumCurrent: 20000000,
    isClickable: true,
  },
  {
    id: "02",
    name: "2. Các khoản giảm trừ doanh thu",
    code: "02",
    note: "VI.2",
    isClickable: true,
  },
  {
    id: "10",
    name: "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)",
    code: "10",
    note: "",
    quarterCurrent: 20000000,
    accumCurrent: 20000000,
    isBold: true,
  },
  {
    id: "11",
    name: "4. Giá vốn hàng bán",
    code: "11",
    note: "VI.3",
    isClickable: true,
  },
  {
    id: "20",
    name: "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)",
    code: "20",
    note: "",
    quarterCurrent: 20000000,
    accumCurrent: 20000000,
    isBold: true,
  },
  {
    id: "21",
    name: "6. Lãi/lỗ của hoạt động bán, thanh lý bất động sản đầu tư",
    code: "21",
    note: "VI.4",
    isClickable: true,
  },
  {
    id: "22",
    name: "7. Doanh thu hoạt động tài chính",
    code: "22",
    note: "VI.5",
    isClickable: true,
  },
  {
    id: "23",
    name: "8. Chi phí tài chính",
    code: "23",
    note: "VI.6",
    isClickable: true,
  },
  {
    id: "24",
    name: "- Trong đó: Chi phí đi vay",
    code: "24",
    note: "",
    indent: true,
  },
  {
    id: "25",
    name: "9. Chi phí bán hàng",
    code: "25",
    note: "VI.9",
    isClickable: true,
  },
  {
    id: "26",
    name: "10. Chi phí quản lý doanh nghiệp",
    code: "26",
    note: "VI.9",
    isClickable: true,
  },
  {
    id: "30",
    name: "11. Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + 21 + 22 - (23 + 25 + 26)}",
    code: "30",
    note: "",
    quarterCurrent: 20000000,
    accumCurrent: 20000000,
    isBold: true,
  },
  {
    id: "31",
    name: "12. Thu nhập khác",
    code: "31",
    note: "VI.7",
    isClickable: true,
  },
  {
    id: "32",
    name: "13. Chi phí khác",
    code: "32",
    note: "VI.8",
    isClickable: true,
  },
  {
    id: "40",
    name: "14. Lợi nhuận khác (40 = 31 - 32)",
    code: "40",
    note: "",
    isBold: true,
  },
  {
    id: "50",
    name: "15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)",
    code: "50",
    note: "",
    quarterCurrent: 20000000,
    accumCurrent: 20000000,
    isBold: true,
  },
  {
    id: "51",
    name: "16. Chi phí thuế TNDN hiện hành",
    code: "51",
    note: "VI.11",
    isClickable: true,
  },
  {
    id: "52",
    name: "17. Chi phí thuế TNDN hoãn lại",
    code: "52",
    note: "VI.11",
    isClickable: true,
  },
  {
    id: "60",
    name: "18. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)",
    code: "60",
    note: "",
    quarterCurrent: 20000000,
    accumCurrent: 20000000,
    isBold: true,
  },
  {
    id: "70",
    name: "19. Lãi cơ bản trên cổ phiếu (*)",
    code: "70",
    note: "",
  },
  {
    id: "71",
    name: "20. Lãi suy giảm trên cổ phiếu (*)",
    code: "71",
    note: "",
  },
];

// 3. Catalogue of B03a - DN (Báo cáo lưu chuyển tiền tệ giữa niên độ - PP trực tiếp)
const FULL_B03A_DATA: InterimCashFlowItem[] = [
  // I. Lưu chuyển tiền từ hoạt động kinh doanh
  { id: "sec_1", name: "I. Lưu chuyển tiền từ hoạt động kinh doanh", isHeader: true, isBold: true },
  { id: "01", name: "1. Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác", code: "01", isClickable: true },
  { id: "02", name: "2. Tiền chi trả cho người cung cấp hàng hóa và dịch vụ", code: "02", accumCurrent: -10000000, isClickable: true },
  { id: "03", name: "3. Tiền chi trả cho người lao động", code: "03", isClickable: true },
  { id: "04", name: "4. Chi phí lãi vay đã trả", code: "04", isClickable: true },
  { id: "05", name: "5. Thuế thu nhập doanh nghiệp đã nộp", code: "05", isClickable: true },
  { id: "06", name: "6. Tiền thu khác từ hoạt động kinh doanh", code: "06", isClickable: true },
  { id: "07", name: "7. Tiền chi khác cho hoạt động kinh doanh", code: "07", accumCurrent: -10000000, isClickable: true },
  { id: "20", name: "Lưu chuyển tiền thuần từ hoạt động kinh doanh", code: "20", accumCurrent: -20000000, isBold: true },

  // II. Lưu chuyển tiền từ hoạt động đầu tư
  { id: "sec_2", name: "II. Lưu chuyển tiền từ hoạt động đầu tư", isHeader: true, isBold: true },
  { id: "21", name: "1. Tiền chi để mua sắm, xây dựng TSCĐ và các tài sản dài hạn khác", code: "21", note: "V.8", isClickable: true },
  { id: "22", name: "2. Tiền thu từ thanh lý, nhượng bán TSCĐ và các tài sản dài hạn khác", code: "22", isClickable: true },
  { id: "23", name: "3. Tiền chi cho vay, mua các công cụ nợ của đơn vị khác", code: "23", isClickable: true },
  { id: "24", name: "4. Tiền thu hồi cho vay, bán lại các công cụ nợ của đơn vị khác", code: "24", isClickable: true },
  { id: "25", name: "5. Tiền chi đầu tư góp vốn vào đơn vị khác", code: "25", isClickable: true },
  { id: "26", name: "6. Tiền thu hồi đầu tư góp vốn vào đơn vị khác", code: "26", isClickable: true },
  { id: "27", name: "7. Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia", code: "27", isClickable: true },
  { id: "30", name: "Lưu chuyển tiền thuần từ hoạt động đầu tư", code: "30", isBold: true },

  // III. Lưu chuyển tiền từ hoạt động tài chính
  { id: "sec_3", name: "III. Lưu chuyển tiền từ hoạt động tài chính", isHeader: true, isBold: true },
  { id: "31", name: "1. Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu", code: "31", isClickable: true },
  { id: "32", name: "2. Tiền trả lại vốn góp cho các chủ sở hữu, mua lại cổ phiếu đã phát hành", code: "32", isClickable: true },
  { id: "33", name: "3. Tiền thu từ đi vay", code: "33", isClickable: true },
  { id: "34", name: "4. Tiền trả nợ gốc vay", code: "34", isClickable: true },
  { id: "35", name: "5. Tiền trả nợ gốc thuê tài chính", code: "35", isClickable: true },
  { id: "36", name: "6. Cổ tức, lợi nhuận đã trả cho chủ sở hữu", code: "36", isClickable: true },
  { id: "40", name: "Lưu chuyển tiền thuần từ hoạt động tài chính", code: "40", isBold: true },

  // Tổng kết cuối kỳ
  { id: "50", name: "Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)", code: "50", accumCurrent: -20000000, isBold: true },
  { id: "60", name: "Tiền và tương đương tiền đầu kỳ", code: "60", isBold: true },
  { id: "61", name: "Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ", code: "61" },
  { id: "70", name: "Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61)", code: "70", note: "V.1", accumCurrent: -20000000, isBold: true },
];

export interface MisaInterimFinancialPositionReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
  initialTab?: "B01a-DN" | "B02a-DN" | "B03a-DN";
}

export default function MisaInterimFinancialPositionReport({
  onBack,
  notify,
  initialTab = "B01a-DN",
}: MisaInterimFinancialPositionReportProps) {
  // Subtab navigation above table
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Drawer Parameters State matching Screenshot
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [period, setPeriod] = useState("Quý 4");
  const [year, setYear] = useState(2026);
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/12/2026");
  const [fetchFromSaved, setFetchFromSaved] = useState(false);
  const [hideZero, setHideZero] = useState(false);
  const [representative, setRepresentative] = useState("Trần Thị Hương");
  const [reportDate, setReportDate] = useState("07/10/2026");

  // Selected report in drawer checklist
  const [selectedSubReports, setSelectedSubReports] = useState<Record<string, boolean>>({
    "B01a-DN": true,
    "B02a-DN": false,
    "B03a-DN": false,
    "B03a-DN-GT": false,
  });

  // Temporary drawer draft state
  const [draftPeriod, setDraftPeriod] = useState("Quý 4");
  const [draftYear, setDraftYear] = useState(2026);
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/12/2026");
  const [draftFetchFromSaved, setDraftFetchFromSaved] = useState(false);
  const [draftHideZero, setDraftHideZero] = useState(false);
  const [draftRepresentative, setDraftRepresentative] = useState("Trần Thị Hương");
  const [draftReportDate, setDraftReportDate] = useState("07/10/2026");
  const [draftSubReports, setDraftSubReports] = useState<Record<string, boolean>>({
    "B01a-DN": true,
    "B02a-DN": false,
    "B03a-DN": false,
    "B03a-DN-GT": false,
  });

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  // Saved reports modal
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);

  // Drilldown modal item
  const [drilldownItem, setDrilldownItem] = useState<{ name: string; code: string; val?: number } | null>(null);

  const handleOpenDrawer = () => {
    setDraftPeriod(period);
    setDraftYear(year);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftFetchFromSaved(fetchFromSaved);
    setDraftHideZero(hideZero);
    setDraftRepresentative(representative);
    setDraftReportDate(reportDate);
    setDraftSubReports({ ...selectedSubReports });
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriod(draftPeriod);
    setYear(draftYear);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setFetchFromSaved(draftFetchFromSaved);
    setHideZero(draftHideZero);
    setRepresentative(draftRepresentative);
    setReportDate(draftReportDate);
    setSelectedSubReports({ ...draftSubReports });
    setIsParamDrawerOpen(false);
    notify?.("Đã tải lại báo cáo giữa niên độ với tham số mới.");
  };

  const handleResetParams = () => {
    setDraftPeriod("Quý 4");
    setDraftYear(2026);
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/12/2026");
    setDraftFetchFromSaved(false);
    setDraftHideZero(false);
  };

  // Format currency helper
  const formatValue = (val?: number) => {
    if (val === undefined || val === null) return { text: "", isNegative: false };
    if (val === 0) return { text: "0", isNegative: false };
    if (val < 0) {
      return {
        text: `(${Math.abs(val).toLocaleString("vi-VN")})`,
        isNegative: true,
      };
    }
    return {
      text: val.toLocaleString("vi-VN"),
      isNegative: false,
    };
  };

  // Filter rows for B01a-DN
  const filteredB01aRows = useMemo(() => {
    return FULL_B01A_DATA.filter((row) => {
      if (hideZero) {
        if (!row.closingQuarter && !row.openingYear) {
          return false;
        }
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return (
          row.name.toLowerCase().includes(kw) ||
          row.code.toLowerCase().includes(kw) ||
          (row.note && row.note.toLowerCase().includes(kw))
        );
      }
      return true;
    });
  }, [hideZero, searchKeyword]);

  // Filter rows for B02a-DN
  const filteredB02aRows = useMemo(() => {
    return FULL_B02A_DATA.filter((row) => {
      if (hideZero) {
        if (!row.quarterCurrent && !row.accumCurrent) {
          return false;
        }
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return (
          row.name.toLowerCase().includes(kw) ||
          row.code.toLowerCase().includes(kw) ||
          (row.note && row.note.toLowerCase().includes(kw))
        );
      }
      return true;
    });
  }, [hideZero, searchKeyword]);

  // Filter rows for B03a-DN
  const filteredB03aRows = useMemo(() => {
    return FULL_B03A_DATA.filter((row) => {
      if (row.isHeader) {
        if (!searchKeyword.trim()) return true;
      }
      if (hideZero && !row.isHeader) {
        if (!row.accumCurrent) return false;
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return row.name.toLowerCase().includes(kw) || (row.code && row.code.includes(kw));
      }
      return true;
    });
  }, [hideZero, searchKeyword]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#f1f5f9",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* 1. Top Header Bar matching MISA AMIS */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          minHeight: 48,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "transparent",
              border: "none",
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              borderRadius: 4,
            }}
            title="Quay lại danh mục báo cáo"
          >
            <ChevronLeft size={20} />
          </button>
          <h2
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: "-0.2px",
            }}
          >
            B01a - DN: Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={{
              height: 32,
              padding: "0 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => setIsSavedReportsOpen(true)}
          >
            Danh sách báo cáo đã lưu
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => notify?.(`Đã lưu ${activeTab} kỳ quý 4/2026 thành công.`)}
          >
            Lưu báo cáo
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 16px",
              background: "#00a862",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={handleOpenDrawer}
          >
            <span>Chọn tham số</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#334155",
              cursor: "pointer",
              fontWeight: 500,
            }}
            onClick={() => notify?.("Đang xuất khẩu báo cáo định dạng XML chuẩn Tổng cục Thuế...")}
          >
            <FileCode size={15} color="#d97706" />
            <span>Xuất XML</span>
          </button>

          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#0284c7",
              cursor: "pointer",
              fontWeight: 600,
            }}
            onClick={() => notify?.("Kết nối cổng nộp thuế điện tử MISA mTax...")}
          >
            <Send size={15} color="#0284c7" />
            <span>Nộp báo cáo qua MISA mTax</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 220 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: "100%",
                height: 30,
                padding: "0 10px 0 32px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                outline: "none",
                background: "#ffffff",
              }}
            />
          </div>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Làm mới"
            onClick={() => notify?.("Đã làm mới dữ liệu báo cáo giữa niên độ.")}
          >
            <RotateCw size={14} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi báo cáo qua email.")}
          >
            <Mail size={14} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0284c7",
              cursor: "pointer",
            }}
            title="Trợ giúp"
            onClick={() => notify?.("Hệ thống trợ giúp AVA Kế toán.")}
          >
            <MessageCircle size={14} />
          </button>

          <button
            type="button"
            style={{
              height: 30,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#334155",
              fontSize: 12.5,
              cursor: "pointer",
            }}
            onClick={() => notify?.("Đang chuẩn bị lệnh in...")}
          >
            <Printer size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{
              height: 30,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#334155",
              fontSize: 12.5,
              cursor: "pointer",
            }}
            onClick={() => notify?.(`Đã xuất khẩu báo cáo ${activeTab} ra Excel.`)}
          >
            <Download size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Tùy chỉnh cột"
            onClick={() => notify?.("Mở thiết lập cột báo cáo.")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 3. Subtabs Bar (B01a-DN, B02a-DN, B03a-DN) matching Screenshot 1 & 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 20px 0",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {[
          { id: "B01a-DN", label: "B01a - DN" },
          { id: "B02a-DN", label: "B02a - DN" },
          { id: "B03a-DN", label: "B03a - DN" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              style={{
                height: 32,
                padding: "0 16px",
                border: "1px solid",
                borderColor: isActive ? "#00a862" : "#cbd5e1",
                borderBottom: isActive ? "2px solid #00a862" : "1px solid #cbd5e1",
                borderRadius: "4px 4px 0 0",
                background: isActive ? "#ffffff" : "#f8fafc",
                color: isActive ? "#00a862" : "#475569",
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                marginBottom: -1,
              }}
              onClick={() => {
                setActiveTab(tab.id);
                notify?.(`Đã chuyển sang mẫu ${tab.label}.`);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 4. Main Report Sheet Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 4,
            border: "1px solid #cbd5e1",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            padding: "24px 28px 20px",
            minHeight: "100%",
          }}
        >
          {/* TAB 1: B01a - DN Báo cáo tình hình tài chính giữa niên độ */}
          {activeTab === "B01a-DN" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 700,
                    color: "#0f172a",
                    textTransform: "uppercase",
                    letterSpacing: "0.2px",
                  }}
                >
                  BÁO CÁO TÌNH HÌNH TÀI CHÍNH GIỮA NIÊN ĐỘ
                </h1>
                <div style={{ fontSize: 13, fontStyle: "italic", color: "#475569", marginTop: 4 }}>
                  (Dạng đầy đủ)
                </div>
                <div style={{ fontSize: 13, fontStyle: "italic", color: "#475569", marginTop: 2 }}>
                  Kỳ kế toán quý 4 năm 2026
                </div>
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  border: "1px solid #cbd5e1",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#e2f0d9",
                      borderBottom: "1px solid #cbd5e1",
                      color: "#1e293b",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    <th style={{ padding: "9px 12px", textAlign: "center", borderRight: "1px solid #c2d9b8" }}>
                      Chỉ tiêu
                    </th>
                    <th style={{ padding: "9px 10px", textAlign: "center", width: 70, borderRight: "1px solid #c2d9b8" }}>
                      Mã số
                    </th>
                    <th style={{ padding: "9px 10px", textAlign: "center", width: 110, borderRight: "1px solid #c2d9b8" }}>
                      Thuyết minh
                    </th>
                    <th style={{ padding: "9px 14px", textAlign: "center", width: 180, borderRight: "1px solid #c2d9b8" }}>
                      Số cuối quý
                    </th>
                    <th style={{ padding: "9px 14px", textAlign: "center", width: 160 }}>
                      Số đầu năm
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredB01aRows.map((row, index) => {
                    const closingVal = formatValue(row.closingQuarter);
                    const openingVal = formatValue(row.openingYear);

                    let indentPx = 12;
                    if (row.level === 1) indentPx = 18;
                    if (row.level === 2) indentPx = 26;
                    if (row.level === 3) indentPx = 36;

                    return (
                      <tr
                        key={row.code}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          background: index % 2 === 1 ? "#fafbfc" : "#ffffff",
                        }}
                      >
                        <td
                          style={{
                            padding: "7px 10px",
                            paddingLeft: indentPx,
                            borderRight: "1px solid #f1f5f9",
                            fontWeight: row.isBold ? 700 : 400,
                            color: row.isClickable ? "#0073e6" : "#1e293b",
                            cursor: row.isClickable ? "pointer" : "default",
                          }}
                          onClick={() => {
                            if (row.isClickable) {
                              setDrilldownItem({ name: row.name, code: row.code, val: row.closingQuarter });
                              notify?.(`Xem chi tiết chỉ tiêu "${row.name}" (Mã ${row.code})`);
                            }
                          }}
                        >
                          {row.name}
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9", color: "#475569", fontWeight: row.isBold ? 700 : 400 }}>
                          {row.code}
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9", color: "#64748b" }}>
                          {row.note || ""}
                        </td>
                        <td
                          style={{
                            padding: "7px 14px",
                            textAlign: "right",
                            borderRight: "1px solid #f1f5f9",
                            color: closingVal.isNegative ? "#dc2626" : "#1e293b",
                            fontWeight: row.isBold || closingVal.isNegative ? 700 : 400,
                          }}
                        >
                          {closingVal.text}
                        </td>
                        <td style={{ padding: "7px 14px", textAlign: "right", color: "#1e293b", fontWeight: row.isBold ? 700 : 400 }}>
                          {openingVal.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* TAB 2: B02a - DN Báo cáo kết quả hoạt động giữa niên độ (Dạng đầy đủ) matching Screenshot 1 & 2 */}
          {activeTab === "B02a-DN" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 700,
                    color: "#0f172a",
                    textTransform: "uppercase",
                    letterSpacing: "0.2px",
                  }}
                >
                  BÁO CÁO KẾT QUẢ HOẠT ĐỘNG GIỮA NIÊN ĐỘ
                </h1>
                <div style={{ fontSize: 13, fontStyle: "italic", color: "#475569", marginTop: 4 }}>
                  (Dạng đầy đủ)
                </div>
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  border: "1px solid #cbd5e1",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#e2f0d9",
                      borderBottom: "1px solid #cbd5e1",
                      color: "#1e293b",
                      fontWeight: 700,
                    }}
                  >
                    <th rowSpan={2} style={{ padding: "9px 12px", textAlign: "center", borderRight: "1px solid #c2d9b8" }}>
                      Chỉ tiêu
                    </th>
                    <th rowSpan={2} style={{ padding: "9px 8px", textAlign: "center", width: 60, borderRight: "1px solid #c2d9b8" }}>
                      Mã số
                    </th>
                    <th rowSpan={2} style={{ padding: "9px 8px", textAlign: "center", width: 95, borderRight: "1px solid #c2d9b8" }}>
                      Thuyết minh
                    </th>
                    <th colSpan={2} style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #c2d9b8" }}>
                      Quý 4
                    </th>
                    <th colSpan={2} style={{ padding: "7px 10px", textAlign: "center" }}>
                      Lũy kế từ đầu năm đến cuối quý này
                    </th>
                  </tr>
                  <tr
                    style={{
                      background: "#e2f0d9",
                      borderBottom: "1px solid #cbd5e1",
                      color: "#1e293b",
                      fontWeight: 700,
                    }}
                  >
                    <th style={{ padding: "6px 10px", textAlign: "center", width: 140, borderRight: "1px solid #c2d9b8" }}>
                      Năm nay
                    </th>
                    <th style={{ padding: "6px 10px", textAlign: "center", width: 140, borderRight: "1px solid #c2d9b8" }}>
                      Năm trước
                    </th>
                    <th style={{ padding: "6px 10px", textAlign: "center", width: 140, borderRight: "1px solid #c2d9b8" }}>
                      Năm nay
                    </th>
                    <th style={{ padding: "6px 10px", textAlign: "center", width: 140 }}>
                      Năm trước
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredB02aRows.map((row, index) => {
                    const qCur = formatValue(row.quarterCurrent ?? 0);
                    const qPrev = formatValue(row.quarterPrevious ?? 0);
                    const accCur = formatValue(row.accumCurrent ?? 0);
                    const accPrev = formatValue(row.accumPrevious ?? 0);

                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          background: index % 2 === 1 ? "#fafbfc" : "#ffffff",
                        }}
                      >
                        <td
                          style={{
                            padding: "7px 10px",
                            paddingLeft: row.indent ? 24 : 12,
                            borderRight: "1px solid #f1f5f9",
                            fontWeight: row.isBold ? 700 : 400,
                            color: row.isClickable ? "#0073e6" : "#1e293b",
                            cursor: row.isClickable ? "pointer" : "default",
                          }}
                          onClick={() => {
                            if (row.isClickable) {
                              setDrilldownItem({ name: row.name, code: row.code, val: row.quarterCurrent });
                              notify?.(`Xem chi tiết "${row.name}" (Mã ${row.code})`);
                            }
                          }}
                        >
                          {row.name}
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "center", borderRight: "1px solid #f1f5f9", color: "#475569", fontWeight: row.isBold ? 700 : 400 }}>
                          {row.code}
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "center", borderRight: "1px solid #f1f5f9", color: "#64748b" }}>
                          {row.note || ""}
                        </td>
                        {/* Quý IV - Năm nay */}
                        <td
                          style={{
                            padding: "7px 10px",
                            textAlign: "right",
                            borderRight: "1px solid #f1f5f9",
                            fontWeight: row.isBold ? 700 : 400,
                            color: qCur.isNegative ? "#dc2626" : "#1e293b",
                          }}
                        >
                          {qCur.text}
                        </td>
                        {/* Quý IV - Năm trước */}
                        <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #f1f5f9", color: "#1e293b" }}>
                          {qPrev.text}
                        </td>
                        {/* Lũy kế - Năm nay */}
                        <td
                          style={{
                            padding: "7px 10px",
                            textAlign: "right",
                            borderRight: "1px solid #f1f5f9",
                            fontWeight: row.isBold ? 700 : 400,
                            color: accCur.isNegative ? "#dc2626" : "#1e293b",
                          }}
                        >
                          {accCur.text}
                        </td>
                        {/* Lũy kế - Năm trước */}
                        <td style={{ padding: "7px 10px", textAlign: "right", color: "#1e293b" }}>
                          {accPrev.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* TAB 3: B03a - DN Báo cáo lưu chuyển tiền tệ giữa niên độ */}
          {activeTab === "B03a-DN" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#0f172a",
                    textTransform: "uppercase",
                    letterSpacing: "0.2px",
                  }}
                >
                  BÁO CÁO LƯU CHUYỂN TIỀN TỆ GIỮA NIÊN ĐỘ
                </h1>
                <div style={{ fontSize: 13, fontStyle: "italic", color: "#475569", marginTop: 4 }}>
                  (Dạng đầy đủ - Phương pháp trực tiếp)
                </div>
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  border: "1px solid #cbd5e1",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#e2f0d9",
                      borderBottom: "1px solid #cbd5e1",
                      color: "#1e293b",
                      fontWeight: 700,
                    }}
                  >
                    <th
                      rowSpan={2}
                      style={{
                        padding: "8px 12px",
                        textAlign: "center",
                        borderRight: "1px solid #c2d9b8",
                        verticalAlign: "middle",
                      }}
                    >
                      Chỉ tiêu
                    </th>
                    <th
                      rowSpan={2}
                      style={{
                        padding: "8px 8px",
                        textAlign: "center",
                        width: 70,
                        borderRight: "1px solid #c2d9b8",
                        verticalAlign: "middle",
                      }}
                    >
                      Mã số
                    </th>
                    <th
                      rowSpan={2}
                      style={{
                        padding: "8px 8px",
                        textAlign: "center",
                        width: 100,
                        borderRight: "1px solid #c2d9b8",
                        verticalAlign: "middle",
                      }}
                    >
                      Thuyết minh
                    </th>
                    <th
                      colSpan={2}
                      style={{
                        padding: "8px 14px",
                        textAlign: "center",
                        borderBottom: "1px solid #c2d9b8",
                      }}
                    >
                      Lũy kế từ đầu năm tới cuối quý này
                    </th>
                  </tr>
                  <tr
                    style={{
                      background: "#e2f0d9",
                      borderBottom: "1px solid #cbd5e1",
                      color: "#1e293b",
                      fontWeight: 700,
                    }}
                  >
                    <th
                      style={{
                        padding: "7px 14px",
                        textAlign: "center",
                        width: 150,
                        borderRight: "1px solid #c2d9b8",
                      }}
                    >
                      Năm nay
                    </th>
                    <th
                      style={{
                        padding: "7px 14px",
                        textAlign: "center",
                        width: 150,
                      }}
                    >
                      Năm trước
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredB03aRows.map((row, index) => {
                    const accCur = formatValue(row.accumCurrent);
                    const accPrev = formatValue(row.accumPrevious);

                    if (row.isHeader) {
                      return (
                        <tr
                          key={row.id}
                          style={{
                            borderBottom: "1px solid #e2e8f0",
                            background: index % 2 === 1 ? "#fafbfc" : "#ffffff",
                            fontWeight: 700,
                          }}
                        >
                          <td
                            style={{
                              padding: "7px 12px",
                              borderRight: "1px solid #f1f5f9",
                              color: "#0f172a",
                              fontWeight: 700,
                            }}
                          >
                            {row.name}
                          </td>
                          <td style={{ padding: "7px 8px", borderRight: "1px solid #f1f5f9" }} />
                          <td style={{ padding: "7px 8px", borderRight: "1px solid #f1f5f9" }} />
                          <td style={{ padding: "7px 14px", borderRight: "1px solid #f1f5f9" }} />
                          <td style={{ padding: "7px 14px" }} />
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          background: index % 2 === 1 ? "#fafbfc" : "#ffffff",
                        }}
                      >
                        <td
                          style={{
                            padding: "7px 12px",
                            borderRight: "1px solid #f1f5f9",
                            fontWeight: row.isBold ? 700 : 400,
                            color: "#1e293b",
                          }}
                        >
                          {row.name}
                        </td>
                        <td
                          style={{
                            padding: "7px 8px",
                            textAlign: "center",
                            borderRight: "1px solid #f1f5f9",
                            color: "#475569",
                          }}
                        >
                          {row.code}
                        </td>
                        <td
                          style={{
                            padding: "7px 8px",
                            textAlign: "center",
                            borderRight: "1px solid #f1f5f9",
                            color: "#64748b",
                          }}
                        >
                          {row.note || ""}
                        </td>
                        <td
                          onClick={() => {
                            if (row.isClickable && row.accumCurrent !== undefined) {
                              setDrilldownItem({
                                name: row.name,
                                code: row.code || "",
                                val: row.accumCurrent,
                              });
                            }
                          }}
                          style={{
                            padding: "7px 14px",
                            textAlign: "right",
                            borderRight: "1px solid #f1f5f9",
                            color: accCur.isNegative ? "#dc2626" : "#1e293b",
                            fontWeight: row.isBold || accCur.isNegative ? 700 : 400,
                            cursor: row.isClickable && row.accumCurrent !== undefined ? "pointer" : "default",
                          }}
                        >
                          {accCur.text}
                        </td>
                        <td
                          style={{
                            padding: "7px 14px",
                            textAlign: "right",
                            color: accPrev.isNegative ? "#dc2626" : "#1e293b",
                            fontWeight: row.isBold || accPrev.isNegative ? 700 : 400,
                          }}
                        >
                          {accPrev.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* 5. Footer Pagination Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 4px",
            fontSize: 13,
            color: "#475569",
          }}
        >
          <div>
            Tổng số: <strong>{activeTab === "B01a-DN" ? filteredB01aRows.length : activeTab === "B02a-DN" ? filteredB02aRows.length : filteredB03aRows.length}</strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Số dòng/trang</span>
              <select
                style={{
                  height: 26,
                  padding: "0 6px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 12.5,
                }}
                defaultValue="50"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                disabled
                style={{
                  width: 26,
                  height: 26,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  borderRadius: 4,
                  color: "#94a3b8",
                  cursor: "not-allowed",
                }}
              >
                &lt;&lt;
              </button>
              <button
                type="button"
                disabled
                style={{
                  width: 26,
                  height: 26,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  borderRadius: 4,
                  color: "#94a3b8",
                  cursor: "not-allowed",
                }}
              >
                &lt;
              </button>
              <span
                style={{
                  minWidth: 26,
                  height: 26,
                  padding: "0 6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #00a862",
                  borderRadius: 4,
                  background: "#e6f7ef",
                  color: "#00a862",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                1
              </span>
              <button
                type="button"
                disabled
                style={{
                  width: 26,
                  height: 26,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  borderRadius: 4,
                  color: "#94a3b8",
                  cursor: "not-allowed",
                }}
              >
                &gt;
              </button>
              <button
                type="button"
                disabled
                style={{
                  width: 26,
                  height: 26,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  borderRadius: 4,
                  color: "#94a3b8",
                  cursor: "not-allowed",
                }}
              >
                &gt;&gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Parameter Drawer "Chọn tham số" */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(1px)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#ffffff",
              height: "100%",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              animation: "slideInRight 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Giúp"
                  onClick={() =>
                    notify?.("Xem hướng dẫn lập báo cáo tài chính giữa niên độ.")
                  }
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Đóng"
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              style={{
                padding: "20px 24px",
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                fontSize: 13,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                    Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    value={draftPeriod}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftPeriod(val);
                      if (val === "Quý 4") {
                        setDraftFromDate("01/10/2026");
                        setDraftToDate("31/12/2026");
                      } else if (val === "Quý 3") {
                        setDraftFromDate("01/07/2026");
                        setDraftToDate("30/09/2026");
                      } else if (val === "6 tháng đầu năm") {
                        setDraftFromDate("01/01/2026");
                        setDraftToDate("30/06/2026");
                      }
                    }}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 13,
                      outline: "none",
                    }}
                  >
                    <option value="Quý 4">Quý 4</option>
                    <option value="Quý 3">Quý 3</option>
                    <option value="Quý 2">Quý 2</option>
                    <option value="Quý 1">Quý 1</option>
                    <option value="6 tháng đầu năm">6 tháng đầu năm</option>
                    <option value="9 tháng">9 tháng</option>
                    <option value="Tùy chọn">Tùy chọn</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                    Năm
                  </label>
                  <input
                    type="number"
                    value={draftYear}
                    onChange={(e) => setDraftYear(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftFromDate}
                      onChange={(e) => setDraftFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftToDate}
                      onChange={(e) => setDraftToDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={draftFetchFromSaved}
                    onChange={(e) => setDraftFetchFromSaved(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Lấy dữ liệu từ báo cáo tài chính giữa niên độ đã lập</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={draftHideZero}
                    onChange={(e) => setDraftHideZero(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Không hiển thị các chỉ tiêu có số liệu = 0</span>
                </label>
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#e2f0d9", borderBottom: "1px solid #cbd5e1", color: "#1e293b", textAlign: "left" }}>
                      <th style={{ width: 36, padding: "8px 10px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={Object.values(draftSubReports).every(Boolean)}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setDraftSubReports({
                              "B01a-DN": val,
                              "B02a-DN": val,
                              "B03a-DN": val,
                              "B03a-DN-GT": val,
                            });
                          }}
                          style={{ accentColor: "#00a862" }}
                        />
                      </th>
                      <th style={{ width: 110, padding: "8px 10px", fontWeight: 700 }}>Mã báo cáo</th>
                      <th style={{ padding: "8px 10px", fontWeight: 700 }}>Tên báo cáo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: "B01a-DN", code: "B01a - DN", name: "B01a - DN: Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)" },
                      { id: "B02a-DN", code: "B02a - DN", name: "B02a - DN: Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)" },
                      { id: "B03a-DN", code: "B03a - DN", name: "B03a - DN: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP trực tiếp)" },
                      { id: "B03a-DN-GT", code: "B03a - DN - GT", name: "B03a - DN - GT: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP gián tiếp)" },
                    ].map((item, idx) => (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: idx < 3 ? "1px solid #f1f5f9" : "none",
                          background: draftSubReports[item.id] ? "#f0fdf4" : idx % 2 === 1 ? "#fafbfc" : "#ffffff",
                        }}
                      >
                        <td style={{ padding: "7px 10px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={!!draftSubReports[item.id]}
                            onChange={(e) => {
                              setDraftSubReports((prev) => ({
                                ...prev,
                                [item.id]: e.target.checked,
                              }));
                            }}
                            style={{ accentColor: "#00a862" }}
                          />
                        </td>
                        <td style={{ padding: "7px 10px", fontWeight: 600 }}>{item.code}</td>
                        <td style={{ padding: "7px 10px", color: "#334155" }}>{item.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12, marginTop: 4 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Người đại diện theo pháp luật
                  </label>
                  <input
                    type="text"
                    value={draftRepresentative}
                    onChange={(e) => setDraftRepresentative(e.target.value)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Ngày lập
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftReportDate}
                      onChange={(e) => setDraftReportDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 18px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#334155",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                onClick={() => setIsParamDrawerOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 22px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={handleApplyParams}
              >
                Xem báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Drill-down Sổ chi tiết */}
      {drilldownItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setDrilldownItem(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
              width: "100%",
              maxWidth: 760,
              maxHeight: "85vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    background: "#e0f2fe",
                    color: "#0369a1",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Mã {drilldownItem.code}
                </span>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                  {drilldownItem.name}
                </h3>
              </div>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setDrilldownItem(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 12.5, color: "#64748b" }}>
                <span>Kỳ: <strong>Quý 4/{year}</strong> (Từ {fromDate} đến {toDate})</span>
                <span>Số phát sinh / Số dư: <strong style={{ color: "#00a862" }}>{formatValue(drilldownItem.val).text} đ</strong></span>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #e2e8f0" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left", color: "#334155" }}>
                    <th style={{ padding: "8px 10px" }}>Ngày CT</th>
                    <th style={{ padding: "8px 10px" }}>Số CT</th>
                    <th style={{ padding: "8px 10px" }}>Diễn giải</th>
                    <th style={{ padding: "8px 10px" }}>TK đối ứng</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Số tiền (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldownItem.val && drilldownItem.val > 0 ? (
                    <tr>
                      <td style={{ padding: "8px 10px" }}>15/10/2026</td>
                      <td style={{ padding: "8px 10px", color: "#0284c7", fontWeight: 600 }}>CT001</td>
                      <td style={{ padding: "8px 10px" }}>Giao dịch phát sinh liên quan chỉ tiêu {drilldownItem.name}</td>
                      <td style={{ padding: "8px 10px" }}>131 / 511</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#00a862" }}>
                        {formatValue(drilldownItem.val).text}
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>
                        Không có chứng từ phát sinh trong kỳ.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <button
                type="button"
                style={{
                  height: 32,
                  padding: "0 18px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setDrilldownItem(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Danh sách báo cáo đã lưu */}
      {isSavedReportsOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setIsSavedReportsOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
              width: "100%",
              maxWidth: 620,
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Danh sách báo cáo B01a-DN / B02a-DN đã lưu
              </h3>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setIsSavedReportsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e2e8f0" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left", color: "#475569" }}>
                  <th style={{ padding: "8px 12px" }}>Tên phiên bản</th>
                  <th style={{ padding: "8px 12px" }}>Kỳ áp dụng</th>
                  <th style={{ padding: "8px 12px" }}>Ngày lưu</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>Bộ BCTC giữa niên độ Quý 4/2026 (Chính thức)</td>
                  <td style={{ padding: "8px 12px" }}>Quý 4/2026</td>
                  <td style={{ padding: "8px 12px", color: "#64748b" }}>07/10/2026</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <button
                      type="button"
                      style={{
                        padding: "3px 10px",
                        background: "#f0fdf4",
                        color: "#166534",
                        border: "1px solid #bbf7d0",
                        borderRadius: 4,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setIsSavedReportsOpen(false);
                        notify?.("Đã tải bản lưu Bộ BCTC giữa niên độ Quý 4/2026.");
                      }}
                    >
                      Mở lại
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                style={{
                  height: 32,
                  padding: "0 18px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setIsSavedReportsOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
