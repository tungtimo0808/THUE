import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";

/* Bộ điều khiển form dùng chung cho các bảng "Chọn tham số" để đồng bộ giao diện toàn web. */

export const MISA_GREEN = "var(--brand)";
const BORDER = "#cbd5e1";
const CONTROL_HEIGHT = 34;

export const misaLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
  color: "#1e293b",
};

type ButtonVariant = "primary" | "secondary" | "ghost";

export function misaButtonStyle(variant: ButtonVariant = "secondary", extra?: React.CSSProperties): React.CSSProperties {
  const base: React.CSSProperties = {
    height: CONTROL_HEIGHT,
    padding: "0 14px",
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "background 0.15s, border-color 0.15s, color 0.15s",
  };
  if (variant === "primary") return { ...base, background: MISA_GREEN, border: `1px solid ${MISA_GREEN}`, color: "#fff", ...extra };
  if (variant === "ghost") return { ...base, background: "transparent", border: "1px solid transparent", color: "#475569", padding: "0 8px", ...extra };
  return { ...base, background: "#fff", border: `1px solid ${BORDER}`, color: "#1e293b", ...extra };
}

export function MisaButton({
  variant = "secondary",
  style,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const [hover, setHover] = useState(false);
  const hoverStyle: React.CSSProperties = rest.disabled
    ? { opacity: 0.55, cursor: "not-allowed" }
    : hover
      ? variant === "primary"
        ? { background: "var(--brand)", borderColor: "var(--brand)" }
        : variant === "ghost"
          ? { background: "#f1f5f9" }
          : { background: "#f8fafc", borderColor: "#94a3b8" }
      : {};
  return (
    <button
      type="button"
      {...rest}
      onMouseEnter={(e) => { setHover(true); rest.onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); rest.onMouseLeave?.(e); }}
      style={{ ...misaButtonStyle(variant), ...hoverStyle, ...style }}
    >
      {children}
    </button>
  );
}

function controlBox(focused: boolean, invalid?: boolean): React.CSSProperties {
  return {
    width: "100%",
    height: CONTROL_HEIGHT,
    border: `1px solid ${invalid ? "#dc2626" : focused ? MISA_GREEN : BORDER}`,
    boxShadow: focused ? "0 0 0 3px rgba(0, 168, 98, 0.12)" : "none",
    borderRadius: 4,
    background: "#fff",
    fontSize: 13,
    color: "#0f172a",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
}

export type MisaSelectOption = { value: string; label: string };

export function MisaSelect({
  value,
  options,
  onChange,
  placeholder = "Chọn",
  ariaLabel,
  style,
}: {
  value: string;
  options: MisaSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; maxHeight: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const openAbove = below < 180 && above > below;
    setRect({
      left: r.left,
      top: openAbove ? r.top - 4 : r.bottom + 4,
      width: r.width,
      maxHeight: Math.max(120, Math.min(280, openAbove ? above : below)),
      above: openAbove,
    });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    const reposition = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      place();
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); setActive(Math.max(0, options.findIndex((o) => o.value === value))); return; }
      setActive((i) => {
        const next = e.key === "ArrowDown" ? Math.min(options.length - 1, i + 1) : Math.max(0, i - 1);
        listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    }
    if ((e.key === "Enter" || e.key === " ") && open && active >= 0) {
      e.preventDefault();
      choose(options[active].value);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected?.label}
        onClick={() => { setOpen((o) => !o); setActive(options.findIndex((o) => o.value === value)); }}
        onKeyDown={onKeyDown}
        style={{
          ...controlBox(open),
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "0 10px",
          cursor: "pointer",
          textAlign: "left",
          ...style,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "#0f172a" : "#94a3b8" }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} style={{ flexShrink: 0, color: "#64748b", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && rect && (
        <div
          ref={listRef}
          role="listbox"
          style={{
            position: "fixed",
            left: rect.left,
            top: rect.above ? undefined : rect.top,
            bottom: rect.above ? window.innerHeight - rect.top : undefined,
            minWidth: rect.width,
            maxWidth: Math.max(rect.width, Math.min(520, window.innerWidth - rect.left - 12)),
            maxHeight: rect.maxHeight,
            overflowY: "auto",
            background: "#fff",
            border: `1px solid #e2e8f0`,
            borderRadius: 6,
            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.14)",
            padding: 4,
            zIndex: 100000,
            boxSizing: "border-box",
          }}
        >
          {options.length === 0 && <div style={{ padding: "8px 10px", fontSize: 13, color: "#94a3b8" }}>Không có lựa chọn</div>}
          {options.map((o, i) => {
            const isSel = o.value === value;
            const isActive = i === active;
            return (
              <div
                key={o.value || `__empty_${i}`}
                role="option"
                aria-selected={isSel}
                title={o.label}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(o.value); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "7px 10px",
                  borderRadius: 4,
                  fontSize: 13,
                  cursor: "pointer",
                  color: isSel ? "#047857" : "#1e293b",
                  fontWeight: isSel ? 600 : 400,
                  background: isActive ? "#f0fdf4" : "transparent",
                  lineHeight: 1.4,
                }}
              >
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{o.label}</span>
                {isSel && <Check size={14} style={{ flexShrink: 0, color: MISA_GREEN }} />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

const dmyToIso = (dmy: string) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dmy.trim());
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};
const isoToDmy = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

/** Ô ngày luôn hiển thị DD/MM/YYYY, có nút lịch bên cạnh để chọn nhanh. */
export function MisaDateInput({
  value,
  onChange,
  ariaLabel,
  style,
}: {
  value: string;
  onChange: (dmy: string) => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);
  const invalid = value.trim() !== "" && !dmyToIso(value);

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", ...style }}>
      <input
        type="text"
        aria-label={ariaLabel}
        placeholder="DD/MM/YYYY"
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...controlBox(focused, invalid), padding: "0 40px 0 10px", outline: "none" }}
      />
      <button
        type="button"
        title="Chọn ngày trên lịch"
        aria-label={`Mở lịch ${ariaLabel ?? ""}`.trim()}
        onClick={openPicker}
        style={{
          position: "absolute",
          right: 1,
          top: 1,
          bottom: 1,
          width: 34,
          border: "none",
          borderLeft: `1px solid #e2e8f0`,
          borderRadius: "0 3px 3px 0",
          background: "#f8fafc",
          color: "#475569",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Calendar size={15} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={dmyToIso(value)}
        onChange={(e) => { if (e.target.value) onChange(isoToDmy(e.target.value)); }}
        style={{ position: "absolute", right: 0, bottom: 0, width: 34, height: 1, opacity: 0, pointerEvents: "none", border: 0, padding: 0 }}
      />
    </div>
  );
}

export function MisaCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#1e293b", cursor: "pointer", userSelect: "none" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, margin: 0, accentColor: MISA_GREEN, cursor: "pointer", flexShrink: 0 }}
      />
      <span>{label}</span>
    </label>
  );
}

