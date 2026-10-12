import {CASH_PERIODS,cashPeriodDates} from "./cash-report-periods.ts";
export function matchesTransactionPeriod(
  value: string,
  period: string,
  today = new Date(),
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
  if (CASH_PERIODS.includes(period) && period !== "Tùy chọn") {
    const range=cashPeriodDates(period,today);
    if(range){const start=new Date(range[0].split("/").reverse().join("-"));const end=new Date(range[1].split("/").reverse().join("-"));return date>=start&&date<=end;}
  }
  if (period === "ytd")
    return (
      year === today.getFullYear() &&
      date <= new Date(today.getFullYear(), today.getMonth(), today.getDate())
    );
  if (period === "month")
    return year === today.getFullYear() && month === today.getMonth() + 1;
  if (period === "quarter")
    return (
      year === today.getFullYear() &&
      Math.floor((month - 1) / 3) === Math.floor(today.getMonth() / 3)
    );
  if (period === "year") return year === today.getFullYear();
  return true;
}
