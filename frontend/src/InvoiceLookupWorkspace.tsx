import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RefreshCw, Search } from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./invoice-lookup.css";

type Mode = "lookup" | "outgoing" | "pending" | "issuance" | "errors" | "unposted";
type Row = {
  id: string; direction: string; invoice_type: string; invoice_series: string; invoice_number: string;
  invoice_date: string; seller_name: string; seller_tax_code: string; buyer_name: string; buyer_tax_code: string;
  subtotal: string; tax_amount: string; total_amount: string; status: string; validation_status: string;
  link_status: string; accounting_status: string; pending_reasons: string[]; original_invoice_id: string | null;
  provider_reference: string; lookup_code: string; integration_status: string; integration_task: string;
  integration_error: string;
};
type Result = { count: number; page: number; page_size: number; total_amount: string; results: Row[];
  accounting_status_available: boolean };
type Detail = { invoice: Row & { lines: Array<{ id: string; line_no: number; description: string; quantity: string;
  unit_price: string; taxable_amount: string; tax_rate: string; tax_amount: string }>; source_filename: string;
  validation_summary: Record<string, string>; raw_data: Record<string, string>; external_reference: string }; statuses: Array<{ id: string; from_status: string; to_status: string;
  reason: string; changed_at: string }>; validations: Array<{ id: string; code: string; result: string;
  severity: string; message: string }>; links: Array<{ id: string; module_code: string; document_number: string;
  status: string; linked_amount: string }>; corrections: Array<{ id: string; type: string; invoice_number: string;
  status: string; reason: string }>; integration_requests: Array<{ id: string; task_type: string;
  status: string; error_message: string; created_at: string }> };

const statusNames: Record<string, string> = {
  DRAFT: "Nháp", RECEIVED: "Đã tiếp nhận", VALIDATED: "Đã kiểm tra", BLOCKED: "Bị chặn",
  ISSUING: "Đang phát hành", ISSUE_FAILED: "Phát hành lỗi", ISSUED: "Đã phát hành",
  ADJUSTED: "Đã điều chỉnh", REPLACED: "Đã bị thay thế", CANCELLED: "Đã hủy",
};
const validationNames: Record<string, string> = {
  NOT_CHECKED: "Chưa kiểm tra", PENDING_CHECK: "Chờ kiểm tra", PASSED: "Đạt kiểm tra",
  MANUAL_REVIEW: "Cần kiểm tra thủ công", NEEDS_REVIEW: "Cần xem lại", WARNING: "Có cảnh báo",
  FAILED: "Không đạt", CHECK_ERROR: "Lỗi kiểm tra",
};
const linkNames: Record<string, string> = {
  UNLINKED: "Chưa liên kết", PARTIALLY_LINKED: "Liên kết một phần", LINKED: "Đã liên kết",
  REVIEW_REQUIRED: "Cần xem lại", CONFLICT: "Xung đột", NOT_APPLICABLE: "Không áp dụng",
};
const modeNames: Record<Mode, string> = {
  lookup: "Tra cứu hóa đơn", outgoing: "Hóa đơn đầu ra", pending: "Hóa đơn cần xử lý",
  issuance: "Trạng thái phát hành", errors: "Sai sót, điều chỉnh", unposted: "Bảng kê hóa đơn chưa hạch toán",
};
const money = (value: string) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const displayDate = (value: string) => value ? value.slice(0, 10).split("-").reverse().join("/") : "—";

