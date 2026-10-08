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
  MinusSquare,
  PlusSquare,
  ChevronRight,
} from "lucide-react";

export interface DailyBalanceRow {
  id: string;
  name: string;
  level: number;
  isBranch?: boolean;
  isAccount?: boolean;
  isSubAccount?: boolean;
  isBankDetail?: boolean;
  parentId?: string;
  value?: number;
}

export interface MisaDailyCashBalanceReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

const DEFAULT_ITEMS: DailyBalanceRow[] = [
  {
    id: "branch_tung",
    name: "Chi nhánh hạch toán: Tung",
    level: 0,
    isBranch: true,
  },
  {
    id: "cash_111",
    name: "Tiền mặt",
    level: 1,
    parentId: "branch_tung",
    isAccount: true,
    value: -10000000,
  },
  {
    id: "bank_demand_112",
    name: "Tiền gửi không kỳ hạn",
    level: 1,
    parentId: "branch_tung",
    isAccount: true,
    value: -10000000,
  },
  {
    id: "bank_bidv_1121",
    name: "TGNH BIDV",
    level: 2,
    parentId: "bank_demand_112",
    isSubAccount: true,
    value: -10000000,
  },
  {
    id: "bidv_acc_026",
    name: "<0261198991 - Ngân hàng TMCP Đầu tư và Phát triển Việt Nam>",
    level: 3,
    parentId: "bank_bidv_1121",
    isBankDetail: true,
    value: -10000000,
  },
];

