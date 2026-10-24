import React, { useState, useEffect, useCallback, useMemo } from "react";
import { apiClient, getSelectedCompanyId } from "./apiClient";
import {
  ChevronLeft,
  Search,
  RotateCw,
  Mail,
  MessageCircle,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Calendar,
  ChevronDown,
  Sparkles,
  FileCheck,
  BookOpen,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Edit3,
  Layers,
  ShieldCheck,
  Filter,
} from "lucide-react";

export interface MisaFinancialNotesReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

interface NoteTableColumn {
  column_code: string;
  column_label: string;
  column_group?: string;
  data_type?: string;
}

interface NoteTableRowItem {
  row_id: string;
  row_code: string;
  row_label: string;
  row_level: number;
  display_order: number;
  is_total_row: boolean;
  column_values: Record<string, any>;
  drilldown_reference?: Record<string, any>;
}

interface NoteTableItem {
  table_id: string;
  table_code: string;
  table_title: string;
  column_schema: NoteTableColumn[];
  rows: NoteTableRowItem[];
}

interface NoteContentPayload {
  content_id: string | null;
  content_version: number;
  content_status: string;
  is_applicable: boolean;
  not_applicable_reason: string | null;
  applicability_evidence: string;
  data_origin: string;
  text_content: string;
  structured_content: Record<string, any>;
  source_snapshot_reference: string;
}

interface NoteItemPayload {
  note_item_id: string;
  section_code: string;
  note_code: string;
  note_title: string;
  content_type: string;
  display_order: number;
  data_origin: string;
  source_module: string;
  related_report_code: string;
  related_indicator_codes: string[];
  is_required: boolean;
  content: NoteContentPayload;
  tables: NoteTableItem[];
}

interface NoteSectionPayload {
  section_id: string;
  section_code: string;
  section_title: string;
  display_order: number;
  is_required: boolean;
  item_count: number;
  completed_count: number;
  manual_required_count: number;
  not_applicable_count: number;
  items: NoteItemPayload[];
}

const STATUS_BADGE_MAP: Record<
  string,
  { label: string; bg: string; color: string; border: string }
> = {
  APPROVED: {
    label: "Đã duyệt (APPROVED)",
    bg: "#dcfce7",
    color: "#166534",
    border: "#86efac",
  },
  VALIDATED: {
    label: "Đã kiểm tra (VALIDATED)",
    bg: "#e0f2fe",
    color: "#0369a1",
    border: "#7dd3fc",
  },
  COMPLETED: {
    label: "Hoàn tất (COMPLETED)",
    bg: "#f0fdf4",
    color: "#15803d",
    border: "#bbf7d0",
  },
  AUTO_POPULATED: {
    label: "Tự động từ GL/BCTC",
    bg: "#f8fafc",
    color: "#334155",
    border: "#cbd5e1",
  },
  REVIEW_REQUIRED: {
    label: "Cần rà soát xác nhận",
    bg: "#fef9c3",
    color: "#854d0e",
    border: "#fde047",
  },
  MANUAL_REQUIRED: {
    label: "Cần bổ sung thủ công",
    bg: "#ffedd5",
    color: "#c2410c",
    border: "#fdba74",
  },
  NOT_APPLICABLE: {
    label: "Không áp dụng (N/A)",
    bg: "#f1f5f9",
    color: "#64748b",
    border: "#cbd5e1",
  },
  STALE: {
    label: "Dữ liệu nguồn thay đổi (STALE)",
    bg: "#fee2e2",
    color: "#b91c1c",
    border: "#fca5a5",
  },
  NOT_STARTED: {
    label: "Chưa chuẩn bị",
    bg: "#f1f5f9",
    color: "#475569",
    border: "#cbd5e1",
  },
};

