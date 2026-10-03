import type { ReferenceHref } from "./ReferenceWorkspace";
import type { ReferenceTabNode } from "./reference-config";
import { ConfiguredListWorkspace } from "./DetailedWorkspaces";

type NestedWorkspaceProps = {
  moduleId: string;
  moduleLabel?: string;
  tab: ReferenceTabNode;
  childId?: string;
  href?: ReferenceHref;
  notify: (message: string) => void;
};

export function NestedWorkspace({
  moduleId,
  tab,
  childId,
  notify,
}: NestedWorkspaceProps) {
  const activeChild =
    (childId && tab.children?.find((child) => child.id === childId)) || null;

  const title = activeChild?.screenTitle || activeChild?.label || tab.label;

  return (
    <ConfiguredListWorkspace
      moduleId={moduleId}
      title={title}
      notify={notify}
    />
  );
}

