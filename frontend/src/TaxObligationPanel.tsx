import { useCallback, useEffect, useState } from "react";
import { request } from "./live-api";
import { errorText } from "./misa-api-writes";

export type TaxObligationRow = {
  id: string; tax_type: string; period_code: string; due_date: string; due_status: string;
  due_days: number; assessed_amount: string; adjustment_amount: string; paid_amount: string;
  outstanding_amount: string; status: string; source_declaration?: string | null; basis_status: string; reason: string;
};
type Declaration = { id: string; period_code: string; form_code: string; preparation_status: string;
  source_is_current: boolean; indicators: Record<string, string> };
type Order = { id: string; number: string; status: string; total_amount: string; payment_method: string;
  lines: { obligation: string; amount: string }[] };
const rows = <T,>(data: T[] | { results: T[] }): T[] => Array.isArray(data) ? data : data.results || [];
const money = (value: string | number) => Number(value).toLocaleString("vi-VN");
const buttonStyle = { border: "1px solid #00a862", borderRadius: 4, padding: "7px 12px", color: "#008a50", background: "white", cursor: "pointer" };

export default function TaxObligationPanel({ companyId, token, notify, onPay, reloadKey }: {
  companyId: string; token?: string; notify: (message: string) => void;
  onPay: (obligation: TaxObligationRow, candidates: TaxObligationRow[]) => void; reloadKey: number;
}) {
  const [obligations, setObligations] = useState<TaxObligationRow[]>([]);
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [declarationId, setDeclarationId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selected, setSelected] = useState<TaxObligationRow | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const base = `?company_id=${encodeURIComponent(companyId)}`;
  const load = useCallback(async () => {
    if (!token || !companyId) return;
    try {
      const [obligationData, declarationData, orderData] = await Promise.all([
        request<TaxObligationRow[] | { results: TaxObligationRow[] }>(`/api/v1/tax/obligations/${base}`, token),
        request<Declaration[] | { results: Declaration[] }>(`/api/v1/tax/declarations/${base}`, token),
        request<Order[] | { results: Order[] }>(`/api/v1/tax/payment-orders/${base}`, token),
      ]);
      setObligations(rows(obligationData)); setDeclarations(rows(declarationData)); setOrders(rows(orderData));
    } catch (error) { notify(`Không tải được nghĩa vụ thuế: ${errorText(error)}`); }
  }, [companyId, token]);
  useEffect(() => { void load(); }, [load, reloadKey]);
  const ready = declarations.filter((row) => row.form_code === "01/GTGT" && row.preparation_status === "READY_TO_SUBMIT"
    && row.source_is_current && Number(row.indicators.payable) > 0
    && !obligations.some((obligation) => obligation.source_declaration === row.id));
  const visible = obligations.filter((row) => filter === "ALL" || row.tax_type === filter);
  const total = visible.reduce((sum, row) => sum + Number(row.outstanding_amount), 0);
  const recognize = async () => {
    if (!declarationId || !dueDate || !token || busy) { notify("Chọn hồ sơ và hạn nộp theo căn cứ đã xác minh."); return; }
    setBusy(true);
    try {
      await request(`/api/v1/tax/obligations/recognize/${base}`, token, { method: "POST",
        body: JSON.stringify({ company: companyId, declaration: declarationId, due_date: dueDate }) });
      setDeclarationId(""); setDueDate(""); await load(); notify("Đã ghi nhận nghĩa vụ theo hồ sơ xác nhận nội bộ.");
    } catch (error) { notify(`Không ghi nhận được nghĩa vụ: ${errorText(error)}`); }
    finally { setBusy(false); }
  };
  const cancelOrder = async (order: Order) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await request(`/api/v1/tax/payment-orders/${order.id}/cancel/${base}`, token, {
        method: "POST", body: JSON.stringify({}),
      });
      await load(); notify(`Đã hủy giấy nháp ${order.number}.`);
    } catch (error) { notify(`Không hủy được giấy: ${errorText(error)}`); }
    finally { setBusy(false); }
  };
  return <section style={{ gridColumn: "1 / -1", background: "white", border: "1px solid #cbd5e1", borderRadius: 6, padding: 20 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 20, color: "#1e293b" }}>Nghĩa vụ thuế</h2>
      <button type="button" style={buttonStyle} onClick={() => void load()}>Tải lại</button>
    </div>
    <p style={{ margin: "8px 0 14px", fontSize: 13, color: "#64748b" }}>Còn phải nộp: <strong>{money(total)} đ</strong> · Giấy nộp nháp chưa được tính là đã nộp.</p>
    <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginBottom: 14, fontSize: 13 }}>
      <label>Hồ sơ 01/GTGT đã xác nhận<select aria-label="Hồ sơ nguồn" value={declarationId} onChange={(e) => setDeclarationId(e.target.value)}
        style={{ display: "block", height: 34, minWidth: 220, border: "1px solid #cbd5e1", borderRadius: 4 }}>
        <option value="">Chọn hồ sơ</option>{ready.map((row) => <option key={row.id} value={row.id}>{row.period_code} · {money(row.indicators.payable)} đ</option>)}
      </select></label>
      <label>Hạn nộp theo căn cứ<input aria-label="Hạn nộp" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
        style={{ display: "block", height: 32, border: "1px solid #cbd5e1", borderRadius: 4 }} /></label>
      <button type="button" disabled={!declarationId || !dueDate || busy} onClick={() => void recognize()}
        style={{ ...buttonStyle, background: "#00a862", color: "white" }}>Ghi nhận nghĩa vụ</button>
      <label>Loại thuế<select aria-label="Lọc loại thuế" value={filter} onChange={(e) => setFilter(e.target.value)}
        style={{ display: "block", height: 34, border: "1px solid #cbd5e1", borderRadius: 4 }}>
        <option value="ALL">Tất cả</option><option value="VAT">GTGT</option><option value="CIT">TNDN</option>
      </select></label>
    </div>
    <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: 4 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ background: "#e2ede6", height: 36 }}><th>Loại</th><th>Kỳ</th><th>Hạn nộp</th><th>Phải nộp</th><th>Đã nộp</th><th>Còn lại</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>{visible.map((row) => <tr key={row.id} style={{ borderTop: "1px solid #e2e8f0", height: 38, textAlign: "center" }}>
        <td>{row.tax_type}</td><td>{row.period_code}</td><td>{row.due_date}</td>
        <td>{money(Number(row.assessed_amount) + Number(row.adjustment_amount))}</td><td>{money(row.paid_amount)}</td>
        <td>{money(row.outstanding_amount)}</td><td>{row.due_status === "OVERDUE" ? `Quá hạn ${row.due_days} ngày` : row.status === "PAID" ? "Đã nộp" : row.status === "PARTIAL" ? "Nộp một phần" : "Còn phải nộp"}</td>
        <td><button type="button" style={buttonStyle} onClick={() => setSelected(row)}>Xem</button>{Number(row.outstanding_amount) > 0 && <button type="button" style={{ ...buttonStyle, marginLeft: 6 }} onClick={() => onPay(row, obligations.filter((item) => Number(item.outstanding_amount) > 0))}>Nộp thuế</button>}</td>
      </tr>)}{!visible.length && <tr><td colSpan={8} style={{ padding: 18, textAlign: "center", color: "#64748b" }}>Chưa có nghĩa vụ thuế</td></tr>}</tbody>
    </table></div>
    {selected && <div role="region" aria-label="Chi tiết nghĩa vụ thuế" style={{ marginTop: 12, padding: 14, border: "1px solid #cbd5e1", fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><strong>{selected.tax_type} · {selected.period_code}</strong><button type="button" onClick={() => setSelected(null)}>Đóng</button></div>
      <p>Căn cứ: {selected.basis_status === "INTERNAL_CONFIRMED" ? "Hồ sơ xác nhận nội bộ, chưa có kết quả chấp nhận của cơ quan thuế" : "Nguồn cũ hoặc khác"}</p>
      <p>Nguồn: {selected.source_declaration ? `Hồ sơ kê khai ${selected.source_declaration}` : selected.reason || "Chưa có tham chiếu hồ sơ"}</p>
      <p>Hạn nộp: {selected.due_date} · Còn phải nộp: {money(selected.outstanding_amount)} đ</p>
      <strong>Giấy nộp tiền liên quan</strong>
      {orders.filter((order) => order.lines.some((line) => line.obligation === selected.id)).map((order) => <div key={order.id}>{order.number} · {money(order.total_amount)} đ · {order.status === "DRAFT" ? "Nháp, chưa ghi nhận đã nộp" : order.status}</div>)}
    </div>}
    <h3 style={{ fontSize: 15, marginBottom: 8 }}>Giấy nộp tiền đã lập</h3>
    {orders.length ? orders.map((order) => <div key={order.id} style={{ padding: "7px 0", borderTop: "1px solid #e2e8f0", fontSize: 13 }}>
      {order.number} · {money(order.total_amount)} đ · {order.status === "DRAFT" ? "Nháp, chưa thanh toán" : order.status}
      {order.status === "DRAFT" && <button type="button" disabled={busy} onClick={() => void cancelOrder(order)}
        style={{ ...buttonStyle, marginLeft: 12 }}>Hủy giấy nháp</button>}
    </div>) : <p style={{ fontSize: 13, color: "#64748b" }}>Chưa có giấy nộp tiền.</p>}
  </section>;
}
