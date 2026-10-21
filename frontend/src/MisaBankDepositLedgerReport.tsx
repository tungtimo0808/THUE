import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, Columns, Mail, MinusSquare, PlusSquare, Printer, RefreshCw, Search, X } from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { CASH_PERIODS, cashPeriodDates, cashPeriodSubtitle } from "./cash-report-periods";
import { parseReportDate, formatReportDate } from "./report-date";
import "./bank-balance-report.css";

type Params = { period: string; from: string; to: string; account: string; bank: string; mergeSame: boolean; mergeVoucher: boolean; orderCreated: boolean; receiptFirst: boolean };
type Row = { journal_entry_id: string; journal_line_ids: string[]; source_entity_type: string; source_entity_id: string; posting_date: string; document_date: string; voucher_number: string; description: string; counter_account: string; receipt: string; payment: string; balance: string };
type Group = { id: string; bank_account_id: string; bank_account_no: string; bank_name: string; currency: string; opening_balance: string; receipt_total: string; payment_total: string; closing_balance: string; rows: Row[] };
type Report = { groups: Group[]; warnings: string[] };
type Options = { accounts: { code: string; name: string }[]; bank_accounts: { id: string; number: string; bank_name: string; gl_account_code: string; currency: string }[] };
type Preset = { id: string; name: string; parameters: Record<string, string | boolean> };
type Voucher = { number: string; posting_date: string; document_date: string; description: string; lines: { line_no: number; account_code: string; description: string; debit: string; credit: string }[] };
const defaults = (): Params => ({ period: "Tháng này", from: cashPeriodDates("Tháng này")![0], to: cashPeriodDates("Tháng này")![1], account: "1121", bank: "", mergeSame: true, mergeVoucher: false, orderCreated: true, receiptFirst: false });
const money = (value: string | number | undefined) => value === undefined || value === "" ? "" : Number(value) < 0 ? `(${Math.abs(Number(value)).toLocaleString("vi-VN")})` : Number(value).toLocaleString("vi-VN");
const button: React.CSSProperties = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 4, padding: "6px 10px", color: "#334155", cursor: "pointer", fontSize: 12.5 };
const field: React.CSSProperties = { width: "100%", height: 34, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 9px", background: "#fff", fontSize: 13 };
const cell: React.CSSProperties = { border: "1px solid #e2e8f0", padding: "7px 10px" };
const columns = ["Ngày hạch toán", "Ngày chứng từ", "Số chứng từ", "Diễn giải", "TK đối ứng", "Thu", "Chi", "Tồn"];

export default function MisaBankDepositLedgerReport({ onBack, notify }: { onBack: () => void; notify?: (message: string) => void }) {
  const { token, companyId: sessionCompanyId, companies } = useApiSession();
  const [searchParams] = useSearchParams();
  const requestedCompany = searchParams.get("company");
  const companyId = companies.some(company => company.id === requestedCompany) ? requestedCompany! : sessionCompanyId;
  const [params, setParams] = useState<Params>(defaults);
  const [draft, setDraft] = useState<Params>(defaults);
  const [drawer, setDrawer] = useState(false);
  const [options, setOptions] = useState<Options>({ accounts: [], bank_accounts: [] });
  const [report, setReport] = useState<Report>({ groups: [], warnings: [] });
  const [error, setError] = useState("");
  const [paramError, setParamError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [showColumns, setShowColumns] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showPresets, setShowPresets] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState({ to: "", subject: "Sổ tiền gửi ngân hàng", body: "" });
  const query = (p: Params, keyword = "") => new URLSearchParams({ company_id: companyId, account_code: p.account, date_from: parseReportDate(p.from), date_to: parseReportDate(p.to), ...(p.bank && { bank_account_id: p.bank }), merge_same: String(p.mergeSame), merge_voucher: String(p.mergeVoucher), order_created: String(p.orderCreated), receipt_first: String(p.receiptFirst), ...(keyword && { search: keyword }) });
  const load = async (p: Params, refreshed = false) => {
    if (!token || !companyId) return false;
    setLoading(true); setError("");
    try {
      const result = await request<Report>(`/api/v1/bank/deposit-ledger/summary/?${query(p)}`, token);
      setReport(result); setPage(1);
      if (refreshed) notify?.("Đã cập nhật Sổ tiền gửi ngân hàng.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu sổ tiền gửi ngân hàng. Vui lòng thử lại.");
      return false;
    } finally { setLoading(false); }
  };
  useEffect(() => {
    if (!token || !companyId) return;
    request<Options>(`/api/v1/bank/deposit-ledger/options/?company_id=${encodeURIComponent(companyId)}`, token).then(setOptions).catch(() => setError("Không thể tải danh sách tài khoản ngân hàng."));
    void load(defaults());
  }, [token, companyId]);
  const apply = async () => {
    if (!draft.account) { setParamError("Vui lòng chọn tài khoản kế toán."); return; }
    if (!parseReportDate(draft.from) || !parseReportDate(draft.to)) { setParamError("Vui lòng nhập ngày hợp lệ theo định dạng DD/MM/YYYY."); return; }
    if (parseReportDate(draft.from) > parseReportDate(draft.to)) { setParamError("Từ ngày không được lớn hơn Đến ngày."); return; }
    if (!options.accounts.some(account => account.code === draft.account)) { setParamError("Tài khoản kế toán không hợp lệ."); return; }
    if (draft.bank && !options.bank_accounts.some(bank => bank.id === draft.bank && bank.gl_account_code.startsWith(draft.account))) { setParamError("Tài khoản ngân hàng không phù hợp với tài khoản kế toán đã chọn."); return; }
    if (await load(draft, true)) { setParams(draft); setDrawer(false); setParamError(""); setSearch(""); }
  };
  const filtered = useMemo(() => report.groups.map(group => ({ ...group, rows: group.rows.filter(row => `${row.voucher_number} ${row.description}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"))) })).filter(group => !search.trim() || group.rows.length > 0), [report.groups, search]);
  const rowCount = filtered.reduce((count, group) => count + group.rows.length, 0);
  const pageCount = Math.max(1, Math.ceil(rowCount / pageSize));
  const pageGroups = useMemo(() => { let index = 0; return filtered.map(group => ({ ...group, rows: group.rows.filter(() => { const include = index >= (page - 1) * pageSize && index < page * pageSize; index++; return include; }) })).filter(group => group.rows.length > 0 || (page === 1 && rowCount === 0)); }, [filtered, page, pageSize, rowCount]);
  const exportExcel = async () => {
    try {
      const response = await fetch(`/api/v1/bank/deposit-ledger/export/?${query(params, search.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Xuất báo cáo thất bại. Vui lòng thử lại.");
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "so-tien-gui-ngan-hang.xlsx"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Xuất báo cáo thất bại."); }
  };
  const save = async () => {
    try {
      await request(`/api/v1/bank/deposit-ledger/save/?${query(params)}`, token, { method: "POST", body: JSON.stringify({ period_preset: params.period, bank_account_id: params.bank, merge_same: params.mergeSame, merge_voucher: params.mergeVoucher, order_created: params.orderCreated, receipt_first: params.receiptFirst, search }) });
      setError(""); notify?.("Đã lưu báo cáo thành công.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể lưu báo cáo."); }
  };
  const showSaved = async () => {
    try { setPresets(await request<Preset[]>(`/api/v1/bank/deposit-ledger/presets/?company_id=${encodeURIComponent(companyId)}`, token)); setShowPresets(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không tải được báo cáo đã lưu."); }
  };
  const selectPreset = async (preset: Preset) => {
    const p = preset.parameters;
    const value: Params = { period: String(p.period_preset || "Tùy chọn"), from: formatReportDate(String(p.date_from || "")), to: formatReportDate(String(p.date_to || "")), account: String(p.account_code || "1121"), bank: String(p.bank_account_id || ""), mergeSame: p.merge_same !== false, mergeVoucher: p.merge_voucher === true, orderCreated: p.order_created !== false, receiptFirst: p.receipt_first === true };
    if (await load(value)) { setParams(value); setSearch(String(p.search || "")); setShowPresets(false); }
  };
  const sendEmail = async () => {
    try { await request(`/api/v1/bank/deposit-ledger/email/?${query(params, search.trim())}`, token, { method: "POST", body: JSON.stringify(email) }); setEmailOpen(false); setError(""); notify?.("Đã gửi email báo cáo."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Gửi email thất bại."); }
  };
  const openDetail = async (row: Row) => {
    setDetail(row); setVoucher(null); setError("");
    try { setVoucher(await request<Voucher>(`/api/v1/bank/deposit-ledger/voucher/${row.journal_entry_id}/?${query(params)}`, token)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể mở chi tiết chứng từ."); }
  };
  const visible = (name: string) => !hidden.includes(name);
  const toggleColumn = (name: string) => setHidden(old => old.includes(name) ? old.filter(item => item !== name) : [...old, name]);
  const allCollapsed = report.groups.length > 0 && collapsed.length === report.groups.length;
  return <div className="bank-balance-report" style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff", color: "#1e293b", fontFamily: "inherit" }}>
    <div className="bank-balance-report-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid #e2e8f0" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><button style={{ ...button, border: 0 }} onClick={onBack} title="Quay lại"><ChevronLeft size={18}/></button><strong style={{ fontSize: 14.5 }}>Sổ tiền gửi ngân hàng</strong></div><div style={{ display: "flex", gap: 10 }}><button style={button} onClick={showSaved}>Danh sách báo cáo đã lưu</button><button style={button} onClick={save}>Lưu báo cáo</button><button style={{ ...button, background: "#00a862", borderColor: "#00a862", color: "#fff" }} onClick={() => { setDraft({ ...params }); setParamError(""); setDrawer(true); }}>Chọn tham số</button></div></div>
    <div className="bank-balance-report-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 20px", borderBottom: "1px solid #e2e8f0" }}><div style={{ display: "flex", gap: 6 }}><button style={button} title={allCollapsed ? "Mở rộng nhóm" : "Thu gọn nhóm"} onClick={() => setCollapsed(allCollapsed ? [] : report.groups.map(group => group.id))}>{allCollapsed ? <PlusSquare size={16}/> : <MinusSquare size={16}/>}</button><button style={button} title="Tùy chỉnh cột" onClick={() => setShowColumns(true)}><Columns size={16}/></button></div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ position: "relative" }}><Search size={14} style={{ position: "absolute", top: 10, left: 9, color: "#94a3b8" }}/><input aria-label="Nhập từ khóa tìm kiếm" placeholder="Nhập từ khóa tìm kiếm" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} style={{ ...field, width: 210, paddingLeft: 29 }}/></div><button style={button} title="Nạp lại" onClick={() => void load(params, true)}><RefreshCw size={16}/></button><button style={button} title="Gửi email" onClick={() => setEmailOpen(true)}><Mail size={16}/></button><button style={button} title="In" onClick={() => window.print()}><Printer size={16}/></button><button style={button} title="Xuất khẩu Excel" onClick={exportExcel}><b>XLS</b></button></div></div>
    <div style={{ textAlign: "center", padding: "16px 20px 10px" }}><strong style={{ fontSize: 14 }}>SỔ TIỀN GỬI NGÂN HÀNG</strong><div style={{ fontSize: 12.5, fontStyle: "italic", color: "#475569", marginTop: 4 }}>Tài khoản: {params.account}, {cashPeriodSubtitle(params.from, params.to)}</div></div>
    <div className="bank-balance-report-content" style={{ overflow: "auto", padding: "0 20px 16px", flex: 1 }}>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}{loading && <p>Đang tải dữ liệu...</p>}
      {!!report.warnings?.length && <div style={{ color: "#92400e", background: "#fffbeb", padding: 8, fontSize: 12 }}>Có {report.warnings.length} bút toán chưa xác định được tài khoản ngân hàng hoặc loại tiền: {report.warnings.join("; ")}</div>}
      {!loading && !report.groups.length && <p>Không có dữ liệu phù hợp với điều kiện đã chọn.</p>}
      <div className="ledger-screen-table" style={{ overflowX: "auto", border: "1px solid #cbd5e1" }}><table style={{ width: "100%", minWidth: 950, borderCollapse: "collapse", fontSize: 12.5 }}><thead><tr style={{ background: "#e2f0d9" }}>{columns.filter(visible).map(name => <th key={name} style={{ ...cell, textAlign: ["Thu", "Chi", "Tồn"].includes(name) ? "right" : "center" }}>{name}</th>)}</tr></thead><tbody>{pageGroups.map(group => <LedgerGroup key={group.id} group={group} filtered={filtered.find(item => item.id === group.id)!} collapsed={collapsed.includes(group.id)} visible={visible} search={search} onToggle={() => setCollapsed(old => old.includes(group.id) ? old.filter(id => id !== group.id) : [...old, group.id])} onDetail={openDetail}/>)}</tbody></table></div>
      <div className="ledger-print-table"><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}><thead><tr style={{ background: "#e2f0d9" }}>{columns.filter(visible).map(name => <th key={name} style={cell}>{name}</th>)}</tr></thead><tbody>{filtered.map(group => <LedgerGroup key={group.id} group={group} filtered={group} collapsed={false} visible={visible} search={search} onToggle={() => {}} onDetail={() => {}}/>)}</tbody></table></div>
      {search && <p style={{ fontSize: 12, color: "#475569" }}>Tổng theo từ khóa chỉ gồm các dòng khớp. Cột Tồn và Tổng cộng toàn kỳ vẫn theo toàn bộ phát sinh.</p>}
      <div className="bank-balance-report-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 4px", fontSize: 12 }}><span>Tổng số: {rowCount} dòng</span><div style={{ display: "flex", alignItems: "center", gap: 10 }}>Số dòng/trang <select aria-label="Số dòng/trang" style={button} value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10,20,50,100].map(value => <option key={value}>{value}</option>)}</select><button style={button} disabled={page === 1} onClick={() => setPage(1)}>|&lt;</button><button style={button} disabled={page === 1} onClick={() => setPage(page - 1)}>&lt;</button><span>{page}/{pageCount}</span><button style={button} disabled={page >= pageCount} onClick={() => setPage(page + 1)}>&gt;</button><button style={button} disabled={page >= pageCount} onClick={() => setPage(pageCount)}>&gt;|</button></div></div>
    </div>
    {drawer && <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#0007", display: "flex", justifyContent: "flex-end" }} onClick={() => setDrawer(false)}><div style={{ width: 520, height: "100%", background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-4px 0 16px #0002" }} onClick={event => event.stopPropagation()}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}><strong>Chọn tham số</strong><button style={{ ...button, border: 0 }} onClick={() => setDrawer(false)} aria-label="Đóng"><X size={18}/></button></div><div style={{ padding: 20, overflow: "auto", flex: 1, display: "grid", alignContent: "start", gap: 16 }}>
      {paramError && <p role="alert" style={{ color: "#b91c1c" }}>{paramError}</p>}
      <label>Kỳ báo cáo<select style={field} value={draft.period} onChange={event => { const period = event.target.value; const dates = cashPeriodDates(period); setDraft(old => ({ ...old, period, ...(dates ? { from: dates[0], to: dates[1] } : {}) })); }}>{CASH_PERIODS.map(period => <option key={period}>{period}</option>)}</select></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><label>Từ ngày<input aria-label="Từ ngày" style={field} value={draft.from} onChange={event => setDraft(old => ({ ...old, from: event.target.value, period: "Tùy chọn" }))}/></label><label>Đến ngày<input aria-label="Đến ngày" style={field} value={draft.to} onChange={event => setDraft(old => ({ ...old, to: event.target.value, period: "Tùy chọn" }))}/></label></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 12 }}><label>Tài khoản *<select aria-label="Tài khoản kế toán" style={field} value={draft.account} onChange={event => setDraft(old => ({ ...old, account: event.target.value, bank: "" }))}><option value="">Chọn tài khoản</option>{options.accounts.map(account => <option key={account.code} value={account.code}>{account.code} - {account.name}</option>)}</select></label><label>Tài khoản ngân hàng<select aria-label="Tài khoản ngân hàng" style={field} value={draft.bank} onChange={event => setDraft(old => ({ ...old, bank: event.target.value }))}><option value="">(Tất cả)</option>{options.bank_accounts.filter(bank => bank.gl_account_code.startsWith(draft.account)).map(bank => <option key={bank.id} value={bank.id}>{bank.number} - {bank.bank_name} ({bank.currency})</option>)}</select></label></div>
      {([ ["mergeSame", "Cộng gộp các bút toán giống nhau"], ["mergeVoucher", "Cộng gộp theo chứng từ"], ["orderCreated", "Sắp xếp chứng từ theo thứ tự lập"], ["receiptFirst", "Sắp xếp chứng từ thu trước chứng từ chi trong cùng một ngày"] ] as const).map(([key, title]) => <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={draft[key]} onChange={event => setDraft(old => ({ ...old, [key]: event.target.checked }))}/>{title}</label>)}
      </div><div style={{ display: "flex", justifyContent: "space-between", padding: 20, borderTop: "1px solid #e2e8f0" }}><button style={button} onClick={() => { setDraft(defaults()); setParamError(""); }}>Xóa điều kiện</button><div style={{ display: "flex", gap: 8 }}><button style={button} onClick={() => setDrawer(false)}>Hủy</button><button style={{ ...button, background: "#00a862", color: "#fff", borderColor: "#00a862" }} onClick={apply}>Xem báo cáo</button></div></div></div></div>}
    {showColumns && <Modal title="Tùy chỉnh cột hiển thị" close={() => setShowColumns(false)}>{columns.map(name => <label key={name} style={{ display: "block", margin: 8 }}><input type="checkbox" checked={visible(name)} onChange={() => toggleColumn(name)}/> {name}</label>)}</Modal>}
    {showPresets && <Modal title="Danh sách báo cáo đã lưu" close={() => setShowPresets(false)}>{presets.length ? presets.map(preset => <button key={preset.id} style={{ ...button, display: "block", width: "100%", textAlign: "left", marginTop: 10 }} onClick={() => void selectPreset(preset)}>{preset.name}</button>) : <p>Chưa có báo cáo đã lưu.</p>}</Modal>}
    {detail && <Modal title={`Chi tiết chứng từ ${detail.voucher_number}`} close={() => setDetail(null)}>{error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}<p>Ngày hạch toán: {formatReportDate(detail.posting_date)}</p><p>Ngày chứng từ: {formatReportDate(detail.document_date)}</p><p>Diễn giải: {detail.description}</p><p>Thu: {money(detail.receipt)} · Chi: {money(detail.payment)} · Tồn: {money(detail.balance)}</p>{voucher ? <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}><thead><tr>{["TK", "Diễn giải", "Nợ", "Có"].map(name => <th key={name} style={cell}>{name}</th>)}</tr></thead><tbody>{voucher.lines.map(line => <tr key={line.line_no}><td style={cell}>{line.account_code}</td><td style={cell}>{line.description}</td><td style={cell}>{money(line.debit)}</td><td style={cell}>{money(line.credit)}</td></tr>)}</tbody></table> : !error && <p>Đang tải bút toán...</p>}</Modal>}
    {emailOpen && <Modal title="Gửi email sổ tiền gửi ngân hàng" close={() => setEmailOpen(false)}>{error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}<label>Người nhận<input type="email" style={field} value={email.to} onChange={event => setEmail(old => ({ ...old, to: event.target.value }))}/></label><label>Tiêu đề<input style={field} value={email.subject} onChange={event => setEmail(old => ({ ...old, subject: event.target.value }))}/></label><label>Nội dung<textarea style={{ ...field, height: 90, padding: 9 }} value={email.body} onChange={event => setEmail(old => ({ ...old, body: event.target.value }))}/></label><p>Đính kèm: so-tien-gui-ngan-hang.xlsx</p><button style={{ ...button, background: "#00a862", color: "#fff" }} onClick={sendEmail}>Gửi email</button></Modal>}
  </div>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) { return <div className="bank-report-dialog" style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#0007", display: "grid", placeItems: "center" }}><div style={{ background: "#fff", padding: 24, width: 460, maxHeight: "80vh", overflow: "auto", display: "grid", gap: 10 }}><div style={{ display: "flex", justifyContent: "space-between" }}><strong>{title}</strong><button style={button} onClick={close}>Đóng</button></div>{children}</div></div>; }

function LedgerGroup({ group, filtered, collapsed, visible, search, onToggle, onDetail }: { group: Group; filtered: Group; collapsed: boolean; visible: (name: string) => boolean; search: string; onToggle: () => void; onDetail: (row: Row) => void }) {
  const shown = columns.filter(visible);
  const amountStyle = (value: string) => ({ ...cell, textAlign: "right" as const, color: Number(value) < 0 ? "#dc2626" : "#1e293b" });
  const values = (row: Row) => [formatReportDate(row.posting_date), formatReportDate(row.document_date), row.voucher_number, row.description, row.counter_account, money(row.receipt), money(row.payment), money(row.balance)];
  const sum = (field: "receipt" | "payment") => filtered.rows.reduce((total, row) => total + Number(row[field]), 0);
  return <><tr style={{ background: "#fff", fontWeight: 700 }}><td colSpan={shown.length} style={cell}><button onClick={onToggle} style={{ border: 0, background: "none", cursor: "pointer", fontWeight: 700 }}>{collapsed ? "▸" : "▾"} Tài khoản ngân hàng: {group.bank_account_no} - {group.bank_name} ({group.currency})</button></td></tr>{!collapsed && <><tr>{shown.map(name => <td key={name} style={{ ...cell, fontWeight: 700, ...(name === "Tồn" ? amountStyle(group.opening_balance) : {}) }}>{name === "Diễn giải" ? "Số dư đầu kỳ" : name === "Tồn" ? money(group.opening_balance) : ""}</td>)}</tr>{group.rows.map(row => <tr key={row.journal_line_ids.join("-")}>{shown.map(name => <td key={name} style={["Thu", "Chi", "Tồn"].includes(name) ? amountStyle(name === "Tồn" ? row.balance : name === "Thu" ? row.receipt : row.payment) : cell}>{name === "Số chứng từ" ? <button style={{ color: "#0284c7", cursor: "pointer", background: "none", border: 0 }} onClick={() => onDetail(row)}>{row.voucher_number}</button> : values(row)[columns.indexOf(name)]}</td>)}</tr>)}<tr style={{ background: "#f8fafc", fontWeight: 700 }}>{shown.map(name => <td key={name} style={["Thu", "Chi", "Tồn"].includes(name) ? amountStyle(name === "Tồn" ? group.closing_balance : "0") : cell}>{name === "Diễn giải" ? "Tổng cộng toàn kỳ" : name === "Thu" ? money(group.receipt_total) : name === "Chi" ? money(group.payment_total) : name === "Tồn" ? money(group.closing_balance) : ""}</td>)}</tr>{search && <tr style={{ background: "#eff6ff" }}>{shown.map(name => <td key={name} style={cell}>{name === "Diễn giải" ? "Tổng các dòng tìm kiếm" : name === "Thu" ? money(sum("receipt")) : name === "Chi" ? money(sum("payment")) : ""}</td>)}</tr>}</>}</>;
}
