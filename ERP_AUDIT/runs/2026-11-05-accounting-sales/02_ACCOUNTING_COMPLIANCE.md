# Audit nghiệp vụ kế toán — phân hệ bán hàng

Ngày 05/11/2026 · nhánh `tanh` · commit `c2451f8` · chỉ đọc code, chưa chạy test tái hiện.

Phạm vi: chứng từ bán hàng hóa và dịch vụ, giá vốn, trả hàng, giảm giá, hóa đơn chiết khấu, hóa đơn GTGT và thương mại, liên kết chứng từ, đồng bộ công nợ phải thu, phần tờ khai GTGT liên quan. Ba `accounting-auditor` chạy song song; người điều phối gộp các phát hiện trùng gốc (48 → 42) và đọc lại code của các phát hiện Critical cùng một phần High (đánh dấu ✔).

**Kết luận chung: FAIL** — còn 2 phát hiện Critical mở. Chưa phát hiện nào có test tái hiện, nên `CONFIRMED` ở đây nghĩa là "đã lần được đường code dẫn tới kết quả sai", chưa phải "đã chạy thấy sai".

| Mức | Số lượng |
|---|---|
| Critical | 2 |
| High | 19 |
| Medium | 17 |
| Low | 4 |

## Vấn đề nghiêm trọng nhất

1. **ACC-101 — Bỏ ghi sổ xóa thẳng bút toán.** Chứng từ bán, bán dịch vụ, trả hàng, giảm giá khi bỏ ghi sổ không đi qua `general_ledger.unpost`. Số dư các kỳ sau không được cập nhật (trả hàng và giảm giá còn không hoàn số dư kỳ hiện tại), lịch sử ghi sổ bị xóa theo, không kiểm tra ngày khóa. Mọi báo cáo đọc `AccountBalance` có thể sai sau một lần bỏ ghi.
2. **ACC-202 — Tiền bị ghi giảm hai lần** khi trả hàng hoặc giảm giá cho đơn bán thu tiền ngay rồi hoàn tiền cho khách.
3. **Tồn kho lệch tài khoản 156** từ nhiều đường: giá vốn ghi trùng qua chứng từ giá vốn (ACC-105), nhiều kho (ACC-106), không quy đổi ĐVT (ACC-107), giá vốn lấy lúc lập nháp (ACC-108), ghi sổ lại không xuất kho (ACC-102), trả hàng nhập kho giá 0 (ACC-204).
4. **Tờ khai GTGT lệch sổ 3331**: hóa đơn xuất trùng (ACC-301, ACC-302), hóa đơn chiết khấu không có bút toán (ACC-206), hóa đơn thương mại giả lập ở môi trường thật (ACC-306), hóa đơn ngoại tệ cộng như VND (ACC-317).
5. **Công nợ phải thu lệch 131**: ghi nhận trùng (ACC-307), bỏ ghi nhận không đụng sổ cái (ACC-308), tài khoản Nợ không ràng buộc loại thanh toán (ACC-109).

## Cần kế toán trưởng xác nhận

- Hóa đơn chiết khấu thương mại: hệ thống tự hạch toán, hay kế toán lập bút toán tay kèm liên kết bắt buộc (ACC-206).
- Tài khoản giảm trừ theo chế độ: trả hàng 5212, giảm giá 5213, chiết khấu 5211 (TT200/TT99); với TT133 ghi giảm thẳng tài khoản doanh thu của dòng gốc (ACC-208).
- Có cho phép hóa đơn GTGT không gắn chứng từ bán không, và khi đó doanh thu hạch toán ở đâu (ACC-303).
- Chứng từ nào là nguồn "đã giao" của đơn hàng: phiếu giao hay chứng từ bán xuất kho kèm (ACC-314).
- Quy tắc làm tròn thuế GTGT: theo dòng hay theo hóa đơn, đơn vị VND (ACC-111).
- Yêu cầu hóa đơn điều chỉnh khi trả hàng/giảm giá, và tính liên tục số hóa đơn theo ký hiệu (ACC-207, ACC-318). Các văn bản pháp lý liên quan trong `accounting-audit/regulations/README.md` đang **CHƯA XÁC MINH**.

## Phát hiện trùng gốc đã gộp

| Giữ | Gộp vào |
|---|---|
| ACC-101 | ACC-201, ACC-305 |
| ACC-104 | ACC-210, ACC-316 |
| ACC-109 | ACC-309 |
| ACC-112 | ACC-214 |

## Đối chiếu báo cáo cũ (BUSINESS_LOGIC_ISSUES.md)

- **BL-01**: chứng từ bán và bán dịch vụ đã dùng `source_module_request`, không còn lỗi ở đây. Chứng từ giá vốn còn cùng mẫu (ACC-113).
- **BL-08**: đã sửa trong code (`order_services.py:851-864` khóa dòng `Company`, thêm hậu tố uuid). Chưa có test đồng thời trên PostgreSQL.
- **BL-02**: không áp dụng; bán hàng không gọi sổ cái khi bỏ ghi mà xóa thẳng (ACC-101).

## Danh sách phát hiện

✔ = người điều phối đã đọc lại code. Độ tin cậy: C = CONFIRMED (lần được đường code), S = SUSPECTED (cần test), H = NEEDS_HUMAN_REVIEW.

### Critical

#### ACC-101 — Bỏ ghi sổ chứng từ bán, bán dịch vụ, trả hàng, giảm giá xóa thẳng bút toán GL thay vì gọi general_ledger.unpost/reverse ✔

- **Phân hệ:** sales/general_ledger · **Độ tin cậy:** C · **Trạng thái:** OPEN · **Gộp:** ACC-201, ACC-305
- **Vị trí:** `backend/sales/goods_sale_services.py:1004 (unpost_goods_sale)`; `backend/sales/service_sale_services.py:806 (unpost_service_sale)`; `backend/sales/sales_return_services.py:1028 (unpost_sales_return)`; `backend/sales/sales_allowance_services.py:951 (unpost_sales_allowance)`
- **Hiện trạng:** Bán hàng/dịch vụ: trừ tay period_debit/credit của kỳ đó với max(...,0), không gọi _cascade_subsequent_balances, rồi entry.delete(). Trả hàng/giảm giá: journal.lines.all().delete(); journal.delete() mà không hoàn AccountBalance. JournalPostingHistory on_delete=CASCADE nên lịch sử POST mất. Không gọi assert_not_locked, không kiểm tra ClosingRun/AllocationRun, không đánh dấu BCTC STALE.
- **Mong đợi:** GL-3, GL-4, GL-6, CT-2: chứng từ đã ghi sổ chỉ thay đổi qua unpost/reverse của GL; số dư được hoàn và cập nhật dây chuyền sang kỳ sau; kiểm tra khóa; giữ nhật ký.
- **Đề xuất sửa:** Gọi general_ledger.services.unpost(entry, source_module_request(...)) hoặc reverse khi kỳ đã khóa; không xóa JournalEntry đã ghi sổ; đánh dấu Receivable REVERSED thay vì xóa.
- **Tiêu chí xác minh:** Sau ghi sổ → bỏ ghi: AccountBalance mọi kỳ bằng trước khi ghi sổ; opening kỳ sau = closing kỳ trước; có JournalPostingHistory POST và UNPOST; bỏ ghi trong khoảng ngày khóa hoặc kỳ CLOSED trả 400.

