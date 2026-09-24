import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Bell,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  Download,
  Grip,
  Lightbulb,
  Megaphone,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  UserRoundPlus,
  X,
} from "lucide-react";
import {
  companies,
  kinds,
  persistTransactions,
  readTransactions,
  type Kind,
  type Transaction,
} from "./data";
import { DocumentDetail, DocumentForm, Modal } from "./components";
import { TaxPage } from "./TaxPage";
import { Reports } from "./pages";
import {
  referenceNav,
  referenceTabs,
  settingsGroups,
} from "./reference-config";
import {
  ReferenceDashboard,
  ReferenceProcess,
  ReferenceTransactions,
} from "./ReferencePages";
import "./App.css";
import "./reference.css";

export type ReferenceHref = (
  path: string,
  extra?: Record<string, string>,
) => string;
function ReferenceWorkspace() {
  const [params, setParams] = useSearchParams(),
    location = useLocation(),
    navigate = useNavigate();
  const moduleId = location.pathname.split("/")[1] || "overview",
    tabs = referenceTabs[moduleId] || [["transactions", "Danh sách"]];
  const tab = location.pathname.split("/")[2] || tabs[0][0],
    module = referenceNav.find((m) => m.id === moduleId);
  const company =
    companies.find((c) => c.id === params.get("company")) || companies[0];
  const period = ["2026-09", "2026-08", "2026"].includes(
    params.get("period") || "",
  )
    ? params.get("period")!
    : "2026-09";
  const [items, setItems] = useState(readTransactions);
  const scoped = items.filter(
    (t) => t.company === company.id && t.date.startsWith(period),
  );
  const [collapsed, setCollapsed] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false);
  const [panel, setPanel] = useState<
    "quick" | "settings" | "notifications" | "help" | null
  >(null);
  const [createKind, setCreateKind] = useState<Kind | null>(null),
    [detailId, setDetailId] = useState<string | null>(null);
  const [notice, setNotice] = useState(""),
    [info, setInfo] = useState(""),
    [query, setQuery] = useState("");
  const href: ReferenceHref = (path, extra) =>
    `${path}?${new URLSearchParams({ company: company.id, period, ...extra })}`;
  const detail = items.find((t) => t.id === detailId),
    pending = scoped.filter((t) => t.status === "pending");
  useEffect(() => {
    document.title = `${module?.label || "Kế toán"} | Sổ Việt`;
  }, [module?.label]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("reference-search")?.focus();
      }
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const context = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    next.delete("page");
    setParams(next);
  };
  const create = (kind: Kind) => {
    setPanel(null);
    setCreateKind(kind);
  };
  const save = (item: Transaction, another: boolean) => {
    const next = [item, ...items];
    try {
      persistTransactions(next);
      setItems(next);
      if (!another) setCreateKind(null);
      setNotice(`Đã lưu ${item.code} trên trình duyệt.`);
      return true;
    } catch {
      return false;
    }
  };
  const submit = (id: string) => {
    const next = items.map((t) =>
      t.id === id && t.status === "draft"
        ? { ...t, status: "pending" as const }
        : t,
    );
    try {
      persistTransactions(next);
      setItems(next);
      setNotice("Đã chuyển sang chờ duyệt trong bản trải nghiệm.");
    } catch {
      setNotice("Không thể lưu. Vui lòng kiểm tra dung lượng trình duyệt.");
    }
  };
  const infoAction = (name: string) => {
    setPanel(null);
    setInfo(name);
  };
  return (
    <div className={`reference-app ${collapsed ? "ref-collapsed" : ""}`}>
      <a href="#reference-main" className="skip-link">
        Đến nội dung chính
      </a>
      <header className="ref-header">
        <button
          className="ref-icon ref-mobile-trigger"
          aria-label="Mở điều hướng"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu size={20} />
        </button>
        <Link to={href("/overview")} className="ref-brand">
          <Grip size={17} />
          <span className="ref-logo">
            <span />
          </span>
          <strong>KẾ TOÁN</strong>
        </Link>
        <label className="ref-company">
          <span className="sr-only">Doanh nghiệp</span>
          <select
            aria-label="Doanh nghiệp"
            value={company.id}
            onChange={(e) => context("company", e.target.value)}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ref-period">
          <span className="ref-dot" />
          <select
            aria-label="Kỳ kế toán"
            value={period}
            onChange={(e) => context("period", e.target.value)}
          >
            <option value="2026-09">K9.2026</option>
            <option value="2026-08">K8.2026</option>
            <option value="2026">Năm 2026</option>
          </select>
        </label>
        <div className="ref-header-tools">
          <form
            className="ref-global-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(href("/ledger/transactions", { q: query }));
              setQuery("");
            }}
          >
            <Search size={13} />
            <input
              id="reference-search"
              aria-label="Tìm kiếm toàn bộ chứng từ"
              placeholder="Tìm kiếm thông minh…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span>AI</span>
          </form>
          <button className="ref-help" onClick={() => setPanel("help")}>
            <span>▶</span> Hướng dẫn
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Tải dữ liệu"
            onClick={() => navigate(href("/reports"))}
          >
            <Download size={17} />
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Tính năng mới"
            onClick={() => infoAction("Tính năng mới")}
          >
            <Megaphone size={17} />
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Quản lý người dùng"
            onClick={() => infoAction("Quản lý người dùng và phân quyền")}
          >
            <UserRoundPlus size={17} />
          </button>
          <button
            className="ref-icon"
            aria-label="Các tiện ích và thiết lập"
            onClick={() => setPanel("settings")}
          >
            <Settings size={17} />
          </button>
          <button
            className="ref-icon ref-bell"
            aria-label="Thông báo"
            onClick={() => setPanel("notifications")}
          >
            <Bell size={17} />
            {pending.length > 0 && <span>{pending.length}</span>}
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Trợ giúp"
            onClick={() => setPanel("help")}
          >
            <CircleHelp size={17} />
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Tiện ích khác"
            onClick={() => setPanel("settings")}
          >
            <MoreHorizontal size={17} />
          </button>
          <span className="ref-demo">Dữ liệu mẫu</span>
        </div>
      </header>
      {mobileOpen && (
        <button
          className="ref-mobile-shade"
          aria-label="Đóng điều hướng"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`ref-sidebar ${mobileOpen ? "open" : ""}`}
        aria-label="Điều hướng chính"
      >
        <div className="ref-quick">
          <button onClick={() => setPanel("quick")} aria-label="Thêm nhanh">
            <Plus size={13} />
            <span>Thêm nhanh</span>
          </button>
        </div>
        <div className="ref-nav-heading">
          <strong>
            PHÂN HỆ <ChevronDown size={10} />
          </strong>
          <button
            aria-label="Thiết lập phân hệ"
            onClick={() => infoAction("Thiết lập phân hệ")}
          >
            <Pencil size={13} />
          </button>
        </div>
        <nav>
          {referenceNav.map((m) => (
            <NavLink
              key={m.id}
              title={m.label}
              className={() =>
                `ref-nav-item ${moduleId === m.id ? "active" : ""}`
              }
              to={href(`/${m.id}`)}
              onClick={() => setMobileOpen(false)}
            >
              <m.icon size={16} />
              <span>{m.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          className="ref-collapse"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
        >
          <ChevronLeft size={15} />
          <span>Thu gọn</span>
        </button>
      </aside>
      <main id="reference-main" className="ref-main" tabIndex={-1}>
        <h1 className="sr-only">{module?.label || "Không tìm thấy"}</h1>
        <div className="ref-module-bar">
          <nav aria-label="Chức năng phân hệ">
            {tabs.map(([id, label]) => (
              <Link
                className={tab === id ? "active" : ""}
                to={href(`/${moduleId}/${id}`)}
                key={id}
              >
                {label}
                {id === "news" && <small>Mới</small>}
              </Link>
            ))}
          </nav>
          <div className="ref-tab-tools">
            <button
              className="ref-tip"
              aria-label="Gợi ý sử dụng"
              onClick={() => setPanel("help")}
            >
              <Lightbulb size={21} />
            </button>
            <button
              className="ref-icon"
              aria-label="Tùy chọn hiển thị"
              onClick={() => infoAction("Tùy chọn hiển thị")}
            >
              <SlidersHorizontal size={17} />
            </button>
          </div>
        </div>
        {moduleId === "overview" && tab === "overview" ? (
          <ReferenceDashboard
            items={scoped}
            company={company.name}
            href={href}
            notify={setNotice}
          />
        ) : ["cash", "bank", "purchases", "sales"].includes(moduleId) &&
          tab === "process" ? (
          <ReferenceProcess
            moduleId={moduleId}
            href={href}
            create={create}
            onInfo={infoAction}
          />
        ) : ["transactions", "orders", "invoices"].includes(tab) &&
          ["cash", "bank", "purchases", "sales", "invoices", "ledger"].includes(
            moduleId,
          ) ? (
          <ReferenceTransactions
            key={`${moduleId}-${company.id}-${period}-${tab}`}
            moduleId={moduleId}
            items={scoped}
            create={create}
            onDetail={(t) => setDetailId(t.id)}
            notify={setNotice}
            onInfo={infoAction}
          />
        ) : moduleId === "reports" || tab === "reports" || tab === "chart" ? (
          <div className="ref-report-page">
            <Reports items={scoped} notify={setNotice} />
          </div>
        ) : moduleId === "tax" ? (
          <div className="ref-report-page">
            <TaxPage href={href} />
          </div>
        ) : (
          <div className="ref-unavailable">
            <Bot size={42} strokeWidth={1} />
            <h2>{tabs.find((t) => t[0] === tab)?.[1] || module?.label}</h2>
            <p>Chưa có dữ liệu nghiệp vụ cho chức năng này.</p>
            <button
              className="ref-button"
              onClick={() =>
                infoAction(
                  tabs.find((t) => t[0] === tab)?.[1] ||
                    module?.label ||
                    "Chức năng",
                )
              }
            >
              Xem thông tin
            </button>
          </div>
        )}
      </main>
      {panel === "settings" && (
        <Modal
          title="Các tiện ích và thiết lập"
          onClose={() => setPanel(null)}
          wide
        >
          <div className="ref-mega-menu">
            {settingsGroups.map((g, i) => (
              <section
                className={`ref-settings-group group-${i}`}
                key={g.title}
              >
                <h3>{g.title}</h3>
                {g.items.map((label) => (
                  <button key={label} onClick={() => infoAction(label)}>
                    {label}
                  </button>
                ))}
              </section>
            ))}
          </div>
        </Modal>
      )}
      {panel && panel !== "settings" && (
        <Modal
          title={
            panel === "quick"
              ? "Thêm nhanh chứng từ"
              : panel === "help"
                ? "Hướng dẫn sử dụng"
                : "Thông báo"
          }
          onClose={() => setPanel(null)}
        >
          <div className="modal-body">
            {panel === "quick" ? (
              <div className="quick-grid">
                {Object.entries(kinds).map(([kind, label]) => (
                  <button key={kind} onClick={() => create(kind as Kind)}>
                    <Plus size={16} />
                    {label}
                  </button>
                ))}
              </div>
            ) : panel === "help" ? (
              <>
                <p>
                  Chọn phân hệ bên trái, sau đó chọn Quy trình hoặc danh sách
                  giao dịch trên thanh tab.
                </p>
                <ol className="help-list">
                  <li>Nhấn Thu tiền hoặc Chi tiền để mở các nghiệp vụ.</li>
                  <li>
                    Dùng bộ lọc để tìm chứng từ theo trạng thái và thời gian.
                  </li>
                  <li>Chọn một chứng từ để xem chi tiết phía dưới bảng.</li>
                </ol>
                <p className="info-note">
                  Bản trải nghiệm lưu nháp trên trình duyệt. Chưa kết nối API kế
                  toán, phân quyền và thuế.
                </p>
              </>
            ) : pending.length ? (
              pending.map((t) => (
                <button
                  className="notification-item"
                  key={t.id}
                  onClick={() => {
                    setPanel(null);
                    setDetailId(t.id);
                  }}
                >
                  <Bell size={16} />
                  <span>
                    {t.code}
                    <small>{t.description}</small>
                  </span>
                </button>
              ))
            ) : (
              <p>Không có chứng từ chờ duyệt trong kỳ.</p>
            )}
          </div>
        </Modal>
      )}
      {info && (
        <Modal title={info} onClose={() => setInfo("")}>
          <div className="modal-body">
            <p className="info-note">
              Chức năng “{info}” chưa kết nối dữ liệu nghiệp vụ. Bản giao diện
              hiện hỗ trợ tạo nháp, xem chứng từ, tìm kiếm, lọc và xuất CSV.
            </p>
          </div>
        </Modal>
      )}
      {createKind && (
        <DocumentForm
          kind={createKind}
          company={company.id}
          period={period}
          onSave={save}
          onClose={() => setCreateKind(null)}
        />
      )}
      {detail && (
        <DocumentDetail
          item={detail}
          onClose={() => setDetailId(null)}
          onSubmit={submit}
        />
      )}
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice && (
          <>
            <Check size={16} />
            <span>{notice}</span>
            <button aria-label="Đóng thông báo" onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <ReferenceWorkspace />
    </BrowserRouter>
  );
}
