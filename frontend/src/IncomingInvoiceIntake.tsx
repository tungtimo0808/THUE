import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, RefreshCw, Search, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";

type Invoice = {
  id: string; invoice_number: string; invoice_series: string; invoice_date: string;
  seller_name: string; seller_tax_code: string; buyer_name: string; buyer_tax_code: string;
  subtotal: string; tax_amount: string; total_amount: string; status: string;
  received_at: string; source: string; source_filename: string; link_status: string;
  validation_summary: { processing_status?: string; intake_warnings?: string[] };
  raw_data: { invoice_template?: string; sha256?: string; parsed_lines?: Array<{ line_no: number; description: string; taxable_amount: string; tax_amount: string }> };
  lines: Array<{ id: string; line_no: number; description: string; taxable_amount: string; tax_amount: string }>;
};
type Branch = { id: string; name: string; status: string };
type ValidationResult = { id: string; code: string; severity: string; result: string; message: string; source: string; checked_at: string };
type ValidationRun = { id: string; overall_status: string; rule_set_version: string; completed_at: string;
  is_current: boolean; results: ValidationResult[] };
type InvoiceHistory = { runs: ValidationRun[] };
type PurchaseCandidate = { id: string; number: string; document_date: string; posting_date: string;
  supplier: string; supplier_tax_code: string; description: string; status: string; version: number;
  subtotal: string; tax_amount: string; total_amount: string; remaining_amount: string;
  score: number; match_reasons: string[] };
type PurchaseLink = { id: string; purchase_id: string; number: string; supplier: string;
  amount: string; before_tax: string; tax: string; conflict: boolean };
type LinkSummary = { status: string; linked_amount: string; remaining_amount: string;
  linked_before_tax: string; linked_tax: string; links: PurchaseLink[] };
type CandidateResponse = { candidates: PurchaseCandidate[]; summary: LinkSummary };
type List<T> = T[] | { results: T[] };
const rows = <T,>(value: List<T>): T[] => Array.isArray(value) ? value : value.results;
const money = (value: string | number) => Number(value || 0).toLocaleString("vi-VN") + " đ";
const date = (value: string) => value ? new Date(value).toLocaleDateString("vi-VN") : "";
const checkLabel: Record<string, string> = {
  PENDING_CHECK: "Chờ kiểm tra", NEEDS_REVIEW: "Cần xem lại", MANUAL_REVIEW: "Cần kiểm tra thủ công",
  PASSED: "Đạt kiểm tra", WARNING: "Có cảnh báo", FAILED: "Không đạt", CHECK_ERROR: "Lỗi kiểm tra",
};
const resultLabel: Record<string, string> = {
  PASS: "Đạt", WARNING: "Cảnh báo", FAIL: "Không đạt", NOT_CHECKED: "Chưa kiểm tra",
  NOT_APPLICABLE: "Không áp dụng",
};
const linkLabel: Record<string, string> = {
  UNLINKED: "Chưa liên kết", PARTIALLY_LINKED: "Liên kết một phần", LINKED: "Đã liên kết",
  REVIEW_REQUIRED: "Cần xem lại liên kết", CONFLICT: "Liên kết có xung đột",
};

