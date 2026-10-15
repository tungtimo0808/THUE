import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Unit = { id: string; parent: string | null; unit_type: string; code: string; name: string; short_name: string; description: string; start_date: string; end_date: string | null; status: string; version: string; pending_parent: string | null };
type History = { id: string; action: string; effective_from: string; occurred_at: string };
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

export default function LiveOrgStructure() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [units, setUnits] = useState<Unit[]>([]);
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState<"create" | "edit" | "move" | "deactivate" | "reactivate" | "history" | null>(null);
  const [target, setTarget] = useState<Unit | null>(null);
  const [unitType, setUnitType] = useState("DEPARTMENT");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState("");
  const [date, setDate] = useState(today);
  const [confirmImpact, setConfirmImpact] = useState(false);
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !companyId) { setUnits([]); return; }
    let active = true;
    request<{ results: Unit[] }>(`/api/v1/organization/structure/units/?company_id=${encodeURIComponent(companyId)}`, token)
      .then(value => { if (active) setUnits(value.results); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được cơ cấu tổ chức."); });
    return () => { active = false; };
  }, [token, companyId, reload]);

  const root = units.find(unit => unit.unit_type === "COMPANY");
  const ordered = [...units].sort((a, b) => Number(a.unit_type !== "COMPANY") - Number(b.unit_type !== "COMPANY") || a.code.localeCompare(b.code));

  function open(nextMode: typeof mode, unit: Unit | null = null) {
    setMode(nextMode); setTarget(unit); setError(""); setMessage("");
    setUnitType(unit?.unit_type || "DEPARTMENT"); setCode(unit?.code || ""); setName(unit?.name || "");
    setShortName(unit?.short_name || ""); setDescription(unit?.description || "");
    setParent(unit?.parent || root?.id || ""); setDate(today()); setConfirmImpact(false); setHistory([]);
    if (nextMode === "history" && unit) {
      request<{ results: History[] }>(`/api/v1/organization/structure/units/${unit.id}/history/?company_id=${encodeURIComponent(companyId)}`, token)
        .then(value => setHistory(value.results))
        .catch(cause => setError(cause instanceof Error ? cause.message : "Không tải được lịch sử."));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!mode) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const base = `/api/v1/organization/structure/units/${target ? `${target.id}/` : ""}?company_id=${encodeURIComponent(companyId)}`;
      if (mode === "create") {
        await request(base, token, { method: "POST", body: JSON.stringify({ unit_type: unitType, code: code.trim(), name: name.trim(), short_name: shortName.trim(), description: description.trim(), parent, start_date: date }) });
      } else if (mode === "edit" && target) {
        await request(base, token, { method: "PATCH", body: JSON.stringify({ version: target.version, code: code.trim(), name: name.trim(), short_name: shortName.trim(), description: description.trim() }) });
      } else if (mode === "move" && target) {
        await request(`/api/v1/organization/structure/units/${target.id}/move/?company_id=${encodeURIComponent(companyId)}`, token, {
          method: "POST", body: JSON.stringify({ version: target.version, parent, effective_from: date, confirm_impact: confirmImpact }),
        });
      } else if (mode === "deactivate" && target) {
        await request(`/api/v1/organization/structure/units/${target.id}/deactivate/?company_id=${encodeURIComponent(companyId)}`, token, {
          method: "POST", body: JSON.stringify({ version: target.version, end_date: date, confirm: confirmImpact }),
        });
      } else if (mode === "reactivate" && target) {
        await request(`/api/v1/organization/structure/units/${target.id}/reactivate/?company_id=${encodeURIComponent(companyId)}`, token, {
          method: "POST", body: JSON.stringify({ version: target.version, start_date: date }),
        });
      }
      setMode(null); setTarget(null); setMessage("Đã cập nhật cơ cấu tổ chức."); setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được đơn vị."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card account-wide">
    <Link to="/login">← Phiên làm việc</Link>
    <p className="account-eyebrow">SYS-03</p>
    <h1>Cơ cấu tổ chức</h1>
    {!token ? <p>Bạn cần <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp. <Link to="/company-setup">Khởi tạo doanh nghiệp</Link>.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); setMode(null); }}>
        {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select></label>
      {error && <p className="account-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      <div className="account-actions"><button type="button" onClick={() => open("create")}>Thêm đơn vị</button><button type="button" onClick={() => setReload(value => value + 1)}>Tải lại</button></div>
      {!units.length ? <p>Chưa có đơn vị hoặc không có quyền xem.</p> : <ul className="account-request-list">{ordered.map(unit => <li key={unit.id}>
        <div><strong>{unit.code} · {unit.name}</strong><span>{unit.unit_type} · {unit.status} · {unit.parent ? `Thuộc ${units.find(item => item.id === unit.parent)?.name || "đơn vị khác"}` : "Gốc"}</span></div>
        <div className="account-actions"><button type="button" onClick={() => open("history", unit)}>Lịch sử</button>
          {unit.unit_type !== "COMPANY" && <><button type="button" onClick={() => open("edit", unit)}>Sửa</button>
            {unit.status === "ACTIVE" ? <><button type="button" onClick={() => open("move", unit)}>Di chuyển</button>
              <button type="button" onClick={() => open("deactivate", unit)}>Ngừng</button></> :
              <button type="button" onClick={() => open("reactivate", unit)}>Kích hoạt lại</button>}</>}</div>
      </li>)}</ul>}
      {mode === "history" && <section className="account-change-email"><h2>Lịch sử {target?.code}</h2>
        {!history.length ? <p>Chưa có lịch sử.</p> : <ul>{history.map(item => <li key={item.id}>{item.action} · {item.effective_from} · {new Date(item.occurred_at).toLocaleString("vi-VN")}</li>)}</ul>}
        <button type="button" onClick={() => setMode(null)}>Đóng</button>
      </section>}
      {mode && mode !== "history" && <form className="account-change-email" onSubmit={submit}>
        <h2>{mode === "create" ? "Thêm đơn vị" : `${mode === "edit" ? "Sửa" : mode === "move" ? "Di chuyển" : mode === "deactivate" ? "Ngừng" : "Kích hoạt lại"} ${target?.code || ""}`}</h2>
        {(mode === "create" || mode === "edit") && <>
          {mode === "create" && <label>Loại đơn vị<select value={unitType} onChange={event => setUnitType(event.target.value)}><option value="BRANCH">Chi nhánh</option><option value="DEPARTMENT">Phòng ban</option><option value="OTHER">Khác</option></select></label>}
          <label>Mã đơn vị<input value={code} onChange={event => setCode(event.target.value)} required /></label>
          <label>Tên đơn vị<input value={name} onChange={event => setName(event.target.value)} required /></label>
          <label>Tên viết tắt<input value={shortName} onChange={event => setShortName(event.target.value)} /></label>
          <label>Mô tả<textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} /></label>
        </>}
        {(mode === "create" || mode === "move") && <label>Đơn vị cấp trên<select value={parent} onChange={event => setParent(event.target.value)} required>
          {units.filter(unit => unit.status === "ACTIVE" && unit.id !== target?.id).map(unit => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
        </select></label>}
        {mode !== "edit" && <label>Ngày hiệu lực<input type="date" value={date} min={mode === "create" ? undefined : today()} onChange={event => setDate(event.target.value)} required /></label>}
        {(mode === "move" || mode === "deactivate") && <label className="account-check"><input type="checkbox" checked={confirmImpact} onChange={event => setConfirmImpact(event.target.checked)} /> Xác nhận ảnh hưởng và thực hiện</label>}
        <div className="account-actions"><button type="submit" disabled={busy || (mode === "deactivate" && !confirmImpact)}>Lưu đơn vị</button><button type="button" onClick={() => setMode(null)}>Hủy</button></div>
      </form>}
    </>}
  </section></main>;
}
