import { ChevronRight, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReferenceHref } from "./ReferenceWorkspace";
import type { ReferenceTabNode } from "./reference-config";
import { ConfiguredListWorkspace } from "./DetailedWorkspaces";

type NestedWorkspaceProps = {
  moduleId: string;
  moduleLabel: string;
  tab: ReferenceTabNode;
  childId?: string;
  href: ReferenceHref;
  notify: (message: string) => void;
};

export function NestedWorkspace({
  moduleId,
  moduleLabel,
  tab,
  childId,
  href,
  notify,
}: NestedWorkspaceProps) {
  const activeChild =
    tab.children?.find((child) => child.id === childId) || tab.children?.[0];

  if (!activeChild || !tab.children) {
    return (
      <ConfiguredListWorkspace
        moduleId={moduleId}
        title={tab.label}
        notify={notify}
      />
    );
  }

  return (
    <div className="ref-nested-workspace">
      <header className="ref-inner-heading">
        <div>
          <p>
            <span>{moduleLabel}</span>
            <ChevronRight size={12} />
            <strong>{tab.label}</strong>
          </p>
          <div>
            <Layers3 size={17} />
            <span>Tab bên trong workspace · Cấp 3</span>
          </div>
        </div>
        {tab.configurable ? (
          <span className="ref-optional-chip">Tùy chọn</span>
        ) : null}
      </header>
      <nav
        className="ref-inner-tabs"
        aria-label={`Chức năng bên trong ${tab.label}`}
      >
        {tab.children.map((child) => (
          <Link
            className={child.id === activeChild.id ? "active" : ""}
            to={href(`/${moduleId}/${tab.id}/${child.id}`)}
            key={child.id}
          >
            {child.label}
          </Link>
        ))}
      </nav>
      <ConfiguredListWorkspace
        moduleId={moduleId}
        title={activeChild.screenTitle || activeChild.label}
        notify={notify}
      />
    </div>
  );
}
