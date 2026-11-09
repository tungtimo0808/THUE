import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { Printer, Download, ChevronDown, FileText, FileSpreadsheet, FileCode } from "lucide-react";
import { apiClient, getSelectedCompanyId } from "./apiClient";
import { openMisaReportPreviewModal } from "./misa-api-writes";
import "./financial-form.css";

export type FormSignature = {
  preparer_name: string;
  chief_accountant_name: string;
  representative_name: string;
  report_date: string;
};

const EMPTY_SIGNATURE: FormSignature = {
  preparer_name: "",
  chief_accountant_name: "",
  representative_name: "",
  report_date: "",
};

function signatureKey() {
  return `erp_form_signature_${getSelectedCompanyId()}`;
}

export function readFormSignature(): FormSignature {
  try {
    return { ...EMPTY_SIGNATURE, ...JSON.parse(localStorage.getItem(signatureKey()) || "{}") };
  } catch {
    return { ...EMPTY_SIGNATURE };
  }
}

/** Saves the file an export response carries; throws when the server sent none. */
export function saveStatementFile(response: { file_base64?: string; file_name?: string; content_type?: string }) {
  if (!response?.file_base64) throw new Error("Máy chủ chưa trả về tệp báo cáo.");
  const bytes = Uint8Array.from(atob(response.file_base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: response.content_type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = response.file_name || "bao-cao";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return link.download;
}

export function exportErrorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Không xuất được báo cáo.";
}

/** Cash-flow screens hold no run of their own, so each export refreshes one for the current year. */
export async function exportCashFlow(method: "DIRECT" | "INDIRECT", format: "EXCEL" | "PDF") {
  const companyId = getSelectedCompanyId();
  const year = new Date().getFullYear();
  const created: any = await apiClient.post("/api/v1/reports/cash-flow/runs/", {
    company_id: companyId,
    template_code: "B03-DN",
    cash_flow_method: method,
    period_start_date: `${year}-01-01`,
    period_end_date: `${year}-12-31`,
  });
  const runId = created?.run?.id || created?.id;
  if (!runId) throw new Error("Chưa lập được báo cáo lưu chuyển tiền tệ.");
  const response: any = await apiClient.post(
    `/api/v1/reports/cash-flow/runs/${encodeURIComponent(runId)}/export/?company_id=${encodeURIComponent(companyId)}`,
    { company_id: companyId, export_format: format, ...readFormSignature() },
  );
  return saveStatementFile(response);
}

/* ───────────────────── Natural Vietnamese Text Formatters ───────────────────── */

export function formatRunStatusText(status?: string | null): string {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return "Đã phê duyệt";
  if (s === "READY_FOR_APPROVAL") return "Đủ điều kiện phê duyệt";
  if (s === "UNDER_REVIEW") return "Đang chờ rà soát";
  if (s === "VALIDATED") return "Đã kiểm tra đối chiếu";
  if (s === "GENERATED" || s === "COMPLETED") return "Đã tổng hợp từ Sổ cái";
  if (s === "STALE") return "Dữ liệu Sổ cái thay đổi, cần lập lại";
  if (s === "FAILED") return "Chưa đạt kiểm tra";
  if (s === "PARTIAL") return "Chưa đủ biểu mẫu thành phần";
  if (s === "DRAFT") return "Bản nháp";
  return status || "Đã tổng hợp";
}

export function formatValidationStatusText(status?: string | null): string {
  const s = String(status || "").toUpperCase();
  if (s === "PASSED") return "Số liệu cân đối hợp lệ";
  if (s === "PASSED_WITH_WARNING") return "Cân đối hợp lệ (có mục cần lưu ý)";
  if (s === "WARNING") return "Có mục cần kiểm tra lại";
  if (s === "FAILED" || s === "BLOCKER") return "Có chênh lệch cần xử lý";
  if (s === "UNVALIDATED") return "Chưa kiểm tra đối chiếu";
  return status || "Đã kiểm tra";
}

export function formatScopeText(scope?: string | null, branchName?: string | null): string {
  const s = String(scope || "").toUpperCase();
  if (s === "BRANCH") {
    return branchName ? `Chi nhánh: ${branchName}` : "Theo chi nhánh";
  }
  return "Toàn doanh nghiệp";
}

export function formatSeverityText(severity?: string | null): string {
  const s = String(severity || "").toUpperCase();
  if (s === "BLOCKER" || s === "FAILED" || s === "ERROR") return "Cần xử lý ngay";
  if (s === "WARNING" || s === "PASSED_WITH_WARNING") return "Lưu ý kiểm tra";
  return "Thông tin đối chiếu";
}

export function formatRuleResultText(status?: string | null): string {
  const s = String(status || "").toUpperCase();
  if (s === "PASSED") return "Đạt yêu cầu";
  if (s === "FAILED" || s === "BLOCKER") return "Chưa khớp";
  if (s === "WARNING" || s === "PASSED_WITH_WARNING") return "Cần lưu ý";
  return "Đã kiểm tra";
}

export function formatLineTypeText(lineType?: string | null): string {
  const s = String(lineType || "").toUpperCase();
  if (s === "TOTAL") return "Chỉ tiêu tổng cộng";
  if (s === "SUBTOTAL") return "Chỉ tiêu tổng hợp nhóm";
  if (s === "DETAIL") return "Chỉ tiêu chi tiết";
  if (s === "HEADER") return "Tiêu đề nhóm";
  return lineType || "Chỉ tiêu báo cáo";
}

export function formatBalanceSideText(side?: string | null): string {
  const s = String(side || "").toUpperCase();
  if (s === "DEBIT") return "Số dư bên Nợ";
  if (s === "CREDIT") return "Số dư bên Có";
  if (s === "DEBIT_IF_POSITIVE") return "Số dư bên Nợ (khi dương)";
  if (s === "CREDIT_IF_POSITIVE") return "Số dư bên Có (khi dương)";
  if (s === "SIGNED_NET_CLOSING_DEBIT_MINUS_CREDIT") return "Chênh lệch dư Nợ trừ dư Có cuối kỳ";
  if (s === "SIGNED_NET_CLOSING_CREDIT_MINUS_DEBIT") return "Chênh lệch dư Có trừ dư Nợ cuối kỳ";
  return side || "Theo quy tắc tài khoản";
}

export function formatPeriodOptionLabel(p: any): string {
  if (!p) return "";
  const cleanName = String(p.name || p.code || "")
    .replace(/\s*\([0-9]{4}-[0-9]{2}\)/g, "")
    .trim();
  const fmtDate = (iso?: string) => {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
  };
  const range =
    p.start_date && p.end_date ? ` (${fmtDate(p.start_date)} – ${fmtDate(p.end_date)})` : "";
  const closedTag = String(p.status || "").toUpperCase() === "CLOSED" ? " – Đã khóa sổ" : "";
  return `${cleanName}${range}${closedTag}`;
}

export function cleanBundleDisplayName(name?: string | null): string {
  if (!name) return "Bộ Báo cáo tài chính";
  return String(name)
    .replace(/\s*\([0-9]{4}-[0-9]{2}\)/g, "")
    .replace(/\)\)+/g, ")")
    .trim();
}

