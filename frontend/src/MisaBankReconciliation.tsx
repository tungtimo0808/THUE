import { useMemo, useState } from "react";
import ReportDateInput from "./ReportDateInput";
import { parseReportDate } from "./report-date";
import { reconciliationAmounts } from "./bank-reconciliation";
import type { ReconciliationTransaction } from "./bank-reconciliation";
import "./misa-bank-reconciliation.css";
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
}: {
  transactions: ReconciliationTransaction[];
  notify: (text: string) => void;
}) {
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
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("");
  const rows = useMemo(
    () =>
      loaded
        ? transactions.filter((row) => {
            const date = parseReportDate(row.dateHachToan);
            return date >= loaded.from && date <= loaded.to;
          })
        : [],
    [loaded, transactions],
  );
  const totals = reconciliationAmounts(
    rows,
    selected,
    0,
    Number(statement) || 0,
  );
  const money = (amount: number) => amount.toLocaleString("vi-VN");
  const load = () => {
    if (!account) {
      setError("Vui lòng chọn tài khoản ngân hàng.");
      return;
    }
    if (!from || !to || from > to) {
      setError("Vui lòng chọn khoảng ngày hợp lệ.");
      return;
    }
    setLoaded({ from, to, account });
    setSelected([]);
    setError("");
  };
  const table = (kind: string, title: string) => {
    const entries = rows.filter((row) => row.kind === kind);
    const all =
      entries.length > 0 && entries.every((row) => selected.includes(row.id));
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
                              ...entries.map((row) => row.id),
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
                <td>{row.code}</td>
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
            {id === "ava" && <small>Mới</small>}
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
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">Chọn tài khoản ngân hàng</option>
                <option value="VCB">0011000123456 — Vietcombank</option>
                <option value="BIDV">1201000123456 — BIDV</option>
              </select>
            </label>
            <label>
              Ngân hàng
              <input
                readOnly
                value={
                  account === "VCB"
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
          </div>
          {error && (
            <p role="alert" className="br-error">
              {error}
            </p>
          )}
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
          <footer>
            <span>Ngày đối chiếu gần nhất: {lastDate || "—"}</span>
            <button
              onClick={() => {
                setSelected([]);
                setLastDate("");
              }}
            >
              Bỏ đối chiếu
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
            <button
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
            </button>
          </footer>
        </>
      ) : (
        <section className="br-intro">
          <h2>{tab === "online" ? "Đối chiếu online" : "Đối chiếu với Sổ Việt AI"}</h2>
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
            <p>Lựa chọn tài khoản ngân hàng để xem dữ liệu đối chiếu mẫu.</p>
            <button
              className="br-primary"
              onClick={() => {
                setAccount(connection === "BIDV" ? "BIDV" : "VCB");
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
    </div>
  );
}
