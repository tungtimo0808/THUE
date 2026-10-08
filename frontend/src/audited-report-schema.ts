export interface ReportHeader {
  text: string;
  colSpan: number;
  rowSpan: number;
}
export interface ReportSelector {
  title: string;
  headers: string[];
  selectAllLabel?: string;
}
export interface AuditedReportDefinition {
  name: string;
  category: string;
  viewer: "dynamic" | "parameterOnly";
  labels: string[];
  checkboxes: { label: string; checked: boolean }[];
  headers: ReportHeader[][];
  selectors: ReportSelector[];
  options?: Record<string, string[]>;
  fields?: {
    label: string;
    kind: string;
    required?: boolean;
    default?: string;
  }[];
  radios?: { label: string; checked: boolean }[];
  printLayout?: "receivablesItems";
}
export const canonicalReportName = (name: string) =>
  name
    .trim()
    .replace(/Số (?=chi tiết|nhật ký|tiền gửi)/g, "Sổ ")
    .replace("(tỉnh)", "(tĩnh)")
    .replace(/\s*-\s*DN\s*-\s*GT/g, "-DN-GT")
    .replace(/\s*-\s*DN/g, "-DN");

/** MISA repeats fixed cells in later header rows for its scroll renderer. */
export function normalizeReportHeaders(
  source: ReportHeader[][],
): ReportHeader[][] {
  const matrix: (ReportHeader | undefined)[][] = [];
  const result: ReportHeader[][] = [];
  source.forEach((row, y) => {
    matrix[y] ??= [];
    const clean: ReportHeader[] = [];
    let x = 0;
    row.forEach((input) => {
      const cell = {
        text: input.text.trim(),
        colSpan: Math.max(input.colSpan || 1, 1),
        rowSpan: Math.max(input.rowSpan || 1, 1),
      };
      if (matrix[y][x]?.text === cell.text) {
        x += cell.colSpan;
        return;
      }
      while (matrix[y][x]) x++;
      clean.push(cell);
      for (let yy = y; yy < y + cell.rowSpan; yy++) {
        matrix[yy] ??= [];
        for (let xx = x; xx < x + cell.colSpan; xx++) matrix[yy][xx] = cell;
      }
      x += cell.colSpan;
    });
    if (clean.length) result.push(clean);
  });
  return result.map((row, index) =>
    row.map((cell) => ({
      ...cell,
      rowSpan: Math.min(cell.rowSpan, result.length - index),
    })),
  );
}
export function reportColumns(
  headers: ReportHeader[][],
): { id: string; label: string; path: string }[] {
  const grid: (ReportHeader | undefined)[][] = [];
  headers.forEach((row, y) => {
    grid[y] ??= [];
    let x = 0;
    row.forEach((cell) => {
      while (grid[y][x]) x++;
      for (let yy = y; yy < y + cell.rowSpan; yy++) {
        grid[yy] ??= [];
        for (let xx = x; xx < x + cell.colSpan; xx++) grid[yy][xx] = cell;
      }
      x += cell.colSpan;
    });
  });
  const width = Math.max(0, ...grid.map((row) => row.length));
  return Array.from({ length: width }, (_, index) => {
    const cells = [
      ...new Set(
        grid
          .map((row) => row[index])
          .filter((cell): cell is ReportHeader => !!cell),
      ),
    ];
    return {
      id: String(index),
      label: cells.at(-1)?.text ?? "",
      path: cells
        .map((cell) => cell.text)
        .filter(Boolean)
        .join(" / "),
    };
  });
}