#### ACC-202 — Trả hàng/giảm giá cho đơn bán thu tiền ngay ghi giảm tiền (111/112) hai lần ✔

- **Phân hệ:** sales · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_return_services.py:415`; `backend/sales/sales_return_services.py:1138 (refund)`; `backend/sales/sales_allowance_services.py:433`; `backend/sales/sales_allowance_services.py:1016`
- **Hiện trạng:** Tài khoản đối ứng mặc định = source_line.receivable_or_payment_account; với đơn CASH/BANK là 111/112 nên ghi sổ trả hàng ghi Có 111/112. Đơn không có Receivable nên refundable_amount = total_amount; bước hoàn tiền ghi tiếp Nợ 131 / Có 111/112.
- **Mong đợi:** Tiền chỉ giảm một lần; đối ứng của trả hàng/giảm giá là phải thu khách hàng, việc chi tiền chỉ đi qua hoàn tiền.
- **Đề xuất sửa:** Đối ứng luôn là tài khoản 131x (độc lập tài khoản thanh toán của đơn bán); hoặc ghi Có tiền ngay và cấm hoàn tiền tiếp.
- **Tiêu chí xác minh:** Đơn CASH 100, trả toàn bộ, hoàn 100: 111 giảm đúng 100, 131 của khách = 0.

### High

#### ACC-102 — Ghi sổ lại chứng từ bán ATTACH_ISSUE sau khi bỏ ghi: ghi Có 156 mà không xuất kho lại

- **Phân hệ:** sales/inventory · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/goods_sale_services.py:792`; `backend/sales/goods_sale_services.py:1001`; `backend/sales/goods_sale_services.py:904`
- **Hiện trạng:** Bỏ ghi đảo phiếu xuất nhưng không xóa sale.inventory_transaction/inventory_created; khi ghi sổ lại điều kiện 'not sale.inventory_transaction_id' sai nên không tạo phiếu xuất mới, trong khi bút toán vẫn Nợ 632/Có 156.
- **Mong đợi:** SA-2, IN-3: giảm kho và giá vốn đi cùng nhau.
- **Đề xuất sửa:** Reset inventory_transaction/inventory_created khi bỏ ghi (hoặc kiểm tra phiếu còn POSTED); ghi sổ lại tạo phiếu mới với số không trùng.
- **Tiêu chí xác minh:** Chu trình ghi sổ → bỏ ghi → ghi lại: giá trị tồn kho = số dư 156.

#### ACC-103 — Bỏ ghi sổ chứng từ bán không chặn khi đã có trả hàng/giảm giá đã ghi sổ hoặc hóa đơn đã phát hành

- **Phân hệ:** sales/accounts_receivable · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/goods_sale_services.py:991 (unpost_goods_sale)`
- **Hiện trạng:** Chỉ chặn khi collected_amount hoặc netted_amount > 0; trả hàng thay đổi adjustment_amount nên không bị bắt. Receivable bị xóa, bút toán trả hàng (Có 131) vẫn POSTED; TaxInvoice đã phát hành vẫn lên tờ khai.
- **Mong đợi:** SA-3, SA-4, TX-2: không bỏ ghi chứng từ gốc khi còn chứng từ phụ thuộc đã ghi sổ/phát hành.
- **Đề xuất sửa:** Chặn khi tồn tại SalesReturn/SalesAllowance POSTED, SalesInvoice ISSUED, tax_invoice đã gắn, hoặc adjustment_amount khác 0.
- **Tiêu chí xác minh:** Bỏ ghi chứng từ bán đã có trả hàng hoặc hóa đơn phát hành trả 400.

#### ACC-104 — Chứng từ bán, bán dịch vụ, trả hàng, giảm giá bằng ngoại tệ không quy đổi VND: bút toán bị chặn, hoặc ghi nguyên tệ như VND nếu thiếu accounting_currency

- **Phân hệ:** sales/general_ledger · **Độ tin cậy:** C · **Trạng thái:** OPEN · **Gộp:** ACC-210, ACC-316
- **Vị trí:** `backend/sales/goods_sale_services.py:861`; `backend/sales/service_sale_services.py:700`; `backend/sales/sales_return_services.py:912`; `backend/sales/sales_allowance_services.py:862`; `backend/general_ledger/services.py:117 (_validate_entry)`
- **Hiện trạng:** JournalLine debit/credit = số nguyên tệ, currency theo chứng từ, không gán foreign_amount/exchange_rate; _validate_entry yêu cầu hai trường này nên trả 400. Nếu doanh nghiệp chưa đặt accounting_currency thì nguyên tệ ghi thẳng như VND. Dòng giá vốn (VND) cũng gắn ngoại tệ.
- **Mong đợi:** GL-1: cân theo VND và theo từng nguyên tệ; debit/credit theo VND quy đổi.
- **Đề xuất sửa:** Quy đổi theo exchange_rate của chứng từ, điền foreign_amount/exchange_rate, ghi dòng giá vốn bằng đồng tiền hạch toán, xử lý chênh lệch làm tròn.
- **Tiêu chí xác minh:** Chứng từ USD tỷ giá 25.000 ghi sổ được; Nợ = Có theo VND và theo USD.

#### ACC-105 — Chứng từ giá vốn (UC-SAL-10) có thể ghi trùng Nợ 632/Có 156 cho phiếu xuất đã có giá vốn ✔

- **Phân hệ:** sales · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/cogs_services.py:77 (get_eligible_outward_lines)`; `backend/sales/goods_sale_services.py:808`; `backend/sales/cogs_services.py:664 (post_cogs_voucher)`
- **Hiện trạng:** Dòng xuất ISSUE/POSTED đủ điều kiện nếu không có GoodsSaleLine.inventory_transaction_line trỏ tới; phiếu ATTACH_ISSUE tạo InventoryTransactionLine nhưng không gắn ngược nên bị coi là chưa có giá vốn. Phiếu INV_SALE_ISSUE/INV_OTHER_ISSUE đã tự hạch toán cũng đủ điều kiện.
- **Mong đợi:** SA-2, IN-3: mỗi lần xuất chỉ có một bút toán giá vốn.
- **Đề xuất sửa:** Chỉ nhận dòng xuất chưa có giá vốn trên GL (theo gl_status/source_module); gắn liên kết dòng xuất với dòng bán khi tạo phiếu ATTACH_ISSUE.
- **Tiêu chí xác minh:** Phiếu -XK của chứng từ bán ATTACH_ISSUE không có trong danh sách đủ điều kiện; tổng Nợ 632 = tổng giá trị dòng xuất bán.

