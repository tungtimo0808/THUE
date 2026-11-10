import { test, expect } from "@playwright/test";

const email = process.env.UI_TEST_EMAIL;
const password = process.env.UI_TEST_PASSWORD;
const baseURL = process.env.UI_BASE_URL || "http://127.0.0.1:2601";
let session: { token: string; refresh: string; companyId: string; companies: unknown[]; user: unknown };
let headquartersId = "all";

test.use({
  storageState: { cookies: [], origins: [] },
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } }
    : {}),
});
test.skip(!email || !password, "Set UI_TEST_EMAIL and UI_TEST_PASSWORD for the local test account.");

test.beforeAll(async ({ request }) => {
  const login = await request.post(`${baseURL}/api/v1/common/auth/login/`, {
    data: { email, password },
  });
  expect(login.ok()).toBeTruthy();
  const auth = await login.json();
  const response = await request.get(`${baseURL}/api/v1/common/companies/mine/`, {
    headers: { Authorization: `Bearer ${auth.access}` },
  });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const companies = Array.isArray(data) ? data : data.results;
  expect(companies.length).toBeGreaterThan(0);
  session = { token: auth.access, refresh: auth.refresh, companyId: companies[0].id, companies, user: auth.user };
  const branchResponse = await request.get(`${baseURL}/api/v1/organization/branches/?company_id=${session.companyId}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  expect(branchResponse.ok()).toBeTruthy();
  const branchData = await branchResponse.json();
  const branches = Array.isArray(branchData) ? branchData : branchData.results;
  headquartersId = (branches.find((branch: { is_head_office?: boolean }) => branch.is_head_office) || branches[0])?.id || "all";
});

test.afterAll(async ({ request }) => {
  if (session) {
    await request.post(`${baseURL}/api/v1/common/auth/logout/`, {
      headers: { Authorization: `Bearer ${session.token}` },
      data: { refresh: session.refresh },
    });
  }
});

for (const width of [2560, 1440, 1024, 768, 390]) {
  for (const module of ["assets", "payroll", "cash", "bank", "purchases", "sales", "inventory", "tools", "ledger", "cost", "overview"]) {
    test(`${module} fits ${width}px without overlapping process nodes`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 2560 ? 1296 : 1000 });
      await page.addInitScript(({ session, width, headquartersId }) => {
        localStorage.setItem("erp_api_session", JSON.stringify(session));
        if (width === 2560) {
          localStorage.setItem("ref_dataset", "management-2025");
          localStorage.setItem("ref_branch", headquartersId);
        }
      }, { session, width, headquartersId });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseURL}/${module}${module === "overview" ? "" : "/process"}`);
      await expect(page.locator(".reference-app")).toBeVisible();
      await expect(page.locator(module === "overview" ? ".ref-overview" : ".ref-process-layout").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);

      const geometry = await page.evaluate(() => {
        const rect = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        };
        const nodes = [...new Set([...document.querySelectorAll(".ref-business-icon, .sv-cost-flow-node")].map((icon) => icon.matches(".sv-cost-flow-node") ? icon : icon.closest(".sv-flow-node") || icon.parentElement!))]
          .filter((node) => node.getClientRects().length)
          .map((node) => ({ text: node.textContent?.trim(), ...rect(node) }));
        const overlaps: string[] = [];
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) {
              overlaps.push(`${a.text} / ${b.text}`);
            }
          }
        }
        const layout = document.querySelector(".ref-process-layout");
        const wrapper = document.querySelector(".ref-process-wrapper");
        const bounds = layout ? rect(layout) : null;
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 2,
          overlaps,
          hiddenIcons: [...document.querySelectorAll(".ref-document-sheet")].filter((icon) => getComputedStyle(icon).display === "none").length,
          layout: layout ? rect(layout) : null,
          wrapper: wrapper ? rect(wrapper) : null,
          nodes,
          clippedNodes: bounds ? nodes.filter((node) => node.left < bounds.left - 2 || node.right > bounds.right + 2).map((node) => node.text) : [],
          shortcutsHeight: document.querySelector(".sv-process-shortcuts")?.getBoundingClientRect().height,
        };
      });
      expect(errors).toEqual([]);
      expect(geometry.overflow, JSON.stringify(geometry)).toBe(false);
      expect(geometry.overlaps, JSON.stringify(geometry.nodes)).toEqual([]);
      expect(geometry.clippedNodes).toEqual([]);
      expect(geometry.hiddenIcons).toBe(0);
      if (module === "payroll") {
        expect(geometry.shortcutsHeight).toBeGreaterThan(40);
        await expect(page.locator(".sv-payroll-integration")).toHaveCount(0);
      }
      if (geometry.layout && geometry.wrapper) {
        expect(geometry.layout.width).toBeGreaterThanOrEqual(Math.min(geometry.wrapper.width - 100, 1000));
      }
      if (["assets", "payroll", "overview", "cost"].includes(module) && [2560, 1440, 390].includes(width)) {
        await page.screenshot({ path: `test-results/process-layout-verified/${module}-${width}.png`, fullPage: true });
      }
    });
  }
}

for (const width of [1440, 390]) {
  test(`payroll attendance navigation works at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((value) => localStorage.setItem("erp_api_session", JSON.stringify(value)), session);
    await page.goto(`${baseURL}/payroll/process`);
    await page.locator(".sv-flow-node:has(.attendance)").click();
    await expect(page).toHaveURL(/\/payroll\/attendance/);
  });

  test(`asset increase form opens at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((value) => localStorage.setItem("erp_api_session", JSON.stringify(value)), session);
    await page.goto(`${baseURL}/assets/process`);
    await page.locator(".sv-flow-node:has(.increase)").click();
    await expect(page.getByText(/^Ghi tăng tài sản cố định /).first()).toBeVisible();
  });
}
