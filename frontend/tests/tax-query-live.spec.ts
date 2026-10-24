import { expect, test } from "@playwright/test";

test("UC-TAX-06 searches and opens the real invoice detail in the existing workspace", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD, "Set local login.");
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
  const headers = { Authorization: `Bearer ${session.access}` };
  const result = await request.get(`http://127.0.0.1:8080/api/v1/tax/invoices/query/?company_id=${company.id}&page_size=1`, { headers });
  expect(result.ok()).toBeTruthy();
  const data = await result.json();
  await page.goto(`/invoices/lookup?company=${company.id}&period=2026-10`);
  await expect(page.getByRole("heading", { name: "Tra cứu hóa đơn" })).toBeVisible();
  await expect(page.locator(".il-count")).toContainText(`${data.count} hóa đơn`);
  if (data.results.length && data.results[0].invoice_number) {
    const invoice = data.results[0];
    await page.getByLabel("Tìm hóa đơn").fill(invoice.invoice_number);
    await expect(page.locator(".il-count")).toContainText("hóa đơn");
    await page.getByRole("button", { name: invoice.invoice_number }).first().click();
    const detail = page.getByRole("dialog", { name: "Chi tiết hóa đơn" });
    await expect(detail).toContainText(invoice.id);
    await expect(detail).toContainText("Chưa xác định trạng thái kế toán");
    await detail.getByRole("button", { name: "Đóng" }).click();
    await page.getByLabel("Tìm hóa đơn").fill("");
    await page.getByLabel("Số hóa đơn", { exact: true }).fill(invoice.invoice_number);
    await expect(page.locator(".il-count")).toContainText("hóa đơn");
    await page.getByLabel("Số hóa đơn", { exact: true }).fill("");
    await page.getByLabel("Tìm hóa đơn").fill("UC06-NO-SUCH-INVOICE");
    await expect(page.getByText("Không có hóa đơn phù hợp.")).toBeVisible();
  }
  for (const [path, title] of [["outgoing", "Hóa đơn đầu ra"], ["pending", "Hóa đơn cần xử lý"],
    ["issuance", "Trạng thái phát hành"]]) {
    await page.goto(`/invoices/${path}?company=${company.id}&period=2026-10`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator(".il-count")).toContainText("hóa đơn");
  }
  await page.goto(`/invoices/unposted?company=${company.id}&period=2026-10`);
  await expect(page.getByText(/Chưa có nguồn trạng thái hạch toán được xác minh/)).toBeVisible();
});
