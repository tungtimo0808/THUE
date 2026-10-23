import { expect, test } from "@playwright/test";

test("UC-TAX-03 links and unlinks a real posted purchase on the invoice screen", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD,
    "Set LIVE_TAX_EMAIL and LIVE_TAX_PASSWORD for the local backend.");
  const login = await request.post("http://127.0.0.1:8080/api/v1/common/auth/login/", {
    data: { email: process.env.LIVE_TAX_EMAIL, password: process.env.LIVE_TAX_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const company = session.companies.find((row: { code: string }) => row.code === "ABC") || session.companies[0];
  const headers = { Authorization: `Bearer ${session.access}` };
  const branchResponse = await request.get(
    `http://127.0.0.1:8080/api/v1/organization/branches/?company_id=${company.id}`, { headers });
  expect(branchResponse.ok()).toBeTruthy();
  const branchBody = await branchResponse.json();
  const branch = (Array.isArray(branchBody) ? branchBody : branchBody.results)
    .find((row: { status: string }) => row.status === "ACTIVE");
  const number = String(Date.now()).slice(-9);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>VA26LNK</KHHDon><SHDon>${number}</SHDon><NLap>2026-10-20</NLap></TTChung>
<NDHDon><NBan><Ten>Nhà cung cấp thử nghiệm</Ten><MST>0101234567</MST></NBan>
<NMua><Ten>${company.name}</Ten><MST>109876543</MST></NMua>
<DSHHDVu><HHDVu><THHDVu>Dịch vụ thử nghiệm</THHDVu><SLuong>1</SLuong><DGia>1000</DGia><ThTien>1000</ThTien><TSuat>10%</TSuat><TThue>100</TThue></HHDVu></DSHHDVu>
<TToan><TgTCThue>1000</TgTCThue><TgTThue>100</TgTThue><TgTTTBSo>1100</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>`;
  const upload = await request.post("http://127.0.0.1:8080/api/v1/tax/invoices/receive-input-xml/", {
    headers, multipart: { company: company.id, branch: branch.id,
      file: { name: "tax03-link-ui.xml", mimeType: "application/xml", buffer: Buffer.from(xml) } },
  });
  expect(upload.status()).toBe(201);
  await page.addInitScript(({ access, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: access, companyId: company.id, companies: [company],
  })), { access: session.access, company });
  await page.goto("/invoices/incoming/inbox");
  await page.getByLabel("Tìm hóa đơn đầu vào").fill(number);
  await expect(page.locator(".erp3-invoice-item")).toHaveCount(1);
  const pane = page.getByLabel("Liên kết chứng từ mua hàng");
  await expect(pane).toContainText("Chưa liên kết");
  await pane.getByRole("button", { name: "Liên kết chứng từ", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Liên kết chứng từ mua hàng" });
  await expect(modal).toBeVisible();
  await modal.getByLabel("Tìm chứng từ mua hàng").fill("TAX03-DEMO-001");
  await expect(modal.locator(".erp3-link-candidate")).toHaveCount(1);
  await modal.locator(".erp3-link-candidate").click();
  await expect(modal.getByLabel("Tiền trước thuế liên kết")).toHaveValue("1000");
  await modal.getByLabel("Ghi chú liên kết").fill("Đã đối chiếu hóa đơn XML và chứng từ mua hàng mẫu.");
  await modal.getByRole("button", { name: "Xác nhận liên kết" }).click();
  await expect(modal).toBeHidden();
  await expect(pane).toContainText("Đã liên kết");
  await expect(pane).toContainText("TAX03-DEMO-001");
  await pane.getByRole("button", { name: "Gỡ liên kết" }).click();
  await pane.getByLabel("Lý do gỡ TAX03-DEMO-001").fill("Gỡ sau khi hoàn tất thử nghiệm giao diện.");
  await pane.getByRole("button", { name: "Xác nhận gỡ" }).click();
  await expect(pane).toContainText("Chưa liên kết");
  await expect(pane).not.toContainText("TAX03-DEMO-001");
});
