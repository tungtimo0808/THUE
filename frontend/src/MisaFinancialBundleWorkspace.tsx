import React, { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  Lock,
  Play,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  type ApiWriter,
  approveFinancialBundleUcRpt02,
  approveFinancialStatementRunUcRpt02,
  createFinancialBundleUcRpt02,
  exportFinancialBundleUcRpt02,
  fetchFinancialBundleDetailUcRpt02,
  fetchFinancialBundleHistoryUcRpt02,
  fetchFinancialBundlesListUcRpt02,
  fetchFinancialBundleSupportingReportsUcRpt02,
  fetchFinancialBundleTypesUcRpt02,
  fetchFinancialStatementLineSourcesUcRpt02,
  fetchFinancialStatementRunLinesUcRpt02,
  generateFinancialStatementRunUcRpt02,
  submitFinancialBundleReviewUcRpt02,
  validateFinancialBundleUcRpt02,
} from "./misa-api-writes";

export interface MisaFinancialBundleWorkspaceProps {
  companyId?: string | null;
  notify?: (msg: string) => void;
  onOpenReportByName?: (reportName: string) => void;
}

const LEGAL_FORM_TO_REPORT_NAME: Record<string, string> = {
  "B01-DN": "B01 - DN: Báo cáo tình hình tài chính",
  "B02-DN": "B02 - DN: Báo cáo kết quả hoạt động kinh doanh",
  "B03-DN": "B03 - DN: Báo cáo lưu chuyển tiền tệ (PP trực tiếp)",
  "B03-DN-GT": "B03 - DN - GT: Báo cáo lưu chuyển tiền tệ (PP gián tiếp)",
  "B09-DN": "B09 - DN: Thuyết minh báo cáo tài chính",
  "B01a-DN": "B01a - DN: Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)",
  "B02a-DN": "B02a - DN: Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)",
  "B03a-DN": "B03a - DN: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP trực tiếp)",
  "B03a-DN-GT": "B03a - DN - GT: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP gián tiếp)",
  "B09a-DN": "B09 - DN: Thuyết minh báo cáo tài chính",
};