#### ACC-106 — Chứng từ bán ATTACH_ISSUE nhiều kho: mọi dòng bị trừ ở kho của dòng đầu

- **Phân hệ:** sales/inventory · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/goods_sale_services.py:793`; `backend/inventory/services.py:334`
- **Hiện trạng:** Phiếu xuất có source_warehouse=lines[0].warehouse, dòng không có kho riêng; kho dùng obj.source_warehouse cho module SAL. Kiểm tra tồn và chiều kho trên 156 lại theo line.warehouse.
- **Mong đợi:** IN-1, IN-3: xuất đúng kho từng dòng; tồn theo kho khớp 156 theo kho.
- **Đề xuất sửa:** Đặt kho theo dòng hoặc tách phiếu theo kho.
- **Tiêu chí xác minh:** Chứng từ 2 dòng kho A/B: mỗi kho giảm đúng số của dòng mình.

#### ACC-107 — Xuất kho bán hàng và trả hàng không quy đổi đơn vị tính về đơn vị cơ sở

- **Phân hệ:** sales/inventory · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/goods_sale_services.py:249`; `backend/sales/goods_sale_services.py:813`; `backend/sales/sales_return_services.py:868`
- **Hiện trạng:** base_quantity = quantity theo ĐVT bán, không áp ItemUomConversion; giá vốn = quantity × average_cost (theo đơn vị cơ sở); kiểm tra tồn so khác đơn vị.
- **Mong đợi:** SA-2: số lượng và giá trị giảm kho bằng số bán quy đổi.
- **Đề xuất sửa:** Quy đổi về ĐVT cơ sở trước khi kiểm tra tồn, tính giá vốn, tạo dòng kho.
- **Tiêu chí xác minh:** Bán 1 thùng = 24 cái: kho giảm 24 cái, giá vốn = 24 × giá bình quân.

#### ACC-108 — Giá vốn ATTACH_ISSUE lấy lúc lập nháp, không theo phương pháp tính giá lúc ghi sổ; có trường hợp kho giảm giá trị mà không ghi 632/156

- **Phân hệ:** sales/inventory · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/goods_sale_services.py:254`; `backend/sales/goods_sale_services.py:904`; `backend/inventory/services.py:209`; `backend/inventory/services.py:338`
- **Hiện trạng:** unit_cost = StockBalance...first().average_cost lúc tạo/sửa nháp, không tính lại khi ghi sổ; kho dùng line.unit_cost cho SAL. Nếu nháp có unit_cost = 0 thì bút toán không có 632/156 nhưng kho vẫn giảm giá trị theo giá bình quân hiện tại. Thiếu tài khoản 632/156 không bị chặn.
- **Mong đợi:** IN-2, IN-3, SA-2: giá xuất theo phương pháp tại thời điểm xuất; giá trị giảm kho = Có 156.
- **Đề xuất sửa:** Ghi sổ kho trước, lấy line_value thực tế để sinh 632/156; bắt buộc có tài khoản 632/156 khi có xuất kho.
- **Tiêu chí xác minh:** Tổng StockMovement.value_delta của phiếu = Có 156 trên bút toán bán, kể cả khi giá đổi giữa lúc lập nháp và lúc ghi sổ.

#### ACC-109 — Loại thanh toán và tài khoản Nợ của chứng từ bán không ràng buộc nhau; bút toán chỉ dùng tài khoản của dòng 1

- **Phân hệ:** sales/accounts_receivable · **Độ tin cậy:** C · **Trạng thái:** OPEN · **Gộp:** ACC-309
- **Vị trí:** `backend/sales/goods_sale_services.py:264`; `backend/sales/goods_sale_services.py:855`; `backend/sales/goods_sale_services.py:935`; `backend/sales/service_sale_services.py:236`
- **Hiện trạng:** receivable_or_payment_account nhận mọi tài khoản chi tiết; Receivable chỉ tạo khi payment_type=UNPAID; Nợ toàn bộ total_amount vào tài khoản của lines[0]. CASH + 131 → 131 tăng mà không có công nợ chi tiết; UNPAID + 111 → Receivable với account=111.
- **Mong đợi:** SA-4: tổng công nợ chi tiết = số dư 131.
- **Đề xuất sửa:** Kiểm tra nhóm tài khoản theo payment_type; một tài khoản Nợ cho cả chứng từ hoặc sinh từng dòng Nợ.
- **Tiêu chí xác minh:** CASH + 131 và UNPAID + 111 đều trả 400.

#### ACC-203 — Trả hàng không trừ phần đã giảm giá: tổng giảm trừ có thể vượt doanh thu và thuế gốc

- **Phân hệ:** sales · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_return_services.py:329 (calculate_and_validate_return_lines)`; `backend/sales/sales_allowance_services.py:356`
- **Hiện trạng:** Trả hàng chỉ giới hạn theo số lượng, giá trị = số lượng × đơn giá gốc; SalesAllowanceLine đã ghi sổ không được trừ. Giảm giá có trừ trả hàng nhưng chỉ phần POSTED.
- **Mong đợi:** SA-3: tổng giảm trừ và thuế điều chỉnh của một dòng bán không vượt doanh thu thuần và thuế gốc.
- **Đề xuất sửa:** Phân bổ phần đã giảm giá theo số lượng khi tính trả hàng; kiểm tra chéo tổng giá trị lúc ghi sổ.
- **Tiêu chí xác minh:** Bán 100 + thuế 10, giảm giá 100, rồi trả 1 đơn vị: bị chặn hoặc giá trị trả = 0.

#### ACC-204 — Trả hàng cho đơn bán SEPARATE_ISSUE/LINK_EXISTING nhập lại kho giá 0 và không đảo giá vốn

