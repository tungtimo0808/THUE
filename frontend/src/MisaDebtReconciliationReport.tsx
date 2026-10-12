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
} from "lucide-react";

export interface MisaDebtReconciliationReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
  type?: "confirmation" | "notice";
}

interface AccountItem {
  code: string;
  name: string;
  level: number;
}

const DEFAULT_ACCOUNTS: AccountItem[] = [
  { code: "331", name: "Phải trả cho người bán", level: 1 },
  { code: "336", name: "Phải trả nội bộ", level: 1 },
  { code: "3361", name: "Phải trả nội bộ về vốn kinh doanh", level: 2 },
  { code: "3362", name: "Phải trả nội bộ về chênh lệch tỷ giá", level: 2 },
  { code: "3363", name: "Phải trả nội bộ về chi phí đi vay đủ điều kiện được vốn hóa", level: 2 },
  { code: "3368", name: "Phải trả nội bộ khác", level: 2 },
  { code: "341", name: "Vay và nợ thuê tài chính", level: 1 },
  { code: "3411", name: "Các khoản đi vay", level: 2 },
  { code: "3412", name: "Nợ thuê tài chính", level: 2 },
];

const DEFAULT_SUPPLIERS = [
  {
    code: "NCC00001",
    name: "Tran Thi Huong",
    address: "",
    taxCode: "030178006908",
    phone: "097775611",
  },
];

