import { chromium } from "playwright";
import path from "path";

const TARGET_URL = "http://localhost:2601";
const ARTIFACT_DIR = "C:/Users/timodapoet/.gemini/antigravity/brain/e8f23b0f-139f-4bc3-afd5-6a68e71aea85";

async function verifyButtonFixes() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    locale: "vi-VN",
  });

  const companyId = "0c2d32eb-e313-4631-90bb-3d070e258ffc";
  const company = {
    id: companyId,
    code: "TUNGHIHIHI",
    name: "Công ty TNHH Tunghihihi",
    tax_code: "0110888999",
  };
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzkzODcxNDU1LCJpYXQiOjE3OTM4Njk2NTUsImp0aSI6ImM5MTY2Yjc5MzRkYjRjNWFhN2MwZTNlYWUzZWY3ZDkyIiwidXNlcl9pZCI6IjE3In0._cHMPmotB3qCwN6kJgUpEAGnSqLKp9qk54to4KOObbg";

  await context.addInitScript(({ token, companyId, company }) => {
    localStorage.setItem("erp_token", token);
    localStorage.setItem("erp_company_id", companyId);
    localStorage.setItem("erp_api_session", JSON.stringify({
      token, access: token, access_token: token, refresh: token,
      companyId, companies: [company], company,
      user: { id: "17", username: "admin", display_name: "Đỗ Đức Tùng" },
    }));
  }, { token, companyId, company });

  const page = await context.newPage();

  // 1. Verify Adjustments / Errors banner
  console.log("1. Checking /invoices/adjustments...");
  await page.goto(`${TARGET_URL}/invoices/adjustments`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "verify_btn_01_adjustments.png") });

  // 2. Verify Supplier Risk Drawer
  console.log("2. Checking /invoices/risk-warning/supplier-risk...");
  await page.goto(`${TARGET_URL}/invoices/risk-warning/supplier-risk`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const firstRiskBtn = await page.$("button:has-text('Xem rủi ro')");
  if (firstRiskBtn) {
    await firstRiskBtn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "verify_btn_02_supplier_risk_drawer.png") });

  // 3. Verify Incoming Invoice Inbox & Detail
  console.log("3. Checking /invoices/incoming/inbox...");
  await page.goto(`${TARGET_URL}/invoices/incoming/inbox`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const invoiceRows = await page.$$(".erp3-invoice-item");
  if (invoiceRows.length > 2) {
    await invoiceRows[2].click(); // Click on Tiến Phát like in user image
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "verify_btn_03_incoming_inbox.png") });

  // 4. Verify Unposted invoices & banner
  console.log("4. Checking /invoices/unposted...");
  await page.goto(`${TARGET_URL}/invoices/unposted`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "verify_btn_04_unposted.png") });

  // 5. Verify Cash Limit Warning
  console.log("5. Checking /invoices/risk-warning/cash-limit...");
  await page.goto(`${TARGET_URL}/invoices/risk-warning/cash-limit`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "verify_btn_05_cash_limit.png") });

  console.log("DONE VERIFICATION SCREENSHOTS!");
  await browser.close();
}

verifyButtonFixes().catch(console.error);
