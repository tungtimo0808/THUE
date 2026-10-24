import { expect, test } from "@playwright/test";

test("live UC-INV-13 opens the ledger through Kho with the real backend", async ({ page, request }) => {
  test.skip(!process.env.LIVE_INVENTORY_EMAIL || !process.env.LIVE_INVENTORY_PASSWORD,
    "Set LIVE_INVENTORY_EMAIL and LIVE_INVENTORY_PASSWORD for a read-only backend check.");
  const login = await request.post("http://127.0.0.1:8080/api/v1/common/auth/login/", {
    data: { email: process.env.LIVE_INVENTORY_EMAIL, password: process.env.LIVE_INVENTORY_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const company = session.companies.find((row: { code: string }) => row.code === "ABC");
  expect(company).toBeTruthy();
  const headers = { Authorization: `Bearer ${session.access}` };
  const itemsResponse = await request.get(`http://127.0.0.1:8080/api/v1/master-data/items/?company_id=${company.id}`, { headers });
  expect(itemsResponse.ok()).toBeTruthy();
  const items = await itemsResponse.json();
  const item = items.find((row: { status: string; track_inventory: boolean }) => row.status === "ACTIVE" && row.track_inventory);
  expect(item).toBeTruthy();
  await page.addInitScript(({ access, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: access, companyId: company.id, companies: [company],
  })), { access: session.access, company });
  await page.goto("/inventory/reports");
  await page.getByText("Báo cáo chi tiết kho", { exact: true }).click();
  await page.getByText("Sổ chi tiết vật tư hàng hóa", { exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Chọn tham số sổ chi tiết" });
  await dialog.getByLabel("Tìm vật tư, hàng hóa").fill(item.code);
  await dialog.getByText(`${item.code} · ${item.name}`).locator("..").locator("input").check();
  await dialog.getByLabel("Từ ngày").fill("2026-01-01");
  await dialog.getByLabel("Đến ngày").fill("2026-12-31");
  const responsePromise = page.waitForResponse((response) => response.url().includes("/inventory/balances/detail-ledger/") && response.status() === 200);
  await dialog.getByRole("button", { name: "Xem báo cáo" }).click();
  const response = await responsePromise;
  const report = await response.json();
  expect(report.item_ids).toContain(item.id);
  await expect(page.getByText("Sổ chi tiết vật tư hàng hóa", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Không có dữ liệu phù hợp với điều kiện đã chọn.")).toHaveCount(report.groups.length ? 0 : 1);
});
