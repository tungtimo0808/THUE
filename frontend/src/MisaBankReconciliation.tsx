import { useEffect, useMemo, useState } from "react";
import ReportDateInput from "./ReportDateInput";
import { parseReportDate } from "./report-date";
import { reconciliationAmounts } from "./bank-reconciliation";
import type { ReconciliationTransaction } from "./bank-reconciliation";
import { useMisaApiLists } from "./misa-api-lists";
import { useApiSession } from "./ApiSession";
import { ExcelImportModal } from "./MisaBankModals";
import BankStatementLines from "./BankStatementLines";
import BankMatchDialog from "./BankMatchDialog";
import BankUnmatchedTransactions from "./BankUnmatchedTransactions";
import { request } from "./live-api";
import "./misa-bank-reconciliation.css";
type PeriodPreview = { opening_balance: string; last_confirmed_date: string | null; has_statement: boolean; unmatched_count: number; transactions: Array<{
  id: string; date: string; number: string; amount: string; direction: "RECEIPT" | "PAYMENT"; counterparty: string; confirmed: boolean;
}> };
function readDraft(): {
  loaded: { from: string; to: string; account: string };
  selected: string[];
  statement: string;
} | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem("soviet:bank-reconciliation") || "null",
    );
    if (
      value?.loaded &&
      ["from", "to", "account"].every(
        (key) => typeof value.loaded[key] === "string",
      ) &&
      Array.isArray(value.selected) &&
      value.selected.every((id: unknown) => typeof id === "string") &&
      typeof value.statement === "string"
    )
      return value;
  } catch {}
  return null;
}
export default function MisaBankReconciliation({
  transactions,
  notify,
  companyId,
  onCreateVoucher,
  onOpenVoucher,
}: {
  transactions: ReconciliationTransaction[];
  notify: (text: string) => void;
  companyId: string;
  onCreateVoucher?: (kind: "receipt" | "payment", line: { account: string; accountNumber: string; date: string; amount: number; description: string; counterparty: string; counterpartyAccount: string; reference: string }) => void;
  onOpenVoucher?: (id: string, code: string) => void;
}) {
  const { token } = useApiSession();
  const { rows: apiRows, connected, reload } = useMisaApiLists(companyId, {
    profiles: "/api/v1/bank/accounts/", statements: "/api/v1/bank/statements/", statementLines: "/api/v1/bank/statement-lines/",
    bankTransactions: "/api/v1/bank/transactions/", matches: "/api/v1/bank/reconciliations/",
  }, notify);
  const [matchingLineId, setMatchingLineId] = useState("");
  const [saved] = useState(readDraft);
  const [tab, setTab] = useState(saved ? "offline" : "online");
  const [account, setAccount] = useState(saved?.loaded.account || "");
  const [from, setFrom] = useState(saved?.loaded.from || "2026-01-01");
  const [to, setTo] = useState(saved?.loaded.to || "2026-10-08");
  const [loaded, setLoaded] = useState<{
    from: string;
    to: string;
    account: string;
  } | null>(saved?.loaded || null);
  const [selected, setSelected] = useState<string[]>(saved?.selected || []);
  const [statement, setStatement] = useState(saved?.statement || "0");
  const [lastDate, setLastDate] = useState("");
  const [preview, setPreview] = useState<PeriodPreview | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [viewedImportId, setViewedImportId] = useState("");
  const statementLines = (apiRows.statementLines || []).filter((line) => (!account || line.account === account) && Number(line.remaining_amount) > 0 && !line.period_confirmed);
  const visibleImports = (apiRows.statements || []).filter((entry) => !account || entry.account === account);
  const viewedImport = visibleImports.find((entry) => entry.id === viewedImportId || entry.source_reference === viewedImportId);
  const downloadSource = async (entry: any) => {
    try {
      const branchId = (apiRows.profiles || []).find((profile) => profile.id === entry.account)?.branch_id;
      const path = `/api/v1/bank/statements/${entry.id}/source-file/?company_id=${encodeURIComponent(companyId)}${branchId ? `&branch_id=${encodeURIComponent(branchId)}` : ""}`;
      const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Không tải được tệp nguồn.");
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
      link.href = url; link.download = entry.raw_file?.file_name || entry.source_file || "sao-ke.xlsx"; link.click(); URL.revokeObjectURL(url);
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Không tải được tệp nguồn."); }
  };
  const matchingLine = (apiRows.statementLines || []).find((line) => line.id === matchingLineId);
  // Every statement line (matched or not), to describe past matches.
  const allStatementLines = new Map<string, any>((apiRows.statements || []).flatMap((entry) =>
    (entry.lines || []).map((line: any) => [line.id, { ...line, statementNumber: entry.source_reference, account: entry.account }] as [string, any])));
  const matchHistory: any[] = (apiRows.matches || [])
    .map((row: any) => ({ ...row, line: allStatementLines.get(row.statement_line), tx: (apiRows.bankTransactions || []).find((item) => item.id === row.transaction) }))
    .filter((row) => !account || row.line?.account === account)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const lastMatchDate = matchHistory[0]?.created_at ? new Date(matchHistory[0].created_at).toLocaleDateString("vi-VN") : "";
  useEffect(() => {
    if (!connected || !loaded || !token) { setPreview(null); return; }
    let active = true;
    const branchId = (apiRows.profiles || []).find((profile) => profile.id === loaded.account)?.branch_id;
    const query = new URLSearchParams({ company_id: companyId, account: loaded.account, date_from: loaded.from, date_to: loaded.to,
      ...(branchId && { branch_id: branchId }) });
    request<PeriodPreview>(`/api/v1/bank/reconciliation-periods/preview/?${query}`, token)
      .then((result) => { if (active) { setPreview(result); setSelected((previous) => previous.filter((id) => result.transactions.some((row) => row.id === id && !row.confirmed))); setError(""); } })
      .catch((caught) => { if (active) { setPreview(null); setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu đối chiếu."); } });
    return () => { active = false; };
  }, [connected, token, companyId, loaded, previewRevision, apiRows.profiles]);
  const rows = useMemo(
    () =>
      loaded
        ? connected ? (preview?.transactions || []).map((row) => ({
            id: row.id, code: row.number, dateHachToan: row.date.split("-").reverse().join("/"),
            amount: Number(row.amount), kind: row.direction === "RECEIPT" ? "receipt" : "payment",
            partner: row.counterparty, confirmed: row.confirmed,
          })) : transactions.filter((row) => {
            const date = parseReportDate(row.dateHachToan);
            return date >= loaded.from && date <= loaded.to;
          }).map((row) => ({ ...row, confirmed: false }))
        : [],
    [loaded, transactions, connected, preview],
  );
  const totals = reconciliationAmounts(
    rows,
    selected,
    connected ? Number(preview?.opening_balance || 0) : 0,
    Number(statement) || 0,
  );
  const money = (amount: number) => amount.toLocaleString("vi-VN");
  const load = () => {
    if (!account) {
      setError("Vui lòng chọn tài khoản ngân hàng.");
      return;
    }
    if (!parseReportDate(from) || !parseReportDate(to) || from > to) {
      setError("Vui lòng chọn khoảng ngày hợp lệ.");
      return;
    }
    setLoaded({ from, to, account });
    setSelected([]);
    setPreview(null);
    setError("");
  };
  const confirmPeriod = async () => {
    if (!loaded || !token || confirming) return;
    if (totals.difference !== 0) { setError("Số dư sau đối chiếu và sổ ngân hàng chưa khớp."); return; }
    const branchId = (apiRows.profiles || []).find((profile) => profile.id === loaded.account)?.branch_id;
    setConfirming(true); setError("");
    try {
      await request(`/api/v1/bank/reconciliation-periods/confirm/?company_id=${encodeURIComponent(companyId)}${branchId ? `&branch_id=${encodeURIComponent(branchId)}` : ""}`, token, {
        method: "POST", body: JSON.stringify({ account: loaded.account, date_from: loaded.from, date_to: loaded.to,
          transactions: selected, bank_closing_balance: statement }),
      });
      setLastDate(loaded.to.split("-").reverse().join("/"));
      setSelected([]); setPreviewRevision((value) => value + 1);
      notify("Đã xác nhận đối chiếu ngân hàng.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không xác nhận được đối chiếu."); }
    finally { setConfirming(false); }
  };
  const table = (kind: string, title: string) => {
    const entries = rows.filter((row) => row.kind === kind);
    const selectable = entries.filter((row) => !row.confirmed);
    const all =
      selectable.length > 0 && selectable.every((row) => selected.includes(row.id));
    return (
      <section className="br-table">
        <h3>{title}</h3>
        <table>
          <thead>
            <tr>
              <th>
                <input
                  aria-label={`Chọn tất cả ${title.toLowerCase()}`}
                  type="checkbox"
                  checked={all}
                  onChange={(event) =>
                    setSelected((previous) =>
                      event.target.checked
                        ? [
                            ...new Set([
                              ...previous,
                              ...selectable.map((row) => row.id),
                            ]),
                          ]
                        : previous.filter(
                            (id) => !entries.some((row) => row.id === id),
                          ),
                    )
                  }
                />
              </th>
              {["Ngày", "Số", "Số tiền", "Đối tượng"].map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Đối chiếu ${row.code}`}
                    disabled={row.confirmed}
                    checked={selected.includes(row.id)}
                    onChange={(event) =>
                      setSelected((previous) =>
                        event.target.checked
                          ? [...previous, row.id]
                          : previous.filter((id) => id !== row.id),
                      )
                    }
                  />
                </td>
                <td>{row.dateHachToan}</td>
                <td>{row.code}{row.confirmed ? " · Đã đối chiếu" : ""}</td>
                <td className="br-number">{money(row.amount)}</td>
                <td>{row.partner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  };
  return (
    <div className="br-workspace">
      <nav aria-label="Kiểu đối chiếu ngân hàng">
        {[
          ["online", "Đối chiếu online"],
          ["offline", "Đối chiếu offline"],
          ["ava", "Đối chiếu với Sổ Việt AI"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "offline" ? (
        <>
          <div className="br-filters">
            <label>
              TK ngân hàng
              <select
                value={account}
                onChange={(e) => { setAccount(e.target.value); setLoaded(null); setPreview(null); setSelected([]); }}
              >
                <option value="">Chọn tài khoản ngân hàng</option>
                {connected ? (apiRows.profiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.account_number} — {profile.bank_name}</option>) : <>
                  <option value="VCB">0011000123456 — Vietcombank</option>
                  <option value="BIDV">1201000123456 — BIDV</option>
                </>}
              </select>
            </label>
            <label>
              Ngân hàng
              <input
                readOnly
                value={
                  connected ? (apiRows.profiles || []).find((profile) => profile.id === account)?.bank_name || "" : account === "VCB"
                    ? "Vietcombank"
                    : account === "BIDV"
                      ? "BIDV"
                      : ""
                }
              />
            </label>
            <label>
              Từ ngày
              <ReportDateInput
                label="Từ ngày đối chiếu"
                value={from}
                onChange={setFrom}
              />
            </label>
            <label>
              Đến ngày
              <ReportDateInput
                label="Đến ngày đối chiếu"
                value={to}
                onChange={setTo}
              />
            </label>
            <button className="br-primary" onClick={load}>
              Lấy dữ liệu
            </button>
            {connected && <button className="br-primary" onClick={() => setShowImport(true)}>Tải tệp sao kê</button>}
          </div>
          {error && (
            <p role="alert" className="br-error">
              {error}
            </p>
          )}
          {connected && visibleImports.length > 0 && <section className="br-table" aria-label="Các lần nhập sao kê">
            <h3>Các lần nhập sao kê</h3>
            <table><thead><tr><th>Mã import</th><th>Tệp nguồn</th><th>Khoảng ngày</th><th>Số dòng</th><th>Tổng thu</th><th>Tổng chi</th><th></th></tr></thead><tbody>
              {visibleImports.map((entry) => <tr key={entry.id}><td>{entry.source_reference}</td><td>{entry.source_file || entry.raw_file?.file_name || ""}</td><td>{entry.period_from} → {entry.period_to}</td><td>{entry.lines?.length || 0}</td><td>{money(Number(entry.raw_file?.active_total_receipts ?? (entry.lines || []).filter((line: any) => line.direction === "CREDIT").reduce((sum: number, line: any) => sum + Number(line.amount), 0)))}</td><td>{money(Number(entry.raw_file?.active_total_payments ?? (entry.lines || []).filter((line: any) => line.direction === "DEBIT").reduce((sum: number, line: any) => sum + Number(line.amount), 0)))}</td><td><button onClick={() => setViewedImportId(entry.id)}>Xem giao dịch đã nhập</button>{entry.source_file && <button onClick={() => void downloadSource(entry)}>Tải tệp nguồn</button>}</td></tr>)}
            </tbody></table>
            {viewedImport && <div style={{ overflowX: "auto" }}><h3>Giao dịch của {viewedImport.source_reference}</h3><table><thead><tr><th>Dòng</th><th>Ngày</th><th>Mã GD</th><th>Nội dung</th><th>Thu</th><th>Chi</th><th>Trạng thái ghép</th></tr></thead><tbody>
              {(viewedImport.lines || []).map((line: any) => <tr key={line.id}><td>{line.raw_data?.source_row || ""}</td><td>{line.transaction_date}</td><td>{line.reference}</td><td>{line.description}</td><td>{line.direction === "CREDIT" ? money(Number(line.amount)) : ""}</td><td>{line.direction === "DEBIT" ? money(Number(line.amount)) : ""}</td><td>{line.match_status === "UNMATCHED" ? "Chưa ghép" : line.match_status}</td></tr>)}
            </tbody></table></div>}
          </section>}
          {connected && <BankStatementLines lines={apiRows.statementLines || []} profiles={apiRows.profiles || []} account={account} loadedRange={loaded} companyId={companyId} reload={reload} notify={notify} onCreateVoucher={onCreateVoucher} onMatch={(line) => setMatchingLineId(line.id)} />}
          {connected && loaded && <BankUnmatchedTransactions companyId={companyId} account={loaded.account} dateFrom={loaded.from} dateTo={loaded.to}
            branchId={(apiRows.profiles || []).find((profile) => profile.id === loaded.account)?.branch_id}
            revision={previewRevision} statementLines={apiRows.statementLines || []} onMatch={(line) => setMatchingLineId(line.id)}
            onCreateVoucher={onCreateVoucher} onOpenVoucher={onOpenVoucher} onChanged={() => { reload(); setPreviewRevision((value) => value + 1); }} notify={notify} />}
          <div className="br-columns">
            <div>
              {table("receipt", "Chứng từ thu tiền")}
              <dl>
                {[
                  ["I. Số dư đầu kỳ", totals.opening],
                  ["II. Tổng tiền thu đối chiếu trong kỳ", totals.receipts],
                  ["III. Tổng tiền chi đối chiếu trong kỳ", totals.payments],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{money(Number(value))}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              {table("payment", "Chứng từ chi tiền")}
              <dl>
                <div>
                  <dt>IV. Số dư cuối kỳ sau đối chiếu (I + II - III)</dt>
                  <dd>{money(totals.closing)}</dd>
                </div>
                <div>
                  <dt>
                    <label htmlFor="br-statement">
                      V. Số dư cuối kỳ trên sổ ngân hàng
                    </label>
                  </dt>
                  <dd>
                    <input
                      id="br-statement"
                      inputMode="decimal"
                      value={statement}
                      onInput={(e) =>
                        setStatement(
                          e.currentTarget.value.replace(/[^\d.-]/g, ""),
                        )
                      }
                      onChange={(e) => setStatement(e.target.value)}
                    />
                  </dd>
                </div>
                <div>
                  <dt>VI. Chênh lệch (IV - V)</dt>
                  <dd className={totals.difference ? "br-error" : ""}>
                    {money(totals.difference)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          {connected && <section className="br-table" style={{ marginTop: 12, padding: 12, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff" }}>
            <h3>Ghép dòng sao kê với chứng từ</h3>
            <p>Chọn giao dịch trong bảng Giao dịch sao kê và nhấn Ghép chứng từ để xem các chứng từ đủ điều kiện.</p>
            {!statementLines.length && <p>Chưa có dòng sao kê chưa khớp cho tài khoản này. Nhập sao kê trong phân hệ Ngân hàng trước khi đối chiếu.</p>}
            {!!statementLines.length && <button className="br-primary" onClick={() => setMatchingLineId(statementLines[0].id)}>Ghép giao dịch chưa khớp đầu tiên</button>}
            <h3 style={{ marginTop: 14 }}>Lịch sử các lần ghép</h3>
            <table>
              <thead><tr>
                <th>Ngày ghép</th><th>Sao kê</th><th>Ngày giao dịch NH</th><th>Chứng từ</th>
                <th style={{ textAlign: "right" }}>Số tiền khớp</th><th style={{ textAlign: "right" }}>Chênh lệch</th><th>Trạng thái</th>
              </tr></thead>
              <tbody>
                {matchHistory.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleDateString("vi-VN")}</td>
                    <td>{row.line?.statementNumber || ""}</td>
                    <td>{row.line?.transaction_date ? String(row.line.transaction_date).slice(0, 10).split("-").reverse().join("/") : ""}</td>
                    <td>{row.tx?.number || ""}</td>
                    <td style={{ textAlign: "right" }}>{money(Number(row.matched_amount))}</td>
                    <td style={{ textAlign: "right" }}>{money(Number(row.variance || 0))}</td>
                    <td>{row.status === "MATCHED" ? "Đã khớp" : row.status === "PARTIALLY_MATCHED" ? "Khớp một phần" : row.status}</td>
                  </tr>
                ))}
                {!matchHistory.length && <tr><td colSpan={7}>Chưa có lần ghép nào.</td></tr>}
              </tbody>
            </table>
          </section>}
          <footer>
            {connected && preview && (!preview.has_statement || preview.unmatched_count > 0) &&
              <span className="br-error">{!preview.has_statement ? "Chưa có dữ liệu sao kê ngân hàng trong kỳ đối chiếu." : `Còn ${preview.unmatched_count} giao dịch/chứng từ chưa khớp. Hãy xử lý trước khi xác nhận.`}</span>}
            <span>Ngày đối chiếu gần nhất: {connected ? (preview?.last_confirmed_date?.split("-").reverse().join("/") || lastDate || "—") : (lastDate || lastMatchDate || "—")}</span>
            <button
              onClick={() => {
                setSelected([]);
                setLastDate("");
              }}
            >
              {connected ? "Bỏ chọn đối chiếu" : "Bỏ đối chiếu"}
            </button>
            <button
              disabled={!loaded}
              onClick={() => {
                sessionStorage.setItem(
                  "soviet:bank-reconciliation",
                  JSON.stringify({ loaded, selected, statement }),
                );
                notify("Đã cất tạm đối chiếu trên trình duyệt.");
              }}
            >
              Cất tạm
            </button>
            {connected && <button className="br-primary" disabled={!loaded || !preview || !preview.has_statement || preview.unmatched_count > 0 || !selected.length || confirming}
              onClick={() => void confirmPeriod()}>{confirming ? "Đang xác nhận…" : "Xác nhận đối chiếu"}</button>}
            {!connected && <button
              className="br-primary"
              disabled={!loaded || !selected.length}
              onClick={() => {
                if (totals.difference) {
                  setError("Số dư sau đối chiếu và sổ ngân hàng chưa khớp.");
                  return;
                }
                setLastDate(to.split("-").reverse().join("/"));
                setError("");
                notify("Đã xác nhận đối chiếu dữ liệu mẫu.");
              }}
            >
              Xác nhận đối chiếu
            </button>}
          </footer>
        </>
      ) : (
        <section className="br-intro">
          <h2>{tab === "online" ? "Đối chiếu online" : "Đối chiếu với Sổ Việt AI"}</h2>
          {tab === "ava" && connected && <button className="br-primary" onClick={() => setShowImport(true)}>Thêm kỳ đối chiếu · Tải tệp sao kê</button>}
          <p>
            Hệ thống tự động đối chiếu sổ phụ ngân hàng với sổ kế toán tiền gửi
          </p>
          <div className="br-benefits">
            <p>Tiết kiệm công sức ra ngân hàng xin sổ phụ</p>
            <p>Tiết kiệm thời gian vào Internet Banking để lấy sổ phụ</p>
            <p>
              Tự động đối chiếu khớp giao dịch giữa sổ phụ ngân hàng và sổ kế
              toán tiền gửi
            </p>
          </div>
          <h3>
            Lựa chọn một trong những ngân hàng sau để thực hiện đối chiếu online
          </h3>
          <div className="br-banks">
            {["Vietcombank", "BIDV", "VietinBank", "MB Bank"].map((bank) => (
              <article key={bank}>
                <strong>{bank}</strong>
                <button
                  className="br-primary"
                  onClick={() => setConnection(bank)}
                >
                  Kết nối ngay
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {connection && (
        <div className="br-overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Kết nối ngân hàng"
          >
            <h2>Kết nối {connection}</h2>
            <p>Chọn tài khoản ngân hàng trên màn hình đối chiếu offline để xem dữ liệu hiện có.</p>
            <button
              className="br-primary"
              onClick={() => {
                if (!connected) setAccount(connection === "BIDV" ? "BIDV" : "VCB");
                setTab("offline");
                setConnection("");
              }}
            >
              Xem đối chiếu offline
            </button>
            <button onClick={() => setConnection("")}>Đóng</button>
          </section>
        </div>
      )}
      {matchingLine && <BankMatchDialog line={matchingLine} companyId={companyId} branchId={(apiRows.profiles || []).find((profile) => profile.id === matchingLine.account)?.branch_id}
        onClose={() => setMatchingLineId("")} onSaved={() => { reload(); setPreviewRevision((value) => value + 1); }} notify={notify} />}
      {showImport && <ExcelImportModal companyId={companyId} token={token} profiles={(apiRows.profiles || []) as any}
        onClose={() => setShowImport(false)} onImportSuccess={(count, reference, importedAccountId) => {
          notify(`Đã nhập ${count} giao dịch sao kê (${reference}); chưa tạo chứng từ kế toán.`);
          setAccount(importedAccountId);
          setTab("offline");
          setViewedImportId(reference);
          reload();
        }}/>}
    </div>
  );
}
