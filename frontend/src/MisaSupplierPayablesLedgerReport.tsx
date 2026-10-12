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
  UserCheck,
} from "lucide-react";

export interface MisaSupplierPayablesLedgerReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export interface SupplierPayableLedgerRow {
  postingDate: string;
  voucherDate: string;
  voucherNo: string;
  description: string;
  debtAccount: string;
  contraAccount: string;
  incurredDebit?: number;
  incurredCredit?: number;
  closingDebit?: number;
  closingCredit: number;
  projectCode?: string;
  projectName?: string;
}

const DEFAULT_ROWS: SupplierPayableLedgerRow[] = [
  {
    postingDate: "06/10/2026",
    voucherDate: "06/10/2026",
    voucherNo: "NK00001",
    description: "Màn hình 21 LG inch",
    debtAccount: "331",
    contraAccount: "156",
    incurredDebit: 0,
    incurredCredit: 25000000,
    closingCredit: 25000000,
  },
  {
    postingDate: "06/10/2026",
    voucherDate: "06/10/2026",
    voucherNo: "NK00001",
    description: "Thuế GTGT - Màn hình 21 LG inch",
    debtAccount: "331",
    contraAccount: "1331",
    incurredDebit: 0,
    incurredCredit: 2000000,
    closingCredit: 27000000,
  },
  {
    postingDate: "06/10/2026",
    voucherDate: "06/10/2026",
    voucherNo: "UNC00001",
    description: "Trả tiền cho Tran Thi Huong theo hóa đơn NM01",
    debtAccount: "331",
    contraAccount: "1121",
    incurredDebit: 10000000,
    incurredCredit: 0,
    closingCredit: 17000000,
  },
];

