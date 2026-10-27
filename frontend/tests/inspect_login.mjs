import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TARGET_URL = "http://13.140.177.110:2601";
const SCREENSHOT_DIR = "d:/THUẾ/frontend/tests/screenshots/remote_audit";

async function loginAndInspect() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", msg => console.log("[CONSOLE]", msg.type(), msg.text()));
  page.on("requestfailed", req => console.log("[REQ FAILED]", req.url(), req.failure()));
  page.on("response", async res => {
    if (res.status() >= 400) {
      const text = await res.text().catch(() => "");
      console.log(`[HTTP ${res.status()}]`, res.url(), text.substring(0, 200));
    }
  });

  console.log("Navigating to login...");
  await page.goto(`${TARGET_URL}/login`, { waitUntil: "networkidle" });

  // Dump input elements
  const inputs = await page.$$eval("input", els => els.map(e => ({
    name: e.name, id: e.id, type: e.type, placeholder: e.placeholder, className: e.className
  })));
  console.log("Inputs found:", inputs);

  // Dump buttons
  const buttons = await page.$$eval("button", els => els.map(e => ({
    type: e.type, text: e.innerText.trim(), className: e.className
  })));
  console.log("Buttons found:", buttons);

  // Fill credentials: first text/email input, second password input
  const allInputs = await page.$$("input");
  let usernameInput = null;
  let passwordInput = null;

  for (const input of allInputs) {
    const type = await input.getAttribute("type");
    if (type === "password") {
      passwordInput = input;
    } else if (type === "text" || type === "email" || !type) {
      if (!usernameInput) usernameInput = input;
    }
  }

  if (usernameInput && passwordInput) {
    console.log("Filling login credentials...");
    await usernameInput.fill("superadmin@soviet.vn");
    await passwordInput.fill("SuperAdmin@2026");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10_login_filled.png") });

    const submitBtn = await page.$('button[type="submit"]') || await page.$('button:has-text("Đăng nhập")');
    if (submitBtn) {
      console.log("Clicking submit...");
      await Promise.all([
        page.waitForResponse(res => res.url().includes("/api/"), { timeout: 10000 }).catch(e => console.log("API response wait timed out")),
        submitBtn.click()
      ]);
      await page.waitForTimeout(4000);
    }
  }

  console.log("Current URL after login:", page.url());
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "11_logged_in.png"), fullPage: true });

  const localStorageData = await page.evaluate(() => JSON.stringify(window.localStorage));
  console.log("LocalStorage token check:", localStorageData.includes("token") || localStorageData.includes("auth"));

  await browser.close();
}

loginAndInspect().catch(console.error);

