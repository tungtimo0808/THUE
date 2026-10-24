import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Columns, Download, Filter, Printer, RefreshCw, Search, X } from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { errorText } from "./misa-api-writes";
import "./misa-inventory-summary.css";

type Option = { id: string; code: string; name: string; category?: string | null; status?: string; track_inventory?: boolean };
type Params = { period: "working" | "quarter" | "year" | "custom"; from: string; to: string;
  warehouses: string[]; category: string; items: string[] };
type Movement = { movement_id: string; posting_date: string; document_date: string;
  transaction_number: string; description: string; unit_price: string | null;
  receipt_quantity: string; receipt_value: string | null; issue_quantity: string;
  issue_value: string | null; balance_quantity: string; balance_value: string | null;
  negative_stock: boolean; valuation_incomplete: boolean };
type Group = { warehouse_id: string; warehouse_name: string; item_id: string; item_code: string;
  item_name: string; item_description: string; uom: string; opening_quantity: string;
  opening_value: string | null; closing_quantity: string; closing_value: string | null;
  reconciled: boolean; movements: Movement[] };
type Ledger = { date_from: string; date_to: string; currency: string; groups: Group[] };
type Line = { id: string; cells: string[]; negative?: boolean; incomplete?: boolean; balance?: boolean };

const columns = ["Tên kho", "Tên hàng", "Mô tả", "Ngày hạch toán", "Ngày chứng từ",
  "Số chứng từ", "Diễn giải", "ĐVT", "Đơn giá", "Nhập · Số lượng", "Nhập · Giá trị",
  "Xuất · Số lượng", "Xuất · Giá trị", "Tồn · Số lượng", "Tồn · Giá trị"];
