# Danh sách bài kiểm thử chưa đạt — 26/10/2026

Lệnh chạy: `cd backend; ..\venv\Scripts\python.exe manage.py test --keepdb --noinput --verbosity 0`.
Kết quả: 51 bài chưa đạt trong 1.332 bài (49 FAIL, 2 ERROR). Nhiều bài có chung nguyên nhân; cột nguyên nhân chỉ là phân nhóm từ thông báo lỗi.

| Loại | Bài kiểm tra | Phân hệ | Nhóm lỗi |
|---|---|---|---|
| ERROR | `test_11_merge_customers_success_and_preserves_history` | `master_data` | Dữ liệu thử trùng mã số thuế |
| ERROR | `test_14_cannot_hard_delete_customer_with_transactions` | `master_data` | Dữ liệu thử dùng trường model cũ |
| FAIL | `test_fx_journal_and_unpost_reversal` | `accounts_receivable` | Sổ cái chặn bút toán từ phân hệ nguồn |
| FAIL | `test_af06_unpost_decrease_adjustment` | `accounts_receivable` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_af06_unpost_increase_adjustment` | `accounts_receivable` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_foreign_currency_exchange_rate_and_conversion` | `accounts_receivable` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_af06_unpost_and_restore_balances_and_gl` | `accounts_receivable` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_ap_netting_synchronized_on_post_and_unpost` | `accounts_receivable` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_fifo_schedules_allocation_and_unpost_restoration` | `accounts_receivable` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_fx_difference_gain_and_loss_gl` | `accounts_receivable` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_fx_difference_loss_recorded_to_635` | `accounts_receivable` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_main_flow_draft_post_success` | `accounts_receivable` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_transfer_edit_cancel_and_atomic_unpost` | `bank_management` | Sổ cái chặn bút toán từ phân hệ nguồn |
| FAIL | `test_costs_are_assigned_transferred_and_accepted` | `costing` | Thiếu liên kết bút toán gốc |
| FAIL | `test_fifo_costing_consumes_oldest_layer_and_rolls_back_on_missing_accounts` | `inventory` | Thiếu liên kết bút toán gốc |
| FAIL | `test_periodic_costing_updates_issue_stock_and_adjustment_journal` | `inventory` | Thiếu liên kết bút toán gốc |
| FAIL | `test_03_tax_code_normalization_and_duplicate_check` | `master_data` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_07_receivable_and_revenue_accounts_validation` | `master_data` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_17_concurrency_control_version` | `master_data` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_payment_and_receipt_enforce_selected_method` | `master_data` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_warehouse_scope_filters_and_authorizes_each_warehouse` | `master_data` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_department_rule_groups_salary_posting` | `payroll` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_full_month_salary_is_calculated_and_posted` | `payroll` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_deductible_input_vat_is_posted_to_1331` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_direct_purchase_does_not_change_stock` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_immediate_payment_requires_confirmed_sufficient_payment` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_linked_receipt_is_not_applied_twice_or_reversed` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_order_limit_and_closed_period_prevent_posting` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_receipt_draft_invoice_terms_and_posting` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_six_decimal_quantity_reaches_inventory_without_truncation` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_warehouse_post_and_unpost_are_atomic` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_manual_receipt_link_and_unlink_without_new_payable` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_partial_match_then_later_link` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_12_confirm_contract_without_workflow_af04` | `purchases` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_amount_post_unpost_keeps_quantities_and_stock` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_inventory_value_discount_draft_post_and_unpost` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_inventory_value_discount_rejects_issued_source_stock` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_journal_failure_rolls_back` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_paid_purchase_creates_supplier_credit` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_percent_and_cumulative_limit` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_returned_value_reduces_discount_limit` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_tax_adjustment_invoice_required_at_post` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_direct_reconciliation_matched` | `purchases` | Sai trạng thái, quyền hoặc giá trị mong đợi; xem test tương ứng |
| FAIL | `test_over_return_and_stock_shortage` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_paid_direct_purchase_creates_supplier_credit` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_post_failure_rolls_back_stock_and_payable` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_warehouse_partial_return_and_unpost` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_order_limit_and_rollback` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_post_and_unpost_service_without_inventory` | `purchases` | Sai phiên bản khi gọi sổ cái |
| FAIL | `test_accounts_payable_resources_have_separate_tags` | `common_services` | Không sinh được tài liệu API |
| FAIL | `test_resource_actions_stay_in_their_resource_section` | `common_services` | Không sinh được tài liệu API |
