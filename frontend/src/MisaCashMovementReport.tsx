import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Search,
  RefreshCw,
  Mail,
  MessageCircle,
  ChevronDown,
  Calendar,
  ChevronRight,
} from "lucide-react";

export interface CashMovementRow {
  code: string;
  name: string;
  isLink?: boolean;
  indent?: number;
  isBold?: boolean;
  prevPeriodVal?: number;
  currPeriodVal?: number;
}

export interface MisaCashMovementReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

const DEFAULT_ROWS: CashMovementRow[] = [
  {
    code: "A",
    name: "Tiền tồn đầu kỳ",
    isBold: true,
    prevPeriodVal: undefined,
    currPeriodVal: undefined,
  },
  {
    code: "B",
    name: "Thực thu",
    isBold: true,
    prevPeriodVal: undefined,
    currPeriodVal: undefined,
  },
  {
    code: "C",
    name: "Thực chi",
    isBold: true,
    prevPeriodVal: undefined,
    currPeriodVal: 20000000,
  },
  {
    code: "",
    name: "<< Khác >>",
    isLink: true,
    indent: 1,
    isBold: false,
    prevPeriodVal: undefined,
    currPeriodVal: 20000000,
  },
  {
    code: "D",
    name: "Tiền tồn cuối kỳ",
    isBold: true,
    prevPeriodVal: undefined,
    currPeriodVal: -20000000,
  },
  {
    code: "1",
    name: "Tiền mặt",
    indent: 1,
    isBold: false,
    prevPeriodVal: undefined,
    currPeriodVal: -10000000,
  },
  {
    code: "2",
    name: "Tiền gửi ngân hàng",
    indent: 1,
    isBold: false,
    prevPeriodVal: undefined,
    currPeriodVal: -10000000,
  },
];

