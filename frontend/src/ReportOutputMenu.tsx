import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Options observed on the shared MISA report toolbar; selection is frontend only.
export default function ReportOutputMenu({
  kind,
  onPrimary,
  primaryIcon,
}: {
  kind: "print" | "export";
  onPrimary: () => void;
  primaryIcon: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const print = kind === "print";
  const options = print
    ? ["In qua trình duyệt web", "In qua trình in của Sổ Việt ERP"]
    : [
        "Xuất Excel (dạng dữ liệu)",
        "Xuất Excel (dạng mẫu in)",
        "Xuất bằng trình in Sổ Việt ERP",
      ];
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 2,
        color: "#64748b",
        padding: "2px 4px",
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={print ? "In báo cáo" : "Xuất báo cáo"}
        onClick={onPrimary}
        style={{
          border: 0,
          background: "none",
          color: "inherit",
          padding: 0,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        {primaryIcon}
      </button>
      <button
        type="button"
        aria-label={print ? "Chọn cách in báo cáo" : "Chọn cách xuất báo cáo"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        style={{
          border: 0,
          background: "none",
          color: "inherit",
          padding: 2,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={print ? "Tùy chọn in báo cáo" : "Tùy chọn xuất báo cáo"}
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            zIndex: 20,
            background: "white",
            border: "1px solid #cdd3da",
            boxShadow: "0 4px 10px #0002",
            minWidth: 280,
            padding: 4,
          }}
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitem"
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                padding: "8px 12px",
                border: 0,
                background: "white",
                color: "#222",
                textAlign: "left",
                font: "inherit",
                cursor: "pointer",
              }}
              onClick={() => setOpen(false)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
