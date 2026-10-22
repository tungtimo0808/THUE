import { useEffect, useState } from "react";
import { ChevronLeft, Download, RefreshCw, X } from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { errorText } from "./misa-api-writes";
import "./misa-inventory-summary.css";

type Option = { id: string; code: string; name: string };
type Params = { from: string; to: string; period: "month" | "custom"; warehouses: string[]; category: string };
type Row = { item_id: string; item_code: string; item_name: string; uom: string; warehouse_count: number;
  opening_quantity: string; opening_value: string | null; receipt_quantity: string; receipt_value: string | null;
  issue_quantity: string; issue_value: string | null; closing_quantity: string; closing_value: string | null;
  valuation_incomplete: boolean };
type Report = { date_from: string; date_to: string; warehouse_ids: string[]; currency: string; rows: Row[];
  totals: Record<string, string | null> };
type Detail = { item_code: string; item_name: string; uom: string;
  opening: Record<string, { quantity: string; value: string | null }>;
  movements: { movement_id: string; date: string; transaction_number: string; warehouse_id: string;
    warehouse_name: string; quantity_delta: string; value_delta: string | null;
    balance_quantity: string; balance_value: string | null }[] };

function monthDates(period = "") {
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split("-").map(Number);
    if (month >= 1 && month <= 12) {
      const end = new Date(year, month, 0).getDate();
      return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: `${year}-${String(month).padStart(2, "0")}-${String(end).padStart(2, "0")}` };
    }
  }
  if (/^\d{4}$/.test(period)) return { from: `${period}-01-01`, to: `${period}-12-31` };
  const now = new Date();
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === Number(value.slice(0, 4))
    && date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
}
const number = (value: string | number | null) => value == null ? "Chưa hoàn tất tính giá"
  : Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
const columns = [
  ["item_code", "Mã hàng"], ["item_name", "Tên vật tư, hàng hóa"], ["uom", "ĐVT"],
  ["opening_quantity", "Tồn đầu kỳ"], ["receipt_quantity", "Nhập trong kỳ"],
  ["issue_quantity", "Xuất trong kỳ"], ["closing_quantity", "Tồn cuối kỳ"],
  ["closing_value", "Giá trị cuối kỳ"],
] as const;

