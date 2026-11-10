import React, { useEffect, useState, useCallback } from "react";
import { clearLiveApiGetCache, request } from "./live-api";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  History,
  Layers,
  Lock,
  Play,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
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
import {
  StatementPrintExportMenu,
  MisaBranchTagSelector,
  MisaAccumulateFromRadioGroup,
  cleanBundleDisplayName,
  formatPeriodOptionLabel,
  formatRunStatusText,
  formatSavedBundleOptionLabel,
  formatScopeText,
  formatSeverityText,
  formatValidationStatusText,
  openStatementPreviewAndExport,
  type StatementPreviewSection,
} from "./FinancialForm";

const CURRENT_YEAR = new Date().getFullYear();

export interface MisaFinancialBundleWorkspaceProps {
  companyId?: string | null;
  notify?: (msg: string) => void;
  onOpenReportByName?: (reportName: string) => void;
  onBack?: () => void;
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

const COMPONENT_TYPE_LABELS: Record<string, { title: string; subtitle: string }> = {
  FINANCIAL_POSITION: { title: "Báo cáo tình hình tài chính", subtitle: "Tài sản, nợ phải trả và vốn chủ sở hữu" },
  BUSINESS_RESULT: { title: "Báo cáo kết quả hoạt động kinh doanh", subtitle: "Doanh thu, chi phí và lợi nhuận trong kỳ" },
  CASH_FLOW: { title: "Báo cáo lưu chuyển tiền tệ", subtitle: "Dòng tiền thuần từ các hoạt động trong kỳ" },
  FINANCIAL_NOTES: { title: "Bản thuyết minh báo cáo tài chính", subtitle: "Thuyết minh chi tiết các chỉ tiêu BCTC" },
};

const BUNDLE_TYPE_DISPLAY_NAMES: Record<string, string> = {
  ANNUAL_GOING_CONCERN: "Bộ BCTC năm – Hoạt động liên tục",
  ANNUAL_NON_GOING_CONCERN: "Bộ BCTC năm – Không đáp ứng giả định hoạt động liên tục",
  INTERIM_FULL: "Bộ BCTC giữa niên độ – Dạng đầy đủ",
  INTERIM_CONDENSED: "Bộ BCTC giữa niên độ – Dạng tóm lược",
};

function formatStatusLabel(status: string): string {
  switch (status) {
    case "APPROVED": return "Đã duyệt";
    case "READY_FOR_APPROVAL": return "Chờ duyệt";
    case "GENERATED": return "Đã lập";
    case "REVIEW_REQUIRED": return "Cần rà soát";
    case "DRAFT": return "Bản nháp";
    case "FAILED": return "Không đạt";
    case "PASSED": return "Hợp lệ";
    case "PASSED_WITH_WARNING": return "Cảnh báo";
    default: return status || "--";
  }
}

export default function MisaFinancialBundleWorkspace({
  companyId,
  notify,
  onOpenReportByName,
  onBack,
}: MisaFinancialBundleWorkspaceProps) {
  const [catalog, setCatalog] = useState<any>(null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string>("");
  const [bundleDetail, setBundleDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Creation parameters
  const [fiscalYear, setFiscalYear] = useState<number>(CURRENT_YEAR);
  const [fiscalPeriodId, setFiscalPeriodId] = useState<string>("");
  const [bundleType, setBundleType] = useState<string>("ANNUAL_GOING_CONCERN");
  const [reportingScope, setReportingScope] = useState<string>("COMPANY");
  const [branchId, setBranchId] = useState<string>("");
  const [cashFlowMethod, setCashFlowMethod] = useState<string>("DIRECT");
  const [showZeroLines, setShowZeroLines] = useState<boolean>(true);
  const [confirmNonGoingConcern, setConfirmNonGoingConcern] = useState<boolean>(false);
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState<boolean>(false);
  const [fromDate, setFromDate] = useState<string>(`01/01/${CURRENT_YEAR}`);
  const [toDate, setToDate] = useState<string>(`31/12/${CURRENT_YEAR}`);
  const [accumulateFrom, setAccumulateFrom] = useState<"DATA_START" | "FISCAL_YEAR_START">("FISCAL_YEAR_START");

  // Active sub-panels
  const [activeStatementLines, setActiveStatementLines] = useState<any>(null);
  const [drilldownPayload, setDrilldownPayload] = useState<any>(null);
  const [historyPayload, setHistoryPayload] = useState<any>(null);
  const [supportingPayload, setSupportingPayload] = useState<any>(null);
  const [exportPayload, setExportPayload] = useState<any>(null);

  const getWriter = useCallback((): ApiWriter => {
    let sessionToken = "";
    let sessionCompanyId = "";
    try {
      const raw = localStorage.getItem("erp_api_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        sessionToken = parsed.token || parsed.access || "";
        sessionCompanyId = parsed.companyId || "";
      }
    } catch {}

    const cid =
      companyId ||
      sessionCompanyId ||
      localStorage.getItem("erp_company_id") ||
      localStorage.getItem("active_company_id") ||
      localStorage.getItem("company_id") ||
      "";
    const token =
      sessionToken ||
      localStorage.getItem("erp_token") ||
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
        return request(url, token, { headers });
      },
      post: async (url: string, body: any) => {
        return request(url, token, {
          method: "POST",
          headers,
          body: JSON.stringify(body || {}),
        });
      },
      patch: async (url: string, body: any) => {
        return request(url, token, {
          method: "PATCH",
          headers,
          body: JSON.stringify(body || {}),
        });
      },
    } as unknown as ApiWriter;
  }, [companyId]);

  const prefetchedBundleIdRef = React.useRef<string>("");

  const loadCatalogAndList = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const w = getWriter();
      const [catRes, listRes] = await Promise.all([
        fetchFinancialBundleTypesUcRpt02(w),
        fetchFinancialBundlesListUcRpt02(w, { current_only: "false", include_first_detail: "true" }),
      ]);
      setCatalog(catRes);
      if (catRes?.fiscal_periods?.length && !fiscalPeriodId) {
        setFiscalPeriodId(catRes.fiscal_periods[0].id);
        setFiscalYear(catRes.fiscal_periods[0].fiscal_year);
      }
      const items = listRes?.items || [];
      setBundles(items);
      if ((listRes as any)?.first_bundle_detail) {
        const firstDet = (listRes as any).first_bundle_detail;
        const firstDetId = firstDet.bundle_id || firstDet.id || "";
        prefetchedBundleIdRef.current = firstDetId;
        setBundleDetail(firstDet);
        if (firstDetId) {
          setSelectedBundleId((prev) => prev || firstDetId);
        }
      } else if (items.length > 0) {
        const firstId = items[0].bundle_id || items[0].id || "";
        if (firstId) {
          setSelectedBundleId((prev) => prev || firstId);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tải danh mục Bộ báo cáo tài chính.");
    } finally {
      setLoading(false);
    }
  }, [getWriter]);

