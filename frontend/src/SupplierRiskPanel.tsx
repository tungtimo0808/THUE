import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, RotateCw, Search } from "lucide-react";
import { clearLiveApiGetCache, request } from "./live-api";
import { errorText } from "./misa-api-writes";

type RiskRow = {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  tax_code: string;
  address: string;
  latest_risk_level: "LOW" | "MEDIUM" | "HIGH" | "INSUFFICIENT_DATA" | null;
  latest_risk_level_display: string | null;
  latest_score: number | null;
  latest_check_date: string | null;
  is_valid: boolean;
};

const LEVEL_STYLE: Record<string, { color: string; background: string }> = {
  HIGH: { color: "#b91c1c", background: "#fee2e2" },
  MEDIUM: { color: "#b45309", background: "#fef3c7" },
  LOW: { color: "#047857", background: "#d1fae5" },
  INSUFFICIENT_DATA: { color: "#475569", background: "#e2e8f0" },
};

const cell = { padding: "8px 12px", borderBottom: "1px solid #e2e8f0", verticalAlign: "top" as const };
const iconButton = {
  width: 32, height: 32, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff",
  display: "grid", placeItems: "center", cursor: "pointer", color: "#475569",
};

/** Danh sách NCC có rủi ro: chấm điểm từ dữ liệu nội bộ (hóa đơn, giao hàng, trả hàng, sự cố) qua API UC-PUR-14. */
export default function SupplierRiskPanel({ companyId, token, notify }: {
  companyId: string; token?: string; notify: (msg: string) => void;
}) {
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"risky" | "all">("risky");
  const [checking, setChecking] = useState<string | null>(null);
  const baseUrl = `/api/v1/purchases/supplier-risk/?company_id=${encodeURIComponent(companyId)}&role=VENDOR`;

  const load = useCallback(async (fresh = false) => {
    if (!token) return;
    if (fresh) clearLiveApiGetCache();
    setLoading(true);
    setError("");
    try {
      const data = await request<{ results: RiskRow[] }>(baseUrl, token);
      setRows(data.results || []);
    } catch (err) {
      setError(`Không tải được danh sách nhà cung cấp: ${errorText(err)}`);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, token]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (scope === "risky" && row.latest_risk_level !== "HIGH" && row.latest_risk_level !== "MEDIUM") return false;
      if (!q) return true;
      return [row.supplier_code, row.supplier_name, row.tax_code, row.address].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [rows, search, scope]);

  const notChecked = rows.filter((row) => !row.latest_risk_level).length;

  const check = async (row: RiskRow) => {
    if (checking) return;
    setChecking(row.supplier_id);
    try {
      const res = await request<{ data: { risk_level: string; score: number } }>(
        `/api/v1/purchases/supplier-risk/check/?company_id=${encodeURIComponent(companyId)}`, token,
        { method: "POST", body: JSON.stringify({ supplier_id: row.supplier_id }) },
      );
      notify(`${row.supplier_code}: ${res.data.score} điểm. Mã số thuế chưa được xác minh với cơ quan thuế.`);
      await load(true);
    } catch (err) {
      notify(`Không kiểm tra được rủi ro ${row.supplier_code}: ${errorText(err)}`);
    } finally {
      setChecking(null);
    }
  };

  return (
    <div style={{ background: "#ffffff", minHeight: "100%", padding: "16px 20px 24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative", width: 240 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: "#94a3b8" }} />
            <input type="text" placeholder="Tìm mã, tên, MST, địa chỉ" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", height: 32, padding: "0 10px 0 30px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <select aria-label="Phạm vi" value={scope} onChange={(e) => setScope(e.target.value as "risky" | "all")}
            style={{ height: 32, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, padding: "0 8px" }}>
            <option value="risky">Rủi ro trung bình / cao</option>
            <option value="all">Tất cả nhà cung cấp</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" title="Tải lại" onClick={() => void load(true)} disabled={loading} style={iconButton}><RotateCw size={14} /></button>
          <button type="button" title="In danh sách" onClick={() => window.print()} style={iconButton}><Printer size={14} /></button>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12.5, color: "#64748b" }}>
        Điểm rủi ro tính từ dữ liệu trong hệ thống: hóa đơn không hợp lệ/trùng, giao hàng trễ, tỷ lệ trả hàng, sự cố chưa xử lý.
        Trạng thái mã số thuế chưa được tra cứu tự động với cơ quan thuế.
        {notChecked > 0 && <> Còn <strong>{notChecked}</strong> nhà cung cấp chưa kiểm tra — chọn "Tất cả nhà cung cấp" để kiểm tra.</>}
      </p>
      {error && <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p>}

      <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "auto", flex: 1 }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#e2ede6", color: "#1e293b", textAlign: "left" }}>
              <th style={{ ...cell, width: 130 }}>Mã nhà cung cấp</th>
              <th style={{ ...cell, width: 240 }}>Tên nhà cung cấp</th>
              <th style={cell}>Địa chỉ</th>
              <th style={{ ...cell, width: 130 }}>Mã số thuế</th>
              <th style={{ ...cell, width: 170 }}>Rủi ro về hóa đơn</th>
              <th style={{ ...cell, width: 110 }}>Kiểm tra gần nhất</th>
              <th style={{ ...cell, width: 100, textAlign: "center" }}>Chức năng</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const style = row.latest_risk_level ? LEVEL_STYLE[row.latest_risk_level] : undefined;
              return (
                <tr key={row.supplier_id}>
                  <td style={cell}>{row.supplier_code}</td>
                  <td style={cell}>{row.supplier_name}</td>
                  <td style={cell}>{row.address}</td>
                  <td style={cell}>{row.tax_code}</td>
                  <td style={cell}>
                    {style ? (
                      <span style={{ ...style, padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                        {row.latest_risk_level_display} · {row.latest_score} điểm
                      </span>
                    ) : <span style={{ color: "#94a3b8" }}>Chưa kiểm tra</span>}
                    {row.latest_risk_level && !row.is_valid && <div style={{ fontSize: 11.5, color: "#b45309", marginTop: 3 }}>Kết quả đã hết hạn</div>}
                  </td>
                  <td style={cell}>{row.latest_check_date ? new Date(row.latest_check_date).toLocaleDateString("vi-VN") : ""}</td>
                  <td style={{ ...cell, textAlign: "center" }}>
                    <button type="button" disabled={checking !== null} onClick={() => void check(row)}
                      style={{ height: 28, padding: "0 10px", border: "1px solid #00a862", color: "#00a862", background: "#ffffff", borderRadius: 4, cursor: checking ? "wait" : "pointer", fontSize: 12.5 }}>
                      {checking === row.supplier_id ? "Đang kiểm tra…" : row.latest_risk_level ? "Kiểm tra lại" : "Kiểm tra"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && visible.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b", fontSize: 13 }}>
            {scope === "risky" ? "Không có nhà cung cấp nào ở mức rủi ro trung bình hoặc cao." : "Không có dữ liệu"}
          </div>
        )}
        {loading && <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>Đang tải…</div>}
      </div>
    </div>
  );
}
