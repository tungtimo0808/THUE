import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Scope = { id: string; code: string; name: string; allow_all_company_data: boolean; allow_owned_records: boolean; status: string };
type Catalog = { id: string; code?: string; name?: string };
type ScopeLink = { id: string; data_scope_set: string; include_descendants?: boolean; branch?: string; department?: string; warehouse?: string; company_bank_account?: string; project?: string; cost_center?: string };
type Kind = "branch" | "department" | "warehouse" | "bank_account" | "project" | "cost_center";
const kinds: { key: Kind; label: string; endpoint: string; catalog: string; field: string }[] = [
  { key: "branch", label: "Chi nhánh", endpoint: "data-scope-branches", catalog: "/api/v1/organization/branches/", field: "branch" },
  { key: "department", label: "Phòng ban", endpoint: "data-scope-departments", catalog: "/api/v1/organization/departments/", field: "department" },
  { key: "warehouse", label: "Kho", endpoint: "data-scope-warehouses", catalog: "/api/v1/master-data/warehouses/", field: "warehouse" },
  { key: "bank_account", label: "Tài khoản ngân hàng", endpoint: "data-scope-bank-accounts", catalog: "/api/v1/master-data/company-bank-accounts/", field: "company_bank_account" },
  { key: "project", label: "Dự án", endpoint: "data-scope-projects", catalog: "/api/v1/master-data/projects/", field: "project" },
  { key: "cost_center", label: "Trung tâm chi phí", endpoint: "data-scope-cost-centers", catalog: "/api/v1/master-data/cost-centers/", field: "cost_center" },
];
const rows = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;