export default function MisaSupplierPayablesLedgerReport({
  onBack,
  notify,
}: MisaSupplierPayablesLedgerReportProps) {
  // Drawer state
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [selectedAccount, setSelectedAccount] = useState("331");
  const [supplierGroup, setSupplierGroup] = useState("");
  const [selectedSupplierCode, setSelectedSupplierCode] = useState("NCC00001");
  const [selectedSupplierName, setSelectedSupplierName] = useState("Tran Thi Huong");

  // Options in drawer
  const [combineIdenticalEntries, setCombineIdenticalEntries] = useState(false);
  const [combineIdenticalTaxEntries, setCombineIdenticalTaxEntries] = useState(false);

  // Draft state inside drawer
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftAccount, setDraftAccount] = useState("331");
  const [draftSupplierGroup, setDraftSupplierGroup] = useState("");
  const [draftSelectedSuppliers, setDraftSelectedSuppliers] = useState<string[]>(["NCC00001"]);
  const [draftCombineIdentical, setDraftCombineIdentical] = useState(false);
  const [draftCombineIdenticalTax, setDraftCombineIdenticalTax] = useState(false);
  const [supplierSearchKeyword, setSupplierSearchKeyword] = useState("");

  // Toolbar state
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isTreeExpanded, setIsTreeExpanded] = useState(true);

  // Data
  const [ledgerRows, setLedgerRows] = useState<SupplierPayableLedgerRow[]>(DEFAULT_ROWS);

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftAccount(selectedAccount);
    setDraftSupplierGroup(supplierGroup);
    setDraftSelectedSuppliers(selectedSupplierCode ? [selectedSupplierCode] : ["NCC00001"]);
    setDraftCombineIdentical(combineIdenticalEntries);
    setDraftCombineIdenticalTax(combineIdenticalTaxEntries);
    setSupplierSearchKeyword("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSelectedAccount(draftAccount);
    setSupplierGroup(draftSupplierGroup);
    setCombineIdenticalEntries(draftCombineIdentical);
    setCombineIdenticalTaxEntries(draftCombineIdenticalTax);

    if (draftSelectedSuppliers.length > 0) {
      setSelectedSupplierCode("NCC00001");
      setSelectedSupplierName("Tran Thi Huong");
      setLedgerRows(DEFAULT_ROWS);
    } else {
      setSelectedSupplierCode("");
      setSelectedSupplierName("");
      setLedgerRows([]);
    }

    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Chi tiết công nợ phải trả nhà cung cấp.");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftAccount("331");
    setDraftSupplierGroup("");
    setDraftSelectedSuppliers([]);
    setDraftCombineIdentical(false);
    setDraftCombineIdenticalTax(false);
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

  const supplierList = [
    {
      code: "NCC00001",
      name: "Tran Thi Huong",
      address: "",
      taxCode: "030178006908",
    },
  ];

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchKeyword.trim()) return supplierList;
    const kw = supplierSearchKeyword.toLowerCase();
    return supplierList.filter(
      (s) =>
        s.code.toLowerCase().includes(kw) ||
        s.name.toLowerCase().includes(kw) ||
        s.taxCode.toLowerCase().includes(kw)
    );
  }, [supplierSearchKeyword]);

  const toggleSelectSupplier = (code: string) => {
    setDraftSelectedSuppliers((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleSelectAllSuppliers = () => {
    if (draftSelectedSuppliers.length === supplierList.length) {
      setDraftSelectedSuppliers([]);
    } else {
      setDraftSelectedSuppliers(supplierList.map((s) => s.code));
    }
  };

  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return ledgerRows;
    const kw = searchKeyword.toLowerCase();
    return ledgerRows.filter(
      (r) =>
        r.voucherNo.toLowerCase().includes(kw) ||
        r.description.toLowerCase().includes(kw) ||
        r.contraAccount.toLowerCase().includes(kw)
    );
  }, [ledgerRows, searchKeyword]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#ffffff",
        overflow: "hidden",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
          borderBottom: "1px solid #e2e8f0",
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
            Chi tiết công nợ phải trả nhà cung cấp
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

      {/* 2. Action Toolbar matching Screenshot 2 */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Tree collapse/expand */}
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

          {/* Filter */}
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

          {/* Columns */}
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

          {/* Đối chiếu công nợ với NCC button */}
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
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Purple Search box */}
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

          {/* Print dropdown */}
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
              <ChevronDown size={11} />
            </button>
          </div>

          {/* Export dropdown */}
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
              <ChevronDown size={11} />
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

      {/* 3. Report Content Area */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Title & Subtitle block matching Screenshot 2 */}
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
            CHI TIẾT CÔNG NỢ PHẢI TRẢ NHÀ CUNG CẤP
          </h1>
          <div
            style={{
              fontSize: 12,
              color: "#334155",
              fontStyle: "italic",
            }}
          >
            Tài khoản: {selectedAccount}, Nhà cung cấp: {selectedSupplierName || "Tran Thi Huong"}, Tháng 10 năm 2026
          </div>
        </div>

        {/* Two-Tier Header Table matching Screenshot 2 */}
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
                minWidth: 1400,
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
                  <th
                    rowSpan={2}
                    style={{
                      padding: "7px 10px",
                      textAlign: "left",
                      width: 105,
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span>Ngày hạch toán</span>
                      <ChevronDown size={12} color="#64748b" />
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "7px 10px",
                      textAlign: "left",
                      width: 105,
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    Ngày chứng từ
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "7px 10px",
                      textAlign: "left",
                      width: 105,
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    Số chứng từ
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "7px 10px",
                      textAlign: "left",
                      minWidth: 260,
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    Diễn giải
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "7px 10px",
                      textAlign: "center",
                      width: 80,
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    TK công nợ
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "7px 10px",
                      textAlign: "center",
                      width: 85,
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    TK đối ứng
                  </th>
                  <th
                    colSpan={2}
                    style={{
                      padding: "5px 10px",
                      textAlign: "center",
                      borderRight: "1px solid #cbd5e1",
                      borderBottom: "1px solid #cbd5e1",
                    }}
                  >
                    Phát sinh
                  </th>
                  <th
                    colSpan={2}
                    style={{
                      padding: "5px 10px",
                      textAlign: "center",
                      borderRight: "1px solid #cbd5e1",
                      borderBottom: "1px solid #cbd5e1",
                    }}
                  >
                    Số dư
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "7px 10px",
                      textAlign: "left",
                      width: 110,
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    Mã công trình
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "7px 10px",
                      textAlign: "left",
                      width: 130,
                    }}
                  >
                    Tên công trình
                  </th>
                </tr>
                <tr
                  style={{
                    background: "#e5efe8",
                    borderBottom: "1px solid #cbd5e1",
                    fontWeight: 600,
                  }}
                >
                  <th
                    style={{
                      padding: "5px 10px",
                      textAlign: "right",
                      width: 95,
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    Nợ
                  </th>
                  <th
                    style={{
                      padding: "5px 10px",
                      textAlign: "right",
                      width: 95,
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    Có
                  </th>
                  <th
                    style={{
                      padding: "5px 10px",
                      textAlign: "right",
                      width: 95,
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    Nợ
                  </th>
                  <th
                    style={{
                      padding: "5px 10px",
                      textAlign: "right",
                      width: 95,
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    Có
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  <>
                    {/* Supplier Group Header matching Screenshot 2 */}
                    <tr
                      style={{
                        background: "#eaf5ee",
                        fontWeight: 700,
                        borderBottom: "1px solid #cbd5e1",
                      }}
                    >
                      <td
                        colSpan={6}
                        style={{
                          padding: "7px 10px",
                          borderRight: "1px solid #e2e8f0",
                          color: "#0f172a",
                        }}
                      >
                        <span style={{ marginRight: 6, fontSize: 11 }}>▾</span>
                        Tên nhà cung cấp: {selectedSupplierName || "Tran Thi Huong"} (4)
                      </td>
                      <td
                        style={{
                          padding: "7px 10px",
                          textAlign: "right",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        10.000.000
                      </td>
                      <td
                        style={{
                          padding: "7px 10px",
                          textAlign: "right",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        27.000.000
                      </td>
                      <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
                      <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
                      <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
                      <td></td>
                    </tr>

                    {/* Detail Rows matching Screenshot 2 */}
                    {isTreeExpanded && (
                      <>
                        {/* Row 1: Màn hình 21 LG inch */}
                        <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#ffffff" }}>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
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
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>
                            Màn hình 21 LG inch
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
                            331
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
                            156
                          </td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td
                            style={{
                              padding: "7px 10px",
                              textAlign: "right",
                              borderRight: "1px solid #f1f5f9",
                            }}
                          >
                            25.000.000
                          </td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td
                            style={{
                              padding: "7px 10px",
                              textAlign: "right",
                              borderRight: "1px solid #f1f5f9",
                            }}
                          >
                            25.000.000
                          </td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td></td>
                        </tr>

                        {/* Row 2: Thuế GTGT */}
                        <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#ffffff" }}>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
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
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>
                            Thuế GTGT - Màn hình 21 LG inch
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
                            331
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
                            1331
                          </td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td
                            style={{
                              padding: "7px 10px",
                              textAlign: "right",
                              borderRight: "1px solid #f1f5f9",
                            }}
                          >
                            2.000.000
                          </td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td
                            style={{
                              padding: "7px 10px",
                              textAlign: "right",
                              borderRight: "1px solid #f1f5f9",
                            }}
                          >
                            27.000.000
                          </td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td></td>
                        </tr>

                        {/* Row 3: UNC00001 Trả tiền */}
                        <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#ffffff" }}>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>06/10/2026</td>
                          <td
                            style={{
                              padding: "7px 10px",
                              borderRight: "1px solid #f1f5f9",
                              color: "#0075c0",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                            onClick={() => notify?.("Xem chứng từ UNC00001")}
                          >
                            UNC00001
                          </td>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>
                            Trả tiền cho Tran Thi Huong theo hóa đơn NM01
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
                            331
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
                            1121
                          </td>
                          <td
                            style={{
                              padding: "7px 10px",
                              textAlign: "right",
                              borderRight: "1px solid #f1f5f9",
                            }}
                          >
                            10.000.000
                          </td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td
                            style={{
                              padding: "7px 10px",
                              textAlign: "right",
                              borderRight: "1px solid #f1f5f9",
                            }}
                          >
                            17.000.000
                          </td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td></td>
                        </tr>

                        {/* Row 4: Cộng */}
                        <tr style={{ borderBottom: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #f1f5f9" }}>Cộng</td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
                            331
                          </td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td
                            style={{
                              padding: "7px 10px",
                              textAlign: "right",
                              borderRight: "1px solid #f1f5f9",
                            }}
                          >
                            10.000.000
                          </td>
                          <td
                            style={{
                              padding: "7px 10px",
                              textAlign: "right",
                              borderRight: "1px solid #f1f5f9",
                            }}
                          >
                            27.000.000
                          </td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td
                            style={{
                              padding: "7px 10px",
                              textAlign: "right",
                              borderRight: "1px solid #f1f5f9",
                            }}
                          >
                            17.000.000
                          </td>
                          <td style={{ borderRight: "1px solid #f1f5f9" }}></td>
                          <td></td>
                        </tr>
                      </>
                    )}

                    {/* Total Row: Tổng cộng matching Screenshot 2 */}
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
                          padding: "7px 10px",
                          borderRight: "1px solid #cbd5e1",
                          color: "#0f172a",
                        }}
                      >
                        Tổng cộng
                      </td>
                      <td
                        style={{
                          padding: "7px 10px",
                          textAlign: "right",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        10.000.000
                      </td>
                      <td
                        style={{
                          padding: "7px 10px",
                          textAlign: "right",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        27.000.000
                      </td>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td></td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td
                      colSpan={12}
                      style={{
                        padding: "30px",
                        textAlign: "center",
                        color: "#94a3b8",
                        fontStyle: "italic",
                      }}
                    >
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer matching Screenshot 2: Tổng số: 4 | Số dòng/trang: 20 | < 1 > */}
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
            <span>Tổng số: 4</span>
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

      {/* 4. Modal Drawer "Chọn tham số" matching Screenshot 1 */}
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

            {/* Drawer Body */}
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
              {/* Row 1: Kỳ báo cáo (no red asterisk), Từ ngày, Đến ngày */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
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
                    Kỳ báo cáo
                  </label>
                  <select
                    value={draftPeriodPreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
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
                    <option value="Hôm nay">Hôm nay</option>
                    <option value="Tháng này">Tháng này</option>
                    <option value="Tháng trước">Tháng trước</option>
                    <option value="Quý 4">Quý 4</option>
                    <option value="Năm nay">Năm nay</option>
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
              </div>

              {/* Row 2: Tài khoản, Nhóm nhà cung cấp */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 2fr",
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
                    Tài khoản
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

              {/* Table of suppliers matching Screenshot 1 */}
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
                        filteredSuppliers.every((s) => draftSelectedSuppliers.includes(s.code))
                      }
                      onChange={toggleSelectAllSuppliers}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Chọn tất cả nhà cung cấp</span>
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
                      value={supplierSearchKeyword}
                      onChange={(e) => setSupplierSearchKeyword(e.target.value)}
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
                        const isChecked = draftSelectedSuppliers.includes(s.code);
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

              {/* Bottom checkboxes matching Screenshot 1 */}
              <div style={{ display: "flex", gap: 24, marginTop: 4 }}>
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
                    checked={draftCombineIdentical}
                    onChange={(e) => setDraftCombineIdentical(e.target.checked)}
                    style={{ accentColor: "#00a862" }}
                  />
                  <span>Cộng gộp các bút toán giống nhau</span>
                </label>

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
                    checked={draftCombineIdenticalTax}
                    onChange={(e) => setDraftCombineIdenticalTax(e.target.checked)}
                    style={{ accentColor: "#00a862" }}
                  />
                  <span>Cộng gộp các bút toán thuế giống nhau</span>
                </label>
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
