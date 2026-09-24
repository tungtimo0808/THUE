import { useState, type FocusEvent, type KeyboardEvent } from "react";
import { ChevronRight } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { referenceNav, referenceTabHierarchy } from "./reference-config";

type SidebarNavigationProps = {
  moduleId: string;
  href: (path: string) => string;
  onNavigate: () => void;
};

export function SidebarNavigation({
  moduleId,
  href,
  onNavigate,
}: SidebarNavigationProps) {
  const [openModule, setOpenModule] = useState<string | null>(null);

  const closeAfterBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpenModule(null);
  };

  const closeWithEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    setOpenModule(null);
    event.currentTarget
      .querySelector<HTMLAnchorElement>(".ref-nav-item")
      ?.focus();
  };

  return (
    <nav aria-label="Điều hướng chính">
      {referenceNav
        .filter((module) => module.id !== "overview")
        .map((module) => {
          const tabs = referenceTabHierarchy[module.id] || [];
          const isOpen = openModule === module.id;
          return (
            <div
              className={`ref-nav-group ${isOpen ? "open" : ""}`}
              key={module.id}
              onMouseEnter={() => setOpenModule(module.id)}
              onMouseLeave={() => setOpenModule(null)}
              onFocus={() => setOpenModule(module.id)}
              onBlur={closeAfterBlur}
              onKeyDown={closeWithEscape}
            >
              <NavLink
                title={module.label}
                className={() =>
                  `ref-nav-item ${moduleId === module.id ? "active" : ""}`
                }
                to={href(`/${module.id}`)}
                onClick={() => {
                  setOpenModule(null);
                  onNavigate();
                }}
                aria-haspopup={tabs.length ? "menu" : undefined}
                aria-expanded={tabs.length ? isOpen : undefined}
              >
                <module.icon size={16} />
                <span>{module.label}</span>
                {tabs.length > 0 && (
                  <ChevronRight className="ref-nav-caret" size={13} />
                )}
              </NavLink>
              {tabs.length > 0 && (
                <div
                  className="ref-nav-flyout"
                  role="menu"
                  aria-label={`Mục con ${module.label}`}
                  aria-hidden={!isOpen}
                >
                  <header>
                    <span className="ref-flyout-icon">
                      <module.icon size={17} />
                    </span>
                    <span>
                      <strong>{module.label}</strong>
                      <small>Chức năng theo cấu trúc V5</small>
                    </span>
                  </header>
                  <div className="ref-flyout-list">
                    {tabs.map((tab) => (
                      <section key={tab.id}>
                        <Link
                          role="menuitem"
                          className="ref-flyout-parent"
                          to={href(`/${module.id}/${tab.id}`)}
                          onClick={() => {
                            setOpenModule(null);
                            onNavigate();
                          }}
                        >
                          <span>{tab.label}</span>
                          {tab.children?.length ? (
                            <ChevronRight size={13} />
                          ) : null}
                        </Link>
                        {tab.children?.length ? (
                          <div className="ref-flyout-children">
                            {tab.children.map((child) => (
                              <Link
                                role="menuitem"
                                aria-label={child.menuLabel}
                                to={href(`/${module.id}/${tab.id}/${child.id}`)}
                                key={child.id}
                                onClick={() => {
                                  setOpenModule(null);
                                  onNavigate();
                                }}
                              >
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    ))}
                  </div>
                  <footer>Cấp 2 → Cấp 3 · Rê chuột hoặc dùng Tab</footer>
                </div>
              )}
            </div>
          );
        })}
    </nav>
  );
}
