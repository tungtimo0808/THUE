import { test, expect } from '@playwright/test';
import * as path from 'path';

test('audit and verify no button overlaps across all sales modals', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/a0afd306-2c44-4875-b676-447f4cdfee04');

  // =========================================================================
  // 1. SALE VOUCHER MODAL (Chứng từ bán hàng)
  // =========================================================================
  console.log('1. Checking SaleVoucherModal...');
  await page.goto('http://localhost:5173/sales/transactions?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  const themVoucherBtn = page.getByRole('button', { name: 'Thêm', exact: true }).first();
  await themVoucherBtn.click();
  await page.waitForTimeout(600);

  // Capture Chưa thu tiền
  await page.screenshot({ path: path.join(artifactDir, 'sale_voucher_uncollected.png') });

  // Switch to "Thu tiền ngay"
  const thuTienNgayRadio = page.getByLabel('Thu tiền ngay');
  if (await thuTienNgayRadio.isVisible()) {
    await thuTienNgayRadio.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(artifactDir, 'sale_voucher_collected_now.png') });

  // Switch to tab "Phiếu xuất"
  const deliveryTab = page.locator('button:has-text("2. Phiếu xuất"), [role="tab"]:has-text("Phiếu xuất"), button:has-text("Phiếu xuất")').first();
  if (await deliveryTab.isVisible()) {
    await deliveryTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifactDir, 'sale_voucher_tab_delivery.png') });
  }

  // Switch to tab "Hóa đơn"
  const invoiceTab = page.locator('button:has-text("3. Hóa đơn"), [role="tab"]:has-text("Hóa đơn"), button:has-text("Hóa đơn")').first();
  if (await invoiceTab.isVisible()) {
    await invoiceTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifactDir, 'sale_voucher_tab_invoice.png') });
  }

  // Close Voucher Modal
  const closeVoucherBtn = page.locator('.misa-purchase-modal-window button:has-text("Hủy"), .misa-purchase-modal-window button[title="Đóng"]').first();
  if (await closeVoucherBtn.isVisible()) {
    await closeVoucherBtn.click();
    await page.waitForTimeout(400);
  }

  // =========================================================================
  // 2. QUOTE MODAL (Báo giá)
  // =========================================================================
  console.log('2. Checking QuoteModal...');
  await page.goto('http://localhost:5173/sales/quotes?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  const themQuoteBtn = page.getByRole('button', { name: 'Thêm', exact: true }).first();
  await themQuoteBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(artifactDir, 'quote_modal_audit.png') });

  const closeQuoteBtn = page.locator('.misa-purchase-modal-window button:has-text("Hủy"), .misa-purchase-modal-window button[title="Đóng"]').first();
  if (await closeQuoteBtn.isVisible()) {
    await closeQuoteBtn.click();
    await page.waitForTimeout(400);
  }

  // =========================================================================
  // 3. ORDER MODAL (Đơn đặt hàng)
  // =========================================================================
  console.log('3. Checking OrderModal...');
  await page.goto('http://localhost:5173/sales/orders?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  const themOrderBtn = page.getByRole('button', { name: 'Thêm', exact: true }).first();
  await themOrderBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(artifactDir, 'order_modal_audit.png') });

  const closeOrderBtn = page.locator('.misa-purchase-modal-window button:has-text("Hủy"), .misa-purchase-modal-window button[title="Đóng"]').first();
  if (await closeOrderBtn.isVisible()) {
    await closeOrderBtn.click();
    await page.waitForTimeout(400);
  }

  // =========================================================================
  // 4. CONTRACT MODAL (Hợp đồng bán)
  // =========================================================================
  console.log('4. Checking ContractModal...');
  await page.goto('http://localhost:5173/sales/contracts?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  const themContractBtn = page.getByRole('button', { name: 'Thêm', exact: true }).first();
  await themContractBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(artifactDir, 'contract_modal_audit.png') });

  const closeContractBtn = page.locator('.misa-purchase-modal-window button:has-text("Hủy"), .misa-purchase-modal-window button[title="Đóng"]').first();
  if (await closeContractBtn.isVisible()) {
    await closeContractBtn.click();
    await page.waitForTimeout(400);
  }

  // =========================================================================
  // 5. INVOICE MODAL (Hóa đơn)
  // =========================================================================
  console.log('5. Checking SaleInvoiceModal...');
  await page.goto('http://localhost:5173/sales/invoices?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  const themInvoiceBtn = page.getByRole('button', { name: 'Thêm', exact: true }).first();
  if (await themInvoiceBtn.isVisible()) {
    await themInvoiceBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(artifactDir, 'invoice_modal_audit.png') });
  }

  console.log('Finished capturing all modal audit screenshots.');
});
