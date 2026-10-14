import { test } from "node:test";
import assert from "node:assert/strict";
import { reportAccountSelectorRows } from "../src/report-account-selector-rows.ts";
import { MISA_REPORT_ACCOUNTS } from "../src/misa-report-accounts.ts";

test("saved account selections still resolve legacy IDs after the full chart is added",()=>{
  const rows=reportAccountSelectorRows(["Số tài khoản","Tên tài khoản","Bậc"]);
  assert.equal(rows.find(row=>row.id==="1")?.cells[0],"131");
  assert.equal(rows.find(row=>row.id==="2")?.cells[0],"136");
});

test("the selection table contains every audited account without duplicate row IDs",()=>{
  const rows=reportAccountSelectorRows(["Số tài khoản"]);
  assert.equal(rows.length,MISA_REPORT_ACCOUNTS.length);
  assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
  assert.deepEqual(rows.map(row=>row.cells[0]),MISA_REPORT_ACCOUNTS.map(account=>account.code));
});

test("debit and credit selector variants follow their requested column order",()=>{
  const headers=["Tên tài khoản Có","Số hiệu tài khoản Nợ","Bậc","Tên tài khoản Nợ","Số hiệu tài khoản Có"];
  const account=MISA_REPORT_ACCOUNTS.find(item=>item.level===2)!;
  const row=reportAccountSelectorRows(headers).find(item=>item.cells[1]===account.code)!;
  assert.deepEqual(row.cells,[account.name,account.code,String(account.level),account.name,account.code]);
});
