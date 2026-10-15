# Tax catalogue backend

All endpoints require authentication and `company_id` in the query string. Company created records also require `company` in the request body. IAM permissions are `MD.TAX_TYPE.*` and `MD.TAX_RATE.*` with actions `VIEW`, `CREATE`, `EDIT`, `DEACTIVATE`, `IMPORT`, and `EXPORT`.

## Endpoints

- `GET/POST /api/v1/master-data/tax-types/` — list, search, filter by `status`, create a company tax type.
- `GET/PATCH /api/v1/master-data/tax-types/{id}/` — detail and update. Include the current integer `version` in updates.
- `POST /api/v1/master-data/tax-types/{id}/activate/` and `/deactivate/` — include `version`. Deactivation requires all child rates to be inactive.
- `GET/POST /api/v1/master-data/tax-rate-configs/` — list and create dated rate configurations. Filter with `tax_type_ref_id`, `business_scope`, and `status`.
- `GET/PATCH /api/v1/master-data/tax-rate-configs/{id}/` — detail and update, with `version` on updates.
- `POST /api/v1/master-data/tax-rate-configs/{id}/new-version/` — include the old `version`, the new `effective_from`, and changed rate fields. An open ended old version closes the day before the new start, in the same transaction.
- `GET /api/v1/master-data/tax-rate-configs/resolve/?company_id=...&on_date=YYYY-MM-DD&business_scope=INPUT|OUTPUT` — active rates valid on the business date. Optional `tax_type_ref_id`.
- `GET /api/v1/master-data/tax-types/export/` and `.../tax-rate-configs/export/` — filtered CSV.
- `POST /api/v1/master-data/tax-types/import-preview/`, `.../import-apply/` and equivalent rate endpoints — JSON `{ "rows": [...] }` or multipart CSV `file`. Preview returns row errors; apply is atomic. Up to 500 rows or 2 MB CSV.

`TaxRate` remains the model referenced by purchase, sale, payable, and item records. Its prior fields and `/tax-rates/` endpoint remain available; the richer catalogue API uses `tax_type_ref` to distinguish configured rates from legacy rows.

The optional policy update feed and AI recommendation service need a trusted source and integration contract before they can be connected. The manual catalogue APIs operate independently of either service.
