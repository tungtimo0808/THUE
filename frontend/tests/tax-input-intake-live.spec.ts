import { expect, test } from "@playwright/test";

test("UC-TAX-01 uploads a real XML through the existing inbox", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD,
    "Set LIVE_TAX_EMAIL and LIVE_TAX_PASSWORD for the local backend.");
  const login = await request.post("http://127.0.0.1:8080/api/v1/common/auth/login/", {
    data: { email: process.env.LIVE_TAX_EMAIL, password: process.env.LIVE_TAX_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const company = session.companies.find((row: { code: string }) => row.code === "ABC") || session.companies[0];
  expect(company).toBeTruthy();
  const number = String(Date.now()).slice(-9);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>UI26TAX</KHHDon><SHDon>${number}</SHDon><NLap>2026-10-20</NLap></TTChung>
<NDHDon><NBan><Ten>Nhà cung cấp UI Test</Ten><MST>0101234567</MST></NBan>
<NMua><Ten>${company.name}</Ten></NMua><DSHHDVu><HHDVu><THHDVu>Dịch vụ kiểm thử</THHDVu><SLuong>1</SLuong><DGia>1000</DGia><ThTien>1000</ThTien><TSuat>10%</TSuat><TThue>100</TThue></HHDVu></DSHHDVu>
<TToan><TgTCThue>1000</TgTCThue><TgTThue>100</TgTThue><TgTTTBSo>1100</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>`;
  await page.addInitScript(({ access, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: access, companyId: company.id, companies: [company],
  })), { access: session.access, company });
  await page.goto("/invoices/incoming/inbox");
  await expect(page.getByRole("heading", { name: "Hộp thư hóa đơn" })).toBeVisible();
  await page.getByRole("button", { name: "Tải hóa đơn lên" }).click();
  await page.getByLabel("File hóa đơn XML").setInputFiles({ name: "invoice-ui.xml", mimeType: "application/xml", buffer: Buffer.from(xml) });
  await page.getByRole("button", { name: "Tiếp nhận" }).click();
  await expect(page.getByRole("button", { name: new RegExp(number) })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nhà cung cấp UI Test" })).toBeVisible();
  await expect(page.getByText("Dịch vụ kiểm thử")).toBeVisible();
  await expect(page.getByText("SIGN-01 · Chưa kiểm tra")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải XML gốc" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("invoice-ui.xml");
  await page.getByLabel("Tìm hóa đơn đầu vào").fill(number);
  await expect(page.locator(".erp3-invoice-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Lọc" }).click();
  await page.getByLabel("Lọc trạng thái hóa đơn").selectOption("MANUAL_REVIEW");
  await expect(page.locator(".erp3-invoice-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Làm mới" }).click();
  await expect(page.locator(".erp3-invoice-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Tải hóa đơn lên" }).click();
  await page.getByLabel("File hóa đơn XML").setInputFiles({ name: "invoice-ui.xml", mimeType: "application/xml", buffer: Buffer.from(xml) });
  await page.getByRole("button", { name: "Tiếp nhận" }).click();
  await expect(page.getByText(`Hóa đơn số ${number} đã có trong hộp thư.`)).toBeVisible();
  await expect(page.locator(".erp3-invoice-item")).toHaveCount(1);
  await page.goto("/purchases/invoices");
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(page.getByText("Chứng từ được chọn chỉ làm ngữ cảnh.", { exact: false })).toBeVisible();
});
