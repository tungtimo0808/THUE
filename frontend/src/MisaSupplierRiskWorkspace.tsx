import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ChevronLeft, RefreshCw, Search } from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./misa-cash.css";

type RiskRow = {
  supplier_id: string; supplier_code: string; supplier_name: string; tax_code: string;
  operating_status: string; latest_risk_level: string | null; latest_score: number | null;
  latest_check_date: string | null; is_valid: boolean;
};
type Assessment = {
  id: string; risk_level: string; score: number; tax_code_status_verified: boolean;
  tax_status: string; is_blocked: boolean; created_at: string;
  criteria_breakdown: Array<{ code: string; name: string; points: number; description: string }>;
};
type Detail = { latest_assessment: Assessment | null; history: Assessment[] };
const riskName = (value: string | null) => ({
  LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao", INSUFFICIENT_DATA: "Chưa đủ dữ liệu",
} as Record<string, string>)[value || ""] || "Chưa kiểm tra";
const dateText = (value: string | null) => value ? new Date(value).toLocaleDateString("vi-VN") : "—";

export default function MisaSupplierRiskWorkspace({ companyId, notify }: { companyId: string; notify: (message: string) => void }) {
  const { token } = useApiSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RiskRow | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const root = "/api/v1/purchases/supplier-risk/";
  const scope = `company_id=${encodeURIComponent(companyId)}`;

  useEffect(() => {
    if (!token || !companyId) { setLoading(false); setError("Cần đăng nhập và chọn doanh nghiệp."); return; }
    let active = true;
    setLoading(true);
    request<{ results: RiskRow[] }>(`${root}?${scope}`, token)
      .then(data => { if (active) { setRows(data.results); setError(""); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được nhà cung cấp."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, companyId, revision]);

  useEffect(() => {
    if (!selected || !token) { setDetail(null); return; }
    let active = true;
    request<Detail>(`${root}${selected.supplier_id}/?${scope}`, token)
      .then(data => { if (active) setDetail(data); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được lịch sử kiểm tra."); });
    return () => { active = false; };
  }, [selected?.supplier_id, token, revision, companyId]);

  async function check() {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try {
      await request(`${root}check/?${scope}`, token, {
        method: "POST", body: JSON.stringify({ company: companyId, supplier_id: selected.supplier_id, notes }),
      });
      setRevision(value => value + 1);
      setNotes("");
      notify("Đã lưu kết quả kiểm tra rủi ro nhà cung cấp.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không kiểm tra được nhà cung cấp."); }
    finally { setBusy(false); }
  }

  const visible = rows.filter(row => `${row.supplier_code} ${row.supplier_name} ${row.tax_code}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div style={{ height: "100%", overflow: "auto", background: "#f4f5f8", padding: "10px 16px 14px", boxSizing: "border-box" }}>
    <button type="button" onClick={() => navigate("/purchases/invoice-processing")} style={{ border: 0, background: "none", color: "#0284c7", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8, cursor: "pointer" }}>
      <ChevronLeft size={16} /> Xử lý hóa đơn đầu vào
    </button>
    <div style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 4, minHeight: 380 }}>
      <div className="ce-toolbar" style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0" }}>
        <h2 style={{ flex: 1, margin: 0, fontSize: 17 }}>Kiểm tra rủi ro nhà cung cấp</h2>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Search size={15} /><input aria-label="Tìm nhà cung cấp" placeholder="Mã, tên, mã số thuế" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <button type="button" onClick={() => setRevision(value => value + 1)} aria-label="Tải lại danh sách"><RefreshCw size={15} /> Tải lại</button>
      </div>
      <p style={{ margin: "10px 14px", color: "#64748b", fontSize: 12.5 }}>Kết quả rủi ro dựa trên dữ liệu nội bộ. Trạng thái mã số thuế bên ngoài chỉ được xác nhận khi có nguồn kiểm tra thực tế.</p>
      {error && <p role="alert" style={{ color: "#b91c1c", margin: "10px 14px" }}><AlertCircle size={14} /> {error}</p>}
      {loading && <p role="status" style={{ margin: 14 }}>Đang tải nhà cung cấp...</p>}
      <div style={{ overflowX: "auto" }}><table className="misa-table" style={{ width: "100%" }}><thead><tr>
        {["Mã NCC", "Tên nhà cung cấp", "Mã số thuế", "Trạng thái", "Mức rủi ro", "Điểm", "Ngày kiểm tra", "Chức năng"].map(label => <th key={label}>{label}</th>)}
      </tr></thead><tbody>{visible.map(row => <tr key={row.supplier_id} style={{ background: selected?.supplier_id === row.supplier_id ? "#f0fdf4" : undefined }}>
        <td>{row.supplier_code}</td><td>{row.supplier_name}</td><td>{row.tax_code || "—"}</td><td>{row.operating_status}</td>
        <td>{riskName(row.latest_risk_level)}{row.latest_risk_level && !row.is_valid ? " (hết hạn)" : ""}</td>
        <td>{row.latest_score ?? "—"}</td><td>{dateText(row.latest_check_date)}</td>
        <td><button type="button" onClick={() => setSelected(row)}>Xem / kiểm tra</button></td>
      </tr>)}{!loading && !visible.length && <tr><td colSpan={8} style={{ textAlign: "center", padding: 20 }}>Không có nhà cung cấp</td></tr>}</tbody></table></div>
      <div className="ce-toolbar" style={{ padding: "8px 14px", borderTop: "1px solid #e2e8f0" }}>Tổng số: {visible.length}</div>
    </div>
    {selected && <div className="ce-overlay" onClick={() => setSelected(null)}><section className="ce-panel" role="dialog" aria-modal="true" aria-label="Chi tiết rủi ro nhà cung cấp" onClick={event => event.stopPropagation()}>
      <header><h2>{selected.supplier_code} · {selected.supplier_name}</h2><button type="button" aria-label="Đóng chi tiết" onClick={() => setSelected(null)}>×</button></header>
      <div className="ce-panel-body">
        <p>Mã số thuế: {selected.tax_code || "Chưa có"} · Mức rủi ro: <strong>{riskName(detail?.latest_assessment?.risk_level || null)}</strong></p>
        {detail?.latest_assessment && <><p>Điểm: {detail.latest_assessment.score} · Xác minh thuế ngoài hệ thống: {detail.latest_assessment.tax_code_status_verified ? "Đã xác minh" : "Chưa xác minh"}</p>
          <h3>Tiêu chí đánh giá</h3><ul>{detail.latest_assessment.criteria_breakdown.map(item => <li key={item.code}>{item.name}: +{item.points} — {item.description}</li>)}</ul>
          <p>Lịch sử kiểm tra: {detail.history.length} lần</p></>}
        <label>Ghi chú kiểm tra<textarea value={notes} onChange={event => setNotes(event.target.value)} /></label>
      </div><footer><button type="button" onClick={() => setSelected(null)}>Đóng</button><button type="button" className="ce-primary" disabled={busy} onClick={() => void check()}>{busy ? "Đang kiểm tra..." : "Kiểm tra rủi ro"}</button></footer>
    </section></div>}
  </div>;
}
