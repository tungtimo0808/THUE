import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ChevronLeft, RefreshCw, Search, ShieldAlert, ShieldCheck, X, Eye } from "lucide-react";
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
  return (
    <div style={{ height: "100%", overflow: "auto", background: "#f4f5f8", padding: "14px 20px", boxSizing: "border-box" }}>
      <button
        type="button"
        onClick={() => navigate("/purchases/invoice-processing")}
        style={{
          border: 0,
          background: "none",
          color: "#0284c7",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 12,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 500,
          padding: "5px 10px",
          borderRadius: 6,
          transition: "background 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <ChevronLeft size={16} /> Xử lý hóa đơn đầu vào
      </button>

      <div style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, minHeight: 380, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="ce-toolbar" style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Kiểm tra rủi ro nhà cung cấp</h2>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#ffffff", border: "1px solid #cbd5e1", padding: "0 12px", borderRadius: 6, height: 34 }}>
            <Search size={15} color="#64748b" />
            <input
              aria-label="Tìm nhà cung cấp"
              placeholder="Mã, tên, mã số thuế…"
              value={query}
              onChange={event => setQuery(event.target.value)}
              style={{ border: "none", outline: "none", fontSize: 13, color: "#0f172a", width: 220 }}
            />
          </label>
          <button
            type="button"
            onClick={() => setRevision(value => value + 1)}
            aria-label="Tải lại danh sách"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              color: "#334155",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              transition: "all 0.15s ease",
            }}
          >
            <RefreshCw size={14} /> Tải lại
          </button>
        </div>
        <p style={{ margin: "12px 18px", color: "#64748b", fontSize: 13 }}>
          Kết quả rủi ro dựa trên dữ liệu nội bộ. Trạng thái mã số thuế bên ngoài chỉ được xác nhận khi có nguồn kiểm tra thực tế.
        </p>
        {error && <p role="alert" style={{ color: "#b91c1c", margin: "10px 18px" }}><AlertCircle size={14} /> {error}</p>}
        {loading && <p role="status" style={{ margin: 18, color: "#64748b" }}>Đang tải nhà cung cấp...</p>}
        <div style={{ overflowX: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Mã NCC", "Tên nhà cung cấp", "Mã số thuế", "Trạng thái", "Mức rủi ro", "Điểm", "Ngày kiểm tra", "Chức năng"].map(label => (
                  <th key={label} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12.5, fontWeight: 600, color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.supplier_id} style={{ background: selected?.supplier_id === row.supplier_id ? "#f0fdf4" : undefined, borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0f172a" }}>{row.supplier_code}</td>
                  <td style={{ padding: "10px 14px" }}>{row.supplier_name}</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>{row.tax_code || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#059669", background: "#ecfdf5", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669" }} />
                      {row.operating_status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: row.latest_risk_level === "HIGH" ? "#fef2f2" : row.latest_risk_level === "LOW" ? "#f0fdf4" : "#fefce8",
                      color: row.latest_risk_level === "HIGH" ? "#dc2626" : row.latest_risk_level === "LOW" ? "#16a34a" : "#ca8a04",
                    }}>
                      {row.latest_risk_level === "HIGH" ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />}
                      {riskName(row.latest_risk_level)}{row.latest_risk_level && !row.is_valid ? " (hết hạn)" : ""}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0f172a" }}>{row.latest_score ?? "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>{dateText(row.latest_check_date)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 12px",
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: 6,
                        color: "#1d4ed8",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Eye size={13} /> Xem rủi ro
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !visible.length && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 30, color: "#64748b" }}>Không có nhà cung cấp</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 18px", borderTop: "1px solid #e2e8f0", fontSize: 13, color: "#64748b" }}>
          Tổng số: <strong style={{ color: "#0f172a" }}>{visible.length}</strong> nhà cung cấp
        </div>
      </div>

      {selected && (
        <div
          className="ce-overlay"
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(2px)",
            zIndex: 1600,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết rủi ro nhà cung cấp"
            onClick={event => event.stopPropagation()}
            style={{
              width: "min(500px, 100%)",
              height: "100%",
              background: "#ffffff",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <header style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  ĐÁNH GIÁ RỦI RO NCC
                </span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "2px 0 0" }}>
                  {selected.supplier_code} · {selected.supplier_name}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Đóng chi tiết"
                onClick={() => setSelected(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748b",
                  transition: "all 0.15s ease",
                }}
              >
                <X size={16} />
              </button>
            </header>

            <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Metrics cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ padding: "12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>Mã số thuế</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>
                    {selected.tax_code || "Chưa có"}
                  </div>
                </div>
                <div style={{
                  padding: "12px",
                  background: selected.latest_risk_level === "HIGH" ? "#fef2f2" : selected.latest_risk_level === "LOW" ? "#f0fdf4" : "#fefce8",
                  borderRadius: 8,
                  border: `1px solid ${selected.latest_risk_level === "HIGH" ? "#fecaca" : selected.latest_risk_level === "LOW" ? "#bbf7d0" : "#fef08a"}`,
                }}>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>Mức rủi ro thuế</div>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: selected.latest_risk_level === "HIGH" ? "#dc2626" : selected.latest_risk_level === "LOW" ? "#16a34a" : "#ca8a04",
                    marginTop: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    {selected.latest_risk_level === "HIGH" ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                    {riskName(detail?.latest_assessment?.risk_level || selected.latest_risk_level || null)}
                  </div>
                </div>
              </div>

              {detail?.latest_assessment && (
                <>
                  <div style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: "#64748b" }}>Điểm rủi ro tích lũy:</span>
                      <strong style={{ color: "#0f172a" }}>{detail.latest_assessment.score} điểm</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: "#64748b" }}>Xác minh thuế ngoài hệ thống:</span>
                      <strong style={{ color: detail.latest_assessment.tax_code_status_verified ? "#16a34a" : "#ca8a04" }}>
                        {detail.latest_assessment.tax_code_status_verified ? "Đã xác minh" : "Chưa xác minh"}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Lịch sử đánh giá:</span>
                      <strong style={{ color: "#0f172a" }}>{detail.history.length} lần kiểm tra</strong>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: 12.5, fontWeight: 700, color: "#334155", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Tiêu chí đánh giá chi tiết
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {detail.latest_assessment.criteria_breakdown.map(item => (
                        <div key={item.code} style={{ padding: "8px 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12.5 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "#0f172a" }}>
                            <span>{item.name}</span>
                            <span style={{ color: item.points > 0 ? "#dc2626" : "#16a34a" }}>+{item.points} đ</span>
                          </div>
                          <div style={{ color: "#64748b", marginTop: 2 }}>{item.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Ghi chú kiểm tra
                </label>
                <textarea
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  placeholder="Nhập ghi chú hoặc lý do đánh giá rủi ro nhà cung cấp…"
                  style={{
                    width: "100%",
                    minHeight: 80,
                    padding: "10px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontFamily: "inherit",
                    fontSize: 13,
                    color: "#0f172a",
                    boxSizing: "border-box",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>

            <footer style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
              padding: "14px 20px",
              borderTop: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  transition: "all 0.15s ease",
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void check()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: "#0284c7",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                  boxShadow: "0 1px 2px rgba(2,132,199,0.25)",
                  opacity: busy ? 0.7 : 1,
                  transition: "all 0.15s ease",
                }}
              >
                <ShieldCheck size={16} />
                {busy ? "Đang kiểm tra..." : "Kiểm tra rủi ro"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
