# Payment methods backend

Use `/api/v1/master-data/payment-methods/` with `company_id` on every request. IAM permissions are `MD.PAYMENT_METHOD.VIEW`, `CREATE`, `EDIT`, `DEACTIVATE`, `IMPORT`, and `EXPORT`. Updates and state changes require the current `version`.

Methods have a `group` (`CASH`, `BANK`, `CARD`, `WALLET`, `CHEQUE`, `NETTING`, `OTHER`) and `scope` (`RECEIPT`, `PAYMENT`, `BOTH`). A cash method can reference an active company cash fund. Bank methods can reference an active company bank account. An `integration_channel` is accepted only for a connected bank account whose provider matches the channel; no credentials or secrets are stored in the method. Card and wallet methods remain available for manual recording without an integration.

The catalogue API supports list/search/filter (`group`, `scope`, `status`), detail, create, update, copy, activation, deactivation, and one default per receipt/payment scope. `POST /{id}/set-default/` takes `scope` and `version`. Deactivating a default needs `clear_default: true`. `GET /suggest/` takes `scope` and `on_date` and only suggests an available default. Deletion is not exposed, preserving historical references.

`GET /export/` returns filtered CSV. `POST /import-preview/` and `/import-apply/` accept JSON `{ "rows": [...] }` or multipart CSV `file`; updates need the current row `version`. Apply is atomic. Limit: 500 rows or 2 MB CSV.

New accounts payable payments, accounts receivable receipts, cash transactions, and bank transactions may supply `payment_method_config`. The backend checks group, direction, effective date, required reference, and the company cash fund or bank account. AP/AR payment and receipt records also store those linked fund/account values. Each transaction stores a `payment_method_snapshot` with the selected method's code, name, and group so later catalogue edits do not change its recorded meaning. Existing `external_type` codes remain for legacy records; the selected method supplies the matching code for new AP/AR transactions. Selecting a method does not itself create or confirm a separate money movement.

Sales quotations, sales contracts, sales orders, purchase orders, supplier invoices and receivable documents can also specify `payment_method_config` alongside `payment_term`. The planned method is checked for company, direction and effective date, then recorded in `payment_method_snapshot`. A new receivable document inherits the method from its sales order or contract when none is specified. Payment-time reference and account requirements are checked on the actual transaction. These optional fields preserve compatibility with existing documents.

AI recommendations and external card/wallet gateways need separate integration contracts. Manual methods and the deterministic default suggestion work without them.
