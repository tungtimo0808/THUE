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
} from "lucide-react";

export interface CashFlowIndirectItem {
  id: string;
  name: string;
  code?: string;
  note?: string;
  currentPeriod?: number;
  previousPeriod?: number;
  isHeader?: boolean;
  isBold?: boolean;
  isClickable?: boolean;
  accountRef?: string;
  indent?: boolean;
}

// Complete Full Catalogue of B03 - DN - GT (PP gián tiếp) matching Circular 200 & MISA AMIS Screenshot
const BASE_INDIRECT_DATA: CashFlowIndirectItem[] = [
  // I. Lưu chuyển tiền từ hoạt động kinh doanh
  {
    id: "sec_1",
    name: "I. Lưu chuyển tiền từ hoạt động kinh doanh",
    isHeader: true,
    isBold: true,
  },
  {
    id: "01",
    name: "1. Lợi nhuận trước thuế",
    code: "01",
    note: "",
    currentPeriod: 20000000,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "B02-DN Mã 50",
  },
  {
    id: "sub_adj",
    name: "2. Điều chỉnh cho các khoản",
    isHeader: true,
    isBold: true,
  },
  {
    id: "02",
    name: "- Khấu hao TSCĐ và BĐSĐT",
    code: "02",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
    accountRef: "TK 214",
  },
  {
    id: "03",
    name: "- Các khoản dự phòng",
    code: "03",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
    accountRef: "TK 229",
  },
  {
    id: "04",
    name: "- Lãi, lỗ chênh lệch tỷ giá hối đoái do đánh giá lại các khoản mục tiền tệ có gốc ngoại tệ",
    code: "04",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
    accountRef: "TK 413, 515, 635",
  },
  {
    id: "05",
    name: "- Lãi, lỗ từ hoạt động đầu tư, tài chính",
    code: "05",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
  },
  {
    id: "06",
    name: "- Chi phí lãi vay",
    code: "06",
    note: "VI.6",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
    accountRef: "TK 635",
  },
  {
    id: "07",
    name: "- Các khoản điều chỉnh khác",
    code: "07",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
  },
  {
    id: "08",
    name: "3. Lợi nhuận từ hoạt động kinh doanh trước thay đổi vốn lưu động",
    code: "08",
    note: "",
    currentPeriod: 20000000,
    previousPeriod: 0,
    isBold: true,
  },
  {
    id: "09",
    name: "- Tăng, giảm các khoản phải thu",
    code: "09",
    note: "",
    currentPeriod: -32000000,
    previousPeriod: 0,
    isClickable: true,
    indent: true,
    accountRef: "TK 131, 138, 133",
  },
  {
    id: "10",
    name: "- Tăng, giảm hàng tồn kho",
    code: "10",
    note: "",
    currentPeriod: -12475000,
    previousPeriod: 0,
    isClickable: true,
    indent: true,
    accountRef: "TK 156, 152, 155",
  },
  {
    id: "11",
    name: "- Tăng, giảm các khoản phải trả (không kể lãi vay phải trả, thuế thu nhập doanh nghiệp phải nộp)",
    code: "11",
    note: "",
    currentPeriod: 17000000,
    previousPeriod: 0,
    isClickable: true,
    indent: true,
    accountRef: "TK 331, 338",
  },
  {
    id: "12",
    name: "- Tăng, giảm chi phí chờ phân bổ",
    code: "12",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
    accountRef: "TK 242",
  },
  {
    id: "13",
    name: "- Tăng, giảm chứng khoán kinh doanh",
    code: "13",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
    accountRef: "TK 121",
  },
  {
    id: "14",
    name: "- Chi phí lãi vay đã trả",
    code: "14",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
  },
  {
    id: "15",
    name: "- Thuế thu nhập doanh nghiệp đã nộp",
    code: "15",
    note: "V.19",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
    accountRef: "TK 3334",
  },
  {
    id: "16",
    name: "- Tiền thu khác từ hoạt động kinh doanh",
    code: "16",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
  },
  {
    id: "17",
    name: "- Tiền chi khác cho hoạt động kinh doanh",
    code: "17",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
  },
  {
    id: "20",
    name: "Lưu chuyển tiền thuần từ hoạt động kinh doanh",
    code: "20",
    note: "",
    currentPeriod: -7475000,
    previousPeriod: 0,
    isBold: true,
  },

  // II. Lưu chuyển tiền từ hoạt động đầu tư
  {
    id: "sec_2",
    name: "II. Lưu chuyển tiền từ hoạt động đầu tư",
    isHeader: true,
    isBold: true,
  },
  {
    id: "21",
    name: "1. Tiền chi để mua sắm, xây dựng TSCĐ và các tài sản dài hạn khác",
    code: "21",
    note: "V.8",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "22",
    name: "2. Tiền thu từ thanh lý, nhượng bán TSCĐ và các tài sản dài hạn khác",
    code: "22",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "23",
    name: "3. Tiền chi cho vay, mua các công cụ nợ của các đơn vị khác",
    code: "23",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "24",
    name: "4. Tiền thu hồi cho vay, bán lại các công cụ nợ của các đơn vị khác",
    code: "24",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "25",
    name: "5. Tiền chi đầu tư góp vốn vào đơn vị khác",
    code: "25",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "26",
    name: "6. Tiền thu hồi đầu tư góp vốn vào đơn vị khác",
    code: "26",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "27",
    name: "7. Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia",
    code: "27",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "30",
    name: "Lưu chuyển tiền thuần từ hoạt động đầu tư",
    code: "30",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isBold: true,
  },

  // III. Lưu chuyển tiền từ hoạt động tài chính
  {
    id: "sec_3",
    name: "III. Lưu chuyển tiền từ hoạt động tài chính",
    isHeader: true,
    isBold: true,
  },
  {
    id: "31",
    name: "1. Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu",
    code: "31",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "32",
    name: "2. Tiền trả lại vốn góp cho các chủ sở hữu, mua lại cổ phiếu đã phát hành",
    code: "32",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "33",
    name: "3. Tiền thu từ đi vay",
    code: "33",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "34",
    name: "4. Tiền trả nợ gốc vay",
    code: "34",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "35",
    name: "5. Tiền trả nợ gốc thuê tài chính",
    code: "35",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "36",
    name: "6. Cổ tức, lợi nhuận đã trả cho chủ sở hữu",
    code: "36",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "40",
    name: "Lưu chuyển tiền thuần từ hoạt động tài chính",
    code: "40",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isBold: true,
  },

  // Tổng hợp dòng tiền
  {
    id: "50",
    name: "Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)",
    code: "50",
    note: "",
    currentPeriod: -7475000,
    previousPeriod: 0,
    isBold: true,
  },
  {
    id: "60",
    name: "Tiền và tương đương tiền đầu kỳ",
    code: "60",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isBold: true,
  },
  {
    id: "61",
    name: "Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ",
    code: "61",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
  },
  {
    id: "70",
    name: "Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61)",
    code: "70",
    note: "V.1",
    currentPeriod: -7475000,
    previousPeriod: 0,
    isBold: true,
  },
];

export interface MisaCashFlowIndirectReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaCashFlowIndirectReport({
  onBack,
  notify,
}: MisaCashFlowIndirectReportProps) {
  // Parameters Drawer State
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [period, setPeriod] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [fetchFromSaved, setFetchFromSaved] = useState(false);
  const [hideZero, setHideZero] = useState(false);

  // Temporary drawer draft state
  const [draftPeriod, setDraftPeriod] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftFetchFromSaved, setDraftFetchFromSaved] = useState(false);
  const [draftHideZero, setDraftHideZero] = useState(false);

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  // AI highlights state
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);

  // Drilldown modal state
  const [drilldownItem, setDrilldownItem] = useState<CashFlowIndirectItem | null>(null);

  // Saved reports modal
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);

  const handleOpenDrawer = () => {
    setDraftPeriod(period);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftFetchFromSaved(fetchFromSaved);
    setDraftHideZero(hideZero);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriod(draftPeriod);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setFetchFromSaved(draftFetchFromSaved);
    setHideZero(draftHideZero);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật tham số Lưu chuyển tiền tệ (PP gián tiếp).");
  };

  const handleResetParams = () => {
    setDraftPeriod("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftFetchFromSaved(false);
    setDraftHideZero(false);
  };

  // Format currency: 0 -> "0", negative -> "(7.475.000)" in red
  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return { text: "", isNegative: false };
    if (num === 0) return { text: "0", isNegative: false };
    if (num < 0) {
      return {
        text: `(${Math.abs(num).toLocaleString("vi-VN")})`,
        isNegative: true,
      };
    }
    return {
      text: num.toLocaleString("vi-VN"),
      isNegative: false,
    };
  };

  // Filter rows based on search keyword and hideZero checkbox
  const filteredRows = useMemo(() => {
    return BASE_INDIRECT_DATA.filter((row) => {
      if (row.isHeader) {
        if (!searchKeyword.trim()) return true;
      }

      if (hideZero && !row.isHeader) {
        if (
          (row.currentPeriod === 0 || row.currentPeriod === undefined) &&
          (row.previousPeriod === 0 || row.previousPeriod === undefined)
        ) {
          return false;
        }
      }

      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return (
          row.name.toLowerCase().includes(kw) ||
          (row.code && row.code.toLowerCase().includes(kw)) ||
          (row.note && row.note.toLowerCase().includes(kw))
        );
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
      {/* 1. Top Header Bar matching MISA AMIS B03-DN-GT */}
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
            B03 - DN - GT: Báo cáo lưu chuyển tiền tệ (PP gián tiếp)
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
            onClick={() => notify?.("Đã lưu báo cáo B03-DN-GT kỳ tháng 10/2026 thành công.")}
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
            onClick={() =>
              notify?.("Kiểm tra sự khớp nối giữa lợi nhuận và lưu chuyển tiền thuần...")
            }
          >
            <FileCheck size={15} color="#00a862" />
            <span>Kiểm tra</span>
          </button>

          {/* AI Analysis Sparkles Badge */}
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
            <span>{showAiAnalysis ? "Đóng phân tích AVA" : "✨ Phân tích biến động vốn lưu động"}</span>
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
            onClick={() => notify?.("Đã làm mới dữ liệu báo cáo.")}
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
            onClick={() =>
              notify?.("Đã xuất khẩu báo cáo lưu chuyển tiền tệ (gián tiếp) ra Excel.")
            }
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
            onClick={() => notify?.("Mở cài đặt cột hiển thị.")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 3. AI Analysis Banner if active */}
      {showAiAnalysis && (
        <div
          style={{
            margin: "12px 20px 0",
            padding: "14px 18px",
            background: "#faf5ff",
            border: "1px solid #e9d5ff",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(124, 58, 237, 0.08)",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <Sparkles size={20} color="#7c3aed" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, fontSize: 13, color: "#4c1d95", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13.5 }}>
              Cơ chế điều chỉnh lưu chuyển tiền thuần từ Lợi nhuận (AVA Kế toán):
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 }}>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#00a862" }}>1. Lợi nhuận trước thuế: +20.000.000 đ</strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Điểm khởi đầu của phương pháp gián tiếp, lấy trực tiếp từ Mã 50 trên B02-DN.
                </p>
              </div>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#dc2626" }}>2. Vốn lưu động thâm hụt: -27.475.000 đ</strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Do Tăng phải thu: -32.000.000 đ; Tăng tồn kho: -12.475.000 đ; bù trừ Tăng phải trả: +17.000.000 đ.
                </p>
              </div>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#dc2626" }}>3. Lưu chuyển tiền thuần: (7.475.000) đ</strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Dòng tiền kinh doanh âm (7.475.000) đ do lợi nhuận tạo ra bị chôn vào công nợ phải thu và hàng tồn kho.
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            style={{ background: "transparent", border: "none", color: "#a855f7", cursor: "pointer", padding: 4 }}
            onClick={() => setShowAiAnalysis(false)}
          >
            <X size={16} />
          </button>
        </div>
      )}

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
          {/* Report Sheet Title */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
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
              BÁO CÁO LƯU CHUYỂN TIỀN TỆ
            </h1>
            <div
              style={{
                fontSize: 13,
                fontStyle: "italic",
                color: "#475569",
                marginTop: 4,
              }}
            >
              (Theo phương pháp gián tiếp)
            </div>
            <div
              style={{
                fontSize: 13,
                fontStyle: "italic",
                color: "#475569",
                marginTop: 4,
              }}
            >
              Kỳ kế toán tháng 10 năm 2026
            </div>
          </div>

          {/* Table */}
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
                  background: "#e2f0d9", // Signature MISA mint green header
                  borderBottom: "1px solid #cbd5e1",
                  color: "#1e293b",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <th
                  style={{
                    padding: "9px 12px",
                    textAlign: "center",
                    borderRight: "1px solid #c2d9b8",
                  }}
                >
                  Chỉ tiêu
                </th>
                <th
                  style={{
                    padding: "9px 10px",
                    textAlign: "center",
                    width: 70,
                    borderRight: "1px solid #c2d9b8",
                  }}
                >
                  Mã số
                </th>
                <th
                  style={{
                    padding: "9px 10px",
                    textAlign: "center",
                    width: 110,
                    borderRight: "1px solid #c2d9b8",
                  }}
                >
                  Thuyết minh
                </th>
                <th
                  style={{
                    padding: "9px 14px",
                    textAlign: "center",
                    width: 170,
                    borderRight: "1px solid #c2d9b8",
                  }}
                >
                  Kỳ này
                </th>
                <th
                  style={{
                    padding: "9px 14px",
                    textAlign: "center",
                    width: 150,
                  }}
                >
                  Kỳ trước
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => {
                const currentFormatted = formatNumber(row.currentPeriod);
                const previousFormatted = formatNumber(row.previousPeriod);

                // Section Headers
                if (row.isHeader) {
                  return (
                    <tr
                      key={row.id}
                      style={{
                        background: "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                        fontWeight: 700,
                      }}
                    >
                      <td
                        colSpan={5}
                        style={{
                          padding: "8px 12px",
                          color: "#0f172a",
                          fontWeight: 700,
                        }}
                      >
                        {row.name}
                      </td>
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
                    {/* Chỉ tiêu */}
                    <td
                      style={{
                        padding: "7px 12px",
                        borderRight: "1px solid #f1f5f9",
                        fontWeight: row.isBold ? 700 : 400,
                        paddingLeft: row.indent ? 24 : 12,
                        color: row.isClickable ? "#0073e6" : "#1e293b",
                        cursor: row.isClickable ? "pointer" : "default",
                      }}
                      onClick={() => {
                        if (row.isClickable) {
                          setDrilldownItem(row);
                          notify?.(`Xem sổ chi tiết phát sinh "${row.name}" (Mã ${row.code})`);
                        }
                      }}
                    >
                      {row.name}
                    </td>

                    {/* Mã số */}
                    <td
                      style={{
                        padding: "7px 10px",
                        textAlign: "center",
                        borderRight: "1px solid #f1f5f9",
                        color: "#475569",
                        fontWeight: row.isBold ? 700 : 400,
                      }}
                    >
                      {row.code}
                    </td>

                    {/* Thuyết minh */}
                    <td
                      style={{
                        padding: "7px 10px",
                        textAlign: "center",
                        borderRight: "1px solid #f1f5f9",
                        color: "#64748b",
                      }}
                    >
                      {row.note || ""}
                    </td>

                    {/* Kỳ này */}
                    <td
                      style={{
                        padding: "7px 14px",
                        textAlign: "right",
                        borderRight: "1px solid #f1f5f9",
                        color: currentFormatted.isNegative ? "#dc2626" : "#1e293b",
                        fontWeight: row.isBold || currentFormatted.isNegative ? 700 : 400,
                      }}
                    >
                      {currentFormatted.text}
                    </td>

                    {/* Kỳ trước */}
                    <td
                      style={{
                        padding: "7px 14px",
                        textAlign: "right",
                        color: previousFormatted.isNegative ? "#dc2626" : "#1e293b",
                        fontWeight: row.isBold || previousFormatted.isNegative ? 700 : 400,
                      }}
                    >
                      {previousFormatted.text}
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
          <div>
            Tổng số: <strong>{filteredRows.length}</strong>
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
              maxWidth: 440,
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
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Trợ giúp"
                  onClick={() =>
                    notify?.(
                      "Xem hướng dẫn lập Báo cáo lưu chuyển tiền tệ (PP gián tiếp) B03-DN-GT."
                    )
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

            {/* Drawer Body Form */}
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
              {/* 1. Kỳ báo cáo * */}
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  value={draftPeriod}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraftPeriod(val);
                    if (val === "Tháng này") {
                      setDraftFromDate("01/10/2026");
                      setDraftToDate("31/10/2026");
                    } else if (val === "Tháng trước") {
                      setDraftFromDate("01/09/2026");
                      setDraftToDate("30/09/2026");
                    } else if (val === "Quý này") {
                      setDraftFromDate("01/10/2026");
                      setDraftToDate("31/12/2026");
                    } else if (val === "Năm nay") {
                      setDraftFromDate("01/01/2026");
                      setDraftToDate("31/12/2026");
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
                  <option value="Tháng này">Tháng này</option>
                  <option value="Tháng trước">Tháng trước</option>
                  <option value="Quý này">Quý này</option>
                  <option value="Quý trước">Quý trước</option>
                  <option value="6 tháng đầu năm">6 tháng đầu năm</option>
                  <option value="Năm nay">Năm nay</option>
                  <option value="Năm trước">Năm trước</option>
                  <option value="Tùy chọn">Tùy chọn</option>
                </select>
              </div>

              {/* 2. Từ ngày & Đến ngày */}
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

              {/* 3. Checkboxes */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginTop: 6,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftFetchFromSaved}
                    onChange={(e) => setDraftFetchFromSaved(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Lấy dữ liệu từ báo cáo tài chính đã lập</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftHideZero}
                    onChange={(e) => setDraftHideZero(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Không hiển thị các chỉ tiêu có số liệu = 0</span>
                </label>
              </div>
            </div>

            {/* Drawer Footer Buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#475569",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                onClick={handleResetParams}
              >
                Xóa điều kiện
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  style={{
                    height: 34,
                    padding: "0 16px",
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
        </div>
      )}

      {/* 7. Modal: Drill-down chi tiết biến động */}
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
              maxWidth: 780,
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
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  {drilldownItem.name} {drilldownItem.accountRef ? `(${drilldownItem.accountRef})` : ""}
                </h3>
              </div>
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                }}
                onClick={() => setDrilldownItem(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  fontSize: 12.5,
                  color: "#64748b",
                }}
              >
                <span>Thời gian: Từ <strong>{fromDate}</strong> đến <strong>{toDate}</strong></span>
                <span>
                  Giá trị ảnh hưởng dòng tiền:{" "}
                  <strong style={{ color: (drilldownItem.currentPeriod || 0) < 0 ? "#dc2626" : "#00a862" }}>
                    {formatNumber(drilldownItem.currentPeriod).text} đ
                  </strong>
                </span>
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12.5,
                  border: "1px solid #e2e8f0",
                }}
              >
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left", color: "#334155" }}>
                    <th style={{ padding: "8px 10px" }}>Tài khoản</th>
                    <th style={{ padding: "8px 10px" }}>Tên tài khoản</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Số dư đầu kỳ</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Số dư cuối kỳ</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Ảnh hưởng tiền (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldownItem.code === "09" && (
                    <>
                      <tr>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>131</td>
                        <td style={{ padding: "8px 10px" }}>Phải thu của khách hàng</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>0</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>20.000.000</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#dc2626", fontWeight: 600 }}>(20.000.000)</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>1388</td>
                        <td style={{ padding: "8px 10px" }}>Phải thu khác</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>0</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>10.000.000</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#dc2626", fontWeight: 600 }}>(10.000.000)</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>1331</td>
                        <td style={{ padding: "8px 10px" }}>Thuế GTGT được khấu trừ</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>0</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>2.000.000</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#dc2626", fontWeight: 600 }}>(2.000.000)</td>
                      </tr>
                    </>
                  )}

                  {drilldownItem.code === "10" && (
                    <tr>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>1561</td>
                      <td style={{ padding: "8px 10px" }}>Hàng hóa kho chính</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>0</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>12.475.000</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#dc2626", fontWeight: 600 }}>(12.475.000)</td>
                    </tr>
                  )}

                  {drilldownItem.code === "11" && (
                    <tr>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>331</td>
                      <td style={{ padding: "8px 10px" }}>Phải trả cho người bán ngắn hạn</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>0</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>17.000.000</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#00a862", fontWeight: 600 }}>+17.000.000</td>
                    </tr>
                  )}

                  {drilldownItem.code === "01" && (
                    <tr>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>B02-DN</td>
                      <td style={{ padding: "8px 10px" }}>Tổng lợi nhuận kế toán trước thuế</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>-</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>20.000.000</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#00a862", fontWeight: 600 }}>+20.000.000</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Danh sách báo cáo B03-DN-GT đã lưu
              </h3>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setIsSavedReportsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                border: "1px solid #e2e8f0",
              }}
            >
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
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>B03-DN-GT Tháng 10/2026 (PP gián tiếp)</td>
                  <td style={{ padding: "8px 12px" }}>Tháng 10/2026</td>
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
                        notify?.("Đã tải bản lưu B03-DN-GT Tháng 10/2026.");
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
