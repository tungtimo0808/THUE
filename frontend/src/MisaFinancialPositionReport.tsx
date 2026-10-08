import React, { useState, useMemo } from "react";
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

export interface BalanceSheetItem {
  name: string;
  code: string;
  note?: string;
  closing?: number;
  opening?: number;
  level: number; // 0: Main (A, B, C, D), 1: Roman (I, II), 2: Numbered (1, 2), 3: Sub (- Nguyên giá...)
  isBold?: boolean;
  isClickable?: boolean;
}

// Complete Full Catalogue of B01 - DN matching User Input & Standard Vietnam Accounting Circular 200
const FULL_B01_DATA: BalanceSheetItem[] = [
  // A. TÀI SẢN NGẮN HẠN
  { name: "A. TÀI SẢN NGẮN HẠN", code: "100", closing: 24475000, level: 0, isBold: true },
  { name: "I. Tiền và các khoản tương đương tiền", code: "110", note: "V.1", closing: -20000000, level: 1, isBold: true },
  { name: "1. Tiền", code: "111", closing: -20000000, level: 2 },
  { name: "2. Các khoản tương đương tiền", code: "112", level: 2 },

  { name: "II. Đầu tư tài chính ngắn hạn", code: "120", level: 1, isBold: true },
  { name: "1. Chứng khoán kinh doanh", code: "121", note: "V.2(a)", level: 2 },
  { name: "2. Dự phòng giảm giá chứng khoán kinh doanh (*)", code: "122", level: 2 },
  { name: "3. Đầu tư nắm giữ đến ngày đáo hạn", code: "123", note: "V.2(b)", level: 2 },
  { name: "4. Dự phòng đầu tư nắm giữ đến ngày đáo hạn ngắn hạn (*)", code: "124", level: 2 },
  { name: "5. Đầu tư ngắn hạn khác", code: "125", level: 2 },
  { name: "6. Dự phòng tổn thất các khoản đầu tư ngắn hạn khác (*)", code: "126", level: 2 },

  { name: "III. Các khoản phải thu ngắn hạn", code: "130", closing: 30000000, level: 1, isBold: true },
  { name: "1. Phải thu ngắn hạn của khách hàng", code: "131", note: "V.3(a)", closing: 20000000, level: 2, isClickable: true },
  { name: "2. Trả trước cho người bán ngắn hạn", code: "132", level: 2, isClickable: true },
  { name: "3. Phải thu nội bộ ngắn hạn", code: "133", level: 2 },
  { name: "4. Phải thu theo tiến độ hợp đồng xây dựng", code: "134", level: 2 },
  { name: "5. Phải thu ngắn hạn khác", code: "135", note: "V.4(a)", closing: 10000000, level: 2, isClickable: true },
  { name: "6. Dự phòng phải thu ngắn hạn khó đòi (*)", code: "136", level: 2 },
  { name: "7. Tài sản thiếu chờ xử lý", code: "137", note: "V.5", level: 2 },

  { name: "IV. Hàng tồn kho", code: "140", note: "V.7", closing: 12475000, level: 1, isBold: true },
  { name: "1. Hàng tồn kho", code: "141", closing: 12475000, level: 2 },
  { name: "2. Dự phòng giảm giá hàng tồn kho (*)", code: "142", level: 2 },

  { name: "V. Tài sản sinh học ngắn hạn", code: "150", level: 1, isBold: true },
  { name: "1. Súc vật nuôi lấy sản phẩm một lần ngắn hạn", code: "151", note: "V.12.1.1", level: 2 },
  { name: "2. Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần ngắn hạn", code: "152", note: "V.12.1.2", level: 2 },
  { name: "3. Dự phòng tổn thất tài sản sinh học ngắn hạn (*)", code: "153", level: 2 },

  { name: "VI. Tài sản ngắn hạn khác", code: "160", closing: 2000000, level: 1, isBold: true },
  { name: "1. Chi phí chờ phân bổ ngắn hạn", code: "161", note: "V.14(a)", level: 2 },
  { name: "2. Thuế GTGT được khấu trừ", code: "162", closing: 2000000, level: 2 },
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
  { name: "TỔNG CỘNG TÀI SẢN (280 = 100 + 200)", code: "280", closing: 24475000, level: 0, isBold: true },

  // C - NỢ PHẢI TRẢ
  { name: "C - NỢ PHẢI TRẢ", code: "300", closing: 17000000, level: 0, isBold: true },
  { name: "I. Nợ ngắn hạn", code: "310", closing: 17000000, level: 1, isBold: true },
  { name: "1. Phải trả người bán ngắn hạn", code: "311", note: "V.17(a)", closing: 17000000, level: 2 },
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

  // D - VỐN CHỦ SỞ HỮU
  { name: "D - VỐN CHỦ SỞ HỮU", code: "400", level: 0, isBold: true },
  { name: "1. Vốn góp của chủ sở hữu", code: "411", note: "V.27(b)", level: 2 },
  { name: "- Cổ phiếu phổ thông có quyền biểu quyết", code: "411a", note: "V.27(d)", level: 3 },
  { name: "- Cổ phiếu ưu đãi", code: "411b", note: "V.27(d)", level: 3 },
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
  { name: "TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)", code: "440", closing: 17000000, level: 0, isBold: true },
];

