import { exportVisibleTable } from "./table-actions";
import { useState, useEffect, Fragment } from "react";
import { useMisaApiLists } from "./misa-api-lists";
import { errorText } from "./misa-api-writes";
import VatDeductionModal from "./VatDeductionModal";
import TaxDeclarationPanel from "./TaxDeclarationPanel";
import TaxObligationPanel, { type TaxObligationRow } from "./TaxObligationPanel";
import TaxPaymentOrderModal from "./TaxPaymentOrderModal";
import TaxReconciliationModal from "./TaxReconciliationModal";
import TaxExportPanel from "./TaxExportPanel";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { useLocation } from "react-router-dom";
import { MisaTaxReportModal } from "./MisaTaxReportModal";
import {
  Bot,
  Search,
  RotateCw,
  Printer,
  ChevronDown,
  ChevronUp,
  X,
  SlidersHorizontal,
  Building2,
  Download,
  Eye,
  EyeOff,
  ShieldCheck,
  Calendar,
  Clock,
  TrendingUp,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  ArrowUpRight,
  Check,
  HelpCircle,
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
  { id: "01-gtgt", code: "01/GTGT", name: "01/GTGT - Tờ khai thuế GTGT khấu trừ", cycle: "Theo tháng", group: "Thuế giá trị gia tăng", checked: false },
  { id: "02-gtgt", code: "02/GTGT", name: "02/GTGT - Tờ khai thuế GTGT dành cho dự án đầu tư", cycle: "Theo tháng", group: "Thuế giá trị gia tăng", checked: false },
  { id: "03-gtgt", code: "03/GTGT", name: "03/GTGT - Tờ khai thuế GTGT trực tiếp trên GTGT", cycle: "Theo tháng", group: "Thuế giá trị gia tăng", checked: false },

  // Thuế thu nhập cá nhân
  { id: "05-kk-tncn", code: "05/KK-TNCN", name: "05/KK-TNCN - Tờ khai thuế thu nhập cá nhân", cycle: "Theo tháng", group: "Thuế thu nhập cá nhân", checked: false },
  { id: "05-qtt-tncn", code: "05/QTT-TNCN", name: "05/QTT-TNCN - Tờ khai quyết toán thuế thu nhập cá nhân", cycle: "Theo năm", group: "Thuế thu nhập cá nhân", checked: false },
  { id: "tncn-detail", code: "DS-TNCN", name: "Danh sách chi tiết số tiền nộp thuế TNCN đã nộp thay cho từng cá nhân", cycle: "Theo từng lần phát sinh", group: "Thuế thu nhập cá nhân", checked: false },

  // Thuế thu nhập doanh nghiệp
  { id: "03-tndn", code: "03/TNDN", name: "03/TNDN - Tờ khai quyết toán thuế TNDN", cycle: "Theo năm", group: "Thuế thu nhập doanh nghiệp", checked: false },

  // Thuế tiêu thụ đặc biệt
  { id: "01-ttdb", code: "01/TTĐB", name: "01/TTĐB - Tờ khai thuế TTĐB", cycle: "Theo tháng", group: "Thuế tiêu thụ đặc biệt", checked: false },

  // Thuế tài nguyên
  { id: "01-tain", code: "01/TAIN", name: "01/TAIN - Tờ khai thuế tài nguyên", cycle: "Theo tháng", group: "Thuế tài nguyên", checked: false },
];

