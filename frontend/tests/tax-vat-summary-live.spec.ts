import { expect, test } from "@playwright/test";

test("UC-TAX-07 calculates VAT in the existing deduction modal without sample amounts", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD, "Set local login.");
  test.skip(!process.env.LIVE_VAT_CREATE_PERIOD, "Explicit opt-in: creates a VAT period and calculation in ABC.");
  const login = await request.post("http://127.0.0.1:8080/api/v1/common/auth/login/", {
    data: { email: process.env.LIVE_TAX_EMAIL, password: process.env.LIVE_TAX_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const company = session.companies.find((row: { code: string }) => row.code === "ABC");
  expect(company).toBeTruthy();
  await page.addInitScript(({ access, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: access, companyId: company.id, companies: [company],
  })), { access: session.access, company });
  await page.goto(`/tax/declarations?company=${company.id}&period=2026-09&action=vat-deduction`);
  const modal = page.getByRole("dialog", { name: "Khấu trừ thuế GTGT đầu vào và đầu ra" });
  await expect(modal).toBeVisible();
  await expect(modal).not.toContainText("48.520.000");
  await modal.getByRole("button", { name: "Tạo kỳ tháng 2026-09" }).click();
  await expect(modal.getByLabel("Kỳ thuế GTGT")).toContainText("2026-09");
  await modal.getByRole("button", { name: "Tính lại" }).click();
  await expect(modal).toContainText("Phiên bản 1");
  await expect(modal).toContainText("Chưa cấu hình phương pháp tính thuế GTGT");
  await expect(modal.getByRole("button", { name: "Tạo chứng từ khấu trừ" })).toBeDisabled();
  await modal.getByRole("button", { name: /Xem chi tiết nguồn/ }).click();
  await expect(modal).toContainText("VAT đầu vào");
});