export default function InvoiceLookupWorkspace({ mode, href }: { mode: Mode; href: (path: string) => string }) {
  const { token, companyId } = useApiSession();
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<Result | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const query = params.toString();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    setLoading(true); setError("");
    const search = new URLSearchParams(query);
    search.set("company_id", companyId);
    search.set("mode", mode);
    request<Result>(`/api/v1/tax/invoices/query/?${search}`, token)
      .then((data) => { if (active) setResult(data); })
      .catch((cause) => { if (active) { setResult(null); setError(cause.message || "Không tải được danh sách hóa đơn."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, companyId, mode, query, revision]);
  useEffect(() => {
    if (!selectedId || !token || !companyId) { setDetail(null); return; }
    let active = true;
    setDetailLoading(true);
    request<Detail>(`/api/v1/tax/invoices/${selectedId}/history/?company_id=${companyId}`, token)
      .then((data) => { if (active) { setDetail(data); setError(""); } })
      .catch((cause) => { if (active) { setDetail(null); setError(cause.message || "Không tải được chi tiết hóa đơn."); } })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId, token, companyId, revision]);
  const pageCount = Math.max(1, Math.ceil((result?.count || 0) / (result?.page_size || 20)));
  const selected = detail?.invoice;
  return <div className="il-workspace">
    <header className="il-header"><div><h1>{modeNames[mode]}</h1><p>Dữ liệu hóa đơn của doanh nghiệp đang chọn</p></div>
      <button type="button" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} /> Làm mới</button></header>
    {mode === "unposted" && <p className="il-note">Chưa có nguồn trạng thái hạch toán được xác minh cho bảng kê này. Hệ thống không suy ra đã hạch toán từ trạng thái phát hành hoặc liên kết.</p>}
    <div className="il-filters">
      <label><Search size={15} /><input aria-label="Tìm hóa đơn" placeholder="Số, ký hiệu, MST, tên đối tượng..." value={params.get("q") || ""} onChange={(e) => update("q", e.target.value)} /></label>
      <input aria-label="Số hóa đơn" placeholder="Số hóa đơn" value={params.get("number") || ""} onChange={(e) => update("number", e.target.value)} />
      <input aria-label="Ký hiệu hóa đơn" placeholder="Ký hiệu" value={params.get("series") || ""} onChange={(e) => update("series", e.target.value)} />
      <input aria-label="Mã số thuế" placeholder="Mã số thuế" value={params.get("tax_code") || ""} onChange={(e) => update("tax_code", e.target.value)} />
      <input aria-label="Tên người bán hoặc người mua" placeholder="Người bán / người mua" value={params.get("party") || ""} onChange={(e) => update("party", e.target.value)} />
      <select aria-label="Chiều hóa đơn" value={params.get("direction") || (mode === "outgoing" || mode === "issuance" ? "OUTPUT" : "")}
        onChange={(e) => update("direction", e.target.value)} disabled={mode === "outgoing" || mode === "issuance"}>
        <option value="">Tất cả chiều</option><option value="INPUT">Đầu vào</option><option value="OUTPUT">Đầu ra</option></select>
      <select aria-label="Trạng thái hóa đơn" value={params.get("status") || ""} onChange={(e) => update("status", e.target.value)}>
        <option value="">Tất cả trạng thái</option>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select aria-label="Loại hóa đơn" value={params.get("invoice_type") || ""} onChange={(e) => update("invoice_type", e.target.value)}>
        <option value="">Tất cả loại</option><option value="ORIGINAL">Gốc</option><option value="ADJUSTMENT">Điều chỉnh</option><option value="REPLACEMENT">Thay thế</option></select>
      <input aria-label="Từ ngày hóa đơn" type="date" value={params.get("date_from") || ""} onChange={(e) => update("date_from", e.target.value)} />
      <input aria-label="Đến ngày hóa đơn" type="date" value={params.get("date_to") || ""} onChange={(e) => update("date_to", e.target.value)} />
    </div>
    {error && <div className="il-error" role="alert">{error} <button onClick={() => setRevision((value) => value + 1)}>Thử lại</button></div>}
    <section className="il-panel"><div className="il-count">{loading ? "Đang tải..." : `${result?.count || 0} hóa đơn · Tổng giá trị chứng từ ${money(result?.total_amount || "0")}`}</div>
      <div className="il-table-wrap"><table><thead><tr><th>Số hóa đơn</th><th>Ký hiệu</th><th>Ngày hóa đơn</th><th>Chiều</th><th>Đối tượng</th><th>Tổng thanh toán</th><th>Vòng đời</th><th>Kiểm tra / Liên kết</th></tr></thead>
        <tbody>{(result?.results || []).map((row) => <tr key={row.id} onClick={() => setSelectedId(row.id)} tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(row.id); }}>
          <td><button type="button" className="il-row-link" onClick={() => setSelectedId(row.id)}>{row.invoice_number || "Chưa có số"}</button></td><td>{row.invoice_series}</td>
          <td>{displayDate(row.invoice_date)}</td><td>{row.direction === "INPUT" ? "Đầu vào" : "Đầu ra"}</td>
          <td>{row.direction === "INPUT" ? row.seller_name : row.buyer_name}</td><td className="il-money">{money(row.total_amount)}</td>
          <td>{statusNames[row.status] || row.status}</td><td>{row.direction === "INPUT" ? `${validationNames[row.validation_status] || row.validation_status} · ${linkNames[row.link_status] || row.link_status}` : row.pending_reasons.join(", ") || "—"}</td>
        </tr>)}</tbody></table></div>
      {!loading && !result?.results.length && <p className="il-empty">{mode === "unposted"
        ? "Chưa thể lập bảng kê vì chưa có nguồn trạng thái hạch toán được xác minh."
        : "Không có hóa đơn phù hợp."}</p>}
      <footer className="il-pagination"><span>Trang {result?.page || 1}/{pageCount}</span><button disabled={(result?.page || 1) <= 1} onClick={() => update("page", String((result?.page || 1) - 1))}>Trước</button>
        <button disabled={(result?.page || 1) >= pageCount} onClick={() => update("page", String((result?.page || 1) + 1))}>Sau</button></footer>
    </section>
    {selectedId && <div className="il-backdrop" onClick={() => setSelectedId("")}><aside className="il-detail" role="dialog" aria-modal="true" aria-label="Chi tiết hóa đơn" onClick={(e) => e.stopPropagation()}>
      <header><div><h2>Chi tiết hóa đơn</h2><small>{selectedId}</small></div><button onClick={() => setSelectedId("")}>Đóng</button></header>
      {detailLoading && <p>Đang tải chi tiết...</p>}
      {selected && <><dl className="il-info"><div><dt>Số / Ký hiệu</dt><dd>{selected.invoice_number || "Chưa có số"} / {selected.invoice_series}</dd></div>
        <div><dt>Ngày hóa đơn</dt><dd>{displayDate(selected.invoice_date)}</dd></div><div><dt>Vòng đời</dt><dd>{statusNames[selected.status] || selected.status}</dd></div>
        <div><dt>Người bán</dt><dd>{selected.seller_name} · {selected.seller_tax_code}</dd></div><div><dt>Người mua</dt><dd>{selected.buyer_name} · {selected.buyer_tax_code}</dd></div>
        <div><dt>Kiểm tra</dt><dd>{validationNames[selected.validation_summary?.processing_status] || "Chưa kiểm tra"}</dd></div>
        <div><dt>Liên kết</dt><dd>{linkNames[selected.link_status] || "Chưa xác định"}</dd></div>
        <div><dt>Hạch toán</dt><dd>Chưa xác định trạng thái kế toán</dd></div>
        <div><dt>Nguồn XML</dt><dd>{selected.source_filename || "Không có file XML nguồn"}</dd></div>
        <div><dt>Provider</dt><dd>{selected.external_reference || "Chưa có"}</dd></div><div><dt>Mã tra cứu</dt><dd>{selected.raw_data?.lookup_code || "Chưa có"}</dd></div>
        <div><dt>Tổng thanh toán</dt><dd>{money(selected.total_amount)}</dd></div></dl>
        <h3>Hàng hóa, dịch vụ</h3><div className="il-lines">{selected.lines?.map((line) => <div key={line.id}>{line.line_no}. {line.description} · {line.quantity} × {money(line.unit_price)} · VAT {line.tax_rate}%</div>)}</div>
        <h3>Kết quả kiểm tra</h3>{detail?.validations.length ? detail.validations.map((item) => <p key={item.id}>{item.code}: {item.message}</p>) : <p>Chưa có kết quả kiểm tra.</p>}
        <h3>Chứng từ liên quan</h3>{detail?.links.filter((item) => item.status === "ACTIVE").length ? detail.links.filter((item) => item.status === "ACTIVE").map((item) => <p key={item.id}>{item.module_code} · {item.document_number || item.id} · {money(item.linked_amount)}</p>) : <p>Chưa có liên kết chứng từ.</p>}
        <h3>Điều chỉnh, thay thế, hủy</h3>{selected.original_invoice_id && <p>Hóa đơn gốc: <button className="il-row-link" onClick={() => setSelectedId(selected.original_invoice_id!)}>{selected.original_invoice_id}</button></p>}
        {detail?.corrections.map((item) => <p key={item.id}>{item.type === "ADJUSTMENT" ? "Điều chỉnh" : "Thay thế"} · <button className="il-row-link" onClick={() => setSelectedId(item.id)}>{item.invoice_number || item.id}</button> · {statusNames[item.status] || item.status} · {item.reason}</p>)}
        {detail?.statuses.map((item) => <p key={item.id}>{displayDate(item.changed_at)} · {statusNames[item.from_status] || item.from_status || "Mới"} → {statusNames[item.to_status] || item.to_status} {item.reason}</p>)}
        <h3>Lịch sử tích hợp</h3>{detail?.integration_requests.length ? detail.integration_requests.map((item) => <p key={item.id}>{item.task_type} · {item.status} · {displayDate(item.created_at)} {item.error_message}</p>) : <p>Chưa có yêu cầu tích hợp.</p>}
        <div className="il-actions">{selected.direction === "INPUT" ? <Link to={href("/invoices/incoming/inbox")}>Mở xử lý đầu vào</Link> : <Link to={href("/sales/invoices")}>Mở Bán hàng → Hóa đơn</Link>}</div>
      </>}
    </aside></div>}
  </div>;
}
