import { test, expect } from "@playwright/test";

const company = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";

test("UC-MD-03 form sends employee, salary and bank details to the API", async ({ page }) => {
  await page.addInitScript(({ company }) => {
    localStorage.setItem("erp_api_session", JSON.stringify({ token: "test-token", companyId: company, companies: [{ id: company, name: "Công ty A" }], user: { id: "tester" } }));
  }, { company });
  let saved: Record<string, unknown> | null = null;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/employees/") && route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      return route.fulfill({ json: { ...saved, id: "33333333-3333-4333-8333-333333333333", version: "2026-10-28T00:00:00Z" } });
    }
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [{ id: company, name: "Công ty A" }] });
    if (path.endsWith("/branches/")) return route.fulfill({ json: [{ id: branch, code: "CN1", name: "Trụ sở chính", status: "ACTIVE" }] });
    if (path.endsWith("/departments/")) return route.fulfill({ json: [] });
    if (path.endsWith("/employees/")) return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
  await page.goto("/directory?directory=Nh%C3%A2n%20vi%C3%AAn");
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Thông tin nhân viên" });
  await dialog.getByRole("textbox", { name: /^Mã \*/ }).fill("NV001");
  await dialog.getByRole("textbox", { name: /^Tên \*/ }).fill("Nguyễn Văn A");
  await dialog.getByRole("textbox", { name: "Đơn vị" }).fill("Trụ sở chính");
  await dialog.getByRole("button", { name: "Thông tin tiền lương" }).click();
  await dialog.getByRole("combobox", { name: /^Loại hợp đồng/ }).selectOption("Cư trú và có HĐLĐ từ 3 tháng trở lên");
  await dialog.getByLabel("Lương thỏa thuận").fill("12000000");
  await dialog.getByRole("button", { name: "Tài khoản ngân hàng" }).click();
  await dialog.getByLabel("Số tài khoản dòng 1").fill("123456");
  await dialog.getByLabel("Tên ngân hàng dòng 1").fill("Ngân hàng A");
  await dialog.getByLabel("Chủ tài khoản dòng 1").fill("Nguyễn Văn A");
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect.poll(() => saved).not.toBeNull();
  expect(saved).toMatchObject({ employee_code: "NV001", full_name: "Nguyễn Văn A", branch, contract_type: "RESIDENT_LONG", agreed_salary: 12000000, bank_account: { account_number: "123456", bank_name: "Ngân hàng A", account_holder: "Nguyễn Văn A" } });
});
