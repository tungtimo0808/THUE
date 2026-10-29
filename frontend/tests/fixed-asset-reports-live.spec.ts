import { expect, test, type Page } from "@playwright/test";

const companyId = "11111111-1111-4111-8111-111111111111";
const company = { id: companyId, name: "Công ty Siêu Nhỏ", accounting_regime: "TT58", bookkeeping_method: "SIMPLE" };

async function login(page: Page) {
  await page.addInitScript(({ companyId, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "fa-report-test", companyId, companies: [company], user: { id: "tester" },
  })), { companyId, company });
}

const catalogItem = (code: string, uiId: string, group: string, title: string, extra: Record<string, unknown> = {}) => ({
  code, ui_id: uiId, group_code: group, title, title_vi: title, title_en: title, form_code: code, keywords: [title.toLowerCase()],
  supports_period: true, supports_year: true, supports_department: true, supports_category: false, ...extra,
});

test("UC-FA-09 catalog follows the regime and the S4b-DNSN register is shown as built by the backend", async ({ page }) => {
  await login(page);
  let reportBody: Record<string, any> | null = null;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [company] });
    if (path === "/api/v1/fixed-assets/assets/report-catalog/") return route.fulfill({ json: {
      hidden_report_codes: [], uses_general_ledger: false, accounting_regime: "TT58",
      reports: [
        catalogItem("ASSET_REGISTER", "SO_TSCD", "ASSET_REPORTS", "Sổ tài sản cố định"),
        catalogItem("S4B_DNSN", "S4B", "ASSET_REPORTS", "S4b-DNSN: Sổ tài sản cố định",
          { supports_period: false, supports_department: false, supports_category: true, requires_year: true }),
        catalogItem("RECONCILE_STOCKTAKE_FA", "DC_KIEM_KE", "RECONCILE_REPORTS", "Báo cáo đối chiếu kết quả kiểm kê với sổ tài sản",
          { supports_count_selection: true }),
      ],
    } });
    if (path === "/api/v1/fixed-assets/assets/reports/") {
      reportBody = route.request().postDataJSON();
      return route.fulfill({ json: {
        report_code: "S4B_DNSN", form_code: "Mẫu số S4b-DNSN", form_version: "Mẫu số S4b-DNSN (Ban hành theo Thông tư số 58/2026/TT-BTC)",
        title: "S4b-DNSN: Sổ tài sản cố định", is_empty: false, empty_message: "",
        header: { company_name: "Công ty Siêu Nhỏ", period_label: "Năm 2026", currency: "VND" },
        columns: [{ key: "stt", label: "STT" }, { key: "code", label: "Số hiệu TSCĐ" }, { key: "name", label: "Tên, đặc điểm, ký hiệu TSCĐ" },
          { key: "original_cost", label: "Nguyên giá TSCĐ" }, { key: "depreciation_rate_display", label: "Khấu hao - Tỷ lệ (%)" },
          { key: "accumulated_depreciation", label: "Khấu hao lũy kế" }],
        rows: [{ stt: 1, code: "TS001", name: "Máy CNC", original_cost: "120000000.00", depreciation_rate_display: "20.00%", accumulated_depreciation: "24000000.00" }],
        totals: { original_cost: "120000000.00", accumulated_depreciation: "24000000.00" },
        signatures: { prepared_by_label: "Người lập biểu", chief_accountant_label: "Kế toán trưởng", director_label: "Giám đốc" },
      } });
    }
    return route.fulfill({ json: { results: [] } });
  });

  await page.goto("/assets/reports");
  // B03–B04: only what the backend offers for a TT58 single-entry book – no S21-DN, no GL reconciliation
  await expect(page.getByText("S4b-DNSN: Sổ tài sản cố định")).toBeVisible();
  await expect(page.getByText("S21-DN: Sổ tài sản cố định")).toHaveCount(0);
  await expect(page.getByText("S21 - DN: Sổ tài sản cố định")).toHaveCount(0);
  await expect(page.getByText("Báo cáo đối chiếu sổ tài sản và sổ cái")).toHaveCount(0);

  await page.getByText("S4b-DNSN: Sổ tài sản cố định").click();
  // BR21: a yearly template asks for the year, not for a date range or a department
  await expect(page.getByTestId("report-year")).toBeVisible();
  await expect(page.getByText("Từ ngày:")).toHaveCount(0);
  await page.getByTestId("report-year").fill("2026");
  await page.getByRole("button", { name: "Xem báo cáo" }).click();
  await expect.poll(() => reportBody).not.toBeNull();
  expect(reportBody).toMatchObject({ report_code: "S4B_DNSN", year: 2026 });

  const report = page.getByTestId("api-report");
  await expect(report.getByText("Mẫu số S4b-DNSN (Ban hành theo Thông tư số 58/2026/TT-BTC)")).toBeVisible();
  await expect(report.getByRole("cell", { name: "Máy CNC" })).toBeVisible();
  await expect(report.getByRole("cell", { name: "Tổng cộng" })).toBeVisible();
  // BR54: the rate is never summed
  const totalRow = report.locator("tr", { hasText: "Tổng cộng" });
  await expect(totalRow).not.toContainText("%");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel dạng dữ liệu" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
});

test("UC-FA-09 the register lists the backend rows and hides TK NG without a GL", async ({ page }) => {
  await login(page);
  let registerQuery = "";
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [company] });
    if (path === "/api/v1/fixed-assets/assets/register/") {
      registerQuery = url.search;
      const items = url.searchParams.get("search") === "không-có" ? [] : [{
        id: "a1", code: "TS001", name: "Máy CNC", category_name: "Máy móc", department_name: "Phòng kỹ thuật",
        acquisition_date_display: "01/01/2026", original_cost: "120000000.00", accumulated_depreciation: "24000000.00",
        remaining_value: "96000000.00", depreciation_rate_display: "20.00%", asset_account_code: "", status_display: "Đang sử dụng",
      }];
      return route.fulfill({ json: { uses_general_ledger: false, items, summary: {}, empty_message: items.length ? "" : "Không có tài sản cố định phù hợp với điều kiện tìm kiếm." } });
    }
    return route.fulfill({ json: { results: [] } });
  });

  await page.goto("/assets/register");
  await expect(page.getByRole("cell", { name: "Máy CNC" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "TK NG" })).toHaveCount(0);
  expect(registerQuery).toContain(`company_id=${companyId}`);
  await page.getByPlaceholder(/Tìm mã, tên tài sản/).fill("không-có");
  await expect(page.getByText("Không có tài sản cố định phù hợp với điều kiện tìm kiếm.")).toBeVisible();
});
