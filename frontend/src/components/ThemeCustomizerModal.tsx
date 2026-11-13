import React, { useState, useEffect } from "react";
import { X, Check, Palette, RotateCcw, Sparkles } from "lucide-react";
import {
  THEME_PRESETS,
  DEFAULT_THEME_PRESET_ID,
  ThemeConfig,
  getSavedThemeConfig,
  applyThemeConfig,
} from "../theme/ThemeManager";

export interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeCustomizerModal: React.FC<ThemeCustomizerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<ThemeConfig>(getSavedThemeConfig());

  useEffect(() => {
    if (isOpen) {
      setConfig(getSavedThemeConfig());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = (presetId: string) => {
    const next = { ...config, presetId, customBrand: undefined };
    setConfig(next);
    applyThemeConfig(next);
  };

  const handleSelectRadius = (radius: number) => {
    const next = { ...config, radius };
    setConfig(next);
    applyThemeConfig(next);
  };

  const handleReset = () => {
    const next: ThemeConfig = {
      presetId: DEFAULT_THEME_PRESET_ID,
      radius: 8,
    };
    setConfig(next);
    applyThemeConfig(next);
  };

  const activePreset = THEME_PRESETS[config.presetId] || THEME_PRESETS[DEFAULT_THEME_PRESET_ID];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10050,
        display: "grid",
        placeItems: "center",
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(4px)",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(720px, 96vw)",
          background: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "var(--brand-soft)",
                color: "var(--brand)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Palette size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Bộ chỉnh giao diện & Tông màu (Visual Theme Editor)
              </h3>
              <small style={{ color: "#64748b", fontSize: 12 }}>
                Lấy cảm hứng từ tweakcn & Chuẩn thiết kế UI/UX Pro Max cho Doanh nghiệp
              </small>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "none",
              background: "#f1f5f9",
              color: "#475569",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div
          style={{
            padding: "20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            background: "#f8fafc",
          }}
        >
          {/* Preset Choices */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
              1. Bảng màu chủ đạo (Theme Presets)
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {Object.values(THEME_PRESETS).map((p) => {
                const isSelected = config.presetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id)}
                    style={{
                      padding: "12px",
                      borderRadius: 8,
                      border: isSelected ? `2px solid ${p.brand}` : "1px solid #e2e8f0",
                      background: isSelected ? "#ffffff" : "#ffffff",
                      boxShadow: isSelected ? `0 4px 12px ${p.brand}25` : "0 1px 2px rgba(0,0,0,0.04)",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      transition: "all 0.15s ease",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: p.brand,
                            display: "inline-block",
                            border: "1px solid rgba(0,0,0,0.1)",
                          }}
                        />
                        <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? p.brand : "#0f172a" }}>
                          {p.name.split(" (")[0]}
                        </span>
                      </div>
                      {isSelected && (
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: p.brand,
                            color: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 11.5, color: "#64748b", lineHeight: 1.4 }}>
                      {p.description}
                    </p>
                    {/* Color swatches */}
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      <span style={{ height: 6, flex: 2, background: p.brand, borderRadius: 2 }} />
                      <span style={{ height: 6, flex: 1, background: p.sidebarSurface, borderRadius: 2 }} />
                      <span style={{ height: 6, flex: 1, background: p.brandBorder, borderRadius: 2 }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Radius Selector */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
              2. Độ bo góc giao diện (Corner Radius)
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { r: 0, label: "0px (Vuông vức)" },
                { r: 4, label: "4px (Gọn gàng)" },
                { r: 6, label: "6px (Chuẩn Enterprise)" },
                { r: 8, label: "8px (Mềm mại)" },
                { r: 12, label: "12px (Bo tròn)" },
              ].map((item) => (
                <button
                  key={item.r}
                  type="button"
                  onClick={() => handleSelectRadius(item.r)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: item.r,
                    border: config.radius === item.r ? "2px solid var(--brand)" : "1px solid #cbd5e1",
                    background: config.radius === item.r ? "var(--brand-soft)" : "#ffffff",
                    color: config.radius === item.r ? "var(--brand-ink)" : "#334155",
                    fontWeight: config.radius === item.r ? 700 : 500,
                    fontSize: 12.5,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Box */}
          <div
            style={{
              padding: "16px",
              background: "#ffffff",
              borderRadius: config.radius,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Xem trước thời gian thực (Live Preview)
              </span>
              <span style={{ fontSize: 11, color: "var(--brand)", fontWeight: 600 }}>
                Áp dụng ngay lập tức toàn hệ thống
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                style={{
                  height: 32,
                  padding: "0 16px",
                  background: "var(--brand)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: config.radius,
                  fontWeight: 600,
                  fontSize: 13,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Sparkles size={14} />
                <span>Nút chính (Primary Button)</span>
              </button>

              <button
                type="button"
                style={{
                  height: 32,
                  padding: "0 14px",
                  background: "#ffffff",
                  color: "var(--brand)",
                  border: "1px solid var(--brand-border)",
                  borderRadius: config.radius,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Nút viền (Outline)
              </button>

              <span
                style={{
                  padding: "4px 10px",
                  background: "var(--brand-soft)",
                  color: "var(--brand-ink)",
                  borderRadius: config.radius,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid var(--brand-border)",
                }}
              >
                Thẻ trạng thái (Tag)
              </span>

              <div
                style={{
                  marginLeft: "auto",
                  padding: "6px 12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: config.radius,
                  fontSize: 13,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--brand-ink)",
                }}
              >
                1.423.258.600 đ
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: "14px 20px",
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              background: "none",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              color: "#475569",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} />
            <span>Khôi phục mặc định</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 20px",
              background: "var(--brand)",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            Hoàn tất
          </button>
        </footer>
      </div>
    </div>
  );
};
