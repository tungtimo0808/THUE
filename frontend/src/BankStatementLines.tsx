import { useMemo, useState } from "react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";

type Line = Record<string, any>;
const money = (value: unknown) => Number(value || 0).toLocaleString("vi-VN");
const matchLabel: Record<string, string> = { UNMATCHED: "Chưa ghép", PARTIALLY_MATCHED: "Ghép một phần", MATCHED: "Đã ghép", VARIANCE: "Chênh lệch" };

export default function BankStatementLines({ lines, profiles, account, loadedRange, companyId, reload, notify, onCreateVoucher, onMatch }: {
  lines: Line[]; profiles: Line[]; account: string; companyId: string; reload: () => void; notify: (message: string) => void;
  loadedRange?: { from: string; to: string; account: string } | null;
  onCreateVoucher?: (kind: "receipt" | "payment", line: { account: string; accountNumber: string; date: string; amount: number; description: string; counterparty: string; counterpartyAccount: string; reference: string }) => void;
  onMatch?: (line: Line) => void;
}) {
  const { token } = useApiSession();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [branch, setBranch] = useState("");
  const [period, setPeriod] = useState("");
  const [currency, setCurrency] = useState("");
  const [trackingFilter, setTrackingFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("NORMAL");
  const [reviewReason, setReviewReason] = useState("");
  const [removeReason, setRemoveReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = lines.find((line) => line.id === selectedId);
  const filtered = useMemo(() => lines.filter((line) =>
    (!account || line.account === account) &&
    (!loadedRange || loadedRange.account !== account || line.transaction_date >= loadedRange.from && line.transaction_date <= loadedRange.to) &&
    (!dateFrom || line.transaction_date >= dateFrom) &&
    (!dateTo || line.transaction_date <= dateTo) && (!direction || line.direction === direction) &&
    (!status || line.match_status === status) && (!source || line.source === source) &&
    (!branch || line.branch === branch) && (!period || line.statement === period) &&
    (!currency || line.currency_code === currency) && (!trackingFilter || line.tracking_status === trackingFilter) &&
    (!keyword || [line.external_id, line.reference, line.description, line.counterparty].some((value) => String(value || "").toLocaleLowerCase("vi").includes(keyword.toLocaleLowerCase("vi")))),
  ), [lines, account, loadedRange, dateFrom, dateTo, direction, status, source, branch, period, currency, trackingFilter, keyword]);
  const receipts = filtered.reduce((sum, line) => sum + (line.direction === "CREDIT" ? Number(line.amount) : 0), 0);
  const payments = filtered.reduce((sum, line) => sum + (line.direction === "DEBIT" ? Number(line.amount) : 0), 0);
  const query = new URLSearchParams({ company_id: companyId, account, ...(branch && { branch_id: branch }), ...(period && { statement: period }), ...(currency && { currency }), ...(trackingFilter && { tracking_status: trackingFilter }), ...(dateFrom && { date_from: dateFrom }), ...(dateTo && { date_to: dateTo }), ...(direction && { direction }), ...(status && { match_status: status }), ...(source && { source }), ...(keyword && { search: keyword }) });
  const open = (line: Line) => { setSelectedId(line.id); setNote(line.processing_note || ""); setTracking(line.tracking_status || "NORMAL"); setReviewReason(line.review_reason || ""); setRemoveReason(""); setError(""); };
  const save = async () => {
    if (!selected || !token || busy) return;
    if ((tracking === "NEEDS_REVIEW" || tracking === "WAITING") && !reviewReason.trim()) { setError("Vui lòng nhập lý do cần kiểm tra hoặc chờ xử lý."); return; }
    setBusy(true); setError("");
    try {
      await request(`/api/v1/bank/statement-lines/${selected.id}/?company_id=${encodeURIComponent(companyId)}`, token, {
        method: "PATCH", body: JSON.stringify({ processing_note: note, tracking_status: tracking, review_reason: reviewReason, updated_at: selected.updated_at || "" }),
      });
      notify("Đã lưu ghi chú giao dịch sao kê."); setSelectedId(""); reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không lưu được giao dịch."); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!selected || !token || busy) return;
    if (!removeReason.trim()) { setError("Vui lòng nhập lý do xóa."); return; }
    setBusy(true); setError("");
    try {
      await request(`/api/v1/bank/statement-lines/${selected.id}/remove/?company_id=${encodeURIComponent(companyId)}`, token, {
        method: "POST", body: JSON.stringify({ reason: removeReason, updated_at: selected.updated_at || "" }),
      });
      notify("Đã xóa giao dịch nhập từ tệp và lưu Audit Log."); setSelectedId(""); reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không xóa được giao dịch."); }
    finally { setBusy(false); }
  };
  const unmatch = async (voucher: Line) => {
    if (!selected || !token || busy || !window.confirm(`Hủy ghép chứng từ ${voucher.number} với giao dịch ${selected.external_id}?`)) return;
    setBusy(true); setError("");
    try {
      await request(`/api/v1/bank/reconciliations/${voucher.link_id}/unmatch/?company_id=${encodeURIComponent(companyId)}${selected.branch ? `&branch_id=${encodeURIComponent(selected.branch)}` : ""}`, token, { method: "POST", body: "{}" });
      notify("Đã hủy ghép chứng từ và cập nhật số tiền còn lại."); setSelectedId(""); reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không hủy ghép được chứng từ."); }
    finally { setBusy(false); }
  };
  const exportExcel = async () => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/bank/statement-lines/export/?${query}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Không xuất được danh sách sao kê.");
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
      link.href = url; link.download = "giao-dich-sao-ke.xlsx"; link.click(); URL.revokeObjectURL(url);
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Không xuất được danh sách sao kê."); }
  };
  return <section className="br-table br-statement-manager" aria-label="Quản lý giao dịch sao kê">
    <h3>Giao dịch sao kê</h3>
    <div className="br-statement-filters">
      <label>Chi nhánh<select value={branch} onChange={(event) => setBranch(event.target.value)}><option value="">Tất cả</option>{Array.from(new Map(profiles.filter((profile) => profile.branch_id).map((profile) => [profile.branch_id, profile.branch_name || profile.branch_id])).entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Kỳ sao kê<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="">Tất cả</option>{Array.from(new Map(lines.filter((line) => !account || line.account === account).map((line) => [line.statement, `${line.period_from} → ${line.period_to} · ${line.source_reference}`])).entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Từ ngày<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
      <label>Đến ngày<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
      <label>Chiều giao dịch<select value={direction} onChange={(event) => setDirection(event.target.value)}><option value="">Tất cả</option><option value="CREDIT">Thu</option><option value="DEBIT">Chi</option></select></label>
      <label>Trạng thái ghép<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả</option><option value="UNMATCHED">Chưa ghép</option><option value="PARTIALLY_MATCHED">Ghép một phần</option><option value="MATCHED">Đã ghép</option></select></label>
      <label>Nguồn<select value={source} onChange={(event) => setSource(event.target.value)}><option value="">Tất cả</option><option value="FILE">Nhập từ tệp</option><option value="CONNECTOR">Đồng bộ ngân hàng</option></select></label>
      <label>Loại tiền<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="">Tất cả</option>{[...new Set(lines.map((line) => line.currency_code).filter(Boolean))].map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
      <label>Theo dõi<select value={trackingFilter} onChange={(event) => setTrackingFilter(event.target.value)}><option value="">Tất cả</option><option value="NORMAL">Bình thường</option><option value="NEEDS_REVIEW">Cần kiểm tra</option><option value="WAITING">Chờ xử lý</option></select></label>
      <label>Tìm kiếm<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Mã GD, tham chiếu, nội dung" /></label>
      <button onClick={() => void exportExcel()} disabled={!account}>Xuất Excel</button>
    </div>
    {!account ? <p className="br-statement-empty">Vui lòng chọn tài khoản ngân hàng.</p> : dateFrom && dateTo && dateFrom > dateTo ? <p role="alert" className="br-error">Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.</p> : <>
      <p className="br-statement-summary">{filtered.length} giao dịch · Tổng thu: <strong>{money(receipts)}</strong> · Tổng chi: <strong>{money(payments)}</strong></p>
      <table><thead><tr><th>Ngày GD</th><th>Mã GD</th><th>Tham chiếu</th><th>Nội dung</th><th>Đối tác</th><th>Thu</th><th>Chi</th><th>Đã khớp</th><th>Chưa khớp</th><th>Loại tiền</th><th>Trạng thái ghép</th><th>Theo dõi</th><th></th></tr></thead><tbody>
        {filtered.map((line) => <tr key={line.id}><td>{line.transaction_date}</td><td>{line.external_id}</td><td>{line.reference}</td><td>{line.description}</td><td>{line.counterparty}</td><td>{line.direction === "CREDIT" ? money(line.amount) : ""}</td><td>{line.direction === "DEBIT" ? money(line.amount) : ""}</td><td>{money(line.matched_amount)}</td><td>{money(line.remaining_amount)}</td><td>{line.currency_code || ""}</td><td>{matchLabel[line.match_status] || line.match_status}</td><td>{line.tracking_status === "WAITING" ? "Chờ xử lý" : line.tracking_status === "NEEDS_REVIEW" ? "⚠ Cần kiểm tra" : "Bình thường"}</td><td><button onClick={() => open(line)}>Chi tiết</button></td></tr>)}
        {!filtered.length && <tr><td colSpan={13}>Không có giao dịch phù hợp với điều kiện tìm kiếm.</td></tr>}
      </tbody></table>
    </>}
    {selected && <div className="br-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(""); }}><div className="br-statement-detail" role="dialog" aria-modal="true" aria-label="Chi tiết giao dịch sao kê">
      <header><h3>Chi tiết giao dịch sao kê</h3><button onClick={() => setSelectedId("")} aria-label="Đóng">×</button></header>
      <dl><div><dt>Tài khoản ngân hàng</dt><dd>{selected.account_number}</dd></div><div><dt>Ngày giao dịch / giá trị</dt><dd>{selected.transaction_date} / {selected.value_date || "—"}</dd></div><div><dt>Mã GD / tham chiếu</dt><dd>{selected.external_id} / {selected.reference || "—"}</dd></div><div><dt>Nội dung gốc</dt><dd>{selected.description}</dd></div><div><dt>Đối tác</dt><dd>{selected.counterparty || "—"}</dd></div><div><dt>Số tiền</dt><dd>{selected.direction === "CREDIT" ? "Thu" : "Chi"} {money(selected.amount)}</dd></div><div><dt>Nguồn</dt><dd>{selected.source === "FILE" ? `Tệp ${selected.file_name || selected.source_reference}` : "Đồng bộ ngân hàng"}{selected.raw_data?.source_row ? ` · dòng ${selected.raw_data.source_row}` : ""}</dd></div><div><dt>Kỳ sao kê</dt><dd>{selected.period_from} → {selected.period_to} · {selected.period_confirmed ? "Đã xác nhận" : "Chưa xác nhận"}</dd></div><div><dt>Trạng thái ghép</dt><dd>{matchLabel[selected.match_status] || selected.match_status}</dd></div><div><dt>Đã ghép / còn lại</dt><dd>{money(selected.matched_amount)} / {money(selected.remaining_amount)}</dd></div></dl>
      <h4>Chứng từ đã ghép</h4>{selected.linked_vouchers?.length ? <ul>{selected.linked_vouchers.map((voucher: Line) => <li key={voucher.link_id || voucher.id}>{voucher.number} · đã ghép {money(voucher.amount)} · còn {money(voucher.voucher_remaining_amount)} · {voucher.gl_status === "POSTED" ? "Đã ghi sổ" : "Chưa ghi sổ"}{!selected.period_confirmed && voucher.link_id && <button disabled={busy} onClick={() => void unmatch(voucher)}>Hủy ghép</button>}</li>)}</ul> : <p>Chưa ghép chứng từ.</p>}
      <label>Ghi chú xử lý<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <label>Trạng thái theo dõi<select value={tracking} onChange={(event) => setTracking(event.target.value)}><option value="NORMAL">Bình thường</option><option value="NEEDS_REVIEW">Cần kiểm tra</option><option value="WAITING">Chờ xử lý</option></select></label>
      {(tracking === "NEEDS_REVIEW" || tracking === "WAITING") && <label>Lý do cần kiểm tra / chờ xử lý<input value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} /></label>}
      <p>Cập nhật gần nhất: {selected.updated_at ? new Date(selected.updated_at).toLocaleString("vi-VN") : "—"}</p>
      {selected.source === "FILE" && selected.match_status === "UNMATCHED" && !selected.period_confirmed && <label>Lý do xóa giao dịch nhập sai<input value={removeReason} onChange={(event) => setRemoveReason(event.target.value)} /></label>}
      {error && <p role="alert" className="br-error">{error}</p>}
      <footer><button onClick={() => setSelectedId("")}>Đóng</button>{!selected.period_confirmed && Number(selected.remaining_amount) > 0 && <><button onClick={() => { onMatch?.(selected); setSelectedId(""); }}>Ghép chứng từ</button><button onClick={() => { onCreateVoucher?.(selected.direction === "CREDIT" ? "receipt" : "payment", { account: selected.account, accountNumber: selected.account_number || "", date: selected.transaction_date, amount: Number(selected.remaining_amount), description: selected.description || "", counterparty: selected.counterparty || "", counterpartyAccount: selected.raw_data?.counterparty_account || "", reference: selected.reference || "" }); setSelectedId(""); }}>Lập chứng từ</button></>}{selected.source === "FILE" && selected.match_status === "UNMATCHED" && !selected.period_confirmed && <button disabled={busy} onClick={() => void remove()}>Xóa giao dịch</button>}<button className="br-primary" disabled={busy || selected.period_confirmed} onClick={() => void save()}>Lưu</button></footer>
    </div></div>}
  </section>;
}
