import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto(
    "/inventory/production-orders?company=minh-an&period=2026-09",
  );
});

test("app shell follows the accounting workspace specification and brand palette", async ({
  page,
}) => {
  await expect(page.getByRole("link", { name: /KẾ TOÁN/ })).toBeVisible();
  await expect(page.getByLabel("Doanh nghiệp", { exact: true })).toHaveValue(
    "minh-an",
  );
  await expect(page.getByLabel("Dữ liệu kế toán")).toBeVisible();
  await expect(page.getByLabel("Kỳ kế toán", { exact: true })).toHaveValue(
    "2026-09",
  );

  const sidebar = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(
    sidebar.getByRole("link", { name: "Quản lý hóa đơn" }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "Kho", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "Thuế", exact: true }),
  ).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Danh mục" })).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "Số dư ban đầu" }),
  ).toBeVisible();

  const moduleNav = page.getByRole("navigation", {
    name: "Chức năng phân hệ",
  });
  for (const tab of [
    "Quy trình",
    "Biểu đồ",
    "Nhập kho",
    "Xuất kho",
    "Chuyển kho",
    "Lệnh sản xuất",
    "Lắp ráp, tháo dỡ",
    "Kiểm kê",
    "Báo cáo",
    "Hàng hóa, dịch vụ",
  ]) {
    await expect(
      moduleNav.getByRole("link", { name: tab, exact: true }),
    ).toBeVisible();
  }

  const palette = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const app = getComputedStyle(document.querySelector(".reference-app")!);
    return {
      primary: root.getPropertyValue("--primary").trim().toLowerCase(),
      canvas: app.getPropertyValue("--ref-canvas").trim().toLowerCase(),
    };
  });
  expect(palette).toEqual({ primary: "#606c38", canvas: "#ffe8d6" });
});

test("production order list supports search, bulk actions and quick detail", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Lệnh sản xuất", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(5);

  await page.getByLabel("Tìm lệnh sản xuất").fill("LSX-0002");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("LSX-0002");

  await page.getByLabel("Chọn LSX-0002").check();
  await expect(page.getByText("Đã chọn 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ghi sổ" })).toBeVisible();

  await page.getByRole("button", { name: "Xem nhanh LSX-0002" }).click();
  const detail = page.getByRole("region", { name: "Chi tiết nhanh" });
  await expect(detail).toContainText("Bộ bàn ăn gỗ sồi");
  await expect(detail.getByRole("tab", { name: "Hàng hóa" })).toBeVisible();
});

test("filter state is shareable and empty state can be reset", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Bộ lọc" }).click();
  await page.getByLabel("Trạng thái lệnh").selectOption("in-progress");
  await page.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
  await expect(page).toHaveURL(/status=in-progress/);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(2);

  await page.getByLabel("Tìm lệnh sản xuất").fill("không có dữ liệu");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy lệnh sản xuất" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(5);
});

