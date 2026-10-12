import {auditedPeriodRange} from './audited-report-parameters.ts';
import {MISA_REPORT_DEFINITIONS} from './misa-report-definitions.ts';
import {cashDateValue} from './cash-date.ts';
export const CASH_PERIODS=MISA_REPORT_DEFINITIONS.find(report=>report.name==='Dòng tiền')?.options?.['Kỳ báo cáo']||['Tháng này','Tháng trước','Quý này','Quý trước','Năm nay','Năm trước','Tùy chọn'];
export function cashPeriodDates(preset:string,today=new Date()):[string,string]|null{
 if(!CASH_PERIODS.includes(preset)||preset==='Tùy chọn')return null;
 const [from,to]=auditedPeriodRange(preset,today);return [from.split('-').reverse().join('/'),to.split('-').reverse().join('/')];
}
export function cashPeriodSubtitle(from:string,to:string):string{
 const start=new Date(cashDateValue(from)),end=new Date(cashDateValue(to));
 if(Number.isFinite(start.getTime())&&Number.isFinite(end.getTime())&&start.getDate()===1&&start.getFullYear()===end.getFullYear()&&start.getMonth()===end.getMonth()&&end.getDate()===new Date(end.getFullYear(),end.getMonth()+1,0).getDate())return `Tháng ${start.getMonth()+1} năm ${start.getFullYear()}`;
 return `Từ ngày ${from} đến ngày ${to}`;
}
