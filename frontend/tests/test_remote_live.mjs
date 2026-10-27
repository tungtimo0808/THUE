import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TARGET_URL = "http://13.140.177.110:2601";
const SCREENSHOT_DIR = "d:/THUẾ/frontend/tests/screenshots/remote_audit";

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runAudit() {
  console.log(`\n======================================================`);
  console.log(`[AUDIT] Starting Live Remote Audit on ${TARGET_URL}`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarns = [];
  const networkFailures = [];
  const slowRequests = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`[BROWSER ERROR] ${msg.text()}`);
    } else if (msg.type() === "warning") {
      consoleWarns.push(`[BROWSER WARN] ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(`[PAGE UNCAUGHT] ${err.message}\n${err.stack}`);
  });

  page.on("requestfailed", (req) => {
    networkFailures.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || "unknown failure",
    });
  });

  page.on("response", async (res) => {
    const timing = res.request().timing();
    const duration = timing?.responseEnd;
    if (duration && duration > 2000) {
      slowRequests.push({
        url: res.url(),
        status: res.status(),
        durationMs: Math.round(duration),
      });
    }
  });

  // Step 1: Initial Page Load
  console.log(`[STEP 1] Navigating to ${TARGET_URL}...`);
  const t0 = Date.now();
  try {
    const response = await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const tLoad = Date.now() - t0;
    console.log(`-> DOMContentLoaded reached in ${tLoad}ms, HTTP status: ${response?.status()}`);
    await page.waitForTimeout(2000); // Allow react hydration
  } catch (err) {
    console.error(`[ERROR] Failed to load ${TARGET_URL}:`, err.message);
    await browser.close();
    return;
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_initial_load.png"), fullPage: true });
  console.log(`-> Saved screenshot: 01_initial_load.png`);

  const currentUrl = page.url();
  console.log(`-> Current URL after load: ${currentUrl}`);

  // Step 2: Check if Login Form is displayed or if already logged in
  const isLoginPage = await page.$('input[name="login"], input[type="email"], input[placeholder*="email"], input[placeholder*="tài khoản"], input[placeholder*="Tên đăng nhập"]');
  console.log(`-> Is Login Form present: ${Boolean(isLoginPage)}`);

  if (isLoginPage) {
    console.log(`[STEP 2] Attempting login with superadmin credentials...`);
    const loginInput = isLoginPage;
    const passwordInput = await page.$('input[type="password"]');

    if (loginInput && passwordInput) {
      await loginInput.fill("superadmin@soviet.vn");
      await passwordInput.fill("SuperAdmin@2026");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_login_filled.png") });

      const submitBtn = await page.$('button[type="submit"], button:has-text("Đăng nhập")');
      if (submitBtn) {
        await submitBtn.click();
        console.log(`-> Clicked submit button, waiting for navigation or workspace...`);
        await page.waitForTimeout(4000);
      }
    }
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_after_login_state.png"), fullPage: true });
  console.log(`-> Current URL after login attempt: ${page.url()}`);

  // Step 3: Inspect Workspace Navigation and Active Elements
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
  console.log(`-> Page snippet:\n${bodyText.replace(/\n\s*\n/g, '\n').substring(0, 300)}...`);

  // Step 4: Check Company Admin & Roles if accessible
  console.log(`[STEP 4] Checking Company Admin Workspace...`);
  await page.goto(`${TARGET_URL}/company-admin`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_company_admin.png"), fullPage: true });

  const adminPageText = await page.evaluate(() => document.body.innerText);
  console.log(`-> Company Admin URL: ${page.url()}`);
  
  // Extract permission button texts: e.g. "Quyền (229)" or "Quyền (929)"
  const permButtons = await page.$$eval('button:has-text("Quyền")', (btns) => btns.map((b) => b.innerText.trim()));
  console.log(`-> Permission buttons found on page:`, permButtons);

  // Check role counts
  const roleTextMatches = adminPageText.match(/Bộ vai trò hiện có[:\s]+(\d+)\s+vai trò/i) || adminPageText.match(/Vai trò & Ma trận phân quyền\s*\((\d+)\)/i);
  console.log(`-> Role count match:`, roleTextMatches ? roleTextMatches[0] : "Not found in text");

  // Step 5: Test Tab Switching & Delay in Accounting Workspace
  console.log(`[STEP 5] Testing Tab Switching Performance...`);
  await page.goto(`${TARGET_URL}/?module=cash`, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const modulesToTest = ["cash", "bank", "sales", "purchases", "inventory", "reports", "tax"];
  const switchTimings = [];

  for (const mod of modulesToTest) {
    const tStart = Date.now();
    // Try clicking sidebar link or navigating
    const link = await page.$(`a[href*="module=${mod}"], button[data-module="${mod}"]`);
    if (link) {
      await link.click();
      await page.waitForTimeout(200);
    } else {
      await page.goto(`${TARGET_URL}/?module=${mod}`, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
    }
    const tDur = Date.now() - tStart;
    switchTimings.push({ module: mod, switchTimeMs: tDur });
  }
  console.log(`-> Tab Switch Timings:`, switchTimings);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_after_tab_switch.png"), fullPage: true });

  // Summary of issues discovered
  console.log(`\n======================================================`);
  console.log(`[AUDIT SUMMARY ON 13.140.177.110:2601]`);
  console.log(`======================================================`);
  console.log(`Total Console Errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log(`  ! ${e}`));
  console.log(`Total Network Failures: ${networkFailures.length}`);
  networkFailures.forEach((f) => console.log(`  ! [${f.method}] ${f.url} -> ${f.failure}`));
  console.log(`Total Slow Requests (>2s): ${slowRequests.length}`);
  slowRequests.forEach((s) => console.log(`  ! ${s.url} -> ${s.durationMs}ms (HTTP ${s.status})`));
  console.log(`Permission button texts: ${JSON.stringify(permButtons)}`);
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log(`======================================================\n`);

  await browser.close();
}

runAudit().catch((err) => {
  console.error("FATAL ERROR in audit:", err);
  process.exit(1);
});
