import { MISA_REPORT_ACCOUNTS } from "./misa-report-accounts.ts";

export function reportAccountSelectorRows(headers: readonly string[]) {
  return MISA_REPORT_ACCOUNTS.map(account=>({
    // Existing saved report selections use these two legacy identifiers.
    id: account.code === "131" ? "1" : account.code === "136" ? "2" : `account:${account.code}`,
    cells: headers.map(header=>
      /^Tên tài khoản/.test(header) ? account.name :
      header === "Bậc" ? String(account.level) :
      /^Số tài khoản|^Số hiệu tài khoản|^Mã tài khoản|^Tài khoản$|^TK$/.test(header) ? account.code : ""
    ),
  }));
}
