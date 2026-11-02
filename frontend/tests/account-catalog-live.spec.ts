import { test, expect } from "@playwright/test";

const company = "11111111-1111-4111-8111-111111111111";
const chart = "22222222-2222-4222-8222-222222222222";

test("UC-MD-09 account catalog uses the real account API", async ({ page }) => {
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({ token: "test-token", companyId: company, companies: [{ id: company, name: "Công ty A" }], user: { id: "tester" } })), { company });
  let saved: Record<string, unknown> | null = null;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [{ id: company, name: "Công ty A" }] });
    if (path.endsWith("/charts-of-accounts/")) return route.fulfill({ json: [{ id: chart, code: "COA-TT99", name: "Bộ tài khoản TT99", accounting_regime: "TT99", status: "ACTIVE", is_default: true }] });
    if (path.endsWith("/accounts/") && route.request().method() === "POST") { saved = route.request().postDataJSON(); return route.fulfill({ json: { ...saved, id: "33333333-3333-4333-8333-333333333333", version: 1 } }); }
    if (path.endsWith("/accounts/")) return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
  await page.goto("/directory?directory=H%E1%BB%87%20th%E1%BB%91ng%20t%C3%A0i%20kho%E1%BA%A3n");
  await expect(page.getByRole("heading", { name: "Hệ thống tài khoản" })).toBeVisible();
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await page.getByLabel("Số tài khoản").fill("1111");
  await page.getByLabel("Tên tài khoản", { exact: true }).fill("Tiền mặt chi tiết");
  await page.getByLabel("Tên tiếng Anh").fill("Cash detail");
  await page.getByRole("button", { name: "Thực hiện" }).click();
  await expect.poll(() => saved).not.toBeNull();
  expect(saved).toMatchObject({ company, chart_of_accounts: chart, code: "1111", name: "Tiền mặt chi tiết", name_en: "Cash detail", normal_balance: "DEBIT" });
});
