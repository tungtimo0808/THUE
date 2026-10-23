import { useCallback, useEffect, useState } from "react";
import { errorText } from "./misa-api-writes";
import { request } from "./live-api";

type Connector = { id: string; code: string; provider: string; channel: string; is_active: boolean;
  connection_status: string; config: { credential_reference?: string; connector_version?: string; capabilities?: string[] } };
type Integration = { id: string; connector: string; task_type: string; status: string; created_at: string; error_message?: string };
type List<T> = T[] | { results: T[] };
const list = <T,>(value: List<T>): T[] => Array.isArray(value) ? value : value.results || [];
const capabilityOptions = [
  ["INVOICE_SYNC_INPUT", "Đồng bộ hóa đơn đầu vào"], ["INVOICE_SYNC_OUTPUT", "Đồng bộ hóa đơn đầu ra"],
  ["INVOICE_LOOKUP", "Tra cứu hóa đơn"], ["INVOICE_ISSUE", "Phát hành hóa đơn"],
  ["INVOICE_ADJUST", "Điều chỉnh"], ["INVOICE_REPLACE", "Thay thế"],
  ["INVOICE_CANCEL", "Hủy"], ["INVOICE_STATUS_QUERY", "Tra cứu trạng thái"],
  ["DECLARATION_SUBMIT", "Truyền hồ sơ thuế"], ["DECLARATION_STATUS_QUERY", "Tra cứu hồ sơ"],
] as const;

export default function TaxConnectorPanel({ company, token }: {
  company: { id: string; name: string; tax_code?: string }; token?: string;
}) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [code, setCode] = useState("MEINVOICE");
  const [provider, setProvider] = useState("meInvoice");
  const [channel, setChannel] = useState("EINVOICE");
  const [reference, setReference] = useState("");
  const [version, setVersion] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const query = `?company_id=${encodeURIComponent(company.id)}`;
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [connectorData, integrationData] = await Promise.all([
        request<List<Connector>>(`/api/v1/tax/connectors/${query}`, token),
        request<List<Integration>>(`/api/v1/tax/integrations/${query}`, token),
      ]);
      setConnectors(list(connectorData)); setIntegrations(list(integrationData)); setError("");
    } catch (cause) { setError(errorText(cause)); }
  }, [company.id, token]);
  useEffect(() => { void load(); }, [load]);
  const selected = connectors.find((item) => item.id === selectedId);
  const choose = (id: string) => {
    setSelectedId(id); setMessage("");
    const found = connectors.find((item) => item.id === id);
    if (found) {
      setCode(found.code); setProvider(found.provider); setChannel(found.channel);
      setReference(found.config?.credential_reference || "");
      setVersion(found.config?.connector_version || "");
      setCapabilities(found.config?.capabilities || []);
    } else { setCode("MEINVOICE"); setProvider("meInvoice"); setChannel("EINVOICE");
      setReference(""); setVersion(""); setCapabilities([]); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || busy) return;
    if (!code.trim() || !provider.trim()) { setError("Nhập mã và tên nhà cung cấp."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = { company: company.id, code: code.trim().toUpperCase(), provider: provider.trim(),
        channel, is_active: selected?.is_active || false,
        config: { credential_reference: reference.trim(), connector_version: version.trim(), capabilities } };
      const saved = await request<Connector>(selected ? `/api/v1/tax/connectors/${selected.id}/${query}` : `/api/v1/tax/connectors/${query}`,
        token, { method: selected ? "PATCH" : "POST", body: JSON.stringify(payload) });
      await load(); setSelectedId(saved.id);
      setMessage("Đã lưu cấu hình. Chưa xác thực với nhà cung cấp và chưa đồng bộ dữ liệu.");
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const deactivate = async () => {
    if (!token || !selected || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await request(`/api/v1/tax/connectors/${selected.id}/${query}`, token, {
        method: "PATCH", body: JSON.stringify({ is_active: false }),
      });
      await load(); setMessage("Đã ngừng dùng kết nối cho yêu cầu mới. Lịch sử vẫn được giữ.");
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  return <div className="iw-connect">
    <section>
      <div className="iw-brand">meInvoice</div>
      <h1>Kết nối phần mềm<br />Hóa đơn điện tử</h1>
      <p>Doanh nghiệp: <strong>{company.name}</strong>{company.tax_code && ` · MST ${company.tax_code}`}</p>
      <p>Chọn cấu hình đã lưu hoặc tạo cấu hình mới. Chỉ nhập mã tham chiếu credential, không nhập mật khẩu hay token.</p>
      <label>Cấu hình<select aria-label="Cấu hình kết nối" value={selectedId} onChange={(event) => choose(event.target.value)}>
        <option value="">Tạo cấu hình mới</option>
        {connectors.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.provider}</option>)}
      </select></label>
      <form onSubmit={(event) => void save(event)}>
        <label>Mã nhà cung cấp<input aria-label="Mã nhà cung cấp" value={code} onChange={(event) => setCode(event.target.value)} /></label>
        <label>Tên nhà cung cấp<input aria-label="Tên nhà cung cấp" value={provider} onChange={(event) => setProvider(event.target.value)} /></label>
        <label>Kênh<select aria-label="Kênh kết nối" value={channel} onChange={(event) => setChannel(event.target.value)}>
          <option value="EINVOICE">Hóa đơn điện tử</option><option value="TVAN">T-VAN</option><option value="TAX_AUTHORITY">CQT</option>
        </select></label>
        <label>Tham chiếu credential<input aria-label="Tham chiếu credential" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Mã tham chiếu trong kho bí mật" /></label>
        <label>Phiên bản connector<input aria-label="Phiên bản connector" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="Ví dụ: v1" /></label>
        <fieldset style={{ border: "1px solid #d5dce1", borderRadius: 4, padding: 12 }}><legend>Capability dự kiến</legend>
          {capabilityOptions.map(([value, label]) => <label key={value} style={{ display: "block", marginBottom: 5 }}>
            <input type="checkbox" checked={capabilities.includes(value)} onChange={(event) => setCapabilities((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} /> {label}
          </label>)}
        </fieldset>
        {selected && <p>Trạng thái: <strong>{selected.connection_status === "INACTIVE" ? "Chưa kích hoạt" : "Chưa xác thực Provider"}</strong></p>}
        {selected?.is_active && <button type="button" onClick={() => void deactivate()} disabled={busy}>Ngừng kết nối</button>}
        {error && <p role="alert" className="iw-error">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button type="submit" disabled={busy}>{busy ? "Đang lưu..." : "Lưu cấu hình"}</button>
      </form>
    </section>
    <aside>
      <h2>Lịch sử yêu cầu tích hợp</h2>
      <p>Các yêu cầu đã ghi nhận trong hệ thống. Trạng thái chờ không có nghĩa Provider đã xử lý thành công.</p>
      <button type="button" onClick={() => void load()}>Tải lại</button>
      {integrations.filter((item) => !selectedId || item.connector === selectedId).slice(0, 10).map((item) =>
        <p key={item.id}><strong>{item.task_type}</strong> · {item.status}<br />
          {new Date(item.created_at).toLocaleString("vi-VN")} · {item.id.slice(0, 8)}
          {item.error_message && <><br />{item.error_message}</>}</p>)}
      {!integrations.length && <p>Chưa có yêu cầu tích hợp.</p>}
    </aside>
  </div>;
}
