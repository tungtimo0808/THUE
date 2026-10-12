import test from 'node:test';
import assert from 'node:assert/strict';
import {nextCashCode, countCash, forecastCash, cashLedger, cashAdvanceSummary, cashCsv} from '../src/cash-operations.ts';
test('new cash voucher codes do not collide after deletion or with nonsequential imports',()=>{
 assert.equal(nextCashCode('payment',['PC00002','PC00050','PT99999']),'PC00051');
 assert.equal(nextCashCode('receipt',[]),'PT00001');
});
test('cash ledger carries prior movements into opening balance and excludes draft and out-of-period rows',()=>{
 const result=cashLedger([{date:'2026-08-31',kind:'receipt',amount:100},{date:'2026-09-02',kind:'payment',amount:20},{date:'2026-09-03',kind:'receipt',amount:50,status:'draft'},{date:'2026-10-01',kind:'receipt',amount:80}], '2026-09-01','2026-09-30');
 assert.equal(result.opening,100);assert.equal(result.closing,80);assert.equal(result.rows.length,1);
 assert.equal(result.rows[0].balance,80);
});
test('cash advances keep employees separate and subtract refunds',()=>{
 const result=cashAdvanceSummary([{date:'2026-08-31',kind:'payment',amount:100,debit:'141',partner:'A'},{date:'2026-09-02',kind:'payment',amount:50,debit:'141',partner:'A'},{date:'2026-09-03',kind:'receipt',amount:40,credit:'141',partner:'A'},{date:'2026-09-04',kind:'payment',amount:20,debit:'141',partner:'B'}],'2026-09-01','2026-09-30');
 assert.equal(result.find(row=>row.person==='A')?.closing,110);assert.equal(result.find(row=>row.person==='B')?.closing,20);
});
test('cash CSV escapes quotes and newlines and treats formula-like descriptions as text',()=>{
 const csv=cashCsv([['Nội dung','Tiền'],['=1+1',100],['a"b\nc',-10]]);
 assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"a""b\nc"'));assert.ok(csv.includes('"-10"'));
});
test('cash count includes every denomination and rejects negative or fractional note quantities',()=>{
 assert.equal(countCash([{denomination:500000,quantity:2},{denomination:1000,quantity:3}]),1003000);
 assert.throws(()=>countCash([{denomination:1000,quantity:-1}]));
 assert.throws(()=>countCash([{denomination:1000,quantity:1.5}]));
});
test('cash forecast keeps opening, receipts and payments separate',()=>{
 assert.deepEqual(forecastCash([{group:'A',amount:100},{group:'A',amount:50},{group:'B',amount:70},{group:'C',amount:20}]),{opening:150,receipt:70,payment:20,closing:200});
});
test('cash forecast permits an overdrawn opening balance but rejects negative receipt magnitudes',()=>{
 assert.equal(forecastCash([{group:'A',amount:-10},{group:'B',amount:20},{group:'C',amount:17}]).closing,-7);
 assert.throws(()=>forecastCash([{group:'B',amount:-1}]));
});
