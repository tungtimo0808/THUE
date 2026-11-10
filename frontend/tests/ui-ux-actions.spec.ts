import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { notificationRoute } from "../src/notification-routing";

const email = process.env.UI_TEST_EMAIL;
const password = process.env.UI_TEST_PASSWORD;
const baseURL = process.env.UI_BASE_URL || "http://127.0.0.1:2601";
let session: any;
test.use({ storageState: { cookies: [], origins: [] }, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } } : {}) });
test.skip(!email || !password, "Set UI_TEST_EMAIL and UI_TEST_PASSWORD.");
test.beforeAll(async ({ request }) => {
  const response = await request.post(`${baseURL}/api/v1/common/auth/login/`, { data: { email, password } });
  expect(response.ok()).toBeTruthy();
  const auth = await response.json();
  const data = await (await request.get(`${baseURL}/api/v1/common/companies/mine/`, { headers: { Authorization: `Bearer ${auth.access}` } })).json();
  const companies = Array.isArray(data) ? data : data.results;
  session = { token: auth.access, refresh: auth.refresh, user: auth.user, companyId: companies[0].id, companies };
});
test.afterAll(async ({ request }) => { if (session) await request.post(`${baseURL}/api/v1/common/auth/logout/`, { headers: { Authorization: `Bearer ${session.token}` }, data: { refresh: session.refresh } }); });
test.beforeEach(async ({ page }) => { await page.addInitScript((session) => localStorage.setItem("erp_api_session", JSON.stringify(session)), session); });

async function notificationFixture(page: Page, count = 2, pending = false) {
  const state = { read: false, failRead: false, unavailable: false, failLoad: false, opened: 0 };
  await page.route(/\/api\/v1\/common\/notifications\//, async (route) => {
    const url = route.request().url();
    if (url.includes("read-all/")) {
      if (state.failRead) return route.fulfill({ status: 503, json: { detail: "Không cập nhật được trạng thái đọc." } });
      state.read = true;
      return route.fulfill({ json: { updated: count } });
    }
    if (url.includes("/open/")) {
      state.opened++;
      return route.fulfill({ json: { available: !state.unavailable, link: "/cash/advance-settlement-request?document=abc", detail: "Chứng từ không còn khả dụng." } });
    }
    if (state.failLoad) return route.fulfill({ status: 503, json: { detail: "Không tải được thông báo." } });
    return route.fulfill({ json: { results: Array.from({ length: count }, (_, index) => ({ id: `notice-${index}`, title: `Thông báo chứng từ ${index + 1}`, message: "Có chứng từ cần kiểm tra và xử lý.", source_module: "CASH", level: "NORMAL", created_at: "2026-11-10T02:00:00Z", read_at: state.read ? "2026-11-10T03:00:00Z" : null, link: "/cash/transactions" })) } });
  });
  await page.route(/\/api\/v1\/cash\/payment-requests\//, (route) => route.fulfill({ json: pending ? [{ id: "pending-1", code: "DNC-TEST", status: "PENDING_APPROVAL", purpose: "Đề nghị chi cần duyệt", amount: 150000, request_date: "2026-11-10" }] : [] }));
  await page.route(/\/api\/v1\/cash\/advance-settlement-docs\//, (route) => route.fulfill({ json: [] }));
  return state;
}
async function openNotifications(page: Page) {
  await page.goto(`${baseURL}/overview`);
  await page.getByRole("button", { name: "Thông báo", exact: true }).click();
  await expect(page.locator(".notification-list")).toHaveAttribute("aria-busy", "false");
}

test("notification links preserve the document and reject external targets", () => {
  const route = new URL(notificationRoute("/cash/advance-settlement-request?document=42", "company-a", "2025-12"), baseURL);
  expect(route.pathname).toBe("/cash/advance-settlement");
  expect(route.searchParams.get("document")).toBe("42");
  expect(route.searchParams.get("company")).toBe("company-a");
  expect(() => notificationRoute("https://other.example/path", "company-a", "2025-12")).toThrow();
});

for (const width of [1440, 390]) {
  test(`notifications keep the first row and footer visible at ${width}px`, async ({ page }) => {
    await notificationFixture(page, 12);
    await openNotifications(page);
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".notification-row")).toHaveCount(12);
    const list = await page.locator(".notification-list").boundingBox();
    const first = await page.locator(".notification-row").first().boundingBox();
    const footer = await page.locator(".notification-footer").boundingBox();
    expect(first!.y).toBeGreaterThanOrEqual(list!.y - 1);
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(900);
    await expect(page.getByRole("button", { name: "Đọc tất cả", exact: true })).toBeEnabled();
    await page.screenshot({ path: `test-results/ui-ux-verified/notifications-${width}.png` });
  });
}

