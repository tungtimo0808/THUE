import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify specialized invoices redesign (Discount Invoice & Commercial Invoice)', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/43251ce8-0215-4e8b-8307-1aa88ffee55b');

  // =========================================================================
  // 1. NAVIGATE TO SALES INVOICES WORKSPACE
  // =========================================================================
  console.log('1. Navigating to sales invoices tab...');
  await page.goto('http://localhost:5173/sales/invoices?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  // =========================================================================
  // 2. VERIFY SCREENSHOT 1: HÓA ĐƠN CHIẾT KHẤU
  // =========================================================================
  console.log('2. Opening Hóa đơn chiết khấu from dropdown...');
  // Find the chevron toggle next to "Thêm"
  const themBtn = page.getByRole('button', { name: 'Thêm', exact: true });
  await expect(themBtn).toBeVisible();

  // The dropdown toggle button is immediately adjacent to the "Thêm" button
  const chevronToggle = themBtn.locator('xpath=following-sibling::button');
  await chevronToggle.click();
  await page.waitForTimeout(400);

  // Click "Hóa đơn chiết khấu"
  const discOption = page.locator('div:text-is("Hóa đơn chiết khấu")');
  await expect(discOption).toBeVisible();
  await discOption.click();
  await page.waitForTimeout(600);

  const discountModal = page.locator('.misa-purchase-modal-window');
  await expect(discountModal).toBeVisible();

  // Check Header
  await expect(discountModal.locator('h2')).toContainText('Hóa đơn chiết khấu');
  await expect(discountModal.locator('text=Hướng dẫn lập hóa đơn chiết khấu')).toBeVisible();

  // Check Status and Metadata Top Right
  await expect(discountModal.locator('text=CHƯA PHÁT HÀNH')).toBeVisible();
  await expect(discountModal.locator('text=Mẫu số HĐ')).toBeVisible();
  await expect(discountModal.locator('text=Ký hiệu HĐ')).toBeVisible();
  await expect(discountModal.locator('text=Số hóa đơn')).toBeVisible();
  await expect(discountModal.locator('text=Ngày HĐ')).toBeVisible();

  // Check Master Left Fields (6 rows)
  await expect(discountModal.locator('text=Đối tượng')).toBeVisible();
  await expect(discountModal.locator('text=Địa chỉ')).toBeVisible();
  await expect(discountModal.locator('text=Điện thoại')).toBeVisible();
  await expect(discountModal.locator('text=Mã số thuế/CCCD chủ hộ')).toBeVisible();
  await expect(discountModal.locator('text=Mã số ĐVQHNS')).toBeVisible();
  await expect(discountModal.locator('text=Số CCCD')).toBeVisible();
  await expect(discountModal.locator('text=Số hộ chiếu')).toBeVisible();
  await expect(discountModal.locator('text=Người mua hàng')).toBeVisible();
  await expect(discountModal.locator('text=Hình thức thanh toán')).toBeVisible();
  await expect(discountModal.locator('text=Tài khoản ngân hàng')).toBeVisible();
  await expect(discountModal.locator('text=Nhân viên bán hàng')).toBeVisible();
  await expect(discountModal.locator('text=Số bảng kê')).toBeVisible();
  await expect(discountModal.locator('text=Ngày bảng kê')).toBeVisible();
  await expect(discountModal.locator('text=Diễn giải')).toBeVisible();
  await expect(discountModal.locator('text=Tỉnh/Thành phố')).toBeVisible();
  await expect(discountModal.locator('text=Xã/Phường')).toBeVisible();
  await expect(discountModal.locator('text=Tham chiếu ...')).toBeVisible();

  // Check Sub-tabs
  await expect(discountModal.locator('text=Hàng tiền')).toBeVisible();
  await expect(discountModal.locator('text=Bảng kê các hóa đơn liên quan')).toBeVisible();
  await expect(discountModal.locator('text=Tự động tính toán số liệu')).toBeVisible();
  await expect(discountModal.locator('text=Chọn hóa đơn liên quan')).toBeVisible();

  // Check Table Columns
  await expect(discountModal.locator('th:has-text("Mã hàng")')).toBeVisible();
  await expect(discountModal.locator('th:has-text("Tên hàng")')).toBeVisible();
  await expect(discountModal.locator('th:has-text("ĐVT")')).toBeVisible();
  await expect(discountModal.locator('th:has-text("Số lượng")')).toBeVisible();
  await expect(discountModal.locator('th:has-text("Đơn giá")')).toBeVisible();
  await expect(discountModal.locator('th:has-text("Thành tiền")')).toBeVisible();
  await expect(discountModal.locator('th:has-text("% thuế GTGT")')).toBeVisible();
  await expect(discountModal.locator('th:has-text("Tiền thuế GTGT")')).toBeVisible();

  // Check Controls Below Table
  await expect(discountModal.locator('button:has-text("Thêm dòng")')).toBeVisible();
  await expect(discountModal.locator('button:has-text("Xóa hết dòng")')).toBeVisible();
  await expect(discountModal.locator('button:has-text("Thêm ghi chú")')).toBeVisible();
  await expect(discountModal.locator('text=Mã cửa hàng')).toBeVisible();
  await expect(discountModal.locator('text=Tên cửa hàng')).toBeVisible();
  await expect(discountModal.locator('text=Mã tra cứu HĐĐT')).toBeVisible();
  await expect(discountModal.locator('text=Đường dẫn tra cứu HĐĐT')).toBeVisible();
  await expect(discountModal.locator('text=Đính kèm')).toBeVisible();
  await expect(discountModal.locator('text=Dung lượng tối đa 5MB')).toBeVisible();

  // Check Right Totals
  await expect(discountModal.locator('span:text-is("Tổng tiền hàng")')).toBeVisible();
  await expect(discountModal.locator('span:text-is("Thuế GTGT")')).toBeVisible();
  await expect(discountModal.locator('span:text-is("Tổng tiền thanh toán")')).toBeVisible();

  // Check Footer
  await expect(discountModal.locator('button:text-is("Hủy")')).toBeVisible();
  await expect(discountModal.locator('button:text-is("Cất")')).toBeVisible();
  await expect(discountModal.locator('button:text-is("Cất và Phát hành hóa đơn")')).toBeVisible();

  // Capture screenshot of Hóa đơn chiết khấu
  await page.screenshot({ path: path.join(artifactDir, 'specialized_invoice_discount.png') });
  console.log('Captured specialized_invoice_discount.png');

  // Close discount modal
  await discountModal.locator('button:text-is("Hủy")').click();
  await page.waitForTimeout(400);

  // =========================================================================
  // 3. VERIFY SCREENSHOT 2: HÓA ĐƠN THƯƠNG MẠI
  // =========================================================================
  console.log('3. Opening Hóa đơn thương mại from dropdown...');
  await chevronToggle.click();
  await page.waitForTimeout(300);

  // Click "Hóa đơn thương mại"
  const commOption = page.locator('div:text-is("Hóa đơn thương mại")');
  await expect(commOption).toBeVisible();
  await commOption.click();
  await page.waitForTimeout(600);

  const commercialModal = page.locator('.misa-purchase-modal-window');
  await expect(commercialModal).toBeVisible();

  // Check Header (Screenshot 2: Title, Hướng dẫn sử dụng dropdown)
  await expect(commercialModal.locator('h2')).toContainText('Hóa đơn thương mại');
  await expect(commercialModal.locator('text=Hướng dẫn sử dụng')).toBeVisible();

  // Check Top Right
  await expect(commercialModal.locator('text=CHƯA PHÁT HÀNH')).toBeVisible();
  await expect(commercialModal.locator('text=Tổng tiền thanh toán').first()).toBeVisible();
  await expect(commercialModal.locator('text=Mẫu số HĐ')).toBeVisible();
  await expect(commercialModal.locator('text=Ký hiệu HĐ')).toBeVisible();
  await expect(commercialModal.locator('text=Số hóa đơn')).toBeVisible();
  await expect(commercialModal.locator('text=Ngày HĐ')).toBeVisible();

  // Check Master Left Fields (Screenshot 2: 5 rows)
  await expect(commercialModal.locator('text=Mã khách hàng')).toBeVisible();
  await expect(commercialModal.locator('text=Tên khách hàng')).toBeVisible();
  await expect(commercialModal.locator('text=Mã số thuế/CCCD chủ hộ')).toBeVisible();
  await expect(commercialModal.locator('text=Mã số ĐVQHNS')).toBeVisible();
  await expect(commercialModal.locator('text=Số CCCD')).toBeVisible();
  await expect(commercialModal.locator('text=Số hộ chiếu')).toBeVisible();
  await expect(commercialModal.locator('text=Địa chỉ')).toBeVisible();
  await expect(commercialModal.locator('text=Điện thoại')).toBeVisible();
  await expect(commercialModal.locator('text=Người mua hàng')).toBeVisible();
  await expect(commercialModal.locator('text=Hình thức thanh toán')).toBeVisible();
  await expect(commercialModal.locator('label:has-text("Tài khoản ngân hàng")')).toBeVisible();
  await expect(commercialModal.locator('label:has-text("Nhân viên bán hàng")')).toBeVisible();
  await expect(commercialModal.locator('text=Tham chiếu ...')).toBeVisible();

  // Check Tab (Screenshot 2 has ONLY Hàng tiền)
  await expect(commercialModal.locator('button:text-is("Hàng tiền")')).toBeVisible();
  await expect(commercialModal.locator('text=Bảng kê các hóa đơn liên quan')).toHaveCount(0);

  // Check Table Columns (Screenshot 2: NO "Tiền thuế GTGT" column)
  await expect(commercialModal.locator('th:has-text("Mã hàng")')).toBeVisible();
  await expect(commercialModal.locator('th:has-text("Tên hàng")')).toBeVisible();
  await expect(commercialModal.locator('th:has-text("ĐVT")')).toBeVisible();
  await expect(commercialModal.locator('th:has-text("Số lượng")')).toBeVisible();
  await expect(commercialModal.locator('th:has-text("Đơn giá")')).toBeVisible();
  await expect(commercialModal.locator('th:has-text("Thành tiền")')).toBeVisible();
  await expect(commercialModal.locator('th:has-text("% thuế GTGT")')).toBeVisible();
  await expect(commercialModal.locator('th:has-text("Tiền thuế GTGT")')).toHaveCount(0);

  // Check Controls Below Table
  await expect(commercialModal.locator('button:has-text("Thêm dòng")')).toBeVisible();
  await expect(commercialModal.locator('button:has-text("Thêm ghi chú")')).toBeVisible();
  await expect(commercialModal.locator('button:has-text("Xóa hết dòng")')).toBeVisible();
  await expect(commercialModal.locator('text=Là hóa đơn thay thế')).toBeVisible();
  await expect(commercialModal.locator('text=Mã tra cứu HĐĐT')).toBeVisible();
  await expect(commercialModal.locator('text=Đường dẫn tra cứu HĐĐT')).toBeVisible();
  await expect(commercialModal.locator('text=Đính kèm')).toBeVisible();

  // Check Right Totals (Screenshot 2 has ONLY Tổng tiền thanh toán 0, NO Tổng tiền hàng/Thuế GTGT)
  await expect(commercialModal.locator('span:text-is("Tổng tiền hàng")')).toHaveCount(0);
  await expect(commercialModal.locator('span:text-is("Thuế GTGT")')).toHaveCount(0);

  // Check Footer (Screenshot 2: Hủy | Cất | Cất và Đóng ▾)
  await expect(commercialModal.locator('button:text-is("Hủy")')).toBeVisible();
  await expect(commercialModal.locator('button:text-is("Cất")')).toBeVisible();
  await expect(commercialModal.locator('button:text-is("Cất và Đóng")')).toBeVisible();

  // Capture screenshot of Hóa đơn thương mại
  await page.screenshot({ path: path.join(artifactDir, 'specialized_invoice_commercial.png') });
  console.log('Captured specialized_invoice_commercial.png');
});