export default function MisaFinancialNotesReport({
  onBack,
  notify,
}: MisaFinancialNotesReportProps) {
  // Filter & Parameter State
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [templateCode, setTemplateCode] = useState<string>("B09-DN");
  const [periodType, setPeriodType] = useState<string>("ANNUAL");
  const [goingConcernStatus, setGoingConcernStatus] = useState<string>("GOING_CONCERN");
  const [reportingScope, setReportingScope] = useState<string>("ENTERPRISE");
  const [branchId, setBranchId] = useState<string>("");
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [fiscalPeriodId, setFiscalPeriodId] = useState<string>("");
  const [periodLabel, setPeriodLabel] = useState<string>("Năm nay");
  const [fromDate, setFromDate] = useState<string>("2026-01-01");
  const [toDate, setToDate] = useState<string>("2026-12-31");
  const [hideNotApplicable, setHideNotApplicable] = useState<boolean>(false);

  // Draft drawer state
  const [draftTemplateCode, setDraftTemplateCode] = useState<string>("B09-DN");
  const [draftPeriodType, setDraftPeriodType] = useState<string>("ANNUAL");
  const [draftGoingConcern, setDraftGoingConcern] = useState<string>("GOING_CONCERN");
  const [draftScope, setDraftScope] = useState<string>("ENTERPRISE");
  const [draftBranchId, setDraftBranchId] = useState<string>("");
  const [draftFiscalYear, setDraftFiscalYear] = useState<number>(2026);
  const [draftPeriodId, setDraftPeriodId] = useState<string>("");
  const [draftFromDate, setDraftFromDate] = useState<string>("2026-01-01");
  const [draftToDate, setDraftToDate] = useState<string>("2026-12-31");

  // Available parameters from Backend
  const [availablePeriods, setAvailablePeriods] = useState<any[]>([]);
  const [availableBranches, setAvailableBranches] = useState<any[]>([]);
  const [companyInfo, setCompanyInfo] = useState<{ name: string; tax_code: string }>({
    name: "",
    tax_code: "",
  });

  // Active Statement Run & Sections
  const [loading, setLoading] = useState<boolean>(false);
  const [activeRun, setActiveRun] = useState<any | null>(null);
  const [sections, setSections] = useState<NoteSectionPayload[]>([]);
  const [savedRuns, setSavedRuns] = useState<any[]>([]);
  const [activeSectionCode, setActiveSectionCode] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // Modals & Drawers
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState<boolean>(false);
  const [isValidationDrawerOpen, setIsValidationDrawerOpen] = useState<boolean>(false);
  const [validationPayload, setValidationPayload] = useState<any | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [showAiAnalysis, setShowAiAnalysis] = useState<boolean>(false);

  // Source Drill-down Drawer
  const [sourceDrawerNote, setSourceDrawerNote] = useState<string | null>(null);
  const [sourceDrawerData, setSourceDrawerData] = useState<any | null>(null);
  const [loadingSources, setLoadingSources] = useState<boolean>(false);

  // Manual Edit / Confirmation Modal
  const [editingItem, setEditingItem] = useState<NoteItemPayload | null>(null);
  const [editTextContent, setEditTextContent] = useState<string>("");
  const [editIsApplicable, setEditIsApplicable] = useState<boolean>(true);
  const [editNaReason, setEditNaReason] = useState<string>("");
  const [editConfirmed, setEditConfirmed] = useState<boolean>(true);

  const formatMoney = (val: any): string => {
    if (val === null || val === undefined || val === "") return "—";
    const num = Number(val);
    if (Number.isNaN(num)) return String(val);
    if (num === 0) return "0";
    if (num < 0) return `(${Math.abs(num).toLocaleString("vi-VN")})`;
    return num.toLocaleString("vi-VN");
  };

  const loadRunFullDetail = useCallback(
    async (runId: string, cid: string | null) => {
      const q = new URLSearchParams();
      if (cid) q.set("company_id", cid);
      if (hideNotApplicable) q.set("hide_not_applicable", "true");
      if (searchKeyword.trim()) q.set("search", searchKeyword.trim());

      const [hdrRes, secRes]: [any, any] = await Promise.all([
        apiClient.get(`/api/v1/reports/financial-notes/runs/${encodeURIComponent(runId)}/?${q.toString()}`),
        apiClient.get(`/api/v1/reports/financial-notes/runs/${encodeURIComponent(runId)}/sections/?${q.toString()}`),
      ]);
      if (hdrRes) {
        setActiveRun(hdrRes);
        setTemplateCode(hdrRes.legal_form_code || "B09-DN");
        setFromDate(hdrRes.period_start_date || fromDate);
        setToDate(hdrRes.period_end_date || toDate);
      }
      if (secRes && Array.isArray(secRes.sections)) {
        setSections(secRes.sections);
      }
    },
    [fromDate, toDate, hideNotApplicable, searchKeyword]
  );

  const loadOrGenerateNotes = useCallback(
    async (opts?: {
      forceGenerate?: boolean;
      overrideTemplate?: string;
      overridePeriodType?: string;
      overrideGoingConcern?: string;
      overrideScope?: string;
      overrideBranchId?: string;
      overrideYear?: number;
      overridePeriodId?: string;
      overrideStartDate?: string;
      overrideEndDate?: string;
    }) => {
      setLoading(true);
      try {
        const cid = getSelectedCompanyId();
        const tCode = opts?.overrideTemplate ?? templateCode;
        const pType = opts?.overridePeriodType ?? periodType;
        const gcStatus = opts?.overrideGoingConcern ?? goingConcernStatus;
        const scope = opts?.overrideScope ?? reportingScope;
        const bId = opts?.overrideBranchId ?? branchId;
        const fYear = opts?.overrideYear ?? fiscalYear;
        const pId = opts?.overridePeriodId ?? fiscalPeriodId;
        const sDate = opts?.overrideStartDate ?? fromDate;
        const eDate = opts?.overrideEndDate ?? toDate;

        const qParams = new URLSearchParams();
        if (cid) qParams.set("company_id", cid);

        // Load parameters metadata
        const paramRes: any = await apiClient
          .get(`/api/v1/reports/financial-notes/parameters/?${qParams.toString()}`)
          .catch(() => null);
        if (paramRes) {
          setAvailablePeriods(paramRes.periods || []);
          setAvailableBranches(paramRes.branches || []);
          setCompanyInfo({
            name: paramRes.company_name || "",
            tax_code: paramRes.company_tax_code || "",
          });
        }

        // List existing runs
        const listQs = new URLSearchParams();
        if (cid) listQs.set("company_id", cid);
        listQs.set("template_code", tCode);
        listQs.set("fiscal_year", String(fYear));
        const runsRes: any = await apiClient
          .get(`/api/v1/reports/financial-notes/runs/?${listQs.toString()}`)
          .catch(() => ({ runs: [] }));
        const existingRuns = Array.isArray(runsRes?.runs) ? runsRes.runs : [];
        setSavedRuns(existingRuns);

        if (!opts?.forceGenerate && existingRuns.length > 0) {
          await loadRunFullDetail(existingRuns[0].run_id, cid);
        } else {
          // Generate a new B09 run from GL/BCTC snapshot
          const createBody: Record<string, any> = {
            company_id: cid,
            template_code: tCode,
            period_type: pType,
            going_concern_status: gcStatus,
            reporting_scope: scope,
            fiscal_year: fYear,
          };
          if (bId && scope === "BRANCH") createBody.branch_id = bId;
          if (pId) createBody.fiscal_period_id = pId;
          if (sDate && eDate) {
            createBody.period_start_date = sDate;
            createBody.period_end_date = eDate;
          }
          const created: any = await apiClient.post(
            "/api/v1/reports/financial-notes/runs/",
            createBody
          );
          if (created?.run_id) {
            await loadRunFullDetail(created.run_id, cid);
            // Refresh saved runs list
            const updatedRuns: any = await apiClient
              .get(`/api/v1/reports/financial-notes/runs/?${listQs.toString()}`)
              .catch(() => ({ runs: [] }));
            setSavedRuns(updatedRuns?.runs || []);
          }
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          "Không thể tải hoặc khởi tạo Thuyết minh BCTC.";
        notify?.(String(msg));
      } finally {
        setLoading(false);
      }
    },
    [
      templateCode,
      periodType,
      goingConcernStatus,
      reportingScope,
      branchId,
      fiscalYear,
      fiscalPeriodId,
      fromDate,
      toDate,
      loadRunFullDetail,
      notify,
    ]
  );

  useEffect(() => {
    void loadOrGenerateNotes();
  }, []);

  const handleOpenDrawer = () => {
    setDraftTemplateCode(templateCode);
    setDraftPeriodType(periodType);
    setDraftGoingConcern(goingConcernStatus);
    setDraftScope(reportingScope);
    setDraftBranchId(branchId);
    setDraftFiscalYear(fiscalYear);
    setDraftPeriodId(fiscalPeriodId);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = async () => {
    setTemplateCode(draftTemplateCode);
    setPeriodType(draftPeriodType);
    setGoingConcernStatus(draftGoingConcern);
    setReportingScope(draftScope);
    setBranchId(draftBranchId);
    setFiscalYear(draftFiscalYear);
    setFiscalPeriodId(draftPeriodId);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setIsParamDrawerOpen(false);
    setActiveSectionCode("all");

    await loadOrGenerateNotes({
      forceGenerate: true,
      overrideTemplate: draftTemplateCode,
      overridePeriodType: draftPeriodType,
      overrideGoingConcern: draftGoingConcern,
      overrideScope: draftScope,
      overrideBranchId: draftBranchId,
      overrideYear: draftFiscalYear,
      overridePeriodId: draftPeriodId,
      overrideStartDate: draftFromDate,
      overrideEndDate: draftToDate,
    });
    notify?.(`Đã lập và tải mẫu ${draftTemplateCode} theo Thông tư 99/2025/TT-BTC.`);
  };

  const handleValidateRun = async () => {
    if (!activeRun?.run_id) return;
    try {
      const cid = getSelectedCompanyId();
      const res: any = await apiClient.post(
        `/api/v1/reports/financial-notes/runs/${encodeURIComponent(activeRun.run_id)}/validate/`,
        { company_id: cid }
      );
      setValidationPayload(res);
      setIsValidationDrawerOpen(true);
      await loadRunFullDetail(activeRun.run_id, cid);
      notify?.("Đã thực hiện kiểm tra đối chiếu Thuyết minh BCTC với B01, B02, B03 và Sổ cái.");
    } catch (err: any) {
      notify?.(err?.response?.data?.detail || "Không thể kiểm tra đối chiếu BCTC.");
    }
  };

  const handleSubmitReview = async () => {
    if (!activeRun?.run_id) return;
    try {
      const cid = getSelectedCompanyId();
      await apiClient.post(
        `/api/v1/reports/financial-notes/runs/${encodeURIComponent(activeRun.run_id)}/submit-review/`,
        { company_id: cid }
      );
      await loadRunFullDetail(activeRun.run_id, cid);
      notify?.("Đã chuyển bản Thuyết minh BCTC sang trạng thái Chờ rà soát (UNDER_REVIEW).");
    } catch (err: any) {
      notify?.(err?.response?.data?.detail || "Không thể trình rà soát bản thuyết minh.");
    }
  };

  const handleApproveRun = async () => {
    if (!activeRun?.run_id) return;
    try {
      const cid = getSelectedCompanyId();
      await apiClient.post(
        `/api/v1/reports/financial-notes/runs/${encodeURIComponent(activeRun.run_id)}/approve/`,
        { company_id: cid }
      );
      await loadRunFullDetail(activeRun.run_id, cid);
      notify?.("Đã phê duyệt chính thức (APPROVED) bản Thuyết minh BCTC.");
    } catch (err: any) {
      notify?.(
        err?.response?.data?.detail ||
          "Chưa đủ điều kiện phê duyệt: Vui lòng hoàn tất các mục bắt buộc và xử lý lỗi đối chiếu BLOCKER."
      );
    }
  };

  const handleOpenHistory = async () => {
    if (!activeRun?.run_id) return;
    try {
      const cid = getSelectedCompanyId();
      const q = cid ? `?company_id=${encodeURIComponent(cid)}` : "";
      const res: any = await apiClient.get(
        `/api/v1/reports/financial-notes/runs/${encodeURIComponent(activeRun.run_id)}/history/${q}`
      );
      setHistoryList(res?.versions || []);
      setIsHistoryModalOpen(true);
    } catch {
      notify?.("Không thể tải lịch sử phiên bản Thuyết minh BCTC.");
    }
  };

  const handleExportRun = async (format: "PDF" | "XLSX" | "DOCX" = "PDF") => {
    if (!activeRun?.run_id) return;
    try {
      const cid = getSelectedCompanyId();
      const res: any = await apiClient.post(
        `/api/v1/reports/financial-notes/runs/${encodeURIComponent(activeRun.run_id)}/export/`,
        { company_id: cid, export_format: format }
      );
      notify?.(
        `Đã khởi tạo lệnh kết xuất ${res?.legal_form_code || templateCode} định dạng ${format} (Mã: ${res?.export_id || "OK"}).`
      );
    } catch (err: any) {
      notify?.(err?.response?.data?.detail || "Không thể kết xuất Thuyết minh BCTC.");
    }
  };

  const handleOpenSources = async (noteCode: string) => {
    if (!activeRun?.run_id) return;
    setSourceDrawerNote(noteCode);
    setLoadingSources(true);
    try {
      const cid = getSelectedCompanyId();
      const q = cid ? `?company_id=${encodeURIComponent(cid)}` : "";
      const res: any = await apiClient.get(
        `/api/v1/reports/financial-notes/runs/${encodeURIComponent(activeRun.run_id)}/items/${encodeURIComponent(noteCode)}/sources/${q}`
      );
      setSourceDrawerData(res);
    } catch {
      setSourceDrawerData(null);
    } finally {
      setLoadingSources(false);
    }
  };

  const handleOpenEditModal = (item: NoteItemPayload) => {
    setEditingItem(item);
    setEditTextContent(item.content?.text_content || "");
    setEditIsApplicable(item.content?.is_applicable !== false);
    setEditNaReason(item.content?.not_applicable_reason || "");
    setEditConfirmed(true);
  };

  const handleSaveNoteItem = async () => {
    if (!activeRun?.run_id || !editingItem) return;
    try {
      const cid = getSelectedCompanyId();
      await apiClient.post(
        `/api/v1/reports/financial-notes/runs/${encodeURIComponent(activeRun.run_id)}/items/${encodeURIComponent(editingItem.note_code)}/`,
        {
          company_id: cid,
          text_content: editTextContent,
          is_applicable: editIsApplicable,
          not_applicable_reason: editIsApplicable ? "" : editNaReason,
          confirmed: editConfirmed,
          content_status: editIsApplicable ? "COMPLETED" : "NOT_APPLICABLE",
        }
      );
      setEditingItem(null);
      await loadRunFullDetail(activeRun.run_id, cid);
      notify?.(`Đã lưu và xác nhận mục thuyết minh ${editingItem.note_code}.`);
    } catch (err: any) {
      notify?.(
        err?.response?.data?.detail ||
          "Không thể lưu mục thuyết minh (nếu chọn Không áp dụng phải nhập lý do giải trình)."
      );
    }
  };

  const visibleSections = useMemo(() => {
    return sections
      .filter((sec) => activeSectionCode === "all" || sec.section_code === activeSectionCode)
      .map((sec) => {
        const filteredItems = (sec.items || []).filter((itm) => {
          if (hideNotApplicable && !itm.content?.is_applicable) return false;
          if (!searchKeyword.trim()) return true;
          const kw = searchKeyword.trim().toLowerCase();
          return (
            itm.note_code.toLowerCase().includes(kw) ||
            itm.note_title.toLowerCase().includes(kw) ||
            (itm.content?.text_content || "").toLowerCase().includes(kw)
          );
        });
        return { ...sec, items: filteredItems };
      })
      .filter((sec) => sec.items.length > 0 || activeSectionCode === sec.section_code);
  }, [sections, activeSectionCode, hideNotApplicable, searchKeyword]);

  const completenessSummary = activeRun?.completeness_summary || {
    total_items: 0,
    applicable_items: 0,
    completed_items: 0,
    manual_required_items: 0,
    review_required_items: 0,
    not_applicable_items: 0,
    completeness_pct: 0,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#f1f5f9",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* 1. Top Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          minHeight: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "transparent",
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
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0f172a",
                  letterSpacing: "-0.2px",
                }}
              >
                {activeRun?.template_name ||
                  `${templateCode}: Thuyết minh báo cáo tài chính (TT99/2025/TT-BTC)`}
              </h2>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontSize: 11.5,
                  fontWeight: 600,
                  background:
                    activeRun?.run_status === "APPROVED"
                      ? "#dcfce7"
                      : activeRun?.is_stale
                      ? "#fee2e2"
                      : "#e0f2fe",
                  color:
                    activeRun?.run_status === "APPROVED"
                      ? "#166534"
                      : activeRun?.is_stale
                      ? "#b91c1c"
                      : "#0369a1",
                }}
              >
                {activeRun?.is_stale
                  ? "STALE (Dữ liệu nguồn thay đổi)"
                  : activeRun?.run_status || "GENERATED"}{" "}
                • V{activeRun?.run_version || 1}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Mẫu pháp lý: <strong>{templateCode}</strong> | Kỳ:{" "}
              <strong>
                {fromDate} → {toDate}
              </strong>{" "}
              | Tiến độ hoàn thiện:{" "}
              <strong style={{ color: "#00a862" }}>
                {completenessSummary.completed_items}/{completenessSummary.applicable_items} mục (
                {completenessSummary.completeness_pct}%)
              </strong>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Quick Template Switcher */}
          <select
            value={templateCode}
            onChange={(e) => {
              const nextTmpl = e.target.value;
              const nextPt = nextTmpl === "B09a-DN" ? "QUARTER" : "ANNUAL";
              const nextGc =
                nextTmpl === "B09-DNKLT" ? "NON_GOING_CONCERN" : "GOING_CONCERN";
              setTemplateCode(nextTmpl);
              setPeriodType(nextPt);
              setGoingConcernStatus(nextGc);
              setActiveSectionCode("all");
              void loadOrGenerateNotes({
                forceGenerate: false,
                overrideTemplate: nextTmpl,
                overridePeriodType: nextPt,
                overrideGoingConcern: nextGc,
              });
            }}
            style={{
              height: 32,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 600,
              color: "#0f172a",
              background: "#f8fafc",
              cursor: "pointer",
            }}
          >
            <option value="B09-DN">B09-DN (Năm – Hoạt động liên tục)</option>
            <option value="B09-DNKLT">B09-DNKLT (Năm – Không đáp ứng HĐLT)</option>
            <option value="B09a-DN">B09a-DN (Giữa niên độ – Chọn lọc)</option>
          </select>

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
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            onClick={handleOpenHistory}
          >
            <History size={14} />
            <span>Phiên bản ({savedRuns.length})</span>
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
            onClick={() =>
              void loadOrGenerateNotes({
                forceGenerate: true,
              })
            }
          >
            Tạo phiên bản mới
          </button>

          {activeRun?.run_status !== "APPROVED" && (
            <>
              <button
                type="button"
                style={{
                  height: 32,
                  padding: "0 12px",
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: 4,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#166534",
                  cursor: "pointer",
                }}
                onClick={handleSubmitReview}
              >
                Trình rà soát
              </button>
              <button
                type="button"
                style={{
                  height: 32,
                  padding: "0 12px",
                  background: "#0284c7",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
                onClick={handleApproveRun}
              >
                <ShieldCheck size={14} />
                <span>Phê duyệt</span>
              </button>
            </>
          )}

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 14px",
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

      {/* 2. Sub-Toolbar: Kiểm tra đối chiếu, Ẩn N/A, Tìm kiếm, Công cụ Xuất */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            type="button"
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 4,
              padding: "4px 10px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "#166534",
              cursor: "pointer",
              fontWeight: 600,
            }}
            onClick={handleValidateRun}
          >
            <FileCheck size={15} color="#00a862" />
            <span>Kiểm tra đối chiếu B01 / B02 / B03</span>
          </button>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "#475569",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={hideNotApplicable}
              onChange={(e) => setHideNotApplicable(e.target.checked)}
              style={{ accentColor: "#00a862" }}
            />
            <span>Ẩn mục không áp dụng (NOT_APPLICABLE)</span>
          </label>

          <button
            type="button"
            style={{
              background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
              border: "1px solid #c7d2fe",
              borderRadius: 14,
              padding: "3px 12px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#6366f1",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => setShowAiAnalysis(!showAiAnalysis)}
          >
            <Sparkles size={14} color="#7c3aed" />
            <span>
              {showAiAnalysis ? "Đóng tóm tắt trạng thái" : "Tóm tắt tính đầy đủ & đối chiếu"}
            </span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 240 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              type="text"
              placeholder="Tìm mã (V.1, VII.11), tiêu đề, nội dung..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: "100%",
                height: 30,
                padding: "0 10px 0 32px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                outline: "none",
                background: "#ffffff",
              }}
            />
          </div>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Tải lại từ Backend"
            onClick={() => void loadOrGenerateNotes({ forceGenerate: false })}
          >
            <RotateCw size={14} />
          </button>

          <button
            type="button"
            style={{
              height: 30,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#334155",
              fontSize: 12.5,
              cursor: "pointer",
            }}
            onClick={() => void handleExportRun("PDF")}
            title="In / Xuất PDF"
          >
            <Printer size={14} />
            <span>PDF</span>
          </button>

          <button
            type="button"
            style={{
              height: 30,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#334155",
              fontSize: 12.5,
              cursor: "pointer",
            }}
            onClick={() => void handleExportRun("XLSX")}
            title="Xuất Excel (.xlsx)"
          >
            <Download size={14} />
            <span>XLSX</span>
          </button>
        </div>
      </div>

      {/* 3. Staleness Warning Banner (EF-28) */}
      {activeRun?.is_stale && (
        <div
          style={{
            margin: "10px 20px 0",
            padding: "10px 16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#991b1b",
            fontSize: 13,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} color="#dc2626" />
            <span>
              <strong>Cảnh báo STALE (EF-28):</strong> Dữ liệu bút toán Sổ cái (GL) hoặc báo cáo
              B01/B02/B03 đã thay đổi sau thời điểm lập bản thuyết minh này.
            </span>
          </div>
          <button
            type="button"
            onClick={() => void loadOrGenerateNotes({ forceGenerate: true })}
            style={{
              padding: "4px 12px",
              background: "#dc2626",
              color: "#ffffff",
              border: "none",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tạo phiên bản mới để đồng bộ
          </button>
        </div>
      )}

      {/* 4. Completeness & Reconciliation Summary Banner */}
      {showAiAnalysis && (
        <div
          style={{
            margin: "12px 20px 0",
            padding: "14px 18px",
            background: "#faf5ff",
            border: "1px solid #e9d5ff",
            borderRadius: 8,
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <Sparkles size={20} color="#7c3aed" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, fontSize: 13, color: "#4c1d95" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Tổng hợp trạng thái hoàn thiện Thuyết minh ({templateCode} – Phiên bản V
              {activeRun?.run_version || 1}):
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <div
                style={{
                  background: "#ffffff",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #ddd6fe",
                }}
              >
                <div style={{ fontSize: 11.5, color: "#64748b" }}>Mục đã có số liệu / hoàn tất</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#15803d", marginTop: 2 }}>
                  {completenessSummary.completed_items} / {completenessSummary.applicable_items} mục
                </div>
              </div>
              <div
                style={{
                  background: "#ffffff",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #ddd6fe",
                }}
              >
                <div style={{ fontSize: 11.5, color: "#64748b" }}>Mục cần nhập bổ sung thủ công</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#c2410c", marginTop: 2 }}>
                  {completenessSummary.manual_required_items} mục
                </div>
              </div>
              <div
                style={{
                  background: "#ffffff",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #ddd6fe",
                }}
              >
                <div style={{ fontSize: 11.5, color: "#64748b" }}>Mục cần rà soát xác nhận</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#854d0e", marginTop: 2 }}>
                  {completenessSummary.review_required_items} mục
                </div>
              </div>
              <div
                style={{
                  background: "#ffffff",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #ddd6fe",
                }}
              >
                <div style={{ fontSize: 11.5, color: "#64748b" }}>Báo cáo liên kết (B01/B02/B03)</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b", marginTop: 4 }}>
                  B01: {activeRun?.linked_runs?.b01_run_id ? "Đã liên kết" : "GL trực tiếp"} | B02:{" "}
                  {activeRun?.linked_runs?.b02_run_id ? "Đã liên kết" : "GL trực tiếp"}
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              color: "#a855f7",
              cursor: "pointer",
            }}
            onClick={() => setShowAiAnalysis(false)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 5. Dynamic Legal Roman Numeral TOC Navigation Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 20px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          overflowX: "auto",
          fontSize: 12.5,
        }}
      >
        <span
          style={{
            color: "#64748b",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 4,
            whiteSpace: "nowrap",
          }}
        >
          <BookOpen size={14} /> Mục lục ({sections.length} phần):
        </span>
        <button
          type="button"
          style={{
            padding: "4px 10px",
            borderRadius: 4,
            border: activeSectionCode === "all" ? "1px solid #00a862" : "1px solid #e2e8f0",
            background: activeSectionCode === "all" ? "#e6f7ef" : "#ffffff",
            color: activeSectionCode === "all" ? "#00a862" : "#334155",
            fontWeight: activeSectionCode === "all" ? 600 : 400,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          onClick={() => setActiveSectionCode("all")}
        >
          Toàn văn ({completenessSummary.total_items} mục)
        </button>
        {sections.map((sec) => (
          <button
            key={sec.section_code}
            type="button"
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border:
                activeSectionCode === sec.section_code ? "1px solid #00a862" : "1px solid #e2e8f0",
              background: activeSectionCode === sec.section_code ? "#e6f7ef" : "#ffffff",
              color: activeSectionCode === sec.section_code ? "#00a862" : "#334155",
              fontWeight: activeSectionCode === sec.section_code ? 600 : 400,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            onClick={() => setActiveSectionCode(sec.section_code)}
          >
            Phần {sec.section_code} ({sec.completed_count}/{sec.item_count})
          </button>
        ))}
      </div>

      {/* 6. Main Report Document Sheet */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 4,
            border: "1px solid #cbd5e1",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            padding: "28px 36px",
            minHeight: "100%",
            color: "#1e293b",
            fontSize: 13.5,
            lineHeight: 1.65,
          }}
        >
          {/* Legal Header Block */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 20,
              fontSize: 12.5,
              color: "#334155",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, textTransform: "uppercase" }}>
                Đơn vị: {activeRun?.company_name || companyInfo.name || "Doanh nghiệp"}
              </div>
              <div>Mã số thuế: {companyInfo.tax_code || "—"}</div>
              <div>
                Phạm vi:{" "}
                {activeRun?.reporting_scope === "BRANCH"
                  ? `Chi nhánh (${activeRun?.branch_name || ""})`
                  : "Toàn doanh nghiệp (ENTERPRISE)"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700 }}>Mẫu số {templateCode}</div>
              <div style={{ fontStyle: "italic", color: "#64748b" }}>
                (Ban hành theo Thông tư số 99/2025/TT-BTC
              </div>
              <div style={{ fontStyle: "italic", color: "#64748b" }}>
                ngày 27/10/2025 của Bộ trưởng Bộ Tài chính)
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#0f172a",
                textTransform: "uppercase",
              }}
            >
              {templateCode === "B09a-DN"
                ? "BẢN THUYẾT MINH BÁO CÁO TÀI CHÍNH CHỌN LỌC"
                : "BẢN THUYẾT MINH BÁO CÁO TÀI CHÍNH"}
            </h1>
            {templateCode === "B09-DNKLT" && (
              <div style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c", marginTop: 4 }}>
                (Áp dụng cho doanh nghiệp KHÔNG đáp ứng giả định hoạt động liên tục)
              </div>
            )}
            <div style={{ fontSize: 13, fontStyle: "italic", color: "#475569", marginTop: 4 }}>
              Năm tài chính {activeRun?.fiscal_year || fiscalYear} (Từ ngày {fromDate} đến ngày{" "}
              {toDate}) – Đơn vị tính: {activeRun?.currency_code || "VND"}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
              Đang tải cấu trúc Thuyết minh BCTC ({templateCode}) và đối chiếu số liệu từ Sổ cái...
            </div>
          ) : visibleSections.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
              Không có mục thuyết minh nào khớp với bộ lọc hiện tại.
            </div>
          ) : (
            visibleSections.map((sec) => (
              <div key={sec.section_code} style={{ marginBottom: 32 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "2px solid #00a862",
                    paddingBottom: 6,
                    marginBottom: 14,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#00a862" }}>
                    {sec.section_code}. {sec.section_title}
                  </h3>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    Hoàn thành: {sec.completed_count}/{sec.item_count} mục
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {sec.items.map((item) => {
                    const cStatus = item.content?.content_status || "NOT_STARTED";
                    const badge = STATUS_BADGE_MAP[cStatus] || STATUS_BADGE_MAP.NOT_STARTED;
                    const struct = item.content?.structured_content || {};
                    const structKeys = Object.keys(struct).filter(
                      (k) =>
                        ![
                          "policy_code",
                          "policy_name",
                          "is_manual_override",
                          "confirmation_status",
                        ].includes(k) &&
                        struct[k] !== null &&
                        struct[k] !== ""
                    );

                    return (
                      <div
                        key={item.note_code}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          padding: "14px 18px",
                          background: item.content?.is_applicable === false ? "#f8fafc" : "#ffffff",
                        }}
                      >
                        {/* Note Item Header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: "#0f172a",
                                fontSize: 13.5,
                              }}
                            >
                              [{item.note_code}] {item.note_title}
                            </span>
                            {item.is_required && (
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "#fef2f2",
                                  color: "#dc2626",
                                  border: "1px solid #fecaca",
                                  fontWeight: 600,
                                }}
                              >
                                Bắt buộc
                              </span>
                            )}
                            {item.related_report_code && (
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "1px 7px",
                                  borderRadius: 4,
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  border: "1px solid #bfdbfe",
                                  fontWeight: 600,
                                }}
                              >
                                Liên kết {item.related_report_code}
                                {item.related_indicator_codes?.length
                                  ? ` (Mã ${item.related_indicator_codes.join(", ")})`
                                  : ""}
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: 11,
                                padding: "1px 7px",
                                borderRadius: 4,
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                fontWeight: 600,
                              }}
                            >
                              {badge.label}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {(item.related_report_code ||
                              item.source_module ||
                              (item.tables && item.tables.length > 0)) && (
                              <button
                                type="button"
                                onClick={() => void handleOpenSources(item.note_code)}
                                style={{
                                  padding: "3px 8px",
                                  fontSize: 11.5,
                                  background: "#f8fafc",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 4,
                                  color: "#0284c7",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <ExternalLink size={12} />
                                <span>Truy vết nguồn</span>
                              </button>
                            )}
                            {activeRun?.run_status !== "APPROVED" && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                style={{
                                  padding: "3px 8px",
                                  fontSize: 11.5,
                                  background: "#ffffff",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 4,
                                  color: "#334155",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <Edit3 size={12} />
                                <span>Cập nhật / Xác nhận</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Not Applicable Banner */}
                        {item.content?.is_applicable === false ? (
                          <div
                            style={{
                              fontSize: 12.5,
                              color: "#64748b",
                              fontStyle: "italic",
                              padding: "6px 10px",
                              background: "#f1f5f9",
                              borderRadius: 4,
                            }}
                          >
                            Không áp dụng trong kỳ báo cáo. Lý do:{" "}
                            <strong>
                              {item.content?.not_applicable_reason || "Chưa cập nhật lý do"}
                            </strong>
                          </div>
                        ) : (
                          <>
                            {/* Text Content */}
                            {item.content?.text_content ? (
                              <div
                                style={{
                                  fontSize: 13,
                                  color: "#334155",
                                  marginBottom: item.tables?.length ? 12 : 4,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {item.content.text_content}
                              </div>
                            ) : (
                              cStatus === "MANUAL_REQUIRED" && (
                                <div
                                  style={{
                                    fontSize: 12.5,
                                    color: "#c2410c",
                                    fontStyle: "italic",
                                    marginBottom: 8,
                                  }}
                                >
                                  [Chưa có nội dung thuyết minh – Cần kế toán lập hoặc xác nhận
                                  Không áp dụng kèm lý do]
                                </div>
                              )
                            )}

                            {/* Structured Key-Value Metadata for Section I/II/III/IV/IX */}
                            {structKeys.length > 0 && item.tables?.length === 0 && (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                  gap: 8,
                                  background: "#f8fafc",
                                  padding: "8px 12px",
                                  borderRadius: 4,
                                  border: "1px solid #f1f5f9",
                                  fontSize: 12,
                                  marginTop: 6,
                                }}
                              >
                                {structKeys.slice(0, 8).map((k) => (
                                  <div key={k}>
                                    <span style={{ color: "#64748b" }}>{k}: </span>
                                    <strong style={{ color: "#1e293b" }}>
                                      {typeof struct[k] === "object"
                                        ? JSON.stringify(struct[k])
                                        : String(struct[k])}
                                    </strong>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Multi-Column / Movement Tables */}
                            {item.tables &&
                              item.tables.map((tbl) => {
                                const cols = tbl.column_schema || [];
                                return (
                                  <div key={tbl.table_id} style={{ marginTop: 10 }}>
                                    <div
                                      style={{
                                        fontSize: 12.5,
                                        fontWeight: 600,
                                        color: "#475569",
                                        marginBottom: 6,
                                      }}
                                    >
                                      Bảng [{tbl.table_code}]: {tbl.table_title}
                                    </div>
                                    <div style={{ overflowX: "auto" }}>
                                      <table
                                        style={{
                                          width: "100%",
                                          borderCollapse: "collapse",
                                          fontSize: 12.5,
                                          border: "1px solid #cbd5e1",
                                        }}
                                      >
                                        <thead>
                                          <tr
                                            style={{
                                              background: "#e2f0d9",
                                              borderBottom: "1px solid #cbd5e1",
                                            }}
                                          >
                                            {cols.map((col) => (
                                              <th
                                                key={col.column_code}
                                                style={{
                                                  padding: "7px 10px",
                                                  textAlign:
                                                    col.data_type === "NUMBER" ? "right" : "left",
                                                  borderRight: "1px solid #c2d9b8",
                                                  color: "#1e293b",
                                                  fontWeight: 700,
                                                }}
                                              >
                                                {col.column_group
                                                  ? `${col.column_group} – ${col.column_label}`
                                                  : col.column_label}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(tbl.rows || []).length === 0 ? (
                                            <tr>
                                              <td
                                                colSpan={Math.max(cols.length, 1)}
                                                style={{
                                                  padding: "10px 12px",
                                                  textAlign: "center",
                                                  color: "#94a3b8",
                                                  fontStyle: "italic",
                                                }}
                                              >
                                                Không có phát sinh số liệu trong kỳ
                                              </td>
                                            </tr>
                                          ) : (
                                            tbl.rows.map((row) => (
                                              <tr
                                                key={row.row_id || row.row_code}
                                                style={{
                                                  borderBottom: "1px solid #e2e8f0",
                                                  background: row.is_total_row
                                                    ? "#f8fafc"
                                                    : "#ffffff",
                                                  fontWeight: row.is_total_row ? 700 : 400,
                                                }}
                                              >
                                                {cols.map((col, cIdx) => {
                                                  const rawVal =
                                                    row.column_values?.[col.column_code] ??
                                                    (cIdx === 0 ? row.row_label : "");
                                                  const isNum = col.data_type === "NUMBER";
                                                  return (
                                                    <td
                                                      key={col.column_code}
                                                      style={{
                                                        padding: "6px 10px",
                                                        textAlign: isNum ? "right" : "left",
                                                        borderRight: "1px solid #f1f5f9",
                                                        color:
                                                          row.is_total_row && isNum
                                                            ? "#00a862"
                                                            : "#1e293b",
                                                      }}
                                                    >
                                                      {isNum ? formatMoney(rawVal) : String(rawVal ?? "—")}
                                                    </td>
                                                  );
                                                })}
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                );
                              })}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Legal Signature Footer */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              textAlign: "center",
              marginTop: 36,
              paddingTop: 20,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <div>
              <strong style={{ display: "block" }}>Người lập biểu</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>(Ký, họ tên)</span>
            </div>
            <div>
              <strong style={{ display: "block" }}>Kế toán trưởng</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>(Ký, họ tên)</span>
            </div>
            <div>
              <strong style={{ display: "block" }}>Người đại diện theo pháp luật</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>(Ký, họ tên, đóng dấu)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Parameter Drawer ("Chọn tham số") */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#ffffff",
              height: "100%",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Chọn tham số Thuyết minh BCTC
              </h3>
              <button
                type="button"
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
                onClick={() => setIsParamDrawerOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                padding: "20px 24px",
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                fontSize: 13,
              }}
            >
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                  Mẫu Thuyết minh BCTC (TT99/2025/TT-BTC)
                </label>
                <select
                  value={draftTemplateCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraftTemplateCode(val);
                    if (val === "B09a-DN") {
                      setDraftPeriodType("QUARTER");
                      setDraftGoingConcern("GOING_CONCERN");
                    } else if (val === "B09-DNKLT") {
                      setDraftPeriodType("ANNUAL");
                      setDraftGoingConcern("NON_GOING_CONCERN");
                    } else {
                      setDraftPeriodType("ANNUAL");
                      setDraftGoingConcern("GOING_CONCERN");
                    }
                  }}
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                  }}
                >
                  <option value="B09-DN">B09-DN – Thuyết minh BCTC năm (Hoạt động liên tục)</option>
                  <option value="B09-DNKLT">
                    B09-DNKLT – Thuyết minh BCTC năm (Không đáp ứng HĐLT)
                  </option>
                  <option value="B09a-DN">
                    B09a-DN – Thuyết minh BCTC chọn lọc (Giữa niên độ)
                  </option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                    Năm tài chính
                  </label>
                  <input
                    type="number"
                    value={draftFiscalYear}
                    onChange={(e) => setDraftFiscalYear(Number(e.target.value) || 2026)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                    Phạm vi báo cáo
                  </label>
                  <select
                    value={draftScope}
                    onChange={(e) => setDraftScope(e.target.value)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                    }}
                  >
                    <option value="ENTERPRISE">Toàn doanh nghiệp</option>
                    <option value="BRANCH">Theo Chi nhánh</option>
                  </select>
                </div>
              </div>

              {draftScope === "BRANCH" && (
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                    Chi nhánh
                  </label>
                  <select
                    value={draftBranchId}
                    onChange={(e) => setDraftBranchId(e.target.value)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                    }}
                  >
                    <option value="">-- Chọn chi nhánh --</option>
                    {availableBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                  Kỳ kế toán
                </label>
                <select
                  value={draftPeriodId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setDraftPeriodId(pid);
                    const found = availablePeriods.find((p) => String(p.id) === pid);
                    if (found) {
                      setDraftFromDate(found.start_date);
                      setDraftToDate(found.end_date);
                    }
                  }}
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                  }}
                >
                  <option value="">-- Tự động theo Năm tài chính --</option>
                  {availablePeriods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} ({p.start_date} → {p.end_date})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6 }}>Từ ngày</label>
                  <input
                    type="date"
                    value={draftFromDate}
                    onChange={(e) => setDraftFromDate(e.target.value)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6 }}>Đến ngày</label>
                  <input
                    type="date"
                    value={draftToDate}
                    onChange={(e) => setDraftToDate(e.target.value)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setIsParamDrawerOpen(false)}
                style={{
                  height: 34,
                  padding: "0 16px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleApplyParams()}
                style={{
                  height: 34,
                  padding: "0 18px",
                  border: "none",
                  background: "#00a862",
                  color: "#ffffff",
                  fontWeight: 600,
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Xem & Lập báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Source Traceability & Drill-Down Drawer (RPT06-F16, RPT06-F17) */}
      {sourceDrawerNote && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setSourceDrawerNote(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 680,
              background: "#ffffff",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                  Truy vết nguồn thuyết minh [{sourceDrawerNote}]
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {sourceDrawerData?.note_title || ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSourceDrawerNote(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, flex: 1, overflowY: "auto", fontSize: 12.5 }}>
              {loadingSources ? (
                <div style={{ color: "#64748b" }}>Đang truy xuất nguồn BCTC và Sổ cái...</div>
              ) : !sourceDrawerData ? (
                <div style={{ color: "#64748b" }}>Không tìm thấy dữ liệu truy vết nguồn.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* 1. Statement Line References (B01/B02/B03) */}
                  <div>
                    <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>
                      1. Liên kết chỉ tiêu BCTC ({sourceDrawerData.related_report_code || "B01/B02/B03"})
                    </h4>
                    {(sourceDrawerData.references || []).length === 0 ? (
                      <div style={{ color: "#64748b", fontStyle: "italic" }}>
                        Mục thuyết minh định tính / không gắn trực tiếp mã chỉ tiêu số học.
                      </div>
                    ) : (
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ padding: "6px 10px", textAlign: "left" }}>Loại nguồn</th>
                            <th style={{ padding: "6px 10px", textAlign: "left" }}>Quy tắc / Mã</th>
                            <th style={{ padding: "6px 10px", textAlign: "left" }}>Chi tiết</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sourceDrawerData.references.map((ref: any) => (
                            <tr key={ref.reference_id} style={{ borderTop: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "6px 10px", fontWeight: 600 }}>
                                {ref.reference_type}
                              </td>
                              <td style={{ padding: "6px 10px" }}>{ref.mapping_rule_code}</td>
                              <td style={{ padding: "6px 10px" }}>
                                {JSON.stringify(ref.source_reference)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* 2. GL Journal Drilldown */}
                  <div>
                    <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>
                      2. Bút toán Sổ cái (POSTED) cấu thành số liệu (
                      {sourceDrawerData.gl_journal_lines?.length || 0} dòng)
                    </h4>
                    {(sourceDrawerData.gl_journal_lines || []).length === 0 ? (
                      <div style={{ color: "#64748b", fontStyle: "italic" }}>
                        Không có dòng bút toán GL phát sinh trong kỳ cho mục này.
                      </div>
                    ) : (
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ padding: "6px 8px", textAlign: "left" }}>Số CT</th>
                            <th style={{ padding: "6px 8px", textAlign: "left" }}>Ngày GS</th>
                            <th style={{ padding: "6px 8px", textAlign: "left" }}>TK</th>
                            <th style={{ padding: "6px 8px", textAlign: "right" }}>Nợ</th>
                            <th style={{ padding: "6px 8px", textAlign: "right" }}>Có</th>
                            <th style={{ padding: "6px 8px", textAlign: "left" }}>Diễn giải</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sourceDrawerData.gl_journal_lines.map((jl: any, idx: number) => (
                            <tr key={jl.line_id || idx} style={{ borderTop: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                                {jl.voucher_no}
                              </td>
                              <td style={{ padding: "6px 8px" }}>{jl.posting_date}</td>
                              <td style={{ padding: "6px 8px" }}>{jl.account_code}</td>
                              <td style={{ padding: "6px 8px", textAlign: "right" }}>
                                {formatMoney(jl.debit)}
                              </td>
                              <td style={{ padding: "6px 8px", textAlign: "right" }}>
                                {formatMoney(jl.credit)}
                              </td>
                              <td style={{ padding: "6px 8px" }}>{jl.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. Validation & Cross-Statement Reconciliation Drawer (RPT06-F19) */}
      {isValidationDrawerOpen && validationPayload && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsValidationDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 660,
              background: "#ffffff",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                  Kết quả kiểm tra & đối chiếu Thuyết minh BCTC ({validationPayload.overall_status})
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Đủ điều kiện phê duyệt:{" "}
                  <strong>{validationPayload.is_approvable ? "CÓ" : "CHƯA ĐỦ ĐIỀU KIỆN"}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsValidationDrawerOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, flex: 1, overflowY: "auto", fontSize: 12.5 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(validationPayload.results || []).map((r: any, idx: number) => (
                  <div
                    key={r.validation_id || idx}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 6,
                      border:
                        r.status === "FAILED"
                          ? "1px solid #fca5a5"
                          : r.status === "WARNING" || r.status === "PASSED_WITH_WARNING"
                          ? "1px solid #fde047"
                          : "1px solid #bbf7d0",
                      background:
                        r.status === "FAILED"
                          ? "#fef2f2"
                          : r.status === "WARNING" || r.status === "PASSED_WITH_WARNING"
                          ? "#fefce8"
                          : "#f0fdf4",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      <span>
                        [{r.rule_code}] {r.check_name} {r.note_code ? `(Mục ${r.note_code})` : ""}
                      </span>
                      <span>{r.status}</span>
                    </div>
                    <div style={{ color: "#334155" }}>{r.message}</div>
                    {r.difference_amount !== null && r.difference_amount !== undefined && (
                      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                        Kỳ vọng (BCTC): <strong>{formatMoney(r.expected_value)}</strong> | Thực tế
                        (B09): <strong>{formatMoney(r.actual_value)}</strong> | Chênh lệch:{" "}
                        <strong>{formatMoney(r.difference_amount)}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. Manual Note Update / Confirmation Modal */}
      {editingItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setEditingItem(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 560,
              padding: 20,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Cập nhật / Xác nhận mục [{editingItem.note_code}] {editingItem.note_title}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editIsApplicable}
                  onChange={(e) => setEditIsApplicable(e.target.checked)}
                  style={{ accentColor: "#00a862" }}
                />
                <strong>Mục thuyết minh này có áp dụng trong kỳ báo cáo</strong>
              </label>

              {editIsApplicable ? (
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                    Nội dung thuyết minh / giải trình:
                  </label>
                  <textarea
                    rows={5}
                    value={editTextContent}
                    onChange={(e) => setEditTextContent(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                    Lý do đánh dấu Không áp dụng (bắt buộc theo EF-10):{" "}
                    <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ví dụ: Doanh nghiệp không phát sinh nghiệp vụ này trong kỳ báo cáo..."
                    value={editNaReason}
                    onChange={(e) => setEditNaReason(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{
                  height: 32,
                  padding: "0 14px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSaveNoteItem()}
                style={{
                  height: 32,
                  padding: "0 16px",
                  border: "none",
                  background: "#00a862",
                  color: "#ffffff",
                  fontWeight: 600,
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Lưu & Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Version History Modal (RPT06-F22) */}
      {isHistoryModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 660,
              padding: 20,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Lịch sử phiên bản Thuyết minh BCTC ({templateCode})
              </h3>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12.5,
                border: "1px solid #cbd5e1",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>Phiên bản</th>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>Mã Run</th>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>Trạng thái</th>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>Người lập</th>
                  <th style={{ padding: "8px 10px", textAlign: "center" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((ver: any) => (
                  <tr key={ver.run_id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 700 }}>V{ver.run_version}</td>
                    <td style={{ padding: "8px 10px" }}>{ver.run_no}</td>
                    <td style={{ padding: "8px 10px" }}>{ver.run_status}</td>
                    <td style={{ padding: "8px 10px" }}>{ver.created_by || "System"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsHistoryModalOpen(false);
                          void loadRunFullDetail(ver.run_id, getSelectedCompanyId());
                        }}
                        style={{
                          padding: "3px 10px",
                          background: "#f0fdf4",
                          color: "#166534",
                          border: "1px solid #bbf7d0",
                          borderRadius: 4,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Mở phiên bản
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
