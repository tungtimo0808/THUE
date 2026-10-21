import { useMemo, useState } from "react";
import { FileSpreadsheet, X } from "lucide-react";
import { request } from "./live-api";

type Profile = { id: string; account_number: string; bank_name: string; bank_branch?: string; branch_id?: string; branch_name?: string; currency_id: string; currency_code: string };
type Mapping = Record<string, string>;
type PreviewRow = { source_row: number; status: "VALID" | "ERROR" | "DUPLICATE" | "SUSPECT"; reason: string; transaction_date: string; direction: string; amount: string; description: string; reference: string; existing?: { number: string; transaction_date: string; amount: string; description: string } | null };
type Preview = { rows: PreviewRow[]; counts: Record<string, number>; total_receipts: string; total_payments: string; calculated_closing: string | null; balance_difference: string | null };

const fields: [string, string][] = [
  ["transaction_date", "Ngày giao dịch"], ["description", "Nội dung giao dịch"],
  ["receipt", "Số tiền thu"], ["payment", "Số tiền chi"], ["amount", "Số tiền một cột"],
  ["direction", "Chiều giao dịch"], ["reference", "Mã giao dịch"],
  ["ending_balance", "Số dư sau giao dịch"], ["source_account", "Số tài khoản trong tệp"],
  ["source_currency", "Loại tiền trong tệp"], ["counterparty", "Tên đối tác"],
  ["counterparty_account", "Tài khoản đối tác"], ["value_date", "Ngày giá trị"],
];

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 } as const;
const inputStyle = { width: "100%", height: 34, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, background: "#fff" } as const;

function dateValue(value: unknown, format: string, excel: typeof import("xlsx") | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return validDate(y, m, d);
  }
  if (/^\d+(\.\d+)?$/.test(raw) && excel) {
    const parts = excel.SSF.parse_date_code(Number(raw));
    return parts ? validDate(parts.y, parts.m, parts.d) : "";
  }
  const match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(raw);
  if (!match) return "";
  const first = Number(match[1]), second = Number(match[2]);
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
  return format === "MDY" ? validDate(year, first, second) : validDate(year, second, first);
}

function validDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
}

function amountValue(value: unknown, format: string): number {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = format === "VI" ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
}

