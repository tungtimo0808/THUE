import { useEffect, useRef, useState } from "react";

export default function DirectoryChoiceField({
  value,
  onChange,
  label,
  options = [],
  onManage,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options?: string[];
  onManage?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={root}
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
        zIndex: open ? 2000 : undefined,
      }}
    >
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          paddingRight: 28,
          width: "100%",
          height: 34,
          minHeight: 34,
          maxHeight: 34,
          boxSizing: "border-box",
        }}
      />
      <button
        type="button"
        aria-label={`Chọn ${label}`}
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          setOpen(!open);
        }}
        style={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          width: 24,
          height: 24,
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: 0,
          background: "transparent",
          cursor: "pointer",
          color: "#475569",
        }}
      >
        ⌄
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`Danh sách ${label}`}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            width: "100%",
            minWidth: 280,
            maxHeight: 280,
            overflow: "auto",
            background: "white",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.14)",
          }}
        >
          <input
            aria-label={`Tìm ${label}`}
            value={query}
            placeholder="Tìm kiếm"
            onChange={(event) => setQuery(event.target.value)}
            style={{
              margin: 8,
              width: "calc(100% - 16px)",
              height: 32,
              minHeight: 32,
              maxHeight: 32,
              padding: "0 10px",
              boxSizing: "border-box",
            }}
          />
          {label === "Đơn vị" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr",
                padding: "8px 12px",
                background: "#f1f5f9",
                fontWeight: 600,
              }}
            >
              <span>Mã đơn vị</span>
              <span>Tên đơn vị</span>
            </div>
          )}
          {matches.map((option) => (
            <button
              type="button"
              key={option}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                height: 34,
                border: 0,
                textAlign: "left",
                padding: "0 12px",
                background: value === option ? "#059669" : "white",
                color: value === option ? "white" : "#374151",
              }}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {label === "Đơn vị" ? <span style={{ marginLeft: 100 }}>{option}</span> : option}
            </button>
          ))}
          {!matches.length && <p style={{ padding: 12 }}>Không có dữ liệu phù hợp</p>}
          {label === "Đơn vị" && (
            <button
              type="button"
              style={{
                border: 0,
                background: "transparent",
                padding: "8px 12px",
                color: "#059669",
                cursor: "pointer",
              }}
              onClick={onManage}
            >
              Cập nhật cơ cấu tổ chức
            </button>
          )}
          <div style={{ padding: "8px 12px", borderTop: "1px solid #e5e7eb", fontSize: 12, color: "#64748b" }}>
            Bạn có thể nhập giá trị không có trong danh sách.
          </div>
        </div>
      )}
    </div>
  );
}
