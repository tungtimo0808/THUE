import { expect, test } from "@playwright/test";

test("UC-TAX-11 saves an unverified provider configuration on the existing screen", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_CONNECTOR || !process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD,
    "Requires local API and explicit opt-in.");
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
  await page.goto(`/invoices/meinvoice?company=${company.id}`);
  await expect(page.getByRole("heading", { name: /Kết nối phần mềm/ })).toBeVisible();
  await expect(page.getByLabel("Mật khẩu")).toHaveCount(0);
  await page.getByLabel("Mã nhà cung cấp").fill("TAX11-UI-DEMO");
  await page.getByLabel("Tên nhà cung cấp").fill("Nhà cung cấp thử nghiệm");
  await page.getByLabel("Kênh kết nối").selectOption("TVAN");
  await page.getByLabel("Tham chiếu credential").fill("vault:tax11-demo");
  await page.getByLabel("Phiên bản connector").fill("v1");
  await page.getByLabel("Đồng bộ hóa đơn đầu vào").check();
  await page.getByRole("button", { name: "Lưu cấu hình" }).click();
  await expect(page.getByRole("status")).toContainText("Chưa xác thực với nhà cung cấp");
  await expect(page.getByText("Chưa kích hoạt")).toBeVisible();
  await page.reload();
  await page.getByLabel("Cấu hình kết nối").selectOption({ label: "TAX11-UI-DEMO · Nhà cung cấp thử nghiệm" });
  await expect(page.getByLabel("Tham chiếu credential")).toHaveValue("vault:tax11-demo");
  await expect(page.getByLabel("Đồng bộ hóa đơn đầu vào")).toBeChecked();
  const response = await request.get(`http://127.0.0.1:8080/api/v1/tax/connectors/?company_id=${company.id}`, {
    headers: { Authorization: `Bearer ${session.access}` },
  });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const connector = (Array.isArray(data) ? data : data.results).find((item: { code: string }) => item.code === "TAX11-UI-DEMO");
  expect(connector.is_active).toBe(false);
  expect(connector.connection_status).toBe("INACTIVE");
  await page.goto(`/invoices/sync?company=${company.id}`);
  await expect(page.getByRole("heading", { name: "Tự động lấy hóa đơn từ TCT" })).toBeVisible();
  await expect(page.getByText(/TAX11-UI-DEMO · Nhà cung cấp thử nghiệm · Chưa kích hoạt/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Đến hộp hóa đơn đầu vào" })).toHaveAttribute("href", /invoices\/incoming\/inbox/);
  const removed = await request.delete(`http://127.0.0.1:8080/api/v1/tax/connectors/${connector.id}/?company_id=${company.id}`, {
    headers: { Authorization: `Bearer ${session.access}` },
  });
  expect(removed.status()).toBe(204);
});