export default function MisaDailyCashBalanceReport({
  onBack,
  notify,
}: MisaDailyCashBalanceReportProps) {
  // Drawer parameters matching Screenshot 3
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [asOfDate, setAsOfDate] = useState("07/10/2026");
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareDays, setCompareDays] = useState("1");

  // Drawer draft state
  const [draftAsOfDate, setDraftAsOfDate] = useState("07/10/2026");
  const [draftCompareEnabled, setDraftCompareEnabled] = useState(false);
  const [draftCompareDays, setDraftCompareDays] = useState("1");

  // Tree collapsed state
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [allCollapsed, setAllCollapsed] = useState(false);

  const toggleNode = (id: string) => {
    setCollapsedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleAll = () => {
    if (allCollapsed) {
      setCollapsedNodes({});
      setAllCollapsed(false);
    } else {
      const newCollapsed: Record<string, boolean> = {};
      DEFAULT_ITEMS.forEach((item) => {
        if (item.isBranch || item.isAccount || item.isSubAccount) {
          newCollapsed[item.id] = true;
        }
      });
      setCollapsedNodes(newCollapsed);
      setAllCollapsed(true);
    }
  };

  const handleOpenDrawer = () => {
    setDraftAsOfDate(asOfDate);
    setDraftCompareEnabled(compareEnabled);
    setDraftCompareDays(compareDays);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setAsOfDate(draftAsOfDate);
    setCompareEnabled(draftCompareEnabled);
    setCompareDays(draftCompareDays);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Bảng kê số dư tiền theo ngày.");
  };

  const handleResetParams = () => {
    setDraftAsOfDate("07/10/2026");
    setDraftCompareEnabled(false);
    setDraftCompareDays("1");
  };

  // Format currency with parentheses for negative numbers e.g. (10.000.000)
  const formatMoney = (val?: number) => {
    if (val === undefined || val === null) return "";
    if (val < 0) {
      return `(${Math.abs(val).toLocaleString("vi-VN")})`;
    }
    return val.toLocaleString("vi-VN");
  };

  // Filter visible rows according to tree collapsed state
  const visibleRows = useMemo(() => {
    const isHidden = (row: DailyBalanceRow): boolean => {
      let pId = row.parentId;
      while (pId) {
        if (collapsedNodes[pId]) return true;
        const parent = DEFAULT_ITEMS.find((it) => it.id === pId);
        pId = parent?.parentId;
      }
      return false;
    };

    return DEFAULT_ITEMS.filter((row) => !isHidden(row));
  }, [collapsedNodes]);

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
      {/* 1. Header Bar matching Screenshot 4 */}
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
            Bảng kê số dư tiền theo ngày
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

      {/* 2. Action Toolbar matching Screenshot 4 */}
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
        {/* Left Collapse/Expand All Button */}
        <div>
          <button
            type="button"
            onClick={handleToggleAll}
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              color: "#64748b",
              cursor: "pointer",
            }}
            title={allCollapsed ? "Mở rộng tất cả" : "Thu gọn tất cả"}
          >
            {allCollapsed ? <PlusSquare size={16} /> : <MinusSquare size={16} />}
          </button>
        </div>

        {/* Right Tools */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            onClick={() => notify?.("Đã làm mới Bảng kê số dư tiền theo ngày.")}
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
      </div>

      {/* 3. Centered Report Title matching Screenshot 4 */}
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
          BẢNG KÊ SỐ DƯ TIỀN THEO NGÀY
        </h3>
        <div
          style={{
            fontSize: 12.5,
            fontStyle: "italic",
            color: "#475569",
            marginTop: 4,
          }}
        >
          Đến ngày: {asOfDate}
        </div>
      </div>

      {/* 4. Table Area matching Screenshot 4 */}
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
                    width: "70%",
                  }}
                >
                  Chỉ tiêu
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "4px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "30%",
                  }}
                >
                  <div style={{ fontSize: 11.5, color: "#475569" }}>Ngày</div>
                  <div>{asOfDate}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const isBranch = row.isBranch;
                const hasChildren = DEFAULT_ITEMS.some((i) => i.parentId === row.id);
                const isCollapsed = collapsedNodes[row.id];
                const isNegative = row.value !== undefined && row.value < 0;

                return (
                  <tr
                    key={row.id}
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
                        paddingLeft: `${row.level * 22 + 12}px`,
                        fontWeight: isBranch ? 700 : row.level < 3 ? 600 : 400,
                        color: row.isBankDetail ? "#334155" : "#1e293b",
                        fontStyle: row.isBankDetail ? "italic" : "normal",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {hasChildren && (
                          <span
                            onClick={() => toggleNode(row.id)}
                            style={{
                              cursor: "pointer",
                              fontSize: 10,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 14,
                              color: "#475569",
                            }}
                          >
                            {isCollapsed ? "▸" : "▾"}
                          </span>
                        )}
                        <span>{row.name}</span>
                      </div>
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        textAlign: "right",
                        fontWeight: row.level < 3 ? 600 : 400,
                        color: isNegative ? "#dc2626" : "#1e293b",
                      }}
                    >
                      {formatMoney(row.value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Bar matching Screenshot 4 */}
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
          <div>Tổng số: 4</div>
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

      {/* 5. Parameter Drawer matching Screenshot 3 */}
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
              {/* Đến ngày matching Screenshot 3 */}
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
                <div style={{ position: "relative", width: 220 }}>
                  <input
                    type="text"
                    value={draftAsOfDate}
                    onChange={(e) => setDraftAsOfDate(e.target.value)}
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

              {/* So sánh với [  ] ngày trước matching Screenshot 3 */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftCompareEnabled}
                    onChange={(e) => setDraftCompareEnabled(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 15, height: 15 }}
                  />
                  <span>So sánh với</span>
                </label>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <select
                    disabled={!draftCompareEnabled}
                    value={draftCompareDays}
                    onChange={(e) => setDraftCompareDays(e.target.value)}
                    style={{
                      height: 30,
                      width: 90,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: draftCompareEnabled ? "#ffffff" : "#f1f5f9",
                      outline: "none",
                    }}
                  >
                    <option value="1">1</option>
                    <option value="7">7</option>
                    <option value="30">30</option>
                  </select>
                  <span style={{ fontSize: 13, color: "#475569" }}>
                    ngày trước
                  </span>
                </div>
              </div>
            </div>

            {/* Footer matching Screenshot 3 */}
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
