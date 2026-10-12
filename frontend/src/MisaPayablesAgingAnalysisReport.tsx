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
  Calendar,
  PenTool,
  MessageCircle,
  UserCheck,
  Filter,
  Columns,
} from "lucide-react";

export interface MisaPayablesAgingAnalysisReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
  mode?: "summary" | "detail";
}

export default function MisaPayablesAgingAnalysisReport({
  onBack,
  notify,
  mode = "summary",
}: MisaPayablesAgingAnalysisReportProps) {
  const isSummary = mode === "summary";

  // Drawer state matching Screenshot 3
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [toDate, setToDate] = useState(isSummary ? "07/10/2026" : "08/10/2026");
  const [selectedAccount, setSelectedAccount] = useState("331");
  const [supplierGroup, setSupplierGroup] = useState("");
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(["NCC00001"]);

  // Draft state inside drawer
  const [draftToDate, setDraftToDate] = useState(isSummary ? "07/10/2026" : "08/10/2026");
  const [draftAccount, setDraftAccount] = useState("331");
  const [draftSupplierGroup, setDraftSupplierGroup] = useState("");
  const [draftSuppliers, setDraftSuppliers] = useState<string[]>(["NCC00001"]);
  const [supplierSearchText, setSupplierSearchText] = useState("");

  // Toolbar state for detail mode
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isTreeExpanded, setIsTreeExpanded] = useState(true);

  const supplierList = [
    {
      code: "NCC00001",
      name: "Tran Thi Huong",
      address: "",
      taxCode: "030178006908",
    },
  ];

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchText.trim()) return supplierList;
    const kw = supplierSearchText.toLowerCase();
    return supplierList.filter(
      (s) =>
        s.code.toLowerCase().includes(kw) ||
        s.name.toLowerCase().includes(kw) ||
        s.taxCode.toLowerCase().includes(kw)
    );
  }, [supplierSearchText]);

  const handleOpenDrawer = () => {
    setDraftToDate(toDate);
    setDraftAccount(selectedAccount);
    setDraftSupplierGroup(supplierGroup);
    setDraftSuppliers(selectedSuppliers);
    setSupplierSearchText("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setToDate(draftToDate);
    setSelectedAccount(draftAccount);
    setSupplierGroup(draftSupplierGroup);
    setSelectedSuppliers(draftSuppliers);
    setIsParamDrawerOpen(false);
    notify?.(
      isSummary
        ? "Đã cập nhật Phân tích công nợ phải trả theo tuổi nợ."
        : "Đã cập nhật Chi tiết công nợ phải trả theo tuổi nợ."
    );
  };

  const handleResetParams = () => {
    setDraftToDate(isSummary ? "07/10/2026" : "08/10/2026");
    setDraftAccount("331");
    setDraftSupplierGroup("");
    setDraftSuppliers([]);
  };

  const toggleSelectSupplier = (code: string) => {
    setDraftSuppliers((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleSelectAllSuppliers = () => {
    if (draftSuppliers.length === supplierList.length) {
      setDraftSuppliers([]);
    } else {
      setDraftSuppliers(supplierList.map((s) => s.code));
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: isSummary ? "#e2e8f0" : "#ffffff",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* 1. Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "#ffffff",
          borderBottom: "1px solid #cbd5e1",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#475569",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              borderRadius: 4,
            }}
            title="Quay lại"
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
            {isSummary
              ? "Phân tích công nợ phải trả theo tuổi nợ"
              : "Chi tiết công nợ phải trả theo tuổi nợ"}
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={{
              height: 30,
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
              height: 30,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => notify?.("Đã lưu báo cáo.")}
          >
            Lưu báo cáo
          </button>

          <button
            type="button"
            style={{
              height: 30,
              padding: "0 16px",
              background: "#00a862",
              border: "none",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
            }}
            onClick={handleOpenDrawer}
          >
            Chọn tham số
          </button>
        </div>
      </div>

      {/* 2. Secondary Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 16px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isSummary ? (
            <>
              <button
                type="button"
                onClick={() => notify?.("Mở thiết lập người ký...")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  color: "#334155",
                  padding: "4px 6px",
                  borderRadius: 4,
                }}
              >
                <PenTool size={13} color="#64748b" />
                <span>Thiết lập người ký</span>
              </button>

              <button
                type="button"
                onClick={() => notify?.("Mở chức năng Đối chiếu công nợ với NCC...")}
                style={{
                  background: "none",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#6366f1",
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  marginLeft: 4,
                  padding: "4px 8px",
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#e0e7ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#4f46e5",
                  }}
                >
                  <UserCheck size={11} />
                </div>
                <span>Đối chiếu công nợ với NCC</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsTreeExpanded(!isTreeExpanded)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  width: 30,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748b",
                }}
                title={isTreeExpanded ? "Thu gọn" : "Mở rộng"}
              >
                <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>⊟</span>
              </button>

              <button
                type="button"
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  width: 30,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748b",
                }}
                title="Bộ lọc"
              >
                <Filter size={13} />
              </button>

              <button
                type="button"
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  width: 30,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748b",
                }}
                title="Tùy chỉnh cột"
              >
                <Columns size={13} />
              </button>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isSummary && (
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 8,
                  top: 6,
                  color: "#8b5cf6",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Search size={13} />
              </span>
              <input
                type="text"
                placeholder="Nhập từ khóa tìm kiếm"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={{
                  width: 220,
                  height: 28,
                  padding: "0 10px 0 28px",
                  fontSize: 12,
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  outline: "none",
                }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => notify?.("Đã nạp lại dữ liệu.")}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Nạp lại"
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            onClick={() => notify?.("Gửi email báo cáo...")}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Gửi email"
          >
            <Mail size={15} />
          </button>

          {/* Blue chat bubble */}
          <button
            type="button"
            onClick={() => notify?.("Mở trao đổi...")}
            style={{
              background: "none",
              border: "none",
              color: "#0284c7",
              cursor: "pointer",
              padding: 4,
            }}
            title="Trao đổi"
          >
            <MessageCircle size={15} />
          </button>

          {/* Print */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "4px 2px 4px 4px",
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
              title="In"
            >
              <Printer size={15} />
              {!isSummary && <ChevronDown size={11} />}
            </button>
          </div>

          {/* Export */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => notify?.("Đang xuất khẩu báo cáo...")}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "4px 2px 4px 4px",
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
              title="Xuất khẩu"
            >
              <Download size={15} />
              {!isSummary && <ChevronDown size={11} />}
            </button>
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
            title="Thiết lập"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 3. Main Content: Summary (A4 Canvas) or Detail (Interactive Table) */}
      {isSummary ? (
        /* A4 Sheet Presentation Canvas matching Request 14, Screenshot 4 */
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "1100px",
              minHeight: "750px",
              background: "#ffffff",
              boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
              padding: "36px 44px",
              boxSizing: "border-box",
              color: "#0f172a",
              fontFamily: "'Times New Roman', Times, serif, system-ui",
              fontSize: 11,
            }}
          >
            {/* Company top-left */}
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Tung</div>

            {/* Sheet Title */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <h1
                style={{
                  margin: "0 0 6px 0",
                  fontSize: 16.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                PHÂN TÍCH CÔNG NỢ PHẢI TRẢ THEO TUỔI NỢ
              </h1>
              <div style={{ fontStyle: "italic", fontSize: 12 }}>
                Tài khoản: {selectedAccount}; Đến ngày {toDate}
              </div>
            </div>

            {/* Table */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1px solid #334155",
                fontSize: 10,
              }}
            >
              <thead>
                <tr style={{ background: "#ffffff", textAlign: "center", fontWeight: 700 }}>
                  <th rowSpan={2} style={{ border: "1px solid #334155", padding: "6px 4px", width: 75 }}>
                    Mã nhà cung cấp
                  </th>
                  <th rowSpan={2} style={{ border: "1px solid #334155", padding: "6px 4px", width: 125 }}>
                    Tên nhà cung cấp
                  </th>
                  <th rowSpan={2} style={{ border: "1px solid #334155", padding: "6px 4px", width: 75 }}>
                    Địa chỉ
                  </th>
                  <th rowSpan={2} style={{ border: "1px solid #334155", padding: "6px 4px", width: 70 }}>
                    Tổng nợ
                  </th>
                  <th rowSpan={2} style={{ border: "1px solid #334155", padding: "6px 4px", width: 75 }}>
                    Không có hạn nợ
                  </th>
                  <th colSpan={6} style={{ border: "1px solid #334155", padding: "4px" }}>
                    Nợ trước hạn
                  </th>
                  <th colSpan={6} style={{ border: "1px solid #334155", padding: "4px" }}>
                    Nợ quá hạn
                  </th>
                </tr>
                <tr style={{ textAlign: "center", fontWeight: 700 }}>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 45 }}>0-30 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 45 }}>31-60 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 45 }}>61-90 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 45 }}>91-120 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 55 }}>Trên 120 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 50 }}>Tổng</th>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 45 }}>0-30 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 45 }}>31-60 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 45 }}>61-90 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 45 }}>91-120 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 55 }}>Trên 120 ngày</th>
                  <th style={{ border: "1px solid #334155", padding: "4px", width: 50 }}>Tổng</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ border: "1px solid #334155", padding: "4px" }}>Mã nhóm NCC: &lt;&lt;Khác&gt;&gt;</td>
                  <td colSpan={16} style={{ border: "1px solid #334155", padding: "4px" }}>
                    Tên nhóm NCC: &lt;&lt;Khác&gt;&gt;
                  </td>
                </tr>

                {selectedSuppliers.includes("NCC00001") && (
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}>NCC00001</td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}>Tran Thi Huong</td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px", textAlign: "right" }}>
                      17.000.000
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "4px", textAlign: "right" }}>
                      17.000.000
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "4px" }}></td>
                  </tr>
                )}

                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={3} style={{ border: "1px solid #334155", padding: "4px" }}>
                    Tổng cộng
                  </td>
                  <td style={{ border: "1px solid #334155", padding: "4px", textAlign: "right" }}>
                    {selectedSuppliers.includes("NCC00001") ? "17.000.000" : "0"}
                  </td>
                  <td style={{ border: "1px solid #334155", padding: "4px", textAlign: "right" }}>
                    {selectedSuppliers.includes("NCC00001") ? "17.000.000" : "0"}
                  </td>
                  <td colSpan={12} style={{ border: "1px solid #334155", padding: "4px" }}></td>
                </tr>
              </tbody>
            </table>

            {/* Signatures */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                marginTop: 40,
                textAlign: "center",
                fontSize: 11,
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Người lập</div>
                <div style={{ fontStyle: "italic", fontSize: 10 }}>(Ký, họ tên)</div>
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>Kế toán trưởng</div>
                <div style={{ fontStyle: "italic", fontSize: 10 }}>(Ký, họ tên)</div>
              </div>
              <div>
                <div style={{ fontStyle: "italic", fontSize: 10, marginBottom: 4 }}>
                  Ngày 07 tháng 10 năm 2026
                </div>
                <div style={{ fontWeight: 700 }}>Giám đốc</div>
                <div style={{ fontStyle: "italic", fontSize: 10 }}>(Ký, họ tên, đóng dấu)</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Interactive Table matching Request 15, Screenshot 4 & 5 (Chi tiết công nợ phải trả theo tuổi nợ) */
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Centered Title */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <h1
              style={{
                margin: "0 0 6px 0",
                fontSize: 14.5,
                fontWeight: 700,
                color: "#0f172a",
                textTransform: "uppercase",
                letterSpacing: "0.2px",
              }}
            >
              CHI TIẾT CÔNG NỢ PHẢI TRẢ THEO TUỔI NỢ
            </h1>
            <div style={{ fontSize: 12, color: "#334155", fontStyle: "italic" }}>
              Tài khoản: {selectedAccount}, Đến ngày {toDate}
            </div>
          </div>

          {/* Two-Tier Header Table matching Screenshot 4 & 5 */}
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 2,
              overflow: "hidden",
              background: "#ffffff",
            }}
          >
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 1680,
                  borderCollapse: "collapse",
                  fontSize: 12,
                  color: "#1e293b",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#e5efe8",
                      borderBottom: "1px solid #cbd5e1",
                      fontWeight: 600,
                    }}
                  >
                    <th rowSpan={2} style={{ padding: "7px 10px", textAlign: "left", width: 105, borderRight: "1px solid #cbd5e1" }}>
                      Ngày chứng từ
                    </th>
                    <th rowSpan={2} style={{ padding: "7px 10px", textAlign: "left", width: 105, borderRight: "1px solid #cbd5e1" }}>
                      Số chứng từ
                    </th>
                    <th rowSpan={2} style={{ padding: "7px 10px", textAlign: "left", width: 105, borderRight: "1px solid #cbd5e1" }}>
                      Ngày hóa đơn
                    </th>
                    <th rowSpan={2} style={{ padding: "7px 10px", textAlign: "left", width: 95, borderRight: "1px solid #cbd5e1" }}>
                      Số hóa đơn
                    </th>
                    <th rowSpan={2} style={{ padding: "7px 10px", textAlign: "left", minWidth: 260, borderRight: "1px solid #cbd5e1" }}>
                      Diễn giải
                    </th>
                    <th rowSpan={2} style={{ padding: "7px 10px", textAlign: "right", width: 110, borderRight: "1px solid #cbd5e1" }}>
                      Tổng nợ
                    </th>
                    <th rowSpan={2} style={{ padding: "7px 10px", textAlign: "right", width: 120, borderRight: "1px solid #cbd5e1" }}>
                      Không có hạn nợ
                    </th>
                    <th colSpan={6} style={{ padding: "5px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>
                      Nợ trước hạn
                    </th>
                    <th colSpan={6} style={{ padding: "5px 10px", textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>
                      Nợ quá hạn
                    </th>
                  </tr>
                  <tr
                    style={{
                      background: "#e5efe8",
                      borderBottom: "1px solid #cbd5e1",
                      fontWeight: 600,
                    }}
                  >
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 80, borderRight: "1px solid #cbd5e1" }}>0-30 ngày</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 80, borderRight: "1px solid #cbd5e1" }}>31-60 ngày</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 80, borderRight: "1px solid #cbd5e1" }}>61-90 ngày</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 85, borderRight: "1px solid #cbd5e1" }}>91-120 ngày</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 95, borderRight: "1px solid #cbd5e1" }}>Trên 120 ngày</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 85, borderRight: "1px solid #cbd5e1" }}>Tổng</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 80, borderRight: "1px solid #cbd5e1" }}>1-30 ngày</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 80, borderRight: "1px solid #cbd5e1" }}>31-60 ngày</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 80, borderRight: "1px solid #cbd5e1" }}>61-90 ngày</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 85, borderRight: "1px solid #cbd5e1" }}>91-120 ngày</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 95, borderRight: "1px solid #cbd5e1" }}>Trên 120 ngày</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", width: 85 }}>Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSuppliers.includes("NCC00001") ? (
                    <>
                      {/* Group Row matching Screenshot 4 & 5 */}
                      <tr
                        style={{
                          background: "#eaf5ee",
                          fontWeight: 700,
                          borderBottom: "1px solid #cbd5e1",
                        }}
                      >
                        <td
                          colSpan={5}
                          style={{
                            padding: "7px 10px",
                            borderRight: "1px solid #e2e8f0",
                            color: "#0f172a",
                          }}
                        >
                          <span style={{ marginRight: 6, fontSize: 11 }}>▾</span>
                          Tên nhà cung cấp: Tran Thi Huong (1)
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                          17.000.000
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                          17.000.000
                        </td>
                        <td colSpan={12}></td>
                      </tr>

                      {/* Detail row matching Screenshot 4 & 5 */}
                      {isTreeExpanded && (
                        <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#ffffff" }}>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
                          <td
                            style={{
                              padding: "7px 10px",
                              borderRight: "1px solid #f1f5f9",
                              color: "#0075c0",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                            onClick={() => notify?.("Xem chứng từ NK00001")}
                          >
                            NK00001
                          </td>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>NM01</td>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>
                            Mua hàng của Tran Thi Huong theo hóa đơn ...
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                            17.000.000
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                            17.000.000
                          </td>
                          <td colSpan={12}></td>
                        </tr>
                      )}

                      {/* Total row matching Screenshot 4 & 5 */}
                      <tr
                        style={{
                          background: "#f8fafc",
                          borderTop: "1px solid #cbd5e1",
                          borderBottom: "1px solid #cbd5e1",
                          fontWeight: 700,
                        }}
                      >
                        <td colSpan={5} style={{ padding: "7px 10px", borderRight: "1px solid #cbd5e1" }}>
                          Tổng cộng
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                          17.000.000
                        </td>
                        <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                          17.000.000
                        </td>
                        <td colSpan={12}></td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan={19} style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>
                        Không có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer matching Screenshot 4 & 5: Tổng số: 1 | Số dòng/trang: 20 | < 1 > */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "7px 16px",
                background: "#ffffff",
                borderTop: "1px solid #cbd5e1",
                fontSize: 12,
                color: "#334155",
              }}
            >
              <span>Tổng số: 1</span>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span>Số dòng/trang</span>
                <select
                  defaultValue="20"
                  style={{
                    height: 24,
                    fontSize: 12,
                    padding: "0 6px",
                    borderRadius: 3,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                  }}
                >
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ cursor: "pointer", color: "#94a3b8" }}>&lt;</span>
                  <span
                    style={{
                      display: "inline-block",
                      minWidth: 20,
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#0075c0",
                    }}
                  >
                    1
                  </span>
                  <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal Drawer "Chọn tham số" matching Screenshot 3 */}
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
              width: 860,
              maxWidth: "92vw",
              height: "100%",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
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
                  style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
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
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                  }}
                  title="Đóng"
                >
                  <X size={18} />
                  <span>Đóng (ESC)</span>
                </button>
              </div>
            </div>

            {/* Drawer Body matching Screenshot 3 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* Row 1: Đến ngày, Tài khoản *, Nhóm nhà cung cấp */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1.5fr",
                  gap: 14,
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
                        padding: "0 30px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{ position: "absolute", right: 8, top: 9, color: "#64748b" }}
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
                    Tài khoản <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={draftAccount}
                    onChange={(e) => setDraftAccount(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      background: "#ffffff",
                    }}
                  >
                    <option value="331">331</option>
                    <option value="336">336</option>
                    <option value="341">341</option>
                  </select>
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
                    Nhóm nhà cung cấp
                  </label>
                  <select
                    value={draftSupplierGroup}
                    onChange={(e) => setDraftSupplierGroup(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      background: "#ffffff",
                    }}
                  >
                    <option value="">-- Chọn nhóm nhà cung cấp --</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Tùy chọn khoảng nợ ... button */}
              <div>
                <button
                  type="button"
                  onClick={() => notify?.("Tùy chọn cấu hình khoảng nợ...")}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    padding: "6px 14px",
                    fontSize: 12.5,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  Tùy chọn khoảng nợ ...
                </button>
              </div>

              {/* Table of suppliers matching Screenshot 3 */}
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
                      gap: 8,
                      fontSize: 12.5,
                      color: "#1e293b",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        filteredSuppliers.length > 0 &&
                        filteredSuppliers.every((s) => draftSuppliers.includes(s.code))
                      }
                      onChange={toggleSelectAllSuppliers}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Chọn tất cả</span>
                    <span
                      style={{
                        background: "#dcfce7",
                        color: "#15803d",
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 12,
                        marginLeft: 6,
                      }}
                    >
                      {draftSuppliers.length} nhà cung cấp được chọn
                    </span>
                  </label>

                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: 8,
                        top: 6,
                        color: "#8b5cf6",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Search size={13} />
                    </span>
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={supplierSearchText}
                      onChange={(e) => setSupplierSearchText(e.target.value)}
                      style={{
                        width: 220,
                        height: 28,
                        padding: "0 10px 0 28px",
                        fontSize: 12,
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
                    borderRadius: 2,
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
                      <tr
                        style={{
                          background: "#e5efe8",
                          borderBottom: "1px solid #cbd5e1",
                          fontWeight: 600,
                        }}
                      >
                        <th style={{ width: 36, padding: "6px", textAlign: "center" }}></th>
                        <th style={{ padding: "6px 10px", textAlign: "left", width: 110 }}>Mã NCC</th>
                        <th style={{ padding: "6px 10px", textAlign: "left" }}>Tên NCC</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", width: 140 }}>Địa chỉ</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", width: 130 }}>Mã số thuế</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSuppliers.map((s) => {
                        const isChecked = draftSuppliers.includes(s.code);
                        return (
                          <tr
                            key={s.code}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              background: isChecked ? "#f0fdf4" : "#ffffff",
                            }}
                          >
                            <td style={{ textAlign: "center", padding: "6px" }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectSupplier(s.code)}
                                style={{ accentColor: "#00a862" }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px", fontWeight: 500 }}>{s.code}</td>
                            <td style={{ padding: "6px 10px" }}>{s.name}</td>
                            <td style={{ padding: "6px 10px", color: "#64748b" }}>{s.address}</td>
                            <td style={{ padding: "6px 10px" }}>{s.taxCode}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Supplier Table Footer */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 12px",
                      background: "#ffffff",
                      borderTop: "1px solid #cbd5e1",
                      fontSize: 11.5,
                      color: "#475569",
                    }}
                  >
                    <span>Tổng số: {filteredSuppliers.length}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span>Số dòng/trang</span>
                      <select
                        defaultValue="20"
                        style={{
                          height: 22,
                          fontSize: 11.5,
                          padding: "0 4px",
                          borderRadius: 3,
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                        }}
                      >
                        <option value="20">20</option>
                      </select>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ cursor: "pointer", color: "#94a3b8" }}>&lt;</span>
                        <span style={{ fontWeight: 600, color: "#0075c0" }}>1</span>
                        <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
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
                  fontSize: 12.5,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Xóa điều kiện
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    height: 32,
                    padding: "0 16px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyParams}
                  style={{
                    height: 32,
                    padding: "0 18px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 12.5,
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: "pointer",
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
