import { useEffect, useMemo, useState } from "react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";

type Candidate = { id: string; number: string; transaction_date: string; transaction_type: string;
  counterparty_name: string; description: string; bank_reference: string; amount: string;
  remaining_amount: string; score: number };
type Allocation = { transaction: string; matched_amount: string; expected_transaction_remaining: string };
const money = (value: unknown) => Number(value || 0).toLocaleString("vi-VN");

export default function BankMatchDialog({ line, companyId, branchId, onClose, onSaved, notify }: {
  line: Record<string, any>; companyId: string; branchId?: string; onClose: () => void;
  onSaved: () => void; notify: (message: string) => void;
}) {
  const { token } = useApiSession();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [lineRemaining, setLineRemaining] = useState(Number(line.remaining_amount || 0));
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const query = new URLSearchParams({ company_id: companyId, statement_line: line.id,
    ...(branchId && { branch_id: branchId }) });
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    request<{ remaining_amount: string; candidates: Candidate[] }>(`/api/v1/bank/reconciliations/candidates/?${query}`, token)
      .then((data) => { if (active) { setCandidates(data.candidates); setLineRemaining(Number(data.remaining_amount)); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Không tải được chứng từ."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, line.id, branchId, token, revision]);
  const filtered = useMemo(() => candidates.filter((candidate) => [candidate.number, candidate.counterparty_name,
    candidate.description, candidate.bank_reference].some((value) => String(value || "").toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")))), [candidates, search]);
  const total = allocations.reduce((sum, entry) => sum + Number(entry.matched_amount || 0), 0);
  const toggle = (candidate: Candidate) => {
    if (allocations.some((entry) => entry.transaction === candidate.id)) {
      setAllocations((current) => current.filter((entry) => entry.transaction !== candidate.id)); return;
    }
    const proposed = Math.max(0, Math.min(lineRemaining - total, Number(candidate.remaining_amount)));
    setAllocations((current) => [...current, { transaction: candidate.id,
      matched_amount: String(proposed), expected_transaction_remaining: candidate.remaining_amount }]);
  };
  const save = async () => {
    if (!token || saving) return;
    if (!allocations.length) { setError("Vui lòng chọn ít nhất một chứng từ."); return; }
    if (allocations.some((entry) => !(Number(entry.matched_amount) > 0) || Number(entry.matched_amount) > Number(entry.expected_transaction_remaining)) || total > lineRemaining) {
      setError("Số tiền ghép vượt quá số tiền còn được phép đối chiếu."); return;
    }
    setSaving(true); setError("");
    try {
      await request(`/api/v1/bank/reconciliations/match-batch/?company_id=${encodeURIComponent(companyId)}${branchId ? `&branch_id=${encodeURIComponent(branchId)}` : ""}`, token, {
        method: "POST", body: JSON.stringify({ statement_line: line.id, expected_line_remaining: String(lineRemaining), allocations }),
      });
      notify("Ghép giao dịch với chứng từ thành công."); onSaved(); onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Không thể lưu kết quả ghép chứng từ.";
      setError(message);
      if (message.includes("đã thay đổi")) { setAllocations([]); setRevision((current) => current + 1); }
    }
    finally { setSaving(false); }
  };
  return <div className="br-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="br-match-dialog" role="dialog" aria-modal="true" aria-label="Ghép chứng từ">
      <header><h3>Ghép chứng từ</h3><button onClick={onClose} aria-label="Đóng">×</button></header>
      <div className="br-match-context">
        <span><strong>Giao dịch:</strong> {line.external_id} · {line.transaction_date}</span>
        <span><strong>Tài khoản:</strong> {line.account_number}</span>
        <span><strong>Nội dung:</strong> {line.description}</span>
        <span><strong>Số tiền:</strong> {money(line.amount)} {line.currency_code}</span>
        <span><strong>Chưa khớp:</strong> {money(lineRemaining)} {line.currency_code}</span>
      </div>
      <label className="br-match-search">Tìm chứng từ
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Số chứng từ, đối tượng, diễn giải" />
      </label>
      {loading ? <p>Đang tải chứng từ đủ điều kiện…</p> : <div className="br-match-table"><table><thead><tr>
        <th>Chọn</th><th>Ngày hạch toán</th><th>Số chứng từ</th><th>Loại</th><th>Đối tượng</th><th>Diễn giải</th><th>Số tiền</th><th>Còn được ghép</th><th>Số tiền ghép</th>
      </tr></thead><tbody>
        {filtered.map((candidate) => {
          const allocation = allocations.find((entry) => entry.transaction === candidate.id);
          return <tr key={candidate.id}><td><input type="checkbox" aria-label={`Chọn chứng từ ${candidate.number}`} checked={Boolean(allocation)} onChange={() => toggle(candidate)} /></td>
            <td>{candidate.transaction_date}</td><td>{candidate.number}</td><td>{["RECEIPT", "INTEREST", "OTHER_IN"].includes(candidate.transaction_type) ? "Thu" : "Chi"}</td>
            <td>{candidate.counterparty_name}</td><td>{candidate.description}</td><td className="br-number">{money(candidate.amount)}</td><td className="br-number">{money(candidate.remaining_amount)}</td>
            <td>{allocation && <input aria-label={`Số tiền ghép ${candidate.number}`} type="number" min="0.0001" max={candidate.remaining_amount} step="0.0001" value={allocation.matched_amount}
              onChange={(event) => setAllocations((current) => current.map((entry) => entry.transaction === candidate.id ? { ...entry, matched_amount: event.target.value } : entry))} />}</td></tr>;
        })}
        {!filtered.length && <tr><td colSpan={9}>Không có chứng từ đủ điều kiện phù hợp.</td></tr>}
      </tbody></table></div>}
      <p className="br-match-total">Đã chọn {allocations.length} chứng từ · Tổng ghép <strong>{money(total)}</strong> / còn lại <strong>{money(lineRemaining)}</strong></p>
      {error && <p role="alert" className="br-error">{error}</p>}
      <footer><button onClick={() => { setAllocations([]); setRevision((current) => current + 1); }}>Tải lại</button><button onClick={onClose}>Hủy</button><button className="br-primary" disabled={saving || loading || !allocations.length} onClick={() => void save()}>{saving ? "Đang ghép…" : "Xác nhận ghép"}</button></footer>
    </div>
  </div>;
}
