import {CASH_PERIODS,cashPeriodDates} from "./cash-report-periods.ts";

export function resolveActiveDatasetYear(fallbackYear = new Date().getFullYear()): number {
  if (typeof window === "undefined") return fallbackYear;
  try {
    const urlPeriod = new URLSearchParams(window.location.search).get("period") || "";
    const urlMatch = urlPeriod.match(/^(20\d{2})/);
    if (urlMatch) return Number(urlMatch[1]);
    const ds = window.localStorage.getItem("ref_dataset") || "";
    const dsMatch = ds.match(/(20\d{2})/);
    if (dsMatch) return Number(dsMatch[1]);
  } catch {
    // ignore storage errors
  }
  return fallbackYear;
}

export function resolveActiveDatasetBookType(): "accounting" | "management" {
  if (typeof window === "undefined") return "accounting";
  try {
    const ds = (window.localStorage.getItem("ref_dataset") || "").toLowerCase();
    if (ds.includes("management") || ds.includes("quan-tri") || ds.includes("quantri")) {
      return "management";
    }
  } catch {
    // ignore
  }
  return "accounting";
}

export function resolveActiveBranchScope(): string {
  if (typeof window === "undefined") return "all";
  try {
    const val = (window.localStorage.getItem("ref_branch") || "all").trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) ? val : "all";
  } catch {
    return "all";
  }
}

export function resolveActiveHeaderPeriod(): string {
  if (typeof window === "undefined") return "";
  try {
    return (new URLSearchParams(window.location.search).get("period") || "").trim();
  } catch {
    return "";
  }
}

export function resolveActivePeriodRange(fallbackYear = new Date().getFullYear()): {
  fromDate: string;
  toDate: string;
  year: number;
  month: number | null;
  quarter: number | null;
} {
  const activeYear = resolveActiveDatasetYear(fallbackYear);
  const urlPeriod = resolveActiveHeaderPeriod();
  const monthMatch = urlPeriod.match(/^(20\d{2})-(\d{2})$/);
  if (monthMatch) {
    const yr = Number(monthMatch[1]);
    const mo = Math.min(12, Math.max(1, Number(monthMatch[2])));
    const lastDay = new Date(yr, mo, 0).getDate();
    const mm = String(mo).padStart(2, "0");
    const dd = String(lastDay).padStart(2, "0");
    return {
      fromDate: `${yr}-${mm}-01`,
      toDate: `${yr}-${mm}-${dd}`,
      year: yr,
      month: mo,
      quarter: null,
    };
  }
  const quarterMatch = urlPeriod.match(/^(20\d{2})-Q([1-4])$/i);
  if (quarterMatch) {
    const yr = Number(quarterMatch[1]);
    const q = Number(quarterMatch[2]);
    const startMo = (q - 1) * 3 + 1;
    const endMo = q * 3;
    const lastDay = new Date(yr, endMo, 0).getDate();
    return {
      fromDate: `${yr}-${String(startMo).padStart(2, "0")}-01`,
      toDate: `${yr}-${String(endMo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      year: yr,
      month: null,
      quarter: q,
    };
  }
  return {
    fromDate: `${activeYear}-01-01`,
    toDate: `${activeYear}-12-31`,
    year: activeYear,
    month: null,
    quarter: null,
  };
}

export function matchesTransactionPeriod(
  value: string,
  period: string,
  today?: Date,
): boolean {
  const parts = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-")
    : /^\d{2}\/\d{2}\/\d{4}$/.test(value)
      ? value.split("/").reverse()
      : [];
  if (!parts.length) return false;
  const [year, month, day] = parts.map(Number),
    date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return false;

  const activeYear = today ? today.getFullYear() : resolveActiveDatasetYear();
  if (year !== activeYear) return false;

  const refToday = today || new Date(activeYear, 11, 31);
  if (CASH_PERIODS.includes(period) && period !== "Tùy chọn") {
    const range=cashPeriodDates(period,refToday);
    if(range){const start=new Date(range[0].split("/").reverse().join("-"));const end=new Date(range[1].split("/").reverse().join("-"));return date>=start&&date<=end;}
  }
  const directMonthMatch = period.match(/^(20\d{2})-(\d{2})$/);
  if (directMonthMatch) {
    return year === Number(directMonthMatch[1]) && month === Number(directMonthMatch[2]);
  }
  const directQuarterMatch = period.match(/^(20\d{2})-Q([1-4])$/i);
  if (directQuarterMatch) {
    return (
      year === Number(directQuarterMatch[1]) &&
      Math.floor((month - 1) / 3) + 1 === Number(directQuarterMatch[2])
    );
  }
  if (period === "ytd") {
    const headerRange = resolveActivePeriodRange(activeYear);
    if (headerRange.month !== null) {
      return year === headerRange.year && month === headerRange.month;
    }
    if (headerRange.quarter !== null) {
      return year === headerRange.year && Math.floor((month - 1) / 3) + 1 === headerRange.quarter;
    }
    return year === activeYear;
  }
  if (period === "year")
    return year === activeYear;
  if (period === "month")
    return year === activeYear && month === refToday.getMonth() + 1;
  if (period === "quarter")
    return (
      year === activeYear &&
      Math.floor((month - 1) / 3) === Math.floor(refToday.getMonth() / 3)
    );
  return year === activeYear;
}