test("empty notifications do not invent alerts or pending vouchers", async ({ page }) => {
  await notificationFixture(page, 0);
  await openNotifications(page);
  await expect(page.locator(".notification-row")).toHaveCount(0);
  await expect(page.locator(".notification-empty")).toContainText("Chưa có thông báo");
  await expect(page.getByRole("button", { name: "Đọc tất cả", exact: true })).toBeDisabled();
  await expect(page.getByText("Cảnh báo quỹ", { exact: true })).toHaveCount(0);
});

test("filters work and opening a notification uses the server action", async ({ page }) => {
  const state = await notificationFixture(page, 2, true);
  await openNotifications(page);
  await expect(page.locator(".notification-row")).toHaveCount(3);
  await page.locator(".notification-filters").getByRole("button", { name: "Chờ duyệt 1", exact: true }).click();
  await expect(page.locator(".notification-row")).toHaveCount(1);
  await page.locator(".notification-filters").getByRole("button", { name: "Hệ thống 2", exact: true }).click();
  await page.locator(".notification-row").first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/cash\/advance-settlement\?/);
  expect(state.opened).toBe(1);
  expect(new URL(page.url()).searchParams.get("document")).toBe("abc");
});

test("failed read-all keeps unread state and allows retry", async ({ page }) => {
  const state = await notificationFixture(page);
  state.failRead = true;
  await openNotifications(page);
  await page.getByRole("button", { name: "Đọc tất cả", exact: true }).click();
  await expect(page.locator(".notification-error")).toContainText("Không cập nhật");
  await expect(page.locator(".notification-unread-dot")).toHaveCount(2);
  state.failRead = false;
  await page.getByRole("button", { name: "Đọc tất cả", exact: true }).click();
  await expect(page.locator(".notification-unread-dot")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Thông báo", exact: true }).click();
  await expect(page.locator(".notification-unread-dot")).toHaveCount(0);
});

test("an unavailable document stays in the dialog with an explanation", async ({ page }) => {
  const state = await notificationFixture(page);
  state.unavailable = true;
  await openNotifications(page);
  await page.locator(".notification-row").first().click();
  await expect(page.locator(".notification-error")).toContainText("không còn khả dụng");
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.locator(".notification-panel")).toBeVisible();
});

test("notification loading can be retried and view-all opens the correct tab", async ({ page }) => {
  const state = await notificationFixture(page);
  state.failLoad = true;
  await openNotifications(page);
  await expect(page.locator(".notification-error")).toBeVisible();
  state.failLoad = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.locator(".notification-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Xem tất cả", exact: true }).click();
  await expect(page).toHaveURL(/\/common\?.*tab=notifications/);
});

test("success feedback is non-modal and does not block another action", async ({ page }) => {
  await page.goto(`${baseURL}/overview`);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("soviet_global_popup_event", { detail: { type: "success", message: "Đã lưu dữ liệu." } })));
  await expect(page.locator(".feedback-toast[role='status']")).toBeVisible();
  await page.getByRole("button", { name: "Thông báo", exact: true }).click();
  await expect(page.locator(".notification-panel")).toBeVisible();
});

