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
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Landmark,
  Menu,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  companies,
  dateLabel,
  kinds,
  modules,
  persistTransactions,
  readTransactions,
  type Kind,
  type Transaction,
} from "./data";
import { DocumentDetail, DocumentForm, Modal } from "./components";
import { Dashboard, ModulePage, Reports } from "./pages";
import { TaxPage } from "./TaxPage";
import "./App.css";

type Panel = "quick" | "help" | "settings" | "notifications" | null;
function Workspace() {
  const [params, setParams] = useSearchParams();
  const location = useLocation(),
    navigate = useNavigate();
  const moduleId = location.pathname.split("/")[1] || "overview";
  const module = modules.find((m) => m.id === moduleId);
  const company =
    companies.find((c) => c.id === params.get("company")) || companies[0];
  const period = ["2026-09", "2026-08", "2026"].includes(
    params.get("period") || "",
  )
    ? params.get("period")!
    : "2026-09";
  const [transactions, setTransactions] = useState(readTransactions);
  const [collapsed, setCollapsed] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null),
    [createKind, setCreateKind] = useState<Kind | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null),
    [toast, setToast] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const detail = transactions.find((t) => t.id === detailId);
  const scoped = transactions.filter(
    (t) => t.company === company.id && t.date.startsWith(period),
  );
  const pending = scoped.filter((t) => t.status === "pending");
  const periodLabel =
    period === "2026" ? "Năm 2026" : `Tháng ${Number(period.slice(5))}/2026`;
  function href(path: string, extra?: Record<string, string>) {
    return `${path}?${new URLSearchParams({ company: company.id, period, ...extra })}`;
  }
  function context(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([k, v]) => next.set(k, v));
    next.delete("page");
    setParams(next);
  }
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    document.title = `${module?.label || "Không tìm thấy"} | Sổ Việt`;
  }, [module?.label]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  function save(item: Transaction, another: boolean) {
    const next = [item, ...transactions];
    try {
      persistTransactions(next);
      setTransactions(next);
      if (!another) setCreateKind(null);
      setToast(`Đã lưu ${item.code} trên trình duyệt.`);
      return true;
    } catch {
      setToast(
        "Không thể lưu trên trình duyệt. Hãy kiểm tra dung lượng hoặc quyền lưu trữ.",
      );
      return false;
    }
  }
  function submitDraft(id: string) {
    const next = transactions.map((t) =>
      t.id === id && t.status === "draft"
        ? { ...t, status: "pending" as const }
        : t,
    );
    try {
      persistTransactions(next);
      setTransactions(next);
      setToast("Đã chuyển sang Chờ duyệt trong bản trải nghiệm.");
    } catch {
      setToast("Không thể lưu thay đổi. Vui lòng kiểm tra bộ nhớ trình duyệt.");
    }
  }
  function create(kind: Kind) {
    setPanel(null);
    setCreateKind(kind);
  }
  const defaultKind: Kind =
    moduleId === "purchases"
      ? "purchase"
      : moduleId === "sales" || moduleId === "invoices"
        ? "sale"
        : moduleId === "bank"
          ? "bank"
          : "receipt";
  return (
    <div className={`workspace ${collapsed ? "is-collapsed" : ""}`}>
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      {mobileOpen && (
        <button
          className="mobile-shade"
          aria-label="Đóng điều hướng"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}
        aria-label="Điều hướng chính"
      >
        <Link className="brand" to={href("/overview")}>
          <span className="brand-mark">
            <BookOpen size={24} strokeWidth={2.4} />
          </span>
          <span className="brand-name">
            sổ<span>việt</span>
            <small>Kế toán & thuế</small>
          </span>
        </Link>
        <button className="quick-create" onClick={() => setPanel("quick")}>
          <Plus size={20} />
          <span>Thêm nhanh</span>
          <kbd>+</kbd>
        </button>
        <nav>
          {modules.map((m, i) => (
            <div key={m.id}>
              {m.group && m.group !== modules[i - 1]?.group && (
                <div className="nav-group">{m.group}</div>
              )}
              <NavLink
                to={href(`/${m.id}`)}
                title={m.label}
                className={({ isActive }) =>
                  `nav-link ${isActive || (location.pathname === "/" && m.id === "overview") ? "active" : ""}`
                }
                onClick={() => setMobileOpen(false)}
              >
                <m.icon size={19} />
                <span>{m.label}</span>
                {m.id === "invoices" && (
                  <span className="nav-count">
                    {
                      scoped.filter(
                        (t) =>
                          (t.kind === "purchase" || t.kind === "sale") &&
                          t.status === "pending",
                      ).length
                    }
                  </span>
                )}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-label">
            <ShieldCheck size={18} />
            <span>
              Không gian làm việc<small>Bản trải nghiệm</small>
            </span>
          </div>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          >
            <PanelLeftClose size={18} />
            <span>Thu gọn</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="global-header">
          <button
            className="icon-button mobile-menu"
            aria-label="Mở điều hướng"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu />
          </button>
          <div className="company-select">
            <span className="company-monogram">{company.short}</span>
            <label className="sr-only" htmlFor="company">
              Doanh nghiệp
            </label>
            <select
              id="company"
              value={company.id}
              onChange={(e) => context({ company: e.target.value })}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="header-divider" />
          <span className="fiscal-year">Năm tài chính 2026</span>
          <div className="header-actions">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(href("/ledger/transactions", { q: globalSearch }));
                setGlobalSearch("");
              }}
            >
              <Search size={17} />
              <input
                id="global-search"
                aria-label="Tìm kiếm toàn bộ chứng từ"
                placeholder="Tìm kiếm chứng từ…"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              <kbd>Ctrl K</kbd>
            </form>
            <button
              className="icon-button help-button"
              aria-label="Hướng dẫn"
              onClick={() => setPanel("help")}
            >
              <CircleHelp size={20} />
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Thông báo"
              onClick={() => setPanel("notifications")}
            >
              <Bell size={20} />
              {pending.length > 0 && <span className="notification-dot" />}
            </button>
            <button
              className="avatar"
              aria-label="Thông tin không gian làm việc"
              onClick={() => setPanel("settings")}
            >
              MA
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="breadcrumb">
            Không gian làm việc
            <ChevronRight size={13} />
            <span>{module?.label || "Không tìm thấy"}</span>
            <span className="demo-tag">Dữ liệu mẫu</span>
          </div>
          <div className="page-heading">
            <div>
              <h1>{module?.label || "Không tìm thấy trang"}</h1>
              <p>
                {moduleId === "overview"
                  ? "Nắm bắt tình hình kinh doanh, chủ động từng quyết định."
                  : `Quản lý ${module?.label.toLocaleLowerCase("vi-VN") || "nghiệp vụ"} trong một không gian làm việc.`}
              </p>
            </div>
            <div className="page-actions">
              <label className="period-select">
                <Clock3 size={16} />
                <span className="sr-only">Kỳ kế toán</span>
                <select
                  aria-label="Kỳ kế toán"
                  value={period}
                  onChange={(e) => context({ period: e.target.value })}
                >
                  <option value="2026-09">Tháng 9, 2026</option>
                  <option value="2026-08">Tháng 8, 2026</option>
                  <option value="2026">Cả năm 2026</option>
                </select>
              </label>
              {[
                "overview",
                "cash",
                "bank",
                "purchases",
                "sales",
                "invoices",
                "ledger",
              ].includes(moduleId) && (
                <button
                  className="button primary"
                  onClick={() =>
                    moduleId === "overview"
                      ? setPanel("quick")
                      : create(defaultKind)
                  }
                >
                  <Plus size={17} />
                  Tạo chứng từ
                </button>
              )}
            </div>
          </div>
          {moduleId === "overview" ? (
            <Dashboard
              items={scoped}
              period={period}
              href={href}
              onSelect={(t) => setDetailId(t.id)}
              onCreate={() => setPanel("quick")}
            />
          ) : [
              "cash",
              "bank",
              "purchases",
              "sales",
              "invoices",
              "ledger",
            ].includes(moduleId) ? (
            <ModulePage
              key={`${moduleId}-${company.id}-${period}`}
              moduleId={moduleId}
              items={scoped}
              href={href}
              onSelect={(t) => setDetailId(t.id)}
              onCreate={() => create(defaultKind)}
              notify={setToast}
            />
          ) : moduleId === "tax" ? (
            <TaxPage href={href} />
          ) : moduleId === "reports" ? (
            <Reports items={scoped} notify={setToast} />
          ) : module ? (
            <section className="card module-placeholder">
              <module.icon size={42} strokeWidth={1.5} />
              <h2>{module.label}</h2>
              <p>
                Khung phân hệ đã sẵn sàng. Chức năng{" "}
                {module.label.toLocaleLowerCase("vi-VN")} sẽ được kết nối khi có
                API và quy tắc nghiệp vụ.
              </p>
              <Link className="button" to={href("/overview")}>
                Về tổng quan
              </Link>
            </section>
          ) : (
            <section className="card module-placeholder">
              <h2>Đường dẫn không tồn tại</h2>
              <Link className="button primary" to={href("/overview")}>
                Về tổng quan
              </Link>
            </section>
          )}
        </main>
      </div>
      {panel && (
        <Modal
          title={
            panel === "quick"
              ? "Thêm nhanh chứng từ"
              : panel === "help"
                ? "Hướng dẫn sử dụng"
                : panel === "notifications"
                  ? "Thông báo công việc"
                  : "Không gian làm việc"
          }
          onClose={() => setPanel(null)}
        >
          <div className="modal-body">
            {panel === "quick" ? (
              <>
                <p className="muted">
                  Chọn nghiệp vụ bạn muốn tạo cho {company.name}.
                </p>
                <div className="quick-grid">
                  {Object.entries(kinds).map(([key, label]) => (
                    <button key={key} onClick={() => create(key as Kind)}>
                      <span className="metric-icon blue">
                        {key === "bank" ? (
                          <Landmark size={21} />
                        ) : (
                          <FileText size={21} />
                        )}
                      </span>
                      <strong>{label}</strong>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </>
            ) : panel === "help" ? (
              <>
                <h3>Bắt đầu với Sổ Việt</h3>
                <ol className="help-list">
                  <li>Chọn doanh nghiệp và kỳ kế toán ở đầu trang.</li>
                  <li>Dùng “Thêm nhanh” để tạo một phiếu nháp.</li>
                  <li>Mở phân hệ để tìm, lọc và xuất chứng từ CSV.</li>
                  <li>Chọn số chứng từ để xem thông tin và lịch sử.</li>
                </ol>
                <p className="info-note">
                  Bạn đang dùng dữ liệu mẫu. Các phiếu nháp chỉ lưu trên trình
                  duyệt hiện tại. Chưa có đăng nhập, phân quyền, ghi sổ hay kết
                  nối thuế thật.
                </p>
              </>
            ) : panel === "notifications" ? (
              <>
                {pending.map((t) => (
                  <button
                    className="notification-item"
                    key={t.id}
                    onClick={() => {
                      setPanel(null);
                      setDetailId(t.id);
                    }}
                  >
                    <Clock3 size={18} />
                    <span>
                      <strong>{t.code} đang chờ duyệt</strong>
                      <small>
                        {t.partner} · {dateLabel(t.date)}
                      </small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
                {!pending.length && (
                  <p>Không có chứng từ chờ duyệt trong kỳ.</p>
                )}
              </>
            ) : (
              <>
                <div className="company-profile">
                  <span className="company-monogram">{company.short}</span>
                  <div>
                    <h3>{company.name}</h3>
                    <p className="muted">
                      Không gian trải nghiệm · {periodLabel}
                    </p>
                  </div>
                </div>
                <div className="settings-links">
                  {["directory", "settings"].map((id) => (
                    <Link
                      key={id}
                      to={href(`/${id}`)}
                      onClick={() => setPanel(null)}
                    >
                      <Settings2 size={18} />
                      {modules.find((m) => m.id === id)?.label}
                      <ChevronRight size={16} />
                    </Link>
                  ))}
                </div>
                <p className="info-note">
                  Chưa kết nối tài khoản thật. Dữ liệu được phân tách theo từng
                  doanh nghiệp mẫu.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
      {createKind && (
        <DocumentForm
          key={`${company.id}-${createKind}`}
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
          onSubmit={submitDraft}
        />
      )}
      <div
        className={`toast ${toast ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <Check size={18} />
            <span>{toast}</span>
            <button aria-label="Đóng thông báo" onClick={() => setToast("")}>
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
      <Workspace />
    </BrowserRouter>
  );
}
