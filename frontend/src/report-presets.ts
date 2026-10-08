export interface ReportPreset<T> {
  name: string;
  filters: T;
  combine?: boolean;
}
export function readReportPresets<T extends object>(
  title: string,
  example: T,
): ReportPreset<T>[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`soviet:report-presets:${title}`) ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is ReportPreset<T> => {
        if (
          !item ||
          typeof item !== "object" ||
          typeof item.name !== "string" ||
          !item.filters ||
          typeof item.filters !== "object"
        )
          return false;
        return Object.entries(example).every(([key, expected]) =>
          Array.isArray(expected)
            ? Array.isArray(item.filters[key]) &&
              item.filters[key].every(
                (entry: unknown) => typeof entry === "string",
              )
            : typeof item.filters[key] === typeof expected,
        );
      })
      .slice(-20);
  } catch {
    return [];
  }
}
export function writeReportPresets<T>(
  title: string,
  presets: ReportPreset<T>[],
): boolean {
  try {
    localStorage.setItem(
      `soviet:report-presets:${title}`,
      JSON.stringify(presets.slice(-20)),
    );
    return true;
  } catch {
    return false;
  }
}