const numericColumns = new Set([8, 9, 10, 11, 12, 13, 14]);
const dateText = (value: string) => value ? value.slice(0, 10).split("-").reverse().join("/") : "";
const amount = (value: string | null | undefined, zero = false) => value == null
  ? "Chưa hoàn tất tính giá" : !zero && Number(value) === 0 ? ""
  : Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T12:00:00`))
  && new Date(`${value}T12:00:00`).toISOString().slice(0, 10) === value;
function range(period: Params["period"], workingPeriod: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(workingPeriod);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) : now.getMonth() + 1;
  const pad = (value: number) => String(value).padStart(2, "0");
  const start = period === "year" ? 1 : period === "quarter" ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  const end = period === "year" ? 12 : period === "quarter" ? start + 2 : month;
  return { from: `${year}-${pad(start)}-01`,
    to: `${year}-${pad(end)}-${pad(new Date(year, end, 0).getDate())}` };
}
function reportLines(report: Ledger, search: string): Line[] {
  const keyword = search.trim().toLocaleLowerCase("vi");
  const lines: Line[] = [];
  for (const group of report.groups) {
    const groupMatch = `${group.warehouse_name} ${group.item_code} ${group.item_name}`.toLocaleLowerCase("vi").includes(keyword);
    const movements = keyword && !groupMatch ? group.movements.filter((movement) =>
      `${movement.transaction_number} ${movement.description}`.toLocaleLowerCase("vi").includes(keyword)) : group.movements;
    if (keyword && !groupMatch && !movements.length) continue;
    const base = [group.warehouse_name, `${group.item_code} · ${group.item_name}`, group.item_description];
    lines.push({ id: `${group.warehouse_id}-${group.item_id}-opening`, balance: true,
      cells: [...base, "", "", "", "Tồn đầu kỳ", group.uom, "", "", "", "", "",
        amount(group.opening_quantity, true), amount(group.opening_value, true)] });
    for (const movement of movements) lines.push({ id: movement.movement_id,
      negative: movement.negative_stock, incomplete: movement.valuation_incomplete,
      cells: [...base, dateText(movement.posting_date), dateText(movement.document_date),
        movement.transaction_number, movement.description, group.uom, movement.unit_price == null ? "" : amount(movement.unit_price),
        amount(movement.receipt_quantity), movement.receipt_value == null ? "Chưa hoàn tất tính giá" : amount(movement.receipt_value),
        amount(movement.issue_quantity), amount(movement.issue_value),
        amount(movement.balance_quantity, true), amount(movement.balance_value, true)] });
    lines.push({ id: `${group.warehouse_id}-${group.item_id}-closing`, balance: true,
      cells: [...base, "", "", "", "Tồn cuối kỳ", group.uom, "", "", "", "", "",
        amount(group.closing_quantity, true), amount(group.closing_value, true)] });
  }
  return lines;
}

export default function MisaInventoryDetailLedgerReport({ onBack, embedded = false, initialPeriod }: {
  onBack: () => void; embedded?: boolean; initialPeriod?: string;
}) {
  const { token, companyId } = useApiSession();
  const workingPeriod = initialPeriod || new URLSearchParams(window.location.search).get("period") || "";
  const initial = (): Params => ({ period: "working", ...range("working", workingPeriod), warehouses: [], category: "", items: [] });
  const [options, setOptions] = useState<{ warehouses: Option[]; categories: Option[]; items: Option[] }>({ warehouses: [], categories: [], items: [] });
  const [draft, setDraft] = useState<Params>(initial);
  const [applied, setApplied] = useState<Params | null>(null);
  const [report, setReport] = useState<Ledger | null>(null);
  const [parameterOpen, setParameterOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [hidden, setHidden] = useState<number[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saved, setSaved] = useState<Params[]>(() => { try { return JSON.parse(localStorage.getItem("soviet:inventory-detail-ledger") || "[]"); } catch { return []; } });
  const visibleItems = options.items.filter((item) => (!draft.category || item.category === draft.category)
    && `${item.code} ${item.name}`.toLocaleLowerCase("vi").includes(itemSearch.toLocaleLowerCase("vi")));
  const lines = useMemo(() => report ? reportLines(report, search) : [], [report, search]);
  const visible = columns.map((label, index) => ({ label, index })).filter((column) => !hidden.includes(column.index));
  const query = (params: Params) => {
    const value = new URLSearchParams({ company_id: companyId || "", date_from: params.from, date_to: params.to,
      warehouse_ids: params.warehouses.join(","), item_ids: params.items.join(",") });
    if (params.category) value.set("category_id", params.category);
    return value;
  };
  async function load(params: Params, refresh = false) {
    if (!token || !companyId) { setError("Không xác định được doanh nghiệp. Vui lòng chọn lại doanh nghiệp."); return; }
    if (!validDate(params.from) || !validDate(params.to)) { setError("Vui lòng nhập ngày hợp lệ theo định dạng DD/MM/YYYY."); return; }
    if (params.from > params.to) { setError("Từ ngày phải nhỏ hơn hoặc bằng Đến ngày."); return; }
    if (!params.warehouses.length) { setError("Vui lòng chọn ít nhất một kho."); return; }
    if (!params.items.length) { setError("Vui lòng chọn ít nhất một vật tư, hàng hóa."); return; }
    setLoading(true); setError("");
    try {
      const data = await request<Ledger>(`/api/v1/inventory/balances/detail-ledger/?${query(params)}`, token);
      setReport(data); setApplied(structuredClone(params)); setDraft(structuredClone(params));
      setParameterOpen(false);
    } catch (reason) { setError(`${refresh ? "Không thể cập nhật sổ chi tiết" : "Không thể tải dữ liệu sổ chi tiết hàng hóa"}. Vui lòng thử lại. ${errorText(reason)}`); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    Promise.all([
      request<{ warehouses: Option[]; categories: Option[] }>(`/api/v1/inventory/balances/summary-options/?company_id=${companyId}`, token),
      request<Option[]>(`/api/v1/master-data/items/?company_id=${companyId}`, token),
    ]).then(([scope, allItems]) => {
      if (!active) return;
      setOptions({ ...scope, items: allItems.filter((item) => item.status === "ACTIVE" && item.track_inventory) });
      setDraft((current) => ({ ...current, warehouses: scope.warehouses.map((row) => row.id) }));
      if (!scope.warehouses.length) setError("Bạn chưa được cấp quyền xem dữ liệu kho.");
    }).catch((reason) => { if (active) setError(`Không thể tải tham số báo cáo: ${errorText(reason)}`); });
    return () => { active = false; };
  }, [token, companyId]);
  const openParameters = () => { setDraft(applied ? structuredClone(applied) : { ...initial(), warehouses: options.warehouses.map((row) => row.id) }); setError(""); setParameterOpen(true); };
  const exportCsv = () => {
    if (!report) return;
    try {
      const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
      const rows = [visible.map((column) => column.label), ...lines.map((line) => visible.map((column) => line.cells[column.index]))];
      const blob = new Blob(["\uFEFF", rows.map((row) => row.map(quote).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `so-chi-tiet-vat-tu-${report.date_from}-${report.date_to}.csv`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { setError("Xuất báo cáo thất bại. Vui lòng thử lại."); }
  };
  const save = () => {
    if (!applied) return;
    const next = [...saved, structuredClone(applied)].slice(-20);
    setSaved(next); localStorage.setItem("soviet:inventory-detail-ledger", JSON.stringify(next));
  };
  return <div className={`inventory-summary-report${embedded ? " embedded" : ""}`}>
    <header className="inventory-summary-header"><div><button type="button" aria-label="Danh sách báo cáo" onClick={onBack}><ChevronLeft size={18} /></button><h2>Sổ chi tiết vật tư hàng hóa</h2></div>
      <div><button type="button" onClick={() => setSavedOpen(!savedOpen)}>Danh sách báo cáo đã lưu</button><button type="button" disabled={!applied} onClick={save}>Lưu báo cáo</button><button type="button" className="primary" onClick={openParameters}>Chọn tham số</button></div></header>
    {savedOpen && <div className="inventory-summary-saved">{saved.length ? saved.map((params, index) => <button key={index} type="button" onClick={() => { setSavedOpen(false); void load(params); }}>Cấu hình {index + 1} · {dateText(params.from)} – {dateText(params.to)}</button>) : "Chưa có báo cáo đã lưu."}</div>}
    <div className="inventory-summary-toolbar"><div><button type="button" aria-label="Lọc báo cáo" onClick={openParameters}><Filter size={16} /></button><button type="button" aria-label="Ẩn hiện cột" onClick={() => setColumnsOpen(!columnsOpen)}><Columns size={16} /></button></div>
      <div className="inventory-summary-search"><input aria-label="Tìm trong báo cáo" placeholder="Nhập từ khóa tìm kiếm" value={search} onChange={(event) => setSearch(event.target.value)} /><Search size={15} /></div>
      <button type="button" aria-label="Nạp lại" disabled={!applied || loading} onClick={() => applied && void load(applied, true)}><RefreshCw size={16} /></button>
      <button type="button" aria-label="In báo cáo" disabled={!report} onClick={() => window.print()}><Printer size={16} /></button>
      <button type="button" aria-label="Xuất báo cáo" disabled={!report} onClick={exportCsv}><Download size={16} /></button></div>
    {columnsOpen && <div className="inventory-summary-columns">{columns.map((label, index) => <label key={index}><input type="checkbox" checked={!hidden.includes(index)} onChange={() => setHidden((old) => old.includes(index) ? old.filter((value) => value !== index) : [...old, index])} />{label}</label>)}</div>}
    {applied && report && <div className="inventory-summary-meta">Kỳ báo cáo: {dateText(applied.from)} – {dateText(applied.to)} · Kho: {applied.warehouses.map((id) => options.warehouses.find((row) => row.id === id)?.name || id).join(", ")} · Đơn vị tính: Đơn vị tính chính · Tiền tệ: {report.currency}</div>}
    {error && <div className="inventory-summary-error" role="alert">{error}{report && " Số liệu đang hiển thị có thể đã cũ."}</div>}
    {report?.groups.some((group) => !group.reconciled) && <div className="inventory-summary-error" role="alert">Số liệu sổ chi tiết chưa khớp báo cáo tồn kho. Vui lòng đối chiếu dữ liệu nguồn.</div>}
    <div className="inventory-summary-content">{!report ? <div className="inventory-summary-empty">Chọn tham số để xem sổ chi tiết vật tư hàng hóa.</div>
      : !lines.length ? <div className="inventory-summary-empty">Không có dữ liệu phù hợp với điều kiện đã chọn.</div>
      : <table aria-label="Sổ chi tiết vật tư hàng hóa"><thead><tr>{visible.map((column) => <th key={column.index} className={numericColumns.has(column.index) ? "number" : ""}>{column.label}</th>)}</tr></thead>
        <tbody>{lines.map((line) => <tr key={line.id} style={line.balance ? { background: "#f2f7f4", fontWeight: 600 } : undefined}>{visible.map((column) => <td key={column.index} className={`${numericColumns.has(column.index) ? "number" : ""}${line.negative && column.index === 13 ? " negative" : ""}${line.incomplete && [10, 12, 14].includes(column.index) ? " incomplete" : ""}`}>{line.cells[column.index]}</td>)}</tr>)}</tbody></table>}</div>
    {parameterOpen && <div className="inventory-summary-overlay"><div className="inventory-summary-dialog" role="dialog" aria-label="Chọn tham số sổ chi tiết">
      <header><strong>Chọn tham số</strong><button type="button" aria-label="Đóng tham số" onClick={() => setParameterOpen(false)}><X size={18} /></button></header>
      <div className="inventory-summary-form"><label>Kỳ báo cáo<select value={draft.period} onChange={(event) => { const period = event.target.value as Params["period"]; setDraft((old) => ({ ...old, period, ...(period === "custom" ? {} : range(period, workingPeriod)) })); }}><option value="working">Kỳ đang làm việc</option><option value="quarter">Quý hiện tại</option><option value="year">Năm hiện tại</option><option value="custom">Tùy chọn</option></select></label>
        <label>Đơn vị tính<select value="base" disabled><option value="base">Đơn vị tính chính</option></select></label>
        <label>Từ ngày<input type="date" value={draft.from} onChange={(event) => setDraft((old) => ({ ...old, period: "custom", from: event.target.value }))} /></label>
        <label>Đến ngày<input type="date" value={draft.to} onChange={(event) => setDraft((old) => ({ ...old, period: "custom", to: event.target.value }))} /></label>
        <label>Nhóm VTHH<select value={draft.category} onChange={(event) => setDraft((old) => ({ ...old, category: event.target.value }))}><option value="">Tất cả nhóm</option>{options.categories.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
        <fieldset><legend>Kho</legend><label><input type="checkbox" checked={options.warehouses.length > 0 && draft.warehouses.length === options.warehouses.length} onChange={(event) => setDraft((old) => ({ ...old, warehouses: event.target.checked ? options.warehouses.map((row) => row.id) : [] }))} />Chọn tất cả kho</label><div>{options.warehouses.map((row) => <label key={row.id}><input type="checkbox" checked={draft.warehouses.includes(row.id)} onChange={(event) => setDraft((old) => ({ ...old, warehouses: event.target.checked ? [...old.warehouses, row.id] : old.warehouses.filter((id) => id !== row.id) }))} />{row.code} · {row.name}</label>)}</div></fieldset>
        <fieldset><legend>Vật tư, hàng hóa</legend><input aria-label="Tìm vật tư, hàng hóa" placeholder="Tìm theo mã hoặc tên" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} /><label><input type="checkbox" checked={visibleItems.length > 0 && visibleItems.every((item) => draft.items.includes(item.id))} onChange={(event) => setDraft((old) => ({ ...old, items: event.target.checked ? [...new Set([...old.items, ...visibleItems.map((item) => item.id)])] : old.items.filter((id) => !visibleItems.some((item) => item.id === id)) }))} />Chọn tất cả hàng hóa</label><div>{visibleItems.map((item) => <label key={item.id}><input type="checkbox" checked={draft.items.includes(item.id)} onChange={(event) => setDraft((old) => ({ ...old, items: event.target.checked ? [...old.items, item.id] : old.items.filter((id) => id !== item.id) }))} />{item.code} · {item.name}</label>)}</div></fieldset></div>
      {error && <div className="inventory-summary-error" role="alert">{error}</div>}
      <footer><button type="button" onClick={() => setDraft({ ...initial(), warehouses: options.warehouses.map((row) => row.id) })}>Xóa điều kiện</button><div><button type="button" onClick={() => setParameterOpen(false)}>Hủy</button><button type="button" className="primary" disabled={loading} onClick={() => void load(draft)}>{loading ? "Đang tải..." : "Xem báo cáo"}</button></div></footer>
    </div></div>}
  </div>;
}