- **Phân hệ:** sales/inventory · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/goods_sale_services.py:255`; `backend/sales/sales_return_services.py:389`; `backend/sales/sales_return_services.py:953`
- **Hiện trạng:** GoodsSaleLine.unit_cost/cogs_amount chỉ có với ATTACH_ISSUE; trả hàng lấy unit_cost của dòng bán (= 0) nên phiếu nhập giá trị 0, bút toán Nợ 156/Có 632 bị bỏ vì cogs_amount = 0.
- **Mong đợi:** SA-3, IN-2, IN-3: hàng nhập lại mang giá vốn thực tế đã xuất và đảo 632.
- **Đề xuất sửa:** Lấy giá vốn từ dòng phiếu xuất gốc hoặc chứng từ giá vốn đã ghi sổ; chặn nếu chưa có giá vốn gốc.
- **Tiêu chí xác minh:** Trả 1 đơn vị đã xuất giá vốn X: kho tăng X, 632 giảm X.

#### ACC-205 — Ghi sổ lại phiếu trả hàng sau khi bỏ ghi lỗi 500 do trùng số phiếu nhập kho

- **Phân hệ:** sales/inventory · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_return_services.py:836`; `backend/inventory/models.py:158`
- **Hiện trạng:** Phiếu '{number}-NK' cũ chuyển REVERSED nhưng còn trong DB; ghi sổ lại tạo cùng số, vi phạm uq_inv_transaction_number.
- **Mong đợi:** CT-3; vòng đời ghi sổ, bỏ ghi, ghi lại phải chạy được.
- **Đề xuất sửa:** Cấp số phiếu kho có hậu tố phiên bản, hoặc tái sử dụng/hủy phiếu cũ rõ ràng.
- **Tiêu chí xác minh:** Ghi sổ → bỏ ghi → ghi lại phiếu trả hàng ATTACH_INWARD thành công, tồn kho tăng một lần.

#### ACC-206 — Hóa đơn chiết khấu thương mại giảm thuế đầu ra trên tờ khai nhưng không sinh bút toán và không giảm công nợ

- **Phân hệ:** sales/tax_management · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/discount_invoice_services.py:827 (issue_discount_invoice)`; `backend/tax_management/vat.py:83`
- **Hiện trạng:** Phát hành tạo TaxInvoice ADJUSTMENT/DECREASE (tờ khai giảm thuế) nhưng không tạo JournalEntry (Nợ 5211, Nợ 33311 / Có 131) và không điều chỉnh Receivable; accounting_document_ref là chuỗi tự do.
- **Mong đợi:** SA-3, TX-1: chiết khấu đảo doanh thu, thuế, công nợ; tờ khai khớp 33311. Nếu thiết kế cố ý để kế toán lập bút toán tay thì phải có liên kết bắt buộc (cần kế toán trưởng quyết định hướng).
- **Đề xuất sửa:** Sinh bút toán và điều chỉnh công nợ khi phát hành, hoặc bắt buộc liên kết JournalEntry đã ghi sổ.
- **Tiêu chí xác minh:** Sau phát hành: thuế ADJUSTMENT/DECREASE trong kỳ = phát sinh Nợ 33311 từ chiết khấu; 131 của khách giảm đúng tổng tiền.

#### ACC-207 — Trả hàng/giảm giá giảm 33311 trên sổ cái mà không bắt buộc hóa đơn điều chỉnh; liên kết hóa đơn không kiểm tra loại và số tiền

- **Phân hệ:** sales/tax_management · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_return_services.py:1179 (link_tax_invoice)`; `backend/sales/sales_allowance_services.py:1088`
- **Hiện trạng:** Ghi sổ Nợ 33311 không cần tax_invoice; link_tax_invoice nhận mọi TaxInvoice của công ty, không kiểm tra direction/invoice_type/adjustment_effect/original_invoice/số tiền; so khớp người mua chỉ cần tên hoặc MST.
- **Mong đợi:** TX-1, TX-2: sổ 33311 khớp sổ thuế. Yêu cầu pháp lý về hóa đơn điều chỉnh chưa xác minh (cần người xem).
- **Đề xuất sửa:** Kiểm tra loại, chiều, hiệu ứng, hóa đơn gốc, số tiền khi liên kết; cảnh báo hoặc chặn đóng kỳ thuế khi còn chứng từ chưa có hóa đơn điều chỉnh.
- **Tiêu chí xác minh:** Liên kết hóa đơn ORIGINAL hoặc sai số tiền trả 400; có cảnh báo khi đóng kỳ thuế.

#### ACC-301 — Hóa đơn ở REVISION_REQUIRED/REJECTED/ISSUE_FAILED nhả số lượng giữ chỗ nhưng vẫn phát hành lại được: xuất hóa đơn vượt số đã bán

- **Phân hệ:** sales · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_invoice_services.py:237 (sale_invoice_pending_filter)`; `backend/sales/sales_invoice_services.py:836 (issue_sales_invoice)`
- **Hiện trạng:** Tập giữ chỗ chỉ gồm DRAFT/PENDING_APPROVAL/APPROVED/ISSUING; gửi duyệt và phát hành không kiểm tra lại số còn lại.
- **Mong đợi:** TX-1: một dòng hàng chỉ xuất hóa đơn một lần.
- **Đề xuất sửa:** Mọi trạng thái khác CANCELLED giữ chỗ; kiểm tra lại (có khóa dòng nguồn) khi gửi duyệt và phát hành.
- **Tiêu chí xác minh:** Kịch bản A bị yêu cầu sửa → B phát hành → A phát hành: lần phát hành thứ hai trả 400.

#### ACC-302 — Cùng một hàng hóa có thể xuất hóa đơn nhiều lần qua các nguồn khác nhau (đơn hàng, chứng từ bán, hóa đơn thương mại, TaxInvoice gắn tay)

- **Phân hệ:** sales/tax_management · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_invoice_services.py:228`; `backend/sales/sales_invoice_services.py:891`; `backend/sales/commercial_invoice_services.py:103`
- **Hiện trạng:** Mỗi nguồn đếm số đã xuất theo khóa riêng (order_line / goods_sale_line / service_sale_line / source_order_line), không loại trừ lẫn nhau; issue_sales_invoice luôn tạo TaxInvoice mới kể cả khi chứng từ bán đã có tax_invoice.
- **Mong đợi:** TX-1.
- **Đề xuất sửa:** Một nguồn duy nhất cho số đã xuất hóa đơn theo dòng đơn hàng/dòng chứng từ bán (gồm gián tiếp và hóa đơn thương mại); chặn phát hành khi chứng từ đã có tax_invoice.
- **Tiêu chí xác minh:** Ba kịch bản (đơn hàng→chứng từ bán, đơn hàng→hóa đơn thương mại, link_tax_invoice rồi phát hành) trả 400 ở lần thứ hai.

