import test from 'node:test';import assert from 'node:assert/strict';
import {validateCashImport,cashImportNumber} from '../src/cash-import.ts';
test('cash import validates dates, amounts and existing codes before grouping voucher details',()=>{
 const rows=[{code:'PT00999',date:'10/10/2026',description:'Dòng 1',amount:'1.250.000',debit:'111',credit:'131'},{code:'PT00999',date:'10/10/2026',description:'Dòng 2',amount:'500000',debit:'111',credit:'711'}];
 const result=validateCashImport(rows,'receipt',[]);assert.equal(result.errors.length,0);assert.equal(result.documents.length,1);assert.equal(result.documents[0].amount,1750000);assert.equal(result.documents[0].rows.length,2);assert.equal(result.documents[0].status,'draft');
 assert.equal(validateCashImport(rows,'receipt',['PT00999']).documents.length,0);
 assert.equal(validateCashImport([{...rows[0],date:'31/02/2026'}],'receipt',[]).documents.length,0);
 assert.equal(validateCashImport([{...rows[0],amount:'-1'}],'receipt',[]).documents.length,0);
 assert.equal(cashImportNumber('1.234,50'),1234.5);
});
test('cash import rejects an entire voucher when one detail fails and limits it to 500 details',()=>{
 const good={code:'PC00999',date:'10/10/2026',amount:100,debit:'642',credit:'111'};
 assert.equal(validateCashImport([good,{...good,amount:'x'}],'payment',[]).documents.length,0);
 assert.equal(validateCashImport(Array.from({length:501},()=>good),'payment',[]).documents.length,0);
});
import * as XLSX from 'xlsx';
test('both XLSX and XLS files preserve mapped dates and voucher detail totals',()=>{
 const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Số chứng từ','Ngày chứng từ','Diễn giải','TK Nợ','TK Có','Số tiền'],['PT09998','10/10/2026','Dòng 1','111','131',1250000],['PT09998','10/10/2026','Dòng 2','111','711',500000]]),'Chung-tu');
 for(const bookType of ['xlsx','biff8'] as const){const buffer=XLSX.write(workbook,{type:'array',bookType});const parsed=XLSX.read(buffer,{type:'array',cellFormula:false,cellHTML:false,dateNF:'dd/mm/yyyy'});const values=XLSX.utils.sheet_to_json<unknown[]>(parsed.Sheets['Chung-tu'],{header:1,raw:false,defval:''});const rows=values.slice(1).map(row=>({code:row[0],date:row[1],description:row[2],debit:row[3],credit:row[4],amount:row[5]}));const result=validateCashImport(rows,'receipt',[]);assert.equal(result.errors.length,0);assert.equal(result.documents[0].amount,1750000);assert.equal(result.documents[0].date,'2026-10-10');}
});
test('bank import retains the chosen bank account in frontend voucher data',()=>{const result=validateCashImport([{code:'NTTK00999',date:'11/10/2026',amount:100,debit:'1121',credit:'131',bankAccount:'DEMO-001'}],'receipt',[]);assert.equal(result.documents[0].bankAccount,'DEMO-001');});
test('bank import does not partially combine vouchers posted to different bank accounts',()=>{const row={code:'NTTK00998',date:'11/10/2026',amount:100,debit:'1121',credit:'131'};assert.equal(validateCashImport([{...row,bankAccount:'DEMO-001'},{...row,bankAccount:'DEMO-002'}],'receipt',[]).documents.length,0);});