export default function MisaInventoryMultiWarehouseReport({ onBack, embedded = false, initialPeriod }: {
  onBack: () => void; embedded?: boolean; initialPeriod?: string;
}) {
  const { token, companyId } = useApiSession();
  const workingPeriod = initialPeriod || new URLSearchParams(window.location.search).get("period") || "";
  const [options, setOptions] = useState<{ warehouses: Option[]; categories: Option[] }>({ warehouses: [], categories: [] });
  const [draft, setDraft] = useState<Params>({ ...monthDates(workingPeriod), period: "month", warehouses: [], category: "" });
  const [applied, setApplied] = useState<Params | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [parameterOpen, setParameterOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const query = (params: Params) => {
    const search = new URLSearchParams({ company_id: companyId || "", date_from: params.from,
      date_to: params.to, warehouse_ids: params.warehouses.join(",") });
    if (params.category) search.set("category_id", params.category);
    return search;
  };
  async function load(params: Params) {
    if (!token || !companyId) { setError("Không xác định được doanh nghiệp. Vui lòng đăng nhập lại."); return; }
    if (!validDate(params.from) || !validDate(params.to) || params.from > params.to) {
      setError("Từ ngày và Đến ngày không hợp lệ."); return;
    }
    if (!params.warehouses.length) { setError("Chọn ít nhất một kho được phép xem."); return; }
    setLoading(true); setError("");
    try {
      const data = await request<Report>(`/api/v1/inventory/balances/multi-warehouse-summary/?${query(params)}`, token);
      setReport(data); setApplied(structuredClone(params)); setDraft(structuredClone(params));
      setDetail(null); setParameterOpen(false);
    } catch (reason) { setError(`Không thể tải báo cáo nhập xuất tồn: ${errorText(reason)}`); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    request<{ warehouses: Option[]; categories: Option[] }>(`/api/v1/inventory/balances/summary-options/?company_id=${companyId}`, token)
      .then((data) => {
        if (!active) return;
        setOptions(data);
        if (!data.warehouses.length) { setError("Bạn chưa được cấp quyền xem dữ liệu của kho nào."); return; }
        const params: Params = { ...monthDates(workingPeriod), period: "month", warehouses: data.warehouses.map((row) => row.id), category: "" };
        setDraft(params);
        void load(params);
      })
      .catch((reason) => { if (active) setError(`Không thể tải danh sách kho: ${errorText(reason)}`); });
    return () => { active = false; };
  }, [token, companyId]);

  async function openDetail(row: Row) {
    if (!token || !applied) return;
    setError("");
    try {
      const search = query(applied); search.set("item_id", row.item_id);
      setDetail(await request<Detail>(`/api/v1/inventory/balances/movement-detail/?${search}`, token));
    } catch (reason) { setError(`Không thể tải sổ chi tiết: ${errorText(reason)}`); }
  }
  async function exportExcel() {
    if (!report || !applied || exporting) return;
    setExporting(true); setError("");
    try {
      const XLSX = await import("xlsx");
      const warehouses = applied.warehouses.map((id) => options.warehouses.find((item) => item.id === id)?.name || "").filter(Boolean).join(", ");
      const sheet = XLSX.utils.aoa_to_sheet([
        ["TỔNG HỢP NHẬP XUẤT TỒN TRÊN NHIỀU KHO"],
        [`Kỳ báo cáo: ${applied.from} đến ${applied.to}`],
        [`Kho áp dụng: ${warehouses}`],
        [`Đơn vị tiền tệ: ${report.currency}`],
        columns.map(([, label]) => label),
        ...report.rows.map((row) => columns.map(([key]) => {
          const value = row[key];
          return value == null ? "Chưa hoàn tất tính giá" : key.endsWith("quantity") || key.endsWith("value") ? Number(value) : value;
        })),
        ["Tổng cộng", "", "", "", "", "", "", report.totals.closing_value == null ? "Chưa hoàn tất tính giá" : Number(report.totals.closing_value)],
      ]);
      sheet["!cols"] = [{ wch: 18 }, { wch: 38 }, { wch: 10 }, ...Array.from({ length: 5 }, () => ({ wch: 20 }))];
      const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Nhap-xuat-ton");
      XLSX.writeFileXLSX(book, `tong-hop-nhap-xuat-ton-${applied.from}-${applied.to}.xlsx`);
    } catch { setError("Xuất báo cáo Excel thất bại. Vui lòng thử lại."); }
    finally { setExporting(false); }
  }
  const sameUom = Boolean(report?.rows.length) && report!.rows.every((row) => row.uom === report!.rows[0].uom);
  const totalQuantity = (key: "opening_quantity" | "receipt_quantity" | "issue_quantity" | "closing_quantity") =>
    sameUom ? number(report!.rows.reduce((sum, row) => sum + Number(row[key]), 0)) : "—";
  const warehouseNames = applied?.warehouses.map((id) => options.warehouses.find((row) => row.id === id)?.name || "").filter(Boolean).join(", ") || "";

  return <div className={`inventory-summary-report${embedded ? " embedded" : ""}`}>
    <header className="inventory-summary-header"><div><button type="button" aria-label="Đóng báo cáo" onClick={onBack}><ChevronLeft size={18} /></button><h2>Tổng hợp nhập xuất tồn trên nhiều kho</h2></div>
      <div><button type="button" onClick={() => { setError(""); setParameterOpen(true); }}>Chọn tham số</button><button type="button" disabled={!applied || loading} onClick={() => applied && void load(applied)}><RefreshCw size={15} /> Nạp lại</button></div></header>
    {report && applied && <div className="inventory-summary-meta">Kỳ báo cáo: {applied.from.split("-").reverse().join("/")} – {applied.to.split("-").reverse().join("/")} · Kho áp dụng: {warehouseNames} · Đơn vị tiền tệ: {report.currency}</div>}
    {error && <div className="inventory-summary-error" role="alert">{error}</div>}
    <div className="inventory-summary-content">{loading && !report ? <div className="inventory-summary-empty">Đang tải báo cáo...</div>
      : !report ? <div className="inventory-summary-empty">Chọn tham số để xem báo cáo nhập xuất tồn.</div>
      : !report.rows.length ? <div className="inventory-summary-empty">Không có dữ liệu nhập, xuất, tồn phù hợp với kỳ báo cáo.</div>
      : <table><thead><tr>{columns.map(([key, label]) => <th key={key} className={key !== "item_code" && key !== "item_name" && key !== "uom" ? "number" : ""}>{label}</th>)}</tr></thead>
        <tbody>{report.rows.map((row) => <tr key={row.item_id}>{columns.map(([key]) => <td key={key} className={`${key !== "item_code" && key !== "item_name" && key !== "uom" ? "number" : ""}${row[key] == null ? " incomplete" : ""}${key === "closing_quantity" && Number(row.closing_quantity) < 0 ? " negative" : ""}`}>
          {key === "item_code" ? <button className="inventory-summary-link" type="button" onClick={() => void openDetail(row)} title="Xem sổ chi tiết vật tư hàng hóa">{row.item_code}</button>
            : key === "item_name" || key === "uom" ? row[key] : number(row[key] as string | null)}</td>)}</tr>)}</tbody>
        <tfoot><tr>{columns.map(([key], index) => <td key={key} className={index > 2 ? "number" : ""}>{index === 0 ? "Tổng cộng" : key === "closing_value" ? number(report.totals.closing_value) : key.endsWith("quantity") ? totalQuantity(key as "opening_quantity" | "receipt_quantity" | "issue_quantity" | "closing_quantity") : ""}</td>)}</tr></tfoot></table>}</div>
    {report && !sameUom && report.rows.length > 0 && <div className="inventory-summary-note">Không cộng số lượng của các mặt hàng khác đơn vị tính.</div>}
    <footer className="inventory-summary-footer"><button type="button" disabled={!report || exporting} onClick={() => void exportExcel()}><Download size={15} /> {exporting ? "Đang xuất..." : "Xuất Excel"}</button><button type="button" className="primary" onClick={onBack}>Đóng</button></footer>
    {detail && <div className="inventory-summary-overlay"><div className="inventory-summary-dialog inventory-summary-detail" role="dialog" aria-label="Sổ chi tiết vật tư hàng hóa">
      <header><strong>Sổ chi tiết vật tư hàng hóa · {detail.item_code} · {detail.item_name}</strong><button type="button" aria-label="Đóng sổ chi tiết" onClick={() => setDetail(null)}><X size={18} /></button></header>
      <div className="inventory-summary-content"><table><thead><tr>{["Ngày hạch toán", "Số chứng từ", "Kho", "Nhập", "Xuất", "Giá trị biến động", "Tồn sau phát sinh"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{detail.movements.map((movement) => <tr key={movement.movement_id}><td>{movement.date.split("-").reverse().join("/")}</td><td>{movement.transaction_number}</td><td>{movement.warehouse_name}</td><td className="number">{Number(movement.quantity_delta) > 0 ? number(movement.quantity_delta) : ""}</td><td className="number">{Number(movement.quantity_delta) < 0 ? number(-Number(movement.quantity_delta)) : ""}</td><td className="number">{number(movement.value_delta)}</td><td className="number">{number(movement.balance_quantity)} {detail.uom}</td></tr>)}</tbody></table>
        {!detail.movements.length && <div className="inventory-summary-empty">Không có phát sinh trong kỳ; xem tồn đầu kỳ theo từng kho bên dưới.</div>}
        <div className="inventory-summary-note">Tồn đầu kỳ: {Object.entries(detail.opening).map(([id, value]) => `${options.warehouses.find((row) => row.id === id)?.name || id}: ${number(value.quantity)} ${detail.uom}`).join(" · ") || "0"}</div></div>
      <footer><button type="button" className="primary" onClick={() => setDetail(null)}>Đóng</button></footer>
    </div></div>}
    {parameterOpen && <div className="inventory-summary-overlay"><div className="inventory-summary-dialog" role="dialog" aria-label="Chọn tham số nhập xuất tồn">
      <header><strong>Chọn tham số · Nhập xuất tồn trên nhiều kho</strong><button type="button" aria-label="Đóng bảng tham số" onClick={() => setParameterOpen(false)}><X size={18} /></button></header>
      <div className="inventory-summary-form"><label>Kỳ báo cáo<select value={draft.period} onChange={(event) => setDraft((old) => ({ ...old, period: event.target.value as Params["period"], ...(event.target.value === "month" ? monthDates(workingPeriod) : {}) }))}><option value="month">Kỳ đang làm việc</option><option value="custom">Tùy chọn</option></select></label>
        <label>Từ ngày<input type="date" value={draft.from} onChange={(event) => setDraft((old) => ({ ...old, period: "custom", from: event.target.value }))} /></label>
        <label>Đến ngày<input type="date" value={draft.to} onChange={(event) => setDraft((old) => ({ ...old, period: "custom", to: event.target.value }))} /></label>
        <label>Đơn vị tính<select value="base" disabled><option value="base">Đơn vị tính chính</option></select></label>
        <label>Nhóm VTHH<select value={draft.category} onChange={(event) => setDraft((old) => ({ ...old, category: event.target.value }))}><option value="">Tất cả nhóm</option>{options.categories.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
        <fieldset><legend>Kho</legend><label><input type="checkbox" checked={options.warehouses.length > 0 && draft.warehouses.length === options.warehouses.length} onChange={(event) => setDraft((old) => ({ ...old, warehouses: event.target.checked ? options.warehouses.map((row) => row.id) : [] }))} />Chọn tất cả kho</label>
          <div>{options.warehouses.map((row) => <label key={row.id}><input type="checkbox" checked={draft.warehouses.includes(row.id)} onChange={(event) => setDraft((old) => ({ ...old, warehouses: event.target.checked ? [...old.warehouses, row.id] : old.warehouses.filter((id) => id !== row.id) }))} />{row.code} · {row.name}</label>)}</div></fieldset></div>
      <footer><button type="button" onClick={() => setParameterOpen(false)}>Hủy</button><button type="button" className="primary" disabled={loading} onClick={() => void load(draft)}>{loading ? "Đang tải..." : "Xem báo cáo"}</button></footer>
    </div></div>}
  </div>;
}
