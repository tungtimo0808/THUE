import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ShieldCheck, CreditCard, ArrowRight, RefreshCw, FileText, Banknote } from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_series: string;
  invoice_date: string;
  seller_name: string;
  seller_tax_code: string;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  status: string;
  raw_data?: Record<string, any>;
};

type List<T> = T[] | { results: T[] };
const list = <T,>(value: List<T>): T[] => Array.isArray(value) ? value : value.results || [];
const money = (val: string | number) => Number(val || 0).toLocaleString("vi-VN") + " đ";

export default function CashPaymentLimitWarningWorkspace({
  companyId,
  notify,
  href,
}: {
  companyId: string;
  notify?: (msg: string) => void;
  href: (path: string, extra?: Record<string, string>) => string;
}) {
  const { token } = useApiSession();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState<number>(20000000); // 20 triệu VNĐ

  const reload = async () => {
    if (!token || !companyId) return;
    setLoading(true);
    try {
      const data = await request<List<Invoice>>(
        `/api/v1/tax/invoices/?company_id=${encodeURIComponent(companyId)}&direction=INPUT&ordering=-invoice_date`,
        token
      );
      setInvoices(list(data));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [companyId, token]);

  // Lọc các hóa đơn có giá trị >= ngưỡng quy định
  const riskyInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const amt = Number(inv.total_amount || 0);
      return amt >= threshold;
    });
  }, [invoices, threshold]);

  const totalRiskyAmount = useMemo(() => {
    return riskyInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  }, [riskyInvoices]);

  const totalRiskyTax = useMemo(() => {
    return riskyInvoices.reduce((sum, inv) => sum + Number(inv.tax_amount || 0), 0);
  }, [riskyInvoices]);

  return (
    <div className="erp3-workspace" style={{ padding: "16px 24px" }}>
      <header className="erp3-page-header" style={{ marginBottom: 20 }}>
        <div>
          <p className="erp3-eyebrow">CẢNH BÁO RỦI RO THUẾ</p>
          <h2 style={{ fontSize: 20, margin: "4px 0" }}>Cảnh báo chi tiền mặt hóa đơn ≥ 20 triệu đồng</h2>
          <p style={{ color: "#64748b", margin: 0, fontSize: 13.5 }}>
            Kiểm soát các hóa đơn mua vào có giá trị từ 20 triệu đồng trở lên theo quy định tại Thông tư 96/2015/TT-BTC và Nghị định 123/2020/NĐ-CP nhằm tránh bị loại thuế GTGT và xuất toán chi phí TNDN.
          </p>
        </div>
        <div className="erp3-header-actions" style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={reload}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 13,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              transition: "all 0.15s ease",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Làm mới
          </button>
        </div>
      </header>

      {/* Legal alert banner */}
      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: "14px 18px", borderRadius: 8, marginBottom: 20, fontSize: 13.5, lineHeight: 1.5 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Quy định khấu trừ thuế GTGT & Chi phí TNDN hợp lý:</strong>
            <p style={{ margin: "4px 0 0" }}>
              Hóa đơn mua vào từng lần có giá trị từ <b>20.000.000 đ trở lên</b> (đã bao gồm thuế GTGT) bắt buộc phải có <b>chứng từ thanh toán không dùng tiền mặt</b> (Ủy nhiệm chi / Chuyển khoản ngân hàng). Nếu thanh toán bằng tiền mặt sẽ <b>không được khấu trừ thuế GTGT đầu vào</b> và <b>bị loại khỏi chi phí được trừ khi tính thuế TNDN</b>.
            </p>
          </div>
        </div>
      </div>

      {/* Stats KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Số hóa đơn diện rủi ro (≥ 20 tr)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: riskyInvoices.length > 0 ? "#dc2626" : "#16a34a", marginTop: 4 }}>
            {riskyInvoices.length} hóa đơn
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Bắt buộc có chứng từ ngân hàng</div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Tổng giá trị thanh toán rủi ro</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>
            {money(totalRiskyAmount)}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Cần rà soát chứng từ chi quỹ TM</div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Thuế GTGT có nguy cơ bị loại</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#d97706", marginTop: 4 }}>
            {money(totalRiskyTax)}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Nguy cơ loại khỏi Chỉ tiêu 25 Tờ khai</div>
        </div>
      </div>

      {/* Risky invoice table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <Banknote size={18} color="#d97706" />
            Danh sách hóa đơn đầu vào cần kiểm soát chứng từ ngân hàng
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ color: "#64748b" }}>Ngưỡng cảnh báo:</span>
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
            >
              <option value={20000000}>≥ 20 triệu đồng (Chuẩn quy định)</option>
              <option value={10000000}>≥ 10 triệu đồng</option>
              <option value={5000000}>≥ 5 triệu đồng</option>
            </select>
          </div>
        </div>

        {riskyInvoices.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#16a34a" }}>
            <ShieldCheck size={36} style={{ margin: "auto", marginBottom: 8 }} />
            <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>Doanh nghiệp tuân thủ tốt!</p>
            <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>Không có hóa đơn đầu vào nào vượt ngưỡng cảnh báo thanh toán tiền mặt.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 1050, fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                  <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Ký hiệu - Số HĐ</th>
                  <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Ngày hóa đơn</th>
                  <th style={{ padding: "10px 12px" }}>Nhà cung cấp / MST</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>Tổng tiền thanh toán</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>Tiền thuế GTGT</th>
                  <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>Mức độ rủi ro</th>
                  <th style={{ padding: "10px 12px" }}>Khuyến nghị xử lý</th>
                  <th style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {riskyInvoices.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>
                      {inv.invoice_series} - {inv.invoice_number}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#64748b", whiteSpace: "nowrap" }}>
                      {inv.invoice_date?.slice(0, 10).split("-").reverse().join("/")}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{inv.seller_name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>MST: {inv.seller_tax_code}</div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#b91c1c", whiteSpace: "nowrap" }}>
                      {money(inv.total_amount)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#64748b", whiteSpace: "nowrap" }}>
                      {money(inv.tax_amount)}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <span style={{ background: "#fef2f2", color: "#b91c1c", padding: "2px 8px", borderRadius: 12, fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>
                        ≥ 20 triệu (Rủi ro thuế)
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12.5, color: "#475569" }}>
                      Bắt buộc có Ủy nhiệm chi / Chuyển khoản ngân hàng
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <Link
                        to={href("/bank/payment-orders")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: "#0284c7",
                          color: "#ffffff",
                          padding: "6px 14px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                          boxShadow: "0 1px 2px rgba(2,132,199,0.2)",
                          whiteSpace: "nowrap",
                          transition: "all 0.15s ease",
                        }}
                      >
                        Lập UNC <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

