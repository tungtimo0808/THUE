export function nextCashCode(kind:'receipt'|'payment', codes:string[],category:'cash'|'bank'='cash'):string {
 const prefix=category==='bank'?(kind==='receipt'?'NTTK':'UNC'):(kind==='receipt'?'PT':'PC');
 const max=codes.reduce((highest,code)=>{const match=new RegExp(`^${prefix}(\\d+)$`).exec(code);return match?Math.max(highest,Number(match[1])):highest;},0);
 return prefix+String(max+1).padStart(5,'0');
}
export function countCash(rows:{denomination:number;quantity:number}[]):number {
 return rows.reduce((sum,row)=>{
  if(!Number.isFinite(row.denomination)||row.denomination<=0||!Number.isInteger(row.quantity)||row.quantity<0)throw Error('Mệnh giá phải lớn hơn 0; số lượng phải là số nguyên không âm.');
  return sum+row.denomination*row.quantity;
 },0);
}
export type ForecastEntry={group:'A'|'B'|'C';amount:number};
export function forecastCash(rows:ForecastEntry[]){
 const totals={opening:0,receipt:0,payment:0,closing:0};
 for(const row of rows){if(!Number.isFinite(row.amount)||(row.group!=='A'&&row.amount<0))throw Error('Số tiền thu/chi dự báo phải không âm.');if(row.group==='A')totals.opening+=row.amount;else if(row.group==='B')totals.receipt+=row.amount;else totals.payment+=row.amount;}
 totals.closing=totals.opening+totals.receipt-totals.payment;return totals;
}
export interface CashEntry {date:string;kind:string;amount:number;code?:string;description?:string;partner?:string;person?:string;debit?:string;credit?:string;status?:string;}
export function cashLedger(entries:CashEntry[],from:string,to:string,initialBalance=0){
 const posted=entries.filter(row=>row.status!=='draft');
 const signed=(row:CashEntry)=>row.kind==='receipt'?row.amount:-row.amount;
 const opening=initialBalance+posted.filter(row=>row.date<from).reduce((sum,row)=>sum+signed(row),0);
 let balance=opening;
 const rows=posted.filter(row=>row.date>=from&&row.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||(a.code||'').localeCompare(b.code||'')).map(row=>{balance+=signed(row);return {...row,receipt:row.kind==='receipt'?row.amount:0,payment:row.kind==='receipt'?0:row.amount,balance};});
 return {opening,rows,receipt:rows.reduce((sum,row)=>sum+row.receipt,0),payment:rows.reduce((sum,row)=>sum+row.payment,0),closing:balance};
}
export function cashAdvanceSummary(entries:CashEntry[],from:string,to:string){
 const groups=new Map<string,{person:string;opening:number;advance:number;refund:number;closing:number}>();
 for(const row of entries){if(row.status==='draft'||row.date>to)continue;const amount=row.debit?.startsWith('141')?row.amount:row.credit?.startsWith('141')?-row.amount:0;if(!amount)continue;
  const person=row.partner||row.person||'Chưa chọn nhân viên',group=groups.get(person)||{person,opening:0,advance:0,refund:0,closing:0};
  if(row.date<from)group.opening+=amount;else if(amount>0)group.advance+=amount;else group.refund-=amount;
  group.closing=group.opening+group.advance-group.refund;groups.set(person,group);
 }
 return [...groups.values()];
}
export function cashCsv(rows:(string|number)[][]):string {
 return rows.map(row=>row.map(value=>{const text=typeof value==='string'&&/^[\s]*[=+@-]/.test(value)?"'"+value:String(value);return '"'+text.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
}
