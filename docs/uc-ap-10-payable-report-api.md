# UC-AP-10 — Báo cáo công nợ phải trả (backend)

The read-only API is at `/api/v1/accounts-payable/reports/` and requires `AP.REPORT.VIEW` for the selected company. Migration `0028_seed_report_permission` creates this permission. It creates no journal or report document.

| Method/path | Result |
| --- | --- |
| `GET /?company_id=...` | Paginated summary or transaction detail |
| `GET /supplier-detail/?company_id=...&supplier_id=...` | Detail for one supplier using the same period and currency |
| `GET /source/?company_id=...&transaction_id=...` | Read-only source reference after checking the source document's view permission |
| `GET /export-excel/?company_id=...` | XLSX containing all filtered rows |
| `GET /export-pdf/?company_id=...` | PDF containing all filtered rows |

Query parameters: `report_type=SUMMARY|DETAIL` (default `SUMMARY`), `start_date=YYYY-MM-DD` (first day of current month), `end_date=YYYY-MM-DD` (today), `currency_id=VND` (active code or UUID), repeated or comma-separated `supplier_ids` (all), `only_nonzero_closing=true|false` (default `true`), `page` (default 1), and `page_size=20|50|100` (default 20). Dates are inclusive. `supplier-detail` also takes one `supplier_id`.

For each supplier, the report sums posted, non-cancelled source payables and signed adjustments/offsets through the end date. The full posted payment amount reduces the supplier balance on its payment date, including advances. A later payment allocation is not a second reduction. Opening balance is the net of transactions before the start date; closing balance is opening plus increases less decreases. Negative balances represent advances. When `only_nonzero_closing=false`, suppliers are still omitted if they have neither an opening balance nor any movement in the period.

`DETAIL` returns a transaction's `transaction_id`, source type and source ID, posting date, document number, transaction type, description, increase, decrease and running supplier balance. Transactions sort by posting date, posting timestamp and document number. The `source` action checks that the transaction belongs to the filtered report and that the user can view its source. Exports ignore pagination while preserving the selected filters and row order.
