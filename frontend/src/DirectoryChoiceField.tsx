import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ExternalLink, Plus, Search, X } from "lucide-react";

export default function DirectoryChoiceField({
  value,
  onChange,
  label,
  options = [],
  onManage,
  onQuickAdd,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options?: string[];
  onManage?: () => void;
  onQuickAdd?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const matches = options.filter((option) =>
    option.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
  );

  const activeRing = open || focused;

  return (
    <div
      ref={root}
      className="md-choice-field"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
      style={{
        position: "relative",
        width: "100%",
        height: 34,
        minHeight: 34,
        maxHeight: 34,
        display: "flex",
        alignItems: "center",
        zIndex: open ? 2200 : undefined,
      }}
    >
      <input
        aria-label={label}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        style={{
          padding: onQuickAdd ? "0 60px 0 10px" : "0 34px 0 10px",
          width: "100%",
          height: 34,
          minHeight: 34,
          maxHeight: 34,
          borderRadius: 6,
          border: `1px solid ${activeRing ? "var(--brand, #1d4ed8)" : "#cbd5e1"}`,
          background: "#ffffff",
          color: "#0f172a",
          fontSize: 13,
          boxShadow: activeRing
            ? "0 0 0 3px rgba(29, 78, 216, 0.12)"
            : "0 1px 2px rgba(15, 23, 42, 0.03)",
          outline: "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          boxSizing: "border-box",
        }}
      />
      {onQuickAdd && (
        <button
          type="button"
          className="md-choice-quick-add"
          aria-label={`Thêm nhanh ${label}`}
          title={`Thêm nhanh ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
            onQuickAdd();
          }}
          style={{
            position: "absolute",
            right: 30,
            top: "50%",
            transform: "translateY(-50%)",
            width: 24,
            height: 24,
            minWidth: 24,
            minHeight: 24,
            padding: 0,
            margin: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: 5,
            background: "transparent",
            cursor: "pointer",
            color: "var(--brand, #1d4ed8)",
          }}
        >
          <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className="md-choice-trigger"
        aria-label={`Chọn ${label}`}
        aria-expanded={open}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        onClick={() => {
          setQuery("");
          setOpen((prev) => !prev);
        }}
        style={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          width: 26,
          height: 26,
          minWidth: 26,
          minHeight: 26,
          padding: 0,
          margin: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 5,
          background: open ? "#eff6ff" : btnHovered ? "#f1f5f9" : "transparent",
          cursor: "pointer",
          color: open ? "var(--brand, #1d4ed8)" : btnHovered ? "#1e293b" : "#64748b",
          transition: "background-color 0.15s ease, color 0.15s ease",
          boxSizing: "border-box",
        }}
      >
        <ChevronDown
          size={15}
          strokeWidth={2.2}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`Danh sách ${label}`}
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            left: 0,
            width: "100%",
            minWidth: 280,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow:
              "0 14px 32px -6px rgba(15, 23, 42, 0.16), 0 6px 14px -4px rgba(15, 23, 42, 0.08)",
            padding: 6,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              marginBottom: 5,
            }}
          >
            <Search
              size={13.5}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 10,
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
            <input
              ref={searchRef}
              aria-label={`Tìm ${label}`}
              value={query}
              placeholder="Tìm kiếm..."
              onChange={(event) => setQuery(event.target.value)}
              style={{
                width: "100%",
                height: 32,
                minHeight: 32,
                maxHeight: 32,
                padding: "0 28px 0 30px",
                borderRadius: 7,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#0f172a",
                fontSize: 12.5,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {query && (
              <button
                type="button"
                className="md-choice-clear"
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 20,
                  height: 20,
                  padding: 0,
                  border: "none",
                  borderRadius: 4,
                  background: "transparent",
                  color: "#94a3b8",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={12.5} aria-hidden="true" />
              </button>
            )}
          </div>
          {label === "Đơn vị" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "92px 1fr",
                padding: "6px 10px",
                marginBottom: 3,
                borderRadius: 6,
                background: "#f8fafc",
                color: "#64748b",
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              <span>Mã đơn vị</span>
              <span>Tên đơn vị</span>
            </div>
          )}
          <div
            style={{
              maxHeight: 210,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {matches.map((option) => {
              const isSelected = value === option;
              return (
                <button
                  type="button"
                  className="md-choice-option"
                  key={option}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    width: "100%",
                    minHeight: 33,
                    border: "none",
                    borderRadius: 7,
                    textAlign: "left",
                    padding: "6px 10px",
                    background: isSelected ? "#eff6ff" : "transparent",
                    color: isSelected ? "var(--brand, #1d4ed8)" : "#1e293b",
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "#f1f5f9";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  {label === "Đơn vị" ? (
                    <span style={{ marginLeft: 92, flex: 1, minWidth: 0 }}>{option}</span>
                  ) : (
                    <span style={{ flex: 1, minWidth: 0 }}>{option}</span>
                  )}
                  {isSelected && (
                    <Check
                      size={14}
                      aria-hidden="true"
                      style={{ color: "var(--brand, #1d4ed8)", flexShrink: 0 }}
                    />
                  )}
                </button>
              );
            })}
            {!matches.length && (
              <p
                style={{
                  padding: "12px 10px",
                  margin: 0,
                  textAlign: "center",
                  fontSize: 12.5,
                  color: "#94a3b8",
                }}
              >
                Không có dữ liệu phù hợp
              </p>
            )}
          </div>
          {onManage && (
            <button
              type="button"
              className="md-choice-manage"
              style={{
                width: "100%",
                marginTop: 4,
                border: "none",
                borderTop: "1px solid #f1f5f9",
                borderRadius: 0,
                background: "transparent",
                padding: "8px 10px 4px",
                color: "var(--brand, #1d4ed8)",
                fontSize: 12.5,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
              onClick={() => {
                setOpen(false);
                onManage();
              }}
            >
              <ExternalLink size={13} aria-hidden="true" />
              <span>
                {label === "Đơn vị"
                  ? "Cập nhật cơ cấu tổ chức"
                  : `Quản lý danh mục ${label.toLocaleLowerCase("vi")}`}
              </span>
            </button>
          )}
          <div
            style={{
              padding: "6px 10px 3px",
              marginTop: onManage ? 2 : 4,
              borderTop: onManage ? "none" : "1px solid #f1f5f9",
              fontSize: 11.5,
              color: "#64748b",
            }}
          >
            Bạn có thể nhập giá trị không có trong danh sách.
          </div>
        </div>
      )}
    </div>
  );
}
