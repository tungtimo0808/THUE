import { expect, test } from "@playwright/test";

test("UC-TAX-09 recognizes a confirmed declaration and saves a draft payment order", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD || !process.env.LIVE_TAX_OBLIGATION,
    "Requires a temporary READY_TO_SUBMIT VAT declaration fixture and explicit opt-in.");
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
  await page.goto(`/tax/payment-orders?company=${company.id}`);
  await expect(page.getByRole("heading", { name: "Nghĩa vụ thuế" })).toBeVisible();
  await expect(page.getByLabel("Hồ sơ nguồn")).toContainText("TAX09-UI-2026-06");
  await page.getByLabel("Hồ sơ nguồn").selectOption({ index: 1 });
  await page.getByLabel("Hạn nộp").fill("2026-11-20");
  await page.getByRole("button", { name: "Ghi nhận nghĩa vụ" }).click();
  const row = page.getByRole("row", { name: /VAT TAX09-UI-2026-06/ });
  await expect(row).toContainText("100.000");
  await row.getByRole("button", { name: "Nộp thuế" }).click();
  const dialog = page.getByRole("dialog", { name: "Lập Giấy nộp tiền vào Ngân sách Nhà nước" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Kho bạc Nhà nước hạch toán").fill("KBNN kiểm thử");
  await dialog.getByLabel("Tài khoản thu NSNN").fill("TK-KIEM-THU");
  await dialog.getByLabel("Nội dung TAX09-UI-2026-06").fill("Nộp thuế GTGT kiểm thử");
  await dialog.getByLabel("Tiểu mục TAX09-UI-2026-06").fill("TEST01");
  await dialog.getByLabel("Số tiền TAX09-UI-2026-06").fill("40000");
  await expect(dialog).toContainText("Tổng số tiền nộp: 40.000 đ");
  await dialog.getByRole("button", { name: "Lập giấy nộp tiền" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(/Đã lập giấy GNT-.*trạng thái nháp/)).toBeVisible();
  await expect(row).toContainText("100.000");
  await page.getByRole("button", { name: "Hủy giấy nháp" }).click();
  await expect(page.getByText(/GNT-.*CANCELLED/)).toBeVisible();
  const obligations = await request.get(`http://127.0.0.1:8080/api/v1/tax/obligations/?company_id=${company.id}`, {
    headers: { Authorization: `Bearer ${session.access}` },
  });
  expect(obligations.ok()).toBeTruthy();
  const data = await obligations.json();
  const obligation = (Array.isArray(data) ? data : data.results).find((item: { period_code: string }) => item.period_code === "TAX09-UI-2026-06");
  expect(Number(obligation.paid_amount)).toBe(0);
  expect(Number(obligation.outstanding_amount)).toBe(100000);
});
