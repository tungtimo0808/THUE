import { expect, test, type Page } from "@playwright/test";

// UC-FA-06 – Đánh giá lại tài sản cố định: form → proposed entries → Cất (save + post) → print, against a mocked API.
const company = "11111111-1111-4111-8111-111111111111";
const machine = "33333333-3333-4333-8333-333333333333";
const locked = "34343434-3434-4343-8343-343434343434";
const posted = "55555555-5555-4555-8555-555555555555";
const created = "56565656-5656-4565-8565-565656565656";
const account = (code: string) => `aaaaaaaa-0000-4000-8000-${code.padStart(12, "0")}`;

test.describe.configure({ timeout: 90_000 });

type Calls = { created: Record<string, any> | null; uploads: string[]; posts: number; reversed: Record<string, any> | null };

const postedVoucher = {
  id: posted, number: "ĐGL00001", status: "POSTED", status_label: "Đã ghi sổ", reason: "STATE_DECISION",
  reason_label: "Đánh giá lại theo quyết định của cơ quan nhà nước", record_number: "QĐ-12", record_date: "2026-10-20",
  document_date: "2026-10-20", posting_date: "2026-10-20", conclusion: "Theo quyết định", references: [], cost_booked_at_source: false,
  source_reference: "", attachments: [], members: [{ full_name: "Lê C", title: "Chủ tịch", representing: "Ban giám đốc" }],
  totals: { original_cost: "50000000", accumulated_depreciation: "0", remaining_value: "50000000", depreciable_value: "50000000" },
  lines: [{ asset: machine, asset_code: "MAY01", asset_name: "Máy CNC", department_name: "Phân xưởng",
    before_original_cost: "250000000", after_original_cost: "300000000", before_remaining_periods: 48, after_remaining_periods: 48,
    before_accumulated_depreciation: "60000000", after_accumulated_depreciation: "60000000", before_depreciable_value: "250000000",
    after_depreciable_value: "300000000", monthly_depreciation_after: "5000000", tax_monthly_depreciation_after: "5000000",
    expense_account_code: "", revaluation_account_code: "412" }],
  entries: [{ description: "Tăng nguyên giá", debit_account_code: "2111", credit_account_code: "412", amount: "50000000" }],
};

async function mockApi(page: Page, calls: Calls, postError = "") {
  await page.addInitScript(({ company }) => {
    localStorage.setItem("erp_api_session", JSON.stringify({
      token: "asset-revaluation-test", companyId: company,
      companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
    }));
    window.print = () => { (window.top as any).__printed = ((window.top as any).__printed || 0) + 1; };
  }, { company });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const echo = (status: string, label: string) => {
      const body = calls.created || {};
      return { ...body, id: created, status, status_label: label, reason_label: "Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản",
        attachments: calls.uploads.map((name, index) => ({ id: `a${index}`, name, size: 10 })),
        lines: (body.lines || []).map((line: any) => ({ ...line, asset_code: "MAY01", asset_name: "Máy CNC" })),
        entries: (body.entries || []).map((entry: any) => ({ ...entry, debit_account_code: "2111", credit_account_code: "241" })) };
    };
    if (path === "/api/v1/fixed-assets/revaluations/candidates/") {
      await route.fulfill({ json: [
        { id: machine, code: "MAY01", name: "Máy CNC", department_name: "Phân xưởng", original_cost: "300000000", remaining_periods: "48",
          accumulated_depreciation: "60000000", depreciable_value: "300000000", monthly_depreciation: "5000000", tax_monthly_depreciation: null,
          asset_account_code: "2111", accumulated_account_code: "2141", expense_account_code: "6424", blocked: "" },
        { id: locked, code: "MAY03", name: "Máy đã khấu hao kỳ sau", original_cost: "10", remaining_periods: "1", accumulated_depreciation: "0",
          depreciable_value: "10", monthly_depreciation: "10", blocked: "Điều chỉnh ảnh hưởng đến dữ liệu kế toán đã ghi sổ. Vui lòng xử lý kỳ liên quan." },
      ] }); return;
    }
    if (path === "/api/v1/fixed-assets/revaluations/" && method === "POST") {
      calls.created = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: echo("DRAFT", "Chưa ghi sổ") }); return;
    }
    if (path === `/api/v1/fixed-assets/revaluations/${created}/attachments/`) {
      const body = route.request().postDataBuffer()?.toString("latin1") || "";
      calls.uploads.push(/filename="([^"]+)"/.exec(body)?.[1] || "?");
      await route.fulfill({ status: 201, json: echo("DRAFT", "Chưa ghi sổ") }); return;
    }
    if (path === `/api/v1/fixed-assets/revaluations/${created}/post/`) {
      calls.posts += 1;
      if (postError) { await route.fulfill({ status: 400, json: [postError] }); return; }
      await route.fulfill({ json: echo("POSTED", "Đã ghi sổ") }); return;
    }
    if (path === `/api/v1/fixed-assets/revaluations/${posted}/reverse/`) {
      calls.reversed = route.request().postDataJSON();
      await route.fulfill({ json: { ...postedVoucher, status: "REVERSED", status_label: "Đã bỏ ghi sổ" } }); return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/fixed-assets/assets/": [{ id: machine, code: "MAY01", name: "Máy CNC", useful_life_periods: 60, original_cost: "300000000",
        accumulated_depreciation: "60000000", remaining_value: "240000000", department_name: "Phân xưởng" }],
      "/api/v1/fixed-assets/revaluations/": [postedVoucher],
      "/api/v1/general-ledger/accounts/": ["2111", "2141", "241", "412", "6424"].map((code) => ({ id: account(code), code, name: code, status: "ACTIVE", is_postable: true })),
      "/api/v1/master-data/parties/": [],
      "/api/v1/master-data/expense-items/": [],
      "/api/v1/organization/departments/": [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", code: "PX", name: "Phân xưởng" }],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
}