test("quick create is grouped and the workspace is accessible on desktop and mobile", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Thêm nhanh" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm nhanh chứng từ" });
  await expect(dialog.getByRole("heading", { name: "TIỀN MẶT" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "KHO" })).toBeVisible();
  await page.keyboard.press("Escape");

  const desktop = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(desktop.violations).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mở điều hướng" }).click();
  await expect(
    page.getByRole("navigation", { name: "Điều hướng chính" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("a multi-line draft persists and remains separated by company", async ({
  page,
}) => {
  await page.goto("/cash/transactions?company=minh-an&period=2026-09");
  await page.getByRole("button", { name: "Thêm nhanh" }).click();
  await page.getByRole("button", { name: "Thu tiền mặt", exact: true }).click();
  await page
    .getByLabel("Đối tượng", { exact: false })
    .fill("Khách hàng kiểm thử");
  await page
    .getByLabel("Diễn giải", { exact: false })
    .fill("Phiếu thu kiểm thử giao diện");
  await page.getByLabel("Số tiền dòng 1", { exact: true }).fill("2500000");
  await page.getByRole("button", { name: "Sao chép dòng 1" }).click();
  await expect(page.locator(".form-total")).toContainText("5.000.000");
  await page.getByRole("button", { name: "Lưu bản nháp" }).click();

  await page.reload();
  await page
    .getByLabel("Tìm trong danh sách")
    .fill("Phiếu thu kiểm thử giao diện");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("5.000.000");

  await page
    .getByLabel("Doanh nghiệp", { exact: true })
    .selectOption("an-phat");
  await expect(page.locator("tbody tr")).toHaveCount(0);
});

test("storage failure keeps unsaved document input", async ({ page }) => {
  await page.goto("/cash/transactions?company=minh-an&period=2026-09");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Thêm nhanh" }).click();
  await page.getByRole("button", { name: "Thu tiền mặt", exact: true }).click();
  await page.getByLabel("Đối tượng", { exact: false }).fill("Dữ liệu cần giữ");
  await page.getByLabel("Diễn giải", { exact: false }).fill("Kiểm thử lưu trữ");
  await page.getByLabel("Số tiền dòng 1", { exact: true }).fill("100000");
  await page
    .getByRole("button", { name: "Lưu & thêm mới", exact: true })
    .click();

  await expect(page.getByRole("alert")).toContainText("Không thể lưu phiếu");
  await expect(page.getByLabel("Đối tượng", { exact: false })).toHaveValue(
    "Dữ liệu cần giữ",
  );
  await expect(page.getByLabel("Số tiền dòng 1", { exact: true })).toHaveValue(
    "100000",
  );
});

test("global shell exposes branch, work mode, grouped search and tab settings", async ({
  page,
}) => {
  await expect(page.getByLabel("Chi nhánh, đơn vị")).toBeVisible();
  await page.getByRole("button", { name: /Chế độ làm việc: Kế toán/ }).click();
  const modeMenu = page.getByRole("dialog", { name: "Chọn chế độ làm việc" });
  await expect(modeMenu.getByRole("button", { name: "Thủ kho" })).toBeVisible();
  await expect(modeMenu.getByRole("button", { name: "Thủ quỹ" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByLabel("Tìm kiếm thông minh").fill("phiếu");
  const results = page.getByRole("region", {
    name: "Kết quả tìm kiếm thông minh",
  });
  await expect(
    results.getByRole("heading", { name: "Chứng từ" }),
  ).toBeVisible();
  await expect(
    results.getByRole("heading", { name: "Hàng hóa, dịch vụ" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Tùy chọn hiển thị" }).click();
  const tabSettings = page.getByRole("dialog", { name: "Thiết lập tab Kho" });
  await expect(tabSettings.getByLabel("Hiển thị Biểu đồ")).toBeChecked();
  await expect(
    tabSettings.getByText("Kéo thả hoặc dùng nút mũi tên"),
  ).toBeVisible();
});

test("purchase orders use a detailed list, quick detail and full document", async ({
  page,
}) => {
  await page.goto("/purchases/orders?company=minh-an&period=2026-09");
  await expect(
    page.getByRole("heading", { name: "Đơn mua hàng" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Nhà cung cấp" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Tình trạng" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xem nhanh PO-2609-001" }).click();
  await expect(
    page.getByRole("region", { name: "Chi tiết nhanh" }),
  ).toContainText("Công ty TNHH Gỗ Việt");
  await page.getByRole("button", { name: "Mở đầy đủ PO-2609-001" }).click();
  const document = page.getByRole("dialog", {
    name: /Đơn mua hàng PO-2609-001/,
  });
  await expect(
    document.getByRole("heading", { name: "Thông tin nhà cung cấp" }),
  ).toBeVisible();
  await expect(
    document.getByRole("tab", { name: "Hàng hóa, dịch vụ" }),
  ).toBeVisible();
  await expect(document).toContainText("Chứng từ mua hàng đã lập");
});

test("incoming invoice processing has inbox, preview and accounting actions", async ({
  page,
}) => {
  await page.goto(
    "/purchases/invoice-processing?company=minh-an&period=2026-09",
  );
  await expect(
    page.getByRole("heading", { name: "Xử lý hóa đơn đầu vào" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Danh sách hóa đơn đầu vào" }),
  ).toBeVisible();
  const preview = page.getByRole("region", { name: "Xem trước hóa đơn" });
  await expect(preview).toContainText("Công ty TNHH Gỗ Việt");
  await expect(
    preview.getByRole("button", { name: "Lập chứng từ mua hàng" }),
  ).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "Liên kết chứng từ" }),
  ).toBeVisible();
});

test("report center, master data and opening balances are real workspaces", async ({
  page,
}) => {
  await page.goto("/reports?company=minh-an&period=2026-09");
  await expect(
    page.getByRole("heading", { name: "Trung tâm báo cáo" }),
  ).toBeVisible();
  await expect(page.getByLabel("Tìm báo cáo")).toBeVisible();
  await expect(
    page.getByText("Báo cáo tình hình tài chính", { exact: true }),
  ).toBeVisible();

  await page.goto("/directory?company=minh-an&period=2026-09");
  await expect(page.getByRole("heading", { name: "Danh mục" })).toBeVisible();
  await expect(page.getByRole("tree", { name: "Nhóm danh mục" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Mã" })).toBeVisible();

  await page.goto("/opening?company=minh-an&period=2026-09");
  await expect(
    page.getByRole("heading", { name: "Số dư ban đầu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Số dư tài khoản" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nhập từ Excel" }),
  ).toBeVisible();
});

test("a configured module tab never falls back to an unavailable placeholder", async ({
  page,
}) => {
  await page.goto("/assets/register?company=minh-an&period=2026-09");
  await expect(page.getByRole("heading", { name: "Sổ tài sản" })).toBeVisible();
  await expect(page.getByLabel("Tìm trong Sổ tài sản")).toBeVisible();
  await expect(
    page.getByText("Chưa có dữ liệu nghiệp vụ cho chức năng này."),
  ).toHaveCount(0);
});

test("sidebar hover reveals audited child navigation and supports deep links", async ({
  page,
}) => {
  const sidebar = page.getByRole("navigation", { name: "Điều hướng chính" });
  const tools = sidebar.getByRole("link", {
    name: "Công cụ dụng cụ",
    exact: true,
  });

  await tools.hover();
  const flyout = page.getByRole("menu", {
    name: "Mục con Công cụ dụng cụ",
  });
  await expect(flyout).toBeVisible();
  await expect(
    flyout.getByRole("menuitem", {
      name: "Quản lý công cụ dụng cụ",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    flyout.getByRole("menuitem", { name: "Ghi tăng CCDC", exact: true }),
  ).toBeVisible();
  await expect(
    flyout.getByRole("menuitem", {
      name: "Danh sách chi phí trả trước",
      exact: true,
    }),
  ).toBeVisible();

  await tools.focus();
  await expect(flyout).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(flyout).toBeHidden();
  await page.locator(".ref-brand").hover();
  await tools.hover();
  await expect(flyout).toBeVisible();

  await flyout
    .getByRole("menuitem", { name: "Ghi tăng CCDC", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tools\/management\/increase/);
  await expect(
    page.getByRole("heading", { name: "Ghi tăng CCDC", exact: true }),
  ).toBeVisible();
  const innerTabs = page.getByRole("navigation", {
    name: "Chức năng bên trong Quản lý công cụ dụng cụ",
  });
  await expect(
    innerTabs.getByRole("link", { name: "Phân bổ chi phí" }),
  ).toBeVisible();
  await expect(innerTabs.getByRole("link", { name: "Kiểm kê" })).toBeVisible();
});

test("V5 keeps actions and document concerns out of the module tab bar", async ({
  page,
}) => {
  await page.goto("/tools/management?company=minh-an&period=2026-09");
  const toolsTabs = page.getByRole("navigation", {
    name: "Chức năng phân hệ",
  });
  await expect(toolsTabs.getByRole("link")).toHaveCount(5);
  await expect(
    toolsTabs.getByRole("link", {
      name: "Quản lý công cụ dụng cụ",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    toolsTabs.getByRole("link", { name: "Ghi tăng", exact: true }),
  ).toHaveCount(0);

  await page.goto("/tax/declarations?company=minh-an&period=2026-09");
  const taxTabs = page.getByRole("navigation", { name: "Chức năng phân hệ" });
  await expect(taxTabs.getByRole("link")).toHaveCount(1);
  await expect(
    taxTabs.getByRole("link", { name: "Khai thuế", exact: true }),
  ).toBeVisible();

  await page.goto("/ledger/process?company=minh-an&period=2026-09");
  const ledgerTabs = page.getByRole("navigation", {
    name: "Chức năng phân hệ",
  });
  await expect(
    ledgerTabs.getByRole("link", { name: "Khóa sổ", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Quy trình Tổng hợp", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Khóa sổ", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kiểm tra đối chiếu", exact: true }),
  ).toBeVisible();
});

test("process nodes navigate to their audited workspace routes", async ({
  page,
}) => {
  await page.goto("/bank/process?company=minh-an&period=2026-09");
  await page
    .locator(".ref-process-canvas")
    .getByRole("link", { name: "Đối chiếu ngân hàng", exact: true })
    .click();
  await expect(page).toHaveURL(/\/bank\/reconciliation/);

  await page.goto("/purchases/process?company=minh-an&period=2026-09");
  await page
    .locator(".ref-process-canvas")
    .getByRole("link", { name: "Xử lý hóa đơn đầu vào", exact: true })
    .click();
  await expect(page).toHaveURL(/\/purchases\/invoice-processing/);
});