export function formatSavedBundleOptionLabel(b: any, _idx?: number): string {
  if (!b) return "";
  const typeMap: Record<string, string> = {
    ANNUAL_GOING_CONCERN: "BCTC năm (Hoạt động liên tục)",
    ANNUAL_NON_GOING_CONCERN: "BCTC năm (Không đáp ứng hoạt động liên tục)",
    INTERIM_FULL: "BCTC giữa niên độ (Đầy đủ)",
    INTERIM_CONDENSED: "BCTC giữa niên độ (Tóm lược)",
  };
  const typeLabel = typeMap[b.bundle_type] || cleanBundleDisplayName(b.bundle_name);
  const periodClean = String(b.period_name || b.fiscal_year || "")
    .replace(/\s*\([0-9]{4}-[0-9]{2}\)/g, "")
    .trim();
  const statusLabel = formatRunStatusText(b.bundle_status);
  return `Phiên bản ${b.bundle_version || 1} – ${typeLabel}${periodClean ? ` – ${periodClean}` : ""} (${statusLabel}, đủ ${b.available_component_count ?? 4}/4 biểu mẫu)`;
}

/* ───────────────────── Company Metadata Cache for Print Preview ───────────────────── */

const companyMetaCache = new Map<
  string,
  { name: string; address: string; tax_code: string; representative: string }
>();

export async function getCompanyPrintMetadata(companyId?: string | null) {
  const cid = companyId || getSelectedCompanyId();
  if (!cid) {
    return {
      name: "Đơn vị kế toán",
      address: "Việt Nam",
      tax_code: "",
      representative: "",
    };
  }
  if (companyMetaCache.has(cid)) return companyMetaCache.get(cid)!;
  try {
    const res: any = await apiClient.get(`/api/v1/organization/companies/${encodeURIComponent(cid)}/`);
    const meta = {
      name: String(res?.legal_name || res?.name || "Doanh nghiệp"),
      address: String(res?.address || res?.head_office_address || "Việt Nam"),
      tax_code: String(res?.tax_code || ""),
      representative: String(res?.legal_representative || ""),
    };
    companyMetaCache.set(cid, meta);
    return meta;
  } catch {
    return {
      name: "Doanh nghiệp",
      address: "Việt Nam",
      tax_code: "",
      representative: "",
    };
  }
}

