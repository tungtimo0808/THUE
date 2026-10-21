import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";

test("bank reconciliation imports selected Excel statement rows without vouchers", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const profile = "33333333-3333-4333-8333-333333333333";
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "bank-statement-test", companyId: company,
    companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), { company });
  let previewPayload: Record<string, any> | null = null;
  let imported = false;
  const today = new Date().toISOString().slice(0, 10);
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/preview-import/") && route.request().method() === "POST") {
      previewPayload = route.request().postDataJSON();
      await route.fulfill({ json: { rows: [
        { source_row: 2, status: "VALID", reason: "", transaction_date: today, direction: "CREDIT", amount: "100", description: "Khách chuyển", reference: "REF-1" },
        { source_row: 3, status: "ERROR", reason: "Thiếu ngày", transaction_date: "", direction: "DEBIT", amount: "20", description: "Dòng lỗi", reference: "" },
      ], counts: { VALID: 1, ERROR: 1, DUPLICATE: 0, SUSPECT: 0 }, total_receipts: "100", total_payments: "0", calculated_closing: null, balance_difference: null } }); return;
    }
    if (path.endsWith("/import-file/") && route.request().method() === "POST") {
      imported = route.request().postData()?.includes("selected_rows") || false;
      await route.fulfill({ status: 201, json: { id: "statement-1", source_reference: "IMP-TEST", lines: [{ id: "line-1" }] } }); return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/bank/accounts/": [{ id: profile, account_number: "123456789", bank_name: "Techcombank", branch_id: "branch-1", branch_name: "Trụ sở chính", currency_id: "vnd", currency_code: "VND" }],
      "/api/v1/bank/statements/": [], "/api/v1/bank/transactions/": [], "/api/v1/bank/reconciliations/": [],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["Ngày giao dịch", "Nội dung", "Thu", "Chi", "Mã giao dịch"],
    [today, "Khách chuyển", 100, 0, "REF-1"],
    ["", "Dòng lỗi", 0, 20, ""],
  ]), "Sao ke");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  await page.goto("/bank/reconciliation");
  await page.getByRole("button", { name: /Đối chiếu với Sổ Việt AI/ }).click();
  await page.getByRole("button", { name: /Thêm kỳ đối chiếu.*Tải tệp sao kê/ }).click();
  const dialog = page.getByRole("dialog", { name: "Nhập sao kê ngân hàng" });
  await dialog.getByLabel("Tài khoản ngân hàng").selectOption(profile);
  await dialog.getByLabel("Từ ngày").fill(today);
  await dialog.getByLabel("Đến ngày").fill(today);
  await dialog.locator('input[type="file"]').setInputFiles({ name: "statement.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  await dialog.getByRole("button", { name: "Kiểm tra dữ liệu" }).click();
  await expect.poll(() => previewPayload?.rows?.length).toBe(2);
  expect(previewPayload?.rows[0].direction).toBe("CREDIT");
  await expect(dialog.getByText("1 hợp lệ · 1 lỗi")).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Chọn dòng 3" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Import 1 dòng" }).click();
  await expect(dialog.getByText(/chưa tạo chứng từ, bút toán/)).toBeVisible();
  await dialog.getByRole("button", { name: "Xác nhận import" }).click();
  await expect.poll(() => imported).toBe(true);
  await expect(page.getByText(/Đã nhập 1 giao dịch sao kê/)).toBeVisible();
});
