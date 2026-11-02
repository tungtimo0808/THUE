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
  const activeRegime = chart?.accounting_regime || "TT99";
  const regimeInfoText =
    activeRegime === "TT133"
      ? "Thông tư 133/2016/TT-BTC (Doanh nghiệp nhỏ và vừa — DNNVV) · Đặc trưng: TK 154 tập hợp trực tiếp (không có 621, 622, 627), TK 6421/6422 (gộp 641 vào 642), TK 2111/2112/2113, TK 1386."
      : activeRegime === "TT200"
      ? "Thông tư 200/2014/TT-BTC (Chế độ kế toán Doanh nghiệp) · Đặc trưng: Tập hợp giá thành qua TK 621, 622, 627 → 154; Chi phí bán hàng TK 641 & QLDN TK 642; TK 244, 34311..34313."
      : "Thông tư 99/2025/TT-BTC (Hiệu lực từ 01/01/2026 thay thế TT200) · Đặc trưng: Bổ sung TK 215 (Tài sản sinh học), TK 332 (Phải trả cổ tức/lợi nhuận), TK 158 (Nguyên liệu, vật liệu tại kho bảo thuế), TK 2295.";
  const filteredAccounts = chartAccounts.filter(item => `${item.code} ${item.name}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  return <div style={{ width: "100%", background: "#ffffff", borderRadius: 8, padding: "12px 16px" }}>
    {onBack && <button type="button" onClick={onBack} style={{ marginBottom: 10, padding: "5px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer", fontWeight: 600 }}>← Danh mục</button>}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0284c7", textTransform: "uppercase" }}>MD-09 · DANH MỤC HỆ THỐNG TÀI KHOẢN</div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: "2px 0 0" }}>Hệ thống tài khoản kế toán ({activeRegime}) — Tổng số: {chartAccounts.length} tài khoản</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#334155" }}>
          Bộ tài khoản:
          <select value={chartId} onChange={event => setChartId(event.target.value)} style={{ height: 34, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
            <option value="">Chọn bộ tài khoản</option>
            {charts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.accounting_regime} ({chartAccounts.length} TK)</option>)}
          </select>
        </label>
      </div>
    </div>
    <div data-testid="coa-regime-banner" style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, background: activeRegime === "TT133" ? "#eff6ff" : activeRegime === "TT200" ? "#fffbeb" : "#ecfdf5", color: activeRegime === "TT133" ? "#1d4ed8" : activeRegime === "TT200" ? "#b45309" : "#047857", border: activeRegime === "TT133" ? "1px solid #bfdbfe" : activeRegime === "TT200" ? "1px solid #fde68a" : "1px solid #a7f3d0" }}>
      {regimeInfoText}
    </div>
    {!token || !companyId ? <p>Cần đăng nhập và chọn doanh nghiệp.</p> : <>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      {chart?.accounting_regime === "TT58" ? <p>Bộ dữ liệu này áp dụng chế độ sổ kế toán theo Thông tư 58.</p> : <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm theo số hiệu hoặc tên tài khoản (VD: 154, 215, 332, 6421...)" style={{ width: 380, height: 34, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 12px", fontSize: 13 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => open("create")} disabled={!chartId} style={{ height: 34, padding: "0 14px", borderRadius: 6, background: "#00a862", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>+ Thêm tài khoản</button>
          <button type="button" onClick={() => setReload(value => value + 1)} style={{ height: 34, padding: "0 12px", borderRadius: 6, background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", fontWeight: 600, cursor: "pointer" }}>Làm mới</button>
          <button type="button" onClick={exportExcel} disabled={!chartId} style={{ height: 34, padding: "0 12px", borderRadius: 6, background: "#f8fafc", color: "#0284c7", border: "1px solid #bae6fd", fontWeight: 600, cursor: "pointer" }}>Xuất Excel</button>
        </div>
      </div>
      <div style={{ maxHeight: 460, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead style={{ position: "sticky", top: 0, background: "#f1f5f9", zIndex: 1 }}>
            <tr style={{ borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", width: 110 }}>Số tài khoản</th>
              <th style={{ padding: "8px 12px", textAlign: "left" }}>Tên tài khoản (Tiếng Việt)</th>
              <th style={{ padding: "8px 12px", textAlign: "left", width: 220 }}>Tên tiếng Anh</th>
              <th style={{ padding: "8px 12px", textAlign: "left", width: 100 }}>Tính chất</th>
              <th style={{ padding: "8px 12px", textAlign: "left", width: 190 }}>Theo dõi chi tiết</th>
              <th style={{ padding: "8px 12px", textAlign: "center", width: 105 }}>Trạng thái</th>
              <th style={{ padding: "8px 12px", textAlign: "center", width: 190 }}>Chức năng</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map(item => (
              <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9", background: item.account_level === 1 ? "#f8fafc" : "#ffffff", fontWeight: item.account_level === 1 ? 700 : 400 }}>
                <td style={{ padding: "7px 12px", paddingLeft: `${12 + (item.account_level - 1) * 14}px`, color: "#00a862", fontWeight: 700 }}>{item.code}</td>
                <td style={{ padding: "7px 12px", color: "#0f172a" }}>{item.name}</td>
                <td style={{ padding: "7px 12px", color: "#64748b", fontSize: 12 }}>{item.name_en}</td>
                <td style={{ padding: "7px 12px", color: "#334155" }}>{balances.find(pair => pair[0] === item.normal_balance)?.[1]}</td>
                <td style={{ padding: "7px 12px", color: "#475569", fontSize: 11.5 }}>{Object.entries(item.dimension_requirements || {}).filter(([, level]) => level !== "NOT_USED").map(([key, level]) => `${dimensions.find(pair => pair[0] === key)?.[1] || key}`).join(", ") || "—"}</td>
                <td style={{ padding: "7px 12px", textAlign: "center", color: item.status === "ACTIVE" ? "#059669" : "#94a3b8", fontWeight: 600 }}>{item.status === "ACTIVE" ? "Đang sử dụng" : "Ngừng SD"}</td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}>
                  <div style={{ display: "inline-flex", gap: 4 }}>
                    <button type="button" onClick={() => open("edit", item)} style={{ padding: "2px 7px", fontSize: 11.5, borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>Sửa</button>
                    <button type="button" onClick={() => open("create", item, true)} style={{ padding: "2px 7px", fontSize: 11.5, borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>Nhân bản</button>
                    <button type="button" onClick={() => open("transfer", item)} style={{ padding: "2px 7px", fontSize: 11.5, borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>Chuyển TK</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></>}
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
  </div>;
}
