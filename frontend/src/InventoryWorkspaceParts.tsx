import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Columns3,
  Download,
  Filter,
  PackageOpen,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  productionOrderStatuses,
  type ProductionOrder,
  type ProductionOrderStatus,
} from "./inventory-data";

function displayDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN").format(new Date(`${value}T00:00:00`));
}

function OrderStatus({ status }: { status: ProductionOrderStatus }) {
  return (
    <span className={`production-status ${status}`}>
      <span aria-hidden="true" />
      {productionOrderStatuses[status]}
    </span>
  );
}

export function ProductionOrderToolbar({
  selectedCount,
  query,
  status,
  filterOpen,
  onQuery,
  onReload,
  onInfo,
  onToggleFilter,
  onClearSelection,
}: {
  selectedCount: number;
  query: string;
  status: string;
  filterOpen: boolean;
  onQuery: (value: string) => void;
  onReload: () => void;
  onInfo: (text: string) => void;
  onToggleFilter: () => void;
  onClearSelection: () => void;
}) {
  if (selectedCount) {
    return (
      <div
        className="production-bulk"
        role="toolbar"
        aria-label="Thao tác hàng loạt"
      >
        <strong>Đã chọn {selectedCount}</strong>
        <button onClick={() => onInfo("Ghi sổ lệnh sản xuất")}>Ghi sổ</button>
        <button onClick={() => onInfo("Bỏ ghi lệnh sản xuất")}>Bỏ ghi</button>
        <button onClick={() => onInfo("Xóa lệnh sản xuất")}>
          <Trash2 size={14} /> Xóa
        </button>
        <button onClick={() => onInfo("Thực hiện hàng loạt")}>
          Thực hiện hàng loạt
        </button>
        <button className="ref-link" onClick={onClearSelection}>
          Bỏ chọn
        </button>
      </div>
    );
  }

  return (
    <div className="production-toolbar">
      <label className="production-search">
        <Search size={15} />
        <span className="sr-only">Tìm lệnh sản xuất</span>
        <input
          aria-label="Tìm lệnh sản xuất"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Tìm theo số lệnh, thành phẩm, phân xưởng…"
        />
      </label>
      <label className="production-period">
        <span>Thời gian</span>
        <select aria-label="Khoảng thời gian" defaultValue="month">
          <option value="month">Tháng này</option>
          <option value="quarter">Quý này</option>
          <option value="year">Năm nay</option>
        </select>
      </label>
      <div className="production-tools">
        <button
          className="ref-icon"
          aria-label="Nạp lại dữ liệu"
          onClick={onReload}
        >
          <RefreshCw size={16} />
        </button>
        <button
          className="ref-icon"
          aria-label="Xuất dữ liệu"
          onClick={() => onInfo("Xuất dữ liệu lệnh sản xuất")}
        >
          <Download size={16} />
        </button>
        <button
          className={`ref-button compact ${status ? "active-filter" : ""}`}
          aria-expanded={filterOpen}
          onClick={onToggleFilter}
        >
          <Filter size={15} /> Bộ lọc
        </button>
        <button
          className="ref-icon"
          aria-label="Tùy chỉnh cột"
          onClick={() => onInfo("Tùy chỉnh cột lệnh sản xuất")}
        >
          <Columns3 size={16} />
        </button>
      </div>
    </div>
  );
}

export function ProductionOrderFilter({
  value,
  onChange,
  onReset,
  onApply,
}: {
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
  onApply: () => void;
}) {
  return (
    <form
      className="production-filter"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <label>
        Trạng thái lệnh
        <select
          aria-label="Trạng thái lệnh"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(productionOrderStatuses).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button className="ref-link" type="button" onClick={onReset}>
        Đặt lại
      </button>
      <button className="ref-button primary-action" type="submit">
        Áp dụng bộ lọc
      </button>
    </form>
  );
}

