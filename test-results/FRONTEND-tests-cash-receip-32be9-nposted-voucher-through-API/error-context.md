# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: FRONTEND\tests\cash-receipt-mvp.spec.ts >> existing cash receipt form saves an unposted voucher through API
- Location: FRONTEND\tests\cash-receipt-mvp.spec.ts:10:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/cash/transactions", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | const company = "11111111-1111-4111-8111-111111111111";
  4  | const branch = "22222222-2222-4222-8222-222222222222";
  5  | const fund = "33333333-3333-4333-8333-333333333333";
  6  | const currency = "44444444-4444-4444-8444-444444444444";
  7  | const debit = "55555555-5555-4555-8555-555555555555";
  8  | const credit = "66666666-6666-4666-8666-666666666666";
  9  | 
  10 | test("existing cash receipt form saves an unposted voucher through API", async ({ page }) => {
  11 |   await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
  12 |     token: "cash-ui-test", companyId: company,
  13 |     companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  14 |   })), { company });
  15 |   let saved: Record<string, any> | null = null;
  16 |   await page.route("**/api/v1/**", async route => {
  17 |     const url = new URL(route.request().url());
  18 |     const path = url.pathname;
  19 |     if (path === "/api/v1/cash/transactions/" && route.request().method() === "POST") {
  20 |       saved = route.request().postDataJSON();
  21 |       await route.fulfill({ status: 201, json: { ...saved, id: "receipt-1", status: "DRAFT", base_amount: saved?.amount, created_at: new Date().toISOString() } });
  22 |       return;
  23 |     }
  24 |     const data: Record<string, any[]> = {
  25 |       "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  26 |       "/api/v1/cash/funds/": [{ id: fund, company, branch, code: "Q01", name: "Quỹ chính", currency, status: "ACTIVE", balance: "0" }],
  27 |       "/api/v1/organization/branches/": [{ id: branch, name: "Trụ sở chính", code: "HN", status: "ACTIVE" }],
  28 |       "/api/v1/master-data/currencies/": [{ id: currency, code: "VND", name: "Đồng Việt Nam" }],
  29 |       "/api/v1/general-ledger/accounts/": [
  30 |         { id: debit, code: "1111", name: "Tiền mặt", status: "ACTIVE", is_postable: true },
  31 |         { id: credit, code: "711", name: "Thu nhập khác", status: "ACTIVE", is_postable: true },
  32 |       ],
  33 |       "/api/v1/cash/transactions/": saved ? [{ ...saved, id: "receipt-1", status: "DRAFT" }] : [],
  34 |     };
  35 |     await route.fulfill({ json: { results: data[path] || [] } });
  36 |   });
> 37 |   await page.goto("/cash/transactions");
     |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  38 |   await page.getByRole("button", { name: /Thêm thu tiền/ }).first().click();
  39 |   await page.getByRole("button", { name: "Thu tiền", exact: true }).last().click();
  40 |   await expect(page.locator("select[aria-label='Chi nhánh và quỹ tiền mặt']")).toBeAttached();
  41 |   await page.locator(".misa-voucher-type-pill").click();
  42 |   await page.locator(".misa-voucher-type-item").filter({ hasText: "Thu khác" }).click();
  43 |   await page.getByRole("textbox", { name: "Lý do nộp" }).fill("Thu khoản khác");
  44 |   const line = page.locator(".misa-voucher-table tbody tr").first();
  45 |   await line.getByRole("button", { name: "Tài khoản Có" }).click();
  46 |   await page.getByRole("dialog", { name: "Chọn Tài khoản Có" }).getByPlaceholder("Tìm số hoặc tên tài khoản...").fill("711");
  47 |   await page.getByRole("dialog", { name: "Chọn Tài khoản Có" }).getByRole("button", { name: /711/ }).click();
  48 |   await line.locator("td").nth(4).locator("input").fill("100000");
  49 |   await page.getByRole("button", { name: "Lưu", exact: true }).last().click();
  50 |   await expect.poll(() => saved?.business_type).toBe("OTHER_RECEIPT");
  51 |   expect(saved?.receipt_details?.lines).toHaveLength(1);
  52 |   expect(saved?.receipt_details?.lines[0].debit_account).toBe(debit);
  53 |   expect(saved?.receipt_details?.lines[0].credit_account).toBe(credit);
  54 |   await expect(page.getByText("PT00001").first()).toBeVisible();
  55 |   await expect(page.getByText("Chưa ghi sổ").first()).toBeVisible();
  56 | });
  57 | 
```