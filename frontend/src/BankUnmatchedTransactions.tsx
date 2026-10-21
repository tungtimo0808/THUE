import { useEffect, useState } from "react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";

type Item = { kind: "STATEMENT" | "VOUCHER"; id: string; date: string; code: string; reference: string;
  description: string; counterparty: string; account: string; account_number: string; direction: "CREDIT" | "DEBIT";
  amount: string; matched_amount: string; remaining_amount: string; currency: string; linked_vouchers: string[];
  cause: string; processing_status: string; reason: string; note: string; updated_at: string | null;
  duplicate_count: number; duplicates?: string[]; candidate_count: number; period_confirmed: boolean };
const money = (value: unknown) => Number(value || 0).toLocaleString("vi-VN");
const statusLabel: Record<string, string> = { UNMATCHED: "Chưa khớp", PARTIALLY_MATCHED: "Khớp một phần", WAITING: "Chờ xử lý" };

export default function BankUnmatchedTransactions({ companyId, account, dateFrom, dateTo, branchId, revision, statementLines,
  onMatch, onCreateVoucher, onOpenVoucher, onChanged, notify }: { companyId: string; account: string; dateFrom: string; dateTo: string;
  branchId?: string; revision: number; statementLines: Record<string, any>[];
  onMatch: (line: Record<string, any>) => void;
  onOpenVoucher?: (id: string, code: string) => void;
  onChanged: () => void;
  onCreateVoucher?: (kind: "receipt" | "payment", line: { account: string; accountNumber: string; date: string; amount: number;
    description: string; counterparty: string; counterpartyAccount: string; reference: string }) => void;
  notify: (message: string) => void;
}) {
  const { token } = useApiSession();
  const [data, setData] = useState<{ has_statement: boolean; items: Item[] } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [selectedKind, setSelectedKind] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [show, setShow] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const selected = data?.items.find((item) => item.id === selectedId && item.kind === selectedKind);
  useEffect(() => {
    if (!show || !token) return;
    let active = true;
    const query = new URLSearchParams({ company_id: companyId, account, date_from: dateFrom, date_to: dateTo,
      ...(branchId && { branch_id: branchId }) });
    setLoading(true);
    request<{ has_statement: boolean; items: Item[] }>(`/api/v1/bank/unmatched/items/?${query}`, token)
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Không tải được giao dịch chưa khớp."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [show, token, companyId, account, dateFrom, dateTo, branchId, revision, refresh]);
  const markWaiting = async () => {
    if (!selected || !token || saving) return;
    if (!reason.trim()) { setError("Vui lòng nhập lý do chờ xử lý."); return; }
    setSaving(true); setError("");
    try {
      await request(`/api/v1/bank/unmatched/mark-waiting/?company_id=${encodeURIComponent(companyId)}${branchId ? `&branch_id=${encodeURIComponent(branchId)}` : ""}`, token, {
        method: "POST", body: JSON.stringify({ kind: selected.kind, id: selected.id, reason, note }),
      });
      notify("Đã lưu trạng thái chờ xử lý."); setSelectedId(""); onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không lưu được kết quả xử lý."); }
    finally { setSaving(false); }
  };
  return <section className="br-table br-unmatched" aria-label="Giao dịch chưa khớp">
    <div className="br-unmatched-heading"><h3>Giao dịch chưa khớp</h3><button onClick={() => setShow((value) => !value)}>{show ? "Thu gọn" : "Xem giao dịch chưa khớp"}</button></div>
    {show && <>
      <div className="br-unmatched-tools"><span>{data?.items.length || 0} giao dịch cần xử lý</span><button onClick={() => setRefresh((value) => value + 1)}>Tải lại</button></div>
      {loading && <p>Đang tải giao dịch chưa khớp…</p>}
      {error && !selected && <p role="alert" className="br-error">{error}</p>}
      {data && !data.has_statement && <p className="br-statement-empty">Chưa có dữ liệu sao kê ngân hàng trong kỳ đối chiếu.</p>}
      <table><thead><tr><th>Nguồn</th><th>Ngày giao dịch</th><th>Mã giao dịch</th><th>Nội dung giao dịch</th><th>Thu</th><th>Chi</th><th>Chứng từ liên quan</th><th>Nguyên nhân chưa khớp</th><th>Trạng thái xử lý</th><th></th></tr></thead><tbody>
        {(data?.items || []).map((item) => <tr key={`${item.kind}:${item.id}`}><td>{item.kind === "STATEMENT" ? "Sao kê" : "Chứng từ"}</td>
          <td>{item.date.split("-").reverse().join("/")}</td><td>{item.code}</td><td>{item.description}</td>
          <td className="br-number">{item.direction === "CREDIT" ? money(item.amount) : ""}</td>
          <td className="br-number">{item.direction === "DEBIT" ? money(item.amount) : ""}</td>
          <td>{item.linked_vouchers.join(", ") || "—"}</td><td>{item.cause}</td>
          <td>{statusLabel[item.processing_status] || item.processing_status}</td>
          <td><button onClick={() => { setSelectedId(item.id); setSelectedKind(item.kind); setReason(item.reason || ""); setNote(item.note || ""); setShowDuplicates(false); setError(""); }}>Xử lý</button></td></tr>)}
        {data && !data.items.length && <tr><td colSpan={10}>Không còn giao dịch chưa khớp trong kỳ.</td></tr>}
      </tbody></table>
    </>}
    {selected && <div className="br-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(""); }}>
      <div className="br-statement-detail" role="dialog" aria-modal="true" aria-label="Xử lý giao dịch chưa khớp">
        <header><h3>Xử lý giao dịch chưa khớp</h3><button aria-label="Đóng" onClick={() => setSelectedId("")}>×</button></header>
        <dl><div><dt>Nguồn / tài khoản</dt><dd>{selected.kind === "STATEMENT" ? "Sao kê" : "Chứng từ"} · {selected.account_number}</dd></div>
          <div><dt>Mã / ngày giao dịch</dt><dd>{selected.code} · {selected.date.split("-").reverse().join("/")}</dd></div>
          <div><dt>Chiều / số tiền</dt><dd>{selected.direction === "CREDIT" ? "Thu" : "Chi"} {money(selected.amount)} {selected.currency}</dd></div>
          <div><dt>Đã khớp / còn lại</dt><dd>{money(selected.matched_amount)} / {money(selected.remaining_amount)}</dd></div>
          <div><dt>Tham chiếu</dt><dd>{selected.reference || "—"}</dd></div>
          <div><dt>Đối tượng</dt><dd>{selected.counterparty || "—"}</dd></div>
          <div><dt>Nguyên nhân gợi ý</dt><dd>{selected.cause}</dd></div>
          <div><dt>Trạng thái</dt><dd>{statusLabel[selected.processing_status] || selected.processing_status}</dd></div></dl>
        <p>{selected.description}</p>
        <p>Chứng từ/giao dịch đã liên kết: {selected.linked_vouchers.join(", ") || "Chưa có"}</p>
        <p>Gợi ý ghép: {selected.candidate_count} · Bản ghi sao kê tương tự: {selected.duplicate_count}</p>
        <button onClick={() => setShowDuplicates((value) => !value)}>Kiểm tra trùng</button>
        {showDuplicates && <p>{selected.duplicates?.length ? `Bản ghi có tham chiếu hoặc ngày/số tiền/nội dung tương tự: ${selected.duplicates.join(", ")}. Hãy kiểm tra trước khi xử lý bản ghi.` : "Chưa phát hiện bản ghi tương tự trong tài khoản và kỳ đang xem."}</p>}
        <label>Lý do chờ xử lý *<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <label>Ghi chú xử lý<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
        {selected.updated_at && <p>Cập nhật gần nhất: {new Date(selected.updated_at).toLocaleString("vi-VN")}</p>}
        {error && <p role="alert" className="br-error">{error}</p>}
        <footer><button onClick={() => setSelectedId("")}>Đóng</button>
          {selected.kind === "STATEMENT" && !selected.period_confirmed && <>
            <button onClick={() => { const line = statementLines.find((row) => row.id === selected.id); if (line) onMatch(line); setSelectedId(""); }}>Ghép chứng từ</button>
            <button onClick={() => { onCreateVoucher?.(selected.direction === "CREDIT" ? "receipt" : "payment", {
              account: selected.account, accountNumber: selected.account_number, date: selected.date,
              amount: Number(selected.remaining_amount), description: selected.description, counterparty: selected.counterparty,
              counterpartyAccount: "", reference: selected.reference,
            }); setSelectedId(""); }}>Lập chứng từ</button>
          </>}
          {selected.kind === "VOUCHER" && onOpenVoucher && <button onClick={() => onOpenVoucher(selected.id, selected.code)}>Mở chứng từ</button>}
          <button className="br-primary" disabled={saving || selected.period_confirmed} onClick={() => void markWaiting()}>{saving ? "Đang lưu…" : "Chờ xử lý"}</button>
        </footer>
      </div>
    </div>}
  </section>;
}
