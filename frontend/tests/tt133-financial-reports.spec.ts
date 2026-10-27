import { expect, test } from "@playwright/test";

const codes = ["B01a-DNN", "B01b-DNN", "B02-DNN", "B03-DNN", "B03-DNN-GT", "B09-DNN", "F01-DNN"];

test("all seven TT133 statement tabs load ledger-backed report payloads", async ({ page }) => {
  let savedNote = "";
  await page.addInitScript(() => {
    localStorage.setItem("erp_token", "test-token");
    localStorage.setItem("erp_company_id", "tt133-company");
    localStorage.setItem("erp_api_session", JSON.stringify({
      token: "test-token", access: "test-token", companyId: "tt133-company",
      companies: [{ id: "tt133-company", code: "TT133", name: "Công ty TT133", status: "ACTIVE" }],
      user: { id: "1", username: "tester", is_superuser: true },
    }));
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/tt133-financial-statements/")) {
      if (route.request().method() === "PATCH" && url.pathname.endsWith("/notes/")) {
        savedNote = JSON.parse(route.request().postData() || "{}").content;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ section_code: "I", content: savedNote }) });
        return;
      }
      const code = url.searchParams.get("template_code") || codes[0];
      const isTrial = code === "F01-DNN";
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        code, title: `Báo cáo ${code}`, year: Number(url.searchParams.get("year")),
        company_name: "Công ty TT133", has_data: true, warnings: [],
        rows: code === "B09-DNN"
          ? [{ code: "I", name: "Đặc điểm hoạt động", status: savedNote ? "COMPLETE" : "REQUIRES_INPUT", narrative: savedNote, current: null, previous: null }]
          : isTrial
          ? [{ code: "111", name: "Tiền mặt", opening_debit: "1000", opening_credit: "0", period_debit: "200", period_credit: "0", closing_debit: "1200", closing_credit: "0" }]
          : [{ code: "01", name: "Chỉ tiêu từ sổ cái", current: "1200", previous: "900" }],
      }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/reports");
  await page.locator(".misa-reports-cat-btn").filter({ hasText: "Báo cáo tài chính" }).first().click();
  await page.getByText("B01a-DNN: Báo cáo tình hình tài chính", { exact: true }).click();
  await expect(page.getByRole("tablist", { name: "Mẫu báo cáo TT133" })).toBeVisible();
  await expect(page.locator(".tt133-sheet h1")).toHaveText("Báo cáo B01a-DNN");
  for (const code of codes) {
    await page.getByRole("tab", { name: code, exact: true }).click();
    await expect(page.locator(".tt133-sheet h1")).toHaveText(`Báo cáo ${code}`);
    await expect(page.locator(".tt133-sheet tbody tr")).toHaveCount(1);
  }
  await expect(page.locator(".tt133-sheet").getByRole("cell", { name: "Tiền mặt" })).toBeVisible();
  await page.getByRole("tab", { name: "B09-DNN", exact: true }).click();
  await page.getByRole("textbox", { name: "Thuyết minh I" }).fill("Hoạt động thương mại.");
  await page.getByRole("button", { name: "Lưu thuyết minh" }).click();
  await expect(page.getByRole("textbox", { name: "Thuyết minh I" })).toHaveValue("Hoạt động thương mại.");
  expect(savedNote).toBe("Hoạt động thương mại.");
});
