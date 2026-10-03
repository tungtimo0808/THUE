import React from "react";
import {
  X,
  HelpCircle,
  Package,
  Briefcase,
  Layers,
  Box,
  Wrench,
  ShoppingBag,
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
    icon: <Box size={22} color="#ffffff" />,
  },
  {
    id: "tools",
    name: "Công cụ dụng cụ",
    description: "Công cụ dụng cụ mua về nhập kho chưa đưa vào sử dụng",
    icon: <Wrench size={22} color="#ffffff" />,
  },
  {
    id: "combo",
    name: "Combo sản phẩm",
    description: "Các sản phẩm, hàng hóa được bán theo combo",
    icon: <ShoppingBag size={22} color="#ffffff" />,
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
        {/* Header */}
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
              onClick={() => notify("Hướng dẫn thiết lập tính chất hàng hóa, dịch vụ chuẩn MISA")}
              title="Hướng dẫn sử dụng"
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "grid",
                placeItems: "center",
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
            gap: 16,
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
                padding: "14px 16px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#00a862";
                e.currentTarget.style.background = "#f0fdf4";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 168, 98, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
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
                  boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                }}
              >
                {nature.icon}
              </div>

              <div style={{ flex: 1 }}>
                <h4
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: 14.5,
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
