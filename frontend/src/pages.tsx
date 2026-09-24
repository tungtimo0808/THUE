import { lazy, Suspense, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  downloadCsv,
  kinds,
  matchesModule,
  modules,
  money,
  shortMoney,
  statuses,
  type Transaction,
} from "./data";
import { StatusBadge, TransactionTable } from "./components";
const FinancialChart = lazy(() => import("./Chart"));
type Href = (path: string, extra?: Record<string, string>) => string;
type PageProps = {
  items: Transaction[];
  href: Href;
  onSelect: (t: Transaction) => void;
  onCreate: () => void;
};
const sum = (items: Transaction[]) => items.reduce((s, t) => s + t.amount, 0);

export function Dashboard({
  items,
  period,
  href,
  onSelect,
  onCreate,
}: PageProps & { period: string }) {
  const posted = items.filter((t) => t.status === "posted"),
    pending = items.filter((t) => t.status === "pending");
  const revenue = sum(posted.filter((t) => t.kind === "sale")),
    expenses = sum(posted.filter((t) => t.kind === "purchase"));
  const received = sum(
    posted.filter((t) => t.kind === "receipt" || t.kind === "bank"),
  );
  const metrics = [
    {
      label: "Doanh thu bán hàng",
      value: revenue,
      icon: ArrowUpRight,
      tone: "blue",
      hint: "Chứng từ bán hàng đã ghi sổ",
    },
    {
      label: "Giá trị mua hàng",
      value: expenses,
      icon: ArrowDownLeft,
      tone: "orange",
      hint: "Chứng từ mua hàng đã ghi sổ",
    },
    {
      label: "Tiền đã thu",
      value: received,
      icon: Wallet,
      tone: "teal",
      hint: "Tiền mặt và tiền gửi đã ghi sổ",
    },
    {
      label: "Chứng từ chờ duyệt",
      value: pending.length,
      icon: FileCheck2,
      tone: "violet",
      hint: "Cần kiểm tra và xác nhận",
    },
  ];
  return (
    <>
      <div className="overview-tabs">
        <span className="active">Tổng quan hoạt động</span>
        <Link to={href("/reports")}>Báo cáo quản trị</Link>
        <span className="live-note">
          <span />
          {period === "2026"
            ? "Năm 2026"
            : `Tháng ${Number(period.slice(5))}/2026`}{" "}
          · VND
        </span>
      </div>
      <div className="metrics">
        {metrics.map((m, i) => (
          <article className="metric" key={m.label}>
            <div className="metric-top">
              <span>{m.label}</span>
              <span className={`metric-icon ${m.tone}`}>
                <m.icon size={19} />
              </span>
            </div>
            <strong className="metric-value">
              {i === 3
                ? m.value.toString().padStart(2, "0")
                : shortMoney(m.value)}
              {i !== 3 && <small>VND</small>}
            </strong>
            <div className="metric-hint">
              {i === 3 ? (
                <Clock3 size={13} />
              ) : (
                <span className={`small-dot ${m.tone}`} />
              )}
              {m.hint}
            </div>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card chart-card">
          <div className="card-heading">
            <div>
              <h2>Dòng tiền thu & chi</h2>
              <p>Theo chứng từ đã ghi sổ trong kỳ</p>
            </div>
            <Link className="text-link" to={href("/cash/transactions")}>
              Chi tiết
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="chart-summary">
            <div>
              <span>
                <i className="legend-dot blue" />
                Tổng thu
              </span>
              <strong>{money(received)}</strong>
            </div>
            <div>
              <span>
                <i className="legend-dot muted-blue" />
                Tổng chi
              </span>
              <strong>
                {money(sum(posted.filter((t) => t.kind === "payment")))}
              </strong>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="chart-skeleton" role="status">
                Đang tải biểu đồ…
              </div>
            }
          >
            <FinancialChart items={posted} period={period} />
          </Suspense>
        </section>
        <section className="card tasks-card">
          <div className="card-heading">
            <div>
              <h2>Cần xử lý</h2>
              <p>Những công việc đang chờ bạn</p>
            </div>
            <span className="count-pill">{pending.length}</span>
          </div>
          <div className="task-list">
            {pending.slice(0, 3).map((t, i) => (
              <button
                className="task-item"
                key={t.id}
                onClick={() => onSelect(t)}
              >
                <span
                  className={`task-icon ${["orange", "blue", "violet"][i]}`}
                >
                  <FileCheck2 size={20} />
                </span>
                <span>
                  <strong>{kinds[t.kind]} chờ duyệt</strong>
                  <small>
                    {t.code} · {money(t.amount)}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
            {!pending.length && (
              <div className="compact-empty">
                <Check size={24} />
                <p>Đã xử lý hết công việc trong kỳ.</p>
              </div>
            )}
          </div>
          <div className="period-note">
            <ShieldCheck size={22} />
            <div>
              <strong>Kiểm soát trước khi ghi sổ</strong>
              <p>Đối chiếu chứng từ để số liệu luôn nhất quán.</p>
            </div>
          </div>
          <Link
            className="all-tasks"
            to={href("/ledger/transactions", { status: "pending" })}
          >
            Xem tất cả việc cần xử lý
            <ChevronRight size={16} />
          </Link>
        </section>
      </div>
      <section className="card recent-card">
        <div className="card-heading">
          <div>
            <h2>Chứng từ gần đây</h2>
            <p>Các giao dịch mới nhất trong kỳ kế toán</p>
          </div>
          <Link className="text-link" to={href("/ledger/transactions")}>
            Xem tất cả
            <ChevronRight size={15} />
          </Link>
        </div>
        {items.length ? (
          <TransactionTable
            items={[...items]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)}
            onSelect={onSelect}
          />
        ) : (
          <Empty onCreate={onCreate} />
        )}
      </section>
      <div className="dashboard-bottom">
        <span>
          <ShieldCheck size={14} />
          Dữ liệu minh họa · Chưa kết nối sổ kế toán thực tế
        </span>
        <span>Sổ Việt Workspace</span>
      </div>
    </>
  );
}

export function ModulePage({
  items,
  moduleId,
  href,
  onSelect,
  onCreate,
  notify,
}: PageProps & { moduleId: string; notify: (text: string) => void }) {
  const [params, setParams] = useSearchParams(),
    location = useLocation();
  const tab = location.pathname.split("/")[2] || "transactions";
  const [filterOpen, setFilterOpen] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const query = params.get("q") || "",
    status = params.get("status") || "",
    kindFilter = params.get("kind") || "";
  const scoped = items.filter((t) => matchesModule(t, moduleId));
  const filtered = scoped
    .filter(
      (t) =>
        (!status || t.status === status) &&
        (!kindFilter || t.kind === kindFilter) &&
        `${t.code} ${t.partner} ${t.description}`
          .toLocaleLowerCase("vi-VN")
          .includes(query.toLocaleLowerCase("vi-VN")),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 8));
  const page = Math.min(
    Math.max(1, Math.floor(Number(params.get("page"))) || 1),
    pageCount,
  );
  const paged = filtered.slice((page - 1) * 8, page * 8);
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    if (!("page" in values)) next.delete("page");
    setParams(next, { replace: true });
    setSelected([]);
  }
  function exportItems() {
    const exported = selected.length
      ? filtered.filter((t) => selected.includes(t.id))
      : filtered;
    downloadCsv(exported);
    notify(`Đã xuất ${exported.length} chứng từ mẫu sang CSV.`);
  }
  return (
    <>
      <div className="module-tabs">
        {[
          { id: "transactions", label: "Giao dịch" },
          { id: "process", label: "Quy trình" },
          { id: "reports", label: "Phân tích" },
        ].map((t) => (
          <Link
            key={t.id}
            className={tab === t.id ? "active" : ""}
            to={href(`/${moduleId}/${t.id}`)}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "process" ? (
        <section className="card process-card">
          <h2>
            Quy trình{" "}
            {modules
              .find((m) => m.id === moduleId)
              ?.label.toLocaleLowerCase("vi-VN")}
          </h2>
          <p className="muted">
            Từ chứng từ đến sổ kế toán, mỗi bước đều có thể theo dõi.
          </p>
          <div className="process-flow">
            {[
              "Tạo chứng từ",
              "Kiểm tra thông tin",
              "Gửi duyệt",
              "Ghi sổ kế toán",
            ].map((s, i) => (
              <div key={s}>
                <span className="process-number">{i + 1}</span>
                <h3>{s}</h3>
                <p>
                  {
                    [
                      "Nhập đối tượng và số tiền",
                      "Đối chiếu nội dung giao dịch",
                      "Chuyển kế toán phụ trách",
                      "Xử lý tại máy chủ",
                    ][i]
                  }
                </p>
                {i === 0 && (
                  <button className="button primary" onClick={onCreate}>
                    <Plus size={16} />
                    Tạo bản nháp
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="info-note">
            Bản trải nghiệm hỗ trợ tạo nháp và chuyển trạng thái chờ duyệt.
            Duyệt và ghi sổ thật cần API nghiệp vụ.
          </p>
        </section>
      ) : tab === "reports" ? (
        <Reports items={scoped} notify={notify} />
      ) : (
        <>
          <div className="list-summary">
            <div>
              <span>Tổng chứng từ trong kỳ</span>
              <strong>{scoped.length}</strong>
            </div>
            <div>
              <span>Tổng giá trị chứng từ</span>
              <strong>{money(sum(scoped))}</strong>
            </div>
            <div>
              <span>Chờ duyệt</span>
              <strong>
                {scoped.filter((t) => t.status === "pending").length}
              </strong>
            </div>
          </div>
          <section className="card">
            <div className="table-toolbar">
              <form
                className="table-search"
                onSubmit={(e) => e.preventDefault()}
              >
                <Search size={17} />
                <input
                  aria-label="Tìm trong danh sách"
                  placeholder="Tìm số chứng từ, đối tượng…"
                  value={query}
                  onChange={(e) => update({ q: e.target.value })}
                />
              </form>
              <button
                className={`button ${filterOpen || status || kindFilter ? "selected-button" : ""}`}
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Filter size={16} />
                Bộ lọc
                {(status || kindFilter) && <span className="filter-dot" />}
              </button>
              <button className="button" onClick={exportItems}>
                <Download size={16} />
                Xuất CSV{selected.length ? ` (${selected.length})` : ""}
              </button>
            </div>
            {filterOpen && (
              <div className="filter-bar">
                <label>
                  Trạng thái
                  <select
                    aria-label="Trạng thái"
                    value={status}
                    onChange={(e) => update({ status: e.target.value })}
                  >
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(statuses).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Loại chứng từ
                  <select
                    aria-label="Loại chứng từ"
                    value={kindFilter}
                    onChange={(e) => update({ kind: e.target.value })}
                  >
                    <option value="">Tất cả loại</option>
                    {Object.entries(kinds)
                      .filter(([key]) =>
                        matchesModule({ kind: key } as Transaction, moduleId),
                      )
                      .map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="text-button"
                  onClick={() => update({ status: "", kind: "", q: "" })}
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            )}
            {paged.length ? (
              <TransactionTable
                items={paged}
                selected={selected}
                onToggle={(id) =>
                  setSelected(
                    selected.includes(id)
                      ? selected.filter((x) => x !== id)
                      : [...selected, id],
                  )
                }
                onSelect={onSelect}
              />
            ) : (
              <Empty
                onCreate={onCreate}
                onReset={() => update({ status: "", kind: "", q: "" })}
              />
            )}
            <div className="pagination">
              <span>
                {filtered.length
                  ? `${(page - 1) * 8 + 1}–${Math.min(page * 8, filtered.length)}`
                  : 0}{" "}
                / {filtered.length} chứng từ
              </span>
              <div>
                <button
                  className="icon-button"
                  disabled={page <= 1}
                  aria-label="Trang trước"
                  onClick={() => update({ page: String(page - 1) })}
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  Trang {page} / {pageCount}
                </span>
                <button
                  className="icon-button"
                  disabled={page >= pageCount}
                  aria-label="Trang sau"
                  onClick={() => update({ page: String(page + 1) })}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
function Empty({
  onCreate,
  onReset,
}: {
  onCreate: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="empty-state">
      <FileText size={34} />
      <h3>Chưa có chứng từ phù hợp</h3>
      <p>Thử thay đổi điều kiện lọc hoặc tạo chứng từ đầu tiên.</p>
      <div>
        {onReset && (
          <button className="button" onClick={onReset}>
            Xóa bộ lọc
          </button>
        )}
        <button className="button primary" onClick={onCreate}>
          <Plus size={16} />
          Tạo chứng từ
        </button>
      </div>
    </div>
  );
}
export function Reports({
  items,
  notify,
}: {
  items: Transaction[];
  notify: (text: string) => void;
}) {
  return (
    <section className="card report-card">
      <div className="card-heading">
        <div>
          <h2>Tổng hợp chứng từ trong kỳ</h2>
          <p>Giá trị chứng từ mẫu theo loại và trạng thái</p>
        </div>
        <button
          className="button"
          onClick={() => {
            downloadCsv(items);
            notify(`Đã xuất ${items.length} chứng từ mẫu sang CSV.`);
          }}
        >
          <Download size={16} />
          Xuất dữ liệu CSV
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Loại chứng từ</th>
              <th>Trạng thái</th>
              <th className="numeric">Số lượng</th>
              <th className="numeric">Tổng giá trị</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(kinds).flatMap(([kind, label]) =>
              Object.keys(statuses).map((status) => {
                const group = items.filter(
                  (t) => t.kind === kind && t.status === status,
                );
                return group.length ? (
                  <tr key={`${kind}-${status}`}>
                    <td>{label}</td>
                    <td>
                      <StatusBadge status={status as Transaction["status"]} />
                    </td>
                    <td className="numeric">{group.length}</td>
                    <td className="numeric amount">{money(sum(group))}</td>
                  </tr>
                ) : null;
              }),
            )}
          </tbody>
        </table>
      </div>
      {!items.length && (
        <p className="compact-empty">Chưa có chứng từ trong kỳ đã chọn.</p>
      )}
      <p className="report-note">
        Báo cáo tổng hợp dữ liệu mẫu; chưa phải báo cáo tài chính hoặc tờ khai
        thuế.
      </p>
    </section>
  );
}