function infer(headers: string[]): Mapping {
  const normalized = headers.map((header) => header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d"));
  const patterns: Record<string, RegExp> = {
    transaction_date: /ngay giao dich|ngay gd|transaction date|booking date|^ngay$/,
    description: /noi dung|dien giai|description|narrative/,
    receipt: /tien thu|ghi co|credit|^thu$/,
    payment: /tien chi|ghi no|debit|^chi$/,
    reference: /ma giao dich|tham chieu|reference|transaction id/,
  };
  return Object.fromEntries(Object.entries(patterns).map(([key, pattern]) => [key, String(normalized.findIndex((header) => pattern.test(header)))]).filter(([, value]) => value !== "-1"));
}

export default function BankStatementImportModal({ companyId, token, profiles, onClose, onImported }: {
  companyId: string; token: string; profiles: Profile[]; onClose: () => void; onImported: (count: number, reference: string, accountId: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [excel, setExcel] = useState<typeof import("xlsx") | null>(null);
  const [workbook, setWorkbook] = useState<import("xlsx").WorkBook | null>(null);
  const [sheet, setSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(1);
  const [firstDataRow, setFirstDataRow] = useState(2);
  const [dateFormat, setDateFormat] = useState("DMY");
  const [numberFormat, setNumberFormat] = useState("VI");
  const [mapping, setMapping] = useState<Mapping>({});
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [opening, setOpening] = useState("");
  const [closing, setClosing] = useState("");
  const [signedMode, setSignedMode] = useState("positive_receipt");
  const [uniqueReference, setUniqueReference] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmSuspects, setConfirmSuspects] = useState<number[]>([]);
  const [confirmBalance, setConfirmBalance] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const profile = profiles.find((item) => item.id === accountId);
  const sheetRows = useMemo(() => workbook && excel && sheet
    ? excel.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, raw: false, defval: "" }) : [], [workbook, excel, sheet]);
  const headers = (sheetRows[headerRow - 1] || []).map((cell) => String(cell || ""));
  const selectedRows = preview?.rows.filter((row) => selected.includes(row.source_row)) || [];
  const selectedReceipts = selectedRows.filter((row) => row.direction === "CREDIT").reduce((sum, row) => sum + Number(row.amount), 0);
  const selectedPayments = selectedRows.filter((row) => row.direction === "DEBIT").reduce((sum, row) => sum + Number(row.amount), 0);
  const resetPreview = () => { setPreview(null); setConfirmation(false); setSelected([]); setConfirmSuspects([]); };

  async function chooseFile(chosen: File | null) {
    resetPreview(); setError("");
    if (!chosen) return;
    if (!/\.(xlsx|xls)$/i.test(chosen.name) || chosen.size === 0 || chosen.size > 20 * 1024 * 1024) {
      setError("Chỉ nhận tệp Excel .xlsx hoặc .xls, tối đa 20 MB."); return;
    }
    try {
      const module = await import("xlsx");
      const book = module.read(await chosen.arrayBuffer(), { type: "array" });
      if (!book.SheetNames.length) throw new Error("Tệp không có trang tính.");
      setFile(chosen); setExcel(module); setWorkbook(book); setSheet(book.SheetNames[0]);
      setHeaderRow(1); setFirstDataRow(2);
      const first = module.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]], { header: 1, raw: false, defval: "" })[0] || [];
      setMapping(infer(first.map(String)));
    } catch { setFile(null); setWorkbook(null); setError("Không đọc được tệp Excel; hãy kiểm tra tệp không hỏng hoặc có mật khẩu."); }
  }

  function buildRows(): Record<string, unknown>[] {
    if (!file || !profile || !from || !to || from > to) throw new Error("Chọn tệp, tài khoản và khoảng ngày sao kê hợp lệ.");
    if (firstDataRow <= headerRow || headerRow < 1) throw new Error("Dòng dữ liệu phải nằm sau dòng tiêu đề.");
    if (!mapping.transaction_date || !mapping.description) throw new Error("Cần ghép cột Ngày giao dịch và Nội dung.");
    const twoColumns = mapping.receipt && mapping.payment;
    if (!twoColumns && !mapping.amount) throw new Error("Ghép cột Thu/Chi hoặc cột Số tiền.");
    const result: Record<string, unknown>[] = [];
    for (let index = firstDataRow - 1; index < sheetRows.length; index += 1) {
      const source = sheetRows[index] || [];
      if (source.every((cell) => String(cell ?? "").trim() === "")) continue;
      const cell = (key: string) => mapping[key] === undefined || mapping[key] === "" ? "" : String(source[Number(mapping[key])] ?? "").trim();
      const receipt = amountValue(cell("receipt"), numberFormat), payment = amountValue(cell("payment"), numberFormat);
      const signed = amountValue(cell("amount"), numberFormat);
      let direction = "", amount = 0;
      if (twoColumns) {
        if (receipt > 0 && !(payment > 0)) { direction = "CREDIT"; amount = receipt; }
        else if (payment > 0 && !(receipt > 0)) { direction = "DEBIT"; amount = payment; }
      } else if (Number.isFinite(signed) && signed !== 0) {
        const directionCell = cell("direction").toLowerCase();
        if (mapping.direction) direction = /^(thu|co|có|credit|cr|in)$/i.test(directionCell) ? "CREDIT" : /^(chi|no|nợ|debit|dr|out)$/i.test(directionCell) ? "DEBIT" : "";
        else direction = signedMode === "positive_receipt" ? (signed > 0 ? "CREDIT" : "DEBIT") : (signed > 0 ? "DEBIT" : "CREDIT");
        amount = Math.abs(signed);
      }
      result.push({ source_row: index + 1, transaction_date: dateValue(cell("transaction_date"), dateFormat, excel),
        value_date: cell("value_date") ? dateValue(cell("value_date"), dateFormat, excel) : "",
        description: cell("description"), direction, amount: Number.isFinite(amount) ? String(amount) : "",
        reference: cell("reference"), ending_balance: cell("ending_balance"),
        source_account: cell("source_account"), source_currency: cell("source_currency"),
        counterparty: cell("counterparty"), counterparty_account: cell("counterparty_account"),
        raw: Object.fromEntries(source.map((value, column) => [headers[column] || `Cột ${column + 1}`, String(value ?? "")])) });
    }
    if (!result.length) throw new Error("Trang tính không có dòng giao dịch.");
    return result;
  }

  function payload(items: Record<string, unknown>[]) {
    return { company: companyId, account: accountId, currency: profile?.currency_id, period_from: from,
      period_to: to, sheet_name: sheet, header_row: headerRow, first_data_row: firstDataRow,
      date_format: dateFormat, number_format: numberFormat, column_mapping: mapping,
      opening_balance: opening ? String(amountValue(opening, numberFormat)) : "",
      closing_balance: closing ? String(amountValue(closing, numberFormat)) : "",
      unique_reference: uniqueReference, rows: items };
  }

  async function check() {
    setBusy(true); setError(""); resetPreview();
    try {
      const items = buildRows();
      const result = await request<Preview>(`/api/v1/bank/statements/preview-import/?company_id=${encodeURIComponent(companyId)}${profile?.branch_id ? `&branch_id=${encodeURIComponent(profile.branch_id)}` : ""}`, token,
        { method: "POST", body: JSON.stringify(payload(items)) });
      setRows(items); setPreview(result); setSelected(result.rows.filter((row) => row.status === "VALID").map((row) => row.source_row));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không kiểm tra được dữ liệu sao kê."); }
    finally { setBusy(false); }
  }

  async function importRows() {
    if (!file || !preview) return;
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.append("source_file", file);
      form.append("payload", JSON.stringify({ ...payload(rows), selected_rows: selected,
        confirmed_suspects: confirmSuspects, confirm_balance_warning: confirmBalance }));
      const url = `/api/v1/bank/statements/import-file/?company_id=${encodeURIComponent(companyId)}${profile?.branch_id ? `&branch_id=${encodeURIComponent(profile.branch_id)}` : ""}`;
      const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Object.entries(data).map(([key, value]) => `${key}: ${String(value)}`).join("; ") || `HTTP ${response.status}`);
      onImported(selected.length, data.source_reference, accountId);
      onClose();
    } catch (caught) { setConfirmation(false); setError(caught instanceof Error ? caught.message : "Không lưu được sao kê."); }
    finally { setBusy(false); }
  }

  function downloadErrors() {
    if (!preview) return;
    const escaped = (value: unknown) => {
      const text = String(value ?? "");
      const safe = /^[=+@-]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const lines = [["Dòng", "Kết quả", "Lý do", "Ngày", "Mã giao dịch", "Nội dung"],
      ...preview.rows.filter((row) => row.status !== "VALID").map((row) => [row.source_row, row.status, row.reason, row.transaction_date, row.reference, row.description])];
    const blob = new Blob(["\uFEFF", lines.map((line) => line.map(escaped).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "loi-sao-ke.csv"; link.click(); URL.revokeObjectURL(url);
  }

  const close = () => { if ((file || preview) && !window.confirm("Bỏ thao tác nhập sao kê chưa lưu?")) return; onClose(); };
  return <div className="misa-tax-modal-overlay" role="dialog" aria-modal="true" aria-label="Nhập sao kê ngân hàng">
    <div className="misa-tax-modal" style={{ width: "min(1100px, 96vw)", maxHeight: "94vh", display: "flex", flexDirection: "column" }}>
      <header className="misa-tax-modal-header"><h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nhập sao kê ngân hàng</h2>
        <button className="misa-tax-close-btn" type="button" onClick={close} aria-label="Đóng"><X size={18}/></button></header>
      <div className="misa-tax-modal-body" style={{ overflowY: "auto" }}>
        {error && <p role="alert" style={{ padding: 10, background: "#fef2f2", color: "#b91c1c", borderRadius: 4 }}>{error}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label style={labelStyle}>Tài khoản ngân hàng
            <select style={inputStyle} value={accountId} onChange={(event) => { setAccountId(event.target.value); resetPreview(); }}>
              <option value="">Chọn tài khoản</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.account_number} · {item.bank_name} · {item.currency_code}</option>)}
            </select></label>
          <label style={labelStyle}>Chi nhánh / đơn vị quản lý<input style={inputStyle} readOnly value={profile?.branch_name || ""}/></label>
          <label style={labelStyle}>Loại tiền<input style={inputStyle} readOnly value={profile?.currency_code || ""}/></label>
          <label style={labelStyle}>Từ ngày<input style={inputStyle} type="date" value={from} onChange={(event) => { setFrom(event.target.value); resetPreview(); }}/></label>
          <label style={labelStyle}>Đến ngày<input style={inputStyle} type="date" value={to} onChange={(event) => { setTo(event.target.value); resetPreview(); }}/></label>
          <label style={labelStyle}>Tệp sao kê (.xlsx, .xls; tối đa 20 MB)<input style={{ ...inputStyle, paddingTop: 5 }} type="file" accept=".xlsx,.xls" onChange={(event) => void chooseFile(event.target.files?.[0] || null)}/></label>
        </div>
        {file && workbook && <>
          <p style={{ fontSize: 12, color: "#475569" }}><FileSpreadsheet size={15} style={{ verticalAlign: "middle" }}/> {file.name} · {(file.size / 1024).toFixed(1)} KB · {workbook.SheetNames.length} trang tính</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <label style={labelStyle}>Trang tính<select style={inputStyle} value={sheet} onChange={(event) => { setSheet(event.target.value); resetPreview(); }}>
              {workbook.SheetNames.map((name) => <option key={name}>{name}</option>)}
            </select></label>
            <label style={labelStyle}>Dòng tiêu đề<input style={inputStyle} type="number" min={1} value={headerRow} onChange={(event) => { setHeaderRow(Number(event.target.value)); resetPreview(); }}/></label>
            <label style={labelStyle}>Dòng bắt đầu dữ liệu<input style={inputStyle} type="number" min={2} value={firstDataRow} onChange={(event) => { setFirstDataRow(Number(event.target.value)); resetPreview(); }}/></label>
            <label style={labelStyle}>Định dạng ngày<select style={inputStyle} value={dateFormat} onChange={(event) => { setDateFormat(event.target.value); resetPreview(); }}><option value="DMY">dd/MM/yyyy</option><option value="MDY">MM/dd/yyyy</option></select></label>
            <label style={labelStyle}>Định dạng số<select style={inputStyle} value={numberFormat} onChange={(event) => { setNumberFormat(event.target.value); resetPreview(); }}><option value="VI">1.234,56</option><option value="US">1,234.56</option></select></label>
          </div>
          <h3 style={{ fontSize: 14, margin: "18px 0 8px" }}>Ghép cột</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {fields.map(([key, label]) => <label key={key} style={labelStyle}>{label}<select style={inputStyle} value={mapping[key] ?? ""} onChange={(event) => { setMapping({ ...mapping, [key]: event.target.value }); resetPreview(); }}>
              <option value="">Không ghép</option>{headers.map((header, index) => <option key={index} value={index}>{header || `Cột ${index + 1}`}</option>)}
            </select></label>)}
          </div>
          {!mapping.receipt || !mapping.payment ? <label style={labelStyle}>Quy ước dấu khi dùng một cột số tiền<select style={inputStyle} value={signedMode} onChange={(event) => { setSignedMode(event.target.value); resetPreview(); }}><option value="positive_receipt">Dương = Thu, âm = Chi</option><option value="positive_payment">Dương = Chi, âm = Thu</option></select></label> : null}
          <label style={{ ...labelStyle, marginTop: 10 }}><input type="checkbox" checked={uniqueReference} onChange={(event) => { setUniqueReference(event.target.checked); resetPreview(); }}/> Mã giao dịch là định danh duy nhất của từng dòng</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 10 }}>
            <label style={labelStyle}>Số dư đầu kỳ sao kê<input style={inputStyle} value={opening} onChange={(event) => { setOpening(event.target.value); resetPreview(); }}/></label>
            <label style={labelStyle}>Số dư cuối kỳ sao kê<input style={inputStyle} value={closing} onChange={(event) => { setClosing(event.target.value); resetPreview(); }}/></label>
          </div>
          <p style={{ fontSize: 12, color: "#64748b" }}>Dòng mẫu: {sheetRows.slice(firstDataRow - 1, firstDataRow + 1).map((row) => row.join(" | ")).join(" · ")}</p>
        </>}
        {preview && <section aria-label="Kết quả kiểm tra sao kê" style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 14 }}>Xem trước: {preview.counts.VALID} hợp lệ · {preview.counts.ERROR} lỗi · {preview.counts.DUPLICATE} trùng · {preview.counts.SUSPECT} nghi trùng</h3>
          {preview.rows.some((row) => row.status !== "VALID") && <button type="button" className="misa-btn-secondary" onClick={downloadErrors}>Tải danh sách lỗi / trùng (CSV)</button>}
          <p style={{ fontSize: 12 }}>Tổng thu {Number(preview.total_receipts).toLocaleString("vi-VN")} · Tổng chi {Number(preview.total_payments).toLocaleString("vi-VN")}</p>
          {preview.balance_difference !== null && Number(preview.balance_difference) !== 0 && <label style={{ color: "#b45309", fontSize: 12 }}><input type="checkbox" checked={confirmBalance} onChange={(event) => setConfirmBalance(event.target.checked)}/> Số dư chênh {Number(preview.balance_difference).toLocaleString("vi-VN")}. Tôi đã kiểm tra và chấp nhận cảnh báo.</label>}
          <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto", border: "1px solid #e2e8f0" }}><table className="misa-table" style={{ width: "100%", minWidth: 850, fontSize: 12 }}><thead><tr><th>Chọn</th><th>Dòng</th><th>Ngày</th><th>Mã GD</th><th>Nội dung</th><th>Thu</th><th>Chi</th><th>Kết quả / lý do</th></tr></thead><tbody>
            {preview.rows.map((row) => <tr key={row.source_row}><td><input type="checkbox" aria-label={`Chọn dòng ${row.source_row}`} disabled={row.status === "ERROR" || row.status === "DUPLICATE"} checked={selected.includes(row.source_row)} onChange={(event) => { setSelected(event.target.checked ? [...selected, row.source_row] : selected.filter((number) => number !== row.source_row)); if (row.status === "SUSPECT") setConfirmSuspects(event.target.checked ? [...confirmSuspects, row.source_row] : confirmSuspects.filter((number) => number !== row.source_row)); }}/></td>
              <td>{row.source_row}</td><td>{row.transaction_date}</td><td>{row.reference}</td><td>{row.description}</td><td>{row.direction === "CREDIT" ? Number(row.amount).toLocaleString("vi-VN") : ""}</td><td>{row.direction === "DEBIT" ? Number(row.amount).toLocaleString("vi-VN") : ""}</td><td>{row.status === "VALID" ? "Hợp lệ" : row.status === "ERROR" ? "Có lỗi" : row.status === "DUPLICATE" ? "Trùng xác định" : "Nghi trùng"}{row.reason ? ` — ${row.reason}` : ""}{row.existing ? ` (Lần ${row.existing.number}, ${row.existing.transaction_date}, ${row.existing.amount})` : ""}</td></tr>)}
          </tbody></table></div>
        </section>}
        {confirmation && <div role="alertdialog" aria-label="Xác nhận import sao kê" style={{ padding: 14, marginTop: 14, border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 6, fontSize: 13 }}>
          <strong>Xác nhận import</strong><p>{profile?.account_number} · {profile?.currency_code} · {from} → {to} · {selected.length} dòng · Thu {selectedReceipts.toLocaleString("vi-VN")} · Chi {selectedPayments.toLocaleString("vi-VN")} · Bỏ qua {(preview?.rows.length || 0) - selected.length} dòng.</p>
          <p>Import chỉ lưu giao dịch sao kê; chưa tạo chứng từ, bút toán hoặc thay đổi số dư kế toán.</p>
        </div>}
      </div>
      <footer className="misa-tax-modal-footer" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" className="misa-btn-secondary" onClick={close}>Hủy</button>
        <button type="button" className="misa-btn-secondary" disabled={!file || busy} onClick={() => void check()}>{busy && !confirmation ? "Đang kiểm tra..." : "Kiểm tra dữ liệu"}</button>
        {confirmation ? <button type="button" className="misa-btn-primary" disabled={busy} onClick={() => void importRows()}>{busy ? "Đang nhập..." : "Xác nhận import"}</button>
          : <button type="button" className="misa-btn-primary" disabled={!preview || !selected.length || busy || preview.balance_difference !== null && Number(preview.balance_difference) !== 0 && !confirmBalance} onClick={() => setConfirmation(true)}>Import {selected.length} dòng</button>}
      </footer>
    </div>
  </div>;
}
