import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BadgeDollarSign,
  Bot,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileText,
  Grip,
  Handshake,
  Lightbulb,
  Package,
  RefreshCw,
  Search,
  Settings,
  Sheet,
  UserRound,
  Wrench,
} from "lucide-react";
import {
  dateLabel,
  downloadCsv,
  kinds,
  matchesModule,
  money,
  statuses,
  type Kind,
  type Transaction,
} from "./data";
import { StatusBadge } from "./components";
import { reportNames } from "./reference-config";
import type { ReferenceHref } from "./ReferenceWorkspace";

type ProcessProps = {
  moduleId: string;
  href: ReferenceHref;
  create: (kind: Kind) => void;
  onInfo: (text: string) => void;
};
export function ReferenceProcess({
  moduleId,
  href,
  create,
  onInfo,
}: ProcessProps) {
  const cash = moduleId === "cash" || moduleId === "bank",
    bank = moduleId === "bank",
    purchase = moduleId === "purchases";
  const title = cash
    ? bank
      ? "TIỀN GỬI"
      : "TIỀN MẶT"
    : purchase
      ? "MUA HÀNG"
      : "BÁN HÀNG";
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      document
        .querySelectorAll<HTMLDetailsElement>(".ref-action-menu[open]")
        .forEach((d) => {
          if (e instanceof KeyboardEvent || !d.contains(e.target as Node))
            d.open = false;
        });
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const incoming = bank
    ? ["Thu tiền khách hàng", "Thu khác"]
    : [
        "Phiếu thu",
        "Thu tiền theo hóa đơn",
        "Thu tiền theo hóa đơn nhiều khách hàng",
      ];
  const outgoing = [
    "Phiếu chi",
    "Trả tiền theo hóa đơn",
    "Nộp thuế",
    "Nộp bảo hiểm",
    "Trả lương",
  ];
  const nodes = purchase
    ? [
        { label: "Đơn mua hàng", type: "box", tab: "orders" },
        {
          label: "Nhận hàng hóa, dịch vụ",
          type: "box",
          tab: "transactions",
        },
        {
          label: "Xử lý hóa đơn đầu vào",
          type: "blue",
          tab: "invoice-processing",
        },
        { label: "Trả tiền theo hóa đơn", type: "money", tab: "payments" },
        { label: "Hợp đồng mua hàng", type: "contract", tab: "contracts" },
        { label: "Nhận hóa đơn", type: "doc", tab: "invoices" },
        { label: "Trả lại hàng mua", type: "box", tab: "returns" },
        { label: "Giảm giá hàng mua", type: "discount", tab: "discounts" },
      ]
    : [
        { label: "Báo giá", type: "doc", tab: "quotes" },
        { label: "Ghi nhận doanh thu", type: "growth", tab: "transactions" },
        { label: "Trả lại hàng bán", type: "box", tab: "returns" },
        { label: "Thu tiền theo hóa đơn", type: "money", tab: "collections" },
        { label: "Đơn đặt hàng", type: "box", tab: "orders" },
        { label: "Hợp đồng bán hàng", type: "contract", tab: "contracts" },
        { label: "Xuất hóa đơn", type: "doc", tab: "invoices" },
        { label: "Giảm giá hàng bán", type: "discount", tab: "discounts" },
      ];
  const shortcuts = cash
    ? [
        ...(bank ? ["Tài khoản ngân hàng"] : []),
        "Khách hàng",
        "Nhà cung cấp",
        "Nhân viên",
        "Tính tỷ giá xuất quỹ",
        "Tùy chọn",
      ]
    : [
        purchase ? "Nhà cung cấp" : "Khách hàng",
        "Hàng hóa, dịch vụ",
        "Điều khoản thanh toán",
        "Tiện ích",
        "Tùy chọn",
      ];
  const shortcutIcons = [
    UserRound,
    Package,
    Handshake,
    Wrench,
    Settings,
    Calculator,
  ];
  return (
    <div className="ref-process-wrapper">
      <div className="ref-process-layout">
        <section className="ref-process-panel">
          <h2>NGHIỆP VỤ {title}</h2>
          <div
            className={`ref-process-canvas ${cash ? "cash-process" : purchase ? "purchase-process" : "sales-process"}`}
          >
            <svg
              className="ref-flow-lines"
              viewBox="0 0 600 310"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="ref-arrow"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M1,0 L5,3 L1,6" fill="none" stroke="#bfc8bd" />
                </marker>
              </defs>
              {cash ? (
                <>
                  <path
                    d="M115 106V206 M115 156H300 M424 156H550"
                    markerEnd="url(#ref-arrow)"
                  />
                </>
              ) : (
                <>
                  <path d="M72 155H574" markerEnd="url(#ref-arrow)" />
                  <path d="M72 125V182 M218 125V182 M360 125V182 M506 125V182" />
                </>
              )}
            </svg>
            {cash ? (
              <>
                <ActionMenu
                  label="Thu tiền"
                  className="process-receive"
                  type="receive"
                  options={incoming}
                  onAction={(name) =>
                    name === incoming[0] || name === "Thu khác"
                      ? create(bank ? "bank" : "receipt")
                      : onInfo(name)
                  }
                />
                <ActionMenu
                  label="Chi tiền"
                  className="process-pay"
                  type="pay"
                  options={outgoing}
                  onAction={(name) =>
                    name === "Phiếu chi" && !bank
                      ? create("payment")
                      : onInfo(name)
                  }
                />
                <Link
                  className="ref-process-action process-reconcile"
                  to={href(
                    `/${moduleId}/${bank ? "reconciliation" : "inventory"}`,
                  )}
                >
                  <BusinessIcon type="check" />
                  <span>{bank ? "Đối chiếu ngân hàng" : "Kiểm kê quỹ"}</span>
                </Link>
              </>
            ) : (
              nodes.map((n, i) => (
                <Link
                  key={n.label}
                  className={`ref-process-action process-node node-${i}`}
                  to={href(`/${moduleId}/${n.tab}`)}
                >
                  <BusinessIcon type={n.type} />
                  <span>{n.label}</span>
                </Link>
              ))
            )}
          </div>
        </section>
        <aside className="ref-process-reports">
          <h2>BÁO CÁO</h2>
          <ul>
            {reportNames[moduleId].map((label) => (
              <li key={label}>
                <Link to={href(`/${moduleId}/reports`, { report: label })}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            className="ref-all-reports"
            to={href("/reports", { module: moduleId })}
          >
            Tất cả báo cáo
          </Link>
        </aside>
        <div className="ref-shortcuts">
          {shortcuts.map((s, i) => {
            const Icon = shortcutIcons[i];
            return (
              <button key={s} onClick={() => onInfo(s)}>
                <Icon size={20} />
                <span>{s}</span>
              </button>
            );
          })}
        </div>
        <div className="ref-integration">
          <span className="ref-integration-icon">
            <Grip size={18} />
          </span>
          <strong>
            {moduleId === "sales" ? "AMIS CRM" : "AMIS Quy trình"}
          </strong>
          <span>
            {moduleId === "sales"
              ? "Kết nối dữ liệu giữa bộ phận bán hàng và kế toán"
              : "Phê duyệt và tự động hóa quy trình chi tiền, tạm ứng"}
          </span>
          <button
            className="ref-link"
            onClick={() => onInfo("Kết nối ứng dụng")}
          >
            <Lightbulb size={16} />
            Xem tính năng
          </button>
          <button
            className="ref-button"
            onClick={() => onInfo("Kết nối ứng dụng")}
          >
            Kết nối ngay
          </button>
        </div>
      </div>
    </div>
  );
}
function BusinessIcon({ type }: { type: string }) {
  const Icon =
    type === "check"
      ? ClipboardCheck
      : type === "box"
        ? Package
        : type === "money"
          ? CreditCard
          : type === "growth"
            ? Sheet
            : FileText;
  return (
    <span className={`ref-business-icon ${type}`}>
      <span className="ref-document-sheet">
        {type === "receive" || type === "pay" ? (
          <>
            <b>{type === "receive" ? "THU" : "CHI"}</b>
            <i />
            <i />
            <i />
          </>
        ) : (
          <Icon size={30} strokeWidth={1.5} />
        )}
      </span>
      <span className="ref-gold-icon">
        {type === "check" ? (
          <Calculator size={17} />
        ) : type === "box" ? (
          <Package size={18} />
        ) : (
          <BadgeDollarSign size={19} />
        )}
      </span>
    </span>
  );
}
function ActionMenu({
  label,
  type,
  className,
  options,
  onAction,
}: {
  label: string;
  type: string;
  className: string;
  options: string[];
  onAction: (name: string) => void;
}) {
  return (
    <details className={`ref-action-menu ${className}`}>
      <summary className="ref-process-action">
        <BusinessIcon type={type} />
        <span>{label}</span>
      </summary>
      <div className="ref-action-options">
        {options.map((o) => (
          <button
            key={o}
            onClick={(e) => {
              e.currentTarget.closest("details")?.removeAttribute("open");
              onAction(o);
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </details>
  );
}

function ReferenceChart({
  items,
  revenueOnly = false,
}: {
  items: Transaction[];
  revenueOnly?: boolean;
}) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const rows = items.filter(
      (t) => Number(t.date.slice(5, 7)) === i + 1 && t.status === "posted",
    );
    const revenue = rows
        .filter((t) => t.kind === "sale")
        .reduce((s, t) => s + t.amount / 1000000, 0),
      cost = rows
        .filter((t) => t.kind === "purchase")
        .reduce((s, t) => s + t.amount / 1000000, 0);
    return { month: i + 1, revenue, cost, profit: revenue - cost };
  });
  const max = Math.max(
      3,
      ...months.flatMap((m) => [m.revenue, m.cost, Math.abs(m.profit)]),
    ),
    negative = !revenueOnly && months.some((m) => m.profit < 0),
    bottom = negative ? -max : 0;
  const y = (value: number) => 162 - ((value - bottom) / (max - bottom)) * 145,
    x = (index: number) => 35 + index * 44;
  const series = revenueOnly
    ? [{ key: "revenue" as const, label: "DOANH THU", color: "#16b798" }]
    : [
        { key: "revenue" as const, label: "DOANH THU", color: "#16b798" },
        { key: "cost" as const, label: "CHI PHÍ", color: "#b99b7d" },
        { key: "profit" as const, label: "LỢI NHUẬN", color: "#e88721" },
      ];
  return (
    <>
      <svg
        className="ref-dashboard-chart"
        viewBox="0 0 545 205"
        role="img"
        aria-label="Biểu đồ số liệu theo tháng, đơn vị triệu đồng"
      >
        <g>
          {Array.from({ length: 4 }, (_, i) => {
            const value = bottom + ((max - bottom) * i) / 3;
            return (
              <g key={i}>
                <line
                  x1="35"
                  x2="522"
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#e3e6e5"
                />
                <text x="24" y={y(value) + 4} textAnchor="end">
                  {new Intl.NumberFormat("vi-VN", {
                    maximumFractionDigits: 0,
                  }).format(value)}
                </text>
              </g>
            );
          })}
          {months.map((m, i) => (
            <text key={m.month} x={x(i)} y="182" textAnchor="middle">
              Th {m.month}
            </text>
          ))}
          {series.map((s) => (
            <g key={s.key}>
              <polyline
                points={months
                  .map((m, i) => `${x(i)},${y(m[s.key])}`)
                  .join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
              />
              {months.map((m, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(m[s.key])}
                  r="3"
                  fill={s.key === "profit" ? s.color : "white"}
                  stroke={s.color}
                >
                  <title>{`Tháng ${m.month}: ${s.label} ${money(m[s.key] * 1000000)}`}</title>
                </circle>
              ))}
            </g>
          ))}
        </g>
      </svg>
      <div className="ref-chart-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </>
  );
}
export function ReferenceDashboard({
  items,
  company,
  href,
  notify,
}: {
  items: Transaction[];
  company: string;
  href: ReferenceHref;
  notify: (text: string) => void;
}) {
  const sum = (kind: Kind) =>
    items
      .filter((t) => t.kind === kind && t.status === "posted")
      .reduce((s, t) => s + t.amount, 0);
  const totals = [
    ["Tiền mặt", sum("receipt") - sum("payment")],
    ["Tiền gửi", sum("bank")],
    ["Doanh thu", sum("sale")],
    ["Mua hàng", sum("purchase")],
  ] as const;
  const partners = Object.entries(
    items
      .filter((t) => t.kind === "sale" && t.status === "posted")
      .reduce<Record<string, number>>(
        (a, t) => ({ ...a, [t.partner]: (a[t.partner] || 0) + t.amount }),
        {},
      ),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const footer = (
    <div className="ref-widget-footer">
      Dữ liệu mẫu trong kỳ{" "}
      <button
        onClick={() =>
          notify("Đã cập nhật từ dữ liệu đang lưu trên trình duyệt.")
        }
      >
        Tải lại
      </button>
    </div>
  );
  return (
    <div className="ref-overview">
      <div className="ref-branch">
        <span>Chi nhánh</span>
        <button
          onClick={() =>
            notify("Đang xem toàn bộ dữ liệu của doanh nghiệp đã chọn.")
          }
        >
          {company}
          <ChevronDown size={13} />
        </button>
      </div>
      <div className="ref-dashboard-grid">
        <section className="ref-widget">
          <WidgetHeading
            title="Tình hình tài chính"
            onRefresh={() => notify("Đã cập nhật số liệu trong kỳ.")}
          />
          <ReferenceChart items={items} />
          {footer}
        </section>
        <section className="ref-widget">
          <WidgetHeading
            title="Tổng hợp thu, chi"
            onRefresh={() => notify("Đã cập nhật số liệu trong kỳ.")}
          />
          <table className="ref-overview-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th className="numeric">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {totals.map(([label, value], i) => (
                <tr key={label}>
                  <td>
                    <i className={`ref-series-square series-${i}`} />
                    {label}
                  </td>
                  <td className="numeric">{money(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link className="ref-widget-more" to={href("/reports")}>
            Xem thêm
          </Link>
          {footer}
        </section>
        <section className="ref-widget">
          <WidgetHeading
            title="Doanh thu"
            onRefresh={() => notify("Đã cập nhật doanh thu trong kỳ.")}
          />
          <div className="ref-revenue-total">
            <strong>
              {new Intl.NumberFormat("vi-VN", {
                maximumFractionDigits: 2,
              }).format(sum("sale") / 1000000)}
            </strong>{" "}
            Triệu đồng<small>TỔNG</small>
          </div>
          <ReferenceChart items={items} revenueOnly />
          {footer}
        </section>
        <section className="ref-widget">
          <WidgetHeading
            title="Khách hàng theo doanh thu"
            onRefresh={() => notify("Đã cập nhật số liệu bán hàng.")}
          />
          <div className="ref-revenue-total">
            <strong>
              {new Intl.NumberFormat("vi-VN", {
                maximumFractionDigits: 2,
              }).format(sum("sale") / 1000000)}
            </strong>{" "}
            Triệu đồng<small>TỔNG DOANH THU</small>
          </div>
          <table className="ref-overview-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th className="numeric">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {partners.map(([name, value], i) => (
                <tr key={name}>
                  <td>
                    <i className={`ref-series-square series-${i}`} />
                    {name}
                  </td>
                  <td className="numeric">{money(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!partners.length && <EmptyReference />}
          <Link className="ref-widget-more" to={href("/sales/transactions")}>
            Xem thêm
          </Link>
          {footer}
        </section>
      </div>
    </div>
  );
}
function WidgetHeading({
  title,
  onRefresh,
}: {
  title: string;
  onRefresh: () => void;
}) {
  return (
    <div className="ref-widget-heading">
      <h2>{title}</h2>
      <span>Trong kỳ</span>
      <button
        className="ref-icon"
        aria-label={`Tải lại ${title}`}
        onClick={onRefresh}
      >
        <RefreshCw size={14} />
      </button>
    </div>
  );
}
function EmptyReference({ children }: { children?: ReactNode }) {
  return (
    <div className="ref-empty">
      <span className="ref-empty-drawing">
        <FileText size={42} strokeWidth={1} />
        <i />
        <b>⌣</b>
      </span>
      <p>Không có dữ liệu</p>
      {children}
    </div>
  );
}

export function ReferenceTransactions({
  moduleId,
  items,
  create,
  onDetail,
  notify,
  onInfo,
}: {
  moduleId: string;
  items: Transaction[];
  create: (kind: Kind) => void;
  onDetail: (t: Transaction) => void;
  notify: (text: string) => void;
  onInfo: (text: string) => void;
}) {
  const [params, setParams] = useSearchParams(),
    [filterOpen, setFilterOpen] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [detailId, setDetailId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState(params.get("status") || ""),
    [filterKind, setFilterKind] = useState(params.get("kind") || ""),
    [from, setFrom] = useState(params.get("from") || ""),
    [to, setTo] = useState(params.get("to") || ""),
    [filterError, setFilterError] = useState("");
  const query = params.get("q") || "",
    status = params.get("status") || "",
    kind = params.get("kind") || "";
  const scoped = items.filter((t) => matchesModule(t, moduleId)),
    filtered = scoped
      .filter(
        (t) =>
          (!status || t.status === status) &&
          (!kind || t.kind === kind) &&
          (!params.get("from") || t.date >= params.get("from")!) &&
          (!params.get("to") || t.date <= params.get("to")!) &&
          `${t.code} ${t.description} ${t.partner}`
            .toLocaleLowerCase("vi-VN")
            .includes(query.toLocaleLowerCase("vi-VN")),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8)),
    page = Math.min(
      pageCount,
      Math.max(1, Math.floor(Number(params.get("page"))) || 1),
    ),
    paged = filtered.slice((page - 1) * 8, page * 8),
    detail = filtered.find((t) => t.id === detailId);
  const update = (values: Record<string, string>) => {
    const p = new URLSearchParams(params);
    Object.entries(values).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (!("page" in values)) p.delete("page");
    setParams(p, { replace: true });
    setSelected([]);
  };
  const doExport = () => {
    const rows = selected.length
      ? filtered.filter((t) => selected.includes(t.id))
      : filtered;
    downloadCsv(rows);
    notify(`Đã xuất ${rows.length} chứng từ mẫu sang CSV.`);
  };
  const income = scoped
      .filter(
        (t) =>
          t.status === "posted" && (t.kind === "receipt" || t.kind === "bank"),
      )
      .reduce((s, t) => s + t.amount, 0),
    outgoing = scoped
      .filter((t) => t.status === "posted" && t.kind === "payment")
      .reduce((s, t) => s + t.amount, 0);
  const cash = moduleId === "cash" || moduleId === "bank";
  return (
    <div className="ref-transactions">
      <div className="ref-summary-strip">
        {(cash
          ? [
              ["Tổng thu trong kỳ", income],
              ["Tổng chi trong kỳ", outgoing],
              ["Thu trừ chi", income - outgoing],
            ]
          : [
              ["Tổng giá trị", scoped.reduce((s, t) => s + t.amount, 0)],
              [
                "Chờ duyệt",
                scoped.filter((t) => t.status === "pending").length,
              ],
              ["Số chứng từ", scoped.length],
            ]
        ).map(([label, value], i) => (
          <div key={label} className={`summary-${i}`}>
            <span>{label}</span>
            <strong>{cash || i === 0 ? money(Number(value)) : value}</strong>
            <small>Dữ liệu mẫu</small>
          </div>
        ))}
      </div>
      <section className="ref-list-panel">
        <div className="ref-command-bar">
          <select
            aria-label="Thực hiện hàng loạt"
            value=""
            disabled={!selected.length}
            onChange={(e) => {
              if (e.target.value === "export") doExport();
            }}
          >
            <option value="">Thực hiện hàng loạt</option>
            <option value="export">Xuất các dòng đã chọn</option>
          </select>
          <button
            className={`ref-button ${status || kind ? "filter-active" : ""}`}
            aria-expanded={filterOpen}
            onClick={() => {
              setFilterStatus(status);
              setFilterKind(kind);
              setFilterOpen(!filterOpen);
            }}
          >
            Lọc
            <ChevronDown size={12} />
          </button>
          <select
            aria-label="Lọc nhanh trạng thái"
            value={status}
            onChange={(e) => update({ status: e.target.value })}
          >
            <option value="">Tất cả</option>
            {Object.entries(statuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <span className="ref-current-range">Kỳ kế toán hiện tại</span>
          <div className="ref-list-search">
            <input
              aria-label="Tìm trong danh sách"
              placeholder="Tìm kiếm…"
              value={query}
              onChange={(e) => update({ q: e.target.value })}
            />
            <Search size={14} />
          </div>
          <button
            className="ref-icon"
            aria-label="Tải lại danh sách"
            onClick={() =>
              notify("Đã cập nhật danh sách từ dữ liệu trình duyệt.")
            }
          >
            <RefreshCw size={18} />
          </button>
          <button
            className="ref-icon ref-excel"
            aria-label="Xuất CSV"
            onClick={doExport}
          >
            <Sheet size={18} />
          </button>
          <button
            className="ref-icon"
            aria-label="Tùy chọn cột"
            onClick={() => onInfo("Tùy chọn cột")}
          >
            <Settings size={17} />
          </button>
          {cash ? (
            <>
              <details className="ref-toolbar-menu">
                <summary>
                  Thu tiền
                  <ChevronDown size={12} />
                </summary>
                <div>
                  <button
                    onClick={(e) => {
                      e.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      create(moduleId === "bank" ? "bank" : "receipt");
                    }}
                  >
                    Phiếu thu
                  </button>
                  <button onClick={() => onInfo("Thu tiền theo hóa đơn")}>
                    Thu tiền theo hóa đơn
                  </button>
                </div>
              </details>
              <details className="ref-toolbar-menu">
                <summary>
                  Chi tiền
                  <ChevronDown size={12} />
                </summary>
                <div>
                  <button
                    onClick={(e) => {
                      e.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      if (moduleId === "cash") create("payment");
                      else onInfo("Chi tiền gửi");
                    }}
                  >
                    Phiếu chi
                  </button>
                  <button onClick={() => onInfo("Trả tiền theo hóa đơn")}>
                    Trả tiền theo hóa đơn
                  </button>
                </div>
              </details>
            </>
          ) : (
            <button
              className="ref-button teal"
              onClick={() =>
                create(
                  moduleId === "purchases"
                    ? "purchase"
                    : moduleId === "sales" || moduleId === "invoices"
                      ? "sale"
                      : "receipt",
                )
              }
            >
              Thêm chứng từ
            </button>
          )}
          <button
            className="ref-ai-button"
            onClick={() => onInfo("Thêm bằng AI")}
          >
            <Bot size={17} />
            Thêm bằng AI
          </button>
        </div>
        {filterOpen && (
          <form
            className="ref-filter-popover"
            onSubmit={(e) => {
              e.preventDefault();
              if (from && to && from > to) {
                setFilterError(
                  "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.",
                );
                return;
              }
              update({ status: filterStatus, kind: filterKind, from, to });
              setFilterOpen(false);
              setFilterError("");
            }}
          >
            <label>
              Lý do thu, chi
              <select
                aria-label="Lý do thu, chi"
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value)}
              >
                <option value="">Tất cả</option>
                {Object.entries(kinds)
                  .filter(([k]) =>
                    matchesModule({ kind: k } as Transaction, moduleId),
                  )
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Trạng thái ghi sổ
              <select
                aria-label="Trạng thái ghi sổ"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Tất cả</option>
                {Object.entries(statuses).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="ref-filter-dates">
              <label>
                Thời gian
                <select
                  aria-label="Thời gian"
                  onChange={(e) => {
                    if (e.target.value === "all") {
                      setFrom("");
                      setTo("");
                    }
                  }}
                >
                  <option value="custom">Khoảng ngày trong kỳ</option>
                  <option value="all">Toàn bộ kỳ hiện tại</option>
                </select>
              </label>
              <label>
                Từ ngày
                <input
                  aria-label="Từ ngày"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                Đến ngày
                <input
                  aria-label="Đến ngày"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
            {filterError && <p role="alert">{filterError}</p>}
            <footer>
              <button
                className="ref-button"
                type="button"
                onClick={() => {
                  setFilterKind("");
                  setFilterStatus("");
                  setFrom("");
                  setTo("");
                  setFilterError("");
                }}
              >
                Đặt lại
              </button>
              <button className="ref-button teal" type="submit">
                Lọc
              </button>
            </footer>
          </form>
        )}
        <div className="ref-data-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Chọn</span>
                </th>
                <th>Ngày</th>
                <th>Số chứng từ</th>
                <th>Diễn giải</th>
                <th className="numeric">Số tiền</th>
                <th>Đối tượng</th>
                <th>Lý do thu/chi</th>
                <th>Trạng thái</th>
                <th>Chức năng</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((t) => (
                <tr
                  key={t.id}
                  className={detailId === t.id ? "row-selected" : ""}
                >
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${t.code}`}
                      checked={selected.includes(t.id)}
                      onChange={() =>
                        setSelected(
                          selected.includes(t.id)
                            ? selected.filter((id) => id !== t.id)
                            : [...selected, t.id],
                        )
                      }
                    />
                  </td>
                  <td>{dateLabel(t.date)}</td>
                  <td>
                    <button
                      className="document-link"
                      onClick={() => setDetailId(t.id)}
                    >
                      {t.code}
                    </button>
                  </td>
                  <td>{t.description}</td>
                  <td className="numeric">{money(t.amount)}</td>
                  <td>{t.partner}</td>
                  <td>{kinds[t.kind]}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>
                    <button className="ref-link" onClick={() => onDetail(t)}>
                      Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!paged.length && (
          <EmptyReference>
            <button
              className="ref-link"
              onClick={() =>
                update({ q: "", status: "", kind: "", from: "", to: "" })
              }
            >
              Xóa bộ lọc
            </button>
          </EmptyReference>
        )}
        <div className="ref-pagination">
          <span>{filtered.length} chứng từ</span>
          <button
            className="ref-icon"
            disabled={page <= 1}
            aria-label="Trang trước"
            onClick={() => update({ page: String(page - 1) })}
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            {page} / {pageCount}
          </span>
          <button
            className="ref-icon"
            disabled={page >= pageCount}
            aria-label="Trang sau"
            onClick={() => update({ page: String(page + 1) })}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </section>
      <div className="ref-detail-divider">
        <ChevronDown size={12} />
      </div>
      <section className="ref-inline-detail">
        <h2>Chi tiết</h2>
        <div>
          {detail ? (
            <>
              <div className="ref-detail-heading">
                <strong>
                  {detail.code} — {detail.description}
                </strong>
                <button className="ref-link" onClick={() => onDetail(detail)}>
                  Mở chứng từ
                </button>
              </div>
              <div className="ref-data-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Diễn giải</th>
                      <th>Đối tượng</th>
                      <th className="numeric">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      detail.lines || [
                        {
                          description: detail.description,
                          amount: detail.amount,
                        },
                      ]
                    ).map((l, i) => (
                      <tr key={i}>
                        <td>{l.description || detail.description}</td>
                        <td>{detail.partner}</td>
                        <td className="numeric">{money(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyReference />
          )}
        </div>
      </section>
    </div>
  );
}