export default function MisaDebtReconciliationReport({
  onBack,
  notify,
  type = "confirmation",
}: MisaDebtReconciliationReportProps) {
  const isNotice = type === "notice";

  // Drawer state
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [noticeDate, setNoticeDate] = useState("07/10/2026");
  const [supplierGroup, setSupplierGroup] = useState("");
  const [showDetailedExpenses, setShowDetailedExpenses] = useState(false);
  const [hideZeroEndingBalance, setHideZeroEndingBalance] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    DEFAULT_ACCOUNTS.map((a) => a.code)
  );
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(["NCC00001"]);

  // Draft state inside drawer
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftNoticeDate, setDraftNoticeDate] = useState("07/10/2026");
  const [draftSupplierGroup, setDraftSupplierGroup] = useState("");
  const [draftShowDetailedExpenses, setDraftShowDetailedExpenses] = useState(false);
  const [draftHideZeroEnding, setDraftHideZeroEnding] = useState(false);
  const [draftAccounts, setDraftAccounts] = useState<string[]>(DEFAULT_ACCOUNTS.map((a) => a.code));
  const [draftSuppliers, setDraftSuppliers] = useState<string[]>(["NCC00001"]);
  const [accountSearchText, setAccountSearchText] = useState("");
  const [supplierSearchText, setSupplierSearchText] = useState("");

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftNoticeDate(noticeDate);
    setDraftSupplierGroup(supplierGroup);
    setDraftShowDetailedExpenses(showDetailedExpenses);
    setDraftHideZeroEnding(hideZeroEndingBalance);
    setDraftAccounts(selectedAccounts);
    setDraftSuppliers(selectedSuppliers);
    setAccountSearchText("");
    setSupplierSearchText("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setNoticeDate(draftNoticeDate);
    setSupplierGroup(draftSupplierGroup);
    setShowDetailedExpenses(draftShowDetailedExpenses);
    setHideZeroEndingBalance(draftHideZeroEnding);
    setSelectedAccounts(draftAccounts);
    setSelectedSuppliers(draftSuppliers);
    setIsParamDrawerOpen(false);
    notify?.(
      isNotice
        ? "Đã cập nhật Thông báo công nợ với nhà cung cấp."
        : "Đã cập nhật Biên bản đối chiếu và xác nhận công nợ phải trả."
    );
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftNoticeDate("07/10/2026");
    setDraftSupplierGroup("");
    setDraftShowDetailedExpenses(false);
    setDraftHideZeroEnding(false);
    setDraftAccounts(DEFAULT_ACCOUNTS.map((a) => a.code));
    setDraftSuppliers(["NCC00001"]);
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

  const filteredDrawerAccounts = useMemo(() => {
    if (!accountSearchText.trim()) return DEFAULT_ACCOUNTS;
    const kw = accountSearchText.toLowerCase();
    return DEFAULT_ACCOUNTS.filter(
      (a) => a.code.toLowerCase().includes(kw) || a.name.toLowerCase().includes(kw)
    );
  }, [accountSearchText]);

  const filteredDrawerSuppliers = useMemo(() => {
    if (!supplierSearchText.trim()) return DEFAULT_SUPPLIERS;
    const kw = supplierSearchText.toLowerCase();
    return DEFAULT_SUPPLIERS.filter(
      (s) =>
        s.code.toLowerCase().includes(kw) ||
        s.name.toLowerCase().includes(kw) ||
        s.taxCode.toLowerCase().includes(kw)
    );
  }, [supplierSearchText]);

  const toggleSelectAccount = (code: string) => {
    setDraftAccounts((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleSelectAllAccounts = () => {
    if (draftAccounts.length === DEFAULT_ACCOUNTS.length) {
      setDraftAccounts([]);
    } else {
      setDraftAccounts(DEFAULT_ACCOUNTS.map((a) => a.code));
    }
  };

  const toggleSelectSupplier = (code: string) => {
    setDraftSuppliers((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleSelectAllSuppliers = () => {
    if (draftSuppliers.length === DEFAULT_SUPPLIERS.length) {
      setDraftSuppliers([]);
    } else {
      setDraftSuppliers(DEFAULT_SUPPLIERS.map((s) => s.code));
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#e2e8f0",
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
            {isNotice
              ? "Thông báo công nợ với nhà cung cấp"
              : "Biên bản đối chiếu và xác nhận công nợ phải trả"}
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

      {/* 2. Secondary Toolbar matching Screenshot 2 */}
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

          {/* Đối chiếu công nợ với NCC */}
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

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="In"
          >
            <Printer size={15} />
          </button>

          <button
            type="button"
            onClick={() => notify?.("Đang xuất khẩu báo cáo...")}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Xuất khẩu"
          >
            <Download size={15} />
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
            title="Thiết lập"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 3. A4 Sheet Paper matching Screenshot 2 */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "880px",
            minHeight: "1050px",
            background: "#ffffff",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            padding: "40px 48px",
            boxSizing: "border-box",
            color: "#0f172a",
            fontFamily: "'Times New Roman', Times, serif, system-ui",
            fontSize: 12,
          }}
        >
          {isNotice ? (
            /* Thông báo công nợ với nhà cung cấp matching Screenshot 2 */
            <div>
              {/* Company top-left */}
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Tung</div>

              {/* Title */}
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h1
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: 16.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  THÔNG BÁO CÔNG NỢ VỚI NHÀ CUNG CẤP
                </h1>
                <div style={{ fontStyle: "italic", fontSize: 12 }}>Ngày in: {noticeDate}</div>
              </div>

              {/* Top Information Box matching Screenshot 2 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr",
                  border: "1px solid #334155",
                  marginBottom: 20,
                }}
              >
                <div style={{ padding: "8px 12px", borderRight: "1px solid #334155", lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Kính gửi:</div>
                  <div>
                    <span style={{ fontWeight: 600 }}>Đơn vị: </span>Tran Thi Huong
                  </div>
                  <div>
                    <span style={{ fontWeight: 600 }}>Địa chỉ: </span>
                  </div>
                  <div>
                    <span style={{ fontWeight: 600 }}>Mã số thuế: </span>030178006908
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      textAlign: "center",
                      padding: "6px",
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>Kỳ</div>
                    <div style={{ fontStyle: "italic", fontSize: 11 }}>Tháng 10 năm 2026</div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      padding: "6px 8px",
                      borderBottom: "1px solid #334155",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Số dư cuối kỳ</span>
                    <span style={{ textAlign: "right", fontWeight: 700 }}>17.000.000</span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      padding: "6px 8px",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Số dư đầu kỳ</span>
                    <span></span>
                  </div>
                </div>
              </div>

              {/* Voucher Detail Table matching Screenshot 2 */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "1px solid #334155",
                  marginBottom: 20,
                  fontSize: 11.5,
                }}
              >
                <thead>
                  <tr style={{ background: "#ffffff", textAlign: "center", fontWeight: 700 }}>
                    <th style={{ border: "1px solid #334155", padding: "6px", width: 90 }}>Ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "6px", width: 100 }}>Số chứng từ</th>
                    <th style={{ border: "1px solid #334155", padding: "6px", textAlign: "left" }}>
                      Diễn giải
                    </th>
                    <th style={{ border: "1px solid #334155", padding: "6px", width: 110, textAlign: "right" }}>
                      Số tiền
                    </th>
                    <th style={{ border: "1px solid #334155", padding: "6px", width: 110, textAlign: "right" }}>
                      Số dư
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "6px", textAlign: "center" }}>
                      06/10/2026
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "6px", textAlign: "center" }}>
                      NM01
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "6px" }}>
                      Mua hàng của Tran Thi Huong theo hóa đơn số NM01
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "6px", textAlign: "right" }}>
                      17.000.000
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "6px", textAlign: "right" }}>
                      17.000.000
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Aging Breakdown Table Box matching Screenshot 2 */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "1px solid #334155",
                  marginBottom: 36,
                  fontSize: 10.5,
                }}
              >
                <thead>
                  <tr style={{ textAlign: "center", fontWeight: 700 }}>
                    <th style={{ border: "1px solid #334155", padding: "5px 4px" }}>Không có hạn nợ</th>
                    <th style={{ border: "1px solid #334155", padding: "5px 4px" }}>Chưa đến hạn</th>
                    <th style={{ border: "1px solid #334155", padding: "5px 4px" }}>Quá hạn 1-30 ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "5px 4px" }}>Quá hạn 31-60 ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "5px 4px" }}>Quá hạn 61-90 ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "5px 4px" }}>Quá hạn 91-120 ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "5px 4px" }}>Quá hạn trên 120 ngày</th>
                    <th style={{ border: "1px solid #334155", padding: "5px 4px" }}>Tổng số dư Nợ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ textAlign: "right" }}>
                    <td style={{ border: "1px solid #334155", padding: "5px 4px" }}>17.000.000</td>
                    <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "5px 4px" }}></td>
                    <td style={{ border: "1px solid #334155", padding: "5px 4px", fontWeight: 700 }}>
                      17.000.000
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signature matching Screenshot 2 */}
              <div style={{ textAlign: "right", paddingRight: 60 }}>
                <div style={{ fontWeight: 700 }}>Người lập</div>
                <div style={{ fontStyle: "italic", fontSize: 11 }}>(Ký, họ tên)</div>
              </div>
            </div>
          ) : (
            /* Biên bản đối chiếu & xác nhận công nợ */
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Tung</div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <h1 style={{ margin: "0 0 6px 0", fontSize: 16.5, fontWeight: 700 }}>
                  BIÊN BẢN ĐỐI CHIẾU & XÁC NHẬN CÔNG NỢ
                </h1>
              </div>

              <div style={{ marginBottom: 14, lineHeight: 1.6 }}>
                <div><span style={{ fontWeight: 700 }}>Bên mua: </span>Tung</div>
                <div><span style={{ fontWeight: 700 }}>Địa chỉ: </span></div>
                <div><span style={{ fontWeight: 700 }}>Mã số thuế: </span></div>
              </div>

              <div style={{ border: "1px solid #334155", marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "4px 8px", borderBottom: "1px solid #334155" }}>
                  <span style={{ fontWeight: 700 }}>Bên bán:</span>
                  <div>
                    <span style={{ fontWeight: 700 }}>Mã nhà cung cấp: </span>
                    <span style={{ border: "1px solid #334155", padding: "1px 6px" }}>NCC00001</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", padding: "4px 8px", borderBottom: "1px solid #334155" }}>
                  <span style={{ fontWeight: 700 }}>Nhà cung cấp</span>
                  <span>Tran Thi Huong</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", padding: "4px 8px", borderBottom: "1px solid #334155" }}>
                  <span style={{ fontWeight: 700 }}>Địa chỉ</span>
                  <span></span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", padding: "4px 8px" }}>
                  <span style={{ fontWeight: 700 }}>Điện thoại và ĐT di động</span>
                  <span>097775611</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontStyle: "italic" }}>
                <span>Thời điểm xác nhận: <strong style={{ fontStyle: "normal" }}>Tháng 10 năm 2026</strong></span>
                <span>Đơn vị tính: VND</span>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #334155", marginBottom: 16 }}>
                <thead>
                  <tr style={{ background: "#ffffff", fontWeight: 700 }}>
                    <th style={{ border: "1px solid #334155", padding: "6px 8px", textAlign: "left" }}>
                      Các nội dung đối chiếu:
                    </th>
                    <th style={{ border: "1px solid #334155", padding: "6px 8px", width: 140, textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>1. Công nợ tiền đầu kỳ</td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", textAlign: "right" }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>
                      2. Phát sinh tăng trong kỳ (2 = 2.1 + 2.2)
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", textAlign: "right" }}>27.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px 4px 20px", fontStyle: "italic" }}>- Trong đó:</td>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px" }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px 4px 28px" }}>2.1. Phải trả tiền mua hàng</td>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px", textAlign: "right" }}>27.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px 4px 28px" }}>2.2. Phát sinh khác</td>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px" }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>
                      3. Phát sinh giảm trong kỳ (3 = 3.1 + 3.2)
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", textAlign: "right" }}>10.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px 4px 28px" }}>3.1. Thanh toán trong kỳ</td>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px", textAlign: "right" }}>10.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px 4px 28px" }}>3.2. Giảm khác</td>
                    <td style={{ border: "1px solid #334155", padding: "4px 8px" }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>
                      4. Công nợ cuối kỳ (4 = 1 + 2 - 3)
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>
                      17.000.000
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>
                      5. Phát sinh công nợ lũy kế năm
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", textAlign: "right" }}>27.000.000</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px", fontWeight: 700 }}>
                      6. Công nợ quá hạn thanh toán
                    </td>
                    <td style={{ border: "1px solid #334155", padding: "5px 8px" }}></td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginBottom: 12, lineHeight: 1.6 }}>
                <div>
                  <span style={{ fontWeight: 700 }}>Số tiền công nợ cuối kỳ viết bằng chữ: </span>
                  <span style={{ fontStyle: "italic" }}>Mười bảy triệu đồng.</span>
                </div>
              </div>

              <div style={{ textAlign: "center", margin: "24px 0 16px 0", fontStyle: "italic", fontWeight: 700 }}>
                Trân trọng cảm ơn!
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  marginTop: 10,
                  textAlign: "center",
                  fontSize: 11,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>Xác nhận của nhà cung cấp</div>
                  <div style={{ fontStyle: "italic", fontSize: 10 }}>(Ký, họ tên)</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>Phòng kinh doanh</div>
                  <div style={{ fontStyle: "italic", fontSize: 10 }}>(Ký, họ tên)</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>Kế toán trưởng</div>
                  <div style={{ fontStyle: "italic", fontSize: 10 }}>(Ký, họ tên)</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>Kế toán công nợ</div>
                  <div style={{ fontStyle: "italic", fontSize: 10 }}>(Ký, họ tên)</div>
                </div>
              </div>
            </div>
          )}
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

            {/* Drawer Body matching Screenshot 1 */}
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
              {/* Row 1: Kỳ báo cáo *, Từ ngày, Đến ngày */}
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
                    Kỳ báo cáo <span style={{ color: "#ef4444" }}>*</span>
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

              {/* Row 2: Nhóm nhà cung cấp, and optional Ngày thông báo */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isNotice ? "1.5fr 1fr" : "1fr",
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

                {isNotice && (
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
                      Ngày thông báo
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={draftNoticeDate}
                        onChange={(e) => setDraftNoticeDate(e.target.value)}
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
                )}
              </div>

              {/* Checkbox for Notice mode matching Screenshot 1 */}
              {isNotice && (
                <div style={{ marginTop: 2 }}>
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
                      checked={draftShowDetailedExpenses}
                      onChange={(e) => setDraftShowDetailedExpenses(e.target.checked)}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Hiển thị chi tiết CT phát sinh: Chi tiền, trả lại, giảm giá hàng mua</span>
                  </label>
                </div>
              )}

              {/* Table 1: Chọn tài khoản matching Screenshot 1 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
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
                        filteredDrawerAccounts.length > 0 &&
                        filteredDrawerAccounts.every((a) => draftAccounts.includes(a.code))
                      }
                      onChange={toggleSelectAllAccounts}
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
                      {draftAccounts.length} tài khoản được chọn
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
                      value={accountSearchText}
                      onChange={(e) => setAccountSearchText(e.target.value)}
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
                    maxHeight: 180,
                    overflowY: "auto",
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
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <th style={{ width: 36, padding: "6px", textAlign: "center" }}></th>
                        <th style={{ padding: "6px 10px", textAlign: "left", width: 140 }}>Số tài khoản</th>
                        <th style={{ padding: "6px 10px", textAlign: "left" }}>Tên tài khoản</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 80 }}>Bậc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrawerAccounts.map((a) => {
                        const isChecked = draftAccounts.includes(a.code);
                        return (
                          <tr
                            key={a.code}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              background: isChecked ? "#f0fdf4" : "#ffffff",
                            }}
                          >
                            <td style={{ textAlign: "center", padding: "6px" }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectAccount(a.code)}
                                style={{ accentColor: "#00a862" }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px", fontWeight: 500 }}>{a.code}</td>
                            <td style={{ padding: "6px 10px" }}>{a.name}</td>
                            <td style={{ padding: "6px 10px", textAlign: "center" }}>{a.level}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: Chọn nhà cung cấp matching Screenshot 1 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
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
                        filteredDrawerSuppliers.length > 0 &&
                        filteredDrawerSuppliers.every((s) => draftSuppliers.includes(s.code))
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
                        <th style={{ padding: "6px 10px", textAlign: "left", width: 120 }}>
                          {isNotice ? "Mã nhà cung cấp" : "Mã NCC"}
                        </th>
                        <th style={{ padding: "6px 10px", textAlign: "left" }}>
                          {isNotice ? "Tên nhà cung cấp" : "Tên NCC"}
                        </th>
                        <th style={{ padding: "6px 10px", textAlign: "left", width: 140 }}>Địa chỉ</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", width: 130 }}>Mã số thuế</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrawerSuppliers.map((s) => {
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
                    <span>Tổng số: {filteredDrawerSuppliers.length}</span>
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

              {/* Bottom checkbox for Confirmation mode */}
              {!isNotice && (
                <div style={{ marginTop: 4 }}>
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
                      checked={draftHideZeroEnding}
                      onChange={(e) => setDraftHideZeroEnding(e.target.checked)}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Không hiển thị nhà cung cấp có số dư cuối kỳ bằng 0</span>
                  </label>
                </div>
              )}
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
