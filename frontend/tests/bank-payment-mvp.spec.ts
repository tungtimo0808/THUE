import { expect, test } from "@playwright/test";

const company = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const profile = "33333333-3333-4333-8333-333333333333";
const bankAccount = "44444444-4444-4444-8444-444444444444";
const currency = "55555555-5555-4555-8555-555555555555";
const debit = "66666666-6666-4666-8666-666666666666";
const credit = "77777777-7777-4777-8777-777777777777";

test("existing bank payment form saves an unposted voucher through API", async ({ page }) => {
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "bank-ui-test", companyId: company,
    companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), { company });
  let saved: Record<string, any> | null = null;
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/v1/bank/transactions/" && route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { ...saved, id: "payment-1", status: "DRAFT", base_amount: saved?.amount, created_at: new Date().toISOString() } });
      return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/bank/accounts/": [{ id: profile, account: bankAccount, company, account_number: "19000001", account_name: "ABC", bank_name: "Ngân hàng thử", currency_id: currency, currency_code: "VND", gl_code: "1121", balance: "0" }],
      "/api/v1/master-data/company-bank-accounts/": [{ id: bankAccount, company, branch, account_number: "19000001", status: "ACTIVE", allow_payment: true, currency, gl_account: credit }],
      "/api/v1/organization/branches/": [{ id: branch, name: "Trụ sở chính", code: "HN", status: "ACTIVE" }],
      "/api/v1/general-ledger/accounts/": [
        { id: debit, code: "6421", name: "Chi phí", status: "ACTIVE", is_postable: true },
        { id: credit, code: "1121", name: "Tiền gửi", status: "ACTIVE", is_postable: true },
      ],
      "/api/v1/bank/transactions/": saved ? [{ ...saved, id: "payment-1", status: "DRAFT" }] : [],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
  await page.goto("/bank/transactions");
  await page.getByRole("button", { name: /Thêm chi tiền/ }).first().click();
  await page.getByRole("button", { name: "Chi tiền", exact: true }).last().click();
  await expect(page.locator("select[aria-label='Tài khoản ngân hàng chi']")).toBeAttached();
  await page.locator(".misa-voucher-type-pill").first().click();
  await page.locator(".misa-voucher-type-item").filter({ hasText: /^8\. Chi khác$/ }).click();
  await page.getByRole("checkbox", { name: "Phí ngân hàng tự trích" }).check();
  await page.getByRole("textbox", { name: "Nội dung thanh toán" }).fill("Phí ngân hàng");
  const line = page.locator(".misa-voucher-table tbody tr").first();
  await line.getByRole("button", { name: "Tài khoản Nợ" }).click();
  await page.getByRole("dialog", { name: "Chọn Tài khoản Nợ" }).getByPlaceholder("Tìm số hoặc tên tài khoản...").fill("6421");
  await page.getByRole("dialog", { name: "Chọn Tài khoản Nợ" }).getByRole("button", { name: /6421/ }).click();
  await line.locator("td").nth(4).locator("input").fill("100000");
  await page.getByRole("button", { name: "Lưu", exact: true }).last().click();
  await expect.poll(() => saved?.business_type).toBe("OTHER_PAYMENT");
  expect(saved?.counterparty_name).toBe("Ngân hàng thử");
  expect(saved?.payment_details?.lines[0].debit_account).toBe(debit);
  expect(saved?.payment_details?.lines[0].credit_account).toBe(credit);
  await expect(page.getByText("UNC00001").first()).toBeVisible();
});
