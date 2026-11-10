import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type VoucherChoice = {
  code: string;
  name: string;
  person?: string;
  address?: string;
  dept?: string;
  taxCode?: string;
  phone?: string;
  bankAccount?: string;
  bankName?: string;
  group?: string;
};

export default function VoucherChoiceTable<T extends VoucherChoice>({
  kind,
  rows,
  onSelect,
  openSearch = false,
  onSearchClose,
  onNew,
}: {
  kind: "partner" | "employee";
  rows: T[];
  onSelect: (row: T) => void;
  openSearch?: boolean;
  onSearchClose?: () => void;
  onNew?: (name?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [full, setFull] = useState(openSearch);
  const [selected, setSelected] = useState<T | null>(null);
  const [addMenu, setAddMenu] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (openSearch) {
      setFull(true);
      setQuery("");
    }
  }, [openSearch]);

  const close = () => {
    setFull(false);
    onSearchClose?.();
  };

  const matches = rows.filter((row) =>
    Object.values(row)
      .join(" ")
      .toLocaleLowerCase("vi")
      .includes(query.toLocaleLowerCase("vi")),
  );

  const headers =
    kind === "employee"
      ? ["Mã nhân viên", "Tên nhân viên", "Đơn vị", "ĐT di động"]
      : ["Mã đối tượng", "Tên đối tượng", "Mã số thuế", "Địa chỉ", "Điện thoại", "Loại đối tượng"];

  const colWidths =
    kind === "employee"
      ? ["130px", "240px", "230px", "130px"]
      : ["115px", "255px", "115px", "255px", "115px", "115px"];

  return (
    <div
      className="misa-voucher-partner-dropdown"
      style={{
        width: kind === "employee" ? 750 : 980,
        maxWidth: "calc(100vw - 70px)",
        zIndex: 1000,
        maxHeight: 360,
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
          aria-label={kind === "employee" ? "Tìm nhân viên" : "Tìm đối tượng"}
          placeholder="Tìm theo mã, tên hoặc thông tin liên quan"
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

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            tableLayout: "fixed",
            borderCollapse: "collapse",
            fontSize: 12.5,
          }}
        >
          <colgroup>
            {colWidths.map((w, idx) => (
              <col key={idx} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {headers.map((text) => (
                <th
                  key={text}
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    height: 36,
                    maxHeight: 36,
                    padding: "0 10px",
                    textAlign: "left",
                    background: "#f1f5f9",
                    color: "#334155",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid #e2e8f0",
                    verticalAlign: "middle",
                    boxSizing: "border-box",
                  }}
                >
                  {text}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matches.map((row) => {
              const cells =
                kind === "employee"
                  ? [row.code, row.name, row.dept || "", row.phone || ""]
                  : [
                      row.code,
                      row.name,
                      row.taxCode || "",
                      row.address || "",
                      row.phone || "",
                      row.code.startsWith("KH")
                        ? "Khách hàng"
                        : row.code.startsWith("NV")
                          ? "Nhân viên"
                          : row.code.startsWith("NCC")
                            ? "Nhà cung cấp"
                            : "Đối tượng",
                    ];
              return (
                <tr
                  key={row.code}
                  tabIndex={0}
                  aria-label={`Chọn ${row.code} ${row.name}`}
                  onClick={() => onSelect(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(row);
                    }
                  }}
                  className="misa-lookup-uniform-row"
                  style={{
                    cursor: "pointer",
                    height: 38,
                    maxHeight: 38,
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  {cells.map((value, index) => (
                    <td
                      key={index}
                      title={String(value || "")}
                      style={{
                        height: 38,
                        maxHeight: 38,
                        padding: "0 10px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        verticalAlign: "middle",
                        boxSizing: "border-box",
                        fontWeight: index === 0 ? 600 : index === 1 ? 500 : 400,
                        color: index === 0 ? "#0f172a" : "#334155",
                      }}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              );
            })}
            {!matches.length && (
              <tr>
                <td
                  colSpan={headers.length}
                  style={{ height: 48, padding: 14, textAlign: "center", color: "#94a3b8" }}
                >
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
          color: "#059669",
          background: "#f8fafc",
          borderTop: "1px solid #e2e8f0",
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        {kind === "partner" ? (
          <button
            type="button"
            onClick={() => {
              setFull(true);
              setQuery("");
            }}
            style={{
              border: 0,
              background: "transparent",
              color: "var(--brand)",
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Tìm nhanh (F3)
          </button>
        ) : (
          <span />
        )}
        <span style={{ fontWeight: 600 }}>{matches.length} kết quả</span>
      </div>

      {full &&
        kind === "partner" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 12500,
              background: "#0004",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                close();
              }
            }}
          >
            <div
              role="dialog"
              aria-label="Tìm nhanh đối tượng"
              style={{
                width: 1200,
                maxWidth: "calc(100vw - 64px)",
                height: "100vh",
                overflow: "auto",
                background: "white",
                borderRadius: 6,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <header
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 20px",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <strong style={{ fontSize: 15 }}>Tìm nhanh đối tượng</strong>
                <button
                  type="button"
                  aria-label="Đóng tìm nhanh đối tượng"
                  onClick={close}
                  style={{ border: 0, background: "transparent", fontSize: 20, cursor: "pointer" }}
                >
                  ×
                </button>
              </header>
              <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
                  <input
                    autoFocus
                    aria-label="Nhập từ khóa tìm kiếm"
                    placeholder="Nhập từ khóa tìm kiếm"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    style={{
                      height: 32,
                      width: 320,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ position: "relative", display: "flex", height: 32 }}>
                    <button
                      type="button"
                      className="misa-voucher-btn-green"
                      style={{ height: 32 }}
                      onClick={() => {
                        close();
                        onNew?.();
                      }}
                    >
                      Thêm mới
                    </button>
                    <button
                      type="button"
                      className="misa-voucher-btn-green"
                      style={{ height: 32 }}
                      aria-label="Loại đối tượng thêm mới"
                      aria-expanded={addMenu}
                      onClick={() => setAddMenu(!addMenu)}
                    >
                      ⌄
                    </button>
                    {addMenu && (
                      <div
                        role="menu"
                        aria-label="Thêm mới đối tượng"
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          zIndex: 3,
                          background: "white",
                          boxShadow: "0 4px 12px #0002",
                          padding: 4,
                          minWidth: 160,
                        }}
                      >
                        {["Khách hàng", "Nhà cung cấp", "Nhân viên"].map((name) => (
                          <button
                            key={name}
                            type="button"
                            role="menuitem"
                            style={{
                              display: "block",
                              width: "100%",
                              padding: 10,
                              textAlign: "left",
                              border: 0,
                              background: "white",
                            }}
                            onClick={() => {
                              setAddMenu(false);
                              close();
                              onNew?.(name);
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                  <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40, height: 38, padding: "0 8px", background: "#f1f5f9" }} />
                        {[
                          ["Mã đối tượng", 115],
                          ["Tên đối tượng", 240],
                          ["Mã số thuế", 115],
                          ["Địa chỉ", 240],
                          ["Nhóm KH/NCC", 110],
                          ["Loại đối tượng", 115],
                          ["Điện thoại", 115],
                          ["Người liên hệ", 130],
                        ].map(([header, w]) => (
                          <th
                            key={String(header)}
                            style={{
                              width: Number(w),
                              height: 38,
                              padding: "0 10px",
                              textAlign: "left",
                              background: "#f1f5f9",
                              whiteSpace: "nowrap",
                              borderBottom: "1px solid #e2e8f0",
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matches
                        .slice(
                          (Math.min(page, Math.max(1, Math.ceil(matches.length / pageSize))) - 1) * pageSize,
                          Math.min(page, Math.max(1, Math.ceil(matches.length / pageSize))) * pageSize,
                        )
                        .map((row) => (
                          <tr
                            key={row.code}
                            onClick={() => setSelected(row)}
                            style={{
                              cursor: "pointer",
                              height: 38,
                              maxHeight: 38,
                              background: selected?.code === row.code ? "#ecfdf5" : "white",
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            <td style={{ height: 38, padding: "0 8px", textAlign: "center" }}>
                              <input
                                type="radio"
                                aria-label={`Chọn nhanh ${row.code}`}
                                checked={selected?.code === row.code}
                                onChange={() => setSelected(row)}
                              />
                            </td>
                            {[
                              row.code,
                              row.name,
                              row.taxCode || "",
                              row.address || "",
                              row.group || "",
                              row.code.startsWith("KH")
                                ? "Khách hàng"
                                : row.code.startsWith("NV")
                                  ? "Nhân viên"
                                  : "Nhà cung cấp",
                              row.phone || "",
                              row.person || "",
                            ].map((value, index) => (
                              <td
                                key={index}
                                title={String(value || "")}
                                style={{
                                  height: 38,
                                  maxHeight: 38,
                                  padding: "0 10px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  verticalAlign: "middle",
                                }}
                              >
                                {value}
                              </td>
                            ))}
                          </tr>
                        ))}
                      {!matches.length && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: "center", padding: 20 }}>
                            Không có dữ liệu phù hợp
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 0" }}>
                  <span>Tổng số: {matches.length}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      Số dòng/trang{" "}
                      <select
                        value={pageSize}
                        onChange={(event) => {
                          setPageSize(Number(event.target.value));
                          setPage(1);
                        }}
                        style={{ height: 30, padding: "0 8px" }}
                      >
                        {[20, 50, 100].map((size) => (
                          <option key={size}>{size}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" style={{ height: 30, padding: "0 8px" }} disabled={page <= 1} onClick={() => setPage(1)}>
                      |&lt;
                    </button>
                    <button
                      type="button"
                      style={{ height: 30, padding: "0 8px" }}
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      &lt;
                    </button>
                    <span>{Math.min(page, Math.max(1, Math.ceil(matches.length / pageSize)))}</span>
                    <button
                      type="button"
                      style={{ height: 30, padding: "0 8px" }}
                      disabled={page >= Math.ceil(matches.length / pageSize)}
                      onClick={() => setPage(page + 1)}
                    >
                      &gt;
                    </button>
                    <button
                      type="button"
                      style={{ height: 30, padding: "0 8px" }}
                      disabled={page >= Math.ceil(matches.length / pageSize)}
                      onClick={() => setPage(Math.max(1, Math.ceil(matches.length / pageSize)))}
                    >
                      &gt;|
                    </button>
                  </div>
                </div>
              </div>
              <footer
                style={{
                  padding: 12,
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <button type="button" className="misa-voucher-btn-white" style={{ height: 32 }} onClick={close}>
                  Hủy
                </button>
                <button
                  type="button"
                  className="misa-voucher-btn-green"
                  style={{ height: 32 }}
                  disabled={!selected}
                  onClick={() => {
                    if (selected) {
                      onSelect(selected);
                      close();
                    }
                  }}
                >
                  Đồng ý
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
