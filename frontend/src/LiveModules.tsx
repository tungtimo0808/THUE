import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Impact = { historical_records_count: number; pending_tasks_count: number; active_dependent_modules: { code: string; name: string }[]; can_disable: boolean };
type Module = { code: string; name: string; category: string; description: string; dependencies: string[] | { code: string; name: string; is_satisfied: boolean }[]; status: string; effective_from: string | null; effective_to: string | null; configuration: Record<string, unknown>; reason: string; notes: string; version: number; impact?: Impact };
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

export default function LiveModules() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [modules, setModules] = useState<Module[]>([]);
  const [selected, setSelected] = useState<Module | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [mode, setMode] = useState<"enable" | "disable" | "config" | null>(null);
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [config, setConfig] = useState("{}");
  const [force, setForce] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !companyId) { setModules([]); return; }
    let active = true;
    request<Module[]>(`/api/v1/common/modules/?company_id=${companyId}`, token)
      .then(value => { if (active) { setModules(value); setSelected(current => value.find(item => item.code === current?.code) || null); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được phân hệ."); });
    return () => { active = false; };
  }, [token, companyId, reload]);

  async function choose(item: Module, clearMessage = true) {
    setBusy(true); setError(""); if (clearMessage) setMessage(""); setMode(null);
    try {
      const detail = await request<Module>(`/api/v1/common/modules/${item.code}/?company_id=${companyId}`, token);
      setSelected(detail); setConfig(JSON.stringify(detail.configuration || {}, null, 2)); setNotes(detail.notes || ""); setDate(today()); setReason(""); setForce(false);
      setImpact(await request<Impact>(`/api/v1/common/modules/${item.code}/impact/?company_id=${companyId}`, token));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được chi tiết phân hệ."); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !mode) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const configuration = JSON.parse(config);
      if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) throw new Error("Cấu hình phải là JSON object.");
      const base = `/api/v1/common/modules/${selected.code}`;
      const options = mode === "enable" ? { method: "POST", path: "enable", body: { company: companyId, effective_from: date, configuration, notes, version: selected.version } } :
        mode === "disable" ? { method: "POST", path: "disable", body: { company: companyId, reason: reason.trim(), effective_to: date, notes, force, version: selected.version } } :
          { method: "PATCH", path: "config", body: { company: companyId, configuration, notes, version: selected.version } };
      await request(`${base}/${options.path}/?company_id=${companyId}`, token, { method: options.method, body: JSON.stringify(options.body) });
      setMode(null); setReload(value => value + 1);
      await choose(selected, false);
      setMessage("Đã cập nhật phân hệ.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được phân hệ."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card account-wide"><Link to="/login">← Phiên làm việc</Link><p className="account-eyebrow">SYS-12</p><h1>Cấu hình phân hệ sử dụng</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); setSelected(null); }}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      <ul className="account-request-list">{modules.map(item => <li key={item.code}><div><strong>{item.code} · {item.name}</strong><span>{item.category} · {item.status}</span><span>{item.description}</span></div><button type="button" onClick={() => choose(item)}>Chi tiết</button></li>)}</ul>
      {selected && <section className="account-change-email"><h2>{selected.code} · {selected.name}</h2><p>Trạng thái: {selected.status}. Hiệu lực: {selected.effective_from || "Chưa bắt đầu"}{selected.effective_to ? ` → ${selected.effective_to}` : ""}</p><p>Phụ thuộc: {(selected.dependencies || []).map(item => typeof item === "string" ? item : `${item.code} (${item.is_satisfied ? "đã bật" : "chưa bật"})`).join(", ") || "Không có"}</p>{impact && <p>{impact.historical_records_count} chứng từ cũ, {impact.pending_tasks_count} việc đang xử lý, {impact.active_dependent_modules.length} phân hệ phụ thuộc đang bật.</p>}
        <div className="account-actions"><button type="button" onClick={() => setMode("config")}>Sửa cấu hình</button>{selected.status === "ENABLED" ? <button type="button" onClick={() => setMode("disable")}>Ngừng sử dụng</button> : <button type="button" onClick={() => setMode("enable")}>Kích hoạt</button>}</div>
      </section>}
      {selected && mode && <form className="account-change-email" onSubmit={save}><h2>{mode === "enable" ? "Kích hoạt" : mode === "disable" ? "Ngừng sử dụng" : "Sửa cấu hình"} {selected.name}</h2>{mode !== "config" && <label>Ngày hiệu lực<input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label>}{mode === "disable" && <><label>Lý do<input value={reason} onChange={event => setReason(event.target.value)} required /></label><label className="account-check"><input type="checkbox" checked={force} onChange={event => setForce(event.target.checked)} /> Xác nhận xử lý tác động</label></>}{mode !== "disable" && <label>Cấu hình (JSON)<textarea value={config} onChange={event => setConfig(event.target.value)} rows={8} required /></label>}<label>Ghi chú<textarea value={notes} onChange={event => setNotes(event.target.value)} /></label><div className="account-actions"><button type="submit" disabled={busy}>Xác nhận</button><button type="button" onClick={() => setMode(null)}>Hủy</button></div></form>}
    </>}
  </section></main>;
}
