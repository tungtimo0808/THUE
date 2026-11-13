export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  brand: string;
  brandHover: string;
  brandSoft: string;
  brandSubtle: string;
  brandBorder: string;
  brandInk: string;
  canvas: string;
  surface: string;
  sidebarSurface: string;
  ink: string;
  border: string;
}

export const DEFAULT_THEME_PRESET_ID = "sovereign-sapphire";

export const THEME_PRESETS: Record<string, ThemePreset> = {
  "sovereign-sapphire": {
    id: "sovereign-sapphire",
    name: "Lam Ngọc Hoàng Gia (Sovereign Sapphire)",
    description: "Bảng màu đặc trưng Sổ Việt: Lam ngọc sâu sang trọng, nền sứ lạnh kiến trúc và thanh điều hướng đêm sẫm",
    brand: "#2448d8",
    brandHover: "#1b38b0",
    brandSoft: "#eef3ff",
    brandSubtle: "#dfe8ff",
    brandBorder: "#c2d3ff",
    brandInk: "#172e94",
    canvas: "#f3f6fc",
    surface: "#ffffff",
    sidebarSurface: "#0c172c",
    ink: "#0f172a",
    border: "#e1e8f3",
  },
  "nordic-cobalt": {
    id: "nordic-cobalt",
    name: "Xanh Bắc Âu Chuẩn Mực (Nordic Cobalt)",
    description: "Tone xanh Cobalt thanh lịch, độ tương phản chuẩn mực cho kế toán - kiểm toán cường độ cao",
    brand: "#1d5bd6",
    brandHover: "#1648ad",
    brandSoft: "#edf4ff",
    brandSubtle: "#dbeafe",
    brandBorder: "#b9d5fe",
    brandInk: "#163d8f",
    canvas: "#f2f6fb",
    surface: "#ffffff",
    sidebarSurface: "#102138",
    ink: "#0f172a",
    border: "#dfe7f2",
  },
  "royal-indigo": {
    id: "royal-indigo",
    name: "Chàm Tập Đoàn (Imperial Indigo)",
    description: "Tone chàm đậm phong thái quản trị điều hành tập đoàn và tài chính chiến lược",
    brand: "#4338ca",
    brandHover: "#3730a3",
    brandSoft: "#eef2ff",
    brandSubtle: "#e0e7ff",
    brandBorder: "#c7d2fe",
    brandInk: "#312e81",
    canvas: "#f4f5fb",
    surface: "#ffffff",
    sidebarSurface: "#161436",
    ink: "#0f172a",
    border: "#e2e5f1",
  },
  "ocean-breeze": {
    id: "ocean-breeze",
    name: "Đại Dương Tài Chính (Oceanic Deep)",
    description: "Xanh biển sâu hiện đại theo phong cách ngân hàng số & Fintech thế hệ mới",
    brand: "#0369a1",
    brandHover: "#075985",
    brandSoft: "#f0f9ff",
    brandSubtle: "#e0f2fe",
    brandBorder: "#bae6fd",
    brandInk: "#0c4a6e",
    canvas: "#f2f7fb",
    surface: "#ffffff",
    sidebarSurface: "#0c1e2e",
    ink: "#0f172a",
    border: "#dde7f0",
  },
  "clean-slate": {
    id: "clean-slate",
    name: "Đá Phiến Tối Giản (Swiss Graphite)",
    description: "Phong cách Swiss Minimalism tinh khiết, điềm tĩnh và tập trung tuyệt đối vào số liệu",
    brand: "#27364b",
    brandHover: "#182232",
    brandSoft: "#f1f5f9",
    brandSubtle: "#e2e8f0",
    brandBorder: "#cbd5e1",
    brandInk: "#0f172a",
    canvas: "#f5f7fa",
    surface: "#ffffff",
    sidebarSurface: "#111827",
    ink: "#0f172a",
    border: "#e2e8f0",
  },
  "bordeaux-executive": {
    id: "bordeaux-executive",
    name: "Đỏ Đô Điều Hành (Executive Bordeaux)",
    description: "Sắc đỏ rượu vang sang trọng, quyền lực dành cho ban lãnh đạo và kiểm soát nội bộ",
    brand: "#9f1239",
    brandHover: "#881337",
    brandSoft: "#fff1f2",
    brandSubtle: "#ffe4e6",
    brandBorder: "#fecdd3",
    brandInk: "#881337",
    canvas: "#f9f5f7",
    surface: "#ffffff",
    sidebarSurface: "#1e111a",
    ink: "#18181b",
    border: "#ece2e7",
  },
};

export interface ThemeConfig {
  presetId: string;
  radius: number; // in px: 0, 4, 6, 8, 12
  customBrand?: string;
}

const STORAGE_KEY = "soviet_erp_theme_v2";

export function getSavedThemeConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.presetId === "string" && THEME_PRESETS[parsed.presetId]) {
        return parsed;
      }
    }
  } catch {}
  return {
    presetId: DEFAULT_THEME_PRESET_ID,
    radius: 8,
  };
}

export function applyThemeConfig(config: ThemeConfig) {
  const root = document.documentElement;
  const preset = THEME_PRESETS[config.presetId] || THEME_PRESETS[DEFAULT_THEME_PRESET_ID];

  const brand = config.customBrand || preset.brand;
  const brandHover = preset.brandHover;
  const brandSoft = preset.brandSoft;
  const brandSubtle = preset.brandSubtle;
  const brandBorder = preset.brandBorder;
  const brandInk = preset.brandInk;
  const radius = `${config.radius}px`;

  root.style.setProperty("--brand", brand);
  root.style.setProperty("--brand-hover", brandHover);
  root.style.setProperty("--brand-soft", brandSoft);
  root.style.setProperty("--brand-subtle", brandSubtle);
  root.style.setProperty("--brand-border", brandBorder);
  root.style.setProperty("--brand-ink", brandInk);
  root.style.setProperty("--primary", brand);
  root.style.setProperty("--teal", brand);
  root.style.setProperty("--sidebar-surface", preset.sidebarSurface);
  root.style.setProperty("--canvas", preset.canvas);
  root.style.setProperty("--surface", preset.surface);
  root.style.setProperty("--ink", preset.ink);
  root.style.setProperty("--border", preset.border);
  root.style.setProperty("--control-radius", radius);
  root.style.setProperty("--panel-radius", `${Math.min(config.radius + 4, 16)}px`);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

// Auto init immediately upon import so outer web, admin, super-admin, and workspaces stay 100% synchronized
if (typeof window !== "undefined") {
  applyThemeConfig(getSavedThemeConfig());
}
