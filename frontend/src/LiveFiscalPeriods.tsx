import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Period = { id: string; code: string; name: string; start_date: string; end_date: string; status: string; period_type: string; allow_adjustment: boolean; notes: string };
type Year = { id: string; code: string; name: string; year_type: string; start_date: string; end_date: string; period_structure: string; has_adjustment_period: boolean; status: string; notes: string; periods_count: number; periods?: Period[] };
const base = "/api/v1/common";
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
const list = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;

export default function LiveFiscalPeriods() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [years, setYears] = useState<Year[]>([]);
  const [selected, setSelected] = useState<Year | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | "copy" | null>(null);
  const [code, setCode] = useState(""); const [name, setName] = useState("");
  const [yearType, setYearType] = useState("CALENDAR_YEAR"); const [structure, setStructure] = useState("MONTHLY");
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`); const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [adjustment, setAdjustment] = useState(false); const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<Period[]>([]);
  const [periodEdit, setPeriodEdit] = useState<Period | null>(null); const [periodName, setPeriodName] = useState(""); const [periodNotes, setPeriodNotes] = useState(""); const [periodAdjustment, setPeriodAdjustment] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Period | null>(null); const [nextStatus, setNextStatus] = useState("OPEN"); const [reason, setReason] = useState("");
  const [determineDate, setDetermineDate] = useState(today); const [determination, setDetermination] = useState("");
  const [reload, setReload] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");

  useEffect(() => { if (!token || !companyId) return; let active = true;
    request<Year[] | { results: Year[] }>(`${base}/fiscal-years/?company_id=${companyId}`, token)
      .then(value => { if (active) { const result = list(value); setYears(result); setSelected(current => { const refreshed = result.find(item => item.id === current?.id); return refreshed ? { ...refreshed, periods: current?.periods } : null; }); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được năm tài chính."); });
    return () => { active = false; };
  }, [token, companyId, reload]);
  useEffect(() => { if (!selected || !token) return; let active = true;
    request<Year>(`${base}/fiscal-years/${selected.id}/?company_id=${companyId}`, token).then(value => { if (active) setSelected(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được các kỳ."); });
    return () => { active = false; };
  }, [token, companyId, selected?.id, reload]);

  function open(next: typeof mode, year: Year | null = null) {
    setSelected(year); setMode(next); setError(""); setMessage(""); setPreview([]);
    setCode(next === "copy" ? "" : year?.code || ""); setName(next === "copy" ? "" : year?.name || "");
    setYearType(year?.year_type || "CALENDAR_YEAR"); setStructure(year?.period_structure || "MONTHLY");
    setStartDate(year?.start_date || `${new Date().getFullYear()}-01-01`); setEndDate(year?.end_date || `${new Date().getFullYear()}-12-31`);
    setAdjustment(year?.has_adjustment_period || false); setNotes(year?.notes || "");
  }
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); setMode(null); setPeriodEdit(null); setStatusTarget(null); setMessage(success); setReload(value => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được kỳ kế toán."); }
    finally { setBusy(false); }
  }
  async function showPreview() {
    setBusy(true); setError("");
    try { const result = await request<{ periods: Period[] }>(`${base}/fiscal-years/preview-periods/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ year_type: yearType, start_date: startDate, end_date: endDate, period_structure: structure, has_adjustment_period: adjustment, code_prefix: code || "FY" }) }); setPreview(result.periods); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không xem trước được các kỳ."); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "copy" && selected) return run(() => request(`${base}/fiscal-years/${selected.id}/copy/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ code, name, start_date: startDate, end_date: endDate }) }), "Đã sao chép năm tài chính.");
    const body = { company: companyId, code, name, year_type: yearType, start_date: startDate, end_date: endDate, period_structure: structure, has_adjustment_period: adjustment, notes };
    if (mode === "create") return run(() => request(`${base}/fiscal-years/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify(body) }), "Đã tạo năm tài chính bản nháp.");
    if (mode === "edit" && selected) return run(() => request(`${base}/fiscal-years/${selected.id}/?company_id=${companyId}`, token, { method: "PATCH", body: JSON.stringify(body) }), "Đã sửa năm tài chính bản nháp.");
  }

  return <main className="account-page"><section className="account-card account-wide"><Link to="/login">← Phiên làm việc</Link><p className="account-eyebrow">SYS-14</p><h1>Kỳ kế toán</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); setSelected(null); setMode(null); }}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      <button type="button" onClick={() => open("create")}>Tạo năm tài chính</button>
      <ul className="account-request-list">{years.map(year => <li key={year.id}><div><strong>{year.code} · {year.name}</strong><span>{year.start_date} – {year.end_date} · {year.status} · {year.periods_count} kỳ</span></div><div className="account-actions"><button type="button" onClick={() => open(null, year)}>Chi tiết</button><button type="button" onClick={() => open("copy", year)}>Sao chép</button>{year.status === "DRAFT" && <><button type="button" onClick={() => open("edit", year)}>Sửa</button><button type="button" onClick={() => run(() => request(`${base}/fiscal-years/${year.id}/activate/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ open_current_period: true }) }), "Đã kích hoạt năm tài chính.")}>Kích hoạt</button><button type="button" onClick={() => run(() => request(`${base}/fiscal-years/${year.id}/?company_id=${companyId}`, token, { method: "DELETE" }), "Đã xóa bản nháp.")}>Xóa nháp</button></>}{year.status === "ACTIVE" && <button type="button" onClick={() => run(() => request(`${base}/fiscal-years/${year.id}/close/?company_id=${companyId}`, token, { method: "POST", body: "{}" }), "Đã đóng năm tài chính.")}>Đóng năm</button>}</div></li>)}</ul>
      {mode && <form className="account-change-email" onSubmit={save}><h2>{mode === "create" ? "Tạo năm tài chính" : mode === "edit" ? "Sửa năm tài chính" : "Sao chép năm tài chính"}</h2><label>Mã<input value={code} onChange={event => setCode(event.target.value)} required /></label><label>Tên<input value={name} onChange={event => setName(event.target.value)} required /></label>{mode !== "copy" && <><label>Loại năm<select value={yearType} onChange={event => setYearType(event.target.value)}><option value="CALENDAR_YEAR">Năm dương lịch</option><option value="NON_CALENDAR_YEAR">Năm khác dương lịch</option><option value="SHORT_YEAR">Năm ngắn</option><option value="CUSTOM_YEAR">Tùy chỉnh</option></select></label><label>Cấu trúc kỳ<select value={structure} onChange={event => setStructure(event.target.value)}><option value="MONTHLY">Hàng tháng</option><option value="QUARTERLY">Hàng quý</option><option value="CUSTOM">Tùy chỉnh</option></select></label></>}<label>Bắt đầu<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} required /></label><label>Kết thúc<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} required /></label>{mode !== "copy" && <><label><input type="checkbox" checked={adjustment} onChange={event => setAdjustment(event.target.checked)} /> Có kỳ điều chỉnh</label><label>Ghi chú<textarea value={notes} onChange={event => setNotes(event.target.value)} /></label><button type="button" onClick={showPreview}>Xem trước các kỳ</button>{preview.length > 0 && <ul>{preview.map(period => <li key={period.code}>{period.code} · {period.start_date} – {period.end_date}</li>)}</ul>}</>}<div className="account-actions"><button type="submit" disabled={busy}>Xác nhận</button><button type="button" onClick={() => setMode(null)}>Hủy</button></div></form>}
      {selected && !mode && <section className="account-change-email"><h2>{selected.code} · Các kỳ kế toán</h2><ul className="account-request-list">{selected.periods?.map(period => <li key={period.id}><div><strong>{period.code} · {period.name}</strong><span>{period.start_date} – {period.end_date} · {period.status}</span></div><div className="account-actions"><button type="button" onClick={() => { setPeriodEdit(period); setPeriodName(period.name); setPeriodNotes(period.notes); setPeriodAdjustment(period.allow_adjustment); }}>Sửa thông tin</button><button type="button" onClick={() => { setStatusTarget(period); setNextStatus(period.status === "FUTURE" ? "OPEN" : "SOFT_CLOSED"); setReason(""); }}>Chuyển trạng thái</button></div></li>)}</ul>
        {periodEdit && <form onSubmit={event => { event.preventDefault(); run(() => request(`${base}/fiscal-periods/${periodEdit.id}/?company_id=${companyId}`, token, { method: "PATCH", body: JSON.stringify({ name: periodName, notes: periodNotes, allow_adjustment: periodAdjustment }) }), "Đã cập nhật kỳ."); }}><h3>Sửa kỳ {periodEdit.code}</h3><label>Tên<input value={periodName} onChange={event => setPeriodName(event.target.value)} required /></label><label>Ghi chú<textarea value={periodNotes} onChange={event => setPeriodNotes(event.target.value)} /></label><label><input type="checkbox" checked={periodAdjustment} onChange={event => setPeriodAdjustment(event.target.checked)} /> Cho phép điều chỉnh</label><button type="submit" disabled={busy}>Lưu kỳ</button><button type="button" onClick={() => setPeriodEdit(null)}>Hủy</button></form>}
        {statusTarget && <form onSubmit={event => { event.preventDefault(); run(() => request(`${base}/fiscal-periods/${statusTarget.id}/change-status/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ status: nextStatus, reason }) }), "Đã chuyển trạng thái kỳ."); }}><h3>Trạng thái kỳ {statusTarget.code}</h3><label>Trạng thái mới<select value={nextStatus} onChange={event => setNextStatus(event.target.value)}><option value="OPEN">Mở</option><option value="SOFT_CLOSED">Đóng tạm</option><option value="LOCKED">Khóa</option><option value="FUTURE">Chưa mở</option></select></label><label>Lý do<input value={reason} onChange={event => setReason(event.target.value)} /></label><button type="submit" disabled={busy}>Xác nhận</button><button type="button" onClick={() => setStatusTarget(null)}>Hủy</button></form>}
      </section>}
      <section className="account-change-email"><h2>Tra kỳ theo ngày</h2><label>Ngày chứng từ<input type="date" value={determineDate} onChange={event => setDetermineDate(event.target.value)} /></label><button type="button" onClick={async () => { setError(""); try { const result = await request<unknown>(`${base}/fiscal-periods/determine/?company_id=${companyId}&date=${determineDate}`, token); setDetermination(JSON.stringify(result, null, 2)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tìm được kỳ."); } }}>Tra cứu</button>{determination && <pre>{determination}</pre>}</section>
    </>}
  </section></main>;
}
