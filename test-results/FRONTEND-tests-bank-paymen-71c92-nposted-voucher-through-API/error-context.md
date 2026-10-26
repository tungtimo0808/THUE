# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: FRONTEND\tests\bank-payment-mvp.spec.ts >> existing bank payment form saves an unposted voucher through API
- Location: FRONTEND\tests\bank-payment-mvp.spec.ts:11:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/bank/transactions", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | const company = "11111111-1111-4111-8111-111111111111";
  4  | const branch = "22222222-2222-4222-8222-222222222222";
  5  | const profile = "33333333-3333-4333-8333-333333333333";
  6  | const bankAccount = "44444444-4444-4444-8444-444444444444";
  7  | const currency = "55555555-5555-4555-8555-555555555555";
  8  | const debit = "66666666-6666-4666-8666-666666666666";
  9  | const credit = "77777777-7777-4777-8777-777777777777";
  10 | 
  11 | test("existing bank payment form saves an unposted voucher through API", async ({ page }) => {
  12 |   await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
  13 |     token: "bank-ui-test", companyId: company,
  14 |     companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  15 |   })), { company });
  16 |   let saved: Record<string, any> | null = null;
  17 |   await page.route("**/api/v1/**", async route => {
  18 |     const url = new URL(route.request().url());
  19 |     const path = url.pathname;
  20 |     if (path === "/api/v1/bank/transactions/" && route.request().method() === "POST") {
  21 |       saved = route.request().postDataJSON();
  22 |       await route.fulfill({ status: 201, json: { ...saved, id: "payment-1", status: "DRAFT", base_amount: saved?.amount, created_at: new Date().toISOString() } });
  23 |       return;
  24 |     }
  25 |     const data: Record<string, any[]> = {
  26 |       "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  27 |       "/api/v1/bank/accounts/": [{ id: profile, account: bankAccount, company, account_number: "19000001", account_name: "ABC", bank_name: "Ngân hàng thử", currency_id: currency, currency_code: "VND", gl_code: "1121", balance: "0" }],
  28 |       "/api/v1/master-data/company-bank-accounts/": [{ id: bankAccount, company, branch, account_number: "19000001", status: "ACTIVE", allow_payment: true, currency, gl_account: credit }],
  29 |       "/api/v1/organization/branches/": [{ id: branch, name: "Trụ sở chính", code: "HN", status: "ACTIVE" }],
  30 |       "/api/v1/general-ledger/accounts/": [
  31 |         { id: debit, code: "6421", name: "Chi phí", status: "ACTIVE", is_postable: true },
  32 |         { id: credit, code: "1121", name: "Tiền gửi", status: "ACTIVE", is_postable: true },
  33 |       ],
  34 |       "/api/v1/bank/transactions/": saved ? [{ ...saved, id: "payment-1", status: "DRAFT" }] : [],
  35 |     };
  36 |     await route.fulfill({ json: { results: data[path] || [] } });
  37 |   });
> 38 |   await page.goto("/bank/transactions");
     |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  39 |   await page.getByRole("button", { name: /Thêm chi tiền/ }).first().click();
  40 |   await page.getByRole("button", { name: "Chi tiền", exact: true }).last().click();
  41 |   await expect(page.locator("select[aria-label='Tài khoản ngân hàng chi']")).toBeAttached();
  42 |   await page.locator(".misa-voucher-type-pill").first().click();
  43 |   await page.locator(".misa-voucher-type-item").filter({ hasText: /^8\. Chi khác$/ }).click();
  44 |   await page.getByRole("checkbox", { name: "Phí ngân hàng tự trích" }).check();
  45 |   await page.getByRole("textbox", { name: "Nội dung thanh toán" }).fill("Phí ngân hàng");
  46 |   const line = page.locator(".misa-voucher-table tbody tr").first();
  47 |   await line.getByRole("button", { name: "Tài khoản Nợ" }).click();
  48 |   await page.getByRole("dialog", { name: "Chọn Tài khoản Nợ" }).getByPlaceholder("Tìm số hoặc tên tài khoản...").fill("6421");
  49 |   await page.getByRole("dialog", { name: "Chọn Tài khoản Nợ" }).getByRole("button", { name: /6421/ }).click();
  50 |   await line.locator("td").nth(4).locator("input").fill("100000");
  51 |   await page.getByRole("button", { name: "Lưu", exact: true }).last().click();
  52 |   await expect.poll(() => saved?.business_type).toBe("OTHER_PAYMENT");
  53 |   expect(saved?.counterparty_name).toBe("Ngân hàng thử");
  54 |   expect(saved?.payment_details?.lines[0].debit_account).toBe(debit);
  55 |   expect(saved?.payment_details?.lines[0].credit_account).toBe(credit);
  56 |   await expect(page.getByText("UNC00001").first()).toBeVisible();
  57 | });
  58 | 
```