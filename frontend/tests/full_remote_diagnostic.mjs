import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TARGET_URL = "http://13.140.177.110:2601";
const SCREENSHOT_DIR = "d:/THUẾ/frontend/tests/screenshots/remote_audit";

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runFullDiagnostic() {
  console.log(`\n======================================================`);
  console.log(`[DIAGNOSTIC] Deep Inspection of Live Remote Server: ${TARGET_URL}`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    locale: "vi-VN",
  });
  const page = await context.newPage();

  const consoleLogs = [];
  const consoleErrors = [];
  const networkRequests = [];
  const networkFailures = [];

  page.on("console", (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === "error") {
      consoleErrors.push(text);
      console.log(`[BROWSER ERROR]`, text);
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(`[PAGE CRASH/UNCAUGHT] ${err.message}`);
    console.log(`[PAGE ERROR]`, err.message);
  });

  page.on("request", (req) => {
    networkRequests.push({ url: req.url(), method: req.method(), time: Date.now() });
  });

  page.on("requestfailed", (req) => {
    networkFailures.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || "unknown",
    });
    console.log(`[REQ FAILED]`, req.method(), req.url(), req.failure()?.errorText);
  });

  // --------------------------------------------------------------------------
  // STEP 1: Login
  // --------------------------------------------------------------------------
  console.log(`\n--- STEP 1: LOGIN ---`);
  const tNavStart = Date.now();
  await page.goto(`${TARGET_URL}/login`, { waitUntil: "networkidle", timeout: 20000 });
  console.log(`Login page loaded in ${Date.now() - tNavStart}ms`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step1_login_page.png") });

  await page.fill("#auth-identifier", "superadmin@soviet.vn");
  await page.fill("#auth-password", "SuperAdmin@2026");
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
  console.log(`URL after login: ${page.url()}`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step1_after_login.png") });

  // --------------------------------------------------------------------------
  // STEP 2: Select Company ABC
  // --------------------------------------------------------------------------
  console.log(`\n--- STEP 2: SELECT COMPANY ---`);
  if (page.url().includes("select-company")) {
    const companyCards = await page.$$eval(".company-card, [class*='company-item'], button, tr", (els) =>
      els.map((e) => e.innerText.trim()).filter((t) => t.includes("ABC"))
    );
    console.log(`Found ABC entries:`, companyCards);

    // Click on ABC company card or button
    const abcBtn = await page.$("text=CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC") ||
                   await page.$("text=ABC") ||
                   await page.$("button:has-text('Vào làm việc')") ||
                   await page.$("button:has-text('Chọn')");

    if (abcBtn) {
      console.log("Clicking company ABC card/button...");
      await abcBtn.click();
      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle").catch(() => {});
    }
  }

  console.log(`URL after company selection: ${page.url()}`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step2_company_selected.png") });

  // --------------------------------------------------------------------------
  // STEP 3: Check Company Admin & Permissions Count
  // --------------------------------------------------------------------------
  console.log(`\n--- STEP 3: COMPANY ADMIN & PERMISSIONS INSPECTION ---`);
  await page.goto(`${TARGET_URL}/company-admin`, { waitUntil: "networkidle", timeout: 15000 });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step3_company_admin_tab1.png") });

  // Look for Tab 2: "Nhân sự & Phân quyền"
  const tab2 = await page.$('button:has-text("Nhân sự & Phân quyền")') ||
               await page.$('text=2. Nhân sự & Phân quyền');
  if (tab2) {
    console.log("Switching to Tab 2: Nhân sự & Phân quyền...");
    await tab2.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step3_tab2_nhan_su.png") });

    // Inspect user table and permission button numbers
    const usersData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr, div[class*='user-row'], div[class*='membership']"));
      return rows.map((r) => r.innerText.trim()).filter((t) => t.includes("superadmin") || t.includes("Tùng") || t.includes("Quyền"));
    });
    console.log("Users & Roles on Tab 2:\n", usersData.join("\n---\n"));

    const permButtons = await page.$$eval('button:has-text("Quyền")', (btns) =>
      btns.map((b) => b.innerText.trim())
    );
    console.log(">>> Live Permission Buttons on 13.140.177.110:", permButtons);
  }

  // Look for Tab 3: "Vai trò & Ma trận phân quyền"
  const tab3 = await page.$('button:has-text("Vai trò & Ma trận phân quyền")') ||
               await page.$('text=3. Vai trò & Ma trận phân quyền');
  if (tab3) {
    console.log("Switching to Tab 3: Vai trò & Ma trận phân quyền...");
    await tab3.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step3_tab3_roles.png") });

    const rolesData = await page.evaluate(() => {
      const el = document.querySelector("main") || document.body;
      return el.innerText;
    });
    console.log("Roles overview on Tab 3:\n", rolesData.substring(0, 1500));
  }

  // --------------------------------------------------------------------------
  // STEP 4: Test Tab Switching & User Experience Latency
  // --------------------------------------------------------------------------
  console.log(`\n--- STEP 4: TAB SWITCHING PERFORMANCE & LATENCY ---`);
  await page.goto(`${TARGET_URL}/?module=overview`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1000);

  const testModules = [
    { name: "Tiền mặt (cash)", id: "cash" },
    { name: "Tiền gửi (bank)", id: "bank" },
    { name: "Mua hàng (purchases)", id: "purchases" },
    { name: "Bán hàng (sales)", id: "sales" },
    { name: "Kho (inventory)", id: "inventory" },
    { name: "Báo cáo (reports)", id: "reports" },
    { name: "Thuế (tax)", id: "tax" },
    { name: "Tài sản cố định (assets)", id: "assets" },
  ];

  const switchResults = [];

  for (const mod of testModules) {
    const tStart = performance.now();
    // Try finding sidebar link
    const sidebarLink = await page.$(`a[href*="module=${mod.id}"], nav button:has-text("${mod.name.split(' ')[0]}")`);
    if (sidebarLink) {
      await sidebarLink.click();
    } else {
      await page.goto(`${TARGET_URL}/?module=${mod.id}`);
    }

    // Wait until workspace content container is visible
    await page.waitForSelector("main, .workspace-content, .reference-content", { timeout: 10000 });
    const elapsed = Math.round(performance.now() - tStart);

    // Check if any error alert / toast is visible
    const errorToast = await page.$(".toast-error, .alert-error, div[role='alert']");
    const errorText = errorToast ? await errorToast.innerText() : null;

    switchResults.push({
      module: mod.name,
      latencyMs: elapsed,
      hasError: Boolean(errorText),
      errorMsg: errorText,
    });
    console.log(`  -> Switched to ${mod.name}: ${elapsed}ms ${errorText ? `[ERROR: ${errorText}]` : "OK"}`);
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step4_tab_switching_final.png") });

  // --------------------------------------------------------------------------
  // STEP 5: Test Switching Back (Cache / Keep-Alive Check)
  // --------------------------------------------------------------------------
  console.log(`\n--- STEP 5: SECOND TAB SWITCH (KEEP-ALIVE / CACHE VERIFICATION) ---`);
  const cachedSwitchResults = [];
  for (const mod of testModules.slice(0, 4)) {
    const tStart = performance.now();
    const sidebarLink = await page.$(`a[href*="module=${mod.id}"], nav button:has-text("${mod.name.split(' ')[0]}")`);
    if (sidebarLink) {
      await sidebarLink.click();
    } else {
      await page.goto(`${TARGET_URL}/?module=${mod.id}`);
    }
    await page.waitForTimeout(50);
    const elapsed = Math.round(performance.now() - tStart);
    cachedSwitchResults.push({ module: mod.name, latencyMs: elapsed });
    console.log(`  -> Re-visited ${mod.name}: ${elapsed}ms`);
  }

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log(`\n======================================================`);
  console.log(`[FINAL LIVE DIAGNOSTIC REPORT FOR 13.140.177.110:2601]`);
  console.log(`======================================================`);
  console.log(`Console Errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log(`  * ${e}`));
  console.log(`Network Failures: ${networkFailures.length}`);
  networkFailures.forEach((f) => console.log(`  * [${f.method}] ${f.url} -> ${f.failure}`));
  console.log(`Tab Switching Latencies:`, switchResults);
  console.log(`Cached Tab Latencies:`, cachedSwitchResults);
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log(`======================================================\n`);

  await browser.close();
}

runFullDiagnostic().catch((err) => {
  console.error("DIAGNOSTIC CRASHED:", err);
  process.exit(1);
});
