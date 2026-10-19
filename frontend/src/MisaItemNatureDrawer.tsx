import React from "react";
import {
  X,
  HelpCircle,
  Package,
  Briefcase,
  Layers,
  Boxes,
  Tag,
} from "lucide-react";

export interface ItemNatureOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface MisaItemNatureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNature: (natureId: string, natureName: string) => void;
  notify?: (msg: string) => void;
}

export const ITEM_NATURES: ItemNatureOption[] = [
  {
    id: "goods",
    name: "Hàng hóa",
    description: "Sản phẩm bạn mua và bán lại cho khách hàng",
    icon: <Package size={22} color="#ffffff" />,
  },
  {
    id: "service",
    name: "Dịch vụ",
    description: "Dịch vụ mà bạn cung cấp cho khách hàng",
    icon: <Briefcase size={22} color="#ffffff" />,
  },
  {
    id: "raw_materials",
    name: "Nguyên vật liệu",
    description: "Nguyên liệu đầu vào dùng cho hoạt động sản xuất, xây dựng, cung cấp dịch vụ",
    icon: <Layers size={22} color="#ffffff" />,
  },
  {
    id: "finished_goods",
    name: "Thành phẩm",
    description: "Là sản phẩm đầu ra của quá trình sản xuất",
    icon: <Boxes size={22} color="#ffffff" />,
  },
  {
    id: "tools",
    name: "Công cụ dụng cụ",
    description: "Công cụ dụng cụ mua về nhập kho chưa đưa vào sử dụng",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        <line x1="4" y1="20" x2="11" y2="13" />
      </svg>
    ),
  },
  {
    id: "combo",
    name: "Combo sản phẩm",
    description: "Các sản phẩm, hàng hóa được bán theo combo",
    icon: <Tag size={22} color="#ffffff" />,
  },
];

export const MisaItemNatureDrawer: React.FC<MisaItemNatureDrawerProps> = ({
  isOpen,
  onClose,
  onSelectNature,
  notify = () => {},
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="misa-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        zIndex: 99999,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        className="misa-nature-drawer-window"
        style={{
          width: 530,
          maxWidth: "92vw",
          height: "100%",
          background: "#ffffff",
          boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.25s ease-out",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Screenshot 2 */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              color: "#1e293b",
            }}
          >
            Chọn tính chất hàng hóa dịch vụ
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => notify("Hướng dẫn thiết lập tính chất hàng hóa, dịch vụ chuẩn Sổ Việt ERP")}
              title="Hướng dẫn sử dụng"
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "grid",
                placeItems: "center",
                borderRadius: 4,
              }}
            >
              <HelpCircle size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Đóng (Esc)"
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "grid",
                placeItems: "center",
                borderRadius: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content list of 6 nature cards */}
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            flex: 1,
          }}
        >
          {ITEM_NATURES.map((nature) => (
            <div
              key={nature.id}
              onClick={() => onSelectNature(nature.id, nature.name)}
              className="misa-nature-card"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid transparent",
                background: "#ffffff",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#86efac";
                e.currentTarget.style.background = "#f0fdf4";
                e.currentTarget.style.boxShadow = "0 3px 10px rgba(0, 168, 98, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#00a862",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(0, 168, 98, 0.22)",
                }}
              >
                {nature.icon}
              </div>

              <div style={{ flex: 1 }}>
                <h4
                  style={{
                    margin: "0 0 3px 0",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  {nature.name}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12.5,
                    color: "#64748b",
                    lineHeight: 1.45,
                  }}
                >
                  {nature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MisaItemNatureDrawer;
