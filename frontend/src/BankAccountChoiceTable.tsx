import { useState } from "react";

export default function BankAccountChoiceTable({
  rows,
  onSelect,
}: {
  rows: { account: string; name: string }[];
  onSelect: (row: { account: string; name: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = rows.filter((row) =>
    `${row.account} ${row.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div
      className="misa-voucher-partner-dropdown"
      style={{
        width: 850,
        maxWidth: "calc(100vw - 70px)",
        zIndex: 1000,
        maxHeight: 340,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#ffffff",
        borderRadius: 8,
        border: "1px solid #cbd5e1",
        boxShadow: "0 12px 28px -6px rgba(15, 23, 42, 0.18)",
      }}
    >
      <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", background: "#ffffff", flexShrink: 0 }}>
        <input
          aria-label="Tìm tài khoản ngân hàng"
          placeholder="Tìm số tài khoản hoặc ngân hàng"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            height: 32,
            minHeight: 32,
            maxHeight: 32,
            margin: 0,
            padding: "0 10px",
            border: "1px solid #cbd5e1",
            borderRadius: 5,
            fontSize: 12.5,
            background: "#f8fafc",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
        <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: 12.5 }}>
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "34%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr>
              {["Số tài khoản", "Tên ngân hàng", "Chi nhánh", "Diễn giải"].map((text) => (
                <th
                  key={text}
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    height: 36,
                    padding: "0 10px",
                    textAlign: "left",
                    background: "#f1f5f9",
                    color: "#334155",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {text}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matches.map((row) => (
              <tr
                key={row.account}
                aria-label={`Chọn tài khoản ${row.account}`}
                tabIndex={0}
                onClick={() => onSelect(row)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(row);
                  }
                }}
                className="misa-lookup-uniform-row"
                style={{ cursor: "pointer", height: 38, maxHeight: 38, borderBottom: "1px solid #f1f5f9" }}
              >
                <td
                  style={{
                    height: 38,
                    padding: "0 10px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {row.account}
                </td>
                <td
                  title={row.name.split(" - ")[0]}
                  style={{
                    height: 38,
                    padding: "0 10px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {row.name.split(" - ")[0]}
                </td>
                <td
                  title={row.name.split(" - ").slice(1).join(" - ")}
                  style={{
                    height: 38,
                    padding: "0 10px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {row.name.split(" - ").slice(1).join(" - ")}
                </td>
                <td style={{ height: 38, padding: "0 10px" }} />
              </tr>
            ))}
            {!matches.length && (
              <tr>
                <td colSpan={4} style={{ height: 48, padding: 14, textAlign: "center", color: "#94a3b8" }}>
                  Không có dữ liệu phù hợp
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div
        style={{
          padding: "7px 12px",
          borderTop: "1px solid #e2e8f0",
          background: "#f8fafc",
          fontSize: 12,
          color: "var(--brand)",
          fontWeight: 600,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        Tổng số: {matches.length}
      </div>
    </div>
  );
}
