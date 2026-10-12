import test from 'node:test';import assert from 'node:assert/strict';import {nextCashCode} from '../src/cash-operations.ts';
test('bank vouchers use the correct sequence without colliding with cash voucher codes',()=>{assert.equal(nextCashCode('payment',['UNC00028','PC00999'],'bank'),'UNC00029');assert.equal(nextCashCode('receipt',['NTTK00003','PT00999'],'bank'),'NTTK00004');});
