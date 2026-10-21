import { expect, test } from "@playwright/test";

test("shows unmatched statement and voucher and saves waiting reason", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const account = "33333333-3333-4333-8333-333333333333";
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "bank-unmatched-test", companyId: company,
    companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), { company });
  let waiting = false;
  let submitted: Record<string, any> | null = null;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/bank/reconciliation-periods/preview/") {
      await route.fulfill({ json: { opening_balance: "0", last_confirmed_date: null, has_statement: true, unmatched_count: 2, transactions: [] } }); return;
    }
    if (path === "/api/v1/bank/unmatched/items/") {
      await route.fulfill({ json: { has_statement: true, items: [
        { kind: "STATEMENT", id: "line-1", date: "2026-10-01", code: "BANK-001", reference: "REF-1", description: "Thu khách hàng",
          counterparty: "Khách A", account, account_number: "123456789", direction: "CREDIT", amount: "100", matched_amount: "0",
          remaining_amount: "100", currency: "VND", linked_vouchers: [], cause: waiting ? "Chờ xác minh" : "Có chứng từ chưa ghép",
          processing_status: waiting ? "WAITING" : "UNMATCHED", reason: waiting ? "Chờ xác minh" : "", note: "", updated_at: null,
          duplicate_count: 0, candidate_count: 1, period_confirmed: false },
        { kind: "VOUCHER", id: "voucher-1", date: "2026-10-01", code: "BC-001", reference: "REF-1", description: "Thu khách hàng",
          counterparty: "Khách A", account, account_number: "123456789", direction: "CREDIT", amount: "100", matched_amount: "0",
          remaining_amount: "100", currency: "VND", linked_vouchers: [], cause: "Có giao dịch sao kê chưa ghép",
          processing_status: "UNMATCHED", reason: "", note: "", updated_at: null,
          duplicate_count: 0, candidate_count: 1, period_confirmed: false },
      ] } }); return;
    }
    if (path === "/api/v1/bank/unmatched/mark-waiting/") {
      submitted = route.request().postDataJSON(); waiting = true;
      await route.fulfill({ json: { kind: "STATEMENT", id: "line-1", processing_status: "WAITING" } }); return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/bank/accounts/": [{ id: account, account_number: "123456789", bank_name: "Techcombank", currency_code: "VND" }],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
  await page.goto("/bank/reconciliation");
  await page.getByRole("button", { name: "Đối chiếu offline" }).click();
  await page.getByLabel("TK ngân hàng").selectOption(account);
  await page.getByRole("button", { name: "Lấy dữ liệu" }).click();
  const section = page.getByRole("region", { name: "Giao dịch chưa khớp" });
  await section.getByRole("button", { name: "Xem giao dịch chưa khớp" }).click();
  await expect(section.getByText("BANK-001")).toBeVisible();
  await expect(section.getByText("BC-001")).toBeVisible();
  await section.getByRole("row", { name: /BANK-001/ }).getByRole("button", { name: "Xử lý" }).click();
  const dialog = page.getByRole("dialog", { name: "Xử lý giao dịch chưa khớp" });
  await dialog.getByRole("button", { name: "Chờ xử lý" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Vui lòng nhập lý do");
  await dialog.getByLabel("Lý do chờ xử lý *").fill("Chờ xác minh");
  await dialog.getByLabel("Ghi chú xử lý").fill("Liên hệ ngân hàng");
  await dialog.getByRole("button", { name: "Chờ xử lý" }).click();
  await expect.poll(() => submitted?.reason).toBe("Chờ xác minh");
  await expect(section.getByRole("row", { name: /BANK-001/ })).toContainText("Chờ xử lý");
  await section.getByRole("row", { name: /BC-001/ }).getByRole("button", { name: "Xử lý" }).click();
  await page.getByRole("dialog", { name: "Xử lý giao dịch chưa khớp" }).getByRole("button", { name: "Mở chứng từ" }).click();
  await expect(page).toHaveURL(/bank\/transactions.*voucher=voucher-1/);
});
