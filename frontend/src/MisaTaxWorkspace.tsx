import { useState, useEffect, Fragment } from "react";
import { apiDate, useMisaApiLists, useMisaApiSave } from "./misa-api-lists";
import { createApiWriter, errorText, saveVatDeduction, vatPosition } from "./misa-api-writes";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { useLocation } from "react-router-dom";
import { MisaTaxReportModal } from "./MisaTaxReportModal";
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
  const { rows: apiRows, connected: apiConnected, reload: reloadApi } = useMisaApiLists(company.id, {
    filings: "/api/v1/tax/filings/",
    obligations: "/api/v1/tax/obligations/",
    cashPayments: "/api/v1/cash/transactions/",
    bankPayments: "/api/v1/bank/transactions/",
  }, notify);
  const apiSave = useMisaApiSave(company.id, notify, reloadApi);
  const { token: apiToken } = useApiSession();
  const [vat, setVat] = useState<Awaited<ReturnType<typeof vatPosition>> | null>(null);
  const vatMoney = (value: number | undefined, sample: string) => (vat ? `${Math.round(value || 0).toLocaleString("vi-VN")} đ` : sample);
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
  const [authority, setAuthority] = useState({ department: "001 - Cục Thuế Thành phố Hà Nội", branchOffice: "00109 - Chi cục Thuế Quận Cầu Giấy", taxAgent: "" });
  const authorityUrl = `/api/v1/tax/authority-settings/?company_id=${encodeURIComponent(company.id)}`;
  // Managing tax office and registered declaration forms are stored on the backend.
  useEffect(() => {
    if (!apiConnected || !apiToken) return;
    request<any>(authorityUrl, apiToken).then((data) => {
      if (data.branch_office) setAuthority({ department: data.department, branchOffice: data.branch_office, taxAgent: data.tax_agent || "" });
      const codes = new Set((data.registered_forms || []).map((row: any) => row.code));
      if (codes.size) setDeclarations((prev) => prev.map((row) => ({ ...row, checked: codes.has(row.code) })));
    }).catch((error) => notify(`Không tải được thiết lập cơ quan thuế: ${errorText(error)}`));
  }, [apiConnected, apiToken, authorityUrl]);
  const saveAuthority = async (body: Record<string, unknown>, message: string) => {
    if (!apiConnected || !apiToken) { notify(message); return true; }
    try {
      await request(authorityUrl, apiToken, { method: "PUT", body: JSON.stringify({ company: company.id, ...body }) });
      notify(message);
      return true;
    } catch (error) {
      notify(`Không lưu được: ${errorText(error)}`);
      return false;
    }
  };

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

  // State: Tab 3 (Danh sách NCC có rủi ro)
  const [riskSearch, setRiskSearch] = useState("");

  // State: Tab 4 (Báo cáo)
  const [reportSearch, setReportSearch] = useState("");
  const [reportLanguage, setReportLanguage] = useState("Tiếng Việt");
  const [isTaxSectionOpen, setIsTaxSectionOpen] = useState(true);
  const [isReconSectionOpen, setIsReconSectionOpen] = useState(true);
  const [isLegalSectionOpen, setIsLegalSectionOpen] = useState(true);
  const [taxCategoryFilter, setTaxCategoryFilter] = useState("ALL");
  const [previewReport, setPreviewReport] = useState<string | null>(null);
  const [activeTaxReport, setActiveTaxReport] = useState<{
    reportCode: string;
    reportName: string;
    category?: string;
    taxType?: string;
  } | null>(null);

  // Modals for Flyout Utilities
  const [showVatDeductionModal, setShowVatDeductionModal] = useState(false);
  useEffect(() => {
    if (!showVatDeductionModal || !apiConnected || !apiToken) return;
    vatPosition(createApiWriter(company.id, (path, init) => request(path, apiToken, init)), new Date().toLocaleDateString("en-GB"))
      .then(setVat)
      .catch((error) => notify(`Không lấy được số thuế GTGT: ${errorText(error)}`));
  }, [showVatDeductionModal, apiConnected, apiToken, company.id]);
  const [showTaxPaymentModal, setShowTaxPaymentModal] = useState(false);
  const [selectedObligation, setSelectedObligation] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const openObligations = (apiRows.obligations || []).filter((row) => Number(row.outstanding_amount) > 0);
  const postedPayments: { id: string; number: string; amount: number; source: "CASH" | "BANK" }[] = [
    ...(apiRows.cashPayments || []).filter((row) => row.status === "POSTED" && row.transaction_type === "PAYMENT").map((row) => ({ id: String(row.id), number: String(row.number), amount: Number(row.amount), source: "CASH" as const })),
    ...(apiRows.bankPayments || []).filter((row) => row.status === "POSTED" && row.transaction_type === "PAYMENT").map((row) => ({ id: String(row.id), number: String(row.number), amount: Number(row.amount), source: "BANK" as const })),
  ];
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
                  <strong>Kỳ tính thuế: {vat ? `Tháng ${vat.periodCode.slice(5, 7)}/${vat.periodCode.slice(0, 4)}` : "Tháng 09/2026"}</strong>
                  <div style={{ marginTop: 4 }}>
                    Hệ thống tự động bù trừ giữa Thuế GTGT đầu ra (TK 33311) và Thuế GTGT đầu vào được khấu trừ (TK 1331).
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Thuế GTGT đầu vào còn được khấu trừ (TK 1331):</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#2563eb", marginTop: 4 }}>{vatMoney(vat?.input, "48.520.000 đ")}</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Thuế GTGT đầu ra phát sinh trong kỳ (TK 33311):</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#ea580c", marginTop: 4 }}>{vatMoney(vat?.output, "72.150.000 đ")}</div>
                  </div>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
                  <div style={{ fontSize: 12.5, color: "#334155", fontWeight: 600 }}>Số thuế GTGT khấu trừ trong kỳ:</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#00a862", marginTop: 4 }}>{vatMoney(vat?.deductible, "48.520.000 đ")}</div>
                  <div style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>
                    Số thuế GTGT còn phải nộp vào NSNN: <strong>{vatMoney(vat?.payable, "23.630.000 đ")}</strong>
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
                  onClick={async () => {
                    if (apiConnected) {
                      if (await apiSave((writer) => saveVatDeduction(writer, new Date().toLocaleDateString("en-GB")))) setShowVatDeductionModal(false);
                      return;
                    }
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
                    {apiConnected ? "Ghi nhận tiền nộp NSNN" : "Lập Giấy nộp tiền vào Ngân sách Nhà nước (NSNN)"}
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
                {!apiConnected && <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Phương thức nộp:</label>
                  <select style={{ width: "100%", height: 34, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}>
                    <option>Nộp thuế điện tử qua dịch vụ Sổ Việt eTax (Khuyên dùng)</option>
                    <option>Ủy nhiệm chi chuyển khoản qua Ngân hàng</option>
                    <option>Nộp tiền mặt tại Kho bạc / Ngân hàng thương mại</option>
                  </select>
                </div>}

                {!apiConnected && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12.5, color: "#374151", display: "block", marginBottom: 5 }}>Kho bạc Nhà nước hạch toán:</label>
                    <input type="text" defaultValue="KBNN Quận Cầu Giấy - Hà Nội" style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, color: "#374151", display: "block", marginBottom: 5 }}>Tài khoản thu NSNN (7111):</label>
                    <input type="text" defaultValue="7111.1054238 - KBNN Cầu Giấy" style={{ width: "100%", height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>}

                {apiConnected && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12.5 }}>
                  <label>Nghĩa vụ thuế còn phải nộp
                    <select value={selectedObligation} onChange={(event) => {
                      setSelectedObligation(event.target.value);
                      const obligation = openObligations.find((row) => row.id === event.target.value);
                      setPaymentAmount(Number(obligation?.outstanding_amount || 0));
                    }} style={{ width: "100%", height: 34, border: "1px solid #cbd5e1", borderRadius: 4 }}>
                      <option value="">Chọn nghĩa vụ thuế</option>
                      {openObligations.map((row) => <option key={row.id} value={row.id}>{row.tax_type} · {row.period_code} · {Number(row.outstanding_amount).toLocaleString("vi-VN")} đ</option>)}
                    </select>
                  </label>
                  <label>Chứng từ thanh toán đã ghi sổ
                    <select value={selectedPayment} onChange={(event) => setSelectedPayment(event.target.value)} style={{ width: "100%", height: 34, border: "1px solid #cbd5e1", borderRadius: 4 }}>
                      <option value="">Chọn chứng từ</option>
                      {postedPayments.map((row) => <option key={row.id} value={`${row.source}:${row.id}`}>{row.number} · {Number(row.amount).toLocaleString("vi-VN")} đ</option>)}
                    </select>
                  </label>
                  <label>Số tiền ghi nhận
                    <input type="number" min="0" value={paymentAmount} onChange={(event) => setPaymentAmount(Number(event.target.value))} style={{ width: "100%", height: 34, border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box" }} />
                  </label>
                  <label>Số tham chiếu giấy nộp tiền
                    <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} style={{ width: "100%", height: 34, border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box" }} />
                  </label>
                  <div style={{ gridColumn: "1 / -1", color: "#64748b" }}>Ghi nhận thanh toán thuế từ chứng từ đã ghi sổ. API hiện chưa phát hành giấy nộp tiền điện tử.</div>
                </div>}
                {!apiConnected && <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
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
                </div>}
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
                    if (apiConnected) {
                      void apiSave(async (writer) => {
                        const obligation = openObligations.find((row) => row.id === selectedObligation);
                        const payment = postedPayments.find((row) => `${row.source}:${row.id}` === selectedPayment);
                        if (!obligation || !payment) throw new Error("Chọn nghĩa vụ thuế và chứng từ thanh toán đã ghi sổ.");
                        if (!(paymentAmount > 0) || paymentAmount > Number(obligation.outstanding_amount) || paymentAmount > Number(payment.amount)) throw new Error("Số tiền ghi nhận không hợp lệ.");
                        const link = await writer.action("/api/v1/tax/obligations/", obligation.id, "link-payment", {
                          source_module: payment.source, transaction_id: payment.id,
                          amount: String(paymentAmount), reference: paymentReference,
                          payment_date: new Date().toISOString().slice(0, 10),
                        });
                        setShowTaxPaymentModal(false);
                        return { record: link, message: `Đã ghi nhận nộp ${paymentAmount.toLocaleString("vi-VN")} đ cho nghĩa vụ thuế ${obligation.tax_type}.` };
                      });
                      return;
                    }
                    notify("Đã lập Giấy nộp tiền vào NSNN thành công (Số tiền: 38.630.000đ)!");
                    setShowTaxPaymentModal(false);
                  }}
                  style={{ height: 32, padding: "0 22px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  {apiConnected ? "Ghi nhận thanh toán thuế" : "Lập giấy nộp tiền"}
                </button>
                {apiConnected && <button
                  type="button"
                  onClick={() => void apiSave(async (writer) => {
                    const obligation = openObligations.find((row) => row.id === selectedObligation);
                    if (!obligation) throw new Error("Chọn nghĩa vụ thuế cần nộp.");
                    const queued = await writer.action("/api/v1/tax/obligations/", obligation.id, "e-payment", {
                      amount: String(paymentAmount || obligation.outstanding_amount),
                    });
                    setShowTaxPaymentModal(false);
                    return { record: queued, message: `Đã lập giấy nộp tiền điện tử ${Number(queued.request_payload?.amount || 0).toLocaleString("vi-VN")} đ, đang chờ cổng thuế điện tử xử lý.` };
                  })}
                  style={{ height: 32, padding: "0 18px", background: "#ffffff", color: "#00a862", border: "1px solid #00a862", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Lập giấy nộp tiền điện tử
                </button>}
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
                  <select value={authority.department} onChange={(e) => setAuthority((prev) => ({ ...prev, department: e.target.value }))} style={{ width: "100%", height: 34, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}>
                    <option>001 - Cục Thuế Thành phố Hà Nội</option>
                    <option>002 - Cục Thuế Thành phố Hồ Chí Minh</option>
                    <option>003 - Cục Thuế Thành phố Đà Nẵng</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Chi cục Thuế quản lý trực tiếp:</label>
                  <select value={authority.branchOffice} onChange={(e) => setAuthority((prev) => ({ ...prev, branchOffice: e.target.value }))} style={{ width: "100%", height: 34, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}>
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
                    value={authority.taxAgent}
                    onChange={(e) => setAuthority((prev) => ({ ...prev, taxAgent: e.target.value }))}
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
                  onClick={async () => {
                    const saved = await saveAuthority(
                      { department: authority.department, branch_office: authority.branchOffice, tax_agent: authority.taxAgent },
                      "Đã lưu thiết lập thông tin cơ quan thuế thành công!",
                    );
                    if (saved) setShowTaxAuthorityModal(false);
                  }}
                  style={{ height: 32, padding: "0 22px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Lưu thiết lập
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Modal: Xem chi tiết báo cáo thuế qua UC-RPT-07 Engine & MisaTaxReportModal */}
        {activeTaxReport && (
          <MisaTaxReportModal
            reportCode={activeTaxReport.reportCode}
            reportName={activeTaxReport.reportName}
            category={activeTaxReport.category}
            taxType={activeTaxReport.taxType}
            company={company}
            isOpen={Boolean(activeTaxReport)}
            onClose={() => setActiveTaxReport(null)}
            notify={notify}
          />
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

        <h2 style={{ margin: "28px 0 16px", fontSize: 20, fontWeight: 700, color: "#1e293b" }}>
          Tờ khai đã lập
        </h2>
        <div style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#e2ede6", height: 36, color: "#334155" }}>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Loại tờ khai</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Kỳ thuế</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Ngày lập</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Trạng thái</th>
            </tr></thead>
            <tbody>{(apiRows.filings || []).map((filing) => (
              <tr key={filing.id} style={{ borderTop: "1px solid #e2e8f0", height: 38 }}>
                <td style={{ padding: "8px 12px" }}>{filing.filing_type}</td>
                <td style={{ padding: "8px 12px" }}>{filing.period_code}</td>
                <td style={{ padding: "8px 12px" }}>{apiDate(filing.created_at)}</td>
                <td style={{ padding: "8px 12px" }}>{filing.status}</td>
              </tr>
            ))}{!apiRows.filings?.length && <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>Chưa có tờ khai</td></tr>}</tbody>
          </table>
        </div>

        {/* Bottom Button: Hoàn thành */}
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <button
            type="button"
            onClick={() => void saveAuthority({
              registered_forms: declarations.filter((row) => row.checked).map((row) => ({ code: row.code, name: row.name, frequency: row.cycle })),
            }, "Đã lưu đăng ký tờ khai sử dụng thành công!")}
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
        {/* Left Card: Form Kết nối Sổ Việt eTax */}
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
          {/* Logo Sổ Việt eTax */}
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
              Sổ Việt eTax
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
            Kết nối Sổ Việt eTax
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
              Bạn chưa có tài khoản <em>Sổ Việt eTax</em>? Mua ngay{" "}
              <a
                href="#buy"
                onClick={(e) => {
                  e.preventDefault();
                  notify("Chuyển tới trang đăng ký dịch vụ Sổ Việt eTax");
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
                notify("Dịch vụ thuế điện tử Sổ Việt eTax đang ở chế độ xem trước.");
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
              Kết nối
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
            Dịch vụ thuế điện tử Sổ Việt eTax
          </h3>

          {/* Subtitle */}
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#475569", lineHeight: 1.45 }}>
            Kê khai, nộp thuế thuận tiện, nhanh chóng hơn với Sổ Việt eTax
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
              <span>Tích hợp ngay trên phần mềm kế toán Sổ Việt ERP</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "#00a862", fontWeight: 700 }}>•</span>
              <span>Đã được Tổng Cục Thuế cấp phép</span>
            </div>
          </div>

          {/* Link Xem thêm */}
          <div style={{ marginTop: 18 }}>
            <span
              onClick={() => notify("Mở trang thông tin giới thiệu chi tiết Sổ Việt eTax")}
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
        {/* Left: Search input + Sổ Việt AI Link */}
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
            onClick={() => notify("Mở trợ lý Sổ Việt AI để tìm kiếm và lập báo cáo thuế thông minh")}
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
            <span>Tìm kiếm nhanh báo cáo với Sổ Việt AI</span>
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
        {/* Accordion 1: BÁO CÁO QUẢN TRỊ THUẾ (7 Báo cáo) */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Báo cáo quản trị thuế</span>
              <span style={{ fontSize: 11.5, background: "#e2e8f0", color: "#475569", padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>7 báo cáo</span>
            </div>
            {isTaxSectionOpen ? (
              <ChevronUp size={16} style={{ color: "#64748b" }} />
            ) : (
              <ChevronDown size={16} style={{ color: "#64748b" }} />
            )}
          </div>

          {isTaxSectionOpen && (
            <div style={{ padding: "8px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { code: "RPT-0003", title: "Báo cáo tình hình thực hiện nghĩa vụ với Nhà nước", taxType: "ALL" },
                  { code: "RPT-0175", title: "Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ mua vào (Mẫu quản trị)", taxType: "VAT" },
                  { code: "RPT-0176", title: "Bảng tổng hợp quyết toán thuế GTGT năm", taxType: "VAT" },
                  { code: "RPT-0177", title: "02/TNDN: Bảng kê thu mua hàng hóa, dịch vụ mua vào không có hóa đơn", taxType: "CIT" },
                  { code: "RPT-0179", title: "Bảng kê hóa đơn, chứng từ hàng hóa, dịch vụ bán ra (Mẫu quản trị)", taxType: "VAT" },
                  { code: "RPT-TAX-14", title: "Báo cáo rủi ro hóa đơn và cảnh báo thuế đối tác", taxType: "ALL" },
                  { code: "RPT-TAX-15", title: "Lịch sử và trạng thái nộp tờ khai thuế điện tử (eTax/HTKK)", taxType: "ALL" },
                ]
                  .filter((it) => !reportSearch || it.title.toLowerCase().includes(reportSearch.toLowerCase()) || it.code.toLowerCase().includes(reportSearch.toLowerCase()))
                  .map((item) => (
                    <div
                      key={item.code}
                      onClick={() => setActiveTaxReport({ reportCode: item.code, reportName: item.title, category: "MANAGEMENT_REPORT", taxType: item.taxType })}
                      style={{
                        padding: "10px 10px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#334155",
                        borderBottom: "1px solid #f8fafc",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, padding: "2px 6px", background: "#f1f5f9", borderRadius: 3, fontWeight: 700, color: "#475569" }}>{item.code}</span>
                        <span>{item.title}</span>
                      </div>
                      <div style={{ width: 18, height: 18, border: "1.5px solid #94a3b8", borderRadius: 3, display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                          <path d="M3 3v18h18" />
                          <path d="M18 17V9" />
                          <path d="M13 17V5" />
                          <path d="M8 17v-3" />
                        </svg>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Accordion 2: BÁO CÁO ĐỐI CHIẾU THUẾ (4 Báo cáo) */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Báo cáo đối chiếu thuế</span>
              <span style={{ fontSize: 11.5, background: "#e2e8f0", color: "#475569", padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>4 báo cáo</span>
            </div>
            {isReconSectionOpen ? (
              <ChevronUp size={16} style={{ color: "#64748b" }} />
            ) : (
              <ChevronDown size={16} style={{ color: "#64748b" }} />
            )}
          </div>

          {isReconSectionOpen && (
            <div style={{ padding: "8px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { code: "RPT-0178", title: "Báo cáo đối chiếu bảng kê thuế GTGT và sổ cái", taxType: "VAT" },
                  { code: "RPT-0180", title: "Đối chiếu thông tin hóa đơn trên bảng kê mua vào và chứng từ", taxType: "VAT" },
                  { code: "RPT-TAX-12", title: "Báo cáo đối chiếu nghĩa vụ thuế phát sinh và sổ cái", taxType: "ALL" },
                  { code: "RPT-TAX-13", title: "Báo cáo đối chiếu khấu trừ thuế TNCN và chi phí tiền lương", taxType: "PIT" },
                ]
                  .filter((it) => !reportSearch || it.title.toLowerCase().includes(reportSearch.toLowerCase()) || it.code.toLowerCase().includes(reportSearch.toLowerCase()))
                  .map((item) => (
                    <div
                      key={item.code}
                      onClick={() => setActiveTaxReport({ reportCode: item.code, reportName: item.title, category: "RECONCILIATION_REPORT", taxType: item.taxType })}
                      style={{
                        padding: "10px 10px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#334155",
                        borderBottom: "1px solid #f8fafc",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, padding: "2px 6px", background: "#fef3c7", borderRadius: 3, fontWeight: 700, color: "#92400e" }}>{item.code}</span>
                        <span>{item.title}</span>
                      </div>
                      <div style={{ width: 18, height: 18, border: "1.5px solid #94a3b8", borderRadius: 3, display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                          <path d="M3 3v18h18" />
                          <path d="M18 17V9" />
                          <path d="M13 17V5" />
                          <path d="M8 17v-3" />
                        </svg>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Accordion 3: BIỂU MẪU TỜ KHAI PHÁP LÝ (4 Báo cáo) */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
          <div
            onClick={() => setIsLegalSectionOpen(!isLegalSectionOpen)}
            style={{
              padding: "10px 16px",
              background: "#f8fafc",
              borderBottom: isLegalSectionOpen ? "1px solid #e2e8f0" : "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Biểu mẫu tờ khai pháp lý</span>
              <span style={{ fontSize: 11.5, background: "#e2e8f0", color: "#475569", padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>4 biểu mẫu</span>
            </div>
            {isLegalSectionOpen ? (
              <ChevronUp size={16} style={{ color: "#64748b" }} />
            ) : (
              <ChevronDown size={16} style={{ color: "#64748b" }} />
            )}
          </div>

          {isLegalSectionOpen && (
            <div style={{ padding: "8px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { code: "RPT-TAX-08", title: "Tờ khai thuế GTGT khấu trừ (Mẫu 01/GTGT theo TT 80/2021 & TT 89/2026)", taxType: "VAT" },
                  { code: "RPT-TAX-09", title: "Tờ khai thuế TNDN tạm tính (Mẫu 02/TNDN)", taxType: "CIT" },
                  { code: "RPT-TAX-10", title: "Tờ khai quyết toán thuế TNDN (Mẫu 03/TNDN)", taxType: "CIT" },
                  { code: "RPT-TAX-11", title: "Tờ khai thuế TNCN (Mẫu 05/KK-TNCN)", taxType: "PIT" },
                ]
                  .filter((it) => !reportSearch || it.title.toLowerCase().includes(reportSearch.toLowerCase()) || it.code.toLowerCase().includes(reportSearch.toLowerCase()))
                  .map((item) => (
                    <div
                      key={item.code}
                      onClick={() => setActiveTaxReport({ reportCode: item.code, reportName: item.title, category: "LEGAL_FORM_VIEW", taxType: item.taxType })}
                      style={{
                        padding: "10px 10px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#334155",
                        borderBottom: "1px solid #f8fafc",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, padding: "2px 6px", background: "#ecfdf5", borderRadius: 3, fontWeight: 700, color: "#065f46" }}>{item.code}</span>
                        <span>{item.title}</span>
                      </div>
                      <div style={{ width: 18, height: 18, border: "1.5px solid #94a3b8", borderRadius: 3, display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                          <path d="M3 3v18h18" />
                          <path d="M18 17V9" />
                          <path d="M13 17V5" />
                          <path d="M8 17v-3" />
                        </svg>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {renderModals()}
    </div>
  );
}