test("asset export creates a real XLSX workbook", async ({ page }, testInfo) => {
  await page.goto(`${baseURL}/assets/increase?view=table`);
  await expect(page.getByRole("button", { name: "Xuất khẩu", exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất khẩu", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const path = testInfo.outputPath("assets.xlsx");
  await download.saveAs(path);
  const workbook = XLSX.read(await readFile(path), { type: "buffer" });
  const cells = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  expect(JSON.stringify(cells)).toContain("Số chứng từ");
});

async function openBorrowReport(page: Page) {
  await page.goto(`${baseURL}/reports`);
  await page.getByPlaceholder("Tìm theo tên báo cáo").fill("Báo cáo tổng hợp tình hình khế ước vay");
  await page.getByRole("link", { name: "Báo cáo tổng hợp tình hình khế ước vay", exact: true }).click();
  await expect(page.getByRole("button", { name: "Lưu báo cáo", exact: true })).toBeVisible();
}

test("saved reports persist and can be reopened and exported", async ({ page }) => {
  await openBorrowReport(page);
  await page.getByRole("button", { name: "Lưu báo cáo", exact: true }).click();
  await expect(page.locator(".feedback-toast")).toContainText("Đã lưu báo cáo trên trình duyệt này");
  await openBorrowReport(page);
  await page.getByRole("button", { name: "Báo cáo đã lưu", exact: true }).click();
  await expect(page.locator(".saved-report-list li")).toHaveCount(1);
  await page.locator(".saved-report-list li > button").first().click();
  await expect(page.getByRole("table", { name: "Nội dung báo cáo đã lưu" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "Xuất Excel", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
});

test("the payroll print button prepares the report for printing", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__printed = false;
    window.addEventListener("message", (event) => { if (event.data === "ui-print-called") (window as any).__printed = true; });
    window.print = () => window.parent.postMessage("ui-print-called", "*");
  });
  await page.goto(`${baseURL}/payroll/process`);
  await page.getByText("Báo cáo tổng hợp lương nhân viên", { exact: true }).click();
  await page.getByRole("button", { name: "In báo cáo", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__printed)).toBe(true);
});

test("unconfigured device actions do not pretend to synchronize", async ({ page }) => {
  await page.goto(`${baseURL}/payroll/attendance`);
  await expect(page.getByRole("button", { name: "Máy chấm công chưa kết nối", exact: true })).toBeDisabled();
});

for (const [module, start] of Object.entries({ cash: "transactions", bank: "transactions", purchases: "transactions", sales: "transactions", inventory: "receipts", tools: "register", assets: "register", payroll: "attendance", ledger: "transactions", cost: "continuous-simple", budget: "planning", insurance: "declarations" })) {
  test(`${module} opens its working screen directly`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}/${module}?company=${session.companyId}&period=2026-11`);
    await expect(page.locator('.ref-module-bar nav a.active')).toHaveAttribute("href", new RegExp(`/${module}/${start}(\\?|$)`));
    await expect(page.locator('.ref-process-layout')).toHaveCount(0);
    if (!["cost", "insurance"].includes(module)) await expect(page.locator('#reference-main table').first()).toBeVisible();
    await expect(page).toHaveURL(/period=2026-11/);
    expect(errors).toEqual([]);
  });
}

test("common hub goes straight to tabs and admin goes straight to members", async ({ page }) => {
  await page.goto(`${baseURL}/common`);
  await expect(page.getByRole("navigation", { name: "Chức năng dùng chung" })).toBeVisible();
  await expect(page.locator(".common-hub-summary")).toHaveCount(0);
  await page.goto(`${baseURL}/admin`);
  await expect(page.locator(".admin-nav-tab.active")).toContainText("Nhân sự & Phân quyền");
  await expect(page.locator(".admin-kpi-grid")).toHaveCount(0);
});