#### ACC-306 — Hóa đơn thương mại điện tử được phát hành giả lập ngay cả khi EINVOICE_SIMULATION=False và lên tờ khai ✔

- **Phân hệ:** sales/tax_management · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/commercial_invoice_services.py:763 (issue_commercial_invoice)`
- **Hiện trạng:** Không gọi require_einvoice_simulation() như hóa đơn GTGT và hóa đơn chiết khấu; tự cấp số, tạo TaxInvoice ISSUED với URL einvoice.internal.
- **Mong đợi:** TX-1, TX-2: chỉ ghi nhận đã phát hành khi có bằng chứng từ nhà cung cấp hóa đơn.
- **Đề xuất sửa:** Thêm guard mô phỏng; đường thật đi qua tích hợp tax_management.
- **Tiêu chí xác minh:** EINVOICE_SIMULATION=False: issue trả 400, không tạo TaxInvoice.

#### ACC-307 — Khoản phải thu sinh từ chứng từ bán có thể được ghi nhận công nợ lần hai từ dòng GL 131 ✔

- **Phân hệ:** accounts_receivable · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/accounts_receivable/services.py:123 (get_unrecognized_sources)`; `backend/accounts_receivable/services.py:212 (recognize_receivable)`
- **Hiện trạng:** Danh sách nguồn chưa ghi nhận lấy mọi dòng GL 131 Nợ có đối tượng, chỉ loại dòng đã có Receivable loại JOURNAL_ENTRY; Receivable của chứng từ bán có loại GOODS_SALE nên dòng đó vẫn hiện ra, và recognize tạo Receivable thứ hai.
- **Mong đợi:** SA-4: mỗi dòng 131 ứng với một khoản phải thu.
- **Đề xuất sửa:** Loại dòng GL có entry_id đã nằm trong Receivable.journal_entry hoặc thuộc phân hệ tự ghi nhận công nợ.
- **Tiêu chí xác minh:** Sau ghi sổ chứng từ bán, get_unrecognized_sources không chứa dòng của bút toán đó; recognize trả 400.

#### ACC-308 — 'Bỏ ghi nhận' khoản phải thu của chứng từ bán đưa sổ chi tiết về 0 nhưng 131 trên GL giữ nguyên ✔

- **Phân hệ:** accounts_receivable · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/accounts_receivable/services.py:591 (reverse_receivable)`
- **Hiện trạng:** reverse_receivable đặt balance = 0, status = REVERSED cho mọi loại nguồn; với GOODS_SALE/SERVICE_SALE bút toán 131 vẫn còn, chứng từ vẫn POSTED.
- **Mong đợi:** SA-4.
- **Đề xuất sửa:** Chặn reverse_receivable khi nguồn là chứng từ phân hệ; hướng người dùng sang bỏ ghi chứng từ nguồn.
- **Tiêu chí xác minh:** Reverse receivable có nguồn GOODS_SALE trả 400.

#### ACC-317 — Tổng hợp thuế GTGT cộng số nguyên tệ của hóa đơn ngoại tệ như VND ✔

- **Phân hệ:** tax_management · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/tax_management/services.py:296 (build_summary)`; `backend/tax_management/vat.py:87`
- **Hiện trạng:** TaxInvoice lưu subtotal/tax_amount theo loại tiền hóa đơn kèm exchange_rate; build_summary và vat.py cộng thẳng, không nhân tỷ giá.
- **Mong đợi:** TX-1: tờ khai bằng VND.
- **Đề xuất sửa:** Lưu số VND trên TaxInvoice/TaxInvoiceLine hoặc quy đổi khi tổng hợp.
- **Tiêu chí xác minh:** Hóa đơn USD 10.000: output_taxable_amount tăng 10.000 × tỷ giá.

### Medium

#### ACC-110 — Dòng Có doanh thu không làm tròn trong khi dòng Nợ dùng tổng đã làm tròn

- **Phân hệ:** sales · **Độ tin cậy:** S · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/goods_sale_services.py:875`; `backend/sales/service_sale_services.py:714`
- **Hiện trạng:** Có line_net = quantity × unit_price − discount không quantize; Nợ = total_amount đã quantize. Cân hay không phụ thuộc cách DB làm tròn khi lưu.
- **Mong đợi:** GL-1.
- **Đề xuất sửa:** Lưu net_amount đã làm tròn trên dòng và dùng cho GL.
- **Tiêu chí xác minh:** Test số lẻ PASS trên SQLite và PostgreSQL.

#### ACC-112 — Đảo phiếu kho khi bỏ ghi chứng từ bán/trả hàng ghi ngày hôm nay và không kiểm tra kỳ kho đã đóng

- **Phân hệ:** inventory · **Độ tin cậy:** C · **Trạng thái:** OPEN · **Gộp:** ACC-214
- **Vị trí:** `backend/inventory/services.py:617 (reverse)`; `backend/sales/goods_sale_services.py:1002`; `backend/sales/sales_return_services.py:1046`
- **Hiện trạng:** StockMovement đảo có movement_date = timezone.localdate(), không gọi _period_is_closed; gán request.data['reason'] lỗi khi request.data là QueryDict.
- **Mong đợi:** GL-3, IN-2: không đổi số liệu kỳ kho đã đóng; đảo cùng ngày với phát sinh gốc.
- **Đề xuất sửa:** Đảo theo ngày phiếu gốc, kiểm tra kỳ kho, truyền lý do qua tham số.
- **Tiêu chí xác minh:** Đảo phiếu thuộc kỳ kho CLOSED trả 400; movement đảo cùng ngày phiếu gốc.

#### ACC-113 — post_cogs_voucher truyền nguyên request nguồn vào GL và cho ghi sổ từ DRAFT

- **Phân hệ:** sales · **Độ tin cậy:** S · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/cogs_services.py:692`; `backend/sales/cogs_services.py:603`
- **Hiện trạng:** Gọi post_journal(journal, request) thay vì source_module_request (cùng mẫu BL-01); cho ghi sổ khi DRAFT.
- **Mong đợi:** GL-5, CT-1.
- **Đề xuất sửa:** Dùng source_module_request; chỉ ghi sổ khi APPROVED hoặc cấu hình không yêu cầu duyệt.
- **Tiêu chí xác minh:** Body có version vẫn ghi sổ được; DRAFT khi có yêu cầu duyệt trả 400.

