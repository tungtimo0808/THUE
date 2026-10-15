import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Rule = { id: string; code: string; name: string; document_type: string; document_type_code: string; status: string; version: number; pattern: string; prefix: string; suffix: string; separator: string; start_number: number; padding_length: number; increment_by: number; numbering_mode: string; sequence_scope: string; branch: string | null; accounting_book: string; custom_scope_key: string; reset_cycle: string; date_source: string; generation_event: string; overflow_strategy: string; effective_from: string | null; effective_to: string | null; notes: string };
type Catalog = { id: string; code: string; name: string };
type Counter = { id: string; scope_key: string; period_key: string; current_number: number };
type NumberHistory = { id: string; document_number: string; status: string; issued_at: string };
const rows = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
const base = "/api/v1/common/numbering-rules";

export default function LiveNumberingRules() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [rules, setRules] = useState<Rule[]>([]);
  const [documents, setDocuments] = useState<Catalog[]>([]);
  const [branches, setBranches] = useState<Catalog[]>([]);
  const [selected, setSelected] = useState<Rule | null>(null);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [history, setHistory] = useState<NumberHistory[]>([]);
  const [mode, setMode] = useState<"create" | "edit" | "copy" | "activate" | "deactivate" | null>(null);
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [docId, setDocId] = useState("");
  const [pattern, setPattern] = useState("{Prefix}-{Year}-{Sequence:6}"); const [prefix, setPrefix] = useState("DOC"); const [suffix, setSuffix] = useState("");
  const [startNumber, setStartNumber] = useState(1); const [padding, setPadding] = useState(6); const [increment, setIncrement] = useState(1);
  const [resetCycle, setResetCycle] = useState("YEARLY"); const [numberingMode, setNumberingMode] = useState("AUTO"); const [sequenceScope, setSequenceScope] = useState("COMPANY");
  const [branchId, setBranchId] = useState(""); const [dateSource, setDateSource] = useState("DOCUMENT_DATE"); const [generationEvent, setGenerationEvent] = useState("ON_CREATE");
  const [accountingBook, setAccountingBook] = useState(""); const [customScopeKey, setCustomScopeKey] = useState("");
  const [overflow, setOverflow] = useState("AUTO_EXPAND"); const [effectiveFrom, setEffectiveFrom] = useState(today); const [effectiveTo, setEffectiveTo] = useState("");
  const [reason, setReason] = useState(""); const [notes, setNotes] = useState(""); const [preview, setPreview] = useState("");
  const [reload, setReload] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    const load = async <T,>(path: string) => rows(await request<T[] | { results: T[] }>(path, token));
    Promise.allSettled([load<Rule>(`${base}/?company_id=${companyId}`), load<Catalog>(`/api/v1/master-data/document-types/?company_id=${companyId}`), load<Catalog>(`/api/v1/organization/branches/?company_id=${companyId}`), load<NumberHistory>(`/api/v1/common/numbering-history/?company_id=${companyId}`)])
      .then(results => { if (!active) return;
        if (results[0].status === "fulfilled") { const next = results[0].value; setRules(next); setSelected(current => next.find(item => item.id === current?.id) || null); }
        else setError(results[0].reason instanceof Error ? results[0].reason.message : "Không tải được quy tắc.");
        if (results[1].status === "fulfilled") setDocuments(results[1].value);
        if (results[2].status === "fulfilled") setBranches(results[2].value);
        if (results[3].status === "fulfilled") setHistory(results[3].value);
      });
    return () => { active = false; };
  }, [token, companyId, reload]);
  useEffect(() => {
    if (!token || !selected) { setCounters([]); return; }
    let active = true;
    request<Counter[]>(`${base}/${selected.id}/counters/?company_id=${companyId}`, token).then(value => { if (active) setCounters(value); }).catch(() => setCounters([]));
    return () => { active = false; };
  }, [token, companyId, selected?.id, reload]);

  function open(nextMode: typeof mode, rule: Rule | null = null) {
    setMode(nextMode); setSelected(rule); setError(""); setMessage(""); setPreview(""); setReason("");
    setCode(nextMode === "copy" ? "" : rule?.code || ""); setName(nextMode === "copy" ? "" : rule?.name || ""); setDocId(rule?.document_type || "");
    setPattern(rule?.pattern || "{Prefix}-{Year}-{Sequence:6}"); setPrefix(rule?.prefix || "DOC"); setSuffix(rule?.suffix || ""); setStartNumber(rule?.start_number || 1); setPadding(rule?.padding_length || 6); setIncrement(rule?.increment_by || 1); setResetCycle(rule?.reset_cycle || "YEARLY"); setNumberingMode(rule?.numbering_mode || "AUTO"); setSequenceScope(rule?.sequence_scope || "COMPANY"); setBranchId(rule?.branch || ""); setAccountingBook(rule?.accounting_book || ""); setCustomScopeKey(rule?.custom_scope_key || ""); setDateSource(rule?.date_source || "DOCUMENT_DATE"); setGenerationEvent(rule?.generation_event || "ON_CREATE"); setOverflow(rule?.overflow_strategy || "AUTO_EXPAND"); setEffectiveFrom(rule?.effective_from || today()); setEffectiveTo(rule?.effective_to || ""); setNotes(rule?.notes || "");
  }
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); setMode(null); setMessage(success); setReload(value => value + 1); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được quy tắc."); return false; }
    finally { setBusy(false); }
  }
  async function showPreview() {
    setBusy(true); setError("");
    try { const value = await request<unknown>(`${base}/preview/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ company: companyId, pattern, prefix, suffix, start_number: startNumber, padding_length: padding, increment_by: increment, reset_cycle: resetCycle, numbering_mode: numberingMode }) }); setPreview(JSON.stringify(value, null, 2)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không xem trước được số chứng từ."); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!mode) return;
    const body = { company: companyId, code: code.trim(), name: name.trim(), document_type: docId, pattern, prefix, suffix, start_number: startNumber, padding_length: padding, increment_by: increment, reset_cycle: resetCycle, numbering_mode: numberingMode, sequence_scope: sequenceScope, branch: branchId || null, accounting_book: accountingBook, custom_scope_key: customScopeKey, date_source: dateSource, generation_event: generationEvent, overflow_strategy: overflow, effective_from: effectiveFrom, effective_to: effectiveTo || null, notes };
    if (mode === "create") await run(() => request(`${base}/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify(body) }), "Đã tạo quy tắc bản nháp.");
    if (mode === "edit" && selected) await run(() => request(`${base}/${selected.id}/?company_id=${companyId}`, token, { method: "PATCH", body: JSON.stringify(body) }), "Đã sửa quy tắc bản nháp.");
    if (mode === "copy" && selected) await run(() => request(`${base}/${selected.id}/copy/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ code: code.trim(), name: name.trim(), document_type: docId }) }), "Đã sao chép quy tắc.");
    if (mode === "activate" && selected) await run(() => request(`${base}/${selected.id}/activate/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ effective_from: effectiveFrom }) }), "Đã kích hoạt quy tắc.");
    if (mode === "deactivate" && selected) await run(() => request(`${base}/${selected.id}/deactivate/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ reason: reason.trim(), effective_to: effectiveTo || today() }) }), "Đã ngừng quy tắc.");
  }

  return <main className="account-page"><section className="account-card account-wide"><Link to="/login">← Phiên làm việc</Link><p className="account-eyebrow">SYS-13</p><h1>Đánh số chứng từ</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); open(null); }}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>{error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      <button type="button" onClick={() => open("create")}>Tạo quy tắc</button><ul className="account-request-list">{rules.map(rule => <li key={rule.id}><div><strong>{rule.code} · {rule.name}</strong><span>{rule.document_type_code} · v{rule.version} · {rule.status} · {rule.pattern}</span></div><div className="account-actions"><button type="button" onClick={() => open(null, rule)}>Chi tiết</button><button type="button" onClick={() => open("copy", rule)}>Sao chép</button>{rule.status === "DRAFT" && <><button type="button" onClick={() => open("edit", rule)}>Sửa</button><button type="button" onClick={() => open("activate", rule)}>Kích hoạt</button><button type="button" onClick={() => run(() => request(`${base}/${rule.id}/?company_id=${companyId}`, token, { method: "DELETE" }), "Đã xóa bản nháp.")}>Xóa nháp</button></>}{rule.status === "ACTIVE" && <><button type="button" onClick={() => open("deactivate", rule)}>Ngừng</button><button type="button" onClick={() => run(() => request(`${base}/${rule.id}/new-version/?company_id=${companyId}`, token, { method: "POST", body: "{}" }), "Đã tạo phiên bản mới.")}>Phiên bản mới</button></>}</div></li>)}</ul>
      {selected && !mode && <section className="account-change-email"><h2>{selected.code}</h2><p>{selected.pattern} · {selected.prefix} · bắt đầu {selected.start_number}, tăng {selected.increment_by}</p><h3>Bộ đếm</h3><ul>{counters.map(item => <li key={item.id}>{item.scope_key} · {item.period_key} · {item.current_number}</li>)}</ul></section>}
      {mode && <form className="account-change-email" onSubmit={save}><h2>{mode === "create" ? "Tạo quy tắc" : mode === "edit" ? "Sửa quy tắc" : mode === "copy" ? "Sao chép quy tắc" : mode === "activate" ? "Kích hoạt quy tắc" : "Ngừng quy tắc"}</h2>
        {["create", "edit", "copy"].includes(mode) && <><label>Mã quy tắc<input value={code} onChange={event => setCode(event.target.value)} required disabled={mode === "edit"} /></label><label>Tên quy tắc<input value={name} onChange={event => setName(event.target.value)} required /></label><label>Loại chứng từ<select value={docId} onChange={event => setDocId(event.target.value)} required disabled={mode === "edit"}><option value="">Chọn loại chứng từ</option>{documents.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label></>}
        {["create", "edit"].includes(mode) && <><label>Mẫu số<input value={pattern} onChange={event => setPattern(event.target.value)} required /></label><label>Tiền tố<input value={prefix} onChange={event => setPrefix(event.target.value)} /></label><label>Hậu tố<input value={suffix} onChange={event => setSuffix(event.target.value)} /></label><label>Số bắt đầu<input type="number" min={1} value={startNumber} onChange={event => setStartNumber(Number(event.target.value))} /></label><label>Độ dài số<input type="number" min={1} value={padding} onChange={event => setPadding(Number(event.target.value))} /></label><label>Bước tăng<input type="number" min={1} value={increment} onChange={event => setIncrement(Number(event.target.value))} /></label><label>Chế độ<select value={numberingMode} onChange={event => setNumberingMode(event.target.value)}><option value="AUTO">Tự động</option><option value="MANUAL">Thủ công</option><option value="HYBRID">Kết hợp</option></select></label><label>Phạm vi dãy số<select value={sequenceScope} onChange={event => setSequenceScope(event.target.value)}><option value="COMPANY">Doanh nghiệp</option><option value="BRANCH">Chi nhánh</option><option value="DOCUMENT_TYPE">Loại chứng từ</option><option value="BRANCH_DOCUMENT_TYPE">Chi nhánh và loại chứng từ</option><option value="ACCOUNTING_BOOK">Sổ kế toán</option><option value="CUSTOM_SCOPE">Tùy chỉnh</option></select></label>{["BRANCH", "BRANCH_DOCUMENT_TYPE"].includes(sequenceScope) && <label>Chi nhánh<select value={branchId} onChange={event => setBranchId(event.target.value)} required><option value="">Chọn chi nhánh</option>{branches.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>}{sequenceScope === "ACCOUNTING_BOOK" && <label>Sổ kế toán<input value={accountingBook} onChange={event => setAccountingBook(event.target.value)} required /></label>}{sequenceScope === "CUSTOM_SCOPE" && <label>Khóa phạm vi<input value={customScopeKey} onChange={event => setCustomScopeKey(event.target.value)} required /></label>}<label>Chu kỳ đặt lại<select value={resetCycle} onChange={event => setResetCycle(event.target.value)}><option value="YEARLY">Hàng năm</option><option value="MONTHLY">Hàng tháng</option><option value="ACCOUNTING_PERIOD">Kỳ kế toán</option><option value="NEVER">Không đặt lại</option></select></label><label>Nguồn ngày<select value={dateSource} onChange={event => setDateSource(event.target.value)}><option value="DOCUMENT_DATE">Ngày chứng từ</option><option value="SYSTEM_DATE">Ngày hệ thống</option></select></label><label>Sự kiện cấp số<select value={generationEvent} onChange={event => setGenerationEvent(event.target.value)}><option value="ON_CREATE">Tạo mới</option><option value="ON_SAVE">Lưu lần đầu</option><option value="ON_SUBMIT">Gửi duyệt</option><option value="ON_APPROVE">Phê duyệt</option><option value="ON_POST">Ghi sổ</option></select></label><label>Khi tràn số<select value={overflow} onChange={event => setOverflow(event.target.value)}><option value="AUTO_EXPAND">Tự mở rộng</option><option value="BLOCK">Dừng cấp số</option></select></label><label>Ghi chú<textarea value={notes} onChange={event => setNotes(event.target.value)} /></label><button type="button" onClick={showPreview}>Xem trước số</button>{preview && <pre>{preview}</pre>}</>}
        {mode === "deactivate" && <label>Lý do ngừng<input value={reason} onChange={event => setReason(event.target.value)} required /></label>}{["create", "edit", "activate"].includes(mode) && <label>Hiệu lực từ<input type="date" value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} required /></label>}{["create", "edit", "deactivate"].includes(mode) && <label>Hiệu lực đến<input type="date" value={effectiveTo} onChange={event => setEffectiveTo(event.target.value)} /></label>}<div className="account-actions"><button type="submit" disabled={busy}>Xác nhận</button><button type="button" onClick={() => setMode(null)}>Hủy</button></div>
      </form>}
      <section className="account-change-email"><h2>Lịch sử cấp số gần đây</h2><ul>{history.map(item => <li key={item.id}>{item.document_number} · {item.status} · {new Date(item.issued_at).toLocaleString("vi-VN")}</li>)}</ul></section>
    </>}
  </section></main>;
}
