import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TARGET_URL = "http://13.140.177.110:2601";
const SCREENSHOT_DIR = "d:/THUẾ/frontend/tests/screenshots/page_ux_audit_actual";

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function auditActualPages() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  console.log("Logging in...");
  await page.goto(`${TARGET_URL}/login`, { waitUntil: "networkidle" });
  await page.fill("#auth-identifier", "superadmin@soviet.vn");
  await page.fill("#auth-password", "SuperAdmin@2026");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Click ABC
  const abcBtn = await page.$("text=CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC");
  if (abcBtn) await abcBtn.click();
  await page.waitForTimeout(3000);

  const modules = [
    { path: "/cash", name: "Tiền mặt" },
    { path: "/bank", name: "Tiền gửi" },
    { path: "/purchases", name: "Mua hàng" },
    { path: "/sales", name: "Bán hàng" },
    { path: "/inventory", name: "Kho" },
    { path: "/tools", name: "Công cụ dụng cụ" },
    { path: "/assets", name: "Tài sản cố định" },
    { path: "/tax", name: "Thuế" },
    { path: "/cost", name: "Giá thành" },
    { path: "/ledger", name: "Tổng hợp" },
    { path: "/reports", name: "Báo cáo" },
    { path: "/company-admin", name: "Quản trị Doanh nghiệp" },
    { path: "/super-admin", name: "Platform Super Admin" },
  ];

  const results = [];

  for (const mod of modules) {
    const t0 = performance.now();
    await page.goto(`${TARGET_URL}${mod.path}`, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
    const loadMs = Math.round(performance.now() - t0);

    const safeName = mod.path.replace(/\//g, "");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${safeName}.png`) });

    const pageSummary = await page.evaluate(() => {
      const title = document.querySelector("h1, h2, .workspace-title, .ref-header-title")?.innerText || "";
      const buttons = Array.from(document.querySelectorAll("button")).map(b => b.innerText.trim()).filter(Boolean);
      const tables = document.querySelectorAll("table");
      const rows = document.querySelectorAll("tr");
      const inputs = document.querySelectorAll("input");
      const errorDivs = document.querySelectorAll(".error, .alert-danger, [role='alert']");
      const bodySnippet = document.body.innerText.substring(0, 400).replace(/\n\s*\n/g, '\n');

      return {
        title,
        buttonCount: buttons.length,
        buttons: buttons.slice(0, 8),
        tableCount: tables.length,
        rowCount: rows.length,
        inputCount: inputs.length,
        hasError: errorDivs.length > 0,
        errorText: errorDivs[0]?.innerText || null,
        bodySnippet,
      };
    });

    results.push({
      path: mod.path,
      name: mod.name,
      loadMs,
      summary: pageSummary,
    });

    console.log(`\n--- [PAGE] ${mod.name} (${mod.path}) - ${loadMs}ms ---`);
    console.log(`Title: ${pageSummary.title || "No specific H1/H2"}`);
    console.log(`Action buttons (${pageSummary.buttonCount}):`, pageSummary.buttons);
    console.log(`Data tables: ${pageSummary.tableCount} tables, ${pageSummary.rowCount} rows`);
    console.log(`Content snippet:\n${pageSummary.bodySnippet.substring(0, 200)}...`);
  }

  fs.writeFileSync(path.join(SCREENSHOT_DIR, "page_audit_results.json"), JSON.stringify(results, null, 2));
  await browser.close();
}

auditActualPages().catch(console.error);

