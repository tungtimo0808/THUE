import { expect, test } from "@playwright/test";

test("existing bank transfer form saves a draft and posts from the voucher list", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const source = "33333333-3333-4333-8333-333333333333";
  const destination = "44444444-4444-4444-8444-444444444444";
  const gl = "77777777-7777-4777-8777-777777777777";
  let transfer: Record<string, any> | null = null;
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({ token: "transfer-ui-test", companyId: company, companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }] })), { company });
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/v1/bank/transfers/" && route.request().method() === "POST") {
      transfer = { ...route.request().postDataJSON(), id: "transfer-1", status: "DRAFT" };
      await route.fulfill({ status: 201, json: transfer }); return;
    }
    if (path === "/api/v1/bank/transfers/transfer-1/confirm/" && route.request().method() === "POST") {
      transfer = { ...transfer, status: "CONFIRMED" };
      await route.fulfill({ json: transfer }); return;
    }
    if (path === "/api/v1/bank/transfers/transfer-1/") { await route.fulfill({ json: transfer }); return; }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/bank/accounts/": [
        { id: source, company, account_number: "19000001", account_name: "ABC", bank_name: "Techcombank", currency_id: "vnd", currency_code: "VND", branch_id: "branch", gl_account_id: gl, gl_code: "1121", balance: "1000000" },
        { id: destination, company, account_number: "19000002", account_name: "ABC", bank_name: "Vietcombank", currency_id: "vnd", currency_code: "VND", branch_id: "branch", gl_account_id: gl, gl_code: "1121", balance: "0" },
      ],
      "/api/v1/bank/transactions/": [],
      "/api/v1/bank/transfers/": transfer ? [transfer] : [],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
  await page.goto("/bank/transactions");
  await page.getByRole("button", { name: "Thêm chi tiền" }).click();
  await page.getByRole("button", { name: "Chuyển tiền nội bộ" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Hạch toán:")).toBeVisible();
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect.poll(() => transfer?.status).toBe("DRAFT");
  expect(transfer?.source_account).toBe(source);
  expect(transfer?.destination_account).toBe(destination);
  expect(transfer?.details?.lines[0].debit_account).toBe(gl);
  await expect(page.getByText(transfer!.number).first()).toBeVisible();
  await page.getByRole("button", { name: `Chức năng chứng từ ${transfer!.number}` }).click();
  await page.getByRole("menuitem", { name: "Ghi sổ" }).click();
  await expect.poll(() => transfer?.status).toBe("CONFIRMED");
});
