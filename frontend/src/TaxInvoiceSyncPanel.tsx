import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "./live-api";
import { errorText } from "./misa-api-writes";

type Connector = { id: string; code: string; provider: string; channel: string;
  connection_status: string; config: { capabilities?: string[] } };
type List<T> = T[] | { results: T[] };

export default function TaxInvoiceSyncPanel({ companyId, token, href }: {
  companyId: string; token?: string; href: (path: string) => string;
}) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) return;
    request<List<Connector>>(`/api/v1/tax/connectors/?company_id=${encodeURIComponent(companyId)}`, token)
      .then((data) => { setConnectors(Array.isArray(data) ? data : data.results || []); setError(""); })
      .catch((cause) => setError(errorText(cause)));
  }, [companyId, token]);
  const candidates = connectors.filter((item) => item.config?.capabilities?.includes("INVOICE_SYNC_INPUT"));
  return <div className="iw-process" style={{ minHeight: 500 }}>
    <div className="iw-business" style={{ maxWidth: 950, minHeight: 0, margin: "auto" }}>
      <h1 style={{ fontSize: 22, marginTop: 0 }}>Tự động lấy hóa đơn từ TCT</h1>
      <p>Chưa có kết nối đã xác thực với API đồng bộ hóa đơn. Hệ thống chưa thể chạy đồng bộ tự động hoặc báo đã lấy dữ liệu từ TCT.</p>
      <h2 style={{ textAlign: "left" }}>Cấu hình có capability đồng bộ đầu vào</h2>
      {error && <p role="alert">{error}</p>}
      {candidates.map((item) => <p key={item.id}>{item.code} · {item.provider} · {item.connection_status === "INACTIVE" ? "Chưa kích hoạt" : "Chưa xác thực Provider"}</p>)}
      {!candidates.length && <p>Chưa có cấu hình phù hợp.</p>}
      <p><Link to={href("/invoices/meinvoice")}>Thiết lập kết nối</Link></p>
      <p>Có tệp XML hóa đơn từ nguồn hợp lệ? Dùng luồng tiếp nhận hiện có để kiểm tra và nhập thủ công.</p>
      <Link to={href("/invoices/incoming/inbox")}>Đến hộp hóa đơn đầu vào</Link>
    </div>
  </div>;
}
