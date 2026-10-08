import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Columns,
  Download,
  Printer,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { SelectionTable } from "./MisaPurchaseContractReports";
import { contractPeriodRange } from "./purchase-contract-data";
import {
  SALES_SAMPLE_ROWS,
  SALES_SUMMARY_TITLES,
  salesSummaryRows,
} from "./sales-summary-data";
import type { SalesFilters, SalesSummaryType } from "./sales-summary-data";
import "./misa-purchase-contract-reports.css";
import ReportDateInput from "./ReportDateInput";
import { readReportPresets, writeReportPresets } from "./report-presets";
import type { ReportPreset } from "./report-presets";

const customers = [
  ...new Map(SALES_SAMPLE_ROWS.map((row) => [row.customer, row])).values(),
];
const items = [
  ...new Map(SALES_SAMPLE_ROWS.map((row) => [row.item, row])).values(),
];
const format = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const dateText = (value: string) => value.split("-").reverse().join("/");
function initialFilters(): SalesFilters {
  const [from, to] = contractPeriodRange("Tháng này");
  return {
    from,
    to,
    items: items.map((row) => row.item),
    customers: customers.map((row) => row.customer),
    itemGroup: "",
    customerGroup: "",
    employee: "",
    unit: "",
    onlyActive: true,
  };
}
export default function MisaSalesSummaryReports({
  reportType,
  onBack,
  notify,
}: {
  reportType: SalesSummaryType;
  onBack: () => void;
  notify?: (message: string) => void;
}) {
  const [applied, setApplied] = useState(initialFilters);
  const [draft, setDraft] = useState(initialFilters);
  const [period, setPeriod] = useState("Tháng này");
  const [drawer, setDrawer] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [chooseCustomers, setChooseCustomers] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [saved, setSaved] = useState<ReportPreset<SalesFilters>[]>(() =>
    readReportPresets(SALES_SUMMARY_TITLES[reportType], initialFilters()),
  );
  const [savedOpen, setSavedOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const title = SALES_SUMMARY_TITLES[reportType];
  const byCustomer = reportType === "customers";
  const combined = reportType === "itemsCustomers";
  useEffect(() => {
    if (drawer) closeRef.current?.focus();
  }, [drawer]);
  const closeDrawer = () => {
    setDrawer(false);
    triggerRef.current?.focus();
  };
  const update = <K extends keyof SalesFilters>(
    key: K,
    value: SalesFilters[K],
  ) => setDraft((previous) => ({ ...previous, [key]: value }));
  const results = useMemo(
    () =>
      salesSummaryRows(SALES_SAMPLE_ROWS, applied, reportType).filter((row) =>
        [row.item, row.itemName, row.customer, row.customerName]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(query.toLocaleLowerCase("vi")),
      ),
    [applied, reportType, query],
  );
  const columns = byCustomer
    ? [
        "Mã khách hàng",
        "Tên khách hàng",
        "Doanh số bán",
        "Chiết khấu",
        "Giá trị trả lại",
        "Giá trị giảm giá",
        "Doanh thu thuần",
        "Tiền vốn",
        "Lãi gộp",
        "Tỷ lệ lãi gộp (%)",
      ]
    : [
        combined ? "Mã khách hàng" : "Mã hàng",
        combined ? "Tên khách hàng" : "Tên hàng",
        "ĐVT",
        "Số lượng bán",
        "Doanh số bán",
        "Chiết khấu",
        combined ? "Số lượng trả lại" : "SL trả lại",
        "Giá trị trả lại",
        "Giá trị giảm giá",
        "Doanh thu thuần",
        "Tiền vốn",
        "Lãi gộp",
        "Tỷ lệ lãi gộp (%)",
      ];
  const visible = columns
    .map((name, index) => ({ name, index }))
    .filter((column) => !hidden.includes(column.name));
  const cellRows = results.map((row) =>
    byCustomer
      ? [
          row.customer,
          row.customerName,
          row.sales,
          row.discount,
          row.returnedValue,
          row.reduction,
          row.net,
          row.cost,
          row.profit,
          row.ratio,
        ]
      : [
          combined ? row.customer : row.item,
          combined ? row.customerName : row.itemName,
          row.measure,
          row.quantity,
          row.sales,
          row.discount,
          row.returnedQuantity,
          row.returnedValue,
          row.reduction,
          row.net,
          row.cost,
          row.profit,
          row.ratio,
        ],
  );
  const totals = columns.map((_, index) =>
    typeof cellRows[0]?.[index] === "number"
      ? cellRows.reduce((sum, row) => sum + Number(row[index]), 0)
      : "",
  );
  const net = results.reduce((sum, row) => sum + row.net, 0),
    profit = results.reduce((sum, row) => sum + row.profit, 0);
  totals[columns.length - 1] = net ? (profit / net) * 100 : 0;
  const exportCsv = () => {
    const quote = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const data = [
      visible.map((column) => quote(column.name)).join(";"),
      ...cellRows.map(
        (row, index) =>
          visible.map((column) => quote(row[column.index])).join(";") +
          (combined
            ? `;${quote(results[index].item)};${quote(results[index].itemName)}`
            : ""),
      ),
    ];
    if (combined) data[0] += ';"Mã hàng";"Tên hàng"';
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", data.join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
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
                  name: `${title} (${saved.length + 1})`,
                  filters: { ...applied },
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
          <button aria-label="Nạp lại" onClick={() => setQuery("")}>
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
        <p>
          Từ {dateText(applied.from)} đến {dateText(applied.to)}
        </p>
        <small>Dữ liệu mẫu · Đơn vị tính: Đồng</small>
        <div className="pc-report-scroll">
          <table aria-label={title}>
            <thead>
              <tr>
                {visible.map((column) => (
                  <th key={column.name}>{column.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cellRows.map((row, index) => (
                <SalesTableRow
                  key={index}
                  cells={row}
                  columns={visible}
                  group={
                    combined &&
                    (index === 0 ||
                      results[index - 1].item !== results[index].item)
                      ? `${results[index].item} - ${results[index].itemName}`
                      : undefined
                  }
                />
              ))}
              {!cellRows.length && (
                <tr>
                  <td
                    colSpan={Math.max(visible.length, 1)}
                    className="pc-empty"
                  >
                    Không có dữ liệu phù hợp với điều kiện đã chọn
                  </td>
                </tr>
              )}
            </tbody>
            {!!cellRows.length && (
              <tfoot>
                <tr>
                  {visible.map((column, index) => (
                    <td key={column.name} className="pc-number">
                      {index === 0
                        ? "Tổng cộng"
                        : typeof totals[column.index] === "number"
                          ? format(Number(totals[column.index]))
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
            aria-labelledby="sales-parameter-title"
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
              <h2 id="sales-parameter-title">Chọn tham số</h2>
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
                {byCustomer ? (
                  <>
                    <label>
                      Đơn vị
                      <select
                        value={draft.unit}
                        onChange={(event) => update("unit", event.target.value)}
                      >
                        <option value="">Tất cả</option>
                        <option>Trụ sở chính</option>
                        <option>Chi nhánh TP. Hồ Chí Minh</option>
                      </select>
                    </label>
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
                  </>
                ) : (
                  <>
                    <label>
                      Đơn vị tính
                      <select>
                        <option>Đơn vị tính chính</option>
                      </select>
                    </label>
                    <label>
                      {combined ? "Nhóm vật tư hàng hóa" : "Nhóm VTHH"}
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
                  </>
                )}
                <label>
                  Nhóm khách hàng
                  <select
                    value={draft.customerGroup}
                    onChange={(event) =>
                      update("customerGroup", event.target.value)
                    }
                  >
                    <option value="">Tất cả</option>
                    <option>Doanh nghiệp</option>
                    <option>Cá nhân</option>
                  </select>
                </label>
              </div>
              {!byCustomer && (
                <SelectionTable
                  title="Vật tư"
                  headers={["Mã hàng", "Tên hàng"]}
                  rows={items
                    .filter(
                      (row) =>
                        !draft.itemGroup || draft.itemGroup === row.itemGroup,
                    )
                    .map((row) => ({
                      id: row.item,
                      cells: [row.item, row.itemName],
                    }))}
                  selected={draft.items}
                  onChange={(ids) => update("items", ids)}
                />
              )}
              {reportType === "items" && (
                <label className="pc-combine">
                  <input
                    type="checkbox"
                    checked={chooseCustomers}
                    onChange={(event) => {
                      setChooseCustomers(event.target.checked);
                      if (!event.target.checked)
                        update(
                          "customers",
                          customers.map((row) => row.customer),
                        );
                    }}
                  />
                  Chọn khách hàng
                </label>
              )}
              {(byCustomer || combined || chooseCustomers) && (
                <SelectionTable
                  title="Khách hàng"
                  headers={[
                    "Mã khách hàng",
                    "Tên khách hàng",
                    "Địa chỉ",
                    "Mã số thuế",
                  ]}
                  rows={customers
                    .filter(
                      (row) =>
                        !draft.customerGroup ||
                        row.customerGroup === draft.customerGroup,
                    )
                    .map((row) => ({
                      id: row.customer,
                      cells: [
                        row.customer,
                        row.customerName,
                        "Dữ liệu mẫu",
                        "",
                      ],
                    }))}
                  selected={draft.customers}
                  onChange={(ids) => update("customers", ids)}
                />
              )}
              {byCustomer && (
                <label className="pc-combine">
                  <input
                    type="checkbox"
                    checked={draft.onlyActive}
                    onChange={(event) =>
                      update("onlyActive", event.target.checked)
                    }
                  />
                  Chỉ lấy khách hàng có phát sinh
                </label>
              )}
              {error && (
                <p className="pc-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <footer>
              <button
                onClick={() => {
                  setDraft(initialFilters());
                  setChooseCustomers(false);
                  setPeriod("Tháng này");
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
                    setQuery("");
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
function SalesTableRow({
  cells,
  columns,
  group,
}: {
  cells: (string | number)[];
  columns: { name: string; index: number }[];
  group?: string;
}) {
  return (
    <>
      {group && (
        <tr className="pc-group-row">
          <td colSpan={Math.max(columns.length, 1)}>{group}</td>
        </tr>
      )}
      <tr>
        {columns.map((column) => (
          <td
            key={column.name}
            className={
              typeof cells[column.index] === "number" ? "pc-number" : ""
            }
          >
            {typeof cells[column.index] === "number"
              ? format(Number(cells[column.index]))
              : cells[column.index]}
          </td>
        ))}
      </tr>
    </>
  );
}
