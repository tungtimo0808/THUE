import { useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Columns,
  Download,
  Filter,
  Printer,
  RefreshCw,
  Search,
  Layers,
} from "lucide-react";
import type { AuditedReportDefinition } from "./audited-report-schema";
import { reportColumns } from "./audited-report-schema";
import type { AuditedParameters } from "./audited-report-parameters";
import {
  initialAuditedParameters,
  isAuditedParameters,
  validateAuditedParameters,
} from "./audited-report-parameters";
import { auditedFixtureRows } from "./audited-report-fixtures";
import AuditedReportParameters from "./AuditedReportParameters";
import ReportCustomizationMenu from "./ReportCustomizationMenu";
import ReportGroupingDialog from "./ReportGroupingDialog";
import { REPORT_OPTIONAL_COLUMNS, REPORT_TEMPLATE_DEFAULT_COLUMNS } from "./misa-report-optional-columns";
import { templateColumnLabels } from "./report-template-columns";
import AuditedReportTable from "./AuditedReportTable";
import AuditedPrintedReport from "./AuditedPrintedReport";
import MisaDebtNoticePrinted from "./MisaDebtNoticePrinted";
import MisaDebtNoticeTwoPrinted from "./MisaDebtNoticeTwoPrinted";
import MisaReceivablesReconciliationPrinted from "./MisaReceivablesReconciliationPrinted";
import MisaPaymentDemandPrinted from "./MisaPaymentDemandPrinted";
import MisaReceivablesAgingPrinted from "./MisaReceivablesAgingPrinted";
import MisaSalesInventoryPrinted from "./MisaSalesInventoryPrinted";
import MisaStockGroupsPrinted from "./MisaStockGroupsPrinted";
import MisaUninvoicedPurchasesPrinted from "./MisaUninvoicedPurchasesPrinted";
import MisaGeneralLedgerPrinted from "./MisaGeneralLedgerPrinted";
import "./misa-purchase-contract-reports.css";
import "./audited-reports.css";