#### ACC-208 — Tài khoản giảm trừ mặc định cho trả hàng là 5213 thay vì 5212; với TT133 luôn rơi về 5111

- **Phân hệ:** sales · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_return_services.py:110 (resolve_default_accounts)`
- **Hiện trạng:** Lọc mã bắt đầu 521, order_by('-code').first() → 5213; không có 521 thì lấy 511 nhỏ nhất (5111), không dùng source_line.revenue_account.
- **Mong đợi:** Quy tắc 9 trong .claude/rules/accounting.md: tài khoản theo nghiệp vụ và chế độ. Ánh xạ cụ thể cần đối chiếu văn bản đã xác minh.
- **Đề xuất sửa:** Ánh xạ cấu hình theo nghiệp vụ RETURN/ALLOWANCE/DISCOUNT; TT133 dùng tài khoản doanh thu của dòng gốc.
- **Tiêu chí xác minh:** TT200/TT99: trả hàng mặc định 5212; TT133: trả hàng của dòng 5113 ghi Nợ 5113.

#### ACC-209 — Trả hàng nhiều kho: mọi dòng nhập vào kho của dòng đầu, sổ cái ghi theo kho từng dòng

- **Phân hệ:** sales/inventory · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_return_services.py:828`; `backend/inventory/services.py:330`
- **Hiện trạng:** destination_warehouse = lines[0].warehouse; kho dùng kho của header; Nợ 156 gắn kho theo dòng.
- **Mong đợi:** IN-3.
- **Đề xuất sửa:** Tách phiếu nhập theo kho hoặc đặt kho đích trên từng dòng.
- **Tiêu chí xác minh:** Trả 2 dòng kho A/B: mỗi kho tăng đúng dòng của mình.

#### ACC-211 — Bút toán hoàn tiền chọn tài khoản 131 tùy ý, bỏ qua tài khoản ngân hàng, không tạo phiếu chi

- **Phân hệ:** sales/cash_management · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_return_services.py:1105`; `backend/sales/sales_allowance_services.py:1016`
- **Hiện trạng:** Account.filter(mã bắt đầu 131).first() không order_by và không dùng tài khoản đã ghi Có; company_bank_account đọc nhưng không dùng; không tạo CashTransaction/chứng từ ngân hàng; ngày luôn là hôm nay.
- **Mong đợi:** SA-4, CB-1, CB-3.
- **Đề xuất sửa:** Ghi Nợ đúng tài khoản 131 gốc; bắt buộc chọn quỹ/tài khoản ngân hàng và sinh chứng từ chi.
- **Tiêu chí xác minh:** Sau hoàn tiền, 131 chi tiết của khách = 0 trên cùng tài khoản con; có chứng từ chi tương ứng.

#### ACC-212 — Sửa phiếu trả hàng cho đổi chứng từ bán gốc mà không kiểm tra lại; phiếu kho LINK_EXISTING không được kiểm tra và bỏ đảo giá vốn

- **Phân hệ:** sales · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_return_services.py:570 (update_sales_return)`; `backend/sales/sales_return_services.py:486`
- **Hiện trạng:** update nhận goods_sale mới không kiểm tra công ty/trạng thái/khách hàng; LINK_EXISTING chỉ cần inventory_transaction khác rỗng; total_cogs = 0.
- **Mong đợi:** SA-3.
- **Đề xuất sửa:** Áp lại kiểm tra của bước tạo khi sửa; kiểm tra chặt phiếu kho liên kết và hạch toán đảo giá vốn theo giá trị phiếu.
- **Tiêu chí xác minh:** PATCH sang chứng từ bán của khách khác và liên kết phiếu kho sai đều trả 400.

#### ACC-213 — Ghi sổ đồng thời trả hàng/giảm giá có thể vượt số lượng hoặc giá trị còn lại

- **Phân hệ:** sales · **Độ tin cậy:** S · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_return_services.py:792`; `backend/sales/sales_allowance_services.py:790`
- **Hiện trạng:** Chỉ select_for_update trên chính chứng từ, không khóa GoodsSaleLine nguồn.
- **Mong đợi:** SA-3 khi chạy đồng thời.
- **Đề xuất sửa:** select_for_update trên dòng bán nguồn ở bước tạo và ghi sổ.
- **Tiêu chí xác minh:** Test đồng thời trên PostgreSQL: chỉ một phiếu thành công.

#### ACC-215 — Hóa đơn chiết khấu tính doanh số đủ điều kiện không trừ trả hàng/giảm giá; làm tròn 0,01 cho VND

- **Phân hệ:** sales · **Độ tin cậy:** S · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/discount_invoice_services.py:162`; `backend/sales/discount_invoice_services.py:434`
- **Hiện trạng:** Doanh số còn lại tính trên SalesInvoiceLine, không trừ SalesReturn/SalesAllowance; quantize 0.01 cho mọi loại tiền.
- **Mong đợi:** SA-3; quy tắc 5 làm tròn theo loại tiền.
- **Đề xuất sửa:** Trừ phần đã trả/giảm; làm tròn theo số lẻ của loại tiền.
- **Tiêu chí xác minh:** Hóa đơn đã trả hết không còn doanh số đủ điều kiện; VND là số nguyên.

#### ACC-303 — Hóa đơn có thể mang đơn giá/thuế suất khác chứng từ bán đã ghi sổ, hoặc không có nguồn

