import { useState } from "react";
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
  visibleTabIds = [],
  onSave,
  onClose,
  onResetDefault,
}: {
  moduleName: string;
  tabs: [string, string][];
  visibleTabIds?: string[];
  onSave?: (newVisibleTabIds: string[]) => void;
  onClose: () => void;
  onResetDefault?: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(visibleTabIds.length > 0 ? visibleTabIds : tabs.map(([id]) => id)));
  const [orderedTabs, setOrderedTabs] = useState<[string, string][]>(() => {
    if (!visibleTabIds || visibleTabIds.length === 0) return [...tabs];
    const visibleSet = new Set(visibleTabIds);
    const visibleList: [string, string][] = [];
    visibleTabIds.forEach((id) => {
      const found = tabs.find(([tId]) => tId === id);
      if (found) visibleList.push(found);
    });
    const hiddenList = tabs.filter(([id]) => !visibleSet.has(id));
    return [...visibleList, ...hiddenList];
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size <= 1) return; // Keep at least 1 tab visible
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const move = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedTabs.length) return;
    const next = [...orderedTabs];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setOrderedTabs(next);
  };

  const selectAll = () => {
    setSelected(new Set(tabs.map(([id]) => id)));
  };

  const handleSave = () => {
    if (onSave) {
      const result = orderedTabs
        .map(([id]) => id)
        .filter((id) => selected.has(id));
      onSave(result);
    }
    onClose();
  };

  return (
    <Modal title={`Thiết lập tab — ${moduleName}`} onClose={onClose}>
      <div className="erp3-tab-settings">
        <p>
          Chọn các tab cần hiển thị trực tiếp trên thanh tác vụ (1 dòng duy nhất) và sắp xếp theo nhu cầu công việc của bạn. Các tab không được chọn sẽ nằm trong mục <strong>"Khác ▾"</strong> hoặc nút <strong>Tùy chọn</strong>.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="erp3-drag-hint" style={{ margin: 0, padding: "6px 12px" }}>
            Dùng nút mũi tên ↑ ↓ để sắp xếp thứ tự
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={selectAll}
              style={{
                background: "transparent",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
                cursor: "pointer",
                color: "#0284c7",
              }}
            >
              Chọn tất cả
            </button>
            {onResetDefault && (
              <button
                type="button"
                onClick={() => {
                  onResetDefault();
                  onClose();
                }}
                style={{
                  background: "transparent",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "4px 8px",
                  fontSize: 12,
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                Đặt lại mặc định
              </button>
            )}
          </div>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 8px" }}>
          {orderedTabs.map(([id, label], index) => {
            const isChecked = selected.has(id);
            return (
              <div className="erp3-tab-setting" key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px" }}>
                <span aria-hidden="true" style={{ color: "#94a3b8", cursor: "grab" }}>⋮⋮</span>
                <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: isChecked ? "#0f172a" : "#64748b", fontWeight: isChecked ? 600 : 400 }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(id)}
                    aria-label={`Hiển thị ${label}`}
                  />{" "}
                  {label}
                  {isChecked && <span style={{ fontSize: 10, color: "#0284c7", background: "#f0f9ff", padding: "1px 6px", borderRadius: 4, marginLeft: 4 }}>Hiển thị trên thanh</span>}
                </label>
                <button
                  type="button"
                  aria-label={`Chuyển ${label} lên`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  style={{ opacity: index === 0 ? 0.3 : 1 }}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Chuyển ${label} xuống`}
                  disabled={index === orderedTabs.length - 1}
                  onClick={() => move(index, 1)}
                  style={{ opacity: index === orderedTabs.length - 1 ? 0.3 : 1 }}
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            );
          })}
        </div>
        <footer>
          <button type="button" onClick={onClose}>Đóng</button>
          <button type="button" className="erp3-primary" onClick={handleSave}>
            Lưu thiết lập
          </button>
        </footer>
      </div>
    </Modal>
  );
}
