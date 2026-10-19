import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
}

export interface MisaDropdownSelectProps {
  value: string | number;
  options: DropdownOption[];
  onChange: (value: string) => void;
  title?: string;
  prefix?: string;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  popoverStyle?: React.CSSProperties;
  minWidth?: number | string;
  align?: "left" | "right";
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export default function MisaDropdownSelect({
  value,
  options,
  onChange,
  title,
  prefix = "",
  icon,
  style,
  buttonStyle,
  popoverStyle,
  minWidth = 190,
  align = "left",
  ariaLabel,
  className = "",
  disabled = false,
}: MisaDropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value)) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const displayLabel = selectedOption ? selectedOption.label : "";
  const renderedLabel = prefix
    ? displayLabel.startsWith(prefix)
      ? displayLabel
      : `${prefix}${displayLabel}`
    : displayLabel;

  return (
    <div
      ref={containerRef}
      className={`misa-dropdown-container ${className}`}
      style={{
        position: "relative",
        display: "inline-block",
        ...style,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={ariaLabel || (typeof renderedLabel === "string" ? renderedLabel : "Chọn")}
        aria-expanded={open}
        style={{
          height: 32,
          padding: "0 10px",
          background: "#ffffff",
          border: `1px solid ${open ? "#0284c7" : "#cbd5e1"}`,
          borderRadius: 6,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: open ? "#0284c7" : "#334155",
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: open ? "0 0 0 2px rgba(2, 132, 199, 0.15)" : "0 1px 2px rgba(0,0,0,0.03)",
          transition: "all 0.16s ease",
          boxSizing: "border-box",
          whiteSpace: "nowrap",
          userSelect: "none",
          outline: "none",
          ...buttonStyle,
        }}
        onMouseEnter={(e) => {
          if (!disabled && !open) {
            e.currentTarget.style.borderColor = "#94a3b8";
            e.currentTarget.style.background = "#f8fafc";
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !open) {
            e.currentTarget.style.borderColor = "#cbd5e1";
            e.currentTarget.style.background = "#ffffff";
          }
        }}
      >
        {icon && <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 220,
          }}
        >
          {renderedLabel}
        </span>
        <ChevronDown
          size={13}
          color={open ? "#0284c7" : "#64748b"}
          style={{
            flexShrink: 0,
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          className="misa-dropdown-popover"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            [align === "right" ? "right" : "left"]: 0,
            minWidth: typeof minWidth === "number" ? `${minWidth}px` : minWidth,
            maxWidth: 320,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.05)",
            padding: 5,
            zIndex: 1050,
            boxSizing: "border-box",
            animation: "misaPopoverFade 0.14s ease-out",
            ...popoverStyle,
          }}
        >
          {title && (
            <div
              style={{
                padding: "6px 9px 7px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#94a3b8",
                borderBottom: "1px solid #f1f5f9",
                marginBottom: 3,
                userSelect: "none",
              }}
            >
              {title}
            </div>
          )}

          <div
            style={{
              maxHeight: 280,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {options.map((option) => {
              const isSelected = String(option.value) === String(value);
              const itemLabel = prefix
                ? option.label.startsWith(prefix)
                  ? option.label
                  : `${prefix}${option.label}`
                : option.label;

              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => {
                    onChange(String(option.value));
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "7px 9px",
                    borderRadius: 5,
                    border: "none",
                    background: isSelected ? "#f0f9ff" : "transparent",
                    color: isSelected ? "#0284c7" : "#334155",
                    fontSize: 12.5,
                    fontWeight: isSelected ? 600 : 500,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                    boxSizing: "border-box",
                    userSelect: "none",
                    lineHeight: 1.3,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "#f1f5f9";
                      e.currentTarget.style.color = "#0284c7";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#334155";
                    }
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {itemLabel}
                  </span>
                  {isSelected && <Check size={14} color="#0284c7" style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