- **Phân hệ:** sales · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_invoice_services.py:433`; `backend/sales/sales_invoice_services.py:458`
- **Hiện trạng:** unit_price và tax_rate lấy từ dữ liệu gửi lên, không so với dòng nguồn đã ghi sổ; hóa đơn không nguồn vẫn sinh TaxInvoice ISSUED.
- **Mong đợi:** TX-1. Việc cho phép hóa đơn không nguồn cần quyết định nghiệp vụ.
- **Đề xuất sửa:** Khóa đơn giá/thuế suất theo dòng nguồn khi có nguồn.
- **Tiêu chí xác minh:** Hóa đơn có nguồn với thuế suất khác trả 400.

#### ACC-304 — Chứng từ bán đã ghi 3331 nhưng không có hóa đơn thì không lên tờ khai, và không có cảnh báo

- **Phân hệ:** sales/tax_management · **Độ tin cậy:** S · **Trạng thái:** OPEN
- **Vị trí:** `backend/tax_management/services.py:293 (build_summary)`
- **Hiện trạng:** Tờ khai chỉ tổng hợp TaxInvoice; post_goods_sale không tạo TaxInvoice; đối soát chỉ so tổng.
- **Mong đợi:** TX-1.
- **Đề xuất sửa:** Báo cáo ngoại lệ 'chứng từ bán đã ghi sổ chưa có hóa đơn' hoặc chặn khóa kỳ thuế.
- **Tiêu chí xác minh:** Chứng từ ghi sổ chưa có hóa đơn xuất hiện trong danh sách ngoại lệ.

#### ACC-310 — Báo cáo tuổi nợ tính cả khoản phải thu REVERSED và có thể bỏ qua cấn trừ/điều chỉnh

- **Phân hệ:** reporting/accounts_receivable · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/reporting/debt_report_services.py:1199 (_reconstruct_as_of_ar_debt)`
- **Hiện trạng:** Không lọc status; số còn lại = original_amount − tổng ReceiptAllocation (phần cấn trừ/điều chỉnh: SUSPECTED).
- **Mong đợi:** SA-4.
- **Đề xuất sửa:** Loại REVERSED; trừ cấn trừ/điều chỉnh theo ngày hiệu lực.
- **Tiêu chí xác minh:** Tổng báo cáo theo ngày = tổng balance còn hiệu lực = số dư 131 theo khách.

#### ACC-311 — Phân bổ thu tiền nhận dòng số tiền âm

- **Phân hệ:** accounts_receivable · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/accounts_receivable/services.py:878 (allocate)`
- **Hiện trạng:** Chỉ kiểm tra tổng > 0 và amount ≤ balance, không kiểm tra từng dòng > 0; dòng âm làm giảm collected_amount của khoản khác.
- **Mong đợi:** SA-5.
- **Đề xuất sửa:** Từ chối amount ≤ 0 trên từng dòng.
- **Tiêu chí xác minh:** Dòng âm trả 400.

#### ACC-312 — Liên kết chứng từ không kiểm tra dòng thuộc chứng từ đã chọn; tách rời giữ chỗ của hóa đơn

- **Phân hệ:** sales · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/link_services.py:276 (get_document_line_info)`; `backend/sales/link_services.py:647`
- **Hiện trạng:** line_model.filter(pk=line_id) không lọc theo chứng từ cha hay công ty; sức chứa liên kết độc lập với SalesInvoiceLine; so giá trị trên hai cơ sở khác nhau; người tạo dự phòng là UserAccount.objects.first().
- **Mong đợi:** CT-2; tính đúng của theo dõi chứng từ.
- **Đề xuất sửa:** Lọc dòng theo chứng từ và công ty; thống nhất cơ sở giá trị; bỏ người tạo dự phòng.
- **Tiêu chí xác minh:** Dòng của chứng từ khác trả 400.

#### ACC-313 — Số đã xuất hóa đơn trên dòng đơn hàng bị cộng trùng giữa đề nghị hóa đơn và hóa đơn phát hành, không giảm khi trả hàng

- **Phân hệ:** sales · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/services.py:145 (submit_invoice_request)`; `backend/sales/sales_invoice_services.py:941`
- **Hiện trạng:** Cả đề nghị hóa đơn và phát hành hóa đơn đều cộng invoiced_quantity; không có đường giảm; không khóa dòng.
- **Mong đợi:** Theo dõi đơn hàng đúng.
- **Đề xuất sửa:** Tính lại từ một nguồn, có khóa dòng.
- **Tiêu chí xác minh:** Đề nghị 10 rồi phát hành 10: invoiced_quantity = 10 hoặc lần hai trả 400.

#### ACC-314 — Ghi sổ/bỏ ghi chứng từ bán và trả hàng không cập nhật số đã giao và trạng thái đơn hàng

- **Phân hệ:** sales · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/goods_sale_services.py:740`; `backend/sales/services.py:127`
- **Hiện trạng:** delivered_quantity chỉ tăng ở confirm_delivery; đề nghị hóa đơn theo chính sách DELIVERY lại dùng delivered_quantity.
- **Mong đợi:** Quy trình đơn hàng nhất quán (chọn chứng từ nào là nguồn 'đã giao' cần kế toán trưởng quyết định).
- **Đề xuất sửa:** Đồng bộ delivered_quantity khi ghi sổ, bỏ ghi, trả hàng.
- **Tiêu chí xác minh:** Ghi sổ rồi bỏ ghi chứng từ bán có order_line: delivered_quantity và trạng thái đơn hàng đổi tương ứng.

#### ACC-315 — Duyệt hóa đơn trực tiếp lỗi 500 khi có workflow và không chặn người lập tự duyệt; hóa đơn thương mại gọi sai chữ ký approval_progress ✔

- **Phân hệ:** sales/approval_workflows · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_invoice_services.py:743 (decide_sales_invoice)`; `backend/approval_workflows/execution.py:23`; `backend/sales/commercial_invoice_services.py:634`
- **Hiện trạng:** Truyền list vào approval_progress (hàm gọi .filter) → AttributeError; không kiểm tra created_by == actor; hóa đơn thương mại gọi approval_progress(invoice, actor, 'SUBMITTED', comment=...) trong khi hàm nhận (obj, actor, approved, decisions) → TypeError.
- **Mong đợi:** CT-1.
- **Đề xuất sửa:** Truyền QuerySet; gọi check_approver_assignment_and_limit; sửa lời gọi ở hóa đơn thương mại.
- **Tiêu chí xác minh:** Có workflow: người lập tự duyệt trả 400/403, người duyệt hợp lệ trả 200; gửi duyệt hóa đơn thương mại trả 200.

### Low

#### ACC-111 — Thuế GTGT đầu ra làm tròn theo dòng 4 chữ số, không đối chiếu tổng thuế trên hóa đơn

- **Phân hệ:** sales/tax_management · **Độ tin cậy:** H · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/goods_sale_services.py:232`; `backend/sales/goods_sale_services.py:1045`
- **Hiện trạng:** Thuế dòng quantize 0.0001, tổng = tổng các dòng; link_tax_invoice chỉ so tổng thanh toán, cho lệch ≤ 1.
- **Mong đợi:** TX-1; quy tắc làm tròn thuế cần kế toán trưởng quyết định.
- **Đề xuất sửa:** Định nghĩa quy tắc làm tròn theo đồng tiền; so cả tiền thuế khi liên kết hóa đơn.
- **Tiêu chí xác minh:** Tổng thuế trên GL = thuế trên hóa đơn với hóa đơn nhiều dòng.

#### ACC-114 — Cấp số chứng từ bán nuốt lỗi quy tắc đánh số; số do client nhập trùng gây lỗi 500

