import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ApiError, checkCustomerDuplicates, createCustomer, deleteCustomer,
  exportCustomers, getCustomerDebtSummary, getCustomers, importCustomers,
  mergeCustomers, setCustomerStatus, updateCustomer, type Customer, type CustomerInput,
  type DuplicateCustomer, type ImportResult, request,
} from "./live-api";
import { useApiSession } from "./ApiSession";
import "./live-customers.css";

export default function LiveCustomers({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { token, companies, companyId, signIn: authenticate, signOut, selectCompany } = useApiSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [draft, setDraft] = useState<CustomerInput>({ code: "", name: "", party_type: "ORGANIZATION", legal_name: "", tax_code: "" });
  const [saving, setSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Customer | null>(null);
  const [nextStatus, setNextStatus] = useState("INACTIVE");
  const [reason, setReason] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateCustomer[] | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Customer | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeReason, setMergeReason] = useState("");
  const [taxSuggestion, setTaxSuggestion] = useState<{ name: string; legal_name: string; address: string; lookup_source: string } | null>(null);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authenticate(email.trim(), password);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đăng nhập được.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!token || !companyId) return;
    const controller = new AbortController();
    setLoading(true);
    setCustomers([]);
    setError("");
    getCustomers(token, companyId, controller.signal)
      .then(setCustomers)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.status === 401) {
          signOut();
          setError("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
        } else {
          setError(cause instanceof Error ? cause.message : "Không tải được khách hàng.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, companyId, reload]);

  const visible = customers.filter(customer =>
    `${customer.code} ${customer.name} ${customer.tax_code ?? ""}`
      .toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
  );

  function openEditor(customer?: Customer) {
    setEditing(customer ?? "new");
    setDraft(customer ? {
      code: customer.code, name: customer.name, party_type: customer.party_type,
      legal_name: customer.legal_name || "", tax_code: customer.tax_code || "",
    } : { code: "", name: "", party_type: "ORGANIZATION", legal_name: "", tax_code: "" });
    setError("");
    setDuplicates(null);
    setTaxSuggestion(null);
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !companyId) return;
    setSaving(true);
    setError("");
    try {
      if (editing === "new") await createCustomer(token, companyId, draft);
      else await updateCustomer(token, companyId, editing, draft);
      setEditing(null);
      setReload(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được khách hàng.");
    } finally { setSaving(false); }
  }

  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!statusTarget) return;
    setSaving(true);
    setError("");
    try {
      await setCustomerStatus(token, companyId, statusTarget, nextStatus, reason);
      setStatusTarget(null);
      setReload(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đổi được trạng thái.");
    } finally { setSaving(false); }
  }

  async function findDuplicates() {
    if (!companyId) return;
    setError("");
    try {
      setDuplicates(await checkCustomerDuplicates(token, companyId, draft, editing && editing !== "new" ? editing.id : undefined));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không kiểm tra được trùng lặp."); }
  }

  async function lookupTax() {
    setError(""); setTaxSuggestion(null);
    try { setTaxSuggestion(await request<{ name: string; legal_name: string; address: string; lookup_source: string }>(`/api/v1/master-data/customers/lookup-tax-info/?company_id=${companyId}&tax_code=${encodeURIComponent(draft.tax_code)}`, token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tra cứu được mã số thuế."); }
  }

  async function showDebt(customer: Customer) {
    setError("");
    try { setSummary(await getCustomerDebtSummary(token, companyId, customer.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không xem được công nợ."); }
  }

  async function remove(customer: Customer) {
    if (!window.confirm(`Xóa khách hàng ${customer.code}? BE sẽ từ chối nếu đã có chứng từ.`)) return;
    setError("");
    try { await deleteCustomer(token, companyId, customer.id); setReload(value => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không xóa được khách hàng."); }
  }

  async function downloadCsv() {
    setError("");
    try {
      const blob = await exportCustomers(token, companyId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "customers.csv"; link.click();
      URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không xuất được khách hàng."); }
  }

  async function uploadCsv(preview: boolean) {
    if (!importFile) return;
    setSaving(true);
    setError("");
    try {
      setImportResult(await importCustomers(token, companyId, importFile, preview));
      if (!preview) setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không nhập được khách hàng."); }
    finally { setSaving(false); }
  }

  async function merge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mergeTarget || !mergeSourceId || !mergeReason.trim()) return;
    if (!window.confirm("Hợp nhất sẽ chuyển dữ liệu khách hàng nguồn vào khách hàng đích. Tiếp tục?")) return;
    setSaving(true);
    setError("");
    try {
      await mergeCustomers(token, companyId, mergeTarget.id, mergeSourceId, mergeReason.trim());
      setMergeTarget(null);
      setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không hợp nhất được khách hàng."); }
    finally { setSaving(false); }
  }

  return (
    <section className="live-customers" aria-label="Khách hàng từ BE">
      <header className="live-customers-header">
        <button type="button" onClick={onBack}>← Danh mục</button>
        <div><h1>Khách hàng</h1><p>Dữ liệu trực tiếp từ backend</p></div>
        {token && <button type="button" onClick={() => {
          signOut(); setCustomers([]); setError("");
        }}>Đăng xuất</button>}
      </header>
      {!token ? (
        <form className="live-login" onSubmit={signIn}>
          <h2>Đăng nhập BE</h2>
          <p>Chưa có tài khoản? <Link to="/account">Đăng ký và xác thực email</Link></p>
          <p><Link to="/login">Đăng nhập ở trang tài khoản</Link></p>
          <label>Email hoặc tên đăng nhập<input autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></label>
          <label>Mật khẩu<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
          <button type="submit" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
        </form>
      ) : (
        <>
          <div className="live-customers-toolbar">
            <label>Doanh nghiệp
              <select aria-label="Doanh nghiệp BE" value={companyId} onChange={event => selectCompany(event.target.value)}>
                {companies.map(company => <option key={company.id} value={company.id}>{company.name} ({company.code})</option>)}
              </select>
            </label>
            <label>Tìm khách hàng<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Mã, tên hoặc mã số thuế" /></label>
            <button type="button" disabled={!companyId || loading} onClick={() => setReload(value => value + 1)}>Tải lại</button>
            <button type="button" disabled={!companyId} onClick={() => openEditor()}>Thêm khách hàng</button>
            <button type="button" disabled={!companyId} onClick={downloadCsv}>Xuất CSV</button>
          </div>
          {loading ? <p role="status">Đang tải khách hàng…</p> : companyId && !error ? (
            <>
              <p role="status">{visible.length} khách hàng{query ? " phù hợp" : ""}</p>
              <div className="live-customers-table"><table>
                <thead><tr><th>Mã</th><th>Tên khách hàng</th><th>Mã số thuế</th><th>Loại</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                <tbody>{visible.map(customer => <tr key={customer.id}>
                  <td>{customer.code}</td><td>{customer.name}</td><td>{customer.tax_code || "—"}</td>
                  <td>{customer.party_type}</td><td>{customer.status}</td>
                  <td><Link to={`/customers/${customer.id}`}>Chi tiết</Link>{" "}<button type="button" onClick={() => openEditor(customer)}>Sửa</button>{" "}
                    <button type="button" onClick={() => { setStatusTarget(customer); setNextStatus(customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"); setReason(""); setError(""); }}>Trạng thái</button>{" "}
                    <button type="button" onClick={() => showDebt(customer)}>Công nợ</button>{" "}
                    <button type="button" onClick={() => { setMergeTarget(customer); setMergeSourceId(""); setMergeReason(""); setError(""); }}>Hợp nhất</button>{" "}
                    <button type="button" onClick={() => remove(customer)}>Xóa</button></td>
                </tr>)}</tbody>
              </table></div>
              {!visible.length && <p>Chưa có khách hàng nào trong doanh nghiệp này.</p>}
              <div className="live-import">
                <label>Nhập khách hàng từ CSV<input type="file" accept=".csv,text/csv" onChange={event => { setImportFile(event.target.files?.[0] ?? null); setImportResult(null); }} /></label>
                <button type="button" disabled={!importFile || saving} onClick={() => uploadCsv(true)}>Xem trước</button>
                <button type="button" disabled={!importFile || saving} onClick={() => uploadCsv(false)}>Nhập vào BE</button>
                <small>CSV UTF-8 cần các cột: code,name,party_type.</small>
                {importResult && <p role="status">{importResult.preview ? "Xem trước" : "Đã nhập"}: {importResult.results.filter(row => !row.error).length} dòng hợp lệ, {importResult.results.filter(row => row.error).length} dòng lỗi.</p>}
              </div>
            </>
          ) : null}
        </>
      )}
      {editing && <form className="live-editor" onSubmit={saveCustomer} aria-label="Biểu mẫu khách hàng">
        <h2>{editing === "new" ? "Thêm khách hàng" : `Sửa ${editing.code}`}</h2>
        <label>Mã khách hàng<input value={draft.code} onChange={event => setDraft(value => ({ ...value, code: event.target.value }))} placeholder="Để trống để BE tự tạo mã" /></label>
        <label>Tên khách hàng<input required value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} /></label>
        <label>Loại<select value={draft.party_type} onChange={event => setDraft(value => ({ ...value, party_type: event.target.value }))}>
          <option value="ORGANIZATION">Tổ chức</option><option value="INDIVIDUAL">Cá nhân</option><option value="HOUSEHOLD_BUSINESS">Hộ kinh doanh</option>
        </select></label>
        <label>Tên pháp lý<input value={draft.legal_name} onChange={event => setDraft(value => ({ ...value, legal_name: event.target.value }))} required={draft.party_type === "ORGANIZATION"} /></label>
        <label>Mã số thuế<input value={draft.tax_code} onChange={event => setDraft(value => ({ ...value, tax_code: event.target.value }))} /></label>
        <div><button type="button" onClick={findDuplicates}>Kiểm tra trùng</button>{" "}<button type="button" onClick={lookupTax} disabled={!draft.tax_code}>Tra mã số thuế</button>{" "}<button type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu vào BE"}</button>{" "}<button type="button" onClick={() => { setEditing(null); setError(""); }}>Hủy</button></div>
        {taxSuggestion && <div role="status"><p>Thông tin gợi ý từ {taxSuggestion.lookup_source}: {taxSuggestion.legal_name}</p><p>{taxSuggestion.address}</p><button type="button" onClick={() => setDraft(value => ({ ...value, name: taxSuggestion.name, legal_name: taxSuggestion.legal_name }))}>Dùng tên gợi ý</button></div>}
        {duplicates && <div role="status">{duplicates.length ? duplicates.map(item => <p key={item.id}>{item.code} · {item.name} · {item.match_reasons.join(", ")}</p>) : <p>Không thấy khách hàng trùng.</p>}</div>}
      </form>}
      {statusTarget && <form className="live-editor" onSubmit={changeStatus} aria-label="Đổi trạng thái khách hàng">
        <h2>Trạng thái {statusTarget.code}</h2>
        <label>Trạng thái mới<select value={nextStatus} onChange={event => setNextStatus(event.target.value)}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng sử dụng</option><option value="BLOCKED">Khóa giao dịch</option></select></label>
        <label>Lý do<input value={reason} onChange={event => setReason(event.target.value)} required={nextStatus !== "ACTIVE"} /></label>
        <div><button type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Xác nhận"}</button>{" "}<button type="button" onClick={() => { setStatusTarget(null); setError(""); }}>Hủy</button></div>
      </form>}
      {summary && <div className="live-editor" role="region" aria-label="Tổng hợp công nợ">
        <h2>Công nợ {String(summary.customer_code ?? "")}</h2>
        <p>Số dư phải thu: {Number(summary.total_receivable ?? 0).toLocaleString("vi-VN")} đ</p>
        <p>Đơn hàng đang xử lý: {String(summary.pending_orders_count ?? 0)}</p>
        <button type="button" onClick={() => setSummary(null)}>Đóng</button>
      </div>}
      {mergeTarget && <form className="live-editor" onSubmit={merge} aria-label="Hợp nhất khách hàng">
        <h2>Khách hàng đích: {mergeTarget.code}</h2>
        <label>Khách hàng nguồn<select value={mergeSourceId} required onChange={event => setMergeSourceId(event.target.value)}>
          <option value="">Chọn khách hàng</option>
          {customers.filter(customer => customer.id !== mergeTarget.id && customer.status !== "MERGED").map(customer =>
            <option key={customer.id} value={customer.id}>{customer.code} · {customer.name}</option>) }
        </select></label>
        <label>Lý do<input value={mergeReason} required onChange={event => setMergeReason(event.target.value)} /></label>
        <div><button type="submit" disabled={saving}>Hợp nhất trong BE</button>{" "}<button type="button" onClick={() => { setMergeTarget(null); setError(""); }}>Hủy</button></div>
      </form>}
      {error && <p className="live-customers-error" role="alert">{error}</p>}
    </section>
  );
}
