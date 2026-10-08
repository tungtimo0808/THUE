import type { AuditedReportDefinition } from "./audited-report-schema";
export interface AuditedParameters {
  fields: Record<string, string>;
  selected: Record<string, string[]>;
  checks: Record<string, boolean>;
  radio: string;
}
export function isAuditedParameters(
  value: unknown,
): value is AuditedParameters {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  const record = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  return (
    record(p.fields) &&
    Object.values(p.fields).every((v) => typeof v === "string") &&
    record(p.selected) &&
    Object.values(p.selected).every(
      (v) => Array.isArray(v) && v.every((id) => typeof id === "string"),
    ) &&
    record(p.checks) &&
    Object.values(p.checks).every((v) => typeof v === "boolean") &&
    typeof p.radio === "string"
  );
}
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function auditedPeriodRange(
  period: string,
  today = new Date(),
): [string, string] {
  const year = today.getFullYear(),
    month = today.getMonth(),
    day = today.getDate();
  const quarter = Math.floor(month / 3) * 3;
  let start = new Date(year, month, 1),
    end = new Date(year, month + 1, 0);
  const namedMonth = /^Tháng (\d+)$/.exec(period),
    namedQuarter = /^Quý (\d+)$/.exec(period);
  if (namedMonth) {
    start = new Date(year, Number(namedMonth[1]) - 1, 1);
    end = new Date(year, Number(namedMonth[1]), 0);
  } else if (namedQuarter) {
    start = new Date(year, (Number(namedQuarter[1]) - 1) * 3, 1);
    end = new Date(year, Number(namedQuarter[1]) * 3, 0);
  } else if (["Hôm nay", "Hôm qua", "Ngày mai"].includes(period)) {
    const offset = period === "Hôm qua" ? -1 : period === "Ngày mai" ? 1 : 0;
    start = new Date(year, month, day + offset);
    end = start;
  } else if (period.includes("tuần") || period.includes("Tuần")) {
    const offset = period === "Tuần trước" ? -7 : period === "Tuần sau" ? 7 : 0;
    const monday = day - ((today.getDay() + 6) % 7) + offset;
    start = new Date(year, month, monday);
    end = period.startsWith("Đầu")
      ? new Date(year, month, day)
      : new Date(year, month, monday + 6);
  } else if (period === "Tháng trước" || period === "Tháng sau") {
    const offset = period === "Tháng trước" ? -1 : 1;
    start = new Date(year, month + offset, 1);
    end = new Date(year, month + offset + 1, 0);
  } else if (period.startsWith("Đầu tháng")) end = new Date(year, month, day);
  else if (period.includes("quý") || period.includes("Quý")) {
    const offset = period === "Quý trước" ? -3 : period === "Quý sau" ? 3 : 0;
    start = new Date(year, quarter + offset, 1);
    end = period.startsWith("Đầu")
      ? new Date(year, month, day)
      : new Date(year, quarter + offset + 3, 0);
  } else if (period.includes("năm") || period.includes("Năm")) {
    const offset = period === "Năm trước" ? -1 : period === "Năm sau" ? 1 : 0;
    start = new Date(year + offset, period === "Sáu tháng cuối năm" ? 6 : 0, 1);
    end = period.startsWith("Đầu")
      ? new Date(year, month, day)
      : new Date(year + offset, period === "Sáu tháng đầu năm" ? 6 : 12, 0);
  }
  return [iso(start), iso(end)];
}
export function initialAuditedParameters(
  definition: AuditedReportDefinition,
): AuditedParameters {
  const today = new Date(),
    [from, to] = auditedPeriodRange("Tháng này", today);
  const fields: Record<string, string> = {};
  definition.labels.forEach((label) => {
    const recorded = definition.fields?.find(
      (field) => field.label === label,
    )?.default;
    const recordedDate =
      recorded && /^\d{2}\/\d{2}\/\d{4}$/.test(recorded)
        ? recorded.split("/").reverse().join("-")
        : recorded && /^\d{4}-\d{2}-\d{2}$/.test(recorded)
          ? recorded
          : undefined;
    fields[label] =
      label === "Kỳ báo cáo" || label === "Khoảng thời gian"
        ? "Tháng này"
        : label === "Từ ngày"
          ? recordedDate || from
          : label === "Đến ngày"
            ? recordedDate ||
              (definition.labels.includes("Kỳ báo cáo") ||
              definition.labels.includes("Khoảng thời gian")
                ? to
                : iso(today))
            : label.includes("Ngày") || label.includes("ngày")
              ? recordedDate || iso(today)
              : label === "Năm"
                ? String(today.getFullYear())
                : label === "Tháng"
                  ? definition.printLayout === "taxUninvoiced"
                    ? String(today.getMonth() + 1)
                    : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
                  : (recorded ?? "");
  });
  return {
    fields,
    selected: Object.fromEntries(
      definition.selectors.map((_, index) => [String(index), []]),
    ),
    checks: Object.fromEntries(
      definition.checkboxes.map((check) => [check.label, check.checked]),
    ),
    radio:
      definition.radios?.find((radio) => radio.checked)?.label ??
      definition.radios?.[0]?.label ??
      "",
  };
}
export function validateAuditedParameters(
  parameters: AuditedParameters,
  definition?: AuditedReportDefinition,
): string {
  const { fields } = parameters;
  if (
    definition?.printLayout === "taxUninvoiced" &&
    parameters.radio === "Theo tháng" &&
    !taxMonthRange(fields.Tháng, fields.Năm)
  )
    return "Vui lòng chọn tháng và năm hợp lệ.";
  if (
    (definition?.printLayout !== "taxUninvoiced" ||
      parameters.radio === "Theo tháng") &&
    "Năm" in fields &&
    !/^\d{4}$/.test(fields["Năm"])
  )
    return "Vui lòng nhập năm báo cáo hợp lệ.";
  if (
    ("Từ ngày" in fields && !fields["Từ ngày"]) ||
    ("Đến ngày" in fields && !fields["Đến ngày"])
  )
    return "Vui lòng nhập ngày hợp lệ theo định dạng DD/MM/YYYY.";
  if (
    fields["Từ ngày"] &&
    fields["Đến ngày"] &&
    fields["Từ ngày"] > fields["Đến ngày"]
  )
    return "Từ ngày phải nhỏ hơn hoặc bằng đến ngày.";
  const missing = definition?.fields?.find(
    (field) => field.required && !fields[field.label]?.trim(),
  );
  if (missing)
    return `Vui lòng chọn hoặc nhập ${missing.label.toLocaleLowerCase("vi")}.`;
  return "";
}
export function taxMonthRange(
  month: string,
  year: string,
): [string, string] | null {
  const m = Number(month),
    y = Number(year);
  if (
    !/^\d{4}$/.test(year) ||
    y < 1000 ||
    !Number.isInteger(m) ||
    m < 1 ||
    m > 12
  )
    return null;
  return auditedPeriodRange(`Tháng ${m}`, new Date(y, 0, 1));
}