  const loadBundleDetail = useCallback(
    async (bId: string, ver?: number) => {
      if (!bId) return;
      if (!ver && prefetchedBundleIdRef.current === bId) {
        prefetchedBundleIdRef.current = "";
        return;
      }
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
      notify?.(`Đã kiểm tra chéo bộ báo cáo tài chính: ${formatValidationStatusText(res.validation.validation_status)}.`);
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
      notify?.("Đã trình duyệt Bộ báo cáo tài chính.");
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
      notify?.("Đã phê duyệt chính thức Bộ báo cáo tài chính.");
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
      setErrorMsg(err?.message || "Không thể truy vết nguồn số liệu chỉ tiêu.");
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

  const handleExportBundle = async (
    format: "PRINT" | "PDF" | "XLSX",
    orientation: "portrait" | "landscape" = "portrait",
  ) => {
    if (!bundleDetail?.bundle_id) return;
    setLoading(true);
    try {
      const w = getWriter();
      const exportFormat = format === "XLSX" ? "XLSX" : "PDF";
      const mode = bundleDetail.bundle_status === "APPROVED" ? "OFFICIAL" : "DRAFT";

      // Fetch lines for all available component runs so the preview modal displays the full statements
      const sections: StatementPreviewSection[] = [];
      for (const comp of bundleDetail.components || []) {
        if (!comp.statement_run_id) continue;
        try {
          const linesRes = await fetchFinancialStatementRunLinesUcRpt02(w, comp.statement_run_id, {
            show_zero_lines: showZeroLines ? "true" : "false",
          });
          const rows = (linesRes?.lines || []).map((ln: any) => ({
            name: ln.indicator_name || "",
            code: ln.indicator_code || "",
            note: ln.note_reference || "",
            current:
              ln.current_period_amount !== null && ln.current_period_amount !== undefined
                ? formatMoney(ln.current_period_amount)
                : ln.text_value || "",
            comparative:
              ln.comparative_period_amount !== null && ln.comparative_period_amount !== undefined
                ? formatMoney(ln.comparative_period_amount)
                : "",
            isBold: ln.line_type === "TOTAL" || ln.line_type === "SUBTOTAL",
          }));
          sections.push({
            formCode: comp.legal_form_code || "BCTC",
            title: String(comp.report_name || COMPONENT_TYPE_LABELS[comp.component_type]?.title || "").toUpperCase(),
            periodLabel: linesRes?.period_name
              ? `${cleanBundleDisplayName(linesRes.period_name)} (${linesRes.period_start_date} – ${linesRes.period_end_date})`
              : cleanBundleDisplayName(bundleDetail.bundle_name),
            unitLabel: "VND",
            columns: [
              { key: "name", label: "Chỉ tiêu", align: "left" },
              { key: "code", label: "Mã số", align: "center", width: "70px" },
              { key: "note", label: "Thuyết minh", align: "center", width: "95px" },
              { key: "current", label: "Số cuối kỳ / Kỳ này", align: "right", width: "155px" },
              { key: "comparative", label: "Số đầu năm / Kỳ trước", align: "right", width: "155px" },
            ],
            rows,
          });
        } catch {
          // continue if individual component lines cannot be loaded
        }
      }

      const triggerBackendBundleDownload = async (targetFmt: "PDF" | "XLSX") => {
        const res = await exportFinancialBundleUcRpt02(w, bundleDetail.bundle_id, {
          format: targetFmt,
          export_mode: mode,
        });
        setExportPayload(res);
        // Download first available component file or bundle artifact if present
        const firstCompWithRun = (bundleDetail.components || []).find(
          (c: any) => c.statement_run_id && c.component_type === "FINANCIAL_POSITION",
        );
        if (firstCompWithRun?.statement_run_id) {
          const exportRes: any = await w.post(
            `/api/v1/reports/financial-position/runs/${encodeURIComponent(firstCompWithRun.statement_run_id)}/export/?company_id=${encodeURIComponent(w.companyId)}`,
            {
              company_id: w.companyId,
              export_format: targetFmt === "XLSX" ? "EXCEL" : "PDF",
            },
          );
          if (exportRes?.file_base64) {
            const bytes = Uint8Array.from(atob(exportRes.file_base64), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: exportRes.content_type }));
            const link = document.createElement("a");
            link.href = url;
            link.download = exportRes.file_name || `bo-bctc.${targetFmt.toLowerCase()}`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
          }
        }
        notify?.(
          `Đã xuất Bộ báo cáo tài chính định dạng ${targetFmt === "XLSX" ? "Excel (.xlsx)" : "PDF (.pdf)"} thành công.`,
        );
      };

      await openStatementPreviewAndExport({
        requestedFormat: format,
        orientation,
        reportCode: "Bộ BCTC",
        title: cleanBundleDisplayName(bundleDetail.bundle_name),
        sections:
          sections.length > 0
            ? sections
            : [
                {
                  formCode: "B01-DN .. B09-DN",
                  title: cleanBundleDisplayName(bundleDetail.bundle_name).toUpperCase(),
                  periodLabel: `Năm tài chính ${bundleDetail.fiscal_year || fiscalYear}`,
                  columns: [
                    { key: "code", label: "Biểu mẫu", align: "center", width: "110px" },
                    { key: "name", label: "Tên báo cáo thành phần", align: "left" },
                    { key: "status", label: "Trạng thái", align: "center", width: "160px" },
                  ],
                  rows: (bundleDetail.components || []).map((c: any) => ({
                    code: c.legal_form_code,
                    name: c.report_name,
                    status: formatRunStatusText(c.run_status),
                  })),
                },
              ],
        onDirectDownloadPdf: () => triggerBackendBundleDownload("PDF"),
        onDirectDownloadExcel: () => triggerBackendBundleDownload("XLSX"),
      });
      void exportFormat;
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể mở bản xem trước Bộ báo cáo tài chính.");
    } finally {
      setLoading(false);
    }
  };