async function openNew(page: Page) {
  await page.goto("/assets/revaluation");
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  const modal = page.locator("div").filter({ hasText: /^Đánh giá lại tài sản cố định ĐGL/ }).locator("xpath=ancestor::div[contains(@style,'flex-direction: column')][1]").first();
  await expect(page.getByTestId("reval-status")).toHaveText("Chứng từ mới");
  return modal;
}

test("UC-FA-06 upgrades an asset, proposes the entry, attaches the record, posts and prints", async ({ page }) => {
  const calls: Calls = { created: null, uploads: [], posts: 0, reversed: null };
  await mockApi(page, calls);
  await openNew(page);
  // Step 9 / BR04: next number of the series.
  await expect(page.getByRole("textbox", { name: "Số chứng từ" })).toHaveValue("ĐGL00002");
  await page.getByRole("textbox", { name: "Biên bản số" }).fill("BB-NT01");
  await expect(page.getByRole("combobox", { name: "Lý do" })).toHaveValue("Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản");
  // Steps 10-14.
  await page.getByRole("button", { name: "Thêm dòng" }).first().click();
  await page.getByRole("textbox", { name: "Họ và tên thành viên 1" }).fill("Trần B");
  await page.getByRole("textbox", { name: "Chức danh thành viên 1" }).fill("Trưởng phòng kỹ thuật");
  await page.getByRole("textbox", { name: "Đại diện thành viên 1" }).fill("Phòng kỹ thuật");

  // Steps 16-17: eligible assets; one with later postings is disabled (EF25).
  const assetSelect = page.getByRole("combobox", { name: "Mã tài sản dòng 1" });
  await expect(assetSelect.locator("option", { hasText: "MAY03" })).toBeDisabled();
  await assetSelect.selectOption("MAY01");
  const row = page.getByRole("row").filter({ has: assetSelect });
  await expect(row).toContainText("300.000.000");
  await expect(row).toContainText("60.000.000");
  // Steps 19-28: new cost; the depreciable value follows and the monthly amount is suggested.
  await page.getByRole("spinbutton", { name: "Nguyên giá sau điều chỉnh dòng 1" }).fill("400000000");
  await expect(page.getByRole("spinbutton", { name: "Giá trị tính khấu hao sau điều chỉnh dòng 1" })).toHaveValue("400000000");
  await expect(page.getByRole("spinbutton", { name: "GTKH tháng sau điều chỉnh dòng 1" })).toHaveValue("7083333");
  await expect(page.getByRole("spinbutton", { name: "GTKH tháng theo luật dòng 1" })).toHaveValue("7083333");
  await expect(page.getByTestId("reval-total")).toHaveText("100.000.000");
  // BR23: no default TK 412.
  await expect(page.getByRole("combobox", { name: "TK đánh giá lại dòng 1" })).toHaveValue("");

  // Steps 34-35: proposed entry for an upgrade is Nợ 2111 / Có 241 (BR20).
  await page.getByRole("button", { name: "Hạch toán", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "TK Nợ bút toán 1" })).toHaveValue("2111");
  await expect(page.getByRole("combobox", { name: "TK Có bút toán 1" })).toHaveValue("241");
  await expect(page.getByRole("spinbutton", { name: "Số tiền bút toán 1" })).toHaveValue("100000000");
  await page.getByRole("textbox", { name: "Kết luận" }).fill("Nâng cấp đạt yêu cầu, thời gian sử dụng còn 48 tháng");
  // AF23 + AF24.
  await page.getByText("Tham chiếu").click();
  await page.getByRole("textbox", { name: "Hồ sơ tham chiếu" }).fill("NT-2026/10");
  await page.getByRole("textbox", { name: "Hồ sơ tham chiếu" }).press("Enter");
  await page.getByLabel("Chọn tệp đính kèm").setInputFiles([
    { name: "qua-lon.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
    { name: "bien-ban-nghiem-thu.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") },
  ]);
  await expect(page.getByText(/Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB\. \(qua-lon\.pdf\)/)).toBeVisible();

  // AF25: Cất và In with the valuation record.
  await page.getByRole("button", { name: "Chọn mẫu in đánh giá lại" }).click();
  await page.getByRole("menuitem", { name: /Biên bản đánh giá lại/ }).click();
  await expect.poll(() => calls.posts).toBe(1);
  expect(calls.uploads).toEqual(["bien-ban-nghiem-thu.pdf"]);
  expect(calls.created).toMatchObject({
    number: "ĐGL00002", reason: "UPGRADE", record_number: "BB-NT01", references: ["NT-2026/10"],
    conclusion: "Nâng cấp đạt yêu cầu, thời gian sử dụng còn 48 tháng",
    members: [{ full_name: "Trần B", title: "Trưởng phòng kỹ thuật", representing: "Phòng kỹ thuật" }],
    lines: [expect.objectContaining({ asset: machine, before_original_cost: "300000000", after_original_cost: "400000000",
      before_remaining_periods: 48, after_remaining_periods: 48, before_accumulated_depreciation: "60000000",
      after_accumulated_depreciation: "60000000", after_depreciable_value: "400000000", monthly_depreciation_after: "7083333",
      revaluation_account: null })],
    entries: [expect.objectContaining({ debit_account: account("2111"), credit_account: account("241"), amount: "100000000" })],
  });
  expect(calls.created?.idempotency_key).toBeTruthy();
  await expect(page.getByText("Đánh giá lại tài sản cố định thành công.")).toBeVisible();
  await expect(page.getByTestId("reval-status")).toHaveCount(0);
  await expect(page.frameLocator("#inventory-issue-print").locator("h1")).toHaveText("BIÊN BẢN ĐÁNH GIÁ LẠI TÀI SẢN CỐ ĐỊNH");
  await expect(page.frameLocator("#inventory-issue-print").locator("body")).toContainText("Trần B");
});

