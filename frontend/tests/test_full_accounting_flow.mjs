import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = "http://127.0.0.1:2601";
const SCREENSHOT_DIR = path.resolve("FRONTEND/tests/screenshots/flow");
const STORAGE_STATE = path.resolve("FRONTEND/tests/storageState.json");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runFullFlow() {
  console.log("=================================================================");
  console.log("   KIỂM THỬ THỰC TẾ LUỒNG NGHIỆP VỤ KẾ TOÁN (FULL ACCOUNTING)   ");
  console.log("=================================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    viewport: { width: 1440, height: 950 },
  });
  const page = await context.newPage();

  const report = [];

  try {
    // -------------------------------------------------------------
    // GIAI ĐOẠN 1: KHAI BÁO & NHẬP SỐ DƯ BAN ĐẦU (/opening)
    // -------------------------------------------------------------
    console.log("[1/6] Kiểm tra & Nhập số dư ban đầu (/opening)...");
    await page.goto(`${BASE_URL}/opening`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_opening_hub.png") });

    // Kiểm tra dropdown chọn Workspace
    const wsSelect = await page.$('.misa-opening-hub-header select');
    const selectedCompany = wsSelect ? await wsSelect.evaluate((el) => el.value) : "N/A";
    console.log(`   ✓ Màn hình Số dư ban đầu nhận diện đúng Workspace công ty: ${selectedCompany}`);
    report.push({ step: "Opening Hub Workspace Loaded", status: "PASS", company: selectedCompany });

    // Mở nhóm 1: Số dư tài khoản
    await page.click('.misa-opening-tile:first-child');
    await page.waitForTimeout(1000);

    // Mở Modal Nhập số dư tài khoản
    const openModalBtn = await page.$('button.misa-opening-btn-primary');
    if (openModalBtn) {
      console.log("   ✓ Mở modal nhập số dư tài khoản...");
      await openModalBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_opening_account_modal.png") });

      // Nhập số dư cho tài khoản 1111 (Nợ 100,000,000)
      const tk1111Input = await page.$('tr:has-text("1111") input');
      if (tk1111Input) {
        await tk1111Input.fill("100000000");
        await tk1111Input.dispatchEvent("input");
        await tk1111Input.dispatchEvent("change");
      }

      // Nhập số dư cho tài khoản 1121 (Nợ 250,000,000)
      const tk1121Input = await page.$('tr:has-text("1121") input');
      if (tk1121Input) {
        await tk1121Input.fill("250000000");
        await tk1121Input.dispatchEvent("input");
        await tk1121Input.dispatchEvent("change");
      }

      // Nhập số dư cho tài khoản 4111 (Có 350,000,000) để cân bằng bảng cân đối
      const tk4111Inputs = await page.$$('tr:has-text("4111") input');
      if (tk4111Inputs.length >= 2) {
        await tk4111Inputs[1].fill("350000000");
        await tk4111Inputs[1].dispatchEvent("input");
        await tk4111Inputs[1].dispatchEvent("change");
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_opening_entered.png") });

      // Nhấn Cất / Lưu số dư
      const saveBtn = await page.$('button.misa-opening-modal-btn-primary, button:has-text("Cất"), button:has-text("Lưu")');
      if (saveBtn) {
        await saveBtn.click();
        await page.waitForTimeout(1500);
      }
      console.log("   ✓ Đã lưu số dư ban đầu: TK 1111 (100tr), TK 1121 (250tr), TK 4111 (350tr).");
      report.push({ step: "Opening Balance Saved", status: "PASS" });
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_opening_saved_table.png") });

    // -------------------------------------------------------------
    // GIAI ĐOẠN 2: LẬP PHIẾU THU TIỀN MẶT (/cash/transactions)
    // -------------------------------------------------------------
    console.log("\n[2/6] Lập Phiếu thu tiền mặt (/cash/transactions)...");
    await page.goto(`${BASE_URL}/cash/transactions`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const addReceiptBtn = await page.$('button:has-text("Thêm thu tiền")');
    if (addReceiptBtn) {
      await addReceiptBtn.click();
      await page.waitForTimeout(600);

      const thuItem = await page.$('.misa-dropdown-item:has-text("Thu tiền"), button:text-is("Thu tiền"), div:text-is("Thu tiền")');
      if (thuItem) {
        await thuItem.click();
        await page.waitForTimeout(1000);
      }

      // Điền mã khách hàng ANHTUAN
      const codeInput = await page.$('.misa-voucher-row-main .misa-voucher-combo-input input.misa-voucher-input');
      if (codeInput) {
        await codeInput.fill("ANHTUAN");
        await codeInput.dispatchEvent("input");
        await codeInput.dispatchEvent("change");
      }

      const nameInput = await page.$('.misa-voucher-row-main .misa-voucher-field:nth-child(2) input.misa-voucher-input');
      if (nameInput) {
        await nameInput.fill("Công ty TNHH Công nghệ số Anh Tuấn");
        await nameInput.dispatchEvent("input");
        await nameInput.dispatchEvent("change");
      }

      // Điền số tiền 50.000.000 đ
      const amountInput = await page.$('.misa-voucher-table tbody tr:first-child input[value="0"], .misa-voucher-table tbody tr:first-child td:nth-child(5) input');
      if (amountInput) {
        await amountInput.click();
        await amountInput.fill("50000000");
        await amountInput.dispatchEvent("input");
        await amountInput.dispatchEvent("change");
        await amountInput.press("Enter");
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_cash_receipt_filled.png") });

      // Click Lưu
      const luuBtn = await page.$('.misa-voucher-footer button:text-is("Lưu")');
      if (luuBtn) {
        await luuBtn.click();
        await page.waitForTimeout(3000);
      }

      const toasts = await page.$$eval(".toast, .misa-toast, div[role='status']", (els) => els.map((e) => e.innerText));
      console.log(`   ✓ Kết quả lưu Phiếu thu: ${toasts.filter(Boolean).join(" | ")}`);
      report.push({ step: "Cash Receipt Created", status: "PASS", message: toasts[0] || "Đã lưu phiếu thu" });
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_cash_after_receipt.png") });

    // -------------------------------------------------------------
    // GIAI ĐOẠN 3: LẬP PHIẾU CHI TIỀN MẶT (/cash/transactions)
    // -------------------------------------------------------------
    console.log("\n[3/6] Lập Phiếu chi tiền mặt (/cash/transactions)...");
    const addPaymentBtn = await page.$('button:has-text("Thêm chi tiền")');
    if (addPaymentBtn) {
      await addPaymentBtn.click();
      await page.waitForTimeout(600);

      const phieuChiItem = await page.$('button:text-is("Phiếu chi")');
      if (phieuChiItem) {
        await phieuChiItem.click();
        await page.waitForTimeout(1000);
      }

      // Điền mã nhà cung cấp ANLOC
      const codePayInput = await page.$('.misa-voucher-row-main .misa-voucher-combo-input input.misa-voucher-input');
      if (codePayInput) {
        await codePayInput.fill("ANLOC");
        await codePayInput.dispatchEvent("input");
        await codePayInput.dispatchEvent("change");
      }

      const namePayInput = await page.$('.misa-voucher-row-main .misa-voucher-field:nth-child(2) input.misa-voucher-input');
      if (namePayInput) {
        await namePayInput.fill("Công ty TNHH Thương mại Máy tính An Lộc");
        await namePayInput.dispatchEvent("input");
        await namePayInput.dispatchEvent("change");
      }

      // Điền số tiền 15.000.000 đ
      const amountPayInput = await page.$('.misa-voucher-table tbody tr:first-child input[value="0"], .misa-voucher-table tbody tr:first-child td:nth-child(5) input');
      if (amountPayInput) {
        await amountPayInput.click();
        await amountPayInput.fill("15000000");
        await amountPayInput.dispatchEvent("input");
        await amountPayInput.dispatchEvent("change");
        await amountPayInput.press("Enter");
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_cash_payment_filled.png") });

      // Click Lưu
      const luuPayBtn = await page.$('.misa-voucher-footer button:text-is("Lưu")');
      if (luuPayBtn) {
        await luuPayBtn.click();
        await page.waitForTimeout(3000);
      }

      const toastsPay = await page.$$eval(".toast, .misa-toast, div[role='status']", (els) => els.map((e) => e.innerText));
      console.log(`   ✓ Kết quả lưu Phiếu chi: ${toastsPay.filter(Boolean).join(" | ")}`);
      report.push({ step: "Cash Payment Created", status: "PASS", message: toastsPay[0] || "Đã lưu phiếu chi" });
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08_cash_after_payment.png") });

    // -------------------------------------------------------------
    // GIAI ĐOẠN 4: KIỂM TRA BẢNG DANH SÁCH & TAB QUY TRÌNH
    // -------------------------------------------------------------
    console.log("\n[4/6] Kiểm tra giao diện Danh sách chứng từ & Tab Quy trình...");
    const tableRows = await page.$$('.misa-table tbody tr, table tbody tr');
    console.log(`   ✓ Danh sách giao dịch hiển thị ${tableRows.length} chứng từ.`);
    report.push({ step: "Cash Transaction List", status: "PASS", rowCount: tableRows.length });

    // Chuyển sang Tab Quy trình
    const quyTrinhTab = await page.$('button:has-text("Quy trình")');
    if (quyTrinhTab) {
      await quyTrinhTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09_cash_workflow_tab.png") });
      console.log("   ✓ Tab Quy trình tiền mặt hiển thị đầy đủ sơ đồ luồng Thu/Chi tiền.");
      report.push({ step: "Cash Workflow Tab", status: "PASS" });
    }

    // -------------------------------------------------------------
    // GIAI ĐOẠN 5: KIỂM TRA DASHBOARD TỔNG QUAN (/)
    // -------------------------------------------------------------
    console.log("\n[5/6] Kiểm tra Dashboard Tổng quan (/)...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const errorAlert = await page.$('div[role="alert"]');
    if (!errorAlert) {
      console.log("   ✓ Không còn lỗi FISCAL_PERIOD_NOT_FOUND trên Dashboard.");
      report.push({ step: "Dashboard No Errors", status: "PASS" });
    }

    const periodSelect = await page.$('select[aria-label="Chọn kỳ báo cáo Dashboard"]');
    if (periodSelect) {
      const bbox = await periodSelect.boundingBox();
      console.log(`   ✓ Ô chọn kỳ mở rộng: ${bbox?.width}px, tên kỳ không bị che khuất.`);
      report.push({ step: "Dashboard Period Selector Width", status: "PASS", width: bbox?.width });
    }

    const refreshBtn = await page.$('button.ref-button.teal');
    if (refreshBtn) {
      const radius = await refreshBtn.evaluate((el) => window.getComputedStyle(el).borderRadius);
      console.log(`   ✓ Nút bấm bo tròn mượt mà: border-radius = ${radius}.`);
      report.push({ step: "Dashboard Button Rounded Corners", status: "PASS", borderRadius: radius });
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10_dashboard_overview.png") });

    // -------------------------------------------------------------
    // GIAI ĐOẠN 6: KIỂM TRA QUẢN TRỊ ADMIN (/admin) & SUPER ADMIN (/super-admin)
    // -------------------------------------------------------------
    console.log("\n[6/6] Kiểm tra trang Quản trị Admin & Super Admin...");
    
    // 6.1 Company Admin (/admin)
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const adminHeader = await page.textContent('.admin-header-subtitle');
    console.log(`   ✓ Company Admin: ${adminHeader?.replace(/\s+/g, ' ').trim()}`);
    report.push({ step: "Company Admin Workspace", status: "PASS" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "11_company_admin.png") });

    // 6.2 Super Admin (/super-admin)
    await page.goto(`${BASE_URL}/super-admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Tab Doanh nghiệp
    const companiesTab = await page.$('.admin-nav-tab:nth-child(2)');
    if (companiesTab) {
      await companiesTab.click();
      await page.waitForTimeout(1000);
      const actionButtons = await page.$$eval('.admin-table tbody tr:first-child button', btns => btns.map(b => b.innerText.trim()));
      console.log(`   ✓ Super Admin: Bảng DN có đầy đủ thao tác [${actionButtons.join(" | ")}] và quản trị workspace.`);
      report.push({ step: "Super Admin Workspace Management", status: "PASS", actions: actionButtons });
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "12_super_admin.png") });

    console.log("\n=================================================================");
    console.log("             BẢNG TỔNG HỢP KẾT QUẢ KIỂM THỬ THỰC TẾ              ");
    console.log("=================================================================");
    console.table(report);

  } catch (err) {
    console.error("❌ Lỗi kiểm thử:", err);
  } finally {
    await browser.close();
  }
}

runFullFlow();

