import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TARGET_URL = "http://13.140.177.110:2601";
const SCREENSHOT_DIR = "d:/THUẾ/frontend/tests/screenshots/page_ux_audit";

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runPageUxAudit() {
  console.log(`\n======================================================`);
  console.log(`[UX/UI AUDIT] Detailed Page-by-Page Inspection: ${TARGET_URL}`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    locale: "vi-VN",
  });
  const page = await context.newPage();

  const auditResults = [];

  // Helper to measure action latency
  async function measureInteraction(name, actionFn) {
    const start = performance.now();
    await actionFn();
    const duration = Math.round(performance.now() - start);
    return duration;
  }

  // -------------------------------------------------------------
  // PAGE 1: Login & Authentication
  // -------------------------------------------------------------
  console.log(`[PAGE 1] Auditing Login Screen (/login)...`);
  const tLoginLoad = await measureInteraction("Login Page Load", () =>
    page.goto(`${TARGET_URL}/login`, { waitUntil: "networkidle" })
  );
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_login.png") });

  // Test input focus & type responsiveness
  const tTypeEmail = await measureInteraction("Type email", async () => {
    await page.fill("#auth-identifier", "superadmin@soviet.vn");
  });
  const tTypePass = await measureInteraction("Type password", async () => {
    await page.fill("#auth-password", "SuperAdmin@2026");
  });

  const tLoginSubmit = await measureInteraction("Login click to response", async () => {
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
  });

  auditResults.push({
    page: "Đăng nhập (/login)",
    loadTimeMs: tLoginLoad,
    interactions: [
      { name: "Nhập email", timeMs: tTypeEmail },
      { name: "Nhập mật khẩu", timeMs: tTypePass },
      { name: "Click Đăng nhập chuyển hướng", timeMs: tLoginSubmit },
    ],
    uiAssessment: {
      visualPolish: "Hiện đại, bố cục chia 2 cột thương hiệu & form, Be Vietnam Pro chuẩn",
      accessibility: "Có label, placeholder rõ ràng, hỗ trợ phím Enter để submit",
      feedback: "Chưa có spinner hiệu ứng loading xoay tròn bên trong nút khi click submit",
    },
  });

  // -------------------------------------------------------------
  // PAGE 1b: Select Company (/select-company)
  // -------------------------------------------------------------
  console.log(`[PAGE 1b] Auditing Company Selection Screen...`);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01b_select_company.png") });
  const companyCardsCount = await page.$$eval(".company-card, [class*='company-item'], tr", els => els.length);

  const tSelectCompany = await measureInteraction("Select ABC company", async () => {
    const abcBtn = await page.$("text=CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC") ||
                   await page.$("button:has-text('Vào làm việc')") ||
                   await page.$("text=ABC");
    if (abcBtn) {
      await abcBtn.click();
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
    }
  });

  // -------------------------------------------------------------
  // Business Workspaces Definition
  // -------------------------------------------------------------
  const pagesToAudit = [
    { code: "overview", name: "Tổng quan Dashboard", subTabs: ["overview"] },
    { code: "cash", name: "Tiền mặt", subTabs: ["process", "receipt", "payment"] },
    { code: "bank", name: "Tiền gửi ngân hàng", subTabs: ["process", "deposit", "withdrawal"] },
    { code: "purchases", name: "Mua hàng (AP)", subTabs: ["process", "orders", "vouchers"] },
    { code: "sales", name: "Bán hàng (AR)", subTabs: ["process", "quotes", "orders", "vouchers"] },
    { code: "inventory", name: "Kho", subTabs: ["process", "inward", "outward", "stock-card"] },
    { code: "tools", name: "Công cụ dụng cụ", subTabs: ["process", "allocation"] },
    { code: "assets", name: "Tài sản cố định", subTabs: ["process", "depreciation"] },
    { code: "tax", name: "Thuế", subTabs: ["declarations", "vat-purchase"] },
    { code: "cost", name: "Giá thành", subTabs: ["process", "cost-period"] },
    { code: "ledger", name: "Tổng hợp", subTabs: ["process", "other-vouchers"] },
    { code: "reports", name: "Báo cáo tài chính & quản trị", subTabs: ["financial", "management"] },
  ];

  for (let i = 0; i < pagesToAudit.length; i++) {
    const p = pagesToAudit[i];
    console.log(`[PAGE ${i + 2}] Auditing ${p.name} (${p.code})...`);

    const tNav = await measureInteraction(`Navigate to ${p.code}`, () =>
      page.goto(`${TARGET_URL}/?module=${p.code}`, { waitUntil: "networkidle", timeout: 15000 })
    );

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${String(i + 2).padStart(2, "0")}_${p.code}.png`) });

    // Test sub-tabs responsiveness
    const subTabTimings = [];
    for (const sub of p.subTabs) {
      const subBtn = await page.$(`button:has-text("${sub}"), a[href*="tab=${sub}"]`);
      if (subBtn && await subBtn.isVisible()) {
        const tSub = await measureInteraction(`Switch to tab ${sub}`, async () => {
          await subBtn.click();
          await page.waitForTimeout(100);
        });
        subTabTimings.push({ subTab: sub, timeMs: tSub });
      }
    }

    // Test Quick Create / Action button responsiveness
    let modalTiming = null;
    let modalOpened = false;
    const actionBtn = await page.$("button:has-text('Thêm nhanh'), button:has-text('Thêm'), button:has-text('Lập chứng từ')");
    if (actionBtn && await actionBtn.isVisible()) {
      modalTiming = await measureInteraction("Open Modal", async () => {
        await actionBtn.click();
        const modal = await page.waitForSelector(".modal, [role='dialog'], .drawer, [class*='Modal']", { timeout: 3000 }).catch(() => null);
        modalOpened = Boolean(modal);
      });

      if (modalOpened) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${String(i + 2).padStart(2, "0")}_${p.code}_modal.png`) });
        // Close modal
        const closeBtn = await page.$("button:has-text('Đóng'), button:has-text('Hủy'), [aria-label='Close'], button.close");
        if (closeBtn) await closeBtn.click().catch(() => {});
        else await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(300);
      }
    }

    // Inspect table or grid elements
    const tableInfo = await page.evaluate(() => {
      const table = document.querySelector("table");
      const rows = document.querySelectorAll("tr");
      const inputs = document.querySelectorAll("input");
      const hasSearch = Array.from(inputs).some(i => (i.placeholder || "").toLowerCase().includes("tìm"));
      return {
        hasTable: Boolean(table),
        rowCount: rows.length,
        hasSearchInput: hasSearch,
      };
    });

    auditResults.push({
      page: p.name,
      code: p.code,
      loadTimeMs: tNav,
      subTabTimings,
      modalInteraction: modalTiming ? { timeMs: modalTiming, opened: modalOpened } : null,
      tableInfo,
    });
  }

  // -------------------------------------------------------------
  // PAGE 14: Company Admin (/company-admin)
  // -------------------------------------------------------------
  console.log(`[PAGE 14] Auditing Company Admin Workspace...`);
  const tAdminLoad = await measureInteraction("Load Company Admin", () =>
    page.goto(`${TARGET_URL}/company-admin`, { waitUntil: "networkidle", timeout: 15000 })
  );
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "14_company_admin.png") });

  const adminTabs = ["1. Tổng quan", "2. Nhân sự & Phân quyền", "3. Vai trò & Ma trận", "4. Cấu hình"];
  const adminTabTimings = [];
  for (const tName of adminTabs) {
    const tabEl = await page.$(`button:has-text("${tName}")`);
    if (tabEl) {
      const dur = await measureInteraction(`Tab ${tName}`, async () => {
        await tabEl.click();
        await page.waitForTimeout(150);
      });
      adminTabTimings.push({ tab: tName, timeMs: dur });
    }
  }

  auditResults.push({
    page: "Quản trị Doanh nghiệp (/company-admin)",
    code: "company-admin",
    loadTimeMs: tAdminLoad,
    subTabTimings: adminTabTimings,
  });

  // -------------------------------------------------------------
  // PAGE 15: Platform Super Admin (/super-admin)
  // -------------------------------------------------------------
  console.log(`[PAGE 15] Auditing Platform Super Admin...`);
  const tSuperLoad = await measureInteraction("Load Super Admin", () =>
    page.goto(`${TARGET_URL}/super-admin`, { waitUntil: "networkidle", timeout: 15000 })
  );
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "15_super_admin.png") });

  auditResults.push({
    page: "Trung tâm Nền tảng (/super-admin)",
    code: "super-admin",
    loadTimeMs: tSuperLoad,
  });

  console.log(`\n======================================================`);
  console.log(`[AUDIT COMPLETE] Results collected for ${auditResults.length} screens.`);
  console.log(`======================================================\n`);

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, "audit_metrics.json"),
    JSON.stringify(auditResults, null, 2),
    "utf-8"
  );

  await browser.close();
}

runPageUxAudit().catch(console.error);

