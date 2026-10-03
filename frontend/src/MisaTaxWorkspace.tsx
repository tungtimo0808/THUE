import { useState, useEffect, Fragment } from "react";
import { useLocation } from "react-router-dom";
import {
  Search,
  RotateCw,
  Printer,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  SlidersHorizontal,
  Building2,
  DollarSign,
  Calculator,
  Download,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import "./misa-cash.css";

export type MisaTaxWorkspaceProps = {
  company?: { id: string; name: string };
  period?: string;
  tab?: string;
  href?: (path: string) => string;
  notify: (msg: string) => void;
};

// ============================================================================
// SAMPLE DATA: DANH MỤC TỜ KHAI THUẾ
// ============================================================================
type DeclarationItem = {
  id: string;
  code: string;
  name: string;
  cycle: string;
  group: string;
  checked: boolean;
};

const INITIAL_DECLARATIONS: DeclarationItem[] = [
  // Thuế giá trị gia tăng
  { id: "01-gtgt", code: "01/GTGT", name: "01/GTGT - Tờ khai thuế GTGT khấu trừ", cycle: "Theo tháng", group: "Thuế giá trị gia tăng", checked: true },
  { id: "02-gtgt", code: "02/GTGT", name: "02/GTGT - Tờ khai thuế GTGT dành cho dự án đầu tư", cycle: "Theo tháng", group: "Thuế giá trị gia tăng", checked: false },
  { id: "03-gtgt", code: "03/GTGT", name: "03/GTGT - Tờ khai thuế GTGT trực tiếp trên GTGT", cycle: "Theo tháng", group: "Thuế giá trị gia tăng", checked: false },

  // Thuế thu nhập cá nhân
  { id: "05-kk-tncn", code: "05/KK-TNCN", name: "05/KK-TNCN - Tờ khai thuế thu nhập cá nhân", cycle: "Theo tháng", group: "Thuế thu nhập cá nhân", checked: false },
  { id: "05-qtt-tncn", code: "05/QTT-TNCN", name: "05/QTT-TNCN - Tờ khai quyết toán thuế thu nhập cá nhân", cycle: "Theo năm", group: "Thuế thu nhập cá nhân", checked: true },
  { id: "tncn-detail", code: "DS-TNCN", name: "Danh sách chi tiết số tiền nộp thuế TNCN đã nộp thay cho từng cá nhân", cycle: "Theo từng lần phát sinh", group: "Thuế thu nhập cá nhân", checked: false },

  // Thuế thu nhập doanh nghiệp
  { id: "03-tndn", code: "03/TNDN", name: "03/TNDN - Tờ khai quyết toán thuế TNDN", cycle: "Theo năm", group: "Thuế thu nhập doanh nghiệp", checked: true },

  // Thuế tiêu thụ đặc biệt
  { id: "01-ttdb", code: "01/TTĐB", name: "01/TTĐB - Tờ khai thuế TTĐB", cycle: "Theo tháng", group: "Thuế tiêu thụ đặc biệt", checked: false },

  // Thuế tài nguyên
  { id: "01-tain", code: "01/TAIN", name: "01/TAIN - Tờ khai thuế tài nguyên", cycle: "Theo tháng", group: "Thuế tài nguyên", checked: false },
];

export default function MisaTaxWorkspace({
  company = { id: "cty-ha-noi", name: "Công ty TNHH Dịch vụ & Thương mại Hà Nội" },
  period = "2026-10",
  tab = "declarations",
  href = (path) => path,
  notify,
}: MisaTaxWorkspaceProps) {
  // Navigation helper
  const navigateTo = (tabName: string) => {
    const url = href(`/tax/${tabName}`);
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  // State: Tab 1 (Khai thuế)
  const [declarations, setDeclarations] = useState<DeclarationItem[]>(INITIAL_DECLARATIONS);
  const [selectAllDec, setSelectAllDec] = useState(false);

  const handleToggleDeclaration = (id: string) => {
    setDeclarations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, checked: !d.checked } : d))
    );
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setSelectAllDec(checked);
    setDeclarations((prev) => prev.map((d) => ({ ...d, checked })));
  };

  // State: Tab 2 (Giấy nộp tiền)
  const [taxCode, setTaxCode] = useState("0108923456");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isMtaxConnected, setIsMtaxConnected] = useState(false);

  // State: Tab 3 (Danh sách NCC có rủi ro)
  const [riskSearch, setRiskSearch] = useState("");

  // State: Tab 4 (Báo cáo)
  const [reportSearch, setReportSearch] = useState("");
  const [reportLanguage, setReportLanguage] = useState("Tiếng Việt");
  const [isTaxSectionOpen, setIsTaxSectionOpen] = useState(true);
  const [isReconSectionOpen, setIsReconSectionOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<string | null>(null);

  // Modals for Flyout Utilities
  const [showVatDeductionModal, setShowVatDeductionModal] = useState(false);
  const [showTaxPaymentModal, setShowTaxPaymentModal] = useState(false);
  const [showTaxAuthorityModal, setShowTaxAuthorityModal] = useState(false);

  // Check URL query parameters for flyout actions
  const location = useLocation();
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const action = searchParams.get("action");
    if (action === "vat-deduction") {
      setShowVatDeductionModal(true);
    } else if (action === "pay") {
      setShowTaxPaymentModal(true);
    } else if (action === "tax-authority-config") {
      setShowTaxAuthorityModal(true);
    }
  }, [location.search]);

  // Group declarations by group name
  const declarationGroups = [
    "Thuế giá trị gia tăng",
    "Thuế thu nhập cá nhân",
    "Thuế thu nhập doanh nghiệp",
    "Thuế tiêu thụ đặc biệt",
    "Thuế tài nguyên",
  ];

  // =========================================================================
  // RENDER POPUPS & MODALS
  // =========================================================================
  const renderModals = () => {
    return (
      <>
        {/* 1. Modal: Khấu trừ thuế GTGT */}
        {showVatDeductionModal && (
          <div className="misa-modal-overlay">
            <div className="misa-modal-card" style={{ width: 680, maxWidth: "95vw" }}>
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Calculator size={18} style={{ color: "#00a862" }} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                    Khấu trừ thuế GTGT đầu vào và đầu ra
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVatDeductionModal(false)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "12px 16px", borderRadius: 6, fontSize: 13, color: "#065f46" }}>
                  <strong>Kỳ tính thuế: Tháng 09/2026</strong>
                  <div style={{ marginTop: 4 }}>
                    Hệ thống tự động bù trừ giữa Thuế GTGT đầu ra (TK 33311) và Thuế GTGT đầu vào được khấu trừ (TK 1331).
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Thuế GTGT đầu vào còn được khấu trừ (TK 1331):</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#2563eb", marginTop: 4 }}>48.520.000 đ</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Thuế GTGT đầu ra phát sinh trong kỳ (TK 33311):</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#ea580c", marginTop: 4 }}>72.150.000 đ</div>
                  </div>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
                  <div style={{ fontSize: 12.5, color: "#334155", fontWeight: 600 }}>Số thuế GTGT khấu trừ trong kỳ:</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#00a862", marginTop: 4 }}>48.520.000 đ</div>
                  <div style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>
                    Số thuế GTGT còn phải nộp vào NSNN: <strong>23.630.000 đ</strong>
                  </div>
                </div>
              </div>

              <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowVatDeductionModal(false)}
                  style={{ height: 32, padding: "0 18px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    notify("Đã sinh chứng từ Khấu trừ thuế GTGT tháng 09/2026 thành công!");
                    setShowVatDeductionModal(false);
                  }}
                  style={{ height: 32, padding: "0 22px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Tạo chứng từ khấu trừ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Modal: Nộp thuế */}
        {showTaxPaymentModal && (
          <div className="misa-modal-overlay">
            <div className="misa-modal-card" style={{ width: 650, maxWidth: "95vw" }}>
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <DollarSign size={18} style={{ color: "#00a862" }} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                    Lập Giấy nộp tiền vào Ngân sách Nhà nước (NSNN)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTaxPaymentModal(false)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Phương thức nộp:</label>
                  <select style={{ width: "100%", height: 34, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}>
                    <option>Nộp thuế điện tử qua dịch vụ MISA mTax (Khuyên dùng)</option>
                    <option>Ủy nhiệm chi chuyển khoản qua Ngân hàng</option>
                    <option>Nộp tiền mặt tại Kho bạc / Ngân hàng thương mại</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12.5, color: "#374151", display: "block", marginBottom: 5 }}>Kho bạc Nhà nước hạch toán:</label>
                    <input type="text" defaultValue="KBNN Quận Cầu Giấy - Hà Nội" style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, color: "#374151", display: "block", marginBottom: 5 }}>Tài khoản thu NSNN (7111):</label>
                    <input type="text" defaultValue="7111.1054238 - KBNN Cầu Giấy" style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                  <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", height: 34, borderBottom: "1px solid #cbd5e1", color: "#475569" }}>
                        <th style={{ padding: "6px 10px", textAlign: "left" }}>Nội dung nộp NSNN</th>
                        <th style={{ padding: "6px 10px", textAlign: "center" }}>Tiểu mục</th>
                        <th style={{ padding: "6px 10px", textAlign: "right" }}>Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #f1f5f9", height: 34 }}>
                        <td style={{ padding: "6px 10px", fontWeight: 500 }}>Thuế GTGT hàng SXKD trong nước</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>1701</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>23.630.000 đ</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #f1f5f9", height: 34 }}>
                        <td style={{ padding: "6px 10px", fontWeight: 500 }}>Thuế Thu nhập doanh nghiệp tạm nộp</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>1052</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>15.000.000 đ</td>
                      </tr>
                      <tr style={{ background: "#f8fafc", height: 36, fontWeight: 700 }}>
                        <td colSpan={2} style={{ padding: "6px 10px", textAlign: "right" }}>TỔNG SỐ TIỀN NỘP:</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", color: "#00a862" }}>38.630.000 đ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowTaxPaymentModal(false)}
                  style={{ height: 32, padding: "0 18px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    notify("Đã lập Giấy nộp tiền vào NSNN thành công (Số tiền: 38.630.000đ)!");
                    setShowTaxPaymentModal(false);
                  }}
                  style={{ height: 32, padding: "0 22px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Lập giấy nộp tiền
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Modal: Thiết lập thông tin cơ quan thuế */}
        {showTaxAuthorityModal && (
          <div className="misa-modal-overlay">
            <div className="misa-modal-card" style={{ width: 600, maxWidth: "95vw" }}>
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Building2 size={18} style={{ color: "#00a862" }} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                    Thiết lập thông tin Cơ quan thuế quản lý
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTaxAuthorityModal(false)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Cục Thuế quản lý:</label>
                  <select style={{ width: "100%", height: 34, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}>
                    <option>001 - Cục Thuế Thành phố Hà Nội</option>
                    <option>002 - Cục Thuế Thành phố Hồ Chí Minh</option>
                    <option>003 - Cục Thuế Thành phố Đà Nẵng</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Chi cục Thuế quản lý trực tiếp:</label>
                  <select style={{ width: "100%", height: 34, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}>
                    <option>00109 - Chi cục Thuế Quận Cầu Giấy</option>
                    <option>00101 - Chi cục Thuế Quận Ba Đình</option>
                    <option>00103 - Chi cục Thuế Quận Đống Đa</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Đơn vị cung cấp dịch vụ đại lý thuế (nếu có):</label>
                  <input
                    type="text"
                    placeholder="Tên đại lý thuế hoặc tổ chức kê khai thay..."
                    style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowTaxAuthorityModal(false)}
                  style={{ height: 32, padding: "0 18px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    notify("Đã lưu thiết lập thông tin cơ quan thuế thành công!");
                    setShowTaxAuthorityModal(false);
                  }}
                  style={{ height: 32, padding: "0 22px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Lưu thiết lập
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Modal: Xem chi tiết báo cáo */}
        {previewReport && (
          <div className="misa-modal-overlay">
            <div className="misa-modal-card" style={{ width: 1000, maxWidth: "96vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{previewReport}</h3>
                  <span style={{ fontSize: 12.5, color: "#64748b" }}>Đơn vị: {company.name} • Kỳ tính thuế: Tháng 09/2026</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewReport(null)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: "10px 20px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => notify("Đang kết nối máy in để in báo cáo thuế...")}
                  style={{ height: 30, padding: "0 12px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                >
                  <Printer size={14} /> In báo cáo
                </button>
                <button
                  type="button"
                  onClick={() => notify("Xuất báo cáo thuế ra tệp Excel (.xlsx) thành công")}
                  style={{ height: 30, padding: "0 12px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                >
                  <Download size={14} /> Xuất Excel
                </button>
              </div>

              <div style={{ flex: 1, overflow: "auto", padding: "24px 30px", background: "#ffffff" }}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <h2 style={{ margin: "0 0 6px 0", fontSize: 17, fontWeight: 700, color: "#111827", textTransform: "uppercase" }}>{previewReport}</h2>
                  <div style={{ fontSize: 13, color: "#4b5563" }}>Kỳ tính thuế: Tháng 09 năm 2026</div>
                  <div style={{ fontSize: 12.5, color: "#6b7280", fontStyle: "italic", marginTop: 4 }}>Đơn vị tính: Đồng Việt Nam (VND)</div>
                </div>

                <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", border: "1px solid #cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", height: 36, borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>STT</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>Mã HĐ</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>Ngày HĐ</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>Tên người bán / đối tác</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>Mã số thuế</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>Doanh số chưa thuế</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>Thuế suất</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>Tiền thuế GTGT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>1</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", fontWeight: 600 }}>0001234</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>05/09/2026</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>Công ty Cổ phần MISA</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>0101243150</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>150.000.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>10%</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>15.000.000</td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>2</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", fontWeight: 600 }}>0005678</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>18/09/2026</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>Công ty TNHH Thiết bị Công nghiệp Việt Nhật</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>0106543210</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>335.200.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>10%</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>33.520.000</td>
                    </tr>
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td colSpan={5} style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "center" }}>TỔNG CỘNG</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right", color: "#111827" }}>485.200.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "center" }}>-</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right", color: "#00a862" }}>48.520.000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // 1. TAB: KHAI THUẾ (declarations) - Ảnh 1
  // =========================================================================
  if (tab === "declarations") {
    return (
      <div
        style={{
          background: "#ffffff",
          minHeight: "100%",
          padding: "24px 32px 48px 32px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Title */}
        <h2
          style={{
            margin: "0 0 20px 0",
            fontSize: 20,
            fontWeight: 700,
            color: "#1e293b",
          }}
        >
          Đăng ký tờ khai sử dụng
        </h2>

        {/* Table of declarations */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#e2ede6", height: 36, borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                <th style={{ width: 44, textAlign: "center", padding: "6px" }}>
                  <input
                    type="checkbox"
                    checked={selectAllDec}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16, cursor: "pointer" }}
                  />
                </th>
                <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "#1e293b" }}>
                  Tờ khai
                </th>
                <th style={{ width: 220, textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "#1e293b" }}>
                  Kỳ kê khai
                </th>
              </tr>
            </thead>
            <tbody>
              {declarationGroups.map((groupName) => {
                const groupItems = declarations.filter((d) => d.group === groupName);
                if (groupItems.length === 0) return null;

                return (
                  <Fragment key={groupName}>
                    {/* Group Header Row */}
                    <tr style={{ background: "#ffffff", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", height: 38 }}>
                      <td colSpan={3} style={{ padding: "8px 14px", fontWeight: 700, color: "#1e293b", fontSize: 13.5 }}>
                        {groupName}
                      </td>
                    </tr>

                    {/* Group Items */}
                    {groupItems.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => handleToggleDeclaration(item.id)}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          height: 38,
                          cursor: "pointer",
                          background: item.checked ? "#fafdfb" : "#ffffff",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = item.checked ? "#fafdfb" : "#ffffff")}
                      >
                        <td style={{ textAlign: "center", padding: "6px" }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleToggleDeclaration(item.id)}
                            style={{ accentColor: "#00a862", width: 16, height: 16, cursor: "pointer" }}
                          />
                        </td>
                        <td style={{ padding: "8px 12px", color: "#1e293b", fontWeight: item.checked ? 500 : 400 }}>
                          {item.name}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#475569" }}>
                          {item.cycle}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Button: Hoàn thành */}
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <button
            type="button"
            onClick={() => notify("Đã lưu đăng ký tờ khai sử dụng thành công!")}
            style={{
              height: 36,
              padding: "0 32px",
              background: "#00a862",
              color: "#ffffff",
              border: "none",
              borderRadius: 4,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0, 168, 98, 0.2)",
            }}
          >
            Hoàn thành
          </button>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 2. TAB: GIẤY NỘP TIỀN (payment-orders) - Ảnh 3
  // =========================================================================
  if (tab === "payment-orders") {
    return (
      <div
        style={{
          background: "#edf1f5",
          minHeight: "100%",
          padding: "24px 28px",
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: "1.25fr 0.95fr",
          gap: 20,
        }}
      >
        {/* Left Card: Form Kết nối MISA MTAX */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            padding: "48px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
          }}
        >
          {/* Logo MISA mTax */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* MISA round logo icon */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#0284c7",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 16 L4 18 C4 19.1 4.9 20 6 20 L6 20" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M9 12 L9 18 C9 19.1 9.9 20 11 20 L11 20" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M14 8 L14 18 C14 19.1 14.9 20 16 20 L16 20" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M19 4 L19 18 C19 19.1 19.9 20 20 20 L20 20" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
              MISA mTax
            </span>
          </div>

          {/* Heading */}
          <h2
            style={{
              margin: "24px 0 28px 0",
              fontSize: 18,
              fontWeight: 700,
              color: "#1e293b",
              textAlign: "center",
              letterSpacing: 0.2,
            }}
          >
            Kết nối MISA MTAX
          </h2>

          {/* Input Form */}
          <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Input 1: Mã số thuế */}
            <div>
              <input
                type="text"
                placeholder="Mã số thuế"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value)}
                style={{
                  width: "100%",
                  height: 38,
                  padding: "0 12px",
                  border: "1px solid #10b981",
                  borderRadius: 4,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Input 2: Email hoặc số điện thoại */}
            <div>
              <input
                type="text"
                placeholder="Email hoặc số điện thoại"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                style={{
                  width: "100%",
                  height: 38,
                  padding: "0 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Input 3: Mật khẩu */}
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  height: 38,
                  padding: "0 36px 0 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: 10,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: 0,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Subtext */}
            <div style={{ fontSize: 12.5, color: "#374151", textAlign: "center", marginTop: 4 }}>
              Bạn chưa có tài khoản <em>MISA MTAX</em>? Mua ngay{" "}
              <a
                href="#buy"
                onClick={(e) => {
                  e.preventDefault();
                  notify("Chuyển tới trang đăng ký dịch vụ MISA mTax");
                }}
                style={{ color: "#0073e6", textDecoration: "underline", fontWeight: 500 }}
              >
                tại đây
              </a>
            </div>

            {/* Button Kết nối */}
            <button
              type="button"
              onClick={() => {
                setIsMtaxConnected(true);
                notify("Kết nối dịch vụ thuế điện tử MISA mTax thành công!");
              }}
              style={{
                width: "100%",
                height: 38,
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 6,
                boxShadow: "0 2px 4px rgba(0, 168, 98, 0.25)",
              }}
            >
              {isMtaxConnected ? "Đã kết nối (Cập nhật lại)" : "Kết nối"}
            </button>
          </div>
        </div>

        {/* Right Card: Giới thiệu dịch vụ thuế điện tử */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            padding: "36px 32px",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
          {/* 3D Isometric Illustration */}
          <div style={{ width: "100%", height: 180, display: "grid", placeItems: "center" }}>
            <svg width="220" height="160" viewBox="0 0 220 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Floating connection lines */}
              <path d="M40 70 L90 50 M180 70 L130 50" stroke="#bae6fd" strokeWidth="1.5" strokeDasharray="3 3" />
              <path d="M110 50 L110 110" stroke="#bae6fd" strokeWidth="1.5" strokeDasharray="3 3" />

              {/* Central Laptop (3D view) */}
              <g transform="translate(68, 20)">
                {/* Screen frame */}
                <polygon points="42,0 84,20 42,42 0,22" fill="#0284c7" />
                <polygon points="42,2 80,20 42,39 4,21" fill="#38bdf8" />
                {/* Stand / Keyboard base */}
                <polygon points="0,22 42,42 84,20 42,3" fill="#0369a1" opacity="0.2" />
                <polygon points="42,42 84,20 84,26 42,48 0,28 0,22" fill="#0284c7" />
              </g>

              {/* Left Server Node */}
              <g transform="translate(18, 62)">
                <ellipse cx="22" cy="10" rx="18" ry="8" fill="#7dd3fc" />
                <path d="M4 10 L4 20 C4 24 12 28 22 28 C32 28 40 24 40 20 L40 10 Z" fill="#0284c7" />
                <ellipse cx="22" cy="20" rx="18" ry="8" fill="#38bdf8" />
                <path d="M4 20 L4 30 C4 34 12 38 22 38 C32 38 40 34 40 30 L40 20 Z" fill="#0369a1" />
                <ellipse cx="22" cy="30" rx="18" ry="8" fill="#0284c7" />
              </g>

              {/* Right Server Node */}
              <g transform="translate(158, 62)">
                <ellipse cx="22" cy="10" rx="18" ry="8" fill="#7dd3fc" />
                <path d="M4 10 L4 20 C4 24 12 28 22 28 C32 28 40 24 40 20 L40 10 Z" fill="#0284c7" />
                <ellipse cx="22" cy="20" rx="18" ry="8" fill="#38bdf8" />
                <path d="M4 20 L4 30 C4 34 12 38 22 38 C32 38 40 34 40 30 L40 20 Z" fill="#0369a1" />
                <ellipse cx="22" cy="30" rx="18" ry="8" fill="#0284c7" />
              </g>

              {/* Center Main Database Stack */}
              <g transform="translate(85, 85)">
                <ellipse cx="26" cy="12" rx="26" ry="10" fill="#e0f2fe" />
                <ellipse cx="26" cy="12" rx="22" ry="8" fill="#38bdf8" />
                <path d="M4 12 L4 26 C4 32 14 36 26 36 C38 36 48 32 48 26 L48 12 Z" fill="#0284c7" />
                <ellipse cx="26" cy="26" rx="22" ry="8" fill="#7dd3fc" />
                <path d="M4 26 L4 40 C4 46 14 50 26 50 C38 50 48 46 48 40 L48 26 Z" fill="#0369a1" />
                <ellipse cx="26" cy="40" rx="22" ry="8" fill="#0284c7" />
              </g>

              {/* Small floating sparkles */}
              <circle cx="34" cy="48" r="3" fill="#f59e0b" />
              <circle cx="186" cy="45" r="2.5" fill="#f59e0b" />
              <circle cx="108" cy="148" r="2" fill="#0284c7" />
            </svg>
          </div>

          {/* Heading */}
          <h3
            style={{
              margin: "16px 0 8px 0",
              fontSize: 16,
              fontWeight: 700,
              color: "#1e293b",
            }}
          >
            Dịch vụ thuế điện tử MISA mTax
          </h3>

          {/* Subtitle */}
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#475569", lineHeight: 1.45 }}>
            Kê khai, nộp thuế thuận tiện, nhanh chóng hơn với MISA mTax
          </p>

          {/* Bullets */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "#00a862", fontWeight: 700 }}>•</span>
              <span>
                Đáp ứng đầy đủ mọi nghiệp vụ kê khai, nộp thuế cho Doanh nghiệp và Cá nhân (doanh nghiệp kê khai hộ)
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "#00a862", fontWeight: 700 }}>•</span>
              <span>Tích hợp ngay trên phần mềm kế toán MISA</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "#00a862", fontWeight: 700 }}>•</span>
              <span>Đã được Tổng Cục Thuế cấp phép</span>
            </div>
          </div>

          {/* Link Xem thêm */}
          <div style={{ marginTop: 18 }}>
            <span
              onClick={() => notify("Mở trang thông tin giới thiệu chi tiết MISA mTax")}
              style={{
                color: "#0073e6",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              Xem thêm
            </span>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 3. TAB: DANH SÁCH NCC CÓ RỦI RO (risk-suppliers) - Ảnh 4
  // =========================================================================
  if (tab === "risk-suppliers") {
    return (
      <div
        style={{
          background: "#ffffff",
          minHeight: "100%",
          padding: "16px 20px 24px 20px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          {/* Left search */}
          <div style={{ position: "relative", width: 220 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Tìm kiếm"
              value={riskSearch}
              onChange={(e) => setRiskSearch(e.target.value)}
              style={{
                width: "100%",
                height: 32,
                padding: "0 10px 0 30px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Right action icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => notify("Đang đồng bộ dữ liệu tra cứu rủi ro nhà cung cấp từ Tổng cục Thuế...")}
              title="Lấy lại dữ liệu"
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#475569",
              }}
            >
              <RotateCw size={14} />
            </button>
            <button
              type="button"
              onClick={() => notify("Xuất danh sách nhà cung cấp rủi ro ra Excel")}
              title="In / Xuất dữ liệu"
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#475569",
              }}
            >
              <Printer size={14} />
            </button>
          </div>
        </div>

        {/* Table container */}
        <div
          style={{
            flex: 1,
            minHeight: "calc(100vh - 180px)",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header Row */}
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#e2ede6", height: 36, borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", width: 150, fontWeight: 700 }}>
                  Mã nhà cung cấp
                </th>
                <th style={{ textAlign: "left", padding: "8px 12px", width: 240, fontWeight: 700 }}>
                  Tên nhà cung cấp
                </th>
                <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700 }}>
                  Địa chỉ
                </th>
                <th style={{ textAlign: "left", padding: "8px 12px", width: 140, fontWeight: 700 }}>
                  Mã số thuế
                </th>
                <th style={{ textAlign: "left", padding: "8px 12px", width: 160, fontWeight: 700 }}>
                  Rủi ro về hóa đơn
                </th>
                <th style={{ textAlign: "center", padding: "8px 12px", width: 100, fontWeight: 700 }}>
                  Chức năng
                </th>
              </tr>
            </thead>
          </table>

          {/* Empty Body with Magnifying Glass Illustration (matching Image 4) */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 20px",
              background: "#ffffff",
            }}
          >
            {/* SVG Magnifying Glass Illustration */}
            <div style={{ width: 140, height: 100, position: "relative" }}>
              <svg width="140" height="100" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Background soft shadow lines */}
                <line x1="30" y1="35" x2="110" y2="35" stroke="#f1f5f9" strokeWidth="6" strokeLinecap="round" />
                <line x1="20" y1="50" x2="90" y2="50" stroke="#f1f5f9" strokeWidth="6" strokeLinecap="round" />
                <line x1="40" y1="65" x2="120" y2="65" stroke="#f1f5f9" strokeWidth="6" strokeLinecap="round" />

                {/* Sparkling green dots */}
                <circle cx="28" cy="28" r="1.5" fill="#00a862" opacity="0.6" />
                <circle cx="112" cy="38" r="2" fill="#00a862" opacity="0.7" />
                <circle cx="106" cy="68" r="1.5" fill="#00a862" opacity="0.6" />

                {/* Magnifying Glass Outer Rim */}
                <circle cx="68" cy="44" r="20" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2.5" />
                {/* Lens lines (document preview) */}
                <line x1="61" y1="38" x2="75" y2="38" stroke="#00a862" strokeWidth="2" strokeLinecap="round" />
                <line x1="61" y1="44" x2="75" y2="44" stroke="#00a862" strokeWidth="2" strokeLinecap="round" />
                <line x1="61" y1="50" x2="71" y2="50" stroke="#00a862" strokeWidth="2" strokeLinecap="round" />

                {/* Magnifier Handle */}
                <path d="M82 58 L92 72" stroke="#00a862" strokeWidth="4.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Text */}
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
              Không có dữ liệu
            </div>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 4. TAB: BÁO CÁO (reports) - Ảnh 5
  // =========================================================================
  return (
    <div
      style={{
        background: "#ffffff",
        minHeight: "100%",
        padding: "16px 20px 32px 20px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Filter Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Left: Search input + AVA AI Link */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 230 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Tìm theo tên báo cáo"
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              style={{
                width: "100%",
                height: 32,
                padding: "0 10px 0 30px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div
            onClick={() => notify("Mở trợ lý AVA AI để tìm kiếm và lập báo cáo thuế thông minh")}
            style={{
              color: "#2563eb",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 500,
            }}
          >
            <span>Tìm kiếm nhanh báo cáo với AVA Kế toán</span>
            <span style={{ fontSize: 14 }}>🤖</span>
          </div>
        </div>

        {/* Right: Ngôn ngữ báo cáo & Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
            <span>Ngôn ngữ báo cáo</span>
            <div style={{ position: "relative", width: 110 }}>
              <select
                value={reportLanguage}
                onChange={(e) => setReportLanguage(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  padding: "0 22px 0 10px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  background: "#ffffff",
                  appearance: "none",
                  cursor: "pointer",
                }}
              >
                <option value="Tiếng Việt">Tiếng Việt</option>
                <option value="English">English</option>
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: 6, top: 9, color: "#64748b", pointerEvents: "none" }} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => notify("Thiết lập ẩn/hiện các cột báo cáo thuế")}
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              color: "#334155",
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
          >
            <SlidersHorizontal size={14} />
            <span>Ẩn/hiện báo cáo</span>
          </button>

          <button
            type="button"
            title="Đổi dạng hiển thị"
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "#475569",
            }}
          >
            <div style={{ width: 14, height: 14, border: "1.5px solid #64748b", borderRadius: 2 }} />
          </button>
        </div>
      </div>

      {/* Accordion List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Accordion 1: THUẾ (matching Image 5) */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
          {/* Header */}
          <div
            onClick={() => setIsTaxSectionOpen(!isTaxSectionOpen)}
            style={{
              padding: "10px 16px",
              background: "#f8fafc",
              borderBottom: isTaxSectionOpen ? "1px solid #e2e8f0" : "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Thuế</span>
            {isTaxSectionOpen ? (
              <ChevronUp size={16} style={{ color: "#64748b" }} />
            ) : (
              <ChevronDown size={16} style={{ color: "#64748b" }} />
            )}
          </div>

          {/* Content 2 columns */}
          {isTaxSectionOpen && (
            <div style={{ padding: "8px 16px" }}>
              {/* Row 1 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, borderBottom: "1px solid #f1f5f9" }}>
                {/* Col 1 */}
                <div
                  onClick={() => setPreviewReport("Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ mua vào (Mẫu quản trị)")}
                  style={{
                    padding: "10px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#334155",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                >
                  <span>Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ mua vào (Mẫu quản trị)</span>
                  {/* Report icon */}
                  <div style={{ width: 18, height: 18, border: "1.5px solid #94a3b8", borderRadius: 3, display: "grid", placeItems: "center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                      <path d="M3 3v18h18" />
                      <path d="M18 17V9" />
                      <path d="M13 17V5" />
                      <path d="M8 17v-3" />
                    </svg>
                  </div>
                </div>

                {/* Col 2 */}
                <div
                  onClick={() => setPreviewReport("Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ bán ra (Mẫu quản trị)")}
                  style={{
                    padding: "10px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#334155",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                >
                  <span>Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ bán ra (Mẫu quản trị)</span>
                  <div style={{ width: 18, height: 18, border: "1.5px solid #94a3b8", borderRadius: 3, display: "grid", placeItems: "center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                      <path d="M3 3v18h18" />
                      <path d="M18 17V9" />
                      <path d="M13 17V5" />
                      <path d="M8 17v-3" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Col 1 */}
                <div
                  onClick={() => setPreviewReport("02/TNDN: Bảng kê thu mua hàng hóa, dịch vụ mua vào không có hóa đơn")}
                  style={{
                    padding: "10px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#334155",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                >
                  <span>02/TNDN: Bảng kê thu mua hàng hóa, dịch vụ mua vào không có hóa đơn</span>
                  <div style={{ width: 18, height: 18, border: "1.5px solid #94a3b8", borderRadius: 3, display: "grid", placeItems: "center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                      <path d="M3 3v18h18" />
                      <path d="M18 17V9" />
                      <path d="M13 17V5" />
                      <path d="M8 17v-3" />
                    </svg>
                  </div>
                </div>

                {/* Col 2 */}
                <div
                  onClick={() => setPreviewReport("Bảng tổng hợp quyết toán thuế GTGT năm")}
                  style={{
                    padding: "10px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#334155",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                >
                  <span>Bảng tổng hợp quyết toán thuế GTGT năm</span>
                  <div style={{ width: 18, height: 18, border: "1.5px solid #94a3b8", borderRadius: 3, display: "grid", placeItems: "center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                      <path d="M3 3v18h18" />
                      <path d="M18 17V9" />
                      <path d="M13 17V5" />
                      <path d="M8 17v-3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 2: BÁO CÁO ĐỐI CHIẾU (matching Image 5) */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
          {/* Header */}
          <div
            onClick={() => setIsReconSectionOpen(!isReconSectionOpen)}
            style={{
              padding: "10px 16px",
              background: "#f8fafc",
              borderBottom: isReconSectionOpen ? "1px solid #e2e8f0" : "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Báo cáo đối chiếu</span>
            {isReconSectionOpen ? (
              <ChevronUp size={16} style={{ color: "#64748b" }} />
            ) : (
              <ChevronDown size={16} style={{ color: "#64748b" }} />
            )}
          </div>

          {/* Content */}
          {isReconSectionOpen && (
            <div style={{ padding: "8px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div
                  onClick={() => setPreviewReport("Bảng đối chiếu bảng kê thuế GTGT và sổ cái")}
                  style={{
                    padding: "10px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#334155",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                >
                  <span>Bảng đối chiếu bảng kê thuế GTGT và sổ cái</span>
                  <div style={{ width: 18, height: 18, border: "1.5px solid #94a3b8", borderRadius: 3, display: "grid", placeItems: "center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                      <path d="M3 3v18h18" />
                      <path d="M18 17V9" />
                      <path d="M13 17V5" />
                      <path d="M8 17v-3" />
                    </svg>
                  </div>
                </div>

                <div
                  onClick={() => setPreviewReport("Bảng đối chiếu số thuế đã nộp và số thuế phải nộp")}
                  style={{
                    padding: "10px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#334155",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                >
                  <span>Bảng đối chiếu số thuế đã nộp và số thuế phải nộp</span>
                  <div style={{ width: 18, height: 18, border: "1.5px solid #94a3b8", borderRadius: 3, display: "grid", placeItems: "center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                      <path d="M3 3v18h18" />
                      <path d="M18 17V9" />
                      <path d="M13 17V5" />
                      <path d="M8 17v-3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {renderModals()}
    </div>
  );
}