  const periods = catalog?.fiscal_periods || [];
  const bundleTypes = [
    { code: "ANNUAL_GOING_CONCERN", name: "BCTC năm – Hoạt động liên tục (B01-DN đến B09-DN)" },
    { code: "ANNUAL_NON_GOING_CONCERN", name: "BCTC năm – Không đáp ứng giả định hoạt động liên tục" },
    { code: "INTERIM_FULL", name: "BCTC giữa niên độ – Dạng đầy đủ (B01a-DN đến B09a-DN)" },
    { code: "INTERIM_CONDENSED", name: "BCTC giữa niên độ – Dạng tóm lược (B01b-DN đến B09a-DN)" },
  ];

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "16px 18px", marginBottom: 20, maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", borderBottom: "1px solid #e2e8f0", paddingBottom: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title="Quay lại danh sách báo cáo"
              style={{
                height: 32,
                padding: "0 12px",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#334155",
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <span>← Quay lại</span>
            </button>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Layers size={18} color="var(--brand)" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Quản lý & Xem Bộ Báo Cáo Tài Chính (Thông tư 99/2025/TT-BTC)
              </h3>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
              Tra cứu, tổng hợp, đối chiếu số liệu giữa các biểu mẫu (B01, B02, B03, B09), quản lý phiên bản, phê duyệt và truy vết nguồn Sổ cái.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => {
              clearLiveApiGetCache();
              void loadCatalogAndList();
            }}
            style={{ height: 32, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          >
            <RefreshCw size={14} />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            onClick={handleCreateOrGenerateBundle}
            disabled={loading}
            style={{ height: 32, padding: "0 14px", background: "#ffffff", border: "1px solid var(--brand)", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "var(--brand)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          >
            <Play size={14} />
            <span>Lập / Tạo phiên bản Bộ BCTC mới</span>
          </button>
          <button
            type="button"
            onClick={() => setIsParamDrawerOpen(true)}
            style={{ height: 32, padding: "0 16px", background: "var(--brand)", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          >
            <span>Chọn tham số</span>
          </button>
        </div>
      </div>

      {/* Compact Active Parameter Summary Strip + Saved Bundle Version Selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, background: "#f8fafc", padding: "10px 14px", borderRadius: 6, border: "1px solid #e2e8f0", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "#475569" }}>
          <span>
            Loại bộ BCTC: <strong style={{ color: "#0f172a" }}>{BUNDLE_TYPE_DISPLAY_NAMES[bundleType] || "Bộ BCTC năm – Hoạt động liên tục"}</strong>
          </span>
          <span>•</span>
          <span>
            Kỳ báo cáo: <strong style={{ color: "#0f172a" }}>{(() => {
              const found = periods.find((p: any) => String(p.id) === String(fiscalPeriodId));
              return found ? formatPeriodOptionLabel(found) : `Năm ${fiscalYear} (${fromDate} - ${toDate})`;
            })()}</strong>
          </span>
          <span>•</span>
          <span>
            LCTT (B03): <strong style={{ color: "#0f172a" }}>{cashFlowMethod === "INDIRECT" ? "PP gián tiếp (B03-DN-GT)" : "PP trực tiếp (B03-DN)"}</strong>
          </span>
          <span>•</span>
          <span>
            Phạm vi: <strong style={{ color: "#0f172a" }}>{formatScopeText(reportingScope)}</strong>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 320, flex: "0 1 420px" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>Phiên bản đã lưu ({bundles.length}):</span>
          <select
            className="misa-select"
            value={selectedBundleId}
            onChange={(e) => setSelectedBundleId(e.target.value)}
            style={{ width: "100%", height: 30, fontSize: 12.5 }}
          >
            <option value="">-- Chọn phiên bản Bộ BCTC đã lưu ({bundles.length}) --</option>
            {bundles.map((b: any, idx: number) => {
              const bid = b.bundle_id || b.id || String(idx);
              return (
                <option key={bid} value={bid}>
                  {formatSavedBundleOptionLabel(b, idx)}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Confirmation checkbox for Non-going concern */}
      {bundleType === "ANNUAL_NON_GOING_CONCERN" && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#92400e" }}>
          <AlertTriangle size={16} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={confirmNonGoingConcern}
              onChange={(e) => setConfirmNonGoingConcern(e.target.checked)}
            />
            Xác nhận doanh nghiệp thuộc trường hợp không đáp ứng giả định hoạt động liên tục (áp dụng bộ mẫu B01-DNKLT đến B09-DNKLT).
          </label>
        </div>
      )}

      {errorMsg && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginBottom: 14, color: "#991b1b", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <XCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Selected Bundle Workspace */}
      {bundleDetail ? (
        <div>
          {/* Bundle Metadata & Workflow Bar */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
            {/* Top row: Bundle Title & Status on left, Actions on right */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderBottom: "1px solid #e2e8f0", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                  {cleanBundleDisplayName(bundleDetail.bundle_name)}
                </h4>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "#475569" }}>
                  <span>
                    Phiên bản: <strong style={{ color: "#0f172a" }}>Lần {bundleDetail.bundle_version || 1}</strong>
                  </span>
                  <span style={{ color: "#cbd5e1" }}>•</span>
                  <span>
                    Trạng thái:{" "}
                    <strong style={{ color: bundleDetail.bundle_status === "APPROVED" ? "#15803d" : "var(--brand-hover)" }}>
                      {formatRunStatusText(bundleDetail.bundle_status)}
                    </strong>
                  </span>
                  <span style={{ color: "#cbd5e1" }}>•</span>
                  <span>
                    Kết quả đối chiếu chéo:{" "}
                    <strong style={{ color: bundleDetail.validation_status === "FAILED" ? "#b91c1c" : "#15803d" }}>
                      {formatValidationStatusText(bundleDetail.validation_status)}
                    </strong>
                  </span>
                  {bundleDetail.is_stale && (
                    <>
                      <span style={{ color: "#cbd5e1" }}>•</span>
                      <span style={{ color: "#b45309", fontWeight: 600 }}>
                        Phát sinh bút toán Sổ cái mới (cần tổng hợp lại)
                      </span>
                    </>
                  )}
                  {bundleDetail.is_period_closed && (
                    <>
                      <span style={{ color: "#cbd5e1" }}>•</span>
                      <span style={{ color: "#334155", fontWeight: 600 }}>
                        Kỳ kế toán đã khóa sổ
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleValidateBundle}
                  style={{ height: 32, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, fontWeight: 600, color: "#334155", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                >
                  <RefreshCw size={13} />
                  <span>Kiểm tra chéo lại</span>
                </button>
                {bundleDetail.permissions?.can_generate && bundleDetail.bundle_status !== "APPROVED" && (
                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    style={{ height: 32, padding: "0 12px", background: "var(--brand)", border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Trình duyệt</span>
                  </button>
                )}
                {bundleDetail.permissions?.can_approve && bundleDetail.bundle_status !== "APPROVED" && (
                  <button
                    type="button"
                    onClick={handleApproveBundle}
                    style={{ height: 32, padding: "0 12px", background: "#16a34a", border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                  >
                    <ShieldCheck size={13} />
                    <span>Phê duyệt Bộ BCTC</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenHistory}
                  style={{ height: 32, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, fontWeight: 600, color: "#334155", display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <History size={13} />
                  <span>Lịch sử phiên bản</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenSupportingReports}
                  style={{ height: 32, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, fontWeight: 600, color: "#334155", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                >
                  <FileSpreadsheet size={13} />
                  <span>Báo cáo đối chiếu hỗ trợ</span>
                </button>
                {bundleDetail.permissions?.can_export && (
                  <StatementPrintExportMenu
                    compact={false}
                    buttonLabel="In / Xuất BCTC"
                    onPreviewAction={(fmt, orient) => void handleExportBundle(fmt, orient)}
                  />
                )}
              </div>
            </div>

            {/* Bottom metadata summary in natural Vietnamese without emojis */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 12.5, color: "#475569" }}>
              <span>
                Đơn vị: <strong>{bundleDetail.company_name}</strong> (MST: {bundleDetail.tax_code || "Chưa khai báo"})
              </span>
              <span style={{ color: "#cbd5e1" }}>•</span>
              <span>
                Chế độ kế toán: <strong>Thông tư 99/2025/TT-BTC</strong>
              </span>
              <span style={{ color: "#cbd5e1" }}>•</span>
              <span>
                Biểu mẫu thành phần: <strong>Đã lập {bundleDetail.available_component_count}/4 biểu mẫu</strong> ({bundleDetail.approved_component_count}/4 đã phê duyệt)
              </span>
              <span style={{ color: "#cbd5e1" }}>•</span>
              <span style={{ color: bundleDetail.blocker_count > 0 ? "#dc2626" : "#15803d", fontWeight: 600 }}>
                {bundleDetail.blocker_count === 0 && bundleDetail.warning_count === 0
                  ? "Đối chiếu số liệu: Khớp đầy đủ, không có cảnh báo"
                  : `Đối chiếu số liệu: Có ${bundleDetail.blocker_count || 0} chỉ tiêu lệch cần xử lý, ${bundleDetail.warning_count || 0} mục lưu ý`}
              </span>
            </div>
          </div>

          {/* 4 Required Legal Components Table */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                Danh mục 4 Báo cáo tài chính thành phần bắt buộc ({BUNDLE_TYPE_DISPLAY_NAMES[bundleDetail.bundle_type] || cleanBundleDisplayName(bundleDetail.bundle_name)})
              </h4>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Áp dụng theo biểu mẫu chuẩn Thông tư 99/2025/TT-BTC
              </span>
            </div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", background: "#ffffff", width: "100%", boxSizing: "border-box" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left", tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", color: "#475569", fontWeight: 700 }}>
                    <th style={{ padding: "10px 8px", width: 68, textAlign: "center", whiteSpace: "nowrap" }}>Mẫu số</th>
                    <th style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>Tên báo cáo thành phần</th>
                    <th style={{ padding: "10px 8px", width: 124, textAlign: "center", whiteSpace: "nowrap" }}>Trạng thái lập</th>
                    <th style={{ padding: "10px 8px", width: 126, textAlign: "center", whiteSpace: "nowrap" }}>Kết quả đối chiếu</th>
                    <th style={{ padding: "10px 10px", width: 334, textAlign: "right", whiteSpace: "nowrap" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(bundleDetail.components || []).map((comp: any) => {
                    const friendly = COMPONENT_TYPE_LABELS[comp.component_type] || {
                      title: comp.report_name || "Báo cáo tài chính",
                      subtitle: "",
                    };
                    return (
                      <tr key={comp.component_type} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <span style={{ padding: "3px 8px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 4, fontWeight: 700, fontSize: 12, color: "#0f172a", display: "inline-block" }}>
                            {comp.legal_form_code}
                          </span>
                        </td>
                        <td style={{ padding: "10px 10px", minWidth: 0 }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 13, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                              <span>{friendly.title}</span>
                              {comp.is_stale && (
                                <span style={{ fontSize: 11, color: "#b45309", fontWeight: 600 }}>
                                  (Cần lập lại)
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, whiteSpace: "nowrap" }}>
                              {friendly.subtitle || comp.report_name}
                            </div>
                            {comp.error_message && (
                              <div style={{ color: "#dc2626", fontSize: 11.5, marginTop: 2 }}>{comp.error_message}</div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: comp.run_status === "APPROVED" ? "#15803d" : "var(--brand-hover)" }}>
                            {comp.run_status === "APPROVED"
                              ? "Đã phê duyệt"
                              : comp.run_status === "READY_FOR_APPROVAL"
                              ? "Chờ phê duyệt"
                              : comp.statement_run_id
                              ? "Đã tổng hợp"
                              : "Chưa tổng hợp"}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                            {comp.run_version ? `Phiên bản lần ${comp.run_version}` : "Chưa có dữ liệu"}
                          </div>
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: comp.validation_status === "FAILED" ? "#b91c1c" : "#15803d" }}>
                            {comp.validation_status === "FAILED"
                              ? "Có chỉ tiêu lệch"
                              : comp.validation_status === "PASSED_WITH_WARNING"
                              ? "Cân đối hợp lệ"
                              : comp.statement_run_id
                              ? "Cân đối hợp lệ"
                              : "Chưa kiểm tra"}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                            {comp.validation_status === "PASSED_WITH_WARNING"
                              ? "Có mục cần lưu ý"
                              : comp.validation_status === "FAILED"
                              ? "Cần rà soát lại"
                              : comp.statement_run_id
                              ? "Khớp số liệu Sổ cái"
                              : "—"}
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "122px 62px 62px 64px", gap: 5, alignItems: "center", justifyContent: "end" }}>
                            {comp.statement_run_id ? (
                              <button
                                type="button"
                                onClick={() => handleOpenStatementLines(comp.statement_run_id)}
                                style={{ width: 122, height: 28, padding: "0 5px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 5, fontSize: 11.5, fontWeight: 600, color: "#166534", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, whiteSpace: "nowrap", boxSizing: "border-box" }}
                              >
                                <Eye size={12} />
                                <span>Xem chỉ tiêu ({comp.line_count})</span>
                              </button>
                            ) : (
                              <div style={{ width: 122 }} />
                            )}
                            {bundleDetail.permissions?.can_generate && !bundleDetail.read_only ? (
                              <button
                                type="button"
                                onClick={() => handleRegenerateComponent(comp)}
                                style={{ width: 62, height: 28, padding: "0 4px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 5, fontSize: 11.5, color: "#334155", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, whiteSpace: "nowrap", boxSizing: "border-box" }}
                              >
                                <RefreshCw size={11} />
                                <span>Lập lại</span>
                              </button>
                            ) : (
                              <div style={{ width: 62 }} />
                            )}
                            {comp.statement_run_id &&
                              comp.run_status !== "APPROVED" &&
                              bundleDetail.permissions?.can_approve ? (
                                <button
                                  type="button"
                                  onClick={() => handleApproveComponentRun(comp.statement_run_id)}
                                  style={{ width: 62, height: 28, padding: "0 4px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 5, fontSize: 11.5, fontWeight: 600, color: "#1d4ed8", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, whiteSpace: "nowrap", boxSizing: "border-box" }}
                                >
                                  <ShieldCheck size={11} />
                                  <span>Duyệt</span>
                                </button>
                              ) : comp.run_status === "APPROVED" ? (
                                <div
                                  style={{
                                    width: 62,
                                    height: 28,
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    color: "#166534",
                                    background: "#f0fdf4",
                                    border: "1px solid #bbf7d0",
                                    borderRadius: 5,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 3,
                                    boxSizing: "border-box",
                                  }}
                                >
                                  <CheckCircle2 size={11} />
                                  <span>Đã duyệt</span>
                                </div>
                              ) : (
                                <div style={{ width: 62 }} />
                              )}
                            {onOpenReportByName && LEGAL_FORM_TO_REPORT_NAME[comp.legal_form_code] ? (
                              <button
                                type="button"
                                onClick={() => onOpenReportByName(LEGAL_FORM_TO_REPORT_NAME[comp.legal_form_code])}
                                style={{ width: 64, height: 28, padding: "0 4px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 5, fontSize: 11.5, fontWeight: 600, color: "var(--brand)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, whiteSpace: "nowrap", boxSizing: "border-box" }}
                              >
                                <FileText size={11} />
                                <span>Mở biểu</span>
                              </button>
                            ) : (
                              <div style={{ width: 64 }} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cross-Statement Validations Panel */}
          {(bundleDetail.validations || []).length > 0 && (
            <div style={{ marginBottom: 16, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={16} color="#b45309" />
                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#92400e" }}>
                  Kết quả kiểm tra đối chiếu giữa các báo cáo trong Bộ BCTC ({bundleDetail.validations.length} nội dung)
                </h4>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, lineHeight: 1.7 }}>
                {bundleDetail.validations.map((v: any) => (
                  <li key={v.id} style={{ color: v.severity === "BLOCKER" ? "#b91c1c" : "#92400e", marginBottom: 4 }}>
                    <strong style={{ marginRight: 6 }}>
                      [{formatSeverityText(v.severity)}] {COMPONENT_TYPE_LABELS[v.component_type]?.title || "Báo cáo tài chính"}
                    </strong>
                    {v.indicator_code ? ` (Mã số ${v.indicator_code})` : ""}: {v.message}
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
                    {activeStatementLines.legal_form_code} – {activeStatementLines.statement_title} (Phiên bản lần {activeStatementLines.run_version || 1})
                  </h4>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Kỳ báo cáo: {cleanBundleDisplayName(activeStatementLines.period_name)} ({activeStatementLines.period_start_date} – {activeStatementLines.period_end_date}) | Nhấn vào dòng chỉ tiêu để truy vết bút toán Sổ cái.
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

              <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 780 }}>
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
                          <td style={{ padding: "7px 10px", textAlign: "center", color: "var(--brand)" }}>{ln.note_reference}</td>
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
                              style={{ padding: "2px 8px", fontSize: 11, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "var(--brand)", cursor: "pointer" }}
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
            </div>
          )}

          {/* Drill-down Source Modal / Panel */}
          {drilldownPayload && (
            <div style={{ marginTop: 14, border: "1px solid #93c5fd", borderRadius: 6, padding: 14, background: "#eff6ff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#1e3a8a" }}>
                  Truy vết nguồn số liệu Sổ cái — Chỉ tiêu [{drilldownPayload.indicator_code}] {drilldownPayload.indicator_name}
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
                <strong>{drilldownPayload.formula_expression || "Tổng hợp theo tài khoản Sổ cái"}</strong> | Tài khoản lấy số liệu:{" "}
                {(drilldownPayload.account_mappings || []).map((m: any) => `TK ${m.account_prefix}`).join(", ") || "Chỉ tiêu tổng hợp"}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#ffffff", border: "1px solid #bfdbfe", minWidth: 600 }}>
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
            </div>
          )}

          {/* Version History Panel */}
          {historyPayload && (
            <div style={{ marginTop: 14, border: "1px solid #cbd5e1", borderRadius: 6, padding: 14, background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                  Lịch sử các phiên bản đã lập của Bộ báo cáo tài chính
                </h4>
                <button
                  type="button"
                  onClick={() => setHistoryPayload(null)}
                  style={{ padding: "3px 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer", fontSize: 11.5 }}
                >
                  Đóng
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#ffffff", border: "1px solid #e2e8f0", minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                      <th style={{ padding: "6px 8px" }}>Phiên bản</th>
                      <th style={{ padding: "6px 8px" }}>Trạng thái</th>
                      <th style={{ padding: "6px 8px" }}>Kiểm tra đối chiếu</th>
                      <th style={{ padding: "6px 8px" }}>Thời điểm lập</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(historyPayload.versions || []).map((v: any) => (
                      <tr key={v.bundle_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 700 }}>
                          Phiên bản lần {v.bundle_version} {v.is_current_version ? "(Đang áp dụng)" : "(Bản lưu trước)"}
                        </td>
                        <td style={{ padding: "6px 8px" }}>{formatRunStatusText(v.bundle_status)}</td>
                        <td style={{ padding: "6px 8px" }}>{formatValidationStatusText(v.validation_status)}</td>
                        <td style={{ padding: "6px 8px" }}>{v.last_generated_at || "—"}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => loadBundleDetail(bundleDetail.bundle_id, v.bundle_version)}
                            style={{ padding: "2px 8px", fontSize: 11.5, border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "var(--brand)", cursor: "pointer" }}
                          >
                            Xem phiên bản lần {v.bundle_version}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Supporting Reports Panel */}
          {supportingPayload && (
            <div style={{ marginTop: 14, border: "1px solid #cbd5e1", borderRadius: 6, padding: 14, background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                    Báo cáo hỗ trợ kiểm tra đối chiếu trước khi lập Báo cáo tài chính
                  </h4>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>
                    Dùng để kiểm tra số dư tài khoản và nghĩa vụ thuế trước khi phê duyệt chính thức Bộ báo cáo tài chính
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

          {/* Export Handoff Confirmation */}
          {exportPayload && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, fontSize: 12.5, color: "#166534", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>Đã xuất Bộ báo cáo tài chính (Phiên bản lần {exportPayload.bundle_version || 1}):</strong> Định dạng {exportPayload.format === "XLSX" ? "Excel (.xlsx)" : "PDF (.pdf)"} — {exportPayload.export_mode === "OFFICIAL" ? "Bản chính thức đã phê duyệt" : "Bản xem trước / nháp"}
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

      {/* Right-Side Slide-Over Parameter Drawer ("Chọn tham số" MISA AMIS style) */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              background: "#ffffff",
              height: "100%",
              boxShadow: "-8px 0 30px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}
                  title="Trợ giúp"
                  onClick={() => notify?.("Hướng dẫn chọn tham số lập và xem Bộ Báo cáo tài chính theo Thông tư 99/2025/TT-BTC.")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}
                  title="Đóng"
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div
              style={{
                padding: "20px 24px",
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                fontSize: 13,
              }}
            >
              {/* 1. Chi nhánh (MISA tag selector) */}
              <MisaBranchTagSelector
                branches={catalog?.branches || []}
                selectedScope={reportingScope}
                selectedBranchId={branchId}
                onChange={(scope, bid) => {
                  setReportingScope(scope);
                  setBranchId(bid);
                }}
              />

              {/* 2. Kỳ báo cáo * */}
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                  Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  className="misa-select"
                  value={fiscalPeriodId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setFiscalPeriodId(pid);
                    const found = periods.find((p: any) => String(p.id) === String(pid));
                    if (found) {
                      setFiscalYear(found.fiscal_year || CURRENT_YEAR);
                      if (found.start_date) {
                        const [y, m, d] = String(found.start_date).split("-");
                        if (y && m && d) setFromDate(`${d}/${m}/${y}`);
                      }
                      if (found.end_date) {
                        const [y, m, d] = String(found.end_date).split("-");
                        if (y && m && d) setToDate(`${d}/${m}/${y}`);
                      }
                    }
                  }}
                  style={{ width: "100%" }}
                >
                  {periods.length === 0 && <option value="">Năm nay ({fiscalYear})</option>}
                  {periods.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {formatPeriodOptionLabel(p)}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Từ ngày & Đến ngày */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 4. Loại bộ báo cáo tài chính */}
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                  Loại bộ báo cáo tài chính
                </label>
                <select
                  className="misa-select"
                  value={bundleType}
                  onChange={(e) => setBundleType(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {bundleTypes.map((bt: any) => (
                    <option key={bt.code} value={bt.code}>
                      {bt.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Phương pháp Lưu chuyển tiền tệ (B03) */}
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                  Phương pháp Lưu chuyển tiền tệ (B03)
                </label>
                <select
                  className="misa-select"
                  value={cashFlowMethod}
                  onChange={(e) => setCashFlowMethod(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="DIRECT">Phương pháp trực tiếp (Mẫu B03-DN)</option>
                  <option value="INDIRECT">Phương pháp gián tiếp (Mẫu B03-DN-GT)</option>
                </select>
              </div>

              {/* 6. Phiên bản Bộ BCTC đã lưu */}
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                  Phiên bản Bộ BCTC đã lưu ({bundles.length})
                </label>
                <select
                  className="misa-select"
                  value={selectedBundleId}
                  onChange={(e) => setSelectedBundleId(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">-- Chọn phiên bản Bộ BCTC đã lưu ({bundles.length}) --</option>
                  {bundles.map((b: any, idx: number) => {
                    const bid = b.bundle_id || b.id || String(idx);
                    return (
                      <option key={bid} value={bid}>
                        {formatSavedBundleOptionLabel(b, idx)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 7. Checkbox */}
              <div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!showZeroLines}
                    onChange={(e) => setShowZeroLines(!e.target.checked)}
                    style={{ accentColor: "var(--brand)", width: 16, height: 16 }}
                  />
                  <span>Không hiển thị các chỉ tiêu có số liệu = 0</span>
                </label>
              </div>

              {/* 8. Lấy lũy kế phát sinh từ */}
              <MisaAccumulateFromRadioGroup
                value={accumulateFrom}
                onChange={setAccumulateFrom}
                name="bundleAccumulateFrom"
              />
            </div>

            {/* Drawer Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setBundleType("ANNUAL_GOING_CONCERN");
                  setCashFlowMethod("DIRECT");
                  setReportingScope("COMPANY");
                  setBranchId("");
                  setFromDate(`01/01/${CURRENT_YEAR}`);
                  setToDate(`31/12/${CURRENT_YEAR}`);
                  setAccumulateFrom("FISCAL_YEAR_START");
                }}
                style={{
                  height: 34,
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#475569",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Xóa điều kiện
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    height: 34,
                    padding: "0 16px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#334155",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsParamDrawerOpen(false);
                  }}
                  style={{
                    height: 34,
                    padding: "0 18px",
                    background: "var(--brand)",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
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