export default function LiveDataScopes() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [selected, setSelected] = useState<Scope | null>(null);
  const [catalogs, setCatalogs] = useState<Record<Kind, Catalog[]>>({ branch: [], department: [], warehouse: [], bank_account: [], project: [], cost_center: [] });
  const [links, setLinks] = useState<Record<Kind, ScopeLink[]>>({ branch: [], department: [], warehouse: [], bank_account: [], project: [], cost_center: [] });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [allCompany, setAllCompany] = useState(false);
  const [owned, setOwned] = useState(false);
  const [status, setStatus] = useState("ACTIVE");
  const [kind, setKind] = useState<Kind>("branch");
  const [targetId, setTargetId] = useState("");
  const [descendants, setDescendants] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !companyId) { setScopes([]); return; }
    let active = true;
    request<Scope[] | { results: Scope[] }>(`/api/v1/iam/data-scopes/?company_id=${companyId}`, token)
      .then(value => { if (active) { const next = rows(value); setScopes(next); setSelected(current => next.find(item => item.id === current?.id) || null); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được Data Scope."); });
    return () => { active = false; };
  }, [token, companyId, reload]);

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    Promise.allSettled(kinds.map(async item => rows(await request<Catalog[] | { results: Catalog[] }>(`${item.catalog}?company_id=${companyId}`, token))))
      .then(results => { if (!active) return; const next = { ...catalogs }; results.forEach((result, index) => { if (result.status === "fulfilled") next[kinds[index].key] = result.value; }); setCatalogs(next); });
    return () => { active = false; };
  }, [token, companyId]);

  useEffect(() => {
    if (!token || !selected) return;
    let active = true;
    Promise.allSettled(kinds.map(async item => rows(await request<ScopeLink[] | { results: ScopeLink[] }>(`/api/v1/iam/${item.endpoint}/?company_id=${companyId}&data_scope_set_id=${selected.id}`, token))))
      .then(results => { if (!active) return; const next = { ...links }; results.forEach((result, index) => { if (result.status === "fulfilled") next[kinds[index].key] = result.value; }); setLinks(next); });
    return () => { active = false; };
  }, [token, companyId, selected?.id, reload]);

  function choose(scope: Scope | null) {
    setSelected(scope); setCode(scope?.code || ""); setName(scope?.name || ""); setAllCompany(scope?.allow_all_company_data || false); setOwned(scope?.allow_owned_records || false); setStatus(scope?.status || "ACTIVE"); setError(""); setMessage("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const value = await request<Scope>(`/api/v1/iam/data-scopes/${selected ? `${selected.id}/` : ""}?company_id=${companyId}`, token, { method: selected ? "PATCH" : "POST", body: JSON.stringify({ ...(!selected ? { company: companyId } : {}), code: code.trim(), name: name.trim(), allow_all_company_data: allCompany, allow_owned_records: owned, status }) });
      choose(value); setMessage("Đã lưu Data Scope."); setReload(current => current + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được Data Scope."); }
    finally { setBusy(false); }
  }
  async function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !targetId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const item = kinds.find(entry => entry.key === kind)!;
      await request(`/api/v1/iam/${item.endpoint}/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ data_scope_set: selected.id, [item.field]: targetId, ...((kind === "branch" || kind === "department") ? { include_descendants: descendants } : {}) }) });
      setTargetId(""); setMessage(`Đã thêm ${item.label.toLowerCase()} vào phạm vi.`); setReload(current => current + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thêm được phạm vi."); }
    finally { setBusy(false); }
  }
  const currentKind = kinds.find(item => item.key === kind)!;

  return <main className="account-page"><section className="account-card account-wide"><Link to="/login">← Phiên làm việc</Link><p className="account-eyebrow">SYS-08</p><h1>Thiết lập Data Scope</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); choose(null); }}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      <div className="account-actions"><button type="button" onClick={() => choose(null)}>Tạo phạm vi</button><button type="button" onClick={() => setReload(current => current + 1)}>Tải lại</button></div>
      <ul className="account-request-list">{scopes.map(scope => <li key={scope.id}><div><strong>{scope.code} · {scope.name}</strong><span>{scope.status} · {scope.allow_all_company_data ? "Toàn doanh nghiệp" : "Giới hạn theo danh mục"}</span></div><button type="button" onClick={() => choose(scope)}>Chỉnh phạm vi</button></li>)}</ul>
      <form className="account-change-email" onSubmit={save}><h2>{selected ? `Chỉnh ${selected.code}` : "Tạo Data Scope"}</h2><label>Mã phạm vi<input value={code} onChange={event => setCode(event.target.value)} required maxLength={80} /></label><label>Tên phạm vi<input value={name} onChange={event => setName(event.target.value)} required maxLength={255} /></label><label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Ngừng</option></select></label><label className="account-check"><input type="checkbox" checked={allCompany} onChange={event => setAllCompany(event.target.checked)} /> Cho phép toàn bộ dữ liệu doanh nghiệp</label><label className="account-check"><input type="checkbox" checked={owned} onChange={event => setOwned(event.target.checked)} /> Cho phép bản ghi của chính mình</label><button type="submit" disabled={busy}>Lưu Data Scope</button></form>
      {selected && <><section className="account-change-email"><h2>Phạm vi đã chọn</h2>{kinds.map(item => <div key={item.key}><strong>{item.label}</strong><ul>{links[item.key].map(link => <li key={link.id}>{catalogs[item.key].find(target => target.id === link[item.field as keyof ScopeLink])?.name || String(link[item.field as keyof ScopeLink])}{link.include_descendants ? " (gồm cấp dưới)" : ""}</li>)}</ul></div>)}</section>
        <form className="account-change-email" onSubmit={addLink}><h2>Thêm đối tượng vào phạm vi</h2><label>Loại đối tượng<select value={kind} onChange={event => { setKind(event.target.value as Kind); setTargetId(""); setDescendants(false); }}>{kinds.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label>{currentKind.label}<select value={targetId} onChange={event => setTargetId(event.target.value)} required><option value="">Chọn đối tượng</option>{catalogs[kind].map(item => <option key={item.id} value={item.id}>{item.code || item.id} · {item.name || ""}</option>)}</select></label>{(kind === "branch" || kind === "department") && <label className="account-check"><input type="checkbox" checked={descendants} onChange={event => setDescendants(event.target.checked)} /> Gồm đơn vị cấp dưới</label>}<button type="submit" disabled={busy || !targetId}>Thêm vào phạm vi</button></form>
      </>}
    </>}
  </section></main>;
}
