import { expect, test, type Page } from "@playwright/test";

const companyId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const asset2Id = "55555555-5555-4555-8555-555555555555";
const referenceId = "33333333-3333-4333-8333-333333333333";
const countId = "44444444-4444-4444-8444-444444444444";
const company = { id: companyId, name: "Công ty A", accounting_regime: "TT58", bookkeeping_method: "SIMPLE" };

const assetRow = (id: string, code: string, name: string) => ({ id, company: companyId, code, name,
  asset_type: "FIXED_ASSET", status: "ACTIVE", original_cost: "120000000", accumulated_depreciation: "20000000",
  remaining_value: "100000000", depreciable_amount: "100000000", department_name: "Phòng kỹ thuật", version: 3 });

async function login(page: Page) {
  await page.addInitScript(({ companyId, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "stocktake-test", companyId, companies: [company], user: { id: "tester" },
  })), { companyId, company });
}

test("UC-FA-08 loads real book rows and saves a count with committee, reference and file", async ({ page }) => {
  await login(page);
  let submitted: Record<string, any> | null = null;
  let uploads = 0;
  let bookLoads = 0;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const list = (results: unknown[]) => route.fulfill({ json: { results } });
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [company] });
    if (path === "/api/v1/fixed-assets/counts/next-number/") return route.fulfill({ json: { voucher_no: "KKTS00008" } });
    if (path === "/api/v1/fixed-assets/counts/load-book-assets/") {
      bookLoads += 1;
      // BR13: the figures as of the count date, which may differ from today's asset card
      return route.fulfill({ json: { uses_general_ledger: false, book_source: "Sổ TSCĐ S4b-DNSN", lines: [
        { asset: assetId, asset_code: "TS001", asset_name: "Máy CNC", department_name: "Phòng kỹ thuật", original_cost: "120000000",
          depreciable_amount: "100000000", accumulated_depreciation: "20000000", remaining_value: "100000000", version: 3 },
        { asset: asset2Id, asset_code: "TS002", asset_name: "Máy tiện", department_name: "Phòng kỹ thuật", original_cost: "90000000",
          depreciable_amount: "90000000", accumulated_depreciation: "15000000", remaining_value: "75000000", version: 2 },
      ] } });
    }
    if (path === "/api/v1/fixed-assets/counts/stocktake-references/") return route.fulfill({ json: [{
      id: referenceId, number: "QD-KK-01", posting_date: "2026-10-01", document_date: "2026-10-01",
      description: "Quyết định kiểm kê", entry_type: "MANUAL",
    }] });
    if (path === "/api/v1/fixed-assets/counts/" && route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: countId, voucher_no: "KKTS00008", count_date_display: "28/10/2026",
        purpose: "Kiểm kê tài sản cố định định kỳ", lines: [], summary: { book_assets_count: 2, matched_count: 2, diff_count: 0 },
        attachments: [], message: "Lưu biên bản kiểm kê tài sản cố định thành công." } });
    }
    if (path === `/api/v1/fixed-assets/counts/${countId}/stocktake-attachments/` && route.request().method() === "POST") {
      uploads += 1;
      return route.fulfill({ status: 201, json: { id: countId, voucher_no: "KKTS00008", lines: [], attachments: [{ name: "bien-ban.pdf" }],
        summary: { book_assets_count: 2, matched_count: 2, diff_count: 0 } } });
    }
    if (path === "/api/v1/fixed-assets/assets/") return list([assetRow(assetId, "TS001", "Máy CNC"), { ...assetRow(asset2Id, "TS002", "Máy tiện"), original_cost: "95000000" }]);
    return list([]);
  });

  await page.goto("/assets/stocktake");
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  const datePicker = page.getByRole("dialog", { name: "Chọn thời điểm kiểm kê" });
  await expect(datePicker).toBeVisible();
  await datePicker.getByRole("button", { name: "Đồng ý" }).click();
  await expect.poll(() => bookLoads).toBe(1);
  await expect(page.getByRole("cell", { name: "Máy CNC", exact: true })).toBeVisible();

  // AF08 & BR15: removing a row and adding it back takes the as-of-date figures; a code cannot be picked twice
  await page.getByTitle("Xóa dòng").nth(1).click();
  await page.getByRole("button", { name: "+ Thêm dòng" }).click();
  const picker1 = page.getByTestId("stocktake-asset-0");
  await expect(picker1.locator("option", { hasText: "TS002" })).toHaveCount(1);
  const added = page.getByTestId("stocktake-asset-1");
  await expect(added.locator("option", { hasText: "TS001" })).toHaveCount(0);
  await added.selectOption("TS002");

  // EF06: a committee is required
  await page.getByText("Thành viên tham gia (0)").click();
  await page.getByRole("button", { name: "+ Thêm thành viên" }).click();
  await page.getByTestId("stocktake-member-name-0").fill("Nguyễn Văn An");
  await page.getByTestId("stocktake-member-role-0").selectOption("Trưởng ban");

  await page.locator('button[title="Chọn chứng từ tham chiếu"]').click();
  const refPicker = page.getByRole("dialog", { name: "Chọn chứng từ tham chiếu kiểm kê" });
  await refPicker.getByRole("checkbox", { name: "Chọn chứng từ QD-KK-01" }).check();
  await refPicker.getByRole("button", { name: "Đồng ý" }).click();
  for (const select of await page.locator('select:has(option[value="UNCOUNTED"])').all()) await select.selectOption("EXISTS");
  await page.locator('input[type="file"]').last().setInputFiles({ name: "bien-ban.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByRole("button", { name: "Cất", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted).toMatchObject({ voucher_no: "KKTS00008", reference_journal_ids: [referenceId],
    members: [{ name: "Nguyễn Văn An", role: "Trưởng ban" }],
    lines: [
      { asset: assetId, expected_version: 3, expected_original_cost: "120000000",
        expected_accumulated_depreciation: "20000000", expected_remaining_value: "100000000", existence_status: "EXISTS" },
      { asset: asset2Id, expected_version: 2, expected_original_cost: "90000000", existence_status: "EXISTS" },
    ] });
  expect(String(submitted!.idempotency_key)).toBeTruthy();
  await expect.poll(() => uploads).toBe(1);
});

