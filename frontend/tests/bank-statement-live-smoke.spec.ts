import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("live UC-BANK-04 preview through the existing bank UI", async ({ page, request }) => {
  test.skip(!process.env.LIVE_BANK_SMOKE_EMAIL || !process.env.LIVE_BANK_SMOKE_PASSWORD,
    "Set LIVE_BANK_SMOKE_EMAIL and LIVE_BANK_SMOKE_PASSWORD for a read-only live preview.");
  const login = await request.post("http://127.0.0.1:8080/api/v1/common/auth/login/", {
    data: { email: process.env.LIVE_BANK_SMOKE_EMAIL, password: process.env.LIVE_BANK_SMOKE_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const company = session.companies.find((item: { code: string }) => item.code === "ABC");
  expect(company).toBeTruthy();
  await page.addInitScript(({ access, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: access, companyId: company.id, companies: [company],
  })), { access: session.access, company });
  await page.goto("/bank/reconciliation");
  await page.getByRole("button", { name: /Đối chiếu với Sổ Việt AI/ }).click();
  await page.getByRole("button", { name: /Thêm kỳ đối chiếu.*Tải tệp sao kê/ }).click();
  const dialog = page.getByRole("dialog", { name: "Nhập sao kê ngân hàng" });
  const account = dialog.getByLabel("Tài khoản ngân hàng");
  const accountValue = await account.locator("option").filter({hasText: "123456789 ·"}).first().getAttribute("value");
  expect(accountValue).toBeTruthy();
  await account.selectOption(accountValue!);
  await dialog.getByLabel("Từ ngày").fill("2026-10-21");
  await dialog.getByLabel("Đến ngày").fill("2026-10-21");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "uc_bank_04_demo.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: readFileSync("../backend/bank_management/fixtures/uc_bank_04_demo.xlsx"),
  });
  await dialog.getByRole("button", { name: "Kiểm tra dữ liệu" }).click();
  await expect(dialog.getByText("2 hợp lệ · 1 lỗi · 0 trùng · 0 nghi trùng")).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Chọn dòng 4" })).toBeDisabled();
});