function formatMoney(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") {
    return "N/A (Thiếu dữ liệu)";
  }
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  return num.toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function statusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case "APPROVED":
    case "PASSED":
      return { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" };
    case "READY_FOR_APPROVAL":
    case "GENERATED":
      return { background: "#e0f2fe", color: "#075985", border: "1px solid #7dd3fc" };
    case "PASSED_WITH_WARNING":
    case "DRAFT":
      return { background: "#fef9c3", color: "#854d0e", border: "1px solid #fde047" };
    case "INCOMPLETE":
    case "MISSING":
    case "FAILED":
    case "ERROR":
      return { background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" };
    default:
      return { background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" };
  }
}

export default function MisaFinancialBundleWorkspace({
  companyId,
  notify,
  onOpenReportByName,
}: MisaFinancialBundleWorkspaceProps) {
  const [catalog, setCatalog] = useState<any>(null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string>("");
  const [bundleDetail, setBundleDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Creation parameters
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [fiscalPeriodId, setFiscalPeriodId] = useState<string>("");
  const [bundleType, setBundleType] = useState<string>("ANNUAL_GOING_CONCERN");
  const [reportingScope, setReportingScope] = useState<string>("COMPANY");
  const [branchId, setBranchId] = useState<string>("");
  const [cashFlowMethod, setCashFlowMethod] = useState<string>("DIRECT");
  const [showZeroLines, setShowZeroLines] = useState<boolean>(true);
  const [confirmNonGoingConcern, setConfirmNonGoingConcern] = useState<boolean>(false);

  // Active sub-panels
  const [activeStatementLines, setActiveStatementLines] = useState<any>(null);
  const [drilldownPayload, setDrilldownPayload] = useState<any>(null);
  const [historyPayload, setHistoryPayload] = useState<any>(null);
  const [supportingPayload, setSupportingPayload] = useState<any>(null);
  const [exportPayload, setExportPayload] = useState<any>(null);

  const getWriter = useCallback((): ApiWriter => {
    const cid =
      companyId ||
      localStorage.getItem("active_company_id") ||
      localStorage.getItem("company_id") ||
      "";
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("jwt_token") ||
      localStorage.getItem("token") ||
      "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (cid) headers["X-Company-Id"] = cid;

    return {
      companyId: cid,
      get: async (url: string) => {
        const res = await fetch(url, { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
        return data;
      },
      post: async (url: string, body: any) => {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body || {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
        return data;
      },
      patch: async (url: string, body: any) => {
        const res = await fetch(url, {
          method: "PATCH",
          headers,
          body: JSON.stringify(body || {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
        return data;
      },
    };
  }, [companyId]);

  const loadCatalogAndList = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const w = getWriter();
      const [catRes, listRes] = await Promise.all([
        fetchFinancialBundleTypesUcRpt02(w),
        fetchFinancialBundlesListUcRpt02(w, { current_only: "false" }),
      ]);
      setCatalog(catRes);
      if (catRes?.fiscal_periods?.length && !fiscalPeriodId) {
        setFiscalPeriodId(catRes.fiscal_periods[0].id);
        setFiscalYear(catRes.fiscal_periods[0].fiscal_year);
      }
      const items = listRes?.items || [];
      setBundles(items);
      if (items.length > 0 && !selectedBundleId) {
        setSelectedBundleId(items[0].bundle_id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tải danh mục Bộ báo cáo tài chính.");
    } finally {
      setLoading(false);
    }
  }, [getWriter, fiscalPeriodId, selectedBundleId]);

  const loadBundleDetail = useCallback(
    async (bId: string, ver?: number) => {
      if (!bId) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const w = getWriter();
        const detail = await fetchFinancialBundleDetailUcRpt02(
          w,
          bId,
          ver ? { bundle_version: ver } : {},
        );
        setBundleDetail(detail);
      } catch (err: any) {
        setErrorMsg(err?.message || "Không thể tải chi tiết bộ BCTC.");
      } finally {
        setLoading(false);
      }
    },
    [getWriter],
  );

  useEffect(() => {
    loadCatalogAndList();
  }, [loadCatalogAndList]);

  useEffect(() => {
    if (selectedBundleId) {
      loadBundleDetail(selectedBundleId);
    }
  }, [selectedBundleId, loadBundleDetail]);

  const handleCreateOrGenerateBundle = async () => {
    if (bundleType === "ANNUAL_NON_GOING_CONCERN" && !confirmNonGoingConcern) {
      notify?.("Vui lòng xác nhận doanh nghiệp thuộc trường hợp không đáp ứng giả định hoạt động liên tục (B01-DNKLT .. B09-DNKLT).");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const w = getWriter();
      const created = await createFinancialBundleUcRpt02(w, {
        fiscal_year: fiscalYear,
        fiscal_period_id: fiscalPeriodId,
        bundle_type: bundleType,
        reporting_scope: reportingScope,
        branch_id: reportingScope === "BRANCH" ? branchId : undefined,
        cash_flow_method: cashFlowMethod,
        show_zero_lines: showZeroLines,
        confirm_non_going_concern: confirmNonGoingConcern,
        auto_generate_runs: true,
      });
      notify?.(`Đã lập Bộ BCTC ${created.bundle_code} (Phiên bản v${created.bundle_version}) thành công.`);
      setSelectedBundleId(created.bundle_id);
      setBundleDetail(created);
      await loadCatalogAndList();
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi lập Bộ BCTC.");
    } finally {
      setLoading(false);
    }
  };

  const handleValidateBundle = async () => {
    if (!bundleDetail?.bundle_id) return;
    setLoading(true);
    try {
      const w = getWriter();
      const res = await validateFinancialBundleUcRpt02(w, bundleDetail.bundle_id);
      setBundleDetail(res.bundle);
      notify?.(`Đã kiểm tra chéo bộ BCTC: ${res.validation.validation_status}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi kiểm tra chéo bộ BCTC.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!bundleDetail?.bundle_id) return;
    setLoading(true);
    try {
      const w = getWriter();
      const res = await submitFinancialBundleReviewUcRpt02(w, bundleDetail.bundle_id, {
        lock_version: bundleDetail.lock_version,
      });
      setBundleDetail(res);
      notify?.("Đã trình duyệt Bộ BCTC (READY_FOR_APPROVAL).");
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể trình duyệt Bộ BCTC.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBundle = async () => {
    if (!bundleDetail?.bundle_id) return;
    setLoading(true);
    try {
      const w = getWriter();
      const res = await approveFinancialBundleUcRpt02(w, bundleDetail.bundle_id, {
        lock_version: bundleDetail.lock_version,
      });
      setBundleDetail(res);
      notify?.("Đã phê duyệt chính thức Bộ BCTC (APPROVED).");
      await loadCatalogAndList();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể phê duyệt Bộ BCTC.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveComponentRun = async (runId: string) => {
    if (!runId) return;
    setLoading(true);
    try {
      const w = getWriter();
      await approveFinancialStatementRunUcRpt02(w, runId);
      notify?.("Đã phê duyệt báo cáo thành phần.");
      if (bundleDetail?.bundle_id) {
        await loadBundleDetail(bundleDetail.bundle_id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể phê duyệt báo cáo thành phần.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateComponent = async (comp: any) => {
    if (!bundleDetail) return;
    setLoading(true);
    try {
      const w = getWriter();
      await generateFinancialStatementRunUcRpt02(w, {
        fiscal_period_id: bundleDetail.fiscal_period_id,
        legal_form_code: comp.legal_form_code,
        reporting_scope: bundleDetail.reporting_scope,
        branch_id: bundleDetail.branch_id,
        cash_flow_method: comp.component_type === "CASH_FLOW" ? bundleDetail.cash_flow_method : "",
        run_status: "GENERATED",
      });
      notify?.(`Đã tổng hợp lại báo cáo thành phần ${comp.legal_form_code}.`);
      await loadBundleDetail(bundleDetail.bundle_id);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tổng hợp báo cáo thành phần.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStatementLines = async (runId: string) => {
    if (!runId) return;
    setLoading(true);
    try {
      const w = getWriter();
      const res = await fetchFinancialStatementRunLinesUcRpt02(w, runId, {
        show_zero_lines: showZeroLines ? "true" : "false",
      });
      setActiveStatementLines(res);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tải chi tiết chỉ tiêu báo cáo.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLineDrilldown = async (runId: string, lineId: string) => {
    setLoading(true);
    try {
      const w = getWriter();
      const res = await fetchFinancialStatementLineSourcesUcRpt02(w, runId, lineId);
      setDrilldownPayload(res);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể truy vết nguồn số liệu chỉ tiêu (UC-RPT-14).");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenHistory = async () => {
    if (!bundleDetail?.bundle_id) return;
    setLoading(true);
    try {
      const w = getWriter();
      const res = await fetchFinancialBundleHistoryUcRpt02(w, bundleDetail.bundle_id);
      setHistoryPayload(res);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tải lịch sử phiên bản bộ BCTC.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSupportingReports = async () => {
    if (!bundleDetail?.bundle_id) return;
    setLoading(true);
    try {
      const w = getWriter();
      const res = await fetchFinancialBundleSupportingReportsUcRpt02(w, bundleDetail.bundle_id);
      setSupportingPayload(res);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tải báo cáo hỗ trợ kiểm tra trước lập BCTC.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportBundle = async (format: string, mode: string) => {
    if (!bundleDetail?.bundle_id) return;
    setLoading(true);
    try {
      const w = getWriter();
      const res = await exportFinancialBundleUcRpt02(w, bundleDetail.bundle_id, {
        format,
        export_mode: mode,
      });
      setExportPayload(res);
      notify?.(
        `Đã khởi tạo lệnh kết xuất Bộ BCTC (${res.format} - ${res.export_mode}) chuyển tiếp sang ${res.target_uc_code}.`,
      );
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xuất bộ BCTC.");
    } finally {
      setLoading(false);
    }
  };

  const periods = catalog?.fiscal_periods || [];
  const bundleTypes = catalog?.bundle_types || [
    { code: "ANNUAL_GOING_CONCERN", name: "Bộ BCTC năm – Đáp ứng giả định hoạt động liên tục (B01-DN .. B09-DN)" },
    { code: "ANNUAL_NON_GOING_CONCERN", name: "Bộ BCTC năm – Không đáp ứng giả định hoạt động liên tục (B01-DNKLT .. B09-DNKLT)" },
    { code: "INTERIM_FULL", name: "Bộ BCTC giữa niên độ – Dạng đầy đủ (B01a-DN .. B09a-DN)" },
    { code: "INTERIM_CONDENSED", name: "Bộ BCTC giữa niên độ – Dạng tóm lược (B01b-DN .. B09a-DN)" },
  ];

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 18, marginBottom: 20 }}>
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", borderBottom: "1px solid #e2e8f0", paddingBottom: 14, marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={18} color="#00a862" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              UC-RPT-02 – Quản lý & Xem Bộ Báo Cáo Tài Chính (Thông tư 99/2025/TT-BTC)
            </h3>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
            Tra cứu, tổng hợp, kiểm tra chéo (B01 ↔ B02 ↔ B03 ↔ B09), quản lý phiên bản (V1/V2), phê duyệt và truy vết nguồn Sổ cái (GL).
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={loadCatalogAndList}
            style={{ height: 32, padding: "0 12px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          >
            <RefreshCw size={14} />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            onClick={handleCreateOrGenerateBundle}
            disabled={loading}
            style={{ height: 32, padding: "0 14px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          >
            <Play size={14} />
            <span>Lập / Tạo phiên bản Bộ BCTC mới</span>
          </button>
        </div>
      </div>

      {/* Filter & Parameter Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))", gap: 10, background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0", marginBottom: 14, fontSize: 12.5 }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Loại bộ BCTC pháp lý</label>
          <select
            value={bundleType}
            onChange={(e) => setBundleType(e.target.value)}
            style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px", background: "#ffffff" }}
          >
            {bundleTypes.map((bt: any) => (
              <option key={bt.code} value={bt.code}>
                {bt.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Kỳ kế toán</label>
          <select
            value={fiscalPeriodId}
            onChange={(e) => {
              const pid = e.target.value;
              setFiscalPeriodId(pid);
              const found = periods.find((p: any) => p.id === pid);
              if (found) setFiscalYear(found.fiscal_year);
            }}
            style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px", background: "#ffffff" }}
          >
            {periods.length === 0 && <option value="">-- Chọn kỳ kế toán --</option>}
            {periods.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.start_date} → {p.end_date}) [{p.status}]
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Phương pháp Lưu chuyển tiền tệ (B03)</label>
          <select
            value={cashFlowMethod}
            onChange={(e) => setCashFlowMethod(e.target.value)}
            style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px", background: "#ffffff" }}
          >
            <option value="DIRECT">Phương pháp trực tiếp (B03-DN / B03a-DN)</option>
            <option value="INDIRECT">Phương pháp gián tiếp (B03-DN-GT / B03a-DN-GT)</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Phạm vi báo cáo</label>
          <select
            value={reportingScope}
            onChange={(e) => setReportingScope(e.target.value)}
            style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px", background: "#ffffff" }}
          >
            <option value="COMPANY">Toàn doanh nghiệp (COMPANY)</option>
            <option value="BRANCH">Theo chi nhánh / đơn vị (BRANCH)</option>
          </select>
        </div>

        {reportingScope === "BRANCH" && (
          <div>
            <label style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Chi nhánh</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px", background: "#ffffff" }}
            >
              <option value="">-- Chọn chi nhánh --</option>
              {(catalog?.branches || []).map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.code} - {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ display: "block", fontWeight: 600, color: "#475569", marginBottom: 4 }}>Bộ BCTC đã lưu</label>
          <select
            value={selectedBundleId}
            onChange={(e) => setSelectedBundleId(e.target.value)}
            style={{ width: "100%", height: 30, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px", background: "#ffffff" }}
          >
            <option value="">-- Chọn bộ BCTC đã lưu ({bundles.length}) --</option>
            {bundles.map((b: any) => (
              <option key={b.bundle_id} value={b.bundle_id}>
                {b.bundle_code} (v{b.bundle_version}) - {b.bundle_status} [{b.available_component_count}/4]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Confirmation checkbox for Non-going concern (AF-02) */}
      {bundleType === "ANNUAL_NON_GOING_CONCERN" && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#92400e" }}>
          <AlertTriangle size={16} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={confirmNonGoingConcern}
              onChange={(e) => setConfirmNonGoingConcern(e.target.checked)}
            />
            Xác nhận doanh nghiệp thuộc diện KHÔNG đáp ứng giả định hoạt động liên tục (áp dụng bộ mẫu B01-DNKLT, B02-DNKLT, B03-DNKLT, B09-DNKLT).
          </label>
        </div>
      )}

      {errorMsg && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "10px 14px", marginBottom: 12, color: "#991b1b", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <XCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Selected Bundle Workspace */}
      {bundleDetail ? (
        <div>
          {/* Bundle Metadata & Workflow Bar */}
          <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6, padding: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5, color: "#0f172a" }}>
                    {bundleDetail.bundle_name} — Mã: {bundleDetail.bundle_code} (v{bundleDetail.bundle_version})
                  </span>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11.5, fontWeight: 700, ...statusBadgeStyle(bundleDetail.bundle_status) }}>
                    Trạng thái Bộ: {bundleDetail.bundle_status}
                  </span>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11.5, fontWeight: 700, ...statusBadgeStyle(bundleDetail.validation_status) }}>
                    Kiểm tra chéo: {bundleDetail.validation_status}
                  </span>
                  {bundleDetail.is_stale && (
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11.5, fontWeight: 700, background: "#ffedd5", color: "#9a3412", border: "1px solid #fdba74" }}>
                      ⚠️ Sổ cái (GL) đã thay đổi sau khi lập (Stale)
                    </span>
                  )}
                  {bundleDetail.is_period_closed && (
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11.5, fontWeight: 700, background: "#e2e8f0", color: "#334155" }}>
                      🔒 Kỳ kế toán đã khóa (Read-only)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                  Doanh nghiệp: <strong>{bundleDetail.company_name}</strong> (MST: {bundleDetail.tax_code || "N/A"}) | Căn cứ pháp lý:{" "}
                  <strong>{bundleDetail.legal_basis}</strong> | Thành phần:{" "}
                  <strong>{bundleDetail.available_component_count}/4 đã có</strong>,{" "}
                  <strong>{bundleDetail.approved_component_count}/4 đã duyệt</strong> | Cảnh báo:{" "}
                  <strong>{bundleDetail.warning_count} Warning / {bundleDetail.blocker_count} Blocker</strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleValidateBundle}
                  style={{ height: 30, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#334155", cursor: "pointer" }}
                >
                  Kiểm tra chéo lại
                </button>
                {bundleDetail.permissions?.can_generate && bundleDetail.bundle_status !== "APPROVED" && (
                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    style={{ height: 30, padding: "0 10px", background: "#0284c7", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}
                  >
                    Trình duyệt
                  </button>
                )}
                {bundleDetail.permissions?.can_approve && bundleDetail.bundle_status !== "APPROVED" && (
                  <button
                    type="button"
                    onClick={handleApproveBundle}
                    style={{ height: 30, padding: "0 10px", background: "#16a34a", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}
                  >
                    Phê duyệt Bộ BCTC
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenHistory}
                  style={{ height: 30, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                >
                  <History size={13} />
                  <span>Lịch sử V1/V2</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenSupportingReports}
                  style={{ height: 30, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#334155", cursor: "pointer" }}
                >
                  Báo cáo hỗ trợ kiểm tra
                </button>
                {bundleDetail.permissions?.can_export && (
                  <button
                    type="button"
                    onClick={() =>
                      handleExportBundle(
                        "PDF",
                        bundleDetail.bundle_status === "APPROVED" ? "OFFICIAL" : "DRAFT",
                      )
                    }
                    style={{ height: 30, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#0f172a", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                  >
                    <Printer size={13} />
                    <span>In / Xuất Bộ BCTC (UC-RPT-15)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 4 Required Legal Components Table */}
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
              Danh sách 4 Báo cáo thành phần bắt buộc của Bộ BCTC ({bundleDetail.bundle_type})
            </h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #e2e8f0" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px" }}>Thành phần</th>
                  <th style={{ padding: "8px 10px" }}>Mã biểu mẫu pháp lý</th>
                  <th style={{ padding: "8px 10px" }}>Tên báo cáo</th>
                  <th style={{ padding: "8px 10px", textAlign: "center" }}>Mẫu / Run Ver</th>
                  <th style={{ padding: "8px 10px", textAlign: "center" }}>Trạng thái Run</th>
                  <th style={{ padding: "8px 10px", textAlign: "center" }}>Kiểm tra chéo</th>
                  <th style={{ padding: "8px 10px", textAlign: "center" }}>UC đích</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {(bundleDetail.components || []).map((comp: any) => (
                  <tr key={comp.component_type} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{comp.component_type}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: "#0284c7" }}>{comp.legal_form_code}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {comp.report_name}
                      {comp.is_stale && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "#b45309", fontWeight: 600 }}>
                          (Stale - GL mới cập nhật)
                        </span>
                      )}
                      {comp.error_message && (
                        <div style={{ color: "#dc2626", fontSize: 11.5 }}>{comp.error_message}</div>
                      )}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      Mẫu v{comp.template_version} / {comp.run_version ? `Run v${comp.run_version}` : "Chưa lập"}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700, ...statusBadgeStyle(comp.run_status) }}>
                        {comp.run_status}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700, ...statusBadgeStyle(comp.validation_status) }}>
                        {comp.validation_status}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#475569" }}>
                      {comp.target_uc_code}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        {comp.statement_run_id && (
                          <button
                            type="button"
                            onClick={() => handleOpenStatementLines(comp.statement_run_id)}
                            style={{ padding: "3px 8px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 4, fontSize: 11.5, fontWeight: 600, color: "#166534", cursor: "pointer" }}
                          >
                            Xem chỉ tiêu ({comp.line_count})
                          </button>
                        )}
                        {bundleDetail.permissions?.can_generate && !bundleDetail.read_only && (
                          <button
                            type="button"
                            onClick={() => handleRegenerateComponent(comp)}
                            style={{ padding: "3px 8px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11.5, color: "#334155", cursor: "pointer" }}
                          >
                            Lập lại
                          </button>
                        )}
                        {comp.statement_run_id &&
                          comp.run_status !== "APPROVED" &&
                          bundleDetail.permissions?.can_approve && (
                            <button
                              type="button"
                              onClick={() => handleApproveComponentRun(comp.statement_run_id)}
                              style={{ padding: "3px 8px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 4, fontSize: 11.5, fontWeight: 600, color: "#1d4ed8", cursor: "pointer" }}
                            >
                              Duyệt thành phần
                            </button>
                          )}
                        {onOpenReportByName && LEGAL_FORM_TO_REPORT_NAME[comp.legal_form_code] && (
                          <button
                            type="button"
                            onClick={() => onOpenReportByName(LEGAL_FORM_TO_REPORT_NAME[comp.legal_form_code])}
                            style={{ padding: "3px 8px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11.5, color: "#0284c7", cursor: "pointer" }}
                          >
                            Mở mẫu in
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cross-Statement Validations Panel */}
          {(bundleDetail.validations || []).length > 0 && (
            <div style={{ marginBottom: 14, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: 12 }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#92400e" }}>
                Kết quả kiểm tra chéo & Cảnh báo tính nhất quán trong Bộ BCTC ({bundleDetail.validations.length})
              </h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>
                {bundleDetail.validations.map((v: any) => (
                  <li key={v.id} style={{ color: v.severity === "BLOCKER" ? "#b91c1c" : "#92400e" }}>
                    <strong>[{v.rule_code} - {v.severity}]</strong> ({v.component_type}
                    {v.indicator_code ? ` / Chỉ tiêu ${v.indicator_code}` : ""}): {v.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Active Statement Run Lines / ValueSlots / B09 Notes Viewer */}
          {activeStatementLines && (
            <div style={{ marginTop: 14, border: "1px solid #cbd5e1", borderRadius: 6, padding: 14, background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    {activeStatementLines.legal_form_code} – {activeStatementLines.statement_title} (Run v{activeStatementLines.run_version})
                  </h4>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Kỳ: {activeStatementLines.period_name} ({activeStatementLines.period_start_date} → {activeStatementLines.period_end_date}) | Nhấn vào dòng chỉ tiêu để truy vết nguồn Sổ cái (UC-RPT-14).
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={showZeroLines}
                      onChange={(e) => {
                        setShowZeroLines(e.target.checked);
                        handleOpenStatementLines(activeStatementLines.run_id);
                      }}
                    />
                    Hiển thị dòng số liệu = 0
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveStatementLines(null)}
                    style={{ padding: "4px 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer", fontSize: 12 }}
                  >
                    Đóng bảng chỉ tiêu
                  </button>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #e2e8f0" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "7px 10px", textAlign: "left" }}>Chỉ tiêu</th>
                    <th style={{ padding: "7px 10px", textAlign: "center", width: 70 }}>Mã số</th>
                    <th style={{ padding: "7px 10px", textAlign: "center", width: 90 }}>Thuyết minh</th>
                    {(activeStatementLines.column_schema || []).length > 0 ? (
                      activeStatementLines.column_schema.map((col: any) => (
                        <th key={col.slot_code} style={{ padding: "7px 10px", textAlign: "right" }}>
                          {col.label}
                        </th>
                      ))
                    ) : (
                      <>
                        <th style={{ padding: "7px 10px", textAlign: "right" }}>Số kỳ này / Cuối kỳ</th>
                        <th style={{ padding: "7px 10px", textAlign: "right" }}>Số kỳ trước / Đầu năm</th>
                      </>
                    )}
                    <th style={{ padding: "7px 10px", textAlign: "center", width: 100 }}>Truy vết</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeStatementLines.lines || []).map((ln: any) => {
                    const isBold = ln.line_type === "TOTAL" || ln.line_type === "SUBTOTAL";
                    return (
                      <React.Fragment key={ln.line_id}>
                        <tr style={{ borderBottom: "1px solid #f1f5f9", fontWeight: isBold ? 700 : 400, background: isBold ? "#f8fafc" : "#ffffff" }}>
                          <td style={{ padding: "7px 10px" }}>
                            {ln.indicator_name}
                            {ln.text_value && (
                              <div style={{ fontSize: 11.5, color: "#475569", marginTop: 3, fontWeight: 400 }}>
                                {ln.text_value}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center" }}>{ln.indicator_code}</td>
                          <td style={{ padding: "7px 10px", textAlign: "center", color: "#0284c7" }}>{ln.note_reference}</td>
                          {(ln.value_slots || []).length > 0 ? (
                            ln.value_slots.map((s: any) => (
                              <td key={s.slot_code} style={{ padding: "7px 10px", textAlign: "right" }}>
                                {formatMoney(s.amount)}
                              </td>
                            ))
                          ) : (
                            <>
                              <td style={{ padding: "7px 10px", textAlign: "right" }}>
                                {formatMoney(ln.current_period_amount)}
                              </td>
                              <td style={{ padding: "7px 10px", textAlign: "right" }}>
                                {formatMoney(ln.comparative_period_amount)}
                              </td>
                            </>
                          )}
                          <td style={{ padding: "7px 10px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleOpenLineDrilldown(activeStatementLines.run_id, ln.indicator_code)}
                              style={{ padding: "2px 8px", fontSize: 11, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0284c7", cursor: "pointer" }}
                            >
                              Nguồn GL
                            </button>
                          </td>
                        </tr>
                        {/* Structured Note Table for B09 / B09a */}
                        {(ln.table_rows || []).length > 0 && (
                          <tr style={{ background: "#fcfcfd", borderBottom: "1px solid #e2e8f0" }}>
                            <td colSpan={6} style={{ padding: "6px 24px" }}>
                              <div style={{ fontSize: 11.5, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                                Bảng thuyết minh chi tiết ({ln.indicator_code}):
                              </div>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, border: "1px solid #e2e8f0" }}>
                                <tbody>
                                  {ln.table_rows.map((tr: any, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                      <td style={{ padding: "4px 8px" }}>{tr.item}</td>
                                      <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                                        {formatMoney(tr.closing ?? tr.current)}
                                      </td>
                                      <td style={{ padding: "4px 8px", textAlign: "right", color: "#64748b" }}>
                                        {formatMoney(tr.opening ?? tr.previous)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Drill-down Source Modal / Panel (UC-RPT-14) */}
          {drilldownPayload && (
            <div style={{ marginTop: 14, border: "1px solid #93c5fd", borderRadius: 6, padding: 14, background: "#eff6ff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#1e3a8a" }}>
                  Truy vết nguồn số liệu ({drilldownPayload.target_uc_code}) — Chỉ tiêu [{drilldownPayload.indicator_code}] {drilldownPayload.indicator_name}
                </h4>
                <button
                  type="button"
                  onClick={() => setDrilldownPayload(null)}
                  style={{ padding: "3px 8px", border: "1px solid #93c5fd", borderRadius: 4, background: "#ffffff", cursor: "pointer", fontSize: 11.5 }}
                >
                  Đóng
                </button>
              </div>
              <div style={{ fontSize: 12, color: "#1e40af", marginBottom: 8 }}>
                Số kỳ này: <strong>{formatMoney(drilldownPayload.current_period_amount)}</strong> | Công thức:{" "}
                <strong>{drilldownPayload.formula_expression || "Tổng hợp theo ánh xạ Tài khoản Sổ cái (GL)"}</strong> | Ánh xạ TK:{" "}
                {(drilldownPayload.account_mappings || []).map((m: any) => `${m.account_prefix} (${m.balance_side})`).join(", ") || "Chỉ tiêu tổng hợp"}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#ffffff", border: "1px solid #bfdbfe" }}>
                <thead>
                  <tr style={{ background: "#dbeafe", color: "#1e3a8a", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px" }}>Số chứng từ GL</th>
                    <th style={{ padding: "6px 8px" }}>Ngày hạch toán</th>
                    <th style={{ padding: "6px 8px" }}>Tài khoản</th>
                    <th style={{ padding: "6px 8px" }}>Diễn giải</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Phát sinh Nợ</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Phát sinh Có</th>
                  </tr>
                </thead>
                <tbody>
                  {(drilldownPayload.source_journal_lines || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 10, textAlign: "center", color: "#64748b" }}>
                        Không có bút toán chi tiết hoặc chỉ tiêu được tính theo công thức tổng hợp.
                      </td>
                    </tr>
                  ) : (
                    drilldownPayload.source_journal_lines.map((jl: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #eff6ff" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>{jl.journal_number}</td>
                        <td style={{ padding: "6px 8px" }}>{jl.posting_date}</td>
                        <td style={{ padding: "6px 8px" }}>{jl.account_code} - {jl.account_name}</td>
                        <td style={{ padding: "6px 8px" }}>{jl.description}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatMoney(jl.debit)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatMoney(jl.credit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Version History Panel */}
          {historyPayload && (
            <div style={{ marginTop: 14, border: "1px solid #cbd5e1", borderRadius: 6, padding: 14, background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                  Lịch sử phiên bản Bộ BCTC ({historyPayload.bundle_code})
                </h4>
                <button
                  type="button"
                  onClick={() => setHistoryPayload(null)}
                  style={{ padding: "3px 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer", fontSize: 11.5 }}
                >
                  Đóng
                </button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#ffffff", border: "1px solid #e2e8f0" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px" }}>Phiên bản</th>
                    <th style={{ padding: "6px 8px" }}>Trạng thái</th>
                    <th style={{ padding: "6px 8px" }}>Kiểm tra chéo</th>
                    <th style={{ padding: "6px 8px" }}>Thời điểm lập</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(historyPayload.versions || []).map((v: any) => (
                    <tr key={v.bundle_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 700 }}>
                        v{v.bundle_version} {v.is_current_version ? "(Hiện hành)" : "(Lịch sử)"}
                      </td>
                      <td style={{ padding: "6px 8px" }}>{v.bundle_status}</td>
                      <td style={{ padding: "6px 8px" }}>{v.validation_status}</td>
                      <td style={{ padding: "6px 8px" }}>{v.last_generated_at || "N/A"}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => loadBundleDetail(bundleDetail.bundle_id, v.bundle_version)}
                          style={{ padding: "2px 8px", fontSize: 11.5, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0284c7", cursor: "pointer" }}
                        >
                          Xem phiên bản v{v.bundle_version}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Supporting Reports Panel (Section 1.4) */}
          {supportingPayload && (
            <div style={{ marginTop: 14, border: "1px solid #cbd5e1", borderRadius: 6, padding: 14, background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                    Báo cáo hỗ trợ kiểm tra trước lập BCTC (Không thuộc 4 thành phần pháp lý bắt buộc)
                  </h4>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>
                    is_legal_bundle_component = false | Số thành phần pháp lý bắt buộc giữ nguyên: {supportingPayload.required_component_count_unchanged}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSupportingPayload(null)}
                  style={{ padding: "3px 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer", fontSize: 11.5 }}
                >
                  Đóng
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#ffffff", padding: 10, borderRadius: 4, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>
                    1. {supportingPayload.trial_balance_management?.name}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                        <th style={{ padding: 4 }}>TK</th>
                        <th style={{ padding: 4, textAlign: "right" }}>PS Nợ</th>
                        <th style={{ padding: 4, textAlign: "right" }}>PS Có</th>
                        <th style={{ padding: 4, textAlign: "right" }}>Dư Nợ CK</th>
                        <th style={{ padding: 4, textAlign: "right" }}>Dư Có CK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(supportingPayload.trial_balance_management?.rows || []).map((r: any) => (
                        <tr key={r.account_code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: 4, fontWeight: 600 }}>{r.account_code}</td>
                          <td style={{ padding: 4, textAlign: "right" }}>{formatMoney(r.period_debit)}</td>
                          <td style={{ padding: 4, textAlign: "right" }}>{formatMoney(r.period_credit)}</td>
                          <td style={{ padding: 4, textAlign: "right" }}>{formatMoney(r.closing_debit)}</td>
                          <td style={{ padding: 4, textAlign: "right" }}>{formatMoney(r.closing_credit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ background: "#ffffff", padding: 10, borderRadius: 4, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>
                    2. {supportingPayload.state_obligations?.name}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                        <th style={{ padding: 4 }}>Chỉ tiêu thuế</th>
                        <th style={{ padding: 4, textAlign: "right" }}>Phải nộp kỳ này</th>
                        <th style={{ padding: 4, textAlign: "right" }}>Đã nộp kỳ này</th>
                        <th style={{ padding: 4, textAlign: "right" }}>Còn phải nộp CK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(supportingPayload.state_obligations?.rows || []).map((r: any) => (
                        <tr key={r.indicator_code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: 4 }}>{r.indicator_name}</td>
                          <td style={{ padding: 4, textAlign: "right" }}>{formatMoney(r.period_assessed)}</td>
                          <td style={{ padding: 4, textAlign: "right" }}>{formatMoney(r.period_paid)}</td>
                          <td style={{ padding: 4, textAlign: "right", fontWeight: 600 }}>{formatMoney(r.closing_payable)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Export Handoff Confirmation (UC-RPT-15) */}
          {exportPayload && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, fontSize: 12.5, color: "#166534", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>Đã bàn giao lệnh in/xuất sang {exportPayload.target_uc_code}:</strong> Bộ {exportPayload.bundle_code} (v{exportPayload.bundle_version}) — Định dạng: {exportPayload.format} — Chế độ: {exportPayload.export_mode}
                {exportPayload.watermark ? ` — Watermark: "${exportPayload.watermark}"` : " (Bản chính thức)"}
              </div>
              <button
                type="button"
                onClick={() => setExportPayload(null)}
                style={{ background: "transparent", border: "none", color: "#166534", cursor: "pointer", fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "24px 16px", color: "#64748b", fontSize: 13 }}>
          Chưa có Bộ BCTC nào được chọn. Hãy nhấn <strong>&ldquo;Lập / Tạo phiên bản Bộ BCTC mới&rdquo;</strong> để hệ thống tổng hợp tự động 4 báo cáo thành phần từ Sổ cái (GL).
        </div>
      )}
    </div>
  );
}
