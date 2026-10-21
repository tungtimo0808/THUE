import { expect, test } from "@playwright/test";

const company = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const fund = "33333333-3333-4333-8333-333333333333";
const currency = "44444444-4444-4444-8444-444444444444";
const debit = "55555555-5555-4555-8555-555555555555";
const credit = "66666666-6666-4666-8666-666666666666";

test("existing cash receipt form saves an unposted voucher through API", async ({ page }) => {
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "cash-ui-test", companyId: company,
    companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), { company });
  let saved: Record<string, any> | null = null;
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/v1/cash/transactions/" && route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { ...saved, id: "receipt-1", status: "DRAFT", base_amount: saved?.amount, created_at: new Date().toISOString() } });
      return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/cash/funds/": [{ id: fund, company, branch, code: "Q01", name: "Quỹ chính", currency, status: "ACTIVE", balance: "0" }],
      "/api/v1/organization/branches/": [{ id: branch, name: "Trụ sở chính", code: "HN", status: "ACTIVE" }],
      "/api/v1/master-data/currencies/": [{ id: currency, code: "VND", name: "Đồng Việt Nam" }],
      "/api/v1/general-ledger/accounts/": [
        { id: debit, code: "1111", name: "Tiền mặt", status: "ACTIVE", is_postable: true },
        { id: credit, code: "711", name: "Thu nhập khác", status: "ACTIVE", is_postable: true },
      ],
      "/api/v1/cash/transactions/": saved ? [{ ...saved, id: "receipt-1", status: "DRAFT" }] : [],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
  await page.goto("/cash/transactions");
  await page.getByRole("button", { name: /Thêm thu tiền/ }).first().click();
  await page.getByRole("button", { name: "Thu tiền", exact: true }).last().click();
  await expect(page.getByRole("combobox", { name: "Chi nhánh và quỹ tiền mặt" })).toBeVisible();
  await page.locator(".misa-voucher-type-pill").click();
  await page.locator(".misa-voucher-type-item").filter({ hasText: "Thu khác" }).click();
  await page.getByRole("textbox", { name: "Lý do nộp" }).fill("Thu khoản khác");
  const line = page.locator(".misa-voucher-table tbody tr").first();
  await line.getByRole("button", { name: "Tài khoản Có" }).click();
  await page.getByRole("dialog", { name: "Chọn Tài khoản Có" }).getByPlaceholder("Tìm số hoặc tên tài khoản...").fill("711");
  await page.getByRole("dialog", { name: "Chọn Tài khoản Có" }).getByRole("button", { name: /711/ }).click();
  await line.locator("td").nth(4).locator("input").fill("100000");
  await page.getByRole("button", { name: "Lưu", exact: true }).last().click();
  await expect.poll(() => saved?.business_type).toBe("OTHER_RECEIPT");
  expect(saved?.receipt_details?.lines).toHaveLength(1);
  expect(saved?.receipt_details?.lines[0].debit_account).toBe(debit);
  expect(saved?.receipt_details?.lines[0].credit_account).toBe(credit);
  await expect(page.getByText("PT00001").first()).toBeVisible();
  await expect(page.getByText("Chưa ghi sổ").first()).toBeVisible();
});
