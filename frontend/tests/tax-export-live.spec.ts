import { expect, test } from "@playwright/test";

test("UC-TAX-12 exports and re-downloads an internal obligation XLSX", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_EXPORT || !process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD,
    "Requires a temporary obligation fixture and explicit opt-in.");
  const login = await request.post("http://127.0.0.1:8080/api/v1/common/auth/login/", {
    data: { email: process.env.LIVE_TAX_EMAIL, password: process.env.LIVE_TAX_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const company = session.companies.find((item: { code: string }) => item.code === "ABC");
  expect(company).toBeTruthy();
  await page.addInitScript(({ access, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: access, companyId: company.id, companies: [company],
  })), { access: session.access, company });
  await page.goto(`/tax/reports?company=${company.id}`);
  await expect(page.getByRole("heading", { name: "Xuất dữ liệu thuế" })).toBeVisible();
  await page.getByLabel("Kỳ xuất dữ liệu").selectOption({ label: "TAX12-UI-2026-10 · VAT" });
  await page.getByLabel("Loại dữ liệu xuất").selectOption("TAX_OBLIGATION");
  const firstDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel" }).first().click();
  expect((await firstDownload).suggestedFilename()).toMatch(/thue-tax_obligation-TAX12-UI-2026-10\.xlsx/);
  await expect(page.getByRole("status")).toContainText("1 dòng");
  await expect(page.getByRole("row", { name: /Nghĩa vụ thuế TAX12-UI-2026-10/ })).toContainText("Chưa nộp");
  await page.reload();
  const secondDownload = page.waitForEvent("download");
  await page.getByRole("row", { name: /Nghĩa vụ thuế TAX12-UI-2026-10/ }).getByRole("button", { name: "Tải XLSX" }).click();
  expect((await secondDownload).suggestedFilename()).toMatch(/thue-tax_obligation-TAX12-UI-2026-10\.xlsx/);
});
