import { useEffect, useState, type FormEvent } from "react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Chart = { id: string; code: string; name: string; accounting_regime: string; is_default: boolean; status: string };
type Account = { id: string; chart_of_accounts: string; parent: string | null; code: string; name: string; name_en: string; account_level: number; account_type: string; normal_balance: string; dimension_requirements: Record<string, string>; is_foreign_currency: boolean; is_postable: boolean; is_system: boolean; status: string; version: number };
type Mode = "create" | "edit" | "transfer" | null;
const root = "/api/v1/general-ledger/accounts/";
const list = <T,>(value: T[] | { results: T[] }) => Array.isArray(value) ? value : value.results;
const natures = [["ASSET", "Tài sản"], ["LIABILITY", "Nợ phải trả"], ["EQUITY", "Vốn chủ"], ["REVENUE", "Doanh thu"], ["EXPENSE", "Chi phí"], ["OTHER_INCOME", "Thu nhập khác"], ["OTHER_EXPENSE", "Chi phí khác"], ["OFF_BALANCE", "Ngoài bảng"]];
const balances = [["DEBIT", "Dư Nợ"], ["CREDIT", "Dư Có"], ["BOTH", "Lưỡng tính"], ["NONE", "Không áp dụng"]];
const dimensions = [["CUSTOMER", "Khách hàng"], ["SUPPLIER", "Nhà cung cấp"], ["EMPLOYEE", "Nhân viên"], ["WAREHOUSE", "Kho"], ["BANK_ACCOUNT", "Tài khoản ngân hàng"], ["CONTRACT", "Hợp đồng"], ["PROJECT", "Công trình"], ["EXPENSE_ITEM", "Khoản mục chi phí"]];
const levels = [["NOT_USED", "Không theo dõi"], ["OPTIONAL", "Tùy chọn"], ["REQUIRED", "Bắt buộc"], ["CONDITIONAL", "Theo điều kiện"]];
const empty = { code: "", name: "", name_en: "", parent: "", account_type: "ASSET", normal_balance: "DEBIT", dimension_requirements: {} as Record<string, string>, is_foreign_currency: false };