function formatNumber(val?: number): { text: string; isNegative: boolean } {
  if (val === undefined || val === null || val === 0) {
    return { text: "", isNegative: false };
  }
  if (val < 0) {
    const absVal = Math.abs(val);
    return { text: `(${absVal.toLocaleString("vi-VN")})`, isNegative: true };
  }
  return { text: val.toLocaleString("vi-VN"), isNegative: false };
}

export interface MisaFinancialPositionReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaFinancialPositionReport({
  onBack,
  notify,
}: MisaFinancialPositionReportProps) {
  // Parameter Drawer State
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState<boolean>(false);

  // Search keyword in table
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // AI analysis open state
  const [showAiAnalysis, setShowAiAnalysis] = useState<boolean>(false);

  // Parameter state (matching Screenshot 1)
  const [period, setPeriod] = useState<string>("Năm");
  const [year, setYear] = useState<number>(2026);
  const [fromDate, setFromDate] = useState<string>("01/01/2026");
  const [toDate, setToDate] = useState<string>("31/12/2026");
  const [fetchFromSaved, setFetchFromSaved] = useState<boolean>(false);
  const [audited, setAudited] = useState<boolean>(false);
  const [hideZeroRows, setHideZeroRows] = useState<boolean>(false);
  const [signer, setSigner] = useState<string>("Trần Thị Hương");
  const [reportDate, setReportDate] = useState<string>("07/10/2026");

  // Selected report templates
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set(["B01-DN"]));

  // Filtered rows
  const filteredRows = useMemo(() => {
    let list = FULL_B01_DATA;
    if (hideZeroRows) {
      list = list.filter((r) => r.closing !== undefined && r.closing !== 0);
    }
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(kw) || r.code.includes(kw));
    }
    return list;
  }, [hideZeroRows, searchKeyword]);

  const handleApplyParams = () => {
    setIsParamDrawerOpen(false);
    notify?.("Đã nạp số liệu Báo cáo tình hình tài chính theo tham số năm 2026.");
  };

  const handleResetParams = () => {
    setPeriod("Năm");
    setYear(2026);
    setFromDate("01/01/2026");
    setToDate("31/12/2026");
    setHideZeroRows(false);
    notify?.("Đã đặt lại điều kiện tham số về mặc định.");
  };

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
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
            B01 - DN: Báo cáo tình hình tài chính
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            onClick={() => notify?.("Xem danh sách báo cáo mẫu đã lưu.")}
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
            onClick={() => notify?.("Đã lưu mẫu Báo cáo tình hình tài chính.")}
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
            onClick={() => setIsParamDrawerOpen(true)}
          >
            Chọn tham số
          </button>
        </div>
      </div>

      {/* 2. Top Action Bar: XML, Kiểm tra, mTax, AI Insight */}
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
            style={{ background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#334155", cursor: "pointer", fontWeight: 500 }}
            onClick={() => notify?.("Kiểm tra tính cân đối và logic báo cáo tài chính...")}
          >
            <FileCheck size={15} color="#00a862" />
            <span>Kiểm tra</span>
          </button>

          <button
            type="button"
            style={{ background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#334155", cursor: "pointer", fontWeight: 500 }}
            onClick={() => notify?.("Đang xuất khẩu báo cáo định dạng XML chuẩn Tổng cục Thuế...")}
          >
            <FileCode size={15} color="#d97706" />
            <span>Xuất XML</span>
          </button>

          <button
            type="button"
            style={{ background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0284c7", cursor: "pointer", fontWeight: 600 }}
            onClick={() => notify?.("Kết nối cổng nộp thuế điện tử MISA mTax...")}
          >
            <Send size={15} color="#0284c7" />
            <span>Nộp báo cáo qua MISA mTax</span>
          </button>

          {/* AI Analysis Sparkles Badge matching screenshot */}
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
            <span>{showAiAnalysis ? "Đóng phân tích AI" : "✨ 3 Điểm nổi bật"}</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 220 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
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
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}
            title="Làm mới"
            onClick={() => notify?.("Đã làm mới dữ liệu báo cáo.")}
          >
            <RotateCw size={14} />
          </button>

          <button
            type="button"
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi báo cáo qua email.")}
          >
            <Mail size={14} />
          </button>

          <button
            type="button"
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7", cursor: "pointer" }}
            title="Trợ giúp"
            onClick={() => notify?.("Hệ thống trợ giúp AVA Kế toán.")}
          >
            <MessageCircle size={14} />
          </button>

          <button
            type="button"
            style={{ height: 30, padding: "0 10px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 12.5, cursor: "pointer" }}
            onClick={() => notify?.("Đang chuẩn bị lệnh in...")}
          >
            <Printer size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{ height: 30, padding: "0 10px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 12.5, cursor: "pointer" }}
            onClick={() => notify?.("Đã xuất khẩu báo cáo ra Excel thành công.")}
          >
            <Download size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}
            title="Thiết lập"
            onClick={() => notify?.("Thiết lập báo cáo nâng cao.")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 3. Tab Strip matching screenshot */}
      <div style={{ padding: "8px 20px 0 20px", display: "flex", gap: 8, background: "#f8fafc" }}>
        <div
          style={{
            background: "#ffffff",
            padding: "6px 16px",
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            border: "1px solid #cbd5e1",
            borderBottom: "1px solid #ffffff",
            fontWeight: 700,
            fontSize: 13,
            color: "#00a862",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>B01 - DN</span>
        </div>
      </div>

      {/* AI Highlights Banner dropdown when clicked */}
      {showAiAnalysis && (
        <div style={{ margin: "0 20px 12px", padding: "14px 18px", background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 6, fontSize: 13, color: "#4c1d95" }}>
          <div style={{ fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={15} color="#7c3aed" />
            <span>Phân tích thông minh từ Trợ lý AVA Kế toán:</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
            <li><strong>Chỉ số Tiền mặt:</strong> Mục Tiền đang ghi nhận âm (20.000.000đ) do TK 111, 112 có số dư có tạm thời, đề nghị kiểm tra lại chứng từ thu chi.</li>
            <li><strong>Khoản phải thu:</strong> Chiếm tỷ trọng 122.5% tổng tài sản ngắn hạn (30.000.000đ/24.475.000đ). Cần lưu ý theo dõi công nợ khách hàng và tạm ứng.</li>
            <li><strong>Khả năng thanh toán nợ:</strong> Nợ ngắn hạn là 17.000.000đ trên tổng tài sản 24.475.000đ (Tỷ lệ đòn bẩy nợ 69.4%).</li>
          </ul>
        </div>
      )}

      {/* 4. Main Report Content Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column" }}>
        {/* Centered Report Title */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h1 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.2px" }}>
            BÁO CÁO TÌNH HÌNH TÀI CHÍNH
          </h1>
          <div style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>
            Tại ngày 31 tháng 12 năm 2026
          </div>
          <div style={{ fontSize: 12.5, color: "#64748b", fontStyle: "italic", marginTop: 2 }}>
            (Áp dụng cho doanh nghiệp đáp ứng giả định hoạt động liên tục)
          </div>
        </div>

        {/* Data Table */}
        <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e2f0d9", color: "#1e293b", fontWeight: 700, borderBottom: "1px solid #bbf7d0" }}>
                <th style={{ padding: "8px 14px", textAlign: "left", borderRight: "1px solid #cbd5e1", minWidth: 320 }}>
                  Chỉ tiêu
                </th>
                <th style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", width: 75 }}>
                  Mã số
                </th>
                <th style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", width: 100 }}>
                  Thuyết minh
                </th>
                <th style={{ padding: "8px 14px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 160 }}>
                  Số cuối năm
                </th>
                <th style={{ padding: "8px 14px", textAlign: "right", width: 160 }}>
                  Số đầu năm
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const closingVal = formatNumber(row.closing);
                const openingVal = formatNumber(row.opening);

                // Indentation based on level
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
                    onMouseEnter={(e) => {
                      if (row.level !== 0) e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (row.level !== 0) e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                  >
                    {/* Chỉ tiêu */}
                    <td
                      style={{
                        padding: `7px 14px 7px ${paddingLeft}px`,
                        borderRight: "1px solid #f1f5f9",
                        color: row.isClickable ? "#0284c7" : "#1e293b",
                        cursor: row.isClickable ? "pointer" : "default",
                      }}
                      onClick={() => {
                        if (row.isClickable) {
                          notify?.(`Xem chi tiết chỉ tiêu "${row.name}" (Mã ${row.code})`);
                        }
                      }}
                    >
                      {row.name}
                    </td>

                    {/* Mã số */}
                    <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9", color: "#475569" }}>
                      {row.code}
                    </td>

                    {/* Thuyết minh */}
                    <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9", color: "#64748b" }}>
                      {row.note || ""}
                    </td>

                    {/* Số cuối năm (Red if negative) */}
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

                    {/* Số đầu năm */}
                    <td style={{ padding: "7px 14px", textAlign: "right", color: "#1e293b" }}>
                      {openingVal.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
          <div>Tổng số: <strong>{filteredRows.length}</strong></div>

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
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
              >
                &lt;&lt;
              </button>
              <button
                type="button"
                disabled
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
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
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
              >
                &gt;
              </button>
              <button
                type="button"
                disabled
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
              >
                &gt;&gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Parameter Drawer "Chọn tham số" matching Screenshot 1 */}
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
              animation: "slideInRight 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
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
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}
                  title="Trợ giúp"
                  onClick={() => notify?.("Xem hướng dẫn lập báo cáo tình hình tài chính.")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}
                  title="Đóng"
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body Form */}
            <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, fontSize: 13 }}>
              {/* 1. Kỳ báo cáo & Năm */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                    Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
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
                    <option value="Năm">Năm</option>
                    <option value="6 tháng đầu năm">6 tháng đầu năm</option>
                    <option value="Quý">Quý</option>
                    <option value="Tháng">Tháng</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                    Năm
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
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

              {/* 2. Từ - Đến */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Từ
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
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
                    <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Đến
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
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
                    <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>
              </div>

              {/* 3. Checkboxes */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={fetchFromSaved}
                    onChange={(e) => setFetchFromSaved(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Lấy dữ liệu từ báo cáo tài chính đã lập</span>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 2 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                    <input
                      type="checkbox"
                      checked={audited}
                      onChange={(e) => setAudited(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>BCTC đã được kiểm toán</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                    <input
                      type="checkbox"
                      checked={hideZeroRows}
                      onChange={(e) => setHideZeroRows(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Không hiển thị chỉ tiêu có số liệu = 0</span>
                  </label>
                </div>
              </div>

              {/* 4. Report Set Selector Table matching Screenshot 1 */}
              <div>
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #cbd5e1", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                      <th style={{ width: 36, padding: "6px", textAlign: "center" }}>
                        <input type="checkbox" defaultChecked style={{ accentColor: "#00a862" }} />
                      </th>
                      <th style={{ width: 85, padding: "6px 8px", textAlign: "left" }}>Mã báo cáo</th>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>Tên báo cáo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ textAlign: "center", padding: "6px" }}>
                        <input type="checkbox" checked={selectedReports.has("B01-DN")} readOnly style={{ accentColor: "#00a862" }} />
                      </td>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>B01 - DN</td>
                      <td style={{ padding: "6px 8px" }}>Báo cáo tình hình tài chính</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ textAlign: "center", padding: "6px" }}>
                        <input type="checkbox" style={{ accentColor: "#00a862" }} />
                      </td>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>B02 - DN</td>
                      <td style={{ padding: "6px 8px" }}>Báo cáo kết quả hoạt động kinh doanh</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ textAlign: "center", padding: "6px" }}>
                        <input type="checkbox" style={{ accentColor: "#00a862" }} />
                      </td>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>B03 - DN</td>
                      <td style={{ padding: "6px 8px" }}>Báo cáo lưu chuyển tiền tệ (Phương pháp trực tiếp)</td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: "center", padding: "6px" }}>
                        <input type="checkbox" style={{ accentColor: "#00a862" }} />
                      </td>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>B03 - DN - GT</td>
                      <td style={{ padding: "6px 8px" }}>Báo cáo lưu chuyển tiền tệ (Phương pháp gián tiếp)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 5. Signer & Date created */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Người đại diện theo pháp luật
                  </label>
                  <input
                    type="text"
                    value={signer}
                    onChange={(e) => setSigner(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
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
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "14px 24px",
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
                  fontWeight: 500,
                  color: "#334155",
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
    </div>
  );
}
