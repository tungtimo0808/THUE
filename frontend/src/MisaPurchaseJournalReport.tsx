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

export interface PurchaseJournalRow {
  postDate: string;
  voucherDate: string;
  voucherNo: string;
  invoiceDate: string;
  invoiceNo: string;
  description: string;
  goodsAmount?: number;
  materialsAmount?: number;
  otherAccNo?: string;
  otherAccAmount?: number;
  payableAmount: number;
}

// Initial sample row matching Screenshot 2 exactly
const INITIAL_ROWS: PurchaseJournalRow[] = [
  {
    postDate: "06/10/2026",
    voucherDate: "06/10/2026",
    voucherNo: "NK00001",
    invoiceDate: "06/10/2026",
    invoiceNo: "NM01",
    description: "Mua hàng của Tran Thi Huong theo hóa đơn số NM01",
    goodsAmount: 25000000,
    materialsAmount: 0,
    otherAccNo: "",
    otherAccAmount: 0,
    payableAmount: 25000000,
  },
];

export interface MisaPurchaseJournalReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaPurchaseJournalReport({
  onBack,
  notify,
}: MisaPurchaseJournalReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [onlyUnpaidImmediately, setOnlyUnpaidImmediately] = useState(false);

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftOnlyUnpaid, setDraftOnlyUnpaid] = useState(false);

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  // Data: Loaded by default matching Screenshot 2
  const [journalData, setJournalData] = useState<PurchaseJournalRow[]>(INITIAL_ROWS);

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftOnlyUnpaid(onlyUnpaidImmediately);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setOnlyUnpaidImmediately(draftOnlyUnpaid);

    if (draftOnlyUnpaid) {
      setJournalData(INITIAL_ROWS);
    } else {
      setJournalData(INITIAL_ROWS);
    }

    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Sổ nhật ký mua hàng.");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftOnlyUnpaid(false);
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

  // Subtitle matching Screenshot 2: "Tháng 10 năm 2026"
  const periodSubtitle = useMemo(() => {
    return "Tháng 10 năm 2026";
  }, []);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return journalData;
    const kw = searchKeyword.toLowerCase();
    return journalData.filter(
      (r) =>
        r.voucherNo.toLowerCase().includes(kw) ||
        r.invoiceNo.toLowerCase().includes(kw) ||
        r.description.toLowerCase().includes(kw)
    );
  }, [journalData, searchKeyword]);

  // Total summary row
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => ({
        goodsAmount: acc.goodsAmount + (r.goodsAmount || 0),
        materialsAmount: acc.materialsAmount + (r.materialsAmount || 0),
        otherAccAmount: acc.otherAccAmount + (r.otherAccAmount || 0),
        payableAmount: acc.payableAmount + (r.payableAmount || 0),
      }),
      {
        goodsAmount: 0,
        materialsAmount: 0,
        otherAccAmount: 0,
        payableAmount: 0,
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
            Sổ nhật ký mua hàng
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
          {/* Search box with purple search icon on the left matching Screenshot 2 */}
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
        {/* Title Header matching Screenshot 2 */}
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
            SỔ NHẬT KÝ MUA HÀNG
          </h1>
          <div
            style={{
              fontSize: 12.5,
              color: "#475569",
              fontStyle: "italic",
            }}
          >
            {periodSubtitle}
          </div>
        </div>

        {/* Data Table with two-tier header matching Screenshot 2 */}
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
                minWidth: 1050,
                borderCollapse: "collapse",
                fontSize: 12.5,
                color: "#1e293b",
              }}
            >
              <thead>
                {/* Header Tier 1 */}
                <tr style={{ background: "#e5efe8", borderBottom: "1px solid #cbd5e1" }}>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "6px 8px",
                      fontWeight: 600,
                      textAlign: "center",
                      borderRight: "1px solid #cbd5e1",
                      width: 90,
                      lineHeight: "1.25",
                    }}
                  >
                    Ngày hạch<br />toán
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "6px 8px",
                      fontWeight: 600,
                      textAlign: "center",
                      borderRight: "1px solid #cbd5e1",
                      width: 90,
                      lineHeight: "1.25",
                    }}
                  >
                    Ngày chứng<br />từ
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      textAlign: "left",
                      borderRight: "1px solid #cbd5e1",
                      width: 105,
                    }}
                  >
                    Số chứng từ
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "6px 8px",
                      fontWeight: 600,
                      textAlign: "center",
                      borderRight: "1px solid #cbd5e1",
                      width: 90,
                      lineHeight: "1.25",
                    }}
                  >
                    Ngày hóa<br />đơn
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      textAlign: "left",
                      borderRight: "1px solid #cbd5e1",
                      width: 95,
                    }}
                  >
                    Số hóa đơn
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      textAlign: "left",
                      borderRight: "1px solid #cbd5e1",
                      width: 250,
                    }}
                  >
                    Diễn giải
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      textAlign: "right",
                      borderRight: "1px solid #cbd5e1",
                      width: 110,
                    }}
                  >
                    Hàng hóa
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "6px 8px",
                      fontWeight: 600,
                      textAlign: "right",
                      borderRight: "1px solid #cbd5e1",
                      width: 100,
                      lineHeight: "1.25",
                    }}
                  >
                    Nguyên vật<br />liệu
                  </th>
                  <th
                    colSpan={2}
                    style={{
                      padding: "6px 10px",
                      fontWeight: 600,
                      textAlign: "center",
                      borderRight: "1px solid #cbd5e1",
                      borderBottom: "1px solid #cbd5e1",
                    }}
                  >
                    Tài khoản khác
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "6px 10px",
                      fontWeight: 600,
                      textAlign: "right",
                      width: 120,
                      lineHeight: "1.25",
                    }}
                  >
                    Phải trả<br />người bán
                  </th>
                </tr>

                {/* Header Tier 2 */}
                <tr style={{ background: "#e5efe8", borderBottom: "1px solid #cbd5e1" }}>
                  <th
                    style={{
                      padding: "6px 8px",
                      fontWeight: 600,
                      textAlign: "center",
                      borderRight: "1px solid #cbd5e1",
                      width: 75,
                    }}
                  >
                    Số hiệu
                  </th>
                  <th
                    style={{
                      padding: "6px 8px",
                      fontWeight: 600,
                      textAlign: "right",
                      borderRight: "1px solid #cbd5e1",
                      width: 95,
                    }}
                  >
                    Số tiền
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
                            textAlign: "center",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {row.postDate}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "center",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {row.voucherDate}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            borderRight: "1px solid #e2e8f0",
                            color: "#0075c0",
                            cursor: "pointer",
                          }}
                          onClick={() => notify?.(`Mở chứng từ ${row.voucherNo}`)}
                        >
                          {row.voucherNo}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "center",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {row.invoiceDate}
                        </td>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #e2e8f0" }}>
                          {row.invoiceNo}
                        </td>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #e2e8f0" }}>
                          {row.description}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {formatMoney(row.goodsAmount)}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {formatMoney(row.materialsAmount)}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "center",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {row.otherAccNo || ""}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {formatMoney(row.otherAccAmount)}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>
                          {formatMoney(row.payableAmount)}
                        </td>
                      </tr>
                    ))}
                    {/* Total row matching Screenshot 2 */}
                    <tr
                      style={{
                        background: "#f8fafc",
                        borderTop: "1px solid #cbd5e1",
                        borderBottom: "1px solid #cbd5e1",
                        fontWeight: 700,
                      }}
                    >
                      <td
                        colSpan={6}
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
                        {formatMoney(totals.goodsAmount)}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        {formatMoney(totals.materialsAmount)}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "center",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        {/* Empty for otherAccNo */}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        {formatMoney(totals.otherAccAmount)}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>
                        {formatMoney(totals.payableAmount)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={11} style={{ padding: "90px 20px", textAlign: "center" }}>
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

          {/* Pagination Footer matching Screenshot 2 */}
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

      {/* 4. Modal / Drawer "Chọn tham số" matching Screenshot 1 */}
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
              width: 520,
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

            {/* Drawer Content matching Screenshot 1 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Kỳ báo cáo */}
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
                  Kỳ báo cáo
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

              {/* Từ ngày & Đến ngày */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
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

              {/* Checkbox matching Screenshot 1 */}
              <div style={{ marginTop: 4 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12.5,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftOnlyUnpaid}
                    onChange={(e) => setDraftOnlyUnpaid(e.target.checked)}
                    style={{ accentColor: "#00a862" }}
                  />
                  <span>Chỉ hiển thị hóa đơn mua hàng chưa thanh toán ngay</span>
                </label>
              </div>
            </div>

            {/* Drawer Footer matching Screenshot 1 */}
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