export default function AccountCatalogWorkspace({ onBack }: { onBack?: () => void }) {
  const { token, companyId } = useApiSession();
  const [charts, setCharts] = useState<Chart[]>([]), [accounts, setAccounts] = useState<Account[]>([]), [chartId, setChartId] = useState("");
  const [query, setQuery] = useState(""), [mode, setMode] = useState<Mode>(null), [selected, setSelected] = useState<Account | null>(null);
  const [form, setForm] = useState(empty), [targetId, setTargetId] = useState(""), [deleteSource, setDeleteSource] = useState(false);
  const [reload, setReload] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const chart = charts.find(item => item.id === chartId);
  const chartAccounts = accounts.filter(item => item.chart_of_accounts === chartId).sort((a, b) => a.code.localeCompare(b.code, "vi"));
  useEffect(() => {
    if (!token || !companyId) { setCharts([]); setAccounts([]); return; }
    let active = true;
    Promise.all([request<Chart[] | { results: Chart[] }>(`/api/v1/general-ledger/charts-of-accounts/?company_id=${encodeURIComponent(companyId)}`, token), request<Account[] | { results: Account[] }>(`${root}?company_id=${encodeURIComponent(companyId)}&page_size=1000`, token)])
      .then(([chartRows, accountRows]) => { if (!active) return; const nextCharts = list(chartRows); setCharts(nextCharts); setAccounts(list(accountRows)); setChartId(current => nextCharts.some(row => row.id === current) ? current : nextCharts.find(row => row.is_default)?.id || nextCharts[0]?.id || ""); setError(""); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được hệ thống tài khoản."); });
    return () => { active = false; };
  }, [token, companyId, reload]);
  function open(next: Mode, account: Account | null = null, clone = false) {
    setSelected(clone ? null : account); setMode(next); setError(""); setMessage(""); setTargetId(""); setDeleteSource(false);
    setForm(account ? { code: clone ? "" : account.code, name: account.name, name_en: account.name_en || "", parent: clone ? account.parent || "" : account.parent || "", account_type: account.account_type, normal_balance: account.normal_balance, dimension_requirements: { ...account.dimension_requirements }, is_foreign_currency: account.is_foreign_currency } : { ...empty, dimension_requirements: {} });
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!chartId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "transfer" && selected) {
        if (!targetId || !window.confirm(`Chuyển dữ liệu từ ${selected.code} sang ${accounts.find(item => item.id === targetId)?.code}?`)) return;
        const result = await request<{ transferred_lines: number }>(`${root}${selected.id}/transfer/?company_id=${encodeURIComponent(companyId)}`, token, { method: "POST", body: JSON.stringify({ target_id: targetId, version: selected.version, delete_source: deleteSource }) });
        setMessage(`Đã chuyển ${result.transferred_lines} dòng hạch toán nháp.`);
      } else if (mode === "create") {
        await request(`${root}?company_id=${encodeURIComponent(companyId)}`, token, { method: "POST", body: JSON.stringify({ company: companyId, chart_of_accounts: chartId, ...form, parent: form.parent || null, is_postable: true }) });
        setMessage("Thêm tài khoản kế toán thành công.");
      } else if (mode === "edit" && selected) {
        await request(`${root}${selected.id}/?company_id=${encodeURIComponent(companyId)}`, token, { method: "PATCH", body: JSON.stringify({ code: form.code, name: form.name, name_en: form.name_en, normal_balance: form.normal_balance, dimension_requirements: form.dimension_requirements, is_foreign_currency: form.is_foreign_currency, version: selected.version }) });
        setMessage("Cập nhật tài khoản kế toán thành công.");
      }
      setMode(null); setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được tài khoản."); }
    finally { setBusy(false); }
  }
  async function changeStatus(account: Account) {
    const next = account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (!window.confirm(`${next === "INACTIVE" ? "Ngừng sử dụng" : "Sử dụng lại"} tài khoản ${account.code}?`)) return;
    setBusy(true); setError("");
    try {
      await request(`${root}${account.id}/change-status/?company_id=${encodeURIComponent(companyId)}`, token, { method: "POST", body: JSON.stringify({ new_status: next, reason: next === "INACTIVE" ? "Ngừng sử dụng từ danh mục" : "", version: account.version }) });
      setMessage(next === "INACTIVE" ? "Ngừng sử dụng tài khoản thành công." : "Sử dụng tài khoản thành công."); setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không đổi được trạng thái."); }
    finally { setBusy(false); }
  }
  async function remove(account: Account) {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản ${account.code}?`)) return;
    setBusy(true); setError("");
    try { await request(`${root}${account.id}/hard-delete/?company_id=${encodeURIComponent(companyId)}`, token, { method: "DELETE" }); setMessage("Xóa tài khoản kế toán thành công."); setReload(value => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không xóa được tài khoản."); }
    finally { setBusy(false); }
  }
  async function exportExcel() {
    if (!chartId) return;
    try {
      const response = await fetch(`${root}export-xlsx/?company_id=${encodeURIComponent(companyId)}&chart_of_accounts_id=${encodeURIComponent(chartId)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Không thể xuất Excel (HTTP ${response.status}).`);
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "he-thong-tai-khoan.xlsx"; link.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể xuất Excel."); }
  }
  return <main className="account-page"><section className="account-card account-wide">
    {onBack && <button type="button" onClick={onBack}>← Danh mục</button>}
    <p className="account-eyebrow">MD-09</p><h1>Hệ thống tài khoản</h1>
    {!token || !companyId ? <p>Cần đăng nhập và chọn doanh nghiệp.</p> : <>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      <label>Bộ tài khoản<select value={chartId} onChange={event => setChartId(event.target.value)}><option value="">Chọn bộ tài khoản</option>{charts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.accounting_regime}</option>)}</select></label>
      {chart?.accounting_regime === "TT58" ? <p>Bộ dữ liệu này áp dụng chế độ sổ kế toán theo Thông tư 58.</p> : <>
      <div className="account-actions"><label>Tìm theo số hoặc tên<input value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" onClick={() => open("create")} disabled={!chartId}>Thêm</button><button type="button" onClick={() => setReload(value => value + 1)}>Làm mới</button><button type="button" onClick={exportExcel} disabled={!chartId}>Xuất Excel</button></div>
      <table><thead><tr><th>Số tài khoản</th><th>Tên tài khoản</th><th>Tên tiếng Anh</th><th>Tính chất</th><th>Theo dõi chi tiết theo</th><th>Trạng thái</th><th>Chức năng</th></tr></thead><tbody>
        {chartAccounts.filter(item => `${item.code} ${item.name}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))).map(item => <tr key={item.id}><td style={{ paddingLeft: `${item.account_level * 12}px` }}>{item.code}</td><td>{item.name}</td><td>{item.name_en}</td><td>{balances.find(pair => pair[0] === item.normal_balance)?.[1]}</td><td>{Object.entries(item.dimension_requirements || {}).filter(([, level]) => level !== "NOT_USED").map(([key, level]) => `${dimensions.find(pair => pair[0] === key)?.[1] || key}: ${levels.find(pair => pair[0] === level)?.[1] || level}`).join(", ")}</td><td>{item.status === "ACTIVE" ? "Đang sử dụng" : "Ngừng sử dụng"}</td><td><div className="account-actions"><button type="button" onClick={() => open("edit", item)}>Sửa</button><button type="button" onClick={() => open("create", item, true)}>Nhân bản</button><button type="button" onClick={() => changeStatus(item)} disabled={busy}>{item.status === "ACTIVE" ? "Ngừng sử dụng" : "Sử dụng lại"}</button><button type="button" onClick={() => open("transfer", item)}>Chuyển TK</button><button type="button" onClick={() => remove(item)} disabled={busy}>Xóa</button></div></td></tr>)}
      </tbody></table></>}
      {mode && <form className="account-change-email" onSubmit={save}><h2>{mode === "create" ? "Thêm tài khoản" : mode === "edit" ? "Sửa tài khoản" : "Chuyển tài khoản hạch toán"}</h2>
        {mode === "transfer" ? <><p>Chỉ chuyển các dòng bút toán nháp ở kỳ đang mở. Tài khoản có số dư, bút toán đã ghi sổ hoặc tham chiếu nghiệp vụ khác sẽ bị từ chối.</p><label>Tài khoản nhận<select value={targetId} onChange={event => setTargetId(event.target.value)} required><option value="">Chọn tài khoản nhận</option>{chartAccounts.filter(item => item.id !== selected?.id && item.status === "ACTIVE" && item.is_postable && item.account_type === selected?.account_type && item.normal_balance === selected?.normal_balance).map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label><input type="checkbox" checked={deleteSource} onChange={event => setDeleteSource(event.target.checked)} /> Xóa tài khoản nguồn nếu đã hết tham chiếu</label></> : <>
          <label>Số tài khoản<input value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value }))} required /></label>
          <label>Tên tài khoản<input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required /></label><label>Tên tiếng Anh<input value={form.name_en} onChange={event => setForm(current => ({ ...current, name_en: event.target.value }))} /></label>
          {mode === "create" && <><label>Tài khoản tổng hợp<select value={form.parent} onChange={event => setForm(current => ({ ...current, parent: event.target.value }))}><option value="">Tài khoản gốc</option>{chartAccounts.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Bản chất<select value={form.account_type} onChange={event => setForm(current => ({ ...current, account_type: event.target.value }))}>{natures.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></>}
          <label>Tính chất<select value={form.normal_balance} onChange={event => setForm(current => ({ ...current, normal_balance: event.target.value }))}>{balances.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <fieldset><legend>Theo dõi chi tiết theo</legend>{dimensions.map(([key, label]) => <label key={key}>{label}<select value={form.dimension_requirements[key] || "NOT_USED"} onChange={event => setForm(current => ({ ...current, dimension_requirements: { ...current.dimension_requirements, [key]: event.target.value } }))}>{levels.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>)}</fieldset>
          <label><input type="checkbox" checked={form.is_foreign_currency} onChange={event => setForm(current => ({ ...current, is_foreign_currency: event.target.checked }))} /> Hạch toán ngoại tệ</label>
        </>}
        <div className="account-actions"><button type="submit" disabled={busy}>Thực hiện</button><button type="button" onClick={() => setMode(null)}>Hủy</button></div>
      </form>}
    </>}
  </section></main>;
}
