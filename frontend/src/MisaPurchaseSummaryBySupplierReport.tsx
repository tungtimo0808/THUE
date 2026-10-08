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
  ChevronDown,
  Filter,
  Columns,
  Calendar,
  MessageCircle,
} from "lucide-react";

export interface SupplierPurchaseSummaryRow {
  supplierCode: string;
  supplierName: string;
  purchaseAmount: number;
  discountAmount?: number;
  returnAmount?: number;
  priceReductionAmount?: number;
  totalPurchaseAmount: number;
}

export interface SupplierOption {
  code: string;
  name: string;
}

const DEFAULT_SUPPLIERS: SupplierOption[] = [
  {
    code: "NCC00001",
    name: "Tran Thi Huong",
  },
];

// Initial default row matching Screenshot 4 exactly
const INITIAL_ROWS: SupplierPurchaseSummaryRow[] = [
  {
    supplierCode: "NCC00001",
    supplierName: "Tran Thi Huong",
    purchaseAmount: 25000000,
    discountAmount: 0,
    returnAmount: 0,
    priceReductionAmount: 0,
    totalPurchaseAmount: 25000000,
  },
];

export interface MisaPurchaseSummaryBySupplierReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaPurchaseSummaryBySupplierReport({
  onBack,
  notify,
}: MisaPurchaseSummaryBySupplierReportProps) {
  // Drawer Parameters State matching Screenshot 3
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [supplierGroup, setSupplierGroup] = useState("");
  const [selectedSupplierName, setSelectedSupplierName] = useState("Tran Thi Huong");

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftSupplierGroup, setDraftSupplierGroup] = useState("");
  const [draftSupplierCodes, setDraftSupplierCodes] = useState<string[]>(["NCC00001"]);
  const [supplierSearchText, setSupplierSearchText] = useState("");

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  // Data: Loaded by default matching Screenshot 4
  const [summaryData, setSummaryData] = useState<SupplierPurchaseSummaryRow[]>(INITIAL_ROWS);

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftSupplierGroup(supplierGroup);
    setDraftSupplierCodes(["NCC00001"]);
    setSupplierSearchText("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSupplierGroup(draftSupplierGroup);

    if (draftSupplierCodes.length > 0) {
      const sup = DEFAULT_SUPPLIERS.find((s) => draftSupplierCodes.includes(s.code));
      if (sup) {
        setSelectedSupplierName(sup.name);
      }
      const newRows: SupplierPurchaseSummaryRow[] = draftSupplierCodes.map((code) => {
        const sObj = DEFAULT_SUPPLIERS.find((s) => s.code === code) || { code, name: code };
        return {
          supplierCode: sObj.code,
          supplierName: sObj.name,
          purchaseAmount: 25000000,
          discountAmount: 0,
          returnAmount: 0,
          priceReductionAmount: 0,
          totalPurchaseAmount: 25000000,
        };
      });
      setSummaryData(newRows);
    } else {
      setSelectedSupplierName("");
      setSummaryData([]);
    }
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Tổng hợp mua hàng theo nhà cung cấp.");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftSupplierGroup("");
    setDraftSupplierCodes([]);
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

  // Subtitle matching Screenshot 4: "Nhà cung cấp: Tran Thi Huong, Tháng 10 năm 2026"
  const periodSubtitle = useMemo(() => {
    if (!selectedSupplierName) return "Tháng 10 năm 2026";
    return `Nhà cung cấp: ${selectedSupplierName}, Tháng 10 năm 2026`;
  }, [selectedSupplierName]);

  // Filter suppliers in drawer
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchText.trim()) return DEFAULT_SUPPLIERS;
    const kw = supplierSearchText.toLowerCase();
    return DEFAULT_SUPPLIERS.filter(
      (s) => s.code.toLowerCase().includes(kw) || s.name.toLowerCase().includes(kw)
    );
  }, [supplierSearchText]);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return summaryData;
    const kw = searchKeyword.toLowerCase();
    return summaryData.filter(
      (r) =>
        r.supplierCode.toLowerCase().includes(kw) ||
        r.supplierName.toLowerCase().includes(kw)
    );
  }, [summaryData, searchKeyword]);

  // Total summary row
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => ({
        purchaseAmount: acc.purchaseAmount + (r.purchaseAmount || 0),
        discountAmount: acc.discountAmount + (r.discountAmount || 0),
        returnAmount: acc.returnAmount + (r.returnAmount || 0),
        priceReductionAmount: acc.priceReductionAmount + (r.priceReductionAmount || 0),
        totalPurchaseAmount: acc.totalPurchaseAmount + (r.totalPurchaseAmount || 0),
      }),
      {
        purchaseAmount: 0,
        discountAmount: 0,
        returnAmount: 0,
        priceReductionAmount: 0,
        totalPurchaseAmount: 0,
      }
    );
  }, [filteredRows]);

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null || val === 0) return "";
    return val.toLocaleString("vi-VN");
  };

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
            Tổng hợp mua hàng theo nhà cung cấp
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
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              padding: "5px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#64748b",
            }}
            title="Lọc dữ liệu"
          >
            <Filter size={14} />
          </button>
          <button
            type="button"
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              padding: "5px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#64748b",
            }}
            title="Tùy chỉnh cột hiển thị"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Search box with purple search icon on the left matching Screenshot 4 */}
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
                left: 9,
                color: "#8b5cf6",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: 220,
                height: 28,
                padding: "0 10px 0 30px",
                fontSize: 12,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
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
              display: "flex",
              alignItems: "center",
            }}
            title="Nạp lại dữ liệu"
            onClick={() => notify?.("Đã nạp lại dữ liệu báo cáo.")}
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
              display: "flex",
              alignItems: "center",
            }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi email báo cáo...")}
          >
            <Mail size={15} />
          </button>

          {/* MISA Online Chat / Support button */}
          <button
            type="button"
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#0284c7",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            title="Hỗ trợ trực tuyến MISA"
            onClick={() => notify?.("Mở hỗ trợ trực tuyến.")}
          >
            <MessageCircle size={13} fill="#ffffff" />
          </button>

          {/* Print button with dropdown */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
              color: "#64748b",
              padding: "2px 4px",
            }}
            title="In báo cáo"
            onClick={() => window.print()}
          >
            <Printer size={15} />
            <ChevronDown size={12} />
          </div>

          {/* Export Excel button with dropdown */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
              color: "#64748b",
              padding: "2px 4px",
            }}
            title="Xuất khẩu ra Excel"
            onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
          >
            <Download size={15} />
            <ChevronDown size={12} />
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
            title="Tùy chọn khác"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 3. Main Report Area */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Title Header matching Screenshot 4 */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1
            style={{
              margin: "0 0 6px 0",
              fontSize: 15.5,
              fontWeight: 700,
              color: "#0f172a",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            TỔNG HỢP MUA HÀNG THEO NHÀ CUNG CẤP
          </h1>
          {periodSubtitle && (
            <div
              style={{
                fontSize: 12.5,
                color: "#475569",
                fontStyle: "italic",
              }}
            >
              {periodSubtitle}
            </div>
          )}
        </div>

        {/* Data Table matching Screenshot 4 */}
        <div
          style={{
            width: "100%",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 900,
                borderCollapse: "collapse",
                fontSize: 12.5,
                color: "#1e293b",
              }}
            >
              <thead>
                <tr style={{ background: "#e5efe8", borderBottom: "1px solid #cbd5e1" }}>
                  <th
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      textAlign: "left",
                      borderRight: "1px solid #cbd5e1",
                      width: 140,
                    }}
                  >
                    Mã nhà cung cấp
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      textAlign: "left",
                      borderRight: "1px solid #cbd5e1",
                      width: 200,
                    }}
                  >
                    Tên nhà cung cấp
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      textAlign: "right",
                      borderRight: "1px solid #cbd5e1",
                      width: 130,
                    }}
                  >
                    Giá trị mua
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      textAlign: "right",
                      borderRight: "1px solid #cbd5e1",
                      width: 120,
                    }}
                  >
                    Chiết khấu
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      textAlign: "right",
                      borderRight: "1px solid #cbd5e1",
                      width: 120,
                    }}
                  >
                    Giá trị trả lại
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      textAlign: "right",
                      borderRight: "1px solid #cbd5e1",
                      width: 120,
                    }}
                  >
                    Giá trị giảm giá
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      textAlign: "right",
                      width: 140,
                    }}
                  >
                    Tổng giá trị mua
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  <>
                    {filteredRows.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          background: idx % 2 === 1 ? "#fafafa" : "#ffffff",
                        }}
                      >
                        <td
                          style={{
                            padding: "8px 10px",
                            borderRight: "1px solid #e2e8f0",
                            color: "#0075c0",
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            notify?.(`Mở chi tiết nhà cung cấp ${row.supplierCode}`)
                          }
                        >
                          {row.supplierCode}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            borderRight: "1px solid #e2e8f0",
                            color: "#0075c0",
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            notify?.(`Mở chi tiết nhà cung cấp ${row.supplierName}`)
                          }
                        >
                          {row.supplierName}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {formatMoney(row.purchaseAmount)}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {formatMoney(row.discountAmount)}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {formatMoney(row.returnAmount)}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {formatMoney(row.priceReductionAmount)}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>
                          {formatMoney(row.totalPurchaseAmount)}
                        </td>
                      </tr>
                    ))}
                    {/* Summary row matching Screenshot 4 */}
                    <tr
                      style={{
                        background: "#f8fafc",
                        borderTop: "1px solid #cbd5e1",
                        borderBottom: "1px solid #cbd5e1",
                        fontWeight: 700,
                      }}
                    >
                      <td
                        colSpan={2}
                        style={{
                          padding: "8px 10px",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        Tổng cộng
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        {formatMoney(totals.purchaseAmount)}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        {formatMoney(totals.discountAmount)}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        {formatMoney(totals.returnAmount)}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        {formatMoney(totals.priceReductionAmount)}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>
                        {formatMoney(totals.totalPurchaseAmount)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: "90px 20px", textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 12,
                        }}
                      >
                        <svg
                          width="80"
                          height="80"
                          viewBox="0 0 96 96"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect
                            x="24"
                            y="24"
                            width="48"
                            height="48"
                            rx="8"
                            fill="#f8fafc"
                            stroke="#cbd5e1"
                            strokeWidth="2"
                          />
                          <path
                            d="M36 44H60M36 52H52"
                            stroke="#94a3b8"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <circle
                            cx="58"
                            cy="58"
                            r="14"
                            fill="#ffffff"
                            stroke="#00a862"
                            strokeWidth="2.5"
                          />
                          <path
                            d="M68 68L78 78"
                            stroke="#00a862"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                          Không có dữ liệu
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer matching Screenshot 4 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 16px",
              background: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              fontSize: 12,
              color: "#64748b",
            }}
          >
            <span>Tổng số: {filteredRows.length}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span>Số dòng/trang</span>
              <select
                defaultValue="20"
                style={{
                  height: 24,
                  padding: "0 6px",
                  borderRadius: 3,
                  border: "1px solid #cbd5e1",
                  fontSize: 12,
                  outline: "none",
                  background: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="50">50</option>
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>|&lt;</span>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>&lt;</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    borderRadius: 3,
                    background: "#e8f5ec",
                    color: "#00a862",
                    fontWeight: 700,
                  }}
                >
                  1
                </span>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;</span>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;|</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Modal / Drawer "Chọn tham số" matching Screenshot 3 */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              width: 840,
              maxWidth: "92vw",
              height: "100%",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
              animation: "slideInRight 0.25s ease-out",
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                  title="Đóng"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Row 1: Kỳ báo cáo, Từ ngày, Đến ngày */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                  alignItems: "flex-end",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    Kỳ báo cáo <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftPeriodPreset}
                      onChange={(e) => handlePresetChange(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        background: "#ffffff",
                        outline: "none",
                        appearance: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Hôm nay">Hôm nay</option>
                      <option value="Tháng này">Tháng này</option>
                      <option value="Tháng trước">Tháng trước</option>
                      <option value="Quý 4">Quý 4</option>
                      <option value="Năm nay">Năm nay</option>
                    </select>
                    <ChevronDown
                      size={15}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
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
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
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
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Nhóm nhà cung cấp matching Screenshot 3 */}
              <div style={{ width: "32%" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 5,
                  }}
                >
                  Nhóm nhà cung cấp
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={draftSupplierGroup}
                    onChange={(e) => setDraftSupplierGroup(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 28px 0 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      background: "#ffffff",
                      outline: "none",
                      appearance: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">-- Tất cả nhóm NCC --</option>
                    <option value="NCC_TN">Nhà cung cấp trong nước</option>
                    <option value="NCC_NN">Nhà cung cấp nước ngoài</option>
                  </select>
                  <ChevronDown
                    size={15}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: 9,
                      color: "#64748b",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>

              {/* Table: Nhà cung cấp matching Screenshot 3 (2 columns only: Mã NCC, Tên NCC) */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        filteredSuppliers.length > 0 &&
                        filteredSuppliers.every((s) => draftSupplierCodes.includes(s.code))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setDraftSupplierCodes(filteredSuppliers.map((s) => s.code));
                        } else {
                          setDraftSupplierCodes([]);
                        }
                      }}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Chọn tất cả</span>
                  </label>

                  <div style={{ position: "relative" }}>
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        left: 8,
                        top: 6.5,
                        color: "#8b5cf6",
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={supplierSearchText}
                      onChange={(e) => setSupplierSearchText(e.target.value)}
                      style={{
                        width: 200,
                        height: 26,
                        padding: "0 8px 0 26px",
                        fontSize: 11.5,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#e5efe8", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ width: 36, padding: "7px 10px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={
                              filteredSuppliers.length > 0 &&
                              filteredSuppliers.every((s) => draftSupplierCodes.includes(s.code))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDraftSupplierCodes(filteredSuppliers.map((s) => s.code));
                              } else {
                                setDraftSupplierCodes([]);
                              }
                            }}
                            style={{ accentColor: "#00a862" }}
                          />
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                            borderRight: "1px solid #cbd5e1",
                            width: 140,
                          }}
                        >
                          Mã NCC
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                          }}
                        >
                          Tên NCC
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSuppliers.map((sup) => {
                        const isSelected = draftSupplierCodes.includes(sup.code);
                        return (
                          <tr
                            key={sup.code}
                            onClick={() => {
                              setDraftSupplierCodes((prev) =>
                                prev.includes(sup.code)
                                  ? prev.filter((c) => c !== sup.code)
                                  : [...prev, sup.code]
                              );
                            }}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              cursor: "pointer",
                              background: isSelected ? "#f0fdf4" : "#ffffff",
                            }}
                          >
                            <td style={{ textAlign: "center", padding: "6px 10px" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ accentColor: "#00a862" }}
                              />
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                borderRight: "1px solid #f1f5f9",
                              }}
                            >
                              {sup.code}
                            </td>
                            <td style={{ padding: "6px 10px" }}>{sup.name}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 12px",
                      background: "#f8fafc",
                      borderTop: "1px solid #e2e8f0",
                      fontSize: 11.5,
                      color: "#64748b",
                    }}
                  >
                    <span>Tổng số: {filteredSuppliers.length}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span>Số dòng/trang</span>
                      <select
                        defaultValue="20"
                        style={{
                          height: 22,
                          padding: "0 4px",
                          borderRadius: 3,
                          border: "1px solid #cbd5e1",
                          fontSize: 11.5,
                          outline: "none",
                          background: "#ffffff",
                        }}
                      >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                      </select>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ cursor: "pointer", color: "#94a3b8" }}>|&lt;</span>
                        <span style={{ cursor: "pointer", color: "#94a3b8" }}>&lt;</span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 18,
                            height: 18,
                            borderRadius: 2,
                            background: "#e8f5ec",
                            color: "#00a862",
                            fontWeight: 700,
                          }}
                        >
                          1
                        </span>
                        <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;</span>
                        <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;|</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer matching Screenshot 3 */}
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
