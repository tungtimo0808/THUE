import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronDown,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Calendar,
  Search,
  FileText,
  Send,
  MessageCircle,
} from "lucide-react";

export interface InterimIncomeItem {
  id: string;
  name: string;
  code: string;
  note?: string;
  quarterCurrent?: number;  // Quý 4 - Năm nay
  quarterPrevious?: number; // Quý 4 - Năm trước
  accumCurrent?: number;    // Lũy kế - Năm nay
  accumPrevious?: number;   // Lũy kế - Năm trước
  isBold?: boolean;
  isClickable?: boolean;
  indent?: boolean;
}

// Full Catalogue of B02a - DN matching Screenshot exactly
const FULL_B02A_DATA: InterimIncomeItem[] = [
  {
    id: "01",
    name: "1. Doanh thu bán hàng và cung cấp dịch vụ",
    code: "01",
    note: "VI.1",
    quarterCurrent: 20000000,
    quarterPrevious: 0,
    accumCurrent: 20000000,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "02",
    name: "2. Các khoản giảm trừ doanh thu",
    code: "02",
    note: "VI.2",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "10",
    name: "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)",
    code: "10",
    note: "",
    quarterCurrent: 20000000,
    quarterPrevious: 0,
    accumCurrent: 20000000,
    accumPrevious: 0,
    isBold: true,
  },
  {
    id: "11",
    name: "4. Giá vốn hàng bán",
    code: "11",
    note: "VI.3",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "20",
    name: "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)",
    code: "20",
    note: "",
    quarterCurrent: 20000000,
    quarterPrevious: 0,
    accumCurrent: 20000000,
    accumPrevious: 0,
    isBold: true,
  },
  {
    id: "21",
    name: "6. Lãi/lỗ của hoạt động bán, thanh lý bất động sản đầu tư",
    code: "21",
    note: "VI.4",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "22",
    name: "7. Doanh thu hoạt động tài chính",
    code: "22",
    note: "VI.5",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "23",
    name: "8. Chi phí tài chính",
    code: "23",
    note: "VI.6",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "24",
    name: "- Trong đó: Chi phí đi vay",
    code: "24",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    indent: true,
  },
  {
    id: "25",
    name: "9. Chi phí bán hàng",
    code: "25",
    note: "VI.9",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "26",
    name: "10. Chi phí quản lý doanh nghiệp",
    code: "26",
    note: "VI.9",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "30",
    name: "11. Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + 21 + 22 - (23 + 25 + 26)}",
    code: "30",
    note: "",
    quarterCurrent: 20000000,
    quarterPrevious: 0,
    accumCurrent: 20000000,
    accumPrevious: 0,
    isBold: true,
  },
  {
    id: "31",
    name: "12. Thu nhập khác",
    code: "31",
    note: "VI.7",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "32",
    name: "13. Chi phí khác",
    code: "32",
    note: "VI.8",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "40",
    name: "14. Lợi nhuận khác (40 = 31 - 32)",
    code: "40",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isBold: true,
  },
  {
    id: "50",
    name: "15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)",
    code: "50",
    note: "",
    quarterCurrent: 20000000,
    quarterPrevious: 0,
    accumCurrent: 20000000,
    accumPrevious: 0,
    isBold: true,
  },
  {
    id: "51",
    name: "16. Chi phí thuế TNDN hiện hành",
    code: "51",
    note: "VI.11",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "52",
    name: "17. Chi phí thuế TNDN hoãn lại",
    code: "52",
    note: "VI.11",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "60",
    name: "18. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)",
    code: "60",
    note: "",
    quarterCurrent: 20000000,
    quarterPrevious: 0,
    accumCurrent: 20000000,
    accumPrevious: 0,
    isBold: true,
  },
  {
    id: "70",
    name: "19. Lãi cơ bản trên cổ phiếu (*)",
    code: "70",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
  },
  {
    id: "71",
    name: "20. Lãi suy giảm trên cổ phiếu (*)",
    code: "71",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
  },
];

export interface MisaInterimBusinessResultReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaInterimBusinessResultReport({
  onBack,
  notify,
}: MisaInterimBusinessResultReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [period, setPeriod] = useState("Quý 4");
  const [year, setYear] = useState(2026);
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/12/2026");
  const [fetchFromSaved, setFetchFromSaved] = useState(false);
  const [hideZero, setHideZero] = useState(false);

  // Temporary drawer draft state
  const [draftPeriod, setDraftPeriod] = useState("Quý 4");
  const [draftYear, setDraftYear] = useState(2026);
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/12/2026");
  const [draftFetchFromSaved, setDraftFetchFromSaved] = useState(false);
  const [draftHideZero, setDraftHideZero] = useState(false);

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  // Saved reports modal
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);

  // Drilldown modal item
  const [drilldownItem, setDrilldownItem] = useState<{
    name: string;
    code: string;
    val?: number;
  } | null>(null);

  const handleOpenDrawer = () => {
    setDraftPeriod(period);
    setDraftYear(year);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftFetchFromSaved(fetchFromSaved);
    setDraftHideZero(hideZero);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriod(draftPeriod);
    setYear(draftYear);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setFetchFromSaved(draftFetchFromSaved);
    setHideZero(draftHideZero);
    setIsParamDrawerOpen(false);
    notify?.("Đã tải lại B02a - DN với tham số mới.");
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
    if (val === undefined || val === null) return { text: "0", isNegative: false };
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
      {/* 1. Top Header Bar matching Screenshot */}
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
            B02a-DN: Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)
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
            onClick={() => notify?.("Đã lưu B02a - DN kỳ quý 4/2026 thành công.")}
          >
            Lưu báo cáo
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 18px",
              background: "#00a862",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
            onClick={handleOpenDrawer}
          >
            Chọn tham số
          </button>
        </div>
      </div>

      {/* 2. Action Toolbar matching Screenshot */}
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
            onClick={() => notify?.("Đang xuất khẩu tệp XML theo chuẩn TCT...")}
          >
            <FileText size={15} color="#64748b" />
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
            onClick={() => notify?.("Đã xuất khẩu báo cáo B02a - DN ra Excel.")}
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

      {/* 3. Main Report Sheet Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 20,
          background: "#ffffff",
          margin: 16,
          borderRadius: 4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          border: "1px solid #e2e8f0",
        }}
      >
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
            BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH GIỮA NIÊN ĐỘ
          </h1>
          <div style={{ fontSize: 13, fontStyle: "italic", color: "#475569", marginTop: 4 }}>
            (Dạng đầy đủ)
          </div>
          <div style={{ fontSize: 13, color: "#1e293b", marginTop: 4, fontWeight: 500 }}>
            Kỳ kế toán quý 4 năm {year}
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
                  width: 65,
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
                  width: 95,
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
                  borderRight: "1px solid #c2d9b8",
                  borderBottom: "1px solid #c2d9b8",
                }}
              >
                Quý 4
              </th>
              <th
                colSpan={2}
                style={{
                  padding: "8px 14px",
                  textAlign: "center",
                  borderBottom: "1px solid #c2d9b8",
                }}
              >
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
              <th
                style={{
                  padding: "7px 14px",
                  textAlign: "center",
                  width: 140,
                  borderRight: "1px solid #c2d9b8",
                }}
              >
                Năm nay
              </th>
              <th
                style={{
                  padding: "7px 14px",
                  textAlign: "center",
                  width: 140,
                  borderRight: "1px solid #c2d9b8",
                }}
              >
                Năm trước
              </th>
              <th
                style={{
                  padding: "7px 14px",
                  textAlign: "center",
                  width: 140,
                  borderRight: "1px solid #c2d9b8",
                }}
              >
                Năm nay
              </th>
              <th
                style={{
                  padding: "7px 14px",
                  textAlign: "center",
                  width: 140,
                }}
              >
                Năm trước
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredB02aRows.map((row, index) => {
              const qCur = formatValue(row.quarterCurrent);
              const qPrev = formatValue(row.quarterPrevious);
              const accCur = formatValue(row.accumCurrent);
              const accPrev = formatValue(row.accumPrevious);

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
                      paddingLeft: row.indent ? 28 : 12,
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
                  {/* Quý 4 - Năm nay */}
                  <td
                    onClick={() => {
                      if (row.isClickable && row.quarterCurrent) {
                        setDrilldownItem({
                          name: row.name,
                          code: row.code,
                          val: row.quarterCurrent,
                        });
                      }
                    }}
                    style={{
                      padding: "7px 14px",
                      textAlign: "right",
                      borderRight: "1px solid #f1f5f9",
                      color: qCur.isNegative ? "#dc2626" : "#1e293b",
                      fontWeight: row.isBold || qCur.isNegative ? 700 : 400,
                      cursor: row.isClickable && row.quarterCurrent ? "pointer" : "default",
                    }}
                  >
                    {qCur.text}
                  </td>
                  {/* Quý 4 - Năm trước */}
                  <td
                    style={{
                      padding: "7px 14px",
                      textAlign: "right",
                      borderRight: "1px solid #f1f5f9",
                      color: qPrev.isNegative ? "#dc2626" : "#1e293b",
                      fontWeight: row.isBold || qPrev.isNegative ? 700 : 400,
                    }}
                  >
                    {qPrev.text}
                  </td>
                  {/* Lũy kế - Năm nay */}
                  <td
                    onClick={() => {
                      if (row.isClickable && row.accumCurrent) {
                        setDrilldownItem({
                          name: row.name,
                          code: row.code,
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
                      cursor: row.isClickable && row.accumCurrent ? "pointer" : "default",
                    }}
                  >
                    {accCur.text}
                  </td>
                  {/* Lũy kế - Năm trước */}
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

        {/* 4. Footer Pagination Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 4px 0",
            fontSize: 13,
            color: "#475569",
          }}
        >
          <div>
            Tổng số: <strong>{filteredB02aRows.length}</strong>
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

      {/* 5. Parameter Drawer "Chọn tham số" matching Screenshot 1 */}
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
                    notify?.("Xem hướng dẫn lập B02a - DN: Báo cáo kết quả hoạt động kinh doanh giữa niên độ.")
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
            </div>

            {/* Footer matching Screenshot 1 */}
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
                  padding: "0 16px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#334155",
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
        </div>
      )}

      {/* 6. Modal: Drill-down Sổ chi tiết */}
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
                <span>Số phát sinh: <strong style={{ color: "#00a862" }}>{formatValue(drilldownItem.val).text} đ</strong></span>
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
                      <td style={{ padding: "8px 10px" }}>Doanh thu bán hàng và cung cấp dịch vụ quý 4</td>
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

      {/* 7. Modal: Danh sách báo cáo đã lưu */}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Danh sách B02a - DN đã lưu</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setIsSavedReportsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#64748b" }}>
              Hiện tại chưa có báo cáo B02a - DN nào được lưu trong kỳ này.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
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
