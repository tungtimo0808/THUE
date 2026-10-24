import { expect, test } from "@playwright/test";

test("live UC-INV-12 alerts render through the inventory chart", async ({ page, request }) => {
  test.skip(!process.env.LIVE_INVENTORY_EMAIL || !process.env.LIVE_INVENTORY_PASSWORD,
    "Set LIVE_INVENTORY_EMAIL and LIVE_INVENTORY_PASSWORD for a read-only backend check.");
  const login = await request.post("http://127.0.0.1:8080/api/v1/common/auth/login/", {
    data: { email: process.env.LIVE_INVENTORY_EMAIL, password: process.env.LIVE_INVENTORY_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const company = session.companies.find((row: { code: string }) => row.code === "ABC");
  expect(company).toBeTruthy();
  const endpoint = `http://127.0.0.1:8080/api/v1/inventory/balances/alerts/?company_id=${company.id}`;
  const response = await request.get(endpoint, { headers: { Authorization: `Bearer ${session.access}` } });
  expect(response.ok()).toBeTruthy();
  const alerts = await response.json();
  await page.addInitScript(({ access, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: access, companyId: company.id, companies: [company],
  })), { access: session.access, company });
  await page.goto("/inventory/chart");
  await expect(page.getByText("Hàng hóa sắp hết hàng").locator("..")).toContainText(String(alerts.low_count));
  await expect(page.getByText("Hàng hóa hết hàng").locator("..")).toContainText(String(alerts.out_count));
  await expect(page.getByText("Số liệu tính đến: Chưa tải")).toHaveCount(0);
  const refreshed = page.waitForResponse((result) => result.url().includes("/inventory/balances/alerts/") && result.ok());
  await page.getByRole("button", { name: "Tải lại" }).first().click();
  await refreshed;
  await expect(page.getByRole("alert")).toHaveCount(0);
});