export default function MisaCashMovementReport({
  onBack,
  notify,
}: MisaCashMovementReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật báo cáo Dòng tiền.");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
  };

  const handlePresetChange = (preset: string) => {
    setDraftPeriodPreset(preset);
    if (preset === "Hôm nay") {
      setDraftFromDate("07/10/2026");
      setDraftToDate("07/10/2026");
    } else if (preset === "Tháng này") {
      setDraftFromDate("01/10/2026");
      setDraftToDate("31/10/2026");
    } else if (preset === "Tháng trước") {
      setDraftFromDate("01/09/2026");
      setDraftToDate("30/09/2026");
    } else if (preset === "Quý 4") {
      setDraftFromDate("01/10/2026");
      setDraftToDate("31/12/2026");
    } else if (preset === "Năm nay") {
      setDraftFromDate("01/01/2026");
      setDraftToDate("31/12/2026");
    }
  };

  // Subtitle period text matching Screenshot 2
  const periodSubtitle = useMemo(() => {
    if (fromDate.startsWith("01/10/2026") && toDate.startsWith("31/10/2026")) {
      return "Tháng 10 năm 2026";
    }
    return `Từ ngày ${fromDate} đến ngày ${toDate}`;
  }, [fromDate, toDate]);

  // Format currency with parentheses for negative numbers e.g. (20.000.000)
  const formatMoney = (val?: number) => {
    if (val === undefined || val === null) return "";
    if (val < 0) {
      return `(${Math.abs(val).toLocaleString("vi-VN")})`;
    }
    return val.toLocaleString("vi-VN");
  };

  // Filter rows by keyword
  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return DEFAULT_ROWS;
    const kw = searchKeyword.toLowerCase();
    return DEFAULT_ROWS.filter(
      (r) =>
        r.code.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw)
    );
  }, [searchKeyword]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#ffffff",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* 1. Header Bar matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "none",
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
              fontSize: 14.5,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Dòng tiền
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            }}
            onClick={() => notify?.("Xem danh sách báo cáo đã lưu...")}
          >
            Danh sách báo cáo đã lưu
          </button>

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
            }}
            onClick={() => notify?.("Đã lưu mẫu báo cáo thành công.")}
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

      {/* 2. Action Toolbar matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          gap: 10,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              color: "#94a3b8",
            }}
          />
          <input
            type="text"
            placeholder="Nhập từ khóa tìm kiếm"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{
              height: 30,
              width: 220,
              padding: "0 10px 0 30px",
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
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: 4,
          }}
          title="Nạp lại"
          onClick={() => notify?.("Đã làm mới dữ liệu Dòng tiền.")}
        >
          <RefreshCw size={15} />
        </button>

        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: 4,
          }}
          title="Gửi email"
          onClick={() => notify?.("Mở hộp thoại gửi email...")}
        >
          <Mail size={15} />
        </button>

        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: 4,
          }}
          title="Phản hồi"
          onClick={() => notify?.("Mở phản hồi...")}
        >
          <MessageCircle size={15} />
        </button>

        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: 4,
          }}
          title="In"
          onClick={() => window.print()}
        >
          <Printer size={15} />
        </button>

        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            padding: "3px 8px",
            color: "#334155",
            cursor: "pointer",
          }}
          title="Xuất khẩu Excel"
          onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
        >
          <span style={{ fontSize: 12, fontWeight: 700 }}>XLS</span>
          <ChevronDown size={13} color="#64748b" />
        </button>

        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: 4,
          }}
          title="Tùy chỉnh"
          onClick={() => notify?.("Mở cài đặt...")}
        >
          <Settings size={15} />
        </button>
      </div>

      {/* 3. Centered Report Title matching Screenshot 2 */}
      <div style={{ textAlign: "center", padding: "16px 20px 10px 20px" }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "0.2px",
          }}
        >
          DÒNG TIỀN
        </h3>
        <div
          style={{
            fontSize: 12.5,
            fontStyle: "italic",
            color: "#475569",
            marginTop: 4,
          }}
        >
          {periodSubtitle}
        </div>
      </div>

      {/* 4. Table Area matching Screenshot 2 */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0 20px 16px 20px",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflowX: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            <thead>
              <tr style={{ background: "#e2f0d9" }}>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "14%",
                  }}
                >
                  Mã mục thu/chi
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "38%",
                  }}
                >
                  Tên mục thu/chi
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "24%",
                  }}
                >
                  Kỳ trước
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "24%",
                  }}
                >
                  Kỳ này
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const isNegative =
                  row.currPeriodVal !== undefined && row.currPeriodVal < 0;
                return (
                  <tr
                    key={idx}
                    style={{
                      background: "#ffffff",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                  >
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        textAlign: "left",
                        fontWeight: row.isBold ? 700 : 400,
                        color: "#1e293b",
                      }}
                    >
                      {row.code}
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        paddingLeft: row.indent ? `${row.indent * 24 + 12}px` : "12px",
                        fontWeight: row.isBold ? 700 : 400,
                        color: row.isLink ? "#0284c7" : "#1e293b",
                        cursor: row.isLink ? "pointer" : "default",
                      }}
                      onClick={() => {
                        if (row.isLink) {
                          notify?.("Xem chi tiết mục: << Khác >>");
                        }
                      }}
                    >
                      {row.name}
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        textAlign: "right",
                        color: "#1e293b",
                      }}
                    >
                      {formatMoney(row.prevPeriodVal)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        textAlign: "right",
                        fontWeight: row.isBold ? 700 : 400,
                        color: isNegative ? "#dc2626" : "#1e293b",
                      }}
                    >
                      {formatMoney(row.currPeriodVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Bar matching Screenshot 2 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 4px",
            fontSize: 12.5,
            color: "#475569",
          }}
        >
          <div>Tổng số: {filteredRows.length}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Số dòng/trang</span>
              <select
                defaultValue="20"
                style={{
                  height: 26,
                  padding: "0 6px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 3,
                  fontSize: 12,
                  outline: "none",
                  background: "#ffffff",
                }}
              >
                <option value="10">10</option>
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
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                |&lt;
              </button>
              <button
                type="button"
                disabled
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                &lt;
              </button>
              <span
                style={{
                  padding: "2px 8px",
                  background: "#00a862",
                  color: "#ffffff",
                  borderRadius: 3,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                1
              </span>
              <button
                type="button"
                disabled
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                &gt;
              </button>
              <button
                type="button"
                disabled
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                &gt;|
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Parameter Drawer matching Screenshot 1 */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(0, 0, 0, 0.45)",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: 520,
              height: "100%",
              background: "#ffffff",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <HelpCircle
                  size={18}
                  color="#64748b"
                  style={{ cursor: "pointer" }}
                />
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Kỳ báo cáo - Từ ngày - Đến ngày matching Screenshot 1 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 12.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Kỳ báo cáo
                  </label>
                  <select
                    value={draftPeriodPreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #00a862",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                      outline: "none",
                    }}
                  >
                    <option value="Hôm nay">Hôm nay</option>
                    <option value="Tháng này">Tháng này</option>
                    <option value="Tháng trước">Tháng trước</option>
                    <option value="Quý 4">Quý 4</option>
                    <option value="Năm nay">Năm nay</option>
                    <option value="Tùy chọn">Tùy chọn</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 12.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftFromDate}
                      onChange={(e) => setDraftFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#94a3b8",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 12.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftToDate}
                      onChange={(e) => setDraftToDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#94a3b8",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer matching Screenshot 1 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={handleResetParams}
                style={{
                  height: 32,
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Xóa điều kiện
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    height: 32,
                    padding: "0 18px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#334155",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyParams}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
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
