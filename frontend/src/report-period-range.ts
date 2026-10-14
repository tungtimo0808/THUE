import { formatReportDate } from "./report-date.ts";
export type ReportPeriodMode = "month" | "quarter" | "year" | "custom";
export type ReportComparisonDates = [string,string,string,string];
export function initialComparisonDates(now = new Date()): ReportComparisonDates {
  const value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  return [value,value,value,value];
}
export function reportPeriodLabels(mode:ReportPeriodMode, fromMonth:number, fromYear:number, toMonth:number, toYear:number, dates:ReportComparisonDates): string[] {
  if(mode === "custom") return [0,2].map(index=>`${formatReportDate(dates[index])} - ${formatReportDate(dates[index+1])}`);
  if(![fromMonth,toMonth,fromYear,toYear].every(Number.isInteger) || fromMonth<1 || fromMonth>12 || toMonth<1 || toMonth>12 || fromYear<1900 || toYear>9999) return [];
  const perYear=mode === "month"?12:mode === "quarter"?4:1;
  const first=fromYear*perYear+(mode === "month"?fromMonth-1:mode === "quarter"?Math.floor((fromMonth-1)/3):0);
  const last=toYear*perYear+(mode === "month"?toMonth-1:mode === "quarter"?Math.floor((toMonth-1)/3):0);
  if(last<first) return [];
  return Array.from({length:last-first+1},(_,offset)=>{
    const value=first+offset, year=Math.floor(value/perYear), part=value%perYear+1;
    return mode === "year"?`Năm ${year}`:mode === "quarter"?`Quý ${part}/${year}`:`Thg ${part}/${year}`;
  });
}
