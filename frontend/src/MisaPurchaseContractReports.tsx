import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Columns,
  Download,
  Filter,
  Printer,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  CONTRACT_REPORT_TITLES,
  CONTRACT_SAMPLE_ROWS,
  contractPeriodRange,
  filterContractRows,
  summarizeContractRows,
  contractLedgerRows,
} from "./purchase-contract-data";
import type {
  ContractFilters,
  ContractReportType,
} from "./purchase-contract-data";
import "./misa-purchase-contract-reports.css";
import ReportDateInput from "./ReportDateInput";
import { readReportPresets, writeReportPresets } from "./report-presets";

const money = (value: number) => value.toLocaleString("vi-VN");
const dateText = (value: string) => value.split("-").reverse().join("/");
const suppliers = [
  ...new Map(CONTRACT_SAMPLE_ROWS.map((row) => [row.supplier, row])).values(),
];
const contracts = [
  ...new Map(CONTRACT_SAMPLE_ROWS.map((row) => [row.contract, row])).values(),
];
const items = [
  ...new Map(CONTRACT_SAMPLE_ROWS.map((row) => [row.item, row])).values(),
];
function initialFilters(): ContractFilters {
  const [from, to] = contractPeriodRange("Tháng này");
  return {
    from,
    to,
    suppliers: suppliers.map((row) => row.supplier),
    contracts: contracts.map((row) => row.contract),
    items: items.map((row) => row.item),
    account: "331",
    employee: "",
    supplierGroup: "",
    itemGroup: "",
  };
}
type SelectionProps = {
  title: string;
  headers: string[];
  rows: { id: string; cells: string[] }[];
  selected: string[];
  onChange: (ids: string[]) => void;
};
export function SelectionTable({
  title,
  headers,
  rows,
  selected,
  onChange,
}: SelectionProps) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState("20");
  const visible = rows.filter((row) =>
    row.cells
      .join(" ")
      .toLocaleLowerCase("vi")
      .includes(query.toLocaleLowerCase("vi")),
  );
  const all =
    visible.length > 0 && visible.every((row) => selected.includes(row.id));
  const toggleAll = () =>
    onChange(
      all
        ? selected.filter((id) => !visible.some((row) => row.id === id))
        : [...new Set([...selected, ...visible.map((row) => row.id)])],
    );
  return (
    <section className="pc-selection" aria-label={title}>
      <div className="pc-selection-bar">
        <label>
          <input type="checkbox" checked={all} onChange={toggleAll} />
          {title === "Hàng hóa"
            ? "Chọn tất cả hàng hóa"
            : `Chọn tất cả ${title.toLowerCase()}`}
        </label>
        <div className="pc-search">
          <Search size={15} />
          <input
            aria-label={`Tìm ${title.toLowerCase()}`}
            placeholder={`Tìm ${title.toLowerCase()}`}
            value={query}
            onInput={(event) => setQuery(event.currentTarget.value)}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="pc-selection-scroll">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  aria-label={`Chọn tất cả ${title.toLowerCase()} trong bảng`}
                  type="checkbox"
                  checked={all}
                  onChange={toggleAll}
                />
              </th>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, Number(pageSize)).map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    aria-label={`Chọn ${row.id}`}
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={() =>
                      onChange(
                        selected.includes(row.id)
                          ? selected.filter((id) => id !== row.id)
                          : [...selected, row.id],
                      )
                    }
                  />
                </td>
                {row.cells.map((cell, index) => (
                  <td key={index}>{cell}</td>
                ))}
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={headers.length + 1}>Không có dữ liệu phù hợp</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer>
        <span>
          Tổng số: <strong>{visible.length}</strong>
        </span>
        <span>
          Số dòng/trang{" "}
          <select
            aria-label={`Số dòng/trang ${title}`}
            value={pageSize}
            onChange={(event) => setPageSize(event.target.value)}
          >
            <option>20</option>
            <option>50</option>
            <option>100</option>
          </select>{" "}
          1
        </span>
      </footer>
    </section>
  );
}
const executionColumns = [
  "Ngày ký",
  "Số hợp đồng",
  "Hạn giao hàng",
  "Tên nhà cung cấp",
  "Tên hàng",
  "ĐVT",
  "Số lượng",
  "Số lượng đã giao",
  "Số lượng còn lại",
  "Giá trị hợp đồng",
  "Giá trị đã thực hiện",
  "Giá trị chưa thực hiện",
  "Tình trạng thực hiện",
];
const summaryColumns = ["Mã nhà cung cấp", "Tên nhà cung cấp", "TK công nợ"];
const detailColumns = [
  "Tên nhà cung cấp",
  "Ngày hạch toán",
  "Ngày chứng từ",
  "Số chứng từ",
  "Diễn giải",
  "TK công nợ",
  "TK đối ứng",
];

