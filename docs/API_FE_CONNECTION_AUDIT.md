# Đối chiếu API backend và frontend

Ngày kiểm tra: 15/10/2026. Phạm vi: backend và FRONTEND/src.

## Phương pháp và giới hạn

Kiểm tra tĩnh các router, APIView, action và mã TS/TSX. Chưa kiểm tra Network trên ứng dụng đang chạy. Tên tài nguyên hoặc đoạn đường dẫn action không xuất hiện trong FE được ghi nhận là chưa tìm thấy kết nối. Các lời gọi động có chuỗi tương ứng được coi là có khả năng kết nối; kết quả này chưa phải thống kê toàn bộ operation CRUD bị thiếu. Có lời gọi trong source cũng chưa chứng minh API chạy thành công.

Đã rà 198 đăng ký router: 20 nhóm không tìm thấy tên tài nguyên trong FE, 1 alias chưa dùng và 178 đường dẫn action không tìm thấy đoạn tĩnh trong FE. Action được xét theo url_path, tên mặc định DRF và kế thừa cục bộ. Một số action thuộc các nhóm chưa dùng nên hai số này không cộng với nhau.

## Nhóm chưa tìm thấy kết nối

| Nhóm API | Khai báo backend |
|---|---|
| `/api/v1/accounts-receivable/collection-plans/` | [backend/accounts_receivable/urls.py:7](../backend/accounts_receivable/urls.py#L7) |
| `/api/v1/accounts-receivable/confirmations/` | [backend/accounts_receivable/urls.py:16](../backend/accounts_receivable/urls.py#L16) |
| `/api/v1/common/ai-conversations/` | [backend/common_services/urls.py:62](../backend/common_services/urls.py#L62) |
| `/api/v1/iam/permission-resources/` | [backend/iam/urls.py:37](../backend/iam/urls.py#L37) |
| `/api/v1/iam/permission-actions/` | [backend/iam/urls.py:38](../backend/iam/urls.py#L38) |
| `/api/v1/iam/permission-bundles/` | [backend/iam/urls.py:40](../backend/iam/urls.py#L40) |
| `/api/v1/iam/role-permissions/` | [backend/iam/urls.py:41](../backend/iam/urls.py#L41) |
| `/api/v1/iam/role-permission-bundles/` | [backend/iam/urls.py:42](../backend/iam/urls.py#L42) |
| `/api/v1/iam/effective-permissions/` | [backend/iam/urls.py:52](../backend/iam/urls.py#L52) |
| `/api/v1/master-data/exchange-rate-types/` | [backend/master_data/urls.py:11](../backend/master_data/urls.py#L11) |
| `/api/v1/master-data/exchange-rates/` | [backend/master_data/urls.py:11](../backend/master_data/urls.py#L11) |
| `/api/v1/master-data/customer-profiles/` | [backend/master_data/urls.py:11](../backend/master_data/urls.py#L11) |
| `/api/v1/master-data/inventory-locations/` | [backend/master_data/urls.py:11](../backend/master_data/urls.py#L11) |
| `/api/v1/master-data/document-numbering-rules/` | [backend/master_data/urls.py:11](../backend/master_data/urls.py#L11) |
| `/api/v1/organization/employee-assignments/` | [backend/organization/urls.py:21](../backend/organization/urls.py#L21) |
| `/api/v1/reports/line-mappings/` | [backend/reporting/urls.py:9](../backend/reporting/urls.py#L9) |
| `/api/v1/reports/engine/` | [backend/reporting/urls.py:10](../backend/reporting/urls.py#L10) |
| `/api/v1/sales/deliveries/` | [backend/sales/urls.py:12](../backend/sales/urls.py#L12) |
| `/api/v1/sales/invoice-requests/` | [backend/sales/urls.py:13](../backend/sales/urls.py#L13) |
| `/api/v1/tax/connectors/` | [backend/tax_management/urls.py:13](../backend/tax_management/urls.py#L13) |


Riêng reporting: toàn bộ tiền tố `/api/v1/reports/` không xuất hiện trong FE, bao gồm definitions, line-mappings, engine, runs và exports. Ba nhóm definitions/runs/exports không được phép lọc theo tên phát hiện vì từ tương ứng xuất hiện trong ngữ cảnh khác. Như vậy có ít nhất 23 nhóm cần xem xét, không phải chỉ 20 nhóm ở bảng.

Một số nhóm có thể dùng đường dẫn nghiệp vụ khác: employee-assignments so với API tổ chức nhân viên, document-numbering-rules so với common/numbering-rules, customer-profiles so với customers/parties. Cần xác nhận nhu cầu trước khi triển khai thêm giao diện.

## Action chưa tìm thấy lời gọi

| Method | Endpoint | Nguồn |
|---|---|---|
| GET | `/api/v1/accounts-payable/documents/preview-number/` | [backend/accounts_payable/views.py:103](../backend/accounts_payable/views.py#L103) |
| GET | `/api/v1/accounts-payable/documents/supplier-info/` | [backend/accounts_payable/views.py:126](../backend/accounts_payable/views.py#L126) |
| GET | `/api/v1/accounts-payable/payment-requests/preview-number/` | [backend/accounts_payable/views.py:244](../backend/accounts_payable/views.py#L244) |
| GET | `/api/v1/accounts-payable/payment-requests/eligible-payables/` | [backend/accounts_payable/views.py:258](../backend/accounts_payable/views.py#L258) |
| GET | `/api/v1/accounts-payable/payment-requests/eligible-orders/` | [backend/accounts_payable/views.py:275](../backend/accounts_payable/views.py#L275) |
| POST | `/api/v1/accounts-payable/payment-requests/{id}/recall/` | [backend/accounts_payable/views.py:300](../backend/accounts_payable/views.py#L300) |
| GET | `/api/v1/accounts-payable/payments/preview-number/` | [backend/accounts_payable/views.py:378](../backend/accounts_payable/views.py#L378) |
| GET | `/api/v1/accounts-payable/payments/eligible-requests/` | [backend/accounts_payable/views.py:396](../backend/accounts_payable/views.py#L396) |
| GET | `/api/v1/accounts-payable/payments/request-detail/` | [backend/accounts_payable/views.py:411](../backend/accounts_payable/views.py#L411) |
| GET | `/api/v1/accounts-payable/payment-allocations/eligible-payments/` | [backend/accounts_payable/views.py:489](../backend/accounts_payable/views.py#L489) |
| GET | `/api/v1/accounts-payable/payment-allocations/eligible-payables/` | [backend/accounts_payable/views.py:497](../backend/accounts_payable/views.py#L497) |
| POST | `/api/v1/accounts-payable/payment-allocations/auto-suggest/` | [backend/accounts_payable/views.py:507](../backend/accounts_payable/views.py#L507) |
| GET | `/api/v1/accounts-payable/debt-offsets/eligible-partners/` | [backend/accounts_payable/views.py:587](../backend/accounts_payable/views.py#L587) |
| GET | `/api/v1/accounts-payable/debt-offsets/eligible-debts/` | [backend/accounts_payable/views.py:591](../backend/accounts_payable/views.py#L591) |
| GET | `/api/v1/accounts-payable/adjustment-vouchers/eligible-payables/` | [backend/accounts_payable/views.py:658](../backend/accounts_payable/views.py#L658) |
| GET | `/api/v1/accounts-payable/adjustment-vouchers/eligible-accounts/` | [backend/accounts_payable/views.py:664](../backend/accounts_payable/views.py#L664) |
| GET | `/api/v1/accounts-payable/tracking/document-preview/` | [backend/accounts_payable/views.py:829](../backend/accounts_payable/views.py#L829) |
| GET | `/api/v1/accounts-payable/tracking/export-summary/` | [backend/accounts_payable/views.py:877](../backend/accounts_payable/views.py#L877) |
| GET | `/api/v1/accounts-payable/tracking/export-detail/` | [backend/accounts_payable/views.py:887](../backend/accounts_payable/views.py#L887) |
| POST | `/api/v1/accounts-payable/due-payables/prepare-payment-request/` | [backend/accounts_payable/views.py:935](../backend/accounts_payable/views.py#L935) |
| GET | `/api/v1/accounts-payable/reports/supplier-detail/` | [backend/accounts_payable/views.py:991](../backend/accounts_payable/views.py#L991) |
| GET | `/api/v1/accounts-receivable/receivables/customer-debts/detail/` | [backend/accounts_receivable/views.py:129](../backend/accounts_receivable/views.py#L129) |
| GET | `/api/v1/accounts-receivable/receivables/due-tracking/` | [backend/accounts_receivable/views.py:192](../backend/accounts_receivable/views.py#L192) |
| GET | `/api/v1/accounts-receivable/receivables/due-tracking/item-detail/` | [backend/accounts_receivable/views.py:201](../backend/accounts_receivable/views.py#L201) |
| GET | `/api/v1/accounts-receivable/receivables/due-tracking/export/` | [backend/accounts_receivable/views.py:215](../backend/accounts_receivable/views.py#L215) |
| POST | `/api/v1/accounts-receivable/receivables/due-tracking/prepare-collection/` | [backend/accounts_receivable/views.py:231](../backend/accounts_receivable/views.py#L231) |
| GET | `/api/v1/accounts-receivable/receivables/by-source/` | [backend/accounts_receivable/views.py:260](../backend/accounts_receivable/views.py#L260) |
| POST | `/api/v1/accounts-receivable/receivables/bulk-recognize/` | [backend/accounts_receivable/views.py:306](../backend/accounts_receivable/views.py#L306) |
| GET | `/api/v1/accounts-receivable/customer-receipt-vouchers/suggest-allocations/` | [backend/accounts_receivable/views.py:416](../backend/accounts_receivable/views.py#L416) |
| POST | `/api/v1/accounts-receivable/customer-receipt-vouchers/{id}/request-revision/` | [backend/accounts_receivable/views.py:453](../backend/accounts_receivable/views.py#L453) |
| POST | `/api/v1/accounts-receivable/customer-receipt-vouchers/{id}/recall/` | [backend/accounts_receivable/views.py:457](../backend/accounts_receivable/views.py#L457) |
| GET | `/api/v1/accounts-receivable/allocation-vouchers/suggest-allocations/` | [backend/accounts_receivable/views.py:508](../backend/accounts_receivable/views.py#L508) |
| GET | `/api/v1/accounts-receivable/debt-netting-vouchers/eligible-debts/` | [backend/accounts_receivable/views.py:620](../backend/accounts_receivable/views.py#L620) |
| POST | `/api/v1/accounts-receivable/debt-netting-vouchers/{id}/recall/` | [backend/accounts_receivable/views.py:644](../backend/accounts_receivable/views.py#L644) |
| POST | `/api/v1/accounts-receivable/debt-netting-vouchers/{id}/request-revision/` | [backend/accounts_receivable/views.py:656](../backend/accounts_receivable/views.py#L656) |
| GET | `/api/v1/accounts-receivable/debt-adjustment-vouchers/eligible-receivables/` | [backend/accounts_receivable/views.py:735](../backend/accounts_receivable/views.py#L735) |
| POST | `/api/v1/accounts-receivable/debt-adjustment-vouchers/{id}/recall/` | [backend/accounts_receivable/views.py:758](../backend/accounts_receivable/views.py#L758) |
| POST | `/api/v1/accounts-receivable/debt-adjustment-vouchers/{id}/request-revision/` | [backend/accounts_receivable/views.py:776](../backend/accounts_receivable/views.py#L776) |
| GET | `/api/v1/accounts-receivable/debt-reconciliations/extract-data/` | [backend/accounts_receivable/views.py:829](../backend/accounts_receivable/views.py#L829) |
| POST | `/api/v1/accounts-receivable/debt-reconciliations/{id}/re-reconcile/` | [backend/accounts_receivable/views.py:909](../backend/accounts_receivable/views.py#L909) |
| GET | `/api/v1/accounts-receivable/customer-debt-reconciliations/extract-data/` | [backend/accounts_receivable/views.py:829](../backend/accounts_receivable/views.py#L829) |
| POST | `/api/v1/accounts-receivable/customer-debt-reconciliations/{id}/re-reconcile/` | [backend/accounts_receivable/views.py:909](../backend/accounts_receivable/views.py#L909) |
| POST | `/api/v1/accounts-receivable/confirmations/{id}/respond/` | [backend/accounts_receivable/views.py:562](../backend/accounts_receivable/views.py#L562) |
| GET | `/api/v1/accounts-receivable/due-tracking/item-detail/` | [backend/accounts_receivable/views.py:956](../backend/accounts_receivable/views.py#L956) |
| POST | `/api/v1/accounts-receivable/due-tracking/prepare-collection/` | [backend/accounts_receivable/views.py:993](../backend/accounts_receivable/views.py#L993) |
| GET | `/api/v1/accounts-receivable/customer-due-debts/item-detail/` | [backend/accounts_receivable/views.py:956](../backend/accounts_receivable/views.py#L956) |
| POST | `/api/v1/accounts-receivable/customer-due-debts/prepare-collection/` | [backend/accounts_receivable/views.py:993](../backend/accounts_receivable/views.py#L993) |
| GET | `/api/v1/accounts-receivable/payment-reminders/eligible-receivables/` | [backend/accounts_receivable/views.py:1037](../backend/accounts_receivable/views.py#L1037) |
| GET | `/api/v1/accounts-receivable/payment-reminders/default-customer-info/` | [backend/accounts_receivable/views.py:1067](../backend/accounts_receivable/views.py#L1067) |
| POST | `/api/v1/accounts-receivable/payment-reminders/create-from-due-tracking/` | [backend/accounts_receivable/views.py:1076](../backend/accounts_receivable/views.py#L1076) |
| POST | `/api/v1/accounts-receivable/payment-reminders/{id}/refresh-balances/` | [backend/accounts_receivable/views.py:1088](../backend/accounts_receivable/views.py#L1088) |
| GET | `/api/v1/accounts-receivable/customer-payment-reminders/eligible-receivables/` | [backend/accounts_receivable/views.py:1037](../backend/accounts_receivable/views.py#L1037) |
| GET | `/api/v1/accounts-receivable/customer-payment-reminders/default-customer-info/` | [backend/accounts_receivable/views.py:1067](../backend/accounts_receivable/views.py#L1067) |
| POST | `/api/v1/accounts-receivable/customer-payment-reminders/create-from-due-tracking/` | [backend/accounts_receivable/views.py:1076](../backend/accounts_receivable/views.py#L1076) |
| POST | `/api/v1/accounts-receivable/customer-payment-reminders/{id}/refresh-balances/` | [backend/accounts_receivable/views.py:1088](../backend/accounts_receivable/views.py#L1088) |
| POST | `/api/v1/common/notifications/mark-all-read/` | [backend/common_services/views.py:708](../backend/common_services/views.py#L708) |
| GET | `/api/v1/common/notifications/unread-count/` | [backend/common_services/views.py:712](../backend/common_services/views.py#L712) |
| POST | `/api/v1/fixed-assets/transactions/{id}/gl-error/` | [backend/fixed_assets/views.py:140](../backend/fixed_assets/views.py#L140) |
| POST | `/api/v1/general-ledger/accounts/import-csv/` | [backend/general_ledger/views.py:283](../backend/general_ledger/views.py#L283) |
| POST | `/api/v1/general-ledger/periods/{id}/reopen/` | [backend/general_ledger/views.py:373](../backend/general_ledger/views.py#L373) |
| POST | `/api/v1/iam/memberships/bulk-lock/` | [backend/iam/views.py:411](../backend/iam/views.py#L411) |
| POST | `/api/v1/iam/memberships/bulk-unlock/` | [backend/iam/views.py:426](../backend/iam/views.py#L426) |
| POST | `/api/v1/iam/memberships/request-exit/` | [backend/iam/views.py:498](../backend/iam/views.py#L498) |
| GET | `/api/v1/inventory/lot-serials/{id}/trace/` | [backend/inventory/views.py:70](../backend/inventory/views.py#L70) |
| POST | `/api/v1/inventory/transactions/{id}/gl-error/` | [backend/inventory/views.py:135](../backend/inventory/views.py#L135) |
| GET | `/api/v1/inventory/balances/as-of/` | [backend/inventory/views.py:172](../backend/inventory/views.py#L172) |
| POST | `/api/v1/master-data/payment-terms/import-preview/` | [backend/master_data/payment_terms.py:314](../backend/master_data/payment_terms.py#L314) |
| POST | `/api/v1/master-data/payment-terms/import-apply/` | [backend/master_data/payment_terms.py:319](../backend/master_data/payment_terms.py#L319) |
| POST | `/api/v1/master-data/payment-methods/import-preview/` | [backend/master_data/payment_methods.py:334](../backend/master_data/payment_methods.py#L334) |
| POST | `/api/v1/master-data/payment-methods/import-apply/` | [backend/master_data/payment_methods.py:339](../backend/master_data/payment_methods.py#L339) |
| GET | `/api/v1/master-data/catalog-imports/targets/` | [backend/master_data/catalog_imports.py:388](../backend/master_data/catalog_imports.py#L388) |
| GET | `/api/v1/master-data/catalog-imports/{id}/results.csv/` | [backend/master_data/catalog_imports.py:552](../backend/master_data/catalog_imports.py#L552) |
| GET | `/api/v1/master-data/catalog-exports/targets/` | [backend/master_data/catalog_exports.py:820](../backend/master_data/catalog_exports.py#L820) |
| POST | `/api/v1/master-data/tax-types/import-preview/` | [backend/master_data/tax_catalog.py:223](../backend/master_data/tax_catalog.py#L223) |
| POST | `/api/v1/master-data/tax-types/import-apply/` | [backend/master_data/tax_catalog.py:228](../backend/master_data/tax_catalog.py#L228) |
| POST | `/api/v1/master-data/tax-rate-configs/import-preview/` | [backend/master_data/tax_catalog.py:223](../backend/master_data/tax_catalog.py#L223) |
| POST | `/api/v1/master-data/tax-rate-configs/import-apply/` | [backend/master_data/tax_catalog.py:228](../backend/master_data/tax_catalog.py#L228) |
| POST | `/api/v1/master-data/item-categories/import-csv/` | [backend/master_data/views.py:418](../backend/master_data/views.py#L418) |
| POST | `/api/v1/master-data/units-of-measure/import-csv/` | [backend/master_data/views.py:573](../backend/master_data/views.py#L573) |
| POST | `/api/v1/master-data/items/import-csv/` | [backend/master_data/views.py:773](../backend/master_data/views.py#L773) |
| POST | `/api/v1/master-data/warehouses/import-csv/` | [backend/master_data/views.py:1031](../backend/master_data/views.py#L1031) |
| POST | `/api/v1/master-data/company-bank-accounts/import-csv/` | [backend/master_data/views.py:1357](../backend/master_data/views.py#L1357) |
| POST | `/api/v1/master-data/expense-items/ai-suggest/` | [backend/master_data/views.py:1501](../backend/master_data/views.py#L1501) |
| POST | `/api/v1/master-data/expense-items/import-csv/` | [backend/master_data/views.py:1525](../backend/master_data/views.py#L1525) |
| POST | `/api/v1/master-data/statistical-codes/ai-suggest/` | [backend/master_data/views.py:1709](../backend/master_data/views.py#L1709) |
| POST | `/api/v1/master-data/statistical-codes/import-csv/` | [backend/master_data/views.py:1731](../backend/master_data/views.py#L1731) |
| POST | `/api/v1/master-data/accounts/import-csv/` | [backend/general_ledger/views.py:283](../backend/general_ledger/views.py#L283) |
| POST | `/api/v1/organization/employees/import-csv/` | [backend/organization/views.py:471](../backend/organization/views.py#L471) |
| POST | `/api/v1/purchases/purchase-requests/{id}/request-revision/` | [backend/purchases/views.py:85](../backend/purchases/views.py#L85) |
| GET | `/api/v1/purchases/purchase-requests/{id}/approval-history/` | [backend/purchases/views.py:90](../backend/purchases/views.py#L90) |
| POST | `/api/v1/purchases/purchase-contracts/{id}/request-revision/` | [backend/purchases/views.py:85](../backend/purchases/views.py#L85) |
| GET | `/api/v1/purchases/purchase-contracts/{id}/approval-history/` | [backend/purchases/views.py:90](../backend/purchases/views.py#L90) |
| POST | `/api/v1/purchases/purchase-orders/{id}/request-revision/` | [backend/purchases/views.py:85](../backend/purchases/views.py#L85) |
| GET | `/api/v1/purchases/purchase-orders/{id}/approval-history/` | [backend/purchases/views.py:90](../backend/purchases/views.py#L90) |
| POST | `/api/v1/purchases/goods-purchases/{id}/request-revision/` | [backend/purchases/goods_views.py:94](../backend/purchases/goods_views.py#L94) |
| POST | `/api/v1/purchases/service-purchases/{id}/request-revision/` | [backend/purchases/goods_views.py:94](../backend/purchases/goods_views.py#L94) |
| GET | `/api/v1/purchases/purchase-returns/available-lines/` | [backend/purchases/return_views.py:78](../backend/purchases/return_views.py#L78) |
| POST | `/api/v1/purchases/purchase-returns/{id}/request-revision/` | [backend/purchases/return_views.py:116](../backend/purchases/return_views.py#L116) |
| GET | `/api/v1/purchases/purchase-discounts/eligible-purchases/` | [backend/purchases/discount_views.py:79](../backend/purchases/discount_views.py#L79) |
| GET | `/api/v1/purchases/purchase-discounts/available-lines/` | [backend/purchases/discount_views.py:100](../backend/purchases/discount_views.py#L100) |
| POST | `/api/v1/purchases/purchase-discounts/{id}/request-revision/` | [backend/purchases/discount_views.py:139](../backend/purchases/discount_views.py#L139) |
| POST/GET | `/api/v1/purchases/input-invoices/drafts/` | [backend/purchases/input_invoice_views.py:76](../backend/purchases/input_invoice_views.py#L76) |
| GET/PATCH/DELETE | `/api/v1/purchases/input-invoices/drafts/(?P<draft_id>[^/.]+)/` | [backend/purchases/input_invoice_views.py:108](../backend/purchases/input_invoice_views.py#L108) |
| POST | `/api/v1/purchases/input-invoices/drafts/(?P<draft_id>[^/.]+)/confirm/` | [backend/purchases/input_invoice_views.py:136](../backend/purchases/input_invoice_views.py#L136) |
| POST | `/api/v1/purchases/input-invoices/preview-xml/` | [backend/purchases/input_invoice_views.py:153](../backend/purchases/input_invoice_views.py#L153) |
| POST | `/api/v1/purchases/input-invoices/receive-xml/` | [backend/purchases/input_invoice_views.py:165](../backend/purchases/input_invoice_views.py#L165) |
| POST | `/api/v1/purchases/input-invoices/{id}/upload-preview/` | [backend/purchases/input_invoice_views.py:231](../backend/purchases/input_invoice_views.py#L231) |
| GET | `/api/v1/purchases/input-invoices/eligible-purchases/` | [backend/purchases/input_invoice_views.py:247](../backend/purchases/input_invoice_views.py#L247) |
| GET | `/api/v1/purchases/input-invoices/available-lines/` | [backend/purchases/input_invoice_views.py:267](../backend/purchases/input_invoice_views.py#L267) |
| GET | `/api/v1/purchases/reconciliations/candidate-lines/` | [backend/purchases/reconciliation_views.py:216](../backend/purchases/reconciliation_views.py#L216) |
| GET | `/api/v1/purchases/reconciliations/eligible-documents/` | [backend/purchases/reconciliation_views.py:271](../backend/purchases/reconciliation_views.py#L271) |
| POST | `/api/v1/purchases/reconciliations/{id}/request-resolve/` | [backend/purchases/reconciliation_views.py:322](../backend/purchases/reconciliation_views.py#L322) |
| POST | `/api/v1/purchases/reconciliations/{id}/recalculate/` | [backend/purchases/reconciliation_views.py:338](../backend/purchases/reconciliation_views.py#L338) |
| GET | `/api/v1/purchases/tracking/{id}/document-preview/` | [backend/purchases/tracking_views.py:123](../backend/purchases/tracking_views.py#L123) |
| GET | `/api/v1/purchases/purchase-costs/eligible-purchases/` | [backend/purchases/cost_views.py:153](../backend/purchases/cost_views.py#L153) |
| POST | `/api/v1/purchases/supplier-risk/{id}/recheck/` | [backend/purchases/risk_views.py:181](../backend/purchases/risk_views.py#L181) |
| POST | `/api/v1/purchases/supplier-risk/check-transaction/` | [backend/purchases/risk_views.py:214](../backend/purchases/risk_views.py#L214) |
| GET/POST | `/api/v1/purchases/supplier-risk/incidents/` | [backend/purchases/risk_views.py:336](../backend/purchases/risk_views.py#L336) |
| POST | `/api/v1/purchases/supplier-risk/incidents/(?P<incident_id>[^/.]+)/resolve/` | [backend/purchases/risk_views.py:381](../backend/purchases/risk_views.py#L381) |
| GET | `/api/v1/reports/runs/{id}/drill-down/` | [backend/reporting/views.py:111](../backend/reporting/views.py#L111) |
| POST | `/api/v1/sales/quotations/{id}/decline-response/` | [backend/sales/views.py:132](../backend/sales/views.py#L132) |
| GET | `/api/v1/sales/quotations/{id}/prepare-order/` | [backend/sales/views.py:154](../backend/sales/views.py#L154) |
| POST | `/api/v1/sales/quotations/{id}/decline/` | [backend/sales/views.py:178](../backend/sales/views.py#L178) |
| POST | `/api/v1/sales/contracts/{id}/return_to_draft/` | [backend/sales/contract_views.py:161](../backend/sales/contract_views.py#L161) |
| GET | `/api/v1/sales/contracts/{id}/open_transactions/` | [backend/sales/contract_views.py:180](../backend/sales/contract_views.py#L180) |
| POST | `/api/v1/sales/contracts/{id}/create_annex/` | [backend/sales/contract_views.py:229](../backend/sales/contract_views.py#L229) |
| POST | `/api/v1/sales/contracts/{id}/annexes/(?P<annex_id>[^/.]+)/sign/` | [backend/sales/contract_views.py:240](../backend/sales/contract_views.py#L240) |
| GET | `/api/v1/sales/contracts/{id}/annexes/` | [backend/sales/contract_views.py:257](../backend/sales/contract_views.py#L257) |
| GET/POST | `/api/v1/sales/contracts/{id}/prepare_order/` | [backend/sales/contract_views.py:264](../backend/sales/contract_views.py#L264) |
| POST | `/api/v1/sales/contracts/from_quotation/` | [backend/sales/contract_views.py:270](../backend/sales/contract_views.py#L270) |
| GET | `/api/v1/sales/orders/prepare-from-sources/` | [backend/sales/views.py:243](../backend/sales/views.py#L243) |
| POST | `/api/v1/sales/orders/{id}/request-revision/` | [backend/sales/views.py:271](../backend/sales/views.py#L271) |
| GET | `/api/v1/sales/orders/{id}/check-feasibility/` | [backend/sales/views.py:291](../backend/sales/views.py#L291) |
| GET | `/api/v1/sales/orders/{id}/invoice-eligible-lines/` | [backend/sales/views.py:299](../backend/sales/views.py#L299) |
| POST | `/api/v1/sales/orders/{id}/create-invoice-request/` | [backend/sales/views.py:303](../backend/sales/views.py#L303) |
| GET | `/api/v1/sales/goods-sales/prepare-from-order/` | [backend/sales/goods_views.py:100](../backend/sales/goods_views.py#L100) |
| GET | `/api/v1/sales/goods-sales/prepare-from-issue/` | [backend/sales/goods_views.py:112](../backend/sales/goods_views.py#L112) |
| POST | `/api/v1/sales/goods-sales/{id}/request-revision/` | [backend/sales/goods_views.py:139](../backend/sales/goods_views.py#L139) |
| POST | `/api/v1/sales/goods-sales/{id}/link-invoice/` | [backend/sales/goods_views.py:164](../backend/sales/goods_views.py#L164) |
| GET | `/api/v1/sales/service-sales/prepare-from-order/` | [backend/sales/service_views.py:99](../backend/sales/service_views.py#L99) |
| POST | `/api/v1/sales/service-sales/{id}/request-revision/` | [backend/sales/service_views.py:126](../backend/sales/service_views.py#L126) |
| POST | `/api/v1/sales/service-sales/{id}/link-invoice/` | [backend/sales/service_views.py:151](../backend/sales/service_views.py#L151) |
| GET | `/api/v1/sales/sales-returns/prepare_from_sale/` | [backend/sales/sales_return_views.py:108](../backend/sales/sales_return_views.py#L108) |
| POST | `/api/v1/sales/sales-returns/{id}/request_revision/` | [backend/sales/sales_return_views.py:145](../backend/sales/sales_return_views.py#L145) |
| POST | `/api/v1/sales/sales-returns/{id}/link_invoice/` | [backend/sales/sales_return_views.py:190](../backend/sales/sales_return_views.py#L190) |
| GET | `/api/v1/sales/sales-allowances/prepare_from_sale/` | [backend/sales/sales_allowance_views.py:115](../backend/sales/sales_allowance_views.py#L115) |
| POST | `/api/v1/sales/sales-allowances/{id}/request_revision/` | [backend/sales/sales_allowance_views.py:169](../backend/sales/sales_allowance_views.py#L169) |
| POST | `/api/v1/sales/sales-allowances/{id}/link_invoice/` | [backend/sales/sales_allowance_views.py:214](../backend/sales/sales_allowance_views.py#L214) |
| GET | `/api/v1/sales/sales-invoices/prepare_from_sale/` | [backend/sales/sales_invoice_views.py:136](../backend/sales/sales_invoice_views.py#L136) |
| POST | `/api/v1/sales/sales-invoices/{id}/request_revision/` | [backend/sales/sales_invoice_views.py:178](../backend/sales/sales_invoice_views.py#L178) |
| POST | `/api/v1/sales/sales-invoices/{id}/retry_issue/` | [backend/sales/sales_invoice_views.py:200](../backend/sales/sales_invoice_views.py#L200) |
| POST | `/api/v1/sales/sales-invoices/{id}/send_email/` | [backend/sales/sales_invoice_views.py:215](../backend/sales/sales_invoice_views.py#L215) |
| POST | `/api/v1/sales/discount-invoices/calculate-allocation/` | [backend/sales/discount_invoice_views.py:159](../backend/sales/discount_invoice_views.py#L159) |
| POST | `/api/v1/sales/discount-invoices/create-from-basis/` | [backend/sales/discount_invoice_views.py:170](../backend/sales/discount_invoice_views.py#L170) |
| POST | `/api/v1/sales/discount-invoices/{id}/submit-approval/` | [backend/sales/discount_invoice_views.py:187](../backend/sales/discount_invoice_views.py#L187) |
| POST | `/api/v1/sales/discount-invoices/{id}/return-to-draft/` | [backend/sales/discount_invoice_views.py:200](../backend/sales/discount_invoice_views.py#L200) |
| POST | `/api/v1/sales/discount-invoices/{id}/retry-issue/` | [backend/sales/discount_invoice_views.py:214](../backend/sales/discount_invoice_views.py#L214) |
| POST | `/api/v1/sales/discount-invoices/{id}/check-issue-status/` | [backend/sales/discount_invoice_views.py:222](../backend/sales/discount_invoice_views.py#L222) |
| GET | `/api/v1/sales/discount-invoices/{id}/download-files/` | [backend/sales/discount_invoice_views.py:238](../backend/sales/discount_invoice_views.py#L238) |
| POST | `/api/v1/sales/discount-invoices/{id}/send-email/` | [backend/sales/discount_invoice_views.py:254](../backend/sales/discount_invoice_views.py#L254) |
| GET | `/api/v1/sales/commercial-invoices/eligible-source-orders/` | [backend/sales/commercial_invoice_views.py:152](../backend/sales/commercial_invoice_views.py#L152) |
| POST | `/api/v1/sales/commercial-invoices/{id}/submit-approval/` | [backend/sales/commercial_invoice_views.py:169](../backend/sales/commercial_invoice_views.py#L169) |
| POST | `/api/v1/sales/commercial-invoices/{id}/recall-approval/` | [backend/sales/commercial_invoice_views.py:179](../backend/sales/commercial_invoice_views.py#L179) |
| POST | `/api/v1/sales/commercial-invoices/{id}/request-revision/` | [backend/sales/commercial_invoice_views.py:205](../backend/sales/commercial_invoice_views.py#L205) |
| POST | `/api/v1/sales/commercial-invoices/{id}/return-to-draft/` | [backend/sales/commercial_invoice_views.py:231](../backend/sales/commercial_invoice_views.py#L231) |
| POST | `/api/v1/sales/commercial-invoices/{id}/check-issue-status/` | [backend/sales/commercial_invoice_views.py:277](../backend/sales/commercial_invoice_views.py#L277) |
| POST | `/api/v1/sales/commercial-invoices/{id}/retry-issue/` | [backend/sales/commercial_invoice_views.py:288](../backend/sales/commercial_invoice_views.py#L288) |
| POST | `/api/v1/sales/commercial-invoices/{id}/create-new-version/` | [backend/sales/commercial_invoice_views.py:305](../backend/sales/commercial_invoice_views.py#L305) |
| GET | `/api/v1/sales/commercial-invoices/{id}/download-files/` | [backend/sales/commercial_invoice_views.py:312](../backend/sales/commercial_invoice_views.py#L312) |
| POST | `/api/v1/sales/commercial-invoices/{id}/send-email/` | [backend/sales/commercial_invoice_views.py:323](../backend/sales/commercial_invoice_views.py#L323) |
| GET | `/api/v1/sales/tracking/{id}/delivery-tab/` | [backend/sales/tracking_views.py:96](../backend/sales/tracking_views.py#L96) |
| GET | `/api/v1/sales/tracking/{id}/sales-invoice-tab/` | [backend/sales/tracking_views.py:105](../backend/sales/tracking_views.py#L105) |
| GET | `/api/v1/sales/tracking/{id}/payment-tab/` | [backend/sales/tracking_views.py:114](../backend/sales/tracking_views.py#L114) |
| GET | `/api/v1/sales/cogs/eligible-lines/` | [backend/sales/cogs_views.py:190](../backend/sales/cogs_views.py#L190) |
| POST | `/api/v1/sales/cogs/{id}/request-revision/` | [backend/sales/cogs_views.py:248](../backend/sales/cogs_views.py#L248) |
| GET | `/api/v1/sales/cogs/{id}/check-difference/` | [backend/sales/cogs_views.py:293](../backend/sales/cogs_views.py#L293) |
| GET | `/api/v1/sales/links/matchable-lines/` | [backend/sales/link_views.py:132](../backend/sales/link_views.py#L132) |
| POST | `/api/v1/tax/obligations/{id}/link-payment/` | [backend/tax_management/views.py:195](../backend/tax_management/views.py#L195) |

## Alias chưa dùng — không kết luận thiếu chức năng

Cùng ViewSet với customer-due-debts, FE đã dùng đường dẫn thay thế.

| Alias | Nguồn |
|---|---|
| `/api/v1/accounts-receivable/due-tracking/` | [backend/accounts_receivable/urls.py:19](../backend/accounts_receivable/urls.py#L19) |

## APIView cần kiểm tra bổ sung

Không tìm thấy tên phần cuối trong FE. Các đường dẫn xác thực có thể là alias của luồng đã được kết nối. Không tính chúng là chức năng thiếu khi chưa kiểm tra tương đương.

| Endpoint | Nguồn |
|---|---|
| `/api/v1/common/auth/verify-email/` | [backend/common_services/urls.py:67](../backend/common_services/urls.py#L67) |
| `/api/v1/common/auth/forgot-password/` | [backend/common_services/urls.py:78](../backend/common_services/urls.py#L78) |
| `/api/v1/common/profile/confirm-email/` | [backend/common_services/urls.py:81](../backend/common_services/urls.py#L81) |
| `/api/v1/common/numbering/generate/` | [backend/common_services/urls.py:107](../backend/common_services/urls.py#L107) |
| `/api/v1/common/numbering/validate-manual/` | [backend/common_services/urls.py:108](../backend/common_services/urls.py#L108) |

## Xác thực phiên

`POST /api/token/refresh/` được khai báo ở backend/config/urls.py nhưng chưa tìm thấy lời gọi trong FRONTEND/src.
