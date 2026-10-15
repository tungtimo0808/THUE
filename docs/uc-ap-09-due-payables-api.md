# UC-AP-09 — Theo dõi công nợ đến hạn (backend)

All endpoints require an authenticated user with `AP.PAYABLE.VIEW` for `company_id`. Superusers retain the application's normal permission bypass. No endpoint posts or changes debt.

Base path: `/api/v1/accounts-payable/due-payables/`.

| Method/path | Purpose |
| --- | --- |
| `GET /?company_id=...` | List due payables and totals |
| `GET /{payable_id}/?company_id=...` | One payable plus as-of transaction history |
| `POST /prepare-payment-request/?company_id=...` | Validate selected payables and return UC-AP-03 prefill data; body: `{"payable_ids":["..."]}` |
| `GET /export-excel/?company_id=...` | Download the same filtered, ordered rows as XLSX |
| `GET /export-pdf/?company_id=...` | Download the same filtered, ordered rows as PDF |

Optional query parameters for reads and exports: `as_of_date=YYYY-MM-DD` (today), `currency_id=VND` (active currency code or UUID), `due_group=ALL|OVERDUE|DUE_TODAY|DUE_SOON|NOT_DUE|NO_DUE_DATE` (`ALL`), `warning_days=1..365` (`7`), `payment_status=ALL|OPEN|PARTIALLY_PAID` (`ALL`), and repeated or comma-separated `supplier_ids` (all suppliers). One request uses one currency. An explicitly empty required parameter fails validation.

Amounts are calculated from the posted source and effective dated adjustments, offsets, payments and payment allocations through `as_of_date`. Unallocated supplier advances do not reduce a particular payable. The five group totals and grand total contain only rows that survive the selected filters, including the payment-status filter. `total_debt` is original debt plus increases minus nonpayment reductions; `paid_amount` contains allocated payments; `remaining_amount = total_debt - paid_amount`. A row appears only if its as-of remaining amount is positive. `days` is the absolute number of overdue/remaining days, `0` on the due date and `null` without a due date. All rows are ordered by due group, due date, document date, document number and ID.

The prefill action recalculates current `Payable.balance` less amounts reserved in payment requests awaiting approval, approved or partly paid. It rejects empty selections, cross-supplier selections, and any selected line without available amount. The response is a proposed input for UC-AP-03; the actual payment request must still pass that use case's own validation when submitted.
