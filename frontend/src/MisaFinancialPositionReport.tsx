import React, { useState, useMemo, useEffect, useCallback } from "react";
import { apiClient, getSelectedCompanyId } from "./apiClient";
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
  AlertTriangle,
  CheckCircle2,
  History,
  Layers,
  ExternalLink,
  ShieldCheck,
  PlusCircle,
} from "lucide-react";

export interface BalanceSheetItem {
  line_id?: string;
  name: string;
  code: string;
  note?: string;
  noteStatus?: string;
  closing?: number | null;
  opening?: number | null;
  formattedClosing?: string;
  formattedOpening?: string;
  level: number;
  lineType?: "DETAIL" | "SUBTOTAL" | "TOTAL" | "SECTION" | string;
  parentCode?: string;
  formula?: string;
  isNegativePresentation?: boolean;
  contentStatus?: "COMPLETE" | "UNMAPPED" | "FORMULA_ERROR" | string;
  isBold?: boolean;
  isClickable?: boolean;
}

// Complete 126-line Catalogue of B01-DN matching Circular 99/2025/TT-BTC
const FULL_B01_DATA: BalanceSheetItem[] = [
  // A. TÀI SẢN NGẮN HẠN (32 dòng: 100..165)
  { name: "A - TÀI SẢN NGẮN HẠN (100 = 110 + 120 + 130 + 140 + 150 + 160)", code: "100", level: 0, lineType: "SUBTOTAL", formula: "110 + 120 + 130 + 140 + 150 + 160", isBold: true, isClickable: true },
  { name: "I. Tiền và các khoản tương đương tiền (110 = 111 + 112)", code: "110", parentCode: "100", level: 1, lineType: "SUBTOTAL", formula: "111 + 112", isBold: true, isClickable: true },
  { name: "1. Tiền", code: "111", note: "V.01", parentCode: "110", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Các khoản tương đương tiền", code: "112", note: "V.01", parentCode: "110", level: 2, lineType: "DETAIL", isClickable: true },

  { name: "II. Đầu tư tài chính ngắn hạn (120 = 121 + 122 + 123 + 124 + 125 + 126)", code: "120", parentCode: "100", level: 1, lineType: "SUBTOTAL", formula: "121 + 122 + 123 + 124 + 125 + 126", isBold: true, isClickable: true },
  { name: "1. Chứng khoán kinh doanh", code: "121", note: "V.02(a)", parentCode: "120", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Dự phòng giảm giá chứng khoán kinh doanh (*)", code: "122", note: "V.02(a)", parentCode: "120", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },
  { name: "3. Đầu tư nắm giữ đến ngày đáo hạn", code: "123", note: "V.02(b)", parentCode: "120", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "4. Dự phòng đầu tư nắm giữ đến ngày đáo hạn ngắn hạn (*)", code: "124", note: "V.02(b)", parentCode: "120", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },
  { name: "5. Đầu tư ngắn hạn khác", code: "125", note: "V.02(c)", parentCode: "120", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "6. Dự phòng tổn thất các khoản đầu tư ngắn hạn khác (*)", code: "126", note: "V.02(c)", parentCode: "120", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },

  { name: "III. Các khoản phải thu ngắn hạn (130 = 131 + 132 + 133 + 134 + 135 + 136 + 137)", code: "130", parentCode: "100", level: 1, lineType: "SUBTOTAL", formula: "131 + 132 + 133 + 134 + 135 + 136 + 137", isBold: true, isClickable: true },
  { name: "1. Phải thu ngắn hạn của khách hàng", code: "131", note: "V.03(a)", parentCode: "130", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Trả trước cho người bán ngắn hạn", code: "132", note: "V.03(b)", parentCode: "130", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "3. Phải thu nội bộ ngắn hạn", code: "133", note: "V.03(c)", parentCode: "130", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "4. Phải thu theo tiến độ kế hoạch hợp đồng xây dựng", code: "134", note: "V.03(d)", parentCode: "130", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "5. Phải thu ngắn hạn khác", code: "135", note: "V.04(a)", parentCode: "130", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "6. Dự phòng phải thu ngắn hạn khó đòi (*)", code: "136", note: "V.05", parentCode: "130", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },
  { name: "7. Tài sản thiếu chờ xử lý", code: "137", note: "V.06", parentCode: "130", level: 2, lineType: "DETAIL", isClickable: true },

  { name: "IV. Hàng tồn kho (140 = 141 + 142)", code: "140", parentCode: "100", level: 1, lineType: "SUBTOTAL", formula: "141 + 142", isBold: true, isClickable: true },
  { name: "1. Hàng tồn kho", code: "141", note: "V.07", parentCode: "140", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Dự phòng giảm giá hàng tồn kho (*)", code: "142", note: "V.07", parentCode: "140", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },

  { name: "V. Tài sản sinh học ngắn hạn (150 = 151 + 152 + 153)", code: "150", parentCode: "100", level: 1, lineType: "SUBTOTAL", formula: "151 + 152 + 153", isBold: true, isClickable: true },
  { name: "1. Súc vật nuôi lấy sản phẩm một lần ngắn hạn", code: "151", note: "V.12(a)", parentCode: "150", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần ngắn hạn", code: "152", note: "V.12(b)", parentCode: "150", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "3. Dự phòng tổn thất tài sản sinh học ngắn hạn (*)", code: "153", note: "V.12(c)", parentCode: "150", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },

  { name: "VI. Tài sản ngắn hạn khác (160 = 161 + 162 + 163 + 164 + 165)", code: "160", parentCode: "100", level: 1, lineType: "SUBTOTAL", formula: "161 + 162 + 163 + 164 + 165", isBold: true, isClickable: true },
  { name: "1. Chi phí trả trước ngắn hạn", code: "161", note: "V.14(a)", parentCode: "160", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Thuế GTGT được khấu trừ", code: "162", note: "V.19(b)", parentCode: "160", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "3. Thuế và các khoản khác phải thu Nhà nước", code: "163", note: "V.19(b)", parentCode: "160", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "4. Giao dịch mua bán lại trái phiếu Chính phủ", code: "164", note: "V.23", parentCode: "160", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "5. Tài sản ngắn hạn khác", code: "165", note: "V.15(a)", parentCode: "160", level: 2, lineType: "DETAIL", isClickable: true },

  // B. TÀI SẢN DÀI HẠN (48 dòng: 200..274 + 280)
  { name: "B - TÀI SẢN DÀI HẠN (200 = 210 + 220 + 230 + 240 + 250 + 260 + 270)", code: "200", level: 0, lineType: "SUBTOTAL", formula: "210 + 220 + 230 + 240 + 250 + 260 + 270", isBold: true, isClickable: true },
  { name: "I. Các khoản phải thu dài hạn (210 = 211 + 212 + 213 + 214 + 215 + 216)", code: "210", parentCode: "200", level: 1, lineType: "SUBTOTAL", formula: "211 + 212 + 213 + 214 + 215 + 216", isBold: true, isClickable: true },
  { name: "1. Phải thu dài hạn của khách hàng", code: "211", note: "V.03(a)", parentCode: "210", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Trả trước cho người bán dài hạn", code: "212", note: "V.03(b)", parentCode: "210", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "3. Vốn kinh doanh ở đơn vị trực thuộc", code: "213", note: "V.03(c)", parentCode: "210", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "4. Phải thu nội bộ dài hạn", code: "214", note: "V.03(c)", parentCode: "210", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "5. Phải thu dài hạn khác", code: "215", note: "V.04(b)", parentCode: "210", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "6. Dự phòng phải thu dài hạn khó đòi (*)", code: "216", note: "V.05", parentCode: "210", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },

  { name: "II. Tài sản cố định (220 = 221 + 224 + 227)", code: "220", parentCode: "200", level: 1, lineType: "SUBTOTAL", formula: "221 + 224 + 227", isBold: true, isClickable: true },
  { name: "1. Tài sản cố định hữu hình (221 = 222 + 223)", code: "221", note: "V.09", parentCode: "220", level: 2, lineType: "SUBTOTAL", formula: "222 + 223", isClickable: true },
  { name: "- Nguyên giá", code: "222", note: "V.09", parentCode: "221", level: 3, lineType: "DETAIL", isClickable: true },
  { name: "- Giá trị hao mòn lũy kế (*)", code: "223", note: "V.09", parentCode: "221", level: 3, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },
  { name: "2. Tài sản cố định thuê tài chính (224 = 225 + 226)", code: "224", note: "V.11", parentCode: "220", level: 2, lineType: "SUBTOTAL", formula: "225 + 226", isClickable: true },
  { name: "- Nguyên giá", code: "225", note: "V.11", parentCode: "224", level: 3, lineType: "DETAIL", isClickable: true },
  { name: "- Giá trị hao mòn lũy kế (*)", code: "226", note: "V.11", parentCode: "224", level: 3, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },
  { name: "3. Tài sản cố định vô hình (227 = 228 + 229)", code: "227", note: "V.10", parentCode: "220", level: 2, lineType: "SUBTOTAL", formula: "228 + 229", isClickable: true },
  { name: "- Nguyên giá", code: "228", note: "V.10", parentCode: "227", level: 3, lineType: "DETAIL", isClickable: true },
  { name: "- Giá trị hao mòn lũy kế (*)", code: "229", note: "V.10", parentCode: "227", level: 3, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },

  { name: "III. Tài sản sinh học dài hạn (230 = 231 + 236 + 237 + 238)", code: "230", parentCode: "200", level: 1, lineType: "SUBTOTAL", formula: "231 + 236 + 237 + 238", isBold: true, isClickable: true },
  { name: "1. Súc vật nuôi cho sản phẩm định kỳ (231 = 232 + 233)", code: "231", note: "V.12", parentCode: "230", level: 2, lineType: "SUBTOTAL", formula: "232 + 233", isClickable: true },
  { name: "a) Súc vật nuôi cho sản phẩm định kỳ chưa đến giai đoạn trưởng thành", code: "232", note: "V.12", parentCode: "231", level: 3, lineType: "DETAIL", isClickable: true },
  { name: "b) Súc vật nuôi cho sản phẩm định kỳ đến giai đoạn trưởng thành (233 = 234 + 235)", code: "233", note: "V.12", parentCode: "231", level: 3, lineType: "SUBTOTAL", formula: "234 + 235", isClickable: true },
  { name: "- Nguyên giá", code: "234", note: "V.12", parentCode: "233", level: 4, lineType: "DETAIL", isClickable: true },
  { name: "- Giá trị khấu hao lũy kế (*)", code: "235", note: "V.12", parentCode: "233", level: 4, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },
  { name: "2. Súc vật nuôi lấy sản phẩm một lần dài hạn", code: "236", note: "V.12", parentCode: "230", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "3. Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần dài hạn", code: "237", note: "V.12", parentCode: "230", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "4. Dự phòng tổn thất tài sản sinh học dài hạn (*)", code: "238", note: "V.12", parentCode: "230", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },

  { name: "IV. Bất động sản đầu tư (240 = 241 + 242)", code: "240", note: "V.13", parentCode: "200", level: 1, lineType: "SUBTOTAL", formula: "241 + 242", isBold: true, isClickable: true },
  { name: "- Nguyên giá", code: "241", note: "V.13", parentCode: "240", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "- Giá trị hao mòn lũy kế (*)", code: "242", note: "V.13", parentCode: "240", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },

  { name: "V. Tài sản dở dang dài hạn (250 = 251 + 252)", code: "250", parentCode: "200", level: 1, lineType: "SUBTOTAL", formula: "251 + 252", isBold: true, isClickable: true },
  { name: "1. Chi phí sản xuất, kinh doanh dở dang dài hạn", code: "251", note: "V.08(a)", parentCode: "250", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Chi phí xây dựng cơ bản dở dang", code: "252", note: "V.08(b)", parentCode: "250", level: 2, lineType: "DETAIL", isClickable: true },

  { name: "VI. Đầu tư tài chính dài hạn (260 = 261 + 262 + 263 + 264 + 265 + 266)", code: "260", parentCode: "200", level: 1, lineType: "SUBTOTAL", formula: "261 + 262 + 263 + 264 + 265 + 266", isBold: true, isClickable: true },
  { name: "1. Đầu tư vào công ty con", code: "261", note: "V.02(c)", parentCode: "260", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Đầu tư vào công ty liên doanh, liên kết", code: "262", note: "V.02(c)", parentCode: "260", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "3. Đầu tư góp vốn vào đơn vị khác", code: "263", note: "V.02(c)", parentCode: "260", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "4. Dự phòng tổn thất đầu tư tài chính dài hạn (*)", code: "264", note: "V.02(c)", parentCode: "260", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },
  { name: "5. Đầu tư nắm giữ đến ngày đáo hạn", code: "265", note: "V.02(b)", parentCode: "260", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "6. Dự phòng đầu tư nắm giữ đến ngày đáo hạn dài hạn (*)", code: "266", note: "V.02(b)", parentCode: "260", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },

  { name: "VII. Tài sản dài hạn khác (270 = 271 + 272 + 273 + 274)", code: "270", parentCode: "200", level: 1, lineType: "SUBTOTAL", formula: "271 + 272 + 273 + 274", isBold: true, isClickable: true },
  { name: "1. Chi phí trả trước dài hạn", code: "271", note: "V.14(b)", parentCode: "270", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Tài sản thuế thu nhập hoãn lại", code: "272", note: "V.26(a)", parentCode: "270", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "3. Thiết bị, vật tư, phụ tùng thay thế dài hạn", code: "273", note: "V.07", parentCode: "270", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "4. Tài sản dài hạn khác", code: "274", note: "V.15(b)", parentCode: "270", level: 2, lineType: "DETAIL", isClickable: true },

  { name: "TỔNG CỘNG TÀI SẢN (280 = 100 + 200)", code: "280", level: 0, lineType: "TOTAL", formula: "100 + 200", isBold: true, isClickable: true },

  // C - NỢ PHẢI TRẢ (31 dòng: 300..344)
  { name: "C - NỢ PHẢI TRẢ (300 = 310 + 330)", code: "300", level: 0, lineType: "SUBTOTAL", formula: "310 + 330", isBold: true, isClickable: true },
  { name: "I. Nợ ngắn hạn (310 = 311 + ... + 325)", code: "310", parentCode: "300", level: 1, lineType: "SUBTOTAL", formula: "311 + 312 + 313 + 314 + 315 + 316 + 317 + 318 + 319 + 320 + 321 + 322 + 323 + 324 + 325", isBold: true, isClickable: true },
  { name: "1. Phải trả người bán ngắn hạn", code: "311", note: "V.17(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Người mua trả tiền trước ngắn hạn", code: "312", note: "V.18(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "3. Cổ tức, lợi nhuận phải trả", code: "313", note: "V.21(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "4. Thuế và các khoản phải nộp Nhà nước", code: "314", note: "V.19(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "5. Phải trả người lao động", code: "315", note: "V.21(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "6. Chi phí phải trả ngắn hạn", code: "316", note: "V.20(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "7. Phải trả nội bộ ngắn hạn", code: "317", note: "V.21(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "8. Phải trả theo tiến độ kế hoạch hợp đồng xây dựng", code: "318", note: "V.21(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "9. Doanh thu chưa thực hiện ngắn hạn", code: "319", note: "V.22(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "10. Phải trả ngắn hạn khác", code: "320", note: "V.21(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "11. Vay và nợ thuê tài chính ngắn hạn", code: "321", note: "V.16(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "12. Dự phòng phải trả ngắn hạn", code: "322", note: "V.25(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "13. Quỹ khen thưởng, phúc lợi", code: "323", note: "V.21(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "14. Quỹ bình ổn giá", code: "324", note: "V.21(a)", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "15. Giao dịch mua bán lại trái phiếu Chính phủ", code: "325", note: "V.23", parentCode: "310", level: 2, lineType: "DETAIL", isClickable: true },

  { name: "II. Nợ dài hạn (330 = 331 + ... + 344)", code: "330", parentCode: "300", level: 1, lineType: "SUBTOTAL", formula: "331 + 332 + 333 + 334 + 335 + 336 + 337 + 338 + 339 + 340 + 341 + 342 + 343 + 344", isBold: true, isClickable: true },
  { name: "1. Phải trả người bán dài hạn", code: "331", note: "V.17(b)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "2. Người mua trả tiền trước dài hạn", code: "332", note: "V.18(b)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "3. Thuế và các khoản phải nộp Nhà nước dài hạn", code: "333", note: "V.19(a)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "4. Chi phí phải trả dài hạn", code: "334", note: "V.20(b)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "5. Phải trả nội bộ về vốn kinh doanh", code: "335", note: "V.21(b)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "6. Phải trả nội bộ dài hạn", code: "336", note: "V.21(b)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "7. Doanh thu chưa thực hiện dài hạn", code: "337", note: "V.22(b)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "8. Phải trả dài hạn khác", code: "338", note: "V.21(b)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "9. Vay và nợ thuê tài chính dài hạn", code: "339", note: "V.16(b)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "10. Trái phiếu chuyển đổi", code: "340", note: "V.16(c)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "11. Cổ phiếu ưu đãi (Phần phân loại là nợ phải trả)", code: "341", note: "V.24", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "12. Thuế thu nhập hoãn lại phải trả", code: "342", note: "V.26(b)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "13. Dự phòng phải trả dài hạn", code: "343", note: "V.25(b)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "14. Quỹ phát triển khoa học và công nghệ", code: "344", note: "V.21(b)", parentCode: "330", level: 2, lineType: "DETAIL", isClickable: true },

  // D - VỐN CHỦ SỞ HỮU (15 dòng: 400..420b + 440)
  { name: "D - VỐN CHỦ SỞ HỮU (400 = 411 + ... + 420)", code: "400", level: 0, lineType: "SUBTOTAL", formula: "411 + 412 + 413 + 414 + 415 + 416 + 417 + 418 + 419 + 420", isBold: true, isClickable: true },
  { name: "1. Vốn góp của chủ sở hữu (411 = 411a + 411b)", code: "411", note: "V.27", parentCode: "400", level: 2, lineType: "SUBTOTAL", formula: "411a + 411b", isClickable: true },
  { name: "- Cổ phiếu phổ thông có quyền biểu quyết", code: "411a", note: "V.27", parentCode: "411", level: 3, lineType: "DETAIL", isClickable: true },
  { name: "- Cổ phiếu ưu đãi", code: "411b", note: "V.27", parentCode: "411", level: 3, lineType: "DETAIL", isClickable: true },
  { name: "2. Thặng dư vốn cổ phần", code: "412", note: "V.27", parentCode: "400", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "3. Quyền chọn chuyển đổi trái phiếu", code: "413", note: "V.27", parentCode: "400", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "4. Vốn khác của chủ sở hữu", code: "414", note: "V.27", parentCode: "400", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "5. Cổ phiếu quỹ (*)", code: "415", note: "V.27", parentCode: "400", level: 2, lineType: "DETAIL", isNegativePresentation: true, isClickable: true },
  { name: "6. Chênh lệch đánh giá lại tài sản", code: "416", note: "V.28", parentCode: "400", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "7. Chênh lệch tỷ giá hối đoái", code: "417", note: "V.27", parentCode: "400", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "8. Quỹ đầu tư phát triển", code: "418", note: "V.27", parentCode: "400", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "9. Quỹ khác thuộc vốn chủ sở hữu", code: "419", note: "V.27", parentCode: "400", level: 2, lineType: "DETAIL", isClickable: true },
  { name: "10. Lợi nhuận sau thuế chưa phân phối (420 = 420a + 420b)", code: "420", note: "V.27", parentCode: "400", level: 2, lineType: "SUBTOTAL", formula: "420a + 420b", isClickable: true },
  { name: "- LNST chưa phân phối lũy kế đến cuối kỳ trước", code: "420a", note: "V.27", parentCode: "420", level: 3, lineType: "DETAIL", isClickable: true },
  { name: "- LNST chưa phân phối kỳ này", code: "420b", note: "V.27", parentCode: "420", level: 3, lineType: "DETAIL", isClickable: true },

  { name: "TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)", code: "440", level: 0, lineType: "TOTAL", formula: "300 + 400", isBold: true, isClickable: true },
];

function stripVietnameseAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function formatAmountDisplay(
  val: number | null | undefined,
  contentStatus?: string,
): { text: string; isNegative: boolean; isUnmapped: boolean } {
  if (contentStatus === "UNMAPPED" || val === null) {
    return { text: "Chưa mapping", isNegative: false, isUnmapped: true };
  }
  if (val === undefined) {
    return { text: "0", isNegative: false, isUnmapped: false };
  }
  if (val === 0) {
    return { text: "0", isNegative: false, isUnmapped: false };
  }
  if (val < 0) {
    const absVal = Math.abs(val);
    return { text: `(${absVal.toLocaleString("vi-VN")})`, isNegative: true, isUnmapped: false };
  }
  return { text: val.toLocaleString("vi-VN"), isNegative: false, isUnmapped: false };
}

export interface MisaFinancialPositionReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
  initialRunId?: string;
  initialBundleId?: string;
  initialTemplateCode?: string;
}

export default function MisaFinancialPositionReport({
  onBack,
  notify,
  initialRunId,
  initialBundleId,
  initialTemplateCode,
}: MisaFinancialPositionReportProps) {
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [showAiAnalysis, setShowAiAnalysis] = useState<boolean>(false);

  // UC-RPT-03 Parameters & Filter State
  const [templateCode, setTemplateCode] = useState<string>(initialTemplateCode || "B01-DN");
  const [templatesList, setTemplatesList] = useState<any[]>([]);
  const [periodsList, setPeriodsList] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [reportingScope, setReportingScope] = useState<"COMPANY" | "BRANCH">("COMPANY");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [displayUnit, setDisplayUnit] = useState<"VND" | "THOUSAND_VND" | "MILLION_VND">("VND");

  const [period, setPeriod] = useState<string>("Năm");
  const [year, setYear] = useState<number>(2026);
  const [fromDate, setFromDate] = useState<string>("01/01/2026");
  const [toDate, setToDate] = useState<string>("31/12/2026");
  const [fetchFromSaved, setFetchFromSaved] = useState<boolean>(false);
  const [audited, setAudited] = useState<boolean>(false);
  const [hideZeroRows, setHideZeroRows] = useState<boolean>(false);
  const [signer, setSigner] = useState<string>("Trần Thị Hương");
  const [reportDate, setReportDate] = useState<string>("31/12/2026");

  // Run & Validation State
  const [currentRun, setCurrentRun] = useState<any | null>(null);
  const [rows, setRows] = useState<BalanceSheetItem[]>(
    FULL_B01_DATA.map((r) => ({ ...r, closing: 0, opening: 0, contentStatus: "COMPLETE" })),
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    can_view: true,
    can_generate: true,
    can_validate: true,
    can_drilldown: true,
    can_submit: true,
    can_approve: true,
    can_export: true,
  });

  // Modals: Validation, Line Calculation/Drill-down, History, Note Reference
  const [isValidationModalOpen, setIsValidationModalOpen] = useState<boolean>(false);
  const [validationData, setValidationData] = useState<any | null>(null);

  const [selectedLineForModal, setSelectedLineForModal] = useState<BalanceSheetItem | null>(null);
  const [lineModalTab, setLineModalTab] = useState<"CALCULATION" | "DRILLDOWN">("CALCULATION");
  const [drilldownColumn, setDrilldownColumn] = useState<"CLOSING" | "OPENING">("CLOSING");
  const [calculationDetail, setCalculationDetail] = useState<any | null>(null);
  const [drilldownDetail, setDrilldownDetail] = useState<any | null>(null);
  const [lineModalLoading, setLineModalLoading] = useState<boolean>(false);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [historyData, setHistoryData] = useState<any | null>(null);

  const [selectedNoteModal, setSelectedNoteModal] = useState<{ code: string; lineName: string; status: string } | null>(null);

  const mapBackendLinesToItems = useCallback((backendLines: any[]): BalanceSheetItem[] => {
    return backendLines.map((ln: any) => ({
      line_id: ln.line_id,
      name: ln.indicator_name,
      code: ln.indicator_code,
      note: ln.note_reference || "",
      noteStatus: ln.note_link?.status || "NONE",
      closing: ln.closing_amount !== undefined ? ln.closing_amount : null,
      opening: ln.opening_amount !== undefined ? ln.opening_amount : null,
      formattedClosing: ln.formatted_closing_amount,
      formattedOpening: ln.formatted_opening_amount,
      level: Number(ln.level ?? 2),
      lineType: ln.line_type,
      parentCode: ln.parent_indicator_code || "",
      formula: ln.formula_expression || "",
      isNegativePresentation: Boolean(ln.is_negative_presentation),
      contentStatus: ln.content_status || "COMPLETE",
      isBold: ln.level === 0 || ln.level === 1 || ln.line_type === "SUBTOTAL" || ln.line_type === "TOTAL",
      isClickable: Boolean(ln.is_drilldown_available ?? true),
    }));
  }, []);

  const loadReportFromBackend = useCallback(
    async (opts?: { forceGenerate?: boolean; targetRunId?: string; targetTemplateCode?: string; targetPeriodId?: string; targetUnit?: string }) => {
      setLoading(true);
      setLoadError("");
      try {
        const cid = getSelectedCompanyId();
        const qBase = cid ? `?company_id=${encodeURIComponent(cid)}` : "";

        // 1. Load parameters & templates metadata
        const [paramRes, tplRes]: [any, any] = await Promise.all([
          apiClient.get(`/api/v1/reports/financial-position/parameters/${qBase}`).catch(() => null),
          apiClient.get(`/api/v1/reports/financial-position/templates/${qBase}`).catch(() => null),
        ]);

        if (paramRes) {
          if (Array.isArray(paramRes.periods)) setPeriodsList(paramRes.periods);
          if (Array.isArray(paramRes.branches)) setBranchesList(paramRes.branches);
          if (paramRes.permissions) setPermissions(paramRes.permissions);
        }
        if (tplRes && Array.isArray(tplRes.templates)) {
          setTemplatesList(tplRes.templates);
        }

        const activeTpl = opts?.targetTemplateCode || templateCode || "B01-DN";
        const activeUnit = (opts?.targetUnit || displayUnit || "VND") as "VND" | "THOUSAND_VND" | "MILLION_VND";
        const activePeriodId =
          opts?.targetPeriodId ||
          selectedPeriodId ||
          (paramRes?.periods?.length ? paramRes.periods[0].id : "");

        if (activePeriodId && !selectedPeriodId) {
          setSelectedPeriodId(activePeriodId);
        }

        const runIdToLoad = opts?.targetRunId || initialRunId;
        let runPayload: any = null;

        if (runIdToLoad && !opts?.forceGenerate) {
          const detailUrl = `/api/v1/reports/financial-position/runs/${encodeURIComponent(runIdToLoad)}/?${cid ? `company_id=${encodeURIComponent(cid)}&` : ""}display_unit=${activeUnit}`;
          runPayload = await apiClient.get(detailUrl);
        } else if (!opts?.forceGenerate) {
          // Check existing runs for this template & period
          const listParams = new URLSearchParams();
          if (cid) listParams.set("company_id", cid);
          listParams.set("template_code", activeTpl);
          if (activePeriodId) listParams.set("fiscal_period_id", activePeriodId);
          listParams.set("reporting_scope", reportingScope);
          if (reportingScope === "BRANCH" && selectedBranchId) listParams.set("branch_id", selectedBranchId);

          const runsList: any = await apiClient.get(`/api/v1/reports/financial-position/runs/?${listParams.toString()}`);
          if (runsList?.runs?.length > 0) {
            const latestRunId = runsList.runs[0].id;
            const detailUrl = `/api/v1/reports/financial-position/runs/${encodeURIComponent(latestRunId)}/?${cid ? `company_id=${encodeURIComponent(cid)}&` : ""}display_unit=${activeUnit}`;
            runPayload = await apiClient.get(detailUrl);
          }
        }

        // Generate a fresh run if none exists (unless fetchFromSaved only) or if forceGenerate is requested
        if (!runPayload && (!fetchFromSaved || opts?.forceGenerate)) {
          if (activePeriodId) {
            runPayload = await apiClient.post("/api/v1/reports/financial-position/runs/", {
              company_id: cid,
              template_code: activeTpl,
              fiscal_period_id: activePeriodId,
              reporting_scope: reportingScope,
              branch_id: reportingScope === "BRANCH" ? selectedBranchId || undefined : undefined,
              display_unit: activeUnit,
              bundle_id: initialBundleId || undefined,
            });
          }
        }

        if (runPayload && Array.isArray(runPayload.lines)) {
          setCurrentRun(runPayload);
          setValidationData(runPayload.validation || null);
          setRows(mapBackendLinesToItems(runPayload.lines));
          return;
        }

        // Legacy fallback only if financial-position endpoint has no period configured yet
        const legacyRes: any = await apiClient.get(`/api/v1/reports/tt99-financial-statements/${qBase}`).catch(() => null);
        if (legacyRes && legacyRes.b01_dn) {
          const b01 = legacyRes.b01_dn;
          setRows(
            FULL_B01_DATA.map((item) => {
              const entry = b01[item.code];
              return {
                ...item,
                closing: entry?.closing !== undefined ? Number(entry.closing) : 0,
                opening: entry?.opening !== undefined ? Number(entry.opening) : 0,
                contentStatus: "COMPLETE",
              };
            }),
          );
        } else if (fetchFromSaved) {
          setLoadError("Chưa có phiên bản Báo cáo tình hình tài chính đã lưu cho kỳ kế toán này.");
        }
      } catch (err: any) {
        const msg = err?.message || "Không thể tải dữ liệu Báo cáo tình hình tài chính từ máy chủ.";
        setLoadError(msg);
      } finally {
        setLoading(false);
      }
    },
    [templateCode, displayUnit, selectedPeriodId, reportingScope, selectedBranchId, fetchFromSaved, initialRunId, initialBundleId, mapBackendLinesToItems],
  );

  useEffect(() => {
    void loadReportFromBackend();
  }, [loadReportFromBackend]);

  // Hierarchy-aware filter for hideZeroRows & accent-insensitive search (BR-RPT-B01-23 & TC-RPT-03-41..42)
  const filteredRows = useMemo(() => {
    const byCode = new Map<string, BalanceSheetItem>();
    const childrenMap = new Map<string, string[]>();
    for (const r of rows) {
      byCode.set(r.code, r);
      if (r.parentCode) {
        const list = childrenMap.get(r.parentCode) || [];
        list.push(r.code);
        childrenMap.set(r.parentCode, list);
      }
    }

    const hasNonZeroSubtree = (code: string, visited = new Set<string>()): boolean => {
      if (visited.has(code)) return false;
      visited.add(code);
      const item = byCode.get(code);
      if (!item) return false;
      if (item.code === "280" || item.code === "440" || item.level === 0) return true;
      const cNonZero = item.closing !== null && item.closing !== undefined && item.closing !== 0;
      const oNonZero = item.opening !== null && item.opening !== undefined && item.opening !== 0;
      if (cNonZero || oNonZero || item.contentStatus === "UNMAPPED") return true;
      const kids = childrenMap.get(code) || [];
      return kids.some((k) => hasNonZeroSubtree(k, visited));
    };

    let list = rows;
    if (hideZeroRows) {
      list = list.filter((r) => hasNonZeroSubtree(r.code));
    }

    if (searchKeyword.trim()) {
      const kwNorm = stripVietnameseAccents(searchKeyword.trim());
      const matchedCodes = new Set<string>();
      for (const r of list) {
        const haystack = stripVietnameseAccents(`${r.code} ${r.name} ${r.note || ""}`);
        if (haystack.includes(kwNorm)) {
          matchedCodes.add(r.code);
          let p = r.parentCode;
          while (p) {
            matchedCodes.add(p);
            p = byCode.get(p)?.parentCode || "";
          }
        }
      }
      list = list.filter((r) => matchedCodes.has(r.code));
    }
    return list;
  }, [rows, hideZeroRows, searchKeyword]);

  const handleOpenLineDetail = async (row: BalanceSheetItem, initialTab: "CALCULATION" | "DRILLDOWN" = "CALCULATION") => {
    setSelectedLineForModal(row);
    setLineModalTab(initialTab);
    if (!currentRun?.id) return;
    setLineModalLoading(true);
    try {
      const cid = getSelectedCompanyId();
      const q = cid ? `?company_id=${encodeURIComponent(cid)}` : "";
      const [calcRes, drillRes] = await Promise.all([
        apiClient.get(`/api/v1/reports/financial-position/runs/${encodeURIComponent(currentRun.id)}/lines/${encodeURIComponent(row.code)}/calculation/${q}`).catch(() => null),
        apiClient
          .get(
            `/api/v1/reports/financial-position/runs/${encodeURIComponent(currentRun.id)}/lines/${encodeURIComponent(row.code)}/drilldown/?${cid ? `company_id=${encodeURIComponent(cid)}&` : ""}column=${drilldownColumn}`,
          )
          .catch(() => null),
      ]);
      setCalculationDetail(calcRes);
      setDrilldownDetail(drillRes);
    } finally {
      setLineModalLoading(false);
    }
  };

  const handleSwitchDrilldownColumn = async (col: "CLOSING" | "OPENING") => {
    setDrilldownColumn(col);
    if (!currentRun?.id || !selectedLineForModal) return;
    setLineModalLoading(true);
    try {
      const cid = getSelectedCompanyId();
      const drillRes = await apiClient.get(
        `/api/v1/reports/financial-position/runs/${encodeURIComponent(currentRun.id)}/lines/${encodeURIComponent(selectedLineForModal.code)}/drilldown/?${cid ? `company_id=${encodeURIComponent(cid)}&` : ""}column=${col}`,
      );
      setDrilldownDetail(drillRes);
    } catch {
      // ignore
    } finally {
      setLineModalLoading(false);
    }
  };

  const handleRunValidation = async () => {
    if (!currentRun?.id) {
      setIsValidationModalOpen(true);
      return;
    }
    try {
      const cid = getSelectedCompanyId();
      const res: any = await apiClient.post(
        `/api/v1/reports/financial-position/runs/${encodeURIComponent(currentRun.id)}/validate/?${cid ? `company_id=${encodeURIComponent(cid)}` : ""}`,
        { company_id: cid },
      );
      setValidationData(res);
      setIsValidationModalOpen(true);
      notify?.(
        res.is_balanced
          ? "Kiểm tra hoàn tất: Bảng cân đối kế toán cân bằng (280 = 440)."
          : "Cảnh báo: Phát hiện chênh lệch cân đối hoặc công thức trên B01!",
      );
    } catch (err: any) {
      notify?.(err?.message || "Không thể chạy kiểm tra B01.");
    }
  };

  const handleOpenHistory = async () => {
    setIsHistoryModalOpen(true);
    if (!currentRun?.id) return;
    try {
      const cid = getSelectedCompanyId();
      const res: any = await apiClient.get(
        `/api/v1/reports/financial-position/runs/${encodeURIComponent(currentRun.id)}/history/?${cid ? `company_id=${encodeURIComponent(cid)}` : ""}`,
      );
      setHistoryData(res);
    } catch {
      // ignore
    }
  };

  const handleApproveRun = async () => {
    if (!currentRun?.id) return;
    try {
      const cid = getSelectedCompanyId();
      const res: any = await apiClient.post(
        `/api/v1/reports/financial-position/runs/${encodeURIComponent(currentRun.id)}/approve/`,
        { company_id: cid },
      );
      setCurrentRun((prev: any) => ({ ...prev, ...res }));
      notify?.(`Đã phê duyệt Báo cáo tình hình tài chính (Version v${res.run_version}).`);
    } catch (err: any) {
      notify?.(err?.message || "Không thể phê duyệt báo cáo khi đang có lỗi chặn (FAILED) hoặc lỗi thời (STALE).");
    }
  };

  const handleExportReport = async (format: "XML" | "EXCEL" | "PDF") => {
    if (!currentRun?.id) {
      notify?.(`Đang chuẩn bị xuất ${format}...`);
      return;
    }
    try {
      const cid = getSelectedCompanyId();
      const res: any = await apiClient.post(
        `/api/v1/reports/financial-position/runs/${encodeURIComponent(currentRun.id)}/export/`,
        {
          company_id: cid,
          export_format: format,
          official_submission: format === "XML",
        },
      );
      notify?.(`Đã kết xuất ${res.template_code} (v${currentRun.run_version}) định dạng ${format} chuẩn TT99/2025/TT-BTC.`);
    } catch (err: any) {
      notify?.(err?.message || `Chặn xuất ${format} do báo cáo chưa đạt kiểm tra cân đối.`);
    }
  };

  const handleApplyParams = () => {
    setIsParamDrawerOpen(false);
    void loadReportFromBackend({
      forceGenerate: !fetchFromSaved,
      targetTemplateCode: templateCode,
      targetPeriodId: selectedPeriodId,
      targetUnit: displayUnit,
    });
    notify?.(`Đã áp dụng tham số và nạp mẫu ${templateCode}.`);
  };

  const handleResetParams = () => {
    setTemplateCode("B01-DN");
    setReportingScope("COMPANY");
    setDisplayUnit("VND");
    setPeriod("Năm");
    setYear(2026);
    setFromDate("01/01/2026");
    setToDate("31/12/2026");
    setHideZeroRows(false);
    notify?.("Đã đặt lại điều kiện tham số về mặc định.");
  };

  const closingHeaderLabel =
    currentRun?.closing_column_label || (templateCode === "B01a-DN" || templateCode === "B01b-DN" ? "Số cuối quý" : "Số cuối năm");
  const openingHeaderLabel = currentRun?.opening_column_label || "Số đầu năm";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "#f8fafc", position: "relative" }}>
      {/* 1. Top Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          minHeight: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            title="Quay lại danh mục báo cáo"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#334155",
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                {templateCode}: Báo cáo tình hình tài chính
              </h2>
              {currentRun && (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: currentRun.run_status === "APPROVED" ? "#dcfce7" : "#f1f5f9",
                    color: currentRun.run_status === "APPROVED" ? "#15803d" : "#475569",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  v{currentRun.run_version} • {currentRun.run_status}
                </span>
              )}
              {currentRun && (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background:
                      currentRun.validation_status === "PASSED"
                        ? "#dcfce7"
                        : currentRun.validation_status === "FAILED"
                          ? "#fee2e2"
                          : "#fef3c7",
                    color:
                      currentRun.validation_status === "PASSED"
                        ? "#15803d"
                        : currentRun.validation_status === "FAILED"
                          ? "#b91c1c"
                          : "#b45309",
                  }}
                >
                  Kiểm tra: {currentRun.validation_status}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Quick Template Switcher (RPT03-F01) */}
          <select
            value={templateCode}
            onChange={(e) => {
              const nextTpl = e.target.value;
              setTemplateCode(nextTpl);
              void loadReportFromBackend({ targetTemplateCode: nextTpl, forceGenerate: true });
            }}
            style={{
              height: 32,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 600,
              color: "#0f172a",
              background: "#ffffff",
            }}
          >
            <option value="B01-DN">B01-DN (Năm – Hoạt động liên tục – 126 chỉ tiêu)</option>
            <option value="B01a-DN">B01a-DN (Giữa niên độ dạng đầy đủ)</option>
            <option value="B01b-DN">B01b-DN (Giữa niên độ dạng tóm lược)</option>
            <option value="B01-DNKLT">B01-DNKLT (Không đáp ứng hoạt động liên tục)</option>
          </select>

          {/* Display Unit Switcher */}
          <select
            value={displayUnit}
            onChange={(e) => {
              const nextUnit = e.target.value as "VND" | "THOUSAND_VND" | "MILLION_VND";
              setDisplayUnit(nextUnit);
              void loadReportFromBackend({ targetUnit: nextUnit });
            }}
            style={{
              height: 32,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              color: "#334155",
              background: "#ffffff",
            }}
          >
            <option value="VND">Đơn vị: VND</option>
            <option value="THOUSAND_VND">Đơn vị: Nghìn VND</option>
            <option value="MILLION_VND">Đơn vị: Triệu VND</option>
          </select>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={() => void handleOpenHistory()}
          >
            <History size={14} />
            <span>Lịch sử phiên bản</span>
          </button>

          {permissions.can_generate && (
            <button
              type="button"
              style={{
                height: 32,
                padding: "0 12px",
                background: "#ffffff",
                border: "1px solid #00a862",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#00a862",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
              onClick={() => void loadReportFromBackend({ forceGenerate: true })}
            >
              <PlusCircle size={14} />
              <span>Tạo phiên bản mới</span>
            </button>
          )}

          {permissions.can_approve && currentRun && currentRun.run_status !== "APPROVED" && (
            <button
              type="button"
              style={{
                height: 32,
                padding: "0 12px",
                background: "#0284c7",
                border: "none",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
              onClick={() => void handleApproveRun()}
            >
              <ShieldCheck size={14} />
              <span>Phê duyệt</span>
            </button>
          )}

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 14px",
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
            onClick={() => setIsParamDrawerOpen(true)}
          >
            Chọn tham số
          </button>
        </div>
      </div>

      {/* 2. Top Action Bar: Kiểm tra, Xuất XML, eTax, Tìm kiếm, Ẩn dòng = 0 */}
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
            style={{ background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#334155", cursor: "pointer", fontWeight: 600 }}
            onClick={() => void handleRunValidation()}
          >
            <FileCheck size={15} color="#00a862" />
            <span>Kiểm tra cân đối (12 quy tắc)</span>
          </button>

          <button
            type="button"
            style={{ background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#334155", cursor: "pointer", fontWeight: 500 }}
            onClick={() => void handleExportReport("XML")}
          >
            <FileCode size={15} color="#d97706" />
            <span>Xuất XML</span>
          </button>

          <button
            type="button"
            style={{ background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0284c7", cursor: "pointer", fontWeight: 600 }}
            onClick={() => void handleExportReport("XML")}
          >
            <Send size={15} color="#0284c7" />
            <span>Nộp báo cáo qua Sổ Việt eTax</span>
          </button>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={hideZeroRows}
              onChange={(e) => setHideZeroRows(e.target.checked)}
              style={{ accentColor: "#00a862" }}
            />
            <span>Ẩn chỉ tiêu = 0 (cả 2 cột)</span>
          </label>

          <button
            type="button"
            style={{
              background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
              border: "1px solid #c7d2fe",
              borderRadius: 14,
              padding: "3px 12px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "#6366f1",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => setShowAiAnalysis(!showAiAnalysis)}
          >
            <Sparkles size={14} color="#7c3aed" />
            <span>{showAiAnalysis ? "Đóng phân tích AI" : "✨ Điểm nổi bật"}</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 240 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Tìm mã số, tên chỉ tiêu, thuyết minh..."
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
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}
            title="Làm mới"
            onClick={() => {
              void loadReportFromBackend();
              notify?.("Đã làm mới dữ liệu Báo cáo tình hình tài chính.");
            }}
          >
            <RotateCw size={14} />
          </button>

          <button
            type="button"
            style={{ height: 30, padding: "0 10px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 12.5, cursor: "pointer" }}
            onClick={() => void handleExportReport("PDF")}
          >
            <Printer size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{ height: 30, padding: "0 10px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 12.5, cursor: "pointer" }}
            onClick={() => void handleExportReport("EXCEL")}
          >
            <Download size={14} />
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* Warning Banners: STALE / Draft Vouchers / Rounding / Load Error */}
      {loadError && (
        <div style={{ margin: "8px 20px 0", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#991b1b", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} />
          <span>{loadError}</span>
        </div>
      )}
      {currentRun?.is_stale && (
        <div style={{ margin: "8px 20px 0", padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, color: "#92400e", fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} />
            <span>{currentRun.stale_warning_message || "Dữ liệu Sổ cái đã thay đổi sau thời điểm lập báo cáo (STALE)."}</span>
          </div>
          {permissions.can_generate && (
            <button
              type="button"
              onClick={() => void loadReportFromBackend({ forceGenerate: true })}
              style={{ padding: "4px 10px", background: "#d97706", color: "#fff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Tạo phiên bản mới cập nhật
            </button>
          )}
        </div>
      )}
      {currentRun?.has_draft_vouchers_warning && (
        <div style={{ margin: "8px 20px 0", padding: "8px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, color: "#1e40af", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={15} />
          <span>{currentRun.draft_vouchers_warning_message}</span>
        </div>
      )}
      {currentRun?.rounding_warning && (
        <div style={{ margin: "8px 20px 0", padding: "8px 14px", background: "#fefce8", border: "1px solid #fef08a", borderRadius: 6, color: "#854d0e", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={15} />
          <span>{currentRun.rounding_warning_message}</span>
        </div>
      )}

      {/* 3. Tab Strip */}
      <div style={{ padding: "8px 20px 0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["B01-DN", "B01a-DN", "B01b-DN", "B01-DNKLT"].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setTemplateCode(code);
                void loadReportFromBackend({ targetTemplateCode: code, forceGenerate: true });
              }}
              style={{
                background: templateCode === code ? "#ffffff" : "#f1f5f9",
                padding: "6px 14px",
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                border: "1px solid #cbd5e1",
                borderBottom: templateCode === code ? "1px solid #ffffff" : "1px solid #cbd5e1",
                fontWeight: templateCode === code ? 700 : 500,
                fontSize: 12.5,
                color: templateCode === code ? "#00a862" : "#475569",
                cursor: "pointer",
              }}
            >
              {code}
            </button>
          ))}
        </div>
        {currentRun && (
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Nguồn số đầu năm:{" "}
            <strong>
              {currentRun.opening_source === "PRIOR_APPROVED_B01"
                ? "B01 kỳ trước đã duyệt"
                : "Sổ cái & Số dư đầu kỳ (UC-GL-15)"}
            </strong>{" "}
            • Kỳ: <strong>{currentRun.fiscal_period_code}</strong> ({currentRun.reporting_scope})
          </div>
        )}
      </div>

      {/* 4. Main Report Content Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <h1 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.2px" }}>
            BÁO CÁO TÌNH HÌNH TÀI CHÍNH
          </h1>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>
            (Mẫu số {templateCode} ban hành theo Thông tư số 99/2025/TT-BTC của Bộ Tài chính)
          </div>
          <div style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>
            Tại ngày {currentRun?.as_of_date || toDate}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", marginTop: 2 }}>
            {templateCode === "B01-DNKLT"
              ? "(Áp dụng cho doanh nghiệp không đáp ứng giả định hoạt động liên tục)"
              : "(Áp dụng cho doanh nghiệp đáp ứng giả định hoạt động liên tục)"}
          </div>
        </div>

        {/* Data Table */}
        <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e2f0d9", color: "#1e293b", fontWeight: 700, borderBottom: "1px solid #bbf7d0" }}>
                <th style={{ padding: "8px 14px", textAlign: "left", borderRight: "1px solid #cbd5e1", minWidth: 340 }}>
                  Chỉ tiêu (Bấm để xem Công thức / Drill-down Sổ cái)
                </th>
                <th style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", width: 80 }}>
                  Mã số
                </th>
                <th style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", width: 110 }}>
                  Thuyết minh
                </th>
                <th style={{ padding: "8px 14px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 170 }}>
                  {closingHeaderLabel}
                </th>
                <th style={{ padding: "8px 14px", textAlign: "right", width: 170 }}>
                  {openingHeaderLabel}
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const closingVal = formatAmountDisplay(row.closing, row.contentStatus);
                const openingVal = formatAmountDisplay(row.opening, row.contentStatus);
                const paddingLeft = row.level === 0 ? 14 : row.level === 1 ? 22 : row.level === 2 ? 32 : 44;

                return (
                  <tr
                    key={row.code}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: row.level === 0 ? "#f8fafc" : "#ffffff",
                      fontWeight: row.isBold ? 700 : 400,
                      transition: "background 0.15s",
                    }}
                  >
                    {/* Chỉ tiêu */}
                    <td
                      style={{
                        padding: `7px 14px 7px ${paddingLeft}px`,
                        borderRight: "1px solid #f1f5f9",
                        color: "#1e293b",
                        cursor: "pointer",
                      }}
                      onClick={() => void handleOpenLineDetail(row, "CALCULATION")}
                    >
                      <span>{row.name}</span>
                      {row.contentStatus === "UNMAPPED" && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 10.5,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "#fef3c7",
                            color: "#b45309",
                            fontWeight: 600,
                          }}
                        >
                          UNMAPPED
                        </span>
                      )}
                    </td>

                    {/* Mã số */}
                    <td
                      style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9", color: "#475569", cursor: "pointer" }}
                      onClick={() => void handleOpenLineDetail(row, "CALCULATION")}
                    >
                      {row.code}
                    </td>

                    {/* Thuyết minh (RPT03-F10) */}
                    <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
                      {row.note ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedNoteModal({
                              code: row.note || "",
                              lineName: row.name,
                              status: row.noteStatus || "AVAILABLE",
                            })
                          }
                          style={{
                            background: row.noteStatus === "MISSING_NOTE" ? "#fef3c7" : "#eff6ff",
                            color: row.noteStatus === "MISSING_NOTE" ? "#b45309" : "#0284c7",
                            border: "1px solid #bfdbfe",
                            borderRadius: 4,
                            padding: "1px 6px",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {row.note}
                        </button>
                      ) : null}
                    </td>

                    {/* Số cuối kỳ */}
                    <td
                      style={{
                        padding: "7px 14px",
                        textAlign: "right",
                        borderRight: "1px solid #f1f5f9",
                        color: closingVal.isUnmapped ? "#b45309" : closingVal.isNegative ? "#dc2626" : "#1e293b",
                        fontWeight: row.isBold || closingVal.isNegative ? 700 : 400,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setDrilldownColumn("CLOSING");
                        void handleOpenLineDetail(row, "DRILLDOWN");
                      }}
                    >
                      {closingVal.text}
                    </td>

                    {/* Số đầu năm */}
                    <td
                      style={{
                        padding: "7px 14px",
                        textAlign: "right",
                        color: openingVal.isUnmapped ? "#b45309" : openingVal.isNegative ? "#dc2626" : "#1e293b",
                        fontWeight: row.isBold || openingVal.isNegative ? 700 : 400,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setDrilldownColumn("OPENING");
                        void handleOpenLineDetail(row, "DRILLDOWN");
                      }}
                    >
                      {openingVal.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 5. Footer Summary */}
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
            Hiển thị: <strong>{filteredRows.length}</strong> / <strong>{rows.length}</strong> chỉ tiêu
          </div>
          {validationData && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: validationData.is_balanced ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
                {validationData.is_balanced
                  ? "✓ Cân đối: Tổng Tài sản (280) = Tổng Nguồn vốn (440)"
                  : `✗ Lệch cân đối (280 vs 440): Cuối kỳ ${validationData.closing_balance_check?.difference || 0} | Đầu năm ${validationData.opening_balance_check?.difference || 0}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Kiểm tra cân đối & công thức (12 quy tắc RPT-B01-VAL-01..12) */}
      {isValidationModalOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setIsValidationModalOpen(false)}
        >
          <div
            style={{ width: "92%", maxWidth: 860, maxHeight: "84vh", background: "#fff", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={18} color={validationData?.is_balanced ? "#16a34a" : "#dc2626"} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                  Kết quả kiểm tra cân đối & công thức B01 (RPT-B01-VAL-01 .. RPT-B01-VAL-12)
                </h3>
              </div>
              <button type="button" onClick={() => setIsValidationModalOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", fontSize: 13 }}>
              {validationData ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div style={{ padding: 12, borderRadius: 6, background: validationData.closing_balance_check?.is_balanced ? "#f0fdf4" : "#fef2f2", border: "1px solid #cbd5e1" }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Cột {closingHeaderLabel}</div>
                      <div>Tổng Tài sản (280): <strong>{Number(validationData.closing_balance_check?.total_assets_280 || 0).toLocaleString("vi-VN")}</strong></div>
                      <div>Tổng Nguồn vốn (440): <strong>{Number(validationData.closing_balance_check?.total_resources_440 || 0).toLocaleString("vi-VN")}</strong></div>
                      <div>Chênh lệch: <strong>{Number(validationData.closing_balance_check?.difference || 0).toLocaleString("vi-VN")}</strong></div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 6, background: validationData.opening_balance_check?.is_balanced ? "#f0fdf4" : "#fef2f2", border: "1px solid #cbd5e1" }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Cột {openingHeaderLabel}</div>
                      <div>Tổng Tài sản (280): <strong>{Number(validationData.opening_balance_check?.total_assets_280 || 0).toLocaleString("vi-VN")}</strong></div>
                      <div>Tổng Nguồn vốn (440): <strong>{Number(validationData.opening_balance_check?.total_resources_440 || 0).toLocaleString("vi-VN")}</strong></div>
                      <div>Chênh lệch: <strong>{Number(validationData.opening_balance_check?.difference || 0).toLocaleString("vi-VN")}</strong></div>
                    </div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: 8, textAlign: "left" }}>Mã quy tắc</th>
                        <th style={{ padding: 8, textAlign: "center" }}>Cột</th>
                        <th style={{ padding: 8, textAlign: "center" }}>Chỉ tiêu</th>
                        <th style={{ padding: 8, textAlign: "center" }}>Mức độ</th>
                        <th style={{ padding: 8, textAlign: "center" }}>Kết quả</th>
                        <th style={{ padding: 8, textAlign: "left" }}>Nội dung kiểm tra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(validationData.rules || []).map((r: any) => (
                        <tr key={r.id || `${r.rule_code}-${r.column_code}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: 8, fontWeight: 600 }}>{r.rule_code}</td>
                          <td style={{ padding: 8, textAlign: "center" }}>{r.column_code}</td>
                          <td style={{ padding: 8, textAlign: "center" }}>{r.indicator_code}</td>
                          <td style={{ padding: 8, textAlign: "center" }}>{r.severity}</td>
                          <td style={{ padding: 8, textAlign: "center", fontWeight: 700, color: r.status === "PASSED" ? "#15803d" : r.status === "FAILED" ? "#b91c1c" : "#b45309" }}>
                            {r.status}
                          </td>
                          <td style={{ padding: 8 }}>{r.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div>Chưa có dữ liệu kiểm tra cho phiên bản này.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Chi tiết cách tính & Drill-down Sổ cái / Chứng từ (RPT03-F11) */}
      {selectedLineForModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setSelectedLineForModal(null)}
        >
          <div
            style={{ width: "94%", maxWidth: 940, maxHeight: "86vh", background: "#fff", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                  Chỉ tiêu [{selectedLineForModal.code}] {selectedLineForModal.name}
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Loại dòng: <strong>{selectedLineForModal.lineType}</strong>
                  {selectedLineForModal.formula ? ` • Công thức: ${selectedLineForModal.formula}` : ""}
                  {selectedLineForModal.note ? ` • Thuyết minh: ${selectedLineForModal.note}` : ""}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedLineForModal(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, padding: "10px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <button
                type="button"
                onClick={() => setLineModalTab("CALCULATION")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: lineModalTab === "CALCULATION" ? "#00a862" : "#fff",
                  color: lineModalTab === "CALCULATION" ? "#fff" : "#334155",
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                <Layers size={13} style={{ marginRight: 5, verticalAlign: "middle" }} />
                Công thức & Mapping tài khoản
              </button>
              <button
                type="button"
                onClick={() => setLineModalTab("DRILLDOWN")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: lineModalTab === "DRILLDOWN" ? "#00a862" : "#fff",
                  color: lineModalTab === "DRILLDOWN" ? "#fff" : "#334155",
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                <ExternalLink size={13} style={{ marginRight: 5, verticalAlign: "middle" }} />
                Truy vết Sổ chi tiết & Chứng từ (Drill-down)
              </button>
            </div>

            <div style={{ padding: 20, overflowY: "auto", fontSize: 13 }}>
              {lineModalLoading ? (
                <div>Đang tải chi tiết chỉ tiêu...</div>
              ) : lineModalTab === "CALCULATION" ? (
                <div>
                  {calculationDetail?.formula_expression ? (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>
                        Công thức tổng hợp: <code>{calculationDetail.formula_expression}</code>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                            <th style={{ padding: 8, textAlign: "center" }}>Dấu</th>
                            <th style={{ padding: 8, textAlign: "center" }}>Mã chỉ tiêu con</th>
                            <th style={{ padding: 8, textAlign: "right" }}>{closingHeaderLabel}</th>
                            <th style={{ padding: 8, textAlign: "right" }}>{openingHeaderLabel}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(calculationDetail.child_contributions || []).map((c: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: 8, textAlign: "center", fontWeight: 700 }}>{c.operator > 0 ? "+" : "-"}</td>
                              <td style={{ padding: 8, textAlign: "center", fontWeight: 600 }}>{c.indicator_code}</td>
                              <td style={{ padding: 8, textAlign: "right" }}>{Number(c.closing_amount || 0).toLocaleString("vi-VN")}</td>
                              <td style={{ padding: 8, textAlign: "right" }}>{Number(c.opening_amount || 0).toLocaleString("vi-VN")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Quy tắc ánh xạ tài khoản (Account Mapping TT99):</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 16 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                            <th style={{ padding: 8, textAlign: "left" }}>Tài khoản (Prefix)</th>
                            <th style={{ padding: 8, textAlign: "left" }}>Bên lấy số dư (Balance Side)</th>
                            <th style={{ padding: 8, textAlign: "center" }}>Dấu trình bày</th>
                            <th style={{ padding: 8, textAlign: "left" }}>Điều kiện phân loại (Kỳ hạn / Chi tiết)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(calculationDetail?.mappings || []).map((m: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: 8, fontWeight: 600 }}>TK {m.account_prefix}</td>
                              <td style={{ padding: 8 }}>{m.balance_side}</td>
                              <td style={{ padding: 8, textAlign: "center" }}>{m.sign < 0 ? "(-) Ghi âm" : "(+) Ghi dương"}</td>
                              <td style={{ padding: 8 }}>
                                <code>{JSON.stringify(m.condition || {})}</code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => void handleSwitchDrilldownColumn("CLOSING")}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          background: drilldownColumn === "CLOSING" ? "#0284c7" : "#fff",
                          color: drilldownColumn === "CLOSING" ? "#fff" : "#334155",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {closingHeaderLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSwitchDrilldownColumn("OPENING")}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          background: drilldownColumn === "OPENING" ? "#0284c7" : "#fff",
                          color: drilldownColumn === "OPENING" ? "#fff" : "#334155",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {openingHeaderLabel}
                      </button>
                    </div>
                    {drilldownDetail && (
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: drilldownDetail.is_reconciled ? "#15803d" : "#b45309" }}>
                        Số trên B01: {Number(drilldownDetail.indicator_amount || 0).toLocaleString("vi-VN")} • Tổng chi tiết:{" "}
                        {Number(drilldownDetail.drilldown_total_amount || 0).toLocaleString("vi-VN")}{" "}
                        {drilldownDetail.is_reconciled ? "(Khớp 100%)" : ""}
                      </div>
                    )}
                  </div>

                  {/* Party & Account Breakdown */}
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>1. Chi tiết theo Tài khoản / Đối tượng (Party / Subledger):</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: 6, textAlign: "left" }}>Tài khoản</th>
                        <th style={{ padding: 6, textAlign: "left" }}>Đối tượng / Tiểu khoản</th>
                        <th style={{ padding: 6, textAlign: "left" }}>Quy tắc</th>
                        <th style={{ padding: 6, textAlign: "right" }}>Giá trị đóng góp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(drilldownDetail?.party_and_account_breakdown || []).map((b: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: 6, fontWeight: 600 }}>{b.account_code}</td>
                          <td style={{ padding: 6 }}>{b.party_key || "-"}</td>
                          <td style={{ padding: 6 }}>{b.balance_side}</td>
                          <td style={{ padding: 6, textAlign: "right", fontWeight: 600 }}>
                            {Number(b.amount || 0).toLocaleString("vi-VN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Vouchers */}
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>2. Danh sách bút toán / chứng từ nguồn đã ghi sổ (POSTED):</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: 6, textAlign: "left" }}>Số chứng từ</th>
                        <th style={{ padding: 6, textAlign: "center" }}>Ngày hạch toán</th>
                        <th style={{ padding: 6, textAlign: "center" }}>TK</th>
                        <th style={{ padding: 6, textAlign: "left" }}>Đối tượng</th>
                        <th style={{ padding: 6, textAlign: "left" }}>Diễn giải</th>
                        <th style={{ padding: 6, textAlign: "right" }}>Phát sinh Nợ</th>
                        <th style={{ padding: 6, textAlign: "right" }}>Phát sinh Có</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(drilldownDetail?.vouchers || []).map((v: any) => (
                        <tr key={v.journal_line_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: 6, fontWeight: 600, color: "#0284c7" }}>{v.voucher_number}</td>
                          <td style={{ padding: 6, textAlign: "center" }}>{v.posting_date}</td>
                          <td style={{ padding: 6, textAlign: "center", fontWeight: 600 }}>{v.account_code}</td>
                          <td style={{ padding: 6 }}>{v.party_code || v.party_name || "-"}</td>
                          <td style={{ padding: 6 }}>{v.description}</td>
                          <td style={{ padding: 6, textAlign: "right" }}>{Number(v.debit || 0).toLocaleString("vi-VN")}</td>
                          <td style={{ padding: 6, textAlign: "right" }}>{Number(v.credit || 0).toLocaleString("vi-VN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Lịch sử Run / Version & Audit Log (RPT03-F12) */}
      {isHistoryModalOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div
            style={{ width: "90%", maxWidth: 800, maxHeight: "82vh", background: "#fff", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Lịch sử Phiên bản (Run Version) & Nhật ký Kiểm toán</h3>
              <button type="button" onClick={() => setIsHistoryModalOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Các phiên bản Báo cáo tình hình tài chính:</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 16 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: 8, textAlign: "center" }}>Phiên bản</th>
                    <th style={{ padding: 8, textAlign: "center" }}>Trạng thái</th>
                    <th style={{ padding: 8, textAlign: "center" }}>Kiểm tra</th>
                    <th style={{ padding: 8, textAlign: "center" }}>Tại ngày</th>
                    <th style={{ padding: 8, textAlign: "center" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(historyData?.versions || []).map((v: any) => (
                    <tr key={v.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 8, textAlign: "center", fontWeight: 700 }}>v{v.run_version}</td>
                      <td style={{ padding: 8, textAlign: "center" }}>{v.run_status}</td>
                      <td style={{ padding: 8, textAlign: "center" }}>{v.validation_status}</td>
                      <td style={{ padding: 8, textAlign: "center" }}>{v.as_of_date}</td>
                      <td style={{ padding: 8, textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsHistoryModalOpen(false);
                            void loadReportFromBackend({ targetRunId: v.id });
                          }}
                          style={{ padding: "3px 10px", background: "#00a862", color: "#fff", border: "none", borderRadius: 4, fontSize: 12, cursor: "pointer" }}
                        >
                          Xem phiên bản này
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Thuyết minh liên quan (RPT03-F10 -> B09-DN / UC-RPT-06) */}
      {selectedNoteModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setSelectedNoteModal(null)}
        >
          <div
            style={{ width: "90%", maxWidth: 520, background: "#fff", borderRadius: 8, padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Thuyết minh BCTC: Mục {selectedNoteModal.code} (B09-DN – UC-RPT-06)
              </h3>
              <button type="button" onClick={() => setSelectedNoteModal(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
              <div>Chỉ tiêu: <strong>{selectedNoteModal.lineName}</strong></div>
              <div>Mã tham chiếu thuyết minh: <strong>{selectedNoteModal.code}</strong></div>
              <div>
                Trạng thái liên kết B09-DN:{" "}
                <strong style={{ color: selectedNoteModal.status === "MISSING_NOTE" ? "#b45309" : "#15803d" }}>
                  {selectedNoteModal.status === "MISSING_NOTE"
                    ? "Cảnh báo: Chưa lập mục thuyết minh tương ứng trên B09-DN"
                    : "Đã liên kết mục thuyết minh chuẩn Thông tư 99/2025/TT-BTC"}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

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
              maxWidth: 460,
              background: "#ffffff",
              height: "100%",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Chọn tham số Báo cáo tình hình tài chính</h3>
              <button type="button" style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }} onClick={() => setIsParamDrawerOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, fontSize: 13 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>Mẫu biểu pháp lý (TT99/2025/TT-BTC)</label>
                <select
                  value={templateCode}
                  onChange={(e) => setTemplateCode(e.target.value)}
                  style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13 }}
                >
                  <option value="B01-DN">B01-DN – Báo cáo tình hình tài chính năm (Hoạt động liên tục)</option>
                  <option value="B01a-DN">B01a-DN – Báo cáo tình hình tài chính giữa niên độ (Đầy đủ)</option>
                  <option value="B01b-DN">B01b-DN – Báo cáo tình hình tài chính giữa niên độ (Tóm lược)</option>
                  <option value="B01-DNKLT">B01-DNKLT – Không đáp ứng giả định hoạt động liên tục</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>Kỳ kế toán</label>
                <select
                  value={selectedPeriodId}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13 }}
                >
                  {periodsList.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.code} – {p.name} ({p.start_date} → {p.end_date}) [{p.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>Phạm vi báo cáo</label>
                  <select
                    value={reportingScope}
                    onChange={(e) => setReportingScope(e.target.value as "COMPANY" | "BRANCH")}
                    style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13 }}
                  >
                    <option value="COMPANY">Toàn doanh nghiệp (COMPANY)</option>
                    <option value="BRANCH">Theo Chi nhánh (BRANCH)</option>
                  </select>
                </div>

                {reportingScope === "BRANCH" && (
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>Chi nhánh</label>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13 }}
                    >
                      <option value="">-- Chọn chi nhánh --</option>
                      {branchesList.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.code} – {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={fetchFromSaved}
                    onChange={(e) => setFetchFromSaved(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Chỉ lấy dữ liệu từ phiên bản báo cáo đã lưu</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={hideZeroRows}
                    onChange={(e) => setHideZeroRows(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Không hiển thị chỉ tiêu có số liệu = 0 ở cả 2 cột (Giữ chỉ tiêu cha)</span>
                </label>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <button
                type="button"
                onClick={handleResetParams}
                style={{ height: 34, padding: "0 14px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
              >
                Mặc định
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  style={{ height: 34, padding: "0 18px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  style={{ height: 34, padding: "0 22px", background: "#00a862", border: "none", borderRadius: 4, color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  onClick={handleApplyParams}
                >
                  Xem báo cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
