# Payment terms backend

Use `/api/v1/master-data/payment-terms/` with `company_id` in every request. The IAM resource is `MD.PAYMENT_TERM` with `VIEW`, `CREATE`, `EDIT`, `DEACTIVATE`, `IMPORT`, and `EXPORT` actions. Responses include a `version`; supply that value when updating a term or changing its status or default.

The catalogue supports list/search/filter (`scope`, `status`, `due_base`), detail, create, update, copy, activation, deactivation, and one purchase and one sale default per company. Deactivating a default requires `clear_default: true`. Records remain available for historical references; deletion is not exposed.

## Additional routes

- `POST /{id}/copy/` — supply a new `code`; copied defaults are cleared.
- `POST /{id}/set-default/` — supply `scope: PURCHASE|SALE` and `version`.
- `GET /{id}/calculate/` — supply the date required by `due_base` (`document_date`, `invoice_date`, `delivery_date`, or `acceptance_date`). Optional `actual_payment_date` checks discount eligibility against the actual payment date.
- `GET /suggest/` — supply `scope` and `on_date`; optional `party_id`. An available party term takes priority over the company default. This is a deterministic suggestion and does not alter a document.
- `GET /export/` — filtered CSV.
- `POST /import-preview/` and `/import-apply/` — JSON `{ "rows": [...] }` or multipart CSV `file`. Existing codes update only when their current `version` is supplied. Apply is atomic. Limit: 500 rows or 2 MB CSV.

Sales quotations, contracts and orders, and purchase orders check that newly selected terms are active, within their effective dates, and valid for their scope. Supplier invoices and receivable documents store both the selected term and a due-date snapshot. They prefer an explicit term, then an available party term, then the company default; receivable documents can also inherit a source sales order or contract term. The due date is recalculated while a document is editable if its term or base date changes. Terms based on delivery or acceptance dates cannot be selected on those invoice/document endpoints because those dates are not present there. Existing posted document due dates are never changed when a term changes.

AI suggestions require a separate trusted AI integration. The manual catalogue and deterministic suggestions work without it.