test("UC-FA-08 AF20 links the processing voucher to a recorded count", async ({ page }) => {
  await login(page);
  let updated: Record<string, any> | null = null;
  const record = {
    id: countId, voucher_no: "KKTS00009", number: "KKTS00009", count_date: "2026-09-30", count_date_display: "30/09/2026",
    report_datetime: "01/10/2026 09:00:00", purpose: "Kiểm kê quý 3", conclusion: "Thiếu 01 tài sản.", status: "CONFIRMED",
    status_display: "Đã ghi nhận", recommendations_processed: false, reference_journal_ids: [], attachments: [],
    members: [{ name: "Lê Thị Hoa", position: "Kế toán", represent: "Phòng Kế toán", role: "Trưởng ban" }],
    summary: { book_assets_count: 1, matched_count: 0, diff_count: 1 },
    lines: [{ asset_id: assetId, asset_code: "TS001", asset_name: "Máy CNC", book_department_name: "Phòng kỹ thuật",
      actual_department_name: "Phòng kỹ thuật", original_cost: "120000000", depreciable_amount: "100000000",
      accumulated_depreciation: "20000000", remaining_value: "100000000", existence_status: "MISSING", exists: false,
      current_quality: "", note: "Không có tại kho", recommendation: "Ghi giảm TSCĐ thiếu", recommendation_status: "PENDING" }],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const list = (results: unknown[]) => route.fulfill({ json: { results } });
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [company] });
    if (path === "/api/v1/fixed-assets/counts/") return list([record]);
    if (path === `/api/v1/fixed-assets/counts/${countId}/`) return route.fulfill({ json: record });
    if (path === `/api/v1/fixed-assets/counts/${countId}/update-stocktake/`) {
      updated = route.request().postDataJSON();
      return route.fulfill({ json: { ...record, recommendations_processed: true, status: "PROCESSED",
        message: "Lưu biên bản kiểm kê tài sản cố định thành công." } });
    }
    if (path === "/api/v1/fixed-assets/assets/") return list([assetRow(assetId, "TS001", "Máy CNC")]);
    return list([]);
  });

  await page.goto("/assets/stocktake");
  await page.getByRole("button", { name: "Xem danh sách chứng từ" }).click();
  await expect(page.getByText("Đã ghi nhận").first()).toBeVisible();
  await page.getByText("KKTS00009").click();
  await page.getByRole("button", { name: "Xử lý kiến nghị" }).click();
  await page.getByTestId("stocktake-resolution-voucher-0").fill("GGTS00012");
  await page.getByTestId("stocktake-processed").check();
  await page.getByRole("button", { name: "Lưu xử lý kiến nghị" }).click();
  await expect.poll(() => updated).not.toBeNull();
  // BR62: the count results go back unchanged; only the processing basis is new
  expect(updated).toMatchObject({ voucher_no: "KKTS00009", recommendations_processed: true,
    members: [{ name: "Lê Thị Hoa", role: "Trưởng ban" }],
    lines: [{ asset: assetId, existence_status: "MISSING", note: "Không có tại kho",
      recommendation: "Ghi giảm TSCĐ thiếu", resolution_voucher_no: "GGTS00012" }] });
});
