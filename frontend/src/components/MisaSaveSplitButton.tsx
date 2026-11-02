import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FilePlus2, LogOut, Printer } from "lucide-react";

export interface MisaSaveSplitButtonProps {
  defaultMode?: "save_and_add" | "save_and_close";
  onSaveAndClose: () => void;
  onSaveAndAdd: () => void;
  onSaveAndPrint?: () => void;
  showPrint?: boolean;
  disabled?: boolean;
  height?: number;
  className?: string;
}

export const MisaSaveSplitButton: React.FC<MisaSaveSplitButtonProps> = ({
  defaultMode = "save_and_add",
  onSaveAndClose,
  onSaveAndAdd,
  onSaveAndPrint,
  showPrint = true,
  disabled = false,
  height = 32,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"save_and_add" | "save_and_close">(defaultMode);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const primaryLabel = mode === "save_and_close" ? "Lưu và Đóng" : "Lưu và Thêm";

  const handlePrimaryClick = () => {
    if (disabled) return;
    setOpen(false);
    if (mode === "save_and_close") {
      onSaveAndClose();
    } else {
      onSaveAndAdd();
    }
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "stretch",
        borderRadius: 4,
        boxShadow: "0 1px 2px rgba(0, 168, 98, 0.2)",
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={handlePrimaryClick}
        style={{
          height,
          padding: "0 14px",
          background: disabled ? "#86efac" : "#00a862",
          color: "#ffffff",
          border: "none",
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          whiteSpace: "nowrap",
        }}
      >
        <span>{primaryLabel}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        aria-label="Tùy chọn Lưu"
        title="Chọn chế độ Lưu: Lưu và Đóng, Lưu và Thêm, Lưu và In"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((prev) => !prev);
        }}
        style={{
          height,
          width: 28,
          padding: 0,
          background: disabled ? "#86efac" : open ? "#008f53" : "#009858",
          color: "#ffffff",
          border: "none",
          borderLeft: "1px solid rgba(255, 255, 255, 0.28)",
          borderTopRightRadius: 4,
          borderBottomRightRadius: 4,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronDown size={14} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            right: 0,
            minWidth: 176,
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.18), 0 4px 10px -2px rgba(15, 23, 42, 0.08)",
            padding: "4px",
            zIndex: 10050,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setMode("save_and_close");
              setOpen(false);
              onSaveAndClose();
            }}
            style={{
              width: "100%",
              padding: "7px 10px",
              border: "none",
              borderRadius: 4,
              background: mode === "save_and_close" ? "#f0fdf4" : "transparent",
              color: mode === "save_and_close" ? "#15803d" : "#1e293b",
              fontSize: 12.5,
              fontWeight: mode === "save_and_close" ? 600 : 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              if (mode !== "save_and_close") e.currentTarget.style.background = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              if (mode !== "save_and_close") e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <LogOut size={13.5} style={{ color: "#00a862" }} />
              <span>Lưu và Đóng</span>
            </span>
            {mode === "save_and_close" && <Check size={13} style={{ color: "#00a862" }} />}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setMode("save_and_add");
              setOpen(false);
              onSaveAndAdd();
            }}
            style={{
              width: "100%",
              padding: "7px 10px",
              border: "none",
              borderRadius: 4,
              background: mode === "save_and_add" ? "#f0fdf4" : "transparent",
              color: mode === "save_and_add" ? "#15803d" : "#1e293b",
              fontSize: 12.5,
              fontWeight: mode === "save_and_add" ? 600 : 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              if (mode !== "save_and_add") e.currentTarget.style.background = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              if (mode !== "save_and_add") e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <FilePlus2 size={13.5} style={{ color: "#00a862" }} />
              <span>Lưu và Thêm</span>
            </span>
            {mode === "save_and_add" && <Check size={13} style={{ color: "#00a862" }} />}
          </button>

          {(showPrint || Boolean(onSaveAndPrint)) && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                if (onSaveAndPrint) {
                  onSaveAndPrint();
                } else {
                  onSaveAndClose();
                  setTimeout(() => window.print(), 450);
                }
              }}
              style={{
                width: "100%",
                padding: "7px 10px",
                border: "none",
                borderTop: "1px solid #f1f5f9",
                borderRadius: 4,
                background: "transparent",
                color: "#1e293b",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Printer size={13.5} style={{ color: "#64748b" }} />
              <span>Lưu và In</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MisaSaveSplitButton;