export default function IncomingInvoiceIntake({ notify }: { notify: (message: string) => void }) {
  const navigate = useNavigate();
  const { token, companyId } = useApiSession();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<InvoiceHistory | null>(null);
  const [checking, setChecking] = useState(false);
  const [showPreviousRuns, setShowPreviousRuns] = useState(false);
  const [linkSummary, setLinkSummary] = useState<LinkSummary | null>(null);
  const [candidates, setCandidates] = useState<PurchaseCandidate[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [candidateId, setCandidateId] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [beforeTax, setBeforeTax] = useState("");
  const [taxAllocation, setTaxAllocation] = useState("");
  const [linkNotes, setLinkNotes] = useState("");
  const [unlinkId, setUnlinkId] = useState("");
  const [unlinkReason, setUnlinkReason] = useState("");
  const [purchaseContext, setPurchaseContext] = useState<{ code: string; supplier: string }[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("tax_intake_purchase_context") || "[]"); }
    catch { return []; }
  });

  const reload = useCallback(async () => {
    if (!token || !companyId) return;
    try {
      const [invoiceList, branchList] = await Promise.all([
        request<List<Invoice>>(`/api/v1/tax/invoices/?company_id=${companyId}&direction=INPUT&ordering=-received_at`, token),
        request<List<Branch>>(`/api/v1/organization/branches/?company_id=${companyId}`, token),
      ]);
      const next = rows(invoiceList);
      setInvoices(next);
      setSelectedId((previous) => next.some((item) => item.id === previous) ? previous : next[0]?.id || "");
      const active = rows(branchList).filter((item) => item.status === "ACTIVE");
      setBranches(active);
      setBranchId((previous) => active.some((item) => item.id === previous) ? previous : active[0]?.id || "");
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được hóa đơn."); }
  }, [token, companyId]);
  useEffect(() => { void reload(); }, [reload]);
  const loadHistory = useCallback(async (id: string) => {
    if (!token || !companyId) return;
    try {
      const data = await request<InvoiceHistory>(`/api/v1/tax/invoices/${id}/history/?company_id=${companyId}`, token);
      setHistory(data);
    } catch (cause) { setHistory(null); setError(cause instanceof Error ? cause.message : "Không tải được kết quả kiểm tra."); }
  }, [token, companyId]);
  useEffect(() => { setHistory(null); if (selectedId) void loadHistory(selectedId); }, [selectedId, loadHistory]);
  const loadLinks = useCallback(async (id: string) => {
    if (!token || !companyId) return;
    try {
      const data = await request<LinkSummary>(`/api/v1/tax/invoices/${id}/purchase-links/?company_id=${companyId}`, token);
      setLinkSummary(data);
    } catch (cause) { setLinkSummary(null); setError(cause instanceof Error ? cause.message : "Không tải được liên kết chứng từ."); }
  }, [token, companyId]);
  useEffect(() => { setLinkSummary(null); if (selectedId) void loadLinks(selectedId); }, [selectedId, loadLinks]);

  const filtered = useMemo(() => invoices.filter((item) => {
    const text = `${item.invoice_number} ${item.invoice_series} ${item.seller_name} ${item.seller_tax_code}`.toLocaleLowerCase();
    return text.includes(query.toLocaleLowerCase()) &&
      (status === "ALL" || (item.validation_summary?.processing_status || "PENDING_CHECK") === status);
  }), [invoices, query, status]);
  const selected = invoices.find((item) => item.id === selectedId);
  const currentRun = history?.runs?.[0];
  const chosenCandidate = candidates.find((item) => item.id === candidateId);

  async function openLinkModal() {
    if (!selected) return;
    setError(""); setLinkOpen(true);
    try {
      const data = await request<CandidateResponse>(`/api/v1/tax/invoices/${selected.id}/link-candidates/?company_id=${companyId}`, token);
      setCandidates(data.candidates); setLinkSummary(data.summary);
      setCandidateId(""); setCandidateSearch(""); setBeforeTax(""); setTaxAllocation(""); setLinkNotes("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tìm được chứng từ mua hàng."); }
  }

  function chooseCandidate(candidate: PurchaseCandidate) {
    setCandidateId(candidate.id);
    const tax = Math.min(Number(selected?.tax_amount || 0) - Number(linkSummary?.linked_tax || 0),
      Number(candidate.tax_amount), Number(candidate.remaining_amount));
    const before = Math.min(Number(selected?.subtotal || 0) - Number(linkSummary?.linked_before_tax || 0),
      Number(candidate.remaining_amount) - Math.max(0, tax));
    setBeforeTax(String(Math.max(0, before)));
    setTaxAllocation(String(Math.max(0, tax)));
  }

  async function saveLink() {
    if (!selected || !chosenCandidate) return;
    setLinkBusy(true); setError("");
    try {
      const summary = await request<LinkSummary>(`/api/v1/tax/invoices/${selected.id}/link-purchase/?company_id=${companyId}`,
        token, { method: "POST", body: JSON.stringify({ purchase_id: chosenCandidate.id, version: chosenCandidate.version,
          allocated_amount_before_tax: beforeTax, allocated_tax_amount: taxAllocation, notes: linkNotes }) });
      setLinkSummary(summary); setLinkOpen(false);
      await reload();
      notify(`Đã liên kết hóa đơn ${selected.invoice_number} với chứng từ ${chosenCandidate.number}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được liên kết."); }
    finally { setLinkBusy(false); }
  }

  async function removeLink() {
    if (!selected || !unlinkId) return;
    setLinkBusy(true); setError("");
    try {
      const summary = await request<LinkSummary>(`/api/v1/tax/invoices/${selected.id}/unlink-purchase/?company_id=${companyId}`,
        token, { method: "POST", body: JSON.stringify({ link_id: unlinkId, reason: unlinkReason }) });
      setLinkSummary(summary); setUnlinkId(""); setUnlinkReason("");
      await reload();
      notify("Đã gỡ liên kết chứng từ; lịch sử thao tác được lưu.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không gỡ được liên kết."); }
    finally { setLinkBusy(false); }
  }

  async function checkInvoice() {
    if (!selected) return;
    setChecking(true); setError("");
    try {
      const updated = await request<Invoice>(`/api/v1/tax/invoices/${selected.id}/validate/?company_id=${companyId}`,
        token, { method: "POST", body: JSON.stringify({}) });
      await reload();
      await loadHistory(selected.id);
      notify(`Đã kiểm tra hóa đơn ${updated.invoice_number}: ${checkLabel[updated.validation_summary.processing_status || ""] || "Cần xem kết quả"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không kiểm tra được hóa đơn."); }
    finally { setChecking(false); }
  }

  async function upload() {
    if (!file || !branchId) { setError("Chọn file XML và chi nhánh trước khi tiếp nhận."); return; }
    setBusy(true); setError("");
    try {
      const body = new FormData();
      body.append("company", companyId); body.append("branch", branchId); body.append("file", file);
      const result = await request<{ invoice: Invoice; duplicate: boolean }>(
        "/api/v1/tax/invoices/receive-input-xml/", token, { method: "POST", body });
      await reload();
      setSelectedId(result.invoice.id);
      sessionStorage.removeItem("tax_intake_purchase_context");
      setPurchaseContext([]);
      setUploadOpen(false); setFile(null);
      notify(result.duplicate ? `Hóa đơn số ${result.invoice.invoice_number} đã có trong hộp thư.` :
        `Đã tiếp nhận hóa đơn số ${result.invoice.invoice_number}; ${checkLabel[result.invoice.validation_summary?.processing_status || ""] || "xem kết quả kiểm tra"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tiếp nhận được file XML."); }
    finally { setBusy(false); }
  }

  async function downloadSource() {
    if (!selected) return;
    try {
      const response = await fetch(`/api/v1/tax/invoices/${selected.id}/source-xml/?company_id=${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Không tải được file XML nguồn.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url;
      link.download = selected.source_filename || `${selected.invoice_number}.xml`;
      link.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được file XML nguồn."); }
  }

  return <div className="erp3-workspace">
    <header className="erp3-page-header">
      <div><p className="erp3-eyebrow">KHÔNG GIAN LÀM VIỆC</p><h2>Xử lý hóa đơn đầu vào</h2>
        <p>Tiếp nhận hóa đơn XML, lưu file nguồn và chuyển sang bước kiểm tra.</p></div>
      <div className="erp3-header-actions">
        <button type="button" onClick={() => void reload()}><RefreshCw size={15} /> Làm mới</button>
        <button type="button" className="erp3-primary" onClick={() => { setError(""); setUploadOpen(true); }}><Upload size={15} /> Tải hóa đơn lên</button>
      </div>
    </header>
    {error && <p role="alert" style={{ color: "#b91c1c", padding: "0 18px" }}>{error}</p>}
    {purchaseContext.length > 0 && <p style={{ padding: "0 18px", color: "#475569" }}>
      Ngữ cảnh chứng từ mua: {purchaseContext.map((item) => `${item.code} (${item.supplier})`).join(", ")}.
      Tải XML để tiếp nhận; chứng từ chưa được liên kết với hóa đơn.
    </p>}
    <div className="erp3-invoice-layout">
      <section className="erp3-invoice-inbox" aria-label="Danh sách hóa đơn đầu vào">
        <div className="erp3-inbox-heading"><div><h3>Hộp thư hóa đơn</h3><span>{filtered.length} hóa đơn</span></div>
          <button type="button" onClick={() => setFilterOpen(!filterOpen)}><Filter size={14} /> Lọc</button></div>
        {filterOpen && <label style={{ display: "block", padding: "8px 12px" }}>Trạng thái
          <select aria-label="Lọc trạng thái hóa đơn" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">Tất cả</option><option value="PENDING_CHECK">Chờ kiểm tra</option>
            <option value="NEEDS_REVIEW">Cần xem lại</option><option value="MANUAL_REVIEW">Cần kiểm tra thủ công</option>
            <option value="FAILED">Không đạt</option><option value="PASSED">Đạt kiểm tra</option>
            <option value="WARNING">Có cảnh báo</option>
          </select></label>}
        <label className="erp3-search"><Search size={14} /><input aria-label="Tìm hóa đơn đầu vào"
          placeholder="Số hóa đơn, nhà cung cấp…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        {filtered.length === 0 && <p style={{ padding: 18 }}>Chưa có hóa đơn phù hợp. Chọn “Tải hóa đơn lên” để tiếp nhận XML.</p>}
        {filtered.map((item) => <button type="button" key={item.id}
          className={`erp3-invoice-item ${selectedId === item.id ? "active" : ""}`}
          onClick={() => setSelectedId(item.id)}>
          <span><strong>{item.seller_name}</strong><small>{item.invoice_series} · {item.invoice_number} · {date(item.invoice_date)}</small></span>
          <span><b>{money(item.total_amount)}</b><small>{checkLabel[item.validation_summary?.processing_status || "PENDING_CHECK"] || "Chờ kiểm tra"}</small>
            <small>{linkLabel[item.link_status] || "Chưa liên kết"}</small></span>
        </button>)}
      </section>
      <section className="erp3-invoice-preview" aria-label="Xem trước hóa đơn">
        <div className="erp3-preview-toolbar"><span>Thông tin trích xuất từ XML</span>
          {selected?.source_filename && <button type="button" onClick={() => void downloadSource()}>Tải XML gốc</button>}</div>
        {selected ? <>
          <div className="erp3-paper">
            <p className="erp3-paper-kicker">HÓA ĐƠN ĐẦU VÀO · {checkLabel[selected.validation_summary?.processing_status || "PENDING_CHECK"]?.toLocaleUpperCase()}</p>
            <h3>{selected.seller_name}</h3>
            <p>Mẫu số {selected.raw_data?.invoice_template || "—"} · Ký hiệu {selected.invoice_series}</p>
            <dl><div><dt>Số hóa đơn</dt><dd>{selected.invoice_number}</dd></div>
              <div><dt>Ngày hóa đơn</dt><dd>{date(selected.invoice_date)}</dd></div>
              <div><dt>Mã số thuế người bán</dt><dd>{selected.seller_tax_code}</dd></div>
              <div><dt>Người mua</dt><dd>{selected.buyer_name}</dd></div>
              <div><dt>Mã số thuế người mua</dt><dd>{selected.buyer_tax_code || "—"}</dd></div></dl>
            <table><thead><tr><th>Nội dung</th><th>Tiền trước thuế</th><th>Thuế</th></tr></thead>
              <tbody>{(selected.raw_data?.parsed_lines || selected.lines).map((line) => <tr key={line.line_no}>
                <td>{line.description}</td><td>{money(line.taxable_amount)}</td><td>{money(line.tax_amount)}</td></tr>)}</tbody></table>
            <strong className="erp3-paper-total">Tổng thanh toán: {money(selected.total_amount)}</strong>
          </div>
          <aside className="erp3-validation"><h3>Kết quả kiểm tra</h3>
            <p>Trạng thái: {currentRun?.is_current ? checkLabel[currentRun.overall_status] || currentRun.overall_status :
              currentRun ? "Kết quả cũ; cần kiểm tra lại" : checkLabel[selected.validation_summary?.processing_status || "PENDING_CHECK"] || "Chờ kiểm tra"}</p>
            <p>Ngày tiếp nhận: {date(selected.received_at)}</p>
            <p>File nguồn: {selected.source_filename || "Không có"}</p>
            {(selected.validation_summary?.intake_warnings || []).map((warning, index) => <p key={index}>{warning}</p>)}
            <button type="button" className="erp3-primary" disabled={checking} onClick={() => void checkInvoice()}>
              {checking ? "Đang kiểm tra…" : currentRun ? "Kiểm tra lại" : "Kiểm tra hóa đơn"}</button>
            {currentRun ? <>
              <p>Phiên kiểm tra: {date(currentRun.completed_at)} · {currentRun.rule_set_version}</p>
              <div aria-label="Chi tiết kết quả kiểm tra">
                {currentRun.results.map((rule) => <p key={rule.id}>
                  <strong>{rule.code} · {resultLabel[rule.result] || rule.result}</strong> — {rule.message}
                </p>)}
              </div>
              {history && history.runs.length > 1 && <>
                <button type="button" onClick={() => setShowPreviousRuns(!showPreviousRuns)}>
                  {showPreviousRuns ? "Ẩn" : "Xem"} {history.runs.length - 1} lần kiểm tra trước
                </button>
                {showPreviousRuns && history.runs.slice(1).map((run) => <details key={run.id}>
                  <summary>{date(run.completed_at)} · {checkLabel[run.overall_status] || run.overall_status}</summary>
                  {run.results.map((rule) => <p key={rule.id}>{rule.code}: {resultLabel[rule.result] || rule.result} — {rule.message}</p>)}
                </details>)}
              </>}
            </> : <p>Chưa kiểm tra tính hợp lệ về thuế hoặc chữ ký số.</p>}
            <p>Điều kiện khấu trừ thuế và liên kết chứng từ được xử lý ở bước riêng.</p>
          </aside>
          <aside className="erp3-validation" aria-label="Liên kết chứng từ mua hàng">
            <h3>Liên kết chứng từ</h3>
            <p>Trạng thái: {linkLabel[linkSummary?.status || selected.link_status] || "Chưa liên kết"}</p>
            <p>Đã liên kết: {money(linkSummary?.linked_amount || 0)} · Còn lại: {money(linkSummary?.remaining_amount || selected.total_amount)}</p>
            {linkSummary?.links.map((link) => <div key={link.id} className="erp3-linked-document">
              <strong>{link.number}</strong> · {link.supplier} · {money(link.amount)}
              {link.conflict && <p>Chứng từ đã thay đổi hoặc không còn ở trạng thái ghi sổ; cần xem lại.</p>}
              {unlinkId === link.id ? <div>
                <input aria-label={`Lý do gỡ ${link.number}`} placeholder="Lý do gỡ liên kết" value={unlinkReason}
                  onChange={(event) => setUnlinkReason(event.target.value)} />
                <button type="button" disabled={linkBusy} onClick={() => void removeLink()}>Xác nhận gỡ</button>
                <button type="button" onClick={() => { setUnlinkId(""); setUnlinkReason(""); }}>Hủy</button>
              </div> : <button type="button" onClick={() => setUnlinkId(link.id)}>Gỡ liên kết</button>}
            </div>)}
            {!linkSummary?.links.length && <p>Chưa có chứng từ mua hàng được liên kết.</p>}
            <div className="erp3-preview-actions">
              <button type="button" disabled={!currentRun?.is_current || !["PASSED", "WARNING", "MANUAL_REVIEW"].includes(currentRun.overall_status)}
                onClick={() => void openLinkModal()}>Liên kết chứng từ</button>
              <button type="button" onClick={() => {
                sessionStorage.setItem("tax_link_invoice_context", selected.id);
                navigate("/purchases/transactions");
              }}>Lập chứng từ mua hàng</button>
            </div>
            {currentRun?.overall_status === "MANUAL_REVIEW" && <p>Cần ghi lý do đối chiếu thủ công khi liên kết.</p>}
          </aside>
        </> : <p style={{ padding: 24 }}>Chọn hóa đơn trong hộp thư để xem chi tiết.</p>}
      </section>
    </div>
    {uploadOpen && <div className="erp3-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUploadOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="Tải hóa đơn XML lên" style={{ background: "white", maxWidth: 440, margin: "12vh auto", padding: 24, borderRadius: 8, boxShadow: "0 16px 48px #0003" }}>
        <h3>Tải hóa đơn XML lên</h3><p>Chọn file hóa đơn thật để tiếp nhận. Hóa đơn sẽ ở trạng thái chờ kiểm tra.</p>
        <label style={{ display: "block", margin: "12px 0" }}>Chi nhánh
          <select aria-label="Chi nhánh tiếp nhận" value={branchId} onChange={(event) => setBranchId(event.target.value)} style={{ display: "block", width: "100%" }}>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select></label>
        <label style={{ display: "block", margin: "12px 0" }}>File XML
          <input aria-label="File hóa đơn XML" type="file" accept=".xml,text/xml,application/xml" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setUploadOpen(false)}>Hủy</button>
          <button type="button" className="erp3-primary" disabled={busy || !file || !branchId} onClick={() => void upload()}>{busy ? "Đang tải…" : "Tiếp nhận"}</button>
        </div>
      </section></div>}
    {linkOpen && selected && <div className="erp3-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLinkOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="Liên kết chứng từ mua hàng" className="erp3-link-dialog">
        <header><h3>Liên kết chứng từ mua hàng</h3><p>Hóa đơn {selected.invoice_series} · {selected.invoice_number} · {selected.seller_name}</p>
          <p>Còn lại trên hóa đơn: {money(linkSummary?.remaining_amount || selected.total_amount)}</p></header>
        <label className="erp3-search"><Search size={14} /><input aria-label="Tìm chứng từ mua hàng"
          placeholder="Số chứng từ, nhà cung cấp, diễn giải…" value={candidateSearch}
          onChange={(event) => setCandidateSearch(event.target.value)} /></label>
        <div className="erp3-link-candidates">
          {candidates.filter((item) => `${item.number} ${item.supplier} ${item.description}`.toLocaleLowerCase()
            .includes(candidateSearch.toLocaleLowerCase())).map((item) => <label key={item.id} className="erp3-link-candidate">
              <input type="radio" name="purchase-candidate" value={item.id} checked={candidateId === item.id}
                onChange={() => chooseCandidate(item)} />
              <span><strong>{item.number}</strong> · {item.supplier}<small>
                Ngày chứng từ {date(item.document_date)} · Ngày hạch toán {date(item.posting_date)}</small>
                <small>{item.description || "Không có diễn giải"}</small>
                <small>{item.match_reasons.join(" · ")}</small></span>
              <span><strong>{money(item.remaining_amount)}</strong><small>Còn trên chứng từ · Gợi ý {item.score}/100</small></span>
            </label>)}
          {candidates.length === 0 && <p>Chưa tìm thấy chứng từ mua hàng đã ghi sổ, cùng MST nhà cung cấp và còn giá trị để liên kết.</p>}
        </div>
        {chosenCandidate && <div className="erp3-link-allocation">
          <h4>Phân bổ cho {chosenCandidate.number}</h4>
          <p>Hóa đơn còn {money(linkSummary?.remaining_amount || selected.total_amount)}; chứng từ còn {money(chosenCandidate.remaining_amount)}.</p>
          <label>Tiền trước thuế <input aria-label="Tiền trước thuế liên kết" type="number" min="0" step="0.01"
            value={beforeTax} onChange={(event) => setBeforeTax(event.target.value)} /></label>
          <label>Tiền thuế <input aria-label="Tiền thuế liên kết" type="number" min="0" step="0.01"
            value={taxAllocation} onChange={(event) => setTaxAllocation(event.target.value)} /></label>
          <p>Tổng liên kết: {money(Number(beforeTax || 0) + Number(taxAllocation || 0))}</p>
          <label>Ghi chú / lý do đối chiếu <input aria-label="Ghi chú liên kết" value={linkNotes}
            onChange={(event) => setLinkNotes(event.target.value)} placeholder="Cần ghi lý do nếu hóa đơn chờ xem xét thủ công" /></label>
        </div>}
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        <footer><button type="button" onClick={() => {
          sessionStorage.setItem("tax_link_invoice_context", selected.id);
          navigate("/purchases/transactions");
        }}>Lập chứng từ mua hàng</button>
          <span />
          <button type="button" onClick={() => setLinkOpen(false)}>Hủy</button>
          <button type="button" className="erp3-primary" disabled={linkBusy || !chosenCandidate} onClick={() => void saveLink()}>
            {linkBusy ? "Đang lưu…" : "Xác nhận liên kết"}</button></footer>
      </section>
    </div>}
  </div>;
}
