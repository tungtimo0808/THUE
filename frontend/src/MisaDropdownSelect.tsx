import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface DropdownOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  group?: string;
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
  description?: string;
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
  buttonClassName?: string;
  itemClassName?: string;
  className?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  placeholder?: string;
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
  buttonClassName = "",
  itemClassName = "",
  disabled = false,
  fullWidth = false,
  searchable,
  searchPlaceholder = "Tìm nhanh lựa chọn...",
  placeholder,
}: MisaDropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption =
    options.find((opt) => String(opt.value) === String(value)) ||
    (placeholder ? undefined : options[0]);

  const showSearch = searchable ?? options.length >= 10;

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
      if (showSearch) {
        setTimeout(() => searchInputRef.current?.focus(), 20);
      }
    } else {
      setSearchQuery("");
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, showSearch]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.group && opt.group.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q)) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const displayLabel = selectedOption ? selectedOption.label : placeholder || "";
  const renderedLabel = prefix
    ? displayLabel.startsWith(prefix)
      ? displayLabel
      : `${prefix}${displayLabel}`
    : displayLabel;

  let lastGroup: string | undefined = undefined;

  return (
    <div
      ref={containerRef}
      className={`misa-dropdown-container ${className}`.trim()}
      style={{
        position: "relative",
        display: fullWidth ? "flex" : "inline-block",
        width: fullWidth ? "100%" : undefined,
        fontFamily: "'Be Vietnam Pro', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        ...style,
      }}
    >
      <select
        aria-hidden="true"
        tabIndex={-1}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: "100%",
          height: "100%",
          top: 0,
          left: 0,
        }}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={buttonClassName || undefined}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={ariaLabel || (typeof renderedLabel === "string" ? renderedLabel : "Chọn")}
        title={typeof renderedLabel === "string" ? renderedLabel : undefined}
        aria-expanded={open}
        style={{
          width: fullWidth ? "100%" : undefined,
          height: fullWidth ? 38 : 34,
          padding: fullWidth ? "0 12px" : "0 11px",
          background: disabled ? "#f8fafc" : "#ffffff",
          border: `1px solid ${open ? "#0284c7" : "#cbd5e1"}`,
          borderRadius: fullWidth ? 10 : 8,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontFamily: "inherit",
          fontSize: fullWidth ? 13.5 : 13,
          fontWeight: 500,
          color: !selectedOption && placeholder ? "#94a3b8" : open ? "#0284c7" : "#1e293b",
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: open
            ? "0 0 0 3px rgba(2, 132, 199, 0.14)"
            : "0 1px 2px rgba(15, 23, 42, 0.03)",
          transition: "all 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
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
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            minWidth: 0,
            flex: 1,
            overflow: "hidden",
          }}
        >
          {icon && <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>}
          {selectedOption?.icon && (
            <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: fullWidth ? "100%" : 380,
              textAlign: "left",
            }}
          >
            {renderedLabel}
          </span>
          {selectedOption?.badge && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "1px 7px",
                borderRadius: 999,
                background: selectedOption.badgeBg || "#f1f5f9",
                color: selectedOption.badgeColor || "#475569",
                flexShrink: 0,
              }}
            >
              {selectedOption.badge}
            </span>
          )}
        </span>
        <ChevronDown
          size={15}
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
            top: "calc(100% + 6px)",
            [align === "right" ? "right" : "left"]: 0,
            minWidth: fullWidth ? "100%" : typeof minWidth === "number" ? `${minWidth}px` : minWidth,
            width: fullWidth ? "100%" : "max-content",
            maxWidth: fullWidth ? "100%" : "min(500px, calc(100vw - 32px))",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow:
              "0 14px 32px -6px rgba(15, 23, 42, 0.16), 0 6px 14px -4px rgba(15, 23, 42, 0.08)",
            padding: 6,
            zIndex: 1200,
            boxSizing: "border-box",
            fontFamily: "inherit",
            animation: "misaPopoverFade 0.14s ease-out",
            ...popoverStyle,
          }}
        >
          {title && (
            <div
              style={{
                padding: "6px 10px 7px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#64748b",
                borderBottom: "1px solid #f1f5f9",
                marginBottom: 4,
                userSelect: "none",
              }}
            >
              {title}
            </div>
          )}

          {showSearch && (
            <div
              style={{
                position: "relative",
                marginBottom: 6,
                padding: "2px 2px 0",
              }}
            >
              <Search
                size={14}
                color="#94a3b8"
                style={{
                  position: "absolute",
                  left: 11,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  height: 33,
                  padding: "0 28px 0 31px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  fontSize: 12.5,
                  fontFamily: "inherit",
                  color: "#0f172a",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: 2,
                    cursor: "pointer",
                    color: "#94a3b8",
                    display: "flex",
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          <div
            className="admin-custom-scroll"
            style={{
              maxHeight: 280,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              paddingRight: 2,
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: "14px 10px",
                  textAlign: "center",
                  fontSize: 12.5,
                  color: "#94a3b8",
                }}
              >
                Không tìm thấy lựa chọn phù hợp
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = String(option.value) === String(value);
                const itemLabel = prefix
                  ? option.label.startsWith(prefix)
                    ? option.label
                    : `${prefix}${option.label}`
                  : option.label;

                const showGroupHeader = option.group && option.group !== lastGroup;
                if (option.group) {
                  lastGroup = option.group;
                }

                return (
                  <React.Fragment key={String(option.value) || `__empty_${itemLabel}`}>
                    {showGroupHeader && (
                      <div
                        style={{
                          padding: "6px 10px 4px",
                          marginTop: 3,
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#64748b",
                          background: "#f8fafc",
                          borderRadius: 6,
                          letterSpacing: "0.02em",
                          userSelect: "none",
                        }}
                      >
                        {option.group}
                      </div>
                    )}
                    <button
                      type="button"
                      className={`misa-dropdown-item ${itemClassName || ""}`.trim() || undefined}
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
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "none",
                        background: isSelected ? "#f0f9ff" : "transparent",
                        color: isSelected ? "#0284c7" : "#1e293b",
                        fontFamily: "inherit",
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 500,
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                        boxSizing: "border-box",
                        userSelect: "none",
                        lineHeight: 1.35,
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
                          e.currentTarget.style.color = "#1e293b";
                        }
                      }}
                      title={itemLabel}
                    >
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                          {option.icon && (
                            <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
                              {option.icon}
                            </span>
                          )}
                          <span
                            style={{
                              whiteSpace: "normal",
                              overflowWrap: "break-word",
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            {itemLabel}
                          </span>
                          {option.badge && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 600,
                                padding: "1px 7px",
                                borderRadius: 999,
                                background: option.badgeBg || "#f1f5f9",
                                color: option.badgeColor || "#475569",
                                flexShrink: 0,
                              }}
                            >
                              {option.badge}
                            </span>
                          )}
                        </div>
                        {option.description && (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 400,
                              color: "#64748b",
                              lineHeight: 1.3,
                            }}
                          >
                            {option.description}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check size={15} color="#0284c7" style={{ flexShrink: 0 }} />}
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
