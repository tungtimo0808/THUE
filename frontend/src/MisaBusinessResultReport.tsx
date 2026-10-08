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
  ExternalLink,
  Info,
} from "lucide-react";

export interface IncomeStatementItem {
  id: string;
  name: string;
  code: string;
  note?: string;
  currentPeriod: number;
  previousPeriod: number;
  isBold?: boolean;
  isClickable?: boolean;
  indent?: boolean;
  accountRef?: string;
}

// Full 21 rows of Circular 200/2014/TT-BTC B02-DN matching screenshots exactly
const BASE_INCOME_DATA: IncomeStatementItem[] = [
  {
    id: "01",
    name: "1. Doanh thu bán hàng và cung cấp dịch vụ",
    code: "01",
    note: "VI.1",
    currentPeriod: 20000000,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 511",
  },
  {
    id: "02",
    name: "2. Các khoản giảm trừ doanh thu",
    code: "02",
    note: "VI.2",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 521",
  },
  {
    id: "10",
    name: "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)",
    code: "10",
    note: "",
    currentPeriod: 20000000,
    previousPeriod: 0,
    isBold: true,
  },
  {
    id: "11",
    name: "4. Giá vốn hàng bán",
    code: "11",
    note: "VI.3",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 632",
  },
  {
    id: "20",
    name: "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)",
    code: "20",
    note: "",
    currentPeriod: 20000000,
    previousPeriod: 0,
    isBold: true,
  },
  {
    id: "21",
    name: "6. Lãi/lỗ của hoạt động bán, thanh lý bất động sản đầu tư",
    code: "21",
    note: "VI.4",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
  },
  {
    id: "22",
    name: "7. Doanh thu hoạt động tài chính",
    code: "22",
    note: "VI.5",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 515",
  },
  {
    id: "23",
    name: "8. Chi phí tài chính",
    code: "23",
    note: "VI.6",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 635",
  },
  {
    id: "24",
    name: "- Trong đó: Chi phí lãi vay",
    code: "24",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
  },
  {
    id: "25",
    name: "9. Chi phí bán hàng",
    code: "25",
    note: "VI.9",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 641",
  },
  {
    id: "26",
    name: "10. Chi phí quản lý doanh nghiệp",
    code: "26",
    note: "VI.9",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 642",
  },
  {
    id: "30",
    name: "11. Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + 21 + 22 - (23 + 25 + 26)}",
    code: "30",
    note: "",
    currentPeriod: 20000000,
    previousPeriod: 0,
    isBold: true,
  },
  {
    id: "31",
    name: "12. Thu nhập khác",
    code: "31",
    note: "VI.7",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 711",
  },
  {
    id: "32",
    name: "13. Chi phí khác",
    code: "32",
    note: "VI.8",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 811",
  },
  {
    id: "40",
    name: "14. Lợi nhuận khác (40 = 31 - 32)",
    code: "40",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isBold: true,
  },
  {
    id: "50",
    name: "15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)",
    code: "50",
    note: "",
    currentPeriod: 20000000,
    previousPeriod: 0,
    isBold: true,
  },
  {
    id: "51",
    name: "16. Chi phí thuế TNDN hiện hành",
    code: "51",
    note: "VI.11",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 8211",
  },
  {
    id: "52",
    name: "17. Chi phí thuế TNDN hoãn lại",
    code: "52",
    note: "VI.11",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 8212",
  },
  {
    id: "60",
    name: "18. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)",
    code: "60",
    note: "",
    currentPeriod: 20000000,
    previousPeriod: 0,
    isBold: true,
  },
  {
    id: "70",
    name: "19. Lãi cơ bản trên cổ phiếu (*)",
    code: "70",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
  },
  {
    id: "71",
    name: "20. Lãi suy giảm trên cổ phiếu (*)",
    code: "71",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
  },
];

