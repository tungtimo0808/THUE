import { expect, test } from "@playwright/test";

test("confirms an offline bank period and prevents selecting confirmed vouchers", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const account = "33333333-3333-4333-8333-333333333333";
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "bank-period-test", companyId: company,
    companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), { company });
  let confirmed = false;
  let submitted: Record<string, any> | null = null;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/bank/reconciliation-periods/preview/") {
      await route.fulfill({ json: { opening_balance: "40", last_confirmed_date: confirmed ? "2026-10-08" : null,
        has_statement: true, unmatched_count: 0,
        transactions: [
          { id: "receipt-1", date: "2026-10-01", number: "BC-001", amount: "100", direction: "RECEIPT", counterparty: "Khách A", confirmed },
          { id: "payment-1", date: "2026-10-02", number: "UNC-001", amount: "25", direction: "PAYMENT", counterparty: "Nhà cung cấp B", confirmed },
        ] } }); return;
    }
    if (path === "/api/v1/bank/reconciliation-periods/confirm/") {
      submitted = route.request().postDataJSON(); confirmed = true;
      await route.fulfill({ status: 201, json: { id: "period-1", closing_balance: "115", confirmed_at: "2026-10-20T00:00:00Z" } }); return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/bank/accounts/": [{ id: account, account_number: "123456789", bank_name: "Techcombank", currency_code: "VND" }],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
  await page.goto("/bank/reconciliation");
  await page.getByRole("button", { name: "Đối chiếu offline" }).click();
  await page.getByLabel("TK ngân hàng").selectOption(account);
  await page.getByRole("button", { name: "Lấy dữ liệu" }).click();
  await expect(page.getByRole("row", { name: /BC-001/ })).toBeVisible();
  await page.getByLabel("Đối chiếu BC-001").check();
  await page.getByLabel("Đối chiếu UNC-001").check();
  await page.locator("#br-statement").fill("115");
  await expect(page.getByText("115", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận đối chiếu" }).click();
  await expect.poll(() => submitted?.transactions?.length).toBe(2);
  await expect(page.getByText("Ngày đối chiếu gần nhất: 08/10/2026")).toBeVisible();
  await expect(page.getByLabel("Đối chiếu BC-001")).toBeDisabled();
});