test("UC-FA-06 keeps a draft open when posting is refused and asks before discarding", async ({ page }) => {
  const calls: Calls = { created: null, uploads: [], posts: 0, reversed: null };
  await mockApi(page, calls, "Kỳ kế toán đã khóa, không thể ghi nhận đánh giá lại tài sản.");
  await openNew(page);
  await page.getByRole("combobox", { name: "Lý do" }).selectOption("Lý do khác");
  await page.getByRole("textbox", { name: "Biên bản số" }).fill("BB-02");
  await page.getByRole("combobox", { name: "Mã tài sản dòng 1" }).selectOption("MAY01");
  // AF15: only the remaining life changes; no entry is proposed (AF30).
  await page.getByRole("spinbutton", { name: "Thời gian còn lại sau điều chỉnh dòng 1" }).fill("60");
  await page.getByRole("button", { name: "Hạch toán", exact: true }).click();
  await expect(page.getByText("Điều chỉnh không phát sinh bút toán")).toBeVisible();
  await page.getByRole("textbox", { name: "Kết luận" }).fill("Gia hạn sử dụng");
  await page.getByRole("button", { name: "Cất", exact: true }).click();
  await expect(page.getByText(/Kỳ kế toán đã khóa, không thể ghi nhận đánh giá lại tài sản\. Chứng từ ĐGL00002 vẫn ở trạng thái Chưa ghi sổ\./)).toBeVisible();
  expect(calls.created?.entries).toEqual([]);
  expect(calls.created?.lines[0]).toMatchObject({ after_remaining_periods: 60, monthly_depreciation_after: "4000000" });
  await expect(page.getByTestId("reval-status")).toHaveText("Chưa ghi sổ");
  // AF26.
  await page.getByRole("textbox", { name: "Kết luận" }).fill("Đổi ý");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(page.getByTestId("reval-status")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(page.getByTestId("reval-status")).toHaveCount(0);
});

test("UC-FA-06 opens a posted document read-only, reprints it and unposts it", async ({ page }) => {
  const calls: Calls = { created: null, uploads: [], posts: 0, reversed: null };
  await mockApi(page, calls);
  await page.goto("/assets/revaluation");
  await page.getByRole("button", { name: "Xem danh sách chứng từ" }).click();
  const listRow = page.getByRole("row").filter({ hasText: "ĐGL00001" });
  await expect(listRow).toContainText("Đã ghi sổ");
  await listRow.getByText("ĐGL00001").click();
  await expect(page.getByTestId("reval-status")).toHaveText("Đã ghi sổ");
  await expect(page.getByRole("button", { name: "Cất", exact: true })).toBeDisabled();
  await expect(page.getByRole("spinbutton", { name: "Nguyên giá sau điều chỉnh dòng 1" })).toBeDisabled();
  await page.getByRole("button", { name: "In", exact: true }).click();
  await expect(page.frameLocator("#inventory-issue-print").locator("body")).toContainText("QĐ-12");
  // AF28.
  page.once("dialog", (dialog) => dialog.accept("Sai số liệu"));
  await page.getByRole("button", { name: "Bỏ ghi sổ" }).click();
  await expect.poll(() => calls.reversed).toEqual({ reason: "Sai số liệu" });
  await expect(page.getByTestId("reval-status")).toHaveText("Đã bỏ ghi sổ");
});
