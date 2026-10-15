# UC-SAL-01 — Quản lý báo giá (backend)

Backend route: `/api/v1/sales/quotations/`. This implementation does not add frontend screens. Existing sales approval endpoints remain available for older quotations; the UC-SAL-01 workflow uses the actions below.

| Method/path | Action |
| --- | --- |
| `POST /?company_id=...` | Save a draft with an automatically assigned `BG-YYYY-NNNNNN` number. Do not send `number`. |
| `GET /defaults/?company_id=...&customer_id=...&item_id=...` | Read date, currency, customer contact and item/active tax defaults without saving. |
| `POST /issue/?company_id=...` | Create and issue a fully validated quotation, generate and store its PDF. |
| `POST /{id}/issue/?company_id=...` | Validate and issue an existing draft. |
| `GET /{id}/pdf/?company_id=...` | Download its stored issued PDF. |
| `POST /{id}/email/?company_id=...` | Send the PDF to the supplied `email` or an email in the customer's contacts. |
| `POST /{id}/accept-response/?company_id=...` | Record `response_date` and `response_content`; status becomes `ACCEPTED`. |
| `POST /{id}/decline-response/?company_id=...` | Record `response_date` and `reason`; status becomes `DECLINED`. |
| `POST /{id}/cancel/?company_id=...` | Cancel a draft or issued quotation with a required `reason`. |
| `GET /{id}/duplicate/?company_id=...` | Return a draft payload without creating a record. |
| `POST /{id}/new-version/?company_id=...` | Create a new draft number/version linked to the original quotation. |
| `GET /{id}/prepare-order/?company_id=...` | Return sales-order input prefilled from an accepted quotation. |
| `GET /settings/?company_id=...` | Read configured validity days (default 15). |
| `PATCH /settings/?company_id=...` | Set validity days from 1 to 365. |

Creating a sales order with the `quotation` field requires an accepted quotation and exactly its lines linked through `quotation_line`. If all order lines reference the same accepted quotation, the order API also infers this link. A one-to-one database constraint prevents converting the same quotation twice; a successful order creation marks it `ORDERED`. Orders without quotation lines continue through the existing sales flow.

The new issue actions recompute every amount from line quantity, price, discount and effective VAT rate, rounding each line to the currency's decimal precision. Drafts may contain incomplete line values, but an issue operation requires all fields and active customer, item and tax data. Issuing is atomic with PDF generation and numbering. Quotations do not reserve stock or post accounting entries.
