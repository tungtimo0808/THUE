import { expect, test } from "@playwright/test";

test("UC-TAX-10 runs both existing reconciliation reports against live sources", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_RECONCILIATION || !process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD,
    "Requires a temporary VAT period and explicit opt-in.");
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
  await page.getByText("Báo cáo đối chiếu", { exact: true }).click();
  await page.getByText("Bảng đối chiếu bảng kê thuế GTGT và sổ cái", { exact: true }).click();
  const vat = page.getByRole("dialog", { name: "Bảng đối chiếu bảng kê thuế GTGT và sổ cái" });
  await expect(vat.getByLabel("Kỳ đối chiếu")).toContainText("TAX10-UI-2026-10");
  await vat.getByRole("button", { name: "Chạy đối chiếu" }).click();
  await expect(vat.getByText("Chưa có nguồn VAT Ledger/kết quả UC-TAX-07 đủ để đối chiếu.")).toBeVisible();
  await expect(vat.getByText("Thiếu nguồn").first()).toBeVisible();
  const download = page.waitForEvent("download");
  await vat.getByRole("button", { name: "Xuất CSV" }).click();
  expect((await download).suggestedFilename()).toContain("doi-chieu-thue-vat_gl-TAX10-UI-2026-10.csv");
  await vat.getByRole("button", { name: "Đóng đối chiếu" }).click();
  await page.getByText("Bảng đối chiếu số thuế đã nộp và số thuế phải nộp", { exact: true }).click();
  const payment = page.getByRole("dialog", { name: "Bảng đối chiếu số thuế đã nộp và số thuế phải nộp" });
  await payment.getByRole("button", { name: "Chạy đối chiếu" }).click();
  await expect(payment.getByText("Chưa có nghĩa vụ thuế trong kỳ; không thể kết luận các nguồn khớp nhau.")).toBeVisible();
  await expect(payment.getByText("Cần rà soát").first()).toBeVisible();
});