- **Phân hệ:** sales · **Độ tin cậy:** S · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/goods_sale_services.py:75`; `backend/sales/service_sale_services.py:64`; `backend/sales/cogs_services.py:43`
- **Hiện trạng:** except Exception: pass quanh generate_document_number; get_or_create bộ đếm lần đầu có thể va chạm; số client gửi chỉ vấp ràng buộc unique dưới DB.
- **Mong đợi:** CT-3.
- **Đề xuất sửa:** Không nuốt lỗi; kiểm tra số trùng và trả ValidationError; thử lại khi gặp IntegrityError.
- **Tiêu chí xác minh:** Nhập số trùng trả 400; tạo đồng thời không lỗi.

#### ACC-216 — Trạng thái công nợ không chuyển PARTIALLY_PAID khi trả hàng một phần; dòng doanh thu trả hàng không làm tròn

- **Phân hệ:** sales · **Độ tin cậy:** C · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_return_services.py:987`; `backend/sales/sales_return_services.py:909`
- **Hiện trạng:** Receivable.status giữ OPEN khi giảm một phần; line_net không làm tròn trong khi total_amount có làm tròn, có thể làm bút toán lệch và bị chặn.
- **Mong đợi:** SA-5, GL-1.
- **Đề xuất sửa:** Dùng giá trị đã làm tròn; cập nhật trạng thái như phía giảm giá.
- **Tiêu chí xác minh:** Đơn giá lẻ ghi sổ được; trạng thái PARTIALLY_PAID khi 0 < balance < original.

#### ACC-318 — Số hóa đơn chính thức dùng chung bộ đếm với số nội bộ và hóa đơn chiết khấu, không tách theo ký hiệu

- **Phân hệ:** sales · **Độ tin cậy:** H · **Trạng thái:** OPEN
- **Vị trí:** `backend/sales/sales_invoice_services.py:92`; `backend/sales/discount_invoice_services.py:872`
- **Hiện trạng:** SalesInvoiceCounter(company, year) dùng cho số nội bộ HD, số chính thức và hóa đơn chiết khấu; không tách theo invoice_series; hủy được hóa đơn đang ISSUING.
- **Mong đợi:** Tính liên tục số hóa đơn theo ký hiệu (văn bản về hóa đơn điện tử, chưa xác minh).
- **Đề xuất sửa:** Bộ đếm riêng theo (công ty, ký hiệu, năm).
- **Tiêu chí xác minh:** Phát hành M hóa đơn: số chính thức liên tục 1..M theo ký hiệu.

## Mức hoàn thiện nghiệp vụ

| Nghiệp vụ | Kết luận | Ghi chú |
|---|---|---|
| Ghi nhận doanh thu + thuế + phải thu/tiền (VND) | PASS | Một bút toán, cân; rủi ro làm tròn ACC-110 |
| Bán ngoại tệ (bán, trả hàng, giảm giá) | FAIL | ACC-104 |
| Chiết khấu thương mại trên dòng | PASS |  |
| Giá vốn khớp giảm kho (ATTACH_ISSUE) | FAIL | ACC-106, ACC-107, ACC-108 |
| Chứng từ giá vốn riêng (UC-SAL-10) | FAIL | ACC-105, ACC-113 |
| Bán dịch vụ không sinh giá vốn/kho | PASS |  |
| Bỏ ghi sổ / ghi sổ lại chứng từ bán, trả hàng, giảm giá | FAIL | ACC-101, ACC-102, ACC-103, ACC-205, ACC-112 |
| Chống ghi sổ lặp (GL-5) | PASS | select_for_update + kiểm tra trạng thái; chưa test đồng thời trên PostgreSQL |
| Kỳ khóa — đường ghi sổ | PASS |  |
| Kỳ khóa — đường bỏ ghi sổ | FAIL | ACC-101, ACC-112 |
| Trả hàng: định khoản, giới hạn, nhập lại kho | PARTIAL | ACC-203, ACC-204, ACC-208, ACC-209, ACC-212, ACC-213 |
| Trả hàng/giảm giá cho đơn bán thu tiền ngay, hoàn tiền | FAIL | ACC-202, ACC-211 |
| Hóa đơn chiết khấu thương mại | FAIL | ACC-206, ACC-215 |
| Hóa đơn GTGT: giữ chỗ, phát hành, đồng bộ tờ khai | FAIL | ACC-301, ACC-302, ACC-303, ACC-304, ACC-306, ACC-317 |
| Thuế điều chỉnh cho trả hàng/giảm giá | PARTIAL | ACC-207 |
| Sổ chi tiết công nợ khớp 131 (SA-4) | FAIL | ACC-101, ACC-103, ACC-109, ACC-307, ACC-308, ACC-310 |
| Phân bổ thu tiền | PARTIAL | ACC-311; chưa lần hết phiếu thu/phân bổ |
| Tồn kho khớp 156 (IN-3) | FAIL | ACC-102, ACC-105, ACC-106, ACC-108, ACC-204, ACC-209 |
| Theo dõi đơn hàng (đã giao, đã xuất hóa đơn) | FAIL | ACC-313, ACC-314 |
| Phân bổ hợp đồng | PASS | Chỉ đọc dữ liệu đơn hàng |
| Duyệt, chặn tự duyệt (CT-1) | PARTIAL | Đường duyệt chung đạt; đường trực tiếp lỗi ACC-315 |
| Cấp số chứng từ (CT-3) | PARTIAL | ACC-114, ACC-205, ACC-318; BL-08 đã sửa trong code, chưa test đồng thời |

PASS ở đây nghĩa là đọc code không thấy lỗi; lần audit này chưa chạy test riêng.

## Ghi chú về test hiện có

- Test bỏ ghi sổ (`test_goods_sale_uc_sal_03.py`, `test_service_sale_uc_sal_04.py`, `test_sales_return_uc_sal_05.py::test_10`) chỉ kiểm tra HTTP 200 và trạng thái/công nợ; không kiểm tra `AccountBalance`, số dư kỳ sau, tồn kho, hay ghi sổ lại.
- `test_sales_return_uc_sal_05.py::test_08` đi đúng đường của ACC-202 nhưng không kiểm tra phát sinh 111/131.
- `test_sales_invoice_uc_sal_07.py::test_08` ép trạng thái PENDING_APPROVAL không có snapshot workflow nên không phát hiện ACC-315.
- Chưa có test cho: ngoại tệ, nhiều kho, ĐVT quy đổi, xuất hóa đơn trùng nguồn, hóa đơn ngoại tệ trên tờ khai, đối chiếu tổng Receivable với 131.
