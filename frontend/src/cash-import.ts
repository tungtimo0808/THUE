export type CashImportRecord=Record<string,unknown>;
export type ImportedCashDocument={id:string;code:string;date:string;postDate:string;description:string;kind:'receipt'|'payment';amount:number;debit:string;credit:string;partner:string;partnerCode:string;person:string;address:string;employee:string;status:'draft';bankAccount?:string;rows:{id:string;description:string;debit:string;credit:string;amount:number;partnerCode:string;partnerName:string}[]};
export function cashImportNumber(value:unknown):number{
 if(typeof value==='number')return value;let text=String(value??'').trim().replace(/\s/g,'');if(!text)return NaN;
 if(/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text))text=text.replace(/\./g,'').replace(',','.');else if(/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text))text=text.replace(/,/g,'');else if(/^[-+]?\d+,\d+$/.test(text))text=text.replace(',','.');
 return /^[-+]?\d+(\.\d+)?$/.test(text)?Number(text):NaN;
}
function importDate(value:unknown):string{
 const text=String(value??'').trim();let year:number,month:number,day:number;const dd=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text),iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text);if(dd){day=Number(dd[1]);month=Number(dd[2]);year=Number(dd[3]);}else if(iso){year=Number(iso[1]);month=Number(iso[2]);day=Number(iso[3]);}else return '';const date=new Date(year,month-1,day);return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day?`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:'';
}
export function validateCashImport(input:CashImportRecord[],kind:'receipt'|'payment',existingCodes:string[]){
 const errors:{line:number;code:string;message:string}[]=[],groups=new Map<string,ImportedCashDocument>(),invalid=new Set<string>(),existing=new Set(existingCodes.map(code=>code.trim().toUpperCase()));
 const field=(row:CashImportRecord,key:string)=>String(row[key]??'').trim();
 input.forEach((row,index)=>{const code=field(row,'code'),date=importDate(row.date),postDate=row.postDate?importDate(row.postDate):date,amount=cashImportNumber(row.amount),debit=field(row,'debit'),credit=field(row,'credit');const problems=[];
 if(!code)problems.push('Thiếu số chứng từ');if(existing.has(code.toUpperCase()))problems.push('Số chứng từ đã tồn tại');if(!date||!postDate)problems.push('Ngày không hợp lệ');if(!Number.isFinite(amount)||amount<=0)problems.push('Số tiền phải lớn hơn 0');if(!/^\d{3,9}$/.test(debit)||!/^\d{3,9}$/.test(credit))problems.push('Thiếu hoặc sai tài khoản Nợ/Có');const key=code.toUpperCase();let doc=groups.get(key);
 if(doc&&(doc.date!==date||doc.postDate!==postDate||doc.partnerCode!==field(row,'partnerCode')||doc.bankAccount!==field(row,'bankAccount')))problems.push('Các dòng cùng số chứng từ phải cùng ngày, đối tượng và tài khoản ngân hàng');if(doc&&doc.rows.length>=500)problems.push('Tối đa 500 dòng chi tiết/chứng từ');
 if(problems.length){errors.push({line:index+1,code,message:problems.join('; ')});invalid.add(key);return;}
 if(!doc){doc={id:crypto.randomUUID(),code,date,postDate,description:field(row,'description'),kind,amount:0,debit,credit,partner:field(row,'partnerName')||field(row,'partnerCode'),partnerCode:field(row,'partnerCode'),person:field(row,'person'),address:field(row,'address'),employee:field(row,'employee'),status:'draft',bankAccount:field(row,'bankAccount'),rows:[]};groups.set(key,doc);}
 doc.amount+=amount;doc.rows.push({id:crypto.randomUUID(),description:field(row,'description'),debit,credit,amount,partnerCode:field(row,'partnerCode'),partnerName:field(row,'partnerName')});});
 return {errors,documents:[...groups.entries()].filter(([code])=>!invalid.has(code)).map(([,document])=>document)};
}
