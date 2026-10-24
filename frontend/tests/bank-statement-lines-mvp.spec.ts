import { expect, test } from "@playwright/test";

test("statement lines can be searched, reviewed, and removed in reconciliation UI", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const account = "33333333-3333-4333-8333-333333333333";
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "statement-lines-test", companyId: company,
    companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), { company });
  let deleted = false;
  let saved: Record<string, any> | null = null;
  const line = { id: "line-1", statement: "statement-1", account, account_number: "123456789", external_id: "000123", reference: "REF-9", transaction_date: "2026-10-20", value_date: "2026-10-20", direction: "CREDIT", amount: "125.0000", currency_code: "VND", description: "Khách chuyển tiền", counterparty: "Khách A", counterparty_account: "987654321", ending_balance: "500000", source: "FILE", file_name: "sao-ke.xlsx", sheet_name: "Statement", period_from: "2026-10-01", period_to: "2026-10-31", match_status: "UNMATCHED", tracking_status: saved?.tracking_status || "NORMAL", processing_note: saved?.processing_note || "", review_reason: saved?.review_reason || "", matched_amount: "0", remaining_amount: "125", linked_vouchers: [], raw_data: { source_row: 2 }, updated_at: null };
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/bank/statement-lines/line-1/" && route.request().method() === "PATCH") {
      saved = route.request().postDataJSON(); await route.fulfill({ json: { ...line, ...saved, updated_at: "2026-10-20T10:00:00Z" } }); return;
    }
    if (path === "/api/v1/bank/statement-lines/line-1/remove/" && route.request().method() === "POST") {
      deleted = Boolean(route.request().postDataJSON()?.reason); await route.fulfill({ json: { id: line.id, deleted: true } }); return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/bank/accounts/": [{ id: account, account_number: "123456789", bank_name: "Techcombank", currency_code: "VND" }],
      "/api/v1/bank/statements/": [], "/api/v1/bank/statement-lines/": deleted ? [] : [{ ...line, ...saved }],
      "/api/v1/bank/transactions/": [], "/api/v1/bank/reconciliations/": [],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
  await page.goto("/bank/reconciliation");
  await page.getByRole("button", { name: "Đối chiếu offline" }).click();
  await page.getByLabel("TK ngân hàng").selectOption(account);
  const section = page.getByRole("region", { name: "Quản lý giao dịch sao kê" });
  await section.getByLabel("Kỳ sao kê").selectOption("statement-1");
  await section.getByLabel("Từ ngày").fill("2026-09-30");
  await expect(section.getByText("Khoảng ngày phải nằm trong kỳ sao kê đã chọn.")).toBeVisible();
  await section.getByLabel("Từ ngày").fill("");
  await section.getByLabel("Tìm kiếm").fill("987654321");
  await expect(section.getByText("Khách chuyển tiền")).toBeVisible();
  await section.getByRole("button", { name: "Chi tiết" }).click();
  const dialog = page.getByRole("dialog", { name: "Chi tiết giao dịch sao kê" });
  await expect(dialog.getByText("sao-ke.xlsx · trang Statement · dòng 2", { exact: false })).toBeVisible();
  await expect(dialog.getByText("500.000", { exact: false })).toBeVisible();
  await dialog.getByLabel("Trạng thái theo dõi").selectOption("NEEDS_REVIEW");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(dialog.getByText("Vui lòng nhập lý do cần kiểm tra.")).toBeVisible();
  await dialog.getByLabel("Lý do cần kiểm tra").fill("Thiếu chứng từ");
  await dialog.getByLabel("Ghi chú xử lý").fill("Đợi kế toán");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect.poll(() => saved?.processing_note).toBe("Đợi kế toán");
  await section.getByRole("button", { name: "Chi tiết" }).click();
  await dialog.getByLabel("Lý do xóa giao dịch nhập sai").fill("Nhập trùng dòng");
  await dialog.getByRole("button", { name: "Xóa giao dịch" }).click();
  await expect.poll(() => deleted).toBe(true);
  await expect(section.getByText("Không có giao dịch phù hợp với điều kiện tìm kiếm.")).toBeVisible();
});
