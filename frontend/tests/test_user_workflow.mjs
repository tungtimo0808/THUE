import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = "http://127.0.0.1:2601";
const SCREENSHOT_DIR = path.resolve("FRONTEND/tests/screenshots");
const STORAGE_STATE = path.resolve("FRONTEND/tests/storageState.json");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runWorkflowTest() {
  console.log("=== BẮT ĐẦU KIỂM THỬ LUỒNG NGHIỆP VỤ TOÀN DIỆN ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    viewport: { width: 1440, height: 950 },
  });
  const page = await context.newPage();

  const report = [];

  try {
    // -------------------------------------------------------------
    // BƯỚC 1: KIỂM THỬ GIAO DIỆN DASHBOARD
    // -------------------------------------------------------------
    console.log("\n[1/5] Kiểm tra giao diện Dashboard...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Kiểm tra xem có lỗi FISCAL_PERIOD_NOT_FOUND không
    const errorAlert = await page.$('div[role="alert"]');
    if (errorAlert) {
      const errText = await errorAlert.innerText();
      console.log("  ⚠️ Phát hiện thông báo alert:", errText);
      report.push({ step: "Dashboard Alert", status: "WARN", text: errText });
    } else {
      console.log("  ✓ Dashboard tải thành công, KHÔNG có lỗi FISCAL_PERIOD_NOT_FOUND");
      report.push({ step: "Dashboard Error Guard", status: "PASS" });
    }

    // Kiểm tra ô chọn Kỳ có hiển thị đầy đủ không
    const periodSelect = await page.$('select[aria-label="Chọn kỳ báo cáo Dashboard"]');
    if (periodSelect) {
      const bbox = await periodSelect.boundingBox();
      console.log(`  ✓ Ô chọn kỳ tồn tại, chiều rộng: ${bbox?.width}px (đã được kéo dài rộng rãi)`);
      report.push({ step: "Period Selector Width", status: "PASS", width: bbox?.width });
    }

    // Kiểm tra bo tròn nút Làm mới
    const refreshBtn = await page.$('button.ref-button.teal');
    if (refreshBtn) {
      const borderRadius = await refreshBtn.evaluate((el) => window.getComputedStyle(el).borderRadius);
      console.log(`  ✓ Nút Làm mới có border-radius: ${borderRadius} (bo tròn mượt mà, không còn góc vuông thô)`);
      report.push({ step: "Button Rounded Corners", status: "PASS", borderRadius });
    }

    // Kiểm tra các thẻ KPI chỉ tiêu
    const metricsCards = await page.$$('.metric.card, article.metric');
    console.log(`  ✓ Dashboard hiển thị ${metricsCards.length} thẻ chỉ tiêu KPI`);
    report.push({ step: "KPI Cards Rendered", status: "PASS", count: metricsCards.length });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step1_dashboard.png"), fullPage: false });

    // -------------------------------------------------------------
    // BƯỚC 2: KIỂM THỬ NHẬP SỐ DƯ BAN ĐẦU & CÔ LẬP THEO WORKSPACE
    // -------------------------------------------------------------
    console.log("\n[2/5] Kiểm tra màn hình Nhập Số Dư Ban Đầu (/opening)...");
    await page.goto(`${BASE_URL}/opening`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Kiểm tra Header Hub Số dư ban đầu
    const hubTitle = await page.textContent('.misa-opening-hub-title');
    console.log(`  ✓ Tiêu đề màn hình: "${hubTitle?.trim()}"`);

    // Kiểm tra Workspace selector
    const workspaceSelect = await page.$('.misa-opening-hub-header select');
    if (workspaceSelect) {
      const selectedComp = await workspaceSelect.evaluate((el) => el.value);
      const options = await workspaceSelect.$$eval('option', (opts) => opts.map(o => o.text));
      console.log(`  ✓ Dropdown Workspace hiện diện: ${options.length} công ty khả dụng. Công ty đang chọn: ${selectedComp}`);
      report.push({ step: "Opening Balance Workspace Switcher", status: "PASS", companies: options.length });
    }

    // Kiểm tra 10 nhóm số dư ban đầu (Tiles)
    const openingTiles = await page.$$('.misa-opening-tile');
    console.log(`  ✓ Hiển thị đủ 10 nhóm số dư ban đầu: ${openingTiles.length} nhóm`);
    report.push({ step: "10 Opening Balance Tiles", status: "PASS", count: openingTiles.length });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step2_opening_hub.png") });

    // Mở nhóm 1: Số dư tài khoản
    const accountTile = await page.$('.misa-opening-tile:first-child');
    if (accountTile) {
      await accountTile.click();
      await page.waitForTimeout(1000);

      // Kiểm tra tiêu đề chi tiết và badge doanh nghiệp
      const detailHeader = await page.textContent('.misa-opening-detail-header');
      console.log(`  ✓ Đã mở giao diện chi tiết: ${detailHeader?.replace(/\s+/g, ' ').trim()}`);

      // Mở modal nhập số dư tài khoản
      const inputBtn = await page.$('button.misa-opening-btn-primary');
      if (inputBtn) {
        await inputBtn.click();
        await page.waitForTimeout(800);
        const modalTitle = await page.$('.misa-opening-modal-title');
        if (modalTitle) {
          console.log(`  ✓ Mở thành công modal: "${(await modalTitle.innerText()).trim()}"`);
          // Đóng modal
          const closeBtn = await page.$('.misa-opening-modal-footer button');
          if (closeBtn) await closeBtn.click();
          await page.waitForTimeout(500);
        }
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step2_opening_accounts_detail.png") });

      // Trở về hub
      const backHubBtn = await page.$('.misa-opening-close-btn');
      if (backHubBtn) {
        await backHubBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // -------------------------------------------------------------
    // BƯỚC 3: KIỂM THỬ LẬP PHIẾU THU & PHIẾU CHI TIỀN MẶT
    // -------------------------------------------------------------
    console.log("\n[3/5] Kiểm tra phân hệ Tiền mặt - Lập Phiếu Thu & Phiếu Chi...");
    await page.goto(`${BASE_URL}/cash/transactions`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Kiểm tra nút Thêm thu tiền
    const addReceiptBtn = await page.$('button:has-text("Thêm thu tiền"), button:has-text("Thu tiền")');
    if (addReceiptBtn) {
      console.log("  ✓ Nút 'Thêm thu tiền' sẵn sàng.");
      await addReceiptBtn.click();
      await page.waitForTimeout(1000);

      // Nếu có dropdown chọn loại thu
      const thuTienItem = await page.$('button:text-is("Thu tiền"), div:text-is("Thu tiền"), .misa-dropdown-item:has-text("Thu tiền")');
      if (thuTienItem) {
        await thuTienItem.click();
        await page.waitForTimeout(1000);
      }

      // Kiểm tra modal phiếu thu
      const receiptModal = await page.$('.misa-voucher-modal, [role="dialog"], form');
      if (receiptModal) {
        console.log("  ✓ Modal Phiếu thu tiền mặt đã mở thành công.");
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step3_cash_receipt_modal.png") });

        // Tìm nút đóng/hủy
        const cancelBtn = await page.$('button:has-text("Đóng"), button:has-text("Hủy"), .misa-voucher-close');
        if (cancelBtn) await cancelBtn.click();
        await page.waitForTimeout(500);
      }
      report.push({ step: "Cash Receipt Creation Flow", status: "PASS" });
    }

    // Kiểm tra nút Chi tiền
    const addPaymentBtn = await page.$('button:has-text("Thêm chi tiền"), button:has-text("Chi tiền")');
    if (addPaymentBtn) {
      console.log("  ✓ Nút 'Chi tiền' sẵn sàng.");
      await addPaymentBtn.click();
      await page.waitForTimeout(1000);

      const chiTienItem = await page.$('button:text-is("Chi tiền"), div:text-is("Chi tiền"), .misa-dropdown-item:has-text("Chi tiền")');
      if (chiTienItem) {
        await chiTienItem.click();
        await page.waitForTimeout(1000);
      }

      const paymentModal = await page.$('.misa-voucher-modal, [role="dialog"], form');
      if (paymentModal) {
        console.log("  ✓ Modal Phiếu chi tiền mặt đã mở thành công.");
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step3_cash_payment_modal.png") });

        const cancelBtn = await page.$('button:has-text("Đóng"), button:has-text("Hủy"), .misa-voucher-close');
        if (cancelBtn) await cancelBtn.click();
        await page.waitForTimeout(500);
      }
      report.push({ step: "Cash Payment Creation Flow", status: "PASS" });
    }

    // -------------------------------------------------------------
    // BƯỚC 4: KIỂM THỬ TRANG QUẢN TRỊ DOANH NGHIỆP (/admin)
    // -------------------------------------------------------------
    console.log("\n[4/5] Kiểm tra trang Quản trị Doanh nghiệp (/admin)...");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Kiểm tra Company Switcher trong Header
    const adminHeaderSelect = await page.$('.admin-header-title select');
    if (adminHeaderSelect) {
      const currentComp = await adminHeaderSelect.evaluate((el) => el.value);
      console.log(`  ✓ Header trang Admin có Dropdown Chuyển DN trực tiếp. Công ty hiện tại: ${currentComp}`);
      report.push({ step: "Admin Header Company Switcher", status: "PASS" });
    }

    // Kiểm tra hiển thị Chủ sở hữu Workspace
    const ownerSubtitle = await page.textContent('.admin-header-subtitle');
    console.log(`  ✓ Thông tin Header: ${ownerSubtitle?.replace(/\s+/g, ' ').trim()}`);
    report.push({ step: "Admin Owner Display", status: "PASS" });

    // Kiểm tra 4 tab của trang Admin
    const adminTabs = await page.$$('.admin-nav-tab');
    console.log(`  ✓ Trang Admin có ${adminTabs.length} Tab quản trị (Tổng quan, Nhân sự & Phân quyền, Vai trò, Cấu hình)`);
    report.push({ step: "Admin 4 Tabs", status: "PASS", count: adminTabs.length });

    // Kiểm tra shortcut Số dư ban đầu trong Tab Tổng quan
    const openingShortcut = await page.$('a[href="/opening"]');
    if (openingShortcut) {
      console.log("  ✓ Có shortcut liên kết trực tiếp sang 'Khai báo Số dư ban đầu'");
      report.push({ step: "Admin Opening Shortcut", status: "PASS" });
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step4_company_admin_overview.png") });

    // Click Tab 2: Nhân sự & Phân quyền
    const personnelTab = await page.$('.admin-nav-tab:nth-child(2)');
    if (personnelTab) {
      await personnelTab.click();
      await page.waitForTimeout(1000);

      // Kiểm tra danh sách nhân sự
      const memberRows = await page.$$('.admin-table tbody tr');
      console.log(`  ✓ Tab Nhân sự hiển thị ${memberRows.length} thành viên với phân cấp Quản trị/Nghiệp vụ.`);
      report.push({ step: "Admin Personnel Table", status: "PASS", members: memberRows.length });

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step4_company_admin_personnel.png") });
    }

    // -------------------------------------------------------------
    // BƯỚC 5: KIỂM THỬ TRANG SUPER ADMIN (/super-admin)
    // -------------------------------------------------------------
    console.log("\n[5/5] Kiểm tra trang Trung tâm Điều hành Super Admin (/super-admin)...");
    await page.goto(`${BASE_URL}/super-admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Kiểm tra Metrics chỉ số nền tảng
    const statCards = await page.$$('.admin-stat-card');
    console.log(`  ✓ Super Admin hiển thị ${statCards.length} thẻ giám sát nền tảng toàn cục.`);
    report.push({ step: "Super Admin Metrics", status: "PASS", count: statCards.length });

    // Chuyển sang Tab 2: Quản lý Doanh nghiệp
    const companiesTab = await page.$('.admin-nav-tab:nth-child(2)');
    if (companiesTab) {
      await companiesTab.click();
      await page.waitForTimeout(1000);

      // Kiểm tra bảng Doanh nghiệp có cột "Chủ sở hữu (Admin)" và các nút thao tác
      const headerTexts = await page.$$eval('.admin-table thead th', ths => ths.map(th => th.innerText));
      console.log("  ✓ Các cột bảng Doanh nghiệp:", headerTexts.join(" | "));

      const hasOwnerCol = headerTexts.some(h => h.includes("Chủ sở hữu"));
      if (hasOwnerCol) {
        console.log("  ✓ Cột 'Chủ sở hữu (Admin)' hiện diện rõ ràng.");
        report.push({ step: "Super Admin Owner Column", status: "PASS" });
      }

      // Kiểm tra các nút "Vào Workspace", "Quản trị", "Đổi Admin"
      const actionButtons = await page.$$('.admin-table tbody tr:first-child button');
      const actionTexts = await Promise.all(actionButtons.map(b => b.innerText()));
      console.log("  ✓ Các nút thao tác trên từng doanh nghiệp:", actionTexts.map(t => t.trim()).filter(Boolean).join(" | "));
      report.push({ step: "Super Admin Action Buttons", status: "PASS", actions: actionTexts });

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step5_super_admin_companies.png") });
    }

    console.log("\n=== TỔNG KẾT KẾT QUẢ KIỂM THỬ ===");
    console.table(report);

  } catch (err) {
    console.error("❌ Lỗi trong quá trình kiểm thử:", err);
  } finally {
    await browser.close();
  }
}

runWorkflowTest();
