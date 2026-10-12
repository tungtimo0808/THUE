import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultCashColumns,readCashColumns} from '../src/cash-columns.ts';
test('cash column preferences retain new fields and reject invalid ids, duplicate order and unsafe widths',()=>{
 const defaults=defaultCashColumns();assert.ok(defaults.some(column=>column.name==='Trường mở rộng 10'));
 const value=readCashColumns(JSON.stringify([{id:5,name:'Nội dung',width:100000,visible:true},{id:5,name:'Lặp',width:0,visible:false},{id:999,name:'Lạ',visible:true}]));
 assert.equal(value[0].id,5);assert.equal(value[0].name,'Nội dung');assert.equal(value[0].width,600);assert.equal(value.length,defaults.length);assert.equal(new Set(value.map(column=>column.id)).size,value.length);
 assert.deepEqual(readCashColumns('{'),defaults);
});

test('custom column profiles use their own defaults without leaking cash-only fields',()=>{
 const bankDefaults=[{id:2,name:'Số tài khoản NH',width:150,visible:true},{id:3,name:'Tên NH thụ hưởng',width:160,visible:false}];
 const result=readCashColumns(JSON.stringify([{id:2,name:'TK ngân hàng',width:20,visible:false},{id:99,name:'Lạ'}]),bankDefaults);
 assert.deepEqual(result,[{id:2,name:'TK ngân hàng',width:60,visible:false},bankDefaults[1]]);
 assert.deepEqual(readCashColumns('{',bankDefaults),bankDefaults);
});