export default function MisaPurchaseContractReports({
  onBack,
  notify,
  reportType,
}: {
  onBack: () => void;
  notify?: (message: string) => void;
  reportType: ContractReportType;
}) {
  const [applied, setApplied] = useState(initialFilters);
  const [draft, setDraft] = useState(initialFilters);
  const [period, setPeriod] = useState("Tháng này");
  const [drawer, setDrawer] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [combine, setCombine] = useState(false);
  const [appliedCombine, setAppliedCombine] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saved, setSaved] = useState<
    { filters: ContractFilters; combine: boolean; name: string }[]
  >(() =>
    readReportPresets(CONTRACT_REPORT_TITLES[reportType], initialFilters()).map(
      (preset) => ({ ...preset, combine: preset.combine ?? false }),
    ),
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const title = CONTRACT_REPORT_TITLES[reportType];
  useEffect(() => {
    if (drawer) closeRef.current?.focus();
  }, [drawer]);
  const closeDrawer = () => {
    setDrawer(false);
    triggerRef.current?.focus();
  };
  const update = <K extends keyof ContractFilters>(
    key: K,
    value: ContractFilters[K],
  ) => setDraft((previous) => ({ ...previous, [key]: value }));
  const rows = useMemo(() => {
    const filters =
      reportType === "execution" ? { ...applied, account: "" } : applied;
    return filterContractRows(
      CONTRACT_SAMPLE_ROWS,
      filters,
      reportType !== "execution",
    );
  }, [applied, reportType]);
  const displayRows = useMemo(() => {
    const matches = (cells: (string | number)[]) =>
      cells
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi"));
    if (reportType === "summary")
      return summarizeContractRows(rows, applied.from, applied.to)
        .map((row) => [
          row.supplier,
          row.supplierName,
          row.account,
          row.openingDebit,
          row.openingCredit,
          row.debit,
          row.credit,
          row.closingDebit,
          row.closingCredit,
        ])
        .filter(matches);
    if (reportType === "execution")
      return rows
        .map((row) => [
          dateText(row.signed),
          row.contract,
          dateText(row.due),
          row.supplierName,
          row.itemName,
          row.unit,
          row.quantity,
          row.received,
          row.quantity - row.received,
          row.value,
          row.completedValue,
          row.value - row.completedValue,
          row.received === row.quantity
            ? "Đã thực hiện"
            : row.received
              ? "Đang thực hiện"
              : "Chưa thực hiện",
        ])
        .filter(matches);
    return contractLedgerRows(rows, applied.from, appliedCombine)
      .map((row) => [
        row.supplierName,
        dateText(row.date),
        dateText(row.date),
        row.voucher,
        row.description,
        row.account,
        row.counterpart,
        row.debit,
        row.credit,
        Math.max(row.balance, 0),
        Math.max(-row.balance, 0),
      ])
      .filter(matches);
  }, [rows, applied, reportType, query, appliedCombine]);
  const baseColumns =
    reportType === "summary"
      ? summaryColumns
      : reportType === "execution"
        ? executionColumns
        : detailColumns;
  const closingBalances = new Map<string, number>();
  contractLedgerRows(rows, applied.from, appliedCombine).forEach((row) => {
    if (
      !query ||
      [row.supplierName, row.voucher, row.description]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi"))
    ) {
      closingBalances.set(
        `${row.supplier}:${row.contract}:${row.account}`,
        row.balance,
      );
    }
  });
  const closingDebit = [...closingBalances.values()].reduce(
    (sum, balance) => sum + Math.max(balance, 0),
    0,
  );
  const closingCredit = [...closingBalances.values()].reduce(
    (sum, balance) => sum + Math.max(-balance, 0),
    0,
  );
  const columns =
    reportType === "execution"
      ? baseColumns
      : [
          ...baseColumns,
          ...(reportType === "summary"
            ? [
                "Số dư đầu kỳ Nợ",
                "Số dư đầu kỳ Có",
                "Phát sinh Nợ",
                "Phát sinh Có",
                "Số dư cuối kỳ Nợ",
                "Số dư cuối kỳ Có",
              ]
            : ["Phát sinh Nợ", "Phát sinh Có", "Số dư Nợ", "Số dư Có"]),
        ];
  const visibleColumns = columns
    .map((name, index) => ({ name, index }))
    .filter((column) => !hidden.includes(column.name));
  const subtitle = `${reportType === "execution" ? "" : `Tài khoản: ${applied.account || "Tất cả"}, `}Từ ${dateText(applied.from)} đến ${dateText(applied.to)}, Nhà cung cấp: ${applied.suppliers.length}, Hợp đồng mua: ${applied.contracts.length}`;
  const exportCsv = () => {
    const quote = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const contents = [
      visibleColumns.map((column) => quote(column.name)).join(";"),
      ...displayRows.map((row) =>
        visibleColumns.map((column) => quote(row[column.index])).join(";"),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", contents], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    notify?.("Đã xuất CSV có thể mở bằng Excel.");
  };
  return (
    <div className="pc-report">
      <header className="pc-header">
        <div>
          <button aria-label="Danh sách báo cáo" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
          <h2>{title}</h2>
        </div>
        <div>
          <button onClick={() => setSavedOpen(!savedOpen)}>
            Danh sách báo cáo đã lưu
          </button>
          <button
            onClick={() => {
              const next = [
                ...saved,
                {
                  filters: { ...applied },
                  combine: appliedCombine,
                  name: `${title} (${saved.length + 1})`,
                },
              ].slice(-20);
              setSaved(next);
              notify?.(
                writeReportPresets(title, next)
                  ? "Đã lưu báo cáo trên trình duyệt này."
                  : "Đã lưu báo cáo cho lần xem này.",
              );
            }}
          >
            Lưu báo cáo
          </button>
          <button
            className="pc-primary"
            ref={triggerRef}
            onClick={() => {
              setDraft({ ...applied });
              setCombine(appliedCombine);
              setError("");
              setDrawer(true);
            }}
          >
            Chọn tham số
          </button>
        </div>
      </header>
      {savedOpen && (
        <section className="pc-saved" aria-label="Báo cáo đã lưu">
          {saved.length ? (
            saved.map((report, index) => (
              <button
                key={index}
                onClick={() => {
                  setApplied(report.filters);
                  setAppliedCombine(report.combine);
                  setPeriod("Tùy chọn");
                  setSavedOpen(false);
                }}
              >
                {report.name}
              </button>
            ))
          ) : (
            <p>Chưa có báo cáo đã lưu.</p>
          )}
        </section>
      )}
      <div className="pc-toolbar">
        <div>
          <button aria-label="Lọc báo cáo" onClick={() => setDrawer(true)}>
            <Filter size={16} />
          </button>
          <button
            aria-label="Ẩn hiện cột"
            onClick={() => setColumnsOpen(!columnsOpen)}
          >
            <Columns size={16} />
          </button>
        </div>
        <div>
          <div className="pc-search">
            <input
              aria-label="Tìm trong báo cáo"
              placeholder="Nhập từ khóa tìm kiếm"
              value={query}
              onInput={(event) => setQuery(event.currentTarget.value)}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Search size={15} />
          </div>
          <button
            aria-label="Nạp lại"
            onClick={() => {
              setQuery("");
              notify?.("Đã nạp lại dữ liệu mẫu.");
            }}
          >
            <RefreshCw size={16} />
          </button>
          <button aria-label="In báo cáo" onClick={() => window.print()}>
            <Printer size={16} />
          </button>
          <button aria-label="Xuất báo cáo" onClick={exportCsv}>
            <Download size={16} />
          </button>
        </div>
      </div>
      {columnsOpen && (
        <section className="pc-column-picker" aria-label="Chọn cột báo cáo">
          {columns.map((column) => (
            <label key={column}>
              <input
                type="checkbox"
                checked={!hidden.includes(column)}
                onChange={() =>
                  setHidden((previous) =>
                    previous.includes(column)
                      ? previous.filter((name) => name !== column)
                      : [...previous, column],
                  )
                }
              />
              {column}
            </label>
          ))}
        </section>
      )}
      <section className="pc-preview" aria-label="Nội dung báo cáo">
        <h1>{title.toLocaleUpperCase("vi")}</h1>
        <p>{subtitle}</p>
        <small>Dữ liệu mẫu · Đơn vị tính: Đồng</small>
        <div className="pc-report-scroll">
          <table aria-label={title}>
            <thead>
              {reportType !== "execution" && !hidden.length ? (
                <>
                  <tr>
                    {baseColumns.map((column) => (
                      <th key={column} rowSpan={2}>
                        {column}
                      </th>
                    ))}
                    {(reportType === "summary"
                      ? ["Số dư đầu kỳ", "Phát sinh", "Số dư cuối kỳ"]
                      : ["Phát sinh", "Số dư"]
                    ).map((column) => (
                      <th key={column} colSpan={2}>
                        {column}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {Array.from(
                      { length: reportType === "summary" ? 3 : 2 },
                      (_, index) => (
                        <FragmentPair key={index} />
                      ),
                    )}
                  </tr>
                </>
              ) : (
                <tr>
                  {visibleColumns.map((column) => (
                    <th key={column.name}>{column.name}</th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {displayRows.map((row, index) => (
                <tr key={index}>
                  {visibleColumns.map((column) => (
                    <td
                      key={column.name}
                      className={
                        typeof row[column.index] === "number" ? "pc-number" : ""
                      }
                    >
                      {typeof row[column.index] === "number"
                        ? money(row[column.index] as number)
                        : row[column.index]}
                    </td>
                  ))}
                </tr>
              ))}
              {!displayRows.length && (
                <tr>
                  <td
                    colSpan={Math.max(visibleColumns.length, 1)}
                    className="pc-empty"
                  >
                    Không có dữ liệu phù hợp với điều kiện đã chọn
                  </td>
                </tr>
              )}
            </tbody>
            {!!displayRows.length && (
              <tfoot>
                <tr>
                  {visibleColumns.map((column, index) => (
                    <td key={column.name} className="pc-number">
                      {index === 0
                        ? "Tổng cộng"
                        : reportType === "detail" && column.index >= 9
                          ? money(
                              column.index === 9 ? closingDebit : closingCredit,
                            )
                          : typeof displayRows[0][column.index] === "number"
                            ? money(
                                displayRows.reduce(
                                  (sum, row) => sum + Number(row[column.index]),
                                  0,
                                ),
                              )
                            : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
      {drawer && (
        <div className="pc-overlay">
          <div
            className="pc-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pc-parameter-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") closeDrawer();
              if (event.key === "Tab") {
                const controls = [
                  ...event.currentTarget.querySelectorAll<HTMLElement>(
                    "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
                  ),
                ];
                if (event.shiftKey && document.activeElement === controls[0]) {
                  event.preventDefault();
                  controls.at(-1)?.focus();
                } else if (
                  !event.shiftKey &&
                  document.activeElement === controls.at(-1)
                ) {
                  event.preventDefault();
                  controls[0]?.focus();
                }
              }
            }}
          >
            <header>
              <h2 id="pc-parameter-title">Chọn tham số</h2>
              <button
                ref={closeRef}
                aria-label="Đóng tham số"
                onClick={closeDrawer}
              >
                <X size={20} />
              </button>
            </header>
            <div className="pc-drawer-content">
              <div className="pc-form-grid">
                <label>
                  <span className="pc-label">
                    Kỳ báo cáo <span>*</span>
                  </span>
                  <select
                    value={period}
                    onChange={(event) => {
                      setPeriod(event.target.value);
                      if (event.target.value !== "Tùy chọn") {
                        const [from, to] = contractPeriodRange(
                          event.target.value,
                        );
                        setDraft((previous) => ({ ...previous, from, to }));
                      }
                    }}
                  >
                    {[
                      "Tháng này",
                      "Tháng trước",
                      "Quý này",
                      "Quý trước",
                      "Năm nay",
                      "Năm trước",
                      "Tùy chọn",
                    ].map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Từ ngày
                  <ReportDateInput
                    label="Từ ngày"
                    value={draft.from}
                    onChange={(value) => {
                      update("from", value);
                      setPeriod("Tùy chọn");
                    }}
                  />
                </label>
                <label>
                  Đến ngày
                  <ReportDateInput
                    label="Đến ngày"
                    value={draft.to}
                    onChange={(value) => {
                      update("to", value);
                      setPeriod("Tùy chọn");
                    }}
                  />
                </label>
                {reportType !== "execution" && (
                  <label>
                    Tài khoản
                    <select
                      value={draft.account}
                      onChange={(event) =>
                        update("account", event.target.value)
                      }
                    >
                      <option value="">Tất cả</option>
                      <option>331</option>
                      <option>3311</option>
                      <option>3312</option>
                    </select>
                  </label>
                )}
                {reportType === "execution" && (
                  <label>
                    Nhóm VTHH
                    <select
                      value={draft.itemGroup}
                      onChange={(event) =>
                        update("itemGroup", event.target.value)
                      }
                    >
                      <option value="">Tất cả</option>
                      <option>Thiết bị</option>
                      <option>Văn phòng</option>
                    </select>
                  </label>
                )}
                <label>
                  {reportType === "execution"
                    ? "Nhóm NCC"
                    : "Nhóm nhà cung cấp"}
                  <select
                    value={draft.supplierGroup}
                    onChange={(event) =>
                      update("supplierGroup", event.target.value)
                    }
                  >
                    <option value="">Tất cả</option>
                    <option>Thiết bị</option>
                    <option>Văn phòng</option>
                  </select>
                </label>
                {reportType === "execution" && (
                  <label>
                    Nhân viên
                    <select
                      value={draft.employee}
                      onChange={(event) =>
                        update("employee", event.target.value)
                      }
                    >
                      <option value="">Tất cả</option>
                      <option value="NV001">NV001 - Nguyễn Minh</option>
                      <option value="NV002">NV002 - Lê An</option>
                    </select>
                  </label>
                )}
              </div>
              {reportType === "execution" && (
                <SelectionTable
                  title="Hàng hóa"
                  headers={["Mã hàng", "Tên hàng"]}
                  rows={items
                    .filter(
                      (row) =>
                        !draft.itemGroup || row.itemGroup === draft.itemGroup,
                    )
                    .map((row) => ({
                      id: row.item,
                      cells: [row.item, row.itemName],
                    }))}
                  selected={draft.items}
                  onChange={(ids) => update("items", ids)}
                />
              )}
              <SelectionTable
                title="Nhà cung cấp"
                headers={["Mã NCC", "Tên NCC", "Địa chỉ", "Mã số thuế"]}
                rows={suppliers
                  .filter(
                    (row) =>
                      !draft.supplierGroup ||
                      row.supplierGroup === draft.supplierGroup,
                  )
                  .map((row) => ({
                    id: row.supplier,
                    cells: [row.supplier, row.supplierName, "Dữ liệu mẫu", ""],
                  }))}
                selected={draft.suppliers}
                onChange={(ids) => update("suppliers", ids)}
              />
              {reportType !== "execution" && (
                <SelectionTable
                  title="Hợp đồng"
                  headers={[
                    "Số hợp đồng",
                    "Ngày ký",
                    "Nhà cung cấp",
                    "Trích yếu",
                  ]}
                  rows={contracts
                    .filter((row) => draft.suppliers.includes(row.supplier))
                    .map((row) => ({
                      id: row.contract,
                      cells: [
                        row.contract,
                        dateText(row.signed),
                        row.supplierName,
                        row.description,
                      ],
                    }))}
                  selected={draft.contracts}
                  onChange={(ids) => update("contracts", ids)}
                />
              )}
              {reportType === "detail" && (
                <label className="pc-combine">
                  <input
                    type="checkbox"
                    checked={combine}
                    onChange={(event) => setCombine(event.target.checked)}
                  />
                  Cộng gộp các bút toán giống nhau
                </label>
              )}
              {error && (
                <p role="alert" className="pc-error">
                  {error}
                </p>
              )}
            </div>
            <footer>
              <button
                onClick={() => {
                  setDraft(initialFilters());
                  setPeriod("Tháng này");
                  setCombine(false);
                  setError("");
                }}
              >
                Xóa điều kiện
              </button>
              <div>
                <button onClick={closeDrawer}>Hủy</button>
                <button
                  className="pc-primary"
                  onClick={() => {
                    if (!draft.from || !draft.to || draft.from > draft.to) {
                      setError("Từ ngày phải nhỏ hơn hoặc bằng đến ngày.");
                      return;
                    }
                    setApplied({ ...draft });
                    setAppliedCombine(combine);
                    setQuery("");
                    setError("");
                    closeDrawer();
                  }}
                >
                  Xem báo cáo
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
function FragmentPair() {
  return (
    <>
      <th>Nợ</th>
      <th>Có</th>
    </>
  );
}
