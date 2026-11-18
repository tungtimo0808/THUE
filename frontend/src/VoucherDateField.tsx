import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cashDateValue, currentCashDate } from "./cash-date";

export default function VoucherDateField({
  value,
  onChange,
  label,
  className = "misa-voucher-input",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const initial = new Date(cashDateValue(value));
  const [month, setMonth] = useState(
    Number.isFinite(initial.getTime()) ? initial.getMonth() : new Date().getMonth(),
  );
  const [year, setYear] = useState(
    Number.isFinite(initial.getTime()) ? initial.getFullYear() : new Date().getFullYear(),
  );
  const root = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const show = () => {
    const date = new Date(cashDateValue(value));
    if (Number.isFinite(date.getTime())) {
      setMonth(date.getMonth());
      setYear(date.getFullYear());
    }
    const rect = root.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        left: Math.max(8, Math.min(rect.right - 300, window.innerWidth - 308)),
        top: Math.max(8, Math.min(rect.bottom + 3, window.innerHeight - 350)),
      });
    }
    setView("days");
    setOpen(!open);
  };

  const move = (direction: number) => {
    if (view === "years") {
      setYear(year + direction * 12);
      return;
    }
    if (view === "months") {
      setYear(year + direction);
      return;
    }
    const next = new Date(year, month + direction, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const choose = (date: Date) => {
    onChange(currentCashDate(date));
    setOpen(false);
  };

  const days = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const isDirectoryDate = className === "md-date-input";
  const fieldHeight = isDirectoryDate ? 34 : 32;
  const buttonStyle = {
    border: 0,
    background: "transparent",
    height: 32,
    cursor: "pointer",
    color: "#475569",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div
      ref={root}
      style={{
        position: "relative",
        width: "100%",
        height: fieldHeight,
        minHeight: fieldHeight,
        maxHeight: fieldHeight,
        display: "flex",
        alignItems: "center",
        zIndex: open ? 2000 : undefined,
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <input
        className={className}
        aria-label={label}
        value={value}
        placeholder="DD/MM/YYYY"
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          height: fieldHeight,
          minHeight: fieldHeight,
          maxHeight: fieldHeight,
          padding: "0 34px 0 10px",
          borderRadius: isDirectoryDate ? 6 : undefined,
          border: isDirectoryDate
            ? `1px solid ${open ? "var(--brand, #1d4ed8)" : "#cbd5e1"}`
            : undefined,
          boxShadow:
            isDirectoryDate && open
              ? "0 0 0 3px rgba(29, 78, 216, 0.12)"
              : isDirectoryDate
                ? "0 1px 2px rgba(15, 23, 42, 0.03)"
                : undefined,
          boxSizing: "border-box",
        }}
      />
      <button
        type="button"
        className="md-date-trigger"
        aria-label={`Chọn ngày ${label}`}
        aria-expanded={open}
        onClick={show}
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
          border: 0,
          borderRadius: 5,
          background: open ? "#eff6ff" : "transparent",
          cursor: "pointer",
          color: open ? "var(--brand, #1d4ed8)" : "#64748b",
        }}
      >
        <Calendar size={14.5} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
              }
            }}
            role="dialog"
            aria-label={`Lịch ${label}`}
            style={{
              position: "fixed",
              ...position,
              zIndex: 14000,
              width: 300,
              maxHeight: "calc(100vh - 24px)",
              overflow: "auto",
              padding: 12,
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              boxShadow:
                "0 14px 32px -6px rgba(15, 23, 42, 0.16), 0 6px 14px -4px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                aria-label="Kỳ trước trên lịch"
                style={{ ...buttonStyle, width: 30, borderRadius: 6 }}
                onClick={() => move(-1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                style={{ ...buttonStyle, fontWeight: 600, padding: "0 10px", borderRadius: 6 }}
                onClick={() =>
                  setView(view === "days" ? "months" : view === "months" ? "years" : "days")
                }
              >
                {view === "years"
                  ? `${year - 5} – ${year + 6}`
                  : view === "months"
                    ? `Năm ${year}`
                    : `Tháng ${month + 1} Năm ${year}`}
              </button>
              <button
                type="button"
                aria-label="Kỳ sau trên lịch"
                style={{ ...buttonStyle, width: 30, borderRadius: 6 }}
                onClick={() => move(1)}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            {view === "days" ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7,1fr)",
                    textAlign: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid #e5e7eb",
                    color: "#6b7280",
                  }}
                >
                  {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7,1fr)",
                    gap: 4,
                    padding: "8px 0",
                  }}
                >
                  {Array.from({ length: offset }, (_, index) => (
                    <span key={`blank-${index}`} />
                  ))}
                  {Array.from({ length: days }, (_, index) => {
                    const date = new Date(year, month, index + 1);
                    const selected = currentCashDate(date) === value;
                    return (
                      <button
                        key={index}
                        type="button"
                        aria-label={`Chọn ${currentCashDate(date)}`}
                        style={{
                          ...buttonStyle,
                          borderRadius: "50%",
                          background: selected ? "var(--brand)" : "transparent",
                          color: selected ? "white" : "#64748b",
                        }}
                        onClick={() => choose(date)}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 8,
                  padding: "12px 0",
                }}
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    style={buttonStyle}
                    onClick={() => {
                      if (view === "years") {
                        setYear(year - 5 + index);
                        setView("months");
                      } else {
                        setMonth(index);
                        setView("days");
                      }
                    }}
                  >
                    {view === "years" ? year - 5 + index : `Tháng ${index + 1}`}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              style={{ ...buttonStyle, width: "100%", borderTop: "1px solid #e5e7eb", color: "var(--brand)", fontWeight: 600 }}
              onClick={() => choose(new Date())}
            >
              Hôm nay
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