export interface StatementPreviewColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface StatementPreviewSection {
  formCode: string;
  title: string;
  subtitle?: string;
  periodLabel: string;
  unitLabel?: string;
  columns: StatementPreviewColumn[];
  rows: Array<Record<string, any>>;
}

export function buildFinancialStatementMisaHtml(opts: {
  companyName: string;
  companyAddress: string;
  companyTaxCode?: string;
  orientation?: "portrait" | "landscape";
  sections: StatementPreviewSection[];
}): string {
  const sig = readFormSignature();
  const orientation = opts.orientation || "portrait";
  const escapeHtml = (val: unknown) =>
    String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const today = new Date();
  let dateLine = `Ngày ${String(today.getDate()).padStart(2, "0")} tháng ${String(today.getMonth() + 1).padStart(2, "0")} năm ${today.getFullYear()}`;
  if (sig.report_date) {
    const m = sig.report_date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) dateLine = `Ngày ${m[3]} tháng ${m[2]} năm ${m[1]}`;
  }

  const sectionsHtml = opts.sections
    .map((sec, sIdx) => {
      const theadCells = sec.columns
        .map(
          (col) =>
            `<th style="text-align:center;${col.width ? `width:${col.width};` : ""}">${escapeHtml(col.label)}</th>`,
        )
        .join("");

      const colNumbersRow = sec.columns
        .map((_, idx) => `<th style="text-align:center;font-weight:normal;font-style:italic;font-size:9.5pt;">(${idx + 1})</th>`)
        .join("");

      const tbodyRows = sec.rows
        .map((r) => {
          const isBold = Boolean(r.isBold || r.isHeader);
          const padLeft = r.level ? 6 + Number(r.level) * 12 : r.indent ? 20 : 6;
          const cells = sec.columns
            .map((col, cIdx) => {
              const rawVal = r[col.key] ?? "";
              const align = col.align || (cIdx === 0 ? "left" : cIdx <= 2 ? "center" : "right");
              const styleParts = [
                `text-align:${align}`,
                cIdx === 0 ? `padding-left:${padLeft}px` : "",
                isBold ? "font-weight:bold" : "",
                align === "right" ? "font-variant-numeric:tabular-nums;white-space:nowrap" : "",
              ]
                .filter(Boolean)
                .join(";");
              return `<td style="${styleParts}">${escapeHtml(rawVal)}</td>`;
            })
            .join("");
          return `<tr${isBold ? ' class="bold-row"' : ""}>${cells}</tr>`;
        })
        .join("");

      return `
      <div class="statement-page" style="${sIdx > 0 ? "page-break-before: always; margin-top: 32px; padding-top: 24px; border-top: 1px dashed #cbd5e1;" : ""}">
        <div class="header-top">
          <div class="company-block">
            <div class="company-name"><strong>Đơn vị:</strong> ${escapeHtml(opts.companyName)}</div>
            <div class="company-addr"><strong>Địa chỉ:</strong> ${escapeHtml(opts.companyAddress)}</div>
            ${opts.companyTaxCode ? `<div class="company-tax"><strong>Mã số thuế:</strong> ${escapeHtml(opts.companyTaxCode)}</div>` : ""}
          </div>
          <div class="legal-block">
            <div class="legal-code"><strong>Mẫu số ${escapeHtml(sec.formCode)}</strong></div>
            <div class="legal-sub">(Ban hành theo Thông tư số 99/2025/TT-BTC</div>
            <div class="legal-sub">ngày 27/10/2025 của Bộ trưởng Bộ Tài chính)</div>
          </div>
        </div>

        <div class="title-block">
          <h1>${escapeHtml(sec.title)}</h1>
          <div class="period">${escapeHtml(sec.periodLabel)}</div>
          ${sec.subtitle ? `<div class="subtitle">${escapeHtml(sec.subtitle)}</div>` : ""}
        </div>

        <div class="unit-row">Đơn vị tính: ${escapeHtml(sec.unitLabel || "VND")}</div>

        <table>
          <thead>
            <tr>${theadCells}</tr>
            <tr>${colNumbersRow}</tr>
          </thead>
          <tbody>${tbodyRows}</tbody>
        </table>

        <div class="signatures">
          <div class="sig-col">
            <div class="sig-date">&nbsp;</div>
            <div class="sig-title">NGƯỜI LẬP BIỂU</div>
            <div class="sig-sub">(Ký, họ tên)</div>
            <div class="sig-name">${escapeHtml(sig.preparer_name || "")}</div>
          </div>
          <div class="sig-col">
            <div class="sig-date">&nbsp;</div>
            <div class="sig-title">KẾ TOÁN TRƯỞNG</div>
            <div class="sig-sub">(Ký, họ tên)</div>
            <div class="sig-name">${escapeHtml(sig.chief_accountant_name || "")}</div>
          </div>
          <div class="sig-col">
            <div class="sig-date">${escapeHtml(dateLine)}</div>
            <div class="sig-title">NGƯỜI ĐẠI DIỆN THEO PHÁP LUẬT</div>
            <div class="sig-sub">(Ký, họ tên, đóng dấu)</div>
            <div class="sig-name">${escapeHtml(sig.representative_name || "")}</div>
          </div>
        </div>
      </div>`;
    })
    .join("\n");

  const firstTitle = opts.sections[0]?.title || "BÁO CÁO TÀI CHÍNH";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(firstTitle)}</title>