export interface MisaBusinessResultReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaBusinessResultReport({
  onBack,
  notify,
}: MisaBusinessResultReportProps) {
  // Parameters Drawer State
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [period, setPeriod] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [fetchFromSaved, setFetchFromSaved] = useState(false);
  const [hideZero, setHideZero] = useState(false);

  // Temporary drawer draft state for user changes
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
  const [drilldownItem, setDrilldownItem] = useState<IncomeStatementItem | null>(null);

  // Saved reports modal
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);

  // Open drawer helper
  const handleOpenDrawer = () => {
    setDraftPeriod(period);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftFetchFromSaved(fetchFromSaved);
    setDraftHideZero(hideZero);
    setIsParamDrawerOpen(true);
  };

  // Apply parameters from drawer
  const handleApplyParams = () => {
    setPeriod(draftPeriod);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setFetchFromSaved(draftFetchFromSaved);
    setHideZero(draftHideZero);
    setIsParamDrawerOpen(false);
    notify?.("Đã tải lại báo cáo với tham số mới.");
  };

  // Reset parameters in drawer
  const handleResetParams = () => {
    setDraftPeriod("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftFetchFromSaved(false);
    setDraftHideZero(false);
  };

  // Number formatter matching MISA AMIS: 0 is rendered as 0, negative in (x.xxx.xxx)
  const formatNumber = (num: number) => {
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
    return BASE_INCOME_DATA.filter((row) => {
      // Filter out zero rows if hideZero is active
      if (hideZero) {
        if (row.currentPeriod === 0 && row.previousPeriod === 0) {
          return false;
        }
      }

      // Filter by keyword if provided
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
      {/* 1. Header Bar matching MISA AMIS B02-DN */}
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
            B02 - DN: Báo cáo kết quả hoạt động kinh doanh
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
            onClick={() => notify?.("Đã lưu báo cáo B02-DN kỳ tháng 10/2026 thành công.")}
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

      {/* 2. Sub-Toolbar: Kiểm tra, AI, Search, Refresh, Print, Export */}
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
              notify?.("Kiểm tra tính hợp lý của doanh thu thuần, giá vốn và chi phí...")
            }
          >
            <FileCheck size={15} color="#00a862" />
            <span>Kiểm tra</span>
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
            <span>{showAiAnalysis ? "Đóng phân tích AVA" : "✨ Đang phân tích..."}</span>
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
            onClick={() => notify?.("Đã làm mới dữ liệu báo cáo kết quả hoạt động kinh doanh.")}
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
            onClick={() => notify?.("Đang kết nối lệnh in chuẩn A4...")}
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
              notify?.("Đã xuất khẩu báo cáo kết quả kinh doanh ra Excel thành công.")
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
            title="Tùy chỉnh cột hiển thị"
            onClick={() => notify?.("Mở thiết lập cột báo cáo.")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 3. AI Highlight Panel if open */}
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
              Phân tích thông minh kết quả hoạt động kinh doanh (AVA Kế toán):
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 }}>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#00a862" }}>1. Doanh thu thuần: 20.000.000 đ</strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Doanh thu đạt chỉ tiêu tháng 10. Không phát sinh các khoản giảm trừ doanh thu (chiết khấu, hàng bán trả lại).
                </p>
              </div>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#d97706" }}>2. Tỷ suất LN gộp: 100%</strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Giá vốn hàng bán ghi nhận 0 đ. Cần kiểm tra lại các phiếu xuất kho giá vốn (TK 632) đã được kết chuyển chưa.
                </p>
              </div>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#2563eb" }}>3. LN sau thuế: 20.000.000 đ</strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Chi phí quản lý và bán hàng là 0 đ. Chưa trích chi phí thuế TNDN hiện hành tạm tính cho quý/năm.
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
              BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH
            </h1>
            <div
              style={{
                fontSize: 13,
                fontStyle: "italic",
                color: "#475569",
                marginTop: 6,
              }}
            >
              Kỳ kế toán tháng 10 năm 2026
            </div>
          </div>

          {/* Table Container */}
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
                        paddingLeft: row.indent ? 28 : 12,
                        color: row.isClickable ? "#0073e6" : "#1e293b",
                        cursor: row.isClickable ? "pointer" : "default",
                      }}
                      onClick={() => {
                        if (row.isClickable) {
                          setDrilldownItem(row);
                          notify?.(`Xem chi tiết chỉ tiêu "${row.name}" (Mã ${row.code})`);
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

      {/* 6. Parameter Drawer "Chọn tham số" matching Image 1 */}
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
                      "Xem hướng dẫn lập báo cáo kết quả hoạt động kinh doanh B02-DN."
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

            {/* Drawer Footer Buttons matching Image 1: Xóa điều kiện, Hủy, Xem báo cáo */}
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

      {/* 7. Modal: Drill-down Sổ chi tiết khi click vào chỉ tiêu link xanh */}
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
                <span>Số phát sinh: <strong style={{ color: "#00a862" }}>{drilldownItem.currentPeriod.toLocaleString("vi-VN")} đ</strong></span>
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
                    <th style={{ padding: "8px 10px" }}>Ngày CT</th>
                    <th style={{ padding: "8px 10px" }}>Số CT</th>
                    <th style={{ padding: "8px 10px" }}>Diễn giải</th>
                    <th style={{ padding: "8px 10px" }}>TK đối ứng</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Số tiền (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldownItem.currentPeriod > 0 ? (
                    <tr>
                      <td style={{ padding: "8px 10px" }}>15/10/2026</td>
                      <td style={{ padding: "8px 10px", color: "#0284c7", fontWeight: 600 }}>BH0001</td>
                      <td style={{ padding: "8px 10px" }}>Doanh thu bán hàng theo hóa đơn điện tử GTGT</td>
                      <td style={{ padding: "8px 10px" }}>131 / 111</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#00a862" }}>
                        {drilldownItem.currentPeriod.toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "24px",
                          textAlign: "center",
                          color: "#94a3b8",
                          fontStyle: "italic",
                        }}
                      >
                        Không có chứng từ phát sinh trong kỳ báo cáo đã chọn.
                      </td>
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
                Danh sách báo cáo B02-DN đã lưu
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
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>B02-DN Tháng 10/2026 (Bản chính thức)</td>
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
                        notify?.("Đã tải bản lưu B02-DN Tháng 10/2026.");
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