export default function MisaTaxWorkspace({
  company = { id: "cty-ha-noi", name: "Công ty TNHH Dịch vụ & Thương mại Hà Nội" },
  period = "2026-10",
  tab = "declarations",
  notify,
}: MisaTaxWorkspaceProps) {
  const { rows: apiRows, connected: apiConnected, reload: reloadApi } = useMisaApiLists(company.id, {
    obligations: "/api/v1/tax/obligations/",
  }, notify);
  const { token: apiToken } = useApiSession();
  // State: Tab 1 (Khai thuế)
  const [declarations, setDeclarations] = useState<DeclarationItem[]>(INITIAL_DECLARATIONS);
  const [registrationsLoaded, setRegistrationsLoaded] = useState(false);
  const selectAllDec = declarations.every((row) => row.checked);
  const [authority, setAuthority] = useState({ department: "001 - Cục Thuế Thành phố Hà Nội", branchOffice: "00109 - Chi cục Thuế Quận Cầu Giấy", taxAgent: "" });
  const authorityUrl = `/api/v1/tax/authority-settings/?company_id=${encodeURIComponent(company.id)}`;
  const registrationsUrl = `/api/v1/tax/form-registrations/?company_id=${encodeURIComponent(company.id)}`;
  useEffect(() => {
    setRegistrationsLoaded(false);
    if (!apiConnected || !apiToken) return;
    request<{ forms: { form_code: string }[] }>(registrationsUrl, apiToken).then((data) => {
      const codes = new Set(data.forms.map((row) => row.form_code));
      setDeclarations((prev) => prev.map((row) => ({ ...row, checked: codes.has(row.code) })));
      setRegistrationsLoaded(true);
    }).catch((error) => notify(`Không tải được đăng ký tờ khai: ${errorText(error)}`));
  }, [apiConnected, apiToken, registrationsUrl]);
  // Managing tax office and registered declaration forms are stored on the backend.
  useEffect(() => {
    if (!apiConnected || !apiToken) return;
    request<any>(authorityUrl, apiToken).then((data) => {
      if (data.branch_office) setAuthority({ department: data.department, branchOffice: data.branch_office, taxAgent: data.tax_agent || "" });
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
    setDeclarations((prev) => prev.map((d) => ({ ...d, checked })));
  };
  const saveRegistrations = async () => {
    if (!apiConnected || !apiToken || !registrationsLoaded) { notify("Chưa tải xong đăng ký tờ khai."); return; }
    try {
      await request(registrationsUrl, apiToken, { method: "PUT", body: JSON.stringify({
        company: company.id, forms: declarations.filter((row) => row.checked).map((row) => row.code),
      }) });
      notify("Đã lưu đăng ký tờ khai sử dụng thành công!");
    } catch (error) { notify(`Không lưu được đăng ký tờ khai: ${errorText(error)}`); }
  };

  // State: Tab 1 (Khai thuế filters)
  const [declarationCategoryFilter, setDeclarationCategoryFilter] = useState<string>("ALL");
  const [declarationSearchQuery, setDeclarationSearchQuery] = useState<string>("");

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
  const [showTaxPaymentModal, setShowTaxPaymentModal] = useState(false);
  const [paymentInitialId, setPaymentInitialId] = useState<string>();
  const [paymentCandidates, setPaymentCandidates] = useState<TaxObligationRow[] | null>(null);
  const [obligationReloadKey, setObligationReloadKey] = useState(0);
  const openObligations = (apiRows.obligations || []).filter((row) => Number(row.outstanding_amount) > 0) as TaxObligationRow[];
  const [showTaxAuthorityModal, setShowTaxAuthorityModal] = useState(false);

  // Check URL query parameters for flyout actions
  const location = useLocation();
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const action = searchParams.get("action");
    if (action === "vat-deduction") {
      setShowVatDeductionModal(true);
    } else if (action === "pay") {
      setPaymentCandidates(null);
      setPaymentInitialId(undefined);
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
        {/* 1. Modal: Kh?u tr? thu? GTGT */}
        {showVatDeductionModal && <VatDeductionModal companyId={company.id} periodHint={period}
          token={apiToken} notify={notify} onClose={() => setShowVatDeductionModal(false)} />}

        {/* 2. Modal: Tax payment order */}
        {showTaxPaymentModal && <TaxPaymentOrderModal companyId={company.id} token={apiToken}
          obligations={paymentCandidates || openObligations} initialId={paymentInitialId} notify={notify}
          onClose={() => setShowTaxPaymentModal(false)} onSaved={() => {
            reloadApi(); setObligationReloadKey((current) => current + 1);
          }} />}

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
                  <Building2 size={18} style={{ color: "var(--brand)" }} />
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
                  style={{ height: 32, padding: "0 22px", background: "var(--brand)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Lưu thiết lập
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Modal: Xem chi tiết báo cáo */}
        {previewReport === "Bảng đối chiếu bảng kê thuế GTGT và sổ cái" &&
          <TaxReconciliationModal companyId={company.id} companyName={company.name} token={apiToken}
            title={previewReport} reconciliationType="VAT_GL" onClose={() => setPreviewReport(null)} />}
        {previewReport === "Bảng đối chiếu số thuế đã nộp và số thuế phải nộp" &&
          <TaxReconciliationModal companyId={company.id} companyName={company.name} token={apiToken}
            title={previewReport} reconciliationType="OBLIGATION_PAYMENT" onClose={() => setPreviewReport(null)} />}
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
  // 1. TAB: KHAI THUẾ (declarations) - BỨT PHÁ HIỆN ĐẠI SAAS COCKPIT
  // =========================================================================
  if (tab === "declarations") {
    // Filter declarations by category & search
    const filteredDeclarations = declarations.filter((d) => {
      const matchCat =
        declarationCategoryFilter === "ALL" ||
        (declarationCategoryFilter === "GTGT" && d.group === "Thuế giá trị gia tăng") ||
        (declarationCategoryFilter === "TNCN" && d.group === "Thuế thu nhập cá nhân") ||
        (declarationCategoryFilter === "TNDN" && d.group === "Thuế thu nhập doanh nghiệp") ||
        (declarationCategoryFilter === "OTHER" && !["Thuế giá trị gia tăng", "Thuế thu nhập cá nhân", "Thuế thu nhập doanh nghiệp"].includes(d.group));
      const matchSearch =
        !declarationSearchQuery.trim() ||
        d.name.toLowerCase().includes(declarationSearchQuery.toLowerCase()) ||
        d.code.toLowerCase().includes(declarationSearchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    const activeCount = declarations.filter((d) => d.checked).length;

    return (
      <div
        style={{
          background: "#f8fafc",
          minHeight: "100%",
          padding: "20px 24px 48px 24px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* HERO COMMAND COCKPIT BANNER */}
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0c4a6e 100%)",
            borderRadius: 16,
            padding: "24px 28px",
            color: "#ffffff",
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.25), 0 8px 10px -6px rgba(15, 23, 42, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle decorative glow */}
          <div
            style={{
              position: "absolute",
              right: "-50px",
              top: "-50px",
              width: "220px",
              height: "220px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(14, 165, 233, 0.25) 0%, rgba(14, 165, 233, 0) 70%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1, maxWidth: 640 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  color: "#34d399",
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                <Sparkles size={12} />
                CHUẨN TT 99/2025/TT-BTC & NĐ 123/2020
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 9px",
                  borderRadius: 20,
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#cbd5e1",
                  fontSize: 11.5,
                  fontWeight: 500,
                }}
              >
                <Building2 size={12} />
                MST: {company?.id || "0108923456"}
              </span>
            </div>

            <h1 style={{ margin: "0 0 6px 0", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#ffffff" }}>
              Trung tâm Điều hành & Kê khai Thuế Điện tử
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
              Quản trị toàn diện danh mục tờ khai, tự động tổng hợp số liệu hóa đơn, khấu trừ thuế GTGT và giám sát rủi ro nhà cung cấp.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
            <button
              type="button"
              onClick={() => setShowVatDeductionModal(true)}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                backdropFilter: "blur(6px)",
                transition: "all 0.15s ease",
              }}
            >
              <FileText size={15} />
              <span>Khấu trừ GTGT tự động</span>
            </button>

            <button
              type="button"
              disabled={!registrationsLoaded}
              onClick={() => void saveRegistrations()}
              style={{
                height: 38,
                padding: "0 18px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.35)",
                transition: "all 0.15s ease",
              }}
            >
              <CheckCircle2 size={15} />
              <span>Lưu đăng ký ({activeCount} tờ khai)</span>
            </button>
          </div>
        </div>

        {/* 4 BENTO KPI WIDGETS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {/* Bento Card 1: Chỉ số tuân thủ */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              padding: "18px 20px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>Chỉ số Tuân thủ Thuế</span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#ecfdf5",
                  color: "var(--brand)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <ShieldCheck size={18} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", fontFamily: "var(--font-mono, monospace)" }}>
                98<span style={{ fontSize: 15, color: "#64748b", fontWeight: 500 }}>/100</span>
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--brand)",
                  background: "#d1fae5",
                  padding: "2px 7px",
                  borderRadius: 12,
                }}
              >
                Rất an toàn
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              0 rủi ro phạt · 100% hóa đơn khớp CQT
            </div>
          </div>

          {/* Bento Card 2: Hạn nộp gần nhất */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              padding: "18px 20px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>Hạn nộp Tờ khai gần nhất</span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#fef3c7",
                  color: "#d97706",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Clock size={18} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: "#d97706" }}>
                Còn 18 ngày
              </span>
              <span style={{ fontSize: 12, color: "#64748b" }}>30/04/2026</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Tờ khai 01/GTGT Quý 1 & 05/KK-TNCN
            </div>
          </div>

          {/* Bento Card 3: Thuế GTGT tạm tính */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              padding: "18px 20px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>Thuế GTGT Khấu trừ còn lại</span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#f0f9ff",
                  color: "#0284c7",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <TrendingUp size={18} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#0369a1", fontFamily: "var(--font-mono, monospace)" }}>
                +45.200.000 đ
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Chuyển khấu trừ kỳ sau (Chỉ tiêu 43)
            </div>
          </div>

          {/* Bento Card 4: Tra cứu rủi ro nhà cung cấp */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              padding: "18px 20px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>Cảnh báo Nhà Cung Cấp</span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#fdf4ff",
                  color: "#a855f7",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Sparkles size={18} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: "var(--brand)" }}>
                0 Cảnh báo
              </span>
              <span style={{ fontSize: 12, color: "#64748b" }}>/ 142 NCC</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Không có MST nào bỏ trốn hoặc đóng cửa
            </div>
          </div>
        </div>

        {/* QUICK TAX OPERATIONS BAR (1-Click Workflow) */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            padding: "16px 20px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div
            onClick={() => notify("Đang nạp dữ liệu lập Tờ khai thuế GTGT 01/GTGT theo Thông tư 99/2025/TT-BTC...")}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0284c7";
              e.currentTarget.style.background = "#f0f9ff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.background = "#f8fafc";
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#e0f2fe", color: "#0284c7", display: "grid", placeItems: "center" }}>
              <FileText size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Lập Tờ khai 01/GTGT</div>
              <div style={{ fontSize: 11.5, color: "#64748b" }}>Tự động lấy từ hóa đơn mua/bán</div>
            </div>
          </div>

          <div
            onClick={() => notify("Đang nạp bảng kê tiền lương lập Tờ khai thuế TNCN 05/KK-TNCN...")}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0284c7";
              e.currentTarget.style.background = "#f0f9ff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.background = "#f8fafc";
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#ecfdf5", color: "var(--brand)", display: "grid", placeItems: "center" }}>
              <Calendar size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Kê khai TNCN 05/KK</div>
              <div style={{ fontSize: 11.5, color: "#64748b" }}>Tổng hợp từ bảng lương tháng/quý</div>
            </div>
          </div>

          <div
            onClick={() => notify("Tính toán số thuế TNDN tạm nộp (đảm bảo trên 80% theo quy định)...")}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0284c7";
              e.currentTarget.style.background = "#f0f9ff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.background = "#f8fafc";
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#faf5ff", color: "#9333ea", display: "grid", placeItems: "center" }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Tạm tính Thuế TNDN</div>
              <div style={{ fontSize: 11.5, color: "#64748b" }}>Ước lượng nghĩa vụ thuế 20%</div>
            </div>
          </div>

          <div
            onClick={() => setShowVatDeductionModal(true)}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0284c7";
              e.currentTarget.style.background = "#f0f9ff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.background = "#f8fafc";
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fef3c7", color: "#d97706", display: "grid", placeItems: "center" }}>
              <Layers size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Khấu trừ Thuế GTGT</div>
              <div style={{ fontSize: 11.5, color: "#64748b" }}>Tự sinh bút toán Nợ 3331/Có 1331</div>
            </div>
          </div>
        </div>

        {/* DECLARATION REGISTRATION SECTION */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          {/* Section Toolbar */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              background: "#ffffff",
            }}
          >
            {/* Filter Pills */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {[
                { key: "ALL", label: `Tất cả (${declarations.length})` },
                { key: "GTGT", label: "Thuế GTGT" },
                { key: "TNCN", label: "Thuế TNCN" },
                { key: "TNDN", label: "Thuế TNDN" },
                { key: "OTHER", label: "Thuế khác" },
              ].map((filter) => {
                const isActive = declarationCategoryFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setDeclarationCategoryFilter(filter.key)}
                    style={{
                      height: 30,
                      padding: "0 12px",
                      borderRadius: 20,
                      border: isActive ? "1px solid #0284c7" : "1px solid #e2e8f0",
                      background: isActive ? "#f0f9ff" : "#ffffff",
                      color: isActive ? "#0284c7" : "#475569",
                      fontSize: 12.5,
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {/* Search Box & Quick Toggles */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", width: 220 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Tìm kiếm mẫu tờ khai..."
                  value={declarationSearchQuery}
                  onChange={(e) => setDeclarationSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 10px 0 30px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 12.5,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => handleToggleSelectAll(!selectAllDec)}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {selectAllDec ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            </div>
          </div>

          {/* Table of declarations */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", height: 42, borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                  <th style={{ width: 64, textAlign: "center", padding: "8px 12px" }}>
                    Áp dụng
                  </th>
                  <th style={{ width: 140, textAlign: "left", padding: "8px 16px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Mã Tờ khai
                  </th>
                  <th style={{ textAlign: "left", padding: "8px 16px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Tên Tờ khai Thuế
                  </th>
                  <th style={{ width: 180, textAlign: "left", padding: "8px 16px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Kỳ kê khai
                  </th>
                  <th style={{ width: 150, textAlign: "center", padding: "8px 16px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {declarationGroups.map((groupName) => {
                  const groupItems = filteredDeclarations.filter((d) => d.group === groupName);
                  if (groupItems.length === 0) return null;

                  return (
                    <Fragment key={groupName}>
                      {/* Group Header Row */}
                      <tr style={{ background: "#f1f5f9", height: 36, borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                        <td colSpan={5} style={{ padding: "6px 16px", fontWeight: 700, color: "#1e293b", fontSize: 12.5 }}>
                          {groupName} ({groupItems.length})
                        </td>
                      </tr>

                      {/* Group Items */}
                      {groupItems.map((item) => (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            height: 48,
                            background: item.checked ? "#eff6ff" : "#ffffff",
                            transition: "background-color 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!item.checked) e.currentTarget.style.background = "#f8fafc";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = item.checked ? "#eff6ff" : "#ffffff";
                          }}
                        >
                          {/* Modern iOS Toggle Switch */}
                          <td style={{ textAlign: "center", padding: "8px 12px" }}>
                            <div
                              onClick={() => {
                                if (registrationsLoaded) handleToggleDeclaration(item.id);
                              }}
                              title={item.checked ? "Nhấp để tắt áp dụng tờ khai này" : "Nhấp để kích hoạt áp dụng tờ khai này"}
                              style={{
                                width: 36,
                                height: 20,
                                borderRadius: 10,
                                background: item.checked ? "#10b981" : "#cbd5e1",
                                position: "relative",
                                cursor: "pointer",
                                transition: "background-color 0.2s ease",
                                margin: "0 auto",
                              }}
                            >
                              <div
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: "50%",
                                  background: "#ffffff",
                                  position: "absolute",
                                  top: 2,
                                  left: item.checked ? 18 : 2,
                                  transition: "left 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                                }}
                              />
                            </div>
                          </td>

                          {/* Code Badge */}
                          <td style={{ padding: "8px 16px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: item.checked ? "#dcfce7" : "#f1f5f9",
                                color: item.checked ? "#15803d" : "#475569",
                                fontWeight: 700,
                                fontSize: 12,
                                fontFamily: "var(--font-mono, monospace)",
                                border: item.checked ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                              }}
                            >
                              {item.code}
                            </span>
                          </td>

                          {/* Name */}
                          <td style={{ padding: "8px 16px", color: "#0f172a", fontWeight: item.checked ? 600 : 400 }}>
                            <div>{item.name}</div>
                          </td>

                          {/* Cycle Pill */}
                          <td style={{ padding: "8px 16px" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background: item.cycle.includes("tháng") ? "#eff6ff" : item.cycle.includes("năm") ? "#fef3c7" : "#f1f5f9",
                                color: item.cycle.includes("tháng") ? "#1d4ed8" : item.cycle.includes("năm") ? "#b45309" : "#475569",
                                fontSize: 12,
                                fontWeight: 500,
                              }}
                            >
                              <Calendar size={11} />
                              {item.cycle}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td style={{ textAlign: "center", padding: "8px 16px" }}>
                            <button
                              type="button"
                              onClick={() => notify(`Mở biểu mẫu lập tờ khai ${item.code} cho ${item.cycle.toLowerCase()}...`)}
                              style={{
                                height: 28,
                                padding: "0 10px",
                                borderRadius: 6,
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                color: "#0284c7",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                transition: "all 0.15s ease",
                              }}
                            >
                              <span>Lập tờ khai</span>
                              <ArrowRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Existing Declaration Submission Panel */}
        <TaxDeclarationPanel companyId={company.id} token={apiToken} notify={notify} />

        {/* Bottom Floating Save Button Bar */}
        <div
          style={{
            position: "sticky",
            bottom: 16,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(12px)",
            padding: "14px 24px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#475569" }}>
            <span style={{ fontWeight: 600, color: "#0f172a" }}>Đã kích hoạt:</span>
            <span style={{ color: "var(--brand)", fontWeight: 700 }}>{activeCount} / {declarations.length} loại tờ khai</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              disabled={!registrationsLoaded}
              onClick={() => void saveRegistrations()}
              style={{
                height: 36,
                padding: "0 28px",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              <Check size={16} />
              <span>Lưu đăng ký tờ khai</span>
            </button>
          </div>
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
        <TaxObligationPanel companyId={company.id} token={apiToken} notify={notify}
          reloadKey={obligationReloadKey} onPay={(obligation, candidates) => {
            setPaymentCandidates(candidates); setPaymentInitialId(obligation.id); setShowTaxPaymentModal(true);
          }} />
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
                background: "var(--brand)",
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
                  border: "1px solid var(--brand)",
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
                background: "var(--brand)",
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
                <polygon points="42,0 84,20 42,42 0,22" fill="var(--brand)" />
                <polygon points="42,2 80,20 42,39 4,21" fill="#38bdf8" />
                {/* Stand / Keyboard base */}
                <polygon points="0,22 42,42 84,20 42,3" fill="var(--brand-hover)" opacity="0.2" />
                <polygon points="42,42 84,20 84,26 42,48 0,28 0,22" fill="var(--brand)" />
              </g>

              {/* Left Server Node */}
              <g transform="translate(18, 62)">
                <ellipse cx="22" cy="10" rx="18" ry="8" fill="#7dd3fc" />
                <path d="M4 10 L4 20 C4 24 12 28 22 28 C32 28 40 24 40 20 L40 10 Z" fill="var(--brand)" />
                <ellipse cx="22" cy="20" rx="18" ry="8" fill="#38bdf8" />
                <path d="M4 20 L4 30 C4 34 12 38 22 38 C32 38 40 34 40 30 L40 20 Z" fill="var(--brand-hover)" />
                <ellipse cx="22" cy="30" rx="18" ry="8" fill="var(--brand)" />
              </g>

              {/* Right Server Node */}
              <g transform="translate(158, 62)">
                <ellipse cx="22" cy="10" rx="18" ry="8" fill="#7dd3fc" />
                <path d="M4 10 L4 20 C4 24 12 28 22 28 C32 28 40 24 40 20 L40 10 Z" fill="var(--brand)" />
                <ellipse cx="22" cy="20" rx="18" ry="8" fill="#38bdf8" />
                <path d="M4 20 L4 30 C4 34 12 38 22 38 C32 38 40 34 40 30 L40 20 Z" fill="var(--brand-hover)" />
                <ellipse cx="22" cy="30" rx="18" ry="8" fill="var(--brand)" />
              </g>

              {/* Center Main Database Stack */}
              <g transform="translate(85, 85)">
                <ellipse cx="26" cy="12" rx="26" ry="10" fill="#e0f2fe" />
                <ellipse cx="26" cy="12" rx="22" ry="8" fill="#38bdf8" />
                <path d="M4 12 L4 26 C4 32 14 36 26 36 C38 36 48 32 48 26 L48 12 Z" fill="var(--brand)" />
                <ellipse cx="26" cy="26" rx="22" ry="8" fill="#7dd3fc" />
                <path d="M4 26 L4 40 C4 46 14 50 26 50 C38 50 48 46 48 40 L48 26 Z" fill="var(--brand-hover)" />
                <ellipse cx="26" cy="40" rx="22" ry="8" fill="var(--brand)" />
              </g>

              {/* Small floating sparkles */}
              <circle cx="34" cy="48" r="3" fill="#f59e0b" />
              <circle cx="186" cy="45" r="2.5" fill="#f59e0b" />
              <circle cx="108" cy="148" r="2" fill="var(--brand)" />
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
              <span style={{ color: "var(--brand)", fontWeight: 700 }}>•</span>
              <span>
                Đáp ứng đầy đủ mọi nghiệp vụ kê khai, nộp thuế cho Doanh nghiệp và Cá nhân (doanh nghiệp kê khai hộ)
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "var(--brand)", fontWeight: 700 }}>•</span>
              <span>Tích hợp ngay trên phần mềm kế toán Sổ Việt ERP</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "var(--brand)", fontWeight: 700 }}>•</span>
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
              onClick={async (event) => { try { await exportVisibleTable(event.currentTarget, "Xuất danh sách nhà cung cấp rủi ro"); } catch (cause) { notify?.(cause instanceof Error ? cause.message : "Không thực hiện được thao tác."); } }}
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
                <circle cx="28" cy="28" r="1.5" fill="var(--brand)" opacity="0.6" />
                <circle cx="112" cy="38" r="2" fill="var(--brand)" opacity="0.7" />
                <circle cx="106" cy="68" r="1.5" fill="var(--brand)" opacity="0.6" />

                {/* Magnifying Glass Outer Rim */}
                <circle cx="68" cy="44" r="20" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2.5" />
                {/* Lens lines (document preview) */}
                <line x1="61" y1="38" x2="75" y2="38" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
                <line x1="61" y1="44" x2="75" y2="44" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
                <line x1="61" y1="50" x2="71" y2="50" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />

                {/* Magnifier Handle */}
                <path d="M82 58 L92 72" stroke="var(--brand)" strokeWidth="4.5" strokeLinecap="round" />
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
      <TaxExportPanel companyId={company.id} token={apiToken} />
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
            onClick={() => notify("Kiểm tra nhanh định khoản để tìm kiếm và lập báo cáo thuế thông minh")}
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
            <span>Tìm kiếm nhanh báo cáo</span>
            <span style={{ fontSize: 14 }}><Bot size={14} className="ui-inline-icon" aria-hidden="true" /></span>
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
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand)")}
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
                      onClick={() => {
                        if (["B?ng ??i chi?u b?ng k? thu? GTGT v? s? c?i", "B?ng ??i chi?u s? thu? ?? n?p v? s? thu? ph?i n?p"].includes(item.title)) {
                          setPreviewReport(item.title);
                        } else {
                          setActiveTaxReport({ reportCode: item.code, reportName: item.title, category: "RECONCILIATION_REPORT", taxType: item.taxType });
                        }
                      }}
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
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand)")}
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
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, padding: "2px 6px", background: "#eff6ff", borderRadius: 3, fontWeight: 700, color: "var(--brand-ink)" }}>{item.code}</span>
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
