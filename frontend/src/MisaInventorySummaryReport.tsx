import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Columns, Download, Printer, RefreshCw, Search, X } from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { errorText } from "./misa-api-writes";
import "./misa-inventory-summary.css";

type SummaryRow = {
  warehouse_id: string; warehouse_name: string; item_id: string; item_code: string; item_name: string; uom: string;
  opening_quantity: string; opening_value: string | null; receipt_quantity: string; receipt_value: string | null;
  issue_quantity: string; issue_value: string | null; closing_quantity: string; closing_value: string | null;
  valuation_incomplete: boolean;
};
type Option = { id: string; code: string; name: string; parent?: string | null };
type Parameters = { period: "month" | "custom"; from: string; to: string; warehouses: string[]; category: string };
type Summary = { rows: SummaryRow[]; totals: Record<string, string | null>; warehouse_ids: string[]; date_from: string; date_to: string };

const columns = [
  ["warehouse_name", "Tên kho"], ["item_code", "Mã hàng"], ["item_name", "Tên hàng"], ["uom", "ĐVT"],
  ["opening_quantity", "Đầu kỳ · SL"], ["opening_value", "Đầu kỳ · Giá trị"],
  ["receipt_quantity", "Nhập kho · SL"], ["receipt_value", "Nhập kho · Giá trị"],
  ["issue_quantity", "Xuất kho · SL"], ["issue_value", "Xuất kho · Giá trị"],
  ["closing_quantity", "Cuối kỳ · SL"], ["closing_value", "Cuối kỳ · Giá trị"],
] as const;
const numeric = new Set<string>(columns.slice(4).map(([key]) => key));
const money = new Set<string>(["opening_value", "receipt_value", "issue_value", "closing_value"]);

function monthRange(): Pick<Parameters, "from" | "to"> {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: iso(first), to: iso(last) };
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function format(value: string | null | undefined) {
  if (value == null) return "Chưa hoàn tất tính giá";
  return Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
}
function parseSaved(companyId: string): { name: string; parameters: Parameters }[] {
  try {
    const data = JSON.parse(localStorage.getItem(`soviet:stock-summary:${companyId}`) || "[]");
    return Array.isArray(data) ? data.filter((entry) => entry?.name && entry?.parameters).slice(-20) : [];
  } catch { return []; }
}

