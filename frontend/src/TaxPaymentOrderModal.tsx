import { useEffect, useState } from "react";
import { request } from "./live-api";
import { errorText } from "./misa-api-writes";
import type { TaxObligationRow } from "./TaxObligationPanel";

const money = (value: number | string) => Number(value).toLocaleString("vi-VN");
type Entry = { selected: boolean; amount: string; content: string; subitem_code: string };

export default function TaxPaymentOrderModal({ companyId, token, obligations, initialId, onClose, onSaved, notify }: {
  companyId: string; token?: string; obligations: TaxObligationRow[]; initialId?: string;
  onClose: () => void; onSaved: () => void; notify: (message: string) => void;
}) {
  const [entries, setEntries] = useState<Record<string, Entry>>(() => Object.fromEntries(obligations.map((row) => [row.id, {
    selected: row.id === initialId, amount: row.id === initialId ? String(row.outstanding_amount) : "",
    content: "", subitem_code: "",
  }])));
  const [method, setMethod] = useState("BANK");
  const [treasury, setTreasury] = useState("");
  const [account, setAccount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const obligationIds = obligations.map((row) => row.id).join("|");
  useEffect(() => {
    setEntries((current) => {
      const next = { ...current };
      for (const row of obligations) {
        if (!next[row.id]) next[row.id] = { selected: row.id === initialId,
          amount: row.id === initialId ? String(row.outstanding_amount) : "", content: "", subitem_code: "" };
      }
      return next;
    });
  }, [obligationIds, initialId]);
  const selected = obligations.filter((row) => entries[row.id]?.selected);
  const total = selected.reduce((sum, row) => sum + Number(entries[row.id].amount || 0), 0);
  const patch = (id: string, change: Partial<Entry>) => setEntries((current) => ({ ...current,
    [id]: { ...current[id], ...change },
  }));
  const save = async () => {
    if (!token || busy) return;
    setBusy(true);
    try {
      const order = await request<{ number: string; total_amount: string }>(`/api/v1/tax/payment-orders/?company_id=${encodeURIComponent(companyId)}`,
        token, { method: "POST", body: JSON.stringify({ company: companyId, idempotency_key: key,
          payment_method: method, treasury, treasury_account: account, payment_date: paymentDate,
          lines: selected.map((row) => ({ obligation: row.id, amount: entries[row.id].amount,
            content: entries[row.id].content, subitem_code: entries[row.id].subitem_code })),
        }) });
      notify(`Đã lập giấy ${order.number} với ${money(order.total_amount)} đ ở trạng thái nháp. Chưa ghi nhận đã nộp.`);
      onSaved(); onClose();
    } catch (error) { notify(`Không lập được giấy nộp tiền: ${errorText(error)}`); }
    finally { setBusy(false); }
  };
  return <div className="misa-modal-overlay"><div role="dialog" aria-label="Lập Giấy nộp tiền vào Ngân sách Nhà nước" className="misa-modal-card"
    style={{ width: 780, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto" }}>
    <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
      <strong style={{ color: "#1e293b" }}>Lập Giấy nộp tiền vào Ngân sách Nhà nước (NSNN)</strong>
      <button type="button" onClick={onClose} aria-label="Đóng">×</button>
    </div>
    <div style={{ padding: 20, fontSize: 13 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <label>Phương thức nộp<select aria-label="Phương thức nộp" value={method} onChange={(e) => setMethod(e.target.value)} style={{ display: "block", width: "100%", height: 34 }}>
          <option value="BANK">Ủy nhiệm chi chuyển khoản</option><option value="CASH">Tiền mặt</option><option value="ELECTRONIC">Điện tử</option>
        </select></label>
        <label>Ngày lập giấy<input aria-label="Ngày lập giấy" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} style={{ display: "block", width: "100%", height: 32 }} /></label>
        <label>Kho bạc Nhà nước hạch toán<input aria-label="Kho bạc Nhà nước hạch toán" value={treasury} onChange={(e) => setTreasury(e.target.value)} style={{ display: "block", width: "100%", height: 32 }} /></label>
        <label>Tài khoản thu NSNN<input aria-label="Tài khoản thu NSNN" value={account} onChange={(e) => setAccount(e.target.value)} style={{ display: "block", width: "100%", height: 32 }} /></label>
      </div>
      <p style={{ color: "#64748b" }}>Nhập Kho bạc, tài khoản thu và tiểu mục theo thông tin đã xác minh. Không có mã demo được tự điền.</p>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "#e2ede6", height: 36 }}><th>Chọn</th><th>Nghĩa vụ</th><th>Nội dung nộp NSNN</th><th>Tiểu mục</th><th>Số tiền</th></tr></thead>
        <tbody>{obligations.map((row) => <tr key={row.id} style={{ borderTop: "1px solid #e2e8f0", height: 42 }}>
          <td><input type="checkbox" aria-label={`Chọn ${row.tax_type} ${row.period_code}`} checked={entries[row.id]?.selected || false}
            onChange={(e) => patch(row.id, { selected: e.target.checked, amount: e.target.checked ? String(row.outstanding_amount) : "" })} /></td>
          <td>{row.tax_type} · {row.period_code}<br /><small>Còn {money(row.outstanding_amount)} đ</small></td>
          <td><input aria-label={`Nội dung ${row.period_code}`} value={entries[row.id]?.content || ""} disabled={!entries[row.id]?.selected}
            onChange={(e) => patch(row.id, { content: e.target.value })} style={{ width: "100%" }} /></td>
          <td><input aria-label={`Tiểu mục ${row.period_code}`} value={entries[row.id]?.subitem_code || ""} disabled={!entries[row.id]?.selected}
            onChange={(e) => patch(row.id, { subitem_code: e.target.value })} style={{ width: 80 }} /></td>
          <td><input aria-label={`Số tiền ${row.period_code}`} type="number" min="0" max={row.outstanding_amount} value={entries[row.id]?.amount || ""}
            disabled={!entries[row.id]?.selected} onChange={(e) => patch(row.id, { amount: e.target.value })} style={{ width: 120 }} /></td>
        </tr>)}</tbody>
      </table></div>
      <div style={{ textAlign: "right", marginTop: 14, fontWeight: 700 }}>Tổng số tiền nộp: {money(total)} đ</div>
      <p style={{ color: "#a16207" }}>Lập giấy chỉ lưu chứng từ nháp. Số đã nộp không thay đổi cho đến khi có xác nhận thanh toán hợp lệ.</p>
    </div>
    <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "end", gap: 8 }}>
      <button type="button" onClick={onClose}>Hủy</button>
      <button type="button" disabled={busy || !selected.length || total <= 0} onClick={() => void save()}
        style={{ border: 0, borderRadius: 4, background: "#00a862", color: "white", padding: "8px 16px" }}>Lập giấy nộp tiền</button>
    </div>
  </div></div>;
}
