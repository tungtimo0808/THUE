import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Scope = { company: { id: string; code: string; name: string }; all_branches_allowed: boolean; branches: { id: string; code: string; name: string }[] };

export default function LiveScope() {
  const { token, companyId, selectCompany } = useApiSession();
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [selected, setSelected] = useState("");
  const [branch, setBranch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setScopes([]); return; }
    let active = true;
    request<{ scopes: Scope[] }>("/api/v1/common/scopes/", token)
      .then(result => { if (active) { setScopes(result.scopes); setSelected(companyId || result.scopes[0]?.company.id || ""); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được phạm vi."); });
    return () => { active = false; };
  }, [token]);

  const scope = scopes.find(item => item.company.id === selected);

  async function switchScope(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!scope) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await request("/api/v1/common/scopes/switch/", token, {
        method: "POST",
        body: JSON.stringify({ company: selected, ...(branch ? { branch } : {}), all_branches: !branch && scope.all_branches_allowed }),
      });
      selectCompany(selected);
      setMessage("Đã chuyển phạm vi làm việc.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không chuyển được phạm vi."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card">
    <Link to="/login">← Phiên làm việc</Link>
    <p className="account-eyebrow">COM-08</p>
    <h1>Phạm vi làm việc</h1>
    {!token ? <p>Bạn cần <Link to="/login">đăng nhập</Link>.</p> : <>
      {error && <p className="account-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      {!scopes.length ? <p>Chưa có doanh nghiệp đang hoạt động để chọn.</p> : <form onSubmit={switchScope}>
        <label>Doanh nghiệp<select value={selected} onChange={event => { setSelected(event.target.value); setBranch(""); }}>
          {scopes.map(item => <option key={item.company.id} value={item.company.id}>{item.company.name}</option>)}
        </select></label>
        {scope && <label>Chi nhánh<select value={branch} onChange={event => setBranch(event.target.value)}>
          {scope.all_branches_allowed && <option value="">Tất cả chi nhánh</option>}
          {!scope.all_branches_allowed && <option value="">Chọn chi nhánh</option>}
          {scope.branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>}
        <button type="submit" disabled={busy || (!branch && !scope?.all_branches_allowed && Boolean(scope?.branches.length))}>Chuyển phạm vi</button>
      </form>}
    </>}
  </section></main>;
}