type SavedAuditedReport = { name: string; parameters: AuditedParameters };
function readPresets(
  definition: AuditedReportDefinition,
): SavedAuditedReport[] {
  try {
    const result: unknown = JSON.parse(
      localStorage.getItem(`soviet:audited-report:${definition.name}`) ?? "[]",
    );
    return Array.isArray(result)
      ? result
          .filter(
            (item) =>
              item &&
              typeof item.name === "string" &&
              isAuditedParameters(item.parameters),
          )
          .slice(-20)
      : [];
  } catch {
    return [];
  }
}
export default function AuditedReportWorkspace({
  definition,
  onBack,
  notify,
}: {
  definition: AuditedReportDefinition;
  onBack: () => void;
  notify?: (message: string) => void;
}) {
  const [applied, setApplied] = useState(() =>
    initialAuditedParameters(definition),
  );
  const [draft, setDraft] = useState(() =>
    initialAuditedParameters(definition),
  );
  const [drawer, setDrawer] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [groupingDialogOpen, setGroupingDialogOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saved, setSaved] = useState(() => readPresets(definition));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const columns = useMemo(
    () => reportColumns(definition.headers),
    [definition],
  );
  const rows = useMemo(
    () => auditedFixtureRows(definition, applied, query),
    [definition, applied, query],
  );
  const openParameters = () => {
    setDraft(structuredClone(applied));
    setError("");
    setDrawer(true);
  };
  const closeParameters = () => {
    setDrawer(false);
    triggerRef.current?.focus();
  };
  const save = () => {
    const next = [
      ...saved,
      {
        name: `${definition.name} (${saved.length + 1})`,
        parameters: structuredClone(applied),
      },
    ].slice(-20);
    setSaved(next);
    try {
      localStorage.setItem(
        `soviet:audited-report:${definition.name}`,
        JSON.stringify(next),
      );
      notify?.("Đã lưu báo cáo trên trình duyệt này.");
    } catch {
      notify?.("Đã lưu báo cáo cho lần xem này.");
    }
  };
  const exportReport = () => {
    const visible = columns.filter((column) => !hidden.includes(column.id));
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const content = [
      visible.map((column) => quote(column.path)).join(";"),
      ...rows.map((row) =>
        visible.map((column) => quote(row.cells[Number(column.id)])).join(";"),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${definition.name}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const subtitle = Object.entries(applied.fields)
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `${label}: ${/^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : value}`,
    )
    .join(", ");
  return (
    <div className="pc-report ar-report">
      <header className="pc-header">
        <div>
          <button aria-label="Danh sách báo cáo" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
          <h2>{definition.name}</h2>
        </div>
        <div>
          <button onClick={() => setSavedOpen(!savedOpen)}>
            Danh sách báo cáo đã lưu
          </button>
          <button onClick={save}>Lưu báo cáo</button>
          <button
            ref={triggerRef}
            className="pc-primary"
            onClick={openParameters}
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
                  setApplied(structuredClone(report.parameters));
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
          <button aria-label="Lọc báo cáo" onClick={openParameters}>
            <Filter size={16} />
          </button>
          <button
            aria-label="Ẩn hiện cột"
            onClick={() => setColumnsOpen(!columnsOpen)}
          >
            <Columns size={16} />
          </button>
          {definition.viewer === "dynamic"&&<button type="button" aria-label="Nhóm dữ liệu theo cột" onClick={()=>setGroupingDialogOpen(true)}><Layers size={16} /></button>}
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
          <button aria-label="Xuất báo cáo" onClick={exportReport}>
            <Download size={16} />
          </button>
          {definition.viewer === "dynamic" && <ReportCustomizationMenu
            reportName={definition.name}
            visibleColumns={columns.filter(column=>!hidden.includes(column.id)).map(column=>templateColumnLabels(definition.headers, REPORT_TEMPLATE_DEFAULT_COLUMNS[definition.name])[Number(column.id)] ?? column.label)}
          />}
        </div>
      </div>
      {columnsOpen && (
        <section className="pc-column-picker" aria-label="Chọn cột báo cáo">
          {columns.map((column) => (
            <label key={column.id}>
              <input
                type="checkbox"
                checked={!hidden.includes(column.id)}
                onChange={() =>
                  setHidden((previous) =>
                    previous.includes(column.id)
                      ? previous.filter((id) => id !== column.id)
                      : [...previous, column.id],
                  )
                }
              />
              {column.path}
            </label>
          ))}
        </section>
      )}
      {definition.printLayout === "generalLedger" ? (
        <MisaGeneralLedgerPrinted
          definition={definition}
          parameters={applied}
          rows={rows}
          hidden={hidden}
        />
      ) : definition.printLayout === "taxUninvoiced" ? (
        <MisaUninvoicedPurchasesPrinted
          definition={definition}
          parameters={applied}
          rows={rows}
          hidden={hidden}
        />
      ) : definition.printLayout === "stockGroups" ? (
        <MisaStockGroupsPrinted
          definition={definition}
          parameters={applied}
          rows={rows}
          hidden={hidden}
        />
      ) : definition.printLayout === "salesInventory" ? (
        <MisaSalesInventoryPrinted
          definition={definition}
          parameters={applied}
          rows={rows}
          hidden={hidden}
        />
      ) : definition.printLayout === "receivablesAging" ? (
        <MisaReceivablesAgingPrinted
          definition={definition}
          parameters={applied}
          rows={rows}
          hidden={hidden}
        />
      ) : definition.printLayout === "paymentDemand" ? (
        <MisaPaymentDemandPrinted parameters={applied} rows={rows} />
      ) : definition.printLayout === "receivablesReconciliation" ? (
        <MisaReceivablesReconciliationPrinted
          parameters={applied}
          rows={rows}
        />
      ) : definition.printLayout === "debtNoticeTwo" ? (
        <MisaDebtNoticeTwoPrinted
          definition={definition}
          parameters={applied}
          rows={rows}
          hidden={hidden}
        />
      ) : definition.printLayout === "debtNotice" ? (
        <MisaDebtNoticePrinted
          definition={definition}
          parameters={applied}
          rows={rows}
          hidden={hidden}
        />
      ) : definition.printLayout ? (
        <AuditedPrintedReport
          definition={definition}
          parameters={applied}
          rows={rows}
          hidden={hidden}
        />
      ) : (
        <section className="pc-preview" aria-label="Nội dung báo cáo">
          <h1>{definition.name.toLocaleUpperCase("vi")}</h1>
          <p>{subtitle}</p>
          <small>Dữ liệu mẫu · Đơn vị tính: Đồng</small>
          <AuditedReportTable
            name={definition.name}
            headers={definition.headers}
            rows={rows}
            hidden={hidden}
          />
        </section>
      )}
      {drawer && (
        <AuditedReportParameters
          definition={definition}
          draft={draft}
          setDraft={setDraft}
          onCancel={closeParameters}
          onReset={() => {
            setDraft(initialAuditedParameters(definition));
            setError("");
          }}
          error={error}
          onApply={() => {
            const problem = validateAuditedParameters(draft, definition);
            if (problem) {
              setError(problem);
              return;
            }
            setApplied(structuredClone(draft));
            setQuery("");
            setError("");
            closeParameters();
          }}
        />
      )}
      {groupingDialogOpen&&<ReportGroupingDialog columns={[...templateColumnLabels(definition.headers, REPORT_TEMPLATE_DEFAULT_COLUMNS[definition.name]),...(REPORT_OPTIONAL_COLUMNS[definition.name] || [])]} onClose={()=>setGroupingDialogOpen(false)} />}
    </div>
  );
}
