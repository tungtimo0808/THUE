import { Building2 } from "lucide-react";

/** The same brand mark in the workspace, authentication and company picker. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`sv-brand-mark${compact ? " sv-brand-mark-compact" : ""}`} aria-hidden="true">
      <Building2 size={compact ? 18 : 24} />
    </span>
  );
}
