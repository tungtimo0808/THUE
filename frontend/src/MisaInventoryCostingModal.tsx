import { useEffect, useState } from "react";
import { Calculator, X } from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { errorText } from "./misa-api-writes";
import "./misa-inventory-costing.css";

type Option = { id: string; code: string; name: string };
type Period = { id: string; code: string; from: string; to: string; status: string };
type Methods = { code: string; name: string };
type Options = { warehouses: Option[]; periods: Period[]; methods: Methods[]; default_method: string };
type Run = { id: string; valuation_date: string; warehouse: string | null; method: string; status: string;
  details: { period_start?: string; updated_lines?: number; adjustments?: number; recalculated?: boolean };
  created_at: string };

export default function MisaInventoryCostingModal({ onClose, period, notify }: {
  onClose: () => void; period: string; notify: (message: string) => void;
}) {
  const { token, companyId } = useApiSession();
  const [options, setOptions] = useState<Options | null>(null);
  const [periodId, setPeriodId] = useState("");
  const [method, setMethod] = useState("MOVING_AVERAGE");
  const [warehouse, setWarehouse] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRecalculate, setConfirmRecalculate] = useState(false);

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    Promise.all([
      request<Options>(`/api/v1/inventory/valuations/options/?company_id=${companyId}`, token),
      request<Run[] | { results: Run[] }>(`/api/v1/inventory/valuations/?company_id=${companyId}`, token),
    ]).then(([data, history]) => {
      if (!active) return;
      setOptions(data);
      setPeriodId(data.periods.find((row) => row.from.slice(0, 7) === period && row.status === "OPEN")?.id ||
        data.periods.find((row) => row.status === "OPEN")?.id || "");
      setMethod(data.default_method);
      setRuns(Array.isArray(history) ? history : history.results || []);
    }).catch((reason) => { if (active) setError(`Không thể tải thiết lập tính giá: ${errorText(reason)}`); });
    return () => { active = false; };
  }, [token, companyId, period]);

  const selectedPeriod = options?.periods.find((row) => row.id === periodId);
  const methodLabel = options?.methods.find((row) => row.code === method)?.name || method;
  async function execute(recalculate = false) {
    if (!token || !companyId || !periodId) { setError("Vui lòng chọn kỳ tính giá hợp lệ."); return; }
    setBusy(true); setError("");
    try {
      const created = await request<Run>(`/api/v1/inventory/valuations/?company_id=${companyId}`, token, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: companyId, period: periodId, warehouse: warehouse || null, method,
          recalculate }),
      });
      setRuns((old) => [created, ...old]);
      notify(`Tính giá xuất kho thành công cho kỳ ${selectedPeriod?.code || "đã chọn"}, theo phương pháp ${methodLabel}. ${created.details.updated_lines || 0} dòng được tính.`);
      onClose();
    } catch (reason) {
      const message = errorText(reason);
      if (!recalculate && message.includes("đã tính giá")) setConfirmRecalculate(true);
      setError(message);
    } finally { setBusy(false); }
  }

  return <div className="inventory-costing-backdrop"><div className="inventory-costing-modal" role="dialog" aria-label="Tính giá xuất kho">
    <header><div><Calculator size={18} /><strong>Tính giá xuất kho</strong></div><button type="button" aria-label="Đóng tính giá xuất kho" onClick={onClose}><X size={18} /></button></header>
    <section>
      <label>Kỳ tính giá<select value={periodId} onChange={(event) => { setPeriodId(event.target.value); setConfirmRecalculate(false); setError(""); }}>
        <option value="">Chọn kỳ kế toán</option>{options?.periods.map((row) => <option key={row.id} value={row.id} disabled={row.status !== "OPEN"}>{row.code} ({row.from.split("-").reverse().join("/")} – {row.to.split("-").reverse().join("/")}){row.status === "CLOSED" ? " · Đã khóa" : ""}</option>)}</select></label>
      <label>Phương pháp tính giá<select value={method} onChange={(event) => { setMethod(event.target.value); setConfirmRecalculate(false); setError(""); }}>{options?.methods.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label>
      <label>Phạm vi tính giá<select value={warehouse} onChange={(event) => { setWarehouse(event.target.value); setConfirmRecalculate(false); setError(""); }}><option value="">Tất cả các kho hàng</option>{options?.warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
      <p className="inventory-costing-note">Phương pháp phải khớp chính sách của mặt hàng tại kho. Các kỳ đã khóa hoặc chứng từ còn phụ thuộc sẽ được API kiểm tra trước khi cập nhật.</p>
      {error && <p role="alert" className="inventory-costing-error">{error}</p>}
      {confirmRecalculate && <div className="inventory-costing-confirm"><span>Kỳ này đã có kết quả. Xác nhận tính lại từ dữ liệu nguồn hiện tại?</span><button type="button" disabled={busy} onClick={() => void execute(true)}>Xác nhận tính lại</button><button type="button" onClick={() => { setConfirmRecalculate(false); setError(""); }}>Hủy</button></div>}
      {runs.length > 0 && <details><summary>Lịch sử tính giá ({runs.length})</summary><div className="inventory-costing-history">{runs.slice(0, 10).map((row) => <div key={row.id}><span>{row.details.period_start || row.valuation_date} → {row.valuation_date}</span><span>{row.method}</span><span>{row.status === "COMPLETED" ? "Hoàn thành" : "Thất bại"}</span><span>{row.details.updated_lines || 0} dòng</span></div>)}</div></details>}
    </section>
    <footer><button type="button" onClick={onClose}>Hủy</button><button type="button" className="primary" disabled={busy || !options || !periodId || !options.warehouses.length} onClick={() => void execute()}>{busy ? "Đang tính giá..." : "Thực hiện tính giá"}</button></footer>
  </div></div>;
}
