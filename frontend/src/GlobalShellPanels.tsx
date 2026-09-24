import {
  ArrowDown,
  ArrowUp,
  Box,
  FileText,
  Landmark,
  Search,
  Users,
} from "lucide-react";
import { Modal } from "./components";

export function SmartSearchResults({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (label: string) => void;
}) {
  if (!query.trim()) return null;
  return (
    <section
      className="erp3-smart-results"
      role="region"
      aria-label="Kết quả tìm kiếm thông minh"
    >
      <header>
        <Search size={14} />
        <span>Kết quả cho “{query}”</span>
        <kbd>Enter</kbd>
      </header>
      <div className="erp3-search-groups">
        <section>
          <h3>Chứng từ</h3>
          <button onClick={() => onSelect("Phiếu chi PC-2609-014")}>
            <FileText size={15} />
            <span>
              <strong>Phiếu chi PC-2609-014</strong>
              <small>Công ty TNHH Gỗ Việt · 42.500.000 đ</small>
            </span>
          </button>
          <button onClick={() => onSelect("Đơn mua hàng PO-2609-001")}>
            <FileText size={15} />
            <span>
              <strong>Đơn mua hàng PO-2609-001</strong>
              <small>Đang thực hiện · 232.100.000 đ</small>
            </span>
          </button>
        </section>
        <section>
          <h3>Hàng hóa, dịch vụ</h3>
          <button onClick={() => onSelect("Gỗ sồi xẻ quy cách")}>
            <Box size={15} />
            <span>
              <strong>NVL-GO-01 · Gỗ sồi xẻ quy cách</strong>
              <small>Tồn 18,5 m³ · Kho Hà Nội</small>
            </span>
          </button>
        </section>
        <section>
          <h3>Danh mục</h3>
          <button onClick={() => onSelect("Công ty TNHH Gỗ Việt")}>
            <Users size={15} />
            <span>
              <strong>Công ty TNHH Gỗ Việt</strong>
              <small>Nhà cung cấp · MST 0108897261</small>
            </span>
          </button>
        </section>
      </div>
      <footer>
        <span>Dùng ↑ ↓ để di chuyển</span>
        <button onClick={() => onSelect("Tìm kiếm nâng cao")}>
          Xem tất cả kết quả
        </button>
      </footer>
    </section>
  );
}

export function WorkModeModal({
  current,
  onChange,
  onClose,
}: {
  current: string;
  onChange: (mode: string) => void;
  onClose: () => void;
}) {
  const modes = [
    {
      name: "Kế toán",
      desc: "Toàn bộ nghiệp vụ, sổ sách và báo cáo",
      icon: FileText,
    },
    {
      name: "Thủ kho",
      desc: "Nhập, xuất, kiểm kê và lệnh sản xuất",
      icon: Box,
    },
    { name: "Thủ quỹ", desc: "Thu, chi, kiểm kê và sổ quỹ", icon: Landmark },
  ];
  return (
    <Modal title="Chọn chế độ làm việc" onClose={onClose}>
      <div className="erp3-mode-list">
        {modes.map((mode) => (
          <button
            className={current === mode.name ? "active" : ""}
            key={mode.name}
            onClick={() => {
              onChange(mode.name);
              onClose();
            }}
          >
            <mode.icon size={20} />
            <span>
              <strong>{mode.name}</strong>
              <small>{mode.desc}</small>
            </span>
            {current === mode.name && <b>✓</b>}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function TabSettingsModal({
  moduleName,
  tabs,
  onClose,
}: {
  moduleName: string;
  tabs: [string, string][];
  onClose: () => void;
}) {
  return (
    <Modal title={`Thiết lập tab ${moduleName}`} onClose={onClose}>
      <div className="erp3-tab-settings">
        <p>
          Chọn các tab cần hiển thị và sắp xếp theo quy trình làm việc của bạn.
        </p>
        <div className="erp3-drag-hint">Kéo thả hoặc dùng nút mũi tên</div>
        {tabs.map(([id, label], index) => (
          <div className="erp3-tab-setting" key={id}>
            <span aria-hidden="true">⋮⋮</span>
            <label>
              <input
                type="checkbox"
                aria-label={`Hiển thị ${label}`}
                defaultChecked
              />{" "}
              Hiển thị {label}
            </label>
            <button aria-label={`Chuyển ${label} lên`} disabled={index === 0}>
              <ArrowUp size={14} />
            </button>
            <button
              aria-label={`Chuyển ${label} xuống`}
              disabled={index === tabs.length - 1}
            >
              <ArrowDown size={14} />
            </button>
          </div>
        ))}
        <footer>
          <button onClick={onClose}>Đóng</button>
          <button className="erp3-primary" onClick={onClose}>
            Lưu thiết lập
          </button>
        </footer>
      </div>
    </Modal>
  );
}
