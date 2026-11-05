import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TARGET_URL = "http://localhost:2601";
const ARTIFACT_DIR = "C:/Users/timodapoet/.gemini/antigravity/brain/e8f23b0f-139f-4bc3-afd5-6a68e71aea85";

async function auditInvoices() {
  console.log("=== BẮT ĐẦU AUDIT PHÂN HỆ QUẢN LÝ HÓA ĐƠN NHƯ NGƯỜI DÙNG THỰC TẾ ===");
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

  // JWT Token for user 'admin'
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzkzODY5MzkzLCJpYXQiOjE3OTM4Njc1OTMsImp0aSI6IjRjYzE2M2Q4NDg4MjQ4MjE4MjFiY2E5NDE4MTM3MjcyIiwidXNlcl9pZCI6IjE3In0.DyKrP7sS4qscCtn5IPnbQKPc_GmXgHskoqRPy890bIE";

  await context.addInitScript(({ token, companyId, company }) => {
    localStorage.setItem("erp_token", token);
    localStorage.setItem("erp_company_id", companyId);
    localStorage.setItem("erp_api_session", JSON.stringify({
      token,
      access: token,
      access_token: token,
      refresh: token,
      companyId,
      companies: [company],
      company,
      user: { id: "17", username: "admin", display_name: "Đỗ Đức Tùng" },
    }));
  }, { token, companyId, company });

  const page = await context.newPage();

  const consoleErrors = [];
  const apiErrors = [];
  const uncaughtErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      consoleErrors.push(text);
      console.log(`[CONSOLE ERROR] ${text.slice(0, 160)}`);
    }
  });

  page.on("pageerror", (err) => {
    uncaughtErrors.push(err.message);
    console.log(`[PAGE ERROR / CRASH] ${err.message}`);
  });

  page.on("response", async (res) => {
    if (res.status() >= 400) {
      const url = res.url();
      let text = "";
      try { text = await res.text(); } catch {}
      apiErrors.push({ status: res.status(), url, body: text.slice(0, 200) });
      console.log(`[API ${res.status()}] ${res.request().method()} ${url} -> ${text.slice(0, 100)}`);
    }
  });

  // 1. Vào trực tiếp trang chủ / phân hệ Hóa đơn
  console.log("\n[BƯỚC 1] Khởi động phiên làm việc Công ty TNHH Tunghihihi...");
  await page.goto(`${TARGET_URL}/invoices`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  console.log(`URL hiện tại: ${page.url()}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_01_invoices_default.png") });

  // 2. Tab 1: Quy trình (/invoices/process)
  console.log("\n[BƯỚC 2] Kiểm tra tab Quy trình...");
  await page.goto(`${TARGET_URL}/invoices/process`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_02_process.png") });

  console.log("  -> Bấm nút Nghị định 123...");
  const nd123Btn = await page.$("button:has-text('Nghị định 123')");
  if (nd123Btn) {
    await nd123Btn.click();
    await page.waitForTimeout(800);
    const modalVisible = await page.$("text=Quy chuẩn xử lý HĐĐT");
    console.log(`  -> Modal Nghị định 123 hiển thị: ${Boolean(modalVisible)}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_02_legal_modal.png") });
    const closeBtn = await page.$("button:has-text('Đã hiểu & Đóng')");
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    console.log("  [LƯU Ý] Không tìm thấy nút Nghị định 123");
  }

  // 3. Tab 2: Tự động lấy hóa đơn từ TCT (/invoices/sync)
  console.log("\n[BƯỚC 3] Kiểm tra tab Tự động lấy hóa đơn từ TCT...");
  await page.goto(`${TARGET_URL}/invoices/sync`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_03_sync_tct.png") });

  const syncBtn = await page.$("button:has-text('Đồng bộ hóa đơn từ TCT ngay')");
  if (syncBtn) {
    console.log("  -> Bấm nút 'Đồng bộ hóa đơn từ TCT ngay'...");
    await syncBtn.click();
    await page.waitForTimeout(2000);
    const successMsg = await page.$("text=Đồng bộ thành công từ Cổng Tổng cục Thuế");
    console.log(`  -> Thông báo đồng bộ thành công: ${Boolean(successMsg)}`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_03_sync_success.png") });
  }

  // 4. Tab 3: Hướng dẫn xử lý hóa đơn đã lập sai (/invoices/error-guide)
  console.log("\n[BƯỚC 4] Kiểm tra tab Hướng dẫn xử lý HĐ lập sai...");
  await page.goto(`${TARGET_URL}/invoices/error-guide`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const kindRadio = await page.$("input[name='invoice-kind']");
  if (kindRadio) {
    await kindRadio.click();
    await page.waitForTimeout(400);
    const sentRadio = await page.$("input[name='invoice-sent']");
    if (sentRadio) await sentRadio.click();
    await page.waitForTimeout(400);
    const faultRadio = await page.$("input[name='invoice-fault']");
    if (faultRadio) await faultRadio.click();
    await page.waitForTimeout(400);
    console.log("  -> Đã chọn tình huống sai sót thành công.");
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_04_error_guide.png") });

  const guideModalBtn = await page.$("button:has-text('Xem hướng dẫn quy chuẩn')");
  if (guideModalBtn) {
    await guideModalBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_04_guide_modal.png") });
    const closeBtn = await page.$("button:has-text('Đã hiểu & Đóng')");
    if (closeBtn) await closeBtn.click();
  }

  // 5. Tab 4: Hóa đơn đầu vào (/invoices/incoming)
  console.log("\n[BƯỚC 5] Kiểm tra tab Hóa đơn đầu vào...");
  await page.goto(`${TARGET_URL}/invoices/incoming/inbox`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_05_incoming_inbox.png") });

  const invoiceRows = await page.$$("table tbody tr");
  console.log(`  -> Số hóa đơn đầu vào trong Hộp thư: ${invoiceRows.length}`);
  if (invoiceRows.length > 0) {
    console.log("  -> Click vào hóa đơn đầu tiên xem chi tiết...");
    await invoiceRows[0].click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_05_incoming_detail.png") });
  }

  console.log("  -> Kiểm tra tab con 'Chưa hạch toán'...");
  await page.goto(`${TARGET_URL}/invoices/incoming/unprocessed`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const unprocRows = await page.$$("table tbody tr");
  console.log(`  -> Số hóa đơn đầu vào chưa hạch toán: ${unprocRows.length}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_05_incoming_unprocessed.png") });

  console.log("  -> Kiểm tra tab con 'Đã hạch toán'...");
  await page.goto(`${TARGET_URL}/invoices/incoming/processed`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const procRows = await page.$$("table tbody tr");
  console.log(`  -> Số hóa đơn đầu vào đã hạch toán: ${procRows.length}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_05_incoming_processed.png") });

  // 6. Tab 5: Hóa đơn đầu ra & Phát hành (/invoices/outgoing)
  console.log("\n[BƯỚC 6] Kiểm tra tab Hóa đơn đầu ra & Phát hành...");
  await page.goto(`${TARGET_URL}/invoices/outgoing`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const outRows = await page.$$("table tbody tr");
  console.log(`  -> Số hóa đơn đầu ra: ${outRows.length}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_06_outgoing.png") });

  if (outRows.length > 0) {
    console.log("  -> Click vào hóa đơn đầu ra đầu tiên xem chi tiết...");
    await outRows[0].click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_06_outgoing_detail.png") });
    const closeBtn = await page.$("button:has-text('Đóng')");
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // 7. Tab 6: Hóa đơn cần xử lý (/invoices/pending)
  console.log("\n[BƯỚC 7] Kiểm tra tab Hóa đơn cần xử lý...");
  await page.goto(`${TARGET_URL}/invoices/pending`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const pendRows = await page.$$("table tbody tr");
  console.log(`  -> Số hóa đơn cần xử lý: ${pendRows.length}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_07_pending.png") });

  // 8. Tab 7: Trạng thái phát hành (/invoices/issuance)
  console.log("\n[BƯỚC 8] Kiểm tra tab Trạng thái phát hành...");
  await page.goto(`${TARGET_URL}/invoices/issuance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const issueRows = await page.$$("table tbody tr");
  console.log(`  -> Số dòng trạng thái phát hành: ${issueRows.length}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_08_issuance.png") });

  // 9. Tab 8: Tra cứu hóa đơn (/invoices/lookup)
  console.log("\n[BƯỚC 9] Kiểm tra tab Tra cứu hóa đơn...");
  await page.goto(`${TARGET_URL}/invoices/lookup`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const lookupRows = await page.$$("table tbody tr");
  console.log(`  -> Số dòng tra cứu tổng thể: ${lookupRows.length}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_09_lookup.png") });

  // 10. Tab 9: Bảng kê chưa hạch toán (/invoices/unposted)
  console.log("\n[BƯỚC 10] Kiểm tra tab Bảng kê chưa hạch toán...");
  await page.goto(`${TARGET_URL}/invoices/unposted`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const unpostedRows = await page.$$("table tbody tr");
  console.log(`  -> Số hóa đơn trong Bảng kê chưa hạch toán: ${unpostedRows.length}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_10_unposted.png") });

  // 11. Tab 10: Cảnh báo rủi ro hóa đơn (/invoices/risk-warning)
  console.log("\n[BƯỚC 11] Kiểm tra Cảnh báo rủi ro nhà cung cấp...");
  await page.goto(`${TARGET_URL}/invoices/risk-warning/supplier-risk`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_11_supplier_risk.png") });

  console.log("  -> Kiểm tra Cảnh báo chi tiền mặt hóa đơn >= 20 triệu...");
  await page.goto(`${TARGET_URL}/invoices/risk-warning/cash-limit`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const cashRows = await page.$$("table tbody tr");
  console.log(`  -> Số hóa đơn cảnh báo chi tiền mặt: ${cashRows.length}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_11_cash_limit.png") });

  console.log("  -> Kiểm tra Cảnh báo HĐ sai sót / Chữ ký số lỗi...");
  await page.goto(`${TARGET_URL}/invoices/risk-warning/xml-errors`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_11_xml_errors.png") });

  // 12. Tab 11: Xử lý sai sót, điều chỉnh, thay thế (/invoices/adjustments)
  console.log("\n[BƯỚC 12] Kiểm tra tab Xử lý sai sót, điều chỉnh, thay thế...");
  await page.goto(`${TARGET_URL}/invoices/adjustments`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const adjRows = await page.$$("table tbody tr");
  console.log(`  -> Số hóa đơn điều chỉnh/thay thế/sai sót: ${adjRows.length}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_12_adjustments.png") });

  // 13. Tab 12: Báo cáo hóa đơn điện tử (/invoices/reports)
  console.log("\n[BƯỚC 13] Kiểm tra tab Báo cáo HĐĐT...");
  await page.goto(`${TARGET_URL}/invoices/reports`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "audit_13_reports.png") });

  // Tổng kết
  console.log("\n=======================================================");
  console.log("=== KẾT QUẢ AUDIT TOÀN DIỆN PHÂN HỆ QUẢN LÝ HÓA ĐƠN ===");
  console.log("=======================================================");
  console.log(`- Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log("Chi tiết Console Errors:", consoleErrors);
  }
  console.log(`- API Errors (HTTP >= 400): ${apiErrors.length}`);
  if (apiErrors.length > 0) {
    console.log("Chi tiết API Errors:", apiErrors);
  }
  console.log(`- Uncaught Crashes: ${uncaughtErrors.length}`);
  if (uncaughtErrors.length > 0) {
    console.log("Chi tiết Uncaught Crashes:", uncaughtErrors);
  }

  await browser.close();
}

auditInvoices().catch((err) => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
