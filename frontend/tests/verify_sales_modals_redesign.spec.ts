import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify sales modals redesign (Báo giá, Đơn đặt hàng, Hợp đồng bán)', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/43251ce8-0215-4e8b-8307-1aa88ffee55b');

  // =========================================================================
  // 1. VERIFY BÁO GIÁ (BG00001 - Screenshot 1)
  // =========================================================================
  console.log('1. Navigating to sales quotes tab...');
  await page.goto('http://localhost:5173/sales/quotes?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  const themQuoteBtn = page.getByRole('button', { name: 'Thêm', exact: true });
  await themQuoteBtn.click();
  await page.waitForTimeout(600);

  // Verify elements of Quote Modal
  const quoteModal = page.locator('.misa-purchase-modal-window');
  await expect(quoteModal).toBeVisible();
  await expect(quoteModal.locator('h2')).toContainText('Báo giá');
  await expect(quoteModal.locator('label:has-text("Mã khách hàng")')).toBeVisible();
  await expect(quoteModal.locator('label:has-text("Tên khách hàng")')).toBeVisible();
  await expect(quoteModal.locator('label:has-text("Số báo giá")')).toBeVisible();
  await expect(quoteModal.locator('label:has-text("Ngày báo giá")')).toBeVisible();
  await expect(quoteModal.locator('label:has-text("Hiệu lực đến")')).toBeVisible();
  await expect(quoteModal.locator('label:has-text("Mã số thuế")')).toBeVisible();
  await expect(quoteModal.locator('label:has-text("Địa chỉ")')).toBeVisible();
  await expect(quoteModal.locator('label:has-text("Người liên hệ")')).toBeVisible();
  await expect(quoteModal.locator('label:has-text("Ghi chú")')).toBeVisible();
  await expect(quoteModal.locator('label:has-text("Nhân viên bán hàng")')).toBeVisible();
  await expect(quoteModal.locator('text=Tham chiếu ...')).toBeVisible();

  // Detail tabs & table
  await expect(quoteModal.locator('text=Hàng tiền')).toBeVisible();
  await expect(quoteModal.getByText('Chiết khấu', { exact: true })).toBeVisible();
  await expect(quoteModal.locator('th:has-text("Mã hàng")')).toBeVisible();
  await expect(quoteModal.locator('th:has-text("Tên hàng")')).toBeVisible();
  await expect(quoteModal.locator('th:has-text("ĐVT")')).toBeVisible();
  await expect(quoteModal.locator('th:has-text("Số lượng")')).toBeVisible();
  await expect(quoteModal.locator('th:has-text("Đơn giá")')).toBeVisible();
  await expect(quoteModal.locator('th:has-text("Thành tiền")')).toBeVisible();
  await expect(quoteModal.locator('th:has-text("% thuế GTGT")')).toBeVisible();
  await expect(quoteModal.locator('th:has-text("Tiền thuế GTGT")')).toBeVisible();

  // Toolbar & Bottom
  await expect(quoteModal.locator('button:has-text("Thêm dòng")')).toBeVisible();
  await expect(quoteModal.locator('button:has-text("Thêm ghi chú")')).toBeVisible();
  await expect(quoteModal.locator('button:has-text("Xóa hết dòng")')).toBeVisible();
  await expect(quoteModal.locator('text=Đính kèm')).toBeVisible();
  await expect(quoteModal.locator('text=Chọn tệp hoặc kéo và thả tệp vào đây')).toBeVisible();

  // Footer
  await expect(quoteModal.locator('text=F3 - Tìm nhanh, F9 - Thêm nhanh')).toBeVisible();
  await expect(quoteModal.locator('button:has-text("Hủy")')).toBeVisible();
  await expect(quoteModal.locator('button:has-text("Cất")').first()).toBeVisible();
  await expect(quoteModal.locator('button:has-text("Cất và Thêm")')).toBeVisible();

  // Capture Quote Modal screenshot
  await page.screenshot({ path: path.join(artifactDir, 'sales_quote_redesign.png') });
  console.log('Captured sales_quote_redesign.png');

  // Close modal
  await quoteModal.locator('button:has-text("Hủy")').click();
  await page.waitForTimeout(400);

  // =========================================================================
  // 2. VERIFY ĐƠN ĐẶT HÀNG (ĐH00001 - Screenshot 2)
  // =========================================================================
  console.log('2. Navigating to sales orders tab...');
  await page.goto('http://localhost:5173/sales/orders?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  const themOrderBtn = page.getByRole('button', { name: 'Thêm', exact: true });
  await themOrderBtn.click();
  await page.waitForTimeout(600);

  const orderModal = page.locator('.misa-purchase-modal-window');
  await expect(orderModal).toBeVisible();
  await expect(orderModal.locator('h2')).toContainText('Đơn đặt hàng');
  await expect(orderModal.locator('input[placeholder="Nhập số báo giá"]')).toBeVisible();

  // Master fields
  await expect(orderModal.locator('label:has-text("Mã khách hàng")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Tên khách hàng")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Ngày đơn hàng")')).toBeVisible();
  await expect(orderModal.getByText('Số đơn hàng', { exact: true })).toBeVisible();
  await expect(orderModal.getByText('Hạn giao hàng', { exact: true })).toBeVisible();
  await expect(orderModal.locator('label:has-text("Tình trạng giao hàng")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Người nhận hàng")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Diễn giải")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Nhân viên bán hàng")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Điều khoản TT")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Số ngày được nợ")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Tình trạng đơn hàng")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Là đơn đặt hàng phát sinh trước khi sử dụng phần mềm")')).toBeVisible();
  await expect(orderModal.getByText('Tính giá thành', { exact: true })).toBeVisible();

  // Table columns
  await expect(orderModal.locator('th:has-text("Số lượng đã bán")')).toBeVisible();
  await expect(orderModal.locator('th:has-text("Số lượng đã xuất")')).toBeVisible();
  await expect(orderModal.locator('th:has-text("Biến ki...")')).toBeVisible();

  // Bottom shipping / e-commerce
  await expect(orderModal.locator('button:has-text("Xem số lượng tồn kho chưa đặt hàng")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Số đơn hàng từ hệ thống khác")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Sàn thương mại điện tử")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Tên shop")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Ngày giao hàng thành công")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Địa điểm giao hàng")')).toBeVisible();
  await expect(orderModal.locator('label:has-text("Tình trạng vận chuyển")')).toBeVisible();

  // Capture Order Modal screenshot
  await page.screenshot({ path: path.join(artifactDir, 'sales_order_redesign.png') });
  console.log('Captured sales_order_redesign.png');

  // Close modal
  await orderModal.locator('button:has-text("Hủy")').click();
  await page.waitForTimeout(400);

  // =========================================================================
  // 3. VERIFY HỢP ĐỒNG BÁN (HĐB00001 - Screenshot 3)
  // =========================================================================
  console.log('3. Navigating to sales contracts tab...');
  await page.goto('http://localhost:5173/sales/contracts?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  const themContractBtn = page.getByRole('button', { name: 'Thêm', exact: true });
  await themContractBtn.click();
  await page.waitForTimeout(600);

  const contractModal = page.locator('.misa-purchase-modal-window');
  await expect(contractModal).toBeVisible();
  await expect(contractModal.locator('h2')).toContainText('Hợp đồng bán');
  await expect(contractModal.getByText('Hợp đồng', { exact: true })).toBeVisible();
  await expect(contractModal.getByText('Dự án', { exact: true })).toBeVisible();
  await expect(contractModal.locator('input[placeholder="Nhập số đơn đặt hàng"]')).toBeVisible();

  // Master fields
  await expect(contractModal.getByText('Số hợp đồng', { exact: true })).toBeVisible();
  await expect(contractModal.locator('label:has-text("Thuộc dự án")')).toBeVisible();
  await expect(contractModal.getByText('Giá trị hợp đồng', { exact: true }).first()).toBeVisible();
  await expect(contractModal.locator('label:has-text("Giá trị hợp đồng quy đổi")')).toBeVisible();
  await expect(contractModal.locator('label:has-text("Tình trạng hợp đồng")')).toBeVisible();
  await expect(contractModal.locator('label:has-text("Tình trạng giao hàng")')).toBeVisible();
  await expect(contractModal.locator('label:has-text("Ngày ký")')).toBeVisible();
  await expect(contractModal.locator('label:has-text("Mã khách hàng")')).toBeVisible();
  await expect(contractModal.locator('label:has-text("Tên khách hàng")')).toBeVisible();
  await expect(contractModal.getByText('Hạn giao hàng', { exact: true })).toBeVisible();
  await expect(contractModal.getByText('Hạn thanh toán', { exact: true })).toBeVisible();
  await expect(contractModal.locator('label:has-text("Tự động chuyển Đã thanh lý khi hợp đồng đã giao đủ hàng")')).toBeVisible();

  // Collapsible: Thông tin mở rộng
  await expect(contractModal.locator('span:has-text("Thông tin mở rộng")')).toBeVisible();
  await expect(contractModal.locator('label:has-text("Trích yếu")')).toBeVisible();
  await expect(contractModal.locator('label:has-text("Đơn vị thực hiện")')).toBeVisible();
  await expect(contractModal.locator('label:has-text("Người thực hiện")')).toBeVisible();
  await expect(contractModal.getByText('Giá trị thanh lý', { exact: true })).toBeVisible();
  await expect(contractModal.locator('label:has-text("Giá trị thanh lý quy đổi")')).toBeVisible();
  await expect(contractModal.locator('label:has-text("Ngày thanh lý/hủy bỏ")')).toBeVisible();
  await expect(contractModal.locator('label:has-text("Lý do thanh lý/hủy bỏ")')).toBeVisible();
  await expect(contractModal.getByText('Tính giá thành', { exact: true })).toBeVisible();
  await expect(contractModal.getByText('Đã xuất hóa đơn', { exact: true })).toBeVisible();
  await expect(contractModal.getByText('Điều khoản khác', { exact: true })).toBeVisible();
  await expect(contractModal.getByText('Địa chỉ giao hàng', { exact: true })).toBeVisible();

  // Collapsible: Điều khoản thanh toán
  await expect(contractModal.locator('span:has-text("Điều khoản thanh toán")')).toBeVisible();

  // Table
  await expect(contractModal.locator('span:has-text("Danh sách hàng hóa dịch vụ")')).toBeVisible();
  await expect(contractModal.locator('th:has-text("Số lượng yêu cầu")')).toBeVisible();
  await expect(contractModal.locator('th:has-text("Số lượng đã giao")')).toBeVisible();
  await expect(contractModal.locator('th:has-text("Tỷ lệ CK (%)")')).toBeVisible();
  await expect(contractModal.locator('th:has-text("Tiền chiết khấu")')).toBeVisible();

  // Capture Contract Modal screenshot
  await page.screenshot({ path: path.join(artifactDir, 'sales_contract_redesign.png') });
  console.log('Captured sales_contract_redesign.png');

  // Close modal
  await contractModal.locator('button:has-text("Hủy")').click();
  await page.waitForTimeout(400);

  console.log('All 3 sales modals verified successfully!');
});
