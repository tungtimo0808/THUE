import { expect, test } from "@playwright/test";

test("UC-TAX-13 records and follows a manual external filing on the existing declaration screen", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_SUBMISSION || !process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD,
    "Requires a temporary confirmed declaration and explicit opt-in.");
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
  await page.goto(`/tax/declarations?company=${company.id}`);
  const declarationRow = page.getByRole("row", { name: /01\/GTGT TAX13-UI-2026-10/ });
  await expect(declarationRow).toBeVisible();
  await declarationRow.getByRole("button", { name: "Xem" }).click();
  await expect(page.getByRole("heading", { name: "Lịch sử nộp hồ sơ" })).toBeVisible();
  await page.getByLabel("Mã tham chiếu nộp").fill("TAX13-UI-RECEIPT");
  await page.getByLabel("Bằng chứng nộp ban đầu").fill("Biên nhận thử nghiệm");
  await page.getByRole("button", { name: "Ghi nhận nộp ngoài" }).click();
  await expect(page.getByText(/Đã ghi nhận nộp ngoài.*MANUAL.*TAX13-UI-RECEIPT/)).toBeVisible();
  await page.getByRole("button", { name: "Cập nhật kết quả thủ công" }).click();
  await page.getByLabel("Bằng chứng kết quả").fill("Mã chấp nhận thử nghiệm");
  await page.getByLabel("Ghi chú kết quả").fill("Đối chiếu biên nhận và kết quả thủ công");
  await page.getByRole("button", { name: "Lưu kết quả" }).click();
  await expect(page.getByText(/Được báo chấp nhận \(thủ công\).*MANUAL.*TAX13-UI-RECEIPT/)).toBeVisible();
  await expect(page.getByText("2 sự kiện")).toBeVisible();
  const response = await request.get(`http://127.0.0.1:8080/api/v1/tax/submissions/?company_id=${company.id}`, {
    headers: { Authorization: `Bearer ${session.access}` },
  });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const row = (Array.isArray(data) ? data : data.results).find((item: { external_reference: string }) => item.external_reference === "TAX13-UI-RECEIPT");
  expect(row.verification_source).toBe("MANUAL");
  expect(row.declaration_snapshot.period_code).toBe("TAX13-UI-2026-10");
  expect(row.events).toHaveLength(2);
});
