import { expect, test } from "@playwright/test";

test("UC-TAX-04 saves and previews an output invoice without marking it issued", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD,
    "Set LIVE_TAX_EMAIL and LIVE_TAX_PASSWORD for the local backend.");
  const login = await request.post("http://127.0.0.1:8080/api/v1/common/auth/login/", {
    data: { email: process.env.LIVE_TAX_EMAIL, password: process.env.LIVE_TAX_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const company = session.companies.find((row: { code: string }) => row.code === "ABC") || session.companies[0];
  await page.addInitScript(({ access, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: access, companyId: company.id, companies: [company],
  })), { access: session.access, company });
  await page.goto(`/sales/invoices?company=${company.id}&period=2026-10`);
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  const number = `TAX04-${String(Date.now()).slice(-8)}`;
  await page.getByLabel("Tên khách hàng hóa đơn").fill(`Khách thử ${number}`);
  await page.getByLabel("Ký hiệu hóa đơn đầu ra").fill("C26TAX");
  await page.getByLabel("Ngày hóa đơn đầu ra").fill("22/10/2026");
  await page.getByLabel("Tên hàng dòng 1").fill("Dịch vụ kiểm thử");
  await page.getByLabel("Đơn giá dòng 1").fill("1000");
  await page.getByLabel("Thuế suất dòng 1").selectOption("10");
  await page.getByRole("button", { name: "Lưu và In" }).click();
  const preview = page.getByRole("dialog", { name: "Xem trước hóa đơn đầu ra" });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Chưa phát hành");
  await expect(preview).toContainText(`Khách thử ${number}`);
  await preview.getByRole("button", { name: "Đóng" }).click();
  const viewList = page.getByRole("button", { name: "Xem danh sách chứng từ" });
  if (await viewList.isVisible()) await viewList.click();
  await expect(page.getByText(`Khách thử ${number}`).first()).toBeVisible();
  await page.getByText(`Khách thử ${number}`).first().click();
  await expect(page.getByLabel("Tên khách hàng hóa đơn")).toHaveValue(`Khách thử ${number}`);
  await page.getByLabel("Tên khách hàng hóa đơn").fill(`Khách thử ${number} sửa`);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: `Khách thử ${number} sửa` });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Phát hành" }).click();
  await expect(page.getByRole("status")).toContainText("Chưa có kết nối hóa đơn điện tử");
  const invoices = await request.get(
    `http://127.0.0.1:8080/api/v1/tax/invoices/?company_id=${company.id}&direction=OUTPUT`,
    { headers: { Authorization: `Bearer ${session.access}` } });
  expect(invoices.ok()).toBeTruthy();
  const body = await invoices.json();
  const rows = Array.isArray(body) ? body : body.results;
  const saved = rows.find((row: { buyer_name: string }) => row.buyer_name === `Khách thử ${number} sửa`);
  expect(saved).toBeTruthy();
  expect(saved.status).toBe("DRAFT");
  expect(saved.invoice_number).toBe("");
});
