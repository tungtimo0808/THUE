import { expect, test } from "@playwright/test";

test("UC-TAX-05 opens existing correction forms from the invoice error guide", async ({ page, request }) => {
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
  for (const [choice, label] of [["Điều chỉnh hóa đơn", "Hóa đơn gốc cần điều chỉnh"],
    ["Thay thế hóa đơn", "Hóa đơn bị thay thế"]]) {
    await page.goto(`/invoices/errors?company=${company.id}&period=2026-10`);
    await page.getByRole("radio", { name: "HĐ có mã của CQT" }).check();
    await page.getByRole("radio", { name: "Đã gửi" }).check();
    await page.getByRole("radio", { name: /Sai mã số thuế/ }).check();
    await page.getByRole("radio", { name: choice }).check();
    await page.getByRole("link", { name: `Lập hóa đơn ${choice === "Điều chỉnh hóa đơn" ? "điều chỉnh" : "thay thế"}` }).click();
    await expect(page.getByLabel(label)).toBeVisible();
  }
});

test("UC-TAX-05 saves correction drafts and queues cancellation from the existing invoice UI", async ({ page, request }) => {
  test.skip(!process.env.LIVE_TAX_EMAIL || !process.env.LIVE_TAX_PASSWORD ||
    !process.env.LIVE_TAX_ORIGINAL_A || !process.env.LIVE_TAX_ORIGINAL_R || !process.env.LIVE_TAX_ORIGINAL_C,
    "Set local login and three issued output invoice IDs.");
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
  await page.goto(`/sales/invoices?company=${company.id}&period=2026-10`);

  await page.getByRole("button", { name: "Chọn loại hóa đơn" }).click();
  await page.getByText("Hóa đơn điều chỉnh", { exact: true }).last().click();
  await page.getByLabel("Hóa đơn gốc cần điều chỉnh").selectOption(process.env.LIVE_TAX_ORIGINAL_A!);
  await page.getByLabel("Nội dung điều chỉnh").fill("Bổ sung giá trị dịch vụ kiểm thử");
  await page.getByLabel("Tên hàng điều chỉnh dòng 1").fill("Dịch vụ bổ sung");
  await page.getByLabel("Số lượng điều chỉnh dòng 1").fill("1");
  await page.getByLabel("Đơn giá điều chỉnh dòng 1").fill("100");
  await page.getByLabel("Thuế GTGT dòng 1").fill("10");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu hóa đơn điều chỉnh dạng nháp");

  await page.getByRole("button", { name: "Chọn loại hóa đơn" }).click();
  await page.getByText("Hóa đơn thay thế", { exact: true }).last().click();
  await page.getByLabel("Hóa đơn bị thay thế").selectOption(process.env.LIVE_TAX_ORIGINAL_R!);
  await page.getByLabel("Lý do thay thế").fill("Sửa thông tin hóa đơn kiểm thử");
  await page.getByLabel("Ngày hóa đơn đầu ra").fill("23/10/2026");
  await page.getByLabel("Tên hàng dòng 1").fill("Dịch vụ thay thế");
  await page.getByLabel("Đơn giá dòng 1").fill("1000");
  await page.getByLabel("Thuế suất dòng 1").selectOption("10");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu hóa đơn");

  await page.getByRole("button", { name: "Xem danh sách chứng từ" }).click();
  const cancelRow = page.getByRole("row").filter({ hasText: "UC05C-001" });
  await expect(cancelRow).toBeVisible();
  await cancelRow.click();
  const preview = page.getByRole("dialog", { name: "Xem trước hóa đơn đầu ra" });
  await preview.getByRole("button", { name: "Xử lý hủy hóa đơn" }).click();
  const cancel = page.getByRole("dialog", { name: "Xử lý hủy hóa đơn" });
  await cancel.getByLabel("Lý do hủy hóa đơn").fill("Lập nhầm hóa đơn trước khi gửi người mua");
  await cancel.getByRole("checkbox").check();
  await cancel.getByRole("button", { name: "Gửi yêu cầu hủy" }).click();
  await expect(preview).toContainText("Yêu cầu hủy: Đang chờ");

  const headers = { Authorization: `Bearer ${session.access}` };
  const check = async (id: string) => {
    const response = await request.get(`http://127.0.0.1:8080/api/v1/tax/invoices/${id}/history/?company_id=${company.id}`, { headers });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  const adjustment = await check(process.env.LIVE_TAX_ORIGINAL_A!);
  expect(adjustment.invoice.status).toBe("ISSUED");
  expect(adjustment.corrections.some((row: { type: string; status: string }) => row.type === "ADJUSTMENT" && row.status === "DRAFT")).toBeTruthy();
  const replacement = await check(process.env.LIVE_TAX_ORIGINAL_R!);
  expect(replacement.invoice.status).toBe("ISSUED");
  expect(replacement.corrections.some((row: { type: string; status: string }) => row.type === "REPLACEMENT" && row.status === "DRAFT")).toBeTruthy();
  const cancellation = await check(process.env.LIVE_TAX_ORIGINAL_C!);
  expect(cancellation.invoice.status).toBe("ISSUED");
  expect(cancellation.integration_requests.some((row: { task_type: string; status: string }) =>
    row.task_type === "CANCEL" && row.status === "PENDING")).toBeTruthy();
});
