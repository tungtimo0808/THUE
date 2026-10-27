import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TARGET_URL = "http://13.140.177.110:2601";
const SCREENSHOT_DIR = "d:/THUẾ/frontend/tests/screenshots/crawler_audit";

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runDeepCrawler() {
  console.log(`\n======================================================`);
  console.log(`[DEEP CRAWLER] Starting exhaustive test of 13.140.177.110:2601`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    locale: "vi-VN",
  });
  const page = await context.newPage();

  const allIssues = [];
  const apiErrors = [];
  const consoleErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const txt = msg.text();
      consoleErrors.push(txt);
      console.log(`  [BROWSER ERROR] ${txt.substring(0, 150)}`);
    }
  });

  page.on("pageerror", (err) => {
    allIssues.push({ type: "CRASH/UNCAUGHT", msg: err.message, stack: err.stack });
    console.log(`  [PAGE CRASH] ${err.message}`);
  });

  page.on("response", async (res) => {
    const status = res.status();
    if (status >= 400) {
      const url = res.url();
      let body = "";
      try {
        body = await res.text();
      } catch (e) {}
      apiErrors.push({ status, url, method: res.request().method(), body: body.substring(0, 300) });
      console.log(`  [API ${status}] ${res.request().method()} ${url} -> ${body.substring(0, 120)}`);
    }
  });

  // Login
  console.log(`[1] Logging into system...`);
  await page.goto(`${TARGET_URL}/login`, { waitUntil: "networkidle" });
  await page.fill("#auth-identifier", "superadmin@soviet.vn");
  await page.fill("#auth-password", "SuperAdmin@2026");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Enter ABC company
  if (page.url().includes("select-company")) {
    const abcBtn = await page.$("text=CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC") ||
                   await page.$("button:has-text('Vào làm việc')") ||
                   await page.$("text=ABC");
    if (abcBtn) {
      await abcBtn.click();
      await page.waitForTimeout(3000);
    }
  }
  console.log(`Logged in. Current URL: ${page.url()}`);

  // List of all business modules to crawl
  const modules = [
    { code: "overview", name: "Tổng quan", subTabs: ["overview"] },
    { code: "cash", name: "Tiền mặt", subTabs: ["process", "receipt", "payment", "fund", "audit"] },
    { code: "bank", name: "Tiền gửi", subTabs: ["process", "deposit", "withdrawal", "transfer", "statement", "reconciliation"] },
    { code: "purchases", name: "Mua hàng", subTabs: ["process", "orders", "vouchers", "invoices", "returns", "contracts"] },
    { code: "sales", name: "Bán hàng", subTabs: ["process", "quotes", "orders", "vouchers", "invoices", "returns", "policy"] },
    { code: "inventory", name: "Kho", subTabs: ["process", "inward", "outward", "transfer", "inventory-count", "stock-card"] },
    { code: "tools", name: "Công cụ dụng cụ", subTabs: ["process", "allocation", "decrease", "inventory"] },
    { code: "assets", name: "Tài sản cố định", subTabs: ["process", "depreciation", "revaluation", "inventory"] },
    { code: "tax", name: "Thuế", subTabs: ["declarations", "vat-purchase", "vat-sales", "corporate-tax"] },
    { code: "cost", name: "Giá thành", subTabs: ["process", "cost-period", "allocation", "unfinished"] },
    { code: "ledger", name: "Tổng hợp", subTabs: ["process", "other-vouchers", "closing", "allocation"] },
    { code: "budget", name: "Ngân sách", subTabs: ["charts", "setup"] },
    { code: "reports", name: "Báo cáo", subTabs: ["financial", "management", "tax", "audit"] },
  ];

  for (const mod of modules) {
    console.log(`\n[MODULE] Checking ${mod.name} (${mod.code})...`);
    try {
      await page.goto(`${TARGET_URL}/?module=${mod.code}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1000);

      // Check if empty state or modal triggers exist
      const actionButtons = await page.$$eval("button", (btns) =>
        btns
          .map((b) => b.innerText.trim())
          .filter((t) => t.includes("Thêm") || t.includes("Lập") || t.includes("Tạo mới") || t.includes("Khởi tạo") || t.includes("Nạp"))
      );
      console.log(`  -> Action buttons in ${mod.code}:`, actionButtons.slice(0, 5));

      // Try clicking first 2 action buttons to verify modals don't crash
      for (const btnText of actionButtons.slice(0, 2)) {
        try {
          const btn = await page.$(`button:has-text("${btnText}")`);
          if (btn && await btn.isVisible()) {
            console.log(`     Testing action button: "${btnText}"...`);
            await btn.click({ timeout: 2000 });
            await page.waitForTimeout(800);

            // Check if modal or drawer opened
            const modalOpen = await page.$(".modal, [role='dialog'], .drawer, [class*='Modal'], [class*='Drawer']");
            if (modalOpen) {
              console.log(`     Modal opened cleanly for "${btnText}"`);
              // Close modal via close button or Escape
              const closeBtn = await page.$("button:has-text('Đóng'), button:has-text('Hủy'), [aria-label='Close'], button.close");
              if (closeBtn) await closeBtn.click().catch(() => {});
              else await page.keyboard.press("Escape").catch(() => {});
              await page.waitForTimeout(400);
            }
          }
        } catch (btnErr) {
          console.log(`     Button test note: ${btnErr.message}`);
        }
      }

      // Check subtabs
      for (const sub of mod.subTabs.slice(1, 4)) {
        const subTabBtn = await page.$(`button:has-text("${sub}"), a[href*="tab=${sub}"]`);
        if (subTabBtn && await subTabBtn.isVisible()) {
          await subTabBtn.click().catch(() => {});
          await page.waitForTimeout(500);
        }
      }

    } catch (modErr) {
      console.log(`  [MODULE ERROR] ${mod.code}: ${modErr.message}`);
      allIssues.push({ module: mod.code, error: modErr.message });
    }
  }

  // Check Settings / Company Admin Workspace
  console.log(`\n[MODULE] Checking Company Admin...`);
  await page.goto(`${TARGET_URL}/company-admin`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1000);

  // Check Super Admin Workspace (Platform)
  console.log(`\n[MODULE] Checking Super Admin Platform Workspace...`);
  await page.goto(`${TARGET_URL}/super-admin`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1500);
  const platformText = await page.evaluate(() => document.body.innerText.substring(0, 400));
  console.log(`Platform page snippet:\n${platformText}`);

  // Summary
  console.log(`\n======================================================`);
  console.log(`[DEEP CRAWLER AUDIT SUMMARY]`);
  console.log(`======================================================`);
  console.log(`Total API Errors (4xx/5xx): ${apiErrors.length}`);
  const uniqueApiErrors = [...new Map(apiErrors.map(item => [item.url + item.status, item])).values()];
  uniqueApiErrors.forEach(e => {
    console.log(`  * [${e.status}] ${e.method} ${e.url}`);
    console.log(`    Response: ${e.body}`);
  });

  console.log(`\nTotal Browser Console Errors: ${consoleErrors.length}`);
  const uniqueConsoleErrors = [...new Set(consoleErrors)];
  uniqueConsoleErrors.forEach(e => console.log(`  * ${e}`));

  console.log(`\nTotal Page Crashes / Exceptions: ${allIssues.length}`);
  allIssues.forEach(i => console.log(`  * ${JSON.stringify(i)}`));
  console.log(`======================================================\n`);

  await browser.close();
}

runDeepCrawler().catch(console.error);

