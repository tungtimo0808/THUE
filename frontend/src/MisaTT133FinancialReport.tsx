import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Download, Printer, RefreshCw } from "lucide-react";
import { apiClient, getSelectedCompanyId } from "./apiClient";
import "./misa-tt133-report.css";

export const TT133_REPORTS = [
  ["B01a-DNN", "Báo cáo tình hình tài chính"],
  ["B01b-DNN", "Báo cáo tình hình tài chính (ngắn hạn, dài hạn)"],
  ["B02-DNN", "Báo cáo kết quả hoạt động kinh doanh"],
  ["B03-DNN", "Báo cáo lưu chuyển tiền tệ (PP trực tiếp)"],
  ["B03-DNN-GT", "Báo cáo lưu chuyển tiền tệ (PP gián tiếp)"],
  ["B09-DNN", "Thuyết minh báo cáo tài chính"],
  ["F01-DNN", "Bảng cân đối tài khoản"],
] as const;

type ReportCode = (typeof TT133_REPORTS)[number][0];
type Row = {
  code: string;
  name: string;
  level?: number;
  status?: string;
  narrative?: string;
  current?: string | null;
  previous?: string | null;
  opening_debit?: string;
  opening_credit?: string;
  period_debit?: string;
  period_credit?: string;
  closing_debit?: string;
  closing_credit?: string;
};
type Report = {
  code: ReportCode;
  title: string;
  year: number;
  company_name: string;
  rows: Row[];
  warnings: string[];
  has_data: boolean;
};

