export function currentCashDate(now = new Date()): string {
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

export function cashDateRange(period: string, now = new Date()): [string, string] | null {
  const year = now.getFullYear(), month = now.getMonth(), day = now.getDate();
  let from = new Date(year, month, day), to = new Date(year, month, day);
  if (period === 'Tùy chọn') return null;
  const explicitQuarter = /^Quý ([1-4])$/.exec(period);
  const explicitMonth = /^Tháng (\d{1,2})$/.exec(period);
  const explicitYear = /^Năm (\d{4})$/.exec(period);
  if(explicitQuarter){const m=(Number(explicitQuarter[1])-1)*3;return [currentCashDate(new Date(year,m,1)),currentCashDate(new Date(year,m+3,0))];}
  if(explicitMonth&&Number(explicitMonth[1])>=1&&Number(explicitMonth[1])<=12){const m=Number(explicitMonth[1])-1;return [currentCashDate(new Date(year,m,1)),currentCashDate(new Date(year,m+1,0))];}
  if(explicitYear){const y=Number(explicitYear[1]);return [currentCashDate(new Date(y,0,1)),currentCashDate(new Date(y,11,31))];}
  if (period === 'Tuần này') {
    from.setDate(day - (now.getDay() + 6) % 7);
    to = new Date(from); to.setDate(from.getDate() + 6);
  } else if (period === 'Tháng này' || period === 'Tháng trước') {
    const offset = period === 'Tháng trước' ? -1 : 0;
    from = new Date(year, month + offset, 1); to = new Date(year, month + offset + 1, 0);
  } else if (period === 'Quý này' || period === 'Quý trước') {
    const startMonth = Math.floor(month / 3) * 3 - (period === 'Quý trước' ? 3 : 0);
    from = new Date(year, startMonth, 1); to = new Date(year, startMonth + 3, 0);
  } else if (period === 'Năm nay' || period === 'Năm trước') {
    const selectedYear = year - (period === 'Năm trước' ? 1 : 0);
    from = new Date(selectedYear, 0, 1); to = new Date(selectedYear, 11, 31);
  } else if (period === 'Đầu năm tới hiện tại' || period === 'Đầu năm đến hiện tại') {
    from = new Date(year, 0, 1);
  } else if(period!=='Hôm nay') return null;
  return [currentCashDate(from), currentCashDate(to)];
}

export function cashDateValue(text: string): number {
  const parts = /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.split('-')
    : /^\d{2}\/\d{2}\/\d{4}$/.test(text) ? text.split('/').reverse() : [];
  if(parts.length!==3)return NaN;
  const [year,month,day]=parts.map(Number), date=new Date(year,month-1,day);
  return date.getFullYear()===year && date.getMonth()===month-1 && date.getDate()===day
    ? date.getTime() : NaN;
}
export function isCashDateInRange(date:string,from:string,to:string): boolean {
  const value=cashDateValue(date),start=cashDateValue(from),end=cashDateValue(to);
  return Number.isFinite(value)&&Number.isFinite(start)&&Number.isFinite(end)&&start<=end&&value>=start&&value<=end;
}
