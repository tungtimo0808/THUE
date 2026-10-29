import { expect, test } from "@playwright/test";

test("UC-GL-11 runs from the Tổng hợp screen and shows persisted results", async ({ page }) => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const periodId = "22222222-2222-4222-8222-222222222222";
  const company = { id: companyId, name: "Công ty kiểm thử", accounting_regime: "TT99" };
  await page.addInitScript(({ companyId, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "gl-reconciliation-test", companyId, companies: [company], user: { id: "tester" },
  })), { companyId, company });

  let runPayload: Record<string, unknown> | null = null;
  let runCount = 0;
  let latestRun: Record<string, unknown> | null = null;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const list = (results: unknown[]) => route.fulfill({ json: { results } });
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [company] });
    if (path === "/api/v1/general-ledger/periods/") return list([{
      id: periodId, code: "2026-10", fiscal_year: 2026, start_date: "2026-10-01", end_date: "2026-10-31",
    }]);
    if (path === "/api/v1/general-ledger/reconciliations/" && route.request().method() === "GET") return list(latestRun ? [latestRun] : []);
    if (path === "/api/v1/general-ledger/reconciliations/run/" && route.request().method() === "POST") {
      runPayload = route.request().postDataJSON();
      runCount += 1;
      latestRun = {
        id: `run-${runCount}`, period: periodId, period_code: "2026-10", status: "DIFFERENCE", reconciliation_type: "GL_AR",
        snapshot_watermark: "WM-REAL", completed_at: "2026-10-29T01:00:00Z",
        lines: [{ id: "line-1", line_no: 1, reconciliation_key: "ACC:131|OBJ:KH01|CURR:VND",
          account_code: "131", account_name: "Phải thu", object_code: "KH01", object_name: "Khách hàng 01",
          gl_period_debit: "100", sub_period_debit: "80", gl_net_closing: "100", sub_net_closing: "80",
          diff_closing: "20", status: "DIFFERENCE", discrepancy_type: "AMOUNT_MISMATCH",
          discrepancy_reason: "Sai số tiền", gl_entries_refs: [], subledger_vouchers_refs: [] }],
      };
      return route.fulfill({ status: 201, json: latestRun });
    }
    if (path.endsWith("/drilldown/")) return route.fulfill({ json: {
      is_snapshot_stale: false, lines: [{ gl_entries: [{ entry_number: "GL-01", posting_date: "2026-10-20", debit: "100", credit: "0", status: "POSTED" }], subledger_vouchers: [] }],
    } });
    return list([]);
  });

  await page.goto("/ledger/process");
  await page.getByRole("button", { name: "Đối chiếu số liệu", exact: true }).click();
  await expect(page.getByText("Chưa đối chiếu", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /Kỳ kế toán/ })).toContainText("2026-10");
  await page.getByRole("button", { name: "Đối chiếu", exact: true }).click();
  await expect.poll(() => runPayload).not.toBeNull();
  expect(runPayload).toMatchObject({ period: "2026-10", reconciliation_type: "GL_AR" });
  await expect(page.getByText("WM-REAL")).toBeVisible();
  await expect(page.getByText("Sai số tiền")).toBeVisible();
  await page.getByRole("button", { name: /Drill-down/ }).click();
  await expect(page.getByText("GL-01")).toBeVisible();
  await page.getByRole("button", { name: "Đối chiếu lại" }).click();
  await expect.poll(() => runCount).toBe(2);
  await expect(page.getByText("DIFFERENCE — Có chênh lệch cần kiểm tra")).toBeVisible();
  await page.getByRole("button", { name: "Lịch sử đối chiếu" }).click();
  await expect(page.getByRole("button", { name: /2026-10 · GL_AR · DIFFERENCE/ })).toBeVisible();
});
