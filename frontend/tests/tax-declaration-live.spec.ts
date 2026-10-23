import { expect, test } from "@playwright/test";

test("UC-TAX-08 registers a form and prepares a reviewable VAT declaration in the existing tax screen", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD || !process.env.LIVE_TAX_DECLARATION,
    "Set local login and explicit opt-in; this test creates local tax data.");
  const login = await request.post("http://127.0.0.1:8080/api/v1/common/auth/login/", {
    data: { email: process.env.LIVE_TAX_EMAIL, password: process.env.LIVE_TAX_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const company = session.companies.find((row: { code: string }) => row.code === "ABC");
  expect(company).toBeTruthy();
  const base = `http://127.0.0.1:8080/api/v1/tax`;
  const query = `?company_id=${company.id}`;
  const headers = { Authorization: `Bearer ${session.access}` };
  const period = await request.post(`${base}/periods/${query}`, { headers, data: {
    company: company.id, code: "2026-07", tax_type: "VAT", start_date: "2026-07-01", end_date: "2026-07-31",
  } });
  expect(period.status()).toBe(201);
  const periodId = (await period.json()).id;
  const calculation = await request.post(`${base}/vat-calculations/calculate/${query}`, { headers, data: {
    company: company.id, period: periodId,
  } });
  expect(calculation.status()).toBe(201);

  await page.addInitScript(({ access, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: access, companyId: company.id, companies: [company],
  })), { access: session.access, company });
  await page.goto(`/tax/declarations?company=${company.id}&period=2026-07`);
  await expect(page.getByRole("heading", { name: "Đăng ký tờ khai sử dụng" })).toBeVisible();
  const form = page.getByRole("row", { name: /01\/GTGT - Tờ khai thuế GTGT khấu trừ/ });
  await form.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Hoàn thành" }).click();
  await expect(page.getByText("Đã lưu đăng ký tờ khai sử dụng thành công!")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("row", { name: /01\/GTGT - Tờ khai thuế GTGT khấu trừ/ }).getByRole("checkbox")).toBeChecked();
  await page.getByLabel("Kỳ thuế GTGT").selectOption(periodId);
  await page.getByRole("button", { name: "Lập tờ khai 01/GTGT" }).click();
  const detail = page.getByRole("dialog", { name: "Chi tiết hồ sơ kê khai" });
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("Cần rà soát");
  await expect(detail).toContainText("Còn phải nộp: —");
  await expect(detail.getByRole("button", { name: "Xác nhận hồ sơ" })).toBeDisabled();
  await detail.getByLabel("Ghi chú nội bộ").fill("Kiểm tra nguồn VAT trước khi xác nhận.");
  await detail.getByRole("button", { name: "Lưu nháp" }).click();
  await expect(detail.getByLabel("Ghi chú nội bộ")).toHaveValue("Kiểm tra nguồn VAT trước khi xác nhận.");
  await detail.getByRole("button", { name: "Xem nguồn chỉ tiêu" }).click();
  await expect(detail).toContainText("Nguồn GTGT");
  await detail.getByRole("button", { name: "Lấy lại dữ liệu" }).click();
  await expect(detail.getByRole("button", { name: "Xác nhận hồ sơ" })).toBeDisabled();
});
