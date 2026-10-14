import { reportColumns } from "./audited-report-schema.ts";
import type { ReportHeader } from "./audited-report-schema.ts";

// Keep distinct leaves such as opening/closing Nợ and Có in grouped headers.
export function templateColumnLabels(
  headers: ReportHeader[][],
  auditedLabels?: readonly string[],
): string[] {
  if (auditedLabels) return [...new Set(auditedLabels)];
  const columns = reportColumns(headers);
  const labels = columns.map((column) =>
    columns.filter((other) => other.label === column.label).length > 1
      ? column.path
      : column.label,
  );
  return labels.map((label, index) =>
    labels.filter((other) => other === label).length > 1
      ? `${label} (${labels.slice(0, index + 1).filter((other) => other === label).length})`
      : label,
  );
}
