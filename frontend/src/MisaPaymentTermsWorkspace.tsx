import { useEffect, useState } from "react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./cash-enhancements.css";

type Term = {
  id: string; code: string; name: string; version: number; status: string;
  due_mode: "DAYS" | "MONTHLY"; due_days: number; due_day_of_month: number | null;
  due_after_months: number; has_discount: boolean;
  discount_days: number | null; discount_rate: number | null;
};
type Draft = Omit<Term, "id" | "version" | "status"> & { id?: string; version?: number };
const emptyTerm = (): Draft => ({ code: "", name: "", due_mode: "DAYS", due_days: 0,
  due_day_of_month: null, due_after_months: 0, has_discount: false, discount_days: null, discount_rate: null });
const rows = (data: Term[] | { results: Term[] }) => Array.isArray(data) ? data : data.results;

export default function MisaPaymentTermsWorkspace({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const { token } = useApiSession();
  const base = `/api/v1/master-data/payment-terms/?company_id=${encodeURIComponent(companyId)}`;
  const [terms, setTerms] = useState<Term[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!token || !companyId) { setLoading(false); setError("Cần đăng nhập và chọn doanh nghiệp."); return; }
    let active = true;
    setLoading(true);
    request<Term[] | { results: Term[] }>(base, token)
      .then(data => { if (active) { setTerms(rows(data)); setError(""); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được điều khoản thanh toán."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base, token, revision]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") { if (draft) setDraft(null); else onClose(); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [draft, onClose]);

  const update = (patch: Partial<Draft>) => setDraft(current => current ? { ...current, ...patch } : current);
  async function save(addAnother: boolean) {
    if (!draft || busy) return;
    if (!draft.code.trim() || !draft.name.trim() || draft.due_days < 0 ||
      (draft.due_mode === "MONTHLY" && (!draft.due_day_of_month || draft.due_day_of_month < 1 || draft.due_day_of_month > 31)) ||
      draft.due_after_months < 0 ||
      (draft.has_discount && (draft.discount_days === null || draft.discount_days < 0 || draft.discount_rate === null || draft.discount_rate < 0 || draft.discount_rate > 100))) {
      setError("Nhập mã, tên và thời hạn hợp lệ. Ngày thanh toán từ 1–31, tỷ lệ chiết khấu từ 0–100%.");
      return;
    }
    setBusy(true); setError("");
    const payload = { company: companyId, code: draft.code.trim(), name: draft.name.trim(), scope: "BOTH",
      due_base: "DOCUMENT", due_mode: draft.due_mode, due_days: draft.due_mode === "DAYS" ? draft.due_days : 0,
      due_day_of_month: draft.due_mode === "MONTHLY" ? draft.due_day_of_month : null,
      due_after_months: draft.due_mode === "MONTHLY" ? draft.due_after_months : 0,
      has_discount: draft.has_discount, discount_days: draft.has_discount ? draft.discount_days : null,
      discount_rate: draft.has_discount ? draft.discount_rate : null,
      ...(draft.id ? { version: draft.version } : {}) };
    try {
      const path = draft.id
        ? `/api/v1/master-data/payment-terms/${draft.id}/?company_id=${encodeURIComponent(companyId)}`
        : base;
      await request(path, token, { method: draft.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setRevision(value => value + 1);
      setNotice("Đã lưu điều khoản thanh toán trên hệ thống.");
      setDraft(addAnother ? emptyTerm() : null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được điều khoản thanh toán."); }
    finally { setBusy(false); }
  }

  async function toggle(term: Term) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await request(`/api/v1/master-data/payment-terms/${term.id}/${term.status === "ACTIVE" ? "deactivate" : "activate"}/?company_id=${encodeURIComponent(companyId)}`, token,
        { method: "POST", body: JSON.stringify({ version: term.version, clear_default: true }) });
      setRevision(value => value + 1);
      setNotice("Đã cập nhật trạng thái điều khoản thanh toán.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được trạng thái."); }
    finally { setBusy(false); }
  }

  const visible = terms.filter(term => `${term.code} ${term.name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const shownPage = Math.min(page, pageCount);
  const shownTerms = visible.slice((shownPage - 1) * pageSize, shownPage * pageSize);
  const numeric = (label: string, field: "due_days" | "due_day_of_month" | "due_after_months" | "discount_days" | "discount_rate", suffix: string) =>
    <label>{label}<input aria-label={label} type="number" min={field === "due_day_of_month" ? 1 : 0}
      max={field === "due_day_of_month" ? 31 : field === "discount_rate" ? 100 : undefined}
      step={field === "discount_rate" ? 0.01 : 1} value={draft?.[field] ?? ""}
      onChange={event => update({ [field]: event.target.value === "" ? null : Number(event.target.value) })} />{suffix}</label>;

  return <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: "#fff", padding: 24, overflow: "auto" }} role="dialog" aria-modal="true" aria-label="Điều khoản thanh toán">
    <div className="ce-toolbar"><h2 style={{ flex: 1 }}>Điều khoản thanh toán</h2><button onClick={onClose}>Đóng danh mục</button></div>
    <div className="ce-toolbar"><input aria-label="Tìm điều khoản thanh toán" placeholder="Nhập từ khóa tìm kiếm" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
      <button onClick={() => { setDraft(emptyTerm()); setError(""); }}>Thêm</button></div>
    {loading && <p role="status">Đang tải điều khoản thanh toán...</p>}
    {error && <p role="alert" className="ce-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div style={{ overflow: "auto" }}><table className="misa-table" style={{ width: "100%" }}><thead><tr>
      {["Mã điều khoản", "Tên điều khoản", "Số ngày được nợ", "Thời hạn hưởng CK (Ngày)", "Tỉ lệ CK (%)", "Trạng thái", "Chức năng"].map(name => <th key={name}>{name}</th>)}
    </tr></thead><tbody>{shownTerms.map(term => <tr key={term.id}><td>{term.code}</td><td>{term.name}</td>
      <td>{term.due_mode === "MONTHLY" ? `Ngày ${term.due_day_of_month}, sau ${term.due_after_months} tháng` : term.due_days}</td>
      <td>{term.discount_days ?? ""}</td><td>{term.discount_rate ?? ""}</td><td>{term.status === "ACTIVE" ? "Đang sử dụng" : "Ngừng sử dụng"}</td>
      <td><button onClick={() => { setDraft({ ...term }); setError(""); }}>Sửa</button><button disabled={busy} onClick={() => void toggle(term)}>{term.status === "ACTIVE" ? "Ngừng sử dụng" : "Sử dụng"}</button></td>
    </tr>)}{!loading && !visible.length && <tr><td colSpan={7} style={{ textAlign: "center" }}>Không có dữ liệu</td></tr>}</tbody></table></div>
    <div className="ce-toolbar"><span>Tổng số: {visible.length}</span><label>Số dòng/trang <select aria-label="Số dòng điều khoản thanh toán" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[20, 50, 100].map(size => <option key={size}>{size}</option>)}</select></label>
      <button aria-label="Trang điều khoản trước" disabled={shownPage === 1} onClick={() => setPage(shownPage - 1)}>‹</button><span>{shownPage}/{pageCount}</span><button aria-label="Trang điều khoản sau" disabled={shownPage === pageCount} onClick={() => setPage(shownPage + 1)}>›</button></div>
    {draft && <div className="ce-overlay" onClick={() => setDraft(null)}><section className="ce-panel" role="dialog" aria-modal="true" aria-label="Thông tin điều khoản thanh toán" onClick={event => event.stopPropagation()}>
      <header><h2>{draft.id ? "Sửa" : "Thêm"} điều khoản thanh toán</h2><button aria-label="Đóng điều khoản" onClick={() => setDraft(null)}>×</button></header>
      <div className="ce-panel-body"><label>Mã *<input aria-label="Mã điều khoản" value={draft.code} onChange={event => update({ code: event.target.value })} /></label>
        <label>Tên *<input aria-label="Tên điều khoản" value={draft.name} onChange={event => update({ name: event.target.value })} /></label>
        <p>Cách tính hạn thanh toán</p>
        <label><input type="radio" style={{ display: "inline-block", width: "auto", marginTop: 0 }} name="term-mode" checked={draft.due_mode === "DAYS"} onChange={() => update({ due_mode: "DAYS" })} /> Số ngày được nợ</label>
        <label><input type="radio" style={{ display: "inline-block", width: "auto", marginTop: 0 }} name="term-mode" checked={draft.due_mode === "MONTHLY"} onChange={() => update({ due_mode: "MONTHLY" })} /> Cố định ngày thanh toán hàng tháng</label>
        {draft.due_mode === "DAYS" ? <>{numeric("Thanh toán sau", "due_days", "ngày kể từ ngày chứng từ.")}<p>Hạn thanh toán = Ngày chứng từ + Số ngày được nợ</p></> : <>{numeric("Thanh toán vào ngày", "due_day_of_month", "hàng tháng")}{numeric("Sau", "due_after_months", "tháng kể từ ngày chứng từ.")}</>}
        <h3>Chiết khấu</h3><label><input type="checkbox" checked={draft.has_discount} onChange={event => update({ has_discount: event.target.checked })} /> Có chiết khấu thanh toán sớm</label>
        {draft.has_discount && <>{numeric("Thời hạn hưởng chiết khấu", "discount_days", "ngày")}{numeric("Tỷ lệ chiết khấu", "discount_rate", "%")}</>}
      </div><footer><button onClick={() => setDraft(null)}>Hủy</button><button disabled={busy} onClick={() => void save(false)}>Cất</button><button className="ce-primary" disabled={busy} onClick={() => void save(true)}>Cất và Thêm</button></footer>
    </section></div>}
  </div>;
}
