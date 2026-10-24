import { expect, test } from "@playwright/test";

test("UC-TAX-02 checks a selected input invoice on the existing screen", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD,
    "Set LIVE_TAX_EMAIL and LIVE_TAX_PASSWORD for the local backend.");
  const login = await request.post("http://127.0.0.1:8080/api/v1/common/auth/login/", {
    data: { email: process.env.LIVE_TAX_EMAIL, password: process.env.LIVE_TAX_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const company = session.companies.find((row: { code: string }) => row.code === "ABC") || session.companies[0];
  const headers = { Authorization: `Bearer ${session.access}` };
  const branchResponse = await request.get(`http://127.0.0.1:8080/api/v1/organization/branches/?company_id=${company.id}`, { headers });
  expect(branchResponse.ok()).toBeTruthy();
  const branchBody = await branchResponse.json();
  const branch = (Array.isArray(branchBody) ? branchBody : branchBody.results).find((row: { status: string }) => row.status === "ACTIVE");
  const number = String(Date.now()).slice(-9);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>VA26TAX</KHHDon><SHDon>${number}</SHDon><NLap>2026-10-20</NLap></TTChung>
<NDHDon><NBan><Ten>Nhà cung cấp kiểm tra</Ten><MST>0101234567</MST></NBan>
<NMua><Ten>${company.name}</Ten></NMua><DSHHDVu><HHDVu><THHDVu>Dịch vụ xác minh</THHDVu><SLuong>1</SLuong><DGia>1000</DGia><ThTien>1000</ThTien><TSuat>10%</TSuat><TThue>100</TThue></HHDVu></DSHHDVu>
<TToan><TgTCThue>1000</TgTCThue><TgTThue>100</TgTThue><TgTTTBSo>1100</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>`;
  const upload = await request.post("http://127.0.0.1:8080/api/v1/tax/invoices/receive-input-xml/", {
    headers, multipart: { company: company.id, branch: branch.id,
      file: { name: "validation-ui.xml", mimeType: "application/xml", buffer: Buffer.from(xml) } },
  });
  expect(upload.status()).toBe(201);
  await page.addInitScript(({ access, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: access, companyId: company.id, companies: [company],
  })), { access: session.access, company });
  await page.goto("/invoices/incoming/inbox");
  await page.getByLabel("Tìm hóa đơn đầu vào").fill(number);
  await expect(page.locator(".erp3-invoice-item")).toHaveCount(1);
  await expect(page.getByText("SIGN-01 · Chưa kiểm tra")).toBeVisible();
  await expect(page.getByText("XML-01 · Đạt")).toBeVisible();
  await expect(page.locator(".erp3-validation")).toContainText("Cần kiểm tra thủ công");
  await page.getByRole("button", { name: "Kiểm tra lại" }).click();
  await expect(page.getByRole("button", { name: "Xem 1 lần kiểm tra trước" })).toBeVisible();
  await page.getByRole("button", { name: "Xem 1 lần kiểm tra trước" }).click();
  await expect(page.locator(".erp3-validation details")).toHaveCount(1);
});
