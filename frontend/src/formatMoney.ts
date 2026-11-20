const vnIntFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

export function toMoneyNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== "string") {
    return 0;
  }
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (/^-?\d+,\d+$/.test(trimmed)) {
    const parsed = Number(trimmed.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatVnd(value: unknown): string {
  return vnIntFormatter.format(toMoneyNumber(value));
}

export function formatVnDecimal(value: unknown, fractionDigits = 2): string {
  const num = toMoneyNumber(value);
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(num);
}

export function formatMoneyInput(
  value: number | string | null | undefined,
  options?: { emptyZero?: boolean }
): string {
  if (value === "" || value === null || value === undefined) {
    return "";
  }
  const num = toMoneyNumber(value);
  if (options?.emptyZero && num === 0) {
    return "";
  }
  return vnIntFormatter.format(num);
}

export function parseMoneyInput(raw: string): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const negative = trimmed.startsWith("-");
  // Only strip 1-2 digit trailing zero decimals when matching full formatted currency strings
  // (e.g. "730.000,00" or "730,000.00"). Never strip ".0000" or ",0000" when user types "0" at the end.
  let cleaned = trimmed;
  if (/^-?\d{1,3}(?:,\d{3})+\.0{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(/\.0{1,2}$/, "");
  } else if (/^-?\d{1,3}(?:\.\d{3})+,0{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(/,0{1,2}$/, "");
  }
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return 0;
  const num = Number(digits);
  if (!Number.isFinite(num)) return 0;
  return negative ? -num : num;
}

export function parseMoneyInputString(
  raw: string,
  options?: { emptyWhenBlank?: boolean }
): string {
  if (!raw || !raw.trim()) {
    return options?.emptyWhenBlank !== false ? "" : "0";
  }
  return String(parseMoneyInput(raw));
}