<style>
  @page { size: A4 ${orientation}; margin: 14mm; }
  body { font-family: "Times New Roman", Times, serif; color: #000; background: #fff; margin: 0; padding: 24px 32px; font-size: 11pt; line-height: 1.4; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
  .company-block { max-width: 58%; font-size: 10.5pt; }
  .company-block div { margin-bottom: 2px; }
  .legal-block { text-align: center; font-size: 10pt; min-width: 230px; }
  .legal-sub { font-style: italic; }
  .title-block { text-align: center; margin: 12px 0 8px; }
  .title-block h1 { font-size: 15pt; font-weight: bold; text-transform: uppercase; margin: 0 0 4px; }
  .title-block .period { font-size: 11pt; font-style: italic; font-weight: bold; }
  .title-block .subtitle { font-size: 10.5pt; font-style: italic; margin-top: 2px; }
  .unit-row { text-align: right; font-size: 10.5pt; font-style: italic; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 10.5pt; }
  th, td { border: 1px solid #000; padding: 5px 7px; vertical-align: middle; }
  thead th { font-weight: bold; background: #fff; }
  tr.bold-row td { font-weight: bold; }
  .signatures { display: flex; justify-content: space-between; margin-top: 24px; text-align: center; page-break-inside: avoid; }
  .sig-col { width: 32%; }
  .sig-date { font-style: italic; font-size: 10pt; margin-bottom: 4px; }
  .sig-title { font-weight: bold; font-size: 10.5pt; }
  .sig-sub { font-style: italic; font-size: 9.5pt; margin-bottom: 56px; }
  .sig-name { font-weight: bold; font-size: 10.5pt; }
</style>
</head>
<body>
${sectionsHtml}
</body>
</html>`;
}

export async function openStatementPreviewAndExport(opts: {
  requestedFormat?: "PRINT" | "PDF" | "XLSX";
  mode?: "print" | "pdf" | "excel";
  orientation?: "portrait" | "landscape";
  reportCode?: string;
  formCode?: string;
  title: string;
  circularNote?: string;
  periodText?: string;
  unitLabel?: string;
  headers?: string[];
  rows?: Array<{ cells: Array<string | number>; isBold?: boolean }>;
  colAligns?: Array<"left" | "center" | "right">;
  fileNameBase?: string;
  sections?: StatementPreviewSection[];
  onDirectDownloadPdf?: () => Promise<unknown> | void;
  onDirectDownloadExcel?: () => Promise<unknown> | void;
  onDownloadPdf?: () => Promise<unknown> | void;
  onDownloadExcel?: () => Promise<unknown> | void;
}) {
  const companyMeta = await getCompanyPrintMetadata();
  const reqFormat: "PRINT" | "PDF" | "XLSX" =
    opts.requestedFormat ||
    (opts.mode === "excel" ? "XLSX" : opts.mode === "pdf" ? "PDF" : "PRINT");
  const code = opts.reportCode || opts.formCode || "BCTC";

  const resolvedSections: StatementPreviewSection[] =
    opts.sections && opts.sections.length > 0
      ? opts.sections
      : [
          {
            formCode: code,
            title: opts.title,
            subtitle: opts.circularNote,
            periodLabel: opts.periodText || "",
            unitLabel: opts.unitLabel || "VND",
            columns: (opts.headers || []).map((h, i) => ({
              key: `c${i}`,
              label: h,
              align: opts.colAligns?.[i] || (i === 0 ? "left" : i <= 2 ? "center" : "right"),
            })),
            rows: (opts.rows || []).map((r) => {
              const rowObj: Record<string, string | number | boolean | undefined> = {
                isBold: r.isBold,
              };
              r.cells.forEach((cell, idx) => {
                rowObj[`c${idx}`] = cell;
              });
              return rowObj;
            }),
          },
        ];

  const htmlText = buildFinancialStatementMisaHtml({
    companyName: companyMeta.name,
    companyAddress: companyMeta.address,
    companyTaxCode: companyMeta.tax_code,
    orientation: opts.orientation || "portrait",
    sections: resolvedSections,
  });

  const baseName = opts.fileNameBase || code.toLowerCase();
  openMisaReportPreviewModal({
    htmlText,
    title: `${code}: ${opts.title}`,
    reportCode: code,
    fileName: `${baseName}.${reqFormat === "XLSX" ? "xlsx" : "pdf"}`,
    requestedFormat: reqFormat,
    onDownloadExcel: opts.onDirectDownloadExcel || opts.onDownloadExcel,
    onDownloadPdf: opts.onDirectDownloadPdf || opts.onDownloadPdf,
  });
}

/* ───────────────────── Reusable Print & Export Dropdown Menu ───────────────────── */

export function StatementPrintExportMenu({
  onPreviewAction,
  onPrintPortrait,
  onPrintLandscape,
  onExportPdf,
  onExportExcel,
  onExportXml,
  compact = true,
  buttonLabel,
}: {
  onPreviewAction?: (format: "PRINT" | "PDF" | "XLSX", orientation?: "portrait" | "landscape") => void;
  onPrintPortrait?: () => void;
  onPrintLandscape?: () => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  onExportXml?: () => void;
  compact?: boolean;
  buttonLabel?: string;
}) {
  const triggerAction = (format: "PRINT" | "PDF" | "XLSX", orientation: "portrait" | "landscape" = "portrait") => {
    if (onPreviewAction) {
      onPreviewAction(format, orientation);
      return;
    }
    if (format === "PRINT") {
      if (orientation === "landscape" && onPrintLandscape) onPrintLandscape();
      else if (onPrintPortrait) onPrintPortrait();
    } else if (format === "PDF") {
      onExportPdf?.();
    } else if (format === "XLSX") {
      onExportExcel?.();
    }
  };
  const [openMenu, setOpenMenu] = useState<"print" | "export" | "combined" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  if (!compact || buttonLabel) {
    // Combined button mode (used in MisaFinancialBundleWorkspace)
    return (
      <div ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === "combined" ? null : "combined")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Printer size={14} />
          <span>{buttonLabel || "In / Xuất báo cáo"}</span>
          <ChevronDown size={13} />
        </button>

        {openMenu === "combined" && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              minWidth: 250,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
              padding: 4,
              zIndex: 9999,
            }}
          >
            <button
              type="button"
              className="misa-dropdown-item"
              onClick={() => {
                setOpenMenu(null);
                triggerAction("PRINT", "portrait");
              }}
            >
              <Printer size={14} color="#0284c7" />
              <span>Xem trước & In bộ báo cáo (Khổ dọc A4)</span>
            </button>
            <button
              type="button"
              className="misa-dropdown-item"
              onClick={() => {
                setOpenMenu(null);
                triggerAction("PRINT", "landscape");
              }}
            >
              <Printer size={14} color="#0284c7" />
              <span>Xem trước & In bộ báo cáo (Khổ ngang A4)</span>
            </button>
            <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />
            <button
              type="button"
              className="misa-dropdown-item"
              onClick={() => {
                setOpenMenu(null);
                triggerAction("PDF", "portrait");
              }}
            >
              <FileText size={14} color="#dc2626" />
              <span>Xem trước & Xuất tệp PDF (.pdf)</span>
            </button>
            <button
              type="button"
              className="misa-dropdown-item"
              onClick={() => {
                setOpenMenu(null);
                triggerAction("XLSX", "portrait");
              }}
            >
              <FileSpreadsheet size={14} color="#00a862" />
              <span>Xem trước & Xuất tệp Excel (.xlsx)</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ display: "inline-flex", alignItems: "center", gap: 6, position: "relative" }}>
      {/* Print Dropdown Button */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          title="Tuỳ chọn in báo cáo"
          onClick={() => setOpenMenu(openMenu === "print" ? null : "print")}
          style={{
            height: 30,
            padding: "0 10px",
            border: "1px solid #cbd5e1",
            background: openMenu === "print" ? "#f1f5f9" : "#ffffff",
            borderRadius: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "#334155",
            fontSize: 12.5,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Printer size={14} />
          <ChevronDown size={12} />
        </button>

        {openMenu === "print" && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              minWidth: 245,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
              padding: 4,
              zIndex: 9999,
            }}
          >
            <button
              type="button"
              className="misa-dropdown-item"
              onClick={() => {
                setOpenMenu(null);
                triggerAction("PRINT", "portrait");
              }}
            >
              <Printer size={14} color="#0284c7" />
              <span>Xem trước & In báo cáo (Khổ dọc A4)</span>
            </button>
            <button
              type="button"
              className="misa-dropdown-item"
              onClick={() => {
                setOpenMenu(null);
                triggerAction("PRINT", "landscape");
              }}
            >
              <Printer size={14} color="#0284c7" />
              <span>Xem trước & In báo cáo (Khổ ngang A4)</span>
            </button>
          </div>
        )}
      </div>

      {/* Export / Download Dropdown Button */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          title="Tuỳ chọn xuất và tải báo cáo"
          onClick={() => setOpenMenu(openMenu === "export" ? null : "export")}
          style={{
            height: 30,
            padding: "0 10px",
            border: "1px solid #cbd5e1",
            background: openMenu === "export" ? "#f1f5f9" : "#ffffff",
            borderRadius: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "#334155",
            fontSize: 12.5,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Download size={14} />
          <ChevronDown size={12} />
        </button>

        {openMenu === "export" && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              minWidth: 250,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
              padding: 4,
              zIndex: 9999,
            }}
          >
            <button
              type="button"
              className="misa-dropdown-item"
              onClick={() => {
                setOpenMenu(null);
                triggerAction("PDF", "portrait");
              }}
            >
              <FileText size={14} color="#dc2626" />
              <span>Xem trước & Xuất tệp PDF (.pdf)</span>
            </button>
            <button
              type="button"
              className="misa-dropdown-item"
              onClick={() => {
                setOpenMenu(null);
                triggerAction("XLSX", "portrait");
              }}
            >
              <FileSpreadsheet size={14} color="#00a862" />
              <span>Xem trước & Xuất tệp Excel (.xlsx)</span>
            </button>
            {onExportXml && (
              <>
                <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />
                <button
                  type="button"
                  className="misa-dropdown-item"
                  onClick={() => {
                    setOpenMenu(null);
                    onExportXml();
                  }}
                >
                  <FileCode size={14} color="#d97706" />
                  <span>Xuất tệp XML (Kê khai thuế eTax)</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SignatureBar() {
  const [signature, setSignature] = useState(readFormSignature);
  const update = (field: keyof FormSignature, value: string) => {
    const next = { ...signature, [field]: value };
    setSignature(next);
    localStorage.setItem(signatureKey(), JSON.stringify(next));
  };
  const fields: Array<[keyof FormSignature, string]> = [
    ["preparer_name", "Người lập biểu"],
    ["chief_accountant_name", "Kế toán trưởng"],
    ["representative_name", "Người đại diện theo pháp luật"],
  ];
  return (
    <footer className="financial-form-signature">
      {fields.map(([field, label]) => (
        <label key={field}>
          {label}
          <input value={signature[field]} maxLength={200} onChange={(event) => update(field, event.target.value)} />
        </label>
      ))}
      <label>
        Ngày lập
        <input type="date" value={signature.report_date} onChange={(event) => update("report_date", event.target.value)} />
      </label>
    </footer>
  );
}

export function FinancialFormFrame({ tabs, active, onSelect, children }: {
  tabs?: ReadonlyArray<readonly [code: string, report: string]>;
  active?: string;
  onSelect?: (report: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="financial-form-frame">
      {tabs && (
        <nav className="financial-form-tabs" role="tablist" aria-label="Biểu mẫu báo cáo tài chính">
          {tabs.map(([code, report]) => (
            <button key={code} type="button" role="tab" aria-selected={active === code} onClick={() => onSelect?.(report)}>
              {code}
            </button>
          ))}
        </nav>
      )}
      <div className="financial-form-body">{children}</div>
      <SignatureBar />
    </div>
  );
}

export function getActiveCompanyDisplayName(): string {
  try {
    const raw = localStorage.getItem("erp_api_session");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.companyName) return String(parsed.companyName);
      if (parsed?.company?.name) return String(parsed.company.name);
    }
    const directName =
      localStorage.getItem("erp_company_name") ||
      localStorage.getItem("active_company_name") ||
      localStorage.getItem("company_name");
    if (directName) return directName;
  } catch {
    // ignore
  }
  return "Trụ sở chính (Toàn doanh nghiệp)";
}

export const MISA_REPORT_PERIOD_OPTIONS: string[] = [
  "Tháng này",
  "Tháng trước",
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
  "Quý này",
  "Quý trước",
  "Quý I",
  "Quý II",
  "Quý III",
  "Quý IV",
  "6 tháng đầu năm",
  "6 tháng cuối năm",
  "Năm nay",
  "Năm trước",
  "Tùy chọn",
];

export function computeMisaPeriodDates(
  period: string,
  baseYear: number = new Date().getFullYear(),
): { fromDate: string; toDate: string; subtitle: string } {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const lastDayOfMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const now = new Date();
  const curMonth = now.getMonth() + 1; // 1..12
  const curQuarter = Math.floor((curMonth - 1) / 3) + 1;

  const monthRange = (y: number, m: number) => {
    const ld = lastDayOfMonth(y, m);
    return {
      fromDate: `01/${pad2(m)}/${y}`,
      toDate: `${pad2(ld)}/${pad2(m)}/${y}`,
      subtitle: `Tháng ${m} năm ${y}`,
    };
  };

  const quarterRange = (y: number, q: number) => {
    const startM = (q - 1) * 3 + 1;
    const endM = q * 3;
    const ld = lastDayOfMonth(y, endM);
    const roman = ["I", "II", "III", "IV"][q - 1] || String(q);
    return {
      fromDate: `01/${pad2(startM)}/${y}`,
      toDate: `${pad2(ld)}/${pad2(endM)}/${y}`,
      subtitle: `Quý ${roman} năm ${y} (Từ ngày 01/${pad2(startM)}/${y} đến ngày ${pad2(ld)}/${pad2(endM)}/${y})`,
    };
  };

  if (period === "Tháng này") {
    return monthRange(baseYear, curMonth);
  }
  if (period === "Tháng trước") {
    const m = curMonth === 1 ? 12 : curMonth - 1;
    const y = curMonth === 1 ? baseYear - 1 : baseYear;
    return monthRange(y, m);
  }
  const monthMatch = /^Tháng\s+(\d{1,2})$/i.exec(period.trim());
  if (monthMatch) {
    const m = Math.min(12, Math.max(1, Number(monthMatch[1])));
    return monthRange(baseYear, m);
  }
  if (period === "Quý này") {
    return quarterRange(baseYear, curQuarter);
  }
  if (period === "Quý trước") {
    const q = curQuarter === 1 ? 4 : curQuarter - 1;
    const y = curQuarter === 1 ? baseYear - 1 : baseYear;
    return quarterRange(y, q);
  }
  if (period === "Quý I") return quarterRange(baseYear, 1);
  if (period === "Quý II") return quarterRange(baseYear, 2);
  if (period === "Quý III") return quarterRange(baseYear, 3);
  if (period === "Quý IV") return quarterRange(baseYear, 4);
  if (period === "6 tháng đầu năm") {
    return {
      fromDate: `01/01/${baseYear}`,
      toDate: `30/06/${baseYear}`,
      subtitle: `6 tháng đầu năm ${baseYear} (Từ ngày 01/01/${baseYear} đến ngày 30/06/${baseYear})`,
    };
  }
  if (period === "6 tháng cuối năm") {
    return {
      fromDate: `01/07/${baseYear}`,
      toDate: `31/12/${baseYear}`,
      subtitle: `6 tháng cuối năm ${baseYear} (Từ ngày 01/07/${baseYear} đến ngày 31/12/${baseYear})`,
    };
  }
  if (period === "Năm trước") {
    const y = baseYear - 1;
    return {
      fromDate: `01/01/${y}`,
      toDate: `31/12/${y}`,
      subtitle: `Năm ${y} (Từ ngày 01/01/${y} đến ngày 31/12/${y})`,
    };
  }
  // Default: Năm nay
  return {
    fromDate: `01/01/${baseYear}`,
    toDate: `31/12/${baseYear}`,
    subtitle: `Năm ${baseYear} (Từ ngày 01/01/${baseYear} đến ngày 31/12/${baseYear})`,
  };
}

export function dmyToIsoDate(dmy: string): string {
  const trimmed = (dmy || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split(/[/-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y && y.length === 4) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return "";
}

export function isoToDmyDate(iso: string): string {
  const trimmed = (iso || "").trim();
  const parts = trimmed.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }
  return trimmed;
}

export function MisaBranchTagSelector({
  branches = [],
  selectedScope,
  selectedBranchId: propSelectedBranchId,
  branchId,
  branchLabel: _branchLabel,
  onChange,
  companyLabel,
}: {
  branches?: Array<{ id: string; code?: string; name: string }>;
  selectedScope?: string;
  selectedBranchId?: string;
  branchId?: string;
  branchLabel?: string;
  onChange?: (...args: any[]) => void;
  companyLabel?: string;
}) {
  const selectedBranchId = propSelectedBranchId ?? branchId ?? "";
  const [open, setOpen] = useState(false);
  const [tagCleared, setTagCleared] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const emitChange = (branchId: string) => {
    setTagCleared(false);
    if (!onChange) return;
    if (onChange.length >= 2 || selectedScope !== undefined) {
      const nextScope = branchId ? "BRANCH" : selectedScope === "ENTERPRISE" ? "ENTERPRISE" : "COMPANY";
      onChange(nextScope, branchId);
    } else {
      onChange(branchId);
    }
  };

  const defaultLabel = companyLabel || getActiveCompanyDisplayName();
  const activeBranch = branches.find((b) => String(b.id) === String(selectedBranchId));
  const pillLabel = activeBranch ? `${activeBranch.name}` : defaultLabel;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#1e293b", fontSize: 13 }}>
        Chi nhánh
      </label>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          minHeight: 36,
          padding: "4px 10px 4px 6px",
          border: open ? "1px solid #00a862" : "1px solid #cbd5e1",
          borderRadius: 4,
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {!tagCleared ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#e2e8f0",
                color: "#1e293b",
                borderRadius: 3,
                padding: "3px 8px",
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              <span>{pillLabel}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedBranchId) {
                    emitChange("");
                  } else {
                    setTagCleared(true);
                    setOpen(true);
                  }
                }}
                style={{
                  cursor: "pointer",
                  color: "#475569",
                  fontWeight: 700,
                  fontSize: 13,
                  lineHeight: 1,
                }}
                title="Bỏ chọn chi nhánh"
              >
                ×
              </span>
            </span>
          ) : (
            <span style={{ color: "#94a3b8", fontSize: 12.5, paddingLeft: 4 }}>
              Chọn đơn vị / chi nhánh...
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 8, borderLeft: "1px solid #cbd5e1", color: "#475569" }}>
          <ChevronDown size={15} />
        </div>
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.14)",
            zIndex: 100000,
            maxHeight: 220,
            overflowY: "auto",
            padding: 4,
          }}
        >
          <div
            onClick={() => {
              emitChange("");
              setOpen(false);
            }}
            style={{
              padding: "7px 10px",
              fontSize: 13,
              borderRadius: 3,
              cursor: "pointer",
              background: !selectedBranchId && !tagCleared ? "#e6f7ef" : "transparent",
              color: !selectedBranchId && !tagCleared ? "#00a862" : "#1e293b",
              fontWeight: !selectedBranchId && !tagCleared ? 600 : 400,
            }}
          >
            {defaultLabel.includes("Toàn doanh nghiệp") ? defaultLabel : `${defaultLabel} (Toàn doanh nghiệp)`}
          </div>
          {branches.map((b) => {
            const selected = String(b.id) === String(selectedBranchId);
            return (
              <div
                key={b.id}
                onClick={() => {
                  emitChange(String(b.id));
                  setOpen(false);
                }}
                style={{
                  padding: "7px 10px",
                  fontSize: 13,
                  borderRadius: 3,
                  cursor: "pointer",
                  background: selected ? "#e6f7ef" : "transparent",
                  color: selected ? "#00a862" : "#1e293b",
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {b.code ? `${b.code} – ` : ""}{b.name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MisaAccumulateFromRadioGroup({
  value = "fiscal_start",
  onChange,
  name = "accumulateFrom",
}: {
  value?: string;
  onChange?: (val: any) => void;
  name?: string;
}) {
  const isDataStart = value === "data_start" || value === "DATA_START";
  const isUpper = value === "DATA_START" || value === "FISCAL_YEAR_START";

  const optionStyle = (checked: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    border: `1px solid ${checked ? "#00a862" : "#e2e8f0"}`,
    background: checked ? "#f0fdf4" : "#ffffff",
    borderRadius: 6,
    cursor: "pointer",
    color: checked ? "#065f46" : "#334155",
    fontSize: 13,
    fontWeight: checked ? 600 : 400,
    transition: "border-color 0.15s, background 0.15s",
  });
  const radioStyle: React.CSSProperties = { accentColor: "#00a862", width: 16, height: 16, margin: 0, flexShrink: 0, cursor: "pointer" };

  return (
    <div>
      <div style={{ color: "#1e293b", fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
        Lấy lũy kế phát sinh từ
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <label style={optionStyle(isDataStart)}>
          <input
            type="radio"
            name={name}
            value="data_start"
            checked={isDataStart}
            onChange={() => onChange?.(isUpper ? "DATA_START" : "data_start")}
            style={radioStyle}
          />
          <span>Ngày bắt đầu dữ liệu</span>
        </label>

        <label style={optionStyle(!isDataStart)}>
          <input
            type="radio"
            name={name}
            value="fiscal_start"
            checked={!isDataStart}
            onChange={() => onChange?.(isUpper ? "FISCAL_YEAR_START" : "fiscal_start")}
            style={radioStyle}
          />
          <span>Ngày bắt đầu năm tài chính của kỳ báo cáo</span>
        </label>
      </div>
    </div>
  );
}