export function ProductionOrderTable({
  orders,
  total,
  selected,
  detailId,
  currentPage,
  pageCount,
  onToggle,
  onToggleAll,
  onDetail,
  onPage,
  onReset,
}: {
  orders: ProductionOrder[];
  total: number;
  selected: string[];
  detailId: string | null;
  currentPage: number;
  pageCount: number;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onDetail: (id: string) => void;
  onPage: (page: number) => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="ref-data-scroll production-table-wrap">
        <table>
          <caption className="sr-only">
            Danh sách lệnh sản xuất trong kỳ kế toán đang chọn
          </caption>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả lệnh sản xuất trên trang"
                  checked={
                    orders.length > 0 &&
                    orders.every((order) => selected.includes(order.id))
                  }
                  onChange={(event) => onToggleAll(event.target.checked)}
                />
              </th>
              <th>Ngày lệnh</th>
              <th>Số lệnh sản xuất</th>
              <th>Thành phẩm</th>
              <th className="numeric">Số lượng</th>
              <th>ĐVT</th>
              <th>Ngày hoàn thành</th>
              <th>Trạng thái</th>
              <th>Chức năng</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className={detailId === order.id ? "row-selected" : ""}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${order.code}`}
                    checked={selected.includes(order.id)}
                    onChange={() => onToggle(order.id)}
                  />
                </td>
                <td>{displayDate(order.date)}</td>
                <td>
                  <button
                    className="document-link"
                    onClick={() => onDetail(order.id)}
                  >
                    {order.code}
                  </button>
                </td>
                <td>
                  <strong>{order.productCode}</strong>
                  <small>{order.productName}</small>
                </td>
                <td className="numeric">
                  {order.quantity.toLocaleString("vi-VN")}
                </td>
                <td>{order.unit}</td>
                <td>{displayDate(order.completionDate)}</td>
                <td>
                  <OrderStatus status={order.status} />
                </td>
                <td>
                  <button
                    className="ref-link"
                    aria-label={`Xem nhanh ${order.code}`}
                    onClick={() => onDetail(order.id)}
                  >
                    Xem
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!orders.length && (
        <div className="production-empty" role="status">
          <PackageOpen size={38} />
          <h3>Không tìm thấy lệnh sản xuất</h3>
          <p>Không có dữ liệu phù hợp với từ khóa hoặc điều kiện lọc.</p>
          <button className="ref-button" onClick={onReset}>
            Xóa bộ lọc
          </button>
        </div>
      )}

      <footer className="ref-pagination production-pagination">
        <span>Tổng số: {total} lệnh sản xuất</span>
        <label>
          Số dòng/trang
          <select aria-label="Số dòng trên trang" defaultValue="5">
            <option value="5">5</option>
          </select>
        </label>
        <button
          className="ref-icon"
          aria-label="Trang trước"
          disabled={currentPage <= 1}
          onClick={() => onPage(currentPage - 1)}
        >
          <ChevronLeft size={14} />
        </button>
        <span>
          {currentPage} / {pageCount}
        </span>
        <button
          className="ref-icon"
          aria-label="Trang sau"
          disabled={currentPage >= pageCount}
          onClick={() => onPage(currentPage + 1)}
        >
          <ChevronRight size={14} />
        </button>
      </footer>
    </>
  );
}

export function ProductionQuickDetail({
  order,
  open,
  onToggle,
}: {
  order?: ProductionOrder;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section
      className={`production-detail ${open ? "open" : ""}`}
      aria-label="Chi tiết nhanh"
    >
      <button
        className="production-detail-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>Chi tiết nhanh</span>
        {order && (
          <strong>
            {order.code} · {order.productName}
          </strong>
        )}
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="production-detail-body">
          {order ? (
            <>
              <div
                className="production-detail-tabs"
                role="tablist"
                aria-label="Nhóm chi tiết"
              >
                <button role="tab" aria-selected="true">
                  Hàng hóa
                </button>
                <button role="tab" aria-selected="false">
                  Hạch toán
                </button>
                <button role="tab" aria-selected="false">
                  Tham chiếu
                </button>
                <button role="tab" aria-selected="false">
                  Thông tin liên quan
                </button>
              </div>
              <div className="production-detail-summary">
                <span>
                  Thành phẩm{" "}
                  <strong>
                    {order.productCode} — {order.productName}
                  </strong>
                </span>
                <span>
                  Phân xưởng <strong>{order.workshop}</strong>
                </span>
                <span>
                  Sản lượng{" "}
                  <strong>
                    {order.quantity} {order.unit}
                  </strong>
                </span>
              </div>
              <div className="ref-data-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Mã nguyên vật liệu</th>
                      <th>Tên nguyên vật liệu</th>
                      <th className="numeric">Số lượng</th>
                      <th>ĐVT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.materials.map((material) => (
                      <tr key={material.code}>
                        <td>{material.code}</td>
                        <td>{material.name}</td>
                        <td className="numeric">{material.quantity}</td>
                        <td>{material.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="production-detail-placeholder">
              Chọn một lệnh sản xuất để xem hàng hóa, hạch toán và tham chiếu
              liên quan.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
