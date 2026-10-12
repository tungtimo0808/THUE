import {cashCsv} from './cash-operations';
export function downloadCashCsv(filename:string,rows:(string|number)[][]){
 const url=URL.createObjectURL(new Blob(['\uFEFF',cashCsv(rows)],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=filename.endsWith('.csv')?filename:filename+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
