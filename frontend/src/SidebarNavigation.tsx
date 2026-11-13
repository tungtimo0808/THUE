import { useState, useRef, type FocusEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { referenceNav } from "./reference-config";
import { MISA_MODULE_FLYOUTS } from "./misa-flyout-config";
import { preloadWorkspace } from "./workspace-preloader";

type SidebarNavigationProps = {
  moduleId: string;
  href: (path: string) => string;
  onNavigate: () => void;
  onOpenAI?: () => void;
  onExchangeRate?: () => void;
  allowedModules?: string[];
};

interface NavSectionDef {
  title: string;
  ids: string[];
}

const NAV_SECTIONS: NavSectionDef[] = [
  {
    title: "Tổng quan & Điều hành",
    ids: ["overview"],
  },
  {
    title: "Thuế & Hóa đơn",
    ids: ["invoices", "tax"],
  },
  {
    title: "Nghiệp vụ chứng từ",
    ids: ["cash", "bank", "purchases", "sales", "inventory", "cost", "tools", "assets", "payroll"],
  },
  {
    title: "Báo cáo & Sổ sách",
    ids: ["ledger", "reports", "budget", "analysis", "directory", "opening", "insurance", "connections"],
  },
];

export function SidebarNavigation({
  moduleId,
  href,
  onNavigate,
  onOpenAI,
  onExchangeRate,
  allowedModules,
}: SidebarNavigationProps) {
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const openTimerRef = useRef<number | null>(null);

  const closeAfterBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpenModule(null);
      setFlyoutPos(null);
    }
  };

  const closeWithEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    setOpenModule(null);
    setFlyoutPos(null);
    event.currentTarget
      .querySelector<HTMLAnchorElement>(".ref-nav-item")
      ?.focus();
  };

  const handleOpenModule = (currentTarget: HTMLElement, modId: string) => {
    if (!currentTarget || !modId) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    const flyoutData = MISA_MODULE_FLYOUTS[modId];
    if (!flyoutData) return;
    openTimerRef.current = window.setTimeout(() => {
      const rect = currentTarget.getBoundingClientRect();
      const opsCount = flyoutData.operations?.length ?? 0;
      const utilsCount = flyoutData.utilities?.length ?? 0;
      const itemsCount = Math.max(opsCount, utilsCount) || 5;
      const estimatedHeight = Math.max(160, itemsCount * 32 + 60);
      const windowHeight = window.innerHeight;
      let top = rect.top - 36;
      if (top + estimatedHeight > windowHeight - 16) {
        top = Math.max(40, windowHeight - estimatedHeight - 16);
      }
      if (top < 16) top = 16;
      setFlyoutPos({ top, left: rect.right + 2 });
      setOpenModule(modId);
    }, 65);
  };

  const handleCloseModule = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    closeTimerRef.current = window.setTimeout(() => {
      setOpenModule(null);
      setFlyoutPos(null);
    }, 180);
  };

  const handleMouseEnterFlyout = (modId: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpenModule(modId);
  };

  const sectionedIds = new Set(NAV_SECTIONS.flatMap((s) => s.ids));
  const otherModules = referenceNav.filter(
    (m) =>
      !sectionedIds.has(m.id) &&
      (!allowedModules || allowedModules.length === 0 || allowedModules.includes(m.id)),
  );

  const renderModuleItem = (module: (typeof referenceNav)[number]) => {
    const isOpen = openModule === module.id;
    const isActive = moduleId === module.id;
    const flyout = MISA_MODULE_FLYOUTS[module.id];
    const hasUtilities = Boolean(flyout && flyout.utilities && flyout.utilities.length > 0);

    return (
      <div
        className={`ref-nav-group ${isOpen ? "open" : ""}`}
        key={module.id}
        onMouseEnter={(e) => {
          handleOpenModule(e.currentTarget, module.id);
          preloadWorkspace(module.id);
        }}
        onMouseLeave={handleCloseModule}
        onFocus={(e) => {
          handleOpenModule(e.currentTarget, module.id);
          preloadWorkspace(module.id);
        }}
        onBlur={closeAfterBlur}
        onKeyDown={closeWithEscape}
      >
        <NavLink
          className={() =>
            `ref-nav-item ${isActive ? "misa-active active" : ""}`
          }
          to={href(`/${module.id}`)}
          onClick={() => {
            setOpenModule(null);
            setFlyoutPos(null);
            onNavigate();
          }}
          aria-haspopup={flyout ? "menu" : undefined}
          aria-expanded={flyout ? isOpen : undefined}
          title={module.label}
        >
          <span className="ref-nav-icon">
            <module.icon size={18} />
          </span>
          <span className="ref-nav-label">{module.label}</span>
          {"badge" in module && (module as any).badge && (
            <span className="ref-nav-badge">{(module as any).badge}</span>
          )}
        </NavLink>

        {flyout && isOpen && flyoutPos && typeof document !== "undefined"
          ? createPortal(
              <div
                className={`misa-flyout-card ${!hasUtilities ? "single-column" : ""}`}
                style={{
                  position: "fixed",
                  top: `${flyoutPos.top}px`,
                  left: `${flyoutPos.left}px`,
                  zIndex: 99999,
                }}
                onMouseEnter={() => handleMouseEnterFlyout(module.id)}
                onMouseLeave={handleCloseModule}
                role="menu"
                aria-label={`Menu ${module.label}`}
              >
                <div className="misa-flyout-column">
                  {flyout.operationsTitle !== "" && (
                    <h4>{flyout.operationsTitle || "Nghiệp vụ"}</h4>
                  )}
                  <ul>
                    {flyout.operations.map((op, idx) => (
                      <li key={idx}>
                        <Link
                          to={href(op.path || `/${module.id}`)}
                          onMouseEnter={() => preloadWorkspace(module.id)}
                          onFocus={() => preloadWorkspace(module.id)}
                          onClick={() => {
                            setOpenModule(null);
                            setFlyoutPos(null);
                            onNavigate();
                          }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                        >
                          <span>{op.label}</span>
                          {op.badge && (
                            <span
                              style={{
                                marginLeft: 8,
                                backgroundColor: "#ea580c",
                                color: "#ffffff",
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: 4,
                                lineHeight: "14px",
                              }}
                            >
                              {op.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {hasUtilities && (
                  <div className="misa-flyout-column">
                    <h4>{flyout.utilitiesTitle || "Tiện ích"}</h4>
                    <ul>
                      {flyout.utilities.map((util, idx) => (
                        <li key={idx}>
                          {util.action === "exchange_rate" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenModule(null);
                                setFlyoutPos(null);
                                onExchangeRate?.();
                              }}
                            >
                              {util.label}
                            </button>
                          ) : util.action === "ai" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenModule(null);
                                setFlyoutPos(null);
                                onOpenAI?.();
                              }}
                            >
                              {util.label}
                            </button>
                          ) : (
                            <Link
                              to={href(util.path || `/${module.id}`)}
                              onMouseEnter={() => preloadWorkspace(module.id)}
                              onFocus={() => preloadWorkspace(module.id)}
                              onClick={() => {
                                setOpenModule(null);
                                setFlyoutPos(null);
                                onNavigate();
                              }}
                              style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                            >
                              <span>{util.label}</span>
                              {util.badge && (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    backgroundColor: "#ea580c",
                                    color: "#ffffff",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    lineHeight: "14px",
                                  }}
                                >
                                  {util.badge}
                                </span>
                              )}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  };

  return (
    <nav aria-label="Điều hướng chính">
      {NAV_SECTIONS.map((section, sectionIdx) => {
        const isOverviewSec = section.ids.includes("overview");
        const allowedSecIds = section.ids.filter(
          (id) => !allowedModules || allowedModules.length === 0 || allowedModules.includes(id)
        );
        if (allowedSecIds.length === 0) return null;

        return (
          <div className="ref-nav-section" key={section.title}>
            <div className="ref-nav-section-title">{section.title}</div>

            {isOverviewSec && (
              <div className="ref-nav-group">
                <NavLink
                  className={() =>
                    `ref-nav-item ${moduleId === "overview" ? "misa-active active" : ""}`
                  }
                  to={href("/overview")}
                  onMouseEnter={() => preloadWorkspace("overview")}
                  onFocus={() => preloadWorkspace("overview")}
                  onClick={() => {
                    setOpenModule(null);
                    onNavigate();
                  }}
                  title="Tổng quan"
                >
                  <span className="ref-nav-icon">
                    <LayoutGrid size={18} />
                  </span>
                  <span className="ref-nav-label">Tổng quan</span>
                </NavLink>
              </div>
            )}

            {section.ids
              .filter((id) => id !== "overview")
              .map((id) => {
                const mod = referenceNav.find((m) => m.id === id);
                if (!mod) return null;
                if (allowedModules && allowedModules.length > 0 && !allowedModules.includes(id)) {
                  return null;
                }
                return renderModuleItem(mod);
              })}

            {sectionIdx < NAV_SECTIONS.length - 1 && <div className="ref-nav-section-divider" />}
          </div>
        );
      })}

      {otherModules.length > 0 && (
        <div className="ref-nav-section">
          <div className="ref-nav-section-title">Khác</div>
          {otherModules.map(renderModuleItem)}
        </div>
      )}
    </nav>
  );
}