function money(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : value;
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export default function MisaTT133FinancialReport({
  onBack,
  initialCode = "B01a-DNN",
}: {
  onBack: () => void;
  initialCode?: ReportCode;
}) {
  const [code, setCode] = useState<ReportCode>(initialCode);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState("");

  const load = useCallback(async () => {
    const companyId = getSelectedCompanyId();
    if (!companyId) {
      setReport(null);
      setError("Chọn doanh nghiệp trước khi xem báo cáo tài chính.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ company_id: companyId, year: String(year), template_code: code });
      const data = await apiClient.get<Report>(`/api/v1/reports/tt133-financial-statements/?${params}`);
      setReport(data);
      if (code === "B09-DNN") setNoteDrafts(Object.fromEntries(data.rows.filter((row) => row.narrative !== undefined).map((row) => [row.code, row.narrative || ""])));
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "Không thể tải báo cáo.");
    } finally {
      setLoading(false);
    }
  }, [code, year]);

  async function saveNote(sectionCode: string) {
    const companyId = getSelectedCompanyId();
    if (!companyId) return;
    setSavingNote(sectionCode);
    setError("");
    try {
      await apiClient.patch(`/api/v1/reports/tt133-financial-statements/notes/?company_id=${encodeURIComponent(companyId)}&year=${year}`, {
        section_code: sectionCode, content: noteDrafts[sectionCode] || "",
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được thuyết minh.");
    } finally {
      setSavingNote("");
    }
  }

  useEffect(() => { void load(); }, [load]);

  function downloadCsv() {
    if (!report) return;
    const isTrial = code === "F01-DNN";
    const headings = isTrial
      ? ["Số tài khoản", "Tên tài khoản", "Dư Nợ đầu năm", "Dư Có đầu năm", "Phát sinh Nợ", "Phát sinh Có", "Dư Nợ cuối năm", "Dư Có cuối năm"]
      : code === "B09-DNN" ? ["Mã số", "Chỉ tiêu", "Năm nay", "Năm trước", "Thuyết minh"] : ["Mã số", "Chỉ tiêu", "Năm nay", "Năm trước"];
    const values = report.rows.map((row) => isTrial
      ? [row.code, row.name, row.opening_debit, row.opening_credit, row.period_debit, row.period_credit, row.closing_debit, row.closing_credit]
      : code === "B09-DNN" ? [row.code, row.name, row.current, row.previous, row.narrative] : [row.code, row.name, row.current, row.previous]);
    const csv = [headings, ...values].map((cells) => cells.map((cell) => csvEscape(String(cell ?? ""))).join(",")).join("\r\n");
    const href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `TT133_${code}_${year}.csv`;
    link.click();
    URL.revokeObjectURL(href);
  }

  return <main className="tt133-report">
    <div className="tt133-toolbar">
      <button type="button" onClick={onBack}><ChevronLeft size={17} /> Danh sách báo cáo</button>
      <strong>Báo cáo tài chính · Thông tư 133</strong>
      <span className="tt133-toolbar-spacer" />
      <label>Năm <input type="number" min="1900" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label>
      <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Lấy lại dữ liệu</button>
      <button type="button" onClick={downloadCsv} disabled={!report}><Download size={16} /> Xuất CSV</button>
      <button type="button" onClick={() => window.print()} disabled={!report}><Printer size={16} /> In</button>
    </div>
    <div className="tt133-tabs" role="tablist" aria-label="Mẫu báo cáo TT133">
      {TT133_REPORTS.map(([itemCode]) => <button key={itemCode} role="tab" aria-selected={code === itemCode} type="button" className={code === itemCode ? "active" : ""} onClick={() => setCode(itemCode)}>{itemCode}</button>)}
    </div>
    <section className="tt133-sheet" aria-busy={loading}>
      <header><h1>{report?.title || TT133_REPORTS.find(([itemCode]) => itemCode === code)?.[1]}</h1><p>Năm {year} · Mẫu số {code}</p><p>{report?.company_name || ""}</p></header>
      {error && <p role="alert" className="tt133-error">{error}</p>}
      {loading && <p role="status">Đang lấy số liệu từ sổ cái…</p>}
      {report && <>
        {!report.has_data && <p role="status" className="tt133-warning">Chưa có bút toán đã ghi sổ cho năm này. Số liệu đang trống.</p>}
        {report.warnings.map((warning) => <p key={warning} role="status" className="tt133-warning">{warning}</p>)}
        <div className="tt133-table-scroll"><table>
          <thead>{code === "F01-DNN" ? <tr><th>Số TK</th><th>Tên tài khoản</th><th>Dư Nợ đầu năm</th><th>Dư Có đầu năm</th><th>Phát sinh Nợ</th><th>Phát sinh Có</th><th>Dư Nợ cuối năm</th><th>Dư Có cuối năm</th></tr> : <tr><th>Chỉ tiêu</th><th>Mã số</th><th>Năm nay</th><th>Năm trước</th></tr>}</thead>
          <tbody>{report.rows.map((row) => <tr key={row.code} className={row.level === 0 ? "total" : ""}>
            <td>{code === "F01-DNN" ? row.code : row.name}{row.status === "REQUIRES_INPUT" && <small> Cần bổ sung</small>}
              {code === "B09-DNN" && row.narrative !== undefined && <div className="tt133-note-editor">
                <textarea aria-label={`Thuyết minh ${row.code}`} value={noteDrafts[row.code] ?? ""} maxLength={10000} onChange={(event) => setNoteDrafts((drafts) => ({ ...drafts, [row.code]: event.target.value }))} />
                <button type="button" disabled={savingNote !== "" || (noteDrafts[row.code] ?? "") === row.narrative} onClick={() => void saveNote(row.code)}>{savingNote === row.code ? "Đang lưu…" : "Lưu thuyết minh"}</button>
              </div>}
            </td>
            <td>{code === "F01-DNN" ? row.name : row.code}</td>
            {code === "F01-DNN" ? <><td>{money(row.opening_debit)}</td><td>{money(row.opening_credit)}</td><td>{money(row.period_debit)}</td><td>{money(row.period_credit)}</td><td>{money(row.closing_debit)}</td><td>{money(row.closing_credit)}</td></> : <><td>{money(row.current)}</td><td>{money(row.previous)}</td></>}
          </tr>)}</tbody>
        </table></div>
      </>}
    </section>
  </main>;
}
