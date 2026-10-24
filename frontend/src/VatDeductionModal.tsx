import { useCallback, useEffect, useState } from "react";
import { Calculator, X } from "lucide-react";
import { request } from "./live-api";

type Period = { id: string; code: string; tax_type: string; start_date: string; end_date: string; status: string };
type Account = { id: string; code: string; name: string };
type Source = { ledger_id: string; invoice_id: string | null; invoice_number: string; direction: string;
  tax_rate: string; tax_amount: string; deductible_tax_amount: string; decision: string; reason: string };
type Document = { id: string; amount: string; status: string; input_account_code: string; output_account_code: string };
type Calculation = { id: string; version: number; period_code: string; status: string; source_is_current: boolean;
  input_tax_amount: string; input_deductible_amount: string; input_pending_amount: string;
  output_tax_amount: string; carry_forward_in: string; deducted_amount: string; payable_amount: string;
  carry_forward_out: string; warnings: string[]; sources: Source[]; document: Document | null };
type List<T> = T[] | { results: T[] };
const rows = <T,>(value: List<T>): T[] => Array.isArray(value) ? value : value.results;
const money = (value?: string) => value === undefined ? "—" : `${Number(value).toLocaleString("vi-VN")} đ`;
const field = { height: 32, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px", background: "white" };

export default function VatDeductionModal({ companyId, periodHint, token, notify, onClose }: {
  companyId: string; periodHint: string; token: string; notify: (message: string) => void; onClose: () => void;
}) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [newPeriodCode, setNewPeriodCode] = useState(/^\d{4}-\d{2}$/.test(periodHint) ? periodHint : "");
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [calculationId, setCalculationId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [inputAccount, setInputAccount] = useState("");
  const [outputAccount, setOutputAccount] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [postingDate, setPostingDate] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const chosenPeriod = periods.find((row) => row.id === periodId);
  const calculation = calculations.find((row) => row.id === calculationId) || calculations[0];
  const loadPeriods = useCallback(async () => {
    if (!token || !companyId) return;
    setLoading(true); setError("");
    try {
      const [periodList, accountList] = await Promise.all([
        request<List<Period>>(`/api/v1/tax/periods/?company_id=${companyId}`, token),
        request<Account[]>(`/api/v1/tax/vat-calculations/accounts/?company_id=${companyId}`, token),
      ]);
      const vatPeriods = rows(periodList).filter((row) => row.tax_type === "VAT").sort((a, b) => b.start_date.localeCompare(a.start_date));
      setPeriods(vatPeriods);
      setPeriodId((current) => current && vatPeriods.some((row) => row.id === current) ? current :
        vatPeriods.find((row) => row.code === periodHint)?.id || vatPeriods[0]?.id || "");
      setAccounts(accountList);
      setInputAccount((value) => value || accountList.find((row) => row.code.startsWith("133"))?.id || "");
      setOutputAccount((value) => value || accountList.find((row) => row.code.startsWith("3331"))?.id || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được kỳ thuế."); }
    finally { setLoading(false); }
  }, [companyId, periodHint, token]);
  useEffect(() => { void loadPeriods(); }, [loadPeriods]);
  const loadCalculations = useCallback(async () => {
    if (!periodId || !token) { setCalculations([]); return; }
    setLoading(true); setError("");
    try {
      const data = await request<List<Calculation>>(`/api/v1/tax/vat-calculations/?company_id=${companyId}&period_id=${periodId}`, token);
      const next = rows(data);
      setCalculations(next);
      setCalculationId(next[0]?.id || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được kết quả tổng hợp."); }
    finally { setLoading(false); }
  }, [companyId, periodId, token]);
  useEffect(() => { void loadCalculations(); }, [loadCalculations]);
  const createPeriod = async () => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(newPeriodCode)) { setError("Chọn kỳ tháng hợp lệ."); return; }
    const [year, month] = newPeriodCode.split("-").map(Number);
    setBusy(true); setError("");
    try {
      const created = await request<Period>(`/api/v1/tax/periods/?company_id=${companyId}`, token, {
        method: "POST", body: JSON.stringify({ company: companyId, code: newPeriodCode, tax_type: "VAT",
          start_date: `${newPeriodCode}-01`, end_date: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) }),
      });
      await loadPeriods(); setPeriodId(created.id);
      notify(`Đã tạo kỳ GTGT ${newPeriodCode}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tạo được kỳ thuế."); }
    finally { setBusy(false); }
  };
  const calculate = async () => {
    if (!periodId) return;
    setBusy(true); setError("");
    try {
      const created = await request<Calculation>(`/api/v1/tax/vat-calculations/calculate/?company_id=${companyId}`, token,
        { method: "POST", body: JSON.stringify({ company: companyId, period: periodId }) });
      setCalculations((current) => [created, ...current]); setCalculationId(created.id);
      notify(created.status === "CALCULATED" ? "Đã tổng hợp VAT từ nguồn hóa đơn." : "Đã tính và ghi nhận các khoản cần rà soát.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tính được VAT."); }
    finally { setBusy(false); }
  };
  const createDocument = async () => {
    if (!calculation || !inputAccount || !outputAccount) return;
    setBusy(true); setError("");
    try {
      const document = await request<Document>(`/api/v1/tax/vat-calculations/${calculation.id}/deduction-document/?company_id=${companyId}`, token,
        { method: "POST", body: JSON.stringify({ input_account: inputAccount, output_account: outputAccount,
          document_date: documentDate || chosenPeriod?.end_date, posting_date: postingDate || chosenPeriod?.end_date,
          description: `Khấu trừ thuế GTGT kỳ ${chosenPeriod?.code || ""}` }) });
      setCalculations((current) => current.map((row) => row.id === calculation.id ? { ...row, document } : row));
      notify("Đã tạo chứng từ khấu trừ dạng nháp. Chưa ghi sổ kế toán.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tạo được chứng từ."); }
    finally { setBusy(false); }
  };
  const canCreate = calculation?.status === "CALCULATED" && calculation.source_is_current &&
    Number(calculation.deducted_amount) > 0 && !calculation.document && chosenPeriod?.status === "OPEN" &&
    Boolean(inputAccount && outputAccount);
  return <div className="misa-modal-overlay"><div className="misa-modal-card" role="dialog" aria-modal="true"
    aria-label="Khấu trừ thuế GTGT đầu vào và đầu ra" style={{ width: 720, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
    <header style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Calculator size={18} color="#00a862" /><h3 style={{ margin: 0, fontSize: 16 }}>Khấu trừ thuế GTGT đầu vào và đầu ra</h3></div>
      <button type="button" aria-label="Đóng" onClick={onClose} style={{ border: 0, background: "none", cursor: "pointer" }}><X size={18} /></button>
    </header>
    <div style={{ padding: "18px 22px", display: "grid", gap: 13, fontSize: 13 }}>
      <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: 12, borderRadius: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>Kỳ thuế GTGT
          <select aria-label="Kỳ thuế GTGT" style={field} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {!periods.length && <option value="">Chưa có kỳ GTGT</option>}
            {periods.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.status}</option>)}
          </select></label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input aria-label="Tháng GTGT mới" type="month" style={field} value={newPeriodCode} onChange={(e) => setNewPeriodCode(e.target.value)} />
          {!periods.some((row) => row.code === newPeriodCode) && <button type="button" disabled={busy || !token || !newPeriodCode} onClick={() => void createPeriod()}>Tạo kỳ tháng {newPeriodCode}</button>}
        </div>
        <p style={{ margin: "8px 0 0", color: "#476c5d" }}>Số liệu lấy từ các dòng VAT có nguồn hóa đơn và lưu theo phiên bản. Chứng từ khấu trừ được tạo riêng ở trạng thái nháp.</p>
      </div>
      {error && <div role="alert" style={{ color: "#b42318", background: "#fff0ed", padding: 9 }}>{error} <button onClick={() => { void loadPeriods(); void loadCalculations(); }}>Thử lại</button></div>}
      {!periodId && !loading && <p>Chưa có kỳ thuế GTGT. Tạo kỳ tháng để bắt đầu tổng hợp.</p>}
      {periodId && <><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>{calculation ? `Phiên bản ${calculation.version} · ${calculation.status === "CALCULATED" ? "Đã tính" : "Cần rà soát"}${calculation.source_is_current ? "" : " · Nguồn đã thay đổi"}` : "Chưa có kết quả tính"}</span>
        <div style={{ display: "flex", gap: 7 }}><select aria-label="Phiên bản tổng hợp VAT" style={field} value={calculation?.id || ""} onChange={(e) => setCalculationId(e.target.value)}>
          {!calculations.length && <option value="">Chưa có phiên bản</option>}{calculations.map((row) => <option key={row.id} value={row.id}>Bản {row.version}</option>)}</select>
          <button type="button" disabled={busy || chosenPeriod?.status !== "OPEN"} onClick={() => void calculate()}>Tính lại</button></div>
      </div>
      {calculation && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[["VAT đầu vào phát sinh", calculation.input_tax_amount], ["VAT đầu vào đủ điều kiện", calculation.input_deductible_amount],
          ["VAT đầu vào chờ rà soát", calculation.input_pending_amount], ["VAT đầu ra", calculation.output_tax_amount],
          ["Chuyển từ kỳ trước", calculation.carry_forward_in], ["Khấu trừ trong kỳ", calculation.deducted_amount],
          ["Còn phải nộp", calculation.payable_amount], ["Chuyển kỳ sau", calculation.carry_forward_out]].map(([label, value]) =>
            <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 11 }}><div style={{ color: "#64748b" }}>{label}</div>
              <strong style={{ fontSize: 16, color: label === "Khấu trừ trong kỳ" ? "#00a862" : "#334155" }}>{money(value)}</strong></div>)}</div>
        {!!calculation.warnings.length && <div style={{ padding: 11, borderRadius: 6, background: "#fff7e6", color: "#7c4a03" }}>
          <strong>Cần rà soát</strong>{calculation.warnings.map((item) => <p key={item} style={{ margin: "6px 0" }}>{item}</p>)}</div>}
        <button type="button" onClick={() => setShowSources((value) => !value)} style={{ justifySelf: "start" }}>{showSources ? "Ẩn chi tiết nguồn" : `Xem chi tiết nguồn (${calculation.sources.length})`}</button>
        {showSources && <div style={{ maxHeight: 180, overflow: "auto", border: "1px solid #e2e8f0", padding: 8 }}>
          {calculation.sources.map((row) => <p key={row.ledger_id} style={{ margin: "7px 0" }}>{row.direction === "INPUT" ? "Đầu vào" : "Đầu ra"} · {row.invoice_number || row.invoice_id} · VAT {row.tax_rate}% · {money(row.tax_amount)} · {row.decision} · {row.reason}</p>)}
          {!calculation.sources.length && <p>Chưa có dòng VAT nguồn.</p>}</div>}
        {calculation.document ? <p>Chứng từ nháp {calculation.document.id} · {money(calculation.document.amount)} · Nợ {calculation.document.output_account_code} / Có {calculation.document.input_account_code}. Chưa ghi sổ.</p> :
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><select aria-label="Tài khoản VAT đầu vào" style={field} value={inputAccount} onChange={(e) => setInputAccount(e.target.value)}>
            <option value="">Chọn TK đầu vào</option>{accounts.filter((row) => row.code.startsWith("133")).map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select>
            <select aria-label="Tài khoản VAT đầu ra" style={field} value={outputAccount} onChange={(e) => setOutputAccount(e.target.value)}>
            <option value="">Chọn TK đầu ra</option>{accounts.filter((row) => row.code.startsWith("3331")).map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select>
            <label>Ngày chứng từ <input aria-label="Ngày chứng từ khấu trừ" type="date" style={field} value={documentDate || chosenPeriod?.end_date || ""} onChange={(e) => setDocumentDate(e.target.value)} /></label>
            <label>Ngày hạch toán <input aria-label="Ngày hạch toán khấu trừ" type="date" style={field} value={postingDate || chosenPeriod?.end_date || ""} onChange={(e) => setPostingDate(e.target.value)} /></label></div>}
      </>}</>}
    </div>
    <footer style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <button type="button" onClick={onClose}>Hủy</button>
      <button type="button" disabled={!canCreate || busy} onClick={() => void createDocument()}
        style={{ background: canCreate ? "#00a862" : "#9ca3af", color: "white", border: 0, borderRadius: 4, padding: "8px 16px", cursor: canCreate ? "pointer" : "default" }}>Tạo chứng từ khấu trừ</button>
    </footer>
  </div></div>;
}