export default function MisaInventorySummaryReport({ onBack, notify, embedded = false }: {
  onBack: () => void; notify?: (message: string) => void; embedded?: boolean;
}) {
  const { token, companyId } = useApiSession();
  const defaults = useMemo<Parameters>(() => ({ period: "month", ...monthRange(), warehouses: [], category: "" }), []);
  const [draft, setDraft] = useState<Parameters>(defaults);
  const [applied, setApplied] = useState<Parameters | null>(null);
  const [options, setOptions] = useState<{ warehouses: Option[]; categories: Option[] }>({ warehouses: [], categories: [] });
  const [drawer, setDrawer] = useState(true);
  const [result, setResult] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saved, setSaved] = useState<{ name: string; parameters: Parameters }[]>([]);

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    setSaved(parseSaved(companyId));
    request<{ warehouses: Option[]; categories: Option[] }>(`/api/v1/inventory/balances/summary-options/?company_id=${companyId}`, token)
      .then((data) => { if (active) { setOptions(data); setDraft((previous) => ({ ...previous, warehouses: previous.warehouses.length ? previous.warehouses : data.warehouses.map((row) => row.id) })); } })
      .catch((reason) => { if (active) setError(`Không thể tải danh sách kho: ${errorText(reason)}`); });
    return () => { active = false; };
  }, [token, companyId]);

  async function fetchReport(parameters: Parameters) {
    if (!token || !companyId) { setError("Cần đăng nhập để xem báo cáo tồn kho."); return; }
    if (!validDate(parameters.from) || !validDate(parameters.to)) { setError("Vui lòng chọn Từ ngày và Đến ngày hợp lệ."); return; }
    if (parameters.from > parameters.to) { setError("Từ ngày phải nhỏ hơn hoặc bằng Đến ngày."); return; }
    if (!parameters.warehouses.length) { setError("Chọn ít nhất một kho để xem báo cáo."); return; }
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ company_id: companyId, date_from: parameters.from, date_to: parameters.to,
        warehouse_ids: parameters.warehouses.join(",") });
      if (parameters.category) query.set("category_id", parameters.category);
      const data = await request<Summary>(`/api/v1/inventory/balances/summary/?${query}`, token);
      setResult(data); setApplied(structuredClone(parameters)); setDraft(structuredClone(parameters));
      setSearch(""); setDrawer(false);
    } catch (reason) { setError(`Không thể tải dữ liệu tồn kho: ${errorText(reason)}`); }
    finally { setLoading(false); }
  }
  const visible = columns.filter(([key]) => !hidden.includes(key));
  const rows = (result?.rows || []).filter((row) => `${row.warehouse_name} ${row.item_code} ${row.item_name}`.toLocaleLowerCase("vi-VN").includes(search.toLocaleLowerCase("vi-VN")));
  const sameUom = rows.length > 0 && rows.every((row) => row.uom === rows[0].uom);
  const valueTotal = (key: string) => rows.some((row) => (row as any)[key] == null)
    ? null : rows.reduce((sum, row) => sum + Number((row as any)[key] || 0), 0).toString();
  const quantityTotal = (key: string) => sameUom ? rows.reduce((sum, row) => sum + Number((row as any)[key] || 0), 0).toString() : "—";
  const display = (row: SummaryRow, key: string) => numeric.has(key) ? format((row as any)[key]) : String((row as any)[key] ?? "");
  const scope = applied ? applied.warehouses.map((id) => options.warehouses.find((row) => row.id === id)?.name || "").filter(Boolean).join(", ") : "";

  function exportCsv() {
    if (!result) return;
    try {
      const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
      const csv = [visible.map(([, label]) => quote(label)).join(";"),
        ...rows.map((row) => visible.map(([key]) => quote(display(row, key))).join(";")),
        visible.map(([key], index) => quote(index === 0 ? "Tổng cộng" : money.has(key) ? format(valueTotal(key)) : numeric.has(key) ? quantityTotal(key) : "")).join(";")].join("\r\n");
      const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `tong-hop-ton-kho-${applied?.from}-${applied?.to}.csv`;
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Xuất báo cáo thất bại. Vui lòng thử lại."); }
  }
  function save() {
    if (!applied || !companyId) return;
    const name = `Tổng hợp tồn kho (${applied.from} – ${applied.to})`;
    const next = [...saved, { name, parameters: structuredClone(applied) }].slice(-20);
    try { localStorage.setItem(`soviet:stock-summary:${companyId}`, JSON.stringify(next)); setSaved(next); notify?.("Đã lưu cấu hình báo cáo."); }
    catch { setError("Không thể lưu cấu hình báo cáo."); }
  }

  return <div className={`inventory-summary-report${embedded ? " embedded" : ""}`}>
    <header className="inventory-summary-header"><div><button type="button" aria-label="Danh sách báo cáo" onClick={onBack}><ChevronLeft size={18} /></button><h2>Tổng hợp tồn kho</h2></div>
      <div><button type="button" onClick={() => setSavedOpen(!savedOpen)}>Danh sách báo cáo đã lưu</button><button type="button" disabled={!result} onClick={save}>Lưu báo cáo</button><button type="button" className="primary" onClick={() => { setDraft(structuredClone(applied || draft)); setError(""); setDrawer(true); }}>Chọn tham số</button></div></header>
    {savedOpen && <div className="inventory-summary-saved">{saved.length ? saved.map((entry, index) => <button key={index} type="button" onClick={() => { setDraft(structuredClone(entry.parameters)); setSavedOpen(false); void fetchReport(entry.parameters); }}>{entry.name}</button>) : <span>Chưa có báo cáo đã lưu.</span>}</div>}
    <div className="inventory-summary-toolbar"><div><button type="button" aria-label="Ẩn hiện cột" onClick={() => setColumnsOpen(!columnsOpen)}><Columns size={16} /></button><button type="button" aria-label="Nạp lại" disabled={!applied || loading} onClick={() => applied && void fetchReport(applied)}><RefreshCw size={16} /></button></div>
      <label className="inventory-summary-search"><Search size={15} /><input placeholder="Nhập từ khóa tìm kiếm" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <button type="button" aria-label="In báo cáo" disabled={!result} onClick={() => window.print()}><Printer size={16} /></button><button type="button" aria-label="Xuất báo cáo" disabled={!result} onClick={exportCsv}><Download size={16} /></button></div>
    {columnsOpen && <div className="inventory-summary-columns">{columns.map(([key, label]) => <label key={key}><input type="checkbox" checked={!hidden.includes(key)} onChange={() => setHidden((previous) => previous.includes(key) ? previous.filter((value) => value !== key) : [...previous, key])} />{label}</label>)}</div>}
    {error && <div role="alert" className="inventory-summary-error">{error}</div>}
    {result && applied && <div className="inventory-summary-meta">Kỳ: {applied.from.split("-").reverse().join("/")} – {applied.to.split("-").reverse().join("/")} · Kho: {scope} · Đơn vị tính chính{applied.category ? ` · Nhóm: ${options.categories.find((row) => row.id === applied.category)?.name || ""}` : ""}</div>}
    <div className="inventory-summary-content">{!result ? <div className="inventory-summary-empty">Chọn tham số để xem số liệu tồn kho.</div> : rows.length === 0 ? <div className="inventory-summary-empty">Không có dữ liệu phù hợp với điều kiện đã chọn.</div> : <table><thead><tr>{visible.map(([key, label]) => <th key={key} className={numeric.has(key) ? "number" : ""}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={`${row.warehouse_id}:${row.item_id}`}>{visible.map(([key]) => <td key={key} className={`${numeric.has(key) ? "number" : ""}${(row as any)[key] == null ? " incomplete" : ""}`}>{display(row, key)}</td>)}</tr>)}</tbody><tfoot><tr>{visible.map(([key], index) => <td key={key} className={numeric.has(key) ? "number" : ""}>{index === 0 ? "Tổng cộng" : money.has(key) ? format(valueTotal(key)) : numeric.has(key) ? quantityTotal(key) : ""}</td>)}</tr></tfoot></table>}</div>
    {result && !sameUom && rows.length > 0 && <div className="inventory-summary-note">Không cộng số lượng của các mặt hàng khác đơn vị tính.</div>}
    {drawer && <div className="inventory-summary-overlay"><div className="inventory-summary-dialog" role="dialog" aria-label="Chọn tham số"><header><strong>Chọn tham số · Tổng hợp tồn kho</strong><button type="button" aria-label="Đóng bảng tham số" onClick={() => { setDrawer(false); setError(""); }}><X size={18} /></button></header>
      <div className="inventory-summary-form"><label>Kỳ báo cáo<select value={draft.period} onChange={(event) => setDraft((current) => ({ ...current, period: event.target.value as Parameters["period"], ...(event.target.value === "month" ? monthRange() : {}) }))}><option value="month">Tháng này</option><option value="custom">Tùy chọn</option></select></label>
        <label>Từ ngày<input type="date" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, period: "custom", from: event.target.value }))} /></label>
        <label>Đến ngày<input type="date" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, period: "custom", to: event.target.value }))} /></label>
        <label>Đơn vị tính<select value="base" disabled><option value="base">Đơn vị tính chính</option></select></label>
        <label>Nhóm VTHH<select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}><option value="">Tất cả nhóm</option>{options.categories.map((category) => <option key={category.id} value={category.id}>{category.code} · {category.name}</option>)}</select></label>
        <fieldset><legend>Kho</legend><label><input type="checkbox" checked={options.warehouses.length > 0 && draft.warehouses.length === options.warehouses.length} onChange={(event) => setDraft((current) => ({ ...current, warehouses: event.target.checked ? options.warehouses.map((row) => row.id) : [] }))} />Chọn tất cả kho</label>
          <div>{options.warehouses.map((warehouse) => <label key={warehouse.id}><input type="checkbox" checked={draft.warehouses.includes(warehouse.id)} onChange={(event) => setDraft((current) => ({ ...current, warehouses: event.target.checked ? [...current.warehouses, warehouse.id] : current.warehouses.filter((id) => id !== warehouse.id) }))} />{warehouse.code} · {warehouse.name}</label>)}</div></fieldset>
      </div><footer><button type="button" onClick={() => setDraft({ period: "month", ...monthRange(), warehouses: options.warehouses.map((row) => row.id), category: "" })}>Xóa điều kiện</button><div><button type="button" onClick={() => { setDrawer(false); setError(""); }}>Hủy</button><button type="button" className="primary" disabled={loading} onClick={() => void fetchReport(draft)}>{loading ? "Đang tải..." : "Xem báo cáo"}</button></div></footer></div></div>}
  </div>;
}
